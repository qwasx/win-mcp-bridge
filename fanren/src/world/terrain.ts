// 人界地形：宏观栅格 + 分块水墨渲染
import { fbm, hash2, valueNoise, mulberry32, clamp } from '../core/rng';
import {
  MACRO_W, MACRO_H, WORLD_SCALE, MAINLAND, LAKES, RANGES, RIVERS, ARID_ZONES, COLD_ZONES, FOREST_ZONES,
  LOCATIONS, ISLAND_FIELD, pointInPoly, P,
} from '../data/world';
import type { MtnSpec, MtnStyle } from '../gfx/mountain';
import { pickSpecies, Species, TREE_SIZE } from '../gfx/tree';
import { layoutLocation, LOC_SCALE } from '../gfx/building';

export const CHUNK = 1024;          // 每块世界像素
export const CHUNK_RES = 384;       // 每块纹理分辨率（含笔触细节）
const PIX_RES = 192;                // 底色像素分辨率（柔和水彩，之后放大）
const CELL = 256;                   // 装饰物摆放网格

export interface Sample { land: number; elev: number; arid: number; cold: number; forest: number; depth: number }

export interface ImgDeco { kind: 'img'; img: HTMLCanvasElement; x: number; y: number; w: number; h: number; flip: boolean; alpha: number }
export interface TreeDeco { kind: 'tree'; sp: Species; v: number; x: number; y: number; w: number; h: number; s: number; flip: boolean; ph: number; lod: number }
export interface MtnDeco { kind: 'mtn'; id: string; spec: MtnSpec; x: number; y: number; w: number; h: number; flip: boolean }
export type Deco = ImgDeco | TreeDeco | MtnDeco;
export const TREE_VARIANTS = 24;
const DEMON_SECTS = ['tianmo', 'guiling', 'yuling', 'tiansha', 'yinluo', 'hehuan', 'qianhuan'];

export interface Chunk { cx: number; cy: number; canvas: HTMLCanvasElement; used: number }

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / k;
      s += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / k;
      s += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Catmull-Rom 平滑 + 噪声扰动，让河流自然弯曲
