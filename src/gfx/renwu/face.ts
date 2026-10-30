// 头型与五官（代码“工笔”绘制）：头型由 HeadParams 决定，五官由 FaceParams 决定。
// 所有五官点都在头部局部 3D 坐标里（x 左 / y 上 / z 前），随头部转动正确透视；按屏幕尺寸分级细节。
import { shade, rgba } from '../../core/canvas';
import type { FaceParams, HeadParams, EyeShape, BrowShape } from './types';

export type P2 = { x: number; y: number; z: number };

const hullCache = new Map<string, [number, number, number][]>();
/** 头部轮廓点（局部坐标）：颅骨椭球 + 颧 / 腮 / 下颌 / 下巴 / 鼻尖 / 后颈 */
export function headHullPts(h: HeadParams, fem: boolean): [number, number, number][] {
  const key = `${fem ? 1 : 0}|${h.width.toFixed(2)}|${h.jaw.toFixed(2)}|${h.chin.toFixed(2)}|${h.cheek.toFixed(2)}`;
  let pts = hullCache.get(key);
  if (pts) return pts;
  pts = [];
  const W = h.width, rx = 4.8 * W, ry = 5.85, rz = 5.3;
  for (const el of [-0.42, -0.15, 0.15, 0.45, 0.8, 1.12, 1.4]) for (let i = 0; i < 18; i++) {
    const az = (i / 18) * Math.PI * 2;
    pts.push([rx * Math.cos(el) * Math.sin(az), 1 + ry * Math.sin(el), rz * Math.cos(el) * Math.cos(az) - 0.3]);
  }
  pts.push([0, 1 + ry + 0.1, -0.3]);
  const j = h.jaw, ch = h.chin, ck = h.cheek;
  for (const sx of [1, -1]) {
    pts.push([sx * 4.55 * W, -1.2, 1.4]);
    pts.push([sx * (3.65 + 0.6 * j + 0.35 * ck) * W, -3.05 * ch, 1.5 + 0.25 * ck]);
    pts.push([sx * (2.6 + 0.85 * j + 0.35 * ck) * W, -4.7 * ch, 2.35]);
    pts.push([sx * (1.2 + 0.75 * j) * W, -6.0 * ch, 3.35]);
    pts.push([sx * 3.9 * W, -2.6, -1.5], [sx * 2.5 * W, -4.0, -2.3]);
  }
  pts.push([0, -(fem ? 6.45 : 6.65) * ch, 3.85]);
  pts.push([0, -2.45, 5.5]);
  hullCache.set(key, pts);
  return pts;
}

export interface FaceCtx {
  g: CanvasRenderingContext2D;
  HP: (x: number, y: number, z: number) => P2;
  vis: (nx: number, ny: number, nz: number) => number;
  d: number;              // 屏幕像素 / 头部单位
  f: FaceParams; fem: boolean;
  closed: boolean;        // 闭目（打坐 / 眨眼）
  sY: number;             // 头朝向 sin（判断哪侧是远侧）
  hair: string; lip?: string; lash: boolean; huadian?: string;
  mouthOpen: number; gaze: number;
}

/** 眼型：长 / 上睑峰高 / 下睑深 / 眼尾上挑 / 上睑峰位置 / 眼尾拖尾 */
const EYE: Record<EyeShape, { len: number; up: number; lo: number; tilt: number; apex: number; flick: number }> = {
  phoenix: { len: 2.5, up: 0.62, lo: 0.3, tilt: 0.55, apex: 0.4, flick: 0.85 },
  almond: { len: 2.35, up: 0.78, lo: 0.42, tilt: 0.2, apex: 0.45, flick: 0.5 },
  peach: { len: 2.4, up: 0.8, lo: 0.52, tilt: 0.02, apex: 0.52, flick: 0.4 },
  round: { len: 2.15, up: 0.94, lo: 0.62, tilt: 0, apex: 0.5, flick: 0.25 },
  narrow: { len: 2.6, up: 0.47, lo: 0.24, tilt: 0.12, apex: 0.5, flick: 0.45 },
  droopy: { len: 2.3, up: 0.72, lo: 0.38, tilt: -0.42, apex: 0.58, flick: 0.2 },
};
/** 眉型：内 / 峰 / 尾 三点（x, y）与粗细 */
const BROW: Record<BrowShape, { p: [number, number][]; w: [number, number, number]; soft: number }> = {
  sword: { p: [[0.62, 1.5], [2.0, 1.98], [3.4, 2.3]], w: [0.44, 0.36, 0.07], soft: 0.95 },
  thick: { p: [[0.6, 1.48], [2.0, 1.86], [3.35, 1.8]], w: [0.52, 0.5, 0.18], soft: 0.95 },
  flat: { p: [[0.66, 1.58], [2.0, 1.7], [3.3, 1.62]], w: [0.32, 0.3, 0.1], soft: 0.9 },
  arched: { p: [[0.7, 1.5], [2.0, 2.18], [3.25, 1.62]], w: [0.26, 0.25, 0.06], soft: 0.85 },
  willow: { p: [[0.76, 1.56], [1.95, 1.98], [3.25, 1.56]], w: [0.17, 0.25, 0.04], soft: 0.8 },
  distant: { p: [[0.78, 1.6], [1.85, 1.96], [3.2, 1.72]], w: [0.14, 0.2, 0.05], soft: 0.62 },
};

