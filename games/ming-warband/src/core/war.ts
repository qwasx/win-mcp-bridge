// 合军：多支部队并肩作战、伤亡分摊、AI 军团
import type { Party, Settlement, Stack } from './state';
import { S, player, hostile, partyById, lordName, log, playerSide, atWar, removeParty, fortMult } from './game';
import { FACTION } from '../data/world';
import { TROOPS } from '../data/troops';
import { healthy, removeTroops, cleanStacks } from './party';
import { autoResolve, type Casualties } from './combat';
import { chance } from './rng';

export interface Part { pid: string; stacks: Stack[] }

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** 按各部可战人数把一份总伤亡分摊到各部 */
export function splitDown(down: Casualties, parts: Part[]): Record<string, Casualties> {
  const out: Record<string, Casualties> = {};
  for (const p of parts) out[p.pid] = {};
  for (const id in down) {
    let left = down[id];
    const avail = parts.map(p => ({ p, n: p.stacks.filter(s => s.id === id).reduce((a, s) => a + s.n - s.w, 0) })).filter(x => x.n > 0);
    let total = avail.reduce((a, x) => a + x.n, 0);
    for (const x of avail) {
      if (left <= 0 || total <= 0) break;
      const k = Math.min(x.n, Math.round((left * x.n) / total));
      if (k > 0) out[x.p.pid][id] = (out[x.p.pid][id] || 0) + k;
      left -= k; total -= x.n;
    }
    if (left > 0 && avail.length) { const x = avail[0]; out[x.p.pid][id] = (out[x.p.pid][id] || 0) + left; }
  }
  return out;
}

export function mergeStacks(parts: Part[]): Stack[] {
  const m = new Map<string, Stack>();
  for (const p of parts) for (const s of p.stacks) {
    const e = m.get(s.id);
    if (e) { e.n += s.n; e.w += s.w; } else m.set(s.id, { ...s });
  }
  return [...m.values()];
}

/** 跟随某部的部队（军团成员） */
export function followersOf(leader: Party, r = 90): Party[] {
  return S.parties.filter(p => p !== leader && p.ai.mode === 'follow' && p.ai.target === leader.id && !p.inside && d2(p, leader) < r);
}
/** 军团：主将 + 附近随行诸部 */
export function armyOf(p: Party, r = 90): Party[] { return [p, ...followersOf(p, r)]; }

/** 在玩家附近、愿意与玩家并肩作战的部队 */
export function friendlyNear(enemy: Party | null, r = 75): Party[] {
  const pp = player();
  const side = playerSide();
  const out: Party[] = [];
  for (const p of S.parties) {
    if (p === pp || p.inside || healthy(p.troops) <= 0 || d2(p, pp) > (p.ai.mode === 'follow' && p.ai.target === pp.id ? 140 : r)) continue;
    if (p.kind !== 'lord') continue;
    if (enemy && p === enemy) continue;
    if (hostile(pp, p)) continue;
    const mine = p.ai.mode === 'follow' && p.ai.target === pp.id;
    const sameSide = !!side && p.faction === side;
    const common = !!enemy && enemy.faction !== 'bandit' && atWar(p.faction, enemy.faction);
    const vsBandit = !!enemy && enemy.faction === 'bandit' && sameSide;
    if (mine || (sameSide && (!enemy || hostile(p, enemy))) || common || vsBandit) out.push(p);
  }
  return out.slice(0, 6);
}

/** 在敌军附近、会一同参战的敌方部队 */
export function hostileNear(enemy: Party, r = 75): Party[] {
  const pp = player();
  const out: Party[] = [];
  for (const p of S.parties) {
    if (p === pp || p === enemy || p.inside || healthy(p.troops) <= 0) continue;
    if (!hostile(pp, p)) continue;
    const linked = (p.ai.mode === 'follow' && p.ai.target === enemy.id) || (enemy.ai.mode === 'follow' && enemy.ai.target === p.id);
    if (!linked && d2(p, pp) > r) continue;
    if (p.faction !== enemy.faction && !(p.kind === 'lord' && enemy.kind === 'lord' && !atWar(p.faction, enemy.faction))) continue;
    if (p.kind !== enemy.kind && !(p.kind === 'lord' && enemy.kind === 'lord')) continue;
    out.push(p);
  }
  return out.slice(0, 5);
}

/** 城中驻扎、会协助守城的领主部队 */
export function lordsInside(st: Settlement): Party[] {
  return S.parties.filter(p => p.kind === 'lord' && p.inside === st.id && p.faction === st.faction && healthy(p.troops) > 0).slice(0, 3);
}

/** 按 downBy 结算友军部队伤亡（约四分之三阵亡，其余负伤） */
export function applyPartyLosses(p: Party, down: Casualties | undefined) {
  if (!down) return 0;
  let n = 0;
  for (const id in down) {
    const k = down[id]; n += k;
    const dead = Math.round(k * 0.7);
    removeTroops(p.troops, id, dead);
    const st = p.troops.find(s => s.id === id); if (st) st.w = Math.min(st.n, st.w + (k - dead));
  }
  cleanStacks(p.troops);
  return n;
}

