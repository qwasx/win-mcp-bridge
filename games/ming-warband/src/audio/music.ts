// 程序生成的古风配乐 + 环境音
// 五声音阶旋律生成器 + 古筝（拨弦合成）、笛/箫、二胡、琵琶轮指、笙、战鼓、锣、梆子
import { engine } from './engine';
import { pluckBuffer, gallopBuffer } from './sfx';

export type MusicMode = 'off' | 'menu' | 'world' | 'night' | 'battle' | 'siege';
type Amb = 'none' | 'day' | 'night' | 'battle';

const R = Math.random;
const rr = (a: number, b: number) => a + R() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const MODES = { gong: [0, 2, 4, 7, 9], shang: [0, 2, 5, 7, 10], zhi: [0, 2, 5, 7, 9], yu: [0, 3, 5, 7, 10] };
function deg(scale: number[], d: number) { const n = scale.length; const o = Math.floor(d / n); return scale[((d % n) + n) % n] + 12 * o; }

// ---------- 乐器 ----------
type Dest = AudioNode;

function zheng(c: AudioContext, out: Dest, t: number, m: number, vol: number, bend?: number, bright = 0.55) {
  const s = c.createBufferSource(); s.buffer = pluckBuffer(c, mtof(m), 2.6, bright);
  if (bend) { s.playbackRate.setValueAtTime(1, t + 0.15); s.playbackRate.linearRampToValueAtTime(bend, t + 0.4); s.playbackRate.linearRampToValueAtTime(1, t + 0.8); }
  const g = c.createGain(); g.gain.value = vol;
  const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 300; body.gain.value = 5; body.Q.value = 1;
  s.connect(body); body.connect(g); g.connect(out);
  s.start(t); s.stop(t + 2.6);
}

function wind(c: AudioContext, out: Dest, t: number, m: number, dur: number, vol: number, kind: 'dizi' | 'xiao', grace?: number, from?: number) {
  const f = mtof(m);
  const o1 = c.createOscillator(); o1.type = 'sine';
  const o2 = c.createOscillator(); o2.type = 'triangle';
  for (const o of [o1, o2]) {
    if (from) { o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
    else if (grace) { o.frequency.setValueAtTime(mtof(grace), t); o.frequency.setValueAtTime(f, t + 0.065); }
    else o.frequency.setValueAtTime(f, t);
  }
  const vib = c.createOscillator(); vib.frequency.value = kind === 'dizi' ? 5.6 : 4.6;
  const vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * (kind === 'dizi' ? 0.011 : 0.008), t + Math.min(0.5, dur * 0.6));
  vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
  const g2 = c.createGain(); g2.gain.value = kind === 'dizi' ? 0.22 : 0.06;
  const g = c.createGain();
  const a = kind === 'dizi' ? 0.05 : 0.12;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(a, dur - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  o1.connect(g); o2.connect(g2); g2.connect(g);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'dizi' ? 4200 : 1800;
  g.connect(lp); lp.connect(out);
  // 气声
  const ns = c.createBufferSource(); ns.buffer = engine.noise;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 2.5;
  const ng = c.createGain(); const nv = vol * (kind === 'dizi' ? 0.22 : 0.45);
  ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(nv, t + a * 0.7); ng.gain.exponentialRampToValueAtTime(nv * 0.3, t + dur * 0.7 + 0.05); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  ns.connect(bp); bp.connect(ng); ng.connect(out);
  const end = t + dur + 0.15;
  o1.start(t); o2.start(t); vib.start(t); ns.start(t, R()); o1.stop(end); o2.stop(end); vib.stop(end); ns.stop(end);
}

function erhu(c: AudioContext, out: Dest, t: number, m: number, dur: number, vol: number, from?: number) {
  const f = mtof(m);
  const o = c.createOscillator(); o.type = 'sawtooth';
  if (from) { o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); } else o.frequency.setValueAtTime(f, t);
  const vib = c.createOscillator(); vib.frequency.value = 5.8;
  const vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.016, t + Math.min(0.6, dur * 0.7));
  vib.connect(vg); vg.connect(o.frequency);
  const f1 = c.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 1050; f1.gain.value = 8; f1.Q.value = 2;
  const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 3000;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12);
  g.gain.linearRampToValueAtTime(vol * 1.1, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  o.connect(hp); hp.connect(f1); f1.connect(f2); f2.connect(g); g.connect(out);
  o.start(t); vib.start(t); o.stop(t + dur + 0.2); vib.stop(t + dur + 0.2);
}

