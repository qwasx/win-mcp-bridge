// 神识：按境界分级的水墨神识特效 + 法宝/功法修饰 + 圈外“记忆水墨”
// 设计要点：所有动画都由连续时间驱动（无跳变）；纹理预渲染后旋转/缩放绘制，保证丝滑。
import { mulberry32 } from '../core/rng';
import type { FxSys } from '../gl/fx';
import type { GLStage } from '../gl/stage';
import { C as CELL } from '../gl/atlas';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const TEX = 1024, TR = 470; // 纹理尺寸与其中圆环半径

export type SenseMod = 'dayan' | 'wood' | 'thunder' | 'demon' | 'insect' | 'ice' | 'fire' | 'sword';
export const SENSE_MOD_NAME: Record<SenseMod, string> = {
  dayan: '大衍决·神识八卦', wood: '养魂木·藤纹', thunder: '辟邪神雷·雷丝', demon: '魔功·血雾', insect: '噬金虫·金芒', ice: '玄冰·霜华', fire: '真火·焰纹', sword: '剑意·剑芒',
};

export interface TierStyle {
  name: string;
  ink: [number, number, number];      // 墨圈主色
  glow: [number, number, number];     // 光色
  ripples: number;                    // 同时存在的涟漪数
  period: number;                     // 涟漪周期
  runes: boolean; motes: number; yinyang: boolean; stars: boolean; lotus: boolean;
}
export const TIERS: TierStyle[] = [
  { name: '凡人', ink: [90, 100, 96], glow: [190, 210, 200], ripples: 1, period: 6, runes: false, motes: 0, yinyang: false, stars: false, lotus: false },
  { name: '炼气·水墨', ink: [52, 112, 100], glow: [150, 225, 205], ripples: 1, period: 5, runes: false, motes: 0, yinyang: false, stars: false, lotus: false },
  { name: '筑基·青纹', ink: [40, 104, 118], glow: [130, 220, 230], ripples: 2, period: 4.6, runes: false, motes: 6, yinyang: false, stars: false, lotus: true },
  { name: '结丹·金篆', ink: [128, 96, 40], glow: [255, 214, 120], ripples: 2, period: 4.2, runes: true, motes: 14, yinyang: false, stars: false, lotus: true },
  { name: '元婴·阴阳', ink: [96, 64, 128], glow: [220, 190, 255], ripples: 3, period: 4, runes: true, motes: 18, yinyang: true, stars: false, lotus: true },
  { name: '化神·星图', ink: [150, 50, 44], glow: [255, 200, 180], ripples: 3, period: 3.6, runes: true, motes: 24, yinyang: true, stars: true, lotus: true },
];

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

function mk(w = TEX, h = TEX) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** Mipmap：缩小绘制时选用最接近屏幕尺寸的预缩小纹理，避免细线在旋转时闪烁、爬行（“不丝滑”的主因） */
const MIPS = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
function mip(img: HTMLCanvasElement, screenPx: number): HTMLCanvasElement {
  let arr = MIPS.get(img);
  if (!arr) { arr = [img]; MIPS.set(img, arr); }
  let lv = 0;
  while (lv < 5 && arr[lv].width * 0.5 >= screenPx * 1.15) {
    if (!arr[lv + 1]) {
      const src = arr[lv];
      const c = mk(Math.max(8, src.width >> 1), Math.max(8, src.height >> 1));
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, c.width, c.height);
      arr[lv + 1] = c;
    }
    lv++;
  }
  return arr[lv];
}
const DPR = () => (typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1);