export function partyLabel(p: Party) { return p.lordId ? `${FACTION[p.faction]?.name ?? ''}${lordName(p.lordId)}部` : p.name; }

// ---------- AI 军团之战 ----------
export function aiArmyBattle(a: Party, b: Party) {
  const A = armyOf(a), B = armyOf(b);
  // 附近同阵营的领主也会卷入
  for (const p of S.parties) {
    if (p.inside || p.kind !== 'lord' || A.includes(p) || B.includes(p) || p.kind !== 'lord' || player() === p) continue;
    if (d2(p, a) > 60) continue;
    if (!hostile(p, b) && hostile(p, a)) continue;
    if (hostile(p, b) && !hostile(p, a) && A.length < 5) A.push(p);
    else if (hostile(p, a) && !hostile(p, b) && B.length < 5) B.push(p);
  }
  const pa: Part[] = A.map(p => ({ pid: String(p.id), stacks: p.troops })), pb: Part[] = B.map(p => ({ pid: String(p.id), stacks: p.troops }));
  const lords = (xs: Party[]) => xs.filter(p => p.kind === 'lord').length;
  const r = autoResolve(mergeStacks(pa), mergeStacks(pb), lords(A) ? 1.1 : 1, lords(B) ? 1.1 : 1, lords(A) * 8, lords(B) * 8);
  const da = splitDown(r.aDown, pa), db = splitDown(r.bDown, pb);
  for (const p of A) applyPartyLosses(p, da[String(p.id)]);
  for (const p of B) applyPartyLosses(p, db[String(p.id)]);
  const win = r.aWin ? A : B, lose = r.aWin ? B : A;
  const loot = lose.reduce((s, p) => s + Math.round(p.gold * 0.5), 0);
  win[0].gold += loot;
  for (const p of lose) for (const g in p.goods) win[0].goods[g] = (win[0].goods[g] || 0) + Math.floor(p.goods[g] / 2);
  const pp = player();
  const near = d2(pp, a) < 400;
  const big = A.length + B.length > 2;
  if (win[0].lordId || lose[0].lordId || near) {
    const wn = big && win.length > 1 ? `${partyLabel(win[0])}等${win.length}路兵马` : partyLabel(win[0]);
    const ln = big && lose.length > 1 ? `${partyLabel(lose[0])}等${lose.length}路兵马` : partyLabel(lose[0]);
    if (win[0].lordId && lose[0].lordId) log(`${wn}大破${ln}。`, 'war');
    else if (near) log(`${wn}击败了${ln}。`, 'dim');
  }
  for (const p of lose) removeParty(p);
  for (const p of win) { cleanStacks(p.troops); if (healthy(p.troops) <= 0) removeParty(p); }
}

// ---------- AI 统帅召集 ----------
/** 领主决定攻城时，召集附近同阵营空闲领主组成军团 */
export function rallyArmy(leader: Party, maxN = 3) {
  const cands = S.parties.filter(p => p !== leader && p.kind === 'lord' && p.faction === leader.faction && !p.inside
    && p.ai.mode !== 'follow' && p.ai.mode !== 'siege' && p.ai.mode !== 'recruit' && p.ai.mode !== 'flee'
    && d2(p, leader) < 380 && healthy(p.troops) > 25 && !followersOf(p).length)
    .sort((x, y) => d2(x, leader) - d2(y, leader)).slice(0, maxN);
  for (const p of cands) { p.ai.mode = 'follow'; p.ai.target = leader.id; p.ai.until = S.time + 24 * 7; p.ai.path = []; p.ai.nextThink = S.time; }
  if (cands.length >= 2) {
    const pp = player();
    const vis = d2(pp, leader) < 700 || playerSide() === leader.faction || atWar(leader.faction, playerSide() ?? 'player');
    if (vis) log(`${partyLabel(leader)}召集${cands.map(p => lordName(p.lordId!)).join('、')}合兵一处，号称大军！`, 'war');
  }
  return cands;
}
/** 潜在军团的总战力（用于 AI 判断能否攻城） */
export function rallyPotential(leader: Party, strengthOf: (p: Party) => number) {
  let s = 0;
  for (const p of S.parties) if (p !== leader && p.kind === 'lord' && p.faction === leader.faction && !p.inside && p.ai.mode !== 'siege' && p.ai.mode !== 'follow' && d2(p, leader) < 380) s += strengthOf(p) * 0.85;
  return Math.min(s, strengthOf(leader) * 2.5);
}

