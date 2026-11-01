// 意境贴图预处理：AI 初稿是 RGB（甚至把"透明棋盘格"画进了图里）
// 这里按每张图的特点抠出真 alpha、去棋盘格、羽化边缘、做横向无缝，输出 webp 到 src/assets/mood/
// 用法：node tools/mood-process.mjs <原图目录> <输出目录>
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2], OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 逐像素：fn(r,g,b,x,y,w,h) => [r,g,b,a]（a 0–1） */
async function proc(name, opt) {
  const img = await loadImage(path.join(SRC, name + '.png'));
  let w = img.width, h = img.height;
  const sc = opt.scale ?? 1;
  w = Math.round(w * sc); h = Math.round(h * sc);
  const cv = createCanvas(w, h), g = cv.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  const A = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const out = opt.fn(d[i], d[i + 1], d[i + 2], x, y, w, h);
    d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; A[y * w + x] = out[3];
  }
  // alpha 去噪：3×3 盒式模糊若干次（把棋盘格残留的颗粒抹平），再做一次收缩阈值
  for (let it = 0; it < (opt.blur ?? 1); it++) {
    const B = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += A[yy * w + xx]; n++; }
      B[y * w + x] = s / n;
    }
    A.set(B);
  }
  const lo = opt.floor ?? 0.04;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = Math.max(0, (A[y * w + x] - lo) / (1 - lo));
    if (opt.win) a *= opt.win(x, y, w, h);
    d[(y * w + x) * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  g.putImageData(id, 0, 0);
  let res = cv;
  if (opt.seamX) res = seam(res, Math.round(res.width * opt.seamX), true);
  if (opt.seamY) res = seam(res, Math.round(res.height * opt.seamY), false);
  if (opt.crop) res = cropAlpha(res, 6);
  if (opt.size) { const [tw, th] = opt.size(res.width, res.height); const c2 = createCanvas(tw, th); c2.getContext('2d').drawImage(res, 0, 0, tw, th); res = c2; }
  fs.writeFileSync(path.join(OUT, name + '.webp'), await res.encode('webp', opt.q ?? 86));
  console.log(name, res.width + 'x' + res.height);
}

/** 无缝：把右端 o 像素与左端交叉淡化，输出宽度 w-o（不复制拼贴，只是首尾融合） */
function seam(cv, o, horiz) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d');
  const src = g.getImageData(0, 0, w, h).data;
  const W2 = horiz ? w - o : w, H2 = horiz ? h : h - o;
  const out = createCanvas(W2, H2), og = out.getContext('2d'), id = og.createImageData(W2, H2), d = id.data;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const j = (y * W2 + x) * 4, i = (y * w + x) * 4;
    const k = horiz ? x : y;
    if (k < o) {
      const t = k / o, i2 = horiz ? (y * w + x + W2) * 4 : ((y + H2) * w + x) * 4;
      for (let c = 0; c < 4; c++) d[j + c] = src[i2 + c] * (1 - t) + src[i + c] * t;
    } else for (let c = 0; c < 4; c++) d[j + c] = src[i + c];
  }
  og.putImageData(id, 0, 0);
  return out;
}
function cropAlpha(cv, pad) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(cv, -x0, -y0);
  return out;
}

const L = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const cool = (r, g, b) => (g + b) / 2 - r;
/** 从白底"反混合"出颜色：p = c·a + 白·(1-a) */
const unmix = (v, a, bg = 245) => Math.max(0, Math.min(255, a > 0.02 ? (v - bg * (1 - a)) / a : v));
const bottomFade = (f, end = 1) => (x, y, w, h) => 1 - ss(1 - f, end, y / h);
const vWin = (a, b) => (x, y, w, h) => ss(0, a, y / h) * (1 - ss(1 - b, 1, y / h));
const hWin = (a) => (x, y, w, h) => ss(0, a, x / w) * (1 - ss(1 - a, 1, x / w));

