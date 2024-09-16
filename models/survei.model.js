"use strict";
const path = require("path");
const { google } = require("googleapis");
const { authenticate } = require("@google-cloud/local-auth");
const supabase = require("../constraint/database");
const midtransClient = require("midtrans-client");
const saldo = require("./saldo.model");

const survei = {
  create: async ({
    form_meta_req,
    form_res,
    harga,
    title,
    kategori,
    id_user_create,
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

      // Mengautentikasi pengguna menggunakan OAuth 2.0
      const auth = await authenticate({
        keyfilePath: path.join(__dirname, "../credentials.json"),
        scopes: ["https://www.googleapis.com/auth/forms.body.readonly"],
      });

      // Buat instance Forms API dengan autentikasi yang sudah dilakukan
      const forms = google.forms({ version: "v1", auth });

      const id_form = form_meta_req.match(
        /https:\/\/docs\.google\.com\/forms\/d\/([^\/]+)\/edit/
      );

      // id_share_link
      const share_id_form = form_res.match(
        /https:\/\/docs\.google\.com\/forms\/d\/e\/([^\/]+)\/viewform/
      )[1];

      // Ambil metadata form
      const formMeta = await forms.forms.get({
        formId: id_form[1],
      });

      // Mendapatkan semua pertanyaan dari form
      const items = formMeta.data.items;

      // Iterasi melalui setiap item untuk menghitung jumlah tipe pertanyaan
      const totalQuestions = items
        .map((item) => item?.questionItem?.question)
        .filter((question) => question !== undefined).length;

      const hadiah = harga / totalQuestions;

      // midtrans

      let snap = new midtransClient.Snap({
        isProduction: false,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
      });

      // get user
      const user = await getUserById(id_user_create);
      console.log(user);
      // Persiapkan parameter transaksi
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

      // Buat transaksi dan dapatkan link pembayaran
      let midtransLink;
      let transaction = await snap.createTransaction(parameter);
      midtransLink = transaction.redirect_url;
      if (!midtransLink || midtransLink == undefined) {
        console.error("Midtrans Error:", e);
        // return { status: "err", msg: e.message };
        throw new Error(e.message);
      }

      console.log("aman");

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
      console.log(data);
      if (error) {
        // return { status: "err", msg: error };
        throw new Error(error.message);
      }
      console.log("aman2");
      console.log(data);

      const id_survei = data[0].id;

      console.log(id_survei);
      for (const value of kategori) {
        const { data: kategori_survei, error: error_kategori } = await supabase
          .from("kategori_survei")
          .insert([
            {
              id_survei: id_survei,
              id_filter: value,
            },
          ]);
        if (error_kategori) {
          console.error(
            "Error inserting into kategori_survei:",
            error_kategori
          );
          throw new Error(error_kategori.message);
        }
      }
      console.log("aman44");

      const { error_riwayat } = await supabase.from("riwayat_survei").insert([
        {
          id_user: id_survei,
          id_survei: id_survei,
        },
      ]);

      if (error_riwayat) {
        // return { status: "err", msg: error_riwayat };
        throw new Error(error_riwayat);
      }

      return {
        status: "ok",
        data: {
          hadiah,
          harga,
          midtransLink,
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

  callbackPayment: async ({ notification }) => {
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
        const { data, error } = await getSurveiAll(filter);

        return {
          status: "ok",
          data,
        };
      }
      const filterArray = filter.split(",").map(Number);

      const { data, error } = await getSurveiAll(filterArray);

      if (error) {
        throw new Error(error);
      }

      return {
        status: "ok",
        data: {
          data,
        },
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
        data: {
          data,
        },
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
        data: {
          data,
        },
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
}

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
    // Query dengan filter
    query = supabase
      .from("kategori_survei")
      .select(`*, survei(*,user(nama))`)
      .order('created_at', {ascending:false})
      .in("id_filter", filter);
  } else {
    // Query tanpa filter
    query = supabase.from("survei").select(`*, user(id,nama)`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching survei: ${error.message}`);
  }
  
  // Jika ada data, lakukan pengurutan berdasarkan survei.created_at setelah data diambil


  return { data, error };
}

async function getRiwayatSurvei(id, id_user) {
  const { data, error } = await supabase
    .from("riwayat_survei")
    .select(`*, survei(*)`)
    .in("id_user", id_user);

  if (error) {
    console.error("Error fetching survei with filter:", error);
    return null;
  }

  return { data, error };
}

module.exports = survei;
