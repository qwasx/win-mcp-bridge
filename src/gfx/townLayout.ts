// 第二十二步：城镇 / 宗门 / 村落 / 海岛的布局（贴图建筑版）
// 画材都是正南立面，所以城里是一排排坐北朝南的屋子，屋前是东西向的街，南北向的大街穿城而过；
// 宗门沿南北中轴：山门 → 前广场（钟鼓楼）→ 前殿 → 中庭 → 主殿 → 后山洞府，东西两翼是弟子居所、灵田、演武场。
// 这里一律以「世界像素」计（主角约 108），最后统一除以 LOC_SCALE 存入 LocLayout。
import type { LocDef } from '../data/world';
import type { LocLayout, Pal } from './building';
import type { Species } from './tree';
import { BLD2 } from './bld2Dims';
import { PROP2 } from './propDims';
Object.assign(BLD2, PROP2);

const LS = 1.5;   // = LOC_SCALE（避免循环引用）
export interface Env { site: (x: number, y: number) => boolean; cold: number; arid: number }
export type Fac = 'pill' | 'rest' | 'tavern' | 'artifact' | 'talisman' | 'market' | 'board' | 'auction' | 'sect' | 'teleport';
export interface Door { x: number; y: number; fn: Fac; name: string }
export const FAC_NAME: Record<Fac, string> = { pill: '丹药铺', rest: '客栈', tavern: '酒楼', artifact: '法器阁', talisman: '符箓斋', market: '坊市', board: '悬赏榜', auction: '拍卖行', sect: '宗门事务', teleport: '传送阵' };

type R = { x0: number; y0: number; x1: number; y1: number };
interface Placed { x: number; y: number; w: number; h: number; depth: number; k: string }

class TB {
  pieces: LocLayout['pieces'] = []; ground: LocLayout['ground'] = []; blocks: LocLayout['blocks'] = [];
  lights: LocLayout['lights'] = []; smoke: LocLayout['smoke'] = []; flags: LocLayout['flags'] = [];
  doors: Door[] = []; spots: { x: number; y: number }[] = [];
  navP: number[] = []; navE: [number, number][] = [];
  occ: R[] = [];
  sid = 0;
  constructor(public loc: LocDef, public env: Env, public rnd: () => number, public seed: number, public v?: string) {}
  R(a: number, b: number) { return a + this.rnd() * (b - a); }
  pick<T>(a: T[]): T { return a[Math.floor(this.rnd() * a.length)]; }
  site(x: number, y: number) { return this.env.site(x, y); }
  overlaps(r: R, pad = 0) { for (const o of this.occ) if (r.x0 < o.x1 + pad && r.x1 > o.x0 - pad && r.y0 < o.y1 + pad && r.y1 > o.y0 - pad) return true; return false; }
  w(k: string, s = 1) { return (BLD2[k]?.w ?? 300) * s; }
  h(k: string, s = 1) { return (BLD2[k]?.h ?? 200) * s; }

