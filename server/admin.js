// ASCII-Terra admin tool (command line). Works while the server is running (SQLite WAL).
//   node server/admin.js list                 list accounts
//   node server/admin.js reset <name>         generate a temporary password (logs out sessions)
//   node server/admin.js ban <name> | unban <name>
//   node server/admin.js delete <name> --yes  permanently delete the account and its save
//   node server/admin.js backup               instant backup into server/data/backups
'use strict';
const crypto = require('crypto');
const DB = require('./db');
const [cmd, name, flag] = process.argv.slice(2);
const d = t => t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '-';
const need = () => { const u = name && DB.user(DB.ukey(name)); if (!u) { console.error('Account not found: ' + (name || '(no name)')); process.exit(1); } return u; };

(async () => {
  switch (cmd) {
    case 'list': {
      const rows = DB.list();
      console.log('NAME'.padEnd(18) + 'CREATED'.padEnd(18) + 'LAST LOGIN'.padEnd(18) + 'SAVED'.padEnd(18) + 'DUELS'.padEnd(10) + 'STATUS');
      for (const r of rows) console.log(r.name.padEnd(18) + d(r.created).padEnd(18) + d(r.last).padEnd(18) + d(r.updated).padEnd(18) + ((r.duel_w || 0) + 'W ' + (r.duel_l || 0) + 'L').padEnd(10) + (r.banned ? 'BANNED' : ''));
      console.log(rows.length + ' account(s)'); break;
    }
    case 'reset': {
      const u = need(), pass = crypto.randomBytes(6).toString('base64url');
      await DB.setPass(u.key, pass, false);
      console.log(`Temporary password for ${u.name}: ${pass}\nPass it to the player; they should change it after logging in.`); break;
    }
    case 'ban': case 'unban': { const u = need(); DB.ban(u.key, cmd === 'ban'); console.log(u.name + (cmd === 'ban' ? ' banned.' : ' unbanned.')); break; }
    case 'delete': {
      const u = need();
      if (flag !== '--yes') { console.log(`${u.name} and their save will be PERMANENTLY deleted. To confirm: node server/admin.js delete ${u.name} --yes`); break; }
      DB.remove(u.key); console.log(u.name + ' deleted.'); break;
    }
    case 'backup': console.log('Backup: ' + DB.backup()); break;
    default: console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(0, 6).join('\n').replace(/^\/\/ ?/gm, ''));
  }
  DB.close();
})().catch(e => { console.error(e.message); process.exit(1); });
