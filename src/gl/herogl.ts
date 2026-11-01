// 第二十八步：我方身上的特效——风雷翅（第三十五步：淡金雷翼）、雷遁 / 血遁残影光、护体剑盾（剑网）
import type { Combat } from '../world/combat';
import { FxSys, col, mixc, RGB, fireCell, smokeCell } from './fx';
import { C } from './atlas';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const BLUE: RGB = [0.55, 0.66, 1], VIOLET: RGB = [0.72, 0.52, 1], WHITE: RGB = [1, 1, 1];

/** 一侧风雷翅（第三十五步·原著）：雷鹏骨翅经辟邪神雷炼化，蓝电尽被逼出，双翼染作淡金——
 *  古铜墨底压住亮地 → 淡金翎羽 → 金白翼缘（整条外缘一道亮金描边）→ 金色雷丝沿翼缘来回爬行，振翅时满翼噼啪。
 *  gk：0 = 初展时的残余蓝电，1 = 纯金（展翅 0.5 秒内由蓝转金） */
/** 第三十八步：翼的朝向——设计平面（侧向 × 向上）放进身体坐标系再按人物同一套投影画到屏幕：
 *  yaw 与 character.ts 相同（0 = 面朝镜头 / 向下飞，π = 背对镜头 / 向上飞）；sw = 后掠角（雷遁疾飞时更大）。
 *  面朝镜头时翼在身后（Z<0），与身体重叠的部分按躯干轮廓淡去——翼从肩后伸出，不再盖在身上朝上张着 */
export interface WingPose { ax: number; ay: number; yaw: number; sw: number }
const PITCH_C = Math.cos(0.36), PITCH_S = Math.sin(0.36);
function wingMap(P: WingPose) {
  // 侧面看时多后掠一些：翼向身后拖出，不至于缩成一条竖线
  const sw = Math.min(1.1, P.sw + 0.5 * Math.abs(Math.sin(P.yaw)));
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cs = Math.cos(sw), ss = Math.sin(sw);
  /** 设计坐标（相对肩背，y 向下为正）→ [屏幕 x, 屏幕 y, 深度 Z（>0 在身前）] */
  return (px: number, py: number): [number, number, number] => {
    const lx = px * cs, lz = -Math.abs(px) * ss - 10, ly = -py;
    const X = lx * cy + lz * sy, Z = -lx * sy + lz * cy;
    return [P.ax + X, P.ay - ly * PITCH_C + Z * PITCH_S, Z];
  };
}
/** 身后部分被躯干挡住：到“头—脚”胶囊的距离 → 透明度系数 */
function wingOcc(P: WingPose, x: number, y: number, Z: number) {
  if (Z >= 0) return 1;
  const y0 = P.ay - 54, y1 = P.ay + 84, yy = Math.max(y0, Math.min(y1, y)), d = Math.hypot(x - P.ax, y - yy);
  const r = y < P.ay - 30 ? 13 : 19;
  return Math.max(0, Math.min(1, (d - r * 0.55) / (r * 0.9)));
}

/** 一侧风雷翅（第三十五步·原著）：雷鹏骨翅经辟邪神雷炼化，蓝电尽被逼出，双翼染作淡金——
 *  古铜墨底压住亮地 → 淡金翎羽 → 金白翼缘（整条外缘一道亮金描边）→ 金色雷丝沿翼缘来回爬行，振翅时满翼噼啪。
 *  gk：0 = 初展时的残余蓝电，1 = 纯金（展翅 0.5 秒内由蓝转金）。第三十八步：几何经 wingMap 投影（朝向 / 后掠 / 遮挡）。 */
