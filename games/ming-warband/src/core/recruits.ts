// 兵源池：村庄 / 蒙古包里愿意从军的青壮。
// 单机：每日补充（旧规则）。联机服务器：RECRUIT.realtime = true，按真实秒数增长（每村每秒 1 人、上限 60），
// 全服共享、先到先得——AI 领主也得从自家村庄的兵源里招兵。
import type { Party, Settlement, Stack } from './state';
import { S, settlementList, genTroops } from './game';
import { addTroops } from './party';
import { FACTION, CAMP_RECRUIT, CAMP_RECRUIT_GOOD } from '../data/world';
import { RECRUIT_OF } from '../data/troops';
import { randInt } from './rng';

export const RECRUIT = {
  realtime: false,
  perSec: 1, cap: 60,          // 村庄
  campPerSec: 1, campCap: 60,  // 蒙古包
  relationBonus: 0.02,         // 每点关系 +2% 增速（负关系减速，最低 30%）
  daily: { min: 1, max: 4, cap: 15 },
  lordDraw: 10,                // 联机：AI 领主每日最多从每个村庄带走的人数
};

export function recruitCap(s: Settlement) { return RECRUIT.realtime ? (s.camp ? RECRUIT.campCap : RECRUIT.cap) : RECRUIT.daily.cap; }

/** 联机：按真实经过秒数补充兵源（由服务器主循环调用） */
export function tickRecruits(sec: number) {
  if (!RECRUIT.realtime || sec <= 0) return;
  for (const s of settlementList()) {
    if (s.kind !== 'village') continue;
    if (s.lootedUntil > S.time) continue; // 刚被洗劫的村子没人可招
    const cap = recruitCap(s);
    if (s.recruits >= cap) { s.racc = 0; continue; }
    const rate = (s.camp ? RECRUIT.campPerSec : RECRUIT.perSec) * Math.max(0.3, 1 + s.relation * RECRUIT.relationBonus);
    const acc = (s.racc ?? 0) + rate * sec;
    const whole = Math.floor(acc);
    s.recruits = Math.min(cap, s.recruits + whole);
    s.racc = acc - whole;
  }
}

/** 单机：每日补充 */
export function dailyRecruits() {
  if (RECRUIT.realtime) return;
  const d = RECRUIT.daily;
  for (const s of settlementList()) if (s.kind === 'village') s.recruits = Math.min(d.cap, s.recruits + randInt(d.min, d.max) + Math.max(0, Math.floor(s.relation / 15)));
}

/** 某村庄招来的兵种（玩家与 AI 通用）。蒙古包只出骑兵 */
export function recruitTroopOf(s: Settlement, culture?: string, relation = s.relation) {
  if (s.camp) return relation >= 15 ? CAMP_RECRUIT_GOOD : CAMP_RECRUIT;
  return RECRUIT_OF[culture ?? FACTION[s.faction]?.culture ?? 'ming'] ?? 'ming_recruit';
}

/** AI 领主驻城时补兵。单机：凭空生成（旧规则）；联机：从该城下辖及附近自家村庄的兵源里带走 */
export function lordReinforce(p: Party, s: Settlement) {
  if (!RECRUIT.realtime) {
    for (const t of genTroops(FACTION[p.faction].culture, randInt(5, 10), 0.35)) addTroops(p.troops, t.id, t.n);
    return;
  }
  const vills = s.villages.map(id => S.settlements[id]).filter(v => v && v.faction === p.faction && v.recruits > 0);
  for (const v of vills) {
    const n = Math.min(v.recruits, RECRUIT.lordDraw);
    v.recruits -= n;
    addTroops(p.troops, recruitTroopOf(v, FACTION[p.faction].culture, 20), n);
  }
}
export type { Stack };
