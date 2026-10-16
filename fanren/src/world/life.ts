// 活的世界：飞鸟、仙鹤、鹿、兔、蝴蝶、鱼跃、行人、商队、御剑修士、舟船、萤火
import type { Game } from './game';
import { bldTex } from '../gfx/bldTex';
import { CharState, drawCharacter, drawSwordUnderFeet, randomLook, Look, NpcRole } from '../gfx/character';
import { LOCATIONS, WORLD_SCALE } from '../data/world';
import { clamp } from '../core/rng';
import { drawAmb } from '../gfx/ambTex';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface Drawable { y: number; draw: (g: G) => void }

abstract class Ent {
  x = 0; y = 0; dead = false; kind = '';
  abstract update(dt: number, gm: Game, life: Life): void;
  /** 地面层（排序绘制） */
  drawGround?(g: G, t: number, dt: number): void;
  /** 天空层（最上） */
  drawSky?(g: G, t: number): void;
  /** 地面投影（在装饰物之前） */
  drawShadow?(g: G, t: number): void;
  /** 夜间发光（叠加） */
  glow?(g: G, t: number, night: number): void;
}

// ---------------- 飞鸟（人字形雁阵 / 散群）----------------
class Flock extends Ent {
  kind = 'flock';
  vx: number; vy: number; birds: { ox: number; oy: number; ph: number }[] = []; alt: number; life = 0; size: number;
  constructor(x: number, y: number, ang: number, crane = false, gull = false) {
    super(); this.x = x; this.y = y;
    const sp = crane ? rand(60, 90) : rand(110, 170);
    this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp * 0.6;
    this.alt = crane ? rand(160, 260) : rand(220, 380);
    this.size = crane ? 1 : 0.55;
    const n = crane ? 1 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 7);
    const v = !crane && Math.random() < 0.6;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2);
      this.birds.push(v ? { ox: -k * 34, oy: side * k * 26, ph: Math.random() * TAU } : { ox: rand(-90, 90), oy: rand(-60, 60), ph: Math.random() * TAU });
    }
    if (crane) this.kind = 'crane';
    if (gull) {
      // 海鸥：海边三五只，低空盘旋般斜掠
      this.kind = 'gull'; this.alt = rand(140, 240); this.size = 0.9; this.birds = [];
      const sp = rand(70, 110); this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp * 0.6;
      const m = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < m; i++) this.birds.push({ ox: rand(-140, 140), oy: rand(-90, 90), ph: Math.random() * TAU });
    }
  }
  update(dt: number) { this.x += this.vx * dt; this.y += this.vy * dt; this.life += dt; if (this.life > 60) this.dead = true; }
  private pos(b: { ox: number; oy: number }) {
    const a = Math.atan2(this.vy, this.vx), c = Math.cos(a), s = Math.sin(a);
    return { x: this.x + b.ox * c - b.oy * s, y: this.y + b.ox * s + b.oy * c };
  }
  drawShadow(g: G) {
    g.fillStyle = 'rgba(30,36,30,0.13)';
    for (const b of this.birds) { const p = this.pos(b); g.beginPath(); g.ellipse(p.x + 30, p.y + 10, 12 * this.size * 1.6, 4 * this.size * 1.6, 0, 0, TAU); g.fill(); }
  }
  drawSky(g: G, t: number) {
    const crane = this.kind === 'crane';
    for (const b of this.birds) {
      const p = this.pos(b);
      const x = p.x, y = p.y - this.alt;
      const f = Math.sin(t * (crane ? 3.2 : 9) + b.ph);
      const S = crane ? 1.5 : 1;
      const dir = this.vx >= 0 ? 1 : -1;
      // 第二十五步：仙鹤用贴图，振翅靠纵向伸缩 + 身形微起伏
      if (this.kind === 'gull') {
        const fl = 0.5 + 0.5 * Math.sin(t * 2.6 + b.ph);
        if (drawAmb(g, 'seagull', x, y + Math.sin(t * 0.9 + b.ph) * 12, { flip: dir < 0, s: 0.8, sy: 0.7 + 0.32 * fl, rot: dir * 0.12 * Math.sin(t * 0.7 + b.ph), ay: 0.5 })) continue;
      }
      if (crane && drawAmb(g, 'crane_fly', x, y, { flip: dir < 0, s: 0.95, sy: 0.78 + 0.24 * (0.5 + 0.5 * Math.sin(t * 3.2 + b.ph)), rot: dir * 0.04 * Math.sin(t * 1.1 + b.ph), ay: 0.5 })) continue;
      if (crane) {
        // 仙鹤：白身、黑翅尖、长颈红顶
        g.strokeStyle = '#f6f4ee'; g.lineWidth = 5 * S; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 14 * S * dir, y); g.lineTo(x + 10 * S * dir, y - 2); g.stroke();
        g.strokeStyle = '#f2f0ea'; g.lineWidth = 2 * S;
        g.beginPath(); g.moveTo(x + 10 * S * dir, y - 2); g.lineTo(x + 24 * S * dir, y - 5); g.stroke();
        g.fillStyle = '#c8302a'; g.beginPath(); g.arc(x + 24 * S * dir, y - 6, 1.8 * S, 0, TAU); g.fill();
        g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.5 * S;
        g.beginPath(); g.moveTo(x - 14 * S * dir, y); g.lineTo(x - 26 * S * dir, y + 3); g.stroke();
        for (const s of [-1, 1]) {
          const wy = y - f * 16 * S * s * 0.6 - 10 * S * (s > 0 ? 1 : -0.2);
          g.fillStyle = '#f8f6f0';
          g.beginPath(); g.moveTo(x - 4 * S * dir, y - 1); g.quadraticCurveTo(x + 2 * S * dir, wy, x - 14 * S * dir, wy - 2 * s); g.lineTo(x - 8 * S * dir, y); g.closePath(); g.fill();
          g.strokeStyle = '#2a2a2a'; g.lineWidth = 2.4 * S; g.beginPath(); g.moveTo(x - 10 * S * dir, wy - 1 * s); g.lineTo(x - 14 * S * dir, wy - 2 * s); g.stroke();
        }
      } else {
        g.strokeStyle = 'rgba(36,32,28,0.85)'; g.lineWidth = 1.8; g.lineCap = 'round';
        const w = 9, h = 5 * f;
        g.beginPath(); g.moveTo(x - w, y - h); g.quadraticCurveTo(x - w * 0.4, y - h * 0.2 - 2, x, y); g.quadraticCurveTo(x + w * 0.4, y - h * 0.2 - 2, x + w, y - h); g.stroke();
      }
    }
  }
}

