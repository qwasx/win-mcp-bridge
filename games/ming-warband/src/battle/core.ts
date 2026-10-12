// 联机实时战斗：无渲染的权威战斗模拟（服务器运行）。
// 规则沿用单机 BattleScene（索敌、阵型、冲锋、射击、士气、援兵），扩展为任意多名玩家统帅同场：
// 每名玩家统领自己的主角、同伴与三队兵马；同一方的 AI 部队共用一组 AI 编队。
import { TROOPS, isRanged, type TroopClass } from '../data/troops';
import { BattleField, sizeFor, FIELD_DIMS } from '../scenes/battle/field';
import type { Ter } from '../core/terrain';
import type { Stack } from '../core/state';
import { Writer } from './wire';

export type Casualties = Record<string, number>;
export type Group = 'inf' | 'rng' | 'cav';
export type Order = 'hold' | 'follow' | 'charge' | 'advance';
export type Form = 'line' | 'block' | 'wedge' | 'loose';
export type PKind = 'bow' | 'xbow' | 'gun';

/** 天命加持（按统帅） */
export interface GodFx { buff: boolean; inv: boolean; oneHit: boolean; speed: number; aura: boolean }
export interface HeroLook { w: string; wr: string | null; a: number; c: number }
export interface HeroIn {
  name: string; maxHp: number; hp: number; atk: number; def: number; skill: number; speed: number; mounted: boolean;
  reach: number; antiCav: boolean; rng: number; range: number; reload: number; ammo: number; kind: PKind | null; meleeSpeed: number; look: HeroLook;
}
export interface CompIn { id: string; name: string; hp: number; atk: number; def: number; skill: number; mounted: boolean; rng: number; kind: PKind | null }
export interface PartyIn {
  pid: string; side: 0 | 1; name: string; faction: string; stacks: Stack[];
  acct?: string;            // 玩家（在线或离线）
  online?: boolean;         // 在线：由真人操控
  hero?: HeroIn; comps?: CompIn[];
  morale?: number; leadership?: number; god?: GodFx | null;
  bandit?: boolean;
}

export interface BUnit {
  uid: number; side: 0 | 1; troop: string | null; comp: string | null; name: string; pid: string; cmd: Cmd | null;
  x: number; y: number; vx: number; vy: number; face: number;
  hp: number; maxHp: number; atk: number; def: number; skill: number; speed: number;
  mounted: boolean; cls: TroopClass; reach: number; antiCav: boolean;
  rng: number; range: number; reload: number; ammo: number; kind: PKind | null;
  cd: number; rcd: number; target: BUnit | null; retarget: number;
  group: Group; dead: boolean; routed: boolean; fled: boolean; hero: boolean;
  disengage: number; r: number; swing: number; hitFlash: number;
  sq: BSquad; slotX: number; slotY: number; god: number; meleeSpeed: number;
  navT?: number; navX?: number; navY?: number; hgt?: number; slopeK?: number; terrT?: number; inForm?: boolean; aiming?: boolean; firedT?: number;
  ranged?: boolean; // 主角当前手持远程
}
export interface BSquad {
  id: number; side: 0 | 1; ai: boolean; owner: Cmd | null; g: Group; order: Order; form: Form;
  ax: number; ay: number; face: number; members: BUnit[];
  tx?: number; ty?: number; flank?: number; phase: number; prefRanged?: boolean;
}
export interface HeroInput { x: number; y: number; face: number; mode: number; atk: number; atkA: number; fire: number; fireA: number; fireD: number; cs: number }
export interface Cmd {
  acct: string; pid: string; side: 0 | 1; name: string; hero: BUnit | null; sq: Record<Group, BSquad>;
  online: boolean; left: boolean; god: GodFx | null; morale: number; leadership: number;
  inp: HeroInput | null; lastAtk: number; lastFire: number; budget: number; corr: boolean; corrSeq: number; corrT: number; heroDown: boolean; compDown: string[];
  view: { x: number; y: number; w: number; h: number }; viewer: Viewer | null; offlineT: number;
}
interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; side: 0 | 1; life: number; kind: PKind; from: BUnit; sx: number; sy: number; dist: number }
interface Ent { id: string; pid: string; k: number; cmd: Cmd | null }
export interface CoreOpts { terrain: Ter; seed: number; night: boolean; cap: number; maxSec?: number }
export interface CmdResult { acct: string; pid: string; side: 0 | 1; down: Casualties; heroDown: boolean; compDown: string[]; heroHp: number; kills: number; retreat: boolean }
export interface CoreResult { winner: 0 | 1 | -1; downPid: Record<string, Casualties>; killsBy: Record<string, number>; cmds: CmdResult[]; dur: number; auto: boolean }
/** 一条要发给某个玩家（acct）或全部玩家（null）的 JSON 消息 */
export interface OutMsg { to: string | null; m: any }

const SWING = 0.32;
const GAPS = [900, 1050, 1200, 1350, 1550];
export const TICK = 0.05;
// 事件类型（二进制帧）
export const EV_SHOT = 1, EV_HIT = 2;
export const HIT_MELEE = 0, HIT_ARROW = 1, HIT_BULLET = 2, BLOCK_MELEE = 3, BLOCK_ARROW = 4, GOD_BLOCK = 5;
export const ST_DEAD = 1, ST_ROUTED = 2, ST_FLED = 4, ST_AIM = 8, ST_SWING = 16, ST_RANGED = 32;
const KIND_N: Record<PKind, number> = { bow: 0, xbow: 1, gun: 2 };

interface Ev { k: number; x: number; y: number; a: number; b: number; c: number; d: number; e: number; f: number; from: number; to: number }

/** 单个玩家的下行状态：已发送的单位状态（增量编码）与可见区域 */
export class Viewer {
  lx = new Int32Array(256); ly = new Int32Array(256); lf = new Uint8Array(256); lh = new Uint8Array(256); ls = new Uint8Array(256); lt = new Int32Array(256); known = new Uint8Array(256);
  bytes = 0; frames = 0;
  constructor(public cmd: Cmd) { }
  grow(n: number) {
    if (n < this.lx.length) return;
    let m = this.lx.length; while (m <= n) m *= 2;
    const g = <T extends Int32Array | Uint8Array>(a: T): T => { const b = new (a.constructor as any)(m); b.set(a); return b; };
    this.lx = g(this.lx); this.ly = g(this.ly); this.lf = g(this.lf); this.lh = g(this.lh); this.ls = g(this.ls); this.lt = g(this.lt); this.known = g(this.known);
  }
  reset() { this.known.fill(0); }
}

export class BattleCore {
  F: BattleField; W: number; H: number;
  units: BUnit[] = []; byUid: BUnit[] = [];
  reserves: [Ent[], Ent[]] = [[], []];
  projs: Proj[] = [];
  squads: BSquad[] = [];
  aiSq: [{ inf: BSquad; rng: BSquad; cavs: BSquad[] } | null, { inf: BSquad; rng: BSquad; cavs: BSquad[] } | null] = [null, null];
  cmds = new Map<string, Cmd>();
  parties = new Map<string, PartyIn>();
  initial: [number, number] = [0, 0];
  down: [Casualties, Casualties] = [{}, {}];
  downPid: Record<string, Casualties> = {};
  killsBy: Record<string, number> = {};
  fledPid: Record<string, number> = {};
  elapsed = 0; tick = 0; uidSeq = 1; sqSeq = 1; aiT = 0; reinforceT = 0; statT = 0;
  finished = false; result: CoreResult | null = null;
  baseX: [number, number] = [0, 0];
  grid = new Map<number, BUnit[]>();
  foes: [BUnit[], BUnit[]] = [[], []];
  evs: Ev[] = [];
  out: OutMsg[] = [];
  spawned: BUnit[] = [];
  started = false;
  bandit: [boolean, boolean] = [false, false];
  wr = new Writer(8192);

  constructor(public opts: CoreOpts, initialTotal: number) {
    const cap = Math.max(60, Math.min(1000, opts.cap));
    const size = sizeFor(Math.min(cap, initialTotal), false);
    [this.W, this.H] = FIELD_DIMS[size];
    this.F = new BattleField(this.W, this.H, opts.terrain, opts.seed, null);
    const gap = GAPS[size] ?? 1000;
    this.baseX = [this.W / 2 - gap / 2, this.W / 2 + gap / 2];
  }

