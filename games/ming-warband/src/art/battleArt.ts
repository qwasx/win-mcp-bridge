// 战场美术：地面、树木、房屋、城墙城楼
import { type Ctx, makeCanvas, css, shade, mix, srand, OUTLINE } from './canvas';
import { pack, type Atlas, drawBroadleaf, drawConifer, drawRock, roof, ell, poly } from './mapArt';
import { fbm } from '../core/rng';
import { Ter } from '../core/terrain';
import type { BattleField } from '../scenes/battle/field';

export const BRES = 2;
export const WALL_H = 34; // 城墙高度（视觉）

// ---------- 树木、灌木、石头 ----------
function bush(ctx: Ctx, w: number, col: number, seed: number) {
  const r = srand(seed);
  ell(ctx, 1, 0, w * 0.55, w * 0.16, 'rgba(10,20,5,0.3)');
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * w * 0.7, y = -w * 0.25 - r() * w * 0.2, rr = w * (0.18 + r() * 0.12);
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.4, 0, x, y, rr);
    g.addColorStop(0, css(shade(col, 0.25))); g.addColorStop(1, css(shade(col, -0.2)));
    ell(ctx, x, y, rr, rr * 0.9, g);
  }
}

/** 3/4 视角的民居 */
function bigHouse(ctx: Ctx, w: number, h: number, roofCol: number, wallCol: number, seed: number) {
  const r = srand(seed);
  ell(ctx, w * 0.08, 0, w * 0.62, h * 0.12, 'rgba(0,0,0,0.25)');
  const wallH = h * 0.42;
  // 墙面
  ctx.fillStyle = css(wallCol); ctx.fillRect(-w / 2, -wallH, w, wallH);
  // 墙基
  ctx.fillStyle = '#6e6658'; ctx.fillRect(-w / 2, -wallH * 0.18, w, wallH * 0.18);
  // 木柱
  ctx.fillStyle = '#5a3420';
  for (let i = 0; i <= 4; i++) ctx.fillRect(-w / 2 + (w - 2) * i / 4, -wallH, 2, wallH);
  // 门
  ctx.fillStyle = '#3a2214'; ctx.fillRect(-w * 0.09, -wallH * 0.8, w * 0.18, wallH * 0.8);
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-w * 0.08, -wallH * 0.78, w * 0.075, wallH * 0.76); ctx.fillRect(w * 0.005, -wallH * 0.78, w * 0.075, wallH * 0.76);
  // 窗格
  for (const wx of [-w * 0.3, w * 0.3]) {
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(wx - w * 0.08, -wallH * 0.75, w * 0.16, wallH * 0.38);
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 0.6;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(wx - w * 0.08 + k * w * 0.04, -wallH * 0.75); ctx.lineTo(wx - w * 0.08 + k * w * 0.04, -wallH * 0.37); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(wx - w * 0.08, -wallH * 0.56); ctx.lineTo(wx + w * 0.08, -wallH * 0.56); ctx.stroke();
  }
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.strokeRect(-w / 2, -wallH, w, wallH);
  // 屋顶
  roof(ctx, 0, -wallH + 1, w * 1.08, h * 0.6, roofCol);
  if (r() < 0.4) { ctx.fillStyle = 'rgba(90,70,40,0.9)'; ctx.fillRect(w * 0.25, -wallH - h * 0.5, 3, 6); }
}

