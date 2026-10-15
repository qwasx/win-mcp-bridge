// 程序化建筑：殿宇、飞檐、宝塔、牌坊、城墙、民居、茅屋、毡帐、码头……
// 每个地点按种子与类型生成不同布局与配色；拆成若干“构件”分别缓存为位图，便于与人物做前后遮挡排序。
import { makeCanvas, shade, rgba } from '../core/canvas';
import { mulberry32 } from '../core/rng';
import type { LocDef } from '../data/world';
import { makeTree, Species, Season } from './tree';
import { bldTex, hallFamily, houseFilter } from './bldTex';

export const K = 0.55;
/** 地点构件绘制时的整体放大（与 92px 的人物协调） */
export const LOC_SCALE = 1.5; // 进深→屏幕纵向的压缩系数（俯视斜角）

export interface Pal { roof: string; wall: string; pillar: string; trim: string; stone: string; accent: string; barrier?: string; ground: string }
const BASE_PAL: Pal = { roof: '#4a5868', wall: '#ece4d0', pillar: '#8a2e24', trim: '#5a3a28', stone: '#bdb6a4', accent: '#c89a3a', ground: '#d8ccaa' };

/** 各宗门/城的配色与特色 */
export const SECT_STYLE: Record<string, { pal: Partial<Pal>; trees: Species[]; feature?: string; barrier?: string; scale?: number }> = {
  huangfeng: { pal: { roof: '#5a5a4a', accent: '#e0b030', pillar: '#9a3a22' }, trees: ['ymaple', 'ymaple', 'ymaple', 'pine'], feature: 'maple', barrier: '#e8c050' },
  yanyue: { pal: { roof: '#9aa4bc', wall: '#f6f4f8', pillar: '#b8b0c8', trim: '#6a6a8a', accent: '#dfe6ff', stone: '#d8d8e0', ground: '#e0dde4' }, trees: ['plum', 'peach', 'cypress', 'bamboo'], feature: 'moon', barrier: '#c8d4ff' },
  tianmo: { pal: { roof: '#2a1c22', wall: '#4a2a2a', pillar: '#6a1414', trim: '#2a1010', accent: '#c02828', stone: '#5a4a48', ground: '#6a5a50' }, trees: ['dead', 'cypress', 'dead'], feature: 'demon', barrier: '#c03030', scale: 1.2 },
  guiling: { pal: { roof: '#2a2a34', wall: '#5a4a50', pillar: '#4a2a3a', accent: '#6adca0', stone: '#5a5458', ground: '#6a6460' }, trees: ['dead', 'cypress'], feature: 'demon', barrier: '#40c080' },
  hehuan: { pal: { roof: '#6a2a4a', wall: '#f0dce0', pillar: '#b02a5a', accent: '#f080b0', ground: '#d8c0c0' }, trees: ['peach', 'peach', 'plum'], feature: 'pink', barrier: '#f080c0' },
  yuling: { pal: { roof: '#3a2a20', wall: '#6a4a3a', pillar: '#7a2a1a', accent: '#d04020', stone: '#6a5a4a' }, trees: ['dead', 'pine'], feature: 'demon', barrier: '#d04020' },
  qianhuan: { pal: { roof: '#4a3a6a', wall: '#e0d8ec', pillar: '#6a4a9a', accent: '#b090f0' }, trees: ['cypress', 'bamboo'], barrier: '#a080f0' },
  tiansha: { pal: { roof: '#2a2020', wall: '#5a3a30', pillar: '#5a1010', accent: '#e03020', stone: '#5a4a40', ground: '#6a5a4a' }, trees: ['dead', 'dead', 'cypress'], feature: 'demon', barrier: '#e03020' },
  yinluo: { pal: { roof: '#1e1a24', wall: '#3a3040', pillar: '#4a1a2a', accent: '#9a40c0', stone: '#4a4450', ground: '#5a5258' }, trees: ['dead', 'cypress'], feature: 'demon', barrier: '#9a40c0' },
  jiyin: { pal: { roof: '#1a2430', wall: '#3a4048', pillar: '#2a3a4a', accent: '#60a0d0', stone: '#4a5058' }, trees: ['palm', 'dead'], feature: 'demon', barrier: '#4080c0' },
  luoyun: { pal: { roof: '#3a6450', accent: '#8ad070', pillar: '#7a3a24' }, trees: ['pine', 'broad', 'bamboo', 'peach'], feature: 'herb', barrier: '#80d090', scale: 1.1 },
  qixuan: { pal: { roof: '#5a5450', wall: '#e2d6bc', pillar: '#6a3a26', accent: '#a04030' }, trees: ['pine', 'broad', 'maple'], feature: 'martial' },
  lingshou: { pal: { roof: '#5a4a30', accent: '#d09040' }, trees: ['pine', 'broad'], feature: 'beast', barrier: '#d0a050' },
  qingxu: { pal: { roof: '#3a4a5a', wall: '#f2eee4', accent: '#80b0d0' }, trees: ['pine', 'cypress', 'bamboo'], barrier: '#a0c8e0' },
  huadao: { pal: { roof: '#4a4440', pillar: '#5a3020', accent: '#c0c0c0' }, trees: ['pine', 'maple'], barrier: '#c0c8d0' },
  tianque: { pal: { roof: '#3a3a40', wall: '#b8b0a0', accent: '#a03020', stone: '#9a948a' }, trees: ['cypress', 'pine'], feature: 'fort', barrier: '#c0a080' },
  jujian: { pal: { roof: '#4a4a50', accent: '#a0a8b0' }, trees: ['pine', 'broad'], feature: 'sword', barrier: '#b0c0d0' },
  gujian: { pal: { roof: '#3a4858', wall: '#eae6dc', accent: '#c0d0e0' }, trees: ['pine', 'pine', 'cypress'], feature: 'sword', barrier: '#c0d8f0' },
  baiqiao: { pal: { roof: '#5a4a3a', accent: '#c08a40' }, trees: ['broad', 'bamboo'], barrier: '#d0a060' },
  huayi: { pal: { roof: '#4a3a5a', accent: '#9070c0' }, trees: ['cypress', 'pine'], barrier: '#9070c0' },
  qianzhu: { pal: { roof: '#4a6a3a', wall: '#d8d0a8', pillar: '#6a7a3a', accent: '#90b050' }, trees: ['bamboo', 'bamboo', 'bamboo', 'pine'], feature: 'bamboo', barrier: '#a0d070', scale: 1.1 },
  tianlan: { pal: { roof: '#d8c890', wall: '#f4f0e4', pillar: '#c0a050', accent: '#e0b040', ground: '#d8d0a8' }, trees: ['dead', 'broad'], feature: 'dome', barrier: '#f0d060', scale: 1.2 },
  taiyi: { pal: { roof: '#34506a', wall: '#f2f0ea', accent: '#a0c0e0' }, trees: ['pine', 'cypress', 'plum'], barrier: '#a0c8f0', scale: 1.15 },
  miaoyin: { pal: { roof: '#7a4a7a', wall: '#f4e8f0', pillar: '#a04a8a', accent: '#e0a0e0' }, trees: ['palm', 'peach'], feature: 'pink', barrier: '#e0a0f0' },
};

export interface Piece {
  kind: string;      // hall | pagoda | paifang | house | hut | yurt | wallH | wallV | tower | stall | tree | boat | lion | ding | sword | rock | pillar | obelisk | stele | fence | well | lantern | dome
  x: number; y: number; // 相对地点中心的世界坐标（底边中心）
  seed: number;
  p: Record<string, any>;
}
export interface GroundItem { kind: string; x: number; y: number; w: number; h: number; p?: Record<string, any> }
export interface LocLayout {
  id: string; pieces: Piece[]; ground: GroundItem[]; gw: number; gh: number;
  blocks: { x: number; y: number; w: number; h: number }[];
  lights: { x: number; y: number; r: number }[];
  barrier?: { x: number; y: number; rx: number; ry: number; color: string };
  pal: Pal; season?: Season;
  smoke: { x: number; y: number }[];
  flags: { x: number; y: number; color: string }[];
}

