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

/* ---------------- panel ---------------- */
let open = false, timer = 0;
export function craftOpen() { return open; }
export function toggleCraft(on = !open) {
  open = on; $('craft').hidden = !on;
  clearInterval(timer); if (on) { render(); timer = setInterval(() => { $('craftArt').innerHTML = swordArt(performance.now() / 1000); }, 120); }
}
function render() {
  const st = craftState(), m = METALS[st.metal];
  $('craftMetals').innerHTML = Object.entries(METALS).map(([k, v]) => `<button data-m="${k}" class="${k === st.metal ? 'on' : ''}" title="${v.d}"><span style="color:${v.c}">${v.g}</span> ${v.n}</button>`).join('');
  $('craftRunes').innerHTML = Object.entries(RUNES).map(([k, v]) => `<button data-r="${k}" title="${v.d}" style="color:${v.c}">${k}</button>`).join('');
  $('craftSlots').innerHTML = [0, 1, 2].map(i => { const r = st.runes[i]; return `<button data-s="${i}" style="color:${r ? RUNES[r].c : '#555'}">${r || '·'}</button>`; }).join('');
  const lines = [`Blade: <b style="color:${m.c}">${m.n}</b>`, m.d, `Runes: ${st.runes.length} / 3`, ...st.runes.map(r => `<span style="color:${RUNES[r].c}">${r}</span> ${RUNES[r].d}`)];
  $('craftInfo').innerHTML = lines.join('<br>');
  $('craftArt').innerHTML = swordArt(performance.now() / 1000);
}
let inited = false;
export function initCraft() {
  if (inited) return; inited = true;
  $('craft').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const st = craftState();
    if (b.dataset.m) st.metal = b.dataset.m;
    else if (b.dataset.r) { if (st.runes.length < 3) st.runes.push(b.dataset.r); else toast('All 3 rune slots are full — click a slot to free it'); }
    else if (b.dataset.s) st.runes.splice(+b.dataset.s, 1);
    else if (b.id === 'craftClose') return toggleCraft(false);
    render();
  });
}
