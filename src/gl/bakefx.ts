// 第三十五步：以烘焙程序贴图叠加的特效层——大招预设、异状表现、墨溅击杀、雷环、法阵、裂地……
// 所有图样都是白色遮罩，按元素上色；add=0 时为普通覆盖（墨色），add=1 为发光。
import { K } from './fxbake';
import { FxSys, RGB, mixc, col } from './fx';
import { EL_COL } from '../world/foeskills';
const EL_COL_FN = (el: string) => (EL_COL as any)[el] ?? '255,236,200';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const WHITE: RGB = [1, 1, 1];
const INK: RGB = [0.07, 0.06, 0.06];
const FIRE: RGB = [1, 0.55, 0.18];
const SQ = 0.55;
const INKS = [K.Ink0, K.Ink1, K.Ink2];
const pk = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

// ---------------------------------------------------------------- 贴花（带寿命的烘焙图样）
interface Decal { k: number; x: number; y: number; r0: number; r1: number; t: number; life: number; c: RGB; a: number; add: number; sq: number; rot: number; vr: number; h: number; ease: number; fin: number }
const D: Decal[] = [];
/** r0→r1 半径随寿命变化；sq<1 为地面贴花；h 为纵横比（1 为正方） */
export function decal(k: number, x: number, y: number, r0: number, r1: number, life: number, c: RGB, a: number, o: { add?: number; sq?: number; rot?: number; vr?: number; h?: number; ease?: number; fin?: number } = {}) {
  if (!Number.isFinite(x + y + r0 + r1 + life) || life <= 0) return;
  if (D.length >= 180) D.shift();
  D.push({ k, x, y, r0, r1, t: 0, life, c, a, add: o.add ?? 1, sq: o.sq ?? 1, rot: o.rot ?? 0, vr: o.vr ?? 0, h: o.h ?? 1, ease: o.ease ?? 2.2, fin: o.fin ?? 0.06 });
}
export function drawDecals(F: FxSys, dt: number) {
  for (let i = D.length - 1; i >= 0; i--) {
    const d = D[i]; d.t += dt;
    if (d.t >= d.life) { D.splice(i, 1); continue; }
    const u = d.t / d.life, e = 1 - Math.pow(1 - u, d.ease), r = d.r0 + (d.r1 - d.r0) * e;
    const fade = (u < d.fin ? u / d.fin : 1) * (1 - Math.pow(u, 1.6));
    d.rot += d.vr * dt;
    F.bk(d.k, d.x, d.y, r * 2, r * 2 * d.h, d.rot, d.c, d.a * fade, d.add, d.sq);
  }
}
export function clearDecals() { D.length = 0; }

/** 墨溅：水墨气息的落点/击杀印记（普通覆盖） */
export function inkSplat(x: number, y: number, r: number, a = 0.55, c: RGB = INK, life = 1.6) {
  decal(pk(INKS), x, y, r * 0.55, r, life, c, a, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 6, fin: 0.03 });
}
/** 沿线段铺电弧条（雷系光柱 / 锁链 / 天雷） */
export function elecLine(F: FxSys, x1: number, y1: number, x2: number, y2: number, w: number, c: RGB, a: number, t: number, seed = 0) {
  const L = Math.hypot(x2 - x1, y2 - y1); if (L < 4 || a <= 0.01) return;
  const ang = Math.atan2(y2 - y1, x2 - x1), seg = Math.max(1, Math.round(L / (w * 3.2)));
  const fr = (Math.floor(t * 24) + seed) % 4;
  for (let i = 0; i < seg; i++) {
    const u = (i + 0.5) / seg, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u, k = (fr + i) % 4;
    F.bk(K.Elec0 + k, x, y, (L / seg) * 1.35, w * 1.6, ang, c, a);
    F.bk(K.Elec0 + ((k + 2) % 4), x, y, (L / seg) * 1.35, w * 0.8, ang, mixc(c, WHITE, 0.7), a * 0.8);
  }
}

