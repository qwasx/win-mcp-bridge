// 第三阶段·活世界：不依赖画面的世界模拟
//
// 三层模拟：
//   ① 神识之内：NpcWorld 的完整行为（走、飞、打坐、斗法、交谈）——不归这里管，这里只给它定目标、结算斗法的得失
//   ② 同一张地图的其余 NPC：live() 每帧实时赶路；每 0.5 秒查一次谁撞上了谁，按战力算胜负，东西真的换主人
//   ③ 其他地图：daily() 按天结算，同一套规则（赶路、相遇、斗法、寻宝、成长），只是步子大些
// 需求 → 目标 → 行动：寿元将尽去秘境搏命；缺筑基丹的去买，买不起就去抢；有仇的去追杀；宗门弟子接差事；行商跑货；劫修拦路。
// 发生过的事都记成事件（SimEvent），传闻栏读的就是它；玩家亲眼所见的当场知道，不在场的事后才听说。
// 随机数：全部由 (世界种子, 日子, 人) 派生（core/rng），同一段历史重放得到同样的结果。
import { mulberry32, hashU } from '../../core/rng';
import { REALMS, realmName } from '../../data/realms';
import { GONGFA } from '../../data/skills';
import { itemDef, ITEM_LIST } from '../../data/items';
import { canonOwned } from '../../data/market';
import { LOC_BY_ID, WORLD_SCALE, locsOf, MAP_IDS, MAP_NAME, type LocDef, type MapId } from '../../data/world';
import type { NpcData } from '../npc';
import { provOf, provMoveAll } from './prov';
import { outfit, power, winChance, bagHas, bagTake, bagPut, takeAll, takeSome, lootText, eatExpPill, reequip, expPillsFor, BREAK_PILL, bagValue, type BagItem, type CultView } from './kit';

// ------------------------------------------------------------------ 类型
export type AimK = 'home' | 'seclude' | 'secret' | 'buy' | 'rob' | 'prowl' | 'hunt' | 'task' | 'trade' | 'grind' | 'wander' | 'bounty' | 'probe' | 'covet';
export const AIM_NAME: Record<AimK, string> = { home: '回乡', seclude: '闭关', secret: '秘境搏命', buy: '求购丹药', rob: '劫掠', prowl: '拦路', hunt: '追杀仇人', task: '宗门差事', trade: '行商', grind: '猎妖', wander: '游历', bounty: '寻你踪迹', probe: '打探虚实', covet: '觊觎你的宝' };
export interface Aim { k: AimK; x: number; y: number; loc?: string; who?: string; until?: number; at?: number; t0: number; item?: string }
export type EvK = 'rob' | 'kill' | 'feud' | 'treasure' | 'late' | 'secretdie' | 'break' | 'fail' | 'buy' | 'die' | 'omen' | 'trade' | 'task' | 'hero' | 'flaunt' | 'covet';
export interface SimEvent {
  id: number; day: number; map: MapId; x: number; y: number; k: EvK; text: string;
  a?: string; b?: string; an?: string; bn?: string; items?: BagItem[];
  /** 玩家亲眼所见 / 玩家听说的日子 / 大事 */
  seen?: 1; heard: number; big?: 1;
}
export interface SiteSt { items: BagItem[]; refill: number; taker?: string; takerName?: string; takenDay?: number; told?: number }
export interface SimState { v: 1; seed: number; seq: number; ev: SimEvent[]; sites: Record<string, SiteSt>; fame: number; rk?: Record<string, number> }
export function newSimState(seed = 20241015): SimState { return { v: 1, seed, seq: 1, ev: [], sites: {}, fame: 0 }; }
/** 世界见证（突破异象等）——s2-break 的突破成功时调用 worldWitness({ kind: 'break', who: 'hero', realm, stage }) */
export interface WitnessEvent { kind: 'break' | 'omen' | 'feat'; who: 'hero' | string; realm: number; stage?: number; x?: number; y?: number; map?: MapId; text?: string }

/** 模拟所需的外部世界（由 sim/host.ts 用 Game 实现；测试里也可以自己造一个） */
export interface SimHost {
  state(): SimState;
  list(): NpcData[];
  byId(id: string): NpcData | undefined;
  day(): number;
  activeMap: MapId;
  player(): { x: number; y: number; sense: number; map: MapId; name: string };
  hero(): CultView & { name: string };
  /** 是否在神识层（完整行为）里；busy = 正在斗法 / 已化为敌人 / 随行 */
  isActive(id: string): boolean;
  busy(id: string): boolean;
  /** 神识层要亲自演出这场冲突（两人现身、斗法）：返回 true 表示已接手 */
  showClash(a: NpcData, b: NpcData, kind: Clash): boolean;
  die(d: NpcData, why: string): void;
  onNpcKill(victim: NpcData, killer: NpcData): void;
  canAdvance(d: NpcData): boolean;
  news(text: string, kind: 'canon' | 'rumor' | 'personal'): void;
  toast(text: string, tone?: 'good' | 'warn' | 'info'): void;
  /** 异象的画面（结婴、突破）：没有画面时可以不做 */
  omen(x: number, y: number, realm: number): void;
  /** 玩家突破：宗门贺礼、他宗拉拢（返回说明文字） */
  heroCongrats(realm: number): string[];
  /** 仇家来探虚实：让此人真的动身来找你 */
  sendProbe(d: NpcData): void;
  /** 玩家到了秘境：宝物落在眼前 */
  giveSiteLoot(x: number, y: number, items: BagItem[]): void;
}
export type Clash = 'rob' | 'feud' | 'zeal';

// ------------------------------------------------------------------ 工具
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DAY_S = 2;                    // 一日 = 现实 2 秒（DAYS_PER_SEC = 0.5）
const LIVE_R = 650, DAY_R = 2200;   // 实时 / 按日结算时的相遇距离
const ARRIVE = 260;
const ZHUJI_PRICE = 6000, JIANGCHEN_PRICE = 30000;
const hstr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
const idh = new Map<string, number>();
const hid = (id: string) => { let v = idh.get(id); if (v === undefined) { v = hstr(id); idh.set(id, v); } return v; };
const nm = (d: NpcData) => d.name;
const sectOf = (d: NpcData) => d.sect ?? d.ros;
const evil = (d: NpcData) => d.faction === 'demon' || d.pers === 'ruthless';
const greedy = (d: NpcData) => d.pers === 'greedy' || d.pers === 'ruthless';
const robberish = (d: NpcData) => !d.canon && !d.beauty && ((d.faction === 'rogue' && greedy(d)) || (d.faction === 'demon' && (greedy(d) || d.pers === 'arrogant')));
const roams = (d: NpcData) => !d.stay && !d.beauty && !d.ros && !d.gz && !d.bond && !d.hidden && !d.chasing;
const yearMon = (day: number) => `第${Math.floor(day / 360) + 1}年${Math.floor((day % 360) / 30) + 1}月`;
export const view = (d: NpcData): CultView => { outfit(d); return { realm: d.realm, stage: d.stage, gongfa: d.gongfa, bag: d.bag!, main: d.main }; };
const pwCache = new WeakMap<NpcData, { k: string; p: number }>();
/** 战力（按家当签名缓存：境界、本命法宝、储物袋件数、功法不变就不重算） */
export const npcPower = (d: NpcData) => { outfit(d); const k = `${d.realm},${d.stage},${d.main},${d.bag!.length},${d.gongfa}`; const c = pwCache.get(d); if (c && c.k === k) return c.p; const p = power(view(d)); pwCache.set(d, { k, p }); return p; };
const locName = (id?: string) => (id ? LOC_BY_ID.get(id)?.name ?? '' : '');

