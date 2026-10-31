// 第四十二步：活世界（代号「活世界」）——让每一个 NPC 都活成一个人
//
// 设计要义：世界不围着玩家转。NPC 有自己的储物袋（件件有来路）、功法与熟练度、
// 门派、家眷（道侣 / 子嗣 / 遗产传承）、恩怨（有缘由、有因果链、会寻仇）、社交（结识 / 赠礼 / 反目）。
// 他们互相劫掠、互相寻仇、成亲生子、继承遗物——这些事没有玩家也照常发生。
// 只有与你【有交情 / 有羁绊 / 同门】的人，才会托传音符向你求助，且句句说清：
// 谁、在何时、因何事、抢了什么、为什么找的是你。求助有因果链可查，玩家可追讨 / 调停 / 补偿 / 归还。
//
// 本文件为纯逻辑引擎：不依赖渲染与 Game，游戏（huogame.ts 适配器）与 Web 观察台共用同一套规则。
import { ITEM_LIST, itemDef } from '../data/items';
import { ART_LIST, artById } from '../data/arts';
import { mulberry32 } from '../core/rng';

// ---------------------------------------------------------------- 类型
export interface HwTie { id: string; k: string; r: string }
/** 引擎眼中的“人”：NpcData 的结构子集（游戏侧天然满足） */
export interface HwPerson {
  id: string; name: string; sex: 'm' | 'f';
  realm: number; stage: number; faction: string; sect?: string; home: string; map?: string;
  pers: string; favor: number; grudge?: number; met?: boolean; alive: boolean;
  age: number; life: number; wealth: number; seed: number;
  canon?: boolean; beauty?: string; stay?: boolean; bond?: string;
  ties?: HwTie[]; hw?: HwNpc; why?: string;
}
/** 储物袋里的一件东西。from：来路（谁赠的 / 从谁手里夺的），件件有来路 */
export interface HwItem { id: string; n: number; from?: string }
export interface HwFeud { id: string; why: string; day: number; lv: 1 | 2; cause?: number }
export interface HwNpc {
  bag: HwItem[]; art: string; artXp: number;
  health: number; mood: number; act: string;
  rel: Record<string, number>;            // 对其他 NPC 的好恶（-100…100）
  feuds: HwFeud[];
  spouse?: string; kids: string[]; parents: string[];
  lastPlea?: number; lastGift?: number; settled?: boolean;
}
export type HwKind = '修行' | '机缘' | '坊市' | '结缘' | '家事' | '仇怨' | '劫掠' | '仇杀' | '陨落' | '求助' | '侠义' | '宗门' | '传承';
export const HW_KINDS: HwKind[] = ['修行', '机缘', '坊市', '结缘', '家事', '仇怨', '劫掠', '仇杀', '陨落', '求助', '侠义', '宗门', '传承'];
export interface HwEvent { id: number; day: number; kind: HwKind; text: string; ids: string[]; cause?: number; big?: boolean }
export interface HwPlea {
  id: number; day: number; giver: string; kind: 'rob' | 'murder'; target: string;
  items: HwItem[]; stones: number;
  why: string;      // 事情本身（谁被抢了什么）
  reason: string;   // 为什么找的是你
  cause: number;    // 源头事件 id（因果链）
  /** 因果链在立帖时冻结（事件流水会被裁剪，信里的来龙去脉不会丢） */
  trail: { day: number; kind: string; text: string }[];
  status: 'open' | 'done' | 'gone'; result?: string;
}
export interface HwState {
  v: number; eid: number; pid: number; pleaCd: number;
  events: HwEvent[]; pleas: HwPlea[];
  stats: Record<string, number>;
}
export interface HwHost {
  day: number;
  persons: HwPerson[];
  rnd(): number;
  news(text: string, big?: boolean): void;
  link(a: HwPerson, b: HwPerson, k: string, ra: string, rb: string): void;
  /** 出生：宿主造一个真实的人（进名册 / 列表），引擎负责亲缘 */
  birth(m: HwPerson, f: HwPerson, name: string, sex: 'm' | 'f'): HwPerson | null;
  /** NPC 仇杀：宿主做仇恨蔓延（亲族记恨凶手等） */
  onKill(victim: HwPerson, killer: HwPerson): void;
  onPlea(p: HwPlea, giver: HwPerson): void;
  playerSect?: string;
  playerName: string;
  givePlayer(items: HwItem[], stones: number): void;
  takePlayer(items: HwItem[], stones: number): boolean;
  homeName(id: string): string;
  joinSect?(d: HwPerson): string | null;
}

export const hwFresh = (): HwState => ({ v: 1, eid: 1, pid: 1, pleaCd: 0, events: [], pleas: [], stats: {} });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lv = (d: HwPerson) => d.realm * 13 + d.stage;
const SURN = '韩李王张刘陈杨赵黄周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许冯邓曹彭萧田董潘袁蔡蒋叶程苏魏吕沈任姚卢钟陆白秦孟温柳';
const MN = ['云', '风', '清', '玄', '明', '远', '松', '鹤', '天', '一', '真', '平', '岳', '霄', '尘', '泽', '峰', '石', '江', '海', '仁', '义', '飞', '鸿', '青', '寒', '烈', '浩', '谦', '恒', '昭', '砚'];
const FN = ['婉', '月', '雪', '灵', '秀', '芸', '霜', '凝', '烟', '琴', '瑶', '思', '玉', '蓉', '菲', '素', '青', '璇', '若', '紫', '晴', '湘', '莲', '芷', '棠'];
export const hwName = (rnd: () => number, sex: 'm' | 'f', surname?: string) => {
  const pool = sex === 'f' ? FN : MN;
  const n = rnd() < 0.55 ? pool[Math.floor(rnd() * pool.length)] + pool[Math.floor(rnd() * pool.length)] : pool[Math.floor(rnd() * pool.length)];
  return (surname ?? SURN[Math.floor(rnd() * SURN.length)]) + n;
};
const surOf = (n: string) => n.slice(0, 1);
const pron = (d: HwPerson) => (d.sex === 'f' ? '她' : '他');
const ART_LV = (xp: number) => (xp >= 600 ? '圆满' : xp >= 300 ? '大成' : xp >= 100 ? '小成' : '初学');
const EV_CAP = 420;

