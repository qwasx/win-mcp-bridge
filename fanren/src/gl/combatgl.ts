// 战斗特效（WebGL）：弹道、法术、领域、护盾、受击。读取 Combat 的状态绘制，并在新特效出现时触发粒子爆发。
import type { Combat } from '../world/combat';
import { FxSys, col, mixc, RGB } from './fx';
import { C } from './atlas';
import { enemyVis } from '../world/combatfx';

const TAU = Math.PI * 2;
const WHITE: RGB = [1, 1, 1];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const FIRE: RGB = [1, 0.55, 0.18];
const SMOKE: RGB = [0.13, 0.11, 0.1];

/** 每秒发射 rate 个：返回本帧数量（带随机余数） */
const nEmit = (rate: number, dt: number) => { const f = rate * dt; return Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); };

export interface FxEvent { k: 'hit' | 'kill' | 'phit' | 'cast' | 'block' | 'dodge'; x: number; y: number; color?: string; power?: number; crit?: boolean; dir?: number; big?: boolean }

export function drawCombatGL(F: FxSys, c: Combat, t: number, dt: number) {
  const p = c.game.player;
  // ---- 事件（命中/击杀/受伤）
  for (const ev of c.fxq) {
    const cc = col(ev.color ?? '255,236,200');
    if (ev.k === 'hit') F.hit(ev.x, ev.y, cc, ev.power ?? 1, ev.crit, ev.dir);
    else if (ev.k === 'kill') {
      F.explode(ev.x, ev.y, 46, cc, { smoke: true, shock: true });
      F.ink(ev.x, ev.y + 30, 120, 0.45);
      for (let i = 0; i < 18; i++) F.emit({ x: ev.x + rnd(-20, 20), y: ev.y + rnd(-30, 20), vx: rnd(-30, 30), vy: rnd(-120, -40), life: rnd(0.8, 1.6), s0: rnd(4, 8), s1: 1, c: mixc(cc, WHITE, 0.4), drag: 1, grav: -30, cell: C.Glow });
    } else if (ev.k === 'phit') {
      F.flash(ev.x, ev.y, ev.big ? 50 : 30, [1, 0.25, 0.2], 0.15);
      F.sparks(ev.x, ev.y, [1, 0.35, 0.3], ev.big ? 16 : 8, 300, 0.35, 3);
      F.ink(ev.x, ev.y + 10, ev.big ? 90 : 60, 0.4, [0.35, 0.03, 0.03]);
    } else if (ev.k === 'block') { F.flash(ev.x, ev.y, 34, cc, 0.12); F.shockRing(ev.x, ev.y, 60, cc, 0.3, 0.9); }
    else if (ev.k === 'dodge') { for (let i = 0; i < 10; i++) F.emit({ x: ev.x + rnd(-14, 14), y: ev.y - rnd(10, 90), vx: rnd(-40, 40), vy: rnd(-20, 10), life: rnd(0.3, 0.55), s0: rnd(16, 30), s1: 4, c: [0.75, 0.9, 1], a: 0.5, cell: C.Wisp, rot: 0 }); }
    else if (ev.k === 'cast') { F.flash(ev.x, ev.y, 26, cc, 0.18); F.shockRing(ev.x, ev.y + 40, 70, cc, 0.35); }
  }
  c.fxq.length = 0;

  // ---- 领域（地面）
  for (const f of c.fields) drawField(F, f, t, dt);

  // ---- 敌人蓄力预警、受击白闪
  for (const e of c.enemies) {
    if (e.dead) continue;
    const vis = enemyVis(c, e);
    if (vis <= 0.02) continue;
    if (e.windup > 0) {
      const u = 1 - e.windup / 0.4;
      F.ground(C.Disc, e.x, e.y, 70 * u, 0, [0.9, 0.12, 0.08], 0.22 * vis, 0.5, 0.42);
      F.ground(C.Ring, e.x, e.y, 72, 0, [1, 0.2, 0.12], (0.5 + 0.4 * u) * vis, 1, 0.42);
    }
    if (e.hitFlash > 0) {
      const k = e.hitFlash / 0.12;
      const hy = e.y - (e.def.kind === 'human' ? 70 : e.anim.flying ? 80 : 40);
      F.glow(e.x, hy, 46 * (e.def.look?.size ?? 1), WHITE, 0.55 * k * vis);
    }
    if (e.def.evil && vis > 0.1) F.glow(e.x, e.y - 50, 60, [0.8, 0.1, 0.15], 0.25 * vis);
    if (e.st.burn && Math.random() < dt * 14) F.emit({ x: e.x + rnd(-18, 18), y: e.y - rnd(10, 70), vx: rnd(-10, 10), vy: rnd(-90, -50), life: rnd(0.3, 0.6), s0: rnd(14, 24), s1: 4, c: FIRE, cell: C.Flame, a: 0.8 });
    if (e.st.poison && Math.random() < dt * 8) F.emit({ x: e.x + rnd(-18, 18), y: e.y - rnd(10, 60), vy: rnd(-40, -20), life: rnd(0.5, 0.9), s0: rnd(12, 20), s1: 26, c: [0.35, 0.7, 0.15], cell: C.Smoke, a: 0.35, add: 0.5 });
    if (e.st.shock && Math.random() < dt * 10) { const a = Math.random() * TAU; F.bolt(e.x + Math.cos(a) * 30, e.y - 60 + Math.sin(a) * 30, e.x, e.y - 50, Math.random() * 1e6, 10, 1.6, [0.7, 0.75, 1], 0.9, 4, false); }
    if (e.st.freeze) { F.sprite(C.Shard, e.x - 16, e.y - 30, 50, 22, -1.9, [0.75, 0.9, 1], 0.55, 0.5); F.sprite(C.Shard, e.x + 18, e.y - 40, 60, 24, -1.2, [0.75, 0.9, 1], 0.55, 0.5); F.glow(e.x, e.y - 40, 50, [0.6, 0.85, 1], 0.3); }
  }

  // ---- 法术特效
  for (const v of c.vfx as any[]) {
    if (!v._seen) { v._seen = 1; spawnVfx(F, v); }
    drawVfx(F, v, t);
  }
  // ---- 弹道
  for (const pr of c.projs as any[]) {
    if (!pr._seen) { pr._seen = 1; const cc = col(pr.color); if (pr.fac === 'p') F.flash(pr.x, pr.y, 16 * (pr.size ?? 1), cc, 0.12); }
    drawProj(F, pr, t, dt);
  }
  // ---- 噬金虫
  for (const s of c.summons) if (s.kind === 'bugs' && s.dots) {
    for (const d of s.dots) { const a = d.a + t * d.s; const x = s.x + Math.cos(a) * d.r, y = s.y - 40 + Math.sin(a * 1.3) * d.r * 0.6; F.glow(x, y, 6, [1, 0.85, 0.35], 0.9, C.Dot); F.glow(x, y, 12, [1, 0.75, 0.3], 0.35); }
    F.glow(s.x, s.y - 40, 50, [1, 0.8, 0.35], 0.25);
  }
  // ---- 护体剑盾
  if (c.orbit) {
    const o = c.orbit, cc = col(o.color);
    for (let i = 0; i < o.n; i++) {
      const an = t * 3.2 + (i / o.n) * TAU;
      const x = p.x + Math.cos(an) * o.r, y = p.y - 40 + Math.sin(an) * o.r * 0.5;
      const pts: [number, number][] = [];
      for (let k = 6; k >= 0; k--) { const a2 = an - k * 0.09; pts.push([p.x + Math.cos(a2) * o.r, p.y - 40 + Math.sin(a2) * o.r * 0.5]); }
      F.trail(pts, 10, cc, 0.5);
      F.sprite(C.Blade, x, y, 50, 14, an + Math.PI / 2, mixc(cc, WHITE, 0.5), 0.95);
      F.glow(x, y, 20, cc, 0.5);
    }
  }
  // ---- 护盾
  if (c.shield) {
    const s = c.shield, k = s.amt / s.max, cc = col(s.color);
    const pul = 0.85 + 0.15 * Math.sin(t * 4);
    F.sprite(C.RingSoft, p.x, p.y - 50, 140, 166, 0, cc, (0.45 + 0.35 * k) * pul);
    F.sprite(C.Glow, p.x, p.y - 50, 170, 190, 0, cc, 0.18 + 0.1 * k);
    F.sprite(C.Ring, p.x, p.y - 50, 132, 156, 0, WHITE, 0.35 * k);
    if (s.fx === 'frost' || s.fx === 'vine' || s.fx === 'gold') for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.5; F.sprite(s.fx === 'frost' ? C.Shard : s.fx === 'vine' ? C.Leaf : C.Seal, p.x + Math.cos(a) * 64, p.y - 50 + Math.sin(a) * 76, 22, 12, a, cc, 0.7); }
  }
  // ---- 增益
  const b = c.buffs;
  if (b.atk || b.def || b.speed) {
    const cc: RGB = b.atk ? [1, 0.78, 0.35] : b.def ? [0.94, 0.82, 0.47] : [0.75, 0.9, 1];
    for (let i = 0; i < 2; i++) { const k = (t * 0.8 + i * 0.5) % 1; F.ring(p.x, p.y - k * 100, 42 * (1 - k * 0.3), cc, (1 - k) * 0.55, 0.3); }
    if (Math.random() < dt * 10) F.emit({ x: p.x + rnd(-24, 24), y: p.y - rnd(0, 20), vy: rnd(-90, -50), life: rnd(0.6, 1), s0: 5, s1: 1, c: cc, cell: C.Glow });
  }
  // ---- 旧式火花（来自战斗逻辑）
  for (const s of c.sparks) { const k = 1 - s.t / s.max; F.glow(s.x, s.y, (s.size * k + 0.6) * 2.2, col(s.color), 0.75 * k); }
  // ---- 冲刺残影
  if (c.dash) {
    const cc = col(c.dash.color);
    for (let i = 0; i < 2; i++) F.emit({ x: p.x + rnd(-8, 8), y: p.y - rnd(20, 80), vx: -c.dash.vx * 0.15, vy: -c.dash.vy * 0.15, life: 0.3, s0: 26, s1: 6, c: cc, a: 0.45, cell: C.Wisp, rot: Math.atan2(c.dash.vy, c.dash.vx) });
  }
}

