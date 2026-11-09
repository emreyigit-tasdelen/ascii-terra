// Oyuncu (Senje), NPC'ler, düşmanlar (iskelet, kara şövalye, kurt, örümcek, ejderha), beceriler ve efektler
import {
  THREE, clamp, lerp, mulberry32, fbm, angDiff, WATER, HALF, CASTLE, keys, MOUSE,
  heightAt, collide, MID, basic
} from './core.js';
import { scene, camera, ENV } from './render.js';
import { crystals, CIRCLE, LAIR, DRAGON_LAIR } from './world.js';
import { makeKnight, makeRobed, makeSkeleton, makeWolf, makeSpider, makeDragon, animBiped, flashMat } from './models.js';
import { burst, hitFeel } from './fx.js';
import { S, toast, floatText, addXP, checkQuests, rollDrop, dmgFor, atkBonus, defBonus, closeDialog, label, npcMark } from './game.js';

let T = 0;

/* ================= oyuncu ================= */
export const P = { x: 0, z: 14, y: 0, vx: 0, vz: 0, face: Math.PI, hp: 100, maxhp: 100, dead: false, deadT: 0, hurtT: 0, lastHit: 99,
  dodgeT: 0, dodgeCd: 0, ddx: 0, ddz: 1, atkT: -1, aimLock: 0, ph: 0, spinT: 0, rig: null, g: null };
export const CD = { slash: 0, fire: 0, whirl: 0 }, CDMAX = { slash: .45, fire: 2.5, whirl: 7 };
export const TGT = { e: null };
{
  const r = makeKnight({ emblem: 0xd8cfb4 }); P.rig = r; P.g = r.g; scene.add(r.g);
  P.lamp = new THREE.PointLight(0xffb070, 1.1, 18); P.lamp.position.set(-.3, 1.3, .4); r.g.add(P.lamp);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.9, .04, 3, 24, Math.PI * .9), basic(0xe8eef8, MID.GLOW));
  arc.rotation.x = Math.PI / 2; arc.rotation.z = Math.PI * .05; arc.position.set(0, 1.15, .3); arc.visible = false; r.g.add(arc); P.arc = arc;
}

/* ================= NPC'ler ================= */
export const NPCS = [
  { id: 'mira', name: 'Yaşlı Mira', x: 4, z: 3, mk: () => makeRobed({ robe: 0x3a2452, hood: 0x2a1a3e }), idle: ['Kale düşeli yüz yıl oldu, Senje. Ateşin yanında dinlen, yaraların kapanır.', 'Gece çökünce ölüler daha cesur olur.'] },
  { id: 'brant', name: 'Avcı Brant', x: -5, z: 4, mk: () => makeRobed({ robe: 0x2a3a22, hood: 0x1c2a16, bow: true, beard: 0x3a2a1a }), idle: ['Kurtlar batı ormanında. Turuncu daireyi görünce kaç, sonra vur!', 'Boşluk tuşuyla yuvarlanırsan darbeden sıyrılırsın.'] },
  { id: 'lyra', name: 'Ay Yazıcısı Lyra', x: 3, z: -6, mk: () => makeRobed({ robe: 0x23395a, hood: 0x182840, staff: 0x99ddff }), idle: ['Ay Kristalleri gökyüzüne mavi bir iz bırakır.', 'Taş Çember eski şövalyelerin yemin yeriydi.'] },
  { id: 'guard1', name: 'Muhafız Aldric', x: -3.6, z: -12, face: 0, mk: () => makeKnight({ cloth: 0x1b2c5e, capeColor: 0x101a38, emblem: 0xc9b77a }), idle: ['Kale yolunda kara şövalyeler dolaşıyor. Kalkanını eksik etme.', 'Köyü bizden geçmeden kimse yağmalayamaz.'] },
  { id: 'guard2', name: 'Muhafız Edwyn', x: 3.6, z: -12, face: 0, mk: () => makeKnight({ cloth: 0x1b2c5e, capeColor: 0x101a38, emblem: 0xc9b77a }), idle: ['Kuzeybatı dağlarından duman yükseliyor... Ejderha uyanmış olabilir.', 'Gece nöbeti uzun olur, Senje.'] }
];
NPCS.forEach(n => {
  n.rig = n.mk(); n.y = heightAt(n.x, n.z); n.rig.g.position.set(n.x, n.y, n.z);
  n.rig.g.rotation.y = n.face ?? Math.atan2(-n.x, -n.z); scene.add(n.rig.g); n.ph = Math.random() * 6;
});
export const nearestNPC = () => NPCS.find(n => Math.hypot(n.x - P.x, n.z - P.z) < 4);

