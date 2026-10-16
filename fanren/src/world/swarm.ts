// 第二十八步：噬金虫群（虫群算法 + 阵形）
// 数百只噬金虫各自飞行（弹簧 + 阻尼 + 抖动），整体在几种阵形间流转：
//   护体（cover）：绕身成球形虫云，飞来的法术弹丸被一口吞掉；
//   化龙（dragon）：目标较远时排成一条金色长龙，龙首在前、蜿蜒扑去；
//   噬体（sphere）：裹住敌人成球，啃噬护体灵光与法宝（破甲、破护体），持续掉血；
//   食尸（devour）：敌人倒下，虫群扑上去吞噬尸身，虫数增长；
//   归巢（recall）：时间到 / 法力（神识）不支，飞回体内。
// 成长：银色 → 金斑 → 金银紫三色 → 纯金（随功法熟练度）；驱使虫群持续消耗法力（神识）。
import type { Combat, Enemy } from './combat';
import type { FxSys, RGB } from '../gl/fx';
import { C as A } from '../gl/atlas';
import { eh, Src } from './artacts';
import { audio } from './audio';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
type Mode = 'cover' | 'dragon' | 'sphere' | 'devour' | 'recall';

const STAGE_NAME = ['银噬金虫', '金斑噬金虫', '三色噬金虫', '纯金噬金虫'];
// 每阶：[高光色, 体色]，第三阶混三种
const TONES: [RGB, RGB][][] = [
  [[[0.86, 0.9, 0.98], [0.34, 0.36, 0.42]]],
  [[[0.86, 0.9, 0.98], [0.34, 0.36, 0.42]], [[1, 0.84, 0.36], [0.42, 0.3, 0.06]]],
  [[[1, 0.84, 0.36], [0.42, 0.3, 0.06]], [[0.86, 0.9, 0.98], [0.34, 0.36, 0.42]], [[0.82, 0.55, 1], [0.24, 0.12, 0.32]]],
  [[[1, 0.86, 0.34], [0.5, 0.34, 0.04]]],
];

export interface SwarmOpts { n: number; max: number; stage: number; life: number; dmg: number; src: Src; pet?: boolean }

export class Swarm {
  c: Combat; o: SwarmOpts;
  n: number; cap: number;
  X: Float32Array; Y: Float32Array; Z: Float32Array; VX: Float32Array; VY: Float32Array; VZ: Float32Array; S: Float32Array; tone: Uint8Array;
  mode: Mode = 'cover'; t = 0; life: number;
  target: Enemy | null = null; corpse: { x: number; y: number; t: number; blv: number } | null = null;
  head = { x: 0, y: 0, z: 90 }; path: number[] = [];
  cx = 0; cy = 0; cz = 60;
  tickT = 0; ate = 0; done = false; recallT = 0;
  anchor: () => { x: number; y: number };
  eats: { x: number; y: number }[] = [];
  bites: { x: number; y: number }[] = [];
  constructor(c: Combat, o: SwarmOpts, anchor?: () => { x: number; y: number }) {
    this.c = c; this.o = o; this.n = o.n; this.cap = o.max; this.life = o.life;
    this.anchor = anchor ?? (() => c.game.player);
    const M = o.max;
    this.X = new Float32Array(M); this.Y = new Float32Array(M); this.Z = new Float32Array(M);
    this.VX = new Float32Array(M); this.VY = new Float32Array(M); this.VZ = new Float32Array(M);
    this.S = new Float32Array(M); this.tone = new Uint8Array(M);
    const a = this.anchor();
    for (let i = 0; i < M; i++) this.spawnBug(i, a.x, a.y, 40);
    this.cx = a.x; this.cy = a.y; this.head = { x: a.x, y: a.y, z: 90 };
    if (!o.pet) { c.texts.push({ x: a.x, y: a.y - 150, s: `${STAGE_NAME[o.stage]} ×${this.n}`, color: '#ffd870', t: 0, vy: -24, big: true }); audio.sfx('gather'); }
  }
  private spawnBug(i: number, x: number, y: number, z: number) {
    const a = Math.random() * TAU, r = Math.random() * 30;
    this.X[i] = x + Math.cos(a) * r; this.Y[i] = y + Math.sin(a) * r * 0.5; this.Z[i] = z + Math.random() * 30;
    const s = Math.random() * TAU; this.VX[i] = Math.cos(s) * 300; this.VY[i] = Math.sin(s) * 200; this.VZ[i] = rnd(100, 300);
    this.S[i] = Math.random();
    const T = TONES[this.o.stage];
    this.tone[i] = this.o.stage === 1 ? (Math.random() < 0.3 ? 1 : 0) : this.o.stage === 2 ? (Math.random() < 0.45 ? 0 : Math.random() < 0.82 ? 1 : 2) : Math.floor(Math.random() * T.length);
  }