// ---------------- 野外走兽 / 涉禽（受惊逃窜；鹤与鹭受惊振翅飞走）----------------
type CritKind = 'deer' | 'rabbit' | 'snowfox' | 'monkey' | 'egret' | 'crane' | 'camel' | 'yak' | 'turtle' | 'chicken' | 'dog' | 'ox' | 'sheep' | 'horse' | 'duck';
// 每种的脾性：踱步速度、受惊距离、逃窜速度、投影大小、贴图名、步态起伏幅度、是否会飞
const CRIT: Record<CritKind, { sp: number; scare: number; fs: number; sh: number; tex: string; bob: number; hop?: boolean; fly?: boolean }> = {
  deer: { sp: 70, scare: 260, fs: 330, sh: 22, tex: 'deer', bob: 4 },
  rabbit: { sp: 50, scare: 170, fs: 260, sh: 10, tex: 'rabbit', bob: 9, hop: true },
  snowfox: { sp: 60, scare: 220, fs: 300, sh: 16, tex: 'snowfox', bob: 3 },
  monkey: { sp: 60, scare: 200, fs: 280, sh: 14, tex: 'monkey', bob: 6, hop: true },
  egret: { sp: 26, scare: 230, fs: 0, sh: 12, tex: 'egret', bob: 1.5, fly: true },
  crane: { sp: 24, scare: 250, fs: 0, sh: 13, tex: 'crane_idle', bob: 1.5, fly: true },
  camel: { sp: 40, scare: 150, fs: 160, sh: 40, tex: 'camel', bob: 3 },
  yak: { sp: 34, scare: 150, fs: 170, sh: 34, tex: 'yak', bob: 2.5 },
  turtle: { sp: 8, scare: 90, fs: 14, sh: 12, tex: 'turtle', bob: 0.5 },
  // 城镇村落外的家畜：不怕人，只略略让开
  chicken: { sp: 30, scare: 90, fs: 120, sh: 9, tex: 'chicken', bob: 3, hop: true },
  dog: { sp: 55, scare: 0, fs: 0, sh: 15, tex: 'dog', bob: 3 },
  ox: { sp: 22, scare: 0, fs: 0, sh: 36, tex: 'ox', bob: 2 },
  sheep: { sp: 28, scare: 100, fs: 110, sh: 20, tex: 'sheep', bob: 2.5 },
  horse: { sp: 40, scare: 120, fs: 180, sh: 34, tex: 'horse', bob: 3 },
  duck: { sp: 20, scare: 110, fs: 80, sh: 12, tex: 'duck', bob: 1.5 },
};
class Critter extends Ent {
  vx = 0; vy = 0; t = Math.random() * 10; wait = rand(0.5, 3); flee = 0; dir = Math.random() < 0.5 ? -1 : 1; hop = 0; alt = 0;
  constructor(x: number, y: number, kind: CritKind) { super(); this.x = x; this.y = y; this.kind = kind; }
  get c() { return CRIT[this.kind as CritKind]; }
  update(dt: number, gm: Game) {
    this.t += dt;
    const p = gm.player, C = this.c;
    const d = Math.hypot(this.x - p.x, this.y - p.y);
    if (d < C.scare && this.flee <= 0 && this.alt === 0) {
      this.flee = rand(1.6, 2.6);
      const a = Math.atan2(this.y - p.y, this.x - p.x) + rand(-0.4, 0.4);
      const fs = C.fly ? 150 : C.fs;
      this.vx = Math.cos(a) * fs; this.vy = Math.sin(a) * fs;
      if (C.fly) this.alt = 0.01;
    }
    if (this.alt > 0) {
      // 振翅而起，越飞越高，飞出视野便散去
      this.alt += dt * (60 + this.alt * 0.9); this.vx *= 1 + dt * 0.4; this.vy *= 1 + dt * 0.4;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.abs(this.vx) > 1) this.dir = this.vx > 0 ? 1 : -1;
      if (this.alt > 700) this.dead = true;
      return;
    }
    if (this.flee > 0) { this.flee -= dt; if (this.flee <= 0) { this.vx = this.vy = 0; this.wait = rand(1, 3); } }
    else {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.vx || this.vy) { this.vx = this.vy = 0; this.wait = rand(1.5, 5); }
        else { const a = Math.random() * TAU; this.vx = Math.cos(a) * C.sp; this.vy = Math.sin(a) * C.sp * 0.7; this.wait = rand(0.8, 2.4); }
      }
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (gm.terrain.isLand(nx, ny) || C.fly) { this.x = nx; this.y = ny; } else { this.vx = -this.vx; this.vy = -this.vy; }
    if (Math.abs(this.vx) > 1) this.dir = this.vx > 0 ? 1 : -1;
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 1;
    this.hop = moving ? this.hop + dt * (this.flee > 0 ? 14 : 8) : 0;
    if (d > 3200) this.dead = true;
  }
  /** 贴图版：步态起伏、跳跃落地压缩、站立呼吸、振翅飞走 */
  private drawTex(g: G): boolean {
    const C = this.c, x = this.x, y = this.y, flip = this.dir < 0;
    if (this.alt > 0) {
      // 起飞：地上投影渐小，鸟身振翅上升
      const k = Math.min(1, this.alt / 300);
      g.fillStyle = `rgba(40,40,30,${0.2 * (1 - k * 0.7)})`; g.beginPath(); g.ellipse(x, y, C.sh * (1 - k * 0.4), C.sh * 0.3 * (1 - k * 0.4), 0, 0, TAU); g.fill();
      const f = Math.sin(this.t * 13);
      return drawAmb(g, 'crane_fly', x, y - this.alt * 0.6 - 10, { flip, s: this.kind === 'egret' ? 0.7 : 0.85, sy: 0.82 + 0.2 * f, rot: (flip ? 1 : -1) * 0.12 * Math.min(1, this.alt / 80), ay: 0.5 });
    }
    const moving = this.hop > 0;
    let lift = 0, sx = 1, sy = 1, rot = 0;
    if (moving) {
      const ph = Math.sin(this.hop);
      if (C.hop) { const a = Math.abs(ph); lift = a * C.bob * (this.flee > 0 ? 1.4 : 1); if (a < 0.25) { sx = 1.06; sy = 0.92; } else { sx = 0.97; sy = 1.04; } rot = (flip ? -1 : 1) * -0.12 * Math.cos(this.hop); }
      else { lift = Math.abs(ph) * C.bob * (this.flee > 0 ? 1.5 : 1); rot = ph * 0.035; if (this.flee > 0) rot += (flip ? 0.06 : -0.06); }
    } else { sy = 1 + 0.012 * Math.sin(this.t * 2.2); sx = 1 - 0.006 * Math.sin(this.t * 2.2); }
    const sh = C.sh * (1 - lift / 40);
    g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(x, y, sh, sh * 0.28, 0, 0, TAU); g.fill();
    return drawAmb(g, C.tex, x, y - lift + 2, { flip, sx, sy, rot });
  }
  drawGround(g: G, t: number) {
    if (this.drawTex(g)) return;
    if (this.kind !== 'deer' && this.kind !== 'rabbit') return;
    const x = this.x, y = this.y, s = this.dir;
    const moving = this.hop > 0;
    g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(x, y, this.kind === 'deer' ? 22 : 10, this.kind === 'deer' ? 6 : 3.5, 0, 0, TAU); g.fill();
    if (this.kind === 'rabbit') {
      const by = y - 7 - (moving ? Math.abs(Math.sin(this.hop)) * 8 : 0);
      g.fillStyle = '#b8a48a'; g.beginPath(); g.ellipse(x, by, 8, 6, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + 6 * s, by - 5, 4.5, 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#a89278'; g.beginPath(); g.ellipse(x + 5 * s, by - 12, 1.6, 5, -0.2 * s, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + 7.5 * s, by - 11, 1.6, 5, 0.2 * s, 0, TAU); g.fill();
      g.fillStyle = '#f4f0e8'; g.beginPath(); g.arc(x - 7 * s, by, 2.4, 0, TAU); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(x + 8 * s, by - 6, 0.9, 0, TAU); g.fill();
      return;
    }
    // 鹿
    const ph = this.hop;
    const by = y - 26 - (this.flee > 0 ? Math.abs(Math.sin(ph)) * 6 : 0);
    g.strokeStyle = '#6a4a30'; g.lineWidth = 2.4; g.lineCap = 'round';
    const legs = [[-12, 0], [-8, Math.PI], [10, Math.PI * 0.5], [14, Math.PI * 1.5]];
    for (const [lx, lp] of legs) {
      const sw = moving ? Math.sin(ph + lp) * 7 : 0;
      g.beginPath(); g.moveTo(x + lx * s, by + 4); g.lineTo(x + (lx + sw) * s, y - 1); g.stroke();
    }
    g.fillStyle = '#a0704a'; g.beginPath(); g.ellipse(x, by, 19, 8, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(250,240,220,0.7)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (-8 + k * 5) * s, by - 3 + (k % 2) * 2, 1.4, 0, TAU); g.fill(); }
    g.fillStyle = '#a0704a';
    g.beginPath(); g.moveTo(x + 13 * s, by - 3); g.lineTo(x + 20 * s, by - 18); g.lineTo(x + 25 * s, by - 16); g.lineTo(x + 18 * s, by); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(x + 25 * s, by - 18, 6, 3.6, 0.3 * s, 0, TAU); g.fill();
    g.strokeStyle = '#5a3a24'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x + 22 * s, by - 21); g.lineTo(x + 18 * s, by - 32); g.lineTo(x + 14 * s, by - 36); g.moveTo(x + 18 * s, by - 32); g.lineTo(x + 22 * s, by - 38); g.stroke();
    g.fillStyle = '#f4ece0'; g.beginPath(); g.ellipse(x - 18 * s, by - 3, 3, 2.4, 0, 0, TAU); g.fill();
  }
}

