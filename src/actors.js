// Player (Torvan), NPCs, enemies and their AI, skills, projectiles, effects
import {
  THREE, clamp, lerp, mulberry32, fbm, angDiff, WATER, HALF, CASTLE, SWAMP, CHAPEL, CAMP, keys, MOUSE,
  heightAt, standAt, collide, MID, basic
} from './core.js';
import { scene, camera, ENV } from './render.js';
import { crystals, CIRCLE, LAIR, DRAGON_LAIR, GRAVES } from './world.js';
import { makeKnight, makeRobed, makeSkeleton, makeWolf, makeHorse, makeSpider, makeDragon, makeGhoul, makeWitch, makeTroll, animBiped, animWolf, animSpider, animDragon, flashMat } from './models.js';
import { burst, hitFeel } from './fx.js';
import { sfx } from './audio.js';
import { craftMods, armorMods } from './craft.js';
import { hitDummy } from './intro.js';
import { S, toast, floatText, addXP, checkQuests, rollDrop, dmgFor, atkBonus, defBonus, closeDialog, label, npcMark } from './game.js';
import { NET, sendNet, isClient, isHost, remoteTargets } from './net.js';
import { DUEL, duelLost, duelNear, duelStrike } from './duel.js';
import { partyShare } from './party.js';

let T = 0;

/* ================= player ================= */
export const P = { x: 0, z: 14, y: 0, vx: 0, vz: 0, vy: 0, air: false, face: Math.PI, hp: 100, maxhp: 100, dead: false, deadT: 0, hurtT: 0, hitT: 0, lastHit: 99,
  dodgeT: 0, dodgeCd: 0, ddx: 0, ddz: 1, block: false, blockT: 0, st: 100, stMax: 100, stCd: 0, stunT: 0, atkT: -1, atkType: 0, comboT: 0, aimLock: 0, ph: 0, spinT: 0, lean: 0, turn: 0, rig: null, g: null };
export const CD = { slash: 0, fire: 0, whirl: 0, orb: 0, beam: 0 }, CDMAX = { slash: .42, fire: 2.5, whirl: 7, orb: 9, beam: 6 };
export const TGT = { e: null };
// character look (chosen on the creation screen, saved in S.look)
export const LOOKS = {
  tabard: [0x7a1414, 0x1b2c5e, 0x1f4a2a, 0x4a2a5e, 0x5e4a1a, 0x222428],
  cape: [0x1c0505, 0x0c1426, 0x0d1a10, 0x1a1a1a],
  emblem: [0xd8cfb4, 0xc9a227, 0xe8e8f0, null]
};
P.lamp = new THREE.PointLight(0xffb070, 1.1, 18); P.lamp.position.set(-.3, 1.3, .4);
P.arc = new THREE.Mesh(new THREE.TorusGeometry(1.9, .04, 3, 24, Math.PI * .9), basic(0xe8eef8, MID.GLOW));
P.arc.rotation.x = Math.PI / 2; P.arc.position.set(0, 1.15, .3); P.arc.visible = false;
export function setLook(look = {}) {
  const L = { tabard: 0, cape: 0, emblem: 0, ...look }, old = P.g;
  const r = makeKnight({ cloth: LOOKS.tabard[L.tabard], capeColor: LOOKS.cape[L.cape], emblem: LOOKS.emblem[L.emblem] ?? undefined });
  if (old) { scene.remove(old); r.g.position.copy(old.position); r.g.rotation.copy(old.rotation); }
  P.rig = r; P.g = r.g; scene.add(r.g); r.g.add(P.lamp); r.g.add(P.arc);
}
setLook();

/* ================= horse (mount): F to call / mount / dismount ================= */
export const HORSE = { rig: null, on: false, ph: 0, x: 0, z: 0, face: 0 };
{ const h = makeHorse(); h.g.visible = false; scene.add(h.g); HORSE.rig = h; }
export function toggleMount() {
  if (P.dead) return;
  if (HORSE.on) { HORSE.on = false; HORSE.rig.g.visible = false; P.x += Math.cos(P.face) * 1.3; P.z -= Math.sin(P.face) * 1.3; toast('Dismounted'); return; }
  if (P.air || P.dodgeT > 0 || P.high > .5) return;
  HORSE.on = true; HORSE.rig.g.visible = true; HORSE.x = P.x; HORSE.z = P.z; HORSE.face = P.face; toast('Mounted — F to dismount');
}

/* ================= NPC'ler ================= */
export const NPCS = [
  { id: 'mira', name: 'Old Mira', x: 4, z: 3, mk: () => makeRobed({ robe: 0x3a2452, hood: 0x2a1a3e }), style: 'robe', idle: ['A hundred years since the castle fell, Torvan. Rest by the fire and your wounds will close.', 'When night falls, the dead grow bolder.'] },
  { id: 'brant', name: 'Brant the Hunter', x: -5, z: 4, mk: () => makeRobed({ robe: 0x2a3a22, hood: 0x1c2a16, bow: true, beard: 0x3a2a1a }), style: 'robe', idle: ['The wolves are in the western forest. When you see an orange circle, roll with C!', 'Space makes you jump; that is how you climb low rocks.'] },
  { id: 'lyra', name: 'Lyra the Moon Scribe', x: 3, z: -6, mk: () => makeRobed({ robe: 0x23395a, hood: 0x182840, staff: 0x99ddff }), style: 'robe', idle: ['Moon Shards leave a blue trail in the sky.', 'The Stone Circle was where knights of old swore their oaths.'] },
  { id: 'guard1', name: 'Guard Aldric', x: -3.6, z: -12, face: 0, mk: () => makeKnight({ cloth: 0x1b2c5e, capeColor: 0x101a38, emblem: 0xc9b77a }), idle: ['Dark knights roam the castle road. Keep your shield close.', 'No one plunders this village without going through us.'] },
  { id: 'guard2', name: 'Guard Edwyn', x: 3.6, z: -12, face: 0, mk: () => makeKnight({ cloth: 0x1b2c5e, capeColor: 0x101a38, emblem: 0xc9b77a }), idle: ['Smoke rises from the northwest mountains... The dragon may have woken.', 'The east road goes down to the swamp. Father Osric has made camp there.'] },
  { id: 'osric', name: 'Father Osric', x: CAMP.x - 1.5, z: CAMP.z + 2.5, mk: () => makeRobed({ robe: 0x4a4436, hood: 0x2e2a20, staff: 0xffe9a0, beard: 0x8a8678 }), style: 'robe', idle: ['You will hear whispers in the swamp mist. Do not listen.', 'The chapel bell has not rung in a hundred years. If it rings, run.'] }
];
NPCS.forEach(n => {
  n.rig = n.mk(); n.y = heightAt(n.x, n.z); n.rig.g.position.set(n.x, n.y, n.z);
  n.rig.g.rotation.y = n.face ?? Math.atan2(-n.x + (n.id === 'osric' ? CAMP.x : 0), -n.z + (n.id === 'osric' ? CAMP.z : 0)); scene.add(n.rig.g); n.ph = Math.random() * 6;
});
export const nearestNPC = () => NPCS.find(n => Math.hypot(n.x - P.x, n.z - P.z) < 4);

