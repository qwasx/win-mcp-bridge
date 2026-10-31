// 程序化树木：每种树按种子生成不同枝干、树冠；四季变化。全部用代码绘制，无贴图。
import { makeCanvas, shade, rgba, mix } from '../core/canvas';
import { mulberry32 } from '../core/rng';

export type Species = 'pine' | 'broad' | 'willow' | 'bamboo' | 'maple' | 'ymaple' | 'plum' | 'peach' | 'cypress' | 'snowpine' | 'dead' | 'palm' | 'apricot';
export type Season = 0 | 1 | 2 | 3; // 春 夏 秋 冬
export const SPECIES_LIST: Species[] = ['pine', 'broad', 'willow', 'bamboo', 'maple', 'ymaple', 'plum', 'peach', 'cypress', 'snowpine', 'dead', 'palm', 'apricot'];
export const SPECIES_NAME: Record<Species, string> = {
  pine: '松', broad: '槐', willow: '柳', bamboo: '竹', maple: '枫', ymaple: '黄枫', plum: '梅', peach: '桃',
  cypress: '柏', snowpine: '雪松', dead: '枯树', palm: '椰', apricot: '杏',
};
/** 世界坐标中的典型高度 */
export const TREE_SIZE: Record<Species, number> = {
  pine: 210, broad: 190, willow: 190, bamboo: 220, maple: 185, ymaple: 185, plum: 140, peach: 145,
  cypress: 215, snowpine: 235, dead: 150, palm: 230, apricot: 150,
};

export interface TreeSprite { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

const INK = 'rgba(38,30,22,0.9)';
type Pt = { x: number; y: number };
interface Seg { x0: number; y0: number; x1: number; y1: number; w0: number; w1: number; cx: number; cy: number; depth: number }

/** 递归分枝；返回枝段与枝梢 */
function grow(rnd: () => number, x: number, y: number, ang: number, len: number, w: number, depth: number, maxD: number,
  opt: { spread: number; decay: number; up: number; gnarl: number; kids: number }, segs: Seg[], tips: (Pt & { a: number; d: number })[]) {
  const bend = (rnd() - 0.5) * opt.gnarl;
  const a2 = ang + bend;
  const x1 = x + Math.cos(a2) * len, y1 = y + Math.sin(a2) * len;
  const cx = (x + x1) / 2 + Math.cos(a2 + Math.PI / 2) * len * (rnd() - 0.5) * 0.35 * (1 + opt.gnarl);
  const cy = (y + y1) / 2 + Math.sin(a2 + Math.PI / 2) * len * (rnd() - 0.5) * 0.35 * (1 + opt.gnarl);
  const w1 = w * (0.62 + rnd() * 0.12);
  segs.push({ x0: x, y0: y, x1, y1, w0: w, w1, cx, cy, depth });
  if (depth >= maxD || len < 5) { tips.push({ x: x1, y: y1, a: a2, d: depth }); return; }
  const n = opt.kids + (rnd() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    let na = a2 + t * opt.spread * 2 + (rnd() - 0.5) * 0.4;
    na += (-Math.PI / 2 - na) * opt.up; // 向上趋光
    grow(rnd, x1, y1, na, len * (opt.decay + (rnd() - 0.5) * 0.15), w1, depth + 1, maxD, opt, segs, tips);
  }
  if (depth < 2 && rnd() < 0.5) tips.push({ x: x1, y: y1, a: a2, d: depth });
}

/** 画一段渐细枝条（填充多边形，带一点曲度） */
function drawSeg(g: CanvasRenderingContext2D, s: Seg, col: string, outline: boolean) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  g.beginPath();
  g.moveTo(s.x0 + nx * s.w0 / 2, s.y0 + ny * s.w0 / 2);
  g.quadraticCurveTo(s.cx + nx * (s.w0 + s.w1) / 4, s.cy + ny * (s.w0 + s.w1) / 4, s.x1 + nx * s.w1 / 2, s.y1 + ny * s.w1 / 2);
  g.lineTo(s.x1 - nx * s.w1 / 2, s.y1 - ny * s.w1 / 2);
  g.quadraticCurveTo(s.cx - nx * (s.w0 + s.w1) / 4, s.cy - ny * (s.w0 + s.w1) / 4, s.x0 - nx * s.w0 / 2, s.y0 - ny * s.w0 / 2);
  g.closePath();
  g.fillStyle = col; g.fill();
  if (outline && s.w0 > 2.2) { g.strokeStyle = INK; g.lineWidth = Math.min(1.6, s.w0 * 0.18); g.stroke(); }
}

