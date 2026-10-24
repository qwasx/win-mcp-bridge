import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  小道具のためのキャンバス・テクスチャ生成
 *  (すべて手続き生成・外部アセット無し)
 * ------------------------------------------------------------------ */

export const JP_FONT =
  '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "MS PGothic", "Meiryo", sans-serif';

/** Webフォント（Noto Sans JP）の読み込み完了を待つ */
export async function ensureFonts() {
  try {
    const sample = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const jp = '日本語ひらがなカタカナ営業年中無休自動ドア駐車場非常口関係者以外立入禁止のお知らせ氷火金収集徐行止まれ中央商店街駅前通り新発売濃厚全品弁当焼き魚牛丼幕内案内路地裏口屋外機点字ブロック排水溝';
    await Promise.all([
      document.fonts.load(`800 48px "Noto Sans JP"`, sample + jp),
      document.fonts.load(`700 48px "Noto Sans JP"`, sample + jp),
      document.fonts.load(`400 48px "Noto Sans JP"`, sample + jp),
    ]);
    await document.fonts.ready;
  } catch (e) {
    console.warn('[fonts] load failed, falling back to system fonts', e);
  }
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

export function toTexture(canvas, { srgb = true, flipY = true, aniso = 0, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = flipY;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso || (typeof window !== 'undefined' && window.__maxAniso) || 8;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/* tileable value noise ------------------------------------------------ */
export function valueNoise(size, cells, seed = 1) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const out = new Float32Array(size * size);
  const sc = cells / size;
  for (let y = 0; y < size; y++) {
    const fy = y * sc;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = fy - Math.floor(fy);
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = x * sc;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = fx - Math.floor(fx);
      const sx = tx * tx * (3 - 2 * tx);
      const a = grid[y0 * cells + x0];
      const b = grid[y0 * cells + x1];
      const c = grid[y1 * cells + x0];
      const d = grid[y1 * cells + x1];
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

export function fbm(size, cells, octaves, seed = 1) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, cells * Math.pow(2, o), seed + o * 97);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

/* ------------------------------------------------------------------ *
 *  ベース地面 (16 x 16 m を 1 枚のワールド UV に焼き込み)
 * ------------------------------------------------------------------ */
export const EXTENT = 16;
export const HALF = EXTENT / 2;

export class WorldPaint {
  constructor(size) {
    this.size = size;
    const { c, ctx } = makeCanvas(size);
    this.c = c;
    this.ctx = ctx;
    this.s = size / EXTENT; // px per meter
  }
  px(x) {
    return (x + HALF) * this.s;
  }
  rect(cx, cz, w, d, fill, rot = 0, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.px(cx), this.px(cz));
    if (rot) ctx.rotate(rot);
    ctx.fillStyle = fill;
    ctx.fillRect((-w / 2) * this.s, (-d / 2) * this.s, w * this.s, d * this.s);
    ctx.restore();
  }
  roundRect(cx, cz, w, d, r, fill, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(
      this.px(cx) - (w / 2) * this.s,
      this.px(cz) - (d / 2) * this.s,
      w * this.s,
      d * this.s,
      r * this.s
    );
    ctx.fill();
    ctx.restore();
  }
  circle(cx, cz, r, fill, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(this.px(cx), this.px(cz), r * this.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ring(cx, cz, r, w, stroke, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w * this.s;
    ctx.beginPath();
    ctx.arc(this.px(cx), this.px(cz), r * this.s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  line(x1, z1, x2, z2, w, stroke, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w * this.s;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.px(x1), this.px(z1));
    ctx.lineTo(this.px(x2), this.px(z2));
    ctx.stroke();
    ctx.restore();
  }
  text(x, z, str, size, fill, { rot = 0, weight = 700, align = 'center', font = JP_FONT, alpha = 1 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.px(x), this.px(z));
    if (rot) ctx.rotate(rot);
    ctx.font = `${weight} ${size * this.s}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }
}

/* ---------------------------------- 路面 ---------------------------------- */
export function makeRoadTexture() {
  const S = 1024;
  const wp = new WorldPaint(S);
  const ctx = wp.ctx;
  ctx.fillStyle = '#2b2f38';
  ctx.fillRect(0, 0, S, S);

  // base grain
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n1 = valueNoise(S, 24, 7);
  const n2 = fbm(S, 8, 3, 21);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const g = (n1[i] - 0.5) * 26 + (n2[i] - 0.5) * 30;
    d[p] = Math.max(0, Math.min(255, d[p] + g));
    d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + g));
    d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + g + 4));
  }
  ctx.putImageData(img, 0, 0);

  // patches / repairs
  const rand = mulberry32(5);
  for (let i = 0; i < 16; i++) {
    const x = -8 + rand() * 16;
    const z = -8 + rand() * 16;
    wp.roundRect(x, z, 0.5 + rand() * 1.4, 0.4 + rand() * 1.2, 0.2, '#2b2f37', 0.35 + rand() * 0.3);
  }

  const WHITE = '#e6eaef';
  const WORN = '#c2c8cf';

  /* --- 前面道路 (z: 1.0 → 8.0) --- */
  // センターライン
  for (let x = -8; x < 8; x += 3.2) {
    const skip = x > -3.6 && x < 3.4;
    if (!skip) wp.rect(x + 1, 5.4, 2.0, 0.16, WORN, 0, 0.85);
  }
  // 車線境界（白実線）
  wp.line(-8, 1.45, 8, 1.45, 0.14, WORN, 0.65);
  wp.line(-8, 7.9, 8, 7.9, 0.14, WORN, 0.55);
  // 横断歩道
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.9;
    wp.rect(x, 2.55, 0.55, 3.8, WHITE, 0, 0.92);
  }
  // 停止線
  wp.rect(0.3, 1.15, 5.9, 0.32, WHITE, 0, 0.85);
  // 矢印（進行方向）
  wp.text(-5.6, 5.4, '↑', 0.9, WORN, { rot: Math.PI, alpha: 0.35 });
  wp.text(6.2, 2.6, '↑', 0.9, WORN, { alpha: 0.3 });

  /* --- 路地 (x: -6.6 → -5.2) --- */
  wp.rect(-5.95, -3.0, 0.1, 7.0, WORN, 0, 0.35);
  wp.text(-5.95, -0.2, '止まれ', 0.62, WHITE, { rot: -Math.PI / 2, alpha: 0.55 });
  wp.text(-5.95, -5.2, '徐行', 0.5, WORN, { rot: -Math.PI / 2, alpha: 0.4 });

  /* --- 裏路地 (z: -8 → -6.6) --- */
  wp.rect(-0.7, -7.3, 9.5, 0.1, WORN, 0, 0.3);

  /* --- 駐車場 (x: 5.2 → 8) --- */
  const px = 6.6;
  wp.rect(px, -1.7, 2.3, 5.6, '#2a2e36', 0, 0.35); // 舗装の色味
  for (const lx of [5.5, 6.6, 7.7]) wp.rect(lx, -1.7, 0.14, 5.4, WHITE, 0, 0.85);
  wp.rect(px, 0.9, 2.3, 0.14, WHITE, 0, 0.85);
  wp.text(6.05, -3.9, '1', 0.75, WHITE, { alpha: 0.5 });
  wp.text(7.15, -3.9, '2', 0.75, WHITE, { alpha: 0.5 });
  wp.text(6.6, 0.45, '駐車場', 0.5, WHITE, { alpha: 0.45 });

  // マンホール
  wp.circle(-4.6, 6.4, 0.36, '#3a3f47', 0.9);
  wp.ring(-4.6, 6.4, 0.3, 0.03, '#4a505a', 0.8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    wp.circle(-4.6 + Math.cos(a) * 0.22, 6.4 + Math.sin(a) * 0.22, 0.022, '#2a2e35', 0.7);
  }
  wp.circle(1.4, 7.2, 0.2, '#3a3f47', 0.8);
  wp.ring(1.4, 7.2, 0.15, 0.025, '#4a505a', 0.7);

  // 側溝（道路側の暗い帯）
  wp.rect(0, 1.1, 16, 0.22, '#191c22', 0, 0.9);
  wp.rect(-6.2, -3.0, 0.22, 7.6, '#191c22', 0, 0.85);

  // 汚れ・ウェザリング
  const grime = fbm(S, 12, 3, 88);
  const img2 = ctx.getImageData(0, 0, S, S);
  const e = img2.data;
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const k = 0.86 + grime[i] * 0.3;
    e[p] *= k;
    e[p + 1] *= k;
    e[p + 2] *= k;
  }
  ctx.putImageData(img2, 0, 0);

  return toTexture(wp.c, { flipY: false });
}

/* ---------------------------------- 歩道 ---------------------------------- */
export function makeSidewalkTexture() {
  const S = 1024;
  const wp = new WorldPaint(S);
  const ctx = wp.ctx;
  ctx.fillStyle = '#787a80';
  ctx.fillRect(0, 0, S, S);

  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n1 = valueNoise(S, 32, 3);
  const n2 = fbm(S, 6, 3, 41);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const g = (n1[i] - 0.5) * 20 + (n2[i] - 0.5) * 26;
    d[p] += g;
    d[p + 1] += g;
    d[p + 2] += g;
  }
  ctx.putImageData(img, 0, 0);

  // 目地（0.9 m グリッド）
  const rand = mulberry32(11);
  for (let x = -8; x <= 8; x += 0.9) wp.line(x, -8, x, 8, 0.035, '#53555b', 0.8);
  for (let z = -8; z <= 8; z += 0.9) wp.line(-8, z, 8, z, 0.035, '#53555b', 0.8);
  for (let i = 0; i < 40; i++) {
    wp.roundRect(-8 + rand() * 16, -8 + rand() * 16, 0.1 + rand() * 0.5, 0.08 + rand() * 0.2, 0.05, '#5c5e63', 0.4);
  }

  // 点字ブロック（歩道の前面のへり）
  wp.rect(0, 0.93, 10.4, 0.2, '#c9a94b', 0, 0.95);
  for (let x = -5.2; x < 5.2; x += 0.22) {
    for (let z = 0.85; z < 1.02; z += 0.22) wp.circle(x + 0.06, z, 0.035, '#d8bd63', 0.9);
  }
  // 路地側の点字
  wp.rect(-4.62, -3.0, 0.2, 7.4, '#c9a94b', 0, 0.9);
  for (let z = -6.6; z < 1.0; z += 0.22) {
    for (let x = -4.75; x < -4.55; x += 0.22) wp.circle(x, z + 0.06, 0.035, '#d8bd63', 0.85);
  }

  return toTexture(wp.c, { flipY: false });
}

/* ---------------------------------- 水たまりマスク ---------------------------------- */
export function makePuddleTexture() {
  const S = 512;
  const wp = new WorldPaint(S);
  const ctx = wp.ctx;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, S, S);

  const rand = mulberry32(77);
  const blob = (x, z, rx, rz, a = 0.85) => {
    ctx.save();
    ctx.translate(wp.px(x), wp.px(z));
    ctx.scale(rx * wp.s, rz * wp.s);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.62})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 大きな水たまり（低くなった場所）
  blob(-5.6, 5.2, 2.6, 1.4, 0.95);
  blob(1.2, 3.4, 1.9, 1.1, 0.8);
  blob(-2.6, 6.6, 1.7, 1.0, 0.85);
  blob(5.4, 2.0, 1.5, 1.0, 0.75);
  blob(6.6, -2.4, 1.1, 2.0, 0.9);
  blob(-5.9, -1.8, 0.8, 2.2, 0.9);
  blob(-1.0, -7.3, 2.4, 0.7, 0.95);
  blob(3.0, -7.3, 1.4, 0.6, 0.8);
  blob(6.9, 0.4, 0.7, 1.2, 0.7);
  blob(-3.4, 1.6, 0.9, 0.6, 0.7);
  blob(2.4, 0.6, 0.8, 0.5, 0.6);
  // 小さな無数の水溜り
  for (let i = 0; i < 90; i++) {
    blob(-8 + rand() * 16, -8 + rand() * 16, 0.12 + rand() * 0.5, 0.12 + rand() * 0.5, 0.25 + rand() * 0.5);
  }
  // 側溝沿いの帯
  ctx.save();
  ctx.translate(wp.px(0), wp.px(1.1));
  ctx.scale(8 * wp.s, 0.16 * wp.s);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return toTexture(wp.c, { flipY: false, srgb: false });
}

/* ------------------------------------------------------------------ *
 *  看板・ポスター類
 * ------------------------------------------------------------------ */

export function makeStoreSign() {
  const W = 1024,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(0, 0, W, H);
  // 上部の青帯
  ctx.fillStyle = '#1d63c8';
  ctx.fillRect(0, 0, W, 84);
  // 下部の細い赤帯
  ctx.fillStyle = '#e0463c';
  ctx.fillRect(0, H - 26, W, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 54px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('24時間営業  年中無休', W / 2, 44);

  // ロゴ
  ctx.save();
  ctx.translate(96, 150);
  ctx.fillStyle = '#e0463c';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 40 : 17;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#16305e';
  ctx.font = `800 92px ${JP_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('ほしマート', 152, 152);

  ctx.fillStyle = '#1d63c8';
  ctx.font = `700 44px ${JP_FONT}`;
  ctx.fillText('HOSHI MART', 560, 118);
  ctx.fillStyle = '#6a7a99';
  ctx.font = `600 30px ${JP_FONT}`;
  ctx.fillText('コンビニエンスストア', 560, 168);

  // 右端の小さなサービスマーク
  ctx.fillStyle = '#16305e';
  ctx.font = `700 26px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATM', 940, 118);
  ctx.fillText('コピー', 940, 168);
  ctx.strokeStyle = '#16305e';
  ctx.lineWidth = 4;
  ctx.strokeRect(890, 92, 100, 100);

  return toTexture(c);
}

export function makeFasciaStrip() {
  const W = 1024,
    H = 128;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#e8eaee';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d63c8';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#e0463c';
  ctx.fillRect(0, H - 14, W, 14);
  ctx.fillStyle = '#3b4761';
  ctx.font = `700 46px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('コンビニエンスストア  ・  ほしマート  ・  24h OPEN  ・  ATM  ・  宅配', W / 2, H / 2 + 4);
  return toTexture(c);
}

export function makeVerticalSign() {
  const W = 256,
    H = 768;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#16305e';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, 22);
  ctx.fillRect(0, H - 22, W, 22);

  // 星マーク
  ctx.save();
  ctx.translate(W / 2, 96);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 40 : 17;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 96px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const t = 'ほしマート';
  for (let i = 0; i < t.length; i++) ctx.fillText(t[i], W / 2, 200 + i * 104);

  ctx.fillStyle = '#7fd4ff';
  ctx.font = `700 54px ${JP_FONT}`;
  ctx.fillText('２４', W / 2, 640);
  ctx.font = `700 40px ${JP_FONT}`;
  ctx.fillText('営業', W / 2, 700);
  return toTexture(c);
}

export function makeVendingFront(kind = 0) {
  const W = 512,
    H = 1024;
  const { c, ctx } = makeCanvas(W, H);
  const rand = mulberry32(kind === 0 ? 3 : 19);

  const themes = [
    { bg: '#13243c', head: '#ff5a4e', brand: 'COLA', accent: '#ffd23f' },
    { bg: '#10281f', head: '#3ec98a', brand: 'お茶・水', accent: '#bff0d0' },
  ];
  const th = themes[kind] || themes[0];

  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, W, H);
  // 本体枠
  ctx.fillStyle = th.bg;
  ctx.fillRect(16, 16, W - 32, H - 32);

  // 上部ヘッダー
  ctx.fillStyle = th.head;
  ctx.fillRect(28, 28, W - 56, 132);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 72px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(th.brand, W / 2, 96);

  // 陳列棚
  const cols = 4;
  const rows = 5;
  const x0 = 44,
    y0 = 186;
  const cw = (W - 88) / cols;
  const ch = 132;
  const canColors = [
    '#e23b3b',
    '#2f7fd8',
    '#3fae5a',
    '#f0a92b',
    '#8a5fd0',
    '#e9eef5',
    '#2ba7a0',
    '#e2658c',
    '#5b6b8c',
    '#d94f2b',
  ];
  for (let r = 0; r < rows; r++) {
    // 棚板
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(28, y0 + r * ch + 108, W - 56, 12);
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const cx = x0 + cIdx * cw;
      const col = canColors[Math.floor(rand() * canColors.length)];
      const bh = 74 + rand() * 22;
      // 缶
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(cx + 12, y0 + r * ch + (108 - bh), cw - 24, bh, 12);
      ctx.fill();
      // ラベル
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(cx + 12, y0 + r * ch + (108 - bh) + bh * 0.32, cw - 24, bh * 0.3);
      ctx.fillStyle = 'rgba(15,18,24,0.75)';
      ctx.font = `700 17px ${JP_FONT}`;
      ctx.fillText('150', cx + cw / 2, y0 + r * ch + (108 - bh) + bh * 0.47);
      // ハイライト
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(cx + 18, y0 + r * ch + (108 - bh), 8, bh);
    }
  }
  // 広告帯
  ctx.fillStyle = th.accent;
  ctx.fillRect(28, H - 250, W - 56, 74);
  ctx.fillStyle = '#151a22';
  ctx.font = `800 46px ${JP_FONT}`;
  ctx.fillText(kind === 0 ? 'つめたい！' : ' NEW ', W / 2, H - 212);

  // 取り出し口・ボタン
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(44, H - 160, W - 88, 130);
  ctx.fillStyle = '#262c36';
  ctx.fillRect(70, H - 140, W - 140, 96);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['#ff5a4e', '#ffd23f', '#3ec98a', '#7fd4ff'][i];
    ctx.beginPath();
    ctx.arc(110 + i * ((W - 220) / 3), H - 92, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
}

export function makeMenuBoard() {
  const W = 768,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#fdfaf3';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c8342f';
  ctx.fillRect(0, 0, W, 42);
  ctx.fillStyle = '#fff';
  ctx.font = `800 30px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ホットスナック・おでん・コーヒー', W / 2, 23);

  const items = [
    ['ホットコーヒー', '¥120', '#f6d9b0'],
    ['アイスカフェオレ', '¥180', '#e8dcc8'],
    ['おでん（たまご）', '¥130', '#f6e6c8'],
    ['フライドチキン', '¥220', '#f0c98a'],
    ['中華まん（肉）', '¥150', '#f2e2cc'],
    ['焼きとうもろこし', '¥180', '#f7e08a'],
  ];
  items.forEach(([name, price, col], i) => {
    const x = (i % 3) * 256;
    const y = 42 + Math.floor(i / 3) * 107;
    ctx.fillStyle = col;
    ctx.fillRect(x + 8, y + 8, 240, 94);
    ctx.fillStyle = '#5b4a33';
    ctx.font = `700 26px ${JP_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(name, x + 20, y + 42);
    ctx.fillStyle = '#c8342f';
    ctx.font = `800 34px ${JP_FONT}`;
    ctx.fillText(price, x + 20, y + 80);
  });
  return toTexture(c);
}

export function makeBulletinBoard() {
  const W = 512,
    H = 384;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(23);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${90 + rand() * 60 | 0},${70 + rand() * 40 | 0},${45 + rand() * 30 | 0},0.5)`;
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
  ctx.strokeStyle = '#5e4527';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  const papers = [
    [60, 50, 150, 120, '#f6f4ec'],
    [240, 40, 170, 130, '#e9f1fb'],
    [80, 200, 160, 120, '#fdf1d8'],
    [270, 200, 150, 130, '#eef7ec'],
    [440, 90, 60, 90, '#f6f4ec'],
    [440, 210, 60, 80, '#fdf1d8'],
  ];
  papers.forEach(([x, y, w, h, col], i) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rand() - 0.5) * 0.09);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    ctx.fillStyle = col;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // 内容
    ctx.fillStyle = ['#c8342f', '#1d63c8', '#3fae5a', '#e08a1e'][i % 4];
    ctx.fillRect(-w / 2 + 10, -h / 2 + 12, w - 20, 18);
    ctx.fillStyle = '#9aa0a8';
    for (let l = 0; l < Math.floor(h / 20) - 2; l++) {
      ctx.fillRect(-w / 2 + 10, -h / 2 + 44 + l * 15, (w - 30) * (0.5 + rand() * 0.5), 6);
    }
    // 画鋲
    ctx.fillStyle = '#e0463c';
    ctx.beginPath();
    ctx.arc(0, -h / 2 + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  return toTexture(c);
}

export function makeAFrameSign() {
  const W = 256,
    H = 384;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#15171d';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `800 40px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('本日の', W / 2, 56);
  ctx.fillText('おすすめ', W / 2, 104);
  ctx.fillStyle = '#fff2cc';
  ctx.font = `800 46px ${JP_FONT}`;
  ctx.fillText('お弁当', W / 2, 180);
  ctx.fillStyle = '#e0463c';
  ctx.font = `800 58px ${JP_FONT}`;
  ctx.fillText('¥ 450', W / 2, 250);
  ctx.fillStyle = '#7fd4ff';
  ctx.font = `700 28px ${JP_FONT}`;
  ctx.fillText('＋ お茶 100円', W / 2, 306);
  ctx.fillStyle = '#8a93a5';
  ctx.font = `700 22px ${JP_FONT}`;
  ctx.fillText('ほしマート', W / 2, 350);
  return toTexture(c);
}

export function makeStreetSign() {
  const W = 512,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#1f6b4a';
  ctx.fillRect(0, 0, W, H / 2 - 4);
  ctx.fillStyle = '#1d5fa8';
  ctx.fillRect(0, H / 2 + 4, W, H / 2 - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H / 2 - 8);
  ctx.strokeRect(2, H / 2 + 6, W - 4, H / 2 - 8);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 52px ${JP_FONT}`;
  ctx.fillText('中央 商店街', W / 2, 64);
  ctx.font = `700 26px ${JP_FONT}`;
  ctx.fillText('CHUO SHOTENGAI', W / 2, 108);

  ctx.font = `800 46px ${JP_FONT}`;
  ctx.fillText('← 駅前  300m', W / 2, 168);
  ctx.font = `700 40px ${JP_FONT}`;
  ctx.fillText('P  駐車場 →', W / 2, 218);
  return toTexture(c);
}

export function makeWindowPoster(kind = 0) {
  const W = 512,
    H = 768;
  const { c, ctx } = makeCanvas(W, H);
  const themes = [
    { bg: 'rgba(255,247,225,0.94)', a: '#e0463c', t: '大セール', s: '全品', p: '10%OFF' },
    { bg: 'rgba(232,244,255,0.94)', a: '#1d63c8', t: '新発売', s: '濃厚', p: 'プリン' },
    { bg: 'rgba(255,240,240,0.94)', a: '#c8342f', t: 'おでん', s: 'あったか', p: '¥130〜' },
  ];
  const th = themes[kind % themes.length];
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = th.a;
  ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = '#fff';
  ctx.font = `800 84px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(th.t, W / 2, 70);
  ctx.fillStyle = th.a;
  ctx.font = `800 96px ${JP_FONT}`;
  ctx.fillText(th.s, W / 2, 300);
  ctx.fillStyle = '#2b3040';
  ctx.font = `800 108px ${JP_FONT}`;
  ctx.fillText(th.p, W / 2, 450);
  ctx.fillStyle = th.a;
  ctx.fillRect(60, 560, W - 120, 12);
  ctx.fillStyle = '#4a5163';
  ctx.font = `700 40px ${JP_FONT}`;
  ctx.fillText('ほしマート全店', W / 2, 640);
  ctx.font = `700 30px ${JP_FONT}`;
  ctx.fillText('2026.10.31 まで', W / 2, 700);
  return toTexture(c);
}

export function makeInteriorFloor() {
  // 店内床 (x: -4.3 → 4.3 / z: -6.2 → -0.8)
  const S = 1024;
  const { c, ctx } = makeCanvas(S, S);
  const WX = 8.6,
    WZ = 5.4;
  const sx = S / WX,
    sz = S / WZ;
  const px = (x) => (x + 4.3) * sx;
  const pz = (z) => (z + 6.2) * sz;

  ctx.fillStyle = '#e9e3d6';
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n = valueNoise(S, 20, 9);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const g = (n[i] - 0.5) * 14;
    d[p] += g;
    d[p + 1] += g;
    d[p + 2] += g;
  }
  ctx.putImageData(img, 0, 0);

  // タイル目地
  ctx.strokeStyle = 'rgba(150,144,130,0.55)';
  ctx.lineWidth = 2;
  for (let x = -4.3; x <= 4.3; x += 0.5) {
    ctx.beginPath();
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), S);
    ctx.stroke();
  }
  for (let z = -6.2; z <= -0.8; z += 0.5) {
    ctx.beginPath();
    ctx.beginPath();
    ctx.moveTo(0, pz(z));
    ctx.lineTo(S, pz(z));
    ctx.stroke();
  }

  // 通路の誘導ライン（明るい帯）
  ctx.fillStyle = 'rgba(255,214,120,0.30)';
  ctx.fillRect(px(-1.0), 0, 1.4 * sx, S); // 入口通路
  ctx.fillStyle = 'rgba(120,200,255,0.16)';
  ctx.fillRect(0, pz(-5.05), S, 0.5 * sz); // 奥の横通路

  // 矢印
  ctx.fillStyle = 'rgba(255,190,80,0.55)';
  ctx.font = `800 46px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▼', px(-0.3), pz(-1.6));
  ctx.fillText('▼', px(-0.3), pz(-3.2));
  ctx.fillText('▶', px(2.6), pz(-2.2));
  ctx.fillStyle = 'rgba(90,110,140,0.45)';
  ctx.font = `700 34px ${JP_FONT}`;
  ctx.fillText('レジ', px(3.4), pz(-1.2));
  ctx.fillText('お弁当', px(-3.6), pz(-1.2));
  ctx.fillText('ドリンク', px(-0.6), pz(-5.85));

  return toTexture(c, { flipY: false });
}

export function makeTileWallTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#f2efe7';
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n = valueNoise(S, 16, 4);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const g = (n[i] - 0.5) * 10;
    d[p] += g;
    d[p + 1] += g;
    d[p + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(190,186,176,0.7)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    const v = (i / 8) * S;
    ctx.beginPath();
    ctx.moveTo(v, 0);
    ctx.lineTo(v, S);
    ctx.moveTo(0, v);
    ctx.lineTo(S, v);
    ctx.stroke();
  }
  return toTexture(c, { repeat: [1, 1] });
}

export function makeBackRoomSign() {
  const W = 256,
    H = 96;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f4f2ea';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2b3040';
  ctx.font = `800 34px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('関係者以外', W / 2, 30);
  ctx.fillText('立入禁止', W / 2, 68);
  return toTexture(c);
}

export function makeAlleySign() {
  const W = 512,
    H = 128;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f6f4ec';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2b3040';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = '#2b3040';
  ctx.font = `700 52px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('路地  →  駐車場 / 裏口', W / 2, H / 2);
  return toTexture(c);
}

export function makeNoticeSign() {
  const W = 256,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f4f2ea';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c8342f';
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = '#fff';
  ctx.font = `800 34px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('お知らせ', W / 2, 28);
  ctx.fillStyle = '#3a4152';
  ctx.font = `700 24px ${JP_FONT}`;
  ctx.fillText('営業時間', W / 2, 92);
  ctx.fillText('24時間', W / 2, 128);
  ctx.fillText('ATM 24h', W / 2, 164);
  ctx.fillStyle = '#8a93a5';
  ctx.font = `700 20px ${JP_FONT}`;
  ctx.fillText('ほしマート', W / 2, 210);
  return toTexture(c);
}

export function makeBentoLabel(kind = 0) {
  const W = 128,
    H = 96;
  const { c, ctx } = makeCanvas(W, H);
  const cols = ['#e0463c', '#3fae5a', '#e0a01e', '#1d63c8', '#c8342f'];
  ctx.fillStyle = '#fbf7ee';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = cols[kind % cols.length];
  ctx.fillRect(0, 0, W, 30);
  ctx.fillStyle = '#fff';
  ctx.font = `800 20px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(['のり弁', 'から揚げ', '焼き魚', '牛丼', '幕の内'][kind % 5], W / 2, 16);
  ctx.fillStyle = '#5a5f6c';
  ctx.font = `700 18px ${JP_FONT}`;
  ctx.fillText('¥' + [420, 480, 460, 540, 520][kind % 5], W / 2, 62);
  return toTexture(c);
}

export function makeMagazineSpines() {
  const W = 512,
    H = 128;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f6f3ea';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(31);
  const cols = ['#e0463c', '#1d63c8', '#3fae5a', '#e0a01e', '#8a5fd0', '#2b3040', '#e2658c'];
  let x = 8;
  while (x < W - 20) {
    const w = 18 + rand() * 22;
    ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
    ctx.fillRect(x, 10, w, H - 20);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x + 3, 22, w - 6, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 3, 44, w - 6, 6);
    ctx.fillRect(x + 3, 56, w - 10, 6);
    x += w + 3;
  }
  return toTexture(c);
}

export function makeDrinkShelf() {
  const W = 512,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#f3f7fb';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(53);
  const cols = ['#e23b3b', '#2f7fd8', '#3fae5a', '#f0a92b', '#8a5fd0', '#2ba7a0', '#e9eef5', '#e2658c'];
  for (let r = 0; r < 3; r++) {
    ctx.fillStyle = '#c9d3dd';
    ctx.fillRect(0, 84 * r + 78, W, 6);
    let x = 6;
    while (x < W - 14) {
      const w = 20 + rand() * 14;
      const h = 44 + rand() * 22;
      ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
      ctx.beginPath();
      ctx.roundRect(x, 84 * r + (78 - h), w, h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x + 2, 84 * r + (78 - h) + h * 0.3, w - 4, h * 0.26);
      x += w + 3;
    }
  }
  return toTexture(c);
}

export function makeGarbageTexture() {
  const W = 256,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#2f6f4a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#255840';
  ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = '#fff';
  ctx.font = `800 34px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('燃えるゴミ', W / 2, 110);
  ctx.font = `700 24px ${JP_FONT}`;
  ctx.fillText('火・金 収集', W / 2, 160);
  return toTexture(c);
}

export function makeDoorMatTexture() {
  const W = 512,
    H = 256;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(61);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(${20 + rand() * 40 | 0},${22 + rand() * 40 | 0},${26 + rand() * 40 | 0},0.6)`;
    ctx.fillRect(rand() * W, rand() * H, 3, 3);
  }
  ctx.strokeStyle = '#5c6673';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.fillStyle = '#c9d1da';
  ctx.font = `800 66px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('いらっしゃいませ', W / 2, H / 2);
  return toTexture(c);
}

export function makeConcreteTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#8e8f92';
  ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n1 = valueNoise(S, 12, 12);
  const n2 = valueNoise(S, 48, 33);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) {
    const g = (n1[i] - 0.5) * 26 + (n2[i] - 0.5) * 14;
    d[p] += g;
    d[p + 1] += g;
    d[p + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
  // ブロック塺の目地
  ctx.strokeStyle = 'rgba(110,111,115,0.8)';
  ctx.lineWidth = 3;
  for (let y = 0; y <= S; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  for (let y = 0; y <= S; y += 64) {
    const off = (y / 64) % 2 === 0 ? 0 : 64;
    for (let x = off; x <= S; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 64);
      ctx.stroke();
    }
  }
  return toTexture(c, { repeat: [1, 1] });
}

export function makeBuildingFacade(seed = 1, floors = 3, litRatio = 0.3) {
  const W = 512,
    H = 768;
  const { c, ctx } = makeCanvas(W, H);
  const rand = mulberry32(seed);
  ctx.fillStyle = '#3b3f47';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const n = fbm(64, 4, 3, seed * 13);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const g = (n[(y % 64) * 64 + (x % 64)] - 0.5) * 34;
      d[p] += g;
      d[p + 1] += g;
      d[p + 2] += g;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 階のライン
  const fh = H / floors;
  for (let f = 0; f < floors; f++) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, f * fh, W, 10);
    const cols = 3;
    for (let i = 0; i < cols; i++) {
      const wx = 40 + i * ((W - 80) / cols);
      const wy = f * fh + 40;
      const ww = (W - 80) / cols - 30;
      const wh = fh - 90;
      const lit = rand() < litRatio;
      // 窓
      ctx.fillStyle = '#20242c';
      ctx.fillRect(wx, wy, ww, wh);
      if (lit) {
        const g = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        g.addColorStop(0, 'rgba(255,214,150,0.95)');
        g.addColorStop(1, 'rgba(255,180,110,0.7)');
        ctx.fillStyle = g;
        ctx.fillRect(wx, wy, ww, wh);
        // カーテン
        ctx.fillStyle = 'rgba(60,50,40,0.45)';
        ctx.fillRect(wx, wy, ww * (0.2 + rand() * 0.3), wh);
      } else {
        ctx.fillStyle = 'rgba(90,120,160,0.16)';
        ctx.fillRect(wx, wy, ww, wh);
      }
      ctx.strokeStyle = 'rgba(20,22,28,0.9)';
      ctx.lineWidth = 6;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
    }
  }
  return toTexture(c);
}