function qpt(a: P2, c: P2, b: P2, t: number) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function drawEye(c: FaceCtx, sx: number) {
  const { g, HP, d, f } = c;
  const k = c.vis(sx * 0.38, 0, 0.92);
  if (k < 0.04) return;
  const al = Math.min(1, k * 2.4);
  const E = EYE[f.eye];
  const sz = f.eyeSize * (c.fem ? 1 : 0.92);
  const ey = -0.05, x0 = sx * 0.8 * f.eyeGap, len = E.len * sz * (c.fem ? 1 : 1.04);
  const tilt = (E.tilt + f.eyeTilt * 0.5) * sz;
  const up = E.up * sz * (c.fem ? 1 : 0.86), lo = E.lo * sz * (c.fem ? 1 : 0.86);
  const I = HP(x0, ey, 4.92), O = HP(x0 + sx * len, ey + tilt * 0.55, 4.1);
  const U = HP(x0 + sx * len * E.apex, ey + up * 2 + tilt * 0.28, 5.0);
  const L = HP(x0 + sx * len * 0.55, ey - lo * 2 + tilt * 0.2, 4.86);
  const ink = `rgba(24,14,10,${0.95 * al})`;
  if (d < 0.95) {
    const m = qpt(I, U, O, 0.5);
    g.fillStyle = ink; g.beginPath(); g.arc(m.x, m.y + 0.2 * d, Math.max(0.35, 0.5 * d), 0, Math.PI * 2); g.fill();
    return;
  }
  if (c.closed) {
    g.strokeStyle = ink; g.lineWidth = Math.max(0.5, 0.32 * d);
    const Lc = HP(x0 + sx * len * 0.5, ey - lo * 0.9, 4.9);
    g.beginPath(); g.moveTo(I.x, I.y); g.quadraticCurveTo(Lc.x, Lc.y, O.x, O.y); g.stroke();
    if (c.fem && c.lash && d > 2.5) {
      g.lineWidth = Math.max(0.3, 0.14 * d);
      for (let q = 0; q < 3; q++) { const p = qpt(I, Lc, O, 0.6 + q * 0.15); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + sx * 0.0 + (O.x - I.x) * 0.04, p.y + 0.45 * d); g.stroke(); }
    }
    return;
  }
  // 上眼线（锥形：内眼角细、外侧粗、眼尾拖出）
  const lash = () => {
    const N = 9, top: { x: number; y: number }[] = [], bot: { x: number; y: number }[] = [];
    const w0 = (c.fem ? 0.5 : 0.4) * d;
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = qpt(I, U, O, t);
      const th = w0 * (0.18 + 0.82 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5)) * (t > 0.9 ? 0.85 : 1);
      bot.push(p); top.push({ x: p.x, y: p.y - th });
    }
    const fl = E.flick * (c.fem ? 1 : 0.55);
    const tipX = O.x + (O.x - I.x) * 0.13 * fl, tipY = O.y - (0.35 + 0.25 * tilt) * fl * d;
    g.beginPath(); g.moveTo(bot[0].x, bot[0].y);
    for (const p of top) g.lineTo(p.x, p.y);
    g.lineTo(tipX, tipY);
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
    g.closePath(); g.fillStyle = ink; g.fill();
  };
  if (d < 2.2) {
    lash();
    const m = qpt(I, U, O, 0.5);
    g.fillStyle = ink; g.beginPath(); g.arc(m.x, m.y + 0.35 * d, 0.42 * d, 0, Math.PI * 2); g.fill();
    return;
  }
  // 眼白
  const shape = () => { g.beginPath(); g.moveTo(I.x, I.y); g.quadraticCurveTo(U.x, U.y, O.x, O.y); g.quadraticCurveTo(L.x, L.y, I.x, I.y); g.closePath(); };
  g.save();
  shape(); g.fillStyle = `rgba(251,247,240,${al})`; g.fill(); g.clip();
  // 虹膜
  const mid = qpt(I, U, O, 0.5), lm = qpt(I, L, O, 0.5);
  const ix = mid.x + (O.x - I.x) * (0.02 + c.gaze * 0.1), iy = (mid.y + lm.y) / 2 + 0.05 * d;
  const ir = 0.62 * (up + lo) * d;
  const iris = c.f.iris;
  const ig = g.createRadialGradient(ix, iy + ir * 0.35, 0, ix, iy, ir);
  ig.addColorStop(0, shade(iris, 0.42)); ig.addColorStop(0.55, iris); ig.addColorStop(1, shade(iris, -0.6));
  g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(shade(iris, -0.7), 0.8); g.lineWidth = Math.max(0.3, 0.11 * d); g.stroke();
  g.fillStyle = '#0c0806'; g.beginPath(); g.arc(ix, iy + ir * 0.05, ir * 0.42, 0, Math.PI * 2); g.fill();
  // 上睑投影
  const sg = g.createLinearGradient(0, mid.y - 0.2 * d, 0, mid.y + ir * 0.9);
  sg.addColorStop(0, 'rgba(70,36,26,0.42)'); sg.addColorStop(1, 'rgba(70,36,26,0)');
  g.fillStyle = sg; g.fillRect(Math.min(I.x, O.x) - d, mid.y - 2 * d, Math.abs(O.x - I.x) + 2 * d, 3 * d + ir);
  // 高光
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix - ir * 0.34, iy - ir * 0.36, ir * 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(ix + ir * 0.36, iy + ir * 0.32, ir * 0.13, 0, Math.PI * 2); g.fill();
  g.restore();
  lash();
  // 下睑（外侧 2/3）
  g.strokeStyle = `rgba(80,40,30,${0.5 * al})`; g.lineWidth = Math.max(0.3, 0.12 * d);
  g.beginPath();
  for (let i = 0; i <= 8; i++) { const p = qpt(I, L, O, 0.3 + 0.7 * i / 8); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
  g.stroke();
  // 双眼皮
  if (d > 3.2) {
    g.strokeStyle = `rgba(120,64,48,${0.38 * al})`; g.lineWidth = Math.max(0.3, 0.1 * d);
    const gap = (c.fem ? 0.42 : 0.34) * d;
    g.beginPath();
    for (let i = 0; i <= 8; i++) { const t = 0.22 + 0.78 * i / 8, p = qpt(I, U, O, t); const y = p.y - gap * Math.sin(t * Math.PI * 0.9); i ? g.lineTo(p.x, y) : g.moveTo(p.x, y); }
    g.stroke();
  }
  // 睫毛
  if (c.fem && c.lash && d > 2.8) {
    g.strokeStyle = ink; g.lineWidth = Math.max(0.3, 0.12 * d);
    const dirx = Math.sign(O.x - I.x) || 1;
    for (let q = 0; q < 4; q++) {
      const t = 0.62 + q * 0.11, p = qpt(I, U, O, t);
      const lx = dirx * (0.25 + q * 0.16) * d, ly = -(0.42 + q * 0.1) * d;
      g.beginPath(); g.moveTo(p.x, p.y - 0.2 * d); g.quadraticCurveTo(p.x + lx * 0.2, p.y + ly * 0.8, p.x + lx, p.y + ly); g.stroke();
    }
  }
  // 眼影 / 卧蚕
  if (c.fem && d > 2.5) {
    const og = g.createRadialGradient(O.x, O.y - 0.4 * d, 0, O.x, O.y - 0.4 * d, 1.5 * d);
    og.addColorStop(0, `rgba(222,110,110,${0.2 * al * (0.4 + f.blush)})`); og.addColorStop(1, 'rgba(222,110,110,0)');
    g.fillStyle = og; g.fillRect(O.x - 2 * d, O.y - 2.2 * d, 4 * d, 3.6 * d);
  }
}

