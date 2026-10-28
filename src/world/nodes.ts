// 采集点：灵草、矿脉、灵泉。按格子哈希生成，只有神识范围内可见、可采。
import type { Terrain } from './terrain';
import { hash2, clamp } from '../core/rng';
import { itemDef } from '../data/items';
import { LOCATIONS, WORLD_SCALE } from '../data/world';

export const NODE_CELL = 900;
export type NodeKind = 'herb' | 'ore' | 'spring';
export interface GatherNode { key: string; kind: NodeKind; item: string; x: number; y: number; rare: boolean; seed: number }

const DEMON = ['tianmo', 'guiling', 'yuling', 'tiansha', 'yinluo', 'jiyin'];
function nearLoc(x: number, y: number, ids: string[] | ((t: string) => boolean), r: number) {
  for (const l of LOCATIONS) {
    const ok = Array.isArray(ids) ? ids.includes(l.id) : ids(l.type);
    if (ok && Math.hypot(l.x * WORLD_SCALE - x, l.y * WORLD_SCALE - y) < r) return true;
  }
  return false;
}

export class NodeField {
  terrain: Terrain;
  harvested = new Map<string, number>(); // key -> 可再生的日子
  private cache = new Map<string, GatherNode | null>();
  constructor(t: Terrain) { this.terrain = t; }

  private gen(cx: number, cy: number): GatherNode | null {
    const key = cx + ':' + cy;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const h0 = hash2(cx, cy, 901), h1 = hash2(cx, cy, 902), h2 = hash2(cx, cy, 903), h3 = hash2(cx, cy, 904), h4 = hash2(cx, cy, 905);
    let node: GatherNode | null = null;
    const x = (cx + 0.15 + h1 * 0.7) * NODE_CELL, y = (cy + 0.15 + h2 * 0.7) * NODE_CELL;
    const T = this.terrain;
    if (h0 < 0.62 && T.isLand(x, y) && !T.inLocZone(x, y, 80) && !T.onRoad(x, y)) {
      const s = T.sample(x, y);
      let kind: NodeKind = 'herb', item = 'herb_huangjing', rare = false;
      if (h3 < 0.05 && s.arid < 0.7) { kind = 'spring'; item = 'mat_lingquan'; rare = true; }
      else if (s.elev > 0.38 && h3 < 0.55) {
        kind = 'ore';
        item = h4 < 0.08 ? 'mat_xuantie' : h4 < 0.22 ? 'mat_xuanyu' : h4 < 0.48 ? 'mat_chitong' : 'mat_tiejing';
        rare = item === 'mat_xuantie';
      } else {
        const danger = nearLoc(x, y, (t) => t === 'danger' || t === 'secret', 3500);
        const demon = nearLoc(x, y, DEMON, 5000);
        if (s.cold > 0.5) item = h4 < 0.35 ? 'herb_xuelian' : h4 < 0.5 ? 'herb_bingpo' : 'herb_huangjing';
        else if (s.arid > 0.78) item = h4 < 0.1 ? 'herb_huolong' : 'herb_huangjing';
        else if (danger && h4 < 0.22) item = h4 < 0.11 ? 'herb_zihou' : 'herb_tianling';
        else if (demon && h4 < 0.3) item = 'herb_xuejing';
        else if (s.forest > 0.45) item = h4 < 0.35 ? 'herb_lingzhi' : h4 < 0.6 ? 'herb_jinxin' : h4 < 0.68 ? 'herb_nichang' : 'herb_huangjing';
        else item = h4 < 0.55 ? 'herb_huangjing' : h4 < 0.8 ? 'herb_jinxin' : 'herb_lingzhi';
        rare = itemDef(item).tier >= 2;
      }
      node = { key, kind, item, x, y, rare, seed: (cx * 7349 + cy * 1931) >>> 0 };
    }
    this.cache.set(key, node);
    if (this.cache.size > 4000) this.cache.clear();
    return node;
  }

  available(n: GatherNode, day: number) { const r = this.harvested.get(n.key); return r === undefined || day >= r; }

  /** 指定矩形内的采集点 */
  inRect(x0: number, y0: number, x1: number, y1: number): GatherNode[] {
    const out: GatherNode[] = [];
    for (let cy = Math.floor(y0 / NODE_CELL); cy <= Math.floor(y1 / NODE_CELL); cy++)
      for (let cx = Math.floor(x0 / NODE_CELL); cx <= Math.floor(x1 / NODE_CELL); cx++) {
        const n = this.gen(cx, cy); if (n) out.push(n);
      }
    return out;
  }