/* ================= enemy types ================= */
const darkKnight = () => makeKnight({ armor: 0x3b3e45, armorDark: 0x24262b, cloth: 0x161010, capeColor: 0x0c0909, chain: 0x2a2b2e, tattered: true, glowEyes: true, blade: 0x8a9098, guardColor: 0x3a3a3a, shieldFace: 0x1a1212, gold: 0x5a4a2a });
const KINDS = {
  skeleton: { id: 'skeleton', name: 'Skeleton Warrior', hp: 42, spd: 3.4, dmg: 8, xp: 16, gold: 4, aggro: 15, reach: 1.9, atkCd: 1.4, atkTime: .7, h: 2.3, make: s => makeSkeleton(s), biped: 'shamble', fx: 'bone' },
  dknight: { id: 'dknight', name: 'Dark Knight', hp: 120, spd: 3.7, dmg: 15, xp: 48, gold: 18, aggro: 16, reach: 2.1, atkCd: 1.5, atkTime: .75, h: 2.4, make: darkKnight, biped: 'knight', fx: 'spark' },
  wolf: { id: 'wolf', name: 'Black Wolf', hp: 60, spd: 6.8, dmg: 11, xp: 28, gold: 8, aggro: 22, reach: 2.1, atkCd: 1.2, atkTime: .5, h: 1.9, make: s => makeWolf(s), scale: 1.15, fx: 'blood', anim: 'wolf' },
  ghoul: { id: 'ghoul', name: 'Ghoul', hp: 50, spd: 5.4, dmg: 10, xp: 30, gold: 6, aggro: 18, reach: 1.9, atkCd: 1.1, atkTime: .55, h: 2, make: s => makeGhoul(s), biped: 'hunch', fx: 'blood', lunge: true },
  witch: { id: 'witch', name: 'Swamp Witch', hp: 70, spd: 3.2, dmg: 16, xp: 45, gold: 14, aggro: 24, reach: 13, atkCd: 2.4, atkTime: .8, h: 2.4, make: makeWitch, biped: 'robe-hunch', fx: 'blood', ranged: true },
  troll: { id: 'troll', name: 'Swamp Troll', hp: 650, spd: 3.0, dmg: 28, xp: 320, gold: 90, aggro: 18, reach: 3.4, atkCd: 2.6, atkTime: 1.1, h: 4.4, make: makeTroll, biped: 'heavy', fx: 'blood', elite: true, respawn: 180 },
  widow: { id: 'widow', name: 'The Gloomweaver', hp: 900, spd: 4.4, dmg: 22, xp: 450, gold: 150, aggro: 22, reach: 4.6, atkCd: 1.6, atkTime: .8, h: 5.4, make: makeSpider, scale: 2, boss: true, respawn: 300, fx: 'ichor', anim: 'spider' },
  dragon: { id: 'dragon', name: 'The Ash Dragon', hp: 3200, spd: 3.2, dmg: 34, xp: 1200, gold: 500, aggro: 30, reach: 7, atkCd: 2.2, atkTime: 1, h: 7.5, make: makeDragon, scale: 1.1, boss: true, respawn: 600, fx: 'blood', anim: 'dragon' }
};
export const enemies = [];
let seedN = 1;
function spawnEnemy(kind, x, z, lvlOverride) {
  const k = KINDS[kind], rig = k.make(seedN++), lvl = lvlOverride ?? clamp(1 + Math.floor(Math.hypot(x, z) / 28), 1, 9), f = 1 + .3 * (lvl - 1);
  if (k.scale) rig.g.scale.setScalar(k.scale);
  rig.seed = seedN; scene.add(rig.g);
  const e = { k, rig, lvl, hpMax: Math.round(k.hp * f), dmg: Math.round(k.dmg * (1 + .18 * (lvl - 1))), xp: Math.round(k.xp * (1 + .35 * (lvl - 1))), gold: Math.round(k.gold * f),
    x, z, y: heightAt(x, z), home: { x, z }, wx: x, wz: z, wt: 0, cd: 0, atkT: -1, atkType: 0, hit: false, dead: false, deadT: 0, respawnT: 0, hurtT: 0, hitT: 0, kx: 0, kz: 0,
    face: Math.random() * 6.28, ph: Math.random() * 6, moving: false, run: 0, provoked: 0, special: 4, special2: 9, flash: false, lungeT: 0 };
  e.hp = e.hpMax; e.idx = enemies.length; rig.g.position.set(x, e.y, z); enemies.push(e); return e;
}
{
  const rng = mulberry32(99); let s = 0, w = 0, c = 0, dk = 0;
  for (let i = 0; i < 4000 && dk < 5; i++) { const x = CASTLE.x + (rng() * 2 - 1) * 14, z = CASTLE.z + (rng() * 2 - 1) * 14; if (Math.abs(x - CASTLE.x) < 7 && z < CASTLE.z + 1) continue; spawnEnemy('dknight', x, z, 4 + Math.floor(rng() * 2)); dk++; }
  for (let i = 0; i < 4000 && c < 12; i++) {
    const x = CASTLE.x + (rng() * 2 - 1) * 28, z = CASTLE.z + (rng() * 2 - 1) * 28, h = heightAt(x, z);
    if (h < WATER + 2) continue; if (Math.abs(x - CASTLE.x) < 7 && z < CASTLE.z + 1 && z > CASTLE.z - 12) continue;
    spawnEnemy('skeleton', x, z, 2 + Math.floor(rng() * 2)); c++;
  }
  for (let i = 0; i < 6000 && (s < 14 || w < 14); i++) {
    const x = (rng() * 2 - 1) * (HALF - 14), z = (rng() * 2 - 1) * (HALF - 14), d = Math.hypot(x, z), h = heightAt(x, z);
    if (d < 32 || h < WATER + 2 || h > 12 || Math.hypot(x - SWAMP.x, z - SWAMP.z) < 60) continue;
    const f = fbm(x * .022 + 100, z * .022 - 50, 3);
    if (f > .5 && d > 55) { if (w < 14) { spawnEnemy('wolf', x, z); w++; } }
    else if (d < 140 && s < 14) { spawnEnemy('skeleton', x, z); s++; }
  }
  // swamp: ghouls risen from the graveyard, witches, troll
  GRAVES.slice(0, 10).forEach(g => spawnEnemy('ghoul', g.x + 1, g.z, 5 + Math.floor(rng() * 2)));
  for (let i = 0, n = 0; i < 3000 && n < 6; i++) { const a = rng() * 6.28, d = 10 + rng() * 40, x = SWAMP.x + Math.cos(a) * d, z = SWAMP.z + Math.sin(a) * d; if (heightAt(x, z) < WATER - .3) continue; spawnEnemy('ghoul', x, z, 5); n++; }
  for (let i = 0, n = 0; i < 3000 && n < 4; i++) { const a = rng() * 6.28, d = 14 + rng() * 34, x = SWAMP.x + Math.cos(a) * d, z = SWAMP.z + Math.sin(a) * d; if (heightAt(x, z) < WATER) continue; spawnEnemy('witch', x, z, 6); n++; }
  spawnEnemy('troll', CHAPEL.x - 14, CHAPEL.z - 14, 8);
  spawnEnemy('widow', LAIR.x, LAIR.z, 10);
  spawnEnemy('dragon', DRAGON_LAIR.x, DRAGON_LAIR.z, 15);
}