/** 干笔水墨圆环：许多段不规则弧线叠加 */
function inkRing(col: [number, number, number], seed: number, rough = 1) {
  const c = mk(); const g = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const C = TEX / 2;
  g.lineCap = 'round';
  // 内侧晕染
  const gr = g.createRadialGradient(C, C, TR * 0.8, C, C, TR * 1.02);
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.75, rgba(col, 0.05)); gr.addColorStop(1, rgba(col, 0.16));
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, TR * 1.02, 0, TAU); g.fill();
  // 主笔：粗细起伏的墨线
  for (let pass = 0; pass < 3; pass++) {
    let a = rnd() * TAU;
    const end = a + TAU * (0.9 + rnd() * 0.15);
    while (a < end) {
      const len = 0.25 + rnd() * 0.7;
      const r0 = TR + (rnd() - 0.5) * 7 * rough;
      const w = (pass === 0 ? 5.5 : 2.2) * (0.6 + rnd() * 0.8);
      g.strokeStyle = rgba(col, (pass === 0 ? 0.5 : 0.32) * (0.6 + rnd() * 0.5));
      g.lineWidth = w;
      g.beginPath();
      for (let k = 0; k <= 16; k++) {
        const t = a + len * k / 16;
        const taper = Math.sin((k / 16) * Math.PI);
        const r = r0 + Math.sin(t * 7 + pass) * 2.5 * rough + (rnd() - 0.5) * 1.2;
        const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
        void taper;
      }
      g.stroke();
      a += len + rnd() * 0.25;
    }
  }
  // 飞白：细碎的干笔丝
  for (let i = 0; i < 260; i++) {
    const t = rnd() * TAU, r = TR + (rnd() - 0.5) * 14 * rough, l = 0.01 + rnd() * 0.05;
    g.strokeStyle = rgba(col, 0.12 + rnd() * 0.25); g.lineWidth = 0.6 + rnd() * 1.4;
    g.beginPath(); g.arc(C, C, r, t, t + l); g.stroke();
  }
  // 墨点
  for (let i = 0; i < 40; i++) {
    const t = rnd() * TAU, r = TR + (rnd() - 0.5) * 18;
    g.fillStyle = rgba(col, 0.15 + rnd() * 0.3);
    g.beginPath(); g.arc(C + Math.cos(t) * r, C + Math.sin(t) * r, 0.8 + rnd() * 2.6, 0, TAU); g.fill();
  }
  return c;
}

/** 游走笔触：几道粗细渐变的长弧笔，反向旋转时形成“流动”的水墨感 */
function brushArcs(col: [number, number, number], seed: number, n = 5, rOff = 0) {
  const c = mk(); const g = c.getContext('2d')!;
  const rnd = mulberry32(seed); const C = TEX / 2;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + rnd() * 0.6, len = 0.5 + rnd() * 0.7;
    const r0 = TR + rOff + (rnd() - 0.5) * 10;
    const wMax = 4 + rnd() * 5;
    const SEG = 40;
    for (let k = 0; k < SEG; k++) {
      const u = k / SEG, t0 = a0 + len * u, t1 = a0 + len * (k + 1) / SEG;
      const taper = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.7) * (1 - u * 0.35);
      g.strokeStyle = rgba(col, 0.75 * taper + 0.05);
      g.lineWidth = Math.max(0.6, wMax * taper);
      const r = r0 + Math.sin(u * 5 + i) * 3;
      g.beginPath(); g.arc(C, C, r, t0, t1 + 0.004); g.stroke();
      // 飞白丝
      if (rnd() < 0.5) { g.strokeStyle = rgba(col, 0.25 * taper); g.lineWidth = 0.8; g.beginPath(); g.arc(C, C, r + (rnd() - 0.5) * wMax * 1.6, t0, t1); g.stroke(); }
    }
    // 收笔墨点
    g.fillStyle = rgba(col, 0.35);
    const te = a0 + len; g.beginPath(); g.arc(C + Math.cos(te) * r0, C + Math.sin(te) * r0, 1.5 + rnd() * 1.5, 0, TAU); g.fill();
  }
  // 外缘晕染
  const gr = g.createRadialGradient(C, C, TR * 0.99, C, C, TR * 1.07);
  gr.addColorStop(0, rgba(col, 0.1)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(C, C, TR * 1.07, 0, TAU); g.arc(C, C, TR * 0.99, 0, TAU, true); g.fill();
  return c;
}