// ---------------- 蝴蝶 ----------------
class Butterfly extends Ent {
  kind = 'butterfly'; t = Math.random() * 10; col: string; bx: number; by: number;
  constructor(x: number, y: number) { super(); this.x = this.bx = x; this.y = this.by = y; this.col = ['#f0d050', '#f4f0f0', '#e08070', '#90b0f0'][Math.floor(Math.random() * 4)]; }
  update(dt: number, gm: Game) { this.t += dt; this.x = this.bx + Math.sin(this.t * 0.7) * 60 + Math.sin(this.t * 2.3) * 12; this.y = this.by + Math.cos(this.t * 0.5) * 40; if (Math.hypot(this.x - gm.player.x, this.y - gm.player.y) > 2000) this.dead = true; }
  drawGround(g: G) {
    const f = Math.abs(Math.sin(this.t * 14));
    const x = this.x, y = this.y - 26 - Math.sin(this.t * 3) * 6;
    g.fillStyle = this.col;
    g.beginPath(); g.ellipse(x - 3 * f, y, 3.6 * f + 0.6, 2.6, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x + 3 * f, y, 3.6 * f + 0.6, 2.6, 0.4, 0, TAU); g.fill();
    g.fillStyle = '#2a2a2a'; g.fillRect(x - 0.5, y - 2, 1, 4);
  }
}