  /** 放一座建筑（锚点：台基前沿中心）。gate：中间门洞可穿行。返回 null 表示地不合适（水上） */
  bld(k: string, x: number, y: number, o: { s?: number; f?: boolean; v?: string; fn?: Fac; name?: string; gate?: boolean; force?: boolean; lit?: boolean; depth?: number; noOcc?: boolean } = {}): Placed | null {
    const D = BLD2[k]; if (!D) return null;
    const s = o.s ?? 1, w = D.w * s, h = D.h * s;
    const depth = o.depth ?? Math.min(h * 0.38, w * 0.42, 330);
    if (!o.force) {
      for (const [fx, fy] of [[-0.45, 0], [0.45, 0], [0, 0], [-0.45, -1], [0.45, -1], [0, -1]]) if (!this.site(x + fx * w, y + fy * depth)) return null;
    }
    const v = o.v === undefined ? this.v : o.v || undefined;
    this.pieces.push({ kind: 'B', x, y, seed: this.seed + ++this.sid * 7919, p: { k: v ? `${k}|${v}` : k, s, f: !!o.f, fn: o.fn, name: o.name ?? (o.fn ? FAC_NAME[o.fn] : undefined), w, h } });
    const hw = w * 0.44;
    if (o.gate && D.door) {
      const dw = Math.max(96, D.door * s);
      this.blocks.push({ x: x - hw, y: y - depth, w: hw - dw / 2, h: depth - 6 });
      this.blocks.push({ x: x + dw / 2, y: y - depth, w: hw - dw / 2, h: depth - 6 });
    } else this.blocks.push({ x: x - hw, y: y - depth, w: hw * 2, h: depth - 6 });
    if (!o.noOcc) this.occ.push({ x0: x - w / 2, y0: y - depth - 30, x1: x + w / 2, y1: y + 24 });
    if (o.fn) { this.doors.push({ x, y: y + 46, fn: o.fn, name: o.name ?? FAC_NAME[o.fn] }); this.lights.push({ x, y: y - 40, r: 70 }); if (w > 260) this.facProp(o.fn, x, y, w); }
    else if (o.lit !== false && this.rnd() < 0.55) this.lights.push({ x: x + this.R(-0.2, 0.2) * w, y: y - 40, r: 46 });
    return { x, y, w, h, depth, k };
  }
  /** 平铺墙（东西向），自动跳过水面 */
  wall(k: string, x0: number, x1: number, y: number, hh: number) {
    const step = 60; let a: number | null = null;
    const flush = (b: number) => { if (a !== null && b - a > 40) { this.pieces.push({ kind: 'W', x: (a + b) / 2, y, seed: 0, p: { k, len: b - a, hh } }); this.blocks.push({ x: a, y: y - 56, w: b - a, h: 52 }); this.occ.push({ x0: a, y0: y - 60, x1: b, y1: y + 10 }); } a = null; };
    for (let x = x0; x <= x1; x += step) { const ok = this.site(x, y) && this.site(x, y - 50); if (ok && a === null) a = x; if (!ok) flush(x - step / 2); }
    flush(x1);
  }
  /** 南北向墙：俯视只见墙头与内侧，分段以便与人物前后遮挡 */
  wallV(x: number, y0: number, y1: number, h: number, col: string) {
    for (let y = y0; y < y1 - 1; y += 420) {
      const e = Math.min(y1, y + 420);
      if (!this.site(x, (y + e) / 2)) continue;
      this.pieces.push({ kind: 'WV', x, y: e, seed: 0, p: { len: e - y, h, t: 64, col } });
    }
    this.blocks.push({ x: x - 34, y: y0 - 40, w: 68, h: y1 - y0 + 40 });
    this.occ.push({ x0: x - 60, y0: y0 - 60, x1: x + 60, y1: y1 });
  }
  pave(tex: string, x: number, y: number, w: number, h: number, tile = 300, edge = true) { if (tex === 'slab' || tex === 'flag2') tile = Math.min(tile, 160); this.ground.push({ kind: 'pat', x, y, w, h, p: { tex, tile, edge } }); }
  decal(tex: string, x: number, y: number, w: number, h: number) { this.ground.push({ kind: 'dec', x, y, w, h, p: { tex } }); }
  /** 第二十三步：摆件语境（决定铺子门口、民居旁摆什么） */
  ctx: 'city' | 'town' | 'sect' | 'demon' | 'village' | 'isle' = 'town';
  /** 放一件贴图摆件（p_ 前缀画材）。solid：挡路（小块碰撞） */
  sp(k: string, x: number, y: number, o: { f?: boolean; solid?: boolean; force?: boolean; s?: number } = {}): boolean {
    const key = 'p_' + k, D = BLD2[key]; if (!D) return false;
    const s = o.s ?? 1, w = D.w * s;
    if (!o.force && (!this.site(x, y) || !this.site(x - w * 0.4, y) || !this.site(x + w * 0.4, y) || this.overlaps({ x0: x - w * 0.42, y0: y - 18, x1: x + w * 0.42, y1: y + 6 }, 0))) return false;
    this.pieces.push({ kind: 'B', x, y, seed: this.seed + ++this.sid * 7919, p: { k: key, s, f: !!o.f, w, h: D.h * s, prop: true } });
    if (o.solid !== false) this.blocks.push({ x: x - w * 0.36, y: y - 26, w: w * 0.72, h: 22 });
    this.occ.push({ x0: x - w * 0.45, y0: y - 30, x1: x + w * 0.45, y1: y + 10 });
    return true;
  }
  /** 铺子门前左右角的摆件：一看便知是什么店 */
  private facProp(fn: Fac, x: number, y: number, w: number) {
    const dk = this.ctx === 'demon', L = x - w * 0.36, R = x + w * 0.36, Y = y + 58;
    const pair = (k: string, k2 = k) => { this.sp(k, L, Y, { force: true }); this.sp(k2, R, Y, { force: true, f: k === k2 }); };
    switch (fn) {
      case 'pill': if (this.ctx === 'sect' || dk) this.sp(dk ? 'cauldron_dark' : 'cauldron', R, Y + 6, { force: true }); else pair('herbpot'); break;
      case 'artifact': this.sp('weaponrack', R, Y, { force: true }); break;
      case 'talisman': pair('slantern'); break;
      case 'tavern': this.sp('barrels', L, Y, { force: true }); break;
      case 'rest': this.sp(this.ctx === 'city' ? 'oxcart' : 'cart', R + 40, Y + 10, { force: true }); break;
      case 'market': this.sp(this.rnd() < 0.5 ? 'crates' : 'barrels', R, Y, { force: true }); break;
      case 'auction': pair('lion_l', 'lion_r'); break;
      case 'sect': pair(dk ? 'brazier' : 'censer', dk ? 'brazier' : 'censer'); break;
      default: break;
    }
  }
  /** 民居旁的杂物 */
  private houseProp(x: number, y: number, w: number) {
    const pool = this.ctx === 'village' ? ['haystack', 'firewood', 'barrow', 'trough', 'firewood'] : this.ctx === 'isle' ? ['barrels', 'crates', 'barrels'] : this.ctx === 'sect' || this.ctx === 'demon' ? ['slantern', 'herbpot'] : ['barrels', 'crates', 'firewood', 'barrow'];
    const side = this.rnd() < 0.5 ? -1 : 1;
    this.sp(this.pick(pool), x + side * w * this.R(0.3, 0.4), y + 56, { f: this.rnd() < 0.5 });
  }
  /** 落在铺装（街巷、广场）上 */
  onPave(x: number, y: number, m = 30) {
    for (const g of this.ground) if (g.kind === 'pat' && !g.p.base && Math.abs(x - g.x) < g.w / 2 + m && Math.abs(y - g.y) < g.h / 2 + m) return true;
    return false;
  }
  tree(sp: Species, x: number, y: number, s = 0.6, force = false) {
    if (!force && (!this.site(x, y) || this.onPave(x, y) || this.overlaps({ x0: x - 40, y0: y - 30, x1: x + 40, y1: y + 10 }, 10))) return false;
    this.pieces.push({ kind: 'tree', x, y, seed: this.seed + ++this.sid * 7919, p: { sp, s } });
    this.occ.push({ x0: x - 50, y0: y - 30, x1: x + 50, y1: y + 14 });
    return true;
  }
  prop(kind: string, x: number, y: number, p: Record<string, any> = {}) {
    if (!this.site(x, y)) return;
    this.pieces.push({ kind, x, y, seed: this.seed + ++this.sid * 7919, p: { z: 1.7, ...p } });
  }
  node(x: number, y: number) {
    for (let i = 0; i < this.navP.length; i += 2) if (Math.abs(this.navP[i] - x) < 30 && Math.abs(this.navP[i + 1] - y) < 30) return i / 2;
    this.navP.push(x, y); return this.navP.length / 2 - 1;
  }
  link(a: number, b: number) { if (a !== b) this.navE.push([a, b]); }
  streets: { x0: number; y0: number; x1: number; y1: number; ids: number[]; ts: number[] }[] = [];
  /** 街与街相交 / 丁字口：插入路口节点，把各条街的导航线连成一张网 */
  private joinStreets() {
    const S = this.streets;
    const hook = (st: typeof S[0], t: number, X: number) => {
      const tt = Math.max(0, Math.min(1, t));
      let i = 0; while (i < st.ts.length - 2 && st.ts[i + 1] < tt) i++;
      this.link(X, st.ids[i]); this.link(X, st.ids[Math.min(st.ids.length - 1, i + 1)]);
    };
    for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) {
      const A = S[a], B = S[b];
      const rx = A.x1 - A.x0, ry = A.y1 - A.y0, sx = B.x1 - B.x0, sy = B.y1 - B.y0;
      const den = rx * sy - ry * sx; if (Math.abs(den) < 1e-6) continue;
      const qx = B.x0 - A.x0, qy = B.y0 - A.y0;
      const ta = (qx * sy - qy * sx) / den, tb = (qx * ry - qy * rx) / den;
      const La = Math.hypot(rx, ry), Lb = Math.hypot(sx, sy);
      if (ta * La < -160 || ta * La > La + 160 || tb * Lb < -160 || tb * Lb > Lb + 160) continue;
      const X = this.node(A.x0 + rx * Math.max(0, Math.min(1, ta)), A.y0 + ry * Math.max(0, Math.min(1, ta)));
      hook(A, ta, X); hook(B, tb, X);
    }
  }
  /** 一条街：铺装 + 导航线 + 行人落脚点 */
  street(tex: string, x0: number, y0: number, x1: number, y1: number, wd: number, tile = 300) {
    const hz = Math.abs(y1 - y0) < 1;
    if (hz) this.pave(tex, (x0 + x1) / 2, y0, Math.abs(x1 - x0) + wd, wd, tile);
    else this.pave(tex, x0, (y0 + y1) / 2, wd, Math.abs(y1 - y0) + wd, tile);
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 320));
    let prev = this.node(x0, y0); const ids = [prev], ts = [0];
    for (let i = 1; i <= n; i++) { const t = i / n; const cur = this.node(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); this.link(prev, cur); prev = cur; ids.push(cur); ts.push(t); }
    this.streets.push({ x0, y0, x1, y1, ids, ts });
    for (let i = 0; i <= n; i++) { const t = i / n; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (this.site(x, y)) this.spots.push({ x, y }); }
  }
  /** 沿一行坐北朝南排屋：从 x 起朝 dir 方向，直到 lim；fnList 先放（离大街最近） */
  row(y: number, x: number, lim: number, dir: 1 | -1, pool: string[], first: { k: string; fn?: Fac; name?: string; s?: number }[] = [], o: { gap?: [number, number]; v?: string; maxH?: number } = {}) {
    const out: Placed[] = [];
    const [g0, g1] = o.gap ?? [24, 80];
    let cur = x, last = '';
    const queue = first.slice();
    let guard = 0;
    while (guard++ < 40) {
      const room = (lim - cur) * dir;
      if (room < 160) break;
      let item = queue.shift();
      if (!item) {
        const cand = pool.filter((k) => k !== last && this.w(k) <= room && (!o.maxH || this.h(k) <= o.maxH));
        if (!cand.length) break;
        item = { k: this.pick(cand) };
      }
      const w = this.w(item.k, item.s ?? 1);
      if (w > room) { if (item.fn) continue; else continue; }
      const cx = cur + dir * w / 2;
      const p = this.bld(item.k, cx, y, { fn: item.fn, name: item.name, s: item.s, f: !item.fn && this.rnd() < 0.3, v: o.v });
      if (p) { out.push(p); last = item.k; cur += dir * (w + this.R(g0, g1)); if (!item.fn && this.rnd() < 0.18) this.smoke.push({ x: cx + this.R(-0.2, 0.2) * w, y: y - p.h * 0.8 }); if (!item.fn && w > 240 && this.rnd() < 0.32) this.houseProp(cx, y, w); }
      else { if (item.fn) queue.unshift(item); cur += dir * 140; if (item.fn && guard > 30) queue.shift(); }
    }
    return out;
  }
  /** 屋后空地种树（不挡门面） */
  backTrees(y: number, x0: number, x1: number, sps: Species[], n: number, s: [number, number] = [0.5, 0.66]) {
    for (let i = 0; i < n * 3 && n > 0; i++) { const x = this.R(x0, x1); if (this.tree(this.pick(sps), x, y + this.R(-30, 30), this.R(s[0], s[1]))) n--; }
  }
  ring(cx: number, cy: number, rx: number, ry: number, n: number, sps: Species[], s: [number, number] = [0.55, 0.75]) {
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2, r = 0.92 + this.rnd() * 0.2; this.tree(this.pick(sps), cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, this.R(s[0], s[1])); }
  }
  /** 铺装范围内的水面（河穿城而过时）：按 50px 格子找出，合并成横条，绘制时挖掉 */
  private wetRuns() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const g of this.ground) { x0 = Math.min(x0, g.x - g.w / 2); x1 = Math.max(x1, g.x + g.w / 2); y0 = Math.min(y0, g.y - g.h / 2); y1 = Math.max(y1, g.y + g.h / 2); }
    const out: { x: number; y: number; w: number; h: number }[] = []; if (x0 > x1) return out;
    const C = 50;
    for (let y = y0; y < y1; y += C) {
      let a: number | null = null;
      for (let x = x0; x <= x1 + C; x += C) {
        const wet = x <= x1 && !this.site(x + C / 2, y + C / 2);
        if (wet && a === null) a = x;
        if (!wet && a !== null) { out.push({ x: a, y, w: x - a, h: C }); a = null; }
      }
    }
    return out;
  }
  finish(L: LocLayout, gw: number, gh: number) {
    const k = 1 / LS;
    L.wet = this.wetRuns().map((r) => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }));
    if (!L.wet.length) L.wet = undefined;
    for (const p of this.pieces) { p.x *= k; p.y *= k; }
    for (const g of this.ground) { g.x *= k; g.y *= k; g.w *= k; g.h *= k; }
    L.pieces.push(...this.pieces); L.ground.push(...this.ground);
    L.blocks.push(...this.blocks.map((b) => ({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k })));
    L.lights.push(...this.lights.map((l) => ({ x: l.x * k, y: l.y * k, r: l.r * k })));
    L.smoke.push(...this.smoke.map((s) => ({ x: s.x * k, y: s.y * k })));
    L.flags.push(...this.flags.map((f) => ({ ...f, x: f.x * k, y: f.y * k })));
    L.doors = this.doors.map((d) => ({ ...d, x: d.x * k, y: d.y * k }));
    L.spots = this.spots.map((s) => ({ x: s.x * k, y: s.y * k }));
    this.joinStreets();
    const adj: number[][] = []; for (let i = 0; i < this.navP.length / 2; i++) adj.push([]);
    for (const [a, b] of this.navE) { if (!adj[a].includes(b)) adj[a].push(b); if (!adj[b].includes(a)) adj[b].push(a); }
    // 仍不连通的小片：就近接到最大的一片（距离 < 600）
    const N = adj.length, comp = new Int32Array(N).fill(-1); let nc = 0;
    for (let i = 0; i < N; i++) if (comp[i] < 0) { const q = [i]; comp[i] = nc; while (q.length) { const c = q.pop()!; for (const nb of adj[c]) if (comp[nb] < 0) { comp[nb] = nc; q.push(nb); } } nc++; }
    if (nc > 1) {
      const size = new Int32Array(nc); for (let i = 0; i < N; i++) size[comp[i]]++;
      let big = 0; for (let c = 1; c < nc; c++) if (size[c] > size[big]) big = c;
      for (let c = 0; c < nc; c++) if (c !== big) {
        let bd = 1e18, bi = -1, bj = -1;
        for (let i = 0; i < N; i++) if (comp[i] === c) for (let j = 0; j < N; j++) if (comp[j] === big) { const d = (this.navP[i * 2] - this.navP[j * 2]) ** 2 + (this.navP[i * 2 + 1] - this.navP[j * 2 + 1]) ** 2; if (d < bd) { bd = d; bi = i; bj = j; } }
        if (bi >= 0 && bd < 600 * 600) { adj[bi].push(bj); adj[bj].push(bi); }
      }
    }
    L.nav = { pts: this.navP.map((v) => v * k), adj };
    L.gw = gw * k; L.gh = gh * k;
    L.v2 = true;
  }
}

