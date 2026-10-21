// Sessione firmata: chi è entrato con l'account della scuola
const crypto = require('crypto');
const NAME = 'cds_sess';
function secret() { return process.env.SESSION_SECRET || ''; }
function enabled() { return !!(process.env.GOOGLE_CLIENT_ID && process.env.AUTH_DOMAIN && secret()); }
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function sign(obj) {
  const body = b64u(JSON.stringify(obj));
  const mac = b64u(crypto.createHmac('sha256', secret()).update(body).digest());
  return body + '.' + mac;
}
function verify(tok) {
  if (!tok || typeof tok !== 'string' || tok.indexOf('.') < 0 || !secret()) return null;
  const [body, mac] = tok.split('.');
  const want = b64u(crypto.createHmac('sha256', secret()).update(body).digest());
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let o; try { o = JSON.parse(unb64u(body).toString('utf8')); } catch (e) { return null; }
  if (!o.exp || o.exp < Date.now() / 1000) return null;
  return o;
}
function cookies(req) {
  const out = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function user(req) { return verify(cookies(req)[NAME]); }
function setCookie(res, val, maxAge) {
  res.setHeader('Set-Cookie', NAME + '=' + encodeURIComponent(val) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge);
}
function json(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
function readBody(req, limit) {
  return new Promise((ok, ko) => {
    if (req.body !== undefined && req.body !== null) { ok(typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)); return; }
    let n = 0; const ch = [];
    req.on('data', c => { n += c.length; if (n > limit) { ko(new Error('troppo grande')); req.destroy(); } else ch.push(c); });
    req.on('end', () => ok(Buffer.concat(ch).toString('utf8'))); req.on('error', ko);
  });
}
// controlli comuni per le richieste che modificano qualcosa: stessa origine
function sameOrigin(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}
module.exports = { NAME, enabled, sign, verify, user, setCookie, json, readBody, sameOrigin, b64u };