// ---------------- 萤火 ----------------
class Firefly extends Ent {
  kind = 'firefly'; t = Math.random() * 10; bx: number; by: number;
  constructor(x: number, y: number) { super(); this.x = this.bx = x; this.y = this.by = y; }
  update(dt: number, gm: Game) { this.t += dt; this.x = this.bx + Math.sin(this.t * 0.4 + this.bx) * 50; this.y = this.by + Math.sin(this.t * 0.33) * 30 - 20; if (Math.hypot(this.x - gm.player.x, this.y - gm.player.y) > 2000) this.dead = true; }
  glow(g: G, t: number, night: number, glowImg?: HTMLCanvasElement) {
    const a = night * (0.5 + 0.5 * Math.sin(this.t * 3 + this.bx));
    if (a < 0.05 || !glowImg) return;
    g.globalAlpha = a; g.drawImage(glowImg, this.x - 10, this.y - 10, 20, 20); g.globalAlpha = 1;
  }
}

// ---------------- 鱼跃 ----------------
class FishJump extends Ent {
  kind = 'fish'; t = 0; dir = Math.random() < 0.5 ? -1 : 1; carp = Math.random() < 0.5 ? 'carp_a' : 'carp_b';
  constructor(x: number, y: number) { super(); this.x = x; this.y = y; }
  update(dt: number) { this.t += dt; if (this.t > 2.2) this.dead = true; }
  drawShadow(g: G) {
    // 水面涟漪
    const k = this.t / 2.2;
    g.strokeStyle = `rgba(240,250,250,${0.6 * (1 - k)})`; g.lineWidth = 1.5;
    for (const o of [0, 0.4]) { const r = 6 + (k + o) * 40; g.beginPath(); g.ellipse(this.x, this.y, r, r * 0.4, 0, 0, TAU); g.stroke(); }
    if (this.t < 0.8) {
      const u = this.t / 0.8;
      const fx = this.x + (u - 0.5) * 40 * this.dir, fy = this.y - Math.sin(u * Math.PI) * 34;
      // 第二十五步：锦鲤贴图，沿抛物线转身
      if (drawAmb(g, this.carp, fx, fy, { flip: this.dir < 0, rot: (u - 0.5) * 2.0 * this.dir, ay: 0.5 })) return;
      g.fillStyle = '#c8a050';
      g.save(); g.translate(fx, fy); g.rotate((u - 0.5) * 2.4 * this.dir);
      g.beginPath(); g.ellipse(0, 0, 8, 3, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-7 * this.dir, 0); g.lineTo(-12 * this.dir, -3); g.lineTo(-12 * this.dir, 3); g.closePath(); g.fill();
      g.restore();
    }
  }
}

// ---------------- 舟船 ----------------
class Boat extends Ent {
  kind = 'boat'; vx: number; vy: number; t = 0; sail: boolean; w: number;
  constructor(x: number, y: number) {
    super(); this.x = x; this.y = y;
    const a = Math.random() * TAU; const sp = rand(25, 50);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.6; this.sail = Math.random() < 0.6; this.w = this.sail ? rand(90, 130) : rand(55, 75);
  }
  update(dt: number, gm: Game) {
    this.t += dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (gm.terrain.isLand(nx + this.vx, ny + this.vy)) { this.vx = -this.vx; this.vy = -this.vy * 0.8 + rand(-10, 10); }
    else { this.x = nx; this.y = ny; }
    if (Math.hypot(this.x - gm.player.x, this.y - gm.player.y) > 4000) this.dead = true;
  }
  drawGround(g: G, t: number) {
    const x = this.x, y = this.y + Math.sin(t * 1.5 + this.w) * 1.5, w = this.w, d = this.vx >= 0 ? 1 : -1;
    // 尾迹
    g.strokeStyle = 'rgba(240,248,248,0.5)'; g.lineWidth = 1.5;
    for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(x - d * w * 0.4, y); g.quadraticCurveTo(x - d * (w * 0.5 + k * 18), y - k * 6, x - d * (w * 0.5 + k * 30), y - k * 9); g.stroke(); g.beginPath(); g.moveTo(x - d * w * 0.4, y); g.quadraticCurveTo(x - d * (w * 0.5 + k * 18), y + k * 6, x - d * (w * 0.5 + k * 30), y + k * 9); g.stroke(); }
    // 倒影
    g.fillStyle = 'rgba(40,50,50,0.18)'; g.beginPath(); g.ellipse(x, y + 6, w * 0.5, 7, 0, 0, TAU); g.fill();
    // 帆船用贴图（国风淡彩），随波轻摇；小舟仍为代码绘制
    const im = this.sail ? bldTex('boat') : null;
    if (im) {
      const bw = w * 1.15, bh = bw * im.height / im.width, rock = Math.sin(t * 1.2 + w) * 0.025;
      g.save(); g.translate(x, y + 4); g.rotate(rock); if (d < 0) g.scale(-1, 1);
      g.drawImage(im, -bw / 2, -bh, bw, bh); g.restore();
      return;
    }
    g.beginPath(); g.moveTo(x - w / 2, y - 10); g.quadraticCurveTo(x - w / 2 + 6, y, x - w / 4, y); g.lineTo(x + w / 4, y); g.quadraticCurveTo(x + w / 2 - 6, y, x + w / 2, y - 10); g.closePath();
    g.fillStyle = '#6a4a30'; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1.2; g.stroke();
    if (this.sail) {
      g.strokeStyle = '#4a3020'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y - 74); g.stroke();
      const bil = Math.sin(t * 0.8 + w) * 4;
      g.beginPath(); g.moveTo(x + 2 * d, y - 70); g.quadraticCurveTo(x + (28 + bil) * d, y - 46, x + 4 * d, y - 16); g.lineTo(x + 2 * d, y - 16); g.closePath();
      g.fillStyle = '#ece0c4'; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(80,60,40,0.4)'; for (let yy = -60; yy < -20; yy += 9) { g.beginPath(); g.moveTo(x + 2 * d, y + yy); g.lineTo(x + 16 * d, y + yy + 2); g.stroke(); }
    } else {
      g.beginPath(); g.moveTo(x - w * 0.2, y - 10); g.quadraticCurveTo(x, y - 26, x + w * 0.2, y - 10); g.closePath(); g.fillStyle = '#4a3a2a'; g.fill();
      // 撑船人（斗笠）
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w * 0.3 * d, y - 30); g.lineTo(x + w * 0.45 * d, y + 6); g.stroke();
      g.fillStyle = '#5a6a7a'; g.fillRect(x + w * 0.28 * d - 3, y - 26, 6, 14);
      g.fillStyle = '#c8b080'; g.beginPath(); g.moveTo(x + w * 0.28 * d - 9, y - 26); g.lineTo(x + w * 0.28 * d, y - 33); g.lineTo(x + w * 0.28 * d + 9, y - 26); g.closePath(); g.fill();
    }
  }
}

