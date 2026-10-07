// 程序合成音效库
import { engine } from './engine';

export type SfxName =
  | 'clash' | 'armor' | 'hit' | 'block' | 'swing' | 'bow' | 'xbow' | 'arrowHit' | 'arrowGround' | 'gun' | 'cannon'
  | 'death' | 'shout' | 'crowd' | 'horn' | 'drum' | 'drumRoll' | 'smallDrum' | 'gong' | 'gongLow' | 'click' | 'page'
  | 'coin' | 'bell' | 'levelup' | 'quest' | 'victory' | 'defeat' | 'neigh' | 'gallop' | 'fall' | 'woodblock' | 'error' | 'thunder';

export interface SfxOpts { vol?: number; pan?: number; muffle?: number; rate?: number; delay?: number; verb?: number }

const R = Math.random;
const rr = (a: number, b: number) => a + R() * (b - a);

// ---------- 基础构件 ----------
interface Out { node: AudioNode; t: number; c: AudioContext }

function makeOut(o: SfxOpts, verbDefault: number): Out | null {
  const c = engine.ctx;
  if (!c || c.state !== 'running') return null;
  const t = c.currentTime + 0.005 + (o.delay ?? 0);
  const g = c.createGain(); g.gain.value = o.vol ?? 1;
  let head: AudioNode = g;
  const muffle = Math.max(0, Math.min(1, o.muffle ?? 0));
  if (muffle > 0.02) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 18000 * Math.pow(1 - muffle, 2.2) + 500;
    g.connect(lp); head = lp;
  }
  let tail: AudioNode = head;
  if (o.pan && c.createStereoPanner) {
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan));
    head.connect(p); tail = p;
  }
  tail.connect(engine.sfx);
  const vs = (o.verb ?? verbDefault) * (1 + muffle * 1.5);
  if (vs > 0.01) { const s = c.createGain(); s.gain.value = vs; tail.connect(s); s.connect(engine.verbIn); }
  return { node: g, t, c };
}

function env(c: AudioContext, t: number, a: number, peak: number, d: number, hold = 0) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  return g;
}

function osc(o: Out, type: OscillatorType, f0: number, f1: number | null, t: number, a: number, peak: number, d: number, glide = d, dest?: AudioNode) {
  const { c } = o;
  const s = c.createOscillator(); s.type = type;
  s.frequency.setValueAtTime(f0, t);
  if (f1 !== null) s.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + glide);
  const g = env(c, t, a, peak, d);
  s.connect(g); g.connect(dest ?? o.node);
  s.start(t); s.stop(t + a + d + 0.05);
  return s;
}

function noise(o: Out, t: number, a: number, peak: number, d: number, filt?: { type: BiquadFilterType; f: number; q?: number; f1?: number }, brown = false, dest?: AudioNode) {
  const { c } = o;
  const s = c.createBufferSource(); s.buffer = brown ? engine.brown : engine.noise;
  const g = env(c, t, a, peak, d);
  let head: AudioNode = s;
  if (filt) {
    const f = c.createBiquadFilter(); f.type = filt.type; f.frequency.setValueAtTime(filt.f, t); f.Q.value = filt.q ?? 0.7;
    if (filt.f1) f.frequency.exponentialRampToValueAtTime(filt.f1, t + a + d);
    s.connect(f); head = f;
  }
  head.connect(g); g.connect(dest ?? o.node);
  s.start(t, R() * 1.2); s.stop(t + a + d + 0.05);
}

/** 金属撞击：一组非谐泛音 */
function metal(o: Out, t: number, base: number, peak: number, decay: number, ratios = [1, 2.32, 3.86, 5.12, 7.3]) {
  ratios.forEach((r, i) => osc(o, 'sine', base * r * rr(0.99, 1.01), null, t, 0.001, peak / Math.pow(i + 1, 0.55), decay / (1 + i * 0.35)));
}

/** 人声：锯齿波 + 共振峰 */
function voice(o: Out, t: number, f0: number, contour: [number, number][], formants: [number, number][], peak: number, dur: number) {
  const { c } = o;
  const s = c.createOscillator(); s.type = 'sawtooth';
  s.frequency.setValueAtTime(f0, t);
  for (const [dt, f] of contour) s.frequency.linearRampToValueAtTime(f, t + dt);
  const vib = c.createOscillator(); vib.frequency.value = rr(5, 7);
  const vg = c.createGain(); vg.gain.value = f0 * 0.02; vib.connect(vg); vg.connect(s.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.04);
  g.gain.setValueAtTime(peak, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [f, q] of formants) {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    s.connect(bp); bp.connect(g);
  }
  g.connect(o.node);
  s.start(t); vib.start(t); s.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}

