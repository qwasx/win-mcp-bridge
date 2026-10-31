// 草地：代码绘制的草丛（细长尖叶、前后明暗、四季配色、野花、三叶草、枯草），随风摇曳
// 草丛位图按「种类 × 变体 × 季节 × 分辨率」缓存；地面上每丛只是一次带斜切的 drawImage
import { makeCanvas, mix, rgba, shade } from '../core/canvas';
import { mulberry32 } from '../core/rng';

export type GrassKind = 'tuft' | 'tall' | 'flower' | 'clover' | 'dry' | 'snow' | 'fern' | 'sprig';
export const GRASS_VARIANTS = 8;
type G = CanvasRenderingContext2D;

/** 季节：0 春 1 夏 2 秋 3 冬 —— 每季 4 个层次（背光、中间、受光、高光） */
const PAL: Record<number, { back: string; mid: string; lit: string; hi: string; dry: string[] }> = {
  0: { back: '#4f7d3c', mid: '#6f9e45', lit: '#93bf55', hi: '#c5e080', dry: ['#a8a058', '#c4b46a', '#ddd090'] },
  1: { back: '#365f30', mid: '#4f803a', lit: '#6fa046', hi: '#a6cc6a', dry: ['#9a9450', '#b8aa60', '#d6c888'] },
  2: { back: '#6a5e2c', mid: '#9a8236', lit: '#c0a046', hi: '#e2c672', dry: ['#a0743a', '#c0904a', '#dcb468'] },
  3: { back: '#6a6650', mid: '#8a8466', lit: '#aaa486', hi: '#d4d0bc', dry: ['#8a7a5a', '#a89670', '#c8b896'] },
};
const FLOWERS: Record<number, string[]> = {
  0: ['#f4c4d0', '#fbf4ee', '#f0a0b8', '#f6e08a'],
  1: ['#f2d250', '#7a9ae0', '#c890d8', '#fbf4ee', '#e86a5a'],
  2: ['#f0c040', '#e88848', '#d8d0f0', '#c04a3a'],
  3: ['#f4f0ea'],
};

/** 一片尖叶：从根部 (x,0) 向上弯出，宽度渐收 */
function blade(g: G, x: number, h: number, w: number, lean: number, bend: number) {
  const tx = x + lean * h, ty = -h;
  const cx = x + lean * h * 0.35 + bend * h * 0.25, cy = -h * 0.55;
  g.moveTo(x - w / 2, 0);
  g.quadraticCurveTo(cx - w * 0.25, cy, tx, ty);
  g.quadraticCurveTo(cx + w * 0.35, cy + h * 0.04, x + w / 2, 0);
  g.closePath();
}

