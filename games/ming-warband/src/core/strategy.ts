// 国策：各势力的战略层——明廷按威胁调度五大战区，清军伺机入塞，闯军乘虚而起
import type { Party, Settlement } from './state';
import { S, log, player, playerSide, atWar, partyById, settlementList, lordName, genTroops, dayOf } from './game';
import { FACTION } from '../data/world';
import { addTroops, count, healthy } from './party';
import { partyStrength } from './party';
import { regionAt, SEGS, isBreached } from './wall';
import { nearestPassable } from './terrain';
import { chance, pick } from './rng';

// ---------- 明军五大战区 ----------
export interface Theater { id: string; name: string; anchors: string[]; min: number }
export const THEATERS: Theater[] = [
  { id: 'liao', name: '蓟辽', anchors: ['shanhai', 'ningyuan', 'jinzhou', 'xifeng', 'gubei', 'tianjin'], min: 3 },
  { id: 'bian', name: '宣大九边', anchors: ['zhangjia', 'xuanfu', 'datong', 'juyong', 'shahu', 'piantou', 'yulin', 'huama'], min: 3 },
  { id: 'jing', name: '京营', anchors: ['beijing'], min: 2 },
  { id: 'zhong', name: '中原', anchors: ['kaifeng', 'luoyang', 'xian', 'nanyang', 'tongguan', 'ruzhou', 'shangluo', 'xuzhou', 'jinan', 'taiyuan'], min: 3 },
  { id: 'nan', name: '湖广川陕', anchors: ['wuchang', 'xiangyang', 'changsha', 'chengdu', 'chongqing', 'kuizhou', 'hanzhong'], min: 2 },
];
export const THEATER_NAME: Record<string, string> = Object.fromEntries(THEATERS.map(t => [t.id, t.name]));
const ZONE_R = 280;

function anchorsOf(t: Theater): Settlement[] { return t.anchors.map(id => S.settlements[id]).filter(Boolean); }
/** 战区内友方锚点（无则退回全部锚点） */
function homeAnchors(t: Theater, f = 'ming') { const a = anchorsOf(t); const own = a.filter(s => s.faction === f); return own.length ? own : a; }
export function inTheater(t: Theater, x: number, y: number, r = ZONE_R) { return anchorsOf(t).some(s => Math.hypot(s.x - x, s.y - y) < r); }
export function theaterOf(id?: string) { return THEATERS.find(t => t.id === id); }
export function theaterCenter(t: Theater): [number, number] {
  const a = homeAnchors(t); if (!a.length) return [0, 0];
  return [a.reduce((s, x) => s + x.x, 0) / a.length, a.reduce((s, x) => s + x.y, 0) / a.length];
}
const mingLordParties = () => S.parties.filter(p => p.kind === 'lord' && p.faction === 'ming' && p.lordId && S.lords[p.lordId] && !S.lords[p.lordId].dead);
const isPlayerFollower = (p: Party) => p.ai.mode === 'follow' && p.ai.target === player().id;

/** 各战区的威胁值 */
export function theaterThreat(t: Theater): number {
  let th = 0;
  const anchors = anchorsOf(t);
  for (const p of S.parties) {
    if (p.kind !== 'lord' && p.kind !== 'bandit') continue;
    if (p.faction === 'ming' || !(p.kind === 'bandit' || atWar('ming', p.faction))) continue;
    if (!anchors.some(s => Math.hypot(s.x - p.x, s.y - p.y) < ZONE_R + 80)) continue;
    th += partyStrength(S, p) * (p.kind === 'bandit' ? 0.25 : 1);
  }
  for (const s of anchors) {
    if (s.faction !== 'ming' && s.faction !== 'player' && atWar('ming', s.faction)) th += 250 + count(s.garrison) * 2;
    if (s.faction === 'ming' && s.siege) th += 900;
  }
  for (const b of S.beacons ?? []) if (b.until > S.time && anchors.some(s => Math.hypot(s.x - b.x, s.y - b.y) < ZONE_R + 120)) th += 600;
  return th;
}

