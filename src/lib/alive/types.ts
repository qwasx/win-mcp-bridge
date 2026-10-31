// 活世界（代号「活世界」）· 共享引擎类型
// 目的：让 NPC 活起来 —— 有自己的储物袋、功法、门派、仇恨、家庭、社交与日常，
//                     与人接触必须有「缘由」，不再莫名其妙地把主角喊过去。
// 本文件零依赖（无 DOM / 无第三方库），浏览器（游戏）与服务端（Next.js 世界后台）共用。

export type Sex = 'm' | 'f';

/** 性格（与游戏内 npc.ts 的 Pers 对齐） */
export type Pers = 'righteous' | 'greedy' | 'cautious' | 'arrogant' | 'kind' | 'ruthless' | 'aloof';

/** 大境界（0..5 = 练气/筑基/结丹/元婴/化神/…，引擎只关心数量级） */
export interface RealmDef { name: string; life: number; stages: number }

export type BagKind = 'art' | 'pill' | 'herb' | 'weapon' | 'talisman' | 'material' | 'misc' | 'stone';

/** 储物袋里的一件东西。每件都有「来路」——谁给的、哪里采的、从谁身上扒的。 */
export interface BagItem {
  id: string;
  name: string;
  kind: BagKind;
  tier: number;              // 品阶 1..6
  count: number;
  /** 来路（一句短话，例如「云梦山采的」「斩杀血煞门弟子所得」「宗门岁供」） */
  src: string;
  /** 得到之日 */
  day: number;
  /** 与某人的瓜葛（例如「原属李家三郎」） */
  about?: string;
  /** 价值（灵石） */
  worth: number;
}

/** 一门功法。NPC 会自己修炼、卡关、求教、传给弟子。 */
export interface Art {
  id: string;
  name: string;
  el: string;                // 五行 / 属性
  tier: number;              // 1..6
  mastery: number;           // 0..100 修至几层
  /** 学自何处 / 何人 */
  from: string;
  /** 资质（决定每日长进） */
  apt: number;
  day: number;
}

export type KinKind = 'spouse' | 'parent' | 'child' | 'sibling';

export interface KinTie { other: string; kind: KinKind; since: number; note?: string }

export type SocialKind = 'friend' | 'sworn' | 'mentor' | 'disciple' | 'lover' | 'rival' | 'trade';

export interface SocialTie {
  other: string;
  kind: SocialKind;
  val: number;               // -100..100 情谊
  since: number;
  last: number;              // 最近一次往来之日
  note?: string;
}

/** 仇恨。有缘由、有热度、会衰减、会血亲代偿（血仇）。 */
export interface Grudge {
  other: string;
  heat: number;              // 0..100；>=60 记恨，>=85 寻仇
  reason: string;            // 「他抢了我采了三十年的紫猴花」
  day: number;
  blood?: boolean;           // 血仇（亲族被杀），不由时间洗去
  /** 替谁报仇（血亲 id） */
  forKin?: string;
  attempts?: number;
  /** 已了结（报了仇 / 被人调解 / 对方已死） */
  done?: boolean;
}

export interface Debt { other: string; amount: number; kind: 'owe' | 'owed'; day: number; why: string }

/** 需求（驱动日程的内在动机） */
export interface Need { cultivation: number; wealth: number; safety: number; belonging: number; revenge: number }

export type AgendaKind =
  | 'train' | 'gather' | 'hunt' | 'trade' | 'errand' | 'seclude'
  | 'home' | 'avenge' | 'sect' | 'social' | 'court' | 'visit' | 'teach' | 'guard';

/** 当前在做什么、为什么。这是「活」的核心：任何时刻都能回答「他在干嘛，为何在这」。 */
export interface Agenda {
  kind: AgendaKind;
  placeId?: string;
  targetId?: string;         // 对象（找人 / 寻仇 / 求教）
  until: number;
  why: string;               // 人话：为什麽
  days?: number;
}

