// Statik dünya: arazi, su, çimen, ağaçlar, köy, kale harabesi, kıyı menhirleri, kristaller, örümcek yuvası
import {
  THREE, clamp, lerp, smooth, mulberry32, hash2, vnoise, fbm, WATER, HALF, CASTLE,
  heightAt, isLand, findLand, pathDist, addCollider, addWall, MID, tag, lam, basic
} from './core.js';
import { scene, ENV } from './render.js';

const insideCastle = (x, z, pad = 0) => Math.abs(x - CASTLE.x) < CASTLE.half - pad && Math.abs(z - CASTLE.z) < CASTLE.half - pad;
const rocky = (x, z) => vnoise(x * .06 + 40, z * .06 - 13) > .74;
export const DRAGON_LAIR = findLand(-70, -128);   // ejderha yuvası: yanık, ağaçsız açıklık
export const LAIR = findLand(-118, -38);          // örümcek yuvası
const scorched = (x, z) => 1 - smooth(14, 24, Math.hypot(x - DRAGON_LAIR.x, z - DRAGON_LAIR.z));
const clearing = (x, z) => Math.hypot(x - DRAGON_LAIR.x, z - DRAGON_LAIR.z) < 26 || Math.hypot(x - LAIR.x, z - LAIR.z) < 9;
const Q =new THREE.Quaternion(), M4 = new THREE.Matrix4(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), AX = new THREE.Vector3(0, 1, 0), CC = new THREE.Color();

/* ================= arazi ================= */
{
  const g = new THREE.PlaneGeometry(400, 400, 220, 220); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i), k = vnoise(x * .2, z * .2), k2 = vnoise(x * .03 + 5, z * .03);
    let r, gg, b;
    if (y < WATER - .3) { r = .04; gg = .05; b = .06; }
    else if (y < WATER + 1) { r = .11; gg = .1; b = .085; }
    else if (y > 20) { r = .55; gg = .58; b = .63; }
    else if (ny < .78) { const s = .8 + .4 * k; r = .17 * s; gg = .19 * s; b = .25 * s; }
    else { r = .035 + .03 * k2; gg = .085 + .04 * k; b = .03 + .012 * k2; }
    if (y > WATER + 1 && y < 20 && ny >= .78 && rocky(x, z)) { r = .12; gg = .13; b = .17; }
    const cob = Math.max(smooth(2.6, 1.4, pathDist(x, z)), smooth(12.5, 10.5, Math.hypot(x, z)), insideCastle(x, z, 1) ? 1 : 0);
    if (cob > 0) { r = lerp(r, .15 + .03 * k, cob); gg = lerp(gg, .16 + .03 * k, cob); b = lerp(b, .21 + .03 * k, cob); }
    const sc = scorched(x, z); if (sc > 0) { r = lerp(r, .07 + .05 * k, sc); gg = lerp(gg, .055 + .03 * k, sc); b = lerp(b, .045 + .02 * k, sc); }
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const t = new THREE.Mesh(g, tag(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 3, specular: 0x0a0a0a }), MID.GROUND));
  t.receiveShadow = true; scene.add(t);
}