// ------------------------------------------------------------------ 弹道
function drawProj(F: FxSys, pr: any, t: number, dt: number) {
  const s = pr.size ?? 1, cc = col(pr.color), fx = pr.fx as string;
  const ang = Math.atan2(pr.vy, pr.vx);
  const tr = pr.trail as [number, number][];
  const head: [number, number][] = tr.length ? [...tr, [pr.x, pr.y]] : [[pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02], [pr.x, pr.y]];
  switch (fx) {
    case 'fireball': case 'flame': case 'talisman': case 'icefire': default: {
      const fire = fx === 'fireball' || fx === 'flame' || pr.school === '火';
      F.trail(head, 26 * s, cc, 0.55);
      F.trail(head, 9 * s, mixc(cc, WHITE, 0.6), 0.8);
      F.orb(pr.x, pr.y, 13 * s, cc);
      if (fx === 'talisman' && pr.life < 0.15) F.sprite(C.Talisman, pr.x, pr.y, 20, 40, ang + Math.PI / 2, [0.95, 0.82, 0.4], 0.9, 0.2);
      for (let i = nEmit(fire ? 60 : 30, dt); i > 0; i--) F.emit({ x: pr.x + rnd(-6, 6) * s, y: pr.y + rnd(-6, 6) * s, vx: -pr.vx * 0.08 + rnd(-30, 30), vy: -pr.vy * 0.08 + rnd(-60, -10), life: rnd(0.25, 0.5), s0: rnd(10, 18) * s, s1: 2, c: fire ? mixc(FIRE, cc, 0.5) : cc, cell: fire ? C.Flame : C.Glow, rot: 0, drag: 2 });
      if (fire && Math.random() < dt * 12) F.smoke(pr.x, pr.y, 1, SMOKE, 0.18, 4, 22 * s);
      break;
    }
    case 'blood': case 'gold': {
      F.trail(head, 22 * s, cc, 0.6);
      F.orb(pr.x, pr.y, 12 * s, cc);
      for (let i = nEmit(40, dt); i > 0; i--) F.emit({ x: pr.x, y: pr.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: rnd(0.2, 0.45), s0: rnd(4, 8), s1: 1, c: cc, cell: fx === 'gold' ? C.Star : C.Glow, rot: Math.random() * TAU });
      break;
    }
    case 'firesnake': case 'dragon': {
      const big = fx === 'dragon';
      const w = (big ? 44 : 22) * s;
      const wav: [number, number][] = head.map(([x, y], i) => { const k = i / head.length; const o = Math.sin(t * 14 - i * 0.9) * 8 * k; return [x - Math.sin(ang) * o, y + Math.cos(ang) * o]; });
      F.trail(wav, w * 1.6, cc, 0.45, C.Beam, 1, 0.8);
      F.trail(wav, w * 0.7, mixc(cc, WHITE, 0.5), 0.85, C.Beam, 1, 0.8);
      F.orb(pr.x, pr.y, (big ? 22 : 13) * s, cc);
      if (big) { F.sprite(C.Thorn, pr.x - Math.cos(ang) * 10 - 8, pr.y - 22, 10, 34, ang - 2.2, mixc(cc, WHITE, 0.6), 0.9); F.sprite(C.Thorn, pr.x - Math.cos(ang) * 10 + 8, pr.y - 22, 10, 34, ang - 1.9, mixc(cc, WHITE, 0.6), 0.9); }
      for (let i = nEmit(big ? 90 : 50, dt); i > 0; i--) { const j = Math.floor(Math.random() * wav.length); const [x, y] = wav[j]; F.emit({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-70, -20), life: rnd(0.25, 0.5), s0: rnd(10, 20) * s, s1: 2, c: big ? cc : mixc(FIRE, cc, 0.5), cell: big ? C.Glow : C.Flame }); }
      break;
    }
    case 'crow': {
      F.trail(head, 12, cc, 0.35);
      const f = Math.sin(t * 20 + pr.x * 0.1);
      F.sprite(C.Feather, pr.x, pr.y, 34, 30 + f * 10, ang, [0.12, 0.08, 0.1], 0.9, 0);
      F.glow(pr.x + Math.cos(ang) * 10, pr.y + Math.sin(ang) * 10, 8, cc, 0.9);
      F.glow(pr.x, pr.y, 26, cc, 0.35);
      if (Math.random() < dt * 14) F.emit({ x: pr.x, y: pr.y, vx: rnd(-30, 30), vy: rnd(10, 50), life: 0.7, s0: 10, s1: 6, c: [0.1, 0.08, 0.1], a: 0.7, add: 0, cell: C.Feather, rot: Math.random() * TAU, vr: rnd(-4, 4) });
      break;
    }
    case 'sword': case 'goldthunder': {
      const L = 64 * s;
      F.trail(head, 14 * s, cc, 0.5);
      F.trail(head, 4 * s, WHITE, 0.7);
      F.sprite(C.Blade, pr.x, pr.y, L, L * 0.26, ang, mixc(cc, WHITE, 0.45), 1);
      F.glow(pr.x, pr.y, 28 * s, cc, 0.55);
      if (fx === 'goldthunder' && Math.random() < dt * 18) { const a = Math.random() * TAU; F.bolt(pr.x, pr.y, pr.x + Math.cos(a) * 40, pr.y + Math.sin(a) * 40, Math.random() * 1e6, 10, 1.5, [1, 0.9, 0.5], 1, 4, false); }
      break;
    }
    case 'icicle': case 'needle': case 'mind': case 'leaf': {
      if (fx === 'needle') { F.trail(head, 3, cc, 0.7); F.sprite(C.Streak, pr.x, pr.y, 36, 6, ang, WHITE, 1); F.glow(pr.x, pr.y, 10, cc, 0.6); break; }
      if (fx === 'mind') { F.trail(head, 18, cc, 0.25); F.sprite(C.Slash, pr.x, pr.y, 40, 40, ang, cc, 0.5); F.glow(pr.x, pr.y, 20, cc, 0.3); break; }
      if (fx === 'leaf') { F.trail(head, 6, cc, 0.4); F.sprite(C.Leaf, pr.x, pr.y, 30 * s, 14 * s, ang + Math.sin(t * 20) * 0.3, cc, 0.95, 0.3); break; }
      F.trail(head, 12 * s, cc, 0.45);
      F.sprite(C.Shard, pr.x, pr.y, 46 * s, 16 * s, ang, mixc(cc, WHITE, 0.6), 1, 0.6);
      F.glow(pr.x, pr.y, 22 * s, cc, 0.5);
      if (Math.random() < dt * 30) F.emit({ x: pr.x, y: pr.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.5, s0: 5, s1: 1, c: [0.85, 0.95, 1], cell: C.Star, rot: Math.random() });
      break;
    }
    case 'wind': {
      for (let i = 0; i < 3; i++) F.sprite(C.Slash, pr.x - Math.cos(ang) * i * 14, pr.y - Math.sin(ang) * i * 14, 70 * s * (1 - i * 0.15), 70 * s * (1 - i * 0.15), ang, mixc(cc, WHITE, 0.3), 0.7 - i * 0.2);
      if (Math.random() < dt * 24) F.emit({ x: pr.x + rnd(-20, 20), y: pr.y + rnd(-20, 20), vx: pr.vx * 0.3, vy: pr.vy * 0.3, life: 0.35, s0: 30, s1: 10, c: cc, a: 0.4, cell: C.Wisp, rot: ang });
      break;
    }
    case 'tornado': case 'water': {
      const h = fx === 'water' ? 90 : 120;
      for (let i = 0; i < 7; i++) { const k = i / 7; F.sprite(C.Swirl, pr.x + Math.sin(t * 8 + i) * 6, pr.y + 30 - k * h, (30 + k * 60) * s, (10 + k * 20) * s, t * 6 + i, cc, 0.55 - k * 0.25, fx === 'water' ? 0.5 : 1); }
      F.glow(pr.x, pr.y - h * 0.4, 60 * s, cc, 0.25);
      if (Math.random() < dt * 20) F.emit({ x: pr.x + rnd(-30, 30), y: pr.y + rnd(-80, 20), vx: rnd(-80, 80), vy: rnd(-40, 0), life: 0.5, s0: 8, s1: 2, c: fx === 'water' ? [0.7, 0.85, 1] : [0.8, 0.8, 0.7], a: 0.6, cell: fx === 'water' ? C.Dot : C.Leaf, rot: Math.random() * TAU, vr: 6, add: fx === 'water' ? 0.6 : 0 });
      break;
    }
    case 'vine': {
      const wav: [number, number][] = head.map(([x, y], i) => [x, y + Math.sin(i * 1.4 + t * 10) * 6]);
      F.trail(wav, 10, [0.25, 0.5, 0.18], 0.9, C.Beam, 0, 0.3);
      F.trail(wav, 4, cc, 0.9);
      F.glow(pr.x, pr.y, 18, cc, 0.5);
      if (Math.random() < dt * 10) F.emit({ x: pr.x, y: pr.y, vx: rnd(-20, 20), vy: rnd(10, 40), life: 0.8, s0: 12, s1: 8, c: [0.35, 0.65, 0.25], a: 0.85, add: 0, cell: C.Leaf, rot: Math.random() * TAU, vr: 3 });
      break;
    }
    case 'ghost': {
      F.trail(head, 26, [0.2, 0.1, 0.25], 0.45, C.Beam, 0);
      F.glow(pr.x, pr.y, 24, cc, 0.7);
      F.sprite(C.Smoke, pr.x, pr.y, 46, 46, t * 2, [0.2, 0.12, 0.25], 0.55, 0);
      F.glow(pr.x - 5, pr.y - 3, 4, [1, 0.3, 0.3], 1, C.Dot); F.glow(pr.x + 5, pr.y - 3, 4, [1, 0.3, 0.3], 1, C.Dot);
      if (Math.random() < dt * 12) F.smoke(pr.x, pr.y, 1, [0.18, 0.1, 0.22], 0.3, 6, 26);
      break;
    }
    case 'rock': {
      F.sprite(C.Shard, pr.x, pr.y, 30 * s, 24 * s, t * 8, [0.45, 0.36, 0.25], 1, 0);
      if (Math.random() < dt * 14) F.smoke(pr.x, pr.y, 1, [0.45, 0.38, 0.28], 0.25, 4, 18);
      break;
    }
  }
}

