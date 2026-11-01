// 第三十步：召唤物 / 灵宠的 GL 特效
// - 现身：脚下召唤阵 + 光柱 + 墨烟；消散：化作同色烟墨与光点升空；自爆：冲击 + 碎片
// - 常驻：每种召唤物各有气息（狐火、魂雾、血煞、傀儡目光、尸傀眉心烙印）
// - 出手：狐爪 / 狐火弹、傀儡震地、啼魂吞魂、心魔血爪、尸傀重拳
// 约定：亮色用加色，暗色底（墨、血、尘）用覆盖混合，避免在亮地面 + 泛光下洗成白片。
import type { Combat } from '../world/combat';
import type { FxEvent } from './combatgl';
import { FxSys, col, mixc, RGB, fireCell, smokeCell } from './fx';
import { C } from './atlas';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const WHITE: RGB = [1, 1, 1];
const KC: Record<string, RGB> = {
  fox: [0.72, 0.86, 1], puppet: [0.9, 0.74, 0.48], tihun: [0.8, 0.64, 1], demon: [1, 0.26, 0.22], jiao: [0.45, 0.95, 0.7], quhun: [0.55, 1, 0.7], bugs: [1, 0.84, 0.35],
};
/** 身高（世界像素，用于把特效挂在头 / 胸口） */
const KH: Record<string, number> = { fox: 50, puppet: 95, tihun: 80, demon: 70, jiao: 80, quhun: 140, bugs: 30 };
const AIR = 70;   // 心魔浮空高度（与 combatfx 的 AIR_Y 对应）

export const SUMMON_EVENTS = new Set(['roar', 'sumpop', 'foxfire', 'sumhit', 'sumboom', 'sumgone']);