/* ================= su (köpüklü kıyı) ================= */
const DT = 256, dd = new Uint8Array(DT * DT * 4);
for (let j = 0; j < DT; j++) for (let i = 0; i < DT; i++) {
  const x = -200 + (i + .5) * 400 / DT, z = -200 + (j + .5) * 400 / DT, v = clamp((WATER - heightAt(x, z)) / 8, 0, 1), o = (j * DT + i) * 4;
  dd[o] = dd[o + 1] = dd[o + 2] = Math.round(v * 255); dd[o + 3] = 255;
}
const depthTex = new THREE.DataTexture(dd, DT, DT, THREE.RGBAFormat);
depthTex.minFilter = depthTex.magFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
export const waterMat = new THREE.ShaderMaterial({
  uniforms: { tDepth: { value: depthTex }, uTime: { value: 0 }, uLight: { value: ENV.light }, uFogColor: { value: ENV.sky }, uFogNear: { value: 30 }, uFogFar: { value: 170 } },
  vertexShader: `varying vec3 vW;varying float vFog;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vFog=-mv.z;gl_Position=projectionMatrix*mv;}`,
  fragmentShader: `uniform sampler2D tDepth;uniform float uTime,uFogNear,uFogFar;uniform vec3 uLight,uFogColor;varying vec3 vW;varying float vFog;
  void main(){
    float d=texture2D(tDepth,(vW.xz+200.)/400.).r;
    float shore=1.-smoothstep(0.,.2,d);
    float wave=sin(d*55.-uTime*1.4+sin(vW.x*.08+vW.z*.05)*3.);
    float foam=shore*smoothstep(.72,.97,wave)+(1.-smoothstep(0.,.04,d))*.9;
    float nn=sin(vW.x*.13+uTime*.4)*sin(vW.z*.11-uTime*.3+sin(vW.x*.05)*2.);
    foam+=smoothstep(.93,.99,nn)*.5*(1.-shore);
    float mist=shore*.22*(.5+.5*sin(vW.x*.05+vW.z*.07+uTime*.2));
    vec3 col=mix(vec3(.008,.014,.032),vec3(.72,.77,.84),clamp(foam+mist,0.,1.));
    col*=uLight*.9+.15;
    gl_FragColor=vec4(mix(col,uFogColor,smoothstep(uFogNear,uFogFar,vFog)),.75);
  }`
});
{ const w = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), waterMat); w.position.y = WATER; w.userData.noShadow = true; scene.add(w); }