  nearest(x: number, y: number, r: number, day: number): GatherNode | null {
    let best: GatherNode | null = null, bd = r;
    for (const n of this.inRect(x - r, y - r, x + r, y + r)) {
      if (!this.available(n, day)) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** 采集：返回获得物 */
  harvest(n: GatherNode, day: number, herbMod: number, luck: number): { item: string; n: number; age?: number }[] {
    const h = hash2(n.seed, Math.floor(day), 77);
    const respawn = 90 + hash2(n.seed, 1, 5) * 270;
    this.harvested.set(n.key, day + respawn);
    const d = itemDef(n.item);
    const out: { item: string; n: number; age?: number }[] = [];
    if (n.kind === 'herb') {
      const base = d.herbBase ?? 10;
      const ancient = h < 0.05 + luck / 1000;
      const age = Math.round(base * (0.5 + Math.random() * 1.1) * (1 + herbMod) * (ancient ? 3 : 1));
      out.push({ item: n.item, n: 1 + (Math.random() < 0.35 + herbMod * 0.4 ? 1 : 0), age });
    } else if (n.kind === 'ore') {
      out.push({ item: n.item, n: 1 + Math.floor(Math.random() * 3) });
      if (Math.random() < 0.3) out.push({ item: 'mat_lingshi', n: 2 + Math.floor(Math.random() * 6) });
    } else {
      out.push({ item: 'mat_lingquan', n: 2 + Math.floor(Math.random() * 2) });
    }
    return out;
  }

  /** 附近灵泉（修炼加成） */
  springNear(x: number, y: number, r = 260) {
    for (const n of this.inRect(x - r, y - r, x + r, y + r)) if (n.kind === 'spring' && Math.hypot(n.x - x, n.y - y) < r) return n;
    return null;
  }

  toSave() { return [...this.harvested.entries()]; }
  fromSave(a: [string, number][] | undefined) { this.harvested = new Map(a ?? []); }
}

// ---------------- 绘制 ----------------
export function drawNode(g: CanvasRenderingContext2D, n: GatherNode, t: number, alpha: number, highlight: boolean) {
  const x = n.x, y = n.y;
  g.save();
  g.globalAlpha = alpha;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + n.seed);
  // 灵光
  const col = n.kind === 'herb' ? (n.rare ? '255,200,90' : '150,240,170') : n.kind === 'ore' ? (n.rare ? '200,170,255' : '190,220,255') : '140,220,255';
  const gr = g.createRadialGradient(x, y - 10, 0, x, y - 10, 46 + pulse * 10);
  gr.addColorStop(0, `rgba(${col},${0.42 + pulse * 0.2})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y - 10, 56, 0, Math.PI * 2); g.fill();
  if (n.kind === 'herb') {
    const d = itemDef(n.item);
    const leaf = n.item === 'herb_xuelian' ? '#e8f0f4' : n.item === 'herb_xuejing' ? '#9a2a30' : n.item === 'herb_huolong' ? '#c86a2a' : '#4f8a4a';
    g.strokeStyle = '#3a6a3a'; g.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.42 + Math.sin(t * 1.5 + k) * 0.05;
      g.fillStyle = leaf;
      g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9 - 2, 8, 3.2, a, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14 - 2); g.stroke();
    }
    // 花/果
    const fc = d.glyph === '花' ? '#c060c0' : d.glyph === '果' ? '#e04a2a' : d.glyph === '芝' ? '#b0402a' : d.glyph === '莲' ? '#f8f8ff' : '#e8d050';
    g.fillStyle = fc;
    if (d.glyph === '芝') { g.beginPath(); g.ellipse(x + 3, y - 14, 9, 5, 0, Math.PI, 0); g.fill(); g.fillStyle = '#6a3a2a'; g.fillRect(x + 2, y - 14, 2, 10); }
    else for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (k - 1) * 6, y - 18 - (k % 2) * 4 - pulse * 1.5, 3, 0, Math.PI * 2); g.fill(); }
  } else if (n.kind === 'ore') {
    g.fillStyle = '#7a7468'; g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x - 14, y - 16); g.lineTo(x + 4, y - 20); g.lineTo(x + 20, y - 8); g.lineTo(x + 22, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,26,20,0.8)'; g.lineWidth = 1.2; g.stroke();
    const cc = n.item === 'mat_chitong' ? '#d07040' : n.item === 'mat_xuantie' ? '#6a6aa0' : n.item === 'mat_xuanyu' ? '#a0e0c8' : '#c8d0d8';
    g.fillStyle = cc;
    for (let k = 0; k < 4; k++) { const px = x - 10 + k * 7, py = y - 8 - (k % 2) * 6; g.beginPath(); g.moveTo(px, py - 6); g.lineTo(px + 3, py); g.lineTo(px, py + 3); g.lineTo(px - 3, py); g.closePath(); g.fill(); }
    g.fillStyle = `rgba(255,255,255,${pulse})`; g.beginPath(); g.arc(x - 3 + pulse * 8, y - 14, 1.6, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = 'rgba(120,180,200,0.95)'; g.beginPath(); g.ellipse(x, y - 2, 30, 13, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a8478'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = `rgba(240,255,255,${0.5 + pulse * 0.4})`; g.lineWidth = 1;
    const r = (t * 14) % 24; g.beginPath(); g.ellipse(x, y - 2, r, r * 0.4, 0, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 3; k++) {
      const py = y - 10 - ((t * 20 + k * 14) % 40);
      g.fillStyle = `rgba(240,250,255,${0.35 * (1 - ((t * 20 + k * 14) % 40) / 40)})`;
      g.beginPath(); g.arc(x + Math.sin(t + k) * 8, py, 6, 0, Math.PI * 2); g.fill();
    }
  }
  if (highlight) {
    g.strokeStyle = `rgba(255,240,180,${0.6 + pulse * 0.4})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, 30, 12, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

export { clamp };
