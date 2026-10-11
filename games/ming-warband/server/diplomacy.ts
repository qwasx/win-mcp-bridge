// 联机外交：结盟 / 停战 / 议和 / 宣战 / 称臣（藩属）
// 中期（默认第 2 年）开放；AI 国家按实力、共同敌人、关系、背盟记录自行结盟，玩家可作为使节牵线。
import { S, setWar, atWar, log, settlementList } from '../src/core/game';
import { healthy } from '../src/core/party';
import { FACTION, MAJOR_FACTIONS, type FactionId } from '../src/data/world';
import type { Treaty } from '../src/core/state';
import { warKey } from '../src/core/state';
import { CFG } from './world';

export const DIPLO = {
  allianceDays: 72,      // 盟约期限（游戏日）
  truceDays: 15,
  vassalDays: 108,
  cooldownDays: 20,      // 盟约结束 / 被拒后的冷却
  betrayDays: 120,       // 背盟记录持续
  aiAllianceChance: 0.05,
  joinWarChance: 0.2,
};

const day = () => Math.floor(S.time / 24);
const fname = (f: string) => FACTION[f]?.name ?? f;

export function treatyBetween(a: string, b: string, type?: Treaty['type']): Treaty | undefined {
  return (S.treaties ?? []).find(t => ((t.a === a && t.b === b) || (t.a === b && t.b === a)) && (!type || t.type === type));
}
export function alliesOf(f: string): FactionId[] {
  return (S.treaties ?? []).filter(t => t.type === 'alliance' && (t.a === f || t.b === f)).map(t => (t.a === f ? t.b : t.a));
}
export function overlordOf(f: string): FactionId | null { const t = (S.treaties ?? []).find(t => t.type === 'vassal' && t.b === f); return t ? t.a : null; }

/** 国力：城池（城镇算 3）与领主兵力 */
export function power(f: string) {
  let p = 0;
  for (const s of settlementList()) if (s.faction === f) p += s.kind === 'town' ? 3 : s.kind === 'castle' ? 1.5 : 0.3;
  for (const pt of S.parties) if (pt.faction === f && (pt.kind === 'lord' || pt.kind === 'hero')) p += healthy(pt.troops) / 80;
  return p;
}
const enemiesOf = (f: string) => MAJOR_FACTIONS.filter(o => o !== f && S.alive[o] && atWar(f, o));
const betrayedRecently = (f: string) => ((S.flags?.['betray_' + f] as number) ?? -1e9) > S.time - DIPLO.betrayDays * 24;
const cooling = (a: string, b: string) => ((S.flags?.['dcool_' + warKey(a, b)] as number) ?? 0) > S.time;
function setCool(a: string, b: string, days = DIPLO.cooldownDays) { S.flags ??= {}; S.flags['dcool_' + warKey(a, b)] = S.time + days * 24; }

export function makeTreaty(a: FactionId, b: FactionId, type: Treaty['type'], days: number, why = '') {
  S.treaties ??= [];
  S.treaties = S.treaties.filter(t => !((t.a === a && t.b === b) || (t.a === b && t.b === a)));
  const until = S.time + days * 24;
  S.treaties.push({ a, b, type, since: S.time, until });
  setWar(a, b, false);
  S.truceUntil[warKey(a, b)] = Math.max(S.truceUntil[warKey(a, b)] ?? 0, until);
  const what = type === 'alliance' ? `缔结盟约（${days} 日）` : type === 'truce' ? `停战 ${days} 日` : `称臣，${fname(b)}成为${fname(a)}的藩属`;
  log(`${fname(a)}与${fname(b)}${what}${why ? '——' + why : ''}。`, 'event');
}

