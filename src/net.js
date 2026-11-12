// Multiplayer client: connection, remote players, chat, host-authoritative enemy sync.
// Without the server (e.g. served by python http.server) the game silently stays single player.
import { THREE, $, clamp, lerp, angDiff, heightAt } from './core.js';
import { scene } from './render.js';
import { makeKnight, makeHorse, animBiped, animWolf } from './models.js';
import { P, LOOKS, HORSE, enemies, hitEnemy, grantKill, hurtPlayer, telegraph, spawnEproj, spawnFxNet, spawnWeb, applySnapshot, snapshotRows } from './actors.js';
import { S, label, toast } from './game.js';
import { onDuelMsg, updateDuel } from './duel.js';
import { onPartyMsg, updateParty, partyCmd } from './party.js';

export const NET = { role: 'solo', myId: 0, hostId: 0, ws: null, online: false, available: false, tried: false, account: null, accountSave: null, onAuth: null, onReady: null, name: 'Torvan', remotes: new Map() };
const TABARDS = [0x1b2c5e, 0x1e5a2a, 0x5a1e5a, 0x6a4a10, 0x205060, 0x6a1a1a, 0x3a3a3a, 0x4a2a10];

export function sendNet(o) { if (NET.online && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
export const isClient = () => NET.role === 'client';
export const isHost = () => NET.role === 'host';

const TOK = 'asciiTerraTok';
const raw = o => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); };
/* Connects to the server on page load (for the start screen); joining the world happens in joinWorld */
export function initNet() {
  const fail = () => { NET.tried = true; NET.available = false; NET.onReady && NET.onReady(); };
  if (!('WebSocket' in window) || location.protocol === 'file:') return fail();
  let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return fail(); }
  NET.ws = ws;
  ws.onopen = () => {
    NET.tried = true; NET.available = true; NET.onReady && NET.onReady();
    let t = null; try { t = localStorage.getItem(TOK) || sessionStorage.getItem(TOK); } catch (e) { }
    if (t) raw({ t: 'tok', token: t });
  };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => {
    if (NET.online) toast('Lost connection to the server — continuing in single player');
    const wasAvail = NET.available; NET.online = false; NET.available = false; NET.role = 'solo';
    for (const r of NET.remotes.values()) removeRemote(r); NET.remotes.clear(); status();
    if (!NET.tried || wasAvail) { NET.tried = true; NET.onReady && NET.onReady(); }
  };
  ws.onerror = () => { };
}
export function authRequest(mode, name, pass, remember, code) { NET.remember = remember; raw({ t: mode, name, pass, code }); }
export function logout() {
  let t = null; try { t = localStorage.getItem(TOK) || sessionStorage.getItem(TOK); localStorage.removeItem(TOK); sessionStorage.removeItem(TOK); } catch (e) { }
  raw({ t: 'logout', token: t }); NET.account = null; NET.accountSave = null;
}
export function joinWorld(name) {
  NET.name = name;
  if (!NET.available) return;
  raw({ t: 'hello', name }); raw({ t: 'vis', h: document.hidden ? 1 : 0 });
}
export const connectNet = joinWorld;
function setRole() { NET.role = NET.hostId === NET.myId ? 'host' : 'client'; status(); }
function onMsg(m) {
  switch (m.t) {
    case 'auth':
      if (m.ok) {
        NET.account = m.name; NET.accountSave = m.save;
        try { (NET.remember === false ? sessionStorage : localStorage).setItem(TOK, m.token); } catch (e) { }
      } else if (!m.silent) NET.account = null;
      if (m.out || (m.silent && !m.ok)) { try { localStorage.removeItem(TOK); sessionStorage.removeItem(TOK); } catch (e) { } }
      NET.onAuth && NET.onAuth(m); break;
    case 'kick': toast(m.why || 'Disconnected'); break;
    case 'welcome': NET.myId = m.id; NET.hostId = m.host; NET.online = true; if (m.name) NET.name = m.name; setRole(); m.players.forEach(p => addRemote(p.id, p.name, p.st));
      toast('Connected — ' + (m.players.length ? m.players.length + ' other player(s) online' : 'you are alone for now') + (isHost() ? ' (you host the world)' : '')); break;
    case 'join': addRemote(m.id, m.name); toast(m.name + ' joined the world'); chatLine('', m.name + ' joined', 'sys'); status(); break;
    case 'leave': { const r = NET.remotes.get(m.id); if (r) { toast(r.name + ' left'); chatLine('', r.name + ' left', 'sys'); removeRemote(r); NET.remotes.delete(m.id); status(); } break; }
    case 'host': NET.hostId = m.id; const was = NET.role; setRole(); if (was !== 'host' && isHost()) toast('You now host the world simulation'); break;
    case 'st': { const r = NET.remotes.get(m.from); if (r) applyState(r, m); break; }
    case 'ch': chatLine(m.name, m.text, m.from === NET.myId ? 'me' : ''); break;
    case 'hit': { const e = enemies[m.e]; if (isHost() && e) hitEnemy(e, m.d, m.x, m.z, { remote: true, crit: m.c, by: m.from }); break; }
    case 'kill': { const e = enemies[m.e]; if (e) grantKill(e); break; }
    case 'dmg': hurtPlayer(m.d, m.x != null ? { x: m.x, z: m.z } : null); break;
    case 'en': if (isClient()) applySnapshot(m.d); break;
    case 'tele': telegraph(m.x, m.z, m.r, m.dl, m.d, !!m.f, false); break;
    case 'ep': spawnEproj(m.x, m.y, m.z, m.vx, m.vz, m.d, m.tid, false); break;
    case 'fx': spawnFxNet(m); break;
    case 'web': spawnWeb(m.x, m.z, m.r, false); break;
    case 'duel_inv': case 'duel_go': case 'duel_end': onDuelMsg(m); break;
    case 'party_inv': case 'party': case 'pxp': onPartyMsg(m); break;
    case 'sys': toast(m.text); chatLine('', m.text, 'sys'); break;
  }
}