// ------------------------------------------------------------------ 法术
function spawnVfx(F: FxSys, v: any) {
  const cc = col(v.color);
  switch (v.kind) {
    case 'flash': F.hit(v.x, v.y, cc, v.r > 80 ? 2 : 1, v.r > 80); break;
    case 'ring':
      F.shockRing(v.x, v.y, v.r, cc, Math.min(0.7, v.dur));
      F.sparks(v.x, v.y - 20, cc, 18, 200 + v.r, 0.5, 3);
      if (v.r > 120) F.shock(v.x, v.y, v.r * 1.6, 12, 0.5);
      if (v.fx === 'rock' || v.fx === 'palm') { F.ink(v.x, v.y, v.r * 1.1, 0.3, [0.25, 0.2, 0.15]); F.smoke(v.x, v.y, 8, [0.45, 0.38, 0.28], 0.3, v.r * 0.5, 60); }
      if (v.fx === 'flame' || v.fx === 'fireball') F.embers(v.x, v.y - 10, FIRE, 20, v.r * 0.6);
      break;
    case 'strike': {
      const fx = v.fx;
      if (fx === 'lightning' || fx === 'goldthunder') { F.explode(v.x, v.y, v.r * 0.5, cc, { smoke: false }); F.ink(v.x, v.y + 6, v.r * 1.2, 0.3); }
      else if (fx === 'flame') { F.explode(v.x, v.y, v.r, mixc(FIRE, cc, 0.4), { debris: true }); F.embers(v.x, v.y, FIRE, 24, v.r * 0.6); }
      else if (fx === 'rock') { F.explode(v.x, v.y, v.r * 0.8, [0.6, 0.48, 0.32], { debris: true, smoke: true }); }
      else if (fx === 'frost') { F.explode(v.x, v.y, v.r * 0.7, cc, { smoke: false }); for (let i = 0; i < 16; i++) F.emit({ x: v.x + rnd(-v.r, v.r) * 0.7, y: v.y + rnd(-v.r, v.r) * 0.35, vy: rnd(-30, -5), life: rnd(0.6, 1.1), s0: 7, s1: 2, c: [0.85, 0.95, 1], cell: C.Star, rot: Math.random() }); }
      else F.explode(v.x, v.y, v.r * 0.8, cc);
      break;
    }
    case 'beam': F.flash(v.x, v.y, 26, cc, 0.15); F.hit(v.x2, v.y2, cc, 1.2); break;
    case 'bigsword': F.shock(v.x2, v.y2, 260, 16, 0.6); break;
    case 'cone': {
      for (let i = 0; i < 26; i++) { const a = v.ang + rnd(-v.spread, v.spread), sp = rnd(200, 520); F.emit({ x: v.x, y: v.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.25, 0.5), s0: v.fx === 'flame' ? rnd(18, 34) : 6, s1: v.fx === 'flame' ? 40 : 2, c: v.fx === 'flame' ? mixc(FIRE, cc, 0.4) : cc, cell: v.fx === 'flame' ? C.Flame : C.Glow, drag: 3, stretch: v.fx === 'flame' ? 0 : 0.04 }); }
      break;
    }
    case 'aura': F.shockRing(v.x, v.y, v.r * 1.4, cc, 0.5, 0.45); for (let i = 0; i < 16; i++) F.emit({ x: v.x + rnd(-v.r, v.r) * 0.6, y: v.y + rnd(-10, 10), vy: rnd(-180, -70), life: rnd(0.5, 0.9), s0: rnd(4, 8), s1: 1, c: mixc(cc, WHITE, 0.3), cell: v.fx === 'leaf' ? C.Leaf : C.Glow, rot: Math.random() * TAU, drag: 1 }); break;
    case 'blinkfx': F.flash(v.x, v.y - 50, v.r * 0.7, cc, 0.2); for (let i = 0; i < 12; i++) F.emit({ x: v.x + rnd(-20, 20), y: v.y - rnd(0, 100), vx: rnd(-60, 60), vy: rnd(-60, 20), life: rnd(0.3, 0.6), s0: rnd(20, 36), s1: 4, c: cc, a: 0.5, cell: C.Wisp, rot: rnd(-0.3, 0.3) }); break;
  }
}