function drawBranches(g: CanvasRenderingContext2D, segs: Seg[], bark: string, rnd: () => number, snow = false) {
  for (const s of segs) drawSeg(g, s, s.depth === 0 ? bark : shade(bark, -0.08 * s.depth), true);
  // 树皮皴纹 + 阴面
  for (const s of segs) {
    if (s.w0 < 5) continue;
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    g.strokeStyle = 'rgba(30,22,16,0.32)'; g.lineWidth = Math.max(0.7, s.w0 * 0.08);
    g.beginPath();
    g.moveTo(s.x0 + nx * s.w0 * 0.3, s.y0 + ny * s.w0 * 0.3);
    g.quadraticCurveTo(s.cx + nx * s.w0 * 0.3, s.cy + ny * s.w0 * 0.3, s.x1 + nx * s.w1 * 0.3, s.y1 + ny * s.w1 * 0.3);
    g.stroke();
    const n = Math.floor(L / 9);
    for (let i = 0; i < n; i++) {
      const t = rnd(), px = s.x0 + dx * t, py = s.y0 + dy * t, ww = s.w0 + (s.w1 - s.w0) * t;
      const o = (rnd() - 0.5) * ww * 0.6;
      g.beginPath(); g.moveTo(px + nx * o, py + ny * o); g.lineTo(px + nx * o + dx / L * 3, py + ny * o + dy / L * 3 + 1); g.stroke();
    }
    if (snow && Math.abs(dx) > Math.abs(dy) * 0.4) {
      g.strokeStyle = 'rgba(250,252,255,0.95)'; g.lineWidth = Math.max(1.2, s.w0 * 0.35);
      g.beginPath(); g.moveTo(s.x0, s.y0 - s.w0 * 0.45); g.quadraticCurveTo(s.cx, s.cy - s.w0 * 0.45, s.x1, s.y1 - s.w1 * 0.45); g.stroke();
    }
  }
}

