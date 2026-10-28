// 第 6 阶段：法术特效库（WebGL）。按「出手方式 × 五行」配方绘制：弹头、拖尾、命中爆开、持续场、光柱、锁链、锥形……
// 配方表在 data/vfxstyles.ts（法术 → 配方 + 色板），宗门色系在 data/sectfx.ts。
// 图样来自 fxbake.ts 的程序烘焙贴图（剑气月牙、雪花、鬼火、飞剑、掌印、法相……全部原创着色器生成，不占包体）。
// 用法（其他分支新增出手方式时）：见 docs/stage-notes/s6-vfx.md「特效库接口」。
import { K } from './fxbake';
import { FxSys, RGB, col, mixc, fireCell, smokeCell, extOK } from './fx';
import { C } from './atlas';
import { decal, inkSplat, elecLine } from './bakefx';
import { ART_VFX, FX_RECIPE, FX_EL, Pal } from '../data/vfxstyles';
import { SECT_FX } from '../data/sectfx';

const TAU = Math.PI * 2;
const WHITE: RGB = [1, 1, 1];
const INK: RGB = [0.07, 0.06, 0.06];
const SQ = 0.55;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ 色板 / 配方解析
export interface PalR { a: RGB; b: RGB; c: RGB }
export interface St { r: string; P: PalR; s: number; any?: string; sect?: string; fx?: string }
const palCache = new Map<string, PalR>();
export function palOf(p: Pal | string[]): PalR {
  const k = p.join('|'); let v = palCache.get(k);
  if (!v) { v = { a: col(p[0]), b: col(p[1]), c: col(p[2]) }; palCache.set(k, v); }
  return v;
}
/** 由颜色推一个色板（亮芯偏白、暗边压暗） */
export function palFromColor(c: string): PalR {
  let v = palCache.get(c);
  if (!v) { const b = col(c); v = { a: mixc(b, WHITE, 0.7), b, c: [b[0] * 0.35, b[1] * 0.35, b[2] * 0.35] }; palCache.set(c, v); }
  return v;
}

/** 解析一个弹道 / 光效 / 区域对象应套用的配方（结果缓存在对象上）；没有配方返回 null（沿用旧画法） */
export function styleOf(o: any): St | null {
  if (o._st !== undefined) return o._st;
  let st: St | null = null;
  const av = o.skill ? ART_VFX[o.skill] : undefined;
  if (av && REC[av.r]) st = { r: av.r, P: av.pal ? palOf(av.pal) : palFromColor(o.color ?? '255,230,180'), s: av.s ?? 1, fx: o.fx };
  else if (o.sect && SECT_FX[o.sect]) {
    const S = SECT_FX[o.sect], el = FX_EL[o.fx] ?? '', r = S.sig?.[el] ?? FX_RECIPE[o.fx];
    if (r && REC[r]) st = { r, P: palOf(S.pal), s: 1, any: S.any, sect: o.sect, fx: o.fx };
    else st = { r: '', P: palOf(S.pal), s: 1, any: S.any, sect: o.sect, fx: o.fx };   // 无配方：仅换宗门色（走通用画法）
  }
  o._st = st;
  return st;
}
/** 某法术是否有专属配方（供测试 / 检查） */
export const hasRecipe = (r: string) => !!REC[r];
export const recipeNames = () => Object.keys(REC);

// ------------------------------------------------------------------ 烘焙图样粒子（雪花、花瓣、羽毛、灵虫、鬼火……随风飘落）
const BPN = 480, BF = 20;
const BPa = new Float32Array(BPN * BF); let nbp = 0;
// 字段：0 x 1 y 2 vx 3 vy 4 life 5 max 6 s0 7 s1 8 rot 9 vr 10 r 11 g 12 b 13 a 14 add 15 grav 16 drag 17 h 18 k 19 sq
interface BPo { vx?: number; vy?: number; life: number; s0: number; s1?: number; rot?: number; vr?: number; c: RGB; a?: number; add?: number; grav?: number; drag?: number; h?: number; sq?: number }
let PR = 1;   // 负载系数：粒子多时自动减量
export function bp(k: number, x: number, y: number, o: BPo) {
  if (nbp >= BPN || (PR < 1 && Math.random() > PR) || !Number.isFinite(x + y)) return;
  const q = BPa, i = nbp++ * BF;
  q[i] = x; q[i + 1] = y; q[i + 2] = o.vx ?? 0; q[i + 3] = o.vy ?? 0; q[i + 4] = 0; q[i + 5] = o.life; q[i + 6] = o.s0; q[i + 7] = o.s1 ?? o.s0;
  q[i + 8] = o.rot ?? 0; q[i + 9] = o.vr ?? 0; q[i + 10] = o.c[0]; q[i + 11] = o.c[1]; q[i + 12] = o.c[2]; q[i + 13] = o.a ?? 1; q[i + 14] = o.add ?? 1;
  q[i + 15] = o.grav ?? 0; q[i + 16] = o.drag ?? 0; q[i + 17] = o.h ?? 1; q[i + 18] = k; q[i + 19] = o.sq ?? 1;
}
function drawBP(F: FxSys, dt: number) {
  const q = BPa; let i = 0;
  while (i < nbp) {
    const o = i * BF; q[o + 4] += dt;
    if (q[o + 4] >= q[o + 5]) { const l = (nbp - 1) * BF; if (o !== l) q.copyWithin(o, l, l + BF); nbp--; continue; }
    const dr = q[o + 16]; if (dr) { const k = Math.exp(-dr * dt); q[o + 2] *= k; q[o + 3] *= k; }
    q[o + 3] += q[o + 15] * dt; q[o] += q[o + 2] * dt; q[o + 1] += q[o + 3] * dt; q[o + 8] += q[o + 9] * dt;
    const u = q[o + 4] / q[o + 5], s = q[o + 6] + (q[o + 7] - q[o + 6]) * u;
    const fa = u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88;
    F.bk(q[o + 18], q[o], q[o + 1], s, s * q[o + 17], q[o + 8], [q[o + 10], q[o + 11], q[o + 12]], q[o + 13] * fa, q[o + 14], q[o + 19]);
    i++;
  }
}
export const bpCount = () => nbp;

/** 每帧开头：更新负载系数、画烘焙粒子 */
export function vfxFrame(F: FxSys, dt: number) {
  const load = F.count / 6000 + nbp / BPN * 0.6;
  PR = load > 0.85 ? 0.25 : load > 0.6 ? 0.55 : 1;
  drawBP(F, dt);
  sigSeen.clear();
}
/** 当前负载系数（大场面据此限流） */
export const vfxPressure = () => PR;

// ------------------------------------------------------------------ 常用积木
type Pt = [number, number];
const ribbon = (F: FxSys, head: Pt[], w: number, P: PalR, a = 1) => { F.trail(head, w, P.b, 0.5 * a); F.trail(head, w * 0.36, mixc(P.a, WHITE, 0.3), 0.85 * a); };
/** 施法印记：每帧同一配方只出一次（扇形十几发不叠爆） */
const sigSeen = new Set<string>();
function sig(k: number, x: number, y: number, r: number, c: RGB, key: string, a = 0.8, life = 0.45) {
  if (sigSeen.has(key)) return; sigSeen.add(key);
  const rot = Math.random() * 0.4 - 0.2;
  decal(k, x, y, r * 0.44, r * 1.1, life, [c[0] * 0.25, c[1] * 0.25, c[2] * 0.25], a * 0.4, { rot, ease: 3, add: 0 });
  decal(k, x, y, r * 0.4, r, life, c, a, { rot, ease: 3 });
}
/** 带暗色垫底的贴花（亮底上轮廓清楚） */
function decal2(k: number, x: number, y: number, r0: number, r1: number, life: number, c: RGB, back: RGB, a: number, o: { rot?: number; vr?: number; sq?: number; ease?: number; h?: number } = {}) {
  const rot = o.rot ?? Math.random() * TAU;
  decal(k, x, y, r0 * 1.08, r1 * 1.08, life, back, a * 0.45, { ...o, rot, add: 0 });
  decal(k, x, y, r0, r1, life, c, a, { ...o, rot });
}
function burstStd(F: FxSys, x: number, y: number, r: number, P: PalR, k: number, n = 8, pk = k) {
  F.flash(x, y, r * 0.42, P.b, 0.16);
  F.shockRing(x, y + r * 0.2, r * 1.2, P.b, 0.4, 0.55, 0.55);
  decal2(k, x, y, r * 0.3, r, 0.5, P.b, P.c, 0.9, { ease: 3 });
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(80, 260) * (r / 70); bp(pk, x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 40, life: rnd(0.35, 0.7), s0: r * rnd(0.22, 0.35), s1: r * 0.08, rot: a, vr: rnd(-6, 6), c: mixc(P.b, WHITE, Math.random() * 0.4), drag: 2.5, grav: 120 }); }
}
/** 宗门标志点缀（any）：每颗弹头沿途偶尔飘出一枚 */
const ANY_K: Record<string, number> = { moon: K.MoonDisc, star: K.Star4, petal: K.PetalH, skull: K.Skull, leaf: K.Willow, cloud: K.Cloud, bug: K.Bug, note: K.SoundArc, blade: K.Crescent, blood: K.Drop, bamboo: K.Willow, gear: K.Glyph, sand: K.Mist, wave: K.Ripple };
function anyTrail(st: St, x: number, y: number, dt: number) {
  if (!st.any || Math.random() > dt * 7) return;
  const k = ANY_K[st.any]; if (k === undefined) return;
  bp(k, x + rnd(-10, 10), y + rnd(-10, 10), { vx: rnd(-30, 30), vy: rnd(-40, 10), life: rnd(0.6, 1), s0: rnd(14, 22), s1: 6, rot: Math.random() * TAU, vr: rnd(-3, 3), c: mixc(st.P.b, WHITE, 0.3), a: 0.75, drag: 1 });
}
const nEmit = (rate: number, dt: number) => { const f = rate * dt * PR; return Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); };

// ------------------------------------------------------------------ 配方
interface Recipe {
  /** 弹头 + 拖尾（每帧） */
  proj?(F: FxSys, st: St, pr: any, t: number, dt: number, head: Pt[]): void;
  /** 弹道结束：hit=命中/撞散，fizzle=飞尽 */
  hit?(F: FxSys, st: St, x: number, y: number, s: number, fizzle: boolean, pr?: any): void;
  /** 法术光效初现（ring / strike / cone / beam / chain / aura / flash / warn） */
  spawn?(F: FxSys, st: St, v: any): void;
  /** 法术光效逐帧；返回 true 表示已接管（不再画旧特效） */
  draw?(F: FxSys, st: St, v: any, u: number, t: number, dt: number): boolean | void;
  /** 持续区域逐帧（k：淡入淡出系数）；返回 true 表示已接管 */
  field?(F: FxSys, st: St, f: any, t: number, dt: number, k: number): boolean | void;
}
const REC: Record<string, Recipe> = {};

// —— 弹道通用：弹头图样 + 拖尾
/** 图样弹头：back 给出时先垫一层暗色同形（覆盖混合），白天亮底上也看得清轮廓——兼带水墨勾边的味道 */
function headBake(F: FxSys, k: number, x: number, y: number, w: number, h: number, rot: number, c: RGB, a: number, add = 1, back?: RGB) {
  if (back) { F.bk(k, x, y, w * 1.1, h * 1.1, rot, back, a * 0.55, 0); F.bk(k, x, y, w, h, rot, c, a, Math.min(add, 0.6)); F.bk(k, x, y, w * 0.9, h * 0.9, rot, mixc(c, WHITE, 0.5), a * 0.35, 1); return; }
  F.bk(k, x, y, w, h, rot, c, a, add);
}