/* ================= düşman türleri ================= */
const darkKnight = () => makeKnight({ armor: 0x3b3e45, armorDark: 0x24262b, cloth: 0x161010, capeColor: 0x0c0909, chain: 0x2a2b2e, tattered: true, glowEyes: true, blade: 0x8a9098, guardColor: 0x3a3a3a, shieldFace: 0x1a1212, gold: 0x5a4a2a });
const KINDS = {
  skeleton: { id: 'skeleton', name: 'İskelet Savaşçı', hp: 42, spd: 3.4, dmg: 8, xp: 16, gold: 4, aggro: 15, reach: 1.9, atkCd: 1.4, atkTime: .7, h: 2.3, make: s => makeSkeleton(s), biped: true, fx: 'bone' },
  dknight: { id: 'dknight', name: 'Kara Şövalye', hp: 120, spd: 3.7, dmg: 15, xp: 48, gold: 18, aggro: 16, reach: 2.1, atkCd: 1.5, atkTime: .75, h: 2.4, make: darkKnight, biped: true, fx: 'spark' },
  wolf: { id: 'wolf', name: 'Kara Kurt', hp: 60, spd: 6.8, dmg: 11, xp: 28, gold: 8, aggro: 22, reach: 2.1, atkCd: 1.2, atkTime: .5, h: 1.9, make: s => makeWolf(s), scale: 1.15, fx: 'blood' },
  widow: { id: 'widow', name: 'Alacakaranlık Dulu', hp: 900, spd: 4.4, dmg: 22, xp: 450, gold: 150, aggro: 22, reach: 4.6, atkCd: 1.6, atkTime: .8, h: 5.4, make: makeSpider, scale: 2, boss: true, respawn: 300, fx: 'ichor' },
  dragon: { id: 'dragon', name: 'Kül Ejderhası', hp: 3200, spd: 3.2, dmg: 34, xp: 1200, gold: 500, aggro: 30, reach: 7, atkCd: 2.2, atkTime: 1, h: 7.5, make: makeDragon, scale: 1.1, boss: true, respawn: 600, fx: 'blood' }
};
export const enemies = [];
let seedN = 1;
function spawnEnemy(kind, x, z, lvlOverride) {
  const k = KINDS[kind], rig = k.make(seedN++), lvl = lvlOverride ?? clamp(1 + Math.floor(Math.hypot(x, z) / 28), 1, 9), f = 1 + .3 * (lvl - 1);
  if (k.scale) rig.g.scale.setScalar(k.scale);
  scene.add(rig.g);
  const e = { k, rig, lvl, hpMax: Math.round(k.hp * f), dmg: Math.round(k.dmg * (1 + .18 * (lvl - 1))), xp: Math.round(k.xp * (1 + .35 * (lvl - 1))), gold: Math.round(k.gold * f),
    x, z, y: heightAt(x, z), home: { x, z }, wx: x, wz: z, wt: 0, cd: 0, atkT: -1, hit: false, dead: false, deadT: 0, respawnT: 0, hurtT: 0, kx: 0, kz: 0,
    face: Math.random() * 6.28, ph: Math.random() * 6, moving: false, provoked: 0, special: 4, special2: 9, flash: false };
  e.hp = e.hpMax; rig.g.position.set(x, e.y, z); enemies.push(e); return e;
}
{
  const rng = mulberry32(99); let s = 0, w = 0, c = 0, dk = 0;
  for (let i = 0; i < 4000 && dk < 5; i++) {   // kale avlusu: kara şövalyeler
    const x = CASTLE.x + (rng() * 2 - 1) * 14, z = CASTLE.z + (rng() * 2 - 1) * 14;
    if (Math.abs(x - CASTLE.x) < 7 && z < CASTLE.z + 1) continue; spawnEnemy('dknight', x, z, 4 + Math.floor(rng() * 2)); dk++;
  }
  for (let i = 0; i < 4000 && c < 12; i++) {   // kale çevresi: iskeletler
    const x = CASTLE.x + (rng() * 2 - 1) * 28, z = CASTLE.z + (rng() * 2 - 1) * 28, h = heightAt(x, z);
    if (h < WATER + 2) continue; if (Math.abs(x - CASTLE.x) < 7 && z < CASTLE.z + 1 && z > CASTLE.z - 12) continue;
    spawnEnemy('skeleton', x, z, 2 + Math.floor(rng() * 2)); c++;
  }
  for (let i = 0; i < 6000 && (s < 16 || w < 14); i++) {
    const x = (rng() * 2 - 1) * (HALF - 14), z = (rng() * 2 - 1) * (HALF - 14), d = Math.hypot(x, z), h = heightAt(x, z);
    if (d < 32 || h < WATER + 2 || h > 12) continue;
    const f = fbm(x * .022 + 100, z * .022 - 50, 3);
    if (f > .5 && d > 55) { if (w < 14) { spawnEnemy('wolf', x, z); w++; } }
    else if (d < 140 && s < 16) { spawnEnemy('skeleton', x, z); s++; }
  }
  spawnEnemy('widow', LAIR.x, LAIR.z, 10);
  spawnEnemy('dragon', DRAGON_LAIR.x, DRAGON_LAIR.z, 15);
}