function drawVfx(F: FxSys, v: any, t: number) {
  const u = clamp(v.t / v.dur, 0, 1), a = 1 - u, cc = col(v.color);
  switch (v.kind) {
    case 'ring': {
      const r = v.r * (0.3 + 0.7 * (1 - Math.pow(1 - u, 2.5)));
      F.ground(C.Glow, v.x, v.y, r, 0, cc, 0.35 * a, 1, 0.55);
      if (v.fx === 'roar') for (let i = 1; i < 3; i++) F.ring(v.x, v.y, r * (1 - i * 0.22), cc, 0.5 * a, 0.55);
      if (v.fx === 'lightning' || v.fx === 'array' || v.fx === 'star') F.ground(C.Rune, v.x, v.y, r * 0.9, t * 2, cc, 0.6 * a, 1, 0.55);
      if (v.fx === 'rock' || v.fx === 'palm') F.ground(C.Crack, v.x, v.y, v.r * 0.8, v.x, [0.2, 0.15, 0.1], 0.6 * a, 0, 0.55);
      break;
    }
    case 'warn': {
      if (v.t < 0) break;
      F.ground(C.Ring, v.x, v.y, v.r, 0, cc, 0.85, 1, 0.55);
      F.ground(C.Disc, v.x, v.y, v.r * u, 0, cc, 0.22, 0.6, 0.55);
      F.ground(C.Rune, v.x, v.y, v.r * 0.95, t * 1.5, cc, 0.35, 1, 0.55);
      break;
    }
    case 'strike': {
      const fx = v.fx;
      if (fx === 'lightning' || fx === 'goldthunder') {
        const seed = v.seed + Math.floor(v.t * 24) * 13;
        const fl = u < 0.3 ? 1 : (Math.floor(v.t * 30) % 2 ? 0.4 : 0.9) * a;
        F.bolt(v.x + 40, v.y - 720, v.x, v.y, seed, 80, 7 * (1 - u * 0.5), cc, fl, 14);
        F.glow(v.x, v.y, v.r * 1.1, cc, 0.3 * a);
        F.ground(C.Crack, v.x, v.y, v.r * 0.8, v.seed, [0.15, 0.12, 0.1], 0.6 * a, 0, 0.5);
      } else if (fx === 'flame') {
        F.sprite(C.Beam, v.x, v.y - 160 * (1 - u), v.r * 0.9 * a, 340, Math.PI / 2, FIRE, 0.4 * a);
        F.glow(v.x, v.y, v.r * 1.4, FIRE, 0.5 * a);
        F.ground(C.FireRing, v.x, v.y, v.r * (0.8 + u * 0.3), t, FIRE, 0.7 * a, 1, 0.5);
      } else if (fx === 'frost' || fx === 'rock') {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const an = i / n * TAU + v.seed, r = v.r * 0.65;
          const x = v.x + Math.cos(an) * r * 0.8, y = v.y + Math.sin(an) * r * 0.4;
          const h = 70 * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5) * (1 - Math.max(0, u - 0.7) / 0.3);
          F.sprite(C.Thorn, x, y - h / 2, 22, h, (i % 3 - 1) * 0.2, fx === 'frost' ? [0.8, 0.93, 1] : [0.45, 0.36, 0.25], 0.9, fx === 'frost' ? 0.5 : 0);
        }
        F.ground(fx === 'frost' ? C.Glow : C.Crack, v.x, v.y, v.r, 0, fx === 'frost' ? cc : [0.2, 0.15, 0.1], 0.5 * a, fx === 'frost' ? 1 : 0, 0.5);
      } else if (fx === 'gold') {
        for (let i = 0; i < 3; i++) F.ring(v.x, v.y, v.r * (1 - u) * (1 - i * 0.25), cc, a, 0.5, false, u * 6 + i);
        F.glow(v.x, v.y, v.r, cc, 0.6 * a);
      } else F.glow(v.x, v.y, v.r, cc, 0.8 * a);
      break;
    }
    case 'chain': {
      const w = (v.w ?? 2) * 1.2;
      F.bolt(v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30) * 7, 26, w, cc, a, 9, false);
      F.glow(v.x2, v.y2, 26, cc, 0.6 * a);
      break;
    }
    case 'beam': {
      const w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.7);
      if (v.fx === 'magnet') { const cols: RGB[] = [[1, 0.35, 0.35], [1, 0.86, 0.35], [0.47, 0.86, 0.47], [0.47, 0.67, 1], [0.9, 0.9, 0.94]]; cols.forEach((c2, i) => { const o = (i - 2) * w * 0.3; F.beam(v.x, v.y + o, v.x2, v.y2 + o, w * 0.9, c2, 0.7 * a); }); break; }
      if (v.fx === 'rock') {
        const n = 10; for (let i = 1; i <= n; i++) { const k = i / n; if (k > u * 2.2) break; const x = v.x + (v.x2 - v.x) * k, y = v.y + 40 + (v.y2 + 30 - v.y - 40) * k; const h = 80 * Math.sin(Math.min(1, (u * 2.2 - k) * 3) * Math.PI * 0.5) * a; F.sprite(C.Thorn, x, y - h / 2, 26, h, 0, [0.45, 0.36, 0.25], 1, 0); }
        break;
      }
      F.beam(v.x, v.y, v.x2, v.y2, w * 4, cc, 0.55 * a);
      F.beam(v.x, v.y, v.x2, v.y2, w * 1.2, mixc(cc, WHITE, 0.8), 0.95 * a);
      F.glow(v.x, v.y, w * 2.5, cc, 0.7 * a);
      if (v.fx === 'goldthunder' || v.fx === 'icefire' || v.fx === 'lightning') F.bolt(v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30), w * 1.5, 1.8, cc, a, 14, false);
      break;
    }
    case 'bigsword': {
      const drop = Math.min(1, u * 3);
      const ang = Math.atan2(v.y2 - v.y, v.x2 - v.x);
      const len = Math.hypot(v.x2 - v.x, v.y2 - v.y);
      const mx = (v.x + v.x2) / 2, my = (v.y + v.y2) / 2;
      F.sprite(C.Glow, mx, my, len * 1.2, v.r * 4, ang, cc, 0.4 * a);
      F.sprite(C.Blade, mx, my, len * 1.15, v.r * (0.9 + 1.4 * drop), ang, mixc(cc, WHITE, 0.55), a);
      F.sprite(C.Streak, mx, my, len * 1.3, v.r * 1.2, ang, WHITE, 0.6 * a);
      break;
    }
    case 'cone': {
      const r = v.r * (0.4 + 0.6 * Math.min(1, u * 2.5));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const an = v.ang - v.spread + (i / (n - 1)) * v.spread * 2;
        F.sprite(C.Streak, v.x + Math.cos(an) * r * 0.5, v.y + Math.sin(an) * r * 0.5, r, 26, an, cc, 0.55 * a);
      }
      if (v.fx === 'sword') F.sprite(C.Slash, v.x + Math.cos(v.ang) * r * 0.55, v.y + Math.sin(v.ang) * r * 0.55, r * 1.1, r * 1.1 * Math.min(1.4, v.spread * 1.4), v.ang, mixc(cc, WHITE, 0.4), a);
      F.glow(v.x, v.y, 40, cc, 0.6 * a);
      break;
    }
    case 'aura': {
      for (let i = 0; i < 3; i++) { const k = (u + i / 3) % 1; F.ring(v.x, v.y - k * 90, v.r * (1 - k * 0.4), cc, 0.7 * (1 - k) * a, 0.35); }
      F.sprite(C.Beam, v.x, v.y - 60, 130, v.r * 1.4, Math.PI / 2, cc, 0.25 * a);
      break;
    }
    case 'blinkfx': F.glow(v.x, v.y - 50, v.r * (1 + u), cc, a * 0.6); break;
  }
}

