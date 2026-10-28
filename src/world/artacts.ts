// 法器出手（第十三步）：每件法器都有实体（代码绘制的法器造型，入 Y 排序的世界层）
// 与光效（WebGL 层：拖尾、灵光、冲击）。行为按类型分：飞剑往返、子母刃合围、飞针追魂、
// 飞环回旋、宝镜聚光、砖山天降、箭刺穿杀、符宝巨剑、古钟震魂、绶带缠缚、灵焰喷吐、
// 魔幡插地、宝鼎收摄。
import type { Combat, Enemy } from './combat';
import type { Drawable } from './life';
import type { School, StatusSpec } from '../data/arts';
import type { FxSys, RGB } from '../gl/fx';
import { C as A } from '../gl/atlas';
import { itemDef, ArtSpec } from '../data/items';
import { ArtLook, artLook } from '../data/artlooks';
import { drawArt } from '../gfx/artifact';
import { audio } from './audio';
import { artMods, type ArtMods } from './gongfa';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const WHITE: RGB = [1, 1, 1];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeIn = (u: number) => Math.pow(clamp(u, 0, 1), 2.2);
const rgb = (s: string): RGB => { const p = s.split(',').map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255]; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function angLerp(a: number, b: number, k: number) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * clamp(k, 0, 1); }

export interface Src { realm: number; status?: StatusSpec; stCh: number; school?: School; evil?: number; skill?: string }
export interface ActInit {
  itemId: string; art: ArtSpec; L: ArtLook; cc: RGB; dmg: number; src: Src; pieces: number;
  ax: number; ay: number; target: Enemy | null;
  /** 第 4 阶段：功法 / 套路带来的修正（world/gongfa.ts artMods） */
  mods?: ArtMods;
}

/** 敌人受击点高度（相对地面） */
export const eh = (e: Enemy) => (e.anim.flying ? 75 : e.def.kind === 'human' ? 58 : 34);
function shadow(g: G, x: number, y: number, r: number, a: number) {
  if (a <= 0.01) return;
  g.fillStyle = `rgba(20,16,12,${0.28 * a})`; g.beginPath(); g.ellipse(x, y, r, r * 0.34, 0, 0, TAU); g.fill();
}

export abstract class Act {
  t = 0; done = false;
  constructor(public c: Combat, public I: ActInit) {}
  get p() { return this.c.game.player; }
  /** 投放距离（随神识） */
  get reach() { return this.c.reach; }
  abstract update(dt: number): void;
  bodies(_out: Drawable[]): void {}
  glow(_F: FxSys, _t: number, _dt: number): void {}
  hit(e: Enemy, dmg: number, fx: number, fy: number, src: Src = this.I.src) { this.c.hitEnemy(e, dmg, src, fx, fy); }
  /** 范围内敌人 */
  near(x: number, y: number, r: number) { return this.c.enemies.filter((e) => !e.dead && Math.hypot(e.x - x, (e.y - y) * 1.25) < r); }
  nearestE(x: number, y: number, r: number, skip?: Set<number>) {
    let best: Enemy | null = null, bd = r;
    for (const e of this.c.enemies) { if (e.dead || skip?.has(e.id)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
}

// ============================================================== 飞行体（共用）
export interface Flyer { x: number; y: number; h: number; ang: number; trail: [number, number, number][] }
export function pushTrail(f: Flyer, n = 10) { f.trail.push([f.x, f.y - f.h, f.ang]); if (f.trail.length > n) f.trail.shift(); }
/** 画实体 + 残影 */
export function drawFlyer(g: G, L: ArtLook, f: Flyer, size: number, alpha = 1, ghosts = 3, shadowR = 0) {
  if (shadowR) shadow(g, f.x, f.y, shadowR, alpha * clamp(1 - f.h / 400, 0.2, 1));
  const n = f.trail.length;
  for (let i = 0; i < ghosts && n - 2 - i * 2 >= 0; i++) {
    const tr = f.trail[n - 2 - i * 2];
    drawArt(g, L, tr[0], tr[1], size, tr[2], alpha * (0.32 - i * 0.09));
  }
  drawArt(g, L, f.x, f.y - f.h, size, f.ang, alpha);
}
export function trailPts(f: Flyer): [number, number][] { const o = f.trail.map((p) => [p[0], p[1]] as [number, number]); o.push([f.x, f.y - f.h]); return o; }

// ============================================================== 飞剑：出鞘 → 破空 → 回旋
interface Blade extends Flyer { ph: 0 | 1 | 2 | 3 | 4; pt: number; delay: number; tgt: Enemy | null; hit: Set<number>; vx: number; vy: number; side: number; dist: number; flash: number }
class SwordAct extends Act {
  blades: Blade[] = [];
  thunder: boolean; blood: boolean; per: number; size: number;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const n = I.pieces;
    this.thunder = I.art.element === 'thunder'; this.blood = I.art.element === 'blood';
    this.per = n > 1 ? I.dmg / (Math.sqrt(n) * 0.8) : I.dmg;
    this.size = n > 6 ? 64 : 96;
    // 多口飞剑分配不同目标
    const foes = this.c.enemies.filter((e) => !e.dead && Math.hypot(e.x - this.p.x, e.y - this.p.y) < this.reach).sort((a, b) => Math.hypot(a.x - this.p.x, a.y - this.p.y) - Math.hypot(b.x - this.p.x, b.y - this.p.y));
    for (let i = 0; i < n; i++) {
      const side = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
      const tgt = I.target && i % 2 === 0 ? I.target : foes.length ? foes[i % foes.length] : I.target;
      this.blades.push({ x: this.p.x - side * 20, y: this.p.y + 2, h: 40, ang: -Math.PI / 2, trail: [], ph: 0, pt: 0, delay: i * (n > 8 ? 0.022 : 0.05), tgt, hit: new Set(), vx: 0, vy: 0, side, dist: 0, flash: 0 });
    }
    audio.sfx('sword');
  }
  update(dt: number) {
    this.t += dt;
    const p = this.p, I = this.I;
    let alive = 0;
    for (const b of this.blades) {
      if (b.ph === 4) continue;
      alive++;
      b.flash = Math.max(0, b.flash - dt * 4);
      if (b.ph === 0) { b.delay -= dt; b.x = p.x - b.side * 20; b.y = p.y + 2; if (b.delay <= 0) { b.ph = 1; b.pt = 0; b.flash = 1; } continue; }
      b.pt += dt;
      if (b.ph === 1) {
        // 出鞘：自背后升起，剑尖转向敌人
        const many = this.blades.length > 6, RT = many ? 0.24 : 0.16;
        const u = ease(b.pt / RT);
        const tx = b.tgt && !b.tgt.dead ? b.tgt.x : I.ax, ty = b.tgt && !b.tgt.dead ? b.tgt.y : I.ay;
        const aim = Math.atan2(ty - p.y, tx - p.x);
        const spread = many ? 130 : 46;
        b.x = p.x - b.side * 20 + Math.cos(aim + Math.PI / 2) * b.side * spread * u - Math.cos(aim) * (many ? 40 : 20) * u;
        b.y = p.y + 2 + Math.sin(aim + Math.PI / 2) * b.side * spread * 0.6 * u;
        b.h = lerp(40, many ? 110 + (1 - Math.abs(b.side)) * 60 : 96, u);
        b.ang = angLerp(-Math.PI / 2, aim, u);
        if (b.pt >= RT) { b.ph = 2; b.pt = 0; const sp = 1500; b.vx = Math.cos(aim) * sp; b.vy = Math.sin(aim) * sp; }
      } else if (b.ph === 2) {
        // 破空：追踪，贯穿
        const tg = b.tgt && !b.tgt.dead ? b.tgt : null;
        let sp = Math.hypot(b.vx, b.vy);
        sp = Math.min(2100, sp + 1400 * dt);
        let dir = Math.atan2(b.vy, b.vx);
        if (tg && !b.hit.has(tg.id)) dir = angLerp(dir, Math.atan2(tg.y - b.y, tg.x - b.x), dt * 10);
        b.vx = Math.cos(dir) * sp; b.vy = Math.sin(dir) * sp;
        b.x += b.vx * dt; b.y += b.vy * dt; b.dist += sp * dt;
        b.h = lerp(b.h, tg ? eh(tg) : 52, dt * 8);
        b.ang = dir;
        for (const e of this.c.enemies) {
          if (e.dead || b.hit.has(e.id)) continue;
          if (Math.hypot(e.x - b.x, (e.y - b.y) * 1.3) < 46 * (e.def.look?.size ?? 1)) { b.hit.add(e.id); this.hit(e, this.per, b.x - b.vx * 0.05, b.y - b.vy * 0.05); b.flash = 1; this.onHit(e, b); }
        }
        if (b.dist > this.reach + 120 || b.pt > 0.3 + this.reach / 1700 || (tg && b.hit.has(tg.id) && b.pt > 0.12 && b.dist > Math.hypot(tg.x - p.x, tg.y - p.y) + 180)) { b.ph = 3; b.pt = 0; b.hit.clear(); }
      } else if (b.ph === 3) {
        // 回旋：划弧折返，回程亦可伤敌
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        let dir = Math.atan2(b.vy, b.vx);
        dir = angLerp(dir, Math.atan2(dy, dx), dt * (6 + b.pt * 18));
        const sp = Math.min(2300, Math.hypot(b.vx, b.vy) * 0.98 + 900 * dt);
        b.vx = Math.cos(dir) * sp; b.vy = Math.sin(dir) * sp;
        b.x += b.vx * dt; b.y += b.vy * dt; b.ang = dir; b.h = lerp(b.h, 90, dt * 5);
        for (const e of this.c.enemies) {
          if (e.dead || b.hit.has(e.id)) continue;
          if (Math.hypot(e.x - b.x, (e.y - b.y) * 1.3) < 40) { b.hit.add(e.id); this.hit(e, this.per * 0.45, b.x, b.y); b.flash = 1; }
        }
        if (d < 50 || b.pt > 1.6) { b.ph = 4; this.c.fxq.push({ k: 'cast', x: p.x, y: p.y - 70, color: I.L.glow }); }
      }
      pushTrail(b, 12);
    }
    if (!alive) this.done = true;
  }
  onHit(e: Enemy, b: Blade) {
    (this as any)._slash = ((this as any)._slash ?? []); (this as any)._slash.push({ x: e.x, y: e.y - eh(e), a: Math.atan2(b.vy, b.vx) });
    if (this.thunder && ((this as any)._bolts ?? []).length < 3) { (this as any)._bolts = ((this as any)._bolts ?? []); (this as any)._bolts.push({ x: e.x, y: e.y - eh(e), t: 0, seed: Math.random() * 1e6 }); if (Math.random() < 0.35) audio.sfx('thunder'); }
    else if (Math.random() < 0.5) audio.sfx('clang');
    void b;
  }
  bodies(out: Drawable[]) {
    for (const b of this.blades) {
      if (b.ph === 0 || b.ph === 4) continue;
      const a = b.ph === 1 ? clamp(b.pt / 0.08, 0, 1) : 1;
      out.push({ y: b.y + 50, draw: (g) => drawFlyer(g, this.I.L, b, this.size, a, b.ph === 2 ? 3 : 2, 14) });
    }
  }
  glow(F: FxSys, _t: number, dt: number) {
    const cc = this.I.cc, core = mix(cc, WHITE, 0.6);
    const many = this.blades.length > 8;
    const gk = many ? 1.6 / Math.sqrt(this.blades.length) : 1;   // 多剑时压低单剑亮度，避免过曝
    let prev: Blade | null = null;
    for (const b of this.blades) {
      if (b.ph === 0 || b.ph === 4) continue;
      const pts = trailPts(b);
      const tipX = b.x + Math.cos(b.ang) * this.size * 0.45, tipY = b.y - b.h + Math.sin(b.ang) * this.size * 0.45;
      // 剑光：沿剑身的剑形灵光
      F.sprite(A.Blade, b.x, b.y - b.h, this.size * 1.25, this.size * 0.34, b.ang, cc, (0.55 + b.flash * 0.3) * gk);
      if (b.ph >= 2) {
        F.trail(pts, many ? 18 : 34, cc, 0.4 * gk, A.Beam, 1, 1);
        F.trail(pts, many ? 5 : 8, core, 0.9 * Math.min(1, gk * 1.5), A.Beam, 1, 1);
        if (Math.random() < dt * 40) F.emit({ x: b.x + rnd(-8, 8), y: b.y - b.h + rnd(-6, 6), vx: -b.vx * 0.08 + rnd(-30, 30), vy: -b.vy * 0.08 + rnd(-30, 30), life: rnd(0.25, 0.45), s0: rnd(3, 5), s1: 1, c: core, cell: A.Glow });
        if (this.blood && Math.random() < dt * 30) F.emit({ x: b.x + rnd(-6, 6), y: b.y - b.h, vx: rnd(-20, 20), vy: rnd(-10, 30), life: rnd(0.3, 0.6), s0: rnd(10, 18), s1: 26, c: [0.5, 0.03, 0.05], a: 0.45, add: 0, cell: A.Smoke });
      }
      F.glow(b.x, b.y - b.h, many ? 22 : 34, cc, (0.35 + b.flash * 0.4) * gk);
      F.glow(tipX, tipY, 10 + b.flash * 16, core, (0.7 + b.flash * 0.3) * Math.min(1, gk * 1.5), A.Star);
      if (b.ph === 1 && b.pt < 0.02 && (!many || Math.random() < 0.3)) F.flash(b.x, b.y - b.h, 22, cc, 0.14);
      // 青竹蜂云剑：剑与剑之间金雷游走
      if (this.thunder && prev && Math.random() < dt * (many ? 6 : 12) && prev.ph >= 2 && b.ph >= 2 && Math.hypot(prev.x - b.x, prev.y - b.y) < 260)
        F.bolt(prev.x, prev.y - prev.h, b.x, b.y - b.h, Math.random() * 1e6, 14, 1.4, [1, 0.88, 0.45], 0.9, 6, false);
      if (this.thunder && Math.random() < dt * 8) F.bolt(b.x, b.y - b.h, b.x + rnd(-40, 40), b.y - b.h + rnd(-30, 30), Math.random() * 1e6, 8, 1, [1, 0.9, 0.5], 0.8, 4, false);
      prev = b;
    }
    const sl = (this as any)._slash as { x: number; y: number; a: number }[] | undefined;
    if (sl) { for (const s of sl.slice(0, 4)) slashFx(F, s.x, s.y, s.a, cc, many ? 0.6 : 1); (this as any)._slash = []; }
    const bolts = (this as any)._bolts as { x: number; y: number; t: number; seed: number }[] | undefined;
    if (bolts) {
      for (const z of bolts) {
        if (z.t === 0) { F.flash(z.x, z.y, 50, [1, 0.88, 0.45], 0.2); F.sparks(z.x, z.y, [1, 0.9, 0.5], 14, 360, 0.4, 3); }
        z.t += dt;
        const k = 1 - z.t / 0.22;
        if (k > 0) F.bolt(z.x + rnd(-6, 6), z.y - 320, z.x, z.y, z.seed + Math.floor(z.t * 30), 34, 2.6, [1, 0.88, 0.45], k, 12, true);
      }
      (this as any)._bolts = bolts.filter((z) => z.t < 0.22);
    }
  }
}

/** 斩击命中：弧形斩痕（高光 + 本体 + 余韵三层）+ 顺向火花 + 横向光丝 */
export function slashFx(F: FxSys, x: number, y: number, ang: number, cc: RGB, k = 1) {
  const core = mix(cc, WHITE, 0.7), rot = ang + Math.PI / 2 * 0 ;
  F.emit({ x, y, life: 0.2, s0: 120 * k, s1: 170 * k, c: cc, a: 0.75, cell: A.Slash, rot });
  F.emit({ x, y, life: 0.12, s0: 100 * k, s1: 140 * k, c: core, a: 0.95, cell: A.Slash, rot });
  F.emit({ x, y, life: 0.1, s0: 50 * k, s1: 120 * k, c: WHITE, a: 0.9, cell: A.Star, rot: Math.random() });
  F.sparks(x, y, cc, Math.round(12 * k), 520, 0.35, 3.2, ang, 0.9);
  for (let i = 0; i < 3; i++) F.emit({ x, y, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, life: 0.12, s0: 6, s1: 2, c: core, stretch: 0.06, drag: 6 });
}

// ============================================================== 金蚨子母刃：母刃先至，九子合围
interface Child extends Flyer { a0: number; st: number; hitDone: boolean; vis: number }
class JinfuAct extends Act {
  mom: Flyer & { ph: number; pt: number } = { x: 0, y: 0, h: 70, ang: 0, trail: [], ph: 0, pt: 0 };
  kids: Child[] = [];
  cx = 0; cy = 0; spin = 0; hitSet = new Set<number>();
  childL: ArtLook;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    this.mom.x = this.p.x; this.mom.y = this.p.y;
    this.childL = { ...I.L, shape: 'jinfuChild' };
    const n = clamp(I.pieces - 1, 3, 9);
    for (let i = 0; i < n; i++) this.kids.push({ x: 0, y: 0, h: 60, ang: 0, trail: [], a0: i / n * TAU, st: 0, hitDone: false, vis: 0 });
    audio.sfx('sword');
  }
  tgtPos() { const tg = this.I.target; return tg && !tg.dead ? { x: tg.x, y: tg.y, h: eh(tg) } : { x: this.I.ax, y: this.I.ay, h: 46 }; }
  update(dt: number) {
    this.t += dt;
    const m = this.mom, p = this.p;
    m.pt += dt;
    this.spin += dt * (m.ph === 2 ? 7 : 3);
    const tp = this.tgtPos();
    if (m.ph === 0) {
      // 母刃破空
      const dx = tp.x - m.x, dy = tp.y - m.y, d = Math.hypot(dx, dy);
      const sp = 1500 * dt;
      m.ang = Math.atan2(dy, dx);
      if (d <= sp + 10 || m.pt > 0.25 + this.reach / 1500) {
        m.x = tp.x; m.y = tp.y; m.ph = 1; m.pt = 0;
        for (const e of this.near(tp.x, tp.y, 70)) this.hit(e, this.I.dmg * 1.4, p.x, p.y);
        this.c.fxq.push({ k: 'cast', x: tp.x, y: tp.y - 90, color: this.I.L.glow });
        audio.sfx('clang');
      } else { m.x += dx / d * sp; m.y += dy / d * sp; }
      m.h = lerp(m.h, tp.h + 10, dt * 6);
    } else if (m.ph === 1) {
      // 子刃离母，环列四周
      m.x = lerp(m.x, tp.x, dt * 8); m.y = lerp(m.y, tp.y, dt * 8); m.h = lerp(m.h, 150, dt * 6); m.ang += dt * 9;
      this.cx = m.x; this.cy = m.y;
      const u = ease(m.pt / 0.32);
      for (const k of this.kids) {
        const a = k.a0 + this.spin;
        k.x = this.cx + Math.cos(a) * 110 * u; k.y = this.cy + Math.sin(a) * 60 * u; k.h = lerp(150, 70, u);
        k.ang = a + Math.PI; k.vis = Math.min(1, k.vis + dt * 6);
      }
      if (m.pt > 0.36) { m.ph = 2; m.pt = 0; this.kids.forEach((k, i) => (k.st = i * 0.055)); }
    } else if (m.ph === 2) {
      // 依次穿刺
      m.x = lerp(m.x, tp.x, dt * 8); m.y = lerp(m.y, tp.y, dt * 8); m.ang += dt * 12;
      this.cx = m.x; this.cy = m.y;
      let fin = true;
      for (const k of this.kids) {
        const a = k.a0 + this.spin * 0.3;
        const ox = this.cx + Math.cos(a) * 110, oy = this.cy + Math.sin(a) * 60;
        const ix = this.cx - Math.cos(a) * 70, iy = this.cy - Math.sin(a) * 38;   // 穿过中心到对侧
        const lt = m.pt - k.st;
        if (lt < 0) { k.x = ox; k.y = oy; k.ang = a + Math.PI; fin = false; continue; }
        const u = clamp(lt / 0.12, 0, 1);
        if (u < 1) fin = false;
        k.x = lerp(ox, ix, easeIn(u)); k.y = lerp(oy, iy, easeIn(u)); k.h = lerp(70, tp.h, u); k.ang = a + Math.PI;
        if (u > 0.55 && !k.hitDone) {
          k.hitDone = true;
          const es = this.near(this.cx, this.cy, 80);
          for (const e of es) this.hit(e, this.I.dmg, ox, oy);
          if (es.length) (this as any)._sp = ((this as any)._sp ?? 0) + 1;
        }
      }
      if (fin && m.pt > 0.2) { m.ph = 3; m.pt = 0; }
    } else {
      // 收回
      const all = [m as Flyer, ...this.kids];
      let left = 0;
      for (const f of all) {
        const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
        const sp = (1300 + m.pt * 1600) * dt;
        f.ang = angLerp(f.ang, Math.atan2(dy, dx), dt * 10);
        if (d > 40) { left++; f.x += dx / d * Math.min(d, sp); f.y += dy / d * Math.min(d, sp); f.h = lerp(f.h, 80, dt * 5); }
        else (f as any).vis = 0;
      }
      if (!left || m.pt > 1.4) this.done = true;
    }
    pushTrail(m, 10);
    for (const k of this.kids) pushTrail(k, 6);
  }
  bodies(out: Drawable[]) {
    const m = this.mom;
    if (!this.done) out.push({ y: m.y + 60, draw: (g) => drawFlyer(g, this.I.L, m, 64, 1, m.ph === 0 ? 3 : 1, 12) });
    if (this.mom.ph >= 1) for (const k of this.kids) if (k.vis > 0.02) out.push({ y: k.y + 60, draw: (g) => drawFlyer(g, this.childL, k, 58, k.vis, 2, 8) });
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc, core = mix(cc, WHITE, 0.6), m = this.mom;
    F.trail(trailPts(m), 18, cc, 0.4); F.trail(trailPts(m), 5, core, 0.8);
    F.glow(m.x, m.y - m.h, 30, cc, 0.3);
    if (m.ph >= 1 && m.ph < 3) {
      F.ground(A.Rune, this.cx, this.cy, 120, t * 0.5, cc, 0.16, 1, 0.55);
      F.ring(this.cx, this.cy, 112, cc, 0.18, 0.55, false);
    }
    if (m.ph >= 1) for (const k of this.kids) {
      if (k.vis <= 0.02) continue;
      F.trail(trailPts(k), 9, cc, 0.4 * k.vis); F.glow(k.x, k.y - k.h, 10, core, 0.5 * k.vis, A.Star);
      if (k.hitDone && !(k as any)._fx) { (k as any)._fx = 1; F.sparks(this.cx, this.cy - 50, cc, 8, 340, 0.35, 3); F.flash(this.cx, this.cy - 50, 26, cc, 0.1); }
    }
  }
}

// ============================================================== 飞针 / 花瓣：追魂锁敌
interface Needle extends Flyer { vx: number; vy: number; tgt: Enemy | null; life: number; dead: boolean; delay: number; hue: RGB; spin: number }
class NeedleAct extends Act {
  ns: Needle[] = [];
  petal: boolean; thread: RGB;
  basket = 0;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    this.petal = I.L.shape === 'basket';
    this.thread = I.itemId === 'art_hongxian' ? [0.95, 0.15, 0.15] : I.cc;
    const p = this.p, n = I.pieces;
    const foes = this.c.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 820).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const aim = Math.atan2(I.ay - p.y, I.ax - p.x);
    for (let i = 0; i < n; i++) {
      const a = aim + (n > 1 ? (i / (n - 1) - 0.5) * 1.6 : 0) + rnd(-0.08, 0.08);
      const tgt = foes.length ? (I.target && i % 3 === 0 ? I.target : foes[i % foes.length]) : null;
      const sp = this.petal ? rnd(380, 520) : rnd(700, 900);
      const hx = this.petal ? p.x + rnd(-30, 30) : p.x + Math.cos(aim) * 26, hy = this.petal ? p.y : p.y + Math.sin(aim) * 10;
      this.ns.push({ x: hx, y: hy, h: this.petal ? 140 : 56, ang: a, trail: [], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tgt, life: 0, dead: false, delay: i * (this.petal ? 0.035 : 0.025), hue: this.petal ? mix(I.cc, WHITE, Math.random() * 0.5) : I.cc, spin: rnd(-12, 12) });
    }
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt;
    this.basket = this.petal ? clamp(Math.min(this.t / 0.15, (1.0 - this.t) / 0.3), 0, 1) : 0;
    let alive = 0;
    for (const n of this.ns) {
      if (n.dead) continue;
      alive++;
      if (n.delay > 0) { n.delay -= dt; continue; }
      n.life += dt;
      let tg = n.tgt && !n.tgt.dead ? n.tgt : null;
      if (!tg && n.life > 0.15) tg = n.tgt = this.nearestE(n.x, n.y, this.reach * 0.75);
      let dir = Math.atan2(n.vy, n.vx), sp = Math.hypot(n.vx, n.vy);
      sp = Math.min(this.petal ? 1100 : 2200, sp + (this.petal ? 900 : 2600) * dt);
      if (tg && n.life > 0.08) dir = angLerp(dir, Math.atan2(tg.y - n.y, tg.x - n.x), dt * (this.petal ? 7 : 12) * Math.min(1, n.life * 4));
      n.vx = Math.cos(dir) * sp; n.vy = Math.sin(dir) * sp;
      n.x += n.vx * dt; n.y += n.vy * dt; n.ang = this.petal ? n.ang + n.spin * dt : dir;
      n.h = lerp(n.h, tg ? eh(tg) : 46, dt * 5);
      if (tg && Math.hypot(tg.x - n.x, (tg.y - n.y) * 1.3) < 34) {
        this.hit(tg, this.I.dmg, n.x - n.vx * 0.04, n.y - n.vy * 0.04);
        n.dead = true; (n as any)._pop = 1;
      }
      if (n.life > Math.max(1.5, this.reach / 750)) n.dead = true;
      pushTrail(n, this.petal ? 5 : 14);
    }
    if (!alive && this.t > 0.6) this.done = true;
  }
  bodies(out: Drawable[]) {
    const p = this.p;
    if (this.petal && this.basket > 0.01) out.push({ y: p.y + 30, draw: (g) => { shadow(g, p.x, p.y + 2, 24, this.basket * 0.5); drawArt(g, this.I.L, p.x, p.y - 150 + Math.sin(this.t * 8) * 4, 70, Math.sin(this.t * 6) * 0.15, this.basket); } });
    if (this.petal) return;
    for (const n of this.ns) if (!n.dead && n.delay <= 0) out.push({ y: n.y + 40, draw: (g) => drawArt(g, this.I.L, n.x, n.y - n.h, 46, n.ang) });
  }
  glow(F: FxSys) {
    const cc = this.I.cc;
    for (const n of this.ns) {
      if ((n as any)._pop === 1) { (n as any)._pop = 2; F.sparks(n.x, n.y - n.h, cc, 6, 260, 0.3, 2.4); F.flash(n.x, n.y - n.h, 16, cc, 0.1); }
      if (n.dead || n.delay > 0) continue;
      if (this.petal) {
        F.sprite(A.Petal, n.x, n.y - n.h, 22, 16, n.ang, n.hue, 0.95, 0.4);
        F.glow(n.x, n.y - n.h, 14, n.hue, 0.35);
        if (Math.random() < 0.3) F.emit({ x: n.x, y: n.y - n.h, vx: rnd(-20, 20), vy: rnd(10, 40), life: 0.6, s0: 10, s1: 4, c: n.hue, a: 0.6, add: 0.4, cell: A.Petal, rot: Math.random() * TAU, vr: rnd(-6, 6) });
      } else {
        const pts = trailPts(n);
        F.trail(pts, 3.2, this.thread, 0.9, A.Beam, 1, 0.6);
        F.trail(pts, 10, cc, 0.25);
        F.glow(n.x, n.y - n.h, 9, mix(cc, WHITE, 0.7), 0.9, A.Star);
      }
    }
    if (this.petal && this.basket > 0) F.glow(this.p.x, this.p.y - 150, 70, cc, 0.35 * this.basket);
  }
}