function pipaTrem(c: AudioContext, out: Dest, t: number, m: number, dur: number, vol: number) {
  const n = Math.floor(dur * 13);
  for (let i = 0; i < n; i++) zheng(c, out, t + i / 13 + rr(-0.004, 0.004), m, vol * (i % 2 ? 0.7 : 1) * (1 - i / n * 0.3), undefined, 0.75);
}

function sheng(c: AudioContext, out: Dest, t: number, ms: number[], dur: number, vol: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
  lp.connect(g); g.connect(out);
  for (const m of ms) for (const det of [-4, 4]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    const og = c.createGain(); og.gain.value = 0.25 / ms.length;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
  }
}

function drone(c: AudioContext, out: Dest, t: number, m: number, dur: number, vol: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  for (const [k, v] of [[0, 1], [7, 0.5], [12, 0.25]]) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m + k);
    const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
}

function bigDrum(c: AudioContext, out: Dest, t: number, vol: number) {
  const o = c.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(rr(80, 88), t); o.frequency.exponentialRampToValueAtTime(44, t + 0.3);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6);
  const n = c.createBufferSource(); n.buffer = engine.noise;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const ng = c.createGain(); ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t, R()); n.stop(t + 0.1);
}
function smallDrum(c: AudioContext, out: Dest, t: number, vol: number) {
  const o = c.createOscillator(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.1);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
  const n = c.createBufferSource(); n.buffer = engine.noise;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700;
  const ng = c.createGain(); ng.gain.setValueAtTime(vol * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t, R()); n.stop(t + 0.08);
}
function bangzi(c: AudioContext, out: Dest, t: number, vol: number) {
  const o = c.createOscillator(); o.frequency.value = 1250;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06);
}
function cymbal(c: AudioContext, out: Dest, t: number, vol: number, len = 1.2) {
  const n = c.createBufferSource(); n.buffer = engine.noise;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(hp); hp.connect(g); g.connect(out); n.start(t, R()); n.stop(t + len + 0.05);
  for (const r of [1, 1.41, 1.83, 2.37]) {
    const o = c.createOscillator(); o.frequency.value = 520 * r;
    const og = c.createGain(); og.gain.setValueAtTime(vol * 0.15, t); og.gain.exponentialRampToValueAtTime(0.0001, t + len * 0.8);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + len);
  }
}
function gong(c: AudioContext, out: Dest, t: number, vol: number, base = 100) {
  [1, 1.52, 2.29, 2.95, 3.71].forEach((r, i) => {
    const o = c.createOscillator(); o.frequency.setValueAtTime(base * r, t); o.frequency.linearRampToValueAtTime(base * r * 0.985, t + 2);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol / Math.pow(i + 1, 0.5), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 4 / (1 + i * 0.25));
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 4.2);
  });
}

// ---------- 旋律生成 ----------
class Melody {
  d: number;
  constructor(public lo: number, public hi: number, start: number) { this.d = start; }
  step() {
    const w: [number, number][] = [[-1, 4], [1, 4], [0, 1], [-2, 2], [2, 2], [3, 1], [-3, 1]];
    let tot = 0; for (const [, x] of w) tot += x;
    let r = R() * tot, s = 0;
    for (const [dd, x] of w) { r -= x; if (r <= 0) { s = dd; break; } }
    let nd = this.d + s;
    if (nd < this.lo) nd = this.lo + 1; if (nd > this.hi) nd = this.hi - 1;
    this.d = nd; return nd;
  }
}
const RHYTHMS = [[1, 0.5, 0.5, 2], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 2], [1, 1, 2], [2, 1, 1], [0.5, 0.5, 0.5, 0.5, 2], [1, 0.5, 0.5, 1, 1]];