// ------------------------------------------------------------------ 领域
function drawField(F: FxSys, f: any, t: number, dt: number) {
  const k = clamp(f.t / 0.3, 0, 1) * clamp((f.dur - f.t) / 0.4, 0, 1);
  if (k <= 0.01) return;
  const cc = col(f.color);
  switch (f.fx) {
    case 'flame': {
      F.ground(C.Glow, f.x, f.y, f.r * 1.1, 0, FIRE, 0.4 * k, 1, 0.55);
      F.ground(C.FireRing, f.x, f.y, f.r, t * 0.6, FIRE, 0.7 * k, 1, 0.55);
      F.ground(C.Ink, f.x, f.y, f.r * 0.9, 1.3, [0.12, 0.08, 0.05], 0.25 * k, 0, 0.55);
      for (let i = nEmit(f.r * 0.35, dt); i > 0; i--) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * f.r; F.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.55, vx: rnd(-10, 10), vy: rnd(-120, -60), life: rnd(0.35, 0.7), s0: rnd(22, 40), s1: 6, c: mixc(FIRE, [1, 0.3, 0.1], Math.random() * 0.5), cell: C.Flame, a: 0.9 * k }); }
      if (Math.random() < dt * 6) F.smoke(f.x + rnd(-f.r, f.r) * 0.6, f.y - 40, 1, SMOKE, 0.2 * k, 10, 60);
      break;
    }
    case 'lightning': {
      F.ground(C.Rune, f.x, f.y, f.r, t * 0.8, cc, 0.65 * k, 1, 0.55);
      F.ground(C.Glow, f.x, f.y, f.r, 0, cc, 0.25 * k, 1, 0.55);
      if (Math.random() < dt * 9) { const a = Math.random() * TAU, r = Math.random() * f.r; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.55; F.bolt(x + 20, y - 420, x, y, Math.random() * 1e6, 40, 3, cc, 0.95 * k, 10); F.hit(x, y, cc, 0.6); }
      break;
    }
    case 'rock': {
      F.ground(C.Crack, f.x, f.y, f.r, 0.4, [0.22, 0.16, 0.1], 0.6 * k, 0, 0.55);
      F.ground(C.Glow, f.x, f.y, f.r, 0, [0.6, 0.45, 0.25], 0.25 * k, 1, 0.55);
      if (Math.random() < dt * 8) F.smoke(f.x + rnd(-f.r, f.r) * 0.7, f.y + rnd(-f.r, f.r) * 0.35, 1, [0.5, 0.42, 0.3], 0.25 * k, 6, 50);
      break;
    }
    case 'sword': case 'star': {
      F.ground(C.Ring, f.x, f.y, f.r, 0, cc, 0.7 * k, 1, 0.55);
      F.ground(C.Rune, f.x, f.y, f.r * 0.92, t * 0.4, cc, 0.5 * k, 1, 0.55);
      // 剑雨
      for (let i = 0; i < 16; i++) {
        const ph = (t * 2.5 + i * 0.37) % 1;
        const x = f.x + Math.sin(i * 12.9898) * f.r * 0.85, y = f.y + Math.cos(i * 78.233) * f.r * 0.45;
        const yy = y - 300 * (1 - ph);
        F.sprite(C.Blade, x, yy - 20, 54, 12, Math.PI / 2, mixc(cc, WHITE, 0.4), 0.9 * k);
        F.sprite(C.Streak, x, yy - 60, 90, 8, Math.PI / 2, cc, 0.4 * k);
        if (ph > 0.92) F.glow(x, y, 22, cc, k);
      }
      if (f.fx === 'star') for (let i = 0; i < 20; i++) F.glow(f.x + Math.sin(i * 3.1 + t * 0.3) * f.r, f.y + Math.cos(i * 1.7 + t * 0.2) * f.r * 0.5, 8 + 5 * Math.sin(t * 3 + i), cc, k, C.Star);
      break;
    }
    case 'array': {
      F.ground(C.Rune, f.x, f.y, f.r, t * 0.5, cc, 0.85 * k, 1, 0.55);
      F.ground(C.Bagua, f.x, f.y, f.r * 0.6, -t * 0.7, cc, 0.6 * k, 1, 0.55);
      F.ground(C.Glow, f.x, f.y, f.r, 0, cc, 0.2 * k, 1, 0.55);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; const x = f.x + Math.cos(a) * f.r * 0.95, y = f.y + Math.sin(a) * f.r * 0.52; F.sprite(C.Beam, x, y - 60, 120, 18, Math.PI / 2, cc, 0.5 * k); F.glow(x, y - 110, 12, cc, k, C.Core); }
      if (Math.random() < dt * 14) { const a = Math.random() * TAU, r = Math.random() * f.r; F.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.55, vy: rnd(-60, -30), life: 1, s0: 5, s1: 1, c: cc }); }
      break;
    }
    default: {
      F.ground(C.Glow, f.x, f.y, f.r, 0, cc, 0.4 * k, 1, 0.55);
      F.ground(C.Ring, f.x, f.y, f.r, 0, cc, 0.4 * k, 1, 0.55);
      if (f.heal && Math.random() < dt * 10) F.emit({ x: f.x + rnd(-f.r, f.r) * 0.6, y: f.y, vy: rnd(-80, -40), life: 1, s0: 6, s1: 1, c: [0.6, 1, 0.6], cell: C.Star, rot: 0 });
    }
  }
}
