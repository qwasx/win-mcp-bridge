// 大地图美术：地形装饰、城池图标、旗帜、云、车队
import { type Ctx, type Canvas, makeCanvas, css, shade, mix, srand, OUTLINE } from './canvas';

export const MRES = 3; // 大地图纹理分辨率倍数

export interface AtlasFrame { name: string; x: number; y: number; w: number; h: number; ax: number; ay: number }
export interface Atlas { canvas: Canvas; frames: AtlasFrame[] }

/** 把若干画函数打包成图集。每个条目给出逻辑尺寸与锚点，函数在锚点为原点的坐标系中作画 */
export function pack(items: { name: string; w: number; h: number; ax: number; ay: number; draw: (ctx: Ctx) => void }[], res: number, maxW = 2048): Atlas {
  let x = 0, y = 0, rowH = 0;
  const pad = 2;
  const pos: { x: number; y: number }[] = [];
  for (const it of items) {
    const w = Math.ceil(it.w * res), h = Math.ceil(it.h * res);
    if (x + w > maxW) { x = 0; y += rowH + pad; rowH = 0; }
    pos.push({ x, y }); x += w + pad; rowH = Math.max(rowH, h);
  }
  const cv = makeCanvas(maxW, y + rowH + pad);
  const ctx = cv.getContext('2d')!;
  const frames: AtlasFrame[] = [];
  items.forEach((it, i) => {
    const w = Math.ceil(it.w * res), h = Math.ceil(it.h * res);
    ctx.save(); ctx.translate(pos[i].x + it.ax * res, pos[i].y + it.ay * res); ctx.scale(res, res);
    it.draw(ctx); ctx.restore();
    frames.push({ name: it.name, x: pos[i].x, y: pos[i].y, w, h, ax: it.ax / it.w, ay: it.ay / it.h });
  });
  return { canvas: cv, frames };
}

export function poly(ctx: Ctx, pts: number[], fill: string | CanvasGradient, stroke: string | null = null, lw = 0.5) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

// ---------- 地形装饰 ----------
function drawMountain(ctx: Ctx, w: number, h: number, seed: number, snow: number, rock: number) {
  const r = srand(seed);
  ell(ctx, w * 0.08, 0, w * 0.58, h * 0.13, 'rgba(40,30,20,0.18)');
  // 山脊轮廓
  const n = 7;
  const pts: number[] = [-w / 2, 0];
  const peakI = 3 + Math.floor(r() * 2) - 1;
  const ridge: [number, number][] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = -w / 2 + t * w + (r() - 0.5) * w * 0.06;
    const env = 1 - Math.abs(t - peakI / n) * 1.9;
    const y = -h * Math.max(0.12, env) * (0.75 + r() * 0.25) * (i === peakI ? 1.15 : 1);
    ridge.push([x, y]); pts.push(x, y);
  }
  pts.push(w / 2, 0);
  const lit = shade(rock, 0.32), dark = shade(rock, -0.32);
  // 整体
  poly(ctx, pts, css(rock));
  // 亮面（左）与暗面（右）：从每个峰往下作折线
  const [px, py] = ridge[peakI - 1];
  const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
  g.addColorStop(0, css(lit)); g.addColorStop(0.55, css(rock)); g.addColorStop(1, css(shade(rock, -0.1)));
  poly(ctx, pts, g);
  // 暗面
  const sp: number[] = [px, py];
  for (let i = peakI; i < ridge.length; i++) sp.push(ridge[i][0], ridge[i][1]);
  sp.push(w / 2, 0, px + w * 0.12, 0, px + w * 0.05, py * 0.45);
  poly(ctx, sp, css(dark, 0.9));
  // 次峰的阴影
  for (let i = 0; i < ridge.length; i++) {
    if (i === peakI - 1) continue;
    const [x, y] = ridge[i];
    if (y > -h * 0.25) continue;
    poly(ctx, [x, y, x + w * 0.12, y * 0.35, x + w * 0.04, 0, x + w * 0.02, y * 0.4], css(dark, 0.55));
  }
  // 雪顶
  if (snow > 0) {
    const sh = h * snow;
    const sn: number[] = [];
    sn.push(px, py);
    sn.push(px + w * 0.11, py + sh * 0.8, px + w * 0.05, py + sh * 0.55, px - w * 0.02, py + sh, px - w * 0.08, py + sh * 0.6, px - w * 0.15, py + sh * 0.9);
    poly(ctx, sn, 'rgba(250,250,255,0.95)');
    poly(ctx, [px, py, px + w * 0.11, py + sh * 0.8, px + w * 0.05, py + sh * 0.55, px + w * 0.02, py + sh * 0.3], 'rgba(170,180,205,0.9)');
  }
  // 皴法线条
  ctx.strokeStyle = css(shade(rock, -0.5), 0.55); ctx.lineWidth = 0.35; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const t = 0.25 + k * 0.17;
    const x0 = px + (w / 2 - px) * t * 0.7, y0 = py * (1 - t);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w * 0.06, y0 * 0.55); ctx.stroke();
  }
  // 轮廓
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length - 2; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineTo(w / 2, 0);
  ctx.strokeStyle = css(shade(rock, -0.6), 0.7); ctx.lineWidth = 0.45; ctx.stroke();
}

