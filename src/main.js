// Giriş noktası: girdi, kamera, ana döngü
import { $, clamp, lerp, keys, MOUSE, heightAt, swampF } from './core.js';
import { camera, canvas, scene, resize, renderFrame, updateDay, updateRain, ENV, VIEW } from './render.js';
import { updateWorld, updateGrass, GU, flames, waterMat, regionAt } from './world.js';
import { P, enemies, updatePlayer, updateEnemies, updateEffects, updateNPCs, actorLabels, doSlash, doFireball, doWhirl, doDodge, doJump, nearestNPC } from './actors.js';
import { FXS, burst, updateFX } from './fx.js';
import { NET, connectNet, updateNet, chatToggle, chatCancel } from './net.js';
import { S, load, save, hasSave, resetSave, applyState, interact, closeDialog, toggleInv, invOpen, invPress, usePotion, updateHUD, toast, beginLabels, endLabels, toggleMini, toggleHelp, buildHotbar, showRegion } from './game.js';

const DAYLEN = 480, PMIN = .05;   // PMIN: kamera ufka kadar indirilebilir (uzağı görmek için)
const cam = { yaw: 0, pitch: .98, dist: 17, tx: 0, ty: 0, tz: 0 };
const _swc = ENV.sky.clone().setRGB(.075, .09, .08);
let started = false, last = performance.now(), T = 0, saveT = 0, regT = 0;

/* ---------------- girdi ---------------- */
addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT') {   // yazı alanındayken oyun tuşları çalışmaz
    if (ae.id === 'chatin') { if (e.key === 'Enter') { e.preventDefault(); chatToggle(); } else if (e.key === 'Escape') chatCancel(); }
    else if (ae.id === 'pname' && e.key === 'Enter') $('go').click();
    return;
  }
  if (started && e.key === 'Enter') { e.preventDefault(); for (const k in keys) keys[k] = false; chatToggle(); return; }
  const k = e.key.toLowerCase();
  if ('wasd'.includes(k) && k.length === 1) keys[k] = true;
  if (e.key === 'Shift') keys.shift = true;
  if (e.code === 'Space') { e.preventDefault(); if (started && !e.repeat) doJump(); }
  if (!started || e.repeat) return;
  if (invOpen() && k >= '1' && k <= '9') { invPress(+k); return; }
  if (k === '1') doSlash(); else if (k === '2') doFireball(); else if (k === '3') doWhirl();
  else if (k === '4' || k === 'q') usePotion();
  else if (k === 'e') { const n = nearestNPC(); if (n) interact(n); else closeDialog(); }
  else if (k === 'c') doDodge();
  else if (k === 'i') toggleInv(); else if (k === 'm') toggleMini(); else if (k === 'h') toggleHelp();
  else if (k === 'r') { ENV.raining = !ENV.raining; toast(ENV.raining ? 'Yağmur başladı' : 'Yağmur dindi'); }
  else if (e.key === 'Escape') { closeDialog(); if (invOpen()) toggleInv(); }
  else if (e.key === '[' || e.key === ']') { VIEW.cellW = clamp(VIEW.cellW + (e.key === ']' ? 1 : -1), 4, 14); VIEW.cellH = Math.round(VIEW.cellW * 1.8); resize(); }
  else if (e.key === 'ArrowLeft') cam.yaw += .2; else if (e.key === 'ArrowRight') cam.yaw -= .2;
  else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + .06, PMIN, 1.35); else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - .06, PMIN, 1.35);
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = false; if (e.key === 'Shift') keys.shift = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; MOUSE.lmb = MOUSE.rmb = false; });
addEventListener('mousemove', e => {
  MOUSE.x = e.clientX; MOUSE.y = e.clientY;
  const c = $('cross'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
  if (MOUSE.rmb && started) { cam.yaw -= e.movementX * .005; cam.pitch = clamp(cam.pitch + e.movementY * .004, PMIN, 1.35); }
});
canvas.addEventListener('mousedown', e => { if (!started) return; if (e.button === 0) { MOUSE.lmb = true; doSlash(); } if (e.button === 2) MOUSE.rmb = true; });
addEventListener('mouseup', e => { if (e.button === 0) MOUSE.lmb = false; if (e.button === 2) MOUSE.rmb = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * .02, 8, 42); }, { passive: true });
addEventListener('resize', resize);
addEventListener('beforeunload', () => { if (started) save(); });

