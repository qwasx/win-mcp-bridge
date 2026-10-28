// 第三阶段·活世界：修士一视同仁——储物袋、本命法宝、功法、战力
//
// 玩家（Hero）和 NPC 用同一套口径：
// · 储物袋 bag（与 Hero.bag 同结构 {id, n, age?}）；灵石：NPC 记在 wealth 上，玩家在 bag 里的 mat_lingshi
// · 本命法宝 main：储物袋里最趁手的一件法器（指向 bag 里的 id）
// · 功法 gongfa：GONGFA 表里的 id，决定修炼速度与攻守加成
// · 战力 power：同一个公式算玩家和 NPC（境界气血 × 攻击 × 功法 × 法宝 × 符箓）
// NPC 身上的东西按「地域 × 宗门 × 境界」来配（outfit）；打你时祭出的就是本命法宝，死了掉的也正是这只储物袋（deathLoot）。
//
// 【接口给 s4-content】掉落 / 配装表做好后，调用 setKitProvider(fn) 即可接管配装，fn 返回 null 时回落到这里的默认配装。
import { ITEM_LIST, itemDef, type ItemDef } from '../../data/items';
import { GONGFA } from '../../data/skills';
import { REALMS } from '../../data/realms';
import { LOC_BY_ID, type MapId } from '../../data/world';
import { zoneOfLoc, sellableAt, ruleOf, canonOwned, type Zone } from '../../data/market';
import type { NpcData } from '../npc';

export interface BagItem { id: string; n: number; age?: number }
/** 配装时可参考的上下文 */
export interface KitCtx { id: string; map: MapId; zone: Zone; home: string; sect?: string; faction: NpcData['faction']; realm: number; stage: number; pers: NpcData['pers']; canon?: boolean; rnd: () => number }
export interface Kit { bag: BagItem[]; main?: string; gongfa: string }
export type KitProvider = (ctx: KitCtx) => Kit | null;

let provider: KitProvider | null = null;
/** s4-content：地域 / 宗门掉落表接入点 */
export function setKitProvider(p: KitProvider | null) { provider = p; }