/** 秘境里可能藏着的法器（无主之物，按品阶） */
const SITE_ARTS = new Map<number, string[]>();
function siteArts(tier: number): string[] {
  let v = SITE_ARTS.get(tier); if (v) return v;
  v = ITEM_LIST.filter((it) => it.type === 'artifact' && it.price > 0 && it.tier <= tier && it.tier >= tier - 1 && !canonOwned(it.id)).map((it) => it.id);
  SITE_ARTS.set(tier, v); return v;
}
/** 每张图的地点索引 */
interface MapIdx { safe: LocDef[]; cities: LocDef[]; towns: LocDef[]; danger: LocDef[]; secret: LocDef[] }
const IDX = new Map<MapId, MapIdx>();
function idx(m: MapId): MapIdx {
  let v = IDX.get(m); if (v) return v;
  const L = locsOf(m);
  v = { safe: L.filter((l) => l.type === 'city' || l.type === 'town' || l.type === 'sect' || l.type === 'isle'), cities: L.filter((l) => l.type === 'city' || (l.type === 'isle' && !l.minor)), towns: L.filter((l) => l.type === 'city' || l.type === 'town' || l.type === 'isle'), danger: L.filter((l) => l.type === 'danger'), secret: L.filter((l) => l.type === 'secret') };
  IDX.set(m, v); return v;
}
const P = (l: LocDef) => ({ x: l.x * WORLD_SCALE, y: l.y * WORLD_SCALE });
function nearest(ls: LocDef[], x: number, y: number, skip?: string): LocDef | undefined { let b: LocDef | undefined, bd = 1e18; for (const l of ls) { if (l.id === skip) continue; const d = (l.x * WORLD_SCALE - x) ** 2 + (l.y * WORLD_SCALE - y) ** 2; if (d < bd) { bd = d; b = l; } } return b; }
/** 城镇宗门的地界里不动手（与 combat.safeAt 同义，但不依赖地形） */
export function safeSpot(m: MapId, x: number, y: number) { for (const l of idx(m).safe) { const r = (l.type === 'city' || l.type === 'sect' ? 1300 : 900) * (l.minor ? 0.6 : 1); const dx = l.x * WORLD_SCALE - x, dy = l.y * WORLD_SCALE - y; if (dx * dx + dy * dy < r * r) return true; } return false; }

// ------------------------------------------------------------------ 世界模拟
export class WorldSim {
  host: SimHost;
  private cool = new Map<string, number>();      // 斗过一场后的冷却（日）
  private thinkQ: NpcData[] = [];
  private encT = 0;
  private liveList: NpcData[] = []; private listT = 0;
  /** 统计（测试 / 调试叠加图用） */
  stats = { moves: 0, clashes: 0, robs: 0, kills: 0, treasures: 0, breaks: 0, shown: 0 };
  constructor(host: SimHost) { this.host = host; }
  get S() { return this.host.state(); }

  rng(...k: number[]) { let h = this.S.seed | 0; for (const x of k) h = (Math.imul(h ^ (x | 0), 2654435761) + 0x9e3779b9) | 0; return mulberry32((hashU(h, k.length, 77) * 4294967296) >>> 0); }

  // ---------------------------------------------------------------- 事件
  log(e: Omit<SimEvent, 'id' | 'heard'> & { heard?: number }): SimEvent {
    const S = this.S, pl = this.host.player(), day = this.host.day();
    const seen = e.seen || (e.map === pl.map && Math.hypot(e.x - pl.x, e.y - pl.y) < pl.sense * 1.1) ? 1 : undefined;
    // 传闻扩散：同图按距离（大约一日传四五十里），他图要等商旅捎来；大事传得快
    let heard = e.heard ?? day;
    if (!seen && e.heard === undefined) {
      const far = e.map !== pl.map ? 45 + (hid(e.text) & 63) : Math.hypot(e.x - pl.x, e.y - pl.y) / 12000 * 3 + 2;
      heard = day + far * (e.big ? 0.4 : 1);
    }
    const ev: SimEvent = { ...e, id: S.seq++, heard, seen } as SimEvent;
    S.ev.push(ev);
    if (S.ev.length > 420) S.ev.splice(0, S.ev.length - 420);
    return ev;
  }
  /** 玩家已经听说的事（新的在前） */
  heard(n = 80): SimEvent[] { const day = this.host.day(), out: SimEvent[] = []; for (let i = this.S.ev.length - 1; i >= 0 && out.length < n; i--) { const e = this.S.ev[i]; if (e.heard <= day) out.push(e); } return out; }
  /** 交谈时 NPC 说起的传闻：玩家还没听说的、同图近来的事——说了就算听说了 */
  gossip(d: NpcData): string | null {
    const day = this.host.day(), m = d.map ?? 'tiannan';
    for (let i = this.S.ev.length - 1; i >= 0; i--) {
      const e = this.S.ev[i]; if (day - e.day > 120) break;
      if (e.map !== m || e.heard <= day || e.k === 'trade' || e.k === 'task') continue;
      e.heard = day;
      return e.text;
    }
    return null;
  }
  deedOf(id: string): SimEvent | undefined { for (let i = this.S.ev.length - 1; i >= 0; i--) { const e = this.S.ev[i]; if ((e.a === id || e.b === id) && e.k !== 'trade' && e.k !== 'task') return e; } return undefined; }

  // ---------------------------------------------------------------- 秘境宝藏
  site(l: LocDef): SiteSt {
    const S = this.S, day = this.host.day();
    let s = S.sites[l.id];
    if (!s || (!s.items.length && day >= s.refill)) {
      const r = this.rng(hid(l.id), Math.floor(day / 30));
      const dz = clamp(l.danger ?? (l.type === 'secret' ? 3 : 2), 1, 5), tier = clamp(Math.round(dz * 0.8 + (l.map === 'tiannan' ? 0 : 0.6)), 1, 5);
      const items: BagItem[] = [];
      if (l.type === 'secret') {
        const pool = siteArts(tier);
        if (pool.length && r() < 0.8) items.push({ id: pool[Math.floor(r() * pool.length)], n: 1 });
        if (r() < 0.45) items.push({ id: tier >= 3 ? 'pill_yanshou' : 'pill_huanglong', n: 1 });
        if (tier >= 2 && r() < 0.35) items.push({ id: 'pill_zhuji', n: 1 });
        items.push({ id: expPillsFor(clamp(tier - 1, 1, 4))[0], n: 1 + Math.floor(r() * 3) });
      } else {
        items.push({ id: 'mat_yaodan' + clamp(dz + Math.floor(r() * 2), 1, 7), n: 1 + Math.floor(r() * 2) });
        if (r() < 0.5) items.push({ id: tier >= 3 ? 'herb_tianling' : 'herb_lingzhi', n: 1, age: 30 + Math.floor(r() * 80) });
      }
      s = { items: items.filter((b) => itemDef(b.id)), refill: day + 420 + Math.floor(r() * 360), taker: s?.taker, takerName: s?.takerName, takenDay: s?.takenDay };
      S.sites[l.id] = s;
    }
    return s;
  }
  private guardPower(l: LocDef) { const dz = clamp(l.danger ?? 3, 1, 5); const realm = dz <= 2 ? 1 : dz <= 4 ? 2 : 3, stage = dz <= 1 ? 6 : dz === 2 ? 11 : dz === 3 ? 0 : dz === 4 ? 2 : 1; return power({ realm, stage, gongfa: 'generic', bag: [] }) * (l.type === 'secret' ? 1.6 : 1.1); }