// ============ 火
REC.fireOrb = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    ribbon(F, head, 26 * s, P, 0.9);
    const ang = Math.atan2(pr.vy, pr.vx);
    if (extOK()) { F.sprite(C.KFire2, pr.x - Math.cos(ang) * 8 * s, pr.y - Math.sin(ang) * 8 * s, 64 * s, 72 * s, ang + Math.PI / 2, P.b, 0.9); F.sprite(C.KFire1, pr.x - Math.cos(ang) * 22 * s, pr.y - Math.sin(ang) * 22 * s, 40 * s, 80 * s, ang + Math.PI / 2, mixc(P.b, P.c, 0.3), 0.7); }
    F.orb(pr.x, pr.y, 15 * s, P.b);
    for (let i = nEmit(55, dt); i > 0; i--) F.emit({ x: pr.x + rnd(-6, 6) * s, y: pr.y + rnd(-6, 6) * s, vx: -pr.vx * 0.08 + rnd(-30, 30), vy: -pr.vy * 0.08 + rnd(-60, -10), life: rnd(0.25, 0.5), s0: rnd(12, 22) * s, s1: 2, c: mixc(P.b, P.a, Math.random() * 0.4), cell: fireCell(), drag: 2 });
    if (Math.random() < dt * 10) F.smoke(pr.x, pr.y, 1, mixc(P.c, INK, 0.5), 0.18, 4, 22 * s);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) {
    const P = st.P, r = (fz ? 34 : 56) * s;
    F.explode(x, y, r, P.b, { smoke: !fz, shock: !fz });
    decal(K.FireLotus, x, y, r * 0.3, r * 1.4, 0.55, P.b, 0.8, { rot: Math.random() * TAU, vr: 2 });
    for (let i = 0; i < 6; i++) bp(K.FeatherF, x, y, { vx: rnd(-160, 160), vy: rnd(-220, -60), life: rnd(0.4, 0.7), s0: 22, s1: 6, rot: Math.random() * TAU, vr: rnd(-6, 6), c: mixc(P.b, P.a, 0.3), grav: 300 });
  },
};
REC.fireSnake = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    const wav: Pt[] = head.map(([x, y], i) => { const k = i / head.length, o = Math.sin(t * 14 - i * 0.9) * 10 * k; return [x - Math.sin(ang) * o, y + Math.cos(ang) * o]; });
    F.trail(wav, 34 * s, P.c, 0.35, C.Beam, 0, 0.8);
    F.trail(wav, 26 * s, P.b, 0.55, C.Beam, 1, 0.85); F.trail(wav, 9 * s, P.a, 0.85, C.Beam, 1, 0.9);
    for (let i = 2; i < wav.length; i += 3) F.bk(K.FeatherF, wav[i][0], wav[i][1], 26 * s * (i / wav.length), 14 * s, ang + Math.PI + Math.sin(t * 10 + i) * 0.4, P.b, 0.5);
    F.orb(pr.x, pr.y, 14 * s, P.b);
    const ex = pr.x + Math.cos(ang) * 6, ey = pr.y + Math.sin(ang) * 6, nx = -Math.sin(ang) * 6, ny = Math.cos(ang) * 6;
    F.glow(ex + nx, ey + ny, 3.5, WHITE, 1, C.Dot); F.glow(ex - nx, ey - ny, 3.5, WHITE, 1, C.Dot);
    for (let i = nEmit(45, dt); i > 0; i--) { const j = (Math.random() * wav.length) | 0, [x, y] = wav[j]; F.emit({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-70, -20), life: rnd(0.25, 0.5), s0: rnd(10, 20) * s, s1: 2, c: P.b, cell: fireCell() }); }
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 60) * s; F.explode(x, y, r, P.b, { smoke: !fz }); decal(K.Swirl, x, y, r * 0.4, r * 1.3, 0.6, P.b, 0.85, { sq: SQ, vr: 6 }); F.flames(x, y, r * 0.6, P.b, 6); },
};
REC.fireBird = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx), fl = Math.sin(t * 18 + pr.x * 0.05);
    F.trail(head, 18 * s, P.b, 0.4);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (const sd of [-1, 1]) headBake(F, K.FeatherF, pr.x + nx * sd * 26 * s - Math.cos(ang) * 6, pr.y + ny * sd * 26 * s - Math.sin(ang) * 6, 84 * s, (26 + 14 * fl) * s, ang + Math.PI + sd * (1.0 + 0.45 * fl), P.b, 0.95, 1, P.c);
    headBake(F, K.FeatherF, pr.x - Math.cos(ang) * 34 * s, pr.y - Math.sin(ang) * 34 * s, 70 * s, 22 * s, ang + Math.PI + Math.sin(t * 9) * 0.15, mixc(P.b, P.c, 0.2), 0.85, 1, P.c);
    F.orb(pr.x, pr.y, 9 * s, P.b); F.glow(pr.x, pr.y, 36 * s, P.b, 0.3);
    if (Math.random() < dt * 16 * PR) bp(K.FeatherF, pr.x, pr.y, { vx: -pr.vx * 0.1 + rnd(-20, 20), vy: rnd(10, 50), life: 0.6, s0: 20, s1: 8, rot: Math.random() * TAU, vr: rnd(-5, 5), c: mixc(P.b, P.a, 0.3), a: 0.8, drag: 1.5 });
    for (let i = nEmit(25, dt); i > 0; i--) F.emit({ x: pr.x, y: pr.y, vx: -pr.vx * 0.1 + rnd(-20, 20), vy: rnd(-40, 0), life: 0.35, s0: 12 * s, s1: 2, c: P.b, cell: fireCell() });
  },
  hit(F, st, x, y, s, fz) { const P = st.P; burstStd(F, x, y, (fz ? 40 : 64) * s, P, K.FireLotus, 10, K.FeatherF); if (!fz) F.flames(x, y, 30 * s, P.b, 5); },
};
REC.demonFire = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 40 * s, P.c, 0.55, C.Glow, 0, 0.7);
    F.trail(head, 18 * s, P.b, 0.55, C.Beam, 1, 0.8);
    headBake(F, K.GhostFire, pr.x - Math.cos(ang) * 14 * s, pr.y - Math.sin(ang) * 14 * s, 60 * s, 80 * s, ang - Math.PI / 2, P.b, 0.95, 1, P.c);
    F.glow(pr.x, pr.y, 26 * s, P.a, 0.6);
    if (Math.random() < dt * 14) F.smoke(pr.x, pr.y, 1, P.c, 0.45, 6, 30 * s);
    if (Math.random() < dt * 10 * PR) bp(K.GhostFire, pr.x, pr.y, { vx: rnd(-30, 30), vy: rnd(-60, -20), life: 0.6, s0: 18, s1: 6, c: P.b, a: 0.8 });
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 40 : 66) * s; F.flash(x, y, r * 0.4, P.b); F.smoke(x, y, 8, P.c, 0.6, r * 0.4, r); decal2(K.Skull, x, y - 30, r * 0.3, r * 0.9, 0.7, P.b, st.P.c, 0.7); for (let i = 0; i < 8; i++) bp(K.GhostFire, x + rnd(-r, r) * 0.5, y, { vy: rnd(-120, -50), life: rnd(0.5, 0.9), s0: 26, s1: 8, c: P.b }); },
};

// ============ 冰 / 水
REC.iceSpike = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 22 * s, P.b, 0.3, C.Glow, 1, 0.6); F.trail(head, 5 * s, P.a, 0.7);
    F.sprite(C.Shard, pr.x, pr.y, 54 * s, 18 * s, ang, mixc(P.b, WHITE, 0.6), 1, 0.6);
    headBake(F, K.Snow, pr.x - Math.cos(ang) * 10, pr.y - Math.sin(ang) * 10, 40 * s, 40 * s, t * 4, P.b, 0.9, 1, P.c);
    F.glow(pr.x, pr.y, 24 * s, P.b, 0.45);
    if (Math.random() < dt * 14 * PR) bp(K.Snow, pr.x, pr.y, { vx: rnd(-30, 30), vy: rnd(-10, 40), life: rnd(0.5, 0.9), s0: rnd(8, 14), s1: 3, rot: Math.random(), vr: rnd(-3, 3), c: P.a, a: 0.85 });
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 34 : 58) * s; burstStd(F, x, y, r, P, K.Snow, 8, K.Snow); decal(K.Hex, x, y + 10, r * 0.4, r * 1.2, 0.7, P.b, 0.4, { sq: SQ }); for (let i = 0; i < 6; i++) F.emit({ x, y, vx: rnd(-220, 220), vy: rnd(-260, -40), life: rnd(0.4, 0.7), s0: rnd(8, 14), c: mixc(P.b, WHITE, 0.5), cell: C.Shard, rot: Math.random() * TAU, vr: rnd(-8, 8), grav: 700, add: 0.6 }); },
};
REC.iceNeedle = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 3 * s, P.a, 0.9); F.trail(head, 10 * s, P.b, 0.25);
    F.sprite(C.Streak, pr.x, pr.y, 46 * s, 5 * s, ang, WHITE, 1);
    headBake(F, K.Star4, pr.x, pr.y, 26 * s, 26 * s, t * 3, P.a, 0.9);
  },
  hit(F, st, x, y, s) { const P = st.P; decal(K.Star4, x, y, 10 * s, 46 * s, 0.3, P.a, 1); F.sparks(x, y, P.b, 6, 300, 0.3, 2.2); decal(K.Snow, x, y, 8, 28 * s, 0.4, P.b, 0.6); },
};
REC.waterArrow = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    ribbon(F, head, 18 * s, P, 0.7);
    headBake(F, K.Drop, pr.x, pr.y, 58 * s, 36 * s, ang, P.b, 0.95, 1, P.c);
    F.glow(pr.x, pr.y, 22 * s, P.b, 0.35);
    for (let i = nEmit(20, dt); i > 0; i--) F.emit({ x: pr.x + rnd(-8, 8), y: pr.y + rnd(-8, 8), vx: -pr.vx * 0.05, vy: -pr.vy * 0.05 + rnd(-20, 20), life: rnd(0.3, 0.6), s0: rnd(3, 6), s1: 1, c: P.a, cell: C.Dot, add: 0.6 });
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 60) * s; decal(K.Ripple, x, y + 20, r * 0.3, r * 1.4, 0.7, P.b, 0.9, { sq: SQ }); decal(K.WaveCrest, x, y - 10, r * 0.4, r, 0.5, P.b, 0.8); F.flash(x, y, r * 0.35, P.b); for (let i = 0; i < 9; i++) bp(K.Drop, x, y, { vx: rnd(-180, 180), vy: rnd(-300, -100), life: rnd(0.4, 0.7), s0: 14, s1: 6, rot: -Math.PI / 2 + rnd(-0.6, 0.6), c: mixc(P.b, WHITE, 0.3), grav: 800, h: 0.6 }); },
};
REC.waterSpout = {
  proj(F, st, pr, t, dt) {
    const s = (pr.size ?? 1) * st.s, P = st.P, h = 130 * s;
    for (let i = 0; i < 7; i++) { const k = i / 7; F.bk(K.Ripple, pr.x + Math.sin(t * 8 + i) * 8, pr.y + 30 - k * h, (40 + k * 70) * s, (14 + k * 24) * s, t * 3 + i, mixc(P.b, WHITE, k * 0.4), 0.7 - k * 0.3); }
    F.bk(K.WaveCrest, pr.x, pr.y + 30 - h, 80 * s, 50 * s, Math.sin(t * 5) * 0.2, P.a, 0.8);
    F.bk(K.Vortex, pr.x, pr.y + 30, 90 * s, 90 * s, -t * 6, P.b, 0.5, 1, 0.45);
    F.glow(pr.x, pr.y - h * 0.4, 60 * s, P.b, 0.25);
    if (Math.random() < dt * 20 * PR) bp(K.Drop, pr.x + rnd(-30, 30), pr.y - rnd(0, h), { vx: rnd(-120, 120), vy: rnd(-80, 0), life: 0.5, s0: 12, s1: 4, rot: Math.random() * TAU, c: P.a, grav: 500, h: 0.6 });
  },
  hit(F, st, x, y, s) { REC.waterArrow.hit!(F, st, x, y, s * 1.3, false); },
};
REC.moonFrost = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 16 * s, P.b, 0.35); F.trail(head, 4 * s, P.a, 0.8);
    headBake(F, K.MoonDisc, pr.x, pr.y, 46 * s, 46 * s, 0, P.a, 0.85, 1, P.c);
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; F.bk(K.Snow, pr.x + Math.cos(a) * 22 * s, pr.y + Math.sin(a) * 14 * s, 14 * s, 14 * s, t * 3, P.a, 0.85); }
    F.glow(pr.x, pr.y, 34 * s, P.b, 0.35);
    if (Math.random() < dt * 10 * PR) bp(K.Snow, pr.x, pr.y, { vx: rnd(-20, 20), vy: rnd(10, 40), life: 0.8, s0: 10, s1: 4, rot: Math.random(), vr: 2, c: P.a, a: 0.8 });
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 62) * s; decal2(K.MoonDisc, x, y - 20, r * 0.3, r * 0.9, 0.6, P.a, st.P.c, 0.85); decal(K.Hex, x, y + 10, r * 0.5, r * 1.2, 0.8, P.b, 0.4, { sq: SQ }); burstStd(F, x, y, r, P, K.Snow, 8, K.Snow); },
};

