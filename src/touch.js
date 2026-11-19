// Touch controls for tablets (shown only on touch screens; desktop input is unchanged).
// Left half: floating joystick (walk, run at the rim). Right half: swipe turns the camera, pinch zooms.
// Aiming works like the mouse: the aim point is fixed just above the screen centre, so attacks go where the
// camera looks. Buttons send the same key events as the keyboard (rebinds included), so no game logic is duplicated.
import { $, clamp, keys, MOUSE } from './core.js';
import { keyOf } from './keys.js';
import { doJump } from './actors.js';
import { S, invOpen } from './game.js';
import { mapOpen } from './map.js';
import { craftOpen } from './craft.js';

export const TOUCH = { on: false };
let cam = null;
const AIM_Y = .4;   // aim point height on screen (fraction); above centre = ahead of the player

const press = def => dispatchEvent(new KeyboardEvent('keydown', { key: keyOf(def), bubbles: true }));
const release = def => dispatchEvent(new KeyboardEvent('keyup', { key: keyOf(def), bubbles: true }));
const cap = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ } };
const escape = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

// [label, class, on press, on release (hold buttons)]
const BTNS = [
  ['ATK', 'b-atk', () => { MOUSE.lmb = true; press('1'); }, () => { MOUSE.lmb = false; }],
  ['BLK', 'b-blk', () => { keys.alt = true; }, () => { keys.alt = false; }],
  ['JMP', 'b-jmp', () => doJump()],
  ['ROLL', 'b-roll', () => press('c')],
  ['2', 'b-s1', () => press('2')], ['3', 'b-s2', () => press('3')], ['5', 'b-s3', () => press('5')], ['6', 'b-s4', () => press('6')],
  ['POT', 'b-pot', () => press('4')],
  ['USE', 'b-use', () => press('e')], ['RIDE', 'b-ride', () => press('f')],
  ['INV', 'b-inv', () => press('i')], ['CRAFT', 'b-craft', () => press('k')], ['MAP', 'b-map', () => press('m')],
  ['CHAT', 'b-chat', () => dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))],
];

export function initTouch(c) {
  cam = c;
  TOUCH.on = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;
  if (!TOUCH.on) return;
  document.body.classList.add('touch');
  const root = document.createElement('div'); root.id = 'touch'; root.hidden = true;
  root.innerHTML = '<div id="tzl" class="tzone"></div><div id="tzr" class="tzone"></div><div id="tjoy"><div id="tknob"></div></div>' +
    BTNS.map(([l, c]) => `<button class="tbtn ${c}">${l}</button>`).join('');
  document.body.append(root);
  const menu = document.createElement('button'); menu.id = 'tmenu'; menu.textContent = '≡'; menu.hidden = true;   // pause, or close the open window
  document.body.append(menu);
  menu.addEventListener('pointerdown', e => { e.preventDefault(); escape(); });

  root.querySelectorAll('.tbtn').forEach((b, i) => {
    const [, , down, up] = BTNS[i];
    b.addEventListener('pointerdown', e => { e.preventDefault(); cap(b, e); b.classList.add('on'); down(); });
    const end = () => { if (!b.classList.contains('on')) return; b.classList.remove('on'); up?.(); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  });

  // joystick: appears where the finger lands in the left half
  const joy = $('tjoy'), knob = $('tknob'), R = () => Math.min(innerWidth, innerHeight) * .12;
  let jid = null, jx = 0, jy = 0;
  const setMove = (dx, dy) => {
    const r = R(), m = Math.min(Math.hypot(dx, dy) / r, 1), a = Math.atan2(dy, dx);
    const k = m > .25 ? 1 : 0, cx = Math.cos(a) * k, cy = Math.sin(a) * k;
    keys.d = cx > .38; keys.a = cx < -.38; keys.s = cy > .38; keys.w = cy < -.38; keys.shift = m > .95;
    const s = Math.min(Math.hypot(dx, dy), r) / (Math.hypot(dx, dy) || 1);
    knob.style.transform = `translate(${dx * s}px,${dy * s}px)`;
  };
  const zl = $('tzl');
  zl.addEventListener('pointerdown', e => {
    e.preventDefault(); if (jid !== null) return; jid = e.pointerId; cap(zl, e);
    jx = e.clientX; jy = e.clientY; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; joy.classList.add('on'); setMove(0, 0);
  });
  zl.addEventListener('pointermove', e => { if (e.pointerId === jid) setMove(e.clientX - jx, e.clientY - jy); });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; joy.classList.remove('on'); keys.w = keys.a = keys.s = keys.d = keys.shift = false; knob.style.transform = ''; };
  zl.addEventListener('pointerup', jend); zl.addEventListener('pointercancel', jend);

  // camera: one finger swipes (same impulse model as the mouse drag), two fingers pinch to zoom
  const zr = $('tzr'), pts = new Map(); let pinch = 0;
  zr.addEventListener('pointerdown', e => { e.preventDefault(); cap(zr, e); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = 0; });
  zr.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.dist = clamp(cam.dist * pinch / d, 5, 60); pinch = d; return;
    }
    const sn = (S.sens || 1) * 1.6;
    cam.vyaw = (cam.vyaw || 0) - dx * .035 * sn; cam.vpitch = (cam.vpitch || 0) + dy * .028 * sn;
  });
  const pend = e => { pts.delete(e.pointerId); pinch = 0; };
  zr.addEventListener('pointerup', pend); zr.addEventListener('pointercancel', pend);
  addEventListener('blur', () => { jid = null; pts.clear(); joy.classList.remove('on'); });
}

// every frame: show the layer only in play with no window open, and keep the aim point fixed
export function touchFrame(started, paused) {
  if (!TOUCH.on) return;
  const win = invOpen() || mapOpen() || craftOpen() || $('dialog').hidden === false || document.activeElement?.id === 'chatin';
  const hide = !started || paused || win, t = $('touch');
  if (hide && !t.hidden) {   // a hidden button never gets its pointerup: let go of everything it held
    keys.w = keys.a = keys.s = keys.d = keys.shift = keys.alt = false; MOUSE.lmb = false;
    t.querySelectorAll('.on').forEach(b => b.classList.remove('on')); $('tknob').style.transform = '';
  }
  t.hidden = hide; $('tmenu').hidden = !started || paused;
  MOUSE.x = innerWidth / 2; MOUSE.y = innerHeight * AIM_Y;
  const c = $('cross'); c.style.left = MOUSE.x + 'px'; c.style.top = MOUSE.y + 'px';
}
