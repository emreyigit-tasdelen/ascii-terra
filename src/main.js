// Entry point: input, camera, main loop
import { $, clamp, lerp, smooth, keys, MOUSE, heightAt, swampF } from './core.js';
import { camera, canvas, scene, resize, renderFrame, updateDay, updateRain, setZoom, gridFollow, ENV, VIEW } from './render.js';
import { updateWorld, updateGrass, GU, flames, waterMat, regionAt } from './world.js';
import { toggleCraft, initCraft, craftOpen } from './craft.js';
import { openCreate, initCreate, updateIntro } from './intro.js';
import { P, enemies, updatePlayer, updateEnemies, updateEffects, updateNPCs, actorLabels, doSlash, doFireball, doWhirl, doOrb, doBeam, doDodge, HORSE, doJump, nearestNPC, toggleMount, setLook } from './actors.js';
import { FXS, burst, updateFX } from './fx.js';
import { NET, initNet, joinWorld, authRequest, logout, updateNet, chatToggle, chatCancel } from './net.js';
import { S, load, save, hasSave, resetSave, applyState, interact, closeDialog, toggleInv, invOpen, invPress, usePotion, updateHUD, toast, beginLabels, endLabels, toggleMini, toggleHelp, buildHotbar, showRegion, updateLoot, collectLoot } from './game.js';
import { initAudio, updateAudio, toggleSound, sfx } from './audio.js';
import { initMap, toggleMap, updateMap, mapOpen } from './map.js';

const DAYLEN = 480, PMIN = .05;   // PMIN: camera can drop to the horizon (to see far away)
const cam = { yaw: 0, pitch: .98, dist: 17, tx: 0, ty: 0, tz: 0 };
const _swc = ENV.sky.clone().setRGB(.075, .09, .08);
let started = false, last = performance.now(), T = 0, saveT = 0, regT = 0;

/* ---------------- input ---------------- */
addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT') {   // game keys are ignored while typing
    if (ae.id === 'chatin') { if (e.key === 'Enter') { e.preventDefault(); chatToggle(); } else if (e.key === 'Escape') chatCancel(); }
    return;
  }
  if (started && (e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !e.repeat) {   // Esc: close an open window first, otherwise pause
    if (e.key === 'Escape' && !paused && mapOpen()) { toggleMap(false); return; }
    if (e.key === 'Escape' && !paused && craftOpen()) { toggleCraft(false); return; }
    if (e.key === 'Escape' && !paused && ($('dialog').hidden === false || invOpen())) { closeDialog(); if (invOpen()) toggleInv(); return; }
    setPaused(!paused); return;
  }
  if (paused) return;
  if (started && e.key === 'Enter') { e.preventDefault(); for (const k in keys) keys[k] = false; chatToggle(); return; }
  const k = e.key.toLowerCase();
  if ('wasd'.includes(k) && k.length === 1) keys[k] = true;
  if (e.key === 'Shift') keys.shift = true;
  if (e.key === 'Alt') { e.preventDefault(); keys.alt = true; }
  if (e.code === 'Space') { e.preventDefault(); if (started && !e.repeat) doJump(); }
  if (!started || e.repeat) return;
  if (invOpen() && k >= '1' && k <= '9') { invPress(+k); return; }
  if (k === '1') doSlash(); else if (k === '2') doFireball(); else if (k === '3') doWhirl();
  else if (k === '4' || k === 'q') usePotion(); else if (k === '5') doOrb(); else if (k === '6') doBeam();
  else if (k === 'e') { const n = nearestNPC(); if (n) interact(n); else closeDialog(); }
  else if (k === 'c') doDodge();
  else if (k === 'f') toggleMount();
  else if (k === 'k') toggleCraft();
  else if (k === 'i') toggleInv(); else if (k === 'm') { toggleMap(); sfx('ui'); } else if (k === 'n') toggleMini(); else if (k === 'h') toggleHelp();
  else if (k === 'o') toast(toggleSound() ? 'Sound on' : 'Sound off');
  else if (k === 't') { ENV.dayT = (ENV.dayT + .125) % 1; toast('Time ' + String(Math.floor(ENV.dayT * 24)).padStart(2, '0') + ':00'); }
  else if (k === 'r') { ENV.raining = !ENV.raining; toast(ENV.raining ? 'Rain started' : 'Rain stopped'); }
  else if (e.key === '[' || e.key === ']') { VIEW.cellW = clamp(VIEW.cellW + (e.key === ']' ? 1 : -1), 4, 14); VIEW.cellH = Math.round(VIEW.cellW * 1.8); resize(); }
  else if (e.key === 'ArrowLeft') cam.yaw += .2; else if (e.key === 'ArrowRight') cam.yaw -= .2;
  else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch + .06, PMIN, 1.35); else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch - .06, PMIN, 1.35);
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) keys[k] = false; if (e.key === 'Shift') keys.shift = false; if (e.key === 'Alt') { e.preventDefault(); keys.alt = false; } });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; MOUSE.lmb = MOUSE.rmb = MOUSE.mmb = false; });
addEventListener('mousemove', e => {
  MOUSE.x = e.clientX; MOUSE.y = e.clientY;
  const c = $('cross'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px';
  if ((MOUSE.mmb || MOUSE.rmb) && started) { cam.yaw -= e.movementX * .005; cam.pitch = clamp(cam.pitch + e.movementY * .004, PMIN, 1.35); }
});
/* ---------------- pause menu ---------------- */
let paused = false;
function setPaused(on) {
  paused = on; $('pause').hidden = !on; for (const k in keys) keys[k] = false; MOUSE.lmb = MOUSE.rmb = MOUSE.mmb = false;
  $('pnote').textContent = NET.online ? 'You are online: the world keeps running for other players, but nobody can hit you.' : 'Game paused.';
  if (on) save();
}
$('presume').onclick = () => setPaused(false);
$('phelp').onclick = () => toggleHelp();
$('pmenu').onclick = () => { collectLoot(); save(); setTimeout(() => location.reload(), 300); };
addEventListener('blur', () => { if (started && !paused && !NET.online) setPaused(true); });   // auto-pause in single player when the tab loses focus
canvas.addEventListener('mousedown', e => { if (!started || paused) return; if (e.button === 0) { MOUSE.lmb = true; doSlash(); } if (e.button === 2) MOUSE.rmb = true; if (e.button === 1) { e.preventDefault(); MOUSE.mmb = true; } });
addEventListener('mouseup', e => { if (e.button === 0) MOUSE.lmb = false; if (e.button === 2) MOUSE.rmb = false; if (e.button === 1) MOUSE.mmb = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (mapOpen()) return; cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0012), 5, 60); }, { passive: true });
addEventListener('resize', resize);
addEventListener('beforeunload', () => { if (started) { collectLoot(); save(); } });