// ============ 风 / 土 / 木
REC.windBlade = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 30 * s, P.b, 0.15, C.Glow, 1, 0.5);
    for (let i = 0; i < 2; i++) headBake(F, K.WindArc, pr.x - Math.cos(ang) * i * 18, pr.y - Math.sin(ang) * i * 18, 100 * s * (1 - i * 0.2), 100 * s * (1 - i * 0.2), ang, P.b, 0.95 - i * 0.35, 1, i ? undefined : P.c);
    if (Math.random() < dt * 9 * PR) bp(K.Willow, pr.x, pr.y, { vx: -pr.vx * 0.15 + rnd(-40, 40), vy: -pr.vy * 0.15 + rnd(-40, 40), life: 0.6, s0: 18, s1: 10, rot: Math.random() * TAU, vr: rnd(-10, 10), c: P.b, a: 0.8, drag: 2 });
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 60) * s; decal(K.WindArc, x, y, r * 0.4, r * 1.3, 0.35, P.b, 0.9, { rot: Math.random() * TAU }); for (let i = 0; i < 8; i++) F.emit({ x, y, vx: rnd(-200, 200), vy: rnd(-120, 60), life: 0.35, s0: 30, s1: 10, c: P.b, a: 0.4, cell: C.Wisp, rot: Math.random() * TAU }); F.flash(x, y, r * 0.3, P.b, 0.12); },
};
REC.triCrescent = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    const idx = ((pr._tri ??= Math.floor(Math.random() * 3)) as number), cc = [P.b, WHITE, [1, 0.85, 0.45] as RGB][idx];
    F.trail(head, 12 * s, cc, 0.45);
    headBake(F, K.Crescent, pr.x, pr.y, 96 * s, 96 * s, ang, cc, 0.95, 1, P.c);
    F.glow(pr.x, pr.y, 30 * s, cc, 0.35);
  },
  hit(F, st, x, y, s) { const P = st.P; decal2(K.CrossSlash, x, y, 20 * s, 70 * s, 0.3, mixc(P.b, WHITE, 0.4), st.P.c, 1, { rot: Math.random() }); F.sparks(x, y, P.b, 8, 360, 0.3, 2.6); },
};
REC.whirlwind = {
  proj(F, st, pr, t, dt) {
    const s = (pr.size ?? 1) * st.s, P = st.P, h = 140 * s;
    for (let i = 0; i < 6; i++) { const k = i / 6; F.bk(K.WindArc, pr.x + Math.sin(t * 9 + i) * 8, pr.y + 26 - k * h, (40 + k * 80) * s, (16 + k * 26) * s, t * 10 + i * 1.3, mixc(P.b, WHITE, 0.2), 0.75 - k * 0.3); }
    F.bk(K.Vortex, pr.x, pr.y + 28, 100 * s, 100 * s, -t * 8, P.b, 0.4, 1, 0.45);
    if (Math.random() < dt * 14 * PR) { const a = Math.random() * TAU; bp(K.Willow, pr.x + Math.cos(a) * 40, pr.y - rnd(0, h), { vx: -Math.sin(a) * 200, vy: rnd(-60, 0), life: 0.5, s0: 16, s1: 8, rot: a, vr: 10, c: P.b, a: 0.8 }); }
  },
  hit(F, st, x, y, s) { decal(K.Vortex, x, y, 30 * s, 110 * s, 0.6, st.P.b, 0.6, { sq: SQ, vr: -8 }); REC.windBlade.hit!(F, st, x, y, s, false); },
};
REC.rockShot = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 20 * s, P.c, 0.3, C.Glow, 0, 0.6);
    F.sprite(C.Shard, pr.x, pr.y, 34 * s, 28 * s, t * 9, mixc(P.c, P.b, 0.4), 1, 0);
    F.sprite(C.Shard, pr.x + 3, pr.y - 3, 22 * s, 18 * s, -t * 7, P.b, 0.9, 0);
    F.glow(pr.x, pr.y, 20 * s, P.b, 0.3);
    if (Math.random() < dt * 14) F.smoke(pr.x, pr.y, 1, mixc(P.b, P.c, 0.5), 0.3, 4, 20 * s);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 40 : 64) * s; F.explode(x, y, r * 0.7, P.b, { debris: true, smoke: true, shock: !fz }); decal(K.Crack, x, y + 14, r * 0.5, r, 1.2, INK, 0.5, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 8 }); for (let i = 0; i < 4; i++) bp(K.Spike, x + rnd(-r, r) * 0.5, y + 10, { vy: rnd(-40, -10), life: 0.5, s0: r * 0.4, s1: r * 0.2, c: mixc(P.b, P.c, 0.3), add: 0, h: 1.4 }); },
};
REC.vineBind = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    const wav: Pt[] = head.map(([x, y], i) => [x, y + Math.sin(i * 1.3 + t * 9) * 7]);
    F.trail(wav, 11 * s, P.c, 0.95, C.Beam, 0, 0.3); F.trail(wav, 4 * s, P.b, 0.95);
    for (let i = 1; i < wav.length - 1; i += 2) { const a = Math.atan2(wav[i + 1][1] - wav[i][1], wav[i + 1][0] - wav[i][0]) + (i % 4 ? 0.9 : -0.9); F.bk(K.Willow, wav[i][0], wav[i][1], 22 * s, 12 * s, a, P.b, 0.9, 0); }
    headBake(F, K.Blossom, pr.x, pr.y, 30 * s, 30 * s, t * 2, P.b, 0.9, 1, P.c);
    F.glow(pr.x, pr.y, 18 * s, P.b, 0.4);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s) { const P = st.P; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; bp(K.Willow, x + Math.cos(a) * 30, y + Math.sin(a) * 14 + 20, { vy: -30, life: 0.8, s0: 30, s1: 26, rot: -Math.PI / 2 + Math.cos(a) * 0.5, c: P.b, add: 0, h: 0.5 }); } decal(K.Blossom, x, y, 10, 50 * s, 0.6, mixc(P.b, WHITE, 0.5), 0.8); F.flash(x, y, 20, P.b); },
};
REC.leafBlade = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 8 * s, P.b, 0.45); F.trail(head, 22 * s, P.b, 0.14, C.Glow);
    headBake(F, K.Willow, pr.x, pr.y, 76 * s, 36 * s, ang + Math.sin(t * 18 + pr.x) * 0.25, P.b, 1, 1, P.c);
    F.glow(pr.x, pr.y, 20 * s, P.b, 0.35);
    if (Math.random() < dt * 8 * PR) bp(K.Willow, pr.x, pr.y, { vx: rnd(-30, 30), vy: rnd(10, 40), life: 0.7, s0: 16, s1: 10, rot: Math.random() * TAU, vr: rnd(-4, 4), c: P.b, a: 0.7 });
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { burstStd(F, x, y, (fz ? 34 : 54) * s, st.P, K.Blossom, 10, K.Willow); },
};

// ============ 剑 / 金
REC.flyingSword = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 22 * s, P.b, 0.16, C.Glow, 1, 0.7); F.trail(head, 3 * s, P.a, 0.6);
    headBake(F, K.Sword, pr.x - Math.cos(ang) * 34 * s, pr.y - Math.sin(ang) * 34 * s, 146 * s, 230 * s, ang, P.b, 1, 1, P.c);
    F.glow(pr.x, pr.y, 18 * s, P.b, 0.25);
    if (Math.random() < dt * 6) F.glint(pr.x + Math.cos(ang) * 24 * s, pr.y + Math.sin(ang) * 24 * s, 20 * s, P.a, 0.8, 0.14);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P; decal2(K.CrossSlash, x, y, 14 * s, (fz ? 46 : 74) * s, 0.28, mixc(P.b, WHITE, 0.5), st.P.c, 1, { rot: Math.random() * 0.6 }); decal(K.Crescent, x, y, 20 * s, 80 * s, 0.3, P.b, 0.6, { rot: Math.random() * TAU }); F.sparks(x, y, P.a, 10, 420, 0.3, 2.4); F.glint(x, y, 34 * s, P.a, 0.9, 0.2); },
};
REC.goldBlade = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 4 * s, P.a, 0.85); F.trail(head, 16 * s, P.b, 0.3);
    headBake(F, K.Crescent, pr.x, pr.y, 72 * s, 72 * s, ang + Math.sin(t * 30 + pr.x) * 0.1, P.b, 1, 1, P.c);
    headBake(F, K.Star4, pr.x + Math.cos(ang) * 14 * s, pr.y + Math.sin(ang) * 14 * s, 30 * s, 30 * s, t * 4, P.a, 0.7);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s) { const P = st.P; decal2(K.CrossSlash, x, y, 12 * s, 56 * s, 0.25, mixc(P.b, WHITE, 0.5), st.P.c, 1, { rot: Math.random() * 0.8 }); F.sparks(x, y, P.b, 9, 380, 0.3, 2.4); },
};
REC.thunderSword = {
  proj(F, st, pr, t, dt, head) {
    REC.flyingSword.proj!(F, st, pr, t, dt, head);
    const s = (pr.size ?? 1) * st.s, ang = Math.atan2(pr.vy, pr.vx);
    elecLine(F, pr.x - Math.cos(ang) * 70 * s, pr.y - Math.sin(ang) * 70 * s, pr.x + Math.cos(ang) * 30, pr.y + Math.sin(ang) * 30, 14 * s, st.P.b, 0.8, t, pr.x | 0);
    if (Math.random() < dt * 16) { const a = Math.random() * TAU; F.bolt(pr.x, pr.y, pr.x + Math.cos(a) * 46, pr.y + Math.sin(a) * 46, Math.random() * 1e6, 10, 1.4, st.P.b, 0.9, 4, false); }
  },
  hit(F, st, x, y, s) { const P = st.P; decal(K.ElecRing0, x, y + 10, 20 * s, 90 * s, 0.4, P.b, 1, { sq: SQ, vr: 4 }); F.bolt(x + 10, y - 380, x, y, Math.random() * 1e6, 40, 3, P.b, 0.9, 10); F.explode(x, y, 40 * s, P.b, { smoke: false }); REC.flyingSword.hit!(F, st, x, y, s, false); },
};
function dragonBody(F: FxSys, st: St, pr: any, t: number, head: Pt[], k: number, w: number) {
  const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
  const wav: Pt[] = head.map(([x, y], i) => { const q = i / head.length, o = Math.sin(t * 9 - i * 0.7) * 14 * q; return [x - Math.sin(ang) * o, y + Math.cos(ang) * o]; });
  F.trail(wav, w * 1.6 * s, P.b, 0.35, C.Glow, 1, 0.8); F.trail(wav, w * 0.6 * s, mixc(P.b, WHITE, 0.5), 0.8, C.Beam, 1, 0.8);
  for (let i = 1; i < wav.length - 1; i += 2) { const a = Math.atan2(wav[i + 1][1] - wav[i - 1][1], wav[i + 1][0] - wav[i - 1][0]), q = i / wav.length; F.bk(k, wav[i][0], wav[i][1], 50 * s * (0.4 + q), 50 * s * (0.4 + q), k === K.Snow ? t * 2 + i : a, mixc(P.b, WHITE, 0.4), 0.85); }
  F.orb(pr.x, pr.y, 20 * s, P.b);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  for (const sd of [-1, 1]) F.sprite(C.Thorn, pr.x - Math.cos(ang) * 12 + nx * sd * 10, pr.y - Math.sin(ang) * 12 + ny * sd * 10 - 14, 10, 36, ang - Math.PI / 2 - Math.PI + sd * 0.5, mixc(P.b, WHITE, 0.6), 0.9);
  return wav;
}
REC.swordDragon = {
  proj(F, st, pr, t, dt, head) { dragonBody(F, st, pr, t, head, K.Sword, 30); if (Math.random() < dt * 8) F.glint(pr.x, pr.y, 40, st.P.a, 0.8, 0.2); },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 60 : 100) * s; for (let i = 0; i < 3; i++) decal(K.Crescent, x, y, r * 0.3, r, 0.4 + i * 0.1, P.b, 0.8, { rot: i * 2.1, vr: 4 }); decal2(K.CrossSlash, x, y, r * 0.2, r * 0.9, 0.3, P.a, st.P.c, 1); F.shock(x, y, r * 2, 12, 0.5); F.sparks(x, y, P.a, 18, 520, 0.4, 3); },
};
REC.iceDragon = {
  proj(F, st, pr, t, dt, head) { dragonBody(F, st, pr, t, head, K.Snow, 34); headBake(F, K.IceCluster, pr.x, pr.y - 6, 50, 50, Math.atan2(pr.vy, pr.vx) + Math.PI / 2, st.P.a, 0.8); if (Math.random() < dt * 20 * PR) bp(K.Snow, pr.x + rnd(-20, 20), pr.y + rnd(-20, 20), { vy: rnd(10, 60), vx: rnd(-30, 30), life: 0.9, s0: 12, s1: 4, rot: Math.random(), vr: 2, c: st.P.a }); },
  hit(F, st, x, y, s) { REC.frostSeal.spawn!(F, st, { x, y, r: 90 * s, kind: 'strike' }); },
};

