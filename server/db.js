/* ASCII-Terra database — Node's built-in SQLite module (node:sqlite, Node 22.5+), no extra packages.
   File: server/data/terra.db (git-ignored). Shared by server.js and admin.js. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA = path.join(__dirname, 'data'), FILE = path.join(DATA, 'terra.db'), BAK = path.join(DATA, 'backups');
fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(FILE);
db.exec(`
PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;
CREATE TABLE IF NOT EXISTS users (
  key TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  rec TEXT, created INTEGER NOT NULL, last INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS saves (user TEXT PRIMARY KEY REFERENCES users(key) ON DELETE CASCADE, data TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, user TEXT NOT NULL REFERENCES users(key) ON DELETE CASCADE, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS stats (user TEXT PRIMARY KEY REFERENCES users(key) ON DELETE CASCADE, duel_w INTEGER NOT NULL DEFAULT 0, duel_l INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user);
`);

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ukey = n => String(n).toLocaleLowerCase('tr');
const scrypt = (pass, salt) => new Promise((res, rej) => crypto.scrypt(pass, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
async function hashPass(pass) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: (await scrypt(pass, salt)).toString('hex') }; }
async function checkPass(u, pass) {   // spends the same time even when the account does not exist
  const h = await scrypt(pass, u ? u.salt : '0'.repeat(32));
  return !!u && crypto.timingSafeEqual(h, Buffer.from(u.hash, 'hex'));
}
// recovery code: 12 unambiguous letters/digits, XXXX-XXXX-XXXX
const RC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRecovery() { const b = crypto.randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += RC[b[i] % RC.length]; return s.replace(/(.{4})(?=.)/g, '$1-'); }
const recHash = code => sha(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''));

const q = {
  get: db.prepare('SELECT * FROM users WHERE key = ?'),
  add: db.prepare('INSERT INTO users (key, name, salt, hash, rec, created, last) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  last: db.prepare('UPDATE users SET last = ? WHERE key = ?'),
  pass: db.prepare('UPDATE users SET salt = ?, hash = ?, rec = COALESCE(?, rec) WHERE key = ?'),
  ban: db.prepare('UPDATE users SET banned = ? WHERE key = ?'),
  del: db.prepare('DELETE FROM users WHERE key = ?'),
  list: db.prepare('SELECT u.name, u.created, u.last, u.banned, s.updated FROM users u LEFT JOIN saves s ON s.user = u.key ORDER BY u.last DESC'),
  save: db.prepare('INSERT INTO saves (user, data, updated) VALUES (?, ?, ?) ON CONFLICT(user) DO UPDATE SET data = excluded.data, updated = excluded.updated'),
  load: db.prepare('SELECT data FROM saves WHERE user = ?'),
  tokAdd: db.prepare('INSERT INTO tokens (hash, user, exp) VALUES (?, ?, ?)'),
  tokGet: db.prepare('SELECT user, exp FROM tokens WHERE hash = ?'),
  tokDel: db.prepare('DELETE FROM tokens WHERE hash = ?'),
  tokDelUser: db.prepare('DELETE FROM tokens WHERE user = ?'),
  tokPurge: db.prepare('DELETE FROM tokens WHERE exp < ?'),
};
function tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }

// import an old users.json once, then keep it as .bak
const OLD = path.join(DATA, 'users.json');
if (fs.existsSync(OLD)) {
  try {
    const J = JSON.parse(fs.readFileSync(OLD, 'utf8')); let n = 0;
    tx(() => {
      for (const [key, u] of Object.entries(J.users || {})) {
        if (q.get.get(key)) continue;
        q.add.run(key, u.name, u.salt, u.hash, null, u.created || Date.now(), u.last || Date.now()); n++;
        if (u.save) q.save.run(key, JSON.stringify(u.save), Date.now());
      }
      for (const [h, r] of Object.entries(J.tokens || {})) if (r && r.exp > Date.now() && q.get.get(r.u) && !q.tokGet.get(h)) q.tokAdd.run(h, r.u, r.exp);
    });
    fs.renameSync(OLD, OLD + '.bak');
    console.log(`[db] imported users.json (${n} accounts), old file kept as users.json.bak`);
  } catch (e) { console.log('[db] could not import users.json: ' + e.message); }
}
q.tokPurge.run(Date.now());

// game saves are batched for 1.5 s and written in one transaction
const pending = new Map(); let flushT = null;
function flush() { flushT = null; if (!pending.size) return; const now = Date.now(); tx(() => { for (const [k, d] of pending) q.save.run(k, d, now); }); pending.clear(); }

// daily backup (last 7 kept)
function backup() {
  flush(); fs.mkdirSync(BAK, { recursive: true });
  const f = path.join(BAK, 'terra-' + new Date().toISOString().slice(0, 10) + '.db');
  if (fs.existsSync(f)) fs.unlinkSync(f);
  db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(BAK).filter(x => /^terra-.*\.db$/.test(x)).sort().slice(0, -7);
  for (const x of old) fs.unlinkSync(path.join(BAK, x));
  return f;
}

module.exports = {
  sha, ukey, hashPass, checkPass, newRecovery, recHash, backup,
  user: key => q.get.get(key),
  async create(name, pass) {
    const key = ukey(name), { salt, hash } = await hashPass(pass), code = newRecovery();
    if (q.get.get(key)) return null;
    q.add.run(key, name, salt, hash, recHash(code), Date.now(), Date.now());
    return { key, code };
  },
  async setPass(key, pass, withRecovery) {
    const { salt, hash } = await hashPass(pass), code = withRecovery ? newRecovery() : null;
    q.pass.run(salt, hash, code ? recHash(code) : null, key); q.tokDelUser.run(key);
    return code;
  },
  touch: key => q.last.run(Date.now(), key),
  ban: (key, on) => { q.ban.run(on ? 1 : 0, key); if (on) q.tokDelUser.run(key); },
  remove: key => { pending.delete(key); return q.del.run(key).changes > 0; },
  list: () => q.list.all(),
  save(key, json) { pending.set(key, json); if (!flushT) flushT = setTimeout(flush, 1500); },
  load(key) { if (pending.has(key)) return JSON.parse(pending.get(key)); const r = q.load.get(key); return r ? JSON.parse(r.data) : null; },
  newToken(key) { const t = crypto.randomBytes(32).toString('base64url'); q.tokAdd.run(sha(t), key, Date.now() + 30 * 864e5); return t; },
  tokenUser(t) { const r = q.tokGet.get(sha(t)); return r && r.exp > Date.now() ? r.user : null; },
  dropToken: t => q.tokDel.run(sha(t)),
  close() { flush(); db.close(); },
  flush,
};
