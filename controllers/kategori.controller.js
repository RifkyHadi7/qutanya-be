const model = require("../models/kategori.model");
const { success, error } = require("../constraint/response");

const kategori = {
  getAllKategori: async (req, res) => {
    model.getAllKategori(req.body).then((result) => {
        if (result.status == "ok") {
            success(res, result.data);
          } else {
            error(res, result.msg);
          }
    })
  },
};

module.exports = kategori;