// ---------- 曲目 ----------
interface Track { mode: MusicMode; bus: GainNode; next: number; bar: number; spb: number; render(t: number): void }

function makeTrack(c: AudioContext, mode: MusicMode): Track {
  const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(engine.music);
  const verbSend = c.createGain(); verbSend.gain.value = 0.55; bus.connect(verbSend); verbSend.connect(engine.verbIn);
  const tr: Track = { mode, bus, next: c.currentTime + 0.15, bar: 0, spb: 1, render: () => {} };
  if (mode === 'world') {
    const scale = MODES.gong, tonic = 53; // F
    const mel = new Melody(4, 13, 7);
    tr.spb = 60 / 76;
    const progs = [[0, 3, 4, 0], [0, 2, 3, 0], [0, 4, 3, 2], [0, 3, 1, 0]];
    let prog = progs[0];
    tr.render = (t) => {
      const b = tr.bar, spb = tr.spb;
      if (b % 4 === 0) prog = pick(progs);
      const r = prog[b % 4];
      // 古筝分解和弦
      const pat = [r - 5, r, r + 2, r + 3, r + 5, r + 3, r + 2, r];
      pat.forEach((d, i) => { if (i > 0 && R() < 0.12) return; zheng(c, bus, t + i * spb / 2 + rr(0, 0.01), tonic + deg(scale, d), i === 0 ? 0.32 : 0.2); });
      if (b % 8 === 0) { const g0 = Math.max(c.currentTime + 0.01, t - 0.3); for (let k = 0; k < 9; k++) zheng(c, bus, g0 + k * 0.03, tonic + deg(scale, r + k), 0.12, undefined, 0.7); } // 刮奏
      if (b % 8 === 0) drone(c, bus, t, tonic - 12, spb * 16, 0.03);
      // 旋律：笛子与高音古筝交替
      const section = Math.floor(b / 4) % 4;
      if ((b % 4 === 1 || b % 4 === 2) && section !== 3) {
        const rh = pick(RHYTHMS); let bt = 0; let prev: number | undefined;
        for (const du of rh) {
          const d = (bt + du >= 4 && b % 4 === 2) ? pick([7, 10, 9]) : mel.step();
          const m = tonic + 12 + deg(scale, d);
          if (section % 2 === 0) wind(c, bus, t + bt * spb, m, du * spb * 0.95, 0.16, 'dizi', R() < 0.25 ? m + 2 : undefined, R() < 0.2 ? prev : undefined);
          else zheng(c, bus, t + bt * spb, m, 0.34, du >= 2 && R() < 0.5 ? 1.06 : undefined, 0.65);
          prev = m; bt += du;
        }
      }
    };
  } else if (mode === 'night') {
    const scale = MODES.yu, tonic = 57; // A
    const mel = new Melody(3, 11, 5);
    tr.spb = 60 / 54;
    tr.render = (t) => {
      const b = tr.bar, spb = tr.spb;
      if (b % 4 === 0) drone(c, bus, t, tonic - 12, spb * 16, 0.028);
      const r = pick([0, 0, 3, 2]);
      zheng(c, bus, t, tonic - 12 + deg(scale, r), 0.22, undefined, 0.4);
      if (R() < 0.6) zheng(c, bus, t + spb * 2, tonic + deg(scale, r + 2), 0.14, undefined, 0.4);
      if (b % 2 === 1) {
        const rh = pick([[2, 2], [3, 1], [1, 1, 2], [4]]); let bt = 0; let prev: number | undefined;
        for (const du of rh) { const m = tonic + deg(scale, mel.step()); wind(c, bus, t + bt * spb, m, du * spb * 0.95, 0.14, 'xiao', undefined, R() < 0.35 ? prev : undefined); prev = m; bt += du; }
      }
    };
  } else if (mode === 'menu') {
    const scale = MODES.yu, tonic = 50; // D
    const mel = new Melody(5, 13, 8);
    tr.spb = 60 / 62;
    tr.render = (t) => {
      const b = tr.bar, spb = tr.spb;
      const prog = [0, 3, 2, 0, 4, 3, 1, 0];
      const r = prog[b % 8];
      if (b % 8 === 0) { gong(c, bus, t, 0.09, 92); bigDrum(c, bus, t, 0.35); }
      if (b % 2 === 0) sheng(c, bus, t, [tonic + deg(scale, r), tonic + deg(scale, r + 2), tonic + deg(scale, r + 3)], spb * 8, 0.05);
      for (let i = 0; i < 4; i++) zheng(c, bus, t + i * spb + rr(0, 0.01), tonic - 12 + deg(scale, r + [0, 3, 5, 3][i]), 0.2, undefined, 0.45);
      if (b % 4 === 2) bigDrum(c, bus, t + spb * 3.5, 0.18);
      if (b >= 2 && b % 8 !== 7) {
        const rh = pick([[2, 1, 1], [3, 1], [1.5, 0.5, 2], [4]]); let bt = 0; let prev: number | undefined;
        for (const du of rh) { const m = tonic + 12 + deg(scale, mel.step()); erhu(c, bus, t + bt * spb, m, du * spb * 0.98, 0.1, R() < 0.4 ? prev : undefined); prev = m; bt += du; }
      }
    };
  } else if (mode === 'battle' || mode === 'siege') {
    const siege = mode === 'siege';
    const scale = MODES.shang, tonic = 50; // D
    const mel = new Melody(5, 14, 8);
    tr.spb = 60 / (siege ? 104 : 132);
    const pats = siege
      ? [[1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]]
      : [[1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1]];
    tr.render = (t) => {
      const b = tr.bar, spb = tr.spb, st = spb / 4;
      const pat = b % 4 === 3 ? pats[1] : pats[0];
      pat.forEach((x, i) => { if (x) bigDrum(c, bus, t + i * st, i % 8 === 0 ? 0.55 : 0.38); });
      for (let i = 0; i < 16; i++) if (i % 2 === 1 || (b % 4 === 3 && i > 11)) smallDrum(c, bus, t + i * st, 0.07 + (i % 4 === 3 ? 0.05 : 0));
      if (!siege) for (let i = 0; i < 8; i++) bangzi(c, bus, t + i * spb / 2, i % 2 ? 0.03 : 0.06);
      if (b % 8 === 0) { cymbal(c, bus, t, 0.12, 1.6); gong(c, bus, t, 0.08, 105); }
      if (b % 4 === 0) drone(c, bus, t, tonic - 12, spb * 16, 0.04);
      // 旋律：琵琶轮指 / 攻城时二胡
      if (b % 8 >= 2) {
        const rh = pick([[2, 2], [1, 1, 2], [3, 1], [2, 1, 1]]); let bt = 0; let prev: number | undefined;
        for (const du of rh) {
          const m = tonic + 12 + deg(scale, mel.step());
          if (siege) erhu(c, bus, t + bt * spb, m, du * spb * 0.97, 0.09, R() < 0.3 ? prev : undefined);
          else pipaTrem(c, bus, t + bt * spb, m, du * spb * 0.95, 0.13);
          prev = m; bt += du;
        }
      } else {
        for (let i = 0; i < 8; i++) zheng(c, bus, t + i * spb / 2, tonic + deg(scale, [0, 0, 3, 0, 4, 0, 3, 2][i]), 0.18, undefined, 0.8);
      }
    };
  }
  return tr;
}

