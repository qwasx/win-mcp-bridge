// 第四十六步「天象」：突破不再放过场 CG——筑基、结丹、结婴、化神的全部异象都发生在大地图里，
// 主角盘坐原地，天地在他身边变色：聚气灵阵 → 风云漩涡 → 天雷 → 碎丹（白光、冲击波、碎片）→ 元婴出世（金莲、光柱、天门霞光、花雨、仙鹤）→ 书法大字。
// 周围的人会停下来看、会跪、会喊；世界不暂停，但主角在天象结束前不能动。
const soulUrl = './game-assets/fx/jy_soul.webp';
import type { Game } from './game';
import { audio } from './audio';

export type TxKind = 'zhuji' | 'jiedan' | 'jieying' | 'huashen';
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const smooth = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

interface Mote { a: number; r: number; sp: number; s: number; w: number; e: number; ph: number }
interface Cloud { a: number; r: number; s: number; sp: number; dark: number; ph: number }
interface Bolt { pts: [number, number][]; t: number; w: number; branches: [number, number][][] }
interface Shard { x: number; y: number; vx: number; vy: number; t: number; s: number; rot: number; vr: number }
interface Petal { x: number; y: number; vx: number; vy: number; t: number; s: number; rot: number; col: string }

const PALETTE: Record<TxKind, { main: string; glow: [number, number, number]; cloud: [number, number, number]; txt: string; seal: string; eye: [number, number, number] }> = {
  zhuji: { main: '#9fe0ff', glow: [160, 225, 255], cloud: [90, 110, 140], txt: '築基', seal: '築基', eye: [200, 240, 255] },
  jiedan: { main: '#ffd978', glow: [255, 220, 130], cloud: [120, 100, 70], txt: '金丹', seal: '結丹', eye: [255, 230, 150] },
  jieying: { main: '#ffe9a8', glow: [255, 236, 170], cloud: [60, 56, 78], txt: '元嬰', seal: '結嬰', eye: [255, 240, 190] },
  huashen: { main: '#f0a8ff', glow: [240, 180, 255], cloud: [70, 40, 80], txt: '化神', seal: '化神', eye: [255, 200, 250] },
};
/** 每种天象的时间表（秒） */
const PLAN: Record<TxKind, { dur: number; gather: [number, number]; storm: [number, number]; bolts: number[]; burst: number; birth: [number, number]; text: number }> = {
  zhuji: { dur: 11, gather: [0, 5], storm: [3.5, 7], bolts: [], burst: 6.8, birth: [7, 10], text: 7.6 },
  jiedan: { dur: 17, gather: [0, 6], storm: [4, 11], bolts: [6.5, 8.6, 10.2], burst: 11, birth: [11.4, 15.5], text: 12.4 },
  jieying: { dur: 26, gather: [0, 7], storm: [5, 14.6], bolts: [7, 8.6, 10, 11.1, 12.1, 13, 13.7, 14.3], burst: 15.2, birth: [15.6, 22], text: 17.6 },
  huashen: { dur: 26, gather: [0, 7], storm: [5, 14.6], bolts: [7, 8.4, 9.6, 10.6, 11.6, 12.5, 13.3, 14, 14.5], burst: 15.2, birth: [15.6, 22], text: 17.6 },
};

/** 软云团 / 光点 / 光晕的离屏精灵（避免每帧创建上百个径向渐变） */
function blob(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
const CLOUD_SPR = typeof document !== 'undefined' ? blob(160, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.72)'], [1, 'rgba(255,255,255,0)']]) : null;
const MOTE_SPR = typeof document !== 'undefined' ? blob(32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]) : null;

export class Tianxiang {
  kind: TxKind | null = null; ok = true; t = 0; dur = 0;
  /** 画面暗化、整屏闪白（渲染层读取） */
  gloom = 0; flash = 0; flashCol: [number, number, number] = [1, 1, 1];
  private motes: Mote[] = []; private clouds: Cloud[] = []; private bolts: Bolt[] = []; private shards: Shard[] = []; private petals: Petal[] = [];
  private boltI = 0; private burstDone = false; private birthBell = false; private said = new Set<string>();
  private lift = 0; private ringT: number[] = []; private soul: HTMLImageElement | null = null;
  private cloudTint: HTMLCanvasElement | null = null; private cloudTintKey = '';
  private px = 0; private py = 0;
  constructor() { if (typeof Image !== 'undefined') { this.soul = new Image(); this.soul.src = soulUrl; } }
  get active() { return !!this.kind; }
  get phase(): 'gather' | 'storm' | 'burst' | 'birth' | 'after' | 'none' {
    if (!this.kind) return 'none'; const P = PLAN[this.kind];
    if (this.t < P.storm[0]) return 'gather'; if (this.t < P.burst) return 'storm'; if (this.t < P.birth[0]) return 'burst'; if (this.t < P.birth[1]) return 'birth'; return 'after';
  }