/* ---------------- başlat ---------------- */
function begin(fresh) {
  const nm = ($('pname').value || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Senje';
  try { localStorage.setItem('asciiTerraName', nm); } catch (e) { }
  NET.name = nm;
  if (fresh) resetSave(); else load();
  applyState(); buildHotbar();
  cam.tx = P.x; cam.ty = P.y; cam.tz = P.z; cam.yaw = 0;
  updateGrass(P.x, P.z, 999);
  started = true; $('overlay').hidden = true; $('hud').hidden = false;
  connectNet(nm);
  setTimeout(() => { if (!$('help').hidden) toggleHelp(); }, 15000);
}
$('go').onclick = () => begin(false);
$('new').onclick = () => begin(true);
if (hasSave()) { $('new').hidden = false; $('go').textContent = 'Devam et'; }
try { $('pname').value = localStorage.getItem('asciiTerraName') || 'Senje'; } catch (e) { $('pname').value = 'Senje'; }

/* ---------------- kamera (takip + sarsıntı) ---------------- */
function updateCamera(dt, run) {
  const k = 1 - Math.exp(-8 * dt);
  if (run) { cam.tx = lerp(cam.tx, P.x, k); cam.ty = lerp(cam.ty, P.y, k); cam.tz = lerp(cam.tz, P.z, k); }
  else { cam.yaw += dt * .05; cam.tx = 0; cam.tz = 8; cam.ty = heightAt(0, 8); }
  const cp = Math.cos(cam.pitch), sh = FXS.shake * FXS.shake;
  let cx = cam.tx + Math.sin(cam.yaw) * cp * cam.dist, cy = cam.ty + 1 + Math.sin(cam.pitch) * cam.dist, cz = cam.tz + Math.cos(cam.yaw) * cp * cam.dist;
  cy = Math.max(cy, heightAt(cx, cz) + 2);
  cx += (Math.random() - .5) * sh * 1.2; cy += (Math.random() - .5) * sh * 1.2; cz += (Math.random() - .5) * sh * 1.2;
  const lowK = clamp(1 - cam.pitch / .6, 0, 1);   // ufka yakınken bakışı yukarı kaldır
  camera.position.set(cx, cy, cz); camera.lookAt(cam.tx - Math.sin(cam.yaw) * lowK * 20, cam.ty + 1 + lowK * 2.5, cam.tz - Math.cos(cam.yaw) * lowK * 20);
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
// Kare döngüsü + yedek zamanlayıcı: sekme arka planda kalınca requestAnimationFrame durur;
// o zaman simülasyon ve ağ trafiği zamanlayıcıyla (çizim yapmadan) sürer.
let lastFrameAt = performance.now();
function loop(now) { requestAnimationFrame(loop); frame(now, true); }
setInterval(() => { const n = performance.now(); if (n - lastFrameAt > 250) frame(n, false); }, 100);
function frame(now, draw) {
  lastFrameAt = now;
  const rdt = Math.min(.05, (now - last) / 1000); last = now; T += rdt;
  let dt = rdt; if (FXS.stop > 0) { FXS.stop -= rdt; dt = rdt * .05; }   // vuruşta kısa durma
  const run = started;
  beginLabels();
  if (run) {
    if (MOUSE.lmb) doSlash();
    updatePlayer(dt); updateEnemies(dt); updateEffects(dt); updateNet(rdt);
    saveT += rdt; if (saveT > 8) { saveT = 0; save(); }
  }
  updateNPCs(rdt); updateFX(dt);
  updateDay(run ? rdt : 0, DAYLEN);
  { // bölge atmosferi: bataklıkta yoğun, yeşilimsi sis
    const sw = swampF(cam.tx, cam.tz), farK = 1 + (1 - clamp(cam.pitch / .6, 0, 1)) * 1.6;
    scene.fog.near = lerp(30, 12, sw); scene.fog.far = lerp(170, 90, sw) * farK;
    if (sw > 0) { ENV.sky.lerp(_swc, sw * .55); scene.background.copy(ENV.sky); scene.fog.color.copy(ENV.sky); }
    waterMat.uniforms.uFogNear.value = scene.fog.near; waterMat.uniforms.uFogFar.value = scene.fog.far;
    if (sw > .2 && Math.random() < rdt * 14 * sw) burst('mist', cam.tx + (Math.random() - .5) * 40, cam.ty + .3 + Math.random() * 1.5, cam.tz + (Math.random() - .5) * 30, 1);
  }
  updateCamera(rdt, run);
  updateRain(rdt, cam.tx, cam.ty, cam.tz);
  updateWorld(T); embers(rdt, cam.tx, cam.tz);
  updateGrass(run ? P.x : 0, run ? P.z : 8, 2);
  GU.uPlayer.value.set(P.x, P.y, P.z); GU.uAspect.value = camera.aspect;
  if (run) { actorLabels(); updateHUD(rdt); regT -= rdt; if (regT <= 0) { regT = .5; showRegion(regionAt(P.x, P.z)); } }
  endLabels();
  if (draw) renderFrame(T, clamp(P.hurtT * 2, 0, .6));
}
requestAnimationFrame(loop);
window.__game = { P, enemies, get S() { return S; }, ENV, cam, begin, NET };