/** 城楼（城门两侧的墩台 + 楼阁），锚点在地面前沿中心 */
function gateTowerBig(ctx: Ctx, w: number, depthTop: number, H: number) {
  ell(ctx, w * 0.1, 0, w * 0.62, 6, 'rgba(0,0,0,0.3)');
  // 前立面（砖）
  const g = ctx.createLinearGradient(0, -H, 0, 0);
  g.addColorStop(0, '#9c907a'); g.addColorStop(1, '#6e6250');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -H, w, H);
  ctx.strokeStyle = 'rgba(50,40,28,0.45)'; ctx.lineWidth = 0.5;
  for (let y = -H + 4, k = 0; y < 0; y += 4, k++) {
    ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke();
    for (let x = -w / 2 + (k % 2) * 4; x < w / 2; x += 8) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(30,20,10,0.25)'; ctx.fillRect(-w / 2, -6, w, 6);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -H, w, H);
  // 顶面
  ctx.fillStyle = '#bdb194'; ctx.fillRect(-w / 2, -H - depthTop, w, depthTop);
  ctx.strokeStyle = OUTLINE; ctx.strokeRect(-w / 2, -H - depthTop, w, depthTop);
  // 垛口
  ctx.fillStyle = '#8a7e66';
  for (let x = -w / 2; x < w / 2 - 3; x += 7) { ctx.fillRect(x, -H - 4, 4.5, 4); ctx.fillStyle = '#a89c80'; ctx.fillRect(x, -H - 6, 4.5, 2); ctx.fillStyle = '#8a7e66'; }
  // 楼阁
  const by = -H - depthTop * 0.35;
  const pw = w * 0.78;
  ctx.fillStyle = '#a8281e'; ctx.fillRect(-pw / 2, by - 16, pw, 16);
  ctx.fillStyle = 'rgba(30,12,6,0.6)';
  for (let k = 0; k < 6; k++) ctx.fillRect(-pw / 2 + 3 + k * (pw - 6) / 6, by - 14, (pw - 6) / 6 - 3, 12);
  ctx.strokeStyle = '#d8b050'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-pw / 2, by - 15.5); ctx.lineTo(pw / 2, by - 15.5); ctx.stroke();
  roof(ctx, 0, by - 15, pw * 1.22, 14);
  ctx.fillStyle = '#a8281e'; ctx.fillRect(-pw * 0.32, by - 37, pw * 0.64, 9);
  roof(ctx, 0, by - 28, pw * 0.86, 11);
}

/** 城墙端面（北段城墙的南端），锚点在地面前沿中心 */
function wallEnd(ctx: Ctx, w: number, H: number) {
  const g = ctx.createLinearGradient(0, -H, 0, 0);
  g.addColorStop(0, '#988c76'); g.addColorStop(1, '#6a5e4c');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -H, w, H);
  ctx.strokeStyle = 'rgba(50,40,28,0.45)'; ctx.lineWidth = 0.5;
  for (let y = -H + 4, k = 0; y < 0; y += 4, k++) {
    ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke();
    for (let x = -w / 2 + (k % 2) * 4; x < w / 2; x += 8) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -H, w, H);
}

function stakes(ctx: Ctx) {
  // 拒马
  ell(ctx, 0, 0, 14, 3, 'rgba(0,0,0,0.25)');
  ctx.lineCap = 'round';
  for (const [x0, x1] of [[-12, -4], [-4, 4], [4, 12]]) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1 + 3, -11); ctx.moveTo(x1, 0); ctx.lineTo(x0 - 3, -11); ctx.stroke();
    ctx.strokeStyle = '#8a6038'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1 + 3, -11); ctx.moveTo(x1, 0); ctx.lineTo(x0 - 3, -11); ctx.stroke();
  }
  ctx.strokeStyle = '#6a4828'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(14, -5); ctx.stroke();
}