// ---------- 环境音 ----------
class Ambience {
  kind: Amb = 'none';
  bus: GainNode | null = null;
  windG: GainNode | null = null;
  roarG: GainNode | null = null;
  gallopG: GainNode | null = null;
  rainG: GainNode | null = null;
  rainK = 0;
  nextEvt = 0;
  start(c: AudioContext) {
    if (this.bus) return;
    this.bus = c.createGain(); this.bus.connect(engine.amb);
    // 风
    const w = c.createBufferSource(); w.buffer = engine.brown; w.loop = true;
    const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 420;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.04; lfo.connect(lg); lg.connect(this.windG.gain);
    w.connect(wl); wl.connect(this.windG); this.windG.connect(this.bus); w.start(); lfo.start();
    // 战场喧嚣
    const n = c.createBufferSource(); n.buffer = engine.noise; n.loop = true;
    const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 520; b1.Q.value = 0.8;
    const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 1300; b2.Q.value = 1.2;
    const rl = c.createOscillator(); rl.frequency.value = 0.9; const rg = c.createGain(); rg.gain.value = 300; rl.connect(rg); rg.connect(b2.frequency);
    this.roarG = c.createGain(); this.roarG.gain.value = 0;
    n.connect(b1); n.connect(b2); b1.connect(this.roarG); const b2g = c.createGain(); b2g.gain.value = 0.5; b2.connect(b2g); b2g.connect(this.roarG);
    this.roarG.connect(this.bus); n.start(); rl.start();
    const gs = c.createBufferSource(); gs.buffer = gallopBuffer(c); gs.loop = true;
    this.gallopG = c.createGain(); this.gallopG.gain.value = 0;
    gs.connect(this.gallopG); this.gallopG.connect(this.bus); gs.start();
    // 雨声：高通白噪 + 低频的“哗哗”
    const rn = c.createBufferSource(); rn.buffer = engine.noise; rn.loop = true; rn.playbackRate.value = 0.93;
    const rh = c.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 900;
    const rl2 = c.createBiquadFilter(); rl2.type = 'lowpass'; rl2.frequency.value = 7000;
    const rb = c.createBufferSource(); rb.buffer = engine.brown; rb.loop = true;
    const rbf = c.createBiquadFilter(); rbf.type = 'lowpass'; rbf.frequency.value = 700;
    const rbg = c.createGain(); rbg.gain.value = 0.8;
    this.rainG = c.createGain(); this.rainG.gain.value = 0;
    rn.connect(rh); rh.connect(rl2); rl2.connect(this.rainG); rb.connect(rbf); rbf.connect(rbg); rbg.connect(this.rainG);
    this.rainG.connect(this.bus); rn.start(); rb.start();
  }
  weather(rain: number) {
    this.rainK = rain;
    const c = engine.ctx; if (!c || !this.rainG) return;
    this.rainG.gain.setTargetAtTime(Math.min(0.32, rain * 0.32), c.currentTime, 1.2);
  }
  set(kind: Amb) {
    this.kind = kind;
    const c = engine.ctx; if (!c || !this.bus) return;
    const t = c.currentTime;
    this.windG!.gain.setTargetAtTime(kind === 'day' ? 0.07 : kind === 'night' ? 0.05 : kind === 'battle' ? 0.05 : 0, t, 0.8);
    if (kind !== 'battle') { this.roarG!.gain.setTargetAtTime(0, t, 0.5); this.gallopG!.gain.setTargetAtTime(0, t, 0.5); }
  }
  intensity(melee: number, cav: number) {
    const c = engine.ctx; if (!c || !this.roarG || this.kind !== 'battle') return;
    const t = c.currentTime;
    this.roarG.gain.setTargetAtTime(Math.min(0.5, melee * 0.012), t, 0.4);
    this.gallopG!.gain.setTargetAtTime(Math.min(0.9, cav * 0.06), t, 0.3);
  }
  tick(c: AudioContext) {
    if (!this.bus || c.currentTime < this.nextEvt) return;
    const t = c.currentTime + 0.05;
    if (this.kind === 'day' && this.rainK < 0.2) {
      // 鸟鸣
      const base = rr(2400, 4200), n = 2 + Math.floor(R() * 5), pan = rr(-0.8, 0.8);
      const p = c.createStereoPanner(); p.pan.value = pan; p.connect(this.bus);
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(); const tt = t + i * rr(0.08, 0.16);
        o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * rr(1.2, 1.6), tt + 0.05); o.frequency.exponentialRampToValueAtTime(base * 0.9, tt + 0.09);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.025, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
        o.connect(g); g.connect(p); o.start(tt); o.stop(tt + 0.12);
      }
      this.nextEvt = c.currentTime + rr(2.5, 7);
    } else if (this.kind === 'night' && this.rainK < 0.2) {
      // 虫鸣
      const f = rr(4200, 5200), pan = rr(-0.9, 0.9);
      const p = c.createStereoPanner(); p.pan.value = pan; p.connect(this.bus);
      for (let k = 0; k < 3; k++) {
        const tt = t + k * 0.35;
        const o = c.createOscillator(); o.frequency.value = f;
        const am = c.createOscillator(); am.type = 'square'; am.frequency.value = rr(28, 40);
        const amg = c.createGain(); amg.gain.value = 0.5; am.connect(amg);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.012, tt + 0.03); g.gain.setValueAtTime(0.012, tt + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.25);
        const vca = c.createGain(); vca.gain.value = 0.5; amg.connect(vca.gain);
        o.connect(vca); vca.connect(g); g.connect(p);
        o.start(tt); am.start(tt); o.stop(tt + 0.27); am.stop(tt + 0.27);
      }
      this.nextEvt = c.currentTime + rr(0.9, 2.6);
    } else this.nextEvt = c.currentTime + 1;
  }
}

