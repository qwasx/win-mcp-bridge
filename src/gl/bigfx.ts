// 第 6 阶段：大场面特效（天劫雷、灵气漩涡、光柱冲天、水墨冲击波、法相、剑阵阵图、金莲、天雷法印）
// 请求来自 world/vfxhook.ts 的 bigfx()（逻辑层调用，不依赖 WebGL）；这里每帧取走、逐个演出。
// 限流：同时最多 5 个场面、同类最多 2 个；粒子量随负载系数（vfxPressure）自动减少。
import { BIGFX_Q, BigFxReq, BigFxKind, bigfx } from '../world/vfxhook';
import { K } from './fxbake';
import { FxSys, RGB, col, mixc, smokeCell } from './fx';
import { C } from './atlas';
import { decal, inkSplat } from './bakefx';
import { bp, vfxPressure, setBigfxPush } from './vfxlib';

setBigfxPush((k, o) => bigfx(k, o));

const TAU = Math.PI * 2, SQ = 0.55;
const WHITE: RGB = [1, 1, 1], INK: RGB = [0.06, 0.05, 0.05];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

interface Scene { k: BigFxKind; x: number; y: number; r: number; dur: number; t: number; c: RGB; c2: RGB; power: number; follow?: BigFxReq['follow']; seed: number; ending: number; fired: number }
const DEF: Record<BigFxKind, { r: number; dur: number; c: string; c2: string }> = {
  tribulation: { r: 160, dur: 2.8, c: '200,190,255', c2: '255,255,255' },
  vortex: { r: 220, dur: 2.6, c: '150,230,255', c2: '255,255,255' },
  pillar: { r: 90, dur: 2.2, c: '255,236,190', c2: '255,255,255' },
  inkshock: { r: 280, dur: 1.5, c: '20,18,18', c2: '240,235,220' },
  dharma: { r: 1, dur: 20, c: '255,205,100', c2: '255,250,220' },
  swordArray: { r: 300, dur: 6, c: '255,215,110', c2: '170,255,210' },
  lotus: { r: 130, dur: 3, c: '255,200,120', c2: '255,250,230' },
  heavenSeal: { r: 120, dur: 1.1, c: '255,215,90', c2: '255,255,230' },
};
const S: Scene[] = [];
export const bigfxCount = () => S.length;

function take() {
  while (BIGFX_Q.length) {
    const q = BIGFX_Q.shift()!, d = DEF[q.kind]; if (!d) continue;
    const same = S.filter((s) => s.k === q.kind);
    if (same.length >= 2) { const o = same[0]; S.splice(S.indexOf(o), 1); }
    if (S.length >= 5) S.shift();
    S.push({ k: q.kind, x: q.x, y: q.y, r: q.r ?? d.r, dur: q.dur ?? d.dur, t: 0, c: col(q.color ?? d.c), c2: col(q.color2 ?? d.c2), power: clamp(q.power ?? 1, 0.5, 3), follow: q.follow, seed: Math.random() * 1000, ending: -1, fired: 0 });
  }
}

/** 每帧：取请求、演出（在 combatgl 里调用） */
export function drawBigFx(F: FxSys, t: number, dt: number) {
  take();
  const PRx = vfxPressure();
  for (let i = S.length - 1; i >= 0; i--) {
    const s = S[i]; s.t += dt;
    if (s.follow) { const p = s.follow(); if (p) { s.x = p.x; s.y = p.y; } else if (s.ending < 0) s.ending = s.t; }
    const endA = s.ending >= 0 ? 1 - (s.t - s.ending) / 0.6 : 1;
    if (s.t >= s.dur || endA <= 0) { S.splice(i, 1); continue; }
    const u = s.t / s.dur;
    const fade = Math.min(1, s.t / 0.25) * Math.min(1, (s.dur - s.t) / 0.5) * clamp(endA, 0, 1);
    SCENE[s.k](F, s, u, fade, t, dt, PRx);
  }
}
export function clearBigFx() { S.length = 0; BIGFX_Q.length = 0; }