export interface Sprite { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

function strHash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ======================= 绘制原语 =======================
type G = CanvasRenderingContext2D;
const INK = 'rgba(34,28,22,0.85)';

function poly(g: G, pts: number[], fill?: string, stroke?: string, lw = 1) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

/** 石台基：顶面 + 正面 */
function platform(g: G, w: number, d: number, ph: number, stone: string) {
  poly(g, [-w / 2, -ph, w / 2, -ph, w / 2, -ph - d * K, -w / 2, -ph - d * K], shade(stone, 0.12), INK, 1);
  poly(g, [-w / 2, 0, w / 2, 0, w / 2, -ph, -w / 2, -ph], shade(stone, -0.12), INK, 1);
  g.strokeStyle = 'rgba(40,30,20,0.25)'; g.lineWidth = 0.7;
  for (let x = -w / 2 + 14; x < w / 2; x += 14) { g.beginPath(); g.moveTo(x, -ph); g.lineTo(x, 0); g.stroke(); }
}

/** 屋顶（歇山/庑殿 + 飞檐起翘）。eaveY 为檐口，返回屋脊 y */
function roof(g: G, w: number, d: number, eaveY: number, col: string, opt: { ox?: number; lift?: number; rw?: number; rise?: number; thatch?: boolean; ridgeOrn?: boolean } = {}) {
  const ox = opt.ox ?? (10 + w * 0.06), lift = opt.lift ?? (opt.thatch ? 0 : 7 + w * 0.025);
  const depth = d * K * 0.75 + (opt.rise ?? 10);
  const ridgeY = eaveY - depth;
  const rw = (opt.rw ?? 0.6) * w / 2;
  const L = -w / 2 - ox, R = w / 2 + ox;
  // 后坡
  g.beginPath(); g.moveTo(-rw, ridgeY); g.lineTo(rw, ridgeY); g.lineTo(rw * 0.92, ridgeY - depth * 0.28); g.lineTo(-rw * 0.92, ridgeY - depth * 0.28); g.closePath();
  g.fillStyle = shade(col, -0.25); g.fill();
  // 前坡
  const path = new Path2D();
  path.moveTo(L, eaveY - lift);
  path.quadraticCurveTo(L + ox * 0.6, eaveY + 3, L + ox * 1.6, eaveY + 3);
  path.lineTo(R - ox * 1.6, eaveY + 3);
  path.quadraticCurveTo(R - ox * 0.6, eaveY + 3, R, eaveY - lift);
  path.quadraticCurveTo(R - ox * 0.4 - (w / 2 - rw) * 0.3, ridgeY + depth * 0.55, rw, ridgeY);
  path.lineTo(-rw, ridgeY);
  path.quadraticCurveTo(L + ox * 0.4 + (w / 2 - rw) * 0.3, ridgeY + depth * 0.55, L, eaveY - lift);
  path.closePath();
  const gr = g.createLinearGradient(0, ridgeY, 0, eaveY);
  gr.addColorStop(0, shade(col, 0.18)); gr.addColorStop(0.7, col); gr.addColorStop(1, shade(col, -0.18));
  g.fillStyle = gr; g.fill(path);
  g.save(); g.clip(path);
  if (opt.thatch) {
    g.strokeStyle = 'rgba(90,70,30,0.45)'; g.lineWidth = 0.9;
    for (let i = 0; i < w * 0.9; i++) {
      const x = L + ((i * 37) % (R - L)), y0 = ridgeY + ((i * 13) % 7);
      g.beginPath(); g.moveTo(x * 0.85, y0); g.lineTo(x, y0 + depth * (0.5 + ((i * 7) % 5) / 10)); g.stroke();
    }
  } else {
    // 瓦垄
    g.strokeStyle = rgba(shade(col, -0.45), 0.5); g.lineWidth = 1.1;
    const n = Math.max(6, Math.round(w / 6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      g.beginPath(); g.moveTo(-rw + t * rw * 2, ridgeY); g.lineTo(L + ox * 0.5 + t * (R - L - ox), eaveY + 3); g.stroke();
    }
    g.strokeStyle = rgba(shade(col, 0.35), 0.25); g.lineWidth = 0.8;
    for (let i = 0; i <= n; i++) {
      const t = (i + 0.5) / n;
      g.beginPath(); g.moveTo(-rw + t * rw * 2, ridgeY + 1); g.lineTo(L + ox * 0.5 + t * (R - L - ox), eaveY + 2); g.stroke();
    }
  }
  // 屋檐阴影
  const sg = g.createLinearGradient(0, eaveY - 6, 0, eaveY + 3);
  sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = sg; g.fillRect(L, eaveY - 6, R - L, 10);
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(path);
  // 檐口瓦当
  if (!opt.thatch) {
    g.strokeStyle = shade(col, -0.5); g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(L, eaveY - lift); g.quadraticCurveTo(L + ox * 0.6, eaveY + 3, L + ox * 1.6, eaveY + 3);
    g.lineTo(R - ox * 1.6, eaveY + 3); g.quadraticCurveTo(R - ox * 0.6, eaveY + 3, R, eaveY - lift); g.stroke();
    // 垂脊
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(rw, ridgeY); g.quadraticCurveTo(R - ox * 0.4 - (w / 2 - rw) * 0.3, ridgeY + depth * 0.55, R, eaveY - lift); g.stroke();
    g.beginPath(); g.moveTo(-rw, ridgeY); g.quadraticCurveTo(L + ox * 0.4 + (w / 2 - rw) * 0.3, ridgeY + depth * 0.55, L, eaveY - lift); g.stroke();
  }
  // 正脊 + 鸱吻
  g.strokeStyle = opt.thatch ? shade(col, -0.3) : shade(col, -0.55); g.lineWidth = opt.thatch ? 4 : 3.4;
  g.beginPath(); g.moveTo(-rw, ridgeY); g.lineTo(rw, ridgeY); g.stroke();
  if (!opt.thatch && opt.ridgeOrn !== false) {
    g.lineWidth = 2.2;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * rw, ridgeY); g.quadraticCurveTo(s * (rw + 4), ridgeY - 2, s * (rw + 2), ridgeY - 8);
      g.quadraticCurveTo(s * (rw - 2), ridgeY - 9, s * (rw - 1), ridgeY - 5); g.stroke();
    }
  }
  return ridgeY;
}

/** 墙身 + 立柱 + 门窗 */
function walls(g: G, w: number, h: number, y0: number, pal: Pal, opt: { doors?: number; lattice?: boolean; litWin?: boolean } = {}) {
  const top = y0 - h;
  g.fillStyle = pal.wall; g.fillRect(-w / 2, top, w, h);
  const bays = Math.max(1, Math.round(w / 30));
  const bw = w / bays;
  const doors = opt.doors ?? (bays >= 5 ? 3 : 1);
  const d0 = Math.floor((bays - doors) / 2);
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + i * bw;
    const isDoor = i >= d0 && i < d0 + doors;
    if (isDoor) {
      g.fillStyle = shade(pal.pillar, -0.15); g.fillRect(x + 3, top + h * 0.12, bw - 6, h * 0.88);
      if (opt.lattice !== false) {
        g.strokeStyle = rgba(shade(pal.pillar, 0.4), 0.7); g.lineWidth = 0.7;
        for (let yy = top + h * 0.16; yy < top + h * 0.55; yy += 4) { g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + bw - 4, yy); g.stroke(); }
        for (let xx = x + 6; xx < x + bw - 4; xx += 4) { g.beginPath(); g.moveTo(xx, top + h * 0.15); g.lineTo(xx, top + h * 0.55); g.stroke(); }
      }
      g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + bw / 2, top + h * 0.12); g.lineTo(x + bw / 2, y0); g.stroke();
    } else {
      // 窗
      const wy = top + h * 0.22, wh = h * 0.36;
      g.fillStyle = opt.litWin ? '#f2e0b0' : shade(pal.wall, -0.18); g.fillRect(x + 5, wy, bw - 10, wh);
      g.strokeStyle = rgba(pal.trim, 0.8); g.lineWidth = 0.7;
      for (let xx = x + 8; xx < x + bw - 5; xx += 4) { g.beginPath(); g.moveTo(xx, wy); g.lineTo(xx, wy + wh); g.stroke(); }
      g.strokeRect(x + 5, wy, bw - 10, wh);
    }
  }
  // 立柱
  g.fillStyle = pal.pillar;
  for (let i = 0; i <= bays; i++) { const x = -w / 2 + i * bw; g.fillRect(x - 2, top, 4, h); }
  // 额枋
  g.fillStyle = shade(pal.pillar, -0.2); g.fillRect(-w / 2 - 2, top, w + 4, 4);
  g.fillStyle = rgba(pal.accent, 0.8); g.fillRect(-w / 2, top + 4, w, 1.5);
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-w / 2, top, w, h);
}

function drawHall(g: G, p: any, pal: Pal) {
  const w = p.w, d = p.d ?? w * 0.5, h = p.h ?? 40, ph = p.ph ?? 10;
  const pw = w + 24, pd = d + 20;
  platform(g, pw, pd, ph, pal.stone);
  // 台阶
  const sw = Math.min(46, w * 0.28);
  poly(g, [-sw / 2, 2, sw / 2, 2, sw / 2 - 4, -ph, -sw / 2 + 4, -ph], shade(pal.stone, 0.05), INK, 0.8);
  g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = 0.7;
  for (let y = -ph + 3; y < 2; y += 3) { g.beginPath(); g.moveTo(-sw / 2 + 2, y); g.lineTo(sw / 2 - 2, y); g.stroke(); }
  const baseY = -ph - 6;
  walls(g, w, h, baseY, pal, { litWin: p.lit });
  let ridge = roof(g, w, d, baseY - h - 2, pal.roof, { rw: p.rw ?? 0.6 });
  if (p.tiers >= 2) {
    const w2 = w * 0.66, h2 = h * 0.45;
    const b2 = baseY - h - 2 - (d * K * 0.75 + 10) * 0.45;
    walls(g, w2, h2, b2, pal, { doors: 0, lattice: false, litWin: p.lit });
    ridge = roof(g, w2, d * 0.7, b2 - h2 - 1, pal.roof, { rw: 0.55 });
  }
  // 匾额
  g.fillStyle = p.plaque ?? '#2a3a4a';
  const pyy = baseY - h * 0.92;
  g.fillRect(-9, pyy, 18, 7); g.strokeStyle = pal.accent; g.lineWidth = 1; g.strokeRect(-9, pyy, 18, 7);
  return ridge;
}