// ============================================================== 飞环 / 玉镯：回旋绞杀
class RingAct extends Act {
  f: Flyer = { x: 0, y: 0, h: 60, ang: 0, trail: [] };
  ph = 0; pt = 0; spin = 0; tx = 0; ty = 0; hitT = new Map<number, number>();
  five: boolean; fire: boolean; ice: boolean;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p; this.f.x = p.x; this.f.y = p.y;
    const dx = I.ax - p.x, dy = I.ay - p.y, d = Math.hypot(dx, dy) || 1, R = Math.min(this.reach, Math.max(260, d + 60));
    this.tx = p.x + dx / d * R; this.ty = p.y + dy / d * R;
    this.five = I.itemId === 'art_wuxing'; this.fire = I.art.element === 'fire'; this.ice = I.art.element === 'ice';
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt; this.spin += dt * 16;
    const f = this.f, p = this.p;
    if (this.ph === 0) {
      const u = ease(this.pt / 0.5);
      f.x = lerp(p.x, this.tx, u); f.y = lerp(p.y, this.ty, u); f.h = 60 + Math.sin(u * Math.PI) * 60;
      if (this.pt >= 0.5) { this.ph = 1; this.pt = 0; }
    } else if (this.ph === 1) {
      // 原地急旋
      f.h = lerp(f.h, 54, dt * 6);
      if (this.pt > 0.45) { this.ph = 2; this.pt = 0; }
    } else {
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      const sp = (500 + this.pt * 2400) * dt;
      if (d < 46 || this.pt > 1.4) { this.done = true; this.c.fxq.push({ k: 'cast', x: p.x, y: p.y - 70, color: this.I.L.glow }); return; }
      f.x += dx / d * Math.min(d, sp); f.y += dy / d * Math.min(d, sp); f.h = lerp(f.h, 80, dt * 4);
    }
    const now = this.c.game.time;
    for (const e of this.c.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - f.x, (e.y - f.y) * 1.3) < 62 && (this.hitT.get(e.id) ?? 0) < now) {
        this.hitT.set(e.id, now + (this.ph === 1 ? 0.16 : 0.3));
        this.hit(e, this.I.dmg * (this.ph === 1 ? 0.45 : 1), f.x, f.y);
      }
    }
    f.ang = this.spin;
    pushTrail(f, 14);
  }
  bodies(out: Drawable[]) {
    const f = this.f;
    out.push({ y: f.y + 50, draw: (g) => {
      shadow(g, f.x, f.y, 34, 0.8);
      // 飞环平旋：压扁成椭圆，光泽随转动流转
      g.save(); g.translate(f.x, f.y - f.h); g.scale(1, 0.5);
      drawArt(g, this.I.L, 0, 0, 96, this.spin);
      g.restore();
    } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const f = this.f, cc = this.I.cc;
    const pts = trailPts(f);
    F.trail(pts, 40, cc, 0.3); F.trail(pts, 10, mix(cc, WHITE, 0.5), 0.6);
    F.ring(f.x, f.y - f.h, 52, cc, 0.6, 0.5, true, 0);
    F.glow(f.x, f.y - f.h, 54, cc, 0.35);
    // 环刃旋光
    for (let i = 0; i < 3; i++) { const a = this.spin + i * TAU / 3; F.glow(f.x + Math.cos(a) * 38, f.y - f.h + Math.sin(a) * 19, 12, WHITE, 0.7, A.Star); }
    if (this.five) {
      const cols: RGB[] = [[1, 0.85, 0.35], [0.4, 0.9, 0.45], [0.35, 0.6, 1], [1, 0.4, 0.25], [0.8, 0.62, 0.35]];
      for (let i = 0; i < 5; i++) { const a = -this.spin * 0.5 + i * TAU / 5; const x = f.x + Math.cos(a) * 70, y = f.y - f.h + Math.sin(a) * 35; F.orb(x, y, 7, cols[i], 0.85); }
    }
    if (this.fire && Math.random() < dt * 60) F.emit({ x: f.x + rnd(-30, 30), y: f.y - f.h + rnd(-12, 12), vx: rnd(-30, 30), vy: rnd(-120, -60), life: rnd(0.3, 0.6), s0: rnd(18, 30), s1: 6, c: [1, rnd(0.4, 0.7), 0.2], a: 0.8, cell: A.Flame });
    if (this.ice && Math.random() < dt * 30) F.emit({ x: f.x + rnd(-36, 36), y: f.y - f.h + rnd(-16, 16), vx: rnd(-30, 30), vy: rnd(20, 60), life: rnd(0.4, 0.8), s0: rnd(6, 12), s1: 2, c: [0.75, 0.85, 1], a: 0.8, cell: A.Shard, rot: Math.random() * TAU, vr: rnd(-4, 4) });
    if (this.ph === 1) F.ground(A.Swirl, f.x, f.y, 90, -t * 4, cc, 0.35, 1, 0.5);
  }
}

// ============================================================== 宝镜：聚光 → 光柱
class MirrorAct extends Act {
  ph = 0; pt = 0; mx = 0; my = 0; aim = 0; beams: { a: number; c: RGB; len: number }[] = [];
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p;
    this.aim = Math.atan2(I.ay - p.y, I.ax - p.x);
    const n = I.itemId === 'art_bamen' ? 8 : I.itemId === 'art_ningguang' ? 5 : 1;
    const five: RGB[] = [[1, 0.85, 0.4], [0.45, 1, 0.55], [0.45, 0.65, 1], [1, 0.45, 0.35], [0.9, 0.6, 1]];
    for (let i = 0; i < n; i++) {
      const spread = n === 8 ? 0.9 : n === 5 ? 0.36 : 0;
      this.beams.push({ a: this.aim + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), c: n === 5 ? five[i] : I.cc, len: 0 });
    }
    this.place();
  }
  place() { const p = this.p; this.mx = p.x + Math.cos(this.aim) * 56; this.my = p.y + Math.sin(this.aim) * 24; }
  update(dt: number) {
    this.t += dt; this.pt += dt; this.place();
    if (this.ph === 0 && this.pt > 0.32) {
      this.ph = 1; this.pt = 0;
      // 结算：每道光柱贯穿直线
      const tally = new Map<Enemy, number>();
      const hy = this.my - 92;
      for (const b of this.beams) {
        const cx = Math.cos(b.a), cy = Math.sin(b.a);
        let L = this.reach + 60;
        for (const e of this.c.enemies) {
          if (e.dead) continue;
          const rx = e.x - this.mx, ry = e.y - this.my, along = rx * cx + ry * cy;
          if (along < 0 || along > L) continue;
          const perp = Math.abs(-rx * cy + ry * cx);
          if (perp < 38 * (e.def.look?.size ?? 1)) tally.set(e, (tally.get(e) ?? 0) + 1);
        }
        b.len = L; void hy;
      }
      for (const [e, k] of tally) this.hit(e, this.I.dmg * (1 + 0.28 * (k - 1)), this.mx, this.my);
      this.c.game.juice(0.03, 0.18 + this.beams.length * 0.03);
      audio.sfx('chime');
    } else if (this.ph === 1 && this.pt > 0.38) { this.ph = 2; this.pt = 0; }
    else if (this.ph === 2 && this.pt > 0.25) this.done = true;
  }
  bodies(out: Drawable[]) {
    const a = this.ph === 0 ? ease(this.pt / 0.15) : this.ph === 2 ? 1 - this.pt / 0.25 : 1;
    const sz = this.I.L.shape === 'bagua' ? 86 : 78;
    out.push({ y: this.my + 40, draw: (g) => { shadow(g, this.mx, this.my, 22, a * 0.6); drawArt(g, this.I.L, this.mx, this.my - 92 + Math.sin(this.t * 7) * 3, sz * (0.6 + 0.4 * a), 0, a); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, x = this.mx, y = this.my - 92 - 4;
    if (this.ph === 0) {
      const u = this.pt / 0.32;
      F.glow(x, y, 30 + u * 30, cc, 0.18 + u * 0.3);
      F.ground(A.Rune, this.mx, this.my, 70 + u * 30, t, cc, 0.4 * u, 1, 0.5);
      // 灵光内聚
      for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, r = rnd(90, 150); F.emit({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 2.2, life: 0.3, s0: 5, s1: 2, c: mix(cc, WHITE, 0.4), stretch: 0.03, cell: A.Glow }); }
    } else {
      const k = this.ph === 1 ? Math.min(1, this.pt / 0.06) * (1 - 0.3 * (this.pt / 0.38)) : 1 - this.pt / 0.25;
      const fl = 0.9 + 0.1 * Math.sin(t * 60);
      for (const b of this.beams) {
        const L = b.len, ex = x + Math.cos(b.a) * L, ey = y + Math.sin(b.a) * L * 0.85 + 60;
        const nb = this.beams.length, w = (nb > 1 ? 0.5 : 1) * k * fl, ak = 1 / Math.sqrt(nb);
        F.beam(x, y, ex, ey, 96 * w, b.c, 0.22 * k * ak);
        F.beam(x, y, ex, ey, 40 * w, b.c, 0.6 * k * ak);
        F.beam(x, y, ex, ey, 11 * w, WHITE, 0.9 * k);
        if (this.ph === 1 && Math.random() < dt * 40) { const u = Math.random(); F.emit({ x: lerp(x, ex, u), y: lerp(y, ey, u), vx: Math.cos(b.a) * 400 + rnd(-60, 60), vy: Math.sin(b.a) * 300 + rnd(-60, 60), life: 0.3, s0: 5, s1: 1, c: mix(b.c, WHITE, 0.5), stretch: 0.04 }); }
        F.glow(ex, ey, 60 * k, b.c, 0.5 * k);
      }
      F.glow(x, y, 46 * k, cc, 0.45 * k); F.glow(x + Math.cos(this.aim) * 30, y, 30 * k, WHITE, 0.9 * k, A.Star);
      if (this.ph === 1 && this.pt < dt * 1.5) { F.flash(x + Math.cos(this.aim) * 30, y, 34, cc, 0.16); F.shockRing(this.mx, this.my, 80, cc, 0.3, 0.55, 0.45); }
    }
  }
}

// ============================================================== 砖 / 山：天降砸落
class SlamAct extends Act {
  ph = 0; pt = 0; x = 0; y = 0; h = 520; R: number; size: number; crackT = 0; rot = 0;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, tg = I.target && !I.target.dead ? I.target : null;
    const dx = (tg ? tg.x : I.ax) - p.x, dy = (tg ? tg.y : I.ay) - p.y, d = Math.hypot(dx, dy) || 1, D = Math.min(this.reach, d);
    this.x = p.x + dx / d * D; this.y = p.y + dy / d * D;
    const mtn = I.L.shape === 'mountain';
    this.R = mtn ? 210 : I.itemId === 'art_lanjin' ? 130 : 110;
    this.size = mtn ? 250 : I.itemId === 'art_lanjin' ? 120 : 100;
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const tg = this.I.target;
    if (this.ph === 0) {
      // 天上凝形，阴影罩地（可追踪目标，给敌人反应时间）
      if (tg && !tg.dead && this.pt < 0.3) { this.x = lerp(this.x, tg.x, dt * 3); this.y = lerp(this.y, tg.y, dt * 3); }
      this.h = this.size > 200 ? 340 : 400; this.rot = Math.sin(this.t * 3) * 0.08;
      if (this.pt > 0.48) { this.ph = 1; this.pt = 0; }
    } else if (this.ph === 1) {
      const u = easeIn(this.pt / 0.11);
      this.h = lerp(this.size > 200 ? 340 : 400, 0, u);
      if (this.pt >= 0.11) {
        this.ph = 2; this.pt = 0; this.h = 0;
        for (const e of this.near(this.x, this.y, this.R + 20)) {
          this.hit(e, this.I.dmg, this.x, this.y);
          if (!e.dead) { const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * 380; e.ky += dy / d * 260; }
        }
        this.c.impact(this.x, this.y, this.size > 200 ? 3 : 2, this.I.L.glow);
        audio.sfx('boom');
        (this as any)._impact = 1;
      }
    } else if (this.ph === 2) { if (this.pt > 0.42) { this.ph = 3; this.pt = 0; } }
    else { this.h = easeIn(this.pt / 0.4) * 300; if (this.pt > 0.4) this.done = true; }
    if (this.ph >= 2) this.crackT += dt;
  }
  bodies(out: Drawable[]) {
    const a = this.ph === 0 ? ease(this.pt / 0.2) : this.ph === 3 ? 1 - this.pt / 0.4 : 1;
    const grow = this.ph === 0 ? 0.55 + 0.45 * ease(this.pt / 0.45) : 1;
    out.push({ y: this.y + 20, draw: (g) => {
      // 阴影随高度收缩变深
      const sh = this.ph <= 1 ? clamp(1 - this.h / 600, 0.25, 1) : 1 - (this.ph === 3 ? this.pt / 0.4 : 0);
      shadow(g, this.x, this.y + 4, this.size * 0.55 * (1.4 - sh * 0.4), sh * 1.3);
      const bob = this.ph === 2 ? Math.max(0, 6 - this.pt * 30) * Math.sin(this.pt * 60) : 0;
      drawArt(g, this.I.L, this.x, this.y - this.h - this.size * 0.28 + bob, this.size * grow, this.rot, a);
    } });
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc;
    if (this.ph <= 1) {
      const u = this.ph === 0 ? this.pt / 0.48 : 1;
      // 预警：地面压暗的落影 + 一圈收紧的灵光细环
      F.ground(A.Disc, this.x, this.y, this.R * (0.5 + 0.5 * u), 0, [0.1, 0.08, 0.06], 0.22 + 0.25 * u, 0, 0.5);
      F.ground(A.Ring, this.x, this.y, this.R * (1.35 - 0.35 * u), 0, cc, 0.18 + 0.15 * u, 1, 0.5);
      F.ground(A.Ring, this.x, this.y, this.R, 0, cc, 0.1 + 0.08 * Math.sin(t * 18), 1, 0.5);
      F.glow(this.x, this.y - this.h - this.size * 0.28, this.size * 0.7, cc, 0.35);
      if (this.ph === 1) for (let i = 0; i < 2; i++) F.emit({ x: this.x + rnd(-this.size * 0.4, this.size * 0.4), y: this.y - this.h - rnd(0, this.size * 0.4), vy: -900, life: 0.12, s0: 6, s1: 2, c: cc, stretch: 0.05 });
    }
    if ((this as any)._impact === 1) {
      (this as any)._impact = 2;
      const x = this.x, y = this.y, r = this.R;
      F.flash(x, y - 10, r * 0.32, mix(cc, WHITE, 0.3), 0.16);
      F.shockRing(x, y, r * 1.5, cc, 0.5, 0.55, 0.45); F.shockRing(x, y, r * 0.9, WHITE, 0.3, 0.55, 0.45);
      F.shock(x, y - 20, r * 3, 18 + r * 0.06, 0.6);
      F.smoke(x, y, 14, [0.42, 0.36, 0.28], 0.4, r * 0.5, r * 0.8);
      for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, v = rnd(260, 520); F.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.45, life: rnd(0.5, 0.9), s0: rnd(30, 60), s1: rnd(70, 110), c: [0.5, 0.44, 0.36], a: 0.35, add: 0, cell: A.Smoke, drag: 3.5, rot: Math.random() * TAU }); }
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + rnd(-1.3, 1.3), v = rnd(260, 560); F.emit({ x: x + rnd(-20, 20), y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.6, 1), s0: rnd(6, 14), c: [0.38, 0.3, 0.22], a: 0.95, add: 0, cell: A.Shard, rot: Math.random() * TAU, vr: rnd(-10, 10), grav: 1300 }); }
      F.sparks(x, y - 20, cc, 20, 520, 0.5, 4);
    }
    if (this.ph >= 2) {
      const k = clamp(1 - (this.crackT - 0.6) / 0.6, 0, 1);
      F.ground(A.Crack, this.x, this.y, this.R * 0.95, 0, [0.08, 0.06, 0.05], 0.75 * k, 0, 0.5);
      F.ground(A.Crack, this.x, this.y, this.R * 0.8, 0, cc, 0.5 * k * clamp(1 - this.crackT * 1.5, 0, 1), 1, 0.5);
    }
  }
}