function wing(F: FxSys, P: WingPose, side: number, open: number, flap: number, t: number, a: number, ws = 1, gk = 1) {
  const sc = (0.55 + 0.45 * open) * ws, lift = -flap * 0.5;           // 振翅：整翼绕肩上下摆
  const M = wingMap(P);
  const cl = Math.cos(lift * side), sl = Math.sin(lift * side);
  const rotD = (dx: number, dy: number): [number, number] => [(dx * cl - dy * sl) * sc, (dx * sl + dy * cl) * sc];
  const toS = (d: [number, number]) => M(d[0], d[1]);
  const Sd = rotD(0, 0), Ed = rotD(side * 80, -46), Wd = rotD(side * 175, -92);
  const S3 = toS(Sd), E3 = toS(Ed), W3 = toS(Wd);
  const S: [number, number] = [S3[0], S3[1]], E: [number, number] = [E3[0], E3[1]], W: [number, number] = [W3[0], W3[1]];
  // 翼根：在身后时从肩缘伸出（躯干挡住正中）
  const R3 = S3[2] < 0 ? toS(rotD(side * 20, -8)) : S3, Sr: [number, number] = [R3[0], R3[1]];
  const oc = (x: number, y: number, Z: number) => wingOcc(P, x, y, Z);
  const N = 12, tips: [number, number][] = [], tipZ: number[] = [];
  const INK: RGB = [0.24, 0.15, 0.04];
  const GOLD = mixc(BLUE, [1, 0.8, 0.36], gk), PALE = mixc(VIOLET, [1, 0.9, 0.62], gk), RIM = mixc(mixc(BLUE, WHITE, 0.4), [1, 0.95, 0.72], gk);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
    const k = i / (N - 1);                                     // 0 = 腕（初级飞羽）… 1 = 肩（次级飞羽）
    const Rd: [number, number] = k < 0.5 ? [Wd[0] + (Ed[0] - Wd[0]) * k * 2, Wd[1] + (Ed[1] - Wd[1]) * k * 2] : [Ed[0] + (Sd[0] - Ed[0]) * (k - 0.5) * 2, Ed[1] + (Sd[1] - Ed[1]) * (k - 0.5) * 2];
    const ang = (side > 0 ? 0 : Math.PI) + side * (-0.55 + k * 1.75 + lift * 0.6 + Math.sin(t * 6 + i) * 0.03);
    const len = (170 - k * 95) * sc * (0.75 + 0.25 * open);
    const R3i = toS(Rd), T3 = toS([Rd[0] + Math.cos(ang) * len, Rd[1] + Math.sin(ang) * len * 0.9]);
    const tx = T3[0], ty = T3[1], R0 = R3i[0], R1 = R3i[1];
    const mx = (R0 + tx) / 2, my = (R1 + ty) / 2, ra = Math.atan2(ty - R1, tx - R0), L2 = Math.max(4, Math.hypot(tx - R0, ty - R1));
    const o = oc(mx, my, (R3i[2] + T3[2]) / 2);
    if (o <= 0.01) { if (pass === 1) { tips.push([tx, ty]); tipZ.push(T3[2]); } continue; }
    if (pass === 0) { F.sprite(C.Leaf, mx, my, L2 * 1.12, (32 - k * 8) * ws, ra, INK, 0.42 * a * o, 0); continue; }
    tips.push([tx, ty]); tipZ.push(T3[2]);
    const c = mixc(PALE, GOLD, 0.35 + k * 0.5);
    F.sprite(C.Leaf, mx, my, L2 * 1.02, (22 - k * 6) * ws, ra, c, 0.32 * a * o);
    F.sprite(C.Blade, R0 + (tx - R0) * 0.55, R1 + (ty - R1) * 0.55, L2 * 0.9, 5 * ws, ra, mixc(c, WHITE, 0.35), 0.5 * a * o);
    // 翎尖金芒
    F.glow(tx, ty, (k < 0.45 ? 11 : 7) * ws, RIM, (k < 0.45 ? 0.7 : 0.45) * a * oc(tx, ty, T3[2]), C.Star);
  }
  // 翼骨：古铜底 + 金色亮芯（在身后时从肩缘起）
  const bc = mixc(GOLD, WHITE, 0.3);
  const oSE = oc((Sr[0] + E[0]) / 2, (Sr[1] + E[1]) / 2, (R3[2] + E3[2]) / 2), oEW = oc((E[0] + W[0]) / 2, (E[1] + W[1]) / 2, (E3[2] + W3[2]) / 2);
  F.beam(Sr[0], Sr[1], E[0], E[1], 12 * ws, INK, 0.62 * a * oSE, C.Beam, 0); F.beam(E[0], E[1], W[0], W[1], 10 * ws, INK, 0.62 * a * oEW, C.Beam, 0);
  F.beam(Sr[0], Sr[1], E[0], E[1], 5 * ws, bc, 0.85 * a * oSE); F.beam(E[0], E[1], W[0], W[1], 4 * ws, bc, 0.85 * a * oEW);
  F.glow(W[0], W[1], 18 * ws, RIM, 0.8 * a * oc(W[0], W[1], W3[2]), C.Star);
  // 金边：腕 → 各翎尖 → 肩，一圈连续的金色外缘（外晕 + 白金芯）
  const rim: [number, number][] = [W, ...tips, Sr], rimZ = [W3[2], ...tipZ, R3[2]];
  for (let i = 0; i < rim.length - 1; i++) {
    const p0 = rim[i], p1 = rim[i + 1], o = oc((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (rimZ[i] + rimZ[i + 1]) / 2);
    if (o <= 0.01) continue;
    F.beam(p0[0], p0[1], p1[0], p1[1], 9 * ws, GOLD, 0.32 * a * o);
    F.beam(p0[0], p0[1], p1[0], p1[1], 2.6 * ws, RIM, 0.85 * a * o);
  }
  // 爬行雷光：两点金白电光沿翼缘来回游走，身后拖一串电丝
  const L = rim.length - 1;
  for (let j = 0; j < 2; j++) {
    const u = (t * (0.9 + j * 0.37) + j * 0.5) % 2, q = u < 1 ? u : 2 - u, f = q * L, i0 = Math.min(L - 1, Math.floor(f)), fr = f - i0;
    const px = rim[i0][0] + (rim[i0 + 1][0] - rim[i0][0]) * fr, py = rim[i0][1] + (rim[i0 + 1][1] - rim[i0][1]) * fr;
    const o = oc(px, py, rimZ[i0]); if (o <= 0.01) continue;
    F.glow(px, py, 22 * ws, RIM, 0.75 * a * o); F.glow(px, py, 8 * ws, WHITE, 0.9 * a * o, C.Star);
    const back = rim[Math.max(0, Math.min(L, i0 + (u < 1 ? -1 : 2)))];
    F.bolt(px, py, back[0], back[1], Math.floor(t * 30) + j * 977, 8, 1.1, RIM, 0.85 * a * o, 4, false);
  }
  // 翼缘雷丝 / 翼骨雷 / 下坠细电（残余的蓝电随 gk 消退）
  for (let i = 0; i < tips.length - 1; i++) if (Math.random() < 0.35) { const o = oc(tips[i][0], tips[i][1], tipZ[i]); if (o > 0.3) F.bolt(tips[i][0], tips[i][1], tips[i + 1][0], tips[i + 1][1], Math.random() * 1e6, 10, 1.1, RIM, 0.85 * a * o, 4, false); }
  if (Math.random() < 0.25) F.bolt(Sr[0], Sr[1], W[0], W[1], Math.random() * 1e6, 14, 1.2, mixc(GOLD, WHITE, 0.3), 0.8 * a * Math.max(oSE, 0.3), 7, false);
  if (Math.random() < 0.15) { const ti = Math.floor(Math.random() * 6), tp = tips[ti]; if (oc(tp[0], tp[1], tipZ[ti]) > 0.3) F.bolt(tp[0], tp[1], tp[0] + rnd(-40, 40), tp[1] + rnd(80, 180), Math.random() * 1e6, 18, 1.3, GOLD, 0.7 * a, 6, true); }
  if (gk < 1 && Math.random() < 0.6 * (1 - gk)) { const tp = tips[Math.floor(Math.random() * tips.length)]; F.bolt(Sr[0], Sr[1], tp[0], tp[1], Math.random() * 1e6, 16, 1.4, BLUE, 0.9 * (1 - gk) * a, 7, true); }
  const G3 = M(side * 110 * ws, -10);
  F.glow(G3[0], G3[1], 150 * ws, GOLD, 0.08 * a);
}
/** 主角当前朝向 / 翼根（含飞行离地高度） */
function heroWingPose(p: any, dy: number, boosting: boolean): WingPose {
  const st = p.st, lift = st?.lift ?? 0;
  return { ax: p.x, ay: p.y - lift - dy, yaw: st?.yaw ?? Math.PI, sw: boosting ? 0.72 : 0.28 };
}