// ---------------------------------------------------------------- 法术出手瞬间
export function bakeSpawn(v: any) {
  const cc = col(v.color), fx = v.fx as string, r = v.r ?? 80, x = v.x, y = v.y;
  switch (v.kind) {
    case 'ring': {
      if (fx === 'lightning' || fx === 'goldthunder') {
        decal(K.ElecRing0, x, y, r * 0.5, r * 1.15, 0.5, mixc(cc, WHITE, 0.3), 1, { sq: SQ, rot: Math.random() * TAU, vr: 3 });
        decal(K.ElecRing1, x, y, r * 0.3, r * 0.9, 0.45, cc, 0.9, { sq: SQ, vr: -4 });
        decal(K.Wave12, x, y, r * 0.4, r * 1.3, 0.6, cc, 0.7, { sq: SQ });
        decal(K.Rays, x, y - 60, r * 0.3, r * 0.9, 0.3, mixc(cc, WHITE, 0.5), 0.8, { rot: Math.random() * TAU });
      } else if (fx === 'gold' || fx === 'palm') {
        decal(K.Lotus, x, y, r * 0.4, r * 1.05, 0.9, cc, 0.85, { sq: SQ, vr: 0.8 });
        decal(K.Rays, x, y - 70, r * 0.4, r * 1.2, 0.4, mixc(cc, WHITE, 0.4), 0.75, { rot: Math.random() * TAU });
      } else if (fx === 'mind') {
        decal(K.Flower12, x, y - 60, r * 0.3, r * 1.0, 0.55, cc, 0.8, { vr: 1.5 });
        decal(K.Flower6, x, y, r * 0.4, r * 1.1, 0.7, cc, 0.6, { sq: SQ, vr: -1 });
      } else if (fx === 'roar') {
        decal(K.Wave5, x, y, r * 0.2, r * 1.2, 0.55, cc, 0.8, { sq: SQ });
        decal(K.Wave8, x, y, r * 0.1, r * 0.9, 0.7, cc, 0.6, { sq: SQ, rot: 0.5 });
      } else if (fx === 'frost' || fx === 'icicle') {
        decal(K.Hex, x, y, r * 0.5, r * 1.0, 0.9, [0.75, 0.92, 1], 0.45, { sq: SQ });
        decal(K.Wave8, x, y, r * 0.3, r * 1.2, 0.5, cc, 0.7, { sq: SQ });
      } else if (fx === 'flame' || fx === 'fireball') {
        decal(K.Swirl, x, y, r * 0.4, r * 1.0, 0.7, mixc(FIRE, cc, 0.3), 0.8, { sq: SQ, vr: 5 });
        inkSplat(x, y, r * 0.9, 0.35, [0.18, 0.08, 0.03]);
      } else if (fx === 'rock') {
        decal(K.Crack, x, y, r * 0.6, r * 0.95, 1.4, INK, 0.6, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 8 });
        inkSplat(x, y, r * 0.8, 0.3, [0.2, 0.15, 0.1]);
      } else if (fx === 'array' || fx === 'star' || fx === 'talisman') {
        decal(K.Seal, x, y, r * 0.6, r * 1.0, 0.8, cc, 0.85, { sq: SQ, vr: 1.2 });
        decal(K.Gear24, x, y, r * 0.3, r * 0.6, 0.8, mixc(cc, WHITE, 0.3), 0.6, { sq: SQ, vr: -2 });
      } else if (r > 110) decal(K.Wave8, x, y, r * 0.3, r * 1.1, 0.55, cc, 0.6, { sq: SQ });
      break;
    }
    case 'strike': {
      if (fx === 'lightning' || fx === 'goldthunder') {
        decal(K.Crack, x, y, r * 0.6, r * 1.0, 1.6, INK, 0.55, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
        decal(K.ElecRing0 + ((Math.random() * 2) | 0), x, y, r * 0.3, r * 1.1, 0.4, mixc(cc, WHITE, 0.3), 1, { sq: SQ, vr: 6 });
        decal(K.Solar, x, y - 40, r * 0.8, r * 1.6, 0.25, mixc(cc, WHITE, 0.5), 0.9);
      } else if (fx === 'flame') {
        inkSplat(x, y, r * 1.1, 0.4, [0.16, 0.07, 0.03], 2.2);
        decal(K.Swirl, x, y, r * 0.5, r * 1.1, 0.6, FIRE, 0.75, { sq: SQ, vr: 6 });
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + Math.random(), rr = r * 0.45; decal(K.Flame, x + Math.cos(a) * rr, y + Math.sin(a) * rr * SQ - r * 0.5, r * 0.45, r * 0.6, rnd(0.45, 0.7), mixc(FIRE, cc, 0.25), 0.8, { h: 1.6, ease: 1.5 }); }
      } else if (fx === 'rock') {
        decal(K.Crack, x, y, r * 0.7, r * 1.05, 1.8, INK, 0.6, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
      } else if (fx === 'frost') {
        decal(K.Hex, x, y, r * 0.4, r * 0.9, 1.0, [0.75, 0.92, 1], 0.5, { sq: SQ });
        decal(K.Spark0, x, y - 30, r * 0.6, r * 1.3, 0.3, [0.85, 0.95, 1], 0.9);
      } else if (fx === 'gold') {   // 擒仙手 / 金光：五指掌印 + 莲台 + 万道金芒
        decal(K.Flower5, x, y, r * 1.4, r * 0.9, 0.6, cc, 0.9, { sq: SQ, rot: -Math.PI / 2, ease: 4 });
        decal(K.Lotus, x, y, r * 0.5, r * 1.2, 1.0, mixc(cc, WHITE, 0.2), 0.7, { sq: SQ, vr: 0.6 });
        decal(K.Rays, x, y - 80, r * 0.5, r * 1.5, 0.45, mixc(cc, WHITE, 0.4), 0.8, { rot: Math.random() * TAU });
        decal(K.Crack, x, y, r * 0.6, r * 0.9, 1.4, INK, 0.45, { add: 0, sq: SQ, ease: 9 });
      }
      break;
    }
    case 'beam': {
      decal(K.Solar, x, y, 40, 90, 0.25, mixc(cc, WHITE, 0.5), 0.8);
      decal(K.Spark0 + ((Math.random() * 2) | 0), v.x2, v.y2, 50, 130, 0.3, mixc(cc, WHITE, 0.4), 0.9, { rot: Math.random() * TAU });
      if (fx === 'icefire') decal(K.Hex, v.x2, v.y2 + 20, 60, 140, 0.9, [0.75, 0.92, 1], 0.45, { sq: SQ });
      if (fx === 'blood') inkSplat(v.x2, v.y2 + 20, 110, 0.45, [0.45, 0.03, 0.05]);
      break;
    }
    case 'bigsword': {   // 巨剑：落点一笔浓墨剑痕 + 金芒新月，裂地
      const ang = Math.atan2(v.y2 - v.y, v.x2 - v.x), R = Math.min(260, 120 + (v.r ?? 60) * 1.4);
      decal(K.Brush0, v.x2, v.y2, R * 0.85, R, 1.2, INK, 0.5, { add: 0, rot: ang, h: 0.6, ease: 7 });
      decal(K.Brush1, v.x2, v.y2 - 20, R * 0.8, R * 0.95, 0.4, mixc(cc, WHITE, 0.5), 0.85, { rot: ang, h: 0.6, ease: 7 });
      decal(K.Crack, v.x2, v.y2, R * 0.6, R * 0.95, 1.6, INK, 0.55, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
      break;
    }
    case 'cone': {
      const ang = v.ang ?? 0, rr = r * 0.6, cx = x + Math.cos(ang) * rr, cy = y + Math.sin(ang) * rr;
      if (fx === 'sword') decal(K.Brush1, cx, cy, r * 0.5, r * 0.62, 0.35, mixc(cc, WHITE, 0.5), 0.9, { rot: ang + Math.PI / 2, h: 0.7, ease: 6 });
      if (fx === 'flame') for (let i = 0; i < 4; i++) { const a = ang + (i - 1.5) * (v.spread ?? 0.5) * 0.5, d = r * rnd(0.35, 0.8); decal(K.Flame, x + Math.cos(a) * d, y + Math.sin(a) * d - 30, 40, r * 0.4, rnd(0.35, 0.55), mixc(FIRE, cc, 0.35), 0.75, { h: 1.6, ease: 1.4 }); }
      break;
    }
    case 'aura': {
      decal(K.Bagua, x, y, r * 0.5, r * 1.0, 1.0, cc, 0.7, { sq: 0.45, vr: 1.5 });
      decal(K.Flower8, x, y, r * 0.3, r * 0.8, 0.8, mixc(cc, WHITE, 0.3), 0.5, { sq: 0.45, vr: -1 });
      break;
    }
  }
}

// ---------------------------------------------------------------- 法术持续阶段（每帧）
export function bakeVfx(F: FxSys, v: any, t: number) {
  const u = Math.min(1, Math.max(0, v.t / v.dur)), a = 1 - u, cc = col(v.color), fx = v.fx as string;
  if (v.kind === 'strike' && (fx === 'lightning' || fx === 'goldthunder')) {
    const fl = u < 0.3 ? 1 : (Math.floor(v.t * 30) % 2 ? 0.4 : 0.9) * a;
    elecLine(F, v.x + 40, v.y - 720, v.x, v.y, 30, mixc(cc, WHITE, 0.25), fl * 0.75, t, v.seed | 0);
  } else if (v.kind === 'chain') {
    elecLine(F, v.x, v.y, v.x2, v.y2, 30, cc, a * 0.6, t, v.seed | 0);
  } else if (v.kind === 'beam' && (fx === 'lightning' || fx === 'goldthunder' || fx === 'magnet' || fx === 'icefire')) {
    const w = (v.r ?? 30) * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.7);
    elecLine(F, v.x, v.y, v.x2, v.y2, Math.max(40, w * 3), fx === 'icefire' ? [0.75, 0.92, 1] : cc, a * (fx === 'icefire' ? 0.5 : 0.85), t, v.seed | 0);
  } else if (v.kind === 'ring' && (fx === 'array' || fx === 'star') && u < 1) {
    F.bkG(K.Seal, v.x, v.y, (v.r ?? 100) * 0.95, t * 0.8, cc, 0.5 * a, 1, SQ);
  }
}

