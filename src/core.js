// Ortak yardımcılar, dünya yükseklik fonksiyonu, çarpışma ve malzeme kimlikleri
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

// Girdi durumu (main.js yazar, actors.js okur)
export const keys = {};
export const MOUSE = { x: innerWidth / 2, y: innerHeight / 2, lmb: false, rmb: false };

/* ---------------- dünya ---------------- */
export const WATER = -4.2, HALF = 200;
export const CASTLE = { x: 0, z: -56, half: 18 };          // kale harabesi merkezi (kuzey)
export const roadX = z => 3.5 * Math.sin(z * .05);           // köy ↔ kale ↔ kıyı taş yolu
export function pathDist(x, z) { if (z < CASTLE.z + CASTLE.half - 2 || z > 104) return 99; return Math.abs(x - roadX(z)); }

export function heightAt(x, z) {
  let h = (fbm(x * .0065 + 31.7, z * .0065 + 12.3, 5) - .5) * 52;
  if (h > 5) h += (h - 5) * .9;
  h = lerp(2.2, h, smooth(20, 70, Math.hypot(x, z)));                       // köy düzlüğü
  h = lerp(3, h, smooth(26, 44, Math.hypot(x - CASTLE.x, z - CASTLE.z)));   // kale düzlüğü
  h -= smooth(70, 150, z) * 26;                                             // güneyde deniz
  h += smooth(150, 198, Math.max(Math.abs(x), -z)) * 34;                    // batı/doğu/kuzey dağları
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

/* ---------------- çarpışma (dairesel, ızgara) ---------------- */
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

/* ---------------- malzeme kimlikleri ----------------
   Sahne render hedefinin alfa kanalına yazılır; ASCII geçişi her pikselin
   hangi glif setiyle (veya doğrudan) çizileceğine buna bakarak karar verir. */
export const MID = {
  GRASS: .2,     // çimen sapları: alfa .02-.28 aralığı sapın ekrandaki açısını taşır → - / | \ glifleri
  FIRE: .4,      // turuncu ateş glifleri, titrer
  FLOWER: .5,    // çimendeki beyaz o * noktaları
  RAIN: .55,     // yağmur çizgileri → / '
  GLOW: .6,      // parlak ince nesneler (kristal, pencere, ağ) → + x * # @
  ACTOR: .65,    // ince ızgara, zırh glifleri (şövalye, NPC, iskelet)
  CREATURE: .7,  // ince ızgara, tüy glifleri (kurt, örümcek)
  WATER: .75, LEAF: .8, WOOD: .85, STONE: .9, GROUND: .95
};
export function tag(m, id) { m.opacity = id; m.transparent = false; return m; }
export const lam = (color, id, o = {}) => tag(new THREE.MeshLambertMaterial(Object.assign({ color }, o)), id);
export const basic = (color, id) => tag(new THREE.MeshBasicMaterial({ color }), id);