  // ---------------------------------------------------------------- 需求 → 目标
  think(d: NpcData, r: () => number) {
    const day = this.host.day(), m = d.map ?? 'tiannan', I = idx(m);
    outfit(d);
    const home = LOC_BY_ID.get(d.home);
    const hp = home && home.map === m ? P(home) : { x: d.x, y: d.y };
    const set = (k: AimK, x: number, y: number, o: Partial<Aim> = {}) => { d.aim = { k, x: x + (r() - 0.5) * 500, y: y + (r() - 0.5) * 360, t0: day, ...o }; d.tx = d.aim.x; d.ty = d.aim.y; d.goal = k === 'secret' ? 'gather' : k === 'grind' || k === 'task' ? 'hunt' : k === 'seclude' ? 'seclude' : 'travel'; };
    if (!roams(d) || d.faction === 'mortal' || d.realm <= 0) {
      // 不出远门的人：在家附近走动、打坐
      if (d.faction === 'mortal' && !d.stay && r() < 0.25) { const t = nearest(I.towns, d.x + (r() - 0.5) * 30000, d.y + (r() - 0.5) * 20000); if (t) { set('wander', P(t).x, P(t).y, { loc: t.id }); return; } }
      set(d.realm > 0 && r() < 0.5 ? 'seclude' : 'home', hp.x, hp.y, { until: day + 4 + r() * 20 });
      return;
    }
    const byId = (id?: string) => (id ? this.host.byId(id) : undefined);
    // 1) 血仇：去追杀
    const foe = byId(d.vend) ?? (r() < 0.15 ? byId(d.ties?.find((t) => t.k === 'foe')?.id) : undefined);
    if (foe && foe.alive && (foe.map ?? 'tiannan') === m && !foe.hidden && (d.vend || npcPower(d) > npcPower(foe) * 0.8)) { set('hunt', foe.x, foe.y, { who: foe.id }); return; }
    // 2) 寿元将尽：去秘境搏命（得了延寿丹或宝物，就能再活一程）
    if (d.age > d.life * 0.84 && r() < 0.8) {
      const s = this.pickSite(d, I.secret.length ? I.secret : I.danger, r, true);
      if (s) { set('secret', P(s).x, P(s).y, { loc: s.id }); return; }
    }
    // 3) 卡在大境界门槛上：缺筑基丹 / 降尘丹
    const R = REALMS[d.realm], atTop = d.stage >= R.stages.length - 1 && (d.xp ?? 0) >= 0.7;
    const need = atTop ? BREAK_PILL[d.realm] : undefined;
    if (need && !bagHas(d.bag, need)) {
      const price = need === 'pill_zhuji' ? ZHUJI_PRICE : need === 'pill_jiangchen' ? JIANGCHEN_PRICE : 1e9;
      if (d.wealth >= price) { const c = nearest(I.cities, d.x, d.y); if (c) { set('buy', P(c).x, P(c).y, { loc: c.id, item: need }); return; } }
      if (greedy(d) || d.faction === 'demon' || (d.pers === 'arrogant' && r() < 0.5) || (d.age > d.life * 0.6 && r() < 0.3)) {
        const t = this.findMark(d, need);
        if (t) { set('rob', t.x, t.y, { who: t.id, item: need }); return; }
        const sp = this.roadSpot(m, d.x, d.y, r); set('prowl', sp.x, sp.y, { until: day + 10 + r() * 20 }); return;
      }
      const dz = this.pickDanger(d, I.danger, r); if (dz) { set('grind', P(dz).x, P(dz).y, { loc: dz.id }); return; }
    }
    // 4) 宗门弟子：接差事 / 回山闭关
    if (sectOf(d) && (d.faction === 'sect' || d.faction === 'demon')) {
      const x = r();
      if (x < 0.4) { const dz = this.pickDanger(d, I.danger, r, 40000); if (dz) { set('task', P(dz).x, P(dz).y, { loc: dz.id }); return; } }
      if (x < 0.75) { set('seclude', hp.x, hp.y, { until: day + 20 + r() * 60 }); return; }
    }
    // 5) 行商：城与城之间跑货
    if (d.faction === 'merchant') { const c = this.pickTown(m, d, r, d.aim?.loc); if (c) { set('trade', P(c).x, P(c).y, { loc: c.id }); return; } }
    // 5.5) 第五阶段·怀璧其罪：听说谁新得了宝，贪狠又自觉打得过的去抢（NPC 之间互相夺宝）
    if ((greedy(d) || robberish(d)) && r() < 0.35) { const t = this.coveted(d); if (t) { set('rob', t.x, t.y, { who: t.id, item: t.main }); return; } }
    // 6) 劫修：守在路口
    if (robberish(d) && r() < 0.65) { const sp = this.roadSpot(m, d.x, d.y, r); set('prowl', sp.x, sp.y, { until: day + 8 + r() * 20 }); return; }
    // 7) 散修：猎妖、寻宝、闭关、游历
    const x = r();
    if (x < 0.3) { const dz = this.pickDanger(d, I.danger, r); if (dz) { set('grind', P(dz).x, P(dz).y, { loc: dz.id }); return; } }
    if (x < 0.36) { const s = this.pickSite(d, I.secret, r); if (s) { set('secret', P(s).x, P(s).y, { loc: s.id }); return; } }
    if (x < 0.65) { set('seclude', hp.x, hp.y, { until: day + 15 + r() * 45 }); return; }
    const t = this.pickTown(m, d, r); if (t) { set('wander', P(t).x, P(t).y, { loc: t.id, until: day + 3 + r() * 10 }); return; }
    set('home', hp.x, hp.y, { until: day + 10 });
  }
  private pickSite(d: NpcData, ls: LocDef[], r: () => number, desperate = false): LocDef | undefined {
    let best: LocDef | undefined, bs = -1; const pw = npcPower(d);
    for (const l of ls) { const s = this.site(l); if (!s.items.length || (!desperate && this.guardPower(l) > pw * 1.2)) continue; const dd = Math.hypot(l.x * WORLD_SCALE - d.x, l.y * WORLD_SCALE - d.y); const sc = (bagValue(s.items) + 50) / (1 + dd / 20000) * (0.6 + r()); if (sc > bs) { bs = sc; best = l; } }
    return best;
  }
  private pickDanger(d: NpcData, ls: LocDef[], r: () => number, maxD = 60000): LocDef | undefined {
    const pw = npcPower(d), c = ls.filter((l) => Math.hypot(l.x * WORLD_SCALE - d.x, l.y * WORLD_SCALE - d.y) < maxD && this.guardPower(l) < pw * 1.6);
    return c.length ? c[Math.floor(r() * c.length)] : undefined;
  }
  private pickTown(m: MapId, d: NpcData, r: () => number, skip?: string): LocDef | undefined {
    const c = idx(m).towns.filter((l) => l.id !== skip && !l.minor && Math.hypot(l.x * WORLD_SCALE - d.x, l.y * WORLD_SCALE - d.y) < 26000);
    return c.length ? c[Math.floor(r() * c.length)] : nearest(idx(m).towns, d.x, d.y, skip);
  }
  /** 路口：两座城镇之间的某一点 */
  private roadSpot(m: MapId, x: number, y: number, r: () => number) {
    const t = idx(m).towns; const a = nearest(t, x + (r() - 0.5) * 16000, y + (r() - 0.5) * 12000); const b = a ? nearest(t, a.x * WORLD_SCALE + (r() - 0.5) * 20000, a.y * WORLD_SCALE + (r() - 0.5) * 14000, a.id) : undefined;
    if (!a || !b) return { x, y };
    const k = 0.3 + r() * 0.4; return { x: (a.x + (b.x - a.x) * k) * WORLD_SCALE, y: (a.y + (b.y - a.y) * k) * WORLD_SCALE };
  }
  /** 盯上谁：身怀所需之物、又打得过的人 */
  private findMark(d: NpcData, item: string): NpcData | undefined {
    const m = d.map ?? 'tiannan', pw = npcPower(d); let best: NpcData | undefined, bd = 45000;
    for (const o of this.host.list()) {
      if (o === d || !o.alive || (o.map ?? 'tiannan') !== m || o.hidden || !o.bag || !bagHas(o.bag, item) || o.beauty || o.bond) continue;
      if (sectOf(o) && sectOf(o) === sectOf(d)) continue;
      const dd = Math.hypot(o.x - d.x, o.y - d.y); if (dd > bd) continue;
      if (npcPower(o) > pw * 1.3) continue;
      best = o; bd = dd;
    }
    return best;
  }

