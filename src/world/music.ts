// 第三十三步：生成式古风配乐
// 十六分音符步进 + 预排程（每 100ms 排未来 0.3s），按场景切换“曲风”：
//   琴（Karplus-Strong 合成，带吟猱 / 上下滑音）· 二胡 · 笛 · 箫（CC0 采样）· 堂鼓 木鱼 锣 钹 钟（合成）· 持续低音
// 旋律以“乐句”为单位：节奏模板 + 拱形走向 + 句尾落宫 / 徵，AABA 循环；战斗时按危险程度叠层。
import type { AudioEngine } from './audio';

export type MusicState = 'title' | 'day' | 'night' | 'town' | 'sect' | 'sea' | 'demon' | 'cold' | 'desert'
  | 'combat' | 'boss' | 'pursuit' | 'cultivate';

const SC = [0, 2, 4, 7, 9];                 // 宫 商 角 徵 羽
const ROOT = 62;                            // D4 = 宫
const midiOf = (s: number, base = ROOT) => { const o = Math.floor(s / 5); return base + o * 12 + SC[((s % 5) + 5) % 5]; };
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

type Lead = 'qin' | 'erhu' | 'dizi' | 'xiao';
interface Note { st: number; len: number; s: number; orn?: 'up' | 'down' | 'yin' }
type Rhy = [number, number][];

// 两小节（32 个十六分）的节奏模板，最后一音拉长作句尾
const RHY: Record<'slow' | 'mid' | 'fast', Rhy[]> = {
  slow: [
    [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]],
    [[0, 4], [4, 4], [8, 4], [12, 4], [16, 10], [26, 6]],
    [[0, 8], [8, 6], [14, 2], [16, 16]],
    [[2, 2], [4, 4], [8, 8], [16, 6], [22, 2], [24, 8]],
    [[0, 12], [12, 4], [16, 4], [20, 4], [24, 8]],
  ],
  mid: [
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4], [16, 4], [20, 2], [22, 2], [24, 8]],
    [[0, 3], [3, 1], [4, 4], [8, 4], [12, 2], [14, 2], [16, 8], [24, 8]],
    [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2], [16, 2], [18, 2], [20, 4], [24, 8]],
    [[0, 6], [6, 2], [8, 2], [10, 2], [12, 4], [16, 3], [19, 1], [20, 4], [24, 8]],
  ],
  fast: [
    [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 4], [16, 2], [18, 2], [20, 2], [22, 2], [24, 8]],
    [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2], [16, 4], [20, 4], [24, 4], [28, 4]],
    [[0, 1], [1, 1], [2, 2], [4, 4], [8, 1], [9, 1], [10, 2], [12, 4], [16, 2], [18, 2], [20, 4], [24, 8]],
    [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 6], [14, 2], [16, 2], [18, 2], [20, 2], [22, 2], [24, 8]],
  ],
};

