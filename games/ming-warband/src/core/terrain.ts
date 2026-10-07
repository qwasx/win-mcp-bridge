// 地形生成、渲染与寻路
import { fbm } from './rng';

export const PX_PER_DEG = 100;
export const LON0 = 96, LAT0 = 45.5;
export const WORLD_W = 3200, WORLD_H = 2800;
export const CELL = 16; // 寻路格子
export const GW = Math.ceil(WORLD_W / CELL), GH = Math.ceil(WORLD_H / CELL);

export function ll(lon: number, lat: number): [number, number] { return [(lon - LON0) * PX_PER_DEG, (LAT0 - lat) * PX_PER_DEG]; }
export function toLL(x: number, y: number): [number, number] { return [x / PX_PER_DEG + LON0, LAT0 - y / PX_PER_DEG]; }

export enum Ter { Sea = 0, Plain = 1, Steppe = 2, Forest = 3, Hills = 4, Mountain = 5, Desert = 6, Plateau = 7 }
export const TER_NAME = ['海', '平原', '草原', '森林', '丘陵', '山地', '荒漠', '高原'];
export const TER_SPEED = [0, 1, 1.05, 0.72, 0.8, 0.55, 0.78, 0];

type P = [number, number];
// 大陆海岸线（经纬度）
const MAINLAND: P[] = [
  [95, 46], [129, 46], [129, 42.5], [128, 41], [126.5, 40.3], [125.2, 39.9], [124.3, 39.8], [123.2, 39.6], [122.2, 39.2], [121.2, 38.75],
  [121.4, 39.3], [121.8, 39.8], [122.2, 40.5], [121.4, 40.85], [120.6, 40.4], [119.8, 39.9], [119.0, 39.3], [118.2, 39.05], [117.7, 38.9],
  [117.7, 38.3], [118.6, 37.8], [119.1, 37.2], [119.8, 37.2], [120.4, 37.6], [121.4, 37.6], [122.6, 37.35], [122.0, 36.9], [121.0, 36.6],
  [120.3, 36.05], [119.4, 35.2], [119.3, 34.7], [120.3, 34.3], [120.9, 32.7], [121.9, 31.75], [121.9, 30.95], [121.0, 30.55], [121.6, 30.0],
  [121.9, 29.7], [121.5, 28.7], [120.8, 27.9], [120.2, 27.0], [119.7, 26.1], [119.0, 25.2], [118.4, 24.5], [117.3, 23.7], [116.4, 22.95],
  [115.3, 22.7], [114.2, 22.3], [113.5, 22.15], [112.5, 21.8], [111.4, 21.5], [110.5, 21.2], [110.2, 20.3], [109.9, 20.6], [109.7, 21.5],
  [108.5, 21.6], [107.8, 21.4], [107.0, 20.6], [106.6, 19.6], [105.8, 18.6], [106.4, 17.0], [95, 17.0],
];
const HAINAN: P[] = [[108.6, 19.1], [109.4, 18.25], [110.4, 18.6], [111.0, 19.6], [110.6, 20.1], [109.6, 20.05], [108.7, 19.6]];
const TAIWAN: P[] = [[120.1, 23.0], [120.75, 21.95], [121.45, 23.2], [122.0, 25.0], [121.5, 25.3], [121.0, 25.05], [120.2, 24.0]];
const POLYS: P[][] = [MAINLAND, HAINAN, TAIWAN];

export const YELLOW_RIVER: P[] = [[96.5, 34.8], [99.0, 35.2], [101.5, 35.9], [103.8, 36.1], [105.2, 37.4], [106.3, 38.6], [106.8, 39.6], [107.8, 40.6],
  [109.5, 40.6], [111.0, 40.3], [111.2, 39.2], [110.6, 37.5], [110.4, 35.5], [110.3, 34.6], [111.5, 34.8], [112.6, 34.85], [114.3, 34.95],
  [115.6, 34.6], [117.2, 34.3], [118.4, 33.75], [119.2, 33.6], [119.9, 33.95], [120.25, 34.15]];
