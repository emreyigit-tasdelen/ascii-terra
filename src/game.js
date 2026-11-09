// Oyun durumu, eşyalar, görevler, diyalog, kayıt ve arayüz (HUD)
import { THREE, $, clamp, heightAt } from './core.js';
import { camera, ENV } from './render.js';
import { crystals, CIRCLE } from './world.js';
import { P, NPCS, enemies, CD, CDMAX, TGT, resetPlayer } from './actors.js';

const SAVE_KEY = 'asciiTerra2';
export let S = freshState();
function freshState() { return { lvl: 1, xp: 0, gold: 0, kills: {}, shards: 0, circle: false, taken: [], q: {}, inv: { pot: 3 }, eq: { weapon: 'rust', armor: null }, x: 0, z: 14, dayT: .3 }; }

/* ================= eşyalar ================= */
export const ITEMS = {
  pot: { n: 'Şifa İksiri', t: 'use', heal: 60, c: '#f77', d: '+60 HP', icon: '!' },
  rust: { n: 'Paslı Kılıç', t: 'weapon', atk: 0, c: '#aaa', d: 'ATK +0', icon: '/' },
  iron: { n: 'Demir Kılıç', t: 'weapon', atk: 6, c: '#9cf', d: 'ATK +6', icon: '/' },
  steel: { n: 'Çelik Kılıç', t: 'weapon', atk: 12, c: '#6f6', d: 'ATK +12', icon: '/' },
  silver: { n: 'Kutsanmış Gümüş Kılıç', t: 'weapon', atk: 16, c: '#ddf', d: 'ATK +16', icon: '/' },
  moon: { n: 'Ay Çeliği Kılıcı', t: 'weapon', atk: 22, c: '#6ff', d: 'ATK +22', icon: '/' },
  gamb: { n: 'Kapitone Zırh', t: 'armor', def: 2, c: '#9cf', d: 'DEF +2', icon: '#' },
  chain: { n: 'Zincir Zırh', t: 'armor', def: 5, c: '#6f6', d: 'DEF +5', icon: '#' },
  plate: { n: 'Plaka Zırh', t: 'armor', def: 9, c: '#fd6', d: 'DEF +9', icon: '#' },
  moonp: { n: 'Ay Çeliği Zırh', t: 'armor', def: 14, c: '#6ff', d: 'DEF +14', icon: '#' }
};
export const need = l => 50 * l, maxHpFor = l => 100 + 20 * (l - 1), dmgFor = l => 9 + 3 * l;
export const atkBonus = () => (ITEMS[S.eq.weapon] || {}).atk || 0, defBonus = () => (ITEMS[S.eq.armor] || {}).def || 0;
export function giveItem(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; toast('Eşya: ' + ITEMS[id].n + (n > 1 ? ' x' + n : '')); renderInv(); }
export function rollDrop(kind, lvl) {
  if (kind === 'widow') { giveItem('plate'); giveItem('pot', 2); return; }
  if (kind === 'dragon') { giveItem('pot', 5); return; }
  if (kind === 'troll') { giveItem('pot', 3); if (Math.random() < .5) giveItem('plate'); return; }
  if (kind === 'witch' && Math.random() < .3) { giveItem('pot'); return; }
  if (kind === 'dknight' && Math.random() < .35) { giveItem(Math.random() < .5 ? 'chain' : 'steel'); return; }
  const r = Math.random();
  if (r < .22) giveItem('pot');
  else if (r < (kind === 'wolf' ? .34 : .29)) {
    const pool = lvl < 3 ? ['gamb', 'iron'] : lvl < 6 ? ['iron', 'chain', 'steel'] : ['steel', 'chain', 'plate'];
    giveItem(pool[Math.floor(Math.random() * pool.length)]);
  }
}
export function usePotion() {
  if (!S.inv.pot || P.hp >= P.maxhp || P.dead) return;
  S.inv.pot--; if (!S.inv.pot) delete S.inv.pot; P.hp = Math.min(P.maxhp, P.hp + ITEMS.pot.heal);
  floatText('+' + ITEMS.pot.heal, P.x, P.y + 2.8, P.z, 'heal'); renderInv();
}
let invList = [];
export const invOpen = () => !$('inv').hidden;
export function toggleInv() { $('inv').hidden = !$('inv').hidden; renderInv(); }
export function renderInv() {
  invList = Object.keys(S.inv).filter(id => S.inv[id] > 0 && ITEMS[id]).slice(0, 9);
  const w = ITEMS[S.eq.weapon], a = ITEMS[S.eq.armor];
  let h = '<b>ENVANTER</b>  ATK ' + (dmgFor(S.lvl) + atkBonus()) + '  DEF ' + defBonus() + '<br>Silah: <span style="color:' + (w ? w.c : '#888') + '">' + (w ? w.n : '-') + '</span><br>Zırh: <span style="color:' + (a ? a.c : '#888') + '">' + (a ? a.n : '-') + '</span><br>';
  invList.forEach((id, i) => { const it = ITEMS[id]; h += '[' + (i + 1) + '] <span style="color:' + it.c + '">' + it.n + '</span> x' + S.inv[id] + ' <small>' + it.d + (it.t === 'use' ? ' (kullan)' : ' (kuşan)') + '</small><br>'; });
  if (!invList.length) h += '<small>Boş</small><br>';
  $('inv').innerHTML = h + '<small>Numara: kullan/kuşan · I: kapat</small>';
}
export function invPress(n) {
  const id = invList[n - 1]; if (!id) return; const it = ITEMS[id];
  if (it.t === 'use') usePotion();
  else { const slot = it.t; const old = S.eq[slot]; S.eq[slot] = id; if (old && old !== id) S.inv[old] = (S.inv[old] || 0) + 1; S.inv[id]--; if (!S.inv[id]) delete S.inv[id]; toast('Kuşanıldı: ' + it.n); }
  renderInv();
}

