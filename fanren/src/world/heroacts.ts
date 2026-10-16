// 第三十步：补齐主角几套神通的专属特效（此前走通用弹道 / 光环）
//   剑影分光术：一口青色巨剑升空，「分光」一闪化作漫天剑影，各自寻敌穿刺；
//   虚天鼎：巨鼎自天而降，鼎口青丝缚敌、漩涡收摄，最后镇落——残血者收入鼎中炼化；
//   洞漩金光：金色漩涡自身周卷出，数道金光旋臂层层绞杀，最后一爆；
//   大衍神识冲击：眉心神光一亮，数重神识浪潮扫荡四方（空间涟漪），浪头过处神魂震荡。
import type { Combat, Enemy } from './combat';
import type { Drawable } from './life';
import type { FxSys, RGB } from '../gl/fx';
import type { ArtSkill } from '../data/arts';
import { C as A } from '../gl/atlas';
import { Act, ActInit, Src, eh, lookOf } from './artacts';
import { itemDef } from '../data/items';
import { drawArt } from '../gfx/artifact';
import { audio } from './audio';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeIn = (u: number) => Math.pow(clamp(u, 0, 1), 2.2);
const rgb = (s: string): RGB => { const p = s.split(',').map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255]; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const WHITE: RGB = [1, 1, 1];

function init(c: Combat, item: string, s: ArtSkill, dmg: number, src: Src, ax: number, ay: number, target: Enemy | null): ActInit {
  const d = itemDef(item);
  return { itemId: item, art: d.art!, L: lookOf(item), cc: rgb(s.color), dmg, src, pieces: 1, ax, ay, target };
}
function shadow(g: G, x: number, y: number, r: number, a: number) {
  if (a <= 0.01) return;
  g.fillStyle = `rgba(20,16,12,${0.3 * a})`; g.beginPath(); g.ellipse(x, y, r, r * 0.34, 0, 0, TAU); g.fill();
}