export const YANGTZE: P[] = [[97.5, 33.5], [99.0, 31.5], [99.8, 29.0], [100.2, 27.2], [101.2, 26.2], [102.6, 26.4], [103.8, 28.0], [104.6, 28.8],
  [105.8, 29.0], [106.55, 29.56], [107.6, 30.0], [108.5, 30.7], [109.6, 31.0], [110.6, 30.9], [111.3, 30.7], [112.2, 30.3], [113.0, 29.5],
  [114.3, 30.55], [115.2, 29.9], [116.0, 29.75], [117.0, 30.5], [118.0, 31.2], [118.8, 32.1], [119.6, 32.25], [120.6, 31.95], [121.7, 31.5]];
export const PEARL: P[] = [[104.5, 24.6], [106.5, 24.0], [108.3, 23.4], [110.3, 23.45], [111.8, 23.2], [112.9, 23.0], [113.5, 22.5]];
export const HAN_RIVER: P[] = [[106.5, 33.0], [108.0, 32.9], [109.5, 32.7], [111.0, 32.5], [112.14, 32.05], [112.6, 31.0], [113.6, 30.6], [114.3, 30.55]];
export const GREAT_WALL: P[] = [[98.2, 39.8], [100.5, 38.9], [102.6, 37.9], [104.0, 37.4], [106.0, 37.6], [107.6, 37.95], [109.7, 38.3], [111.0, 39.5],
  [112.4, 39.95], [113.3, 40.3], [114.6, 40.75], [115.6, 40.55], [116.5, 40.45], [117.8, 40.3], [119.0, 40.15], [119.75, 40.0]];
export const LIAO_WALL: P[] = [[119.75, 40.0], [120.8, 40.7], [121.8, 41.6], [123.0, 42.1], [123.9, 41.4], [124.3, 40.2]];

function inPoly(lon: number, lat: number, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(px: number, py: number, line: P[]) {
  let best = 1e9;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
    if (d < best) best = d;
  }
  return best;
}

const RIDGES: { line: P[]; w: number; t: Ter }[] = [
  { line: [[112.8, 35.0], [113.8, 36.5], [114.2, 38.0], [114.7, 39.6], [115.6, 40.5]], w: 0.38, t: Ter.Mountain }, // 太行
  { line: [[104.5, 34.1], [106.5, 34.0], [108.5, 33.9], [110.6, 33.8], [112.0, 33.5]], w: 0.42, t: Ter.Mountain }, // 秦岭
  { line: [[105.6, 32.4], [107.5, 32.0], [109.8, 31.6]], w: 0.45, t: Ter.Hills }, // 大巴山
  { line: [[115.6, 40.7], [117.5, 40.6], [119.2, 40.4]], w: 0.35, t: Ter.Hills }, // 燕山
  { line: [[116.3, 25.8], [117.5, 27.0], [118.6, 28.4]], w: 0.55, t: Ter.Hills }, // 武夷
  { line: [[109.5, 25.6], [112.0, 25.4], [115.0, 25.0]], w: 0.5, t: Ter.Hills }, // 南岭
  { line: [[110.8, 36.0], [111.3, 37.5], [111.7, 39.0]], w: 0.3, t: Ter.Hills }, // 吕梁
  { line: [[124.5, 40.8], [126.0, 41.8], [127.5, 43.0]], w: 0.8, t: Ter.Mountain }, // 长白
  { line: [[120.5, 45.5], [119.6, 44.0], [118.8, 42.8]], w: 0.5, t: Ter.Hills }, // 大兴安岭
  { line: [[114.5, 31.6], [116.2, 31.0]], w: 0.35, t: Ter.Hills }, // 大别
  { line: [[103.5, 28.2], [104.3, 31.8], [105.6, 32.4]], w: 0.35, t: Ter.Hills }, // 盆地西北缘
  { line: [[100.0, 37.5], [101.5, 37.6], [103.0, 37.2]], w: 0.45, t: Ter.Mountain }, // 祁连
];