/* ================= görevler ================= */
export const Q = [
  { id: 'skel', giver: 'mira', title: 'Kale Harabeleri', obj: 'slay', kind: 'skeleton', n: 6, xp: 80, gold: 40, item: ['chain'],
    offer: 'Kuzeydeki eski kalede ölüler yeniden ayaklandı. Senje, 6 iskelet savaşçıyı toprağa geri gönder.',
    hint: 'Köyden kuzeye uzanan taş yolu izle; kale kapısında meşaleler yanıyor.', done: 'Kalenin sessizliği geri döndü. Bu zinciri hak ettin.' },
  { id: 'wolves', giver: 'brant', title: 'Kurt Sürüsü', obj: 'slay', kind: 'wolf', n: 4, xp: 90, gold: 60, item: ['iron'],
    offer: 'Ormanda bir kurt sürüsü dolaşıyor. 4 tanesini avlarsan köy rahat uyur.',
    hint: 'Sık ağaçlıklı ormanlarda kurtları ara. Hızlılar; yuvarlanmayı unutma (Boşluk).', done: 'Güzel av! Bu kılıç artık senin.' },
  { id: 'shards', giver: 'lyra', title: 'Ay Kristalleri', obj: 'collect', n: 3, xp: 80, gold: 50, item: ['pot', 3],
    offer: 'Gökten düşen Ay Kristalleri vahşi doğada parlıyor. 3 tanesini bana getirir misin?',
    hint: 'Gökyüzüne uzanan ince mavi ışıkları takip et.', done: 'Harika! Bu kristallerde eski bir güç var. Al, iksirler senin.' },
  { id: 'widow', giver: 'brant', title: 'Alacakaranlık Dulu', obj: 'slay', kind: 'widow', n: 1, xp: 400, gold: 150, item: ['steel'], req: ['wolves'],
    offer: 'Batı ormanında dev bir örümcek yuvalanmış. Beyaz ağlarını göreceksin. Onu öldür, Senje.',
    hint: 'Batıdaki ormanda beyaz ağları ara. Yerde turuncu daire belirirse hemen Boşluk ile kaç!', done: 'Yaratık öldü ha? Efsane olacaksın. Bu çelik kılıcı al.' },
  { id: 'circle', giver: 'mira', title: 'Taş Çember', obj: 'reach', n: 1, xp: 250, gold: 150, item: ['moonp'], req: ['skel', 'shards', 'widow'],
    offer: 'Artık hazırsın. Kuzeydoğuda eski şövalyelerin yemin ettiği Taş Çember var. Oraya git.',
    hint: 'Gökyüzüne uzanan altın sütuna doğru yürü.', done: 'Çemberi gördün... Şövalye yemini artık senin, Senje. Bu zırh seni korusun.' },
  { id: 'dragon', giver: 'mira', title: 'Kül Ejderhası', obj: 'slay', kind: 'dragon', n: 1, xp: 1200, gold: 500, item: ['moon'], req: ['circle'],
    offer: 'Kuzeybatı dağlarının eteğinde kadim bir ejderha uyandı. Yemin ettin, Senje; köyü ondan ancak sen koruyabilirsin.',
    hint: 'Kuzeybatıdaki yanık topraklara git. Ateş nefesinden önce yerde sıra sıra turuncu daireler belirir; yana yuvarlan (C)!', done: 'Ejderha düştü... Ozanlar bu geceyi yüz yıl anlatacak. Al, Ay Çeliği Kılıcı artık senin.' },
  { id: 'ghouls', giver: 'osric', title: 'Mezarlıktan Kalkanlar', obj: 'slay', kind: 'ghoul', n: 8, xp: 220, gold: 90, item: ['silver'],
    offer: 'Şapelin mezarlığı huzursuz, evlat. Hortlaklar topraktan çıkıp bataklığa yayıldı. 8 tanesini sonsuz uykusuna gönder.',
    hint: 'Doğudaki yıkık şapelin batısındaki mezarlık. Hortlaklar uzaktan üstüne atılır; atılmadan yana çekil.', done: 'Tanrı ruhlarına huzur versin. Bu kutsanmış gümüş kılıç ölülere karşı keskindir.' },
  { id: 'witches', giver: 'osric', title: 'Sisteki Cadılar', obj: 'slay', kind: 'witch', n: 3, xp: 260, gold: 120, item: ['pot', 4],
    offer: 'Sisin içinde yeşil ışıklar görürsen, cadılar orada demektir. Uzaktan lanet fırlatırlar. 3 tanesini sustur.',
    hint: 'Yeşil büyü toplarından zıplayarak (Boşluk) ya da yuvarlanarak (C) kaç, sonra üstlerine koş.', done: 'Sis biraz incelmiş gibi... Al, bu iksirler yoluna ışık olsun.' },
  { id: 'troll', giver: 'osric', title: 'Bataklık Trolü', obj: 'slay', kind: 'troll', n: 1, xp: 480, gold: 200, item: ['plate'], req: ['ghouls'],
    offer: 'Şapelin önündeki bataklıkta dev bir trol yaşıyor. Hacıların yolunu kesiyor. Gücün yeterse onu indir.',
    hint: 'Trol yere çakmadan önce turuncu daire belirir. Sabırlı ol, arkasından vur.', done: 'Trolü mü devirdin? Bu zırh bir zamanlar bir tapınak şövalyesinindi; artık senin.' }
];
const qById = {}; Q.forEach(q => { q.st = 0; qById[q.id] = q; });
export function progress(q) { return q.obj === 'slay' ? Math.min(q.n, S.kills[q.kind] || 0) : q.obj === 'collect' ? Math.min(q.n, S.shards) : (S.circle ? 1 : 0); }
export function checkQuests() { Q.forEach(q => { if (q.st === 1 && progress(q) >= q.n) { q.st = 2; toast('Görev tamam: ' + q.title + ' — ödül için dön'); } }); }
export function addXP(v) {
  S.xp += v;
  while (S.xp >= need(S.lvl)) { S.xp -= need(S.lvl); S.lvl++; P.maxhp = maxHpFor(S.lvl); P.hp = P.maxhp; toast('SEVİYE ATLADIN! Sv.' + S.lvl); }
}
function turnIn(q) {
  q.st = 3; if (q.item) giveItem(q.item[0], q.item[1] || 1); addXP(q.xp); S.gold += q.gold; toast('Ödül: +' + q.xp + ' XP, +' + q.gold + ' altın');
  if (q.id === 'circle') setTimeout(() => toast('Başlangıç görevleri tamam! Dünya açık.'), 1800);
}
const questsFor = n => Q.filter(q => q.giver === n.id && q.st < 3 && (!q.req || q.req.every(id => qById[id].st === 3)));
export function npcMark(n) { const qs = questsFor(n); return qs.some(q => q.st === 2) ? ' [?]' : qs.some(q => q.st === 0) ? ' [!]' : ''; }