/* ---------------- remote players ---------------- */
function addRemote(id, name, st) {
  if (NET.remotes.has(id)) return;
  const cloth = TABARDS[id % TABARDS.length], r = makeKnight({ cloth, capeColor: new THREE.Color(cloth).multiplyScalar(.45).getHex(), emblem: 0xd8cfb4 });
  scene.add(r.g);
  const R = { id, name, rig: r, x: 0, y: -50, z: 0, f: 0, tx: 0, ty: -50, tz: 0, tf: 0, a: [0, 0, -1, 0, -1, 0, 0], ph: 0, atk: -1, hp: 100, mh: 100, lv: 1, got: false };
  NET.remotes.set(id, R); if (st) applyState(R, st);
}
function removeRemote(R) { scene.remove(R.rig.g); if (R.horse) scene.remove(R.horse.g); }
// look as one number: tabard*100 + cape*10 + emblem (+1 so 0 means "not sent")
const lookCode = () => { const L = S.look || {}; return 1 + (L.tabard || 0) * 100 + (L.cape || 0) * 10 + (L.emblem || 0); };
function applyLook(R, code) {
  if (!code || code === R.lk) return; R.lk = code; const c = code - 1, t = Math.floor(c / 100) % LOOKS.tabard.length, cp = Math.floor(c / 10) % 10 % LOOKS.cape.length, em = c % 10 % LOOKS.emblem.length;
  const r = makeKnight({ cloth: LOOKS.tabard[t], capeColor: LOOKS.cape[cp], emblem: LOOKS.emblem[em] ?? undefined });
  scene.remove(R.rig.g); scene.add(r.g); R.rig = r;
}
function applyState(R, m) {
  R.tx = m.x; R.ty = m.y; R.tz = m.z; R.tf = m.f; R.hp = m.hp; R.mh = m.mh || 100; R.lv = m.lv || 1; R.mt = !!m.mt; applyLook(R, m.lk);
  const a = m.a || []; R.a = a;
  if (a[2] >= 0 && (R.atk < 0 || Math.abs(R.atk - a[2]) > .3)) { R.atk = a[2]; R.atkType = a[3]; }
  if (!R.got) { R.x = R.tx; R.y = R.ty; R.z = R.tz; R.f = R.tf; R.got = true; }
}
let T = 0, sendT = 0, snapT = 0;
export function updateNet(dt) {
  T += dt; updateDuel(dt); updateParty(dt);
  for (const R of NET.remotes.values()) {
    const k = 1 - Math.exp(-12 * dt);
    R.x = lerp(R.x, R.tx, k); R.y = lerp(R.y, R.ty, k); R.z = lerp(R.z, R.tz, k); R.f += angDiff(R.f, R.tf) * k;
    if (R.atk >= 0) { R.atk += dt / .36; if (R.atk > 1) R.atk = -1; }
    const amt = (R.a[0] || 0) / 100, run = (R.a[1] || 0) / 100;
    R.ph += dt * Math.max(1.5, amt * 5.8 * 1.75 + run * 6);
    animBiped(R.rig, { ph: R.ph, amt, run, atk: R.atk, atkType: R.atkType || 0, dodge: R.a[4] ?? -1, air: R.a[5] || 0, hit: R.a[6] || 0, block: R.a[7] || 0, t: T, dt, style: 'knight' });
    if (R.mt) {   // riding: horse under the knight, sitting pose
      if (!R.horse) { R.horse = makeHorse(); scene.add(R.horse.g); R.hph = 0; }
      const hs = R.px == null ? 0 : Math.hypot(R.x - R.px, R.z - R.pz) / Math.max(dt, .001); R.hph += dt * Math.max(1.2, hs * 1.05);
      animWolf(R.horse, { amt: Math.min(1, hs / 6), run: clamp((hs - 11) / 4, 0, 1), ph: R.hph, t: T, dt, atk: -1 });
      R.horse.g.visible = R.got; R.horse.g.position.set(R.x, R.y, R.z); R.horse.g.rotation.y = R.f;
      const r = R.rig; r.legL.p.rotation.x = r.legR.p.rotation.x = -1.35; r.legL.kn.rotation.x = r.legR.kn.rotation.x = 1.45; r.legL.p.rotation.z = .42; r.legR.p.rotation.z = -.42;
      R.rig.g.position.set(R.x, R.y + R.horse.body.position.y * 1.55 - .25, R.z);
    } else { if (R.horse) R.horse.g.visible = false; R.rig.g.position.set(R.x, R.y, R.z); }
    R.rig.g.rotation.y = R.f; R.rig.g.visible = R.got;
    R.px = R.x; R.pz = R.z;
    R.rig.g.rotation.x = R.hp <= 0 ? -1.45 : 0;
    if (R.got && Math.hypot(R.x - P.x, R.z - P.z) < 60) label(R.name + ' · lv ' + R.lv, R.x, R.y + 2.6, R.z, 'ally', R.mh ? R.hp / R.mh : 1);
  }
  if (!NET.online) return;
  sendT -= dt;
  if (sendT <= 0) {   // local player state ~15 Hz
    sendT = .066;
    sendNet({ t: 'st', x: P.x, y: P.y, z: P.z, f: P.face, a: [Math.round((P.animAmt || 0) * 100), Math.round((P.animRun || 0) * 100), P.atkT, P.atkType, P.dodgeT > 0 ? 1 - P.dodgeT / .42 : -1, P.air ? 1 : 0, Math.max(0, P.hitT) * 3, P.block ? 1 : 0], hp: P.dead ? 0 : P.hp, mh: P.maxhp, lv: S.lvl, lk: lookCode(), mt: HORSE.on ? 1 : 0 });
  }
  if (isHost()) { snapT -= dt; if (snapT <= 0) { snapT = .1; const d = snapshotRows(); if (d.length) sendNet({ t: 'en', d }); } }
}
/* Target candidates for enemy AI (host) */
export function remoteTargets() { const a = []; for (const R of NET.remotes.values()) if (R.got && R.hp > 0) a.push(R); return a; }

