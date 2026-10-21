// Proposte dei ragazzi (foto, video, testo, modello 3D): finiscono nel ramo «proposte» del repository, in attesa che un docente le approvi
const A = require('./_auth');
const crypto = require('crypto');
const REPO = () => process.env.GITHUB_REPO || 'AletreKing/Tour-in-Ciociaria1';
const BR = 'proposte';
async function gh(path, opt) {
  opt = opt || {};
  const r = await fetch('https://api.github.com/repos/' + REPO() + path, Object.assign({}, opt, {
    headers: Object.assign({ Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ciociaria-da-scoprire' }, opt.headers || {})
  }));
  return r;
}
async function ensureBranch() {
  let r = await gh('/git/ref/heads/' + BR);
  if (r.ok) return;
  r = await gh('/git/ref/heads/main'); if (!r.ok) throw new Error('repository non raggiungibile (' + r.status + ')');
  const sha = (await r.json()).object.sha;
  r = await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + BR, sha }) });
  if (!r.ok && r.status !== 422) throw new Error('non riesco a creare il ramo delle proposte (' + r.status + ')');
}
async function put(path, b64, msg) {
  const r = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64, branch: BR }) });
  if (!r.ok) throw new Error('GitHub risponde ' + r.status);
}
function idTok(id, email) { return crypto.createHmac('sha256', process.env.SESSION_SECRET).update('prop|' + id + '|' + email).digest('hex').slice(0, 32); }
const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
module.exports = async (req, res) => {
  if (req.method !== 'POST') return A.json(res, 405, { error: 'metodo non ammesso' });
  if (!A.enabled() || !process.env.GITHUB_TOKEN) return A.json(res, 503, { error: 'invio delle proposte non ancora attivo' });
  if (!A.sameOrigin(req)) return A.json(res, 403, { error: 'origine non ammessa' });
  const u = A.user(req); if (!u) return A.json(res, 401, { error: "Entra con l'account della scuola" });
  let b; try { b = JSON.parse(await A.readBody(req, 4400000)); } catch (e) { return A.json(res, 413, { error: 'file troppo grande o richiesta non valida' }); }
  try {
    if (b.op === 'new') {
      const luogo = s(b.luogo, 200); if (!luogo) return A.json(res, 400, { error: 'manca il luogo' });
      const d = new Date(), id = d.toISOString().slice(0, 19).replace(/[-:T]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
      const meta = { id, luogo, nomeLuogo: s(b.nomeLuogo, 200), autore: s(b.autore || u.name, 80), classe: s(b.classe, 20), email: u.email, titolo: s(b.titolo, 160), testo: s(b.testo, 6000),
        video: s(b.video, 400), file: [], quando: d.toISOString() };
      if (meta.video && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)\//i.test(meta.video)) return A.json(res, 400, { error: 'Il video deve essere un link di YouTube o Vimeo' });
      await ensureBranch();
      await put('proposte/' + id + '/meta.json', Buffer.from(JSON.stringify(meta, null, 1)).toString('base64'), 'Proposta per «' + (meta.nomeLuogo || luogo) + '» di ' + meta.autore);
      return A.json(res, 200, { id, tok: idTok(id, u.email) });
    }
    if (b.op === 'file') {
      const id = s(b.id, 40), name = s(b.name, 40);
      if (!/^\d{14}-[0-9a-f]{6}$/.test(id) || b.tok !== idTok(id, u.email)) return A.json(res, 403, { error: 'proposta non riconosciuta' });
      if (!/^(foto-[1-6]\.jpg|modello\.glb)$/.test(name)) return A.json(res, 400, { error: 'nome di file non ammesso' });
      const raw = Buffer.from(String(b.b64 || ''), 'base64');
      const max = name === 'modello.glb' ? 3200000 : 1600000;
      if (!raw.length || raw.length > max) return A.json(res, 413, { error: name === 'modello.glb' ? 'Il modello deve pesare al massimo 3 MB' : 'Foto troppo grande' });
      if (name.endsWith('.jpg') && !(raw[0] === 0xff && raw[1] === 0xd8)) return A.json(res, 400, { error: 'La foto non è un JPEG' });
      if (name === 'modello.glb' && raw.slice(0, 4).toString('latin1') !== 'glTF') return A.json(res, 400, { error: 'Il modello deve essere un file .glb' });
      await put('proposte/' + id + '/' + name, raw.toString('base64'), 'File ' + name + ' della proposta ' + id);
      return A.json(res, 200, { ok: true });
    }
    A.json(res, 400, { error: 'operazione sconosciuta' });
  } catch (e) { A.json(res, 502, { error: String(e && e.message || e) }); }
};
