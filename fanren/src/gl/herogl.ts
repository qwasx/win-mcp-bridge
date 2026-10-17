// 第二十八步：我方身上的特效——风雷翅（青紫雷翼）、雷遁 / 血遁残影光、护体剑盾（剑网）
import type { Combat } from '../world/combat';
import { FxSys, col, mixc, RGB, fireCell, smokeCell } from './fx';
import { C } from './atlas';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const BLUE: RGB = [0.55, 0.66, 1], VIOLET: RGB = [0.72, 0.52, 1], WHITE: RGB = [1, 1, 1];

/** 一侧雷翼：翼骨（肩→肘→腕）+ 沿骨垂下的翎羽；墨蓝底色压住亮地，加色勾边与雷丝 */
function wing(F: FxSys, x: number, y: number, side: number, open: number, flap: number, t: number, a: number, ws = 1) {
  const sc = (0.55 + 0.45 * open) * ws, lift = -flap * 0.5;           // 振翅：整翼绕肩上下摆
  const rot = (dx: number, dy: number): [number, number] => { const c = Math.cos(lift * side), s = Math.sin(lift * side); return [x + (dx * c - dy * s) * sc, y + (dx * s + dy * c) * sc]; };
  const S = rot(0, 0), E = rot(side * 80, -46), W = rot(side * 175, -92);
  const N = 12, tips: [number, number][] = [];
  const INK: RGB = [0.1, 0.12, 0.38], EDGE = mixc(BLUE, VIOLET, 0.35);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
    const k = i / (N - 1);                                     // 0 = 腕（初级飞羽）… 1 = 肩（次级飞羽）
    const R = k < 0.5 ? [W[0] + (E[0] - W[0]) * k * 2, W[1] + (E[1] - W[1]) * k * 2] : [E[0] + (S[0] - E[0]) * (k - 0.5) * 2, E[1] + (S[1] - E[1]) * (k - 0.5) * 2];
    const ang = (side > 0 ? 0 : Math.PI) + side * (-0.55 + k * 1.75 + lift * 0.6 + Math.sin(t * 6 + i) * 0.03);
    const len = (170 - k * 95) * sc * (0.75 + 0.25 * open);
    const tx = R[0] + Math.cos(ang) * len, ty = R[1] + Math.sin(ang) * len * 0.9;
    const mx = (R[0] + tx) / 2, my = (R[1] + ty) / 2, ra = Math.atan2(ty - R[1], tx - R[0]);
    if (pass === 0) { F.sprite(C.Leaf, mx, my, len * 1.1, (30 - k * 8) * ws, ra, INK, 0.38 * a, 0); continue; }
    tips.push([tx, ty]);
    const c = mixc(EDGE, VIOLET, k);
    F.sprite(C.Leaf, mx, my, len * 1.02, (22 - k * 6) * ws, ra, c, 0.3 * a);
    F.sprite(C.Blade, R[0] + (tx - R[0]) * 0.55, R[1] + (ty - R[1]) * 0.55, len * 0.9, 5 * ws, ra, mixc(c, WHITE, 0.3), 0.45 * a);
    if (k < 0.45) F.glow(tx, ty, 9 * ws, mixc(c, WHITE, 0.5), 0.55 * a, C.Star);
  }
  // 翼骨：雷鹏骨（墨底 + 青紫亮芯）
  const bc = mixc(VIOLET, WHITE, 0.25);
  F.beam(S[0], S[1], E[0], E[1], 11 * ws, INK, 0.6 * a, C.Beam, 0); F.beam(E[0], E[1], W[0], W[1], 9 * ws, INK, 0.6 * a, C.Beam, 0);
  F.beam(S[0], S[1], E[0], E[1], 5 * ws, bc, 0.8 * a); F.beam(E[0], E[1], W[0], W[1], 4 * ws, bc, 0.8 * a);
  F.glow(W[0], W[1], 16 * ws, mixc(BLUE, WHITE, 0.5), 0.7 * a, C.Star);
  // 翼缘雷丝
  for (let i = 0; i < 5; i++) if (Math.random() < 0.5) F.bolt(tips[i][0], tips[i][1], tips[i + 1][0], tips[i + 1][1], Math.random() * 1e6, 10, 1.1, mixc(BLUE, WHITE, 0.3), 0.85 * a, 4, false);
  if (Math.random() < 0.25) F.bolt(S[0], S[1], W[0], W[1], Math.random() * 1e6, 14, 1.2, mixc(VIOLET, WHITE, 0.3), 0.8 * a, 7, false);
  if (Math.random() < 0.15) { const tp = tips[Math.floor(Math.random() * 6)]; F.bolt(tp[0], tp[1], tp[0] + rnd(-40, 40), tp[1] + rnd(80, 180), Math.random() * 1e6, 18, 1.3, BLUE, 0.7 * a, 6, true); }
  F.glow(x + side * 110 * ws, y - 10, 140 * ws, mixc(BLUE, VIOLET, 0.5), 0.07 * a);
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
  // —— 风雷翅
  if (c.wing) {
    const w = c.wing, open = Math.min(1, (w.max - w.t) / 0.35) * Math.min(1, w.t / 0.4);
    const flap = w.flap > 0 ? Math.sin((0.6 - w.flap) / 0.6 * Math.PI * 3) : Math.sin(t * 7) * 0.35;
    const sx = p.x, sy = p.y - 98, ws = 1.45 + w.lv * 0.08;   // 第三十步：雷翼放大
    wing(F, sx, sy, 1, open, flap, t, open, ws);
    wing(F, sx, sy, -1, open, flap, t, open, ws);
    // 雷光护身、脚下风旋
    F.glow(sx, sy + 20, 60, BLUE, 0.16 * open);
    F.ground(C.RingSoft, p.x, p.y, 110, t * 3, BLUE, 0.3 * open, 1, 0.5);
    if (Math.random() < dt * 14) F.emit({ x: p.x + rnd(-40, 40), y: p.y - rnd(0, 120), vx: rnd(-40, 40), vy: rnd(-90, -30), life: rnd(0.3, 0.5), s0: 3, s1: 1, c: mixc(BLUE, WHITE, 0.5), cell: C.Glow });
    // 振翅一扇：风雷气浪
    if (w.flap > 0.55) { F.shockRing(p.x, p.y, 480, BLUE, 0.45, 0.6, 1); F.shockRing(p.x, p.y, 330, VIOLET, 0.35, 0.6, 0.8); for (let i = 0; i < 12; i++) { const a = Math.random() * TAU; F.bolt(p.x, p.y - 60, p.x + Math.cos(a) * 400, p.y - 60 + Math.sin(a) * 240, Math.random() * 1e6, 22, 1.6, BLUE, 0.9, 8, true); } }
  }
  // —— 残影光：雷遁蓝、血遁红
  for (const g of c.ghosts) {
    if (g.t < 0) continue;
    const k = 1 - g.t / g.dur, cc = col(g.color);
    F.sprite(C.Glow, g.x, g.y - 60, 70, 150, 0, cc, 0.22 * k);
    if (g.color.startsWith('170') && Math.random() < 0.25) F.bolt(g.x + rnd(-20, 20), g.y - rnd(20, 120), g.x + rnd(-30, 30), g.y - rnd(0, 120), Math.random() * 1e6, 10, 1, cc, 0.7 * k, 4, false);
    if (!g.color.startsWith('170') && Math.random() < 0.3) F.emit({ x: g.x + rnd(-14, 14), y: g.y - rnd(20, 110), vy: rnd(10, 40), life: 0.5, s0: rnd(8, 14), s1: 20, c: [0.5, 0.03, 0.05], a: 0.35, add: 0, cell: smokeCell() });
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
