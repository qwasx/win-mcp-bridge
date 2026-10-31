// 手：掌 + 五指（每指三节）的 3D 小骨架。手势 = 每个指节的弯曲角 + 指间张开角 + 拇指对掌；
// CharState 里保存当前指节角度并向目标手势平滑过渡，所以握拳→剑指→推掌之间是连续的。
// 绘制：掌面与各指按深度排序；手指用“两遍描线”（先深色粗线、再肤色细线）画成连贯锥形，没有关节接缝。
import { shade, rgba, mix } from '../../core/canvas';
import type { Gesture } from './types';

export type V3 = { x: number; y: number; z: number };
export type P2 = { x: number; y: number; z: number };

/** 每个手势 20 个数：食/中/无名/小指各 [掌指, 近节, 远节, 张开]，拇指 [对掌, 外展, 掌指屈, 指间屈] */
export const G_N = 20;
const F = (mcp: number, pip: number, dip: number, spr: number) => [mcp, pip, dip, spr];
const mk = (f: number[][], th: number[]) => Float32Array.from([...f.flat(), ...th]);
const FIST = [F(1.45, 1.7, 1.0, 0.02), F(1.5, 1.75, 1.0, 0), F(1.55, 1.75, 1.0, -0.02), F(1.6, 1.75, 1.0, -0.05)];
export const GESTURES: Record<Gesture, Float32Array> = {
  relax: mk([F(0.3, 0.42, 0.22, 0.06), F(0.38, 0.52, 0.26, 0), F(0.46, 0.6, 0.3, -0.06), F(0.54, 0.68, 0.34, -0.12)], [0.22, 0.28, 0.2, 0.18]),
  fist: mk(FIST, [0.88, 0.08, 0.55, 0.5]),
  grip: mk([F(1.1, 1.25, 0.65, 0.02), F(1.15, 1.3, 0.7, 0), F(1.2, 1.3, 0.7, -0.02), F(1.25, 1.3, 0.7, -0.05)], [0.75, 0.2, 0.35, 0.3]),
  sword: mk([F(0, 0.02, 0.02, 0.025), F(0, 0.02, 0.02, -0.025), FIST[2], FIST[3]], [1.0, 0, 0.72, 0.6]),
  palm: mk([F(0.04, 0.06, 0.04, 0.07), F(0.03, 0.05, 0.03, 0), F(0.04, 0.06, 0.04, -0.07), F(0.06, 0.08, 0.05, -0.15)], [0.08, 0.38, 0.05, 0.05]),
  open: mk([F(-0.06, 0.04, 0.03, 0.24), F(-0.04, 0.04, 0.03, 0.06), F(-0.03, 0.05, 0.04, -0.15), F(0, 0.06, 0.05, -0.34)], [0, 0.95, 0, 0]),
  lotus: mk([F(0.28, 0.42, 0.3, 0.16), F(0.85, 0.95, 0.5, 0), F(0.12, 0.26, 0.26, -0.14), F(0, 0.12, 0.32, -0.32)], [0.72, 0.25, 0.3, 0.25]),
  claw: mk([F(0.2, 1.2, 0.9, 0.22), F(0.2, 1.25, 0.9, 0.05), F(0.22, 1.25, 0.9, -0.12), F(0.25, 1.2, 0.9, -0.28)], [0.3, 0.6, 0.4, 0.6]),
  point: mk([F(0, 0.03, 0.02, 0.04), FIST[1], FIST[2], FIST[3]], [0.86, 0.1, 0.55, 0.5]),
  pinch: mk([F(0.65, 0.75, 0.4, 0.02), F(0.9, 1.1, 0.6, 0), F(1.1, 1.3, 0.7, -0.03), F(1.2, 1.4, 0.8, -0.06)], [0.8, 0.3, 0.3, 0.3]),
  seal: mk([F(0.95, 1.05, 0.55, 0.04), F(0.22, 0.28, 0.16, 0), F(0.26, 0.32, 0.18, -0.06), F(0.32, 0.38, 0.22, -0.12)], [0.7, 0.3, 0.35, 0.35]),
  cup: mk([F(0.25, 0.3, 0.18, 0.06), F(0.25, 0.3, 0.18, 0), F(0.27, 0.32, 0.2, -0.06), F(0.3, 0.35, 0.22, -0.12)], [0.25, 0.55, 0.12, 0.1]),
};
export const GESTURE_NAMES: Record<Gesture, string> = { relax: '放松', fist: '握拳', grip: '握持', sword: '剑指', palm: '推掌', open: '张掌', lotus: '兰花指', claw: '爪', point: '指点', pinch: '拈', seal: '法诀', cup: '托掌' };

