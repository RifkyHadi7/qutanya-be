const supabase = require("../constraint/database")

const saldo = {
    getSaldo: async(data) => {
        const email = data
        const {data, error} = await supabase
            .from("user")
            .select("saldo")
            .eq("email", email)
        if (error) {
            return { status: "err", msg: error.message };
        }
    
        return { status: "ok", data: data };
    },
    getRiwayatTransaksi: async(data) => {
        const email = data
        const {data : id_user, error: errorId }= await supabase
			.from("user")
			.select("id")
			.eq("email", email)
		if(errorId){
			return {status: "err", msg: errorId}
		}
		const iduser = id_user[0].id

        const {data : dataTransaksi, error: errorTransaksi} = await supabase
            .from("riwayat_transaksi")
            .select("nominal, pemasukan, keterangan")
            .eq("id_user", iduser)
        if(errorTransaksi){
            return {status: "err", msg: errorTransaksi}
        }

        return { status: "ok", data: dataTransaksi };
    },
    addTransaksi: async(data) => {
        const {email, nominal, pemasukan, keterangan} = data;
        
        // Fetch user ID
        const {data: id_user, error: errorId} = await supabase
            .from("user")
            .select("id, saldo")
            .eq("email", email);
        if (errorId) {
            return {status: "err", msg: errorId};
        }
        const iduser = id_user[0].id;
        let currentSaldo = id_user[0].saldo;

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