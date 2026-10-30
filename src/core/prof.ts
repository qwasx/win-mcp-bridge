// 第三十八步：分项计时（F3 面板 + 自动化剖析共用）。关闭时每个计时点只是一次布尔判断，零开销。
//   const t = prof.t();  …  prof.add('树', t);
// 每帧结束调用 prof.endFrame(帧时)：累计平均、并在 >50ms 的长帧里记下当帧最贵的三项（卡顿归因）。
type Rec = { k: string; ms: number };
class Prof {
  on = false;
  frames = 0;
  private acc = new Map<string, number>();
  private cnt = new Map<string, number>();
  private cur = new Map<string, number>();
  spikes: { ms: number; top: Rec[]; at: number }[] = [];
  t(): number { return this.on ? performance.now() : 0; }
  add(k: string, t0: number, n = 1) {
    if (!this.on) return;
    const d = performance.now() - t0;
    this.cur.set(k, (this.cur.get(k) ?? 0) + d);
    if (n) this.cnt.set(k, (this.cnt.get(k) ?? 0) + n);
  }
  /** 直接累计一段已知耗时 */
  addMs(k: string, ms: number, n = 1) { if (!this.on) return; this.cur.set(k, (this.cur.get(k) ?? 0) + ms); if (n) this.cnt.set(k, (this.cnt.get(k) ?? 0) + n); }
  endFrame(frameMs: number) {
    if (!this.on) return;
    this.frames++;
    for (const [k, v] of this.cur) this.acc.set(k, (this.acc.get(k) ?? 0) + v);
    if (frameMs > 50) {
      const top = [...this.cur].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, ms]) => ({ k, ms: +ms.toFixed(1) }));
      this.spikes.push({ ms: Math.round(frameMs), top, at: Math.round(performance.now() / 1000) });
      if (this.spikes.length > 12) this.spikes.shift();
    }
    this.cur.clear();
  }
  /** 每帧平均耗时（毫秒）从高到低；n = 每帧平均次数 */
  report(limit = 40): { k: string; ms: number; n: number }[] {
    const F = Math.max(1, this.frames);
    return [...this.acc].map(([k, v]) => ({ k, ms: +(v / F).toFixed(2), n: +((this.cnt.get(k) ?? 0) / F).toFixed(1) })).sort((a, b) => b.ms - a.ms).slice(0, limit);
  }
  reset() { this.frames = 0; this.acc.clear(); this.cnt.clear(); this.cur.clear(); this.spikes = []; }
  /** 文本报告（F3 面板「复制」按钮） */
  text(extra = '') {
    const r = this.report(60).map((x) => `${x.k.padEnd(10, '　')} ${x.ms.toFixed(2).padStart(6)}ms  ×${x.n}`).join('\n');
    const s = this.spikes.map((x) => `${x.ms}ms ← ${x.top.map((y) => `${y.k} ${y.ms}`).join(' / ')}`).join('\n');
    return `${extra}\n—— 每帧平均（${this.frames} 帧）——\n${r}\n—— 长帧（>50ms）归因 ——\n${s || '（无）'}`;
  }
}
export const prof = new Prof();
if (typeof window !== 'undefined') (window as any).__prof = prof;
