// 大地图长城高清层：按 256 像素分块、3 倍分辨率烘焙。墙体有立面与垛口，敌楼、楼阁、墙外烽火台
import { GREAT_WALL, LIAO_WALL, ll } from '../core/terrain';
import { fbm } from '../core/rng';
import { makeCanvas, srand, OUTLINE, type Ctx } from './canvas';
import { roof } from './mapArt';

type P = [number, number];
const RES = 3, CH = 256;
const TOP_W = 3.4, FACE = 3.0;

/** 与底图一致的长城微起伏（缺口标记也要用） */
export function wallJitter(x: number, y: number) { return (fbm(x * 0.04, y * 0.04, 13, 2) - 0.5) * 8; }

let fineCache: P[][] | null = null;
export function wallFine(): P[][] {
  if (fineCache) return fineCache;
  fineCache = [GREAT_WALL, LIAO_WALL].map(l => {
    const pts = l.map(([lo, la]) => ll(lo, la));
    const out: P[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const segs = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5));
      for (let k = 0; k < segs; k++) { const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; out.push([x, y + wallJitter(x, y)]); }
    }
    const [lx, ly] = pts[pts.length - 1]; out.push([lx, ly + wallJitter(lx, ly)]);
    return out;
  });
  return fineCache;
}

interface Tower { x: number; y: number; kind: 'tower' | 'pavilion' | 'beacon'; nx: number; ny: number }
function towers(passPts: P[]): Tower[] {
  const out: Tower[] = [];
  const r = srand(77);
  for (const pts of wallFine()) {
    let acc = 0, n = 0, accB = 40;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      acc += d; accB += d;
      const [x, y] = pts[i];
      // 外侧法线（指向北/塞外）
      let nx = pts[i + 1][1] - pts[i - 1][1], ny = -(pts[i + 1][0] - pts[i - 1][0]);
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L; if (ny > 0) { nx = -nx; ny = -ny; }
      const nearPass = passPts.some(([px, py]) => Math.abs(px - x) < 22 && Math.abs(py - y) < 22);
      if (acc >= 24 && !nearPass) { acc = 0; n++; out.push({ x, y, kind: n % 4 === 0 ? 'pavilion' : 'tower', nx, ny }); }
      if (accB >= 80 && !nearPass) { accB = r() * 20; const o = 14 + r() * 10; out.push({ x: x + nx * o + (r() - 0.5) * 8, y: y + ny * o, kind: 'beacon', nx, ny }); }
    }
  }
  return out;
}

function drawWallBody(ctx: Ctx) {
  const fine = wallFine();
  const path = (dx: number, dy: number) => { ctx.beginPath(); for (const pts of fine) pts.forEach(([x, y], i) => i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)); };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 地面投影
  ctx.strokeStyle = 'rgba(24,16,6,0.28)'; ctx.lineWidth = TOP_W + 5; path(2.2, FACE + 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(24,16,6,0.22)'; ctx.lineWidth = TOP_W + 2; path(1.2, FACE + 0.8); ctx.stroke();
  // 墙基（毛石）
  ctx.strokeStyle = '#5e5242'; ctx.lineWidth = TOP_W + 1.6; path(0, FACE + 0.2); ctx.stroke();
  // 立面：沿竖直方向扫出
  const cols = ['#6f6250', '#7b6d58', '#867760', '#8f8068', '#978870', '#9d8f76'];
  for (let k = 0; k < cols.length; k++) { ctx.strokeStyle = cols[k]; ctx.lineWidth = TOP_W + 0.6; path(0, FACE * (1 - k / (cols.length - 1))); ctx.stroke(); }
  // 砖缝
  ctx.strokeStyle = 'rgba(50,38,24,0.35)'; ctx.lineWidth = 0.18;
  for (let t = 0.9; t < FACE; t += 0.9) { path(0, t + TOP_W / 2 - 0.1); ctx.stroke(); }
  ctx.setLineDash([0.18, 1.6]); ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(50,38,24,0.25)'; path(0, FACE * 0.5 + TOP_W / 2); ctx.stroke(); ctx.setLineDash([]);
  // 墙顶轮廓与马道
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = TOP_W + 0.9; path(0, 0); ctx.stroke();
  ctx.strokeStyle = '#cbbd9e'; ctx.lineWidth = TOP_W; path(0, 0); ctx.stroke();
  ctx.strokeStyle = '#ddd1b6'; ctx.lineWidth = TOP_W - 1.5; path(0, 0.2); ctx.stroke();
  ctx.setLineDash([0.4, 0.9]); ctx.strokeStyle = 'rgba(120,104,80,0.45)'; ctx.lineWidth = 0.3; path(0, 0.2); ctx.stroke(); ctx.setLineDash([]);
  // 外侧垛口（北侧）与内侧女墙
  ctx.setLineDash([0.85, 0.65]);
  ctx.strokeStyle = '#6a5d4a'; ctx.lineWidth = 0.95; path(0, -TOP_W / 2 - 0.25); ctx.stroke();
  ctx.strokeStyle = '#b7a888'; ctx.lineWidth = 0.4; path(0, -TOP_W / 2 - 0.55); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#8a7c64'; ctx.lineWidth = 0.4; path(0, TOP_W / 2 - 0.3); ctx.stroke();
}

