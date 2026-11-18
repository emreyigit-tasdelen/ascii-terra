// 3D ASCII item preview for the craft screen: the blade or armour piece is a small three.js model rendered off-screen
// into a W x H render target (one pixel per character), then printed as coloured glyphs by brightness.
// Drag with the mouse to turn it; it slowly spins on its own when left alone.
import { THREE } from './core.js';
import { renderer } from './render.js';

const W = 60, H = 28, CELL = .6;                 // characters across/down; a character is ~0.6 as wide as it is tall
const RAMP = " .,:;-=+*#%@";
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W * CELL / H, .1, 50);
const rt = new THREE.WebGLRenderTarget(W, H), buf = new Uint8Array(W * H * 4), pivot = new THREE.Group();
scene.add(pivot, new THREE.AmbientLight(0xffffff, .28));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x9fb8ff, .7); rim.position.set(-3, 1, -3); scene.add(rim);
const view = { yaw: .6, pitch: .15, vy: 0, drag: null, idle: 0 };
let built = '', item = null;

const mat = (c, shine = 70) => new THREE.MeshPhongMaterial({ color: c, shininess: shine, specular: 0x777777 });
const glow = c => new THREE.MeshBasicMaterial({ color: c });
function mesh(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (s) o.scale.set(...s); return o; }

/* one model per craft tab; `runes` adds glowing studs in the rune colours */
function build(tab, metal, runes) {
  const g = new THREE.Group(), M = mat(metal), dark = mat(0x2a2018, 10), gold = mat(0xb89a5a, 50);
  const studs = pts => runes.forEach((c, i) => { const p = pts[i % pts.length]; g.add(mesh(new THREE.SphereGeometry(.045, 10, 8), glow(c), ...p)); });
  if (tab === 'weapon') {
    const sh = new THREE.Shape(); sh.moveTo(-.07, 0); sh.lineTo(.07, 0); sh.lineTo(.06, 1.35); sh.lineTo(0, 1.62); sh.lineTo(-.06, 1.35); sh.lineTo(-.07, 0);
    const bl = new THREE.ExtrudeGeometry(sh, { depth: .025, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }); bl.translate(0, 0, -.0125);
    g.add(mesh(bl, M), mesh(new THREE.BoxGeometry(.5, .06, .09), gold, 0, -.02), mesh(new THREE.CylinderGeometry(.035, .04, .36, 10), dark, 0, -.23),
      mesh(new THREE.SphereGeometry(.065, 12, 10), gold, 0, -.44), mesh(new THREE.BoxGeometry(.012, 1.2, .045), mat(0x000000, 5), 0, .7, 0));
    studs([[0, .35, .04], [0, .65, .04], [0, .95, .04]]); g.position.y = -.58;
  } else if (tab === 'helm') {
    g.add(mesh(new THREE.SphereGeometry(.42, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), M), mesh(new THREE.CylinderGeometry(.42, .44, .38, 28, 1, true), M, 0, -.19),
      mesh(new THREE.BoxGeometry(.5, .05, .1), mat(0x050505, 5), 0, -.12, .4), mesh(new THREE.BoxGeometry(.05, .3, .06), M, 0, -.2, .44), mesh(new THREE.TorusGeometry(.43, .025, 6, 32), gold, 0, 0, 0, Math.PI / 2));
    studs([[-.25, .2, .3], [.25, .2, .3]]); g.position.y = .05;
  } else if (tab === 'shoulders') {
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.SphereGeometry(.3, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M, s * .45, 0, 0, 0, 0, -s * .35, [1, .8, 1.1]));
      g.add(mesh(new THREE.SphereGeometry(.34, 22, 8, 0, Math.PI * 2, Math.PI / 2.6, Math.PI / 10), M, s * .45, -.02, 0, 0, 0, -s * .35, [1, .8, 1.1]));
    }
    studs([[-.45, .2, .12], [.45, .2, .12]]);
  } else if (tab === 'chest') {
    const prof = [[.0, -.55], [.36, -.55], [.4, -.3], [.44, 0], [.5, .3], [.46, .45], [.2, .55], [0, .56]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(mesh(new THREE.LatheGeometry(prof, 28), M, 0, 0, 0, 0, 0, 0, [1, 1, .62]), mesh(new THREE.TorusGeometry(.4, .03, 6, 28), gold, 0, -.38, 0, Math.PI / 2, 0, 0, [1, .65, 1]),
      mesh(new THREE.BoxGeometry(.04, .7, .05), gold, 0, 0, .29));
    studs([[-.15, .25, .28], [.15, .25, .28]]);
  } else if (tab === 'gloves') {
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(.13, .16, .3, 14), M, s * .3, -.15), mesh(new THREE.BoxGeometry(.24, .2, .1), M, s * .3, .08));
      for (let f = 0; f < 4; f++) g.add(mesh(new THREE.BoxGeometry(.045, .16, .07), M, s * .3 + (f - 1.5) * .057, .26));
      g.add(mesh(new THREE.BoxGeometry(.05, .12, .07), M, s * .3 - s * .14, .1, 0, 0, 0, s * .6));
    }
    studs([[-.3, .08, .06], [.3, .08, .06]]);
  } else if (tab === 'legs') {
    for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(.16, .12, .9, 16), M, s * .19, -.1), mesh(new THREE.SphereGeometry(.13, 14, 10), M, s * .19, -.15, .06, 0, 0, 0, [1, 1, .6]));
    g.add(mesh(new THREE.BoxGeometry(.6, .18, .3), M, 0, .42));
    studs([[-.19, .25, .15], [.19, .25, .15]]);
  } else if (tab === 'boots') {
    for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(.13, .14, .45, 14), M, s * .22, .05), mesh(new THREE.BoxGeometry(.24, .14, .44), M, s * .22, -.22, .1), mesh(new THREE.BoxGeometry(.26, .04, .46), dark, s * .22, -.3, .1));
    studs([[-.22, .1, .13], [.22, .1, .13]]);
  }
  return g;
}