/** 原著人物的成名法宝（与 NpcWorld.TREASURE 同源，由 npc.ts 注入，避免循环引用） */
let canonTreasure: Record<string, string | string[]> = {};
export function setCanonTreasure(t: Record<string, string | string[]>) { canonTreasure = t; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const SWORD_SECTS = new Set(['jujian', 'gujian', 'huangfeng', 'luoyun', 'taiyi']);
const DEMON = new Set(['guiling', 'hehuan', 'yuling', 'qianhuan', 'tiansha', 'yinluo', 'tianmo', 'jiyin']);
const EXP_PILL = ['pill_juqi', 'pill_huanglong', 'pill_juling', 'pill_ningyuan', 'pill_peiying', 'pill_yuanling'];
/** 各境界常用的修为丹药 */
export function expPillsFor(realm: number): string[] { return realm <= 1 ? ['pill_juqi', 'pill_huanglong'] : realm === 2 ? ['pill_juling'] : realm === 3 ? ['pill_ningyuan'] : ['pill_peiying', 'pill_yuanling']; }
/** 冲大境界的辅助丹：炼气→筑基 / 筑基→结丹 / 结丹→元婴 */
export const BREAK_PILL: Record<number, string> = { 1: 'pill_zhuji', 2: 'pill_jiangchen', 3: 'pill_jiuqu' };

let artPool: ItemDef[] | null = null;
const arts = () => (artPool ??= ITEM_LIST.filter((it) => it.type === 'artifact' && it.art && it.price > 0));

function addTo(bag: BagItem[], id: string, n: number, age?: number) {
  const it = itemDef(id); if (!it) return;
  const b = bag.find((x) => x.id === id && (x.age ?? 0) === (age ?? 0));
  if (b && it.type !== 'artifact') b.n += n; else bag.push(age !== undefined ? { id, n, age } : { id, n });
}

/** 默认配装：按地域流通的货色 + 宗门的路数 + 境界 */
export function defaultKit(c: KitCtx): Kit {
  const r = c.rnd, bag: BagItem[] = [];
  const mortal = c.faction === 'mortal' || c.realm <= 0;
  if (mortal) {
    if (r() < 0.3) addTo(bag, 'herb_huangjing', 1 + Math.floor(r() * 3), 10 + Math.floor(r() * 20));
    return { bag, gongfa: 'generic' };
  }
  // 功法：宗门弟子修本门功法（魔门玄阴经、剑派偶得青元剑诀），散修多是吐纳术
  let gongfa = 'generic';
  if (c.sect && DEMON.has(c.sect)) gongfa = c.realm >= 2 || r() < 0.4 ? 'xuanyin' : 'changchun';
  else if (c.sect) gongfa = c.realm >= 3 && SWORD_SECTS.has(c.sect) && r() < 0.35 ? 'qingyuan' : 'changchun';
  else if (c.realm >= 3 && r() < 0.2) gongfa = r() < 0.5 ? 'tuotian' : 'xuanyin';
  else if (c.realm >= 2 && r() < 0.5) gongfa = 'changchun';
  // 法器：本地坊市流通的（档次随境界），宗门弟子另有本门秘传；原著人物带着成名法宝
  const lvl = clamp(c.realm + (c.faction === 'merchant' ? 1 : 0), 1, 4);
  const pool = arts().filter((it) => it.tier <= c.realm + (c.realm >= 3 ? 1 : 0) && it.tier >= Math.max(0, c.realm - 2) && (it.art!.reqRealm ?? 1) <= Math.max(1, c.realm) && !canonOwned(it.id)
    && (sellableAt(it, c.zone, lvl, undefined, c.home) || (!!c.sect && !!ruleOf(it).homes?.includes(c.sect))));
  const prefer = (it: ItemDef) => {
    let w = 1;
    if (c.sect && ruleOf(it).homes?.includes(c.sect)) w *= 6;
    if (c.sect && SWORD_SECTS.has(c.sect) && it.art!.kind === 'sword') w *= 2.5;
    if (c.sect && DEMON.has(c.sect) && (it.art!.element === 'yin' || it.art!.element === 'blood' || it.art!.kind === 'banner')) w *= 3;
    if (c.faction === 'merchant' && (it.art!.kind === 'shield' || it.art!.kind === 'armor')) w *= 2;
    return w * (0.5 + it.tier * 0.3);
  };
  const pickArt = () => { let tot = 0; for (const it of pool) tot += prefer(it); let x = r() * tot; for (const it of pool) { x -= prefer(it); if (x <= 0) return it; } return pool[pool.length - 1]; };
  const nArt = c.realm <= 1 ? (r() < 0.55 ? 1 : 0) : c.realm === 2 ? 1 + (r() < 0.4 ? 1 : 0) : 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < nArt && pool.length; i++) { const it = pickArt(); if (it && !bag.some((b) => b.id === it.id)) addTo(bag, it.id, 1); }
  const tr = canonTreasure[c.id];
  if (tr) for (const t of Array.isArray(tr) ? tr : [tr]) if (itemDef(t)) addTo(bag, t, 1);
  // 丹药：修为丹几颗、疗伤回气丹
  const ep = expPillsFor(c.realm);
  if (r() < 0.75) addTo(bag, ep[Math.floor(r() * ep.length)], 1 + Math.floor(r() * (c.realm <= 1 ? 4 : 3)));
  if (r() < 0.7) addTo(bag, 'pill_liaoshang', 1 + Math.floor(r() * 3));
  if (r() < 0.5) addTo(bag, 'pill_huiqi', 1 + Math.floor(r() * 3));
  // 符箓：低阶修士保命的家当
  if (c.realm <= 2) {
    const tals = ['tal_fire', 'tal_ice', 'tal_jingang'].concat(c.realm >= 2 ? ['tal_thunder'] : []);
    const n = Math.floor(r() * 3); for (let i = 0; i < n; i++) addTo(bag, tals[Math.floor(r() * tals.length)], 1 + Math.floor(r() * 3));
    if (r() < 0.18) addTo(bag, 'tal_escape', 1);
  }
  // 宗门：炼气后期的内门弟子有望分到筑基丹；行商带货
  if (c.sect && c.realm === 1 && c.stage >= 10 && r() < 0.18) addTo(bag, 'pill_zhuji', 1);
  if (c.faction === 'merchant') {
    const goods = ITEM_LIST.filter((it) => (it.type === 'pill' || it.type === 'herb' || it.type === 'material' || it.type === 'talisman') && it.price > 0 && it.tier <= Math.max(1, c.realm) && sellableAt(it, c.zone, 2));
    const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n && goods.length; i++) { const it = goods[Math.floor(r() * goods.length)]; addTo(bag, it.id, 1 + Math.floor(r() * 4), it.type === 'herb' ? 10 + Math.floor(r() * 50) : undefined); }
    if (c.realm >= 1 && r() < 0.12) addTo(bag, 'pill_zhuji', 1);
  }
  // 灵草 / 妖丹：路上采的、猎的
  if (r() < 0.35) { const hs = ITEM_LIST.filter((it) => it.type === 'herb' && it.tier <= Math.max(1, c.realm - 1) && it.price > 0); const it = hs[Math.floor(r() * hs.length)]; if (it) addTo(bag, it.id, 1 + Math.floor(r() * 2), (it.herbBase ?? 10) + Math.floor(r() * 30)); }
  if (c.realm >= 2 && r() < 0.35) addTo(bag, 'mat_yaodan' + clamp(c.realm * 2 - 2 + Math.floor(r() * 2), 1, 7), 1);
  return { bag, gongfa, main: undefined };
}

