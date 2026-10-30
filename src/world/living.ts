// 第五十步：活世界（代号：活世界）
// ---------------------------------------------------------------------------
// 以前的“人”是围着玩家转的道具：站在原地等你搭话，或者莫名其妙扑上来抢你。
// 活世界要解决的就是这件事 —— 每个人都有自己的一天要过：
//   · 储物袋：自己的家当（灵石、丹药、法器、灵草），会买、会用、会传给别人
//   · 功  法：主修功法 + 神通，天天练，熟练度会涨，会突破，会影响战力
//   · 门  派：身份、辈分、贡献、师父徒弟、每月的俸禄与宗门差事
//   · 家  庭：父母、道侣、子女、兄弟姐妹、家族；会成亲、会生子、会守孝、会继承
//   · 社  交：朋友、熟人、亲密度；消息（八卦）会沿着人际网一天天传开
//   · 仇  恨：不是一个小数字，而是“谁、为什么、哪天结的、报没报”；血仇会传给家人
//   · 日  程：每天都有件正经事在做（修炼/做工/赶集/探亲/寻仇/闭关/疗伤/求亲）
// 最重要的规矩：没有人会平白无故来找你。凡是找上门的，都有一个说得出口的理由，
// 并且会把理由说给你听（motive()）。没有理由，他们就当你是个路人。
// ---------------------------------------------------------------------------
import { ITEM_LIST, itemDef } from '../data/items';
import { ART_LIST } from '../data/arts';
import { realmName } from '../data/realms';
import { LOC_BY_ID, locsOf, WORLD_SCALE, ACTIVE_MAP } from '../data/world';
import { mulberry32 } from '../core/rng';
import type { Game } from './game';
import type { NpcData, Pers, Faction } from './npc';
import type { DNode, DOpt, ShopStock } from './modal';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[], r: () => number = Math.random): T => a[Math.floor(r() * a.length) % a.length];
const ri = (a: number, b: number, r: () => number = Math.random) => a + Math.floor(r() * (b - a + 1));
const chance = (p: number, r: () => number = Math.random) => r() < p;

// ---------------------------------------------------------------- 名词表
export type AgendaKind =
  | 'cultivate' | 'work' | 'sectJob' | 'trade' | 'visitKin' | 'meetPal'
  | 'seekRevenge' | 'travel' | 'seclude' | 'mourn' | 'heal' | 'court' | 'guardHome';
export const AGENDA_NAME: Record<AgendaKind, string> = {
  cultivate: '打坐修炼', work: '做工谋生', sectJob: '宗门差事', trade: '赶集交易',
  visitKin: '探亲', meetPal: '会友论道', seekRevenge: '寻仇', travel: '游历',
  seclude: '闭关', mourn: '守孝', heal: '疗伤', court: '提亲', guardHome: '守着家',
};

export interface BagItem { id: string; n: number; day?: number }
/** 功法：main 为主修功法（决定资质与修炼速度），其余为神通术法 */
export interface NpcArt {
  name: string; school: string; tier: number; prof: number; main?: boolean;
  artId?: string; uses: number; from?: string;
}
export type GrudgeKind = 'kill' | 'blood' | 'rob' | 'insult' | 'betray' | 'sect' | 'love' | 'debt' | 'spared';
export interface Grudge {
  t: string; name: string; kind: GrudgeKind; why: string; sev: number; day: number;
  acted?: number; dead?: boolean;
}
export type KinRole = 'father' | 'mother' | 'spouse' | 'child' | 'sibling' | 'clan';
export const KIN_WORD: Record<KinRole, string> = {
  father: '父亲', mother: '母亲', spouse: '道侣', child: '子女', sibling: '手足', clan: '族人',
};
export interface Kin { t: string; name: string; r: KinRole; day?: number; dead?: boolean }
export interface Pal { t: string; name: string; in: number; day: number; last?: number }
export interface Rumor { about: string; text: string; day: number; val: number; from?: string }
export interface Memo { day: number; text: string }
export interface SectTie {
  id: string; name: string; rank: number; contrib: number; joined: number;
  master?: string; masterName?: string; disciples: string[];
  job?: { k: string; label: string; until: number; pay: number };
  salary: number; duty: string;
}
export interface Clan { name: string; home: string; stand: number; motto: string }
export interface Agenda { k: AgendaKind; why: string; until: number; loc?: string; with?: string; line?: string }

export interface LivingCore {
  v: 1;
  bag: BagItem[]; stones: number; cap: number;
  arts: NpcArt[]; talent: number;
  sect?: SectTie; clan?: Clan;
  kin: Kin[]; pal: Pal[]; foe: Grudge[];
  rep: number; mood: number; hp: number;
  agenda?: Agenda; nextAgenda: number;
  mem: Memo[]; rumors: Rumor[];
  busy: string; lastSaid: number;
  need?: { text: string; item?: string; amount: number; until: number };
  courting?: string;
  kills: number; robbed: number; helped: number;
  drop?: boolean;
}

export interface Motive { kind: string; why: string; line: string; heat: number }

export const SECT_RANK = ['记名弟子', '外门弟子', '内门弟子', '亲传弟子', '执事', '长老', '掌门'];
export const SECT_JOB = ['采药', '巡山', '护送商队', '斩妖', '押送灵石', '看守药园', '外门授业', '打探消息'];
const CLAN_MOTTO = ['耕读传家', '诗礼继世', '勤俭立业', '忠厚传世', '习武防身', '经商致富', '修仙光宗', '积德行善'];
const ART_HEAD: Record<string, string[]> = {
  火: ['赤炎', '离火', '九阳', '焚天', '朱雀'], 冰: ['玄冰', '寒魄', '冰心', '北冥'],
  雷: ['紫霄', '神雷', '九天', '雷元'], 风: ['清风', '御风', '天罡', '流云'],
  土: ['厚土', '玄黄', '戊己', '不动'], 木: ['青木', '乙木', '长春', '灵苗'],
  剑: ['青莲', '太乙', '无极', '七星', '养剑'], 体: ['金刚', '罗汉', '不坏', '铁布'],
  御: ['御兽', '驯灵', '百兽'], 魔: ['血煞', '天魔', '九幽', '噬魂'],
  识: ['炼神', '大衍', '天罗', '凝神'], 阵: ['九宫', '八卦', '周天', '河图'],
  身: ['凌波', '缩地', '踏云', '游龙'], 符: ['云篆', '神符', '玉枢'],
};
const ART_TAIL = ['诀', '经', '典', '功', '真解', '宝录', '玄章', '心法', '秘术'];
const SCHOOL_OF_SECT: Record<string, string> = {
  huangfeng: '木', yanyue: '冰', lingshou: '御', qingxu: '识', huadao: '剑', tianque: '阵', jujian: '剑',
  luoyun: '风', gujian: '剑', baiqiao: '土', guiling: '魔', hehuan: '识', yuling: '魔', qianhuan: '识',
  tiansha: '魔', yinluo: '魔', tianmo: '魔', taiyi: '火', huayi: '符', qianzhu: '木', tianlan: '雷', miaoyin: '识', qixuan: '体',
};
const NEED_FOR = [
  { text: '老母病重，缺一株百年灵芝', item: 'herb_lingzhi', amount: 1 },
  { text: '欠了坊市一屁股债，月底要还', amount: 300 },
  { text: '功法到了瓶颈，缺灵石换丹药', amount: 200 },
  { text: '道侣重伤，急需疗伤丹药', amount: 250 },
  { text: '宗门差事交不上，要挨罚', amount: 150 },
  { text: '家里娃要拜师，束脩还没凑齐', amount: 120 },
];

// ---------------------------------------------------------------- 活世界
export class LivingWorld {
  game: Game;
  /** 世界大事记（活世界编年史） */
  chron: { day: number; text: string; kind: 'good' | 'bad' | 'info' }[] = [];
  stats = { born: 0, died: 0, wed: 0, duel: 0, revenge: 0, trade: 0, break: 0, feud: 0, rumor: 0, job: 0 };
  private dayMark = -1;
  private bubbleT = 0;
  private newsBudget = 0;

  constructor(game: Game) { this.game = game; }

  // ------------------------------------------------------------ 存取
  /** 懒挂载：老存档里的人没有活世界数据，第一次用到时补上 */
  of(d: NpcData): LivingCore {
    if (!d.live) d.live = this.attach(d, mulberry32((d.seed || 1) >>> 0));
    return d.live!;
  }
  has(d: NpcData) { return !!d.live; }
  npcs(): NpcData[] { return (this.game.npcs?.list ?? []) as NpcData[]; }
  byId(id: string): NpcData | undefined { return id === 'player' ? undefined : this.game.npcs?.byId.get(id); }
  nameOf(id: string): string { return id === 'player' ? '你' : this.byId(id)?.name ?? '故人'; }

  log(text: string, kind: 'good' | 'bad' | 'info' = 'info') {
    this.chron.push({ day: Math.floor(this.game.day), text, kind });
    if (this.chron.length > 400) this.chron.splice(0, this.chron.length - 400);
  }
  /** 只在当天预算内推送江湖传闻，避免刷屏 */
  say(text: string, kind: 'canon' | 'rumor' | 'personal' = 'rumor') {
    if (this.newsBudget <= 0) return false;
    this.newsBudget--; this.game.news(text, kind); return true;
  }

