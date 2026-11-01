// 法器图鉴：node 端用 @napi-rs/canvas 渲染全部造型，检查画工
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
(globalThis as any).document = { createElement: () => createCanvas(1, 1) };
const { ART_LOOK } = await import('../src/data/artlooks');
const { artSprite } = await import('../src/gfx/artifact');
const ids = Object.keys(ART_LOOK);
const cols = 8, cw = 200, ch = 200;
const out = createCanvas(cols * cw, Math.ceil(ids.length / cols) * ch);
const g = out.getContext('2d');
g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, out.width, out.height);
ids.forEach((id, i) => {
  const s: any = artSprite(ART_LOOK[id], 1.3)!;
  const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  const k = Math.min(1, (cw - 10) / s.width, (ch - 24) / s.height);
  g.drawImage(s, x + (cw - s.width * k) / 2, y + (ch - 16 - s.height * k) / 2, s.width * k, s.height * k);
  g.fillStyle = '#333'; g.font = '13px sans-serif'; g.fillText(id, x + 6, y + ch - 6);
});
writeFileSync(process.argv[2] ?? 'tools/out/artsheet.png', out.toBuffer('image/png'));
console.log('ok', ids.length);