export function buildBattleAtlas(): Atlas {
  const items: Parameters<typeof pack>[0] = [];
  const greens = [0x3e6a34, 0x4a7a3a, 0x355e30, 0x58883e];
  for (let i = 0; i < 4; i++) { const h = 46 + i * 7; items.push({ name: `tree${i}`, w: h * 1.05, h: h + 4, ax: h * 0.52, ay: h + 1, draw: c => drawBroadleaf(c, h, greens[i], 70 + i * 3) }); }
  for (let i = 0; i < 3; i++) { const h = 50 + i * 9; items.push({ name: `pine${i}`, w: h * 0.72, h: h + 4, ax: h * 0.36, ay: h + 1, draw: c => drawConifer(c, h, greens[i] - 0x060606) }); }
  for (let i = 0; i < 3; i++) { const w = 14 + i * 5; items.push({ name: `bush${i}`, w: w * 1.2, h: w * 0.8, ax: w * 0.6, ay: w * 0.7, draw: c => bush(c, w, greens[(i + 1) % 4], 20 + i) }); }
  for (let i = 0; i < 3; i++) { const w = 8 + i * 6; items.push({ name: `rock${i}`, w: w * 1.3, h: w * 0.9, ax: w * 0.65, ay: w * 0.75, draw: c => drawRock(c, w) }); }
  const roofs = [0x3d4652, 0x4a4440, 0x3a4048, 0x5a4a3a];
  const walls = [0xe8dcc0, 0xd8c8a8, 0xe0d0b0, 0xcab898];
  for (let i = 0; i < 4; i++) { const w = 44 + i * 6, h = 38 + (i % 2) * 6; items.push({ name: `house${i}`, w: w * 1.3, h: h * 1.25, ax: w * 0.65, ay: h * 1.15, draw: c => bigHouse(c, w, h, roofs[i], walls[i], 5 + i) }); }
  items.push({ name: 'gatetower', w: 80, h: 110, ax: 40, ay: 104, draw: c => gateTowerBig(c, 60, 40, WALL_H + 8) });
  items.push({ name: 'wallend', w: 34, h: WALL_H + 4, ax: 17, ay: WALL_H + 2, draw: c => wallEnd(c, 30, WALL_H) });
  items.push({ name: 'stakes', w: 34, h: 18, ax: 17, ay: 15, draw: c => stakes(c) });
  return pack(items, BRES, 2048);
}

/** 城墙顶面（一整段），宽 w，长 len（逻辑单位） */
export function buildWallTop(len: number, w = 30) {
  const cv = makeCanvas((w + 8) * BRES, len * BRES);
  const ctx = cv.getContext('2d')!;
  ctx.scale(BRES, BRES); ctx.translate(4, 0);
  // 马道
  ctx.fillStyle = '#b4a888'; ctx.fillRect(0, 0, w, len);
  ctx.strokeStyle = 'rgba(80,66,46,0.35)'; ctx.lineWidth = 0.5;
  for (let y = 0; y < len; y += 6) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); }
  for (let y = 0, k = 0; y < len; y += 6, k++) for (let x = 4 + (k % 2) * 5; x < w - 4; x += 10) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke(); }
  // 外侧（西）垛口与内侧（东）女墙
  for (let y = 2; y < len - 4; y += 10) {
    ctx.fillStyle = '#8c8068'; ctx.fillRect(-2, y, 7, 6.5);
    ctx.fillStyle = '#ccc0a2'; ctx.fillRect(-2, y - 2, 7, 3);
    ctx.strokeStyle = 'rgba(30,22,12,0.7)'; ctx.lineWidth = 0.5; ctx.strokeRect(-2, y - 2, 7, 8.5);
  }
  ctx.fillStyle = '#9a8e74'; ctx.fillRect(w - 4, 0, 5, len);
  ctx.fillStyle = '#c8bc9e'; ctx.fillRect(w - 4, 0, 5, 1.5);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.strokeRect(-2, 0, w + 3, len);
  return cv;
}

// ---------- 地面 ----------
const GROUND: Record<number, { a: number[]; b: number[]; dirt: number[]; tuft: number; flowers: boolean }> = {
  [Ter.Plain]: { a: [98, 132, 62], b: [134, 150, 78], dirt: [132, 112, 76], tuft: 0x4a6a2a, flowers: true },
  [Ter.Steppe]: { a: [146, 150, 82], b: [176, 166, 98], dirt: [150, 128, 88], tuft: 0x7a7a3a, flowers: true },
  [Ter.Forest]: { a: [64, 96, 48], b: [90, 116, 58], dirt: [102, 86, 58], tuft: 0x2e4a20, flowers: false },
  [Ter.Hills]: { a: [112, 122, 70], b: [142, 136, 86], dirt: [140, 120, 84], tuft: 0x5a6a30, flowers: true },
  [Ter.Mountain]: { a: [116, 112, 94], b: [136, 128, 104], dirt: [104, 96, 82], tuft: 0x5a6040, flowers: false },
  [Ter.Desert]: { a: [196, 174, 122], b: [212, 190, 136], dirt: [176, 150, 104], tuft: 0x8a7a40, flowers: false },
  [Ter.Plateau]: { a: [146, 142, 126], b: [170, 166, 148], dirt: [124, 116, 100], tuft: 0x6a6a4a, flowers: false },
};

