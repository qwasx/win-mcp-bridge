// 妖兽图鉴：node 端渲染全部妖兽造型（行走 / 扑击两帧），检查画工
// 用法：npx tsx tools/beastsheet.ts out.png [过滤id,逗号分隔]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
(globalThis as any).document = { createElement: () => createCanvas(1, 1) };
const { ENEMY_LIST } = await import('../src/data/enemies');
const { drawBeast } = await import('../src/gfx/beast');
const filt = process.argv[3]?.split(',');
const list = ENEMY_LIST.filter((e) => e.look && (!filt || filt.includes(e.id)));
const cols = 4, cw = 420, ch = 260;
const out = createCanvas(cols * cw, Math.ceil(list.length / cols) * ch);
const g: any = out.getContext('2d');
g.fillStyle = '#e6dfcc'; g.fillRect(0, 0, out.width, out.height);
list.forEach((e, i) => {
  const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
  const k = Math.min(1.1, 1.25 / Math.max(0.6, e.look!.size));
  for (let f = 0; f < 2; f++) {
    g.save(); g.translate(x + cw * (f ? 0.73 : 0.27), y + ch - 50); g.scale(k, k);
    drawBeast(g, e.look!, 0, 0, 1, { move: f ? 0.2 : 1, phase: 1.1, atk: f ? 0.5 : 0, hit: 0, t: 1.3 + f, flying: !!e.flying }, 1);
    g.restore();
  }
  g.fillStyle = '#333'; g.font = '14px sans-serif'; g.fillText(`${e.id}  lv${(e as any).lv ?? '-'}`, x + 8, y + 18);
});
writeFileSync(process.argv[2] ?? 'tools/out/beastsheet.png', out.toBuffer('image/png'));
console.log('ok', list.length);
