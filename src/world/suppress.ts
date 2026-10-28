// 第四十一步：境界压制（威压）
//
// 你神识之内，比你低一个大境界的修士 / 妖兽，被你的威压压得举步维艰（移速 ×0.28）；
// 低两个大境界以上，直接被压在原地动弹不得（不能走、不能遁、不能冲锋扑击——但还能出手）。
// 不只是你：战场上高境界的修士、妖兽，也会压制神识内敌对一方的低境界者（混战里元婴压结丹……）。
// 敛息术收敛了气息，便不再外放威压。城里的闲人：只有对你动了歹意的（劫道、追杀、逃窜）才会被压；
// 神识外放时威压全开，连闲人、凡人也一并压住。
//
// 特效：
//   · 举步维艰（差一个大境界）：脚下一圈淡金色的威压纹缓缓旋转，头顶有细碎的光丝不断压落；
//   · 镇压（差两个以上）：落定的一瞬间光柱轰然砸下、地面震起一圈尘浪；之后脚下是旋转的镇压法印、
//     放射状的地裂，头顶一道压下来的光柱、一圈圈光环往下坠，身形被压矮、微微发颤。
import type { Combat, Enemy } from './combat';
import { audio } from './audio';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
/** 透明度转字符串（避免 1e-17 这类科学计数法） */
const A = (v: number) => (v > 0.001 ? Math.min(1, v) : 0).toFixed(3);

/** 差一个大境界时的移速系数 */
export const SUP_SLOW = 0.28;
export const supMul = (lv: number) => (lv >= 2 ? 0 : lv === 1 ? SUP_SLOW : 1);
/** 战场上修士 / 妖兽的威压半径（玩家用自己的神识半径） */
export const unitSense = (realm: number) => (realm <= 1 ? 0 : 300 + 250 * realm);
/** 威压来自你：金色；来自别人：紫色 */
export const SUP_COL_P = '255,214,140', SUP_COL_N = '168,104,255';

export interface SupView { lv: number; on: number; col: string; seed: number }

export class Suppress {
  private acc = 0;
  private sfxCd = 0;
  private txtBudget = 0;
  constructor(public c: Combat) {}

  /** 每帧：重算战斗单位的压制等级（每 0.15 秒） */
  update(dt: number) {
    const c = this.c, g = c.game, p = g.player, h = g.hero;
    this.sfxCd -= dt;
    for (const e of c.enemies) if (e.sup) e.supOn += dt;
    this.acc -= dt; if (this.acc > 0) return; this.acc = 0.15;
    this.txtBudget = 4;
    const pR = g.concealed || h.dead ? 0 : g.senseRadius;
    const src: Enemy[] = [];
    for (const s of c.enemies) if (!s.dead && !s.gone && s.realm >= 2 && !(s.hideT > 0)) src.push(s);
    for (const e of c.enemies) {
      if (e.dead || e.gone) { e.sup = 0; continue; }
      let best = 0, by: 'p' | Enemy | null = null;
      if (pR > 0 && !e.ally) {
        const gap = h.realm - e.realm;
        if (gap > 0 && Math.hypot(p.x - e.x, p.y - e.y) < pR) { best = gap; by = 'p'; }
      }
      if (best < 2) {
        const te = c.teamOf(e);
        for (const s of src) {
          if (s === e || s.realm - e.realm <= best || c.teamOf(s) === te) continue;
          const R = unitSense(s.realm), dx = s.x - e.x, dy = s.y - e.y;
          if (Math.abs(dx) > R || Math.abs(dy) > R || dx * dx + dy * dy > R * R) continue;
          best = s.realm - e.realm; by = s;
          if (best >= 2) break;
        }
      }
      const lv = best >= 2 ? 2 : best;
      if (lv !== e.sup) {
        if (lv > e.sup) this.onset(e.x, e.y, lv, by === 'p', e.def.kind !== 'human');
        e.sup = lv; e.supOn = 0;
      }
      e.supP = by === 'p';
    }
  }