// ============================================================== 剑影分光术
interface Shade { x: number; y: number; vx: number; vy: number; ang: number; tgt: Enemy | null; tx: number; ty: number; trail: [number, number][]; life: number; done: boolean; delay: number }
class JianyingAct extends Act {
  sh: Shade[] = []; split = false; mx = 0; my = 0; ang: number; per: number; flash = 0;
  constructor(c: Combat, I: ActInit, public n: number, public lv: number) {
    super(c, I);
    const p = this.p;
    this.ang = Math.atan2(I.ay - (p.y - 170), I.ax - p.x);
    this.per = I.dmg;
    this.mx = p.x; this.my = p.y - 60;
    audio.sfx('sword');
  }
  update(dt: number) {
    this.t += dt;
    const p = this.p;
    if (!this.split) {
      // 巨剑升空：自背后升到头顶，剑尖指向目标
      const u = ease(this.t / 0.42);
      this.mx = p.x - Math.cos(this.ang) * 20; this.my = p.y - 60 - u * 120;
      if (this.t >= 0.42) this.doSplit();
      return;
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    let alive = 0;
    for (const s of this.sh) {
      if (s.done) continue;
      alive++;
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.life += dt;
      if (s.tgt && !s.tgt.dead) { s.tx = s.tgt.x; s.ty = s.tgt.y - eh(s.tgt); }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1;
      // 先顺着散开的方向飞一小段，再急转扑向目标（越飞越快）
      const steer = clamp((s.life - 0.08) * 7, 0, 1) * 16, sp = 900 + s.life * 1500;
      s.vx += (dx / d * sp - s.vx) * Math.min(1, steer * dt); s.vy += (dy / d * sp - s.vy) * Math.min(1, steer * dt);
      s.x += s.vx * dt; s.y += s.vy * dt; s.ang = Math.atan2(s.vy, s.vx);
      s.trail.push([s.x, s.y]); if (s.trail.length > 9) s.trail.shift();
      if (d < 34 || s.life > 1.5) {
        s.done = true;
        if (s.tgt && !s.tgt.dead && d < 60) { this.hit(s.tgt, this.per, s.x, s.y); (s as any).hitAt = this.t; }
        this.pops.push({ x: s.x, y: s.y, a: s.ang, t: 0 });
      }
    }
    for (const q of this.pops) q.t += dt;
    this.pops = this.pops.filter((q) => q.t < 0.3);
    if (!alive && this.t > 0.8 && !this.pops.length) this.done = true;
  }
  pops: { x: number; y: number; a: number; t: number }[] = [];
  doSplit() {
    this.split = true; this.flash = 1;
    const c = this.c, p = this.p, R = 780;
    const foes = c.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < R).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 8);
    if (this.I.target && !this.I.target.dead && !foes.includes(this.I.target)) foes.unshift(this.I.target);
    // 主目标多分几道（每三道里一道必取主目标），其余轮流扑向附近之敌
    const pickT = (i: number) => (!foes.length ? null : i % 3 === 0 || foes.length === 1 ? foes[0] : foes[1 + (i % (foes.length - 1))]);
    // 总伤害 ≈ 原「每道剑影 × 道数」× 1.2，平摊到每一道
    this.per = this.I.dmg * 1.2 / this.n;
    for (let i = 0; i < this.n; i++) {
      const k = this.n > 1 ? i / (this.n - 1) - 0.5 : 0, a = this.ang + k * 2.6 + rnd(-0.08, 0.08), sp = rnd(520, 760);
      const tg = pickT(i);
      this.sh.push({ x: this.mx + Math.cos(this.ang) * 40, y: this.my + Math.sin(this.ang) * 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, tgt: tg,
        tx: tg ? tg.x : this.I.ax + rnd(-120, 120), ty: tg ? tg.y - eh(tg) : this.I.ay + rnd(-60, 60), trail: [], life: 0, done: false, delay: Math.abs(k) * 0.12 });
    }
    c.texts.push({ x: p.x, y: p.y - 230, s: '剑影分光', color: '#b8ffe0', t: 0, vy: -30, big: true });
    audio.sfx('sword'); audio.sfx('chime');
    c.impact(this.mx, this.my + 120, 1, this.I.L.glow);
  }
  glow(F: FxSys, t: number) {
    const cc = this.I.cc, core = mix(cc, WHITE, 0.6);
    // 巨剑
    const mA = this.split ? Math.max(0, 1 - (this.t - 0.42) / 0.35) : ease(this.t / 0.2);
    if (mA > 0.01) {
      const L = 150 + (this.split ? (this.t - 0.42) * 260 : 0);
      F.glow(this.mx, this.my, 90, cc, 0.25 * mA);
      F.sprite(A.Blade, this.mx, this.my, L, 34, this.ang, cc, 0.85 * mA);
      F.sprite(A.Blade, this.mx, this.my, L * 0.85, 12, this.ang, core, 0.9 * mA);
      if (!this.split && Math.random() < 0.5) F.emit({ x: this.mx + rnd(-50, 50), y: this.my + rnd(-14, 14), vy: rnd(-40, -10), life: 0.4, s0: 5, s1: 1, c: core, cell: A.Glow });
    }
    if (this.flash > 0) {
      F.glow(this.mx, this.my, 160 * this.flash + 40, core, 0.5 * this.flash, A.Star);
      F.ring(this.mx, this.my + 10, 60 + (1 - this.flash) * 260, cc, 0.5 * this.flash, 0.55);
    }
    for (const s of this.sh) {
      if (s.done || s.delay > 0 || s.trail.length < 2) continue;
      F.trail(s.trail, 12, cc, 0.4);
      F.trail(s.trail, 3.5, core, 0.75);
      F.sprite(A.Blade, s.x, s.y, 62, 14, s.ang, cc, 0.9);
      F.sprite(A.Blade, s.x, s.y, 50, 5, s.ang, core, 0.95);
    }
    for (const q of this.pops) {
      const u = q.t / 0.3;
      if (q.t < 0.02) { F.sparks(q.x, q.y, core, 6, 260, 0.3, 2.5, q.a, 1.2); }
      F.sprite(A.Slash, q.x, q.y, 70 + u * 40, 70 + u * 40, q.a + Math.PI / 2, cc, 0.6 * (1 - u));
    }
  }
}