// ======================================================== 城池
interface CityStyle {
  gate: string; wall: string; wallH: number; corner: string; cornerS?: number; gateS?: number;
  houses: string[]; fn: Partial<Record<Fac, string>>; north: string; northFn?: Fac;
  palace?: [string, string]; pave: string; v?: string; trees: Species[]; wallCol: string;
  stalls?: string[]; extra?: (b: TB, o: { W: number; yS: number; yN: number; rows: number[] }) => void;
}
const TN_HOUSES = ['b02', 'b02b', 'b14', 'b15', 'b03b', 'b03', 'b25', 'b19', 'b26'];
const CITY: Record<string, CityStyle> = {
  tiannan: { gate: 'b20', wall: 'b36_strip', wallH: 205, corner: 'b21', houses: TN_HOUSES, fn: { pill: 'b16', rest: 'b17', tavern: 'b18', artifact: 'b37a', talisman: 'b37b', auction: 'b38', market: 'b19', board: 'b27' }, north: 'b27', northFn: 'board', pave: 'flag', trees: ['willow', 'broad', 'broad', 'pine'], wallCol: '#8e8a7e', stalls: ['b23a', 'b23b', 'b23c'] },
  border: { gate: 'f9_gate', wall: 'f9_wall_strip', wallH: 150, corner: 'f9_tower', houses: TN_HOUSES, fn: { pill: 'b16', rest: 'b17', tavern: 'b18', artifact: 'b37a', talisman: 'b37b', auction: 'b38', market: 'b19', board: 'b27' }, north: 'f9_keep', northFn: 'board', pave: 'flag2', trees: ['pine', 'cypress', 'broad'], wallCol: '#8a8478', stalls: ['b23a', 'b23b', 'b23c'] },
  dajin: { gate: 'j03', wall: 'b36_strip', wallH: 225, corner: 'j03_corner', cornerS: 0.9, houses: ['j04a', 'j04b', 'j05', 'j06a', 'j06b', 'b14', 'b19', 'b25', 'j04a'], fn: { pill: 'b16', rest: 'j10', tavern: 'b18', artifact: 'b37a', talisman: 'b37b', auction: 'b38', market: 'j06a', board: 'b27' }, north: 'b27', northFn: 'board', pave: 'flag2', trees: ['broad', 'pine', 'willow', 'cypress'], wallCol: '#8a867c', stalls: ['b23a', 'b23b', 'b23c'] },
  star: { gate: 'x03', wall: 'x03_wall_strip', wallH: 206, corner: 'b21', houses: ['x04a', 'x04b', 'x06', 'x05', 'b03b', 'b14', 'x04a'], fn: { pill: 'b16', rest: 'b17', tavern: 'b18', artifact: 'b37a', talisman: 'b37b', auction: 'b38', market: 'x06', board: 'b27' }, north: 'x01', northFn: 'board', pave: 'slab', trees: ['palm', 'broad', 'palm'], wallCol: '#a8a69c', stalls: ['x09b', 'b23b', 'b23c'] },
};

