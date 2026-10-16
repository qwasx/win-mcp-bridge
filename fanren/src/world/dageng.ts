// 第二十八步：大庚剑阵——三段式
//   一、布阵：七十二口青竹蜂云剑自身后冲天而起，划弧落入「周天星斗」三重剑环，星线相连，剑幕垂地，阵中之敌被困。
//   二、剑丝风暴：剑影分光，万千金色剑丝在阵内纵横穿梭；辟邪神雷自剑尖劈落。
//   三、层层收缩：三重剑环向阵心绞杀收拢，最后一爆，剑归身后。
import type { Combat, Enemy } from './combat';
import type { Drawable } from './life';
import type { FxSys, RGB } from '../gl/fx';
import { C as A } from '../gl/atlas';
import { Act, ActInit, Src, eh } from './artacts';
import { drawArt } from '../gfx/artifact';
import { audio } from './audio';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeIn = (u: number) => Math.pow(clamp(u, 0, 1), 2.2);
const GOLD: RGB = [1, 0.84, 0.42], PALE: RGB = [1, 0.96, 0.8], JADE: RGB = [0.55, 1, 0.75], WHITE: RGB = [1, 1, 1];
const SQ = 0.55;

interface Sw { ring: number; idx: number; a0: number; x: number; y: number; h: number; ang: number; delay: number; arrived: number; sx: number; sy: number; flash: number }

// 阶段时间点
const T_FORM = 1.6, T_STORM = T_FORM + 3.2, T_SHRINK = T_STORM + 1.3, T_END = T_SHRINK + 0.9;

export class DagengAct extends Act {
  sw: Sw[] = [];
  cx: number; cy: number; R: number; shrink = 1; spin = [0, 0, 0];
  trapped = new Set<number>();
  tickT = 0; boltT = 0.2; burst = false; burstT = -1;
  bolts: { x1: number; y1: number; x2: number; y2: number; t: number; seed: number }[] = [];
  slashes: { x: number; y: number; a: number }[] = [];
  per: number; lv: number;
  constructor(c: Combat, I: ActInit, cx: number, cy: number, R: number, lv: number) {
    super(c, I);
    this.cx = cx; this.cy = cy; this.R = R; this.lv = lv; this.per = I.dmg;
    const n = I.pieces;
    // 周天星斗：外环 1/2、中环 1/3、内环 1/6
    const rings = [Math.round(n / 2), Math.round(n / 3), 0]; rings[2] = n - rings[0] - rings[1];
    let k = 0;
    for (let r = 0; r < 3; r++) for (let i = 0; i < rings[r]; i++) {
      const p = this.p;
      this.sw.push({ ring: r, idx: i, a0: (i / rings[r]) * TAU + r * 0.3, x: p.x, y: p.y, h: 60, ang: -Math.PI / 2, delay: (k++ / n) * 0.75, arrived: 0, sx: p.x + rnd(-30, 30), sy: p.y + rnd(-10, 10), flash: 0 });
    }
    c.game.cinema(cx, cy, Math.max(0.5, Math.min(0.7, 430 / R)), T_END - 0.6);   // 第三十步：剑阵更大，镜头拉得更远
    c.game.toast(`青竹蜂云剑七十二口齐出——「大庚剑阵」！`, 'good');
    audio.sfx('sword'); audio.sfx('bell');
  }

  /** 剑在阵中的落位 */
  slot(s: Sw, t: number) {
    const rr = [1, 0.66, 0.34][s.ring] * this.R * this.shrink;
    const a = s.a0 + this.spin[s.ring];
    const x = this.cx + Math.cos(a) * rr, y = this.cy + Math.sin(a) * rr * SQ;
    const h = 170 + s.ring * 40 + Math.sin(t * 2.2 + s.idx * 0.7) * 8;
    return { x, y, h };
  }
  /** 椭圆内（阵内）判定，返回归一化半径 */
  rIn(x: number, y: number) { const R = this.R * this.shrink; return Math.hypot((x - this.cx) / R, (y - this.cy) / (R * SQ)); }