// ============================================================== 虚天鼎（神通版）
class DingAct extends Act {
  x: number; y: number; h = 900; R: number; ph = 0; pt = 0; tick = 0; caught = new Set<Enemy>(); lv: number; slamFx = 0; ice = false;
  constructor(c: Combat, I: ActInit, x: number, y: number, R: number, lv: number) {
    super(c, I);
    this.x = x; this.y = y; this.R = R; this.lv = lv; this.ice = lv >= 3;
    c.game.cinema(x, y - 80, 0.72, 3.0);
    c.game.toast('虚天鼎迎风暴涨，自九天镇落！', 'good');
    audio.sfx('chime');
  }
  update(dt: number) {
    this.t += dt; this.pt += dt;
    if (this.ph === 0) {
      this.h = 900 - ease(this.pt / 0.75) * 720;
      if (this.pt >= 0.75) { this.ph = 1; this.pt = 0; audio.sfx('bell'); this.c.game.juice(0.05, 0.25); }
    } else if (this.ph === 1) {
      this.h = 180 + Math.sin(this.pt * 3) * 6;
      this.tick += dt;
      for (const e of this.near(this.x, this.y, this.R * 1.35)) {
        const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1;
        const k = e.boss ? 0.25 : 1, mv = Math.max(0, Math.min(d - 20, 240 * k * dt));
        e.x += dx / d * mv; e.y += dy / d * mv * 0.75;
        this.caught.add(e);
      }
      if (this.tick > 0.25) { this.tick = 0; for (const e of this.caught) if (!e.dead) this.hit(e, this.I.dmg * 0.06, this.x, this.y - this.h, { ...this.I.src, status: undefined, stCh: 0 }); }
      if (this.pt > 1.7) { this.ph = 2; this.pt = 0; }
    } else if (this.ph === 2) {
      this.h = 180 * (1 - easeIn(this.pt / 0.16));
      if (this.pt >= 0.16) {
        this.ph = 3; this.pt = 0; this.slamFx = 1;
        let n = 0;
        for (const e of this.near(this.x, this.y, this.R)) this.caught.add(e);
        for (const e of this.caught) {
          if (e.dead) continue;
          if (!e.boss && e.hp < e.maxHp * 0.25 && e.realm <= this.I.src.realm) { this.hit(e, e.hp * 3 + 1e6, this.x, this.y); n++; }
          else this.hit(e, this.I.dmg, this.x, this.y);
          if (!e.dead) { const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * 520; e.ky += dy / d * 320; }
        }
        this.c.impact(this.x, this.y, 3, '220,190,120');
        this.c.game.juice(0.12, 0.5);
        audio.sfx('boom'); audio.sfx('bell');
        if (n) this.c.game.toast(`鼎口青光一卷，${n} 个敌人被收入虚天鼎中炼化！`, 'good');
      }
    } else if (this.ph === 3) {
      this.slamFx = Math.max(0, this.slamFx - dt * 2);
      if (this.pt > 0.75) { this.ph = 4; this.pt = 0; }
    } else {
      this.h = easeIn(this.pt / 0.45) * 600;
      if (this.pt > 0.45) this.done = true;
    }
  }
  get size() { return this.ph === 0 ? 120 + ease(this.pt / 0.75) * 150 : this.ph === 3 ? 270 * (1 + 0.06 * Math.sin(this.pt * 40) * (1 - this.pt / 0.75)) : 270; }
  bodies(out: Drawable[]) {
    const a = this.ph === 4 ? 1 - this.pt / 0.45 : this.ph === 0 ? ease(this.pt / 0.25) : 1;
    const sh = clamp(1 - this.h / 900, 0.15, 1);
    out.push({ y: this.y + 40, draw: (g) => { shadow(g, this.x, this.y + 8, 130 * sh, a * sh); drawArt(g, this.I.L, this.x, this.y - this.h - this.size * 0.42, this.size, Math.sin(this.t * 1.6) * 0.03, a); } });
  }
  glow(F: FxSys, t: number, dt: number) {
    const cc = this.I.cc, R = this.R, x = this.x, y = this.y;
    const mouthY = y - this.h - this.size * 0.75;
    const jade: RGB = [0.5, 1, 0.72], bronze: RGB = [0.92, 0.78, 0.45];
    F.glow(x, mouthY + 40, 120, mix(jade, bronze, 0.4), 0.22);
    if (this.ph <= 2) {
      // 镇压法阵（落点预警）
      const k = this.ph === 0 ? ease(this.pt / 0.75) : 1;
      F.ground(A.Rune, x, y, R * (0.6 + 0.4 * k), t * 0.6, bronze, 0.32 * k, 1, 0.5);
      F.ground(A.Bagua, x, y, R * 0.55 * k, -t * 0.9, jade, 0.22 * k, 1, 0.5);
      F.ring(x, y, R * k, bronze, 0.35 * k, 0.5);
    }
    if (this.ph === 1) {
      F.ground(A.Swirl, x, y, R * 1.2, -t * 3, jade, 0.32, 1, 0.5);
      F.sprite(A.Beam, x, (mouthY + y) / 2, Math.abs(y - mouthY), 120, Math.PI / 2, jade, 0.14);
      // 青丝缚敌：鼎口垂下的青色光丝，缠住每个被收摄的敌人
      for (const e of this.caught) {
        if (e.dead) continue;
        const ex = e.x, ey = e.y - eh(e);
        const pts: [number, number][] = [];
        for (let i = 0; i <= 8; i++) { const u = i / 8, w = Math.sin(u * Math.PI) * 30 * Math.sin(t * 6 + e.id); pts.push([x + (ex - x) * u + w, mouthY + 30 + (ey - mouthY - 30) * u]); }
        F.trail(pts, 7, jade, 0.4); F.trail(pts, 2, mix(jade, WHITE, 0.6), 0.7);
        F.ring(ex, e.y - 6, 34, jade, 0.4, 0.5);
      }
      // 收摄：四周灵光被吸向鼎口
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * TAU, r = rnd(R * 0.6, R * 1.3), sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.5 - 20;
        F.emit({ x: sx, y: sy, vx: (x - sx) * 1.6, vy: (mouthY - sy) * 1.6, life: 0.6, s0: 7, s1: 2, c: Math.random() < 0.5 ? jade : bronze, cell: A.Glow, drag: 0.5 });
      }
      if (Math.random() < dt * 8) F.bolt(x + rnd(-40, 40), mouthY + 20, x + rnd(-R, R) * 0.8, y + rnd(-R, R) * 0.4, Math.random() * 1e6, 20, 1.3, mix(jade, WHITE, 0.3), 0.7, 8, false);
    }
    if (this.slamFx > 0.98) {
      this.slamFx = 0.97;
      F.flash(x, y - 60, 160, bronze, 0.3);
      F.shockRing(x, y, R * 1.5, bronze, 0.6, 0.55, 0.7);
      F.shockRing(x, y, R * 1.1, jade, 0.5, 0.55, 0.5);
      F.shock(x, y, R * 2.2, 30, 0.8);
      F.ink(x, y + 6, R * 0.9, 0.5, [0.18, 0.14, 0.1]);
      F.smoke(x, y - 10, 26, [0.5, 0.44, 0.34], 0.45, R * 0.7, 120);
      for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, v = rnd(200, 700); F.emit({ x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - rnd(80, 260), life: rnd(0.5, 1), s0: rnd(4, 9), s1: 2, c: mix(bronze, WHITE, 0.3), grav: 600, drag: 1, cell: A.Shard, rot: Math.random() * TAU, vr: rnd(-8, 8) }); }
      for (const e of this.caught) if (e.dead) for (let i = 0; i < 14; i++) F.emit({ x: e.x, y: e.y - 40, vx: (x - e.x) * rnd(1.5, 2.6), vy: (y - 200 - e.y) * rnd(1.5, 2.6), life: 0.5, s0: 10, s1: 3, c: mix(jade, WHITE, 0.4), cell: A.Glow });
      if (this.ice) { const ic: RGB = [0.45, 0.7, 1]; F.shockRing(x, y, R * 1.3, ic, 0.7, 0.55, 0.6); for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; F.emit({ x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 15 - 20, vx: Math.cos(a) * rnd(300, 520), vy: Math.sin(a) * rnd(150, 260) - 60, life: rnd(0.6, 0.9), s0: rnd(26, 40), s1: 6, c: ic, cell: A.Flame, rot: a + Math.PI / 2 }); } }
    }
    if (this.ph === 3) {
      F.ground(A.Crack, x, y, R * 0.75, x * 0.01, [0.16, 0.12, 0.08], 0.38 * (1 - this.pt / 0.75), 0, 0.55);
      F.ground(A.RingSoft, x, y, R * (0.8 + this.pt), 0, bronze, 0.25 * (1 - this.pt / 0.75), 1, 0.5);
    }
  }
}