function city(b: TB, loc: LocDef, st: CityStyle, isMajorTown: boolean) {
  const major = !!loc.major;
  const nR = major ? 5 : 4, P = 600, W = major ? 4600 : 3600, SW = 230;
  const rows: number[] = []; const y0 = ((nR - 1) * P) / 2 - 140;
  for (let k = 0; k < nR; k++) rows.push(y0 - k * P);
  const yS = y0 + 600, yN = rows[nR - 1] - 560;
  const xw = W / 2;
  // —— 城墙、城门、角楼
  const gw = b.w(st.gate, st.gateS ?? 1);
  b.bld(st.gate, 0, yS, { gate: true, force: true, s: st.gateS, lit: false });
  b.bld(st.gate, 0, yN, { gate: true, force: true, s: st.gateS, lit: false });
  for (const yy of [yS, yN]) { b.wall(st.wall, -xw, -gw / 2 + 6, yy, st.wallH); b.wall(st.wall, gw / 2 - 6, xw, yy, st.wallH); }
  b.wallV(-xw, yN, yS, st.wallH, st.wallCol); b.wallV(xw, yN, yS, st.wallH, st.wallCol);
  for (const sx of [-1, 1]) for (const yy of [yS, yN]) b.bld(st.corner, sx * xw, yy + 4, { force: true, s: st.cornerS, lit: false });
  b.flags.push({ x: -gw * 0.32, y: yS - 150, color: '#a8432f' }, { x: gw * 0.32, y: yS - 150, color: '#a8432f' });
  // —— 城内底色：夯土院落（街巷石板铺在其上），不再是一块块草坪
  b.ground.push({ kind: 'pat', x: 0, y: (yS + yN) / 2, w: W - 60, h: yS - yN - 40, p: { tex: 'road', tile: 420, edge: true, base: true } });
  // —— 街道：中轴大街 + 每排屋前东西街 + 城门内广场
  const AV = 280;
  b.street(st.pave, 0, yS + 260, 0, yN - 200, AV);
  b.street(st.pave, -xw + 140, yS - 170, xw - 140, yS - 170, 250);
  for (const y of rows) b.street(st.pave, -xw + 140, y + 30 + SW / 2, xw - 140, y + 30 + SW / 2, SW);
  const lanes: number[] = [];   // 不再开内巷：每侧排屋连成片，像座城
  for (const lx of lanes) b.street(st.pave, lx, yS - 170, lx, rows[nR - 1] + 145, 170);
  for (const sx of [-1, 1]) b.street(st.pave, sx * (xw - 180), yS - 170, sx * (xw - 180), rows[nR - 1] + 145, 150);
  // 出城的路
  b.pave('road', 0, yS + 380, 300, 520, 360); b.pave('road', 0, yN - 360, 300, 480, 360);
  // —— 中央广场（传送阵、钟鼓楼）：第二排中段
  const pr = rows[1], PW = 600;
  b.pave('slab', 0, pr - 30, PW * 2, 500, 360);
  b.decal('d_array', 0, pr - 30, 470, 290);
  b.doors.push({ x: 0, y: pr - 30, fn: 'teleport', name: '传送阵' });
  b.bld('b10', -PW + 170, pr - 250, { force: true }); b.bld('b10b', PW - 170, pr - 250, { force: true });
  // —— 北端：衙署 / 皇城
  let northDone = false;
  if (st.palace) {
    const [pg, ph] = st.palace;
    b.bld(pg, 0, rows[nR - 2], { gate: true, force: true });
    b.bld(ph, 0, rows[nR - 1], { force: true, fn: 'board', name: '宫门告示' });
    const pw = b.w(pg) / 2;
    b.wall('b39_strip', -760, -pw + 4, rows[nR - 2], 230); b.wall('b39_strip', pw - 4, 760, rows[nR - 2], 230);
    northDone = true;
  }
  if (!northDone) b.bld(st.north, 0, rows[nR - 1], { force: true, fn: st.northFn, name: st.northFn === 'board' ? '悬赏榜' : undefined });
  // —— 排屋
  const F = st.fn;
  const facW: { k: string; fn?: Fac }[][] = [[{ k: F.pill!, fn: 'pill' }], [{ k: F.artifact!, fn: 'artifact' }], [{ k: F.talisman!, fn: 'talisman' }]];
  const facE: { k: string; fn?: Fac }[][] = [[{ k: F.rest!, fn: 'rest' }], [{ k: F.tavern!, fn: 'tavern' }], isMajorTown ? [{ k: F.auction!, fn: 'auction' }] : [{ k: 'b26' }]];
  if (st.palace) facE[0].push({ k: F.board!, fn: 'board' });
  for (let r = 0; r < nR; r++) {
    const y = rows[r];
    const central = r === 1 ? PW + 20 : (st.palace && r >= nR - 2) ? 800 : r === nR - 1 ? b.w(st.north) / 2 + 60 : AV / 2 + 40;
    // 东西两侧，从中轴向外
    for (const dir of [-1, 1] as const) {
      let x = dir * central;
      const stops = lanes.length ? [xw * 0.56 - 100, xw - 270] : [xw - 270];
      let first = (dir < 0 ? facW[r] : facE[r]) ?? [];
      if (r === 0 && dir < 0 && st.stalls) first = [...first, ...st.stalls.map((k) => ({ k, fn: 'market' as Fac }))];
      if (r === 0 && dir > 0 && F.market) first = [...first, { k: F.market, fn: 'market' as Fac }];
      for (let si = 0; si < stops.length; si++) {
        b.row(y, x, dir * stops[si], dir, st.houses, si === 0 ? first : [], { v: st.v });
        x = dir * (stops[si] + 200);
      }
    }
    // 屋后的树
    b.backTrees(y - 290, -xw + 200, xw - 200, st.trees, major ? 7 : 5);
  }
  // —— 街景：灯笼、水井、城外树
  for (let y = yS - 300; y > yN; y -= 300) for (const sx of [-1, 1]) if (Math.abs(y - (pr - 30)) > 300) b.sp('lamppost', sx * (AV / 2 + 22), y, { f: sx > 0, force: true });
  b.sp('well', -xw * 0.3, yS - 120); b.sp('well', xw * 0.36, rows[2] + 150);
  b.sp('lion_l', -110, yS + 60, { force: true }); b.sp('lion_r', 110, yS + 60, { force: true });
  // 城门内：路牌、告示、水槽；传送阵四角石灯
  b.sp('signpost', 190, yS - 300); b.sp('trough', -xw + 420, yS - 300);
  for (const [dx, dy] of [[-260, -170], [260, -170], [-260, 120], [260, 120]]) b.sp('slantern', dx, pr - 30 + dy, { force: true });
  b.ring(0, (yS + yN) / 2, xw + 420, (yS - yN) / 2 + 420, major ? 26 : 18, st.trees);
  st.extra?.(b, { W, yS, yN, rows });
  return { gw: W + 1200, gh: yS - yN + 1300, cy: (yS + yN) / 2 };
}