/* ================= effects (ground telegraphs, explosions, projectiles) ================= */
const effects = [], projectiles = [], eproj = [];
const fireRingM = basic(0xff7a1a, MID.FIRE), fireFillM = basic(0x6a2008, MID.FIRE), blastM = basic(0xffb040, MID.FIRE), fireballM = basic(0xffa040, MID.FIRE), hexM = basic(0x66ff44, MID.GLOW);
const voidM = basic(0x9a6aff, MID.GLOW), voidRingM = basic(0xe8dcff, MID.GLOW), beamM = basic(0xcfe6ff, MID.GLOW), webM = basic(0xdfe8f0, MID.GLOW);
const orbs = [], strandG = new THREE.BoxGeometry(1, .04, .05);
// spider web on the ground: jittered spokes + rings of thin strands; slows the player inside it
function makeWeb(r) {
  const g = new THREE.Group(), N = 9, A = [];
  const add = (x1, z1, x2, z2) => { const m = new THREE.Mesh(strandG, webM), dx = x2 - x1, dz = z2 - z1; m.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); m.scale.x = Math.hypot(dx, dz); m.rotation.y = -Math.atan2(dz, dx); g.add(m); };
  for (let i = 0; i < N; i++) { A.push(i / N * 6.283 + (Math.random() - .5) * .35); add(0, 0, Math.cos(A[i]) * r, Math.sin(A[i]) * r); }
  for (const f of [.28, .52, .76, 1]) for (let i = 0; i < N; i++) { const a = A[i], b = A[(i + 1) % N], q = r * f * (.94 + Math.random() * .1); add(Math.cos(a) * q, Math.sin(a) * q, Math.cos(b) * q, Math.sin(b) * q); }
  return g;
}
export function spawnWeb(x, z, r, net = true) {
  if (net && isHost()) sendNet({ t: 'web', x, z, r });
  const m = makeWeb(r); m.position.set(x, heightAt(x, z) + .14, z); m.scale.setScalar(.05); scene.add(m);
  for (let i = 0; i < 3; i++) {   // standing webs on the rim (visual only); they grow and vanish with the ground web
    const s = makeWeb(r * .5), b = (i + Math.random() * .6) / 3 * 6.283; s.rotation.order = 'YXZ'; s.rotation.set(Math.PI / 2, -b + Math.PI / 2, 0);
    s.position.set(Math.cos(b) * r * .85, r * .5, Math.sin(b) * r * .85); m.add(s);
  }
  effects.push({ type: 'web', m, x, z, r, t: 0, life: 7 }); burst('web', x, heightAt(x, z) + .5, z, 24); sfx('web');
}
function spawnOrb(x, z, vx, vz, visual) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 1), voidM), ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, .05, 6, 28), voidRingM);
  m.add(ring); scene.add(m); orbs.push({ m, ring, x, z, vx, vz, life: 2.8, tick: 0, visual }); sfx('void');
}
function spawnBeam(x, y, z, dx, dz, L) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.55, .55, L), beamM); m.position.set(x + dx * (L / 2 + .8), y, z + dz * (L / 2 + .8)); m.rotation.y = Math.atan2(dx, dz); scene.add(m);
  effects.push({ type: 'beam', m, t: 0 }); sfx('beam');
  for (let i = 1; i < 14; i++) burst('magic', x + dx * i * L / 14, y, z + dz * i * L / 14, 2);
}
function blast(x, z, r, type = 'fire') {
  const m = new THREE.Mesh(new THREE.RingGeometry(.75, 1, 40).rotateX(-Math.PI / 2), blastM); m.position.set(x, heightAt(x, z) + .1, z); m.scale.setScalar(.3); scene.add(m);
  effects.push({ type: 'blast', m, r, t: 0 }); burst(type, x, heightAt(x, z) + .4, z, Math.round(6 + r * 3)); sfx(type === 'spark' ? 'swing' : 'boom');
}
export function telegraph(x, z, r, delay, dmg, fire, net = true) {
  if (net && isHost()) sendNet({ t: 'tele', x, z, r, dl: delay, d: dmg, f: fire ? 1 : 0 });
  const y = heightAt(x, z) + .08;
  const m = new THREE.Mesh(new THREE.RingGeometry(r - .3, r, 48).rotateX(-Math.PI / 2), fireRingM); m.position.set(x, y, z); scene.add(m);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), fireFillM); inner.position.set(x, y + .01, z); inner.scale.setScalar(.01); scene.add(inner);
  effects.push({ type: 'tele', m, inner, x, z, r, t: 0, delay, dmg, fire });
}
const disposeMesh = m => { scene.remove(m); m.geometry.dispose(); };
export function updateEffects(dt) {
  P.webT = Math.max(0, (P.webT || 0) - dt);
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.t += dt;
    if (f.type === 'web') {
      f.m.scale.setScalar(Math.min(1, f.t / .3, Math.max(.01, f.life - f.t)));
      if (!P.dead && Math.hypot(P.x - f.x, P.z - f.z) < f.r && P.y - heightAt(P.x, P.z) < 1) { if (P.webT <= 0) floatText('WEBBED', P.x, P.y + 2.8, P.z, 'info'); P.webT = .3; }
      if (f.t >= f.life) { scene.remove(f.m); effects.splice(i, 1); }
      continue;
    }
    if (f.type === 'beam') { const k = f.t / .4; f.m.scale.set(1 - k, 1 - k, 1); if (k >= 1) { disposeMesh(f.m); effects.splice(i, 1); } continue; }
    if (f.type === 'blast') { const k = f.t / .35; f.m.scale.setScalar(.3 + k * f.r); if (k >= 1) { disposeMesh(f.m); effects.splice(i, 1); } }
    else if (f.type === 'tele') {
      const k = f.t / f.delay; f.inner.scale.setScalar(Math.max(.01, k));
      if (k >= 1) {
        if (!P.dead && Math.hypot(P.x - f.x, P.z - f.z) < f.r && P.y - heightAt(P.x, P.z) < 1.2) hurtPlayer(f.dmg);
        blast(f.x, f.z, f.r, f.fire ? 'fire' : 'dust'); if (f.fire) burst('fire', f.x, heightAt(f.x, f.z) + .5, f.z, 22);
        hitFeel(.02, .25); disposeMesh(f.m); disposeMesh(f.inner); effects.splice(i, 1);
      }
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt;
    p.m.position.set(p.x, p.y, p.z); p.m.rotation.y += dt * 9; if (Math.random() < .7) burst('fire', p.x, p.y, p.z, 1);
    let boom = p.life <= 0 || heightAt(p.x, p.z) > p.y;
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 1.2 + (e.k.scale || 1) * .6) { boom = true; break; }
    if (!p.visual && duelNear(p.x, p.z, 1.6, p.vx * dt, p.vz * dt)) boom = true;
    if (boom) {
      blast(p.x, p.z, 3.2);
      if (!p.visual) for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 3.2 + (e.k.scale || 1) * .6) hitEnemy(e, baseDmg() * 1.5, p.x, p.z);
      if (!p.visual) duelStrike('pt', p.x, p.z, baseDmg() * 1.5, 3.8);
      disposeMesh(p.m); projectiles.splice(i, 1);
    }
  }
  // void orbs: drift forward, drag enemies in, tick damage, implode at the end
  for (let i = orbs.length - 1; i >= 0; i--) {
    const p = orbs[i]; p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt; p.tick -= dt;
    const y = heightAt(p.x, p.z) + 1.6; p.m.position.set(p.x, y, p.z); p.m.rotation.y += dt * 2; p.ring.rotation.x += dt * 4; p.ring.rotation.z += dt * 2.3;
    if (Math.random() < .9) { const a = Math.random() * 6.283, r = 2 + Math.random() * 2; _dir.set(-Math.cos(a) * .9, 0, -Math.sin(a) * .9); burst('void', p.x + Math.cos(a) * r, y - .6 + Math.random() * 1.2, p.z + Math.sin(a) * r, 1, _dir); }
    const end = p.life <= 0;
    if (!p.visual && (p.tick <= 0 || end)) {
      p.tick = .35; const R = end ? 4.5 : 3.8;   // the "from" point is mirrored so the knockback pulls enemies inward
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) < R + reachOf(e)) hitEnemy(e, baseDmg() * (end ? 1.5 : .5), 2 * e.x - p.x, 2 * e.z - p.z, { quiet: !end });
      duelStrike('pt', p.x, p.z, baseDmg() * (end ? 1.5 : .5), R + .6);
    }
    if (end) { blast(p.x, p.z, 4.5, 'void'); p.ring.geometry.dispose(); disposeMesh(p.m); orbs.splice(i, 1); }
  }
  // enemy projectiles (witch hex): slightly homing, dodged by rolling or jumping
  for (let i = eproj.length - 1; i >= 0; i--) {
    const p = eproj[i]; p.life -= dt;
    const R = p.tid && p.tid !== NET.myId ? NET.remotes.get(p.tid) : null, me = !R;
    const tx = R ? R.x : P.x, tz = R ? R.z : P.z, ty = R ? R.y : P.y, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    p.vx += (dx / d * 12 - p.vx) * dt * 1.2; p.vz += (dz / d * 12 - p.vz) * dt * 1.2;
    p.x += p.vx * dt; p.z += p.vz * dt; p.m.position.set(p.x, p.y, p.z); p.m.rotation.y += dt * 7;
    if (Math.random() < .8) burst('hex', p.x, p.y, p.z, 1);
    let gone = p.life <= 0;
    if (d < 1 && Math.abs(ty + 1.2 - p.y) < 1.1) { if (me) hurtPlayer(p.dmg, { x: p.x - p.vx, z: p.z - p.vz }); gone = true; }
    if (gone) { burst('ichor', p.x, p.y, p.z, 10); disposeMesh(p.m); eproj.splice(i, 1); }
  }
}