/* ================= efektler (zemin uyarıları, patlamalar, mermiler) ================= */
const effects = [], projectiles = [];
const fireRingM = basic(0xff7a1a, MID.FIRE), fireFillM = basic(0x6a2008, MID.FIRE), blastM = basic(0xffb040, MID.FIRE), fireballM = basic(0xffa040, MID.FIRE);
function blast(x, z, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.75, 1, 40).rotateX(-Math.PI / 2), blastM); m.position.set(x, heightAt(x, z) + .1, z); m.scale.setScalar(.3); scene.add(m);
  effects.push({ type: 'blast', m, r, t: 0 }); burst('fire', x, heightAt(x, z) + .4, z, Math.round(6 + r * 3));
}
function telegraph(x, z, r, delay, dmg, fire) {
  const y = heightAt(x, z) + .08;
  const m = new THREE.Mesh(new THREE.RingGeometry(r - .3, r, 48).rotateX(-Math.PI / 2), fireRingM); m.position.set(x, y, z); scene.add(m);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), fireFillM); inner.position.set(x, y + .01, z); inner.scale.setScalar(.01); scene.add(inner);
  effects.push({ type: 'tele', m, inner, x, z, r, t: 0, delay, dmg, fire });
}
const disposeMesh = m => { scene.remove(m); m.geometry.dispose(); };
export function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.t += dt;
    if (f.type === 'blast') { const k = f.t / .35; f.m.scale.setScalar(.3 + k * f.r); if (k >= 1) { disposeMesh(f.m); effects.splice(i, 1); } }
    else if (f.type === 'tele') {
      const k = f.t / f.delay; f.inner.scale.setScalar(Math.max(.01, k));
      if (k >= 1) {
        if (!P.dead && Math.hypot(P.x - f.x, P.z - f.z) < f.r) hurtPlayer(f.dmg);
        blast(f.x, f.z, f.r); if (f.fire) burst('fire', f.x, heightAt(f.x, f.z) + .5, f.z, 22);
        hitFeel(.02, .25); disposeMesh(f.m); disposeMesh(f.inner); effects.splice(i, 1);
      }
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt;
    p.m.position.set(p.x, p.y, p.z); p.m.rotation.y += dt * 9; if (Math.random() < .7) burst('fire', p.x, p.y, p.z, 1);
    let boom = p.life <= 0 || heightAt(p.x, p.z) > p.y;
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 1.2 + (e.k.scale || 1) * .6) { boom = true; break; }
    if (boom) {
      blast(p.x, p.z, 3.2);
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 3.2 + (e.k.scale || 1) * .6) hitEnemy(e, baseDmg() * 1.5, p.x, p.z);
      disposeMesh(p.m); projectiles.splice(i, 1);
    }
  }
}

