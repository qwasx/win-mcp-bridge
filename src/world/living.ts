// 第四十三步：活世界——众生各有储物袋、功法、门派、家小、恩仇与交游，在你看不见的地方也照样过日子
//
// · 储物袋：每个人身上都有真东西（灵石记在 wealth，物品记在 bag）。采药猎妖得来的灵草妖丹拿去坊市换灵石，
//   灵石再换丹药、功法玉简、法器；被劫、被杀，袋子就到了别人手里——你杀了谁，掉的就是他袋子里的东西
// · 功法：主修一门（宗门心法 / 散修吐纳），另习数门法术玉简；宗门藏经阁、师父传授、坊市购得、探宝所得
// · 门派：宗门弟子做差事攒贡献，外门 → 内门 → 核心 → 执事 → 长老，长老收徒；散修会拜入山门；残害同门者叛出师门
// · 家小：结为道侣、生儿育女（凡人多子，修士难有子嗣）；孩子年满十四测灵根，有灵根的拜入父母宗门；
//   人死了，遗物由子女 / 道侣 / 徒弟继承，亲人守丧；父母的血仇传给子女
// · 仇恨：被劫、被杀亲、被抢灵草都会记仇（有缘由、有轻重）；打得过就去寻仇，打不过就闭关苦修或请人助拳；
//   旧怨随岁月淡去，也会被共同的朋友说和
// · 交游：采药猎妖、探亲访友时结识新朋友；朋友之间赠礼、接济、并肩寻仇；朋友的朋友也成了朋友
// · 每个人都有“眼下的打算”（去哪、做什么、为什么）：在你神识之内照着走、照着说；劫道、寻仇当着你的面发生
// · 找你帮忙的人，一定是真认识你、真遇上了事的人：谁、在哪、被谁、丢了什么、对方如今在哪，写得清清楚楚；
//   不去也无妨——事情会在活世界里自己往下走（他可能自己去报仇，也可能请别人）
import type { Game } from './game';
import type { NpcData, Pers } from './npc';
import { npcMap, makeName, SECT_ROBE_OF, PERS_NAME } from './npc';
import type { NpcRole } from '../gfx/character';
import { LOC_BY_ID, locsOf, ACTIVE_MAP, WORLD_SCALE } from '../data/world';
import type { LocDef } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import { ITEM_LIST, itemDef } from '../data/items';
import type { ItemDef } from '../data/items';
import { zoneOfLoc, sellableAt, priceMul, canonOwned, sectCanOffer } from '../data/market';
import { canAdvance, capRealm } from './demog';
import { SECT_RANKS, SECT_RANK_NEED, SECT_RANK_REALM } from './worldstate';
import { surnameOf, relWord } from './relations';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';

export type PlanK = 'cult' | 'gather' | 'hunt' | 'trade' | 'duty' | 'visit' | 'court' | 'revenge' | 'rob' | 'hide' | 'heal' | 'mourn' | 'explore' | 'teach' | 'seek' | 'farm';
/** 眼下的打算：做什么（k）、去哪（to / x,y）、找谁（who）、为什么（why）、到哪天（until） */
export interface Plan { k: PlanK; to?: string; who?: string; why: string; until: number; t0?: number; x?: number; y?: number; help?: string[] }
/** 仇恨：恨谁、多恨（0–100）、为什么；blood = 血仇（几乎不会淡去，会传给子女） */
export interface Hate { id: string; v: number; why: string; day: number; blood?: boolean }
export interface Bio { d: number; t: string }
export type LiveK = 'birth' | 'wed' | 'death' | 'kill' | 'rob' | 'feud' | 'peace' | 'sect' | 'break' | 'treasure' | 'trade' | 'friend' | 'teach' | 'age';
export interface LiveLog { d: number; t: string; k: LiveK; ids: string[] }
interface Pend { from: string; foe: string; why: string; items: [string, number][]; stones: number; at: string; day: number; kind: 'rob' | 'kin' }
export interface LiveReq extends Pend { jade: number; until: number; done?: boolean }
export interface LiveState { log: LiveLog[]; reqAt: number; pend: Pend[]; reqs: LiveReq[]; st: Record<string, number>; kid: number; inviteAt: number }

export const PLAN_NAME: Record<PlanK, string> = {
  cult: '闭关修炼', gather: '入山采药', hunt: '猎杀妖兽', trade: '赶集买卖', duty: '宗门差事', visit: '探亲访友', court: '求结道侣', revenge: '寻仇',
  rob: '劫道', hide: '避祸', heal: '养伤', mourn: '守丧', explore: '寻访机缘', teach: '传道授业', seek: '请人助拳', farm: '操持生计',
};
const GOAL_OF: Record<PlanK, NpcData['goal']> = {
  cult: 'seclude', gather: 'gather', hunt: 'hunt', trade: 'travel', duty: 'stay', visit: 'travel', court: 'travel', revenge: 'travel',
  rob: 'travel', hide: 'stay', heal: 'stay', mourn: 'stay', explore: 'gather', teach: 'stay', seek: 'travel', farm: 'stay',
};
export const LIVE_K_NAME: Record<LiveK, string> = { birth: '添丁', wed: '姻缘', death: '身故', kill: '仇杀', rob: '劫案', feud: '恩怨', peace: '释怨', sect: '宗门', break: '突破', treasure: '机缘', trade: '买卖', friend: '交游', teach: '传道', age: '成人' };
export const LIVE_K_COLOR: Record<LiveK, string> = {
  birth: '#d89a4a', wed: '#d8709a', death: '#7a7068', kill: '#b8302a', rob: '#c8602a', feud: '#a8503a', peace: '#5a9a6a', sect: '#5a7ab0',
  break: '#8a5ab8', treasure: '#c0a020', trade: '#6a8a5a', friend: '#4a9a8a', teach: '#4a7a9a', age: '#9a8a4a',
};
export const FACTION_TEXT: Record<string, string> = { sect: '宗门弟子', rogue: '散修', demon: '魔修', mortal: '凡人', merchant: '行商' };

/** 各宗主修心法（宗门弟子入门即修） */
const SECT_GF: Record<string, string> = {
  huangfeng: '黄枫心经', qixuan: '七玄心法', yanyue: '素女轮回功', lingshou: '御兽真诀', qingxu: '清虚玄功', huadao: '化刀诀', tianque: '天阙镇岳功',
  jujian: '巨剑心诀', luoyun: '落云长生诀', gujian: '古剑心经', baiqiao: '百巧机关术', guiling: '鬼灵血煞功', hehuan: '合欢秘法', yuling: '御灵诀',
  qianhuan: '千幻魔功', tiansha: '天煞血功', yinluo: '阴罗鬼经', tianmo: '天魔大法', taiyi: '太一化清功', huayi: '化意心法', qianzhu: '千竹雷诀',
  tianlan: '圣殿祷文', mulan: '慕兰法诀', miaoyin: '妙音心诀', xinggong: '星辰诀', tianxing: '星辰诀', leikong: '逆星诀', jiyin: '玄阴经', yejia: '叶家秘传心法',
};
const ROGUE_GF = ['长春功', '基础吐纳术', '五行诀', '紫阳功', '青木诀', '金刚诀'];
const DEMON_GF = ['血炼魔功', '阴魂诀', '炼尸诀', '噬灵魔功'];
const DEMON = new Set(['guiling', 'hehuan', 'yuling', 'qianhuan', 'tiansha', 'yinluo', 'tianmo', 'jiyin', 'leikong']);
/** 冲击下一个大境界的关键丹药 */
const KEY_PILL: Record<number, string> = { 1: 'pill_zhuji', 2: 'pill_jiangchen', 3: 'pill_yuanling' };
const POP_CAP: Record<string, number> = { tiannan: 300, luanxing: 140, dajin: 420 };

const pickR = <T,>(a: T[], r: () => number = Math.random): T => a[Math.floor(r() * a.length)];
const pickOr = <T,>(a: T[], r: () => number = Math.random): T | undefined => (a.length ? a[Math.floor(r() * a.length)] : undefined);
const pron = (d: NpcData) => (d.sex === 'f' ? '她' : '他');
const lvOf = (d: NpcData) => d.realm * 13 + d.stage;
export const dateText = (day: number) => `第${Math.floor(day / 360) + 1}年${Math.floor((day % 360) / 30) + 1}月`;
/** 功法玉简的书名（有的物品名自带书名号） */
export const bookName = (n: string) => (n.startsWith('《') ? n : `《${n}》`);
export const itemsText = (a: [string, number][]) => a.map(([id, n]) => itemDef(id).name + (n > 1 ? '×' + n : '')).join('、');
const dirOf = (dx: number, dy: number) => ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];

// ---------------------------------------------------------------- 物品池（按坊市产地规则）
type PoolK = 'pill' | 'herb' | 'mat' | 'art' | 'tal' | 'scroll';
let POOLS: Record<PoolK, ItemDef[]> | null = null;
function pools(): Record<PoolK, ItemDef[]> {
  if (POOLS) return POOLS;
  const ok = (it: ItemDef) => it.price > 0 && it.id !== 'mat_lingshi' && !canonOwned(it.id);
  POOLS = {
    pill: ITEM_LIST.filter((it) => it.type === 'pill' && ok(it) && !!it.pill),
    herb: ITEM_LIST.filter((it) => it.type === 'herb' && ok(it)),
    mat: ITEM_LIST.filter((it) => it.type === 'material' && ok(it)),
    art: ITEM_LIST.filter((it) => it.type === 'artifact' && ok(it)),
    tal: ITEM_LIST.filter((it) => it.type === 'talisman' && ok(it)),
    scroll: ITEM_LIST.filter((it) => it.type === 'scroll' && ok(it) && !!it.scroll?.skill),
  };
  return POOLS;
}
const candCache = new Map<string, ItemDef[]>();
/** 某地、某境界的人手边能见到的东西：境界相当（tier ∈ [realm-1, realm]），且照产地规则在当地有卖 */
function cands(kind: PoolK, realm: number, home: string, level = 3): ItemDef[] {
  const key = kind + '|' + realm + '|' + home + '|' + level;
  let c = candCache.get(key);
  if (c) return c;
  const P = pools()[kind], z = zoneOfLoc(LOC_BY_ID.get(home));
  const lo = Math.max(0, realm - 1), hi = Math.max(1, realm);
  c = P.filter((it) => it.tier >= lo && it.tier <= hi && sellableAt(it, z, level, Math.max(1, realm * 2 - 1), home));
  if (!c.length) c = P.filter((it) => it.tier <= hi);
  candCache.set(key, c);
  return c;
}
/** 宗门藏经阁里本境界能换的功法玉简 */
function sectScrolls(sid: string, realm: number): ItemDef[] {
  const key = 'sect|' + sid + '|' + realm;
  let c = candCache.get(key);
  if (c) return c;
  c = pools().scroll.filter((it) => it.tier <= Math.max(1, realm) && sectCanOffer(it, sid));
  if (!c.length) c = cands('scroll', realm, sid, 3);
  candCache.set(key, c);
  return c;
}

interface OnA { d: NpcData; bubble?: { text: string; t: number }; enemy?: unknown; duel?: unknown; st: { x: number; y: number } }

export class LivingWorld {
  game: Game;
  private bt = new Map<string, number>();
  /** 每步重建：某地（打算的目的地）有谁 / 谁被谁恨着（最深的一笔） */
  private at = new Map<string, NpcData[]>();
  private threat = new Map<string, { id: string; v: number }>();
  constructor(g: Game) { this.game = g; }
  get S(): LiveState {
    const f = this.game.ws.flags as any;
    const s = (f.live ??= { log: [], reqAt: 0, pend: [], reqs: [], st: {}, kid: 0, inviteAt: 0 }) as LiveState;
    s.pend ??= []; s.reqs ??= []; s.st ??= {}; s.log ??= [];
    return s;
  }
  get N() { return this.game.npcs; }
  sectName(id?: string) { return id ? this.game.rel.sectName(id) ?? LOC_BY_ID.get(id)?.name ?? id : ''; }
  /** 实力：境界为主，功法与法器添几分 */
  private pwc = new Map<string, number>();
  pw(d: NpcData) { const c = this.pwc.get(d.id); if (c !== undefined) return c; const a = this.bestArtifact(d), v = lvOf(d) + Math.min(2.5, (d.arts?.length ?? 0) * 0.5) + (a && a.tier >= d.realm ? 1 : 0); this.pwc.set(d.id, v); return v; }
  /** 完整参与活世界模拟的人（原著人物、红颜、名册门人、坐镇老怪、你的同伴各有剧情，不在此列） */
  free(d: NpcData) { return d.alive && !d.canon && !d.beauty && !d.ros && !d.gz && !d.orig && !d.bond && !d.chasing && !d.hunting && !(d as any).war && !d.stay && !(d.hidden && d.born === undefined); }
  /** 可以被活世界里的人劫、被人寻仇的人 */
  private free2(t: NpcData) { return this.free(t) && !t.hidden; }
  known(d?: NpcData) { return !!d && (d.met || d.favor >= 15 || !!d.bond || (d.grudge ?? 0) > 0); }
  /** 真认识你、交情够的人，才会找你帮忙 / 请你赴宴 */
  knowsPlayer(v: NpcData) { return v.met && (v.favor >= 25 || v.bond === 'sworn' || v.bond === 'master' || v.bond === 'disciple'); }

