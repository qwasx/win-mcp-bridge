// 第四十二步（v0.42）：活世界 —— 让 NPC 自己活起来
//
// 以前的世界：NPC 是围着你转的“道具”——奇遇里凭空刷出的匿名路人、随机发来的求救玉符。
// 现在的世界：每个 NPC 都有自己的日子，不管你在不在场——
//   · 储物袋：真实的丹药 / 灵草 / 符箓 / 法器 / 灵石，会赚、会花、会送人、会被抢、会被继承，死了留给后人或被凶手夺走；
//   · 功法：按门派流派习得（同门同路数），突破后悟新术，斗法时功法与法器真的算数；
//   · 门派：职司（长老 / 执事 / 内门 / 外门……）、同门情谊、宗门之间的积怨会爆发成真实的摩擦，门人真的会死；
//   · 家庭：结识 → 相恋 → 成婚 → 生子 → 长大成人 → 入宗门 / 修仙；亲人亡故要守孝、继承遗产、替亲人报仇；
//   · 社交：同城的人会闲聊、赠礼、做买卖，结为好友、结拜兄弟，也会结下梁子；
//   · 仇恨：劫道、仇杀、世仇——苦主会闭关苦修、雇凶、亲自寻仇，也会为避祸举家远走；仇人的亲友接着记账；
//   · 众生录（V 键）：神识探查任何一个人——境界压过对方才看得清储物袋；江湖风闻全是这个世界自己发生的事。
import type { Game } from './game';
import { NpcData, npcMap, makeName } from './npc';
import type { DNode, DOpt } from './modal';
import type { Look } from '../gfx/character';
import { LOC_BY_ID, ACTIVE_MAP, MapId, WORLD_SCALE } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import { ITEM_LIST, itemDef, ItemDef } from '../data/items';
import { ART_LIST, ARTS, TIER_NAME, School, SCHOOL_NAME } from '../data/arts';
import { zoneOfLoc, sellableAt, yaodanCap, pzOf, ruleOf, Zone } from '../data/market';
import { mulberry32 } from '../core/rng';
import { SECT_DEF, SECT_DEFS, rankOf as rosRank, sectTitle } from './roster';
import { allyOf, surnameOf } from './relations';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pr = (days: number, rate: number) => 1 - Math.pow(1 - rate, days);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export type Want = '积财' | '问道' | '复仇' | '守家' | '护宗' | '求偶' | '逍遥';
export interface Life {
  bag: [string, number][];                 // 储物袋（灵石另记在 wealth）
  arts: string[];                          // 所会功法
  gear?: string;                           // 本命法器
  school: School;                          // 主修流派
  want: Want; mood: number;                // 心愿 / 心境 0-100
  aff: Record<string, number>;             // 对他人的亲疏 -100…100
  bio: [number, string][];                 // 近事（只留最近几条）
  st?: { k: 'mourn' | 'wed' | 'recover' | 'seclude'; until: number };
  lr?: number;                             // 上次记下的大境界（用来发现突破）
  born?: number;                           // 出生日（幼童，长大前不在世上走动）
  wk?: number;                             // 下一次改心愿
}
export interface FeedItem { day: number; text: string; map?: MapId; imp: 1 | 2; ids?: string[] }
interface LwState { feed: FeedItem[]; feud: Record<string, number>; n: number; kids: number; births: number; weds: number; deaths: number }

// ------------------------------------------------------------ 门派流派（同门同路数）
const SECT_SCHOOL: Record<string, School[]> = {
  huangfeng: ['木', '火'], yanyue: ['冰', '身'], lingshou: ['御', '木'], qingxu: ['剑', '阵'], huadao: ['体', '剑'], tianque: ['土', '体'], jujian: ['剑', '体'],
  luoyun: ['风', '剑'], gujian: ['剑', '阵'], baiqiao: ['符', '阵'], guiling: ['魔', '识'], hehuan: ['魔', '身'], yuling: ['魔', '御'], qianhuan: ['识', '魔'],
  tiansha: ['魔', '体'], yinluo: ['魔', '冰'], tianmo: ['魔', '火'], taiyi: ['雷', '剑'], huayi: ['剑', '风'], qianzhu: ['木', '阵'], tianlan: ['土', '火'],
  miaoyin: ['识', '风'], qixuan: ['体', '身'], tianxing: ['雷', '符'], leikong: ['雷', '风'], mulan: ['火', '体'], yejia: ['剑', '符'],
};
const ALL_SCHOOLS = Object.keys(SCHOOL_NAME) as School[];
const PERS_SCHOOL: Record<string, School[]> = { righteous: ['剑', '体'], greedy: ['符', '身'], cautious: ['阵', '木'], arrogant: ['雷', '火'], kind: ['木', '冰'], ruthless: ['魔', '火'], aloof: ['风', '识'] };
const CAP: Record<MapId, number> = { tiannan: 300, luanxing: 140, dajin: 420 };
const BAG_TYPES = new Set(['herb', 'pill', 'material', 'artifact', 'talisman', 'scroll']);
const PERS_NAME: Record<string, string> = { righteous: '正直', greedy: '贪婪', cautious: '谨慎', arrogant: '傲慢', kind: '温和', ruthless: '狠辣', aloof: '淡泊' };

const poolMem = new Map<string, ItemDef[]>();
function poolOf(z: Zone): ItemDef[] {
  let p = poolMem.get(z); if (p) return p;
  const yc = yaodanCap(pzOf(z), 3, () => 0.5);
  p = ITEM_LIST.filter((it) => BAG_TYPES.has(it.type) && it.price > 0 && ruleOf(it).g >= 2 && sellableAt(it, z, 3, yc));
  poolMem.set(z, p); return p;
}

export const fightPower = (d: NpcData): number => {
  const L = d.lw; let p = d.realm * 13 + d.stage;
  if (L) {
    p += Math.min(6, L.arts.reduce((s, a) => s + ((ARTS[a]?.tier ?? 0) + 1) * 0.6, 0));
    if (L.gear) p += itemDef(L.gear).tier * 1.4 + 1;
    p += Math.min(3, L.bag.filter(([id]) => itemDef(id).type === 'talisman').length * 0.8);
    if (L.st?.k === 'recover') p -= 5;
  }
  return p;
};

export class LivingWorld {
  game: Game;
  killer: NpcData | null = null;       // 当前这桩死亡的凶手（给 onDeath 用）
  private looted = new Set<string>();  // 被玩家搜过储物袋的
  private today = 0;                   // 今日已死人数（限流）
  private grp = new Map<string, NpcData[]>();
  constructor(g: Game) { this.game = g; }
  get S(): LwState { const f = this.game.ws.flags as any; return (f.lw ??= { feed: [], feud: {}, n: 0, kids: 0, births: 0, weds: 0, deaths: 0 } as LwState); }
  private get N() { return this.game.npcs; }
  private get R() { return this.game.rel; }

  // ============================================================ 生成：储物袋 / 功法 / 流派
  L(d: NpcData): Life {
    if (d.lw) return d.lw;
    const z = zoneOfLoc(LOC_BY_ID.get(d.home));
    const r = mulberry32((d.seed ^ 0x5bd1e995) >>> 0);
    const school: School = (d.sect && SECT_SCHOOL[d.sect]?.[0]) || (d.sect ? ALL_SCHOOLS[hash(d.sect) % ALL_SCHOOLS.length] : pick2(PERS_SCHOOL[d.pers] ?? ['剑'], r));
    const L: Life = { bag: [], arts: [], school, want: '逍遥', mood: 45 + Math.floor(r() * 25), aff: {}, bio: [], lr: d.realm };
    // 储物袋
    const pool = poolOf(z), cap = Math.min(5, d.realm + (r() < 0.12 ? 1 : 0));
    const n = d.realm === 0 ? Math.floor(r() * 3) : 2 + d.realm + Math.floor(r() * 3) + (d.faction === 'merchant' ? 3 : 0);
    for (let i = 0; i < n; i++) {
      const c = pool.filter((it) => it.tier <= cap && (d.realm > 0 || it.tier === 0));
      if (!c.length) break;
      const it = c[Math.floor(r() * c.length)];
      this.put(L, it.id, it.type === 'artifact' ? 1 : 1 + Math.floor(r() * (it.tier <= 1 ? 3 : 2)));
    }
    if (d.realm >= 1) {
      const arti = pool.filter((it) => it.type === 'artifact' && it.tier <= Math.min(cap, d.realm) && it.tier >= Math.max(0, d.realm - 2));
      if (arti.length) { const it = arti[Math.floor(r() * arti.length)]; L.gear = it.id; this.put(L, it.id, 1); }
    }
    // 功法
    if (d.realm >= 1) {
      const want = d.realm === 1 ? 1 + (r() < 0.5 ? 1 : 0) : Math.min(5, d.realm + 1);
      const sch: School[] = [school, ...(d.sect ? (SECT_SCHOOL[d.sect]?.slice(1) ?? []) : [])];
      const base = ART_LIST.filter((a) => a.realm <= d.realm && a.tier <= Math.min(4, d.realm) && !a.needs && (a.school !== '魔' || d.faction === 'demon'));
      const mine = base.filter((a) => sch.includes(a.school));
      for (let i = 0; i < want * 4 && L.arts.length < want; i++) {
        const src = (i < 3 || r() < 0.65) && mine.length ? mine : base; if (!src.length) break;
        const a = src[Math.floor(r() * src.length)]; if (!L.arts.includes(a.id)) L.arts.push(a.id);
      }
    }
    d.lw = L;
    L.want = this.pickWant(d);
    return L;
  }
  private pickWant(d: NpcData): Want {
    if (d.vend && this.N.byId.get(d.vend)?.alive) return '复仇';
    const kids = this.kidsOf(d).length;
    if (this.spouseOf(d) && kids) return '守家';
    if (d.wealth < 12 * Math.pow(3, d.realm)) return '积财';
    if (d.sect && d.realm >= 2 && Math.random() < 0.5) return '护宗';
    if (!this.spouseOf(d) && d.age >= 18 && d.age < 50 && Math.random() < 0.4) return '求偶';
    return d.realm > 0 && Math.random() < 0.6 ? '问道' : '逍遥';
  }
  private put(L: Life, id: string, n = 1) { const e = L.bag.find((b) => b[0] === id); if (e) e[1] += n; else L.bag.push([id, n]); }
  private take(L: Life, id: string, n = 1) { const e = L.bag.find((b) => b[0] === id); if (!e) return false; e[1] -= n; if (e[1] <= 0) L.bag.splice(L.bag.indexOf(e), 1); return true; }
  bio(d: NpcData, text: string) { const L = this.L(d); L.bio.push([Math.floor(this.game.day), text]); if (L.bio.length > 8) L.bio.shift(); }

