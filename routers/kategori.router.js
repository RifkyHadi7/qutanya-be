const express = require("express");
const router = express.Router();
const controller = require("../controllers/kategori.controller");

router.get("/", controller.getAllKategori)

module.exports = router