  /** 压制落下的一瞬间 */
  onset(x: number, y: number, lv: number, byP: boolean, beast: boolean) {
    const c = this.c, col = byP ? SUP_COL_P : SUP_COL_N, e = { x, y };
    if (lv >= 2) {
      c.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 130, t: 0, dur: 0.55, color: col } as any);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + Math.random() * 0.4; c.sparks.push({ x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 8, vx: Math.cos(a) * 170, vy: Math.sin(a) * 50 - 30, t: 0, max: 0.6, size: 6, color: '170,150,120' }); }
      if (this.txtBudget-- > 0) c.texts.push({ x: e.x, y: e.y - 120, s: beast ? '伏地！' : '镇压！', color: `rgb(${col})`, t: 0, vy: -22, big: true });
      if (this.sfxCd <= 0) { this.sfxCd = 0.35; audio.sfx('land'); if (byP) c.game.juice(0.025, 0.2); }
    } else {
      c.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 80, t: 0, dur: 0.45, color: col } as any);
      if (this.txtBudget-- > 0) c.texts.push({ x: e.x, y: e.y - 105, s: '威压', color: `rgba(${col},0.95)`, t: 0, vy: -18 });
    }
  }

  view(e: Enemy): SupView | null { return e.sup && !e.dead ? { lv: e.sup, on: e.supOn, col: e.supP ? SUP_COL_P : SUP_COL_N, seed: e.id } : null; }
}

