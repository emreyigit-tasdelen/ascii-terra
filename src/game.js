// Game state, items, quests, dialogue, saving and HUD
import { THREE, $, clamp, heightAt, MID, basic } from './core.js';
import { camera, scene, ENV } from './render.js';
import { burst } from './fx.js';
import { sfx } from './audio.js';
import { crystals, CIRCLE } from './world.js';
import { P, NPCS, enemies, CD, CDMAX, TGT, resetPlayer } from './actors.js';
import { NET, sendNet } from './net.js';
import { partyQuest } from './party.js';

const SAVE_KEY = 'asciiTerra2';
export let S = freshState();
function freshState() { return { lvl: 1, xp: 0, gold: 0, kills: {}, shards: 0, circle: false, taken: [], q: {}, inv: { pot: 3 }, eq: { weapon: 'rust', armor: null }, x: 0, z: 14, dayT: .3, sens: 1 }; }

/* ================= items ================= */
export const ITEMS = {
  pot: { n: 'Healing Potion', t: 'use', heal: 60, c: '#f77', d: '+60 HP', icon: '!' },
  rust: { n: 'Rusty Sword', t: 'weapon', atk: 0, c: '#aaa', d: 'ATK +0', icon: '/' },
  iron: { n: 'Iron Sword', t: 'weapon', atk: 6, c: '#9cf', d: 'ATK +6', icon: '/' },
  steel: { n: 'Steel Sword', t: 'weapon', atk: 12, c: '#6f6', d: 'ATK +12', icon: '/' },
  silver: { n: 'Blessed Silver Sword', t: 'weapon', atk: 16, c: '#ddf', d: 'ATK +16', icon: '/' },
  moon: { n: 'Moonsteel Sword', t: 'weapon', atk: 22, c: '#6ff', d: 'ATK +22', icon: '/' },
  gamb: { n: 'Gambeson', t: 'armor', def: 2, c: '#9cf', d: 'DEF +2', icon: '#' },
  chain: { n: 'Chainmail', t: 'armor', def: 5, c: '#6f6', d: 'DEF +5', icon: '#' },
  plate: { n: 'Plate Armor', t: 'armor', def: 9, c: '#fd6', d: 'DEF +9', icon: '#' },
  moonp: { n: 'Moonsteel Armor', t: 'armor', def: 14, c: '#6ff', d: 'DEF +14', icon: '#' }
};
export const need = l => 50 * l, maxHpFor = l => 100 + 20 * (l - 1), dmgFor = l => 9 + 3 * l;
export const atkBonus = () => (ITEMS[S.eq.weapon] || {}).atk || 0, defBonus = () => (ITEMS[S.eq.armor] || {}).def || 0;
export function giveItem(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; toast('Item: ' + ITEMS[id].n + (n > 1 ? ' x' + n : '')); renderInv(); }
// Kills drop their items on the ground at (x, z): a glinting gem in a star of rays with a name label; walk over it to pick it up
export function rollDrop(kind, lvl, x, z) {
  const drop = (id, n = 1) => dropLoot(id, n, x, z);
  if (kind === 'widow') { drop('plate'); drop('pot', 2); return; }
  if (kind === 'dragon') { drop('pot', 5); return; }
  if (kind === 'troll') { drop('pot', 3); if (Math.random() < .5) drop('plate'); return; }
  if (kind === 'witch' && Math.random() < .3) { drop('pot'); return; }
  if (kind === 'dknight' && Math.random() < .35) { drop(Math.random() < .5 ? 'chain' : 'steel'); return; }
  const r = Math.random();
  if (r < .22) drop('pot');
  else if (r < (kind === 'wolf' ? .34 : .29)) {
    const pool = lvl < 3 ? ['gamb', 'iron'] : lvl < 6 ? ['iron', 'chain', 'steel'] : ['steel', 'chain', 'plate'];
    drop(pool[Math.floor(Math.random() * pool.length)]);
  }
}
const loot = [], lootMats = {}, gemG = new THREE.OctahedronGeometry(.2, 0), rayG = new THREE.BoxGeometry(1, .03, .035);
export function dropLoot(id, n, x, z, restored = false) {   // restored: loaded from a save, exact spot, no effects
  if (!restored) { const a = Math.random() * 6.283, d = .9 + Math.random() * 1.5; x += Math.cos(a) * d; z += Math.sin(a) * d; }
  const mat = lootMats[id] || (lootMats[id] = basic(new THREE.Color(ITEMS[id].c).getHex(), MID.GLOW)), g = new THREE.Group(), gem = new THREE.Mesh(gemG, mat);
  gem.position.y = .45; g.add(gem);
  for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(rayG, mat), b = i / 7 * 6.283 + Math.random() * .5, l = .4 + Math.random() * .6; r.scale.x = l; r.position.set(Math.cos(b) * (.35 + l / 2), .05, Math.sin(b) * (.35 + l / 2)); r.rotation.y = -b; g.add(r); }
  g.position.set(x, heightAt(x, z), z); scene.add(g);
  loot.push({ id, n, x, z, g, gem, t: 0 }); if (!restored) { burst('loot', x, g.position.y + .3, z, 14); sfx('drop'); }
}
function takeLoot(L, quiet) { scene.remove(L.g); loot.splice(loot.indexOf(L), 1); giveItem(L.id, L.n); if (!quiet) { burst('loot', L.x, L.g.position.y + .5, L.z, 10); sfx('pick'); } }
const LOOT_KEEP = 60;   // ground loot is saved; anything beyond this is picked up automatically so nothing is lost
export function updateLoot(dt) {
  for (let i = loot.length - 1; i >= 0; i--) {
    const L = loot[i], it = ITEMS[L.id]; L.t += dt;
    L.gem.rotation.y += dt * 2.5; L.gem.position.y = .45 + Math.sin(L.t * 3) * .08; L.g.rotation.y += dt * .4;
    if (Math.random() < dt * 3) burst('loot', L.x, L.g.position.y + .2, L.z, 1);
    label(it.n + (L.n > 1 ? ' x' + L.n : ''), L.x, L.g.position.y + 1.1, L.z, 'loot', null, it.c);
    if (L.t > .5 && !P.dead && Math.hypot(P.x - L.x, P.z - L.z) < 1.7) takeLoot(L);
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
  let h = '<b>INVENTORY</b>  ATK ' + (dmgFor(S.lvl) + atkBonus()) + '  DEF ' + defBonus() + '<br>Weapon: <span style="color:' + (w ? w.c : '#888') + '">' + (w ? w.n : '-') + '</span><br>Armor: <span style="color:' + (a ? a.c : '#888') + '">' + (a ? a.n : '-') + '</span><br>';
  invList.forEach((id, i) => { const it = ITEMS[id]; h += '[' + (i + 1) + '] <span style="color:' + it.c + '">' + it.n + '</span> x' + S.inv[id] + ' <small>' + it.d + (it.t === 'use' ? ' (use)' : ' (equip)') + '</small><br>'; });
  if (!invList.length) h += '<small>Empty</small><br>';
  $('inv').innerHTML = h + '<small>Number: use/equip · I: close</small>';
}
export function invPress(n) {
  const id = invList[n - 1]; if (!id) return; const it = ITEMS[id];
  if (it.t === 'use') usePotion();
  else { const slot = it.t; const old = S.eq[slot]; S.eq[slot] = id; if (old && old !== id) S.inv[old] = (S.inv[old] || 0) + 1; S.inv[id]--; if (!S.inv[id]) delete S.inv[id]; toast('Equipped: ' + it.n); }
  renderInv();
}

/* ================= quests ================= */
export const Q = [
  { id: 'skel', giver: 'mira', title: 'Castle Ruins', obj: 'slay', kind: 'skeleton', n: 6, xp: 80, gold: 40, item: ['chain'],
    offer: 'The dead have risen again in the old castle to the north. Torvan, send 6 skeleton warriors back to the earth.',
    hint: 'Follow the stone road north from the village; torches burn at the castle gate.', done: 'Silence has returned to the castle. You have earned this mail.' },
  { id: 'wolves', giver: 'brant', title: 'The Wolf Pack', obj: 'slay', kind: 'wolf', n: 4, xp: 90, gold: 60, item: ['iron'],
    offer: 'A wolf pack roams the forest. Hunt 4 of them and the village will sleep soundly.',
    hint: 'Look for wolves in the dense forests. They are fast; remember to roll (C).', done: 'Fine hunting! This sword is yours now.' },
  { id: 'shards', giver: 'lyra', title: 'Moon Shards', obj: 'collect', n: 3, xp: 80, gold: 50, item: ['pot', 3],
    offer: 'Moon Shards fallen from the sky glow out in the wilds. Will you bring me 3 of them?',
    hint: 'Follow the thin blue lights reaching into the sky.', done: 'Wonderful! There is an old power in these shards. Here, the potions are yours.' },
  { id: 'widow', giver: 'brant', title: 'The Gloomweaver', obj: 'slay', kind: 'widow', n: 1, xp: 400, gold: 150, item: ['steel'], req: ['wolves'],
    offer: 'A giant spider has nested in the western forest. You will see its white webs. Kill it, Torvan.',
    hint: 'Look for white webs in the western forest. If an orange circle appears on the ground, get out of it at once!', done: 'The beast is dead? You will be a legend. Take this steel sword.' },
  { id: 'circle', giver: 'mira', title: 'The Stone Circle', obj: 'reach', n: 1, xp: 250, gold: 150, item: ['moonp'], req: ['skel', 'shards', 'widow'],
    offer: 'You are ready now. In the northeast lies the Stone Circle where knights of old swore their oaths. Go there.',
    hint: 'Walk toward the golden pillar reaching into the sky.', done: 'You have seen the circle... The knight oath is yours now, Torvan. May this armor protect you.' },
  { id: 'dragon', giver: 'mira', title: 'The Ash Dragon', obj: 'slay', kind: 'dragon', n: 1, xp: 1200, gold: 500, item: ['moon'], req: ['circle'],
    offer: 'An ancient dragon has woken at the foot of the northwest mountains. You swore the oath, Torvan; only you can protect the village from it.',
    hint: 'Go to the burnt lands in the northwest. Before its fire breath, rows of orange circles appear on the ground; roll aside (C)!', done: 'The dragon has fallen... Bards will sing of this night for a hundred years. Here, the Moonsteel Sword is yours.' },
  { id: 'ghouls', giver: 'osric', title: 'Risen from the Graves', obj: 'slay', kind: 'ghoul', n: 8, xp: 220, gold: 90, item: ['silver'],
    offer: 'The chapel graveyard is restless, child. Ghouls have crawled from the earth and spread into the swamp. Send 8 of them to eternal sleep.',
    hint: 'The graveyard west of the ruined chapel in the east. Ghouls leap at you from afar; step aside before they pounce.', done: 'May their souls rest in peace. This blessed silver sword cuts deep against the dead.' },
  { id: 'witches', giver: 'osric', title: 'Witches in the Mist', obj: 'slay', kind: 'witch', n: 3, xp: 260, gold: 120, item: ['pot', 4],
    offer: 'If you see green lights in the mist, the witches are there. They hurl curses from afar. Silence 3 of them.',
    hint: 'Dodge the green hexes by jumping (Space) or rolling (C), then charge them.', done: 'The mist seems a little thinner... Here, may these potions light your way.' },
  { id: 'troll', giver: 'osric', title: 'The Swamp Troll', obj: 'slay', kind: 'troll', n: 1, xp: 480, gold: 200, item: ['plate'], req: ['ghouls'],
    offer: 'A giant troll lives in the swamp before the chapel. It blocks the pilgrim road. Bring it down if you are strong enough.',
    hint: 'An orange circle appears before the troll slams the ground. Be patient and strike from behind.', done: 'You felled the troll? This armor once belonged to a temple knight; now it is yours.' }
];
const qById = {}; Q.forEach(q => { q.st = 0; qById[q.id] = q; });
export function progress(q) { return q.obj === 'slay' ? Math.min(q.n, S.kills[q.kind] || 0) : q.obj === 'collect' ? Math.min(q.n, S.shards) : (S.circle ? 1 : 0); }
export function checkQuests() { Q.forEach(q => { if (q.st === 1 && progress(q) >= q.n) { q.st = 2; sfx('quest'); toast('Quest complete: ' + q.title + ' — return for your reward'); } }); }
/* party: a kill by a member standing near counts for this player's quests too */
export function partyKill(kind) { if (typeof kind !== 'string' || !Q.some(q => q.kind === kind)) return; S.kills[kind] = (S.kills[kind] || 0) + 1; checkQuests(); }
/* party: the leader accepted a quest; take it too when it is still open here */
export function takeQuest(id) {
  const q = qById[id]; if (!q || q.st !== 0 || (q.req && !q.req.every(r => qById[r].st === 3))) return;
  q.st = 1; toast('Party quest: ' + q.title); checkQuests();
}
export function addXP(v) {
  S.xp += v;
  while (S.xp >= need(S.lvl)) { S.xp -= need(S.lvl); S.lvl++; P.maxhp = maxHpFor(S.lvl); P.hp = P.maxhp; sfx('level'); toast('LEVEL UP! Lv.' + S.lvl); }
}
function turnIn(q) {
  q.st = 3; sfx('quest'); if (q.item) giveItem(q.item[0], q.item[1] || 1); addXP(q.xp); S.gold += q.gold; toast('Reward: +' + q.xp + ' XP, +' + q.gold + ' gold');
  if (q.id === 'circle') setTimeout(() => toast('Starting quests done! The world is open.'), 1800);
}
const questsFor = n => Q.filter(q => q.giver === n.id && q.st < 3 && (!q.req || q.req.every(id => qById[id].st === 3)));
export function npcMark(n) { const qs = questsFor(n); return qs.some(q => q.st === 2) ? ' [?]' : qs.some(q => q.st === 0) ? ' [!]' : ''; }

/* ================= dialogue ================= */
let dialog = null;
export function closeDialog() { dialog = null; $('dialog').hidden = true; }
export function interact(npc) {
  if (dialog && dialog.npc === npc) {
    const q = dialog.q;
    if (q) { if (q.st === 0) { q.st = 1; toast('Quest accepted: ' + q.title); checkQuests(); partyQuest(q.id); } else if (q.st === 2) turnIn(q); }
    closeDialog(); return;
  }
  const qs = questsFor(npc), q = qs.find(x => x.st === 2) || qs[0]; let text;
  if (!q) text = npc.idle[Math.floor(Math.random() * npc.idle.length)];
  else if (q.st === 0) text = q.offer + '\n<i>[E] Accept</i>';
  else if (q.st === 1) text = q.hint + ' (' + progress(q) + '/' + q.n + ')';
  else text = q.done + '\n<i>[E] Claim reward</i>';
  dialog = { npc, q }; const d = $('dialog'); d.innerHTML = '<b>' + npc.name + '</b>' + (q ? ' — ' + q.title : '') + '<br>' + text.replace(/\n/g, '<br>'); d.hidden = false;
}

/* ================= saving ================= */
// Signed-in players save on the server (continue from any device); guests save in the browser
export function save() {
  while (loot.length > LOOT_KEEP) takeLoot(loot[0], true);
  S.loot = loot.map(L => [L.id, L.n, Math.round(L.x * 10) / 10, Math.round(L.z * 10) / 10]);
  S.x = P.x; S.z = P.z; S.dayT = ENV.dayT; S.q = {}; Q.forEach(q => S.q[q.id] = q.st);
  if (NET.account) { NET.accountSave = JSON.parse(JSON.stringify(S)); sendNet({ t: 'save', data: NET.accountSave }); return; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
}
export function hasSave() { if (NET.account) return !!NET.accountSave; try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function resetSave() {
  if (NET.account) NET.accountSave = null; else { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
  const sens = S.sens; S = freshState(); S.sens = sens; Q.forEach(q => q.st = 0);   // settings survive a reset
}
export function load() {
  try {
    const j = NET.account ? NET.accountSave : JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!j) return false;
    S = Object.assign(freshState(), j); Q.forEach(q => q.st = (S.q && S.q[q.id]) || 0);
    P.x = S.x; P.z = S.z; ENV.dayT = S.dayT ?? .3;
    S.taken.forEach(id => { const c = crystals[id]; if (c) { c.taken = true; c.mesh.visible = false; } });
    while (loot.length) { scene.remove(loot[0].g); loot.shift(); }   // ground loot comes back where it was left
    for (const r of (Array.isArray(S.loot) ? S.loot.slice(0, LOOT_KEEP) : [])) if (Array.isArray(r) && ITEMS[r[0]] && isFinite(r[2]) && isFinite(r[3])) dropLoot(r[0], Math.max(1, r[1] | 0), r[2], r[3], true);
    return true;
  } catch (e) { return false; }
}
export function applyState() { resetPlayer(); P.y = heightAt(P.x, P.z); }

/* ================= HUD ================= */
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
export function label(text, x, y, z, cls, frac, col) {
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
  if (L._col !== col) { L.t.style.color = col || ''; L._col = col; }
  if (frac == null) L.b.style.display = 'none'; else { L.b.style.display = 'block'; L.f.style.width = (clamp(frac, 0, 1) * 100).toFixed(0) + '%'; }
  L.el.style.transform = 'translate(' + ((_v.x * .5 + .5) * innerWidth).toFixed(0) + 'px,' + ((-_v.y * .5 + .5) * innerHeight).toFixed(0) + 'px) translate(-50%,-100%)';
}

const SLOTS = [{ k: '1', n: 'Sword', i: '/', cd: 'slash' }, { k: '2', n: 'Fireball', i: '*', cd: 'fire' }, { k: '3', n: 'Whirlwind', i: '@', cd: 'whirl' }, { k: '4', n: 'Potion', i: '!', pot: true }, { k: '5', n: 'Void Orb', i: 'O', cd: 'orb' }, { k: '6', n: 'Moon Lance', i: '|', cd: 'beam' }];
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
  $('prompt').textContent = (near && !dialog && !P.dead) ? '[E] Talk to ' + near.name : '';
  if (dialog && Math.hypot(dialog.npc.x - P.x, dialog.npc.z - P.z) > 6) closeDialog();
  miniT -= dt; if (miniT <= 0 && !$('mini').hidden) { miniT = .25; updateMini(); }
  hudT -= dt; if (hudT > 0) return; hudT = .1;
  const hr = ENV.dayT * 24, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
  $('info').textContent = 'Torvan · Lv.' + S.lvl + '   Gold ' + S.gold + '   Shards ' + S.shards + '   ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  let qt = ''; Q.forEach(q => {
    if (q.st !== 1 && q.st !== 2) return;
    qt += '> ' + q.title + (q.st === 2 ? '  (turn in)' : '  ' + progress(q) + '/' + q.n);
    if (q.id === 'circle' && q.st === 1) { const dx = CIRCLE.x - P.x, dz = CIRCLE.z - P.z, ang = Math.atan2(dx, -dz), dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; qt += ' [' + Math.round(Math.hypot(dx, dz)) + 'm ' + dirs[(Math.round(ang / (Math.PI / 4)) + 8) % 8] + ']'; }
    qt += '\n';
  });
  $('quests').textContent = qt || 'Talk to the villagers (E)';
  $('stfill').style.width = (P.st / P.stMax * 100) + '%';
  $('hpfill').style.width = (P.hp / P.maxhp * 100) + '%'; $('hptxt').textContent = Math.ceil(P.hp) + ' / ' + P.maxhp + ' HP';
  $('xpfill').style.width = (S.xp / need(S.lvl) * 100) + '%'; $('xptxt').textContent = 'LV ' + S.lvl + ' · ' + S.xp + ' / ' + need(S.lvl) + ' XP';
  SLOTS.forEach((s, i) => {
    const el = slotEls[i]; if (!el) return; const u = el.querySelector('u');
    if (s.cd) u.style.height = (CD[s.cd] / CDMAX[s.cd] * 100) + '%';
    if (s.pot) el.querySelector('small').textContent = 'Potion x' + (S.inv.pot || 0);
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
