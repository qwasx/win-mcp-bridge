// 画布工厂：浏览器里用 document.createElement，Node 截图测试时可注入替代实现
export type AnyCanvas = HTMLCanvasElement;
export type Ctx = CanvasRenderingContext2D;

let factory: ((w: number, h: number) => AnyCanvas) | null = null;

export function setCanvasFactory(f: (w: number, h: number) => AnyCanvas) { factory = f; }

export function makeCanvas(w: number, h: number): AnyCanvas {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  if (factory) return factory(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 颜色工具（#rrggbb）
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r: number, g: number, b: number) {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/** k>0 提亮，k<0 压暗（-1..1） */
export function shade(hex: string, k: number) {
  const [r, g, b] = hexToRgb(hex);
  if (k >= 0) return rgbToHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
  return rgbToHex(r * (1 + k), g * (1 + k), b * (1 + k));
}
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