  // ------------------------------------------------------------ 生成一个人的一生
  private artName(school: string, tier: number, r: () => number) {
    const head = ART_HEAD[school] ?? ART_HEAD['木'];
    return pick(head, r) + pick(ART_TAIL.slice(0, tier >= 3 ? ART_TAIL.length : 5), r);
  }

  attach(d: NpcData, r: () => number = Math.random): LivingCore {
    const sectId = d.sect ?? (LOC_BY_ID.get(d.home)?.type === 'sect' ? d.home : undefined);
    const school = sectId ? (SCHOOL_OF_SECT[sectId] ?? '木') : pick(['火', '冰', '雷', '风', '土', '木', '剑', '体', '识', '身'], r);
    const sectName = sectId ? (LOC_BY_ID.get(sectId)?.name ?? '宗门') : '';
    const tier = clamp(Math.floor(d.realm * 0.9 + (d.canon ? 1 : 0) + (sectId ? 0.6 : 0)), 0, 4);
    const arts: NpcArt[] = [{
      name: sectName && d.faction !== 'rogue' ? `${sectName}·${this.artName(school, tier, r)}` : this.artName(school, tier, r),
      school, tier, prof: clamp(ri(10, 220, r) + d.stage * 40, 0, 400), main: true, uses: 0,
      from: d.faction === 'sect' || d.faction === 'demon' ? `${sectName}藏经阁` : pick(['家传残卷', '师父口授', '洞府遗刻', '坊市淘来的旧玉简', '前辈赠予'], r),
    }];
    const pool = ART_LIST.filter((a) => a.realm <= Math.max(1, d.realm) && (a.school === school || chance(0.3, r)));
    const nArts = d.realm === 0 ? 0 : ri(1, Math.min(3, 1 + d.realm), r);
    for (let i = 0; i < nArts && pool.length; i++) {
      const a = pick(pool, r);
      if (arts.some((x) => x.artId === a.id)) continue;
      arts.push({ name: a.name, school: a.school, tier: a.tier, prof: ri(5, 120, r), artId: a.id, uses: ri(0, 40, r), from: pick(['藏经阁', '前辈所授', '自己参悟', '夺来的玉简'], r) });
    }
    const cap = 12 + d.realm * 14 + (d.faction === 'merchant' ? 30 : 0);
    const bag: BagItem[] = [];
    const goods = ITEM_LIST.filter((it) => it.tier <= Math.max(1, d.realm + (d.faction === 'merchant' ? 1 : 0)) && it.type !== 'misc');
    const nGoods = d.faction === 'mortal' ? ri(0, 2, r) : d.faction === 'merchant' ? ri(5, 9, r) : ri(1, 5, r);
    for (let i = 0; i < nGoods && goods.length; i++) {
      const it = pick(goods, r);
      if (bag.some((b) => b.id === it.id)) continue;
      bag.push({ id: it.id, n: it.type === 'artifact' || it.type === 'scroll' ? 1 : ri(1, 3, r), day: Math.floor(this.game?.day ?? 0) });
    }
    const stones = Math.max(0, Math.round(d.wealth ?? 0));
    let sect: SectTie | undefined;
    // 凡人与刚出生的孩子不入宗门名册
    if (sectId && d.realm > 0 && d.faction !== 'mortal') {
      const rank = clamp(d.canon ? (d.title?.includes('掌门') ? 6 : d.role === 'elder' ? 5 : 3) : Math.floor(d.realm * 1.2) + (d.age > 200 ? 1 : 0), 0, 6);
      sect = {
        id: sectId, name: sectName, rank, contrib: ri(0, 120, r) + rank * 60, joined: Math.max(1, Math.round(d.age * 0.6)),
        disciples: [], salary: 5 + rank * rank * 6, duty: rank >= 5 ? '坐镇一方' : rank >= 4 ? '料理门中事务' : rank >= 3 ? '带新弟子' : '听差办事',
      };
    }
    const compound = d.name.length > 2 && '欧阳慕容上官司马'.includes(d.name.slice(0, 2));
    const surname = d.name.slice(0, compound ? 2 : 1);
    const clan: Clan | undefined = d.faction === 'mortal' || chance(0.45, r)
      ? { name: `${surname}家`, home: d.home, stand: ri(10, 90, r), motto: pick(CLAN_MOTTO, r) } : undefined;
    const L: LivingCore = {
      v: 1, bag, stones, cap, arts, talent: +(0.5 + r() * 1.5).toFixed(2), sect, clan,
      kin: [], pal: [], foe: [], rep: ri(-20, 40, r) + (d.faction === 'demon' ? -30 : 0),
      mood: ri(40, 90, r), hp: 1, nextAgenda: 0, mem: [], rumors: [],
      busy: '', lastSaid: -99, kills: 0, robbed: 0, helped: 0,
    };
    d.live = L;
    this.seedKin(d, r);
    this.seedPals(d, r);
    if ((d.grudge ?? 0) > 0 || d.why) this.addFoe(d, 'player', '你', (d.grudge ?? 0) >= 2 ? 'kill' : 'insult', d.why ?? '旧怨', (d.grudge ?? 1) * 30, Math.floor(this.game?.day ?? 0) - ri(10, 400, r));
    if (chance(0.18, r)) this.giveNeed(d, r);
    this.planDay(d, r);
    return L;
  }

  private seedKin(d: NpcData, r: () => number) {
    const L = d.live!;
    const mk = (role: KinRole, sex: 'm' | 'f', dead?: boolean) => {
      const nm = this.kinName(d, sex, role, r);
      const id = 'k_' + d.id + '_' + role + '_' + Math.floor(r() * 1e6);
      L.kin.push({ t: id, name: nm, r: role, dead, day: dead ? Math.floor(this.game.day) - ri(200, 3000, r) : undefined });
    };
    if (d.faction === 'mortal' || chance(0.7, r)) {
      const old = d.age > 60;
      mk('father', 'm', old || chance(0.55, r));
      mk('mother', 'f', old || chance(0.45, r));
    }
    if (chance(0.5, r)) mk('sibling', chance(0.5, r) ? 'f' : 'm', chance(0.15, r));
    if (d.age > (d.faction === 'mortal' ? 20 : 60) && chance(0.4, r)) {
      mk('spouse', d.sex === 'm' ? 'f' : 'm', chance(0.2, r));
      const kids = ri(1, d.faction === 'mortal' ? 3 : 2, r);
      for (let i = 0; i < kids; i++) mk('child', chance(0.5, r) ? 'f' : 'm', chance(0.08, r));
    }
    if (L.clan && chance(0.6, r)) for (let i = 0; i < ri(1, 3, r); i++) L.kin.push({ t: 'c_' + d.id + '_' + i, name: L.clan.name.replace('家', '') + this.tail(r), r: 'clan', dead: chance(0.2, r) });
  }
  private tail(r: () => number) { return pick(['二', '三', '四', '五', '六', '七'], r) + pick(['叔', '伯', '姑', '婶', '爷', '娘'], r); }
  private kinName(d: NpcData, sex: 'm' | 'f', role: KinRole, r: () => number) {
    const sur = role === 'spouse' && d.sex === 'm' ? pick('王李张刘陈杨赵黄周吴'.split(''), r) : d.name.slice(0, 1);
    const g = sex === 'f' ? ['秀', '兰', '娟', '娘', '云', '珍', '英', '芳'] : ['山', '河', '牛', '铁', '文', '武', '柱', '海'];
    return sur + pick(g, r) + (chance(0.4, r) ? pick(g, r) : '');
  }
  private seedPals(d: NpcData, r: () => number) {
    const L = d.live!;
    const mates = this.npcs().filter((o) => o !== d && o.alive && !o.canon && (o.home === d.home || (!!o.sect && o.sect === d.sect)) && Math.abs(o.age - d.age) < (d.faction === 'mortal' ? 25 : 200));
    const n = Math.min(mates.length, ri(1, d.pers === 'aloof' ? 1 : d.pers === 'kind' ? 5 : 3, r));
    for (let i = 0; i < n; i++) {
      const o = mates[Math.floor(r() * mates.length)];
      if (L.pal.some((p) => p.t === o.id)) continue;
      L.pal.push({ t: o.id, name: o.name, in: ri(10, 70, r), day: Math.floor(this.game.day), last: Math.floor(this.game.day) - ri(1, 60, r) });
    }
  }

  /** 关系网建好之后：把 ties 变成真正的家人、朋友、师父、仇人 */
  buildAll(r: () => number = Math.random) {
    const list = this.npcs();
    for (const d of list) {
      const L = this.of(d);
      for (const t of d.ties ?? []) {
        const o = this.byId(t.id); if (!o) continue;
        const OL = this.of(o);
        if (t.k === 'master' && L.sect) { L.sect.master = o.id; L.sect.masterName = o.name; }
        if (t.k === 'disciple' && L.sect && !L.sect.disciples.includes(o.id)) L.sect.disciples.push(o.id);
        if (t.k === 'kin') {
          const role: KinRole = /父/.test(t.r) ? 'father' : /母/.test(t.r) ? 'mother' : /子女|儿|女/.test(t.r) ? 'child' : /道侣|妻|夫/.test(t.r) ? 'spouse' : 'sibling';
          if (!L.kin.some((k) => k.t === o.id)) L.kin.push({ t: o.id, name: o.name, r: role, dead: !o.alive });
          if (!OL.kin.some((k) => k.t === d.id)) {
            const back: KinRole = role === 'father' || role === 'mother' ? 'child' : role === 'child' ? (d.sex === 'm' ? 'father' : 'mother') : role;
            OL.kin.push({ t: d.id, name: d.name, r: back, dead: !d.alive });
          }
        }
        if (t.k === 'friend' || t.k === 'sworn') {
          const v = t.k === 'sworn' ? 85 : ri(30, 70, r);
          if (!L.pal.some((p) => p.t === o.id)) L.pal.push({ t: o.id, name: o.name, in: v, day: Math.floor(this.game.day) });
          if (!OL.pal.some((p) => p.t === d.id)) OL.pal.push({ t: d.id, name: d.name, in: v, day: Math.floor(this.game.day) });
        }
        if (t.k === 'foe') {
          this.addFoe(d, o.id, o.name, 'insult', t.r || '旧怨', ri(20, 60, r), Math.floor(this.game.day) - ri(30, 900, r));
          this.addFoe(o, d.id, d.name, 'insult', t.r || '旧怨', ri(10, 40, r), Math.floor(this.game.day) - ri(30, 900, r));
        }
        if (t.k === 'lover') L.courting = o.id;
      }
      if (L.sect && !L.sect.job && d.faction !== 'mortal') this.assignJob(d, r);
    }
    this.log(`活世界开始运转：${list.filter((n) => n.alive).length} 人，各有家小、功法、储物袋与心思。`, 'info');
  }