export function drawConifer(ctx: Ctx, h: number, col: number) {
  ell(ctx, 1.2, 0, h * 0.32, h * 0.09, 'rgba(20,30,10,0.28)');
  ctx.fillStyle = '#4a3420'; ctx.fillRect(-0.4, -h * 0.18, 0.8, h * 0.18);
  for (let i = 0; i < 3; i++) {
    const y0 = -h * (0.15 + i * 0.25), y1 = y0 - h * 0.42, wd = h * (0.3 - i * 0.07);
    poly(ctx, [-wd, y0, 0, y1, wd, y0], css(shade(col, -0.05 + i * 0.06)));
    poly(ctx, [0, y1, wd, y0, wd * 0.15, y0], css(shade(col, -0.3)));
  }
}
export function drawBroadleaf(ctx: Ctx, h: number, col: number, seed: number) {
  const r = srand(seed);
  ell(ctx, 1.5, 0, h * 0.42, h * 0.11, 'rgba(20,30,10,0.28)');
  ctx.fillStyle = '#4a3420'; ctx.fillRect(-0.5, -h * 0.35, 1, h * 0.35);
  const cy = -h * 0.6;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) blobs.push([(r() - 0.5) * h * 0.45, cy + (r() - 0.5) * h * 0.3, h * (0.2 + r() * 0.12)]);
  for (const [x, y, rr] of blobs) ell(ctx, x + 0.5, y + 0.6, rr, rr, css(shade(col, -0.35)));
  for (const [x, y, rr] of blobs) {
    const g = ctx.createRadialGradient(x - rr * 0.4, y - rr * 0.4, rr * 0.1, x, y, rr);
    g.addColorStop(0, css(shade(col, 0.25))); g.addColorStop(1, css(col));
    ell(ctx, x, y, rr * 0.92, rr * 0.92, g);
  }
}
function drawHill(ctx: Ctx, w: number, h: number, col: number) {
  ell(ctx, w * 0.08, 0, w * 0.55, h * 0.25, 'rgba(40,30,20,0.15)');
  ctx.beginPath(); ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w * 0.35, -h * 0.9, w * 0.2, -h * 1.1, w / 2, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
  g.addColorStop(0, css(shade(col, 0.25))); g.addColorStop(0.5, css(col)); g.addColorStop(1, css(shade(col, -0.28)));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = css(shade(col, -0.45), 0.6); ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.bezierCurveTo(-w * 0.35, -h * 0.9, w * 0.2, -h * 1.1, w / 2, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.05, -h * 0.75); ctx.quadraticCurveTo(w * 0.25, -h * 0.4, w * 0.3, -h * 0.05); ctx.stroke();
}
function drawDune(ctx: Ctx, w: number, h: number) {
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w * 0.1, -h * 1.6, w / 2, 0); ctx.quadraticCurveTo(0, -h * 0.5, -w / 2, 0);
  ctx.fillStyle = 'rgba(240,220,160,0.75)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w * 0.05, -h * 0.78); ctx.quadraticCurveTo(w * 0.2, -h * 0.5, w / 2, 0); ctx.quadraticCurveTo(w * 0.1, -h * 0.35, -w * 0.05, -h * 0.78);
  ctx.fillStyle = 'rgba(160,120,60,0.45)'; ctx.fill();
}
function drawTuft(ctx: Ctx, col: number) {
  ctx.strokeStyle = css(col, 0.8); ctx.lineWidth = 0.5; ctx.lineCap = 'round';
  for (const [x, a] of [[-1.5, -0.4], [0, 0], [1.4, 0.4], [-0.5, -0.15], [0.7, 0.2]] as [number, number][]) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(a) * 2.6, -Math.cos(a) * 2.8); ctx.stroke();
  }
}
export function drawRock(ctx: Ctx, w: number) {
  ell(ctx, 0.6, 0, w * 0.6, w * 0.2, 'rgba(0,0,0,0.2)');
  poly(ctx, [-w / 2, 0, -w * 0.35, -w * 0.45, w * 0.1, -w * 0.6, w * 0.45, -w * 0.25, w / 2, 0], '#8a8478', 'rgba(40,35,30,0.7)', 0.3);
  poly(ctx, [w * 0.1, -w * 0.6, w * 0.45, -w * 0.25, w / 2, 0, w * 0.1, 0], '#5e594f');
}