function drawTower(ctx: Ctx, t: Tower) {
  const { x, y } = t;
  if (t.kind === 'beacon') {
    // 烽火台：夯土墩台 + 小屋
    ctx.fillStyle = 'rgba(24,16,6,0.28)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 2.4, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3.6, y + 1.5); ctx.lineTo(x - 2.4, y - 5); ctx.lineTo(x + 2.4, y - 5); ctx.lineTo(x + 3.6, y + 1.5); ctx.closePath();
    const g = ctx.createLinearGradient(x - 3.6, 0, x + 3.6, 0); g.addColorStop(0, '#b8a27a'); g.addColorStop(1, '#7e6a4a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.stroke();
    ctx.strokeStyle = 'rgba(70,50,30,0.35)'; ctx.lineWidth = 0.2; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - 3.6 + k * 0.3, y + 1.5 - k * 1.6); ctx.lineTo(x + 3.6 - k * 0.3, y + 1.5 - k * 1.6); ctx.stroke(); }
    ctx.fillStyle = '#d4c098'; ctx.fillRect(x - 2.4, y - 5.6, 4.8, 0.8);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 1, y - 7.2, 2, 1.6);
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(x - 1.5, y - 7.1); ctx.lineTo(x, y - 8.3); ctx.lineTo(x + 1.5, y - 7.1); ctx.closePath(); ctx.fill();
    return;
  }
  // 敌楼：方台，立面带箭窗
  const w = 6.2, top = 2.6, face = FACE + 3.2;
  ctx.fillStyle = 'rgba(24,16,6,0.3)'; ctx.fillRect(x - w / 2 + 1.6, y + 1.2, w, 2.4);
  const by = y - 2.2; // 楼顶前沿
  ctx.fillStyle = '#ccbf9f'; ctx.fillRect(x - w / 2, by - top, w, top);
  const g = ctx.createLinearGradient(0, by, 0, by + face); g.addColorStop(0, '#9d8f76'); g.addColorStop(1, '#6b5e4c');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, by, w, face);
  ctx.fillStyle = 'rgba(255,240,210,0.18)'; ctx.fillRect(x - w / 2, by, 1.1, face);
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.fillRect(x + w / 2 - 1.1, by, 1.1, face);
  ctx.strokeStyle = 'rgba(50,38,24,0.35)'; ctx.lineWidth = 0.16; for (let yy = by + 1; yy < by + face; yy += 1) { ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke(); }
  ctx.fillStyle = '#1e140c'; for (let k = -1; k <= 1; k++) { const wx = x + k * 1.9 - 0.4; ctx.beginPath(); ctx.moveTo(wx, by + 3); ctx.lineTo(wx, by + 1.9); ctx.arc(wx + 0.4, by + 1.9, 0.4, Math.PI, 0); ctx.lineTo(wx + 0.8, by + 3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#6a5d4a'; for (let k = x - w / 2; k < x + w / 2 - 0.4; k += 1.3) ctx.fillRect(k, by - top - 0.8, 0.8, 0.85);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.strokeRect(x - w / 2, by - top, w, top + face);
  if (t.kind === 'pavilion') {
    ctx.fillStyle = '#a8281e'; ctx.fillRect(x - 2, by - top - 2.2, 4, 2);
    ctx.fillStyle = 'rgba(30,15,8,0.55)'; ctx.fillRect(x - 1.4, by - top - 1.9, 0.6, 1.6); ctx.fillRect(x + 0.8, by - top - 1.9, 0.6, 1.6);
    roof(ctx, x, by - top - 2, 6.4, 2.8);
  }
}

export interface WallChunk { key: string; x: number; y: number; w: number; h: number; canvas: HTMLCanvasElement }
/** 生成长城高清分块（只含长城经过的块；以包围盒裁剪） */
export function buildWallChunks(passPts: P[]): WallChunk[] {
  const fine = wallFine();
  const tw = towers(passPts);
  const boxes = new Map<string, [number, number, number, number]>();
  const add = (x: number, y: number, m: number) => {
    const k = `${Math.floor(x / CH)},${Math.floor(y / CH)}`;
    const b = boxes.get(k);
    if (!b) boxes.set(k, [x - m, y - m, x + m, y + m]);
    else { b[0] = Math.min(b[0], x - m); b[1] = Math.min(b[1], y - m); b[2] = Math.max(b[2], x + m); b[3] = Math.max(b[3], y + m); }
  };
  for (const pts of fine) for (const [x, y] of pts) add(x, y, 14);
  for (const t of tw) add(t.x, t.y, 12);
  const out: WallChunk[] = [];
  for (const [k, b] of boxes) {
    const [cx, cy] = k.split(',').map(Number);
    const x0 = Math.max(b[0], cx * CH - 14), y0 = Math.max(b[1], cy * CH - 14);
    const x1 = Math.min(b[2], (cx + 1) * CH + 14), y1 = Math.min(b[3], (cy + 1) * CH + 14);
    // 每块只负责本块范围内的像素，避免相邻块重叠绘制两次（重叠处半透明阴影会加深）
    const bx0 = Math.max(x0, cx * CH), by0 = Math.max(y0, cy * CH), bx1 = Math.min(x1, (cx + 1) * CH), by1 = Math.min(y1, (cy + 1) * CH);
    const w = Math.ceil(bx1 - bx0), h = Math.ceil(by1 - by0);
    if (w <= 0 || h <= 0) continue;
    const cv = makeCanvas(w * RES, h * RES);
    const ctx = cv.getContext('2d')!;
    ctx.scale(RES, RES); ctx.translate(-bx0, -by0);
    drawWallBody(ctx);
    const local = tw.filter(t => t.x > bx0 - 12 && t.x < bx1 + 12 && t.y > by0 - 14 && t.y < by1 + 14).sort((a, b) => a.y - b.y);
    for (const t of local) drawTower(ctx, t);
    out.push({ key: `wall_${k}`, x: bx0, y: by0, w, h, canvas: cv });
  }
  return out;
}
export const WALL_RES = RES;
