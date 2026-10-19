// 程序化位图缓存：LRU（按像素预算）+ 每帧限时生成 + 分辨率分档 + 低清回退
/** canvas 可能是 ImageBitmap（Worker 生成），只能用于 drawImage / 纹理上传 */
export interface Spr { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }
import { spriteJobs } from './spriteJobs';
import type { SpriteDone } from './sprite.worker';
type Req = Parameters<ReturnType<typeof spriteJobs>['post']>[1];
interface Entry { s: Spr; px: number; used: number; base: string; res: number }

const RES_STEPS = [0.2, 0.35, 0.5, 0.75, 1, 1.4, 2];
export function resBucket(want: number, max = 2) {
  const w = Math.min(want, max);
  for (const r of RES_STEPS) if (r >= w * 0.92) return Math.min(r, max);
  return Math.min(RES_STEPS[RES_STEPS.length - 1], max);
}

export class SpriteCache {
  private map = new Map<string, Entry>();
  private byBase = new Map<string, Set<string>>();
  private pixels = 0;
  frame = 0;
  budgetPx: number;
  private frameStart = 0; private builtThisFrame = 0;
  frameMs = 7;
  unlimited = false;
  pending = 0;

  constructor(budgetPx = 26e6) { this.budgetPx = budgetPx; }

  beginFrame() { this.frame++; this.frameStart = performance.now(); this.builtThisFrame = 0; this.pending = 0; }

  canBuild() {
    if (this.builtThisFrame === 0) return true;
    return performance.now() - this.frameStart < this.frameMs;
  }

  /**
   * 后台生成版：命中缓存直接返回；否则把请求投给 Worker，先返回同对象其他分辨率（若有）或 null，
   * 生成好后自动入缓存（onReady 可附带元数据）。Worker 不可用时退回同步 get()。
   */
  getAsync(base: string, res: number, req: (res: number) => Req, make: (res: number) => Spr, onReady?: (r: SpriteDone) => void): Spr | null {
    const J = spriteJobs();
    if (!J.ok) return this.get(base, res, make);
    const key = base + '@' + res;
    const e = this.map.get(key);
    if (e) { e.used = this.frame; return e.s; }
    if (!J.busy(key)) {
      J.post(key, req(res), (r) => {
        if (r.err || !r.bmp) { if (r.err) console.warn('精灵生成失败', key, r.err); return; }
        onReady?.(r);
        this.put(key, base, res, { canvas: r.bmp as unknown as HTMLCanvasElement, w: r.w, h: r.h, ax: r.ax, ay: r.ay });
      });
    }
    this.pending++;
    return this.fallback(base, res);
  }
  private put(key: string, base: string, res: number, s: Spr) {
    const old = this.map.get(key); if (old) { this.pixels -= old.px; }
    const px = s.canvas.width * s.canvas.height;
    this.map.set(key, { s, px, used: this.frame, base, res });
    let set = this.byBase.get(base); if (!set) { set = new Set(); this.byBase.set(base, set); }
    set.add(key);
    this.pixels += px;
    if (this.pixels > this.budgetPx) this.evict();
  }
  private fallback(base: string, res: number): Spr | null {
    const set = this.byBase.get(base);
    if (!set) return null;
    let best: Entry | null = null;
    for (const k of set) { const o = this.map.get(k); if (o && (!best || Math.abs(o.res - res) < Math.abs(best.res - res))) best = o; }
    if (best) { best.used = this.frame; return best.s; }
    return null;
  }

  /** 取得 base@res 的位图；若本帧预算耗尽，返回同 base 的其他分辨率（若有），否则 null */
  get(base: string, res: number, make: (res: number) => Spr, urgent = false): Spr | null {
    const key = base + '@' + res;
    const e = this.map.get(key);
    if (e) { e.used = this.frame; return e.s; }
    if (urgent || this.canBuild()) {
      const t0 = performance.now();
      const s = make(res);
      this.builtThisFrame++;
      this.frameStart -= 0; void t0;
      const px = s.canvas.width * s.canvas.height;
      const ent: Entry = { s, px, used: this.frame, base, res };
      this.map.set(key, ent);
      let set = this.byBase.get(base); if (!set) { set = new Set(); this.byBase.set(base, set); }
      set.add(key);
      this.pixels += px;
      if (this.pixels > this.budgetPx) this.evict();
      return s;
    }
    this.pending++;
    // 回退：同一对象的其他分辨率
    const set = this.byBase.get(base);
    if (set) {
      let best: Entry | null = null;
      for (const k of set) { const o = this.map.get(k); if (o && (!best || Math.abs(o.res - res) < Math.abs(best.res - res))) best = o; }
      if (best) { best.used = this.frame; return best.s; }
    }
    return null;
  }

  has(base: string) { return !!this.byBase.get(base)?.size; }
  /** 第三十八步：只查不建——精确分辨率 */
  peek(base: string, res: number): Spr | null { const e = this.map.get(base + '@' + res); if (e) { e.used = this.frame; return e.s; } return null; }
  /** 同一对象最接近 res 的已有版本（含其分辨率） */
  best(base: string, res: number): { s: Spr; res: number } | null {
    const set = this.byBase.get(base); if (!set) return null;
    let b: Entry | null = null;
    for (const k of set) { const o = this.map.get(k); if (o && (!b || Math.abs(o.res - res) < Math.abs(b.res - res))) b = o; }
    if (!b) return null; b.used = this.frame; return { s: b.s, res: b.res };
  }
  /** 外部（分帧）建好的放进缓存 */
  adopt(base: string, res: number, s: Spr) { this.put(base + '@' + res, base, res, s); }

  private evict() {
    const arr = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of arr) {
      if (this.pixels <= this.budgetPx * 0.8) break;
      if (e.used >= this.frame - 1) continue; // 正在使用
      this.map.delete(k);
      this.byBase.get(e.base)?.delete(k);
      this.pixels -= e.px;
      // 释放 GPU/内存
      try { const c = e.s.canvas as unknown as { close?: () => void; width: number; height: number }; if (typeof c.close === 'function') c.close(); else { c.width = 0; c.height = 0; } } catch { /* */ }
    }
  }

  clearBase(prefix: string) {
    for (const [k, e] of [...this.map.entries()]) if (e.base.startsWith(prefix)) { this.map.delete(k); this.byBase.get(e.base)?.delete(k); this.pixels -= e.px; }
  }
  get stats() { return { n: this.map.size, mpx: +(this.pixels / 1e6).toFixed(1) }; }
}

export const sprites = new SpriteCache();