  start(kind: TxKind, ok: boolean, g: Game) {
    this.kind = kind; this.ok = ok; this.t = 0; this.dur = ok ? PLAN[kind].dur : Math.min(PLAN[kind].dur, PLAN[kind].burst + 4);
    this.motes = []; this.clouds = []; this.bolts = []; this.shards = []; this.petals = []; this.ringT = [];
    this.boltI = 0; this.burstDone = false; this.birthBell = false; this.said.clear(); this.lift = 0; this.gloom = 0; this.flash = 0; this.cloudTint = null; this.cloudTintKey = '';
    const big = kind === 'jieying' || kind === 'huashen';
    const nm = kind === 'zhuji' ? 80 : kind === 'jiedan' ? 120 : 190;
    for (let i = 0; i < nm; i++) this.motes.push({ a: Math.random() * TAU, r: 500 + Math.random() * 900, sp: 0.5 + Math.random() * 0.9, s: 1.2 + Math.random() * 2.4, w: 0.6 + Math.random() * 1.6, e: Math.random() * 5, ph: Math.random() * TAU });
    const nc = kind === 'zhuji' ? 34 : big ? 116 : 78;
    for (let i = 0; i < nc; i++) { const r = Math.pow(Math.random(), 0.7); this.clouds.push({ a: Math.random() * TAU, r: 260 + r * (big ? 1150 : 760), s: (60 + Math.random() * 120) * (big ? 1.25 : 1), sp: (0.25 + Math.random() * 0.35) * (Math.random() < 0.08 ? -0.4 : 1), dark: 0.55 + Math.random() * 0.4, ph: Math.random() * TAU }); }
    g.player.sitting = true;
    g.cinema(g.player.x, g.player.y - 80, big ? 1.32 : 1.2, this.dur - 2);
    audio.sfx('chime');
    this.exclaim(g, 'gather');
  }