// ---------------- 行人 / 商队 ----------------
class Walker extends Ent {
  kind = 'walker'; st: CharState; look: Look; tx = 0; ty = 0; wait = 0; speed: number; home: { x: number; y: number; r: number };
  route: [number, number][] | null; ri = 0; cart: boolean; scale: number; navLoc: any = null;
  constructor(x: number, y: number, home: { x: number; y: number; r: number }, role: NpcRole, route: [number, number][] | null = null, cart = false) {
    super(); this.x = x; this.y = y; this.home = home; this.route = route; this.cart = cart;
    this.st = new CharState(x, y);
    this.look = randomLook(Math.random, role);
    this.speed = cart ? 55 : rand(55, 85);
    this.scale = 1.04;
    this.pick();
  }
  private pick() {
    if (this.route) { this.ri = Math.min(this.route.length - 1, this.ri + 1); [this.tx, this.ty] = this.route[this.ri]; return; }
    const a = Math.random() * TAU, r = Math.random() * this.home.r;
    this.tx = this.home.x + Math.cos(a) * r; this.ty = this.home.y + Math.sin(a) * r * 0.7;
  }
  update(dt: number, gm: Game) {
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
    if (this.wait > 0) { this.wait -= dt; this.st.setAction('idle'); this.st.speed = 0; }
    else if (d < 10) {
      if (this.route && this.ri >= this.route.length - 1) {
        const nr = this.navLoc ? gm.space?.wander(this.navLoc, this) : null;
        if (nr && nr.length > 1) { this.route = nr; this.ri = 0; this.wait = rand(1, 6); }
        else this.dead = true;
      }
      this.wait = this.route ? (this.navLoc ? this.wait : 0) : rand(1, 5); this.pick();
    } else {
      const vx = dx / d * this.speed, vy = dy / d * this.speed;
      const nx = this.x + vx * dt, ny = this.y + vy * dt;
      if (gm.terrain.isLand(nx, ny)) { this.x = nx; this.y = ny; } else { this.pick(); }
      this.st.setAction('walk'); this.st.speed = this.speed; this.st.faceToward(vx, vy);
    }
    this.st.x = this.x; this.st.y = this.y;
    this.st.update(dt);
    if (Math.hypot(this.x - gm.player.x, this.y - gm.player.y) > 3600) this.dead = true;
  }
  drawGround(g: G, t: number, dt: number) {
    if (this.cart) drawCart(g, this.x - Math.sin(this.st.yaw) * 70, this.y - Math.cos(this.st.yaw) * 70 * 0.55, this.st.yaw, t, this.wait <= 0);
    g.fillStyle = 'rgba(40,40,30,0.25)'; g.beginPath(); g.ellipse(this.x, this.y + 2, 15, 5, 0, 0, TAU); g.fill();
    drawCharacter(g, this.look, this.st, this.scale, dt);
  }
}