function drawPagoda(g: G, p: any, pal: Pal) {
  const n = p.levels ?? 7; let w = p.w ?? 60;
  platform(g, w + 20, w * 0.8, 8, pal.stone);
  let y = -12;
  for (let i = 0; i < n; i++) {
    const h = (p.lh ?? 22) * (1 - i * 0.04);
    walls(g, w, h, y, pal, { doors: i === 0 ? 1 : 0, lattice: false, litWin: p.lit && i % 2 === 0 });
    y = roof(g, w, w * 0.8, y - h - 1, pal.roof, { rw: 0.18, rise: 2, ox: 8 + w * 0.08, ridgeOrn: false }) + 6;
    w *= 0.86;
  }
  // 塔刹
  g.strokeStyle = shade(pal.accent, -0.2); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(0, y); g.lineTo(0, y - 30); g.stroke();
  g.fillStyle = pal.accent;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(0, y - 8 - k * 5, 5 - k * 0.6, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(0, y - 33, 3.5, 0, Math.PI * 2); g.fill();
}

function drawPaifang(g: G, p: any, pal: Pal) {
  const w = p.w ?? 120, h = p.h ?? 70, n = p.bays ?? 3;
  const col = p.stoneGate ? pal.stone : pal.pillar;
  const xs: number[] = []; for (let i = 0; i <= n; i++) xs.push(-w / 2 + (w * i) / n);
  // 柱
  for (const x of xs) {
    const hh = Math.abs(x) < w * 0.2 ? h : h * 0.82;
    g.fillStyle = shade(col, -0.05); g.fillRect(x - 3.5, -hh, 7, hh);
    g.strokeStyle = INK; g.lineWidth = 0.9; g.strokeRect(x - 3.5, -hh, 7, hh);
    g.fillStyle = shade(pal.stone, -0.1); g.fillRect(x - 6, -6, 12, 6);
  }
  // 额枋 + 小屋顶
  for (let i = 0; i < n; i++) {
    const x0 = xs[i], x1 = xs[i + 1], mid = i === Math.floor(n / 2);
    const top = mid ? -h : -h * 0.82;
    g.fillStyle = shade(col, -0.2); g.fillRect(x0, top + 8, x1 - x0, 5);
    g.fillStyle = mid ? (p.plaque ?? '#2a3a5a') : pal.accent; g.fillRect(x0 + 3, top + 14, x1 - x0 - 6, mid ? 10 : 4);
    if (mid) { g.strokeStyle = pal.accent; g.lineWidth = 1; g.strokeRect(x0 + 3, top + 14, x1 - x0 - 6, 10); }
    g.save(); g.translate((x0 + x1) / 2, 0);
    roof(g, x1 - x0 - 6, 18, top + 8, pal.roof, { rw: 0.7, rise: 3, ox: 6, lift: 5 });
    g.restore();
  }
}

function drawHouse(g: G, p: any, pal: Pal) {
  const w = p.w ?? 70, d = p.d ?? 40, h = p.h ?? 24;
  // 地基
  poly(g, [-w / 2 - 4, 0, w / 2 + 4, 0, w / 2 + 4, -4, -w / 2 - 4, -4], shade(pal.stone, -0.1), INK, 0.8);
  const wp: Pal = { ...pal, wall: p.wall ?? pal.wall, pillar: p.pillar ?? shade(pal.trim, 0.1) };
  walls(g, w, h, -4, wp, { doors: 1, lattice: false, litWin: p.lit });
  roof(g, w, d, -4 - h - 1, p.roof ?? pal.roof, { rw: p.gable ? 0.92 : 0.7, ox: 7, lift: p.gable ? 3 : 5, rise: 6, ridgeOrn: false });
  if (p.chimney) { g.fillStyle = '#6a5a4a'; g.fillRect(w * 0.25, -4 - h - d * K * 0.6 - 10, 5, 10); }
}

function drawHut(g: G, p: any) {
  const w = p.w ?? 54, d = p.d ?? 34, h = p.h ?? 18;
  const wall = p.wall ?? '#c8ae86';
  g.fillStyle = wall; g.fillRect(-w / 2, -h, w, h);
  g.strokeStyle = 'rgba(80,60,40,0.4)'; g.lineWidth = 0.8;
  for (let y = -h + 4; y < 0; y += 4) { g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y + 0.5); g.stroke(); }
  g.fillStyle = '#4a3a28'; g.fillRect(-5, -h * 0.85, 10, h * 0.85);
  g.fillStyle = p.lit ? '#f0d890' : '#3a3024'; g.fillRect(w * 0.18, -h * 0.7, 9, 7);
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-w / 2, -h, w, h);
  roof(g, w, d, -h - 1, p.roof ?? '#b89a5a', { thatch: true, rw: 0.75, ox: 8, rise: 8 });
}

function drawYurt(g: G, p: any) {
  const w = p.w ?? 70;
  const h = w * 0.32;
  poly(g, [-w / 2, 0, w / 2, 0, w / 2 - 2, -h, -w / 2 + 2, -h], '#efe8d6', INK, 1.4);
  g.fillStyle = 'rgba(120,110,90,0.2)'; g.fillRect(w * 0.1, -h, w * 0.38, h);
  g.fillStyle = p.band ?? '#a8352a'; g.fillRect(-w / 2 + 1, -h + 3, w - 2, 3);
  g.beginPath(); g.moveTo(-w / 2 - 3, -h + 1); g.quadraticCurveTo(0, -h - w * 0.5, w / 2 + 3, -h + 1); g.closePath();
  g.fillStyle = '#e6dfcc'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = 'rgba(60,50,40,0.45)'; g.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, -h - w * 0.24); g.lineTo(-w / 2 + (k * w) / 5, -h + 1); g.stroke(); }
  g.fillStyle = '#3a2e22'; g.fillRect(-6, -h * 0.8, 12, h * 0.8);
  if (p.lit) { g.fillStyle = 'rgba(255,210,120,0.8)'; g.fillRect(-5, -h * 0.75, 10, h * 0.7); }
}

function drawDome(g: G, p: any, pal: Pal) {
  const w = p.w ?? 160;
  platform(g, w + 30, w * 0.7, 12, pal.stone);
  const h = w * 0.3;
  walls(g, w, h, -16, pal, { doors: 3, litWin: p.lit });
  g.beginPath(); g.moveTo(-w / 2 - 4, -16 - h); g.bezierCurveTo(-w / 2, -16 - h - w * 0.55, w / 2, -16 - h - w * 0.55, w / 2 + 4, -16 - h); g.closePath();
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  gr.addColorStop(0, shade(pal.roof, 0.3)); gr.addColorStop(0.6, pal.roof); gr.addColorStop(1, shade(pal.roof, -0.3));
  g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = rgba(pal.accent, 0.8); g.lineWidth = 1.2;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * w * 0.18, -16 - h); g.quadraticCurveTo(k * w * 0.1, -16 - h - w * 0.38, 0, -16 - h - w * 0.41); g.stroke(); }
  g.fillStyle = pal.accent; g.beginPath(); g.arc(0, -16 - h - w * 0.44, 5, 0, Math.PI * 2); g.fill();
}

function stoneBlocks(g: G, x0: number, y0: number, w: number, h: number, col: string) {
  g.fillStyle = col; g.fillRect(x0, y0, w, h);
  g.strokeStyle = 'rgba(30,26,20,0.28)'; g.lineWidth = 0.7;
  let row = 0;
  for (let y = y0 + 6; y < y0 + h; y += 6, row++) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
  row = 0;
  for (let y = y0; y < y0 + h; y += 6, row++) for (let x = x0 + (row % 2 ? 6 : 0); x < x0 + w; x += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y0 + h, y + 6)); g.stroke(); }
}

/** 横向城墙（面南），可带城门与城楼 */
function drawWallH(g: G, p: any, pal: Pal) {
  const L = p.len, h = p.h ?? 46, t = p.t ?? 26;
  const col = p.col ?? '#8e8a7e';
  // 顶面
  poly(g, [-L / 2, -h, L / 2, -h, L / 2, -h - t * K, -L / 2, -h - t * K], shade(col, 0.2), INK, 1);
  // 正面
  stoneBlocks(g, -L / 2, -h, L, h, shade(col, -0.05));
  const sg = g.createLinearGradient(0, -h, 0, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = sg; g.fillRect(-L / 2, -h, L, h);
  g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(-L / 2, -h, L, h);
  // 垛口
  g.fillStyle = shade(col, 0.05);
  for (let x = -L / 2; x < L / 2 - 4; x += 12) { g.fillRect(x, -h - 6, 7, 6); g.strokeStyle = INK; g.lineWidth = 0.7; g.strokeRect(x, -h - 6, 7, 6); }
  if (p.gate) {
    const gw = 34, gh = h * 0.7;
    g.fillStyle = '#2a2420';
    g.beginPath(); g.moveTo(-gw / 2, 0); g.lineTo(-gw / 2, -gh + gw / 2); g.arc(0, -gh + gw / 2, gw / 2, Math.PI, 0); g.lineTo(gw / 2, 0); g.closePath(); g.fill();
    g.strokeStyle = shade(col, 0.3); g.lineWidth = 2; g.stroke();
    // 城楼
    g.save(); g.translate(0, -h - t * K * 0.3);
    const hp = { w: 110, d: 46, h: 26, ph: 0, tiers: 2, lit: p.lit };
    const wp: Pal = { ...pal, stone: col };
    walls(g, hp.w, hp.h, -2, wp, { doors: 3, litWin: p.lit });
    const b2 = -2 - hp.h - 2;
    roof(g, hp.w, hp.d, b2, pal.roof, { rw: 0.6 });
    const b3 = b2 - (hp.d * K * 0.75 + 10) * 0.5;
    walls(g, hp.w * 0.66, 14, b3, wp, { doors: 0, litWin: p.lit });
    roof(g, hp.w * 0.66, hp.d * 0.7, b3 - 15, pal.roof, { rw: 0.55 });
    g.restore();
  }
}

/** 纵向城墙一段（东/西墙）：从 y=0 向北延伸 len */
function drawWallV(g: G, p: any) {
  const L = p.len, h = p.h ?? 46, t = p.t ?? 26;
  const col = p.col ?? '#8e8a7e';
  // 端面（南端可见）
  if (p.end) stoneBlocks(g, -t / 2, -h, t, h, shade(col, -0.08));
  // 顶面（压缩后的纵向带）
  const top = -h, len = L * K;
  poly(g, [-t / 2, top, t / 2, top, t / 2, top - len, -t / 2, top - len], shade(col, 0.2), INK, 1);
  // 朝西/东的外侧面一点
  poly(g, [p.side * t / 2, top, p.side * (t / 2 + 6), top + 6, p.side * (t / 2 + 6), top + 6 - len, p.side * t / 2, top - len], shade(col, -0.25), INK, 0.8);
  g.fillStyle = shade(col, 0.05);
  for (let y = top - 4; y > top - len; y -= 10) { g.fillRect(-t / 2 - 1, y - 4, 4, 5); g.fillRect(t / 2 - 3, y - 4, 4, 5); }
}

function drawTowerCorner(g: G, p: any, pal: Pal) {
  const col = p.col ?? '#8e8a7e', h = p.h ?? 46;
  stoneBlocks(g, -22, -h - 4, 44, h + 4, shade(col, -0.05));
  poly(g, [-22, -h - 4, 22, -h - 4, 22, -h - 4 - 30 * K, -22, -h - 4 - 30 * K], shade(col, 0.2), INK, 1);
  g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-22, -h - 4, 44, h + 4);
  g.save(); g.translate(0, -h - 10);
  walls(g, 34, 18, 0, pal, { doors: 1, litWin: p.lit });
  roof(g, 34, 30, -19, pal.roof, { rw: 0.3, rise: 6 });
  g.restore();
}