  update(dt: number) {
    this.t += dt;
    const t = this.t, c = this.c, g = c.game;
    // 剑环旋转（周天运转，收缩时越转越快）
    const sp = t > T_STORM ? 1 + 5 * easeIn((t - T_STORM) / (T_SHRINK - T_STORM)) : 1;
    this.spin[0] += dt * 0.35 * sp; this.spin[1] -= dt * 0.55 * sp; this.spin[2] += dt * 0.9 * sp;
    if (t > T_STORM && t < T_SHRINK) this.shrink = 1 - 0.86 * easeIn((t - T_STORM) / (T_SHRINK - T_STORM));
    // 剑
    for (const s of this.sw) {
      s.flash = Math.max(0, s.flash - dt * 3);
      if (t >= T_SHRINK) {
        // 归鞘：划弧飞回身后
        const u = ease((t - T_SHRINK - s.delay * 0.4) / 0.6), p = this.p;
        if (u <= 0) continue;
        const nx = s.x + (p.x - s.x) * u * 0.35, ny = s.y + (p.y - s.y) * u * 0.35;
        s.ang = Math.atan2(ny - s.y - (s.h * 0.02), nx - s.x) || s.ang;
        s.x = nx; s.y = ny; s.h += (60 - s.h) * u * 0.2;
        continue;
      }
      const q = this.slot(s, t);
      if (s.arrived < 1) {
        const u = (t - s.delay) / 0.7;
        if (u <= 0) { s.x = this.p.x; s.y = this.p.y; continue; }
        const e = ease(u);
        // 二次贝塞尔：起点（身后）→ 天顶 → 落位
        const mx = (s.sx + q.x) / 2, my = (s.sy + q.y) / 2, mh = 520 + s.ring * 60;
        const bx = (1 - e) * (1 - e) * s.sx + 2 * (1 - e) * e * mx + e * e * q.x;
        const by = (1 - e) * (1 - e) * s.sy + 2 * (1 - e) * e * my + e * e * q.y;
        const bh = (1 - e) * (1 - e) * 60 + 2 * (1 - e) * e * mh + e * e * q.h;
        const vx = bx - s.x, vy = (by - bh) - (s.y - s.h);
        if (Math.abs(vx) + Math.abs(vy) > 0.5) s.ang = Math.atan2(vy, vx);
        s.x = bx; s.y = by; s.h = bh;
        if (u >= 1) { s.arrived = 1; s.flash = 1; }
      } else {
        s.x = q.x; s.y = q.y; s.h = q.h;
        // 剑尖垂地，微向阵心
        const want = Math.atan2(1, (this.cx - s.x) / this.R * 0.45);
        s.ang += (want - s.ang) * Math.min(1, dt * 8);
      }
    }
    // 困敌：布阵完成时阵内之敌
    if (t >= T_FORM && this.trapped.size === 0 && !(this as any)._sealed) {
      (this as any)._sealed = true;
      for (const e of c.enemies) if (!e.dead && this.rIn(e.x, e.y) < 1) {
        this.trapped.add(e.id);
        c.texts.push({ x: e.x, y: e.y - eh(e) - 70, s: '困', color: '#ffe08a', t: 0, vy: -30, big: true });
      }
      c.impact(this.cx, this.cy, 2, '255,225,120');
      audio.sfx('clang');
    }
    // 剑幕：被困者出不了阵
    if (t >= T_FORM && t < T_SHRINK) for (const e of c.enemies) {
      if (e.dead || !this.trapped.has(e.id)) continue;
      const r = this.rIn(e.x, e.y), lim = 0.94;
      if (r > lim) {
        const R = this.R * this.shrink, ax = (e.x - this.cx) / R, ay = (e.y - this.cy) / (R * SQ);
        e.x = this.cx + ax / r * lim * R; e.y = this.cy + ay / r * lim * R * SQ; e.kx = 0; e.ky = 0;
        if (Math.random() < 0.1) c.sparks.push({ x: e.x, y: e.y - 40, vx: rnd(-80, 80), vy: -80, t: 0, max: 0.3, size: 5, color: '255,230,140' });
      }
      if (t > T_STORM) { e.kx += (this.cx - e.x) * dt * 3; e.ky += (this.cy - e.y) * dt * 3; }
    }
    // 剑丝风暴伤害 + 辟邪神雷
    if (t >= T_FORM && t < T_SHRINK) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = t > T_STORM ? 0.15 : 0.22;
        let n = 0;
        for (const e of c.enemies) {
          if (e.dead || (this.rIn(e.x, e.y) > 1 && !this.trapped.has(e.id))) continue;
          this.hit(e, this.per * 0.26, e.x + rnd(-30, 30), e.y - eh(e));
          if (n++ < 6) this.slashes.push({ x: e.x + rnd(-20, 20), y: e.y - eh(e) + rnd(-20, 20), a: Math.random() * TAU });
        }
        g.trauma = Math.min(0.5, g.trauma + 0.04);
        if (Math.random() < 0.5) audio.sfx('clang');
      }
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = rnd(0.2, 0.32);
        const foes = c.enemies.filter((e) => !e.dead && (this.trapped.has(e.id) || this.rIn(e.x, e.y) < 1));
        const s = this.sw[Math.floor(Math.random() * this.sw.length)];
        let tx: number, ty: number, tg: Enemy | null = null;
        if (foes.length) { tg = foes[Math.floor(Math.random() * foes.length)]; tx = tg.x; ty = tg.y - eh(tg); }
        else { const a = Math.random() * TAU, r = Math.random() * this.R * this.shrink * 0.8; tx = this.cx + Math.cos(a) * r; ty = this.cy + Math.sin(a) * r * SQ; }
        this.bolts.push({ x1: s.x, y1: s.y - s.h, x2: tx, y2: ty, t: 0, seed: Math.random() * 1e6 });
        s.flash = 1;
        if (tg) this.hit(tg, this.per * 0.7, tx, ty, { ...this.I.src, evil: 2.5, status: { k: 'shock', dur: 0.8, ch: 0.5 }, stCh: 0.5 } as Src);
        if (Math.random() < 0.5) audio.sfx('thunder');
      }
    }
    // 收拢一爆
    if (t >= T_SHRINK && !this.burst) {
      this.burst = true; this.burstT = 0;
      for (const e of c.enemies) {
        if (e.dead) continue;
        if (this.trapped.has(e.id) || Math.hypot((e.x - this.cx) / this.R, (e.y - this.cy) / (this.R * SQ)) < 0.5) {
          this.hit(e, this.per * 3.2, this.cx, this.cy - 40);
          const d = Math.hypot(e.x - this.cx, e.y - this.cy) || 1; e.kx += (e.x - this.cx) / d * 500; e.ky += (e.y - this.cy) / d * 300;
        }
      }
      c.impact(this.cx, this.cy, 3, '255,220,110');
      audio.sfx('boom'); audio.sfx('thunder');
    }
    if (this.burstT >= 0) this.burstT += dt;
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < 0.22);
    if (t >= T_END) this.done = true;
  }

  bodies(out: Drawable[]) {
    const L = this.I.L, t = this.t;
    const fade = t > T_SHRINK ? clamp(1 - (t - T_SHRINK - 0.35) / 0.55, 0, 1) : 1;
    for (const s of this.sw) {
      if (t < s.delay) continue;
      const a = fade * clamp((t - s.delay) / 0.1, 0, 1);
      if (a <= 0.02) continue;
      out.push({ y: s.y + 60, draw: (g) => drawArt(g, L, s.x, s.y - s.h, 58, s.ang, a) });
    }
  }

  glow(F: FxSys, t: number, dt: number) {
    const T = this.t, cx = this.cx, cy = this.cy, R = this.R * this.shrink;
    const form = clamp((T - 0.6) / (T_FORM - 0.6), 0, 1);
    const fade = T > T_SHRINK ? clamp(1 - (T - T_SHRINK) / 0.7, 0, 1) : 1;
    const storm = T >= T_FORM && T < T_SHRINK;
    // —— 地面阵图：外环、星辰刻度、八卦、旋转符阵
    if (form > 0 && fade > 0) {
      const a = form * fade;
      F.ground(A.Disc, cx, cy, R * 1.02, 0, [0.16, 0.11, 0.03], 0.28 * a, 0, SQ);
      F.ground(A.Ring, cx, cy, R, 0, GOLD, 0.3 * a, 1, SQ);
      F.ground(A.Ring, cx, cy, R * 0.66, 0, GOLD, 0.26 * a, 1, SQ);
      F.ground(A.Ring, cx, cy, R * 0.34, 0, PALE, 0.26 * a, 1, SQ);
      F.ground(A.Rune, cx, cy, R * 0.98, this.spin[0], GOLD, 0.3 * a, 1, SQ);
      F.ground(A.Rune, cx, cy, R * 0.62, this.spin[1], PALE, 0.2 * a, 1, SQ);
      F.ground(A.Bagua, cx, cy, R * 0.3, this.spin[2], GOLD, 0.32 * a, 1, SQ);
      F.glow(cx, cy, R * 0.8, GOLD, 0.035 * a);
      // 周天星斗：七组北斗形的星点
      for (let k = 0; k < 7; k++) {
        const a0 = this.spin[1] + k / 7 * TAU;
        for (let j = 0; j < 7; j++) {
          const rr = R * (0.42 + j * 0.07), aa = a0 + Math.sin(j * 1.7 + k) * 0.18;
          F.glow(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * SQ, 9, PALE, 0.8 * a, A.Star);
        }
      }
    }
    // —— 剑与星线
    const arrived = this.sw.filter((s) => s.arrived && T < T_SHRINK);
    const byRing: Sw[][] = [[], [], []];
    for (const s of arrived) byRing[s.ring].push(s);
    for (let r = 0; r < 3; r++) {
      const L = byRing[r]; if (L.length < 2) continue;
      L.sort((a, b) => a.idx - b.idx);
      for (let i = 0; i < L.length; i++) {
        const a = L[i], b = L[(i + 1) % L.length];
        if (Math.abs(a.idx - b.idx) > 1 && !(b.idx === 0)) continue;
        F.beam(a.x, a.y - a.h, b.x, b.y - b.h, 2, r ? PALE : GOLD, 0.45 * fade);
      }
    }
    // 星斗连线：内环每口剑连向外环两口剑，成星芒
    const out0 = byRing[0], in2 = byRing[2];
    if (out0.length > 6 && in2.length) for (const s of in2) {
      const k = Math.floor(s.idx / Math.max(1, in2.length) * out0.length);
      for (const o of [out0[k % out0.length], out0[(k + Math.floor(out0.length / 3)) % out0.length]]) if (o) F.beam(s.x, s.y - s.h, o.x, o.y - o.h, 1.4, PALE, 0.3 * fade);
    }
    // 剑幕：外环剑尖向下垂落的光幕
    for (const s of out0) { F.beam(s.x, s.y - s.h + 20, s.x, s.y, 8, GOLD, (storm ? 0.12 : 0.07) * fade, A.Glow); F.glow(s.x, s.y, 12, GOLD, 0.14 * fade); }
    for (const s of this.sw) {
      if (T < s.delay) continue;
      const a = (T > T_SHRINK ? clamp(1 - (T - T_SHRINK - 0.35) / 0.55, 0, 1) : 1) * clamp((T - s.delay) / 0.1, 0, 1);
      if (a <= 0.02) continue;
      F.sprite(A.Blade, s.x, s.y - s.h, 100, 22, s.ang, mixK(JADE, GOLD, storm ? 0.8 : 0.3), (0.55 + s.flash * 0.45) * a);
      F.sprite(A.Blade, s.x, s.y - s.h, 80, 7, s.ang, WHITE, (0.5 + s.flash * 0.5) * a);
      F.glow(s.x, s.y - s.h, 14 + s.flash * 22, GOLD, (0.35 + s.flash * 0.5) * a);
      if (!s.arrived && Math.random() < dt * 30) F.emit({ x: s.x, y: s.y - s.h, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.35, s0: 4, s1: 1, c: PALE, cell: A.Glow });
      if (s.arrived && s.flash > 0.9) F.flash(s.x, s.y - s.h, 26, GOLD, 0.12);
    }
    // —— 万千剑丝：剑尖射出的金丝纵横穿梭
    if (storm && this.sw.length) {
      const k = T > T_STORM ? 1.8 : 1;
      const N = Math.min(140, Math.round(dt * 2400 * k));
      const foes = this.c.enemies.filter((e) => !e.dead && (this.trapped.has(e.id) || this.rIn(e.x, e.y) < 1));
      for (let i = 0; i < N; i++) {
        const s = this.sw[Math.floor(Math.random() * this.sw.length)];
        let bx: number, by: number;
        if (foes.length && Math.random() < 0.45) { const e = foes[Math.floor(Math.random() * foes.length)]; bx = e.x + rnd(-40, 40); by = e.y - eh(e) + rnd(-30, 30); }
        else { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * R; bx = cx + Math.cos(a) * r; by = cy + Math.sin(a) * r * SQ - rnd(0, 120); }
        const x0 = s.x, y0 = s.y - s.h, d = Math.hypot(bx - x0, by - y0) || 1, sp = 2800;
        F.emit({ x: x0, y: y0, vx: (bx - x0) / d * sp, vy: (by - y0) / d * sp, life: d / sp, s0: rnd(2.6, 4), s1: 2, c: Math.random() < 0.3 ? WHITE : GOLD, a: 0.9, cell: A.Glow, stretch: 0.035 });
      }
      // 剑丝弦：剑与剑之间一闪即逝的金弦
      const M = Math.round(18 * k);
      for (let i = 0; i < M; i++) {
        const a = this.sw[Math.floor(Math.random() * this.sw.length)], b = this.sw[Math.floor(Math.random() * this.sw.length)];
        if (a === b) continue;
        F.beam(a.x, a.y - a.h, b.x, b.y - b.h, 1.2, Math.random() < 0.5 ? PALE : GOLD, rnd(0.25, 0.6));
      }
      // 阵内金光雾
      if (Math.random() < dt * 12) { const a = Math.random() * TAU, r = Math.random() * R * 0.9; F.emit({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * SQ, vy: rnd(-60, -20), life: rnd(0.6, 1.1), s0: rnd(30, 60), s1: 90, c: GOLD, a: 0.06, cell: A.Glow }); }
    }
    // —— 辟邪神雷
    for (const b of this.bolts) {
      const k = 1 - b.t / 0.22;
      if (b.t === 0 || b.t < dt * 1.01) { F.flash(b.x2, b.y2, 60, GOLD, 0.18); F.sparks(b.x2, b.y2, PALE, 14, 420, 0.35, 3); }
      F.bolt(b.x1, b.y1, b.x2, b.y2, b.seed + Math.floor(b.t * 40), 26, 2.4, [1, 0.88, 0.45], k, 12, true);
    }
    // —— 斩痕
    for (const s of this.slashes.slice(0, 8)) {
      F.emit({ x: s.x, y: s.y, life: 0.16, s0: 70, s1: 110, c: GOLD, a: 0.7, cell: A.Slash, rot: s.a });
      F.sparks(s.x, s.y, PALE, 5, 420, 0.25, 2.4, s.a, 1);
    }
    this.slashes = [];
    // —— 收拢时：三重剑环成金色漩涡
    if (T > T_STORM && T < T_SHRINK) {
      const u = (T - T_STORM) / (T_SHRINK - T_STORM);
      F.glow(cx, cy - 60, 80 + 200 * u, GOLD, 0.1 + 0.25 * u);
      for (let i = 0; i < 3; i++) F.ground(A.Ring, cx, cy, R * (0.3 + i * 0.35), t * (4 + i * 2), PALE, 0.22, 1, SQ);
      if (Math.random() < dt * 60) { const a = Math.random() * TAU; F.emit({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * SQ - 60, vx: -Math.cos(a) * R * 2, vy: -Math.sin(a) * R * SQ * 2, life: 0.4, s0: 4, s1: 1, c: PALE, stretch: 0.04 }); }
    }
    // —— 一爆之后：金色剑芒向四周放射
    if (this.burstT >= 0 && this.burstT < 0.6) {
      const u = this.burstT / 0.6, rr = this.R * (0.3 + 1.2 * ease(u));
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU + 0.05;
        F.beam(cx, cy - 40, cx + Math.cos(a) * rr, cy - 40 + Math.sin(a) * rr * SQ, 6 * (1 - u), i % 2 ? PALE : GOLD, 0.8 * (1 - u));
      }
      F.ground(A.Ring, cx, cy, rr, 0, GOLD, 0.9 * (1 - u), 1, SQ);
    }
  }
}

function mixK(a: RGB, b: RGB, k: number): RGB { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