  // ============================================================ 亲缘（以人脉网 ties 为底）
  spouseOf(d: NpcData): NpcData | undefined { for (const t of d.ties ?? []) if (t.k === 'lover') { const o = this.N.byId.get(t.id); if (o?.alive) return o; } return undefined; }
  private tieList(d: NpcData, f: (r: string, k: string) => boolean): NpcData[] { return (d.ties ?? []).filter((t) => f(t.r, t.k)).map((t) => this.N.byId.get(t.id)!).filter((o) => o && o.alive); }
  kidsOf(d: NpcData) { return this.tieList(d, (r, k) => k === 'kin' && (r === '子' || r === '女')); }
  parentsOf(d: NpcData) { return this.tieList(d, (r, k) => k === 'kin' && (r === '父' || r === '母')); }
  sibsOf(d: NpcData) { return this.tieList(d, (r, k) => k === 'kin' && ['兄', '弟', '姐', '妹'].includes(r)); }
  private tieK(a: NpcData, b: NpcData) { return a.ties?.find((t) => t.id === b.id)?.k; }
  /** 借用：奇遇 / 求救里登场的真人，场景期间从世上“摘出”，结束再放回 */
  lent = new Set<string>();
  lend(d: NpcData) { d.hidden = true; d.lent = true; this.lent.add(d.id); this.N.active.delete(d.id); }
  giveBack(id: string, x?: number, y?: number) {
    this.lent.delete(id); const d = this.N.byId.get(id); if (!d) return;
    d.hidden = false; d.lent = false;
    if (x !== undefined && y !== undefined && d.alive) { d.x = d.tx = x; d.y = d.ty = y; d.goal = 'stay'; d.until = 0; }
  }
  free(d: NpcData) { return d.alive && !d.hidden && !d.lent && !d.chasing && !d.hunting && !d.canon && !d.beauty && !d.stay && !d.ros && !d.gz && !d.bond && !d.orig && npcMap(d) === ACTIVE_MAP && !this.N.active.has(d.id); }
  rogueish(d: NpcData) { return d.realm >= 1 && (d.faction === 'rogue' || d.faction === 'demon') && (d.pers === 'greedy' || d.pers === 'ruthless' || d.pers === 'arrogant'); }
  pickReal(f: (d: NpcData) => boolean, tries = 90): NpcData | null {
    const L = this.N.list; if (!L.length) return null;
    for (let i = 0; i < tries; i++) { const d = L[Math.floor(Math.random() * L.length)]; if (this.free(d) && f(d)) return d; }
    return null;
  }
  /** 一桩真实的追杀：苦主 + 他真正的仇人 */
  pickFeud(): { victim: NpcData; hunter: NpcData } | null {
    for (let i = 0; i < 120; i++) {
      const v = this.N.list[Math.floor(Math.random() * this.N.list.length)];
      if (!v || !this.free(v) || v.realm < 1 || !v.sect) continue;
      const ids = [v.vend, ...(v.ties ?? []).filter((t) => t.k === 'foe').map((t) => t.id)].filter(Boolean) as string[];
      for (const id of ids) { const h = this.N.byId.get(id); if (h && this.free(h) && h.realm >= 1 && (h.faction === 'rogue' || h.faction === 'demon') && fightPower(h) >= fightPower(v) - 3 && h.sect !== v.sect) return { victim: v, hunter: h }; }
    }
    return null;
  }
  /** 追杀收场：被追上的苦主会死；被你救下的会记你的恩 */
  chaseEnd(v: NpcData, h: NpcData, caught: boolean, saved: boolean) {
    if (!v.alive || !h.alive) return;
    if (caught) { this.spoils(v, h); this.bio(h, `追杀并杀了${v.name}`); this.S.deaths++; this.killer = h; this.N.die(v, `被${h.name}追杀致死`, h); this.killer = null; this.R.onNpcKill(v, h); this.post(`${v.name}被${h.name}一路追杀，殒命荒野，储物袋被洗劫一空。`, { map: npcMap(v), imp: this.imp2(v, h), ids: [v.id, h.id] }); }
    else if (saved) { v.favor = clamp(v.favor + 25, -100, 100); v.met = true; this.bio(v, '被韩立救下，逃过一劫'); this.post(`${v.name}被${h.name}追杀，幸得韩立出手相救。`, { map: npcMap(v), imp: 2, ids: [v.id, h.id] }); }
  }
  /** 好友遇劫：先发传音求救，等你来——不去，才当真发生 */
  trySos(a: NpcData, b: NpcData): boolean {
    const g = this.game, war = g.war as any;
    if (!(b.met && b.favor >= 20) || npcMap(b) !== ACTIVE_MAP || g.hero.realm < 1 || Math.random() > 0.75) return false;
    if (war.inbox.some((j: any) => j.kind === '求救' && !j.done) || (this.S as any).sosCd > g.day) return false;
    (this.S as any).sosCd = g.day + 25;
    const place = LOC_BY_ID.get(b.home)?.name ?? '城外';
    war.send({ kind: '求救', from: b.name, fromId: b.id, robber: a.id, x: b.x, y: b.y, until: g.day + 5, text: `韩兄！${a.name}（${realmName(a.realm, a.stage)}）带着人把我堵在${place}外，灵力将尽……若能赶来，此恩必报！\n\n（五日之内赶到——地图上已标出位置）` });
    return true;
  }
  /** 你没去：事情照样发生（真实的劫案） */
  sosFail(vid: string, rid: string) {
    const v = this.N.byId.get(vid), a = this.N.byId.get(rid); if (!v || !a || !v.alive || !a.alive) return;
    this.giveBack(rid); this.giveBack(vid);
    this.clash(a, v, 'rob');
  }
  stockOf(d: NpcData, priceOf: (it: ItemDef) => number) {
    const L = this.L(d);
    return L.bag.filter(([id]) => id !== L.gear && itemDef(id).price > 0 && itemDef(id).type !== 'misc').slice(0, 12).map(([id, n]) => ({ id, price: priceOf(itemDef(id)), n }));
  }
  onSold(d: NpcData, id: string, price: number) { const L = this.L(d); this.take(L, id, 1); d.wealth += price; }
  /** 夺宝：灵石六成，储物袋里最好的几件 */
  spoils(v: NpcData, k: NpcData) {
    const Lv = this.L(v), Lk = this.L(k);
    k.wealth += Math.round(v.wealth * 0.6); v.wealth = Math.round(v.wealth * 0.4);
    const items = Lv.bag.slice().sort((x, y) => itemDef(y[0]).price - itemDef(x[0]).price).slice(0, 4);
    for (const [id, n] of items) { this.take(Lv, id, n); this.put(Lk, id, n); }
    if (Lv.gear && Math.random() < 0.5 && itemDef(Lv.gear).tier > (Lk.gear ? itemDef(Lk.gear).tier : -1)) Lk.gear = Lv.gear;
  }
  private canonish = (d: NpcData) => !!(d.canon || d.met || d.beauty || d.orig);

  rankText(d: NpcData): string {
    if (!d.sect) return d.faction === 'merchant' ? '行商' : d.faction === 'rogue' ? '散修' : d.faction === 'mortal' ? '凡人' : '';
    const def = SECT_DEF.get(d.sect);
    if (d.ros && def && d.rosI !== undefined) return rosRank(def, d.rosI);
    return d.realm >= 4 ? '太上长老' : d.realm >= 3 ? '长老' : d.realm === 2 ? '执事' : d.realm === 1 && d.stage >= 7 ? '内门弟子' : d.realm === 1 ? '外门弟子' : '杂役';
  }
  activity(d: NpcData): string {
    const L = d.lw, day = this.game.day;
    if (L?.st && L.st.until > day) return ({ mourn: '披麻守孝', wed: '新婚燕尔', recover: '闭门养伤', seclude: '闭关苦修' } as any)[L.st.k];
    const foe = d.vend ? this.N.byId.get(d.vend) : undefined;
    if (foe?.alive) return `四处寻访仇家${foe.name}`;
    if (d.chasing) return '正追杀着什么人';
    if (d.hunting) return '正循着你的气息赶来';
    if (d.faction === 'merchant') return '行商贩货';
    if (d.faction === 'mortal') return d.goal === 'travel' ? '赶集进城' : '耕织度日';
    return ({ travel: '赶路', stay: d.sect ? '宗门静修' : '居家静修', seclude: '闭关', hunt: '外出猎妖', gather: '入山采药' } as any)[d.goal] ?? '修行';
  }

