// Character creation (first start) and the starting tutorial: move, run, strike the training dummy,
// roll, then talk to Old Mira. Progress is saved in S.tut; the look in S.look.
import { THREE, $, keys, heightAt, addCollider, lam, MID } from './core.js';
import { scene } from './render.js';
import { S, Q, toast } from './game.js';
import { P, LOOKS, setLook } from './actors.js';
import { burst } from './fx.js';

/* ---------------- character creation ---------------- */
const hex = c => '#' + c.toString(16).padStart(6, '0');
let createCb = null;
export function creating() { return !!createCb; }
export function openCreate(done) {
  createCb = done; S.look = S.look || { tabard: 0, cape: 0, emblem: 0 };
  const row = (key, list) => list.map((c, i) => `<button data-k="${key}" data-i="${i}" class="${S.look[key] === i ? 'on' : ''}" style="background:${c == null ? '#0d0f14' : hex(c)}">${c == null ? 'none' : ''}</button>`).join('');
  $('createRows').innerHTML =
    `<div class="clabel">Tabard and shield</div><div class="crow">${row('tabard', LOOKS.tabard)}</div>` +
    `<div class="clabel">Cape</div><div class="crow">${row('cape', LOOKS.cape)}</div>` +
    `<div class="clabel">Emblem</div><div class="crow">${row('emblem', LOOKS.emblem)}</div>`;
  $('create').hidden = false;
}
let inited = false;
export function initCreate() {
  if (inited) return; inited = true;
  $('create').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'createGo') { $('create').hidden = true; const cb = createCb; createCb = null; S.tut = S.tut || 0; cb && cb(); return; }
    S.look[b.dataset.k] = +b.dataset.i; setLook(S.look); openCreate(createCb);
  });
}

/* ---------------- training dummy (south of the village, on the starting road) ---------------- */
export const DUMMY = { x: 4.5, z: 20, hits: 0, shake: 0, g: null };
{
  const D = DUMMY, y = heightAt(D.x, D.z), g = new THREE.Group(), wood = lam(0x5a3a22, MID.WOOD), straw = lam(0xb59a52, MID.WOOD);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 2.1, 6), wood); post.position.y = 1.05;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .12), wood); arm.position.y = 1.45;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, .8, 8), straw); body.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), straw); head.position.y = 1.85;
  g.add(post, arm, body, head); g.position.set(D.x, y, D.z); scene.add(g); D.g = g;
  addCollider(D.x, D.z, .35, 'post');
}
// called from doSlash with the swing direction
export function hitDummy(fx, fz) {
  const dx = DUMMY.x - P.x, dz = DUMMY.z - P.z, d = Math.hypot(dx, dz);
  if (d > 3.2 || (d > .8 && (dx * fx + dz * fz) / d < .2)) return;
  DUMMY.hits++; DUMMY.shake = .35; burst('dust', DUMMY.x, heightAt(DUMMY.x, DUMMY.z) + 1.2, DUMMY.z, 8);
}

/* ---------------- tutorial ---------------- */
const STEPS = [
  { t: 'Move with W A S D', done: s => s.moved > 6 },
  { t: 'Hold Shift while moving to run', done: s => s.ran > 1.2 },
  { t: 'Strike the training dummy: left click (3 hits)', done: () => DUMMY.hits >= 3 },
  { t: 'Roll out of danger with C', done: () => P.dodgeT > 0 },
  { t: 'Raise your shield: hold Alt', done: () => P.block },
  { t: 'Talk to Old Mira by the fire: walk up to her and press E', done: () => Q.some(q => q.st > 0) }
];
const st = { moved: 0, ran: 0, lx: null, lz: null };
export function updateIntro(dt, t) {
  if (DUMMY.shake > 0) { DUMMY.shake -= dt; DUMMY.g.rotation.z = Math.sin(t * 40) * DUMMY.shake * .4; } else DUMMY.g.rotation.z = 0;
  const el = $('tut');
  if (S.tut == null || S.tut >= STEPS.length || createCb) { el.hidden = true; return; }
  if (st.lx != null) { const m = Math.hypot(P.x - st.lx, P.z - st.lz); st.moved += m; if (keys.shift && m > 0) st.ran += dt; }
  st.lx = P.x; st.lz = P.z;
  const s = STEPS[S.tut];
  if (s.done(st)) { S.tut++; toast(S.tut >= STEPS.length ? 'Tutorial complete — the world is yours' : 'Done!'); return; }
  el.hidden = false; el.textContent = `[${S.tut + 1}/${STEPS.length}]  ${s.t}`;
}
