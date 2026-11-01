// 第三十四步：把 CC0 粒子贴图（Kenney Particle Pack / RPicster）压进特效图集的第 5–8 行（32 格，每格 128px，白色 + alpha）
// 用法: npx tsx tools/fxatlas.ts → src/assets/fx/fxatlas.webp
import './env';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
const K = '/home/user/assets-src/kenney-particle-pack/addons/kenney_particle_pack/';
const R = '/home/user/assets-src/Godot-particle-and-vfx-textures/textures/256/alpha/';
// 顺序 = 图集格 32..63（与 src/gl/atlas.ts 的 C 枚举一致）
const LIST: [string, number][] = [
  [K + 'smoke_04.png', 1], [K + 'smoke_07.png', 1], [K + 'smoke_08.png', 1], [K + 'smoke_10.png', 1],
  [K + 'muzzle_01.png', 1], [K + 'muzzle_02.png', 1], [K + 'muzzle_04.png', 1], [K + 'flame_05.png', 1],
  [K + 'flame_01.png', 1], [K + 'flame_03.png', 1], [K + 'scorch_01.png', 1], [K + 'fire_01.png', 1],
  [K + 'scorch_03.png', 1], [K + 'spark_01.png', 1], [K + 'spark_02.png', 1], [K + 'spark_05.png', 1],
  [K + 'spark_06.png', 1], [K + 'spark_07.png', 1], [R + 'effect_1.png', 1], [R + 'effect_2.png', 1],
  [R + 'effect_3.png', 1], [R + 'effect_4.png', 1], [R + 'spotlight_8.png', 1], [K + 'star_08.png', 1],
  [K + 'star_09.png', 1], [K + 'magic_02.png', 1], [K + 'magic_03.png', 1], [K + 'light_03.png', 1],
  [K + 'slash_04.png', 1], [K + 'twirl_01.png', 1], [K + 'dirt_02.png', 1], [K + 'scratch_01.png', 1],
];
const CELL = 128, COLS = 8;
const out = createCanvas(CELL * COLS, CELL * 4); const og = out.getContext('2d');
(async () => {
  for (let i = 0; i < LIST.length; i++) {
    const [f] = LIST[i];
    const im = await loadImage(f);
    const c = createCanvas(CELL, CELL), g = c.getContext('2d');
    const S = 124, k = S / Math.max(im.width, im.height);
    g.drawImage(im, (CELL - im.width * k) / 2, (CELL - im.height * k) / 2, im.width * k, im.height * k);
    const d = g.getImageData(0, 0, CELL, CELL), p = d.data;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const o = (y * CELL + x) * 4;
      const lum = Math.max(p[o], p[o + 1], p[o + 2]) / 255;
      const e = Math.min(x, y, CELL - 1 - x, CELL - 1 - y);
      const edge = e >= 5 ? 1 : Math.max(0, (e - 1) / 4);
      const a = (p[o + 3] / 255) * lum * edge;
      p[o] = p[o + 1] = p[o + 2] = 255; p[o + 3] = Math.round(Math.min(1, a) * 255);
    }
    g.putImageData(d, 0, 0);
    og.drawImage(c, (i % COLS) * CELL, Math.floor(i / COLS) * CELL);
  }
  mkdirSync('src/assets/fx', { recursive: true });
  const buf = out.toBuffer('image/webp', 92 as any);
  writeFileSync('src/assets/fx/fxatlas.webp', buf);
  // 预览（深底）
  const pv = createCanvas(out.width, out.height), pg = pv.getContext('2d'); pg.fillStyle = '#18202a'; pg.fillRect(0, 0, pv.width, pv.height); pg.drawImage(out, 0, 0);
  writeFileSync('tools/out/v/fxatlas_pv.png', pv.toBuffer('image/png'));
  console.log('fxatlas.webp', buf.length);
})();
