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
// extra dirt roads and a river from the sketched lake down to the sea (polylines, x/z in metres)
export const ROADS = [
  [[-8, 3], [-34, -6], [-62, -18], [-86, -26]],          // west road toward the spider woods
  [[5, -10], [12, -18], [17, -21.5]],                     // village → watchtower stair
  [[-14, -12], [-34, -42], [-52, -66]]                    // north-west track up to the lake
];
export const RIVERS = [[[-58, -72], [-78, -52], [-96, -18], [-100, 22], [-112, 62], [-124, 104], [-132, 150]]];
function segDist(x, z, pts) {
  let m = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return m;
}
export const riverDist = (x, z) => { let m = 1e9; for (const r of RIVERS) m = Math.min(m, segDist(x, z, r)); return m; };
export function pathDist(x, z) {
  let r = 1e9; for (const p of ROADS) r = Math.min(r, segDist(x, z, p));
  const a = (z < CASTLE.z + CASTLE.half - 2 || z > 104) ? 99 : Math.abs(x - roadX(z));
  const b = (x < 10 || x > 96) ? 99 : Math.abs(z - roadZ(x));
  return Math.min(a, b, r);
}
export const SWAMP = { x: 135, z: 20, r: 58 };                 // Misty Swamp (east)
export const CHAPEL = { x: 150, z: 34 }, CAMP = { x: 93, z: 13.5 };
export const swampF = (x, z) => 1 - smooth(32, 58, Math.hypot(x - SWAMP.x, z - SWAMP.z));

/* ---------------- map sketch ----------------
   A hand-drawn 20x20 sketch of the whole map (one char = 20 m, row 0 = north, z -200). The terrain,
   lakes and forests follow it, blended smoothly between cells; the fixed places (village, castle,
   swamp, coast) still flatten or carve their own ground on top.
   M mountains · ^ hills · T forest · . meadow · ~ lake · , open land */
