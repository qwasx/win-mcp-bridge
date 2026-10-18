// 第三十二步：敌人的“心智”——更聪明、更难缠
// · 护体灵光：看得见的灵光罩，先吃伤害；打碎时炸开碎光、对方僵直片刻（反击良机）
// · 遁光 / 血遁 / 雷遁 / 魔影遁：修士远了御器疾追，近了瞬移到你侧后
// · 走位：踩进你的领域会跳出来；妖兽群分头包抄；重伤时护体、呼救、撤退（妖兽撤开后怒而回扑）
// · 趁隙：你施法收招的空当，对手出招更快
import type { Combat, Enemy } from './combat';
import { isBoss } from './foeskills';
import { audio } from './audio';

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export type DunKind = 'sword' | 'blood' | 'thunder' | 'demon' | 'earth';
export interface Ward { hp: number; max: number; col: string; t: number }
export interface MindOut { busy: boolean; mx: number; my: number; sp: number; w: number }

const OUT: MindOut = { busy: false, mx: 0, my: 0, sp: 1, w: 1 };
function out(busy: boolean, mx: number, my: number, sp: number, w = 1) { OUT.busy = busy; OUT.mx = mx; OUT.my = my; OUT.sp = sp; OUT.w = w; return OUT; }

/** 受击高度（护体灵光罩的中心） */
export function wardY(e: Enemy) { return e.def.kind === 'human' ? 62 : e.anim.flying ? 80 : 44 * (e.def.look?.size ?? 1); }
export function wardR(e: Enemy) { return e.def.kind === 'human' ? 62 : 56 * (e.def.look?.size ?? 1); }

/** 修士的遁法：魔修血遁 / 鬼道魔影遁 / 其余剑遁，结丹以上偶用雷遁 */
export function dunOf(e: Enemy): DunKind {
  if (e.dunKind) return e.dunKind;
  const r = e.def.ranged?.fx, col = e.def.ranged?.color ?? '';
  e.dunKind = e.def.evil ? (r === 'ghost' || col.startsWith('170,90') ? 'demon' : 'blood') : e.realm >= 3 && Math.random() < 0.5 ? 'thunder' : 'sword';
  return e.dunKind;
}
export const DUN_COL: Record<DunKind, string> = { sword: '170,240,255', blood: '230,40,60', thunder: '170,180,255', demon: '170,90,230', earth: '200,170,110' };
const DUN_NAME: Record<DunKind, string> = { sword: '遁！', blood: '血遁！', thunder: '雷遁！', demon: '魔影遁！', earth: '土遁！' };

export function giveWard(c: Combat, e: Enemy, frac: number, col: string, say = true) {
  const amt = e.maxHp * frac;
  e.ward = { hp: amt, max: amt, col, t: 0.6 };
  c.fxq.push({ k: 'ward', x: e.x, y: e.y - wardY(e), color: col, r: wardR(e) });
  if (say) c.texts.push({ x: e.x, y: e.y - 130, s: '护体灵光', color: `rgb(${col})`, t: 0, vy: -26 });
  audio.sfx('chime');
}

/** 伤害先打在护体灵光上；返回穿透的部分 */
export function absorbWard(c: Combat, e: Enemy, d: number): number {
  const w = e.ward; if (!w || w.hp <= 0) return d;
  const a = Math.min(w.hp, d);
  w.hp -= a; w.t = 0.3;
  if (w.hp <= 0) {
    e.ward = undefined;
    c.fxq.push({ k: 'shatter', x: e.x, y: e.y - wardY(e), color: w.col, r: wardR(e) });
    c.texts.push({ x: e.x, y: e.y - 150, s: '护体灵光·破！', color: '#fff0c0', t: 0, vy: -30, big: true });
    e.st.stun = { t: 0.7, dps: 0 };   // 灵光反噬，僵直片刻
    c.game.juice(0.05, 0.25); audio.sfx('break');
  } else c.fxq.push({ k: 'block', x: e.x + rand(-20, 20), y: e.y - wardY(e) + rand(-20, 20), color: w.col });
  return d - a;
}

