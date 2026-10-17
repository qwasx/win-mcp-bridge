// 第二十七步：敌人招式的地面预警与持续区域（WebGL）
// 预警：外圈描边 + 由内向外“灌满”的填充 + 末段闪亮；首领大招外加旋转法阵与升腾光点。
// 余毒 / 余火：留在地上的区域，带气泡、火舌、霜屑。
import type { Combat } from '../world/combat';
import type { Hz, El } from '../world/foeskills';
import { EL_COL } from '../world/foeskills';
import { FxSys, col, mixc, RGB, fireCell, smokeCell, extOK } from './fx';
import { C } from './atlas';
import { bakeWarnBig, bakeFoeFire } from './bakefx';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const RED: RGB = [1, 0.22, 0.12];
const WHITE: RGB = [1, 1, 1];
const SQ = 0.55;

function warnCol(el: El): RGB { return mixc(RED, col(EL_COL[el]), 0.3); }
/** 朱砂底色（普通混合，亮地面上也读得出“红”） */
const INK: RGB = [0.6, 0.05, 0.03];
function inkCol(el: El): RGB { return mixc(INK, mixc(col(EL_COL[el]), [0, 0, 0], 0.45), 0.22); }

function flair(F: FxSys, h: Hz, x: number, y: number, r: number, u: number, dt: number) {
  const cc = col(EL_COL[h.el]);
  const rate = dt * (h.big ? 40 : 14) * (0.4 + u);
  if (Math.random() > rate) return;
  const a = Math.random() * TAU, rr = r * Math.sqrt(Math.random());
  const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * SQ;
  switch (h.el) {
    case 'thunder': case 'gold':
      if (u > 0.5) F.bolt(px, py - rnd(40, 90), px + rnd(-10, 10), py, Math.random() * 1e6, 8, 0.9, cc, 0.7, 5, false);
      else F.emit({ x: px, y: py, vy: rnd(-60, -20), life: 0.3, s0: 3, s1: 1, c: cc, cell: C.Star }); break;
    case 'fire': case 'blood':
      F.emit({ x: px, y: py, vx: rnd(-10, 10), vy: rnd(-90, -40), life: rnd(0.3, 0.6), s0: rnd(10, 18), s1: 3, c: h.el === 'fire' ? [1, 0.55, 0.18] : [0.9, 0.1, 0.15], a: 0.7, cell: fireCell() }); break;
    case 'ice':
      F.emit({ x: px, y: py, vy: rnd(-30, -10), life: rnd(0.4, 0.8), s0: 6, s1: 2, c: [0.85, 0.95, 1], cell: C.Shard, rot: rnd(0, TAU) }); break;
    case 'poison':
      F.emit({ x: px, y: py, vy: rnd(-40, -15), life: rnd(0.5, 0.9), s0: rnd(4, 8), s1: rnd(10, 16), c: [0.5, 0.85, 0.25], a: 0.5, cell: C.Ring }); break;
    case 'wind':
      F.emit({ x: px, y: py, vx: Math.cos(a + 1.6) * 160, vy: Math.sin(a + 1.6) * 80, life: 0.35, s0: 3, s1: 1, c: cc, a: 0.6, stretch: 4, cell: C.Glow }); break;
    case 'ghost':
      F.emit({ x: px, y: py, vy: rnd(-50, -20), life: rnd(0.5, 0.9), s0: rnd(14, 22), s1: 4, c: cc, a: 0.35, cell: C.Wisp, rot: 0 }); break;
    default:
      F.emit({ x: px, y: py, vx: rnd(-20, 20), vy: rnd(-50, -20), life: 0.4, s0: rnd(3, 5), s1: 1, c: [0.75, 0.62, 0.45], a: 0.7, grav: 120, cell: C.Glow });
  }
}

