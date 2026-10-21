const A = require('./_auth');
module.exports = (req, res) => { A.setCookie(res, '', 0); res.statusCode = 302; res.setHeader('Location', '/login.html'); res.end(); };