/* ================= nişan + beceriler ================= */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), aimV = new THREE.Vector3();
function aim() {
  ndc.set(MOUSE.x / innerWidth * 2 - 1, -(MOUSE.y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  plane.constant = -(P.y + 1); if (!ray.ray.intersectPlane(plane, aimV)) aimV.set(P.x + Math.sin(P.face), P.y, P.z + Math.cos(P.face));
  return aimV;
}
function faceAim() { const a = aim(); P.face = Math.atan2(a.x - P.x, a.z - P.z); P.aimLock = .35; return a; }
const baseDmg = () => dmgFor(S.lvl) + atkBonus();
const reachOf = e => (e.k.scale ? e.k.scale * (e.k.id === 'dragon' ? 2.6 : 1) : 0);
export function doSlash() {
  if (P.dead || CD.slash > 0 || P.dodgeT > 0) return; CD.slash = CDMAX.slash; faceAim(); P.atkT = 0;
  const fx = Math.sin(P.face), fz = Math.cos(P.face);
  for (const e of enemies) {
    if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > 3.4 + reachOf(e)) continue; if (d > 1 && (dx * fx + dz * fz) / d < .2) continue;
    hitEnemy(e, baseDmg() * (.9 + Math.random() * .3), P.x, P.z);
  }
}
export function doFireball() {
  if (P.dead || CD.fire > 0) return; CD.fire = CDMAX.fire; const a = faceAim(); P.atkT = 0;
  let dx = a.x - P.x, dz = a.z - P.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 0), fireballM); scene.add(m);
  projectiles.push({ m, x: P.x + dx * .9, y: P.y + 1.3, z: P.z + dz * .9, vx: dx * 24, vz: dz * 24, life: 1.1 });
}
export function doWhirl() {
  if (P.dead || CD.whirl > 0) return; CD.whirl = CDMAX.whirl; P.spinT = .45; blast(P.x, P.z, 4.4);
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.z - P.z) < 4.4 + reachOf(e)) hitEnemy(e, baseDmg() * 1.6, P.x, P.z);
}
export function doDodge() {
  if (P.dead || P.dodgeCd > 0) return; P.dodgeCd = .75; P.dodgeT = .32;
  const l = Math.hypot(P.mx || 0, P.mz || 0);
  if (l > .1) { P.ddx = P.mx / l; P.ddz = P.mz / l; } else { P.ddx = Math.sin(P.face); P.ddz = Math.cos(P.face); }
  burst('dust', P.x, P.y + .1, P.z, 8);
}
const _dir = new THREE.Vector3();
function hitEnemy(e, dmg, fromX, fromZ) {
  if (e.dead) return;
  const crit = Math.random() < .12; dmg = Math.round(dmg * (crit ? 2 : 1));
  e.hp -= dmg; e.hurtT = .12; e.provoked = 6; TGT.e = e;
  const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1, kb = e.k.boss ? 1 : 7;
  e.kx = dx / d * kb; e.kz = dz / d * kb;
  const sc = e.k.scale || 1; _dir.set(dx / d, 0, dz / d);
  burst(e.k.fx, e.x - dx / d * .3 * sc, e.y + e.k.h * .45, e.z - dz / d * .3 * sc, crit ? 18 : 9, _dir);
  hitFeel(crit ? .07 : .045, crit ? .3 : .14);
  floatText((crit ? 'KRİTİK ' : '') + dmg, e.x, e.y + e.k.h * .8, e.z, crit ? 'crit' : '');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; e.deadT = 7; e.respawnT = e.k.respawn || 35; e.atkT = -1;
  S.kills[e.k.id] = (S.kills[e.k.id] || 0) + 1;
  burst(e.k.fx, e.x, e.y + e.k.h * .4, e.z, e.k.boss ? 60 : 22);
  rollDrop(e.k.id, e.lvl); addXP(e.xp); S.gold += e.gold;
  floatText('+' + e.xp + ' XP', e.x, e.y + e.k.h, e.z, 'info');
  if (e.k.boss) { toast(e.k.name + ' yenildi!'); hitFeel(.15, .6); }
  checkQuests();
}
export function hurtPlayer(d) {
  if (P.dead) return;
  if (P.dodgeT > 0) { floatText('sıyrıldı', P.x, P.y + 2.8, P.z, 'info'); return; }
  d = Math.max(1, Math.round(d - defBonus())); P.hp -= d; P.hurtT = .35; P.lastHit = 0;
  burst('blood', P.x, P.y + 1.3, P.z, 7); hitFeel(.03, .22);
  floatText('-' + d, P.x, P.y + 2.8, P.z, 'hurt');
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadT = 3.2; closeDialog(); toast('Yenildin... köyde uyanacaksın.'); burst('blood', P.x, P.y + .6, P.z, 20); }
}

