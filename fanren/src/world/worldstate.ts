// 人界世界状态（声望、宗门、红颜、大事件、传闻），随存档保存

export interface SectTask { id: string; kind: 'kill' | 'gather' | 'deliver' | 'patrol'; text: string; target: string; need: number; have: number; reward: number; exp: number; until: number }
export interface SectState { id: string; rank: number; contrib: number; joined: number; lastPay: number; tasks: SectTask[]; done: number }
export interface HeartState { favor: number; stage: number; met: boolean; follow: boolean; flags: Record<string, any>; lastGift: number; lastTalk: number; gifts: number }
export interface EventState { state: 'pending' | 'active' | 'done' | 'missed'; result?: string; t?: number; score?: number }

export interface WorldState {
  rep: number;                         // 正道声望（为负即魔名）
  sect: SectState | null;
  hearts: Record<string, HeartState>;
  flags: Record<string, any>;
  events: Record<string, EventState>;
  news: { day: number; text: string; kind?: 'canon' | 'rumor' | 'personal' }[];
  tp: string[];                        // 已激活的传送阵
  kills: Record<string, number>;       // 按敌人种类计数（宗门任务）
  hints: string[];                     // 已显示过的新手提示
  // ---------- 第十八步：机缘、洞府、灵宠、传音、悬赏 ----------
  sites: Record<string, SiteState>;    // 地图机缘的状态（键：图|格）
  home: HomeState | null;              // 洞府（每局一座，可迁居）
  pets: PetState[]; petActive: number; // 灵宠
  incubate: { id: string; days: number; need: number } | null;   // 正在温养的灵卵
  letters: Letter[];                   // 传音符
  bounties: Bounty[];                  // 已接的悬赏
  caches: CacheState[];                // 残图所指的藏宝处
  blessUntil: number;                  // 山神庇佑（至某日）
}
export interface SiteState { done?: number; layer?: number; seen?: 1; partner?: number; read?: 1; drink?: number; dive?: number; [k: string]: any }
export interface Plot { herb: string | null; age: number; n: number; day: number }
export interface HomeState { map: string; x: number; y: number; key: string; name: string; plots: Plot[]; array: number; built: number; robbed?: number }
export interface PetState { kind: string; name: string; lv: number; xp: number; bond: number; born: number }
export interface Letter { id: number; from: string; day: number; text: string; kind: 'chat' | 'req' | 'sos' | 'fest' | 'jealous' | 'gift'; read?: boolean; replied?: boolean; replies?: { label: string; favor: number; reply: string }[] }
export interface Bounty { id: string; town: string; map: string; name: string; def: string; realm: number; stage: number; x: number; y: number; reward: number; until: number; done?: boolean; spawned?: boolean }
export interface CacheState { id: number; map: string; x: number; y: number; ox: number; oy: number; tier: number; done?: boolean }

export function newWorldState(): WorldState {
  return { rep: 0, sect: null, hearts: {}, flags: {}, events: {}, news: [], tp: [], kills: {}, hints: [], sites: {}, home: null, pets: [], petActive: 0, incubate: null, letters: [], bounties: [], caches: [], blessUntil: 0 };
}

export const SECT_RANKS = ['外门弟子', '内门弟子', '核心弟子', '执事', '长老'];
export const SECT_RANK_NEED = [0, 300, 1200, 4000, 12000];  // 累计贡献
export const SECT_RANK_REALM = [1, 1, 2, 3, 3];             // 境界要求（大境界）

export function repName(rep: number) {
  if (rep >= 80) return '侠名远播';
  if (rep >= 40) return '正道称许';
  if (rep >= 12) return '小有善名';
  if (rep > -12) return '籍籍无名';
  if (rep > -40) return '风评不佳';
  if (rep > -80) return '恶名在外';
  return '魔头';
}
