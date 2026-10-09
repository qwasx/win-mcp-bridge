// 战场布局：尺寸、地形（山丘、河流、树林、村落）、攻城几何、导航网格与流场寻路
import { Ter } from '../../core/terrain';
import { srand } from '../../art/canvas';

export const NC = 16; // 导航格大小
export const B_FREE = 0, B_WATER = 1, B_WALL = 2, B_GATE = 3, B_HOUSE = 4;

export interface Hill { x: number; y: number; r: number; h: number }
export interface Ford { x: number; y: number; r: number }
export interface River { ns: boolean; c: number; w: number; a1: number; f1: number; p1: number; a2: number; f2: number; fords: Ford[]; bridge: { x: number; y: number } | null }
export interface Grove { x: number; y: number; r: number }
export interface Box { x: number; y: number; w: number; h: number; kind: number }
export interface Section { y0: number; y1: number; hp: number; max: number; broken: boolean }
export interface SiegeGeo {
  wallX: number; gateY0: number; gateY1: number; gateMid: number;
  sections: Section[]; stairs: number[]; towers: number[]; town: boolean;
}

export type FieldSize = 0 | 1 | 2 | 3;
export const FIELD_DIMS: [number, number][] = [[1800, 1150], [2400, 1550], [3000, 1950], [3600, 2300]];

export function sizeFor(total: number, siege: boolean): FieldSize {
  let s: FieldSize = total <= 90 ? 0 : total <= 220 ? 1 : total <= 420 ? 2 : 3;
  if (siege && s === 0) s = 1;
  return s;
}

export class BattleField {
  W: number; H: number; terrain: Ter; seed: number;
  hills: Hill[] = [];
  river: River | null = null;
  groves: Grove[] = [];
  boxes: Box[] = [];
  siege: SiegeGeo | null = null;
  hasRoad: boolean;
  gw: number; gh: number;
  block: Uint8Array;
  wood: Uint8Array;   // 1 = 树林
  slowC: Uint8Array;  // 额外减速（100 = 无）
  version = 1;
  private fields = new Map<number, { d: Uint16Array; v: number; t: number }>();
  private tick = 0;

  constructor(W: number, H: number, terrain: Ter, seed: number, siege: null | { town: boolean }) {
    this.W = W; this.H = H; this.terrain = terrain; this.seed = seed;
    this.gw = Math.ceil(W / NC); this.gh = Math.ceil(H / NC);
    this.block = new Uint8Array(this.gw * this.gh);
    this.wood = new Uint8Array(this.gw * this.gh);
    this.slowC = new Uint8Array(this.gw * this.gh).fill(100);
    this.hasRoad = terrain !== Ter.Forest || !!siege;
    const R = srand(seed * 7 + 13);
    if (siege) this.makeSiege(siege.town, R);
    this.makeHills(R);
    if (!siege) this.makeRiver(R);
    this.makeGroves(R);
    if (!siege) this.makeHamlet(R);
    this.rasterize();
  }

  // ---------- 生成 ----------
  roadY(x: number) { return this.H * 0.5 + Math.sin(x * 0.0032 + this.seed) * 90 + Math.sin(x * 0.009) * 24; }

  private makeHills(R: () => number) {
    const t = this.terrain;
    const n = t === Ter.Hills ? 6 : t === Ter.Mountain ? 7 : t === Ter.Plateau ? 4 : t === Ter.Desert ? 5 : t === Ter.Steppe ? 2 : t === Ter.Forest ? 2 : 3;
    const scale = this.W / 1800;
    for (let i = 0; i < n; i++) {
      const big = t === Ter.Mountain || t === Ter.Hills;
      const r = (big ? 160 + R() * 220 : 180 + R() * 260) * Math.sqrt(scale);
      const h = (big ? 34 + R() * 36 : t === Ter.Desert ? 14 + R() * 16 : 16 + R() * 26);
      let x = this.W * (0.12 + R() * 0.76), y = this.H * (0.1 + R() * 0.8);
      if (this.siege) x = Math.min(x, this.siege.wallX - 360);
      this.hills.push({ x, y, r, h });
    }
    // 多数时候双方阵地附近各有一处可占据的高地
    if (R() < 0.6 && !this.siege) {
      const side = R() < 0.5 ? 0.24 : 0.76;
      this.hills.push({ x: this.W * side, y: this.H * (0.3 + R() * 0.4), r: 220 * Math.sqrt(scale), h: 26 + R() * 18 });
    }
  }