// 物品池（按类型缓存，避免每日过滤）
let POOLS: Record<string, typeof ITEM_LIST> | null = null;
const pools = () => {
  if (!POOLS) {
    POOLS = {};
    for (const t of ['herb', 'pill', 'artifact', 'scroll', 'talisman', 'material']) POOLS[t] = ITEM_LIST.filter((i) => i.type === t && i.price > 0);
  }
  return POOLS;
};
const pickItem = (rnd: () => number, type: string, tierCap: number) => {
  const pool = (pools()[type] ?? []).filter((i) => i.tier <= tierCap);
  if (!pool.length) return null;
  // 低阶常见，高阶稀有
  const weighted = pool.filter((i) => rnd() < Math.pow(0.55, Math.max(0, i.tier - 1)) || i.tier <= 1);
  const arr = weighted.length ? weighted : pool;
  return arr[Math.floor(rnd() * arr.length)];
};

export class LivingWorld {
  st: HwState;
  constructor(saved?: HwState | null) { this.st = saved && saved.v === 1 ? saved : hwFresh(); }

  // ------------------------------------------------------------ 建档：储物袋 / 功法
  ensure(d: HwPerson): HwNpc {
    if (d.hw) return d.hw;
    const rnd = mulberry32((d.seed ^ 0x9e3779b9) >>> 0);
    const hw: HwNpc = { bag: [], art: '', artXp: Math.floor(rnd() * 120), health: 70 + Math.floor(rnd() * 30), mood: 45 + Math.floor(rnd() * 30), act: '各安生计', rel: {}, feuds: [], kids: [], parents: [] };
    if (d.realm > 0) {
      const cap = Math.min(4, d.realm + (d.pers === 'greedy' ? 1 : 0));
      const n = 2 + Math.min(5, d.realm + Math.floor(rnd() * 3));
      for (let i = 0; i < n; i++) {
        const roll = rnd();
        const type = roll < 0.3 ? 'pill' : roll < 0.6 ? 'herb' : roll < 0.75 ? 'artifact' : roll < 0.85 ? 'talisman' : roll < 0.93 ? 'scroll' : 'material';
        const it = pickItem(rnd, type, type === 'artifact' ? Math.min(cap, d.realm) : cap);
        if (it) this.put(hw, it.id, it.type === 'artifact' || it.type === 'scroll' ? 1 : 1 + Math.floor(rnd() * 3));
      }
      const arts = ART_LIST.filter((a) => a.realm <= d.realm && a.realm >= Math.max(1, d.realm - 1) && a.cast !== 'sense');
      const good = arts.filter((a) => a.tier >= Math.min(3, d.realm));
      const pool = good.length && rnd() < 0.6 ? good : arts;
      if (pool.length) hw.art = pool[Math.floor(rnd() * pool.length)].id;
    } else if (rnd() < 0.5) {
      const it = pickItem(rnd, 'herb', 1); if (it) this.put(hw, it.id, 1);
    }
    // 既有亲缘（开局织好的 ties）抄进家谱
    for (const t of d.ties ?? []) {
      if (t.k === 'lover') hw.spouse = t.id;
      if (t.k === 'kin' && (t.r === '父' || t.r === '母')) hw.parents.push(t.id);
      if (t.k === 'kin' && (t.r === '子' || t.r === '女')) hw.kids.push(t.id);
    }
    d.hw = hw;
    return hw;
  }
  put(hw: HwNpc, id: string, n: number, from?: string) {
    const ex = hw.bag.find((b) => b.id === id && b.from === from);
    if (ex) ex.n += n; else hw.bag.push({ id, n, from });
  }
  take(hw: HwNpc, id: string, n: number): number {
    let left = n;
    for (const b of hw.bag) {
      if (b.id !== id) continue;
      const t = Math.min(b.n, left); b.n -= t; left -= t;
      if (left <= 0) break;
    }
    hw.bag = hw.bag.filter((b) => b.n > 0);
    return n - left;
  }
  bagValue(hw: HwNpc) { return hw.bag.reduce((s, b) => s + (itemDef(b.id)?.price ?? 0) * b.n, 0); }

  // ------------------------------------------------------------ 事件与统计
  ev(host: HwHost, kind: HwKind, text: string, ids: string[], opt: { cause?: number; big?: boolean } = {}): HwEvent {
    const e: HwEvent = { id: this.st.eid++, day: Math.floor(host.day), kind, text, ids, cause: opt.cause, big: opt.big };
    this.st.events.push(e);
    if (this.st.events.length > EV_CAP) this.st.events.splice(0, this.st.events.length - EV_CAP);
    if (opt.big) host.news(text, true);
    return e;
  }
  bump(k: string, n = 1) { this.st.stats[k] = (this.st.stats[k] ?? 0) + n; }
  byId(host: HwHost) { const m = new Map<string, HwPerson>(); for (const d of host.persons) m.set(d.id, d); return m; }

  power(d: HwPerson) {
    const hw = d.hw;
    const art = hw?.art ? artById(hw.art) : undefined;
    const arts = hw ? hw.bag.filter((b) => itemDef(b.id)?.type === 'artifact').length : 0;
    return lv(d) * 10 + (art ? art.tier * 6 : 0) + arts * 4 + (hw ? hw.health * 0.15 : 10);
  }

