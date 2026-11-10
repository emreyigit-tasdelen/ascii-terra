// Weapon crafting: blade metal + up to 3 runes. Opened with K. The preview is an ASCII sword drawn
// with the metal's own glyphs; runes add their glyph into the blade. Bonuses apply to every sword hit.
import { $ } from './core.js';
import { S, toast } from './game.js';

export const METALS = {
  forged: { n: 'As forged', g: '#%:', c: '#9a9a9a', d: 'Plain blade.', atk: 0 },
  iron: { n: 'Iron', g: '#%:', c: '#a8a8a8', d: 'Grey, heavy, honest.', atk: 2 },
  steel: { n: 'Steel', g: '@%', c: '#cfe3ff', d: 'Hard and clean. +5 ATK', atk: 5 },
  bronze: { n: 'Bronze', g: '&o', c: '#d8964a', d: 'Warm and tough. +3 ATK, +5% crit', atk: 3, crit: .05 },
  silver: { n: 'Silver', g: '$s', c: '#eef2ff', d: '+3 ATK, +30% vs the undead', atk: 3, undead: .3 },
  gold: { n: 'Gold', g: '0o', c: '#ffd65a', d: 'Soft but rich. +1 ATK, +25% gold', atk: 1, gold: .25 },
  moon: { n: 'Moonsteel', g: 'O*-', c: '#7ff3ff', d: 'Light from the sky. +8 ATK', atk: 8 },
  night: { n: 'Nightglass', g: 'N/', c: '#9a7bff', d: '+4 ATK, +10% crit, +30% crit damage', atk: 4, crit: .1, critDmg: .3 },
  blood: { n: 'Bloodiron', g: '88', c: '#ff3b4e', d: '+5 ATK, 4% of damage leeched as life', atk: 5, leech: .04 },
  ossite: { n: 'Ossite', g: '=-.', c: '#e8dcc0', d: 'Bone-metal. +6 ATK vs beasts', atk: 2, beast: 4 },
  ember: { n: 'Emberstone', g: '*-.', c: '#ff8a2a', d: '+3 ATK, 12% of damage added as fire', atk: 3, fire: .12 }
};
export const RUNES = {
  '+': { c: '#ffffff', d: '+6% damage', dmg: .06 },
  '^': { c: '#ff5a5a', d: '+5% critical chance', crit: .05 },
  '*': { c: '#ffe27a', d: '+20% critical damage', critDmg: .2 },
  'z': { c: '#fff27a', d: '12% of damage added as lightning', bolt: .12 },
  '~': { c: '#ff4060', d: '2% of damage leeched as life', leech: .02 },
  '>': { c: '#7affc0', d: '+8% damage while running', run: .08 },
  '/': { c: '#c0c8ff', d: '+4% damage, +2% crit', dmg: .04, crit: .02 },
  'x': { c: '#c46bff', d: '+10% damage against bosses', boss: .1 },
  'v': { c: '#6bff6b', d: '+10% damage against beasts', beastPct: .1 },
  'o': { c: '#9fe8ff', d: '8% of damage added as cold', cold: .08 }
};

const SAVEKEY = 'craft';
export function craftState() { return S[SAVEKEY] || (S[SAVEKEY] = { metal: 'forged', runes: [] }); }

/* summed bonuses of the current blade */
export function craftMods() {
  const st = craftState(), m = METALS[st.metal] || METALS.forged, o = { atk: m.atk || 0, dmg: 0, crit: m.crit || 0, critDmg: m.critDmg || 0, leech: m.leech || 0, extra: (m.fire || 0), undead: m.undead || 0, gold: m.gold || 0, beast: m.beast || 0, boss: 0, beastPct: 0, run: 0 };
  for (const r of st.runes) {
    const R = RUNES[r]; if (!R) continue;
    o.dmg += R.dmg || 0; o.crit += R.crit || 0; o.critDmg += R.critDmg || 0; o.leech += R.leech || 0;
    o.extra += (R.bolt || 0) + (R.cold || 0); o.boss += R.boss || 0; o.beastPct += R.beastPct || 0; o.run += R.run || 0;
  }
  return o;
}

