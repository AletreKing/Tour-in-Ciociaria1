// Il gioco e l'area amministratori si aprono solo con l'account della scuola (se l'accesso è configurato)
export const config = { matcher: ['/', '/index.html', '/index', '/guida.html', '/guida', '/admin.html', '/admin'] };
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function b64u(buf) { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
async function valid(tok, secret) {
  if (!tok || tok.indexOf('.') < 0) return false;
  const [body, mac] = tok.split('.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  if (want.length !== mac.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ mac.charCodeAt(i);
  if (d) return false;
  try { const o = JSON.parse(new TextDecoder().decode(unb64u(body))); return !!o.exp && o.exp > Date.now() / 1000; } catch (e) { return false; }
}
export default async function middleware(request) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  if (!(env.GOOGLE_CLIENT_ID && env.AUTH_DOMAIN && env.SESSION_SECRET)) return;   // accesso non ancora configurato: tutto aperto come prima
  const ck = request.headers.get('cookie') || '';
  const m = ck.match(/(?:^|;\s*)cds_sess=([^;]+)/);
  if (m && await valid(decodeURIComponent(m[1]), env.SESSION_SECRET)) return;
  const u = new URL(request.url);
  return Response.redirect(new URL('/login.html?next=' + encodeURIComponent(u.pathname + u.search + u.hash), u.origin).toString(), 302);
}