  /** 开场时的布阵信息（发给每个加入的玩家） */
  initMsg(acct: string) {
    const c = this.cmds.get(acct);
    return {
      W: this.W, H: this.H, seed: this.opts.seed, terrain: this.opts.terrain, night: this.opts.night,
      side: c?.side ?? 0, pid: c?.pid ?? '', hero: c?.hero?.uid ?? 0, cs: c?.corrSeq ?? 0, hx: c?.hero?.x ?? 0, hy: c?.hero?.y ?? 0, hammo: c?.hero?.ammo ?? 0,
      parties: [...this.parties.values()].map(p => ({ pid: p.pid, name: p.name, side: p.side, faction: p.faction, acct: p.acct ?? null, online: !!(p.acct && this.cmds.get(p.acct)?.online), look: p.hero?.look ?? null, god: p.god?.aura ? 1 : 0 })),
      sq: c ? (['inf', 'rng', 'cav'] as Group[]).map(g => [g, c.sq[g].order, c.sq[g].form, c.sq[g].ax, c.sq[g].ay]) : [],
      units: this.units.filter(u => !u.dead && !u.fled).map(u => this.spawnInfo(u)),
      t: Math.round(this.elapsed * 1000), tick: this.tick,
    };
  }
  spawnInfo(u: BUnit) {
    return [u.uid, u.side, u.pid, u.troop ?? '', u.comp ?? '', Math.round(u.x), Math.round(u.y), (u.hero ? 1 : 0) | (u.mounted ? 2 : 0) | (u.rng > 0 ? 4 : 0), Math.round(u.maxHp), u.god, u.hero ? u.name : '', Math.round(u.range), u.ammo];
  }

