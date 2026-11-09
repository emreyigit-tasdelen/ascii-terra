// Detaylı prosedürel modeller: plaka zırhlı şövalyeler, iskeletler, dev kurt, dev örümcek, ejderha.
// Her vücut parçası tek bir birleşik geometriye (köşe renkli) indirgenir; malzeme türüne göre
// metal (parlak), mat, kumaş (çift yüzlü) ve parlayan olarak ayrılır. Böylece detay yüksek, çizim çağrısı düşük kalır.
import { THREE, lerp, clamp, vnoise, hash2, mulberry32, MID, tag } from './core.js';

/* ================= geometri yardımcıları ================= */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
const n3 = (x, y, z) => vnoise(x + z * 1.71, y - z * .93) * .6 + vnoise(x * 2.1 - z * .37 + 9, y * 2.1 + z * 1.3) * .4;
function xf(g, p, r, s) { _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _q.setFromEuler(_e); _m.compose(_p.set(...(p || [0, 0, 0])), _q, _s.set(...(s || [1, 1, 1]))); g.applyMatrix4(_m); return g; }
const sph = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);
const cap = (r, w = 14, h = 7) => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2);
const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const ell = (rx, ry, rz, w = 16, h = 12) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);

/* Eğri boyunca incelen tüp: r0/r1 sayı ya da r(t) fonksiyonu */
function taper(pts, r0, r1, ts = 10, rs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, ts, 1, rs, false), pos = g.attributes.position, P = new THREE.Vector3();
  for (let i = 0; i <= ts; i++) {
    const t = i / ts, r = typeof r0 === 'function' ? r0(t) : lerp(r0, r1, t); curve.getPointAt(t, P);
    for (let j = 0; j <= rs; j++) { const k = i * (rs + 1) + j; pos.setXYZ(k, P.x + (pos.getX(k) - P.x) * r, P.y + (pos.getY(k) - P.y) * r, P.z + (pos.getZ(k) - P.z) * r); }
  }
  g.computeVertexNormals(); g.userData.curve = curve; return g;
}
/* Normal yönünde gürültüyle yüzey bozma (tüy, pul, kas) */
function displace(g, amp, freq, seed = 0, fn) {
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let d = (n3(x * freq + seed, y * freq, z * freq) - .5) * 2 * amp; if (fn) d += fn(x, y, z);
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  g.computeVertexNormals(); return g;
}
/* Kıvrımlı kumaş etek/pelerin */
function foldCloth(rt, rb, h, folds = 9, tat = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, 32, 6, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = (h / 2 - y) / h;
    const f = 1 + Math.sin(a * folds) * .06 * t + Math.sin(a * 4 + 1) * .03 * t;
    const hem = tat && t > .95 ? hash2(Math.round(a * 14), 7) * .14 : 0;
    p.setXYZ(i, x * f, y + hem, z * f);
  }
  g.computeVertexNormals(); return g;
}
function orientTo(g, dir) { _q.setFromUnitVectors(_up, _d.copy(dir).normalize()); _m.makeRotationFromQuaternion(_q); g.applyMatrix4(_m); return g; }

/* ================= malzemeler ================= */
const MATS = {};
function kmat(kind, id) {
  const key = kind + id; if (MATS[key]) return MATS[key];
  let m;
  if (kind === 'glow') m = tag(new THREE.MeshBasicMaterial({ vertexColors: true }), MID.GLOW);
  else if (kind === 'metal') m = tag(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x8a8a8a }), id);
  else if (kind === 'gloss') m = tag(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x404040 }), id);
  else if (kind === 'cloth') m = tag(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 4, specular: 0x080808, side: THREE.DoubleSide }), id);
  else m = tag(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 8, specular: 0x141414 }), id);
  return MATS[key] = m;
}
const FLASH = {};
export const flashMat = id => FLASH[id] || (FLASH[id] = tag(new THREE.MeshBasicMaterial({ color: 0xffffff }), id));

function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  r.computeBoundingSphere(); return r;
}

/* Parça kurucu: geometrileri renklendirip malzeme türüne göre birleştirir */
export class PB {
  constructor(id) { this.id = id; this.k = {}; }
  add(geo, color, kind = 'matte', p, r, s, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const a of ['uv', 'uv2']) if (g.attributes[a]) g.deleteAttribute(a);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.matrix) g.applyMatrix4(o.matrix); else xf(g, p, r, s);
    const pos = g.attributes.position, nor = g.attributes.normal, cnt = pos.count, col = new Float32Array(cnt * 3);
    const c = new THREE.Color(color), c2 = o.color2 != null ? new THREE.Color(o.color2) : null, vary = o.vary ?? .12, f = o.freq ?? 14;
    for (let i = 0; i < cnt; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let R = c.r, G = c.g, B = c.b;
      if (c2) { const t = clamp(o.mix(x, y, z, nor.getX(i), nor.getY(i), nor.getZ(i)), 0, 1); R = lerp(R, c2.r, t); G = lerp(G, c2.g, t); B = lerp(B, c2.b, t); }
      const v = 1 + (n3(x * f, y * f, z * f) - .5) * 2 * vary;
      col[i * 3] = R * v; col[i * 3 + 1] = G * v; col[i * 3 + 2] = B * v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.k[kind] || (this.k[kind] = [])).push(g); return this;
  }
  build() {
    const grp = new THREE.Group();
    for (const kind in this.k) {
      const m = new THREE.Mesh(merge(this.k[kind]), kmat(kind, this.id));
      m.castShadow = kind !== 'glow'; m.receiveShadow = kind !== 'glow'; m.userData.orig = m.material; grp.add(m);
    }
    return grp;
  }
}
export function meshesOf(g) { const a = []; g.traverse(o => { if (o.isMesh) a.push(o); }); return a; }