// ============================================================== 洞漩金光
class DongxuanAct extends Act {
  R: number; pulses: number[]; pi = 0; per: number; lv: number; endFx = false; spinDir = 1;
  constructor(c: Combat, I: ActInit, R: number, lv: number) {
    super(c, I);
    this.R = R; this.lv = lv; this.per = I.dmg;
    this.pulses = lv >= 2 ? [0.55, 0.95, 1.35, 1.75] : [0.6, 1.1, 1.6];
    c.game.cinema(this.p.x, this.p.y - 40, 0.75, 2.4);
    audio.sfx('gather');
  }
  get k() { return ease(this.t / 0.6) * (this.t > 2.0 ? Math.max(0, 1 - (this.t - 2.0) / 0.35) : 1); }
  update(dt: number) {
    this.t += dt;
    const p = this.p, R = this.R * Math.max(0.2, this.k);
    // 漩涡带着敌人打转、往里卷
    for (const e of this.near(p.x, p.y, R)) {
      if (e.boss) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      e.x += (-dy / d * 160 * this.spinDir - dx / d * 50) * dt; e.y += (dx / d * 90 * this.spinDir - dy / d * 30) * dt;
    }
    while (this.pi < this.pulses.length && this.t >= this.pulses[this.pi]) {
      this.pi++;
      const last = this.pi === this.pulses.length;
      for (const e of this.near(p.x, p.y, this.R)) this.hit(e, this.per * (last ? 0.55 : 0.3), p.x, p.y - 40, last ? this.I.src : { ...this.I.src, status: undefined, stCh: 0 });
      audio.sfx(last ? 'boom' : 'whoosh');
      if (last) { this.endFx = true; this.c.impact(p.x, p.y, 3, '255,220,120'); }
    }
    if (this.t > 2.4) this.done = true;
  }
  glow(F: FxSys, t: number) {
    const p = this.p, cx = p.x, cy = p.y - 30, k = this.k, R = this.R * k;
    if (k <= 0.01 && !this.endFx) return;
    const gold: RGB = [1, 0.82, 0.38], core = mix(gold, WHITE, 0.6);
    F.ground(A.Swirl, p.x, p.y, R * 1.05, -t * 5, gold, 0.4 * k, 1, 0.5);
    F.ground(A.Rune, p.x, p.y, R * 0.6, t * 1.5, gold, 0.25 * k, 1, 0.5);
    F.glow(cx, cy, 70 + 40 * Math.sin(t * 9), core, 0.35 * k);
    // 六道金光旋臂（对数螺线），自转
    const ARMS = 6, NP = 14;
    for (let i = 0; i < ARMS; i++) {
      const pts: [number, number][] = [];
      for (let j = 0; j <= NP; j++) {
        const u = j / NP, r = R * (0.12 + 0.88 * u), a = (i / ARMS) * TAU + u * 2.6 - t * 4.2;
        pts.push([p.x + Math.cos(a) * r, p.y - 20 + Math.sin(a) * r * 0.52]);
      }
      F.trail(pts, 34 * k, gold, 0.22 * k, A.Beam, 1, 0.3);
      F.trail(pts, 8 * k, core, 0.5 * k, A.Beam, 1, 0.3);
      const tip = pts[NP];
      F.glow(tip[0], tip[1], 18, core, 0.6 * k, A.Star);
    }
    if (Math.random() < 0.8) { const a = Math.random() * TAU, r = rnd(0.3, 1) * R; F.emit({ x: p.x + Math.cos(a) * r, y: p.y - 20 + Math.sin(a) * r * 0.5, vx: -Math.sin(a) * 300, vy: Math.cos(a) * 150 - 40, life: 0.5, s0: 6, s1: 1, c: core, cell: A.Glow }); }
    // 每次脉冲一圈金浪
    for (let i = 0; i < this.pi; i++) { const age = this.t - this.pulses[i]; if (age < 0.4) F.ring(p.x, p.y, this.R * (0.3 + age * 2), gold, 0.5 * (1 - age / 0.4), 0.52); }
    if (this.endFx) {
      this.endFx = false;
      F.flash(cx, cy, 150, core, 0.3);
      F.shockRing(p.x, p.y, this.R * 1.4, gold, 0.6, 0.55, 1);
      F.shock(p.x, p.y, this.R * 2, 24, 0.7);
      F.sparks(cx, cy, core, 50, 700, 0.6, 3.5);
    }
  }
}

