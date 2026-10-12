// 联机协议（客户端与服务器共用）
import type { FactionId, FactionDef } from '../data/world';
import type { CompanionState, Hero, Lord, Party, Quest, Settlement, Stack } from '../core/state';

export const PROTO_VERSION = 1;
/** 玩家可选的五国 */
export const NATIONS: FactionId[] = ['ming', 'jin', 'chuang', 'xi', 'mon'];

/** 玩家档案（服务器持久化；私有部分由客户端上传，服务器做合理性检查） */
import type { GodState } from '../core/god';

export interface PRec {
  name: string;
  nation: FactionId | null;
  bg: string;
  hero: Hero;
  troops: Stack[];
  prisoners: Stack[];
  gold: number;
  goods: Record<string, number>;
  renown: number;
  honor: number;
  morale: number;
  companions: CompanionState[];
  quests: Quest[];
  stats: { kills: number; won: number; lost: number; days: number };
  playerRel: Record<string, number>;
  cannons?: number;
  rank?: number;          // 官职等级（本国内）
  x?: number; y?: number; // 下线位置
  created: number;
  pvpOptIn?: boolean;     // 主动发起过 PvP（新手保护提前解除）
  god?: GodState;         // 天命（只有 GM 有；客户端不能上传）
  mutedUntil?: number;    // 禁言到（现实毫秒）
}

/** 玩家可上传的私有字段 */
export const PRIVATE_KEYS = ['hero', 'troops', 'prisoners', 'gold', 'goods', 'renown', 'honor', 'morale', 'companions', 'quests', 'stats', 'playerRel', 'cannons'] as const;
export type PrivatePart = Pick<PRec, typeof PRIVATE_KEYS[number]>;

/** 世界快照（不含部队；部队单独同步） */
export interface WorldSnap {
  version: number; seed: number; time: number; nextId: number;
  settlements: Record<string, Settlement>;
  lords: Record<string, Lord>;
  wars: string[]; truceUntil: Record<string, number>; alive: Record<string, boolean>;
  wallHp?: number[]; beacons?: { x: number; y: number; until: number }[];
  calendarDone?: string[]; chronLog?: { n: string; at: number }[]; flags?: Record<string, number | boolean | string>;
  treaties: Treaty[];
  customFactions?: Record<string, FactionDef>;
}

/** 部队对外信息 */
export type NetParty = Pick<Party, 'id' | 'kind' | 'name' | 'faction' | 'x' | 'y' | 'troops' | 'gold' | 'goods' | 'lordId' | 'home' | 'inside' | 'questId' | 'hidden' | 'acct' | 'busy' | 'grace' | 'hp' | 'lvl'> & { ai: { mode: Party['ai']['mode']; target?: string | number }; god?: 1 };

export type { Treaty } from '../core/state';
import type { Treaty } from '../core/state';

export interface ServerCfg {
  hoursPerSec: number;   // 行军时间：每现实秒推进的游戏小时
  allianceOpenDay: number; // 第几天开放结盟
  pvp: boolean;
  motd: string;
  newbieHours?: number;  // 新手保护时长（小时）
  paused?: boolean;      // 天下静止（GM 暂停时间）
}

export interface OnlineInfo { name: string; nation: FactionId | null; lvl: number }

// ---------- 客户端 → 服务器 ----------
export type C2S =
  | { t: 'register'; name: string; pass: string }
  | { t: 'login'; name: string; pass: string }
  | { t: 'resume'; token: string }
  | { t: 'create'; nation: FactionId; bg: string; heroName?: string }
  | { t: 'invite_ok' }
  | { t: 'nav'; kind: 'point' | 'settlement' | 'party'; x?: number; y?: number; id?: string | number }
  | { t: 'stop' }
  | { t: 'enter'; st: string }
  | { t: 'leave' }
  | { t: 'sync'; data: Partial<PrivatePart>; ps?: number }
  | { t: 'req'; rid: number; op: string; args: any }
  | { t: 'chat'; ch: 'all' | 'nation' | 'pm'; text: string; to?: string }
  | { t: 'gm'; cmd: string; args: string[] }
  | { t: 'ping'; at: number }
  // 实时战斗：d = [x*10, y*10, 朝向*1000, 远程?, 出招序号, 出招方向*1000, 射击序号, 射击方向*1000, 射击距离, 纠正序号, [视野 x,y,w,h]]
  | { t: 'bi'; d: (number | number[])[] }
  | { t: 'bc'; o?: string; f?: string; g?: string; gs?: string[]; mv?: [number, number] }
  | { t: 'bleave' }
  | { t: 'bsync' };