// ============ 符 / 识 / 魔
REC.talismanFire = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s;
    if (pr.life < 0.16) { F.bk(K.Fu, pr.x, pr.y, 22 * s, 46 * s, t * 14, [1, 0.9, 0.55], 0.95, 0); F.glow(pr.x, pr.y, 26 * s, st.P.b, 0.4); return; }
    if (!pr._ign) { pr._ign = 1; F.flash(pr.x, pr.y, 26 * s, st.P.b, 0.16); decal2(K.Glyph, pr.x, pr.y, 10, 40 * s, 0.35, st.P.b, st.P.c, 0.9); }
    REC.fireOrb.proj!(F, st, pr, t, dt, head);
  },
  hit(F, st, x, y, s, fz) { REC.fireOrb.hit!(F, st, x, y, s, fz); decal2(K.Glyph, x, y, 20, 70 * s, 0.5, st.P.b, st.P.c, 0.8, { sq: SQ }); },
};
REC.talismanSeal = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 14 * s, P.b, 0.4);
    F.glow(pr.x, pr.y, 34 * s, P.b, 0.45);
    F.bk(K.Fu, pr.x, pr.y, 26 * s, 54 * s, t * 9, [1, 0.92, 0.6], 0.95, 0);
    F.bk(K.Fu, pr.x, pr.y, 30 * s, 60 * s, t * 9, P.b, 0.35);
  },
  hit(F, st, x, y, s) { const P = st.P; decal2(K.Glyph, x, y - 30, 20, 80 * s, 0.6, P.b, st.P.c, 1); decal(K.RuneRing, x, y + 10, 30, 110 * s, 0.8, P.b, 0.8, { sq: SQ, vr: 1.5 }); F.flash(x, y, 30, P.b); },
};
REC.mindSpike = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 26 * s, P.b, 0.25, C.Glow);
    headBake(F, K.Eye, pr.x, pr.y, 84 * s, 84 * s, 0, P.b, 0.95, 1, P.c);
    if (Math.random() < dt * 20) bp(K.Ripple, pr.x, pr.y, { life: 0.5, s0: 20 * s, s1: 70 * s, c: P.b, a: 0.5, rot: ang });
  },
  hit(F, st, x, y, s) { const P = st.P; decal2(K.Eye, x, y - 20, 20, 70 * s, 0.5, P.b, st.P.c, 0.9); decal(K.Ripple, x, y, 20, 110 * s, 0.6, P.b, 0.7); decal(K.Flower12, x, y, 20, 90 * s, 0.5, P.a, 0.5, { vr: 2 }); },
};
REC.ghostFire = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 34 * s, P.c, 0.5, C.Glow, 0, 0.7); F.trail(head, 12 * s, P.b, 0.45);
    headBake(F, K.GhostFire, pr.x - Math.cos(ang) * 14, pr.y - Math.sin(ang) * 14, 58 * s, 76 * s, ang - Math.PI / 2, P.b, 0.95, 1, P.c);
    headBake(F, K.Skull, pr.x, pr.y, 34 * s, 34 * s, Math.sin(t * 6) * 0.2, P.b, 0.6, 1, P.c);
    if (Math.random() < dt * 10 * PR) bp(K.GhostFire, pr.x, pr.y, { vx: rnd(-20, 20), vy: rnd(-60, -20), life: 0.7, s0: 16, s1: 6, c: P.b, a: 0.8 });
    if (Math.random() < dt * 8) F.smoke(pr.x, pr.y, 1, P.c, 0.35, 6, 26 * s);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 58) * s; decal2(K.Skull, x, y - 20, r * 0.3, r, 0.7, P.b, st.P.c, 0.85); F.flash(x, y, r * 0.35, P.b); for (let i = 0; i < 7; i++) bp(K.GhostFire, x + rnd(-r, r) * 0.5, y, { vy: rnd(-120, -40), vx: rnd(-30, 30), life: rnd(0.5, 0.9), s0: 22, s1: 8, c: P.b }); F.smoke(x, y, 4, P.c, 0.4, r * 0.3, r * 0.8); },
};
REC.ghostClaw = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 30 * s, P.c, 0.5, C.Glow, 0, 0.7);
    F.sprite(C.Fang, pr.x, pr.y, 56 * s, 56 * s, ang + Math.PI / 2, mixc(P.b, WHITE, 0.2), 0.9);
    F.glow(pr.x, pr.y, 26 * s, P.b, 0.4);
    if (Math.random() < dt * 10) F.emit({ x: pr.x, y: pr.y, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1 - 20, life: 0.6, s0: 30, s1: 60, c: P.c, a: 0.4, add: 0, cell: extOK() ? C.KWisp2 : C.Smoke });
  },
  hit(F, st, x, y, s) { const P = st.P; F.emit({ x, y, life: 0.35, s0: 50 * s, s1: 90 * s, c: P.b, a: 0.9, cell: C.Fang, rot: Math.random() - 0.5 }); decal2(K.Skull, x, y - 20, 16, 54 * s, 0.6, P.b, st.P.c, 0.7); F.sparks(x, y, P.b, 6, 260, 0.3, 2); },
};
REC.bloodShot = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 34 * s, P.c, 0.45, C.Glow, 0, 0.7); F.trail(head, 14 * s, P.b, 0.6);
    F.orb(pr.x, pr.y, 12 * s, P.b);
    if (Math.random() < dt * 14 * PR) bp(K.Drop, pr.x, pr.y, { vx: rnd(-40, 40), vy: rnd(-20, 30), life: 0.5, s0: 12, s1: 6, rot: Math.PI / 2, c: P.b, grav: 500, h: 0.6, add: 0.5 });
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 36 : 60) * s; decal(K.InkRing, x, y + 10, r * 0.3, r * 1.2, 0.7, P.c, 0.8, { add: 0, sq: SQ }); inkSplat(x, y + 12, r, 0.5, P.c); F.flash(x, y, r * 0.4, P.b); F.sparks(x, y, P.b, 10, 320, 0.4, 3); },
};
REC.palmShot = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 34 * s, P.b, 0.15, C.Glow, 1, 0.5);
    headBake(F, K.Palm, pr.x, pr.y, 76 * s, 76 * s, ang + Math.PI / 2, P.b, 0.85, 1, P.c);
    if (Math.random() < dt * 12) bp(K.Ripple, pr.x, pr.y, { life: 0.35, s0: 30 * s, s1: 80 * s, c: P.b, a: 0.45, sq: 0.5, rot: ang });
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 40 : 70) * s; decal2(K.Palm, x, y - 10, r * 0.4, r * 1.2, 0.45, mixc(P.b, WHITE, 0.3), st.P.c, 0.85); decal(K.Ripple, x, y + 16, r * 0.3, r * 1.6, 0.5, P.b, 0.8, { sq: SQ }); F.shock(x, y, r * 2.4, 10, 0.4); F.flash(x, y, r * 0.3, P.b); },
};
REC.starShot = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 5 * s, P.a, 0.8); F.trail(head, 20 * s, P.b, 0.2, C.Glow);
    headBake(F, K.Star4, pr.x, pr.y, 66 * s, 66 * s, t * 2.5, P.b, 1); headBake(F, K.Star4, pr.x, pr.y, 30 * s, 30 * s, t * 2.5, P.a, 1);
    F.glow(pr.x, pr.y, 26 * s, P.b, 0.4);
    if (Math.random() < dt * 18 * PR) bp(K.Star4, pr.x + rnd(-8, 8), pr.y + rnd(-8, 8), { vx: rnd(-20, 20), vy: rnd(-20, 20), life: rnd(0.4, 0.8), s0: rnd(10, 18), s1: 2, c: P.a, a: 0.9 });
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 40 : 66) * s; decal(K.StarField, x, y, r * 0.4, r * 1.4, 0.7, P.a, 0.9, { vr: 0.8 }); decal(K.Star4, x, y, r * 0.3, r * 1.2, 0.35, WHITE, 1); F.flash(x, y, r * 0.3, P.b); },
};
REC.petalMist = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P;
    F.trail(head, 46 * s, P.b, 0.16, C.Glow, 1, 0.6);
    headBake(F, K.Mist, pr.x, pr.y, 80 * s, 80 * s, t * 0.8, P.b, 0.45);
    headBake(F, K.Blossom, pr.x, pr.y, 38 * s, 38 * s, t * 3, P.b, 0.95, 1, P.c);
    if (Math.random() < dt * 16 * PR) bp(K.PetalH, pr.x + rnd(-14, 14), pr.y + rnd(-14, 14), { vx: rnd(-30, 30), vy: rnd(10, 50), life: rnd(0.7, 1.1), s0: rnd(12, 18), s1: 8, rot: Math.random() * TAU, vr: rnd(-4, 4), c: mixc(P.b, WHITE, 0.3), a: 0.9 });
  },
  hit(F, st, x, y, s, fz) { const P = st.P, r = (fz ? 46 : 74) * s; decal(K.Mist, x, y - 20, r * 0.5, r * 1.5, 1.1, P.b, 0.5, { vr: 0.5 }); for (let i = 0; i < 12; i++) bp(K.PetalH, x, y - 20, { vx: rnd(-160, 160), vy: rnd(-160, 40), life: rnd(0.8, 1.3), s0: 16, s1: 8, rot: Math.random() * TAU, vr: rnd(-5, 5), c: mixc(P.b, WHITE, 0.3), drag: 2.5, grav: 40 }); },
};
REC.bugShot = {
  proj(F, st, pr, t, dt) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    for (let i = 0; i < 5; i++) { const a = t * 9 + i * 1.3, r = 14 + 6 * Math.sin(t * 7 + i); headBake(F, K.Bug, pr.x + Math.cos(a) * r, pr.y + Math.sin(a * 1.3) * r * 0.7, 22 * s, 22 * s, ang + Math.sin(t * 20 + i) * 0.5, P.b, 0.95, 1, P.c); }
    F.glow(pr.x, pr.y, 30 * s, P.b, 0.25);
  },
  hit(F, st, x, y, s) { const P = st.P; for (let i = 0; i < 9; i++) { const a = Math.random() * TAU; bp(K.Bug, x, y, { vx: Math.cos(a) * 160, vy: Math.sin(a) * 100, life: 0.6, s0: 16, s1: 12, rot: a, vr: rnd(-6, 6), c: P.b, drag: 2 }); } F.emit({ x, y, life: 0.9, s0: 40, s1: 90, c: P.b, a: 0.35, add: 0.4, cell: extOK() ? C.KWisp2 : C.Smoke }); },
};
REC.soundWave = {
  proj(F, st, pr, t, dt) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx), pu = (t * 3 + pr.x * 0.002) % 1;
    headBake(F, K.SoundArc, pr.x, pr.y, (64 + 44 * pu) * s, (64 + 44 * pu) * s, ang, P.b, 0.95 - pu * 0.4, 1, P.c);
    F.glow(pr.x, pr.y, 18 * s, P.a, 0.4);
  },
  hit(F, st, x, y, s) { decal(K.Ripple, x, y, 20, 90 * s, 0.5, st.P.b, 0.8); decal(K.SoundArc, x, y, 20, 80 * s, 0.4, st.P.a, 0.7, { rot: Math.random() * TAU }); },
};
REC.thunderBolt = {
  proj(F, st, pr, t, dt, head) {
    const s = (pr.size ?? 1) * st.s, P = st.P, ang = Math.atan2(pr.vy, pr.vx);
    F.trail(head, 16 * s, P.b, 0.45);
    F.orb(pr.x, pr.y, 10 * s, P.b);
    elecLine(F, pr.x - Math.cos(ang) * 60, pr.y - Math.sin(ang) * 60, pr.x, pr.y, 14 * s, P.b, 0.85, t, pr.x | 0);
    if (Math.random() < dt * 8) F.crackle(pr.x, pr.y, 40 * s, P.b, 0.8, 1);
    anyTrail(st, pr.x, pr.y, dt);
  },
  hit(F, st, x, y, s) { decal(K.ElecRing1, x, y + 10, 20 * s, 80 * s, 0.4, st.P.b, 1, { sq: SQ, vr: -4 }); F.flash(x, y, 30 * s, st.P.b); F.crackle(x, y, 60 * s, st.P.b, 0.9, 2); },
};
REC.goldThunderShot = { proj: REC.thunderBolt.proj, hit(F, st, x, y, s) { REC.thunderBolt.hit!(F, st, x, y, s, false); F.bolt(x + 10, y - 300, x, y, Math.random() * 1e6, 34, 2.4, st.P.b, 0.85, 9); } };