/** 一团树叶：由若干小圆叠成，深-中-浅三层 */
interface Clump { x: number; y: number; r: number }
function drawClumps(g: CanvasRenderingContext2D, clumps: Clump[], cols: [string, string, string], rnd: () => number, dots: string | null, leafShape: 'round' | 'star' = 'round') {
  const sub: { x: number; y: number; r: number }[] = [];
  for (const c of clumps) {
    const n = 5 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * c.r * 0.7;
      sub.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.8, r: c.r * (0.38 + rnd() * 0.3) });
    }
  }
  g.fillStyle = cols[0];
  for (const s of sub) { g.beginPath(); g.arc(s.x + s.r * 0.18, s.y + s.r * 0.22, s.r, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = cols[1];
  for (const s of sub) { g.beginPath(); g.arc(s.x, s.y, s.r * 0.88, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = cols[2];
  for (const s of sub) { if (rnd() < 0.7) { g.beginPath(); g.arc(s.x - s.r * 0.28, s.y - s.r * 0.3, s.r * 0.5, 0, Math.PI * 2); g.fill(); } }
  // 点叶法
  if (dots) {
    g.fillStyle = dots;
    for (const s of sub) {
      const m = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < m; i++) {
        const a = rnd() * Math.PI * 2, d = s.r * (0.6 + rnd() * 0.45);
        const px = s.x + Math.cos(a) * d, py = s.y + Math.sin(a) * d;
        if (leafShape === 'star') star(g, px, py, s.r * 0.18, a);
        else { g.beginPath(); g.ellipse(px, py, s.r * 0.12, s.r * 0.08, a, 0, Math.PI * 2); g.fill(); }
      }
    }
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}

function snowCaps(g: CanvasRenderingContext2D, clumps: Clump[], rnd: () => number, k = 1) {
  g.fillStyle = 'rgba(250,252,255,0.94)';
  for (const c of clumps) {
    if (rnd() > 0.85 * k) continue;
    g.beginPath(); g.ellipse(c.x - c.r * 0.1, c.y - c.r * 0.55, c.r * 0.72, c.r * 0.26, 0, Math.PI, Math.PI * 2); g.fill();
  }
}

function flowerDots(g: CanvasRenderingContext2D, pts: Pt[], cols: string[], r: number, rnd: () => number) {
  for (const p of pts) {
    const c = cols[Math.floor(rnd() * cols.length)];
    g.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath(); g.arc(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.55, r * 0.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(200,150,40,0.9)'; g.beginPath(); g.arc(p.x, p.y, r * 0.25, 0, Math.PI * 2); g.fill();
  }
}

function groundShadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number) {
  const gr = g.createRadialGradient(x + rx * 0.25, y, 0, x + rx * 0.25, y, rx);
  gr.addColorStop(0, 'rgba(40,44,30,0.32)'); gr.addColorStop(1, 'rgba(40,44,30,0)');
  g.fillStyle = gr;
  g.save(); g.translate(x + rx * 0.25, y); g.scale(1, 0.32); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.restore(); g.fill();
}

// ---------------- 各树种 ----------------

function foliageColors(sp: Species, season: Season, rnd: () => number): [string, string, string] {
  const j = (rnd() - 0.5) * 0.12;
  const T = (a: string, b: string, c: string): [string, string, string] => [shade(a, j), shade(b, j), shade(c, j)];
  switch (sp) {
    case 'maple':
      if (season === 0) return T('#5d7a3a', '#8aab52', '#c2d27a');
      if (season === 1) return T('#2f5534', '#4f7d45', '#7fa863');
      if (season === 2) return rnd() < 0.5 ? T('#7a1e18', '#b8382a', '#e86a40') : T('#8a3a14', '#cc6a24', '#f0a040');
      return T('#6a3020', '#8a4a30', '#a86a48');
    case 'ymaple':
      if (season === 3) return T('#8a6a28', '#b8923a', '#d8b860');
      if (season === 2) return T('#a06a10', '#dca024', '#f6d050');
      return T('#7a7a20', '#bfae34', '#e8d460');
    case 'apricot':
      if (season === 0) return T('#d8a2a6', '#f2cccc', '#fff2ee');
      if (season === 2) return T('#8a6a24', '#c49a3a', '#e8c868');
      return T('#3a5e36', '#5e8e4a', '#94b86c');
    case 'peach':
      if (season === 0) return T('#c86a80', '#ec9aaa', '#fbd0d6');
      if (season === 2) return T('#6a6a28', '#a0943a', '#cfc06a');
      return T('#355a34', '#5a8a48', '#90b46a');
    default: // broad
      if (season === 0) return T('#4a7234', '#7ea84e', '#b8d47a');
      if (season === 1) return T('#24452c', '#3f6b3e', '#6f9a5a');
      if (season === 2) return rnd() < 0.5 ? T('#6a5420', '#b0882e', '#e2c060') : T('#5a4a22', '#94782e', '#c8a858');
      return T('#555', '#777', '#999');
  }
}

function broadLike(g: CanvasRenderingContext2D, sp: Species, season: Season, rnd: () => number, W: number, H: number) {
  const bx = W / 2 + (rnd() - 0.5) * W * 0.06, by = H - 10;
  groundShadow(g, bx, by, W * 0.36);
  const segs: Seg[] = [], tips: (Pt & { a: number; d: number })[] = [];
  const trunkH = H * (0.26 + rnd() * 0.1);
  const bare = season === 3 && sp !== 'ymaple';
  const maxD = bare ? 5 : 4;
  grow(rnd, bx, by, -Math.PI / 2 + (rnd() - 0.5) * 0.25, trunkH, W * (0.075 + rnd() * 0.03), 0, maxD,
    { spread: 0.55 + rnd() * 0.25, decay: 0.7, up: 0.18, gnarl: sp === 'maple' ? 0.5 : 0.35, kids: 2 }, segs, tips);
  const bark = sp === 'ymaple' ? '#6a5236' : sp === 'peach' || sp === 'apricot' ? '#5a3a2e' : '#5c4a38';
  const cols = foliageColors(sp, season, rnd);
  if (bare) {
    drawBranches(g, segs, bark, rnd, true);
    // 残叶
    if (sp === 'maple') { const c = cols; g.fillStyle = c[1]; for (const t of tips) if (rnd() < 0.3) star(g, t.x, t.y, 3.2, rnd() * 6); }
    return;
  }
  drawBranches(g, segs, bark, rnd);
  const clumps: Clump[] = [];
  const crownR = W * 0.16;
  for (const t of tips) if (t.d >= 2) clumps.push({ x: t.x, y: t.y, r: crownR * (0.75 + rnd() * 0.5) });
  // 冠底遮挡下部枝干的“背光团”
  clumps.sort((a, b) => a.y - b.y);
  const dotCol = sp === 'maple' || sp === 'ymaple' ? rgba(shade(cols[0], -0.25), 0.7) : rgba(shade(cols[0], -0.35), 0.55);
  drawClumps(g, clumps, cols, rnd, dotCol, sp === 'maple' || sp === 'ymaple' ? 'star' : 'round');
  if ((sp === 'peach' || sp === 'apricot') && season === 0) {
    const pts: Pt[] = [];
    for (const c of clumps) for (let i = 0; i < 9; i++) pts.push({ x: c.x + (rnd() - 0.5) * c.r * 1.6, y: c.y + (rnd() - 0.5) * c.r * 1.25 });
    flowerDots(g, pts, sp === 'peach' ? ['#fff0f2', '#f6b6c2', '#e8869a', '#d85a7a'] : ['#ffffff', '#fff4f0', '#f8d4d0', '#e8a8a8'], 3.6, rnd);
    // 树下落英
    for (let i = 0; i < 26; i++) { g.fillStyle = sp === 'peach' ? `rgba(240,150,170,${0.35 + rnd() * 0.4})` : `rgba(255,236,232,${0.4 + rnd() * 0.4})`; g.beginPath(); g.ellipse(bx + (rnd() - 0.5) * W * 0.8, by - 2 + (rnd() - 0.5) * 10, 1.6, 1.0, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }
  if (sp === 'ymaple' && season === 3) snowCaps(g, clumps, rnd, 0.8);
}

function pine(g: CanvasRenderingContext2D, season: Season, rnd: () => number, W: number, H: number, snowy = false) {
  const bx = W / 2 + (rnd() - 0.5) * W * 0.1, by = H - 10;
  groundShadow(g, bx, by, W * 0.32);
  // 弯曲的主干（黄山松：斜倚、顶部平展）
  const lean = (rnd() - 0.5) * 0.7;
  const pts: Pt[] = [];
  const N = 7, trunkH = H * (0.72 + rnd() * 0.12);
  let x = bx, y = by, a = -Math.PI / 2 + lean;
  for (let i = 0; i <= N; i++) {
    pts.push({ x, y });
    a += (rnd() - 0.5) * 0.45 - lean * 0.12;
    x += Math.cos(a) * trunkH / N; y += Math.sin(a) * trunkH / N;
  }
  const tw = W * (0.07 + rnd() * 0.025);
  const segs: Seg[] = [];
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[i + 1];
    segs.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, w0: tw * (1 - i / N * 0.7), w1: tw * (1 - (i + 1) / N * 0.7), cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, depth: 0 });
  }
  // 横向枝
  const pads: Clump[] = [];
  const tips: (Pt & { a: number; d: number })[] = [];
  const nb = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < nb; i++) {
    const k = 3 + Math.floor((i / nb) * (N - 3)) + (rnd() < 0.3 ? -1 : 0);
    const p = pts[Math.min(N, Math.max(2, k))];
    const side = i % 2 ? 1 : -1;
    const ba = side > 0 ? -0.15 - rnd() * 0.35 : Math.PI + 0.15 + rnd() * 0.35;
    const L = W * (0.18 + rnd() * 0.2) * (1 - i / nb * 0.3);
    grow(rnd, p.x, p.y, ba, L, tw * 0.42, 1, 3, { spread: 0.45, decay: 0.62, up: 0.05, gnarl: 0.4, kids: 2 }, segs, tips);
  }
  const top = pts[N];
  grow(rnd, top.x, top.y, -Math.PI / 2 + (rnd() - 0.5) * 0.8, W * 0.12, tw * 0.3, 2, 3, { spread: 0.7, decay: 0.7, up: 0.1, gnarl: 0.3, kids: 2 }, segs, tips);
  // 松皮鳞纹
  drawBranches(g, segs, '#6a4a36', rnd);
  g.strokeStyle = 'rgba(40,26,18,0.5)'; g.lineWidth = 0.9;
  for (let i = 0; i < N - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    for (let k = 0; k < 3; k++) {
      const t = rnd(), px = p.x + (q.x - p.x) * t + (rnd() - 0.5) * tw * 0.5, py = p.y + (q.y - p.y) * t;
      g.beginPath(); g.ellipse(px, py, tw * 0.16, tw * 0.1, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  for (const t of tips) pads.push({ x: t.x, y: t.y - 2, r: W * (0.07 + rnd() * 0.04) });
  // 松针团：每团由多个小云片组成，上缘放射松针
  const dark = snowy ? '#1f3a34' : '#1c3529', mid = snowy ? '#2f5248' : '#2e5038', light = snowy ? '#5a7c70' : '#6a9068';
  const j = (rnd() - 0.5) * 0.1;
  const subs: Clump[] = [];
  for (const pd of pads) {
    const m = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < m; i++) subs.push({ x: pd.x + (i - (m - 1) / 2) * pd.r * 0.7 + (rnd() - 0.5) * pd.r * 0.4, y: pd.y + (rnd() - 0.5) * pd.r * 0.35, r: pd.r * (0.55 + rnd() * 0.35) });
  }
  pads.length = 0; pads.push(...subs);
  for (const pd of pads) {
    g.fillStyle = shade(dark, j);
    g.beginPath(); g.ellipse(pd.x + 1, pd.y + 1.6, pd.r * 1.15, pd.r * 0.5, 0, 0, Math.PI * 2); g.fill();
  }
  for (const pd of pads) {
    g.fillStyle = shade(mid, j + (rnd() - 0.5) * 0.08);
    g.beginPath(); g.ellipse(pd.x, pd.y, pd.r * 1.0, pd.r * 0.4, 0, 0, Math.PI * 2); g.fill();
  }
  for (const pd of pads) {
    // 松针：从团心向上半圈放射
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 1.05 + (i / (n - 1)) * Math.PI * 0.9;
      const r0 = pd.r * 0.25, r1 = pd.r * (0.9 + rnd() * 0.35);
      g.strokeStyle = i % 3 === 0 ? rgba(shade(light, j), 0.95) : rgba(shade(dark, j - 0.1), 0.9); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(pd.x + Math.cos(a) * r0, pd.y + Math.sin(a) * r0 * 0.4); g.lineTo(pd.x + Math.cos(a) * r1, pd.y + Math.sin(a) * r1 * 0.5 - pd.r * 0.08); g.stroke();
    }
  }
  if (season === 3 || snowy) {
    g.fillStyle = 'rgba(250,252,255,0.96)';
    for (const pd of pads) { g.beginPath(); g.ellipse(pd.x - 1, pd.y - pd.r * 0.3, pd.r * 0.9, pd.r * 0.26, 0, Math.PI, Math.PI * 2); g.fill(); }
  }
}

function snowpine(g: CanvasRenderingContext2D, rnd: () => number, W: number, H: number) {
  const bx = W / 2, by = H - 10;
  groundShadow(g, bx, by, W * 0.3);
  const top = H * (0.06 + rnd() * 0.06);
  g.fillStyle = '#4a3428'; g.fillRect(bx - 3, by - H * 0.2, 6, H * 0.2);
  const tiers = 6 + Math.floor(rnd() * 3);
  const hw = W * (0.3 + rnd() * 0.08);
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, t1 = (i + 1.5) / tiers;
    const y0 = top + (by - H * 0.14 - top) * t0, y1 = top + (by - H * 0.14 - top) * Math.min(1, t1);
    const w1 = hw * Math.min(1, t1) * (0.9 + rnd() * 0.2);
    const sk = (rnd() - 0.5) * 4;
    const path = new Path2D();
    path.moveTo(bx + sk, y0);
    path.quadraticCurveTo(bx + w1 * 0.4, y0 + (y1 - y0) * 0.5, bx + w1, y1 + 3);
    for (let k = 0; k <= 6; k++) path.lineTo(bx + w1 - (k / 6) * w1 * 2, y1 + (k % 2 ? -3 : 3));
    path.quadraticCurveTo(bx - w1 * 0.4, y0 + (y1 - y0) * 0.5, bx + sk, y0);
    g.fillStyle = '#20382f'; g.fill(path);
    g.save(); g.clip(path);
    g.fillStyle = 'rgba(70,100,90,0.6)'; g.fillRect(bx - w1, y0, w1 * 0.9, y1 - y0 + 4);
    // 雪
    g.fillStyle = 'rgba(250,252,255,0.95)';
    g.beginPath(); g.moveTo(bx + sk, y0 - 1);
    g.quadraticCurveTo(bx + w1 * 0.5, y0 + (y1 - y0) * 0.55, bx + w1, y1 - 1);
    g.lineTo(bx + w1 * 0.6, y1 - (y1 - y0) * 0.25);
    g.quadraticCurveTo(bx, y0 + (y1 - y0) * 0.5, bx - w1 * 0.6, y1 - (y1 - y0) * 0.22);
    g.lineTo(bx - w1, y1 - 1);
    g.quadraticCurveTo(bx - w1 * 0.5, y0 + (y1 - y0) * 0.55, bx + sk, y0 - 1);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(16,30,24,0.7)'; g.lineWidth = 1; g.stroke(path);
  }
}

function cypress(g: CanvasRenderingContext2D, season: Season, rnd: () => number, W: number, H: number) {
  const bx = W / 2, by = H - 10;
  groundShadow(g, bx, by, W * 0.26);
  const segs: Seg[] = [];
  const tw = W * 0.07;
  let x = bx, y = by, a = -Math.PI / 2;
  const pts: Pt[] = [];
  for (let i = 0; i < 5; i++) { pts.push({ x, y }); a += (rnd() - 0.5) * 0.3; x += Math.cos(a) * H * 0.16; y += Math.sin(a) * H * 0.16; }
  pts.push({ x, y });
  for (let i = 0; i < 5; i++) segs.push({ x0: pts[i].x, y0: pts[i].y, x1: pts[i + 1].x, y1: pts[i + 1].y, w0: tw * (1 - i * 0.15), w1: tw * (1 - (i + 1) * 0.15), cx: (pts[i].x + pts[i + 1].x) / 2 + (rnd() - 0.5) * 6, cy: (pts[i].y + pts[i + 1].y) / 2, depth: 0 });
  drawBranches(g, segs, '#5a4636', rnd);
  // 扭转的柱状树冠
  const clumps: Clump[] = [];
  const topY = H * 0.06, botY = by - H * 0.22;
  const n = 16 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const yy = topY + (botY - topY) * t;
    const ww = W * (0.08 + 0.2 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.75));
    clumps.push({ x: bx + Math.sin(t * 7 + rnd()) * ww * 0.6 + (rnd() - 0.5) * 6, y: yy, r: ww * (0.7 + rnd() * 0.3) });
  }
  drawClumps(g, clumps, ['#1a3328', '#2c4a38', '#4c6e54'], rnd, 'rgba(12,24,16,0.5)');
  if (season === 3) snowCaps(g, clumps, rnd, 0.6);
}