let stepIdx = 0;
/** 第三十步：主角奔跑落脚扬尘（淡土色、覆盖混合，不发光） */
function runDust(F: FxSys, p: any) {
  const st = p.st; if (!st || st.action !== 'run' || p.flying) { stepIdx = Math.floor((st?.phase ?? 0) / Math.PI); return; }
  const k = Math.floor(st.phase / Math.PI);
  if (k === stepIdx) return;
  stepIdx = k;
  const sp = Math.hypot(st.vx, st.vy) || 1, ux = st.vx / sp, uy = st.vy / sp;
  const side = (k & 1) ? 1 : -1, fx = p.x - uy * 6 * side, fy = p.y + ux * 3 * side;
  const DUST: RGB = [0.56, 0.5, 0.4];
  for (let i = 0; i < 3; i++) F.emit({ x: fx + rnd(-5, 5), y: fy + rnd(-2, 2), vx: -ux * rnd(40, 90) + rnd(-25, 25), vy: -uy * rnd(20, 45) - rnd(8, 24), life: rnd(0.45, 0.75), s0: rnd(7, 11), s1: rnd(20, 30), rot: Math.random() * TAU, vr: rnd(-1.5, 1.5), c: DUST, a: 0.2, add: 0, cell: smokeCell(), drag: 3 });
  if (Math.random() < 0.5) F.emit({ x: fx, y: fy - 2, vx: -ux * 60, vy: -30, life: 0.3, s0: 2, s1: 1, c: [0.45, 0.4, 0.32], a: 0.5, add: 0, cell: C.Dot, grav: 200 });
}

