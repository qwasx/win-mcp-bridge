// Node 截图环境：注入画布工厂与 Path2D
import { createCanvas, Path2D, GlobalFonts } from '@napi-rs/canvas';
import { setCanvasFactory } from '../src/core/canvas';
import { register } from 'node:module';
// 素材（图片 / 音频 / 字体，含 ?inline）在 Node 里替换为空导出，测试只关心逻辑
register('./asset-stub.mjs', import.meta.url);
(globalThis as any).Path2D = Path2D;
setCanvasFactory((w, h) => createCanvas(w, h) as any);
(globalThis as any).document = {
  createElement: (t: string) => { if (t === 'canvas') { const c: any = createCanvas(1, 1); return c; } return {}; },
  fonts: { check: () => true, load: () => Promise.resolve() },
};
export { createCanvas, GlobalFonts };
import { writeFileSync } from 'fs';
export function save(c: any, name: string) { writeFileSync(new URL('./out/' + name, import.meta.url), c.toBuffer('image/png')); console.log('saved', name); }
