const express = require("express");
const router = express.Router();
const controller = require("../controllers/artikel.controller");

router.get("/", controller.getAllArtikel)

module.exports = router