// ============================================================== 刺 / 夺 / 箭：蓄势一击，贯穿残影
class ArrowAct extends Act {
  f: Flyer = { x: 0, y: 0, h: 60, ang: 0, trail: [] };
  ph = 0; pt = 0; vx = 0; vy = 0; hitSet = new Set<number>(); dist = 0;
  hook: boolean; thunder: boolean;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, tg = I.target && !I.target.dead ? I.target : null;
    this.f.ang = Math.atan2((tg ? tg.y : I.ay) - p.y, (tg ? tg.x : I.ax) - p.x);
    this.hook = I.itemId === 'art_wulong'; this.thunder = I.art.element === 'thunder';
    this.place(0);
  }
  place(pull: number) { const p = this.p, f = this.f; f.x = p.x + Math.cos(f.ang) * (40 - pull * 26); f.y = p.y + Math.sin(f.ang) * (16 - pull * 10); f.h = 62; }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const f = this.f;
    if (this.ph === 0) {
      const tg = this.I.target && !this.I.target.dead ? this.I.target : null;
      if (tg) f.ang = angLerp(f.ang, Math.atan2(tg.y - this.p.y, tg.x - this.p.x), dt * 12);
      this.place(ease(this.pt / 0.14));
      if (this.pt > 0.16) { this.ph = 1; this.pt = 0; const sp = 2300; this.vx = Math.cos(f.ang) * sp; this.vy = Math.sin(f.ang) * sp; audio.sfx('sword'); }
    } else if (this.ph === 1) {
      f.x += this.vx * dt; f.y += this.vy * dt; this.dist += 2300 * dt;
      for (const e of this.c.enemies) {
        if (e.dead || this.hitSet.has(e.id)) continue;
        if (Math.hypot(e.x - f.x, (e.y - f.y) * 1.3) < 44) {
          this.hitSet.add(e.id);
          const src = this.hook ? { ...this.I.src, status: { k: 'break' as const, dur: 4, ch: 1 }, stCh: 1 } : this.I.src;
          this.hit(e, this.I.dmg, f.x - this.vx * 0.03, f.y - this.vy * 0.03, src);
          if (this.hook && !e.dead) { e.kx -= Math.cos(f.ang) * 420; e.ky -= Math.sin(f.ang) * 280; }
          (this as any)._hits = [...((this as any)._hits ?? []), { x: e.x, y: e.y - eh(e), t: 0 }];
        }
      }
      if (this.dist > this.reach + 80) { this.ph = 2; this.pt = 0; }
    } else { if (this.pt > 0.22) this.done = true; f.x += this.vx * dt * 0.3; f.y += this.vy * dt * 0.3; }
    pushTrail(f, 14);
  }
  bodies(out: Drawable[]) {
    const f = this.f, a = this.ph === 2 ? 1 - this.pt / 0.22 : this.ph === 0 ? clamp(this.pt / 0.06, 0, 1) : 1;
    out.push({ y: f.y + 50, draw: (g) => drawFlyer(g, this.I.L, f, this.hook ? 78 : 84, a, this.ph === 1 ? 4 : 0, 10) });
  }
  glow(F: FxSys, _t: number, dt: number) {
    const f = this.f, cc = this.I.cc, core = mix(cc, WHITE, 0.6);
    const tip = { x: f.x + Math.cos(f.ang) * 40, y: f.y - f.h + Math.sin(f.ang) * 40 };
    if (this.ph === 0) { const u = this.pt / 0.16; F.glow(tip.x, tip.y, 14 + u * 26, cc, 0.4 + u * 0.5); F.glow(tip.x, tip.y, 8 + u * 10, WHITE, u, A.Star); }
    else {
      const pts = trailPts(f);
      F.trail(pts, 26, cc, 0.35); F.trail(pts, 7, core, 0.85);
      F.glow(tip.x, tip.y, 22, core, 0.8, A.Star);
      if (this.hook && Math.random() < dt * 40) F.emit({ x: f.x, y: f.y - f.h, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.5, s0: 18, s1: 34, c: [0.12, 0.13, 0.18], a: 0.4, add: 0, cell: A.Smoke });
    }
    const hs = (this as any)._hits as { x: number; y: number; t: number }[] | undefined;
    if (hs) for (const h of hs) {
      if (h.t === 0) {
        F.sparks(h.x, h.y, cc, 14, 420, 0.4, 3.4, f.ang, 1.1);
        F.emit({ x: h.x, y: h.y, life: 0.16, s0: 90, s1: 150, c: core, a: 0.85, cell: A.Slash, rot: f.ang + Math.PI / 2 });
        if (this.thunder) F.bolt(h.x, h.y - 300, h.x, h.y, Math.random() * 1e6, 30, 2.4, [1, 0.9, 0.5], 1, 12, true);
      }
      h.t += dt;
    }
  }
}