/* ================= çimen: Lambert tabanlı (gerçek gölge + ışık alır), sap açısını alfa kanalına yazar ================= */
const grassBase = (() => {
  const w = .06, v = new Float32Array([-w, 0, 0, w, 0, 0, 0, 1, 0, 0, 0, -w, 0, 0, w, 0, 1, 0]), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  return g;
})();
export const GU = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uAspect: { value: 1 } };
export const grassMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
grassMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, GU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 offset;attribute vec3 par;uniform float uTime,uAspect;uniform vec3 uPlayer;
varying float vH;varying float vFl;varying float vAng;varying vec3 vGCol;`).replace('#include <begin_vertex>', `
float hgt=position.y;
float tone=fract(sin(dot(offset.xz,vec2(12.9898,78.233)))*43758.5453);
float fl=step(.955,tone);
float s=par.y*(1.-smoothstep(34.,48.,distance(offset.xz,uPlayer.xz)))*(fl>.5?.55:1.);
vec3 gp=position;gp.y*=s;gp.xz*=(fl>.5?3.5:1.);
float gc=cos(par.x),gsn=sin(par.x);
vec3 transformed=vec3(gp.x*gc-gp.z*gsn,gp.y,gp.x*gsn+gp.z*gc);
float gw=sin(uTime*1.6+offset.x*.21+offset.z*.17)*.3+sin(uTime*2.7+offset.z*.4)*.1;
float bend=hgt*hgt*s;
transformed.x+=(par.z+gw)*bend;transformed.z+=(par.z*.5+gw*.6)*bend;
vec2 gdp=offset.xz-uPlayer.xz;float gpd=length(gdp);
transformed.xz+=gdp/(gpd+.001)*(1.-smoothstep(0.,1.5,gpd))*.9*hgt*s;
transformed+=offset;
vH=hgt;vFl=fl;
vGCol=(fl>.5&&hgt>.45)?vec3(.85,.88,.82):mix(vec3(.015,.04,.03),mix(vec3(.12,.31,.17),vec3(.2,.28,.27),fract(tone*3.7)),hgt)*(.75+.5*fract(tone*7.3));
vec3 gtip=offset+vec3((par.z+gw)*s,s,(par.z*.5+gw*.6)*s);
vec4 GA=projectionMatrix*viewMatrix*vec4(offset,1.),GB=projectionMatrix*viewMatrix*vec4(gtip,1.);
vec2 gd=GB.xy/GB.w-GA.xy/GA.w;gd.x*=uAspect;float gan=atan(gd.y,gd.x);if(gan<0.)gan+=3.14159265;vAng=gan/3.14159265;
`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vH;varying float vFl;varying float vAng;varying vec3 vGCol;`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vGCol, opacity );')
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
gl_FragColor.a=(vFl>.5&&vH>.45)?.5:.02+fract(vAng)*.26;`);
};
const CH = 22, GR = 2, gchunks = new Map();
function makeGrassChunk(cx, cz) {
  const rng = mulberry32((cx * 73856093) ^ (cz * 19349663)), N = 6500, off = new Float32Array(N * 3), par = new Float32Array(N * 3); let n = 0;
  for (let i = 0; i < N; i++) {
    const x = (cx + rng()) * CH, z = (cz + rng()) * CH, r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
    const h = heightAt(x, z);
    if (h < WATER + .9 || h > 16) continue;
    if (Math.hypot(x, z) < 12 || pathDist(x, z) < 2) continue;
    if (insideCastle(x, z, -1) && r1 > .12) continue;
    if (rocky(x, z) && r1 > .2) continue;
    if (scorched(x, z) > .3 && r1 > .05) continue;
    if (Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h) > 1.5) continue;
    off[n * 3] = x; off[n * 3 + 1] = h - .05; off[n * 3 + 2] = z;
    par[n * 3] = r2 * 6.283; par[n * 3 + 1] = .45 + r3 * .55; par[n * 3 + 2] = (r4 - .5) * .7; n++;
  }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', grassBase.attributes.position);
  g.setAttribute('offset', new THREE.InstancedBufferAttribute(off.slice(0, n * 3), 3));
  g.setAttribute('par', new THREE.InstancedBufferAttribute(par.slice(0, n * 3), 3));
  g.instanceCount = n; g.boundingSphere = new THREE.Sphere(new THREE.Vector3((cx + .5) * CH, 0, (cz + .5) * CH), CH + 30);
  const m = new THREE.Mesh(g, grassMat); m.receiveShadow = true; m.castShadow = false; scene.add(m); return { mesh: m, cx, cz };
}
export function updateGrass(px, pz, limit) {
  const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH); let made = 0;
  for (let dz = -GR; dz <= GR; dz++) for (let dx = -GR; dx <= GR; dx++) {
    const k = (pcx + dx) + ',' + (pcz + dz);
    if (!gchunks.has(k) && made < limit && Math.abs((pcx + dx) * CH) < HALF && Math.abs((pcz + dz) * CH) < HALF) { gchunks.set(k, makeGrassChunk(pcx + dx, pcz + dz)); made++; }
  }
  for (const [k, c] of gchunks) if (Math.abs(c.cx - pcx) > GR + 1 || Math.abs(c.cz - pcz) > GR + 1) { scene.remove(c.mesh); c.mesh.geometry.dispose(); gchunks.delete(k); }
}

/* ================= ağaçlar + kayalar ================= */
{
  const rng = mulberry32(1234), T = [];
  for (let i = 0; i < 11000 && T.length < 1400; i++) {
    const x = (rng() * 2 - 1) * (HALF - 8), z = (rng() * 2 - 1) * (HALF - 8), h = heightAt(x, z), f = fbm(x * .022 + 100, z * .022 - 50, 3), r = rng();
    if (Math.hypot(x, z) < 26 || insideCastle(x, z, -7) || pathDist(x, z) < 4 || h < WATER + 1.4 || h > 16 || rocky(x, z) || clearing(x, z)) continue;
    if (f < .46 || (f < .54 && r > (f - .46) * 12)) continue;
    T.push({ x, z, h, s: .8 + rng() * .9, ry: rng() * 6.28, c: rng(), pine: rng() < .45 });
  }
  const pines = T.filter(t => t.pine), rounds = T.filter(t => !t.pine);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .32, 2.4, 6).translate(0, 1.2, 0), lam(0x3b2a1c, MID.WOOD), T.length);
  const leafM = () => lam(0xffffff, MID.LEAF);
  const p1 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 3.2, 7).translate(0, 3.1, 0), leafM(), pines.length);
  const p2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.35, 2.6, 7).translate(0, 4.8, 0), leafM(), pines.length);
  const blob = seed => { const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = .78 + vnoise(x * 2.2 + seed + z, y * 2.2 - z) * .45; p.setXYZ(i, x * f, y * f * (y < 0 ? .7 : 1), z * f); } g.computeVertexNormals(); return g; };
  const r1 = new THREE.InstancedMesh(blob(1), leafM(), rounds.length);
  const r2 = new THREE.InstancedMesh(blob(7), leafM(), rounds.length);
  T.forEach((t, i) => {
    Q.setFromAxisAngle(AX, t.ry); PV.set(t.x, t.h - .1, t.z); SV.set(t.s, t.s * (t.pine ? 1 : .8), t.s); M4.compose(PV, Q, SV); trunks.setMatrixAt(i, M4);
    addCollider(t.x, t.z, .55 * t.s, 'tree');
  });
  pines.forEach((t, i) => {
    Q.setFromAxisAngle(AX, t.ry); PV.set(t.x, t.h - .1, t.z); SV.set(t.s, t.s * (.9 + t.c * .4), t.s); M4.compose(PV, Q, SV);
    p1.setMatrixAt(i, M4); p2.setMatrixAt(i, M4);
    CC.setRGB(.04 + t.c * .04, .13 + t.c * .08, .1 + t.c * .05); p1.setColorAt(i, CC); p2.setColorAt(i, CC.multiplyScalar(1.15));
  });
  rounds.forEach((t, i) => {
    Q.setFromAxisAngle(AX, t.ry);
    PV.set(t.x, t.h + 3.1 * t.s, t.z); SV.set(2.3 * t.s, 1.8 * t.s, 2.3 * t.s); M4.compose(PV, Q, SV); r1.setMatrixAt(i, M4);
    PV.set(t.x + Math.cos(t.ry) * .9 * t.s, t.h + 3.9 * t.s, t.z + Math.sin(t.ry) * .9 * t.s); SV.set(1.6 * t.s, 1.4 * t.s, 1.6 * t.s); M4.compose(PV, Q, SV); r2.setMatrixAt(i, M4);
    CC.setRGB(.06 + t.c * .05, .16 + t.c * .08, .12 + t.c * .05); r1.setColorAt(i, CC); r2.setColorAt(i, CC.multiplyScalar(1.2));
  });
  scene.add(trunks, p1, p2, r1, r2);

  const R = [];
  for (let i = 0; i < 5000 && R.length < 240; i++) {
    const x = (rng() * 2 - 1) * (HALF - 8), z = (rng() * 2 - 1) * (HALF - 8), h = heightAt(x, z);
    if (Math.hypot(x, z) < 24 || insideCastle(x, z, -3) || pathDist(x, z) < 3 || h < WATER + .5) continue;
    if (rng() > .1 + smooth(8, 16, h) * .7 + (rocky(x, z) ? .5 : 0)) continue;
    R.push({ x, z, h, s: .6 + rng() * 1.8, ry: rng() * 6.28 });
  }
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0xffffff, MID.STONE), R.length);
  R.forEach((t, i) => {
    Q.setFromAxisAngle(AX, t.ry); PV.set(t.x, t.h + t.s * .15, t.z); SV.set(t.s, t.s * .65, t.s); M4.compose(PV, Q, SV); rocks.setMatrixAt(i, M4);
    const g = .36 + hash2(i, 9) * .14; CC.setRGB(g * .9, g * .95, g * 1.1); rocks.setColorAt(i, CC); addCollider(t.x, t.z, t.s * .85, 'rock');
  });
  scene.add(rocks);
}

/* ================= ateş / meşale yardımcıları ================= */
export const flames = [];
const woodM = lam(0x4a3422, MID.WOOD), fireM = basic(0xff8a2a, MID.FIRE);
function torch(x, z, y0, hgt = 2.2) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, hgt, 5), woodM); post.position.set(x, y0 + hgt / 2, z);
  const f = new THREE.Mesh(new THREE.ConeGeometry(.24, .6, 6), fireM); f.position.set(x, y0 + hgt + .3, z);
  scene.add(post, f); flames.push({ m: f, s: 1, ph: Math.random() * 10 }); addCollider(x, z, .25, 'post');
}
const stoneM = [lam(0x7d889e, MID.STONE), lam(0x6c768b, MID.STONE), lam(0x8a95a9, MID.STONE)];
const box = (w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };

/* ================= köy ================= */
export const FIRE = { x: 0, z: 0 };
export const fireLight = new THREE.PointLight(0xff8833, 2.2, 34);
export const lampLights = [];
{
  const hy = heightAt(0, 0);
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.4, 5), woodM); l.position.set(0, hy + .25, 0); l.rotation.z = 1.2; l.rotation.y = i * 1.26; scene.add(l); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; box(.5, .35, .5, stoneM[i % 3], Math.cos(a) * 1.25, hy + .15, Math.sin(a) * 1.25, a); }
  const f = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.6, 7), fireM); f.position.set(0, hy + .9, 0); scene.add(f); flames.push({ m: f, s: 1.6, ph: 0 });
  fireLight.position.set(0, hy + 1.8, 0); scene.add(fireLight); addCollider(0, 0, 1.4, 'fire');

  const roofM = lam(0x4e3324, MID.WOOD), doorM = lam(0x2e1d12, MID.WOOD), winM = basic(0xffc070, MID.GLOW);
  const tri = new THREE.Shape(); tri.moveTo(-2.3, 0); tri.lineTo(2.3, 0); tri.lineTo(0, 1.6); tri.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(tri, { depth: 5.3, bevelEnabled: false }); gableGeo.rotateY(Math.PI / 2); gableGeo.translate(-2.65, 0, 0);
  [.25, 1.0, 2.15, 2.95, 3.85, 5.6].forEach((a, i) => {
    const x = Math.cos(a) * 16.5, z = Math.sin(a) * 16.5, h = heightAt(x, z), g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 4.6), stoneM[i % 3]); wall.position.y = 1.6;
    const rl = new THREE.Mesh(new THREE.BoxGeometry(5.9, .22, 3.3), roofM); rl.position.set(0, 4.05, -1.1); rl.rotation.x = .62;
    const rr = new THREE.Mesh(new THREE.BoxGeometry(5.9, .22, 3.3), roofM); rr.position.set(0, 4.05, 1.1); rr.rotation.x = -.62;
    const gable = new THREE.Mesh(gableGeo, stoneM[i % 3]); gable.position.y = 3.2;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, .12), doorM); door.position.set(0, .95, 2.32);
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(.7, .6, .12), winM); w1.position.set(1.6, 1.9, 2.32);
    const w2 = w1.clone(); w2.position.x = -1.6;
    const chim = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.6, .6), stoneM[(i + 1) % 3]); chim.position.set(1.8, 4.6, -.8);
    g.add(wall, rl, rr, gable, door, w1, w2, chim); g.position.set(x, h, z); g.rotation.y = Math.atan2(-x, -z); scene.add(g);
    addCollider(x, z, 3.5, 'house');
  });
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 12), stoneM[1]); well.position.set(7, heightAt(7, -7) + .5, -7); scene.add(well); addCollider(7, -7, 1.4, 'well');
  [[9, 6], [-9, -6], [-8, 9], [8, -3]].forEach(([x, z], i) => {
    const h = heightAt(x, z); torch(x, z, h, 2.6);
    if (i < 2) { const L = new THREE.PointLight(0xffaa55, 0, 22); L.position.set(x, h + 3.2, z); scene.add(L); lampLights.push(L); }
  });
}

/* ================= kale harabesi ================= */
export const gateLight = new THREE.PointLight(0xff9944, 1.6, 26);
{
  const C = CASTLE, hy = heightAt(C.x, C.z), th = 1.8, H0 = C.half, rng = mulberry32(77);
  function wall(x1, z1, x2, z2, hgt) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    box(L, hgt, th, stoneM[Math.floor(rng() * 3)], C.x + mx, hy + hgt / 2, C.z + mz, ry);
    for (let s = 1; s < L - .5; s += 2.1) {
      if (rng() < .18) continue;   // kırık mazgallar
      const t = s / L; box(1, 1.1, th + .1, stoneM[Math.floor(rng() * 3)], C.x + x1 + dx * t, hy + hgt + .55, C.z + z1 + dz * t, ry);
    }
    addWall(C.x + x1, C.z + z1, C.x + x2, C.z + z2, th * .7, 'wall');
  }
  wall(-H0, -H0, H0, -H0, 7);
  wall(-H0, -H0, -H0, H0, 6.5);
  wall(H0, -H0, H0, -4, 6.8); wall(H0, 6, H0, H0, 5.2);       // doğu duvarında yıkık gedik
  wall(-H0, H0, -3.6, H0, 6.6); wall(3.6, H0, H0, H0, 6.6);   // güney: kapı arası boş
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const x = C.x + sx * H0, z = C.z + sz * H0, hgt = i === 1 ? 7 : 10.5;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, hgt, 14), stoneM[i % 3]); t.position.set(x, hy + hgt / 2, z); scene.add(t);
    for (let k = 0; k < 10; k++) { if (i === 1 && k % 3 === 0) continue; const a = k / 10 * 6.283; box(.9, 1.1, .9, stoneM[(k + i) % 3], x + Math.cos(a) * 2.8, hy + hgt + .55, z + Math.sin(a) * 2.8, -a); }
    addCollider(x, z, 3.6, 'tower');
  });
  // kapı: iki sütun + kemer + üst blok + meşaleler
  const gz = C.z + H0;
  box(1.8, 8, 2.4, stoneM[2], C.x - 3.5, hy + 4, gz); box(1.8, 8, 2.4, stoneM[2], C.x + 3.5, hy + 4, gz);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, .55, 6, 16, Math.PI), stoneM[0]); arch.position.set(C.x, hy + 5.2, gz); scene.add(arch);
  box(8.8, 2.4, 2.4, stoneM[1], C.x, hy + 8.4, gz);
  for (let s = -4; s <= 4; s += 2) box(1, 1.1, 2.5, stoneM[0], C.x + s, hy + 10.15, gz);
  addCollider(C.x - 3.5, gz, 1.4, 'wall'); addCollider(C.x + 3.5, gz, 1.4, 'wall');
  [-1, 1].forEach(s => { const f = new THREE.Mesh(new THREE.ConeGeometry(.26, .65, 6), fireM); f.position.set(C.x + s * 4.6, hy + 4.4, gz + 1.4); scene.add(f); flames.push({ m: f, s: 1, ph: s * 3 });
    box(.18, .5, .18, woodM, C.x + s * 4.6, hy + 3.9, gz + 1.35); });
  gateLight.position.set(C.x, hy + 4.5, gz + 2.5); scene.add(gateLight);
  // iç kale (yıkık)
  box(12, 9, 10, stoneM[0], C.x, hy + 4.5, C.z - 6);
  box(5, 4, 5, stoneM[1], C.x - 3.5, hy + 11, C.z - 8);
  for (let s = -5; s <= 5; s += 2.2) { box(1, 1.1, 1, stoneM[2], C.x + s, hy + 9.55, C.z - 1.1); }
  [-3.5, 0, 3.5].forEach(x => addCollider(C.x + x, C.z - 6, 4.3, 'keep'));
  // moloz
  for (let i = 0; i < 16; i++) {
    const x = C.x + (rng() * 2 - 1) * (H0 - 3), z = C.z + (rng() * 2 - 1) * (H0 - 3); if (Math.abs(x - C.x) < 7 && z < C.z + 1) continue;
    const s = .4 + rng() * .9, r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneM[i % 3]); r.position.set(x, hy + s * .4, z); r.rotation.set(rng() * 3, rng() * 3, 0); scene.add(r);
  }
}

/* ================= kıyı menhirleri ve taş levhalar ================= */
{
  const rng = mulberry32(4242); let men = 0, slab = 0;
  const near = [[9, 34], [-11, 44], [15, 58], [-6, 70]];   // başlangıç yolu boyunca
  const place = (x, z, isSlab) => {
    const h = heightAt(x, z), ry = rng() * 6.28;
    if (isSlab) { const s = box(2.4 + rng() * 1.8, .45, 1.6 + rng(), stoneM[slab % 3], x, h + .15, z, ry); s.rotation.z = (rng() - .5) * .15; addCollider(x, z, 1.3, 'stone'); slab++; }
    else { const hh = 3.2 + rng() * 2.6, m = box(1.1 + rng() * .5, hh, .8 + rng() * .3, stoneM[men % 3], x, h + hh / 2 - .3, z, ry); m.rotation.z = (rng() - .5) * .2; addCollider(x, z, .9, 'stone'); men++; }
  };
  near.forEach(([x, z], i) => place(x, z, i % 2 === 1));
  for (let i = 0; i < 6000 && (men < 30 || slab < 16); i++) {
    const x = (rng() * 2 - 1) * 160, z = 50 + rng() * 90, h = heightAt(x, z);
    if (h < WATER + .4 || h > WATER + 3.6 || pathDist(x, z) < 3) continue;
    const isSlab = slab < 16 && rng() < .4; if (!isSlab && men >= 30) continue; place(x, z, isSlab);
  }
}

/* ================= kristaller, taş çember, örümcek yuvası ================= */
export const crystals = [];
{
  const rng = mulberry32(555), gm = basic(0x88ddff, MID.GLOW);
  for (let i = 0; i < 9; i++) {
    let x, z, t = 0; do { const a = rng() * 6.28, d = 45 + rng() * 120; x = Math.cos(a) * d; z = Math.sin(a) * d; t++; } while (!isLand(x, z, 0, 12) && t < 200);
    const h = heightAt(x, z), g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(.6), gm); c.scale.y = 1.8; c.position.y = 1.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 9, 4, 1, true), basic(0x1d3a52, MID.GLOW)); beam.position.y = 5.5;
    g.add(c, beam); g.position.set(x, h, z); scene.add(g); crystals.push({ id: i, x, z, mesh: g, gem: c, taken: false });
  }
}
export const CIRCLE = findLand(118, -96);
{
  const h = heightAt(CIRCLE.x, CIRCLE.z), g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i * 6.2832 / 9, x = Math.cos(a) * 7, z = Math.sin(a) * 7;
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.6 + hash2(i, 3) * 1.5, 1.1), stoneM[i % 3]); st.position.set(x, 2.2, z); st.rotation.y = -a; st.rotation.z = (hash2(i, 5) - .5) * .15; g.add(st);
    addCollider(CIRCLE.x + x, CIRCLE.z + z, 1, 'stone');
  }
  const alt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, .7, 8), stoneM[0]); alt.position.y = .35;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 0), basic(0xffffff, MID.GLOW)); orb.position.y = 2;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 60, 5, 1, true), basic(0xffdd88, MID.GLOW)); beam.position.y = 30;
  const L = new THREE.PointLight(0xffddaa, 1.4, 30); L.position.y = 3; g.add(alt, orb, beam, L);
  g.position.set(CIRCLE.x, h, CIRCLE.z); scene.add(g); CIRCLE.orb = orb;
}

{
  const webM = tag(new THREE.LineBasicMaterial({ color: 0xd5dde8 }), MID.GLOW), rng = mulberry32(31);
  const web = (x, z, R, ry, tilt) => {
    const pts = [], sp = 11, rings = 6;
    for (let s = 0; s < sp; s++) { const a = s / sp * 6.283; pts.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0); }
    for (let r = 1; r <= rings; r++) for (let s = 0; s < sp; s++) {
      const a1 = s / sp * 6.283, a2 = (s + 1) / sp * 6.283, r1 = R * r / rings * (.9 + rng() * .15), r2 = R * r / rings * (.9 + rng() * .15);
      pts.push(Math.cos(a1) * r1, Math.sin(a1) * r1, 0, Math.cos(a2) * r2, Math.sin(a2) * r2, 0);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineSegments(g, webM); m.position.set(x, heightAt(x, z) + (tilt ? .15 : R * .9), z); m.rotation.set(tilt ? -Math.PI / 2 : 0, ry, 0); scene.add(m);
  };
  for (let i = 0; i < 9; i++) { const a = rng() * 6.28, d = 4 + rng() * 9; web(LAIR.x + Math.cos(a) * d, LAIR.z + Math.sin(a) * d, 2.5 + rng() * 2.5, rng() * 3, i % 3 === 0); }
}

/* ================= animasyon ================= */
export function updateWorld(t) {
  waterMat.uniforms.uTime.value = t; GU.uTime.value = t;
  const fl = 1 + Math.sin(t * 17) * .12 + Math.sin(t * 29) * .08;
  fireLight.intensity = 2.2 * fl; gateLight.intensity = 1.6 * (1 + Math.sin(t * 13 + 1) * .12);
  for (const f of flames) { const k = 1 + Math.sin(t * 15 + f.ph) * .12 + Math.sin(t * 23 + f.ph) * .07; f.m.scale.set(f.s * k, f.s * k * (1 + Math.sin(t * 11 + f.ph) * .15), f.s * k); }
  lampLights.forEach(l => l.intensity = ENV.night * 1.6);
  for (const c of crystals) if (!c.taken) { c.gem.rotation.y = t * 1.5; c.gem.position.y = 1.5 + Math.sin(t * 2 + c.id) * .25; }
  CIRCLE.orb.rotation.y = t; CIRCLE.orb.position.y = 2 + Math.sin(t * 1.5) * .3;
}
/* Ejderha yuvası: kuzeybatı dağ eteğinde yanık toprak ve kemikler */

{
  const rng = mulberry32(666), bm = lam(0xbdb39a, MID.STONE), ash = lam(0x1a1614, MID.STONE);
  for (let i = 0; i < 26; i++) {
    const a = rng() * 6.28, d = 5 + rng() * 14, x = DRAGON_LAIR.x + Math.cos(a) * d, z = DRAGON_LAIR.z + Math.sin(a) * d, h = heightAt(x, z);
    const m = new THREE.Mesh(i % 3 ? new THREE.CylinderGeometry(.08, .1, 1.4 + rng() * 1.5, 6) : new THREE.SphereGeometry(.35, 8, 6), i % 5 ? bm : ash);
    m.position.set(x, h + .2, z); m.rotation.set(rng() * 2 - 1, rng() * 3, rng() * 2 - 1); scene.add(m);
  }
  for (let i = 0; i < 10; i++) { const a = rng() * 6.28, d = rng() * 12; box(1.4 + rng() * 2, .5 + rng(), 1.2 + rng(), ash, DRAGON_LAIR.x + Math.cos(a) * d, heightAt(DRAGON_LAIR.x + Math.cos(a) * d, DRAGON_LAIR.z + Math.sin(a) * d) + .1, DRAGON_LAIR.z + Math.sin(a) * d, rng() * 3); }
}
/* Tüm statik dünya nesneleri gölge atar ve alır */
scene.traverse(o => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