  /** 寻敌：护主范围内最近的交战之敌 */
  private pick(): Enemy | null {
    const a = this.anchor(), R = this.o.pet ? 700 : this.c.reach;
    let best: Enemy | null = null, bd = R;
    for (const e of this.c.enemies) {
      if (e.dead || e.spar || (!e.aggro && this.c.lock !== e)) continue;
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  update(dt: number) {
    const c = this.c, g = c.game, h = g.hero, a = this.anchor();
    this.t += dt;
    if (!this.o.pet) {
      this.life -= dt;
      // 驱虫耗神：法力（神识）持续消耗，不支则虫群归巢
      h.mp -= dt * 0.004 * (this.n / 100);
      if ((this.life <= 0 || h.mp <= 0.02) && this.mode !== 'recall') {
        if (h.mp <= 0.02) { h.mp = Math.max(0, h.mp); g.toast('神识不支，噬金虫群归入灵兽袋。', 'warn'); }
        this.mode = 'recall'; this.recallT = 0;
      }
    }
    // —— 阵形决策
    if (this.mode === 'recall') { this.recallT += dt; if (this.recallT > 0.9) this.done = true; }
    else if (this.mode === 'devour') {
      const cp = this.corpse!;
      cp.t -= dt;
      if (cp.t <= 0) {
        const add = Math.min(this.cap - this.n, 3 + Math.round(cp.blv * 2));
        if (add > 0) { for (let i = this.n; i < this.n + add; i++) this.spawnBug(i, cp.x, cp.y, 20); this.n += add; c.texts.push({ x: cp.x, y: cp.y - 90, s: `吞噬尸身·虫群 +${add}`, color: '#ffd870', t: 0, vy: -30 }); }
        this.ate++;
        this.corpse = null; this.mode = 'cover';
      }
    } else {
      if (this.target && (this.target.dead || this.target.spar)) {
        const e = this.target;
        if (e.dead && !this.o.pet) { this.corpse = { x: e.x, y: e.y, t: 1.1, blv: e.blv || e.realm * 2 }; this.mode = 'devour'; this.target = null; audio.sfx('gather'); }
        else this.target = null;
      }
      if (this.mode !== 'devour') {
        if (!this.target) this.target = this.pick();
        const e = this.target;
        if (!e) this.mode = 'cover';
        else {
          const d = Math.hypot(e.x - this.cx, e.y - this.cy);
          if (this.mode !== 'dragon' && d > 360) { this.mode = 'dragon'; this.head = { x: this.cx, y: this.cy, z: 90 }; this.path = []; }
          if (this.mode === 'dragon' && Math.hypot(e.x - this.head.x, e.y - this.head.y) < 110) this.mode = 'sphere';
          if (this.mode === 'cover') this.mode = 'sphere';
        }
      }
    }
    // —— 龙首运动：蜿蜒前进，记录龙身轨迹
    if (this.mode === 'dragon' && this.target) {
      const e = this.target, H = this.head, dx = e.x - H.x, dy = e.y - H.y, d = Math.hypot(dx, dy) || 1;
      const sp = 1250, wig = Math.sin(this.t * 7) * 0.55;
      const ux = dx / d, uy = dy / d;
      H.x += (ux * Math.cos(wig) - uy * Math.sin(wig)) * sp * dt;
      H.y += (uy * Math.cos(wig) + ux * Math.sin(wig)) * sp * dt;
      H.z = 90 + Math.sin(this.t * 5) * 30;
      this.path.push(H.x, H.y, H.z);
      if (this.path.length > 3 * 70) this.path.splice(0, 3);
    }
    // —— 噬体伤害：裹住即啃，破护体
    if (this.mode === 'sphere' && this.target && !this.target.dead) {
      const e = this.target;
      if (Math.hypot(this.cx - e.x, this.cy - e.y) < 90) {
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = 0.35;
          const k = this.n / Math.max(1, this.o.n);
          if (this.o.dmg > 0) c.hitEnemy(e, this.o.dmg * k, this.o.src as any, e.x, e.y - eh(e));
          if (e.guardT > 0) { e.guardT = 0; c.texts.push({ x: e.x, y: e.y - eh(e) - 60, s: '护体灵光被啃穿！', color: '#ffd870', t: 0, vy: -30 }); }
          this.bites.push({ x: e.x + rnd(-30, 30), y: e.y - eh(e) + rnd(-30, 30) });
        }
      }
    }
    // —— 吞噬法术：飞来的弹丸一口吃掉
    const eatR = (this.mode === 'cover' ? 120 : this.mode === 'sphere' ? 110 : 90) * (this.o.pet ? 1 : 1.45);
    const ex = this.mode === 'dragon' ? this.head.x : this.cx, ey = this.mode === 'dragon' ? this.head.y : this.cy;
    const eatY = ey - (this.mode === 'cover' ? 50 : 40);
    if (this.mode !== 'recall' && this.mode !== 'devour') {
      let ate = 0;
      c.projs = c.projs.filter((pr) => {
        if (pr.fac !== 'e') return true;
        if (Math.hypot(pr.x - ex, (pr.y - eatY) * 1.2) > eatR) return true;
        this.eats.push({ x: pr.x, y: pr.y }); ate++;
        return false;
      });
      if (ate) { c.texts.push({ x: ex, y: eatY - 70, s: '噬', color: '#ffe08a', t: 0, vy: -40 }); audio.sfx('break'); }
    }
    // —— 每只虫：弹簧追位 + 阻尼 + 抖动
    const n = this.n, t = this.t, X = this.X, Y = this.Y, Z = this.Z, VX = this.VX, VY = this.VY, VZ = this.VZ, S = this.S;
    let sx = 0, sy = 0, sz = 0;
    const tg = this.target, cp = this.corpse, pathN = this.path.length / 3;
    const K = this.mode === 'recall' ? 90 : 46, D = 7.5, J = this.mode === 'sphere' ? 520 : 380;
    const BIG = this.o.pet ? 1 : 1.45;   // 第三十步：主角虫群整体放大（虫云、噬体球、龙身）
    for (let i = 0; i < n; i++) {
      const s = S[i], ph = s * 1000;
      let tx: number, ty: number, tz: number;
      // 斐波那契球面上的固定方位，随时间自转
      const fy = 1 - 2 * ((i + 0.5) / n), fr = Math.sqrt(1 - fy * fy), fa = i * 2.39996 + t * (1.2 + s * 1.6);
      const ux = Math.cos(fa) * fr, uz = Math.sin(fa) * fr;
      if (this.mode === 'cover') {
        const r = (62 + 10 * Math.sin(t * 2 + ph) + this.n * 0.06) * BIG;
        tx = a.x + ux * r; ty = a.y + uz * r * 0.45; tz = 62 + fy * r * 0.8;
      } else if (this.mode === 'sphere' && tg) {
        const r = (44 + 30 * (tg.def.look?.size ?? 1)) * (0.85 + 0.25 * Math.sin(t * 5 + ph)) + Math.min(40, this.n * 0.06) * BIG;
        tx = tg.x + ux * r; ty = tg.y + uz * r * 0.45; tz = eh(tg) + fy * r * 0.8 - (tg.lift ? -tg.lift : 0);
      } else if (this.mode === 'dragon' && pathN > 1) {
        // 龙身：按编号沿轨迹分布，近首处粗、尾部细
        const q = i / n, k = Math.max(0, pathN - 1 - Math.floor(q * (pathN - 1)));
        const px = this.path[k * 3], py = this.path[k * 3 + 1], pz = this.path[k * 3 + 2];
        const w = (q < 0.12 ? 46 : 34 * (1 - q) + 8) * BIG;
        tx = px + ux * w; ty = py + uz * w * 0.5; tz = pz + fy * w;
      } else if (this.mode === 'devour' && cp) {
        const r = 26 + 34 * Math.max(0, cp.t);
        tx = cp.x + ux * r; ty = cp.y + uz * r * 0.45; tz = 8 + Math.abs(fy) * r * 0.5;
      } else {
        // 归巢 / 过渡：汇向主人胸口
        tx = a.x + ux * 10; ty = a.y + uz * 5; tz = 60 + fy * 10;
      }
      const ax = (tx - X[i]) * K - VX[i] * D + Math.sin(t * 9 + ph) * J;
      const ay = (ty - Y[i]) * K - VY[i] * D + Math.cos(t * 8 + ph * 1.3) * J * 0.6;
      const az = (tz - Z[i]) * K - VZ[i] * D + Math.sin(t * 11 + ph * 0.7) * J * 0.5;
      VX[i] += ax * dt; VY[i] += ay * dt; VZ[i] += az * dt;
      const sp = Math.hypot(VX[i], VY[i]);
      if (sp > 1800) { VX[i] *= 1800 / sp; VY[i] *= 1800 / sp; }
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt; Z[i] += VZ[i] * dt;
      sx += X[i]; sy += Y[i]; sz += Z[i];
    }
    if (n) { this.cx = sx / n; this.cy = sy / n; this.cz = sz / n; }
  }

  draw(F: FxSys, t: number) {
    const n = this.n, X = this.X, Y = this.Y, Z = this.Z, VX = this.VX, VY = this.VY, S = this.S;
    const T = TONES[this.o.stage];
    const fade = this.mode === 'recall' ? Math.max(0, 1 - this.recallT / 0.9) : Math.min(1, this.t / 0.2);
    if (fade <= 0) return;
    const hi = T[0][0];
    // 虫云的影子与金光
    F.ground(A.Disc, this.cx, this.cy, 40 + n * 0.12, 0, [0, 0, 0], 0.16 * fade, 0, 0.5);
    F.glow(this.cx, this.cy - this.cz, 50 + n * 0.25, hi, 0.04 * fade);
    if (this.mode === 'sphere' && this.target && !this.target.dead) {
      const e = this.target, y = e.y - eh(e);
      F.glow(e.x, y, 70 + n * 0.1, hi, 0.05 * fade);
      F.ring(e.x, e.y, 60 + 20 * (e.def.look?.size ?? 1), hi, 0.3 * fade);
    }
    if (this.mode === 'dragon') { F.glow(this.head.x, this.head.y - this.head.z, 60, hi, 0.3 * fade); F.glow(this.head.x, this.head.y - this.head.z, 18, [1, 1, 1], 0.5 * fade, A.Star); }
    for (let i = 0; i < n; i++) {
      const x = X[i], y = Y[i] - Z[i], ang = Math.atan2(VY[i] - 0.0001, VX[i]);
      const [lit, body] = T[this.tone[i]] ?? T[0];
      const flick = 0.5 + 0.5 * Math.sin(t * 70 + S[i] * 50);
      // 身：普通混合的深色甲壳 + 金属高光
      F.sprite(A.Shard, x, y, 15, 8, ang, body, 0.95 * fade, 0);
      F.sprite(A.Shard, x, y, 9, 4, ang, lit, 0.5 * fade, 1);
      // 翅：极快扇动的白色虚影
      F.sprite(A.Glow, x - Math.cos(ang) * 2, y - 2, 5, 14 * (0.6 + 0.4 * flick), ang, [1, 1, 1], 0.22 * fade, 1);
    }
    // 吞弹：金色噬口
    for (const e of this.eats.slice(0, 6)) { F.flash(e.x, e.y, 30, hi, 0.12); F.sparks(e.x, e.y, hi, 8, 260, 0.3, 2.4); F.shockRing(e.x, e.y + 30, 50, hi, 0.25, 0.55, 0.6); }
    this.eats = [];
    for (const b of this.bites.slice(0, 4)) { F.sparks(b.x, b.y, hi, 6, 320, 0.25, 2.2); F.emit({ x: b.x, y: b.y, life: 0.15, s0: 14, s1: 24, c: [1, 1, 1], a: 0.3, cell: A.Star, rot: Math.random() }); }
    this.bites = [];
    if (this.mode === 'devour' && this.corpse && Math.random() < 0.5) F.emit({ x: this.corpse.x + rnd(-20, 20), y: this.corpse.y - rnd(0, 20), vy: rnd(-60, -20), life: 0.6, s0: rnd(10, 18), s1: 26, c: [0.3, 0.06, 0.05], a: 0.4, add: 0, cell: A.Smoke });
  }

  /** Canvas 后备：只画小点 */
  drawCanvas(g: CanvasRenderingContext2D) {
    const T = TONES[this.o.stage];
    g.save();
    for (let i = 0; i < this.n; i++) {
      const [lit] = T[this.tone[i]] ?? T[0];
      g.fillStyle = `rgb(${lit.map((v) => Math.round(v * 200)).join(',')})`;
      g.fillRect(this.X[i] - 1.5, this.Y[i] - this.Z[i] - 1, 3, 2);
    }
    g.restore();
  }
}

export { STAGE_NAME };
