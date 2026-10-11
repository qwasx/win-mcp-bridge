// 联机：玩家自立（称王 / 称帝）、招揽其他玩家入伙
import { S, setWar, atWar, log, settlementList } from '../src/core/game';
import { setOwner, checkFactionAlive, EXILE_DAYS } from '../src/core/combat';
import { healthy } from '../src/core/party';
import { FACTION, MAJOR_FACTIONS, type FactionDef, type FactionId } from '../src/data/world';
import type { PRec } from '../src/net/protocol';
import { heroOf, OUT } from './world';

export const INDEP = { renown: 300, troops: 50, fiefs: 1, emperorCities: 6 };
const ANCIENT = ['beijing', 'nanjing', 'xian', 'luoyang']; // 古都：正统加成
const BAD = ['习', '共产', '法轮', '六四', '台独', '藏独', '疆独'];

/** 世界载入 / 客户端收到快照时：把玩家建立的国家写回 FACTION 表 */
export function installCustomFactions(defs: Record<string, FactionDef> | undefined) {
  for (const [id, d] of Object.entries(defs ?? {})) FACTION[id] = d;
}

export const fiefsOfAcct = (acct: string) => settlementList().filter(s => s.owner === 'P:' + acct);

export function indepCheck(rec: PRec): string | null {
  if (!rec.nation) return '你尚未效忠任何国家';
  if (rec.nation.startsWith('p_') && FACTION[rec.nation]?.ruler === rec.name) return '你已是一国之主';
  const fiefs = fiefsOfAcct(rec.name).filter(s => s.kind !== 'village');
  if (fiefs.length < INDEP.fiefs) return `需要至少 ${INDEP.fiefs} 座城堡或城镇作为根基（攻下一座城即可）`;
  if (rec.renown < INDEP.renown) return `声望不足 ${INDEP.renown}，振臂一呼也无人响应`;
  const p = heroOf(rec.name);
  if (!p || healthy(p.troops) < INDEP.troops) return `麾下至少要有 ${INDEP.troops} 名可战之兵`;
  return null;
}

export function declareIndependence(rec: PRec, a: { name: string; ch: string; color: string; capital: string; era?: string }): { ok: boolean; err?: string; data?: any } {
  const why = indepCheck(rec);
  if (why) return { ok: false, err: why };
  const name = String(a.name ?? '').trim();
  const ch = String(a.ch ?? '').trim().slice(0, 1) || name.slice(-1);
  if (!/^[\u4e00-\u9fa5]{1,4}$/.test(name)) return { ok: false, err: '国号须为 1~4 个汉字' };
  if (!/^[\u4e00-\u9fa5]$/.test(ch)) return { ok: false, err: '旗字须为 1 个汉字' };
  if (BAD.some(w => name.includes(w) || ch.includes(w))) return { ok: false, err: '国号不合适' };
  if (Object.values(FACTION).some(f => f.name === name)) return { ok: false, err: '这个国号已经有人用了' };
  const color = /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : '#d4af37';
  const fiefs = fiefsOfAcct(rec.name);
  const capital = fiefs.find(s => s.id === a.capital && s.kind !== 'village') ?? fiefs.find(s => s.kind === 'town') ?? fiefs.find(s => s.kind !== 'village')!;
  S.flags ??= {};
  const n = Number(S.flags.customN ?? 0) + 1; S.flags.customN = n;
  const id = `p_${n}` as FactionId;
  const old = rec.nation!;
  const def: FactionDef = {
    id, name, color: parseInt(color.slice(1), 16), css: color, culture: FACTION[old]?.culture ?? 'ming', ruler: rec.name, rulerTitle: '王', capital: capital.id,
    desc: `${rec.name}于${capital.name}起兵自立，国号“${name}”${a.era ? `，建元“${String(a.era).slice(0, 4)}”` : ''}。`,
  };
  S.customFactions ??= {};
  S.customFactions[id] = def;
  FACTION[id] = def;
  S.alive[id] = true;
  for (const s of fiefs) if (s.kind !== 'village') setOwner(s, id, 'P:' + rec.name);
  for (const s of fiefs) if (s.kind === 'village') { s.faction = id; }
  const p = heroOf(rec.name);
  if (p) p.faction = id;
  rec.nation = id; rec.rank = 99;
  rec.playerRel[old] = Math.min(rec.playerRel[old] ?? 0, -40);
  setWar(id, old, true); // 故主兴师问罪
  // 称王：其他 AI 国家态度不一
  for (const f of MAJOR_FACTIONS) if (f !== old && S.alive[f] && atWar(f, old) && Math.random() < 0.5) { S.truceUntil[[f, id].sort().join('|')] = S.time + 24 * 10; }
  (S.chronLog ??= []).push({ n: `${rec.name}自立为${name}王`, at: S.time });
  log(`【天下震动】${rec.name}于${capital.name}自立为王，国号“${name}”！${FACTION[old]?.name ?? ''}兴兵讨伐。`, 'event');
  OUT.broadcast({ t: 'chat', ch: 'gm', who: '天下', text: `${rec.name}于${capital.name}自立为王，国号“${name}”！`, at: Date.now() });
  return { ok: true, data: { id, def } };
}