/* ================= diyalog ================= */
let dialog = null;
export function closeDialog() { dialog = null; $('dialog').hidden = true; }
export function interact(npc) {
  if (dialog && dialog.npc === npc) {
    const q = dialog.q;
    if (q) { if (q.st === 0) { q.st = 1; toast('Görev alındı: ' + q.title); checkQuests(); } else if (q.st === 2) turnIn(q); }
    closeDialog(); return;
  }
  const qs = questsFor(npc), q = qs.find(x => x.st === 2) || qs[0]; let text;
  if (!q) text = npc.idle[Math.floor(Math.random() * npc.idle.length)];
  else if (q.st === 0) text = q.offer + '\n<i>[E] Kabul et</i>';
  else if (q.st === 1) text = q.hint + ' (' + progress(q) + '/' + q.n + ')';
  else text = q.done + '\n<i>[E] Ödülü al</i>';
  dialog = { npc, q }; const d = $('dialog'); d.innerHTML = '<b>' + npc.name + '</b>' + (q ? ' — ' + q.title : '') + '<br>' + text.replace(/\n/g, '<br>'); d.hidden = false;
}

/* ================= kayıt ================= */
export function save() { try { S.x = P.x; S.z = P.z; S.dayT = ENV.dayT; S.q = {}; Q.forEach(q => S.q[q.id] = q.st); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function resetSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } S = freshState(); Q.forEach(q => q.st = 0); }
export function load() {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!j) return false;
    S = Object.assign(freshState(), j); Q.forEach(q => q.st = (S.q && S.q[q.id]) || 0);
    P.x = S.x; P.z = S.z; ENV.dayT = S.dayT ?? .3;
    S.taken.forEach(id => { const c = crystals[id]; if (c) { c.taken = true; c.mesh.visible = false; } });
    return true;
  } catch (e) { return false; }
}
export function applyState() { resetPlayer(); P.y = heightAt(P.x, P.z); }