function drawBrow(c: FaceCtx, sx: number) {
  const { g, HP, d, f } = c;
  const k = c.vis(sx * 0.42, 0.15, 0.9);
  if (k < 0.08) return;
  const B = BROW[f.brow], w = f.browW * (c.fem ? 1 : 1.1), dy = f.browH * 0.6 + (c.fem ? 0.12 : 0);
  const zs = [4.98, 4.78, 4.05];
  const pt = (i: number, off: number) => HP(sx * B.p[i][0] * (0.94 + 0.06 * f.eyeGap), B.p[i][1] + dy + off, zs[i]);
  const t0 = pt(0, B.w[0] * w * 0.5), b0 = pt(0, -B.w[0] * w * 0.5);
  const t1 = pt(1, B.w[1] * w * 1.0), b1 = pt(1, -B.w[1] * w * 0.6), e = pt(2, 0);
  const col = c.fem ? shade(c.hair, 0.08) : shade(c.hair, -0.12);
  g.fillStyle = rgba(col, B.soft * (c.fem ? 0.82 : 0.95) * Math.min(1, k * 2));
  g.beginPath(); g.moveTo(b0.x, b0.y); g.lineTo(t0.x, t0.y); g.quadraticCurveTo(t1.x, t1.y, e.x, e.y); g.quadraticCurveTo(b1.x, b1.y, b0.x, b0.y); g.closePath(); g.fill();
  if (d > 4.5) {
    // 眉毛的毛流
    g.strokeStyle = rgba(shade(col, -0.3), 0.45); g.lineWidth = Math.max(0.25, 0.05 * d);
    for (let i = 0; i < 6; i++) {
      const t = 0.08 + i * 0.15, a = qpt(b0, b1, e, t), b = qpt(t0, t1, e, Math.min(1, t + 0.12));
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
  }
}

export function drawFace(c: FaceCtx) {
  const { g, HP, d, f } = c;
  const faceVis = c.vis(0, -0.1, 1);
  if (faceVis < -0.25) return;
  // 腮红
  if ((c.fem || f.blush > 0.3) && d > 1.2) for (const sx of [1, -1]) {
    const p = HP(sx * 2.75, -2.35, 3.95), k = Math.max(0, c.vis(sx * 0.5, -0.2, 0.8));
    if (k < 0.05) continue;
    const r = 2.0 * d, gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    gr.addColorStop(0, `rgba(236,118,118,${0.3 * f.blush * k})`); gr.addColorStop(1, 'rgba(236,118,118,0)');
    g.fillStyle = gr; g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  // 年纪：法令纹、眼袋、抬头纹
  if (f.age > 0.15 && d > 1.8) {
    const a = f.age;
    g.strokeStyle = `rgba(120,70,50,${0.3 * a})`; g.lineWidth = Math.max(0.3, 0.12 * d);
    for (const sx of [1, -1]) {
      if (c.vis(sx * 0.4, -0.2, 0.9) < 0.1) continue;
      const p0 = HP(sx * 1.1, -2.55, 5.05), p1 = HP(sx * 1.85, -3.6, 4.7), p2 = HP(sx * 1.75, -4.55, 4.35);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y); g.stroke();
      const q0 = HP(sx * 1.2, -0.95, 4.85), q1 = HP(sx * 2.0, -1.25, 4.7), q2 = HP(sx * 2.9, -0.95, 4.3);
      g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y, q2.x, q2.y); g.stroke();
    }
    if (d > 3.5 && a > 0.4) {
      g.strokeStyle = `rgba(120,70,50,${0.16 * a})`;
      for (const yy of [3.05, 3.65]) { const l = HP(1.9, yy, 4.6), m = HP(0, yy + 0.15, 5.05), r = HP(-1.9, yy, 4.6); g.beginPath(); g.moveTo(l.x, l.y); g.quadraticCurveTo(m.x, m.y, r.x, r.y); g.stroke(); }
    }
  }
  // 眉、眼
  for (const sx of [1, -1]) drawBrow(c, sx);
  for (const sx of [1, -1]) drawEye(c, sx);
  // 花钿
  if (c.huadian && d > 1.5) {
    const k = c.vis(0, 0.3, 1);
    if (k > 0.1) {
      const p = HP(0, 2.45, 5.08), r = 0.5 * d;
      g.fillStyle = rgba(c.huadian, 0.92 * Math.min(1, k * 1.5));
      g.beginPath(); g.moveTo(p.x, p.y - r * 1.9); g.quadraticCurveTo(p.x + r, p.y - r * 0.2, p.x, p.y + r * 0.9); g.quadraticCurveTo(p.x - r, p.y - r * 0.2, p.x, p.y - r * 1.9); g.fill();
    }
  }
  // 鼻
  if (d > 1.5 && faceVis > 0.05) {
    const al = Math.min(1, faceVis * 2) * (0.75 + 0.25 * f.nose);
    const s = c.sY > 0 ? -1 : 1;   // 远侧
    const ny = -2.45 * (0.9 + 0.1 * f.nose);
    if (Math.abs(c.sY) > 0.25 && d > 2.5) {
      const a = HP(s * 0.55, 0.9, 5.0), b = HP(s * 0.32, ny + 0.5, 5.45);
      g.strokeStyle = `rgba(150,86,64,${0.22 * al})`; g.lineWidth = Math.max(0.3, 0.12 * d);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    const tip = HP(0, ny - 0.2, 5.45);
    g.strokeStyle = `rgba(150,82,62,${0.5 * al})`; g.lineWidth = Math.max(0.35, 0.14 * d);
    const l = HP(0.62 * f.nose, ny - 0.05, 5.05), r = HP(-0.62 * f.nose, ny - 0.05, 5.05);
    g.beginPath(); g.moveTo(l.x, l.y); g.quadraticCurveTo(tip.x, tip.y + 0.25 * d, r.x, r.y); g.stroke();
    if (d > 3) {
      g.fillStyle = `rgba(120,60,46,${0.35 * al})`;
      for (const sx of [1, -1]) { const p = HP(sx * 0.42, ny - 0.18, 5.15); g.beginPath(); g.ellipse(p.x, p.y, 0.2 * d, 0.1 * d, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,240,230,0.35)'; const hl = HP(0, ny + 0.4, 5.55); g.beginPath(); g.arc(hl.x, hl.y, 0.18 * d, 0, Math.PI * 2); g.fill();
    }
  }
  // 口
  {
    const k = c.vis(0, -0.3, 1);
    if (k > 0.05 && d > 1.1) {
      const al = Math.min(1, k * 2);
      const mw = (c.fem ? 0.9 : 1.12) * f.mouth, sm = f.smile * 0.24;
      const my = -4.12;
      const ml = HP(mw, my + sm, 4.42), mr = HP(-mw, my + sm, 4.42), mc = HP(0, my - 0.04, 4.86);
      if (c.mouthOpen > 0.05 && d > 1.8) {
        const o = c.mouthOpen;
        const bot = HP(0, my - 0.55 - 0.9 * o, 4.75);
        g.fillStyle = `rgba(90,26,26,${0.92 * al})`;
        g.beginPath(); g.moveTo(ml.x, ml.y); g.quadraticCurveTo(mc.x, mc.y - 0.25 * d, mr.x, mr.y); g.quadraticCurveTo(bot.x, bot.y + 0.6 * d * o, ml.x, ml.y); g.closePath(); g.fill();
        g.fillStyle = `rgba(250,246,240,${0.8 * al})`; g.beginPath(); g.ellipse(mc.x, mc.y + 0.12 * d, Math.abs(ml.x - mr.x) * 0.3, 0.14 * d, 0, 0, Math.PI * 2); g.fill();
      } else if (c.fem) {
        const lipC = c.lip ?? '#c84a5a';
        const lp = f.lip;
        if (d < 1.8) { g.fillStyle = rgba(lipC, 0.9 * al); g.beginPath(); g.ellipse(mc.x, mc.y + 0.1 * d, mw * 0.55 * d, 0.32 * d * lp, 0, 0, Math.PI * 2); g.fill(); }
        else {
          const pk = (sx: number) => HP(sx * 0.32 * mw, my + 0.36 * lp, 4.88);
          const p1 = pk(1), p2 = pk(-1), dip = HP(0, my + 0.2 * lp, 4.92), lb = HP(0, my - 0.62 * lp, 4.78);
          g.fillStyle = rgba(lipC, 0.95 * al);
          g.beginPath(); g.moveTo(ml.x, ml.y);
          g.quadraticCurveTo((ml.x + p1.x) / 2, (ml.y + p1.y) / 2 - 0.05 * d, p1.x, p1.y);
          g.quadraticCurveTo(dip.x, dip.y + 0.06 * d, p2.x, p2.y);
          g.quadraticCurveTo((mr.x + p2.x) / 2, (mr.y + p2.y) / 2 - 0.05 * d, mr.x, mr.y);
          g.quadraticCurveTo(lb.x, lb.y + 0.5 * d * lp, ml.x, ml.y);
          g.closePath(); g.fill();
          g.strokeStyle = rgba(shade(lipC, -0.5), 0.75 * al); g.lineWidth = Math.max(0.3, 0.1 * d);
          g.beginPath(); g.moveTo(ml.x, ml.y); g.quadraticCurveTo(mc.x, mc.y + 0.1 * d - sm * d * 0.5, mr.x, mr.y); g.stroke();
          if (d > 3) { g.fillStyle = `rgba(255,226,226,${0.5 * al})`; g.beginPath(); g.ellipse(lb.x - 0.18 * mw * d, lb.y - 0.08 * d + 0.25 * d * lp, 0.32 * d, 0.1 * d, 0, 0, Math.PI * 2); g.fill(); }
        }
      } else {
        g.strokeStyle = `rgba(128,68,54,${0.8 * al})`; g.lineWidth = Math.max(0.4, 0.17 * d);
        g.beginPath(); g.moveTo(ml.x, ml.y); g.quadraticCurveTo(mc.x, mc.y + 0.18 * d - sm * d * 0.6, mr.x, mr.y); g.stroke();
        if (d > 2.2) {
          const lb = HP(0, my - 0.7 * f.lip, 4.72);
          g.strokeStyle = `rgba(128,68,54,${0.25 * al})`; g.lineWidth = Math.max(0.3, 0.12 * d);
          g.beginPath(); g.moveTo(lb.x - 0.45 * mw * d, lb.y); g.lineTo(lb.x + 0.45 * mw * d, lb.y); g.stroke();
        }
      }
    }
  }
  // 痣
  if (f.mole && d > 2) {
    const p = f.mole === 1 ? HP(2.6, -1.0, 4.35) : HP(-1.15, -4.65, 4.45);
    if (c.vis(f.mole === 1 ? 0.5 : -0.2, -0.1, 0.9) > 0.1) { g.fillStyle = 'rgba(60,30,24,0.75)'; g.beginPath(); g.arc(p.x, p.y, Math.max(0.35, 0.13 * d), 0, Math.PI * 2); g.fill(); }
  }
}

/** 胡须（画在轮廓线之外）：短髭 + 山羊须；年纪大则是飘飘长髯 */
export function drawBeard(c: FaceCtx, beard: string, old: number, t: number) {
  const { g, HP, d } = c;
  const k = c.vis(0, -0.4, 1);
  if (k < 0.02) return;
  const al = Math.min(1, k * 2 + 0.2);
  g.fillStyle = rgba(beard, 0.95 * al);
  // 八字须
  for (const sx of [1, -1]) {
    const a = HP(sx * 0.25, -3.55, 5.0), b = HP(sx * 1.25, -3.9, 4.6), e = HP(sx * 1.9, -4.75, 4.2);
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(b.x, b.y - 0.3 * d, e.x, e.y); g.quadraticCurveTo(b.x, b.y + 0.25 * d, a.x, a.y + 0.3 * d); g.closePath(); g.fill();
  }
  // 颏下须
  const len = 2.2 + 5.5 * old, sw = Math.sin(t * 1.3) * 0.25 * old;
  const l = HP(1.3, -4.9, 4.2), r = HP(-1.3, -4.9, 4.2), tip = HP(sw, -6.6 - len, 3.6 - len * 0.15), mid = HP(0, -6.0, 4.1);
  g.beginPath(); g.moveTo(l.x, l.y);
  g.quadraticCurveTo(l.x + (tip.x - l.x) * 0.2, (l.y + tip.y) / 2, tip.x, tip.y);
  g.quadraticCurveTo(r.x + (tip.x - r.x) * 0.2, (r.y + tip.y) / 2, r.x, r.y);
  g.quadraticCurveTo(mid.x, mid.y, l.x, l.y); g.closePath(); g.fill();
  if (d > 2.5) {
    g.strokeStyle = rgba(shade(beard, -0.35), 0.4 * al); g.lineWidth = Math.max(0.25, 0.06 * d);
    for (let i = -2; i <= 2; i++) { const a = HP(i * 0.4, -5.2, 4.2), b = HP(sw + i * 0.15, -6.4 - len * 0.9, 3.7 - len * 0.13); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
  }
}