// ------------------------------------------------------------ 绘制
/** 脚下：威压纹 / 镇压法印与地裂（画在身体之前） */
export function drawSupUnder(g: G, x: number, y: number, v: SupView, t: number) {
  const k = Math.min(1, v.on / 0.25);
  g.save();
  if (v.lv >= 2) {
    // 被压出的暗影
    const sh = g.createRadialGradient(x, y + 2, 0, x, y + 2, 64);
    sh.addColorStop(0, `rgba(20,14,8,${A(0.34 * k)})`); sh.addColorStop(1, 'rgba(20,14,8,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(x, y + 2, 66, 23, 0, 0, TAU); g.fill();
    // 地裂（每人固定的走向）
    g.strokeStyle = `rgba(36,24,12,${A(0.75 * k)})`; g.lineWidth = 2.2; g.lineCap = 'round';
    let s = (v.seed * 9301 + 49297) % 233280;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rnd() * 0.6, L = (34 + rnd() * 34) * Math.min(1, v.on / 0.35);
      g.beginPath(); g.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 4);
      const m1 = 0.5 + rnd() * 0.2, j = (rnd() - 0.5) * 0.5;
      g.lineTo(x + Math.cos(a + j) * L * m1, y + Math.sin(a + j) * L * m1 * 0.36);
      g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L * 0.36); g.stroke();
    }
    // 镇压法印：双环 + 旋转符纹
    g.globalCompositeOperation = 'lighter';
    const pulse = 0.8 + 0.2 * Math.sin(t * 5 + v.seed);
    g.strokeStyle = `rgba(${v.col},${A(0.55 * k * pulse)})`; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(x, y + 2, 58, 20, 0, 0, TAU); g.stroke();
    g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y + 2, 44, 15, 0, 0, TAU); g.stroke();
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = t * 0.9 + (i / 8) * TAU, cx = x + Math.cos(a) * 51, cy = y + 2 + Math.sin(a) * 17.5;
      g.beginPath(); g.moveTo(cx - 3, cy - 2); g.lineTo(cx + 3, cy - 2); g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 2); g.stroke();
    }
    for (let i = 0; i < 3; i++) { const a = -t * 1.4 + (i / 3) * TAU; g.beginPath(); g.ellipse(x, y + 2, 36, 12, 0, a, a + 1.1); g.stroke(); }
  } else {
    // 威压纹：一圈淡金，三段弧缓转
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${v.col},${A(0.32 * k)})`; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(x, y + 2, 40, 14, 0, 0, TAU); g.stroke();
    g.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { const a = t * 0.7 + (i / 3) * TAU; g.beginPath(); g.ellipse(x, y + 2, 48, 17, 0, a, a + 0.8); g.stroke(); }
  }
  g.restore();
}

/** 头顶：压落的光丝 / 光柱与下坠光环（画在身体之后） */
export function drawSupOver(g: G, x: number, y: number, v: SupView, t: number, h = 110) {
  const k = Math.min(1, v.on / 0.25);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  if (v.lv >= 2) {
    const top = y - h - 220;
    // 落定一瞬：光柱砸下
    const slam = v.on < 0.3 ? 1 - v.on / 0.3 : 0;
    const gr = g.createLinearGradient(x, top, x, y);
    gr.addColorStop(0, `rgba(${v.col},0)`); gr.addColorStop(0.55, `rgba(${v.col},${A(0.1 + 0.35 * slam)})`); gr.addColorStop(1, `rgba(${v.col},${A(0.2 + 0.4 * slam)})`);
    g.fillStyle = gr;
    // 柔边光柱：三层由宽到窄叠加，边缘自然淡出
    const wt = 66 + slam * 30, wb = 30 + slam * 26;
    for (const f of [1, 0.66, 0.34]) { g.globalAlpha = 0.42; g.beginPath(); g.moveTo(x - wt * f, top); g.lineTo(x + wt * f, top); g.lineTo(x + wb * f, y); g.lineTo(x - wb * f, y); g.fill(); }
    g.globalAlpha = 1;
    // 一圈圈往下坠的光环（宽度贴着光柱收窄，越往下越亮——像重物压落）
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.9 + i / 3 + v.seed * 0.137) % 1, yy = top + 40 + (y - 8 - top - 40) * q * q;
      const r = (wb + (wt - wb) * (y - yy) / (y - top)) * 0.82;
      g.strokeStyle = `rgba(${v.col},${A(0.42 * k * Math.sin(q * Math.PI * 0.95) * (0.4 + q))})`; g.lineWidth = 1.2 + q * 1.4;
      g.beginPath(); g.ellipse(x, yy, r, r * 0.3, 0, 0, TAU); g.stroke();
    }
    // 压落的光丝
    g.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const q = (t * 1.6 + i * 0.21 + v.seed * 0.31) % 1, xx = x + Math.sin(i * 2.7 + v.seed) * 30, y0 = top + (y - top) * q;
      g.strokeStyle = `rgba(${v.col},${A(0.55 * (1 - q) * k)})`;
      g.beginPath(); g.moveTo(xx, y0 - 34); g.lineTo(xx, y0); g.stroke();
    }
  } else {
    // 细碎光丝不断压落
    g.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const q = (t * 1.1 + i * 0.25 + v.seed * 0.29) % 1, xx = x + Math.sin(i * 2.1 + v.seed) * 24, y0 = y - h - 60 + (h + 50) * q;
      g.strokeStyle = `rgba(${v.col},${A(0.4 * Math.sin(q * Math.PI) * k)})`;
      g.beginPath(); g.moveTo(xx, y0 - 22); g.lineTo(xx, y0); g.stroke();
    }
  }
  g.restore();
}

/** 身形：被压矮、发颤（以脚底为原点变换；在画身体之前调用，画完 restore） */
export function supSquash(g: G, x: number, y: number, v: SupView, t: number) {
  if (v.lv < 2) { const s = 0.97; g.translate(x, y); g.scale(1.01, s); g.translate(-x, -y); return; }
  const slam = v.on < 0.22 ? Math.sin((v.on / 0.22) * Math.PI) : 0;
  const sy = 0.9 - slam * 0.12, sx = 1.05 + slam * 0.08;
  const jx = Math.sin(t * 47 + v.seed) * 1.3, jy = Math.cos(t * 39 + v.seed) * 0.6;
  g.translate(x + jx, y + jy); g.scale(sx, sy); g.translate(-x, -y);
}
