// 第二十步：量出每只程序妖兽（静立帧）的实际包围盒（世界像素），作为贴图换算尺寸的依据
// 用法：npx tsx tools/beastmeasure.ts > tools/out/beastbox.json
import { createCanvas } from '@napi-rs/canvas';
(globalThis as any).document = { createElement: () => createCanvas(1, 1) };
const { ENEMY_LIST } = await import('../src/data/enemies');
const { drawBeast } = await import('../src/gfx/beast');
const out: Record<string, any> = {};
for (const e of ENEMY_LIST) {
  if (!e.look) continue;
  const S = 900, cv = createCanvas(S, S), g: any = cv.getContext('2d');
  drawBeast(g, e.look, S / 2, S * 0.75, 1, { move: 0, phase: 0, atk: 0, hit: 0, t: 0, flying: false }, 1);
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  out[e.id] = { name: e.name, kind: e.kind, body: e.look.body, size: e.look.size, lv: e.lv, w: x1 - x0 + 1, h: S * 0.75 - y0, flying: !!e.flying, lair: !!e.lair, lm: e.lm };
}
console.log(JSON.stringify(out));
