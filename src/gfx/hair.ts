// 第四十二步 · 发型（代码绘制，配 AI 脸）
//
// 头发由三类部件组成，全部在头部局部 3D 坐标里定义，随头转动投影，所以五个朝向（镜像成八方向）天然一致：
//   1. 发壳：贴着颅骨、比颅骨略鼓的一层（顶上更鼓），下沿就是发际线；脸那一侧按发际线裁开，露出 AI 脸；
//   2. 发髻 / 发环 / 发结：实心的团（凸包）或带状的环（沿 3D 曲线描粗线），与发壳"先统一描墨边、再统一填色"，
//      所以发髻与头顶连成一整片剪影，看不出拼接缝；高耸的发环顶端挂弹簧，跑动时晚半拍地晃；
//   3. 会飘的：披发、马尾、垂髾、鬓发、龙须、发带——用人物原有的布料条带（Strand）模拟，随惯性与风飘。
// 坐标：x = 角色左，y = 上，z = 前（面朝方向）；颅骨椭球中心 (0, 1, -0.3)，半轴 4.75 / 5.8 / 5.3。
import { shade, rgba } from '../core/canvas';
import type { Look } from './character';

export type HairStyle =
  | 'bun' | 'crown' | 'ponytail' | 'long' | 'twin' | 'halfup' | 'updo' | 'bald'
  | 'short' | 'elder' | 'feixian' | 'shuanghuan' | 'chuihuan' | 'duoma' | 'braid' | 'liuyun';

export const HAIR_NAMES: Record<HairStyle, string> = {
  bun: '道髻插簪', crown: '束发冠', ponytail: '高马尾', long: '披发', twin: '双丫髻', halfup: '半披半束', updo: '高髻步摇', bald: '光头',
  short: '短打束发', elder: '老者发髻', feixian: '飞仙髻', shuanghuan: '双环髻', chuihuan: '垂鬟分肖髻', duoma: '堕马髻',
  braid: '侧编长发', liuyun: '流云髻',
};
/** 男修可用的发型（randomLook / 发型总表的顺序） */
export const MALE_STYLES: HairStyle[] = ['crown', 'bun', 'ponytail', 'halfup', 'long', 'short', 'elder'];
/** 女修可用的发型 */
export const FEMALE_STYLES: HairStyle[] = ['feixian', 'shuanghuan', 'chuihuan', 'duoma', 'twin', 'halfup', 'long', 'updo', 'liuyun', 'braid', 'ponytail', 'elder'];

export interface P2 { x: number; y: number; z: number }
type V = [number, number, number];
interface StrandLike { x: Float32Array; y: Float32Array; n: number }

export interface HairCtx {
  g: CanvasRenderingContext2D;
  S: number; hk: number; lw: number; ink: string;
  look: Look; fem: boolean;
  t: number; seed: number;
  /** 头部局部坐标 → 屏幕 */
  HP(x: number, y: number, z: number): P2;
  /** 头部局部法线 → 朝向镜头程度（>0 可见） */
  visN(nx: number, ny: number, nz: number): number;
  hed: P2;
  strand(key: string, n: number, len: number, ax: number, ay: number, drag?: number, gScale?: number): StrandLike;
  spring(key: string, tx: number, ty: number, k?: number, c?: number): { x: number; y: number };
  /** 加入全局按深度排序的绘制队列 */
  push(z: number, f: () => void): void;
  /** 背后长发所在深度（胸背之后） */
  zBody: number;
  /** 0..1：跑 / 飞时的飘动强度 */
  gust: number;
}

/** 头饰挂点（头部局部坐标） */
export interface HairAnchors {
  /** 冠 / 莲花冠套住的发髻中心；null = 没有顶髻（会临时补一个小髻） */
  top: V | null;
  /** 发簪 / 步摇插的位置 */
  pin: V;
  /** 簪子方向（沿 x 横插还是斜插） */
  pinTilt: number;
  /** 发带系结处 */
  ribbon: V[];
  /** 这款发型的头壳隆起（抹额、头巾贴着发面要用） */
  inflate: (y: number) => number;
  hairline: (a: number) => number;
}

export interface HairDraw {
  anchors: HairAnchors;
  /** 头后的部件（画在头皮之前） */
  behind(): void;
  /** 发壳与头前的部件（画在脸之后）；sil 为头部轮廓路径 */
  front(): void;
  /** 胸前垂发 / 龙须（在耳朵、轮廓线之后） */
  over(): void;
}

// ---------------------------------------------------------------- 发型参数
interface StyleDef {
  /** 发际线：'center' 中分、'side' 侧分、'up' 全部梳起、'loose' 自然 */
  part: 'center' | 'side' | 'up' | 'loose';
  /** 头顶发量（发壳隆起，1 = 贴头皮） */
  vol: number;
  /** 两鬓蓬起（蝉鬓） */
  temple?: number;
  /** 盖住耳朵垂下 */
  sideDown?: boolean;
  /** 披在背后的长发：每节长度（6 节）与宽度倍率 */
  drape?: { len: number; w: number };
  /** 胸前鬓发 / 龙须：每节长度（5 节），0 = 无 */
  locks?: number;
  /** 发丝梳向的汇聚点 */
  flow: V;
}

function styleDef(style: HairStyle, fem: boolean): StyleDef {
  switch (style) {
    case 'bun': return { part: 'up', vol: 1.06, flow: [0, 7.2, -0.9] };
    case 'crown': return { part: 'up', vol: 1.05, flow: [0, 7.0, -1.2] };
    case 'short': return { part: 'up', vol: 1.07, flow: [0, 7.0, -1.0] };
    case 'elder': return { part: 'up', vol: 1.06, flow: [0, 6.8, -1.8], drape: { len: 3.0, w: 0.9 } };
    case 'ponytail': return { part: 'up', vol: 1.07, temple: fem ? 0.04 : 0, flow: [0, 6.0, -3.6], locks: fem ? 3.0 : 2.4 };
    case 'halfup': return fem
      ? { part: 'center', vol: 1.1, sideDown: true, drape: { len: 6.6, w: 1.08 }, locks: 3.6, flow: [0, 5.8, -3.8] }
      : { part: 'loose', vol: 1.09, sideDown: true, drape: { len: 4.8, w: 1.0 }, locks: 3.0, flow: [0, 6.0, -3.4] };
    case 'long': return fem
      ? { part: 'center', vol: 1.11, sideDown: true, drape: { len: 7.0, w: 1.12 }, locks: 3.9, flow: [0, 6.9, 0.2] }
      : { part: 'center', vol: 1.1, sideDown: true, drape: { len: 5.6, w: 1.04 }, locks: 3.2, flow: [0, 6.9, 0.2] };
    case 'braid': return { part: 'side', vol: 1.09, sideDown: true, locks: 3.4, flow: [0, 6.9, 0.2] };
    case 'twin': return { part: 'center', vol: 1.08, flow: [0, 6.9, 0.0], locks: 2.6 };
    case 'updo': return { part: 'up', vol: 1.06, temple: 0.12, flow: [0, 7.4, -1.2] };
    case 'feixian': return { part: 'up', vol: 1.07, temple: 0.1, drape: { len: 6.0, w: 0.9 }, flow: [0, 7.0, -1.0] };
    case 'shuanghuan': return { part: 'center', vol: 1.08, temple: 0.06, flow: [0, 6.6, -1.2], locks: 3.0 };
    case 'chuihuan': return { part: 'center', vol: 1.08, temple: 0.14, flow: [0, 6.8, -1.4] };
    case 'duoma': return { part: 'side', vol: 1.08, temple: 0.1, flow: [2.0, 3.4, -4.2], locks: 3.2 };
    case 'liuyun': return { part: 'side', vol: 1.08, temple: 0.08, drape: { len: 6.2, w: 0.95 }, flow: [-1.4, 7.0, -1.8], locks: 3.4 };
    default: return { part: 'up', vol: 1, flow: [0, 7, -1] };
  }
}

