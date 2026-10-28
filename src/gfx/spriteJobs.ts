// 后台精灵生成调度：主线程把“山 / 树”的生成请求投给 Worker，结果到了再塞进 SpriteCache。
// Worker 不可用（Node 测试、老浏览器、file:// 限制等）时 ok=false，调用方走同步生成。
import type { SpriteJob, SpriteDone } from './sprite.worker';

export type SpriteReq = SpriteJob extends infer J ? (J extends SpriteJob ? Omit<J, 'id'> : never) : never;
type Req = SpriteReq;

class SpriteJobs {
  private w: Worker | null = null;
  private seq = 1;
  private cbs = new Map<number, { key: string; done: (r: SpriteDone) => void; t0: number }>();
  private inflight = new Set<string>();
  ok = false;
  /** 统计：完成数、平均耗时（ms，含排队） */
  done = 0; avgMs = 0; maxInflight = 3;

  constructor() {
    try {
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
      const oc = new OffscreenCanvas(1, 1);
      if (!oc.getContext('2d') || typeof (oc as OffscreenCanvas).transferToImageBitmap !== 'function') return;
      // 动态导入：Node 测试环境里根本不会走到这里（没有 Worker）
      import('./sprite.worker?worker&inline').then((m) => {
        const w = new m.default();
        w.onmessage = (e: MessageEvent<SpriteDone>) => this.onDone(e.data);
        w.onerror = (e) => { console.warn('精灵 Worker 出错，回退主线程生成', e.message); this.fail(); };
        this.w = w; this.ok = true;
      }).catch((e) => console.warn('精灵 Worker 不可用，回退主线程生成', e));
    } catch (e) { console.warn('精灵 Worker 不可用，回退主线程生成', e); this.ok = false; }
  }
  private fail() { this.ok = false; try { this.w?.terminate(); } catch { /* */ } this.w = null; for (const c of this.cbs.values()) c.done({ id: 0, w: 0, h: 0, ax: 0, ay: 0, err: 'worker failed' }); this.cbs.clear(); this.inflight.clear(); }
  private onDone(r: SpriteDone) {
    const c = this.cbs.get(r.id); if (!c) return;
    this.cbs.delete(r.id); this.inflight.delete(c.key);
    const ms = performance.now() - c.t0; this.done++; this.avgMs += (ms - this.avgMs) * 0.1;
    c.done(r);
  }
  busy(key: string) { return this.inflight.has(key); }
  get queued() { return this.inflight.size; }
  /** 投递；队列满或已在生成中返回 false */
  post(key: string, req: Req, done: (r: SpriteDone) => void): boolean {
    if (!this.ok || !this.w || this.inflight.has(key) || this.inflight.size >= this.maxInflight) return false;
    const id = this.seq++;
    this.inflight.add(key); this.cbs.set(id, { key, done, t0: performance.now() });
    this.w.postMessage({ id, ...req } as SpriteJob);
    return true;
  }
}

let inst: SpriteJobs | null = null;
export function spriteJobs(): SpriteJobs { return inst ??= new SpriteJobs(); }