// ============================================================== 符宝：符纸燃尽 → 巨剑天降
class FubaoAct extends Act {
  ph = 0; pt = 0; tx = 0; ty = 0; h = 300; sword: ArtLook;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, tg = I.target && !I.target.dead ? I.target : null;
    const dx = (tg ? tg.x : I.ax) - p.x, dy = (tg ? tg.y : I.ay) - p.y, d = Math.hypot(dx, dy) || 1, D = Math.min(this.reach, d);
    this.tx = p.x + dx / d * D; this.ty = p.y + dy / d * D;
    this.sword = { shape: 'jian', c1: '#f4e8b0', c2: '#b8902a', glow: I.L.glow };
    audio.sfx('fire');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const tg = this.I.target;
    if (this.ph === 0) { if (this.pt > 0.38) { this.ph = 1; this.pt = 0; audio.sfx('sword'); } }
    else if (this.ph === 1) { if (tg && !tg.dead) { this.tx = lerp(this.tx, tg.x, dt * 4); this.ty = lerp(this.ty, tg.y, dt * 4); } if (this.pt > 0.3) { this.ph = 2; this.pt = 0; } }
    else if (this.ph === 2) {
      this.h = lerp(300, 0, easeIn(this.pt / 0.1));
      if (this.pt >= 0.1) {
        this.ph = 3; this.pt = 0; this.h = 0;
        const src = { ...this.I.src, status: { k: 'knock' as const, dur: 0.4, ch: 1 }, stCh: 1 };
        for (const e of this.near(this.tx, this.ty, 130)) this.hit(e, this.I.dmg, this.tx, this.ty, src);
        this.c.impact(this.tx, this.ty, 3, this.I.L.glow); audio.sfx('boom'); (this as any)._impact = 1;
      }
    } else if (this.pt > 0.55) this.done = true;
  }
  bodies(out: Drawable[]) {
    const p = this.p;
    if (this.ph === 0) {
      const u = this.pt / 0.38;
      out.push({ y: p.y + 30, draw: (g) => { drawArt(g, this.I.L, p.x + 30, p.y - 120 - u * 20, 74, Math.sin(this.t * 10) * 0.1, 1 - u * 0.8); } });
    }
    if (this.ph >= 1) {
      const a = this.ph === 1 ? ease(this.pt / 0.2) : this.ph === 3 ? 1 - clamp((this.pt - 0.25) / 0.3, 0, 1) : 1;
      out.push({ y: this.ty + 10, draw: (g) => {
        shadow(g, this.tx, this.ty, 40 + (1 - this.h / 300) * 30, a);
        // 剑尖朝下：剑身长 300，竖直插落
        drawArt(g, this.sword, this.tx, this.ty - this.h - 140 + (this.ph === 3 ? 26 : 0), 300, Math.PI / 2, a);
      } });
    }
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, gold: RGB = [1, 0.88, 0.5], p = this.p;
    if (this.ph === 0) {
      const u = this.pt / 0.38;
      F.glow(p.x + 30, p.y - 130, 50, gold, 0.4 + u * 0.4);
      if (Math.random() < dt * 50) F.emit({ x: p.x + 30 + rnd(-18, 18), y: p.y - 130 + rnd(-40, 40), vy: rnd(-90, -40), vx: rnd(-20, 20), life: rnd(0.3, 0.6), s0: rnd(10, 18), s1: 3, c: [1, 0.6, 0.2], cell: A.Flame, a: 0.8 });
    } else if (this.ph < 3) {
      const y = this.ty - this.h - 140;
      F.sprite(A.Glow, this.tx, y, 120, 360, 0, gold, 0.45);
      F.sprite(A.Beam, this.tx, y, 30, 320, Math.PI / 2, WHITE, 0.5);
      F.ground(A.Rune, this.tx, this.ty, 120, t * 1.2, gold, 0.5, 1, 0.5);
      if (this.ph === 2) F.beam(this.tx, y - 200, this.tx, y, 60, gold, 0.5);
    }
    if ((this as any)._impact === 1) {
      (this as any)._impact = 2;
      F.flash(this.tx, this.ty - 40, 50, gold, 0.18);
      F.shockRing(this.tx, this.ty, 220, gold, 0.5, 0.55, 0.45); F.shock(this.tx, this.ty, 420, 24, 0.6);
      F.sparks(this.tx, this.ty - 20, gold, 30, 600, 0.6, 4);
      F.smoke(this.tx, this.ty, 10, [0.45, 0.4, 0.32], 0.35, 60, 90);
      F.emit({ x: this.tx, y: this.ty - 60, life: 0.22, s0: 120, s1: 200, c: WHITE, a: 0.7, cell: A.Star, rot: 0.3 });
    }
    if (this.ph === 3) { F.ground(A.Crack, this.tx, this.ty, 110, 0, [0.08, 0.06, 0.04], 0.7 * (1 - this.pt / 0.55), 0, 0.5); F.glow(this.tx, this.ty - 120, 90, cc, 0.4 * (1 - this.pt / 0.55)); if (this.pt > 0.25) for (let i = 0; i < 3; i++) F.emit({ x: this.tx + rnd(-10, 10), y: this.ty - rnd(0, 280), vx: rnd(-30, 30), vy: rnd(-80, -20), life: 0.6, s0: 6, s1: 1, c: gold, cell: A.Glow }); }
  }
}

// ============================================================== 古钟：三响震魂
class BellAct extends Act {
  tolls = 0; swing = 0;
  constructor(c: Combat, I: ActInit) { super(c, I); }
  update(dt: number) {
    this.t += dt;
    this.swing *= Math.exp(-dt * 5);
    const times = [0.22, 0.48, 0.74];
    if (this.tolls < 3 && this.t > times[this.tolls]) {
      const k = this.tolls++;
      this.swing = 1;
      const p = this.p;
      const src = k === 0 ? { ...this.I.src, status: { k: 'stun' as const, dur: 1.2, ch: 0.75 }, stCh: 0.75 } : { ...this.I.src, status: undefined, stCh: 0 };
      for (const e of this.near(p.x, p.y, 240 + k * 30)) this.hit(e, this.I.dmg * (k === 0 ? 1 : 0.35), p.x, p.y, src);
      this.c.game.juice(0.02, 0.15 + (k === 0 ? 0.15 : 0));
      audio.sfx('bell');
      (this as any)._toll = k + 1;
    }
    if (this.t > 1.25) this.done = true;
  }
  bodies(out: Drawable[]) {
    const p = this.p, a = clamp(Math.min(this.t / 0.15, (1.25 - this.t) / 0.25), 0, 1);
    out.push({ y: p.y + 20, draw: (g) => { shadow(g, p.x, p.y + 4, 30, a * 0.4); drawArt(g, this.I.L, p.x, p.y - 170, 84 * (0.7 + 0.3 * a), Math.sin(this.t * 30) * this.swing * 0.12, a); } });
  }
  glow(F: FxSys) {
    const p = this.p, cc = this.I.cc;
    F.glow(p.x, p.y - 165, 60, cc, 0.16 + this.swing * 0.22);
    const k = (this as any)._toll as number | undefined;
    if (k) {
      (this as any)._toll = 0;
      const R = 240 + (k - 1) * 30;
      const ka = k === 1 ? 0.5 : 0.28;
      F.shockRing(p.x, p.y, R, cc, 0.6, 0.55, ka);
      F.shockRing(p.x, p.y - 165, R * 0.45, cc, 0.5, 1, ka * 0.7);
      F.shock(p.x, p.y - 60, R * 2, k === 1 ? 22 : 12, 0.7);
      if (k === 1) F.flash(p.x, p.y - 165, 34, cc, 0.16);
      for (let i = 0; i < (k === 1 ? 16 : 8); i++) { const a = i / 16 * TAU; F.emit({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 15, vx: Math.cos(a) * R * 1.6, vy: Math.sin(a) * R * 0.8, life: 0.5, s0: 18, s1: 6, c: cc, a: 0.3, cell: A.Wisp, rot: a, drag: 1.5 }); }
    }
  }
}

// ============================================================== 绶带：灵蛇出洞 → 螺旋缠缚
class BindAct extends Act {
  head: Flyer = { x: 0, y: 0, h: 60, ang: 0, trail: [] };
  path: [number, number][] = [];
  ph = 0; pt = 0; tgt: Enemy | null; tick = 0;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    this.tgt = I.target && !I.target.dead ? I.target : this.nearestE(this.p.x, this.p.y, this.reach);
    this.head.x = this.p.x; this.head.y = this.p.y;
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const h = this.head, p = this.p, tg = this.tgt && !this.tgt.dead ? this.tgt : null;
    if (this.ph === 0) {
      const tx = tg ? tg.x : this.I.ax, ty = tg ? tg.y : this.I.ay;
      const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
      const sp = 1150 * dt;
      // 蛇行：垂直方向正弦摆动
      const nx = -dy / (d || 1), ny = dx / (d || 1), wig = Math.cos(this.t * 22) * 160 * dt;
      if (d < sp + 20 || this.pt > 0.3 + this.reach / 1150) {
        if (tg) {
          this.ph = 1; this.pt = 0;
          this.hit(tg, this.I.dmg, p.x, p.y, { ...this.I.src, status: { k: 'root', dur: 2.6, ch: 1 }, stCh: 1 });
          audio.sfx('clang');
        } else { this.ph = 2; this.pt = 0; }
      } else { h.x += dx / d * sp + nx * wig; h.y += dy / d * sp + ny * wig; h.ang = Math.atan2(dy, dx); }
      this.path.push([h.x, h.y - h.h]); if (this.path.length > 26) this.path.shift();
    } else if (this.ph === 1) {
      // 缠缚：随目标移动
      if (!tg || this.pt > 2.6) { this.ph = 2; this.pt = 0; }
      else {
        h.x = tg.x; h.y = tg.y;
        this.tick += dt;
        if (this.tick > 0.5) { this.tick = 0; this.hit(tg, this.I.dmg * 0.18, tg.x, tg.y - 1, { ...this.I.src, status: undefined, stCh: 0 }); }
        if (this.path.length) this.path.shift();
      }
    } else {
      if (this.pt > 0.35) this.done = true;
      if (this.path.length) this.path.shift();
    }
  }
  bodies(out: Drawable[]) {
    const L = this.I.L;
    if (this.ph === 0 && this.path.length > 1) {
      const pts = this.path.slice();
      out.push({ y: this.head.y + 40, draw: (g) => ribbonStroke(g, pts, L, 1) });
    }
    if (this.ph >= 1 && this.tgt) {
      const e = this.tgt, a = this.ph === 1 ? Math.min(1, this.pt / 0.2) : 1 - this.pt / 0.35;
      const H = e.anim.flying ? 110 : e.def.kind === 'human' ? 100 : 60, W = e.def.kind === 'human' ? 26 : 40 * (e.def.look?.size ?? 1);
      out.push({ y: e.y + 1, draw: (g) => {
        // 螺旋缠绕：三圈，正面描深、背面描浅
        const n = 3, steps = 60, ph = this.t * 2;
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= steps; i++) { const u = i / steps, an = u * n * TAU + ph; pts.push([e.x + Math.cos(an) * W * (1 - u * 0.15), e.y - 8 - u * H * a + Math.sin(an) * W * 0.32, Math.sin(an)]); }
        g.save(); g.globalAlpha *= a; g.lineCap = 'round';
        for (const pass of [0, 1]) for (let i = 1; i < pts.length; i++) {
          const front = pts[i][2] > 0; if ((pass === 0) === front) continue;
          g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]);
          g.strokeStyle = 'rgba(30,24,18,0.85)'; g.lineWidth = 9; g.stroke();
          g.strokeStyle = front ? L.c1 : shadeRGBA(L.c1, 0.55); g.lineWidth = 6.5; g.stroke();
          if (front && i % 3 === 0) { g.strokeStyle = L.c2; g.lineWidth = 1.6; g.stroke(); }
        }
        g.restore();
      } });
    }
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc;
    if (this.ph === 0 && this.path.length > 1) { F.trail(this.path, 22, cc, 0.35); F.glow(this.head.x, this.head.y - this.head.h, 20, cc, 0.6, A.Star); }
    if (this.ph === 1 && this.tgt) { const e = this.tgt; F.glow(e.x, e.y - 50, 60, cc, 0.25 + 0.1 * Math.sin(t * 8)); F.ground(A.Rune, e.x, e.y, 60, t * 1.5, cc, 0.35, 1, 0.5); }
  }
}
function shadeRGBA(hex: string, k: number) { const v = parseInt(hex.slice(1), 16); return `rgb(${((v >> 16) & 255) * k | 0},${((v >> 8) & 255) * k | 0},${(v & 255) * k | 0})`; }
function ribbonStroke(g: G, pts: [number, number][], L: ArtLook, a: number) {
  g.save(); g.globalAlpha *= a; g.lineCap = 'round'; g.lineJoin = 'round';
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
  path(); g.strokeStyle = 'rgba(30,24,18,0.85)'; g.lineWidth = 12; g.stroke();
  path(); g.strokeStyle = L.c1; g.lineWidth = 8.5; g.stroke();
  path(); g.strokeStyle = L.c2; g.lineWidth = 1.6; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);
  const h = pts[pts.length - 1]; g.fillStyle = L.c2; g.beginPath(); g.arc(h[0], h[1], 5, 0, TAU); g.fill();
  g.restore();
}

