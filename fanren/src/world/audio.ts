// 第三十三步：声音引擎（WebAudio）
// · 采样：CC0 音效与乐器（Kenney / OpenGameArt / sfzinstruments 二胡 / SP 竹笛），内联在 sfxData.ts，首次交互时解码
// · 合成：古琴（Karplus-Strong）、堂鼓、木鱼、锣、钹、钟、风雨海潮虫鸣……采样未就绪时一律退回纯合成
// · 配乐（music.ts）按场景切换并与战斗强度联动；环境声（ambience.ts）随天气 / 地形 / 昼夜；
//   声音导演（sounddir.ts）每帧扫描战斗事件，按距离与方位发声（左右声像 + 远处闷化）
import { Music } from './music';
import { Ambience } from './ambience';
import { SoundDirector } from './sounddir';

export interface PlayOpts {
  x?: number; y?: number;          // 世界坐标（给了就按距离衰减 + 声像）
  vol?: number; rate?: number; detune?: number; pan?: number;
  rev?: number;                    // 混响送量
  when?: number;                   // 绝对时间（ctx 时钟）
  gap?: number; key?: string;      // 同类声的最小间隔（秒）与节流键
  lp?: number;                     // 低通（Hz）
  bus?: 'sfx' | 'music' | 'amb';
}
export interface Voice { src: AudioBufferSourceNode; gain: GainNode; end: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const pick = <T,>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type OldKind = 'click' | 'whoosh' | 'land' | 'open' | 'chime' | 'thunder' | 'break' | 'fail' | 'gather' | 'sword' | 'boom' | 'bell' | 'clang' | 'fire' | 'gain';

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; ambBus!: GainNode;
  reverb!: ConvolverNode; revIn!: GainNode;
  enabled = true;
  musicVol = 0.55; sfxVol = 0.7;
  bufs: Record<string, AudioBuffer> = {};
  ready = false;
  /** 听者（=主角）位置与神识半径：识外之声压低 */
  lx = 0; ly = 0; hearR = 900;
  voices = 0; maxVoices = 30;
  noise!: AudioBuffer;
  music: Music | null = null;
  amb: Ambience | null = null;
  dir = new SoundDirector(this);
  private last = new Map<string, number>();
  private mode: 'title' | 'world' = 'title';

  unlock() {
    if (!this.ctx) {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
      if (!AC) return;
      const c = this.ctx = new AC() as AudioContext;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
      comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = this.enabled ? 1 : 0; this.master.connect(comp);
      this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(3.4);
      this.revIn = c.createGain(); this.revIn.gain.value = 1; this.revIn.connect(this.reverb);
      const wet = c.createGain(); wet.gain.value = 0.5; this.reverb.connect(wet); wet.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
      this.ambBus = c.createGain(); this.ambBus.gain.value = this.sfxVol; this.ambBus.connect(this.master);
      const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.music = new Music(this); this.music.setMode(this.mode);
      this.amb = new Ambience(this);
      this.load();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.music?.start();
  }

  /** 解码内联采样（动态引入：Node 测试环境不会触发） */
  private async load() {
    try {
      const mod = await import('./sfxData');
      const data = mod.SFX_DATA as Record<string, string>;
      const c = this.ctx!;
      const names = Object.keys(data);
      // 先解码战斗与界面常用的，乐器放后
      names.sort((a, b) => (/^(erhu|dizi|xiao)_/.test(a) ? 1 : 0) - (/^(erhu|dizi|xiao)_/.test(b) ? 1 : 0));
      for (const n of names) {
        try {
          const response = await fetch(data[n]);
          if (!response.ok) continue;
          this.bufs[n] = await c.decodeAudioData(await response.arrayBuffer());
        } catch { /* 单个失败忽略 */ }
      }
      this.ready = true;
    } catch { /* 采样不可用：纯合成 */ }
  }

  setMode(m: 'title' | 'world') { this.mode = m; this.music?.setMode(m); }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
  }
  setMusicVol(v: number) { this.musicVol = v; if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  setSfxVol(v: number) {
    this.sfxVol = v;
    if (this.sfxBus && this.ctx) { this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); this.ambBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  has(name: string) { return !!this.bufs[name]; }

  private impulse(sec: number) {
    const c = this.ctx!, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        // 早期反射稀疏 + 尾音渐暗（一阶低通让尾巴更“木”，不刺耳）
        const n = (Math.random() * 2 - 1) * (i < c.sampleRate * 0.06 ? (Math.random() < 0.02 ? 3 : 0.2) : 1);
        lp += (n - lp) * (0.55 - k * 0.4);
        d[i] = lp * Math.pow(1 - k, 2.4);
      }
    }
    return buf;
  }

