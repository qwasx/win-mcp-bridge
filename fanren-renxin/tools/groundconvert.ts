// 第三十步：把 AI 生成的地表原图（tools/out/gen/*.png）做成 768² 四方连续 webp，并打印平均色。
// 用法：npx tsx tools/groundconvert.ts <src.png> <dst.webp> [quality]
// 四方连续：先横向（与左右错半的自身按“离边距离”渐变混合，保方差），再纵向同样处理。
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';

const [src, dst, qArg] = process.argv.slice(2);
const N = 768;
(async () => {
  const im = await loadImage(src);
  const c = createCanvas(N, N), x = c.getContext('2d');
  x.imageSmoothingEnabled = true; (x as any).imageSmoothingQuality = 'high';
  x.drawImage(im, 0, 0, N, N);
  const id = x.getImageData(0, 0, N, N), d = id.data;
  const mean = [0, 0, 0];
  for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) mean[k] += d[i * 4 + k];
  for (let k = 0; k < 3; k++) mean[k] /= N * N;
  const ss = (a: number, b: number, t: number) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
  // 低频扰动，让过渡带不是笔直的十字
  const wob = (t: number, s: number) => 0.06 * Math.sin(t * Math.PI * 2 * 3 + s) + 0.04 * Math.sin(t * Math.PI * 2 * 7 + s * 2.3);
  const pass = (src: Uint8ClampedArray, horiz: boolean) => {
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
      const u = horiz ? xx / N : y / N, v = horiz ? y / N : xx / N;
      const e = Math.min(u, 1 - u) * 2 + wob(v, horiz ? 1.3 : 4.1);
      const w = ss(0.12, 0.62, e);
      const sx = horiz ? (xx + N / 2) % N : xx, sy = horiz ? y : (y + N / 2) % N;
      const i = (y * N + xx) * 4, j = (sy * N + sx) * 4;
      const g = 1 / Math.sqrt(w * w + (1 - w) * (1 - w));
      for (let k = 0; k < 3; k++) {
        const b = src[i + k] * w + src[j + k] * (1 - w);
        out[i + k] = mean[k] + (b - mean[k]) * g;
      }
      out[i + 3] = 255;
    }
    return out;
  };
  const r = pass(pass(d, true), false);
  id.data.set(r);
  x.putImageData(id, 0, 0);
  const buf = await c.encode('webp', Number(qArg || 82));
  writeFileSync(dst, buf);
  const avg = [0, 0, 0];
  for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) avg[k] += r[i * 4 + k];
  console.log(dst, (buf.length / 1024).toFixed(0) + 'KB', 'avg', avg.map((v) => (v / N / N / 255).toFixed(3)).join(', '));
  // 2×2 平铺预览
  const p = createCanvas(N, N), px = p.getContext('2d');
  const half = createCanvas(N / 2, N / 2); half.getContext('2d').drawImage(c, 0, 0, N / 2, N / 2);
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) px.drawImage(half, a * N / 2, b * N / 2);
  writeFileSync(dst.replace(/.*\//, 'tools/out/v/tile_').replace('.webp', '.jpg'), await p.encode('jpeg', 80));
})();