// ------------------------------------------------------------------ 天降 / 落点（strike / warn）
/** 预警圈期间：空中酝酿（劫云 / 坠星 / 悬符 / 山影） */
function warnSky(F: FxSys, st: St, v: any, u: number, t: number, kind: 'cloud' | 'meteor' | 'sun' | 'fu' | 'mountain' | 'palm') {
  if (v.t < 0) return;
  const P = st.P, x = v.x, y = v.y, r = v.r ?? 80;
  if (kind === 'cloud') { F.bk(K.Vortex, x, y - 520, r * 3 * (0.6 + 0.4 * u), r * 1.3, t * 2, mixc(P.c, INK, 0.5), 0.55 * u, 0); F.bk(K.Mist, x, y - 520, r * 3.4, r * 1.6, t * 0.3, P.c, 0.45 * u, 0); if (Math.random() < 0.2) F.glow(x + rnd(-r, r), y - 520, r, P.b, 0.4 * u); }
  else if (kind === 'meteor') { const h = 620 * (1 - u), xx = x + h * 0.45, yy = y - h; F.trail([[xx + 140, yy - 300], [xx, yy]], r * 0.5, P.b, 0.6 * u, C.Beam, 1, 1); F.orb(xx, yy, r * 0.25, P.b); F.bk(K.FireLotus, xx, yy, r * 0.8, r * 0.8, t * 6, P.b, 0.6); for (let i = nEmit(50, 0.016); i > 0; i--) F.emit({ x: xx, y: yy, vx: rnd(60, 160), vy: rnd(-260, -120), life: 0.4, s0: r * 0.25, s1: 4, c: P.b, cell: fireCell() }); }
  else if (kind === 'sun') { const R = r * (0.6 + 1.0 * u); F.bk(K.Sun, x, y - 360 + 200 * u, R * 1.6, R * 1.6, t * 0.3, P.b, 0.95 * Math.min(1, u * 2)); F.bk(K.Aureole, x, y - 360 + 200 * u, R * 3, R * 3, -t * 0.2, P.a, 0.4 * u); F.glow(x, y, r * 1.4, P.b, 0.25 * u); }
  else if (kind === 'fu') { F.bk(K.Fu, x, y - 260 + Math.sin(t * 4) * 8, 40, 84, Math.sin(t * 3) * 0.2, [1, 0.92, 0.6], 0.95, 0); F.glow(x, y - 260, 50, P.b, 0.5 * u); F.bk(K.Glyph, x, y - 260, 110 * u, 110 * u, t, P.b, 0.6 * u); }
  else if (kind === 'mountain') { const s = 0.3 + 0.7 * u; F.bk(K.Mountain, x, y - 380 * (1 - u) - r * 0.6 * s, r * 2.4 * s, r * 1.6 * s, 0, mixc(P.b, P.c, 0.3), 0.85 * u, 0); F.bk(K.Mountain, x, y - 380 * (1 - u) - r * 0.6 * s, r * 2.5 * s, r * 1.7 * s, 0, P.b, 0.35 * u); F.ground(C.Disc, x, y, r * u, 0, INK, 0.25 * u, 0, 0.5); }
  else if (kind === 'palm') { const s = 0.4 + 0.6 * u, h = 420 * (1 - u); const cc: RGB = [[1, 0.5, 0.4], [1, 0.85, 0.4], [0.5, 0.9, 0.5], [0.5, 0.7, 1], [0.95, 0.95, 1]][Math.floor(t * 6) % 5] as RGB; F.bk(K.Palm, x, y - h - r * 0.8 * s, r * 2.4 * s, r * 2.4 * s, 0, mixc(P.b, cc, 0.4), 0.85 * u); F.ground(C.Disc, x, y, r * u, 0, INK, 0.2 * u, 0, 0.5); }
}
REC.fireBurst = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; const P = st.P, r = v.r; F.explode(v.x, v.y, r, P.b, { debris: true }); F.flames(v.x, v.y, r * 0.8, P.b, 12); decal(K.FireLotus, v.x, v.y, r * 0.4, r * 1.5, 0.9, P.b, 0.9, { sq: SQ, vr: 1.5 }); decal(K.FireLotus, v.x, v.y - r * 0.4, r * 0.2, r, 0.5, P.a, 0.8, { vr: -2 }); inkSplat(v.x, v.y + 6, r, 0.4, [0.18, 0.06, 0.02]); },
  draw(F, st, v, u, t) { if (v.kind === 'warn') { F.ground(C.FireRing, v.x, v.y, v.r * (0.5 + 0.5 * u), t * 2, st.P.b, 0.5, 1, 0.5); return false; } if (v.kind !== 'strike') return false; F.ground(C.FireRing, v.x, v.y, v.r * (0.8 + u * 0.4), t, st.P.b, 0.8 * (1 - u), 1, 0.5); F.glow(v.x, v.y - 40, v.r * 1.3, st.P.b, 0.5 * (1 - u)); return true; },
};
REC.meteor = {
  spawn(F, st, v) { if (v.kind === 'strike') { REC.fireBurst.spawn!(F, st, v); F.shock(v.x, v.y, v.r * 2.4, 14, 0.5); } },
  draw(F, st, v, u, t) { if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'meteor'); return false; } return REC.fireBurst.draw!(F, st, v, u, t, 0); },
};
REC.sunFire = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; const P = st.P, r = v.r; F.explode(v.x, v.y, r * 1.2, P.b, { debris: true }); F.flames(v.x, v.y, r, P.b, 16); decal(K.Sun, v.x, v.y - r * 0.5, r * 0.5, r * 1.8, 0.6, P.a, 0.9); decal(K.Aureole, v.x, v.y - r * 0.5, r, r * 3, 0.7, P.b, 0.6); decal(K.FireLotus, v.x, v.y, r * 0.5, r * 1.6, 1, P.b, 0.85, { sq: SQ, vr: 1 }); F.shock(v.x, v.y, r * 3, 18, 0.6); },
  draw(F, st, v, u, t) { if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'sun'); return false; } if (v.kind !== 'strike') return false; F.beam(v.x, v.y, v.x, v.y - 700, v.r * 0.9 * (1 - u), st.P.b, 0.5 * (1 - u)); return REC.fireBurst.draw!(F, st, v, u, t, 0); },
};
REC.frostSeal = {
  spawn(F, st, v) {
    if (v.kind !== 'strike') return; const P = st.P, r = v.r;
    F.flash(v.x, v.y - 20, r * 0.5, P.b, 0.2);
    decal(K.Hex, v.x, v.y, r * 0.5, r * 1.15, 1.4, P.b, 0.5, { sq: SQ, ease: 6 });
    decal(K.Snow, v.x, v.y, r * 0.3, r * 1.2, 1.2, P.a, 0.8, { sq: SQ, vr: 0.6, ease: 5 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + Math.random() * 0.4, d = r * rnd(0.2, 0.7); bp(K.IceCluster, v.x + Math.cos(a) * d, v.y + Math.sin(a) * d * 0.5 - r * 0.3, { life: 1.3, s0: r * 0.35, s1: r * 0.75, c: mixc(P.b, WHITE, 0.3), a: 0.95, add: 0.6, vy: -4 }); }
    for (let i = 0; i < 10; i++) bp(K.Snow, v.x + rnd(-r, r) * 0.6, v.y - rnd(0, r), { vy: rnd(-40, -10), vx: rnd(-20, 20), life: rnd(0.8, 1.4), s0: rnd(10, 18), s1: 4, rot: Math.random(), vr: 2, c: P.a });
    F.emit({ x: v.x, y: v.y - 20, life: 1.1, s0: r, s1: r * 2, c: P.b, a: 0.3, add: 0.4, cell: extOK() ? C.KSmoke1 : C.Smoke });
  },
  draw(F, st, v, u) { if (v.kind !== 'strike') return false; F.glow(v.x, v.y - 20, v.r * 1.2, st.P.b, 0.4 * (1 - u)); return true; },
};
REC.thunderStrike = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; const P = st.P, r = v.r; F.explode(v.x, v.y, r * 0.5, P.b, { smoke: false }); decal(K.ElecRing0, v.x, v.y, r * 0.4, r * 1.3, 0.5, mixc(P.b, WHITE, 0.3), 1, { sq: SQ, vr: 3 }); decal(K.ThunderSeal, v.x, v.y, r * 0.5, r * 1.1, 0.7, P.b, 0.7, { sq: SQ, vr: -1 }); decal(K.Crack, v.x, v.y, r * 0.5, r * 0.9, 1.5, INK, 0.5, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 8 }); F.crackle(v.x, v.y - 20, r, P.b, 0.95, 3); },
  draw(F, st, v, u, t) {
    if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'cloud'); return false; }
    if (v.kind !== 'strike') return false;
    const P = st.P, fl = u < 0.3 ? 1 : (Math.floor(v.t * 30) % 2 ? 0.4 : 0.9) * (1 - u);
    F.bk(K.ForkV, v.x + 10, v.y - 330, Math.max(160, v.r * 1.6), 720, 0, mixc(P.b, WHITE, 0.4), fl);
    F.bolt(v.x + 40, v.y - 720, v.x, v.y, v.seed + Math.floor(v.t * 24) * 13, 70, 6 * (1 - u * 0.5), P.b, fl, 14);
    F.glow(v.x, v.y, v.r * 1.1, P.b, 0.35 * (1 - u));
    return true;
  },
};
REC.heavenStrike = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; REC.thunderStrike.spawn!(F, st, v); const r = v.r * st.s; decal(K.Pillar, v.x, v.y - 340, r * 0.6, r * 1.4, 0.45, mixc(st.P.b, WHITE, 0.4), 0.9, { h: 4.2 }); F.shock(v.x, v.y, r * 2.6, 16, 0.55); F.rays(v.x, v.y - 40, r * 2, st.P.b, 0.4, 0.35); },
  draw(F, st, v, u, t, dt) {
    if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'cloud'); if (v.t > 0) F.ground(C.Rune, v.x, v.y, v.r, t, st.P.b, 0.4 * u, 1, 0.55); return false; }
    if (v.kind !== 'strike') return false;
    REC.thunderStrike.draw!(F, st, v, u, t, dt);
    const fl = 1 - u; F.bk(K.ForkV, v.x - 30, v.y - 340, Math.max(140, v.r * 1.3), 700, 0, st.P.a, fl * 0.7);
    F.beam(v.x, v.y, v.x, v.y - 800, v.r * 0.7 * fl, st.P.b, 0.35 * fl);
    return true;
  },
};
REC.talismanThunder = {
  spawn: REC.thunderStrike.spawn,
  draw(F, st, v, u, t, dt) { if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'fu'); return false; } if (v.kind === 'strike' && v.t < 0.05) decal(K.Fu, v.x, v.y - 260, 30, 60, 0.3, st.P.b, 0.9); return REC.thunderStrike.draw!(F, st, v, u, t, dt); },
};
REC.mountainCrush = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; const P = st.P, r = v.r; F.explode(v.x, v.y, r * 0.8, P.b, { debris: true, smoke: true }); decal(K.Mountain, v.x, v.y - r * 0.5, r * 1.1, r * 1.25, 0.9, mixc(P.b, P.c, 0.3), 0.9, { add: 0, ease: 8, h: 0.7 }); decal(K.InkRing, v.x, v.y, r * 0.5, r * 2, 0.9, P.c, 0.7, { add: 0, sq: SQ }); decal(K.Crack, v.x, v.y, r * 0.6, r * 1.2, 2, INK, 0.6, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 8 }); F.shock(v.x, v.y, r * 3, 22, 0.7); F.smoke(v.x, v.y - 10, 12, mixc(P.b, P.c, 0.5), 0.45, r * 0.6, r); },
  draw(F, st, v, u, t) { if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'mountain'); return false; } return v.kind === 'strike'; },
};
REC.giantPalm = {
  spawn(F, st, v) { if (v.kind !== 'strike') return; const P = st.P, r = v.r; decal2(K.Palm, v.x, v.y, r * 0.8, r * 1.3, 1.2, mixc(P.b, WHITE, 0.2), st.P.c, 0.9, { sq: SQ, ease: 8 }); const cs: RGB[] = [[1, 0.45, 0.4], [1, 0.85, 0.4], [0.5, 0.9, 0.5], [0.5, 0.7, 1], [0.95, 0.95, 1]]; cs.forEach((c, i) => F.shockRing(v.x, v.y, r * (1.1 + i * 0.25), c, 0.5 + i * 0.08, 0.55, 0.6)); F.shock(v.x, v.y, r * 2.6, 18, 0.6); F.explode(v.x, v.y, r * 0.6, P.b, { debris: true }); },
  draw(F, st, v, u, t) { if (v.kind === 'warn') { warnSky(F, st, v, u, t, 'palm'); return false; } return v.kind === 'strike'; },
};