  // ============================================================ 播报
  post(text: string, o: { map?: MapId; imp?: 1 | 2; ids?: string[] } = {}) {
    const g = this.game, S = this.S, imp = o.imp ?? 1;
    S.feed.push({ day: Math.floor(g.day), text, map: o.map, imp, ids: o.ids });
    if (S.feed.length > 120) S.feed.splice(0, S.feed.length - 120);
    if (imp >= 2) g.news(text, 'rumor');
  }
  private adj(a: NpcData, b: NpcData, v: number) {
    const L = this.L(a); const o = L.aff[b.id] ?? 0; L.aff[b.id] = clamp(o + v, -100, 100);
    const ks = Object.keys(L.aff);
    if (ks.length > 12) { let w = ks[0]; for (const k of ks) if (Math.abs(L.aff[k]) < Math.abs(L.aff[w]) && k !== b.id) w = k; delete L.aff[w]; }
  }
  affOf(a: NpcData, b: NpcData) { return a.lw?.aff[b.id] ?? 0; }
  private note(d: NpcData): 1 | 2 { return this.canonish(d) ? 2 : 1; }
  private imp2(a: NpcData, b?: NpcData): 1 | 2 { return this.note(a) >= 2 || (b && this.note(b) >= 2) ? 2 : 1; }

  // ============================================================ 每日：众生的日子
  daily(days: number) {
    const g = this.game, N = this.N, n = Math.min(days, 8);
    this.today = 0;
    this.grp.clear();
    for (const d of N.list) if (d.lent && !this.lent.has(d.id)) { d.lent = false; d.hidden = false; }   // 读档后残留的“借用”
    for (const d of N.list) { if (!d.alive || d.hidden || d.chasing) continue; let a = this.grp.get(d.home); if (!a) this.grp.set(d.home, a = []); a.push(d); }
    for (const d of N.list.slice()) {
      if (!d.alive) continue;
      const L = this.L(d);
      if (d.hidden && L.born !== undefined) { if (d.age >= 16) this.grow(d); continue; }
      if (d.hidden || d.chasing) continue;
      if (L.st && L.st.until <= g.day) L.st = undefined;
      L.mood += (50 - L.mood) * 0.02 * n;
      const grp = this.grp.get(d.home) ?? [];
      if (Math.random() < pr(n, 0.06)) this.live(d, L);
      if (grp.length > 1 && Math.random() < pr(n, d.faction === 'mortal' ? 0.025 : 0.04)) this.socialize(d, grp);
      const wife = d.sex === 'm' ? this.spouseOf(d) : undefined;
      if (wife && wife.sex === 'f' && !d.canon && !d.beauty && Math.random() < pr(n, 0.0008)) this.birth(wife, d);
      if (!this.N.active.has(d.id) && !d.bond) {
        if (this.today < 2 && this.crimeable(d) && Math.random() < pr(n, 0.0045)) this.rob(d, grp);
        else if (d.vend && Math.random() < pr(n, 0.011)) this.avenge(d, grp);
        else if (this.today < 2 && Math.random() < pr(n, 0.0016)) this.brawl(d, grp);
      }
    }
    this.sectPolitics(n);
  }

  /** 过日子：赚钱、花钱、嗑丹、悟功法、换心愿、发现突破 */
  private live(d: NpcData, L: Life) {
    const g = this.game, day = g.day;
    if (L.lr === undefined) L.lr = d.realm;
    if (d.realm > L.lr) {   // 突破了：悟新术、换职司
      L.lr = d.realm; L.mood = Math.min(100, L.mood + 25);
      const a = this.learn(d, L); this.bio(d, `突破至${REALMS[d.realm].name}${a ? '，悟得' + a : ''}`);
      if (d.sect && d.realm >= 2) this.bio(d, `擢升为${this.rankText(d)}`);
    }
    const z = zoneOfLoc(LOC_BY_ID.get(d.home));
    // 收入
    const base = d.faction === 'mortal' ? 1.2 : 6 * Math.pow(2.6, d.realm);
    d.wealth += Math.round(base * rand(0.4, 1.4) * (d.faction === 'merchant' ? 2.2 : d.goal === 'hunt' ? 1.6 : 1));
    // 采到东西
    if (d.realm >= 1 && (d.goal === 'gather' || d.goal === 'hunt' || Math.random() < 0.2) && Math.random() < 0.5 && L.bag.length < 14) {
      const c = poolOf(z).filter((it) => it.tier <= Math.min(5, d.realm) && (it.type === 'herb' || it.type === 'material' || (d.faction === 'merchant' && it.type !== 'scroll')));
      if (c.length) this.put(L, pick(c).id, 1);
    }
    // 置办家当：手头宽裕就去坊市买丹药；行商进货
    if (d.realm >= 1 && L.bag.length < 9 && Math.random() < 0.25) {
      const wantPill = !L.bag.some(([id]) => itemDef(id).type === 'pill') && d.faction !== 'merchant';
      const c = poolOf(z).filter((it) => it.tier <= Math.min(5, d.realm + (d.faction === 'merchant' ? 1 : 0)) && (wantPill ? it.type === 'pill' && (it.pill?.exp ?? 0) > 0 : d.faction === 'merchant' && it.type !== 'scroll'));
      if (c.length) { const it = pick(c), cost = Math.round(it.price * (d.faction === 'merchant' ? 0.7 : 1.1)); if (d.wealth >= cost * 3) { d.wealth -= cost; this.put(L, it.id, 1 + (it.tier === 0 ? 1 : 0)); } }
    }
    // 嗑丹助修行
    if (d.realm >= 1 && d.realm < 5 && Math.random() < 0.06) {
      const pill = L.bag.find(([id]) => itemDef(id).type === 'pill' && (itemDef(id).pill?.exp ?? 0) > 0);
      if (pill) {
        this.take(L, pill[0], 1);
        const R = REALMS[d.realm];
        if (d.stage < R.stages.length - 1 && Math.random() < 0.3 + itemDef(pill[0]).tier * 0.05) { d.stage++; this.bio(d, `服下${itemDef(pill[0]).name}，修为精进`); }
      }
    }
    // 读玉简悟功法
    const sc = L.bag.find(([id]) => itemDef(id).type === 'scroll');
    if (sc && Math.random() < 0.25) { this.take(L, sc[0], 1); const a = this.learn(d, L); if (a) this.bio(d, `参悟玉简，学会${a}`); }
    // 变卖多余的东西换灵石
    if (L.bag.length > 10) { const x = L.bag.find(([id]) => id !== L.gear && itemDef(id).type !== 'artifact'); if (x) { this.take(L, x[0], 1); d.wealth += Math.round(itemDef(x[0]).price * 0.5); } }
    // 家用：养家的开销
    const kids = this.kidsOf(d).filter((k) => k.hidden);
    d.wealth = Math.max(0, d.wealth - Math.round((d.faction === 'mortal' ? 0.6 : 2.5 * Math.pow(2.4, d.realm)) * (1 + kids.length * 0.4)));
    // 接济：给老父老母、孩子送钱
    if (d.wealth > 80 * Math.pow(3, d.realm)) for (const p of this.parentsOf(d).concat(kids)) if (p.wealth < d.wealth * 0.3) { const t = Math.round(d.wealth * 0.15); d.wealth -= t; p.wealth += t; break; }
    // 换心愿
    if ((L.wk ?? 0) <= day) { L.wk = day + rand(60, 180); L.want = this.pickWant(d); }
  }
  private learn(d: NpcData, L: Life): string | null {
    const sch: School[] = [L.school, ...(d.sect ? (SECT_SCHOOL[d.sect]?.slice(1) ?? []) : [])];
    const c = ART_LIST.filter((a) => a.realm <= d.realm && a.tier <= Math.min(4, d.realm) && !a.needs && !L.arts.includes(a.id) && (a.school !== '魔' || d.faction === 'demon'));
    if (!c.length || L.arts.length >= 6) return null;
    const m = c.filter((a) => sch.includes(a.school)), a = pick(m.length && Math.random() < 0.7 ? m : c);
    L.arts.push(a.id); return a.name;
  }

