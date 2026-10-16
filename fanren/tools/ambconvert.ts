// 第二十五步：野外动物画材转换（裁边、按世界尺寸 ×1.6 存 webp）
// 用法：npx tsx tools/ambconvert.ts /tmp/af/fanren/art-incoming/full
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
const ROOT = process.argv[2] || '/tmp/af/fanren/art-incoming/full';
// 世界尺寸（主角约 108 高）：w = 宽 或 h = 高
const A: Record<string, { w?: number; h?: number }> = {
  deer: { h: 82 }, rabbit: { w: 36 }, snowfox: { w: 54 }, monkey: { h: 48 }, egret: { h: 72 }, crane_idle: { h: 98 }, crane_fly: { w: 120 },
  camel: { h: 135 }, yak: { w: 120 }, carp_a: { w: 34 }, carp_b: { w: 30 }, turtle: { w: 40 }, seagull: { w: 56 },
  chicken: { h: 30 }, dog: { h: 46 }, duck: { w: 40 }, horse: { h: 110 }, ox: { w: 130 }, sheep: { w: 62 },
};
function alphaBox(d: Uint8ClampedArray, W: number, H: number) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 14) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
(async () => {
  mkdirSync('src/assets/amb', { recursive: true });
  const dims: string[] = [], imps: string[] = [], src: string[] = [];
  let i = 0;
  for (const [k, s] of Object.entries(A)) {
    const f = join(ROOT, 'ambient', `amb_${k.includes('_') && (k.startsWith('crane') ) ? k : k + '_idle'}.png`);
    const im = await loadImage(readFileSync(f));
    const W = im.width, H = im.height, c0 = createCanvas(W, H), g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0);
    const b = alphaBox(g0.getImageData(0, 0, W, H).data as unknown as Uint8ClampedArray, W, H)!;
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    const ww = s.w ?? Math.round(s.h! * bw / bh), wh = s.h ?? Math.round(s.w! * bh / bw);
    const R = 1.6, cw = Math.max(4, Math.round(ww * R)), ch = Math.max(4, Math.round(wh * R));
    const c = createCanvas(cw, ch), g = c.getContext('2d'); g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
    g.drawImage(c0, b.x0, b.y0, bw, bh, 0, 0, cw, ch);
    writeFileSync(`src/assets/amb/${k}.webp`, await c.encode('webp', 86));
    dims.push(`  ${k}: { w: ${ww}, h: ${wh} },`); imps.push(`import a${i} from '../assets/amb/${k}.webp?inline';`); src.push(`  ${k}: a${i},`); i++;
  }
  writeFileSync('src/gfx/ambData.ts', `// 第二十五步：野外动物画材（外部 AI 绘制；tools/ambconvert.ts 生成，勿手改）\n${imps.join('\n')}\nexport const AMB_SRC: Record<string, string> = {\n${src.join('\n')}\n};\n`);
  writeFileSync('src/gfx/ambDims.ts', `// 第二十五步：野外动物世界尺寸（tools/ambconvert.ts 生成，勿手改）\nexport const AMB_DIM: Record<string, { w: number; h: number }> = {\n${dims.join('\n')}\n};\n`);
  console.log('amb', i);
})();
