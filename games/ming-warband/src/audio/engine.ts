// 音频引擎：全部声音都由 WebAudio 实时合成，不使用任何音频文件。
// 结构：各声源 -> (sfx | music | amb) 总线 -> master -> 压限器 -> 扬声器，另有一条公共混响发送。

export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }
const KEY = 'ming_warband_audio';

function loadSettings(): AudioSettings {
  const def: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') return { ...def, ...s };
  } catch { /* 忽略 */ }
  return def;
}

class Engine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  amb!: GainNode;
  verbIn!: GainNode;
  noise!: AudioBuffer;
  brown!: AudioBuffer;
  settings: AudioSettings = loadSettings();
  failed = false;
  private listeners: (() => void)[] = [];

  /** 首次用户操作后创建 AudioContext（浏览器策略要求） */
  ensure(): AudioContext | null {
    if (this.ctx || this.failed) return this.ctx;
    const AC: typeof AudioContext | undefined = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) { this.failed = true; return null; }
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.failed = true; return null; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(c.destination);
    this.master = c.createGain(); this.master.connect(comp);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    // 混响：程序生成的指数衰减脉冲
    const verb = c.createConvolver();
    verb.buffer = this.impulse(2.6, 2.2);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 1;
    const verbOut = c.createGain(); verbOut.gain.value = 0.32;
    this.verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(this.master);
    // 噪声素材
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.apply();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
    });
    for (const fn of this.listeners) fn();
    return c;
  }

  onReady(fn: () => void) { this.listeners.push(fn); if (this.ctx) fn(); }

  unlock() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  impulse(sec: number, decay: number) {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
    }
    return buf;
  }

  apply() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.music.gain.setTargetAtTime(s.music * 0.85, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(s.sfx * 0.7, t, 0.05);
  }

  set(p: Partial<AudioSettings>) {
    Object.assign(this.settings, p);
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* 忽略 */ }
    this.apply();
  }

  toggleMute() { this.set({ muted: !this.settings.muted }); return this.settings.muted; }
}

export const engine = new Engine();

/** 在第一次点击/按键时解锁音频 */
export function installAudioUnlock() {
  const h = () => engine.unlock();
  window.addEventListener('pointerdown', h, true);
  window.addEventListener('keydown', h, true);
  window.addEventListener('touchstart', h, true);
}
