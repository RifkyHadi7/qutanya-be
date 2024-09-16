const supabase = require("../constraint/database")

const saldo = {
    getSaldo: async(data) => {
        const id_user = data.id_user
        const {data: saldo, error} = await supabase
            .from("user")
            .select("saldo")
            .eq("id", id_user)
        if (error) {
            return { status: "err", msg: error.message };
        }
        return { status: "ok", data: saldo };
    },
    getRiwayatTransaksi: async(data) => {
        const id_user = data.id_user

        const {data : dataTransaksi, error: errorTransaksi} = await supabase
            .from("riwayat_transaksi")
            .select("nominal, pemasukan, keterangan")
            .eq("id_user", id_user)
        if(errorTransaksi){
            return {status: "err", msg: errorTransaksi}
        }

        return { status: "ok", data: dataTransaksi };
    },
    addTransaksi: async(data) => {
        const {id_user, nominal, pemasukan, keterangan} = data;
        
        // Fetch user ID
        const {data: saldo, error: errorSaldo} = await supabase
            .from("user")
            .select("saldo")
            .eq("id", id_user);
        if (errorSaldo) {
            return {status: "err", msg: errorSaldo};
        }
        let currentSaldo = saldo.data[0].saldo;

        // Adjust saldo based on pemasukan
        if (pemasukan) {
            currentSaldo += nominal;
        } else {
            currentSaldo -= nominal;
        }

        // Update saldo in biodata
        const {error: errorUpdateSaldo} = await supabase
            .from("biodata")
            .update({saldo: currentSaldo})
            .eq("id_user", iduser);
        if (errorUpdateSaldo) {
            return {status: "err", msg: errorUpdateSaldo};
        }

        // Insert transaction into riwayat_transaksi
        const {error: errorInsertTransaksi} = await supabase
            .from("riwayat_transaksi")
            .insert([{id_user: iduser, nominal: nominal, pemasukan: pemasukan, keterangan: keterangan}]);
        if (errorInsertTransaksi) {
            return {status: "err", msg: errorInsertTransaksi};
        }

        return {status: "ok", msg: "Transaksi berhasil ditambahkan dan saldo diperbarui"};
    },
}

module.exports = saldo