/* ---------------- chat + status ---------------- */
function chatLine(name, text, cls) {
  const log = $('chatlog'), d = document.createElement('div'); d.className = 'cl ' + (cls || '');
  if (name) { const b = document.createElement('b'); b.textContent = name + ': '; d.appendChild(b); }
  d.appendChild(document.createTextNode(text)); log.appendChild(d);
  while (log.children.length > 8) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 12000);
}
export function chatOpen() { return !$('chatin').hidden; }
export function chatToggle() {
  const i = $('chatin');
  if (i.hidden) { i.hidden = false; i.focus(); return; }
  const t = i.value.trim(); i.value = ''; i.hidden = true; i.blur();
  if (!t || partyCmd(t)) return;
  if (NET.online) sendNet({ t: 'ch', text: t }); else chatLine(NET.name, t, 'me');
}
export function chatCancel() { const i = $('chatin'); i.value = ''; i.hidden = true; i.blur(); }
function status() {
  const el = $('net'); if (!el) return;
  el.textContent = NET.online ? '● Online · ' + (NET.remotes.size + 1) + ' player(s)' + (isHost() ? ' · host' : '') : '○ Single player';
  el.className = NET.online ? 'on' : '';
}
export function netStatusTick() { status(); }

// Tell the server when the tab is hidden: the host role moves to a visible player
document.addEventListener('visibilitychange', () => sendNet({ t: 'vis', h: document.hidden ? 1 : 0 }));
