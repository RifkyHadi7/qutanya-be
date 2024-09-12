const express = require("express");
const router = express.Router();
const controller = require("../controllers/artikel.controller");

router.get("/", controller.addAllArtikel)

module.exports = router