export function buildDecoAtlas(): Atlas {
  const items: Parameters<typeof pack>[0] = [];
  const rocks = [0x8a7a62, 0x7e6e58, 0x92846a];
  for (let i = 0; i < 6; i++) {
    const w = 26 + i * 4, h = 16 + (i % 3) * 5 + i;
    items.push({ name: `mtn${i}`, w: w + 2, h: h * 1.3 + 4, ax: w / 2 + 1, ay: h * 1.3 + 2, draw: c => drawMountain(c, w, h, 100 + i * 7, i >= 4 ? 0.28 : 0.12, rocks[i % 3]) });
  }
  for (let i = 0; i < 4; i++) {
    const w = 26 + i * 5, h = 20 + i * 4;
    items.push({ name: `snow${i}`, w: w + 2, h: h * 1.3 + 4, ax: w / 2 + 1, ay: h * 1.3 + 2, draw: c => drawMountain(c, w, h, 300 + i * 11, 0.45, 0x8e8a94) });
  }
  for (let i = 0; i < 3; i++) {
    const w = 18 + i * 5, h = 7 + i * 1.6;
    items.push({ name: `hill${i}`, w: w + 2, h: h + 3, ax: w / 2 + 1, ay: h + 1.5, draw: c => drawHill(c, w, h, [0x8e9a5a, 0x84905a, 0x9a9a62][i]) });
  }
  const greens = [0x3e6a34, 0x4a7a3a, 0x355e30, 0x5a8a40];
  for (let i = 0; i < 4; i++) { const h = 9 + i * 1.5; items.push({ name: `pine${i}`, w: h * 0.75, h: h + 2, ax: h * 0.37, ay: h + 0.5, draw: c => drawConifer(c, h, greens[i % 3] - 0x080808) }); }
  for (let i = 0; i < 4; i++) { const h = 9 + i * 1.4; items.push({ name: `tree${i}`, w: h * 1.05, h: h + 1.5, ax: h * 0.52, ay: h * 1.0, draw: c => drawBroadleaf(c, h, greens[(i + 1) % 4], 40 + i) }); }
  for (let i = 0; i < 2; i++) items.push({ name: `dune${i}`, w: 20 + i * 6, h: 7, ax: 10 + i * 3, ay: 6, draw: c => drawDune(c, 20 + i * 6, 4.2) });
  items.push({ name: 'tuft0', w: 6, h: 4, ax: 3, ay: 3.5, draw: c => drawTuft(c, 0x6a7a3a) });
  items.push({ name: 'tuft1', w: 6, h: 4, ax: 3, ay: 3.5, draw: c => drawTuft(c, 0x8a8a4a) });
  items.push({ name: 'rock0', w: 7, h: 5, ax: 3.5, ay: 4.5, draw: c => drawRock(c, 5) });
  return pack(items, MRES);
}

// ---------- 城池图标 ----------
export const ROOF = 0x3d4652, ROOF_HI = 0x6a7684, WALL = 0x9a8c74, WALL_TOP = 0xc4b698, WALL_DARK = 0x6e624e;
const PILLAR = 0xa8281e, PLASTER = 0xe8dcc0;