  // ============================================================ 社交：闲聊、赠礼、买卖、结交、结怨、相恋
  private compat(a: NpcData, b: NpcData): number {
    let c = 0;
    if (a.sect && a.sect === b.sect) c += 0.6;
    const good = (x: NpcData) => x.pers === 'righteous' || x.pers === 'kind', bad = (x: NpcData) => x.pers === 'ruthless' || (x.pers === 'greedy' && x.faction !== 'merchant');
    if (good(a) && good(b)) c += 0.35;
    if ((good(a) && bad(b)) || (good(b) && bad(a))) c -= 0.8;
    if (a.pers === 'arrogant' && b.pers === 'arrogant') c -= 0.5;
    if ((a.faction === 'demon') !== (b.faction === 'demon')) c -= 0.35;
    if (a.faction === b.faction) c += 0.15;
    if (a.sect && b.sect && a.sect !== b.sect) { const f = this.S.feud[this.fk(a.sect, b.sect)] ?? 0; c -= Math.min(0.8, f / 18); }
    const k = this.tieK(a, b); if (k === 'kin' || k === 'sworn' || k === 'friend' || k === 'lover') c += 0.5; else if (k === 'foe') c -= 0.9;
    return c;
  }
  private socialize(a: NpcData, grp: NpcData[]) {
    const R = this.R;
    const b = grp[Math.floor(Math.random() * grp.length)];
    if (!b || b === a || !b.alive || b.hidden) return;
    if ((a.faction === 'mortal') !== (b.faction === 'mortal') && Math.random() < 0.7) return;
    const c = this.compat(a, b), dv = 3.2 * c + rand(-1.6, 2.4);
    this.adj(a, b, dv); this.adj(b, a, dv + rand(-1, 1));
    const La = this.L(a), Lb = this.L(b);
    // 赠礼 / 买卖
    if (this.affOf(a, b) >= 30 && Math.random() < 0.18 && La.bag.length) {
      const it = La.bag.find(([id]) => id !== La.gear && itemDef(id).price <= Math.max(60, a.wealth * 0.5));
      if (it) { this.take(La, it[0], 1); this.put(Lb, it[0], 1); this.adj(b, a, 6); this.bio(b, `${a.name}赠了一份${itemDef(it[0]).name}`); }
    } else if ((a.faction === 'merchant' || b.faction === 'merchant') && Math.random() < 0.3) {
      const [s, t] = a.faction === 'merchant' ? [a, b] : [b, a], Ls = this.L(s), Lt = this.L(t);
      const it = Ls.bag.find(([id]) => id !== Ls.gear && itemDef(id).price * 1.1 <= t.wealth);
      if (it) {
        const price = Math.round(itemDef(it[0]).price * rand(0.9, 1.3));
        if (t.wealth >= price) {
          t.wealth -= price; s.wealth += price; this.take(Ls, it[0], 1); this.put(Lt, it[0], 1);
          if (itemDef(it[0]).tier >= 4) this.post(`${s.name}把一件${itemDef(it[0]).name}卖给了${t.name}，要价 ${price} 灵石。`, { map: npcMap(s), imp: 1, ids: [s.id, t.id] });
        }
      }
    }
    const A = this.affOf(a, b), B = this.affOf(b, a), k = this.tieK(a, b);
    if (!k && A >= 45 && B >= 45) {            // 结交
      R.link(a, b, 'friend', '好友', '好友'); this.bio(a, `与${b.name}结为好友`); this.bio(b, `与${a.name}结为好友`);
    } else if (k === 'friend' && A >= 88 && B >= 88 && a.realm >= 1 && b.realm >= 1 && Math.random() < 0.04 && this.sworn(a) < 2 && this.sworn(b) < 2) {   // 结拜
      R.unlink(a, b);
      const old = b.age >= a.age, lb = old ? (b.sex === 'm' ? '义兄' : '义姐') : (b.sex === 'm' ? '义弟' : '义妹'), la = old ? (a.sex === 'm' ? '义弟' : '义妹') : (a.sex === 'm' ? '义兄' : '义姐');
      R.link(a, b, 'sworn', lb, la); this.bio(a, `与${b.name}义结金兰`); this.bio(b, `与${a.name}义结金兰`);
      if (this.canonish(a) || this.canonish(b) || Math.min(a.realm, b.realm) >= 2) this.post(`${a.name}与${b.name}在${LOC_BY_ID.get(a.home)?.name ?? '城中'}义结金兰，结为异姓${old ? '兄弟' : '手足'}。`, { map: npcMap(a), imp: this.imp2(a, b), ids: [a.id, b.id] });
    } else if (k !== 'foe' && k !== 'kin' && k !== 'lover' && ((A <= -55 && B <= -40) || Math.min(A, B) <= -75)) {   // 结怨
      R.unlink(a, b); R.link(a, b, 'foe', '对头', '对头'); La.mood -= 8; Lb.mood -= 8;
      this.bio(a, `与${b.name}结下梁子`); this.bio(b, `与${a.name}结下梁子`);
      if (this.canonish(a) || this.canonish(b) || (a.sect && b.sect)) this.post(`${a.name}与${b.name}在${LOC_BY_ID.get(a.home)?.name ?? '城中'}闹翻了脸，从此势同水火。`, { map: npcMap(a), imp: 1, ids: [a.id, b.id] });
    } else if (a.sex !== b.sex && A >= 52 && B >= 52 && this.single(a) && this.single(b) && Math.random() < 0.1) {   // 相恋成婚
      if ((a.realm === 0) !== (b.realm === 0) || Math.abs(a.age - b.age) > (a.realm === 0 ? 14 : 45) || k === 'kin') return;
      this.wed(a.sex === 'm' ? a : b, a.sex === 'm' ? b : a);
    }
  }
  private sworn(d: NpcData) { return (d.ties ?? []).filter((t) => t.k === 'sworn').length; }
  private single(d: NpcData) { return !d.canon && !d.beauty && !d.orig && !d.stay && d.age >= (d.realm === 0 ? 17 : 22) && !(d.ties ?? []).some((t) => t.k === 'lover'); }
  private wed(m: NpcData, f: NpcData) {
    const g = this.game, R = this.R;
    R.unlink(m, f); R.link(m, f, 'lover', '妻子', '丈夫');
    f.home = m.home; f.map = m.map; f.until = 0;
    const Lm = this.L(m), Lf = this.L(f);
    Lm.st = Lf.st = { k: 'wed', until: g.day + 25 }; Lm.mood = Lf.mood = 90; Lm.want = Lf.want = '守家';
    m.wealth += Math.round(f.wealth * 0.5); f.wealth = Math.round(f.wealth * 0.5);
    this.bio(m, `迎娶${f.name}`); this.bio(f, `嫁与${m.name}`);
    this.S.weds++;
    this.post(`${m.name}与${f.name}在${LOC_BY_ID.get(m.home)?.name ?? '城中'}结为夫妇，亲友来贺。`, { map: npcMap(m), imp: this.imp2(m, f), ids: [m.id, f.id] });
  }
  /** 生子：孩子长大前不在世上走动，成年后入宗门 / 修仙 / 务农 */
  private birth(mom: NpcData, dad: NpcData) {
    const cult = mom.realm >= 1 || dad.realm >= 1;
    const mine = this.kidsOf(dad).length;
    if (mine >= (cult ? 2 : 4) || mom.age > (cult ? 15 + REALMS[Math.max(1, mom.realm)].life * 0.35 : 40) || mom.age < 18) return;
    const m = npcMap(dad), live = this.N.list.filter((n) => n.alive && npcMap(n) === m).length;
    if (live > CAP[m] * 1.12) return;
    const sex: 'm' | 'f' = Math.random() < 0.5 ? 'm' : 'f';
    let name = makeName(Math.random, sex); name = surnameOf(dad.name) + name.slice(surnameOf(name).length);
    const id = 'c' + (++this.S.kids) + '_' + Math.floor(this.game.day);
    const kid: NpcData = {
      id, name, sex, role: sex === 'f' ? 'female' : 'farmer', realm: 0, stage: 0, faction: cult ? (dad.faction === 'merchant' ? 'merchant' : dad.faction) : 'mortal', sect: dad.sect ?? mom.sect, home: dad.home,
      pers: Math.random() < 0.6 ? (Math.random() < 0.5 ? dad.pers : mom.pers) : pick(['kind', 'cautious', 'righteous', 'greedy', 'aloof', 'arrogant'] as const),
      favor: 0, grudge: 0, met: false, alive: true, age: 0, life: 70 + Math.random() * 20, x: dad.x, y: dad.y, tx: dad.x, ty: dad.y, goal: 'stay', until: 0, wealth: 0,
      seed: Math.floor(Math.random() * 1e9), robe: undefined, map: m, hidden: true,
    };
    this.N.list.push(kid); this.N.byId.set(id, kid);
    this.R.link(dad, kid, 'kin', sex === 'm' ? '子' : '女', '父'); this.R.link(mom, kid, 'kin', sex === 'm' ? '子' : '女', '母');
    const Lk = this.L(kid); Lk.born = Math.floor(this.game.day); Lk.bag = []; Lk.arts = [];
    this.bio(dad, `喜得${sex === 'm' ? '麟儿' : '千金'}${name}`); this.bio(mom, `诞下${name}`);
    this.L(dad).mood = Math.min(100, this.L(dad).mood + 15); this.L(mom).mood = Math.min(100, this.L(mom).mood + 15);
    this.S.births++;
    if (this.canonish(dad) || this.canonish(mom) || cult) this.post(`${dad.name}与${mom.name}喜得${sex === 'm' ? '一子' : '一女'}，取名${name}。`, { map: m, imp: 1, ids: [dad.id, mom.id] });
  }
  private grow(d: NpcData) {
    const par = this.parentsOf(d), cult = par.some((p) => p.realm >= 1);
    d.hidden = false; this.L(d).born = undefined;
    const lucky = cult ? Math.random() < 0.5 : Math.random() < 0.04;
    d.realm = lucky ? 1 : 0; d.stage = 0; d.life = lucky ? REALMS[1].life * rand(0.9, 1.1) : 60 + Math.random() * 25;
    if (!lucky) d.faction = 'mortal'; else if (d.faction === 'mortal') d.faction = 'rogue';
    d.role = lucky ? (d.sex === 'f' ? 'female' : 'cultivator') : d.sex === 'f' ? 'female' : 'farmer';
    if (!lucky) d.sect = undefined;
    const L = this.L(d); L.lr = d.realm; L.mood = 65; d.wealth = Math.round(par.reduce((s, p) => s + p.wealth, 0) * 0.1);
    if (lucky) { this.learn(d, L); const z = zoneOfLoc(LOC_BY_ID.get(d.home)); const c = poolOf(z).filter((it) => it.tier === 0 && (it.type === 'pill' || it.type === 'herb')); if (c.length) this.put(L, pick(c).id, 2); }
    const ps = par.map((p) => p.name).join('、');
    this.bio(d, lucky ? `踏入仙途${d.sect ? '，入' + sectTitle(d.sect) : ''}` : '长大成人');
    this.post(`${ps || '某家'}之${d.sex === 'm' ? '子' : '女'}${d.name}长大成人${lucky ? (d.sect ? '，拜入' + sectTitle(d.sect) + '门下' : '，测出灵根，踏上了修仙路') : '，在' + (LOC_BY_ID.get(d.home)?.name ?? '家乡') + '安顿下来'}。`, { map: npcMap(d), imp: 1, ids: [d.id] });
  }

