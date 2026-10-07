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
  0: [52, 98, 122], 1: [172, 178, 108], 2: [190, 186, 118], 3: [92, 126, 70], 4: [164, 150, 100],
  5: [140, 124, 98], 6: [222, 202, 150], 7: [168, 162, 158],
};
const HEIGHT = [0, 0.1, 0.13, 0.12, 0.3, 0.72, 0.12, 0.9];
const RELIEF = [0, 0.012, 0.02, 0.02, 0.1, 0.3, 0.015, 0.18];

function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2) {
  const tmp = new Float32Array(src.length);
  let a = src, b = tmp;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1);
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

export interface MapExtras {
  roads?: P[][];             // 世界坐标折线
  villages?: [number, number][];
  towns?: [number, number][];
  baseOnly?: boolean;   // 只画底图
  noFields?: boolean; noRivers?: boolean; noRoads?: boolean; noWall?: boolean; noVignette?: boolean;
}

export function renderMapCanvas(scale = 0.5, extras: MapExtras = {}): HTMLCanvasElement {
  buildGrid();
  const W = Math.round(WORLD_W * scale), H = Math.round(WORLD_H * scale);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const S = (p: P): [number, number] => { const [x, y] = ll(p[0], p[1]); return [x * scale, y * scale]; };
  const step = 1 / scale;
  // 陆地遮罩
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d')!;
  mctx.fillStyle = '#fff';
  for (const poly of POLYS) { mctx.beginPath(); poly.forEach((p, i) => { const [x, y] = S(p); i ? mctx.lineTo(x, y) : mctx.moveTo(x, y); }); mctx.closePath(); mctx.fill(); }
  const md = mctx.getImageData(0, 0, W, H).data;
  // 低分辨率的海陆距离场（用于海水深浅与海滩）
  const q = 4, QW = Math.ceil(W / q), QH = Math.ceil(H / q);
  const landQ = new Float32Array(QW * QH);
  for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) landQ[y * QW + x] = md[((Math.min(H - 1, y * q) * W) + Math.min(W - 1, x * q)) * 4 + 3] / 255;
  const farQ = boxBlur(new Float32Array(landQ), QW, QH, 7, 3);
  const nearQ = boxBlur(new Float32Array(landQ), QW, QH, 1, 2);
  const sampleQ = (arr: Float32Array, px: number, py: number) => {
    const fx = px / q, fy = py / q; const x0 = Math.min(QW - 2, fx | 0), y0 = Math.min(QH - 2, fy | 0);
    const tx = fx - x0, ty = fy - y0;
    const a = arr[y0 * QW + x0], b = arr[y0 * QW + x0 + 1], c = arr[(y0 + 1) * QW + x0], d = arr[(y0 + 1) * QW + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  // 地形类型、高度
  const tbuf = new Uint8Array(W * H);
  const hbuf = new Float32Array(W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px;
    if (md[i * 4 + 3] < 8) { tbuf[i] = Ter.Sea; hbuf[i] = 0; continue; }
    const x = px * step, y = py * step;
    const jx = x + (fbm(x * 0.05, y * 0.05, 11, 2) - 0.5) * 22, jy = y + (fbm(x * 0.05, y * 0.05, 23, 2) - 0.5) * 22;
    let t = fineAt(jx, jy);
    if (t === Ter.Sea) t = fineAt(x, y);
    if (t === Ter.Sea) t = Ter.Plain;
    tbuf[i] = t;
    const n = fbm(x * 0.045, y * 0.045, 77, 4);
    hbuf[i] = HEIGHT[t] + (n - 0.5) * 2 * RELIEF[t];
  }
  const hs = boxBlur(hbuf, W, H, 3, 2);
  // 地形颜色做轻微模糊，消除交界处的锯齿
  const cR = new Float32Array(W * H), cG = new Float32Array(W * H), cB = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const c = COLORS[tbuf[i]]; cR[i] = c[0]; cG[i] = c[1]; cB[i] = c[2]; }
  const bR = boxBlur(cR, W, H, 2, 2).slice(), bG = boxBlur(cG, W, H, 2, 2).slice(), bB = boxBlur(cB, W, H, 2, 2).slice();
  const img = ctx.createImageData(W, H);
  const D = img.data;
  const sand: [number, number, number] = [214, 198, 150];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, o = i * 4;
    const x = px * step, y = py * step;
    const nfine = fbm(x * 0.06, y * 0.06, 7, 3);
    const a = md[o + 3];
    if (a < 8) {
      // 海：近岸浅、远海深
      const f = sampleQ(farQ, px, py), nr = sampleQ(nearQ, px, py);
      const sh = Math.min(1, f * 2.4);
      const deep = [36, 74, 102], shallow = [92, 150, 160];
      const k = 0.94 + nfine * 0.12;
      let r = (deep[0] + (shallow[0] - deep[0]) * sh) * k, g = (deep[1] + (shallow[1] - deep[1]) * sh) * k, b = (deep[2] + (shallow[2] - deep[2]) * sh) * k;
      // 浪花
      if (nr > 0.08) { const fo = Math.min(1, (nr - 0.08) * 3) * 0.45; r += (235 - r) * fo; g += (240 - g) * fo; b += (230 - b) * fo; }
      // 远洋波纹
      const wv = Math.sin(x * 0.09 + fbm(x * 0.01, y * 0.01, 5, 2) * 20 + y * 0.03);
      if (wv > 0.975 && sh < 0.5) { r += 6; g += 8; b += 8; }
      D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = 255;
      continue;
    }
    const t = tbuf[i];
    const c = [bR[i], bG[i], bB[i]];
    // 光照（西北光）
    const hx = hs[i + (px < W - 1 ? 1 : 0)] - hs[i - (px > 0 ? 1 : 0)];
    const hy = hs[i + (py < H - 1 ? W : 0)] - hs[i - (py > 0 ? W : 0)];
    let light = 1 - (hx + hy) * 13;
    light = Math.max(0.72, Math.min(1.1, light));
    const k = (0.88 + nfine * 0.24) * light;
    let r = c[0] * k, g = c[1] * k, b = c[2] * k;
    // 高山积雪
    if ((t === Ter.Plateau || t === Ter.Mountain) && hs[i] > 0.86) { const sn = Math.min(1, (hs[i] - 0.86) * 9); r += (238 - r) * sn; g += (240 - g) * sn; b += (246 - b) * sn; }
    // 海滩
    const nr = sampleQ(nearQ, px, py);
    if (nr < 0.8 && t !== Ter.Mountain) { const sb = Math.min(1, (0.8 - nr) * 3) * 0.75; r += (sand[0] - r) * sb; g += (sand[1] - g) * sb; b += (sand[2] - b) * sb; }
    D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  if (!extras.baseOnly) drawMapOverlays(ctx, scale, extras, W, H);
  return cv;
}

