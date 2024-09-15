// authClient.js
const { OAuth2 } = require('googleapis').auth;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const getAuthorizationUrl = () => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/forms.body.readonly', "https://www.googleapis.com/auth/forms.responses.readonly"],
    });
};

const getAccessTokenFromCode = async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
};

module.exports = { oauth2Client, getAuthorizationUrl, getAccessTokenFromCode };