/* ================= iki ayaklı iskelet (rig) ================= */
function rig() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = .98; g.add(body);
  const spine = new THREE.Group(); spine.position.y = .06; body.add(spine);
  const neck = new THREE.Group(); neck.position.y = .5; spine.add(neck);
  const arm = s => { const p = new THREE.Group(); p.position.set(s * .25, .44, 0); spine.add(p); const el = new THREE.Group(); el.position.y = -.29; p.add(el); const hand = new THREE.Group(); hand.position.y = -.3; el.add(hand); return { p, el, hand }; };
  const leg = s => { const p = new THREE.Group(); p.position.set(s * .1, 0, 0); body.add(p); const kn = new THREE.Group(); kn.position.y = -.46; p.add(kn); const ft = new THREE.Group(); ft.position.y = -.45; kn.add(ft); return { p, kn, ft }; };
  return { g, body, spine, neck, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1) };
}

/* ================= silahlar ================= */
export function makeSword(o = {}) {
  const pb = new PB(o.id ?? MID.ACTOR), G = o.guard ?? 0x8a7a5a, L = o.len ?? .92;
  const sh = new THREE.Shape(); sh.moveTo(-.026, 0); sh.lineTo(-.023, L - .12); sh.lineTo(0, L); sh.lineTo(.023, L - .12); sh.lineTo(.026, 0); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: .01, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1 }); bg.translate(0, 0, -.005);
  pb.add(bg, o.blade ?? 0xdfe5ee, 'metal', [0, .1, 0], 0, 0, { vary: o.rust ? .4 : .05, freq: 30 });
  pb.add(box(.008, L * .66, .022), 0x5a6068, 'metal', [0, .1 + L * .36, 0]);
  pb.add(box(.25, .028, .04), G, 'metal', [0, .09, 0]);
  [-1, 1].forEach(s => pb.add(sph(.022, 8, 6), G, 'metal', [s * .125, .09, 0]));
  pb.add(cyl(.017, .017, .17, 8), 0x2a1a10, 'matte');
  pb.add(sph(.03, 10, 8), G, 'metal', [0, -.1, 0]);
  return pb.build();
}
function makeAxe(o = {}) {
  const pb = new PB(o.id ?? MID.ACTOR);
  pb.add(cyl(.018, .02, .9, 7), 0x3a2818, 'matte', [0, .35, 0], 0, 0, { vary: .3 });
  const s = new THREE.Shape(); s.moveTo(0, -.09); s.quadraticCurveTo(.2, -.16, .24, 0); s.quadraticCurveTo(.2, .16, 0, .09); s.closePath();
  const bl = new THREE.ExtrudeGeometry(s, { depth: .015, bevelEnabled: false }); bl.translate(.02, 0, -.007);
  pb.add(bl, o.blade ?? 0x6e6458, 'metal', [0, .72, 0], 0, 0, { vary: .45, freq: 25 });
  return pb.build();
}
function makeShield(o = {}) {
  const pb = new PB(o.id ?? MID.ACTOR);
  const s = new THREE.Shape(); s.moveTo(-.22, .26); s.lineTo(.22, .26); s.lineTo(.22, 0); s.quadraticCurveTo(.2, -.3, 0, -.42); s.quadraticCurveTo(-.2, -.3, -.22, 0); s.closePath();
  const bend = (g, k) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - p.getX(i) * p.getX(i) * k); g.computeVertexNormals(); return g; };
  pb.add(bend(new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 1 }), .5), o.face ?? 0x7a1414, 'matte', 0, 0, 0, { vary: .18 });
  pb.add(bend(new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: false }), .5), o.rim ?? 0x9aa0a8, 'metal', [0, 0, -.012], 0, [1.07, 1.05, 1]);
  if (o.emblem != null) { pb.add(box(.045, .5, .02), o.emblem, 'matte', [0, -.05, .05]); pb.add(box(.3, .045, .02), o.emblem, 'matte', [0, .08, .045]); }
  return pb.build();
}
function makeRoundShield(id) {
  const pb = new PB(id);
  pb.add(cyl(.2, .2, .03, 16), 0x4a3220, 'matte', 0, [Math.PI / 2, 0, 0], 0, { vary: .35, freq: 18 });
  pb.add(new THREE.TorusGeometry(.2, .012, 4, 20), 0x4a4440, 'metal', [0, 0, .01], 0, 0, { vary: .4 });
  pb.add(cap(.06, 10, 5), 0x5a5048, 'metal', [0, 0, .015], [Math.PI / 2, 0, 0]);
  return pb.build();
}