/** 背盟：一方对盟友/宗主宣战 */
export function breakTreaty(by: FactionId, other: FactionId) {
  const t = treatyBetween(by, other);
  if (!t) return;
  S.treaties = (S.treaties ?? []).filter(x => x !== t);
  delete S.truceUntil[warKey(by, other)];
  S.flags ??= {};
  S.flags['betray_' + by] = S.time;
  S.flags['revenge_' + other + '_' + by] = S.time + 60 * 24; // 被背叛方获得复仇加成
  setCool(by, other, DIPLO.betrayDays);
  setWar(by, other, true);
  log(`${fname(by)}背弃盟约，向${fname(other)}开战！天下侧目。`, 'event');
}

/** 评估提议（AI 国家决定是否接受）。返回 0~1 的意愿 */
export function willingness(from: FactionId, to: FactionId, type: 'alliance' | 'truce' | 'peace' | 'vassal'): { w: number; why: string } {
  if (from === to || !S.alive[to] || !S.alive[from]) return { w: 0, why: '无从谈起' };
  if (cooling(from, to)) return { w: 0, why: '刚谈崩不久，对方不愿再见使者' };
  const pf = power(from), pt = power(to);
  const ef = enemiesOf(from), et = enemiesOf(to);
  const common = ef.filter(x => et.includes(x));
  const commonThreat = common.reduce((s, x) => s + power(x), 0);
  let w = 0, why = '';
  if (type === 'alliance') {
    if (atWar(from, to)) return { w: 0, why: '两国正在交战，先议和再说' };
    if (day() < CFG.allianceOpenDay) return { w: 0, why: `天下初乱，各国尚无结盟之心（第 ${CFG.allianceOpenDay} 日后开放）` };
    w = 0.1 + Math.min(0.6, commonThreat / Math.max(10, pf + pt) * 0.8);
    if (common.length) why = `同仇敌忾（共同的敌人：${common.map(fname).join('、')}）`;
    if ((from === 'ming' && (to === 'chuang' || to === 'xi')) || (to === 'ming' && (from === 'chuang' || from === 'xi'))) { w -= 0.25; why += '；官军与流寇积怨甚深'; }
    if ((from === 'jin' && to === 'mon') || (from === 'mon' && to === 'jin')) w += 0.15;
    if (betrayedRecently(from)) { w -= 0.35; why += '；对方记得你国背盟之事'; }
    if (alliesOf(to).length >= 2) w -= 0.2;
  } else if (type === 'truce' || type === 'peace') {
    if (!atWar(from, to)) return { w: 0, why: '两国并未交战' };
    const ratio = pf / Math.max(1, pt);
    w = 0.15 + (ratio - 1) * 0.25 + Math.max(0, et.length - 1) * 0.15; // 对方四面受敌或我方更强时更愿停战
    if (((S.flags?.['revenge_' + to + '_' + from] as number) ?? 0) > S.time) { w -= 0.4; why = '对方誓报背盟之仇'; }
    if (type === 'peace') w -= 0.1;
    why ||= ratio > 1.3 ? '对方畏惧我国兵威' : et.length > 1 ? '对方四面受敌' : '对方犹豫不决';
  } else if (type === 'vassal') {
    // from 想让 to 称臣
    const ratio = pf / Math.max(1, pt);
    w = ratio > 3 ? 0.2 + Math.min(0.5, (ratio - 3) * 0.1) + (et.length > 1 ? 0.2 : 0) : 0;
    why = ratio > 3 ? '国力悬殊' : '对方尚不至于称臣';
  }
  return { w: Math.max(0, Math.min(0.95, w)), why };
}