/** 歇山顶（翘角屋檐） */
export function roof(ctx: Ctx, cx: number, by: number, w: number, h: number, col = ROOF) {
  const e = w * 0.12;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - e, by - h * 0.25);
  ctx.quadraticCurveTo(cx - w / 2, by, cx - w / 2 + e, by);
  ctx.lineTo(cx + w / 2 - e, by);
  ctx.quadraticCurveTo(cx + w / 2, by, cx + w / 2 + e, by - h * 0.25);
  ctx.lineTo(cx + w * 0.3, by - h);
  ctx.lineTo(cx - w * 0.3, by - h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, css(shade(col, 0.25))); g.addColorStop(1, css(shade(col, -0.15)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.45; ctx.stroke();
  // 瓦垄
  ctx.strokeStyle = css(shade(col, -0.35), 0.7); ctx.lineWidth = 0.25;
  for (let i = 1; i < 6; i++) { const t = i / 6; ctx.beginPath(); ctx.moveTo(cx - w * 0.3 + w * 0.6 * t, by - h); ctx.lineTo(cx - w / 2 + w * t, by); ctx.stroke(); }
  // 正脊
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx - w * 0.32, by - h); ctx.lineTo(cx + w * 0.32, by - h); ctx.stroke();
  ctx.strokeStyle = css(ROOF_HI); ctx.lineWidth = 0.35; ctx.stroke();
}
export function house(ctx: Ctx, x: number, y: number, w: number, h: number, roofCol = ROOF, wallCol = PLASTER) {
  ctx.fillStyle = css(wallCol); ctx.fillRect(x - w / 2, y - h * 0.55, w, h * 0.55);
  ctx.strokeStyle = 'rgba(40,25,15,0.7)'; ctx.lineWidth = 0.3; ctx.strokeRect(x - w / 2, y - h * 0.55, w, h * 0.55);
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - w * 0.1, y - h * 0.32, w * 0.2, h * 0.32);
  roof(ctx, x, y - h * 0.5, w * 0.95, h * 0.55, roofCol);
}
export function battlements(ctx: Ctx, x0: number, x1: number, y: number, col: number) {
  ctx.fillStyle = css(col);
  for (let x = x0; x < x1 - 0.5; x += 1.6) ctx.fillRect(x, y - 1, 0.95, 1);
}
/** 3/4 视角的城墙环（后墙、侧墙、前墙立面） */
function wallRing(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, th: number, face: number) {
  // 城内地面
  ctx.fillStyle = '#b8a47c'; ctx.fillRect(x0 + th, y0 + th, x1 - x0 - th * 2, y1 - y0 - th);
  // 后墙与侧墙顶面
  ctx.fillStyle = css(WALL_TOP);
  ctx.fillRect(x0, y0, x1 - x0, th); ctx.fillRect(x0, y0, th, y1 - y0); ctx.fillRect(x1 - th, y0, th, y1 - y0);
  ctx.fillStyle = css(WALL_DARK); ctx.fillRect(x0 + th, y0 + th, x1 - x0 - th * 2, 0.9); // 后墙内侧立面
  battlements(ctx, x0, x1, y0 + 0.2, WALL_DARK);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0 + face);
}
function frontWall(ctx: Ctx, x0: number, x1: number, y: number, th: number, face: number) {
  ctx.fillStyle = css(WALL_TOP); ctx.fillRect(x0, y - th, x1 - x0, th);
  const g = ctx.createLinearGradient(0, y, 0, y + face);
  g.addColorStop(0, css(WALL)); g.addColorStop(1, css(WALL_DARK));
  ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, face);
  // 砖缝
  ctx.strokeStyle = 'rgba(60,45,30,0.35)'; ctx.lineWidth = 0.2;
  for (let yy = y + 1.2; yy < y + face; yy += 1.2) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  battlements(ctx, x0, x1, y - th + 0.2, WALL_DARK);
  ctx.fillStyle = css(WALL_DARK); for (let x = x0 + 0.3; x < x1 - 0.5; x += 1.6) ctx.fillRect(x, y - 0.4, 0.95, 0.9);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(x0, y - th, x1 - x0, th + face);
}
function cornerTower(ctx: Ctx, x: number, y: number, s: number, face: number) {
  ctx.fillStyle = css(WALL_TOP); ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.fillStyle = css(WALL); ctx.fillRect(x - s / 2, y + s / 2, s, face);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(x - s / 2, y - s / 2, s, s + face);
  roof(ctx, x, y + s * 0.15, s * 1.1, s * 0.75);
}
export function gateTower(ctx: Ctx, cx: number, y: number, w: number, face: number, tiers: number, roofCol = ROOF) {
  // 墩台
  ctx.fillStyle = css(WALL_TOP); ctx.fillRect(cx - w / 2, y - 3, w, 3);
  ctx.fillStyle = css(shade(WALL, -0.05)); ctx.fillRect(cx - w / 2, y, w, face + 0.6);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(cx - w / 2, y - 3, w, face + 3.6);
  // 城门洞
  ctx.fillStyle = '#20140c';
  ctx.beginPath(); ctx.moveTo(cx - 1.8, y + face + 0.6); ctx.lineTo(cx - 1.8, y + face * 0.35); ctx.arc(cx, y + face * 0.35, 1.8, Math.PI, 0); ctx.lineTo(cx + 1.8, y + face + 0.6); ctx.closePath(); ctx.fill();
  // 城楼
  let by = y - 2.4;
  for (let t = 0; t < tiers; t++) {
    const ww = w * (0.78 - t * 0.16);
    ctx.fillStyle = css(PILLAR); ctx.fillRect(cx - ww * 0.42, by - 2.6, ww * 0.84, 2.6);
    ctx.fillStyle = 'rgba(30,15,8,0.55)'; for (let k = 0; k < 4; k++) ctx.fillRect(cx - ww * 0.36 + k * ww * 0.22, by - 2.3, ww * 0.1, 2);
    roof(ctx, cx, by - 2.4, ww * 1.15, 3.6 - t * 0.4, roofCol);
    by -= 5.2;
  }
}