function drawStall(g: G, p: any) {
  const w = p.w ?? 46;
  const col = p.col ?? '#c84a3a';
  g.fillStyle = '#6a4a30'; g.fillRect(-w / 2, -14, w, 10);
  g.fillStyle = '#8a6a48'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-w / 2 + 8 + i * (w - 16) / 3, -15, 3.2, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#4a3020'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w / 2 + 2, 0); g.lineTo(-w / 2 + 2, -34); g.moveTo(w / 2 - 2, 0); g.lineTo(w / 2 - 2, -34); g.stroke();
  g.beginPath(); g.moveTo(-w / 2 - 6, -30); g.lineTo(w / 2 + 6, -30); g.lineTo(w / 2, -42); g.lineTo(-w / 2, -42); g.closePath();
  g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  for (let x = -w / 2; x < w / 2; x += 10) g.fillRect(x, -42, 5, 12);
}

function drawBoat(g: G, p: any) {
  const w = p.w ?? 80;
  g.fillStyle = 'rgba(30,50,60,0.25)'; g.beginPath(); g.ellipse(0, 2, w * 0.55, 6, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-w / 2, -10); g.quadraticCurveTo(-w / 2 + 6, 0, -w / 4, 0); g.lineTo(w / 4, 0); g.quadraticCurveTo(w / 2 - 6, 0, w / 2, -10); g.closePath();
  g.fillStyle = '#6a4a30'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#8a6a48'; g.fillRect(-w / 2 + 6, -12, w - 12, 3);
  if (p.cabin) {
    g.beginPath(); g.moveTo(-w * 0.2, -12); g.quadraticCurveTo(0, -30, w * 0.2, -12); g.closePath();
    g.fillStyle = '#4a3a2a'; g.fill(); g.stroke();
  }
  if (p.sail) {
    g.strokeStyle = '#4a3020'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -70); g.stroke();
    g.beginPath(); g.moveTo(2, -66); g.quadraticCurveTo(26, -44, 4, -16); g.lineTo(2, -16); g.closePath();
    g.fillStyle = '#e8dcc0'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(80,60,40,0.4)'; for (let y = -58; y < -18; y += 9) { g.beginPath(); g.moveTo(2, y); g.lineTo(14, y + 2); g.stroke(); }
  }
}

function drawSmall(g: G, kind: string, p: any, pal: Pal, rnd: () => number) {
  switch (kind) {
    case 'lion': {
      for (const s of [-1, 1]) {
        const x = s * (p.gap ?? 40);
        g.fillStyle = shade(pal.stone, -0.05); g.fillRect(x - 7, -8, 14, 8);
        g.beginPath(); g.ellipse(x, -16, 6, 8, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x, -25, 5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      }
      break;
    }
    case 'ding': {
      g.fillStyle = '#5a4a30'; g.beginPath(); g.ellipse(0, -14, 14, 10, 0, 0, Math.PI); g.fill();
      g.fillRect(-14, -22, 28, 8); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-14, -22, 28, 8);
      g.fillStyle = '#3a2e20'; g.beginPath(); g.ellipse(0, -22, 14, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5a4a30'; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9, -6); g.lineTo(s * 11, 0); g.stroke(); g.beginPath(); g.arc(s * 10, -26, 3, Math.PI, 0); g.stroke(); }
      break;
    }
    case 'sword': {
      const h = p.h ?? 160;
      g.fillStyle = 'rgba(40,40,40,0.2)'; g.beginPath(); g.ellipse(10, 0, 30, 8, 0, 0, Math.PI * 2); g.fill();
      poly(g, [-26, 0, 26, 0, 20, -14, -20, -14], shade(pal.stone, -0.1), INK, 1);
      const gr = g.createLinearGradient(-8, 0, 8, 0); gr.addColorStop(0, '#e8eef4'); gr.addColorStop(0.5, '#a8b4c0'); gr.addColorStop(1, '#6a7480');
      poly(g, [-7, -14, 7, -14, 7, -h * 0.75, 0, -h * 0.75 - 14, -7, -h * 0.75], undefined);
      g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#6a5030'; g.fillRect(-20, -14 - 6, 40, 6);
      g.fillStyle = '#4a3020'; g.fillRect(-3, -14 - 6 + 0, 6, -0);
      break;
    }
    case 'obelisk': {
      const h = p.h ?? 70;
      poly(g, [-8, 0, 8, 0, 5, -h, 0, -h - 8, -5, -h], '#2a2026', INK, 1);
      g.strokeStyle = rgba(p.glow ?? '#c03030', 0.8); g.lineWidth = 1.4;
      for (let y = -12; y > -h + 6; y -= 12) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y - 5); g.stroke(); }
      break;
    }
    case 'pillar': {
      const h = p.h ?? 60, broken = p.broken;
      g.fillStyle = shade(pal.stone, -0.05);
      const top = broken ? -h * (0.4 + rnd() * 0.4) : -h;
      g.fillRect(-7, top, 14, -top);
      g.beginPath(); g.moveTo(-7, top); for (let k = 0; k <= 4; k++) g.lineTo(-7 + k * 3.5, top - (broken ? rnd() * 6 : 0)); g.lineTo(7, top); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-7, top, 14, -top);
      g.strokeStyle = 'rgba(30,30,20,0.3)'; for (let x = -4; x <= 4; x += 4) { g.beginPath(); g.moveTo(x, top + 3); g.lineTo(x, -3); g.stroke(); }
      g.fillStyle = shade(pal.stone, -0.15); g.fillRect(-10, -6, 20, 6);
      if (broken) { g.fillStyle = 'rgba(60,90,50,0.7)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse((rnd() - 0.5) * 12, top + rnd() * 20, 3, 2, 0, 0, Math.PI * 2); g.fill(); } }
      break;
    }
    case 'stele': {
      poly(g, [-10, 0, 10, 0, 10, -34, 0, -40, -10, -34], shade(pal.stone, 0), INK, 1);
      g.strokeStyle = 'rgba(30,30,20,0.4)'; for (let y = -30; y < -6; y += 5) { g.beginPath(); g.moveTo(-5, y); g.lineTo(5, y); g.stroke(); }
      break;
    }
    case 'well': {
      g.fillStyle = shade(pal.stone, -0.1); g.beginPath(); g.ellipse(0, -6, 14, 7, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#2a3a40'; g.beginPath(); g.ellipse(0, -7, 9, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5a4030'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, -6); g.lineTo(-12, -30); g.lineTo(12, -30); g.lineTo(12, -6); g.stroke();
      break;
    }
    case 'lantern': {
      g.strokeStyle = '#3a2a20'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -40); g.lineTo(8, -40); g.stroke();
      g.fillStyle = p.col ?? '#c83a2a'; g.beginPath(); g.ellipse(8, -34, 4, 5.5, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'fence': {
      const L = p.len ?? 80;
      g.strokeStyle = '#6a5038'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-L / 2, -10); g.lineTo(L / 2, -10); g.moveTo(-L / 2, -5); g.lineTo(L / 2, -5); g.stroke();
      g.lineWidth = 2; for (let x = -L / 2; x <= L / 2; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -14); g.stroke(); }
      break;
    }
    case 'rock': {
      const w = p.w ?? 60, h = p.h ?? 40;
      g.beginPath(); g.moveTo(-w / 2, 0);
      for (let k = 0; k <= 8; k++) { const t = k / 8; g.lineTo(-w / 2 + t * w, -h * Math.sin(t * Math.PI) * (0.7 + rnd() * 0.4)); }
      g.lineTo(w / 2, 0); g.closePath();
      const gr = g.createLinearGradient(-w / 2, -h, w / 2, 0); gr.addColorStop(0, shade(p.col ?? '#9a9484', 0.2)); gr.addColorStop(1, shade(p.col ?? '#9a9484', -0.35));
      g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      if (p.cave) { g.fillStyle = '#1a1414'; g.beginPath(); g.ellipse(0, -h * 0.25, w * 0.16, h * 0.3, 0, Math.PI, 0); g.lineTo(w * 0.16, 0); g.lineTo(-w * 0.16, 0); g.fill(); }
      break;
    }
    case 'bones': {
      g.strokeStyle = '#e8e0cc'; g.lineWidth = 2.2;
      for (let k = 0; k < 4; k++) { const x = (rnd() - 0.5) * 30, y = -rnd() * 8; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y - 2); g.stroke(); }
      g.fillStyle = '#e8e0cc'; g.beginPath(); g.arc(4, -5, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2020'; g.fillRect(2, -6, 1.5, 1.5); g.fillRect(5, -6, 1.5, 1.5);
      break;
    }
    case 'pen': {
      const L = p.len ?? 100;
      drawSmall(g, 'fence', { len: L }, pal, rnd);
      break;
    }
  }
}

