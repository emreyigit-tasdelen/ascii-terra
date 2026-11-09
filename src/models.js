// Karakter ve yaratık modelleri (düşük poligon, iskelet animasyonlu)
import { THREE, lerp, MID, lam, basic } from './core.js';

/* İki ayaklı temel iskelet: bacak/kol pivotları, gövde, kafa */
export function biped(o) {
  const id = o.id ?? MID.ACTOR, mats = [];
  const mk = (geo, c, x, y, z, parent) => { const m = lam(c, id); mats.push(m); const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); parent.add(me); return me; };
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const lw = o.limb ?? .2;
  const legL = new THREE.Group(); legL.position.set(-.15, .95, 0); body.add(legL);
  const legR = new THREE.Group(); legR.position.set(.15, .95, 0); body.add(legR);
  [legL, legR].forEach(L => { mk(new THREE.BoxGeometry(lw, .92, lw * 1.1), o.leg, 0, -.46, 0, L); mk(new THREE.BoxGeometry(lw * 1.15, .1, lw * 1.7), o.boot ?? o.leg, 0, -.9, .05, L); });
  const torso = mk(new THREE.BoxGeometry(o.tw ?? .54, .62, .3), o.torso, 0, 1.27, 0, body);
  const head = new THREE.Group(); head.position.y = 1.74; body.add(head);
  mk(new THREE.SphereGeometry(o.hr ?? .19, 10, 8), o.skin, 0, 0, 0, head);
  const armL = new THREE.Group(); armL.position.set(-.36, 1.52, 0); body.add(armL);
  const armR = new THREE.Group(); armR.position.set(.36, 1.52, 0); body.add(armR);
  [armL, armR].forEach(A => mk(new THREE.BoxGeometry(lw * .75, .64, lw * .8), o.arm ?? o.torso, 0, -.31, 0, A));
  const handL = new THREE.Group(); handL.position.y = -.64; armL.add(handL);
  const handR = new THREE.Group(); handR.position.y = -.64; armR.add(handR);
  return { g, body, legL, legR, armL, armR, head, torso, handL, handR, mats, mk };
}

function sword(r, blade, hiltC) {
  const s = new THREE.Group(); r.handR.add(s); s.rotation.x = Math.PI / 2;
  r.mk(new THREE.BoxGeometry(.07, 1.1, .025), blade, 0, .62, 0, s);
  r.mk(new THREE.BoxGeometry(.32, .05, .06), hiltC, 0, .06, 0, s);
  r.mk(new THREE.BoxGeometry(.05, .18, .05), 0x2a1d12, 0, -.06, 0, s);
  return s;
}

/* Senje: gümüş zırhlı, kırmızı tabardlı şövalye */
export function makeKnight() {
  const steel = 0xc3cad6;
  const r = biped({ leg: 0x4b505c, boot: 0x24262c, torso: steel, arm: 0xaab1bd, skin: steel });
  const { mk, body, head, handL } = r;
  mk(new THREE.BoxGeometry(.6, .92, .36), 0xa01c1c, 0, 1.02, 0, body);           // tabard
  mk(new THREE.BoxGeometry(.62, .07, .38), 0x3e2a1a, 0, 1.08, 0, body);          // kemer
  mk(new THREE.BoxGeometry(.61, .08, .37), 0xd8d0b0, 0, 1.3, 0, body);           // tabard şeridi
  [-1, 1].forEach(s => { const p = mk(new THREE.SphereGeometry(.17, 8, 6), 0xd0d6e0, s * .36, 1.55, 0, body); p.scale.set(1.25, .8, 1.1); });
  mk(new THREE.CylinderGeometry(.2, .21, .3, 10), 0xd0d6e0, 0, .02, 0, head);    // miğfer
  mk(new THREE.SphereGeometry(.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xd0d6e0, 0, .16, 0, head);
  mk(new THREE.BoxGeometry(.28, .04, .05), 0x101010, 0, .05, .19, head);         // vizör
  const pl = mk(new THREE.ConeGeometry(.06, .38, 5), 0xb01e1e, 0, .44, -.06, head); pl.rotation.x = -.45;
  r.sword = sword(r, 0xe8edf5, 0x9a7a2a);
  const sh = new THREE.Group(); handL.add(sh); sh.position.set(-.08, .28, .1);
  mk(new THREE.BoxGeometry(.06, .62, .46), 0x8e1818, 0, 0, 0, sh);
  mk(new THREE.BoxGeometry(.066, .62, .08), 0xd9d9d9, 0, 0, 0, sh);
  mk(new THREE.BoxGeometry(.066, .08, .46), 0xd9d9d9, 0, .08, 0, sh);
  r.shield = sh;
  return r;
}

/* Cübbeli köylü / büyücü */
export function makeRobed(o) {
  const r = biped({ leg: o.robe, torso: o.robe, arm: o.robe, skin: o.skin ?? 0xd6b596 });
  r.legL.visible = r.legR.visible = false;
  r.mk(new THREE.ConeGeometry(.44, 1.28, 10), o.robe, 0, .63, 0, r.body);
  if (o.hood) r.mk(new THREE.ConeGeometry(.27, .5, 8), o.hood, 0, .24, -.02, r.head);
  if (o.staff) {
    const st = r.mk(new THREE.CylinderGeometry(.03, .035, 1.9, 5), 0x5a4030, 0, .15, .1, r.handR);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.11, 0), basic(o.staff, MID.GLOW)); orb.position.y = 1; st.add(orb);
  }
  if (o.bow) { const b = r.mk(new THREE.TorusGeometry(.5, .025, 4, 12, Math.PI), 0x5a4030, -.05, .1, -.18, r.body); b.position.set(0, 1.3, -.2); b.rotation.z = Math.PI / 2; }
  return r;
}