// ============================================================== 灵焰：持器喷吐（可连续催动）
class FlameAct extends Act {
  last = 0; aim = 0; cols: RGB[]; hold = 0;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const id = I.itemId;
    this.cols = id === 'art_tiandu' ? [[0.35, 1, 0.5], [0.1, 0.6, 0.25]] : id === 'art_qianlan' ? [[0.75, 0.92, 1], [0.25, 0.55, 1]] : id === 'art_sanyan' ? [[1, 0.35, 0.2], [1, 0.8, 0.3], [0.35, 0.55, 1]] : [[1, 0.65, 0.25], [0.75, 0.35, 0.95]];
    this.fire();
  }
  /** 再次催动：续火 */
  fire() {
    const p = this.p, I = this.I;
    this.aim = Math.atan2(I.ay - p.y, I.ax - p.x); this.last = this.t; this.hold = 0.36;
    const R = 320, half = 0.36;
    for (const e of this.c.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > R + 20) continue;
      let da = Math.atan2(dy, dx) - this.aim; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (Math.abs(da) < half + 20 / Math.max(40, d)) this.hit(e, I.dmg, p.x, p.y);
    }
    if (Math.random() < 0.5) audio.sfx('fire');
  }
  update(dt: number) {
    this.t += dt; this.hold -= dt;
    if (this.hold < -0.3) this.done = true;
  }
  get vx() { return this.p.x + Math.cos(this.aim) * 44; }
  get vy() { return this.p.y + Math.sin(this.aim) * 18; }
  bodies(out: Drawable[]) {
    const a = clamp(this.hold > 0 ? this.t * 8 : 1 + this.hold / 0.3, 0, 1);
    const shape = this.I.L.shape;
    out.push({ y: this.vy + 30, draw: (g) => drawArt(g, this.I.L, this.vx, this.vy - 80, shape === 'fan' ? 64 : 54, shape === 'fan' ? this.aim + Math.PI / 2 : 0, a) });
  }
  glow(F: FxSys, _t: number, dt: number) {
    const x = this.vx, y = this.vy - 80 - (this.I.L.shape === 'fan' ? 0 : 14);
    const on = this.hold > 0;
    F.glow(x, y, 40, this.cols[0], on ? 0.6 : 0.25);
    if (!on) return;
    const n = nEm(160, dt);
    for (let i = 0; i < n; i++) {
      const c0 = this.cols[(Math.random() * this.cols.length) | 0];
      const a = this.aim + rnd(-0.3, 0.3), v = rnd(480, 680);
      F.emit({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.62 + 30, life: rnd(0.38, 0.55), s0: rnd(14, 22), s1: rnd(60, 90), c: c0, a: 0.55, cell: A.Flame, rot: a + Math.PI / 2, vr: rnd(-2, 2), drag: 1.2 });
    }
    // 白热焰芯
    for (let i = 0; i < nEm(60, dt); i++) { const a = this.aim + rnd(-0.12, 0.12), v = rnd(380, 520); F.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.62, life: 0.22, s0: 12, s1: 34, c: mix(this.cols[0], WHITE, 0.7), a: 0.8, cell: A.Glow }); }
    if (Math.random() < dt * 12) F.smoke(x + Math.cos(this.aim) * 260, y + Math.sin(this.aim) * 160, 1, [0.15, 0.13, 0.12], 0.25, 30, 50);
  }
}
const nEm = (rate: number, dt: number) => { const f = rate * dt; return Math.floor(f) + (Math.random() < f % 1 ? 1 : 0); };

