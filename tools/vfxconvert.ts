// 第二十四步：法术特效关键形态图 + 法术图标 画材转换
// 用法：npx tsx tools/vfxconvert.ts /tmp/af/fanren/art-incoming/full
// 产出：src/assets/vfx/*.webp（256px，保留原画布，中心对齐）+ src/gfx/vfxData.ts；src/assets/skills/*.webp（96px）+ src/gfx/skillIconData.ts
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
const ROOT = process.argv[2] || '/tmp/af/fanren/art-incoming/full';
(async () => {
  mkdirSync('src/assets/vfx', { recursive: true }); mkdirSync('src/assets/skills', { recursive: true });
  const conv = async (dir: string, out: string, S: number, q: number, rename: (f: string) => string, varp: string) => {
    const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.png') && !f.includes('preview')).sort();
    const ii: string[] = [], is: string[] = [];
    let j = 0;
    for (const f of files) {
      const im = await loadImage(readFileSync(join(ROOT, dir, f)));
      const c = createCanvas(S, S), g = c.getContext('2d');
      g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, S, S);
      if (dir === 'vfx') {
        // 原图是「黑底加色」画法（暗处并非透明）：按亮度抠出 alpha 并反预乘，变成任何底色上都能正常叠放的透明光效
        const id = g.getImageData(0, 0, S, S), d = id.data as unknown as Uint8ClampedArray;
        for (let i = 0; i < d.length; i += 4) {
          const a0 = d[i + 3] / 255; if (a0 <= 0) continue;
          const m = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
          const k = Math.pow(m, 0.9);
          const na = a0 * Math.min(1, k * 1.08);
          if (na < 0.012) { d[i + 3] = 0; continue; }
          const sc = m > 0.004 ? 1 / Math.max(m, 0.004) : 0;
          d[i] = Math.min(255, d[i] * sc); d[i + 1] = Math.min(255, d[i + 1] * sc); d[i + 2] = Math.min(255, d[i + 2] * sc);
          d[i + 3] = Math.round(na * 255);
        }
        g.putImageData(id, 0, 0);
      }
      const k = rename(f);
      writeFileSync(join(out, k + '.webp'), await c.encode('webp', q));
      ii.push(`import ${varp}${j} from '../assets/${out.split('/').pop()}/${k}.webp?inline';`); is.push(`  ${k}: ${varp}${j},`); j++;
    }
    return { ii, is, n: j };
  };
  const v = await conv('vfx', 'src/assets/vfx', 256, 88, (f) => f.replace(/^vfx_/, '').replace('.png', ''), 'v');
  writeFileSync('src/gfx/vfxData.ts', `// 第二十四步：法术特效关键形态图（外部 AI 绘制，256px；tools/vfxconvert.ts 生成，勿手改）\n${v.ii.join('\n')}\nexport const VFX_SRC: Record<string, string> = {\n${v.is.join('\n')}\n};\n`);
  const s = await conv('skill', 'src/assets/skills', 96, 86, (f) => f.replace('.png', ''), 's');
  writeFileSync('src/gfx/skillIconData.ts', `// 第二十四步：法术图标（外部 AI 绘制，96px；tools/vfxconvert.ts 生成，勿手改）\n${s.ii.join('\n')}\nexport const SKILL_ICON: Record<string, string> = {\n${s.is.join('\n')}\n};\n`);
  console.log('vfx', v.n, 'skills', s.n);
})();