// ======================================================== 镇
function town(b: TB, loc: LocDef, region: string, opts: { big?: boolean; fort?: string; auction?: boolean }) {
  const big = !!opts.big;
  const nR = big ? 3 : 2, P = 600, W = big ? 2800 : 2300;
  const rows: number[] = []; const y0 = ((nR - 1) * P) / 2 - 60;
  for (let k = 0; k < nR; k++) rows.push(y0 - k * P);
  const yS = y0 + 470, yN = rows[nR - 1] - 420, xw = W / 2;
  const dj = region === 'dajin';
  const houses = dj ? ['j04a', 'j04b', 'j05', 'j06b', 'b02', 'b15'] : ['b02', 'b02b', 'b15', 'b03b', 'b14', 'b30', 'b25'];
  const pave = dj ? 'flag2' : 'flag';
  // 中轴街 + 东西街
  b.street(pave, 0, yS + 120, 0, rows[nR - 1] + 140, 240);
  for (const y of rows) b.street(pave, -xw + 120, y + 145, xw - 120, y + 145, 220);
  b.pave('road', 0, yS + 330, 260, 420, 360);
  if (opts.fort) {
    const fs = opts.fort === 'f9' ? { gate: 'f9_gate', wall: 'f9_wall_strip', h: 150, corner: 'f9_tower' } : { gate: 'j07_gate', wall: 'b36_strip', h: 210, corner: 'j03_corner' };
    const gw = b.w(fs.gate);
    b.bld(fs.gate, 0, yS, { gate: true, force: true, lit: false });
    b.wall(fs.wall, -xw, -gw / 2 + 6, yS, fs.h); b.wall(fs.wall, gw / 2 - 6, xw, yS, fs.h);
    b.wall(fs.wall, -xw, xw, yN, fs.h);
    b.wallV(-xw, yN, yS, fs.h, '#8a8478'); b.wallV(xw, yN, yS, fs.h, '#8a8478');
    for (const sx of [-1, 1]) for (const yy of [yS, yN]) b.bld(fs.corner, sx * xw, yy + 4, { force: true, lit: false, s: fs.corner === 'j03_corner' ? 0.75 : 1 });
  } else {
    b.bld('b29', 0, yS - 10, { gate: true, force: true, lit: false });   // 镇口牌坊
  }
  // 北端：祠堂 / 家族正堂
  const northK = opts.fort === 'j07' ? 'j07_hall' : opts.fort === 'f9' ? 'f9_keep' : big ? 'b32' : 'b28';
  b.bld(northK, 0, rows[nR - 1], { force: true });
  const facW: { k: string; fn?: Fac; name?: string }[][] = [[{ k: 'b16', fn: 'pill' }], [{ k: big ? 'b18' : 'b26', fn: 'tavern', name: big ? '酒楼' : '茶馆' }]];
  const facE: { k: string; fn?: Fac; name?: string }[][] = [[{ k: dj ? 'j10' : 'b17', fn: 'rest' }, { k: 'b23a', fn: 'market' }, { k: 'b23b', fn: 'market' }], [{ k: dj ? 'j06a' : 'b19', fn: 'market', name: '杂货铺' }]];
  if (big) { facW.push([{ k: 'b37a', fn: 'artifact' }, { k: 'b37b', fn: 'talisman' }]); facE.push(opts.auction ? [{ k: 'b38', fn: 'auction' }] : []); }
  for (let r = 0; r < nR; r++) {
    const y = rows[r];
    const central = r === nR - 1 ? b.w(northK) / 2 + 50 : 160;
    for (const dir of [-1, 1] as const) b.row(y, dir * central, dir * (xw - 120), dir, houses, (dir < 0 ? facW[r] : facE[r]) ?? []);
    b.backTrees(y - 380, -xw + 150, xw - 150, dj ? ['broad', 'pine', 'cypress'] : ['willow', 'broad', 'peach'], 4);
  }
  // 悬赏告示（十字路口的告示牌）
  b.sp('notice', 230, rows[0] + 175, { force: true });
  b.doors.push({ x: 230, y: rows[0] + 200, fn: 'board', name: '悬赏榜' });
  b.sp('well', -260, rows[0] + 190);
  for (let y = yS - 160; y > rows[nR - 1] + 100; y -= 320) for (const sx of [-1, 1]) b.sp('lamppost', sx * 150, y, { f: sx > 0, force: true });
  b.sp('signpost', -150, yS - 40);
  b.ring(0, (yS + yN) / 2, xw + 300, (yS - yN) / 2 + 300, 16, dj ? ['broad', 'pine', 'willow'] : ['willow', 'broad', 'peach', 'pine']);
  return { gw: W + 900, gh: yS - yN + 1000, cy: (yS + yN) / 2 };
}

// ======================================================== 村落 / 草原营地 / 海边渔村
function village(b: TB, kind: 'farm' | 'north' | 'snow' | 'steppe' | 'isle') {
  const pool = kind === 'farm' ? ['b30', 'b02', 'b02b', 'b15', 'b30'] : kind === 'north' ? ['j04a', 'j04b', 'b30', 'j04a'] : kind === 'snow' ? ['j11', 'j12', 'j12'] : kind === 'steppe' ? ['b24a', 'b24b', 'b24a', 'j17'] : ['x04a', 'x04b', 'x05', 'x04a'];
  const n = 4 + Math.floor(b.rnd() * 4);
  // 村心：一口井、一棵老树、一条土路
  b.pave('road', 0, 40, 1300, 150, 340, false);
  b.pave('road', 0, 380, 150, 560, 340, false);
  b.spots.push({ x: 0, y: 60 }, { x: -400, y: 40 }, { x: 400, y: 40 }, { x: 0, y: 360 });
  const nc = b.node(0, 40), nw = b.node(-560, 40), ne = b.node(560, 40), ns = b.node(0, 560);
  b.link(nc, nw); b.link(nc, ne); b.link(nc, ns);
  if (kind !== 'steppe') b.sp('well', 120, 0, { force: true }); else b.bld('t05', 140, -10, { force: true });
  if (kind === 'steppe') { b.sp('banner_steppe', -160, 10, { force: true }); b.sp('banner_steppe', 300, 20, { force: true, f: true }); }
  // 两排：北排 3–4 座，南排 1–3 座
  const slots: [number, number][] = [[-480, -30], [0, -40], [480, -30], [-880, -10], [880, -10], [-470, 470], [470, 470], [-850, 480]];
  let placed = 0;
  for (const [sx, sy] of slots) {
    if (placed >= n) break;
    const k = b.pick(pool);
    const fn: Fac | undefined = placed === 0 ? 'rest' : placed === 1 ? 'tavern' : placed === 2 ? 'market' : undefined;
    const name = fn === 'rest' ? '农舍借宿' : fn === 'tavern' ? '酒肆' : fn === 'market' ? '杂货摊' : undefined;
    const p = b.bld(k, sx + b.R(-40, 40), sy + b.R(-20, 20), { fn, name, f: b.rnd() < 0.4 });
    if (p) { placed++; if (b.rnd() < 0.5) b.smoke.push({ x: p.x + b.R(-0.2, 0.2) * p.w, y: p.y - p.h * 0.85 }); }
  }
  if (kind === 'farm' && b.rnd() < 0.5) b.bld('b28', 0, -520, {});   // 土地庙
  if (kind === 'steppe') { b.bld('t04', -300, -520, {}); b.prop('fence', 0, 760, { len: 600 }); }
  // 田 / 圈
  if (kind === 'farm' || kind === 'north') {
    for (const [fx, fy] of [[-1100, 300], [1100, 300], [-900, 820], [900, 820], [0, 980]]) if (b.site(fx, fy) && b.rnd() < 0.8) { b.pave(b.rnd() < 0.5 ? 'farm' : 'farm2', fx, fy, b.R(420, 620), b.R(240, 340), 260); if (b.rnd() < 0.45) b.sp('scarecrow', fx + b.R(-120, 120), fy + b.R(-40, 60), { force: true, solid: false }); }
    b.sp('haystack', -700, 200); b.sp('trough', 260, 200);
  }
  const sps: Species[] = kind === 'snow' ? ['snowpine'] : kind === 'steppe' ? ['broad', 'dead'] : kind === 'isle' ? ['palm', 'palm', 'broad'] : ['willow', 'broad', 'peach', 'apricot'];
  b.tree(sps[0] === 'palm' ? 'palm' : kind === 'snow' ? 'snowpine' : 'broad', -150, 150, 0.8);
  b.ring(0, 150, 1150, 650, 12, sps, [0.5, 0.7]);
  return { gw: 2600, gh: 2000, cy: 150 };
}