function willow(g: CanvasRenderingContext2D, season: Season, rnd: () => number, W: number, H: number) {
  const bx = W / 2 + (rnd() - 0.5) * 10, by = H - 10;
  groundShadow(g, bx, by, W * 0.36);
  const segs: Seg[] = [], tips: (Pt & { a: number; d: number })[] = [];
  const lean = (rnd() - 0.5) * 0.5;
  grow(rnd, bx, by, -Math.PI / 2 + lean, H * 0.28, W * 0.1, 0, 3, { spread: 0.7, decay: 0.72, up: 0.1, gnarl: 0.55, kids: 3 }, segs, tips);
  drawBranches(g, segs, '#4e3e30', rnd);
  const col = season === 0 ? '#a8c460' : season === 1 ? '#5f8f48' : season === 2 ? '#bfae58' : '#8a7a5a';
  const col2 = season === 0 ? '#d0e080' : season === 1 ? '#8ab868' : season === 2 ? '#dccc80' : '#a89a78';
  // 拱形细枝 + 下垂柳丝
  for (const t of tips) {
    const n = 7 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const ax = t.x + Math.cos(a) * W * 0.12 * (0.5 + rnd()), ay = t.y + Math.sin(a) * H * 0.08 * (0.3 + rnd());
      const len = H * (0.32 + rnd() * 0.3);
      const sway = (rnd() - 0.5) * 10 + (ax - bx) * 0.08;
      const ex = ax + sway, ey = Math.min(by - 8, ay + len);
      g.strokeStyle = season === 3 ? 'rgba(80,70,52,0.7)' : rgba(shade(col, -0.35), 0.8); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(t.x, t.y); g.quadraticCurveTo((t.x + ax) / 2, ay - 6, ax, ay);
      g.quadraticCurveTo(ax + sway * 0.2, ay + len * 0.5, ex, ey); g.stroke();
      if (season !== 3) {
        // 叶片：沿柳丝的短斜线
        const m = Math.floor(len / 5);
        for (let k = 1; k < m; k++) {
          const tt = k / m;
          const px = ax + (ex - ax) * tt * tt * 0.8 + sway * 0.2 * tt, py = ay + (ey - ay) * tt;
          g.strokeStyle = k % 3 === 0 ? col2 : col; g.lineWidth = 2;
          const s = k % 2 ? 1 : -1;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * 3.2, py + 2.4); g.stroke();
        }
      }
    }
  }
}