const SEED = 1635;
export function terrainAt(lon: number, lat: number): Ter {
  let land = false;
  for (const p of POLYS) if (inPoly(lon, lat, p)) { land = true; break; }
  if (!land) return Ter.Sea;
  const n = fbm(lon * 0.9, lat * 0.9, SEED);
  const n2 = fbm(lon * 2.3 + 50, lat * 2.3, SEED + 99, 3);
  // 青藏高原（西部边界）
  const wob = (fbm(lat * 0.7, 3.3, SEED + 7, 3) - 0.5) * 3.2;
  if (lon < 99.8 + wob + n * 0.8 && lat < 37.5 - wob * 0.3) return Ter.Plateau;
  if (lon < 103 + wob * 0.7 + (n - 0.5) * 1.5 && lat < 36.5 && lat > 26 + wob * 0.5) {
    if (lon < 101.2 + wob * 0.5) return n2 > 0.35 ? Ter.Mountain : Ter.Hills;
    return n2 > 0.45 ? Ter.Mountain : Ter.Hills;
  }
  for (const r of RIDGES) {
    const d = segDist(lon, lat, r.line);
    if (d < r.w * (0.45 + n2 * 0.9)) return r.t;
  }
  // 四川盆地
  if (Math.hypot((lon - 105.0) / 1.9, (lat - 30.2) / 1.4) < 1) return n2 > 0.72 ? Ter.Hills : Ter.Plain;
  // 北方荒漠与草原
  if (lat > 39.4 + (n - 0.5) && lon < 108.5) return n2 > 0.55 ? Ter.Steppe : Ter.Desert;
  if (lat > 42.6 + (n - 0.5) * 1.5 && lon < 113.5) return n2 > 0.4 ? Ter.Desert : Ter.Steppe;
  if (lat > 40.7 + (n - 0.5) * 0.8 && lon < 121) return n2 > 0.78 ? Ter.Hills : Ter.Steppe;
  // 东北
  if (lon >= 121 && lat > 40.5) {
    if (lon > 124.2 + (n - 0.5) * 2) return n2 > 0.45 ? Ter.Forest : Ter.Hills;
    return n2 > 0.68 ? Ter.Forest : Ter.Plain;
  }
  // 黄土高原
  if (lon > 103.5 && lon < 112 && lat > 34.3 && lat < 39.5) return n2 > 0.56 ? Ter.Hills : Ter.Plain;
  // 云贵高原
  if (lon < 109.5 && lat < 28.6) return n2 > 0.5 ? Ter.Hills : n2 > 0.36 ? Ter.Forest : Ter.Plain;
  // 华北平原
  if (lon > 113.5 && lat > 32 && lat < 40.5) return n2 > 0.8 ? Ter.Forest : Ter.Plain;
  // 江南及岭南
  if (lat < 30.5) {
    if (lon > 119 && lat > 29.6) return n2 > 0.75 ? Ter.Hills : Ter.Plain; // 太湖平原
    if (n2 > 0.62) return Ter.Hills;
    if (n2 > 0.47) return Ter.Forest;
    return Ter.Plain;
  }
  if (n2 > 0.7) return Ter.Forest;
  if (n2 > 0.64) return Ter.Hills;
  return Ter.Plain;
}

// ---------- 网格 ----------
export const FINE = 8;
export const FW = Math.ceil(WORLD_W / FINE), FH = Math.ceil(WORLD_H / FINE);
export const fineGrid = new Uint8Array(FW * FH);
export const grid = new Uint8Array(GW * GH);
let gridReady = false;
export function buildGrid() {
  if (gridReady) return;
  for (let fy = 0; fy < FH; fy++) for (let fx = 0; fx < FW; fx++) {
    const [lon, lat] = toLL(fx * FINE + FINE / 2, fy * FINE + FINE / 2);
    fineGrid[fy * FW + fx] = terrainAt(lon, lat);
  }
  const r = CELL / FINE;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    // 粗格：取四个细格中的最常见可通行类型（海洋需全部为海才算海）
    let sea = 0, best = Ter.Sea, slow = 99;
    for (let oy = 0; oy < r; oy++) for (let ox = 0; ox < r; ox++) {
      const fx = gx * r + ox, fy = gy * r + oy;
      const t = fx < FW && fy < FH ? fineGrid[fy * FW + fx] : Ter.Sea;
      if (t === Ter.Sea) sea++;
      else if (t === Ter.Plateau) { if (best === Ter.Sea) best = t; }
      else if (TER_SPEED[t] < slow || best === Ter.Sea || best === Ter.Plateau) { slow = TER_SPEED[t]; best = t; }
    }
    grid[gy * GW + gx] = sea >= r * r - 1 ? Ter.Sea : best;
  }
  gridReady = true;
}
export function fineAt(x: number, y: number): Ter {
  const fx = Math.floor(x / FINE), fy = Math.floor(y / FINE);
  if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) return Ter.Sea;
  return fineGrid[fy * FW + fx] as Ter;
}
export function terAtXY(x: number, y: number): Ter {
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return Ter.Sea;
  return grid[gy * GW + gx] as Ter;
}
export function passable(x: number, y: number) { return TER_SPEED[terAtXY(x, y)] > 0; }
export function nearestPassable(x: number, y: number): [number, number] {
  if (passable(x, y)) return [x, y];
  for (let r = CELL; r < 600; r += CELL / 2) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos((a / 16) * Math.PI * 2) * r, py = y + Math.sin((a / 16) * Math.PI * 2) * r;
      if (passable(px, py)) return [px, py];
    }
  }
  return [x, y];
}

