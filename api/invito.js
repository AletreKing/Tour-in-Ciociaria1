// Link d'invito personale per un ospite: apre la sessione senza passare da Google (vale 30 giorni)
const crypto = require('crypto');
const A = require('./_auth');
const OSPITI = require('./_ospiti');
module.exports = (req, res) => {
  if (req.method !== 'GET') return A.json(res, 405, { error: 'metodo non ammesso' });
  if (!A.enabled()) { res.statusCode = 302; res.setHeader('Location', '/guida.html'); return res.end(); }
  const u = new URL(req.url, 'http://x'), t = String(u.searchParams.get('t') || '');
  const h = t.length >= 16 && t.length <= 200 ? crypto.createHash('sha256').update(t).digest('hex') : '';
  const o = h && OSPITI.find(x => x && x.invito && x.invito.length === h.length && crypto.timingSafeEqual(Buffer.from(x.invito), Buffer.from(h)));
  res.setHeader('Cache-Control', 'no-store');
  if (!o) { res.statusCode = 403; res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end('<!doctype html><meta charset="utf-8"><p style="font:16px system-ui;padding:24px">Questo invito non è valido o è stato ritirato. Chiedi un nuovo link al docente.</p>'); }
  const days = 30, exp = Math.floor(Date.now() / 1000) + days * 86400;
  A.setCookie(res, A.sign({ email: String(o.email || 'ospite').toLowerCase(), name: String(o.nome || 'Ospite').slice(0, 80), ospite: true, exp }), days * 86400);
  res.statusCode = 302; res.setHeader('Location', '/guida.html'); res.end();
};