export interface GroundOpts { night: boolean; snow?: number; wet?: number }

/** 粗网格上的噪声场，按像素双线性插值（大战场也能快速绘制） */
function coarseField(W: number, H: number, step: number, fn: (x: number, y: number) => number) {
  const cw = Math.ceil(W / step) + 2, ch = Math.ceil(H / step) + 2;
  const a = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) a[j * cw + i] = fn(i * step, j * step);
  return { a, cw, step };
}
function sampleRow(f: { a: Float32Array; cw: number; step: number }, y: number, out: Float32Array) {
  const s = f.step, j = Math.floor(y / s), fy = y / s - j, cw = f.cw, a = f.a;
  const r0 = j * cw, r1 = r0 + cw;
  for (let x = 0; x < out.length; x++) {
    const i = Math.floor(x / s), fx = x / s - i;
    const v0 = a[r0 + i] + (a[r0 + i + 1] - a[r0 + i]) * fx;
    const v1 = a[r1 + i] + (a[r1 + i + 1] - a[r1 + i]) * fx;
    out[x] = v0 + (v1 - v0) * fy;
  }
}
function hashN(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function paintBattleGround(F: BattleField, o: GroundOpts) {
  const { W, H } = F;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d')!;
  const P = GROUND[F.terrain] ?? GROUND[Ter.Plain];
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const seed = F.seed;
  const snow = o.snow ?? 0, wet = o.wet ?? 0;
  const sg = F.siege;
  const fN = coarseField(W, H, 8, (x, y) => fbm(x * 0.005, y * 0.005, seed, 4));
  const fN2 = coarseField(W, H, 4, (x, y) => fbm(x * 0.03, y * 0.03, seed + 5, 2));
  const fD = coarseField(W, H, 6, (x, y) => fbm(x * 0.012, y * 0.012, seed + 21, 3));
  const fP = wet > 0.05 ? coarseField(W, H, 4, (x, y) => fbm(x * 0.022, y * 0.022, seed + 77, 2)) : null;
  // 山丘：高度与光照（西北光）
  const fH = coarseField(W, H, 8, (x, y) => F.heightAt(x, y));
  const fS = coarseField(W, H, 8, (x, y) => { const e = 6; return (F.heightAt(x - e, y - e) - F.heightAt(x + e, y + e)) / (2 * e); });
  const fW = F.groves.length ? coarseField(W, H, 8, (x, y) => { let m = 0; for (const g of F.groves) { const k = 1 - Math.hypot(x - g.x, y - g.y) / (g.r * 1.15); if (k > m) m = k; } return m; }) : null;
  const rv = F.river;
  const rN = new Float32Array(W), rN2 = new Float32Array(W), rD = new Float32Array(W), rP = new Float32Array(W), rH = new Float32Array(W), rS = new Float32Array(W), rW = new Float32Array(W);
  const hasRoad = F.hasRoad;
  for (let y = 0; y < H; y++) {
    sampleRow(fN, y, rN); sampleRow(fN2, y, rN2); sampleRow(fD, y, rD); sampleRow(fH, y, rH); sampleRow(fS, y, rS);
    if (fP) sampleRow(fP, y, rP);
    if (fW) sampleRow(fW, y, rW);
    const rcY = rv && !rv.ns ? 0 : 0;
    const rcX = rv && rv.ns ? F.riverPos(rv, y) : 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = rN[x], n2 = rN2[x];
      const n3 = (hashN(x >> 1, y >> 1) + hashN(x, y)) * 0.5;
      const t = Math.min(1, Math.max(0, (n - 0.35) * 2.2));
      let r = P.a[0] + (P.b[0] - P.a[0]) * t, g = P.a[1] + (P.b[1] - P.a[1]) * t, b = P.a[2] + (P.b[2] - P.a[2]) * t;
      const k = 0.9 + n2 * 0.16 + (n3 - 0.5) * 0.08;
      r *= k; g *= k; b *= k;
      let dm = Math.min(0.85, Math.max(0, (rD[x] - 0.62) * 4));
      if (hasRoad) {
        const dd = Math.abs(y - F.roadY(x));
        if (dd < 26) { const rm = dd < 16 ? 0.85 : (26 - dd) / 10 * 0.85; dm = Math.max(dm, rm * (0.85 + n3 * 0.15)); }
        if (Math.abs(dd - 7) < 1.3) dm = Math.min(1, dm + 0.1);
      }
      // 林下：更暗、落叶
      if (fW && rW[x] > 0) { const wk = Math.min(1, rW[x] * 2.2); r *= 1 - 0.22 * wk; g *= 1 - 0.14 * wk; b *= 1 - 0.2 * wk; dm *= 1 - wk * 0.6; if (n3 > 0.8) { r += 20 * wk; g += 8 * wk; } }
      if (dm > 0) { const q = 0.92 + n3 * 0.16; r += (P.dirt[0] * q - r) * dm; g += (P.dirt[1] * q - g) * dm; b += (P.dirt[2] * q - b) * dm; }
      // 山丘光照
      const sh = Math.max(-0.28, Math.min(0.24, rS[x] * 1.4)) + rH[x] * 0.0022;
      r *= 1 + sh; g *= 1 + sh; b *= 1 + sh * 0.8;
      // 等高线（淡）
      if (rH[x] > 6 && Math.abs((rH[x] % 9) - 4.5) < 0.18) { r *= 0.95; g *= 0.95; b *= 0.95; }
      // 城内石板地
      if (sg && x > sg.wallX + 14) {
        const tile = ((x >> 4) + (y >> 4)) % 2;
        const edge = (x % 16 < 1 || y % 16 < 1) ? 0.78 : 1;
        const base = 128 + tile * 8 + (n3 - 0.5) * 20;
        r = (base + 6) * edge; g = (base + 2) * edge; b = (base - 8) * edge;
      }
      // 河流
      if (rv) {
        const dist = rv.ns ? Math.abs(x - rcX) : Math.abs(y - F.riverPos(rv, x));
        const hw = rv.w / 2;
        if (dist < hw + 10) {
          const w = F.waterAt(x, y);
          if (dist < hw && w !== 0) {
            const depth = 1 - dist / hw;
            let wr = 70 - depth * 26, wg = 100 - depth * 22, wb = 108 - depth * 6;
            if (w === 2) { wr = 120 + n3 * 20; wg = 128 + n3 * 18; wb = 116 + n3 * 10; if (hashN(x >> 2, y >> 2) > 0.86) { wr += 30; wg += 30; wb += 26; } }
            const ripple = Math.sin((rv.ns ? y : x) * 0.25 + n2 * 9 + dist * 0.2) > 0.93 ? 26 : 0;
            r = wr + ripple; g = wg + ripple; b = wb + ripple;
          } else {
            const bk = 1 - Math.max(0, dist - hw) / 10;
            r += (110 - r) * bk * 0.7; g += (96 - g) * bk * 0.7; b += (70 - b) * bk * 0.7;
          }
        }
        void rcY;
      }
      if (wet > 0.05) {
        const dk = 1 - 0.18 * wet; r *= dk; g *= dk; b *= dk * 1.02;
        const pd = rP[x], th = 0.76 - 0.04 * wet;
        if (pd > th && (dm > 0.25 || pd > th + 0.1)) {
          const pm = Math.min(1, (pd - th) * 14) * 0.6, sky = 128 + (n3 - 0.5) * 16;
          r += (sky * 0.86 - r) * pm; g += (sky * 0.93 - g) * pm; b += (sky * 1.04 - b) * pm;
        }
      }
      if (snow > 0.05) {
        let sm = snow * (0.75 + n2 * 0.6) - dm * 0.55 * (1.1 - snow) - (n3 - 0.5) * 0.25;
        if (rv && F.waterAt(x, y) === 1) sm *= 0.25;
        sm = Math.max(0, Math.min(1, sm * 1.3));
        const wv = 232 + n3 * 14;
        r += (wv - 4 - r) * sm; g += (wv - g) * sm; b += (wv + 10 - b) * sm;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rnd = srand(seed + 3);
  const inCity = (x: number) => !!sg && x > sg.wallX - 20;
  const wetAt = (x: number, y: number) => !!rv && F.waterAt(x, y) !== 0;
  const area = (W * H) / (1600 * 1000);
  if (F.terrain !== Ter.Desert) {
    const n = Math.round((F.terrain === Ter.Mountain || F.terrain === Ter.Plateau ? 900 : 3200) * (1 - snow * 0.6) * area);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (inCity(x) || wetAt(x, y)) continue;
      const col = shade(P.tuft, (rnd() - 0.5) * 0.5);
      ctx.strokeStyle = css(col, 0.8); ctx.lineWidth = 1; ctx.lineCap = 'round';
      const k = 3 + Math.floor(rnd() * 4), hgt = 3 + rnd() * 4;
      ctx.beginPath();
      for (let j = 0; j < k; j++) { const a = (rnd() - 0.5) * 1.2; ctx.moveTo(x + j * 1.2 - k * 0.6, y); ctx.lineTo(x + j * 1.2 - k * 0.6 + Math.sin(a) * hgt, y - Math.cos(a) * hgt); }
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(150,120,70,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 260 * area; i++) { const x = rnd() * W, y = rnd() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 6, x + 40, y); ctx.stroke(); }
  }
  if (P.flowers && snow < 0.3) {
    const cols = ['#f4f0e0', '#f0d040', '#d84a3a', '#c070d0'];
    for (let i = 0; i < 500 * area; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (inCity(x) || wetAt(x, y)) continue;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  const stones = (F.terrain === Ter.Mountain || F.terrain === Ter.Hills || F.terrain === Ter.Plateau ? 420 : 140) * area;
  for (let i = 0; i < stones; i++) {
    const x = rnd() * W, y = rnd() * H, r = 1.2 + rnd() * 2.8;
    if (inCity(x)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + 0.8, y + 0.8, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    const c = 120 + rnd() * 50;
    ctx.fillStyle = `rgb(${c},${c * 0.96},${c * 0.88})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 河岸芦苇与浅滩卵石、木桥
  if (rv) {
    for (let i = 0; i < 700 * Math.sqrt(area); i++) {
      const s = rnd() * (rv.ns ? H : W);
      const c = F.riverPos(rv, s), side = rnd() < 0.5 ? -1 : 1, off = rv.w / 2 + 1 + rnd() * 7;
      const x = rv.ns ? c + side * off : s, y = rv.ns ? s : c + side * off;
      if (F.waterAt(x, y) === 2) continue;
      ctx.strokeStyle = snow > 0.4 ? 'rgba(200,196,170,0.9)' : css(shade(0x6a7a3a, (rnd() - 0.5) * 0.4), 0.9); ctx.lineWidth = 1;
      ctx.beginPath(); for (let j = 0; j < 4; j++) { ctx.moveTo(x + j - 2, y); ctx.lineTo(x + j - 2 + (rnd() - 0.5) * 3, y - 5 - rnd() * 6); } ctx.stroke();
    }
    for (const f of rv.fords) for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * f.r, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr;
      if (F.waterAt(x, y) !== 2) continue;
      const c = 140 + rnd() * 50; ctx.fillStyle = `rgba(${c},${c * 0.97},${c * 0.9},0.85)`;
      ctx.beginPath(); ctx.ellipse(x, y, 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (rv.bridge) {
      const bx = rv.bridge.x, by = rv.bridge.y, L = rv.w + 36;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(bx - L / 2 + 3, by - 20 + 5, L, 40);
      ctx.fillStyle = '#7a5530'; ctx.fillRect(bx - L / 2, by - 20, L, 40);
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 1;
      for (let x = bx - L / 2; x < bx + L / 2; x += 5) { ctx.beginPath(); ctx.moveTo(x, by - 20); ctx.lineTo(x, by + 20); ctx.stroke(); }
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(bx - L / 2, by - 22, L, 4); ctx.fillRect(bx - L / 2, by + 18, L, 4);
      ctx.strokeStyle = OUTLINE; ctx.strokeRect(bx - L / 2, by - 22, L, 44);
    }
  }
  // 村落院落
  for (const b of F.boxes) {
    if (sg && b.x > sg.wallX) continue;
    ctx.fillStyle = 'rgba(120,100,70,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, b.w * 0.9, b.h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (sg) {
    const wx = sg.wallX;
    const sgr = ctx.createLinearGradient(wx + 14, 0, wx + 50, 0);
    sgr.addColorStop(0, 'rgba(10,8,4,0.45)'); sgr.addColorStop(1, 'rgba(10,8,4,0)');
    ctx.fillStyle = sgr; ctx.fillRect(wx + 14, 0, 36, H);
    // 城外壕沟
    ctx.fillStyle = 'rgba(70,58,40,0.5)'; ctx.fillRect(wx - 46, 0, 14, sg.gateY0 - 16); ctx.fillRect(wx - 46, sg.gateY1 + 16, 14, H - sg.gateY1);
    // 吊桥前的土路
    ctx.fillStyle = 'rgba(130,108,72,0.6)'; ctx.fillRect(wx - 120, sg.gateY0 + 8, 106, sg.gateY1 - sg.gateY0 - 16);
    // 城内主街
    ctx.fillStyle = 'rgba(90,84,74,0.35)'; ctx.fillRect(wx + 14, sg.gateMid - 40, W - wx, 80);
  }
  return cv;
}

export { mix, poly };

/** 积雪版道具图集：在朝上的边缘盖一层不规则的雪 */
export function buildSnowAtlas() {
  const a = buildBattleAtlas();
  const cv = a.canvas as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const W = cv.width, H = cv.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const A = (x: number, y: number) => (y < 0 ? 0 : src[(y * W + x) * 4 + 3]);
  for (let x = 0; x < W; x++) {
    const T = 3 + ((x * 2654435761) >>> 28) % 5 + (Math.sin(x * 0.37) > 0.4 ? 2 : 0);
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] < 40 || A(x, y - 1) < 40) continue; // 保留最上一圈描边
      let edge = false;
      for (let k = 2; k <= T; k++) if (A(x, y - k) < 40) { edge = true; break; }
      if (!edge) continue;
      const lum = (src[i] + src[i + 1] + src[i + 2]) / 3;
      if (lum < 45) continue; // 黑描边不盖
      d[i] = 236 + ((x + y) % 3) * 4; d[i + 1] = 242 + ((x + y) % 3) * 3; d[i + 2] = 250;
    }
  }
  // 整体略微偏冷、降低饱和度（冬天的植物）
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const g = (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i] = d[i] * 0.78 + g * 0.22; d[i + 1] = d[i + 1] * 0.78 + g * 0.22; d[i + 2] = Math.min(255, d[i + 2] * 0.8 + g * 0.2 + 8);
  }
  ctx.putImageData(img, 0, 0);
  return a;
}

/** 城墙崩塌后的瓦砾堆（俯视），长 len */
export function buildRubble(len: number) {
  const W = 64;
  const cv = makeCanvas(W * BRES, (len + 20) * BRES);
  const ctx = cv.getContext('2d')!;
  ctx.scale(BRES, BRES);
  const r = srand(len * 13 + 7);
  ctx.fillStyle = 'rgba(40,32,22,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2, len / 2 + 10, W * 0.48, len * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < len * 1.4; i++) {
    const x = 6 + r() * (W - 12), y = 6 + r() * (len + 6);
    const s = 2 + r() * 6;
    const c = 110 + r() * 50;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 1, y + 1, s * 1.3, s);
    ctx.fillStyle = `rgb(${c},${c * 0.93},${c * 0.8})`; ctx.fillRect(x, y, s * 1.3, s);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, s * 1.3, 1);
  }
  // 残墙断面
  ctx.fillStyle = '#8a7e66'; ctx.fillRect(W / 2 - 15, 0, 30, 8); ctx.fillRect(W / 2 - 15, len + 12, 30, 8);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.strokeRect(W / 2 - 15, 0, 30, 8); ctx.strokeRect(W / 2 - 15, len + 12, 30, 8);
  return cv;
}