  // ------------------------------------------------------------ 每日推演
  daily(host: HwHost, days: number) {
    const steps = Math.max(1, Math.round(days));
    for (let s = 0; s < steps; s++) this.stepDay(host);
  }

  private stepDay(host: HwHost) {
    const rnd = host.rnd;
    const byId = this.byId(host);
    const alive = host.persons.filter((d) => d.alive);
    const byHome = new Map<string, HwPerson[]>();
    for (const d of alive) { const k = (d.map ?? '') + '|' + d.home; (byHome.get(k) ?? byHome.set(k, []).get(k)!).push(d); }
    // 求助过期
    for (const p of this.st.pleas) {
      if (p.status !== 'open') continue;
      const g = byId.get(p.giver);
      if (!g?.alive || host.day - p.day > 90) { p.status = 'gone'; p.result = g?.alive ? '事情不了了之' : `${g?.name ?? '求助之人'}已不在人世`; }
    }
    for (const d of alive) {
      if (d.canon && d.stay && rnd() < 0.5) continue;   // 坐镇一方的原著人物少掺和琐事
      const hw = this.ensure(d);
      hw.health = clamp(hw.health + 2, 0, 100);
      hw.mood = clamp(hw.mood + (hw.spouse ? 0.4 : 0) - (hw.feuds.length ? 0.3 : 0) + (rnd() - 0.5), 0, 100);
      const mates = (byHome.get((d.map ?? '') + '|' + d.home) ?? []).filter((o) => o !== d);
      // —— 仇怨优先：有仇不报非修士
      if (this.feudAct(host, d, hw, byId, rnd)) continue;
      const roll = rnd();
      if (d.realm === 0) {
        if (d.age < 16) { hw.act = '垂髫嬉戏'; this.childGrow(host, d, hw, byId, rnd); continue; }
        if (roll < 0.3) this.farmWork(host, d, hw, rnd);
        else if (roll < 0.5 && mates.length) this.social(host, d, hw, mates, byId, rnd);
        else if (roll < 0.6) this.familyAct(host, d, hw, mates, byId, rnd);
        continue;
      }
      if (roll < 0.34) this.cultivate(host, d, hw, rnd);
      else if (roll < 0.5) this.gather(host, d, hw, rnd);
      else if (roll < 0.62) this.market(host, d, hw, mates, byId, rnd);
      else if (roll < 0.8 && mates.length) this.social(host, d, hw, mates, byId, rnd);
      else if (roll < 0.9) this.familyAct(host, d, hw, mates, byId, rnd);
      else this.wander(host, d, hw, rnd);
      // 贪婪 / 狠辣之辈：踩点劫道（哪怕无仇）
      if ((d.pers === 'greedy' || d.pers === 'ruthless' || d.faction === 'demon') && rnd() < 0.05) this.prey(host, d, hw, mates, rnd);
    }
  }