type Fn = (F: FxSys, s: Scene, u: number, a: number, t: number, dt: number, pr: number) => void;
const SCENE: Record<BigFxKind, Fn> = {
  // ———— 天劫雷：劫云压顶，数道粗雷连劈
  tribulation(F, s, u, a, t, dt, pr) {
    const cy = s.y - 640, R = s.r;
    F.bk(K.Vortex, s.x, cy, R * 5.2, R * 1.9, t * 0.8 + s.seed, mixc(s.c, INK, 0.75), 0.75 * a, 0);
    F.bk(K.Mist, s.x - R, cy + 10, R * 3.6, R * 1.6, t * 0.2, INK, 0.5 * a, 0);
    F.bk(K.Mist, s.x + R, cy - 10, R * 3.6, R * 1.6, -t * 0.25, INK, 0.5 * a, 0);
    F.bk(K.Vortex, s.x, cy, R * 3, R * 1.1, t * 1.6, s.c, 0.25 * a * (0.6 + 0.4 * Math.sin(t * 13)), 1);
    F.bkG(K.ThunderSeal, s.x, s.y, R * 1.3, t * 0.5, s.c, 0.5 * a, 1, SQ);
    const n = Math.round(3 + s.power * 2), gap = (s.dur - 0.7) / n;
    for (let i = 0; i < n; i++) {
      const t0 = 0.35 + i * gap, lt = s.t - t0; if (lt < 0 || lt > 0.4) continue;
      const x = s.x + (i === n - 1 ? 0 : Math.sin(i * 7.7 + s.seed) * R * 0.5), y = s.y + (i === n - 1 ? 0 : Math.cos(i * 3.3 + s.seed) * R * 0.2);
      const fl = (lt < 0.08 ? 1 : (Math.floor(lt * 30) % 2 ? 0.45 : 1)) * (1 - lt / 0.4);
      const w = (i === n - 1 ? 1.6 : 1) * (0.8 + 0.3 * s.power);
      F.bk(K.ForkV, x + 15, (cy + y) / 2, 260 * w, y - cy + 40, 0, mixc(s.c, WHITE, 0.5), fl);
      F.bolt(x + 30, cy + 40, x, y, s.seed + i * 131 + Math.floor(lt * 24) * 7, 90, 9 * w, s.c, fl, 16, true);
      F.beam(x, y, x, cy, 120 * w * (1 - lt / 0.4), s.c, 0.3 * fl);
      if (!(s.fired & (1 << i))) {
        s.fired |= 1 << i;
        F.explode(x, y, 80 * w, s.c, { smoke: true, shock: true });
        decal(K.ElecRing0, x, y, 40, 200 * w, 0.6, mixc(s.c, WHITE, 0.3), 1, { sq: SQ, vr: 3 });
        decal(K.Crack, x, y, 60 * w, 150 * w, 3, INK, 0.6, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 8 });
        decal(K.Pillar, x, y - 380, 80 * w, 140 * w, 0.35, WHITE, 0.9, { h: 5.5 });
        F.shock(x, y, 500 * w, 22, 0.6); F.rays(x, y - 60, 380 * w, s.c, 0.4, 0.35);
        for (let k = 0; k < 16 * pr; k++) bp(K.Spark0, x, y - 20, { vx: rnd(-420, 420), vy: rnd(-420, -60), life: rnd(0.3, 0.6), s0: rnd(16, 30), s1: 4, c: mixc(s.c, WHITE, 0.5), grav: 900 });
      }
    }
    if (Math.random() < dt * 6) F.glow(s.x + rnd(-R * 2, R * 2), cy + rnd(-30, 30), R * 1.2, s.c, 0.35 * a);
  },
  // ———— 灵气漩涡：地面螺旋，灵光向心收拢
  vortex(F, s, u, a, t, dt, pr) {
    const R = s.r * (0.8 + 0.2 * Math.sin(t * 2));
    F.bkG(K.Vortex, s.x, s.y, R * 1.2, t * 2.2, s.c, 0.55 * a, 1, SQ);
    F.bkG(K.Vortex, s.x, s.y, R * 0.8, -t * 3.1, s.c2, 0.3 * a, 1, SQ);
    F.bkG(K.Ripple, s.x, s.y, R * (1.3 - ((t * 0.7) % 1) * 0.9), 0, s.c, 0.5 * a, 1, SQ);
    F.glow(s.x, s.y - 50, 40 + 90 * u, s.c2, 0.4 * a);
    for (let i = Math.round(dt * 70 * pr + Math.random()); i > 0; i--) {
      const an = Math.random() * TAU, d = R * rnd(1.1, 1.6), x = s.x + Math.cos(an) * d, y = s.y + Math.sin(an) * d * SQ - rnd(0, 120);
      const tx = s.x - x, ty = s.y - 50 - y;
      F.emit({ x, y, vx: tx * 1.4 - Math.sin(an) * 160, vy: ty * 1.4 + Math.cos(an) * 80, life: 0.7, s0: rnd(4, 8), s1: 1, c: mixc(s.c, WHITE, Math.random() * 0.5), drag: 1.2, cell: C.Star, rot: an });
    }
  },
  // ———— 光柱冲天
  pillar(F, s, u, a, t, dt, pr) {
    const H = s.r * 10, W = s.r * 2.2, gr = Math.min(1, s.t / 0.35);
    F.bk(K.Pillar, s.x, s.y - H * 0.5 * gr, W, H * gr, 0, s.c, 0.85 * a);
    F.bk(K.Pillar, s.x, s.y - H * 0.5 * gr, W * 0.45, H * gr, 0, s.c2, 0.9 * a);
    F.beam(s.x, s.y, s.x, s.y - H * gr, W * 0.7, s.c, 0.25 * a);
    F.bkG(K.Aureole, s.x, s.y, s.r * 2.6, t * 0.4, s.c, 0.45 * a, 1, SQ);
    F.bkG(K.RingThin, s.x, s.y, s.r * (1.4 + 0.3 * Math.sin(t * 4)), 0, s.c2, 0.7 * a, 1, SQ);
    if (s.fired === 0) { s.fired = 1; decal(K.Ripple, s.x, s.y, s.r, s.r * 4, 1, s.c, 0.9, { sq: SQ }); F.shock(s.x, s.y, s.r * 5, 16, 0.6); F.rays(s.x, s.y - 80, s.r * 4, s.c, 0.4, 0.4); }
    for (let i = Math.round(dt * 40 * pr + Math.random()); i > 0; i--) F.emit({ x: s.x + rnd(-W, W) * 0.4, y: s.y - rnd(0, 60), vy: rnd(-520, -260), vx: rnd(-20, 20), life: rnd(0.6, 1.1), s0: rnd(5, 9), s1: 1, c: mixc(s.c, WHITE, 0.4), cell: C.Star });
  },
  // ———— 水墨冲击波：三重飞白墨环
  inkshock(F, s, u, a, t, dt, pr) {
    if (s.fired === 0) {
      s.fired = 1;
      for (let i = 0; i < 3; i++) decal(K.InkRing, s.x, s.y, s.r * 0.15, s.r * (1 + i * 0.35), 0.9 + i * 0.25, mixc(s.c, INK, 0.5), 0.85 - i * 0.2, { add: 0, sq: SQ, rot: i * 1.7 + Math.random(), ease: 3 });
      decal(K.RingThin, s.x, s.y, s.r * 0.2, s.r * 1.25, 0.6, s.c2, 0.6, { sq: SQ });
      inkSplat(s.x, s.y, s.r * 0.7, 0.55, mixc(s.c, INK, 0.5), 2.2);
      F.shock(s.x, s.y, s.r * 3, 24, 0.7);
      for (let i = 0; i < 26 * pr; i++) { const an = Math.random() * TAU, v = rnd(250, 650); bp(K.Drop, s.x, s.y - 20, { vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.6 - 120, life: rnd(0.5, 0.9), s0: rnd(10, 22), s1: 6, rot: an, c: mixc(s.c, INK, 0.5), add: 0, grav: 700, h: 0.6 }); }
      for (let i = 0; i < 10 * pr; i++) { const an = Math.random() * TAU; F.emit({ x: s.x + Math.cos(an) * s.r * 0.3, y: s.y + Math.sin(an) * s.r * 0.15, vx: Math.cos(an) * 500, vy: Math.sin(an) * 260, life: rnd(0.7, 1.2), s0: 60, s1: 160, c: mixc(s.c, INK, 0.5), a: 0.35, add: 0, drag: 2.5, cell: smokeCell(), rot: Math.random() * TAU }); }
    }
    void u; void a; void t; void dt;
  },
  // ———— 法相：身后显化金身（随身，增益结束时淡去）
  dharma(F, s, u, a, t, dt, pr) {
    const sc = s.r, H = 520 * sc, br = 0.85 + 0.15 * Math.sin(t * 2.4), y0 = s.y - H * 0.42;
    F.bk(K.Aureole, s.x, y0, H * 1.25, H * 1.25, t * 0.15, s.c, 0.3 * a * br);
    F.bk(K.Dharma, s.x, y0, H, H, 0, s.c, 0.42 * a * br);
    F.bk(K.Dharma, s.x, y0, H * 1.03, H * 1.03, 0, s.c2, 0.12 * a);
    F.bkG(K.Lotus, s.x, s.y + 6, 120 * sc, t * 0.3, s.c, 0.55 * a, 1, SQ);
    F.glow(s.x, y0 + H * 0.12, H * 0.45, s.c, 0.12 * a);
    for (let i = Math.round(dt * 14 * pr + Math.random() * 0.6); i > 0; i--) F.emit({ x: s.x + rnd(-H * 0.4, H * 0.4), y: s.y - rnd(0, H * 0.6), vy: rnd(-90, -40), life: rnd(0.8, 1.4), s0: rnd(4, 7), s1: 1, c: mixc(s.c, WHITE, 0.4), cell: C.Star });
    void u;
  },
  // ———— 剑阵阵图（大庚剑阵叠层）
  swordArray(F, s, u, a, t, dt, pr) {
    const R = s.r, form = Math.min(1, s.t / 1.2);
    F.bkG(K.RuneRing, s.x, s.y, R * 1.08 * form, t * 0.25, s.c, 0.6 * a, 1, SQ);
    F.bkG(K.ThunderSeal, s.x, s.y, R * 0.78 * form, -t * 0.35, s.c, 0.4 * a, 1, SQ);
    F.bkG(K.StarField, s.x, s.y, R * 0.95, t * 0.1, s.c2, 0.45 * a * form, 1, SQ);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU + t * 0.25, x = s.x + Math.cos(an) * R * 1.05, y = s.y + Math.sin(an) * R * 0.58;
      F.bk(K.Pillar, x, y - 160 * form, 50, 340 * form, 0, i % 2 ? s.c : s.c2, 0.32 * a);
      F.bk(K.Sword, x, y - 70 - 8 * Math.sin(t * 3 + i), 110, 110, Math.PI / 2, mixc(s.c, WHITE, 0.4), 0.85 * a * form);
    }
    if (Math.random() < dt * 10 * pr) { const an = Math.random() * TAU; bp(K.Star4, s.x + Math.cos(an) * R, s.y + Math.sin(an) * R * 0.55 - 60, { vy: -80, life: 0.8, s0: 26, s1: 6, c: s.c2, a: 0.9 }); }
    void u;
  },
  // ———— 金莲：脚下巨莲绽开
  lotus(F, s, u, a, t, dt, pr) {
    const op = 1 - Math.pow(1 - Math.min(1, s.t / 0.6), 3);
    F.bkG(K.Lotus, s.x, s.y, s.r * (0.4 + 0.6 * op), t * 0.2, s.c, 0.8 * a, 1, SQ);
    F.bkG(K.FireLotus, s.x, s.y, s.r * 1.25 * op, -t * 0.3, s.c, 0.35 * a, 1, SQ);
    F.bk(K.Aureole, s.x, s.y - 70, s.r * 2.2 * op, s.r * 2.2 * op, t * 0.2, s.c2, 0.25 * a);
    if (Math.random() < dt * 8 * pr) bp(K.PetalH, s.x + rnd(-s.r, s.r) * 0.6, s.y - rnd(0, 30), { vy: rnd(-70, -30), vx: rnd(-20, 20), life: 1.2, s0: 16, s1: 8, rot: Math.random() * TAU, vr: 2, c: s.c, a: 0.9 });
    void u;
  },
  // ———— 天雷法印：篆印自空中压下，落地金光
  heavenSeal(F, s, u, a, t, dt, pr) {
    const fall = Math.min(1, u / 0.45), y = s.y - 320 * (1 - fall * fall) - 40;
    F.bk(K.Glyph, s.x, y, s.r * (0.6 + 0.6 * fall), s.r * (0.6 + 0.6 * fall), t * 1.5, s.c, 0.9 * a);
    F.bk(K.Pillar, s.x, s.y - 300, s.r * 0.9, 640, 0, s.c, 0.45 * a);
    if (fall >= 1 && !s.fired) { s.fired = 1; decal(K.RuneRing, s.x, s.y, s.r * 0.6, s.r * 1.5, 0.9, s.c, 0.9, { sq: SQ, vr: 1 }); decal(K.Stamp, s.x, s.y - 30, s.r * 0.3, s.r * 0.8, 0.5, s.c2, 0.9); F.shock(s.x, s.y, s.r * 3, 14, 0.5); F.rays(s.x, s.y - 40, s.r * 2.5, s.c, 0.4, 0.3); for (let i = 0; i < 10 * pr; i++) bp(K.Star4, s.x, s.y - 30, { vx: rnd(-260, 260), vy: rnd(-300, -60), life: 0.6, s0: 18, s1: 4, c: s.c2, grav: 500 }); }
    void dt;
  },
};