export const SKETCH = [
  'MMMMMMMMMMMMMMMMMMMM',
  'MM^^^^,,,,,,,,^^^^MM',
  'M^^TT,,,,,,,,,,TT^^M',
  'M^TT,,,^,,,,,,TTT^^M',
  'M^T,,,^^,,,,,,,TT,^M',
  'MTT,,,~~,,,,,,,,T,,M',
  'MTT,TT~~,,,,,,T,,,,M',
  'M^,TT,,,,.,,,,,,,,,M',
  'M^,,TT,,,.,.,,TT,,,M',
  'M,,,,,,,,..,,TT,,,,M',
  'M^,,,,,,,...,,,,,,,M',
  'M^,,,,,,,,.,,,,,,,,M',
  'MTT,,,,,,,,,,,TT,,,M',
  'M,TT,,,,,,,,,,,,,,,M',
  'M,,,,,,,,,,,,,,,,,,M',
  ',,,,,,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,,,,,'
];
const SK_N = SKETCH.length, SK_C = 400 / SK_N, SK_KEYS = 'M^T.~';
// blended weights of each sketch class at (x, z): { M, '^', T, '.', '~' } in 0..1
export function sketchAt(x, z) {
  const fx = clamp((x + 200) / SK_C - .5, 0, SK_N - 1.001), fz = clamp((z + 200) / SK_C - .5, 0, SK_N - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = smooth(0, 1, fx - i), v = smooth(0, 1, fz - j), w = {};
  for (const k of SK_KEYS) w[k] = 0;
  const add = (ii, jj, k) => { const c = SKETCH[Math.min(jj, SK_N - 1)][Math.min(ii, SK_N - 1)]; if (c in w) w[c] += k; };
  add(i, j, (1 - u) * (1 - v)); add(i + 1, j, u * (1 - v)); add(i, j + 1, (1 - u) * v); add(i + 1, j + 1, u * v);
  return w;
}

export function heightAt(x, z) {
  let h = (fbm(x * .0065 + 31.7, z * .0065 + 12.3, 5) - .5) * 52;
  if (h > 5) h += (h - 5) * .9;
  { // follow the map sketch
    const w = sketchAt(x, z);
    h += w['^'] * 7 + w.M * 16;
    if (w['.'] > 0) h = lerp(h, 2.5 + (h - 2.5) * .3, w['.'] * .7);
    { const rd = riverDist(x, z) + (vnoise(x * .08, z * .08) - .5) * 2.5; if (rd < 10) h = Math.min(h, lerp(WATER - 1.3, h, smooth(3, 10, rd))); }   // river bed
    if (w['~'] > 0) h = lerp(h, WATER - 2.6, smooth(.25, .75, w['~'] + (vnoise(x * .06, z * .06) - .5) * .5));   // ragged shore
  }
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
// top: optional height of the obstacle; a body standing at or above it walks over it (towers, merlons)
export function addCollider(x, z, r, type, top = Infinity) { const k = ck(x, z); let a = cgrid.get(k); if (!a) cgrid.set(k, a = []); a.push({ x, z, r, type, top }); }

/* ---------------- walkable platforms (high ground: tower tops, stairs) ---------------- */
export const PLATS = [];
// box: centre x/z, half sizes hx/hz, rotation ry; cyl: centre x/z, radius r. top = walkable height
export function addPlat(p) { PLATS.push(p); }
const onPlat = (p, x, z) => {
  if (p.r) return (x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r;
  const dx = x - p.x, dz = z - p.z, c = Math.cos(p.ry || 0), s = Math.sin(p.ry || 0);
  return Math.abs(dx * c - dz * s) < p.hx && Math.abs(dx * s + dz * c) < p.hz;
};
// highest walkable height under (x, z) that a body at height y can step onto
export function standAt(x, z, y = Infinity, step = .7) {
  let h = heightAt(x, z);
  for (const p of PLATS) if (p.top > h && p.top <= y + step && onPlat(p, x, z)) h = p.top;
  return h;
}
export function addWall(x1, z1, x2, z2, r, type) {
  const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / (r * 1.1)));
  for (let i = 0; i <= n; i++) { const t = i / n; addCollider(lerp(x1, x2, t), lerp(z1, z2, t), r, type); }
}
export function collide(p, rad, y = -Infinity) {
  const cx = Math.floor(p.x / CG), cz = Math.floor(p.z / CG);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = cgrid.get((cx + i) + ',' + (cz + j)); if (!a) continue;
    for (const c of a) {
      if (y >= c.top - .15) continue;
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
  WATER: .75, LEAF: .8, WOOD: .85, STONE: .9, GROUND: .95,
  CHAIN: .45,
  SCALE: .35,    // dragon scales: staggered rows of overlapping scale glyphs    // chainmail: fine staggered grid, ring glyphs o 8 S
  TEXT: .925     // world-anchored letters already drawn in the scene pass → shown as they are
};
export function tag(m, id) { m.opacity = id; m.transparent = false; if (id === MID.STONE) worldGlyphs(m); return m; }

/* ---------------- moss on stone ----------------
   Stone stays a screen-grid letter texture (drawn by the ASCII pass). The stone shader only marks
   world-space moss/ivy patches (thicker on top faces) as foliage, so they come out as green leaf glyphs. */
function worldGlyphs(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 wgp = vec4(transformed, 1.); vec3 wgn = objectNormal;
      #ifdef USE_INSTANCING
        wgp = instanceMatrix * wgp; wgn = mat3(instanceMatrix) * wgn;
      #endif
      vWP = (modelMatrix * wgp).xyz; vWN = normalize(mat3(modelMatrix) * wgn);`);
    sh.fragmentShader = `varying vec3 vWP; varying vec3 vWN;
      float wgN3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        float n = i.x + i.y * 57. + i.z * 113.;
        #define WGR(o) fract(sin(n + o) * 43758.5453)
        return mix(mix(mix(WGR(0.), WGR(1.), f.x), mix(WGR(57.), WGR(58.), f.x), f.y), mix(mix(WGR(113.), WGR(114.), f.x), mix(WGR(170.), WGR(171.), f.x), f.y), f.z); }
`
      + sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
      vec3 wn = normalize(vWN);
      float mn = wgN3(vWP * .42) * .65 + wgN3(vWP * 1.6 + 7.) * .35 + (wn.y > .7 ? .14 : 0.);
      float lit = dot(outgoingLight, vec3(.333));
      if (mn > .68) gl_FragColor = vec4(mix(vec3(.08, .15, .08), vec3(.16, .28, .14), wgN3(vWP * 3.1)) * (lit * 1.3 + .04), ${MID.LEAF.toFixed(3)});
      else gl_FragColor = vec4(outgoingLight, diffuseColor.a);`);
  };
  m.customProgramCacheKey = () => 'wg';
}
export const lam = (color, id, o = {}) => tag(new THREE.MeshLambertMaterial(Object.assign({ color }, o)), id);
export const basic = (color, id) => tag(new THREE.MeshBasicMaterial({ color }), id);