/* ---------------- ASCII sword preview ---------------- */
function swordArt(t) {
  const st = craftState(), m = METALS[st.metal] || METALS.forged, W = 34, H = 22, grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(null));
  const put = (x, y, ch, c) => { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = [ch, c]; };
  // blade: a diagonal from bottom-left to top-right, two glyphs wide, tapering to a point
  const runeCells = new Set(st.runes.map((_, i) => 4 + i * 4));
  for (let i = 0; i < 15; i++) {
    const x = 11 + i * 1.3, y = 14 - i * .82, g = m.g[(i + Math.floor(t * 3)) % m.g.length];
    put(x, y, g, m.c); if (i < 13) put(x + 1, y, m.g[(i + 1) % m.g.length], m.c);
    if (runeCells.has(i)) { const r = st.runes[[...runeCells].indexOf(i)]; put(x + .5, y - 1, r, RUNES[r].c); }
  }
  // guard and grip
  for (let k = -3; k <= 3; k++) put(9 + k * .7 + 1, 15 + k * .6 - .5, k === 0 ? '@' : '=', '#b89a5a');
  for (let k = 1; k <= 4; k++) put(9 - k * 1.1, 16 + k * .7, k === 4 ? 'O' : '/', '#7a5634');
  // glow: sparks of the rune colours around the blade
  st.runes.forEach((r, j) => { for (let s = 0; s < 3; s++) { const a = t * 2 + j * 2 + s * 2.1, i = (s * 5 + j * 3 + Math.floor(t * 4)) % 15; put(11 + i * 1.3 + Math.cos(a) * 2, 14 - i * .82 + Math.sin(a), '.', RUNES[r].c); } });
  return grid.map(row => row.map(c => c ? `<span style="color:${c[1]}">${c[0] === '<' ? '&lt;' : c[0]}</span>` : ' ').join('')).join('\n');
}

/* ---------------- armour pieces ---------------- */
// each piece: metal (DEF from ARMOR_DEF) + 2 runes; rune effects on armour come from ARMOR_RUNE
export const PIECES = { helm: 'Helm', shoulders: 'Shoulders', chest: 'Chest', gloves: 'Gloves', legs: 'Legs', boots: 'Boots' };
const ARMOR_DEF = { forged: 0, iron: 1, steel: 2, bronze: 1.5, silver: 1.5, gold: .5, moon: 3, night: 1.5, blood: 2, ossite: 1.5, ember: 1.5 };
const ARMOR_RUNE = { '+': { def: 1, d: '+1 DEF' }, '^': { hp: 8, d: '+8 max HP' }, '*': { def: .5, hp: 4, d: '+0.5 DEF, +4 max HP' }, 'z': { thorns: .05, d: 'reflect 5% of melee damage' },
  '~': { regen: .3, d: '+0.3 HP per second' }, '>': { speed: .02, d: '+2% move speed' }, '/': { def: .5, d: '+0.5 DEF' }, 'x': { hp: 6, d: '+6 max HP' }, 'v': { regen: .2, d: '+0.2 HP per second' }, 'o': { def: .7, d: '+0.7 DEF' } };
const ART = {   // # = metal glyph, rows are staggered like mail
  helm: ['   ####   ', '  ######  ', ' ######## ', ' ##-  -## ', ' ######## ', '  ######  ', ' ######## ', '##########'],
  shoulders: ['  ####      ####  ', ' ######    ###### ', '########  ########', '########  ########', ' ######    ###### '],
  chest: ['  ###    ###  ', ' ############ ', '##############', '##############', ' ############ ', ' ############ ', '  ##########  ', '  ##########  ', '   ########   '],
  gloves: [' ##  ##      ##  ## ', ' ##  ##      ##  ## ', ' ######      ###### ', ' ######      ###### ', '  ####        ####  ', '  ####        ####  '],
  legs: ['##########', '####  ####', '###    ###', '###    ###', '###    ###', '###    ###', '###    ###', '###    ###'],
  boots: [' ###     ###  ', ' ###     ###  ', ' ###     ###  ', ' #####   ##### ', '######  ######']
};
export function armorState(p) { S.armor = S.armor || {}; return S.armor[p] || (S.armor[p] = { metal: 'forged', runes: [] }); }
export function armorMods() {
  const o = { def: 0, hp: 0, regen: 0, thorns: 0, speed: 0 };
  for (const p in PIECES) {
    const st = armorState(p); o.def += ARMOR_DEF[st.metal] || 0;
    for (const r of st.runes) { const R = ARMOR_RUNE[r]; if (R) for (const k in o) o[k] += R[k] || 0; }
  }
  return o;
}
function armorArt(p, t) {
  const st = armorState(p), m = METALS[st.metal] || METALS.forged;
  return ART[p].map((row, y) => (y % 2 ? ' ' : '') + row.split('').map((ch, x) => {
    if (ch !== '#') return ch === ' ' ? ' ' : `<span style="color:#555">${ch}</span>`;
    const g = m.g[(x + y + Math.floor(t * 2)) % m.g.length];
    return `<span style="color:${m.c}">${g}</span>`;
  }).join('')).join('\n') + '\n\n' + st.runes.map(r => `<span style="color:${RUNES[r].c}">  ${r}  </span>`).join('');
}