function smoothLine(pts: P[], seed: number, jitter: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(4, Math.ceil(len / 1.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      const n = (valueNoise(x * 0.15, y * 0.15, seed) - 0.5) * jitter;
      out.push([x + n, y - n * 0.6]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export class Terrain {
  W = MACRO_W; H = MACRO_H;
  land!: Float32Array; elev!: Float32Array; arid!: Float32Array; cold!: Float32Array; forest!: Float32Array; depth!: Float32Array;
  islands: { x: number; y: number; r: number }[] = [];
  rivers: { pts: P[]; w: number }[] = [];
  chunks = new Map<string, Chunk>();
  decoCache = new Map<string, { d: Deco[]; used: number }>();
  riverMask!: Uint8Array;
  locZones: { x: number; y: number; rx: number; ry: number; id: string }[] = [];
  waveGlyph?: HTMLCanvasElement;
  grassGlyph?: HTMLCanvasElement;
  rockGlyphs: HTMLCanvasElement[] = [];
  reedGlyph?: HTMLCanvasElement;
  shrubGlyph?: HTMLCanvasElement; yurtGlyph?: HTMLCanvasElement;
  roads: { pts: P[]; major: boolean }[] = [];
  roadMask!: Uint8Array;
  frame = 0;

  constructor() { /* */ }

  build() {
    const W = this.W, H = this.H, N = W * H;
    // ---------- 1. 陆地掩码（用 Canvas 栅格化多边形） ----------
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.beginPath(); MAINLAND.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.fillStyle = '#000';
    for (const l of LAKES) { g.beginPath(); g.arc(l.c[0], l.c[1], l.r, 0, Math.PI * 2); g.fill(); }
    // 岛屿
    const rnd = mulberry32(20261014);
    this.islands = [];
    for (const loc of LOCATIONS) if (loc.island) this.islands.push({ x: loc.x, y: loc.y, r: loc.island });
    const F = ISLAND_FIELD;
    let tries = 0;
    while (this.islands.length < F.count + 14 && tries++ < 4000) {
      const x = F.x0 + rnd() * (F.x1 - F.x0), y = F.y0 + rnd() * (F.y1 - F.y0);
      if (pointInPoly(x, y, MAINLAND)) continue;
      const r = 1.5 + Math.pow(rnd(), 2.2) * 6.5;
      if (this.islands.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 3)) continue;
      this.islands.push({ x, y, r });
    }
    // 无边海与北海也零星点缀
    for (let i = 0; i < 26; i++) {
      const x = 575 + rnd() * 80, y = 280 + rnd() * 400;
      if (!pointInPoly(x, y, MAINLAND)) this.islands.push({ x, y, r: 1.2 + rnd() * 2.5 });
    }
    for (let i = 0; i < 18; i++) {
      const x = 800 + rnd() * 190, y = 30 + rnd() * 240;
      if (!pointInPoly(x, y, MAINLAND)) this.islands.push({ x, y, r: 1.5 + rnd() * 4 });
    }
    g.fillStyle = '#fff';
    for (const is of this.islands) { g.beginPath(); g.arc(is.x, is.y, is.r, 0, Math.PI * 2); g.fill(); }
    const raw = g.getImageData(0, 0, W, H).data;
    const land0 = new Float32Array(N);
    for (let i = 0; i < N; i++) land0[i] = raw[i * 4] / 255;

    // ---------- 2. 噪声扰动海岸线 ----------
    const land = new Float32Array(N);
    const samp = (x: number, y: number) => {
      x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * W + xi;
      const a = land0[i], b = land0[i + 1], c = land0[i + W], d = land0[i + W + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = (fbm(x * 0.022, y * 0.022, 3, 11) - 0.5) * 16;
      const wy = (fbm(x * 0.022, y * 0.022, 3, 29) - 0.5) * 16;
      let v = samp(x + wx, y + wy);
      v += (valueNoise(x * 0.18, y * 0.18, 5) - 0.5) * 0.25;
      land[y * W + x] = clamp(v, 0, 1);
    }
    this.land = land;
    this.depth = boxBlur(boxBlur(land, W, H, 5), W, H, 5);

    // ---------- 3. 山脉高度 ----------
    // 海岛高度：Canvas 径向渐变栅格化
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const is of this.islands) {
      const rg = g.createRadialGradient(is.x, is.y, 0, is.x, is.y, is.r);
      const peak = is.r > 7 ? 0.6 : 0.38;
      rg.addColorStop(0, `rgba(255,255,255,${peak})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(is.x, is.y, is.r, 0, Math.PI * 2); g.fill();
    }
    const isleRaw = g.getImageData(0, 0, W, H).data;
    const rangeBoxes = RANGES.map((r) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of r.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const m = r.w * 1.4;
      return [x0 - m, y0 - m, x1 + m, y1 + m];
    });
    const elev = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (land[i] < 0.3) continue;
      let ridge = 0;
      for (let ri = 0; ri < RANGES.length; ri++) {
        const bb = rangeBoxes[ri];
        if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
        const r = RANGES[ri];
        let d = 1e9;
        for (let k = 0; k < r.pts.length - 1; k++) {
          const [ax, ay] = r.pts[k], [bx, by] = r.pts[k + 1];
          d = Math.min(d, segDist(x, y, ax, ay, bx, by));
        }
        if (d > r.w * 1.3) continue;
        const half = r.w * (0.7 + 0.6 * valueNoise(x * 0.05, y * 0.05, 3));
        if (d < half) ridge = Math.max(ridge, r.h * Math.pow(1 - d / half, 1.3));
      }
      const n = fbm(x * 0.04, y * 0.04, 3, 7);
      const hills = Math.max(0, n - 0.55) * 1.1;
      const isle = isleRaw[i * 4] / 255;
      elev[i] = clamp(ridge * (0.65 + 0.7 * n) + hills + isle, 0, 1.2) * clamp((land[i] - 0.3) * 3, 0, 1);
    }
    this.elev = elev;

    // ---------- 4. 气候区域 ----------
    const zone = (zones: { pts: P[]; v: number }[], blur: number) => {
      const a = new Float32Array(N);
      for (const z of zones) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [x, y] of z.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        for (let y = Math.max(0, y0 | 0); y < Math.min(H, y1 + 1); y++)
          for (let x = Math.max(0, x0 | 0); x < Math.min(W, x1 + 1); x++)
            if (pointInPoly(x, y, z.pts)) a[y * W + x] = Math.max(a[y * W + x], z.v);
      }
      return boxBlur(boxBlur(a, W, H, blur), W, H, blur);
    };
    this.arid = zone(ARID_ZONES, 12);
    this.cold = zone(COLD_ZONES, 14);
    const forestBase = zone(FOREST_ZONES, 14);
    const forest = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      forest[i] = clamp(forestBase[i] * (0.4 + 1.0 * fbm(x * 0.035, y * 0.035, 3, 41)) - this.arid[i] * 0.6, 0, 1);
    }
    this.forest = forest;

    // ---------- 5. 河流 ----------
    this.rivers = RIVERS.map((r, i) => ({ pts: smoothLine(r.pts, 100 + i, 3.2), w: r.w }));

    // ---------- 6. 道路（连接相邻城镇宗门的官道/小径）----------
    this.buildRoads(g);

    // ---------- 7. 河流栅格（近水判定：柳树、芦苇、鱼跃）----------
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rv of this.rivers) { g.lineWidth = rv.w * 0.8 + 3; g.beginPath(); rv.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    const rr = g.getImageData(0, 0, W, H).data;
    this.riverMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) this.riverMask[i] = rr[i * 4] > 60 ? 1 : 0;
    // ---------- 8. 地点占地（装饰物避让）----------
    this.locZones = LOCATIONS.map((l) => {
      const L = layoutLocation(l);
      return { x: l.x * WORLD_SCALE, y: l.y * WORLD_SCALE, rx: L.gw * LOC_SCALE * 0.42, ry: L.gh * LOC_SCALE * 0.42, id: l.id };
    });
    // ---------- 9. 预制装饰图 ----------
    this.makeGlyphs();
  }

  private buildRoads(g: CanvasRenderingContext2D) {
    const W = this.W, H = this.H;
    const nodes = LOCATIONS.filter((l) => l.type !== 'isle' && !l.island && pointInPoly(l.x, l.y, MAINLAND));
    const pairs = new Set<string>();
    this.roads = [];
    for (const a of nodes) {
      const near = nodes.filter((b) => b !== a && (a.minor || !b.minor)).map((b) => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .filter((o) => o.d < (a.minor ? 40 : 95)).sort((u, v) => u.d - v.d).slice(0, a.minor ? (a.type === 'town' ? 2 : 1) : 3);
      for (const { b, d } of near) {
        const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        if (pairs.has(key)) continue;
        // 中点需在陆地上
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (this.land[(my | 0) * W + (mx | 0)] < 0.6) continue;
        pairs.add(key);
        const h = hash2(a.x + b.x, a.y + b.y, 61) - 0.5;
        const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
        const mid: P = [mx + nx * h * d * 0.25, my + ny * h * d * 0.25];
        const pts = smoothLine([[a.x, a.y], mid, [b.x, b.y]], 300 + pairs.size, 2.2);
        const major = (a.type === 'city' || a.major) && (b.type === 'city' || b.major);
        this.roads.push({ pts, major });
      }
    }
    // 道路栅格（用于加速步行）
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of this.roads) { g.beginPath(); r.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    const raw = g.getImageData(0, 0, W, H).data;
    this.roadMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) this.roadMask[i] = raw[i * 4] > 60 ? 1 : 0;
  }

  onRoad(wx: number, wy: number) {
    const x = (wx / WORLD_SCALE) | 0, y = (wy / WORLD_SCALE) | 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
    return this.roadMask[y * this.W + x] === 1;
  }

  private makeGlyphs() {
    // 水波纹
    const w = document.createElement('canvas'); w.width = 160; w.height = 60;
    const wg = w.getContext('2d')!;
    wg.strokeStyle = 'rgba(70,100,110,0.45)'; wg.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      wg.lineWidth = 2.2 - k * 0.5;
      wg.beginPath();
      const oy = 18 + k * 13, ox = k * 14;
      wg.moveTo(10 + ox, oy);
      wg.bezierCurveTo(35 + ox, oy - 12, 55 + ox, oy - 12, 70 + ox, oy);
      wg.bezierCurveTo(85 + ox, oy + 9, 105 + ox, oy + 9, 125 + ox, oy - 2);
      wg.stroke();
    }
    this.waveGlyph = w;
    // 草叶（草原）
    const gr = document.createElement('canvas'); gr.width = 90; gr.height = 50;
    const gg = gr.getContext('2d')!;
    gg.strokeStyle = 'rgba(110,105,60,0.55)'; gg.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      gg.lineWidth = 1.6;
      const x = 10 + k * 8 + Math.sin(k) * 3;
      gg.beginPath(); gg.moveTo(x, 48); gg.quadraticCurveTo(x + 4, 30, x + 10 - (k % 3) * 6, 8 + (k % 4) * 6); gg.stroke();
    }
    this.grassGlyph = gr;
    // 山石（几块圆润巨石，墨线勾勒 + 皴擦）
    const rr = mulberry32(777);
    for (let v = 0; v < 3; v++) {
      const c = document.createElement('canvas'); c.width = 160; c.height = 110;
      const q = c.getContext('2d')!;
      const stones = v === 0 ? [[80, 100, 52, 46]] : v === 1 ? [[62, 100, 44, 40], [112, 102, 30, 24]] : [[50, 102, 30, 26], [92, 100, 46, 44], [132, 104, 20, 14]];
      for (const [cx0, by, rw, rh] of stones) {
        const pts: P[] = [];
        const N = 14;
        for (let k = 0; k <= N; k++) {
          const t = Math.PI + (k / N) * Math.PI;
          const j = 0.82 + rr() * 0.3;
          pts.push([cx0 + Math.cos(t) * rw * j, by + Math.sin(t) * rh * j * (k === 0 || k === N ? 0 : 1)]);
        }
        const path = new Path2D();
        path.moveTo(pts[0][0], by);
        for (let k = 1; k < pts.length; k++) {
          const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
          path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        }
        path.lineTo(pts[N][0], by); path.closePath();
        const grd = q.createLinearGradient(cx0 - rw * 0.4, by - rh, cx0 + rw * 0.3, by);
        grd.addColorStop(0, 'rgba(206,204,190,0.98)'); grd.addColorStop(0.55, 'rgba(150,152,138,0.98)'); grd.addColorStop(1, 'rgba(96,100,90,0.98)');
        q.fillStyle = grd; q.fill(path);
        q.save(); q.clip(path);
        q.strokeStyle = 'rgba(50,52,44,0.45)'; q.lineWidth = 1.6; q.lineCap = 'round';
        for (let k = 0; k < 5; k++) {
          const x = cx0 + (rr() - 0.3) * rw, y = by - rh * (0.2 + rr() * 0.6);
          q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 4, y + 7, x + 1 + rr() * 8, y + 14 + rr() * 8); q.stroke();
        }
        q.fillStyle = 'rgba(60,62,54,0.18)'; q.fillRect(cx0 + rw * 0.1, by - rh, rw, rh);
        q.restore();
        q.strokeStyle = 'rgba(34,36,30,0.9)'; q.lineWidth = 2.4; q.lineJoin = 'round'; q.stroke(path);
        q.fillStyle = 'rgba(40,64,44,0.75)';
        for (let k = 0; k < 4; k++) { q.beginPath(); q.ellipse(cx0 + (rr() - 0.5) * rw * 1.1, by - rh * (0.75 + rr() * 0.2), 2.6, 1.8, 0, 0, Math.PI * 2); q.fill(); }
      }
      q.strokeStyle = 'rgba(70,100,62,0.6)'; q.lineWidth = 1.5; q.lineCap = 'round';
      for (let k = 0; k < 12; k++) { const x = 14 + rr() * 132; q.beginPath(); q.moveTo(x, 106); q.quadraticCurveTo(x + 1, 98, x + (rr() - 0.5) * 8, 92 - rr() * 6); q.stroke(); }
      this.rockGlyphs.push(c);
    }
    // 枯枝灌木（荒漠）
    {
      const c = document.createElement('canvas'); c.width = 110; c.height = 90;
      const q = c.getContext('2d')!; q.lineCap = 'round'; q.strokeStyle = 'rgba(60,46,32,0.85)';
      const br = (x: number, y: number, a: number, len: number, w: number, d: number) => {
        if (d > 4 || len < 4) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.lineTo(x2, y2); q.stroke();
        br(x2, y2, a - 0.45 - rr() * 0.3, len * 0.68, w * 0.65, d + 1);
        br(x2, y2, a + 0.4 + rr() * 0.3, len * 0.64, w * 0.65, d + 1);
      };
      br(55, 88, -Math.PI / 2 - 0.15, 26, 3.4, 0); br(55, 88, -Math.PI / 2 + 0.6, 18, 2.4, 1); br(55, 88, -Math.PI / 2 - 0.8, 16, 2.2, 1);
      q.fillStyle = 'rgba(120,96,60,0.35)'; q.beginPath(); q.ellipse(55, 88, 30, 4, 0, 0, Math.PI * 2); q.fill();
      this.shrubGlyph = c;
    }
    // 毡帐（草原部落）
    {
      const c = document.createElement('canvas'); c.width = 120; c.height = 96;
      const q = c.getContext('2d')!;
      q.fillStyle = 'rgba(60,50,30,0.25)'; q.beginPath(); q.ellipse(60, 88, 52, 8, 0, 0, Math.PI * 2); q.fill();
      const body = new Path2D(); body.moveTo(14, 86); body.lineTo(16, 52); body.lineTo(104, 52); body.lineTo(106, 86); body.closePath();
      q.fillStyle = '#efe9da'; q.fill(body);
      const dome = new Path2D(); dome.moveTo(10, 54); dome.quadraticCurveTo(60, 2, 110, 54); dome.closePath();
      q.fillStyle = '#e6dfcc'; q.fill(dome);
      q.fillStyle = 'rgba(120,110,90,0.25)'; q.fillRect(64, 52, 42, 34);
      q.strokeStyle = 'rgba(40,36,28,0.9)'; q.lineWidth = 2.4; q.lineJoin = 'round'; q.stroke(body); q.stroke(dome);
      q.fillStyle = '#a8352a'; q.fillRect(15, 56, 90, 5);
      q.fillStyle = '#3a2e22'; q.fillRect(50, 64, 18, 22);
      q.strokeStyle = 'rgba(40,36,28,0.6)'; q.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) { q.beginPath(); q.moveTo(60, 14); q.lineTo(18 + k * 21, 52); q.stroke(); }
      q.fillStyle = '#5a4630'; q.beginPath(); q.ellipse(60, 16, 6, 3, 0, 0, Math.PI * 2); q.fill();
      this.yurtGlyph = c;
    }
    // 芦苇（水边）
    const rd = document.createElement('canvas'); rd.width = 80; rd.height = 90;
    const rq = rd.getContext('2d')!; rq.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const x = 10 + k * 7 + Math.sin(k * 2.3) * 3, top = 14 + (k % 3) * 12;
      rq.strokeStyle = 'rgba(70,80,55,0.75)'; rq.lineWidth = 1.5;
      rq.beginPath(); rq.moveTo(x, 88); rq.quadraticCurveTo(x + 3, 50, x + 6 - (k % 2) * 10, top); rq.stroke();
      if (k % 2 === 0) { rq.fillStyle = 'rgba(120,96,60,0.8)'; rq.beginPath(); rq.ellipse(x + 6 - (k % 2) * 10, top + 4, 2.4, 8, 0.2, 0, Math.PI * 2); rq.fill(); }
    }
    this.reedGlyph = rd;
  }

  // 宏观坐标采样（双线性）
  private bil(a: Float32Array, x: number, y: number) {
    const W = this.W;
    x = clamp(x, 0, this.W - 1.001); y = clamp(y, 0, this.H - 1.001);
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * W + xi;
    const p = a[i], q = a[i + 1], r = a[i + W], s = a[i + W + 1];
    return p + (q - p) * fx + (r - p) * fy + (p - q - r + s) * fx * fy;
  }

  sample(wx: number, wy: number): Sample {
    const x = wx / WORLD_SCALE, y = wy / WORLD_SCALE;
    return {
      land: this.bil(this.land, x, y), elev: this.bil(this.elev, x, y), arid: this.bil(this.arid, x, y),
      cold: this.bil(this.cold, x, y), forest: this.bil(this.forest, x, y), depth: this.bil(this.depth, x, y),
    };
  }

  isLand(wx: number, wy: number) {
    const x = wx / WORLD_SCALE, y = wy / WORLD_SCALE;
    const l = this.bil(this.land, x, y) + (valueNoise(wx / 140, wy / 140, 9) - 0.5) * 0.12;
    return l > 0.5;
  }

  // 徒步速度倍率（0 表示不可通行）
  walkFactor(wx: number, wy: number) {
    if (!this.isLand(wx, wy)) return 0;
    const s = this.sample(wx, wy);
    let f = 1;
    if (s.elev > 0.55) f *= 0.6; else if (s.elev > 0.35) f *= 0.8;
    if (s.forest > 0.6) f *= 0.88;
    if (s.cold > 0.6) f *= 0.85;
    if (this.onRoad(wx, wy)) f = Math.max(f, 1) * 1.25;
    return f;
  }

  // ---------- 颜色 ----------
  private colorAt(wx: number, wy: number, out: number[]) {
    const x = wx / WORLD_SCALE, y = wy / WORLD_SCALE;
    const land = this.bil(this.land, x, y);
    const n1 = fbm(wx / 1400, wy / 1400, 3, 3);
    const n2 = valueNoise(wx / 150, wy / 150, 9);
    const L = land + (n2 - 0.5) * 0.12;
    let r: number, g: number, b: number;
    if (L < 0.5) {
      const dep = this.bil(this.depth, x, y);
      const t = clamp(dep * 1.6, 0, 1);       // 越近岸越浅
      r = 112 + 74 * t; g = 146 + 58 * t; b = 152 + 42 * t;
      const m = 0.95 + 0.09 * n1;
      r *= m; g *= m; b *= m;
      if (L > 0.44) { const k = (L - 0.44) / 0.06; r += (222 - r) * k * 0.55; g += (226 - g) * k * 0.55; b += (214 - b) * k * 0.55; }
    } else {
      const elev = this.bil(this.elev, x, y), arid = this.bil(this.arid, x, y), cold = this.bil(this.cold, x, y), forest = this.bil(this.forest, x, y);
      // 基础：宣纸色平原
      r = 226; g = 217; b = 184;
      // 湿润绿意
      const green = clamp((1 - arid) * (0.35 + 0.45 * n1), 0, 1);
      r += (198 - r) * green; g += (206 - g) * green; b += (162 - b) * green;
      // 森林
      const f = clamp(forest * 1.2, 0, 1);
      r += (160 - r) * f; g += (178 - g) * f; b += (138 - b) * f;
      // 干旱/草原/荒漠
      const a = clamp(arid, 0, 1);
      const desert = clamp((arid - 0.74) / 0.18, 0, 1);
      const steppe = a * (1 - desert);
      r += (206 - r) * steppe; g += (204 - g) * steppe; b += (140 - b) * steppe;
      r += (234 - r) * desert; g += (208 - g) * desert; b += (152 - b) * desert;
      // 山地
      const e = clamp((elev - 0.2) * 1.4, 0, 1);
      r += (168 - r) * e; g += (172 - g) * e; b += (154 - b) * e;
      // 冰雪
      const c = clamp(cold * (0.7 + elev * 0.6), 0, 1);
      r += (243 - r) * c; g += (242 - g) * c; b += (238 - b) * c;
      // 水彩斑驳
      const m = 0.93 + 0.11 * n1 + (n2 - 0.5) * 0.04;
      r *= m; g *= m; b *= m;
      // 山体明暗（光自西北来）：随高度起伏的整体光影
      const ex = this.bil(this.elev, x + 0.9, y) - this.bil(this.elev, x - 0.9, y);
      const ey = this.bil(this.elev, x, y + 0.9) - this.bil(this.elev, x, y - 0.9);
      const sh = clamp((ex * 0.8 + ey) * 3.2, -0.3, 0.26);
      if (sh > 0) { r += (250 - r) * sh * 0.55; g += (246 - g) * sh * 0.55; b += (228 - b) * sh * 0.5; }
      else { const k2 = -sh; r *= 1 - k2 * 0.55; g *= 1 - k2 * 0.5; b *= 1 - k2 * 0.38; }
      // 高处略带青灰（远山感）
      const hi = clamp((elev - 0.55) * 1.2, 0, 0.35);
      r += (150 - r) * hi * 0.4; g += (160 - g) * hi * 0.4; b += (160 - b) * hi * 0.4;
      // 海岸墨线
      if (L < 0.535) { const k = 1 - (L - 0.5) / 0.035; r += (96 - r) * k * 0.7; g += (104 - g) * k * 0.7; b += (92 - b) * k * 0.7; }
    }
    out[0] = r; out[1] = g; out[2] = b;
  }

  getChunk(cx: number, cy: number, allowBuild: boolean): Chunk | null {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) { c.used = this.frame; return c; }
    if (!allowBuild) return null;
    c = this.buildChunk(cx, cy);
    this.chunks.set(key, c);
    if (this.chunks.size > 130) this.evict();
    return c;
  }

  private evict() {
    const arr = [...this.chunks.values()].sort((a, b) => a.used - b.used);
    for (let i = 0; i < 40; i++) this.chunks.delete(arr[i].cx + ',' + arr[i].cy);
  }

  private buildChunk(cx: number, cy: number): Chunk {
    const R = CHUNK_RES, PR = PIX_RES, sc = CHUNK / PR;
    const ox = cx * CHUNK, oy = cy * CHUNK;
    // 底色（低分辨率水彩）
    const base = document.createElement('canvas'); base.width = base.height = PR;
    const bg = base.getContext('2d')!;
    const img = bg.createImageData(PR, PR);
    const d = img.data, col = [0, 0, 0];
    for (let j = 0; j < PR; j++) for (let i = 0; i < PR; i++) {
      this.colorAt(ox + (i + 0.5) * sc, oy + (j + 0.5) * sc, col);
      const k = (j * PR + i) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
    bg.putImageData(img, 0, 0);
    const cv = document.createElement('canvas'); cv.width = cv.height = R;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(base, 0, 0, R, R);
    g.save();
    g.scale(R / CHUNK, R / CHUNK); g.translate(-ox, -oy);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const rnd = mulberry32(((cx * 73856093) ^ (cy * 19349663)) >>> 0);
    let landish = false;
    for (let k = 0; k < 9 && !landish; k++) landish = this.sample(ox + (k % 3 + 0.5) * CHUNK / 3, oy + ((k / 3 | 0) + 0.5) * CHUNK / 3).land > 0.4;

    if (landish) {
      // 1. 水墨晕染（全局网格，跨块连续，避免接缝）
      const BC = 640;
      const bx0 = Math.floor((ox - 700) / BC), bx1 = Math.floor((ox + CHUNK + 700) / BC);
      const by0 = Math.floor((oy - 700) / BC), by1 = Math.floor((oy + CHUNK + 700) / BC);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        const x = (bx + hash2(bx, by, 81)) * BC, y = (by + hash2(bx, by, 82)) * BC;
        const r = 220 + hash2(bx, by, 83) * 420;
        if (x + r < ox || x - r > ox + CHUNK || y + r < oy || y - r > oy + CHUNK) continue;
        const sm = this.sample(x, y);
        if (sm.land < 0.55) continue;
        const a = 0.05 + hash2(bx, by, 84) * 0.07;
        const c = sm.cold > 0.5 ? '120,135,150' : sm.arid > 0.78 ? '170,130,70' : sm.arid > 0.45 ? '110,120,60' : sm.elev > 0.4 ? '80,86,76' : '60,96,62';
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `rgba(${c},${a})`); rg.addColorStop(0.6, `rgba(${c},${a * 0.6})`); rg.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // 2. 田畴
      this.drawFields(g, ox, oy);
    }
    // 3. 河流
    for (const rv of this.rivers) {
      const pts = rv.pts.map(([x, y]) => [x * WORLD_SCALE, y * WORLD_SCALE]);
      if (!pts.some(([x, y]) => x > ox - 2000 && x < ox + CHUNK + 2000 && y > oy - 2000 && y < oy + CHUNK + 2000)) continue;
      const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
      path(); g.strokeStyle = 'rgba(92,110,104,0.55)'; g.lineWidth = 70 * rv.w + 26; g.stroke();
      path(); g.strokeStyle = 'rgba(150,178,180,0.95)'; g.lineWidth = 70 * rv.w; g.stroke();
      path(); g.strokeStyle = 'rgba(190,210,206,0.6)'; g.lineWidth = 20 * rv.w; g.stroke();
      // 水纹
      g.strokeStyle = 'rgba(240,248,245,0.5)'; g.lineWidth = 3;
      for (let k = 0; k < pts.length - 1; k += 3) {
        const [x, y] = pts[k];
        if (x < ox - 100 || x > ox + CHUNK + 100 || y < oy - 100 || y > oy + CHUNK + 100) continue;
        const h = hash2(x, y, 3);
        if (h > 0.5) continue;
        const off = (h - 0.25) * 70 * rv.w;
        g.beginPath(); g.moveTo(x - 20, y + off); g.quadraticCurveTo(x, y + off - 6, x + 22, y + off); g.stroke();
      }
    }
    // 4. 道路
    for (const rd of this.roads) {
      const pts = rd.pts;
      let hit = false;
      for (let k = 0; k < pts.length; k += 4) { const x = pts[k][0] * WORLD_SCALE, y = pts[k][1] * WORLD_SCALE; if (x > ox - 800 && x < ox + CHUNK + 800 && y > oy - 800 && y < oy + CHUNK + 800) { hit = true; break; } }
      if (!hit) continue;
      const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * WORLD_SCALE, y * WORLD_SCALE) : g.moveTo(x * WORLD_SCALE, y * WORLD_SCALE))); };
      const w = rd.major ? 34 : 22;
      path(); g.strokeStyle = 'rgba(105,90,62,0.32)'; g.lineWidth = w + 12; g.stroke();
      path(); g.strokeStyle = 'rgba(214,198,158,0.92)'; g.lineWidth = w; g.stroke();
      g.setLineDash([18, 40]); path(); g.strokeStyle = 'rgba(150,128,90,0.35)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    }
    if (landish) {
      // 5. 草叶、苔点、碎石（批量路径）
      const grass = new Path2D(), dry = new Path2D(), moss = new Path2D(), pebble = new Path2D();
      const dune = new Path2D(), drift = new Path2D();
      const flowers: [number, number, number][] = [];
      for (let i = 0; i < 230; i++) {
        const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
        const sm = this.sample(x, y);
        if (sm.land < 0.62) continue;
        if (this.onRoad(x, y)) continue;
        const n = 3 + (rnd() * 3 | 0), hgt = 14 + rnd() * 14;
        if (sm.cold > 0.6) {
          const q = rnd();
          if (q < 0.18) { pebble.moveTo(x + 6, y); pebble.ellipse(x, y, 6 + rnd() * 5, 3 + rnd() * 2, 0, 0, Math.PI * 2); }
          else if (q < 0.5) { const L = 40 + rnd() * 90; drift.moveTo(x, y); drift.quadraticCurveTo(x + L / 2, y - 6 - rnd() * 8, x + L, y + rnd() * 4); }
          continue;
        }
        if (sm.arid > 0.8) {
          // 沙丘纹
          if (i % 3 === 0) {
            const L = 120 + rnd() * 220, b = 14 + rnd() * 18;
            dune.moveTo(x, y); dune.bezierCurveTo(x + L * 0.3, y - b, x + L * 0.7, y - b, x + L, y + rnd() * 10);
            dune.moveTo(x + L * 0.2, y + 12); dune.quadraticCurveTo(x + L * 0.5, y - b * 0.4, x + L * 0.8, y + 14);
          } else if (rnd() < 0.25) {
            for (let k = 0; k < 3; k++) { const bx = x + k * 4; dry.moveTo(bx, y); dry.lineTo(bx + (k - 1) * 5, y - 10 - rnd() * 6); }
          }
          continue;
        }
        const path = sm.arid > 0.45 ? dry : grass;
        const reps = sm.arid > 0.45 ? 2 : 1; // 草原更茂密
        for (let rep = 0; rep < reps; rep++) {
          const xx = x + rep * 60 * (rnd() - 0.5), yy = y + rep * 40 * (rnd() - 0.5);
          for (let k = 0; k < n; k++) {
            const bx = xx + k * 5 - n * 2.5;
            path.moveTo(bx, yy); path.quadraticCurveTo(bx + 2, yy - hgt * 0.6, bx + (k - n / 2) * 4, yy - hgt - rnd() * 6);
          }
        }
        if (rnd() < (sm.arid > 0.45 ? 0.22 : 0.08)) flowers.push([x + 20, y - 4, rnd()]);
      }
      for (let i = 0; i < 60; i++) {
        const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
        const sm = this.sample(x, y);
        if (sm.land < 0.62 || (sm.forest < 0.25 && sm.elev < 0.3) || sm.arid > 0.6 || sm.cold > 0.6) continue;
        const m = 3 + (rnd() * 4 | 0);
        for (let k = 0; k < m; k++) {
          const px = x + (rnd() - 0.5) * 40, py = y + (rnd() - 0.5) * 22, r = 2.5 + rnd() * 4;
          moss.moveTo(px + r, py); moss.ellipse(px, py, r, r * 0.7, rnd(), 0, Math.PI * 2);
        }
      }
      for (let i = 0; i < 26; i++) {
        const x = ox + rnd() * CHUNK, y = oy + rnd() * CHUNK;
        const sm = this.sample(x, y);
        if (sm.land < 0.62 || sm.elev < 0.25) continue;
        const r = 5 + rnd() * 9;
        pebble.moveTo(x + r, y); pebble.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
      }
      g.lineWidth = 3; g.strokeStyle = 'rgba(150,115,60,0.32)'; g.stroke(dune);
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(120,140,165,0.35)'; g.stroke(drift);
      // 野花
      const FC = ['200,70,60', '230,190,70', '245,240,230', '170,110,180'];
      for (const [x, y, h] of flowers) {
        g.fillStyle = `rgba(${FC[(h * 4) | 0]},0.8)`;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.7 + h * 9) * 9, y + Math.sin(k * 2.3 + h * 7) * 5, 2.6, 0, Math.PI * 2); g.fill(); }
      }
      g.lineWidth = 2.2; g.strokeStyle = 'rgba(58,88,52,0.38)'; g.stroke(grass);
      g.strokeStyle = 'rgba(130,110,60,0.45)'; g.stroke(dry);
      g.fillStyle = 'rgba(36,58,42,0.5)'; g.fill(moss);
      g.fillStyle = 'rgba(140,140,128,0.55)'; g.fill(pebble);
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(50,50,44,0.55)'; g.stroke(pebble);
    }
    g.restore();
    return { cx, cy, canvas: cv, used: this.frame };
  }

  // 城镇周边的田畴
  private drawFields(g: CanvasRenderingContext2D, ox: number, oy: number) {
    const PAL = ['196,202,136', '172,192,118', '214,198,128', '152,184,118', '204,210,160'];
    for (const l of LOCATIONS) {
      if (l.type !== 'city' && l.type !== 'town') continue;
      const lx = l.x * WORLD_SCALE, ly = l.y * WORLD_SCALE;
      const RR = l.type === 'city' ? 2700 : 1800;
      if (lx + RR < ox || lx - RR > ox + CHUNK || ly + RR < oy || ly - RR > oy + CHUNK) continue;
      const ang = (hash2(l.x, l.y, 77) - 0.5) * 0.7;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const cw = 300, chh = 210;
      const n = Math.ceil(RR / chh);
      g.save(); g.translate(lx, ly); g.rotate(ang);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const fx = i * cw + (j % 2 ? cw * 0.4 : 0), fy = j * chh;
        const cxm = fx + cw / 2, cym = fy + chh / 2;
        const dd = Math.hypot(cxm, cym * 1.2);
        const h = hash2(i + l.x * 7, j + l.y * 13, 5);
        if (dd > RR * (0.55 + 0.45 * h) || dd < 620) continue;
        const wx = lx + cxm * ca - cym * sa, wy = ly + cxm * sa + cym * ca;
        if (wx < ox - 400 || wx > ox + CHUNK + 400 || wy < oy - 400 || wy > oy + CHUNK + 400) continue;
        const sm = this.sample(wx, wy);
        if (sm.land < 0.62 || sm.elev > 0.3 || sm.cold > 0.6 || sm.arid > 0.75) continue;
        if (h < 0.12) continue; // 留白
        const c = PAL[(h * 97 | 0) % PAL.length];
        const a = 0.42 + h * 0.2;
        g.fillStyle = `rgba(${c},${a})`;
        const x0 = fx + 7, y0 = fy + 7, w = cw - 14, hh = chh - 14;
        g.fillRect(x0, y0, w, hh);
        g.strokeStyle = 'rgba(110,100,70,0.22)'; g.lineWidth = 2;
        g.beginPath();
        if (h > 0.55) for (let t = 18; t < w; t += 22) { g.moveTo(x0 + t, y0 + 4); g.lineTo(x0 + t, y0 + hh - 4); }
        else for (let t = 16; t < hh; t += 20) { g.moveTo(x0 + 4, y0 + t); g.lineTo(x0 + w - 4, y0 + t); }
        g.stroke();
        g.strokeStyle = 'rgba(96,110,70,0.35)'; g.lineWidth = 3; g.strokeRect(x0, y0, w, hh);
      }
      g.restore();
    }
  }

  nearRiver(wx: number, wy: number) {
    const x = (wx / WORLD_SCALE) | 0, y = (wy / WORLD_SCALE) | 0;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
    return this.riverMask[y * this.W + x] === 1;
  }
  inLocZone(wx: number, wy: number, pad = 0) {
    for (const z of this.locZones) {
      const dx = (wx - z.x) / (z.rx + pad), dy = (wy - z.y) / (z.ry + pad);
      if (dx * dx + dy * dy < 1) return z;
    }
    return null;
  }
  demonNear(wx: number, wy: number) {
    for (const z of this.locZones) if (DEMON_SECTS.includes(z.id) && Math.hypot(wx - z.x, wy - z.y) < 5200) return true;
    return false;
  }

  /** 装饰物（独立于底图缓存，可预取更大范围，避免高山突然出现） */
  getDecos(cx: number, cy: number): Deco[] {
    const key = cx + ',' + cy;
    let e = this.decoCache.get(key);
    if (!e) {
      e = { d: this.buildDecos(cx, cy), used: this.frame };
      this.decoCache.set(key, e);
      if (this.decoCache.size > 260) {
        const arr = [...this.decoCache.entries()].sort((a, b) => a[1].used - b[1].used);
        for (let i = 0; i < 60; i++) this.decoCache.delete(arr[i][0]);
      }
    }
    e.used = this.frame;
    return e.d;
  }

  private mountainStyle(wx: number, wy: number, s: Sample, h: number): MtnStyle {
    const mx = wx / WORLD_SCALE, my = wy / WORLD_SCALE;
    if (s.cold > 0.42 || (s.elev > 1.15 && s.cold > 0.2)) return 'snow';
    if (this.demonNear(wx, wy) && h < 0.75) return 'demon';
    if (s.arid > 0.75) return 'desert';
    if (s.arid > 0.45) return h < 0.7 ? 'qianjiang' : 'hill';
    const island = !pointInPoly(mx, my, MAINLAND);
    if (island) return 'island';
    if (my > 540 && mx > 430 && h < 0.4) return 'karst';
    if (my > 440 && my < 540 && mx < 340 && h < 0.3) return 'karst';
    return h < 0.72 ? 'qinglv' : 'qianjiang';
  }

  private buildDecos(cx: number, cy: number): Deco[] {
    const out: Deco[] = [];
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const inChunk = (x: number, y: number) => x >= ox && x < ox + CHUNK && y >= oy && y < oy + CHUNK;
    // ---------- 1. 山（粗网格，高处更密更高）----------
    const MC = 460;
    for (let gy = Math.floor(oy / MC); gy <= Math.floor((oy + CHUNK) / MC); gy++) for (let gx = Math.floor(ox / MC); gx <= Math.floor((ox + CHUNK) / MC); gx++) {
      for (let k = 0; k < 2; k++) {
        const h1 = hash2(gx, gy, 101 + k * 10), h2 = hash2(gx, gy, 102 + k * 10), h3 = hash2(gx, gy, 103 + k * 10), h4 = hash2(gx, gy, 104 + k * 10), h5 = hash2(gx, gy, 105 + k * 10);
        const wx = (gx + h1) * MC, wy = (gy + h2) * MC;
        if (!inChunk(wx, wy)) continue;
        const s = this.sample(wx, wy);
        if (s.land < 0.55 || !this.isLand(wx, wy + 40)) continue;
        if (this.inLocZone(wx, wy, 260) || this.onRoad(wx, wy)) continue;
        const e = s.elev;
        if (k === 1 && e < 0.75) continue; // 高山区第二座（叠峦）
        let w = 0, hh = 0, style: MtnStyle;
        if (e > 0.42) {
          const p = clamp((e - 0.42) * 2.4, 0, 0.97);
          if (h3 > p) continue;
          style = this.mountainStyle(wx, wy, s, h4);
          w = (560 + (e - 0.42) * 2000 * (0.6 + h4 * 0.7)) * (k ? 0.75 : 1);
          w = Math.min(w, 2300);
          hh = w * (0.42 + Math.min(1, e) * 0.32) * (0.8 + h5 * 0.45);
          if (style === 'karst') hh *= 1.15;
          if (style === 'desert') hh *= 0.6;
          if (style === 'hill') hh *= 0.5;
        } else if (e > 0.24) {
          if (h3 > 0.32) continue;
          style = s.arid > 0.75 ? 'desert' : this.mountainStyle(wx, wy, s, h4) === 'island' ? 'island' : s.cold > 0.42 ? 'snow' : 'hill';
          w = 360 + h4 * 380; hh = w * (0.32 + h5 * 0.15);
        } else continue;
        const id = `m${gx}_${gy}_${k}`;
        const big = w > 1100;
        const spec: MtnSpec = {
          seed: (gx * 92821 + gy * 68917 + k * 7) >>> 0, style, w, h: hh,
          cliff: h5 < 0.35 && style !== 'hill', waterfall: e > 0.62 && s.arid < 0.5 && s.cold < 0.5 && h1 < 0.3 && style !== 'desert' && style !== 'demon',
          path: h2 < 0.08 && style !== 'snow', snowcap: e > 0.9 && style !== 'snow' && style !== 'desert' && style !== 'hill' && s.arid < 0.6, pavilion: h2 < 0.05, clouds: big && h4 < 0.6, layers: big ? 3 : w > 600 ? 2 : 1,
        };
        out.push({ kind: 'mtn', id, spec, x: wx, y: wy + 30, w, h: hh, flip: h5 < 0.5 });
      }
    }
    // ---------- 2. 树林（成片的林子，大小不一）----------
    const GC = 640;
    for (let gy = Math.floor((oy - 700) / GC); gy <= Math.floor((oy + CHUNK + 700) / GC); gy++) for (let gx = Math.floor((ox - 700) / GC); gx <= Math.floor((ox + CHUNK + 700) / GC); gx++) {
      const h1 = hash2(gx, gy, 201), h2 = hash2(gx, gy, 202), h3 = hash2(gx, gy, 203), h4 = hash2(gx, gy, 204);
      const gcx = (gx + h1) * GC, gcy = (gy + h2) * GC;
      const s = this.sample(gcx, gcy);
      if (s.land < 0.5) continue;
      const nearW = this.nearRiver(gcx, gcy) || s.land < 0.66;
      let dens = s.forest * 1.15 + 0.14;
      if (s.arid > 0.8) dens = 0.06; else if (s.arid > 0.45) dens = 0.1 + s.forest * 0.3;
      if (s.cold > 0.62) dens = 0.12 + s.forest * 0.5;
      if (nearW) dens += 0.25;
      if (s.elev > 0.6) dens *= 0.35;
      dens *= 0.42;                                   // 第三步：野外树木大幅减少，留出开阔田野
      if (this.inLocZone(gcx, gcy, 900)) dens *= 0.3; // 城镇宗门周边空旷
      if (h3 > dens) continue;
      const island = !pointInPoly(gcx / WORLD_SCALE, gcy / WORLD_SCALE, MAINLAND);
      const zone = this.inLocZone(gcx, gcy, 2600)?.id === 'huangfeng' ? 'ymaple' : undefined;
      const R = (90 + h4 * 230 + s.forest * 180) * (s.arid > 0.6 ? 0.5 : 1);
      const sp1 = pickSpecies(h4, { ...s, nearWater: nearW, island, zone });
      const sp2 = pickSpecies(hash2(gx, gy, 205), { ...s, nearWater: nearW, island, zone });
      const spacing = s.forest > 0.5 ? 74 : 100;
      const n = Math.min(42, Math.max(1, Math.round((Math.PI * R * R) / (spacing * spacing) * (0.45 + s.forest * 0.6))));
      const rnd = mulberry32((gx * 73856093) ^ (gy * 19349663) ^ 0x7777);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
        const x = gcx + Math.cos(a) * rr, y = gcy + Math.sin(a) * rr * 0.75;
        const hv = rnd(), hs = rnd(), hf = rnd(), hp = rnd(), hsp = rnd();
        if (!inChunk(x, y)) continue;
        if (!this.isLand(x, y)) continue;
        if (this.onRoad(x, y) || this.inLocZone(x, y, 260)) continue;
        const ss = this.sample(x, y);
        if (ss.elev > 0.62 && hsp < 0.8) continue;
        let sp: Species = hsp < 0.72 ? sp1 : sp2;
        if (sp === 'willow' && !(this.nearRiver(x, y) || ss.land < 0.66)) sp = s.cold > 0.4 ? 'pine' : 'broad';
        // 边缘的树小一点，林心大
        const sc = (0.78 + hs * 0.4) * (1.1 - (rr / R) * 0.25);
        const base = TREE_SIZE[sp] * sc;
        out.push({ kind: 'tree', sp, v: Math.floor(hv * TREE_VARIANTS), x, y, w: base * 1.2, h: base * 1.35, s: sc, flip: hf < 0.5, ph: hp * Math.PI * 2, lod: i % 3 });
      }
    }
    // ---------- 3. 小装饰（芦苇、浪花、草丛、山石、灌木、毡帐）----------
    const n = CHUNK / CELL;
    for (let gy = 0; gy < Math.ceil(n); gy++) for (let gx = 0; gx < Math.ceil(n); gx++) {
      const X = Math.floor(ox / CELL) + gx, Y = Math.floor(oy / CELL) + gy;
      const h1 = hash2(X, Y, 1), h2 = hash2(X, Y, 2), h3 = hash2(X, Y, 3), h4 = hash2(X, Y, 4), h5 = hash2(X, Y, 5);
      const wx = X * CELL + h1 * CELL, wy = Y * CELL + h2 * CELL;
      if (!inChunk(wx, wy)) continue;
      const s = this.sample(wx, wy);
      const onLand = this.isLand(wx, wy);
      if (!onLand) {
        if (s.land < 0.3 && h3 < 0.06 && this.waveGlyph) out.push({ kind: 'img', img: this.waveGlyph, x: wx, y: wy, w: 150, h: 56, flip: h4 < 0.5, alpha: 0.7 });
        else if (s.land > 0.36 && s.land < 0.5 && h3 < 0.35 && this.reedGlyph && s.cold < 0.5) out.push({ kind: 'img', img: this.reedGlyph, x: wx, y: wy, w: 62, h: 70, flip: h4 < 0.5, alpha: 0.9 });
        continue;
      }
      if (this.inLocZone(wx, wy, 40) || this.onRoad(wx, wy)) continue;
      const rock = this.rockGlyphs.length ? this.rockGlyphs[(h5 * 3) | 0] : null;
      if (this.nearRiver(wx, wy) && this.reedGlyph && h3 < 0.3 && s.cold < 0.5) out.push({ kind: 'img', img: this.reedGlyph, x: wx, y: wy, w: 62, h: 70, flip: h4 < 0.5, alpha: 0.9 });
      else if (s.elev > 0.3) { if (rock && h3 < 0.18) { const k = 0.7 + h4 * 0.6; out.push({ kind: 'img', img: rock, x: wx, y: wy, w: 120 * k, h: 86 * k, flip: h4 < 0.5, alpha: 1 }); } }
      else if (s.arid > 0.8) {
        if (this.shrubGlyph && h3 < 0.14) out.push({ kind: 'img', img: this.shrubGlyph, x: wx, y: wy, w: 80 + h4 * 40, h: (80 + h4 * 40) * 0.82, flip: h4 < 0.5, alpha: 0.95 });
        else if (h3 > 0.93 && rock) out.push({ kind: 'img', img: rock, x: wx, y: wy, w: 110, h: 76, flip: h4 < 0.5, alpha: 1 });
      } else if (s.arid > 0.45) {
        if (this.grassGlyph && h3 < 0.2) out.push({ kind: 'img', img: this.grassGlyph, x: wx, y: wy, w: 80 + h4 * 40, h: 44 + h4 * 22, flip: h4 < 0.5, alpha: 0.6 + h4 * 0.3 });
        else if (h3 > 0.95 && rock) out.push({ kind: 'img', img: rock, x: wx, y: wy, w: 100, h: 69, flip: h4 < 0.5, alpha: 1 });
      } else if (h3 > 0.965 && rock) out.push({ kind: 'img', img: rock, x: wx, y: wy, w: 90, h: 62, flip: h4 < 0.5, alpha: 1 });
    }
    return out;
  }

  // ---------- 全图（世界地图界面用） ----------
  buildOverview(scale = 1): HTMLCanvasElement {
    const W = this.W * scale, H = this.H * scale;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(W, H);
    const col = [0, 0, 0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      this.colorAt(((x + 0.5) / scale) * WORLD_SCALE, ((y + 0.5) / scale) * WORLD_SCALE, col);
      const k = (y * W + x) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.save(); g.scale(scale, scale);
    // 河流
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rv of this.rivers) {
      g.beginPath(); rv.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = 'rgba(120,150,155,0.9)'; g.lineWidth = 0.9 * rv.w; g.stroke();
    }
    // 道路
    g.setLineDash([2, 2]);
    for (const rd of this.roads) {
      g.beginPath(); rd.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = 'rgba(120,96,60,0.55)'; g.lineWidth = rd.major ? 1.1 : 0.7; g.stroke();
    }
    g.setLineDash([]);
    // 山与林的小图标（代码绘制）
    for (let y = 4; y < this.H; y += 6) for (let x = 4; x < this.W; x += 6) {
      const jx = x + (hash2(x, y, 5) - 0.5) * 4, jy = y + (hash2(x, y, 6) - 0.5) * 4;
      const i = (jy | 0) * this.W + (jx | 0);
      if (this.land[i] < 0.55) continue;
      const e = this.elev[i];
      if (e > 0.45 && hash2(x, y, 8) < (e - 0.3) * 1.6) {
        const w = 6 + e * 9, h = w * (0.55 + hash2(x, y, 9) * 0.4);
        const snow = this.cold[i] > 0.42, desert = this.arid[i] > 0.75;
        const base = snow ? '#c8d0dc' : desert ? '#c09a62' : '#6f8a7a';
        g.beginPath(); g.moveTo(jx - w / 2, jy); g.quadraticCurveTo(jx - w * 0.15, jy - h * 0.7, jx, jy - h); g.quadraticCurveTo(jx + w * 0.2, jy - h * 0.6, jx + w / 2, jy); g.closePath();
        g.fillStyle = base; g.fill();
        g.beginPath(); g.moveTo(jx, jy - h); g.quadraticCurveTo(jx + w * 0.2, jy - h * 0.6, jx + w / 2, jy); g.lineTo(jx + w * 0.05, jy); g.closePath();
        g.fillStyle = 'rgba(30,40,40,0.28)'; g.fill();
        if (snow || e > 0.95) { g.beginPath(); g.moveTo(jx - w * 0.12, jy - h * 0.75); g.lineTo(jx, jy - h); g.lineTo(jx + w * 0.1, jy - h * 0.78); g.closePath(); g.fillStyle = '#fafcff'; g.fill(); }
        g.strokeStyle = 'rgba(40,40,36,0.6)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(jx - w / 2, jy); g.quadraticCurveTo(jx - w * 0.15, jy - h * 0.7, jx, jy - h); g.quadraticCurveTo(jx + w * 0.2, jy - h * 0.6, jx + w / 2, jy); g.stroke();
      } else if (this.forest[i] > 0.5 && hash2(x, y, 7) < 0.7) {
        g.fillStyle = this.cold[i] > 0.5 ? 'rgba(50,80,70,0.7)' : 'rgba(60,100,60,0.65)';
        for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(jx + (k - 1) * 1.6, jy - (k % 2) * 1.2, 1.4, 0, Math.PI * 2); g.fill(); }
      }
    }
    g.restore();
    return cv;
  }
}
