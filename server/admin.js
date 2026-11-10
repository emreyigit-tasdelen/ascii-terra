// ASCII-Terra yönetim aracı (komut satırı). Sunucu açıkken de çalışır (SQLite WAL).
//   node server/admin.js list               hesapları listele
//   node server/admin.js reset <ad>         geçici şifre üret (oturumlar kapanır)
//   node server/admin.js ban <ad> | unban <ad>
//   node server/admin.js delete <ad> --yes  hesabı ve kaydını kalıcı sil
//   node server/admin.js backup             server/data/yedek altına anlık yedek
'use strict';
const crypto = require('crypto');
const DB = require('./db');
const [cmd, name, flag] = process.argv.slice(2);
const d = t => t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '-';
const need = () => { const u = name && DB.user(DB.ukey(name)); if (!u) { console.error('Hesap bulunamadı: ' + (name || '(ad yok)')); process.exit(1); } return u; };

(async () => {
  switch (cmd) {
    case 'list': {
      const rows = DB.list();
      console.log('AD'.padEnd(18) + 'OLUŞTURMA'.padEnd(18) + 'SON GİRİŞ'.padEnd(18) + 'KAYIT'.padEnd(18) + 'DURUM');
      for (const r of rows) console.log(r.name.padEnd(18) + d(r.created).padEnd(18) + d(r.last).padEnd(18) + d(r.updated).padEnd(18) + (r.banned ? 'YASAKLI' : ''));
      console.log(rows.length + ' hesap'); break;
    }
    case 'reset': {
      const u = need(), pass = crypto.randomBytes(6).toString('base64url');
      await DB.setPass(u.key, pass, false);
      console.log(`${u.name} için geçici şifre: ${pass}\nOyuncuya ilet; girişten sonra değiştirmesi önerilir.`); break;
    }
    case 'ban': case 'unban': { const u = need(); DB.ban(u.key, cmd === 'ban'); console.log(u.name + (cmd === 'ban' ? ' yasaklandı.' : ' yasağı kaldırıldı.')); break; }
    case 'delete': {
      const u = need();
      if (flag !== '--yes') { console.log(`${u.name} ve kaydı KALICI silinecek. Onaylamak için: node server/admin.js delete ${u.name} --yes`); break; }
      DB.remove(u.key); console.log(u.name + ' silindi.'); break;
    }
    case 'backup': console.log('Yedek: ' + DB.backup()); break;
    default: console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(0, 6).join('\n').replace(/^\/\/ ?/gm, ''));
  }
  DB.close();
})().catch(e => { console.error(e.message); process.exit(1); });
