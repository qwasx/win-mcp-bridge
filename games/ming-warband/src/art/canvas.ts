// 程序化美术的通用工具：画布工厂与颜色函数
export type Ctx = CanvasRenderingContext2D;
export type Canvas = HTMLCanvasElement;

let factory: (w: number, h: number) => Canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
/** 测试环境下可替换为 node 画布 */
export function setCanvasFactory(f: (w: number, h: number) => Canvas) { factory = f; }
export function makeCanvas(w: number, h: number): Canvas { return factory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

export function rgb(c: number): [number, number, number] { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
export function css(c: number, a = 1) { const [r, g, b] = rgb(c); return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`; }
export function mix(a: number, b: number, t: number) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return (Math.round(r1 + (r2 - r1) * t) << 16) | (Math.round(g1 + (g2 - g1) * t) << 8) | Math.round(b1 + (b2 - b1) * t);
}
/** k>0 变亮，k<0 变暗 */
export function shade(c: number, k: number) { return k >= 0 ? mix(c, 0xffffff, k) : mix(c, 0x000000, -k); }
export function desat(c: number, k: number) {
  const [r, g, b] = rgb(c); const l = (r * 0.3 + g * 0.59 + b * 0.11) | 0;
  return mix(c, (l << 16) | (l << 8) | l, k);
}

/** 可复现的伪随机 */
export function srand(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export const OUTLINE = '#1c130b';
