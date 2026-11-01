// 建筑贴图：按需异步加载（Node 测试环境没有 Image，自动跳过，继续用程序绘制）
import type { Pal } from './building';

const imgs = new Map<string, HTMLImageElement>();
let started = false;
let onReady: (() => void) | null = null;

/** 开始加载；全部就绪后回调（用于清掉已缓存的程序绘制版本） */
export function loadBldTex(cb: () => void) {
  onReady = cb;
  if (started || typeof Image === 'undefined') return;
  started = true;
  import('./bldTexData').then(({ BLD_SRC }) => {
    const names = Object.keys(BLD_SRC);
    let left = names.length;
    for (const n of names) {
      const im = new Image();
      im.onload = () => { imgs.set(n, im); if (--left === 0) onReady?.(); };
      im.onerror = () => { console.warn('建筑贴图加载失败', n); if (--left === 0) onReady?.(); };
      im.src = BLD_SRC[n];
    }
  }).catch((e) => console.warn('建筑贴图不可用', e));
}
export function bldTex(name: string): HTMLImageElement | null { return imgs.get(name) ?? null; }

const lum = (hex: string) => { const v = parseInt(hex.slice(1), 16); return (((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) / 255; };
const rgb = (hex: string) => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
/** 按配色选殿宇贴图家族：魔道（暗）/ 青绿琉璃 / 粉紫 / 灰瓦 */
export function hallFamily(pal: Pal): string {
  const [r, g, b] = rgb(pal.roof);
  if (lum(pal.wall) < 0.4 || (lum(pal.roof) < 0.16 && lum(pal.wall) < 0.6)) return 'hall_dark';
  if (g > r + 12 && g >= b - 10) return 'hall_jade';
  if (b > g + 12 && r > g + 8) return 'hall_rose';
  return 'hall_grey';
}
/** 暗色宗门里的普通房屋压暗，粉紫宗门略带粉调 */
export function houseFilter(pal: Pal): string {
  const f = hallFamily(pal);
  return f === 'hall_dark' ? 'brightness(0.62) saturate(0.7) sepia(0.15)' : f === 'hall_rose' ? 'hue-rotate(-12deg) saturate(1.05)' : 'none';
}
