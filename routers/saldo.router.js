const express = require("express");
const router = express.Router();
const controller = require("../controllers/saldo.controller");

router.post("/", controller.getSaldo)
router.post("/add", controller.addTransaksi)
router.post("/transaksi", controller.getRiwayatTransaksi)


module.exports = router