function drawTown(ctx: Ctx, capital: boolean, variant = 0) {
  const W = capital ? 54 : 46;
  const x0 = -W / 2, x1 = W / 2, y0 = -18, y1 = 6, th = 2.6, face = 4.5;
  ell(ctx, 1.5, y1 + face + 0.5, W * 0.6, 4, 'rgba(30,20,10,0.25)');
  // 护城河
  {
    const rr = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const mx = x0 - 3, my = y0 - 2.6, mw = W + 6, mh = y1 - y0 + face + 5.4;
    rr(mx - 1.4, my - 1.2, mw + 2.8, mh + 2.6, 5); ctx.fillStyle = 'rgba(150,140,96,0.55)'; ctx.fill();   // 河岸
    rr(mx, my, mw, mh, 4); ctx.strokeStyle = 'rgba(46,88,104,0.95)'; ctx.lineWidth = 2; ctx.stroke();      // 水
    rr(mx, my - 0.4, mw, mh, 4); ctx.strokeStyle = 'rgba(140,190,200,0.55)'; ctx.lineWidth = 0.6; ctx.stroke(); // 波光
    // 吊桥
    ctx.fillStyle = '#7a5a36'; ctx.fillRect(-2.6, my + mh - 2, 5.2, 4);
    ctx.fillStyle = 'rgba(30,18,8,0.6)'; for (let k = 0; k < 3; k++) ctx.fillRect(-2.6, my + mh - 1.4 + k * 1.2, 5.2, 0.35);
  }
  wallRing(ctx, x0, y0, x1, y1, th, face);
  // 城内建筑
  const r = srand(capital ? 7 : 3 + variant * 11);
  const spots: [number, number][] = [];
  for (let yy = y0 + 7; yy < y1 - 1; yy += 5.2) for (let xx = x0 + 6; xx < x1 - 4; xx += 6.4) spots.push([xx + (r() - 0.5) * 2, yy + (r() - 0.5) * 1.2]);
  for (const [x, y] of spots) {
    if (Math.abs(x) < (capital ? 11 : 6) && y < y0 + 15) continue;
    if (r() < 0.15) continue;
    house(ctx, x, y, 4.4 + r() * 1.6, 3.6 + r() * 0.8, r() < 0.25 ? 0x5a5048 : ROOF, r() < 0.3 ? 0xd8c8a8 : PLASTER);
  }
  if (capital) {
    // 宫城（黄琉璃瓦）
    ctx.fillStyle = '#b8342a'; ctx.fillRect(-10, y0 + 4, 20, 9);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(-10, y0 + 4, 20, 9);
    ctx.fillStyle = css(PILLAR); ctx.fillRect(-6.5, y0 + 6, 13, 3.4);
    roof(ctx, 0, y0 + 6.4, 16, 5, 0xd8a62a);
    roof(ctx, 0, y0 + 1.4, 11, 3.6, 0xd8a62a);
  } else if (variant === 1) {
    // 宝塔
    const tx = -9, ty = y0 + 14;
    for (let k = 0; k < 5; k++) {
      const ww = 4.6 - k * 0.6, yy = ty - k * 2.6;
      ctx.fillStyle = k % 2 ? '#d8c8a8' : '#e8dcc0'; ctx.fillRect(tx - ww / 2, yy - 2.2, ww, 2.2);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.strokeRect(tx - ww / 2, yy - 2.2, ww, 2.2);
      ctx.fillStyle = '#20140c'; ctx.fillRect(tx - 0.3, yy - 1.7, 0.6, 1);
      roof(ctx, tx, yy - 1.9, ww + 2.2, 1.3);
    }
    ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(tx, ty - 13.4); ctx.lineTo(tx, ty - 16); ctx.stroke();
    house(ctx, 6, y0 + 11, 7, 4.6, 0x5a5048);
  } else if (variant === 2) {
    // 文庙（红墙黄瓦）
    ctx.fillStyle = '#9a3a2c'; ctx.fillRect(-8, y0 + 6, 16, 6.5);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.strokeRect(-8, y0 + 6, 16, 6.5);
    ctx.fillStyle = css(PILLAR); ctx.fillRect(-5, y0 + 7.4, 10, 3);
    ctx.fillStyle = 'rgba(30,15,8,0.5)'; for (let k = 0; k < 5; k++) ctx.fillRect(-4.4 + k * 2, y0 + 7.8, 0.8, 2.4);
    roof(ctx, 0, y0 + 7.6, 13, 4, 0x6a7a3a);
    ctx.fillStyle = '#5a6a3a'; ctx.beginPath(); ctx.arc(-11, y0 + 12, 2.4, 0, Math.PI * 2); ctx.arc(10.5, y0 + 11.5, 2.2, 0, Math.PI * 2); ctx.fill();
  } else {
    // 鼓楼 / 塔
    const tx = 0, ty = y0 + 13;
    ctx.fillStyle = css(WALL); ctx.fillRect(tx - 3.5, ty - 3, 7, 3);
    ctx.fillStyle = css(PILLAR); ctx.fillRect(tx - 2.6, ty - 5.6, 5.2, 2.6);
    roof(ctx, tx, ty - 5.4, 7.6, 3);
    ctx.fillStyle = css(PILLAR); ctx.fillRect(tx - 1.8, ty - 9.6, 3.6, 2);
    roof(ctx, tx, ty - 9.4, 5.6, 2.6);
  }
  frontWall(ctx, x0, x1, y1, th, face);
  cornerTower(ctx, x0 + 1.3, y0 + 1.3, 4, 2.4);
  cornerTower(ctx, x1 - 1.3, y0 + 1.3, 4, 2.4);
  cornerTower(ctx, x0 + 1.3, y1 - 0.6, 4.2, face);
  cornerTower(ctx, x1 - 1.3, y1 - 0.6, 4.2, face);
  gateTower(ctx, 0, y1, capital ? 14 : 11, face, capital ? 3 : 2);
}

