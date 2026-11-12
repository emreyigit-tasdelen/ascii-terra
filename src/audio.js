// Procedural sound (WebAudio, no sample files): combat, footsteps, pickups and looping ambience
let ctx = null, master = null, noiseBuf = null, on = true, vol = .5;
try { const v = parseFloat(localStorage.getItem('terra.vol')); if (v >= 0 && v <= 1) vol = v; } catch (e) { /* storage blocked: keep the default */ }
const amb = {};

function noiseSrc(loop) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; }
function ambient(type, freq, q) {   // endless filtered noise, volume driven from updateAudio
  const s = noiseSrc(true), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(master); s.start();
  return { f, g };
}
export function initAudio() {   // call from a user gesture (the Start button)
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? vol : 0; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  amb.wind = ambient('bandpass', 420, .6); amb.rain = ambient('highpass', 2600, .3); amb.sea = ambient('lowpass', 520, .4); amb.fire = ambient('bandpass', 1500, 1.2);
}
export function toggleSound() { on = !on; if (master) master.gain.value = on ? vol : 0; return on; }
export const getVolume = () => vol;
export function setVolume(v) {   // 0..1, remembered in this browser
  vol = Math.max(0, Math.min(1, v)); if (master && on) master.gain.value = vol;
  try { localStorage.setItem('terra.vol', String(vol)); } catch (e) { /* not saved */ }
}

// one shaped noise burst: filter sweep f0 → f1 over dur
function noise(dur, f0, f1, vol, type = 'bandpass', q = 1, delay = 0) {
  const t = ctx.currentTime + delay, s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur * .2)); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
// one tone: pitch slide f0 → f1 over dur
function tone(dur, f0, f1, vol, wave = 'sine', delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
const SFX = {
  swing: () => noise(.16, 2400, 500, .28, 'bandpass', 1.4),
  hit: () => { noise(.09, 1800, 300, .4, 'lowpass'); tone(.12, 150, 55, .5); },
  crit: () => { noise(.14, 3200, 400, .5, 'lowpass'); tone(.2, 200, 45, .6); tone(.25, 1300, 900, .12, 'triangle'); },
  fire: () => noise(.45, 300, 1800, .35, 'bandpass', .7),
  boom: () => { noise(.6, 900, 60, .6, 'lowpass'); tone(.5, 90, 30, .7); },
  void: () => { tone(1.2, 70, 150, .35, 'sawtooth'); noise(1.2, 200, 900, .15, 'bandpass', 3); },
  beam: () => { tone(.5, 1400, 300, .22, 'sawtooth'); noise(.4, 5000, 900, .3, 'highpass'); },
  hurt: () => { tone(.18, 240, 90, .45, 'square'); noise(.12, 900, 200, .3, 'lowpass'); },
  block: () => { tone(.12, 900, 700, .25, 'triangle'); noise(.07, 4000, 2000, .3, 'highpass'); },
  parry: () => { tone(.4, 1900, 1700, .28, 'triangle'); tone(.4, 2850, 2600, .14); noise(.06, 6000, 3000, .3, 'highpass'); },
  roll: () => noise(.28, 500, 180, .3, 'lowpass'),
  jump: () => noise(.12, 300, 700, .18, 'bandpass'),
  step: () => noise(.07, 500 + Math.random() * 250, 160, .13, 'lowpass'),
  die: () => { noise(.35, 700, 90, .35, 'lowpass'); tone(.4, 130, 40, .3, 'sawtooth'); },
  web: () => noise(.5, 5200, 1400, .22, 'bandpass', 4),
  drop: () => tone(.25, 1500, 2200, .12, 'triangle'),
  pick: () => { tone(.1, 660, 660, .2, 'triangle'); tone(.16, 990, 990, .2, 'triangle', .07); },
  level: () => [392, 494, 587, 784].forEach((f, i) => tone(.5, f, f, .2, 'triangle', i * .09)),
  quest: () => { tone(.3, 523, 523, .2, 'triangle'); tone(.5, 784, 784, .2, 'triangle', .14); },
  ui: () => tone(.05, 880, 880, .1, 'square')
};
export function sfx(name) { if (ctx && on && ctx.state === 'running' && SFX[name]) SFX[name](); }

let stepT = 0, gust = 0;
// a: { speed, grounded, mounted, rain (0..1), coast (0..1), fire (0..1), night (0..1) }
export function updateAudio(dt, a) {
  if (!ctx) return;
  if (a.grounded && a.speed > 1.5) {
    stepT -= dt * a.speed;
    if (stepT <= 0) { stepT = a.mounted ? 3.4 : 2.9; sfx('step'); if (a.mounted) setTimeout(() => sfx('step'), 90); }
  } else stepT = Math.min(stepT, .6);
  gust += dt;
  const t = ctx.currentTime, set = (n, v) => n.g.gain.setTargetAtTime(v, t, .4);
  set(amb.wind, .05 + .035 * Math.sin(gust * .23) + .02 * Math.sin(gust * .71) + .03 * a.rain);
  amb.wind.f.frequency.setTargetAtTime(380 + 160 * Math.sin(gust * .31), t, .5);
  set(amb.rain, .16 * a.rain);
  set(amb.sea, a.coast * (.12 + .07 * Math.sin(gust * .9)));
  set(amb.fire, a.fire * (.03 + .03 * Math.random()));
}
