// ASCII-Terra multiplayer server — zero dependencies (Node.js built-in modules only).
// - Serves the game files over HTTP (dotfiles and paths outside the root are blocked)
// - WebSocket at /ws: player presence, state relay, chat, host election
// Run:  node server/server.js            (default port 8765)
//              PORT=9000 node server/server.js
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const ROOT = path.resolve(__dirname, '..');
const PORT = +process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_CLIENTS = 32, MAX_FRAME = 65535, MSG_PER_SEC = 90;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

/* ---------------- statik dosyalar ---------------- */
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let u; try { u = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (u === '/') u = '/index.html';
  if (u.includes('\0') || u.split(/[\\/]/).some(s => s.startsWith('.')) || u.toLowerCase().startsWith('/server')) { res.writeHead(404); return res.end('404'); }
  const f = path.join(ROOT, path.normalize(u));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  });
});

/* ---------------- WebSocket (RFC 6455, text frames only) ---------------- */
function frame(payload, op = 1) {
  const n = payload.length; let h;
  if (n < 126) h = Buffer.from([128 | op, n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 128 | op; h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([h, payload]);
}
function attach(sock, onText, onClose) {
  let buf = Buffer.alloc(0);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (buf.length > MAX_FRAME * 4) return sock.destroy();
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1], op = b0 & 15; let len = b1 & 127, off = 2;
      if (!(b1 & 128)) return sock.destroy();                 // client frames must be masked
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) return sock.destroy();
      if (len > MAX_FRAME) return sock.destroy();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.alloc(len);
      for (let i = 0; i < len; i++) data[i] = buf[off + 4 + i] ^ mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8) { onClose(); try { sock.end(frame(Buffer.alloc(0), 8)); } catch { } return; }
      if (op === 9) { sock.write(frame(data, 10)); continue; }
      if (op === 1 && (b0 & 128)) onText(data.toString('utf8'));
    }
  });
}
server.on('upgrade', (req, sock) => {
  let p; try { p = new URL(req.url, 'http://x').pathname; } catch { return sock.destroy(); }
  const key = req.headers['sec-websocket-key'];
  if (p !== '/ws' || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key || clients.size >= MAX_CLIENTS) return sock.destroy();
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true); connect(sock);
});

/* ---------------- accounts (server/db.js → server/data/terra.db, git-ignored) ----------------
   Passwords: scrypt + random salt; only SHA-256 digests of login tokens and recovery codes are stored. */