// ---------------------------------------------------------------- 向量
const vadd = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const vsc = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: V3): V3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const perp = (a: V3, ax: V3): V3 => norm(vadd(a, ax, -dot(a, ax)));

/** 手的坐标系：w 腕点，a 指向（四指伸直方向），n 掌心法线，t 拇指一侧 */
export interface HandFrame { w: V3; a: V3; n: V3; t: V3 }

/** 由前臂方向 + 旋后角（掌心朝上/朝前为正）+ 腕屈角（向掌心折为正）得到手的坐标系；side=1 左手，-1 右手 */
export function armHandFrame(w: V3, f: V3, side: 1 | -1, sup: number, bend: number): HandFrame {
  const base = side > 0 ? { x: -1, y: -0.18, z: 0.12 } : { x: 1, y: -0.18, z: 0.12 };
  let n = vadd(base, f, -dot(base, f));
  let l = Math.hypot(n.x, n.y, n.z);
  if (l < 0.25) { const alt = { x: 0, y: -1, z: 0.2 }; n = vadd(alt, f, -dot(alt, f)); l = Math.hypot(n.x, n.y, n.z) || 1; }
  n = vsc(n, 1 / l);
  const th = -sup * side, fxn = cross(f, n);
  n = vadd(vsc(n, Math.cos(th)), fxn, Math.sin(th));
  const a = vadd(vsc(f, Math.cos(bend)), n, Math.sin(bend));
  const n2 = vadd(vsc(n, Math.cos(bend)), f, -Math.sin(bend));
  return { w, a, n: n2, t: side > 0 ? cross(n2, a) : cross(a, n2) };
}
/** 直接指定指向与掌心朝向（用于 IK 摆放的手：负手、交手、剑诀当胸、推掌） */
export function aimHandFrame(w: V3, aim: V3, palm: V3, side: 1 | -1): HandFrame {
  const a = norm(aim), n = perp(palm, a);
  return { w, a, n, t: side > 0 ? cross(n, a) : cross(a, n) };
}
export function blendFrame(A: HandFrame, B: HandFrame, k: number, side: 1 | -1): HandFrame {
  if (k <= 0.001) return A;
  if (k >= 0.999) return B;
  const a = norm(vadd(vsc(A.a, 1 - k), B.a, k));
  const n = perp(vadd(vsc(A.n, 1 - k), B.n, k), a);
  return { w: A.w, a, n, t: side > 0 ? cross(n, a) : cross(a, n) };
}

// ---------------------------------------------------------------- 几何
const FL = [[1.5, 0.92, 0.72], [1.66, 1.02, 0.78], [1.56, 0.96, 0.72], [1.22, 0.76, 0.62]];
const FR = [0.335, 0.35, 0.325, 0.28];
const KU = [0.96, 0.32, -0.31, -0.9];
const KL = [0.02, 0.1, 0, -0.3];
export const PALM_L = 3.1;
export const HAND_LEN = PALM_L + 3.3;

