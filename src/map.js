// World map (M): the whole land as a glyph grid with markers; wheel zooms, drag moves
import { $, clamp, heightAt, sketchAt, pathDist, riverDist, swampF, WATER, HALF } from './core.js';
import { REGIONS, crystals, CIRCLE } from './world.js';
import { P, NPCS, enemies } from './actors.js';
import { PARTY } from './party.js';
import { NET } from './net.js';
import { Q, npcMark } from './game.js';

const CW = 8, CH = 13;                       // glyph cell in pixels
const V = { x: 0, z: 0, zoom: 4 };           // centre + world units per column
let cv, g, cols = 0, rows = 0, base = null, dirty = true, drag = null, drawT = 0, blink = 0;
export const mapOpen = () => !$('map').hidden;

function terrain(x, z) {
  if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null;
  const h = heightAt(x, z);
  if (h < WATER) return ['~', h < WATER - 3 ? '#16283c' : '#2c4a6a'];
  if (riverDist(x, z) < 2.5) return ['~', '#2c4a6a'];
  if (pathDist(x, z) < 2.2) return ['=', '#8a8272'];
  if (Math.hypot(x, z) < 18) return ['#', '#b9a47a'];
  if (h > 13) return ['^', h > 20 ? '#c8c8d4' : '#8a8a98'];
  if (swampF(x, z) > .3) return [',', '#4f6a3c'];
  const s = sketchAt(x, z);
  if (s.T > .55) return ['T', '#2f7a44'];
  if (h > 7) return ['n', '#5f6a52'];
  return ['.', '#2a5236'];
}
function rebuild() {
  const box = $('mapBox'), w = Math.floor(box.clientWidth / CW), h = Math.floor(box.clientHeight / CH);
  if (w !== cols || h !== rows) { cols = w; rows = h; cv.width = cols * CW; cv.height = rows * CH; }
  base = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) base.push(terrain(V.x + (i - cols / 2 + .5) * V.zoom, V.z + (j - rows / 2 + .5) * V.zoom * CH / CW));
  dirty = false;
}
const sx = x => ((x - V.x) / V.zoom + cols / 2) * CW, sy = z => ((z - V.z) / (V.zoom * CH / CW) + rows / 2) * CH;
function mark(ch, x, z, col) {
  const px = Math.floor(sx(x) / CW) * CW, py = Math.floor(sy(z) / CH) * CH;
  if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return;
  g.fillStyle = '#05070a'; g.fillRect(px - CW, py, CW * (ch.length + 2), CH);
  g.fillStyle = col; g.fillText(ch, px, py + 1);
}
// where an active quest wants the player to go
function objective(q) {
  if (q.st === 2) return NPCS.find(n => n.id === q.giver);
  const near = list => list.reduce((b, o) => !b || Math.hypot(o.x - P.x, o.z - P.z) < Math.hypot(b.x - P.x, b.z - P.z) ? o : b, null);
  if (q.obj === 'slay') return near(enemies.filter(e => e.k.id === q.kind && !e.dead));
  if (q.obj === 'collect') return near(crystals.filter(c => !c.taken));
  return CIRCLE;
}
function draw() {
  if (dirty) rebuild();
  g.fillStyle = '#05070a'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '12px "Courier New", monospace'; g.textBaseline = 'top';
  let k = 0, last = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const c = base[k++]; if (!c) continue; if (c[1] !== last) g.fillStyle = last = c[1]; g.fillText(c[0], i * CW, j * CH + 1); }
  g.font = 'bold 12px "Courier New", monospace';
  mark('o', CIRCLE.x, CIRCLE.z, '#d8d2c0');
  crystals.forEach(c => { if (!c.taken) mark('*', c.x, c.z, '#6fe0ff'); });
  enemies.forEach(e => { if (e.k.boss && !e.dead) mark('B', e.home.x, e.home.z, '#ff5050'); });
  NPCS.forEach(n => mark('&' + npcMark(n).replace(/[ \[\]]/g, ''), n.x, n.z, '#ffd866'));
  if (blink < .7) Q.forEach(q => { if (q.st !== 1 && q.st !== 2) return; const o = objective(q); if (o) mark('X', o.x, o.z, '#ffb020'); });
  for (const R of NET.remotes.values()) if (R.got) { const mate = PARTY.m.some(m => m.id === R.id); mark(mate ? 'P' : 'p', R.x, R.z, mate ? '#7dff9a' : '#8fb8ff'); }   // other players; party members in green
  mark('@', P.x, P.z, blink < .5 ? '#ffffff' : '#9fb0c0');
  g.fillStyle = '#d8d2c0'; g.textAlign = 'center';
  for (const R of REGIONS) { const px = sx(R.x), py = sy(R.z - R.r * .55); if (px > 0 && py > 0 && px < cv.width && py < cv.height) g.fillText(R.name.toUpperCase().split('').join(' '), px, py); }
  g.textAlign = 'left';
}
export function toggleMap(on = !mapOpen()) {
  $('map').hidden = !on; if (!on) return;
  V.x = P.x; V.z = P.z; dirty = true; draw();
}
export function updateMap(dt) {
  if (!mapOpen()) return;
  blink = (blink + dt) % 1; drawT -= dt; if (drawT <= 0 || dirty) { drawT = .15; draw(); }
}
export function initMap() {
  if (cv) return; cv = $('mapCv'); g = cv.getContext('2d');
  cv.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); V.zoom = clamp(V.zoom * Math.exp(e.deltaY * .0015), .8, 6); dirty = true; }, { passive: false });
  cv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('mouseup', () => { drag = null; });
  addEventListener('mousemove', e => {
    if (!drag || !mapOpen()) return;
    V.x = clamp(V.x - (e.clientX - drag.x) / CW * V.zoom, -HALF, HALF); V.z = clamp(V.z - (e.clientY - drag.y) / CH * V.zoom * CH / CW, -HALF, HALF);
    drag.x = e.clientX; drag.y = e.clientY; dirty = true;
  });
  cv.addEventListener('dblclick', () => { V.x = P.x; V.z = P.z; dirty = true; });
  addEventListener('resize', () => { dirty = true; });
  $('mapClose').onclick = () => toggleMap(false);
}