  // —— 修行：功法熟练、丹药辅助、换功法
  private cultivate(host: HwHost, d: HwPerson, hw: HwNpc, rnd: () => number) {
    // 少年时入道、后来才觉醒灵根的，补上一门功法
    if (!hw.art && d.realm > 0) {
      const pool = ART_LIST.filter((a) => a.realm <= d.realm && a.cast !== 'sense');
      if (pool.length) hw.art = pool[Math.floor(rnd() * pool.length)].id;
    }
    const art = hw.art ? artById(hw.art) : undefined;
    hw.act = art ? `闭关修习《${art.name}》` : '打坐炼气';
    hw.artXp += 1 + (art ? art.tier * 0.4 : 0) + (d.pers === 'aloof' ? 0.6 : 0);
    const before = ART_LV(hw.artXp - 2);
    if (art && ART_LV(hw.artXp) !== before && ART_LV(hw.artXp) !== '初学') {
      this.bump('art');
      if (d.met || d.canon) this.ev(host, '修行', `${d.name}将《${art.name}》修至${ART_LV(hw.artXp)}，气息愈发凝练。`, [d.id], { big: !!d.canon });
    }
    // 丹药辅助
    if (hw.health < 55) {
      const pill = hw.bag.find((b) => itemDef(b.id)?.type === 'pill');
      if (pill) { this.take(hw, pill.id, 1); hw.health = clamp(hw.health + 35, 0, 100); hw.act = `服下${itemDef(pill.id).name}疗伤`; }
    }
    // 得了更高明的功法玉简，参悟换修
    if (rnd() < 0.05) {
      const scroll = hw.bag.find((b) => { const it = itemDef(b.id); if (it?.type !== 'scroll' || !it.scroll?.skill) return false; const a = artById(it.scroll.skill); return !!a && a.realm <= d.realm && (!art || a.tier > art.tier); });
      if (scroll) {
        const a = artById(itemDef(scroll.id).scroll!.skill!)!;
        this.take(hw, scroll.id, 1); hw.art = a.id; hw.artXp = Math.floor(hw.artXp * 0.3);
        this.bump('art');
        this.ev(host, '机缘', `${d.name}参悟玉简，改修《${a.name}》${scroll.from ? `（玉简得自${scroll.from}）` : ''}。`, [d.id], { big: !!d.met });
      }
    }
  }
  private gather(host: HwHost, d: HwPerson, hw: HwNpc, rnd: () => number) {
    const it = pickItem(rnd, 'herb', Math.min(4, d.realm + (rnd() < 0.15 ? 1 : 0)));
    if (!it) return;
    this.put(hw, it.id, 1);
    hw.act = `入山采药，得${it.name}`;
    if (it.tier >= 3) { this.bump('fortune'); this.ev(host, '机缘', `${d.name}在${host.homeName(d.home)}外的深山里采得一株${it.name}，喜不自胜。`, [d.id], { big: !!d.met }); }
  }
  private farmWork(_host: HwHost, d: HwPerson, hw: HwNpc, rnd: () => number) {
    d.wealth += 1 + Math.floor(rnd() * 3); hw.act = '操持生计';
  }
  // —— 坊市：卖货换灵石，或与邻人直接交易（物品真实流动）
  private market(host: HwHost, d: HwPerson, hw: HwNpc, mates: HwPerson[], _byId: Map<string, HwPerson>, rnd: () => number) {
    const herbs = hw.bag.filter((b) => { const t = itemDef(b.id)?.type; return t === 'herb' || t === 'material'; });
    const buyer = mates.find((o) => o.realm > 0 && o.wealth > 40 && o.pers !== 'aloof');
    if (herbs.length >= 2 && buyer && rnd() < 0.5) {
      const b = herbs[Math.floor(rnd() * herbs.length)];
      const it = itemDef(b.id); const price = Math.min(buyer.wealth, Math.max(2, Math.round(it.price * (0.8 + rnd() * 0.4))));
      const n = 1;
      this.take(hw, b.id, n); this.put(this.ensure(buyer), b.id, n, d.name);
      d.wealth += price; buyer.wealth -= price;
      hw.act = `在坊市把${it.name}卖给了${buyer.name}`;
      this.bump('trade');
      this.addRel(hw, buyer.id, 3); this.addRel(this.ensure(buyer), d.id, 3);
      if (d.met && buyer.met) this.ev(host, '坊市', `${d.name}在${host.homeName(d.home)}坊市将${it.name}售予${buyer.name}，得灵石${price}。`, [d.id, buyer.id]);
    } else if (herbs.length >= 3) {
      const b = herbs[0]; const it = itemDef(b.id); const n = Math.min(b.n, 2);
      this.take(hw, b.id, n); const gain = Math.max(2, Math.round(it.price * 0.7)) * n;
      d.wealth += gain; hw.act = `坊市售药，得灵石${gain}`; this.bump('trade');
    } else if (d.wealth > 60 && hw.health < 70) {
      const it = pickItem(rnd, 'pill', Math.min(4, d.realm));
      if (it && it.price < d.wealth * 0.5) { d.wealth -= it.price; this.put(hw, it.id, 1); hw.act = `购得${it.name}备用`; this.bump('trade'); }
    } else hw.act = '逛坊市，看行情';
  }
  // —— 社交：结识 / 投契 / 赠礼 / 口角
  private social(host: HwHost, d: HwPerson, hw: HwNpc, mates: HwPerson[], _byId: Map<string, HwPerson>, rnd: () => number) {
    const o = mates[Math.floor(rnd() * mates.length)];
    const ohw = this.ensure(o);
    const clash = (a: string) => a === 'arrogant' || a === 'ruthless';
    const warm = (a: string) => a === 'kind' || a === 'righteous';
    let dv = Math.floor(rnd() * 7) - 1;
    if (warm(d.pers) && warm(o.pers)) dv += 3;
    if (clash(d.pers) && clash(o.pers)) dv -= 6;
    if (d.faction === 'demon' !== (o.faction === 'demon')) dv -= 2;
    this.addRel(hw, o.id, dv); this.addRel(ohw, d.id, dv + Math.floor(rnd() * 3) - 1);
    const v = hw.rel[o.id] ?? 0;
    hw.act = dv >= 0 ? `与${o.name}烹茶论道` : `与${o.name}话不投机`;
    if (dv < 0 && v <= -30 && !hw.feuds.some((f) => f.id === o.id)) {
      const why = [`与${o.name}论道不合，当众争执`, `看不惯${o.name}的做派，出言相讥`, `与${o.name}争购一株灵药，结下梁子`][Math.floor(rnd() * 3)];
      const e = this.ev(host, '仇怨', `${d.name}${why}。`, [d.id, o.id]);
      hw.feuds.push({ id: o.id, why, day: Math.floor(host.day), lv: 1, cause: e.id });
      this.bump('feud');
    }
    if (v >= 40 && !(d.ties ?? []).some((t) => t.id === o.id)) {
      host.link(d, o, 'friend', '好友', '好友');
      if (d.met && o.met) this.ev(host, '结缘', `${d.name}与${o.name}意气相投，结为好友。`, [d.id, o.id], { big: true });
    }
    // 挚友赠礼：储物袋里的东西真的送出去
    if (v >= 60 && hw.bag.length > 1 && rnd() < 0.12 && (!hw.lastGift || host.day - hw.lastGift > 20)) {
      const b = hw.bag[Math.floor(rnd() * hw.bag.length)];
      const it = itemDef(b.id);
      this.take(hw, b.id, 1); this.put(ohw, b.id, 1, d.name);
      hw.lastGift = Math.floor(host.day);
      this.bump('gift');
      this.ev(host, '结缘', `${d.name}将${it.name}赠予挚友${o.name}，${o.name}感念于心。`, [d.id, o.id], { big: !!(d.met && o.met) });
    }
  }
  // —— 家事：姻缘 / 添丁 / 团聚
  private familyAct(host: HwHost, d: HwPerson, hw: HwNpc, mates: HwPerson[], byId: Map<string, HwPerson>, rnd: () => number) {
    if (hw.spouse) {
      const sp = byId.get(hw.spouse);
      if (sp?.alive) {
        hw.act = `与道侣${sp.name}同修`;
        this.addRel(hw, sp.id, 2);
        // 添丁
        const mother = d.sex === 'f' ? d : sp;
        const father = d.sex === 'f' ? sp : d;
        if (mother.sex === 'f' && mother.age > 17 && mother.age < Math.min(120, mother.life * 0.6) && hw.kids.length < 3 && rnd() < 0.012) {
          const sex = rnd() < 0.5 ? 'm' : 'f';
          const name = hwName(rnd, sex, surOf(father.name));
          const child = host.birth(mother, father, name, sex);
          if (child) {
            const chw = this.ensure(child);
            chw.parents = [mother.id, father.id];
            hw.kids.push(child.id); this.ensure(sp).kids.push(child.id);
            host.link(mother, child, 'kin', mother.sex === 'f' ? '子' : '女', '母');
            (child.ties![child.ties!.length - 1]).r = sex === 'm' ? '子' : '女';
            host.link(father, child, 'kin', sex === 'm' ? '子' : '女', '父');
            (child.ties![child.ties!.length - 1]).r = sex === 'm' ? '子' : '女';
            for (const kid of hw.kids) { const k = byId.get(kid) ?? host.persons.find((x) => x.id === kid); if (k && k !== child && k.alive) host.link(k, child, 'kin', sex === 'm' ? '弟' : '妹', k.sex === 'm' ? '兄' : '姐'); }
            this.bump('birth');
            this.ev(host, '家事', `${father.name}与${mother.name}喜得${sex === 'm' ? '贵子' : '千金'}，取名${name}。${host.homeName(d.home)}的邻里都来道贺。`, [father.id, mother.id, child.id], { big: !!(d.met || sp.met) });
          }
        }
        return;
      }
    }
    // 姻缘：两情相悦（好感是处出来的，不是配出来的）
    if (!hw.spouse && d.age > 17 && !d.beauty) {
      const cand = mates.filter((o) => o.sex !== d.sex && !o.hw?.spouse && !o.beauty && o.age > 16 && Math.abs(lv(o) - lv(d)) <= 14 && !(d.ties ?? []).some((t) => t.id === o.id && t.k === 'kin'));
      for (const o of cand) {
        const v = hw.rel[o.id] ?? 0;
        if (v >= 50 && (this.ensure(o).rel[d.id] ?? 0) >= 40 && rnd() < 0.1) {
          hw.spouse = o.id; this.ensure(o).spouse = d.id;
          host.link(d, o, 'lover', '道侣', '道侣');
          hw.mood = clamp(hw.mood + 20, 0, 100);
          this.bump('marriage');
          this.ev(host, '结缘', `${d.name}与${o.name}情投意合，在${host.homeName(d.home)}结为道侣，同道皆来观礼。`, [d.id, o.id], { big: !!(d.met || o.met || d.canon || o.canon) });
          return;
        }
      }
      // 有人主动示好
      if (cand.length && rnd() < 0.25) {
        const o = cand[Math.floor(rnd() * cand.length)];
        this.addRel(hw, o.id, 4 + Math.floor(rnd() * 4)); this.addRel(this.ensure(o), d.id, 2 + Math.floor(rnd() * 4));
        hw.act = `对${o.name}颇有好感，时常走动`;
        return;
      }
    }
    const kid = hw.kids.map((k) => byId.get(k)).find((k) => k?.alive);
    if (kid) { hw.act = `陪伴${kid.name}`; this.addRel(hw, kid.id, 3); return; }
    hw.act = '收拾洞府';
  }
  private childGrow(host: HwHost, d: HwPerson, hw: HwNpc, byId: Map<string, HwPerson>, rnd: () => number) {
    if (d.age >= 12 && d.realm === 0 && rnd() < 0.02) {
      const parents = hw.parents.map((p) => byId.get(p)).filter(Boolean) as HwPerson[];
      const cultivator = parents.some((p) => p.realm > 0);
      if (cultivator || rnd() < 0.2) {
        d.realm = 1; d.stage = 0; d.faction = parents.find((p) => p.sect)?.faction ?? 'rogue';
        this.ensure(d);
        this.ev(host, '修行', `${d.name}灵根初显，踏上修行之路${parents.length ? `，${parents[0].name}欣慰不已` : ''}。`, [d.id, ...hw.parents], { big: parents.some((p) => p.met) });
      }
    }
  }
  private wander(host: HwHost, d: HwPerson, hw: HwNpc, rnd: () => number) {
    hw.act = ['云游历练', '寻访故人', '入山猎妖', '闭关静思'][Math.floor(rnd() * 4)];
    if (hw.act === '入山猎妖' && rnd() < 0.3) { const it = pickItem(rnd, 'material', Math.min(4, d.realm)); if (it) { this.put(hw, it.id, 1); hw.act += `，得${it.name}`; } }
    if (!d.sect && d.faction === 'rogue' && host.joinSect && rnd() < 0.06) {
      const sid = host.joinSect(d);
      if (sid) { this.bump('sect'); this.ev(host, '宗门', `${d.name}通过考核，拜入${sid}，从此有了师门。`, [d.id], { big: !!d.met }); }
    }
  }