export interface HandGeo { fingers: V3[][]; thumb: V3[]; palm: V3[]; center: V3; tip: V3 }
export function handGeo(h: HandFrame, c: Float32Array, k: number): HandGeo {
  const { w, a, n, t } = h;
  const fingers: V3[][] = [];
  for (let i = 0; i < 4; i++) {
    let p = vadd(vadd(vadd(w, a, (PALM_L + KL[i]) * k), t, KU[i] * k), n, -0.1 * k);
    const sp = c[i * 4 + 3];
    const ad = vadd(vsc(a, Math.cos(sp)), t, Math.sin(sp));
    const pts = [p]; let th = 0;
    for (let j = 0; j < 3; j++) {
      th += c[i * 4 + j];
      p = vadd(p, vadd(vsc(ad, Math.cos(th)), n, Math.sin(th)), FL[i][j] * k);
      pts.push(p);
    }
    fingers.push(pts);
  }
  const opp = c[16], abd = c[17], tm = c[18], ti = c[19];
  const cmc = vadd(vadd(vadd(w, a, 0.5 * k), t, 0.78 * k), n, 0.22 * k);
  const d0 = norm(vadd(vadd(vsc(a, 0.55 + 0.25 * abd), t, 0.82 - 1.05 * opp + 0.45 * abd), n, 0.3 + 0.85 * opp));
  const bx = perp(vadd(vsc(n, 0.6), t, -0.8), d0);
  const m1 = vadd(cmc, d0, 1.5 * k);
  const m2 = vadd(m1, vadd(vsc(d0, Math.cos(tm)), bx, Math.sin(tm)), 1.08 * k);
  const m3 = vadd(m2, vadd(vsc(d0, Math.cos(tm + ti)), bx, Math.sin(tm + ti)), 0.88 * k);
  const palm = [
    vadd(w, t, 0.86 * k), vadd(cmc, d0, 0.78 * k), m1, vadd(fingers[0][0], t, 0.34 * k),
    vadd(fingers[0][0], a, 0.12 * k), vadd(fingers[1][0], a, 0.16 * k), vadd(fingers[2][0], a, 0.12 * k), vadd(fingers[3][0], a, 0.06 * k),
    vadd(fingers[3][0], t, -0.32 * k), vadd(vadd(w, a, 1.5 * k), t, -1.16 * k), vadd(w, t, -0.84 * k),
  ];
  let tip = { x: 0, y: 0, z: 0 };
  for (const f of fingers) tip = vadd(tip, f[3], 0.25);
  return { fingers, thumb: [cmc, m1, m2, m3], palm, center: vadd(w, a, PALM_L * 0.55 * k), tip };
}

// ---------------------------------------------------------------- 绘制
export interface HandDraw {
  g: CanvasRenderingContext2D;
  P: (q: V3) => P2;
  cam: (v: V3) => number;      // 法线朝镜头程度（>0 可见）
  S: number;                   // 局部单位 → 画布单位
  E: number;                   // 局部单位 → 屏幕像素（细节分级）
  skin: string;
  lw: number;                  // 描线宽（画布单位）
}