/** 在底图上绘制矢量叠加层（田地、海岸线、河流、驿道、长城、地名、暗角），可在任意缩放下调用 */
export function drawMapOverlays(ctx: CanvasRenderingContext2D, scale: number, extras: MapExtras, W: number, H: number) {
  // 叠加层按 0.5 倍底图设计；更高分辨率时整体缩放绘制，线条更清晰
  const k = scale / 0.5;
  ctx.save(); ctx.scale(k, k);
  overlays0(ctx, 0.5, extras, W / k, H / k);
  ctx.restore();
}
function overlays0(ctx: CanvasRenderingContext2D, scale: number, extras: MapExtras, W: number, H: number) {
  const S = (p: P): [number, number] => { const [x, y] = ll(p[0], p[1]); return [x * scale, y * scale]; };
  // 田地（村庄周围的拼布农田）
  const fieldCols = ['rgba(200,180,90,0.55)', 'rgba(150,170,80,0.5)', 'rgba(176,150,90,0.5)', 'rgba(120,150,70,0.5)', 'rgba(210,196,120,0.5)'];
  let fs = 1;
  const fr = () => { fs = (fs * 16807) % 2147483647; return fs / 2147483647; };
  for (const [vx, vy] of extras.noFields ? [] : extras.villages ?? []) {
    const n = 7 + Math.floor(fr() * 5);
    for (let k = 0; k < n; k++) {
      const a = fr() * Math.PI * 2, d = 12 + fr() * 26;
      const x = (vx + Math.cos(a) * d) * scale, y = (vy + Math.sin(a) * d * 0.75) * scale;
      const t = fineAt(vx + Math.cos(a) * d, vy + Math.sin(a) * d);
      if (t === Ter.Sea || t === Ter.Mountain || t === Ter.Plateau || t === Ter.Desert) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.3 + fr() * 0.3);
      const w = (6 + fr() * 8) * scale, h = (4 + fr() * 6) * scale;
      ctx.fillStyle = fieldCols[k % fieldCols.length]; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(110,90,50,0.35)'; ctx.lineWidth = 0.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
  // 城郊
  for (const [tx, ty] of extras.towns ?? []) {
    const g = ctx.createRadialGradient(tx * scale, ty * scale, 0, tx * scale, ty * scale, 46 * scale);
    g.addColorStop(0, 'rgba(190,170,120,0.55)'); g.addColorStop(1, 'rgba(190,170,120,0)');
    ctx.fillStyle = g; ctx.fillRect((tx - 46) * scale, (ty - 46) * scale, 92 * scale, 92 * scale);
  }
  // 海岸线
  ctx.strokeStyle = 'rgba(60,50,35,0.5)'; ctx.lineWidth = 1;
  for (const poly of POLYS) {
    ctx.beginPath();
    poly.forEach((p, i) => { const [x, y] = S(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
  }
  // 河流（细分并加入蜿蜒）
  const meander = (line: P[]): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = S(line[i]), [x1, y1] = S(line[i + 1]);
      const segs = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let k = 0; k < segs; k++) {
        const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
        const off = (fbm(x * 0.08, y * 0.08, 91, 2) - 0.5) * 9;
        out.push([x + (nx / nl) * off, y + (ny / nl) * off]);
      }
    }
    out.push(S(line[line.length - 1]));
    return out;
  };
  const river = (line: P[], w: number) => {
    const pts = meander(line);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / pts.length;
      const ww = w * (0.45 + t * 0.75);
      ctx.strokeStyle = 'rgba(52,96,118,0.9)'; ctx.lineWidth = ww + 1.2;
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / pts.length;
      const ww = w * (0.45 + t * 0.75);
      ctx.strokeStyle = 'rgba(96,150,168,0.95)'; ctx.lineWidth = ww * 0.55;
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
  };
  if (!extras.noRivers) { river(YELLOW_RIVER, 3.4); river(YANGTZE, 3.8); river(PEARL, 2.6); river(HAN_RIVER, 2); }
  // 驿道
  for (const road of extras.noRoads ? [] : extras.roads ?? []) {
    if (road.length < 2) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i < road.length - 1; i++) {
      const [x0, y0] = road[i], [x1, y1] = road[i + 1];
      const segs = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14));
      for (let k = 0; k < segs; k++) {
        const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const off = (k === 0 ? 0 : (fbm(x * 0.03, y * 0.03, 55, 2) - 0.5) * 8);
        pts.push([(x + off) * scale, (y - off * 0.6) * scale]);
      }
    }
    pts.push([road[road.length - 1][0] * scale, road[road.length - 1][1] * scale]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(100,74,44,0.6)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.strokeStyle = 'rgba(222,200,150,0.8)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  // 长城
  const wall = (line: P[]) => {
    const pts = line.map(S);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40,25,15,0.45)'; ctx.lineWidth = 4;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x + 0.8, y + 1.2) : ctx.moveTo(x + 0.8, y + 1.2)); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,100,78,1)'; ctx.lineWidth = 3;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    ctx.strokeStyle = 'rgba(214,200,170,1)'; ctx.lineWidth = 1.4; ctx.setLineDash([1.6, 1.4]);
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y - 0.6) : ctx.moveTo(x, y - 0.6)); ctx.stroke();
    ctx.setLineDash([]);
    // 烽火台
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const segs = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 22);
      for (let k = 0; k < segs; k++) {
        const t = k / segs; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        ctx.fillStyle = 'rgba(40,25,15,0.8)'; ctx.fillRect(x - 2, y - 2.6, 4, 3.4);
        ctx.fillStyle = '#d6c8a8'; ctx.fillRect(x - 1.5, y - 2.2, 3, 2.6);
      }
    }
  };
  if (!extras.noWall) { wall(GREAT_WALL); wall(LIAO_WALL); }
  // 地名注记
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = (txt: string, lon: number, lat: number, size: number, spacing = 0, col = 'rgba(70,46,24,0.5)') => {
    const [x, y] = S([lon, lat]);
    ctx.font = `${size}px "STKaiti","KaiTi","Kaiti SC","Noto Serif SC","Songti SC",serif`;
    ctx.fillStyle = 'rgba(255,248,230,0.25)';
    const draw = (dx: number, dy: number, c: string) => {
      ctx.fillStyle = c;
      if (spacing) [...txt].forEach((ch, i) => ctx.fillText(ch, x + dx + (i - (txt.length - 1) / 2) * spacing, y + dy));
      else ctx.fillText(txt, x + dx, y + dy);
    };
    draw(0.8, 0.8, 'rgba(255,248,230,0.3)');
    draw(0, 0, col);
  };
  label('漠 南 蒙 古', 109, 42.2, 24, 28);
  label('辽 东', 123.3, 42.8, 22, 24);
  label('中 原', 114.6, 33.6, 22, 24);
  label('江 南', 118.5, 29.2, 22, 24);
  label('巴 蜀', 104.2, 29.6, 20, 22);
  label('岭 南', 111.5, 24.0, 20, 22);
  label('乌 斯 藏', 98, 31, 20, 22);
  label('东  海', 124.5, 28.5, 28, 32, 'rgba(220,235,240,0.45)');
  label('南  海', 115.5, 19.5, 28, 32, 'rgba(220,235,240,0.45)');
  label('渤海', 120.0, 38.8, 16, 0, 'rgba(220,235,240,0.45)');
  label('黄  海', 123.5, 35.5, 24, 28, 'rgba(220,235,240,0.45)');
  // 暗角
  if (extras.noVignette) return;
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,18,6,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}