  // ------------------------------------------------------------ 恩怨与劫掠
  addRel(hw: HwNpc, id: string, dv: number) { hw.rel[id] = clamp((hw.rel[id] ?? 0) + dv, -100, 100); }
  private feudAct(host: HwHost, d: HwPerson, hw: HwNpc, byId: Map<string, HwPerson>, rnd: () => number): boolean {
    // 时间久了，小怨会淡（大仇不会）
    for (const f of [...hw.feuds]) {
      const o = byId.get(f.id);
      if (!o?.alive) { hw.feuds = hw.feuds.filter((x) => x !== f); continue; }
      if (f.lv === 1 && host.day - f.day > 240 && rnd() < 0.01) { hw.feuds = hw.feuds.filter((x) => x !== f); this.addRel(hw, f.id, 20); continue; }
      if ((o.map ?? '') !== (d.map ?? '')) continue;
      const eager = d.pers === 'ruthless' ? 1.7 : d.pers === 'arrogant' ? 1.3 : d.pers === 'kind' ? 0.4 : 1;
      const p = (f.lv >= 2 ? 0.05 : 0.016) * eager;
      if (rnd() >= p) continue;
      const gap = this.power(d) - this.power(o);
      if (gap < -14 && d.pers !== 'ruthless') continue;   // 打不过就忍着（记仇不等于送死）
      this.ambush(host, d, o, f.cause, f.lv >= 2 && (d.pers === 'ruthless' || d.faction === 'demon'), rnd, f.why);
      return true;
    }
    return false;
  }
  /** 无仇劫道：贪财之辈挑软柿子 */
  private prey(host: HwHost, d: HwPerson, hw: HwNpc, mates: HwPerson[], rnd: () => number) {
    const marks = mates.filter((o) => o.realm > 0 && o.id !== d.id && (o.wealth + this.bagValue(this.ensure(o))) > (d.wealth + this.bagValue(hw)) * 1.4 && this.power(d) - this.power(o) > -4 && !(d.ties ?? []).some((t) => t.id === o.id));
    if (!marks.length) return;
    const o = marks[Math.floor(rnd() * marks.length)];
    this.ambush(host, d, o, undefined, d.faction === 'demon' && rnd() < 0.4, rnd, `觊觎${o.name}的身家`);
  }
  /** 伏击：胜负由实力定，赃物真实入袋，仇恨与求助由此而生 */
  private ambush(host: HwHost, atk: HwPerson, def: HwPerson, cause: number | undefined, lethal: boolean, rnd: () => number, motive: string) {
    const ahw = this.ensure(atk), dhw = this.ensure(def);
    const win = this.power(atk) + rnd() * 30 > this.power(def) + rnd() * 30;
    const w = win ? atk : def, l = win ? def : atk;
    const whw = win ? ahw : dhw, lhw = win ? dhw : ahw;
    // 抢走最值钱的 1-2 件 + 三四成灵石
    const loot: HwItem[] = [];
    const sorted = [...lhw.bag].sort((a, b) => (itemDef(b.id)?.price ?? 0) * b.n - (itemDef(a.id)?.price ?? 0) * a.n);
    for (const b of sorted.slice(0, 1 + (rnd() < 0.5 ? 1 : 0))) {
      const n = Math.min(b.n, b.n > 1 ? 1 + Math.floor(rnd() * 2) : 1);
      this.take(lhw, b.id, n); this.put(whw, b.id, n, l.name);
      loot.push({ id: b.id, n });
    }
    const stones = Math.max(0, Math.round(l.wealth * (0.3 + rnd() * 0.3)));
    l.wealth -= stones; w.wealth += stones;
    lhw.health = clamp(lhw.health - (25 + Math.floor(rnd() * 35)), 0, 100);
    lhw.mood = clamp(lhw.mood - 25, 0, 100);
    const names = loot.map((b) => `${itemDef(b.id)?.name ?? b.id}×${b.n}`).join('、') || '些许财物';
    const dead = lhw.health <= 0 || (lethal && rnd() < 0.45);
    const e = this.ev(host, dead ? '仇杀' : '劫掠',
      dead
        ? `${w.name}伏击${l.name}（${motive}），${l.name}不敌身死，储物袋被洗劫一空（${names}、灵石${stones}）。`
        : `${l.name}在${host.homeName(l.home)}外被${w.name}拦路伏击（${motive}），储物袋被夺去${names}${stones ? `、灵石${stones}` : ''}，负伤遁走。`,
      [w.id, l.id], { cause, big: !!(l.met || w.met || l.canon || w.canon) });
    this.bump(dead ? 'kill' : 'rob');
    // 苦主记仇（有缘由、有因果）
    const why = dead ? '' : `被${w.name}劫去${names}`;
    if (!dead) {
      this.addRel(lhw, w.id, -50);
      const ex = lhw.feuds.find((f) => f.id === w.id);
      if (ex) { ex.lv = 2; ex.why = why; ex.day = Math.floor(host.day); ex.cause = e.id; }
      else lhw.feuds.push({ id: w.id, why, day: Math.floor(host.day), lv: win ? 2 : 1, cause: e.id });
      // 向你求助（只有跟你有关系的人才会开这个口）
      this.maybePlea(host, l, 'rob', w, loot, stones, e, rnd);
    } else {
      this.death(host, l, w, e.id);
      // 亲族衔恨，可能求你主持公道
      const kin = (l.ties ?? []).map((t) => this.byId(host).get(t.id)).find((o) => o?.alive && (o.hw?.rel[l.id] ?? 0) > -30);
      if (kin) this.maybePlea(host, kin, 'murder', w, loot, stones, e, rnd);
    }
  }