// ---------- A* 寻路 ----------
const gScore = new Float32Array(GW * GH);
const came = new Int32Array(GW * GH);
const closed = new Uint8Array(GW * GH);
const stamp = new Uint32Array(GW * GH);
let curStamp = 1;

class Heap {
  a: number[] = []; f: number[] = [];
  push(i: number, f: number) {
    this.a.push(i); this.f.push(f);
    let k = this.a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.f[p] <= this.f[k]) break;
      [this.a[p], this.a[k]] = [this.a[k], this.a[p]]; [this.f[p], this.f[k]] = [this.f[k], this.f[p]]; k = p;
    }
  }
  pop(): number {
    const top = this.a[0];
    const la = this.a.pop()!, lf = this.f.pop()!;
    if (this.a.length) {
      this.a[0] = la; this.f[0] = lf;
      let k = 0; const n = this.a.length;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < n && this.f[l] < this.f[m]) m = l;
        if (r < n && this.f[r] < this.f[m]) m = r;
        if (m === k) break;
        [this.a[m], this.a[k]] = [this.a[k], this.a[m]]; [this.f[m], this.f[k]] = [this.f[k], this.f[m]]; k = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function losClear(x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / (CELL / 2));
  let startSpeed = TER_SPEED[terAtXY(x0, y0)];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const s = TER_SPEED[terAtXY(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)];
    if (s <= 0) return false;
    if (s < 0.7 && startSpeed >= 0.7) return false; // 避免抄近路翻山
    startSpeed = Math.min(startSpeed, s);
  }
  return true;
}

export function findPath(sx: number, sy: number, tx: number, ty: number): P[] | null {
  [tx, ty] = nearestPassable(tx, ty);
  if (losClear(sx, sy, tx, ty) && Math.hypot(tx - sx, ty - sy) < 140) return [[tx, ty]];
  const sgx = Math.floor(sx / CELL), sgy = Math.floor(sy / CELL);
  const tgx = Math.floor(tx / CELL), tgy = Math.floor(ty / CELL);
  if (tgx < 0 || tgy < 0 || tgx >= GW || tgy >= GH) return null;
  curStamp++;
  const start = sgy * GW + sgx, goal = tgy * GW + tgx;
  const heap = new Heap();
  stamp[start] = curStamp; gScore[start] = 0; came[start] = -1; closed[start] = 0;
  heap.push(start, 0);
  let found = false, iter = 0;
  while (heap.size && iter++ < 60000) {
    const cur = heap.pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur] && stamp[cur] === curStamp) continue;
    closed[cur] = 1;
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      const sp = TER_SPEED[grid[ni]];
      if (sp <= 0) continue;
      if (dx && dy && (TER_SPEED[grid[cy * GW + nx]] <= 0 || TER_SPEED[grid[ny * GW + cx]] <= 0)) continue;
      const cost = (dx && dy ? 1.4142 : 1) / sp;
      const ng = gScore[cur] + cost;
      if (stamp[ni] !== curStamp) { stamp[ni] = curStamp; closed[ni] = 0; gScore[ni] = Infinity; }
      if (ng < gScore[ni]) {
        gScore[ni] = ng; came[ni] = cur;
        const h = Math.hypot(nx - tgx, ny - tgy) / 1.05;
        heap.push(ni, ng + h);
      }
    }
  }
  if (!found) return null;
  const cells: P[] = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) cells.push([(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2]);
  cells.reverse();
  cells[cells.length - 1] = [tx, ty];
  // 平滑路径
  const out: P[] = [];
  let ax = sx, ay = sy, i = 0;
  while (i < cells.length) {
    let j = Math.min(cells.length - 1, i + 24);
    while (j > i && !losClear(ax, ay, cells[j][0], cells[j][1])) j--;
    out.push(cells[j]);
    [ax, ay] = cells[j];
    i = j + 1;
  }
  return out;
}