function bamboo(g: CanvasRenderingContext2D, season: Season, rnd: () => number, W: number, H: number) {
  const by = H - 10;
  groundShadow(g, W / 2, by, W * 0.42);
  const n = 6 + Math.floor(rnd() * 9);
  const culms: { x: number; top: number; lean: number; w: number }[] = [];
  for (let i = 0; i < n; i++) culms.push({ x: W * 0.25 + rnd() * W * 0.5, top: H * (0.05 + rnd() * 0.3), lean: (rnd() - 0.5) * 30, w: 3.4 + rnd() * 2.8 });
  culms.sort((a, b) => b.w - a.w);
  const culmCol = season === 2 ? '#7a9050' : '#4f8050';
  const leafs: { x: number; y: number; a: number; s: number }[] = [];
  for (const c of culms) {
    const x0 = c.x, x1 = c.x + c.lean;
    const segN = 7 + Math.floor(rnd() * 3);
    for (let k = 0; k < segN; k++) {
      const t0 = k / segN, t1 = (k + 1) / segN;
      const ya = by - (by - c.top) * t0, yb = by - (by - c.top) * t1;
      const xa = x0 + (x1 - x0) * t0 * t0, xb = x0 + (x1 - x0) * t1 * t1;
      g.strokeStyle = shade(culmCol, (rnd() - 0.5) * 0.15); g.lineWidth = c.w * (1 - t0 * 0.4); g.lineCap = 'butt';
      g.beginPath(); g.moveTo(xa, ya - 1); g.lineTo(xb, yb + 1); g.stroke();
      g.strokeStyle = 'rgba(30,50,30,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xb - c.w * 0.7, yb + 1); g.lineTo(xb + c.w * 0.7, yb); g.stroke();
      if (k > segN * 0.35) {
        const m = 2 + Math.floor(rnd() * 3);
        for (let q = 0; q < m; q++) leafs.push({ x: xb, y: yb, a: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 1.1) + Math.PI / 2, s: 12 + rnd() * 10 });
      }
    }
    g.lineCap = 'round';
  }
  const lc = season === 0 ? ['#3e7a40', '#6aa858'] : season === 2 ? ['#56703a', '#8a9a50'] : ['#24502e', '#3f7a44'];
  for (const L of leafs) {
    // 个字叶
    for (let k = -1; k <= 1; k++) {
      const a = L.a + k * 0.45;
      const ex = L.x + Math.cos(a) * L.s, ey = L.y + Math.sin(a) * L.s * 0.6 + L.s * 0.25;
      g.fillStyle = k === 0 ? lc[0] : lc[1];
      g.beginPath(); g.moveTo(L.x, L.y);
      g.quadraticCurveTo((L.x + ex) / 2 - Math.sin(a) * 2.6, (L.y + ey) / 2 + Math.cos(a) * 2.6, ex, ey);
      g.quadraticCurveTo((L.x + ex) / 2 + Math.sin(a) * 2.6, (L.y + ey) / 2 - Math.cos(a) * 2.6, L.x, L.y);
      g.fill();
    }
  }
  if (season === 3) {
    g.fillStyle = 'rgba(250,252,255,0.92)';
    for (const L of leafs) if (rnd() < 0.5) { g.beginPath(); g.ellipse(L.x, L.y + 2, 6, 2, 0, Math.PI, Math.PI * 2); g.fill(); }
  }
}

