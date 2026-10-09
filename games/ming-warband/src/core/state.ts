// 游戏状态类型定义
import type { FactionId, SettlementKind } from '../data/world';

export interface Stack { id: string; n: number; w: number; xp: number }

export type SkillId = 'ironflesh' | 'powerstrike' | 'archery' | 'riding' | 'leadership' | 'training' | 'tactics' | 'trade' | 'surgery' | 'spotting' | 'pathfinding' | 'prisoner';
export type AttrId = 'str' | 'agi' | 'int' | 'cha';

export interface Equip { melee: string | null; ranged: string | null; armor: string | null; helm: string | null; horse: string | null }

export interface Hero {
  name: string;
  background: string;
  level: number;
  xp: number;
  attrs: Record<AttrId, number>;
  skills: Record<SkillId, number>;
  attrPts: number;
  skillPts: number;
  hp: number; // 当前生命（比例 0~1）
  equip: Equip;
  inventory: string[]; // 背包中的装备
}

export type PartyKind = 'player' | 'lord' | 'bandit' | 'caravan' | 'villager';
export type AIMode = 'idle' | 'travel' | 'chase' | 'flee' | 'siege' | 'raid' | 'patrol' | 'recruit' | 'wander' | 'follow' | 'breach';

export interface AIState {
  mode: AIMode;
  target?: string | number;
  tx?: number; ty?: number;
  path?: [number, number][];
  until?: number;
  nextThink: number;
  ax?: number; ay?: number; // 活动中心
  pathFor?: string;
}

export interface Party {
  id: number;
  kind: PartyKind;
  name: string;
  faction: FactionId;
  x: number; y: number;
  troops: Stack[];
  prisoners: Stack[];
  gold: number;
  goods: Record<string, number>;
  lordId?: string;
  home?: string;
  ai: AIState;
  inside?: string; // 停留在据点中
  reg?: number;    // 上次所在：1 关内 / 2 关外
  questId?: number;
  zone?: number;
  hidden?: boolean;
}

export interface TavernState { companion: string | null; mercs: { id: string; n: number } | null; refresh: number }

export interface Settlement {
  id: string; name: string; kind: SettlementKind;
  faction: FactionId;
  owner: string | null; // 领主 id 或 'player'
  x: number; y: number;
  parent?: string;
  villages: string[];
  garrison: Stack[];
  prosperity: number;
  stock: Record<string, number>;
  produce: string[];
  demand: string[];
  shop: string[];
  recruits: number;
  relation: number;
  lootedUntil: number;
  siege: { by: number; since: number; mineAt?: number } | null;
  isPass?: boolean;            // 长城关隘
  tavern: TavernState;
  culture: string;
}

export interface Lord {
  id: string; name: string; faction: FactionId; title: string; trait: string;
  relation: number;
  partyId: number | null;
  respawnAt: number;
  dead?: boolean;
}

export type QuestType = 'bandit' | 'letter' | 'grain' | 'troops';
export interface Quest {
  id: number; type: QuestType; title: string; desc: string;
  giver: string; giverName: string; giverFaction: FactionId;
  target?: string | number; targetName?: string;
  amount?: number; troopTier?: number;
  reward: number; deadline: number;
}

export interface LogEntry { t: number; msg: string; cls?: string }

export interface CompanionState { id: string; wounded: number /* 0 健康, >0 剩余受伤小时 */; joined: number }

export interface GameState {
  version: number;
  seed: number;
  time: number; // 小时
  hero: Hero;
  playerId: number;
  parties: Party[];
  settlements: Record<string, Settlement>;
  lords: Record<string, Lord>;
  wars: string[]; // "a|b"
  truceUntil: Record<string, number>;
  alive: Record<string, boolean>;
  playerFaction: FactionId | null; // 效忠势力（封臣）
  mercOf: FactionId | null; // 雇佣兵契约
  mercUntil: number;
  ownFactionName: string;
  playerRel: Record<string, number>;
  renown: number;
  honor: number;
  morale: number;
  companions: CompanionState[];
  quests: Quest[];
  log: LogEntry[];
  nextId: number;
  stats: { kills: number; won: number; lost: number; days: number };
  lastDay: number;
  speed: number;
  won?: boolean;
  cannons?: number;           // 随军火炮
  wallHp?: number[];          // 长城各段完好度（<=0 为缺口）
  beacons?: { x: number; y: number; until: number }[]; // 烽火
  calendarDone?: string[];    // 已发生的历史事件
  flags?: Record<string, number | boolean | string>;
  arenaBest?: number;
  pendingDefense?: { st: string; by: number } | null; // 玩家所在城池遭攻城
}

export function warKey(a: string, b: string) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
