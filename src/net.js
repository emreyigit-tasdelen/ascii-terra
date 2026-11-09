// Çok oyunculu istemci: bağlantı, uzak oyuncular, sohbet, host-yetkili düşman senkronu.
// Sunucu yoksa (ör. python http.server ile açıldıysa) oyun sessizce tek oyunculu kalır.
import { THREE, $, clamp, lerp, angDiff, heightAt } from './core.js';
import { scene } from './render.js';
import { makeKnight, animBiped } from './models.js';
import { P, enemies, hitEnemy, grantKill, hurtPlayer, telegraph, spawnEproj, spawnFxNet, applySnapshot, snapshotRows } from './actors.js';
import { S, label, toast } from './game.js';

export const NET = { role: 'solo', myId: 0, hostId: 0, ws: null, online: false, name: 'Senje', remotes: new Map() };
const TABARDS = [0x1b2c5e, 0x1e5a2a, 0x5a1e5a, 0x6a4a10, 0x205060, 0x6a1a1a, 0x3a3a3a, 0x4a2a10];

export function sendNet(o) { if (NET.online && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
export const isClient = () => NET.role === 'client';
export const isHost = () => NET.role === 'host';

export function connectNet(name) {
  NET.name = name;
  if (!('WebSocket' in window) || location.protocol === 'file:') return;
  let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return; }
  NET.ws = ws;
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name })); ws.send(JSON.stringify({ t: 'vis', h: document.hidden ? 1 : 0 })); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => {
    if (NET.online) toast('Sunucu bağlantısı koptu — tek oyunculu devam ediyorsun');
    NET.online = false; NET.role = 'solo'; for (const r of NET.remotes.values()) removeRemote(r); NET.remotes.clear(); status();
  };
  ws.onerror = () => { };
}
function setRole() { NET.role = NET.hostId === NET.myId ? 'host' : 'client'; status(); }
function onMsg(m) {
  switch (m.t) {
    case 'welcome': NET.myId = m.id; NET.hostId = m.host; NET.online = true; setRole(); m.players.forEach(p => addRemote(p.id, p.name, p.st));
      toast('Sunucuya bağlandın — ' + (m.players.length ? m.players.length + ' oyuncu daha çevrimiçi' : 'şu an yalnızsın') + (isHost() ? ' (dünya sende)' : '')); break;
    case 'join': addRemote(m.id, m.name); toast(m.name + ' dünyaya katıldı'); chatLine('', m.name + ' katıldı', 'sys'); status(); break;
    case 'leave': { const r = NET.remotes.get(m.id); if (r) { toast(r.name + ' ayrıldı'); chatLine('', r.name + ' ayrıldı', 'sys'); removeRemote(r); NET.remotes.delete(m.id); status(); } break; }
    case 'host': NET.hostId = m.id; const was = NET.role; setRole(); if (was !== 'host' && isHost()) toast('Dünya simülasyonu artık sende (host)'); break;
    case 'st': { const r = NET.remotes.get(m.from); if (r) applyState(r, m); break; }
    case 'ch': chatLine(m.name, m.text, m.from === NET.myId ? 'me' : ''); break;
    case 'hit': { const e = enemies[m.e]; if (isHost() && e) hitEnemy(e, m.d, m.x, m.z, { remote: true, crit: m.c, by: m.from }); break; }
    case 'kill': { const e = enemies[m.e]; if (e) grantKill(e); break; }
    case 'dmg': hurtPlayer(m.d); break;
    case 'en': if (isClient()) applySnapshot(m.d); break;
    case 'tele': telegraph(m.x, m.z, m.r, m.dl, m.d, !!m.f, false); break;
    case 'ep': spawnEproj(m.x, m.y, m.z, m.vx, m.vz, m.d, m.tid, false); break;
    case 'fx': spawnFxNet(m); break;
  }
}