// ============================================================== 幡 / 旗：飞插于地，召灵出战
class BannerAct extends Act {
  ph = 0; pt = 0; sx: number; sy: number; x = 0; y = 0; h = 0; dur: number;
  constructor(c: Combat, I: ActInit, dur: number) {
    super(c, I);
    const p = this.p, a = Math.atan2(I.ay - p.y, I.ax - p.x);
    this.sx = p.x; this.sy = p.y; this.x = p.x + Math.cos(a) * 130; this.y = p.y + Math.sin(a) * 70 + 10;
    this.dur = dur;
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    if (this.ph === 0) {
      const u = this.pt / 0.32;
      this.h = Math.sin(clamp(u, 0, 1) * Math.PI) * 140;
      if (u >= 1) {
        this.ph = 1; this.pt = 0; this.h = 0;
        // 召灵：从幡下涌出
        const id = this.I.itemId;
        const kind = id === 'art_qingjiao' ? 'jiao' : id === 'art_sanshen' ? 'puppet' : 'demon';
        const n = id === 'art_wuzi' ? 5 : id === 'art_guiluo' ? 3 : id === 'art_sanshen' ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const an = i / n * TAU + rnd(-0.3, 0.3);
          this.c.summons.push({ kind: kind as any, x: this.x + Math.cos(an) * 40, y: this.y + Math.sin(an) * 24, t: this.dur, dmg: this.I.dmg * (n > 1 ? 0.55 : 1), cd: 0.3, target: null, phase: 0, facing: 1, n: 1, evil: this.I.src.evil, status: this.I.src.status });
        }
        this.c.game.juice(0.03, 0.25); audio.sfx('land');
        (this as any)._plant = 1;
      }
    } else if (this.pt > this.dur) this.done = true;
  }
  pos() { const u = clamp(this.pt / 0.32, 0, 1); return this.ph === 0 ? { x: lerp(this.sx, this.x, u), y: lerp(this.sy, this.y, u) } : { x: this.x, y: this.y }; }
  bodies(out: Drawable[]) {
    const q = this.pos(), a = this.ph === 1 ? clamp((this.dur - this.pt) / 0.6, 0, 1) : 1;
    out.push({ y: q.y, draw: (g) => { shadow(g, q.x, q.y, 22, a); drawBanner(g, this.I.L, q.x, q.y - this.h, this.t, a, this.ph === 0 ? 0.25 : 0); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const q = this.pos(), cc = this.I.cc;
    if ((this as any)._plant === 1) { (this as any)._plant = 2; F.flash(q.x, q.y - 20, 50, cc, 0.2); F.shockRing(q.x, q.y, 150, cc, 0.45, 0.55, 0.45); F.smoke(q.x, q.y, 10, [0.4, 0.36, 0.3], 0.35, 30, 60); F.smoke(q.x, q.y - 60, 8, mix(cc, [0, 0, 0], 0.6), 0.4, 30, 70); }
    if (this.ph === 1) {
      const a = clamp((this.dur - this.pt) / 0.6, 0, 1);
      F.ground(A.Rune, q.x, q.y, 90, t * 0.6, cc, 0.4 * a, 1, 0.5);
      F.glow(q.x + 10, q.y - 100, 70, cc, 0.25 * a);
      if (Math.random() < dt * 8 * a) F.emit({ x: q.x + rnd(-40, 40), y: q.y - rnd(40, 130), vx: rnd(10, 40), vy: rnd(-30, -10), life: rnd(0.8, 1.4), s0: 18, s1: 40, c: cc, a: 0.3, cell: A.Wisp, rot: 0 });
    }
  }
}
/** 迎风招展的旗幡：旗面按正弦波逐列变形（代码绘制） */
function drawBanner(g: G, L: ArtLook, x: number, y: number, t: number, a: number, tilt: number) {
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(tilt);
  const H = 150, poleW = 4;
  g.fillStyle = '#6a5030'; g.strokeStyle = 'rgba(30,24,18,0.9)'; g.lineWidth = 1.4;
  g.beginPath(); g.rect(-poleW / 2, -H, poleW, H + 6); g.fill(); g.stroke();
  g.fillStyle = '#d8b860'; g.beginPath(); g.arc(0, -H - 4, 5, 0, TAU); g.fill(); g.stroke();
  if (L.shape === 'bonebanner') {
    for (let k = 0; k < 3; k++) {
      g.beginPath(); const x0 = -10 + k * 10;
      for (let i = 0; i <= 10; i++) { const u = i / 10, yy = -H + 8 + u * 110, xx = x0 + Math.sin(t * 3 + u * 3 + k) * 8 * u; if (i === 0) g.moveTo(xx - 4, yy); else g.lineTo(xx - 4, yy); }
      for (let i = 10; i >= 0; i--) { const u = i / 10, yy = -H + 8 + u * 110, xx = x0 + Math.sin(t * 3 + u * 3 + k) * 8 * u; g.lineTo(xx + 4, yy); }
      g.closePath(); g.fillStyle = L.c1; g.fill(); g.stroke();
    }
    g.restore(); return;
  }
  const W = 76, FH = 92, cols = 12;
  const top: [number, number][] = [], bot: [number, number][] = [];
  for (let i = 0; i <= cols; i++) {
    const u = i / cols, w = Math.sin(t * 4.2 - u * 5) * 9 * u;
    top.push([poleW / 2 + u * W, -H + 6 + w]);
    bot.push([poleW / 2 + u * W * 0.94, -H + 6 + FH + w * 1.3 + (i % 3 === 2 ? 8 : 0)]);
  }
  g.beginPath(); top.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
  g.closePath();
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, L.c1); gr.addColorStop(0.5, L.c1); gr.addColorStop(1, shadeRGBA(L.c1, 0.6));
  g.fillStyle = gr; g.fill(); g.stroke();
  // 波纹明暗
  g.save(); g.clip();
  for (let i = 0; i < cols; i++) { const u = i / cols, s = Math.cos(t * 4.2 - u * 5); g.fillStyle = s > 0 ? `rgba(255,255,255,${0.12 * s})` : `rgba(0,0,0,${-0.18 * s})`; g.fillRect(poleW / 2 + u * W, -H - 20, W / cols + 1, FH + 50); }
  // 纹章
  const mx = poleW / 2 + W * 0.45, my = -H + 6 + FH * 0.48 + Math.sin(t * 4.2 - 0.45 * 5) * 4;
  g.strokeStyle = L.c2; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(mx - 14, my + 14); g.bezierCurveTo(mx - 26, my - 6, mx + 2, my - 28, mx + 14, my - 14); g.bezierCurveTo(mx + 24, my - 2, mx + 6, my + 10, mx, my - 2); g.stroke();
  if (L.shape === 'demon') for (let k = 0; k < 5; k++) { const ax = mx - 20 + k * 10, ay = my - 26 + (k % 2) * 8; g.fillStyle = '#140a0e'; g.beginPath(); g.arc(ax, ay, 4.5, 0, TAU); g.fill(); g.fillStyle = L.c2; g.fillRect(ax - 2.5, ay - 1, 1.6, 1.6); g.fillRect(ax + 1, ay - 1, 1.6, 1.6); }
  g.restore();
  g.strokeStyle = L.c2; g.lineWidth = 2; g.beginPath(); top.forEach(([px, py], i) => (i ? g.lineTo(px, py + 5) : g.moveTo(px, py + 5))); g.stroke();
  g.restore();
}

// ============================================================== 宝鼎：青丝摄敌，收而炼之
class CauldronAct extends Act {
  ph = 0; pt = 0; x: number; y: number; h = 0; tick = 0; caught: Enemy[] = [];
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, dx = I.ax - p.x, dy = I.ay - p.y, d = Math.hypot(dx, dy) || 1, D = Math.min(this.reach, d);
    this.x = p.x + dx / d * D; this.y = p.y + dy / d * D;
    audio.sfx('chime');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    if (this.ph === 0) { this.h = ease(this.pt / 0.45) * 110; if (this.pt > 0.45) { this.ph = 1; this.pt = 0; } }
    else if (this.ph === 1) {
      this.tick += dt;
      for (const e of this.near(this.x, this.y, 340)) {
        const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (!e.boss) { e.x += dx / d * Math.min(d, 160 * dt); e.y += dy / d * Math.min(d, 110 * dt); }
        if (!this.caught.includes(e)) this.caught.push(e);
      }
      if (this.tick > 0.25) { this.tick = 0; for (const e of this.caught) if (!e.dead) this.hit(e, this.I.dmg * 0.1, this.x, this.y, { ...this.I.src, status: undefined, stCh: 0 }); }
      if (this.pt > 1.5) {
        this.ph = 2; this.pt = 0;
        // 收摄：残血者直接炼化
        let n = 0;
        for (const e of this.caught) {
          if (e.dead) continue;
          if (!e.boss && e.hp < e.maxHp * 0.3 && e.realm <= this.I.src.realm) { e.hp = 1; this.hit(e, 1e9, this.x, this.y); n++; }
          else this.hit(e, this.I.dmg, this.x, this.y);
        }
        this.c.impact(this.x, this.y, 3, this.I.L.glow); audio.sfx('bell');
        if (n) this.c.game.toast(`虚天鼎青光一卷，${n} 个敌人被收入鼎中炼化！`, 'good');
        (this as any)._seal = 1;
      }
    } else if (this.ph === 2) { if (this.pt > 0.6) { this.ph = 3; this.pt = 0; } }
    else { this.h = 110 + easeIn(this.pt / 0.4) * 300; if (this.pt > 0.4) this.done = true; }
  }
  bodies(out: Drawable[]) {
    const a = this.ph === 3 ? 1 - this.pt / 0.4 : this.ph === 0 ? ease(this.pt / 0.2) : 1;
    const s = this.ph === 0 ? 0.4 + 0.6 * ease(this.pt / 0.45) : this.ph === 2 ? 1 + 0.12 * Math.sin(this.pt * 30) * (1 - this.pt / 0.6) : 1;
    out.push({ y: this.y + 30, draw: (g) => { shadow(g, this.x, this.y, 60, a * 0.8); drawArt(g, this.I.L, this.x, this.y - this.h - 50, 130 * s, Math.sin(this.t * 2) * 0.05, a); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, mx = this.x, my = this.y - this.h - 50 - 30;
    F.glow(mx, my, 80, cc, 0.45);
    if (this.ph === 1) {
      F.ground(A.Swirl, this.x, this.y, 300, -t * 2.5, cc, 0.35, 1, 0.5);
      F.ground(A.Rune, this.x, this.y, 200, t * 0.8, cc, 0.3, 1, 0.5);
      F.sprite(A.Beam, mx, (my + this.y) / 2, Math.abs(this.y - my), 60, Math.PI / 2, cc, 0.18);
      for (const e of this.caught) if (!e.dead && Math.random() < dt * 30) F.bolt(mx + rnd(-20, 20), my, e.x, e.y - eh(e), Math.random() * 1e6, 18, 1.2, mix(cc, WHITE, 0.3), 0.8, 8, false);
      for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, r = rnd(200, 320); F.emit({ x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r * 0.5 - 20, vx: -Math.cos(a) * r * 1.5, vy: -Math.sin(a) * r * 0.75 - 60, life: 0.6, s0: 6, s1: 2, c: cc, cell: A.Glow }); }
    }
    if ((this as any)._seal === 1) { (this as any)._seal = 2; F.flash(mx, my, 110, cc, 0.3); F.shockRing(this.x, this.y, 340, cc, 0.5, 0.55, 0.45); F.shock(this.x, this.y, 600, 26, 0.7); for (const e of this.caught) if (e.dead) for (let i = 0; i < 10; i++) F.emit({ x: e.x, y: e.y - 40, vx: (mx - e.x) * rnd(1.6, 2.4), vy: (my - e.y + 40) * rnd(1.6, 2.4), life: 0.45, s0: 10, s1: 3, c: mix(cc, WHITE, 0.4), cell: A.Glow }); }
  }
}

// ============================================================== 天雷子：抛掷 → 雷爆
class BombAct extends Act {
  sx: number; sy: number; tx: number; ty: number; x = 0; y = 0; h = 0; ph = 0; pt = 0; bolts: { a: number; L: number; seed: number }[] = []; R = 150;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, tg = I.target && !I.target.dead ? I.target : null;
    const dx = (tg ? tg.x : I.ax) - p.x, dy = (tg ? tg.y : I.ay) - p.y, d = Math.hypot(dx, dy) || 1, D = Math.min(this.reach, Math.max(160, d));
    this.sx = p.x + dx / d * 24; this.sy = p.y + dy / d * 10; this.tx = p.x + dx / d * D; this.ty = p.y + dy / d * D;
    this.x = this.sx; this.y = this.sy;
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    if (this.ph === 0) {
      const u = clamp(this.pt / 0.5, 0, 1);
      this.x = lerp(this.sx, this.tx, u); this.y = lerp(this.sy, this.ty, u); this.h = 60 * (1 - u) + Math.sin(u * Math.PI) * 170;
      if (u >= 1) {
        this.ph = 1; this.pt = 0; this.h = 0;
        for (const e of this.near(this.x, this.y, this.R + 20)) this.hit(e, this.I.dmg, this.x, this.y);
        for (let i = 0; i < 9; i++) this.bolts.push({ a: i / 9 * TAU + rnd(-0.2, 0.2), L: rnd(0.7, 1.15) * this.R, seed: Math.random() * 1e6 });
        this.c.impact(this.x, this.y, 2, '255,225,140'); audio.sfx('thunder'); audio.sfx('boom');
      }
    } else if (this.pt > 0.45) this.done = true;
  }
  bodies(out: Drawable[]) {
    if (this.ph !== 0) return;
    out.push({ y: this.y + 30, draw: (g) => { shadow(g, this.x, this.y, 10 + (1 - this.h / 230) * 6, 0.8); drawArt(g, this.I.L, this.x, this.y - this.h, 26, this.t * 14); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, el: RGB = [0.75, 0.82, 1];
    if (this.ph === 0) {
      F.glow(this.x, this.y - this.h, 22, el, 0.6);
      if (Math.random() < dt * 40) F.bolt(this.x, this.y - this.h, this.x + rnd(-22, 22), this.y - this.h + rnd(-22, 22), Math.random() * 1e6, 6, 0.8, el, 0.9, 3, false);
      F.ground(A.Disc, this.tx, this.ty, this.R, 0, [0.08, 0.08, 0.12], 0.18, 0, 0.5); F.ground(A.Ring, this.tx, this.ty, this.R, 0, cc, 0.1 + 0.06 * Math.sin(t * 24), 1, 0.5);
      return;
    }
    const k = 1 - this.pt / 0.45, x = this.x, y = this.y - 20;
    if (this.pt <= dt * 1.01) {
      F.flash(x, y, 40, el, 0.18); F.shockRing(x, this.y, this.R * 1.6, el, 0.45, 0.55, 0.45); F.shock(x, y, this.R * 3, 20, 0.55);
      F.sparks(x, y, el, 26, 560, 0.5, 3.5); F.smoke(x, this.y, 8, [0.16, 0.16, 0.2], 0.4, 40, 80);
      F.emit({ x, y, life: 0.2, s0: 100, s1: 170, c: WHITE, a: 0.7, cell: A.Star, rot: Math.random() });
    }
    // 地面雷蛇四窜 + 天雷两道
    const flick = Math.floor(this.pt * 40);
    for (const b of this.bolts) F.bolt(x, this.y - 6, x + Math.cos(b.a) * b.L, this.y - 6 + Math.sin(b.a) * b.L * 0.5, b.seed + flick, 16, 1.6, el, k, 8, true);
    if (this.pt < 0.2) { F.bolt(x + 10, y - 420, x, y, 77 + flick, 40, 3, el, 1 - this.pt / 0.2, 14, true); F.bolt(x - 30, y - 380, x - 6, y, 99 + flick, 30, 2, el, 0.8 - this.pt / 0.25, 12, false); }
    F.ground(A.Crack, x, this.y, this.R * 0.8, 0, [0.06, 0.06, 0.08], 0.6 * k, 0, 0.5);
    F.glow(x, y, this.R * 0.6, el, 0.18 * k);
  }
}


// ============================================================== 第 4 阶段（s4-content）：十二种新出手方式
// 葫芦收摄 · 伞挡 · 扇风 · 连珠 · 罩子困人 · 塔镇 · 印压 · 灯照魂 · 梭遁 · 鞭 · 阵盘 · 傀儡
// 特效全部用现有特效库（FxSys）拼；套路效果经 I.mods 传入（world/gongfa.ts artMods）。
const M = (I: ActInit): ArtMods => I.mods ?? { combos: [] };
const isEvil = (e: Enemy) => !!e.def.evil || e.def.kind === 'ghost';
function tgtPt(a: Act, maxD = a.reach): { x: number; y: number } {
  const I = a.I, p = a.p, tg = I.target && !I.target.dead ? I.target : null;
  const tx = tg ? tg.x : I.ax, ty = tg ? tg.y : I.ay;
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, D = Math.min(maxD, d);
  return { x: p.x + dx / d * D, y: p.y + dy / d * D };
}
function pushE(e: Enemy, fx: number, fy: number, dist: number) {
  if (e.boss) dist *= 0.25;
  const dx = e.x - fx, dy = e.y - fy, d = Math.hypot(dx, dy) || 1;
  e.x += dx / d * dist; e.y += dy / d * dist * 0.8;
}
function stat(a: Act, e: Enemy, k: StatusSpec['k'], dur: number) { a.c.applyStatus(e.st, { k, dur, ch: 1 }, 0, e, a.p.x, a.p.y); }
function say(a: Act, x: number, y: number, s: string, color = '#ffe2a0', big = false) { a.c.texts.push({ x, y, s, color, t: 0, vy: -36, big }); }

// —— 葫芦收摄：葫口朝下，吸力将敌人摄到葫口，残血者收入葫中炼化
class GourdAct extends Act {
  ph = 0; pt = 0; x: number; y: number; h = 0; tick = 0; caught = new Set<Enemy>(); sx: number; sy: number; got = 0;
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.x = t.x; this.y = t.y; this.sx = this.p.x; this.sy = this.p.y; audio.sfx('whoosh'); }
  get gx() { return this.ph === 0 ? lerp(this.sx, this.x, ease(this.pt / 0.35)) : this.ph === 3 ? lerp(this.x, this.p.x, easeIn(this.pt / 0.4)) : this.x; }
  get gy() { return this.ph === 0 ? lerp(this.sy, this.y, ease(this.pt / 0.35)) : this.ph === 3 ? lerp(this.y, this.p.y, easeIn(this.pt / 0.4)) : this.y; }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const R = 300 * (M(this.I).radius ?? 1);
    if (this.ph === 0) { this.h = lerp(60, 150, ease(this.pt / 0.35)); if (this.pt > 0.35) { this.ph = 1; this.pt = 0; audio.sfx('chime'); } }
    else if (this.ph === 1) {
      this.tick += dt;
      for (const e of this.near(this.x, this.y, R)) {
        this.caught.add(e);
        const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1, sp = (e.boss ? 40 : 220) * dt * (0.6 + this.pt);
        if (d > 30) { e.x += dx / d * Math.min(d, sp); e.y += dy / d * Math.min(d, sp * 0.8); }
      }
      if (this.tick > 0.25) { this.tick = 0; for (const e of this.caught) if (!e.dead && Math.hypot(e.x - this.x, e.y - this.y) < R) this.hit(e, this.I.dmg * 0.12, this.x, this.y, { ...this.I.src, status: undefined, stCh: 0 }); }
      if (this.pt > 1.4) {
        this.ph = 2; this.pt = 0;
        const ex = M(this.I).exec ?? 0.25;
        for (const e of this.caught) {
          if (e.dead) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) > R * 0.6) continue;
          if (!e.boss && e.hp < e.maxHp * ex && e.realm <= this.I.src.realm) { e.hp = 1; this.hit(e, 1e9, this.x, this.y); this.got++; (e as any)._gourd = 1; }
          else this.hit(e, this.I.dmg * 1.2, this.x, this.y);
        }
        say(this, this.x, this.y - this.h - 90, this.got ? `收！（${this.got}）` : '收！', '#ffe2a0', true);
        this.c.impact(this.x, this.y, 2, this.I.L.glow); audio.sfx('bell');
        (this as any)._fx = 1;
      }
    } else if (this.ph === 2) { if (this.pt > 0.45) { this.ph = 3; this.pt = 0; } }
    else if (this.pt > 0.4) this.done = true;
  }
  bodies(out: Drawable[]) {
    const x = this.gx, y = this.gy, a = this.ph === 3 ? 1 - this.pt / 0.4 : 1;
    const wob = this.ph === 1 ? Math.sin(this.t * 30) * 0.06 : this.ph === 2 ? Math.sin(this.pt * 40) * 0.12 * (1 - this.pt / 0.45) : 0;
    out.push({ y: y + 40, draw: (g) => { shadow(g, x, y, 34, a * 0.7); drawArt(g, this.I.L, x, y - this.h - 40, 110, Math.PI + wob, a); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, mx = this.gx, my = this.gy - this.h - 40 + 48;
    F.glow(mx, my, 50, cc, 0.4);
    if (this.ph === 1) {
      const R = 300 * (M(this.I).radius ?? 1);
      F.ground(A.Swirl, this.x, this.y, R, -t * 5, cc, 0.4, 1, 0.5);
      F.ground(A.Swirl, this.x, this.y, R * 0.6, -t * 8, mix(cc, WHITE, 0.4), 0.3, 1, 0.5);
      F.sprite(A.Beam, mx, (my + this.y) / 2, Math.abs(this.y - my), 90, Math.PI / 2, cc, 0.16);
      for (let i = 0; i < 3; i++) { const an = Math.random() * TAU, r = rnd(R * 0.5, R); const sx = this.x + Math.cos(an) * r, sy = this.y + Math.sin(an) * r * 0.5 - 20; F.emit({ x: sx, y: sy, vx: (mx - sx) * 1.8, vy: (my - sy) * 1.8, life: 0.55, s0: 7, s1: 2, c: cc, cell: A.Glow, drag: 1 }); }
      for (const e of this.caught) if (!e.dead && Math.random() < dt * 14) F.emit({ x: e.x, y: e.y - eh(e), vx: (mx - e.x) * 2, vy: (my - e.y) * 2, life: 0.4, s0: 9, s1: 2, c: mix(cc, WHITE, 0.3), cell: A.Wisp });
    }
    if ((this as any)._fx === 1) { (this as any)._fx = 2; F.flash(mx, my, 90, cc, 0.25); F.shockRing(this.x, this.y, 260, cc, 0.45, 0.55, 0.6); for (const e of this.caught) if ((e as any)._gourd) for (let i = 0; i < 14; i++) F.emit({ x: e.x, y: e.y - 40, vx: (mx - e.x) * rnd(2, 3), vy: (my - e.y + 40) * rnd(2, 3), life: 0.35, s0: 12, s1: 3, c: WHITE, cell: A.Glow }); }
  }
}

// —— 伞挡：撑伞护体，挡下飞来的法术；收伞时伞骨四射
class UmbrellaAct extends Act {
  dur: number; spin = 0; blocked = 0; fired = false; ribs: { a: number; d: number }[] = [];
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    this.dur = 3 * (M(I).dur ?? 1);
    const amt = this.c.pStats.hp * (I.art.absorb ?? 0.4) * (M(I).shield ?? 1);
    this.c.shield = { amt, max: amt, t: this.dur, reflect: 0.25, fx: 'gold', color: I.L.glow, art: I.itemId };
    audio.sfx('chime');
  }
  update(dt: number) {
    this.t += dt; this.spin += dt * (this.fired ? 14 : 2.2);
    const p = this.p;
    if (!this.fired) {
      for (const pr of this.c.projs) if (pr.fac === 'e' && pr.life < pr.max && Math.hypot(pr.x - p.x, pr.y - (p.y - 60)) < 170) { pr.life = pr.max + 1; this.blocked++; (this as any)._blk = [pr.x, pr.y]; }
      if (this.t > this.dur || (this.c.shield?.art !== this.I.itemId && this.t > 0.3)) {
        this.fired = true;
        if (this.c.shield?.art === this.I.itemId) this.c.shield = null;
        for (let i = 0; i < 16; i++) this.ribs.push({ a: i / 16 * TAU, d: 0 });
        for (const e of this.near(p.x, p.y, 280)) { this.hit(e, this.I.dmg * (1 + this.blocked * 0.1), p.x, p.y); pushE(e, p.x, p.y, 70); }
        const heal = M(this.I).heal; if (heal) { this.c.game.hero.hp = Math.min(1, this.c.game.hero.hp + heal); say(this, p.x, p.y - 150, '青木回春', '#a8f0a0'); }
        if (this.blocked) say(this, p.x, p.y - 130, `挡下 ${this.blocked} 记`, '#e8f0ff');
        audio.sfx('whoosh'); this.t = 0;
      }
    } else {
      for (const r of this.ribs) r.d += dt * 900;
      if (this.t > 0.4) this.done = true;
    }
  }
  bodies(out: Drawable[]) {
    const p = this.p, a = this.fired ? 1 - this.t / 0.4 : clamp(this.t / 0.15, 0, 1);
    out.push({ y: p.y + 6, draw: (g) => { g.save(); g.translate(p.x, p.y - 150); g.scale(1, 0.7 + 0.3 * Math.abs(Math.cos(this.spin * 0.2))); drawArt(g, this.I.L, 0, 0, 150, Math.sin(this.spin) * 0.08, a); g.restore(); } });
  }
  glow(F: FxSys, t: number) {
    const p = this.p, cc = this.I.cc;
    if (!this.fired) {
      F.ring(p.x, p.y - 60, 150, cc, 0.35 + 0.1 * Math.sin(t * 8), 0.9, true);
      F.glow(p.x, p.y - 80, 150, cc, 0.12);
      for (let i = 0; i < 2; i++) { const an = Math.random() * TAU; F.emit({ x: p.x + Math.cos(an) * 120, y: p.y - 150 + Math.sin(an) * 30, vx: 0, vy: 140, life: 0.6, s0: 4, s1: 1, c: cc, cell: A.Glow }); }
      const b = (this as any)._blk; if (b) { (this as any)._blk = null; F.sparks(b[0], b[1], cc, 10, 300, 0.3, 3); F.flash(b[0], b[1], 30, cc, 0.12); }
    } else for (const r of this.ribs) { const x = p.x + Math.cos(r.a) * r.d, y = p.y - 60 + Math.sin(r.a) * r.d * 0.55; F.sprite(A.Streak, x, y, 46, 8, r.a, mix(cc, WHITE, 0.5), 0.9 * (1 - this.t / 0.4)); }
  }
}

// —— 扇风：一扇卷地狂风，扇飞敌人
class FanAct extends Act {
  ang: number; pushed = new Map<number, number>(); hitDone = false; R = 540;
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.ang = Math.atan2(t.y - this.p.y, t.x - this.p.x); audio.sfx('whoosh'); }
  update(dt: number) {
    this.t += dt;
    const p = this.p, burn = M(this.I).burn || this.I.art.element === 'fire';
    if (this.t > 0.18 && !this.hitDone) {
      this.hitDone = true;
      for (const e of this.c.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - this.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        if (d < this.R && Math.abs(da) < 0.6) {
          this.hit(e, this.I.dmg * (1.1 - d / this.R * 0.4), p.x, p.y, burn ? { ...this.I.src, status: { k: 'burn', dur: 4, ch: 1 }, stCh: 1 } : this.I.src);
          this.pushed.set(e.id, (e.boss ? 60 : 300) * (1 - d / this.R * 0.5));
        }
      }
    }
    for (const e of this.c.enemies) { const left = this.pushed.get(e.id); if (!left || e.dead) continue; const step = Math.min(left, 900 * dt); e.x += Math.cos(this.ang) * step; e.y += Math.sin(this.ang) * step * 0.7; this.pushed.set(e.id, left - step); }
    if (this.t > 0.7) this.done = true;
  }
  bodies(out: Drawable[]) {
    const p = this.p, sw = clamp(this.t / 0.2, 0, 1), a = this.t > 0.5 ? 1 - (this.t - 0.5) / 0.2 : 1;
    const rot = this.ang - 1 + sw * 2;
    out.push({ y: p.y + 4, draw: (g) => drawArt(g, this.I.L, p.x + Math.cos(this.ang) * 50, p.y - 70 + Math.sin(this.ang) * 20, 100, rot + Math.PI / 2, a) });
  }
  glow(F: FxSys, _t: number, dt: number) {
    if (!this.hitDone || this.t > 0.6) return;
    const p = this.p, cc = this.I.cc, fire = M(this.I).burn || this.I.art.element === 'fire';
    for (let i = 0; i < 6; i++) {
      const a = this.ang + rnd(-0.55, 0.55), sp = rnd(700, 1100), x = p.x + Math.cos(a) * 40, y = p.y - 40 + Math.sin(a) * 20;
      F.emit({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, life: rnd(0.35, 0.5), s0: rnd(30, 60), s1: rnd(80, 120), c: fire ? [1, rnd(0.4, 0.7), 0.2] : mix(cc, WHITE, 0.6), a: fire ? 0.7 : 0.35, cell: fire ? A.Flame : A.Wisp, rot: a });
      F.emit({ x, y, vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 0.9, life: 0.25, s0: 6, s1: 2, c: WHITE, stretch: 0.05, cell: A.Streak, rot: a });
    }
    if (Math.random() < dt * 20) { const d = rnd(150, 450), a = this.ang + rnd(-0.4, 0.4); F.ground(A.Swirl, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, 70, Math.random() * TAU, cc, 0.3, 1, 0.5); }
  }
}

// —— 连珠：宝珠依次打出，在敌人之间弹跳
interface Bead { x: number; y: number; h: number; tgt: Enemy | null; hops: number; hit: Set<number>; delay: number; dead: boolean; k: number; trail: [number, number][] }
class BeadsAct extends Act {
  bs: Bead[] = []; maxHops: number;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const n = Math.max(1, I.art.pieces + (M(I).addPieces ?? 0));
    this.maxHops = 3 + (M(I).chain ?? 0);
    for (let i = 0; i < n; i++) this.bs.push({ x: this.p.x, y: this.p.y, h: 70, tgt: null, hops: 0, hit: new Set(), delay: i * 0.12, dead: false, k: 1, trail: [] });
    audio.sfx('whoosh');
  }
  update(dt: number) {
    this.t += dt;
    let alive = 0;
    for (const b of this.bs) {
      if (b.dead) continue; alive++;
      if (b.delay > 0) { b.delay -= dt; b.x = this.p.x; b.y = this.p.y; continue; }
      if (!b.tgt || b.tgt.dead) {
        b.tgt = b.hops === 0 && this.I.target && !this.I.target.dead ? this.I.target : this.nearestE(b.x, b.y, b.hops === 0 ? this.reach : 400, b.hit);
        if (!b.tgt) { b.dead = true; continue; }
      }
      const tg = b.tgt, dx = tg.x - b.x, dy = tg.y - b.y, d = Math.hypot(dx, dy), sp = 1500 * dt;
      b.h = lerp(b.h, eh(tg), dt * 10);
      if (d < sp + 20) {
        this.hit(tg, this.I.dmg * 0.75 * b.k, b.x, b.y); b.hit.add(tg.id); b.hops++; b.k *= 0.88; (b as any)._pop = [tg.x, tg.y - eh(tg)];
        b.tgt = null; if (b.hops > this.maxHops) b.dead = true;
        if (Math.random() < 0.5) audio.sfx('clang');
      } else { b.x += dx / d * sp; b.y += dy / d * sp; }
      b.trail.push([b.x, b.y - b.h]); if (b.trail.length > 10) b.trail.shift();
      if (this.t > 5) b.dead = true;
    }
    if (!alive) this.done = true;
  }
  bodies(out: Drawable[]) { for (const b of this.bs) if (!b.dead && b.delay <= 0) out.push({ y: b.y + 40, draw: (g) => drawArt(g, this.I.L, b.x, b.y - b.h, 30, this.t * 12) }); }
  glow(F: FxSys) {
    const cc = this.I.cc, th = this.I.art.element === 'thunder';
    for (const b of this.bs) {
      const pp = (b as any)._pop; if (pp) { (b as any)._pop = null; F.sparks(pp[0], pp[1], cc, 10, 320, 0.3, 3); F.flash(pp[0], pp[1], 30, cc, 0.12); if (th) F.bolt(pp[0], pp[1] - 200, pp[0], pp[1], Math.random() * 1e6, 20, 1.6, cc, 0.9, 8, false); }
      if (b.dead || b.delay > 0) continue;
      F.trail(b.trail, 14, cc, 0.5); F.glow(b.x, b.y - b.h, 22, cc, 0.6); F.glow(b.x, b.y - b.h, 8, WHITE, 0.9, A.Star);
    }
  }
}