export function summonEvent(F: FxSys, ev: FxEvent) {
  const kind = ev.kind ?? 'fox', c = ev.color ? col(ev.color) : KC[kind] ?? WHITE, x = ev.x, y = ev.y;
  switch (ev.k) {
    case 'sumpop':
      F.flash(x, y - 40, 40, c, 0.18); F.smoke(x, y - 10, 5, [0.2, 0.18, 0.16], 0.25, 20, 50);
      break;
    case 'foxfire': {
      // 狐火弹：0.22 秒飞到目标（与伤害延迟一致）
      const x2 = ev.x2 ?? x, y2 = ev.y2 ?? y, T = 0.22, vx = (x2 - x) / T, vy = (y2 - y) / T;
      F.emit({ x, y, vx, vy, life: T, s0: 26, s1: 22, c, a: 0.7, cell: fireCell(), rot: Math.atan2(vy, vx) + Math.PI / 2 });
      F.emit({ x, y, vx, vy, life: T, s0: 10, s1: 9, c: mixc(c, WHITE, 0.7), a: 0.9, cell: C.Core });
      for (let i = 0; i < 7; i++) { const u = i / 7; F.emit({ x: x + (x2 - x) * u * 0.3, y: y + (y2 - y) * u * 0.3, vx: vx * (0.7 + u * 0.2), vy: vy * (0.7 + u * 0.2) - 20, life: T * (0.9 + u * 0.8), s0: 9, s1: 2, c, a: 0.55, cell: C.Glow }); }
      break;
    }
    case 'sumhit': {
      const sx = ev.x2 ?? x, sy = ev.y2 ?? y, dir = Math.atan2(y - sy, x - sx), big = ev.big ? 1.6 : 1;
      if (kind === 'fox') {
        // 三道狐爪
        for (let i = -1; i <= 1; i++) {
          const a0 = dir + Math.PI / 2 + i * 0.25, cx = x + Math.cos(dir) * 4 + i * 9, cy = y - 34;
          const pts: [number, number][] = []; for (let j = 0; j <= 6; j++) { const u = j / 6 - 0.5; pts.push([cx + Math.cos(a0) * u * 56 + Math.cos(dir) * Math.sin((u + 0.5) * Math.PI) * 10, cy + Math.sin(a0) * u * 40]); }
          F.trail(pts, 5, mixc(c, WHITE, 0.4), 0.75, C.Beam, 1, 1);
        }
        F.sparks(x, y - 34, c, 8, 260, 0.3, 2.5, dir, 1.4);
      } else if (kind === 'puppet') {
        // 傀儡震地：尘土覆盖 + 裂纹 + 一圈冲击
        F.ground(C.Crack, x, y, 70, Math.random() * TAU, [0.18, 0.14, 0.1], 0.32, 0, 0.55);
        F.shockRing(x, y, 110, [0.85, 0.72, 0.5], 0.4, 0.55, 0.6);
        F.smoke(x, y - 6, 7, [0.55, 0.48, 0.38], 0.3, 40, 60);
        for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, v = rnd(120, 320); F.emit({ x, y: y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - rnd(80, 200), life: rnd(0.4, 0.7), s0: rnd(3, 6), s1: 2, c: [0.42, 0.36, 0.28], a: 0.85, add: 0, grav: 700, cell: C.Shard, rot: Math.random() * TAU, vr: rnd(-8, 8) }); }
        F.flash(x, y - 30, 30, mixc(c, WHITE, 0.3), 0.12);
      } else if (kind === 'tihun') {
        // 吞魂：一缕缕魂丝从敌人身上被扯进啼魂兽口中
        const mx = sx + Math.cos(dir) * 30, my = sy - 60;
        for (let i = 0; i < 9; i++) { const ox = x + rnd(-16, 16), oy = y - rnd(20, 60), T = rnd(0.3, 0.45); F.emit({ x: ox, y: oy, vx: (mx - ox) / T, vy: (my - oy) / T - 40, life: T, s0: 22, s1: 6, c: mixc(c, WHITE, 0.4), a: 0.55, cell: C.Wisp, rot: Math.atan2(my - oy, mx - ox) + Math.PI / 2 }); }
        F.ring(x, y - 4, 40, c, 0.35, 0.5);
        F.glow(mx, my, 34, c, 0.35);
      } else if (kind === 'demon') {
        // 心魔血爪：暗血底（覆盖）+ 细亮血线（加色），交叉成 X
        for (const s of [-1, 1]) {
          const a0 = dir + Math.PI / 2 + s * 0.7, L = 70 * big, pts: [number, number][] = [];
          for (let j = 0; j <= 6; j++) { const u = j / 6 - 0.5; pts.push([x + Math.cos(a0) * u * L, y - 40 * big + Math.sin(a0) * u * L * 0.8 + Math.sin((u + 0.5) * Math.PI) * 6]); }
          F.trail(pts, 12 * big, [0.28, 0.02, 0.04], 0.5, C.Beam, 0, 1);
          F.trail(pts, 3.5 * big, [1, 0.3, 0.25], 0.85, C.Beam, 1, 1);
        }
        F.ink(x, y + 4, 50 * big, 0.3, [0.35, 0.03, 0.04]);
        F.sparks(x, y - 40 * big, [1, 0.3, 0.25], 8, 280, 0.35, 2.5);
      } else if (kind === 'quhun') {
        // 尸傀重拳：短促白冲击 + 尘
        F.flash(x, y - 50, 26, [0.9, 1, 0.92], 0.1);
        F.shockRing(x, y - 50, 70, [0.85, 0.95, 0.9], 0.25, 0.9, 0.45);
        F.smoke(x, y - 4, 4, [0.5, 0.45, 0.38], 0.25, 20, 44);
        F.sparks(x, y - 50, [0.9, 1, 0.9], 6, 300, 0.25, 2.5, dir, 1.2);
      } else if (kind === 'foxland') {
        // 狐火命中：一团青白狐火绽开
        for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, v = rnd(60, 200); F.emit({ x, y: y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60, life: rnd(0.35, 0.6), s0: 6, s1: rnd(12, 18), c: KC.fox, a: 0.55, cell: fireCell(), rot: a }); }
        F.flash(x, y - 30, 26, KC.fox, 0.14);
      } else {
        F.sparks(x, y - 30, c, 10, 300, 0.35, 2.5, dir, 1.6); F.flash(x, y - 30, 24, c, 0.12);
      }
      break;
    }
    case 'sumboom': {
      const r = ev.r ?? 150, dk: RGB = kind === 'puppet' ? [0.2, 0.15, 0.1] : [0.3, 0.02, 0.04];
      F.ink(x, y + 6, r * 1.1, 0.45, dk);
      F.smoke(x, y - 20, 14, kind === 'puppet' ? [0.4, 0.34, 0.26] : [0.3, 0.05, 0.06], 0.45, r * 0.4, r * 0.8);
      F.shockRing(x, y, r * 1.2, kind === 'puppet' ? [1, 0.75, 0.4] : [1, 0.25, 0.2], 0.5, 0.55, 0.6);
      F.flash(x, y - 40, r * 0.45, kind === 'puppet' ? [1, 0.8, 0.5] : [1, 0.35, 0.3], 0.22);
      F.shock(x, y, r * 2, 16, 0.5);
      for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, v = rnd(200, 560); F.emit({ x, y: y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55 - rnd(60, 220), life: rnd(0.5, 0.9), s0: rnd(4, 9), s1: 2, c: kind === 'puppet' ? [0.5, 0.42, 0.3] : [0.5, 0.06, 0.08], a: 0.9, add: 0, grav: 650, drag: 0.8, cell: C.Shard, rot: Math.random() * TAU, vr: rnd(-9, 9) }); }
      break;
    }
    case 'sumgone': {
      const hy = y - (KH[kind] ?? 60) * 0.5 - (kind === 'demon' ? AIR : 0);
      F.smoke(x, hy, 6, mixc(c, [0.2, 0.2, 0.2], 0.6), 0.22, 26, 60);
      for (let i = 0; i < 16; i++) F.emit({ x: x + rnd(-24, 24), y: hy + rnd(-30, 30), vx: rnd(-20, 20), vy: rnd(-120, -50), life: rnd(0.6, 1.1), s0: rnd(4, 7), s1: 1, c, a: 0.7, drag: 1, cell: C.Glow });
      F.ring(x, y, 46, c, 0.3, 0.5);
      break;
    }
    case 'roar': {
      // 啼魂长啸：三道紫色声浪 + 鬼影四散
      for (let i = 0; i < 3; i++) F.shockRing(x, y, 260 + i * 140, c, 0.5 + i * 0.12, 0.55, 0.55 - i * 0.12);
      F.shock(x, y, 700, 20, 0.7);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; F.emit({ x: x + Math.cos(a) * 30, y: y - 60 + Math.sin(a) * 16, vx: Math.cos(a) * rnd(260, 420), vy: Math.sin(a) * rnd(130, 210) - 30, life: rnd(0.5, 0.8), s0: 34, s1: 10, c: mixc(c, WHITE, 0.3), a: 0.5, cell: C.Wisp, rot: a + Math.PI / 2 }); }
      F.flash(x, y - 70, 50, c, 0.2);
      break;
    }
  }
}