  // ---------- 布阵 ----------
  /** 开战前加入的各部（一次性布阵） */
  start(parts: PartyIn[]) {
    const ents: [Ent[], Ent[]] = [[], []];
    const blocks: [PartyIn[], PartyIn[]] = [[], []];
    for (const p of parts) {
      this.parties.set(p.pid, p);
      if (p.bandit) this.bandit[p.side] = true;
      const cmd = p.acct && p.hero ? this.makeCmd(p) : null;
      ents[p.side].push(...this.expand(p, cmd));
      if (cmd) blocks[p.side].push(p);
      this.initial[p.side] += this.healthyOf(p.stacks) + (p.hero ? 1 : 0) + (p.comps?.length ?? 0);
    }
    for (const s of [0, 1] as const) ents[s].sort((a, b) => a.k - b.k);
    // 两方的上场名额
    const cap = Math.max(60, Math.min(1000, this.opts.cap));
    const heroes = [0, 1].map(s => parts.filter(p => p.side === s).reduce((n, p) => n + (p.hero ? 1 + (p.comps?.length ?? 0) : 0), 0));
    const n0 = ents[0].length + heroes[0], n1 = ents[1].length + heroes[1];
    const cap0 = Math.min(n0, Math.max(Math.round(cap * Math.max(0.3, Math.min(0.7, n0 / Math.max(1, n0 + n1)))), cap - n1));
    const cap1 = Math.min(n1, cap - cap0);
    const caps = [Math.max(0, cap0 - heroes[0]), Math.max(0, cap1 - heroes[1])];
    // 编队：每名玩家一个“营”，AI 各部合为一营；按营在本方阵线上下错开
    for (const side of [0, 1] as const) {
      const hasAI = parts.some(p => p.side === side && !(p.acct && p.hero));
      const humans = blocks[side];
      const slots = humans.length + (hasAI ? 1 : 0);
      const H = this.H;
      const spacing = Math.min(300, (H * 0.7) / Math.max(1, slots));
      const oyOf = (i: number) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * spacing);
      let i = 0;
      for (const p of humans) { const c = this.cmds.get(p.acct!)!; this.placeCmdSquads(c, oyOf(i++)); }
      if (hasAI) this.makeAiSquads(side, oyOf(i++), humans.length > 0);
    }
    for (const side of [0, 1] as const) {
      const field = ents[side].slice(0, caps[side]);
      this.reserves[side] = ents[side].slice(field.length);
      for (const e of field) this.addUnit(this.makeUnit(side, e.id, e.pid, e.cmd));
    }
    for (const c of this.cmds.values()) this.spawnHeroAndComps(c, false);
    for (const sq of this.squads) { this.faceEnemy(sq); this.computeSlots(sq); for (const u of sq.members) { u.x = u.slotX + (Math.random() - 0.5) * 3; u.y = u.slotY + (Math.random() - 0.5) * 3; } }
    for (const c of this.cmds.values()) if (c.hero) { const inf = c.sq.inf; c.hero.x = inf.ax + (c.side === 0 ? -50 : 50); c.hero.y = inf.ay; c.hero.face = c.side === 0 ? 0 : Math.PI; }
    for (const u of this.units) { const [x, y] = this.F.nearestFree(u.x, u.y); u.x = x; u.y = y; }
    for (const sq of this.squads) sq.members.sort((a, b) => a.uid - b.uid);
    this.spawned = [];
    this.started = true;
  }

  /** 战斗进行中有人加入：英雄与先头部队从本方战场边缘赶到，其余进入预备队 */
  join(p: PartyIn) {
    if (this.parties.has(p.pid)) return false;
    this.parties.set(p.pid, p);
    if (p.bandit) this.bandit[p.side] = true;
    const cmd = p.acct && p.hero ? this.makeCmd(p) : null;
    const ents = this.expand(p, cmd);
    this.initial[p.side] += ents.length + (p.hero ? 1 : 0) + (p.comps?.length ?? 0);
    const [ex, ey] = this.spawnPoint(p.side);
    if (cmd) {
      const dir = p.side === 0 ? 1 : -1;
      const mk = (g: Group, dx: number, dy: number) => this.newSquad(p.side, g, null, ex + dir * dx, ey + dy);
      cmd.sq = { inf: mk('inf', 60, 0), rng: mk('rng', 130, 0), cav: mk('cav', 20, 120) };
      for (const g of ['inf', 'rng', 'cav'] as Group[]) cmd.sq[g].owner = cmd;
      cmd.sq.cav.form = 'wedge';
      this.spawnHeroAndComps(cmd, true, ex, ey);
    } else if (!this.aiSq[p.side]) this.makeAiSquads(p.side, ey - this.H / 2, true);
    // 先头部队：按本方剩余名额立即上场
    const cap = Math.max(60, Math.min(1000, this.opts.cap));
    const alive = this.units.filter(u => u.side === p.side && !u.dead && !u.fled).length;
    const room = Math.max(0, Math.min(ents.length, Math.round(cap * 0.5 * 1.15) - alive, 80));
    for (let i = 0; i < room; i++) {
      const e = ents[i];
      const u = this.makeUnit(p.side, e.id, e.pid, e.cmd);
      const [sx, sy] = this.F.nearestFree(ex + (Math.random() - 0.5) * 80, ey + (Math.random() - 0.5) * 160);
      u.x = sx; u.y = sy;
      this.addUnit(u);
    }
    // 其余按比例插入预备队
    const res = this.reserves[p.side];
    for (let i = room; i < ents.length; i++) res.splice(Math.floor(Math.random() * (res.length + 1)), 0, ents[i]);
    for (const sq of this.squads) if (sq.side === p.side) { if (cmd && sq.owner === cmd) this.faceEnemy(sq); this.computeSlots(sq); }
    this.say(null, `${p.name}率部${cmd ? '' : ''}加入了战斗（${ents.length + (p.hero ? 1 : 0)} 人）！`);
    return true;
  }

  makeCmd(p: PartyIn): Cmd {
    const c: Cmd = {
      acct: p.acct!, pid: p.pid, side: p.side, name: p.name, hero: null, sq: null as unknown as Record<Group, BSquad>,
      online: !!p.online, left: false, god: p.god ?? null, morale: p.morale ?? 70, leadership: p.leadership ?? 0,
      inp: null, lastAtk: -1, lastFire: -1, budget: 0, corr: false, corrSeq: 0, corrT: 0, heroDown: false, compDown: [],
      view: { x: 0, y: 0, w: 1400, h: 900 }, viewer: null, offlineT: 0,
    };
    c.viewer = new Viewer(c);
    this.cmds.set(c.acct, c);
    return c;
  }
  placeCmdSquads(c: Cmd, oy: number) {
    const side = c.side, dir = side === 0 ? 1 : -1, bx = this.baseX[side], cy = this.H / 2 + oy;
    const inf = this.newSquad(side, 'inf', c, bx, cy);
    const rng = this.newSquad(side, 'rng', c, bx + dir * 70, cy);
    const cav = this.newSquad(side, 'cav', c, bx - dir * 40, cy + (oy < 0 ? -1 : 1) * Math.min(260, this.H * 0.18));
    cav.form = 'wedge';
    c.sq = { inf, rng, cav };
  }
  makeAiSquads(side: 0 | 1, oy: number, withHumans: boolean) {
    const dir = side === 0 ? 1 : -1, bx = this.baseX[side] - (withHumans ? dir * 140 : 0), cy = this.H / 2;
    let ix = bx, iy = cy + oy;
    const hill = this.F.hills.filter(h => Math.abs(h.x - bx) < this.W * 0.2 && h.h > 18 && Math.abs(h.y - iy) < this.H * 0.25).sort((a, b) => b.h - a.h)[0];
    if (hill && !withHumans) { ix = hill.x; iy = hill.y; }
    const inf = this.newSquad(side, 'inf', null, ix, iy);
    const rng = this.newSquad(side, 'rng', null, ix + dir * 70, iy);
    const cavs = [this.newSquad(side, 'cav', null, bx - dir * 50, cy - 300 + oy), this.newSquad(side, 'cav', null, bx - dir * 50, cy + 300 + oy)];
    cavs[0].flank = -1; cavs[1].flank = 1;
    inf.form = Math.random() < 0.4 ? 'block' : 'line';
    this.aiSq[side] = { inf, rng, cavs };
  }
  newSquad(side: 0 | 1, g: Group, owner: Cmd | null, ax: number, ay: number): BSquad {
    const sq: BSquad = { id: this.sqSeq++, side, ai: !owner, owner, g, order: 'hold', form: g === 'cav' ? 'wedge' : 'line', ax, ay, face: side === 0 ? 0 : Math.PI, members: [], phase: 0 };
    const [fx, fy] = this.F.nearestFree(Math.max(30, Math.min(this.W - 30, ax)), Math.max(30, Math.min(this.H - 30, ay))); sq.ax = fx; sq.ay = fy;
    this.squads.push(sq);
    return sq;
  }
  healthyOf(st: Stack[]) { let n = 0; for (const s of st) n += Math.max(0, s.n - s.w); return n; }
  expand(p: PartyIn, cmd: Cmd | null): Ent[] {
    const ids: Ent[] = [];
    const total = this.healthyOf(p.stacks);
    let i = 0;
    for (const s of p.stacks) { if (!TROOPS[s.id]) continue; for (let k = 0; k < s.n - s.w; k++) { ids.push({ id: s.id, pid: p.pid, k: (i + 0.5) / Math.max(1, total), cmd }); i++; } }
    return ids;
  }
  squadFor(u: BUnit): BSquad {
    if (u.cmd && !u.cmd.left) return u.cmd.sq[u.group];
    let s = this.aiSq[u.side];
    if (!s) { this.makeAiSquads(u.side, 0, true); s = this.aiSq[u.side]!; }
    return u.group === 'cav' ? s.cavs[u.uid % s.cavs.length] : s[u.group];
  }
  addUnit(u: BUnit) {
    u.sq = this.squadFor(u); u.sq.members.push(u);
    this.units.push(u); this.byUid[u.uid] = u;
    if (this.started) this.spawned.push(u);
  }
  godBits(g: GodFx | null | undefined) { return g ? (g.buff ? 1 : 0) | (g.inv ? 2 : 0) | (g.oneHit ? 4 : 0) | (g.aura ? 8 : 0) : 0; }

  makeUnit(side: 0 | 1, troop: string, pid: string, cmd: Cmd | null): BUnit {
    const t = TROOPS[troop];
    const ranged = isRanged(t.cls);
    const kind: PKind | null = t.cls === 'arc' || t.cls === 'hca' ? 'bow' : t.cls === 'xbow' ? 'xbow' : t.cls === 'gun' ? 'gun' : null;
    const speed = t.mounted ? (t.cls === 'hca' ? 165 : 175) : t.cls === 'spear' ? 76 : t.cls === 'gun' ? 76 : 82;
    const u: BUnit = {
      uid: this.uidSeq++, side, troop, comp: null, name: t.name, pid, cmd, x: 0, y: 0, vx: 0, vy: 0, face: side ? Math.PI : 0,
      hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, skill: t.skill, speed, mounted: t.mounted, cls: t.cls,
      reach: t.cls === 'spear' ? 34 : t.mounted ? 28 : 24, antiCav: t.cls === 'spear',
      rng: t.rng ?? 0, range: kind === 'gun' ? 240 : kind === 'xbow' ? 260 : t.cls === 'hca' ? 230 : 275,
      reload: kind === 'gun' ? 4.5 : kind === 'xbow' ? 3 : t.cls === 'hca' ? 2.1 : 1.8, ammo: ranged ? t.ammo ?? 15 : 0, kind,
      cd: Math.random(), rcd: Math.random() * 1.5, target: null, retarget: 0,
      group: t.mounted ? 'cav' : ranged ? 'rng' : 'inf', dead: false, routed: false, fled: false, hero: false,
      disengage: 0, r: t.mounted ? 9 : 6, swing: 0, hitFlash: 0,
      sq: null as unknown as BSquad, slotX: 0, slotY: 0, god: this.godBits(cmd?.god ?? this.parties.get(pid)?.god), meleeSpeed: 1,
    };
    if (this.opts.night) u.range *= 0.9;
    if (u.god & 1) { u.speed *= cmd?.god?.speed ?? this.parties.get(pid)?.god?.speed ?? 1; u.ammo = Math.max(u.ammo, ranged ? 999 : 0); }
    return u;
  }

  spawnHeroAndComps(c: Cmd, late: boolean, ex = 0, ey = 0) {
    const p = this.parties.get(c.pid)!;
    const h = p.hero!;
    const god = this.godBits(c.god);
    const base = { cd: 0, rcd: 0, target: null, retarget: 0, dead: false, routed: false, fled: false, disengage: 0, swing: 0, hitFlash: 0, slotX: 0, slotY: 0, vx: 0, vy: 0, cmd: c, pid: c.pid, side: c.side, troop: null, god };
    const hu: BUnit = {
      ...base, uid: this.uidSeq++, comp: null, name: h.name, x: late ? ex : 0, y: late ? ey : 0, face: c.side ? Math.PI : 0,
      hp: Math.max(h.maxHp * 0.3, h.hp), maxHp: h.maxHp, atk: h.atk, def: h.def, skill: h.skill, speed: h.speed, mounted: h.mounted, cls: h.mounted ? 'cav' : 'inf',
      reach: h.reach, antiCav: h.antiCav, rng: h.rng, range: h.range * (this.opts.night ? 0.8 : 1), reload: h.reload, ammo: h.ammo, kind: h.kind,
      group: 'inf', hero: true, r: h.mounted ? 9 : 7, sq: c.sq.inf, meleeSpeed: h.meleeSpeed,
    };
    if (god & 1) { hu.speed *= c.god?.speed ?? 1; if (hu.rng) hu.ammo = 999; }
    c.hero = hu; this.units.push(hu); this.byUid[hu.uid] = hu;
    if (this.started) this.spawned.push(hu);
    for (const cp of p.comps ?? []) {
      const g: Group = cp.mounted ? 'cav' : cp.rng ? 'rng' : 'inf';
      const u: BUnit = {
        ...base, uid: this.uidSeq++, comp: cp.id, name: cp.name, x: late ? ex : 0, y: late ? ey + 20 : 0, face: c.side ? Math.PI : 0,
        hp: cp.hp, maxHp: cp.hp, atk: cp.atk, def: cp.def, skill: cp.skill, speed: cp.mounted ? 170 : 88, mounted: cp.mounted, cls: cp.rng ? (cp.mounted ? 'hca' : 'arc') : cp.mounted ? 'cav' : 'inf',
        reach: 28, antiCav: false, rng: cp.rng, range: cp.rng ? 270 : 0, reload: 1.8, ammo: cp.rng ? 40 : 0, kind: cp.kind,
        group: g, hero: false, r: cp.mounted ? 9 : 7, sq: c.sq[g], meleeSpeed: 1,
      };
      if (god & 1) u.speed *= c.god?.speed ?? 1;
      c.sq[g].members.push(u);
      this.units.push(u); this.byUid[u.uid] = u;
      if (this.started) this.spawned.push(u);
    }
  }

  faceEnemy(sq: BSquad) {
    const e = this.centroid(this.units.filter(u => u.side !== sq.side && !u.dead));
    if (e) sq.face = Math.atan2(e.y - sq.ay, e.x - sq.ax);
    const base = sq.side === 0 ? 0 : Math.PI;
    let d = sq.face - base; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    sq.face = base + Math.max(-0.7, Math.min(0.7, d));
  }
  centroid(us: { x: number; y: number }[]) {
    if (!us.length) return null;
    let x = 0, y = 0; for (const u of us) { x += u.x; y += u.y; }
    return { x: x / us.length, y: y / us.length };
  }
  computeSlots(sq: BSquad) {
    const ms = sq.members.filter(u => !u.dead && !u.fled && !u.routed);
    const n = ms.length; if (!n) return;
    let sp = sq.g === 'cav' ? 24 : sq.g === 'rng' ? 16 : 15;
    if (sq.form === 'loose') sp *= 2;
    const cos = Math.cos(sq.face), sin = Math.sin(sq.face);
    const put = (u: BUnit, fwd: number, side: number) => { u.slotX = sq.ax + cos * fwd - sin * side; u.slotY = sq.ay + sin * fwd + cos * side; };
    if (sq.form === 'wedge') {
      let i = 0;
      for (let k = 0; i < n; k++) for (let j = 0; j <= 2 * k && i < n; j++, i++) put(ms[i], -k * sp, (j - k) * sp * 0.9);
      return;
    }
    const ranks = sq.form === 'block' ? Math.max(1, Math.round(Math.sqrt(n / 1.6))) : sq.g === 'inf' ? 3 : 2;
    const cols = Math.ceil(n / ranks);
    ms.forEach((u, i) => {
      const r = Math.floor(i / cols), c = i % cols, rowCount = Math.min(cols, n - r * cols);
      put(u, -r * sp * 1.1, (c - (rowCount - 1) / 2) * sp + (r % 2 ? sp * 0.3 : 0));
    });
  }

  // ---------- 玩家指令 ----------
  order(acct: string, gs: Group[], o: Order) {
    const c = this.cmds.get(acct); if (!c || c.left || this.finished) return;
    const ref = c.hero && !c.hero.dead ? c.hero : null;
    for (const g of gs) {
      const sq = c.sq[g]; if (!sq) continue;
      sq.order = o;
      if (o === 'hold') {
        const us = sq.members.filter(u => !u.dead);
        if (ref) { const back = Math.cos(ref.face) < 0 ? 1 : -1; sq.ax = ref.x + (g === 'rng' ? 30 : g === 'cav' ? 60 : -30) * -back; sq.ay = ref.y + (g === 'cav' ? 120 : 0); }
        else { const ct = this.centroid(us); if (ct) { sq.ax = ct.x; sq.ay = ct.y; } }
        [sq.ax, sq.ay] = this.F.nearestFree(Math.max(20, Math.min(this.W - 20, sq.ax)), Math.max(20, Math.min(this.H - 20, sq.ay)));
        this.faceEnemy(sq); this.computeSlots(sq);
      }
      if (o === 'advance') { this.faceEnemy(sq); this.computeSlots(sq); }
    }
  }
  moveOrder(acct: string, gs: Group[], x: number, y: number) {
    const c = this.cmds.get(acct); if (!c || c.left || this.finished) return;
    x = Math.max(10, Math.min(this.W - 10, +x || 0)); y = Math.max(10, Math.min(this.H - 10, +y || 0));
    const ct = this.centroid(gs.map(g => c.sq[g]).map(s => ({ x: s.ax, y: s.ay })));
    for (const g of gs) {
      const sq = c.sq[g];
      const ox = gs.length > 1 && ct ? sq.ax - ct.x : 0, oy = gs.length > 1 && ct ? sq.ay - ct.y : 0;
      const [fx, fy] = this.F.nearestFree(Math.max(10, Math.min(this.W - 10, x + ox)), Math.max(10, Math.min(this.H - 10, y + oy)));
      sq.ax = fx; sq.ay = fy; sq.order = 'hold';
      this.faceEnemy(sq); this.computeSlots(sq);
    }
  }
  setForm(acct: string, g: Group, f: Form) {
    const c = this.cmds.get(acct); if (!c || c.left || !c.sq[g] || !['line', 'block', 'wedge', 'loose'].includes(f)) return;
    c.sq[g].form = f; this.computeSlots(c.sq[g]);
  }
  input(acct: string, inp: HeroInput) {
    const c = this.cmds.get(acct); if (!c || c.left) return;
    c.inp = inp;
  }
  setView(acct: string, x: number, y: number, w: number, h: number) {
    const c = this.cmds.get(acct); if (!c) return;
    c.view = { x: +x || 0, y: +y || 0, w: Math.max(200, Math.min(6000, +w || 1400)), h: Math.max(200, Math.min(4000, +h || 900)) };
  }
  setOnline(acct: string, on: boolean) {
    const c = this.cmds.get(acct); if (!c || c.left) return;
    c.online = on; c.offlineT = 0; c.inp = null;
    if (on) { c.viewer?.reset(); c.budget = 0; c.lastAtk = -1; c.lastFire = -1; }
    for (const g of ['inf', 'rng', 'cav'] as Group[]) c.sq[g].ai = !on;
    if (!on) this.say(null, `${c.name}断线了，所部由副将代为指挥。`, c.side);
    else this.say(null, `${c.name}重返战场！`, c.side);
  }
  /** 玩家撤出战场：所部（含预备队）离场，场上的兵约 15% 在撤退中倒下 */
  retreat(acct: string): CmdResult | null {
    const c = this.cmds.get(acct); if (!c || c.left) return null;
    c.left = true;
    for (const u of this.units) {
      if (u.cmd !== c || u.dead || u.fled) continue;
      if (u.troop && Math.random() < 0.15) this.addDown(u);
      u.fled = true;
    }
    for (const side of [0, 1] as const) this.reserves[side] = this.reserves[side].filter(e => e.cmd !== c);
    if (c.hero && !c.hero.dead) c.hero.fled = true;
    this.say(null, `${c.name}率部撤出了战场。`);
    return this.cmdResult(c, true);
  }
  cmdResult(c: Cmd, retreat: boolean): CmdResult {
    return { acct: c.acct, pid: c.pid, side: c.side, down: { ...(this.downPid[c.pid] ?? {}) }, heroDown: c.heroDown, compDown: [...c.compDown], heroHp: c.hero && !c.hero.dead ? c.hero.hp / c.hero.maxHp : 0.15, kills: this.killsBy[c.pid] ?? 0, retreat };
  }
  say(to: string | null, text: string, side?: 0 | 1) {
    if (side === undefined) this.out.push({ to, m: { t: 'bmsg', text } });
    else for (const c of this.cmds.values()) if (c.side === side && !c.left) this.out.push({ to: c.acct, m: { t: 'bmsg', text } });
  }

  // ---------- 模拟 ----------
  step(dt = TICK) {
    if (this.finished) return;
    this.tick++;
    this.elapsed += dt;
    this.aiT -= dt;
    if (this.aiT <= 0) { this.aiT = 0.5; this.thinkSquads(); }
    this.buildGrid();
    for (const c of this.cmds.values()) this.updateHuman(c, dt);
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      if (u.hero && u.cmd && u.cmd.online && !u.cmd.left) continue;
      this.updateUnit(u, dt);
    }
    this.separate();
    this.updateProjs(dt);
    this.updateMorale(dt);
    this.reinforce(dt);
    this.checkEnd();
    for (const c of this.cmds.values()) if (!c.online && !c.left) c.offlineT += dt;
    if (!this.finished && this.elapsed > (this.opts.maxSec ?? 1200)) this.autoFinish();
    this.statT -= dt;
    if (this.statT <= 0) {
      this.statT = 0.5;
      this.out.push({ to: null, m: { t: 'bstat', m: [Math.round(this.sideMorale(0)), Math.round(this.sideMorale(1))], a: [this.activeCount(0), this.activeCount(1)], tm: Math.round(this.elapsed) } });
    }
  }

  buildGrid() {
    const grid = this.grid; grid.clear();
    this.foes = [[], []];
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      if (!u.routed) this.foes[1 - u.side].push(u);
      const k = Math.floor(u.x / 40) * 1000 + Math.floor(u.y / 40);
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u);
    }
  }
  near(x: number, y: number, r: number, fn: (u: BUnit) => void) {
    const grid = this.grid;
    const x0 = Math.floor((x - r) / 40), x1 = Math.floor((x + r) / 40), y0 = Math.floor((y - r) / 40), y1 = Math.floor((y + r) / 40);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const a = grid.get(gx * 1000 + gy); if (a) for (const u of a) fn(u); }
  }
  nearestEnemy(u: BUnit, maxR: number, score?: (o: BUnit, d: number) => number): BUnit | null {
    const grid = this.grid;
    const cx = Math.floor(u.x / 40), cy = Math.floor(u.y / 40);
    const maxRing = Math.min(8, Math.ceil(maxR / 40));
    let best: BUnit | null = null, bd = Infinity, foundRing = -1;
    const R = Math.min(maxR, maxRing * 40);
    for (let ring = 0; ring <= maxRing; ring++) {
      if (foundRing >= 0 && ring > foundRing + 1) break;
      for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gy = cy - ring; gy <= cy + ring; gy++) {
        if (ring && gx !== cx - ring && gx !== cx + ring && gy !== cy - ring && gy !== cy + ring) continue;
        const a = grid.get(gx * 1000 + gy); if (!a) continue;
        for (const o of a) {
          if (o.side === u.side || o.dead || o.fled || o.routed) continue;
          let d = Math.hypot(o.x - u.x, o.y - u.y);
          if (d > R) continue;
          if (score) d = score(o, d);
          if (d < bd) { bd = d; best = o; if (foundRing < 0) foundRing = ring; }
        }
      }
    }
    if (best || maxR <= R) return best;
    for (const o of this.foes[u.side]) {
      let d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > maxR || d <= R) continue;
      if (score) d = score(o, d);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  thinkSquads() {
    for (const sq of this.squads) {
      const alive = sq.members.filter(u => !u.dead && !u.fled && !u.routed);
      if (!alive.length) continue;
      const ai = sq.ai || (sq.owner?.left ?? false);
      if (sq.order === 'advance' || (sq.order === 'hold' && !ai)) {
        if (sq.order === 'advance') {
          const e = this.centroid(this.foes[sq.side]);
          if (e) {
            const d = Math.hypot(e.x - sq.ax, e.y - sq.ay);
            const nearE = alive.some(u => this.nearestEnemy(u, 90));
            if (d < 120 || nearE) { if (ai) sq.order = 'charge'; }
            else { const step = Math.min(d, 26); sq.ax += (e.x - sq.ax) / d * step; sq.ay += (e.y - sq.ay) / d * step; this.faceEnemy(sq); }
          }
        }
        this.computeSlots(sq);
      }
      const h = sq.owner?.hero;
      if (sq.order === 'follow' && h && !h.dead && !h.fled) {
        const f = Math.cos(h.face) < 0 ? Math.PI : 0;
        const back = sq.g === 'rng' ? 70 : sq.g === 'cav' ? 120 : 40;
        sq.ax = h.x - Math.cos(f) * back; sq.ay = h.y + (sq.g === 'cav' ? 60 : 0); sq.face = f;
        this.computeSlots(sq);
      } else if (sq.order === 'follow') sq.order = 'charge';
      if (!ai) continue;
      sq.phase += 0.5;
      const enemies = this.foes[sq.side];
      const ec = this.centroid(enemies); if (!ec) continue;
      const myC = this.centroid(alive)!;
      const dist = Math.hypot(ec.x - myC.x, ec.y - myC.y);
      const myPow = alive.length;
      let eRanged = 0; for (const u of enemies) if (u.rng > 0 && u.ammo > 0) eRanged++;
      const ownSide = this.foes[1 - sq.side].length;
      const ratio = ownSide / Math.max(1, enemies.length);
      if (sq.g === 'rng') {
        const ammoLeft = alive.filter(u => u.ammo > 0).length / alive.length;
        if (ammoLeft < 0.3) sq.order = 'charge';
        else if (sq.order === 'hold' && dist > 520 && sq.phase > 6) sq.order = 'advance';
        else if (sq.order === 'advance' && dist < 340) { sq.order = 'hold'; sq.ax = myC.x; sq.ay = myC.y; this.computeSlots(sq); }
      } else if (sq.g === 'inf') {
        const threat = enemies.some(u => Math.abs(u.x - sq.ax) + Math.abs(u.y - sq.ay) < 450 && Math.hypot(u.x - sq.ax, u.y - sq.ay) < 380);
        if (sq.order === 'hold' && (sq.phase > 14 || threat || ratio > 1.5 || eRanged > myPow * 0.5)) { sq.order = 'advance'; this.faceEnemy(sq); }
        if (sq.order === 'follow') sq.order = 'charge';
      } else {
        const engaged = enemies.some(u => u.swing > 0);
        if (sq.order === 'hold' && (sq.phase > 10 || engaged || dist < 300)) {
          sq.order = 'advance'; sq.prefRanged = true;
          if (sq.flank) { sq.tx = ec.x; sq.ty = Math.max(40, Math.min(this.H - 40, ec.y + sq.flank * this.H * 0.28)); }
        }
        if (sq.order === 'advance' && sq.tx !== undefined) {
          const d = Math.hypot(sq.tx - sq.ax, sq.ty! - sq.ay);
          if (d < 80) sq.order = 'charge';
          else { const step = Math.min(d, 70); sq.ax += (sq.tx - sq.ax) / d * step; sq.ay += (sq.ty! - sq.ay) / d * step; sq.face = Math.atan2(sq.ty! - sq.ay, sq.tx - sq.ax); this.computeSlots(sq); }
          if (alive.some(u => this.nearestEnemy(u, 110))) sq.order = 'charge';
        }
        if (sq.order === 'follow') sq.order = 'charge';
      }
    }
  }

  /** 真人操控的主角：采用客户端上报的位置（限速校验），出招由服务器结算 */
  updateHuman(c: Cmd, dt: number) {
    const h = c.hero;
    if (!h || h.dead || h.fled || c.left || !c.online) return;
    h.cd -= dt; h.rcd -= dt; h.swing -= dt; h.hitFlash -= dt;
    const inp = c.inp;
    c.budget = Math.min(c.budget + h.speed * 1.3 * dt, h.speed * 0.6 + 12);
    if (!inp) { h.vx *= 0.5; h.vy *= 0.5; return; }
    const x0 = h.x, y0 = h.y;
    c.corrT -= dt;
    if ((inp.cs | 0) !== c.corrSeq) { h.vx *= 0.5; h.vy *= 0.5; } else {
    const tx = Math.max(8, Math.min(this.W - 8, +inp.x || 0)), ty = Math.max(8, Math.min(this.H - 8, +inp.y || 0));
    const d = Math.hypot(tx - h.x, ty - h.y);
    if (d > 0.01) {
      if (this.F.blocked(tx, ty)) c.corr = true;
      else if (d <= c.budget + 2) { h.x = tx; h.y = ty; c.budget = Math.max(0, c.budget - d); }
      else {
        const k = c.budget / d; const nx = h.x + (tx - h.x) * k, ny = h.y + (ty - h.y) * k;
        if (!this.F.blocked(nx, ny)) { h.x = nx; h.y = ny; }
        if (d - c.budget > 28) c.corr = true;
        c.budget = 0;
      }
    }
    if (c.corr && c.corrT > 0) c.corr = false; // 纠正过于频繁：等客户端先收到上一次
    if (c.corr) { c.corrSeq = (c.corrSeq + 1) & 0xffff; c.corrT = 0.3; c.inp = { ...inp, x: h.x, y: h.y, cs: c.corrSeq }; this.out.push({ to: c.acct, m: { t: 'bcorr', x: Math.round(h.x * 10) / 10, y: Math.round(h.y * 10) / 10, cs: c.corrSeq } }); c.corr = false; }
    }
    h.vx = (h.x - x0) / dt; h.vy = (h.y - y0) / dt;
    h.face = +inp.face || 0;
    h.ranged = inp.mode === 1 && h.rng > 0;
    h.aiming = !!h.ranged;
    if (inp.atk !== c.lastAtk) {
      c.lastAtk = inp.atk;
      if (h.cd <= 0.12) this.heroSwing(h, +inp.atkA || 0);
    }
    if (inp.fire !== c.lastFire) {
      c.lastFire = inp.fire;
      if (h.rng > 0 && h.ammo > 0 && h.rcd <= 0.15) {
        this.fire(h, +inp.fireA || 0, Math.max(40, Math.min(h.range * 1.2, +inp.fireD || 200)));
        h.rcd = h.reload; h.ammo--; h.firedT = 0.25;
      }
    }
  }
  heroSwing(h: BUnit, aim: number) {
    h.cd = h.meleeSpeed || 0.8; h.swing = SWING;
    const speedNow = Math.hypot(h.vx, h.vy);
    let hits = 0;
    // 网络延迟补偿：对方画面上的敌人比服务器晚约 100ms，命中判定略放宽
    const slack = 8;
    this.near(h.x, h.y, h.reach + 20 + slack, u => {
      if (hits >= 2 || u.side === h.side || u.dead || u.fled) return;
      const d = Math.hypot(u.x - h.x, u.y - h.y);
      if (d > h.reach + u.r + 4 + slack) return;
      let da = Math.abs(Math.atan2(u.y - h.y, u.x - h.x) - aim); if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > 1.0) return;
      const charge = h.mounted && speedNow > h.speed * 0.6 ? 1 + speedNow / h.speed * 0.6 : 1;
      this.damage(h, u, h.atk * charge * (h.antiCav && u.mounted ? 1.4 : 1), 0.95);
      hits++;
    });
  }

  moveUnit(u: BUnit, dx: number, dy: number) {
    const F = this.F;
    let nx = Math.max(8, Math.min(this.W - 8, u.x + dx)), ny = Math.max(8, Math.min(this.H - 8, u.y + dy));
    if (F.blocked(nx, ny)) {
      if (!F.blocked(nx, u.y)) ny = u.y;
      else if (!F.blocked(u.x, ny)) nx = u.x;
      else if (F.blocked(u.x, u.y)) { const [fx, fy] = F.nearestFree(u.x, u.y); nx = u.x + Math.sign(fx - u.x) * Math.min(4, Math.abs(fx - u.x)); ny = u.y + Math.sign(fy - u.y) * Math.min(4, Math.abs(fy - u.y)); }
      else return;
    }
    u.x = nx; u.y = ny;
  }
  waypoint(u: BUnit, tx: number, ty: number): [number, number] {
    const F = this.F;
    if ((u.navT ?? 0) > this.elapsed) {
      if (u.navX === undefined) return [tx, ty];
      if (Math.hypot(u.navX - u.x, u.navY! - u.y) > 6) return [u.navX, u.navY!];
    }
    if (F.clearLine(u.x, u.y, tx, ty)) { u.navT = this.elapsed + 0.25 + Math.random() * 0.15; u.navX = undefined; return [tx, ty]; }
    const nx = F.next(u.x, u.y, tx, ty);
    u.navT = this.elapsed + 0.3 + Math.random() * 0.2;
    if (!nx) { u.navX = tx; u.navY = ty; return [tx, ty]; }
    u.navX = nx[0]; u.navY = nx[1];
    return nx;
  }
  terrainK(u: BUnit) {
    if ((u.terrT ?? 0) > this.elapsed) return u.slopeK ?? 1;
    u.terrT = this.elapsed + 0.3 + Math.random() * 0.1;
    const F = this.F;
    u.hgt = F.heightAt(u.x, u.y);
    const a = u.face, e = 14;
    const s = (F.heightAt(u.x + Math.cos(a) * e, u.y + Math.sin(a) * e) - u.hgt) / e;
    u.slopeK = F.speedAt(u.x, u.y, u.mounted) * (1 - Math.max(-0.1, Math.min(0.38, s * 5)));
    return u.slopeK;
  }
  steer(u: BUnit, tx: number, ty: number, dt: number, mult = 1) {
    [tx, ty] = this.waypoint(u, tx, ty);
    const a = Math.atan2(ty - u.y, tx - u.x);
    const sp = u.speed * mult * this.terrainK(u);
    if (u.mounted) {
      u.vx += (Math.cos(a) * sp - u.vx) * Math.min(1, 2.5 * dt);
      u.vy += (Math.sin(a) * sp - u.vy) * Math.min(1, 2.5 * dt);
    } else { u.vx = Math.cos(a) * sp; u.vy = Math.sin(a) * sp; }
    u.face = Math.atan2(u.vy, u.vx);
    this.moveUnit(u, u.vx * dt, u.vy * dt);
  }
  findTarget(u: BUnit): BUnit | null {
    if (u.rng > 0 && u.ammo > 0) return this.nearestEnemy(u, 3000, (o, d) => d * (o.hero ? 0.9 : 1));
    const pref = u.sq?.prefRanged;
    return this.nearestEnemy(u, 4000, (o, d) => d * (o.hero ? 0.9 : 1) * (pref && o.rng > 0 ? 0.5 : 1));
  }
  orderOf(u: BUnit): Order { return u.sq ? u.sq.order : 'charge'; }

  updateUnit(u: BUnit, dt: number) {
    u.cd -= dt; u.rcd -= dt; u.swing -= dt; u.hitFlash -= dt; if (u.firedT) u.firedT -= dt;
    if (u.routed) {
      const ex = u.side === 0 ? -20 : this.W + 20;
      const [wx, wy] = this.waypoint(u, ex, u.y);
      const a = Math.atan2(wy - u.y, wx - u.x);
      u.face = a; u.vx = Math.cos(a) * u.speed * 1.05; u.vy = Math.sin(a) * u.speed * 1.05;
      this.moveUnit(u, u.vx * dt, u.vy * dt);
      if (u.x <= 12 || u.x >= this.W - 12) { u.fled = true; this.fledPid[u.pid] = (this.fledPid[u.pid] ?? 0) + 1; }
      return;
    }
    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || u.target.dead || u.target.fled || u.target.routed) {
      u.target = this.findTarget(u);
      const td = u.target ? Math.abs(u.target.x - u.x) + Math.abs(u.target.y - u.y) : 9999;
      u.retarget = td > 500 ? 1.1 + Math.random() * 0.8 : 0.4 + Math.random() * 0.4;
    }
    const t = u.target;
    let order = this.orderOf(u);
    if (u.hero) order = 'charge';
    const ranged = u.rng > 0 && u.ammo > 0;
    if (!t) {
      if (order === 'charge' || !u.sq) { u.vx *= 0.8; u.vy *= 0.8; return; }
      if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 8) this.steer(u, u.slotX, u.slotY, dt, 0.8); else { u.vx = u.vy = 0; u.face = u.sq.face; }
      return;
    }
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    u.aiming = false;
    if (ranged) {
      const hb = Math.max(-0.1, Math.min(0.3, ((u.hgt ?? 0) - (t.hgt ?? 0)) / 80));
      const range = u.range * (1 + hb);
      if (d < range && d > 40) {
        u.aiming = u.cls !== 'hca' || Math.hypot(u.vx, u.vy) < 30;
        if (u.rcd <= 0) {
          const lead = d / (u.kind === 'gun' ? 900 : 520);
          const ax = t.x + t.vx * lead, ay = t.y + t.vy * lead;
          const spread = Math.max(0.025, 0.13 - u.skill * 0.008) + (this.opts.night ? 0.04 : 0);
          this.fire(u, Math.atan2(ay - u.y, ax - u.x) + (Math.random() - 0.5) * spread * 2, d);
          u.rcd = u.reload * (0.85 + Math.random() * 0.3); u.ammo--; u.firedT = 0.25;
        }
        u.face = Math.atan2(t.y - u.y, t.x - u.x);
        if (u.cls === 'hca' && d < 150) {
          const a = Math.atan2(u.y - t.y, u.x - t.x) + 0.6;
          this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, dt);
        } else if (u.cls === 'hca' && order === 'charge') {
          this.steer(u, t.x, t.y, dt, 0.5);
          if (d < 200) { u.vx *= 0.3; u.vy *= 0.3; }
        } else { u.vx *= 0.8; u.vy *= 0.8; }
        return;
      }
      if (order !== 'charge' && order !== 'follow') {
        if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 10) this.steer(u, u.slotX, u.slotY, dt, 0.8); else { u.vx = u.vy = 0; u.face = Math.atan2(t.y - u.y, t.x - u.x); }
        return;
      }
    }
    const reach = u.reach + t.r;
    if (d < reach + 2 && u.disengage <= 0) {
      u.face = Math.atan2(t.y - u.y, t.x - u.x);
      this.meleeHit(u, t);
      if (!u.mounted) { u.vx *= 0.5; u.vy *= 0.5; return; }
    }
    if (u.disengage > 0) {
      u.disengage -= dt;
      const a = Math.atan2(u.vy, u.vx) || u.face;
      this.steer(u, u.x + Math.cos(a) * 120, u.y + Math.sin(a) * 120, dt);
      return;
    }
    const fh = u.sq?.owner?.hero;
    if (order === 'charge' || ranged) this.steer(u, t.x, t.y, dt);
    else if (order === 'follow' && fh && !fh.dead) {
      if (d < 70) this.steer(u, t.x, t.y, dt);
      else if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 14) this.steer(u, u.slotX, u.slotY, dt); else { u.vx *= 0.7; u.vy *= 0.7; }
    } else {
      const engage = order === 'advance' ? 110 : u.sq.form === 'block' ? 55 : 75;
      const sd = Math.hypot(u.slotX - u.x, u.slotY - u.y);
      if (d < engage && sd < 140) this.steer(u, t.x, t.y, dt);
      else if (sd > 6) this.steer(u, u.slotX, u.slotY, dt, order === 'advance' ? 0.6 : 0.8);
      else { u.vx = u.vy = 0; u.face = Math.atan2(t.y - u.y, t.x - u.x); }
    }
    u.inForm = (order === 'hold' || order === 'advance') && Math.hypot(u.slotX - u.x, u.slotY - u.y) < 16;
  }
  meleeHit(u: BUnit, t: BUnit) {
    if (u.cd > 0) return;
    const speedNow = Math.hypot(u.vx, u.vy);
    let dmg = u.atk;
    if (u.mounted && speedNow > u.speed * 0.55) dmg *= u.sq?.form === 'wedge' ? 1.95 : 1.7;
    if (u.antiCav && t.mounted) dmg *= 1.5;
    if (u.mounted && t.antiCav && !(u.god & 2)) u.hp -= 2;
    if (u.sq?.form === 'wedge' && !u.mounted) dmg *= 1.08;
    dmg *= 1 + Math.max(-0.15, Math.min(0.2, ((u.hgt ?? 0) - (t.hgt ?? 0)) / 60));
    this.damage(u, t, dmg, 0.55 + (u.skill - t.skill) * 0.025);
    u.cd = (u.hero ? u.meleeSpeed || 0.8 : u.mounted ? 1.1 : 1.15) + Math.random() * 0.35;
    u.swing = SWING;
    if (u.mounted && u.cls === 'cav' && !u.hero) u.disengage = 1.2 + Math.random() * 0.6;
  }
  separate() {
    const grid = this.grid;
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      if (u.hero && u.cmd?.online && !u.cmd.left) continue; // 真人主角的碰撞在客户端处理
      const x0 = Math.floor((u.x - 20) / 40), x1 = Math.floor((u.x + 20) / 40), y0 = Math.floor((u.y - 20) / 40), y1 = Math.floor((u.y + 20) / 40);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const a = grid.get(gx * 1000 + gy); if (!a) continue;
        for (let k = 0; k < a.length; k++) {
          const o = a[k];
          if (o === u || o.dead) continue;
          const dx = u.x - o.x, dy = u.y - o.y;
          const md = u.r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 < md * md && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = (md - d) * (u.hero ? 0.25 : 0.5) * (o.mounted && !u.mounted ? 1.4 : 1);
            this.moveUnit(u, (dx / d) * push, (dy / d) * push);
          }
        }
      }
    }
  }
  fire(u: BUnit, a: number, dist = 200) {
    const kind = u.kind ?? 'bow';
    const sp = kind === 'gun' ? 900 : kind === 'xbow' ? 620 : 520;
    const dd = Math.max(40, Math.min(dist, u.range * 1.2));
    const p: Proj = { x: u.x + Math.cos(a) * 10, y: u.y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: u.rng, side: u.side, life: (u.range * 1.4) / sp, kind, from: u, sx: u.x, sy: u.y, dist: dd };
    this.projs.push(p);
    this.evs.push({ k: EV_SHOT, x: u.x, y: u.y, a, b: dd, c: KIND_N[kind], d: u.range, e: u.mounted ? 1 : 0, f: 0, from: u.uid, to: 0 });
  }
  updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      const steps = p.kind === 'gun' ? 3 : 2;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        p.x += (p.vx * dt) / steps; p.y += (p.vy * dt) / steps;
        const trav = Math.hypot(p.x - p.sx, p.y - p.sy);
        if (p.kind === 'bow' && trav < p.dist * 0.7) continue;
        this.near(p.x, p.y, 12, u => {
          if (hit || u.side === p.side || u.dead || u.fled) return;
          if (Math.hypot(u.x - p.x, u.y - p.y) < u.r + 2) {
            hit = true;
            if (this.F.inWood(u.x, u.y) && Math.random() < 0.3) return;
            if (u.sq?.form === 'loose' && u.inForm && Math.random() < 0.3) return;
            const ap = p.kind === 'gun' ? 0.2 : p.kind === 'xbow' ? 0.35 : 0.5;
            this.damage(p.from, u, p.dmg * (0.85 + Math.random() * 0.3), 1, ap, p.kind === 'gun' ? 2 : 1);
          }
        });
      }
      p.life -= dt;
      if (!hit && p.kind !== 'gun' && Math.hypot(p.x - p.sx, p.y - p.sy) > p.dist * 1.08) { this.projs.splice(i, 1); continue; }
      if (hit || p.life <= 0 || p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) this.projs.splice(i, 1);
    }
  }
  /** src：0 近战 1 箭 2 铳 */
  damage(a: BUnit, t: BUnit, raw: number, hitChance: number, armorFactor = 0.45, src = 0) {
    if (t.dead || t.fled) return;
    if (t.god & 2) { t.hp = t.maxHp; this.hitEv(t, a, 0, GOD_BLOCK); return; }
    if (a.god & 1) { raw = raw * 2.2 + 12; hitChance += 0.3; armorFactor *= 0.4; }
    if (a.god & 4) { raw = t.maxHp * 4 + t.def * 2; hitChance = 9; }
    if (src === 0 && t.inForm && t.sq?.form === 'block') { if (a.mounted) raw *= 0.72; hitChance -= 0.06; }
    if (Math.random() > Math.max(0.15, Math.min(0.95, hitChance))) { this.hitEv(t, a, 0, src === 0 ? BLOCK_MELEE : BLOCK_ARROW); return; }
    const dmg = Math.max(2, raw * (0.8 + Math.random() * 0.4) - t.def * armorFactor);
    t.hp -= dmg; t.hitFlash = 0.12;
    if (t.mounted && !t.hero) { t.vx *= 0.6; t.vy *= 0.6; }
    this.hitEv(t, a, dmg, src === 0 ? HIT_MELEE : src === 1 ? HIT_ARROW : HIT_BULLET);
    if (t.hp <= 0) this.kill(t, a);
  }
  hitEv(t: BUnit, a: BUnit, dmg: number, kind: number) {
    this.evs.push({ k: EV_HIT, x: t.x, y: t.y, a: 0, b: dmg, c: kind, d: 0, e: 0, f: 0, from: a.uid, to: t.uid });
  }
  addDown(u: BUnit) {
    if (!u.troop) return;
    const sd = this.down[u.side]; sd[u.troop] = (sd[u.troop] || 0) + 1;
    const pd = this.downPid[u.pid] ||= {}; pd[u.troop] = (pd[u.troop] || 0) + 1;
  }
  kill(u: BUnit, by: BUnit | null) {
    if (u.dead) return;
    if (u.god & 2) { u.hp = u.maxHp; return; }
    u.dead = true; u.hp = 0;
    this.addDown(u);
    if (by) this.killsBy[by.pid] = (this.killsBy[by.pid] ?? 0) + 1;
    const c = u.cmd;
    if (u.comp && c) { c.compDown.push(u.comp); this.say(c.acct, `${u.name}负伤倒地！`); }
    if (u.hero && c) {
      c.heroDown = true;
      this.say(c.acct, '你被击倒了！部下们继续作战……');
      this.say(null, `${c.name}被${by?.hero ? by.name : '乱军'}击倒了！`);
    }
    if (by?.hero && by.cmd && (u.troop || u.hero)) this.say(by.cmd.acct, `你击倒了${u.name}。`);
  }
  sideMorale(side: 0 | 1) {
    const init = this.initial[side];
    let lost = 0; for (const k in this.down[side]) lost += this.down[side][k];
    let bonus = 0, humans = false;
    for (const c of this.cmds.values()) if (c.side === side && !c.left) {
      humans = true;
      lost += c.compDown.length + (c.heroDown ? 3 : 0);
      bonus = Math.max(bonus, (c.morale - 50) * 0.4 + c.leadership * 3);
    }
    let m = 100 - (lost / Math.max(1, init)) * 140 + bonus;
    if (!humans && this.bandit[side]) m -= 10;
    return m;
  }
  updateMorale(dt: number) {
    for (const side of [0, 1] as const) {
      const m = this.sideMorale(side);
      if (m > 40) continue;
      for (const u of this.units) {
        if (u.side !== side || u.dead || u.routed || u.fled || u.hero || u.comp || (u.god & 2)) continue;
        const p = (m < 10 ? 0.25 : m < 25 ? 0.06 : 0.015) * (u.hp / u.maxHp < 0.5 ? 2 : 1) * dt;
        if (Math.random() < p) { u.routed = true; u.target = null; }
      }
    }
  }
  spawnPoint(side: 0 | 1): [number, number] {
    const x = side === 0 ? 24 + Math.random() * 30 : this.W - 24 - Math.random() * 30;
    const y = this.H / 2 + (Math.random() - 0.5) * this.H * 0.5;
    return this.F.nearestFree(x, y);
  }
  reinforce(dt: number) {
    this.reinforceT -= dt;
    if (this.reinforceT > 0) return;
    this.reinforceT = 2.5;
    const cap = Math.max(60, Math.min(1000, this.opts.cap));
    for (const side of [0, 1] as const) {
      const res = this.reserves[side];
      if (!res.length) continue;
      let alive = 0; for (const u of this.units) if (u.side === side && !u.dead && !u.fled) alive++;
      const capSide = Math.round(cap * 0.5 * 1.15);
      if (alive >= capSide * 0.8) continue;
      const n = Math.min(16, capSide - alive);
      let spawned = 0;
      const byCmd = new Map<Cmd | null, number>();
      for (let i = 0; i < n && res.length; i++) {
        const e = res.shift()!;
        if (e.cmd?.left) { i--; continue; }
        const u = this.makeUnit(side, e.id, e.pid, e.cmd);
        [u.x, u.y] = this.spawnPoint(side);
        this.addUnit(u);
        spawned++; byCmd.set(e.cmd, (byCmd.get(e.cmd) ?? 0) + 1);
      }
      if (spawned) {
        for (const c of this.cmds.values()) {
          if (c.left) continue;
          const mine = byCmd.get(c) ?? 0;
          if (c.side === side) this.say(c.acct, mine ? `我军 ${mine} 名援兵赶到。` : `友军 ${spawned} 人赶到战场。`);
          else this.say(c.acct, `敌军 ${spawned} 名援兵赶到！`);
        }
        for (const sq of this.squads) if (sq.side === side) this.computeSlots(sq);
      }
    }
  }
  activeCount(side: 0 | 1) {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.routed && !u.fled) n++;
    return n + this.reserves[side].length;
  }
  checkEnd() {
    if (!this.started) return;
    const a = this.activeCount(0), b = this.activeCount(1);
    if (b === 0 && a === 0) this.finish(-1);
    else if (b === 0) this.finish(0);
    else if (a === 0) this.finish(1);
  }
  finish(winner: 0 | 1 | -1, auto = false) {
    if (this.finished) return;
    this.finished = true;
    if (winner >= 0) {
      // 败方溃散者部分被俘/击倒
      for (const u of this.units) if (u.side !== winner && !u.dead && u.troop && !(u.cmd?.left) && Math.random() < 0.3) this.addDown(u);
    }
    const cmds: CmdResult[] = [];
    for (const c of this.cmds.values()) if (!c.left) cmds.push(this.cmdResult(c, false));
    this.result = { winner, downPid: JSON.parse(JSON.stringify(this.downPid)), killsBy: { ...this.killsBy }, cmds, dur: Math.round(this.elapsed), auto };
  }
  /** 超时/无人值守：按剩余兵力强弱估算结果 */
  autoFinish() {
    if (this.finished) return;
    const pow = (u: { maxHp: number; atk: number; skill: number; def: number }) => (u.maxHp / 10) * ((u.atk + u.skill * 0.6) / 10) * (1 + u.def / 25);
    const P = [0, 0];
    const alive: [BUnit[], BUnit[]] = [[], []];
    for (const u of this.units) if (!u.dead && !u.fled && !u.routed) { P[u.side] += pow(u) * ((u.god & 2) ? 1000 : 1); alive[u.side].push(u); }
    for (const s of [0, 1] as const) for (const e of this.reserves[s]) { const t = TROOPS[e.id]; P[s] += pow({ maxHp: t.hp, atk: t.atk, skill: t.skill, def: t.def }); }
    const w: 0 | 1 = P[0] * (0.85 + Math.random() * 0.3) >= P[1] * (0.85 + Math.random() * 0.3) ? 0 : 1;
    const l = (1 - w) as 0 | 1;
    const ratio = Math.min(1, P[l] / Math.max(1, P[w]));
    for (const u of alive[w]) if (u.troop && !(u.god & 2) && Math.random() < ratio * 0.45) { u.dead = true; this.addDown(u); }
    for (const u of alive[l]) if (u.troop && Math.random() < 0.6) { u.dead = true; this.addDown(u); }
    for (const e of this.reserves[l]) if (Math.random() < 0.5) { const t = { troop: e.id, pid: e.pid, side: l } as BUnit; this.addDown(t); }
    for (const e of this.reserves[w]) if (Math.random() < ratio * 0.3) { const t = { troop: e.id, pid: e.pid, side: w } as BUnit; this.addDown(t); }
    this.reserves = [[], []];
    for (const u of alive[l]) u.routed = true;
    this.finish(w, true);
  }

  // ---------- 下行：每个玩家的增量帧 ----------
  /** 生成某玩家本 tick 的二进制帧（无内容时返回 null） */
  frameFor(c: Cmd): Uint8Array | null {
    const v = c.viewer!; const w = this.wr; w.reset();
    v.grow(this.uidSeq + 1);
    const tick = this.tick;
    const vw = c.view, mx = 140;
    const x0 = vw.x - mx, x1 = vw.x + vw.w + mx, y0 = vw.y - mx, y1 = vw.y + vw.h + mx;
    const fx = c.hero && !c.hero.dead && !c.hero.fled ? c.hero.x : vw.x + vw.w / 2, fy = c.hero && !c.hero.dead && !c.hero.fled ? c.hero.y : vw.y + vw.h / 2;
    w.u8(1); w.u32(tick); w.u32(Math.round(this.elapsed * 1000));
    const nPos = w.pos; w.u16(0);
    let n = 0;
    for (const u of this.units) {
      const id = u.uid;
      const known = v.known[id];
      if (known === 2) continue; // 已确认死亡/离场
      const st = (u.dead ? ST_DEAD : 0) | (u.routed ? ST_ROUTED : 0) | (u.fled ? ST_FLED : 0) | (u.aiming ? ST_AIM : 0) | (u.swing > 0 ? ST_SWING : 0) | (u.ranged ? ST_RANGED : 0);
      const own = u === c.hero && c.online;
      const qx = Math.round(u.x * 4), qy = Math.round(u.y * 4);
      const qf = Math.round(u.face / (Math.PI * 2) * 256) & 255;
      const qh = u.dead ? 0 : Math.max(1, Math.min(255, Math.ceil(u.hp / u.maxHp * 255)));
      let mask = 0;
      if (!known) mask = 1 | 4 | 8 | 16;
      else {
        const stCh = st !== v.ls[id];
        if (!stCh) {
          const inView = u.x > x0 && u.x < x1 && u.y > y0 && u.y < y1;
          const interval = inView ? (Math.abs(u.x - fx) + Math.abs(u.y - fy) < 520 ? 1 : 2) : 8;
          if (tick - v.lt[id] < interval) continue;
        }
        const dx = qx - v.lx[id], dy = qy - v.ly[id];
        if (!own && (dx > 1 || dx < -1 || dy > 1 || dy < -1)) mask |= (dx >= -127 && dx <= 127 && dy >= -127 && dy <= 127) ? 2 : 1;
        let df = qf - v.lf[id]; if (df < 0) df = -df; if (df > 128) df = 256 - df;
        if (df >= 3 && !own) mask |= 4;
        if (qh !== v.lh[id]) mask |= 8;
        if (stCh) mask |= 16;
        if (!mask) continue;
      }
      if (own) mask &= ~3;
      w.u16(id); w.u8(mask);
      if (mask & 1) { w.u16(qx); w.u16(qy); v.lx[id] = qx; v.ly[id] = qy; }
      else if (mask & 2) { w.i8(qx - v.lx[id]); w.i8(qy - v.ly[id]); v.lx[id] = qx; v.ly[id] = qy; }
      if (mask & 4) { w.u8(qf); v.lf[id] = qf; }
      if (mask & 8) { w.u8(qh); v.lh[id] = qh; }
      if (mask & 16) { w.u8(st); v.ls[id] = st; }
      v.lt[id] = tick;
      v.known[id] = (u.dead || u.fled) ? 2 : 1;
      n++;
    }
    w.setU16(nPos, n);
    // 事件：只发可见区域附近的；自己主角射出的箭不回传（客户端已即时绘制）
    const ePos = w.pos; w.u16(0);
    let ne = 0;
    const em = 320;
    const myUid = c.hero?.uid ?? -1;
    for (const e of this.evs) {
      if (e.k === EV_SHOT) {
        if (e.from === myUid && c.online) continue;
        const ex = e.x + Math.cos(e.a) * e.b, ey = e.y + Math.sin(e.a) * e.b;
        const vis = (e.x > x0 - em && e.x < x1 + em && e.y > y0 - em && e.y < y1 + em) || (ex > x0 && ex < x1 && ey > y0 && ey < y1);
        if (!vis) continue;
        w.u8(EV_SHOT); w.u8(e.c | (e.e << 4)); w.u16(e.from); w.u16(Math.round(e.x * 2)); w.u16(Math.round(e.y * 2));
        w.u16(Math.round(((e.a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 65535)); w.u16(Math.round(e.b)); w.u16(Math.round(e.d));
        ne++;
      } else {
        const mine = e.to === myUid || e.from === myUid;
        if (!mine && !(e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1)) continue;
        let kind = e.c;
        if (kind === GOD_BLOCK) { const tu = this.byUid[e.to]; if (tu && tu.cmd !== c && !(tu.god & 8)) kind = BLOCK_MELEE; } // 天命不显圣：别人只看到格挡
        w.u8(EV_HIT); w.u16(e.to); w.u16(e.from); w.u8(Math.min(255, Math.round(e.b))); w.u8(kind);
        ne++;
      }
    }
    w.setU16(ePos, ne);
    if (!n && !ne && tick % 10) return null;
    v.frames++; v.bytes += w.pos;
    return w.bytes();
  }
  /** 本 tick 结束：清空事件，返回新出生单位的静态信息 */
  endTick() {
    this.evs.length = 0;
    const sp = this.spawned; this.spawned = [];
    const out = this.out; this.out = [];
    return { spawned: sp.map(u => this.spawnInfo(u)), out };
  }
}