  // ------------------------------------------------------------ 仇恨
  addFoe(d: NpcData, t: string, name: string, kind: GrudgeKind, why: string, sev: number, day = Math.floor(this.game.day)) {
    const L = this.of(d);
    const g = L.foe.find((x) => x.t === t && !x.dead);
    if (g) { g.sev = clamp(g.sev + sev * 0.6, 0, 200); g.why = why; if (kind === 'blood' || kind === 'kill') g.kind = kind; return g; }
    const ng: Grudge = { t, name, kind, why, sev: clamp(sev, 0, 200), day };
    L.foe.push(ng);
    if (L.foe.length > 8) { L.foe.sort((a, b) => b.sev - a.sev); L.foe.length = 8; }
    return ng;
  }
  foeOf(d: NpcData, t: string) { return this.of(d).foe.find((x) => x.t === t && !x.dead); }
  worstFoe(d: NpcData) { const L = this.of(d); return L.foe.filter((f) => !f.dead).sort((a, b) => b.sev - a.sev)[0]; }

  /** 血仇：亲人被杀，仇恨传到活着的人身上（这是世界记住事情的方式） */
  private bloodFeud(victim: NpcData, killerId: string, killerName: string) {
    const L = this.of(victim);
    let n = 0;
    for (const k of L.kin) {
      if (k.dead) continue;
      const o = this.byId(k.t); if (!o || !o.alive) continue;
      const rel = KIN_WORD[k.r] ?? '亲人';
      const close = k.r === 'spouse' || k.r === 'child' || k.r === 'father' || k.r === 'mother';
      const hot = o.pers === 'ruthless' || o.pers === 'righteous' || o.pers === 'arrogant';
      if (!close && !hot && !chance(0.4)) continue;   // 杀父之仇不共戴天；远亲则看性子
      this.addFoe(o, killerId, killerName, 'blood', `${victim.name}（${rel}）被${killerName}所杀`, ri(60, 100));
      const OL = this.of(o);
      OL.mem.push({ day: Math.floor(this.game.day), text: `${rel}${victim.name}死于${killerName}之手` });
      OL.mood = clamp(OL.mood - 40, 0, 100);
      if (killerId === 'player') { o.grudge = Math.max(o.grudge ?? 0, 2); o.why = `为${rel}${victim.name}报仇`; }
      n++;
    }
    if (L.sect) for (const d of this.npcs()) {
      if (d === victim || !d.alive || d.live?.sect?.id !== L.sect.id) continue;
      if (!chance(0.12)) continue;
      this.addFoe(d, killerId, killerName, 'sect', `同门${victim.name}被${killerName}所杀`, ri(20, 45));
      if (killerId === 'player') { d.grudge = Math.max(d.grudge ?? 0, 1); d.why = d.why ?? `为同门${victim.name}讨个公道`; }
    }
    if (n) { this.stats.feud++; this.log(`${victim.name}一死，${n} 位亲人记下了这笔血仇（对象：${killerName}）。`, 'bad'); }
  }

  // ------------------------------------------------------------ 生死
  /** 有人死了：家人守孝、遗产归子、门派空出一个位置、消息开始传 */
  onDeath(d: NpcData, why: string, killerId?: string) {
    const L = this.of(d);
    L.drop = true;
    this.stats.died++;
    // 先记下血仇，再报丧 —— 否则亲人已被标成“故人”，这笔仇就传不下去了
    if (killerId) this.bloodFeud(d, killerId, killerId === 'player' ? '你' : this.nameOf(killerId));
    for (const k of L.kin) {
      const o = this.byId(k.t);
      if (o?.alive) { const mine = this.of(o).kin.find((x) => x.t === d.id); if (mine) mine.dead = true; }
      if (!o || !o.alive) continue;
      const OL = this.of(o);
      OL.mood = clamp(OL.mood - ri(25, 55), 0, 100);
      OL.mem.push({ day: Math.floor(this.game.day), text: `${KIN_WORD[k.r]}${d.name}${why}` });
      if (k.r === 'spouse' || k.r === 'child' || k.r === 'father' || k.r === 'mother')
        OL.agenda = { k: 'mourn', why: `${d.name}走了，得守几日`, until: this.game.day + ri(3, 20), line: `（${d.name}的灵位前，${o.name}上了三炷香）` };
      if (k.r === 'child' || k.r === 'spouse') {
        const share = L.stones > 0 && chance(0.6) ? Math.round(L.stones * (k.r === 'spouse' ? 0.5 : 0.3)) : 0;
        if (share) OL.stones += share;
        const heirloom = L.bag.filter((b) => itemDef(b.id).tier >= 3)[0];
        if (heirloom && chance(0.5)) { OL.bag.push({ id: heirloom.id, n: 1, day: Math.floor(this.game.day) }); this.say(`${d.name}留下的${itemDef(heirloom.id).name}，传给了${o.name}。`); }
      }
    }
    for (const p of L.pal) { const o = this.byId(p.t); if (o?.alive) { const OL = this.of(o); OL.mood = clamp(OL.mood - 15, 0, 100); OL.mem.push({ day: Math.floor(this.game.day), text: `友人${d.name}${why}` }); } }
    for (const f of L.foe) {
      f.dead = true;
      const o = this.byId(f.t); if (!o || !o.alive) continue;
      const OL = this.of(o);
      OL.mem.push({ day: Math.floor(this.game.day), text: `仇人${d.name}${why}——这笔账没了` });
      OL.mood = clamp(OL.mood + (f.sev > 60 ? 20 : 8), 0, 100);
    }
    if (L.sect) {
      if (L.sect.master) { const m = this.byId(L.sect.master); if (m?.alive) { const ML = this.of(m); ML.mem.push({ day: Math.floor(this.game.day), text: `弟子${d.name}${why}` }); ML.mood = clamp(ML.mood - 20, 0, 100); } }
      for (const id of L.sect.disciples) { const s = this.byId(id); if (s?.alive) this.of(s).mem.push({ day: Math.floor(this.game.day), text: `师父${d.name}${why}` }); }
      for (const o of this.npcs()) {
        if (o.alive && o !== d && o.live?.sect?.id === L.sect.id && o.live.sect.master === d.id) { o.live.sect.master = undefined; o.live.sect.masterName = undefined; }
      }
      if (L.sect.rank >= 4) this.say(`${L.sect.name}${SECT_RANK[L.sect.rank]}${d.name}${why}，门中为之震动。`, 'canon');
    }
    this.spread(d, { about: d.id, text: `${d.name}（${realmName(d.realm, d.stage)}）${why}`, day: Math.floor(this.game.day), val: -1 });
    if (L.foe.some((f) => f.t === 'player')) this.log(`${d.name}${why}。他到死都记恨着你。`, 'bad');
  }

  /** 谁杀的 → 记在凶手账上 */
  onKill(killer: NpcData | 'player', victim: NpcData, why: string) {
    if (killer !== 'player') {
      const KL = this.of(killer);
      KL.kills++; KL.rep = clamp(KL.rep - 12, -100, 100);
      KL.mem.push({ day: Math.floor(this.game.day), text: `杀了${victim.name}` });
      KL.mood = clamp(KL.mood + (KL.rep < 0 ? 10 : -12), 0, 100);
      const VL = this.of(victim);
      const take = Math.round(VL.stones * 0.7); KL.stones += take; VL.stones -= take;
      const lootItem = VL.bag.filter((b) => itemDef(b.id).tier >= 2)[0];
      if (lootItem && chance(0.7)) { KL.bag.push({ id: lootItem.id, n: 1, day: Math.floor(this.game.day) }); VL.bag = VL.bag.filter((b) => b !== lootItem); }
      this.game.npcs?.die(victim, `死于${killer.name}之手（${why}）`);
      this.onDeath(victim, why, killer.id);
      this.log(`${killer.name}杀了${victim.name}：${why}`, 'bad');
    } else {
      const VL = this.of(victim);
      VL.robbed++;
      this.game.npcs?.die(victim, why);
      this.onDeath(victim, why, 'player');
      this.log(`你杀了${victim.name}（${realmName(victim.realm, victim.stage)}）：${why}`, 'bad');
    }
  }