/** 常驻：现身阵、各自气息、出手余韵、将散时的闪烁提示 */
export function drawSummonsGL(F: FxSys, c: Combat, t: number, dt: number) {
  for (const s of c.summons as any[]) {
    if (s.kind === 'bugs') continue;
    const k = KC[s.kind] ?? WHITE, H = (KH[s.kind] ?? 60) * (s.big ?? 1), lift = s.kind === 'demon' ? AIR : 0;
    const x = s.x, y = s.y, hy = y - lift - H * 0.55, age = s.age ?? 9;
    // —— 现身
    if (!s._sp) {
      s._sp = 1;
      F.flash(x, hy, 50, k, 0.22);
      F.smoke(x, y - 10, 8, [0.16, 0.14, 0.13], 0.3, 26, 70);
      for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, r = rnd(10, 46); F.emit({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.5, vx: 0, vy: rnd(-260, -120), life: rnd(0.4, 0.7), s0: rnd(5, 9), s1: 1, c: mixc(k, WHITE, 0.4), a: 0.8, cell: C.Glow }); }
    }
    if (age < 0.8) {
      const u = age / 0.8, a = 1 - u;
      F.ground(C.Rune, x, y, 70 + 30 * u, t * 2, k, 0.32 * a, 1, 0.5);
      F.ring(x, y, 40 + 70 * u, k, 0.4 * a, 0.5);
      F.sprite(C.Beam, x, y - 90, 180, 46 * a, Math.PI / 2, k, 0.22 * a);
    }
    // —— 将散：脚下光圈闪烁
    if (s.t < 2.5) F.ring(x, y, 34, k, (0.15 + 0.15 * Math.sin(t * 14)) * Math.min(1, s.t), 0.5);
    // —— 常驻气息
    F.glow(x, hy, 40 * (s.big ?? 1), k, 0.07);
    switch (s.kind) {
      case 'fox': {
        for (let i = 0; i < 2; i++) { const a = t * 2.4 + i * Math.PI + s.slot; F.glow(x + Math.cos(a) * 34, hy - 6 + Math.sin(a) * 12, 7, k, 0.55, C.Star); F.glow(x + Math.cos(a) * 34, hy - 6 + Math.sin(a) * 12, 16, k, 0.16); }
        if (Math.random() < dt * 5) F.emit({ x: x + rnd(-20, 20), y: hy + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-60, -30), life: 0.6, s0: 9, s1: 2, c: k, a: 0.45, cell: fireCell() });
        break;
      }
      case 'tihun': {
        if (Math.random() < dt * 6) F.emit({ x: x + rnd(-30, 30), y: y - rnd(10, 60), vx: rnd(-15, 15), vy: rnd(-50, -20), life: rnd(0.8, 1.3), s0: 20, s1: 36, c: [0.5, 0.4, 0.62], a: 0.14, add: 0, cell: smokeCell(), rot: Math.random() * TAU, vr: rnd(-1, 1), drag: 1 });
        if (Math.random() < dt * 3) F.emit({ x: x + rnd(-24, 24), y: hy, vx: rnd(-10, 10), vy: rnd(-70, -40), life: 0.8, s0: 24, s1: 8, c: mixc(k, WHITE, 0.3), a: 0.35, cell: C.Wisp, rot: 0 });
        // 吞魂时口边的魂光
        if ((s.atk ?? 0) > 0) F.glow(x + s.facing * 28, hy - 6, 30, k, 0.4 * s.atk);
        break;
      }
      case 'demon': {
        const B = s.big ?? 1;
        if (Math.random() < dt * 8 * B) F.emit({ x: x + rnd(-20, 20) * B, y: hy + rnd(-10, 20) * B, vx: -s.facing * rnd(20, 60), vy: rnd(-40, -10), life: rnd(0.6, 1), s0: 18 * B, s1: 34 * B, c: [0.32, 0.03, 0.05], a: 0.2, add: 0, cell: smokeCell(), rot: Math.random() * TAU, vr: rnd(-1, 1), drag: 1 });
        F.glow(x, hy, 28 * B, [1, 0.22, 0.18], 0.12);
        F.glow(x + s.facing * 10 * B, hy - 14 * B, 4 * B, [1, 0.85, 0.3], 0.8, C.Star);
        if (B > 1.2) F.ground(C.Swirl, x, y, 90, -t * 2, [0.9, 0.15, 0.12], 0.16, 1, 0.5);
        break;
      }
      case 'puppet': {
        F.glow(x + s.facing * 22, y - 70, 5, [0.5, 1, 0.8], 0.7, C.Star);
        if ((s.atk ?? 0) > 0.6 && Math.random() < 0.5) F.sparks(x + s.facing * 20, y - 50, [1, 0.8, 0.5], 1, 180, 0.25, 2);
        break;
      }
      case 'quhun': {
        F.glow(x, y - 150, 6, [0.55, 1, 0.7], 0.6, C.Star);
        if (Math.random() < dt * 2) F.emit({ x: x + rnd(-14, 14), y: y - rnd(20, 120), vx: 0, vy: -30, life: 0.9, s0: 4, s1: 1, c: [0.5, 1, 0.7], a: 0.4, cell: C.Glow });
        break;
      }
      case 'jiao': {
        if (Math.random() < dt * 5) F.emit({ x: x + rnd(-30, 30), y: hy + rnd(-10, 10), vx: rnd(-20, 20), vy: rnd(-40, 10), life: 0.6, s0: 5, s1: 1, c: k, a: 0.5, grav: 160, cell: C.Water });
        break;
      }
    }
    // 出手前冲的残影光
    if ((s.atk ?? 0) > 0.5 && s.ax !== undefined) { const a = (s.atk - 0.5) * 2; F.glow((x + s.ax) / 2, hy, 30 * (s.big ?? 1), k, 0.14 * a); }
  }
}
