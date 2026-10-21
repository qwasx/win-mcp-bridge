// v0.42 地图样板：剔除图像模型误画的透明网格背景，输出可直接用于地景的 WebP。
// 用法：node tools/map42-art.mjs
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const input = 'art-src/raw/map42/waterfall-pavilion.png';
const output = 'src/assets/prop/hf_view_pavilion.webp';
const im = await loadImage(readFileSync(input));
const c = createCanvas(im.width, im.height);
const ctx = c.getContext('2d');
ctx.drawImage(im, 0, 0);
const image = ctx.getImageData(0, 0, im.width, im.height);
const { width: W, height: H, data } = image;
const n = W * H;
const candidate = new Uint8Array(n);
const seen = new Uint8Array(n);
const queue = new Int32Array(n);

// 模型用透明棋盘示意图代替了 alpha。仅把近中性、浅灰棋盘色视作背景；
// 使用边缘连通填充，避免误抠掉凉亭本身的浅色石材。
for (let i = 0; i < n; i++) {
  const p = i * 4, r = data[p], g = data[p + 1], b = data[p + 2];
  const lo = Math.min(r, g, b), hi = Math.max(r, g, b), m = (r + g + b) / 3;
  if (hi - lo <= 7 && m >= 224) candidate[i] = 1;
}
let head = 0, tail = 0;
const add = (i) => { if (i >= 0 && i < n && !seen[i] && candidate[i]) { seen[i] = 1; queue[tail++] = i; } };
for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); }
for (let y = 0; y < H; y++) { add(y * W); add(y * W + W - 1); }
while (head < tail) {
  const i = queue[head++], x = i % W, y = (i / W) | 0;
  if (x > 0) add(i - 1); if (x + 1 < W) add(i + 1);
  if (y > 0) add(i - W); if (y + 1 < H) add(i + W);
}
// 透明网格在凉亭的敞开空间里会被柱、栏杆分成小岛；因此所有接近网格中性灰的像素都抠除，
// 同时将边缘与背景混色的浅灰像素处理为透明。石台本身带暖灰/赭色，保留其色彩与墨线。
for (let i = 0; i < n; i++) if (candidate[i]) data[i * 4 + 3] = 0;
ctx.putImageData(image, 0, 0);
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
if (x1 < 0) throw new Error('背景抠图后没有剩余画材');
const pad = 12;
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
const out = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
mkdirSync('src/assets/prop', { recursive: true });
writeFileSync(output, await out.encode('webp', 90));

// 单独输出棋盘合成检查图（不进发行包）。
const preview = createCanvas(out.width, out.height), pg = preview.getContext('2d');
pg.fillStyle = '#81917c'; pg.fillRect(0, 0, out.width, out.height); pg.drawImage(out, 0, 0);
mkdirSync('tools/out', { recursive: true });
writeFileSync('tools/out/map42-pavilion-cutout.png', await preview.encode('png'));
console.log(`${output}: ${out.width}x${out.height}, ${Math.round(readFileSync(output).length / 1024)} KB`);