function plum(g: CanvasRenderingContext2D, season: Season, rnd: () => number, W: number, H: number) {
  const bx = W / 2 + (rnd() - 0.5) * 16, by = H - 10;
  groundShadow(g, bx, by, W * 0.3);
  const segs: Seg[] = [], tips: (Pt & { a: number; d: number })[] = [];
  grow(rnd, bx, by, -Math.PI / 2 + (rnd() - 0.5) * 0.6, H * 0.3, W * 0.08, 0, 5, { spread: 0.75, decay: 0.68, up: 0.05, gnarl: 1.1, kids: 2 }, segs, tips);
  drawBranches(g, segs, '#3a2a22', rnd, season === 3);
  // 梅花：沿枝点花
  const pts: Pt[] = [];
  for (const s of segs) if (s.depth >= 2) { const m = 1 + Math.floor(rnd() * 3); for (let i = 0; i < m; i++) { const t = rnd(); pts.push({ x: s.x0 + (s.x1 - s.x0) * t + (rnd() - 0.5) * 4, y: s.y0 + (s.y1 - s.y0) * t + (rnd() - 0.5) * 4 }); } }
  for (const t of tips) pts.push(t);
  if (season === 0) flowerDots(g, pts, ['#fbe6ea', '#f3b0bf', '#fff'], 3.2, rnd);
  else if (season === 3) flowerDots(g, pts, ['#d0303a', '#e85a5a', '#b82030'], 3.0, rnd);
  else if (season === 1) { g.fillStyle = '#5a8a48'; for (const p of pts) if (rnd() < 0.7) { g.beginPath(); g.ellipse(p.x, p.y, 3, 1.8, rnd() * 3, 0, Math.PI * 2); g.fill(); } }
  else { g.fillStyle = '#b8902e'; for (const p of pts) if (rnd() < 0.35) { g.beginPath(); g.ellipse(p.x, p.y, 2.6, 1.6, rnd() * 3, 0, Math.PI * 2); g.fill(); } }
}

