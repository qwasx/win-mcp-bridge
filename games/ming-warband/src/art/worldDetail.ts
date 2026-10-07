// 大地图的全分辨率细节层：农田/水田/梯田、地表笔触、河流（河岸、波光、石桥）、驿道、长城与烽火台、农舍草垛
import { fineAt, toLL, ll, Ter, YELLOW_RIVER, YANGTZE, PEARL, HAN_RIVER, GREAT_WALL, LIAO_WALL, WORLD_W, WORLD_H } from '../core/terrain';
import { fbm } from '../core/rng';
import { srand } from './canvas';

type P = [number, number];
type Ctx = CanvasRenderingContext2D;

// ---------- 河流几何（大地图动画也会用到） ----------
export interface RiverLine { pts: P[]; w0: number; w1: number; name: string }
let riverCache: RiverLine[] | null = null;
export function riverLines(): RiverLine[] {
  if (riverCache) return riverCache;
  const mk = (line: [number, number][], w: number, name: string): RiverLine => {
    const out: P[] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = ll(line[i][0], line[i][1]), [x1, y1] = ll(line[i + 1][0], line[i + 1][1]);
      const segs = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 7));
      for (let k = 0; k < segs; k++) {
        const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
        // 与旧版底图一致的蜿蜒（旧版在 0.5 倍下偏移 ±4.5 像素）
        const off = (fbm(x * 0.5 * 0.08, y * 0.5 * 0.08, 91, 2) - 0.5) * 18;
        out.push([x + (nx / nl) * off, y + (ny / nl) * off]);
      }
    }
    const [lx, ly] = ll(line[line.length - 1][0], line[line.length - 1][1]); out.push([lx, ly]);
    return { pts: out, w0: w * 0.9, w1: w * 2.4, name };
  };
  riverCache = [mk(YELLOW_RIVER, 3.4, '黄河'), mk(YANGTZE, 3.8, '长江'), mk(PEARL, 2.6, '珠江'), mk(HAN_RIVER, 2, '汉水')];
  return riverCache;
}
export function riverWidthAt(r: RiverLine, i: number) { return r.w0 + (r.w1 - r.w0) * (i / r.pts.length); }

/** 点到最近河流的距离（粗略，用于架桥/避让） */
function nearRiver(x: number, y: number): { d: number; w: number; dir: number } | null {
  let best: { d: number; w: number; dir: number } | null = null;
  for (const r of riverLines()) {
    const p = r.pts;
    for (let i = 0; i < p.length - 1; i += 1) {
      const dx = p[i][0] - x, dy = p[i][1] - y;
      if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = { d, w: riverWidthAt(r, i), dir: Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]) };
    }
  }
  return best;
}

// ---------- 地表笔触 ----------
export function drawGround(ctx: Ctx) {
  const r = srand(4242);
  const paths: Record<string, Path2D> = {};
  const P2 = (k: string) => (paths[k] ||= new Path2D());
  const step = 10;
  for (let y = 4; y < WORLD_H; y += step) for (let x = 4; x < WORLD_W; x += step) {
    const jx = x + (r() - 0.5) * step, jy = y + (r() - 0.5) * step;
    const t = fineAt(jx, jy);
    if (t === Ter.Plain || t === Ter.Steppe) {
      if (r() < (t === Ter.Steppe ? 0.5 : 0.35)) {
        const dark = fbm(jx * 0.02, jy * 0.02, 3, 2) > 0.5;
        const p = P2(dark ? 'gd' : 'gl');
        const h = 2 + r() * 2;
        p.moveTo(jx - 1.5, jy - h * 0.8); p.lineTo(jx, jy); p.lineTo(jx + 1.6, jy - h);
      }
      if (t === Ter.Steppe && r() < 0.06) { const p = P2('tuft'); p.moveTo(jx + 2, jy); p.arc(jx, jy, 2, 0, Math.PI * 2); }
    } else if (t === Ter.Desert) {
      if (r() < 0.22) { const p = P2('dune'); const w = 6 + r() * 8; p.moveTo(jx - w, jy); p.quadraticCurveTo(jx, jy - 2.5, jx + w, jy); }
      if (r() < 0.03) { const p = P2('pebble'); p.moveTo(jx + 1, jy); p.arc(jx, jy, 1, 0, Math.PI * 2); }
    } else if (t === Ter.Hills) {
      if (r() < 0.12) { const p = P2('gd'); p.moveTo(jx - 1.5, jy - 2); p.lineTo(jx, jy); p.lineTo(jx + 1.5, jy - 2.5); }
    }
  }
  ctx.save();
  ctx.lineCap = 'round';
  const st = (k: string, s: string, w: number) => { if (!paths[k]) return; ctx.strokeStyle = s; ctx.lineWidth = w; ctx.stroke(paths[k]); };
  st('gd', 'rgba(70,92,40,0.32)', 0.8);
  st('gl', 'rgba(230,236,170,0.28)', 0.8);
  if (paths.tuft) { ctx.fillStyle = 'rgba(150,150,70,0.35)'; ctx.fill(paths.tuft); }
  st('dune', 'rgba(150,120,70,0.3)', 1);
  if (paths.pebble) { ctx.fillStyle = 'rgba(110,90,70,0.45)'; ctx.fill(paths.pebble); }
  ctx.restore();
}