/** 兵部：按威胁重新分派各镇兵马 */
function mingCourt() {
  if (!S.alive.ming) return;
  const ps = mingLordParties().filter(p => !isPlayerFollower(p));
  if (!ps.length) return;
  // 初次分派：就近
  for (const p of ps) {
    const l = S.lords[p.lordId!];
    if (l.theater && theaterOf(l.theater)) continue;
    let best = THEATERS[0], bd = Infinity;
    for (const t of THEATERS) for (const a of anchorsOf(t)) { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = t; } }
    l.theater = best.id;
  }
  const threat: Record<string, number> = {};
  let total = 0;
  for (const t of THEATERS) { threat[t.id] = theaterThreat(t) + 60; total += threat[t.id]; }
  const n = ps.length, sumMin = THEATERS.reduce((a, t) => a + t.min, 0);
  const spare = Math.max(0, n - sumMin);
  const want: Record<string, number> = {};
  for (const t of THEATERS) want[t.id] = Math.min(t.min, Math.ceil(n * t.min / sumMin)) + Math.round(spare * threat[t.id] / total);
  const have: Record<string, Party[]> = {};
  for (const t of THEATERS) have[t.id] = [];
  for (const p of ps) have[S.lords[p.lordId!].theater!]?.push(p);
  // 从富余最多的战区抽调到缺口最大的战区，每次至多调动 3 路
  for (let k = 0; k < 3; k++) {
    const deficit = THEATERS.map(t => ({ t, d: want[t.id] - have[t.id].length })).sort((a, b) => b.d - a.d);
    const need = deficit[0], extra = deficit[deficit.length - 1];
    if (need.d < 1 || extra.d > -1) break;
    const [cx, cy] = theaterCenter(need.t);
    const cands = have[extra.t.id].filter(p => p.ai.mode !== 'siege' && !(p.ai.mode === 'follow' && p.ai.target !== undefined && partyById(p.ai.target as number)?.faction === 'ming' && isPlayerFollower(partyById(p.ai.target as number)!)))
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const p = cands[0]; if (!p) break;
    const l = S.lords[p.lordId!];
    l.theater = need.t.id;
    have[extra.t.id].splice(have[extra.t.id].indexOf(p), 1); have[need.t.id].push(p);
    p.ai.mode = 'idle'; p.ai.path = []; p.ai.nextThink = S.time; p.inside = undefined;
    const north = need.t.id === 'liao' || need.t.id === 'bian' || need.t.id === 'jing';
    const urgent = threat[need.t.id] > 1500;
    const pp = player();
    if (playerSide() === 'ming' || Math.hypot(pp.x - p.x, pp.y - p.y) < 600 || urgent)
      log(north && urgent ? `兵部急檄：${l.title}${l.name}率部星夜北上，驰援${need.t.name}！` : north ? `${l.title}${l.name}奉调移防${need.t.name}。` : `${l.title}${l.name}奉旨赴${need.t.name}剿寇。`, urgent ? 'war' : 'dim');
  }
}

/** 明军领主在战区之外时，先赶赴战区（供 thinkLord 调用；返回目标点或 null） */
export function theaterMarch(p: Party): Settlement | null {
  if (p.faction !== 'ming' || !p.lordId) return null;
  const t = theaterOf(S.lords[p.lordId]?.theater); if (!t) return null;
  if (inTheater(t, p.x, p.y, ZONE_R + 60)) return null;
  const a = homeAnchors(t); if (!a.length) return null;
  return a.sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
}
/** 战区内可作为目标的点（离战区太远的目标不去） */
export function theaterAllows(p: Party, x: number, y: number) {
  if (p.faction !== 'ming' || !p.lordId) return true;
  const t = theaterOf(S.lords[p.lordId]?.theater); if (!t) return true;
  return inTheater(t, x, y, ZONE_R + 260);
}

// ---------- 召集：把远处的同袍调来合兵 ----------
export function summon(leader: Party, n: number, radius = 1100): Party[] {
  const reg = regionAt(leader.x, leader.y);
  const cands = S.parties.filter(p => p !== leader && p.kind === 'lord' && p.faction === leader.faction && !p.inside && p.ai.mode !== 'follow' && p.ai.mode !== 'siege'
    && healthy(p.troops) > 20 && Math.hypot(p.x - leader.x, p.y - leader.y) < radius && (!reg || regionAt(p.x, p.y) === reg))
    .sort((a, b) => Math.hypot(a.x - leader.x, a.y - leader.y) - Math.hypot(b.x - leader.x, b.y - leader.y)).slice(0, n);
  for (const p of cands) { p.ai.mode = 'follow'; p.ai.target = leader.id; p.ai.until = S.time + 24 * 14; p.ai.path = []; p.ai.nextThink = S.time; }
  return cands;
}
export function strengthOf(f: string, filter: (p: Party) => boolean = () => true) {
  let s = 0; for (const p of S.parties) if (p.kind === 'lord' && p.faction === f && filter(p)) s += partyStrength(S, p); return s;
}
export function mingNorthStrength() {
  const zones = THEATERS.filter(t => t.id === 'liao' || t.id === 'bian' || t.id === 'jing');
  return strengthOf('ming', p => zones.some(t => inTheater(t, p.x, p.y, ZONE_R + 80)));
}