  /** 近两月同图传开的「某某得了宝」：宝还在他身上、他又打不过我 */
  private coveted(d: NpcData): NpcData | undefined {
    const day = this.host.day(), m = d.map ?? 'tiannan', pw = npcPower(d);
    for (let i = this.S.ev.length - 1; i >= 0; i--) {
      const e = this.S.ev[i]; if (day - e.day > 60) break;
      if (e.map !== m || (e.k !== 'treasure' && e.k !== 'kill') || !e.a || e.a === d.id || e.a === 'hero') continue;
      const t = this.host.byId(e.a); if (!t || !t.alive || t.hidden || !roams(t) || (sectOf(t) && sectOf(t) === sectOf(d))) continue;
      if (!e.items?.some((b) => bagHas(t.bag, b.id) && (itemDef(b.id)?.type === 'artifact'))) continue;
      if (Math.hypot(t.x - d.x, t.y - d.y) > 60000 || npcPower(t) > pw * 0.9) continue;
      return t;
    }
    return undefined;
  }

  // ---------------------------------------------------------------- 抵达
  private arrive(d: NpcData, r: () => number) {
    const a = d.aim!, day = this.host.day(), m = d.map ?? 'tiannan';
    a.at = day;
    switch (a.k) {
      case 'secret': case 'grind': case 'task': {
        const l = LOC_BY_ID.get(a.loc ?? ''); if (!l) break;
        const s = this.site(l), gp = this.guardPower(l), pw = npcPower(d);
        if (a.k === 'secret' && !s.items.length) {
          if (s.taker && (d.canon || d.met || r() < 0.3)) this.log({ day, map: m, x: d.x, y: d.y, k: 'late', a: d.id, an: d.name, text: `${nm(d)}赶到${l.name}，禁制早已被人破开——宝物在${s.takenDay !== undefined ? yearMon(s.takenDay) : '早先'}已被${s.takerName ?? '人'}取走。` });
          break;
        }
        // 与镇守的妖兽 / 禁制拼一场
        const win = r() < winChance(pw * (a.k === 'secret' && d.age > d.life * 0.84 ? 1.25 : 1), gp);
        if (!win) {
          const die = r() < (a.k === 'secret' ? 0.35 : 0.12);
          if (die) { this.log({ day, map: m, x: d.x, y: d.y, k: 'secretdie', a: d.id, an: d.name, text: `${nm(d)}（${realmName(d.realm, d.stage)}）闯${l.name}，${a.k === 'secret' ? '触动禁制，身死道消' : '葬身妖兽之口'}。`, big: d.canon ? 1 : undefined }); this.host.die(d, a.k === 'secret' ? `闯${l.name}身死` : `葬身${l.name}妖兽之口`); return; }
          break;
        }
        if (a.k === 'secret' || r() < 0.5) {
          const got = s.items.splice(0, a.k === 'secret' ? s.items.length : 1);
          if (got.length) {
            for (const b of got) { bagPut(d.bag!, b.id, b.n, b.age); provOf(this.S, b.id, d.id, d.name, day, 'found'); }
            s.taker = d.id; s.takerName = d.name; s.takenDay = day;
            reequip(d); d.fame = (d.fame ?? 0) + (a.k === 'secret' ? 6 : 1);
            this.stats.treasures++;
            this.log({ day, map: m, x: d.x, y: d.y, k: 'treasure', a: d.id, an: d.name, items: got, text: `${nm(d)}（${realmName(d.realm, d.stage)}）${a.k === 'secret' ? '破开' + l.name + '的禁制' : '在' + l.name + '斩杀妖兽'}，得了${lootText(got)}。`, big: a.k === 'secret' ? 1 : undefined });
            // 延寿丹当场服下
            if (bagHas(d.bag, 'pill_yanshou') && d.age > d.life * 0.8) { bagTake(d.bag!, 'pill_yanshou', 1); d.life += 20; }
          }
        }
        d.wealth += Math.round((a.k === 'task' ? 30 : 20) * Math.pow(3.2, d.realm) * (0.5 + r()));
        if (a.k === 'task' && d.realm === 1 && d.stage >= 11 && !bagHas(d.bag, 'pill_zhuji') && r() < 0.2) {
          bagPut(d.bag!, 'pill_zhuji', 1);
          this.log({ day, map: m, x: d.x, y: d.y, k: 'task', a: d.id, an: d.name, text: `${nm(d)}为${locName(sectOf(d))}立下功劳，赏得筑基丹一枚。` });
        }
        break;
      }
      case 'buy': {
        const it = a.item ?? 'pill_zhuji', price = it === 'pill_zhuji' ? ZHUJI_PRICE : JIANGCHEN_PRICE;
        if (d.wealth >= price && !bagHas(d.bag, it)) {
          d.wealth -= price; bagPut(d.bag!, it, 1);
          this.log({ day, map: m, x: d.x, y: d.y, k: 'buy', a: d.id, an: d.name, items: [{ id: it, n: 1 }], text: `${nm(d)}在${locName(a.loc)}拍卖会上以${price}灵石拍得${itemDef(it)?.name}。` });
        }
        break;
      }
      case 'trade': {
        const gain = Math.round((40 + 60 * r()) * Math.pow(2.5, Math.max(0, d.realm)));
        d.wealth += gain;
        if ((d.bag?.length ?? 0) < 6) { const it = ['herb_lingzhi', 'pill_juqi', 'tal_fire', 'pill_liaoshang', 'herb_jinxin'][Math.floor(r() * 5)]; bagPut(d.bag!, it, 1 + Math.floor(r() * 3), it.startsWith('herb') ? 20 : undefined); }
        break;
      }
      default: break;
    }
    if (!a.until || a.k === 'secret' || a.k === 'buy' || a.k === 'trade' || a.k === 'grind' || a.k === 'task') a.until = day + (a.k === 'trade' ? 2 + r() * 4 : 1 + r() * 3);
  }

  // ---------------------------------------------------------------- 成长（打坐、吃丹、功法）
  grow(d: NpcData, days: number, r: () => number) {
    if (d.realm <= 0 || !d.alive) return;
    outfit(d);
    const R = REALMS[d.realm], st = Math.min(d.stage, R.expDays.length - 1);
    const needDays = (R.expDays[st] ?? 500) * (d.realm <= 1 ? 1.6 : 0.9);
    const gf = GONGFA[d.gongfa ?? 'generic'] ?? GONGFA.generic;
    const rate = gf.rate * (d.realm > gf.maxRealm ? 0.5 : 1) * (d.aim?.k === 'seclude' && d.aim.at !== undefined ? 1.5 : 0.8);
    d.xp = (d.xp ?? r() * 0.5) + days * rate / needDays;
    // 吃丹：手头有对路的修为丹，隔些日子服一颗
    if (d.xp < 1 && r() < Math.min(1, days / 25)) d.xp += eatExpPill(d, needDays * 10);
    let guard = 0;
    while (d.xp >= 1 && guard++ < 6) {
      if (d.stage < R.stages.length - 1 && d.realm < 5) { d.stage++; d.xp -= 1; continue; }
      if (d.realm >= 4 || d.realm >= 5) { d.xp = 1; break; }
      // 冲大境界：有辅助丹药成算大增，没有便是九死一生的苦熬
      const pill = BREAK_PILL[d.realm], has = !!pill && bagHas(d.bag, pill);
      const base = [0, 0.15, 0.1, 0.06, 0.03][d.realm], withP = [0, 0.65, 0.5, 0.4, 0.1][d.realm];
      if (has) bagTake(d.bag!, pill!, 1);
      if (r() < (has ? withP : base) && this.host.canAdvance(d)) {
        d.realm++; d.stage = 0; d.xp = 0; d.life = Math.max(d.life, REALMS[d.realm].life * (0.9 + r() * 0.2));
        d.fame = (d.fame ?? 0) + d.realm * 2; reequip(d); this.stats.breaks++;
        const pl = this.host.player();
        this.log({ day: this.host.day(), map: d.map ?? 'tiannan', x: d.x, y: d.y, k: 'break', a: d.id, an: d.name, text: `${nm(d)}${has ? '服下' + itemDef(pill!)?.name + '，' : ''}突破至${REALMS[d.realm].name}期！`, big: d.realm >= 3 || d.canon ? 1 : undefined });
        if (d.met || d.canon) this.host.news(`传闻${d.name}已突破至${REALMS[d.realm].name}期！`, d.canon ? 'canon' : 'rumor');
        if (d.realm >= 3) this.witness({ kind: 'break', who: d.id, realm: d.realm, x: d.x, y: d.y, map: d.map });
        void pl;
      } else {
        d.xp = has ? 0.55 : 0.75;
        if (has && (d.met || d.canon || r() < 0.3)) this.log({ day: this.host.day(), map: d.map ?? 'tiannan', x: d.x, y: d.y, k: 'fail', a: d.id, an: d.name, text: `${nm(d)}服下${itemDef(pill!)?.name}冲关，功败垂成。` });
      }
      break;
    }
  }