/* ================= şövalye ================= */
export function makeKnight(o = {}) {
  const id = o.id ?? MID.ACTOR, A = o.armor ?? 0xb3bac5, AD = o.armorDark ?? 0x737a84, CL = o.cloth ?? 0x7a1414, CH = o.chain ?? 0x4a4d53, LE = 0x3a2616, GD = o.gold ?? 0xa88a3a;
  const r = rig(), P = () => new PB(id), chain = { vary: .45, freq: 70 };
  // bel + etek
  const pel = P();
  pel.add(cyl(.2, .27, .44, 18, true), CH, 'metal', [0, -.16, 0], 0, 0, chain);
  pel.add(foldCloth(.235, .34, .6, 9, o.tattered), CL, 'cloth', [0, -.24, 0], 0, 0, { vary: .22, freq: 9 });
  pel.add(new THREE.TorusGeometry(.215, .028, 6, 22), LE, 'matte', [0, .03, 0], [Math.PI / 2, 0, 0]);
  pel.add(box(.07, .06, .03), GD, 'metal', [0, .03, .225]);
  r.body.add(pel.build());
  // gövde: göğüs zırhı, tabard, boyunluk
  const ch = P();
  ch.add(lathe([[0, -.02], [.17, -.02], [.2, .08], [.215, .2], [.205, .32], [.17, .42], [.12, .47], [0, .48]], 22), A, 'metal', 0, 0, [1, 1, .74], { vary: .06, freq: 8 });
  ch.add(lathe([[.19, -.05], [.216, .06], [.229, .18], [.223, .3], [.2, .35]], 22), CL, 'cloth', 0, 0, [1, 1, .77], { vary: .18, freq: 10 });
  if (o.emblem != null) { ch.add(box(.035, .2, .012), o.emblem, 'matte', [0, .17, .178]); ch.add(box(.13, .035, .012), o.emblem, 'matte', [0, .21, .176]); }
  ch.add(lathe([[.12, .43], [.15, .47], [.115, .55], [.09, .565]], 16), A, 'metal');
  r.spine.add(ch.build());
  // miğfer (sivri vizörlü bascinet) + zincir başlık
  const hd = P();
  hd.add(lathe([[0, .32], [.07, .315], [.125, .285], [.158, .22], [.17, .12], [.168, .02], [.152, -.06], [.125, -.1]], 20), A, 'metal', [0, .08, 0], 0, 0, { vary: .05 });
  hd.add(cone(.115, .2, 14), A, 'metal', [0, .12, .14], [Math.PI / 2, 0, 0], [1, .75, 1]);
  [-1, 1].forEach(s => hd.add(box(.062, .013, .03), 0x050505, 'matte', [s * .045, .19, .165]));
  for (let i = 0; i < 4; i++) hd.add(box(.01, .01, .02), 0x050505, 'matte', [-.03 + i * .02, .1, .232]);
  hd.add(box(.014, .05, .26), AD, 'metal', [0, .385, -.01]);
  hd.add(cyl(.16, .25, .2, 18, true), CH, 'metal', [0, -.05, -.01], 0, 0, chain);
  if (o.glowEyes) [-1, 1].forEach(s => hd.add(box(.05, .012, .02), 0xff2a10, 'glow', [s * .045, .19, .17]));
  const head = hd.build(); head.scale.setScalar(.92); r.neck.add(head);
  // kollar: katmanlı omuzluk, kolluk, dirsek kanadı, eldiven
  [r.armL, r.armR].forEach((a, i) => {
    const s = i ? 1 : -1, up = P();
    [[.155, .03], [.168, -.03], [.178, -.09]].forEach(([rr, yy], k) => up.add(cap(rr), k % 2 ? AD : A, 'metal', [s * .03, yy, 0], 0, [1.1, .62, 1.05]));
    up.add(cyl(.062, .058, .27, 12), A, 'metal', [0, -.15, 0]);
    a.p.add(up.build());
    const lo = P();
    lo.add(sph(.068), A, 'metal');
    lo.add(new THREE.SphereGeometry(.09, 10, 6, 0, Math.PI, 0, Math.PI / 2), A, 'metal', [s * .02, 0, -.02], [0, s * Math.PI / 2, 0], [1, .8, .4]);
    lo.add(cyl(.058, .048, .25, 12), A, 'metal', [0, -.14, 0]);
    lo.add(sph(.055, 10, 8), AD, 'metal', [0, -.31, .01], 0, [1, 1.2, .85]);
    lo.add(box(.075, .06, .07), AD, 'metal', [0, -.36, .02]);
    a.el.add(lo.build());
  });
  // bacaklar: kalçalık, dizlik, baldırlık, çelik pabuç
  [r.legL, r.legR].forEach((L, i) => {
    const s = i ? 1 : -1, th = P();
    th.add(cyl(.088, .072, .42, 12), A, 'metal', [0, -.23, 0]);
    th.add(cyl(.098, .092, .12, 12, true), CH, 'metal', [0, -.04, 0], 0, 0, chain);
    L.p.add(th.build());
    const sh = P();
    sh.add(sph(.07), A, 'metal', [0, 0, .01]);
    sh.add(new THREE.SphereGeometry(.085, 10, 6, 0, Math.PI, 0, Math.PI / 2), A, 'metal', [s * .03, 0, 0], [0, s * Math.PI / 2, 0], [1, .7, .35]);
    sh.add(lathe([[.045, -.44], [.058, -.32], [.068, -.2], [.06, -.06], [.05, 0]], 12), A, 'metal');
    L.kn.add(sh.build());
    const ft = P();
    ft.add(sph(.07, 12, 8), AD, 'metal', [0, -.02, .05], 0, [.85, .6, 1.7]);
    for (let k = 0; k < 3; k++) ft.add(sph(.05, 8, 6), A, 'metal', [0, 0, .1 + k * .04], 0, [1.1, .5, .8]);
    L.ft.add(ft.build());
  });
  // pelerin
  if (o.cape !== false) {
    const CL2 = .98, cg = new THREE.PlaneGeometry(.44, CL2, 10, 14), p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = (CL2 / 2 - y) / CL2;
      p.setZ(i, -Math.abs(Math.sin(x * 26)) * .045 * (.3 + t) - t * t * .1 - Math.cos(x * 5) * .03); p.setX(i, x * (1 + t * .45));
      if (o.tattered && t > .88) p.setY(i, y + hash2(Math.round(x * 40), 3) * .14);
    }
    cg.computeVertexNormals();
    const cp = new PB(id); cp.add(cg, o.capeColor ?? 0x1c0505, 'cloth', [0, -CL2 / 2, 0], 0, 0, { vary: .3, freq: 20 });
    const cape = new THREE.Group(); cape.position.set(0, .43, -.17); cape.add(cp.build()); r.spine.add(cape); r.cape = cape;
  }
  // silah ve kalkan
  const sw = makeSword({ id, blade: o.blade, guard: o.guardColor ?? GD }); sw.rotation.x = 1.35; r.armR.hand.add(sw); r.weapon = sw;
  if (o.shield !== false) { const sd = makeShield({ id, face: o.shieldFace ?? CL, emblem: o.emblem, rim: A }); sd.position.set(-.1, -.13, .04); sd.rotation.y = -Math.PI / 2 + .4; r.armL.el.add(sd); }
  r.meshes = meshesOf(r.g); return r;
}