  // ------------------------------------------------------------ 死亡与传承
  /** 仇杀 / 劫杀：标记死亡 → 宿主做仇恨蔓延 → 遗产传承 */
  death(host: HwHost, d: HwPerson, killer?: HwPerson, cause?: number) {
    if (d.alive) { d.alive = false; (d as unknown as { deathNote?: string }).deathNote = killer ? `死于${killer.name}之手` : '身死道消'; }
    if (killer) { host.onKill(d, killer); this.bump('kill'); }
    this.inherit(host, d, killer, cause);
  }
  /** 遗产沿亲缘传承。宿主在自然死亡 / 玩家击杀处也调用（settled 防重复） */
  inherit(host: HwHost, d: HwPerson, killer?: HwPerson, cause?: number) {
    const hw = this.ensure(d);
    if (hw.settled) return;
    hw.settled = true;
    // 继承人：道侣 → 子嗣 → 亲族 → 徒儿
    const order = [hw.spouse, ...hw.kids, ...(d.ties ?? []).filter((t) => t.k === 'kin' || t.k === 'disciple').map((t) => t.id)];
    const m = this.byId(host);
    const heir = order.map((id) => (id ? m.get(id) : undefined)).find((o) => o?.alive && o !== killer);
    const goods = hw.bag.filter((b) => !(killer && b.from === d.name)); // 已被抢走的不再重复
    if (heir && (goods.length || d.wealth > 10)) {
      const hhw = this.ensure(heir);
      const stones = Math.round(d.wealth * 0.6);
      d.wealth -= stones; heir.wealth += stones;
      for (const b of goods) this.put(hhw, b.id, b.n, `${d.name}遗物`);
      const list = goods.slice(0, 3).map((b) => itemDef(b.id)?.name ?? b.id).join('、');
      hw.bag = [];
      this.bump('inherit');
      this.ev(host, '传承', `${d.name}的遗物（${list || '些许财物'}${stones ? `、灵石${stones}` : ''}）由${heir.name}继承。${heir.name}捧着储物袋，久久无言。`, [d.id, heir.id], { cause, big: !!(d.met || heir.met) });
    } else if (!killer && goods.length) {
      this.ev(host, '陨落', `${d.name}身后无亲，遗物散佚于${host.homeName(d.home)}。`, [d.id], { cause });
    }
    // 未亡人
    if (hw.spouse) { const sp = m.get(hw.spouse); if (sp?.hw) { sp.hw.spouse = undefined; sp.hw.mood = clamp(sp.hw.mood - 40, 0, 100); } }
  }