function drawCastle(ctx: Ctx, variant = 0) {
  // 土台
  ctx.beginPath(); ctx.ellipse(0, 4, 17, 7.5, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-5, 0, 2, 0, 4, 17);
  g.addColorStop(0, '#a89868'); g.addColorStop(1, '#6e6440');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(40,30,15,0.5)'; ctx.lineWidth = 0.4; ctx.stroke();
  ell(ctx, 2, 10.5, 16, 2.5, 'rgba(30,20,10,0.25)');
  const x0 = -11, x1 = 11, y0 = -8, y1 = 5, th = 2.2, face = 3.6;
  wallRing(ctx, x0, y0, x1, y1, th, face);
  if (variant === 1) {
    // 营房 + 校场旗杆
    house(ctx, -4, y0 + 8, 6, 4, 0x5a5048);
    house(ctx, 4.5, y0 + 9, 5.5, 3.8);
    ctx.fillStyle = '#b8a47c'; ctx.fillRect(-2, y0 + 10, 6, 2.5);
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0, y0 + 11); ctx.lineTo(0, y0 - 2); ctx.stroke();
    ctx.fillStyle = '#c03020'; ctx.beginPath(); ctx.moveTo(0, y0 - 2); ctx.lineTo(3.4, y0 - 1); ctx.lineTo(0, y0 + 0.4); ctx.closePath(); ctx.fill();
  } else {
  // 箭楼
  ctx.fillStyle = css(WALL); ctx.fillRect(-4.5, y0 + 3, 9, 6);
  ctx.fillStyle = css(WALL_TOP); ctx.fillRect(-4.5, y0 + 1.5, 9, 1.5);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(-4.5, y0 + 1.5, 9, 7.5);
  ctx.fillStyle = '#20140c'; for (let k = 0; k < 3; k++) ctx.fillRect(-3 + k * 2.6, y0 + 4.5, 0.9, 1.4);
  ctx.fillStyle = css(PILLAR); ctx.fillRect(-3.4, y0 - 1.4, 6.8, 2.8);
  roof(ctx, 0, y0 - 1.2, 9.6, 3.6);
  }
  frontWall(ctx, x0, x1, y1, th, face);
  cornerTower(ctx, x0 + 1, y0 + 1, 3.4, 2);
  cornerTower(ctx, x1 - 1, y0 + 1, 3.4, 2);
  cornerTower(ctx, x0 + 1, y1 - 0.4, 3.6, face);
  cornerTower(ctx, x1 - 1, y1 - 0.4, 3.6, face);
  gateTower(ctx, 0, y1, 7, face, 1);
}

export function thatch(ctx: Ctx, x: number, y: number, w: number, h: number, looted: boolean) {
  ctx.fillStyle = looted ? '#5a5048' : css(PLASTER); ctx.fillRect(x - w / 2, y - h * 0.5, w, h * 0.5);
  ctx.strokeStyle = 'rgba(40,25,15,0.7)'; ctx.lineWidth = 0.3; ctx.strokeRect(x - w / 2, y - h * 0.5, w, h * 0.5);
  if (!looted) { ctx.fillStyle = '#4a3020'; ctx.fillRect(x - w * 0.1, y - h * 0.3, w * 0.22, h * 0.3); ctx.fillStyle = '#6a5030'; ctx.fillRect(x + w * 0.2, y - h * 0.38, w * 0.14, h * 0.12); }
  const col = looted ? 0x2a2420 : 0xb89656;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 0.8, y - h * 0.45); ctx.lineTo(x - w * 0.15, y - h * 1.05); ctx.lineTo(x + w * 0.15, y - h * 1.05); ctx.lineTo(x + w / 2 + 0.8, y - h * 0.45); ctx.closePath();
  const g = ctx.createLinearGradient(0, y - h, 0, y - h * 0.45);
  g.addColorStop(0, css(shade(col, 0.2))); g.addColorStop(1, css(shade(col, -0.2)));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.stroke();
  if (looted) { ctx.fillStyle = 'rgba(255,120,30,0.8)'; ctx.fillRect(x - 0.5, y - h * 0.8, 0.8, 0.8); ctx.fillRect(x + w * 0.25, y - h * 0.6, 0.6, 0.6); }
  else { ctx.strokeStyle = 'rgba(90,60,25,0.45)'; ctx.lineWidth = 0.22; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + k * w / 4, y - h * 0.45); ctx.lineTo(x - w * 0.15 + k * w * 0.075, y - h * 1.05); ctx.stroke(); } }
}

