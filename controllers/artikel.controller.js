const model = require("../models/artikel.model");
const { success, error } = require("../constraint/response");

const artikel = {
  getAllArtikel: async (req, res) => {
    model.getAllArtikel(req.body).then((result) => {
        if (result.status == "ok") {
            success(res, result.data);
          } else {
            error(res, result.msg);
          }
    })
  }
};

module.exports = artikel;