  // ------------------------------------------------------------ 储物袋
  ensure(d: NpcData) {
    if (d.bag) return;
    let s = (d.seed ^ 0x9e3779b9) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const bag: Record<string, number> = {};
    const add = (it: ItemDef | undefined, n = 1) => { if (it) bag[it.id] = (bag[it.id] ?? 0) + n; };
    const r = d.realm;
    if (d.faction === 'mortal' || r === 0) {
      if (rnd() < 0.25) add(pickOr(cands('herb', 0, d.home, 1), rnd));
    } else {
      const np = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < np; i++) add(pickOr(cands('pill', r, d.home), rnd), 1 + Math.floor(rnd() * 2));
      if (rnd() < 0.6) add(pickOr(cands('herb', r, d.home), rnd), 1 + Math.floor(rnd() * 3));
      if (rnd() < 0.5) add(pickOr(cands('mat', r, d.home), rnd), 1 + Math.floor(rnd() * 2));
      if (rnd() < 0.45) add(pickOr(cands('tal', r, d.home), rnd), 1 + Math.floor(rnd() * 2));
      if (rnd() < 0.45 + 0.12 * r) add(pickOr(cands('art', r, d.home), rnd));
      if (d.faction === 'merchant') for (let i = 0; i < 4; i++) add(pickOr(cands(rnd() < 0.5 ? 'herb' : rnd() < 0.5 ? 'pill' : 'mat', Math.max(1, r), d.home, 2), rnd), 1 + Math.floor(rnd() * 3));
      const kp = KEY_PILL[r]; if (kp && d.stage >= REALMS[r].stages.length - 1 && rnd() < 0.12) bag[kp] = 1;
    }
    d.bag = bag;
    if (r > 0 && d.faction !== 'mortal') {
      d.gf ??= d.sect ? SECT_GF[d.sect] ?? `${this.sectName(d.sect)}心法` : d.faction === 'demon' ? pickR(DEMON_GF, rnd) : pickR(ROGUE_GF, rnd);
      if (!d.arts) {
        const pool = d.sect ? sectScrolls(d.sect, r) : cands('scroll', r, d.home);
        const n = Math.min(4, 1 + Math.floor(r * 0.8 + rnd() * 1.5)), arts: string[] = [];
        for (let i = 0; i < n * 3 && arts.length < n && pool.length; i++) { const it = pickR(pool, rnd); if (!arts.includes(it.id)) arts.push(it.id); }
        d.arts = arts;
      }
    } else d.arts ??= [];
    if (d.sect && d.srk === undefined) {
      d.srk = r >= 4 ? 4 : r >= 3 ? (rnd() < 0.5 ? 4 : 3) : r >= 2 ? (rnd() < 0.3 ? 2 : 1) : rnd() < 0.2 ? 1 : 0;
      d.ctb = SECT_RANK_NEED[d.srk] + Math.round(rnd() * 200);
    }
  }
  ensureAll() { for (const d of this.N.list) if (!d.ros && !d.gz) this.ensure(d); }
  bagValue(d: NpcData) { let v = 0; for (const [id, n] of Object.entries(d.bag ?? {})) v += itemDef(id).price * n; return v; }
  give(d: NpcData, id: string, n = 1) { const b = (d.bag ??= {}); b[id] = (b[id] ?? 0) + n; }
  take(d: NpcData, id: string, n = 1) { const b = d.bag; if (!b || !b[id]) return 0; const k = Math.min(n, b[id]); b[id] -= k; if (b[id] <= 0) delete b[id]; return k; }
  bestArtifact(d: NpcData): ItemDef | null { let best: ItemDef | null = null; for (const id of Object.keys(d.bag ?? {})) { const it = itemDef(id); if (it.type === 'artifact' && (!best || it.tier > best.tier)) best = it; } return best; }
  /** 把 from 的灵石（frac）与最值钱的几件东西转给 to（to 为空 = 散落 / 遗失） */
  transfer(from: NpcData, to: NpcData | null, frac: number, maxItems: number): { stones: number; items: [string, number][] } {
    this.ensure(from); if (to) this.ensure(to);
    const stones = Math.max(0, Math.round(from.wealth * frac)); from.wealth -= stones; if (to) to.wealth += stones;
    const ent = Object.entries(from.bag ?? {}).sort((a, b) => itemDef(b[0]).price * b[1] - itemDef(a[0]).price * a[1]);
    const items: [string, number][] = [];
    for (const [id, n] of ent.slice(0, maxItems)) { this.take(from, id, n); if (to) this.give(to, id, n); items.push([id, n]); }
    return { stones, items };
  }
  /** 你杀了他：储物袋整个落地（外加一两枚他所习功法的玉简拓本）——清空并返回 */
  lootOf(d: NpcData) {
    this.ensure(d);
    const items = (Object.entries(d.bag ?? {}).filter(([, n]) => n > 0) as [string, number][]).sort((a, b) => itemDef(b[0]).price - itemDef(a[0]).price).slice(0, 10);
    for (const a of (d.arts ?? []).filter(() => Math.random() < 0.5).slice(0, 2)) if (!items.some(([id]) => id === a)) items.push([a, 1]);
    const stones = Math.max(0, Math.round(d.wealth));
    d.bag = {}; d.wealth = 0;
    return { stones, items };
  }
  /** 交易玉符成交：东西从他袋里出，灵石进他袋里 */
  sold(d: NpcData, id: string, price: number) { this.take(d, id, 1); d.wealth += price; }
  canPeek(d: NpcData) { const h = this.game.hero; return !d.alive || h.realm > d.realm || (h.realm === d.realm && h.stage >= d.stage + 3) || d.favor >= 60 || !!d.bond; }

  // ------------------------------------------------------------ 记事
  log(k: LiveK, t: string, ids: string[], vd: number) {
    const S = this.S, L = S.log;
    L.push({ d: Math.floor(vd), t, k, ids }); if (L.length > 240) L.splice(0, L.length - 240);
    S.st[k] = (S.st[k] ?? 0) + 1;
    if (ids.some((id) => this.known(this.N.byId.get(id)))) this.game.news(t, 'rumor');
  }
  bio(d: NpcData, t: string, vd: number) { const b = (d.bio ??= []); b.push({ d: Math.floor(vd), t }); if (b.length > 6) b.splice(0, b.length - 6); }

  // ------------------------------------------------------------ 关系工具
  private tied(d: NpcData, ks: string[]) { const out: { o: NpcData; r: string; k: string }[] = []; for (const t of d.ties ?? []) if (ks.includes(t.k)) { const o = this.N.byId.get(t.id); if (o) out.push({ o, r: t.r, k: t.k }); } return out; }
  spouseOf(d: NpcData) { return this.tied(d, ['lover']).map((x) => x.o).find((o) => o.alive); }
  kidsOf(d: NpcData) { return this.tied(d, ['kin']).filter((x) => x.r === '子' || x.r === '女').map((x) => x.o); }
  parentsOf(d: NpcData) { return this.tied(d, ['kin']).filter((x) => x.r === '父' || x.r === '母').map((x) => x.o); }
  friendsOf(d: NpcData) { return this.tied(d, ['friend', 'sworn']).map((x) => x.o).filter((o) => o.alive && !o.hidden); }
  private helpersFor(d: NpcData, t: NpcData) {
    return this.tied(d, ['friend', 'sworn', 'kin', 'lover', 'master', 'disciple']).map((x) => x.o)
      .filter((o) => o.alive && !o.hidden && o.realm > 0 && o !== t && npcMap(o) === npcMap(d) && this.free(o) && !this.game.rel.tieOf(o, t.id) && this.pw(o) >= this.pw(t) - 3)
      .sort((a, b) => this.pw(b) - this.pw(a)).slice(0, 2);
  }
  private alliesOf(t: NpcData, foe: NpcData) { return this.tied(t, ['kin', 'lover', 'sworn']).map((x) => x.o).filter((o) => o.alive && !o.hidden && o.realm > 0 && o.home === t.home && o !== foe); }
  addHate(d: NpcData, o: NpcData, v: number, why: string, vd: number, blood = false) {
    if (d === o || !d.alive) return;
    const H = (d.hate ??= []); const e = H.find((x) => x.id === o.id);
    if (e) { e.v = Math.min(100, e.v + v * 0.6); if (v >= e.v * 0.5) e.why = why; e.day = Math.floor(vd); if (blood) e.blood = true; }
    else { H.push({ id: o.id, v: Math.min(100, Math.round(v)), why, day: Math.floor(vd), blood: blood || undefined }); H.sort((a, b) => b.v - a.v); if (H.length > 5) H.length = 5; }
    if (blood && !d.vend) d.vend = o.id;
  }
  topHate(d: NpcData): Hate | undefined { let b: Hate | undefined; for (const h of d.hate ?? []) if (!b || h.v > b.v) b = h; return b; }
  hates(a: NpcData, b: NpcData) { return Math.max(a.hate?.find((h) => h.id === b.id)?.v ?? 0, b.hate?.find((h) => h.id === a.id)?.v ?? 0); }
  whereText(d: NpcData): string {
    const px = d.x / WORLD_SCALE, py = d.y / WORLD_SCALE;
    let best: LocDef | undefined, bd = Infinity;
    for (const l of locsOf(npcMap(d))) { const dd = Math.hypot(l.x - px, l.y - py); if (dd < bd) { bd = dd; best = l; } }
    if (!best) return '荒野';
    return bd < 10 ? best.name : `${best.name}${dirOf(px - best.x, py - best.y)}边的${bd < 40 ? '山道上' : '荒野里'}`;
  }
  private near(d: NpcData, types: string[], maxD: number, f?: (l: LocDef) => boolean): LocDef[] {
    const px = d.x / WORLD_SCALE, py = d.y / WORLD_SCALE;
    return locsOf(npcMap(d)).filter((l) => types.includes(l.type) && Math.hypot(l.x - px, l.y - py) < maxD && (!f || f(l)));
  }

  // ------------------------------------------------------------ 打算
  private setPlan(d: NpcData, k: PlanK, loc: LocDef | undefined, why: string, until: number, vd: number, rnd: () => number, who?: NpcData) {
    const L = loc ?? LOC_BY_ID.get(d.home);
    let x = d.x, y = d.y;
    if (who && (k === 'revenge' || k === 'rob')) { x = who.x + (rnd() - 0.5) * 300; y = who.y + (rnd() - 0.5) * 300; }
    else if (L) {
      // 你附近的地点才去街巷里找落脚点（贵）；远处的随便落在城中，走近时自会重新寻路
      const pl = this.game.player, cx = L.x * WORLD_SCALE, cy = L.y * WORLD_SCALE;
      if (L.map === ACTIVE_MAP && Math.hypot(cx - pl.x, cy - pl.y) < 9000) { const q = this.N.homeAt(L, rnd, 1000, 700); x = q.x; y = q.y; }
      else { x = cx + (rnd() - 0.5) * 1000; y = cy + (rnd() - 0.5) * 700; }
    }
    d.plan = { k, to: L?.id, who: who?.id, why, until, t0: Math.floor(vd), x: Math.round(x), y: Math.round(y) };
    d.goal = GOAL_OF[k];
    if (!this.N.activeOf(d.id)) { d.tx = d.plan.x!; d.ty = d.plan.y!; }
  }
  /** 给 npc.pickTarget 用：有打算的人照着打算走（劫道 / 寻仇者盯着对方的行踪） */
  steer(d: NpcData, rnd: () => number): boolean {
    const p = d.plan; if (!p || p.x === undefined || p.y === undefined || !d.alive) return false;
    if (p.until < this.game.day - 1) return false;
    if (p.who && (p.k === 'revenge' || p.k === 'rob')) { const t = this.N.byId.get(p.who); if (t && t.alive && npcMap(t) === npcMap(d)) { p.x = Math.round(t.x); p.y = Math.round(t.y); } }
    d.tx = p.x + (rnd() - 0.5) * 240; d.ty = p.y + (rnd() - 0.5) * 160; d.goal = GOAL_OF[p.k];
    return true;
  }
  private keyPillOf(d: NpcData) { return d.realm > 0 && d.stage >= REALMS[d.realm].stages.length - 1 ? KEY_PILL[d.realm] : undefined; }
  private needWhy(d: NpcData) {
    const kp = this.keyPillOf(d);
    if (kp && !(d.bag?.[kp])) return `，攒灵石换一枚${itemDef(kp).name}`;
    if (d.wealth < 20 * Math.pow(4, Math.max(0, d.realm - 1))) return '，换些灵石度日';
    return '';
  }
  private cultWhy(d: NpcData) {
    const kp = this.keyPillOf(d);
    if (kp && d.bag?.[kp]) return `闭关炼化${itemDef(kp).name}，冲击${REALMS[d.realm + 1]?.name ?? ''}期`;
    if (kp) return `卡在${realmName(d.realm, d.stage)}的瓶颈上，闭关打磨法力`;
    return `闭关参悟《${d.gf ?? '吐纳术'}》`;
  }

  // ------------------------------------------------------------ 每日
  daily(days: number) {
    if (days <= 0) return;
    const g = this.game;
    const n = days <= 2 ? 1 : Math.min(90, Math.ceil(days / 2)), step = days / n;
    for (let i = 0; i < n; i++) this.step(step, g.day - days + step * (i + 1));
    this.requests();
  }
  private step(dd: number, vd: number) {
    const N = this.N, list = N.list, rnd = Math.random;
    const pop: Record<string, number> = {};
    this.at.clear(); this.threat.clear(); this.pwc.clear();
    for (const d of list) {
      if (!d.alive || d.ros || d.gz) continue;
      if (!d.canon) pop[npcMap(d)] = (pop[npcMap(d)] ?? 0) + 1;
      if (d.plan?.to) { const a = this.at.get(d.plan.to); if (a) a.push(d); else this.at.set(d.plan.to, [d]); }
      for (const h of d.hate ?? []) { const c = this.threat.get(h.id); if (!c || c.v < h.v) this.threat.set(h.id, { id: d.id, v: h.v }); }
    }
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.alive || d.ros || d.gz) continue;
      this.ensure(d);
      if (d.hate?.length) this.decay(d, dd);
      if (d.born !== undefined && d.hidden) { if (d.age >= 14) this.comeOfAge(d, vd, rnd); continue; }
      if (!this.free(d)) continue;
      if (d.sex === 'f') this.maybeBirth(d, dd, vd, rnd, pop);
      const p = d.plan;
      if (p && vd < p.until) continue;
      if (p) {
        if (N.activeOf(d.id) && (p.k === 'rob' || p.k === 'revenge')) { p.until = vd + 1.5; continue; }   // 当着你的面的事，交给神识内的斗法
        this.resolve(d, vd, rnd);
        if (d.plan === p) d.plan = undefined;
      }
      if (d.alive && !d.plan) this.think(d, vd, rnd);
    }
  }
  private decay(d: NpcData, dd: number) {
    for (const h of d.hate!) h.v -= dd * (h.blood ? 0.004 : 0.03);
    d.hate = d.hate!.filter((h) => h.v >= 8 && !!this.N.byId.get(h.id)?.alive);
    if (d.vend && !this.N.byId.get(d.vend)?.alive) d.vend = undefined;
  }

  // ------------------------------------------------------------ 盘算：接下来做什么
  private think(d: NpcData, vd: number, rnd: () => number) {
    const home = LOC_BY_ID.get(d.home); if (!home) return;
    const P = d.pers, mortal = d.realm === 0 || d.faction === 'mortal';
    const dur = (a: number, b: number) => vd + a + rnd() * (b - a);
    if ((d.inj ?? 0) > vd) return this.setPlan(d, 'heal', home, `回${home.name}养伤`, d.inj!, vd, rnd);
    if ((d.grief ?? 0) > vd) return this.setPlan(d, 'mourn', home, d.griefWhy ?? '为亡故的亲人守丧', d.grief!, vd, rnd);
    // 仇：打得过就去，打不过请人助拳，再不然闭关苦修
    const h = this.topHate(d);
    if (h && h.v >= 55 && !mortal) {
      const t = this.N.byId.get(h.id);
      if (t && t.alive && npcMap(t) === npcMap(d) && this.free2(t)) {
        const gap = this.pw(d) - this.pw(t) + (P === 'arrogant' || P === 'ruthless' ? 3 : P === 'cautious' ? -2 : 0);
        if (gap >= -1) return this.setPlan(d, 'revenge', LOC_BY_ID.get(t.home), h.why, dur(6, 25), vd, rnd, t);
        const hs = this.helpersFor(d, t);
        if (hs.length && rnd() < 0.65) return this.setPlan(d, 'seek', LOC_BY_ID.get(hs[0].home), `去请${hs[0].name}助拳——自知不是${t.name}的对手`, dur(8, 20), vd, rnd, hs[0]);
        if (rnd() < 0.5) return this.setPlan(d, 'cult', home, `闭关苦修，只为有朝一日找${t.name}算账`, dur(30, 90), vd, rnd);
      }
    }
    // 被更强的人记着血仇：深居简出
    const th = this.threat.get(d.id);
    if (th && th.v >= 80 && !mortal && rnd() < 0.35) {
      const o = this.N.byId.get(th.id);
      if (o && o.alive && this.pw(o) > this.pw(d) + 3) { const safe = d.sect ? home : pickOr(this.near(d, ['city', 'sect', 'isle'], 120), rnd) ?? home; return this.setPlan(d, 'hide', safe, `躲着${o.name}，深居简出`, dur(20, 60), vd, rnd); }
    }
    // 散修拜山门
    if (!mortal && !d.sect && (d.faction === 'rogue' || d.faction === 'demon') && d.realm <= 2 && d.age < 60 && P !== 'aloof' && rnd() < 0.035 && this.joinSect(d, vd, rnd)) return;
    const W: [PlanK, number][] = [];
    const bv = this.bagValue(d), poor = d.wealth < 20 * Math.pow(4, Math.max(0, d.realm - 1));
    const single = !this.spouseOf(d) && d.age >= 18 && (mortal ? d.age < 45 : d.age < REALMS[d.realm].life * 0.55);
    const social = this.friendsOf(d).length + this.kidsOf(d).filter((k) => k.alive && !k.hidden).length + this.parentsOf(d).filter((k) => k.alive).length;
    if (mortal) {
      W.push(['farm', 5], ['trade', bv > 30 || d.role === 'merchant' ? 3 : 0.6], ['visit', social ? 1.2 : 0], ['court', single ? 0.7 : 0]);
    } else {
      W.push(['cult', P === 'aloof' ? 6 : P === 'cautious' ? 4.5 : 3.5]);
      W.push(['gather', poor ? 3 : 1.4], ['hunt', (P === 'arrogant' || P === 'ruthless' ? 2.2 : 1.2) * (poor ? 1.6 : 1)]);
      W.push(['trade', bv > 120 * Math.pow(3, d.realm - 1) ? 3.5 : d.faction === 'merchant' ? 3 : 0.5]);
      if (d.sect) W.push(['duty', 3.2]);
      W.push(['visit', social ? (P === 'kind' ? 2 : 1.1) : 0], ['court', single ? (P === 'aloof' ? 0.1 : 0.4) : 0]);
      if ((d.faction === 'rogue' || d.faction === 'demon') && (P === 'greedy' || P === 'ruthless')) W.push(['rob', poor ? 1.5 : 0.8]);
      W.push(['explore', P === 'greedy' || P === 'arrogant' ? 1.1 : 0.55]);
      if ((d.ties ?? []).some((t) => t.k === 'disciple')) W.push(['teach', 0.9]);
    }
    const tot = W.reduce((s, w) => s + w[1], 0); let r = rnd() * tot; let k: PlanK = mortal ? 'farm' : 'cult';
    for (const [kk, w] of W) { if ((r -= w) <= 0) { k = kk; break; } }
    if (!this.makePlan(d, k, vd, rnd)) this.setPlan(d, mortal ? 'farm' : 'cult', home, mortal ? '在家里操持生计' : this.cultWhy(d), dur(15, 50), vd, rnd);
  }
  private makePlan(d: NpcData, k: PlanK, vd: number, rnd: () => number): boolean {
    const home = LOC_BY_ID.get(d.home)!, dur = (a: number, b: number) => vd + a + rnd() * (b - a);
    switch (k) {
      case 'farm': this.setPlan(d, 'farm', home, d.role === 'merchant' ? '照看铺子里的生意' : d.role === 'scholar' ? '在家读书，教几个蒙童' : d.role === 'guard' ? '在城里当差' : '下地干活，养家糊口', dur(15, 45), vd, rnd); return true;
      case 'cult': this.setPlan(d, 'cult', home, this.cultWhy(d), dur(20, 80), vd, rnd); return true;
      case 'gather': {
        const l = pickOr(this.near(d, ['secret', 'danger'], 90, (l) => (l.danger ?? 1) <= d.realm * 2 + 1), rnd); if (!l) return false;
        this.setPlan(d, 'gather', l, `去${l.name}采药${this.needWhy(d)}`, dur(8, 25), vd, rnd); return true;
      }
      case 'hunt': {
        const l = pickOr(this.near(d, ['danger'], 100, (l) => (l.danger ?? 1) <= d.realm * 2 + 2), rnd); if (!l) return false;
        this.setPlan(d, 'hunt', l, `去${l.name}猎妖取丹${this.needWhy(d)}`, dur(8, 25), vd, rnd); return true;
      }
      case 'trade': {
        const ls = this.near(d, ['city', 'town', 'isle'], 120); if (!ls.length) return false;
        const l = ls.find((x) => x.type === 'city') ?? pickR(ls, rnd);
        const goods = Object.keys(d.bag ?? {}).map(itemDef).filter((it) => it.type === 'herb' || it.type === 'material').slice(0, 2).map((it) => it.name);
        const kp = this.keyPillOf(d);
        this.setPlan(d, 'trade', l, goods.length ? `去${l.name}把${goods.join('、')}出手${kp && !d.bag?.[kp] ? `，看看能不能凑够一枚${itemDef(kp).name}` : ''}` : `去${l.name}采买些丹药符箓`, dur(6, 20), vd, rnd); return true;
      }
      case 'duty': this.setPlan(d, 'duty', home, pickR(['替宗门看守药园', '去执事堂领了差事，外出收取供奉', '巡视山门', '替长老炼丹打下手', '在藏经阁抄录典籍', '护送门中弟子下山'], rnd), dur(15, 40), vd, rnd); return true;
      case 'visit': {
        const c = this.tied(d, ['friend', 'sworn', 'kin', 'lover', 'master', 'disciple']).filter((x) => x.o.alive && !x.o.hidden && npcMap(x.o) === npcMap(d));
        const x = pickOr(c, rnd); if (!x) return false;
        const l = LOC_BY_ID.get(x.o.home) ?? home;
        this.setPlan(d, 'visit', l, `去${l.name}探望${x.k === 'lover' ? '道侣' : relWord(x.r)}${x.o.name}`, dur(8, 25), vd, rnd, x.o); return true;
      }
      case 'court': {
        const mp = npcMap(d), R = this.game.rel;
        let best: NpcData | undefined, bs = -1;
        for (const o of this.N.list) {
          if (o === d || o.sex === d.sex || o.age < 18 || (o.realm === 0) !== (d.realm === 0) || Math.abs(o.realm - d.realm) > 1 || Math.abs(o.age - d.age) > (d.realm === 0 ? 12 : 60)) continue;
          if (npcMap(o) !== mp || !this.free2(o) || this.spouseOf(o)) continue;
          const t = R.tieOf(d, o.id); if (t && t.k !== 'friend') continue;
          const s = (o.home === d.home ? 3 : 0) + (t ? 4 : 0) + (o.sect && o.sect === d.sect ? 2 : 0) + rnd() * 3;
          if (s > bs) { bs = s; best = o; }
        }
        if (!best) return false;
        const l = LOC_BY_ID.get(best.home) ?? home;
        this.setPlan(d, 'court', l, `去${l.name}拜访${best.name}——心中对${pron(best)}颇有好感`, dur(12, 35), vd, rnd, best); return true;
      }
      case 'rob': {
        const mp = npcMap(d), R = this.game.rel; let best: NpcData | undefined, bs = 0;
        for (const v of this.N.list) {
          if (v === d || !this.free2(v) || npcMap(v) !== mp || v.realm === 0 && v.faction !== 'merchant' || this.pw(v) > this.pw(d) + 1 || R.tieOf(d, v.id)) continue;
          if (v.sect && v.sect === d.sect) continue;
          const dist = Math.hypot(v.x - d.x, v.y - d.y) / WORLD_SCALE; if (dist > 110) continue;
          const loot = v.wealth + this.bagValue(v) * 0.5, travel = v.plan && ['gather', 'hunt', 'trade', 'visit', 'explore'].includes(v.plan.k) ? 1.6 : 1;
          const s = loot * travel / (1 + dist * 0.05) * (0.5 + rnd());
          if (s > bs) { bs = s; best = v; }
        }
        if (!best || bs < 15) return false;
        this.setPlan(d, 'rob', LOC_BY_ID.get(best.home), `盯上了${best.name}的储物袋`, dur(4, 14), vd, rnd, best); return true;
      }
      case 'explore': {
        const l = pickOr(this.near(d, ['secret', 'danger'], 200), rnd); if (!l) return false;
        this.setPlan(d, 'explore', l, `听说${l.name}有前人遗留的宝物，前去碰碰运气`, dur(20, 55), vd, rnd); return true;
      }
      case 'teach': {
        const s = pickOr(this.tied(d, ['disciple']).map((x) => x.o).filter((o) => o.alive && !o.hidden), rnd); if (!s) return false;
        this.setPlan(d, 'teach', home, `指点徒儿${s.name}修行`, dur(10, 30), vd, rnd, s); return true;
      }
      default: return false;
    }
  }

  // ------------------------------------------------------------ 了结：打算到期，看结果
  private resolve(d: NpcData, vd: number, rnd: () => number) {
    const p = d.plan!;
    if (!this.N.activeOf(d.id) && p.x !== undefined && p.k !== 'revenge' && p.k !== 'rob') { d.x = d.tx = p.x; d.y = d.ty = p.y!; }
    const loc = p.to ? LOC_BY_ID.get(p.to) : undefined;
    switch (p.k) {
      case 'farm': d.wealth += Math.round(2 + rnd() * 6 + (d.role === 'merchant' ? rnd() * 15 : 0)); break;
      case 'cult': this.doCult(d, vd, rnd); break;
      case 'gather': this.doGather(d, loc, vd, rnd); break;
      case 'hunt': this.doHunt(d, loc, vd, rnd); break;
      case 'trade': this.doTrade(d, loc, vd, rnd); break;
      case 'duty': this.doDuty(d, vd, rnd); break;
      case 'visit': this.doVisit(d, vd, rnd); break;
      case 'court': this.doCourt(d, vd, rnd); break;
      case 'rob': { const v = p.who ? this.N.byId.get(p.who) : undefined; if (v && v.alive && npcMap(v) === npcMap(d) && !this.N.activeOf(v.id) && this.free2(v)) this.rob(d, v, vd, rnd); break; }
      case 'revenge': this.doRevenge(d, vd, rnd); break;
      case 'seek': this.doSeek(d, vd, rnd); break;
      case 'explore': this.doExplore(d, loc, vd, rnd); break;
      case 'teach': this.doTeach(d, vd, rnd); break;
      case 'heal': if ((d.inj ?? 0) <= vd) d.inj = undefined; break;
      case 'mourn': if ((d.grief ?? 0) <= vd) { d.grief = undefined; d.griefWhy = undefined; } break;
      default: break;
    }
  }
  private doCult(d: NpcData, vd: number, rnd: () => number) {
    if (d.realm <= 0) return;
    const R = REALMS[d.realm], top = d.stage >= R.stages.length - 1, p = d.plan!;
    let boost = 1;
    for (const id of Object.keys(d.bag ?? {})) { const it = itemDef(id); if (it.type === 'pill' && it.pill && (it.pill.exp || it.pill.expPct) && it.tier <= d.realm + 1) { this.take(d, id, 1); boost += 0.6; break; } }
    const span = Math.max(5, p.until - (p.t0 ?? p.until - 30));
    const need = (R.expDays[Math.min(d.stage, R.expDays.length - 1)] ?? 500) * (d.realm <= 1 ? 1.6 : 0.9);
    if (!top) { if (rnd() < Math.min(0.7, span / need * boost * 0.8)) d.stage++; return; }
    if (d.realm >= 4 || !canAdvance(this.N.list, d)) return;
    const kp = KEY_PILL[d.realm], has = !!kp && (d.bag?.[kp] ?? 0) > 0;
    const ch = (has ? 0.55 : [0, 0.05, 0.03, 0.015][d.realm] ?? 0.01) * Math.min(1.5, span / 40);
    if (has) this.take(d, kp, 1);
    if (rnd() < ch) {
      const r0 = d.realm; d.realm++; d.stage = 0; capRealm(d);
      if (d.realm <= r0) return;
      d.life = REALMS[d.realm].life * (0.9 + rnd() * 0.2);
      this.bio(d, `突破至${REALMS[d.realm].name}期`, vd);
      this.log('break', `${d.name}${has ? `服下${itemDef(kp).name}，` : ''}闭关${Math.round(span)}日，突破至${REALMS[d.realm].name}期！`, [d.id], vd);
      this.celebrate(d, `侥幸突破${REALMS[d.realm].name}期`, vd);
      this.promote(d, vd);
    } else if (has || rnd() < 0.3) {
      d.inj = vd + 20 + rnd() * 60;
      if (has) { this.bio(d, `冲击${REALMS[d.realm + 1].name}失败，经脉受损`, vd); this.log('break', `${d.name}服下${itemDef(kp).name}冲击${REALMS[d.realm + 1].name}失败，经脉受损。`, [d.id], vd); }
    }
  }
  private doGather(d: NpcData, loc: LocDef | undefined, vd: number, rnd: () => number) {
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { const it = pickOr(cands('herb', d.realm, d.home, 3), rnd); if (it) this.give(d, it.id, 1 + Math.floor(rnd() * 2)); }
    const dg = (loc?.danger ?? 1) - d.realm * 1.5;
    if (rnd() < 0.08 + Math.max(0, dg) * 0.05) { d.inj = vd + 10 + rnd() * 30; this.bio(d, `在${loc?.name ?? '山中'}采药时被妖兽所伤`, vd); }
    this.meet(d, loc, vd, rnd);
  }
  private doHunt(d: NpcData, loc: LocDef | undefined, vd: number, rnd: () => number) {
    const got: [string, number][] = [];
    for (let i = 0, n = 1 + Math.floor(rnd() * 2); i < n; i++) { const it = pickOr(cands('mat', d.realm, d.home, 3), rnd); if (it) { this.give(d, it.id); got.push([it.id, 1]); } }
    const dg = (loc?.danger ?? 1) - d.realm * 1.5;
    if (rnd() < 0.12 + Math.max(0, dg) * 0.06) { d.inj = vd + 15 + rnd() * 40; this.bio(d, `在${loc?.name ?? '山中'}猎妖负伤`, vd); }
    else if (got.length && this.known(d) && rnd() < 0.3) this.log('treasure', `${d.name}在${loc?.name ?? '山中'}斩杀妖兽，得了${itemsText(got)}。`, [d.id], vd);
    this.meet(d, loc, vd, rnd);
  }
  private doTrade(d: NpcData, loc: LocDef | undefined, vd: number, rnd: () => number) {
    const L = loc ?? LOC_BY_ID.get(d.home); if (!L) return;
    const z = zoneOfLoc(L), lvl = L.type === 'city' ? 2 : L.type === 'sect' ? 3 : L.type === 'isle' ? 2 : 1;
    const best = this.bestArtifact(d);
    let earned = 0;
    for (const [id, n] of Object.entries({ ...(d.bag ?? {}) })) {
      const it = itemDef(id);
      const sell = it.type === 'herb' || it.type === 'material' || (it.type === 'artifact' && best && it.id !== best.id) || (it.type === 'talisman' && n > 3);
      if (!sell) continue;
      const k = it.type === 'talisman' ? n - 2 : n;
      earned += Math.round(it.price * priceMul(it, z) * (d.faction === 'merchant' ? 0.75 : 0.5) * k);
      this.take(d, id, k);
    }
    d.wealth += earned;
    if (d.realm <= 0) return;
    const buy = (it: ItemDef | undefined, mul = 1) => { if (!it) return false; const price = Math.round(it.price * priceMul(it, z) * mul); if (d.wealth < price * 1.2) return false; d.wealth -= price; this.give(d, it.id); return true; };
    const kp = d.stage >= REALMS[d.realm].stages.length - 2 ? KEY_PILL[d.realm] : undefined;
    if (kp && !d.bag?.[kp]) { const it = itemDef(kp); if ((sellableAt(it, z, lvl + 1, undefined, L.id) || rnd() < 0.15) && buy(it, 1.1)) { this.bio(d, `倾尽积蓄购得${it.name}`, vd); this.log('trade', `${d.name}在${L.name}倾尽积蓄，购得一枚${it.name}。`, [d.id], vd); } }
    buy(pickOr(cands('pill', d.realm, L.id, lvl), rnd));
    if ((d.arts?.length ?? 0) < 5 && rnd() < 0.35) { const s = pickOr(cands('scroll', d.realm, L.id, lvl).filter((it) => !d.arts?.includes(it.id)), rnd); if (s && buy(s)) { (d.arts ??= []).push(s.id); this.bio(d, `在${L.name}购得功法玉简${bookName(s.name)}`, vd); } }
    const a = pickOr(cands('art', d.realm, L.id, lvl).filter((it) => !best || it.tier > best.tier), rnd); if (a && rnd() < 0.5) buy(a);
    if (rnd() < 0.4) buy(pickOr(cands('tal', d.realm, L.id, lvl), rnd));
  }
  private doDuty(d: NpcData, vd: number, rnd: () => number) {
    if (!d.sect) return;
    d.ctb = (d.ctb ?? 0) + Math.round(30 + rnd() * 60 * Math.max(1, d.realm));
    d.wealth += Math.round(5 * Math.pow(3, Math.max(0, d.realm - 1)) * (1 + (d.srk ?? 0)));   // 月俸
    // 宗门论功行赏：卡在大境界瓶颈、贡献够的弟子，赐下突破丹药
    const kp = this.keyPillOf(d);
    if (kp && !d.bag?.[kp] && (d.ctb ?? 0) >= 400 * d.realm && rnd() < 0.25) {
      d.ctb! -= 400 * d.realm; this.give(d, kp);
      this.bio(d, `蒙宗门赐下${itemDef(kp).name}`, vd); this.log('sect', `${this.sectName(d.sect)}论功行赏，赐${d.name}一枚${itemDef(kp).name}。`, [d.id], vd);
    }
    // 藏经阁：用贡献换功法
    if ((d.arts?.length ?? 0) < 5 && (d.ctb ?? 0) > 200 && rnd() < 0.3) {
      const s = pickOr(sectScrolls(d.sect, d.realm).filter((it) => !d.arts?.includes(it.id)), rnd);
      if (s) { (d.arts ??= []).push(s.id); d.ctb! -= 150; this.bio(d, `以宗门贡献换得${bookName(s.name)}`, vd); }
    }
    this.promote(d, vd);
  }
  private promote(d: NpcData, vd: number) {
    if (!d.sect) return;
    let r = d.srk ?? 0;
    while (r < 4 && (d.ctb ?? 0) >= SECT_RANK_NEED[r + 1] && d.realm >= SECT_RANK_REALM[r + 1]) r++;
    if (r <= (d.srk ?? 0)) return;
    d.srk = r;
    this.bio(d, `晋为${SECT_RANKS[r]}`, vd);
    this.log('sect', `${d.name}晋为${this.sectName(d.sect)}${SECT_RANKS[r]}。`, [d.id], vd);
    if (r >= 3) this.takeDisciple(d, vd);
  }
  private takeDisciple(m: NpcData, vd: number) {
    if (this.tied(m, ['disciple']).length >= 3) return;
    const s = this.N.list.find((x) => x.alive && x.sect === m.sect && x !== m && !x.ros && !x.gz && x.realm > 0 && x.realm < m.realm && !x.hidden && !(x.ties ?? []).some((t) => t.k === 'master') && !this.game.rel.tieOf(m, x.id));
    if (!s) return;
    this.game.rel.link(m, s, 'disciple', '徒儿', '师父');
    this.bio(m, `收${s.name}为徒`, vd); this.bio(s, `拜${m.name}为师`, vd);
    this.log('teach', `${this.sectName(m.sect)}${SECT_RANKS[m.srk ?? 0]}${m.name}收${s.name}为入室弟子。`, [m.id, s.id], vd);
  }
  private joinSect(d: NpcData, vd: number, rnd: () => number): boolean {
    const evil = d.faction === 'demon';
    if (!evil && !(d.pers === 'righteous' || d.pers === 'kind' || d.pers === 'cautious')) return false;
    const s = pickOr(this.near(d, ['sect'], 150, (l) => DEMON.has(l.id) === evil && !!SECT_ROBE_OF(l.id)), rnd);
    if (!s) return false;
    d.sect = s.id; d.faction = evil ? 'demon' : 'sect'; d.home = s.id; d.robe = SECT_ROBE_OF(s.id); d.srk = 0; d.ctb = 0; d.gf = SECT_GF[s.id] ?? d.gf;
    this.bio(d, `拜入${this.sectName(s.id)}`, vd);
    this.log('sect', `${d.name}拜入${this.sectName(s.id)}门下，做了外门弟子。`, [d.id], vd);
    this.setPlan(d, 'duty', s, '初入山门，在外门做些杂役', vd + 20 + rnd() * 30, vd, rnd);
    return true;
  }
  private betray(k: NpcData, v: NpcData, vd: number) {
    const sid = k.sect!, sn = this.sectName(sid);
    k.sect = undefined; k.srk = undefined; k.ctb = undefined; k.robe = undefined; if (k.faction !== 'demon') k.faction = 'rogue';
    const town = pickOr(this.near(k, ['town', 'city', 'isle'], 200)); if (town) k.home = town.id;
    this.bio(k, `残害同门${v.name}，叛出${sn}`, vd);
    this.log('sect', `${k.name}残害同门${v.name}，叛出${sn}。${sn}传令门下：见之格杀勿论。`, [k.id, v.id], vd);
    for (const o of this.N.list) if (o.alive && o.sect === sid && o !== k && !o.ros && !o.gz && Math.random() < 0.35) this.addHate(o, k, 45, `叛门之贼，残害同门${v.name}`, vd);
  }
  private doVisit(d: NpcData, vd: number, rnd: () => number) {
    const o = d.plan!.who ? this.N.byId.get(d.plan!.who) : undefined; if (!o || !o.alive) return;
    const R = this.game.rel, t = R.tieOf(d, o.id);
    if (o.wealth < d.wealth * 0.3 && d.wealth > 50 && (d.pers === 'kind' || t?.k === 'kin' || t?.k === 'lover')) {
      const k = Math.round(d.wealth * 0.2); d.wealth -= k; o.wealth += k; this.bio(o, `${d.name}来访，接济了 ${k} 灵石`, vd);
    } else { const gift = Object.keys(d.bag ?? {}).find((id) => itemDef(id).type === 'pill' || itemDef(id).type === 'herb'); if (gift && rnd() < 0.5) { this.take(d, gift); this.give(o, gift); } }
    // 朋友的朋友
    if (rnd() < 0.3) { const ff = this.friendsOf(o).find((x) => x !== d && !R.tieOf(d, x.id)); if (ff) R.link(d, ff, 'friend', '好友', '好友'); }
    // 意气相投：义结金兰
    if (t?.k === 'friend' && d.realm > 0 && o.realm > 0 && (d.pers === 'righteous' || d.pers === 'kind') && (o.pers === 'righteous' || o.pers === 'kind') && rnd() < 0.08) {
      R.unlink(d, o); const older = d.age >= o.age;
      R.link(d, o, 'sworn', older ? (o.sex === 'm' ? '义弟' : '义妹') : (o.sex === 'm' ? '义兄' : '义姐'), older ? (d.sex === 'm' ? '义兄' : '义姐') : (d.sex === 'm' ? '义弟' : '义妹'));
      this.log('friend', `${d.name}与${o.name}义结金兰。`, [d.id, o.id], vd);
    } else if (t?.k === 'friend' && d.sex !== o.sex && !this.spouseOf(d) && !this.spouseOf(o) && (o.realm === 0) === (d.realm === 0) && Math.abs(d.age - o.age) < 30 && rnd() < 0.05) this.wed(d, o, vd);
    this.mediate(d, o, vd, rnd);
  }
  private doCourt(d: NpcData, vd: number, rnd: () => number) {
    const o = d.plan!.who ? this.N.byId.get(d.plan!.who) : undefined;
    if (!o || !o.alive || this.spouseOf(o) || this.spouseOf(d)) return;
    const t = this.game.rel.tieOf(d, o.id);
    let ch = 0.25 + (t?.k === 'friend' ? 0.25 : 0) + (o.pers === d.pers ? 0.1 : 0) - (o.pers === 'aloof' ? 0.25 : 0) - Math.abs(d.realm - o.realm) * 0.15;
    if (o.hate?.some((h) => h.id === d.id)) ch = 0;
    if (rnd() < ch) this.wed(d, o, vd);
    else { this.bio(d, `向${o.name}表露心意，被婉拒`, vd); if (!t) this.game.rel.link(d, o, 'friend', '好友', '好友'); }
  }
  wed(a: NpcData, b: NpcData, vd: number) {
    const R = this.game.rel; if (R.tieOf(a, b.id)) R.unlink(a, b);
    R.link(a, b, 'lover', '道侣', '道侣');
    const mortal = a.realm === 0 && b.realm === 0;
    if (mortal) { const m = a.sex === 'm' ? a : b, f = a.sex === 'm' ? b : a; f.home = m.home; }
    const where = LOC_BY_ID.get(a.home)?.name ?? '';
    this.bio(a, `与${b.name}结为${mortal ? '夫妻' : '道侣'}`, vd); this.bio(b, `与${a.name}结为${mortal ? '夫妻' : '道侣'}`, vd);
    this.log('wed', mortal ? `${a.name}与${b.name}在${where}成亲。` : `${a.name}与${b.name}结为道侣，在${where}设宴。`, [a.id, b.id], vd);
    const host = this.knowsPlayer(a) ? a : b;
    this.celebrate(host, `与${(host === a ? b : a).name}结为${mortal ? '夫妻' : '道侣'}`, vd);
  }
  private maybeBirth(m: NpcData, dd: number, vd: number, rnd: () => number, pop: Record<string, number>) {
    const mortal = m.realm === 0;
    if (rnd() > 1 - Math.pow(1 - (mortal ? 0.28 : 0.035 / Math.max(1, m.realm - 1)), dd / 360)) return;
    if (!m.ties?.some((t) => t.k === 'lover')) return;
    const f = this.spouseOf(m); if (!f || f.sex !== 'm' || npcMap(f) !== npcMap(m) || f.hidden) return;
    if (mortal ? m.age < 17 || m.age > 42 : m.age > REALMS[m.realm].life * 0.6) return;
    if (this.kidsOf(m).length >= (mortal ? 4 : 2)) return;
    const mp = npcMap(m); if ((pop[mp] ?? 0) > (POP_CAP[mp] ?? 300) + 30) return;
    const S = this.S; S.kid++;
    const sex: 'm' | 'f' = rnd() < 0.5 ? 'm' : 'f';
    const nm = makeName(rnd, sex), name = surnameOf(f.name) + nm.slice(surnameOf(nm).length);
    const kid: NpcData = {
      id: 'lk' + Math.floor(vd) + '_' + S.kid, name, sex, role: sex === 'f' ? 'female' : 'farmer', realm: 0, stage: 0, faction: 'mortal', home: m.home,
      pers: rnd() < 0.6 ? (rnd() < 0.5 ? m.pers : f.pers) : pickR(['righteous', 'greedy', 'cautious', 'arrogant', 'kind', 'ruthless', 'aloof'] as Pers[], rnd),
      favor: 0, grudge: 0, met: false, alive: true, age: 0, life: 60 + rnd() * 25, x: m.x, y: m.y, tx: m.x, ty: m.y, goal: 'stay', until: 0, wealth: 0,
      seed: Math.floor(rnd() * 1e9), map: m.map, hidden: true, born: Math.floor(vd), bag: {}, arts: [],
    };
    this.N.list.push(kid); this.N.byId.set(kid.id, kid); pop[mp] = (pop[mp] ?? 0) + 1;
    const R = this.game.rel, kl = sex === 'm' ? '子' : '女';
    R.link(f, kid, 'kin', kl, '父'); R.link(m, kid, 'kin', kl, '母');
    for (const sib of this.kidsOf(m)) if (sib !== kid && sib.alive) R.link(sib, kid, 'kin', sex === 'm' ? '弟' : '妹', sib.sex === 'm' ? '兄' : '姐');
    this.bio(m, `生下${sex === 'm' ? '儿子' : '女儿'}${name}`, vd); this.bio(f, `得${kl}${name}`, vd);
    this.bio(kid, `生于${LOC_BY_ID.get(m.home)?.name ?? '乡野'}，父${f.name}，母${m.name}`, vd);
    this.log('birth', `${f.name}与${m.name}喜得一${kl}，取名${name}。`, [f.id, m.id, kid.id], vd);
    if (!mortal) this.celebrate(this.knowsPlayer(m) ? m : f, `喜得${sex === 'm' ? '麟儿' : '千金'}`, vd);
  }
  private comeOfAge(d: NpcData, vd: number, rnd: () => number) {
    d.hidden = false;
    const ps = this.parentsOf(d), cult = ps.filter((p) => p.realm > 0), home = LOC_BY_ID.get(d.home);
    if (rnd() < (cult.length ? 0.4 : 0.1)) {
      const sp = cult.find((p) => p.sect && p.alive) ?? cult.find((p) => p.sect);
      d.realm = 1; d.stage = 0; d.life = REALMS[1].life * (0.85 + rnd() * 0.3); d.role = d.sex === 'f' ? 'female' : 'cultivator';
      if (sp?.sect) { d.sect = sp.sect; d.faction = sp.faction === 'demon' ? 'demon' : 'sect'; d.home = sp.sect; d.robe = SECT_ROBE_OF(sp.sect); d.srk = 0; d.ctb = 0; }
      else d.faction = 'rogue';
      d.gf = d.sect ? SECT_GF[d.sect] ?? `${this.sectName(d.sect)}心法` : '长春功';
      const pool = d.sect ? sectScrolls(d.sect, 1) : cands('scroll', 1, d.home); d.arts = pool.length ? [pickR(pool, rnd).id] : [];
      d.wealth += 20;
      const L = LOC_BY_ID.get(d.home); if (L && !this.N.activeOf(d.id)) { const q = this.N.homeAt(L, rnd, 1200, 900); d.x = d.tx = q.x; d.y = d.ty = q.y; }
      this.bio(d, d.sect ? `测出灵根，拜入${this.sectName(d.sect)}` : '测出灵根，做了散修', vd);
      this.log('age', `${d.name}年满十四，测出灵根${d.sect ? `，拜入${this.sectName(d.sect)}门下` : '，做了一名散修'}。`, [d.id, ...ps.map((p) => p.id)], vd);
    } else {
      d.role = d.sex === 'f' ? 'female' : pickR(['farmer', 'farmer', 'merchant', 'scholar', 'guard'] as NpcRole[], rnd);
      this.bio(d, '没有灵根，留在家乡', vd);
      if (ps.some((p) => this.known(p))) this.log('age', `${d.name}年满十四，没有灵根，留在${home?.name ?? '家乡'}${d.role === 'merchant' ? '学做买卖' : d.role === 'scholar' ? '读书' : '过日子'}。`, [d.id, ...ps.map((p) => p.id)], vd);
    }
    // 父母的血仇，传给子女
    for (const p of ps) {
      const r = p.sex === 'm' ? '父亲' : '母亲';
      if (!p.alive && p.kb) { const k = this.N.byId.get(p.kb); if (k && k.alive) this.addHate(d, k, 90, `${k.name}杀了${r}${p.name}`, vd, true); }
      for (const h of p.hate ?? []) if (h.blood) { const k = this.N.byId.get(h.id); if (k && k.alive) this.addHate(d, k, h.v * 0.6, `${r}的血仇：${h.why}`, vd, true); }
    }
  }
  private meet(d: NpcData, loc: LocDef | undefined, vd: number, rnd: () => number) {
    if (!loc || rnd() > 0.35) return;
    const others = this.at.get(loc.id); if (!others || others.length < 2) return;
    const o = pickR(others, rnd); if (o === d || !o.alive || !this.free2(o)) return;
    const R = this.game.rel; if (R.tieOf(d, o.id)) return;
    const nice = (x: NpcData) => x.pers === 'kind' || x.pers === 'righteous' || x.pers === 'cautious' || x.pers === 'aloof';
    if ((nice(d) && nice(o)) || rnd() < 0.3) {
      R.link(d, o, 'friend', '好友', '好友');
      this.bio(d, `在${loc.name}结识${o.name}`, vd); this.bio(o, `在${loc.name}结识${d.name}`, vd);
      if (this.known(d) || this.known(o)) this.log('friend', `${d.name}与${o.name}在${loc.name}相识，一见如故。`, [d.id, o.id], vd);
    } else if ((d.pers === 'greedy' || d.pers === 'arrogant' || d.pers === 'ruthless') && o.realm > 0) {
      const what = Object.keys(o.bag ?? {}).map(itemDef).find((it) => it.type === 'herb' || it.type === 'material');
      const why = `在${loc.name}为争一株${what?.name ?? '灵草'}结下梁子`;
      this.addHate(d, o, 30, why, vd); this.addHate(o, d, 35, why, vd);
      if (what && this.pw(d) > this.pw(o)) { this.take(o, what.id); this.give(d, what.id); }
      if (this.known(d) || this.known(o) || (d.realm >= 3 && o.realm >= 3)) this.log('feud', `${d.name}与${o.name}${why}。`, [d.id, o.id], vd);
    }
  }
  private mediate(d: NpcData, o: NpcData, vd: number, rnd: () => number) {
    if (!(o.pers === 'kind' || o.pers === 'righteous')) return;
    const h = (d.hate ?? []).find((x) => !x.blood && x.v < 70 && !!this.game.rel.tieOf(o, x.id));
    if (!h || rnd() > 0.4) return;
    const x = this.N.byId.get(h.id); if (!x || !x.alive) return;
    d.hate = d.hate!.filter((e) => e !== h); x.hate = x.hate?.filter((e) => e.id !== d.id);
    if (this.game.rel.tieOf(d, x.id)?.k === 'foe') this.game.rel.unlink(d, x);
    if (d.vend === x.id) d.vend = undefined; if (x.vend === d.id) x.vend = undefined;
    this.log('peace', `在${o.name}的说和下，${d.name}与${x.name}冰释前嫌（${h.why}）。`, [d.id, x.id, o.id], vd);
  }
  private doTeach(d: NpcData, vd: number, rnd: () => number) {
    const s = d.plan!.who ? this.N.byId.get(d.plan!.who) : undefined; if (!s || !s.alive) return;
    this.ensure(s);
    const art = (d.arts ?? []).find((a) => !s.arts?.includes(a) && itemDef(a).tier <= Math.max(1, s.realm));
    if (art) { (s.arts ??= []).push(art); this.bio(s, `得师父${d.name}传授${bookName(itemDef(art).name)}`, vd); }
    if (s.realm > 0 && s.stage < REALMS[s.realm].stages.length - 1 && rnd() < 0.35) s.stage++;
    const pill = Object.keys(d.bag ?? {}).find((id) => itemDef(id).type === 'pill'); if (pill && rnd() < 0.4) { this.take(d, pill); this.give(s, pill); }
    if (art && (this.known(d) || this.known(s))) this.log('teach', `${d.name}将${bookName(itemDef(art).name)}传给了徒儿${s.name}。`, [d.id, s.id], vd);
  }
  private doSeek(d: NpcData, vd: number, rnd: () => number) {
    const hp = d.plan!.who ? this.N.byId.get(d.plan!.who) : undefined, h = this.topHate(d), t = h ? this.N.byId.get(h.id) : undefined;
    if (!hp || !hp.alive || !h || !t || !t.alive) return;
    const tie = this.game.rel.tieOf(hp, d.id), P = hp.pers;
    let ch = (tie?.k === 'kin' || tie?.k === 'lover' || tie?.k === 'sworn' ? 0.8 : 0.45) * (P === 'kind' || P === 'righteous' ? 1.2 : P === 'cautious' ? 0.6 : P === 'aloof' ? 0.3 : 1);
    if (this.game.rel.tieOf(hp, t.id)) ch *= 0.2;
    if (P === 'greedy' && d.wealth > 50) { const fee = Math.round(d.wealth * 0.4); d.wealth -= fee; hp.wealth += fee; ch = 0.85; }
    if (rnd() < ch) {
      this.setPlan(d, 'revenge', LOC_BY_ID.get(t.home), h.why, vd + 5 + rnd() * 12, vd, rnd, t);
      d.plan!.help = [hp.id];
      this.bio(hp, `应${d.name}之邀，助其向${t.name}寻仇`, vd);
    } else this.bio(d, `请${hp.name}助拳，被婉拒`, vd);
  }
  private doExplore(d: NpcData, loc: LocDef | undefined, vd: number, rnd: () => number) {
    const where = loc?.name ?? '深山', r = rnd(), dg = loc?.danger ?? 2;
    if (r < 0.03 + Math.max(0, dg - d.realm * 1.5) * 0.03) {
      d.kb = '-'; this.N.die(d, `在${where}寻宝时身陨`);
      if (d.realm >= 2 || this.known(d)) this.log('death', `${d.name}在${where}探寻前人遗府，一去不返，储物袋下落不明。`, [d.id], vd);
      return;
    }
    if (r < 0.3) {
      const pool = rnd() < 0.5 ? cands('art', Math.min(5, d.realm + 1), d.home, 4) : cands('scroll', Math.min(4, d.realm + 1), d.home, 4);
      const it = pickOr(pool, rnd); if (!it) return;
      this.give(d, it.id); this.bio(d, `在${where}得到${it.name}`, vd);
      if (it.type === 'scroll' && !d.arts?.includes(it.id) && rnd() < 0.6) (d.arts ??= []).push(it.id);
      if (it.tier >= Math.max(3, d.realm + 1) || (this.known(d) && it.tier >= 2)) {
        this.log('treasure', `${d.name}在${where}得了一件${it.name}，消息不胫而走。`, [d.id], vd);
        // 财帛动人心：附近贪狠之辈盯上了他
        const bad = this.N.list.find((o) => o !== d && this.free2(o) && npcMap(o) === npcMap(d) && (o.pers === 'greedy' || o.pers === 'ruthless') && (o.faction === 'rogue' || o.faction === 'demon') && o.realm > 0 && this.pw(o) >= this.pw(d) - 1 && !o.plan?.who && Math.hypot(o.x - d.x, o.y - d.y) < 80 * WORLD_SCALE && rnd() < 0.5);
        if (bad) this.setPlan(bad, 'rob', LOC_BY_ID.get(d.home), `听说${d.name}在${where}得了${it.name}，起了歹心`, vd + 5 + rnd() * 15, vd, rnd, d);
      }
    } else if (r < 0.45) d.inj = vd + 10 + rnd() * 30;
  }

  // ------------------------------------------------------------ 劫道与仇杀
  /** 劫道：按实力与运气定胜负；劫财、伤人、杀人，样样记账 */
  rob(d: NpcData, v: NpcData, vd: number, rnd: () => number = Math.random) {
    this.ensure(d); this.ensure(v);
    const at = this.whereText(v);
    const roll = this.pw(d) - this.pw(v) - this.alliesOf(v, d).length * 1.5 + (rnd() - 0.5) * 6;
    if (roll > 0) {
      const take = this.transfer(v, d, 0.4 + rnd() * 0.4, 1 + Math.floor(rnd() * 3));
      const what = itemsText(take.items);
      const lethal = d.pers === 'ruthless' ? rnd() < 0.45 : d.faction === 'demon' ? rnd() < 0.3 : rnd() < 0.08;
      if (lethal) {
        this.killed(v, d, `在${at}遭${d.name}劫杀`, vd, false);
        this.log('kill', `${v.name}在${at}遭${d.faction === 'demon' ? '魔修' : '劫修'}${d.name}劫杀，${what ? '身上的' + what + '尽被夺走' : '财物被洗劫一空'}。`, [v.id, d.id], vd);
        this.bio(d, `在${at}劫杀了${v.name}`, vd);
        return;
      }
      v.inj = vd + 8 + rnd() * 25;
      const why = `在${at}被${d.name}劫走了${what || take.stones + ' 灵石'}`;
      this.addHate(v, d, 65 + rnd() * 20, why, vd);
      this.bio(v, why, vd); this.bio(d, `在${at}劫了${v.name}`, vd);
      this.log('rob', `${v.name}在${at}遭${d.name}（${realmName(d.realm, d.stage)}）劫道，${what ? what + '与 ' : ''}${take.stones} 灵石被夺。`, [v.id, d.id], vd);
      for (const t of v.ties ?? []) {
        if (t.k === 'foe') continue;
        const o = this.N.byId.get(t.id); if (!o || !o.alive || o === d || o.hidden) continue;
        this.addHate(o, d, t.k === 'friend' ? 25 : 40, `${t.k === 'lover' ? '道侣' : relWord(this.game.rel.tieOf(o, v.id)?.r ?? t.r)}${v.name}被${d.name}劫过`, vd);
      }
      this.wantHelp(v, d, why, take.items, take.stones, at, vd, 'rob');
    } else if ((v.pers === 'ruthless' || v.pers === 'righteous') && rnd() < 0.25) {
      this.killed(d, v, `劫道不成，反被${v.name}所杀`, vd, true);
      this.log('kill', `${d.name}在${at}拦路劫${v.name}，反被${v.name}斩杀。`, [d.id, v.id], vd);
    } else {
      d.inj = vd + 10 + rnd() * 30;
      this.addHate(v, d, 35, `${d.name}曾在${at}拦路劫道`, vd); this.addHate(d, v, 30, `劫${v.name}不成，反吃了大亏`, vd);
      this.log('rob', `${d.name}在${at}拦路劫${v.name}，反被打得狼狈而逃。`, [d.id, v.id], vd);
    }
  }
  /** v 死在 k 手里：储物袋归 k，亲人结下血仇，残害同门者叛出师门 */
  killed(v: NpcData, k: NpcData, why: string, vd: number, selfDef: boolean) {
    this.ensure(v); this.ensure(k);
    const take = this.transfer(v, k, 1, 6);
    v.kb = k.id;
    this.N.die(v, why);
    this.game.rel.onNpcKill(v, k);
    for (const t of v.ties ?? []) {
      const o = this.N.byId.get(t.id); if (!o || !o.alive || o === k || o.hidden) continue;
      const r = t.k === 'lover' ? '道侣' : relWord(this.game.rel.tieOf(o, v.id)?.r ?? t.r);
      if (t.k === 'kin' || t.k === 'lover' || t.k === 'sworn' || t.k === 'master' || t.k === 'disciple') {
        this.addHate(o, k, selfDef ? 50 : 92, `${k.name}杀了${r}${v.name}`, vd, !selfDef);
        if (!selfDef) this.wantHelp(o, k, `${r}${v.name}被${k.name}所杀`, [], 0, this.whereText(v), vd, 'kin');
      } else if (t.k === 'friend') this.addHate(o, k, selfDef ? 15 : 45, `${k.name}杀了好友${v.name}`, vd);
    }
    if (v.sect && k.sect === v.sect && !selfDef) this.betray(k, v, vd);
    return take;
  }
  private doRevenge(d: NpcData, vd: number, rnd: () => number) {
    const p = d.plan!, t = p.who ? this.N.byId.get(p.who) : undefined;
    if (!t || !t.alive || npcMap(t) !== npcMap(d) || !this.free2(t) || this.N.activeOf(t.id)) return;
    const h = d.hate?.find((x) => x.id === t.id); if (!h) return;
    const helpers = (p.help ?? []).map((id) => this.N.byId.get(id)).filter((x): x is NpcData => !!x && x.alive);
    const mine = this.pw(d) + helpers.reduce((s, x) => s + Math.max(0, this.pw(x) - this.pw(t) + 6) * 0.5, 0);
    const roll = mine - this.pw(t) - this.alliesOf(t, d).length * 1.5 + (rnd() - 0.5) * 6;
    const at = this.whereText(t), wth = helpers.length ? `邀了${helpers.map((x) => x.name).join('、')}助拳，` : '';
    if (roll > 0) {
      if (h.blood || h.v >= 80 || d.pers === 'ruthless') {
        this.killed(t, d, `死于${d.name}之手（${h.why}）`, vd, false);
        d.hate = d.hate!.filter((x) => x.id !== t.id); if (d.vend === t.id) d.vend = undefined;
        this.bio(d, `在${at}手刃仇人${t.name}`, vd);
        this.log('kill', `${d.name}${wth}在${at}找到${t.name}——${h.why}，血债血偿。${t.name}身死道消。`, [d.id, t.id, ...helpers.map((x) => x.id)], vd);
      } else {
        const take = this.transfer(t, d, 0.3, 1); t.inj = vd + 15 + rnd() * 30; h.v = Math.max(0, h.v - 45);
        this.addHate(t, d, 40, `被${d.name}当众打败，颜面扫地`, vd);
        this.log('feud', `${d.name}${wth}在${at}找上${t.name}算旧账，${t.name}落败，赔上 ${take.stones} 灵石才得脱身。`, [d.id, t.id], vd);
      }
    } else if ((t.pers === 'ruthless' || (t.hate?.find((x) => x.id === d.id)?.v ?? 0) >= 70) && rnd() < 0.5) {
      this.killed(d, t, `寻仇不成，反死于${t.name}之手`, vd, true);
      this.log('kill', `${d.name}寻${t.name}报仇，反被${t.name}所杀。这笔血债又添了一笔。`, [d.id, t.id], vd);
    } else {
      d.inj = vd + 15 + rnd() * 40; h.v = Math.min(100, h.v + 5);
      this.log('feud', `${d.name}${wth}在${at}寻${t.name}报仇未果，负伤而退。`, [d.id, t.id], vd);
    }
  }
  /** 死亡：亲人守丧；自然死去的，遗物由子女 / 道侣 / 徒弟继承；牵涉此人的求助随之了结（npc.die 调用） */
  onDeath(d: NpcData, why: string) {
    const R = this.game.rel, vd = this.game.day;
    for (const t of d.ties ?? []) {
      if (t.k !== 'kin' && t.k !== 'lover' && t.k !== 'master' && t.k !== 'disciple' && t.k !== 'sworn') continue;
      const o = this.N.byId.get(t.id); if (!o || !o.alive || o.hidden || !this.free(o)) continue;
      const r = t.k === 'lover' ? '道侣' : relWord(R.tieOf(o, d.id)?.r ?? t.r);
      o.grief = vd + 20 + Math.random() * 60; o.griefWhy = `为${r}${d.name}守丧`;
      if (o.plan && o.plan.k !== 'revenge') o.plan = undefined;
    }
    const slain = /之手|劫杀|所杀|斩杀/.test(why);
    if (!slain && d.kb !== '-' && d.bag && (Object.keys(d.bag).length || d.wealth > 0)) {
      const heirs = [...(d.ties ?? []).filter((t) => t.k === 'kin' && (t.r === '子' || t.r === '女')), ...(d.ties ?? []).filter((t) => t.k === 'lover'), ...(d.ties ?? []).filter((t) => t.k === 'disciple')];
      const ht = heirs.find((t) => this.N.byId.get(t.id)?.alive), h = ht ? this.N.byId.get(ht.id) : undefined;
      if (h) {
        const take = this.transfer(d, h, 1, 12);
        this.bio(h, `继承了${d.name}的遗物`, vd);
        if (d.realm >= 2 || this.known(d) || this.known(h)) this.log('death', `${d.name}${why}。遗下的储物袋${take.items.length ? `（${itemsText(take.items.slice(0, 3))}等）` : ''}由${ht!.k === 'lover' ? '道侣' : ht!.k === 'disciple' ? '徒弟' : relWord(ht!.r)}${h.name}继承。`, [d.id, h.id], vd);
      } else if (d.realm >= 3 || this.known(d)) this.log('death', `${d.name}${why}。`, [d.id], vd);
    }
    for (const q of this.S.reqs) if (!q.done && (q.from === d.id || q.foe === d.id) && !why.includes('韩立')) {
      q.done = true;
      const j = this.game.war.inbox.find((x) => x.id === q.jade);
      if (j && !j.done) { j.done = true; j.text += `\n\n（后来：${d.name}${why}。此事已了。）`; }
    }
    this.S.pend = this.S.pend.filter((p) => p.from !== d.id && p.foe !== d.id);
  }

  // ------------------------------------------------------------ 神识之内：照着打算说话；劫道、寻仇当面发生
  duelReason(A: NpcData, B: NpcData): { k: 'rob' | 'feud'; atk: NpcData } | null {
    if (A.plan?.k === 'rob' && A.plan.who === B.id) return { k: 'rob', atk: A };
    if (B.plan?.k === 'rob' && B.plan.who === A.id) return { k: 'rob', atk: B };
    const ha = A.hate?.find((h) => h.id === B.id)?.v ?? 0, hb = B.hate?.find((h) => h.id === A.id)?.v ?? 0;
    if (Math.max(ha, hb) >= 60) return { k: 'feud', atk: ha >= hb ? A : B };
    return null;
  }
  duelLine(atk: NpcData, def: NpcData, k: 'rob' | 'feud'): [string, string] {
    if (k === 'rob') return [pickR(['留下储物袋，饶你不死！', '此路是我开——把袋子交出来！', `${def.name}，你袋子里的东西，我要了！`]), pickR(['救命！有人劫道！', '休想！', '你、你别过来！'])];
    return [`${def.name}！${atk.hate?.find((x) => x.id === def.id)?.why ?? '旧账'}——今日了断！`, pickR(['来得正好！', '冤冤相报何时了……', '要打便打！'])];
  }
  /** npc.endDuel 的后果：lethal 时返回留在地上的东西（你看见了可以捡） */
  duelEnd(win: NpcData, lose: NpcData, lethal: boolean): { drop: [string, number][]; stones: number } {
    const vd = this.game.day, rob = win.plan?.k === 'rob' && win.plan.who === lose.id;
    if (lethal) {
      const take = this.killed(lose, win, `死于${win.name}之手`, vd, lose.plan?.k === 'rob' && lose.plan.who === win.id);
      const drop = take.items.slice(Math.ceil(take.items.length / 2));
      for (const [id, n] of drop) this.take(win, id, n);
      const stones = Math.round(take.stones * 0.4); win.wealth -= stones;
      this.log('kill', `${win.name}与${lose.name}${rob ? '狭路相逢——劫道' : '斗法'}，${lose.name}身死。`, [win.id, lose.id], vd);
      if (rob) win.plan = undefined;
      return { drop, stones };
    }
    if (rob) {
      const take = this.transfer(lose, win, 0.5, 2), why = `被${win.name}当道劫走了${itemsText(take.items) || take.stones + ' 灵石'}`;
      this.addHate(lose, win, 70, why, vd); this.wantHelp(lose, win, why, take.items, take.stones, this.whereText(lose), vd, 'rob');
      this.log('rob', `${lose.name}${why}。`, [lose.id, win.id], vd); win.plan = undefined;
    } else { const h = win.hate?.find((x) => x.id === lose.id); if (h) h.v -= 30; this.addHate(lose, win, 30, `斗法输给了${win.name}`, vd); }
    lose.inj = vd + 10 + Math.random() * 20; lose.plan = undefined;
    return { drop: [], stones: 0 };
  }
  onscreen(a: OnA, dt: number) {
    const d = a.d; if (!d.plan || a.bubble || a.enemy || a.duel) return;
    const t = (this.bt.get(d.id) ?? 6 + Math.random() * 20) - dt;
    if (t > 0) { this.bt.set(d.id, t); return; }
    this.bt.set(d.id, 25 + Math.random() * 35);
    const p = this.game.player; if (Math.hypot(a.st.x - p.x, a.st.y - p.y) > 1100) return;
    const line = this.planLine(d); if (line) a.bubble = { text: line, t: 3.2 };
  }
  planLine(d: NpcData): string | null {
    const p = d.plan; if (!p) return null;
    const to = p.to ? LOC_BY_ID.get(p.to)?.name ?? '' : '', who = p.who ? this.N.byId.get(p.who)?.name ?? '' : '';
    const L: Record<PlanK, string[]> = {
      cult: ['这一关，务必要破。', '修行如逆水行舟，不进则退……'],
      gather: [`听说${to}一带有灵草出没。`, '采满这一篓，就能换一瓶丹药了。'],
      hunt: [`${to}的妖兽，今日便取它的妖丹！`, '妖丹值钱，命更值钱……小心为上。'],
      trade: [`得赶去${to}，把这些东西出手。`, '这回的货，该能卖个好价钱。'],
      duty: ['师门差事要紧，耽误不得。', '差事做完，还能换些贡献。'],
      visit: [`许久没见${who}了，得去看看。`, `也不知${who}近来可好。`],
      court: [`不知${who}今日可在……`, '（整了整衣襟，有些紧张）'],
      revenge: [`${who}……此仇不报，誓不为人！`, `（攥紧了拳头）${who}，你等着。`],
      rob: ['（四下张望，眼神不善）', '这条道上，近来肥羊不少……'],
      hide: ['近来风声紧，还是少出门为妙。'],
      heal: ['（捂着伤处，脸色苍白）', '这伤……少说还得将养一阵。'],
      mourn: ['（神色黯然，一言不发）', `${p.why}……`],
      explore: [`传闻${to}有前人遗府，碰碰运气。`, '富贵险中求。'],
      teach: ['徒儿这几日的功课，不知练得如何了。'],
      seek: [`得找几个帮手，才好去找人算账。`],
      farm: ['今年的收成还算过得去。', '（擦了把汗）这日头真毒。', '家里还等着我回去呢。'],
    };
    const a = L[p.k]; return a?.length ? pickR(a) : null;
  }
  /** 交谈开场：照着眼下的打算说话 */
  greetLine(d: NpcData): string | null {
    const p = d.plan; if (!p || !d.alive) return null;
    const to = p.to ? LOC_BY_ID.get(p.to)?.name ?? '' : '', who = p.who ? this.N.byId.get(p.who)?.name ?? '' : '';
    const sp = this.spouseOf(d), kids = this.kidsOf(d).filter((k) => k.alive);
    const fam = sp && Math.random() < 0.35 ? `${d.sex === 'm' ? '内人' : '外子'}${sp.name}还在家里等着呢。` : kids.length && Math.random() < 0.3 ? `家里${kids.length > 1 ? kids.length + '个孩子' : '那孩子' + kids[0].name}，正是让人操心的时候。` : '';
    switch (p.k) {
      case 'mourn': return `（${d.name}一身素服）……在下正${p.why}，让道友见笑了。`;
      case 'revenge': return `（${d.name}眼中透着杀意）道友可曾见过${who}？${p.why}——此仇非报不可。`;
      case 'heal': return `（${d.name}面色苍白）前些日子受了伤，正在将养，让道友见笑。`;
      case 'court': return `（${d.name}有些心不在焉）啊……道友。没什么，我在等一个人。`;
      case 'seek': return `道友……（犹豫片刻）罢了，此事不便连累外人。`;
      case 'hide': return '近来不太平，道友也小心些。';
      case 'rob': return null;
      case 'cult': return `近来一直${p.why}，难得出来走动。${fam}`;
      case 'farm': return d.realm === 0 ? `${pickR(['（擦了擦汗）', '（憨厚地笑了笑）', ''])}仙师好。${p.why.startsWith('下地') ? '今年收成还行，托仙师们的福。' : `我这是${p.why}。`}${fam}` : null;
      case 'duty': return `师门差事在身——${p.why}，改日再叙。`;
      case 'visit': return `正要${p.why}，路上遇见道友，也算有缘。${fam}`;
      case 'trade': return `道友见谅，在下正要${p.why}。${fam}`;
      default: return `（${d.name}拱了拱手）道友有礼。在下正要${p.why}。${to && !p.why.includes(to) ? `（去${to}）` : ''}`;
    }
  }
  /** 打听消息：说的是活世界里真发生过的事 */
  rumorFor(d: NpcData): string | null {
    const L = this.S.log, day = this.game.day, mp = npcMap(d), by = this.N.byId;
    const c = L.filter((e) => day - e.d < 150 && !e.ids.includes(d.id) && e.ids.some((id) => { const o = by.get(id); return !!o && npcMap(o) === mp; }));
    if (!c.length) return null;
    const known = c.filter((e) => e.ids.some((id) => this.known(by.get(id))));
    const e = pickR(known.length && Math.random() < 0.6 ? known : c.slice(-30));
    const ago = day - e.d < 3 ? '前两天' : day - e.d < 15 ? '前些日子' : day - e.d < 45 ? '上个月' : '前阵子';
    return `${pickR(['听说', '你听说了吗？', '道上都在传，', '我也是听人说的——'])}${ago}，${e.t}`;
  }

  // ------------------------------------------------------------ 找你帮忙：只有真认识你、真遇上事的人
  private wantHelp(v: NpcData, foe: NpcData, why: string, items: [string, number][], stones: number, at: string, vd: number, kind: 'rob' | 'kin') {
    if (!v.alive || !this.knowsPlayer(v) || !foe.alive || foe.bond || foe.canon || foe.beauty || foe.ros || foe.gz) return;
    const P = this.S.pend; if (P.some((p) => p.from === v.id)) return;
    P.push({ from: v.id, foe: foe.id, why, items, stones, at, day: Math.floor(vd), kind }); if (P.length > 4) P.shift();
  }
  requests() {
    const g = this.game, S = this.S;
    if (!S.pend.length || g.day < S.reqAt || g.hero.realm < 1 || g.hero.dead) return;
    if (S.reqs.some((q) => !q.done && q.until > g.day)) return;
    while (S.pend.length) {
      const c = S.pend.shift()!;
      const v = this.N.byId.get(c.from), foe = this.N.byId.get(c.foe);
      if (!v?.alive || !foe?.alive || g.day - c.day > 45 || npcMap(foe) !== ACTIVE_MAP || !this.knowsPlayer(v)) continue;
      const id = g.war.send({ kind: '求助', from: v.name, fromId: v.id, foeId: foe.id, text: this.reqText(v, foe, c), until: g.day + 30 });
      S.reqs.push({ ...c, jade: id, until: g.day + 30 });
      if (S.reqs.length > 20) S.reqs.splice(0, S.reqs.length - 20);
      S.reqAt = g.day + 25 + Math.random() * 30;
      break;
    }
  }
  private reqText(v: NpcData, foe: NpcData, c: Pend): string {
    const g = this.game, R = g.rel, h = g.hero, tier = R.tier(v);
    const call = v.bond === 'master' ? '徒儿' : v.bond === 'disciple' ? '师父' : v.bond === 'sworn' ? '兄弟' : '韩道友';
    const ago = Math.max(1, Math.round(g.day - c.day));
    const fs = foe.sect ? this.sectName(foe.sect) : foe.faction === 'demon' ? '魔修' : '散修';
    const loc = LOC_BY_ID.get(foe.home)?.name ?? '附近', items = itemsText(c.items);
    const what = c.kind === 'rob'
      ? `${ago}日前，我在${c.at}被${foe.name}劫了道。${items ? `储物袋里的${items}${c.stones ? `，连同 ${c.stones} 灵石，` : ''}都落进了他手里。` : c.stones ? `身上 ${c.stones} 灵石被搜刮一空。` : ''}我也受了伤，这几日才缓过来。`
      : `${ago}日前，我的${c.why}——就在${c.at}。`;
    const foeLine = `此人${realmName(foe.realm, foe.stage)}，${fs}，性子${PERS_NAME[foe.pers]}，如今在${loc}一带落脚${c.kind === 'rob' ? '，抢去的东西多半还在他身上' : ''}。`;
    const ask = c.kind === 'rob'
      ? `论修为我不是他的对手。思来想去，相熟的人里只有道友${h.realm > foe.realm ? '修为远在他之上' : '或可与他一战'}。若道友肯出手，他身上的东西——连我那些在内——道友尽管拿去，事后我另有薄礼相谢。`
      : `这仇我非报不可，可凭我一人，只是送死。道友若肯助我除掉此人，${v.name}此生不忘。`;
    return `${call}，冒昧传讯。\n\n${what}\n\n${foeLine}\n\n${ask}\n\n若道友不便，也无妨——此事本与道友无关，我自会另想办法。\n\n——${v.name}（${tier} · 好感 ${Math.round(v.favor)}）`;
  }
  /** 玉符「求助」的选项（war.jadeNode 调用） */
  jadeOpts(j: { id: number; done?: boolean; fromId?: string; foeId?: string; accepted?: boolean }, back: () => DNode): DOpt[] {
    const g = this.game, q = this.S.reqs.find((x) => x.jade === j.id);
    const foe = j.foeId ? this.N.byId.get(j.foeId) : undefined, v = j.fromId ? this.N.byId.get(j.fromId) : undefined;
    if (j.done || !q || !foe || !foe.alive || !v) return [];
    const p = g.player, dist = Math.max(1, Math.round(Math.hypot(foe.x - p.x, foe.y - p.y) / 260));
    const where = npcMap(foe) === ACTIVE_MAP ? `约 ${dist} 里` : '不在此地';
    return [
      { label: j.accepted ? `指路：${foe.name}眼下的行踪（${where}）` : `应下此事——标出${foe.name}的行踪（${where}）`, tone: 'love', disabled: npcMap(foe) !== ACTIVE_MAP, act: () => {
        j.accepted = true; g.setGuide(foe.x, foe.y, `${foe.name}（${v.name}所托）`);
        g.toast(`已标出${foe.name}的行踪。他会走动——地图上的「仇」字跟着他。`, 'info'); return null;
      } },
      { label: '回信婉拒', act: () => { j.done = true; q.done = true; return { speaker: v.name, title: '回音', text: '（玉符那头沉默片刻）……无妨，本就是我自己的事。道友保重。', options: [{ label: '收起', act: back }] }; } },
    ];
  }
  expireReq(jadeId: number) { const q = this.S.reqs.find((x) => x.jade === jadeId); if (q) q.done = true; }
  /** 你杀了谁：替人报仇的，委托人登门致谢；被他欺负过的人也记你一份情（onEnemyKilled 在 die 之前调用） */
  onPlayerKill(d: NpcData) {
    const g = this.game;
    for (const q of this.S.reqs) {
      if (q.done || q.foe !== d.id) continue;
      q.done = true; const j = g.war.inbox.find((x) => x.id === q.jade); if (j) j.done = true;
      const v = this.N.byId.get(q.from); if (!v || !v.alive) continue;
      v.hate = v.hate?.filter((h) => h.id !== d.id); if (v.vend === d.id) v.vend = undefined;
      g.rel.addFavor(v, 28); v.met = true;
      const gift = Math.max(0, Math.min(Math.round(v.wealth * 0.35), 60 * Math.pow(3, v.realm)));
      if (gift > 0) { v.wealth -= gift; C.addItem(g.hero, 'mat_lingshi', gift); }
      this.bio(v, `托韩立除掉了${d.name}`, g.day);
      g.rel.log(`你替${v.name}除掉了${d.name}。${v.name}感激不尽${gift ? `，奉上 ${gift} 灵石` : ''}。`, 'good');
      g.toast(`${v.name}得知${d.name}伏诛，传讯致谢（好感大增${gift ? `，赠灵石 ${gift}` : ''}）`, 'good');
      this.log('feud', `${d.name}伏诛于韩立之手——据说是受${v.name}之托。`, [d.id, v.id], g.day);
    }
    for (const o of this.N.list) {
      if (!o.alive || o === d) continue;
      const h = o.hate?.find((x) => x.id === d.id);
      if (h && h.v >= 50) { g.rel.addFavor(o, h.blood ? 15 : 6); o.hate = o.hate!.filter((x) => x !== h); }
    }
  }
  /** 喜事请柬：认识你的人突破、成亲、添丁，会请你去坐坐（安静地放进玉符，不打扰） */
  private celebrate(d: NpcData, what: string, vd: number) {
    const g = this.game, S = this.S;
    if (!this.knowsPlayer(d) || npcMap(d) !== ACTIVE_MAP || g.day < S.inviteAt || g.hero.realm < 1 || Math.abs(g.day - vd) > 20) return;
    S.inviteAt = g.day + 40 + Math.random() * 40;
    g.war.send({ kind: '邀约', from: d.name, fromId: d.id, text: `韩道友：在下近日${what}，在${LOC_BY_ID.get(d.home)?.name ?? '寒舍'}略备薄酒。道友若得闲，不妨来坐坐；若是不便，心意到了便好。\n\n——${d.name}`, until: g.day + 20 }, true);
  }
  /** 你的修为够高时，敌人身上的法器功法也让他更难缠 */
  armEnemy(e: { atk: number }, d: NpcData) {
    this.ensure(d);
    const a = this.bestArtifact(d);
    e.atk *= 1 + Math.min(0.2, (d.arts?.length ?? 0) * 0.04) + (a && a.tier >= d.realm ? 0.08 : 0);
  }

  // ------------------------------------------------------------ 察其根底 / 人脉录 / 出关
  planText(d: NpcData): string {
    if (!d.alive) return d.deathNote ? `已故——${d.deathNote}` : '已故';
    if (d.hidden && d.born !== undefined) return `年方${Math.floor(d.age)}岁，尚在父母膝下`;
    const p = d.plan; if (!p) return d.canon || d.beauty ? '各有机缘' : '闲居';
    if (p.k === 'rob' && !this.canPeek(d)) return '行踪诡秘，不知在打什么主意';
    const who = p.who ? this.N.byId.get(p.who)?.name : '';
    return `${PLAN_NAME[p.k]}——${p.why}${p.k === 'rob' && who ? `（${who}）` : ''}`;
  }
  profile(d: NpcData) {
    this.ensure(d);
    const R = this.game.rel, tied = (ks: string[]) => this.tied(d, ks);
    const total = d.wealth + this.bagValue(d);
    return {
      plan: this.planText(d),
      sect: d.sect ? this.sectName(d.sect) : '', rank: d.sect ? SECT_RANKS[d.srk ?? 0] ?? '' : '', ctb: Math.round(d.ctb ?? 0),
      faction: FACTION_TEXT[d.faction] ?? '', gf: d.gf ?? '', arts: (d.arts ?? []).map((id) => itemDef(id).name),
      fam: tied(['kin', 'lover']).map((x) => ({ o: x.o, r: x.k === 'lover' ? '道侣' : relWord(x.r) })),
      friends: tied(['friend', 'sworn']).map((x) => ({ o: x.o, r: x.r })),
      master: tied(['master']).map((x) => x.o), disc: tied(['disciple']).map((x) => x.o),
      hate: (d.hate ?? []).map((h) => ({ o: this.N.byId.get(h.id), v: h.v, why: h.why, blood: !!h.blood })).filter((x) => !!x.o) as { o: NpcData; v: number; why: string; blood: boolean }[],
      hatedBy: this.N.list.filter((o) => o.alive && o !== d && o.hate?.some((h) => h.id === d.id && h.v >= 40)).slice(0, 6),
      canPeek: this.canPeek(d), stones: Math.round(d.wealth),
      bag: (Object.entries(d.bag ?? {}) as [string, number][]).sort((a, b) => itemDef(b[0]).price - itemDef(a[0]).price),
      bagHint: total < 100 ? '袋子干瘪' : total < 1000 ? '略有些家底' : total < 10000 ? '鼓鼓囊囊' : '宝光隐隐，身家不菲',
      bio: d.bio ?? [], tier: R.tier(d),
    };
  }
  profileText(d: NpcData): string {
    const P = this.profile(d), pr = pron(d);
    const L: string[] = [];
    L.push(`【眼下】${P.plan}`);
    L.push(`【门派】${P.sect ? `${P.sect} · ${P.rank}（贡献 ${P.ctb}）` : P.faction}`);
    L.push(`【功法】${P.gf ? `主修《${P.gf}》` : '不曾修行'}${P.arts.length ? `；习得${P.arts.map(bookName).join('')}` : ''}`);
    L.push(`【家小】${P.fam.length ? P.fam.map((x) => `${x.r}${x.o.name}${!x.o.alive ? '（已故）' : x.o.hidden ? `（${Math.floor(x.o.age)}岁）` : ''}`).join('、') : '孑然一身'}`);
    if (P.master.length || P.disc.length) L.push(`【师承】${[...P.master.map((o) => '师父' + o.name), ...P.disc.map((o) => '徒弟' + o.name)].join('、')}`);
    L.push(`【交游】${P.friends.length ? P.friends.slice(0, 6).map((x) => x.o.name + (x.r === '好友' ? '' : `（${x.r}）`) + (x.o.alive ? '' : '（已故）')).join('、') : '少与人往来'}`);
    L.push(`【恩仇】${P.hate.length ? P.hate.map((h) => `${h.blood ? '血仇' : '恨'}${h.o.name}——${h.why}`).join('；') : '与人无怨'}${P.hatedBy.length ? `；${P.hatedBy.map((o) => o.name).join('、')}记恨着${pr}` : ''}`);
    L.push(`【储物袋】${P.canPeek ? `灵石 ${P.stones}${P.bag.length ? '；' + P.bag.slice(0, 8).map(([id, n]) => itemDef(id).name + (n > 1 ? '×' + n : '')).join('、') : '；别无长物'}` : `以你的神识看不透（${P.bagHint}）`}`);
    if (P.bio.length) L.push(`【生平】${P.bio.slice(-4).map((b) => `${dateText(b.d)}${b.t}`).join('；')}`);
    return L.join('\n');
  }
  profileNode(d: NpcData, look: any, title: string, back: () => DNode): DNode {
    return { speaker: d.name, title, look, text: this.profileText(d), options: [{ label: '还有别的事', act: back }, { label: '告辞', act: () => null }] };
  }
  stats() {
    let alive = 0, cult = 0, couples = 0, kids = 0, feuds = 0, sect = 0;
    for (const d of this.N.list) {
      if (!d.alive || d.ros || d.gz) continue;
      alive++; if (d.realm > 0) cult++; if (d.sect) sect++; if (d.hidden && d.born !== undefined) kids++;
      if (d.sex === 'f' && this.spouseOf(d)) couples++;
      feuds += (d.hate ?? []).filter((h) => h.v >= 50).length;
    }
    return { alive, cult, couples, kids, feuds, sect, st: { ...this.S.st } };
  }
  /** 出关：闭关这些日子里，与你相关的人与事（没有就挑几件大事） */
  seclusionNews(since: number): DNode | null {
    const by = this.N.byId, L = this.S.log.filter((e) => e.d >= since);
    if (!L.length) return null;
    const mine = L.filter((e) => e.ids.some((id) => this.known(by.get(id))));
    const pick = (mine.length ? mine : L.filter((e) => e.k === 'break' || e.k === 'kill' || e.k === 'sect' || e.k === 'treasure')).slice(-9);
    if (!pick.length) return null;
    const cnt = (k: LiveK) => L.filter((e) => e.k === k).length, span = this.game.day - since;
    const text = `闭关${span >= 360 ? Math.round(span / 360) + '年' : Math.round(span) + '日'}，洞府外的世界并没有停下来。\n\n${pick.map((e) => `· ${dateText(e.d)}　${e.t}`).join('\n')}\n\n（这段日子里传到耳中的：添丁 ${cnt('birth')}、姻缘 ${cnt('wed')}、身故 ${cnt('death') + cnt('kill')}、劫案 ${cnt('rob')}、突破 ${cnt('break')}。人脉录 N →「天下事」可看详情。）`;
    return { speaker: '世事变迁', title: '闭关期间', mood: 'mystic', text, options: [{ label: '知道了', act: () => null }] } as DNode;
  }
}
