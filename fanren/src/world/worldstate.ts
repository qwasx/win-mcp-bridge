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
}

export function newWorldState(): WorldState {
  return { rep: 0, sect: null, hearts: {}, flags: {}, events: {}, news: [], tp: [], kills: {}, hints: [] };
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