// ---------- 农田 ----------
const NORTH: [number, number, number][] = [[214, 192, 112], [198, 172, 96], [146, 164, 84], [156, 126, 84], [182, 166, 112], [170, 182, 96], [222, 204, 128]];
const SOUTH: [number, number, number][] = [[96, 156, 84], [118, 172, 70], [104, 150, 120], [84, 138, 72], [140, 176, 80], [92, 150, 108], [150, 168, 92]];
const okField = (t: Ter) => t === Ter.Plain || t === Ter.Steppe || t === Ter.Hills;

export function drawFields(ctx: Ctx, villages: P[], towns: P[], castles: P[]) {
  const r = srand(777);
  const avoid = [...villages.map(([x, y]) => [x, y, 13]), ...towns.map(([x, y]) => [x, y, 32]), ...castles.map(([x, y]) => [x, y, 20])] as [number, number, number][];
  const blocked = (x: number, y: number) => { for (const [ax, ay, ar] of avoid) if (Math.abs(ax - x) < ar && Math.abs(ay - y) < ar * 0.8) return true; return false; };
  const sites: [number, number, number][] = [...villages.map(([x, y]) => [x, y, 40 + r() * 16] as [number, number, number]), ...towns.map(([x, y]) => [x, y, 78] as [number, number, number])];
  ctx.save();
  for (const [sx, sy, R] of sites) {
    const lat = toLL(sx, sy)[1];
    const south = lat < 32.5;
    const pal = south ? SOUTH : NORTH;
    const ang = (r() - 0.5) * 0.9;
    const cw = south ? 9 + r() * 4 : 11 + r() * 6, chh = south ? 7 + r() * 3 : 8 + r() * 5;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const n = Math.ceil(R / Math.min(cw, chh)) + 1;
    for (let gy = -n; gy <= n; gy++) for (let gx = -n; gx <= n; gx++) {
      const lx = gx * cw + (gy % 2 ? cw * 0.35 : 0), ly = gy * chh;
      const x = sx + lx * ca - ly * sa, y = sy + (lx * sa + ly * ca) * 0.8;
      const d = Math.hypot(x - sx, (y - sy) * 1.2);
      if (d > R * (0.75 + fbm(x * 0.05, y * 0.05, 9, 2) * 0.5)) continue;
      if (r() < 0.12) continue;
      const t = fineAt(x, y);
      if (!okField(t)) continue;
      if (blocked(x, y)) continue;
      const nr = nearRiver(x, y); if (nr && nr.d < nr.w * 0.5 + 4) continue;
      const col = pal[Math.floor(r() * pal.length)];
      const k = 0.92 + r() * 0.12;
      const w = cw * (0.82 + r() * 0.2), hh = chh * (0.8 + r() * 0.2);
      ctx.save(); ctx.translate(x, y); ctx.transform(ca, sa * 0.8, -sa, ca * 0.8, 0, 0);
      if (south && t === Ter.Hills) {
        // 梯田：弧形条带
        ctx.fillStyle = `rgba(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0},0.88)`;
        ctx.fillRect(-w / 2, -hh / 2, w, hh);
        ctx.strokeStyle = 'rgba(240,236,200,0.5)'; ctx.lineWidth = 0.7;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-w / 2, i * hh / 5); ctx.quadraticCurveTo(0, i * hh / 5 - 2, w / 2, i * hh / 5); ctx.stroke(); }
      } else {
        ctx.fillStyle = `rgba(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0},${south ? 0.9 : 0.8})`;
        ctx.fillRect(-w / 2, -hh / 2, w, hh);
        if (south) {
          // 水田反光
          if (r() < 0.45) { ctx.fillStyle = 'rgba(190,225,235,0.3)'; ctx.fillRect(-w / 2 + 1, -hh / 2 + 1, w * 0.4, hh * 0.28); }
          ctx.fillStyle = 'rgba(60,110,50,0.35)';
          for (let yy = -hh / 2 + 1.5; yy < hh / 2; yy += 2) for (let xx = -w / 2 + 1.5; xx < w / 2; xx += 2) ctx.fillRect(xx, yy, 0.7, 0.7);
        } else {
          // 垄沟
          ctx.strokeStyle = 'rgba(90,70,40,0.28)'; ctx.lineWidth = 0.5;
          ctx.beginPath();
          if (r() < 0.5) for (let yy = -hh / 2 + 1.5; yy < hh / 2; yy += 1.8) { ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy); }
          else for (let xx = -w / 2 + 1.5; xx < w / 2; xx += 1.8) { ctx.moveTo(xx, -hh / 2); ctx.lineTo(xx, hh / 2); }
          ctx.stroke();
        }
        ctx.strokeStyle = south ? 'rgba(236,230,190,0.55)' : 'rgba(110,86,50,0.4)'; ctx.lineWidth = 0.7;
        ctx.strokeRect(-w / 2, -hh / 2, w, hh);
      }
      ctx.restore();
      // 田边树、草垛
      if (r() < 0.05) tinyTree(ctx, x + w / 2, y + hh / 3);
      else if (!south && r() < 0.03) haystack(ctx, x, y);
    }
    // 散落的农舍
    const nh = 1 + Math.floor(r() * 3);
    for (let i = 0; i < nh; i++) {
      const a = r() * Math.PI * 2, dd = R * (0.4 + r() * 0.5);
      const x = sx + Math.cos(a) * dd, y = sy + Math.sin(a) * dd * 0.75;
      if (!okField(fineAt(x, y)) || blocked(x, y)) continue;
      farmhouse(ctx, x, y, south, r);
    }
  }
  ctx.restore();
}