/* ================= arayüz ================= */
export function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('toasts').appendChild(d); setTimeout(() => d.remove(), 4000); }
const _v = new THREE.Vector3();
export function floatText(text, x, y, z, cls) {
  _v.set(x, y, z).project(camera); if (_v.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg ' + (cls || ''); d.textContent = text;
  d.style.left = ((_v.x * .5 + .5) * innerWidth) + 'px'; d.style.top = ((-_v.y * .5 + .5) * innerHeight) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
const labelPool = []; let labelUsed = 0;
export function beginLabels() { labelUsed = 0; }
export function endLabels() { for (let i = labelUsed; i < labelPool.length; i++) labelPool[i].el.style.display = 'none'; }
export function label(text, x, y, z, cls, frac) {
  let L = labelPool[labelUsed];
  if (!L) {
    const el = document.createElement('div'), t = document.createElement('span'), b = document.createElement('div'), f = document.createElement('i');
    b.className = 'hb'; b.appendChild(f); el.append(t, b); $('labels').appendChild(el); L = { el, t, b, f, _t: '', _c: '' }; labelPool.push(L);
  }
  labelUsed++;
  _v.set(x, y, z).project(camera);
  if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { L.el.style.display = 'none'; return; }
  L.el.style.display = 'block';
  if (L._t !== text) { L.t.textContent = text; L._t = text; }
  if (L._c !== cls) { L.el.className = 'lbl ' + cls; L._c = cls; }
  if (frac == null) L.b.style.display = 'none'; else { L.b.style.display = 'block'; L.f.style.width = (clamp(frac, 0, 1) * 100).toFixed(0) + '%'; }
  L.el.style.transform = 'translate(' + ((_v.x * .5 + .5) * innerWidth).toFixed(0) + 'px,' + ((-_v.y * .5 + .5) * innerHeight).toFixed(0) + 'px) translate(-50%,-100%)';
}

const SLOTS = [{ k: '1', n: 'Kılıç', i: '/', cd: 'slash' }, { k: '2', n: 'Ateş Topu', i: '*', cd: 'fire' }, { k: '3', n: 'Kasırga', i: '@', cd: 'whirl' }, { k: '4', n: 'İksir', i: '!', pot: true }];
let slotEls = [];
export function buildHotbar() {
  const box = $('slots'); box.innerHTML = ''; slotEls = [];
  for (let i = 0; i < 10; i++) {
    const s = SLOTS[i], d = document.createElement('div');
    d.innerHTML = '<em>' + ((i + 1) % 10) + '</em>' + (s ? '<b>' + s.i + '</b><small>' + s.n + '</small><u></u>' : '');
    box.appendChild(d); slotEls.push(d);
  }
}
export const toggleMini = () => { $('mini').hidden = !$('mini').hidden; };
export const toggleHelp = () => { $('help').hidden = !$('help').hidden; };
let hudT = 0, miniT = 0, region = '', regionT = 0;
export function showRegion(name) {
  if (name === region) return; region = name; const el = $('region'); el.textContent = '— ' + name + ' —';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
export function updateHUD(dt) {
  const near = NPCS.find(n => Math.hypot(n.x - P.x, n.z - P.z) < 4);
  $('prompt').textContent = (near && !dialog && !P.dead) ? '[E] ' + near.name + ' ile konuş' : '';
  if (dialog && Math.hypot(dialog.npc.x - P.x, dialog.npc.z - P.z) > 6) closeDialog();
  miniT -= dt; if (miniT <= 0 && !$('mini').hidden) { miniT = .25; updateMini(); }
  hudT -= dt; if (hudT > 0) return; hudT = .1;
  const hr = ENV.dayT * 24, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
  $('info').textContent = 'Senje · Sv.' + S.lvl + '   Altın ' + S.gold + '   Kristal ' + S.shards + '   ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  let qt = ''; Q.forEach(q => {
    if (q.st !== 1 && q.st !== 2) return;
    qt += '> ' + q.title + (q.st === 2 ? '  (teslim et)' : '  ' + progress(q) + '/' + q.n);
    if (q.id === 'circle' && q.st === 1) { const dx = CIRCLE.x - P.x, dz = CIRCLE.z - P.z, ang = Math.atan2(dx, -dz), dirs = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB']; qt += ' [' + Math.round(Math.hypot(dx, dz)) + 'm ' + dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8] + ']'; }
    qt += '\n';
  });
  $('quests').textContent = qt || 'Köydekilerle konuş (E)';
  $('hpfill').style.width = (P.hp / P.maxhp * 100) + '%'; $('hptxt').textContent = Math.ceil(P.hp) + ' / ' + P.maxhp + ' HP';
  $('xpfill').style.width = (S.xp / need(S.lvl) * 100) + '%'; $('xptxt').textContent = 'LV ' + S.lvl + ' · ' + S.xp + ' / ' + need(S.lvl) + ' XP';
  SLOTS.forEach((s, i) => {
    const el = slotEls[i]; if (!el) return; const u = el.querySelector('u');
    if (s.cd) u.style.height = (CD[s.cd] / CDMAX[s.cd] * 100) + '%';
    if (s.pot) el.querySelector('small').textContent = 'İksir x' + (S.inv.pot || 0);
  });
  const boss = enemies.find(e => e.k.boss && !e.dead && Math.hypot(e.x - P.x, e.z - P.z) < 45);
  const t = boss || (TGT.e && !TGT.e.dead && Math.hypot(TGT.e.x - P.x, TGT.e.z - P.z) < 30 ? TGT.e : null);
  $('target').hidden = !t;
  if (t) {
    $('target').className = t.k.boss ? 'boss' : '';
    $('tName').textContent = t.k.boss ? t.k.name : t.k.name + ' ' + Math.max(0, Math.ceil(t.hp)) + '/' + t.hpMax;
    $('tFill').style.width = Math.max(0, t.hp / t.hpMax * 100) + '%';
  }
}
function updateMini() {
  const C = 41, R = 21, cx = 4, cz = 7, rows = [];
  for (let j = 0; j < R; j++) {
    const r = [];
    for (let i = 0; i < C; i++) {
      const x = P.x + (i - (C >> 1)) * cx, z = P.z + (j - (R >> 1)) * cz; let ch;
      if (Math.abs(x) > 200 || Math.abs(z) > 200) ch = ' ';
      else if (Math.hypot(x, z) < 18) ch = '#';
      else { const h = heightAt(x, z); ch = h < -4.2 ? '~' : h > 13 ? '^' : '.'; }
      r.push(ch);
    }
    rows.push(r);
  }
  const put = (x, z, c) => { const i = Math.round((x - P.x) / cx) + (C >> 1), j = Math.round((z - P.z) / cz) + (R >> 1); if (i >= 0 && i < C && j >= 0 && j < R) rows[j][i] = c; };
  put(CIRCLE.x, CIRCLE.z, 'O'); crystals.forEach(c => { if (!c.taken) put(c.x, c.z, '*'); }); NPCS.forEach(n => put(n.x, n.z, 'N'));
  enemies.forEach(e => { if (!e.dead) put(e.x, e.z, e.k.boss ? 'B' : 'x'); }); put(P.x, P.z, '@');
  $('minimap').textContent = rows.map(r => r.join('')).join('\n');
}