  // ---------------------------------------------------------------- 相遇与斗法
  /** a 想对 b 动手吗？返回冲突种类 */
  wantsFight(a: NpcData, b: NpcData, r: () => number): Clash | null {
    if (!a.alive || !b.alive || a.realm <= 0 || a.beauty || b.beauty || a.bond || b.bond || a.hidden || b.hidden || a.chasing || b.chasing) return null;
    if (a.vend === b.id || (a.aim?.k === 'hunt' && a.aim.who === b.id)) return 'feud';
    if (a.ros || a.gz || a.stay) return null;
    if (sectOf(a) && sectOf(a) === sectOf(b)) return null;
    if (a.aim?.k === 'rob' && a.aim.who === b.id) return 'rob';
    const pa = npcPower(a), pb = npcPower(b);
    if ((a.aim?.k === 'prowl' || robberish(a)) && pa > pb * 1.15 && (b.wealth > 15 || bagValue(b.bag) > 60) && !b.stay && !b.ros && !b.gz) {
      const k = (a.aim?.k === 'prowl' ? 0.7 : 0.3) * (b.faction === 'merchant' ? 1.5 : 1) * (b.faction === 'mortal' ? 0.3 : 1);
      return r() < k ? 'rob' : null;
    }
    if (evil(a) && (b.faction === 'sect' || b.pers === 'righteous') && pa > pb && r() < 0.08) return 'zeal';
    if (b.faction === 'demon' && a.pers === 'righteous' && a.faction !== 'mortal' && pa > pb * 0.9 && r() < 0.06) return 'zeal';
    return null;
  }
  /** 结算一场斗法：胜负、生死、储物袋换主人、记成事件 */
  resolve(a: NpcData, b: NpcData, kind: Clash, r: () => number, at?: { x: number; y: number }): SimEvent | null {
    const day = this.host.day(), m = a.map ?? 'tiannan';
    outfit(a); outfit(b);
    // 符箓在斗法里真的用掉
    const burn = (d: NpcData) => { let n = 0; for (const id of ['tal_thunder', 'tal_fire', 'tal_ice', 'tal_jingang']) while (n < 2 && bagHas(d.bag, id)) { bagTake(d.bag!, id, 1); n++; } return 1 + 0.08 * n; };
    const pa = npcPower(a) * burn(a), pb = npcPower(b) * burn(b);
    const aWins = r() < winChance(pa, pb);
    return this.settle(a, b, aWins, kind, r, at, false, pa, pb);
  }
  /** 胜负已分（神识层亲眼看着打完的，或 resolve 掷出的）：生死、得失、事件 */
  settle(a: NpcData, b: NpcData, aWins: boolean, kind: Clash, r: () => number, at?: { x: number; y: number }, shown = false, pa = npcPower(a), pb = npcPower(b)): SimEvent | null {
    const day = this.host.day(), m = a.map ?? 'tiannan';
    outfit(a); outfit(b);
    if (shown) this.stats.shown++;
    const [w, l] = aWins ? [a, b] : [b, a];
    const pW = aWins ? pa : pb, pL = aWins ? pb : pa;
    // 吃丹疗伤（败者逃命时也会用掉）
    if (bagHas(l.bag, 'pill_liaoshang')) bagTake(l.bag!, 'pill_liaoshang', 1);
    const attackerWon = w === a;
    let lethal = kind === 'feud' ? 0.85 : kind === 'zeal' ? 0.35 : attackerWon ? (evil(w) ? 0.38 : 0.15) : 0.3;
    if (w.pers === 'kind' || w.pers === 'righteous') lethal *= 0.5;
    const x = at?.x ?? (a.x + b.x) / 2, y = at?.y ?? (a.y + b.y) / 2;
    this.cool.set(a.id, day + 4); this.cool.set(b.id, day + 4);
    this.stats.clashes++;
    // 遁地符：保命
    if (kind !== 'feud' && bagHas(l.bag, 'tal_escape') && r() < 0.85) {
      bagTake(l.bag!, 'tal_escape', 1);
      const drop = Math.round(l.wealth * 0.3); l.wealth -= drop; w.wealth += drop;
      this.flee(l, r);
      return this.log({ day, map: m, x, y, k: 'rob', a: w.id, b: l.id, an: w.name, bn: l.name, items: drop ? [{ id: 'mat_lingshi', n: drop }] : [], text: `${nm(a)}在${this.where(m, x, y)}${kind === 'rob' ? '截住' : '与'}${nm(b)}${kind === 'rob' ? '' : '斗法'}，${nm(l)}捏碎遁地符逃了，只丢下${drop}灵石。` });
    }
    if (r() < lethal) {
      const got = takeAll(l, w);
      provMoveAll(this.S, got, l.id, l.name, w.id, w.name, day, 'kill', sectOf(l));   // 第五阶段：宝物易主记账
      w.fame = (w.fame ?? 0) + 2 + l.realm; w.xp = (w.xp ?? 0) + clamp(0.08 * pL / pW, 0.01, 0.3);
      if (w.vend === l.id) w.vend = undefined; if (l.vend === w.id) l.vend = undefined;
      const why = kind === 'feud' ? `死于${w.name}之手（仇杀）` : `死于${w.name}之手`;
      this.stats.kills++; if (kind === 'rob') this.stats.robs++;
      const ev = this.log({ day, map: m, x, y, k: kind === 'feud' ? 'feud' : 'kill', a: w.id, b: l.id, an: w.name, bn: l.name, items: got, big: l.canon || l.realm >= 3 ? 1 : undefined,
        text: kind === 'feud' ? `${nm(w)}与${nm(l)}在${this.where(m, x, y)}了结旧仇，${nm(l)}身死道消，储物袋落入${nm(w)}手中（${lootText(got) || '空空如也'}）。`
          : kind === 'rob' ? (attackerWon ? `${nm(w)}在${this.where(m, x, y)}劫杀了${nm(l)}（${l.faction === 'merchant' ? '行商' : realmName(l.realm, l.stage)}），夺走${lootText(got) || '一只空储物袋'}。` : `${nm(l)}拦路打劫，反被${nm(w)}斩于${this.where(m, x, y)}，储物袋归了${nm(w)}（${lootText(got) || '空空如也'}）。`)
          : `${nm(w)}与${nm(l)}正魔不两立，在${this.where(m, x, y)}斗法，${nm(l)}陨落，${lootText(got) || '储物袋'}归了${nm(w)}。` });
      this.host.die(l, why);
      this.host.onNpcKill(l, w);
      if (l.met || l.canon) this.host.news(ev.text, l.canon ? 'canon' : 'rumor');
      return ev;
    }
    // 不害命：劫财 / 打跑
    const got = attackerWon && kind === 'rob' ? takeSome(l, w, r) : [];
    if (got.length) provMoveAll(this.S, got, l.id, l.name, w.id, w.name, day, 'rob', sectOf(l));
    this.flee(l, r);
    if (got.length) this.stats.robs++;
    w.xp = (w.xp ?? 0) + clamp(0.04 * pL / pW, 0.005, 0.15);
    return this.log({ day, map: m, x, y, k: 'rob', a: w.id, b: l.id, an: w.name, bn: l.name, items: got,
      text: kind === 'rob' ? (attackerWon ? `${nm(w)}在${this.where(m, x, y)}拦路打劫${nm(l)}，抢走${lootText(got) || '些许灵石'}，饶了${l.sex === 'f' ? '她' : '他'}一命。` : `${nm(a)}想劫${nm(b)}，反被打得落荒而逃。`)
        : `${nm(w)}与${nm(l)}在${this.where(m, x, y)}斗法，${nm(l)}不敌，化作遁光逃走。` });
  }
  private flee(d: NpcData, r: () => number) { const home = LOC_BY_ID.get(d.home); if (home && home.map === (d.map ?? 'tiannan')) { d.aim = { k: 'home', x: P(home).x + (r() - 0.5) * 400, y: P(home).y, t0: this.host.day(), until: this.host.day() + 10 }; d.tx = d.aim.x; d.ty = d.aim.y; } }
  where(m: MapId, x: number, y: number) { const l = nearest(locsOf(m), x, y); if (!l) return '荒野'; const dd = Math.hypot(l.x * WORLD_SCALE - x, l.y * WORLD_SCALE - y); return dd < 1500 ? l.name + '附近' : `${l.name}${['东', '东南', '南', '西南', '西', '西北', '北', '东北'][(Math.round(Math.atan2(y - l.y * WORLD_SCALE, x - l.x * WORLD_SCALE) / (Math.PI / 4)) + 8) % 8]}${Math.max(1, Math.round(dd / 1000))}里外`; }

