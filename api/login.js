// Verifica il gettone di Google e apre la sessione solo per gli account del dominio della scuola
const A = require('./_auth');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return A.json(res, 405, { error: 'metodo non ammesso' });
  if (!A.enabled()) return A.json(res, 503, { error: 'accesso non configurato' });
  if (!A.sameOrigin(req)) return A.json(res, 403, { error: 'origine non ammessa' });
  let body; try { body = JSON.parse(await A.readBody(req, 20000)); } catch (e) { return A.json(res, 400, { error: 'richiesta non valida' }); }
  const cred = body && body.credential;
  if (!cred || typeof cred !== 'string' || cred.length > 5000) return A.json(res, 400, { error: 'gettone mancante' });
  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    if (!r.ok) return A.json(res, 401, { error: 'gettone Google non valido' });
    info = await r.json();
  } catch (e) { return A.json(res, 502, { error: 'Google non risponde' }); }
  const dom = String(process.env.AUTH_DOMAIN || '').toLowerCase().replace(/^@/, '');
  const email = String(info.email || '').toLowerCase();
  const okAud = info.aud === process.env.GOOGLE_CLIENT_ID;
  const okIss = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  const okMail = (info.email_verified === true || info.email_verified === 'true') && (String(info.hd || '').toLowerCase() === dom || email.endsWith('@' + dom));
  const okExp = Number(info.exp || 0) > Date.now() / 1000;
  if (!okAud || !okIss || !okExp) return A.json(res, 401, { error: 'gettone non valido' });
  if (!okMail) return A.json(res, 403, { error: "Serve l'account della scuola (@" + dom + ')' });
  const days = 30, exp = Math.floor(Date.now() / 1000) + days * 86400;
  A.setCookie(res, A.sign({ email, name: String(info.name || '').slice(0, 80), exp }), days * 86400);
  A.json(res, 200, { ok: true, email });
};