/* ================= cübbeli köylü / bilge ================= */
export function makeRobed(o) {
  const id = MID.ACTOR, r = rig(); r.legL.p.visible = r.legR.p.visible = false;
  const robe = new PB(id), RB = o.robe, HD = o.hood ?? o.robe, SK = o.skin ?? 0xb08a6a;
  robe.add(displace(lathe([[.36, -.97], [.31, -.6], [.25, -.2], [.21, .1], [.215, .35], [.19, .5], [.12, .56]], 24), .012, 6, 1,
    (x, y, z) => Math.sin(Math.atan2(z, x) * 10) * .018 * clamp(-y, 0, 1)), RB, 'cloth', 0, 0, [1, 1, .85], { vary: .22, freq: 9 });
  robe.add(new THREE.TorusGeometry(.21, .018, 5, 18), 0x5a4a30, 'matte', [0, .05, 0], [Math.PI / 2, 0, 0], [1, .85, 1]);
  r.body.add(robe.build());
  const hd = new PB(id);
  hd.add(sph(.095, 12, 10), SK, 'matte', [0, .12, .01], 0, [.9, 1.1, 1]);
  hd.add(cone(.018, .05, 5), SK, 'matte', [0, .12, .1], [Math.PI / 2, 0, 0]);
  hd.add(lathe([[.15, -.04], [.17, .08], [.165, .2], [.12, .29], [.05, .32], [0, .325]], 16), HD, 'cloth', [0, .02, -.03], 0, [1, 1, 1.1], { vary: .2 });
  if (o.beard) hd.add(cone(.07, .18, 8), o.beard, 'matte', [0, .0, .07], [Math.PI, 0, 0]);
  r.neck.add(hd.build());
  [r.armL, r.armR].forEach(a => {
    const u = new PB(id); u.add(cyl(.07, .09, .3, 10, true), RB, 'cloth', [0, -.15, 0], 0, 0, { vary: .2 }); a.p.add(u.build());
    const l = new PB(id); l.add(cyl(.09, .12, .27, 10, true), RB, 'cloth', [0, -.13, 0], 0, 0, { vary: .2 }); l.add(sph(.042, 8, 6), SK, 'matte', [0, -.3, 0]); a.el.add(l.build());
  });
  if (o.staff) {
    const st = new PB(id); st.add(taper([[0, -.9, 0], [0, .2, 0], [.03, .9, 0], [0, 1.05, 0]], .025, .018, 12, 6), 0x4a3424, 'matte', 0, 0, 0, { vary: .3 });
    st.add(new THREE.OctahedronGeometry(.07), o.staff, 'glow', [0, 1.13, 0], 0, [1, 1.6, 1]);
    const g = st.build(); g.position.set(0, .05, .02); r.armR.hand.add(g);
  }
  if (o.bow) { const b = new PB(id); b.add(new THREE.TorusGeometry(.55, .02, 5, 16, Math.PI * .9), 0x4a3424, 'matte', 0, [0, 0, Math.PI / 2 + .15]); b.add(cyl(.06, .06, .5, 8), 0x3a2a1a, 'matte', [.12, -.05, -.05], [0, 0, .2]); const g = b.build(); g.position.set(0, .2, -.2); r.spine.add(g); }
  r.meshes = meshesOf(r.g); return r;
}