// ---------- 地图渲染 ----------
const COLORS: Record<number, [number, number, number]> = {
  0: [92, 140, 150], 1: [190, 186, 122], 2: [200, 194, 130], 3: [112, 140, 86], 4: [170, 152, 104],
  5: [138, 120, 90], 6: [216, 198, 146], 7: [176, 168, 156],
};

export function renderMapCanvas(scale = 0.5): HTMLCanvasElement {
  buildGrid();
  const W = Math.round(WORLD_W * scale), H = Math.round(WORLD_H * scale);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const S0 = (p: P): [number, number] => { const [x, y] = ll(p[0], p[1]); return [x * scale, y * scale]; };
  // 陆地遮罩
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d')!;
  mctx.fillStyle = '#fff';
  for (const poly of POLYS) { mctx.beginPath(); poly.forEach((p, i) => { const [x, y] = S0(p); i ? mctx.lineTo(x, y) : mctx.moveTo(x, y); }); mctx.closePath(); mctx.fill(); }
  const md = mctx.getImageData(0, 0, W, H).data;
  const seaImg = ctx.createImageData(W, H);
  const land = document.createElement('canvas'); land.width = W; land.height = H;
  const lctx = land.getContext('2d')!;
  const landImg = lctx.createImageData(W, H);
  const step = 1 / scale;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = px * step, y = py * step;
      const i = (py * W + px) * 4;
      const n = fbm(x * 0.06, y * 0.06, 7, 3);
      const sc = COLORS[0];
      const sk = 0.95 + n * 0.1;
      seaImg.data[i] = sc[0] * sk * 0.9 + 23; seaImg.data[i + 1] = sc[1] * sk * 0.9 + 22; seaImg.data[i + 2] = sc[2] * sk * 0.9 + 18; seaImg.data[i + 3] = 255;
      const a = md[i + 3];
      if (a < 8) continue;
      const jx = x + (fbm(x * 0.05, y * 0.05, 11, 2) - 0.5) * 22, jy = y + (fbm(x * 0.05, y * 0.05, 23, 2) - 0.5) * 22;
      let t = fineAt(jx, jy);
      if (t === Ter.Sea) t = fineAt(x, y);
      if (t === Ter.Sea) t = Ter.Plain;
      const c = COLORS[t];
      const k = 0.86 + n * 0.28;
      landImg.data[i] = c[0] * k * 0.9 + 23.6; landImg.data[i + 1] = c[1] * k * 0.9 + 22.2; landImg.data[i + 2] = c[2] * k * 0.9 + 18.6; landImg.data[i + 3] = a;
    }
  }
  ctx.putImageData(seaImg, 0, 0);
  // 近岸浅水
  for (const [w, al] of [[26, 0.08], [16, 0.1], [8, 0.12]] as [number, number][]) {
    ctx.strokeStyle = `rgba(200,225,220,${al})`; ctx.lineWidth = w; ctx.lineJoin = 'round';
    for (const poly of POLYS) { ctx.beginPath(); poly.forEach((p, i) => { const [x, y] = S0(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
  }
  lctx.putImageData(landImg, 0, 0);
  ctx.drawImage(land, 0, 0);
  const S = (p: P): [number, number] => { const [x, y] = ll(p[0], p[1]); return [x * scale, y * scale]; };
  // 海岸线
  ctx.strokeStyle = 'rgba(60,50,35,0.55)'; ctx.lineWidth = 1.4;
  for (const poly of POLYS) {
    ctx.beginPath();
    poly.forEach((p, i) => { const [x, y] = S(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
  }
  // 山与林的符号
  const sym = (cx: number, cy: number, t: Ter, n: number) => {
    if (t === Ter.Mountain || t === Ter.Plateau) {
      const s = 7 + n * 5;
      ctx.fillStyle = t === Ter.Plateau ? 'rgba(235,232,225,0.55)' : 'rgba(90,72,50,0.35)';
      ctx.strokeStyle = 'rgba(60,45,30,0.6)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(cx - s, cy + s * 0.5); ctx.lineTo(cx, cy - s * 0.7); ctx.lineTo(cx + s, cy + s * 0.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (t === Ter.Hills) {
      ctx.strokeStyle = 'rgba(80,60,40,0.45)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(cx, cy + 3, 5 + n * 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (t === Ter.Forest) {
      ctx.fillStyle = 'rgba(50,80,40,0.45)';
      ctx.beginPath(); ctx.arc(cx, cy, 2.6 + n * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 0.5, cy + 2, 1, 3);
    } else if (t === Ter.Desert) {
      ctx.fillStyle = 'rgba(150,120,70,0.35)';
      ctx.fillRect(cx, cy, 1.5, 1.5);
    } else if (t === Ter.Steppe) {
      ctx.strokeStyle = 'rgba(110,120,60,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 2, cy); ctx.lineTo(cx - 1, cy - 3); ctx.moveTo(cx + 1, cy); ctx.lineTo(cx + 2, cy - 3); ctx.stroke();
    }
  };
  for (let y = 6; y < H; y += 11) for (let x = 6; x < W; x += 13) {
    const jx = x + ((y * 7) % 5) - 2, jy = y + ((x * 3) % 5) - 2;
    const t = fineAt(jx * step, jy * step);
    const n = fbm(jx * 0.3, jy * 0.3, 3, 2);
    if (t === Ter.Mountain || t === Ter.Plateau) { if ((x + y) % 2 === 0 || n > 0.5) sym(jx, jy, t, n); }
    else if (t === Ter.Forest || t === Ter.Hills) sym(jx, jy, t, n);
    else if ((t === Ter.Desert || t === Ter.Steppe) && n > 0.45) sym(jx, jy, t, n);
  }
  // 河流
  const river = (line: P[], w: number) => {
    ctx.strokeStyle = 'rgba(70,120,140,0.85)'; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); line.forEach((p, i) => { const [x, y] = S(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  };
  river(YELLOW_RIVER, 3); river(YANGTZE, 3.2); river(PEARL, 2.2); river(HAN_RIVER, 1.8);
  // 长城
  const wall = (line: P[]) => {
    ctx.strokeStyle = 'rgba(90,50,30,0.9)'; ctx.lineWidth = 2.2; ctx.setLineDash([]);
    ctx.beginPath(); line.forEach((p, i) => { const [x, y] = S(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,210,170,0.9)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); line.forEach((p, i) => { const [x, y] = S(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.setLineDash([]);
  };
  wall(GREAT_WALL); wall(LIAO_WALL);
  // 地名注记
  ctx.fillStyle = 'rgba(70,50,30,0.45)'; ctx.textAlign = 'center';
  const label = (txt: string, lon: number, lat: number, size: number, spacing = 0) => {
    const [x, y] = S([lon, lat]);
    ctx.font = `${size}px "STKaiti","KaiTi","Noto Serif SC","Songti SC",serif`;
    if (spacing) { [...txt].forEach((ch, i) => ctx.fillText(ch, x + (i - (txt.length - 1) / 2) * spacing, y)); }
    else ctx.fillText(txt, x, y);
  };
  label('漠 南 蒙 古', 109, 42.2, 22, 26);
  label('辽 东', 123.3, 42.8, 20, 22);
  label('中 原', 114.6, 33.6, 20, 22);
  label('江 南', 118.5, 29.2, 20, 22);
  label('巴 蜀', 104.2, 29.6, 18, 20);
  label('岭 南', 111.5, 24.0, 18, 20);
  label('乌 斯 藏', 98, 31, 18, 20);
  ctx.fillStyle = 'rgba(30,60,80,0.4)';
  label('东  海', 124.5, 28.5, 26, 30);
  label('南  海', 115.5, 19.5, 26, 30);
  label('渤海', 120.0, 38.8, 16, 0);
  label('黄  海', 123.5, 35.5, 22, 26);
  return cv;
}
