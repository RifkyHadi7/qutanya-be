// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { getAuthorizationUrl, getAccessTokenFromCode } = require('../models/auth.model');
const supabase = require("../constraint/database")

// Route untuk mendapatkan URL otorisasi
router.get('/auth/google', (req, res) => {
    const url = getAuthorizationUrl();
    res.redirect(url);
});

// Route callback untuk menangani kode otorisasi
router.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokens = await getAccessTokenFromCode(code);

        window.location.href(('https://qutanya-id.vercel.app/buatsurvey?token' + tokens));
    } catch (error) {
        res.status(500).send(error.message);
    }
});

module.exports = router;
