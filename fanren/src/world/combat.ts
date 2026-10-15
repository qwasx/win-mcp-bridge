// 第三步：战斗系统 —— 法术施放、弹道、区域、召唤、异状与连携、敌人 AI、掉落、熟练度
import type { Game } from './game';
import { ARTS, ArtSkill, PROF_CD, PROF_CH, PROF_DMG, PROF_NAME, PROF_RAD, profLevel, StatusKind, StatusSpec, STATUS_NAME, Fx, School, ART_LIST } from '../data/arts';
import { ENEMY_LIST, EnemyDef, dangerRealm } from '../data/enemies';
import { REALMS, realmName, expNeed } from '../data/realms';
import { LOCATIONS, WORLD_SCALE, regionAt, LocDef } from '../data/world';
import { itemDef } from '../data/items';
import * as C from './cultivation';
import { clamp } from '../core/rng';
import { CharState, randomLook, Look } from '../gfx/character';
import { audio } from './audio';
import type { FxEvent } from '../gl/combatgl';
import { ArtActs, lookOf } from './artacts';

/** 各系命中光色 */
const SCHOOL_COL: Partial<Record<School, string>> = { 火: '255,140,60', 冰: '150,220,255', 雷: '170,190,255', 风: '200,255,230', 土: '220,180,110', 木: '150,230,110', 剑: '210,255,240', 体: '255,220,160', 御: '255,210,120', 魔: '230,60,80', 识: '210,170,255', 阵: '255,230,140', 身: '200,240,255', 符: '255,210,110' };
/**
 * 境界压制（凡人修仙传：越一大境界几乎不可战胜）
 * gap = 对方大境界 - 我方大境界
 * 打高境界：每高一境，伤害只剩 6%；被高境界打：每高一境，承伤 ×3.2
 */
export function realmDealK(gap: number, talisman = false) { if (gap > 0) return Math.pow(talisman ? 0.3 : 0.06, gap); if (gap < 0) return 1 + 0.6 * -gap; return 1; }
export function realmTakeK(gap: number) { if (gap > 0) return Math.pow(3.2, gap); if (gap < 0) return Math.pow(0.35, -gap); return 1; }

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));

export interface StatusInst { t: number; dps: number; stacks?: number }
export type Statuses = Partial<Record<StatusKind, StatusInst>>;

export class Enemy {
  id = Math.random();
  def: EnemyDef; x: number; y: number; hx: number; hy: number;
  vx = 0; vy = 0; kx = 0; ky = 0;
  realm: number; stage: number; level: number;
  hp: number; maxHp: number; atk: number; dfn: number; speed: number;
  facing = 1; aggro = false; flee = false; dead = false; deathT = 0;
  cdMelee = 0; cdRanged = 1 + Math.random() * 2; windup = 0; wanderT = 0; wx = 0; wy = 0;
  anim = { move: 0, phase: 0, atk: 0, hit: 0, t: Math.random() * 10, flying: false };
  st: Statuses = {};
  look?: Look; cs?: CharState;
  name: string;
  hitFlash = 0; lastHitBy = 0;
  sea: boolean;
  npcId?: string;      // 第四步：由人界 NPC 转化而来的敌人
  spar?: boolean;      // 切磋：不致死
  boss?: boolean;      // 事件首领
  constructor(def: EnemyDef, x: number, y: number, realm: number, stage: number, sea = false) {
    this.def = def; this.x = this.hx = x; this.y = this.hy = y;
    this.realm = realm; this.stage = stage; this.level = realm * 13 + stage;
    const R = REALMS[realm];
    const s = Math.min(stage, R.hp.length - 1);
    this.maxHp = this.hp = Math.round(R.hp[s] * def.hp * 0.8);
    this.atk = R.atk[s] * def.atk * 0.85;
    this.dfn = R.def[s] * def.def;
    this.speed = def.speed;
    this.anim.flying = !!def.flying;
    this.sea = sea;
    this.name = def.name;
    if (def.kind === 'human') {
      let seed = Math.floor(Math.random() * 1e9);
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      this.look = randomLook(rnd, 'cultivator');
      if (def.robe) (this.look as any).robe = def.robe;
      this.cs = new CharState(x, y);
    }
  }
  get rankText() {
    if (this.def.kind === 'human' || this.def.kind === 'ghost') return realmName(this.realm, this.stage);
    const lv = this.realm === 1 ? (this.stage < 5 ? 1 : this.stage < 10 ? 2 : 3) : this.realm === 2 ? 3 + Math.min(1, this.stage) : this.realm === 3 ? 5 + Math.min(1, this.stage) : 7 + Math.min(1, this.stage);
    return ['', '一级', '二级', '三级', '四级', '五级', '六级', '七级', '八级'][lv] + '妖兽';
  }
}

interface Proj {
  fac: 'p' | 'e'; x: number; y: number; vx: number; vy: number; life: number; max: number;
  fx: Fx; color: string; dmg: number; realm: number; status?: StatusSpec; stCh: number;
  pierce: boolean; homing: boolean; hit: Set<number>; r: number; aoe: number; school?: School;
  evil?: number; size: number; trail: [number, number][]; tick?: number; lv: number; target?: Enemy | null; skill?: string;
}
interface Field { x: number; y: number; r: number; t: number; dur: number; fx: Fx; color: string; dmg: number; tick: number; status?: StatusSpec; stCh: number; school?: School; heal?: boolean; follow?: boolean; lv: number; realm: number; evil?: number }
interface Vfx { kind: 'ring' | 'beam' | 'chain' | 'strike' | 'cone' | 'flash' | 'warn' | 'slash' | 'aura' | 'blinkfx' | 'bigsword' | 'pillar'; x: number; y: number; x2?: number; y2?: number; r: number; t: number; dur: number; color: string; fx?: Fx; ang?: number; spread?: number; pts?: [number, number][]; seed?: number; w?: number }
interface Txt { x: number; y: number; s: string; color: string; t: number; big?: boolean; vy: number }
interface Loot { x: number; y: number; id: string; n: number; t: number }
interface Summon { cs?: CharState; kind: 'bugs' | 'puppet' | 'fox' | 'tihun' | 'demon' | 'jiao' | 'quhun'; x: number; y: number; t: number; dmg: number; cd: number; target: Enemy | null; phase: number; facing: number; n: number; evil?: number; status?: StatusSpec; dots?: { a: number; r: number; s: number }[] }
interface Strike { x: number; y: number; t: number; dmg: number; r: number; status?: StatusSpec; stCh: number; school?: School; fx: Fx; color: string; realm: number; evil?: number; lv: number }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; max: number; size: number; color: string }

export class Combat {
  game: Game;
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  fields: Field[] = [];
  vfx: Vfx[] = [];
  texts: Txt[] = [];
  loot: Loot[] = [];
  summons: Summon[] = [];
  strikes: Strike[] = [];
  sparks: Spark[] = [];
  cds = new Map<string, number>();
  cdMax = new Map<string, number>();
  // 玩家状态
  pst: Statuses = {};
  buffs: { atk: number; def: number; speed: number; regen: number; stealth: number; decoy: number; until: Record<string, number> } = { atk: 0, def: 0, speed: 0, regen: 0, stealth: 0, decoy: 0, until: {} };
  shield: { amt: number; max: number; t: number; reflect: number; status?: StatusSpec; fx: Fx; color: string; art?: string } | null = null;
  /** 盾形法器格挡闪光（0–1）与来袭方向 */
  blockT = 0; blockDir = 0; shieldCd = 0; shieldAng = 0;
  /** 法器盾的悬浮位置（玩家身前，挡格时转向来袭方向） */
  shieldPos() {
    const p = this.game.player, t = this.game.time;
    return { x: p.x + Math.cos(this.shieldAng) * 46, y: p.y + Math.sin(this.shieldAng) * 16, h: 62 + Math.sin(t * 2.4) * 4 - this.blockT * 6, front: Math.sin(this.shieldAng) > -0.2 };
  }
  orbit: { t: number; n: number; r: number; dmg: number; color: string; hitT: Map<number, number>; lv: number } | null = null;
  heal: { t: number; rate: number; mp: number } | null = null;
  dash: { t: number; dur: number; vx: number; vy: number; dmg: number; hit: Set<number>; invuln: boolean; color: string } | null = null;
  decoy: { x: number; y: number; t: number } | null = null;
  castT = 0; hitT = 0; combatT = 99; invulnT = 0;
  lock: Enemy | null = null;
  private spawnT = 2;
  private dangerCache = { x: -1e9, y: -1e9, d: 0, zone: '' as string, region: '' };
  fade = 0;
  /** 渲染特效事件队列（WebGL 层消费） */
  fxq: FxEvent[] = [];
  dodgeCd = 0;
  /** 威压：附近敌对高境界者带来的压制（0 无；1 = 高一大境界） */
  pressure = 0;
  private pressWarnT = 0;

  /** 第十三步：法器出手（实体 + 光效） */
  acts: ArtActs;
  constructor(game: Game) { this.game = game; this.acts = new ArtActs(this); }

  reset() {
    this.enemies = []; this.projs = []; this.fields = []; this.vfx = []; this.texts = []; this.loot = []; this.summons = []; this.strikes = []; this.sparks = [];
    this.cds.clear(); this.pst = {}; this.shield = null; this.orbit = null; this.heal = null; this.dash = null; this.decoy = null; this.acts?.reset();
    this.buffs = { atk: 0, def: 0, speed: 0, regen: 0, stealth: 0, decoy: 0, until: {} };
  }

  // ------------------------------------------------------------ 玩家数值
  get pStats() {
    const g = this.game, s = g.stats, h = g.hero;
    let def = s.def;
    const armor = h.equip.armor ? itemDef(h.equip.armor).art : undefined;
    if (armor?.def) def *= 1 + armor.def;
    def *= 1 + this.buffs.def;
    if (this.pst.break) def *= 0.5;
    return { hp: s.hp, mp: s.mp, atk: s.atk * (1 + this.buffs.atk), def, realm: h.realm, sense: s.sense };
  }
  artLv(id: string) { const a = this.game.hero.arts.find((x) => x.id === id); const d = ARTS[id]; return a && d ? profLevel(d.tier, a.xp) : 0; }
  get canAct() { return !this.pst.stun && !this.pst.freeze && !this.pst.shock && !this.game.hero.dead; }
  get inCombat() { const p = this.game.player; return this.enemies.some((e) => !e.dead && e.aggro && !e.spar && Math.abs(e.x - p.x) < 1100 && Math.abs(e.y - p.y) < 1100); }
  get canMove() { return this.canAct && !this.pst.root && !this.dash; }
  get speedMul() { return (this.pst.slow ? 0.5 : 1) * (1 + this.buffs.speed) * (1 - 0.22 * Math.min(2, this.pressure)); }