const DB = require('./db');
const NAME_RE = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]{3,16}$/;
const ukey = DB.ukey;
const attempts = new Map();
function limited(ip) { const now = Date.now(), a = attempts.get(ip) || { n: 0, t: now }; if (now - a.t > 60000) { a.n = 0; a.t = now; } a.n++; attempts.set(ip, a); return a.n > 5; }
setInterval(() => { const now = Date.now(); for (const [ip, a] of attempts) if (now - a.t > 60000) attempts.delete(ip); }, 60000);
function authOk(c, key, token, recovery) {
  for (const o of clients.values()) if (o !== c && o.user === key) { send(o, { t: 'kick', why: 'This account logged in from somewhere else' }); drop(o); }
  c.user = key; DB.touch(key);
  send(c, { t: 'auth', ok: true, name: DB.user(key).name, token, save: DB.load(key), recovery: recovery || undefined });
}
async function onAuth(c, m) {
  const no = (err, x) => send(c, Object.assign({ t: 'auth', ok: false, err }, x || {}));
  if (c.hello) return no('Cannot switch accounts while in game');
  if (m.t === 'tok') {
    const key = DB.tokenUser(String(m.token || '')), u = key && DB.user(key);
    if (!u || u.banned) return no('', { silent: true });
    return authOk(c, key, String(m.token));
  }
  if (m.t === 'logout') { DB.dropToken(String(m.token || '')); c.user = null; return no('', { silent: true, out: true }); }
  if (limited(c.ip)) return no('Too many attempts, wait a minute');
  const name = String(m.name || '').trim(), pass = String(m.pass || ''), key = ukey(name);
  if (!NAME_RE.test(name)) return no('Name must be 3-16 characters (letters, digits, _ and -)');
  if (pass.length < 6 || pass.length > 64) return no('Password must be 6-64 characters');
  if (m.t === 'reg') {
    if (DB.user(key)) return no('That name is taken');
    const r = await DB.create(name, pass);
    if (!r) return no('That name is taken');
    log('new account: ' + name);
    return authOk(c, key, DB.newToken(key), r.code);
  }
  if (m.t === 'login') {
    const u = DB.user(key);
    if (!(await DB.checkPass(u, pass))) return no('Wrong name or password');
    if (u.banned) return no('This account is banned');
    return authOk(c, key, DB.newToken(key));
  }
  if (m.t === 'reset') {   // forgot password: name + recovery code + new password
    const u = DB.user(key), ok = !!u && !!u.rec && crypto.timingSafeEqual(Buffer.from(u.rec, 'hex'), Buffer.from(DB.recHash(m.code || ''), 'hex'));
    if (!ok) return no('Wrong name or recovery code');
    if (u.banned) return no('This account is banned');
    const code = await DB.setPass(key, pass, true); log('password reset: ' + u.name);
    return authOk(c, key, DB.newToken(key), code);
  }
}
// daily backup (server/data/backups, last 7)
function dailyBackup() { try { log('backup → ' + path.basename(DB.backup())); } catch (e) { log('backup error: ' + e.message); } }
setTimeout(dailyBackup, 10000); setInterval(dailyBackup, 864e5);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { DB.close(); } catch { } process.exit(0); });

