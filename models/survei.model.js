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
  getResponses: async ({ form_meta_req, accessToken }) => {
    // Autentikasi dengan Google Forms API
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );

    // Mengautentikasi pengguna menggunakan OAuth 2.0
    oauth2Client.setCredentials({ access_token: accessToken });

    const forms = google.forms({ version: "v1", auth: oauth2Client });

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
        /https:\/\/docs\.google\.com\/forms(\/u\/\d+)?\/d\/e\/.*\/formResponse/;
      // https://docs.google.com/forms/u/3/d/e/1FAIpQLSffwLgRukPwADbkIuzBec4lkcsb6tK-7YquS_eOEGjKiOnCVQ/formResponse?pli=1
      // https://docs.google.com/forms/u/3/d/e/1FAIpQLSeh6mG4VT9j2EdyX_TiMEnyycKJeWdNgpmawH5gVlsx_Sa6cA/formResponse?pli=1
      // Optionally, check for a response link (if needed)
      if (!responseLinkPattern.test(link_form)) {
        throw new Error(
          "Please provide the correct response link (after form submission)."
        );
      }

      const id_form = link_form.match(
        /https:\/\/docs\.google\.com\/forms(\/u\/\d+)?\/d\/e\/([^\/]+)\/formResponse/
      );
      
      const { dataForm, error_form } = await getSurveiByForm(id_form[2]);

      if (!dataForm) {
        throw new Error(
          "Please provide the correct link survei form from Qutanya.id"
        );
      }

      if (dataForm.saldo < dataForm.hadiah) {
        const { survei_data, error_survei } = getAndUpdateFormStatus(
          dataForm.id
        );
      }

      const { data, error_get_user } = await getUserById(id_user_create);

      const biodata = data.biodata[0];
      if (error_get_user) {
        throw new Error(error_get_user);
      }

      const isClaimed = await checkClaimExists(data.email, id_form[2]);

      if (isClaimed) {
        throw new Error("Sorry you have claimed");
      }

      let keterangan = "Add reward survei " + dataForm.judul;

      const { status: transaksiData, msg: error_transaksi } =
        await saldo.addTransaksi({
          id_user: id_user_create,
          nominal: Math.ceil(dataForm.hadiah),
          pemasukan: true,
          keterangan: keterangan,
        });
      if (transaksiData != "ok") {
        throw new Error(error_transaksi);
      }

      const { error_claim } = await supabase.from("claim").insert([
        {
          email: data.email,
          nama: data.nama,
          tanggal_lahir: biodata.tanggal_lahir,
          gender: biodata.gender,
          pekerjaan: biodata.pekerjaan,
          judul_survei: dataForm.judul,
          provinsi: biodata.provinsi,
          kota: biodata.kota,
          id_form: dataForm.id_form,
        },
      ]);

      if (error_claim) {
        throw new Error(error_claim);
      }

      const { error_update_saldo } = await getAndUpdateFormSaldo(dataForm.id, dataForm.hadiah );

      if (error_update_saldo) {
        throw new Error(error_update_saldo);
      }

      const updateSaldo = data.saldo + dataForm.hadiah;
      return {
        status: "ok",
        saldo: updateSaldo,
        message: transaksiData.msg,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  getDataHasil: async ({ id_form }) => {
    try {
      const { data, error } = await getCLaimByForm(id_form);

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

  insertRiwayatSurvei: async ({ id_user, id_survei }) => {
    try {
      // Cek apakah data sudah ada
      const { data: existingData, error: selectError } = await supabase
        .from("riwayat_survei")
        .select("*")
        .eq("id_survei", id_survei)
        .eq("id_user", id_user);

      if (selectError) {
        throw new Error(selectError.message);
      }

      // Jika data sudah ada, tidak perlu insert
      if (existingData && existingData.length > 0) {
        throw new Error(
          "Data already exists. You cannot participate in this survey again."
        );
      }

      // Jika data tidak ada, lakukan insert
      const { data, error } = await supabase.from("riwayat_survei").insert([
        {
          id_user: parseInt(id_user),
          id_survei: parseInt(id_survei),
        },
      ]);

      if (error) {
        throw new Error(error.message);
      }

      return {
        status: "ok",
        data,
      };
    } catch (error) {
      return { status: "err", msg: error.message };
    }
  },

  callbackPayment: async (notification) => {
    if (!notification || typeof notification !== "object") {
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
      console.log(transactionSurvei);
      if (error || !transactionSurvei) {
        return { status: "err", msg: error };
        // return res.status(404).json({ message: "Survey not found." });
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

  getDataList: async () => {
    try {
      const data = await getSurveiList();

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
  const { data: data, error } = await supabase
    .from("user") // The name of your table in the database
    .select("*, biodata(*)")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }

  return { data, error };
}

async function getSurveiById(Id) {
  const { data, error } = await supabase
    .from("survei")
    .select("*")
    .eq("id", Id)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return { data, error };
}

async function getSurveiByOrderiD(orderId) {
  const { data, error } = await supabase
    .from("survei")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
  }

  return { data, error };
}

async function updateSurveiStatus(surveiId, status_payment, status_survei) {
  const { error } = await supabase
    .from("survei")
    .update({ status_payment: status_payment, status: status_survei })
    .eq("order_id", surveiId);

  return { error };
}

async function getAndUpdateFormSaldo(surveiId, saldo) {
  // First, retrieve the existing data
  const { data: surveiData, error: fetchError } = await supabase
    .from("survei")
    .select("*")
    .eq("id", surveiId)
    .single(); // Assuming order_id is unique and returns one row
  console.log(surveiData);
  if (fetchError) {
    console.error("Error fetching survei data:", fetchError);
    return { error: fetchError };
  }

  const currentSaldo = surveiData.saldo - saldo;
  // Now, update the necessary fields
  const { error: updateError } = await supabase
    .from("survei")
    .update({
      saldo: currentSaldo,
    })
    .eq("id", surveiId);

  if (updateError) {
    console.error("Error updating survei status:", updateError);
    return { error: updateError };
  }

  // Return the updated survei data if needed
  return { data: surveiData, message: "Update successful" };
}

async function getAndUpdateFormStatus(surveiId) {
  // First, retrieve the existing data
  const { data: surveiData, error: fetchError } = await supabase
    .from("survei")
    .select("*")
    .eq("id", surveiId)
    .single(); // Assuming order_id is unique and returns one row

  if (fetchError) {
    console.error("Error fetching survei data:", fetchError);
    return { error: fetchError };
  }

  // Now, update the necessary fields
  const { error: updateError } = await supabase
    .from("survei")
    .update({
      status: "close",
    })
    .eq("id", surveiId);

  if (updateError) {
    console.error("Error updating survei status:", updateError);
    return { error: updateError };
  }

  // Return the updated survei data if needed
  return { data: surveiData, message: "Update successful" };
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
  const { data: dataForm, error } = await supabase
    .from("survei")
    .select("*")
    .eq("id_form", formData)
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching survei:", error);
    console.log(error);
    return {dataForm, error};
  }

  return { dataForm, error };
}

async function getCLaimByForm(formData) {
  const { data: data, error } = await supabase
    .from("claim")
    .select("*")
    .eq("id_form", formData)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching klaim", error);
    return null;
  }

  return { data, error };
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
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Error fetching survei: ${error.message}`);
    }

    query = data;
  }

  return query;
}

async function getSurveiList() {
  const { data, error } = await supabase
    .from("survei")
    .select(`*, user(id, nama), kategori_survei(*,kategori_filter(*))`)
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error fetching survei: ${error.message}`);
  }

  return { data, error };
}

async function getRiwayatSurvei(id_user) {
  const { data: data, error } = await supabase
    .from("riwayat_survei")
    .select(`*, survei(*)`)
    .eq("id_user", id_user)
    .order("created_at", { ascending: false });
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching survei:", error);
    return null;
  }

  return { data, error }; // Only return data, no need to return { data, error }
}

async function checkClaimExists(email, id_form) {
  const { data: data, error } = await supabase
    .from("claim") // Replace 'users' with your table name
    .select("*") // Select all fields (or specific ones if needed)
    .eq("email", email) // Check for email equality
    .eq("id_form", id_form); // Check for id equality

  if (error) {
    console.error("Error fetching user:", error);
    return false; // Handle error appropriately
  }

  // Check if any rows are returned
  if (data && data.length > 0) {
    console.log("User exists:", data);
    return true;
  } else {
    console.log("User does not exist.");
    return false;
  }
}

module.exports = survei;