function drawCart(g: G, x: number, y: number, yaw: number, t: number, moving: boolean) {
  const d = Math.sin(yaw) >= 0 ? 1 : -1;
  g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(x, y + 2, 50, 10, 0, 0, TAU); g.fill();
  // 牛
  const ox = x + d * 46, bob = moving ? Math.sin(t * 6) * 1.5 : 0;
  g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(ox, y - 22 + bob, 18, 10, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(ox + d * 18, y - 24 + bob, 7, 6, 0, 0, TAU); g.fill();
  g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ox + d * 16, y - 29); g.quadraticCurveTo(ox + d * 12, y - 36, ox + d * 18, y - 37); g.stroke();
  g.strokeStyle = '#4a3a2a'; g.lineWidth = 3;
  for (const lx of [-10, -4, 8, 13]) { const sw = moving ? Math.sin(t * 6 + lx) * 4 : 0; g.beginPath(); g.moveTo(ox + lx * d, y - 16); g.lineTo(ox + (lx + sw) * d, y); g.stroke(); }
  // 车
  g.strokeStyle = '#5a3a20'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + d * 10, y - 20); g.lineTo(ox - d * 10, y - 22); g.stroke();
  g.fillStyle = '#8a6a48'; g.fillRect(x - 28, y - 34, 56, 18);
  g.fillStyle = '#c8b890'; g.beginPath(); g.moveTo(x - 26, y - 34); g.quadraticCurveTo(x, y - 54, x + 26, y - 34); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1; g.stroke(); g.strokeRect(x - 28, y - 34, 56, 18);
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y - 10, 10, 0, TAU); g.stroke();
  g.lineWidth = 1; const r = moving ? t * 4 : 0;
  for (let k = 0; k < 4; k++) { const a = r + (k * Math.PI) / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * 10, y - 10 + Math.sin(a) * 10); g.lineTo(x - Math.cos(a) * 10, y - 10 - Math.sin(a) * 10); g.stroke(); }
}