export function drawHeroGL(F: FxSys, c: Combat, t: number, dt: number) {
  const p = c.game.player;
  runDust(F, p);
  // —— 第三十五步：佩风雷翅催动雷遁时，背后展开金色雷翼（较战斗展翅略小）
  if (!c.wing && p.flying && p.boosting && c.game.boostKind === 'thunder') {
    const P = heroWingPose(p, 92, true), flap = Math.sin(t * 9) * 0.45;
    wing(F, P, 1, 1, flap, t, 0.85, 1.0, 1); wing(F, P, -1, 1, flap, t, 0.85, 1.0, 1);
  }
  // —— 风雷翅
  if (c.wing) {
    const w = c.wing, open = Math.min(1, (w.max - w.t) / 0.35) * Math.min(1, w.t / 0.4);
    const flap = w.flap > 0 ? Math.sin((0.6 - w.flap) / 0.6 * Math.PI * 3) : Math.sin(t * 7) * 0.35;
    const P = heroWingPose(p, 98, !!(p.flying && p.boosting));   // 第三十八步：翼根随身体（含飞行高度）、随朝向
    const sx = P.ax, sy = P.ay, ws = 1.45 + w.lv * 0.08;   // 第三十步：雷翼放大
    const gk = Math.min(1, (w.max - w.t) / 0.5);                // 第三十五步：初展蓝电 → 半息内尽化淡金
    const GOLD: RGB = mixc(BLUE, [1, 0.8, 0.36], gk), GW: RGB = mixc(BLUE, [1, 0.95, 0.72], gk);
    wing(F, P, 1, open, flap, t, open, ws, gk);
    wing(F, P, -1, open, flap, t, open, ws, gk);
    // 金雷护身、脚下风旋（两层反向）
    F.glow(sx, sy + 20, 70, GOLD, 0.18 * open);
    F.ground(C.RingSoft, p.x, p.y, 120, t * 3, GOLD, 0.32 * open, 1, 0.5);
    F.ground(C.Rune, p.x, p.y, 90, -t * 1.6, GW, 0.22 * open, 1, 0.5);
    if (Math.random() < dt * 16) F.emit({ x: p.x + rnd(-40, 40), y: p.y - rnd(0, 120), vx: rnd(-40, 40), vy: rnd(-90, -30), life: rnd(0.3, 0.5), s0: 3, s1: 1, c: GW, cell: C.Glow });
    if (Math.random() < dt * 5) F.crackle(sx, sy, 90 * ws, GW, 0.8 * open, 1);
    // 振翅一扇：风雷气浪（金）——一圈金色冲击 + 十余道金雷向四方炸开 + 翼下噼啪
    if (w.flap > 0.55) {
      F.shockRing(p.x, p.y, 500, GOLD, 0.5, 0.6, 1); F.shockRing(p.x, p.y, 340, GW, 0.38, 0.6, 0.8);
      F.flash(sx, sy, 90, GW, 0.18);
      for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; F.bolt(p.x, p.y - 60, p.x + Math.cos(a) * 420, p.y - 60 + Math.sin(a) * 250, Math.random() * 1e6, 22, 1.6, i % 3 ? GOLD : GW, 0.9, 8, true); }
      F.crackle(sx - 150 * ws, sy - 30, 80, GW, 0.9, 2); F.crackle(sx + 150 * ws, sy - 30, 80, GW, 0.9, 2);
    }
  }
  // —— 残影光：雷遁蓝、血遁红
  for (const g of c.ghosts) {
    if (g.t < 0) continue;
    const k = 1 - g.t / g.dur, cc = col(g.color);
    F.sprite(C.Glow, g.x, g.y - 60, 70, 150, 0, cc, 0.22 * k);
    if ((g.color.startsWith('170') || g.color.startsWith('255,220')) && Math.random() < 0.25) F.bolt(g.x + rnd(-20, 20), g.y - rnd(20, 120), g.x + rnd(-30, 30), g.y - rnd(0, 120), Math.random() * 1e6, 10, 1, cc, 0.7 * k, 4, false);
    if (!g.color.startsWith('170') && !g.color.startsWith('255,220') && Math.random() < 0.3) F.emit({ x: g.x + rnd(-14, 14), y: g.y - rnd(20, 110), vy: rnd(10, 40), life: 0.5, s0: rnd(8, 14), s1: 20, c: [0.5, 0.03, 0.05], a: 0.35, add: 0, cell: smokeCell() });
  }
}