/* ================= iskelet savaşçı ================= */
export function makeSkeleton(seed = 1) {
  const id = MID.ACTOR, B = 0xcdc3a9, D = 0x120d08, rng = mulberry32(seed * 977 + 13), r = rig(), bv = { vary: .25, freq: 22 };
  const bone = (pb, len, rad, p) => {
    pb.add(cyl(rad, rad * .85, len, 6), B, 'matte', [p[0], p[1] - len / 2, p[2]], 0, 0, bv);
    pb.add(sph(rad * 1.7, 7, 5), B, 'matte', [p[0], p[1], p[2]], 0, 0, bv); pb.add(sph(rad * 1.5, 7, 5), B, 'matte', [p[0], p[1] - len, p[2]], 0, 0, bv);
  };
  // leğen
  const pel = new PB(id);
  pel.add(lathe([[.05, .07], [.13, .05], [.15, -.01], [.11, -.07], [.04, -.08]], 12), B, 'matte', 0, 0, [1, 1, .7], bv);
  if (rng() < .7) pel.add(foldCloth(.17, .24, .38, 7, true), 0x2e2218, 'cloth', [0, -.17, 0], 0, 0, { vary: .35 });
  r.body.add(pel.build());
  // omurga + kaburgalar
  const sp = new PB(id);
  for (let k = 0; k < 9; k++) { const z = -.02 - .025 * Math.sin(k * .45); sp.add(cyl(.026, .026, .034, 6), B, 'matte', [0, k * .054, z], 0, 0, bv); sp.add(box(.012, .02, .045), B, 'matte', [0, k * .054, z - .04], 0, 0, bv); }
  for (let k = 0; k < 6; k++) {
    const R = .095 + .045 * Math.sin((k + 1) / 7 * Math.PI), a = 2.55, g = new THREE.TorusGeometry(R, .011, 4, 14, a);
    g.rotateX(Math.PI / 2); g.rotateY(a / 2 + Math.PI / 2); g.scale(1, 1, .8); g.rotateX(.18);
    sp.add(g, B, 'matte', [0, .17 + k * .046, -.01], 0, 0, bv);
  }
  sp.add(box(.026, .17, .016), B, 'matte', [0, .3, .11], 0, 0, bv);
  sp.add(box(.34, .017, .017), B, 'matte', [0, .44, .03], 0, 0, bv);
  r.spine.add(sp.build());
  // kafatası
  const hd = new PB(id);
  hd.add(sph(.11, 16, 12), B, 'matte', [0, .13, 0], 0, [.95, 1, 1.12], bv);
  hd.add(sph(.07, 12, 8), B, 'matte', [0, .06, .06], 0, [1, .7, 1], bv);
  [-1, 1].forEach(s => { hd.add(sph(.032, 8, 6), D, 'matte', [s * .042, .115, .095]); hd.add(sph(.011, 6, 4), 0x8fd0ff, 'glow', [s * .042, .115, .11]); });
  hd.add(cone(.016, .04, 4), D, 'matte', [0, .075, .113], [Math.PI, 0, 0]);
  for (let i = 0; i < 6; i++) hd.add(box(.011, .016, .01), 0xe8e0c8, 'matte', [-.03 + i * .012, .035, .105]);
  hd.add(cyl(.024, .024, .07, 6), B, 'matte', [0, -.02, -.01], 0, 0, bv);
  if (rng() < .5) { hd.add(lathe([[0, .3], [.08, .29], [.125, .24], [.135, .14]], 14), 0x5a4030, 'metal', [0, .02, 0], 0, 0, { vary: .5, freq: 30 }); hd.add(new THREE.TorusGeometry(.155, .022, 4, 18), 0x4a3424, 'metal', [0, .16, 0], [Math.PI / 2, 0, 0], 0, { vary: .5 }); }
  r.neck.add(hd.build());
  const jaw = new PB(id); const jg = new THREE.TorusGeometry(.055, .014, 4, 10, Math.PI); jg.rotateX(Math.PI / 2); jg.rotateY(Math.PI);
  jaw.add(jg, B, 'matte', [0, 0, .05], 0, [1, 1, 1.1], bv); jaw.add(box(.04, .03, .02), B, 'matte', [0, -.005, .1], 0, 0, bv);
  for (let i = 0; i < 5; i++) jaw.add(box(.01, .014, .01), 0xe8e0c8, 'matte', [-.024 + i * .012, .014, .1]);
  const jawG = jaw.build(); jawG.position.set(0, .05, 0); r.neck.add(jawG); r.jaw = jawG;
  // kollar
  [r.armL, r.armR].forEach(a => {
    const u = new PB(id); bone(u, .27, .018, [0, 0, 0]); a.p.add(u.build());
    const l = new PB(id); bone(l, .24, .011, [.012, 0, 0]); bone(l, .24, .011, [-.012, 0, 0]);
    l.add(box(.05, .04, .02), B, 'matte', [0, -.27, 0], 0, 0, bv);
    for (let f = 0; f < 4; f++) l.add(cone(.006, .08, 4), B, 'matte', [-.018 + f * .012, -.33, .005], [Math.PI, 0, (f - 1.5) * .12]);
    a.el.add(l.build());
  });
  // bacaklar
  [r.legL, r.legR].forEach(L => {
    const t = new PB(id); bone(t, .43, .024, [0, 0, 0]); L.p.add(t.build());
    const s = new PB(id); bone(s, .42, .02, [0, 0, 0]); bone(s, .4, .009, [.025, -.01, -.01]); L.kn.add(s.build());
    const f = new PB(id); f.add(box(.05, .025, .12), B, 'matte', [0, -.01, .04], 0, 0, bv); for (let k = 0; k < 4; k++) f.add(cone(.006, .05, 4), B, 'matte', [-.018 + k * .012, -.015, .12], [Math.PI / 2, 0, 0]); L.ft.add(f.build());
  });
  // silah + kalkan
  const w = rng() < .55 ? makeSword({ id, blade: 0x6e6050, guard: 0x4a3a2a, rust: true, len: .8 }) : makeAxe({ id });
  w.rotation.x = 1.35; r.armR.hand.add(w); r.weapon = w;
  if (rng() < .45) { const sh = makeRoundShield(id); sh.position.set(-.08, -.15, .03); sh.rotation.y = -Math.PI / 2 + .4; r.armL.el.add(sh); }
  r.meshes = meshesOf(r.g); return r;
}