// ======================================================== 宗门
interface SectFam { gate: string; hall: string; v?: string; side?: string; wall?: [string, number]; extra?: (b: TB, o: { yG: number; yA: number; yB: number; yC: number; xw: number }) => void; decal?: string; plaza?: string; noCave?: boolean; quarters?: string; trees?: Species[] }
const SECT_FAM: Record<string, SectFam> = {
  huangfeng: { gate: 'b04', hall: 'b01', wall: ['b13_strip', 108] },
  jujian: { gate: 'f1_gate_b', hall: 'f1_hall_b', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f1_sword_monument', -520, o.yG - 420, { force: true, lit: false }); b.bld('f1_sword_monument', 520, o.yG - 420, { force: true, lit: false }); } },
  gujian: { gate: 'b04', hall: 'f1_hall_b', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f1_sword_monument', 560, o.yG - 420, { force: true, lit: false }); } },
  huayi: { gate: 'f1_gate_b', hall: 'b01', wall: ['b13_strip', 108] },
  luoyun: { gate: 'f1_gate_b', hall: 'f1_luoyun_hall', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f1_peak_pavilion', -1000, o.yC - 40, {}); b.bld('f1_peak_pavilion', 1050, o.yC - 60, {}); b.bld('f1_sword_monument', 560, o.yG - 420, { force: true, lit: false }); } },
  taiyi: { gate: 'f2_gate', hall: 'f2_hall', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f2_tower', -1100, o.yB, { force: true }); b.bld('f2_tower', 1100, o.yB, { force: true }); } },
  qingxu: { gate: 'f3_gate', hall: 'f3_hall', decal: 'd_taiji', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f3_bagua_altar', 0, o.yA - 330, { force: true, lit: false }); } },
  yanyue: { gate: 'f4_gate', hall: 'f4_hall', v: 'rose', wall: ['b13_strip', 108], trees: ['plum', 'peach', 'cypress', 'bamboo'], extra: (b, o) => { b.bld('f4_moon_tower', 1150, o.yB, { force: true }); b.ground.push({ kind: 'pond', x: -1150, y: o.yA + 150, w: 620, h: 300 }); b.blocks.push({ x: -1430, y: o.yA + 30, w: 560, h: 240 }); b.bld('f4_waterside', -1150, o.yA - 20, { force: true }); b.bld('f4_music_pavilion', 1100, o.yA + 120, {}); } },
  miaoyin: { gate: 'f4_gate', hall: 'f4_hall', v: 'rose', trees: ['palm', 'peach'], extra: (b, o) => { b.bld('f4_music_pavilion', -1050, o.yA + 100, {}); b.bld('f4_moon_tower', 1100, o.yB, { force: true }); } },
  guiling: { gate: 'f5_gate', hall: 'f5_hall_c', v: 'dark', trees: ['dead', 'cypress'], extra: (b, o) => demonDeco(b, o) },
  hehuan: { gate: 'f5_gate', hall: 'f5_hall_b', v: 'rose', trees: ['peach', 'peach', 'plum'], extra: (b, o) => { b.bld('f4_music_pavilion', 1100, o.yA + 100, {}); b.ground.push({ kind: 'pond', x: -1100, y: o.yA + 160, w: 560, h: 280 }); b.blocks.push({ x: -1350, y: o.yA + 50, w: 500, h: 220 }); } },
  yuling: { gate: 'f5_gate', hall: 'f5_hall', v: 'dark', trees: ['dead', 'pine'], extra: (b, o) => demonDeco(b, o) },
  qianhuan: { gate: 'f5_gate', hall: 'f5_hall_b', v: 'dark', trees: ['cypress', 'bamboo'], extra: (b, o) => { b.bld('f5_bone_tower', 1100, o.yB, { force: true }); } },
  tiansha: { gate: 'f5_gate', hall: 'f5_hall', v: 'dark', trees: ['dead', 'dead', 'cypress'], extra: (b, o) => demonDeco(b, o) },
  yinluo: { gate: 'f5_gate', hall: 'f5_hall', v: 'dark', trees: ['dead', 'cypress'], extra: (b, o) => demonDeco(b, o) },
  tianmo: { gate: 'f5_gate', hall: 'f5_hall', v: 'dark', trees: ['dead', 'cypress', 'dead'], extra: (b, o) => demonDeco(b, o) },
  jiyin: { gate: 'f5_gate', hall: 'f5_hall_c', v: 'dark', trees: ['palm', 'dead'], extra: (b, o) => demonDeco(b, o) },
  qixuan: { gate: 'f6_gate', hall: 'f6_hall', noCave: true, plaza: 'flag2', extra: (b, o) => { b.bld('f6_watchtower', -o.xw + 160, o.yG + 4, { force: true, lit: false }); b.bld('f6_watchtower', o.xw - 160, o.yG + 4, { force: true, lit: false }); b.bld('f6_drill_ground', -1050, o.yA + 160, {}); } },
  lingshou: { gate: 'f7_gate', hall: 'f7_hall', wall: ['b13_strip', 108], extra: (b, o) => { for (let i = 0; i < 3; i++) b.bld('f7_beast_pen', 1250, o.yG - 300 - i * 520, {}); } },
  huadao: { gate: 'f8_gate', hall: 'f8_hall', extra: (b, o) => { b.bld('f8_stilt_house', 1050, o.yA + 60, {}); b.bld('f8_stilt_house', -1050, o.yA + 60, {}); b.bld('f8_stilt_house', 1100, o.yC, {}); } },
  tianque: { gate: 'f9_gate', hall: 'f9_keep', wall: ['f9_wall_strip', 150], extra: (b, o) => { b.bld('f9_tower', -o.xw, o.yG + 4, { force: true, lit: false }); b.bld('f9_tower', o.xw, o.yG + 4, { force: true, lit: false }); } },
  baiqiao: { gate: 'f10_gate', hall: 'f10_hall', wall: ['b13_strip', 108], extra: (b, o) => { b.bld('f10_workshop', 1050, o.yA, {}); b.bld('f10_workshop', 1150, o.yC, {}); } },
  qianzhu: { gate: 'f11_gate', hall: 'f11_hall', trees: ['bamboo', 'bamboo', 'bamboo', 'pine'], extra: (b, o) => { b.bld('f11_bamboo_tower', -1100, o.yB, { force: true }); b.bld('f11_bamboo_tower', 1100, o.yB, { force: true }); } },
  tianlan: { gate: 't02', hall: 't01', noCave: true, quarters: 'b24c', trees: ['broad', 'dead'], plaza: 'slab', extra: (b, o) => { b.bld('t03', -800, o.yB + 40, { force: true }); b.bld('t03', 800, o.yB + 40, { force: true }); b.bld('t04', -1000, o.yA + 140, {}); b.bld('t05', 900, o.yA + 200, {}); for (const [x, y] of [[-1300, o.yC], [1300, o.yC], [-1500, o.yA - 300], [1500, o.yA - 300]]) b.bld(b.pick(['b24a', 'b24b']), x, y, {}); } },
};
function demonDeco(b: TB, o: { yG: number; yA: number; yB: number; yC: number; xw: number }) {
  b.bld('f5_blood_altar', 0, o.yG - 360, { force: true, lit: false });
  b.bld('f5_bone_tower', -1150, o.yB, { force: true }); b.bld('f5_bone_tower', 1150, o.yB, { force: true });
  for (let k = 0; k < 6; k++) b.prop('obelisk', (k % 2 ? 1 : -1) * 760, o.yG - 120 - Math.floor(k / 2) * 260, { glow: '#c03030', h: 70, z: 2 });
}

function sect(b: TB, loc: LocDef, fam: SectFam, major: boolean, trees: Species[]) {
  const sc = loc.id === 'qixuan' ? 0.85 : 1;
  const yG = 1350 * sc, yA = 560 * sc, yB = -260 * sc, yC = -1050 * sc, xw = 1650 * sc;
  const plaza = fam.plaza ?? (fam.v === 'dark' ? 'flag2' : 'slab');
  // —— 山门与围墙
  const gw = b.w(fam.gate);
  b.bld(fam.gate, 0, yG, { gate: true, force: true, lit: false });
  if (fam.wall) { b.wall(fam.wall[0], -xw, -gw / 2 + 4, yG, fam.wall[1]); b.wall(fam.wall[0], gw / 2 - 4, xw, yG, fam.wall[1]); }
  { const gp = Math.min(240, gw * 0.32), dk = b.ctx === 'demon';
    b.sp('lion_l', -gp / 2 - 30, yG + 70, { force: true }); b.sp('lion_r', gp / 2 + 30, yG + 70, { force: true });
    b.sp(dk ? 'banner_demon' : 'banner_sect', -gw / 2 - 40, yG + 40, { force: true }); b.sp(dk ? 'banner_demon' : 'banner_sect', gw / 2 + 40, yG + 40, { force: true, f: true });
    // 中轴石灯
    for (let y = yG - 220; y > yA + 380; y -= 260) for (const sx of [-1, 1]) b.sp('slantern', sx * 170, y, { force: true, f: sx > 0 });
    for (const sx of [-1, 1]) b.sp('slantern', sx * 170, (yA + yB) / 2, { force: true });
  }
  b.pave('road', 0, yG + 330, 300, 540, 340);
  // —— 前广场
  b.street(plaza, 0, yG + 120, 0, yC + 160, 260, 340);
  b.pave(plaza, 0, (yG + yA) / 2 + 40, 1500 * sc, yG - yA - 160, 360);
  const tp = major;
  const dy = yA + 290 * sc;
  b.decal(tp ? 'd_array' : (fam.decal ?? 'd_jade'), 0, dy, tp ? 440 : 480, tp ? 272 : 296);
  if (tp) b.doors.push({ x: 0, y: dy, fn: 'teleport', name: '传送阵' });
  if (tp && fam.decal) b.decal(fam.decal, -560, yA - 340, 360, 220);
  b.bld('b10', -620 * sc, yA + 300, { force: true }); b.bld('b10b', 620 * sc, yA + 300, { force: true });
  // —— 前殿排：议事殿 · 传功殿 · 丹房
  b.bld('b43', 0, yA, { force: true });
  b.bld('b44', -760, yA - 10, { fn: 'talisman', name: '传功阁' });
  b.bld('b08', 760, yA - 10, { fn: 'pill', name: '丹房' });
  b.street(plaza, -760, yA + 140, 760, yA + 140, 200, 340);
  // —— 中庭与主殿
  b.pave(plaza, 0, (yA + yB) / 2 - 20, 1200 * sc, yA - yB - 420, 360);
  b.bld(fam.hall, 0, yB, { force: true, fn: 'sect', name: '宗门事务' });
  b.bld('b07', -1000, yB - 20, { fn: 'talisman', name: '藏经阁' });
  b.bld('b37a', 1000, yB - 20, { fn: 'artifact', name: '法器阁' });
  b.street(plaza, -1000, yB + 140, 1000, yB + 140, 200, 340);
  // —— 后山：洞府、宝塔、凉亭
  if (!fam.noCave) {
    for (const x of [-560, -200, 200, 560]) b.bld('b42', x, yC, { fn: x === -200 ? 'rest' : undefined, name: x === -200 ? '洞府' : undefined, lit: false });
    b.street(plaza, -560, yC + 120, 560, yC + 120, 170, 340);
    for (let i = 0; i < 18; i++) b.tree(b.pick(trees), b.R(-950, 950), yC - b.R(200, 380), b.R(0.6, 0.8));
  } else b.bld(fam.quarters ?? 'b09', 0, yC, { fn: 'rest', name: '客舍' });
  b.bld('b12', 1150, yC + 40, {});
  b.bld(b.pick(['b11a', 'b11b']), -1150, yC + 60, {});
  // —— 西翼：弟子居所；东翼：灵田
  const q = fam.quarters ?? 'b09';
  for (const [i, y] of [yG - 260, yA - 380, yB - 420].entries()) b.bld(q, -xw + 330, y, { fn: i === 0 && fam.noCave ? undefined : undefined });
  b.street(plaza, -xw + 330, yG - 120, -xw + 330, yB - 300, 150, 340);
  if (loc.id !== 'lingshou') {
    b.bld('b41', xw - 330, yG - 260, { gate: true });
    for (const [fx, fy] of [[xw - 470, yA - 140], [xw - 190, yA - 140], [xw - 470, yA - 470], [xw - 190, yA - 470]]) b.decal(b.rnd() < 0.7 ? 'd_field' : 'd_flower', fx, fy, 270, 230);
  }
  if (loc.id !== 'yanyue' && loc.id !== 'hehuan') {
    b.bld('b40', -xw + 330, yA + 270, {});
    // 演武场：兵器架、木人桩、箭靶
    const tx = -xw + 330, ty = yA + 470;
    b.sp('weaponrack', tx - 170, ty); b.sp('dummy', tx + 10, ty + 10); b.sp('dummy', tx + 130, ty - 10); b.sp('target', tx + 260, ty);
  }
  if (b.ctx === 'demon') { b.sp('crystal_blood', 260, yG - 420); b.sp('crystal_blood', -260, yG - 400, { f: true }); b.sp('cauldron_dark', 0, yB + 200, { force: true }); }
  else b.sp('censer', 0, yB + 210, { force: true });
  b.sp('herbpot', xw - 620, yA - 140); b.sp('herbpot', xw - 620, yA - 470);
  fam.extra?.(b, { yG, yA, yB, yC, xw });
  b.bld('b23c', 1000, yA + 360, { fn: 'market', name: '坊市' });
  // 林木：山门外两侧与后山
  b.ring(0, (yG + yC) / 2, xw + 500, (yG - yC) / 2 + 500, 34, fam.trees ?? trees, [0.6, 0.85]);
  b.backTrees(yC - 380, -xw, xw, fam.trees ?? trees, 8, [0.6, 0.85]);
  for (let k = 0; k < 3; k++) b.smoke.push({ x: b.R(-600, 600), y: yB - 500 });
  b.flags.push({ x: -gw * 0.34, y: yG - 60, color: fam.v === 'dark' ? '#5a1a1a' : '#a8432f' }, { x: gw * 0.34, y: yG - 60, color: fam.v === 'dark' ? '#5a1a1a' : '#a8432f' });
  return { gw: xw * 2 + 1200, gh: yG - yC + 1700, cy: (yG + yC) / 2, rx: xw + 380, ry: (yG - yC) / 2 + 380 };
}

// ======================================================== 海岛
function shoreY(b: TB, from: number, max = 2200) { for (let y = from; y < max; y += 40) if (!b.site(0, y)) return y; return null; }
function isleTown(b: TB, loc: LocDef) {
  const major = !!loc.major;
  const P = 560, nR = major ? 2 : 1, W = major ? 2400 : 1700, xw = W / 2;
  const rows: number[] = []; for (let k = 0; k < nR; k++) rows.push(80 - k * P);
  const houses = ['x04a', 'x04b', 'x06', 'x05', 'x04a'];
  b.street('slab', 0, rows[0] + 460, 0, rows[nR - 1] + 140, 220);
  for (const y of rows) b.street('slab', -xw + 100, y + 140, xw - 100, y + 140, 200);
  if (loc.id === 'kuixing') b.bld('x10', 0, rows[0] + 470, { gate: true, force: true, lit: false });
  b.bld('x11', 0, rows[nR - 1], { force: true });
  const facW: { k: string; fn?: Fac; name?: string }[][] = [[{ k: 'b16', fn: 'pill' }, { k: 'x09b', fn: 'market' }], [{ k: 'b37a', fn: 'artifact' }]];
  const facE: { k: string; fn?: Fac; name?: string }[][] = [[{ k: 'b17', fn: 'rest' }, { k: 'x06', fn: 'tavern', name: '酒肆' }], [{ k: 'b37b', fn: 'talisman' }, ...(major ? [{ k: 'b38', fn: 'auction' as Fac }] : [])]];
  for (let r = 0; r < nR; r++) for (const dir of [-1, 1] as const) b.row(rows[r], dir * (r === nR - 1 ? b.w('x11') / 2 + 50 : 150), dir * (xw - 80), dir, houses, (dir < 0 ? facW[r] : facE[r]) ?? []);
  b.sp('notice', 220, rows[0] + 165, { force: true }); b.doors.push({ x: 220, y: rows[0] + 190, fn: 'board', name: '悬赏榜' });
  b.bld('x08', xw + 200, rows[0] - 200, {});
  const sy = shoreY(b, rows[0] + 300);
  if (sy !== null) { b.bld('x07', -200, sy + 120, { force: true, lit: false, depth: 60 }); if (major) b.bld('x13', 520, sy + 40, {}); b.street('slab', 0, rows[0] + 460, 0, sy - 20, 180); b.sp('barrels', 160, sy - 60); b.sp('crates', 300, sy - 50); b.sp('boat_s', -520, sy + 200, { force: true, solid: false }); }
  b.ring(0, rows[0] - 200, xw + 300, 700, 16, ['palm', 'palm', 'broad']);
  return { gw: W + 900, gh: 2200, cy: rows[0] - 200 };
}
function isleSmall(b: TB) {
  const n = 2 + Math.floor(b.rnd() * 3);
  b.pave('road', 0, 40, 900, 130, 340, false);
  b.spots.push({ x: -200, y: 40 }, { x: 200, y: 40 });
  b.link(b.node(-420, 40), b.node(420, 40));
  const xs = [-420, 0, 420, -800, 800];
  for (let i = 0; i < n; i++) b.bld(b.pick(['x04a', 'x04b', 'x05']), xs[i] + b.R(-30, 30), -30, { f: b.rnd() < 0.4 });
  const sy = shoreY(b, 200, 1600); if (sy !== null) { b.bld('x07', 0, sy + 120, { force: true, lit: false, depth: 60 }); b.sp('boat_s', -360, sy + 180, { force: true, solid: false }); b.sp('barrels', 150, sy - 50); }
  b.ring(0, 0, 800, 480, 10, ['palm', 'palm', 'broad']);
  return { gw: 2000, gh: 1600, cy: 0 };
}

// ======================================================== 入口
const TN_BORDER = new Set(['yuanwu']);
export function layoutTown2(loc: LocDef, L: LocLayout, env: Env, rnd: () => number, seed: number, pal: Pal, trees: Species[], isMajorTown: boolean): boolean {
  const t = loc.type, map = (loc as any).map ?? 'tiannan';
  const b = new TB(loc, env, rnd, seed);
  let r: { gw: number; gh: number; cy: number; rx?: number; ry?: number } | null = null;
  if (t === 'sect') {
    const fam = SECT_FAM[loc.id] ?? { gate: 'b04', hall: 'b01', wall: ['b13_strip', 108] as [string, number] };
    b.v = fam.v;
    b.ctx = fam.v === 'dark' ? 'demon' : 'sect';
    r = sect(b, loc, fam, !!loc.major, trees);
    if (L.barrier) L.barrier = { x: 0, y: r.cy / LS, rx: (r.rx ?? 2000) / LS, ry: (r.ry ?? 1800) / LS, color: L.barrier?.color ?? '#80c0e0' };
  } else if (t === 'city') {
    const st = loc.id === 'tianxing' ? CITY.star : map === 'dajin' ? CITY.dajin : TN_BORDER.has(loc.id) ? CITY.border : CITY.tiannan;
    const s2 = { ...st };
    if (loc.id === 'jinjing' || loc.id === 'yuejing') s2.palace = ['j02', 'j01'];
    if (loc.id === 'tianxing') s2.extra = (bb, o) => { bb.bld('x02', -760, o.rows[o.rows.length - 1] + 60, { force: true }); bb.bld('x02', 760, o.rows[o.rows.length - 1] + 60, { force: true }); };
    b.ctx = 'city';
    r = city(b, loc, s2, isMajorTown);
  } else if (t === 'town') {
    if (loc.minor) {
      const kind = map === 'luanxing' ? 'isle' : map === 'dajin' ? (env.cold > 0.45 ? 'snow' : 'north') : env.arid > 0.55 ? 'steppe' : env.cold > 0.6 ? 'snow' : 'farm';
      b.ctx = 'village'; r = village(b, kind);
    } else if (loc.id === 'mulan' || loc.id === 'tuwu') {
      b.ctx = 'village'; r = village(b, 'steppe');
      if (loc.id === 'tuwu') { b.bld('j18', -200, 560, { force: true, lit: false }); b.bld('j18', 220, 560, { force: true, lit: false }); }
      else { b.bld('t03', 0, -560, { force: true }); }
    } else if (loc.id === 'jin_fangshi') {
      r = town(b, loc, 'dajin', { big: true, auction: false });
      b.bld('j09a', -1200, -900, {}); b.bld('j09b', 1200, -900, {});
    } else {
      r = town(b, loc, map, { big: loc.id === 'tainan', auction: isMajorTown, fort: loc.id === 'yanling' ? 'f9' : (loc.id === 'yejia' || loc.id === 'caojia') ? 'j07' : undefined });
    }
  } else if (t === 'isle') {
    const fam = loc.id === 'jiyin' ? SECT_FAM.jiyin : loc.id === 'miaoyin' ? SECT_FAM.miaoyin : null;
    if (fam) { b.v = fam.v; b.ctx = fam.v === 'dark' ? 'demon' : 'sect'; r = sect(b, loc, fam, false, trees); if (L.barrier) L.barrier = { x: 0, y: r.cy / LS, rx: (r.rx ?? 2000) / LS, ry: (r.ry ?? 1800) / LS, color: L.barrier?.color ?? '#80c0e0' }; }
    else if (loc.minor) { b.ctx = 'isle'; r = isleSmall(b); }
    else { b.ctx = 'isle'; r = isleTown(b, loc); }
  }
  if (!r) return false;
  void pal;
  b.finish(L, r.gw, r.gh);
  return true;
}
