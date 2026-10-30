// 第三十五步：精英词缀的灵光（WebGL）
// 脚下：两层反向旋转的法纹（主词缀色）+ 外圈细环；身周：随词缀不同的粒子——
// 狂暴赤焰、灵盾（护体罩另有绘制）、吸血血丝、召唤紫雾、反伤银芒、隐匿淡影、焚身火舌、爆裂金星、疾风气流、坚甲土屑、雷殛电弧。
import type { Combat, Enemy } from '../world/combat';
import { AFFIX } from '../world/affix';
import { FxSys, col, mixc, RGB, fireCell, extOK } from './fx';
import { C } from './atlas';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const WHITE: RGB = [1, 1, 1];

export function drawEliteGL(F: FxSys, c: Combat, e: Enemy, vis: number, t: number, dt: number) {
  const A = e.affix; if (!A || vis <= 0.02) return;
  const main = col(AFFIX[A.ids[0]].col), sz = Math.max(0.8, Math.min(2.2, e.def.look?.size ?? 1));
  const R = (e.def.kind === 'human' ? 64 : 58) * sz, pul = 0.8 + 0.2 * Math.sin(t * 4 + e.id * 9);
  const a0 = (A.yinOn ? 0.25 : 1) * vis;
  // 脚下法纹
  F.ground(C.Disc, e.x, e.y, R * 1.05, 0, mixc(main, [0, 0, 0], 0.5), 0.12 * a0, 0, 0.42);
  F.ground(C.Rune, e.x, e.y, R, t * 0.9, main, 0.38 * pul * a0, 1, 0.42);
  if (A.ids.length > 1) F.ground(C.Rune, e.x, e.y, R * 0.72, -t * 1.3, col(AFFIX[A.ids[1]].col), 0.3 * pul * a0, 1, 0.42);
  F.ground(C.Ring, e.x, e.y, R * 1.12, 0, mixc(main, WHITE, 0.3), 0.32 * a0, 1, 0.42);
  if (extOK() && A.ids.length > 2) F.ground(C.KDots, e.x, e.y, R * 1.3, t * 0.5, main, 0.3 * a0, 1, 0.42);
  // 身周粒子
  const top = e.y - (e.def.kind === 'human' ? 70 : e.anim.flying ? 80 : 40) * sz - e.flyH - e.lift;
  for (const id of A.ids) {
    const cc = col(AFFIX[id].col);
    switch (id) {
      case 'kuang': {
        const on = A.kuangOn ? 1 : 0.3;
        if (Math.random() < dt * 24 * on) F.emit({ x: e.x + rnd(-22, 22) * sz, y: top + rnd(-20, 40), vx: rnd(-10, 10), vy: rnd(-140, -70), life: rnd(0.3, 0.6), s0: rnd(14, 26) * sz, s1: 4, c: [1, 0.25, 0.1], a: 0.8 * a0, cell: fireCell() });
        if (A.kuangOn) F.glow(e.x, top, 70 * sz, [1, 0.15, 0.08], 0.22 * pul * a0);
        break;
      }
      case 'xi':
        if (Math.random() < dt * 8) { const a = Math.random() * TAU; F.emit({ x: e.x + Math.cos(a) * 60 * sz, y: top + Math.sin(a) * 40, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 60, life: 0.6, s0: 6, s1: 2, c: cc, a: 0.7 * a0, stretch: 3, cell: C.Glow }); }
        break;
      case 'zhao':
        if (Math.random() < dt * 6) F.emit({ x: e.x + rnd(-40, 40) * sz, y: e.y + rnd(-6, 6), vy: rnd(-40, -20), life: rnd(0.8, 1.2), s0: 24 * sz, s1: 46 * sz, c: cc, a: 0.25 * a0, cell: C.Wisp, rot: rnd(-0.5, 0.5) });
        break;
      case 'fan':
        if (Math.random() < dt * 5) F.emit({ x: e.x + rnd(-30, 30) * sz, y: top + rnd(-30, 30), life: 0.35, s0: 18, s1: 4, c: WHITE, a: 0.6 * a0, cell: extOK() ? C.KGlint : C.Star, rot: rnd(0, TAU) });
        break;
      case 'yin':
        if (A.yinOn && Math.random() < dt * 10) F.emit({ x: e.x + rnd(-30, 30), y: top + rnd(-30, 40), vy: rnd(-20, 0), life: 0.7, s0: 30, s1: 60, c: [0.6, 0.6, 0.7], a: 0.12, add: 0, cell: C.Smoke });
        break;
      case 'fen2':
        if (Math.random() < dt * 20) { const a = Math.random() * TAU; F.emit({ x: e.x + Math.cos(a) * 130, y: e.y + Math.sin(a) * 60, vy: rnd(-90, -50), life: rnd(0.3, 0.5), s0: rnd(14, 22), s1: 3, c: [1, 0.5, 0.15], a: 0.7 * a0, cell: fireCell() }); }
        F.ground(C.Ring, e.x, e.y, 150, 0, [1, 0.45, 0.12], 0.25 * pul * a0, 1, 0.42);
        break;
      case 'bao':
        if (Math.random() < dt * 6) F.emit({ x: e.x + rnd(-24, 24) * sz, y: top + rnd(-20, 20), vy: rnd(-30, -10), life: 0.4, s0: 8, s1: 2, c: cc, a: 0.9 * a0, cell: C.Star, rot: rnd(0, TAU) });
        if (e.hp < e.maxHp * 0.3) F.glow(e.x, top, 50 * sz * (0.8 + 0.4 * Math.sin(t * 18)), cc, 0.3 * a0);
        break;
      case 'ji':
        if (e.anim.move > 0.2 && Math.random() < dt * 18) F.emit({ x: e.x + rnd(-20, 20), y: top + rnd(-10, 40), vx: -e.facing * rnd(120, 220), vy: rnd(-10, 10), life: 0.3, s0: 4, s1: 1, c: cc, a: 0.6 * a0, stretch: 6, cell: C.Glow });
        break;
      case 'jian':
        F.ground(C.Bagua, e.x, e.y, R * 0.5, t * 0.4, cc, 0.22 * a0, 1, 0.42);
        break;
      case 'lei':
        if (Math.random() < dt * 3) { const a = Math.random() * TAU; F.bolt(e.x + Math.cos(a) * 40 * sz, top + Math.sin(a) * 30, e.x, top, Math.random() * 1e6, 10, 1.4, cc, 0.85 * a0, 5, false); }
        break;
      case 'dun': case 'fen':
        if (id === 'fen' && Math.random() < dt * 4) F.emit({ x: e.x + rnd(-24, 24), y: top + rnd(-20, 20), vy: -20, life: 0.6, s0: 6, s1: 14, c: cc, a: 0.4 * a0, cell: C.Ring });
        break;
    }
  }
  void c;
}