/* ================= dev kurt ================= */
export function makeWolf(seed = 1) {
  const id = MID.CREATURE, g = new THREE.Group(), body = new THREE.Group(); body.position.y = .82; g.add(body);
  const DK = 0x3a342d, LT = 0x7a7062, fur = { color2: LT, mix: (x, y, z, nx, ny) => .45 - ny * .7, vary: .35, freq: 32 };
  const tb = new PB(id);
  tb.add(displace(ell(.3, .36, .4, 20, 14), .045, 15, seed), DK, 'matte', [0, .06, .32], 0, 0, fur);
  tb.add(displace(ell(.26, .3, .44, 20, 14), .04, 15, seed + 3), DK, 'matte', [0, .02, -.12], 0, 0, fur);
  tb.add(displace(ell(.24, .27, .3, 18, 12), .04, 15, seed + 5), DK, 'matte', [0, .05, -.55], 0, 0, fur);
  tb.add(displace(ell(.34, .38, .32, 20, 14), .08, 12, seed + 7), DK, 'matte', [0, .12, .45], 0, 0, fur);
  for (let k = 0; k < 22; k++) { const z = .6 - k * .06, y = .38 - Math.abs(z - .1) * .12; tb.add(cone(.028, .13, 4), DK, 'matte', [(hash2(k, seed) - .5) * .12, y, z], [-1.2, 0, (hash2(k, 9) - .5) * .6], 0, { vary: .3 }); }
  body.add(tb.build());
  const head = new THREE.Group(); head.position.set(0, .22, .72); body.add(head);
  const hb = new PB(id);
  hb.add(taper([[0, 0, 0], [0, .1, .16], [0, .14, .26]], .18, .13, 6, 10), DK, 'matte', 0, 0, 0, fur);
  hb.add(displace(ell(.16, .14, .19, 16, 12), .02, 18, seed), DK, 'matte', [0, .16, .32], 0, 0, fur);
  hb.add(taper([[0, .14, .42], [0, .11, .62]], .085, .045, 6, 10), DK, 'matte', 0, 0, 0, { vary: .25 });
  hb.add(sph(.034, 8, 6), 0x050505, 'gloss', [0, .115, .64]);
  [-1, 1].forEach(s => {
    hb.add(cone(.045, .15, 5), DK, 'matte', [s * .08, .31, .28], [-.35, 0, s * .2]);
    hb.add(sph(.02, 6, 5), 0xffa21a, 'glow', [s * .066, .2, .45]);
    for (let k = 0; k < 3; k++) hb.add(cone(.008, .04, 4), 0xe8e2d0, 'gloss', [s * (.03 - k * .005), .08, .5 + k * .04], [Math.PI, 0, 0]);
  });
  head.add(hb.build());
  const jaw = new THREE.Group(); jaw.position.set(0, .08, .4); head.add(jaw);
  const jb = new PB(id); jb.add(taper([[0, 0, 0], [0, -.01, .2]], .055, .035, 5, 8), DK, 'matte', 0, 0, 0, { vary: .25 });
  [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) jb.add(cone(.007, .035, 4), 0xe8e2d0, 'gloss', [s * (.025 - k * .004), .03, .06 + k * .045]); });
  jaw.add(jb.build());
  const legs = [];
  [[-.16, -.02, .42, 1], [.16, -.02, .42, 1], [-.15, 0, -.55, 0], [.15, 0, -.55, 0]].forEach(([x, y, z, front]) => {
    const piv = new THREE.Group(); piv.position.set(x, y, z); body.add(piv);
    const up = new PB(id), kn = new THREE.Group(), lo = new PB(id);
    if (front) { up.add(taper([[0, .05, 0], [0, -.38, -.03]], .08, .05, 6, 9), DK, 'matte', 0, 0, 0, fur); kn.position.set(0, -.38, -.03); lo.add(taper([[0, 0, 0], [0, -.36, .02]], .046, .034, 5, 8), DK, 'matte', 0, 0, 0, { vary: .25 }); }
    else { up.add(displace(taper([[0, .05, 0], [0, -.15, .08], [0, -.3, .12]], .11, .055, 6, 9), .02, 15), DK, 'matte', 0, 0, 0, fur); kn.position.set(0, -.3, .12); lo.add(taper([[0, 0, 0], [0, -.22, -.1], [0, -.44, -.05]], .045, .032, 6, 8), DK, 'matte', 0, 0, 0, { vary: .25 }); }
    lo.add(ell(.05, .028, .07, 8, 6), DK, 'matte', [0, front ? -.37 : -.45, .04]);
    for (let k = 0; k < 3; k++) lo.add(cone(.008, .04, 4), 0x1a1612, 'gloss', [(k - 1) * .02, front ? -.38 : -.46, .1], [Math.PI / 2, 0, 0]);
    piv.add(up.build()); piv.add(kn); kn.add(lo.build()); legs.push({ piv, kn, front });
  });
  const tail = new THREE.Group(); tail.position.set(0, .12, -.78); body.add(tail);
  const tl = new PB(id); tl.add(displace(taper([[0, 0, 0], [0, -.12, -.22], [0, -.36, -.38], [0, -.58, -.42]], .075, .03, 10, 8), .035, 14), DK, 'matte', 0, 0, 0, fur); tail.add(tl.build());
  return { g, body, head, jaw, legs, tail, meshes: meshesOf(g) };
}

/* ================= dev örümcek ================= */
export function makeSpider() {
  const id = MID.CREATURE, g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.3; g.add(body);
  const DK = 0x2e241b, rng = mulberry32(31337), pb = new PB(id);
  const abC = [0, .2, -1.15], abR = [.95, .78, 1.18];
  pb.add(displace(ell(...abR, 28, 20), .06, 9), DK, 'matte', abC, 0, 0, {
    color2: 0x8a1010, vary: .45, freq: 55,
    mix: (x, y, z, nx, ny) => (ny > .55 && Math.abs(x) < .12 + Math.abs(z - abC[2]) * .25 && Math.abs(z - abC[2]) < .55 && Math.abs(Math.abs(z - abC[2]) - .28) > .06) ? 1 : 0
  });
  for (let k = 0; k < 240; k++) {   // abdomen kılları
    const u = rng() * 2 - 1, a = rng() * 6.283, s = Math.sqrt(1 - u * u), dir = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
    if (dir.y < -.5) continue;
    const pnt = new THREE.Vector3(dir.x * abR[0], dir.y * abR[1], dir.z * abR[2]).multiplyScalar(1.01).add(new THREE.Vector3(...abC));
    const c = cone(.014, .14 + rng() * .1, 4); orientTo(c, new THREE.Vector3(dir.x / abR[0], dir.y / abR[1], dir.z / abR[2]));
    c.translate(pnt.x, pnt.y, pnt.z); pb.add(c, 0x3a2e24, 'matte', 0, 0, 0, { vary: .3 });
  }
  pb.add(displace(ell(.55, .36, .62, 22, 16), .03, 12), DK, 'matte', [0, .05, .3], 0, 0, { vary: .35, freq: 40 });
  pb.add(ell(.32, .28, .3, 16, 12), DK, 'gloss', [0, .08, .85], 0, 0, { vary: .2 });
  [[-.08, .26, 1.08, .06], [.08, .26, 1.08, .06], [-.17, .22, 1.02, .03], [.17, .22, 1.02, .03], [-.12, .32, 1.0, .03], [.12, .32, 1.0, .03], [-.04, .34, 1.04, .025], [.04, .34, 1.04, .025]]
    .forEach(([x, y, z, rr]) => pb.add(sph(rr, 8, 6), 0xff2410, 'glow', [x, y, z]));
  [-1, 1].forEach(s => { pb.add(ell(.1, .16, .1, 10, 8), 0x120d0a, 'gloss', [s * .09, -.08, 1.08]); pb.add(taper([[s * .09, -.2, 1.12], [s * .08, -.34, 1.16], [s * .06, -.44, 1.1]], .03, .006, 6, 5), 0x0a0806, 'gloss'); });
  body.add(pb.build());
  const legs = [];
  const seg = (len, r0, r1, hairs) => { const s = new PB(id); s.add(taper([[0, 0, 0], [0, len, 0]], r0, r1, 6, 7), DK, 'matte', 0, 0, 0, { vary: .35, freq: 40 }); s.add(sph(r0 * 1.25, 8, 6), DK, 'gloss');
    for (let k = 0; k < hairs; k++) { const y = (k + .5) / hairs * len, a = k * 2.4; s.add(cone(.008, .1, 3), 0x3a2e24, 'matte', [Math.cos(a) * r0, y, Math.sin(a) * r0], [Math.sin(a) * .9, 0, -Math.cos(a) * .9]); }
    return s.build(); };
  [-1, 1].forEach(s => {
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group(); piv.position.set(s * .32, .02, .62 - i * .27); piv.rotation.y = -s * (1.5 - i) * .38; body.add(piv);
      const up = new THREE.Group(); up.rotation.z = -s * 1.05; piv.add(up); up.add(seg(1.25, .085, .06, 8));
      const kn = new THREE.Group(); kn.position.y = 1.25; kn.rotation.z = -s * 1.85; up.add(kn); kn.add(seg(1.35, .062, .04, 8));
      const an = new THREE.Group(); an.position.y = 1.35; an.rotation.z = s * .5; kn.add(an); an.add(seg(.9, .04, .014, 4));
      legs.push({ piv, up, kn, an, s, i });
    }
  });
  return { g, body, legs, meshes: meshesOf(g) };
}