// ---------- 装饰物布置 ----------
export interface Deco { f: string; x: number; y: number }
export function computeDecorations(avoid: { x: number; y: number; r: number }[]): Deco[] {
  buildGrid();
  const out: Deco[] = [];
  let s = 12345;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const blocked = (x: number, y: number) => {
    for (const a of avoid) if (Math.abs(a.x - x) < a.r && Math.abs(a.y - y) < a.r * 0.8 && Math.hypot(a.x - x, (a.y - y) * 1.25) < a.r) return true;
    return false;
  };
  const scan = (sx: number, sy: number, fn: (x: number, y: number, t: Ter) => void) => {
    for (let y = sy / 2; y < WORLD_H; y += sy) for (let x = sx / 2 + ((y / sy) % 2) * sx * 0.5; x < WORLD_W; x += sx) {
      const jx = x + (rnd() - 0.5) * sx * 0.9, jy = y + (rnd() - 0.5) * sy * 0.9;
      const t = fineAt(jx, jy);
      if (t === Ter.Sea) continue;
      fn(jx, jy, t);
    }
  };
  // 山
  scan(17, 12, (x, y, t) => {
    if (t !== Ter.Mountain && t !== Ter.Plateau) return;
    if (blocked(x, y)) return;
    const n = fbm(x * 0.02, y * 0.02, 5, 2);
    if (t === Ter.Plateau) { if (rnd() < 0.42) out.push({ f: `snow${Math.floor(rnd() * 4)}`, x, y }); return; }
    if (rnd() < 0.9) out.push({ f: n > 0.58 ? `mtn${4 + Math.floor(rnd() * 2)}` : `mtn${Math.floor(rnd() * 4)}`, x, y });
  });
  // 丘陵
  scan(20, 13, (x, y, t) => {
    if (t !== Ter.Hills || blocked(x, y)) return;
    const r = rnd();
    if (r < 0.62) out.push({ f: `hill${Math.floor(rnd() * 3)}`, x, y });
    else if (r < 0.75) out.push({ f: `tree${Math.floor(rnd() * 4)}`, x, y });
  });
  // 森林
  const [, latN] = toLL(0, 0); void latN;
  scan(7, 6, (x, y, t) => {
    if (t !== Ter.Forest || blocked(x, y)) return;
    if (rnd() < 0.18) return;
    const lat = toLL(x, y)[1];
    const pine = lat > 38 ? 0.8 : lat > 30 ? 0.35 : 0.12;
    out.push({ f: rnd() < pine ? `pine${Math.floor(rnd() * 4)}` : `tree${Math.floor(rnd() * 4)}`, x, y });
  });
  // 平原上的零星树丛、草原的草、荒漠的沙丘
  scan(26, 20, (x, y, t) => {
    if (blocked(x, y)) return;
    const r = rnd();
    if (t === Ter.Plain) {
      if (r < 0.1) { const k = 1 + Math.floor(rnd() * 3); for (let i = 0; i < k; i++) out.push({ f: `tree${Math.floor(rnd() * 4)}`, x: x + (rnd() - 0.5) * 12, y: y + (rnd() - 0.5) * 8 }); }
      else if (r < 0.2) out.push({ f: `tuft${Math.floor(rnd() * 2)}`, x, y });
    } else if (t === Ter.Steppe) {
      if (r < 0.45) out.push({ f: `tuft${Math.floor(rnd() * 2)}`, x, y });
      else if (r < 0.48) out.push({ f: 'rock0', x, y });
    } else if (t === Ter.Desert) {
      if (r < 0.35) out.push({ f: `dune${Math.floor(rnd() * 2)}`, x, y });
      else if (r < 0.4) out.push({ f: 'rock0', x, y });
    }
  });
  out.sort((a, b) => a.y - b.y);
  return out;
}
