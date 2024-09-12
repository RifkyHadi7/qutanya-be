const supabase = require("../constraint/database")

const kategori = {
    getAllKategori: async() => {
        const { data, error } = await supabase
            .from("kategori_filter")
            .select("*");
    
        if (error) {
            return { status: "err", msg: error.message };
        }
    
        return { status: "ok", data: data };
    },
}

module.exports = kategori