/* ================= ejderha ================= */
export function makeDragon() {
  const id = MID.CREATURE, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const SC = 0x4e2c1f, BL = 0x8f6c48, HN = 0x24140e, BN = 0x9a8a6c;
  const scales = { color2: BL, mix: (x, y, z, nx, ny) => clamp(-ny * 1.6 - .1, 0, 1), vary: .4, freq: 7 };
  const bumps = (x, y, z) => Math.max(0, Math.sin(x * 9 + Math.sin(z * 9) * 1.5) * Math.sin(z * 9)) * .05;
  const spinePts = [[0, 2.7, 3.2], [0, 2.35, 1.6], [0, 2.2, 0], [0, 2.3, -1.8], [0, 2.0, -3.6], [.6, 1.4, -5.6], [1.6, .9, -7.4], [2.8, .6, -8.6]];
  const rad = t => t < .08 ? lerp(.55, 1.05, t / .08) : t < .3 ? lerp(1.05, 1.15, (t - .08) / .22) : t < .45 ? lerp(1.15, .85, (t - .3) / .15) : lerp(.85, .06, Math.pow((t - .45) / .55, .8));
  const tor = new PB(id);
  const tg = displace(taper(spinePts, rad, 0, 72, 18), .02, 6, 0, bumps); tg.scale(.85, 1, 1);
  tor.add(tg, SC, 'matte', 0, 0, 0, scales);
  const curve = new THREE.CatmullRomCurve3(spinePts.map(p => new THREE.Vector3(...p))), P = new THREE.Vector3();
  for (let t = .04; t < .92; t += .035) { curve.getPointAt(t, P); const s = lerp(1, .22, t); tor.add(cone(.13 * s, .6 * s, 5), HN, 'gloss', [P.x, P.y + rad(t) * .93, P.z], [-.5, 0, 0]); }
  tor.add(displace(taper([[0, 2.7, 3.2], [0, 3.4, 4.1], [0, 4.0, 4.9], [0, 4.2, 5.6]], .62, .38, 22, 14), .02, 7, 2, bumps), SC, 'matte', 0, 0, 0, scales);
  for (let k = 0; k < 6; k++) { const t = k / 6; tor.add(cone(.09, .35, 5), HN, 'gloss', [0, lerp(3.2, 4.5, t), lerp(3.6, 5.5, t)], [-.6, 0, 0]); }
  body.add(tor.build());
  // kafa
  const head = new THREE.Group(); head.position.set(0, 4.2, 5.6); body.add(head);
  const hb = new PB(id);
  hb.add(displace(ell(.5, .42, .75, 20, 14), .03, 9, 4, bumps), SC, 'matte', [0, .1, .35], 0, 0, scales);
  hb.add(taper([[0, .05, .8], [0, -.02, 1.65]], .32, .18, 8, 12), SC, 'matte', 0, 0, 0, scales);
  [-1, 1].forEach(s => {
    hb.add(taper([[s * .25, .35, .2], [s * .45, .65, -.35], [s * .5, .62, -1.15]], .11, .01, 10, 7), BN, 'gloss', 0, 0, 0, { vary: .25 });
    hb.add(taper([[s * .4, .15, .1], [s * .6, .2, -.3]], .06, .01, 5, 5), BN, 'gloss');
    hb.add(sph(.065, 8, 6), 0xffb020, 'glow', [s * .3, .27, .72]);
    hb.add(box(.18, .05, .2), HN, 'gloss', [s * .26, .36, .66], [0, s * .3, 0]);
    hb.add(sph(.03, 6, 4), 0x050505, 'matte', [s * .08, .05, 1.62]);
    for (let k = 0; k < 7; k++) hb.add(cone(.022, .1, 4), 0xe0d6bc, 'gloss', [s * (.2 - k * .015), -.12, .85 + k * .11], [Math.PI, 0, 0]);
  });
  head.add(hb.build());
  const jaw = new THREE.Group(); jaw.position.set(0, -.15, .3); head.add(jaw);
  const jb = new PB(id); jb.add(taper([[0, 0, 0], [0, -.05, 1.25]], .25, .13, 8, 10), SC, 'matte', 0, 0, 0, scales);
  [-1, 1].forEach(s => { for (let k = 0; k < 7; k++) jb.add(cone(.02, .09, 4), 0xe0d6bc, 'gloss', [s * (.16 - k * .013), .1, .15 + k * .14]); });
  jaw.add(jb.build());
  // bacaklar
  const legs = [];
  [[-.95, 1.9, 1.7], [.95, 1.9, 1.7], [-.85, 2.0, -1.7], [.85, 2.0, -1.7]].forEach(([x, y, z], i) => {
    const piv = new THREE.Group(); piv.position.set(x, y, z); body.add(piv);
    const up = new PB(id); up.add(displace(taper([[0, .2, 0], [0, -.9, .15]], .4, .27, 8, 12), .02, 6, i, bumps), SC, 'matte', 0, 0, 0, scales); piv.add(up.build());
    const kn = new THREE.Group(); kn.position.set(0, -.9, .15); piv.add(kn);
    const lo = new PB(id); lo.add(taper([[0, 0, 0], [0, -.85, -.2]], .25, .18, 8, 10), SC, 'matte', 0, 0, 0, scales);
    lo.add(ell(.3, .14, .45, 12, 8), SC, 'matte', [0, -.92, .05], 0, 0, scales);
    for (let k = 0; k < 3; k++) lo.add(cone(.05, .28, 5), BN, 'gloss', [(k - 1) * .16, -.95, .45], [Math.PI / 2 - .3, 0, 0]);
    kn.add(lo.build()); legs.push({ piv, kn, front: i < 2 });
  });
  // kanatlar
  const wings = [];
  [-1, 1].forEach(s => {
    const wg = new THREE.Group(); wg.position.set(s * .75, 2.9, 1.3); body.add(wg);
    const wb = new PB(id), W = [s * 2.8, 1.6, -.6], F = [[s * 5.2, 1.2, -1.2], [s * 4.9, .2, -2.3], [s * 3.9, -.5, -3.2], [s * 2.4, -.6, -3.6]], Bk = [s * .25, -.4, -2.8];
    wb.add(taper([[0, 0, 0], [s * 1.6, 1.0, -.3], W], .16, .09, 10, 8), SC, 'matte', 0, 0, 0, scales);
    F.forEach(f => wb.add(taper([W, f], .08, .02, 6, 6), SC, 'matte', 0, 0, 0, scales));
    wb.add(cone(.07, .35, 5), BN, 'gloss', [W[0], W[1] + .2, W[2]], [0, 0, -s * .3]);
    const tris = [W, F[0], F[1], W, F[1], F[2], W, F[2], F[3], W, F[3], Bk, [0, 0, 0], W, Bk];
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    mg.computeVertexNormals();
    wb.add(mg, 0x2a0f0c, 'cloth', 0, 0, 0, { vary: .3, freq: 3 });
    wg.add(wb.build()); wings.push({ g: wg, s });
  });
  return { g, body, head, jaw, legs, wings, meshes: meshesOf(g) };
}