/* ---------------- start ---------------- */
function begin(fresh) {
  const nm = NET.account || ($('pname').value || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Torvan';
  if (!NET.account) try { localStorage.setItem('asciiTerraName', nm); } catch (e) { }
  NET.name = nm;
  const had = !fresh && load(); if (!had) resetSave();
  applyState(); buildHotbar(); initCraft(); initCreate(); initMap(); initAudio(); setLook(S.look || {});
  if (!had) { S.tut = 0; openCreate(() => { }); }
  cam.tx = P.x; cam.ty = P.y; cam.tz = P.z; cam.yaw = 0;
  updateGrass(P.x, P.z, 999);
  started = true; $('overlay').hidden = true; $('hud').hidden = false;
  joinWorld(nm);
  setTimeout(() => { if (!$('help').hidden) toggleHelp(); }, 15000);
}
/* ---------------- start screen: account / guest ---------------- */
let mode = 'login', newArmed = false;
const amsg = (t, err) => { $('amsg').textContent = t || ''; $('amsg').className = err ? 'err' : ''; };
function setMode(m) {
  mode = m; document.querySelectorAll('#acct .tabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  const guest = m === 'guest';
  const fresh = m === 'reg' || m === 'reset';
  $('ppass').hidden = guest; $('ppass2').hidden = !fresh; $('pcode').hidden = m !== 'reset'; $('remrow').hidden = guest; $('auth').hidden = guest;
  $('auth').textContent = m === 'reg' ? 'Sign up' : m === 'reset' ? 'Reset password' : 'Log in';
  $('ppass').placeholder = m === 'reset' ? 'New password' : 'Password';
  $('ppass').autocomplete = fresh ? 'new-password' : 'current-password'; $('forgot').hidden = m !== 'login';
  refreshButtons();
  if (guest) amsg(NET.available ? 'Guest: your progress is saved only in this browser.' : 'Server unreachable: you can play offline as a guest.');
  else amsg(m === 'reg' ? 'With an account your progress is saved on the server; continue from any device.' : m === 'reset' ? 'Enter your name, the recovery code you got at sign-up, and a new password.' : '');
}
function refreshButtons() {
  const authed = !!NET.account, guest = mode === 'guest';
  $('acct').hidden = authed; $('who').hidden = !authed; $('whoname').textContent = NET.account || '';
  const canPlay = authed || guest;
  $('go').hidden = !canPlay; const has = canPlay && hasSave();
  $('go').textContent = has ? 'Continue' : 'Start'; $('new').hidden = !has; $('new').textContent = 'New game'; newArmed = false;
}
document.querySelectorAll('#acct .tabs button').forEach(b => b.onclick = e => { e.preventDefault(); if (!NET.available && b.dataset.m !== 'guest') return; setMode(b.dataset.m); });
$('aform').onsubmit = e => {
  e.preventDefault();
  if (mode === 'guest') return $('go').click();
  const n = $('pname').value.trim(), p = $('ppass').value;
  if (!NET.available) return amsg('Server unreachable.', true);
  if (n.length < 3) return amsg('Name must be at least 3 characters.', true);
  if (p.length < 6) return amsg('Password must be at least 6 characters.', true);
  if ((mode === 'reg' || mode === 'reset') && p !== $('ppass2').value) return amsg('Passwords do not match.', true);
  if (mode === 'reset' && $('pcode').value.replace(/[^A-Za-z0-9]/g, '').length !== 12) return amsg('Recovery code must be 12 characters.', true);
  amsg(mode === 'reg' ? 'Creating account…' : mode === 'reset' ? 'Resetting password…' : 'Logging in…'); $('auth').disabled = true;
  authRequest(mode, n, p, $('prem').checked, mode === 'reset' ? $('pcode').value : undefined);
};
NET.onAuth = m => {
  $('auth').disabled = false; $('ppass').value = ''; $('ppass2').value = '';
  if (m.ok) { amsg(''); toastLater = 'Welcome, ' + m.name; $('pcode').value = ''; if (mode === 'reset') setMode('login'); }
  if (m.ok && m.recovery) { $('reccode').textContent = m.recovery; $('recbox').hidden = false; $('go').disabled = true; }
  else if (!m.silent) amsg(m.err || 'Login failed', true);
  refreshButtons();
};
NET.onReady = () => {
  if (!NET.available) { setMode('guest'); document.querySelectorAll('#acct .tabs button').forEach(b => { if (b.dataset.m !== 'guest') b.disabled = true; }); }
  else if (!NET.account) amsg('');
};
$('forgot').onclick = e => { e.preventDefault(); if (NET.available) setMode('reset'); };
$('recok').onclick = () => { $('recbox').hidden = true; $('reccode').textContent = ''; $('go').disabled = false; };
$('logout').onclick = e => { e.preventDefault(); logout(); setMode('login'); amsg('Logged out.'); };
$('go').onclick = () => begin(false);
$('new').onclick = () => { if (!newArmed) { newArmed = true; $('new').textContent = 'Sure? Progress will be erased'; return; } begin(true); };
let toastLater = '';
try { $('pname').value = localStorage.getItem('asciiTerraName') || ''; } catch (e) { }
setMode('login'); amsg('Connecting to server…');
initNet();

/* ---------------- camera (follow + shake) ---------------- */
function updateCamera(dt, run) {
  const k = 1 - Math.exp(-8 * dt), ox = cam.tx, oy = cam.ty, oz = cam.tz;
  if (run) { cam.tx = lerp(cam.tx, P.x, k); cam.ty = lerp(cam.ty, P.y, k); cam.tz = lerp(cam.tz, P.z, k); }
  else { cam.yaw += dt * .05; cam.tx = 0; cam.tz = 8; cam.ty = heightAt(0, 8); }
  cam.hk = lerp(cam.hk || 0, run ? smooth(1.5, 6, P.high || 0) : 0, 1 - Math.exp(-2.5 * dt));   // high ground: zoom in
  const D = cam.dist * (1 - .5 * cam.hk), cp = Math.cos(cam.pitch), sh = FXS.shake * FXS.shake;
  let cx = cam.tx + Math.sin(cam.yaw) * cp * D, cy = cam.ty + 1 + Math.sin(cam.pitch) * D, cz = cam.tz + Math.cos(cam.yaw) * cp * D;
  cy = Math.max(cy, heightAt(cx, cz) + 2);
  cx += (Math.random() - .5) * sh * 1.2; cy += (Math.random() - .5) * sh * 1.2; cz += (Math.random() - .5) * sh * 1.2;
  const lowK = clamp(1 - cam.pitch / .6, 0, 1);   // look up when near the horizon
  camera.position.set(cx, cy, cz); camera.lookAt(cam.tx - Math.sin(cam.yaw) * lowK * 20, cam.ty + 1 + lowK * 2.5, cam.tz - Math.cos(cam.yaw) * lowK * 20);
  setZoom(17 / D); gridFollow(ox, oy, oz, cam.tx, cam.ty, cam.tz);   // letters scale with zoom and stay on the ground
  FXS.shake = Math.max(0, FXS.shake - dt * 2.5);
  P.camYaw = cam.yaw; ENV.focus.set(cam.tx, cam.ty, cam.tz);
}

/* ---------------- embers from torches and fires ---------------- */
function embers(dt, px, pz) {
  for (const f of flames) { const p = f.m.position; if (Math.abs(p.x - px) < 40 && Math.abs(p.z - pz) < 40 && Math.random() < dt * 5 * f.s) burst('ember', p.x, p.y + .3, p.z, 1); }
}

// 0..1: how close the player is to open water (drives the surf sound)
function coastK() { let k = smooth(-2, -5.5, heightAt(P.x, P.z)); for (let a = 0; a < 6.28; a += 1.57) k = Math.max(k, smooth(-2, -5.5, heightAt(P.x + Math.cos(a) * 12, P.z + Math.sin(a) * 12))); return k; }

/* ---------------- main loop ---------------- */
resize();
P.y = heightAt(P.x, P.z); updateGrass(0, 8, 999);
// Frame loop + fallback timer: requestAnimationFrame stops in a background tab;
// then simulation and network traffic continue on a timer (without drawing).
let lastFrameAt = performance.now();
function loop(now) { requestAnimationFrame(loop); frame(now, true); }
setInterval(() => { const n = performance.now(); if (n - lastFrameAt > 250) frame(n, false); }, 100);
function frame(now, draw) {
  lastFrameAt = now;
  const rdt = Math.min(.05, (now - last) / 1000); last = now; T += rdt;
  let dt = rdt; if (FXS.stop > 0) { FXS.stop -= rdt; dt = rdt * .05; }   // short hit-stop
  const run = started && !(paused && !NET.online);   // single player freezes the world; online it keeps running
  if (paused) P.invuln = true; else P.invuln = false;
  beginLabels();
  if (run) {
    if (MOUSE.lmb) doSlash();
    updatePlayer(dt); updateEnemies(dt); updateEffects(dt); updateNet(rdt); updateIntro(dt, T);
    saveT += rdt; if (saveT > 8) { saveT = 0; save(); }
  }
  updateNPCs(rdt); updateFX(dt);
  updateDay(run ? rdt : 0, DAYLEN);
  { // region atmosphere: thick greenish fog in the swamp
    const sw = swampF(cam.tx, cam.tz), farK = 1 + (1 - clamp(cam.pitch / .6, 0, 1)) * 1.6;
    scene.fog.near = lerp(30, 12, sw); scene.fog.far = lerp(170, 90, sw) * farK;
    if (sw > 0) { ENV.sky.lerp(_swc, sw * .55); scene.background.copy(ENV.sky); scene.fog.color.copy(ENV.sky); }
    waterMat.uniforms.uFogNear.value = scene.fog.near; waterMat.uniforms.uFogFar.value = scene.fog.far;
    if (sw > .2 && Math.random() < rdt * 14 * sw) burst('mist', cam.tx + (Math.random() - .5) * 40, cam.ty + .3 + Math.random() * 1.5, cam.tz + (Math.random() - .5) * 30, 1);
  }
  updateCamera(rdt, run);
  updateRain(rdt, cam.tx, cam.ty, cam.tz);
  updateWorld(T); embers(rdt, cam.tx, cam.tz);
  { // sound: footsteps from the player's speed, ambience from weather, coast and nearby fires
    let fire = 0; for (const f of flames) { const p = f.m.position; fire = Math.max(fire, 1 - Math.hypot(p.x - P.x, p.z - P.z) / 14); }
    updateAudio(rdt, { speed: run && !P.dead ? Math.hypot(P.vx, P.vz) : 0, grounded: !P.air && !(P.dodgeT > 0), mounted: HORSE.on, rain: ENV.raining ? 1 : 0, coast: run ? coastK() : 0, fire: run ? Math.max(0, fire) : 0 });
  }
  updateGrass(run ? P.x : 0, run ? P.z : 8, 2);
  GU.uPlayer.value.set(P.x, P.y, P.z); GU.uAspect.value = camera.aspect;
  if (run) { actorLabels(); updateLoot(rdt); updateMap(rdt); updateHUD(rdt); regT -= rdt; if (regT <= 0) { regT = .5; showRegion(regionAt(P.x, P.z)); } }
  endLabels();
  if (draw) renderFrame(T, clamp(P.hurtT * 2, 0, .6));
}
requestAnimationFrame(loop);
window.__game = { P, enemies, get S() { return S; }, ENV, cam, begin, NET };