function drawCircleWarn(F: FxSys, h: Hz, t: number, dt: number) {
  const u = Math.min(1, h.t / h.tele), wc = warnCol(h.el), end = u > 0.82 ? (u - 0.82) / 0.18 : 0;
  const pulse = 0.75 + 0.25 * Math.sin(t * 14);
  const ic = h.big ? mixc(inkCol(h.el), mixc(col(EL_COL[h.el]), [0, 0, 0], 0.35), 0.35) : inkCol(h.el);
  F.ground(C.Disc, h.x, h.y, h.r, 0, ic, 0.16 + 0.05 * pulse, 0, SQ);
  F.ground(C.Disc, h.x, h.y, h.r * u, 0, ic, 0.22 + 0.2 * end, 0, SQ);
  F.ground(C.Ring, h.x, h.y, h.r, 0, ic, 0.85, 0, SQ);
  F.ground(C.Ring, h.x, h.y, h.r, 0, wc, 0.35 * pulse + 0.4 * end, 1, SQ);
  F.ground(C.Ring, h.x, h.y, h.r * u, 0, mixc(wc, WHITE, 0.4), 0.4, 1, SQ);
  if (h.big) {
    F.ground(C.Rune, h.x, h.y, h.r * 0.98, t * 0.8, ic, 0.5, 0, SQ);
    F.ground(C.Rune, h.x, h.y, h.r * 0.98, t * 0.8, wc, 0.25 + 0.35 * end, 1, SQ);
    if (extOK()) { F.ground(C.KDots, h.x, h.y, h.r * 0.8, -t * 1.1, wc, 0.3 + 0.4 * end, 1, SQ); F.ground(C.KVortex, h.x, h.y, h.r * 0.55 * (0.6 + 0.4 * u), -t * 2.5, wc, 0.2 + 0.3 * end, 1, SQ); }
    F.ground(C.Bagua, h.x, h.y, h.r * 0.55, -t * 1.4, mixc(wc, WHITE, 0.3), 0.25 + 0.3 * end, 1, SQ);
    bakeWarnBig(F, h.x, h.y, h.r, t, wc, ic, end);
    if (Math.random() < dt * 30) { const a = Math.random() * TAU; F.emit({ x: h.x + Math.cos(a) * h.r, y: h.y + Math.sin(a) * h.r * SQ, vy: rnd(-160, -80), life: rnd(0.5, 0.9), s0: 5, s1: 1, c: wc, cell: C.Glow }); }
  }
  flair(F, h, h.x, h.y, h.r, u, dt);
}

function drawPool(F: FxSys, h: Hz, t: number, dt: number) {
  const k = Math.min(1, (h.t - h.tele) / 0.3) * Math.min(1, (h.tele + (h.pool ?? 0) - h.t) / 0.6);
  if (k <= 0) return;
  const cc = col(EL_COL[h.el]);
  if (h.el === 'fire' || h.el === 'blood') {
    F.ground(C.Disc, h.x, h.y, h.r, 0, h.el === 'fire' ? [0.35, 0.1, 0.02] : [0.3, 0.02, 0.04], 0.35 * k, 0, SQ);
    F.ground(C.FireRing, h.x, h.y, h.r * 0.95, t * 0.7, cc, 0.55 * k, 1, SQ);
    if (Math.random() < dt * 18 * k) { const a = Math.random() * TAU, rr = h.r * Math.sqrt(Math.random()); F.emit({ x: h.x + Math.cos(a) * rr, y: h.y + Math.sin(a) * rr * SQ, vy: rnd(-110, -60), life: rnd(0.3, 0.6), s0: rnd(14, 26), s1: 4, c: h.el === 'fire' ? [1, 0.55, 0.18] : [0.9, 0.12, 0.16], a: 0.75, cell: fireCell() }); }
  } else if (h.el === 'poison') {
    F.ground(C.Smoke, h.x, h.y, h.r * 1.1, t * 0.1, [0.18, 0.32, 0.06], 0.45 * k, 0, SQ);
    F.ground(C.Disc, h.x, h.y, h.r, 0, cc, 0.16 * k, 1, SQ);
    if (Math.random() < dt * 14 * k) { const a = Math.random() * TAU, rr = h.r * Math.sqrt(Math.random()); F.emit({ x: h.x + Math.cos(a) * rr, y: h.y + Math.sin(a) * rr * SQ, vy: rnd(-30, -10), life: rnd(0.6, 1), s0: rnd(4, 9), s1: rnd(12, 18), c: [0.55, 0.9, 0.3], a: 0.55, cell: C.Ring }); }
    if (Math.random() < dt * 5 * k) F.emit({ x: h.x + rnd(-h.r, h.r) * 0.6, y: h.y + rnd(-h.r, h.r) * 0.3, vy: rnd(-25, -10), life: 1.2, s0: 30, s1: 60, c: [0.35, 0.6, 0.15], a: 0.22, add: 0.4, cell: smokeCell(), rot: rnd(0, TAU) });
  } else if (h.el === 'ice' || h.el === 'water') {
    F.ground(C.Disc, h.x, h.y, h.r, 0, cc, 0.2 * k, 1, SQ);
    F.ground(C.Rune, h.x, h.y, h.r * 0.9, t * 0.3, cc, 0.25 * k, 1, SQ);
  } else {
    F.ground(C.Disc, h.x, h.y, h.r, 0, cc, 0.16 * k, 1, SQ);
    if (h.el === 'wind') for (let i = 0; i < 3; i++) F.ground(C.Ring, h.x, h.y, h.r * (0.4 + 0.25 * i), t * (3 + i), cc, 0.35 * k, 1, SQ);
    flair(F, h, h.x, h.y, h.r, 1, dt);
  }
}