interface Style {
  bpm: number; tonic: number; rhy: 'slow' | 'mid' | 'fast';
  lead: Lead; base: number;        // 旋律乐器与其“宫”所在的音高（MIDI）
  lead2?: Lead; base2?: number;    // B 句换乐器
  rest: number;                    // 乐句音符跳过概率（留白）
  level: number;                   // 整体音量
  drone: number; tense?: boolean;  // 持续低音（tense=三全音，阴森）
  rev: number;
}
const STYLES: Record<MusicState, Style> = {
  title:     { bpm: 64, tonic: 0, rhy: 'slow', lead: 'qin', base: 50, lead2: 'xiao', base2: 50, rest: 0.08, level: 0.9, drone: 0, rev: 0.55 },
  day:       { bpm: 72, tonic: 0, rhy: 'slow', lead: 'qin', base: 50, lead2: 'dizi', base2: 74, rest: 0.12, level: 0.8, drone: 0, rev: 0.4 },
  night:     { bpm: 58, tonic: 4, rhy: 'slow', lead: 'xiao', base: 50, rest: 0.2, level: 0.75, drone: 0.15, rev: 0.6 },
  town:      { bpm: 92, tonic: 3, rhy: 'mid', lead: 'dizi', base: 74, lead2: 'qin', base2: 62, rest: 0.05, level: 0.75, drone: 0, rev: 0.3 },
  sect:      { bpm: 62, tonic: 0, rhy: 'slow', lead: 'qin', base: 50, lead2: 'xiao', base2: 50, rest: 0.15, level: 0.8, drone: 0.3, rev: 0.6 },
  sea:       { bpm: 70, tonic: 1, rhy: 'mid', lead: 'dizi', base: 74, rest: 0.15, level: 0.8, drone: 0.12, rev: 0.7 },
  demon:     { bpm: 62, tonic: 4, rhy: 'slow', lead: 'erhu', base: 62, rest: 0.2, level: 0.85, drone: 0.7, tense: true, rev: 0.55 },
  cold:      { bpm: 56, tonic: 1, rhy: 'slow', lead: 'xiao', base: 50, lead2: 'dizi', base2: 74, rest: 0.25, level: 0.7, drone: 0.2, rev: 0.75 },
  desert:    { bpm: 66, tonic: 4, rhy: 'slow', lead: 'erhu', base: 62, rest: 0.15, level: 0.8, drone: 0.35, rev: 0.45 },
  combat:    { bpm: 120, tonic: 4, rhy: 'fast', lead: 'erhu', base: 62, lead2: 'dizi', base2: 74, rest: 0.04, level: 1, drone: 0.2, tense: true, rev: 0.25 },
  boss:      { bpm: 132, tonic: 4, rhy: 'fast', lead: 'erhu', base: 62, rest: 0.0, level: 1.05, drone: 0.6, tense: true, rev: 0.3 },
  pursuit:   { bpm: 104, tonic: 4, rhy: 'mid', lead: 'erhu', base: 62, rest: 0.25, level: 0.95, drone: 0.55, tense: true, rev: 0.4 },
  cultivate: { bpm: 50, tonic: 0, rhy: 'slow', lead: 'qin', base: 50, rest: 0.35, level: 0.7, drone: 0.35, rev: 0.7 },
};

const ERHU = [62, 64, 66, 69, 71, 74, 76, 78, 81];
const DIZI = [74, 76, 79, 81, 84, 86, 89];

export class Music {
  e: AudioEngine;
  bus: GainNode;
  state: MusicState = 'title';
  private pending: MusicState | null = null;
  intensity = 0; prox = 0;
  private timer = 0;
  private next = 0;
  private gs = 0;                         // 当前曲风内的十六分步数
  private phr: Note[][] = [];             // [A, A', B]
  private qinCache = new Map<number, AudioBuffer>();
  private drone: { g: GainNode; o: OscillatorNode[]; lp: BiquadFilterNode } | null = null;
  private vib: Float32Array;
  private mode: 'title' | 'world' = 'title';
  private bars = 0;

  constructor(e: AudioEngine) {
    this.e = e;
    const c = e.ctx!;
    this.bus = c.createGain(); this.bus.gain.value = STYLES.title.level * 1.5; this.bus.connect(e.musicBus);
    const rv = c.createGain(); rv.gain.value = 0.5; this.bus.connect(rv); rv.connect(e.revIn);
    this.vib = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.vib[i] = Math.sin(i / 256 * Math.PI * 2 * 6);   // 6 个周期
    this.makeDrone();
  }

  setMode(m: 'title' | 'world') {
    this.mode = m;
    if (m === 'title') this.request('title', true); else if (this.state === 'title') this.request('day', true);
  }
  start() {
    if (this.timer) return;
    this.next = this.e.now + 0.1;
    this.timer = window.setInterval(() => this.pump(), 100) as unknown as number;
  }