// ---------------- 御剑修士（高空掠过，地面投影）----------------
class Flier extends Ent {
  kind = 'flier'; st: CharState; look: Look; vx: number; vy: number; alt: number; t = 0; col: string;
  constructor(x: number, y: number, ang: number) {
    super(); this.x = x; this.y = y;
    const sp = rand(380, 620);
    this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp * 0.7;
    this.alt = rand(150, 260);
    this.st = new CharState(x, y); this.st.setAction('fly'); this.st.faceToward(this.vx, this.vy, false);
    this.st.yaw = this.st.targetYaw;
    this.look = randomLook(Math.random, Math.random() < 0.3 ? 'female' : 'cultivator');
    this.col = ['#7ae0b0', '#a0c8ff', '#ffd080', '#ff9a9a', '#d0a0ff'][Math.floor(Math.random() * 5)];
  }
  update(dt: number) {
    this.t += dt; this.x += this.vx * dt; this.y += this.vy * dt;
    this.st.x = this.x; this.st.y = this.y; this.st.lift = this.alt + Math.sin(this.t * 2) * 6; this.st.speed = 400;
    this.st.vx = this.vx; this.st.vy = this.vy;
    this.st.update(dt);
    if (this.t > 30) this.dead = true;
  }
  drawShadow(g: G) {
    g.fillStyle = 'rgba(30,36,30,0.16)'; g.beginPath(); g.ellipse(this.x + 20, this.y + 8, 26, 7, 0, 0, TAU); g.fill();
  }
  drawSky(g: G, t: number) {
    // 遁光拖尾
    const tx = this.x - this.vx * 0.35, ty = this.y - this.st.lift - this.vy * 0.35;
    const gr = g.createLinearGradient(this.x, this.y - this.st.lift, tx, ty);
    gr.addColorStop(0, rgbaHex(this.col, 0.5)); gr.addColorStop(1, rgbaHex(this.col, 0));
    g.strokeStyle = gr; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(this.x, this.y - this.st.lift + 4); g.lineTo(tx, ty + 4); g.stroke();
    drawSwordUnderFeet(g, this.x, this.y - this.st.lift, this.st.yaw, 0.8, t, this.col);
    drawCharacter(g, this.look, this.st, 0.8, 0.016);
  }
}
function rgbaHex(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ======================= 管理器 =======================
export class Life {
  ents: Ent[] = [];
  private timers: Record<string, number> = {};
  glowImg: HTMLCanvasElement | null = null;
  constructor() {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(220,255,160,1)'); gr.addColorStop(0.3, 'rgba(200,255,120,0.5)'); gr.addColorStop(1, 'rgba(200,255,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.glowImg = c;
    }
  }
  /** 调试：在主角周围放几只走兽（看比例） */
  debugCritters(kinds: string[], x: number, y: number) { for (let i = this.ents.length - 1; i >= 0; i--) if (this.ents[i] instanceof Critter) this.ents.splice(i, 1); if (kinds[0] === 'gull') { const f = new Flock(x - 200, y + 150, 0, false, true); f.vx = 8; f.vy = 0; this.ents.push(f); return; } kinds.forEach((k, i) => { const c = new Critter(x - 330 + (i % 5) * 160, y - 120 + Math.floor(i / 5) * 170, k as CritKind); c.wait = 99; this.ents.push(c); }); }
  private count(kind: string) { let n = 0; for (const e of this.ents) if (e.kind === kind) n++; return n; }
  private every(key: string, dt: number, period: number) {
    this.timers[key] = (this.timers[key] ?? Math.random() * period) - dt;
    if (this.timers[key] <= 0) { this.timers[key] = period * rand(0.6, 1.4); return true; }
    return false;
  }

  update(dt: number, gm: Game, view: { left: number; top: number; right: number; bottom: number }, night: number, season: number, weather: string) {
    const p = gm.player, T = gm.terrain;
    const vw = view.right - view.left, vh = view.bottom - view.top;
    const zoomedOut = vw > 5000;
    const rainy = weather === 'rain' || weather === 'storm' || weather === 'snow';
    // 飞鸟：从视野外飞入
    if (this.every('flock', dt, 7) && this.count('flock') < 3 && night < 0.6 && !rainy) {
      const a = Math.random() * TAU;
      const sx = p.x - Math.cos(a) * (vw * 0.7 + 300), sy = p.y - Math.sin(a) * (vh * 0.7 + 300);
      this.ents.push(new Flock(sx, sy, a + rand(-0.3, 0.3)));
    }
    // 海鸥：岸边或海上（四周有海水）
    if (this.every('gull', dt, 8) && this.count('gull') < 2 && night < 0.5 && !rainy) {
      let sea = 0;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; if (!T.isLand(p.x + Math.cos(a) * 1400, p.y + Math.sin(a) * 1400) && !T.nearRiver(p.x + Math.cos(a) * 1400, p.y + Math.sin(a) * 1400)) sea++; }
      if (sea >= 2) {
        const a = Math.random() * TAU;
        this.ents.push(new Flock(p.x - Math.cos(a) * (vw * 0.6 + 200), p.y - Math.sin(a) * (vh * 0.6 + 200), a, false, true));
      }
    }
    // 仙鹤：宗门/高山附近
    if (this.every('crane', dt, 9) && this.count('crane') < 2 && night < 0.5) {
      const s = T.sample(p.x, p.y);
      const nearSect = LOCATIONS.some((l) => l.type === 'sect' && Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y) < 5000);
      if (nearSect || s.elev > 0.4 || Math.random() < 0.15) {
        const a = Math.random() * TAU;
        this.ents.push(new Flock(p.x - Math.cos(a) * (vw * 0.6 + 200), p.y - Math.sin(a) * (vh * 0.6 + 200), a, true));
      }
    }
    // 御剑修士
    if (this.every('flier', dt, 11) && this.count('flier') < 2) {
      const a = Math.random() * TAU;
      this.ents.push(new Flier(p.x - Math.cos(a) * (vw * 0.7 + 400), p.y - Math.sin(a) * (vh * 0.7 + 400), a + rand(-0.2, 0.2)));
    }
    if (!zoomedOut) {
      // 鹿兔
      let nCrit = 0; for (const e of this.ents) if (e instanceof Critter) nCrit++;
      if (this.every('critter', dt, 2.5) && nCrit < 7) {
        const x = rand(view.left, view.right), y = rand(view.top, view.bottom);
        const s = T.sample(x, y);
        const outOfView = Math.abs(x - p.x) > 300 || Math.abs(y - p.y) > 300;
        const town = outOfView && T.isLand(x, y) && !T.inLocZone(x, y, 200) && T.inLocZone(x, y, 900) && LOCATIONS.some((l) => (l.type === 'town' || l.type === 'city' || l.type === 'isle') && Math.hypot(l.x * WORLD_SCALE - x, l.y * WORLD_SCALE - y) < 4500);
        if (town) {
          // 城镇村落外：鸡、狗、牛、羊、马，水边有鸭（草原多马羊，雪地多牦牛）
          const r = Math.random(), add = (k: CritKind) => this.ents.push(new Critter(x, y, k));
          if (T.nearRiver(x, y) && r < 0.4) add('duck');
          else if (s.cold >= 0.6) add(r < 0.6 ? 'yak' : 'dog');
          else if (s.arid >= 0.6) add(r < 0.45 ? 'sheep' : r < 0.8 ? 'horse' : 'camel');
          else add(r < 0.3 ? 'chicken' : r < 0.5 ? 'dog' : r < 0.7 ? 'ox' : r < 0.88 ? 'sheep' : 'horse');
        } else if (outOfView && T.isLand(x, y) && !T.inLocZone(x, y, 200) && s.elev < 0.9) {
          const r = Math.random();
          const add = (k: CritKind) => this.ents.push(new Critter(x, y, k));
          if (T.nearRiver(x, y) && s.cold < 0.6 && r < 0.45) add(r < 0.2 ? 'crane' : r < 0.4 ? 'egret' : 'turtle');   // 水边：鹤、白鹭、龟
          else if (s.cold >= 0.6) { if (s.elev > 0.35 && r < 0.4) add('yak'); else if (r < 0.75) add('snowfox'); }   // 雪地：牦牛、雪狐
          else if (s.arid >= 0.75) { if (r < 0.45) add('camel'); }                                                    // 荒漠：骆驼
          else if (s.elev < 0.6) {
            if (s.forest > 0.5 && s.elev > 0.3 && r < 0.25) add('monkey');                                           // 山林：猴
            else if (s.forest > 0.35 && r < 0.6) add('deer');
            else if (r < 0.7) add('rabbit');
          }
        }
      }
      // 蝴蝶（春夏白天）
      if ((season === 0 || season === 1) && night < 0.3 && !rainy && this.every('bfly', dt, 1.5) && this.count('butterfly') < 6) {
        const x = p.x + rand(-600, 600), y = p.y + rand(-400, 400);
        const s = T.sample(x, y);
        if (T.isLand(x, y) && s.arid < 0.6 && s.cold < 0.5) this.ents.push(new Butterfly(x, y));
      }
      // 萤火（夏秋夜晚）
      if (night > 0.5 && (season === 1 || season === 2) && this.every('ffly', dt, 0.4) && this.count('firefly') < 26) {
        const x = p.x + rand(-900, 900), y = p.y + rand(-600, 600);
        const s = T.sample(x, y);
        if (T.isLand(x, y) && (s.forest > 0.3 || T.nearRiver(x, y))) this.ents.push(new Firefly(x, y));
      }
      // 鱼跃
      if (this.every('fish', dt, 1.1) && this.count('fish') < 3) {
        const x = rand(view.left, view.right), y = rand(view.top, view.bottom);
        if (!T.isLand(x, y) && T.sample(x, y).land > 0.15) this.ents.push(new FishJump(x, y));
      }
      // 舟船
      if (this.every('boat', dt, 4) && this.count('boat') < 4) {
        const x = rand(view.left - 400, view.right + 400), y = rand(view.top - 300, view.bottom + 300);
        const s = T.sample(x, y);
        if (!T.isLand(x, y) && !T.isLand(x + 80, y) && !T.isLand(x - 80, y) && s.land > 0.05) this.ents.push(new Boat(x, y));
      }
      // 行人：城镇附近
      if (this.every('walker', dt, gm.space?.near.length ? 0.6 : 1.2) && this.count('walker') < (gm.space?.near.length ? 26 : 14)) {
        for (let li = 0; li < LOCATIONS.length; li++) {
          const l = LOCATIONS[li];
          if (l.type !== 'city' && l.type !== 'town' && l.type !== 'sect') continue;
          const lx = l.x * WORLD_SCALE, ly = l.y * WORLD_SCALE;
          if (lx < view.left - 2600 || lx > view.right + 2600 || ly < view.top - 2600 || ly > view.bottom + 2600) continue;
          const zone = T.locZones[li];
          const r = zone ? Math.min(zone.rx, zone.ry * 1.4) * 1.1 : 600;
          const roles: NpcRole[] = l.type === 'sect' ? ['cultivator', 'cultivator', 'female', 'elder'] : ['farmer', 'merchant', 'scholar', 'female', 'guard', 'elder', 'monk', 'cultivator'];
          // 第二十二步：贴图布局的城镇——沿街巷走
          const rt = gm.space?.wander(l);
          if (rt && rt.length > 1) { const w = new Walker(rt[0][0], rt[0][1], { x: lx, y: ly, r }, roles[Math.floor(Math.random() * roles.length)], rt.slice(1)); w.navLoc = l; this.ents.push(w); break; }
          const a = Math.random() * TAU, rr = Math.random() * r;
          const x = lx + Math.cos(a) * rr, y = ly + Math.sin(a) * rr * 0.7;
          if (T.isLand(x, y)) { this.ents.push(new Walker(x, y, { x: lx, y: ly, r }, roles[Math.floor(Math.random() * roles.length)])); break; }
        }
      }
      // 商队：沿官道
      if (this.every('caravan', dt, 9) && this.count('walker') < 16) {
        for (const rd of T.roads) {
          if (!rd.major && Math.random() < 0.5) continue;
          let near = -1;
          for (let i = 0; i < rd.pts.length; i += 3) { const x = rd.pts[i][0] * WORLD_SCALE, y = rd.pts[i][1] * WORLD_SCALE; if (x > view.left - 500 && x < view.right + 500 && y > view.top - 500 && y < view.bottom + 500) { near = i; break; } }
          if (near < 0) continue;
          const fwd = Math.random() < 0.5;
          const pts = rd.pts.map(([x, y]) => [x * WORLD_SCALE, y * WORLD_SCALE] as [number, number]);
          const route = fwd ? pts.slice(Math.max(0, near - 6)) : pts.slice(0, Math.min(pts.length, near + 7)).reverse();
          if (route.length < 3) continue;
          const [sx, sy] = route[0];
          this.ents.push(new Walker(sx, sy, { x: sx, y: sy, r: 0 }, 'merchant', route.slice(1), true));
          if (Math.random() < 0.7) { const w2 = new Walker(sx - 40, sy - 20, { x: sx, y: sy, r: 0 }, Math.random() < 0.5 ? 'guard' : 'farmer', route.slice(1)); this.ents.push(w2); }
          break;
        }
      }
    }
    for (const e of this.ents) e.update(dt, gm, this);
    // 远离玩家的天空实体也清理
    this.ents = this.ents.filter((e) => !e.dead && Math.abs(e.x - p.x) < vw * 2 + 3000 && Math.abs(e.y - p.y) < vh * 2 + 3000);
  }

  /** 神识范围：圈外的一切动静都不可见（由渲染器每帧设置） */
  sense = { x: 0, y: 0, R: 1e9 };
  /** 实体在神识中的可见度 0–1（边缘柔和淡入） */
  vis(e: { x: number; y: number }) {
    const d = Math.hypot(e.x - this.sense.x, e.y - this.sense.y);
    return clamp((this.sense.R - d) / 110, 0, 1);
  }
  private withVis(g: G, e: Ent, f: () => void) {
    const a = this.vis(e);
    if (a <= 0.01) return;
    if (a >= 0.99) { f(); return; }
    const ga = g.globalAlpha; g.globalAlpha = ga * a; f(); g.globalAlpha = ga;
  }
  collectGround(out: Drawable[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    for (const e of this.ents) {
      if (!e.drawGround) continue;
      if (e.x < view.left - 200 || e.x > view.right + 200 || e.y < view.top - 100 || e.y > view.bottom + 200) continue;
      if (this.vis(e) <= 0.01) continue;
      out.push({ y: e.y, draw: (g) => this.withVis(g, e, () => e.drawGround!(g, t, dt)) });
    }
  }
  drawShadows(g: G, t: number) { for (const e of this.ents) if (e.drawShadow) this.withVis(g, e, () => e.drawShadow!(g, t)); }
  drawSky(g: G, t: number) { for (const e of this.ents) if (e.drawSky) this.withVis(g, e, () => e.drawSky!(g, t)); }
  /** WebGL：萤火作为发光点输出 */
  collectGlow(night: number, out: (x: number, y: number, r: number, a: number) => void) {
    if (night < 0.05) return;
    for (const e of this.ents) if (e instanceof Firefly) {
      const v = this.vis(e); if (v <= 0.01) continue;
      const f = e as any; const a = night * (0.5 + 0.5 * Math.sin(f.t * 3 + f.bx)) * v;
      if (a >= 0.05) out(e.x, e.y, 10, a);
    }
  }
  drawGlow(g: G, t: number, night: number) {
    if (night < 0.05) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const e of this.ents) if (e instanceof Firefly) this.withVis(g, e, () => (e as Firefly).glow(g, t, night, this.glowImg ?? undefined));
    g.restore();
  }
}

export { clamp };
