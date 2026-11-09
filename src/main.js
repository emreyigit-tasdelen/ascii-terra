// Giriş noktası: girdi, kamera, ana döngü
import { $, clamp, lerp, keys, MOUSE, heightAt } from './core.js';
import { camera, canvas, resize, renderFrame, updateDay, updateRain, ENV, VIEW } from './render.js';
import { updateWorld, updateGrass, GU, flames } from './world.js';
import { P, enemies, updatePlayer, updateEnemies, updateEffects, updateNPCs, actorLabels, doSlash, doFireball, doWhirl, doDodge, nearestNPC } from './actors.js';
import { FXS, burst, updateFX } from './fx.js';
import { S, load, save, hasSave, resetSave, applyState, interact, closeDialog, toggleInv, invOpen, invPress, usePotion, updateHUD, toast, beginLabels, endLabels, toggleMini, toggleHelp, buildHotbar } from './game.js';

const DAYLEN = 480;
const cam = { yaw: 0, pitch: .98, dist: 17, tx: 0, ty: 0, tz: 0 };
let started = false, last = performance.now(), T = 0, saveT = 0;

/* ---------------- girdi ---------------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ('wasd'.includes(k) && k.length === 1) keys[k] = true;
  if (e.key === 'Shift') keys.shift = true;
  if (e.code === 'Space') { e.preventDefault(); if (started) doDodge(); }
  if (!started || e.repeat) return;
  if (invOpen() && k >= '1' && k <= '9') { invPress(+k); return; }
  if (k === '1') doSlash(); else if (k === '2') doFireball(); else if (k === '3') doWhirl();
  else if (k === '4' || k === 'q') usePotion();
  else if (k === 'e') { const n = nearestNPC(); if (n) interact(n); else closeDialog(); }
  else if (k === 'i') toggleInv(); else if (k === 'm') toggleMini(); else if (k === 'h') toggleHelp();
  else if (k === 'r') { ENV.raining = !ENV.raining; toast(ENV.raining ? 'Yağmur başladı' : 'Yağmur dindi'); }
  else if (e.key === 'Escape') { closeDialog(); if (invOpen()) toggleInv(); }
  else if (e.key === '[' || e.key === ']') { VIEW.cellW = clamp(VIEW.cellW + (e.key === ']' ? 1 : -1), 4, 14); VIEW.cellH = Math.round(VIEW.cellW * 1.8); resize(); }
  else if (e.key === 'ArrowLeft') cam.yaw += .2; else if (e.key === 'ArrowRight') cam.yaw -= .2;
  else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + .06, .5, 1.35); else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - .06, .5, 1.35);
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = false; if (e.key === 'Shift') keys.shift = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; MOUSE.lmb = MOUSE.rmb = false; });
addEventListener('mousemove', e => {
  MOUSE.x = e.clientX; MOUSE.y = e.clientY;
  const c = $('cross'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
  if (MOUSE.rmb && started) { cam.yaw -= e.movementX * .005; cam.pitch = clamp(cam.pitch + e.movementY * .004, .5, 1.35); }
});
canvas.addEventListener('mousedown', e => { if (!started) return; if (e.button === 0) { MOUSE.lmb = true; doSlash(); } if (e.button === 2) MOUSE.rmb = true; });
addEventListener('mouseup', e => { if (e.button === 0) MOUSE.lmb = false; if (e.button === 2) MOUSE.rmb = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * .02, 8, 42); }, { passive: true });
addEventListener('resize', resize);
addEventListener('beforeunload', () => { if (started) save(); });

/* ---------------- başlat ---------------- */
function begin(fresh) {
  if (fresh) resetSave(); else load();
  applyState(); buildHotbar();
  cam.tx = P.x; cam.ty = P.y; cam.tz = P.z; cam.yaw = 0;
  updateGrass(P.x, P.z, 999);
  started = true; $('overlay').hidden = true; $('hud').hidden = false;
  setTimeout(() => { if (!$('help').hidden) toggleHelp(); }, 15000);
}
$('go').onclick = () => begin(false);
$('new').onclick = () => begin(true);
if (hasSave()) { $('new').hidden = false; $('go').textContent = 'Devam et'; }

/* ---------------- kamera (takip + sarsıntı) ---------------- */
function updateCamera(dt, run) {
  const k = 1 - Math.exp(-8 * dt);
  if (run) { cam.tx = lerp(cam.tx, P.x, k); cam.ty = lerp(cam.ty, P.y, k); cam.tz = lerp(cam.tz, P.z, k); }
  else { cam.yaw += dt * .05; cam.tx = 0; cam.tz = 8; cam.ty = heightAt(0, 8); }
  const cp = Math.cos(cam.pitch), sh = FXS.shake * FXS.shake;
  let cx = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, cy = cam.ty + 1 + Math.sin(cam.pitch) * cam.dist, cz = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
  cy = Math.max(cy, heightAt(cx, cz) + 2);
  cx += (Math.random() - .5) * sh * 1.2; cy += (Math.random() - .5) * sh * 1.2; cz += (Math.random() - .5) * sh * 1.2;
  camera.position.set(cx, cy, cz); camera.lookAt(cam.tx, cam.ty + 1, cam.tz);
  FXS.shake = Math.max(0, FXS.shake - dt * 2.5);
  P.camYaw = cam.yaw; ENV.focus.set(cam.tx, cam.ty, cam.tz);
}

/* ---------------- meşale ve ateşlerden kor ---------------- */
function embers(dt, px, pz) {
  for (const f of flames) { const p = f.m.position; if (Math.abs(p.x - px) < 40 && Math.abs(p.z - pz) < 40 && Math.random() < dt * 5 * f.s) burst('ember', p.x, p.y + .3, p.z, 1); }
}

/* ---------------- ana döngü ---------------- */
resize();
P.y = heightAt(P.x, P.z); updateGrass(0, 8, 999);
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(.05, (now - last) / 1000); last = now; T += rdt;
  let dt = rdt; if (FXS.stop > 0) { FXS.stop -= rdt; dt = rdt * .05; }   // vuruşta kısa durma
  const run = started;
  beginLabels();
  if (run) {
    if (MOUSE.lmb) doSlash();
    updatePlayer(dt); updateEnemies(dt); updateEffects(dt);
    saveT += rdt; if (saveT > 8) { saveT = 0; save(); }
  }
  updateNPCs(rdt); updateFX(dt);
  updateDay(run ? rdt : 0, DAYLEN);
  updateCamera(rdt, run);
  updateRain(rdt, cam.tx, cam.ty, cam.tz);
  updateWorld(T); embers(rdt, cam.tx, cam.tz);
  updateGrass(run ? P.x : 0, run ? P.z : 8, 2);
  GU.uPlayer.value.set(P.x, P.y, P.z); GU.uAspect.value = camera.aspect;
  if (run) { actorLabels(); updateHUD(rdt); }
  endLabels();
  renderFrame(T, clamp(P.hurtT * 2, 0, .6));
}
requestAnimationFrame(frame);
window.__game = { P, enemies, get S() { return S; }, ENV, cam, begin };