  /** 请求切换场景配乐；now=立刻（战斗、标题），否则在下一小节线 */
  request(s: MusicState, now = false) {
    if (this.mode === 'title' && s !== 'title') return;
    if (s === this.state && !this.pending) return;
    if (s === this.state) { this.pending = null; return; }
    if (now) this.switchTo(s); else this.pending = s;
  }
  private switchTo(s: MusicState) {
    const prev = this.state;
    this.state = s; this.pending = null; this.gs = 0; this.phr = []; this.bars = 0;
    const st = STYLES[s], c = this.e.ctx!, t = c.currentTime;
    this.bus.gain.setTargetAtTime(st.level * 1.5, t, 0.6);
    this.setDrone(st);
    const fight = s === 'combat' || s === 'boss';
    if (fight && prev !== 'combat' && prev !== 'boss') this.stinger(s === 'boss');
    if (s === 'pursuit' && prev !== 'pursuit') this.stingerPursuit();
    this.next = Math.max(this.next, t + 0.05);
  }

  private pump() {
    const c = this.e.ctx; if (!c || !this.e.enabled) return;
    const ahead = typeof document !== 'undefined' && document.hidden ? 1.3 : 0.3;
    if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.05;   // 卡顿 / 切后台之后重新对齐
    while (this.next < c.currentTime + ahead) {
      const st = STYLES[this.state];
      let bpm = st.bpm;
      if (this.state === 'pursuit') bpm = 96 + this.prox * 48;
      if (this.state === 'combat') bpm = 116 + this.intensity * 14;
      const dur = 60 / bpm / 4;
      if (this.gs % 16 === 0 && this.pending) { this.switchTo(this.pending); continue; }
      this.step(this.gs, this.next, dur);
      this.gs++; this.next += dur;
    }
  }