export function proclaimEmperor(rec: PRec): { ok: boolean; err?: string } {
  const f = rec.nation;
  if (!f || !f.startsWith('p_') || FACTION[f]?.ruler !== rec.name) return { ok: false, err: '须先自立为王' };
  if (FACTION[f].rulerTitle === '皇帝') return { ok: false, err: '你已是皇帝' };
  const cities = settlementList().filter(s => s.faction === f && s.kind !== 'village').length;
  if (cities < INDEP.emperorCities) return { ok: false, err: `城池须达 ${INDEP.emperorCities} 座方可称帝（现有 ${cities}）` };
  const legit = settlementList().filter(s => s.faction === f && ANCIENT.includes(s.id)).map(s => s.name);
  FACTION[f].rulerTitle = '皇帝';
  S.customFactions![f].rulerTitle = '皇帝';
  S.flags ??= {}; S.flags['legit_' + f] = legit.length;
  (S.chronLog ??= []).push({ n: `${rec.name}称帝，国号${FACTION[f].name}`, at: S.time });
  log(`【改天换地】${rec.name}登基称帝，国号“${FACTION[f].name}”！${legit.length ? `坐拥古都${legit.join('、')}，天下归心者众。` : ''}`, 'event');
  // 树大招风：各国可能宣战
  for (const o of MAJOR_FACTIONS) if (S.alive[o] && !atWar(o, f) && Math.random() < (legit.length ? 0.25 : 0.4)) { setWar(o, f, true); delete S.truceUntil[[o, f].sort().join('|')]; log(`${FACTION[o].name}不认新朝，对${FACTION[f].name}宣战！`, 'event'); }
  OUT.broadcast({ t: 'chat', ch: 'gm', who: '天下', text: `${rec.name}登基称帝，国号“${FACTION[f].name}”！`, at: Date.now() });
  return { ok: true };
}

/** 国主招揽：邀请 / 接受 */
const invites = new Map<string, { from: string; faction: FactionId; at: number }>();
export function invite(rec: PRec, target: string, targetRec: PRec | undefined): { ok: boolean; err?: string } {
  const f = rec.nation;
  if (!f || FACTION[f]?.ruler !== rec.name) return { ok: false, err: '只有国主才能招揽' };
  if (!targetRec) return { ok: false, err: '对方不在线' };
  if (targetRec.nation === f) return { ok: false, err: '对方已是你的臣属' };
  invites.set(target, { from: rec.name, faction: f, at: Date.now() });
  OUT.send(target, { t: 'gm', text: `INVITE|${rec.name}|${f}|${FACTION[f].name}` });
  return { ok: true };
}
export function acceptInvite(rec: PRec): { ok: boolean; err?: string; data?: any } {
  const iv = invites.get(rec.name);
  if (!iv || Date.now() - iv.at > 5 * 60 * 1000 || !S.alive[iv.faction]) return { ok: false, err: '邀请已失效' };
  invites.delete(rec.name);
  const old = rec.nation;
  rec.nation = iv.faction;
  const p = heroOf(rec.name); if (p) p.faction = iv.faction;
  for (const s of fiefsOfAcct(rec.name)) setOwner(s, iv.faction, 'P:' + rec.name);
  if (old && old !== iv.faction && !old.startsWith('p_')) rec.playerRel[old] = Math.min(rec.playerRel[old] ?? 0, -20);
  log(`${rec.name}投奔${FACTION[iv.faction].name}，归于${iv.from}麾下。`, 'event');
  return { ok: true, data: { faction: iv.faction, def: FACTION[iv.faction] } };
}

/** 每隔几秒：玩家国家的流亡计时（失城 → 流亡 → 光复 / 断绝） */
export function kingdomTick() {
  for (const id of Object.keys(S.customFactions ?? {})) if (S.alive[id]) checkFactionAlive(id);
}
/** 流亡剩余日数（未流亡返回 null） */
export function exileLeft(f: string): number | null {
  const cf = S.customFactions?.[f];
  return cf?.exileSince == null ? null : Math.max(0, Math.ceil(EXILE_DAYS - (S.time - cf.exileSince) / 24));
}