/* ================= düşman güncelleme ================= */
function setFlash(e, on) {
  if (e.flash === on) return; e.flash = on;
  for (const m of e.rig.meshes) m.material = on ? flashMat(m.userData.orig.opacity) : m.userData.orig;
}
function animate(e, dt) {
  const r = e.rig, mv = e.moving ? 1 : 0, id = e.k.id;
  if (e.k.biped) {
    animBiped(r, e.ph, mv, e.atkT, T);
    if (r.jaw) r.jaw.rotation.x = .12 + Math.abs(Math.sin(T * 9 + e.ph)) * .15 * (e.provoked > 0 ? 1 : .3);
  } else if (id === 'wolf') {
    r.legs.forEach((L, i) => { const ph = e.ph + (i % 2 ? Math.PI : 0) + (L.front ? 0 : 1.2); L.piv.rotation.x = Math.sin(ph) * .65 * mv; L.kn.rotation.x = (L.front ? 1 : -1) * Math.max(0, Math.sin(ph + 1.2)) * .7 * mv; });
    r.body.position.y = .82 + Math.abs(Math.sin(e.ph)) * .05 * mv;
    r.tail.rotation.y = Math.sin(T * 3 + e.ph) * .3; r.tail.rotation.x = e.provoked > 0 ? -.3 : 0;
    const bite = e.atkT >= 0 ? Math.sin(e.atkT * Math.PI) : 0;
    r.head.rotation.x = -bite * .45 + (e.provoked > 0 ? .15 : 0); r.jaw.rotation.x = .12 + bite * .6 + Math.sin(T * 7) * .04;
  } else if (id === 'widow') {
    r.legs.forEach(L => { const ph = e.ph * 1.5 + ((L.i % 2) ^ (L.s > 0 ? 1 : 0)) * Math.PI; L.piv.rotation.x = Math.sin(ph) * .22 * mv; L.up.rotation.z = -L.s * (1.05 + Math.max(0, Math.cos(ph)) * .28 * mv); });
    const a = e.atkT >= 0 ? Math.sin(e.atkT * Math.PI) : 0; r.body.rotation.x = -a * .45; r.body.position.y = 1.3 + Math.sin(T * 2) * .03 + a * .3;
  } else if (id === 'dragon') {
    r.legs.forEach((L, i) => { const ph = e.ph + (i % 2 ? Math.PI : 0) + (L.front ? 0 : Math.PI / 2); L.piv.rotation.x = Math.sin(ph) * .4 * mv; L.kn.rotation.x = Math.max(0, Math.sin(ph + 1)) * .5 * mv; });
    const a = e.atkT >= 0 ? Math.sin(e.atkT * Math.PI) : 0, br = e.breathT > 0 ? 1 : 0;
    r.head.rotation.x = -a * .35 + br * .25 + Math.sin(T * .8) * .05; r.jaw.rotation.x = .08 + a * .5 + br * .55;
    r.wings.forEach(W => { W.g.rotation.z = W.s * (br || e.provoked > 0 ? Math.sin(T * 5) * .45 : .25 + Math.sin(T * 1.1) * .06); W.g.rotation.y = W.s * (br ? -.2 : .35); });
    r.body.rotation.z = Math.sin(T * .7) * .02;
  }
}
function updateEnemy(e, dt) {
  const g = e.rig.g;
  if (e.dead) {
    setFlash(e, false);
    if (e.deadT > 0) {
      e.deadT -= dt;
      const fall = Math.min(1, (7 - e.deadT) / .5);
      if (e.k.biped) g.rotation.x = -fall * 1.45; else g.rotation.z = fall * (e.k.id === 'widow' ? Math.PI * .95 : 1.5);
      if (e.deadT < 1.2) g.position.y -= dt * 1.2;
      if (e.deadT <= 0) g.visible = false;
    }
    e.respawnT -= dt;
    if (e.respawnT <= 0 && Math.hypot(P.x - e.home.x, P.z - e.home.z) > 50) {
      e.dead = false; e.hp = e.hpMax; e.x = e.home.x; e.z = e.home.z; g.visible = true; g.rotation.set(0, 0, 0);
    }
    return;
  }
  const dxp = P.x - e.x, dzp = P.z - e.z, d = Math.hypot(dxp, dzp);
  if (d > 90) { g.visible = false; return; }
  g.visible = true;
  e.cd -= dt; e.hurtT -= dt; e.provoked -= dt; if (e.breathT > 0) e.breathT -= dt;
  const aggro = e.k.aggro * (ENV.night > .5 ? 1.3 : 1);
  let tx = e.wx, tz = e.wz, sp = e.k.spd * .35;
  if (e.atkT >= 0) {
    e.atkT += dt / e.k.atkTime; sp = 0; tx = P.x; tz = P.z;
    if (!e.hit && e.atkT > .55) { e.hit = true; if (d < e.k.reach + .7) hurtPlayer(e.dmg); }
    if (e.atkT >= 1) e.atkT = -1;
  } else if ((d < aggro || e.provoked > 0) && !P.dead) {
    tx = P.x; tz = P.z; sp = e.k.spd;
    if (d < e.k.reach) { sp = 0; if (e.cd <= 0) { e.atkT = 0; e.hit = false; e.cd = e.k.atkCd; } }
    if (e.k.id === 'widow') { e.special -= dt; if (e.special <= 0) { e.special = 6.5; telegraph(P.x, P.z, 4.5, 1.15, e.dmg * 1.4); telegraph(e.x, e.z, 6, 1.6, e.dmg); } }
    if (e.k.id === 'dragon') {
      e.special -= dt; e.special2 -= dt;
      if (e.special <= 0) {   // ateş nefesi: ejderhadan oyuncuya uzanan daireler
        e.special = 7.5; e.breathT = 1.6; const ux = dxp / (d || 1), uz = dzp / (d || 1); hitFeel(0, .35);
        for (let k = 1; k <= 6; k++) telegraph(e.x + ux * (4 + k * 3), e.z + uz * (4 + k * 3), 2.6, 1.0 + k * .08, e.dmg * 1.2, true);
      }
      if (e.special2 <= 0) { e.special2 = 11; telegraph(e.x, e.z, 9, 1.4, e.dmg * 1.5); }
    }
  } else {
    if (Math.hypot(e.x - e.home.x, e.z - e.home.z) > 40) { e.wx = e.home.x; e.wz = e.home.z; }
    e.wt -= dt; if (e.wt <= 0) { e.wt = 3 + Math.random() * 4; const a = Math.random() * 6.28, r = Math.random() * 9; e.wx = e.home.x + Math.cos(a) * r; e.wz = e.home.z + Math.sin(a) * r; }
    tx = e.wx; tz = e.wz; if (Math.hypot(tx - e.x, tz - e.z) < 1) sp = 0;
  }
  let dx = tx - e.x, dz = tz - e.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const nx = e.x + (dx * sp + e.kx) * dt, nz = e.z + (dz * sp + e.kz) * dt;
  e.kx *= Math.max(0, 1 - 9 * dt); e.kz *= Math.max(0, 1 - 9 * dt);
  const gh = heightAt(nx, nz);
  if (gh > WATER - .4 && Math.abs(gh - e.y) < 1.6 * (e.k.scale || 1)) { const q = { x: nx, z: nz }; collide(q, e.k.boss ? 1.8 : .6); e.x = q.x; e.z = q.z; }
  e.y = heightAt(e.x, e.z); e.moving = sp > 0;
  e.face += angDiff(e.face, Math.atan2(dx, dz)) * Math.min(1, dt * (e.k.id === 'dragon' ? 2.5 : 8));
  e.ph += dt * (e.moving ? e.k.spd * 1.9 / (e.k.scale || 1) : 1);
  animate(e, dt);
  g.position.set(e.x, e.y, e.z); g.rotation.y = e.face;
  if (e.breathT > 0 && e.k.id === 'dragon') { const hx = e.x + Math.sin(e.face) * 7.5, hz = e.z + Math.cos(e.face) * 7.5; burst('fire', hx, e.y + 4, hz, 3, _dir.set(Math.sin(e.face), -.3, Math.cos(e.face))); }
  setFlash(e, e.hurtT > 0);
  if (d < 18 || TGT.e === e) label(e.k.name + ' · sv ' + e.lvl, e.x, e.y + e.k.h * (e.k.scale && !e.k.boss ? e.k.scale : 1), e.z, e.k.boss ? 'foe boss' : 'foe', e.hp / e.hpMax);
}
export function updateEnemies(dt) { T += dt; for (const e of enemies) updateEnemy(e, dt); if (TGT.e && TGT.e.dead) TGT.e = null; }

