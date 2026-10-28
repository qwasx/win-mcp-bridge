// Node 截图环境：注入画布工厂与 Path2D
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { setCanvasFactory } from '../src/core/canvas';
(globalThis as any).Path2D = Path2D;
setCanvasFactory((w, h) => createCanvas(w, h) as any);
(globalThis as any).document = {
  createElement: (t: string) => { if (t === 'canvas') { const c: any = createCanvas(1, 1); return c; } return {}; },
  fonts: { check: () => true, load: () => Promise.resolve() },
};
export { createCanvas, GlobalFonts };
import { writeFileSync } from 'fs';
export function save(c: any, name: string) { writeFileSync(new URL('./out/' + name, import.meta.url), c.toBuffer('image/png')); console.log('saved', name); }
