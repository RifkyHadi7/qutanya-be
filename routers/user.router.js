const express = require("express");
const router = express.Router();
const controller = require("../controllers/user.controller");
const multer = require("multer");
const upload = multer({
    limits: {
        fileSize: 1024 * 1024 * 5,
    },
});

router.post("/", upload.single("foto_profil"), controller.addUser);
router.post("/login", controller.login);

module.exports = router;