function tinyTree(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = 'rgba(30,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 2.6, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a6a34'; ctx.beginPath(); ctx.arc(x, y - 2, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,200,110,0.6)'; ctx.beginPath(); ctx.arc(x - 0.8, y - 2.8, 1, 0, Math.PI * 2); ctx.fill();
}
function haystack(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = 'rgba(40,30,10,0.25)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 0.6, 2.8, 1.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8b860'; ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.quadraticCurveTo(x, y - 5, x + 2.4, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,30,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
}
function farmhouse(ctx: Ctx, x: number, y: number, south: boolean, r: () => number) {
  const w = 6 + r() * 2, h = 3.5;
  ctx.fillStyle = 'rgba(30,20,10,0.3)'; ctx.fillRect(x - w / 2 + 1, y, w + 1, 1.5);
  ctx.fillStyle = south ? '#e8e2d0' : '#c8a878'; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = south ? '#3c4048' : '#b89048';
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 1, y - h); ctx.lineTo(x - w / 2 + 1, y - h - 2.6); ctx.lineTo(x + w / 2 - 1, y - h - 2.6); ctx.lineTo(x + w / 2 + 1, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 0.7, y - 2, 1.4, 2);
}

// ---------- 河流 ----------
export function drawRivers(ctx: Ctx) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const layer = (style: string, wk: number, add: number, dy = 0) => {
    for (const r of riverLines()) {
      const p = r.pts;
      // 分段以实现渐宽
      const N = 6;
      for (let s = 0; s < N; s++) {
        const i0 = Math.floor(p.length * s / N), i1 = Math.min(p.length - 1, Math.floor(p.length * (s + 1) / N) + 1);
        ctx.strokeStyle = style; ctx.lineWidth = riverWidthAt(r, (i0 + i1) / 2) * wk + add;
        ctx.beginPath(); for (let i = i0; i <= i1; i++) i === i0 ? ctx.moveTo(p[i][0], p[i][1] + dy) : ctx.lineTo(p[i][0], p[i][1] + dy); ctx.stroke();
      }
    }
  };
  layer('rgba(200,186,140,0.55)', 1, 6);      // 河滩
  layer('rgba(60,80,60,0.35)', 1, 2.4);       // 岸线
  layer('rgba(58,104,124,1)', 1, 0);          // 水体
  layer('rgba(92,146,164,0.95)', 0.62, 0);    // 中流
  layer('rgba(170,210,215,0.35)', 0.18, 0, -0.6); // 高光
  // 波纹短线
  const rr = srand(31);
  ctx.strokeStyle = 'rgba(220,240,240,0.5)'; ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const r of riverLines()) for (let i = 2; i < r.pts.length - 2; i += 3) {
    if (rr() < 0.5) continue;
    const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
    const a = Math.atan2(y1 - y0, x1 - x0); const w = riverWidthAt(r, i) * 0.3;
    const o = (rr() - 0.5) * w; const nx = -Math.sin(a) * o, ny = Math.cos(a) * o;
    ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x0 + nx + Math.cos(a) * 3, y0 + ny + Math.sin(a) * 3);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- 驿道与石桥 ----------