/* ================= oyuncu güncelleme ================= */
export function updatePlayer(dt) {
  for (const k in CD) CD[k] = Math.max(0, CD[k] - dt);
  P.dodgeCd -= dt; P.lastHit += dt; P.hurtT -= dt; P.aimLock -= dt;
  const r = P.rig;
  if (P.dead) {
    P.deadT -= dt; P.g.rotation.x = Math.max(-1.45, P.g.rotation.x - dt * 3);
    if (P.deadT <= 0) { P.dead = false; P.hp = P.maxhp; P.x = 0; P.z = 6; P.vx = P.vz = 0; S.gold = Math.floor(S.gold * .9); P.g.rotation.x = 0; }
    P.g.position.set(P.x, P.y, P.z); return;
  }
  const ix = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const sy = Math.sin(P.camYaw || 0), cy = Math.cos(P.camYaw || 0);
  let mx = ix * cy - iz * sy, mz = -ix * sy - iz * cy; const len = Math.hypot(mx, mz); if (len > 0) { mx /= len; mz /= len; }
  P.mx = mx; P.mz = mz;
  const ground = heightAt(P.x, P.z), inWater = ground < WATER - .2;
  if (P.dodgeT > 0) { P.dodgeT -= dt; P.vx = P.ddx * 15; P.vz = P.ddz * 15; }
  else {
    const sp = (keys.shift ? 9.5 : 5.8) * (inWater ? .5 : 1) * (P.atkT >= 0 ? .55 : 1), a = 1 - Math.exp(-14 * dt);
    P.vx += (mx * sp - P.vx) * a; P.vz += (mz * sp - P.vz) * a;
  }
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  const bad = (x, z) => { const h = heightAt(x, z); return h - P.y > 1.25 || h < WATER - 1.5; };
  if (bad(nx, nz)) { const okx = !bad(nx, P.z), okz = !bad(P.x, nz); if (!okx) { nx = P.x; P.vx = 0; } if (!okz) { nz = P.z; P.vz = 0; } }
  const q = { x: clamp(nx, -HALF + 3, HALF - 3), z: clamp(nz, -HALF + 3, HALF - 3) }; collide(q, .5); P.x = q.x; P.z = q.z;
  P.y = lerp(P.y, heightAt(P.x, P.z), 1 - Math.exp(-20 * dt));
  const spd = Math.hypot(P.vx, P.vz);
  if (P.aimLock <= 0 && spd > .5 && P.dodgeT <= 0) P.face += angDiff(P.face, Math.atan2(P.vx, P.vz)) * Math.min(1, dt * 12);
  if (P.atkT >= 0) { P.atkT += dt / .34; if (P.atkT > 1) P.atkT = -1; }
  P.ph += dt * Math.max(1.5, spd * 1.75);
  animBiped(r, P.ph, P.dodgeT > 0 ? 0 : Math.min(1, spd / 5.8), P.atkT, T);
  if (P.dodgeT > 0) { const k = 1 - P.dodgeT / .32; r.body.rotation.x = Math.sin(k * Math.PI) * 1.2; r.body.position.y = .98 - Math.sin(k * Math.PI) * .45; }
  else r.body.rotation.x = 0;
  if (P.spinT > 0) { P.spinT -= dt; P.face += dt * 26; }
  P.arc.visible = P.atkT > .3 && P.atkT < .7;
  P.g.position.set(P.x, P.y, P.z); P.g.rotation.y = P.face;
  P.lamp.intensity = .5 + ENV.night * 1.1;
  if (Math.hypot(P.x, P.z) < 9 && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + 8 * dt);
  else if (P.lastHit > 6 && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + 1.5 * dt);
  for (const c of crystals) if (!c.taken && Math.hypot(c.x - P.x, c.z - P.z) < 2.6) { c.taken = true; c.mesh.visible = false; S.taken.push(c.id); S.shards++; toast('Ay Kristali alındı (' + S.shards + ')'); burst('magic', c.x, heightAt(c.x, c.z) + 1.5, c.z, 20); checkQuests(); }
  if (!S.circle && Math.hypot(CIRCLE.x - P.x, CIRCLE.z - P.z) < 10) { S.circle = true; toast('Taş Çember keşfedildi!'); checkQuests(); }
}

/* ================= NPC yaşamı + etiketler ================= */
export function updateNPCs(dt) {
  for (const n of NPCS) { n.ph += dt; animBiped(n.rig, 0, 0, -1, n.ph); }
}
export function actorLabels() {
  label('Senje', P.x, P.y + 2.6, P.z, 'me');
  NPCS.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) < 30) label(n.name + npcMark(n), n.x, n.y + 2.5, n.z, 'npc'); });
}
export function resetPlayer() { P.maxhp = 100 + 20 * (S.lvl - 1); P.hp = P.maxhp; P.dead = false; P.g.rotation.x = 0; }