/* İskelet savaşçı */
export function makeSkeleton() {
  const bone = 0xd9d3c3;
  const r = biped({ leg: bone, torso: bone, arm: bone, skin: bone, limb: .08, tw: .09, hr: .17 });
  for (let i = 0; i < 4; i++) r.mk(new THREE.BoxGeometry(.42 - i * .05, .04, .24), bone, 0, 1.47 - i * .1, 0, r.body);
  r.mk(new THREE.BoxGeometry(.32, .1, .16), bone, 0, .98, 0, r.body);
  r.mk(new THREE.BoxGeometry(.06, .05, .02), 0x0a0a0a, -.06, .02, .16, r.head);
  r.mk(new THREE.BoxGeometry(.06, .05, .02), 0x0a0a0a, .06, .02, .16, r.head);
  r.mk(new THREE.BoxGeometry(.18, .06, .12), bone, 0, -.15, .06, r.head);
  r.sword = sword(r, 0x8a7560, 0x5a4a3a);
  return r;
}

/* Kurt (ince ızgara glifleri) */
export function makeWolf() {
  const id = MID.CREATURE, mats = [], g = new THREE.Group();
  const M = c => { const m = lam(c, id); mats.push(m); return m; };
  const fur = M(0x6f7480), dark = M(0x3e424c), eye = basic(0xff3322, MID.GLOW);
  const add = (geo, m, x, y, z, p = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); p.add(me); return me; };
  add(new THREE.BoxGeometry(.75, .72, 1.7), fur, 0, .95, 0);
  add(new THREE.BoxGeometry(.86, .86, .7), fur, 0, 1.02, .55);
  const head = new THREE.Group(); head.position.set(0, 1.18, 1.05); g.add(head);
  add(new THREE.BoxGeometry(.55, .5, .6), fur, 0, 0, 0, head);
  add(new THREE.BoxGeometry(.28, .24, .45), dark, 0, -.08, .45, head);
  [-1, 1].forEach(s => { const e = add(new THREE.ConeGeometry(.08, .22, 4), dark, s * .17, .32, -.05, head); add(new THREE.BoxGeometry(.08, .06, .04), eye, s * .15, .07, .31, head); });
  const tail = add(new THREE.BoxGeometry(.18, .18, .9), dark, 0, 1.05, -1.1); tail.rotation.x = .5;
  const legs = [];
  [[-.28, .55], [.28, .55], [-.28, -.55], [.28, -.55]].forEach(([x, z]) => { const L = new THREE.Group(); L.position.set(x, .72, z); g.add(L); add(new THREE.BoxGeometry(.15, .72, .15), dark, 0, -.36, 0, L); legs.push(L); });
  return { g, legs, mats, head };
}

/* Dev örümcek (Alacakaranlık Dulu) */
export function makeSpider() {
  const id = MID.CREATURE, mats = [], g = new THREE.Group();
  const M = c => { const m = lam(c, id); mats.push(m); return m; };
  const fur = M(0x47362a), dark = M(0x2a201a), eye = basic(0xff2a1a, MID.GLOW);
  const add = (geo, m, x, y, z, p = g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); p.add(me); return me; };
  const ab = add(new THREE.SphereGeometry(1, 14, 10), fur, 0, 1.15, -1.05); ab.scale.set(1, .82, 1.25);
  add(new THREE.SphereGeometry(.65, 12, 8), fur, 0, .95, .35);
  add(new THREE.SphereGeometry(.4, 10, 8), dark, 0, .9, .95);
  for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(.06, 5, 4), eye, (i % 3 - 1) * .12, 1.05 + Math.floor(i / 3) * .1, 1.28);
  [-1, 1].forEach(s => { const f = add(new THREE.ConeGeometry(.07, .35, 5), dark, s * .12, .62, 1.2); f.rotation.x = Math.PI; });
  const legs = [];
  const seg = (len, r, m) => { const G = new THREE.Group(); const me = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r, len, 6), m); me.position.y = len / 2; G.add(me); return G; };
  [-1, 1].forEach(s => {
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group(); piv.position.set(s * .45, .95, .55 - i * .35); piv.rotation.y = -s * (1.5 - i) * .42; g.add(piv);
      const up = seg(1.45, .085, fur); up.rotation.z = -s * 1.0; piv.add(up);
      const lo = seg(1.75, .07, dark); lo.position.y = 1.45; lo.rotation.z = -s * 1.6; up.add(lo);
      legs.push({ piv, up, lo, s, i });
    }
  });
  return { g, legs, mats };
}

/* Yer gölgesi diski */
const shadowMat = basic(0x000000, MID.GROUND); shadowMat.polygonOffset = true; shadowMat.polygonOffsetFactor = -2;
export function makeShadow(r) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2), shadowMat); return m; }

/* Yürüme + kılıç savurma animasyonu (atk: 0..1 ilerleme, <0 yok) */
export function animBiped(r, ph, amt, atk) {
  const s = Math.sin(ph) * .75 * amt;
  r.legL.rotation.x = s; r.legR.rotation.x = -s; r.armL.rotation.x = -s * .7;
  if (atk >= 0 && atk <= 1) {
    if (atk < .35) { const k = atk / .35; r.armR.rotation.x = lerp(-.3, -2.9, k); r.body.rotation.y = lerp(0, .45, k); }
    else { const k = (atk - .35) / .65; r.armR.rotation.x = lerp(-2.9, .25, k); r.body.rotation.y = lerp(.45, -.5, k); }
  } else { r.armR.rotation.x = s * .7; r.body.rotation.y *= .8; }
  r.body.position.y = Math.abs(Math.cos(ph)) * .06 * amt;
}