  // ------------------------------------------------------------ 乐句
  private phrase(st: Style, cadence: 'home' | 'half'): Note[] {
    const rh = pick(RHY[st.rhy]);
    const n = rh.length, T = st.tonic;
    const start = T + pick([0, 1, 2, -1]);
    const peak = T + rnd(3, 5.5);
    const end = cadence === 'home' ? T : pick([T + 3, T + 1, T - 2]);
    const out: Note[] = [];
    let prev = start;
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1);
      // 拱形：前 60% 升到峰，再落回句尾
      const target = k < 0.6 ? start + (peak - start) * (k / 0.6) : peak + (end - peak) * ((k - 0.6) / 0.4);
      let s = i === n - 1 ? end : Math.round(target + rnd(-1, 1) * 0.9);
      if (i < n - 1 && Math.abs(s - prev) > 2 && Math.random() < 0.7) s = prev + Math.sign(s - prev) * 2;
      s = Math.max(T - 3, Math.min(T + 8, s));
      const [stp, len] = rh[i];
      const orn = len >= 6 ? (Math.random() < 0.35 ? 'yin' : Math.random() < 0.25 ? 'down' : undefined) : (Math.random() < 0.18 ? 'up' : undefined);
      out.push({ st: stp, len, s, orn });
      prev = s;
    }
    return out;
  }
  private varyEnd(a: Note[], st: Style): Note[] {
    const b = a.map((x) => ({ ...x }));
    const last = b[b.length - 1]; last.s = pick([st.tonic + 3, st.tonic + 1]);
    if (b.length > 3) b[b.length - 2].s += pick([-1, 1]);
    return b;
  }

  // ------------------------------------------------------------ 每一步
  private step(gs: number, t: number, dur: number) {
    const s = this.state, st = STYLES[s], e = this.e;
    const bar = Math.floor(gs / 16), b = gs % 16;
    if (gs % 128 === 0 || !this.phr.length) {
      const A = this.phrase(st, 'home');
      this.phr = [this.varyEnd(A, st), A, this.phrase(st, 'half')];
      // 结构：A' A B A
    }
    if (b === 0) this.bars = bar;
    const pi = Math.floor(gs / 32) % 4, ps = gs % 32;
    const P = pi === 0 ? this.phr[0] : pi === 1 ? this.phr[1] : pi === 2 ? this.phr[2] : this.phr[1];
    const useB = pi === 2 && st.lead2;
    const lead: Lead = useB ? st.lead2! : st.lead, base = useB ? st.base2! : st.base;
    const fight = s === 'combat' || s === 'boss';
    // 旋律（战斗时首两小节先让鼓与琴铺垫）
    const leadOn = !(fight && gs < 32) && !(s === 'night' && pi === 3) && !(s === 'cultivate' && pi % 2 === 1);
    if (leadOn) for (const n of P) if (n.st === ps && Math.random() > st.rest) {
      const m = midiOf(n.s, base);
      const d = n.len * dur;
      if (s === 'boss' && lead === 'erhu' && n.len >= 4) {          // 首领：二胡碎弓（颤弓）
        for (let k = 0; k < n.len; k++) this.inst(lead, m, t + k * dur, dur * 1.2, k === 0 ? 0.7 : 0.45);
      } else this.inst(lead, m, t, d, fight ? 0.7 : 0.6, n.orn);
      if (s === 'demon' && n.len >= 6 && Math.random() < 0.35) this.inst('erhu', m - 1, t + d * 0.5, d * 0.5, 0.25);  // 半音摩擦
    }
    // 伴奏 + 打击
    const D = this.dest();
    switch (s) {
      case 'title': case 'day': case 'sect': case 'cultivate':
        if (b === 0) this.qin(midiOf(st.tonic + (bar % 4 === 2 ? -2 : 0), 38), t, 0.5);
        if (b === 8 && Math.random() < 0.5) this.qin(midiOf(st.tonic + 3, 38), t, 0.32);
        if (s === 'title' && b % 4 === 2 && Math.random() < 0.12) this.harm(midiOf(st.tonic + pick([5, 8, 10]), 62), t, 0.25);
        if (s === 'sect' && b === 0 && bar % 2 === 0) e.bell(undefined, undefined, 0.18, 0.62);
        if (s === 'cultivate') { if (b === 0 && bar % 4 === 0) e.bell(undefined, undefined, 0.16, 0.5); if (b % 2 === 0 && Math.random() < 0.08) this.harm(midiOf(st.tonic + pick([5, 7, 8, 10]), 62), t, 0.2); }
        break;
      case 'night':
        if (b === 0 && bar % 2 === 0) this.qin(midiOf(st.tonic, 38), t, 0.4);
        if (b % 2 === 0 && Math.random() < 0.09) this.harm(midiOf(st.tonic + pick([5, 7, 8, 10, 12]), 62), t, 0.22);
        break;
      case 'cold':
        if (b % 2 === 0 && Math.random() < 0.1) this.harm(midiOf(st.tonic + pick([8, 10, 12, 13]), 62), t, 0.2);
        if (b === 0 && bar % 2 === 0) this.qin(midiOf(st.tonic, 38), t, 0.35);
        break;
      case 'town': {
        if ([0, 3, 6, 8, 11, 14].includes(b)) e.wood(t, b % 8 === 0 ? 0.16 : 0.1, D, b % 8 === 0 ? 760 : 980);
        if (b === 0 || b === 8) e.drum(t, 0.22, D, 170, 70, 0.3);
        if (b % 2 === 0) { const arp = [0, 2, 3, 5, 3, 2, 0, -2]; this.qin(midiOf(st.tonic + arp[(b / 2) | 0], 50), t, 0.2); }
        break;
      }
      case 'sea':
        if (b % 2 === 0) { const arp = [0, 3, 5, 7, 5, 3, 2, 3]; this.qin(midiOf(st.tonic + arp[(b / 2) | 0], 50), t, 0.17); }
        if (b === 0) this.qin(midiOf(st.tonic, 38), t, 0.4);
        break;
      case 'demon':
        if (b === 0 || b === 3) e.drum(t, b === 0 ? 0.5 : 0.32, D, 90, 40, 0.35);              // 心跳
        if (b === 0 && bar % 4 === 0) e.gong(t, 0.22, 70, D);
        if (b === 8 && Math.random() < 0.3) this.qin(midiOf(st.tonic - 5, 38) - 1, t, 0.35, 'down');
        break;
      case 'desert':
        if (b === 0 || b === 6 || b === 10) e.drum(t, b === 0 ? 0.4 : 0.25, D, 120, 50, 0.45);
        if (b === 0) this.qin(midiOf(st.tonic, 38), t, 0.42);
        break;
      case 'combat': case 'boss': {
        const I = s === 'boss' ? 1 : this.intensity;
        // 堂鼓：重拍 + 切分
        const dp = s === 'boss' ? [0, 2, 4, 6, 8, 10, 11, 12, 14] : [0, 3, 6, 8, 10, 12, 14];
        if (dp.includes(b)) e.drum(t, (b % 8 === 0 ? 0.62 : 0.36) * (0.8 + I * 0.3), D, b % 8 === 0 ? 150 : 190, 55, 0.35);
        if (I > 0.45 && bar % 4 === 3 && b >= 12) e.drum(t, 0.3 + (b - 12) * 0.06, D, 210, 80, 0.2);   // 过门
        // 木鱼八分
        if (b % 2 === 0) e.wood(t, b % 4 === 0 ? 0.11 : 0.07, D, b % 4 === 0 ? 1100 : 1350);
        // 琴：低音固定音型（十六分）
        const ost = [0, 3, 5, 3, 0, 3, 6, 3];
        const om = midiOf(st.tonic + ost[(b >> 1) % 8] - 5, 50);
        if (b % 2 === 0) this.qin(om, t, b % 4 === 0 ? 0.36 : 0.22);
        else if (I > 0.6) this.qin(om + 12, t, 0.12);
        // 钹与锣
        if (b === 0 && bar % 2 === 0 && gs > 0) e.cymbal(t, 0.12 + I * 0.08, D, 1.1);
        if (b === 0 && (s === 'boss' ? bar % 2 === 0 : (I > 0.7 && bar % 8 === 0)) && gs > 0) e.gong(t, 0.3, s === 'boss' ? 74 : 88, D);
        break;
      }
      case 'pursuit': {
        if (b % 4 === 0) { e.drum(t, 0.48, D, 85, 38, 0.3); e.drum(t + dur * 1.2, 0.3, D, 80, 38, 0.25); }   // 心跳
        if (b % 2 === 0) e.wood(t, 0.05 + this.prox * 0.06, D, 1400);
        if (b === 0 && bar % 4 === 0) e.gong(t, 0.18, 66, D);
        break;
      }
    }
  }
  private dest(): AudioNode { return this.bus; }

  // ------------------------------------------------------------ 乐器
  private inst(l: Lead, m: number, t: number, d: number, v: number, orn?: Note['orn']) {
    if (l === 'qin') return this.qin(m, t, v * 0.9, orn);
    const R = l === 'erhu' ? [60, 88] : l === 'dizi' ? [70, 95] : [58, 79];   // 各乐器的舒适音域，超出就折八度
    while (m > R[1]) m -= 12;
    while (m < R[0]) m += 12;
    if (l === 'erhu') return this.sampled('erhu', ERHU, m, t, d, v * 0.55, orn, 5.6, 22);
    if (l === 'dizi') return this.sampled('dizi', DIZI, m, t, d, v * 0.42, orn, 5.0, 14);
    // 箫：笛样本降八度慢放，气声更重
    if (l === 'xiao') return this.sampled('xiao', [77], m, t, d, v * 0.55, orn, 4.6, 12);
  }
  private sampled(pre: string, have: number[], m: number, t: number, d: number, v: number, orn: Note['orn'] | undefined, vibHz: number, vibCents: number) {
    const e = this.e;
    let best = have[0]; for (const h of have) if (Math.abs(h - m) < Math.abs(best - m)) best = h;
    const name = `${pre}_${best}`;
    if (!e.has(name)) { this.synthLead(m, t, d, v * 0.25); return; }
    const rate = Math.pow(2, (m - best) / 12);
    const L = Math.min(Math.max(d, 0.18), 3.7 / rate - 0.1);
    const vo = e.play(name, { bus: 'music', rate, vol: v, when: t, rev: 0 }); if (!vo) return;
    // 本体经 music 子总线（带混响送）
    vo.gain.disconnect(); vo.gain.connect(this.bus);
    const g = vo.gain.gain, att = pre === 'dizi' ? 0.05 : 0.09;
    g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(v, t + att);
    g.setValueAtTime(v, t + Math.max(att, L - 0.12)); g.linearRampToValueAtTime(0, t + L + 0.22);
    vo.src.stop(t + L + 0.3);
    const dt = vo.src.detune;
    if (orn === 'up' || (pre === 'erhu' && Math.random() < 0.25)) { dt.setValueAtTime(-160, t); dt.linearRampToValueAtTime(0, t + 0.14); }
    if (L > 0.5) {
      const vs = t + Math.min(0.3, L * 0.3), vd = L - (vs - t);
      const cyc = Math.max(1, Math.round(vd * vibHz));
      const curve = new Float32Array(64);
      for (let i = 0; i < 64; i++) { const k = i / 63; curve[i] = Math.sin(k * Math.PI * 2 * cyc) * vibCents * Math.min(1, k * 3); }
      try { dt.setValueCurveAtTime(curve, vs, vd); } catch { /* */ }
      if (orn === 'down') { try { dt.setValueAtTime(0, t + L); dt.linearRampToValueAtTime(-200, t + L + 0.2); } catch { /* */ } }
    }
  }
  private synthLead(m: number, t: number, d: number, v: number) {
    const e = this.e, c = e.ctx!, f = hz(m);
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sine'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = f * 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.2, d * 0.3)); g.gain.linearRampToValueAtTime(0, t + d + 0.1);
    o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o.stop(t + d + 0.15);
  }

  /** 古琴：Karplus-Strong 离线合成（按音高缓存） */
  private qinBuf(m: number) {
    let b = this.qinCache.get(m); if (b) return b;
    const c = this.e.ctx!, sr = c.sampleRate, f = hz(m);
    const T60 = Math.max(1.6, 4.2 - (m - 40) * 0.05);
    const len = Math.floor(sr * Math.min(3.6, T60 * 0.9));
    b = c.createBuffer(1, len, sr);
    const out = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f - 0.5));
    const dl = new Float32Array(N);
    // 拨弦：低通噪声（亮度随音高），拨弦点偏一侧（减去延迟的副本 → 梳状，更像丝弦）
    let lp = 0; const bright = 0.35 + Math.min(0.4, (m - 40) * 0.01);
    for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * bright; dl[i] = lp; }
    const pp = Math.max(1, Math.round(N * 0.13)); const tmp = Float32Array.from(dl);
    for (let i = 0; i < N; i++) dl[i] = tmp[i] - tmp[(i + pp) % N] * 0.8;
    const rho = Math.pow(0.001, 1 / (f * T60));
    let idx = 0, peak = 1e-6, body = 0;
    for (let i = 0; i < len; i++) {
      const a = dl[idx], nb = dl[(idx + 1) % N];
      dl[idx] = (a * 0.5 + nb * 0.5) * rho;
      body += (a - body) * 0.25;                    // 木腔：轻低通
      out[i] = body;
      if (Math.abs(body) > peak) peak = Math.abs(body);
      idx = (idx + 1) % N;
    }
    // 起音一点“按弦”木声
    for (let i = 0; i < Math.min(len, sr * 0.012); i++) out[i] += (Math.random() * 2 - 1) * 0.15 * peak * (1 - i / (sr * 0.012));
    const k = 0.8 / peak; for (let i = 0; i < len; i++) out[i] *= k;
    const fade = Math.floor(sr * 0.15); for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    this.qinCache.set(m, b);
    return b;
  }
  private qin(m: number, t: number, v: number, orn?: Note['orn']) {
    const c = this.e.ctx!;
    const s = c.createBufferSource(); s.buffer = this.qinBuf(m);
    const g = c.createGain(); g.gain.value = v * 0.55;
    s.connect(g); g.connect(this.bus);
    if (orn === 'up') { s.detune.setValueAtTime(-200, t); s.detune.linearRampToValueAtTime(0, t + 0.16); }
    else if (orn === 'yin') { try { const cv = this.vib.map((x, i) => x * 18 * (i / 256)); s.detune.setValueCurveAtTime(cv, t + 0.25, 1.6); } catch { /* */ } }
    else if (orn === 'down') { s.detune.setValueAtTime(0, t + 0.5); s.detune.linearRampToValueAtTime(-200, t + 1.0); }
    s.start(t);
  }
  /** 泛音：清亮如钟磬 */
  private harm(m: number, t: number, v: number) {
    const e = this.e, f = hz(m);
    e.tone('sine', f, t, 2.4, v * 0.16, this.bus, 0, 0.002);
    e.tone('sine', f * 2, t, 1.4, v * 0.05, this.bus, 0, 0.002);
  }

  // ------------------------------------------------------------ 持续低音
  private makeDrone() {
    const c = this.e.ctx!;
    const g = c.createGain(); g.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2;
    const f = hz(38);
    const o: OscillatorNode[] = [];
    const mk = (type: OscillatorType, fr: number, v: number) => { const x = c.createOscillator(); x.type = type; x.frequency.value = fr; const gg = c.createGain(); gg.gain.value = v; x.connect(gg); gg.connect(lp); x.start(); o.push(x); };
    mk('sawtooth', f, 0.3); mk('sawtooth', f * 1.006, 0.3); mk('sine', f / 2, 0.6); mk('triangle', f * 1.5, 0.15);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 160; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(g); g.connect(this.bus);
    this.drone = { g, o, lp };
  }
  private setDrone(st: Style) {
    const d = this.drone; if (!d) return;
    const c = this.e.ctx!, t = c.currentTime;
    const root = hz(midiOf(st.tonic, 38) - 12);
    d.o[0].frequency.setTargetAtTime(root, t, 0.5); d.o[1].frequency.setTargetAtTime(root * 1.006, t, 0.5);
    d.o[2].frequency.setTargetAtTime(root / 2, t, 0.5);
    d.o[3].frequency.setTargetAtTime(root * (st.tense ? Math.SQRT2 : 1.5), t, 0.5);
    d.g.gain.setTargetAtTime(st.drone * 0.14, t, 1.2);
  }

  // ------------------------------------------------------------ 转场
  private stinger(boss: boolean) {
    const e = this.e, t = e.now + 0.02, D = this.bus;
    e.gong(t, boss ? 0.55 : 0.4, boss ? 70 : 88, D);
    for (let i = 0; i < 6; i++) e.drum(t + 0.05 + i * (0.11 - i * 0.008), 0.25 + i * 0.07, D, 180, 60, 0.25);
    e.cymbal(t + 0.62, 0.22, D, 1.6);
    if (boss) e.gong(t + 0.62, 0.45, 62, D);
  }
  private stingerPursuit() {
    const e = this.e, t = e.now + 0.02, D = this.bus;
    e.gong(t, 0.3, 66, D);
    this.sampled('erhu', ERHU, 74, t + 0.1, 1.4, 0.45, 'down', 6, 30);
  }
}