// —— 罩子困人：宝罩当头罩下，罩中之敌动弹不得，越缩越紧，最后炸开
class CoverAct extends Act {
  ph = 0; pt = 0; x: number; y: number; R0: number; R: number; tick = 0; trapped: Enemy[] = [];
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.x = t.x; this.y = t.y; this.R0 = this.R = 160 * (M(I).radius ?? 1); audio.sfx('whoosh'); }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const D = 3 * (M(this.I).dur ?? 1);
    if (this.ph === 0) { if (this.pt > 0.4) { this.ph = 1; this.pt = 0; this.trapped = this.near(this.x, this.y, this.R + 20); for (const e of this.trapped) stat(this, e, 'root', D); this.c.impact(this.x, this.y, 1, this.I.L.glow); audio.sfx('bell'); if (this.trapped.length) say(this, this.x, this.y - 200, '困！', '#e8d0ff', true); } }
    else if (this.ph === 1) {
      this.R = lerp(this.R0, this.R0 * 0.55, this.pt / D);
      this.tick += dt;
      for (const e of this.trapped) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
        if (d > this.R - 20) { e.x = this.x + dx / d * (this.R - 20); e.y = this.y + dy / d * (this.R - 20); }
      }
      if (this.tick > 0.5) { this.tick = 0; for (const e of this.trapped) if (!e.dead) this.hit(e, this.I.dmg * 0.18, this.x, this.y, { ...this.I.src, status: undefined, stCh: 0 }); }
      if (this.pt > D) { this.ph = 2; this.pt = 0; for (const e of this.near(this.x, this.y, this.R + 40)) { this.hit(e, this.I.dmg * 1.5, this.x, this.y); pushE(e, this.x, this.y, 60); } this.c.impact(this.x, this.y, 3, this.I.L.glow); audio.sfx('boom'); (this as any)._boom = 1; }
    } else if (this.pt > 0.4) this.done = true;
  }
  bodies(out: Drawable[]) {
    if (this.ph === 2) return;
    const fall = this.ph === 0 ? (1 - ease(this.pt / 0.4)) * 400 : 0, s = this.R * 2.1 / 1.0;
    out.push({ y: this.y + this.R * 0.3, draw: (g) => { shadow(g, this.x, this.y, this.R, 0.5); drawArt(g, this.I.L, this.x, this.y - this.R * 0.55 - fall, s, 0, 0.55); } });
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc;
    if (this.ph === 1) { F.ground(A.Rune, this.x, this.y, this.R, t * 1.5, cc, 0.35, 1, 0.5); F.ring(this.x, this.y, this.R, cc, 0.5, 0.5, true); F.glow(this.x, this.y - this.R * 0.5, this.R, cc, 0.1); if (Math.random() < 0.3) { const a = Math.random() * TAU; F.bolt(this.x, this.y - this.R * 1.1, this.x + Math.cos(a) * this.R * 0.8, this.y + Math.sin(a) * this.R * 0.4, Math.random() * 1e6, 12, 1, mix(cc, WHITE, 0.4), 0.6, 6, false); } }
    if ((this as any)._boom === 1) { (this as any)._boom = 2; F.flash(this.x, this.y - 60, this.R, cc, 0.25); F.shockRing(this.x, this.y, this.R * 2, cc, 0.5, 0.55, 0.8); F.sparks(this.x, this.y - 40, cc, 30, 600, 0.5, 4); }
  }
}

// —— 塔镇：宝塔自天镇落，塔下方圆寸步难行
class PagodaAct extends Act {
  ph = 0; pt = 0; x: number; y: number; tick = 0; R: number;
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.x = t.x; this.y = t.y; this.R = 260 * (M(I).radius ?? 1); audio.sfx('chime'); }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const D = 4 * (M(this.I).dur ?? 1);
    if (this.ph === 0) { if (this.pt > 0.55) { this.ph = 1; this.pt = 0; for (const e of this.near(this.x, this.y, 180)) { this.hit(e, this.I.dmg * 1.4, this.x, this.y); stat(this, e, 'stun', 1.2); } this.c.impact(this.x, this.y, 3, this.I.L.glow); audio.sfx('boom'); (this as any)._slam = 1; } }
    else if (this.ph === 1) {
      this.tick += dt;
      if (this.tick > 0.5) { this.tick = 0; for (const e of this.near(this.x, this.y, this.R)) { stat(this, e, 'slow', 0.8); this.hit(e, this.I.dmg * 0.15, this.x, this.y, { ...this.I.src, status: M(this.I).stun ? { k: 'stun', dur: 0.4, ch: 0.5 } : undefined, stCh: 0.5 }); if (Math.random() < 0.15) say(this, e.x, e.y - 110, '镇', '#ffd890'); } }
      if (this.pt > D) { this.ph = 2; this.pt = 0; }
    } else if (this.pt > 0.45) this.done = true;
  }
  get h() { return this.ph === 0 ? (1 - easeIn(this.pt / 0.55)) * 600 : this.ph === 2 ? easeIn(this.pt / 0.45) * 500 : 0; }
  bodies(out: Drawable[]) {
    const a = this.ph === 2 ? 1 - this.pt / 0.45 : 1;
    out.push({ y: this.y + 30, draw: (g) => { shadow(g, this.x, this.y, 70 + (this.ph === 0 ? this.pt * 60 : 30), 0.8 * a); drawArt(g, this.I.L, this.x, this.y - 90 - this.h, 190, 0, a); } });
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc;
    if (this.ph === 0) { F.ground(A.Disc, this.x, this.y, 180, 0, [0.08, 0.07, 0.06], 0.25 * this.pt / 0.55, 0, 0.5); F.ground(A.Ring, this.x, this.y, 180, 0, cc, 0.3, 1, 0.5); }
    if (this.ph === 1) {
      F.ground(A.Bagua, this.x, this.y, this.R, t * 0.6, cc, 0.3, 1, 0.5); F.ground(A.Crack, this.x, this.y, this.R * 0.7, 0, [0.06, 0.05, 0.04], 0.5, 0, 0.5);
      F.sprite(A.Beam, this.x, this.y - 300, 600, 120, Math.PI / 2, cc, 0.1 + 0.05 * Math.sin(t * 6));
      if (Math.random() < 0.4) F.emit({ x: this.x + rnd(-this.R, this.R), y: this.y - rnd(200, 360), vx: 0, vy: 380, life: 0.5, s0: 4, s1: 1, c: cc, stretch: 0.06, cell: A.Streak, rot: Math.PI / 2 });
    }
    if ((this as any)._slam === 1) { (this as any)._slam = 2; F.flash(this.x, this.y - 40, 180, cc, 0.3); F.shockRing(this.x, this.y, 420, cc, 0.5, 0.55, 0.9); F.shock(this.x, this.y, 700, 26, 0.6); F.smoke(this.x, this.y, 14, [0.25, 0.22, 0.18], 0.5, 120, 90); }
  }
}

// —— 印压：大印凌空暴涨，阴影追着敌人，轰然压下，护体灵光尽碎
class SealAct extends Act {
  ph = 0; pt = 0; x: number; y: number;
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.x = t.x; this.y = t.y; audio.sfx('chime'); }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    if (this.ph === 0) {
      const tg = this.I.target; if (tg && !tg.dead) { this.x = lerp(this.x, tg.x, dt * 6); this.y = lerp(this.y, tg.y, dt * 6); }
      if (this.pt > 0.6) { this.ph = 1; this.pt = 0; }
    } else if (this.ph === 1) {
      if (this.pt > 0.12 && !(this as any)._hit) {
        (this as any)._hit = 1;
        const R = 130 * (M(this.I).radius ?? 1);
        for (const e of this.near(this.x, this.y, R)) { this.hit(e, this.I.dmg * 1.6, this.x, this.y, { ...this.I.src, status: { k: 'break', dur: 4, ch: 1 }, stCh: 1 }); stat(this, e, 'stun', 0.8); }
        this.c.impact(this.x, this.y, 3, this.I.L.glow); audio.sfx('boom'); this.c.game.trauma = Math.min(1, this.c.game.trauma + 0.25);
        say(this, this.x, this.y - 170, '印！', '#ffcf80', true);
      }
      if (this.pt > 0.7) this.done = true;
    }
  }
  bodies(out: Drawable[]) {
    const grow = this.ph === 0 ? 0.4 + 0.6 * ease(this.pt / 0.6) : 1;
    const h = this.ph === 0 ? 300 : Math.max(0, 300 * (1 - easeIn(this.pt / 0.12)));
    const a = this.ph === 1 && this.pt > 0.4 ? 1 - (this.pt - 0.4) / 0.3 : 1;
    out.push({ y: this.y + 40, draw: (g) => { shadow(g, this.x, this.y, 110 * grow, 0.7 * a); drawArt(g, this.I.L, this.x, this.y - 40 - h, 200 * grow, 0, a); } });
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc;
    if (this.ph === 0) { F.ground(A.Seal, this.x, this.y, 130, t, cc, 0.25 + 0.3 * this.pt, 1, 0.5); F.glow(this.x, this.y - 340, 120, cc, 0.2); }
    if ((this as any)._hit === 1) { (this as any)._hit = 2; F.flash(this.x, this.y - 30, 160, cc, 0.3); F.shockRing(this.x, this.y, 360, cc, 0.45, 0.55, 0.9); F.ground(A.Seal, this.x, this.y, 150, 0, cc, 0.8, 1, 0.5); F.sparks(this.x, this.y, cc, 24, 500, 0.4, 3.5); F.smoke(this.x, this.y, 10, [0.25, 0.22, 0.18], 0.45, 100, 80); }
  }
}

// —— 灯照魂：魂灯悬在肩头，灯光扫向敌人，烧的是神魂；鬼物加倍
class LampAct extends Act {
  ang = 0; tick = 0; lx = 0; ly = 0; dur: number; heal = 0;
  constructor(c: Combat, I: ActInit) { super(c, I); this.dur = 4 * (M(I).dur ?? 1); const t = tgtPt(this); this.ang = Math.atan2(t.y - this.p.y, t.x - this.p.x); audio.sfx('chime'); }
  update(dt: number) {
    this.t += dt; this.tick += dt;
    const p = this.p; this.lx = p.x + 50; this.ly = p.y - 120 + Math.sin(this.t * 3) * 6;
    const tg = this.nearestE(p.x, p.y, 520); if (tg) this.ang = angLerp(this.ang, Math.atan2(tg.y - p.y, tg.x - p.x), dt * 5);
    if (this.tick > 0.3) {
      this.tick = 0;
      for (const e of this.c.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - this.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        if (d < 520 && Math.abs(da) < 0.38) {
          e.hideT = 0;
          const dm = this.I.dmg * 0.26 * (isEvil(e) ? 2 : 1);
          this.hit(e, dm, p.x, p.y, { ...this.I.src, evil: 2 });
          const hk = M(this.I).heal; if (hk) this.heal += dm * hk;
        }
      }
      if (this.heal > 0) { const h = this.c.game.hero; h.hp = Math.min(1, h.hp + this.heal / Math.max(1, this.c.pStats.hp)); this.heal = 0; }
    }
    if (this.t > this.dur) this.done = true;
  }
  bodies(out: Drawable[]) { const a = clamp(Math.min(this.t / 0.2, (this.dur - this.t) / 0.3), 0, 1); out.push({ y: this.p.y + 5, draw: (g) => drawArt(g, this.I.L, this.lx, this.ly, 70, Math.sin(this.t * 2) * 0.1, a) }); }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc, x = this.lx, y = this.ly - 18;
    F.glow(x, y, 46, cc, 0.7); F.glow(x, y, 14, WHITE, 0.9, A.Core);
    for (let i = -2; i <= 2; i++) { const a = this.ang + i * 0.14; F.sprite(A.Beam, x + Math.cos(a) * 260, y + 60 + Math.sin(a) * 200, 520, 70, a, cc, 0.08 + 0.03 * Math.sin(t * 5 + i)); }
    if (Math.random() < 0.5) { const a = this.ang + rnd(-0.35, 0.35), d = rnd(80, 480); F.emit({ x: this.p.x + Math.cos(a) * d, y: this.p.y - 40 + Math.sin(a) * d * 0.8, vx: rnd(-20, 20), vy: -rnd(30, 70), life: 0.8, s0: 6, s1: 1, c: cc, cell: A.Wisp }); }
    for (const e of this.c.enemies) if (!e.dead && Math.random() < 0.08) { const dx = e.x - this.p.x, dy = e.y - this.p.y; let da = Math.atan2(dy, dx) - this.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; if (Math.abs(da) < 0.38 && Math.hypot(dx, dy) < 520) F.emit({ x: e.x, y: e.y - eh(e), vx: 0, vy: -80, life: 0.6, s0: 14, s1: 4, c: mix(cc, WHITE, 0.4), cell: A.KWisp1 as number }); }
  }
}

