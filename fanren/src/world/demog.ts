// 第三十七步：修仙界的人口金字塔——敌人的境界由“在哪、是什么人”决定，不再跟着主角的境界走
//
// 原著：炼气满地走，筑基已算一方人物；结丹是宗门长老、一地之主；元婴只在大宗大派坐镇（外加极少数散修老怪）；
// 人界几乎没有化神。乱星海结丹多、元婴少（奇渊岛碧云门二十多位结丹，只一位元婴初期）；大晋灵气浓、高阶修士多些。
// · foeRealm      —— 按当地金字塔掷一个境界（劫修 / 魔修 / 头目 / 首领）
// · threatRealm   —— 冲着你来的人（追杀、寻仇、赏金猎人）：只有自认打得过你的才会来；你境界越高，敢来的越少
// · canAdvance    —— NPC 突破的名额：散修元婴每张图寥寥数人，化神不由 NPC 修成；化神者止步初期
import type { Game } from './game';
import { ACTIVE_MAP, type MapId } from '../data/world';
import { REALMS } from '../data/realms';
import type { NpcData } from './npc';

export type FoeKind = 'rogue' | 'evil' | 'leader' | 'boss' | 'minion';
export interface RS { realm: number; stage: number }

/** 各图修士的境界占比 [凡, 炼气, 筑基, 结丹, 元婴] */
const BASE: Record<MapId, number[]> = {
  tiannan: [0, 0.66, 0.29, 0.047, 0.003],
  luanxing: [0, 0.5, 0.37, 0.12, 0.01],
  dajin: [0, 0.46, 0.38, 0.14, 0.02],
};
/** 散修中元婴的名额（每张图同时在世） */
export const ROGUE_YY_CAP: Record<MapId, number> = { tiannan: 1, luanxing: 2, dajin: 3 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 某处的境界分布：越凶险的地方高阶修士越多（但再凶险，劫修里也难见元婴） */
export function pyramid(map: MapId, k: number, evil = false): number[] {
  const w = BASE[map].slice();
  const s = clamp((k - 2) / 6, 0, 1);
  w[2] *= 1 + s; w[3] *= 1 + 2.5 * s; w[4] *= 1 + 3 * s;
  if (evil) { w[2] *= 1.15; w[3] *= 1.2; }
  return w;
}
function pickW(w: number[], lo: number, hi: number, rnd: () => number): number {
  let tot = 0; for (let r = lo; r <= hi; r++) tot += w[r] ?? 0;
  if (tot <= 0) return lo;
  let x = rnd() * tot;
  for (let r = lo; r <= hi; r++) { x -= w[r] ?? 0; if (x <= 0) return r; }
  return hi;
}
/** 小层：炼气多在前中期；头目、首领偏后期 */
export function stageFor(realm: number, kind: FoeKind, rnd: () => number = Math.random): number {
  const L = REALMS[realm]?.stages.length ?? 1;
  if (L <= 1) return 0;
  const hiK = kind === 'leader' || kind === 'boss';
  const u = hiK ? 0.45 + 0.55 * rnd() : Math.pow(rnd(), 1.35);
  return clamp(Math.floor(u * L), 0, L - 1);
}
function kOf(g: Game, x: number, y: number) { try { return g.combat.dangerCalc(x, y).k; } catch { return 2; } }
function evilZone(g: Game, x: number, y: number) { try { return g.combat.dangerCalc(x, y).region === 'modao'; } catch { return false; } }

/** 按当地金字塔掷境界。lo / hi：额外夹定（例如原著事件里只许结丹以上） */
export function foeRealm(g: Game, x: number, y: number, kind: FoeKind = 'rogue', rnd: () => number = Math.random, lo = 1, hi?: number): RS {
  const w = pyramid(ACTIVE_MAP, kOf(g, x, y), kind === 'evil' || evilZone(g, x, y));
  const cap = Math.min(hi ?? 9, kind === 'boss' ? 4 : 3);   // 劫修、魔修、头目里没有元婴；元婴只当首领出场
  const draws = kind === 'leader' ? 2 : kind === 'boss' ? 3 : 1;
  let realm = lo;
  for (let i = 0; i < draws; i++) realm = Math.max(realm, pickW(w, lo, Math.max(lo, cap), rnd));
  return { realm, stage: stageFor(realm, kind, rnd) };
}

/** 冲着你来的人：只有自认打得过你（境界 ≥ 你）的才会来。
 *  bias：0 只求同阶，1 偏好高你一阶。返回 null = 这一带没有敢来的人 */
export function threatRealm(g: Game, x: number, y: number, min: number, bias = 0, rnd: () => number = Math.random, allowYY = false): RS | null {
  const w = pyramid(ACTIVE_MAP, kOf(g, x, y));
  const cap = allowYY ? 4 : 3;
  const lo = clamp(min, 1, 5);
  if (lo > cap) return null;
  let mass = 0; for (let r = lo; r <= cap; r++) mass += w[r];
  // 散修里够得上的人越少，越难凑出一个肯冒险的
  if (rnd() > Math.min(1, mass / 0.22)) return null;
  const ww = w.slice(); for (let r = lo + 1; r <= cap; r++) ww[r] *= 1 + 3 * bias;
  const realm = pickW(ww, lo, cap, rnd);
  return { realm, stage: stageFor(realm, realm > lo ? 'rogue' : 'leader', rnd) };
}

/** NPC 的境界上限：化神止步初期 */
export function capRealm(d: { realm: number; stage: number }) {
  if (d.realm > 5) d.realm = 5;
  if (d.realm >= 5) d.stage = 0;
}
/** NPC 能否突破到下一大境界（名额制） */
export function canAdvance(list: NpcData[], d: NpcData): boolean {
  const to = d.realm + 1;
  if (to >= 5) return false;                    // 人界的化神不是 NPC 闭关能修出来的
  if (to < 4) return true;
  if (d.canon || d.ros || d.faction === 'sect' || d.faction === 'demon') return true;   // 宗门有底蕴
  const map = d.map ?? 'tiannan';
  let n = 0; for (const o of list) if (o.alive && o.realm >= 4 && !o.canon && !o.ros && o.faction !== 'sect' && o.faction !== 'demon' && (o.map ?? 'tiannan') === map) n++;
  return n < ROGUE_YY_CAP[map];
}

/** 新生散修 / 凡人的境界（按图的金字塔；不含元婴——散修元婴另有名额） */
export function rogueRealmAt(map: MapId, rnd: () => number): number {
  const w = BASE[map];
  return pickW(w, 1, 3, rnd);
}
