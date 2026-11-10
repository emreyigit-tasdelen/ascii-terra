// ASCII-Terra çok oyunculu sunucu — sıfır bağımlılık (yalnız Node.js yerleşik modülleri).
// - Oyun dosyalarını HTTP ile sunar (gizli dosyalar ve kök dışı yollar engelli)
// - /ws adresinde WebSocket: oyuncu varlığı, durum aktarımı, sohbet, host seçimi
// Çalıştırma:  node server/server.js            (varsayılan port 8765)
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

/* ---------------- WebSocket (RFC 6455, yalnız metin çerçeveleri) ---------------- */
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
      if (!(b1 & 128)) return sock.destroy();                 // istemci çerçeveleri maskeli olmalı
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

/* ---------------- hesaplar (server/db.js → server/data/terra.db, git'e girmez) ----------------
   Şifreler scrypt + rastgele tuz; oturum belirteçleri ve kurtarma kodlarının yalnız SHA-256 özeti tutulur. */
const DB = require('./db');
const NAME_RE = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]{3,16}$/;
const ukey = DB.ukey;
const attempts = new Map();
function limited(ip) { const now = Date.now(), a = attempts.get(ip) || { n: 0, t: now }; if (now - a.t > 60000) { a.n = 0; a.t = now; } a.n++; attempts.set(ip, a); return a.n > 5; }
setInterval(() => { const now = Date.now(); for (const [ip, a] of attempts) if (now - a.t > 60000) attempts.delete(ip); }, 60000);
function authOk(c, key, token, recovery) {
  for (const o of clients.values()) if (o !== c && o.user === key) { send(o, { t: 'kick', why: 'Bu hesapla başka bir yerden giriş yapıldı' }); drop(o); }
  c.user = key; DB.touch(key);
  send(c, { t: 'auth', ok: true, name: DB.user(key).name, token, save: DB.load(key), recovery: recovery || undefined });
}
async function onAuth(c, m) {
  const no = (err, x) => send(c, Object.assign({ t: 'auth', ok: false, err }, x || {}));
  if (c.hello) return no('Oyundayken hesap değiştirilemez');
  if (m.t === 'tok') {
    const key = DB.tokenUser(String(m.token || '')), u = key && DB.user(key);
    if (!u || u.banned) return no('', { silent: true });
    return authOk(c, key, String(m.token));
  }
  if (m.t === 'logout') { DB.dropToken(String(m.token || '')); c.user = null; return no('', { silent: true, out: true }); }
  if (limited(c.ip)) return no('Çok fazla deneme, bir dakika bekle');
  const name = String(m.name || '').trim(), pass = String(m.pass || ''), key = ukey(name);
  if (!NAME_RE.test(name)) return no('Ad 3-16 karakter olmalı (harf, rakam, _ ve -)');
  if (pass.length < 6 || pass.length > 64) return no('Şifre 6-64 karakter olmalı');
  if (m.t === 'reg') {
    if (DB.user(key)) return no('Bu ad alınmış');
    const r = await DB.create(name, pass);
    if (!r) return no('Bu ad alınmış');
    log('yeni hesap: ' + name);
    return authOk(c, key, DB.newToken(key), r.code);
  }
  if (m.t === 'login') {
    const u = DB.user(key);
    if (!(await DB.checkPass(u, pass))) return no('Ad ya da şifre hatalı');
    if (u.banned) return no('Bu hesap yasaklandı');
    return authOk(c, key, DB.newToken(key));
  }
  if (m.t === 'reset') {   // şifremi unuttum: ad + kurtarma kodu + yeni şifre
    const u = DB.user(key), ok = !!u && !!u.rec && crypto.timingSafeEqual(Buffer.from(u.rec, 'hex'), Buffer.from(DB.recHash(m.code || ''), 'hex'));
    if (!ok) return no('Ad ya da kurtarma kodu hatalı');
    if (u.banned) return no('Bu hesap yasaklandı');
    const code = await DB.setPass(key, pass, true); log('şifre sıfırlandı: ' + u.name);
    return authOk(c, key, DB.newToken(key), code);
  }
}
// günlük yedek (server/data/yedek, son 7)
function dailyBackup() { try { log('yedek → ' + path.basename(DB.backup())); } catch (e) { log('yedek hatası: ' + e.message); } }
setTimeout(dailyBackup, 10000); setInterval(dailyBackup, 864e5);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { DB.close(); } catch { } process.exit(0); });