// ------------------------------------------------------------------ 以自身为中心（nova → ring）
REC.thunderNova = {
  spawn(F, st, v) { if (v.kind === 'ring') { const P = st.P, r = v.r; decal2(K.Palm, v.x, v.y - 60, 20, 80, 0.35, P.a, st.P.c, 0.9); decal(K.ElecRing0, v.x, v.y, r * 0.3, r * 1.1, 0.5, P.b, 1, { sq: SQ, vr: 4 }); decal(K.ElecRing1, v.x, v.y, r * 0.2, r * 0.9, 0.45, P.a, 0.8, { sq: SQ, vr: -5 }); decal(K.ThunderSeal, v.x, v.y, r * 0.4, r, 0.6, P.b, 0.6, { sq: SQ }); F.shock(v.x, v.y, r * 1.6, 12, 0.5); } },
  draw(F, st, v, u, t) { if (v.kind === 'chain') { elecLine(F, v.x, v.y, v.x2, v.y2, 12, st.P.b, 1 - u, t, v.seed | 0); return true; } return v.kind === 'ring'; },
};
REC.sandNova = {
  spawn(F, st, v) { if (v.kind !== 'ring') return; const P = st.P, r = v.r; decal(K.InkRing, v.x, v.y, r * 0.2, r * 1.2, 0.9, P.b, 0.8, { add: 0, sq: SQ }); decal(K.InkRing, v.x, v.y, r * 0.1, r * 0.9, 1.1, P.c, 0.6, { add: 0, sq: SQ, rot: 1 }); for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, sp = rnd(200, 500); F.emit({ x: v.x, y: v.y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, life: rnd(0.6, 1), s0: rnd(30, 60), s1: 120, c: mixc(P.b, P.c, 0.3), a: 0.45, add: 0, drag: 2.5, cell: smokeCell(), rot: Math.random() * TAU }); } F.shock(v.x, v.y, r * 1.5, 14, 0.6); },
  draw(F, st, v) { return v.kind === 'ring'; },
};
REC.roarNova = {
  spawn(F, st, v) { if (v.kind !== 'ring') return; const P = st.P, r = v.r; for (let i = 0; i < 3; i++) decal(K.Ripple, v.x, v.y - 50, r * 0.2, r * (1 + i * 0.3), 0.5 + i * 0.15, P.b, 0.8 - i * 0.2); decal(K.Aureole, v.x, v.y - 60, r * 0.3, r * 1.2, 0.6, P.a, 0.6); decal(K.SoundArc, v.x, v.y - 50, r * 0.2, r, 0.5, P.b, 0.8); F.shock(v.x, v.y, r * 1.8, 16, 0.5); },
  draw(F, st, v) { return v.kind === 'ring'; },
};
REC.mindNova = {
  spawn(F, st, v) { if (v.kind !== 'ring') return; const P = st.P, r = v.r; decal(K.Vortex, v.x, v.y, r * 0.3, r * 1.2, 1.1, P.b, 0.7, { sq: SQ, vr: 4 }); decal2(K.Eye, v.x, v.y - 80, 20, 90, 0.7, P.a, st.P.c, 0.9); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; bp(K.PetalH, v.x + Math.cos(a) * r * 0.3, v.y + Math.sin(a) * r * 0.15, { vx: Math.cos(a) * r * 1.3, vy: Math.sin(a) * r * 0.6, life: 0.9, s0: 18, s1: 10, rot: a, vr: 4, c: mixc(P.b, WHITE, 0.3), drag: 1.5 }); } },
  draw(F, st, v) { return v.kind === 'ring'; },
};

// ------------------------------------------------------------------ 锥形（cone）
function coneSprites(F: FxSys, v: any, u: number, k: number, n: number, sz: number, c: RGB, a: number, add = 1, rotOff = 0) {
  const r = v.r * (0.35 + 0.65 * Math.min(1, u * 2.5));
  for (let i = 0; i < n; i++) { const an = v.ang - v.spread + (n > 1 ? i / (n - 1) : 0.5) * v.spread * 2, d = r * (0.45 + 0.35 * ((i * 0.37) % 1)); F.bk(k, v.x + Math.cos(an) * d, v.y + Math.sin(an) * d * 0.85, sz, sz, an + rotOff, c, a, add); }
}
REC.fireCone = {
  spawn(F, st, v) { if (v.kind !== 'cone') return; for (let i = 0; i < 22; i++) { const a = v.ang + rnd(-v.spread, v.spread), sp = rnd(260, 560); F.emit({ x: v.x, y: v.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.3, 0.55), s0: rnd(20, 34), s1: 44, c: mixc(st.P.b, st.P.a, Math.random() * 0.4), cell: fireCell(), drag: 3 }); } decal(K.FireLotus, v.x, v.y, 20, 70, 0.4, st.P.b, 0.8, { vr: 4 }); },
  draw(F, st, v, u) { if (v.kind !== 'cone') return false; const a = 1 - u; coneSprites(F, v, u, K.FeatherF, 6, v.r * 0.55, st.P.b, 0.8 * a, 1, 0); coneSprites(F, v, u, K.Flame, 5, v.r * 0.4, st.P.a, 0.6 * a, 1, Math.PI / 2); F.glow(v.x, v.y, 40, st.P.b, 0.6 * a); return true; },
};
REC.corpseFire = {
  spawn(F, st, v) { if (v.kind !== 'cone') return; for (let i = 0; i < 18; i++) { const a = v.ang + rnd(-v.spread, v.spread), sp = rnd(200, 460); F.emit({ x: v.x, y: v.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.4, 0.7), s0: rnd(26, 40), s1: 70, c: st.P.c, a: 0.5, add: 0, cell: smokeCell(), drag: 3 }); } },
  draw(F, st, v, u, t) { if (v.kind !== 'cone') return false; const a = 1 - u; coneSprites(F, v, u, K.GhostFire, 7, v.r * 0.42, st.P.b, 0.85 * a, 1, -Math.PI / 2 + Math.PI); coneSprites(F, v, u, K.Skull, 2, v.r * 0.3, st.P.a, 0.4 * a); void t; return true; },
};
REC.swordCrescent = {
  spawn(F, st, v) { if (v.kind === 'cone') F.glint(v.x, v.y, 50, st.P.a, 0.9, 0.25); },
  draw(F, st, v, u) { if (v.kind !== 'cone') return false; const a = 1 - u, r = v.r * (0.4 + 0.6 * Math.min(1, u * 2.2)); for (let i = 0; i < 3; i++) { const d = r * (0.5 + i * 0.22); F.bk(K.Crescent, v.x + Math.cos(v.ang) * d, v.y + Math.sin(v.ang) * d, d * 1.2, d * 1.2 * Math.min(1.6, v.spread * 1.6), v.ang, mixc(st.P.b, WHITE, 0.3 + i * 0.15), a * (1 - i * 0.2)); } F.glow(v.x, v.y, 40, st.P.b, 0.5 * a); return true; },
};
REC.crossSlash = {
  spawn(F, st, v) { if (v.kind !== 'cone') return; const n = 4; for (let i = 0; i < n; i++) { const an = v.ang + rnd(-v.spread, v.spread) * 0.8, d = v.r * rnd(0.35, 0.9); decal2(K.CrossSlash, v.x + Math.cos(an) * d, v.y + Math.sin(an) * d, 10, rnd(50, 80), 0.18 + i * 0.07, mixc(st.P.b, WHITE, 0.4), st.P.c, 1, { rot: rnd(-0.5, 0.5) }); } },
  draw(F, st, v, u) { if (v.kind !== 'cone') return false; coneSprites(F, v, u, K.Crescent, 2, v.r * 0.6, st.P.a, 0.6 * (1 - u)); return true; },
};
REC.windPalm = {
  spawn(F, st, v) { if (v.kind === 'cone') decal2(K.Palm, v.x + Math.cos(v.ang) * 40, v.y + Math.sin(v.ang) * 40, 20, 70, 0.35, st.P.b, st.P.c, 0.8, { rot: v.ang + Math.PI / 2 }); },
  draw(F, st, v, u) { if (v.kind !== 'cone') return false; coneSprites(F, v, u, K.WindArc, 5, v.r * 0.5, mixc(st.P.b, WHITE, 0.3), 0.8 * (1 - u)); return true; },
};
REC.ghostClawCone = {
  spawn(F, st, v) { if (v.kind !== 'cone') return; for (let i = 0; i < 3; i++) { const an = v.ang + (i - 1) * v.spread * 0.6, d = v.r * 0.6; F.emit({ x: v.x + Math.cos(an) * d, y: v.y + Math.sin(an) * d, life: 0.4, s0: 60, s1: 110, c: st.P.b, a: 0.9, cell: C.Fang, rot: an + Math.PI / 2 }); } },
  draw(F, st, v, u) { if (v.kind !== 'cone') return false; coneSprites(F, v, u, K.Mist, 4, v.r * 0.5, st.P.c, 0.6 * (1 - u), 0); coneSprites(F, v, u, K.Skull, 2, v.r * 0.28, st.P.b, 0.5 * (1 - u)); return true; },
};

// ------------------------------------------------------------------ 光柱（beam / bigsword）
function along(v: any, k: number): Pt { return [v.x + (v.x2 - v.x) * k, v.y + (v.y2 - v.y) * k]; }
REC.icefire = {
  spawn(F, st, v) { if (v.kind !== 'beam') return; const P = st.P; for (let i = 1; i <= 7; i++) { const [x, y] = along(v, i / 7.5); bp(K.IceCluster, x + rnd(-14, 14), y + 30, { life: 1.1 + i * 0.05, s0: 30, s1: 80, c: mixc(P.b, WHITE, 0.4), a: 0.9, add: 0.6, vy: -6 }); } REC.frostSeal.spawn!(F, st, { kind: 'strike', x: v.x2, y: v.y2 + 30, r: 90 }); },
  draw(F, st, v, u, t, dt) {
    if (v.kind !== 'beam') return false;
    const P = st.P, a = 1 - u, w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.6);
    F.beam(v.x, v.y, v.x2, v.y2, w * 4.4, P.b, 0.45 * a); F.beam(v.x, v.y, v.x2, v.y2, w * 1.4, mixc(P.a, WHITE, 0.5), 0.9 * a);
    for (let i = nEmit(120, dt); i > 0; i--) { const k = Math.random(), [x, y] = along(v, k); F.emit({ x: x + rnd(-w, w), y: y + rnd(-w, w), vx: (v.x2 - v.x) * 0.3, vy: (v.y2 - v.y) * 0.3 - 60, life: rnd(0.25, 0.45), s0: rnd(18, 32), s1: 4, c: mixc(P.b, P.a, Math.random() * 0.5), cell: fireCell() }); }
    if (Math.random() < dt * 30 * PR) { const [x, y] = along(v, Math.random()); bp(K.Snow, x, y, { vy: rnd(-40, 20), vx: rnd(-30, 30), life: 0.7, s0: 16, s1: 4, rot: Math.random(), vr: 3, c: P.a }); }
    return true;
  },
};
REC.aurora = {
  spawn(F, st, v) { if (v.kind === 'beam') { REC.frostSeal.spawn!(F, st, { kind: 'strike', x: v.x2, y: v.y2 + 30, r: 110 }); decal(K.Star4, v.x, v.y, 20, 90, 0.4, WHITE, 1); } },
  draw(F, st, v, u, t, dt) {
    if (v.kind !== 'beam') return false;
    const a = 1 - u, w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.5), L = Math.hypot(v.x2 - v.x, v.y2 - v.y), ang = Math.atan2(v.y2 - v.y, v.x2 - v.x), nx = -Math.sin(ang), ny = Math.cos(ang);
    const cs: RGB[] = [[0.55, 1, 0.85], [0.55, 0.85, 1], [0.75, 0.6, 1]];
    for (let j = 0; j < 3; j++) { const pts: number[] = []; const n = 16; for (let i = 0; i <= n; i++) { const k = i / n, o = Math.sin(k * 9 + t * 6 + j * 2) * w * 0.9 * Math.sin(k * Math.PI); pts.push(v.x + (v.x2 - v.x) * k + nx * o, v.y + (v.y2 - v.y) * k + ny * o); } F.B.strip(C.Beam, pts, n + 1, () => w * (2.6 - j * 0.5), (i) => 0.5 * a * Math.sin((i / n) * Math.PI * 0.9 + 0.15), cs[j][0], cs[j][1], cs[j][2], 1); }
    F.beam(v.x, v.y, v.x2, v.y2, w * 0.7, WHITE, 0.9 * a);
    if (Math.random() < dt * 40 * PR) { const k = Math.random(); bp(K.Snow, v.x + (v.x2 - v.x) * k + rnd(-w, w), v.y + (v.y2 - v.y) * k + rnd(-w, w), { vy: rnd(-20, 30), life: 0.8, s0: 14, s1: 4, rot: Math.random(), vr: 2, c: cs[(Math.random() * 3) | 0] }); }
    void L; return true;
  },
};
REC.earthSpikeLine = {
  draw(F, st, v, u) {
    if (v.kind !== 'beam') return false;
    const P = st.P, n = 12, a = 1 - Math.max(0, u - 0.6) / 0.4;
    for (let i = 1; i <= n; i++) { const k = i / n; if (k > u * 2.2) break; const x = v.x + (v.x2 - v.x) * k, y = v.y + 40 + (v.y2 + 30 - v.y - 40) * k; const h = 110 * Math.sin(Math.min(1, (u * 2.2 - k) * 3) * Math.PI * 0.5) * (0.7 + 0.5 * ((i * 0.618) % 1)); F.bk(K.Spike, x + (i % 2 ? 8 : -8), y - h * 0.45, h * 0.62, h, (i % 3 - 1) * 0.12, mixc(P.b, P.c, 0.2), a, 0); F.bk(K.Spike, x + (i % 2 ? 8 : -8), y - h * 0.45, h * 0.66, h * 1.04, (i % 3 - 1) * 0.12, P.b, 0.25 * a); if (Math.random() < 0.06) F.smoke(x, y, 1, mixc(P.b, P.c, 0.5), 0.3, 10, 40); }
    return true;
  },
};
REC.bloodBeam = {
  spawn(F, st, v) { if (v.kind === 'beam') { decal(K.InkRing, v.x2, v.y2 + 20, 20, 120, 0.8, st.P.c, 0.8, { add: 0, sq: SQ }); inkSplat(v.x2, v.y2 + 20, 90, 0.5, st.P.c); } },
  draw(F, st, v, u, t, dt) {
    if (v.kind !== 'beam') return false;
    const P = st.P, a = 1 - u, w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.7);
    F.beam(v.x, v.y, v.x2, v.y2, w * 5, P.c, 0.5 * a, C.Beam, 0); F.beam(v.x, v.y, v.x2, v.y2, w * 2.4, P.b, 0.7 * a); F.beam(v.x, v.y, v.x2, v.y2, w * 0.6, P.a, 0.9 * a);
    if (Math.random() < dt * 40 * PR) { const [x, y] = along(v, Math.random()); bp(K.Drop, x, y, { vx: rnd(-60, 60), vy: rnd(-60, 0), life: 0.6, s0: 14, s1: 6, rot: Math.PI / 2, c: P.b, grav: 600, h: 0.6, add: 0.5 }); }
    void t; return true;
  },
};
REC.goldThunderBeam = {
  spawn(F, st, v) { if (v.kind === 'beam') { decal(K.ElecRing0, v.x2, v.y2, 20, 110, 0.5, st.P.b, 1, { vr: 3 }); F.glint(v.x, v.y, 60, st.P.a, 0.9, 0.3); } },
  draw(F, st, v, u, t) {
    if (v.kind !== 'beam') return false;
    const P = st.P, a = 1 - u, w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.7);
    F.beam(v.x, v.y, v.x2, v.y2, w * 3.6, P.b, 0.45 * a); F.beam(v.x, v.y, v.x2, v.y2, w, mixc(P.a, WHITE, 0.6), 0.95 * a);
    elecLine(F, v.x, v.y, v.x2, v.y2, w * 1.6, P.b, a, t, v.seed | 0);
    if (Math.random() < 0.3) { const [x, y] = along(v, Math.random()); F.crackle(x, y, 40, P.b, 0.8, 1); }
    return true;
  },
};
REC.giantSword = {
  spawn(F, st, v) { if (v.kind === 'bigsword') { F.glint(v.x2, v.y2, 90, st.P.a, 0.9, 0.3); decal2(K.CrossSlash, v.x2, v.y2, 30, 140, 0.4, st.P.b, st.P.c, 0.9); } },
  draw(F, st, v, u) {
    if (v.kind !== 'bigsword') return false;
    const drop = Math.min(1, u * 3), a = 1 - u, ang = Math.atan2(v.y2 - v.y, v.x2 - v.x), len = Math.hypot(v.x2 - v.x, v.y2 - v.y), mx = (v.x + v.x2) / 2, my = (v.y + v.y2) / 2;
    F.sprite(C.Glow, mx, my, len * 1.2, v.r * 4, ang, st.P.b, 0.35 * a);
    F.bk(K.Sword, mx + Math.cos(ang) * len * 0.08, my + Math.sin(ang) * len * 0.08, len * 1.5, len * 1.5 * (0.35 + 0.65 * drop) * 0.6, ang, mixc(st.P.b, WHITE, 0.5), a);
    F.sprite(C.Streak, mx, my, len * 1.3, v.r * 1.2, ang, WHITE, 0.5 * a);
    return true;
  },
};