// ---------------------------------------------------------------- 领域（每帧）
export function bakeField(F: FxSys, f: any, t: number, k: number) {
  const cc = col(f.color), r = f.r;
  switch (f.fx) {
    case 'flame': {
      F.bkG(K.Swirl, f.x, f.y, r * 0.95, t * 1.6, mixc([1, 0.42, 0.1], cc, 0.25), 0.2 * k, 1, SQ);
      F.bkG(K.Swirl, f.x, f.y, r * 0.7, -t * 2.3 + 1, [1, 0.6, 0.25], 0.1 * k, 1, SQ);
      for (let i = 0; i < 7; i++) {
        const an = i / 7 * TAU + t * 0.4, rr = r * (0.35 + 0.45 * ((i * 0.37) % 1)), h = r * (0.35 + 0.18 * Math.sin(t * 6 + i * 2.1));
        F.bk(K.Flame, f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * SQ - h * 0.45, h * 0.6, h, 0, mixc([1, 0.45, 0.12], cc, 0.3), 0.4 * k);
      }
      break;
    }
    case 'lightning': {
      F.bkG(K.ElecRing0 + (Math.floor(t * 12) % 2), f.x, f.y, r * 1.02, t * 1.5, mixc(cc, WHITE, 0.2), 0.7 * k, 1, SQ);
      F.bkG(K.Seal, f.x, f.y, r * 0.8, -t * 0.6, cc, 0.45 * k, 1, SQ);
      break;
    }
    case 'rock': F.bkG(K.Crack, f.x, f.y, r * 1.05, 0.8, INK, 0.4 * k, 0, SQ); break;
    case 'sword': case 'star': {   // 大庚剑阵 / 星阵：巨大法阵 + 反向齿轮 + 外圈八卦
      F.bkG(K.Seal, f.x, f.y, r * 1.05, t * 0.35, cc, 0.65 * k, 1, SQ);
      F.bkG(K.Gear24, f.x, f.y, r * 0.62, -t * 0.7, mixc(cc, WHITE, 0.3), 0.5 * k, 1, SQ);
      F.bkG(K.Bagua, f.x, f.y, r * 1.25, -t * 0.2, cc, 0.35 * k, 1, SQ);
      break;
    }
    case 'array': {
      F.bkG(K.Lotus, f.x, f.y, r * 0.7, t * 0.4, mixc(cc, WHITE, 0.2), 0.5 * k, 1, SQ);
      F.bkG(K.Gear12, f.x, f.y, r * 1.0, -t * 0.25, cc, 0.4 * k, 1, SQ);
      break;
    }
    default: if (f.heal) F.bkG(K.Flower8, f.x, f.y, r * 0.9, t * 0.5, [0.6, 1, 0.6], 0.35 * k, 1, SQ);
  }
}