/* ================= animasyon ================= */
export function animBiped(r, ph, amt, atk, t = 0) {
  const s = Math.sin(ph), c = Math.cos(ph);
  r.legL.p.rotation.x = s * .55 * amt; r.legR.p.rotation.x = -s * .55 * amt;
  r.legL.kn.rotation.x = (.06 + .85 * Math.max(0, Math.sin(ph - .9))) * amt + .04;
  r.legR.kn.rotation.x = (.06 + .85 * Math.max(0, Math.sin(ph + Math.PI - .9))) * amt + .04;
  r.legL.ft.rotation.x = -r.legL.kn.rotation.x * .4; r.legR.ft.rotation.x = -r.legR.kn.rotation.x * .4;
  r.body.position.y = .98 + (Math.abs(c) * .045 - .03) * amt;
  r.spine.rotation.x = .04 * amt + Math.sin(t * 2) * .015;
  r.armL.p.rotation.x = -s * .45 * amt - .05; r.armL.el.rotation.x = -.25 - .2 * amt; r.armL.p.rotation.z = -.08;
  if (atk >= 0 && atk <= 1) {
    let sx, sz, el, tw;
    if (atk < .3) { const k = atk / .3; sx = lerp(0, -2.5, k); sz = lerp(0, -.45, k); el = lerp(-.3, -1.0, k); tw = lerp(0, .5, k); }
    else if (atk < .62) { const k = (atk - .3) / .32, e = 1 - (1 - k) * (1 - k); sx = lerp(-2.5, .35, e); sz = lerp(-.45, .25, e); el = lerp(-1.0, -.15, e); tw = lerp(.5, -.65, e); }
    else { const k = (atk - .62) / .38; sx = lerp(.35, 0, k); sz = lerp(.25, 0, k); el = lerp(-.15, -.3, k); tw = lerp(-.65, 0, k); }
    r.armR.p.rotation.x = sx; r.armR.p.rotation.z = sz; r.armR.el.rotation.x = el; r.spine.rotation.y = tw;
    r.armL.p.rotation.x = -.7; r.armL.el.rotation.x = -1.1;
  } else {
    r.armR.p.rotation.x = s * .45 * amt - .1; r.armR.p.rotation.z = .08; r.armR.el.rotation.x = -.35 - .2 * amt;
    r.spine.rotation.y = s * .07 * amt;
  }
  if (r.cape) r.cape.rotation.x = .12 + amt * .35 + Math.sin(t * 3 + ph) * .04;
}