/** 拨弦（简易 Karplus-Strong，缓存） */
const ksCache = new Map<number, AudioBuffer>();
export function pluckBuffer(c: AudioContext, freq: number, dur = 2.4, bright = 0.5): AudioBuffer {
  const key = Math.round(freq * 10) * 10 + Math.round(bright * 9);
  const hit = ksCache.get(key); if (hit) return hit;
  const sr = c.sampleRate, N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * dur);
  const buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const w = R() * 2 - 1; prev = prev + (w - prev) * (0.25 + bright * 0.7); ring[i] = prev; }
  const decay = 0.9965 - Math.min(0.006, freq / 400000);
  let idx = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx], b = ring[(idx + 1) % N];
    ring[idx] = (a * 0.5 + b * 0.5) * decay;
    d[i] = a; if (Math.abs(a) > peak) peak = Math.abs(a);
    idx = (idx + 1) % N;
  }
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) d[i] *= k * (i < 40 ? i / 40 : 1);
  ksCache.set(key, buf);
  return buf;
}
export function pluck(o: { c: AudioContext; node: AudioNode }, t: number, freq: number, vol: number, opts: { bright?: number; bend?: number; dur?: number } = {}) {
  const { c } = o;
  const s = c.createBufferSource(); s.buffer = pluckBuffer(c, freq, opts.dur ?? 2.4, opts.bright ?? 0.55);
  if (opts.bend) { s.playbackRate.setValueAtTime(1, t + 0.12); s.playbackRate.linearRampToValueAtTime(opts.bend, t + 0.32); }
  const g = c.createGain(); g.gain.value = vol;
  const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 320; body.gain.value = 4; body.Q.value = 1.2;
  s.connect(body); body.connect(g); g.connect(o.node);
  s.start(t); s.stop(t + (opts.dur ?? 2.4));
}

// 马蹄声循环素材（离线合成）
let gallopBuf: AudioBuffer | null = null;
export function gallopBuffer(c: AudioContext): AudioBuffer {
  if (gallopBuf) return gallopBuf;
  const sr = c.sampleRate, len = Math.floor(sr * 2.4);
  const buf = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let h = 0; h < 7; h++) {
      const period = rr(0.36, 0.44), off = R() * period, amp = rr(0.4, 1);
      for (let start = off; start < 2.4; start += period) {
        for (const sub of [0, 0.07, 0.13]) {
          const t0 = Math.floor((start + sub + rr(-0.008, 0.008)) * sr);
          const f = rr(70, 110), n = Math.floor(sr * 0.09);
          let lp = 0;
          for (let i = 0; i < n && t0 + i < len; i++) {
            const tt = i / sr;
            lp += ((R() * 2 - 1) - lp) * 0.08;
            d[(t0 + i) % len] += amp * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / 0.03) * 0.7 + lp * Math.exp(-tt / 0.02) * 2.2) * 0.35;
          }
        }
      }
    }
  }
  gallopBuf = buf;
  return buf;
}

// ---------- 配方 ----------
type Recipe = (o: Out, p: SfxOpts) => void;
const VOWELS: [number, number][][] = [[[800, 7], [1200, 8]], [[600, 7], [1000, 8]], [[400, 6], [2200, 9]], [[500, 7], [850, 7]]];