export function drawRoads(ctx: Ctx, roads: P[][]) {
  const lines: P[][] = roads.filter(r => r.length >= 2).map(road => {
    const pts: P[] = [];
    for (let i = 0; i < road.length - 1; i++) {
      const [x0, y0] = road[i], [x1, y1] = road[i + 1];
      const segs = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10));
      for (let k = 0; k < segs; k++) {
        const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const off = (i === 0 && k === 0) ? 0 : (fbm(x * 0.03, y * 0.03, 55, 2) - 0.5) * 12;
        pts.push([x + off, y - off * 0.6]);
      }
    }
    pts.push(road[road.length - 1]);
    return pts;
  });
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const stroke = (s: string, w: number, dash?: number[]) => {
    ctx.strokeStyle = s; ctx.lineWidth = w; ctx.setLineDash(dash ?? []);
    for (const pts of lines) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  };
  stroke('rgba(90,66,38,0.45)', 4.6);
  stroke('rgba(206,182,132,0.95)', 3);
  stroke('rgba(120,92,56,0.35)', 0.6, [2, 3]);
  ctx.setLineDash([]);
  // 石桥
  const done: P[] = [];
  for (const pts of lines) for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const nr = nearRiver(x, y);
    if (!nr || nr.d > nr.w * 0.5 + 1) continue;
    if (done.some(([bx, by]) => Math.hypot(bx - x, by - y) < 30)) continue;
    done.push([x, y]);
    const a = Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]);
    bridge(ctx, x, y, a, nr.w + 8);
  }
  ctx.restore();
}
function bridge(ctx: Ctx, x: number, y: number, a: number, len: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(20,20,20,0.35)'; ctx.fillRect(-len / 2 + 1, -2.4 + 1.5, len, 5);
  ctx.fillStyle = '#b8b0a0'; ctx.fillRect(-len / 2, -2.6, len, 5.2);
  ctx.strokeStyle = '#5a5248'; ctx.lineWidth = 0.8; ctx.strokeRect(-len / 2, -2.6, len, 5.2);
  ctx.fillStyle = '#d8d2c4'; ctx.fillRect(-len / 2 + 1, -1.2, len - 2, 2.4);
  ctx.fillStyle = '#6a6258';
  for (let k = -len / 2 + 2; k < len / 2 - 1; k += 3) { ctx.fillRect(k, -2.6, 1, 1); ctx.fillRect(k, 1.6, 1, 1); }
  ctx.restore();
}

// ---------- 长城 ----------
export function drawGreatWall(ctx: Ctx) {
  const lines = [GREAT_WALL, LIAO_WALL].map(l => l.map(([lo, la]) => ll(lo, la)));
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 细分并加一点起伏
  const fine = lines.map(pts => {
    const out: P[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const segs = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let k = 0; k < segs; k++) { const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; const o = (fbm(x * 0.04, y * 0.04, 13, 2) - 0.5) * 10; out.push([x, y + o]); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  });
  const path = (dy: number, dx = 0) => { ctx.beginPath(); for (const pts of fine) pts.forEach(([x, y], i) => i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)); };
  ctx.strokeStyle = 'rgba(30,20,10,0.35)'; ctx.lineWidth = 7; path(2.5, 1.5); ctx.stroke();
  ctx.strokeStyle = '#6e604e'; ctx.lineWidth = 6; path(1); ctx.stroke();
  ctx.strokeStyle = '#a89878'; ctx.lineWidth = 4.4; path(0); ctx.stroke();
  ctx.strokeStyle = '#d8ccb0'; ctx.lineWidth = 2.2; path(-0.8); ctx.stroke();
  ctx.strokeStyle = '#7a6a54'; ctx.lineWidth = 1.6; ctx.setLineDash([1.2, 1.6]); path(-2.2); ctx.stroke(); ctx.setLineDash([]);
  // 敌楼/烽火台
  for (const pts of fine) {
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc < 34) continue;
      acc = 0;
      const [x, y] = pts[i];
      ctx.fillStyle = 'rgba(30,20,10,0.4)'; ctx.fillRect(x - 3.5 + 1.5, y - 2 + 2, 8, 4);
      ctx.fillStyle = '#7a6a54'; ctx.fillRect(x - 4, y - 6, 8, 6.5);
      ctx.fillStyle = '#c8bca0'; ctx.fillRect(x - 4, y - 6, 8, 2.4);
      ctx.fillStyle = '#e4dac2'; ctx.fillRect(x - 3.4, y - 6.6, 6.8, 1.2);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 1, y - 3, 2, 2.4);
      ctx.fillStyle = '#7a6a54'; for (let k = -3.4; k < 3.5; k += 2.2) ctx.fillRect(x + k, y - 7.6, 1.2, 1.2);
    }
  }
  ctx.restore();
}