// ---------------------------------------------------------------- 事件
export function bakeEvent(ev: any) {
  const cc = col(ev.color ?? '255,236,200');
  switch (ev.k) {
    case 'kill': inkSplat(ev.x, ev.y + 30, 130, 0.5); decal(K.Spark0 + ((Math.random() * 2) | 0), ev.x, ev.y, 40, 110, 0.25, mixc(cc, WHITE, 0.4), 0.8, { rot: Math.random() * TAU }); break;
    case 'impact': { const p = ev.power ?? 1; decal(K.Rays, ev.x, ev.y - 20, 40 * p, 150 * p, 0.3, mixc(cc, WHITE, 0.4), 0.7, { rot: Math.random() * TAU }); decal(K.Wave8, ev.x, ev.y, 30 * p, 170 * p, 0.45, cc, 0.55, { sq: SQ }); if (p > 1.2) inkSplat(ev.x, ev.y + 10, 90 * p, 0.3); break; }
    case 'shatter': { const r = ev.r ?? 60; decal(K.Hex, ev.x, ev.y, r * 1.0, r * 2.4, 0.45, mixc(cc, WHITE, 0.3), 0.8, { ease: 3 }); decal(K.Wave12, ev.x, ev.y + r * 0.5, r, r * 3.2, 0.5, cc, 0.6, { sq: SQ }); break; }
    case 'ward': { const r = ev.r ?? 60; decal(K.Hex, ev.x, ev.y, r * 2.2, r * 1.1, 0.45, cc, 0.6, { ease: 3 }); break; }
    case 'dunflash': if (ev.kind === 'thunder') { decal(K.ElecRing0, ev.x, ev.y, 40, 170, 0.35, cc, 0.9, { sq: SQ, vr: 6 }); decal(K.ElecRing1, ev.x2 ?? ev.x, ev.y2 ?? ev.y, 200, 60, 0.35, cc, 0.9, { sq: SQ, vr: -6 }); } break;
    case 'cast': { const k = ev.power ?? 1; decal(k >= 0.8 ? K.Seal : K.Flower8, ev.x, ev.y + 40 * k, 30 * k, 110 * k, 0.5, cc, 0.4, { sq: SQ, vr: 2 }); break; }
    case 'block': decal(K.Hex, ev.x, ev.y, 30, 70, 0.25, mixc(cc, WHITE, 0.3), 0.7); break;
  }
}

