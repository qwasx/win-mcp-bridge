// 第二十二步：城镇空间 —— 建筑碰撞、门（直达商铺）、街巷导航（行人与 NPC 走街而不穿墙）
import { LOCATIONS, WORLD_SCALE, LocDef } from '../data/world';
import { getLayout, LOC_SCALE, LocLayout } from '../gfx/building';
import type { Door } from '../gfx/townLayout';

interface Near { l: LocDef; L: LocLayout; ox: number; oy: number }

export class TownSpace {
  near: Near[] = [];
  private t = 0;
  private cx = 1e12; private cy = 1e12;
  doorFocus: { door: Door; loc: LocDef; x: number; y: number; d: number } | null = null;

  /** 每帧：附近有贴图布局的地点（半秒刷新一次） */
  update(dt: number, px: number, py: number) {
    this.t -= dt;
    if (this.t <= 0 || Math.abs(px - this.cx) > 1500 || Math.abs(py - this.cy) > 1500) {
      this.t = 0.5; this.cx = px; this.cy = py;
      this.near = [];
      for (const l of LOCATIONS) {
        const ox = l.x * WORLD_SCALE, oy = l.y * WORLD_SCALE;
        if (Math.abs(ox - px) > 7000 || Math.abs(oy - py) > 7000) continue;
        const L = getLayout(l);
        if (!L.v2) continue;
        if (Math.abs(ox - px) > L.gw * LOC_SCALE * 0.6 + 600 || Math.abs(oy - py) > L.gh * LOC_SCALE * 0.6 + 600) continue;
        this.near.push({ l, L, ox, oy });
      }
    }
    // 门：脚下最近的一扇
    let best: TownSpace['doorFocus'] = null;
    for (const n of this.near) for (const d of n.L.doors ?? []) {
      const x = n.ox + d.x * LOC_SCALE, y = n.oy + d.y * LOC_SCALE;
      const r = d.fn === 'teleport' ? 230 : 120;
      const dd = Math.hypot((x - px) * 0.9, (y - py) * 1.3);
      if (dd < r && (!best || dd < best.d)) best = { door: d, loc: n.l, x, y, d: dd };
    }
    this.doorFocus = best;
  }

  /** 世界点是否被建筑 / 城墙挡住 */
  blocked(x: number, y: number): boolean {
    for (const n of this.near) {
      const lx = (x - n.ox) / LOC_SCALE, ly = (y - n.oy) / LOC_SCALE;
      if (Math.abs(lx) > n.L.gw * 0.6 || Math.abs(ly) > n.L.gh * 0.6) continue;
      for (const b of n.L.blocks) if (lx > b.x && lx < b.x + b.w && ly > b.y && ly < b.y + b.h) return true;
    }
    return false;
  }

  /** 某地点的街巷落脚点（世界坐标）；无贴图布局时返回 null */
  spot(l: LocDef, rnd: () => number = Math.random): { x: number; y: number } | null {
    const L = getLayout(l);
    if (!L.v2 || !L.spots?.length) return null;
    const s = L.spots[Math.floor(rnd() * L.spots.length)];
    return { x: l.x * WORLD_SCALE + s.x * LOC_SCALE + (rnd() - 0.5) * 60, y: l.y * WORLD_SCALE + s.y * LOC_SCALE + (rnd() - 0.5) * 40 };
  }

  /** 沿街巷从 a 走到 b：返回途经点（世界坐标，不含起点）；不在城里则 null */
  route(ax: number, ay: number, bx: number, by: number): [number, number][] | null {
    for (const n of this.near) {
      const nav = n.L.nav; if (!nav || nav.pts.length < 4) continue;
      const toL = (x: number, y: number) => [(x - n.ox) / LOC_SCALE, (y - n.oy) / LOC_SCALE];
      const [alx, aly] = toL(ax, ay), [blx, bly] = toL(bx, by);
      if (Math.abs(alx) > n.L.gw * 0.55 || Math.abs(aly) > n.L.gh * 0.55) continue;
      const nearest = (x: number, y: number) => { let bi = -1, bd = 1e18; for (let i = 0; i < nav.pts.length; i += 2) { const d = (nav.pts[i] - x) ** 2 + (nav.pts[i + 1] - y) ** 2; if (d < bd) { bd = d; bi = i / 2; } } return bi; };
      const s = nearest(alx, aly), e = nearest(blx, bly);
      if (s < 0 || e < 0) return null;
      const prev = new Int32Array(nav.adj.length).fill(-2); prev[s] = -1;
      const q = [s];
      while (q.length) { const c = q.shift()!; if (c === e) break; for (const nb of nav.adj[c]) if (prev[nb] === -2) { prev[nb] = c; q.push(nb); } }
      if (prev[e] === -2) return null;
      const path: [number, number][] = [];
      for (let c = e; c >= 0; c = prev[c]) path.unshift([n.ox + nav.pts[c * 2] * LOC_SCALE, n.oy + nav.pts[c * 2 + 1] * LOC_SCALE]);
      path.push([bx, by]);
      return path;
    }
    return null;
  }

  /** 行人：在某地点街巷上随机一条路线 */
  wander(l: LocDef, from?: { x: number; y: number }): [number, number][] | null {
    const L = getLayout(l);
    const nav = L.nav; if (!L.v2 || !nav || nav.pts.length < 4) return null;
    const ox = l.x * WORLD_SCALE, oy = l.y * WORLD_SCALE, n = nav.pts.length / 2;
    let s = Math.floor(Math.random() * n);
    if (from) { let bd = 1e18; for (let i = 0; i < n; i++) { const d = (ox + nav.pts[i * 2] * LOC_SCALE - from.x) ** 2 + (oy + nav.pts[i * 2 + 1] * LOC_SCALE - from.y) ** 2; if (d < bd) { bd = d; s = i; } } }
    const e = Math.floor(Math.random() * n);
    const prev = new Int32Array(n).fill(-2); prev[s] = -1;
    const q = [s];
    while (q.length) { const c = q.shift()!; if (c === e) break; for (const nb of nav.adj[c]) if (prev[nb] === -2) { prev[nb] = c; q.push(nb); } }
    if (prev[e] === -2) return null;
    const path: [number, number][] = [];
    for (let c = e; c >= 0; c = prev[c]) path.unshift([ox + nav.pts[c * 2] * LOC_SCALE + (Math.random() - 0.5) * 70, oy + nav.pts[c * 2 + 1] * LOC_SCALE + (Math.random() - 0.5) * 50]);
    return path;
  }
}
