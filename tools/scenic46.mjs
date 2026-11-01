// 第四十六步：新画材去白底 → webp（复用 scenicconvert 的泛洪算法）
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
const SPR = process.argv.slice(2);
const dims = {};
for (const n of SPR) {
  const im = await loadImage(`tools/raw/${n}.png`);
  const W = im.width, H = im.height; const c = createCanvas(W, H), g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, W, H), p = d.data, N = W * H;
  const white = (i) => { const r = p[i * 4], gg = p[i * 4 + 1], b = p[i * 4 + 2]; const mn = Math.min(r, gg, b), mx = Math.max(r, gg, b); return mn > 226 && mx - mn < 24; };
  const bg = new Uint8Array(N); const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!bg[i] && white(i)) { bg[i] = 1; q[qt++] = i; } }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!bg[i] && white(i)) { bg[i] = 1; q[qt++] = i; } }
  while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !bg[j] && white(j)) { bg[j] = 1; q[qt++] = j; } }
  const near = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!bg[i]) { const x = i % W, y = (i / W) | 0; let k = 0; for (let dy = -2; dy <= 2 && !k; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) { k = Math.max(Math.abs(dx), Math.abs(dy)); break; } } near[i] = k; }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (bg[i]) { p[o + 3] = 0; continue; }
    if (near[i]) { const r = p[o], gg = p[o + 1], b = p[o + 2]; const a = Math.max(0.15, Math.min(1, Math.max((255 - r), (255 - gg), (255 - b)) / 255 * (near[i] === 1 ? 1.6 : 2.4))); p[o] = Math.max(0, Math.min(255, (r - 255 * (1 - a)) / a)); p[o + 1] = Math.max(0, Math.min(255, (gg - 255 * (1 - a)) / a)); p[o + 2] = Math.max(0, Math.min(255, (b - 255 * (1 - a)) / a)); p[o + 3] = Math.round(a * 255); }
    if (p[o + 3] > 20) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  g.putImageData(d, 0, 0);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, 900 / Math.max(cw, ch));
  const o = createCanvas(Math.round(cw * s), Math.round(ch * s)); const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
  og.drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
  writeFileSync(`src/assets/prop/${n}.webp`, await o.encode('webp', 84));
  dims[n] = [o.width, o.height];
}
console.log(JSON.stringify(dims));