  // ------------------------------------------------------------ 瞄准
  aim(range: number): { x: number; y: number; dx: number; dy: number; target: Enemy | null } {
    const g = this.game, p = g.player;
    const m = g.input.mouse;
    const R = g.senseRadius;
    let target: Enemy | null = null;
    if (m.active && g.time - m.t < 2.5) {
      // 鼠标瞄准：附近的敌人做吸附
      let bd = 120;
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; target = e; } }
      const tx = target ? target.x : m.x, ty = target ? target.y - 30 : m.y;
      const d = Math.hypot(tx - p.x, ty - p.y) || 1;
      return { x: tx, y: ty, dx: (tx - p.x) / d, dy: (ty - p.y) / d, target };
    }
    // 自动锁定最近敌人
    if (this.lock && (this.lock.dead || Math.hypot(this.lock.x - p.x, this.lock.y - p.y) > Math.min(R, range * 1.6))) this.lock = null;
    if (!this.lock) {
      let bd = Math.min(R, range * 1.4);
      for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; this.lock = e; } }
    }
    target = this.lock;
    if (target) {
      const ty = target.y - (target.anim.flying ? 70 : 24);
      const d = Math.hypot(target.x - p.x, ty - p.y) || 1;
      return { x: target.x, y: ty, dx: (target.x - p.x) / d, dy: (ty - p.y) / d, target };
    }
    const yaw = p.st.yaw;
    const dx = Math.sin(yaw), dy = Math.cos(yaw);
    return { x: p.x + dx * range * 0.7, y: p.y + dy * range * 0.7, dx, dy, target: null };
  }

  // ------------------------------------------------------------ 施放
  /** 施放快捷栏条目：法术 id 或 'art:物品id' */
  castSlot(i: number) {
    const id = this.game.hero.hotbar[i];
    if (!id) { this.game.toast(`快捷栏 ${i + 1} 尚未放置法术。按 K 打开法术书。`); return; }
    if (id.startsWith('art:')) this.castArtifact(id.slice(4));
    else if (id.startsWith('tal:')) this.castTalisman(id.slice(4));
    else this.cast(id);
  }

  cdLeft(id: string) { return Math.max(0, this.cds.get(id) ?? 0); }
  cdFrac(id: string) { const m = this.cdMax.get(id) ?? 1; return clamp(this.cdLeft(id) / m, 0, 1); }

  cast(id: string) {
    const g = this.game, h = g.hero, s = ARTS[id];
    if (!s) return;
    if (!h.arts.some((a) => a.id === id)) { g.toast(`尚未习得${s.name}。`, 'warn'); return; }
    if (!this.canAct) return;
    if (h.realm < s.realm) { g.toast(`${s.name}需${REALMS[s.realm].name}期方可施展。`, 'warn'); return; }
    if (s.needs && C.bagCount(h, s.needs) <= 0) { g.toast(`${s.name}需要${itemDef(s.needs).name}。`, 'warn'); return; }
    if (this.cdLeft(id) > 0) return;
    if (s.cast === 'sense') {
      if (id === 'waifang') g.senseBurst(); else g.toggleConceal();
      this.setCd(id, s.cd); return;
    }
    if (h.mp < s.mp - 1e-6) { g.toast('法力不足。', 'warn'); return; }
    if (s.hpCost && h.hp <= s.hpCost + 0.02) { g.toast('气血不足，强行施展恐有性命之忧。', 'warn'); return; }
    if (g.player.sitting) g.stand();
    if (g.isFlying && g.player.flying && !g.canFlyNative) g.toggleFly();
    h.mp -= s.mp; if (s.hpCost) h.hp -= s.hpCost;
    const lv = this.artLv(id);
    this.setCd(id, s.cd * PROF_CD[lv]);
    this.castT = 0.32; this.combatT = 0;
    if (g.concealed && s.power > 0) g.toggleConceal();
    this.buffs.until.stealth && (this.buffs.until.stealth = Math.min(this.buffs.until.stealth, g.time + (lv >= 3 && id === 'nifeng' ? 99 : 0)));
    const a = this.aim(s.range || 400);
    g.player.st.faceToward(a.dx, a.dy, false);
    this.exec(s, lv, a, this.pStats.atk, this.pStats.realm);
    this.gainXp(id, 1);
    audio.sfx(s.school === '雷' ? 'thunder' : 'whoosh');
  }

  private setCd(id: string, cd: number) { this.cds.set(id, cd); this.cdMax.set(id, cd); }

  gainXp(id: string, n: number) {
    const h = this.game.hero, a = h.arts.find((x) => x.id === id), s = ARTS[id];
    if (!a || !s) return;
    const before = profLevel(s.tier, a.xp);
    a.xp += n;
    const after = profLevel(s.tier, a.xp);
    if (after > before) {
      this.game.toast(`${s.name}熟练度提升至「${PROF_NAME[after]}」：${s.evo[after - 1]}`, 'good');
      audio.sfx('chime');
      this.vfx.push({ kind: 'ring', x: this.game.player.x, y: this.game.player.y, r: 160, t: 0, dur: 0.9, color: s.color });
    }
  }

  private exec(s: ArtSkill, lv: number, a: ReturnType<Combat['aim']>, atk: number, realm: number) {
    const p = this.game.player;
    const dmg = atk * s.power * PROF_DMG[lv];
    const stCh = (s.status?.ch ?? 0) + (s.status ? PROF_CH[lv] : 0);
    const radius = (s.radius ?? 0) * PROF_RAD[lv];
    const count = s.count === undefined ? (s.lvCount ? s.lvCount[lv] : 1) : s.count + (s.lvCount ? s.lvCount[lv] - s.lvCount[0] : 0);
    const ox = p.x + a.dx * 26, oy = p.y - 46 + a.dy * 10;
    const base = { fac: 'p' as const, fx: s.fx, color: s.color, realm, status: s.status, stCh, school: s.school, evil: s.vsEvil, lv, skill: s.id };
    switch (s.cast) {
      case 'bolt': case 'fan': {
        const n = Math.max(1, count);
        const spread = s.cast === 'fan' ? Math.min(1.2, 0.16 * n) : n > 1 ? 0.18 * (n - 1) : 0;
        const ang0 = Math.atan2(a.y - oy, a.x - ox);
        for (let i = 0; i < n; i++) {
          const ang = ang0 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
          const sp = s.speed ?? 700;
          const life = s.dur ?? (s.range / sp);
          this.projs.push({ ...base, x: ox, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: life, dmg: dmg / (s.cast === 'fan' ? 1 : Math.sqrt(n) * 0.85), pierce: !!s.pierce || (s.id === 'qijin' && lv >= 2) || (s.id === 'bingzhui' && lv >= 1), homing: !!s.homing, hit: new Set(), r: s.radius ? radius : 22 + lv * 3, aoe: (s.id === 'huodan' && lv >= 2) || (s.id === 'huoqiufu' && lv >= 2) ? 70 : 0, size: 1 + lv * 0.18, trail: [], target: a.target, tick: 0 });
        }
        break;
      }
      case 'nova': {
        const r = radius;
        this.vfx.push({ kind: 'ring', x: p.x, y: p.y, r, t: 0, dur: 0.6, color: s.color, fx: s.fx });
        if (s.fx === 'lightning') for (let i = 0; i < 6 + lv * 2; i++) { const an = Math.random() * TAU; this.vfx.push({ kind: 'chain', x: p.x, y: p.y - 40, x2: p.x + Math.cos(an) * r, y2: p.y + Math.sin(an) * r * 0.7, r: 0, t: 0, dur: 0.25, color: s.color, seed: Math.random() * 1e6 }); }
        this.aoe(p.x, p.y, r, dmg, base);
        if (s.id === 'zhangxin' && lv >= 2) this.strikes.push({ x: p.x, y: p.y, t: 0.35, dmg: dmg * 0.6, r: r * 0.9, status: s.status, stCh, school: s.school, fx: 'none', color: s.color, realm, lv });
        break;
      }
      case 'burst': {
        const d = Math.min(s.range, Math.hypot(a.x - p.x, a.y - p.y));
        const bx = p.x + a.dx * d, by = p.y + a.dy * d + 30;
        this.vfx.push({ kind: 'warn', x: bx, y: by, r: radius, t: 0, dur: 0.3, color: s.color });
        this.strikes.push({ x: bx, y: by, t: 0.3, dmg, r: radius, status: s.status, stCh, school: s.school, fx: s.fx, color: s.color, realm, lv, evil: s.vsEvil });
        break;
      }
      case 'strike': {
        const d = Math.min(s.range, Math.hypot(a.x - p.x, a.y - p.y));
        const bx = p.x + a.dx * d, by = p.y + a.dy * d + 30;
        const n = Math.max(1, count);
        const rainBonus = s.school === '雷' && (this.game.weather.kind === 'rain' || this.game.weather.kind === 'storm') ? 1.3 : 1;
        for (let i = 0; i < n; i++) {
          const jx = i === 0 ? 0 : rand(-radius, radius), jy = i === 0 ? 0 : rand(-radius, radius) * 0.6;
          this.vfx.push({ kind: 'warn', x: bx + jx, y: by + jy, r: radius, t: -i * 0.22, dur: 0.35 + i * 0.22, color: s.color });
          this.strikes.push({ x: bx + jx, y: by + jy, t: 0.35 + i * 0.22, dmg: dmg * rainBonus, r: radius, status: s.status, stCh, school: s.school, fx: s.fx, color: s.color, realm, lv, evil: s.vsEvil });
        }
        break;
      }
      case 'cone': {
        const ang = Math.atan2(a.dy, a.dx), spread = (s.radius ?? 0.5) * PROF_RAD[lv], range = s.range * PROF_RAD[lv];
        this.vfx.push({ kind: 'cone', x: p.x, y: p.y - 30, r: range, t: 0, dur: 0.4, color: s.color, fx: s.fx, ang, spread });
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
          if (d > range + 30) continue;
          let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          if (Math.abs(da) < spread + 0.15) this.hitEnemy(e, dmg, base, p.x, p.y);
        }
        break;
      }
      case 'beam': {
        const range = s.range * (1 + lv * 0.08);
        const ex = p.x + a.dx * range, ey = p.y + a.dy * range;
        const w = radius || 30;
        this.vfx.push({ kind: s.fx === 'bigsword' ? 'bigsword' : 'beam', x: p.x, y: p.y - 40, x2: ex, y2: ey - 30, r: w, t: 0, dur: s.fx === 'bigsword' ? 0.7 : 0.45, color: s.color, fx: s.fx, seed: Math.random() * 1e6 });
        for (const e of this.enemies) {
          if (e.dead) continue;
          const t = clamp(((e.x - p.x) * a.dx + (e.y - p.y) * a.dy) / range, 0, 1);
          const cx = p.x + a.dx * range * t, cy = p.y + a.dy * range * t;
          if (Math.hypot(e.x - cx, e.y - cy) < w + 30) this.hitEnemy(e, dmg, base, p.x, p.y);
        }
        if (s.id === 'xuelian') { const h = this.game.hero; h.hp = Math.min(1, h.hp + 0.04 + lv * 0.02); }
        break;
      }
      case 'chain': {
        let from = { x: p.x, y: p.y - 46 };
        const hit = new Set<number>();
        let cur = a.target ?? this.nearest(p.x, p.y, s.range, hit);
        let jumps = Math.max(1, count);
        let k = 1;
        while (cur && jumps-- > 0) {
          hit.add(cur.id);
          this.vfx.push({ kind: 'chain', x: from.x, y: from.y, x2: cur.x, y2: cur.y - 30, r: 0, t: 0, dur: 0.35, color: s.color, seed: Math.random() * 1e6, w: 2 + lv });
          this.hitEnemy(cur, dmg * k, base, from.x, from.y);
          k *= 0.85;
          from = { x: cur.x, y: cur.y - 30 };
          cur = this.nearest(cur.x, cur.y, 380, hit);
        }
        if (hit.size === 0) this.vfx.push({ kind: 'chain', x: from.x, y: from.y, x2: a.x, y2: a.y, r: 0, t: 0, dur: 0.3, color: s.color, seed: Math.random() * 1e6, w: 2 });
        break;
      }
      case 'field': {
        const self = s.id === 'juling';
        const d = self ? 0 : Math.min(s.range, Math.hypot(a.x - p.x, a.y - p.y));
        const fx = p.x + a.dx * d, fy = p.y + (self ? 0 : a.dy * d + 30);
        const dur = (s.dur ?? 4) * (lv >= 3 ? 1.35 : 1);
        this.fields.push({ x: fx, y: fy, r: radius, t: 0, dur, fx: s.fx, color: s.color, dmg: self ? 0 : dmg, tick: 0, status: s.status, stCh, school: s.school, heal: self, follow: s.id === 'lieyan' && lv >= 2, lv, realm, evil: s.vsEvil });
        break;
      }
      case 'orbit': {
        this.orbit = { t: s.dur ?? 8, n: Math.max(1, count), r: radius, dmg: dmg * 0.6, color: s.color, hitT: new Map(), lv };
        break;
      }
      case 'dash': {
        const g = this.game, k = g.input.keys;
        let mx = 0, my = 0;
        if (k.has('w') || k.has('arrowup')) my -= 1; if (k.has('s') || k.has('arrowdown')) my += 1;
        if (k.has('a') || k.has('arrowleft')) mx -= 1; if (k.has('d') || k.has('arrowright')) mx += 1;
        mx += g.input.joy.x; my += g.input.joy.y;
        const len = Math.hypot(mx, my);
        const dx = len > 0.1 ? mx / len : a.dx, dy = len > 0.1 ? my / len : a.dy;
        const dist = s.range * (1 + lv * 0.1), dur = 0.2;
        this.dash = { t: 0, dur, vx: dx * dist / dur, vy: dy * dist / dur, dmg: s.power > 0 ? dmg : 0, hit: new Set(), invuln: lv >= 2 || s.id === 'luoyan', color: s.color };
        if (s.id === 'luoyan' && lv >= 1) this.fields.push({ x: p.x, y: p.y, r: 120, t: 0, dur: 2, fx: 'none', color: '220,220,230', dmg: 0, tick: 0, stCh: 0, lv, realm });
        this.vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 50, t: 0, dur: 0.4, color: s.color });
        break;
      }
      case 'blink': {
        const g = this.game, T = g.terrain;
        const dist = Math.min(s.range * (1 + lv * 0.1), s.id === 'xuedun' || s.id === 'tudun' ? s.range : Math.hypot(a.x - p.x, a.y - p.y) + 40);
        let tx = p.x + a.dx * dist, ty = p.y + a.dy * dist;
        // 找可落脚点
        for (let k = 0; k < 10 && !(g.isFlying || T.walkFactor(tx, ty) > 0); k++) { tx -= a.dx * dist * 0.1; ty -= a.dy * dist * 0.1; }
        this.vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 60, t: 0, dur: 0.5, color: s.color });
        if (s.fx === 'lightning' || s.fx === 'blood') this.vfx.push({ kind: s.fx === 'blood' ? 'beam' : 'chain', x: p.x, y: p.y - 40, x2: tx, y2: ty - 40, r: 10, t: 0, dur: 0.3, color: s.color, fx: s.fx, seed: Math.random() * 1e6, w: 3 });
        p.x = tx; p.y = ty; g.cam.x += (tx - g.cam.x) * 0.5; g.cam.y += (ty - g.cam.y) * 0.5;
        this.vfx.push({ kind: 'blinkfx', x: tx, y: ty, r: 70, t: 0, dur: 0.5, color: s.color });
        if (radius > 0 && s.power > 0) { this.vfx.push({ kind: 'ring', x: tx, y: ty, r: radius, t: 0, dur: 0.45, color: s.color, fx: s.fx }); this.aoe(tx, ty, radius, dmg, base); }
        if (s.id === 'tudun' || s.id === 'xuedun') { this.buffs.until.stealth = g.time + (s.id === 'tudun' ? 3 : 2) + lv; for (const e of this.enemies) e.aggro = false; }
        this.invulnT = 0.3;
        break;
      }
      case 'buff': {
        const g = this.game, b = s.buff ?? {}, dur = (s.dur ?? 8) * (1 + lv * 0.15);
        const until = g.time + dur;
        if (b.atk) { this.buffs.until.atk = until; this.buffs.atk = b.atk * (1 + lv * 0.25); }
        if (b.def) { this.buffs.until.def = until; this.buffs.def = b.def * (1 + lv * 0.2); }
        if (b.speed) { this.buffs.until.speed = until; this.buffs.speed = b.speed * (1 + lv * 0.2); }
        if (b.regen) { this.buffs.until.regen = until; this.buffs.regen = b.regen * (1 + lv * 0.3); }
        if (b.stealth) { this.buffs.until.stealth = until; for (const e of this.enemies) e.aggro = false; }
        if (b.decoy) { this.decoy = { x: p.x + a.dx * 40, y: p.y + a.dy * 40, t: dur }; }
        this.vfx.push({ kind: 'aura', x: p.x, y: p.y, r: 90, t: 0, dur: 0.9, color: s.color, fx: s.fx });
        this.game.toast(`${s.name}！`);
        break;
      }
      case 'shield': {
        const amt = this.pStats.hp * s.power * PROF_DMG[lv];
        this.shield = { amt, max: amt, t: (s.dur ?? 8) * (1 + lv * 0.15), reflect: s.buff?.reflect ?? 0.2, status: s.status, fx: s.fx, color: s.color };
        this.vfx.push({ kind: 'aura', x: p.x, y: p.y, r: 80, t: 0, dur: 0.6, color: s.color, fx: s.fx });
        break;
      }
      case 'heal': {
        this.heal = { t: s.dur ?? 3, rate: s.power * PROF_DMG[lv] / (s.dur ?? 3), mp: lv >= 2 ? 0.02 : 0 };
        this.vfx.push({ kind: 'aura', x: p.x, y: p.y, r: 80, t: 0, dur: 1.2, color: s.color, fx: 'leaf' });
        break;
      }
      case 'summon': {
        const sm = s.summon!;
        const n = sm.kind === 'bugs' ? 1 : sm.n + (lv >= 3 && sm.n === 1 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const an = Math.random() * TAU;
          this.summons.push({ cs: sm.kind === 'quhun' ? new CharState(p.x + Math.cos(an) * 60, p.y + Math.sin(an) * 40) : undefined, kind: sm.kind, x: p.x + Math.cos(an) * 60, y: p.y + Math.sin(an) * 40, t: (s.dur ?? 20) * (1 + lv * 0.1), dmg: dmg * (sm.kind === 'demon' ? 0.5 : 1), cd: 0, target: null, phase: 0, facing: 1, n: sm.kind === 'bugs' ? sm.n + lv * 4 : 1, evil: s.vsEvil, status: s.status, dots: sm.kind === 'bugs' ? Array.from({ length: sm.n + lv * 4 }, () => ({ a: Math.random() * TAU, r: rand(8, 40), s: rand(3, 7) })) : undefined });
        }
        this.vfx.push({ kind: 'aura', x: p.x, y: p.y, r: 100, t: 0, dur: 0.8, color: s.color });
        break;
      }
    }
  }

  /** 符箓：一次性消耗（对高境界衰减较少） */
  castTalisman(itemId: string) {
    const g = this.game, h = g.hero, d = itemDef(itemId), tal = d.tal;
    if (!tal) return;
    if (C.bagCount(h, itemId) <= 0) { g.toast(`储物袋中已无${d.name}。`, 'warn'); return; }
    if (!this.canAct) return;
    const key = 'tal:' + itemId;
    if (this.cdLeft(key) > 0) return;
    const p = g.player, ps = this.pStats;
    const color = hexToRgb(tal.color);
    const fake: ArtSkill = { id: key, name: d.name, school: '符', tier: 0, realm: 0, cast: 'bolt', fx: 'talisman', mp: 0, cd: 1, power: tal.power, range: 620, speed: 820, color, desc: '', evo: ['', '', ''] };
    // 符箓威力不随自身攻击过多放大：取“符力”为主
    const atk = Math.max(ps.atk, REALMS[Math.max(1, h.realm)].atk[0]) * 0.9;
    switch (tal.kind) {
      case 'fire': fake.cast = 'fan'; fake.fx = 'fireball'; fake.count = 3; fake.status = { k: 'burn', dur: 3, ch: 0.5 }; break;
      case 'ice': fake.cast = 'fan'; fake.fx = 'icicle'; fake.count = 3; fake.speed = 900; fake.status = { k: 'freeze', dur: 1.4, ch: 0.45 }; break;
      case 'thunder': fake.cast = 'strike'; fake.fx = 'lightning'; fake.radius = 120; fake.count = 1; fake.range = 640; fake.status = { k: 'shock', dur: 1, ch: 0.6 }; fake.vsEvil = 2; break;
      case 'fubao': fake.cast = 'beam'; fake.fx = 'bigsword'; fake.radius = 64; fake.range = 640; fake.status = { k: 'knock', dur: 0.4, ch: 1 }; fake.school = '剑'; break;
      case 'shield': fake.cast = 'shield'; fake.fx = 'gold'; fake.power = tal.power; fake.dur = 12; break;
      case 'bomb': {
        C.removeItem(h, itemId, 1); this.setCd(key, 1); this.castT = 0.3; this.combatT = 0;
        if (g.player.sitting) g.stand();
        const a = this.aim(560); p.st.faceToward(a.dx, a.dy, false);
        const L = lookOf(itemId);
        this.acts.bomb({ itemId, art: { kind: 'slam', reqRealm: 0, sense: 0, pieces: 1, power: tal.power, mp: 0, cd: 1, color: tal.color }, L, cc: hexToRgb01(L.glow), dmg: atk * tal.power,
          src: { realm: h.realm, status: { k: 'shock', dur: 1.2, ch: 0.7 }, stCh: 0.7, school: '符', evil: 2, skill: key }, pieces: 1, ax: a.x, ay: a.y, target: a.target });
        audio.sfx('whoosh');
        return;
      }
      case 'escape': {
        C.removeItem(h, itemId, 1); this.setCd(key, 2);
        let fx = 0, fy = 0; for (const e of this.enemies) if (!e.dead && e.aggro) { fx += p.x - e.x; fy += p.y - e.y; }
        const L = Math.hypot(fx, fy) || 1; let tx = p.x + fx / L * 700, ty = p.y + fy / L * 500;
        for (let k = 0; k < 12 && g.terrain.walkFactor(tx, ty) <= 0; k++) { tx = (tx + p.x) / 2; ty = (ty + p.y) / 2; }
        this.vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 70, t: 0, dur: 0.6, color });
        p.x = tx; p.y = ty; this.vfx.push({ kind: 'blinkfx', x: tx, y: ty, r: 70, t: 0, dur: 0.6, color });
        this.buffs.until.stealth = g.time + 4; for (const e of this.enemies) e.aggro = false; this.invulnT = 0.5;
        g.toast(`${d.name}一闪，你已遁出数十丈。`); this.fxq.push({ k: 'dodge', x: tx, y: ty });
        return;
      }
      default: return;
    }
    C.removeItem(h, itemId, 1);
    this.setCd(key, tal.kind === 'fubao' ? 3 : 1);
    this.castT = 0.3; this.combatT = 0;
    if (g.player.sitting) g.stand();
    const a = this.aim(fake.range);
    p.st.faceToward(a.dx, a.dy, false);
    this.vfx.push({ kind: 'flash', x: p.x + a.dx * 30, y: p.y - 50, r: 40, t: 0, dur: 0.25, color });
    this.exec(fake, 0, a, atk, h.realm);
    audio.sfx(tal.kind === 'thunder' ? 'thunder' : 'whoosh');
    if (tal.kind === 'fubao') { g.trauma = Math.min(1, g.trauma + 0.35); const left = C.bagCount(h, itemId); g.toast(left > 0 ? `符宝金芒斩落！符纸上的灵光又黯淡了几分（余 ${left} 次）。` : '符宝金芒斩落——符纸化作飞灰，灵力耗尽了。', left > 0 ? 'info' : 'warn'); }
  }

  /** 法宝 / 法器出手 */
  castArtifact(itemId: string) {
    const g = this.game, h = g.hero, d = itemDef(itemId), art = d.art;
    if (!art) return;
    if (C.bagCount(h, itemId) <= 0) { g.toast(`储物袋中已无${d.name}。`, 'warn'); return; }
    if (!this.canAct) return;
    if (art.kind === 'armor' || art.kind === 'shield' || art.kind === 'flight' || art.kind === 'wings' || art.kind === 'boots') {
      const slot = art.kind === 'armor' ? 'armor' : art.kind === 'shield' ? 'shield' : art.kind === 'boots' ? 'boots' : 'flight';
      (h.equip as any)[slot] = (h.equip as any)[slot] === itemId ? undefined : itemId;
      g.toast((h.equip as any)[slot] ? `祭出${d.name}护身。` : `收起${d.name}。`);
      if (art.kind === 'shield' && (h.equip as any)[slot] && this.shieldCd <= 0) { const amt = this.pStats.hp * (art.absorb ?? 0.5); this.shield = { amt, max: amt, t: 9999, reflect: 0, fx: 'gold', color: lookOf(itemId).glow, art: itemId }; }
      if (art.kind === 'shield' && !(h.equip as any)[slot] && this.shield?.art === itemId) this.shield = null;
      this.fxq.push({ k: 'cast', x: g.player.x, y: g.player.y - 30, color: lookOf(itemId).glow, power: 0.6 });
      audio.sfx((h.equip as any)[slot] ? 'chime' : 'land');
      return;
    }
    const key = 'art:' + itemId;
    if (this.cdLeft(key) > 0) return;
    const ps = this.pStats;
    const cost = art.mp / Math.max(1, ps.mp);
    if (h.mp < cost) { g.toast('法力不足，驱使不动法器。', 'warn'); return; }
    if (art.hpCost) h.hp -= art.hpCost;
    h.mp -= cost;
    const weak = h.realm < art.reqRealm ? (h.realm < art.reqRealm - 1 ? 0.25 : 0.5) : 1;
    this.setCd(key, art.cd);
    this.castT = 0.3; this.combatT = 0;
    if (g.player.sitting) g.stand();
    const color = hexToRgb(art.color);
    const sch: School | undefined = art.element === 'fire' ? '火' : art.element === 'ice' ? '冰' : art.element === 'thunder' ? '雷' : art.element === 'wood' ? '木' : art.element === 'earth' ? '土' : art.element === 'blood' ? '魔' : '剑';
    const status: StatusSpec | undefined = art.element === 'fire' ? { k: 'burn', dur: 3, ch: 0.4 } : art.element === 'ice' ? { k: 'freeze', dur: 1.5, ch: 0.3 } : art.element === 'thunder' ? { k: 'shock', dur: 0.8, ch: 0.4 } : art.element === 'earth' ? { k: 'stun', dur: 0.8, ch: 0.4 } : undefined;
    const pieces = Math.max(1, Math.min(art.pieces, 1 + Math.floor(ps.sense / Math.max(1, art.sense * 2.5))));
    const fake: ArtSkill = {
      id: key, name: d.name, school: sch ?? '剑', tier: 0, realm: 0, cast: 'bolt', fx: 'sword', mp: 0, cd: art.cd, power: art.power * 1.3 * weak, range: 640, speed: 950, pierce: art.kind === 'sword', status, color, desc: '', evo: ['', '', ''], vsEvil: art.element === 'thunder' ? 2 : undefined,
    };
    switch (art.kind) {
      case 'sword': fake.count = pieces; fake.cast = pieces > 1 ? 'fan' : 'bolt'; fake.homing = pieces > 1; if (pieces > 1) fake.power /= Math.sqrt(pieces) * 0.8; break;
      case 'needle': fake.fx = 'needle'; fake.cast = 'fan'; fake.count = pieces; fake.speed = 1200; fake.homing = true; break;
      case 'ring': fake.fx = art.element === 'fire' ? 'fireball' : 'gold'; fake.pierce = true; fake.speed = 600; fake.radius = 40; break;
      case 'mirror': fake.cast = 'beam'; fake.fx = 'magnet'; fake.radius = 26; break;
      case 'slam': fake.cast = 'burst'; fake.fx = 'rock'; fake.radius = 120; break;
      case 'arrow': fake.fx = art.element === 'thunder' ? 'goldthunder' : 'needle'; fake.speed = 1300; fake.pierce = true; break;
      case 'bell': fake.cast = 'nova'; fake.fx = 'roar'; fake.radius = 200; fake.status = { k: 'stun', dur: 1, ch: 0.6 }; break;
      case 'bind': fake.fx = 'vine'; fake.status = { k: 'root', dur: 2.5, ch: 1 }; break;
      case 'flame': fake.cast = 'cone'; fake.fx = 'flame'; fake.radius = 0.6; fake.range = 300; break;
      case 'banner': fake.cast = 'summon'; fake.summon = { kind: 'jiao' as any, n: 1 }; fake.dur = 15; break;
      case 'cauldron': fake.cast = 'burst'; fake.fx = 'gold'; fake.radius = 180; break;
    }
    const a = this.aim(fake.range);
    g.player.st.faceToward(a.dx, a.dy, false);
    // 第十三步：法器以实体出手
    const L = lookOf(itemId);
    const handled = this.acts.spawn({
      itemId, art, L, cc: hexToRgb01(L.glow), dmg: ps.atk * art.power * 1.3 * weak,
      src: { realm: h.realm, status, stCh: status?.ch ?? 0, school: sch, evil: fake.vsEvil, skill: key },
      pieces: art.kind === 'needle' || art.kind === 'sword' ? pieces : 1, ax: a.x, ay: a.y, target: a.target,
    }, fake.dur ?? 15);
    if (handled) { if (art.kind !== 'flame') this.fxq.push({ k: 'cast', x: g.player.x, y: g.player.y - 30, color: L.glow, power: 0.5 }); return; }
    this.exec(fake, 0, a, ps.atk, h.realm);
    audio.sfx('whoosh');
  }

  // ------------------------------------------------------------ 伤害
  private nearest(x: number, y: number, r: number, skip: Set<number>) {
    let best: Enemy | null = null, bd = r;
    for (const e of this.enemies) { if (e.dead || skip.has(e.id)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  private aoe(x: number, y: number, r: number, dmg: number, base: { realm: number; status?: StatusSpec; stCh: number; school?: School; evil?: number; skill?: string }) {
    for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, (e.y - y) * 1.3) < r + 20) this.hitEnemy(e, dmg, base, x, y);
  }

  /** 玩家方命中敌人：含连携判定 */
  hitEnemy(e: Enemy, raw: number, src: { realm: number; status?: StatusSpec; stCh: number; school?: School; evil?: number; skill?: string }, fx: number, fy: number) {
    if (e.dead) return;
    let d = raw;
    let combo = '';
    const st = e.st;
    if (st.freeze && src.school === '雷') { d *= 2.2; delete st.freeze; combo = '冰裂雷爆'; this.vfx.push({ kind: 'flash', x: e.x, y: e.y - 30, r: 120, t: 0, dur: 0.4, color: '200,230,255' }); this.burstShards(e.x, e.y - 30, '200,235,255'); }
    else if (st.root && src.school === '火') { combo = '藤燃燎原'; st.burn = { t: 5, dps: raw * 0.5 }; for (const o of this.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 160) o.st.burn = { t: 4, dps: raw * 0.3 }; this.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 160, t: 0, dur: 0.6, color: '255,120,40', fx: 'flame' }); }
    else if (st.burn && src.school === '风') { combo = '风助火势'; d *= 1.3; for (const o of this.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 180) o.st.burn = { t: 4, dps: st.burn.dps }; this.vfx.push({ kind: 'ring', x: e.x, y: e.y, r: 180, t: 0, dur: 0.6, color: '255,160,60', fx: 'flame' }); }
    else if (st.poison && src.school === '火') { combo = '毒焰爆'; d += st.poison.dps * st.poison.t * (st.poison.stacks ?? 1); delete st.poison; this.vfx.push({ kind: 'flash', x: e.x, y: e.y - 30, r: 100, t: 0, dur: 0.4, color: '160,220,60' }); }
    else if (st.shock && src.school === '冰') { combo = '寒雷相激'; d *= 1.5; }
    // 破甲、麻痹易伤
    let def = e.dfn * (st.break ? 0.5 : 1);
    d = Math.max(d * 0.15, d - def * 0.8);
    if (st.shock) d *= 1.2;
    const gap = e.realm - src.realm;
    d *= realmDealK(gap, src.school === '符');
    if (src.evil && e.def.evil) d *= src.evil;
    const crit = Math.random() < 0.1;
    if (crit) d *= 1.6;
    d = Math.max(1, Math.round(d));
    e.hp -= d; e.anim.hit = 1; e.aggro = true; e.lastHitBy = this.game.time;
    this.combatT = 0;
    // 打击感：白闪、击退、顿帧、震屏、粒子
    e.hitFlash = Math.max(e.hitFlash, 0.12);
    const kdx = e.x - fx, kdy = e.y - fy, kd = Math.hypot(kdx, kdy) || 1;
    const frac = d / e.maxHp;
    const kb = (gap > 0 ? 40 : 90 + Math.min(260, frac * 900)) * (e.def.hp >= 1.8 ? 0.35 : 1);
    e.kx += kdx / kd * kb; e.ky += kdy / kd * kb * 0.7;
    const power = Math.min(3, 0.6 + frac * 6 + (crit ? 0.8 : 0));
    this.fxq.push({ k: 'hit', x: e.x + rand(-8, 8), y: e.y - (e.anim.flying ? 75 : e.def.kind === 'human' ? 62 : 36), color: SCHOOL_COL[src.school as School] ?? '255,236,200', power, crit, dir: Math.atan2(kdy, kdx) });
    this.game.juice(crit ? 0.055 : frac > 0.25 ? 0.04 : 0, crit ? 0.22 : 0.06 + Math.min(0.2, frac));
    if (gap > 0 && Math.random() < 0.3) this.texts.push({ x: e.x, y: e.y - 140, s: '境界压制', color: '#c0a8ff', t: 0, vy: -30 });
    this.texts.push({ x: e.x + rand(-14, 14), y: e.y - 80, s: String(d), color: crit ? '#ffd040' : combo ? '#ff9a5a' : '#fff4e0', t: 0, big: crit || !!combo, vy: -70 });
    if (combo) this.texts.push({ x: e.x, y: e.y - 120, s: combo + '！', color: '#ffcf6a', t: 0, big: true, vy: -40 });
    // 异状
    if (src.status && Math.random() < src.stCh) this.applyStatus(e.st, src.status, d, e, fx, fy);
    if (e.spar && e.hp < e.maxHp * 0.15) { e.hp = e.maxHp * 0.15; e.dead = true; e.deathT = 0.9; if (this.lock === e) this.lock = null; this.onSparEnd?.(e, true); return; }
    if (e.hp <= 0) this.kill(e);
  }
  /** 第四/五步：外部钩子 */
  onKill?: (e: Enemy) => void;
  onSparEnd?: (e: Enemy, playerWon: boolean) => void;
  /** 同伴 / 红颜出手：对敌人造成伤害（带简单特效） */
  allyStrike(fromX: number, fromY: number, e: Enemy, dmg: number, color: string, realm: number) {
    if (e.dead) return;
    this.vfx.push({ kind: 'beam', x: fromX, y: fromY - 40, x2: e.x, y2: e.y - 30, r: 6, t: 0, dur: 0.35, color, seed: Math.random() * 1e6 });
    this.hitEnemy(e, dmg, { realm, stCh: 0 }, fromX, fromY);
  }

  applyStatus(st: Statuses, sp: StatusSpec, dmg: number, e: Enemy | null, fx: number, fy: number) {
    const k = sp.k;
    if (k === 'knock') {
      if (e) { const dx = e.x - fx, dy = e.y - fy, d = Math.hypot(dx, dy) || 1; e.kx = dx / d * 520; e.ky = dy / d * 360; }
      return;
    }
    const cur = st[k];
    if (k === 'burn') st.burn = { t: Math.max(cur?.t ?? 0, sp.dur), dps: Math.max(cur?.dps ?? 0, dmg * 0.25) };
    else if (k === 'poison') st.poison = { t: sp.dur, dps: Math.max(cur?.dps ?? 0, dmg * 0.18), stacks: Math.min(3, (cur?.stacks ?? 0) + 1) };
    else st[k] = { t: Math.max(cur?.t ?? 0, sp.dur * (e && e.realm > this.game.hero.realm ? 0.5 : 1)), dps: 0 };
    if (e && (k === 'freeze' || k === 'stun' || k === 'shock' || k === 'root')) this.texts.push({ x: e.x, y: e.y - 100, s: STATUS_NAME[k], color: '#cfe8ff', t: 0, vy: -30 });
  }

  private burstShards(x: number, y: number, color: string) {
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, v = rand(120, 320); this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, max: rand(0.4, 0.8), size: rand(2, 5), color }); }
  }

  private kill(e: Enemy) {
    const g = this.game, h = g.hero;
    e.dead = true; e.deathT = 0;
    h.kills = (h.kills ?? 0) + 1;
    this.onKill?.(e);
    if (this.lock === e) this.lock = null;
    // 修为
    const pl = h.realm * 13 + h.stage;
    const gapK = e.level >= pl ? 1 + (e.level - pl) * 0.25 : Math.max(0.1, 1 - (pl - e.level) * 0.15);
    const exp = expNeed(e.realm, e.stage) * 0.025 * e.def.hp * gapK;
    const msgs: C.Msg[] = [];
    C.gainExp(h, exp, msgs);
    this.texts.push({ x: e.x, y: e.y - 60, s: `修为 +${Math.round(exp)}`, color: '#9fe8c0', t: 0, vy: -40 });
    // 掉落
    for (const dr of e.def.drops) if (Math.random() < dr.ch) this.dropLoot(e.x, e.y, dr.id, dr.n ? rint(dr.n[0], dr.n[1]) * (1 + e.realm - 1) : 1);
    const dz = this.dangerCache.d;
    if (Math.random() < 0.05 + dz * 0.025 + (e.def.kind === 'human' ? 0.08 : 0)) {
      const sk = this.randomScroll(Math.min(4, Math.floor(dz / 1.5) + (e.realm >= 2 ? 1 : 0)));
      if (sk) this.dropLoot(e.x, e.y, sk, 1);
    }
    this.burstShards(e.x, e.y - 30, e.def.evil ? '160,120,220' : '255,240,200');
    this.fxq.push({ k: 'kill', x: e.x, y: e.y - 40, color: e.def.evil ? '200,80,200' : '255,226,170' });
    this.game.juice(0.09, 0.35);
  }

  randomScroll(maxTier: number): string | null {
    const h = this.game.hero;
    const pool = ART_LIST.filter((s) => s.tier <= maxTier && !h.arts.some((a) => a.id === s.id) && s.realm <= h.realm + 1 && !s.needs);
    if (!pool.length) return null;
    // 低阶更常见
    const w = pool.map((s) => Math.pow(0.45, s.tier));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return 'scroll_art_' + pool[i].id; }
    return 'scroll_art_' + pool[0].id;
  }

  dropLoot(x: number, y: number, id: string, n: number) {
    this.loot.push({ x: x + rand(-40, 40), y: y + rand(-20, 20), id, n: Math.max(1, Math.round(n)), t: 0 });
  }

  /** 敌人命中玩家 */
  hitPlayer(raw: number, srcRealm: number, status: StatusSpec | undefined, fx: number, fy: number, srcEnemy?: Enemy) {
    const g = this.game, h = g.hero;
    if (h.dead || this.invulnT > 0 || (this.dash && this.dash.invuln)) { this.texts.push({ x: g.player.x, y: g.player.y - 110, s: '闪', color: '#cfe', t: 0, vy: -40 }); this.fxq.push({ k: 'dodge', x: g.player.x, y: g.player.y }); return; }
    const ps = this.pStats;
    let d = Math.max(raw * 0.15, raw - ps.def * 0.8);
    d *= realmTakeK(srcRealm - h.realm);
    if (this.orbit) d *= 0.8;
    if (h.equip.armor) d *= 0.95;
    d = Math.max(1, Math.round(d));
    if (this.shield) {
      const ab = Math.min(this.shield.amt, d);
      if (this.shield.art) { this.blockT = 1; this.blockDir = Math.atan2(fy - g.player.y, fx - g.player.x); this.fxq.push({ k: 'block', x: g.player.x + Math.cos(this.blockDir) * 44, y: g.player.y - 56 + Math.sin(this.blockDir) * 18, color: this.shield.color }); audio.sfx('clang'); }
      this.shield.amt -= ab; d -= ab;
      if (srcEnemy && this.shield.reflect && Math.hypot(srcEnemy.x - g.player.x, srcEnemy.y - g.player.y) < 140) {
        this.hitEnemy(srcEnemy, ab * this.shield.reflect + 1, { realm: h.realm, status: this.shield.status, stCh: this.shield.status?.ch ?? 0, school: '冰' }, g.player.x, g.player.y);
      }
      if (this.shield.amt <= 0) {
        const sid = this.shield.art;
        this.vfx.push({ kind: 'flash', x: g.player.x, y: g.player.y - 50, r: 90, t: 0, dur: 0.35, color: this.shield.color }); this.shield = null;
        if (sid) { this.shieldCd = 15; this.fxq.push({ k: 'kill', x: g.player.x + Math.cos(this.blockDir) * 44, y: g.player.y - 56, color: '200,200,210' }); g.toast(`${itemDef(sid).name}被击得灵光尽失，倒飞而回——需调息十五息方能再挡。`, 'warn'); }
        else g.toast('护盾破碎！', 'warn');
      }
      if (d <= 0) { this.texts.push({ x: g.player.x, y: g.player.y - 110, s: '抵', color: '#bde', t: 0, vy: -40 }); return; }
    }
    if (srcEnemy?.spar && h.hp - d / ps.hp < 0.15) { h.hp = Math.max(h.hp, 0.15); srcEnemy.dead = true; srcEnemy.deathT = 0.9; if (this.lock === srcEnemy) this.lock = null; this.onSparEnd?.(srcEnemy, false); return; }
    h.hp -= d / ps.hp;
    this.hitT = 0.25; this.combatT = 0;
    const big = d > ps.hp * 0.15;
    this.texts.push({ x: g.player.x + rand(-10, 10), y: g.player.y - 110, s: '-' + d, color: '#ff6a5a', t: 0, vy: -60, big });
    this.fxq.push({ k: 'phit', x: g.player.x, y: g.player.y - 60, big });
    g.juice(big ? 0.07 : 0.025, big ? 0.45 : 0.2);
    g.hurtFlash = Math.max(g.hurtFlash, big ? 1 : 0.5);
    if (status && Math.random() < status.ch) {
      if (status.k === 'knock') { const dx = g.player.x - fx, dy = g.player.y - fy, dd = Math.hypot(dx, dy) || 1; g.player.x += dx / dd * 50; g.player.y += dy / dd * 30; }
      else this.applyStatus(this.pst, status, d, null, fx, fy);
    }
    if (h.hp <= 0) this.playerDown();
  }

  private playerDown() {
    const g = this.game, h = g.hero;
    // 替身符
    const revive = h.bag.find((b) => itemDef(b.id).tal?.kind === 'revive');
    if (revive) {
      const tal = itemDef(revive.id).tal!;
      C.removeItem(h, revive.id, 1);
      h.hp = tal.power; this.invulnT = 2;
      g.toast(`${itemDef(revive.id).name}化作飞灰，替你挡下一劫！`, 'good');
      this.vfx.push({ kind: 'aura', x: g.player.x, y: g.player.y, r: 140, t: 0, dur: 1.2, color: '255,200,120' });
      return;
    }
    g.onPlayerDown();
  }

  // ------------------------------------------------------------ 危险度与刷怪
  dangerAt(x: number, y: number) {
    const c = this.dangerCache;
    if (Math.hypot(c.x - x, c.y - y) < 300) return c;
    const T = this.game.terrain;
    const land = T.isLand(x, y);
    const reg = regionAt(x / WORLD_SCALE, y / WORLD_SCALE, land);
    const BASE: Record<string, number> = { yue: 0, yuanwu: 1, cheqi: 0.8, zijin: 1, tiandao: 1.5, zhuimo: 2.5, modao: 2.2, jiuguo: 1.8, jixi: 2.5, tianlan: 2, dajin: 3, luanxing_inner: 2, luanxing_outer: 3, wubian: 3.5, beihai: 4 };
    let d = BASE[reg?.id ?? ''] ?? 1;
    for (const l of LOCATIONS) {
      const dl = l.danger ?? 0;
      const dx = l.x * WORLD_SCALE - x, dy = l.y * WORLD_SCALE - y;
      if (Math.abs(dx) > 9000 || Math.abs(dy) > 9000) continue;
      const dist = Math.hypot(dx, dy);
      if (l.type === 'danger' || l.type === 'secret') { const fall = 2500 + dl * 900; if (dist < fall) d = Math.max(d, dl * (1 - dist / fall * 0.6)); }
      if ((l.type === 'city' || l.type === 'sect' || l.type === 'town') && dist < 2600) d *= 0.4 + 0.6 * dist / 2600;
    }
    const s = T.sample(x, y);
    const zone = !land ? 'sea' : T.demonNear(x, y) ? 'demon' : s.cold > 0.6 ? 'cold' : s.arid > 0.6 ? 'arid' : reg?.id === 'tianlan' ? 'grass' : s.forest > 0.4 ? 'forest' : '';
    Object.assign(c, { x, y, d, zone, region: reg?.id ?? '' });
    return c;
  }

  safeAt(x: number, y: number) {
    const z = this.game.terrain.inLocZone(x, y, 300);
    if (!z) return false;
    const l = LOCATIONS.find((q) => q.id === z.id);
    return !!l && (l.type === 'city' || l.type === 'town' || l.type === 'sect' || l.type === 'isle');
  }

  private spawnTick() {
    const g = this.game, p = g.player, T = g.terrain;
    if (g.paused || g.hero.dead) return;
    if (g.story?.fight) return;
    if (this.safeAt(p.x, p.y)) return;
    const dz = this.dangerAt(p.x, p.y);
    const alive = this.enemies.filter((e) => !e.dead).length;
    const cap = 1 + Math.round(dz.d * 1.4) + (g.night > 0.5 ? 1 : 0);
    if (alive >= cap) return;
    if (Math.random() > 0.28 + dz.d * 0.12) return;
    const R = g.senseRadius;
    const dist = clamp(R * 1.05, 520, 1500) + rand(0, 300);
    for (let tries = 0; tries < 6; tries++) {
      const an = Math.random() * TAU;
      const x = p.x + Math.cos(an) * dist, y = p.y + Math.sin(an) * dist * 0.8;
      const sea = !T.isLand(x, y);
      if (this.safeAt(x, y)) continue;
      const zone = sea ? 'sea' : dz.zone === 'sea' ? '' : dz.zone;
      const cands = ENEMY_LIST.filter((e) => e.minDanger <= dz.d + 0.4 && dz.d <= e.maxDanger + 0.5 && (!e.regions || e.regions.includes(dz.region)) && (sea ? e.zone === 'sea' || e.flying : e.zone !== 'sea') && (!e.zone || e.zone === zone));
      if (!cands.length) continue;
      const w = cands.map((e) => (e.zone && e.zone === zone ? 3 : 1) * (e.kind === 'human' ? 0.6 : 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0), def = cands[0];
      for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { def = cands[i]; break; } }
      const n = def.pack ? rint(def.pack[0], def.pack[1]) : 1;
      const rk = dangerRealm(dz.d, Math.random);
      for (let i = 0; i < n; i++) {
        const ex = x + rand(-90, 90), ey = y + rand(-60, 60);
        if (!def.flying && !sea && T.walkFactor(ex, ey) <= 0) continue;
        const st = clamp(rk.stage + rint(-1, 1), 0, REALMS[rk.realm].hp.length - 1);
        this.enemies.push(new Enemy(def, ex, ey, rk.realm, st, sea));
      }
      return;
    }
  }

  /** 秘境 / 洞府守卫 */
  spawnGuards(loc: LocDef) {
    const dz = loc.danger ?? 1;
    const cands = ENEMY_LIST.filter((e) => e.minDanger <= dz && dz <= e.maxDanger && e.zone !== 'sea');
    if (!cands.length) return;
    const n = 1 + Math.floor(dz / 2);
    for (let i = 0; i < n; i++) {
      const def = cands[Math.floor(Math.random() * cands.length)];
      const rk = dangerRealm(dz + 0.5, Math.random);
      const e = new Enemy(def, loc.x * WORLD_SCALE + rand(-200, 200), loc.y * WORLD_SCALE + rand(-150, 150), rk.realm, rk.stage);
      e.name = def.name + '·守护'; e.maxHp = e.hp = Math.round(e.hp * 1.4); e.aggro = true;
      this.enemies.push(e);
    }
  }

  // ------------------------------------------------------------ 每帧更新
  update(dt: number) {
    const g = this.game, p = g.player, h = g.hero;
    const t = g.time;
    this.castT = Math.max(0, this.castT - dt); this.hitT = Math.max(0, this.hitT - dt); this.invulnT = Math.max(0, this.invulnT - dt);
    this.combatT += dt;
    this.fade = Math.max(0, this.fade - dt * 0.6);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    // 威压：附近已察觉你的高境界敌人
    let pr = 0;
    for (const e of this.enemies) if (!e.dead && e.aggro && e.realm > h.realm && Math.hypot(e.x - p.x, e.y - p.y) < 700) pr = Math.max(pr, e.realm - h.realm);
    this.pressure += (pr - this.pressure) * Math.min(1, dt * 3);
    this.pressWarnT -= dt;
    if (pr > 0 && this.pressWarnT <= 0) { this.pressWarnT = 25; g.toast(`一股${['', '远胜于你', '如山岳般', '令人窒息'][Math.min(3, pr)]}的威压笼罩而来——对方修为高出一个大境界以上，硬拼必死，速逃！`, 'warn'); }
    for (const [k, v] of this.cds) if (v > 0) this.cds.set(k, v - dt);
    // 增益过期
    for (const k of ['atk', 'def', 'speed', 'regen'] as const) if (this.buffs.until[k] && t > this.buffs.until[k]) { this.buffs[k] = 0; delete this.buffs.until[k]; }
    const stealth = (this.buffs.until.stealth ?? 0) > t;
    // 刷怪
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 2.5; this.spawnTick(); }
    // 玩家异状
    this.tickStatuses(this.pst, dt, (dmg) => { h.hp -= dmg / this.pStats.hp; if (Math.random() < dt * 3) this.texts.push({ x: p.x, y: p.y - 110, s: '-' + Math.round(dmg * 0.5), color: '#e09060', t: 0, vy: -40 }); if (h.hp <= 0) this.playerDown(); });
    // 回复
    const ooc = this.combatT > 6;
    const regen = (ooc ? 0.025 : 0.003) + this.buffs.regen;
    h.hp = Math.min(1, h.hp + regen * dt);
    h.mp = Math.min(1, h.mp + (ooc ? 0.035 : 0.008) * dt);
    if (this.heal) { this.heal.t -= dt; h.hp = Math.min(1, h.hp + this.heal.rate * dt); h.mp = Math.min(1, h.mp + this.heal.mp * dt); if (Math.random() < dt * 8) this.sparks.push({ x: p.x + rand(-30, 30), y: p.y - rand(0, 80), vx: 0, vy: -40, t: 0, max: 1, size: 3, color: '150,230,120' }); if (this.heal.t <= 0) this.heal = null; }
    if (this.shield) { this.shield.t -= dt; if (this.shield.t <= 0) this.shield = null; }
    this.blockT = Math.max(0, this.blockT - dt * 3);
    if (this.shield?.art) {   // 法器盾绕身缓移：平时守在面朝一侧，挡格时转向来袭方向
      const st = this.game.player.st, want = this.blockT > 0.05 ? this.blockDir : Math.atan2(Math.cos(st.yaw) * 0.6 + 0.25, Math.sin(st.yaw));
      let d = want - this.shieldAng; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.shieldAng += d * Math.min(1, dt * (this.blockT > 0.05 ? 22 : 5));
    }
    // 盾形法器：脱战后灵光渐复
    if (this.shieldCd > 0) this.shieldCd -= dt;
    else if (h.equip.shield && !this.shield) { const sa = itemDef(h.equip.shield).art; if (sa) { const amt = this.pStats.hp * (sa.absorb ?? 0.5); this.shield = { amt, max: amt, t: 9999, reflect: 0, fx: 'gold', color: lookOf(h.equip.shield).glow, art: h.equip.shield }; } }
    if (this.shield?.art && this.combatT > 4) this.shield.amt = Math.min(this.shield.max, this.shield.amt + this.shield.max * 0.08 * dt);
    if (this.decoy) { this.decoy.t -= dt; if (this.decoy.t <= 0) this.decoy = null; }
    // 冲刺
    if (this.dash) {
      const d = this.dash;
      d.t += dt;
      const nx = p.x + d.vx * dt, ny = p.y + d.vy * dt;
      if (g.isFlying || g.terrain.walkFactor(nx, ny) > 0) { p.x = nx; p.y = ny; }
      if (Math.random() < 0.9) this.sparks.push({ x: p.x + rand(-10, 10), y: p.y - rand(10, 70), vx: -d.vx * 0.1, vy: -d.vy * 0.1, t: 0, max: 0.4, size: rand(3, 6), color: d.color });
      if (d.dmg > 0) for (const e of this.enemies) if (!e.dead && !d.hit.has(e.id) && Math.hypot(e.x - p.x, e.y - p.y) < 70) { d.hit.add(e.id); this.hitEnemy(e, d.dmg, { realm: h.realm, stCh: 0, school: '风' }, p.x, p.y); }
      if (d.t >= d.dur) this.dash = null;
    }
    // 环绕剑盾
    if (this.orbit) {
      const o = this.orbit; o.t -= dt;
      for (let i = 0; i < o.n; i++) {
        const an = t * 3.2 + (i / o.n) * TAU;
        const sx = p.x + Math.cos(an) * o.r, sy = p.y - 40 + Math.sin(an) * o.r * 0.5;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - sx, e.y - 30 - sy) < 50 && (o.hitT.get(e.id) ?? 0) < t) { o.hitT.set(e.id, t + 0.5); this.hitEnemy(e, o.dmg, { realm: h.realm, stCh: 0, school: '剑' }, p.x, p.y); }
        }
      }
      if (o.t <= 0) this.orbit = null;
    }
    this.updateEnemies(dt, stealth);
    this.updateProjs(dt);
    this.updateFields(dt);
    this.updateSummons(dt);
    this.acts.update(dt);
    // 天降打击
    this.strikes = this.strikes.filter((s) => {
      s.t -= dt;
      if (s.t > 0) return true;
      this.vfx.push({ kind: 'strike', x: s.x, y: s.y, r: s.r, t: 0, dur: 0.5, color: s.color, fx: s.fx, seed: Math.random() * 1e6 });
      this.aoe(s.x, s.y, s.r, s.dmg, { realm: s.realm, status: s.status, stCh: s.stCh, school: s.school, evil: s.evil });
      if (s.fx === 'lightning' || s.fx === 'goldthunder') audio.sfx('thunder');
      return false;
    });
    // 掉落拾取
    this.loot = this.loot.filter((l) => {
      l.t += dt;
      const d = Math.hypot(l.x - p.x, l.y - p.y);
      if (l.t > 0.6 && d < 130) {
        C.addItem(h, l.id, l.n);
        const it = itemDef(l.id);
        g.toast(`拾得 ${it.name}${l.n > 1 ? ' ×' + l.n : ''}`, it.type === 'scroll' || it.type === 'artifact' ? 'good' : 'info');
        audio.sfx('gather');
        return false;
      }
      return l.t < 120;
    });
    // 文字 / 特效
    this.texts = this.texts.filter((x) => { x.t += dt; x.y += x.vy * dt; x.vy *= 0.94; return x.t < 1.1; });
    this.vfx = this.vfx.filter((v) => { v.t += dt; return v.t < v.dur; });
    this.sparks = this.sparks.filter((s) => { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; return s.t < s.max; });
    if (this.sparks.length > 500) this.sparks.splice(0, this.sparks.length - 500);
    // 清理
    this.enemies = this.enemies.filter((e) => (e.dead ? (e.deathT += dt) < 0.8 : Math.hypot(e.x - p.x, e.y - p.y) < 5000));
  }

  private tickStatuses(st: Statuses, dt: number, dot: (d: number) => void) {
    for (const k in st) {
      const s = st[k as StatusKind]!;
      s.t -= dt;
      if ((k === 'burn' || k === 'poison') && s.dps > 0) dot(s.dps * (s.stacks ?? 1) * dt);
      if (s.t <= 0) delete st[k as StatusKind];
    }
  }

  private updateEnemies(dt: number, stealth: boolean) {
    const g = this.game, p = g.player, T = g.terrain, h = g.hero;
    const concealK = g.concealed ? 0.45 : 1;
    const playerSafe = this.safeAt(p.x, p.y);
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim.t += dt;
      e.anim.hit = Math.max(0, e.anim.hit - dt * 4);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      this.tickStatuses(e.st, dt, (d) => { e.hp -= d; if (Math.random() < dt * 2) this.texts.push({ x: e.x + rand(-10, 10), y: e.y - 70, s: String(Math.max(1, Math.round(d * 0.5 / dt * 0.5))), color: e.st.poison ? '#9ad060' : '#ff9a50', t: 0, vy: -40 }); });
      if (e.hp <= 0) { this.kill(e); continue; }
      const frozen = !!(e.st.freeze || e.st.stun || e.st.shock);
      const rooted = frozen || !!e.st.root;
      const tx = this.decoy ? this.decoy.x : p.x, ty = this.decoy ? this.decoy.y : p.y;
      const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
      // 察觉
      const aggroR = (e.def.aggro ?? 480) * concealK * (e.realm > h.realm ? 1.3 : 1);
      if (!e.aggro && !stealth && !playerSafe && dist < aggroR) { e.aggro = true; if (e.def.kind === 'human') this.texts.push({ x: e.x, y: e.y - 110, s: ['留下储物袋！', '小子，找死！', '杀人夺宝！'][Math.floor(Math.random() * 3)], color: '#ffd0a0', t: 0, vy: -20 }); }
      if (e.aggro && (stealth || playerSafe || dist > 2600 || Math.hypot(e.x - e.hx, e.y - e.hy) > 3200)) e.aggro = false;
      if (!e.flee && e.def.kind === 'beast' && e.hp < e.maxHp * 0.15 && Math.random() < 0.01) e.flee = true;
      let mvx = 0, mvy = 0, sp = e.speed * (e.st.slow ? 0.5 : 1);
      if (frozen) { e.windup = 0; }
      else if (e.flee) { mvx = -dx / (dist || 1); mvy = -dy / (dist || 1); sp *= 1.2; if (dist > 1500) { e.flee = false; e.aggro = false; } }
      else if (e.aggro) {
        e.cdMelee -= dt; e.cdRanged -= dt;
        const m = e.def.melee, r = e.def.ranged;
        if (e.windup > 0) {
          e.windup -= dt; e.anim.atk = 1 - e.windup / 0.4;
          if (e.windup <= 0) {
            e.anim.atk = 0;
            if (m && dist < m.range + 40) { if (this.decoy) { this.decoy.t -= 0.6; } else this.hitPlayer(e.atk * m.power, e.realm, m.status, e.x, e.y, e); }
          }
        } else if (m && dist < m.range && e.cdMelee <= 0) { e.windup = 0.4; e.cdMelee = m.cd; }
        else if (r && dist < r.range && dist > (m ? m.range * 1.2 : 0) && e.cdRanged <= 0) {
          e.cdRanged = r.cd * rand(0.9, 1.3);
          e.anim.atk = 0.5;
          const n = r.count ?? 1;
          for (let i = 0; i < n; i++) {
            const ang = Math.atan2(ty - 40 - (e.y - 40), tx - e.x) + (n > 1 ? (i / (n - 1) - 0.5) * 0.5 : 0);
            const spd = r.speed ?? 500;
            this.projs.push({ fac: 'e', x: e.x, y: e.y - (e.anim.flying ? 70 : 40), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 0, max: r.range / spd + 0.2, fx: r.fx, color: r.color, dmg: e.atk * r.power, realm: e.realm, status: r.status, stCh: r.status?.ch ?? 0, pierce: false, homing: false, hit: new Set(), r: 26, aoe: r.radius ?? 0, size: 0.9, trail: [], lv: 0 });
          }
        } else {
          // 追击 / 保持距离
          const want = r && !m ? r.range * 0.6 : (m?.range ?? 60) * 0.8;
          if (dist > want) { mvx = dx / dist; mvy = dy / dist; }
          else if (r && !m && dist < want * 0.6) { mvx = -dx / dist * 0.6; mvy = -dy / dist * 0.6; }
          // 侧移
          if (r && !m) { const side = Math.sin(e.anim.t * 0.8 + e.id * 10); mvx += -dy / (dist || 1) * side * 0.5; mvy += dx / (dist || 1) * side * 0.5; }
        }
        if (e.windup <= 0) e.anim.atk = Math.max(0, e.anim.atk - dt * 3);
      } else {
        // 游荡
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = rand(2, 5); const a = Math.random() * TAU; e.wx = Math.random() < 0.4 ? 0 : Math.cos(a); e.wy = Math.random() < 0.4 ? 0 : Math.sin(a); if (Math.hypot(e.x - e.hx, e.y - e.hy) > 500) { e.wx = (e.hx - e.x) / 500; e.wy = (e.hy - e.y) / 500; } }
        mvx = e.wx * 0.35; mvy = e.wy * 0.35;
      }
      // 互相避让，免得挤成一团
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oy = e.y - o.y, od = Math.abs(ox) + Math.abs(oy);
        if (od < 70 && od > 0.01) { const d = Math.hypot(ox, oy) || 1; const k = (70 - d) / 70; if (k > 0) { mvx += ox / d * k * 1.2; mvy += oy / d * k * 1.2; } }
      }
      // 不进城镇
      if (rooted) { mvx = 0; mvy = 0; }
      const nx = e.x + (mvx * sp + e.kx) * dt, ny = e.y + (mvy * sp + e.ky) * dt;
      e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      const ok = e.def.flying || (e.sea ? !T.isLand(nx, ny) : T.walkFactor(nx, ny) > 0);
      if (ok && !this.safeAt(nx, ny)) { e.x = nx; e.y = ny; }
      const mv = Math.hypot(mvx, mvy);
      e.anim.move += ((mv > 0.05 ? Math.min(1, mv * 1.4) : 0) - e.anim.move) * Math.min(1, dt * 6);
      e.anim.phase += dt * sp / 18 * e.anim.move;
      if (Math.abs(mvx) > 0.1) e.facing = mvx > 0 ? 1 : -1; else if (e.aggro) e.facing = dx > 0 ? 1 : -1;
      if (e.cs) {
        e.cs.x = e.x; e.cs.y = e.y; e.cs.speed = mv * sp; e.cs.vx = mvx * sp; e.cs.vy = mvy * sp;
        if (mv > 0.05) e.cs.faceToward(mvx, mvy, false); else if (e.aggro) e.cs.faceToward(dx, dy, false);
        e.cs.setAction(frozen ? 'hit' : e.anim.atk > 0.1 ? 'cast' : mv > 0.05 ? (e.aggro ? 'run' : 'walk') : 'idle');
        e.cs.update(dt);
      }
    }
  }

  private updateProjs(dt: number) {
    const g = this.game, p = g.player;
    this.projs = this.projs.filter((pr) => {
      pr.life += dt;
      if (pr.life > pr.max) { if (pr.aoe && pr.fac === 'p') this.explode(pr); return false; }
      // 追踪
      if (pr.homing && pr.fac === 'p') {
        if (!pr.target || pr.target.dead) pr.target = this.nearest(pr.x, pr.y, 520, pr.hit);
        if (pr.target) {
          const sp = Math.hypot(pr.vx, pr.vy);
          const want = Math.atan2(pr.target.y - 30 - pr.y, pr.target.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
          let da = want - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          const na = cur + clamp(da, -dt * 5, dt * 5);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.trail.push([pr.x, pr.y]); if (pr.trail.length > 14) pr.trail.shift(); { const tl = pr.trail; const lim = 240 * pr.size; while (tl.length > 2 && Math.hypot(tl[0][0] - pr.x, tl[0][1] - pr.y) > lim) tl.shift(); }
      if (pr.fx === 'fireball' || pr.fx === 'firesnake' || pr.fx === 'crow' || pr.fx === 'blood' || pr.fx === 'talisman') if (Math.random() < 0.7) this.sparks.push({ x: pr.x + rand(-6, 6), y: pr.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-50, -10), t: 0, max: rand(0.3, 0.6), size: rand(2, 5) * pr.size, color: pr.color });
      if (pr.fac === 'p') {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e.id)) continue;
          const ey = e.y - (e.anim.flying ? 70 : 30);
          if (Math.hypot(e.x - pr.x, ey - pr.y) < pr.r + 28) {
            pr.hit.add(e.id);
            this.hitEnemy(e, pr.dmg, pr, pr.x, pr.y);
            if (pr.aoe) { this.explode(pr); return false; }
            if (!pr.pierce) { this.vfx.push({ kind: 'flash', x: pr.x, y: pr.y, r: 40 * pr.size, t: 0, dur: 0.25, color: pr.color }); return false; }
          }
        }
        // 慢速持续弹道：周期性清除已命中记录
        if (pr.pierce && (pr.fx === 'tornado' || pr.fx === 'water' || pr.fx === 'dragon')) { pr.tick = (pr.tick ?? 0) + dt; if (pr.tick > 0.4) { pr.tick = 0; pr.hit.clear(); } }
      } else {
        if (Math.hypot(p.x - pr.x, p.y - 46 - pr.y) < pr.r + 24) {
          if (pr.aoe) this.vfx.push({ kind: 'ring', x: pr.x, y: pr.y + 40, r: pr.aoe, t: 0, dur: 0.4, color: pr.color, fx: pr.fx });
          this.hitPlayer(pr.dmg, pr.realm, pr.status, pr.x, pr.y);
          this.vfx.push({ kind: 'flash', x: pr.x, y: pr.y, r: 34, t: 0, dur: 0.25, color: pr.color });
          return false;
        }
        // 环绕剑盾格挡
        if (this.orbit && Math.hypot(p.x - pr.x, p.y - 40 - pr.y) < this.orbit.r + 10 && Math.random() < 0.5) { this.vfx.push({ kind: 'flash', x: pr.x, y: pr.y, r: 30, t: 0, dur: 0.2, color: this.orbit.color }); return false; }
      }
      return true;
    });
  }

  private explode(pr: Proj) {
    this.vfx.push({ kind: 'ring', x: pr.x, y: pr.y + 30, r: pr.aoe, t: 0, dur: 0.4, color: pr.color, fx: pr.fx });
    this.burstShards(pr.x, pr.y, pr.color);
    for (const e of this.enemies) if (!e.dead && !pr.hit.has(e.id) && Math.hypot(e.x - pr.x, e.y - 30 - pr.y) < pr.aoe + 20) this.hitEnemy(e, pr.dmg * 0.6, pr, pr.x, pr.y);
  }

  private updateFields(dt: number) {
    const g = this.game, p = g.player, h = g.hero;
    this.fields = this.fields.filter((f) => {
      f.t += dt; f.tick -= dt;
      if (f.follow) { const e = this.nearest(f.x, f.y, 400, new Set()); if (e) { f.x += (e.x - f.x) * dt * 0.8; f.y += (e.y - f.y) * dt * 0.8; } }
      if (f.tick <= 0) {
        f.tick = 0.5;
        if (f.heal) { if (Math.hypot(p.x - f.x, p.y - f.y) < f.r) { h.hp = Math.min(1, h.hp + 0.02 * (1 + f.lv * 0.3)); h.mp = Math.min(1, h.mp + 0.03 * (1 + f.lv * 0.3)); } }
        else if (f.dmg > 0) this.aoe(f.x, f.y, f.r, f.dmg, { realm: f.realm, status: f.status, stCh: f.stCh, school: f.school, evil: f.evil });
      }
      return f.t < f.dur;
    });
  }

  private updateSummons(dt: number) {
    const g = this.game, p = g.player, h = g.hero;
    this.summons = this.summons.filter((s) => {
      s.t -= dt; s.cd -= dt; s.phase += dt * 8;
      if (!s.target || s.target.dead || Math.hypot(s.target.x - p.x, s.target.y - p.y) > 900) s.target = this.nearest(p.x, p.y, 700, new Set());
      let tx = p.x + Math.cos(g.time + s.n) * 70, ty = p.y + 30;
      if (s.target) { tx = s.target.x; ty = s.target.y; }
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
      const sp = s.kind === 'bugs' ? 340 : s.kind === 'puppet' || s.kind === 'quhun' ? 210 : 260;
      const reach = s.kind === 'bugs' ? 40 : 60;
      const moving = d > reach;
      if (moving) { s.x += dx / d * sp * dt; s.y += dy / d * sp * dt; s.facing = dx > 0 ? 1 : -1; }
      if (s.cs) { s.cs.x = s.x; s.cs.y = s.y; s.cs.speed = moving ? sp : 0; s.cs.vx = moving ? dx / d * sp : 0; s.cs.vy = moving ? dy / d * sp : 0; if (d > 1) s.cs.faceToward(dx, dy, false); s.cs.setAction(s.cd > 0.75 ? 'cast' : moving ? 'run' : 'idle'); s.cs.update(dt); }
      if (s.target && d < reach + 20) {
        if (s.kind === 'bugs') { if (s.cd <= 0) { s.cd = 0.4; this.hitEnemy(s.target, s.dmg * (s.n / 14), { realm: h.realm, status: s.status, stCh: s.status?.ch ?? 0, school: '御' }, s.x, s.y); } }
        else if (s.cd <= 0) {
          s.cd = s.kind === 'demon' ? 0.9 : 1.1;
          this.hitEnemy(s.target, s.dmg, { realm: h.realm, stCh: 0.3, status: s.kind === 'fox' ? { k: 'burn', dur: 3, ch: 0.3 } : s.kind === 'tihun' ? { k: 'stun', dur: 1, ch: 0.5 } : s.kind === 'quhun' ? { k: 'knock', dur: 0.3, ch: 0.5 } : undefined, school: s.kind === 'fox' ? '火' : '御', evil: s.evil }, s.x, s.y);
          if (s.kind === 'tihun' && s.target.def.evil) h.mp = Math.min(1, h.mp + 0.03);
        }
      }
      return s.t > 0;
    });
  }

  /** 战斗中的动作覆盖 */
  /** 闪避（空格）：短距冲刺，带无敌帧 */
  dodge() {
    const g = this.game, p = g.player, h = g.hero;
    if (h.dead || this.dash || this.dodgeCd > 0 || g.isFlying) return false;
    let dx = 0, dy = 0;
    const k = g.input.keys;
    if (k.has('a') || k.has('arrowleft')) dx -= 1; if (k.has('d') || k.has('arrowright')) dx += 1;
    if (k.has('w') || k.has('arrowup')) dy -= 1; if (k.has('s') || k.has('arrowdown')) dy += 1;
    if (!dx && !dy && g.destination) { dx = g.destination.x - p.x; dy = g.destination.y - p.y; }
    if (!dx && !dy) { const e = this.lock && !this.lock.dead ? this.lock : this.nearest(p.x, p.y, 600, new Set()); if (e) { dx = p.x - e.x; dy = p.y - e.y; } else { dx = Math.sin(p.st.yaw); dy = Math.cos(p.st.yaw); } }
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const dur = 0.2, dist = 190;
    this.dash = { t: 0, dur, vx: dx * dist / dur, vy: dy * dist / dur * 0.8, dmg: 0, hit: new Set(), invuln: true, color: '200,235,255' };
    this.invulnT = Math.max(this.invulnT, 0.28);
    this.dodgeCd = 0.85;
    this.fxq.push({ k: 'dodge', x: p.x, y: p.y });
    audio.sfx('whoosh');
    return true;
  }

  actionOverride(): 'cast' | 'hit' | 'dodge' | null {
    if (this.dash) return 'dodge';
    if (this.pst.freeze || this.pst.stun) return 'hit';
    if (this.hitT > 0) return 'hit';
    if (this.castT > 0) return 'cast';
    return null;
  }
}

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
/** "r,g,b" → [0..1]³ */
export function hexToRgb01(s: string): [number, number, number] { const p = s.split(',').map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
