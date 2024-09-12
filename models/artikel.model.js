const supabase = require("../constraint/database")

const artikel = {
    getAllArtikel: async() => {
        const { data, error } = await supabase
            .from("artikel")
            .select("id, judul, deskripsi, cover");
    
        if (error) {
            return { status: "err", msg: error.message };
        }
    
        return { status: "ok", data: data };
    },
    getAllArtikelbyId: async(id) => {
        const { data, error } = await supabase
            .from("artikel")
            .select("id, judul, deskripsi, isi, cover")
            .eq("id", id)
    
        if (error) {
            return { status: "err", msg: error.message };
        }
    
        return { status: "ok", data: data };
    },
}

module.exports = artikel