// ---------------------------------------------------------------- 小工具
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

function convexHull(pts: { x: number; y: number }[]) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: any[] = [], up: any[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
/** 圆滑闭合曲线（中点二次曲线） */
function smoothClosed(g: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  const n = pts.length; if (n < 3) return;
  g.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
  g.closePath();
}

/** 一团（发髻 / 发结）或一条带（发环 / 垂鬟）：先统一描边，再统一填色 */
interface Mass {
  z: number;
  /** 闭合轮廓 */
  path?: () => void;
  /** 带：屏幕点与各点宽度（屏幕像素） */
  band?: { pts: { x: number; y: number }[]; w: number[]; closed: boolean };
  /** 填色前裁剪 */
  clip?: () => void;
  detail?: () => void;
}

// ---------------------------------------------------------------- 主函数
export function buildHair(c: HairCtx): HairDraw {
  const { g, S, hk, lw, ink, look, fem, HP, visN, hed } = c;
  const style = (look.hairStyle ?? 'bun') as HairStyle;
  const D = styleDef(style, fem);
  const U = S * hk;                       // 每个头部单位的屏幕像素
  const hair = look.hair;
  // 屏幕上的实际尺度（游戏里镜头缩放在 ctx 变换里，S 只是人物倍率）：近景才画发丝细节，远景少采样
  const tf = g.getTransform ? g.getTransform() : null;
  const US = U * (tf ? Math.hypot(tf.a, tf.b) : 1);
  const fine = US > 1.45;
  const outlineW = lw * 2.1;

  // ---- 颅骨表面
  const surf = (a: number, y: number, inf = 1) => {
    const yy = Math.max(-2.2, Math.min(y, 6.75));
    const f = Math.sqrt(Math.max(0.04, 1 - ((yy - 1) / 5.8) ** 2));
    let rx = 4.75 * f * inf, rz = 5.3 * f * inf;
    if (y < -2.2) { const k = Math.max(0.6, 1 + (y + 2.2) * 0.1); rx *= k; rz *= k; }
    const x = Math.sin(a) * rx, z = Math.cos(a) * rz - 0.3;
    return { x, y, z, n: visN(x / 22.6, (yy - 1) / 33.6, (z + 0.3) / 28.1) };
  };

  // ---- 发际线（φ=0 正前方，±π 脑后）
  const sideSign = style === 'duoma' ? 1 : style === 'liuyun' || style === 'braid' ? -1 : 1;
  const hairline = (a: number) => {
    const t = Math.abs(a);
    // 额前：弧形发际线（中间高、两额角略收）
    let y: number;
    // （AI 脸的耳朵在 φ≈1.72–2.15、y≈-2.4–1.3：头发从耳上绕过，耳后再垂到下颌角）
    if (t < 0.95) y = D.part === 'center' ? 4.25 - 1.65 * (t / 0.95) ** 1.15 : D.part === 'side' ? 3.8 - (a * sideSign < 0 ? 1.5 * (t / 0.95) ** 1.2 : 0.95 * (t / 0.95) ** 2) : 3.8 - 0.95 * (t / 0.95) ** 2;
    else if (t < 1.35) { const y0 = D.part === 'center' ? 2.6 : D.part === 'side' && a * sideSign < 0 ? 2.3 : 2.85; y = y0 - (t - 0.95) / 0.4 * (fem ? 0.95 : 0.25) - (y0 - 2.85) * smooth((t - 0.95) / 0.4); }
    else if (t < 2.2) { const y0 = fem ? 1.9 : 2.6; y = y0 + (1.55 - y0) * smooth((t - 1.35) / 0.35); }
    else if (t < 2.36) y = 1.55 + (-2.6 - 1.55) * smooth((t - 2.2) / 0.16);
    else y = -2.6 - 1.7 * smooth((t - 2.36) / (Math.PI - 2.36));
    if (!fem && style !== 'elder') {
      // 男：鬓角——耳前一条竖直的短鬓，下沿平
      const k = smooth((t - 1.36) / 0.05) * (1 - smooth((t - 1.58) / 0.06));
      y = y * (1 - k) + (-1.0) * k;
    }
    if (fem) y -= 1.4 * bump(t, 1.55, 0.05);   // 女：耳前一缕小鬓尖
    if (style === 'elder') y += 0.75 * Math.max(0, 1 - t / 1.25);              // 老者：发际线后退
    if (D.part === 'center' && t < 0.12) y += 0.25 * (1 - t / 0.12);           // 中分发缝
    if (D.part === 'side') { const s = a * sideSign; if (s > 0.25 && s < 0.6) y += 0.4 * bump(s, 0.42, 0.1); }
    if (D.sideDown && t > 1.15) y = Math.min(y, 2.0 - (t - 1.15) * 7);       // 披发盖住耳朵
    return y;
  };
  // 发壳隆起：发际线处贴头皮，往上越来越鼓；蝉鬓在两侧额角额外蓬起
  const inflate = (y: number, a = 0) => {
    const k = smooth((y - 1.5) / 4.5);
    let f = 1.045 + (D.vol - 1.045) * k;
    if (D.temple) f += D.temple * bump(y, 3.2, 1.6) * Math.min(1, Math.abs(Math.sin(a)) * 1.6);
    if (style === 'duoma') f += 0.05 * Math.max(0, Math.sin(a)) * bump(y, 3, 2);
    return f;
  };

  // ---- 发壳轮廓点
  const shellPts: P2[] = [];
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI + (i / 20) * Math.PI * 2;
    const hl = hairline(a);
    for (let k = 0; k <= 3; k++) {
      const y = hl + (6.9 - hl) * (k / 3);
      const s = surf(a, y, inflate(y, a));
      shellPts.push(HP(s.x, s.y, s.z));
    }
  }
  shellPts.push(HP(0, 6.9 * D.vol + 0.1, -0.5));
  // 后脑下部：盖住下颌角后侧（不然背面看两腮露肉）
  for (const sx of [1, -1]) shellPts.push(HP(sx * 3.9 * 1.05, -2.8, -1.4 * 1.05 - 0.2), HP(sx * 2.6 * 1.05, -4.2, -2.3 * 1.05 - 0.2));
  const shellHull = convexHull(shellPts);

  // ---- 发际线投影：可见的最长一段，用来把脸那侧裁开
  const N = US > 2.2 ? 64 : 44;
  const hl: { x: number; y: number; n: number; a: number }[] = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI + (i / N) * Math.PI * 2;
    const y = hairline(a), s = surf(a, y, inflate(y, a) + 0.01); const q = HP(s.x, s.y, s.z);
    hl.push({ x: q.x, y: q.y, n: s.n, a });
  }
  let best = -1, bestLen = 0;
  for (let i = 0; i < N; i++) {
    if (hl[i].n <= 0 || hl[(i - 1 + N) % N].n > 0) continue;
    let l = 0; while (l < N && hl[(i + l) % N].n > 0) l++;
    if (l > bestLen) { bestLen = l; best = i; }
  }
  const run: typeof hl = [];
  if (best >= 0) for (let l = 0; l < bestLen; l++) run.push(hl[(best + l) % N]);
  else if (hl.every((p) => p.n > 0)) for (let l = 0; l < N; l++) run.push(hl[l]);
  const BIG = 60 * U;
  const runCurve = () => {
    for (let i = 1; i < run.length; i++) g.quadraticCurveTo(run[i - 1].x, run[i - 1].y, (run[i - 1].x + run[i].x) / 2, (run[i - 1].y + run[i].y) / 2);
    g.lineTo(run[run.length - 1].x, run[run.length - 1].y);
  };
  /**
   * 发际线一侧的区域：可见发际线两端沿"头心 → 端点"方向向外延伸出头，
   * 再绕一大圈（经过正上方 = 头发一侧，或正下方 = 脸一侧）闭合。
   * 这样转头时发际线端点落在轮廓上，裁切线不会横穿后脑。
   */
  const region = (up: boolean) => {
    const A = run[0], B = run[run.length - 1];
    const ang = (p: { x: number; y: number }) => Math.atan2(p.y - hed.y, p.x - hed.x);
    const tA = ang(A), tB = ang(B);
    const via = up ? -Math.PI / 2 : Math.PI / 2;
    // 从 B 转到 A：选经过 via 的那个方向
    const norm = (x: number) => { while (x < 0) x += Math.PI * 2; while (x >= Math.PI * 2) x -= Math.PI * 2; return x; };
    const cw = norm(tA - tB), vcw = norm(via - tB);
    const span = vcw <= cw ? cw : cw - Math.PI * 2;
    g.moveTo(A.x, A.y); runCurve();
    const steps = 14;
    for (let i = 0; i <= steps; i++) { const t = tB + span * (i / steps); g.lineTo(hed.x + Math.cos(t) * BIG, hed.y + Math.sin(t) * BIG); }
    g.closePath();
  };
  /** 发际线以上（头发一侧）的区域 */
  const clipAbove = () => {
    g.beginPath();
    if (run.length < 2) { g.rect(hed.x - BIG, hed.y - BIG, BIG * 2, BIG * 2); g.clip(); return; }
    region(true); g.clip();
  };
  /** 发际线以下（脸一侧）：刘海、鬓发的墨线只在这里画，压在发壳上的那段不描 */
  const clipBelow = () => {
    g.beginPath();
    if (run.length < 2 || run.length >= N) { g.rect(hed.x - BIG, hed.y + 9 * U, BIG * 2, BIG); g.clip(); return; }
    region(false); g.clip();
  };

  // ---- 发色：整头共用一个渐变（左上受光），所有部件同一套明暗，接得上
  const grad = (y0: number, y1: number) => {
    const gr = g.createLinearGradient(hed.x - 8 * U, y0, hed.x + 8 * U, y1);
    gr.addColorStop(0, shade(hair, 0.3)); gr.addColorStop(0.42, shade(hair, 0.06)); gr.addColorStop(1, shade(hair, -0.28));
    return gr;
  };
  const headGrad = grad(hed.y - 14 * U, hed.y + 8 * U);
  // 浅色（白发）上的发沟要淡，不然像画了网格
  const lum = (() => { const h = hair.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; })();
  const gk = lum > 0.5 ? 0.45 : 1;
  const dark = rgba(shade(hair, -0.7), 0.55 * gk), light = rgba(shade(hair, 0.85), lum > 0.5 ? 0.5 : 0.28);

  // ---- 发丝（分缕）：沿头皮从发际线梳向汇聚点；近景才画
  const groove = (a: number, y0: number, to: V, inf: number, sw: number, col: string) => {
    const s0 = surf(a, y0, inf);
    if (s0.n < -0.05) return;
    const p0 = HP(s0.x, s0.y, s0.z);
    // 中途点：在表面上取 0.5 处，再略往外鼓
    const mx = (s0.x + to[0]) / 2, my = (s0.y + to[1]) / 2, mz = (s0.z + to[2]) / 2;
    const ml = Math.hypot(mx, my - 1, mz + 0.3) || 1;
    const R = 5.6 * inf * 1.02;
    const m = HP(mx / ml * R, 1 + (my - 1) / ml * R * 1.06, -0.3 + (mz + 0.3) / ml * R);
    const e = HP(to[0], to[1], to[2]);
    g.strokeStyle = col; g.lineWidth = sw;
    g.beginPath(); g.moveTo(p0.x, p0.y); g.quadraticCurveTo(m.x, m.y, e.x * 0.85 + m.x * 0.15, e.y * 0.85 + m.y * 0.15); g.stroke();
  };
  const shellDetail = () => {
    if (!fine) return;
    const flow = D.flow;
    g.save(); g.beginPath(); smoothClosed(g, shellHull); g.clip(); clipAbove();
    g.lineCap = 'round';
    // 发际线：一道淡墨，让头发和额头分得清，但不像戴帽子那样硬
    if (run.length > 1 && visN(0, 0, 1) > -0.3) {
      g.strokeStyle = rgba(shade(hair, -0.6), 0.75); g.lineWidth = Math.max(0.4, lw * 0.9);
      g.beginPath(); g.moveTo(run[0].x, run[0].y); runCurve(); g.stroke();
    }
    // 分缕：几道长短不一的发沟（深）与发丝（浅），从发际线梳向汇聚点
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + ((i + 0.5) / n) * Math.PI * 2 + Math.sin(i * 2.3 + 1) * 0.09;
      const y0 = hairline(a) + 0.1 + (i % 3) * 0.35;
      let to: V = flow;
      if (D.part === 'center' || D.part === 'loose') {
        const sgn = Math.sign(a) || 1;
        to = [sgn * 0.3, 6.9, Math.cos(a) > 0 ? 1.6 : -1.2];
      } else if (D.part === 'side') {
        to = [sideSign * 1.6, 6.5, 1.4];
      }
      groove(a, y0, to, inflate(y0, a) + 0.005, Math.max(0.3, (i % 2 ? 0.34 : 0.24) * U), i % 2 ? rgba(shade(hair, -0.75), 0.4 * gk) : rgba(shade(hair, -0.7), 0.22 * gk));
      if (i % 4 === 1) groove(a + 0.09, y0 + 0.5, to, inflate(y0, a) + 0.01, Math.max(0.3, 0.2 * U), light);
    }
    // 光泽：顶上一条柔和的高光带，下沿锯齿状（顺着发丝），不是一圈珠子
    const ringY = D.part === 'up' ? 5.0 : 4.6;
    const top: P2[] = [], bot: P2[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = -Math.PI + (i / 30) * Math.PI * 2;
      const sT = surf(a, ringY + 0.65, inflate(ringY + 0.65, a) + 0.012), sB = surf(a + 0.03, ringY - (i % 2 ? 0.55 : 0.05), inflate(ringY, a) + 0.012);
      const vis = Math.min(sT.n, sB.n);
      if (vis < 0.18) { if (top.length) break; continue; }
      top.push(HP(sT.x, sT.y, sT.z)); bot.push(HP(sB.x, sB.y, sB.z));
    }
    if (top.length > 2) {
      g.fillStyle = rgba(shade(hair, 0.95), 0.16);
      g.beginPath(); g.moveTo(top[0].x, top[0].y);
      for (let i = 1; i < top.length; i++) g.lineTo(top[i].x, top[i].y);
      for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
      g.closePath(); g.fill();
    }
    // 中分发缝
    if (D.part === 'center') {
      const s0 = surf(0, hairline(0) - 0.05, inflate(3.5) + 0.01), s1 = surf(0, 5.6, inflate(5.6) + 0.01);
      if (s0.n > 0.05) {
        const a = HP(s0.x, s0.y, s0.z), b = HP(s1.x, s1.y, s1.z);
        g.strokeStyle = rgba(shade(look.skin, -0.2), 0.6); g.lineWidth = Math.max(0.35, 0.4 * U); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    g.restore();
  };

  // ---- 发髻（团）：3D 椭球点云取凸包；base 给出与头皮相接的根部，取并集，所以和头顶连成一片
  const blobPts = (cn: V, rx: number, ry: number, rz: number, tilt = 0, base?: { c: V; r: number }) => {
    const pts: P2[] = [];
    const ct = Math.cos(tilt), stl = Math.sin(tilt);
    const na = US > 2.2 ? 12 : 9, els = US > 2.2 ? [-1.1, -0.55, 0, 0.55, 1.1] : [-0.85, 0, 0.85];
    for (let i = 0; i < na; i++) for (const el of els) {
      const az = (i / na) * Math.PI * 2, ce = Math.cos(el);
      let x = Math.sin(az) * ce * rx, y = Math.sin(el) * ry; const z = Math.cos(az) * ce * rz;
      const x2 = x * ct - y * stl, y2 = x * stl + y * ct; x = x2; y = y2;
      pts.push(HP(cn[0] + x, cn[1] + y, cn[2] + z));
    }
    pts.push(HP(cn[0], cn[1] + ry, cn[2]), HP(cn[0], cn[1] - ry, cn[2]));
    if (base) for (let i = 0; i < 8; i++) { const az = (i / 8) * Math.PI * 2; pts.push(HP(base.c[0] + Math.sin(az) * base.r, base.c[1], base.c[2] + Math.cos(az) * base.r)); }
    return pts;
  };
  const masses: Mass[] = [];
  const sway = (key: string, p: P2, k = 1): { dx: number; dy: number } => {
    const sp = c.spring('hs_' + key, p.x, p.y, 120, 9);
    return { dx: (sp.x - p.x) * k, dy: (sp.y - p.y) * k };
  };
  /** 一团发髻；coil：盘绕纹的圈数 */
  const addBlob = (cn: V, rx: number, ry: number, rz: number, opt: { tilt?: number; base?: { c: V; r: number }; coil?: number; swayKey?: string } = {}) => {
    let pts = blobPts(cn, rx, ry, rz, opt.tilt ?? 0, opt.base);
    const ctr = HP(cn[0], cn[1], cn[2]);
    if (opt.swayKey) { const o = sway(opt.swayKey, ctr, 0.35); pts = pts.map((q) => ({ ...q, x: q.x + o.dx * 0.5, y: q.y + o.dy * 0.5 })); }
    const hull = convexHull(pts);
    const coil = opt.coil ?? 2;
    masses.push({
      z: ctr.z,
      path: () => smoothClosed(g, hull),
      detail: fine ? () => {
        // 盘绕：几道弧形发沟 + 一道高光
        g.save(); g.beginPath(); smoothClosed(g, hull); g.clip();
        const ct = Math.cos(opt.tilt ?? 0), stl = Math.sin(opt.tilt ?? 0);
        const P = (az: number, el: number, k = 1) => { const ce = Math.cos(el); let x = Math.sin(az) * ce * rx * k, y = Math.sin(el) * ry * k; const z = Math.cos(az) * ce * rz * k; const x2 = x * ct - y * stl, y2 = x * stl + y * ct; x = x2; y = y2; return HP(cn[0] + x, cn[1] + y, cn[2] + z); };
        g.lineWidth = Math.max(0.3, 0.3 * U);
        for (let r = 0; r < coil; r++) {
          const el = -0.6 + (r + 0.5) / coil * 1.3;
          g.strokeStyle = dark; g.beginPath();
          let st = false;
          for (let i = 0; i <= 16; i++) {
            const az = (i / 16) * Math.PI * 2 + r * 0.9;
            const q = P(az, el + Math.sin(az * 1 + r) * 0.22, 1.01);
            const nz = visN(Math.sin(az) * Math.cos(el) / rx, Math.sin(el) / ry, Math.cos(az) * Math.cos(el) / rz);
            if (nz < 0.05) { st = false; continue; }
            if (!st) { g.moveTo(q.x, q.y); st = true; } else g.lineTo(q.x, q.y);
          }
          g.stroke();
        }
        const h0 = P(-0.9, 0.55, 1.0), h1 = P(-0.1, 0.75, 1.0), h2 = P(0.6, 0.5, 1.0);
        g.strokeStyle = light; g.lineWidth = 0.9 * U; g.lineCap = 'round';
        g.beginPath(); g.moveTo(h0.x, h0.y); g.quadraticCurveTo(h1.x, h1.y, h2.x, h2.y); g.stroke();
        g.restore();
      } : undefined,
    });
  };
  /** 发环 / 垂鬟：沿 3D 闭合曲线的一条带；swayKey 有值时远端挂弹簧晚半拍地晃 */
  const addLoop = (pts3: V[], w: number, opt: { closed?: boolean; swayKey?: string; root?: V; tw?: number[] } = {}) => {
    let pts = pts3.map((p) => HP(p[0], p[1], p[2]));
    if (opt.swayKey) {
      const root = opt.root ?? pts3[0];
      let far = 0, fi = 0; pts3.forEach((p, i) => { const d = Math.hypot(p[0] - root[0], p[1] - root[1], p[2] - root[2]); if (d > far) { far = d; fi = i; } });
      const o = sway(opt.swayKey, pts[fi], 1);
      pts = pts.map((q, i) => { const p = pts3[i]; const k = Math.min(1, Math.hypot(p[0] - root[0], p[1] - root[1], p[2] - root[2]) / (far || 1)); return { ...q, x: q.x + o.dx * k * 0.8, y: q.y + o.dy * k * 0.8 }; });
    }
    const z = pts.reduce((s, q) => s + q.z, 0) / pts.length;
    const ws = pts.map((_, i) => (opt.tw ? opt.tw[i] : 1) * w * U);
    masses.push({
      z, band: { pts, w: ws, closed: opt.closed ?? true },
      detail: fine ? () => {
        // 环上一道细高光，一道发沟
        g.lineCap = 'round';
        g.strokeStyle = light; g.lineWidth = Math.max(0.35, w * U * 0.16);
        const n = pts.length; g.beginPath();
        for (let i = 0; i < n; i++) { const q = pts[i]; const off = -ws[i] * 0.22; if (i === 0) g.moveTo(q.x + off * 0.3, q.y + off); else g.lineTo(q.x + off * 0.3, q.y + off); }
        g.stroke();
        g.strokeStyle = dark; g.lineWidth = Math.max(0.3, 0.26 * U); g.beginPath();
        for (let i = 0; i < n; i++) { const q = pts[i]; const off = ws[i] * 0.2; if (i === 0) g.moveTo(q.x, q.y + off); else g.lineTo(q.x, q.y + off); }
        g.stroke();
      } : undefined,
    });
  };
  /** 3D 椭圆环上的点 */
  const ell = (cn: V, ua: V, va: V, n = 18, a0 = 0, a1 = Math.PI * 2): V[] => {
    const o: V[] = [];
    for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * (i / n); const cs = Math.cos(t), sn = Math.sin(t); o.push([cn[0] + ua[0] * cs + va[0] * sn, cn[1] + ua[1] * cs + va[1] * sn, cn[2] + ua[2] * cs + va[2] * sn]); }
    return o;
  };

  // ---- 各发型的髻、环
  const A: HairAnchors = { top: null, pin: [2.4, 6.0, -1.8], pinTilt: 0, ribbon: [], inflate: (y) => inflate(y), hairline };
  switch (style) {
    case 'bun': {
      const cn: V = [0, 7.75, -1.0];
      addBlob(cn, 2.05, 2.15, 2.05, { base: { c: [0, 6.3, -1.0], r: 2.6 }, coil: 3 });
      A.top = [0, 7.3, -1.0]; A.pin = [0, 7.9, -1.0]; A.ribbon = [[0, 6.6, -2.8]];
      break;
    }
    case 'crown': {
      addBlob([0, 7.25, -1.3], 1.95, 1.7, 1.95, { base: { c: [0, 6.2, -1.3], r: 2.5 } });
      A.top = [0, 6.9, -1.4]; A.pin = [0, 7.6, -1.4]; A.ribbon = [[0, 6.2, -3.4]];
      break;
    }
    case 'short': {
      addBlob([0, 7.35, -1.1], 1.45, 1.35, 1.45, { base: { c: [0, 6.3, -1.1], r: 2.1 }, coil: 1 });
      A.top = [0, 7.0, -1.1]; A.pin = [0, 7.4, -1.1]; A.ribbon = [[0, 6.8, -2.3]];
      break;
    }
    case 'elder': {
      addBlob([0, 7.25, -1.9], 2.3, 1.85, 2.2, { base: { c: [0, 6.0, -1.8], r: 2.6 }, coil: 3 });
      A.top = [0, 7.0, -1.9]; A.pin = [0, 7.4, -1.9];
      break;
    }
    case 'ponytail': {
      addBlob([0, 6.05, -3.75], 1.35, 1.2, 1.25, { base: { c: [0, 5.6, -2.9], r: 1.7 } });
      A.pin = [0, 6.1, -3.8]; A.ribbon = [[0, 6.0, -4.6]];
      break;
    }
    case 'halfup': {
      if (fem) {
        // 头顶后方挽一个小环髻，其余披下
        addBlob([0, 5.9, -3.9], 1.6, 1.25, 1.3, { base: { c: [0, 5.4, -3.0], r: 1.8 } });
        addLoop(ell([0, 7.0, -4.2], [1.5, 0, 0.3], [0, 1.0, -0.5], 16), 1.05, { swayKey: 'hu' , root: [0, 5.9, -3.9] });
        A.pin = [2.2, 6.2, -3.2]; A.ribbon = [[0, 5.6, -4.8]];
      } else {
        addBlob([0, 6.3, -3.4], 1.5, 1.3, 1.35, { base: { c: [0, 5.8, -2.6], r: 1.8 }, coil: 1 });
        A.top = [0, 6.1, -3.2]; A.pin = [0, 6.5, -3.4]; A.ribbon = [[0, 6.0, -4.5]];
      }
      break;
    }
    case 'long': {
      A.pin = [2.8, 5.4, -1.6];
      break;
    }
    case 'braid': {
      A.pin = [-2.9, 5.2, -1.2];
      break;
    }
    case 'twin': {
      for (const sx of [1, -1]) {
        addBlob([sx * 2.95, 6.55, -0.7], 1.9, 1.8, 1.8, { base: { c: [sx * 2.2, 5.6, -0.5], r: 1.9 }, coil: 2 });
      }
      A.pin = [2.95, 6.7, 0.6]; A.ribbon = [[2.8, 5.5, -2.9], [-2.8, 5.5, -2.9]];
      break;
    }
    case 'updo': {
      // 高髻：两团叠起成一座高耸的髻，顶上略前倾
      addBlob([0, 7.4, -1.2], 2.45, 1.9, 2.3, { base: { c: [0, 6.0, -1.2], r: 2.9 }, coil: 2 });
      addBlob([0.15, 9.5, -0.9], 1.95, 1.75, 1.85, { coil: 2, swayKey: 'up', base: { c: [0, 8.2, -1.1], r: 2.2 } });
      A.top = [0, 7.2, -1.2]; A.pin = [2.6, 8.1, -1.0]; A.pinTilt = -0.5;
      break;
    }
    case 'feixian': {
      // 飞仙髻：两只高耸向外微张的发环，根部一个小髻，余发披背
      addBlob([0, 7.1, -1.1], 2.0, 1.5, 1.9, { base: { c: [0, 6.0, -1.1], r: 2.6 } });
      for (const sx of [1, -1]) {
        const root: V = [sx * 0.7, 7.6, -1.0];
        addLoop(ell([sx * 2.5, 10.2, -1.4], [sx * 1.45, 2.6, -0.2], [sx * 0.95, -0.55, 0.55], 20, -Math.PI * 0.5, Math.PI * 1.5),
          1.1, { swayKey: 'fx' + sx, root });
      }
      A.top = null; A.pin = [3.4, 6.8, -1.2]; A.pinTilt = -0.6; A.ribbon = [[0, 6.4, -3.4]];
      break;
    }
    case 'shuanghuan': {
      // 双环：头顶两侧各一只竖立的发环，根部小髻
      for (const sx of [1, -1]) {
        addBlob([sx * 2.6, 6.5, -1.0], 1.5, 1.2, 1.4, { base: { c: [sx * 2.0, 5.7, -0.8], r: 1.7 } });
        addLoop(ell([sx * 4.4, 7.3, -1.5], [sx * 1.7, 1.05, 0], [sx * 0.45, -0.75, 0.9], 18, -Math.PI * 0.6, Math.PI * 1.4), 1.05, { swayKey: 'sh' + sx, root: [sx * 2.6, 6.5, -1.0] });
      }
      A.pin = [0, 7.0, 0.6]; A.ribbon = [[2.6, 5.8, -3.2], [-2.6, 5.8, -3.2]];
      break;
    }
    case 'chuihuan': {
      // 垂鬟分肖髻：两鬓各挽一只垂到腮边的鬟，顶上小髻，脑后余发束成一束垂髾（见下文动态部分）
      addBlob([0, 7.2, -1.6], 1.75, 1.4, 1.7, { base: { c: [0, 6.2, -1.5], r: 2.3 }, coil: 2 });
      for (const sx of [1, -1]) {
        const p: V[] = [[sx * 3.6, 4.4, 0.6], [sx * 4.9, 2.6, 0.2], [sx * 5.6, 0.0, -0.4], [sx * 5.5, -2.0, -0.9], [sx * 4.9, -2.7, -1.4], [sx * 4.4, -1.5, -2.0], [sx * 4.6, 1.0, -2.2], [sx * 4.3, 3.6, -1.8]];
        addLoop(p, 1.55, { closed: false, swayKey: 'ch' + sx, root: [sx * 4.0, 4.0, -0.6], tw: [1.15, 1.1, 1.0, 0.95, 0.95, 0.95, 1.0, 1.1] });
      }
      A.top = [0, 6.9, -1.6]; A.pin = [2.6, 7.0, -1.2]; A.pinTilt = -0.4; A.ribbon = [[0, -0.2, -4.9]];
      break;
    }
    case 'duoma': {
      // 堕马髻：发髻偏垂在脑后一侧，像要滑落
      addBlob([2.6, 3.4, -4.3], 2.55, 2.05, 2.1, { tilt: 0.55, base: { c: [1.2, 4.2, -3.4], r: 2.6 }, coil: 3, swayKey: 'dm' });
      A.pin = [3.6, 4.6, -3.0]; A.pinTilt = 0.6;
      break;
    }
    case 'liuyun': {
      // 流云髻：一侧盘成一朵卷云似的大髻，另一侧顺下来
      addBlob([-1.6, 7.3, -1.8], 2.4, 1.7, 2.1, { tilt: -0.35, base: { c: [-1.0, 6.0, -1.5], r: 2.6 }, coil: 2 });
      addLoop(ell([-3.1, 8.0, -1.9], [-0.9, 1.5, 0], [0, 0, 1.1], 16, -0.6, Math.PI * 1.6), 1.1, { closed: false, swayKey: 'ly', root: [-1.6, 7.3, -1.8] });
      A.top = null; A.pin = [-2.6, 7.6, -1.4]; A.pinTilt = 0.5; A.ribbon = [[-1.0, 6.4, -3.6]];
      break;
    }
    default: break;
  }
  const hw = look.head ?? 'none';
  // 冠 / 莲花冠需要一个顶髻：没有就补一个小的
  if ((hw === 'guan' || hw === 'lotus') && !A.top && style !== 'bald') {
    addBlob([0, 7.25, -1.3], 1.9, 1.6, 1.9, { base: { c: [0, 6.2, -1.3], r: 2.4 } });
    A.top = [0, 6.9, -1.4];
  }
  if (style === 'crown' && !look.head) { /* 冠由 character.ts 按 style==='crown' 画 */ }

  // ---- 动态部分：披发、马尾、垂髾、鬓发 / 龙须、发带
  type Piece = { root: P2; path: () => void; detail?: () => void; z: number };
  const pieces: Piece[] = [];
  /** 条带 → 一缕头发的轮廓（锥形，发梢分 tips 个尖） */
  const lockPath = (xs: number[], ys: number[], wAt: (t: number) => number, tips: number, wav = 0, cap?: { a: P2; b: P2; top: P2 }) => {
    const m = xs.length; const Lp: [number, number][] = [], Rp: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
      const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
      const t = i / (m - 1);
      const w = wAt(t) * (1 + wav * Math.sin(t * 6 + c.t * 1.4 + c.seed));
      Lp.push([xs[i] - dy / d * w, ys[i] + dx / d * w]); Rp.push([xs[i] + dy / d * w, ys[i] - dx / d * w]);
    }
    const e = m - 1, ex = xs[e], ey = ys[e];
    const dx = xs[e] - xs[e - 1], dy = ys[e] - ys[e - 1], dl = Math.hypot(dx, dy) || 1, fx = dx / dl, fy = dy / dl;
    // 头顶的帽沿（披发与头连成一片）：起点取与 Lp 同侧的那个鬓角
    let c0: P2 | null = null, c1: P2 | null = null;
    if (cap) { const lpLeft = Lp[0][0] < Rp[0][0], aLeft = cap.a.x < cap.b.x; c0 = lpLeft === aLeft ? cap.a : cap.b; c1 = c0 === cap.a ? cap.b : cap.a; }
    return () => {
      if (c0) { g.moveTo(c0.x, c0.y); g.quadraticCurveTo(Lp[0][0], (c0.y + Lp[0][1]) / 2, Lp[1][0], Lp[1][1]); }
      else g.moveTo(Lp[0][0], Lp[0][1]);
      for (let i = c0 ? 2 : 1; i < m; i++) g.quadraticCurveTo(Lp[i - 1][0], Lp[i - 1][1], (Lp[i - 1][0] + Lp[i][0]) / 2, (Lp[i - 1][1] + Lp[i][1]) / 2);
      g.lineTo(Lp[e][0], Lp[e][1]);
      // 发梢：几个长短不一的尖
      const ldx = Lp[e][0] - ex, ldy = Lp[e][1] - ey;
      for (let k = 0; k < tips; k++) {
        const u0 = 1 - (2 * k) / tips, u1 = 1 - (2 * k + 1) / tips, u2 = 1 - (2 * k + 2) / tips;
        const len = (k % 2 ? 2.4 : 3.6) * U * (1 - Math.abs(u1) * 0.35);
        g.lineTo(ex + ldx * u1 + fx * len, ey + ldy * u1 + fy * len);
        if (k < tips - 1) g.lineTo(ex + ldx * u2 + fx * 0.4 * U, ey + ldy * u2 + fy * 0.4 * U);
        void u0;
      }
      g.lineTo(Rp[e][0], Rp[e][1]);
      for (let i = m - 2; i >= (c1 ? 1 : 0); i--) g.quadraticCurveTo(Rp[i + 1][0], Rp[i + 1][1], (Rp[i + 1][0] + Rp[i][0]) / 2, (Rp[i + 1][1] + Rp[i][1]) / 2);
      if (c0 && c1 && cap) {
        g.quadraticCurveTo(Rp[0][0], (c1.y + Rp[0][1]) / 2, c1.x, c1.y);
        g.bezierCurveTo(c1.x, cap.top.y - 1 * U, c0.x, cap.top.y - 1 * U, c0.x, c0.y);
      } else g.lineTo(Rp[0][0], Rp[0][1]);
      g.closePath();
    };
  };
  /** 一缕头发上的发丝（几道沿长度方向的细线） */
  const lockLines = (xs: number[], ys: number[], wAt: (t: number) => number, n: number) => {
    if (!fine) return;
    const m = xs.length;
    g.lineWidth = Math.max(0.3, 0.26 * U); g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const f = -0.7 + 1.4 * (k + 0.5) / n;
      const start = 1 + ((k * 7) % 3);   // 发丝从不同高度开始，不在颈后收成一个框
      g.strokeStyle = k % 2 ? light : dark;
      g.beginPath();
      for (let i = 0; i < m; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
        const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
        const w = wAt(i / (m - 1)) * f * (1 - 0.3 * (i / m));
        const x = xs[i] - dy / d * w, y = ys[i] + dx / d * w;
        if (i < start) continue;
        if (i === start) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  const fillOutline = (path: () => void, gr: CanvasGradient | string, ow = outlineW) => {
    g.beginPath(); path(); g.strokeStyle = ink; g.lineWidth = ow; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); path(); g.fillStyle = gr; g.fill();
  };

  // 披在背后的长发
  if (D.drape) {
    const nape = HP(0, -1.0, -4.5);
    const s = c.strand('hairLong', 7, D.drape.len * (fem ? 1 : 0.95), nape.x, nape.y, 1.45, 1.05);
    const lt = HP(5.25, 1.4, -1.0), rt = HP(-5.25, 1.4, -1.0), top = HP(0, 7.3, -1.4);
    const W0 = Math.max(Math.abs(lt.x - rt.x) / 2, 3.4 * U) * D.drape.w;
    const xs = [nape.x, ...Array.from(s.x)], ys = [nape.y, ...Array.from(s.y)];
    // 颈后收、披到肩背上散开、发梢收拢
    const wAt = (t: number) => W0 * (0.86 + (fem ? 0.34 : 0.2) * Math.sin(Math.PI * Math.min(1, t * 1.6)) - 0.5 * t * t);
    const body = lockPath(xs, ys, wAt, fem ? 5 : 4, 0.04);
    const path = lockPath(xs, ys, wAt, fem ? 5 : 4, 0.04, { a: lt, b: rt, top });
    const zz = c.zBody;
    const gr = () => headGrad;
    const detail = () => { g.save(); g.beginPath(); body(); g.clip(); lockLines(xs, ys, wAt, 7); g.restore(); };
    c.push(zz, () => { fillOutline(path, gr()); detail(); });
    pieces.push({ root: nape, path, detail, z: zz });
  }
  // 马尾 / 垂髾（脑后一束）
  // root：从发结伸出的一段（头部局部坐标，硬一些，随头转），之后接布料条带自由垂落
  const tail = style === 'ponytail' ? { root: [[0, 6.4, -4.0], [0, 6.95, -4.95], [0, 6.5, -5.85], [0, 5.5, -6.35]] as V[], n: 6, len: fem ? 5.6 : 4.7, w: fem ? 2.0 : 1.9, tips: 3 }
    : style === 'chuihuan' ? { root: [[0, -0.4, -4.9], [0, -1.6, -5.3]] as V[], n: 6, len: 5.2, w: 1.6, tips: 2 }
      : null;
  if (tail) {
    const rp = tail.root.map((q) => HP(q[0], q[1], q[2]));
    const r = rp[0], last = rp[rp.length - 1];
    const s = c.strand('pony', tail.n, tail.len, last.x, last.y, 1.7, 1);
    const xs = [...rp.map((q) => q.x), ...Array.from(s.x).slice(1)], ys = [...rp.map((q) => q.y), ...Array.from(s.y).slice(1)];
    const wAt = (t: number) => tail.w * U * (0.7 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.7 + 0.12))) * (1 - 0.55 * t);
    const path = lockPath(xs, ys, wAt, tail.tips, 0.05);
    const detail = () => { g.save(); g.beginPath(); path(); g.clip(); lockLines(xs, ys, wAt, 4); g.restore(); };
    const z = r.z - 0.6;
    if (r.z < hed.z + 0.3) c.push(Math.min(z, c.zBody + 0.1), () => { fillOutline(path, headGrad); detail(); });
    else c.push(z, () => { fillOutline(path, headGrad); detail(); });
    pieces.push({ root: r, path, detail, z });
  }
  // 侧编长发：一侧胸前一条辫子
  let braid: { xs: number[]; ys: number[]; front: boolean } | null = null;
  if (style === 'braid') {
    const r = HP(sideSign * 4.4, -1.0, -0.6);
    const s = c.strand('braid', 7, 3.8, r.x, r.y, 1.6, 1.1);
    braid = { xs: [r.x, ...Array.from(s.x)], ys: [r.y, ...Array.from(s.y)], front: visN(sideSign, 0, 0.6) > -0.1 };
  }
  // 鬓发 / 龙须：两缕从鬓角垂到胸前
  const locks: { s: StrandLike; root: P2; side: number; front: boolean }[] = [];
  if (D.locks) {
    for (const sx of [1, -1]) {
      if (style === 'braid' && sx === sideSign) continue;
      const root = HP(sx * 4.6, 1.9, 1.1);
      const s = c.strand('lock' + (sx > 0 ? 'L' : 'R'), 5, D.locks, root.x, root.y, 1.5, 1);
      locks.push({ s, root, side: sx, front: visN(sx * 0.8, 0, 0.6) > 0.0 });
    }
  }
  const lockDraw = (L: { s: StrandLike; root: P2; side: number }, w: number) => {
    const xs = [L.root.x, ...Array.from(L.s.x)], ys = [L.root.y, ...Array.from(L.s.y)];
    // 细而有弯：根部略宽，往下收成一根发梢，中段随时间轻轻摆
    for (let i = 1; i < xs.length; i++) xs[i] += Math.sin(i * 1.3 + c.t * 1.6 + L.side) * 0.35 * U * (i / xs.length);
    const wAt = (t: number) => w * U * (1 - 0.88 * t) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 2.2)));
    const path = lockPath(xs, ys, wAt, 1);
    g.save(); clipBelow(); g.beginPath(); path(); g.strokeStyle = ink; g.lineWidth = lw * 1.2; g.stroke(); g.restore();
    g.beginPath(); path(); g.fillStyle = headGrad; g.fill();
    if (fine) { g.strokeStyle = light; g.lineWidth = Math.max(0.3, 0.2 * U); g.beginPath(); g.moveTo(xs[0], ys[0]); for (let i = 1; i < xs.length - 1; i++) g.lineTo(xs[i] - 0.15 * U, ys[i]); g.stroke(); }
  };
  const braidDraw = () => {
    if (!braid) return;
    const { xs, ys } = braid; const m = xs.length;
    // 辫子：一节节交错的小团
    const segs: { x: number; y: number; r: number; ang: number }[] = [];
    for (let i = 0; i < m - 1; i++) for (const f of [0.25, 0.75]) {
      const x = xs[i] + (xs[i + 1] - xs[i]) * f, y = ys[i] + (ys[i + 1] - ys[i]) * f;
      const ang = Math.atan2(ys[i + 1] - ys[i], xs[i + 1] - xs[i]);
      segs.push({ x, y, r: (1.55 - 0.08 * i) * U, ang });
    }
    const one = (q: typeof segs[0], k: number) => { g.beginPath(); g.ellipse(q.x + Math.cos(q.ang + Math.PI / 2) * (k % 2 ? 0.45 : -0.45) * U, q.y + Math.sin(q.ang + Math.PI / 2) * (k % 2 ? 0.45 : -0.45) * U, q.r * 1.05, q.r * 0.82, q.ang + (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2); };
    g.strokeStyle = ink; g.lineWidth = outlineW; segs.forEach((q, k) => { one(q, k); g.stroke(); });
    segs.forEach((q, k) => { one(q, k); g.fillStyle = headGrad; g.fill(); if (fine) { g.strokeStyle = dark; g.lineWidth = Math.max(0.3, 0.3 * U); g.stroke(); } });
    // 辫梢
    const e = segs[segs.length - 1];
    g.beginPath(); g.moveTo(e.x - 0.8 * U, e.y); g.lineTo(e.x + Math.cos(e.ang) * 3.2 * U, e.y + Math.sin(e.ang) * 3.2 * U); g.lineTo(e.x + 0.8 * U, e.y);
    g.fillStyle = headGrad; g.fill(); g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
    // 辫绳
    if (look.ribbon) { g.strokeStyle = look.ribbon; g.lineWidth = 1.0 * U; g.beginPath(); g.moveTo(e.x - 1.2 * U, e.y - 0.2 * U); g.lineTo(e.x + 1.2 * U, e.y + 0.2 * U); g.stroke(); }
  };

  // ---- 分组绘制：头后 / 头前
  const behindMasses = masses.filter((m) => m.z < hed.z - 0.6 && !isTop(m));
  const frontMasses = masses.filter((m) => !(m.z < hed.z - 0.6 && !isTop(m)));
  function isTop(m: Mass) { return false && m; }
  const drawGroup = (list: Mass[], withShell: boolean, extra: Piece[]) => {
    const shellPath = () => smoothClosed(g, shellHull);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    // 1) 墨边（发壳之外的部件）→ 2) 发壳描边并填色（一次裁剪）→ 3) 其余部件填色：
    //    发壳的填色盖住部件墨边、部件的填色盖住发壳墨边，交界处不留缝
    g.strokeStyle = ink;
    for (const p of extra) { g.save(); g.beginPath(); g.rect(hed.x - BIG, hed.y - BIG, BIG * 2, BIG + 7 * U); g.clip(); g.beginPath(); p.path(); g.lineWidth = outlineW; g.stroke(); g.restore(); }
    for (const m of list) {
      if (m.path) { g.beginPath(); m.path(); g.lineWidth = outlineW; g.stroke(); }
      else if (m.band) strokeBand(m.band, outlineW, ink);
    }
    if (withShell) { g.save(); clipAbove(); g.beginPath(); shellPath(); g.strokeStyle = ink; g.lineWidth = outlineW; g.stroke(); g.fillStyle = headGrad; g.fill(); g.restore(); }
    for (const p of extra) { g.save(); g.beginPath(); g.rect(hed.x - BIG, hed.y - BIG, BIG * 2, BIG + 7 * U); g.clip(); g.beginPath(); p.path(); g.fillStyle = headGrad; g.fill(); g.restore(); }
    for (const m of list) {
      if (m.path) { g.beginPath(); m.path(); g.fillStyle = headGrad; g.fill(); }
      else if (m.band) strokeBand(m.band, 0, headGrad);
    }
    // 3) 细节
    for (const p of extra) if (p.detail) { g.save(); g.beginPath(); g.rect(hed.x - BIG, hed.y - BIG, BIG * 2, BIG + 7 * U); g.clip(); p.detail(); g.restore(); }
    if (withShell) shellDetail();
    for (const m of list) m.detail?.();
    g.restore();
  };
  const strokeBand = (b: NonNullable<Mass['band']>, extraW: number, col: string | CanvasGradient) => {
    // 一条折线一次描完（逐段描太慢）；宽度取平均
    const n = b.pts.length;
    let w = 0; for (const x of b.w) w += x; w /= n;
    g.strokeStyle = col; g.lineWidth = w + extraW;
    g.beginPath(); g.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < n; i++) g.lineTo(b.pts[i].x, b.pts[i].y);
    if (b.closed) g.closePath();
    g.stroke();
  };

  // ---- 刘海：几缕带尖的薄发，不过眉
  const bangs = () => {
    if (!look.bangs || visN(0, 0.1, 1) < 0.05) return;
    const list: P2[][] = [];
    const k = style === 'twin' ? 7 : 5;
    for (let i = 0; i < k; i++) {
      const u = (i / (k - 1)) * 2 - 1;                      // -1..1
      const a = u * 0.78;
      const rootY = hairline(a) + 1.1;
      const tipY = 2.45 + Math.abs(u) * 0.55 + (i % 2) * 0.25;
      const s0 = surf(a - 0.13, rootY, inflate(rootY, a) + 0.01), s1 = surf(a + 0.13, rootY, inflate(rootY, a) + 0.01);
      const sm = surf(a + u * 0.05, (rootY + tipY) / 2 + 0.2, 1.1), st = surf(a + u * 0.1, tipY, 1.08);
      if (st.n < 0.05) continue;
      list.push([HP(s0.x, s0.y, s0.z), HP(sm.x, sm.y, sm.z), HP(st.x, st.y, st.z), HP(s1.x, s1.y, s1.z)]);
    }
    const path = (q: P2[]) => { g.moveTo(q[0].x, q[0].y); g.quadraticCurveTo(q[1].x - 0.4 * U, q[1].y, q[2].x, q[2].y); g.quadraticCurveTo(q[1].x + 0.5 * U, q[1].y - 0.3 * U, q[3].x, q[3].y); g.closePath(); };
    g.save(); clipBelow(); g.strokeStyle = ink; g.lineWidth = lw * 1.4; g.lineJoin = 'round';
    for (const q of list) { g.beginPath(); path(q); g.stroke(); }
    g.restore();
    for (const q of list) { g.beginPath(); path(q); g.fillStyle = headGrad; g.fill(); }
  };
  // ---- 侧分 / 堕马髻：额前一片斜梳的厚发（侧分线一侧）
  const sweep = () => {
    if (D.part !== 'side' || visN(0, 0.1, 1) < 0.1 || look.bangs) return;
    const sgn = -sideSign;
    const s0 = surf(sgn * -0.35, hairline(0.35) + 0.2, 1.08), s1 = surf(sgn * 0.5, 2.0, 1.1), s2 = surf(sgn * 1.25, 1.1, 1.08), s3 = surf(sgn * 0.9, 4.0, 1.1);
    if (s1.n < 0.1) return;
    const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z), q3 = HP(s3.x, s3.y, s3.z);
    const path = () => { g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y + 0.6 * U, q2.x, q2.y); g.quadraticCurveTo(q3.x, q3.y, q0.x, q0.y - 0.3 * U); g.closePath(); };
    g.save(); clipBelow(); g.beginPath(); path(); g.strokeStyle = ink; g.lineWidth = lw * 1.4; g.stroke(); g.restore();
    g.beginPath(); path(); g.fillStyle = headGrad; g.fill();
    if (fine) { g.strokeStyle = light; g.lineWidth = Math.max(0.3, 0.3 * U); g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y, q2.x, q2.y); g.stroke(); }
  };

  return {
    anchors: A,
    behind: () => {
      if (style === 'bald') return;
      drawGroup(behindMasses, false, []);
      if (visN(0, 0, 1) > -0.25) for (const L of locks) if (!L.front) lockDraw(L, fem ? 0.95 : 0.8);
      if (braid && !braid.front) braidDraw();
    },
    front: () => {
      if (style === 'bald') {
        // 光头：头皮上一层淡青的发茬
        if (!fine) return;
        g.save(); g.beginPath(); smoothClosed(g, shellHull); g.clip(); clipAbove();
        const gr = g.createRadialGradient(hed.x - 2 * U, hed.y - 6 * U, 0, hed.x, hed.y - 3 * U, 9 * U); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(90,100,110,0.06)'); gr.addColorStop(1, 'rgba(60,70,80,0.12)');
        g.fillStyle = gr; g.beginPath(); smoothClosed(g, shellHull); g.fill(); g.restore();
        return;
      }
      // 背面看时，披发 / 马尾的上段与后脑并成一片（不留后脑下沿那道墨线）
      const extra = pieces.filter((p) => p.root.z > hed.z - 0.2 && visN(0, -0.2, -1) > 0.2);
      drawGroup(frontMasses, true, extra);
      sweep();
      bangs();
    },
    over: () => {
      if (style === 'bald') return;
      for (const L of locks) if (L.front) lockDraw(L, fem ? 0.95 : 0.8);
      if (braid && braid.front) braidDraw();
    },
  };
}

/** 发型是否有顶髻（冠、莲花冠可直接套） */
export function hasTopKnot(s: HairStyle) { return s === 'bun' || s === 'crown' || s === 'short' || s === 'elder' || s === 'updo' || s === 'chuihuan'; }