function drawConeWarn(F: FxSys, h: Hz, t: number, dt: number) {
  const u = Math.min(1, h.t / h.tele), wc = warnCol(h.el), ic = inkCol(h.el), end = u > 0.8 ? (u - 0.8) / 0.2 : 0;
  const A0 = Math.atan2(Math.sin(h.ang) / 0.7, Math.cos(h.ang));
  const N = 11, w = (h.r * h.spread * 2 / N) * 1.6;
  const P = (a: number, d: number): [number, number] => [h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.7];
  for (let i = 0; i < N; i++) {
    const a = A0 - h.spread + (i + 0.5) / N * h.spread * 2;
    const [x2, y2] = P(a, h.r), [x3, y3] = P(a, h.r * u);
    F.beam(h.x, h.y, x2, y2, w, ic, 0.1, C.Glow, 0);
    F.beam(h.x, h.y, x3, y3, w * 0.9, ic, 0.16 + 0.12 * end, C.Glow, 0);
    F.beam(h.x, h.y, x3, y3, w * 0.5, wc, 0.06 + 0.15 * end, C.Glow);
  }
  const [ax, ay] = P(A0 - h.spread, h.r), [bx, by] = P(A0 + h.spread, h.r);
  F.beam(h.x, h.y, ax, ay, 4, ic, 0.85, C.Beam, 0);
  F.beam(h.x, h.y, bx, by, 4, ic, 0.85, C.Beam, 0);
  const arc: number[] = [], arcU: number[] = [];
  for (let i = 0; i <= 16; i++) { const a = A0 - h.spread + (i / 16) * h.spread * 2; const p = P(a, h.r), q = P(a, h.r * u); arc.push(p[0], p[1]); arcU.push(q[0], q[1]); }
  F.B.strip(C.Beam, arc, arc.length / 2, () => 5, () => 0.85, ic[0], ic[1], ic[2], 0);
  F.B.strip(C.Beam, arcU, arcU.length / 2, () => 3, () => 0.45, wc[0], wc[1], wc[2], 1);
  const [fx, fy] = P(A0 + (Math.random() - 0.5) * h.spread * 2, h.r * Math.random() * u);
  flair(F, h, fx, fy, 30, u, dt);
}

