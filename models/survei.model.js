"use strict";
const path = require("path");
const { google } = require("googleapis");
const { authenticate } = require("@google-cloud/local-auth");
const supabase = require("../constraint/database");
const midtransClient = require("midtrans-client");
const saldo = require("./saldo.model");
const { response } = require("express");
const kategori = require("./kategori.model");

const survei = {
  create: async ({
    form_meta_req,
    form_res,
    harga,
    title,
    kategori,
    id_user_create,
    accessToken,
  }) => {
    try {
      // const formID = "1sRDm9iHoH8dF-AKTExEfHTQ_R1vehIxombT77zQLg-0"; // Ganti dengan form ID Anda

      const editLinkPattern = /https:\/\/docs\.google\.com\/forms\/d\/.*\/edit/;

      // Memeriksa apakah link yang dimasukkan adalah link edit
      if (!editLinkPattern.test(form_meta_req)) {
        throw new Error("Please provide the edit link, not the share link.");
      }

      const shareLinkPattern =
        /https:\/\/docs\.google\.com\/forms\/d\/e\/.*\/viewform/;
      if (!shareLinkPattern.test(form_res)) {
        throw new Error("Please provide the share link (respondent link).");
      }

      if (!harga || isNaN(harga) || harga <= 0) {
        throw new Error(
          "Harga tidak boleh kosong dan harus berupa angka positif."
        );
      }

      if (!title || title.trim() === "") {
        throw new Error("Title tidak boleh kosong.");
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET
      );
      // Mengautentikasi pengguna menggunakan OAuth 2.0
      oauth2Client.setCredentials({ access_token: accessToken });

      const forms = google.forms({ version: "v1", auth: oauth2Client });
      const id_form = form_meta_req.match(
        /https:\/\/docs\.google\.com\/forms\/d\/([^\/]+)\/edit/
      );
      const share_id_form = form_res.match(
        /https:\/\/docs\.google\.com\/forms\/d\/e\/([^\/]+)\/viewform/
      )[1];

      const formMeta = await forms.forms.get({ formId: id_form[1] });
      const items = formMeta.data.items;
      const totalQuestions = items
        .map((item) => item?.questionItem?.question)
        .filter((question) => question !== undefined).length;

      const hadiah = harga / totalQuestions;

      const snap = new midtransClient.Snap({
        isProduction: false,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
      });

      const user = await getUserById(id_user_create);

      let parameter = {
        transaction_details: {
          order_id: "order-id-node-" + new Date().getTime(),
          gross_amount: harga,
        },
        credit_card: {
          secure: true,
        },
        customer_details: {
          first_name: user.nama,
          email: user.email,
        },
      };

      const transaction = await snap.createTransaction(parameter);
      const midtransLink = transaction.redirect_url;
      if (!midtransLink)
        throw new Error("Midtrans Error: Transaction link not created.");

      const { data, error } = await supabase
        .from("survei")
        .insert([
          {
            judul: title,
            link_form: form_res,
            link_meta: form_meta_req,
            hadiah: hadiah,
            saldo: harga,
            status_payment: "PENDING!",
            payment_url: midtransLink,
            id_pembuat: id_user_create,
            order_id: parameter.transaction_details.order_id,
            id_form: share_id_form,
          },
        ])
        .select();

      if (error) throw new Error(error.message);

      const id_survei = data[0].id;

      for (const value of kategori) {
        const { data: kategori_survei, error: error_kategori } = await supabase
          .from("kategori_survei")
          .insert([
            {
              id_survei: id_survei,
              id_filter: value,
            },
          ]);

        if (error_kategori) throw new Error(error_kategori.message);
      }

      const { error_riwayat } = await supabase.from("riwayat_survei").insert([
        {
          id_user: id_user_create,
          id_survei: id_survei,
        },
      ]);

      if (error_riwayat) throw new Error(error_riwayat);

      return {
        status: "ok",
        data: {
          hadiah,
          harga,
          midtrans_link: midtransLink,
          total_question: totalQuestions,
        },
      };
    } catch (err) {
      console.error(" Exception:", err.message);
      return { status: "err", msg: err.message };
    }
  },
  getResponses: async ({ form_meta_req }) => {
    // Autentikasi dengan Google Forms API
    const auth = await authenticate({
      keyfilePath: path.join(__dirname, "../credentials.json"),
      scopes: ["https://www.googleapis.com/auth/forms.responses.readonly"],
    });

    // Buat instance Forms API dengan autentikasi
    const forms = google.forms({ version: "v1", auth });

    try {
      // Mendapatkan respons dari form
      const formResponses = await forms.forms.responses.list({
        formId: form_meta_req,
      });

      const responses = formResponses.data.responses;

      if (!responses || responses.length === 0) {
        return {
          status: "ok",
          data: {
            message: "Tidak ada respons yang ditemukan.",
          },
        };
      }

      return {
        status: "ok",
        data: {
          total_response: responses.length,
          responses,
        },
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  claimReward: async ({ link_form, id_user_create }) => {
    try {
      const responseLinkPattern =
        /https:\/\/docs\.google\.com\/forms\/d\/e\/.*\/formResponse/;

      // Optionally, check for a response link (if needed)
      if (link_form && !responseLinkPattern.test(link_form)) {
        throw new Error(
          "Please provide the correct response link (after form submission)."
        );
      }

      const id_form = link_form.match(
        /https:\/\/docs\.google\.com\/forms\/d\/e\/([^\/]+)\/formResponse/
      );

      const dataForm = await getSurveiByForm(id_form[1]);

      if (!dataForm) {
        throw new Error(
          "Please provide the correct response link (after form submission)."
        );
      }

      const user = await getUserById(id_user_create);

      const { error_claim } = await supabase.from("claim").insert([
        {
          email: user.email,
          nama: user.nama,
          tanggal_lahir: user.biodata.tanggal_lahir,
          gender: user.biodata.gender,
          pekerjaan: user.biodata.pekerjaan,
          judul_survei: dataForm.judul,
          provinsi: user.biodata.provinsi,
          kota: user.biodata.kota,
        },
      ]);

      if (error_claim) {
        throw new Error("Sorry you have claimed");
      }

      let keterangan = "Add reward survei " + dataForm.judul;

      const transaksiData = await saldo.addTransaksi(
        id_user_create,
        dataForm.hadiah,
        true,
        keterangan
      );

      return {
        status: "ok",
        data: {
          updateSaldo,
          message: transaksiData,
        },
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  callbackPayment: async ( notification ) => {
    console.log(notification);

    if (!notification || typeof notification !== 'object') {
      return { status: "err", msg: "Invalid notification format." };
    }
    try {
      let coreApi = new midtransClient.CoreApi({
        isProduction: false,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
      });
      
      // Get the transaction status from Midtrans
      const statusResponse = await coreApi.transaction.notification(
        notification
      );

      // Extract necessary details
      const transactionStatus = statusResponse.transaction_status;
      const orderId = statusResponse.order_id;
      const fraudStatus = statusResponse.fraud_status;

      console.log(
        `Transaction status for order ID ${orderId}: ${transactionStatus}`
      );

      let { data: transactionSurvei, error } = await getSurveiByOrderiD(
        orderId
      );

      if (error || !transactionSurvei) {
        return res.status(404).json({ message: "Survey not found." });
        n;
      }

      let newStatus = transactionSurvei.status_payment;
      let surveiStatus = "close";

      if (transactionStatus === "capture") {
        if (fraudStatus === "challenge") {
          newStatus = "PENDING";
          console.log("Transaction is challenged!");
        } else if (fraudStatus === "accept") {
          newStatus = "SUCCESS";
          surveiStatus = "open";
          console.log("Transaction successful!");
        }
      } else if (transactionStatus === "settlement") {
        newStatus = "SUCCESS";
        surveiStatus = "open";
        console.log("Transaction settled!");
      } else if (transactionStatus === "deny") {
        newStatus = "DENIED";
        console.log("Transaction denied!");
      } else if (
        transactionStatus === "cancel" ||
        transactionStatus === "expire"
      ) {
        newStatus = "CANCELED";
        console.log("Transaction canceled or expired!");
      } else if (transactionStatus === "pending") {
        newStatus = "PENDING";
        console.log("Transaction is pending!");
      }

      // Update the survey payment status in Supabase
      const { error: updateError } = await updateSurveiStatus(
        orderId,
        newStatus,
        surveiStatus
      );

      if (updateError) {
        throw updateError;
      }

      // Send a 200 OK response to Midtrans
      return {
        status: "ok",
        data: {
          message: "Notification received successfully",
        },
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  getDataAll: async ({ filter }) => {
    try {
      if (!filter) {
        const data = await getSurveiAll(filter);

        return {
          status: "ok",
          data,
        };
      }
      const filterArray = filter.split(",").map(Number);

      const data = await getSurveiAll(filterArray);

      return {
        status: "ok",
        data,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  getDataById: async ({ id }) => {
    try {
      const { data, error } = await getSurveiById(id);

      if (error) {
        throw new Error(error);
      }

      return {
        status: "ok",
        data,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  getRiwayatSurvei: async ({ id_user }) => {
    try {
      const { data, error } = await getRiwayatSurvei(id_user);

      if (error) {
        throw new Error(error);
      }

      return {
        status: "ok",
        data,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },
  getRiwayatSurveiSaya: async ({ id_user }) => {
    try {
      const { data, error } = await getRiwayatSurveiMy(id_user);
  
      if (error) {
        throw new Error(error);
      }
  
      return {
        status: "ok",
        data,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },
};


  async function getUserById(userId) {
    const { data: user, error } = await supabase
      .from("user") // The name of your table in the database
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      return null;
    }

    return { user, error };
  };

async function getSurveiById(Id) {
  const { data: survei, error } = await supabase
    .from("survei")
    .select("*")
    .eq("id", Id)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return { survei, error };
}

async function getSurveiByOrderiD(orderId) {
  const { data: survei, error } = await supabase
    .from("survei")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return { survei, error };
}

async function updateSurveiStatus(surveiId, status_payment, status_survei) {
  const { error } = await supabase
    .from("survei")
    .update({ status_payment: status_payment, status: status_survei })
    .eq("order_id", surveiId);

  return { error };
}

async function getKategoriData(kategoriIds) {
  const { data: kategori, error } = await supabase
    .from("kategori_filter")
    .select("*")
    .in("id", kategoriIds);

  if (error) {
    console.error("Error fetching kategori:", error);
    return null;
  }
  return { kategori, error };
}

async function getSurveiByForm(formData) {
  const { data: survei, error } = await supabase
    .from("survei")
    .select("*")
    .eq("id_form", formData)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return { survei, error };
}

async function getSurveiAll(filter) {
  let query;

  if (filter) {
    // Query with filter
    const { data: res, error } = await supabase
      .from("kategori_survei")
      .select(`*, survei(*, user(nama)), kategori_filter(kategori)`)
      .order("created_at", { ascending: false })
      .in("id_filter", filter);

    console.log(res);
    if (error) {
      throw new Error(`Error fetching survei with filter: ${error.message}`);
    }

    if (res && res.length > 0) {
      query = res.map((item) => ({
        id_survei: item.id_survei,
        created_at: item.created_at,
        judul: item.survei.judul,
        saldo: item.survei.saldo,
        hadiah: item.survei.hadiah,
        user: item.survei.user,
        kategori: item.kategori_filter.kategori,
        link_form: item.survei.link_form,
        link_meta: item.survei.link_meta,
        status_payment: item.survei.status_payment,
      }));
    } else {
      query = [];
    }
  } else {
    // Query without filter
    const { data, error } = await supabase
      .from("survei")
      .select(`*, user(id, nama), kategori_survei(*,kategori_filter(*))`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching survei: ${error.message}`);
    }

    query = data;
  }

  return query;
}

async function getRiwayatSurvei(id_user) {
  const { data, error } = await supabase
    .from("riwayat_survei")
    .select(`*, survei(*)`)
    .eq("id_user", id_user)
    .order('created_at', {ascending:false});
  if (error) {
    console.error("Error fetching survei with ", error);
    return null;
  }

  return { data, error };
}

async function getRiwayatSurveiMy(id_user) {
  const { data, error } = await supabase
    .from("survei")
    .select(`*`)
    .eq("id_pembuat", id_user)
    .order('created_at', {ascending:false});
    
  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return {data, error}; // Only return data, no need to return { data, error }
}

module.exports = survei;