// ======================= 构件渲染 =======================
const BOUNDS: Record<string, (p: any) => [number, number, number]> = {
  // 返回 [半宽, 向上高度, 向下余量]
  hall: (p) => [p.w / 2 + 40, p.h * (p.tiers >= 2 ? 2.4 : 1.5) + p.w * 0.45 + 40, 6],
  pagoda: (p) => [(p.w ?? 60) / 2 + 30, (p.levels ?? 7) * (p.lh ?? 22) * 1.35 + 80, 4],
  paifang: (p) => [(p.w ?? 120) / 2 + 20, (p.h ?? 70) + 30, 4],
  house: (p) => [(p.w ?? 70) / 2 + 16, (p.h ?? 24) + (p.d ?? 40) * 0.7 + 30, 4],
  hut: (p) => [(p.w ?? 54) / 2 + 14, (p.h ?? 18) + 40, 4],
  yurt: (p) => [(p.w ?? 70) / 2 + 8, (p.w ?? 70) * 0.65 + 10, 4],
  dome: (p) => [(p.w ?? 160) / 2 + 30, (p.w ?? 160) * 0.95 + 40, 4],
  wallH: (p) => [p.len / 2 + 6, (p.h ?? 46) + (p.gate ? 130 : 30), 4],
  wallV: (p) => [(p.t ?? 26) / 2 + 10, (p.h ?? 46) + p.len * K + 10, 4],
  tower: (p) => [30, (p.h ?? 46) + 70, 4],
  stall: (p) => [(p.w ?? 46) / 2 + 10, 50, 4],
  boat: (p) => [(p.w ?? 80) / 2 + 30, p.sail ? 80 : 36, 10],
  lion: (p) => [(p.gap ?? 40) + 12, 34, 2],
  ding: () => [20, 34, 2], sword: (p) => [34, (p.h ?? 160) * 0.8 + 20, 10], obelisk: (p) => [12, (p.h ?? 70) + 12, 2],
  pillar: (p) => [12, (p.h ?? 60) + 10, 2], stele: () => [12, 44, 2], well: () => [16, 34, 2], lantern: () => [14, 44, 2],
  fence: (p) => [(p.len ?? 80) / 2 + 2, 16, 2], pen: (p) => [(p.len ?? 100) / 2 + 2, 16, 2],
  rock: (p) => [(p.w ?? 60) / 2 + 4, (p.h ?? 40) * 1.2 + 4, 2], bones: () => [24, 14, 2],
};

/** 用贴图画的构件：返回 [贴图名, 世界宽度, 水平翻转, 滤镜]；没有对应贴图返回 null */
function texFor(pc: Piece, pal: Pal): [string, number, boolean, string, number?] | null {
  const p = pc.p, flip = (pc.seed & 1) === 1;
  switch (pc.kind) {
    case 'hall': return [hallFamily(p.pal ? { ...pal, ...p.pal } : pal), (p.w + 24) * 0.9, false, 'none', 0.82];
    case 'pagoda': return ['pagoda', ((p.w ?? 60) + 20) * 1.25, false, houseFilter(pal)];
    case 'paifang': return ['paifang', (p.w ?? 120) * 1.12, false, p.stoneGate ? 'saturate(0.35) brightness(1.06)' : 'none'];
    case 'house': { const two = (pc.seed >>> 3) % 3 === 0; return [two ? 'house_b' : 'house_a', ((p.w ?? 70) + 8) * (two ? 1.0 : 1.12), flip, houseFilter(pal)]; }
    case 'hut': return ['hut', ((p.w ?? 54) + 8) * 1.1, flip, 'none'];
    case 'yurt': return ['yurt', (p.w ?? 70) * 1.08, flip, 'none'];
  }
  return null;
}

function renderTexPiece(pc: Piece, pal: Pal, res: number): Sprite | null {
  const t = texFor(pc, pal); if (!t) return null;
  const im = bldTex(t[0]); if (!im) return null;
  const tw = t[1], th = tw * im.height / im.width * (t[4] ?? 1);
  const hw = tw / 2 + 6, up = th + 4, down = 8;
  const W = hw * 2, H = up + down;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(hw, up);
  // 柔和投影
  g.fillStyle = 'rgba(40,36,26,0.16)';
  g.beginPath(); g.ellipse(tw * 0.06, -1, tw * 0.5, Math.min(14, tw * 0.09), 0, 0, Math.PI * 2); g.fill();
  g.imageSmoothingEnabled = true; (g as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
  if (t[3] !== 'none') g.filter = t[3];
  // 大幅缩小时分两步，避免锯齿闪烁
  let src: CanvasImageSource = im, sw = im.width, sh = im.height;
  const target = tw * res;
  if (sw > target * 2.2) {
    const mid = makeCanvas(Math.ceil(target * 2), Math.ceil(target * 2 * sh / sw));
    const mg = mid.getContext('2d')!; mg.imageSmoothingQuality = 'high'; mg.drawImage(im, 0, 0, mid.width, mid.height);
    src = mid; sw = mid.width; sh = mid.height;
  }
  if (t[2]) { g.scale(-1, 1); }
  g.drawImage(src, 0, 0, sw, sh, -tw / 2, -th + 2, tw, th);
  g.filter = 'none';
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: hw, ay: up };
}

export function renderPiece(pc: Piece, pal: Pal, res: number, season: Season = 1): Sprite {
  if (pc.kind === 'tree') {
    const t = makeTree(pc.p.sp, season, pc.seed, res);
    return { canvas: t.canvas, w: t.w, h: t.h, ax: t.ax, ay: t.ay };
  }
  const tex = renderTexPiece(pc, pal, res);
  if (tex) return tex;
  const [hw, up, down] = (BOUNDS[pc.kind] ?? (() => [60, 80, 4]))(pc.p);
  const W = hw * 2, H = up + down;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(hw, up);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const rnd = mulberry32(pc.seed);
  const P: Pal = pc.p.pal ? { ...pal, ...pc.p.pal } : pal;
  // 投影
  if (pc.kind !== 'wallV' && pc.kind !== 'boat' && pc.kind !== 'fence') {
    g.fillStyle = 'rgba(40,36,26,0.18)';
    g.beginPath(); g.ellipse(hw * 0.12, 0, hw * 0.85, Math.min(12, hw * 0.2), 0, 0, Math.PI * 2); g.fill();
  }
  switch (pc.kind) {
    case 'hall': drawHall(g, pc.p, P); break;
    case 'pagoda': drawPagoda(g, pc.p, P); break;
    case 'paifang': drawPaifang(g, pc.p, P); break;
    case 'house': drawHouse(g, pc.p, P); break;
    case 'hut': drawHut(g, pc.p); break;
    case 'yurt': drawYurt(g, pc.p); break;
    case 'dome': drawDome(g, pc.p, P); break;
    case 'wallH': drawWallH(g, pc.p, P); break;
    case 'wallV': drawWallV(g, pc.p); break;
    case 'tower': drawTowerCorner(g, pc.p, P); break;
    case 'stall': drawStall(g, pc.p); break;
    case 'boat': drawBoat(g, pc.p); break;
    default: drawSmall(g, pc.kind, pc.p, P, rnd);
  }
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: hw, ay: up };
}