/** 跟随者的思考：贴近主将；主将不在或期限已到则解散 */
export function thinkFollower(p: Party, goTo: (p: Party, x: number, y: number) => void): boolean {
  const ai = p.ai;
  if (ai.mode !== 'follow') return false;
  const L = typeof ai.target === 'number' ? partyById(ai.target) : undefined;
  const pp = player();
  if (!L || (ai.until !== undefined && S.time > ai.until) || (L !== pp && L.faction !== p.faction) || (L === pp && hostile(pp, p))) {
    if (L === pp) log(`${partyLabel(p)}辞别了你的军团。`, 'dim');
    ai.mode = 'idle'; ai.target = undefined; ai.path = []; return false;
  }
  ai.nextThink = S.time + 0.5;
  if (L.inside) {
    // 主将入城：在城外扎营等候
    const st = S.settlements[L.inside];
    if (st && d2(p, st) > 30) goTo(p, st.x + ((p.id % 5) - 2) * 6, st.y + 10);
    return true;
  }
  const k = p.id % 6, ox = Math.cos(k) * 14, oy = Math.sin(k) * 14;
  const dd = d2(p, L);
  if (dd < 10) { ai.path = []; return true; }
  if (dd < 90) ai.path = [[L.x + ox, L.y + oy]];
  else goTo(p, L.x + ox, L.y + oy);
  return true;
}

/** 玩家统帅：请求友方领主随军 */
export function canRecruitLord(p: Party): { ok: boolean; why: string } {
  const pp = player();
  const side = playerSide();
  if (!p.lordId) return { ok: false, why: '' };
  if (!side || p.faction !== side) return { ok: false, why: '只有同一阵营的将领才会听你调遣' };
  if (p.ai.mode === 'follow' && p.ai.target === pp.id) return { ok: false, why: '已在你的军中' };
  const l = S.lords[p.lordId];
  const need = 120 - l.relation * 3;
  if (S.renown < need) return { ok: false, why: `声望不足（需 ${Math.max(0, need)}）` };
  if (followersOf(pp, 99999).length >= 4) return { ok: false, why: '你的军团最多统领四路兵马' };
  if (healthy(p.troops) < 15) return { ok: false, why: '对方兵力太少' };
  return { ok: true, why: '' };
}
export function recruitLord(p: Party, days = 6) {
  const pp = player();
  p.ai.mode = 'follow'; p.ai.target = pp.id; p.ai.until = S.time + 24 * days; p.ai.path = []; p.ai.nextThink = S.time;
  p.inside = undefined;
  const l = S.lords[p.lordId!];
  if (l.relation < 15) l.relation -= 1;
  log(`${partyLabel(p)}率 ${healthy(p.troops)} 人加入了你的军团（${days} 天）。`, 'gold');
}
export function dismissFollowers() {
  const pp = player();
  for (const p of S.parties) if (p.ai.mode === 'follow' && p.ai.target === pp.id) { p.ai.mode = 'idle'; p.ai.target = undefined; p.ai.path = []; const l = p.lordId ? S.lords[p.lordId] : null; if (l) l.relation += 1; }
  log('你遣散了军团，诸将各回防区。', 'dim');
}
export function myFollowers() { const pp = player(); return S.parties.filter(p => p.ai.mode === 'follow' && p.ai.target === pp.id); }

export function troopTier(id: string) { return TROOPS[id]?.tier ?? 1; }
void chance;

// ---------- AI 军团攻城 ----------
import { setOwner, checkFactionAlive } from './combat';
import { addTroops } from './party';
export function armySiegeAssault(p: Party, st: Settlement) {
  const A = armyOf(p, 60);
  const D = lordsInside(st);
  const pa: Part[] = A.map(x => ({ pid: String(x.id), stacks: x.troops }));
  const pd: Part[] = [{ pid: 'g', stacks: st.garrison }, ...D.map(x => ({ pid: String(x.id), stacks: x.troops }))];
  const defMult = fortMult(st);
  const r = autoResolve(mergeStacks(pa), mergeStacks(pd), 1, defMult, 8 * A.length, 10 + 8 * D.length);
  const da = splitDown(r.aDown, pa), dd = splitDown(r.bDown, pd);
  for (const x of A) { for (const id in da[String(x.id)]) removeTroops(x.troops, id, da[String(x.id)][id]); cleanStacks(x.troops); }
  for (const id in dd.g) removeTroops(st.garrison, id, dd.g[id]);
  cleanStacks(st.garrison);
  for (const x of D) applyPartyLosses(x, dd[String(x.id)]);
  const old = st.faction, oldOwner = st.owner;
  const name = A.length > 1 ? `${partyLabel(p)}等${A.length}路大军` : `${FACTION[p.faction].name}${lordName(p.lordId ?? null)}`;
  if (r.aWin) {
    for (const x of D) removeParty(x);
    for (const s of [...p.troops]) { const k = Math.floor((s.n - s.w) * 0.35); removeTroops(p.troops, s.id, k); addTroops(st.garrison, s.id, k); }
    setOwner(st, p.faction, p.lordId ?? null);
    log(`${name}攻陷了${FACTION[old]?.name ?? ''}的${st.name}！`, 'war');
    if (oldOwner === 'player') log(`你的封地${st.name}失守了！`, 'bad');
    checkFactionAlive(old);
    for (const x of A) if (x !== p && x.ai.mode === 'follow') { x.ai.mode = 'idle'; x.ai.target = undefined; }
  } else log(`${name}攻打${st.name}失利。`, 'war');
  st.siege = null;
  for (const x of A) if (healthy(x.troops) < 5) removeParty(x);
}
