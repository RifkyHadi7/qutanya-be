const express = require("express");
const router = express.Router();
const controller = require("../controllers/survei.controller");


router.post("/create", controller.create);
router.post("/get-hasil", controller.getResponses);
router.post("/midtrans-callback", controller.callbackPayment);

module.exports = router;