  /** 输出端：音量 → 声像 → 总线（+ 混响送） */
  out(vol: number, pan = 0, rev = 0.2, bus: 'sfx' | 'music' | 'amb' = 'sfx', when = 0): GainNode {
    const c = this.ctx!;
    const g = c.createGain(); g.gain.value = vol;
    const B = bus === 'music' ? this.musicBus : bus === 'amb' ? this.ambBus : this.sfxBus;
    let tail: AudioNode = g;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); tail = p; }
    tail.connect(B);
    if (rev > 0) { const s = c.createGain(); s.gain.value = rev; tail.connect(s); s.connect(this.revIn); }
    void when;
    return g;
  }

  /** 空间化参数：返回 [音量系数, 声像, 低通] 或 null（太远） */
  spatial(x: number, y: number): [number, number, number] | null {
    const dx = x - this.lx, dy = y - this.ly, d = Math.hypot(dx, dy);
    if (d > 3200) return null;
    let k = 1 / (1 + d / 900);
    if (d > this.hearR) k *= 0.35;
    const lp = d > 800 ? 16000 / (1 + (d - 800) / 350) : 0;
    return [k, clamp(dx / 700, -1, 1) * 0.7, lp];
  }

  /** 播放一个采样 */
  play(name: string, o: PlayOpts = {}): Voice | null {
    const c = this.ctx; if (!c || !this.enabled) return null;
    const b = this.bufs[name]; if (!b) return null;
    const now = c.currentTime, when = Math.max(now, o.when ?? now);
    const bus = o.bus ?? 'sfx';
    if (bus === 'sfx') {
      const key = o.key ?? name, gap = o.gap ?? 0.04;
      const lt = this.last.get(key);
      if (lt !== undefined && when - lt < gap) return null;
      this.last.set(key, when);
      if (this.voices >= this.maxVoices) return null;
    }
    let vol = o.vol ?? 1, pan = o.pan ?? 0, lp = o.lp ?? 0;
    if (o.x !== undefined) {
      const s = this.spatial(o.x, o.y ?? this.ly); if (!s) return null;
      vol *= s[0]; pan = s[1]; if (s[2]) lp = lp ? Math.min(lp, s[2]) : s[2];
    }
    if (vol < 0.008) return null;
    const src = c.createBufferSource(); src.buffer = b;
    if (o.rate) src.playbackRate.value = o.rate;
    if (o.detune) src.detune.value = o.detune;
    const g = this.out(vol, pan, o.rev ?? (bus === 'music' ? 0.35 : 0.18), bus);
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.connect(f); f.connect(g); } else src.connect(g);
    if (bus === 'sfx') { this.voices++; src.onended = () => { this.voices--; }; }
    src.start(when);
    return { src, gain: g, end: when + b.duration / (o.rate ?? 1) };
  }

  /** 从一组采样里随机挑一个 */
  any(names: readonly string[], o: PlayOpts = {}) {
    const ok = names.filter((n) => this.bufs[n]);
    if (!ok.length) return null;
    return this.play(pick(ok), { key: o.key ?? names[0], ...o });
  }

  // ------------------------------------------------------------ 合成小件
  tone(type: OscillatorType, f: number, t: number, dur: number, vol: number, dest: AudioNode, f2?: number, att = 0.005) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur * 0.9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  nz(t: number, dur: number, vol: number, dest: AudioNode, type: BiquadFilterType = 'bandpass', f0 = 1000, f1 = 0, q = 1, att = 0.005) {
    const c = this.ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  /** 合成落点（给定坐标）→ 输出节点；太远返回 null */
  synthOut(x: number | undefined, y: number | undefined, vol: number, rev = 0.2): AudioNode | null {
    if (!this.ctx || !this.enabled) return null;
    if (x === undefined) return this.out(vol, 0, rev);
    const s = this.spatial(x, y ?? this.ly); if (!s) return null;
    const g = this.out(vol * s[0], s[1], rev);
    if (!s[2]) return g;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = s[2]; f.connect(g);
    return f;
  }
  /** 雷：撕裂的炸响 + 滚雷 */
  crack(x?: number, y?: number, vol = 1, rumble = 1) {
    const o = this.synthOut(x, y, vol, 0.35); if (!o) return;
    const t = this.now;
    this.nz(t, 0.12, 0.9, o, 'highpass', 2500, 0, 0.7, 0.002);
    this.nz(t + 0.01, 0.35, 0.6, o, 'bandpass', 3000, 600, 0.8, 0.003);
    if (rumble > 0) {
      this.nz(t + 0.05, 2.6 * rumble, 0.75, o, 'lowpass', 900, 70, 0.8, 0.06);
      this.tone('sine', 70, t, 0.9, 0.5, o, 32);
    }
  }
  /** 火：噼啪 */
  crackle(x?: number, y?: number, vol = 0.5, n = 7) {
    const o = this.synthOut(x, y, vol, 0.1); if (!o) return;
    const t = this.now;
    this.nz(t, 0.5, 0.35, o, 'lowpass', 900, 300, 0.7, 0.04);
    for (let i = 0; i < n; i++) this.nz(t + Math.random() * 0.45, 0.025, rnd(0.3, 0.8), o, 'bandpass', rnd(1800, 5000), 0, 2, 0.001);
  }
  /** 钟（采样优先） */
  bell(x?: number, y?: number, vol = 0.5, rate = 1) {
    if (this.play(pick(['bell1', 'bell2']), { x, y, vol, rate, rev: 0.5, gap: 0.08, key: 'bell' })) return;
    const o = this.synthOut(x, y, vol, 0.5); if (!o) return;
    const t = this.now, f = 196 * rate;
    [[1, 0.3], [2.01, 0.16], [2.98, 0.1], [4.07, 0.07], [6.02, 0.04]].forEach(([m, v]) => this.tone('sine', f * m, t, 2.6, v, o));
  }
  /** 锣：非谐泛音 + 微微下沉 */
  gong(when: number, vol = 0.5, f = 92, dest?: AudioNode, x?: number, y?: number) {
    const o = dest ?? this.synthOut(x, y, vol, 0.5); if (!o) return;
    const v = dest ? vol : 1;
    [[1, 0.5], [1.48, 0.32], [1.98, 0.22], [2.53, 0.18], [3.14, 0.12], [4.21, 0.08], [5.4, 0.05]].forEach(([m, a], i) => {
      const os = this.tone('sine', f * m, when, 3.8 - i * 0.3, a * v, o, f * m * 0.985, 0.01);
      void os;
    });
    this.nz(when, 1.6, 0.15 * v, o, 'bandpass', 2400, 900, 1.2, 0.02);
  }
  /** 鼓（堂鼓） */
  drum(when: number, vol: number, dest: AudioNode, f0 = 150, f1 = 52, dec = 0.42) {
    this.tone('sine', f0, when, dec, vol, dest, f1, 0.002);
    this.tone('triangle', f0 * 1.6, when, dec * 0.3, vol * 0.25, dest, f1 * 1.6, 0.002);
    this.nz(when, 0.05, vol * 0.5, dest, 'lowpass', 1600, 400, 0.7, 0.001);
  }
  /** 木鱼 / 梆子 */
  wood(when: number, vol: number, dest: AudioNode, f = 880) {
    this.tone('sine', f, when, 0.09, vol, dest, f * 0.94, 0.001);
    this.tone('triangle', f * 2.7, when, 0.03, vol * 0.3, dest, 0, 0.001);
  }
  /** 钹 */
  cymbal(when: number, vol: number, dest: AudioNode, dur = 1.3) {
    this.nz(when, dur, vol, dest, 'highpass', 4200, 0, 0.6, 0.002);
    this.nz(when, dur * 0.6, vol * 0.6, dest, 'bandpass', 7000, 4000, 1.5, 0.002);
  }

  // ------------------------------------------------------------ 旧接口（全工程到处在用）
  sfx(kind: OldKind, x?: number, y?: number) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const P = (n: string | readonly string[], vol = 0.6, rate = 1, gap = 0.05, rev = 0.18) =>
      (typeof n === 'string' ? this.play(n, { x, y, vol, rate, gap, rev }) : this.any(n, { x, y, vol, rate: rate * rnd(0.94, 1.06), gap, rev }));
    const o = () => this.synthOut(x, y, 1, 0.25);
    switch (kind) {
      case 'click': if (!P('ui_click', 0.45, rnd(0.95, 1.08), 0.03, 0.05)) this.pluckSfx(880, t, 0.25, 0.4); return;
      case 'open': if (!P('ui_open', 0.5, 1, 0.05, 0.1)) { this.pluckSfx(587, t, 0.3, 1); this.pluckSfx(880, t + 0.06, 0.25, 1); } return;
      case 'chime': {
        P('bell2', 0.22, 1.5, 0.1, 0.4);
        this.pluckSfx(1174, t, 0.3, 1.5); this.pluckSfx(1760, t + 0.08, 0.2, 1.5); return;
      }
      case 'thunder': this.crack(x, y, 0.9, 1); P(['boom2'], 0.35, 0.55, 0.2, 0.4); return;
      case 'whoosh': {
        if (!P(['swish1', 'swish2', 'swish3'], 0.5, rnd(0.75, 1), 0.06)) { const d = o(); if (d) this.nz(t, 0.6, 0.35, d, 'bandpass', 300, 2400, 1.2, 0.08); }
        return;
      }
      case 'sword': {
        P(['unsheathe1', 'unsheathe2'], 0.45, rnd(1, 1.15), 0.08);
        const d = o(); if (!d) return;
        [1568, 2349, 3136].forEach((f, i) => this.tone('sine', f, t, 0.55, 0.05 / (i + 1), d, f * 1.04, 0.01));
        this.nz(t, 0.3, 0.12, d, 'bandpass', 1800, 5000, 2, 0.03);
        return;
      }
      case 'boom': {
        P(['boom1', 'boom2'], 0.75, rnd(0.85, 1), 0.08, 0.3);
        const d = o(); if (!d) return;
        this.tone('sine', 110, t, 0.7, 0.7, d, 32, 0.002);
        if (!this.ready) this.nz(t, 1.1, 0.45, d, 'lowpass', 2200, 120, 0.7, 0.002);
        return;
      }
      case 'bell': this.bell(x, y, 0.5, 0.75); return;
      case 'clang': if (!P(['metal1', 'metal2', 'metal3'], 0.45, rnd(0.9, 1.2), 0.05)) [880, 1320 * 1.02, 2093].forEach((f, i) => this.pluckSfx(f, t, 0.3 / (i + 1), 0.5)); return;
      case 'fire': P(['crunch1', 'crunch2'], 0.3, rnd(1.1, 1.35), 0.08); this.crackle(x, y, 0.4, 6); return;
      case 'gain': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.pluckSfx(f, t + i * 0.07, 0.3, 2.6)); this.bell(undefined, undefined, 0.45, 1); P('spell', 0.3, 1, 0.3, 0.5); return;
      case 'gather': P(['beads', 'st_leaf'], 0.35, rnd(1, 1.2), 0.1); this.pluckSfx(660, t, 0.22, 0.6); this.pluckSfx(990, t + 0.1, 0.18, 0.8); return;
      case 'break': [523, 659, 784, 1046, 1318].forEach((f, i) => this.pluckSfx(f, t + i * 0.09, 0.35, 2.2)); this.bell(undefined, undefined, 0.4, 0.6); P('magic', 0.35, 0.8, 0.3, 0.5); return;
      case 'fail': P('ui_error', 0.35, 0.8, 0.2); [392, 330, 262, 196].forEach((f, i) => this.pluckSfx(f, t + i * 0.12, 0.3, 1.2)); return;
      case 'land': P(['thud'], 0.45, rnd(0.9, 1.05), 0.1); P(['st_gravel', 'st_grass1', 'st_grass2'], 0.35, 0.8, 0.1); return;
    }
  }
  private pluckSfx(f: number, t: number, v: number, d: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.3, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + d + 0.05);
  }

  /** 每帧由 game.update 末尾调用 */
  tick(g: any, dt: number) {
    if (!this.ctx) return;
    try { this.dir.tick(g, dt); } catch (e) { if ((globalThis as any).__FANREN_DEV) console.warn(e); }
  }
}

export const audio = new AudioEngine();
if (typeof window !== 'undefined') (window as any).__audio = audio;
export type { AudioEngine };