export function initPreview(el) {
  el.style.cursor = 'grab';
  el.addEventListener('mousedown', e => { view.drag = { x: e.clientX, y: e.clientY }; el.style.cursor = 'grabbing'; e.preventDefault(); });
  addEventListener('mousemove', e => {
    if (!view.drag) return;
    const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y; view.drag = { x: e.clientX, y: e.clientY };
    view.yaw += dx * .012; view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch + dy * .01)); view.vy = dx * .012; view.idle = 0;
  });
  addEventListener('mouseup', () => { if (view.drag) { view.drag = null; el.style.cursor = 'grab'; } });
}

/* returns the HTML for one frame; dt in seconds */
export function previewFrame(tab, metalCss, runeCss, dt) {
  const sig = tab + metalCss + runeCss.join();
  if (sig !== built) { if (item) pivot.remove(item); item = build(tab, new THREE.Color(metalCss), runeCss.map(c => new THREE.Color(c))); pivot.add(item); built = sig; }
  if (!view.drag) { view.idle += dt; view.vy *= Math.pow(.05, dt); view.yaw += view.vy + (view.idle > 1.5 ? dt * .5 : 0); }
  pivot.rotation.set(view.pitch, view.yaw, 0, 'XYZ');
  cam.position.set(0, 0, tab === 'weapon' ? 3.5 : 2.9); cam.lookAt(0, 0, 0);
  const prevT = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), sh = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevT); renderer.setClearColor(cc, ca); renderer.shadowMap.enabled = sh;
  let out = '';
  for (let y = H - 1; y >= 0; y--) {   // render targets are bottom-up
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, r = buf[o], g = buf[o + 1], b = buf[o + 2], L = (r * .3 + g * .59 + b * .11) / 255;
      if (L < .035) { out += ' '; continue; }
      const ch = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(L * (RAMP.length - 1)))], k = Math.min(2.2, .45 / Math.max(.2, L) + .7);
      out += `<span style="color:rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})">${ch}</span>`;
    }
    out += '\n';
  }
  return out;
}