// ---------------------------------------------------------------- A 远山
const mtn = (coolA, coolB, darkA, darkB) => (r, g, b) => {
  const a = Math.max(ss(coolA, coolB, cool(r, g, b)), ss(darkA, darkB, 245 - L(r, g, b)));
  return [unmix(r, a * 0.9), unmix(g, a * 0.9), unmix(b, a * 0.9), a];
};
// 远两层颜色极淡（与纸色只差一点青灰），按"离纸色的距离"抠：亮度差 + 暖度差（纸偏暖、远山偏冷）
const paperDist = (P, a0, a1) => (r, g, b) => {
  const s = (L(P[0], P[1], P[2]) - L(r, g, b)) + 1.5 * ((P[0] - P[2]) - (r - b));
  const a = ss(a0, a1, s);
  return [unmix(r, a * 0.85, 240), unmix(g, a * 0.85, 240), unmix(b, a * 0.85, 240), a];
};
await proc('far_mtn_1', { scale: 2048 / 2352, fn: paperDist([242, 235, 216], 10, 46), blur: 2, win: bottomFade(0.4, 0.76), seamX: 0.08 });
await proc('far_mtn_2', { fn: paperDist([231, 219, 194], 12, 56), blur: 2, win: bottomFade(0.4, 0.84), seamX: 0.08 });
await proc('far_mtn_3', { scale: 2048 / 1856 * 0.9, fn: mtn(5, 24, 80, 130), blur: 2, win: bottomFade(0.32), seamX: 0.08 });

// ---------------------------------------------------------------- B 天空
await proc('sky_cloud_band', { scale: 0.76, fn: (r, g, b) => { const a = Math.max(ss(2, 18, cool(r, g, b)), ss(40, 90, 245 - L(r, g, b))) * 0.9; return [unmix(r, a), unmix(g, a), unmix(b, a), a]; }, blur: 2, win: vWin(0.25, 0.3), seamX: 0.1 });
await proc('sky_dawn_mist', { scale: 0.83, fn: (r, g, b) => { const a = ss(12, 46, sat(r, g, b)); return [Math.min(255, r + 10), Math.min(255, g + 10), Math.min(255, b + 6), a]; }, blur: 3, win: vWin(0.3, 0.35), seamX: 0.1 });
await proc('sky_dusk_glow', { scale: 0.83, fn: (r, g, b) => { const a = ss(14, 70, sat(r, g, b)); return [r, g, b, a]; }, blur: 3, win: vWin(0.3, 0.3), seamX: 0.1 });
await proc('sky_starriver', { fn: (r, g, b) => { const l = L(r, g, b); const a = ss(48, 170, l); return [Math.min(255, r * 1.15 + 20), Math.min(255, g * 1.15 + 22), Math.min(255, b * 1.15 + 30), a]; }, blur: 0, floor: 0.02, win: vWin(0.15, 0.15), seamX: 0.1 });
await proc('moon_full', { scale: 0.5, fn: (r, g, b, x, y, w, h) => { const rr = Math.hypot(x - w / 2, y - h / 2) / w; const a = (1 - ss(0.25, 0.272, rr)) * (1 - ss(-6, 14, b - r)); return [r, g, b, a]; }, blur: 0, floor: 0, crop: true });
await proc('moon_crescent', { scale: 0.5, fn: (r, g, b) => { const a = ss(40, 200, r); return [Math.min(255, r + 10), g, b, a]; }, blur: 1, floor: 0.03, crop: true });
// 雨幕：初稿的雨丝与棋盘格分不开，按其构图（极淡斜细雨丝）程序重绘，四方连续
{
  const S = 512, cv = createCanvas(S, S), g = cv.getContext('2d');
  g.lineCap = 'round';
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, l = 30 + rnd() * 70, a = 0.12 + rnd() * 0.3;
    g.strokeStyle = `rgba(214,224,232,${a})`; g.lineWidth = 0.6 + rnd() * 0.8;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox - l * 0.28, y + oy + l); g.stroke(); }
  }
  fs.writeFileSync(path.join(OUT, 'rain_veil.webp'), await cv.encode('webp', 86));
  console.log('rain_veil 512x512 (procedural)');
}