const RUNE_CHARS = '乾坤震巽坎离艮兑天地玄黄宇宙洪荒日月星辰金木水火土风雷云雨元始太清上清玉清道法自然阴阳五行八卦九宫灵虚真一';
/** 篆文环 */
function runeRing(col: [number, number, number], seed: number, rr = TR * 0.93, count = 36) {
  const c = mk(); const g = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const C = TEX / 2;
  g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1.4;
  g.beginPath(); g.arc(C, C, rr + 18, 0, TAU); g.stroke();
  g.beginPath(); g.arc(C, C, rr - 18, 0, TAU); g.stroke();
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    g.save(); g.translate(C + Math.cos(a) * rr, C + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
    g.strokeStyle = rgba(col, 0.75); g.lineWidth = 1.8;
    // 真实文字（浏览器有中文字体时为篆/楷意的符文）
    const ch = RUNE_CHARS[Math.floor(rnd() * RUNE_CHARS.length)];
    g.fillStyle = rgba(col, 0.85);
    g.font = '26px "STKaiti","KaiTi","Kaiti SC","楷体","Noto Serif SC","Songti SC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 0, 0);
    g.restore();
  }
  return c;
}

/** 祥云纹环（筑基青纹） */
function cloudRing(col: [number, number, number], rr = TR * 0.9, n = 16) {
  const c = mk(); const g = c.getContext('2d')!; const C = TEX / 2;
  g.strokeStyle = rgba(col, 0.7); g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.save(); g.translate(C + Math.cos(a) * rr, C + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
    // 双卷云头 + 尾线
    for (const sgn of [-1, 1]) {
      g.beginPath();
      for (let k = 0; k <= 30; k++) { const u = k / 30, th = u * TAU * 1.15, r = 11 * (1 - u * 0.8); const x = sgn * (10 + Math.cos(th) * r * sgn), y = Math.sin(th) * r; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    g.beginPath(); g.moveTo(-21, 0); g.quadraticCurveTo(-60, 8, -88, 0); g.stroke();
    g.restore();
  }
  g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1;
  g.beginPath(); g.arc(C, C, rr + 20, 0, TAU); g.stroke();
  return c;
}

/** 八卦环（大衍决） */
function baguaRing(col: [number, number, number]) {
  const c = mk(); const g = c.getContext('2d')!;
  const C = TEX / 2, r = TR * 0.8;
  const TRI = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]];
  g.strokeStyle = rgba(col, 0.5); g.lineWidth = 2;
  g.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const x = C + Math.cos(a) * (r + 40), y = C + Math.sin(a) * (r + 40); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  g.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const x = C + Math.cos(a) * (r - 40), y = C + Math.sin(a) * (r - 40); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  g.fillStyle = rgba(col, 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.save(); g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r); g.rotate(a + Math.PI / 2);
    TRI[i].forEach((yang, k) => {
      const y = -14 + k * 14;
      if (yang) g.fillRect(-26, y - 3.5, 52, 7);
      else { g.fillRect(-26, y - 3.5, 22, 7); g.fillRect(4, y - 3.5, 22, 7); }
    });
    g.restore();
  }
  return c;
}

/** 藤纹（养魂木） */
function vineRing(seed: number) {
  const c = mk(); const g = c.getContext('2d')!;
  const rnd = mulberry32(seed); const C = TEX / 2;
  g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass ? 'rgba(150,210,120,0.55)' : 'rgba(60,110,60,0.6)'; g.lineWidth = pass ? 1.6 : 3;
    g.beginPath();
    for (let k = 0; k <= 360; k++) { const t = (k / 360) * TAU; const r = TR - 10 + Math.sin(t * 22 + pass) * 9; const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const t = rnd() * TAU, r = TR - 10 + Math.sin(t * 22) * 9;
    const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r;
    g.save(); g.translate(x, y); g.rotate(t + (rnd() - 0.5) * 2);
    g.fillStyle = `rgba(${90 + rnd() * 60 | 0},${160 + rnd() * 60 | 0},${80 + rnd() * 40 | 0},0.7)`;
    g.beginPath(); g.ellipse(7, 0, 7, 3, 0, 0, TAU); g.fill();
    g.restore();
  }
  return c;
}