function dead(g: CanvasRenderingContext2D, rnd: () => number, W: number, H: number) {
  const bx = W / 2, by = H - 10;
  groundShadow(g, bx, by, W * 0.26);
  const segs: Seg[] = [], tips: (Pt & { a: number; d: number })[] = [];
  grow(rnd, bx, by, -Math.PI / 2 + (rnd() - 0.5) * 0.5, H * 0.32, W * 0.09, 0, 4, { spread: 0.7, decay: 0.66, up: 0.12, gnarl: 1.2, kids: 2 }, segs, tips);
  drawBranches(g, segs, '#7a6450', rnd);
  // 胡杨：少量金黄叶簇
  if (rnd() < 0.5) {
    const clumps = tips.filter(() => rnd() < 0.4).map((t) => ({ x: t.x, y: t.y, r: W * 0.07 }));
    drawClumps(g, clumps, ['#8a6a20', '#c8a03a', '#e8cc6a'], rnd, null);
  }
}

function palm(g: CanvasRenderingContext2D, rnd: () => number, W: number, H: number) {
  const bx = W * (0.35 + rnd() * 0.3), by = H - 10;
  groundShadow(g, bx + W * 0.1, by, W * 0.32);
  const bend = (rnd() < 0.5 ? -1 : 1) * W * (0.12 + rnd() * 0.18);
  const tx = bx + bend, ty = H * (0.2 + rnd() * 0.1);
  const N = 14;
  // 环节树干
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const x0 = bx + bend * t0 * t0, y0 = by + (ty - by) * t0, x1 = bx + bend * t1 * t1, y1 = by + (ty - by) * t1;
    const w = 7 - t0 * 3;
    g.strokeStyle = i % 2 ? '#8a7254' : '#7a6248'; g.lineWidth = w; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(40,30,20,0.6)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x1 - w / 2, y1); g.lineTo(x1 + w / 2, y1 + 1); g.stroke();
  }
  g.lineCap = 'round';
  // 椰叶
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.7 + (rnd() - 0.5) * 0.2;
    const L = W * (0.32 + rnd() * 0.12);
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.35;
    const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.5 - 6;
    g.strokeStyle = '#3a5a2e'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
    // 小叶
    for (let k = 1; k < 12; k++) {
      const t = k / 12;
      const px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * mx + t * t * ex;
      const py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * my + t * t * ey;
      const ll = 10 * (1 - Math.abs(t - 0.4));
      g.strokeStyle = k % 2 ? '#4f7a3a' : '#6a9a4a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.2) * ll * 0.4, py + ll * 0.8); g.stroke();
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1.2) * ll * 0.4, py + ll * 0.85); g.stroke();
    }
  }
  g.fillStyle = '#5a4a28';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(tx + (i - 1) * 4, ty + 5 + (i % 2) * 2, 3.2, 0, Math.PI * 2); g.fill(); }
}