/* ---------------- players, host election, relay ---------------- */
const clients = new Map(); let nextId = 1, hostId = 0;
const invites = new Map();   // target id -> { from }
function endDuel(d, loserId) {
  if (!d || d.over) return; d.over = true;
  const a = clients.get(d.a), b = clients.get(d.b); if (a) a.duel = null; if (b) b.duel = null;
  const win = loserId === d.a ? d.b : d.a, w = clients.get(win), l = clients.get(loserId);
  const rec = w && w.user ? DB.duel(w.user, true) : null, recL = l && l.user ? DB.duel(l.user, false) : null;   // only accounts keep a record
  bcast({ t: 'sys', text: (w ? w.name : 'Someone') + ' won the duel against ' + (l ? l.name : 'a player that left') + (rec ? ' (' + rec.w + 'W ' + rec.l + 'L)' : '') });
  for (const c of [a, b]) if (c) send(c, { t: 'duel_end', win, lose: loserId, rec: c === w ? rec : recL });   // rec: own { w, l }, null for guests
}
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, n);
const num = v => { v = +v; return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; };
const int = v => { v = Math.trunc(+v); return Number.isFinite(v) ? v : 0; };
function send(c, o) { if (c && !c.sock.destroyed) c.sock.write(frame(Buffer.from(JSON.stringify(o)))); }
function bcast(o, except) { const b = frame(Buffer.from(JSON.stringify(o))); for (const c of clients.values()) if (c !== except && c.hello && !c.sock.destroyed) c.sock.write(b); }
function elect() {   // host: the oldest player, preferably one with a visible tab
  const cur = clients.get(hostId), list = [...clients.values()].filter(c => c.hello);
  if (cur && cur.hello && !cur.hidden) return;
  const pick = list.find(c => !c.hidden) || (cur && cur.hello ? cur : list[0]);
  const id = pick ? pick.id : 0; if (id === hostId) return;
  hostId = id; if (hostId) { bcast({ t: 'host', id: hostId }); log('host → #' + hostId); }
}
function connect(sock) {
  const c = { id: nextId++, sock, ip: sock.remoteAddress || '?', user: null, name: '', st: null, hello: false, rate: 0, rateT: Date.now() };
  clients.set(c.id, c);
  attach(sock, t => onMsg(c, t), () => drop(c));
  sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
  setTimeout(() => { if (!c.hello) drop(c); }, 15 * 60000);   // how long a client may idle on the start screen
}
function drop(c) {
  if (!clients.has(c.id)) return; clients.delete(c.id);
  try { c.sock.destroy(); } catch { }
  if (c.duel) endDuel(c.duel, c.id);
  if (c.hello) { bcast({ t: 'leave', id: c.id }); log(c.name + ' left (' + clients.size + ' online)'); }
  if (c.id === hostId) { hostId = 0; elect(); }
}
function onMsg(c, txt) {
  const now = Date.now(); if (now - c.rateT > 1000) { c.rateT = now; c.rate = 0; } if (++c.rate > MSG_PER_SEC) return;
  let m; try { m = JSON.parse(txt); } catch { return; } if (!m || typeof m.t !== 'string') return;
  if (m.t === 'reg' || m.t === 'login' || m.t === 'tok' || m.t === 'logout' || m.t === 'reset') { onAuth(c, m).catch(e => log('auth error: ' + e.message)); return; }
  if (!c.hello) {
    if (m.t !== 'hello') return;
    c.hello = true;
    if (c.user) c.name = DB.user(c.user).name;
    else { let n = clean(m.name, 16) || ('Knight' + c.id); if (DB.user(ukey(n))) n = ('Guest-' + n).slice(0, 16); c.name = n; }
    if ([...clients.values()].some(o => o !== c && o.hello && o.name === c.name)) c.name = c.name.slice(0, 12) + '#' + c.id;
    if (!hostId) hostId = c.id;
    send(c, { t: 'welcome', id: c.id, name: c.name, account: !!c.user, host: hostId, players: [...clients.values()].filter(o => o.hello && o !== c).map(o => ({ id: o.id, name: o.name, st: o.st })) });
    bcast({ t: 'join', id: c.id, name: c.name }, c); log(c.name + ' joined (' + clients.size + ' online)');
    elect(); return;
  }
  const isHost = c.id === hostId;
  switch (m.t) {
    case 'st': {   // player state: only numeric fields are relayed
      const s = { t: 'st', from: c.id, x: num(m.x), y: num(m.y), z: num(m.z), f: num(m.f), a: Array.isArray(m.a) ? m.a.slice(0, 8).map(num) : [], hp: num(m.hp), mh: num(m.mh), lv: int(m.lv), lk: Math.max(0, Math.min(999, int(m.lk))), mt: m.mt ? 1 : 0 };
      c.st = s; bcast(s, c); break;
    }
    case 'vis': c.hidden = !!m.h; elect(); break;
    case 'save': if (c.user && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { const s = JSON.stringify(m.data); if (s.length < 48000) DB.save(c.user, s); } break;
    case 'ch': { const text = clean(m.text, 140); if (text) bcast({ t: 'ch', from: c.id, name: c.name, text }); break; }
    case 'fx': bcast({ t: 'fx', from: c.id, k: clean(m.k, 4), x: num(m.x), z: num(m.z), vx: num(m.vx), vz: num(m.vz), r: num(m.r) }, c); break;
    case 'hit': if (hostId && !isHost) send(clients.get(hostId), { t: 'hit', from: c.id, e: int(m.e), d: Math.min(2000, Math.max(0, num(m.d))), c: !!m.c, x: num(m.x), z: num(m.z) }); break;
    case 'en': if (isHost && Array.isArray(m.d)) bcast({ t: 'en', d: m.d.slice(0, 200).map(r => Array.isArray(r) ? r.slice(0, 10).map(int) : []) }, c); break;
    case 'tele': if (isHost) bcast({ t: 'tele', x: num(m.x), z: num(m.z), r: num(m.r), dl: num(m.dl), d: num(m.d), f: m.f ? 1 : 0 }, c); break;
    case 'web': if (isHost) bcast({ t: 'web', x: num(m.x), z: num(m.z), r: Math.min(12, num(m.r)) }, c); break;
    case 'ep': if (isHost) bcast({ t: 'ep', x: num(m.x), y: num(m.y), z: num(m.z), vx: num(m.vx), vz: num(m.vz), d: num(m.d), tid: int(m.tid) }, c); break;
    case 'duel': {   // challenge: target must be close, nobody busy; invite expires after 20 s
      const o = clients.get(int(m.to)); if (!o || !o.hello || o === c) break;
      const sys = t => send(c, { t: 'sys', text: t });
      if (c.duel || o.duel) { sys('Already in a duel'); break; }
      if (invites.has(o.id) || [...invites.values()].some(v => v.from === c.id)) { sys('An invite is already pending'); break; }
      if (!c.st || !o.st || Math.hypot(c.st.x - o.st.x, c.st.z - o.st.z) > 14) { sys('That player is too far away'); break; }
      const iv = { from: c.id }; invites.set(o.id, iv);
      send(o, { t: 'duel_inv', from: c.id, name: c.name }); sys('Duel challenge sent to ' + o.name);
      setTimeout(() => { if (invites.get(o.id) === iv) { invites.delete(o.id); sys(o.name + ' did not answer'); send(o, { t: 'duel_inv', from: 0 }); } }, 20000);
      break;
    }
    case 'duel_r': {
      const iv = invites.get(c.id); if (!iv) break; invites.delete(c.id);
      const a = clients.get(iv.from); if (!a || a.duel || c.duel) break;
      if (!m.ok) { send(a, { t: 'sys', text: c.name + ' declined the duel' }); break; }
      const d = { a: a.id, b: c.id, start: Date.now() + 3000, over: false }; a.duel = c.duel = d;
      const cx = num(((a.st ? a.st.x : 0) + (c.st ? c.st.x : 0)) / 2), cz = num(((a.st ? a.st.z : 0) + (c.st ? c.st.z : 0)) / 2);
      send(a, { t: 'duel_go', opp: c.id, name: c.name, cx, cz }); send(c, { t: 'duel_go', opp: a.id, name: a.name, cx, cz });
      bcast({ t: 'sys', text: a.name + ' and ' + c.name + ' begin a duel' });
      break;
    }
    case 'pvp': {   // duel damage: only between the two duelists, after the countdown, rate-limited, range-checked
      const d = c.duel; if (!d || d.over || now < d.start || now - (c.pvpT || 0) < 120) break; c.pvpT = now;
      const o = clients.get(d.a === c.id ? d.b : d.a); if (!o || !c.st || !o.st || Math.hypot(c.st.x - o.st.x, c.st.z - o.st.z) > 26) break;   // ring is 24 across
      send(o, { t: 'dmg', d: Math.min(600, Math.max(0, num(m.d))), x: c.st.x, z: c.st.z }); break;
    }
    case 'duel_lose': endDuel(c.duel, c.id); break;
    case 'kill': if (isHost) send(clients.get(int(m.to)), { t: 'kill', e: int(m.e) }); break;
    case 'dmg': if (isHost) send(clients.get(int(m.to)), { t: 'dmg', d: Math.min(5000, Math.max(0, num(m.d))), x: num(m.x), z: num(m.z) }); break;
  }
}
setInterval(() => { for (const c of clients.values()) if (!c.sock.destroyed) c.sock.write(frame(Buffer.alloc(0), 9)); }, 25000);

function log(s) { console.log(new Date().toISOString().slice(11, 19) + '  ' + s); }
server.listen(PORT, HOST, () => {
  log('ASCII-Terra server running → http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) log('For friends on your local network → http://' + a.address + ':' + PORT);
});
