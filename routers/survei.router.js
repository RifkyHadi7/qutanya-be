const express = require("express");
const router = express.Router();
const controller = require("../controllers/survei.controller");

router.post("/create", controller.create);
router.post("/get-hasil", controller.getResponses);
router.post("/get-hasil-survei", controller.getDataHasil);
router.post("/midtrans-callback", controller.callbackPayment);
router.post("/get-all", controller.getDataAll);
router.post("/get-riwayat", controller.getRiwayatSurvei);
router.post("/get-riwayat-my", controller.getRiwayatSurveiSaya);
router.post("/survei-data", controller.getDataById);
router.post("/claim-reward", controller.claimReward);
router.post("/riwayat-add", controller.insertRiwayatSurvei);
router.get("/list-survei", controller.getDataList);

module.exports = router;