// ============================================================== 大衍神识冲击
class DayanAct extends Act {
  R: number; waves: number[]; hitW: Map<number, number> = new Map(); per: number; lv: number; fired: boolean[] = [];
  constructor(c: Combat, I: ActInit, R: number, lv: number) {
    super(c, I);
    this.R = R; this.lv = lv;
    this.waves = lv >= 2 ? [0.25, 0.6, 0.95] : [0.25, 0.65];
    this.per = I.dmg / this.waves.length * 1.15;
    audio.sfx('gather');
  }
  update(dt: number) {
    this.t += dt;
    const p = this.p;
    this.waves.forEach((w0, wi) => {
      const age = this.t - w0; if (age < 0) return;
      if (!this.fired[wi]) { this.fired[wi] = true; audio.sfx('whoosh'); this.c.game.juice(0.04, 0.2); }
      const r = 50 + ease(age / 0.55) * this.R;
      if (age > 0.6) return;
      for (const e of this.c.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, (e.y - p.y) * 1.25);
        if (d > r || (this.hitW.get(e.id) ?? -1) >= wi) continue;
        this.hitW.set(e.id, wi);
        this.hit(e, this.per, p.x, p.y - 60, wi === 0 ? this.I.src : { ...this.I.src, status: undefined, stCh: 0 });
        if (wi === 0 && !e.dead) this.c.texts.push({ x: e.x, y: e.y - eh(e) - 50, s: '神魂震荡', color: '#d8c8ff', t: 0, vy: -30 });
      }
    });
    if (this.t > this.waves[this.waves.length - 1] + 0.8) this.done = true;
  }
  glow(F: FxSys, t: number) {
    const p = this.p, hx = p.x, hy = p.y - 112;   // 眉心
    const vio: RGB = [0.78, 0.68, 1], core = mix(vio, WHITE, 0.6);
    const pre = clamp(this.t / 0.25, 0, 1), fade = clamp((this.waves[this.waves.length - 1] + 0.8 - this.t) / 0.4, 0, 1);
    F.glow(hx, hy, 14 + 26 * pre, core, 0.8 * pre * fade, A.Star);
    F.sprite(A.Rune, hx, hy - 30, 120 * pre, 120 * pre, t * 2, vio, 0.3 * pre * fade);
    F.ground(A.Rune, p.x, p.y, 120 + 40 * pre, -t, vio, 0.3 * pre * fade, 1, 0.5);
    this.waves.forEach((w0, wi) => {
      const age = this.t - w0; if (age < 0 || age > 0.7) return;
      const u = age / 0.7, r = 50 + ease(age / 0.55) * this.R, a = 1 - u;
      if (age < 0.03) { F.shock(p.x, p.y, this.R * 1.6, 22, 0.7); F.flash(hx, hy, 60, core, 0.18); }
      F.ring(p.x, p.y, r, vio, 0.55 * a, 0.55, true);
      F.ring(p.x, p.y, r * 0.93, core, 0.35 * a, 0.55);
      F.ground(A.RingSoft, p.x, p.y, r * 1.02, 0, vio, 0.18 * a, 1, 0.55);
      // 浪头上的神识丝
      for (let i = 0; i < 4; i++) { const an = Math.random() * TAU; F.emit({ x: p.x + Math.cos(an) * r, y: p.y + Math.sin(an) * r * 0.55 - 30, vx: Math.cos(an) * 120, vy: Math.sin(an) * 60 - 30, life: 0.35, s0: 30, s1: 8, c: core, a: 0.5, cell: A.Wisp, rot: an + Math.PI / 2 }); }
    });
  }
}

