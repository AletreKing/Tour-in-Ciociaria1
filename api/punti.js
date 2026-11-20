// Punteggi e classifica: ogni giocatore (account della scuola) ha un nome casuale e un totale che resta da una partita all'altra.
// Tutto sta in classifica.json nel ramo «punteggi» del repository (che non viene pubblicato come sito).
// Il repository è pubblico: qui non finisce nessun indirizzo email, solo un'impronta (HMAC) dell'account e il nome casuale.
const A = require('./_auth');
const crypto = require('crypto');
const REPO = () => process.env.GITHUB_REPO || 'AletreKing/Tour-in-Ciociaria1';
const BR = 'punteggi', FILE = 'classifica.json';
async function gh(path, opt) {
  opt = opt || {};
  return fetch('https://api.github.com/repos/' + REPO() + path, Object.assign({}, opt, {
    headers: Object.assign({ Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ciociaria-da-scoprire' }, opt.headers || {})
  }));
}
async function ensureBranch() {
  let r = await gh('/git/ref/heads/' + BR);
  if (r.ok) return;
  r = await gh('/git/ref/heads/main'); if (!r.ok) throw new Error('repository non raggiungibile (' + r.status + ')');
  const sha = (await r.json()).object.sha;
  r = await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + BR, sha }) });
  if (!r.ok && r.status !== 422) throw new Error('non riesco a creare il ramo dei punteggi (' + r.status + ')');
}
function blank() { return { versione: 1, stagione: 1, gara: false, avvio: null, giocatori: {}, premi: {} }; }
let CACHE = null;   // { data, sha, t } — vale per qualche secondo dentro la stessa funzione
async function load(fresh) {
  if (!fresh && CACHE && Date.now() - CACHE.t < 15000) return CACHE;
  let r = await gh('/contents/' + FILE + '?ref=' + BR);
  if (r.status === 404) { await ensureBranch(); CACHE = { data: blank(), sha: null, t: Date.now() }; return CACHE; }
  if (!r.ok) throw new Error('GitHub risponde ' + r.status);
  const j = await r.json();
  let txt;
  if (j.content) txt = Buffer.from(j.content, 'base64').toString('utf8');
  else { const b = await gh('/git/blobs/' + j.sha); if (!b.ok) throw new Error('GitHub risponde ' + b.status); txt = Buffer.from((await b.json()).content, 'base64').toString('utf8'); }
  let data; try { data = JSON.parse(txt); } catch (e) { data = blank(); }
  data.giocatori = data.giocatori || {}; data.premi = data.premi || {};
  CACHE = { data, sha: j.sha, t: Date.now() }; return CACHE;
}
async function save(data, sha, msg) {
  const body = { message: msg, content: Buffer.from(JSON.stringify(data)).toString('base64'), branch: BR };
  if (sha) body.sha = sha;
  const r = await gh('/contents/' + FILE, { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) { const e = new Error('conflitto'); e.retry = true; throw e; }
  if (r.status === 404) { await ensureBranch(); const e = new Error('ramo creato'); e.retry = true; throw e; }
  if (!r.ok) throw new Error('GitHub risponde ' + r.status);
  const j = await r.json(); CACHE = { data, sha: j.content && j.content.sha, t: Date.now() };
}
// modifica con riprova: se due giocatori scrivono insieme, si rilegge e si riapplica
async function update(fn, msg) {
  let fresh = false;
  for (let k = 0; k < 7; k++) {
    const c = await load(fresh), data = JSON.parse(JSON.stringify(c.data));
    const out = fn(data); if (out === false) return { data: c.data, skipped: true };
    try { await save(data, c.sha, msg); return { data }; }
    catch (e) { if (!e.retry) throw e; fresh = true; await new Promise(ok => setTimeout(ok, 120 + Math.random() * 380 * (k + 1))); }
  }
  throw new Error('troppi giocatori insieme: riprovo più tardi');
}
const pidOf = A.pidOf;

// nomi da sala giochi: animale + aggettivo concordato + numero
const ANIM = [['Lupo', 'm'], ['Volpe', 'f'], ['Falco', 'm'], ['Aquila', 'f'], ['Cinghiale', 'm'], ['Istrice', 'm'], ['Lince', 'f'], ['Gufo', 'm'], ['Civetta', 'f'], ['Tasso', 'm'],
  ['Lepre', 'f'], ['Daino', 'm'], ['Cervo', 'm'], ['Poiana', 'f'], ['Rondine', 'f'], ['Grifone', 'm'], ['Orso', 'm'], ['Lontra', 'f'], ['Camoscio', 'm'], ['Picchio', 'm'],
  ['Gatto', 'm'], ['Pantera', 'f'], ['Tigre', 'f'], ['Puma', 'm'], ['Delfino', 'm'], ['Cometa', 'f'], ['Drago', 'm'], ['Fenice', 'f'], ['Gheppio', 'm'], ['Martora', 'f']];
const AGG = [['Rapido', 'Rapida'], ['Ardito', 'Ardita'], ['Curioso', 'Curiosa'], ['Fulmineo', 'Fulminea'], ['Selvaggio', 'Selvaggia'], ['Astuto', 'Astuta'], ['Audace', 'Audace'],
  ['Errante', 'Errante'], ['Ciociaro', 'Ciociara'], ['Notturno', 'Notturna'], ['Dorato', 'Dorata'], ['Silenzioso', 'Silenziosa'], ['Indomito', 'Indomita'], ['Veloce', 'Veloce'],
  ['Saggio', 'Saggia'], ['Gentile', 'Gentile'], ['Tenace', 'Tenace'], ['Ribelle', 'Ribelle'], ['Allegro', 'Allegra'], ['Vagabondo', 'Vagabonda'], ['Leggendario', 'Leggendaria'], ['Felice', 'Felice']];
function newName(taken) {
  for (let k = 0; k < 200; k++) {
    const a = ANIM[crypto.randomInt(ANIM.length)], g = AGG[crypto.randomInt(AGG.length)];
    const n = (a[0] + ' ' + (a[1] === 'm' ? g[0] : g[1]) + ' ' + (10 + crypto.randomInt(90))).toUpperCase();
    if (!taken[n]) return n;
  }
  return 'GIOCATORE ' + crypto.randomInt(100000, 999999);
}
function player(data, pid) {
  let p = data.giocatori[pid];
  if (!p) {
    const taken = {}; Object.keys(data.giocatori).forEach(k => { taken[data.giocatori[k].n] = 1; });
    p = data.giocatori[pid] = { n: newName(taken), p: 0, v: {}, d: {}, q: {}, t: {}, u: new Date().toISOString() };
  }
  p.v = p.v || {}; p.d = p.d || {}; p.q = p.q || {}; p.t = p.t || {};
  return p;
}
const VOCI = ['sc', 'bi', 'se', 'qz', 'pa', 'es', 'te', 'im'];
function add(p, voce, n) { if (!n) return; p.v[voce] = (p.v[voce] || 0) + n; p.p = (p.p || 0) + n; p.u = new Date().toISOString(); }
const ID = /^[\w:#.-]{1,40}$/;
// gli eventi del gioco: il server rifà i conti con le stesse regole e non conta due volte la stessa cosa
function apply(p, ev) {
  let n = 0;
  (Array.isArray(ev) ? ev : []).slice(0, 300).forEach(e => {
    if (!e || typeof e !== 'object') return; const id = String(e.id || '');
    if (e.k === 'sc' || e.k === 'bi') {   // scoperta: 10 passando, 20 arrivando; col binocolo la metà. Si somma solo la differenza col già avuto
      if (!ID.test(id)) return; const v = e.k === 'bi' ? ({ 5: 5, 10: 10 })[e.v] : ({ 10: 10, 20: 20 })[e.v]; if (!v) return;
      const had = +p.d[id] || 0; if (v <= had) return; p.d[id] = v; add(p, e.k, v - had); n++;
    } else if (e.k === 'se') {   // sentiero fino a una scoperta: 1 punto ogni 5 minuti di cammino, una volta per sentiero
      if (!ID.test(id) || p.t[id]) return; const m = Math.max(0, Math.min(600, Math.floor(+e.m || 0))), v = Math.floor(m / 5);
      p.t[id] = 1; add(p, 'se', v); n++;
    } else if (e.k === 'qz') {   // domanda: una volta sola, 1 punto se giusta
      if (!ID.test(id) || p.q[id] != null) return; p.q[id] = e.ok ? 1 : 0; add(p, 'qz', e.ok ? 1 : 0); n++;
    } else if (e.k === 'pa') {   // punti della patente persi: si tolgono dal totale
      const v = Math.max(0, Math.min(10, Math.floor(+e.v || 0))); add(p, 'pa', -v); n++;
    } else if (e.k === 'es') { add(p, 'es', -5); n++; }   // ogni esame per riavere la patente costa 5 punti
  });
  return n;
}
function board(data, pid) {
  const all = Object.keys(data.giocatori).map(k => ({ k, n: data.giocatori[k].n, p: data.giocatori[k].p || 0, u: data.giocatori[k].u || '' }))
    .sort((a, b) => b.p - a.p || (a.u < b.u ? -1 : 1));
  const pos = all.findIndex(x => x.k === pid);
  return { top: all.slice(0, 10).map(x => ({ n: x.n, p: x.p, io: x.k === pid })), pos: pos + 1, tot: all.length };
}
function mine(data, pid) {
  const p = data.giocatori[pid]; if (!p) return null;
  return { n: p.n, p: p.p || 0, v: p.v || {}, d: p.d || {}, q: p.q || {}, t: p.t || {} };
}
function out(data, pid) { return Object.assign({ on: true, stagione: data.stagione, gara: !!data.gara, avvio: data.avvio || null, io: mine(data, pid) }, board(data, pid)); }

// chi può azzerare e premiare: chi conosce la parola segreta della modalità God ed è tra i responsabili (come per le posizioni)
async function editor(u, pw) {
  const want = String(process.env.PUBLISH_HASH || '843c8bcf9a1ce5dd547159c829964c4f1eb463e5933d4b8e3aeb55abc692df8c');
  const got = crypto.createHash('sha256').update('cds|' + String(pw || '').trim().toLowerCase()).digest('hex');
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) return 'parola segreta mancante o sbagliata';
  const env = String(process.env.EDITORI || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  let list = [];
  try { const r = await gh('/contents/editori.json?ref=main'); if (r.ok) { const j = await r.json(); list = (JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')).editori || []); } } catch (e) {}
  const allowed = env.concat(list.map(x => String(x).toLowerCase()));
  if (allowed.length && allowed.indexOf(String(u.email).toLowerCase()) < 0) return 'il tuo account non è tra i responsabili';
  return null;
}

module.exports = async (req, res) => {
  if (!A.enabled() || !process.env.GITHUB_TOKEN) return A.json(res, 503, { on: false, error: 'classifica non attiva sul server' });
  const u = A.user(req); if (!u) return A.json(res, 401, { on: false, error: "Entra con l'account della scuola" });
  const pid = pidOf(u.email);
  try {
    if (req.method === 'GET') { const c = await load(false); return A.json(res, 200, out(c.data, pid)); }
    if (req.method !== 'POST') return A.json(res, 405, { error: 'metodo non ammesso' });
    if (!A.sameOrigin(req)) return A.json(res, 403, { error: 'origine non ammessa' });
    let b; try { b = JSON.parse(await A.readBody(req, 200000)); } catch (e) { return A.json(res, 413, { error: 'richiesta non valida' }); }
    b = b || {};
    if (b.op === 'ciao') {   // primo ingresso: nome casuale
      const c = await load(false);
      if (c.data.giocatori[pid]) return A.json(res, 200, out(c.data, pid));
      const r = await update(d => { if (d.giocatori[pid]) return false; player(d, pid); }, 'Nuovo giocatore');
      return A.json(res, 200, out(r.data, pid));
    }
    if (b.op === 'ev') {
      const c = await load(false);
      if (+b.stagione && +b.stagione !== c.data.stagione) return A.json(res, 200, Object.assign(out(c.data, pid), { scartati: true }));
      const r = await update(d => { if (+b.stagione && +b.stagione !== d.stagione) return false; const p = player(d, pid); if (!apply(p, b.ev)) return false; }, 'Punti');
      return A.json(res, 200, out(r.data, pid));
    }
    // da qui in poi: solo i responsabili (dalla pagina degli amministratori)
    const no = await editor(u, b.pw); if (no) return A.json(res, 403, { error: no });
    if (b.op === 'tutti') {
      const c = await load(true), G = c.data.giocatori;
      return A.json(res, 200, { stagione: c.data.stagione, gara: !!c.data.gara, avvio: c.data.avvio, giocatori: Object.keys(G).map(k => ({ pid: k, n: G[k].n, p: G[k].p || 0, v: G[k].v || {}, u: G[k].u })).sort((a, b) => b.p - a.p) });
    }
    if (b.op === 'azzera') {   // nuova gara: punteggi a zero (i nomi restano), niente velocizzazioni, regole sulla schermata iniziale
      const r = await update(d => { d.stagione = (d.stagione || 1) + 1; d.gara = true; d.avvio = new Date().toISOString(); d.premi = {};
        Object.keys(d.giocatori).forEach(k => { const g = d.giocatori[k]; d.giocatori[k] = { n: g.n, p: 0, v: {}, d: {}, q: {}, t: {}, u: d.avvio }; }); }, 'Classifica azzerata: inizia la gara');
      return A.json(res, 200, { ok: true, stagione: r.data.stagione });
    }
    if (b.op === 'gara') {   // accende o spegne le velocizzazioni senza toccare i punti
      const on = !!b.on; await update(d => { d.gara = on; }, on ? 'Gara: velocizzazioni tolte' : 'Velocizzazioni di nuovo attive');
      return A.json(res, 200, { ok: true, gara: on });
    }
    if (b.op === 'premio') {   // proposta approvata: 7 punti per il testo, 5 per le immagini
      const id = String(b.id || ''); let to = String(b.pid || '');
      if (!/^\d{14}-[0-9a-f]{6}$/.test(id)) return A.json(res, 400, { error: 'proposta non riconosciuta' });
      if (!to) {   // proposte arrivate prima della classifica: l'autore si ricava dall'account salvato nella proposta
        const r = await gh('/contents/proposte/' + id + '/meta.json?ref=proposte');
        if (r.ok) { try { const j = await r.json(); const m = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); if (m.pid) to = m.pid; else if (m.email) to = pidOf(m.email); } catch (e) {} }
        if (!to) return A.json(res, 404, { error: 'non trovo l\'autore di questa proposta' });
      }
      if (!/^[0-9a-f]{16}$/.test(to)) return A.json(res, 400, { error: 'proposta non riconosciuta' });
      const te = b.testo ? 7 : 0, im = b.foto ? 5 : 0;
      const r = await update(d => { if (d.premi[id]) return false; d.premi[id] = te + im; const p = player(d, to); add(p, 'te', te); add(p, 'im', im); }, 'Punti per una proposta approvata');
      const g = r.data.giocatori[to];
      return A.json(res, 200, { ok: true, gia: !!r.skipped, nome: g && g.n, punti: te + im });
    }
    A.json(res, 400, { error: 'operazione sconosciuta' });
  } catch (e) { A.json(res, 502, { error: String(e && e.message || e) }); }
};