/* ---------------- uzak oyuncular ---------------- */
function addRemote(id, name, st) {
  if (NET.remotes.has(id)) return;
  const cloth = TABARDS[id % TABARDS.length], r = makeKnight({ cloth, capeColor: new THREE.Color(cloth).multiplyScalar(.45).getHex(), emblem: 0xd8cfb4 });
  scene.add(r.g);
  const R = { id, name, rig: r, x: 0, y: -50, z: 0, f: 0, tx: 0, ty: -50, tz: 0, tf: 0, a: [0, 0, -1, 0, -1, 0, 0], ph: 0, atk: -1, hp: 100, mh: 100, lv: 1, got: false };
  NET.remotes.set(id, R); if (st) applyState(R, st);
}
function removeRemote(R) { scene.remove(R.rig.g); }
function applyState(R, m) {
  R.tx = m.x; R.ty = m.y; R.tz = m.z; R.tf = m.f; R.hp = m.hp; R.mh = m.mh || 100; R.lv = m.lv || 1;
  const a = m.a || []; R.a = a;
  if (a[2] >= 0 && (R.atk < 0 || Math.abs(R.atk - a[2]) > .3)) { R.atk = a[2]; R.atkType = a[3]; }
  if (!R.got) { R.x = R.tx; R.y = R.ty; R.z = R.tz; R.f = R.tf; R.got = true; }
}
let T = 0, sendT = 0, snapT = 0;
export function updateNet(dt) {
  T += dt;
  for (const R of NET.remotes.values()) {
    const k = 1 - Math.exp(-12 * dt);
    R.x = lerp(R.x, R.tx, k); R.y = lerp(R.y, R.ty, k); R.z = lerp(R.z, R.tz, k); R.f += angDiff(R.f, R.tf) * k;
    if (R.atk >= 0) { R.atk += dt / .36; if (R.atk > 1) R.atk = -1; }
    const amt = (R.a[0] || 0) / 100, run = (R.a[1] || 0) / 100;
    R.ph += dt * Math.max(1.5, amt * 5.8 * 1.75 + run * 6);
    animBiped(R.rig, { ph: R.ph, amt, run, atk: R.atk, atkType: R.atkType || 0, dodge: R.a[4] ?? -1, air: R.a[5] || 0, hit: R.a[6] || 0, t: T, dt, style: 'knight' });
    R.rig.g.position.set(R.x, R.y, R.z); R.rig.g.rotation.y = R.f; R.rig.g.visible = R.got;
    R.rig.g.rotation.x = R.hp <= 0 ? -1.45 : 0;
    if (R.got && Math.hypot(R.x - P.x, R.z - P.z) < 60) label(R.name + ' · sv ' + R.lv, R.x, R.y + 2.6, R.z, 'ally', R.mh ? R.hp / R.mh : 1);
  }
  if (!NET.online) return;
  sendT -= dt;
  if (sendT <= 0) {   // yerel oyuncu durumu ~15 Hz
    sendT = .066;
    sendNet({ t: 'st', x: P.x, y: P.y, z: P.z, f: P.face, a: [Math.round((P.animAmt || 0) * 100), Math.round((P.animRun || 0) * 100), P.atkT, P.atkType, P.dodgeT > 0 ? 1 - P.dodgeT / .42 : -1, P.air ? 1 : 0, Math.max(0, P.hitT) * 3], hp: P.dead ? 0 : P.hp, mh: P.maxhp, lv: S.lvl });
  }
  if (isHost()) { snapT -= dt; if (snapT <= 0) { snapT = .1; const d = snapshotRows(); if (d.length) sendNet({ t: 'en', d }); } }
}
/* Düşman yapay zekâsı için hedef adayları (host) */
export function remoteTargets() { const a = []; for (const R of NET.remotes.values()) if (R.got && R.hp > 0) a.push(R); return a; }

/* ---------------- sohbet + durum ---------------- */
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
  if (!t) return;
  if (NET.online) sendNet({ t: 'ch', text: t }); else chatLine(NET.name, t, 'me');
}
export function chatCancel() { const i = $('chatin'); i.value = ''; i.hidden = true; i.blur(); }
function status() {
  const el = $('net'); if (!el) return;
  el.textContent = NET.online ? '● Çevrimiçi · ' + (NET.remotes.size + 1) + ' oyuncu' + (isHost() ? ' · host' : '') : '○ Tek oyunculu';
  el.className = NET.online ? 'on' : '';
}
export function netStatusTick() { status(); }

// Sekme gizlenince sunucuya bildir: host rolü görünür bir oyuncuya devredilir
document.addEventListener('visibilitychange', () => sendNet({ t: 'vis', h: document.hidden ? 1 : 0 }));