/** 由 Combat.exec 调用：这些神通交给专属特效接管。返回 true 表示已接管 */
export function spawnHeroAct(c: Combat, s: ArtSkill, lv: number, dmg: number, src: Src, a: { x: number; y: number; dx: number; dy: number; target: Enemy | null }, radius: number, count: number): boolean {
  const p = c.game.player;
  if (s.id === 'jianying') {
    const n = 10 + Math.max(1, count) * 4 + lv * 2;   // 3 道 → 22 道剑影；6 道 → 40 道
    const I = init(c, 'art_qingzhu', s, dmg * Math.max(1, count), src, a.x, a.y, a.target);
    I.cc = rgb(s.color);
    c.acts.list.push(new JianyingAct(c, I, n, lv));
    return true;
  }
  if (s.id === 'xutianding') {
    const d = Math.min(s.range, Math.hypot(a.x - p.x, a.y - p.y));
    const I = init(c, 'art_xutian', s, dmg, src, a.x, a.y, a.target);
    c.acts.list.push(new DingAct(c, I, p.x + a.dx * d, p.y + a.dy * d + 30, radius * 1.8, lv));
    return true;
  }
  if (s.id === 'dongxuan') {
    c.acts.list.push(new DongxuanAct(c, init(c, 'art_qingzhu', s, dmg, src, a.x, a.y, a.target), radius * 1.5, lv));
    return true;
  }
  if (s.id === 'dayanchong') {
    c.acts.list.push(new DayanAct(c, init(c, 'art_qingzhu', s, dmg, src, a.x, a.y, a.target), radius * 1.6, lv));
    return true;
  }
  return false;
}