const RECIPES: Record<SfxName, [Recipe, number]> = {
  clash: [(o) => {
    const t = o.t;
    metal(o, t, rr(1100, 1900), 0.16, rr(0.25, 0.5));
    noise(o, t, 0.001, 0.5, 0.05, { type: 'highpass', f: 2600 });
  }, 0.25],
  armor: [(o) => {
    const t = o.t;
    metal(o, t, rr(420, 640), 0.18, 0.12, [1, 1.9, 3.1, 4.7]);
    noise(o, t, 0.001, 0.5, 0.06, { type: 'bandpass', f: 1500, q: 0.8 });
    osc(o, 'sine', 140, 60, t, 0.001, 0.35, 0.1);
  }, 0.15],
  hit: [(o) => {
    const t = o.t;
    noise(o, t, 0.002, 0.8, 0.09, { type: 'lowpass', f: 900 });
    osc(o, 'sine', 130, 50, t, 0.001, 0.55, 0.12);
  }, 0.08],
  block: [(o) => {
    const t = o.t;
    noise(o, t, 0.001, 0.7, 0.07, { type: 'bandpass', f: 420, q: 1.8 });
    osc(o, 'triangle', 210, 150, t, 0.001, 0.35, 0.09);
  }, 0.12],
  swing: [(o) => {
    noise(o, o.t, 0.05, 0.22, 0.14, { type: 'bandpass', f: 500, q: 1.6, f1: 2400 });
  }, 0.05],
  bow: [(o) => {
    const t = o.t;
    noise(o, t, 0.001, 0.35, 0.015, { type: 'highpass', f: 3000 });
    osc(o, 'triangle', rr(90, 120), rr(80, 100), t, 0.002, 0.32, 0.2);
    noise(o, t + 0.01, 0.03, 0.12, 0.22, { type: 'bandpass', f: 3200, q: 3, f1: 1300 });
  }, 0.12],
  xbow: [(o) => {
    const t = o.t;
    noise(o, t, 0.001, 0.8, 0.03, { type: 'bandpass', f: 1900, q: 1.5 });
    osc(o, 'triangle', 170, 150, t, 0.001, 0.3, 0.1);
    osc(o, 'sine', 240, 120, t, 0.001, 0.25, 0.06);
  }, 0.12],
  arrowHit: [(o) => {
    const t = o.t;
    noise(o, t, 0.001, 0.5, 0.03, { type: 'bandpass', f: 1800, q: 2 });
    osc(o, 'sine', 320, 110, t, 0.001, 0.3, 0.06);
  }, 0.06],
  arrowGround: [(o) => {
    noise(o, o.t, 0.001, 0.25, 0.04, { type: 'bandpass', f: 900, q: 1.5 });
  }, 0.05],
  gun: [(o) => {
    const t = o.t;
    noise(o, t, 0.0005, 1, 0.05);
    noise(o, t, 0.003, 0.95, 0.7, { type: 'lowpass', f: 900, f1: 200 }, true);
    osc(o, 'sine', 80, 35, t, 0.001, 0.7, 0.35);
  }, 0.55],
  cannon: [(o) => {
    const t = o.t;
    noise(o, t, 0.001, 1, 0.08, { type: 'lowpass', f: 3000 });
    noise(o, t, 0.01, 1, 1.6, { type: 'lowpass', f: 500, f1: 90 }, true);
    osc(o, 'sine', 55, 25, t, 0.002, 1, 0.9);
  }, 0.7],
  thunder: [(o) => {
    const t = o.t;
    // 先一声炸裂，再是长长的滚雷
    noise(o, t, 0.002, 0.6, 0.25, { type: 'lowpass', f: 2400, f1: 600 });
    noise(o, t + 0.05, 0.25, 1, 3.2, { type: 'lowpass', f: 380, f1: 70 }, true);
    for (let k = 0; k < 4; k++) noise(o, t + 0.3 + k * rr(0.35, 0.7), 0.1, rr(0.4, 0.8), rr(0.8, 1.4), { type: 'lowpass', f: rr(200, 420), f1: 60 }, true);
    osc(o, 'sine', 48, 30, t + 0.05, 0.2, 0.5, 2.5);
  }, 0.6],
  death: [(o) => {
    const f = rr(110, 190);
    voice(o, o.t, f, [[0.08, f * 1.08], [0.55, f * 0.62]], VOWELS[Math.floor(R() * 4)], 0.22, rr(0.45, 0.7));
  }, 0.2],
  shout: [(o) => {
    const t = o.t, f = rr(150, 240);
    noise(o, t, 0.005, 0.25, 0.06, { type: 'highpass', f: 3500 });
    voice(o, t + 0.04, f, [[0.08, f * 1.18], [0.3, f * 0.9]], [[800, 6], [1250, 7]], 0.22, rr(0.28, 0.4));
  }, 0.25],
  crowd: [(o) => {
    for (let i = 0; i < 12; i++) {
      const t = o.t + R() * 0.3, f = rr(120, 230);
      voice(o, t, f, [[0.1, f * 1.2], [0.5, f * 0.85]], VOWELS[i % 2], 0.07, rr(0.45, 0.8));
    }
    noise(o, o.t, 0.08, 0.08, 0.5, { type: 'bandpass', f: 700, q: 0.6 });
  }, 0.35],
  horn: [(o) => {
    const { c } = o; const t = o.t;
    const f = rr(150, 160);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.3); lp.frequency.linearRampToValueAtTime(900, t + 1.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.18); g.gain.setValueAtTime(0.28, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    lp.connect(g); g.connect(o.node);
    for (const [mul, v] of [[1, 1], [0.5, 0.6], [1.003, 0.6]] as [number, number][]) {
      const s = c.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(f * mul * 0.9, t); s.frequency.exponentialRampToValueAtTime(f * mul, t + 0.15);
      s.frequency.setValueAtTime(f * mul, t + 1.4); s.frequency.exponentialRampToValueAtTime(f * mul * 0.94, t + 2.0);
      const vib = c.createOscillator(); vib.frequency.value = 5; const vg = c.createGain(); vg.gain.value = 1.6; vib.connect(vg); vg.connect(s.frequency);
      const sg = c.createGain(); sg.gain.value = v; s.connect(sg); sg.connect(lp);
      s.start(t); vib.start(t); s.stop(t + 2.1); vib.stop(t + 2.1);
    }
  }, 0.55],
  drum: [(o) => {
    const t = o.t;
    osc(o, 'sine', rr(82, 92), 46, t, 0.003, 0.9, 0.6, 0.35);
    noise(o, t, 0.001, 0.45, 0.07, { type: 'lowpass', f: 350 });
  }, 0.35],
  drumRoll: [(o) => {
    for (let i = 0; i < 9; i++) {
      const t = o.t + i * 0.14 * (1 - i * 0.04);
      osc(o, 'sine', 88, 46, t, 0.003, 0.4 + i * 0.07, 0.45, 0.3);
      noise(o, t, 0.001, 0.2, 0.05, { type: 'lowpass', f: 400 });
    }
  }, 0.35],
  smallDrum: [(o) => {
    const t = o.t;
    osc(o, 'sine', 200, 120, t, 0.001, 0.45, 0.14);
    noise(o, t, 0.001, 0.35, 0.05, { type: 'bandpass', f: 1600, q: 1 });
  }, 0.2],
  gong: [(o) => {
    const t = o.t, base = rr(105, 115);
    [1, 1.52, 2.29, 2.95, 3.71, 4.45, 5.6].forEach((r, i) => {
      const s = osc(o, 'sine', base * r, null, t, 0.01, 0.2 / Math.pow(i + 1, 0.5), 3.6 / (1 + i * 0.25));
      s.frequency.setValueAtTime(base * r, t); s.frequency.linearRampToValueAtTime(base * r * 0.985, t + 1.5);
    });
    noise(o, t, 0.002, 0.3, 0.25, { type: 'bandpass', f: 900, q: 0.8 });
  }, 0.5],
  gongLow: [(o) => {
    const t = o.t, base = 68;
    [1, 1.48, 2.21, 2.9, 3.6].forEach((r, i) => osc(o, 'sine', base * r, base * r * 0.97, t, 0.02, 0.25 / Math.pow(i + 1, 0.5), 4.5 / (1 + i * 0.3), 3));
  }, 0.6],
  click: [(o) => {
    const t = o.t;
    osc(o, 'sine', 1150, 900, t, 0.001, 0.22, 0.045);
    osc(o, 'sine', 2300, null, t, 0.001, 0.05, 0.03);
  }, 0.03],
  woodblock: [(o) => {
    const t = o.t;
    osc(o, 'sine', 820, 760, t, 0.001, 0.4, 0.08);
    noise(o, t, 0.001, 0.15, 0.015, { type: 'bandpass', f: 2500, q: 2 });
  }, 0.1],
  page: [(o) => {
    noise(o, o.t, 0.03, 0.12, 0.16, { type: 'bandpass', f: 2600, q: 0.8, f1: 4200 });
    noise(o, o.t + 0.07, 0.02, 0.07, 0.12, { type: 'bandpass', f: 3800, q: 1 });
  }, 0.05],
  coin: [(o) => {
    for (let i = 0; i < 3 + Math.floor(R() * 3); i++) {
      const t = o.t + i * rr(0.04, 0.08), f = rr(2400, 3600);
      osc(o, 'sine', f, null, t, 0.001, 0.12, 0.22);
      osc(o, 'sine', f * 2.7, null, t, 0.001, 0.04, 0.1);
    }
  }, 0.15],
  bell: [(o) => {
    const t = o.t, base = 196;
    [0.5, 1, 1.19, 1.5, 2, 2.74, 3.0, 4.07].forEach((r, i) => osc(o, 'sine', base * r, null, t, 0.003, 0.12 / Math.pow(i + 1, 0.4), 3.2 / (1 + i * 0.2)));
  }, 0.5],
  levelup: [(o) => {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((f, i) => pluck(o, o.t + i * 0.07, f, 0.5, { bright: 0.7 }));
    pluck(o, o.t + 0.5, 1046.5, 0.4, { bright: 0.6, bend: 1.03 });
  }, 0.4],
  quest: [(o) => {
    [659.25, 783.99, 1046.5].forEach((f, i) => pluck(o, o.t + i * 0.12, f, 0.5, { bright: 0.65 }));
  }, 0.4],
  victory: [(o) => {
    const t = o.t;
    for (let i = 0; i < 3; i++) { osc(o, 'sine', 88, 46, t + i * 0.22, 0.003, 0.8, 0.5, 0.3); }
    const g2: Out = { ...o, t: t + 0.7 };
    RECIPES.gong[0](g2, {});
    [392, 440, 523.25, 587.33, 659.25, 783.99].forEach((f, i) => pluck(o, t + 0.75 + i * 0.09, f, 0.45, { bright: 0.7 }));
  }, 0.5],
  defeat: [(o) => {
    RECIPES.gongLow[0](o, {});
    [440, 392, 329.63, 293.66].forEach((f, i) => pluck(o, o.t + 0.6 + i * 0.35, f / 2, 0.5, { bright: 0.35, bend: i === 3 ? 0.97 : undefined }));
  }, 0.6],
  neigh: [(o) => {
    const t = o.t, f = rr(500, 650);
    voice(o, t, f, [[0.1, f * 1.3], [0.35, f * 1.1], [0.7, f * 0.6]], [[1100, 5], [2300, 6]], 0.12, 0.8);
  }, 0.2],
  gallop: [(o) => {
    const { c } = o;
    const s = c.createBufferSource(); s.buffer = gallopBuffer(c);
    const g = env(c, o.t, 0.05, 0.6, 1.2, 0.6);
    s.connect(g); g.connect(o.node); s.start(o.t, R() * 1.0); s.stop(o.t + 2);
  }, 0.1],
  fall: [(o) => {
    noise(o, o.t, 0.005, 0.55, 0.16, { type: 'lowpass', f: 500 }, true);
    osc(o, 'sine', 90, 45, o.t, 0.002, 0.35, 0.15);
  }, 0.1],
  error: [(o) => {
    osc(o, 'square', 220, 180, o.t, 0.002, 0.08, 0.15);
  }, 0.02],
};