/** 玩家作为使节提议（renown 越高越有分量，礼金也有帮助） */
export function propose(envoyName: string, envoyRenown: number, from: FactionId, to: FactionId, type: 'alliance' | 'truce' | 'peace' | 'vassal' | 'war', gift: number): { ok: boolean; msg: string } {
  if (type === 'war') {
    if (!S.alive[to] || from === to) return { ok: false, msg: '无从宣战' };
    if (atWar(from, to)) return { ok: false, msg: '已在交战' };
    if (envoyRenown < 800) return { ok: false, msg: '你的声望不足 800，朝廷不会因你一言而开战' };
    const t = treatyBetween(from, to);
    if (t) breakTreaty(from, to); else { setWar(from, to, true); log(`在${envoyName}的力主之下，${fname(from)}向${fname(to)}宣战！`, 'event'); }
    return { ok: true, msg: '宣战诏书已下' };
  }
  if (envoyRenown < 150) return { ok: false, msg: '你声望不足 150，对方不肯接见' };
  const { w, why } = willingness(from, to, type);
  const bonus = Math.min(0.25, envoyRenown / 8000) + Math.min(0.2, gift / 20000);
  const roll = Math.random();
  if (w > 0 && roll < w + bonus) {
    if (type === 'alliance') makeTreaty(from, to, 'alliance', DIPLO.allianceDays, `${envoyName}出使促成`);
    else if (type === 'truce') makeTreaty(from, to, 'truce', DIPLO.truceDays, `${envoyName}出使促成`);
    else if (type === 'peace') { setWar(from, to, false); S.truceUntil[warKey(from, to)] = S.time + DIPLO.truceDays * 24; log(`${envoyName}奔走斡旋，${fname(from)}与${fname(to)}罢兵议和。`, 'event'); }
    else if (type === 'vassal') makeTreaty(from, to, 'vassal', DIPLO.vassalDays, `${envoyName}恩威并施`);
    return { ok: true, msg: `对方应允了。（${why}）` };
  }
  setCool(from, to, 6);
  return { ok: false, msg: `对方婉拒了。（${why || '时机未到'}）` };
}

let acc = 0;
export function tickDiplomacy(realSec: number) {
  acc += realSec * CFG.hoursPerSec;
  if (acc < 24) return;
  acc = 0;
  S.treaties ??= [];
  // 到期
  for (const t of [...S.treaties]) if (t.until <= S.time) {
    S.treaties = S.treaties.filter(x => x !== t);
    setCool(t.a, t.b);
    log(`${fname(t.a)}与${fname(t.b)}的${t.type === 'alliance' ? '盟约' : t.type === 'truce' ? '停战之约' : '宗藩关系'}到期了。`, 'event');
  }
  for (const t of [...S.treaties]) if (!S.alive[t.a] || !S.alive[t.b]) S.treaties = S.treaties.filter(x => x !== t);
  // 盟国、藩属随同参战（联军）
  for (const t of S.treaties) {
    if (t.type === 'truce') continue;
    const pairs: [FactionId, FactionId][] = t.type === 'alliance' ? [[t.a, t.b], [t.b, t.a]] : [[t.a, t.b]];
    for (const [lead, follow] of pairs) for (const x of enemiesOf(lead)) {
      if (x === follow || atWar(follow, x) || treatyBetween(follow, x)) continue;
      if (Math.random() < (t.type === 'vassal' ? 0.5 : DIPLO.joinWarChance)) { setWar(follow, x, true); log(`${fname(follow)}应${t.type === 'vassal' ? '宗主' : '盟友'}${fname(lead)}之约，对${fname(x)}宣战。`, 'event'); }
    }
  }
  if (day() < CFG.allianceOpenDay) return;
  // AI 自主外交
  const alive = MAJOR_FACTIONS.filter(f => S.alive[f]);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    if (treatyBetween(a, b) || cooling(a, b)) continue;
    if (!atWar(a, b)) {
      const { w } = willingness(a, b, 'alliance');
      if (Math.random() < w * DIPLO.aiAllianceChance) makeTreaty(a, b, 'alliance', DIPLO.allianceDays);
    } else {
      const strong = power(a) > power(b) ? a : b, weak = strong === a ? b : a;
      const vw = willingness(strong, weak, 'vassal').w;
      if (vw > 0 && Math.random() < vw * 0.03) makeTreaty(strong, weak, 'vassal', DIPLO.vassalDays, `${fname(weak)}力不能支`);
    }
  }
}
