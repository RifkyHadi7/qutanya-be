const model = require("../models/saldo.model");
const { success, error } = require("../constraint/response");

const saldo = {
  addTransaksi: async (req, res) => {
    model.addTransaksi(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
  getRiwayatTransaksi: async (req, res) => {
    model.getRiwayatTransaksiTransaksi(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
  getSaldo: async (req, res) => {
    model.getSaldo(req.body).then((result) => {
        if (result.status == "ok") {
            success(res, result.data);
          } else {
            error(res, result.msg);
          }
    })
  }
};

module.exports = saldo;
