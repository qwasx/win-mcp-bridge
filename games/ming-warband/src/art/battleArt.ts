// 战场美术：地面、树木、房屋、城墙城楼
import { type Ctx, makeCanvas, css, shade, mix, srand, OUTLINE } from './canvas';
import { pack, type Atlas, drawBroadleaf, drawConifer, drawRock, roof, ell, poly } from './mapArt';
import { fbm } from '../core/rng';
import { Ter } from '../core/terrain';

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

export interface GroundOpts { W: number; H: number; terrain: Ter; siege: boolean; wallX: number; gateY0: number; gateY1: number; seed: number; night: boolean }

export function paintBattleGround(o: GroundOpts) {
  const { W, H } = o;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d')!;
  const P = GROUND[o.terrain] ?? GROUND[Ter.Plain];
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const seed = o.seed;
  const roadY = (x: number) => H * 0.5 + Math.sin(x * 0.004 + seed) * 70 + Math.sin(x * 0.011) * 20;
  const hasRoad = o.terrain !== Ter.Forest || o.siege;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const n = fbm(x * 0.006, y * 0.006, seed, 4);
    const n2 = fbm(x * 0.03, y * 0.03, seed + 5, 3);
    const n3 = fbm(x * 0.15, y * 0.15, seed + 9, 2);
    const t = Math.min(1, Math.max(0, (n - 0.35) * 2.2));
    let r = P.a[0] + (P.b[0] - P.a[0]) * t, g = P.a[1] + (P.b[1] - P.a[1]) * t, b = P.a[2] + (P.b[2] - P.a[2]) * t;
    const k = 0.9 + n2 * 0.16 + (n3 - 0.5) * 0.1;
    r *= k; g *= k; b *= k;
    // 裸土斑块
    const dirt = Math.max(0, (fbm(x * 0.012, y * 0.012, seed + 21, 3) - 0.62) * 4);
    let dm = Math.min(0.85, dirt);
    // 道路
    if (hasRoad) {
      const ry = roadY(x);
      const dd = Math.abs(y - ry);
      if (dd < 26) { const rm = dd < 16 ? 0.85 : (26 - dd) / 10 * 0.85; dm = Math.max(dm, rm * (0.85 + n3 * 0.15)); }
      if (Math.abs(dd - 7) < 1.3) dm = Math.min(1, dm + 0.1); // 车辙
    }
    if (dm > 0) { r += (P.dirt[0] * (0.92 + n3 * 0.16) - r) * dm; g += (P.dirt[1] * (0.92 + n3 * 0.16) - g) * dm; b += (P.dirt[2] * (0.92 + n3 * 0.16) - b) * dm; }
    // 城内石板地
    if (o.siege && x > o.wallX + 14) {
      const tile = ((x >> 4) + (y >> 4)) % 2;
      const edge = (x % 16 < 1 || y % 16 < 1) ? 0.78 : 1;
      const base = 128 + tile * 8 + (n3 - 0.5) * 20;
      r = (base + 6) * edge; g = (base + 2) * edge; b = (base - 8) * edge;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const rnd = srand(seed + 3);
  const inCity = (x: number) => o.siege && x > o.wallX - 20;
  // 草丛
  if (o.terrain !== Ter.Desert) {
    const n = o.terrain === Ter.Mountain || o.terrain === Ter.Plateau ? 900 : 3200;
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (inCity(x)) continue;
      const col = shade(P.tuft, (rnd() - 0.5) * 0.5);
      ctx.strokeStyle = css(col, 0.8); ctx.lineWidth = 1; ctx.lineCap = 'round';
      const k = 3 + Math.floor(rnd() * 4), hgt = 3 + rnd() * 4;
      for (let j = 0; j < k; j++) {
        const a = (rnd() - 0.5) * 1.2;
        ctx.beginPath(); ctx.moveTo(x + j * 1.2 - k * 0.6, y); ctx.lineTo(x + j * 1.2 - k * 0.6 + Math.sin(a) * hgt, y - Math.cos(a) * hgt); ctx.stroke();
      }
    }
  } else {
    // 沙纹
    ctx.strokeStyle = 'rgba(150,120,70,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 6, x + 40, y); ctx.stroke();
    }
  }
  // 野花
  if (P.flowers) {
    const cols = ['#f4f0e0', '#f0d040', '#d84a3a', '#c070d0'];
    for (let i = 0; i < 500; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (inCity(x)) continue;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 碎石
  const stones = o.terrain === Ter.Mountain || o.terrain === Ter.Hills || o.terrain === Ter.Plateau ? 420 : 140;
  for (let i = 0; i < stones; i++) {
    const x = rnd() * W, y = rnd() * H, r = 1.2 + rnd() * 2.8;
    if (inCity(x)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + 0.8, y + 0.8, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    const c = 120 + rnd() * 50;
    ctx.fillStyle = `rgb(${c},${c * 0.96},${c * 0.88})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (o.siege) {
    const wx = o.wallX;
    // 城墙投影（向东南）
    const sg = ctx.createLinearGradient(wx + 14, 0, wx + 50, 0);
    sg.addColorStop(0, 'rgba(10,8,4,0.45)'); sg.addColorStop(1, 'rgba(10,8,4,0)');
    ctx.fillStyle = sg; ctx.fillRect(wx + 14, 0, 36, o.gateY0); ctx.fillRect(wx + 14, o.gateY1, 36, H - o.gateY1);
    // 护城河边的壕沟（城外）
    ctx.fillStyle = 'rgba(70,58,40,0.45)'; ctx.fillRect(wx - 40, 0, 16, o.gateY0 - 10); ctx.fillRect(wx - 40, o.gateY1 + 10, 16, H - o.gateY1);
    // 城门处的瓦砾与断木
    for (let i = 0; i < 70; i++) {
      const x = wx - 30 + rnd() * 80, y = o.gateY0 + rnd() * (o.gateY1 - o.gateY0);
      const r = 2 + rnd() * 4;
      const c = 110 + rnd() * 40;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 1, y + 1, r * 1.3, r);
      ctx.fillStyle = `rgb(${c},${c * 0.94},${c * 0.82})`; ctx.fillRect(x, y, r * 1.3, r);
    }
    for (let i = 0; i < 8; i++) {
      const x = wx - 20 + rnd() * 50, y = o.gateY0 + 10 + rnd() * (o.gateY1 - o.gateY0 - 20);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * Math.PI);
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-12, -2.5, 24, 5); ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 0.8; ctx.strokeRect(-12, -2.5, 24, 5);
      ctx.fillStyle = '#9a9aa0'; ctx.fillRect(-9, -2.5, 1.6, 5); ctx.fillRect(7, -2.5, 1.6, 5);
      ctx.restore();
    }
  }
  return cv;
}

export { mix, poly };