// ---------- 清：伺机入塞 ----------
export interface RaidPlan { lead: string; seg: number; at: number }
function qingThink() {
  if (!S.alive.jin || !S.alive.ming) return;
  const f = (S.flags ||= {});
  const day = dayOf(S.time);
  if (f.raidPlan) return; // 入塞行动中（由 calendar 跟进）
  if (f.raiders || !atWar('jin', 'ming') || day < 50) return; // 开局五十日内八旗不入塞
  if (S.time - Number(f.lastRaid ?? -1e9) < 24 * 28) return;
  const outside = (p: Party) => regionAt(p.x, p.y) === 2;
  const jinOut = strengthOf('jin', outside);
  const mingN = mingNorthStrength();
  // 关外兵强、关内边防空虚时才动手（越空虚越可能）
  const ratio = jinOut / Math.max(300, mingN);
  if (ratio < 0.6 || !chance(Math.min(0.5, 0.15 * ratio))) return;
  const leads = S.parties.filter(p => p.kind === 'lord' && p.faction === 'jin' && outside(p) && p.ai.mode !== 'siege' && healthy(p.troops) > 40).sort((a, b) => partyStrength(S, b) - partyStrength(S, a));
  const lead = leads[0]; if (!lead) return;
  // 选择明军防备最薄弱的一段边墙
  const ming = S.parties.filter(p => p.kind === 'lord' && p.faction === 'ming');
  const cands = SEGS.map((sg, k) => ({ sg, k })).filter(({ sg, k }) => sg.gate < 0 && !isBreached(k) && Math.hypot(sg.x - lead.x, sg.y - lead.y) < 1300);
  if (!cands.length) return;
  let best = cands[0], bs = -Infinity;
  for (const c of cands.length > 10 ? Array.from({ length: 10 }, () => pick(cands)) : cands) {
    const guard = Math.min(...ming.map(p => Math.hypot(p.x - c.sg.x, p.y - c.sg.y)), 2000);
    const s = guard - Math.hypot(c.sg.x - lead.x, c.sg.y - lead.y) * 0.3;
    if (s > bs) { bs = s; best = c; }
  }
  const sg = best.sg;
  let stand: [number, number] | null = null;
  for (const side of [1, -1]) { const [x, y] = nearestPassable(sg.x + sg.nx * 26 * side, sg.y + sg.ny * 26 * side); if (regionAt(x, y) === 2) { stand = [x, y]; break; } }
  if (!stand) return;
  lead.ai.mode = 'breach'; lead.ai.target = best.k; lead.ai.until = undefined; lead.ai.tx = stand[0]; lead.ai.ty = stand[1]; lead.ai.path = []; lead.ai.nextThink = S.time;
  summon(lead, 3, 1400);
  f.raidPlan = JSON.stringify({ lead: lead.lordId, seg: best.k, at: S.time } as RaidPlan);
  if (playerSide() === 'ming' || chance(0.5)) log(`细作来报：关外八旗正在${FACTION.jin.name}${lordName(lead.lordId!)}麾下集结，似有入塞之意。`, 'warn');
}

// ---------- 闯：乘虚而起、直取北京 ----------
function chuangThink() {
  if (!S.alive.chuang) return;
  const f = (S.flags ||= {});
  if (f.jinjing || !S.alive.ming) return;
  const bj = S.settlements.beijing; if (!bj || bj.faction !== 'ming' || bj.siege) return;
  const ch = strengthOf('chuang');
  const mingAll = strengthOf('ming');
  const near = settlementList().filter(s => s.faction === 'chuang' && s.kind !== 'village' && Math.hypot(s.x - bj.x, s.y - bj.y) < 1000);
  if (!near.length || ch < mingAll * 0.75 || dayOf(S.time) < 120 || !chance(0.2)) return;
  const lead = S.parties.filter(p => p.kind === 'lord' && p.faction === 'chuang' && regionAt(p.x, p.y) === 1).sort((a, b) => partyStrength(S, b) - partyStrength(S, a))[0];
  if (!lead) return;
  lead.ai.mode = 'siege'; lead.ai.target = 'beijing'; lead.ai.path = []; lead.ai.nextThink = S.time; lead.ai.until = undefined;
  summon(lead, 4, 1400);
  f.jinjing = S.time;
  f.jinjingLead = lead.lordId ?? '';
}

/** 国力：各势力的兵源补充。明廷财政逐年崩坏；八旗兵源稳定；闯营随饥荒壮大 */
function vigor() {
  const y = Math.max(0, (S.time / 24) / 36);
  const fam = calYearFamine();
  const V: Record<string, [number, number]> = {
    ming: [140, Math.max(0.12, 0.42 - y * 0.035)],
    jin: [210, 0.62],
    chuang: [170, 0.22 + fam * 0.45],
    xi: [150, 0.3 + fam * 0.15],
    mon: [130, 0.3],
  };
  for (const p of S.parties) {
    if (p.kind !== 'lord' || p.inside) continue;
    const v = V[p.faction]; if (!v) continue;
    if (count(p.troops) < v[0] && chance(v[1])) for (const t of genTroops(FACTION[p.faction].culture, 3 + Math.floor(Math.random() * 4), p.faction === 'jin' ? 0.55 : 0.4)) addTroops(p.troops, t.id, t.n);
  }
}
function calYearFamine() { const yr = 1635 + Math.floor(dayOf(S.time) / 36); return yr >= 1638 && yr <= 1643 ? 0.8 : yr >= 1636 ? 0.4 : 0.2; }

export function strategyDaily() {
  const day = dayOf(S.time);
  vigor();
  if (day % 3 === 1) mingCourt();
  qingThink();
  if (day % 2 === 0) chuangThink();
}