  // ============================================================ 冲突：劫掠、仇杀、斗殴、世仇
  private crimeable(d: NpcData) {
    if (d.canon || d.beauty || d.stay || d.realm < 1 || d.ros || d.gz) return false;
    if (d.faction !== 'rogue' && d.faction !== 'demon') return false;
    if (d.pers !== 'greedy' && d.pers !== 'ruthless' && !(d.pers === 'arrogant' && d.faction === 'demon')) return false;
    return d.wealth < 22 * Math.pow(3, d.realm) || (d.faction === 'demon' && Math.random() < 0.3);
  }
  private rob(a: NpcData, grp: NpcData[]) {
    if (grp.length < 2 || !a.alive) return;
    const fa = fightPower(a);
    let t: NpcData | null = null, bw = -1;
    for (let i = 0; i < 4; i++) {
      const b = grp[Math.floor(Math.random() * grp.length)];
      if (!b || b === a || !b.alive || b.hidden || b.canon || b.beauty || b.stay || b.ros || b.gz || b.bond || this.N.active.has(b.id)) continue;
      if (b.sect && b.sect === a.sect) continue;
      const k = this.tieK(a, b); if (k === 'friend' || k === 'kin' || k === 'sworn' || k === 'lover') continue;
      if (fightPower(b) > fa + 5) continue;
      const w = b.wealth + this.L(b).bag.length * 30; if (w > bw) { bw = w; t = b; }
    }
    if (t && !this.trySos(a, t)) this.clash(a, t, 'rob');
  }
  /** 旧怨斗殴：对头之间 */
  private brawl(a: NpcData, grp: NpcData[]) {
    const foe = (a.ties ?? []).find((t) => t.k === 'foe');
    if (!foe || a.realm < 1 || a.canon || a.beauty) return;
    const b = this.N.byId.get(foe.id); if (!b || !b.alive || b.hidden || b.home !== a.home || b.realm < 1 || b.canon || b.beauty || this.N.active.has(b.id)) return;
    if (!grp.includes(b) || Math.random() > 0.5) return;
    this.clash(a, b, 'brawl');
  }
  private avenge(d: NpcData, grp: NpcData[]) {
    const t = this.N.byId.get(d.vend!);
    if (!t || !t.alive) { d.vend = undefined; return; }
    if (npcMap(t) !== npcMap(d) || this.N.active.has(d.id) || this.N.active.has(t.id) || t.hidden) return;
    const L = this.L(d), fa = fightPower(d), ft = fightPower(t);
    if (t.canon && fa < ft - 3) return;   // 原著人物不会被无名之辈寻仇寻死
    if (t.vend === d.id && ft > fa + 8 && d.faction !== 'sect' && !d.canon && Math.random() < 0.35) {   // 打不过又被反盯上：举家避祸
      const from = LOC_BY_ID.get(d.home)?.name ?? '故地';
      this.N.migrate(d); this.bio(d, `畏${t.name}寻仇，远走他乡`);
      this.post(`${d.name}惧怕${t.name}报复，连夜离开${from}，远走他乡。`, { map: npcMap(d), imp: 1, ids: [d.id, t.id] }); return;
    }
    if (fa >= ft - 3) { this.clash(d, t, 'avenge'); return; }
    // 打不过：雇凶
    if (d.wealth >= 400) {
      const h = grp.find((x) => x.alive && !x.hidden && x !== d && x !== t && !x.canon && !x.beauty && x.realm >= 1 && fightPower(x) >= ft && (x.pers === 'greedy' || x.pers === 'ruthless') && this.tieK(x, t) !== 'friend' && !this.N.active.has(x.id));
      if (h) {
        const fee = Math.min(Math.round(d.wealth * 0.5), Math.round(180 * Math.pow(3, h.realm)));
        d.wealth -= fee; h.wealth += fee;
        this.bio(d, `重金雇${h.name}去取${t.name}性命`);
        this.clash(h, t, 'hire', d);
        return;
      }
    }
    // 打不过也雇不起：闭关苦修
    if (!(L.st && L.st.until > this.game.day)) {
      L.st = { k: 'seclude', until: this.game.day + rand(40, 120) }; L.want = '复仇';
      if (d.realm >= 1 && d.stage < REALMS[d.realm].stages.length - 1 && Math.random() < 0.5) d.stage++;
      this.bio(d, `闭关苦修，誓向${t.name}复仇`);
    }
  }

  /** 两人交手。kind：rob 劫掠 / brawl 斗殴 / avenge 寻仇 / hire 雇凶（a 为受雇者，by 为雇主） */
  clash(a: NpcData, b: NpcData, kind: 'rob' | 'brawl' | 'avenge' | 'hire', by?: NpcData) {
    const La = this.L(a), Lb = this.L(b);
    let bonusA = 0, bonusB = 0;
    // 符箓在关键时刻派上用场
    for (const [Lx, side] of [[La, 0], [Lb, 1]] as [Life, number][]) { const tl = Lx.bag.find(([id]) => itemDef(id).type === 'talisman'); if (tl && Math.random() < 0.4) { this.take(Lx, tl[0], 1); if (side === 0) bonusA = 3; else bonusB = 3; } }
    const fa = fightPower(a) + rand(-3, 3) + bonusA, fb = fightPower(b) + rand(-3, 3) + bonusB;
    const aWins = Math.random() < 1 / (1 + Math.exp(-(fa - fb) / 5));
    const w = aWins ? a : b, l = aWins ? b : a;
    const place = LOC_BY_ID.get(b.home)?.name ?? '城外';
    const lethalBase = kind === 'rob' ? (w.pers === 'ruthless' ? 0.38 : 0.12) : kind === 'brawl' ? 0.1 : 0.62;
    const lethal = lethalBase * (w.faction === 'demon' ? 1.3 : 1) * (kind === 'rob' && l === a ? 1.4 : 1);
    const map = npcMap(b), ids = [a.id, b.id], imp = this.imp2(a, b);
    const owner = kind === 'hire' ? by : a;   // 报仇的“苦主”
    if (Math.random() < lethal) {
      this.kill(l, w, kind === 'rob' ? (w === a ? `被${w.name}劫杀` : `劫道不成反被${w.name}所杀`) : `死于${w.name}之手`);
      const text = kind === 'rob' ? (w === a ? `${l.name}在${place}一带遭${w.name}劫杀，储物袋被洗劫一空。` : `劫修${l.name}在${place}拦路行劫，反被${w.name}所杀。`)
        : kind === 'avenge' ? (w === a ? `${a.name}寻上${b.name}，报了血仇。` : `${a.name}寻仇${b.name}不成，反被${b.name}斩杀于${place}。`)
        : kind === 'hire' ? (w === a ? `受${by?.name}重金所雇的${a.name}，在${place}取了${b.name}的性命。` : `${by?.name}雇来寻仇的${a.name}，反被${b.name}斩杀于${place}。`)
        : `${a.name}与${b.name}在${place}旧怨爆发，${l.name}死于${w.name}之手。`;
      this.post(text, { map, imp, ids });
      if ((kind === 'avenge' || kind === 'hire') && w === a && owner) { owner.vend = undefined; this.bio(owner, '大仇得报'); this.L(owner).mood = Math.min(100, this.L(owner).mood + 30); }
      return;
    }
    // 没死：败者带伤、破财、结仇
    const cut = Math.round(l.wealth * (kind === 'rob' ? rand(0.4, 0.7) : 0.1));
    l.wealth -= cut; w.wealth += cut;
    if (kind === 'rob' && w === a && Lb.bag.length) { const x = Lb.bag.find(([id]) => id !== Lb.gear) ?? Lb.bag[0]; if (x) { this.take(Lb, x[0], 1); this.put(La, x[0], 1); } }
    const Ll = this.L(l); Ll.st = { k: 'recover', until: this.game.day + rand(10, 30) }; Ll.mood = Math.max(0, Ll.mood - 25);
    this.adj(l, w, -60); this.adj(w, l, -20);
    if (kind === 'rob' && w === a) {
      this.R.unlink(a, b); this.R.link(a, b, 'foe', '苦主', '劫匪'); b.vend = b.vend ?? a.id; this.L(b).want = '复仇';
      this.bio(b, `被${a.name}劫了${cut}灵石`); this.bio(a, `劫了${b.name}`);
      for (const t of b.ties ?? []) if (t.k === 'friend' || t.k === 'sworn' || t.k === 'kin') { const o = this.N.byId.get(t.id); if (o?.alive) this.adj(o, a, -35); }
      this.post(`${b.name}在${place}被${a.name}拦路抢走了${cut}灵石和一件宝物，所幸保住了性命。`, { map, imp, ids });
    } else if (kind === 'rob') {
      a.wealth = Math.round(a.wealth * 0.7); this.bio(a, `劫道失手，被${b.name}教训`); this.bio(b, `击退劫修${a.name}`); this.adj(b, a, -30);
      this.post(`${a.name}在${place}拦路劫${b.name}，不但没得手，还被打得落荒而逃。`, { map, imp, ids });
    } else if (kind === 'avenge' || kind === 'hire') {
      this.post(`${a.name}与${b.name}在${place}斗了一场，${l.name}负伤而退。`, { map, imp: 1, ids });
    } else {
      this.bio(a, `与${b.name}大打出手`); this.bio(b, `与${a.name}大打出手`);
    }
    // 宗门之间也记账
    if (a.sect && b.sect && a.sect !== b.sect) this.feudAdd(a.sect, b.sect, 1.5);
  }
  /** 凶手夺宝、记仇，再交给 die 处理后事 */
  private kill(v: NpcData, k: NpcData, why: string) {
    const Lv = this.L(v), Lk = this.L(k);
    this.spoils(v, k); void Lv; void Lk;
    this.bio(k, `杀了${v.name}`); this.S.deaths++; this.today++;
    this.killer = k; this.N.die(v, why, k); this.killer = null;
    this.R.onNpcKill(v, k);
    if (v.sect && k.sect && v.sect !== k.sect) this.feudAdd(v.sect, k.sect, v.realm >= 2 ? 5 : 2.5);
  }

