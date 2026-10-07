// 大地图静态内容的生成：驿道、田地、装饰物
import type { Settlement } from '../core/state';
import { findPath, renderMapCanvas, computeDecorations, WORLD_W, WORLD_H, type Deco } from '../core/terrain';
import { buildDecoAtlas, MRES } from './mapArt';
import { makeCanvas, srand } from './canvas';

type P = [number, number];

export function computeRoads(settlements: Settlement[]): P[][] {
  const hubs = settlements.filter(s => s.kind !== 'village');
  const pairs = new Set<string>();
  const roads: P[][] = [];
  for (const a of hubs) {
    const near = hubs.filter(b => b !== a).map(b => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) })).sort((x, y) => x.d - y.d).slice(0, 2);
    for (const { b, d } of near) {
      if (d > 520) continue;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      const path = findPath(a.x, a.y, b.x, b.y);
      if (path && path.length) roads.push([[a.x, a.y], ...path]);
    }
  }
  for (const v of settlements) {
    if (v.kind !== 'village' || !v.parent) continue;
    const p = settlements.find(s => s.id === v.parent);
    if (!p) continue;
    if (Math.hypot(p.x - v.x, p.y - v.y) > 260) continue;
    const path = findPath(v.x, v.y, p.x, p.y);
    if (path && path.length) roads.push([[v.x, v.y], ...path]);
  }
  return roads;
}

let cache: { key: string; canvas: HTMLCanvasElement; decos: Deco[]; full: HTMLCanvasElement } | null = null;

export function worldVisuals(settlements: Settlement[], key: string) {
  if (cache && cache.key === key) return cache;
  const roads = computeRoads(settlements);
  const canvas = renderMapCanvas(0.5, {
    roads,
    villages: settlements.filter(s => s.kind === 'village').map(s => [s.x, s.y] as P),
    towns: settlements.filter(s => s.kind === 'town').map(s => [s.x, s.y] as P),
  });
  const avoid = settlements.map(s => ({ x: s.x, y: s.y + (s.kind === 'town' ? -4 : 0), r: s.kind === 'town' ? 40 : s.kind === 'castle' ? 26 : 22 }));
  const decos = computeDecorations(avoid);
  const full = bakeWorld(canvas, decos);
  cache = { key, canvas, decos, full };
  return cache;
}

/** 把底图（放大）+ 纸张纹理 + 装饰物烘焙成 1:1 的整张地图 */
export function bakeWorld(base: HTMLCanvasElement, decos: Deco[], scale = 1): HTMLCanvasElement {
  const W = Math.round(WORLD_W * scale), H = Math.round(WORLD_H * scale);
  const cv = makeCanvas(W, H) as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, W, H);
  // 纸张颗粒
  const tile = makeCanvas(128, 128) as HTMLCanvasElement;
  const tctx = tile.getContext('2d')!;
  const img = tctx.createImageData(128, 128);
  const r = srand(99);
  for (let i = 0; i < img.data.length; i += 4) { const v = 110 + r() * 40; img.data[i] = v; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.85; img.data[i + 3] = 255; }
  tctx.putImageData(img, 0, 0);
  const pat = ctx.createPattern(tile, 'repeat');
  if (pat) { ctx.globalAlpha = 0.07; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // 装饰物
  const atlas = buildDecoAtlas();
  const fm = new Map(atlas.frames.map(f => [f.name, f]));
  const k = scale / MRES;
  for (const d of decos) {
    const f = fm.get(d.f); if (!f) continue;
    const w = f.w * k, h = f.h * k;
    ctx.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, d.x * scale - f.ax * w, d.y * scale - f.ay * h, w, h);
  }
  return cv;
}
