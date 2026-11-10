// Shared helpers, world height function, collision and material IDs
import * as THREE from 'three';
export { THREE };

export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

// Input state (written by main.js, read by actors.js)
export const keys = {};
export const MOUSE = { x: innerWidth / 2, y: innerHeight / 2, lmb: false, rmb: false };

/* ---------------- world ---------------- */
export const WATER = -4.2, HALF = 200;
export const CASTLE = { x: 0, z: -56, half: 18 };          // castle ruins centre (north)
export const roadX = z => 3.5 * Math.sin(z * .05);           // village ↔ castle ↔ coast stone road
export const roadZ = x => 2 + (x - 10) * .12 + 3 * Math.sin(x * .07);   // village ↔ swamp camp road (east)
export function pathDist(x, z) {
  const a = (z < CASTLE.z + CASTLE.half - 2 || z > 104) ? 99 : Math.abs(x - roadX(z));
  const b = (x < 10 || x > 96) ? 99 : Math.abs(z - roadZ(x));
  return Math.min(a, b);
}
export const SWAMP = { x: 135, z: 20, r: 58 };                 // Misty Swamp (east)
export const CHAPEL = { x: 150, z: 34 }, CAMP = { x: 93, z: 13.5 };
export const swampF = (x, z) => 1 - smooth(32, 58, Math.hypot(x - SWAMP.x, z - SWAMP.z));

export function heightAt(x, z) {
  let h = (fbm(x * .0065 + 31.7, z * .0065 + 12.3, 5) - .5) * 52;
  if (h > 5) h += (h - 5) * .9;
  h = lerp(2.2, h, smooth(20, 70, Math.hypot(x, z)));                       // village plateau
  h = lerp(3, h, smooth(26, 44, Math.hypot(x - CASTLE.x, z - CASTLE.z)));   // castle plateau
  h -= smooth(70, 150, z) * 26;                                             // sea to the south
  const sw = swampF(x, z); if (sw > 0) h = lerp(h, WATER + .45 + (fbm(x * .05 + 7, z * .05 - 3, 3) - .5) * 3.4, sw);   // swamp with shallow pools
  const dc = Math.hypot(x - CHAPEL.x, z - CHAPEL.z); if (dc < 24) h = lerp(WATER + 1.5, h, smooth(13, 24, dc));          // chapel islet
  const dk = Math.hypot(x - CAMP.x, z - CAMP.z); if (dk < 16) h = lerp(WATER + 1.8, h, smooth(7, 16, dk));               // priest camp
  h += smooth(150, 198, Math.max(Math.abs(x), -z)) * 34;                    // west/east/north mountains
  return h;
}
export const isLand = (x, z, lo, hi) => { const h = heightAt(x, z); return h > (lo ?? WATER + 1.6) && h < (hi ?? 13); };
export function findLand(cx, cz) {
  for (let r = 0; r < 120; r += 3) for (let a = 0; a < 6.28; a += .5) {
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (Math.abs(x) < HALF - 20 && Math.abs(z) < HALF - 20 && isLand(x, z, 0, 9)) return { x, z };
  }
  return { x: cx, z: cz };
}

/* ---------------- collision (circles, grid) ---------------- */
const CG = 8;
export const cgrid = new Map();
const ck = (x, z) => Math.floor(x / CG) + ',' + Math.floor(z / CG);
export function addCollider(x, z, r, type) { const k = ck(x, z); let a = cgrid.get(k); if (!a) cgrid.set(k, a = []); a.push({ x, z, r, type }); }
export function addWall(x1, z1, x2, z2, r, type) {
  const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / (r * 1.1)));
  for (let i = 0; i <= n; i++) { const t = i / n; addCollider(lerp(x1, x2, t), lerp(z1, z2, t), r, type); }
}
export function collide(p, rad) {
  const cx = Math.floor(p.x / CG), cz = Math.floor(p.z / CG);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = cgrid.get((cx + i) + ',' + (cz + j)); if (!a) continue;
    for (const c of a) {
      const dx = p.x - c.x, dz = p.z - c.z, m = c.r + rad, d2 = dx * dx + dz * dz;
      if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
  }
}
export const cellHas = (x, z, type) => { const a = cgrid.get(ck(x, z)); return !!a && a.some(c => c.type === type); };

/* ---------------- material IDs ----------------
   Written into the scene render target's alpha channel; the ASCII pass uses it to
   decide which glyph set (or direct colour) each pixel is drawn with. */
export const MID = {
  GRASS: .2,     // grass blades: alpha .02-.28 carries the on-screen blade angle → - / | \ glyphs
  FIRE: .4,      // orange fire glyphs, flicker
  FLOWER: .5,    // white o * dots in the grass
  RAIN: .55,     // rain streaks → / '
  GLOW: .6,      // bright thin objects (shard, window, web) → + x * # @
  ACTOR: .65,    // fine grid, armor glyphs (knight, NPC, skeleton)
  CREATURE: .7,  // fine grid, fur glyphs (wolf, spider)
  WATER: .75, LEAF: .8, WOOD: .85, STONE: .9, GROUND: .95
};
export function tag(m, id) { m.opacity = id; m.transparent = false; return m; }
export const lam = (color, id, o = {}) => tag(new THREE.MeshLambertMaterial(Object.assign({ color }, o)), id);
export const basic = (color, id) => tag(new THREE.MeshBasicMaterial({ color }), id);