function drawLineWarn(F: FxSys, h: Hz, t: number, dt: number) {
  const u = Math.min(1, h.t / h.tele), wc = h.dmg > 0 ? warnCol(h.el) : mixc([1, 0.55, 0.15], col(EL_COL[h.el]), 0.25), end = u > 0.8 ? (u - 0.8) / 0.2 : 0;
  const ux = Math.cos(h.ang), uy = Math.sin(h.ang), x2 = h.x + ux * h.len, y2 = h.y + uy * h.len, nx = -uy * h.w / 2, ny = ux * h.w / 2;
  const ic: RGB = h.dmg > 0 ? inkCol(h.el) : [0.62, 0.28, 0.04];
  F.beam(h.x, h.y, x2, y2, h.w * 1.1, ic, 0.16, C.Glow, 0);
  F.beam(h.x, h.y, h.x + ux * h.len * u, h.y + uy * h.len * u, h.w * 0.9, ic, 0.2 + 0.15 * end, C.Glow, 0);
  F.beam(h.x, h.y, h.x + ux * h.len * u, h.y + uy * h.len * u, h.w * 0.4, wc, 0.08 + 0.2 * end, C.Glow);
  F.beam(h.x + nx, h.y + ny, x2 + nx, y2 + ny, 4, ic, 0.85, C.Beam, 0);
  F.beam(h.x - nx, h.y - ny, x2 - nx, y2 - ny, 4, ic, 0.85, C.Beam, 0);
  // 箭头：沿冲锋方向流动的人字纹
  const n = Math.max(2, Math.floor(h.len / 120));
  for (let i = 0; i < n; i++) {
    const k = ((i / n) + t * 0.9) % 1, cx = h.x + ux * h.len * k, cy = h.y + uy * h.len * k, s = h.w * 0.35;
    F.beam(cx - ux * s + nx * 0.6, cy - uy * s + ny * 0.6, cx, cy, 3, WHITE, 0.4 * Math.sin(k * Math.PI));
    F.beam(cx - ux * s - nx * 0.6, cy - uy * s - ny * 0.6, cx, cy, 3, WHITE, 0.4 * Math.sin(k * Math.PI));
  }
  if (h.big) F.glow(h.x, h.y, h.w * 1.5, wc, 0.25 + 0.3 * end);
  flair(F, h, h.x + ux * h.len * Math.random() * u, h.y + uy * h.len * Math.random() * u, h.w * 0.4, u, dt);
}

export function drawFoeGL(F: FxSys, c: Combat, t: number, dt: number) {
  for (const h of c.foe.hz) {
    if (!h.fired) {
      if (h.k === 'circle') drawCircleWarn(F, h, t, dt);
      else if (h.k === 'cone') drawConeWarn(F, h, t, dt);
      else drawLineWarn(F, h, t, dt);
    } else {
      if (!(h as any)._bk) { (h as any)._bk = 1; bakeFoeFire(h); }
      if (h.pooling) drawPool(F, h, t, dt);
    }
  }
  const sh = (c as any).fxShock; if (sh) { F.shock(sh.x, sh.y, sh.r, 18, 0.6); (c as any).fxShock = null; }
  // 护体与狂暴
  for (const e of c.enemies) {
    if (e.dead) continue;
    const hy = e.y - (e.anim.flying ? 90 : e.def.kind === 'human' ? 60 : 45) - e.lift;
    if (e.guardT > 0) {
      const k = Math.min(1, e.guardT / 0.4), sz = 70 * (e.def.look?.size ?? 1) + 30;
      F.sprite(C.RingSoft, e.x, hy, sz * 2, sz * 2.3, 0, [1, 0.85, 0.45], 0.35 * k);
      F.sprite(C.Glow, e.x, hy, sz * 2.4, sz * 2.6, 0, [1, 0.8, 0.4], 0.12 * k);
      for (let i = 0; i < 6; i++) { const a = t * 1.2 + i / 6 * TAU; F.sprite(C.Seal, e.x + Math.cos(a) * sz, hy + Math.sin(a) * sz * 0.6, 20, 20, a, [1, 0.85, 0.5], 0.5 * k); }
    }
    if (e.rage > 0) {
      const cc: RGB = e.rage > 1 ? [1, 0.15, 0.1] : [1, 0.45, 0.15];
      F.glow(e.x, hy, 80 + 14 * Math.sin(t * 8), cc, 0.18 + 0.08 * e.rage);
      if (Math.random() < dt * 16 * e.rage) F.emit({ x: e.x + rnd(-40, 40), y: e.y - rnd(0, 80) - e.lift, vy: rnd(-140, -60), life: rnd(0.4, 0.7), s0: rnd(10, 18), s1: 3, c: cc, a: 0.6, cell: fireCell() });
    }
    if (e.lift > 0) F.ground(C.Disc, e.x, e.y, 40 + e.lift * 0.1, 0, [0, 0, 0], 0.25, 0, SQ);
  }
}