  private makeRiver(R: () => number) {
    const t = this.terrain;
    const p = t === Ter.Plain ? 0.42 : t === Ter.Hills ? 0.3 : t === Ter.Forest ? 0.25 : t === Ter.Steppe ? 0.2 : t === Ter.Mountain ? 0.22 : 0;
    if (R() >= p) return;
    const ns = R() < 0.6;
    const w = 46 + R() * 26;
    if (ns) {
      const c = this.W * (0.47 + (R() - 0.5) * 0.1);
      const rv: River = { ns, c, w, a1: 50 + R() * 50, f1: 0.002 + R() * 0.002, p1: R() * 6, a2: 14 + R() * 12, f2: 0.009, p2: 0, fords: [], bridge: null } as River;
      // 两处浅滩 + 道路桥
      rv.fords.push({ x: 0, y: this.H * (0.18 + R() * 0.14), r: 58 + R() * 18 });
      rv.fords.push({ x: 0, y: this.H * (0.68 + R() * 0.14), r: 58 + R() * 18 });
      for (const f of rv.fords) f.x = this.riverPos(rv, f.y);
      if (this.hasRoad) { const by = this.roadY(c); rv.bridge = { x: this.riverPos(rv, by), y: by }; }
      else if (R() < 0.5) rv.fords.push({ x: 0, y: this.H * 0.5, r: 50 });
      for (const f of rv.fords) f.x = this.riverPos(rv, f.y);
      this.river = rv;
    } else {
      const top = R() < 0.5;
      const c = this.H * (top ? 0.1 + R() * 0.06 : 0.84 + R() * 0.06);
      this.river = { ns, c, w: w + 10, a1: 30 + R() * 30, f1: 0.002 + R() * 0.002, p1: R() * 6, a2: 10, f2: 0.008, fords: [], bridge: null } as River;
    }
  }
  /** 河道中心：ns 时返回给定 y 处的 x；否则返回给定 x 处的 y */
  riverPos(rv: River, s: number) { return rv.c + Math.sin(s * rv.f1 + rv.p1) * rv.a1 + Math.sin(s * rv.f2) * rv.a2; }

  /** 0 = 不在河中；1 = 深水；2 = 浅滩/桥 */
  waterAt(x: number, y: number): number {
    const rv = this.river; if (!rv) return 0;
    const d = rv.ns ? Math.abs(x - this.riverPos(rv, y)) : Math.abs(y - this.riverPos(rv, x));
    if (d > rv.w / 2) return 0;
    for (const f of rv.fords) if (Math.hypot(x - f.x, y - f.y) < f.r) return 2;
    if (rv.bridge && Math.abs(y - rv.bridge.y) < 22 && rv.ns) return 3;
    return 1;
  }

  private makeGroves(R: () => number) {
    const t = this.terrain;
    const n = t === Ter.Forest ? 11 : t === Ter.Hills ? 4 : t === Ter.Plain ? 3 : t === Ter.Mountain ? 4 : t === Ter.Steppe ? 1 : t === Ter.Plateau ? 1 : 0;
    const k = Math.round(n * (this.W * this.H) / (2400 * 1550));
    for (let i = 0; i < k; i++) {
      for (let tries = 0; tries < 10; tries++) {
        const r = (t === Ter.Forest ? 130 : 90) + R() * 110;
        const x = this.W * (0.06 + R() * 0.88), y = this.H * (0.06 + R() * 0.88);
        // 不要盖住双方展开阵地的中心
        if (Math.abs(y - this.H / 2) < this.H * 0.18 && (x < this.W * 0.3 || x > this.W * 0.7) && tries < 8) continue;
        if (this.siege && x > this.siege.wallX - 260) continue;
        if (this.river && this.waterAt(x, y)) continue;
        this.groves.push({ x, y, r });
        break;
      }
    }
  }