/* ---------------- oyuncular, host seçimi, aktarım ---------------- */
const clients = new Map(); let nextId = 1, hostId = 0;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, n);
const num = v => { v = +v; return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; };
const int = v => { v = Math.trunc(+v); return Number.isFinite(v) ? v : 0; };
function send(c, o) { if (c && !c.sock.destroyed) c.sock.write(frame(Buffer.from(JSON.stringify(o)))); }
function bcast(o, except) { const b = frame(Buffer.from(JSON.stringify(o))); for (const c of clients.values()) if (c !== except && c.hello && !c.sock.destroyed) c.sock.write(b); }
function elect() {   // host: tercihen sekmesi görünür olan en eski oyuncu
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
  setTimeout(() => { if (!c.hello) drop(c); }, 15 * 60000);   // giriş ekranında bekleme süresi
}
function drop(c) {
  if (!clients.has(c.id)) return; clients.delete(c.id);
  try { c.sock.destroy(); } catch { }
  if (c.hello) { bcast({ t: 'leave', id: c.id }); log(c.name + ' ayrıldı (' + clients.size + ' çevrimiçi)'); }
  if (c.id === hostId) { hostId = 0; elect(); }
}
function onMsg(c, txt) {
  const now = Date.now(); if (now - c.rateT > 1000) { c.rateT = now; c.rate = 0; } if (++c.rate > MSG_PER_SEC) return;
  let m; try { m = JSON.parse(txt); } catch { return; } if (!m || typeof m.t !== 'string') return;
  if (m.t === 'reg' || m.t === 'login' || m.t === 'tok' || m.t === 'logout' || m.t === 'reset') { onAuth(c, m).catch(e => log('auth hatası: ' + e.message)); return; }
  if (!c.hello) {
    if (m.t !== 'hello') return;
    c.hello = true;
    if (c.user) c.name = DB.user(c.user).name;
    else { let n = clean(m.name, 16) || ('Şövalye' + c.id); if (DB.user(ukey(n))) n = ('Misafir-' + n).slice(0, 16); c.name = n; }
    if ([...clients.values()].some(o => o !== c && o.hello && o.name === c.name)) c.name = c.name.slice(0, 12) + '#' + c.id;
    if (!hostId) hostId = c.id;
    send(c, { t: 'welcome', id: c.id, name: c.name, account: !!c.user, host: hostId, players: [...clients.values()].filter(o => o.hello && o !== c).map(o => ({ id: o.id, name: o.name, st: o.st })) });
    bcast({ t: 'join', id: c.id, name: c.name }, c); log(c.name + ' katıldı (' + clients.size + ' çevrimiçi)');
    elect(); return;
  }
  const isHost = c.id === hostId;
  switch (m.t) {
    case 'st': {   // oyuncu durumu: yalnız sayısal alanlar aktarılır
      const s = { t: 'st', from: c.id, x: num(m.x), y: num(m.y), z: num(m.z), f: num(m.f), a: Array.isArray(m.a) ? m.a.slice(0, 8).map(num) : [], hp: num(m.hp), mh: num(m.mh), lv: int(m.lv) };
      c.st = s; bcast(s, c); break;
    }
    case 'vis': c.hidden = !!m.h; elect(); break;
    case 'save': if (c.user && m.data && typeof m.data === 'object' && !Array.isArray(m.data)) { const s = JSON.stringify(m.data); if (s.length < 48000) DB.save(c.user, s); } break;
    case 'ch': { const text = clean(m.text, 140); if (text) bcast({ t: 'ch', from: c.id, name: c.name, text }); break; }
    case 'fx': bcast({ t: 'fx', from: c.id, k: clean(m.k, 4), x: num(m.x), z: num(m.z), vx: num(m.vx), vz: num(m.vz), r: num(m.r) }, c); break;
    case 'hit': if (hostId && !isHost) send(clients.get(hostId), { t: 'hit', from: c.id, e: int(m.e), d: Math.min(2000, Math.max(0, num(m.d))), c: !!m.c, x: num(m.x), z: num(m.z) }); break;
    case 'en': if (isHost && Array.isArray(m.d)) bcast({ t: 'en', d: m.d.slice(0, 200).map(r => Array.isArray(r) ? r.slice(0, 10).map(int) : []) }, c); break;
    case 'tele': if (isHost) bcast({ t: 'tele', x: num(m.x), z: num(m.z), r: num(m.r), dl: num(m.dl), d: num(m.d), f: m.f ? 1 : 0 }, c); break;
    case 'ep': if (isHost) bcast({ t: 'ep', x: num(m.x), y: num(m.y), z: num(m.z), vx: num(m.vx), vz: num(m.vz), d: num(m.d), tid: int(m.tid) }, c); break;
    case 'kill': if (isHost) send(clients.get(int(m.to)), { t: 'kill', e: int(m.e) }); break;
    case 'dmg': if (isHost) send(clients.get(int(m.to)), { t: 'dmg', d: Math.min(5000, Math.max(0, num(m.d))), x: num(m.x), z: num(m.z) }); break;
  }
}
setInterval(() => { for (const c of clients.values()) if (!c.sock.destroyed) c.sock.write(frame(Buffer.alloc(0), 9)); }, 25000);

function log(s) { console.log(new Date().toISOString().slice(11, 19) + '  ' + s); }
server.listen(PORT, HOST, () => {
  log('ASCII-Terra sunucusu çalışıyor → http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) log('Yerel ağdaki arkadaşlar için → http://' + a.address + ':' + PORT);
});
