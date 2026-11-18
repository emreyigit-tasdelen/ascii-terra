// Key rebinding: the game code keeps its default keys; mapKey() turns the player's chosen key into the default one.
// Bindings live in localStorage ('terra.keys' = { action: key }) and are edited in the pause menu (#pkeys).
import { $ } from './core.js';

export const ACTIONS = [['w', 'Forward'], ['s', 'Back'], ['a', 'Left'], ['d', 'Right'], ['1', 'Sword'], ['2', 'Fireball'], ['3', 'Whirlwind'], ['4', 'Potion'],
  ['5', 'Void Orb'], ['6', 'Moon Lance'], ['e', 'Talk'], ['c', 'Dodge'], ['f', 'Mount'], ['k', 'Craft'], ['i', 'Inventory'], ['m', 'Map']];
const RESERVED = ['escape', 'p', 'enter', ' ', 'shift', 'alt', 'control', 'meta', 'tab'];
let binds = {}, remap = {}, waiting = null;
try { binds = JSON.parse(localStorage.getItem('terra.keys') || '{}') || {}; } catch (e) { binds = {}; }

function rebuild() {
  for (const [def] of ACTIONS) if (binds[def] === def) delete binds[def];
  remap = {}; const used = new Set(ACTIONS.map(([d]) => keyOf(d)));
  for (const [def] of ACTIONS) {
    const cur = keyOf(def); if (cur === def) continue;
    remap[cur] = def; if (!used.has(def)) remap[def] = '';   // a default key nobody uses any more does nothing
  }
}
// Turkish keyboards send ı / İ for the I key
export const lowKey = k => (k === "ı" || k === "İ" ? "i" : k.toLowerCase());
export const keyOf = def => binds[def] || def;
export const mapKey = k => (k in remap ? remap[k] : k);
rebuild();

export function renderKeys() {
  const box = $('pkeys'); if (!box) return;
  box.innerHTML = ACTIONS.map(([def, n]) => `<button data-k="${def}">${n}: <b>${waiting === def ? '…' : keyOf(def).toUpperCase()}</b></button>`).join('') + '<button data-k="reset">Reset keys</button>';
}
export function initKeys() {
  $('pkeys').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k === 'reset') { binds = {}; save(); } else waiting = b.dataset.k;
    renderKeys();
  });
  renderKeys();
}
function save() { rebuild(); try { localStorage.setItem('terra.keys', JSON.stringify(binds)); } catch (e) { } }
/* while a binding waits for a key, the next key press is taken here (Esc cancels) */
export function captureKey(e) {
  if (!waiting) return false;
  e.preventDefault(); const k = lowKey(e.key);
  if (k !== 'escape') {
    if (RESERVED.includes(k) || k.length !== 1) { waiting = null; renderKeys(); return true; }
    for (const [def] of ACTIONS) if (keyOf(def) === k && def !== waiting) binds[def] = keyOf(waiting);   // swap with the action that had this key
    binds[waiting] = k; save();
  }
  waiting = null; renderKeys(); return true;
}