/** 给 NPC 配装（已有储物袋的不动）。确定性：同一个 seed 配出同一身行头 */
export function outfit(d: NpcData, rnd?: () => number) {
  if (d.bag) return;
  let s = (d.seed ^ 0x5bd1e995) >>> 0;
  const r = rnd ?? (() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; });
  const home = LOC_BY_ID.get(d.home);
  const ctx: KitCtx = { id: d.id, map: d.map ?? home?.map ?? 'tiannan', zone: zoneOfLoc(home), home: d.home, sect: d.sect ?? d.ros, faction: d.faction, realm: d.realm, stage: d.stage, pers: d.pers, canon: d.canon, rnd: r };
  const k = (provider ? provider(ctx) : null) ?? defaultKit(ctx);
  d.bag = k.bag; d.gongfa = d.gongfa ?? k.gongfa; d.main = k.main;
  reequip(d);
}

/** 选出最趁手的本命法宝（境界够得着、品阶最高的攻击法器） */
export function bestArt(bag: BagItem[], realm: number): string | undefined {
  let best: ItemDef | undefined, bs = -1;
  for (const b of bag) {
    const it = itemDef(b.id); if (!it || it.type !== 'artifact' || !it.art) continue;
    const k = it.art.kind; if (k === 'boots' || k === 'flight' || k === 'wings') continue;
    const atk = k === 'shield' || k === 'armor' ? 0.6 : 1;
    const sc = (it.tier + (it.art.reqRealm <= Math.max(1, realm) ? 1 : -2)) * atk + it.price / 1e6;
    if (sc > bs) { bs = sc; best = it; }
  }
  return best?.id;
}
export function reequip(d: NpcData) { if (d.bag) d.main = bestArt(d.bag, d.realm); }

// ------------------------------------------------------------------ 战力（玩家与 NPC 同一公式）
export interface CultView { realm: number; stage: number; gongfa?: string; bag: BagItem[]; main?: string }
/** 战力：气血 × 攻击（同境界的人旗鼓相当，差一个大境界约差六七倍），再乘功法、法宝、符箓 */
export function power(c: CultView): number {
  const R = REALMS[clamp(c.realm, 0, 5)], s = clamp(c.stage, 0, R.hp.length - 1);
  let p = R.hp[s] * R.atk[s];
  const gf = GONGFA[c.gongfa ?? 'generic'];
  if (gf && !gf.aux) { const over = c.realm > gf.maxRealm ? 0.5 : 1; p *= (1 + (gf.atk ?? 0) * over + (gf.sword ?? 0) * 0.3 * over) * (1 + (gf.hp ?? 0) * over + (gf.def ?? 0) * 0.5 * over); }
  const m = c.main ? itemDef(c.main) : undefined;
  if (m?.art) p *= 1.05 + 0.09 * m.tier * (m.art.reqRealm <= Math.max(1, c.realm) ? 1 : 0.5);
  let extra = 0, tals = 0;
  for (const b of c.bag) {
    if (b.id === c.main) continue;
    const it = itemDef(b.id); if (!it) continue;
    if (it.type === 'artifact' && extra < 3) { extra++; p *= 1 + 0.03 * (1 + it.tier); }
    else if (it.type === 'talisman' && tals < 4) { tals += b.n; }
  }
  if (c.realm <= 2) p *= 1 + 0.04 * Math.min(4, tals);
  return p;
}
/** 胜率：战力比的 1.3 次方 */
export function winChance(pa: number, pb: number) { const a = Math.pow(pa, 1.3), b = Math.pow(pb, 1.3); return a / (a + b); }