  // ------------------------------------------------------------ 求助（因果链的末端才轮到玩家）
  private maybePlea(host: HwHost, giver: HwPerson, kind: 'rob' | 'murder', target: HwPerson, items: HwItem[], stones: number, cause: HwEvent, rnd: () => number) {
    const S = this.st;
    if (host.day < S.pleaCd) return;
    if (S.pleas.filter((p) => p.status === 'open').length >= 2) return;
    const ghw = this.ensure(giver);
    if (ghw.lastPlea && host.day - ghw.lastPlea < 60) return;
    let reason = '';
    if (giver.bond === 'sworn') reason = '你我义结金兰，祸福与共';
    else if (giver.bond === 'master' || giver.bond === 'disciple') reason = '你我师徒一场';
    else if (giver.sect && giver.sect === host.playerSect) reason = `你我同出${host.homeName(giver.sect)}，同门有难，不敢相瞒`;
    else if (giver.met && giver.favor >= 25) reason = '相识一场，知你素来仗义';
    else if (giver.met && giver.favor >= 10 && giver.pers === 'righteous') reason = '数面之缘，斗胆相求';
    if (!reason) return;   // 与你无亲无故——人家的事人家自己了结，绝不凭空来烦你
    if (rnd() > (kind === 'murder' ? 0.85 : 0.55)) return;
    const p: HwPlea = {
      id: S.pid++, day: Math.floor(host.day), giver: giver.id, kind, target: target.id,
      items: items.map((b) => ({ ...b })), stones,
      why: kind === 'rob'
        ? `${giver.name}被${target.name}劫去${items.map((b) => `${itemDef(b.id)?.name}×${b.n}`).join('、')}${stones ? `与灵石${stones}` : ''}`
        : `${giver.name}的亲人死于${target.name}之手`,
      reason, cause: cause.id, status: 'open',
      trail: this.chain(cause.id).reverse().map((e) => ({ day: e.day, kind: e.kind, text: e.text })),
    };
    S.pleas.push(p);
    if (S.pleas.length > 24) S.pleas.splice(0, S.pleas.length - 24);
    S.pleaCd = host.day + 8;
    ghw.lastPlea = Math.floor(host.day);
    this.bump('plea');
    this.ev(host, '求助', `${giver.name}托传音符寻你（${reason}）：${p.why}。`, [giver.id, target.id], { cause: cause.id, big: true });
    host.onPlea(p, giver);
  }