export function drawHand(c: HandDraw, h: HandFrame, curl: Float32Array, k: number) {
  const { g, P, S, E } = c;
  const geo = handGeo(h, curl, k);
  const px = E * k * HAND_LEN;                       // 手在屏幕上的像素长度
  const skin = c.skin, line = rgba(shade(skin, -0.58), 0.9);
  if (px < 5) {
    const C = P(geo.center), W = P(h.w);
    g.fillStyle = skin; g.beginPath();
    g.ellipse(C.x, C.y, 1.5 * k * S, 2.2 * k * S, Math.atan2(C.y - W.y, C.x - W.x) + Math.PI / 2, 0, Math.PI * 2); g.fill();
    return geo;
  }
  const palmSide = c.cam(h.n) > 0;
  const palmFill = palmSide ? mix(skin, '#e9a596', 0.13) : skin;
  const fingers2 = geo.fingers.map((f) => f.map(P));
  const thumb2 = geo.thumb.slice(1).map(P);
  const palm2 = geo.palm.map(P);
  const pc = geo.center;
  // 分类：在掌心一侧（且掌心朝镜头）或手背一侧（且手背朝镜头）的指头画在掌面之后
  const side = (q: V3) => dot(vadd(q, pc, -1), h.n);
  type Item = { front: boolean; d: number; pts: P2[]; r: number[] };
  const items: Item[] = [];
  for (let i = 0; i < 4; i++) {
    const f = geo.fingers[i], s = side(f[2]);
    const front = palmSide ? s > 0.35 * k : s < -0.35 * k;
    items.push({ front, d: (fingers2[i][1].z + fingers2[i][3].z) / 2, pts: fingers2[i], r: [FR[i], FR[i] * 0.93, FR[i] * 0.85, FR[i] * 0.74] });
  }
  {
    const s = side(geo.thumb[2]);
    items.push({ front: palmSide ? s > 0.2 * k : s < -0.2 * k, d: thumb2[1].z, pts: thumb2, r: [0.42, 0.38, 0.33] });
  }
  const lw = Math.max(c.lw * 0.5, 0.07 * S);
  const simple = px < 13;
  const finger = (it: Item) => {
    const pts = it.pts;
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (!simple) {
      g.strokeStyle = line;
      for (let j = 0; j < pts.length - 1; j++) { g.lineWidth = 2 * it.r[j] * k * S + 2 * lw; g.beginPath(); g.moveTo(pts[j].x, pts[j].y); g.lineTo(pts[j + 1].x, pts[j + 1].y); g.stroke(); }
    }
    g.strokeStyle = skin;
    for (let j = 0; j < pts.length - 1; j++) { g.lineWidth = 2 * it.r[j] * k * S; g.beginPath(); g.moveTo(pts[j].x, pts[j].y); g.lineTo(pts[j + 1].x, pts[j + 1].y); g.stroke(); }
    if (px > 30 && !palmSide) {
      // 指甲：远节背面
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const mx = a.x + (b.x - a.x) * 0.62, my = a.y + (b.y - a.y) * 0.62;
      g.fillStyle = 'rgba(255,236,226,0.55)'; g.beginPath();
      g.ellipse(mx, my, it.r[2] * k * S * 0.62, Math.hypot(b.x - a.x, b.y - a.y) * 0.3, Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2, 0, Math.PI * 2); g.fill();
    }
  };
  const palmPath = () => {
    const n = palm2.length;
    g.beginPath();
    g.moveTo((palm2[n - 1].x + palm2[0].x) / 2, (palm2[n - 1].y + palm2[0].y) / 2);
    for (let i = 0; i < n; i++) { const a = palm2[i], b = palm2[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    g.closePath();
  };
  const back = items.filter((i) => !i.front).sort((a, b) => a.d - b.d);
  const fore = items.filter((i) => i.front).sort((a, b) => a.d - b.d);
  for (const it of back) finger(it);
  palmPath();
  g.fillStyle = palmFill; g.fill();
  if (!simple) {
    g.strokeStyle = line; g.lineWidth = lw; g.stroke();
    if (px > 24) {
      g.save(); palmPath(); g.clip();
      if (palmSide) {
        // 掌纹：感情线 + 生命线
        const q = (u: number, v: number, w = 0) => P(vadd(vadd(vadd(h.w, h.a, u * k), h.t, v * k), h.n, w * k));
        const a1 = q(2.35, -1.1, 0.05), a2 = q(2.05, 0.1, 0.05), a3 = q(2.45, 0.85, 0.05);
        const b1 = q(2.2, 0.75, 0.05), b2 = q(1.0, 0.45, 0.05), b3 = q(0.35, 0.55, 0.05);
        g.strokeStyle = rgba(shade(skin, -0.45), 0.35); g.lineWidth = lw * 0.7;
        g.beginPath(); g.moveTo(a1.x, a1.y); g.quadraticCurveTo(a2.x, a2.y, a3.x, a3.y); g.moveTo(b1.x, b1.y); g.quadraticCurveTo(b2.x, b2.y, b3.x, b3.y); g.stroke();
      } else {
        // 手背：指根骨节高光
        g.fillStyle = 'rgba(255,245,235,0.35)';
        for (let i = 0; i < 4; i++) { const K = fingers2[i][0]; g.beginPath(); g.arc(K.x, K.y, FR[i] * k * S * 0.7, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    }
  }
  for (const it of fore) finger(it);
  return geo;
}
