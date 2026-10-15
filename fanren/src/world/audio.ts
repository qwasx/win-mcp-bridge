// 程序化古风配乐（WebAudio）：古琴拨弦 + 箫声长音 + 风声
// 五声音阶随机游走生成旋律，不依赖任何外部音频文件
class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; reverb!: ConvolverNode;
  enabled = true;
  musicVol = 0.55; sfxVol = 0.7;
  private timer = 0;
  private started = false;
  private step = 0;
  private degree = 2;
  private mode: 'title' | 'world' = 'title';

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.enabled ? 1 : 0; this.master.connect(c.destination);
      this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(3.2);
      const wet = c.createGain(); wet.gain.value = 0.55; this.reverb.connect(wet); wet.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master); this.musicBus.connect(this.reverb);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master); this.sfxBus.connect(this.reverb);
      this.wind();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started) { this.started = true; this.schedule(); }
  }

  setMode(m: 'title' | 'world') { this.mode = m; }
  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.3);
  }
  setMusicVol(v: number) { this.musicVol = v; if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  setSfxVol(v: number) { this.sfxVol = v; if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }

  private impulse(sec: number) {
    const c = this.ctx!, len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  // D 宫五声音阶：D E F# A B
  private freq(deg: number) {
    const scale = [0, 2, 4, 7, 9];
    const oct = Math.floor(deg / 5), idx = ((deg % 5) + 5) % 5;
    return 146.83 * Math.pow(2, (scale[idx] + oct * 12) / 12);
  }

  // 古琴拨弦：Karplus-Strong 风格的衰减音
  private pluck(f: number, t: number, vel = 0.5, dur = 2.8) {
    const c = this.ctx!;
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine';
    o1.frequency.value = f; o2.frequency.value = f * 2.003;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + dur * 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.32, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vel * 0.12, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    // 吟猱：轻微颤音
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5; lg.gain.value = f * 0.004;
    lfo.connect(lg); lg.connect(o1.frequency);
    const og = c.createGain(); og.gain.value = 0.35; o2.connect(og);
    o1.connect(lp); og.connect(lp); lp.connect(g); g.connect(this.musicBus);
    [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + dur + 0.1); });
  }

  // 箫：带气声的长音
  private flute(f: number, t: number, dur: number) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = f;
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 4.6; vg.gain.value = f * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = f * 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    // 气声
    const n = this.noiseSrc(dur), ng = c.createGain(), bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.025, t + dur * 0.3); ng.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(ng); ng.connect(this.musicBus);
    o.connect(lp); lp.connect(g); g.connect(this.musicBus);
    o.start(t); vib.start(t); n.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); n.stop(t + dur + 0.1);
  }

  private noiseSrc(sec: number) {
    const c = this.ctx!, len = Math.floor(c.sampleRate * Math.max(0.1, sec));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf; return s;
  }

  private wind() {
    const c = this.ctx!;
    const n = this.noiseSrc(6); n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.018;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300;
    lfo.connect(lg); lg.connect(bp.frequency);
    n.connect(bp); bp.connect(g); g.connect(this.musicBus);
    n.start(); lfo.start();
  }

  // 旋律调度
  private schedule() {
    const c = this.ctx!;
    const beat = this.mode === 'title' ? 0.62 : 0.72;
    const t0 = c.currentTime + 0.1;
    // 每小节 8 拍
    for (let b = 0; b < 8; b++) {
      const t = t0 + b * beat;
      const r = Math.random();
      if (b === 0) {
        // 低音根音
        this.pluck(this.freq(this.step % 4 === 2 ? -2 : -5), t, 0.55, 4);
      }
      if (r < (this.mode === 'title' ? 0.5 : 0.42)) {
        // 随机游走
        const mv = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
        this.degree = Math.max(0, Math.min(9, this.degree + mv));
        this.pluck(this.freq(this.degree), t + (Math.random() < 0.2 ? beat * 0.5 : 0), 0.35 + Math.random() * 0.25);
        if (Math.random() < 0.15) this.pluck(this.freq(this.degree + 5), t + 0.02, 0.15);
      }
    }
    if (this.step % 4 === 1 && Math.random() < 0.7) this.flute(this.freq(5 + Math.floor(Math.random() * 4)), t0 + beat * 2, beat * 5);
    this.step++;
    this.timer = window.setTimeout(() => this.schedule(), 8 * beat * 1000 - 50);
  }

  sfx(kind: 'click' | 'whoosh' | 'land' | 'open' | 'chime' | 'thunder' | 'break' | 'fail' | 'gather' | 'sword' | 'boom' | 'bell' | 'clang' | 'fire' | 'gain') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    // 法器音效（纯合成）
    if (kind === 'sword') { // 剑鸣：高频金属泛音 + 气流
      [1568, 2349, 3136].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.04, t + 0.4); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.6); });
      const n = this.noiseSrc(0.4), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.25);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); n.connect(bp); bp.connect(g); g.connect(this.sfxBus); n.start(t); n.stop(t + 0.4); return;
    }
    if (kind === 'boom') { // 砸地：低频冲击 + 碎石噪声
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.75);
      const n = this.noiseSrc(1.2), lp = c.createBiquadFilter(), g2 = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1);
      g2.gain.setValueAtTime(0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 1.1); n.connect(lp); lp.connect(g2); g2.connect(this.sfxBus); n.start(t); n.stop(t + 1.2); return;
    }
    if (kind === 'bell') { // 古钟：非谐泛音，长尾
      [[196, 0.3], [392 * 1.01, 0.16], [588 * 0.98, 0.1], [784 * 1.03, 0.07], [1180, 0.04]].forEach(([f, v]) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.6); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 2.7); });
      return;
    }
    if (kind === 'clang') { [880, 1320 * 1.02, 2093].forEach((f, i) => this.pluckSfx(f, t, 0.3 / (i + 1), 0.5)); return; }
    if (kind === 'fire') {
      const n = this.noiseSrc(0.6), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(700, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); n.connect(bp); bp.connect(g); g.connect(this.sfxBus); n.start(t); n.stop(t + 0.5); return;
    }
    if (kind === 'gain') { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.pluckSfx(f, t + i * 0.07, 0.3, 2.6)); this.sfx('bell'); return; }
    if (kind === 'gather') { this.pluckSfx(660, t, 0.25, 0.6); this.pluckSfx(990, t + 0.1, 0.2, 0.8); return; }
    if (kind === 'break') { [523, 659, 784, 1046, 1318].forEach((f, i) => this.pluckSfx(f, t + i * 0.09, 0.35, 2.2)); return; }
    if (kind === 'fail') { [392, 330, 262, 196].forEach((f, i) => this.pluckSfx(f, t + i * 0.12, 0.3, 1.2)); return; }
    if (kind === 'thunder') {
      const n = this.noiseSrc(3), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      n.connect(lp); lp.connect(g); g.connect(this.sfxBus); n.start(t); n.stop(t + 3);
      return;
    }
    if (kind === 'click') { this.pluckSfx(880, t, 0.25, 0.4); return; }
    if (kind === 'chime') { this.pluckSfx(1174, t, 0.3, 1.5); this.pluckSfx(1760, t + 0.08, 0.2, 1.5); return; }
    if (kind === 'open') { this.pluckSfx(587, t, 0.3, 1); this.pluckSfx(880, t + 0.06, 0.25, 1); return; }
    const n = this.noiseSrc(0.8), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    if (kind === 'whoosh') { bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.5); }
    else { bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(200, t + 0.4); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(bp); bp.connect(g); g.connect(this.sfxBus); n.start(t); n.stop(t + 0.8);
  }
  private pluckSfx(f: number, t: number, v: number, d: number) {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.3, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + d + 0.05);
  }
}

export const audio = new AudioEngine();