  // ------------------------------------------------------------ 消息（八卦）传播
  spread(from: NpcData, r: Rumor) {
    const L = this.of(from);
    if (!L.rumors.some((x) => x.text === r.text)) L.rumors.push(r);
    if (L.rumors.length > 10) L.rumors.shift();
  }
  private gossipStep() {
    for (const d of this.npcs()) {
      if (!d.alive || !d.live) continue;
      const L = d.live;
      if (!L.rumors.length || !L.pal.length) continue;
      if (!chance(0.28)) continue;
      const r = pick(L.rumors);
      const p = pick(L.pal);
      const o = this.byId(p.t); if (!o || !o.alive) continue;
      const OL = this.of(o);
      if (OL.rumors.some((x) => x.text === r.text)) continue;
      OL.rumors.push({ ...r, from: d.id });
      if (OL.rumors.length > 10) OL.rumors.shift();
      this.stats.rumor++;
      if (r.about === 'player') {
        o.favor = clamp(o.favor + r.val * (r.val < 0 ? 3 : 2), -100, 100);
        if (r.val <= -2 && o.pers === 'righteous' && chance(0.25)) { o.grudge = Math.max(o.grudge ?? 0, 1); o.why = r.text; }
      }
    }
  }
  /** 你做的事，会被看见的人传出去 */
  publishPlayer(deed: string, val: number, witnesses: NpcData[] = []) {
    const ws = witnesses.length ? witnesses : this.npcs().filter((d) => d.alive && d.live && this.game.npcs?.active?.has(d.id));
    for (const d of ws.slice(0, 8)) this.spread(d, { about: 'player', text: deed, day: Math.floor(this.game.day), val });
    if (val <= -2) this.say(`有人在茶楼里说起你：${deed}`, 'rumor');
    else if (val >= 2) this.say(`江湖上有了你的新故事：${deed}`, 'rumor');
  }

  // ------------------------------------------------------------ 日程
  planDay(d: NpcData, r: () => number = Math.random) {
    const L = this.of(d);
    L.nextAgenda = this.game.day + (d.stay ? 6 : ri(2, 9, r));
    const foe = this.worstFoe(d);
    const kinAlive = L.kin.filter((k) => !k.dead);
    const opts: { k: AgendaKind; w: number; why: string; line?: string; loc?: string; with?: string }[] = [];
    if (foe && foe.sev >= 55 && (d.pers === 'ruthless' || d.pers === 'arrogant' || d.pers === 'righteous' || chance(0.3, r))) {
      const t = this.byId(foe.t);
      if (foe.t === 'player' || (t?.alive && Math.abs(this.power(d) - this.power(t)) < 14))
        opts.push({ k: 'seekRevenge', w: 60 + foe.sev * 0.4, why: `${foe.name}${foe.why}`, line: `（${foe.why}，这笔账他记了${Math.max(1, Math.floor((this.game.day - foe.day) / 30))}个月）` });
    }
    if (L.hp < 0.7) opts.push({ k: 'heal', w: 90, why: '上次的伤还没好利索', line: '（他脸色发白，寻了个背风处坐下运功疗伤）' });
    if (L.agenda?.k === 'mourn' && L.agenda.until > this.game.day) opts.push({ k: 'mourn', w: 200, why: L.agenda.why, line: L.agenda.line });
    if (L.sect?.job && L.sect.job.until > this.game.day) opts.push({ k: 'sectJob', w: 70, why: `门中差事：${L.sect.job.label}`, line: `（${L.sect.name}的差事在身，不敢耽搁）` });
    if (d.realm > 0) {
      opts.push({ k: 'cultivate', w: 40 + L.talent * 20, why: '修为停滞太久，得下功夫', line: '（他盘膝而坐，吐纳灵气）' });
      if (L.stones < 40) opts.push({ k: 'work', w: 55, why: '灵石不够使了', line: '（为了几块灵石，他也得弯腰）' });
      if (chance(0.25, r)) opts.push({ k: 'seclude', w: 18 + d.realm * 6, why: '要冲一冲境界', line: '（他在洞口布下禁制，闭关去了）' });
    } else {
      opts.push({ k: 'work', w: 90, why: '一家老小要吃饭', line: '（天不亮就下地了）' });
    }
    if (d.faction === 'merchant' || L.bag.length > 4) opts.push({ k: 'trade', w: 45, why: '手上的货该出手了', line: '（他背着储物袋往坊市去）' });
    if (kinAlive.length && chance(0.3, r)) { const k = pick(kinAlive, r); const o = this.byId(k.t); opts.push({ k: 'visitKin', w: 25, why: `去看看${KIN_WORD[k.r]}${k.name}`, loc: o?.home, line: `（好些日子没见${k.name}了）` }); }
    if (L.pal.length && chance(0.3, r)) { const p = pick(L.pal, r); opts.push({ k: 'meetPal', w: 22, why: `与${p.name}约了论道`, with: p.t, line: `（他与${p.name}在茶棚里坐下，说起近来的修行）` }); }
    if (L.courting && chance(0.4, r)) opts.push({ k: 'court', w: 30, why: '心里惦记着那个人', with: L.courting, line: '（他在人家门外徘徊了许久，终究没敢敲门）' });
    if (!d.stay && chance(0.18, r)) opts.push({ k: 'travel', w: 20, why: '在此地憋得慌，想出去走走', line: '（他收拾了储物袋，往山外去了）' });
    if (!opts.length) opts.push({ k: 'guardHome', w: 10, why: '守着家', line: '（他就在这儿住着，日子一天天过）' });
    const tot = opts.reduce((a, b) => a + b.w, 0);
    let x = r() * tot, o = opts[0];
    for (const c of opts) { x -= c.w; if (x <= 0) { o = c; break; } }
    L.agenda = { k: o.k, why: o.why, until: L.nextAgenda, loc: o.loc, with: o.with, line: o.line };
    L.busy = AGENDA_NAME[o.k];
    if (o.k === 'seekRevenge' && foe) {
      const t = this.byId(foe.t);
      if (t) { if ((t.map ?? 'tiannan') !== (d.map ?? 'tiannan')) d.map = t.map ?? d.map; d.goal = 'hunt'; d.until = this.game.day + 20; }
    } else if (o.k === 'visitKin' && o.loc) {
      d.goal = 'travel'; d.until = this.game.day + 6;
    }
  }

  private assignJob(d: NpcData, r: () => number = Math.random) {
    const L = this.of(d); if (!L.sect) return;
    const k = pick(SECT_JOB, r);
    L.sect.job = { k, label: k, until: this.game.day + ri(10, 45, r), pay: 10 + L.sect.rank * 12 + ri(0, 30, r) };
    this.stats.job++;
  }