  /** 一批人里谁撞上了谁（网格分桶，O(n)）。城镇宗门地界里的人只了结血仇 */
  private encounters(ds: NpcData[], R: number, m: MapId, live: boolean, salt: number) {
    const day = this.host.day(), pl = this.host.player();
    const cell = R * 1.2, grid = new Map<number, NpcData[]>(), safe = new Set<NpcData>();
    for (const d of ds) {
      if (!d.alive || d.realm <= 0 && d.faction !== 'merchant' || (this.cool.get(d.id) ?? -1) > day || this.host.busy(d.id)) continue;
      if (safeSpot(m, d.x, d.y)) { if (!d.vend && d.aim?.k !== 'hunt') continue; safe.add(d); }
      const k = (Math.floor(d.x / cell) & 0xffff) << 16 | (Math.floor(d.y / cell) & 0xffff);
      let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(d);
    }
    const R2 = R * R;
    const feudOnly = (a: NpcData, b: NpcData) => a.vend === b.id || b.vend === a.id || (a.aim?.k === 'hunt' && a.aim.who === b.id) || (b.aim?.k === 'hunt' && b.aim.who === a.id);
    for (const [k, arr] of grid) {
      const gx = k >>> 16, gy = k & 0xffff;
      for (let ox = 0; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        if (ox === 0 && oy < 0) continue;
        const other = ox === 0 && oy === 0 ? arr : grid.get(((gx + ox) & 0xffff) << 16 | ((gy + oy) & 0xffff)); if (!other) continue;
        for (let i = 0; i < arr.length; i++) for (let j = other === arr ? i + 1 : 0; j < other.length; j++) {
          const a = arr[i], b = other[j];
          const dx = a.x - b.x, dy = a.y - b.y; if (dx * dx + dy * dy > R2) continue;
          if (!a.alive || !b.alive || (this.cool.get(a.id) ?? -1) > day || (this.cool.get(b.id) ?? -1) > day) continue;
          if ((safe.has(a) || safe.has(b)) && !feudOnly(a, b)) continue;
          let rr: (() => number) | null = null;
          const r = () => (rr ??= this.rng(hid(a.id), hid(b.id), Math.floor(day * 4), salt))();
          let A = a, B = b, kind = this.wantsFight(a, b, r);
          if (!kind) { kind = this.wantsFight(b, a, r); A = b; B = a; }
          if (!kind) continue;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          // 玩家就在旁边：交给神识层亲自演出
          if (live && m === pl.map && (Math.hypot(mx - pl.x, my - pl.y) < pl.sense * 1.4 || this.host.isActive(a.id) || this.host.isActive(b.id))) {
            if (this.host.showClash(A, B, kind)) { this.cool.set(a.id, day + 2); this.cool.set(b.id, day + 2); this.stats.shown++; }
            continue;
          }
          this.resolve(A, B, kind, r);
        }
      }
    }
  }

  // ---------------------------------------------------------------- 实时层（当前地图）
  live(dt: number, timeScale = 1) {
    const h = this.host, day = h.day(), m = h.activeMap, pl = h.player();
    this.listT -= dt;
    if (this.listT <= 0 || !this.liveList.length) { this.listT = 1.5; this.liveList = h.list().filter((d) => d.alive && (d.map ?? 'tiannan') === m); }
    const ddays = dt / DAY_S * timeScale;
    for (const d of this.liveList) {
      if (!d.alive) continue;
      if (h.isActive(d.id)) { if (d.aim?.who) this.follow(d); this.checkArrive(d, day); continue; }   // 神识层自己走（追人的随时更新落点）
      if (d.chasing || d.hidden) continue;
      if (d.hunting && pl.map === m) { d.tx = pl.x; d.ty = pl.y; }
      else if (!d.aim) { this.thinkQ.push(d); continue; }
      else { this.follow(d); }
      this.step(d, ddays * (d.hunting ? 1.6 : 1));
      this.checkArrive(d, day);
    }
    // 分帧：每帧最多替 12 个人拿主意
    for (let i = 0; i < 12 && this.thinkQ.length; i++) { const d = this.thinkQ.shift()!; if (d.alive) this.think(d, this.rng(hid(d.id), Math.floor(day * 8), 3)); }
    this.encT -= dt;
    if (this.encT <= 0) { this.encT = 0.5; this.encounters(this.liveList, LIVE_R, m, true, 1); this.siteCheck(); }
    this.slow();
  }
  /** 追着人跑的目标：每次都更新落点 */
  private follow(d: NpcData) {
    const a = d.aim!; if (!a.who) return;
    if (a.k === 'bounty' || a.k === 'probe' || a.k === 'covet') { const pl = this.host.player(); if (pl.map === (d.map ?? 'tiannan')) { a.x = pl.x; a.y = pl.y; d.tx = a.x; d.ty = a.y; } return; }
    const t = this.host.byId(a.who);
    if (!t || !t.alive || (t.map ?? 'tiannan') !== (d.map ?? 'tiannan')) { a.until = 0; a.at = this.host.day(); return; }
    a.x = t.x; a.y = t.y; d.tx = t.x; d.ty = t.y;
  }
  private step(d: NpcData, days: number) {
    const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
    if (dd < 30) return;
    const sp = (d.realm >= 2 ? REALMS[d.realm].speed * 1.8 : REALMS[Math.max(0, d.realm)].speed) * DAY_S * days;
    const k = Math.min(1, sp / dd); d.x += dx * k; d.y += dy * k; this.stats.moves++;
  }
  private checkArrive(d: NpcData, day: number) {
    const a = d.aim; if (!a) return;
    if (a.k === 'covet') { if (day - a.t0 > 45) d.aim = undefined; return; }   // 第五阶段：冲你的宝来的，一路跟到底（一个半月找不着才作罢）
    if (a.at === undefined) {
      if (a.who && (a.k === 'hunt' || a.k === 'rob')) { const t = this.host.byId(a.who); if (!t || !t.alive) { a.at = day; a.until = day; } return; }
      if (Math.hypot(a.x - d.x, a.y - d.y) < ARRIVE) this.arrive(d, this.rng(hid(d.id), Math.floor(day * 8), 5));
      else if (day - a.t0 > 240) { a.at = day; a.until = day; }   // 走了大半年还没到：换个念头
      return;
    }
    if ((a.until ?? 0) <= day && d.alive) { d.aim = undefined; if (!this.host.isActive(d.id)) this.thinkQ.push(d); else this.think(d, this.rng(hid(d.id), Math.floor(day * 8), 4)); }
  }
  /** 神识层的人到站后问一句：该往哪去（返回 true = 已按目标设好 tx/ty） */
  steer(d: NpcData): boolean {
    if (!roams(d) || d.faction === 'mortal') return false;
    const day = this.host.day();
    if (!d.aim || ((d.aim.at !== undefined) && (d.aim.until ?? 0) <= day)) { d.aim = undefined; this.think(d, this.rng(hid(d.id), Math.floor(day * 8), 6)); }
    const a = d.aim!; if (a.at !== undefined) return false;   // 到了：在原地附近自己活动
    d.tx = a.x; d.ty = a.y; return true;
  }
  /** 玩家走到秘境 / 险地：还在的宝就是你的（被 NPC 先拿走的，只剩空壳） */
  private siteCheck() {
    const pl = this.host.player(), m = this.host.activeMap, day = this.host.day(); if (pl.map !== m) return;
    for (const l of idx(m).secret) {
      const dd = Math.hypot(l.x * WORLD_SCALE - pl.x, l.y * WORLD_SCALE - pl.y); if (dd > 700) continue;
      const s = this.site(l);
      if (s.items.length) {
        const got = s.items.splice(0); s.taker = 'hero'; s.takerName = pl.name; s.takenDay = day;
        this.host.giveSiteLoot(l.x * WORLD_SCALE, l.y * WORLD_SCALE, got);
        this.log({ day, map: m, x: pl.x, y: pl.y, k: 'hero', a: 'hero', an: pl.name, items: got, seen: 1, text: `${pl.name}在${l.name}破开残存的禁制，得了${lootText(got)}。` });
      } else if (s.taker && s.taker !== 'hero' && (s.told ?? -1) < (s.takenDay ?? 0)) {
        s.told = day;
        this.host.toast(`来晚一步：${l.name}的禁制早被破开——${s.takenDay !== undefined ? yearMon(s.takenDay) : '早先'}，宝物已被${s.takerName}取走。`, 'warn');
      }
    }
  }

