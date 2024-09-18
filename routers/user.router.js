const express = require("express");
const router = express.Router();
const controller = require("../controllers/user.controller");
const controllerForm = require("../controllers/survei.controller");
const multer = require("multer");
const { existingEmail, lupaPassword } = require("../models/user.model");
const upload = multer({
    limits: {
        fileSize: 1024 * 1024 * 5,
    },
});

router.post("/", upload.single("foto_profil"), controller.addUser);
router.post("/login", controller.login);
router.post("/update", upload.single("foto_profil"), controller.updateUser)
router.post("/newpassword", controller.updatePassword)
router.post("/email", controller.existingEmail)
router.post("/otp", controller.lupaPassword)
router.post("/lupapassword", controller.changePassword)


module.exports = router;