  /** 死后之事（由 NpcWorld.die 调用）：守孝、继承、丧亲之痛 */
  onDeath(d: NpcData, why: string, killer?: NpcData | null) {
    const g = this.game, L = this.L(d), day = g.day;
    const canonish = this.canonish(d);
    this.bio(d, why);
    // 继承
    const heirs: NpcData[] = [];
    const sp = this.spouseOf(d); if (sp) heirs.push(sp);
    for (const k of this.kidsOf(d)) heirs.push(k);
    if (!heirs.length) for (const p of this.parentsOf(d)) heirs.push(p);
    if (!heirs.length) for (const s of this.sibsOf(d)) heirs.push(s);
    if (heirs.length && !this.looted.has(d.id)) {
      const share = Math.round(d.wealth * 0.6 / heirs.length);
      for (const h of heirs) h.wealth += share;
      d.wealth = Math.round(d.wealth * 0.4);
      const first = heirs.find((h) => !h.hidden) ?? heirs[0], Lh = this.L(first);
      for (const [id, n] of L.bag.slice()) this.put(Lh, id, n);
      if (L.gear && !Lh.gear && !first.hidden) Lh.gear = L.gear;
      L.bag = [];
    }
    this.looted.delete(d.id);
    for (const h of heirs) {
      const Lh = this.L(h); Lh.mood = Math.max(0, Lh.mood - 40); Lh.st = { k: 'mourn', until: day + rand(40, 90) };
      this.bio(h, `${this.relName(h, d)}${d.name}亡故，披麻守孝`);
      if (killer && killer !== h) { this.adj(h, killer, -90); if (!h.hidden) { h.vend = h.vend ?? killer.id; Lh.want = '复仇'; } }
    }
    // 好友、同门、徒弟的悲愤
    for (const t of d.ties ?? []) {
      const o = this.N.byId.get(t.id); if (!o || !o.alive || heirs.includes(o)) continue;
      if (t.k === 'friend' || t.k === 'sworn' || t.k === 'master' || t.k === 'disciple') { this.L(o).mood = Math.max(0, this.L(o).mood - 15); if (killer && killer !== o) this.adj(o, killer, -55); this.bio(o, `${t.r}${d.name}亡故`); }
    }
    if (!killer && !d.hidden && (canonish || heirs.length || d.sect)) {
      const kin = heirs.slice(0, 2).map((h) => h.name).join('、');
      this.S.deaths++;
      this.post(`${d.name}${why}${kin ? '，' + kin + '披麻守孝' : ''}。`, { map: npcMap(d), imp: canonish ? 2 : 1, ids: [d.id] });
    }
  }
  private relName(me: NpcData, other: NpcData) { const t = me.ties?.find((x) => x.id === other.id); return t ? (({ 父: '父亲', 母: '母亲', 子: '儿子', 女: '女儿', 兄: '兄长', 弟: '弟弟', 姐: '姐姐', 妹: '妹妹' } as any)[t.r] ?? t.r) : ''; }

  /** 玩家搜刮死者的储物袋：掉出里头的东西（取最值钱的几件） */
  dropBag(d: NpcData, x: number, y: number, quiet = false) {
    const L = d.lw; if (!L) return;
    this.looted.add(d.id);
    const items = L.bag.slice().sort((a, b) => itemDef(b[0]).price - itemDef(a[0]).price).slice(0, 5);
    for (const [id, n] of items) this.game.combat.dropLoot(x, y, id, Math.min(n, 3));
    if (items.length && !quiet) this.game.toast(`${d.name}的储物袋里掉出了：${items.slice(0, 3).map(([id]) => itemDef(id).name).join('、')}${items.length > 3 ? '……' : ''}`, 'good');
    L.bag = [];
  }
  /** 斗法战力加成（法器、功法） */
  combatMul(d: NpcData): number {
    const L = d.lw; if (!L || d.realm < 1) return 1;
    return 1 + Math.min(0.28, (L.arts.length * 0.025) + (L.gear ? 0.04 + itemDef(L.gear).tier * 0.025 : 0));
  }

  // ============================================================ 宗门政治
  private fk(a: string, b: string) { return a < b ? a + '|' + b : b + '|' + a; }
  feudAdd(a: string, b: string, v: number) { if (a === b) return; const S = this.S, k = this.fk(a, b); S.feud[k] = Math.min(40, (S.feud[k] ?? 0) + v); }
  private demonSect(id: string) { return !!SECT_DEF.get(id)?.demon || ['guiling', 'hehuan', 'yuling', 'qianhuan', 'tiansha', 'yinluo', 'tianmo', 'jiyin'].includes(id); }
  private sectPolitics(n: number) {
    const S = this.S;
    for (const k of Object.keys(S.feud)) { S.feud[k] *= Math.pow(0.997, n); if (S.feud[k] < 0.3) delete S.feud[k]; }
    // 正邪之间的摩擦缓慢累积
    if (Math.random() < pr(n, 0.35)) {
      const sects = SECT_DEFS.filter((s) => LOC_BY_ID.get(s.id));
      const a = pick(sects), b = pick(sects);
      if (a && b && a.id !== b.id && LOC_BY_ID.get(a.id)!.map === LOC_BY_ID.get(b.id)!.map && !allyOf(a.id).includes(b.id)) {
        const A = LOC_BY_ID.get(a.id)!, B = LOC_BY_ID.get(b.id)!, da = Math.hypot(A.x - B.x, A.y - B.y);
        this.feudAdd(a.id, b.id, (this.demonSect(a.id) !== this.demonSect(b.id) ? 0.45 : 0.1) * (da < 90 ? 1.8 : 0.8));
      }
    }
    // 积怨爆发
    for (const k of Object.keys(S.feud)) {
      if (S.feud[k] < 14 || Math.random() > pr(n, 0.02)) continue;
      const [a, b] = k.split('|');
      this.skirmish(a, b); S.feud[k] = Math.max(0, S.feud[k] - rand(8, 12));
    }
  }
  private skirmish(a: string, b: string) {
    const g = this.game, N = this.N, A = LOC_BY_ID.get(a), B = LOC_BY_ID.get(b); if (!A || !B) return;
    const sa = sectTitle(a), sb = sectTitle(b);
    const dead: NpcData[] = []; let la = 0, lb = 0;
    for (const [sid, who] of [[a, 0], [b, 1]] as [string, number][]) {
      const mem = N.list.filter((d) => d.alive && d.sect === sid && !d.canon && !d.beauty && !d.stay && !d.hidden && !N.active.has(d.id) && d.realm >= 1);
      const k = Math.min(mem.length, 1 + Math.floor(Math.random() * 3));
      for (let i = 0; i < k; i++) {
        const v = mem[Math.floor(Math.random() * mem.length)]; if (!v || !v.alive || dead.includes(v)) continue;
        if (Math.random() < 0.45) { dead.push(v); if (who === 0) la++; else lb++; }
      }
      // 名册里的无名门人也要折损
      const def = SECT_DEF.get(sid);
      if (def) { const f = g.ws.flags as any; f.ros ??= {}; const st = (f.ros[sid] ??= {}); st.d ??= []; const loss = Math.round(def.n * rand(0.01, 0.025)); for (let i = 0; i < loss; i++) { const idx = Math.floor(def.n * 0.3 + Math.random() * def.n * 0.7); if (!st.d.includes(idx) && !g.roster.canonAt(sid, idx)) st.d.push(idx); } }
    }
    for (const v of dead) { this.S.deaths++; this.N.die(v, `死于${sectTitle(v.sect === a ? b : a)}的围攻`); }
    this.post(`${sa}与${sb}积怨爆发，两派弟子在边界上大打出手——${sa}折了${la}人，${sb}折了${lb}人，两家的梁子越结越深。`, { map: A.map, imp: 2, ids: [] });
    const mine = g.ws.sect?.id;
    if (mine === a || mine === b) { g.toast(`${mine === a ? sa : sb}与${mine === a ? sb : sa}起了冲突，门中人心浮动。`, 'warn'); this.R.log(`${sa}与${sb}发生摩擦，同门有人殒命。`, 'info'); }
  }

