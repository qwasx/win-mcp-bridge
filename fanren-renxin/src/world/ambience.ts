// 第三十三步：环境声（全合成）—— 风、雨、海潮、遁风、市声，以及鸟鸣、虫唱、海鸥、夜枭、蛙鼓
// 持续层用循环噪声 + 滤波，音量随天气 / 地形 / 昼夜平滑过渡；点缀层按概率随机触发、随机声像。
import type { AudioEngine } from './audio';

export interface AmbState {
  wind: number; rain: number; storm: number; snow: number; sand: number;
  fly: number; boost: number; sea: number; shore: number; town: number;
  forest: number; night: number; season: number; cold: number; demon: number; water: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambience {
  e: AudioEngine;
  private layers: Record<string, { g: GainNode; f?: BiquadFilterNode; f2?: BiquadFilterNode; p?: StereoPannerNode }> = {};
  private tBird = 2; private tCricket = 1; private tGull = 6; private tOwl = 20; private tFrog = 3; private tBabble = 1; private tDrip = 0.3;
  private swell = 0;

  constructor(e: AudioEngine) {
    this.e = e;
    const c = e.ctx!;
    // 风：带通噪声，中心频率慢慢游移
    this.layers.wind = this.loop(e.noise, 'bandpass', 420, 0.7, true);
    // 遁风：高处的呼啸
    this.layers.rush = this.loop(e.noise, 'bandpass', 900, 0.9, false, 'highpass', 300);
    // 雨
    this.layers.rain = this.loop(this.rainBuf(), 'highpass', 500, 0.5);
    this.layers.storm = this.loop(e.noise, 'lowpass', 160, 0.7);
    // 海潮：低通噪声，音量由 swell 推动
    this.layers.sea = this.loop(e.noise, 'lowpass', 520, 0.6, false, 'highpass', 80);
    // 市声：人声频段的噪声，不规则起伏
    this.layers.town = this.loop(e.noise, 'bandpass', 600, 1.4);
    // 魔气：低沉的嗡鸣
    const g = c.createGain(); g.gain.value = 0;
    const o1 = c.createOscillator(), o2 = c.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55 * 1.013;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(e.ambBus); o1.start(); o2.start();
    this.layers.demon = { g, f: lp };
  }

  private loop(buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, pan = false, type2?: BiquadFilterType, f2v?: number) {
    const c = this.e.ctx!;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    let tail: AudioNode = fl;
    let f2: BiquadFilterNode | undefined;
    s.connect(fl);
    if (type2) { f2 = c.createBiquadFilter(); f2.type = type2; f2.frequency.value = f2v ?? 200; fl.connect(f2); tail = f2; }
    tail.connect(g);
    let p: StereoPannerNode | undefined;
    if (pan) { p = c.createStereoPanner(); g.connect(p); p.connect(this.e.ambBus); } else g.connect(this.e.ambBus);
    s.start(0, Math.random() * buf.duration);
    return { g, f: fl, f2, p };
  }

  /** 雨声：粉红噪声底 + 随机雨滴（短促的高频衰减振荡） */
  private rainBuf() {
    const c = this.e.ctx!, sr = c.sampleRate, len = sr * 3;
    const b = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
      }
      for (let k = 0; k < 900; k++) {
        const at = (Math.random() * (len - 600)) | 0, f = rnd(1800, 6500), dec = rnd(0.002, 0.007), a = rnd(0.05, 0.35);
        const n = Math.floor(dec * sr * 4);
        for (let i = 0; i < n; i++) d[at + i] += Math.sin(i / sr * f * Math.PI * 2) * Math.exp(-i / (dec * sr)) * a;
      }
      // 首尾交叉淡化，循环不跳
      const xf = Math.floor(sr * 0.1);
      for (let i = 0; i < xf; i++) { const k = i / xf; d[i] = d[i] * k + d[len - xf + i] * (1 - k); }
    }
    return b;
  }

  private set(name: string, v: number, tc = 0.8) {
    const L = this.layers[name]; if (!L) return;
    L.g.gain.setTargetAtTime(Math.max(0, v), this.e.now, tc);
  }

  update(s: AmbState, dt: number) {
    const e = this.e, t = e.now;
    // 风
    const wind = 0.012 + s.wind * 0.05 + s.cold * 0.02 + s.sand * 0.07 + s.storm * 0.05 + s.fly * 0.015;
    this.set('wind', wind, 1.2);
    const W = this.layers.wind;
    if (W.f) W.f.frequency.setTargetAtTime(300 + Math.sin(t * 0.13) * 140 + Math.sin(t * 0.37) * 90 + s.wind * 260 + s.sand * 300, t, 0.5);
    if (W.p) W.p.pan.setTargetAtTime(Math.sin(t * 0.07) * 0.5, t, 0.5);
    // 遁风
    this.set('rush', s.fly * (0.025 + s.boost * 0.07), 0.3);
    if (this.layers.rush.f) this.layers.rush.f.frequency.setTargetAtTime(700 + s.boost * 900 + Math.sin(t * 2.3) * 120, t, 0.2);
    // 雨 / 雷暴
    this.set('rain', s.rain * 0.22, 1.5);
    this.set('storm', s.storm * 0.12, 1.5);
    // 海潮：慢浪 + 拍岸
    this.swell += dt * (0.55 + Math.sin(t * 0.05) * 0.15);
    const sw = 0.5 + 0.5 * Math.sin(this.swell);
    this.set('sea', (s.sea * 0.05 + s.shore * 0.07) * (0.35 + sw * 0.65), 0.6);
    if (this.layers.sea.f) this.layers.sea.f.frequency.setTargetAtTime(300 + sw * 600, t, 0.6);
    // 市声
    const babK = s.town * (s.night > 0.6 ? 0.35 : 1);
    this.tBabble -= dt;
    if (this.tBabble <= 0) { this.tBabble = rnd(0.12, 0.45); this.set('town', babK * rnd(0.008, 0.03), 0.12); if (this.layers.town.f) this.layers.town.f.frequency.setTargetAtTime(rnd(350, 900), t, 0.1); }
    // 魔气
    this.set('demon', s.demon * 0.05, 2);

    // ---------------- 点缀
    const clear = s.rain < 0.15 && s.storm < 0.1 && s.snow < 0.5;
    const land = s.sea < 0.5;
    // 鸟鸣（白昼、林野、晴）
    this.tBird -= dt;
    if (this.tBird <= 0) {
      this.tBird = rnd(1.5, 5) / (0.4 + s.forest);
      if (land && clear && s.night < 0.35 && s.cold < 0.6 && s.town < 0.6 && s.fly < 0.5 && s.season !== 3) this.bird(s.forest);
    }
    // 虫唱（夜、暖季）
    this.tCricket -= dt;
    if (this.tCricket <= 0) {
      this.tCricket = rnd(0.5, 1.6);
      if (land && s.night > 0.55 && s.season !== 3 && s.cold < 0.45 && s.rain < 0.5 && s.fly < 0.5) this.cricket();
    }
    // 蛙鼓（夜、近水、春夏）
    this.tFrog -= dt;
    if (this.tFrog <= 0) {
      this.tFrog = rnd(0.8, 3);
      if (s.water > 0.3 && s.night > 0.5 && (s.season === 0 || s.season === 1) && s.fly < 0.5) this.frog();
    }
    // 夜枭（深夜林中）
    this.tOwl -= dt;
    if (this.tOwl <= 0) { this.tOwl = rnd(18, 45); if (s.night > 0.7 && s.forest > 0.3 && land) this.owl(); }
    // 海鸥（海上 / 岸边，白昼）
    this.tGull -= dt;
    if (this.tGull <= 0) { this.tGull = rnd(5, 14); if ((s.sea > 0.3 || s.shore > 0.3) && s.night < 0.4 && clear) this.gull(); }
    // 屋檐滴水（雨后）
    this.tDrip -= dt;
    if (this.tDrip <= 0) { this.tDrip = rnd(0.15, 0.6); if (s.rain > 0.3 && s.town > 0.3) this.drip(); }
  }

  private dst(pan: number, vol: number) { return this.e.out(vol, pan, 0.3, 'amb'); }

  /** 鸟：调频啁啾，三五声一串 */
  private bird(forest: number) {
    const e = this.e, c = e.ctx!, t = e.now + 0.05;
    const d = this.dst(rnd(-0.8, 0.8), rnd(0.03, 0.07) * (0.6 + forest * 0.6));
    const kind = Math.floor(Math.random() * 3);
    const n = kind === 2 ? 1 : 2 + Math.floor(Math.random() * 4);
    const f0 = rnd(2400, 4200);
    for (let i = 0; i < n; i++) {
      const tt = t + i * rnd(0.08, 0.16), dur = kind === 2 ? 0.5 : rnd(0.05, 0.11);
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      if (kind === 0) { o.frequency.setValueAtTime(f0 * 1.3, tt); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, tt + dur); }
      else if (kind === 1) { o.frequency.setValueAtTime(f0 * 0.8, tt); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, tt + dur); }
      else { o.frequency.setValueAtTime(f0, tt); o.frequency.linearRampToValueAtTime(f0 * 1.2, tt + 0.1); o.frequency.linearRampToValueAtTime(f0 * 0.75, tt + dur); }
      // 调频颤动
      const m = c.createOscillator(), mg = c.createGain(); m.frequency.value = rnd(30, 70); mg.gain.value = f0 * 0.06; m.connect(mg); mg.connect(o.frequency);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(1, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, tt + dur);
      o.connect(g); g.connect(d); o.start(tt); m.start(tt); o.stop(tt + dur + 0.02); m.stop(tt + dur + 0.02);
    }
  }
  /** 蟋蟀：4.5kHz 的快速振幅调制短串 */
  private cricket() {
    const e = this.e, c = e.ctx!, t = e.now + 0.05;
    const d = this.dst(rnd(-0.9, 0.9), rnd(0.008, 0.02));
    const f = rnd(4200, 5200), reps = 2 + Math.floor(Math.random() * 3);
    for (let r = 0; r < reps; r++) {
      const tt = t + r * 0.22, dur = 0.12;
      const o = c.createOscillator(), g = c.createGain(), am = c.createOscillator(), ag = c.createGain();
      o.frequency.value = f; am.frequency.value = rnd(28, 40); ag.gain.value = 0.5;
      const base = c.createGain(); base.gain.value = 0.5;
      am.connect(ag); ag.connect(base.gain);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(1, tt + 0.01); g.gain.setValueAtTime(1, tt + dur - 0.02); g.gain.linearRampToValueAtTime(0, tt + dur);
      o.connect(base); base.connect(g); g.connect(d);
      o.start(tt); am.start(tt); o.stop(tt + dur + 0.02); am.stop(tt + dur + 0.02);
    }
  }
  private frog() {
    const e = this.e, t = e.now + 0.05;
    const d = this.dst(rnd(-0.8, 0.8), rnd(0.03, 0.06));
    const n = 2 + Math.floor(Math.random() * 3), f = rnd(180, 320);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.13;
      e.tone('square', f, tt, 0.08, 0.3, d, f * 0.85, 0.005);
      e.tone('sine', f * 2, tt, 0.06, 0.2, d, f * 1.7, 0.005);
    }
  }
  // ---------------------------------------------------------------- v0.48 意境点景配音（mood.ts 调用）
  /** 雁鸣：远处一行秋雁，"嘎——嘎" 带鼻音的短促双音，此起彼伏 */
  geese(pan = 0) {
    const e = this.e, c = e.ctx; if (!c) return;
    const t0 = e.now + 0.05;
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const tt = t0 + i * rnd(0.28, 0.55), d = this.dst(Math.max(-1, Math.min(1, pan + rnd(-0.25, 0.25))), rnd(0.025, 0.045)), f = rnd(520, 640);
      const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
      o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 3;
      o.frequency.setValueAtTime(f * 0.92, tt); o.frequency.linearRampToValueAtTime(f, tt + 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.78, tt + 0.22);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.5, tt + 0.03); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.24);
      o.connect(bp); bp.connect(g); g.connect(d); o.start(tt); o.stop(tt + 0.26);
    }
  }
  /** 橹声：木橹摇动的"吱——呀"，低沉、缓慢 */
  oar() {
    const e = this.e, t = e.now + 0.05, d = this.dst(rnd(-0.6, 0.6), 0.035);
    e.tone('triangle', 180, t, 0.5, 0.35, d, 140, 0.12);
    e.tone('triangle', 150, t + 0.75, 0.45, 0.25, d, 120, 0.12);
  }
  /** 晨钟：远山道观的一杵钟，长尾泛音 */
  bell() {
    const e = this.e, t = e.now + 0.05, d = this.dst(rnd(-0.4, 0.4), 0.05);
    for (const [f, v, l] of [[196, 0.5, 4.5], [392 * 1.01, 0.22, 3.2], [588 * 0.99, 0.12, 2.4], [880, 0.05, 1.6]] as const) e.tone('sine', f, t, l, v, d, f * 0.995, 0.004);
  }
  /** 暮鼓：三通闷鼓 */
  drum() {
    const e = this.e, t = e.now + 0.05, d = this.dst(rnd(-0.4, 0.4), 0.05);
    for (let i = 0; i < 3; i++) e.tone('sine', 90, t + i * 0.9, 0.7, 0.7, d, 48, 0.004);
  }
  private owl() {
    const e = this.e, t = e.now + 0.05, d = this.dst(rnd(-0.7, 0.7), 0.05);
    [0, 0.55, 0.8].forEach((o, i) => { e.tone('sine', i === 0 ? 420 : 380, t + o, i === 0 ? 0.45 : 0.25, 0.6, d, i === 0 ? 360 : 340, 0.06); });
  }
  private gull() {
    const e = this.e, c = e.ctx!, t = e.now + 0.05, d = this.dst(rnd(-0.8, 0.8), rnd(0.03, 0.05));
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.32, o = c.createOscillator(), g = c.createGain(), f = rnd(1100, 1400);
      o.type = 'sawtooth';
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2;
      o.frequency.setValueAtTime(f, tt); o.frequency.linearRampToValueAtTime(f * 1.15, tt + 0.06); o.frequency.exponentialRampToValueAtTime(f * 0.6, tt + 0.3);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.6, tt + 0.03); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.3);
      o.connect(bp); bp.connect(g); g.connect(d); o.start(tt); o.stop(tt + 0.32);
    }
  }
  private drip() {
    const e = this.e, t = e.now + 0.02, d = this.dst(rnd(-0.8, 0.8), rnd(0.02, 0.05)), f = rnd(900, 1800);
    e.tone('sine', f, t, 0.08, 0.6, d, f * 1.8, 0.001);
  }
}