export function spawnEproj(x, y, z, vx, vz, dmg, tid, net = true) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), hexM); scene.add(m);
  eproj.push({ m, x, y, z, vx, vz, life: 2.4, dmg, tid });
  if (net && isHost()) sendNet({ t: 'ep', x, y, z, vx, vz, d: dmg, tid });
}
export function spawnFxNet(m) {
  if (m.k === 'fb') { const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 0), fireballM); scene.add(mesh); projectiles.push({ m: mesh, x: m.x, y: heightAt(m.x, m.z) + 1.3, z: m.z, vx: m.vx, vz: m.vz, life: 1.1, visual: true }); }
  else if (m.k === 'bl') blast(m.x, m.z, m.r || 4, 'spark');
  else if (m.k === 'orb') spawnOrb(m.x, m.z, m.vx, m.vz, true);
  else if (m.k === 'beam') spawnBeam(m.x, heightAt(m.x, m.z) + 1.3, m.z, m.vx, m.vz, m.r || 18);
}

/* ================= aiming + skills ================= */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), aimV = new THREE.Vector3();
function aim() {
  ndc.set(MOUSE.x / innerWidth * 2 - 1, -(MOUSE.y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  plane.constant = -(P.y + 1); if (!ray.ray.intersectPlane(plane, aimV)) aimV.set(P.x + Math.sin(P.face), P.y, P.z + Math.cos(P.face));
  return aimV;
}
function faceAim() { const a = aim(); P.face = Math.atan2(a.x - P.x, a.z - P.z); P.aimLock = .35; return a; }
const baseDmg = () => dmgFor(S.lvl) + atkBonus();
const reachOf = e => (e.k.scale ? e.k.scale * (e.k.id === 'dragon' ? 2.6 : 1) : e.k.id === 'troll' ? 1.2 : 0);
export function doSlash() {
  if (P.dead || CD.slash > 0 || P.dodgeT > 0 || P.block || P.stunT > 0) return; CD.slash = CDMAX.slash; faceAim(); sfx('swing');
  P.atkType = P.comboT > 0 ? (P.atkType + 1) % 3 : 0; P.comboT = .75; P.atkT = 0;      // 3-hit combo
  const fx = Math.sin(P.face), fz = Math.cos(P.face), mult = [1, 1.1, 1.35][P.atkType];
  for (const e of enemies) {
    if (e.dead) continue; const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
    if (d > 3.4 + reachOf(e)) continue; if (d > 1 && (dx * fx + dz * fz) / d < (P.atkType === 1 ? -.1 : .2)) continue;
    hitEnemy(e, baseDmg() * mult * (.9 + Math.random() * .3), P.x, P.z);
  }
  hitDummy(fx, fz); duelStrike('arc', fx, fz, baseDmg() * mult * (.9 + Math.random() * .3));
}
export function doFireball() {
  if (P.dead || CD.fire > 0) return; CD.fire = CDMAX.fire; const a = faceAim(); P.atkT = 0; P.atkType = 1; sfx('fire');
  let dx = a.x - P.x, dz = a.z - P.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 0), fireballM); scene.add(m);
  projectiles.push({ m, x: P.x + dx * .9, y: P.y + 1.3, z: P.z + dz * .9, vx: dx * 24, vz: dz * 24, life: 1.1 });
  sendNet({ t: 'fx', k: 'fb', x: P.x + dx * .9, z: P.z + dz * .9, vx: dx * 24, vz: dz * 24 });
}
export function doWhirl() {
  if (P.dead || CD.whirl > 0) return; CD.whirl = CDMAX.whirl; P.spinT = .45; P.atkT = 0; P.atkType = 1; blast(P.x, P.z, 4.4, 'spark'); sendNet({ t: 'fx', k: 'bl', x: P.x, z: P.z, r: 4.4 });
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.z - P.z) < 4.4 + reachOf(e)) hitEnemy(e, baseDmg() * 1.6, P.x, P.z);
  duelStrike('rad', 0, 0, baseDmg() * 1.6, 4.4);
}
export function doOrb() {   // Void Orb: slow sphere that drags enemies in and implodes
  if (P.dead || CD.orb > 0) return; CD.orb = CDMAX.orb; const a = faceAim(); P.atkT = 0; P.atkType = 1;
  let dx = a.x - P.x, dz = a.z - P.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  spawnOrb(P.x + dx * 1.4, P.z + dz * 1.4, dx * 5.5, dz * 5.5); sendNet({ t: 'fx', k: 'orb', x: P.x + dx * 1.4, z: P.z + dz * 1.4, vx: dx * 5.5, vz: dz * 5.5 });
}
export function doBeam() {   // Moon Lance: instant beam through everything in a line
  if (P.dead || CD.beam > 0) return; CD.beam = CDMAX.beam; const a = faceAim(), L = 18; P.atkT = 0; P.atkType = 2;
  let dx = a.x - P.x, dz = a.z - P.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  spawnBeam(P.x, P.y + 1.3, P.z, dx, dz, L); sendNet({ t: 'fx', k: 'beam', x: P.x, z: P.z, vx: dx, vz: dz, r: L }); hitFeel(.03, .25);
  for (const e of enemies) {
    if (e.dead) continue; const ex = e.x - P.x, ez = e.z - P.z, along = ex * dx + ez * dz, side = Math.abs(ex * dz - ez * dx), rr = reachOf(e);
    if (along > -rr && along < L + 1 + rr && side < 1.3 + rr) hitEnemy(e, baseDmg() * 2.2, P.x, P.z);
  }
  duelStrike('line', dx, dz, baseDmg() * 2.2, L);
}
export function doDodge() {
  if (P.dead || HORSE.on || P.dodgeCd > 0 || P.air || P.st < 15 || P.stunT > 0) return; P.dodgeCd = .8; P.dodgeT = .42; P.st -= 15; P.stCd = .6; P.block = false;
  const l = Math.hypot(P.mx || 0, P.mz || 0);
  if (l > .1) { P.ddx = P.mx / l; P.ddz = P.mz / l; } else { P.ddx = Math.sin(P.face); P.ddz = Math.cos(P.face); }
  P.face = Math.atan2(P.ddx, P.ddz); burst('dust', P.x, P.y + .1, P.z, 8); sfx('roll');
}
export function doJump() {
  if (P.dead || HORSE.on || P.air || P.dodgeT > 0) return; P.vy = 8.6; P.air = true; burst('dust', P.x, P.y + .05, P.z, 5); sfx('jump');
}
const _dir = new THREE.Vector3();
export function hitEnemy(e, dmg, fromX, fromZ, o = {}) {
  if (e.dead) return;
  const M = craftMods(), id = e.k.id, undead = id === 'skeleton' || id === 'ghoul', beast = id === 'wolf' || id === 'widow' || id === 'troll' || id === 'dragon';
  const local = !o.remote, crit = o.crit ?? (Math.random() < .12 + M.crit);
  if (local) {   // crafted blade: metal + runes
    dmg = (dmg + M.atk + (beast ? M.beast : 0)) * (1 + M.dmg + (undead ? M.undead : 0) + (beast ? M.beastPct : 0) + (e.k.boss ? M.boss : 0) + (keys.shift ? M.run : 0) + M.extra);
    dmg = Math.round(dmg * (crit ? 2 + M.critDmg : 1));
    if (M.leech > 0) P.hp = Math.min(P.maxhp, P.hp + dmg * M.leech);
  }
  const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1, sc = e.k.scale || 1; _dir.set(dx / d, 0, dz / d);
  burst(e.k.fx, e.x - dx / d * .3 * sc, e.y + e.k.h * .45, e.z - dz / d * .3 * sc, crit ? 18 : 9, _dir);
  floatText((crit ? 'CRIT ' : '') + dmg, e.x, e.y + e.k.h * .8, e.z, crit ? 'crit' : (local ? '' : 'info'));
  e.hurtT = .12; e.hitT = e.k.boss ? .15 : .35;
  if (local) { TGT.e = e; if (!o.quiet) { hitFeel(crit ? .07 : .045, crit ? .3 : .14); sfx(crit ? 'crit' : 'hit'); } }
  if (isClient() && local) { e.hp -= dmg; sendNet({ t: 'hit', e: e.idx, d: dmg, c: crit, x: fromX, z: fromZ }); return; }   // karar host'ta
  e.hp -= dmg; e.provoked = 6;
  const kb = e.k.boss ? 1 : e.k.elite ? 2.5 : 7; e.kx = dx / d * kb; e.kz = dz / d * kb;
  if (e.hp <= 0) killEnemy(e, o.by);
}
function killEnemy(e, by) {
  e.dead = true; e.deadT = 7; e.respawnT = e.k.respawn || 35; e.atkT = -1;
  burst(e.k.fx, e.x, e.y + e.k.h * .4, e.z, e.k.boss ? 60 : 22);
  sfx('die'); if (e.k.boss || e.k.elite) hitFeel(.15, .6);
  if (by && by !== NET.myId) sendNet({ t: 'kill', to: by, e: e.idx }); else grantKill(e);
}
export function grantKill(e) {   // reward goes to the killer
  S.kills[e.k.id] = (S.kills[e.k.id] || 0) + 1;
  const xp = partyShare(e.xp, e.k.id);   // in a party the kill is split with members standing near
  rollDrop(e.k.id, e.lvl, e.x, e.z); addXP(xp); S.gold += Math.round(e.gold * (1 + craftMods().gold));
  floatText('+' + xp + ' XP', e.x, e.y + e.k.h, e.z, 'info');
  if (e.k.boss || e.k.elite) toast(e.k.name + ' defeated!');
  checkQuests();
}
// src: where the attack came from {x, z, e?}; without it (area attacks) it cannot be blocked
export function hurtPlayer(d, src) {
  if (P.dead || P.invuln) return;
  if (P.dodgeT > 0) { floatText('dodged', P.x, P.y + 2.8, P.z, 'info'); return; }
  if (P.block && src && P.stunT <= 0) {
    const ang = Math.atan2(src.x - P.x, src.z - P.z);
    if (Math.abs(angDiff(P.face, ang)) < 1.25) {       // frontal hit
      const sx = P.x + Math.sin(P.face) * .6, sz = P.z + Math.cos(P.face) * .6;
      if (P.blockT < .22) {                              // perfectly timed: parry
        burst('spark', sx, P.y + 1.3, sz, 24); hitFeel(.09, .3); floatText('PARRY!', P.x, P.y + 2.8, P.z, 'crit'); sfx('parry');
        P.st = Math.min(P.stMax, P.st + 15);
        if (src.e && !isClient()) { src.e.stunT = 1.4; src.e.atkT = -1; src.e.kx = Math.sin(ang) * 6; src.e.kz = Math.cos(ang) * 6; }
        return;
      }
      P.st -= d * 1.4; P.stCd = 1; burst('spark', sx, P.y + 1.3, sz, 10); hitFeel(.03, .12); sfx('block');
      if (P.st <= 0) { P.st = 0; P.block = false; P.stunT = .9; floatText('SHIELD BROKEN', P.x, P.y + 2.8, P.z, 'hurt'); d *= .6; }
      else { d *= .15; floatText('BLOCK', P.x, P.y + 2.8, P.z, 'info'); if (d < 1) return; }
    }
  }
  const AM = armorMods();
  if (AM.thorns > 0 && src && src.e && !src.e.dead && Math.hypot(src.x - P.x, src.z - P.z) < 6) hitEnemy(src.e, Math.max(1, d * AM.thorns), P.x, P.z, { crit: false });   // thorns
  d = Math.max(1, Math.round(d - defBonus() - AM.def)); P.hp -= d; P.hurtT = .35; P.hitT = .3; P.lastHit = 0;
  burst('blood', P.x, P.y + 1.3, P.z, 7); hitFeel(.03, .22); sfx('hurt');
  floatText('-' + d, P.x, P.y + 2.8, P.z, 'hurt');
  if (DUEL.on && P.hp <= 1) { P.hp = 1; duelLost(); return; }   // duel: never drops below 1
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadT = 3.2; closeDialog(); toast('You were defeated... you will wake in the village.'); burst('blood', P.x, P.y + .6, P.z, 20); }
}