  // ------------------------------------------------------------ 每天一次：世界自己转
  dayTick() {
    const g = this.game;
    const day = Math.floor(g.day);
    if (day === this.dayMark) return;
    this.dayMark = day;
    this.newsBudget = day % 3 === 0 ? 2 : 1;
    const r = mulberry32(((day * 2654435761) >>> 0) || 1);
    const list = this.npcs();
    let duelToday = 0;
    for (const d of list) {
      if (!d.alive) continue;
      const L = this.of(d);
      // 1) 功法日课
      for (const a of L.arts) {
        const ag = L.agenda?.k;
        const rate = (a.main ? 0.16 : 0.07) * L.talent
          * (ag === 'cultivate' ? 2.4 : ag === 'seclude' ? 5 : (ag === 'sectJob' || ag === 'work') ? 0.35 : 1)
          * (L.hp < 0.6 ? 0.3 : 1);
        a.prof = clamp(a.prof + rate * (0.5 + r()), 0, 400);
        const maxTier = clamp(Math.floor(d.realm * 1.1) + (L.sect ? 1 : 0), 0, 4);
        if (a.prof >= 400 && a.tier < maxTier && chance(0.02 + L.talent * 0.012, r)) {
          a.tier++; a.prof = 90; this.stats.break++;
          L.mem.push({ day, text: `《${a.name}》更进一层（${a.tier + 1}阶）` });
          if (a.main && chance(0.35, r)) this.say(`${d.name}（${realmName(d.realm, d.stage)}）主修的《${a.name}》忽有所悟，更进一层。`);
          this.tellPals(d, `${d.name}的《${a.name}》突破了`, 1);
        }
      }
      // 2) 谋生与开销：钱不会凭空涨——一家老小要吃饭，修行要买丹药灵材
      if (L.agenda?.k === 'work') L.stones += d.faction === 'mortal' ? ri(0, 2, r) : ri(1, 4, r);
      if (day % 30 === 0) {
        const mouths = 1 + L.kin.filter((k) => !k.dead).length * 0.6;
        const cost = (d.faction === 'mortal' ? 5 : 12 + d.realm * 16) * mouths;
        L.stones = Math.max(0, L.stones - cost);
        // 买修行所需：储物袋会真的补货，钱也真的花出去
        if (d.realm > 0 && L.stones > 80 + d.realm * 60 && L.bag.length < L.cap && chance(0.7, r)) {
          const goods = ITEM_LIST.filter((it) => it.tier <= Math.max(1, d.realm) && it.price <= L.stones * 0.45 && it.type !== 'misc');
          if (goods.length) { const it = pick(goods, r); L.stones -= it.price; L.bag.push({ id: it.id, n: 1, day }); L.mem.push({ day, text: `买了${it.name}` }); }
        }
      }
      if (L.sect) {
        if (day % 30 === 0) { L.stones += L.sect.salary; L.sect.contrib += ri(3, 12, r); }
        if (L.sect.job && day > L.sect.job.until) {
          L.stones += L.sect.job.pay; L.sect.contrib += ri(15, 40, r);
          if (chance(0.18, r)) this.say(`${L.sect.name}弟子${d.name}办完了「${L.sect.job.label}」的差事，得了 ${L.sect.job.pay} 灵石。`);
          this.assignJob(d, r);
        }
        const need = [0, 300, 900, 2000, 4000, 7000, 12000][L.sect.rank + 1] ?? 1e9;
        if (L.sect.contrib >= need && L.sect.rank < 6 && day % 30 === 0) {
          L.sect.rank++; L.sect.salary = 5 + L.sect.rank * L.sect.rank * 6;
          L.sect.duty = L.sect.rank >= 5 ? '坐镇一方' : L.sect.rank >= 4 ? '料理门中事务' : L.sect.rank >= 3 ? '带新弟子' : '听差办事';
          if (!d.canon && !d.beauty) d.title = `${L.sect.name}${SECT_RANK[L.sect.rank]}`;
          if (L.sect.rank >= 3) this.log(`${d.name}在${L.sect.name}升为${SECT_RANK[L.sect.rank]}。`, 'good');
          if (L.sect.rank >= 4) { this.say(`${L.sect.name}擢升${d.name}为${SECT_RANK[L.sect.rank]}。`, 'canon'); this.tellPals(d, `${d.name}升任${L.sect.name}${SECT_RANK[L.sect.rank]}`, 1); }
        }
      }
      // 3) 买卖：与朋友换东西（储物袋真的会变）
      if (L.agenda?.k === 'trade' || (L.bag.length > Math.max(6, Math.round(L.cap * 0.45)) && chance(0.2, r))) {
        const p = L.pal.length ? this.byId(pick(L.pal, r).t) : undefined;
        if (p?.alive && p.live && chance(0.5, r) && L.bag.length) {
          const sell = L.bag[Math.floor(r() * L.bag.length)];
          const def = itemDef(sell.id);
          const price = Math.max(1, Math.round(def.price * (0.7 + r() * 0.6)));
          if (p.live.stones >= price) {
            p.live.stones -= price; L.stones += price;
            if (sell.n > 1) sell.n--; else L.bag = L.bag.filter((b) => b !== sell);
            p.live.bag.push({ id: sell.id, n: 1, day });
            this.stats.trade++;
            if (chance(0.1, r)) this.say(`${d.name}把${def.name}卖给了${p.name}，得 ${price} 灵石。`);
          }
        } else if (L.bag.length > 8) {
          const sell = L.bag[Math.floor(r() * L.bag.length)];
          L.stones += Math.max(1, Math.round(itemDef(sell.id).price * 0.5));
          if (sell.n > 1) sell.n--; else L.bag = L.bag.filter((b) => b !== sell);
          this.stats.trade++;
        }
      }
      // 4) 买自己缺的东西
      if (L.need && !L.need.item && L.stones >= L.need.amount && chance(0.15, r)) {
        L.stones -= L.need.amount;
        L.mem.push({ day, text: `凑齐了${L.need.text}所需的 ${L.need.amount} 灵石` });
        L.need = undefined; L.mood = clamp(L.mood + 25, 0, 100);
        if (chance(0.3, r)) this.say(`${d.name}${L.mem[L.mem.length - 1].text}。`);
      }
      if (L.hp < 1) L.hp = clamp(L.hp + 0.06 * (L.agenda?.k === 'heal' ? 3 : 1), 0, 1);
      // 心境会慢慢平复，名声也会淡下去
      L.mood = clamp(L.mood + (58 - L.mood) * 0.03, 0, 100);
      if (day % 30 === 0) L.rep = Math.round(L.rep * 0.94);
      // 5) 社交
      if (L.pal.length && chance(0.3, r)) {
        const p = pick(L.pal, r); const o = this.byId(p.t);
        if (o?.alive && o.live) {
          p.last = day; p.in = clamp(p.in + ri(0, 3, r), -100, 100);
          const op = o.live.pal.find((x) => x.t === d.id); if (op) { op.last = day; op.in = clamp(op.in + ri(0, 3, r), -100, 100); }
          if (chance(0.25, r) && L.rumors.length) this.spread(o, pick(L.rumors, r));
          if (p.in > 88 && !d.bond && !o.bond && d.realm > 0 && o.realm > 0 && d.sex !== o.sex && !L.courting && chance(0.02, r)) {
            L.courting = o.id; o.live.courting = d.id;
            this.log(`${d.name}与${o.name}走得近了。`, 'good');
          }
        }
      }
      // 6) 成亲、生子
      if (L.courting && chance(0.012, r)) {
        const o = this.byId(L.courting);
        if (o?.alive && o.live && !L.kin.some((k) => k.r === 'spouse' && !k.dead) && !o.live.kin.some((k) => k.r === 'spouse' && !k.dead)) {
          L.kin.push({ t: o.id, name: o.name, r: 'spouse', day });
          o.live.kin.push({ t: d.id, name: d.name, r: 'spouse', day });
          L.courting = undefined; o.live.courting = undefined;
          L.mood = clamp(L.mood + 30, 0, 100); o.live.mood = clamp(o.live.mood + 30, 0, 100);
          d.favor = d.favor;
          this.stats.wed++;
          this.log(`${d.name}与${o.name}结为道侣。`, 'good');
          this.say(`${d.name}（${realmName(d.realm, d.stage)}）与${o.name}结为道侣。`, 'rumor');
          this.tellPals(d, `${d.name}与${o.name}结为道侣了`, 2); this.tellPals(o, `${d.name}与${o.name}结为道侣了`, 2);
        }
      }
      const kids = L.kin.filter((k) => k.r === 'child').length;
      if (d.sex === 'f' && kids < (d.faction === 'mortal' ? 4 : 2) && d.age >= 16 && d.age < (d.faction === 'mortal' ? 42 : 240) && L.kin.some((k) => k.r === 'spouse' && !k.dead) && chance(0.0025, r)) {
        const spouse = L.kin.find((k) => k.r === 'spouse' && !k.dead)!;
        const sex: 'm' | 'f' = chance(0.5, r) ? 'f' : 'm';
        const kid = this.birth(d, spouse, sex, r);
        if (kid) { this.stats.born++; this.log(`${d.name}与${spouse.name}添了个${sex === 'f' ? '女儿' : '儿子'}，取名${kid.name}。`, 'good'); if (chance(0.4, r)) this.say(`${d.name}家添了${sex === 'f' ? '一女' : '一子'}。`); this.tellPals(d, `${d.name}家添了${sex === 'f' ? '个女儿' : '个儿子'}`, 1); }
      }
      // 7) 仇恨发酵 / 报复
      for (const f of L.foe) {
        if (f.dead) continue;
        const hot = d.pers === 'ruthless' ? 0.5 : d.pers === 'arrogant' ? 0.25 : d.pers === 'kind' ? -0.6 : d.pers === 'aloof' ? -0.4 : 0;
        f.sev = clamp(f.sev + hot * (0.5 + r()) + (day - f.day > 400 ? -0.4 : 0.14), 0, 200);
        if (f.sev < 8) { f.dead = true; continue; }
        if (f.t !== 'player' && f.sev >= 55 && duelToday < 3 && chance(0.025, r)) {
          const t = this.byId(f.t);
          if (t?.alive && (t.map ?? 'tiannan') === (d.map ?? 'tiannan')) { this.resolveDuel(d, t, f, r); duelToday++; }
        }
      }
      // 8) 换日程
      if (!L.agenda || day >= L.nextAgenda) this.planDay(d, r);
      if (L.mem.length > 12) L.mem.splice(0, L.mem.length - 12);
      if (L.need && day > L.need.until) L.need = undefined;
    }
    if (day % 3 === 0) this.friction(r);
    this.gossipStep();
    if (day % 40 === 0) this.sectEvent(r);
  }

  /** 两个人的仇，自己了断（不在你眼前也照样发生） */
  private resolveDuel(a: NpcData, b: NpcData, f: Grudge, r: () => number) {
    const pa = this.power(a) + this.artLv(a) + (this.of(a).mood > 60 ? 1 : 0) + (this.of(a).hp < 0.6 ? -3 : 0);
    const pb = this.power(b) + this.artLv(b) + (this.of(b).hp < 0.6 ? -3 : 0);
    const ra = pa + r() * 14, rb = pb + r() * 14;
    this.stats.duel++;
    const win = ra >= rb ? a : b, lose = ra >= rb ? b : a;
    const WL = this.of(win), LL = this.of(lose);
    const where = LOC_BY_ID.get(lose.home)?.name ?? '野外';
    this.log(`${a.name}为「${f.why}」寻上${b.name}，两人在${where}斗了一场。`, 'bad');
    // 凡人打不出人命；修士之间也多半是分个胜负就走，真要出人命得势均力敌又下了死手
    const lethal = a.realm > 0 && b.realm > 0 && Math.abs(pa - pb) < 12 && chance(0.2, r);
    if (lethal) {
      WL.kills++; WL.hp = clamp(WL.hp - 0.3, 0.1, 1);
      f.dead = true;
      WL.mem.push({ day: Math.floor(this.game.day), text: `杀了${lose.name}，了结「${f.why}」` });
      WL.mood = clamp(WL.mood + 15, 0, 100);
      this.stats.revenge++;
      this.onKill(win, lose, `了结旧怨（${f.why}）`);
      this.tellPals(win, `${win.name}为「${f.why}」杀了${lose.name}`, -2);
      this.say(`${lose.name}（${realmName(lose.realm, lose.stage)}）死在了${win.name}手上，听说是一段旧怨。`, 'rumor');
    } else {
      LL.hp = clamp(LL.hp - 0.5, 0.1, 1); WL.hp = clamp(WL.hp - 0.2, 0.1, 1);
      f.sev = clamp(f.sev - 15, 0, 200); f.acted = (f.acted ?? 0) + 1;
      const hurtTxt = `被${win.name}打成重伤`;
      if (LL.mem[LL.mem.length - 1]?.text !== hurtTxt) LL.mem.push({ day: Math.floor(this.game.day), text: hurtTxt });
      const lf = LL.foe.find((x) => x.t === win.id);
      if (lf) lf.sev = clamp(lf.sev + 20, 0, 200); else this.addFoe(lose, win.id, win.name, 'insult', `被${win.name}重伤`, 45);
      this.tellPals(win, `${win.name}把${lose.name}打成了重伤`, -1);
      this.say(`${win.name}与${lose.name}斗法，${lose.name}负伤遁走。`, 'rumor');
    }
  }