// ---------- 服务器 → 客户端 ----------
export type S2C =
  | { t: 'auth'; ok: boolean; err?: string; token?: string; name?: string; needCreate?: boolean; gm?: boolean }
  | { t: 'welcome'; rec: PRec; partyId: number; world: WorldSnap; parties: NetParty[]; cfg: ServerCfg; gm: boolean; chat: { at: number; who: string; text: string; ch: string }[] }
  | { t: 'world'; time: number; settlements?: Settlement[]; lords?: Lord[]; wars?: string[]; truceUntil?: Record<string, number>; alive?: Record<string, boolean>; treaties?: Treaty[]; customFactions?: Record<string, FactionDef>; wallHp?: number[]; beacons?: WorldSnap['beacons']; chronLog?: WorldSnap['chronLog']; fnames?: Record<string, string> }
  | { t: 'parties'; up: NetParty[]; gone: number[] }
  | { t: 'pos'; time: number; a: number[] } // [id, x*10, y*10, flags] ...
  | { t: 'arrive'; st: string }
  | { t: 'navEnd' }
  | { t: 'encounter'; enemy: number; forced: boolean; eid: number }
  | { t: 'patch'; data: Partial<PrivatePart> & { addGold?: number; x?: number; y?: number; hp?: number; faction?: FactionId }; why?: string; seq?: number }
  | { t: 'god'; god: GodState | null; level: number }
  | { t: 'report'; title: string; lines: string[] }
  | { t: 'res'; rid: number; ok: boolean; data?: any; err?: string }
  | { t: 'chat'; ch: string; who: string; nation?: string | null; text: string; at: number; to?: string }
  | { t: 'log'; msg: string; cls?: string }
  | { t: 'online'; list: OnlineInfo[] }
  | { t: 'cfg'; cfg: ServerCfg }
  | { t: 'gm'; text: string; data?: any }
  | { t: 'kick'; why: string }
  | { t: 'pong'; at: number; srv: number }
  // 实时战斗（另有二进制帧，见 src/battle/wire.ts）
  | { t: 'bstart'; bid: number; init: BattleInit; joined?: boolean; resume?: boolean }
  | { t: 'bspawn'; u: SpawnRow[] }
  | { t: 'bstat'; m: [number, number]; a: [number, number]; tm: number }
  | { t: 'bmsg'; text: string }
  | { t: 'bcorr'; x: number; y: number; cs: number }
  | { t: 'bend'; bid: number; win: boolean; retreat: boolean; out: any; lines: string[]; gold: number }
  | { t: 'bgone'; bid: number }
  | { t: 'battles'; list: BattleMark[] };

/** 单位静态信息：[uid, side, pid, troop, comp, x, y, 标志(1主角 2骑乘 4远程), maxHp, 天命位, 名字, 射程, 弹药] */
export type SpawnRow = [number, 0 | 1, string, string, string, number, number, number, number, number, string, number, number];
export interface BattleInit {
  W: number; H: number; seed: number; terrain: number; night: boolean;
  side: 0 | 1; pid: string; hero: number; cs: number; hx: number; hy: number; hammo: number;
  parties: { pid: string; name: string; side: 0 | 1; faction: string; acct: string | null; online: boolean; look: { w: string; wr: string | null; a: number; c: number } | null; god: number }[];
  sq: [string, string, string, number, number][];
  units: SpawnRow[]; t: number; tick: number;
}
export interface BattleMark { bid: number; x: number; y: number; n: [number, number]; f: [string, string]; names: [string, string] }

// ---------- 官职（按声望） ----------
export const RANK_NAMES = ['白身', '把总', '千总', '守备', '游击', '参将', '副将', '总兵', '提督'];
export const RANK_RENOWN = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5500];
export function rankOf(renown: number) { let r = 0; for (let i = 0; i < RANK_RENOWN.length; i++) if (renown >= RANK_RENOWN[i]) r = i; return r; }
/** 外交门槛 */
export const ENVOY_RENOWN = 150, WAR_RENOWN = 800;

/** 新手保护：注册后这么久（现实毫秒）内不会被玩家截击，除非自己主动出手 */
export const NEWBIE_MS = 2 * 3600 * 1000;
/** 可由 GM 调整（ServerCfg.newbieHours） */
export const NEWBIE = { ms: NEWBIE_MS };
export const newbieLeft = (rec: { created: number; pvpOptIn?: boolean } | undefined, now = Date.now()) =>
  !rec || rec.pvpOptIn ? 0 : Math.max(0, rec.created + NEWBIE.ms - now);