// ------------------------------------------------------------------ 储物袋操作
export function bagValue(bag: BagItem[] | undefined) { let v = 0; if (bag) for (const b of bag) v += (itemDef(b.id)?.price ?? 0) * b.n; return v; }
export function bagHas(bag: BagItem[] | undefined, id: string) { return !!bag?.some((b) => b.id === id && b.n > 0); }
export function bagTake(bag: BagItem[], id: string, n = 1): boolean {
  let left = n;
  for (const b of bag) if (b.id === id && left > 0) { const k = Math.min(b.n, left); b.n -= k; left -= k; }
  for (let i = bag.length - 1; i >= 0; i--) if (bag[i].n <= 0) bag.splice(i, 1);
  return left === 0;
}
export function bagPut(bag: BagItem[], id: string, n: number, age?: number) { addTo(bag, id, n, age); }
/** 死后留下的东西：整只储物袋 + 身上的灵石（s4 可在这里接 rollLoot） */
export function deathLoot(d: NpcData): BagItem[] {
  outfit(d);
  const out: BagItem[] = (d.bag ?? []).map((b) => ({ ...b }));
  if (d.wealth > 0) out.push({ id: 'mat_lingshi', n: Math.max(1, Math.round(d.wealth)) });
  return out;
}
/** 全数转手（杀人夺宝） */
export function takeAll(from: NpcData, to: NpcData): BagItem[] {
  outfit(from); outfit(to);
  const got = from.bag!.map((b) => ({ ...b }));
  for (const b of got) addTo(to.bag!, b.id, b.n, b.age);
  if (from.wealth > 0) { got.push({ id: 'mat_lingshi', n: Math.round(from.wealth) }); to.wealth += Math.round(from.wealth); }
  from.bag = []; from.main = undefined; from.wealth = 0;
  reequip(to);
  return got;
}
/** 劫财不害命：拿走灵石大半与最值钱的一两件 */
export function takeSome(from: NpcData, to: NpcData, rnd: () => number): BagItem[] {
  outfit(from); outfit(to);
  const got: BagItem[] = [];
  const ls = Math.round(from.wealth * (0.5 + rnd() * 0.3));
  if (ls > 0) { from.wealth -= ls; to.wealth += ls; got.push({ id: 'mat_lingshi', n: ls }); }
  const sorted = from.bag!.slice().sort((a, b) => (itemDef(b.id)?.price ?? 0) * b.n - (itemDef(a.id)?.price ?? 0) * a.n);
  const n = 1 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < n && i < sorted.length; i++) {
    const b = sorted[i]; const k = itemDef(b.id)?.type === 'artifact' ? 1 : b.n;
    bagTake(from.bag!, b.id, k); addTo(to.bag!, b.id, k, b.age); got.push({ id: b.id, n: k, age: b.age });
  }
  reequip(from); reequip(to);
  return got;
}
export function lootText(got: BagItem[], max = 4): string {
  const parts = got.filter((b) => b.n > 0).sort((a, b) => (itemDef(b.id)?.price ?? 0) * b.n - (itemDef(a.id)?.price ?? 0) * a.n).slice(0, max).map((b) => (b.id === 'mat_lingshi' ? `灵石${b.n}` : itemDef(b.id)?.name + (b.n > 1 ? `×${b.n}` : '')));
  return parts.join('、') + (got.length > max ? '等物' : '');
}
/** 冲境界前吃一颗修为丹：返回所增修为占本小境界的比例 */
export function eatExpPill(d: NpcData, need: number): number {
  if (!d.bag) return 0;
  for (const id of EXP_PILL) {
    const it = itemDef(id); if (!it?.pill?.exp || !bagHas(d.bag, id)) continue;
    if (it.tier > d.realm + 1 || it.tier < d.realm - 2) continue;
    bagTake(d.bag, id, 1);
    return Math.min(0.6, it.pill.exp / Math.max(1, need));
  }
  return 0;
}