  // ---------------------------------------------------------------- 按日结算（所有地图的成长；他图的赶路与相遇）
  /** 按日结算：一下子过去好几天（闭关、远行、测试）时同步补完；平常一天一天的推进交给 slow() 分帧去做 */
  daily(days: number) {
    if (days < 2) return;
    const h = this.host, day = h.day(), list = h.list();
    // 成长与寿元
    for (const d of list) {
      if (!d.alive) continue;
      this.last.set(d.id, day);
      this.grow(d, days, this.rng(hid(d.id), Math.floor(day), 11));
      this.ageCheck(d, day);
    }
    // 赶路与相遇：所有地图（本图神识层里的人除外）按天步进
    const steps = Math.min(30, Math.max(1, Math.round(days)));
    const per = days / steps;
    for (const m of MAP_IDS) {
      const ds = list.filter((d) => d.alive && (d.map ?? 'tiannan') === m && !h.isActive(d.id) && !d.chasing && !d.hidden);
      for (let s = 0; s < steps; s++) {
        const dayS = day - days + per * (s + 1);
        for (const d of ds) {
          if (!d.alive) continue;
          if (!d.aim) { this.think(d, this.rng(hid(d.id), Math.floor(dayS * 8), 7)); continue; }
          this.follow(d);
          this.step(d, per);
          this.checkArriveAt(d, dayS);
        }
        this.encounters(ds, DAY_R, m, false, 2 + s);
      }
    }
  }
  private ageCheck(d: NpcData, day: number) {
    if (d.age > d.life && d.alive) { this.log({ day, map: d.map ?? 'tiannan', x: d.x, y: d.y, k: 'die', a: d.id, an: d.name, text: `${nm(d)}（${realmName(d.realm, d.stage)}）寿元耗尽，坐化于${this.where(d.map ?? 'tiannan', d.x, d.y)}。`, big: d.canon ? 1 : undefined }); this.host.die(d, '寿元耗尽，坐化'); }
  }
  // ---------------------------------------------------------------- 慢车道（分帧）：每帧轮到几十个人——成长、寿元；他图的人顺带赶路、办事，转完一圈查一次相遇
  private last = new Map<string, number>();
  private slowList: NpcData[] = []; private slowI = 0; private offBy: Partial<Record<MapId, NpcData[]>> = {}; private encDay: Partial<Record<MapId, number>> = {};
  slow(budget = 40) {
    const h = this.host, day = h.day();
    if (this.slowI >= this.slowList.length) {
      for (const m of MAP_IDS) { const ds = this.offBy[m]; if (!ds || m === h.activeMap || day - (this.encDay[m] ?? -9) < 0.5) continue; this.encDay[m] = day; this.encounters(ds, DAY_R, m, false, Math.floor(day * 2)); }
      this.slowList = h.list().filter((d) => d.alive); this.slowI = 0; this.offBy = {};
      for (const d of this.slowList) { const m = d.map ?? 'tiannan'; if (m !== h.activeMap && !d.chasing && !d.hidden) (this.offBy[m] ??= []).push(d); }
    }
    const end = Math.min(this.slowList.length, this.slowI + budget);
    for (; this.slowI < end; this.slowI++) {
      const d = this.slowList[this.slowI]; if (!d.alive) continue;
      const l0 = this.last.get(d.id); if (l0 === undefined) { this.last.set(d.id, day); continue; }
      const dd = day - l0; if (dd < 0.25) continue;
      this.last.set(d.id, day);
      this.grow(d, dd, this.rng(hid(d.id), Math.floor(day * 4), 11));
      this.ageCheck(d, day);
      if (!d.alive || (d.map ?? 'tiannan') === h.activeMap || d.chasing || d.hidden) continue;
      if (!d.aim) { this.think(d, this.rng(hid(d.id), Math.floor(day * 8), 7)); continue; }
      this.follow(d); this.step(d, dd); this.checkArriveAt(d, day);
    }
  }
  private checkArriveAt(d: NpcData, dayS: number) {
    const a = d.aim!;
    if (a.at === undefined) {
      if (a.who && (a.k === 'hunt' || a.k === 'rob')) { const t = this.host.byId(a.who); if (!t || !t.alive) { d.aim = undefined; } return; }
      if (Math.hypot(a.x - d.x, a.y - d.y) < ARRIVE * 2) this.arrive(d, this.rng(hid(d.id), Math.floor(dayS * 8), 5));
      else if (dayS - a.t0 > 240) d.aim = undefined;
      return;
    }
    if ((a.until ?? 0) <= dayS) d.aim = undefined;
  }