/** 地面层：广场铺地、街道、台地、石阶、码头、阵纹、药田…… */
export function renderGround(L: LocLayout, res: number): Sprite {
  const W = L.gw, H = L.gh;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(W / 2, H / 2);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const pal = L.pal;
  const rnd = mulberry32(strHash(L.id) ^ 0x5151);
  for (const it of L.ground) {
    const { x, y, w, h } = it;
    switch (it.kind) {
      case 'plaza': {
        const col = it.p?.col ?? pal.ground;
        g.fillStyle = rgba(col, 0.92); g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = rgba(shade(col, -0.3), 0.35); g.lineWidth = 0.8;
        for (let yy = y - h / 2 + 10; yy < y + h / 2; yy += 10) { g.beginPath(); g.moveTo(x - w / 2, yy); g.lineTo(x + w / 2, yy); g.stroke(); }
        for (let xx = x - w / 2 + 14; xx < x + w / 2; xx += 14) { g.beginPath(); g.moveTo(xx, y - h / 2); g.lineTo(xx, y + h / 2); g.stroke(); }
        g.strokeStyle = rgba(shade(col, -0.45), 0.7); g.lineWidth = 2; g.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case 'street': {
        g.fillStyle = 'rgba(206,192,156,0.95)'; g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = 'rgba(120,100,70,0.25)'; g.lineWidth = 0.8;
        if (w > h) for (let xx = x - w / 2; xx < x + w / 2; xx += 16) { g.beginPath(); g.moveTo(xx, y - h / 2); g.lineTo(xx, y + h / 2); g.stroke(); }
        else for (let yy = y - h / 2; yy < y + h / 2; yy += 12) { g.beginPath(); g.moveTo(x - w / 2, yy); g.lineTo(x + w / 2, yy); g.stroke(); }
        break;
      }
      case 'terrace': {
        // 台地：顶面 + 正面石砌（高 it.p.hgt）
        const hg = it.p?.hgt ?? 20;
        g.fillStyle = rgba(pal.ground, 0.95); g.fillRect(x - w / 2, y - h / 2, w, h);
        stoneBlocks(g, x - w / 2, y + h / 2, w, hg, shade(pal.stone, -0.12));
        g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x - w / 2, y - h / 2, w, h + hg);
        // 栏杆
        g.strokeStyle = rgba(shade(pal.stone, 0.25), 0.9); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - w / 2, y + h / 2 - 3); g.lineTo(x + w / 2, y + h / 2 - 3); g.stroke();
        for (let xx = x - w / 2; xx <= x + w / 2; xx += 12) { g.beginPath(); g.moveTo(xx, y + h / 2); g.lineTo(xx, y + h / 2 - 6); g.stroke(); }
        break;
      }
      case 'stairs': {
        g.fillStyle = shade(pal.stone, 0.08); g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = 'rgba(50,40,30,0.4)'; g.lineWidth = 1;
        for (let yy = y - h / 2 + 4; yy < y + h / 2; yy += 4) { g.beginPath(); g.moveTo(x - w / 2, yy); g.lineTo(x + w / 2, yy); g.stroke(); }
        g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case 'path': {
        g.strokeStyle = 'rgba(200,184,146,0.9)'; g.lineWidth = w;
        const pts = it.p!.pts as [number, number][];
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        break;
      }
      case 'dock': {
        g.fillStyle = '#8a6a48'; g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = 'rgba(50,34,20,0.6)'; g.lineWidth = 1;
        if (h > w) for (let yy = y - h / 2; yy < y + h / 2; yy += 6) { g.beginPath(); g.moveTo(x - w / 2, yy); g.lineTo(x + w / 2, yy); g.stroke(); }
        else for (let xx = x - w / 2; xx < x + w / 2; xx += 6) { g.beginPath(); g.moveTo(xx, y - h / 2); g.lineTo(xx, y + h / 2); g.stroke(); }
        g.fillStyle = '#4a3420';
        for (let yy = y - h / 2 + 8; yy < y + h / 2; yy += 30) { g.fillRect(x - w / 2 - 3, yy, 4, 10); g.fillRect(x + w / 2 - 1, yy, 4, 10); }
        g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case 'field': {
        const col = it.p?.col ?? '#8ab060';
        g.fillStyle = rgba(shade(col, -0.2), 0.7); g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = rgba(shade(col, 0.15), 0.9); g.lineWidth = 3;
        for (let yy = y - h / 2 + 5; yy < y + h / 2; yy += 8) { g.beginPath(); g.moveTo(x - w / 2 + 3, yy); g.lineTo(x + w / 2 - 3, yy); g.stroke(); }
        if (it.p?.flowers) { for (let k = 0; k < w * h / 300; k++) { g.fillStyle = it.p.flowers[k % it.p.flowers.length]; g.beginPath(); g.arc(x - w / 2 + rnd() * w, y - h / 2 + rnd() * h, 1.8, 0, Math.PI * 2); g.fill(); } }
        g.strokeStyle = 'rgba(90,80,50,0.5)'; g.lineWidth = 1.2; g.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case 'pond': {
        g.fillStyle = 'rgba(120,160,165,0.95)'; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = shade(pal.stone, -0.2); g.lineWidth = 3; g.stroke();
        g.fillStyle = 'rgba(70,120,70,0.8)';
        for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + (rnd() - 0.5) * w * 0.7, y + (rnd() - 0.5) * h * 0.6, 4, 2.4, 0, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case 'moonpool': {
        g.fillStyle = 'rgba(150,170,200,0.95)'; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#e8ecf4'; g.lineWidth = 4; g.stroke();
        g.fillStyle = 'rgba(250,250,255,0.85)'; g.beginPath(); g.ellipse(x, y, w * 0.16, h * 0.16, 0, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'bloodpool': {
        g.fillStyle = 'rgba(120,20,24,0.95)'; g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2a1a1a'; g.lineWidth = 4; g.stroke();
        break;
      }
      case 'array': {
        const col = it.p?.col ?? '#5a7ab0';
        g.save(); g.translate(x, y); g.scale(1, K);
        g.strokeStyle = rgba(col, 0.8); g.lineWidth = 3;
        for (const r of [w / 2, w * 0.42, w * 0.26]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
        g.lineWidth = 1.6;
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * w * 0.26, Math.sin(a) * w * 0.26); g.lineTo(Math.cos(a + 0.8) * w * 0.42, Math.sin(a + 0.8) * w * 0.42); g.stroke(); }
        g.fillStyle = rgba(col, 0.85); g.font = `${w * 0.05}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const runes = '乾坤震巽坎离艮兑';
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.fillText(runes[k], Math.cos(a) * w * 0.46, Math.sin(a) * w * 0.46); }
        g.restore();
        break;
      }
      case 'scorch': {
        const gr = g.createRadialGradient(x, y, 0, x, y, w / 2);
        gr.addColorStop(0, rgba(it.p?.col ?? '#3a2020', 0.55)); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, h / w); g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.restore(); g.fill();
        break;
      }
      case 'courtyard': {
        g.fillStyle = 'rgba(222,212,182,0.9)'; g.fillRect(x - w / 2, y - h / 2, w, h);
        g.strokeStyle = 'rgba(150,140,120,0.9)'; g.lineWidth = 4; g.strokeRect(x - w / 2, y - h / 2, w, h);
        break;
      }
    }
  }
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: W / 2, ay: H / 2 };
}

// ======================= 布局 =======================
export function layoutLocation(loc: LocDef): LocLayout {
  const seed = strHash(loc.id);
  const rnd = mulberry32(seed);
  const R = (a: number, b: number) => a + rnd() * (b - a);
  const style = SECT_STYLE[loc.id];
  const pal: Pal = { ...BASE_PAL, ...(style?.pal ?? {}) };
  const L: LocLayout = { id: loc.id, pieces: [], ground: [], gw: 0, gh: 0, blocks: [], lights: [], pal, smoke: [], flags: [] };
  let sid = 0;
  const add = (kind: string, x: number, y: number, p: Record<string, any> = {}) => { L.pieces.push({ kind, x, y, seed: seed + ++sid * 7919, p }); };
  const ground = (kind: string, x: number, y: number, w: number, h: number, p?: Record<string, any>) => L.ground.push({ kind, x, y, w, h, p });
  const block = (x: number, y: number, w: number, d: number) => L.blocks.push({ x: x - w / 2, y: y - d, w, h: d });
  const sc = (loc.scale ?? 1) * (style?.scale ?? 1);
  const treeRing = (cx: number, cy: number, rx: number, ry: number, n: number, sps: Species[], avoid?: (x: number, y: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 0.75 + rnd() * 0.35;
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      if (avoid && avoid(x, y)) continue;
      add('tree', x, y, { sp: sps[Math.floor(rnd() * sps.length)], s: 0.5 + rnd() * 0.15 });
    }
  };

  const t = loc.type;
  const grass = loc.id === 'tuwu' || loc.id === 'mulan';

  if (t === 'sect') {
    const feat = style?.feature;
    const W = 760 * sc, D = 560 * sc;
    const nT = 3 + (rnd() < 0.5 ? 1 : 0);
    const trees: Species[] = style?.trees ?? ['pine', 'cypress', 'broad'];
    // 台地：自南向北逐级升高
    let y = D * 0.38;
    const tw0 = W * R(0.8, 0.95);
    ground('plaza', 0, y + 40, tw0 * 0.6, 70);
    add('paifang', 0, y + 80, { w: 130 * Math.min(1.3, sc), h: 78, plaque: feat === 'demon' ? '#3a0a0a' : '#2a3a5a', stoneGate: feat === 'demon' || rnd() < 0.3 });
    add('lion', 0, y + 30, { gap: 60 });
    const halls: { x: number; y: number; w: number }[] = [];
    for (let i = 0; i < nT; i++) {
      const tw = tw0 * (1 - i * 0.12), th = D / nT * 0.82;
      const ty = y - th / 2;
      ground('terrace', 0, ty, tw, th, { hgt: 16 + i * 2 });
      ground('stairs', 0, y + 8, 44, 22 + i * 2);
      // 主殿
      const hw = (i === nT - 1 ? 230 : 170 + rnd() * 60) * Math.min(1.25, sc);
      const tiers = i === nT - 1 || rnd() < 0.4 ? 2 : 1;
      const hy = ty - th * 0.05;
      if (feat === 'dome' && i === nT - 1) add('dome', 0, hy, { w: hw * 0.9 });
      else add('hall', 0, hy, { w: hw, d: hw * 0.45, h: 40 + i * 4, tiers, ph: 10 });
      halls.push({ x: 0, y: hy, w: hw });
      block(0, hy, hw + 20, hw * 0.45);
      L.lights.push({ x: -hw * 0.25, y: hy - 30, r: 40 }, { x: hw * 0.25, y: hy - 30, r: 40 });
      // 配殿
      if (tw > 420) {
        for (const s of [-1, 1]) {
          if (rnd() < 0.2) continue;
          const sx = s * (tw / 2 - 80), sy = ty + th * 0.2;
          if (feat === 'dome') add('yurt', sx, sy, { w: 90 });
          else add('hall', sx, sy, { w: 110 + rnd() * 30, d: 50, h: 28, tiers: 1, ph: 6 });
          block(sx, sy, 130, 50);
          L.lights.push({ x: sx, y: sy - 20, r: 30 });
        }
      }
      // 鼎/碑/灯
      if (i === 0) add('ding', 0, ty + th * 0.36);
      if (rnd() < 0.5) { add('lantern', -tw * 0.18, ty + th * 0.4, { col: pal.accent }); add('lantern', tw * 0.18, ty + th * 0.4, { col: pal.accent }); }
      L.flags.push({ x: -tw / 2 + 20, y: ty + th / 2 - 4, color: pal.accent }, { x: tw / 2 - 20, y: ty + th / 2 - 4, color: pal.accent });
      y -= th + 16;
    }
    // 宝塔
    if (feat !== 'dome' && feat !== 'bamboo' && rnd() < 0.85) {
      const s = rnd() < 0.5 ? -1 : 1;
      const px = s * (tw0 / 2 + 60), py = D * 0.05;
      add('pagoda', px, py, { levels: feat === 'demon' ? 5 : 5 + Math.floor(rnd() * 4), w: 58, lit: true });
      block(px, py, 70, 40);
    }
    // 特色
    if (feat === 'moon') ground('moonpool', -tw0 * 0.32, D * 0.25, 150, 80);
    if (feat === 'demon') { ground('bloodpool', tw0 * 0.3, D * 0.22, 120, 60); for (let k = 0; k < 6; k++) add('obelisk', (k % 2 ? 1 : -1) * (tw0 / 2 + 20), D * 0.4 - k * 70, { glow: pal.accent, h: 60 + rnd() * 30 }); ground('scorch', 0, 0, W * 1.3, D * 1.2, { col: '#3a1a1a' }); }
    if (feat === 'herb') for (let k = 0; k < 6; k++) ground('field', (k % 2 ? 1 : -1) * (tw0 / 2 + 110), D * 0.3 - Math.floor(k / 2) * 110, 140, 80, { col: ['#6aa060', '#8ab860', '#5a9a70'][k % 3], flowers: ['#e05050', '#f0d050', '#f0f0f0'] });
    if (feat === 'martial') { ground('plaza', -tw0 * 0.32, D * 0.28, 160, 100, { col: '#c8b890' }); for (let k = 0; k < 5; k++) add('pillar', -tw0 * 0.32 - 60 + k * 30, D * 0.28 + 10, { h: 26 }); }
    if (feat === 'beast') for (let k = 0; k < 3; k++) { add('pen', (k - 1) * 150, D * 0.62, { len: 120 }); }
    if (feat === 'sword') add('sword', tw0 * 0.36, D * 0.3, { h: 200 });
    if (feat === 'fort') { add('wallH', 0, D * 0.55, { len: W * 0.9, gate: true, h: 40, col: '#8a8478' }); }
    if (feat === 'pink') ground('pond', tw0 * 0.3, D * 0.25, 130, 70);
    // 林木
    const n = feat === 'maple' ? 46 : feat === 'bamboo' ? 44 : 30;
    treeRing(0, -D * 0.05, W * 0.62, D * 0.62, n, trees, (x, yy) => Math.abs(x) < tw0 / 2 + 30 && yy < D * 0.42 && yy > -D * 0.7);
    if (feat === 'maple') for (let k = 0; k < 10; k++) { const x = (rnd() - 0.5) * tw0 * 1.2, yy = D * 0.5 + rnd() * 90; if (Math.abs(x) > 90) add('tree', x, yy, { sp: 'ymaple', s: 0.45 + rnd() * 0.15 }); }
    // 护山大阵
    const bc = style?.barrier ?? (feat === 'demon' ? '#c03030' : '#80c0e0');
    L.barrier = { x: 0, y: -D * 0.1, rx: W * 0.68, ry: D * 0.72, color: bc };
    L.gw = W * 1.6; L.gh = D * 1.7;
    for (let k = 0; k < 3; k++) L.smoke.push({ x: (rnd() - 0.5) * W * 0.5, y: -D * 0.3 + rnd() * D * 0.4 });
  } else if (t === 'city') {
    const major = !!loc.major;
    const W = (major ? 1250 : 980) * sc, D = (major ? 900 : 720) * sc;
    const wallCol = loc.id === 'tianxing' ? '#9a9890' : loc.id === 'tiantian' ? '#7a746a' : '#8e8a7e';
    // 城墙
    const segN = Math.max(3, Math.round(D / 160));
    add('wallH', 0, -D / 2, { len: W, gate: true, h: 50, col: wallCol, lit: true });
    for (let k = 0; k < segN; k++) {
      const y0 = D / 2 - (k * D) / segN, len = D / segN;
      add('wallV', -W / 2, y0, { len, side: -1, col: wallCol, end: k === 0 });
      add('wallV', W / 2, y0, { len, side: 1, col: wallCol, end: k === 0 });
    }
    // 南墙分两段，中间城门
    add('wallH', 0, D / 2, { len: W, gate: true, h: 50, col: wallCol, lit: true });
    for (const [x, y] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) add('tower', x, y + 1, { col: wallCol, lit: true });
    block(-W / 2 - 15, D / 2, W / 2 - 5, 30); block(W / 2 + 15 - (W / 2 - 5), D / 2, W / 2 - 5, 30);
    // 街道
    ground('plaza', 0, 0, W - 30, D - 20, { col: '#d4c8a6' });
    ground('street', 0, 0, 44, D, {});
    ground('street', 0, 0, W - 20, 40, {});
    if (major) { ground('street', -W / 4, 0, 26, D - 30); ground('street', W / 4, 0, 26, D - 30); ground('street', 0, -D / 4, W - 30, 24); ground('street', 0, D / 4, W - 30, 24); }
    // 钟鼓楼
    add('hall', 0, 40, { w: 130, d: 70, h: 30, ph: 26, tiers: 2, lit: true });
    block(0, 40, 150, 80);
    // 宫城（晋京、越京）或主城特色
    const palace = loc.id === 'jinjing' || loc.id === 'yuejing';
    if (palace) {
      const pp: Partial<Pal> = { roof: '#c8a030', pillar: '#a02a1a', wall: '#f0e0c8', accent: '#e0b040' };
      ground('plaza', 0, -D * 0.3, W * 0.36, D * 0.26, { col: '#e0d4b0' });
      add('hall', 0, -D * 0.25, { w: 260, d: 120, h: 50, ph: 22, tiers: 2, pal: pp, lit: true });
      add('hall', -W * 0.13, -D * 0.33, { w: 120, d: 60, h: 30, ph: 10, tiers: 1, pal: pp });
      add('hall', W * 0.13, -D * 0.33, { w: 120, d: 60, h: 30, ph: 10, tiers: 1, pal: pp });
      block(0, -D * 0.25, 280, 120);
    }
    if (loc.id === 'tianxing') { add('pagoda', 0, -D * 0.22, { levels: 11, w: 80, lh: 24, lit: true, pal: { roof: '#3a5a7a', accent: '#e0d080' } }); block(0, -D * 0.22, 100, 60); }
    // 民居：按街区成排
    const rowH = 92;
    const roofs = ['#4a4e54', '#52504a', '#3e4650', '#5a4e44'];
    for (let yy = -D / 2 + 110; yy < D / 2 - 30; yy += rowH) {
      for (let xx = -W / 2 + 60; xx < W / 2 - 40;) {
        const hw = 60 + rnd() * 40;
        const cx = xx + hw / 2;
        xx += hw + 10 + rnd() * 14;
        if (Math.abs(cx) < 60 + hw / 2) continue; // 主街
        if (Math.abs(yy) < 40 + 20) continue;
        if (Math.abs(cx) < 110 && Math.abs(yy - 40) < 80) continue; // 鼓楼
        if (palace && Math.abs(cx) < W * 0.2 && yy < -D * 0.15) continue;
        if (loc.id === 'tianxing' && Math.abs(cx) < 80 && Math.abs(yy + D * 0.22) < 70) continue;
        if (major && (Math.abs(Math.abs(cx) - W / 4) < 30 + hw / 2 || Math.abs(Math.abs(yy) - D / 4) < 16)) continue;
        if (rnd() < 0.08) { add('tree', cx, yy, { sp: rnd() < 0.5 ? 'broad' : 'willow', s: 0.45 }); continue; }
        const big = rnd() < 0.12;
        add('house', cx, yy, { w: big ? hw + 20 : hw, d: 40 + rnd() * 12, h: big ? 30 : 22 + rnd() * 5, roof: roofs[Math.floor(rnd() * roofs.length)], wall: rnd() < 0.25 ? '#c8a888' : undefined, lit: rnd() < 0.5, chimney: rnd() < 0.3 });
        block(cx, yy, hw, 34);
        L.lights.push({ x: cx, y: yy - 14, r: 22 });
        if (rnd() < 0.15) L.smoke.push({ x: cx + hw * 0.25, y: yy - 50 });
      }
    }
    // 南门大街摊贩
    for (let k = 0; k < 8; k++) { const s = k % 2 ? 1 : -1; add('stall', s * 46, D / 2 - 60 - Math.floor(k / 2) * 46, { col: ['#c84a3a', '#3a6a8a', '#c8a03a', '#5a8a4a'][k % 4] }); }
    for (let k = 0; k < 8; k++) L.lights.push({ x: (k % 2 ? 1 : -1) * 30, y: D / 2 - 40 - k * 50, r: 26 });
    L.flags.push({ x: -60, y: D / 2 - 50, color: '#c83a2a' }, { x: 60, y: D / 2 - 50, color: '#c83a2a' });
    L.gw = W + 200; L.gh = D + 200;
    if (loc.island) {
      // 码头
      ground('dock', 0, D / 2 + 220, 40, 300);
      ground('dock', 80, D / 2 + 340, 160, 30);
      add('boat', 150, D / 2 + 400, { sail: true, w: 110 });
      add('boat', -60, D / 2 + 360, { cabin: true, w: 80 });
      L.gh = D + 1000;
    }
  } else if (t === 'town') {
    const fort = loc.id === 'yanling' || loc.id === 'yejia';
    const vil = !!loc.minor;
    const W = vil ? 400 : 560, D = vil ? 300 : 420;
    if (grass) {
      const n = 10 + Math.floor(rnd() * 6);
      ground('plaza', 0, 0, 160, 110, { col: '#c8bc90' });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3, r = R(150, 240);
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.7;
        add('yurt', x, y, { w: 60 + rnd() * 30, band: ['#a8352a', '#2a5a8a', '#c8902a'][i % 3], lit: rnd() < 0.6 });
        block(x, y, 70, 30);
        L.lights.push({ x, y: y - 10, r: 20 });
        if (rnd() < 0.4) L.smoke.push({ x, y: y - 40 });
      }
      add('yurt', 0, -20, { w: 120, band: '#c8a030', lit: true });
      for (let k = 0; k < 4; k++) add('pen', R(-260, 260), R(200, 300), { len: 90 + rnd() * 60 });
      L.flags.push({ x: 0, y: -90, color: '#c8a030' });
    } else {
      ground('street', 0, 0, W, 34);
      ground('street', 0, 0, 30, D);
      if (fort) {
        add('wallH', 0, -D / 2, { len: W, h: 34, col: '#8a8478' });
        for (let k = 0; k < 3; k++) { add('wallV', -W / 2, D / 2 - k * D / 3, { len: D / 3, side: -1, h: 34, t: 20, col: '#8a8478', end: k === 0 }); add('wallV', W / 2, D / 2 - k * D / 3, { len: D / 3, side: 1, h: 34, t: 20, col: '#8a8478', end: k === 0 }); }
        add('wallH', 0, D / 2, { len: W, gate: true, h: 34, col: '#8a8478', lit: true });
        add('hall', 0, -D * 0.25, { w: 170, d: 80, h: 34, tiers: loc.id === 'yejia' ? 2 : 1, ph: 10, lit: true });
        block(0, -D * 0.25, 190, 80);
      }
      const n = vil ? 5 + Math.floor(rnd() * 4) : 10 + Math.floor(rnd() * 8);
      const roofs = ['#4a4e54', '#5a5048', '#6a5a48'];
      let placed = 0, tries = 0;
      const occ: { x: number; y: number; w: number }[] = [];
      while (placed < n && tries++ < 200) {
        const x = R(-W / 2 + 50, W / 2 - 50), y = R(-D / 2 + 70, D / 2 - 30);
        if (Math.abs(x) < 50 || Math.abs(y) < 40) continue;
        if (fort && Math.abs(x) < 110 && y < -D * 0.1) continue;
        if (occ.some((o) => Math.abs(o.x - x) < (o.w + 70) / 2 + 6 && Math.abs(o.y - y) < 60)) continue;
        const w = 56 + rnd() * 30;
        occ.push({ x, y, w });
        const thatch = !fort && rnd() < (vil ? 0.8 : 0.45);
        if (thatch) add('hut', x, y, { w, lit: rnd() < 0.6, roof: rnd() < 0.5 ? '#b89a5a' : '#a8905a' });
        else add('house', x, y, { w, d: 38, h: 22, roof: roofs[Math.floor(rnd() * roofs.length)], lit: rnd() < 0.6, gable: rnd() < 0.4, chimney: rnd() < 0.4 });
        block(x, y, w, 30);
        L.lights.push({ x, y: y - 12, r: 20 });
        if (rnd() < 0.3) L.smoke.push({ x: x + w * 0.25, y: y - 44 });
        if (!fort && rnd() < 0.4) add('fence', x, y + 26, { len: w + 20 });
        placed++;
      }
      add('well', 30, 40);
      if (vil) { /* 村落无集市 */ }
      else if (loc.id === 'tainan') for (let k = 0; k < 10; k++) add('stall', (k % 5 - 2) * 60, 30 + Math.floor(k / 5) * 60, { col: ['#c84a3a', '#3a6a8a', '#c8a03a', '#5a8a4a', '#8a4a8a'][k % 5] });
      else add('stall', -40, 30, { col: '#c8a03a' });
      if (!vil) L.flags.push({ x: 60, y: 30, color: '#c83a2a' });
      treeRing(0, 0, W * 0.62, D * 0.62, vil ? 6 : 10, ['broad', 'willow', 'peach', 'bamboo', 'pine']);
    }
    L.gw = W + 300; L.gh = D + 300;
  } else if (t === 'isle') {
    const r = (loc.island ?? 8) * 100;
    const demon = loc.id === 'jiyin', pink = loc.id === 'miaoyin';
    const P2 = style?.pal ?? {};
    ground('plaza', 0, 0, 220, 140, { col: (P2 as any).ground ?? '#d8ccaa' });
    if (pink || demon || loc.major) {
      add('hall', 0, -50, { w: 200, d: 90, h: 38, tiers: 2, ph: 12, lit: true });
      block(0, -50, 220, 90);
      if (style?.barrier) L.barrier = { x: 0, y: -40, rx: 330, ry: 260, color: style.barrier };
    }
    const n = 6 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, rr = R(140, 260);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.7;
      add(rnd() < 0.5 ? 'house' : 'hut', x, y, { w: 54 + rnd() * 20, lit: rnd() < 0.6, roof: demon ? '#2a2a34' : undefined });
      block(x, y, 60, 30);
      L.lights.push({ x, y: y - 10, r: 20 });
    }
    add('pagoda', R(-150, 150), R(-200, -140), { levels: 5, w: 44, lit: true });
    // 码头：南岸伸入海中
    const dy = r * 0.72;
    ground('path', 0, 0, 30, 0, { pts: [[0, 60], [20, dy * 0.5], [0, dy]] });
    ground('dock', 0, dy + 120, 34, 260);
    ground('dock', 70, dy + 230, 140, 26);
    add('boat', 130, dy + 290, { sail: true, w: 110 });
    add('boat', -50, dy + 250, { cabin: true, w: 80 });
    if (rnd() < 0.6) add('boat', 200, dy + 160, { w: 60 });
    treeRing(0, 0, 320, 220, 18, style?.trees ?? ['palm', 'palm', 'broad', 'bamboo']);
    L.gw = 900; L.gh = 600 + (dy + 320) * 2;
  } else if (t === 'secret') {
    const col = loc.id === 'xuese' ? '#c03030' : loc.id === 'kunwu' ? '#d0a040' : loc.id === 'xutian' ? '#80c8f0' : '#7090d0';
    ground('array', 0, 20, 360, 360, { col });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add('pillar', Math.cos(a) * 200, 20 + Math.sin(a) * 200 * K, { h: 70, broken: rnd() < 0.6 }); }
    add('paifang', 0, 200, { w: 140, h: 80, stoneGate: true, plaque: '#3a3a3a' });
    if (loc.id === 'kunwu' || loc.id === 'xutian') { add('hall', 0, -150, { w: 240, d: 100, h: 46, tiers: 2, ph: 24, pal: { roof: '#5a6070', wall: '#d8d4c8', pillar: '#7a7470' } }); block(0, -150, 260, 100); }
    add('stele', -120, 140); add('stele', 120, 150);
    for (let k = 0; k < 6; k++) add('rock', R(-300, 300), R(-260, 260), { w: 50 + rnd() * 40, h: 30 + rnd() * 30 });
    L.barrier = { x: 0, y: 0, rx: 380, ry: 300, color: col };
    L.gw = 900; L.gh = 800;
  } else { // danger
    const cold = loc.id === 'beihan', desert = loc.id === 'jixi_desert' || loc.id === 'xi_mo', sea = !!loc.island;
    ground('scorch', 0, 0, 700, 500, { col: cold ? '#a0b0c0' : desert ? '#8a6a3a' : '#3a2a2a' });
    add('rock', 0, -40, { w: 220, h: 130, cave: !sea, col: cold ? '#b8c4d0' : desert ? '#b0905a' : '#6a625a' });
    for (let k = 0; k < 8; k++) add('rock', R(-300, 300), R(-200, 220), { w: 40 + rnd() * 60, h: 30 + rnd() * 40, col: cold ? '#c8d0dc' : desert ? '#b8986a' : '#7a7068' });
    for (let k = 0; k < 6; k++) add('bones', R(-260, 260), R(-160, 200));
    treeRing(0, 0, 340, 260, 10, cold ? ['snowpine'] : desert ? ['dead'] : ['dead', 'pine', 'cypress']);
    L.gw = 900; L.gh = 700;
  }
  return L;
}