function drawVillage(ctx: Ctx, looted: boolean) {
  ell(ctx, 0.5, 2, 14, 4.2, looted ? 'rgba(40,35,30,0.35)' : 'rgba(150,130,80,0.45)');
  // 篱笆
  ctx.strokeStyle = looted ? 'rgba(40,30,20,0.6)' : 'rgba(110,80,40,0.85)'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.ellipse(0.5, 1.2, 13, 4.6, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.save(); ctx.translate(-7.5, -1); if (!looted) drawBroadleaf(ctx, 8.5, 0x4a7a3a, 9); else { ctx.fillStyle = '#2a2018'; ctx.fillRect(-0.4, -5, 0.8, 5); } ctx.restore();
  thatch(ctx, 6, -1.5, 6.5, 5.5, looted);
  thatch(ctx, -1.5, 0.6, 7, 6, looted);
  thatch(ctx, 7.5, 3.4, 5.5, 4.6, looted);
  // 草垛 / 水井
  if (!looted) {
    ell(ctx, -6, 3.8, 1.8, 1.2, '#c8a858');
    ctx.fillStyle = '#d8b868'; ctx.beginPath(); ctx.arc(-6, 3.2, 1.6, Math.PI, 0); ctx.fill();
  }
}

/** 关城：骑墙而建的城台与多层关楼，左右接长城，南侧瓮城 */
function drawPass(ctx: Ctx, major: boolean) {
  const W = major ? 58 : 46;
  const face = 4.2, th = 3.4;
  ell(ctx, 2, 9, W * 0.5, 4, 'rgba(30,20,10,0.25)');
  // 左右接墙
  for (const sgn of [-1, 1]) {
    const xa = sgn < 0 ? -W / 2 : 8, xb = sgn < 0 ? -8 : W / 2;
    ctx.fillStyle = css(WALL_TOP); ctx.fillRect(xa, -th, xb - xa, th);
    const g = ctx.createLinearGradient(0, 0, 0, face); g.addColorStop(0, css(WALL)); g.addColorStop(1, css(WALL_DARK));
    ctx.fillStyle = g; ctx.fillRect(xa, 0, xb - xa, face - 1);
    battlements(ctx, xa, xb, -th + 0.2, WALL_DARK);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.strokeRect(xa, -th, xb - xa, th + face - 1);
    // 端头敌楼
    const ex = sgn < 0 ? xa + 3 : xb - 3;
    ctx.fillStyle = css(WALL_TOP); ctx.fillRect(ex - 3, -th - 2, 6, 2);
    ctx.fillStyle = css(WALL); ctx.fillRect(ex - 3, -th, 6, th + face);
    ctx.strokeStyle = OUTLINE; ctx.strokeRect(ex - 3, -th - 2, 6, th + face + 2);
    ctx.fillStyle = '#20140c'; ctx.fillRect(ex - 0.4, -1.2, 0.8, 1.4);
    if (major) roof(ctx, ex, -th - 2.2, 7.5, 3);
  }
  // 瓮城（南侧半圆）
  ctx.beginPath(); ctx.moveTo(-9, face - 1); ctx.lineTo(-9, face + 4); ctx.quadraticCurveTo(0, face + 10, 9, face + 4); ctx.lineTo(9, face - 1);
  ctx.strokeStyle = css(WALL_DARK); ctx.lineWidth = 2.6; ctx.stroke();
  ctx.strokeStyle = css(WALL_TOP); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#20140c'; ctx.fillRect(3, face + 5.4, 2.4, 1.6);
  // 中央城台与关楼
  gateTower(ctx, 0, 0, major ? 20 : 16, face + 1.5, major ? 3 : 2);
}

export function buildSettlementAtlas(): Atlas {
  return pack([
    { name: 'town', w: 54, h: 50, ax: 27, ay: 36, draw: c => drawTown(c, false) },
    { name: 'capital', w: 62, h: 52, ax: 31, ay: 38, draw: c => drawTown(c, true) },
    { name: 'town1', w: 54, h: 50, ax: 27, ay: 36, draw: c => drawTown(c, false, 1) },
    { name: 'town2', w: 54, h: 50, ax: 27, ay: 36, draw: c => drawTown(c, false, 2) },
    { name: 'castle', w: 38, h: 34, ax: 19, ay: 22, draw: c => drawCastle(c) },
    { name: 'castle1', w: 38, h: 34, ax: 19, ay: 22, draw: c => drawCastle(c, 1) },
    { name: 'pass', w: 50, h: 44, ax: 25, ay: 30, draw: c => drawPass(c, false) },
    { name: 'pass_major', w: 62, h: 50, ax: 31, ay: 35, draw: c => drawPass(c, true) },
    { name: 'village', w: 32, h: 20, ax: 16, ay: 13, draw: c => drawVillage(c, false) },
    { name: 'village_looted', w: 32, h: 20, ax: 16, ay: 13, draw: c => drawVillage(c, true) },
  ], MRES, 1024);
}

// ---------- 旗帜 ----------
/** 牙旗：长杆 + 火焰边方旗，含 4 帧飘动。返回 canvas 与帧尺寸（逻辑单位 * res） */
export function buildBanner(color: number, ch: string, res = MRES, big = true): { canvas: Canvas; fw: number; fh: number; ax: number; ay: number } {
  const W = big ? 22 : 14, H = big ? 30 : 20;
  const poleX = 2, fw = W * res, fh = H * res;
  const cv = makeCanvas(fw * 4, fh);
  const ctx = cv.getContext('2d')!;
  const fl = big ? 13 : 8, fhh = big ? 10 : 6.5, top = 2;
  for (let f = 0; f < 4; f++) {
    ctx.save(); ctx.translate(f * fw, 0); ctx.scale(res, res);
    const ph = (f / 4) * Math.PI * 2;
    // 旗杆
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(poleX, top - 1); ctx.lineTo(poleX, H); ctx.stroke();
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.arc(poleX, top - 1.2, 0.9, 0, Math.PI * 2); ctx.fill();
    // 旗面（正弦飘动）
    const seg = 10;
    const wave = (t: number) => Math.sin(ph + t * 4.2) * 1.1 * t;
    const pts: [number, number][] = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push([poleX + t * fl, top + wave(t)]); }
    for (let i = seg; i >= 0; i--) { const t = i / seg; pts.push([poleX + t * fl, top + fhh + wave(t) - t * 0.8]); }
    // 火焰边
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) { const t = i / seg; const [x, y] = [poleX + t * fl, top + wave(t)]; const o = i % 2 ? -1.3 : 0; i ? ctx.lineTo(x, y + o) : ctx.moveTo(x, y + o); }
    for (let k = 0; k <= 4; k++) { const t = 1; const y = top + wave(t) + (fhh - 0.8) * (k / 4); ctx.lineTo(poleX + fl + (k % 2 ? 1.4 : 0), y); }
    for (let i = seg; i >= 0; i--) { const t = i / seg; ctx.lineTo(poleX + t * fl, top + fhh + wave(t) - t * 0.8 + (i % 2 ? 1.3 : 0)); }
    ctx.closePath();
    ctx.fillStyle = css(shade(color, -0.35)); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    const g = ctx.createLinearGradient(poleX, 0, poleX + fl, 0);
    for (let i = 0; i <= 4; i++) { const t = i / 4; g.addColorStop(t, css(shade(color, Math.sin(ph + t * 4.2) * 0.18))); }
    ctx.fillStyle = g; ctx.fill();
    // 字
    if (ch) {
      ctx.save();
      const cx = poleX + fl * 0.5, cy = top + fhh * 0.5 + wave(0.5) - 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, fhh * 0.36, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,245,220,0.92)'; ctx.fill();
      ctx.fillStyle = css(shade(color, -0.45));
      ctx.font = `bold ${fhh * 0.5}px "Noto Serif SC","Source Han Serif SC","Songti SC","SimSun","Microsoft YaHei",serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, cx, cy + 0.2);
      ctx.restore();
    }
    ctx.restore();
  }
  return { canvas: cv, fw, fh, ax: poleX / W, ay: 1 };
}

// ---------- 云 ----------
export function buildCloud(seed: number): Canvas {
  const W = 360, H = 180;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d')!;
  const r = srand(seed);
  for (let i = 0; i < 26; i++) {
    const x = W * 0.2 + r() * W * 0.6, y = H * 0.35 + r() * H * 0.3, rr = 25 + r() * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  return cv;
}

// ---------- 商队车 ----------
export function buildCart(res = MRES): { canvas: Canvas; fw: number; fh: number; ax: number; ay: number } {
  const W = 34, H = 20, ax = 17, ay = 16;
  const fw = W * res, fh = H * res;
  const cv = makeCanvas(fw * 4, fh);
  const ctx = cv.getContext('2d')!;
  for (let f = 0; f < 4; f++) {
    ctx.save(); ctx.translate(f * fw + ax * res, ay * res); ctx.scale(res, res);
    const ph = (f / 4) * Math.PI * 2;
    ell(ctx, 0, 0.5, 15, 2.4, 'rgba(0,0,0,0.25)');
    // 牛
    const ox = 9, oy = -5.5;
    const lg = (k: number) => Math.sin(ph + k * Math.PI) * 1.6;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    for (const [lx, k] of [[ox - 3, 0], [ox + 3, 1], [ox - 2, 1], [ox + 4, 0]] as [number, number][]) { ctx.beginPath(); ctx.moveTo(lx, oy + 2); ctx.lineTo(lx + lg(k), 0); ctx.stroke(); }
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 1;
    for (const [lx, k] of [[ox - 3, 0], [ox + 3, 1], [ox - 2, 1], [ox + 4, 0]] as [number, number][]) { ctx.beginPath(); ctx.moveTo(lx, oy + 2); ctx.lineTo(lx + lg(k), 0); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(ox, oy, 5.6, 3.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#6a4428'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ox + 6, oy + 0.5, 2.4, 1.8, 0.3, 0, Math.PI * 2); ctx.fillStyle = '#6a4428'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(ox + 5.4, oy - 1); ctx.quadraticCurveTo(ox + 5, oy - 3, ox + 3.6, oy - 3); ctx.stroke();
    // 车辕
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(ox - 4, oy - 0.5); ctx.lineTo(-2, oy - 0.5); ctx.stroke();
    // 车厢与货
    poly(ctx, [-14, -7.5, 0, -7.5, 0, -3.5, -14, -3.5], '#7a5230', OUTLINE, 0.5);
    ctx.beginPath(); ctx.moveTo(-14, -7.5); ctx.quadraticCurveTo(-7, -14.5, 0, -7.5); ctx.closePath();
    ctx.fillStyle = '#c8b48a'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 0.3;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-14 + k * 3.5, -7.5); ctx.quadraticCurveTo(-14 + k * 3.5, -12, -7, -11); ctx.stroke(); }
    // 车轮
    ctx.beginPath(); ctx.arc(-7, -3, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#5a3a20'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = '#a07848'; ctx.lineWidth = 0.4;
    for (let k = 0; k < 4; k++) { const a = ph / 2 + k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(-7 + Math.cos(a) * 2.8, -3 + Math.sin(a) * 2.8); ctx.lineTo(-7 - Math.cos(a) * 2.8, -3 - Math.sin(a) * 2.8); ctx.stroke(); }
    ctx.restore();
  }
  return { canvas: cv, fw, fh, ax: ax / W, ay: ay / H };
}

export { mix };
