// 第三十六步：宗门名册——大派百人、小派数十人，按种子确定生成，只存死伤与改动
// 名册上的门人平时只是一行数据；你走近山门，或宗门要派人寻仇、出征时，才“现身”为真正的 NPC。
import type { Game } from './game';
import type { NpcData } from './npc';
import { makeName, SECT_ROBE_OF } from './npc';
import { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import { mulberry32 } from '../core/rng';

export type Rank = '掌门' | '太上长老' | '长老' | '执事' | '内门' | '外门' | '杂役';
export const RANKS: Rank[] = ['掌门', '太上长老', '长老', '执事', '内门', '外门', '杂役'];
export interface SectDef { id: string; name: string; n: number; top: number; demon?: boolean; robe?: string; motto?: string }

/** top：太上 / 掌门的境界（3 结丹 · 4 元婴 · 5 化神） */
export const SECT_DEFS: SectDef[] = [
  // 越国七派
  { id: 'huangfeng', name: '黄枫谷', n: 96, top: 3 },
  { id: 'yanyue', name: '掩月宗', n: 108, top: 4 },
  { id: 'lingshou', name: '灵兽山', n: 72, top: 3 },
  { id: 'qingxu', name: '清虚门', n: 38, top: 3 },
  { id: 'huadao', name: '化刀坞', n: 40, top: 3 },
  { id: 'tianque', name: '天阙堡', n: 34, top: 3 },
  { id: 'jujian', name: '巨剑门', n: 36, top: 3 },
  // 天道盟
  { id: 'luoyun', name: '落云宗', n: 100, top: 4 },
  { id: 'gujian', name: '古剑门', n: 84, top: 4 },
  { id: 'baiqiao', name: '百巧院', n: 62, top: 4 },
  // 魔道六宗
  { id: 'guiling', name: '鬼灵门', n: 98, top: 4, demon: true },
  { id: 'hehuan', name: '合欢宗', n: 110, top: 4, demon: true },
  { id: 'yuling', name: '御灵宗', n: 80, top: 4, demon: true },
  { id: 'qianhuan', name: '千幻宗', n: 70, top: 4, demon: true },
  { id: 'tiansha', name: '天煞宗', n: 64, top: 4, demon: true },
  { id: 'yinluo', name: '阴罗宗', n: 118, top: 4, demon: true },
  // 九国盟 / 千竹教
  { id: 'huayi', name: '化意门', n: 80, top: 4 },
  { id: 'qianzhu', name: '千竹教', n: 52, top: 4 },
  // 慕兰
  { id: 'tianlan', name: '天澜圣殿', n: 90, top: 4 },
  { id: 'mulan', name: '慕兰法士', n: 72, top: 4 },
  // 大晋
  { id: 'tianmo', name: '天魔宗', n: 120, top: 5, demon: true },
  { id: 'taiyi', name: '太一门', n: 112, top: 4 },
  { id: 'yejia', name: '叶家', n: 64, top: 4, robe: '#3e5a48' },
  // 乱星海
  { id: 'tianxing', name: '星宫', n: 120, top: 4, robe: '#2c3c6a' },
  { id: 'leikong', name: '逆星盟', n: 100, top: 4, robe: '#5a3a2a' },
  { id: 'miaoyin', name: '妙音门', n: 40, top: 3, robe: '#b8a0d0' },
  { id: 'jiyin', name: '极阴岛', n: 64, top: 4, demon: true, robe: '#20262e' },
];
/** 原著掌门 / 老祖占名册的席位（[序号, 原著人物 id]） */
export const CANON_SEAT: Record<string, [number, string][]> = {
  huangfeng: [[0, 'zhonglingdao'], [1, 'linghu']], yanyue: [[0, 'nichang']], jiyin: [[0, 'jiyin']], guiling: [[0, 'wangtiangu']],
  hehuan: [[0, 'hehuanlaomo']], tiansha: [[0, 'tianshazhenjun']], yinluo: [[0, 'fangzongzhu']],
};
export const SECT_DEF = new Map(SECT_DEFS.map((s) => [s.id, s]));
export const sectTitle = (id?: string) => (id ? SECT_DEF.get(id)?.name ?? LOC_BY_ID.get(id)?.name ?? id : '');

function hs(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export interface Member { sid: string; i: number; name: string; sex: 'm' | 'f'; rank: Rank; realm: number; stage: number; pers: NpcData['pers']; seed: number }

/** 第 i 号门人的品级 */
export function rankOf(def: SectDef, i: number): Rank {
  const n = def.n, tai = def.top >= 4 ? (n >= 90 ? 2 : 1) : n >= 60 ? 1 : 0;
  if (i === 0) return '掌门';
  if (i <= tai) return '太上长老';
  let k = 1 + tai;
  const el = Math.max(2, Math.round(n * 0.07)); if (i < k + el) return '长老'; k += el;
  const zs = Math.round(n * 0.12); if (i < k + zs) return '执事'; k += zs;
  const nm = Math.round(n * 0.26); if (i < k + nm) return '内门'; k += nm;
  const wm = Math.round(n * 0.33); if (i < k + wm) return '外门';
  return '杂役';
}
const stg = (realm: number, r: () => number, lo = 0, hi = 1) => { const L = REALMS[realm].stages.length; return Math.min(L - 1, Math.floor(L * (lo + (hi - lo) * r()))); };

export function member(def: SectDef, i: number, gen = 0): Member {
  const r = mulberry32((hs(def.id) ^ Math.imul(i + 1, 2654435761) ^ Math.imul(gen, 40503)) >>> 0);
  const rank = rankOf(def, i), T = def.top;
  const fem = def.id === 'yanyue' || def.id === 'miaoyin' || def.id === 'hehuan' ? 0.62 : 0.3;
  const sex: 'm' | 'f' = r() < fem ? 'f' : 'm';
  let realm = 1, stage = 0;
  switch (rank) {
    case '太上长老':
      // 第三十七步：人界的化神屈指可数——只天魔宗太上一人，且止步化神初期；元婴后期也是凤毛麟角
      if (T >= 5) { realm = i === 1 ? 5 : 4; stage = i === 1 ? 0 : 2; }
      else { realm = T; stage = T >= 4 ? (r() < 0.15 ? 2 : r() < 0.55 ? 1 : 0) : stg(realm, r, 0.5, 1); }
      break;
    case '掌门': realm = T >= 4 ? Math.max(3, T - 1) : T; stage = stg(realm, r, 0.55, 1); if (T === 4 && r() < 0.25) { realm = T; stage = 0; } break;
    case '长老': realm = Math.max(3, T - 1); stage = stg(realm, r, 0, 1); if (T >= 5 && r() < 0.12) { realm = 4; stage = 0; } break;
    case '执事': realm = T >= 5 ? 3 : 2; stage = stg(realm, r, T >= 5 ? 0 : 0.5, T >= 5 ? 0.5 : 1); if (T === 4 && r() < 0.25) { realm = 3; stage = 0; } break;
    case '内门': realm = r() < 0.75 ? 2 : 1; stage = realm === 1 ? stg(1, r, 0.75, 1) : stg(2, r, 0, 0.8); if (T >= 5 && realm === 1) realm = 2; break;
    case '外门': realm = 1; stage = stg(1, r, 0.3, 1); if (T >= 4 && r() < 0.2) { realm = 2; stage = 0; } break;
    case '杂役': realm = 1; stage = stg(1, r, 0, 0.5); break;
  }
  const P: NpcData['pers'][] = def.demon ? ['ruthless', 'greedy', 'arrogant', 'cautious', 'cautious'] : ['righteous', 'righteous', 'cautious', 'arrogant', 'kind', 'greedy'];
  return { sid: def.id, i, name: makeName(r, sex), sex, rank, realm, stage, pers: P[Math.floor(r() * P.length)], seed: Math.floor(r() * 1e9) };
}

interface RosState { d?: number[]; g?: Record<number, number> }
const RANK_W: Record<Rank, number> = { 掌门: 0, 太上长老: 1, 长老: 2, 执事: 3, 内门: 4, 外门: 5, 杂役: 6 };

export class Roster {
  game: Game;
  private acc = 0;
  /** 已现身的门人 id */
  private present = new Set<string>();
  constructor(game: Game) { this.game = game; }
  private st(sid: string): RosState { const f = this.game.ws.flags as any; f.ros ??= {}; return (f.ros[sid] ??= {}); }
  isDead(sid: string, i: number) { return !!this.st(sid).d?.includes(i); }
  gen(sid: string, i: number) { return this.st(sid).g?.[i] ?? 0; }
  /** 全部门人（含已故标记） */
  canonAt(sid: string, i: number) { return CANON_SEAT[sid]?.find((s) => s[0] === i)?.[1]; }
  members(sid: string): (Member & { dead: boolean })[] {
    const def = SECT_DEF.get(sid); if (!def) return [];
    const out: (Member & { dead: boolean })[] = [];
    for (let i = 0; i < def.n; i++) {
      const m = { ...member(def, i, this.gen(sid, i)), dead: this.isDead(sid, i) };
      const c = this.canonAt(sid, i), cd = c ? this.game.npcs.byId.get(c) : undefined;
      if (cd) { m.name = cd.name; m.realm = cd.realm; m.stage = cd.stage; m.sex = cd.sex; m.dead = !cd.alive; }
      out.push(m);
    }
    return out;
  }
  aliveCount(sid: string) { return this.members(sid).filter((m) => !m.dead).length; }
  idOf(sid: string, i: number) { return `r_${sid}_${i}_${this.gen(sid, i)}`; }
  /** 让第 i 号门人现身为 NPC（已现身则直接返回） */
  materialize(sid: string, i: number, at?: { x: number; y: number }): NpcData | null {
    const def = SECT_DEF.get(sid), loc = LOC_BY_ID.get(sid); if (!def || !loc || this.isDead(sid, i)) return null;
    const c = this.canonAt(sid, i); if (c) { const cd = this.game.npcs.byId.get(c); return cd?.alive ? cd : null; }
    const id = this.idOf(sid, i), npcs = this.game.npcs;
    const ex = npcs.byId.get(id); if (ex) { if (ex.alive) this.present.add(id); return ex.alive ? ex : null; }
    const m = member(def, i, this.gen(sid, i));
    const p = at ?? npcs.homeAt(loc, Math.random, 1500, 1100);
    const R = REALMS[m.realm];
    const elder = m.rank === '掌门' || m.rank === '太上长老' || m.rank === '长老';
    const d: NpcData = {
      id, name: m.name, sex: m.sex, role: m.sex === 'f' ? 'female' : elder ? 'elder' : 'cultivator', realm: m.realm, stage: m.stage,
      faction: def.demon ? 'demon' : 'sect', sect: sid, home: sid, pers: m.pers, favor: 0, grudge: 0, met: false, alive: true,
      age: 18 + (m.realm - 1) * 30 + (m.seed % 40), life: R.life * 0.95, x: p.x, y: p.y, tx: p.x, ty: p.y, goal: 'stay', until: 0,
      wealth: Math.round(20 * Math.pow(4, m.realm)), seed: m.seed, robe: def.robe ?? SECT_ROBE_OF(sid), map: loc.map,
      title: `${def.name}${m.rank}`, ros: sid, rosI: i,
    };
    if (d.age > d.life * 0.9) d.age = d.life * 0.6;
    npcs.list.push(d); npcs.byId.set(id, d); this.present.add(id);
    return d;
  }
  /** 值得存档的现身者（结过交情 / 有仇 / 正在追杀 / 同行） */
  static notable(d: NpcData) { return d.alive && (d.met || (d.grudge ?? 0) > 0 || !!d.bond || !!d.hunting || !!d.chasing || !!d.helpUntil || !!(d as any).war); }
  private vanish(d: NpcData) {
    const npcs = this.game.npcs; npcs.forget(d.id);
    const k = npcs.list.indexOf(d); if (k >= 0) npcs.list.splice(k, 1);
    npcs.byId.delete(d.id); this.present.delete(d.id);
  }
  /** 门人死去：记入名册 */
  private markDead(d: NpcData) {
    if (!d.ros || d.rosI === undefined) return;
    const s = this.st(d.ros); (s.d ??= []); if (!s.d.includes(d.rosI)) s.d.push(d.rosI);
  }
  /**
   * 挑选门人：境界在 [lo, hi] 之间，按品级从高到低，可排除已现身者。
   * 用于寻仇、围剿与出征。
   */
  pick(sid: string, n: number, lo: number, hi: number, opt: { minRank?: Rank; skipTop?: boolean } = {}): NpcData[] {
    const def = SECT_DEF.get(sid); if (!def) return [];
    const cand: Member[] = [];
    for (let i = 0; i < def.n; i++) {
      if (this.isDead(sid, i) || this.canonAt(sid, i)) continue;
      const m = member(def, i, this.gen(sid, i));
      if (opt.skipTop && (m.rank === '掌门' || m.rank === '太上长老')) continue;
      if (m.realm < lo || m.realm > hi) continue;
      const ex = this.game.npcs.byId.get(this.idOf(sid, i)); if (ex && (ex.hunting || ex.chasing || ex.bond || this.game.npcs.activeOf(ex.id))) continue;
      cand.push(m);
    }
    cand.sort((a, b) => b.realm * 13 + b.stage - (a.realm * 13 + a.stage) + (Math.random() - 0.5) * 6);
    const out: NpcData[] = [];
    for (const m of cand) { if (out.length >= n) break; const d = this.materialize(sid, m.i); if (d) out.push(d); }
    return out;
  }

  update(dt: number) {
    this.acc -= dt; if (this.acc > 0) return; this.acc = 1.5;
    const g = this.game, npcs = g.npcs, P = g.player;
    // 死者入册、离场者散去
    for (const id of [...this.present]) {
      const d = npcs.byId.get(id); if (!d) { this.present.delete(id); continue; }
      if (!d.alive) { this.markDead(d); this.vanish(d); continue; }
      if (Roster.notable(d)) continue;
      const loc = LOC_BY_ID.get(d.home);
      const far = !loc || loc.map !== ACTIVE_MAP || Math.hypot(loc.x * WORLD_SCALE - P.x, loc.y * WORLD_SCALE - P.y) > 9000;
      if (far && !npcs.activeOf(d.id)) this.vanish(d);
    }
    // 走近山门：名册上的门人在山门内外走动（每月轮换一批）
    for (const def of SECT_DEFS) {
      const loc = LOC_BY_ID.get(def.id); if (!loc || loc.map !== ACTIVE_MAP) continue;
      if (Math.hypot(loc.x * WORLD_SCALE - P.x, loc.y * WORLD_SCALE - P.y) > 5600) continue;
      const want = Math.max(8, Math.min(24, Math.round(def.n * 0.2)));
      let have = 0; for (const id of this.present) if (npcs.byId.get(id)?.ros === def.id) have++;
      if (have >= want) continue;
      const month = Math.floor(g.day / 30), r = mulberry32((hs(def.id) + month * 977) >>> 0);
      for (let t = 0; t < def.n * 2 && have < want; t++) {
        const i = 1 + Math.floor(r() * (def.n - 1));
        const m = rankOf(def, i); if (m === '太上长老' && r() < 0.85) continue;   // 太上长老多在闭关
        if (this.isDead(def.id, i) || this.canonAt(def.id, i) || npcs.byId.has(this.idOf(def.id, i))) continue;
        if (this.materialize(def.id, i)) have++;
      }
    }
  }
  /** 每日：补收新弟子（只补外门 / 杂役 / 内门的空缺；大派一年约补五六人） */
  daily(days: number) {
    for (const def of SECT_DEFS) {
      const s = this.st(def.id); if (!s.d?.length) continue;
      const ch = 1 - Math.pow(1 - def.n / 18 / 365, days);
      if (Math.random() > ch) continue;
      const k = s.d.findIndex((i) => RANK_W[rankOf(def, i)] >= 4); if (k < 0) continue;
      const i = s.d[k]; s.d.splice(k, 1); (s.g ??= {})[i] = (s.g[i] ?? 0) + 1;
    }
  }
  /** 名册概要：各品级在世人数 */
  summary(sid: string) {
    const out: Record<Rank, { n: number; alive: number }> = {} as any;
    for (const r of RANKS) out[r] = { n: 0, alive: 0 };
    for (const m of this.members(sid)) { out[m.rank].n++; if (!m.dead) out[m.rank].alive++; }
    return out;
  }
  leaders(sid: string) { return this.members(sid).filter((m) => RANK_W[m.rank] <= 2).map((m) => ({ ...m, realmText: realmName(m.realm, m.stage) })); }
}