  private makeHamlet(R: () => number) {
    const t = this.terrain;
    if (!(t === Ter.Plain || t === Ter.Hills || t === Ter.Steppe) || R() > 0.4) return;
    const cx = this.W * (0.38 + R() * 0.24), cy = this.H * (R() < 0.5 ? 0.24 : 0.72);
    const n = 4 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 12; k++) {
        const x = cx + (R() - 0.5) * 300, y = cy + (R() - 0.5) * 200;
        const b: Box = { x, y, w: 50, h: 34, kind: B_HOUSE };
        if (this.boxes.some(o => Math.abs(o.x - x) < 70 && Math.abs(o.y - y) < 54)) continue;
        if (this.waterAt(x, y)) continue;
        this.boxes.push(b); break;
      }
    }
  }

  private makeSiege(town: boolean, R: () => number) {
    const cityW = town ? 760 : 600;
    const wallX = this.W - cityW;
    const gm = Math.round(this.H / 2);
    const g: SiegeGeo = { wallX, gateY0: gm - 56, gateY1: gm + 56, gateMid: gm, sections: [], stairs: [], towers: [], town };
    const hp = town ? 900 : 700;
    const L = 120;
    // 城门两侧的城楼段不可破
    for (let y = 30; y + L <= g.gateY0 - 50; y += L) g.sections.push({ y0: y, y1: y + L, hp, max: hp, broken: false });
    for (let y = g.gateY1 + 50; y + L <= this.H - 30; y += L) g.sections.push({ y0: y, y1: y + L, hp, max: hp, broken: false });
    for (let y = 230; y < this.H - 120; y += 330) if (Math.abs(y - gm) > 140) g.stairs.push(y);
    if (g.stairs.length < 2) g.stairs = [gm - 260, gm + 260];
    for (let y = 150; y < this.H - 80; y += 280) if (Math.abs(y - gm) > 120) g.towers.push(y);
    this.siege = g;
    // 城内民居（留出主街与城门内广场）
    const n = town ? 60 : 32;
    for (let i = 0; i < n; i++) {
      const x = wallX + 110 + R() * (cityW - 150), y = 40 + R() * (this.H - 80);
      if (Math.abs(y - gm) < 110 && x < wallX + 420) continue;
      if (Math.abs(y - gm) < 60) continue;
      if (g.stairs.some(s => Math.abs(y - s) < 70 && x < wallX + 160)) continue;
      if (x < wallX + 140) continue;
      if (this.boxes.some(o => Math.abs(o.x - x) < 70 && Math.abs(o.y - y) < 56)) continue;
      this.boxes.push({ x, y, w: 50, h: 34, kind: B_HOUSE });
    }
  }

  private rasterize() {
    const { gw, gh } = this;
    this.block.fill(0); this.slowC.fill(100); this.wood.fill(0);
    for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
      const x = cx * NC + NC / 2, y = cy * NC + NC / 2, i = cy * gw + cx;
      const w = this.waterAt(x, y);
      if (w === 1) this.block[i] = B_WATER; else if (w === 2) this.slowC[i] = 55;
      for (const gr of this.groves) if (Math.hypot(x - gr.x, y - gr.y) < gr.r) { this.wood[i] = 1; break; }
    }
    for (const b of this.boxes) this.fillRect(b.x - b.w / 2, b.y - b.h * 0.85, b.w, b.h * 0.8, b.kind);
    const sg = this.siege;
    if (sg) {
      this.fillRect(sg.wallX - 14, 0, 28, this.H, B_WALL);
      this.fillRect(sg.wallX - 14, sg.gateY0, 28, sg.gateY1 - sg.gateY0, B_GATE);
      for (const s of sg.sections) if (s.broken) this.openBreach(s, false);
    }
  }
  private fillRect(x: number, y: number, w: number, h: number, v: number) {
    const x0 = Math.max(0, Math.floor(x / NC)), x1 = Math.min(this.gw - 1, Math.floor((x + w - 1) / NC));
    const y0 = Math.max(0, Math.floor(y / NC)), y1 = Math.min(this.gh - 1, Math.floor((y + h - 1) / NC));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) this.block[cy * this.gw + cx] = v;
  }

  // ---------- 攻城状态变化 ----------
  openGate() {
    const sg = this.siege!;
    const x0 = Math.floor((sg.wallX - 14) / NC), x1 = Math.floor((sg.wallX + 13) / NC);
    for (let cy = Math.floor(sg.gateY0 / NC); cy <= Math.floor((sg.gateY1 - 1) / NC); cy++) for (let cx = x0; cx <= x1; cx++) { const i = cy * this.gw + cx; if (this.block[i] === B_GATE) { this.block[i] = B_FREE; this.slowC[i] = 80; } }
    this.version++;
  }
  openBreach(s: Section, bump = true) {
    const sg = this.siege!;
    s.broken = true;
    const x0 = Math.floor((sg.wallX - 14) / NC), x1 = Math.floor((sg.wallX + 13) / NC);
    for (let cy = Math.floor((s.y0 + 22) / NC); cy <= Math.floor((s.y1 - 22) / NC); cy++) for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
      const i = cy * this.gw + cx; if (i < 0 || i >= this.block.length) continue;
      if (this.block[i] === B_WALL) this.block[i] = B_FREE;
      this.slowC[i] = 60;
    }
    if (bump) this.version++;
  }
  gateOpen() { const sg = this.siege; if (!sg) return true; return this.block[Math.floor(sg.gateMid / NC) * this.gw + Math.floor(sg.wallX / NC)] !== B_GATE; }
  /** 城墙上有通道（城门或缺口） */
  passages(): { x: number; y: number }[] {
    const sg = this.siege; if (!sg) return [];
    const out: { x: number; y: number }[] = [];
    if (this.gateOpen()) out.push({ x: sg.wallX, y: sg.gateMid });
    for (const s of sg.sections) if (s.broken) out.push({ x: sg.wallX, y: (s.y0 + s.y1) / 2 });
    return out;
  }

  // ---------- 查询 ----------
  cell(x: number, y: number) {
    const cx = Math.max(0, Math.min(this.gw - 1, Math.floor(x / NC))), cy = Math.max(0, Math.min(this.gh - 1, Math.floor(y / NC)));
    return cy * this.gw + cx;
  }
  blocked(x: number, y: number) { if (x < 0 || y < 0 || x >= this.W || y >= this.H) return true; return this.block[this.cell(x, y)] !== B_FREE; }
  inWood(x: number, y: number) { return this.wood[this.cell(x, y)] === 1; }
  heightAt(x: number, y: number) {
    let h = 0;
    for (const hl of this.hills) { const dx = x - hl.x, dy = y - hl.y; const d2 = (dx * dx + dy * dy) / (hl.r * hl.r); if (d2 < 6) h += hl.h * Math.exp(-d2 * 1.6); }
    return h;
  }
  /** 移动速度系数 */
  speedAt(x: number, y: number, mounted: boolean) {
    const i = this.cell(x, y);
    let k = this.slowC[i] / 100;
    if (this.wood[i]) k *= mounted ? 0.62 : 0.82;
    return k;
  }
  /** 直线是否通畅（无障碍） */
  clearLine(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / (NC * 0.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.block[this.cell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)] !== B_FREE) return false;
    }
    return true;
  }
  nearestFree(x: number, y: number): [number, number] {
    if (!this.blocked(x, y)) return [x, y];
    for (let r = NC; r < 400; r += NC) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r;
      if (!this.blocked(px, py)) return [px, py];
    }
    return [x, y];
  }

  /** 流场：返回从 (x,y) 走向 (tx,ty) 的下一个路点；不可达时返回 null */
  next(x: number, y: number, tx: number, ty: number): [number, number] | null {
    const [gx, gy] = this.nearestFree(tx, ty);
    const gcx = Math.floor(gx / NC / 3), gcy = Math.floor(gy / NC / 3);
    const key = gcy * 1000 + gcx;
    let f = this.fields.get(key);
    this.tick++;
    if (!f || f.v !== this.version) {
      f = { d: this.bfs(Math.min(this.gw - 1, gcx * 3 + 1), Math.min(this.gh - 1, gcy * 3 + 1), gx, gy), v: this.version, t: this.tick };
      this.fields.set(key, f);
      if (this.fields.size > 64) {
        let ok = -1, ot = Infinity;
        for (const [k, v] of this.fields) if (v.t < ot) { ot = v.t; ok = k; }
        this.fields.delete(ok);
      }
    }
    f.t = this.tick;
    const d = f.d, gw = this.gw;
    let c = this.cell(x, y);
    if (d[c] === 65535) {
      // 当前在障碍格中（例如刚被推挤进来）：找相邻可走格
      let best = -1, bd = 65535;
      const cx0 = c % gw, cy0 = (c / gw) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const nx = cx0 + ox, ny = cy0 + oy; if (nx < 0 || ny < 0 || nx >= gw || ny >= this.gh) continue; const j = ny * gw + nx; if (d[j] < bd) { bd = d[j]; best = j; } }
      if (best < 0) return null;
      c = best;
    }
    // 沿下降方向前看 4 格
    let cur = c;
    for (let step = 0; step < 4; step++) {
      const cx = cur % gw, cy = (cur / gw) | 0;
      let best = cur, bd = d[cur];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= this.gh) continue;
        if (ox && oy && (this.block[cy * gw + nx] || this.block[ny * gw + cx])) continue;
        const j = ny * gw + nx;
        if (d[j] < bd) { bd = d[j]; best = j; }
      }
      if (best === cur) break;
      cur = best;
    }
    if (cur === c && d[c] > 1) return null;
    return [(cur % gw) * NC + NC / 2, ((cur / gw) | 0) * NC + NC / 2];
  }

  private bfs(cx: number, cy: number, gx: number, gy: number) {
    const { gw, gh } = this;
    const d = new Uint16Array(gw * gh).fill(65535);
    const q = new Int32Array(gw * gh);
    let s = this.cell(gx, gy);
    if (this.block[s]) s = cy * gw + cx;
    let qh = 0, qt = 0;
    d[s] = 0; q[qt++] = s;
    while (qh < qt) {
      const c = q[qh++], x = c % gw, y = (c / gw) | 0, nd = d[c] + 1;
      if (x > 0) { const j = c - 1; if (d[j] === 65535 && !this.block[j]) { d[j] = nd; q[qt++] = j; } }
      if (x < gw - 1) { const j = c + 1; if (d[j] === 65535 && !this.block[j]) { d[j] = nd; q[qt++] = j; } }
      if (y > 0) { const j = c - gw; if (d[j] === 65535 && !this.block[j]) { d[j] = nd; q[qt++] = j; } }
      if (y < gh - 1) { const j = c + gw; if (d[j] === 65535 && !this.block[j]) { d[j] = nd; q[qt++] = j; } }
    }
    return d;
  }
}