/* ---------------- panel ---------------- */
let open = false, timer = 0, tab = 'weapon';
export function craftOpen() { return open; }
const art = () => tab === 'weapon' ? swordArt(performance.now() / 1000) : armorArt(tab, performance.now() / 1000);
export function toggleCraft(on = !open) {
  open = on; $('craft').hidden = !on;
  clearInterval(timer); if (on) { render(); timer = setInterval(() => { $('craftArt').innerHTML = art(); }, 120); }
}
function render() {
  const weapon = tab === 'weapon', st = weapon ? craftState() : armorState(tab), m = METALS[st.metal], slots = weapon ? 3 : 2;
  $('craftTabs').innerHTML = [['weapon', 'Weapon'], ...Object.entries(PIECES)].map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('');
  $('craftTitle').textContent = 'CRAFT · ' + (weapon ? 'Blade' : PIECES[tab]);
  $('craftMetals').innerHTML = Object.entries(METALS).map(([k, v]) => `<button data-m="${k}" class="${k === st.metal ? 'on' : ''}" title="${weapon ? v.d : '+' + (ARMOR_DEF[k] || 0) + ' DEF'}"><span style="color:${v.c}">${v.g}</span> ${v.n}</button>`).join('');
  $('craftRunes').innerHTML = Object.entries(RUNES).map(([k, v]) => `<button data-r="${k}" title="${weapon ? v.d : ARMOR_RUNE[k].d}" style="color:${v.c}">${k}</button>`).join('');
  $('craftSlots').innerHTML = [...Array(slots).keys()].map(i => { const r = st.runes[i]; return `<button data-s="${i}" style="color:${r ? RUNES[r].c : '#555'}">${r || '·'}</button>`; }).join('');
  const am = armorMods();
  const lines = weapon ? [`Blade: <b style="color:${m.c}">${m.n}</b>`, m.d, `Runes: ${st.runes.length} / 3`, ...st.runes.map(r => `<span style="color:${RUNES[r].c}">${r}</span> ${RUNES[r].d}`)]
    : [`Metal: <b style="color:${m.c}">${m.n}</b> (+${ARMOR_DEF[st.metal] || 0} DEF)`, `Runes: ${st.runes.length} / 2`, ...st.runes.map(r => `<span style="color:${RUNES[r].c}">${r}</span> ${ARMOR_RUNE[r].d}`),
      '', `<small>All armour: +${am.def.toFixed(1)} DEF · +${am.hp} HP · +${am.regen.toFixed(1)} HP/s</small>`];
  $('craftInfo').innerHTML = lines.join('<br>');
  $('craftArt').innerHTML = art();
}
let inited = false;
export function initCraft() {
  if (inited) return; inited = true;
  $('craft').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const weapon = tab === 'weapon', st = weapon ? craftState() : armorState(tab), max = weapon ? 3 : 2;
    if (b.dataset.t) tab = b.dataset.t;
    else if (b.dataset.m) st.metal = b.dataset.m;
    else if (b.dataset.r) { if (st.runes.length < max) st.runes.push(b.dataset.r); else toast(`All ${max} rune slots are full — click a slot to free it`); }
    else if (b.dataset.s) st.runes.splice(+b.dataset.s, 1);
    else if (b.id === 'craftClose') return toggleCraft(false);
    render();
  });
}