  /** 新生儿入世：世界上真的多了一个人 */
  private birth(mom: NpcData, spouse: Kin, sex: 'm' | 'f', r: () => number): NpcData | null {
    const npcs = this.game.npcs; if (!npcs) return null;
    const father = this.byId(spouse.t);
    const id = `kid_${mom.id}_${Math.floor(this.game.day)}_${Math.floor(r() * 999)}`;
    if (npcs.byId.has(id)) return null;
    const sur = (father?.name ?? mom.name).slice(0, 1);
    const d: NpcData = {
      id, name: sur + pick(sex === 'f' ? ['念', '安', '宁', '小', '阿'] : ['承', '念', '安', '小', '阿'], r) + pick(['安', '宁', '禾', '川', '月', '山'], r),
      sex, role: sex === 'f' ? 'female' : 'farmer', realm: 0, stage: 0,
      faction: 'mortal' as Faction, home: mom.home,
      pers: (chance(0.5, r) ? mom.pers : (father?.pers ?? mom.pers)) as Pers,
      favor: 0, grudge: 0, met: false, alive: true, age: 0, life: 70 + r() * 30,
      x: mom.x, y: mom.y, tx: mom.x, ty: mom.y, goal: 'stay', until: this.game.day + 300,
      wealth: 0, seed: Math.floor(r() * 1e9), map: (mom.map ?? 'tiannan') as any, stay: mom.stay,
    };
    npcs.list.push(d); npcs.byId.set(d.id, d);
    const L = this.attach(d, r);
    L.kin.push({ t: mom.id, name: mom.name, r: 'mother' });
    if (father) L.kin.push({ t: father.id, name: father.name, r: 'father' });
    const ML = this.of(mom); ML.kin.push({ t: d.id, name: d.name, r: 'child', day: Math.floor(this.game.day) });
    if (father) this.of(father).kin.push({ t: d.id, name: d.name, r: 'child', day: Math.floor(this.game.day) });
    ML.mem.push({ day: Math.floor(this.game.day), text: `生了${d.name}` }); ML.mood = clamp(ML.mood + 25, 0, 100);
    return d;
  }

  /** 一件事说给身边人听 —— 消息就是从这里开始一天天传开的 */
  tellPals(d: NpcData, text: string, val = 0) {
    const L = this.of(d);
    const day = Math.floor(this.game.day);
    this.spread(d, { about: d.id, text, day, val });
    for (const p of L.pal) { const o = this.byId(p.t); if (o?.alive) this.spread(o, { about: d.id, text, day, val, from: d.id }); }
    for (const k of L.kin.filter((x) => !x.dead).slice(0, 3)) { const o = this.byId(k.t); if (o?.alive) this.spread(o, { about: d.id, text, day, val, from: d.id }); }
  }

  /** 人和人之间总会有摩擦，也总会有新交情 —— 这是仇恨与友谊的源头 */
  private friction(r: () => number) {
    const list = this.npcs();
    const n = Math.max(1, Math.round(list.length * 0.012));
    const REASON = ['为一株灵草动了手', '在坊市抢了同一间铺面', '争一处灵穴洞府', '论道时言语冲撞', '欠了灵石迟迟不还', '抢了同门的差事', '横刀夺爱', '醉后失手打伤了对方', '买卖上被坑了一笔', '门中排位之争'];
    const day = Math.floor(this.game.day);
    for (let i = 0; i < n; i++) {
      const a = list[Math.floor(r() * list.length)];
      if (!a || !a.alive) continue;
      const near = list.filter((o) => o !== a && o.alive && o.home === a.home && o.live);
      if (!near.length) continue;
      const b = near[Math.floor(r() * near.length)];
      const AL = this.of(a), BL = this.of(b);
      if (chance(0.45, r)) {
        const why = pick(REASON, r);
        const sev = ri(15, 45, r) + (a.pers === 'ruthless' ? 20 : a.pers === 'kind' ? -10 : 0);
        this.addFoe(a, b.id, b.name, 'insult', why, sev);
        if (chance(0.6, r)) this.addFoe(b, a.id, a.name, 'insult', why, sev * 0.7);
        AL.mood = clamp(AL.mood - 10, 0, 100); BL.mood = clamp(BL.mood - 10, 0, 100);
        AL.mem.push({ day, text: `与${b.name}${why}` }); BL.mem.push({ day, text: `与${a.name}${why}` });
        if (sev > 38 && chance(0.5, r)) this.tellPals(a, `${a.name}与${b.name}${why}，结下了梁子`, -1);
        const p = AL.pal.find((x) => x.t === b.id); if (p) p.in = clamp(p.in - 40, -100, 100);
      } else if (!AL.pal.some((x) => x.t === b.id) && AL.pal.length < 6) {
        AL.pal.push({ t: b.id, name: b.name, in: ri(8, 30, r), day, last: day });
        BL.pal.push({ t: a.id, name: a.name, in: ri(8, 30, r), day, last: day });
        if (chance(0.2, r)) this.tellPals(a, `${a.name}与${b.name}交好了`, 1);
      }
    }
  }

  /** 宗门层面的事 */
  private sectEvent(r: () => number) {
    const groups = new Map<string, NpcData[]>();
    for (const d of this.npcs()) if (d.alive && d.live?.sect) { const a = groups.get(d.live.sect.id) ?? []; a.push(d); groups.set(d.live.sect.id, a); }
    if (!groups.size) return;
    const sid = pick([...groups.keys()], r);
    const mem = groups.get(sid)!;
    const sect = mem[0].live!.sect!;
    const kind = ri(0, 3, r);
    if (kind === 0) {
      const n = ri(1, 4, r);
      this.log(`${sect.name}开山收徒，新收了 ${n} 名弟子。`, 'info');
      if (chance(0.5, r)) this.say(`${sect.name}今岁开山收徒，山下排了长队。`, 'canon');
    } else if (kind === 1 && mem.length > 2) {
      const a = pick(mem, r), b = pick(mem, r);
      if (a !== b && a.live && b.live) {
        this.addFoe(a, b.id, b.name, 'sect', `在${sect.name}门中争一处洞府`, ri(20, 50, r));
        this.log(`${sect.name}门中，${a.name}与${b.name}为一处灵穴洞府起了争执。`, 'info');
      }
    } else if (kind === 2) {
      const elder = mem.filter((m) => (m.live!.sect!.rank ?? 0) >= 4);
      if (elder.length) { const e = pick(elder, r); this.say(`${sect.name}${SECT_RANK[e.live!.sect!.rank]}${e.name}出关讲道三日，弟子获益匪浅。`, 'rumor'); this.log(`${e.name}在${sect.name}讲道三日。`, 'good'); }
    } else {
      const jobs = mem.filter((m) => m.live!.sect!.job);
      this.log(`${sect.name}这个月派出 ${jobs.length} 名弟子办差（采药、巡山、护商、斩妖）。`, 'info');
    }
  }

  // ------------------------------------------------------------ 动机：没有人会无故来找你
  private giveNeed(d: NpcData, r: () => number) {
    const L = this.of(d);
    const n = pick(NEED_FOR, r);
    L.need = { text: n.text, item: n.item, amount: n.amount, until: this.game.day + ri(60, 400, r) };
  }