  update(dt: number, g: Game) {
    if (!this.kind) return;
    const P = PLAN[this.kind], p = g.player, st = p.st;
    this.t += dt; this.px = p.x; this.py = p.y;
    const t = this.t;
    p.sitting = true;
    // 暗化：聚气时渐暗，风云时最暗，出世时云开雾散
    const dark = this.kind === 'zhuji' ? 0.22 : this.kind === 'jiedan' ? 0.42 : 0.6;
    const want = !this.ok && t > P.burst ? dark * 0.7 * (1 - smooth(P.burst, P.burst + 3, t)) : dark * smooth(P.gather[0] + 1, P.storm[0] + 1, t) * (1 - smooth(P.birth[0], P.birth[0] + 2.5, t));
    this.gloom += (want - this.gloom) * Math.min(1, dt * 2);
    this.flash = Math.max(0, this.flash - dt * (this.flash > 0.6 ? 1.6 : 2.6));
    // 悬浮：风云起时离地，出世时更高，余韵落回
    const wantLift = this.kind === 'zhuji' ? 0 : smooth(P.storm[0], P.storm[0] + 3, t) * 26 + smooth(P.burst, P.burst + 1.5, t) * 30 - smooth(P.birth[1], P.birth[1] + 2, t) * 56;
    this.lift += (wantLift - this.lift) * Math.min(1, dt * 1.5);
    if (this.lift > 0.5) st.lift = this.lift;
    // 灵气汇聚
    const gk = smooth(P.gather[0], P.gather[0] + 2, t);
    for (const m of this.motes) {
      const pull = (0.35 + gk * 1.1) * m.sp * (t > P.burst - 1.2 && t < P.burst ? 6 : 1);
      m.r = Math.max(14, m.r - pull * 110 * dt); m.a += (m.w / Math.max(0.4, m.r / 200)) * dt * 0.6;
      if (m.r <= 16 || (t > P.birth[0] && this.ok)) { if (t < P.burst - 0.2) { m.r = 600 + Math.random() * 900; m.a = Math.random() * TAU; } else m.r = 1e9; }
    }
    // 云：旋聚
    const sk = smooth(P.storm[0], P.storm[0] + 3.5, t), open = this.ok ? smooth(P.birth[0], P.birth[0] + 3, t) : smooth(P.burst, P.burst + 2.5, t);
    for (const c of this.clouds) { c.a += c.sp * dt * (0.5 + sk) * (1 - open * 0.7); if (open > 0) c.r += (this.ok ? 420 : 160) * dt * open; else if (sk > 0 && c.r > 200) c.r -= 18 * dt * sk; }
    // 天雷
    if (this.boltI < P.bolts.length && t >= P.bolts[this.boltI]) { this.boltI++; this.strike(g); }
    for (const b of this.bolts) b.t += dt; this.bolts = this.bolts.filter((b) => b.t < 0.5);
    // 碎丹 / 凝丹 / 筑基成
    if (!this.burstDone && t >= P.burst) {
      this.burstDone = true;
      if (this.ok) {
        this.flash = this.kind === 'zhuji' ? 0.55 : 1; this.flashCol = this.kind === 'huashen' ? [1, 0.86, 1] : [1, 0.98, 0.9];
        g.juice(0.08, this.kind === 'zhuji' ? 0.35 : 0.95); audio.sfx(this.kind === 'zhuji' ? 'break' : 'boom'); if (this.kind !== 'zhuji') setTimeout(() => audio.sfx('thunder'), 120);
        this.ringT = [0, -0.25, -0.5];
        const ns = this.kind === 'zhuji' ? 0 : this.kind === 'jiedan' ? 36 : 90;
        for (let i = 0; i < ns; i++) { const a = Math.random() * TAU, v = 260 + Math.random() * 520; this.shards.push({ x: p.x, y: p.y - 70 - this.lift, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 140, t: 0, s: 3 + Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12 }); }
        g.renderer?.burst(p.x, p.y - 70, PALETTE[this.kind].main, 80);
        this.exclaim(g, 'burst');
      } else {
        this.flash = 0.8; this.flashCol = [1, 0.3, 0.3]; g.juice(0.1, 0.8); audio.sfx('fail'); audio.sfx('thunder');
        for (let i = 0; i < 60; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 220; this.shards.push({ x: p.x, y: p.y - 70 - this.lift, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.4 - 60, t: 0, s: 2 + Math.random() * 5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 }); }
        this.exclaim(g, 'fail');
      }
    }
    for (let i = 0; i < this.ringT.length; i++) this.ringT[i] += dt;
    for (const s of this.shards) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += (this.ok ? 240 : 420) * dt; s.vx *= 1 - dt * 0.9; s.rot += s.vr * dt; if (this.ok && s.t > 1.1) { const dx = p.x - s.x, dy = p.y - 80 - s.y, dd = Math.hypot(dx, dy) || 1; s.vx += dx / dd * 900 * dt; s.vy += dy / dd * 900 * dt - 240 * dt; } }
    this.shards = this.shards.filter((s) => s.t < (this.ok ? 2.2 : 3.2));
    // 出世：钟鸣、花雨、仙鹤
    if (this.ok && t >= P.birth[0]) {
      if (!this.birthBell) { this.birthBell = true; audio.sfx('bell'); setTimeout(() => audio.sfx('chime'), 500); this.exclaim(g, 'birth'); (g.life as any).summonCranes?.(p.x, p.y, this.kind === 'zhuji' ? 1 : 3); }
      if (this.petals.length < (this.kind === 'zhuji' ? 34 : 110) && t < P.birth[1]) for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, r = 40 + Math.random() * 520; this.petals.push({ x: p.x + Math.cos(a) * r, y: p.y - 380 - Math.random() * 260, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, t: Math.random() * 2, s: 3 + Math.random() * 4, rot: Math.random() * TAU, col: this.kind === 'huashen' ? (Math.random() < 0.5 ? '#f4b0ff' : '#ffd8f8') : Math.random() < 0.55 ? '#ffd0dc' : Math.random() < 0.5 ? '#ffe9a0' : '#fff6e0' }); }
      if (t >= P.text && !this.said.has('text')) { this.said.add('text'); audio.sfx('gain'); }
    }
    for (const f of this.petals) { f.t += dt; f.x += (f.vx + Math.sin(f.t * 2.1 + f.rot) * 26) * dt; f.y += f.vy * dt; f.rot += dt * 1.6; }
    this.petals = this.petals.filter((f) => f.y < p.y + 60 && f.t < 14);
    if (t >= this.dur) this.end(g);
  }

  private strike(g: Game) {
    const p = g.player, x0 = p.x + (Math.random() - 0.5) * 60, y0 = p.y - 1500, x1 = p.x, y1 = p.y - 70 - this.lift;
    const pts: [number, number][] = [[x0, y0]]; const n = 18; const branches: [number, number][][] = [];
    for (let i = 1; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k + (i < n ? (Math.random() - 0.5) * 110 * (1 - k * 0.6) : 0), y = y0 + (y1 - y0) * k; pts.push([x, y]); if (i > 4 && i < n - 3 && Math.random() < 0.35) { const br: [number, number][] = [[x, y]]; let bx = x, by = y; for (let j = 0; j < 5; j++) { bx += (Math.random() - 0.5) * 90; by += 40 + Math.random() * 40; br.push([bx, by]); } branches.push(br); } }
    this.bolts.push({ pts, t: 0, w: 3 + Math.random() * 3, branches });
    this.flash = Math.max(this.flash, 0.5 + Math.random() * 0.25); this.flashCol = this.kind === 'huashen' ? [0.95, 0.8, 1] : [0.9, 0.9, 1];
    g.juice(0.03, 0.45); audio.sfx('thunder');
    g.renderer?.burst(x1, y1, this.kind === 'huashen' ? '#ffb0ff' : '#e8e0ff', 22);
    if (this.boltI === 2) this.exclaim(g, 'storm');
  }

  /** 周围的人：驻足、惊呼、跪拜 */
  private exclaim(g: Game, when: 'gather' | 'storm' | 'burst' | 'birth' | 'fail') {
    if (this.said.has(when)) return; this.said.add(when);
    const k = this.kind!, name = k === 'zhuji' ? '筑基' : k === 'jiedan' ? '结丹' : k === 'jieying' ? '结婴' : '化神';
    const L: Record<string, string[]> = {
      gather: ['这灵气……怎么都往那边涌？', '有人要突破了！', '快看那边的天！', '好浓的灵气……'],
      storm: ['天雷！是天劫！', '这是……' + name + '的天象！', '退后！别被雷劈着！', '我的天……', '此人要' + name + '了！'],
      burst: k === 'zhuji' ? ['成了！筑基成了！', '恭喜道友筑基！'] : k === 'jiedan' ? ['金丹！他结丹了！', '丹成霞光……我这辈子头回见！', '结丹前辈！'] : ['元婴……是元婴！', '天哪，碎丹成婴！', '跪下！快跪下！', '方圆几百里都看得见这道光！', '元婴老祖……'],
      birth: ['霞光万道……', '仙鹤都来了！', '今日之事，够我吹一辈子了。', '恭贺前辈！', '此生无憾，得见此景。'],
      fail: ['不好——失败了！', '可惜……功亏一篑。', '快去扶他！', '天意弄人……'],
    };
    const r = k === 'zhuji' ? 1400 : k === 'jiedan' ? 2600 : 4200;
    (g.npcs as any).exclaim?.(g.player.x, g.player.y, r, L[when], when === 'burst' || when === 'birth' ? (k === 'jieying' || k === 'huashen' ? 'kneel' : 'bow') : 'watch');
  }

  private end(g: Game) {
    const k = this.kind!; this.kind = null; this.gloom = 0; this.lift = 0;
    g.player.st.lift = 0; g.cine.dur = 0;
    if (this.ok && k !== 'zhuji') g.ascendDone?.();
  }

  // ------------------------------------------------------------------ 绘制（世界坐标）
  drawWorld(ctx: G, z: number) {
    if (!this.kind) return;
    const k = this.kind, P = PLAN[k], C = PALETTE[k], T = this.t, px = this.px, py = this.py, big = k === 'jieying' || k === 'huashen';
    const [gr, gg, gb] = C.glow;
    const headY = py - 70 - this.lift;
    ctx.save();
    // 1. 地面灵阵：双环、符文刻度、旋转
    const ak = smooth(P.gather[0], P.gather[0] + 2.5, T) * (1 - smooth(this.dur - 2.5, this.dur, T));
    if (ak > 0.01) {
      ctx.save(); ctx.translate(px, py + 4); ctx.scale(1, 0.46);
      ctx.globalCompositeOperation = 'lighter';
      const R0 = (k === 'zhuji' ? 110 : big ? 190 : 150) * (1 + 0.04 * Math.sin(T * 2));
      const flick = 0.75 + 0.25 * Math.sin(T * 7);
      for (let i = 0; i < 3; i++) {
        const rr = R0 * (1 - i * 0.26), rot = T * (i % 2 ? -0.35 : 0.5) + i;
        ctx.strokeStyle = `rgba(${gr},${gg},${gb},${(0.5 - i * 0.1) * ak * flick})`; ctx.lineWidth = i === 0 ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        if (i < 2) { ctx.lineWidth = 1.2; const n = i === 0 ? 36 : 16; for (let j = 0; j < n; j++) { const a = rot + j / n * TAU, l = j % 4 === 0 ? 14 : 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a) * (rr - l), Math.sin(a) * (rr - l)); ctx.stroke(); } }
      }
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${0.3 * ak})`; ctx.lineWidth = 1;
      ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = -T * 0.3 + j / 8 * TAU, r = R0 * 0.72; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke();
      for (let j = 0; j < 8; j++) { const a = -T * 0.3 + j / 8 * TAU, r = R0 * 0.72; const g2 = ctx.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, 14); g2.addColorStop(0, `rgba(255,255,255,${0.8 * ak})`); g2.addColorStop(0.3, `rgba(${gr},${gg},${gb},${0.5 * ak})`); g2.addColorStop(1, `rgba(${gr},${gg},${gb},0)`); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 14, 0, TAU); ctx.fill(); }
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, R0 * 0.7); cg.addColorStop(0, `rgba(${gr},${gg},${gb},${0.28 * ak * flick})`); cg.addColorStop(1, `rgba(${gr},${gg},${gb},0)`); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, R0 * 0.7, 0, TAU); ctx.fill();
      ctx.restore();
      // 地裂：风云期从阵心向外蔓延的裂纹（结婴 / 化神）
      if (big && T > P.storm[0] + 2) {
        const ck = smooth(P.storm[0] + 2, P.storm[0] + 6, T) * (1 - smooth(this.dur - 3, this.dur, T));
        ctx.save(); ctx.strokeStyle = `rgba(${gr},${gg},${gb},${0.55 * ck * (0.7 + 0.3 * Math.sin(T * 9))})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.4, L = (120 + (i * 37 % 90)) * ck; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 1; j <= 5; j++) { const x = px + Math.cos(a + Math.sin(j * 2.3 + i) * 0.25) * L * j / 5, y = py + Math.sin(a + Math.sin(j * 2.3 + i) * 0.25) * L * j / 5 * 0.46; ctx.lineTo(x, y); } ctx.stroke(); }
        ctx.restore();
      }
    }
    // 2. 灵气光点：从四面八方螺旋倒灌（五行五色）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      if (m.r > 5000) continue;
      const x = px + Math.cos(m.a) * m.r, y = headY + Math.sin(m.a) * m.r * 0.5 - Math.sin(m.ph + T * 2) * 10 - (1 - Math.min(1, m.r / 600)) * 20;
      const a = clamp(1.1 - m.r / 1400, 0.08, 0.9) * (0.7 + 0.3 * Math.sin(T * 6 + m.ph));
      const hue = m.e < 1 ? '120,230,160' : m.e < 2 ? '255,120,90' : m.e < 3 ? '240,220,120' : m.e < 4 ? '255,250,230' : '100,170,255';
      const col = big && this.phase !== 'birth' ? hue : `${gr},${gg},${gb}`;
      if (MOTE_SPR) { ctx.globalAlpha = a; const s = m.s * 4.5; ctx.drawImage(MOTE_SPR, x - s, y - s, s * 2, s * 2); ctx.globalAlpha = a * 0.35; ctx.drawImage(MOTE_SPR, x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4); }
      else { ctx.fillStyle = `rgba(${col},${a})`; ctx.beginPath(); ctx.arc(x, y, m.s, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = `rgba(${col},${a * 0.35})`; ctx.lineWidth = m.s * 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(m.a) * 16 * m.w, y - Math.cos(m.a) * 8 * m.w); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 3. 周身灵光（随聚气越来越盛）；碎丹前胸口那一点越来越亮、越来越抖
    const auraK = smooth(P.gather[0], P.gather[1], T) * (this.ok || T < P.burst ? 1 : 1 - smooth(P.burst, P.burst + 1, T));
    if (auraK > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rr = 60 + auraK * 60 + Math.sin(T * 5) * 6 + (T > P.burst - 1.2 && T < P.burst ? (P.burst - T) * 40 : 0);
      const ag = ctx.createRadialGradient(px, headY + 20, 0, px, headY + 20, rr);
      ag.addColorStop(0, `rgba(255,255,255,${0.35 * auraK})`); ag.addColorStop(0.4, `rgba(${gr},${gg},${gb},${0.32 * auraK})`); ag.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.ellipse(px, headY + 20, rr, rr * 1.3, 0, 0, TAU); ctx.fill();
      if (k !== 'zhuji' && T > P.storm[0] + 1 && T < P.burst) {
        const dk = smooth(P.storm[0] + 1, P.burst - 0.3, T), jit = T > P.burst - 1.6 ? (Math.random() - 0.5) * 6 : 0;
        const dg = ctx.createRadialGradient(px + jit, headY + 28, 0, px + jit, headY + 28, 22 + dk * 18);
        dg.addColorStop(0, `rgba(255,255,255,${0.9 * dk})`); dg.addColorStop(0.35, `rgba(${gr},${gg},${gb},${0.8 * dk})`); dg.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(px + jit, headY + 28, 22 + dk * 18, 0, TAU); ctx.fill();
        if (big && T > P.burst - 3) { const n = Math.floor((T - (P.burst - 3)) * 4); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; for (let i = 0; i < n && i < 12; i++) { const a = i * 2.4, l = 6 + (i * 7) % 9; ctx.beginPath(); ctx.moveTo(px + jit + Math.cos(a) * 3, headY + 28 + Math.sin(a) * 3); ctx.lineTo(px + jit + Math.cos(a + 0.4) * l, headY + 28 + Math.sin(a + 0.4) * l); ctx.stroke(); } }
      }
      ctx.restore();
    }
    // 4. 风云漩涡（头顶高空）
    const sk = smooth(P.storm[0], P.storm[0] + 3, T), open = this.ok ? smooth(P.birth[0], P.birth[0] + 3.2, T) : smooth(P.burst, P.burst + 2.5, T);
    const ck = sk * (1 - open);
    if (ck > 0.01) {
      const cy = headY - (big ? 520 : 400), [cr, cg2, cb] = C.cloud;
      ctx.save();
      const ek = smooth(P.storm[0] + 1.5, P.storm[0] + 4, T) * ck, [er, eg, eb] = C.eye;
      const eye = ctx.createRadialGradient(px, cy, 0, px, cy, 260); eye.addColorStop(0, `rgba(${er},${eg},${eb},${0.55 * ek * (0.75 + 0.25 * Math.sin(T * 3))})`); eye.addColorStop(0.35, `rgba(${er},${eg},${eb},${0.18 * ek})`); eye.addColorStop(1, `rgba(${er},${eg},${eb},0)`);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = eye; ctx.beginPath(); ctx.ellipse(px, cy, 260, 120, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'source-over';
      if (CLOUD_SPR) {
        const lit = this.flash * 0.7 + ek * 0.55;
        // 每朵云一次染色（缓存，风云变色时才重建）
        const tintKey = Math.round(lit * 24) + '|' + k;
        if (this.cloudTintKey !== tintKey) { this.cloudTintKey = tintKey; this.cloudTint = null; }
        if (!this.cloudTint) {
          const c2 = document.createElement('canvas'); c2.width = c2.height = 160; const g2 = c2.getContext('2d')!;
          g2.drawImage(CLOUD_SPR, 0, 0);
          g2.globalCompositeOperation = 'multiply';
          g2.fillStyle = `rgb(${Math.min(255, cr + lit * 130) | 0},${Math.min(255, cg2 + lit * 120) | 0},${Math.min(255, cb + lit * 100) | 0})`;
          g2.fillRect(0, 0, 160, 160);
          g2.globalCompositeOperation = 'destination-in'; g2.drawImage(CLOUD_SPR, 0, 0);
          this.cloudTint = c2;
        }
        for (const c of this.clouds) {
          const x = px + Math.cos(c.a) * c.r, y = cy + Math.sin(c.a) * c.r * 0.42 + Math.sin(c.ph + T) * 6;
          const near = clamp(1 - c.r / 1300, 0, 1);
          ctx.globalAlpha = clamp(c.dark * ck * (0.4 + near * 0.55) * (1 - open), 0, 1);
          ctx.drawImage(this.cloudTint, x - c.s, y - c.s * 0.46, c.s * 2, c.s * 0.92);
        }
        ctx.globalAlpha = 1;
      } else for (const c of this.clouds) {
        const x = px + Math.cos(c.a) * c.r, y = cy + Math.sin(c.a) * c.r * 0.42 + Math.sin(c.ph + T) * 6;
        const near = clamp(1 - c.r / 1300, 0, 1);
        const a = c.dark * ck * (0.35 + near * 0.45) * (1 - open);
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, c.s);
        const lit = this.flash * 0.6 + ek * near * 0.5;
        g2.addColorStop(0, `rgba(${cr + lit * 120 | 0},${cg2 + lit * 110 | 0},${cb + lit * 90 | 0},${a})`); g2.addColorStop(0.55, `rgba(${cr},${cg2},${cb},${a * 0.8})`); g2.addColorStop(1, `rgba(${cr},${cg2},${cb},0)`);
        ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(x, y, c.s, c.s * 0.46, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // 5. 天雷
    for (const b of this.bolts) {
      const a = b.t < 0.08 ? 1 : Math.max(0, 1 - (b.t - 0.08) / 0.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const col = k === 'huashen' ? '240,170,255' : '200,190,255';
      for (const [w, al] of [[b.w * 4, 0.18], [b.w * 1.6, 0.5], [b.w * 0.55, 1]] as [number, number][]) {
        ctx.strokeStyle = w < b.w ? `rgba(255,255,255,${al * a})` : `rgba(${col},${al * a})`; ctx.lineWidth = w;
        ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        for (const br of b.branches) { ctx.lineWidth = w * 0.5; ctx.beginPath(); br.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
      }
      const last = b.pts[b.pts.length - 1]; const ig = ctx.createRadialGradient(last[0], last[1], 0, last[0], last[1], 90 + b.t * 200);
      ig.addColorStop(0, `rgba(255,255,255,${0.8 * a})`); ig.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(last[0], last[1], 90 + b.t * 200, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 6. 冲击波环与碎片
    for (const rt of this.ringT) {
      if (rt < 0 || rt > 2.2) continue;
      const rr = ease(rt / 2.2) * (big ? 1500 : 900), a = (1 - rt / 2.2) * 0.8;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${gr},${gg},${gb},${a})`; ctx.lineWidth = 14 * (1 - rt / 2.2) + 2;
      ctx.beginPath(); ctx.ellipse(px, py, rr, rr * 0.46, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py, rr * 0.96, rr * 0.46 * 0.96, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (this.shards.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of this.shards) { const a = this.ok ? clamp(1.2 - s.t / 2.2, 0, 1) : clamp(1.2 - s.t / 3.2, 0, 1); ctx.fillStyle = this.ok ? `rgba(255,${k === 'huashen' ? 200 : 236},${k === 'huashen' ? 255 : 170},${a})` : `rgba(255,90,80,${a})`; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.beginPath(); ctx.moveTo(-s.s, 0); ctx.lineTo(0, -s.s * 0.5); ctx.lineTo(s.s, 0); ctx.lineTo(0, s.s * 0.5); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
    }
    // 7. 出世：光柱、天光、金莲、元婴、花雨、大字
    if (this.ok && T >= P.birth[0]) {
      const bk = smooth(P.birth[0], P.birth[0] + 1.2, T), fade = 1 - smooth(this.dur - 3, this.dur - 0.3, T);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pw = (k === 'zhuji' ? 40 : big ? 110 : 70) * (0.9 + 0.1 * Math.sin(T * 4)), ph = 2200;
      const pg = ctx.createLinearGradient(px - pw, 0, px + pw, 0); pg.addColorStop(0, `rgba(${gr},${gg},${gb},0)`); pg.addColorStop(0.5, `rgba(255,255,255,${0.55 * bk * fade})`); pg.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = pg; ctx.fillRect(px - pw, py - ph, pw * 2, ph + 10);
      const pg2 = ctx.createLinearGradient(0, py - ph, 0, py); pg2.addColorStop(0, `rgba(${gr},${gg},${gb},${0.25 * bk * fade})`); pg2.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = pg2; ctx.fillRect(px - pw * 2.2, py - ph, pw * 4.4, ph);
      const nR = k === 'zhuji' ? 6 : big ? 16 : 10, cy = headY - (big ? 520 : 400);
      for (let i = 0; i < nR; i++) { const a = T * 0.25 + i / nR * TAU, L = 900 + 300 * Math.sin(i * 1.7 + T), w = 0.07 + 0.03 * Math.sin(i + T * 2); const x1 = px + Math.cos(a) * L, y1 = cy + Math.sin(a) * L * 0.5; const g3 = ctx.createLinearGradient(px, cy, x1, y1); g3.addColorStop(0, `rgba(255,255,255,${0.22 * bk * fade})`); g3.addColorStop(1, `rgba(${gr},${gg},${gb},0)`); ctx.fillStyle = g3; ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px + Math.cos(a - w) * L, cy + Math.sin(a - w) * L * 0.5); ctx.lineTo(px + Math.cos(a + w) * L, cy + Math.sin(a + w) * L * 0.5); ctx.closePath(); ctx.fill(); }
      const sy = headY - 40 - smooth(P.birth[0], P.birth[0] + 2.5, T) * 70, sc = ease(smooth(P.birth[0] + 0.3, P.birth[0] + 2.2, T));
      if (sc > 0.01) {
        const halo = ctx.createRadialGradient(px, sy, 0, px, sy, 90 * sc); halo.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`); halo.addColorStop(0.5, `rgba(${gr},${gg},${gb},${0.35 * fade})`); halo.addColorStop(1, `rgba(${gr},${gg},${gb},0)`); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, sy, 90 * sc, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,250,220,${0.7 * fade})`; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(px, sy + 6, 46 * sc, 16 * sc, T * (i ? -0.7 : 0.9), 0, TAU); ctx.stroke(); }
        if (big) {
          for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + layer * 0.39 + T * 0.1, r = (26 + layer * 10) * sc; ctx.fillStyle = layer ? `rgba(255,226,150,${0.75 * fade})` : `rgba(255,245,210,${0.85 * fade})`; ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * r, sy + 30 * sc + Math.sin(a) * r * 0.35, 13 * sc, 7 * sc, a, 0, TAU); ctx.fill(); }
          ctx.globalCompositeOperation = 'source-over';
          if (this.soul && this.soul.complete && this.soul.naturalWidth) { const h = 78 * sc * (k === 'huashen' ? 1.15 : 1), w = h * this.soul.naturalWidth / this.soul.naturalHeight; ctx.globalAlpha = fade; ctx.drawImage(this.soul, px - w / 2, sy + 22 * sc - h, w, h); ctx.globalAlpha = 1; }
          else { ctx.fillStyle = `rgba(255,240,200,${fade})`; ctx.beginPath(); ctx.arc(px, sy - 20 * sc, 9 * sc, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(px, sy + 4 * sc, 14 * sc, 18 * sc, 0, 0, TAU); ctx.fill(); }
          ctx.globalCompositeOperation = 'lighter';
        } else {
          const dg = ctx.createRadialGradient(px - 6 * sc, sy - 6 * sc, 0, px, sy, 22 * sc); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.5, C.main); dg.addColorStop(1, `rgba(${gr},${gg},${gb},0.2)`); ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(px, sy, 22 * sc, 0, TAU); ctx.fill();
          if (k === 'jiedan') { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = T * 1.5 + i; ctx.beginPath(); ctx.arc(px + Math.cos(a) * 15 * sc, sy + Math.sin(a) * 15 * sc, 2.5, 0, TAU); ctx.stroke(); } }
        }
      }
      for (const f of this.petals) { const a = clamp(f.t * 1.5, 0, 1) * fade; ctx.globalAlpha = a * 0.9; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
      ctx.restore();
      // 书法大字 + 朱印（悬在头顶上方；随镜头缩放保持清晰）
      const tk = smooth(P.text, P.text + 1.4, T) * fade;
      if (tk > 0.01) {
        ctx.save(); ctx.translate(px, headY - 250 - (1 - tk) * 30); ctx.scale(1 / Math.max(0.6, z), 1 / Math.max(0.6, z));
        ctx.globalAlpha = tk;
        ctx.font = `${big ? 92 : 76}px "Ma Shan Zheng","Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = `rgba(${gr},${gg},${gb},0.9)`; ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(30,22,16,0.9)'; ctx.fillText(C.txt, 0, 0);
        ctx.shadowBlur = 0; ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(T * 3)})`; ctx.fillText(C.txt, -1, -1);
        ctx.translate(big ? 112 : 92, 28); ctx.rotate(0.08);
        ctx.fillStyle = 'rgba(178,34,34,0.92)'; ctx.fillRect(-20, -20, 40, 40);
        ctx.fillStyle = '#fbeedd'; ctx.font = '16px "Noto Serif SC",serif'; ctx.fillText(C.seal[0], 0, -8); ctx.fillText(C.seal[1], 0, 9);
        ctx.restore();
      }
    }
    if (!this.ok && T > P.burst) {
      const fk = (1 - smooth(P.burst, P.burst + 3, T)) * 0.5; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(px, headY, 0, px, headY, 260); rg.addColorStop(0, `rgba(255,60,50,${fk})`); rg.addColorStop(1, 'rgba(255,0,0,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, headY, 260, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  /** 屏幕空间：闪白 / 暗角（非 GL 模式画闪白；GL 模式的闪白走后期着色器） */
  drawScreen(ctx: G, W: number, H: number, dpr: number, glMode: boolean) {
    if (!this.kind) return;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!glMode && this.flash > 0.01) { const [r, g, b] = this.flashCol; ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${Math.min(1, this.flash) * 0.9})`; ctx.fillRect(0, 0, W, H); }
    const vk = this.gloom * 1.2 + (this.phase === 'birth' ? 0.1 : 0);
    if (vk > 0.02) { const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, vk)})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
}