/** 瞬移（血遁 / 雷遁 / 魔影遁 / 土遁） */
export function blinkTo(c: Combat, e: Enemy, x: number, y: number, kind: DunKind, label?: string) {
  if (kind === 'blood') c.fxq.push({ k: 'xueying', x: e.x, y: e.y, x2: x, y2: y });
  else c.fxq.push({ k: 'dunflash', x: e.x, y: e.y, x2: x, y2: y, kind, color: DUN_COL[kind] });
  e.x = x; e.y = y; e.kx = 0; e.ky = 0;
  if (e.cs) { e.cs.x = x; e.cs.y = y; }
  e.trailReset = true;
  c.texts.push({ x, y: e.y - 130, s: label ?? DUN_NAME[kind], color: `rgb(${DUN_COL[kind]})`, t: 0, vy: -26 });
  audio.sfx(kind === 'thunder' ? 'thunder' : 'whoosh');
}

// 第三十七步：瞬移闪避——筑基靠身法、结丹化遁光、元婴真正的瞬移（原著：元婴修士方能短距瞬移，耗费不小）
//   [_, 炼气, 筑基, 结丹, 元婴, 化神]
const EV_CH = [0, 0, 0.18, 0.3, 0.45, 0.6], EV_R = [0, 0, 160, 260, 380, 420], EV_CD = [0, 0, 6, 4, 2.5, 2], EV_N = [0, 0, 1, 2, 3, 3];
const EV_NAME = ['', '', '身法', '遁光', '瞬移', '瞬移'];
const RE_T = 8;   // 每 8 秒回一次

export class FoeMind {
  constructor(public c: Combat) {}

  /** 修士的瞬移闪避：法术临身的一刹那遁开（返回 true = 这一击落空） */
  evade(e: Enemy, fx: number, fy: number, raw: number): boolean {
    const c = this.c, g = c.game;
    if (e.def.kind !== 'human' || e.spar || e.realm < 2 || e.dead || e.cast) return false;
    const st = e.st; if (st.stun || st.freeze || st.root) return false;
    const r = Math.min(5, e.realm);
    if (e.evadeN < 0) e.evadeN = EV_N[r];
    if (e.evadeCd > 0 || e.evadeN <= 0 || e.evRoll > 0) return false;
    e.evRoll = 0.35;   // 连段打击不会每一下都判一次
    const gap = e.realm - g.hero.realm;
    const gm = gap >= 1 ? 1.5 : gap === 0 ? 1 : gap === -1 ? 0.35 : 0;
    if (!gm) return false;
    const ch = Math.min(0.75, EV_CH[r] * (raw > e.maxHp * 0.12 ? 1.5 : 1) * gm * (isBoss(e) ? 1.2 : 1) * (e.pursuer ? 1.3 : 1));
    if (Math.random() >= ch) return false;
    const p = g.player;
    let nx = 0, ny = 0, ok = false;
    // 元婴：一半的时候直接闪到你身后
    if (r >= 4 && Math.random() < 0.5) {
      const yaw = p.st?.yaw ?? 0;
      nx = p.x - Math.cos(yaw) * 140; ny = p.y - Math.sin(yaw) * 110;
      ok = this.canStand(e, nx, ny);
    }
    if (!ok) {
      const ux = e.x - p.x, uy = e.y - p.y, ul = Math.hypot(ux, uy) || 1;
      let ax = e.x - fx, ay = e.y - fy, al = Math.hypot(ax, ay);
      if (al < 20) { ax = ux; ay = uy; al = ul; }
      for (const side of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        const dx = (-uy / ul) * side * 0.8 + (ax / al) * 0.6, dy = (ux / ul) * side * 0.8 + (ay / al) * 0.6, dl = Math.hypot(dx, dy) || 1;
        nx = e.x + (dx / dl) * EV_R[r]; ny = e.y + (dy / dl) * EV_R[r] * 0.8;
        if (this.canStand(e, nx, ny)) { ok = true; break; }
      }
    }
    if (!ok) return false;
    e.evadeN--; e.evadeCd = EV_CD[r];
    blinkTo(c, e, nx, ny, dunOf(e), EV_NAME[r]);
    if (r >= 3) e.skT = Math.min(e.skT, 0.25);   // 闪开即反击
    e.aggro = true;
    return true;
  }