  /**
   * 这个人此刻为什么要来找你？
   * 返回 null = 他没有理由，他就当你是个路人（这一条治好了“不明不白扑上来”）。
   */
  motive(d: NpcData): Motive | null {
    if (!d.alive) return null;
    const L = this.of(d);
    const g = this.game;
    const day = Math.floor(g.day);
    // 旧账优先：原有系统记下的仇（d.grudge / d.why）本身就是一个理由
    if ((d.grudge ?? 0) > 0) {
      const why = d.why ?? '旧怨';
      return { kind: (d.grudge ?? 0) >= 2 ? '血仇' : '旧怨', heat: 60 + (d.grudge ?? 0) * 20, why, line: why + '。今日撞上了，那就别怪我不客气！' };
    }
    if (d.favor <= -50) return { kind: '厌恶', heat: 55, why: `他极度厌恶你（好感 ${Math.round(d.favor)}）`, line: '你还敢站到我面前来？' };
    const pf = L.foe.find((f) => f.t === 'player' && !f.dead && f.sev > 6);
    if (pf) {
      const months = Math.max(1, Math.round((day - pf.day) / 30));
      return {
        kind: pf.kind === 'blood' ? '血仇' : '旧怨', heat: 100, why: pf.why,
        line: pf.kind === 'blood'
          ? `${pf.why}——我找了你${months}个月，今日总算撞上了！`
          : `${pf.why}。今日既然遇上，别怪我不客气！`,
      };
    }
    if (d.hunting || d.why?.startsWith('奉')) return { kind: '奉命', heat: 90, why: d.why ?? '宗门之命', line: d.why ?? '奉宗门之命，取你性命！' };
    const wanted = (g.rel as any)?.S?.wanted?.find?.((w: any) => w.reason && d.why && w.reason.includes(d.name));
    if (wanted) return { kind: '赏金', heat: 85, why: wanted.reason, line: `悬赏榜上你的人头值 ${wanted.amount} 灵石——${wanted.reason}，这活我接了。` };
    if (L.sect) {
      const rel = (g.rel as any)?.S?.sect?.[L.sect.id] ?? 0;
      if (rel <= -45) return { kind: '宗门之敌', heat: 70, why: `你与${L.sect.name}结了死仇`, line: `${L.sect.name}上下都在说你。我身为${SECT_RANK[L.sect.rank]}，不能不管。` };
    }
    if (g.ws.rep <= -55 && (d.pers === 'righteous' || d.pers === 'arrogant') && d.realm > 0)
      return { kind: '替天行道', heat: 60, why: `你的恶名（${Math.round(g.ws.rep)}）传到了他耳朵里`, line: `你就是那个${g.ws.rep <= -75 ? '人人得而诛之的魔头' : '恶名在外的家伙'}？今日我替天行道！` };
    const rich = this.heroWealth() > 400 || (g.hero?.realm ?? 0) >= 2;
    if (L.need && rich && (d.pers === 'greedy' || d.pers === 'ruthless' || d.faction === 'demon') && d.realm > 0) {
      const gap = this.power(d) - this.playerPower();
      if (gap >= -2) return { kind: '有所求', heat: 45 + clamp(gap * 4, 0, 30), why: L.need.text, line: `道友留步。${L.need.text}，听说道友身上正有。借来一用，日后必报——不借，那就别怪我了！` };
    }
    if (L.mem.some((m) => m.text.includes('你') && (m.text.includes('抢') || m.text.includes('打伤'))))
      return { kind: '现世报', heat: 65, why: '你刚对他动过手', line: '你才动的手，就想走？' };
    return null;
  }
  motiveLine(d: NpcData): string { return this.motive(d)?.line ?? (d.faction === 'mortal' ? '……' : '道友。'); }
  /** 友好的理由：他为什么主动跟你搭话（同样要有理由） */
  friendlyMotive(d: NpcData): string | null {
    const L = this.of(d);
    if (d.bond) return null;
    const rk = L.kin.find((k) => k.t === 'player' && !k.dead); if (rk) return `你是他的${KIN_WORD[rk.r]}`;
    if (L.sect?.master === 'player') return '你是他师父';
    if (L.pal.some((p) => p.t === 'player')) return '把你当朋友';
    const good = L.rumors.find((x) => x.about === 'player' && x.val > 0);
    if (good) return `听说了你的事迹：${good.text}`;
    if (d.favor >= 30) return `你帮过他（好感 ${Math.round(d.favor)}）`;
    return null;
  }

  private heroWealth() {
    const h: any = this.game.hero; if (!h?.bag) return 0;
    let v = 0;
    for (const b of h.bag) { if (b.id === 'mat_lingshi') v += b.n; else v += itemDef(b.id).price * b.n * 0.5; }
    return v;
  }
  power(d: NpcData) { return d.realm * 13 + d.stage; }
  playerPower() { const h = this.game.hero; return h ? h.realm * 13 + h.stage : 0; }
  /** 功法对战力的加成（让“有自己的功法”这件事真的有用） */
  artLv(d: NpcData): number {
    const L = d.live; if (!L) return 0;
    let s = 0;
    for (const a of L.arts) s += a.main ? a.tier * 0.5 + a.prof / 400 : a.tier * 0.25 + a.prof / 900;
    return +Math.min(2.6, s).toFixed(2);
  }

  // ------------------------------------------------------------ 每帧：让活着的样子被看见
  tick(dt: number) {
    const g = this.game;
    this.dayTick();
    this.bubbleT -= dt;
    if (this.bubbleT > 0) return;
    this.bubbleT = 2.4;
    const act = g.npcs?.active; if (!act) return;
    let budget = 2;
    for (const a of act.values()) {
      if (budget <= 0) break;
      const d = a.d; if (!d.alive || a.enemy || a.duel) continue;
      if (a.act === 'approach' || a.act === 'flee' || a.act === 'follow') continue;
      const L = d.live; if (!L?.agenda) continue;
      if (g.time - L.lastSaid < 14) continue;
      if (Math.hypot(a.st.x - g.player.x, a.st.y - g.player.y) > 900) continue;
      if (L.agenda.k === 'seekRevenge') continue;
      const line = L.agenda.line ?? this.agendaLine(d, L.agenda);
      if (!line) continue;
      L.lastSaid = g.time;
      a.bubble = { text: line, t: 3.4 };
      budget--;
    }
  }
  agendaLine(d: NpcData, ag: Agenda): string | null {
    const L = this.of(d);
    switch (ag.k) {
      case 'cultivate': return pick([`《${L.arts[0]?.name ?? '功法'}》又进了一分。`, '今日灵气尚可。', '差一点就能突破了……', '稳住，稳住。']);
      case 'work': return d.faction === 'mortal' ? pick(['今年的收成，够不够交租……', '娃他娘，饭好了没！', '这地里的草，拔不完。']) : pick([`还差 ${Math.max(0, 60 - Math.round(L.stones))} 灵石才够买那枚丹药。`, '替人护一趟镖，三十灵石。', '灵田里的草又长高了。']);
      case 'sectJob': return `${L.sect?.name ?? '门中'}派下来的「${L.sect?.job?.label ?? '差事'}」，误了要挨罚。`;
      case 'trade': return pick(['这批货得赶在坊市散市前出手。', '储物袋快装不下了……', '有人要收灵草么？']);
      case 'visitKin': case 'meetPal': case 'mourn': case 'court': case 'travel': case 'seclude': case 'heal': return ag.why;
      default: return null;
    }
  }

  // ------------------------------------------------------------ 储物袋 / 交易
  bagValue(d: NpcData) {
    const L = this.of(d);
    return L.stones + L.bag.reduce((a, b) => a + itemDef(b.id).price * b.n, 0);
  }
  /** 他摆摊卖的东西，就是他储物袋里真有的东西 */
  stockOf(d: NpcData): ShopStock[] {
    const L = this.of(d);
    const mul = d.pers === 'greedy' ? 1.35 : d.pers === 'kind' ? 0.88 : 1.08;
    const disc = 1 - clamp(d.favor, 0, 60) / 320;
    const out: ShopStock[] = [];
    for (const b of L.bag) {
      const it = itemDef(b.id);
      if (it.type === 'misc') continue;
      out.push({ id: b.id, price: Math.max(1, Math.round(it.price * mul * disc)), n: b.n, age: it.type === 'herb' ? 10 + (d.seed % 60) : undefined });
    }
    return out;
  }
  /** 交易成交后，从他储物袋里真的扣掉 */
  afterBuy(d: NpcData, id: string, n: number) {
    const L = this.of(d);
    const b = L.bag.find((x) => x.id === id);
    if (!b) return;
    b.n -= n;
    if (b.n <= 0) L.bag = L.bag.filter((x) => x !== b);
    L.stones += Math.max(1, Math.round(itemDef(id).price * 0.8 * n));
    L.mem.push({ day: Math.floor(this.game.day), text: `把${itemDef(id).name}卖给了你` });
    d.favor = clamp(d.favor + 1, -100, 100);
  }
  /** 他死了，储物袋里的东西掉了 */
  dropsOf(d: NpcData): { id: string; n: number }[] {
    const L = this.of(d);
    const out = L.bag.map((b) => ({ id: b.id, n: b.n }));
    L.bag = []; L.drop = true;
    return out;
  }

