// Spostamenti fatti nella modalità God (oggetti, edifici, lampioni, parcheggi, sentieri, zone delle feste):
// li manda chi è autorizzato e finiscono in schede.json (impostazioni.pos), così valgono per tutti
const A = require('./_auth');
const REPO = () => process.env.GITHUB_REPO || 'AletreKing/Tour-in-Ciociaria1';
async function gh(path, opt) {
  opt = opt || {};
  return fetch('https://api.github.com/repos/' + REPO() + path, Object.assign({}, opt, {
    headers: Object.assign({ Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ciociaria-da-scoprire' }, opt.headers || {})
  }));
}
async function getJson(path) {
  const r = await gh('/contents/' + path + '?ref=main');
  if (r.status === 404) return { sha: null, data: null };
  if (!r.ok) throw new Error('GitHub risponde ' + r.status);
  const j = await r.json();
  return { sha: j.sha, data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) };
}
async function putJson(path, data, sha, msg) {
  const body = { message: msg, content: Buffer.from(JSON.stringify(data, null, 1)).toString('base64'), branch: 'main' };
  if (sha) body.sha = sha;
  const r = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); const e = new Error('GitHub risponde ' + r.status); e.status = r.status; e.t = t; throw e; }
}
const KEY = /^[^\u0000-\u001f<>]{1,300}$/;
function clean(v, depth) {
  if (depth > 4) return null;
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : 0;
  if (typeof v === 'string') return v.slice(0, 200);
  if (Array.isArray(v)) return v.slice(0, 2000).map(x => clean(x, depth + 1));
  if (typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 40).forEach(k => { if (/^\w{1,20}$/.test(k)) o[k] = clean(v[k], depth + 1); }); return o; }
  return null;
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return A.json(res, 405, { error: 'metodo non ammesso' });
  if (!A.enabled() || !process.env.GITHUB_TOKEN) return A.json(res, 503, { error: 'pubblicazione non configurata sul server' });
  if (!A.sameOrigin(req)) return A.json(res, 403, { error: 'origine non ammessa' });
  const u = A.user(req); if (!u) return A.json(res, 401, { error: "Entra con l'account della scuola" });
  let b; try { b = JSON.parse(await A.readBody(req, 3000000)); } catch (e) { return A.json(res, 413, { error: 'richiesta troppo grande o non valida' }); }
  const pos = b && b.posizioni;
  if (!pos || typeof pos !== 'object') return A.json(res, 400, { error: 'nessuna modifica da pubblicare' });
  try {
    // chi può pubblicare: chi è entrato con l'account della scuola e conosce la parola segreta della modalità God
    const crypto = require('crypto'), want = String(process.env.PUBLISH_HASH || '843c8bcf9a1ce5dd547159c829964c4f1eb463e5933d4b8e3aeb55abc692df8c');
    const got = crypto.createHash('sha256').update('cds|' + String(b.pw || '').trim().toLowerCase()).digest('hex');
    if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return A.json(res, 403, { error: 'parola segreta mancante o sbagliata: esci dalla modalità God e rientra' });
    // e, in più, solo i responsabili: gli indirizzi in EDITORI (variabile del server) o in editori.json; se l'elenco è vuoto, il primo che pubblica diventa responsabile
    const env = String(process.env.EDITORI || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
    const ed = await getJson('editori.json'), list = (ed.data && ed.data.editori) || [];
    const me = u.email.toLowerCase(), allowed = env.concat(list.map(x => String(x).toLowerCase()));
    if (allowed.length && allowed.indexOf(me) < 0) return A.json(res, 403, { error: 'Il tuo account (' + u.email + ') non è tra i responsabili delle modifiche. Chiedi di essere aggiunto.' });
    let first = false;
    if (!allowed.length) { await putJson('editori.json', { editori: [me] }, ed.sha, 'Responsabile delle modifiche: ' + me); first = true; }
    for (let tent = 0; tent < 3; tent++) {
      const sc = await getJson('schede.json'), data = sc.data || { versione: 1, schede: {} };
      data.impostazioni = data.impostazioni || {}; const P = data.impostazioni.pos = data.impostazioni.pos || {};
      let n = 0;
      Object.keys(pos).slice(0, 5000).forEach(k => { if (!KEY.test(k)) return; const v = pos[k]; if (v === null || v === undefined) { delete P[k]; n++; return; } P[k] = clean(v, 0); if (data.schede && data.schede[k] && typeof data.schede[k] === 'object') data.schede[k].pos3d = P[k].del ? null : P[k]; n++; });
      data.aggiornato = new Date().toISOString();
      try { await putJson('schede.json', data, sc.sha, 'Modifiche dalla modalità God: ' + n + ' elementi, di ' + me); return A.json(res, 200, { ok: true, n, pos: P, first }); }
      catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }   // qualcuno ha pubblicato nello stesso istante: si riprova
    }
    return A.json(res, 409, { error: 'conflitto con un’altra pubblicazione: riprova' });
  } catch (e) { return A.json(res, 502, { error: String(e.message || e) }); }
};