/** 生成一棵树。res = 像素/世界单位 */
export function makeTree(sp: Species, season: Season, seed: number, res = 1): TreeSprite {
  const rnd = mulberry32(seed * 7919 + 13);
  const base = TREE_SIZE[sp] * (0.85 + rnd() * 0.3);
  const aspect = sp === 'cypress' ? 0.55 : sp === 'snowpine' ? 0.62 : sp === 'bamboo' ? 0.8 : sp === 'willow' ? 1.0 : sp === 'palm' ? 1.0 : sp === 'pine' ? 1.05 : 0.95;
  const H = Math.round(base), W = Math.round(base * aspect);
  const MX = W * 0.5, MY = H * 0.45;
  const CW = Math.ceil((W + MX * 2) * res), CH = Math.ceil((H + MY) * res);
  const big = makeCanvas(Math.max(1, CW), Math.max(1, CH));
  const g = big.getContext('2d')!;
  g.scale(res, res); g.translate(MX, MY);
  g.lineCap = 'round'; g.lineJoin = 'round';
  switch (sp) {
    case 'pine': pine(g, season, rnd, W, H); break;
    case 'snowpine': snowpine(g, rnd, W, H); break;
    case 'cypress': cypress(g, season, rnd, W, H); break;
    case 'willow': willow(g, season, rnd, W, H); break;
    case 'bamboo': bamboo(g, season, rnd, W, H); break;
    case 'plum': plum(g, season, rnd, W, H); break;
    case 'dead': dead(g, rnd, W, H); break;
    case 'palm': palm(g, rnd, W, H); break;
    default: broadLike(g, sp, season, rnd, W, H);
  }
  return trimSprite(big as HTMLCanvasElement, res, (W / 2 + MX), (H - 10 + MY));
}

/** 裁掉透明边缘；ax/ay 为世界单位下的锚点（树根） */
export function trimSprite(c: HTMLCanvasElement, res: number, axW: number, ayW: number): TreeSprite {
  const g = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 1) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += 1) if (d[row + x * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { canvas: c, w: w / res, h: h / res, ax: axW, ay: ayW };
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(w - 1, x1 + 1); y1 = Math.min(h - 1, y1 + 1);
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(c as any, -x0, -y0);
  return { canvas: out as HTMLCanvasElement, w: (x1 - x0 + 1) / res, h: (y1 - y0 + 1) / res, ax: axW - x0 / res, ay: ayW - y0 / res };
}

/** 树种在不同生态中的选择 */
export function pickSpecies(h: number, s: { arid: number; cold: number; elev: number; forest: number; nearWater: boolean; island: boolean; zone?: string }): Species {
  if (s.zone === 'ymaple') return h < 0.75 ? 'ymaple' : h < 0.88 ? 'pine' : 'bamboo';
  if (s.zone === 'demon') return h < 0.45 ? 'maple' : h < 0.78 ? 'dead' : 'pine';
  if (s.zone === 'ghost') return h < 0.5 ? 'dead' : h < 0.8 ? 'cypress' : 'pine';
  if (s.island) return h < 0.6 ? 'palm' : h < 0.8 ? 'broad' : 'bamboo';
  if (s.cold > 0.62) return h < 0.75 ? 'snowpine' : 'pine';
  if (s.arid > 0.8) return 'dead';
  if (s.arid > 0.5) return h < 0.5 ? 'dead' : h < 0.8 ? 'broad' : 'cypress';
  if (s.nearWater && h < 0.6) return 'willow';
  if (s.elev > 0.42) return h < 0.55 ? 'pine' : h < 0.75 ? 'cypress' : h < 0.88 ? 'maple' : 'bamboo';
  if (s.cold > 0.38) return h < 0.4 ? 'pine' : h < 0.7 ? 'cypress' : h < 0.9 ? 'plum' : 'broad';
  const r = h;
  if (r < 0.3) return 'broad';
  if (r < 0.45) return 'pine';
  if (r < 0.6) return 'bamboo';
  if (r < 0.72) return 'maple';
  if (r < 0.8) return 'peach';
  if (r < 0.87) return 'plum';
  return 'cypress';
}

export { mix };