  // ------------------------------------------------------------ 显示
  profileLines(d: NpcData): string[] {
    const L = this.of(d);
    const out: string[] = [];
    const tiers = ['凡阶', '黄阶', '玄阶', '地阶', '天阶'];
    out.push(`【此刻】${L.busy || AGENDA_NAME[L.agenda?.k ?? 'guardHome']}${L.agenda ? '：' + L.agenda.why : ''}`);
    const main = L.arts.find((a) => a.main) ?? L.arts[0];
    out.push(`【功法】${main ? `《${main.name}》${main.school}系·${tiers[main.tier]}·熟练 ${Math.round(main.prof)}` : '未入修行'}${main?.from ? `（${main.from}）` : ''}`);
    const sk = L.arts.filter((a) => !a.main);
    if (sk.length) out.push(`【神通】${sk.map((a) => `${a.name}（熟练 ${Math.round(a.prof)}）`).join('、')}`);
    out.push(`【储物袋】${Math.round(L.stones)} 灵石 · ${L.bag.length}/${L.cap} 格${L.bag.length ? '：' + L.bag.slice(0, 6).map((b) => `${itemDef(b.id).name}×${b.n}`).join('、') + (L.bag.length > 6 ? ' 等' : '') : ''}`);
    if (L.sect) out.push(`【门派】${L.sect.name} · ${SECT_RANK[L.sect.rank]} · 贡献 ${L.sect.contrib} · 入门 ${L.sect.joined} 年${L.sect.masterName ? ` · 师承${L.sect.masterName}` : ''}${L.sect.disciples.length ? ` · 门下 ${L.sect.disciples.length} 人` : ''}${L.sect.job ? ` · 差事「${L.sect.job.label}」（赏 ${L.sect.job.pay} 灵石）` : ''}`);
    if (L.clan) out.push(`【家族】${L.clan.name}（${L.clan.motto}）· 声望 ${L.clan.stand} · 籍贯 ${LOC_BY_ID.get(L.clan.home)?.name ?? '未知'}`);
    const kinAlive = L.kin.filter((k) => !k.dead), kinDead = L.kin.filter((k) => k.dead);
    out.push(`【家小】${kinAlive.length ? kinAlive.map((k) => `${KIN_WORD[k.r]}·${k.name}`).join('、') : '孤身一人'}${kinDead.length ? `（已故 ${kinDead.map((k) => KIN_WORD[k.r] + k.name).join('、')}）` : ''}`);
    out.push(`【交游】${L.pal.length ? L.pal.slice().sort((a, b) => b.in - a.in).slice(0, 5).map((p) => `${p.name}（亲 ${Math.round(p.in)}${p.last && this.game.day - p.last < 30 ? '·近见过' : ''}）`).join('、') : '没什么来往的人'}`);
    const foes = L.foe.filter((f) => !f.dead);
    out.push(`【仇怨】${foes.length ? foes.map((f) => `${f.name}（${f.why}，恨 ${Math.round(f.sev)}${f.t === 'player' ? '·冲着你' : ''}）`).join('；') : '与人无争'}`);
    out.push(`【心境】${Math.round(L.mood)}/100 · 资质 ${L.talent} · 名声 ${L.rep > 0 ? '+' : ''}${Math.round(L.rep)} · 伤势 ${L.hp >= 1 ? '无' : Math.round((1 - L.hp) * 100) + '%'}`);
    if (L.need) out.push(`【难处】${L.need.text}`);
    if (L.rumors.length) out.push(`【听说】${L.rumors.slice(-3).map((x) => x.text).join('；')}`);
    if (L.mem.length) out.push(`【记着】${L.mem.slice(-4).map((m) => m.text).join('；')}`);
    out.push(`【一生】杀人 ${L.kills} · 助人 ${L.helped} · 寿元余 ${Math.max(0, Math.round(d.life - d.age))} 年`);
    return out;
  }

  /** 对话框：这个人的底细 */
  profileNode(d: NpcData, look: any, title: string, back: () => DNode): DNode {
    const L = this.of(d);
    const tiers = ['凡阶', '黄阶', '玄阶', '地阶', '天阶'];
    const opts: DOpt[] = [];
    if (L.need) {
      const hero: any = this.game.hero;
      const ls = hero?.bag?.find((b: any) => b.id === 'mat_lingshi')?.n ?? 0;
      const canPay = ls >= L.need.amount;
      opts.push({
        label: `帮他一把（${L.need.amount} 灵石）`, disabled: !canPay,
        act: () => {
          const b = hero.bag.find((x: any) => x.id === 'mat_lingshi'); b.n -= L.need!.amount;
          L.stones += L.need!.amount;
          d.favor = clamp(d.favor + 35, -100, 100);
          L.helped++; L.need = undefined; L.mood = clamp(L.mood + 35, 0, 100);
          L.mem.push({ day: Math.floor(this.game.day), text: '你在他最难的时候帮了他' });
          if (!L.pal.some((p) => p.t === 'player')) L.pal.push({ t: 'player', name: '你', in: 60, day: Math.floor(this.game.day) });
          const pf = L.foe.find((f) => f.t === 'player'); if (pf) pf.sev = clamp(pf.sev - 40, 0, 200);
          if (d.grudge > 0 && d.favor > 0) { d.grudge = 0; d.why = undefined; d.hunting = false; }
          this.publishPlayer(`在${d.name}最难的时候伸了手`, 2, [d]);
          this.log(`你帮了${d.name}：${L.need ? '' : '解了他的难处'}`, 'good');
          return { speaker: d.name, title, look, text: `（他愣了半晌，双手接过，喉头动了动）\n\n这份情，${d.name}记下了。往后你有事，只管开口。`, options: [{ label: '还有别的事', act: () => back() }, { label: '告辞', act: () => null }] } as DNode;
        },
      });
    }
    const main = L.arts.find((a) => a.main);
    if (main && d.realm > 0) opts.push({
      label: `请教《${main.name}》`, hint: d.favor < 40 ? '交情不够' : '', disabled: d.favor < 40,
      act: () => {
        d.favor = clamp(d.favor - 5, -100, 100);
        L.mem.push({ day: Math.floor(this.game.day), text: '把功法要诀讲给了你' });
        this.game.toast(`${d.name}把《${main.name}》的要诀讲与你听。`, 'good');
        this.publishPlayer(`向${d.name}请教了《${main.name}》`, 1, [d]);
        return { speaker: d.name, title, look, text: `《${main.name}》是${main.from}得来的，${main.school}系${tiers[main.tier]}功法。\n\n（他把行气的关窍、几处穴道、以及自己 ${Math.round(main.prof)} 点熟练度里踩过的坑，一一说与你听）`, options: [{ label: '受教了', act: () => back() }] } as DNode;
      },
    });
    const foes = L.foe.filter((f) => !f.dead);
    if (foes.length) opts.push({
      label: '问他的仇家', act: () => ({
        speaker: d.name, title, look, mood: 'danger',
        text: foes.map((f) => `· ${f.name}：${f.why}（结于 ${Math.max(1, Math.round((this.game.day - f.day) / 30))} 个月前，恨意 ${Math.round(f.sev)}）${f.acted ? `已报过 ${f.acted} 次` : ''}`).join('\n'),
        options: [{ label: '还有别的事', act: () => back() }, { label: '告辞', act: () => null }],
      }) as DNode,
    });
    if (L.kin.length) opts.push({
      label: '问他的家小', act: () => ({
        speaker: d.name, title, look,
        text: L.kin.map((k) => `· ${KIN_WORD[k.r]}${k.name}${k.dead ? `（已故）` : ''}`).join('\n') + (L.clan ? `\n\n${L.clan.name}，家训「${L.clan.motto}」。` : ''),
        options: [{ label: '还有别的事', act: () => back() }, { label: '告辞', act: () => null }],
      }) as DNode,
    });
    if (L.rumors.length) opts.push({
      label: '问他听说了什么', act: () => ({
        speaker: d.name, title, look,
        text: L.rumors.slice(-5).reverse().map((x) => `· ${x.text}${x.from ? `（${this.nameOf(x.from)}说的）` : ''}`).join('\n'),
        options: [{ label: '还有别的事', act: () => back() }, { label: '告辞', act: () => null }],
      }) as DNode,
    });
    opts.push({ label: '返回', act: () => back() });
    return { speaker: d.name, title, look, text: `（你不动声色地把这个人从头到脚看了一遍）\n\n${this.profileLines(d).join('\n')}`, options: opts };
  }

  /** 他嘴里的消息：优先说自己真听过的八卦 */
  rumorOf(d: NpcData): string | null {
    const L = d.live; if (!L) return null;
    const pool = L.rumors.filter((x) => x.about !== 'player');
    if (!pool.length) return null;
    const r = pick(pool);
    return `${r.text}${r.from ? `（${this.nameOf(r.from)}告诉我的）` : ''}`;
  }

  // ------------------------------------------------------------ 统计
  summary(): string[] {
    const list = this.npcs();
    const alive = list.filter((d) => d.alive);
    const withSect = alive.filter((d) => d.live?.sect).length;
    const withKin = alive.filter((d) => (d.live?.kin ?? []).some((k) => !k.dead)).length;
    const foes = alive.reduce((a, d) => a + (d.live?.foe ?? []).filter((f) => !f.dead).length, 0);
    const pals = alive.reduce((a, d) => a + (d.live?.pal ?? []).length, 0);
    const items = alive.reduce((a, d) => a + (d.live?.bag ?? []).length, 0);
    const arts = alive.reduce((a, d) => a + (d.live?.arts ?? []).length, 0);
    const need = alive.filter((d) => d.live?.need).length;
    return [
      `在世 ${alive.length} 人 · ${withSect} 人有门派 · ${withKin} 人有家小 · ${need} 人眼下有难处`,
      `功法 ${arts} 门 · 储物袋物件 ${items} 件 · 人际 ${pals} 条 · 未了仇怨 ${foes} 笔`,
      `出生 ${this.stats.born} · 死亡 ${this.stats.died} · 成亲 ${this.stats.wed} · 斗法 ${this.stats.duel}（报仇 ${this.stats.revenge}）`,
      `交易 ${this.stats.trade} 笔 · 功法突破 ${this.stats.break} 次 · 血仇 ${this.stats.feud} 起 · 传话 ${this.stats.rumor} 次 · 差事 ${this.stats.job} 件`,
    ];
  }
}

/** 便捷：随便找个地方 */
export function locPos(id: string, r: () => number = Math.random) {
  const l = LOC_BY_ID.get(id) ?? locsOf(ACTIVE_MAP)[0];
  return { x: l.x * WORLD_SCALE + (r() - 0.5) * 900, y: l.y * WORLD_SCALE + (r() - 0.5) * 700 };
}