/** 护体剑盾：内外两环飞剑交错旋转，剑与剑之间以剑气相连成网 */
export function drawOrbitGL(F: FxSys, c: Combat, t: number) {
  const o = c.orbit; if (!o) return;
  const p = c.game.player, cc = col(o.color), core = mixc(cc, WHITE, 0.55);
  const pts: [number, number][] = [];
  const fade = Math.min(1, o.t / 0.5);
  for (let i = 0; i < o.n; i++) {
    const inner = i % 2 === 1 && o.n >= 6;
    const r = o.r * (inner ? 0.72 : 1), dir = inner ? -1 : 1;
    const an = t * 3.2 * dir + (i / o.n) * TAU;
    const x = p.x + Math.cos(an) * r, y = p.y - 46 + Math.sin(an) * r * 0.5 + (inner ? -14 : 0);
    const trail: [number, number][] = [];
    for (let k = 7; k >= 0; k--) { const a2 = an - dir * k * 0.08; trail.push([p.x + Math.cos(a2) * r, p.y - 46 + Math.sin(a2) * r * 0.5 + (inner ? -14 : 0)]); }
    F.trail(trail, 16, cc, 0.45 * fade);
    F.trail(trail, 5, core, 0.6 * fade);
    F.sprite(C.Blade, x, y, 84, 20, an + dir * Math.PI / 2, cc, 0.9 * fade);
    F.sprite(C.Blade, x, y, 70, 7, an + dir * Math.PI / 2, core, 0.7 * fade);
    F.glow(x, y, 26, cc, 0.35 * fade);
    pts.push([x, y]);
  }
  // 剑网
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; F.beam(a[0], a[1], b[0], b[1], 1.6, core, 0.35 * fade); }
  F.sprite(C.RingSoft, p.x, p.y - 50, o.r * 2.3, o.r * 1.5, 0, cc, 0.12 * fade);
  F.ground(C.Rune, p.x, p.y, o.r * 1.05, t * 0.8, cc, 0.25 * fade, 1, 0.5);
}
