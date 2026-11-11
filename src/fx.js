// Particles (blood, sparks, bone, embers, fire, magic), ground decals, hit-stop and camera shake.
// All drawn as small bright objects; the ASCII pass shows them as + x * # @ glyphs.
import { THREE, heightAt, MID, tag } from './core.js';
import { scene } from './render.js';

export const FXS = { shake: 0, stop: 0 };
const MAX = 900;
const geo = new THREE.OctahedronGeometry(1, 0);
const mat = tag(new THREE.MeshBasicMaterial({ color: 0xffffff }), MID.GLOW);
const inst = new THREE.InstancedMesh(geo, mat, MAX); inst.frustumCulled = false; inst.count = 0; scene.add(inst);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const P = []; for (let i = 0; i < MAX; i++) P.push({ alive: false });
const C = new THREE.Color(), C2 = new THREE.Color(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
inst.setColorAt(0, C.set(0xffffff));

const TYPES = {
  blood: { col: [0x7a0606, 0xa81010], spd: [2, 5.5], up: 2.5, g: 16, life: [.4, .9], size: [.05, .11], decal: true },
  ichor: { col: [0x2a5a10, 0x4a8a20], spd: [2, 5], up: 2, g: 14, life: [.4, .8], size: [.05, .1] },
  bone: { col: [0xbdb39a, 0xe0d8c0], spd: [2, 4.5], up: 3, g: 18, life: [.5, 1], size: [.03, .07] },
  spark: { col: [0xffc060, 0xfff0b0], spd: [4, 9], up: 2, g: 9, life: [.15, .35], size: [.025, .05] },
  ember: { col: [0xff6a10, 0xffb040], spd: [.2, .7], up: 1.2, g: -1.2, life: [1.2, 2.6], size: [.025, .05], drift: true },
  fire: { col: [0xff5a10, 0xffc040], spd: [1, 3], up: 3, g: -3, life: [.3, .7], size: [.08, .18] },
  dust: { col: [0x4a4a44, 0x6a6a60], spd: [.8, 2], up: .6, g: 2, life: [.3, .6], size: [.05, .1] },
  magic: { col: [0x4aa0ff, 0xb0e0ff], spd: [1, 4], up: 2, g: 0, life: [.3, .8], size: [.03, .07] },
  void: { col: [0x6a3aff, 0xd0b0ff], spd: [2, 4], up: .3, g: 0, life: [.35, .7], size: [.04, .09] },
  web: { col: [0xc8d4dc, 0xffffff], spd: [2, 6], up: 1.2, g: 3, life: [.4, .9], size: [.02, .05] },
  loot: { col: [0xffd060, 0xfff4c0], spd: [.3, 1.2], up: 3.2, g: -1, life: [.5, 1.1], size: [.02, .05] },
  hex: { col: [0x3aff2a, 0xb0ff80], spd: [1, 3], up: 1.5, g: 0, life: [.3, .7], size: [.03, .07] },
  mist: { col: [0x3a4440, 0x56605a], spd: [.15, .45], up: .05, g: 0, life: [3.5, 6], size: [.18, .4], drift: true }
};
const rnd = (a, b) => a + Math.random() * (b - a);
let next = 0;
export function burst(type, x, y, z, n = 10, dir) {
  const T = TYPES[type];
  for (let k = 0; k < n; k++) {
    let p = null;
    for (let t = 0; t < MAX; t++) { const c = P[(next + t) % MAX]; if (!c.alive) { p = c; next = (next + t + 1) % MAX; break; } }
    if (!p) return;
    const a = Math.random() * 6.283, sp = rnd(T.spd[0], T.spd[1]);
    p.alive = true; p.x = x; p.y = y; p.z = z;
    p.vx = Math.cos(a) * sp + (dir ? dir.x * sp : 0); p.vz = Math.sin(a) * sp + (dir ? dir.z * sp : 0); p.vy = rnd(.3, 1) * T.up * (sp / T.spd[1] + .5);
    p.life = p.max = rnd(T.life[0], T.life[1]); p.size = rnd(T.size[0], T.size[1]); p.T = T;
    p.col = C.set(T.col[0]).lerp(C2.set(T.col[1]), Math.random()).getHex();
    p.rot = Math.random() * 6;
  }
  if (T.decal && n >= 6) decal(x, z, .4 + n * .03);
}
export function updateFX(dt) {
  let n = 0;
  for (const p of P) {
    if (!p.alive) continue;
    p.life -= dt; if (p.life <= 0) { p.alive = false; continue; }
    p.vy -= p.T.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.T.drift) { p.vx += Math.sin(p.life * 3 + p.rot) * dt; p.vz += Math.cos(p.life * 2.6 + p.rot) * dt; }
    const gy = heightAt(p.x, p.z);
    if (p.y < gy + .02) { p.y = gy + .02; p.vy *= -.25; p.vx *= .6; p.vz *= .6; }
    const k = p.T.g < 0 ? p.life / p.max : Math.min(1, p.life / p.max * 2);
    Q.setFromAxisAngle(V.set(0, 1, 0), p.rot += dt * 4);
    M4.compose(V.set(p.x, p.y, p.z), Q, S.setScalar(p.size * k)); inst.setMatrixAt(n, M4); inst.setColorAt(n, C.setHex(p.col)); n++;
  }
  inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  // decals
  for (const d of decals) { if (!d.m.visible) continue; d.t += dt; if (d.t > 18) { const s = Math.max(0, 1 - (d.t - 18) / 4); d.m.scale.setScalar(d.r * s); if (s <= 0) d.m.visible = false; } }
}

/* ---------------- blood decals on the ground ---------------- */
const decals = [], decalMat = tag(new THREE.MeshBasicMaterial({ color: 0x3a0303 }), MID.GROUND);
decalMat.polygonOffset = true; decalMat.polygonOffsetFactor = -2;
const decalGeo = (() => { const g = new THREE.CircleGeometry(1, 14), p = g.attributes.position; for (let i = 1; i < p.count; i++) { const f = .6 + Math.random() * .6; p.setXY(i, p.getX(i) * f, p.getY(i) * f); } g.rotateX(-Math.PI / 2); return g; })();
for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; m.receiveShadow = true; scene.add(m); decals.push({ m, t: 0, r: 1 }); }
let dn = 0;
export function decal(x, z, r) { const d = decals[dn++ % decals.length]; d.m.position.set(x, heightAt(x, z) + .03, z); d.m.rotation.y = Math.random() * 6; d.r = r; d.t = 0; d.m.scale.setScalar(r); d.m.visible = true; }

/* ---------------- hit feel ---------------- */
export function hitFeel(stop = .05, shake = .15) { FXS.stop = Math.max(FXS.stop, stop); FXS.shake = Math.max(FXS.shake, shake); }