  // ============================================================ 世界调度：走位、闲聊、传闻
  /** 在 NpcWorld.pickTarget 里调用：让 NPC 的去向由他自己的心事决定 */
  steer(d: NpcData, rnd: () => number): boolean {
    const L = d.lw; if (!L || d.stay || d.beauty) return false;
    const r = rnd(), m = npcMap(d);
    const near = (o: NpcData) => o.alive && !o.hidden && npcMap(o) === m && Math.hypot(o.x - d.x, o.y - d.y) < 26000;
    const go = (o: NpcData, j = 200) => { d.tx = o.x + (rnd() - 0.5) * j; d.ty = o.y + (rnd() - 0.5) * j; d.goal = 'travel'; return true; };
    if (L.st && L.st.until > this.game.day && (L.st.k === 'mourn' || L.st.k === 'recover' || L.st.k === 'seclude')) {
      const h = LOC_BY_ID.get(d.home);
      if (h) { d.tx = h.x * WORLD_SCALE + (rnd() - 0.5) * 500; d.ty = h.y * WORLD_SCALE + (rnd() - 0.5) * 400; d.goal = L.st.k === 'seclude' ? 'seclude' : 'stay'; return true; }
    }
    const t = d.vend ? this.N.byId.get(d.vend) : undefined;
    if (t && near(t) && r < 0.5) return go(t, 300);
    const sp = this.spouseOf(d);
    if (sp && near(sp) && r < 0.4) return go(sp, 160);
    if (r < 0.55) {
      const fr = (d.ties ?? []).filter((x) => x.k === 'friend' || x.k === 'sworn' || x.k === 'kin' || x.k === 'master' || x.k === 'disciple').map((x) => this.N.byId.get(x.id)!).filter((o) => o && near(o) && !o.stay);
      if (fr.length && rnd() < 0.5) return go(fr[Math.floor(rnd() * fr.length)], 260);
    }
    return false;
  }
  /** 在场两人闲聊的话题——全是他们自己的事 */
  chat(A: NpcData, B: NpcData): string[] | null {
    if (Math.random() > 0.7) return null;
    const LA = this.L(A);
    const k = this.tieK(A, B), day = this.game.day, sp = this.spouseOf(A);
    const kids = this.kidsOf(A);
    const item = LA.bag.find(([id]) => itemDef(id).tier >= 1 && id !== LA.gear);
    const foe = A.vend ? this.N.byId.get(A.vend) : undefined;
    const cand: string[][] = [];
    if (LA.st?.k === 'mourn' && LA.st.until > day) cand.push(['（眼眶发红）……人说没就没了。', '节哀。日子还得过。', '嗯。我只想把他的事办妥。']);
    if (LA.st?.k === 'wed' && LA.st.until > day) cand.push(['听说你成亲了？恭喜恭喜！', '多谢！改日来喝杯喜酒。']);
    if (foe?.alive) cand.push([`${foe.name}那厮还没找到吗？`, '快了。他躲不了一辈子。', '需要人手就开口。']);
    if (k === 'foe') cand.push([`${B.name}，你还欠我一个交代。`, '哼，凭你？', '咱们走着瞧。']);
    if (k === 'sworn') cand.push(['大哥，这回我弄到了一件好东西。', '好兄弟，有福同享！']);
    if (sp && kids.length) cand.push([`家里${kids.length}个孩子，${kids.some((x) => x.hidden) ? '最小的才刚会走路' : '都已成人'}。`, '拉扯大不容易啊。']);
    if (A.sect && B.sect && A.sect !== B.sect) { const f = this.S.feud[this.fk(A.sect, B.sect)] ?? 0; if (f > 6) cand.push([`听说${sectTitle(A.sect)}与${sectTitle(B.sect)}最近不太平。`, '边界上已经动过手了。', '你我就别掺和了。']); }
    if (A.sect && this.rankText(A) && Math.random() < 0.35) cand.push([`我在${sectTitle(A.sect)}做${this.rankText(A)}，近来事务繁杂。`, '一门之事，辛苦了。']);
    if (item) cand.push([`我储物袋里新得了一份${itemDef(item[0]).name}。`, '好东西！舍得出手么？', Math.random() < 0.5 ? '先留着自用。' : '价钱合适就换。']);
    const art = LA.arts.length ? ARTS[LA.arts[Math.floor(Math.random() * LA.arts.length)]] : null;
    if (art && B.realm > 0) cand.push([`近日在琢磨${art.name}，总差了点火候。`, '这门功法讲究循序渐进，莫急。']);
    if (A.wealth < 8 * Math.pow(3, A.realm) && A.faction !== 'mortal') cand.push(['手头紧得很，灵石快见底了。', '同道不易，等我有了还你。']);
    const rec = this.S.feed.slice(-12).filter((f) => f.map === npcMap(A) && day - f.day < 90);
    if (rec.length && Math.random() < 0.45) { const f = pick(rec); cand.push([f.text.length > 30 ? f.text.slice(0, 29) + '……' : f.text, '当真有这事？', '千真万确，满城都传遍了。']); }
    return cand.length ? pick(cand) : null;
  }
  /** 打听消息：这个世界自己发生的事 */
  gossip(d: NpcData): string | null {
    const day = this.game.day, S = this.S, m = npcMap(d);
    const rec = S.feed.filter((f) => day - f.day < 120 && (f.map === m || f.imp >= 2) && !(f.ids ?? []).includes(d.id));
    const own: string[] = [];
    const L = this.L(d);
    const sp = this.spouseOf(d), kids = this.kidsOf(d);
    if (sp) own.push(`我家${sp.sex === 'f' ? '娘子' : '那口子'}${sp.name}近来${this.activity(sp)}。`);
    if (kids.length) own.push(`我膝下有${kids.length}个孩子，${kids.map((k) => k.name).slice(0, 2).join('、')}……都是我的心头肉。`);
    if (d.vend) { const f = this.N.byId.get(d.vend); if (f?.alive) own.push(`别提了……${f.name}欠我一笔血债，我迟早要讨回来。`); }
    const fr = (d.ties ?? []).filter((t) => t.k === 'friend' || t.k === 'sworn').map((t) => this.N.byId.get(t.id)!).filter((o) => o?.alive);
    if (fr.length) { const o = pick(fr); own.push(`我那位朋友${o.name}，近来${this.activity(o)}。`); }
    if (d.sect) { const hot = Object.entries(S.feud).filter(([k, v]) => v > 5 && k.split('|').includes(d.sect!)); if (hot.length) { const o = hot[0][0].split('|').find((x) => x !== d.sect)!; own.push(`${sectTitle(d.sect)}和${sectTitle(o)}最近摩擦不断，山门里人人自危。`); } }
    if (L.arts.length > 0 && Math.random() < 0.2) own.push(`我这一路功法讲究${SCHOOL_NAME[L.school]}之道，门里几位前辈都擅此术。`);
    const pool: string[] = [];
    if (rec.length) for (let i = 0; i < 2; i++) pool.push('听说了吗？' + pick(rec).text);
    pool.push(...own);
    return pool.length ? pick(pool) : null;
  }

  // ============================================================ 对话与面板
  talkOpts(a: { d: NpcData; look?: Look }, title: string, back: () => DNode): DOpt[] {
    const d = a.d, g = this.game, L = this.L(d), out: DOpt[] = [];
    out.push({ label: '神识探查此人（储物袋 · 功法 · 亲眷 · 恩怨）', hint: this.canPeek(d) ? '' : '境界不及，看不真切', act: () => this.profile(d, 'main', a.look, back) });
    if (L.st && L.st.until > g.day && L.st.k === 'mourn' && d.favor > -30) out.push({ label: '上前吊唁', tone: 'good', act: () => { d.favor = clamp(d.favor + 6, -100, 100); return { speaker: d.name, title, look: a.look, text: '（对方红着眼眶，低声道）多谢……难得你还记挂着。', options: [{ label: '节哀', act: back }] }; } });
    if (L.st && L.st.until > g.day && L.st.k === 'wed' && d.favor > -30) out.push({ label: '道一声喜', tone: 'good', act: () => { d.favor = clamp(d.favor + 5, -100, 100); return { speaker: d.name, title, look: a.look, text: '哈哈，多谢道友！改日定当请你喝杯喜酒。', options: [{ label: '告辞', act: back }] }; } });
    const foe = d.vend ? this.N.byId.get(d.vend) : undefined;
    if (foe?.alive && d.favor >= 10 && !d.canon) out.push({ label: `劝其放下与${foe.name}的仇怨`, act: () => {
      const ok = Math.random() < 0.25 + d.favor / 220 + (d.pers === 'kind' || d.pers === 'aloof' ? 0.2 : 0) - (d.pers === 'ruthless' ? 0.25 : 0);
      if (ok) { d.vend = undefined; this.R.unlink(d, foe); this.R.link(d, foe, 'friend', '故人', '故人'); this.adj(d, foe, 40); L.want = '逍遥'; this.bio(d, `听了韩立相劝，放下与${foe.name}的仇怨`); this.post(`${d.name}与${foe.name}冰释前嫌——据说是韩立从中说和。`, { map: npcMap(d), imp: 1, ids: [d.id, foe.id] }); g.ws.rep = clamp(g.ws.rep + 2, -100, 100); }
      return { speaker: d.name, title, look: a.look, text: ok ? `（${d.name}沉默良久，长叹一声）……罢了。冤冤相报何时了。看在你的面子上，这笔账我不算了。` : '（对方冷笑）杀亲之仇，岂是三言两语可抵？此事你不必再提。', options: [{ label: ok ? '善' : '……', act: back }] };
    } });
    return out;
  }
  canPeek(d: NpcData) { const h = this.game.hero; return h.realm * 13 + h.stage >= d.realm * 13 + d.stage || d.favor >= 40 || d.bond !== undefined; }