// ---------- 调度 ----------
class MusicPlayer {
  want: MusicMode = 'off';
  cur: Track | null = null;
  amb = new Ambience();
  wantAmb: Amb = 'none';
  timer: number | null = null;
  constructor() {
    engine.onReady(() => {
      const c = engine.ctx!;
      this.amb.start(c);
      this.amb.set(this.wantAmb);
      this.amb.weather(this.wantRain);
      this.switchTo(this.want);
      if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 90);
    });
  }
  play(mode: MusicMode) {
    if (mode === this.want) return;
    this.want = mode;
    if (engine.ctx) this.switchTo(mode);
  }
  ambience(kind: Amb) { this.wantAmb = kind; this.amb.set(kind); }
  battleIntensity(melee: number, cav: number) { this.amb.intensity(melee, cav); }
  /** 雨声强度 0..1 */
  weather(rain: number) { this.wantRain = rain; this.amb.weather(rain); }
  wantRain = 0;
  private switchTo(mode: MusicMode) {
    const c = engine.ctx; if (!c) return;
    const t = c.currentTime;
    if (this.cur) {
      const old = this.cur;
      old.bus.gain.cancelScheduledValues(t); old.bus.gain.setValueAtTime(Math.max(0.0001, old.bus.gain.value), t); old.bus.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      setTimeout(() => { try { old.bus.disconnect(); } catch { /* */ } }, 8000);
      this.cur = null;
    }
    if (mode === 'off') return;
    const tr = makeTrack(c, mode);
    tr.next = t + 0.6;
    tr.bus.gain.setValueAtTime(0.0001, t); tr.bus.gain.exponentialRampToValueAtTime(1, t + 2.5);
    this.cur = tr;
  }
  private tick() {
    const c = engine.ctx; if (!c || c.state !== 'running') return;
    this.amb.tick(c);
    const tr = this.cur; if (!tr) return;
    const now = c.currentTime;
    if (tr.next < now - 0.2) tr.next = now + 0.1;
    let guard = 0;
    while (tr.next < now + 0.6 && guard++ < 4) {
      try { tr.render(tr.next); } catch { /* 忽略 */ }
      tr.next += tr.spb * 4; tr.bar++;
    }
  }
}

export const music = new MusicPlayer();