// ---------------------------------------------------------------- 异状：冰封 / 灼烧 / 麻痹 / 中毒 / 定身 / 眩晕 / 迟缓 / 破甲
export function bakeStatus(F: FxSys, x: number, y: number, H: number, st: Record<string, any>, t: number, vis: number, s = 1, seed = 0) {
  if (vis <= 0.03) return;
  const cy = y - H * 0.5;
  if (st.freeze) {   // 冰壳：六角晶格罩住全身，脚下霜环
    F.bk(K.Hex, x, cy, 92 * s, H * 1.25, 0, [0.72, 0.9, 1], 0.34 * vis);
    F.bk(K.Hex, x, cy, 92 * s, H * 1.25, 0, [0.85, 0.95, 1], 0.06 * vis, 0);
    F.bkG(K.RingThin, x, y, 60 * s, 0, [0.8, 0.95, 1], 0.5 * vis, 1, SQ);
  }
  if (st.burn) {
    for (let i = 0; i < 3; i++) { const ph = t * 5 + i * 2.1 + seed, h = H * (0.55 + 0.2 * Math.sin(ph)); F.bk(K.Flame, x + (i - 1) * 22 * s, y - h * 0.45 - 4, h * 0.55, h, Math.sin(ph * 0.7) * 0.15, FIRE, 0.5 * vis); }
  }
  if (st.shock) {
    const fr = Math.floor(t * 20 + seed) % 4;
    F.bk(K.Elec0 + fr, x, cy, 120 * s, 46 * s, t * 9 + seed, [0.75, 0.82, 1], 0.75 * vis);
    F.bk(K.Elec0 + ((fr + 2) % 4), x, cy - 10, 110 * s, 40 * s, -t * 7 + seed + 1.3, [0.9, 0.92, 1], 0.6 * vis);
  }
  if (st.poison) F.bkG(K.Swirl, x, y, 58 * s, t * 1.2 + seed, [0.45, 0.85, 0.2], 0.4 * vis, 1, SQ);
  if (st.root) { F.bkG(K.Seal, x, y, 62 * s, t * 0.6, [0.55, 0.9, 0.45], 0.6 * vis, 1, SQ); F.bkG(K.Gear12, x, y, 40 * s, -t, [0.8, 0.95, 0.6], 0.4 * vis, 1, SQ); }
  if (st.stun) {   // 头顶金星：小花纹绕头旋转
    for (let i = 0; i < 3; i++) { const a = t * 4 + i / 3 * TAU; F.bk(K.Flower5, x + Math.cos(a) * 26 * s, y - H - 14 + Math.sin(a) * 8 * s, 22 * s, 22 * s, t * 3, [1, 0.9, 0.45], 0.9 * vis); }
  }
  if (st.slow) F.bkG(K.Wave8, x, y, 54 * s, t * 0.8, [0.6, 0.75, 1], 0.4 * vis, 1, SQ);
  if (st.break) F.bkG(K.Crack, x, y, 50 * s, seed, INK, 0.3 * vis, 0, SQ);
}