  private bagLine(d: NpcData, full: boolean) {
    const L = this.L(d);
    if (!full) return '（对方气息深沉，神识探入便如泥牛入海，看不真切）';
    const items = L.bag.slice().sort((a, b) => itemDef(b[0]).tier - itemDef(a[0]).tier);
    return `灵石 ${Math.round(d.wealth)}\n` + (items.length ? items.slice(0, 12).map(([id, n]) => `${itemDef(id).name}${n > 1 ? '×' + n : ''}${id === L.gear ? '【本命】' : ''}`).join('、') : '袋中再无他物');
  }
  /** 众生玉简：一个人的全部 */
  profile(d: NpcData, page: 'main' | 'bag' | 'arts' | 'kin' | 'foe' | 'life', look?: Look, back?: () => DNode): DNode {
    const g = this.game, L = this.L(d), full = this.canPeek(d), day = g.day;
    const m = (nm: string, id: typeof page) => ({ label: nm, act: () => this.profile(d, id, look, back) } as DOpt);
    const nav: DOpt[] = [];
    if (page !== 'main') nav.push(m('概览', 'main'));
    if (page !== 'bag') nav.push(m('储物袋', 'bag'));
    if (page !== 'arts') nav.push(m('功法', 'arts'));
    if (page !== 'kin') nav.push(m('亲眷 · 故交', 'kin'));
    if (page !== 'foe') nav.push(m('恩怨', 'foe'));
    if (page !== 'life') nav.push(m('近事', 'life'));
    nav.push({ label: back ? '返回' : '收起', act: back ? back : () => null });
    const sectName = d.sect ? sectTitle(d.sect) : '';
    const title = `${realmName(d.realm, d.stage)} · ${sectName ? sectName + ' ' + this.rankText(d) : this.rankText(d)}`;
    const mood = L.mood >= 75 ? '意气风发' : L.mood >= 55 ? '心境平和' : L.mood >= 35 ? '略显郁郁' : '心灰意冷';
    let text = '';
    const nameOf = (id: string) => this.N.byId.get(id);
    if (page === 'main') {
      const sp = this.spouseOf(d), kids = this.kidsOf(d), par = this.parentsOf(d);
      const foe = d.vend ? nameOf(d.vend) : undefined;
      text = `${d.sex === 'f' ? '女' : '男'} · ${Math.floor(d.age)} 岁（寿元约 ${Math.round(d.life)}）\n心愿：${L.want}　心境：${mood}　性情：${PERS_NAME[d.pers]}\n眼下：${this.activity(d)}\n流派：${SCHOOL_NAME[L.school]}　功法 ${L.arts.length} 门　储物袋 ${L.bag.length} 类\n` +
        `家室：${sp ? '配偶 ' + sp.name : '孑然一身'}${kids.length ? '，子女 ' + kids.length + ' 人' : ''}${par.length ? '，高堂 ' + par.map((p) => p.name).join('、') : ''}\n` +
        (foe?.alive ? `血仇：${foe.name}（${realmName(foe.realm, foe.stage)}）\n` : '') + (d.favor !== 0 ? `对你：${d.favor >= 50 ? '亲厚' : d.favor >= 15 ? '友善' : d.favor > -15 ? '平淡' : '敌视'}（${Math.round(d.favor)}）` : '');
    } else if (page === 'bag') {
      text = `【储物袋】${this.bagLine(d, full)}\n\n本命法器：${L.gear ? itemDef(L.gear).name + '（' + (['凡品', '下品', '中品', '上品', '极品', '古宝', '通天'][itemDef(L.gear).tier] ?? '') + '）' : '无'}${full ? '' : '\n\n（修为压过对方，或与之交情深厚，方能看清袋中之物）'}`;
    } else if (page === 'arts') {
      const list = (full ? L.arts : L.arts.slice(0, 1)).map((id) => { const a = ARTS[id]; return a ? `${a.name}（${SCHOOL_NAME[a.school]}·${TIER_NAME[a.tier]}）` : id; });
      text = `【功法】主修${SCHOOL_NAME[L.school]}一脉${d.sect ? '——' + sectName + '的看家路数' : ''}\n` + (list.length ? list.join('\n') : '尚未修习任何法术') + (!full && L.arts.length > 1 ? '\n……（其余看不透）' : '') + `\n\n战力评估：${Math.round(fightPower(d))}（你 ${Math.round(g.hero.realm * 13 + g.hero.stage)}）`;
    } else if (page === 'kin') {
      const rows: string[] = [];
      for (const t of d.ties ?? []) { const o = nameOf(t.id); if (!o || t.k === 'foe') continue; rows.push(`${t.r === '子' ? '儿子' : t.r === '女' ? '女儿' : t.r}　${o.name}${o.alive ? '（' + realmName(o.realm, o.stage) + (o.hidden ? ' · 年幼' : '') + '）' : '（已故）'}`); }
      const aff = Object.entries(L.aff).filter(([, v]) => v >= 30).map(([id]) => nameOf(id)).filter((o) => o && o.alive && !(d.ties ?? []).some((t) => t.id === o.id)).slice(0, 4);
      text = '【亲眷 · 故交】\n' + (rows.length ? rows.slice(0, 10).join('\n') : '亲缘淡薄，身边并无至亲') + (aff.length ? '\n\n相熟之人：' + aff.map((o) => o!.name).join('、') : '');
    } else if (page === 'foe') {
      const rows: string[] = [];
      for (const t of d.ties ?? []) { if (t.k !== 'foe') continue; const o = nameOf(t.id); if (o) rows.push(`${t.r}　${o.name}${o.alive ? '（' + realmName(o.realm, o.stage) + '）' : '（已死）'}`); }
      const dis = Object.entries(L.aff).filter(([, v]) => v <= -40).map(([id]) => nameOf(id)).filter(Boolean).slice(0, 4);
      const fe = d.sect ? Object.entries(this.S.feud).filter(([k, v]) => v > 4 && k.split('|').includes(d.sect!)).map(([k, v]) => `${sectTitle(k.split('|').find((x) => x !== d.sect)!)}（${v > 14 ? '一触即发' : v > 9 ? '剑拔弩张' : '暗流涌动'}）`) : [];
      text = '【恩怨】\n' + (rows.length ? rows.join('\n') : '尚无明面上的仇家') + (dis.length ? '\n\n心有芥蒂：' + dis.map((o) => o!.name).join('、') : '') + (fe.length ? '\n\n门派积怨：' + fe.join('、') : '') + (d.grudge > 0 ? `\n\n对你：${d.why ?? '心存怨恨'}` : '');
    } else {
      text = '【近事】\n' + (L.bio.length ? L.bio.slice().reverse().map(([dd, s]) => `${Math.max(0, Math.floor(day - dd))} 日前　${s}`).join('\n') : '日子平淡，没什么大事。');
    }
    return { speaker: d.name, title, look, text, options: nav, mood: d.grudge > 0 ? 'danger' : 'normal' };
  }

  /** 众生录（V 键）：身边的人、相识之人、江湖风闻、宗门积怨 */
  directory(page: 'main' | 'near' | 'met' | 'feed' | 'feud' | 'stat' = 'main'): DNode {
    const g = this.game, N = this.N, p = g.player;
    const back = () => this.directory('main');
    const onNpc = (d: NpcData) => ({ label: `${d.name}　${realmName(d.realm, d.stage)} · ${this.rankText(d) || '—'} · ${this.activity(d)}`, tone: d.vend ? 'bad' : undefined, act: () => this.profile(d, 'main', undefined, () => this.directory(page)) } as DOpt);
    if (page === 'near') {
      const arr = [...N.active.values()].filter((a) => a.d.alive && !a.enemy).sort((a, b) => Math.hypot(a.st.x - p.x, a.st.y - p.y) - Math.hypot(b.st.x - p.x, b.st.y - p.y)).slice(0, 9);
      return { speaker: '众生录', title: '神识所及', text: arr.length ? '神识扫过四周，众生各忙各的：' : '附近空无一人。', options: [...arr.map((a) => onNpc(a.d)), { label: '返回', act: back }] };
    }
    if (page === 'met') {
      const arr = N.list.filter((d) => d.alive && d.met && !d.hidden).sort((a, b) => Math.abs(b.favor) - Math.abs(a.favor)).slice(0, 10);
      return { speaker: '众生录', title: '识得之人', text: arr.length ? '你认得的人，各自过着自己的日子：' : '你还没结识什么人。', options: [...arr.map(onNpc), { label: '返回', act: back }] };
    }
    if (page === 'feed') {
      const day = g.day, rows = this.S.feed.filter((f) => f.map === ACTIVE_MAP || f.imp >= 2 || f.map === undefined).slice(-12).reverse();
      return { speaker: '江湖风闻', title: '近日各处发生的事', text: rows.length ? rows.map((f) => `· ${Math.max(0, Math.floor(day - f.day))} 日前　${f.text}`).join('\n\n') : '近来风平浪静——也许是你还没听到什么。多走动走动，多与人攀谈。', options: [{ label: '返回', act: back }] };
    }
    if (page === 'feud') {
      const rows = Object.entries(this.S.feud).filter(([, v]) => v > 3).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => { const [a, b] = k.split('|'); return `${sectTitle(a)} ⇄ ${sectTitle(b)}　${v > 14 ? '一触即发' : v > 9 ? '剑拔弩张' : v > 6 ? '摩擦不断' : '暗流涌动'}`; });
      return { speaker: '宗门积怨', title: '各派之间', text: rows.length ? rows.join('\n') : '各派相安无事——至少表面如此。', options: [{ label: '返回', act: back }] };
    }
    if (page === 'stat') {
      const L = N.list; const alive = L.filter((d) => d.alive && !d.hidden).length, kids = L.filter((d) => d.alive && d.hidden).length;
      const couples = L.filter((d) => d.alive && d.sex === 'm' && this.spouseOf(d)).length, feuds = L.filter((d) => d.alive && d.vend && N.byId.get(d.vend)?.alive).length;
      return { speaker: '天下大势', title: '活世界', text: `在世修士凡人 ${alive} 人，年幼未成者 ${kids} 人\n夫妻 ${couples} 对　寻仇未了 ${feuds} 桩\n累计婚嫁 ${this.S.weds}　新生 ${this.S.births}　死伤 ${this.S.deaths}\n\n你不在的时候，这个世界也在自己运转。`, options: [{ label: '返回', act: back }] };
    }
    return { speaker: '众生录', title: '活世界', text: '凡有人处，皆有故事。\n神识一扫，看看这世上的人都在做什么——\n他们有自己的储物袋、功法、门派、家人、朋友与仇家。', options: [
      { label: '身边的人', act: () => this.directory('near') }, { label: '我识得的人', act: () => this.directory('met') },
      { label: '江湖风闻', tone: 'gold', act: () => this.directory('feed') }, { label: '宗门积怨', act: () => this.directory('feud') }, { label: '天下大势', act: () => this.directory('stat') }, { label: '收起', act: () => null }] };
  }
}

function pick2<T>(a: T[], r: () => number): T { return a[Math.floor(r() * a.length)]; }