export interface Soul {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  realm: number;
  stage: number;
  pers: Pers;
  /** 常住地（地名 id） */
  homeId: string;
  homeName: string;
  /** 所在（当前所在地名 id） */
  atId: string;
  sectId?: string;
  sectName?: string;
  sectRank?: string;
  faction: 'sect' | 'rogue' | 'demon' | 'mortal' | 'merchant';
  alive: boolean;
  /** 死因 / 死日 */
  deathNote?: string;
  deathDay?: number;
  /** 由谁所杀（血仇会追到亲族头上） */
  killer?: string;
  familyId?: string;
  kin: KinTie[];
  social: SocialTie[];
  grudges: Grudge[];
  debts: Debt[];
  bag: BagItem[];
  arts: Art[];
  stones: number;
  fame: number;              // -100..100 名声
  mood: number;              // -20..20 心情
  need: Need;
  agenda: Agenda;
  traits: string[];          // 「爱财如命」「护短」「话多」
  /** 最近一句自述（气泡 / 命册用） */
  quip?: string;
  lastTalkDay?: number;
  /** 主角相关：相识 / 好感 / 恩怨 */
  metHero?: boolean;
  favor?: number;
  /** 修炼卡关的功法（会去求教 / 抢功法） */
  stuckArt?: string;
}

export interface Family {
  id: string;
  name: string;
  seat: string;              // 聚居地
  members: string[];
  honor: number;             // 家声
  wealth: number;
  creed: string;             // 家训
  feuds: { other: string; since: number; reason: string; blood: boolean }[];
  blood?: string;            // 血仇对象（家族 id）
}

export interface SectStandings {
  id: string;
  name: string;
  demon: boolean;
  members: number;
  power: number;
  mood: number;              // 士气
  allies: string[];
  foes: string[];
  grudges: { other: string; reason: string; heat: number; day: number }[];
  deeds: { day: number; text: string }[];
}

export interface Rumor {
  id: string;
  day: number;
  text: string;
  kind: 'death' | 'treasure' | 'grudge' | 'romance' | 'sect' | 'hero' | 'trade';
  about: string;
  at: string;
  truth: number;             // 1 = 千真万确，往下越传越歪
  spread: number;
}

/** 世界大事记（Chronicle） */
export interface ChronEvent {
  day: number;
  kind: 'death' | 'kill' | 'birth' | 'wed' | 'grudge' | 'revenge' | 'sect' | 'trade' | 'art' | 'treasure' | 'hero' | 'bond' | 'fell';
  text: string;
  who?: string;
  place?: string;
  weight: number;
}

/** 主角收到的一次「邀约」。必须有缘由，不接受无因之召。 */
export interface ContactRequest {
  id: string;
  from: string;
  fromName: string;
  day: number;
  until: number;
  /** 一句话缘由（会出现在对话与日志里） */
  reason: string;
  /** 更长的说法（对方开口第一句） */
  line: string;
  tone: 'friendly' | 'trade' | 'sect' | 'threat' | 'grief' | 'vengeance' | 'romance' | 'curiosity';
  /** 事成之利 / 拒绝之弊 */
  gain: string;
  cost: string;
  placeId?: string;
  placeName?: string;
  /** 与你arte相关的东西（例如想买你袋里的某件东西） */
  about?: string;
  handled?: boolean;
  result?: string;
}

export interface HeroLink {
  met: boolean;
  favor: number;
  grudge: number;
  fame: number;
  /** 主角做过的事，NPC 记在心里 */
  deeds: { day: number; text: string; weight: number }[];
}

export interface WorldStats {
  births: number;
  deaths: number;
  murders: number;
  duels: number;
  trades: number;
  revenge: number;
  wed: number;
  contact: number;
  refused: number;
}

export interface World {
  seed: number;
  day: number;
  souls: Record<string, Soul>;
  families: Record<string, Family>;
  sects: Record<string, SectStandings>;
  rumors: Rumor[];
  chron: ChronEvent[];
  contacts: ContactRequest[];
  hero: HeroLink;
  heroName: string;
  stats: WorldStats;
  /** 各地「人气」——用于日程去处与传闻传播 */
  buzz: Record<string, number>;
}

export interface RealmTable { realms: RealmDef[] }

export interface AliveConfig {
  seed: number;
  heroName: string;
  heroId?: string;
  realms: RealmTable;
  /** 追加门派（游戏传入与游戏内一致的门派表） */
  sects?: { id: string; name: string; demon?: boolean; allies?: string[]; foes?: string[] }[];
}
