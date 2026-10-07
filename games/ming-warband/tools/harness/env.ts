// 无头截图环境：jsdom + @napi-rs/canvas，让 Phaser.CANVAS 能在 Node 中渲染。
// 用法见 tools/harness/README.md
import { JSDOM } from 'jsdom';
import { createCanvas, Image as NImage } from '@napi-rs/canvas';

const W = Number(process.env.SHOT_W ?? 1280), H = Number(process.env.SHOT_H ?? 760);
const dom = new JSDOM('<!doctype html><html><body><div id="game"></div><div id="night"></div><div id="ui"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
});
const w: any = dom.window;
const G: any = globalThis;

// ---- canvas 桥接 ----
const napiOf = new WeakMap<object, any>();
const CanvasProto = w.HTMLCanvasElement.prototype;
const wDesc = Object.getOwnPropertyDescriptor(CanvasProto, 'width')!;
const hDesc = Object.getOwnPropertyDescriptor(CanvasProto, 'height')!;
function napi(el: any) {
  let c = napiOf.get(el);
  if (!c) { c = createCanvas(Math.max(1, wDesc.get!.call(el)), Math.max(1, hDesc.get!.call(el))); napiOf.set(el, c); }
  return c;
}
Object.defineProperty(CanvasProto, 'width', {
  get() { const c = napiOf.get(this); return c ? c.width : wDesc.get!.call(this); },
  set(v) { wDesc.set!.call(this, v); const c = napiOf.get(this); if (c) c.width = Math.max(1, v | 0); },
});
Object.defineProperty(CanvasProto, 'height', {
  get() { const c = napiOf.get(this); return c ? c.height : hDesc.get!.call(this); },
  set(v) { hDesc.set!.call(this, v); const c = napiOf.get(this); if (c) c.height = Math.max(1, v | 0); },
});
CanvasProto.getContext = function (type: string) {
  if (type !== '2d') return null;
  const ctx = napi(this).getContext('2d');
  (ctx as any).canvas2 = this;
  return ctx;
};
CanvasProto.toDataURL = function (type?: string, q?: number) { return napi(this).toDataURL(type ?? 'image/png', q); };
CanvasProto.toBlob = function (cb: any) { cb(null); };

const unwrap = (img: any) => (img && napiOf.has(img) ? napiOf.get(img) : img && img.__nimg ? img.__nimg : img);
const ctxProto = Object.getPrototypeOf(createCanvas(1, 1).getContext('2d'));
const origDraw = ctxProto.drawImage;
ctxProto.drawImage = function (img: any, ...a: any[]) {
  const u = unwrap(img);
  if (!u || (u.width === 0 && u.height === 0)) return;
  try { return origDraw.call(this, u, ...a); } catch { /* 忽略无效图像 */ }
};
const origPat = ctxProto.createPattern;
ctxProto.createPattern = function (img: any, rep: any) { return origPat.call(this, unwrap(img), rep); };
// Phaser 通过 ctx.canvas 回取元素
w.CanvasRenderingContext2D = G.CanvasRenderingContext2D = ctxProto.constructor;

// ---- 全局 ----
G.__napiOf = (el: any) => napi(el);
G.__W = W; G.__H = H;
G.window = w; G.document = w.document;
Object.defineProperty(G, 'navigator', { value: w.navigator, configurable: true, writable: true });
G.screen = { width: W, height: H, availWidth: W, availHeight: H, orientation: { type: 'landscape-primary' } };
w.screen = G.screen;
w.innerWidth = W; w.innerHeight = H;
G.Image = NImage; w.Image = NImage;
G.localStorage = w.localStorage;
G.requestAnimationFrame = w.requestAnimationFrame.bind(w);
G.cancelAnimationFrame = w.cancelAnimationFrame.bind(w);
G.getComputedStyle = w.getComputedStyle.bind(w);
G.addEventListener = w.addEventListener.bind(w);
G.removeEventListener = w.removeEventListener.bind(w);
G.devicePixelRatio = 1; w.devicePixelRatio = 1;
G.focus = () => {}; w.focus = () => {};
for (const k of ['HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'HTMLInputElement', 'HTMLDivElement', 'HTMLAudioElement',
  'SVGElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'WheelEvent', 'PointerEvent', 'FocusEvent', 'TouchEvent', 'CustomEvent',
  'XMLHttpRequest', 'DOMParser', 'Blob', 'URL', 'MutationObserver']) {
  if (w[k] && !G[k]) G[k] = w[k];
}
// napi Image 没有 addEventListener，Phaser 的纹理加载用 onload，足够
export { dom };