// ---------------------------------------------------------------- 敌方大招预警：地上浮出朱砂法阵
export function bakeWarnBig(F: FxSys, x: number, y: number, r: number, t: number, wc: RGB, ic: RGB, end: number) {
  F.bkG(K.Seal, x, y, r * 1.0, t * 0.6, ic, 0.45, 0, SQ);
  F.bkG(K.Seal, x, y, r * 1.0, t * 0.6, wc, 0.25 + 0.4 * end, 1, SQ);
  F.bkG(K.Gear24, x, y, r * 0.6, -t * 1.3, mixc(wc, WHITE, 0.3), 0.2 + 0.4 * end, 1, SQ);
}

// ---------------------------------------------------------------- 敌方招式落下：按元素留下印记（大招更大更狠）
export function bakeFoeFire(h: any) {
  const cc = col(EL_COL_FN(h.el)), big = !!h.big;
  if (h.k === 'circle') {
    const x = h.x, y = h.y, r = h.r;
    switch (h.el) {
      case 'thunder': case 'gold':
        decal(K.ElecRing0, x, y, r * 0.4, r * 1.1, 0.45, mixc(cc, WHITE, 0.3), 1, { sq: SQ, vr: 5 });
        decal(K.Crack, x, y, r * 0.6, r * 0.95, 1.6, INK, 0.5, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
        if (big) decal(K.Solar, x, y - 60, r * 0.6, r * 1.4, 0.3, mixc(cc, WHITE, 0.5), 0.9);
        break;
      case 'fire': case 'blood':
        decal(K.Swirl, x, y, r * 0.4, r * 1.05, 0.6, cc, 0.75, { sq: SQ, vr: 5 });
        inkSplat(x, y, r * 1.0, 0.35, h.el === 'fire' ? [0.18, 0.07, 0.03] : [0.35, 0.02, 0.04], 2);
        break;
      case 'ice': case 'water':
        decal(K.Hex, x, y, r * 0.5, r * 1.0, 0.9, [0.75, 0.92, 1], 0.4, { sq: SQ });
        decal(K.Wave8, x, y, r * 0.3, r * 1.2, 0.5, cc, 0.6, { sq: SQ });
        break;
      case 'poison': decal(K.Swirl, x, y, r * 0.5, r * 1.0, 1.0, cc, 0.5, { sq: SQ, vr: 2 }); break;
      case 'earth': case 'phys': case 'metal':
        decal(K.Crack, x, y, r * 0.7, r * 1.05, 1.8, INK, 0.55, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
        break;
      case 'ghost': decal(K.Flower12, x, y, r * 0.3, r * 1.0, 0.7, cc, 0.6, { sq: SQ, vr: -2 }); inkSplat(x, y, r * 0.9, 0.35); break;
      default: decal(K.Wave8, x, y, r * 0.3, r * 1.15, 0.5, cc, 0.6, { sq: SQ });
    }
    if (big) { decal(K.Wave12, x, y, r * 0.5, r * 1.6, 0.7, cc, 0.5, { sq: SQ }); decal(K.Rays, x, y - 80, r * 0.3, r * 1.2, 0.35, mixc(cc, WHITE, 0.4), 0.7, { rot: Math.random() * TAU }); }
  } else if (h.k === 'cone') {
    const A = Math.atan2(Math.sin(h.ang) / 0.7, Math.cos(h.ang)), d = h.r * 0.55;
    const x = h.x + Math.cos(A) * d, y = h.y + Math.sin(A) * d * 0.7;
    if (h.el === 'fire' || h.el === 'blood') for (let i = 0; i < 4; i++) { const a = A + (i - 1.5) * h.spread * 0.45, dd = h.r * rnd(0.35, 0.85); decal(K.Flame, h.x + Math.cos(a) * dd, h.y + Math.sin(a) * dd * 0.7 - 30, 40, h.r * 0.35, rnd(0.35, 0.55), cc, 0.7, { h: 1.6, ease: 1.4 }); }
    else if (h.el === 'thunder') decal(K.Elec0 + ((Math.random() * 4) | 0), x, y, h.r * 0.5, h.r * 0.55, 0.3, mixc(cc, WHITE, 0.3), 0.9, { rot: A, h: 0.3 });
    else decal(K.Brush1, x, y, h.r * 0.45, h.r * 0.55, 0.35, mixc(cc, WHITE, 0.4), 0.7, { rot: A + Math.PI / 2, h: 0.7, ease: 6 });
  } else if (h.dmg > 0) {   // 冲锋 / 直线
    const x2 = h.x + Math.cos(h.ang) * h.len, y2 = h.y + Math.sin(h.ang) * h.len;
    decal(K.Crack, x2, y2, h.w * 0.6, h.w * 1.0, 1.4, INK, 0.45, { add: 0, sq: SQ, rot: Math.random() * TAU, ease: 9 });
  }
}