/** 绘制一丛草（坐标单位 = 世界像素；原点在根部中心） */
export function drawClump(g: G, kind: GrassKind, v: number, season: number) {
  const r = mulberry32(v * 7919 + kind.length * 131 + 17);
  const P = PAL[season];
  const winter = season === 3;
  if (kind === 'sprig') {
    // 零星小草：填补草丛之间的空白，低对比
    const n = 4 + (r() * 3 | 0);
    const cols = season === 3 ? P.dry : [P.mid, P.lit, P.mid];
    for (let i = 0; i < n; i++) {
      g.fillStyle = rgba(cols[i % 3], 0.9);
      g.beginPath();
      const x = (r() - 0.5) * 11, h = 9 + r() * 8;
      blade(g, x, h, 1.6, (x / 9) * 0.6 + (r() - 0.5) * 0.3, 0);
      g.fill();
    }
    return;
  }
  // 根部：柔和的深色草根晕（不是硬边影子）
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 20);
  rg.addColorStop(0, rgba(P.back, 0.28)); rg.addColorStop(1, rgba(P.back, 0));
  g.fillStyle = rg;
  g.save(); g.scale(1, 0.3); g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill(); g.restore();

  if (kind === 'clover') {
    // 三叶草 / 酢浆草：低矮圆叶簇
    const n = 7 + (r() * 5 | 0);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * 16;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.45 - 3;
      const c = pass === 0 ? P.back : r() < 0.5 ? P.mid : P.lit;
      g.fillStyle = c;
      for (let k = 0; k < 3; k++) { const aa = k * 2.1 + a; g.beginPath(); g.ellipse(x + Math.cos(aa) * 2.6, y + Math.sin(aa) * 1.5, 2.6, 1.9, aa, 0, Math.PI * 2); g.fill(); }
      if (pass === 1 && r() < 0.2) { g.fillStyle = rgba(P.hi, 0.8); g.beginPath(); g.arc(x - 1, y - 1, 0.9, 0, Math.PI * 2); g.fill(); }
    }
    if (season < 2 && r() < 0.6) { g.fillStyle = season === 0 ? '#fbf4ee' : '#f4d0e0'; for (let i = 0; i < 2; i++) { const x = (r() - 0.5) * 22, y = -6 - r() * 4; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0d060'; g.beginPath(); g.arc(x, y, 0.8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fbf4ee'; } }
    return;
  }
  if (kind === 'fern') {
    // 蕨：拱形羽叶
    const n = 4 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const dir = (i / (n - 1) - 0.5) * 2.2 + (r() - 0.5) * 0.3, L = 22 + r() * 14;
      const ex = Math.sin(dir) * L, ey = -Math.cos(dir) * L * 0.8;
      g.strokeStyle = i % 2 ? P.mid : P.back; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ex * 0.5, ey * 1.1, ex, ey + 6); g.stroke();
      g.fillStyle = i % 2 ? P.lit : P.mid;
      for (let k = 1; k < 7; k++) {
        const t = k / 7, px = ex * t, py = ey * t * (1.1 - t * 0.3) + t * t * 6, s = 4.5 * (1 - t * 0.6);
        g.beginPath(); g.ellipse(px - 2, py, s, 1.4, dir - 0.9, 0, Math.PI * 2); g.ellipse(px + 2, py, s, 1.4, dir + 0.9, 0, Math.PI * 2); g.fill();
      }
    }
    return;
  }

  const dry = kind === 'dry';
  const tall = kind === 'tall';
  const snow = kind === 'snow';
  const n = (tall ? 12 : dry ? 11 : 9) + (r() * 5 | 0);
  const H = tall ? 34 : dry ? 24 : 20;
  const spread = tall ? 15 : 13;
  const layers = dry || snow || winter
    ? [P.dry[0], P.dry[1], P.dry[2]]
    : [P.back, P.mid, P.lit];
  // 后、中、前三层，越靠前越亮
  for (let L = 0; L < 3; L++) {
    g.fillStyle = layers[L];
    g.beginPath();
    const m = Math.round(n * (L === 1 ? 0.4 : 0.3));
    for (let i = 0; i < m; i++) {
      const x = (r() - 0.5) * spread * 2 * (L === 2 ? 0.8 : 1);
      const h = H * (0.55 + r() * 0.6) * (L === 0 ? 1.05 : L === 2 ? 0.85 : 1);
      const lean = (x / spread) * 0.45 + (r() - 0.5) * 0.35;
      blade(g, x, h, 2.2 + r() * 1.6, lean, (r() - 0.5) * 0.6);
    }
    g.fill();
  }
  // 受光高光：几片叶尖描一笔
  g.strokeStyle = rgba(dry || winter ? '#f0e4b8' : P.hi, 0.75); g.lineWidth = 0.7; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * spread * 1.4, h = H * (0.6 + r() * 0.4), lean = (x / spread) * 0.45;
    g.moveTo(x + lean * h * 0.35, -h * 0.45); g.quadraticCurveTo(x + lean * h * 0.6, -h * 0.75, x + lean * h * 0.95, -h * 0.95);
  }
  g.stroke();
  // 狗尾草 / 芦花穗（高草、枯草）
  if ((tall || dry) && season !== 3 && r() < 0.6) {
    const k = 1 + (r() * 2 | 0);
    for (let i = 0; i < k; i++) {
      const x = (r() - 0.5) * spread, h = H * (1.1 + r() * 0.35), lean = (r() - 0.5) * 0.5;
      const tx = x + lean * h, ty = -h;
      g.strokeStyle = shade(layers[1], -0.1); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + lean * h * 0.3, -h * 0.6, tx, ty); g.stroke();
      g.fillStyle = season === 2 ? '#e8d4a0' : dry ? '#e4d8a8' : mix(P.hi, '#e8e0b0', 0.5);
      g.beginPath(); g.ellipse(tx + lean * 3, ty - 4, 2.2, 6, lean * 0.8, 0, Math.PI * 2); g.fill();
    }
  }
  // 野花
  if (kind === 'flower' && !winter) {
    const F = FLOWERS[season];
    const k = 2 + (r() * 3 | 0);
    for (let i = 0; i < k; i++) {
      const x = (r() - 0.5) * spread * 1.6, h = H * (0.7 + r() * 0.5), c = F[(r() * F.length) | 0];
      g.strokeStyle = P.back; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 1, -h * 0.5, x + (r() - 0.5) * 4, -h); g.stroke();
      const fx = x + (r() - 0.5) * 4, fy = -h, pr = 2.2 + r() * 1.2;
      g.fillStyle = c;
      for (let p = 0; p < 5; p++) { const a = p * 1.2566 + r(); g.beginPath(); g.ellipse(fx + Math.cos(a) * pr * 0.75, fy + Math.sin(a) * pr * 0.55, pr * 0.62, pr * 0.42, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = c === '#f2d250' || c === '#f0c040' ? '#a0602a' : '#f4d04a';
      g.beginPath(); g.arc(fx, fy, pr * 0.32, 0, Math.PI * 2); g.fill();
    }
  }
  // 积雪
  if (snow || (winter && r() < 0.3)) {
    g.fillStyle = 'rgba(250,250,248,0.95)';
    if (snow) { g.beginPath(); g.ellipse(0, -1, spread * 0.9, 4.5, 0, Math.PI, 0); g.fill(); }
    for (let i = 0; i < 3; i++) { const x = (r() - 0.5) * spread, y = -H * (0.4 + r() * 0.3); g.beginPath(); g.ellipse(x, y, 3, 1.6, 0, 0, Math.PI * 2); g.fill(); }
  }
}

// ------------------------------------------------------------------ 位图缓存
export interface GrassSprite { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }
const cache = new Map<string, GrassSprite>();
const BOX_W = 104, BOX_H = 80, AX = 52, AY = 68; // 世界像素
export function grassSprite(kind: GrassKind, v: number, season: number, res: number): GrassSprite {
  const key = `${kind}:${v}:${season}:${res}`;
  let s = cache.get(key);
  if (s) return s;
  const cv = makeCanvas(BOX_W * res, BOX_H * res);
  const g = cv.getContext('2d') as G;
  g.scale(res, res); g.translate(AX, AY);
  g.lineJoin = 'round';
  drawClump(g, kind, v, season);
  s = { canvas: cv, w: BOX_W, h: BOX_H, ax: AX, ay: AY };
  cache.set(key, s);
  if (cache.size > 600) { const k0 = cache.keys().next().value as string; cache.delete(k0); }
  return s;
}
export function grassRes(zdpr: number) { return zdpr > 1.6 ? 3 : zdpr > 0.9 ? 2 : 1; }
