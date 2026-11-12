// PvP duels: challenge prompt (G near a player; Y accept / N decline), 3-2-1 countdown, ASCII ring on the ground.
// Only the two duelists hurt each other; health never drops below 1 (whoever reaches 1 loses). The server validates range + cooldown.
import { THREE, MID, basic, heightAt } from './core.js';
import { scene } from './render.js';
import { P } from './actors.js';
import { floatText, toast } from './game.js';
import { NET, sendNet } from './net.js';

export const DUEL = { on: false, opp: 0, name: '', cx: 0, cz: 0, t: 0 };
const RING_R = 12, ringM = basic(0xffd060, MID.FIRE);
let inv = null, ring = null, ringT = 0;

const box = document.createElement('div');   // prompt + countdown banner
box.style.cssText = 'position:fixed;top:22%;left:50%;transform:translateX(-50%);z-index:30;font:bold 18px monospace;color:#ffd060;text-shadow:0 0 6px #000,0 0 2px #000;text-align:center;pointer-events:none;white-space:pre';
document.body.appendChild(box);
const say = t => { box.textContent = t; };

function makeRing() {
  if (ring) scene.remove(ring);
  const pts = new THREE.Group();
  const m = new THREE.Mesh(new THREE.RingGeometry(RING_R - .35, RING_R, 72).rotateX(-Math.PI / 2), ringM);
  m.position.set(DUEL.cx, heightAt(DUEL.cx, DUEL.cz) + .12, DUEL.cz); pts.add(m); scene.add(pts); ring = pts;
}
function clearRing() { if (ring) scene.remove(ring); ring = null; }

/* Key handling: returns true when the key was used by the duel system */
export function duelKey(k) {
  if (inv) {
    if (k === 'y' || k === 'n') { sendNet({ t: 'duel_r', ok: k === 'y' }); toast(k === 'y' ? 'Duel accepted' : 'Duel declined'); inv = null; say(''); return true; }
    return false;
  }
  if (k !== 'g') return false;
  if (!NET.online) { toast('Duels need other players online'); return true; }
  if (DUEL.on) { toast('You are already in a duel'); return true; }
  let best = null, bd = 10;
  for (const R of NET.remotes.values()) { const d = Math.hypot(R.x - P.x, R.z - P.z); if (R.got && d < bd) { bd = d; best = R; } }
  if (!best) toast('No player close enough to challenge (stand within 10 m)'); else sendNet({ t: 'duel', to: best.id });
  return true;
}

/* Server messages */
export function onDuelMsg(m) {
  if (m.t === 'duel_inv') {
    if (!m.from) { inv = null; say(''); return; }
    inv = { from: m.from, name: m.name }; say(m.name + ' challenges you to a duel!\n[Y] accept   [N] decline');
  } else if (m.t === 'duel_go') {
    inv = null; Object.assign(DUEL, { on: true, opp: m.opp, name: m.name, cx: m.cx, cz: m.cz, t: 3, end: performance.now() + 3000, lost: false }); makeRing();
    toast('Duel against ' + m.name + ' — stay inside the ring');
  } else if (m.t === 'duel_end') {
    if (!DUEL.on) return;
    DUEL.on = false; clearRing(); say('');
    P.hp = P.maxhp; P.dead = false;   // no death or item loss in a duel
    const won = m.win === NET.myId; floatText(won ? 'VICTORY' : 'DEFEAT', P.x, P.y + 3.2, P.z, won ? 'crit' : 'hurt');
  }
}

/* Called by hurtPlayer when a duelist reaches 1 HP (sent once per duel) */
export function duelLost() { if (DUEL.on && !DUEL.lost) { DUEL.lost = true; sendNet({ t: 'duel_lose' }); } }

/* Called by the player's attacks. kind: 'arc' (sword), 'rad' (whirlwind, range=r), 'line' (beam, range=length) */
export function duelStrike(kind, fx, fz, dmg, range) {
  if (!DUEL.on || DUEL.t > 0) return;
  const R = NET.remotes.get(DUEL.opp); if (!R || !R.got) return;
  const dx = R.x - P.x, dz = R.z - P.z, d = Math.hypot(dx, dz); let hit = false;
  if (kind === 'arc') hit = d < 3.4 && (d < 1 || (dx * fx + dz * fz) / d >= .2);
  else if (kind === 'rad') hit = d < range;
  else hit = (dx * fx + dz * fz) > -1 && (dx * fx + dz * fz) < range + 1 && Math.abs(dx * fz - dz * fx) < 1.3;
  if (!hit) return;
  dmg = Math.round(dmg); sendNet({ t: 'pvp', d: dmg }); floatText(String(dmg), R.x, R.y + 2.2, R.z, 'info');
}

export function updateDuel(dt) {
  if (!DUEL.on) return;
  ringT += dt;
  if (ring) ring.visible = ((ringT * 2) | 0) % 2 === 0 || DUEL.t <= 0;
  if (DUEL.t > 0) { DUEL.t = (DUEL.end - performance.now()) / 1000; say(   // wall clock: a throttled tab must not stretch the countdown
DUEL.t > 0 ? String(Math.ceil(DUEL.t)) : 'FIGHT!'); if (DUEL.t <= 0) setTimeout(() => { if (DUEL.on) say(''); }, 900); return; }
  if (Math.hypot(P.x - DUEL.cx, P.z - DUEL.cz) > RING_R && !DUEL.lost) { toast('You left the ring — you lose'); duelLost(); }
}