// 响度校准（离线渲染测得峰值后调整）
const TRIM: Partial<Record<SfxName, number>> = { clash: 0.6, gun: 0.55, cannon: 0.5, armor: 0.85, xbow: 0.85, death: 2.4, neigh: 3.5, crowd: 2.6, swing: 1.8, page: 1.6, shout: 1.3, arrowGround: 1.5, error: 1.5 };

// ---------- 节流 ----------
const LIMIT: Partial<Record<SfxName, number>> = { clash: 4, armor: 4, hit: 4, block: 3, swing: 3, bow: 4, xbow: 3, arrowHit: 4, arrowGround: 3, gun: 5, death: 2, shout: 3, fall: 2, click: 2, coin: 1, page: 1, gallop: 1, neigh: 1 };
const recent = new Map<SfxName, number[]>();

export function sfx(name: SfxName, opts: SfxOpts = {}) {
  if (engine.settings.muted) return;
  const lim = LIMIT[name];
  const c = engine.ctx;
  if (!c || c.state !== 'running') return;
  if (lim) {
    const now = c.currentTime;
    const arr = (recent.get(name) ?? []).filter(x => now - x < 0.12);
    if (arr.length >= lim) { recent.set(name, arr); return; }
    arr.push(now); recent.set(name, arr);
  }
  const [fn, verb] = RECIPES[name];
  const o = makeOut({ ...opts, vol: (opts.vol ?? 1) * (TRIM[name] ?? 1) }, verb);
  if (!o) return;
  try { fn(o, opts); } catch { /* 忽略合成错误 */ }
}