// —— 梭遁：人随梭走，穿过敌阵（借用身法冲刺：路径伤敌、遁中免伤）
class ShuttleAct extends Act {
  ang: number;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const p = this.p, t = tgtPt(this, this.reach * 0.75);
    this.ang = Math.atan2(t.y - p.y, t.x - p.x);
    const dist = Math.min(this.reach * 0.75, Math.hypot(t.x - p.x, t.y - p.y) + 160), dur = 0.28;
    this.c.dash = { t: 0, dur, vx: Math.cos(this.ang) * dist / dur, vy: Math.sin(this.ang) * dist / dur, dmg: I.dmg, hit: new Set(), invuln: true, color: I.L.glow };
    audio.sfx('whoosh');
  }
  update(dt: number) { this.t += dt; if (this.t > 0.45) this.done = true; }
  bodies(out: Drawable[]) { if (this.t > 0.32) return; const p = this.p; out.push({ y: p.y + 10, draw: (g) => drawArt(g, this.I.L, p.x + Math.cos(this.ang) * 30, p.y - 50, 110, this.ang) }); }
  glow(F: FxSys) {
    if (this.t > 0.34) return;
    const p = this.p, cc = this.I.cc;
    F.glow(p.x, p.y - 50, 60, cc, 0.5);
    for (let i = 0; i < 4; i++) F.emit({ x: p.x + rnd(-20, 20), y: p.y - 50 + rnd(-14, 14), vx: -Math.cos(this.ang) * 600, vy: -Math.sin(this.ang) * 600, life: 0.3, s0: 30, s1: 6, c: mix(cc, WHITE, 0.4), stretch: 0.05, cell: A.Streak, rot: this.ang });
  }
}

// —— 鞭：鞭影连抽三记，最后一记把人卷到跟前
class WhipAct extends Act {
  ang: number; lash = -1; R = 340; tip: [number, number][] = [];
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.ang = Math.atan2(t.y - this.p.y, t.x - this.p.x); audio.sfx('whoosh'); }
  cur() { const k = Math.floor(this.t / 0.26), u = clamp((this.t - k * 0.26) / 0.18, 0, 1); return { k, u }; }
  sweepA(k: number, u: number) { const s = k === 0 ? -1 : k === 1 ? 1 : 0; return k === 2 ? this.ang : this.ang + s * (0.9 - u * 1.8); }
  update(dt: number) {
    this.t += dt;
    const { k, u } = this.cur(), p = this.p;
    if (k <= 2 && k !== this.lash && u > 0.5) {
      this.lash = k;
      for (const e of this.c.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - this.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const wide = k === 2 ? 0.25 : 0.95;
        if (d < this.R + 30 && Math.abs(da) < wide) {
          this.hit(e, this.I.dmg * (k === 2 ? 0.9 : 0.6), p.x, p.y);
          if (k === 2 && !e.boss) { e.x = lerp(e.x, p.x + Math.cos(this.ang) * 90, 0.75); e.y = lerp(e.y, p.y + Math.sin(this.ang) * 50, 0.75); }
        }
      }
      audio.sfx(k === 2 ? 'clang' : 'whoosh');
    }
    if (this.t > 0.8) this.done = true;
  }
  tipPt() { const { k, u } = this.cur(); const a = this.sweepA(Math.min(2, k), u), r = this.R * (k === 2 ? 0.4 + 0.6 * u : 1); return [this.p.x + Math.cos(a) * r, this.p.y - 50 + Math.sin(a) * r * 0.7] as [number, number]; }
  bodies(out: Drawable[]) {
    if (this.t > 0.78) return;
    const p = this.p, L = this.I.L, [tx, ty] = this.tipPt(), hx = p.x + Math.cos(this.ang) * 20, hy = p.y - 60;
    out.push({ y: p.y + 6, draw: (g) => {
      const mx = (hx + tx) / 2 - Math.sin(this.ang) * 40, my = (hy + ty) / 2 - 40;
      g.save(); g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(mx, my, tx, ty); g.strokeStyle = 'rgba(30,24,18,0.85)'; g.lineWidth = 9; g.stroke();
      g.strokeStyle = L.c1; g.lineWidth = 5.5; g.stroke(); g.strokeStyle = L.c2; g.lineWidth = 1.4; g.setLineDash([4, 6]); g.stroke(); g.setLineDash([]);
      g.restore();
    } });
  }
  glow(F: FxSys) {
    if (this.t > 0.78) return;
    const cc = this.I.cc, t = this.tipPt();
    this.tip.push(t); if (this.tip.length > 12) this.tip.shift();
    F.trail(this.tip, 26, cc, 0.4); F.trail(this.tip, 7, mix(cc, WHITE, 0.6), 0.85);
    F.glow(t[0], t[1], 20, WHITE, 0.8, A.Star);
    if (this.lash >= 0 && (this as any)._l !== this.lash) { (this as any)._l = this.lash; F.sparks(t[0], t[1], cc, 12, 420, 0.3, 3); F.flash(t[0], t[1], 40, cc, 0.12); }
  }
}

// —— 阵盘：掷地成阵，阵中灵光不断劈落
class DiskAct extends Act {
  ph = 0; pt = 0; x: number; y: number; sx: number; sy: number; R: number; tick = 0; strikes: { x: number; y: number; t: number; seed: number }[] = [];
  constructor(c: Combat, I: ActInit) { super(c, I); const t = tgtPt(this); this.x = t.x; this.y = t.y; this.sx = this.p.x; this.sy = this.p.y; this.R = 210 * (M(I).radius ?? 1); audio.sfx('whoosh'); }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    const D = 6 * (M(this.I).dur ?? 1);
    if (this.ph === 0) { if (this.pt > 0.35) { this.ph = 1; this.pt = 0; audio.sfx('chime'); } }
    else if (this.ph === 1) {
      this.tick += dt;
      if (this.tick > 0.45) {
        this.tick = 0;
        const es = this.near(this.x, this.y, this.R);
        for (let i = 0; i < Math.min(2, es.length); i++) { const e = es[Math.floor(Math.random() * es.length)]; this.hit(e, this.I.dmg * 0.65, this.x, this.y); this.strikes.push({ x: e.x, y: e.y, t: 0, seed: Math.random() * 1e6 }); }
        if (es.length && Math.random() < 0.5) audio.sfx('thunder');
      }
      if (this.pt > D) { this.ph = 2; this.pt = 0; }
    } else if (this.pt > 0.4) this.done = true;
    for (const s of this.strikes) s.t += dt;
    this.strikes = this.strikes.filter((s) => s.t < 0.25);
  }
  bodies(out: Drawable[]) {
    if (this.ph === 0) { const u = this.pt / 0.35, x = lerp(this.sx, this.x, u), y = lerp(this.sy, this.y, u), h = Math.sin(u * Math.PI) * 140 + 30; out.push({ y: y + 20, draw: (g) => drawArt(g, this.I.L, x, y - h, 50, this.t * 12) }); }
    else { const a = this.ph === 2 ? 1 - this.pt / 0.4 : 1; out.push({ y: this.y - 200, draw: (g) => { g.save(); g.translate(this.x, this.y); g.scale(1, 0.45); drawArt(g, this.I.L, 0, 0, 64, this.t * 0.8, a); g.restore(); } }); }
  }
  glow(F: FxSys, t: number) {
    if (this.ph === 0) return;
    const cc = this.I.cc, a = this.ph === 2 ? 1 - this.pt / 0.4 : clamp(this.pt / 0.3, 0, 1), sw = this.I.art.element === 'gold';
    F.ground(A.Bagua, this.x, this.y, this.R, t * 0.4, cc, 0.35 * a, 1, 0.5); F.ground(A.Rune, this.x, this.y, this.R * 0.7, -t * 0.7, cc, 0.3 * a, 1, 0.5); F.ring(this.x, this.y, this.R, cc, 0.4 * a, 0.5, true);
    for (const s of this.strikes) {
      const k = 1 - s.t / 0.25;
      if (sw) { F.sprite(A.Blade, s.x, s.y - 140 + s.t * 400, 140, 26, Math.PI / 2, cc, k); }
      else F.bolt(s.x + rnd(-8, 8), s.y - 360, s.x, s.y - 30, s.seed + Math.floor(s.t * 30), 26, 2.2, mix(cc, WHITE, 0.3), k, 10, true);
      if (s.t < 0.02) { F.flash(s.x, s.y - 30, 40, cc, 0.12); F.sparks(s.x, s.y - 30, cc, 10, 300, 0.3, 3); }
    }
  }
}

// —— 傀儡：放出傀儡自行扑杀（不吃仇恨，十余息后收回）
interface Pup { x: number; y: number; vx: number; cd: number; tgt: Enemy | null; face: number; atkT: number; hop: number }
class PuppetAct extends Act {
  ps: Pup[] = []; life: number;
  constructor(c: Combat, I: ActInit) {
    super(c, I);
    const n = 1 + (M(I).addPieces ?? 0);
    this.life = 12 * (M(I).dur ?? 1);
    for (let i = 0; i < n; i++) this.ps.push({ x: this.p.x + (i ? -60 : 60), y: this.p.y + 20, vx: 0, cd: 0.4, tgt: null, face: 1, atkT: 0, hop: 0 });
    audio.sfx('land');
  }
  update(dt: number) {
    this.t += dt;
    for (const u of this.ps) {
      u.cd -= dt; u.atkT = Math.max(0, u.atkT - dt); u.hop += dt * 9;
      if (!u.tgt || u.tgt.dead) u.tgt = this.nearestE(u.x, u.y, this.reach);
      const tg = u.tgt;
      const gx = tg ? tg.x - u.face * 50 : this.p.x + 70, gy = tg ? tg.y : this.p.y + 20;
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
      if (d > 12) { const sp = Math.min(d, 300 * dt); u.x += dx / d * sp; u.y += dy / d * sp; }
      if (tg) u.face = tg.x >= u.x ? 1 : -1;
      if (tg && Math.hypot(tg.x - u.x, tg.y - u.y) < 90 && u.cd <= 0) {
        u.cd = 0.75; u.atkT = 0.25;
        for (const e of this.near(u.x + u.face * 30, u.y, 80)) this.hit(e, this.I.dmg * 0.5, u.x, u.y);
        (u as any)._fx = 1; if (Math.random() < 0.5) audio.sfx('clang');
      }
    }
    if (this.t > this.life) this.done = true;
  }
  bodies(out: Drawable[]) {
    const a = clamp(Math.min(this.t / 0.3, (this.life - this.t) / 0.4), 0, 1);
    for (const u of this.ps) out.push({ y: u.y, draw: (g) => { shadow(g, u.x, u.y, 26, a); drawArt(g, this.I.L, u.x, u.y - 46 - Math.abs(Math.sin(u.hop)) * 6, 86, u.atkT > 0 ? u.face * 0.35 : Math.sin(u.hop) * 0.05, a, u.face < 0); } });
  }
  glow(F: FxSys) {
    const cc = this.I.cc;
    for (const u of this.ps) {
      F.glow(u.x, u.y - 50, 26, cc, 0.25);
      if ((u as any)._fx) { (u as any)._fx = 0; const x = u.x + u.face * 50, y = u.y - 50; F.sparks(x, y, cc, 12, 360, 0.3, 3); slashFx(F, x, y, u.face > 0 ? 0 : Math.PI, cc, 0.6); }
    }
  }
}

// ============================================================== 管理器
export class ArtActs {
  list: Act[] = [];
  constructor(public c: Combat) {}
  reset() { this.list = []; }
  get busy() { return this.list.length > 0; }

  /** 发动法器。返回 true 表示已接管（无须走旧的弹道逻辑） */
  spawn(I: ActInit, summonDur = 15): boolean {
    applyArtMods(this.c, I);
    const k = I.art.kind, sh = I.L.shape;
    // 灵焰：同一件法器续火，不叠新实体
    if (k === 'flame') {
      const old = this.list.find((a) => a instanceof FlameAct && a.I.itemId === I.itemId && !a.done) as FlameAct | undefined;
      if (old) { old.I = I; old.fire(); return true; }
      this.list.push(new FlameAct(this.c, I)); return true;
    }
    let a: Act | null = null;
    if (sh === 'talisman') a = new FubaoAct(this.c, I);
    else if (sh === 'jinfu') a = new JinfuAct(this.c, I);
    else if (k === 'sword') a = new SwordAct(this.c, I);
    else if (k === 'needle') a = new NeedleAct(this.c, I);
    else if (k === 'ring') a = new RingAct(this.c, I);
    else if (k === 'mirror') a = new MirrorAct(this.c, I);
    else if (k === 'slam') a = new SlamAct(this.c, I);
    else if (k === 'arrow') a = new ArrowAct(this.c, I);
    else if (k === 'bell') a = new BellAct(this.c, I);
    else if (k === 'bind') a = new BindAct(this.c, I);
    else if (k === 'banner') a = new BannerAct(this.c, I, summonDur);
    else if (k === 'cauldron') a = new CauldronAct(this.c, I);
    else if (k === 'gourd') a = new GourdAct(this.c, I);
    else if (k === 'umbrella') a = new UmbrellaAct(this.c, I);
    else if (k === 'fan') a = new FanAct(this.c, I);
    else if (k === 'beads') a = new BeadsAct(this.c, I);
    else if (k === 'cover') a = new CoverAct(this.c, I);
    else if (k === 'pagoda') a = new PagodaAct(this.c, I);
    else if (k === 'seal') a = new SealAct(this.c, I);
    else if (k === 'lamp') a = new LampAct(this.c, I);
    else if (k === 'shuttle') a = new ShuttleAct(this.c, I);
    else if (k === 'whip') a = new WhipAct(this.c, I);
    else if (k === 'disk') a = new DiskAct(this.c, I);
    else if (k === 'puppet') a = new PuppetAct(this.c, I);
    if (!a) return false;
    this.list.push(a);
    if (this.list.length > 40) this.list.shift();
    return true;
  }
  /** 天雷子 */
  bomb(I: ActInit) { this.list.push(new BombAct(this.c, I)); }
  update(dt: number) {
    for (const a of this.list) a.update(dt);
    this.list = this.list.filter((a) => !a.done);
  }
  collect(out: Drawable[]) { for (const a of this.list) a.bodies(out); }
  drawGL(F: FxSys, t: number, dt: number) { for (const a of this.list) a.glow(F, t, dt); }
}

let comboTxtT = -99;
/** 第 4 阶段：法宝出手前套上功法路子、辅修与套路（倍率、件数、异状） */
export function applyArtMods(c: Combat, I: ActInit) {
  if (I.mods) return;
  const m = artMods(c.game.hero, I.itemId, I.art);
  I.mods = m;
  I.dmg *= m.dmg ?? 1;
  if (m.addPieces && (I.art.kind === 'sword' || I.art.kind === 'needle')) I.pieces += m.addPieces;
  const st: StatusSpec | undefined = m.freeze ? { k: 'freeze', dur: 1.8, ch: 1 } : m.burn ? { k: 'burn', dur: 4, ch: 1 } : m.stun ? { k: 'stun', dur: 1, ch: 1 } : undefined;
  if (st) I.src = { ...I.src, status: st, stCh: 1 };
  if (m.combos.length && c.game.time - comboTxtT > 2.5) {
    comboTxtT = c.game.time;
    const p = c.game.player;
    c.texts.push({ x: p.x, y: p.y - 175, s: '套路·' + m.combos.join('·'), color: '#ffd27a', t: 0, vy: -28, big: true });
  }
}

/** 物品 id → 外观（供外部使用） */
export function lookOf(id: string) { const d = itemDef(id); return artLook(id, d.art?.kind, d.art?.color); }