// ------------------------------------------------------------------ 锁链（chain）
REC.bixie = {
  spawn(F, st, v) { if (v.kind === 'chain' && v.color !== '255,250,220') bigfxPush?.('heavenSeal', { x: v.x2, y: v.y2 + 30, r: 120, dur: 1.1, color: '255,215,90' }); },
  draw(F, st, v, u, t) { if (v.kind !== 'chain') return false; elecLine(F, v.x, v.y, v.x2, v.y2, (v.w ?? 4) * 3, st.P.b, (1 - u) * 0.9, t, v.seed | 0); return false; },
};
REC.thunderChain = {
  draw(F, st, v, u, t) { if (v.kind !== 'chain') return false; const a = 1 - u; elecLine(F, v.x, v.y, v.x2, v.y2, 10 + (v.w ?? 2) * 2, st.P.b, a, t, v.seed | 0); F.bolt(v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30) * 7, 20, 1.2, st.P.a, a, 9, false); F.glow(v.x2, v.y2, 30, st.P.b, 0.6 * a); if (Math.random() < 0.3) F.crackle(v.x2, v.y2, 40, st.P.b, 0.8, 1); return true; },
};
REC.ghostChain = {
  draw(F, st, v, u, t) {
    if (v.kind !== 'chain') return false;
    const P = st.P, a = 1 - u, ang = Math.atan2(v.y2 - v.y, v.x2 - v.x), nx = -Math.sin(ang), ny = Math.cos(ang), n = 14;
    for (let j = 0; j < 3; j++) { const pts: number[] = []; for (let i = 0; i <= n; i++) { const k = i / n, o = Math.sin(k * 10 + t * 12 + j * 2.1) * 12 * Math.sin(k * Math.PI); pts.push(v.x + (v.x2 - v.x) * k + nx * o, v.y + (v.y2 - v.y) * k + ny * o); } F.B.strip(C.Beam, pts, n + 1, () => 5, () => 0.7 * a, P.b[0], P.b[1], P.b[2], 1); }
    for (let i = 1; i < 4; i++) { const [x, y] = along(v, (i / 4 + t * 0.6) % 1); F.bk(K.GhostFire, x, y, 26, 34, -Math.PI / 2 + ang + Math.PI, P.b, 0.8 * a); }
    F.glow(v.x2, v.y2, 30, P.b, 0.5 * a); return true;
  },
};
REC.fiveGhosts = {
  draw(F, st, v, u, t) {
    if (v.kind !== 'chain') return false;
    const P = st.P, a = 1 - u;
    F.beam(v.x, v.y, v.x2, v.y2, 6, P.b, 0.5 * a);
    for (let i = 0; i < 5; i++) { const k = Math.min(1, u * 1.6 + i * 0.12) * (0.4 + i * 0.12), [x, y] = along(v, k); F.bk(K.Skull, x + Math.sin(t * 8 + i) * 10, y - 14 + Math.cos(t * 6 + i) * 8, 40, 40, Math.sin(t * 5 + i) * 0.3, mixc(P.b, WHITE, 0.2), 0.85 * a); }
    F.glow(v.x2, v.y2, 34, P.b, 0.5 * a); return true;
  },
};

// ------------------------------------------------------------------ 持续区域（field）
function ringAround(F: FxSys, f: any, k: number, cell: number, n: number, sz: number, c: RGB, a: number, rot: number, add = 1, vert = false) {
  for (let i = 0; i < n; i++) { const an = i / n * TAU + rot, x = f.x + Math.cos(an) * f.r * 0.92, y = f.y + Math.sin(an) * f.r * 0.5; F.bk(cell, x, y - (vert ? sz * 0.45 : 0), sz * (vert ? 0.6 : 1), sz, vert ? 0 : an, c, a * k, add); }
}
REC.blaze = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.FireLotus, f.x, f.y, f.r * 0.95, t * 0.4, P.b, 0.45 * k, 1, SQ);
    if (Math.random() < dt * 10 * PR) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r * 0.85; bp(K.FeatherF, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.55, { vy: rnd(-200, -110), vx: rnd(-20, 20), life: rnd(0.5, 0.8), s0: rnd(20, 34), s1: 8, rot: -Math.PI / 2 + rnd(-0.3, 0.3), c: mixc(P.b, P.a, Math.random() * 0.3), a: 0.8 * k }); }
    return false;   // 叠在原火海之上
  },
};
REC.skyfire = {
  field(F, st, f, t, dt, k) {
    REC.blaze.field!(F, st, f, t, dt, k);
    F.bk(K.Sun, f.x, f.y - 420, f.r * 0.7, f.r * 0.7, t * 0.2, st.P.b, 0.5 * k); F.glow(f.x, f.y - 420, f.r * 0.9, st.P.b, 0.25 * k);
    if (Math.random() < dt * 4 * PR) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.55; bp(K.FeatherF, x + 120, y - 420, { vx: -300, vy: 1050, life: 0.4, s0: 60, s1: 40, rot: Math.atan2(1050, -300) + Math.PI, c: st.P.b, a: 0.9 * k }); }
    return false;
  },
};
REC.purpleFire = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.FireLotus, f.x, f.y, f.r * 1.05, -t * 0.5, P.b, 0.5 * k, 1, SQ);
    F.bkG(K.Glyph, f.x, f.y, f.r * 0.5, t * 0.8, P.a, 0.4 * k, 1, SQ);
    F.ground(C.Glow, f.x, f.y, f.r, 0, P.b, 0.3 * k, 1, SQ);
    for (let i = nEmit(f.r * 0.32, dt); i > 0; i--) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r; F.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.55, vy: rnd(-130, -60), vx: rnd(-10, 10), life: rnd(0.35, 0.7), s0: rnd(24, 44), s1: 6, c: mixc(P.b, P.a, Math.random() * 0.4), cell: fireCell(), a: 0.9 * k }); }
    return true;
  },
};
REC.netherFire = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.ground(C.Disc, f.x, f.y, f.r, 0, P.c, 0.5 * k, 0, SQ);
    F.bkG(K.RuneRing, f.x, f.y, f.r, t * 0.3, P.b, 0.45 * k, 1, SQ);
    if (Math.random() < dt * 16 * PR) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r * 0.9; bp(K.GhostFire, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.55, { vy: rnd(-90, -40), life: rnd(0.6, 1), s0: rnd(26, 44), s1: 10, c: mixc(P.b, P.a, Math.random() * 0.3), a: 0.9 * k }); }
    if (Math.random() < dt * 1.5 * PR) bp(K.Skull, f.x + rnd(-f.r, f.r) * 0.6, f.y - 40, { vy: -50, life: 1.2, s0: 40, s1: 60, c: P.b, a: 0.5 * k });
    return true;
  },
};
REC.frostField = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.ground(C.Glow, f.x, f.y, f.r * 1.05, 0, P.b, 0.35 * k, 1, SQ);
    F.bkG(K.Snow, f.x, f.y, f.r * 0.95, t * 0.15, P.a, 0.4 * k, 1, SQ);
    F.bkG(K.Hex, f.x, f.y, f.r, 0, P.b, 0.25 * k, 1, SQ);
    ringAround(F, f, k, K.IceCluster, 9, f.r * 0.5, mixc(P.b, WHITE, 0.3), 0.85, 0.3, 0.6, true);
    if (Math.random() < dt * 26 * PR) bp(K.Snow, f.x + rnd(-f.r, f.r), f.y - rnd(150, 320), { vy: rnd(90, 160), vx: rnd(-30, 30), life: 1.6, s0: rnd(10, 18), s1: 8, rot: Math.random(), vr: 2, c: P.a, a: 0.9 * k });
    return true;
  },
};
REC.thunderField = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.ThunderSeal, f.x, f.y, f.r, t * 0.4, P.b, 0.6 * k, 1, SQ);
    if (Math.random() < dt * 3 * PR) { const a = Math.random() * TAU, r = Math.random() * f.r * 0.8, x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.55; decal(K.ForkV, x, y - 300, 70, 90, 0.18, mixc(P.b, WHITE, 0.4), 1, { h: 7 }); decal(K.ElecRing0, x, y, 20, 70, 0.3, P.b, 0.9, { sq: SQ }); }
    return false;
  },
};
REC.quicksand = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.Vortex, f.x, f.y, f.r, -t * 1.2, mixc(P.b, P.c, 0.4), 0.55 * k, 0, SQ);
    F.bkG(K.Vortex, f.x, f.y, f.r * 0.7, -t * 1.8, P.b, 0.25 * k, 1, SQ);
    if (Math.random() < dt * 12 * PR) { const a = Math.random() * TAU; F.emit({ x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r * 0.55, vx: -Math.cos(a) * f.r * 1.2 - Math.sin(a) * 80, vy: -Math.sin(a) * f.r * 0.6 + Math.cos(a) * 40, life: 0.8, s0: 6, s1: 3, c: mixc(P.b, P.c, 0.3), add: 0, a: 0.8, cell: C.Shard, rot: Math.random() * TAU, drag: 1 }); }
    return true;
  },
};
REC.sandStorm = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.Vortex, f.x, f.y, f.r, t * 2, mixc(P.b, P.c, 0.3), 0.45 * k, 0, SQ);
    for (let i = 0; i < 6; i++) { const a = t * 3 + i * TAU / 6, r = f.r * (0.5 + 0.3 * Math.sin(t + i)); F.sprite(C.Shard, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.5 - 60 - 30 * Math.sin(t * 2 + i), 26, 22, t * 6 + i, mixc(P.b, P.c, 0.5), 0.9 * k, 0); }
    if (Math.random() < dt * 8) F.smoke(f.x + rnd(-f.r, f.r) * 0.7, f.y - 30, 1, mixc(P.b, P.c, 0.4), 0.3 * k, 10, 70);
    return false;
  },
};
REC.springSword = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.StarField, f.x, f.y, f.r, t * 0.2, P.a, 0.55 * k, 1, SQ);
    F.ground(C.Ring, f.x, f.y, f.r, 0, P.b, 0.6 * k, 1, SQ);
    for (let i = 0; i < 12; i++) { const ph = (t * 2.2 + i * 0.37) % 1, x = f.x + Math.sin(i * 12.9898) * f.r * 0.85, y = f.y + Math.cos(i * 78.233) * f.r * 0.45, yy = y - 320 * (1 - ph); F.bk(K.Sword, x, yy - 30, 70, 70, Math.PI / 2, mixc(i % 2 ? P.b : [0.6, 1, 0.75], WHITE, 0.4), 0.9 * k); if (ph > 0.9) F.glow(x, y, 22, P.b, k); }
    if (Math.random() < dt * 12 * PR) bp(K.PetalH, f.x + rnd(-f.r, f.r), f.y - rnd(150, 300), { vy: rnd(60, 120), vx: rnd(-30, 30), life: 2, s0: 14, s1: 10, rot: Math.random() * TAU, vr: rnd(-3, 3), c: P.b, a: 0.9 * k });
    return true;
  },
};
REC.arrayTrap = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.RuneRing, f.x, f.y, f.r * 1.02, t * 0.4, P.b, 0.8 * k, 1, SQ);
    F.bkG(K.Glyph, f.x, f.y, f.r * 0.55, -t * 0.6, P.a, 0.6 * k, 1, SQ);
    F.ground(C.Glow, f.x, f.y, f.r, 0, P.b, 0.18 * k, 1, SQ);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4, x = f.x + Math.cos(a) * f.r * 0.95, y = f.y + Math.sin(a) * f.r * 0.52; F.bk(K.Pillar, x, y - 120, 80, 260, 0, P.b, 0.6 * k); F.bk(K.Stamp, x, y - 20, 34, 34, 0, P.b, 0.8 * k); }
    return true;
  },
};
REC.arrayFive = {
  field(F, st, f, t, dt, k) {
    const cs: RGB[] = [[1, 0.45, 0.35], [1, 0.85, 0.4], [0.5, 0.9, 0.5], [0.5, 0.7, 1], [0.95, 0.95, 1]];
    F.bkG(K.Taiji, f.x, f.y, f.r * 0.45, t * 0.8, st.P.a, 0.7 * k, 1, SQ);
    F.ground(C.Bagua, f.x, f.y, f.r * 0.85, -t * 0.4, st.P.b, 0.6 * k, 1, SQ);
    F.bkG(K.RingThin, f.x, f.y, f.r, 0, st.P.b, 0.7 * k, 1, SQ);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2 + t * 0.2, x = f.x + Math.cos(a) * f.r * 0.9, y = f.y + Math.sin(a) * f.r * 0.5; F.bk(K.Pillar, x, y - 110, 70, 240, 0, cs[i], 0.7 * k); F.glow(x, y, 26, cs[i], 0.7 * k); }
    return true;
  },
};
REC.arrayGather = {
  field(F, st, f, t, dt, k) {
    const P = st.P;
    F.bkG(K.Ripple, f.x, f.y, f.r * (0.6 + 0.4 * ((t * 0.5) % 1)), 0, P.b, 0.6 * k * (1 - ((t * 0.5) % 1)), 1, SQ);
    F.bkG(K.Vortex, f.x, f.y, f.r * 0.9, t * 0.8, P.b, 0.4 * k, 1, SQ);
    F.ground(C.Glow, f.x, f.y, f.r, 0, P.b, 0.2 * k, 1, SQ);
    if (Math.random() < dt * 18 * PR) { const a = Math.random() * TAU; F.emit({ x: f.x + Math.cos(a) * f.r * 1.3, y: f.y + Math.sin(a) * f.r * 0.7 - 30, vx: -Math.cos(a) * f.r * 1.1, vy: -Math.sin(a) * f.r * 0.6 - 30, life: 1, s0: 7, s1: 2, c: P.a, drag: 0.5, cell: C.Star }); }
    return true;
  },
};

