const express = require("express");
const router = express.Router();
const controller = require("../controllers/survei.controller");


router.post("/create", controller.create);
router.post("/get-hasil", controller.getResponses);
router.post("/midtrans-callback", controller.callbackPayment);
router.get("/get-all", controller.getDataAll);
router.get("/get-riwayat", controller.getRiwayatSurvei);
router.get("/survei-data", controller.getDataById);

module.exports = router;
