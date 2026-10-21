const A = require('./_auth');
module.exports = (req, res) => {
  if (!A.enabled()) return A.json(res, 200, { on: false });
  const u = A.user(req);
  if (!u) return A.json(res, 401, { on: true, error: 'non autenticato' });
  A.json(res, 200, { on: true, email: u.email, name: u.name || '' });
};