// ------------------------------------------------------------------ 增益（aura）
REC.dharma = { spawn() { /* 法相由 bigfx('dharma') 演出，见 world/vfxhook.ts */ } };
REC.mingwang = { spawn(F, st, v) { if (v.kind === 'aura') { decal(K.Aureole, v.x, v.y - 70, 40, 160, 1.2, st.P.b, 0.7, { vr: 0.5 }); F.flames(v.x, v.y, 60, st.P.b, 10); } } };

// ------------------------------------------------------------------ 大场面请求转发（bigfx 由 bigfx.ts 注入，避免循环引用）
let bigfxPush: ((k: any, o: any) => void) | null = null;
export function setBigfxPush(fn: (k: any, o: any) => void) { bigfxPush = fn; }

// ------------------------------------------------------------------ 对外：combatgl 调用的入口
/** 弹道（返回 true 表示已按配方绘制） */
export function vfxProj(F: FxSys, pr: any, t: number, dt: number, head: Pt[]): boolean {
  const st = styleOf(pr); if (!st || !st.r) return false;
  const R = REC[st.r]; if (!R.proj) return false;
  if (!pr._vs) { pr._vs = 1; castSig(F, st, pr.x, pr.y, pr.fac === 'p'); }
  R.proj(F, st, pr, t, dt, head);
  const L = live.get(pr); if (L) { L.x = pr.x; L.y = pr.y; L.f = frame; } else live.set(pr, { x: pr.x, y: pr.y, f: frame, st, s: (pr.size ?? 1) });
  return true;
}
/** 出手印记：施法者身前一闪本配方的图样 */
const SIG_K: Record<string, number> = { fireOrb: K.FireLotus, fireSnake: K.FireLotus, fireBird: K.FeatherF, demonFire: K.GhostFire, iceSpike: K.Snow, iceNeedle: K.Star4, waterArrow: K.Ripple, waterSpout: K.Ripple, moonFrost: K.MoonDisc, windBlade: K.WindArc, triCrescent: K.Crescent, whirlwind: K.Vortex, rockShot: K.Mountain, vineBind: K.Blossom, leafBlade: K.Willow, flyingSword: K.Sword, goldBlade: K.Crescent, thunderSword: K.ThunderSeal, swordDragon: K.Sword, iceDragon: K.Snow, talismanFire: K.Glyph, talismanSeal: K.Glyph, mindSpike: K.Eye, ghostFire: K.Skull, ghostClaw: K.Skull, bloodShot: K.InkRing, palmShot: K.Palm, starShot: K.Star4, petalMist: K.Blossom, bugShot: K.Bug, soundWave: K.SoundArc, thunderBolt: K.ThunderSeal, goldThunderShot: K.ThunderSeal };
function castSig(F: FxSys, st: St, x: number, y: number, player: boolean) {
  const k = SIG_K[st.r]; if (k === undefined) return;
  sig(k, x, y, player ? 46 : 36, st.P.b, st.r + (st.sect ?? ''), player ? 0.7 : 0.5);
}
// 弹道结束检测：本帧没再出现的已登记弹道 → 爆开
let frame = 0;
const live = new Map<any, { x: number; y: number; f: number; st: St; s: number }>();
export function vfxProjEnd(F: FxSys, projs: any[]) {
  for (const [pr, L] of live) {
    if (L.f === frame) continue;
    live.delete(pr);
    const R = REC[L.st.r]; if (!R?.hit) continue;
    const fz = (pr.life ?? 0) >= (pr.max ?? 1) - 0.02;
    R.hit(F, L.st, L.x, L.y, L.s * L.st.s, fz, pr);
  }
  if (live.size > 600) live.clear();
  frame++;
  void projs;
}
/** 法术光效初现（叠加本配方的出手 / 爆开；旧特效是否照画由 vfxDraw 的返回值决定） */
export function vfxSpawn(F: FxSys, v: any) {
  const st = styleOf(v); if (!st) return;
  if (!st.r) return;
  const R = REC[st.r];
  if (R.spawn) { R.spawn(F, st, v); return; }
  // 没有专属 spawn 的配方（弹道配方用于宗门落点 / 命中光效）：flash → 本配方命中爆开；ring → 本配方印记
  if (R.hit && v.kind === 'flash') R.hit(F, st, v.x, v.y, Math.max(0.7, Math.min(2.4, (v.r ?? 60) / 60)), false);
  else if (v.kind === 'ring') { const k = SIG_K[st.r]; if (k !== undefined) decal(k, v.x, v.y, (v.r ?? 80) * 0.3, (v.r ?? 80) * 1.1, 0.5, mixc(st.P.b, WHITE, 0.2), 0.75, { sq: SQ, rot: Math.random() * TAU }); }
}
/** 法术光效逐帧：返回 true 表示已接管（旧特效不再画） */
export function vfxDraw(F: FxSys, v: any, t: number, dt: number): boolean {
  const st = styleOf(v); if (!st || !st.r) return false;
  const R = REC[st.r];
  return (v._own = R.draw ? !!R.draw(F, st, v, clamp(v.t / v.dur, 0, 1), t, dt) : v.kind === 'flash' && !!R.hit && !R.spawn);
}
/** 区域逐帧：返回 true 表示已接管（否则旧画法照画，配方只做叠层） */
export function vfxField(F: FxSys, f: any, t: number, dt: number, k: number): boolean {
  const st = styleOf(f); if (!st || !st.r) return false;
  const R = REC[st.r]; if (!R.field) return false;
  return (f._own = !!R.field(F, st, f, t, dt, k));
}
/** 是否已由配方接管（Canvas 关键图层据此跳过外部 AI 图，避免两套画面叠在一起；标记由本帧 GL 绘制写入） */
export const vfxOwns = (o: any): boolean => !!(o._own || o._vs);

// ------------------------------------------------------------------ 给其他分支的便捷接口（新出手方式：葫芦、伞、塔、印、灯、钟……）
export type TreasureShape = 'gourd' | 'umbrella' | 'pagoda' | 'stamp' | 'lamp' | 'bell' | 'sword' | 'fu' | 'mountain' | 'palm' | 'taiji' | 'eye';
const TS_K: Record<TreasureShape, number> = { gourd: K.Gourd, umbrella: K.Umbrella, pagoda: K.Pagoda, stamp: K.Stamp, lamp: K.Lamp, bell: K.Bell, sword: K.Sword, fu: K.Fu, mountain: K.Mountain, palm: K.Palm, taiji: K.Taiji, eye: K.Eye };
/** 画一件发光的法宝剪影（暗边垫底 + 本色 + 亮芯），size 为世界尺寸，rot 弧度（0 = 图样本来的朝向：器物口朝上，飞剑尖朝右） */
export function drawTreasure(F: FxSys, shape: TreasureShape, x: number, y: number, size: number, color: string, alpha = 1, rot = 0) {
  const P = palFromColor(color); headBake(F, TS_K[shape], x, y, size, size, rot, P.b, alpha, 1, P.c);
}
/** 在某点放一次某配方的命中爆开（scale 约等于 1 = 普通弹头大小）；color 不给则用配方默认色板 */
export function vfxBurst(F: FxSys, recipe: string, x: number, y: number, scale = 1, color?: string) {
  const R = REC[recipe]; if (!R?.hit) return false;
  R.hit(F, { r: recipe, P: color ? palFromColor(color) : palOf(['255,250,230', '255,210,120', '110,70,20']), s: 1 }, x, y, scale, false);
  return true;
}
/** 用某配方画一颗任意弹道（pr 需有 x, y, vx, vy，可选 size；head 为拖尾点列，旧→新） */
export function vfxProjAs(F: FxSys, recipe: string, pr: any, t: number, dt: number, head: [number, number][], color?: string) {
  const R = REC[recipe]; if (!R?.proj) return false;
  pr._st ??= { r: recipe, P: color ? palFromColor(color) : palFromColor(pr.color ?? '255,220,150'), s: 1 };
  R.proj(F, pr._st, pr, t, dt, head);
  return true;
}