  /** 玩家回应求助。fight：追讨得胜；return：夺回后归还；mediate：调停；pay：自掏腰包 */
  resolvePlea(host: HwHost, id: number, mode: 'fight' | 'return' | 'mediate' | 'pay', ctx: { won?: boolean; stones?: number; have?: HwItem[] } = {}): { ok: boolean; text: string } {
    const p = this.st.pleas.find((x) => x.id === id);
    if (!p || p.status !== 'open') return { ok: false, text: '此事已了。' };
    const m = this.byId(host);
    const giver = m.get(p.giver), target = m.get(p.target);
    if (!giver?.alive) { p.status = 'gone'; return { ok: false, text: '求助之人已不在人世。' } };
    const ghw = this.ensure(giver);
    const done = (text: string) => { p.status = 'done'; p.result = text; this.ev(host, '侠义', text, [p.giver, p.target], { cause: p.cause, big: true }); return { ok: true, text }; };
    const reward = () => {
      const stones = Math.max(0, Math.min(giver.wealth, Math.max(10, Math.round(giver.wealth * 0.15))));
      giver.wealth -= stones;
      const gift = ghw.bag.length > 1 ? ghw.bag[Math.floor(host.rnd() * ghw.bag.length)] : null;
      const items: HwItem[] = gift ? [{ id: gift.id, n: 1 }] : [];
      if (gift) this.take(ghw, gift.id, 1);
      host.givePlayer(items, stones);
      giver.favor = clamp(giver.favor + 18, -100, 100);
      return `灵石${stones}${items.length ? `、${itemDef(items[0].id)?.name}` : ''}`;
    };
    if (mode === 'fight') {
      if (!ctx.won) {
        giver.favor = clamp(giver.favor + 4, -100, 100);
        return { ok: false, text: `你不敌${target?.name ?? '仇家'}，负伤而退。${giver.name}叹道：「道友量力而行，莫要为我搭上性命。」` };
      }
      if (target?.alive) {
        const thw = this.ensure(target);
        const back: HwItem[] = [];
        for (const b of p.items) { const n = this.take(thw, b.id, b.n); if (n) { this.put(ghw, b.id, n); back.push({ id: b.id, n }); } }
        const st = Math.min(target.wealth, p.stones); target.wealth -= st; giver.wealth += st;
        target.grudge = Math.max(target.grudge ?? 0, 1); target.why = `你替${giver.name}强出头，夺回赃物`;
        this.addRel(thw, giver.id, -30);
        const rw = reward();
        return done(`你循迹追上了${target.name}，一场斗法夺回${back.map((b) => `${itemDef(b.id)?.name}×${b.n}`).join('、') || '赃物'}，物归原主。${giver.name}感激涕零，回赠${rw}。${target.name}却对你恨意暗生。`);
      }
      const rw = reward();
      return done(`${target?.name ?? '仇家'}已死于非命，赃物再难追索。${giver.name}默然良久：「天理昭昭……多谢道友奔走。」回赠${rw}。`);
    }
    if (mode === 'return') {
      const have = ctx.have ?? [];
      const need = p.items.filter((b) => !have.some((h) => h.id === b.id && h.n >= b.n));
      if (need.length) return { ok: false, text: `尚缺${need.map((b) => itemDef(b.id)?.name).join('、')}，凑齐再来。` };
      if (!host.takePlayer(p.items, 0)) return { ok: false, text: '你身上并无这些物件。' };
      for (const b of p.items) this.put(ghw, b.id, b.n);
      const rw = reward();
      return done(`你将夺回的${p.items.map((b) => itemDef(b.id)?.name).join('、')}交还${giver.name}。${pron(giver)}捧着失而复得之物，眼眶泛红，回赠${rw}。`);
    }
    if (mode === 'mediate') {
      if (!target?.alive) return { ok: false, text: '当事人已死，无从调停。' };
      const thw = this.ensure(target);
      const k: Record<string, number> = { righteous: 0.75, kind: 0.85, cautious: 0.6, aloof: 0.5, greedy: 0.55, arrogant: 0.35, ruthless: 0.2 };
      if (host.rnd() < (k[target.pers] ?? 0.5) + clamp(giver.favor, 0, 60) / 300) {
        const b = p.items[0];
        if (b) { const n = this.take(thw, b.id, Math.ceil(b.n / 2)); if (n) this.put(ghw, b.id, n); }
        const st = Math.min(target.wealth, Math.round(p.stones / 2)); target.wealth -= st; giver.wealth += st;
        thw.feuds = thw.feuds.filter((f) => f.id !== giver.id);
        ghw.feuds = ghw.feuds.map((f) => (f.id === target.id ? { ...f, lv: 1 as const } : f));
        giver.favor = clamp(giver.favor + 10, -100, 100);
        return done(`你居中调停，摆事实讲利害。${target.name}自知理亏，归还半数财物，双方就此揭过。${giver.name}谢你周全（好感 +10）。`);
      }
      this.addRel(thw, giver.id, -10);
      return { ok: false, text: `${target.name}冷笑拂袖：「凭你也配说和？」调停失败，${pron(target)}反倒记了你一笔。` };
    }
    // pay
    const need = p.stones + p.items.reduce((s, b) => s + (itemDef(b.id)?.price ?? 0) * b.n, 0);
    const cost = Math.max(20, Math.round(need * 0.8));
    if ((ctx.stones ?? 0) < cost) return { ok: false, text: `需灵石${cost}方能补上这份亏空。` };
    if (!host.takePlayer([], cost)) return { ok: false, text: '灵石不足。' };
    giver.wealth += cost;
    giver.favor = clamp(giver.favor + 12, -100, 100);
    return done(`你自掏腰包（灵石${cost}）补上了${giver.name}的亏空。${pron(giver)}再三推辞不过，收下了：「这份情，我记下了。」（好感 +12；${target?.name ?? '仇家'}仍逍遥法外）`);
  }

  // ------------------------------------------------------------ 人物志（对话 / 面板共用）
  profile(d: HwPerson, host: { homeName(id: string): string; persons: HwPerson[] }) {
    const hw = this.ensure(d);
    const m = new Map(host.persons.map((x) => [x.id, x] as const));
    const art = hw.art ? artById(hw.art) : undefined;
    const nm = (id?: string) => (id ? m.get(id)?.name ?? '故去之人' : '');
    return {
      act: hw.act, health: Math.round(hw.health), mood: Math.round(hw.mood),
      art: art ? `《${art.name}》（${'凡黄玄地天'[art.tier]}阶 · ${ART_LV(hw.artXp)}）` : '未习功法',
      bag: hw.bag.map((b) => ({ name: itemDef(b.id)?.name ?? b.id, n: b.n, from: b.from, type: itemDef(b.id)?.type ?? 'misc', tier: itemDef(b.id)?.tier ?? 0 })),
      wealth: d.wealth,
      spouse: hw.spouse ? nm(hw.spouse) : '',
      kids: hw.kids.map(nm).filter(Boolean),
      parents: hw.parents.map(nm).filter(Boolean),
      friends: Object.entries(hw.rel).filter(([, v]) => v >= 40).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ name: nm(id), v, alive: m.get(id)?.alive ?? false })).filter((x) => x.name),
      feuds: hw.feuds.map((f) => ({ name: nm(f.id), why: f.why, lv: f.lv, day: f.day, cause: f.cause, alive: m.get(f.id)?.alive ?? false })),
    };
  }
  /** 此人最近的事件（生平） */
  deeds(id: string, cap = 12) { return this.st.events.filter((e) => e.ids.includes(id)).slice(-cap).reverse(); }
  pleaOf(giverId: string) { return this.st.pleas.find((p) => p.giver === giverId && p.status === 'open') ?? null; }
  eventById(id?: number) { return id ? this.st.events.find((e) => e.id === id) ?? null : null; }
  /** 因果链：从果溯因 */
  chain(id?: number, cap = 6): HwEvent[] {
    const out: HwEvent[] = [];
    let e = this.eventById(id);
    while (e && out.length < cap) { out.push(e); e = this.eventById(e.cause); }
    return out;
  }
}