  // ---------------------------------------------------------------- 给奇遇系统用的真人
  /** 恶名在外：从真人里挑一个贪财又自认打得过你的，让他动身来找你（不再凭空生成赏金猎人） */
  recruitBounty(): NpcData | null {
    const h = this.host, pl = h.player(), m = h.activeMap, day = h.day(); if (pl.map !== m) return null;
    const hp = power(h.hero()); let best: NpcData | null = null, bd = 1e18;
    for (const d of h.list()) {
      if (!d.alive || (d.map ?? 'tiannan') !== m || !roams(d) || !greedy(d) || d.faction === 'mortal' || h.isActive(d.id) || d.aim?.k === 'bounty') continue;
      if (npcPower(d) < hp * 0.7) continue;
      const dd = Math.hypot(d.x - pl.x, d.y - pl.y); if (dd < pl.sense * 1.5 || dd > 60000) continue;
      if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) return null;
    best.aim = { k: 'bounty', x: pl.x, y: pl.y, who: 'hero', t0: day }; best.tx = pl.x; best.ty = pl.y; best.why = best.why ?? '为悬赏而来';
    this.log({ day, map: m, x: best.x, y: best.y, k: 'hero', a: best.id, an: best.name, text: `${best.name}（${realmName(best.realm, best.stage)}）揭了悬赏，动身来寻${pl.name}的踪迹。`, heard: day + 2 });
    return best;
  }
  /** 你身边不远处正在跑货的真实行商 */
  merchantNear(min: number, max: number): NpcData | null {
    const h = this.host, pl = h.player(), m = h.activeMap; if (pl.map !== m) return null;
    for (const d of h.list()) {
      if (!d.alive || d.faction !== 'merchant' || (d.map ?? 'tiannan') !== m || d.hidden || h.isActive(d.id) || d.aim?.k !== 'trade' || d.aim.at !== undefined) continue;
      const dd = Math.hypot(d.x - pl.x, d.y - pl.y); if (dd >= min && dd <= max) return d;
    }
    return null;
  }
  /** 护送结束：商人回到世界里，结局落在他本人身上 */
  caravanEnd(id: string | undefined, x: number, y: number, res: 'safe' | 'robbed' | 'left') {
    const d = id ? this.host.byId(id) : undefined; if (!d) return;
    const day = this.host.day(), m = d.map ?? 'tiannan';
    d.hidden = false; d.escort = undefined; d.x = x; d.y = y;
    if (res === 'safe') { d.favor = Math.min(100, d.favor + 25); d.met = true; d.wealth += 200; d.aim = undefined; this.log({ day, map: m, x, y, k: 'trade', a: d.id, an: d.name, seen: 1, text: `行商${d.name}在${this.host.player().name}护送下平安抵达。` }); }
    else if (res === 'robbed') { outfit(d); const lost = Math.round(d.wealth * 0.7); d.wealth -= lost; d.bag = d.bag!.filter((b) => itemDef(b.id)?.type === 'artifact'); this.log({ day, map: m, x, y, k: 'rob', b: d.id, bn: d.name, seen: 1, items: [{ id: 'mat_lingshi', n: lost }], text: `行商${d.name}的商队在${this.where(m, x, y)}遭山匪劫掠，货物与${lost}灵石尽失。` }); this.flee(d, this.rng(hid(d.id), Math.floor(day), 21)); }
  }
  /** 读档后：清掉上一局的临时状态 */
  onLoad() { this.cool.clear(); this.thinkQ = []; this.liveList = []; for (const d of this.host.list()) if (d.escort) { d.escort = undefined; d.hidden = false; } }

  // ---------------------------------------------------------------- 世界见证
  /** 突破异象等：附近的人看见、传闻扩散；玩家的话，宗门送贺、他宗拉拢、仇家来探、众人改了称呼 */
  witness(w: WitnessEvent): SimEvent {
    const h = this.host, day = h.day(), pl = h.player();
    const hero = w.who === 'hero';
    const d = hero ? undefined : h.byId(w.who);
    const map = w.map ?? (hero ? pl.map : d?.map ?? 'tiannan');
    const x = w.x ?? (hero ? pl.x : d?.x ?? 0), y = w.y ?? (hero ? pl.y : d?.y ?? 0);
    const name = hero ? pl.name : d?.name ?? '某人';
    const R = 3000 + w.realm * 2500;
    const seenBy = h.list().filter((o) => o.alive && o.realm > 0 && o !== d && (o.map ?? 'tiannan') === map && Math.hypot(o.x - x, o.y - y) < R);
    const rn = REALMS[w.realm]?.name ?? '';
    const omen = w.realm >= 4 ? '天地灵气倒卷，方圆百里风云变色，元婴法相隐现云端' : w.realm >= 3 ? '金丹异象冲霄，霞光照彻数十里' : '灵气如潮，一道灵光冲天而起';
    const text = w.text ?? `${this.where(map, x, y)}${omen}——${name}${w.kind === 'break' ? `突破${rn}期` : '显露神通'}！${seenBy.length ? `${seenBy.slice(0, 3).map(nm).join('、')}${seenBy.length > 3 ? `等${seenBy.length}人` : ''}亲眼目睹。` : ''}`;
    const ev = this.log({ day, map, x, y, k: 'omen', a: hero ? 'hero' : d?.id, an: name, text, big: 1, seen: hero ? 1 : undefined });
    if (map === h.activeMap && Math.hypot(x - pl.x, y - pl.y) < Math.max(pl.sense * 4, 12000)) { h.omen(x, y, w.realm); if (!hero) h.toast(`远处异象：${name}${w.kind === 'break' ? `结成${rn}` : ''}，${omen}。`, 'info'); }
    if (hero) {
      const S = this.S; S.fame = (S.fame ?? 0) + [0, 1, 6, 20, 60, 150][clamp(w.realm, 0, 5)];
      const hp0 = power(h.hero());
      for (const o of seenBy) if (o.favor > -20 && npcPower(o) < hp0) o.favor = Math.min(100, o.favor + (o.pers === 'arrogant' ? 1 : 4));
      if (w.realm >= 2) for (const line of h.heroCongrats(w.realm)) this.log({ day, map, x, y, k: 'hero', a: 'hero', an: name, text: line, seen: 1 });
      // 仇家来探虚实：自觉还有一拼之力的那一个
      const hp = power(h.hero());
      const foes = h.list().filter((o) => o.alive && (o.grudge ?? 0) > 0 && (o.map ?? 'tiannan') === map && roams(o) && !h.isActive(o.id));
      foes.sort((a, b) => npcPower(b) - npcPower(a));
      const f = foes.find((o) => npcPower(o) > hp * 0.5);
      if (f) { f.aim = { k: 'probe', x: pl.x, y: pl.y, who: 'hero', t0: day }; f.tx = pl.x; f.ty = pl.y; h.sendProbe(f); this.log({ day, map, x: f.x, y: f.y, k: 'hero', a: f.id, an: f.name, text: `仇家${f.name}（${realmName(f.realm, f.stage)}）听闻${name}突破，暗中动身前来打探虚实。`, heard: day + 3 }); }
      for (const o of foes) if (o !== f && npcPower(o) < hp * 0.3 && o.pers === 'cautious') { o.grudge = 0; o.why = undefined; }
    } else if (d) { d.fame = (d.fame ?? 0) + w.realm * 3; }
    return ev;
  }
  /** NPC 对你的称呼（随境界与名声而变） */
  address(d: NpcData): string {
    const S = this.S, hv = this.host.hero(), gap = hv.realm - d.realm, fame = S.fame ?? 0;
    const sur = this.host.player().name.slice(0, 1);
    if (gap >= 2 || (hv.realm >= 4 && gap >= 1)) return hv.realm >= 4 ? `${sur}老祖` : `${sur}前辈`;
    if (gap >= 1) return fame >= 20 ? `${sur}前辈` : '前辈';
    if (gap <= -2) return '小友';
    return fame >= 25 ? `${sur}道友` : '道友';
  }

  // ---------------------------------------------------------------- 风云榜
  ranking(n = 20, map?: MapId) {
    const h = this.host, hv = h.hero();
    const rows: { id: string; name: string; realm: number; stage: number; power: number; map: MapId; title: string; main?: string; fame: number; hero?: boolean }[] = [];
    for (const d of h.list()) {
      if (!d.alive || d.realm <= 0 || (map && (d.map ?? 'tiannan') !== map)) continue;
      rows.push({ id: d.id, name: d.name, realm: d.realm, stage: d.stage, power: npcPower(d), map: d.map ?? 'tiannan', title: d.title ?? (sectOf(d) ? locName(sectOf(d)) : d.faction === 'demon' ? '魔修' : d.faction === 'merchant' ? '行商' : '散修'), main: d.main, fame: d.fame ?? 0 });
    }
    const pl = h.player();
    rows.push({ id: 'hero', name: pl.name, realm: hv.realm, stage: hv.stage, power: power(hv), map: pl.map, title: '你', main: hv.main, fame: this.S.fame ?? 0, hero: true });
    rows.sort((a, b) => b.power - a.power || b.fame - a.fame);
    const heroRank = rows.findIndex((r) => r.hero) + 1;
    return { top: rows.slice(0, n), heroRank, total: rows.length };
  }
  /** 调试叠加：某张图上每个人在干嘛 */
  doing(d: NpcData): string { if (d.hunting) return '追杀你'; if (d.chasing) return '追杀你'; const a = d.aim; if (!a) return d.stay ? '坐镇' : '盘算'; return AIM_NAME[a.k] + (a.at !== undefined && a.k !== 'seclude' ? '·歇脚' : ''); }
  mapName(m: MapId) { return MAP_NAME[m]; }
}