  /** 能否站在那里（飞行的、海里的各有规矩；不进城镇） */
  canStand(e: Enemy, x: number, y: number) {
    const c = this.c, T = c.game.terrain;
    if (c.safeAt(x, y)) return false;
    if (e.def.flying || e.def.kind === 'human' && e.realm >= 2) return true;
    return e.sea ? !T.isLand(x, y) : T.walkFactor(x, y) > 0;
  }

  /** 每帧：返回移动建议（busy = 本帧不出招，只顾走位） */
  tick(e: Enemy, dt: number, tx: number, ty: number, dist: number, rooted: boolean, onPlayer: boolean): MindOut | null {
    const c = this.c, g = c.game;
    if (e.ward && e.ward.t > 0) e.ward.t = Math.max(0, e.ward.t - dt);
    if (e.wardRe > 0 && !e.ward) { e.wardRe -= dt; if (e.wardRe <= 0) giveWard(c, e, e.wardFrac * 0.6, e.wardCol ?? '240,220,140'); }
    // 趁隙：你施法收招的空当，对手出招更快
    if (onPlayer && c.castT > 0.05) e.skT -= dt * 1.5;
    // 瞬移次数慢慢回复
    if (e.evadeN >= 0) { e.evadeCd -= dt; e.evRoll -= dt; const mx = EV_N[Math.min(5, e.realm)]; if (e.evadeN < mx && (e.evadeRe += dt) >= RE_T) { e.evadeRe = 0; e.evadeN++; } }
    if (rooted || e.cast) { e.dun = Math.max(0, e.dun - dt * 3); return null; }
    const human = e.def.kind === 'human' && !e.spar;
    const boss = isBoss(e) && !e.pursuer;
    const dx = tx - e.x, dy = ty - e.y, L = dist || 1;
    // 第三十七步：见了高人而退的、元婴遁走的，远离之后就此消失
    if ((e.cowered && !e.provoked && dist > 1700) || (e.fled && dist > 1500)) { e.gone = true; if (e.fled) g.toast(`${e.name}遁光一闪，已逃得无影无踪。`, 'info'); return out(true, 0, 0, 0); }
    // 1) 踩进你的领域：跳出来
    if (!boss && (human || e.blv >= 3 || e.realm >= 2)) {
      let fx = 0, fy = 0, inF = false;
      for (const f of c.fields) {
        if (f.heal || f.dmg <= 0) continue;
        const ox = e.x - f.x, oy = e.y - f.y, od = Math.hypot(ox, oy);
        if (od < f.r * 1.05) { inF = true; fx += ox / (od || 1); fy += oy / (od || 1); }
      }
      if (inF && human && e.realm >= 3 && e.fieldT > 0.1) {
        if (e.evadeN < 0) e.evadeN = EV_N[Math.min(5, e.realm)];
        if (e.evadeN > 0 && e.evadeCd <= 0) {
          const l = Math.hypot(fx, fy) || 1, R = 300 + Math.random() * 80, nx = e.x + fx / l * R, ny = e.y + fy / l * R * 0.8;
          if (this.canStand(e, nx, ny)) { e.evadeN--; e.evadeCd = EV_CD[Math.min(5, e.realm)]; e.fieldT = 0; blinkTo(c, e, nx, ny, dunOf(e), EV_NAME[Math.min(5, e.realm)]); return null; }
        }
      }
      if (inF) { e.fieldT += dt; if (e.fieldT > (human ? 0.25 : 0.55)) { const l = Math.hypot(fx, fy) || 1; if (human && e.realm >= 2) e.dun = Math.min(1, e.dun + dt * 4); return out(true, fx / l, fy / l, human ? 1.8 : 1.35); } }
      else e.fieldT = 0;
    }
    // 2) 撤退中
    if (e.retreatT > 0) {
      e.retreatT -= dt;
      if (human && e.realm >= 2) e.dun = Math.min(1, e.dun + dt * 3);
      if (e.retreatT <= 0 && !human) { e.atk *= 1.15; e.speed *= 1.1; c.texts.push({ x: e.x, y: e.y - 120, s: '怒！', color: '#ff7a5a', t: 0, vy: -26, big: true }); e.skT = 0; }
      return out(true, -dx / L, -dy / L, human ? 2.0 : 1.4);
    }
    // 3) 重伤：护体、呼救、撤退
    const hpK = e.hp / e.maxHp;
    if (!e.lowDone && hpK < (human ? 0.35 : 0.25) && !boss && !e.minion && !e.yieldAt) {
      e.lowDone = true;
      if (human) {
        if (e.realm >= 2 && !e.ward) giveWard(c, e, 0.28, e.def.evil ? '230,80,90' : '240,220,140');
        let n = 0;
        for (const o of c.enemies) if (o !== e && !o.dead && !o.aggro && o.def.kind === 'human' && !o.spar && Math.hypot(o.x - e.x, o.y - e.y) < 1800) { o.aggro = true; n++; }
        c.texts.push({ x: e.x, y: e.y - 140, s: n ? '同门何在，助我！' : pick(['可恶……', '好厉害的小辈！', '今日算我栽了！']), color: '#ffd0a0', t: 0, vy: -20 });
        if (Math.random() < 0.5 && !e.pursuer) {
          e.retreatT = rand(2, 3.2);
          if (e.realm >= 2 && Math.random() < 0.6) { const a = Math.atan2(-dy, -dx) + rand(-0.5, 0.5), R = rand(380, 520), nx = e.x + Math.cos(a) * R, ny = e.y + Math.sin(a) * R * 0.75; if (this.canStand(e, nx, ny)) blinkTo(c, e, nx, ny, dunOf(e)); }
        }
      } else if (e.blv >= 3 && Math.random() < 0.6) {
        e.retreatT = rand(1.8, 2.8);
        c.texts.push({ x: e.x, y: e.y - 110, s: '嗷——', color: '#e8c8a0', t: 0, vy: -24 });
      }
    }
    // 3b) 元婴老怪重伤：瞬移数百丈，遁走（原著：元婴修士最难杀，打不过就跑）
    if (human && e.realm >= 4 && hpK < 0.2 && !e.fled && !boss && !e.pursuer && !e.tag && !(e as any).warRos) {
      e.fled = true; e.retreatT = 99;
      const a = Math.atan2(-dy, -dx) + rand(-0.4, 0.4);
      for (const R of [600, 450, 300]) { const nx = e.x + Math.cos(a) * R, ny = e.y + Math.sin(a) * R * 0.8; if (this.canStand(e, nx, ny)) { blinkTo(c, e, nx, ny, dunOf(e), '瞬移遁走'); break; } }
      c.texts.push({ x: e.x, y: e.y - 150, s: '小辈，后会有期！', color: '#ffd0a0', t: 0, vy: -20 });
      return out(true, -dx / L, -dy / L, 2.4);
    }
    // 3c) 见高人而退：高你两个大境界的前辈，散修劫修不敢招惹（敛息时看不穿）
    if (human && onPlayer && !boss && !e.pursuer && !e.wing && !e.tag && !(e as any).warRos && !e.cowered && !e.provoked && !g.concealed && g.hero.realm >= e.realm + 2) {
      e.cowered = true; e.retreatT = 40;
      c.texts.push({ x: e.x, y: e.y - 140, s: g.hero.realm >= 4 ? pick(['元婴老怪！快逃！', '前辈饶命！']) : pick(['前辈饶命！', '晚辈有眼无珠！', '告辞、告辞！']), color: '#ffe0b0', t: 0, vy: -22 });
      if (e.realm >= 2) e.dun = 1;
      return out(true, -dx / L, -dy / L, 2.2);
    }
    // 4) 修士：遁光疾追 / 瞬移侧翼 / 各司其职
    if (human) {
      e.blinkCd -= dt;
      if (e.realm >= 2 && dist > 720 && !e.pursuer && !e.busy) {
        e.dun = Math.min(1, e.dun + dt * 3);
        const lt = Math.min(0.8, dist / 900), ax = tx + (onPlayer ? g.player.st.vx * lt : 0) - e.x, ay = ty + (onPlayer ? g.player.st.vy * lt : 0) - e.y, al = Math.hypot(ax, ay) || 1;
        return out(true, ax / al, ay / al, 2.8);
      }
      e.dun = Math.max(0, e.dun - dt * 2);
      if (e.realm >= 2 && e.blinkCd <= 0 && dist > 260 && dist < 1000 && !(e.pursuer && onPlayer && g.player.boosting) && Math.random() < dt * 0.9) {
        e.blinkCd = (e.realm >= 4 ? rand(4, 7) : e.realm >= 3 ? rand(6, 10) : rand(8, 13)) * (e.pursuer ? 0.75 : 1);
        let nx: number, ny: number;
        if (e.realm >= 4 && onPlayer) {
          // 元婴：瞬移到你背后（你面朝的反方向）
          const yaw = (g.player.st?.yaw ?? 0) + Math.PI + rand(-0.5, 0.5), R = rand(150, 230);
          nx = tx + Math.cos(yaw) * R; ny = ty + Math.sin(yaw) * R * 0.75;
        } else {
          const side = Math.random() < 0.5 ? 1 : -1, a = Math.atan2(e.y - ty, e.x - tx) + side * rand(0.9, 1.7), R = rand(220, 320);
          nx = tx + Math.cos(a) * R; ny = ty + Math.sin(a) * R * 0.75;
        }
        if (this.canStand(e, nx, ny)) { blinkTo(c, e, nx, ny, dunOf(e), e.realm >= 4 ? '瞬移' : undefined); if (e.realm >= 3) e.skT = Math.min(e.skT, 0.35); }
      }
      // 护法：照看受伤的同伴
      e.supCd -= dt;
      if (e.role === 'support' && e.supCd <= 0) {
        let worst: Enemy | null = null, wk = 0.65;
        for (const o of c.enemies) if (o !== e && !o.dead && o.aggro && o.def.kind === 'human' && o.hp / o.maxHp < wk && Math.hypot(o.x - e.x, o.y - e.y) < 700) { wk = o.hp / o.maxHp; worst = o; }
        if (worst) {
          e.supCd = rand(8, 11);
          if (!worst.ward && e.realm >= 2 && Math.random() < 0.5) giveWard(c, worst, 0.18, '150,230,170', false);
          else { worst.hp = Math.min(worst.maxHp, worst.hp + worst.maxHp * 0.18); c.vfx.push({ kind: 'aura', x: worst.x, y: worst.y, r: 90, t: 0, dur: 0.9, color: '150,230,120' } as any); }
          c.texts.push({ x: e.x, y: e.y - 130, s: '回春术', color: '#a8e8a0', t: 0, vy: -24 });
          c.texts.push({ x: worst.x, y: worst.y - 120, s: '+', color: '#a8e8a0', t: 0, vy: -30, big: true });
        }
      }
      return null;
    }
    // 5) 妖兽群：分头包抄，从不同方向扑上来
    if (e.def.melee && !boss && dist > 150 && dist < 760) {
      let pack = 0;
      for (const o of c.enemies) if (o !== e && !o.dead && o.aggro && o.def.melee && o.def.kind !== 'human' && Math.abs(o.x - tx) < 900 && Math.abs(o.y - ty) < 900) pack++;
      if (pack >= 1) {
        e.slotA ??= (((e.id * 9301) % 1) + 1) % 1 * TAU;
        const R = e.def.melee.range * 0.9 + 50, sx = tx + Math.cos(e.slotA) * R, sy = ty + Math.sin(e.slotA) * R * 0.7;
        const ox = sx - e.x, oy = sy - e.y, ol = Math.hypot(ox, oy) || 1;
        return out(false, ox / ol, oy / ol, 1.12, 0.75);
      }
    }
    return null;
  }

  /** 修士入战时分派职责：远攻 / 近战 / 护法 */
  assignRole(e: Enemy) {
    if (e.role || e.def.kind !== 'human') return;
    const k = Math.floor(e.id * 1000) % 5;
    e.role = !e.def.melee && k === 0 && e.realm >= 1 ? 'support' : e.def.melee ? 'tank' : 'ranged';
  }
}