/* ================= enemy update ================= */
function setFlash(e, on) {
  if (e.flash === on) return; e.flash = on;
  for (const m of e.rig.meshes) m.material = on ? flashMat(m.userData.orig.opacity) : m.userData.orig;
}
function animate(e, dt) {
  const r = e.rig, mv = e.moving ? Math.min(1, e.curSpd / Math.max(1, e.k.spd * .6)) : 0, st = { ph: e.ph, amt: mv, run: e.run, atk: e.atkT, atkType: e.atkType, hit: Math.max(0, e.hitT) * 2.5, t: T, dt, alert: e.provoked > 0 || e.chasing, style: e.k.biped, breath: e.breathT > 0 ? e.breathT / 1.6 : 0, lunge: e.lungeT > 0 };
  if (e.k.biped) {
    animBiped(r, st);
    if (r.jaw) r.jaw.rotation.x = .12 + Math.abs(Math.sin(T * 9 + e.ph)) * .15 * (st.alert ? 1 : .3) + (e.lungeT > 0 ? .3 : 0);
  } else if (e.k.anim === 'wolf') animWolf(r, st);
  else if (e.k.anim === 'spider') animSpider(r, st);
  else if (e.k.anim === 'dragon') animDragon(r, st);
}
/* target choice: nearest living player (on the host, remote players are candidates too) */
const myTid = () => NET.online ? NET.myId : 0;
function targetFor(e) {
  let best = P.dead ? null : { x: P.x, y: P.y, z: P.z, id: myTid(), local: true }, bd = best ? Math.hypot(P.x - e.x, P.z - e.z) : 1e9;
  if (isHost()) for (const R of remoteTargets()) { const d = Math.hypot(R.x - e.x, R.z - e.z); if (d < bd) { bd = d; best = { x: R.x, y: R.y, z: R.z, id: R.id, local: false }; } }
  return best || { x: P.x, y: P.y, z: P.z, id: myTid(), local: true, dead: true };
}
function nearestPlayerDist(x, z) { let d = Math.hypot(P.x - x, P.z - z); if (isHost()) for (const R of remoteTargets()) d = Math.min(d, Math.hypot(R.x - x, R.z - z)); return d; }
function dmgTarget(tg, d, e) { if (tg.local) hurtPlayer(d, { x: e.x, z: e.z, e }); else sendNet({ t: 'dmg', to: tg.id, d, x: e.x, z: e.z }); }
function deadAnim(e, dt) {
  const g = e.rig.g; setFlash(e, false);
  if (e.deadT > 0) {
    e.deadT -= dt;
    const fall = Math.min(1, (7 - e.deadT) / .6), ez = fall * fall;
    if (e.k.biped) { g.rotation.x = -ez * 1.45; if (e.rig.legL) { e.rig.legL.kn.rotation.x = e.rig.legR.kn.rotation.x = (1 - ez) * .8 + .2; } }
    else g.rotation.z = ez * (e.k.anim === 'spider' ? Math.PI * .95 : 1.5);
    if (e.deadT < 1.2) g.position.y -= dt * 1.2;
    if (e.deadT <= 0) g.visible = false;
  }
}
function decorate(e, dLocal) {
  const g = e.rig.g;
  g.position.set(e.x, e.y + (e.k.ranged ? Math.sin(T * 1.6 + e.ph) * .06 : 0), e.z); g.rotation.y = e.face;
  if (e.breathT > 0 && e.k.id === 'dragon') { const hx = e.x + Math.sin(e.face) * 7.5, hz = e.z + Math.cos(e.face) * 7.5; burst('fire', hx, e.y + 4, hz, 3, _dir.set(Math.sin(e.face), -.3, Math.cos(e.face))); }
  if (e.k.ranged && e.atkT >= 0 && e.atkT < .5) burst('hex', e.x + Math.sin(e.face) * .4, e.y + 2.1, e.z + Math.cos(e.face) * .4, 1);
  setFlash(e, e.hurtT > 0);
  if (dLocal < 18 || TGT.e === e) label(e.k.name + ' · lv ' + e.lvl, e.x, e.y + e.k.h * (e.k.scale && !e.k.boss ? e.k.scale : 1), e.z, (e.k.boss || e.k.elite) ? 'foe boss' : 'foe', e.hp / e.hpMax);
}
function updateEnemy(e, dt) {
  const g = e.rig.g;
  if (e.dead) {
    deadAnim(e, dt);
    e.respawnT -= dt;
    if (e.respawnT <= 0 && nearestPlayerDist(e.home.x, e.home.z) > 50) {
      e.dead = false; e.hp = e.hpMax; e.x = e.home.x; e.z = e.home.z; g.visible = true; g.rotation.set(0, 0, 0);
    }
    return;
  }
  const tg = targetFor(e), dxp = tg.x - e.x, dzp = tg.z - e.z, d = Math.hypot(dxp, dzp), dLocal = Math.hypot(P.x - e.x, P.z - e.z);
  if (d > 90) { g.visible = false; return; }
  g.visible = dLocal < 95;
  e.cd -= dt; e.hurtT -= dt; e.hitT -= dt; e.provoked -= dt; e.lungeT -= dt; if (e.breathT > 0) e.breathT -= dt;
  const aggro = e.k.aggro * (ENV.night > .5 ? 1.3 : 1);
  let tx = e.wx, tz = e.wz, sp = e.k.spd * .35; e.chasing = false; e.run = 0;
  if (e.stunT > 0) { e.stunT -= dt; e.atkT = -1; e.lungeT = 0; sp = 0; e.hitT = .3; }   // parried: staggering
  else if (e.lungeT > 0) { sp = 0; e.x += (e.lx || 0) * dt; e.z += (e.lz || 0) * dt;   // lx/lz are unset on a client that just became host mid-lunge
    if (d < 1.6 && !e.hit) { e.hit = true; dmgTarget(tg, e.dmg * 1.3, e); } }
  else if (e.atkT >= 0) {
    e.atkT += dt / e.k.atkTime; sp = 0; tx = tg.x; tz = tg.z;
    if (!e.hit && e.atkT > .5) {
      e.hit = true;
      if (e.k.ranged) { const ux = dxp / (d || 1), uz = dzp / (d || 1); spawnEproj(e.x + ux, e.y + 1.7, e.z + uz, ux * 10, uz * 10, e.dmg, tg.id); }
      else if (e.k.id === 'troll') { telegraph(e.x + Math.sin(e.face) * 3, e.z + Math.cos(e.face) * 3, 3.2, .05, e.dmg); hitFeel(.05, .45); }
      else if (d < e.k.reach + .7) dmgTarget(tg, e.dmg, e);
    }
    if (e.atkT >= 1) e.atkT = -1;
  } else if ((d < aggro || e.provoked > 0) && !tg.dead) {
    tx = tg.x; tz = tg.z; sp = e.k.spd; e.chasing = true; e.run = 1;
    if (e.k.ranged) {
      if (d < 8) { tx = e.x - dxp; tz = e.z - dzp; sp = e.k.spd * .9; }
      else if (d < e.k.reach) { sp = 0; if (e.cd <= 0) { e.atkT = 0; e.hit = false; e.cd = e.k.atkCd; e.atkType = 2; } }
    } else if (d < e.k.reach) { sp = 0; if (e.cd <= 0) { e.atkT = 0; e.hit = false; e.cd = e.k.atkCd; e.atkType = Math.floor(Math.random() * 3); } }
    else if (e.k.lunge && d > 3 && d < 6.5 && e.cd <= 0) {
      e.lungeT = .38; e.hit = false; e.cd = 2.2; const ux = dxp / d, uz = dzp / d; e.lx = ux * 14; e.lz = uz * 14; burst('dust', e.x, e.y + .1, e.z, 5);
    }
    if (e.k.id === 'troll') { e.special -= dt; if (e.special <= 0) { e.special = 6; telegraph(tg.x, tg.z, 4, 1.2, e.dmg * 1.3); } }
    if (e.k.id === 'widow') { e.special -= dt; if (e.special <= 0) { e.special = 6.5; telegraph(tg.x, tg.z, 4.5, 1.15, e.dmg * 1.4); telegraph(e.x, e.z, 6, 1.6, e.dmg); } e.special2 -= dt; if (e.special2 <= 0) { e.special2 = 8; spawnWeb(tg.x, tg.z, 5.5); e.hitT = .3; } }
    if (e.k.id === 'dragon') {
      e.special -= dt; e.special2 -= dt;
      if (e.special <= 0) {
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
  e.curSpd = lerp(e.curSpd || 0, sp, 1 - Math.exp(-6 * dt));
  const nx = e.x + (dx * e.curSpd + e.kx) * dt, nz = e.z + (dz * e.curSpd + e.kz) * dt;
  e.kx *= Math.max(0, 1 - 9 * dt); e.kz *= Math.max(0, 1 - 9 * dt);
  if (nx !== nx || nz !== nz) { e.x = e.home.x; e.z = e.home.z; e.kx = e.kz = e.lx = e.lz = 0; return; }   // safety net: a NaN position would throw in heightAt every frame and freeze the game
  const gh = heightAt(nx, nz);
  if (gh > WATER - 1.2 && Math.abs(gh - e.y) < 1.6 * (e.k.scale || 1)) { const q = { x: nx, z: nz }; collide(q, e.k.boss ? 1.8 : e.k.elite ? 1 : .6); e.x = q.x; e.z = q.z; }
  e.y = heightAt(e.x, e.z); e.moving = e.curSpd > .3;
  const faceT = e.chasing || e.atkT >= 0 ? Math.atan2(dxp, dzp) : Math.atan2(dx, dz);
  e.face += angDiff(e.face, faceT) * Math.min(1, dt * (e.k.id === 'dragon' ? 2.5 : 8));
  e.ph += dt * (e.moving ? (e.curSpd * 1.9 + 1) / (e.k.scale || 1) : 1);
  if (g.visible) { animate(e, dt); decorate(e, dLocal); }
}
/* client: enemies are drawn smoothed from the host's snapshots */
function updateEnemyRemote(e, dt) {
  const g = e.rig.g;
  if (e.netDead && !e.dead) { e.dead = true; e.deadT = 7; e.atkT = -1; burst(e.k.fx, e.x, e.y + e.k.h * .4, e.z, e.k.boss ? 60 : 22); }
  if (!e.netDead && e.dead) { e.dead = false; if (e.nx != null) { e.x = e.nx; e.z = e.nz; } g.visible = true; g.rotation.set(0, 0, 0); }
  if (e.dead) { deadAnim(e, dt); return; }
  const dLocal = Math.hypot(P.x - e.x, P.z - e.z);
  if (dLocal > 95) { g.visible = false; if (e.nx != null) { e.x = e.nx; e.z = e.nz; } return; }
  g.visible = true;
  e.hurtT -= dt; e.hitT -= dt; e.lungeT -= dt; if (e.breathT > 0) e.breathT -= dt;
  const k = 1 - Math.exp(-10 * dt);
  if (e.nx != null) { e.x = lerp(e.x, e.nx, k); e.z = lerp(e.z, e.nz, k); e.face += angDiff(e.face, e.nf) * k; }
  e.y = heightAt(e.x, e.z); e.curSpd = e.nspd || 0; e.moving = e.curSpd > .3; e.run = e.chasing ? 1 : 0;
  if (e.atkT >= 0) { e.atkT += dt / e.k.atkTime; if (e.atkT >= 1) e.atkT = -1; }
  e.ph += dt * (e.moving ? (e.curSpd * 1.9 + 1) / (e.k.scale || 1) : 1);
  animate(e, dt); decorate(e, dLocal);
}
export function updateEnemies(dt) {
  T += dt; const cl = isClient();
  for (const e of enemies) cl ? updateEnemyRemote(e, dt) : updateEnemy(e, dt);
  if (TGT.e && TGT.e.dead) TGT.e = null;
}
/* host → clients: compact state of enemies near any player */
export function snapshotRows() {
  const rows = [], rem = remoteTargets(); if (!rem.length) return rows;
  enemies.forEach((e, i) => {
    let near = false; for (const R of rem) if (Math.abs(R.x - e.x) < 110 && Math.abs(R.z - e.z) < 110) { near = true; break; }
    if (!near) return;
    rows.push([i, Math.round(e.x * 10), Math.round(e.z * 10), Math.round(e.face * 100), Math.max(0, Math.round(e.hp)),
      (e.dead ? 1 : 0) | (e.provoked > 0 || e.chasing ? 2 : 0) | (e.lungeT > 0 ? 4 : 0) | (e.breathT > 0 ? 8 : 0),
      e.atkT >= 0 ? Math.round(e.atkT * 100) : -1, e.atkType || 0, Math.round((e.curSpd || 0) * 10)]);
  });
  return rows;
}
export function applySnapshot(rows) {
  for (const r of rows) {
    const e = enemies[r[0]]; if (!e) continue;
    e.nx = r[1] / 10; e.nz = r[2] / 10; e.nf = r[3] / 100;
    if (!e.gotNet) { e.x = e.nx; e.z = e.nz; e.face = e.nf; e.gotNet = true; }
    e.hp = r[4]; e.netDead = !!(r[5] & 1); e.chasing = !!(r[5] & 2); e.provoked = e.chasing ? 1 : 0;
    if (r[5] & 4) e.lungeT = .15; if ((r[5] & 8) && !(e.breathT > 0)) e.breathT = 1.6;
    if (r[6] >= 0 && (e.atkT < 0 || Math.abs(e.atkT - r[6] / 100) > .35)) { e.atkT = r[6] / 100; e.atkType = r[7]; }
    e.nspd = r[8] / 10;
  }
}

/* ================= player update ================= */
export function updatePlayer(dt) {
  { const AM = armorMods(); P.maxhp = 100 + 20 * (S.lvl - 1) + AM.hp; if (!P.dead && P.hp > 0) P.hp = Math.min(P.maxhp, P.hp + AM.regen * dt); P.armorSpeed = AM.speed; }   // crafted armour
  for (const k in CD) CD[k] = Math.max(0, CD[k] - dt);
  P.dodgeCd -= dt; P.lastHit += dt; P.hurtT -= dt; P.hitT -= dt; P.aimLock -= dt; P.comboT -= dt;
  const r = P.rig;
  if (P.dead) {
    if (HORSE.on) { HORSE.on = false; HORSE.rig.g.visible = false; }
    P.deadT -= dt; P.g.rotation.x = Math.max(-1.45, P.g.rotation.x - dt * 3);
    if (P.deadT <= 0) { P.dead = false; P.hp = P.maxhp; P.x = 0; P.z = 6; P.vx = P.vz = 0; S.gold = Math.floor(S.gold * .9); P.g.rotation.x = 0; }
    P.g.position.set(P.x, P.y, P.z); return;
  }
  const ix = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const sy = Math.sin(P.camYaw || 0), cy = Math.cos(P.camYaw || 0);
  let mx = ix * cy - iz * sy, mz = -ix * sy - iz * cy; const len = Math.hypot(mx, mz); if (len > 0) { mx /= len; mz /= len; }
  P.mx = mx; P.mz = mz;
  const ground = standAt(P.x, P.z, P.y), inWater = ground < WATER - .2 && !P.air;
  const pvx = P.vx, pvz = P.vz;
  if (P.dodgeT > 0) { P.dodgeT -= dt; P.vx = P.ddx * 13; P.vz = P.ddz * 13; }
  else {
    const run = keys.shift && !P.block ? 1 : 0, sp = (HORSE.on ? (run ? 17 : 10) : (run ? 9.5 : 5.8)) * (1 + (P.armorSpeed || 0)) * (P.block ? .45 : 1) * (P.stunT > 0 ? .3 : 1) * (inWater ? .55 : 1) * (P.webT > 0 ? .4 : 1) * (P.atkT >= 0 && !P.air ? .5 : 1), a = 1 - Math.exp(-(P.air ? 3 : 12) * dt);
    P.vx += (mx * sp - P.vx) * a; P.vz += (mz * sp - P.vz) * a;
  }
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  const bad = (x, z) => { const h = standAt(x, z, P.y); return h - P.y > (P.air ? 2.2 : 1.25) || h < WATER - 1.5; };
  if (bad(nx, nz)) { const okx = !bad(nx, P.z), okz = !bad(P.x, nz); if (!okx) { nx = P.x; P.vx = 0; } if (!okz) { nz = P.z; P.vz = 0; } }
  const q = { x: clamp(nx, -HALF + 3, HALF - 3), z: clamp(nz, -HALF + 3, HALF - 3) }; collide(q, .5, P.y); P.x = q.x; P.z = q.z;
  // jump / gravity
  const gy = standAt(P.x, P.z, P.y);
  P.high = gy - heightAt(P.x, P.z);   // > 0 on a tower or stairs (camera zooms in)
  if (P.air) { P.vy -= 24 * dt; P.y += P.vy * dt; if (P.y <= gy) { P.y = gy; P.air = false; P.vy = 0; burst('dust', P.x, P.y + .05, P.z, 6); } }
  else { if (P.y - gy > .7) { P.air = true; P.vy = 0; } else P.y = lerp(P.y, gy, 1 - Math.exp(-20 * dt)); }
  // acceleration → lean, turn rate
  const spd = Math.hypot(P.vx, P.vz), fwdAcc = ((P.vx - pvx) * Math.sin(P.face) + (P.vz - pvz) * Math.cos(P.face)) / Math.max(dt, .001);
  P.lean = lerp(P.lean, clamp(fwdAcc / 60, -.4, .4), 1 - Math.exp(-6 * dt));
  const oldFace = P.face;
  if (P.aimLock <= 0 && spd > .5 && P.dodgeT <= 0) P.face += angDiff(P.face, Math.atan2(P.vx, P.vz)) * Math.min(1, dt * 12);
  P.turn = lerp(P.turn, clamp(angDiff(oldFace, P.face) / Math.max(dt, .001) / 8, -1, 1), 1 - Math.exp(-8 * dt));
  if (P.atkT >= 0) { P.atkT += dt / .36; if (P.atkT > 1) P.atkT = -1; }
  P.ph += dt * Math.max(1.5, spd * 1.75);
  // shield: while Alt is held
  P.stunT -= dt; P.stCd -= dt;
  const wantBlock = keys.alt && P.dodgeT <= 0 && !P.air && P.stunT <= 0 && P.st > 3;
  if (wantBlock && !P.block) P.blockT = 0;
  P.block = wantBlock;
  if (P.block) { P.blockT += dt; P.st -= 3 * dt; P.stCd = Math.max(P.stCd, .5); P.atkT = -1; faceAim(); }
  else if (P.stCd <= 0) P.st = Math.min(P.stMax, P.st + 28 * dt);
  P.animAmt = P.dodgeT > 0 ? 0 : Math.min(1, spd / 5.8); P.animRun = clamp((spd - 6) / 3.5, 0, 1);
  animBiped(r, { ph: P.ph, amt: P.animAmt, run: P.animRun, atk: P.atkT, atkType: P.atkType, hit: Math.max(0, P.hitT) * 3,
    dodge: P.dodgeT > 0 ? 1 - P.dodgeT / .42 : -1, air: P.air ? clamp(.4 + (P.vy > 0 ? .6 : .3), 0, 1) : 0, lean: P.lean, turn: P.turn, block: P.block ? 1 : 0, t: T, dt, style: 'knight' });
  if (P.stunT > 0) r.spine.rotation.x -= .35;
  if (P.spinT > 0) { P.spinT -= dt; P.face += dt * 26; }
  P.arc.visible = P.atkT > .3 && P.atkT < .62; P.arc.rotation.z = [-.2, .9, -1.2][P.atkType] ?? 0;
  if (HORSE.on) {   // riding: sit in the saddle, legs astride; the horse runs under the knight
    const H = HORSE.rig, hs = Math.hypot(P.vx, P.vz);
    HORSE.ph += dt * Math.max(1.2, hs * 1.05);
    animWolf(H, { amt: Math.min(1, hs / 6), run: clamp((hs - 11) / 4, 0, 1), ph: HORSE.ph, t: T, dt, atk: -1 });
    H.g.position.set(P.x, P.y, P.z); H.g.rotation.y = P.face;
    r.legL.p.rotation.x = r.legR.p.rotation.x = -1.35; r.legL.kn.rotation.x = r.legR.kn.rotation.x = 1.45;
    r.legL.p.rotation.z = .42; r.legR.p.rotation.z = -.42;
    P.g.position.set(P.x, P.y + H.body.position.y * 1.55 - .25, P.z); P.g.rotation.y = P.face;
  } else P.g.position.set(P.x, P.y, P.z), P.g.rotation.y = P.face;
  P.lamp.intensity = .5 + ENV.night * 1.1;
  if ((Math.hypot(P.x, P.z) < 9 || Math.hypot(P.x - CAMP.x, P.z - CAMP.z) < 6) && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + 8 * dt);
  else if (P.lastHit > 6 && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + 1.5 * dt);
  for (const c of crystals) if (!c.taken && Math.hypot(c.x - P.x, c.z - P.z) < 2.6) { c.taken = true; c.mesh.visible = false; S.taken.push(c.id); S.shards++; toast('Moon Shard collected (' + S.shards + ')'); burst('magic', c.x, heightAt(c.x, c.z) + 1.5, c.z, 20); checkQuests(); }
  if (!S.circle && Math.hypot(CIRCLE.x - P.x, CIRCLE.z - P.z) < 10) { S.circle = true; toast('Stone Circle discovered!'); checkQuests(); }
}

/* ================= NPC life + labels ================= */
export function updateNPCs(dt) {
  for (const n of NPCS) { n.ph += dt; animBiped(n.rig, { ph: 0, amt: 0, atk: -1, t: n.ph, dt, style: 'knight' }); }
}
export function actorLabels() {
  label(NET.name || 'Torvan', P.x, P.y + 2.6, P.z, 'me');
  NPCS.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) < 30) label(n.name + npcMark(n), n.x, n.y + 2.5, n.z, 'npc'); });
}
export function resetPlayer() { P.maxhp = 100 + 20 * (S.lvl - 1); P.hp = P.maxhp; P.dead = false; P.g.rotation.x = 0; P.air = false; P.vy = 0; }