/** 阴阳鱼水印 */
function yinyang(col: [number, number, number]) {
  const c = mk(512, 512); const g = c.getContext('2d')!;
  const C = 256, r = 230;
  g.fillStyle = rgba(col, 0.9);
  g.beginPath(); g.arc(C, C, r, -Math.PI / 2, Math.PI / 2); g.arc(C, C + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(C, C - r / 2, r / 2, Math.PI / 2, -Math.PI / 2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(C, C - r / 2, r / 7, 0, TAU); g.fill();
  g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(C, C + r / 2, r / 7, 0, TAU); g.fill();
  g.strokeStyle = rgba(col, 0.9); g.lineWidth = 6; g.beginPath(); g.arc(C, C, r, 0, TAU); g.stroke();
  return c;
}

/** 星图（化神） */
function starMap(seed: number) {
  const c = mk(); const g = c.getContext('2d')!;
  const rnd = mulberry32(seed); const C = TEX / 2;
  const stars: [number, number][] = [];
  for (let i = 0; i < 160; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * TR * 0.95; stars.push([C + Math.cos(a) * r, C + Math.sin(a) * r]); }
  g.strokeStyle = 'rgba(255,230,200,0.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) { const a = stars[(rnd() * stars.length) | 0], b = stars[(rnd() * stars.length) | 0]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 160) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
  for (const [x, y] of stars) { const s = 1 + rnd() * 2.6; g.fillStyle = `rgba(255,${230 + rnd() * 25 | 0},${200 + rnd() * 55 | 0},${0.5 + rnd() * 0.5})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,220,190,0.25)'; g.lineWidth = 1;
  for (const k of [0.33, 0.66]) { g.beginPath(); g.arc(C, C, TR * k, 0, TAU); g.stroke(); }
  return c;
}

/** 莲纹（脚下法印） */
function lotus(col: [number, number, number]) {
  const c = mk(512, 512); const g = c.getContext('2d')!;
  const C = 256;
  g.strokeStyle = rgba(col, 0.8); g.lineWidth = 3;
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? 8 : 12, R = layer ? 150 : 220, w = layer ? 0.36 : 0.26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + layer * 0.2;
      g.beginPath(); g.moveTo(C, C);
      g.quadraticCurveTo(C + Math.cos(a - w) * R * 0.75, C + Math.sin(a - w) * R * 0.75, C + Math.cos(a) * R, C + Math.sin(a) * R);
      g.quadraticCurveTo(C + Math.cos(a + w) * R * 0.75, C + Math.sin(a + w) * R * 0.75, C, C);
      g.stroke();
    }
  }
  g.beginPath(); g.arc(C, C, 236, 0, TAU); g.stroke();
  g.beginPath(); g.arc(C, C, 60, 0, TAU); g.stroke();
  return c;
}

interface Tex { ring: HTMLCanvasElement; ring2: HTMLCanvasElement; cloud?: HTMLCanvasElement; rune?: HTMLCanvasElement; rune2?: HTMLCanvasElement; yy?: HTMLCanvasElement; stars?: HTMLCanvasElement; lotus?: HTMLCanvasElement }

export class SenseFx {
  private cache = new Map<string, Tex>();
  private modTex = new Map<string, HTMLCanvasElement>();
  dispR = 0;
  alarm = 0;           // 被更强神识扫到（0–1，随时间衰减）
  burst = 0;           // 神识外放（0–1）
  hidden = 0;          // 敛息（0–1）
  private arcs: { a: number; t: number; seed: number }[] = [];
  private lastT = 0;
  private bugs: { a: number; r: number; s: number; ph: number }[] = [];

  private tex(tier: number): Tex {
    const key = 't' + tier;
    let t = this.cache.get(key);
    if (!t) {
      const S = TIERS[tier];
      t = { ring: inkRing(S.ink, 1000 + tier), ring2: brushArcs(S.ink.map((v) => v * 0.7) as [number, number, number], 2000 + tier, 4 + tier, 12) };
      if (tier === 2) t.cloud = cloudRing(S.glow);
      if (S.runes) { t.rune = runeRing(S.glow, 3000 + tier); t.rune2 = runeRing(S.ink, 3100 + tier, TR * 0.72, 24); }
      if (S.yinyang) t.yy = yinyang(S.ink);
      if (S.stars) t.stars = starMap(4000 + tier);
      if (S.lotus) t.lotus = lotus(S.glow);
      this.cache.set(key, t);
    }
    return t;
  }
  private mod(m: string, tier: number) {
    let c = this.modTex.get(m);
    if (!c) {
      const S = TIERS[tier];
      if (m === 'dayan') c = baguaRing([200, 180, 110]);
      else if (m === 'wood') c = vineRing(77);
      else if (m === 'demon') c = inkRing([150, 30, 36], 88, 2.2);
      else if (m === 'ice') c = runeRing([180, 220, 255], 99, TR * 1.04, 48);
      else if (m === 'fire') c = inkRing([220, 90, 40], 66, 1.8);
      else if (m === 'sword') c = runeRing([200, 240, 230], 55, TR * 0.86, 18);
      else c = inkRing(S.ink, 11);
      this.modTex.set(m, c);
    }
    return c;
  }

  private motes = new Map<number, HTMLCanvasElement>();
  private moteTex(tier: number) {
    let c = this.motes.get(tier);
    if (!c) {
      c = mk(64, 64); const g = c.getContext('2d')!; const col = TIERS[tier].glow;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.25, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.motes.set(tier, c);
    }
    return c;
  }
  /** 预热：首帧前把当前境界纹理都生成好，避免卡顿 */
  warm(tier: number, mods: string[]) { this.tex(Math.min(tier, TIERS.length - 1)); for (const m of mods) if (m !== 'thunder' && m !== 'insect') this.mod(m, tier); }

  update(dt: number, R: number) {
    if (this.dispR <= 0) this.dispR = R;
    this.dispR += (R - this.dispR) * Math.min(1, dt * (R > this.dispR ? 3.2 : 2));
    this.alarm = Math.max(0, this.alarm - dt * 0.6);
    this.burst = Math.max(0, this.burst - dt * 0.35);
  }

  /** 圈外记忆水墨（屏幕空间） */
  drawMemory(g: G, sx: number, sy: number, Rs: number, W: number, H: number, cheap: boolean) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const r0 = Rs * 0.965, r1 = Rs * 1.07;
    if (!cheap) {
      const gs = g.createRadialGradient(sx, sy, r0, sx, sy, r1);
      gs.addColorStop(0, 'rgba(128,128,128,0)'); gs.addColorStop(1, 'rgba(128,128,128,0.88)');
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = gs; g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';
    const gw = g.createRadialGradient(sx, sy, r0, sx, sy, r1 * 1.05);
    gw.addColorStop(0, 'rgba(236,229,210,0)'); gw.addColorStop(1, cheap ? 'rgba(232,226,208,0.55)' : 'rgba(236,229,210,0.36)');
    g.fillStyle = gw; g.fillRect(0, 0, W, H);
    g.restore();
  }

  /** 神识圈（世界坐标） */
  draw(g: G, x: number, y: number, tierIn: number, mods: string[], t: number, z: number) {
    const tier = Math.max(0, Math.min(TIERS.length - 1, tierIn));
    const S = TIERS[tier], T = this.tex(tier);
    const R = this.dispR;
    const k = (R / TR);
    const breath = 1 + Math.sin(t * 0.9) * 0.004;
    const hideA = 1 - this.hidden * 0.6;
    const dpr = DPR();
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 1 / 60; this.lastT = t;
    g.save();
    const drawTex = (img: HTMLCanvasElement, rot: number, scale: number, alpha: number, comp: GlobalCompositeOperation = 'source-over') => {
      if (alpha <= 0.003) return;
      g.save();
      g.globalAlpha = alpha * hideA; g.globalCompositeOperation = comp;
      g.translate(x, y); g.rotate(rot);
      const s = k * scale * breath;
      g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
      g.drawImage(mip(img, TEX * s * z * dpr), -TEX / 2 * s, -TEX / 2 * s, TEX * s, TEX * s);
      g.restore();
    };
    // 1. 圈内淡光（极淡，不遮景）
    const ig = g.createRadialGradient(x, y, R * 0.55, x, y, R);
    ig.addColorStop(0, rgba(S.glow, 0)); ig.addColorStop(1, rgba(S.glow, 0.07 + this.burst * 0.1));
    g.fillStyle = ig; g.beginPath(); g.arc(x, y, R, 0, TAU); g.arc(x, y, R * 0.55, 0, TAU, true); g.fill();
    // 2. 高阶底纹
    if (T.stars) drawTex(T.stars, t * 0.01, 1, 0.22);
    if (T.yy) {
      const r = Math.min(R * 0.42, 420); g.save(); g.globalAlpha = 0.08 * hideA; g.translate(x, y); g.scale(1, 0.55); g.rotate(-t * 0.08);
      g.drawImage(mip(T.yy, r * 2 * z * dpr), -r, -r, r * 2, r * 2); g.restore();
    }
    if (T.lotus) {
      const r = 70 + tier * 10; g.save(); g.globalAlpha = (0.22 + 0.06 * Math.sin(t * 1.7)) * hideA; g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(1, 0.5); g.rotate(t * 0.15);
      g.drawImage(mip(T.lotus, r * 2 * z * dpr), -r, -r, r * 2, r * 2); g.restore();
    }
    // 3. 涟漪：平滑扩散的光带
    for (let i = 0; i < S.ripples; i++) {
      const ph = ((t + i * S.period / S.ripples) % S.period) / S.period;
      const e = 1 - Math.pow(1 - ph, 2.2);
      const rr = R * e, a = Math.pow(1 - ph, 1.6) * Math.min(1, ph * 6) * 0.32;
      if (rr < 8 || a < 0.005) continue;
      const band = 26 / Math.max(0.35, z) + R * 0.04;
      const gr = g.createRadialGradient(x, y, Math.max(0, rr - band), x, y, rr + band * 0.4);
      gr.addColorStop(0, rgba(S.glow, 0)); gr.addColorStop(0.75, rgba(S.glow, a)); gr.addColorStop(1, rgba(S.glow, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr + band * 0.4, 0, TAU); g.arc(x, y, Math.max(0, rr - band), 0, TAU, true); g.fill();
    }
    // 4. 水墨圆环（两层反向缓转，形成流动感）
    drawTex(T.ring, t * 0.035, 1, 0.85);
    drawTex(T.ring2, -t * 0.09 + 1.3, 1.0, 0.9);
    if (T.cloud) drawTex(T.cloud, -t * 0.04, 1, 0.55 + 0.12 * Math.sin(t * 1.1));
    // 5. 篆文
    if (T.rune) drawTex(T.rune, -t * 0.05, 1, 0.55 + 0.1 * Math.sin(t * 1.3), 'source-over');
    if (T.rune2) drawTex(T.rune2, t * 0.07, 1, 0.22);
    // 6. 修饰
    for (const m of mods) {
      if (m === 'thunder') continue;
      if (m === 'insect') continue;
      const c = this.mod(m, tier);
      if (m === 'dayan') drawTex(c, t * 0.04, 1, 0.42);
      else if (m === 'wood') drawTex(c, -t * 0.012, 1.0, 0.75);
      else if (m === 'demon') { drawTex(c, t * 0.05, 1.02, 0.6); drawTex(c, -t * 0.03, 0.97, 0.3); }
      else drawTex(c, t * 0.03, 1, 0.5);
    }
    // 7. 光点（沿圈游走）
    if (S.motes) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < S.motes; i++) {
        const sp = 0.08 + (i % 5) * 0.025;
        const a = t * sp * (i % 2 ? 1 : -1) + i * 2.399;
        const rr = R * (0.94 + 0.05 * Math.sin(t * 0.7 + i * 1.3));
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        const fl = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7);
        const s = (3 + fl * 3) / Math.max(0.4, z);
        g.globalAlpha = 0.7 * fl * hideA;
        g.drawImage(this.moteTex(tier), px - s * 2.5, py - s * 2.5, s * 5, s * 5);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    // 8. 噬金虫：金芒在圈内游走
    if (mods.includes('insect')) {
      if (this.bugs.length === 0) for (let i = 0; i < 26; i++) this.bugs.push({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.65, s: 0.2 + Math.random() * 0.5, ph: Math.random() * 10 });
      g.fillStyle = 'rgba(255,214,90,0.85)';
      for (const b of this.bugs) {
        const a = b.a + t * b.s, rr = R * (b.r + 0.06 * Math.sin(t * 1.3 + b.ph));
        g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92, 2.2 / Math.max(0.5, z), 0, TAU); g.fill();
      }
    }
    // 9. 雷丝：沿圈闪烁的细电弧
    if (mods.includes('thunder')) {
      if (Math.random() < dt * 3.6) this.arcs.push({ a: Math.random() * TAU, t: 0, seed: Math.random() * 1e6 });
      g.lineCap = 'round';
      this.arcs = this.arcs.filter((ar) => {
        ar.t += dt;
        if (ar.t > 0.22) return false;
        const rnd = mulberry32(ar.seed | 0);
        const al = (1 - ar.t / 0.22);
        g.strokeStyle = `rgba(255,236,150,${0.9 * al})`; g.lineWidth = 2 / Math.max(0.4, z);
        g.beginPath();
        for (let i = 0; i <= 10; i++) {
          const a = ar.a + i * 0.025, rr = R + (rnd() - 0.5) * 26;
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
        return true;
      });
    }
    // 10. 被窥探警示
    if (this.alarm > 0.01) {
      const a = this.alarm * (0.5 + 0.5 * Math.sin(t * 12));
      g.strokeStyle = `rgba(200,40,30,${0.55 * a})`; g.lineWidth = 6 / Math.max(0.4, z);
      g.beginPath(); g.arc(x, y, R * (1 + 0.01 * Math.sin(t * 30)), 0, TAU); g.stroke();
    }
    g.restore();
  }

  /** WebGL 版神识圈：纹理带 mipmap，由 GPU 旋转缩放，绝对丝滑；圈外记忆水墨在后期着色器里完成 */
  drawGL(F: FxSys, S: GLStage, x: number, y: number, tierIn: number, mods: string[], t: number, z: number) {
    const tier = Math.max(0, Math.min(TIERS.length - 1, tierIn));
    const St = TIERS[tier], T = this.tex(tier);
    const B = F.B;
    const R = this.dispR, k = R / TR;
    const breath = 1 + Math.sin(t * 0.9) * 0.004;
    const hideA = 1 - this.hidden * 0.6;
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 1 / 60; this.lastT = t;
    const glow: [number, number, number] = [St.glow[0] / 255, St.glow[1] / 255, St.glow[2] / 255];
    const tex = (img: HTMLCanvasElement, rot: number, scale: number, alpha: number, add = 0) => {
      if (alpha <= 0.003) return;
      B.tex(S.uploadStatic(img));
      B.texQuad(x, y, TEX * k * scale * breath, rot, alpha * hideA, add);
    };
    // 高阶底纹
    if (T.stars) tex(T.stars, t * 0.01, 1, 0.22);
    if (T.yy) { const r = Math.min(R * 0.42, 420); B.tex(S.uploadStatic(T.yy)); B.texQuad(x, y, r * 2, -t * 0.08, 0.08 * hideA, 0, [1, 1, 1], 0.55); }
    if (T.lotus) { const r = 70 + tier * 10; B.tex(S.uploadStatic(T.lotus)); B.texQuad(x, y, r * 2, t * 0.15, (0.22 + 0.06 * Math.sin(t * 1.7)) * hideA, 1, [1, 1, 1], 0.5); }
    // 水墨圆环（两层反向缓转）
    tex(T.ring, t * 0.035, 1, 0.85);
    tex(T.ring2, -t * 0.09 + 1.3, 1.0, 0.9);
    if (T.cloud) tex(T.cloud, -t * 0.04, 1, 0.55 + 0.12 * Math.sin(t * 1.1));
    if (T.rune) tex(T.rune, -t * 0.05, 1, 0.55 + 0.1 * Math.sin(t * 1.3), 0.4);
    if (T.rune2) tex(T.rune2, t * 0.07, 1, 0.22);
    for (const m of mods) {
      if (m === 'thunder' || m === 'insect') continue;
      const c = this.mod(m, tier);
      if (m === 'dayan') tex(c, t * 0.04, 1, 0.42, 0.3);
      else if (m === 'wood') tex(c, -t * 0.012, 1.0, 0.75);
      else if (m === 'demon') { tex(c, t * 0.05, 1.02, 0.6); tex(c, -t * 0.03, 0.97, 0.3); }
      else tex(c, t * 0.03, 1, 0.5, 0.5);
    }
    B.tex(S.atlas);
    // 涟漪：柔光环平滑扩散
    for (let i = 0; i < St.ripples; i++) {
      const ph = ((t + i * St.period / St.ripples) % St.period) / St.period;
      const e = 1 - Math.pow(1 - ph, 2.2);
      const rr = R * e, a = Math.pow(1 - ph, 1.6) * Math.min(1, ph * 6) * 0.42;
      if (rr < 8 || a < 0.005) continue;
      const band = 30 / Math.max(0.35, z) + R * 0.035;
      F.circle(x, y, rr, band, glow, a * 0.45 * hideA, 1, 96);
      F.circle(x, y, rr, band * 0.14, [1, 1, 1], a * 0.18 * hideA, 1, 96);
    }
    if (this.burst > 0.01) { const u = 1 - this.burst; const rr = R * (0.3 + u * 0.75); F.circle(x, y, rr, 60 / Math.max(0.35, z), glow, this.burst * 0.7, 1, 96); F.circle(x, y, rr, 8 / Math.max(0.35, z), [1, 1, 1], this.burst * 0.6, 1, 96); }
    // 光点沿圈游走
    for (let i = 0; i < St.motes; i++) {
      const sp = 0.08 + (i % 5) * 0.025;
      const a = t * sp * (i % 2 ? 1 : -1) + i * 2.399;
      const rr = R * (0.94 + 0.05 * Math.sin(t * 0.7 + i * 1.3));
      const fl = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7);
      const s = (3 + fl * 3) / Math.max(0.4, z);
      B.quad(CELL.Glow, x + Math.cos(a) * rr, y + Math.sin(a) * rr, s * 5, s * 5, 0, glow[0], glow[1], glow[2], 0.8 * fl * hideA, 1);
      B.quad(CELL.Dot, x + Math.cos(a) * rr, y + Math.sin(a) * rr, s * 1.2, s * 1.2, 0, 1, 1, 1, 0.9 * fl * hideA, 1);
    }
    // 噬金虫：金芒游走（带拖影）
    if (mods.includes('insect')) {
      if (this.bugs.length === 0) for (let i = 0; i < 26; i++) this.bugs.push({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.65, s: 0.2 + Math.random() * 0.5, ph: Math.random() * 10 });
      const zz = 1 / Math.max(0.5, z);
      for (const b of this.bugs) {
        const a = b.a + t * b.s, rr = R * (b.r + 0.06 * Math.sin(t * 1.3 + b.ph));
        const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr * 0.92;
        B.quad(CELL.Streak, bx, by, 16 * zz, 4 * zz, a + Math.PI / 2, 1, 0.85, 0.35, 0.6, 1);
        B.quad(CELL.Dot, bx, by, 6 * zz, 6 * zz, 0, 1, 0.9, 0.45, 1, 1);
      }
    }
    // 雷丝：沿圈闪烁的金色电弧
    if (mods.includes('thunder')) {
      if (Math.random() < dt * 3.6) this.arcs.push({ a: Math.random() * TAU, t: 0, seed: Math.random() * 1e6 });
      this.arcs = this.arcs.filter((ar) => {
        ar.t += dt;
        if (ar.t > 0.22) return false;
        const al = 1 - ar.t / 0.22;
        const a0 = ar.a, a1 = ar.a + 0.25;
        F.bolt(x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, ar.seed + Math.floor(ar.t * 40), 22, 2.2 / Math.max(0.4, z), [1, 0.88, 0.5], 0.95 * al, 8, false);
        return true;
      });
    }
  }
}

/** 根据境界与法宝/功法得出神识修饰 */
export function senseMods(hero: { gongfa?: string; equip?: Record<string, string | undefined>; treasures?: string[]; flags?: Record<string, any> }): SenseMod[] {
  const out = new Set<SenseMod>();
  const owned = new Set<string>([...(hero.treasures ?? []), ...Object.values(hero.equip ?? {}).filter(Boolean) as string[]]);
  if (hero.gongfa === 'dayan' || hero.flags?.dayan) out.add('dayan');
  if (owned.has('yanghunmu')) out.add('wood');
  if (owned.has('qingzhu') || owned.has('bixie')) out.add('thunder');
  if (owned.has('shijin')) out.add('insect');
  if (owned.has('xuanbing') || owned.has('qianlan')) out.add('ice');
  if (hero.gongfa === 'xuesha' || hero.gongfa === 'yinluo') out.add('demon');
  if (owned.has('zhenhuo')) out.add('fire');
  if (hero.gongfa === 'qingyuan') out.add('sword');
  return [...out];
}