// ---------------------------------------------------------------- C 烟岚
await proc('mist_band_1', { scale: 0.5, fn: (r, g, b) => { const a = ss(3, 34, 246 - L(r, g, b)); return [240, 242, 238, a]; }, blur: 3, floor: 0.02, win: (x, y, w, h) => hWin(0.3)(x, y, w, h) * vWin(0.2, 0.2)(x, y, w, h) });
await proc('mist_puff_1', { scale: 0.5, fn: (r, g, b) => { const a = ss(4, 46, 254 - L(r, g, b)); return [236, 241, 236, a]; }, blur: 3, floor: 0.02 });
await proc('mist_puff_2', { scale: 0.5, fn: (r, g, b) => { const a = ss(6, 32, cool(r, g, b)); return [228, 236, 240, a]; }, blur: 3, floor: 0.05 });

// ---------------------------------------------------------------- D 点景
await proc('wild_geese', { scale: 0.6, fn: (r, g, b) => { const a = ss(105, 165, 245 - L(r, g, b)); return [40, 38, 34, a]; }, blur: 1, floor: 0.06, crop: true });
await proc('lone_sail', { scale: 0.6, fn: (r, g, b) => { const a = ss(70, 140, 250 - L(r, g, b)); return [unmix(r, a, 250), unmix(g, a, 250), unmix(b, a, 250), a]; }, blur: 1, floor: 0.06, crop: true });
await proc('fishing_light', { scale: 0.5, fn: (r, g, b) => { const a = ss(14, 70, r - b); return [Math.min(255, r + 40), Math.min(255, g + 30), b, a]; }, blur: 5, floor: 0.05, crop: true });
await proc('cooking_smoke', { scale: 0.5, fn: (r, g, b) => { const a = ss(140, 225, L(r, g, b)); return [228, 230, 226, a]; }, blur: 2, floor: 0.05, crop: true });
await proc('reed_marsh', { scale: 0.6, fn: (r, g, b) => { const a = Math.max(ss(145, 200, L(r, g, b)), ss(34, 70, sat(r, g, b))); return [r, g, b, a]; }, blur: 1, floor: 0.08, crop: true });
await proc('lotus_withered', { scale: 0.5, fn: (r, g, b) => { const a = ss(25, 130, 255 - L(r, g, b)); return [unmix(r, a, 255), unmix(g, a, 255), unmix(b, a, 255), a]; }, blur: 1, floor: 0.04, crop: true });
await proc('plum_branch', { scale: 0.6, fn: (r, g, b) => { const a = Math.max(ss(85, 150, 250 - L(r, g, b)), ss(45, 90, sat(r, g, b))); return [unmix(r, a, 250), unmix(g, a, 250), unmix(b, a, 250), a]; }, blur: 1, floor: 0.06, crop: true });

// ---------------------------------------------------------------- E 后处理
await proc('paper_grain', { scale: 0.5, fn: (r, g, b) => [r, g, b, 1], blur: 0, floor: 0, seamX: 0.12, seamY: 0.12 });
// 淡墨四角洇染：AI 初稿是带硬框的"裱框"，这里用它的墨色程序重绘——中心 70% 完全透明
{
  const S = 512, cv = createCanvas(S, S), g = cv.getContext('2d'), id = g.createImageData(S, S), d = id.data;
  const n = (x, y) => Math.sin(x * 0.031 + Math.sin(y * 0.017) * 2) * Math.sin(y * 0.027 + Math.sin(x * 0.021) * 2);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S - 0.5) * 2, v = (y / S - 0.5) * 2;
    const rr = Math.pow(Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.6), 1 / 2.6);
    const a = ss(0.72, 1.32, rr + n(x, y) * 0.07) * 0.85;
    const i = (y * S + x) * 4; d[i] = 52; d[i + 1] = 46; d[i + 2] = 38; d[i + 3] = a * 255;
  }
  g.putImageData(id, 0, 0);
  fs.writeFileSync(path.join(OUT, 'ink_vignette.webp'), await cv.encode('webp', 86));
  console.log('ink_vignette 512x512 (procedural)');
}
