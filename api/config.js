const A = require('./_auth');
module.exports = (req, res) => A.json(res, 200, { on: A.enabled(), clientId: process.env.GOOGLE_CLIENT_ID || '', domain: process.env.AUTH_DOMAIN || '' });
