// 联机服务器：权威世界
import { S, setState, newGame, ensureWorld, makeParty, removeParty, partyById, settlementList, hostile, atWar, log, on, factionHostileToSettlement, setWar } from '../src/core/game';
import { simulate, SIM_HOOKS, moveAlong, guard, WORLD_OPT } from '../src/core/sim';
import { findPath, wallBetween, buildGrid } from '../src/core/terrain';
import { whoOf } from '../src/core/wall';
import { mapSpeed, healthy, count, cleanStacks, addTroops } from '../src/core/party';
import { RECRUIT, tickRecruits, recruitTroopOf } from '../src/core/recruits';
import { autoResolve } from '../src/core/combat';
import { mergeStacks, splitDown, applyPartyLosses, partyLabel, type Part } from '../src/core/war';
import { setOwner, checkFactionAlive } from '../src/core/combat';
import { newHero } from '../src/core/character';
import { BACKGROUNDS } from '../src/core/game';
import { FACTION, type FactionId } from '../src/data/world';
import { RECRUIT_OF, TROOPS } from '../src/data/troops';
import type { GameState, Party, Settlement, Stack } from '../src/core/state';
import type { NetParty, PRec, S2C, ServerCfg, Treaty, WorldSnap, PrivatePart } from '../src/net/protocol';
import { PRIVATE_KEYS, newbieLeft } from '../src/net/protocol';
import { tickDiplomacy, treatyBetween } from './diplomacy';
import { installCustomFactions } from './kingdom';

export const CFG: ServerCfg = { hoursPerSec: 0.4, allianceOpenDay: 36, pvp: true, motd: '欢迎来到《铁血大明》联机世界！' };

/** 发给某个玩家（由网络层注入） */
export const OUT: { send: (acct: string, m: S2C) => void; broadcast: (m: S2C, filter?: (acct: string) => boolean) => void; online: (acct: string) => boolean; rec: (acct: string) => PRec | undefined } = {
  send: () => {}, broadcast: () => {}, online: () => false, rec: () => undefined,
};
/** 玩家截击玩家前的新手保护检查：返回 true 表示可以开战 */
function pvpAllowed(att: Party, def: Party): boolean {
  const dr = OUT.rec(def.acct!), left = newbieLeft(dr);
  if (left > 0) { OUT.send(att.acct!, { t: 'report', title: '新手保护', lines: [`${def.name}初出茅庐（新手保护还剩 ${Math.ceil(left / 60000)} 分钟），此时不能截击。`] }); return false; }
  const ar = OUT.rec(att.acct!);
  if (ar && !ar.pvpOptIn) { if (newbieLeft(ar) > 0) OUT.send(att.acct!, { t: 'log', msg: '你主动截击他人，新手保护就此解除。', cls: 'bad' }); ar.pvpOptIn = true; }
  return true;
}

interface HNav { kind: 'point' | 'settlement' | 'party'; id?: string | number; x: number; y: number; path: [number, number][]; lastPathAt: number }
interface Enc { eid: number; acct: string; hero: number; enemy: number; started: number; forced: boolean; fighting?: boolean }
export const heroNav = new Map<number, HNav>();
export const encounters = new Map<number, Enc>();
let nextEid = 1;

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function heroOf(acct: string): Party | undefined { return S.parties.find(p => p.kind === 'hero' && p.acct === acct); }

// ---------- 初始化 ----------
export function initWorld(saved: string | null) {
  buildGrid();
  WORLD_OPT.personal = false;
  RECRUIT.realtime = true;
  if (saved) {
    const st = JSON.parse(saved) as GameState;
    st.pendingDefense = null;
    setState(st);
    ensureWorld(st);
    // 上次关服时在线的玩家部队：移除（重新登录时再放回）
    for (const p of [...S.parties]) if (p.kind === 'hero') removeParty(p);
    for (const p of S.parties) p.busy = undefined;
    console.log(`[world] loaded: ${Object.keys(S.settlements).length} settlements, ${S.parties.length} parties, day ${Math.floor(S.time / 24)}`);
  } else {
    newGame('天下', 'soldier');
    console.log('[world] new world created');
  }
  S.treaties ??= [];
  installCustomFactions(S.customFactions);
  // 虚拟“玩家”：藏在远处城中，不参与任何事
  const dummy = S.parties.find(p => p.id === S.playerId)!;
  dummy.troops = []; dummy.gold = 0; dummy.goods = {}; dummy.hidden = true;
  dummy.inside = Object.values(S.settlements).find(s => s.kind === 'town')!.id;
  S.playerFaction = null; S.mercOf = null;
  installHooks();
}

export function worldJSON() { return JSON.stringify(S); }

// ---------- 主循环 ----------
let lastLogLen = 0;
export function tick(realSec: number) {
  const hours = realSec * CFG.hoursPerSec;
  const dummy = S.parties.find(p => p.id === S.playerId);
  if (dummy) { dummy.troops = []; dummy.x = S.settlements[dummy.inside ?? '']?.x ?? dummy.x; }
  guard('simulate', () => { simulate(hours); });
  guard('recruits', () => tickRecruits(realSec));
  guard('encounters', checkEncounterTimeouts);
  guard('sieges', checkHeroSieges);
  guard('diplomacy', () => tickDiplomacy(realSec));
  // 世界大事广播
  if (S.log.length !== lastLogLen) {
    const fresh = S.log.slice(Math.max(0, lastLogLen > S.log.length ? S.log.length - 5 : lastLogLen));
    for (const e of fresh) if (e.cls === 'war' || e.cls === 'gold' || e.cls === 'event') OUT.broadcast({ t: 'log', msg: e.msg, cls: e.cls });
    lastLogLen = S.log.length;
  }
}

function installHooks() {
  SIM_HOOKS.heroMove = heroMove;
  SIM_HOOKS.heroContact = heroContact;
  on('daily', () => { /* 世界已在 sim 中结算 */ });
}

// ---------- 玩家部队 ----------
export function nationStart(f: FactionId): Settlement {
  const own = settlementList().filter(s => s.faction === f && s.kind === 'town');
  const alt = settlementList().filter(s => s.faction === f && s.kind !== 'village');
  const pool = own.length ? own : alt.length ? alt : settlementList().filter(s => s.kind === 'town');
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 新建玩家档案（复用单机的出身设定） */
export function createRec(name: string, nation: FactionId, bg: string): PRec {
  const saveHero = S.hero, savePid = S.playerId;
  const tmp = makeParty('hero', name, nation, 0, 0, []);
  S.hero = newHero(name); S.playerId = tmp.id;
  const b = BACKGROUNDS.find(x => x.id === bg) ?? BACKGROUNDS[0];
  try { b.apply(S); } catch (e) { console.error('[world] background', e); }
  const hero = S.hero;
  const culture = FACTION[nation].culture;
  const rec: PRec = {
    name, nation, bg: b.id, hero, troops: tmp.troops.map(s => ({ ...s, id: s.id === 'ming_recruit' ? RECRUIT_OF[culture] ?? s.id : s.id })), prisoners: [],
    gold: tmp.gold, goods: { ...tmp.goods, grain: (tmp.goods.grain ?? 0) + 6 }, renown: 20, honor: 0, morale: 70, companions: [], quests: [],
    stats: { kills: 0, won: 0, lost: 0, days: 0 }, playerRel: { [nation]: 20 }, created: Date.now(), rank: 0,
  };
  removeParty(tmp);
  S.hero = saveHero; S.playerId = savePid;
  // 给五名本国新兵作为起家（所有出身都有）
  if (count(rec.troops) < 5) addTroops(rec.troops, RECRUIT_OF[culture] ?? 'ming_recruit', 5 - count(rec.troops));
  const st = nationStart(nation);
  rec.x = st.x + 6; rec.y = st.y + 6;
  return rec;
}

export function spawnHero(rec: PRec): Party {
  const old = heroOf(rec.name);
  if (old) { if (rec.nation) old.faction = rec.nation; return old; }
  let x = rec.x ?? 0, y = rec.y ?? 0;
  if (!rec.x || !findPath(x, y, x + 1, y + 1)) { const st = nationStart(rec.nation ?? 'ming'); x = st.x + 6; y = st.y + 6; }
  const p = makeParty('hero', rec.name, rec.nation ?? 'ming', x, y, rec.troops, { acct: rec.name, gold: rec.gold, goods: rec.goods, prisoners: rec.prisoners });
  p.ai.nextThink = Infinity;
  p.hp = rec.hero.hp; p.lvl = rec.hero.level;
  p.grace = S.time + 1;
  return p;
}

export function despawnHero(acct: string, rec: PRec) {
  const p = heroOf(acct);
  if (!p) return;
  rec.x = p.x; rec.y = p.y; rec.troops = p.troops; rec.gold = p.gold; rec.goods = p.goods; rec.prisoners = p.prisoners;
  for (const [eid, e] of encounters) if (e.hero === p.id) endEncounter(eid);
  heroNav.delete(p.id);
  for (const s of settlementList()) if (s.siege && s.siege.by === p.id) s.siege = null;
  removeParty(p);
}

/** 客户端上传的私有数据：合理性检查后写入 */
export function applySync(rec: PRec, data: Partial<PrivatePart>): string | null {
  const p = heroOf(rec.name);
  let warn: string | null = null;
  for (const k of PRIVATE_KEYS) if (k in data) (rec as any)[k] = (data as any)[k];
  if (data.troops) {
    const n = count(data.troops);
    if (n > 2500) { warn = `兵力异常 ${n}`; rec.troops = rec.troops.slice(0, 20); }
    rec.troops = rec.troops.filter(s => TROOPS[s.id] && s.n > 0).map(s => ({ id: s.id, n: Math.floor(s.n), w: Math.max(0, Math.min(s.n, Math.floor(s.w))), xp: s.xp || 0 }));
  }
  if (typeof data.gold === 'number' && p && data.gold - p.gold > 50000) warn = `银两暴涨 ${p.gold} → ${data.gold}`;
  if (p) {
    p.troops = rec.troops; p.gold = rec.gold; p.goods = rec.goods; p.prisoners = rec.prisoners;
    p.hp = rec.hero.hp; p.lvl = rec.hero.level;
  }
  return warn;
}

// ---------- 行军 ----------
export function setHeroNav(p: Party, kind: HNav['kind'], x?: number, y?: number, id?: string | number): boolean {
  p.inside = undefined;
  let tx: number, ty: number;
  if (kind === 'point') { tx = x!; ty = y!; }
  else if (kind === 'settlement') { const st = S.settlements[String(id)]; if (!st) return false; tx = st.x; ty = st.y; }
  else { const t = partyById(Number(id)); if (!t || t === p) return false; tx = t.x; ty = t.y; }
  const path = findPath(p.x, p.y, tx, ty, whoOf(p));
  if (!path) { heroNav.delete(p.id); return false; }
  heroNav.set(p.id, { kind, id, x: tx, y: ty, path, lastPathAt: S.time });
  return true;
}
export function stopHero(p: Party) { heroNav.delete(p.id); }

function heroMove(p: Party, h: number, night: boolean) {
  const nv = heroNav.get(p.id);
  if (!nv) return;
  if (nv.kind === 'party') {
    const tp = partyById(Number(nv.id));
    if (!tp || tp.inside) { heroNav.delete(p.id); OUT.send(p.acct!, { t: 'navEnd' }); return; }
    if (dist(p.x, p.y, tp.x, tp.y) < 100 && !wallBetween(p.x, p.y, tp.x, tp.y, whoOf(p))) nv.path = [[tp.x, tp.y]];
    else if (S.time - nv.lastPathAt > 1.5) { nv.path = findPath(p.x, p.y, tp.x, tp.y, whoOf(p)) ?? nv.path; nv.lastPathAt = S.time; }
  }
  moveAlong(p, nv.path, mapSpeed(S, p, night) * h);
  if (nv.kind === 'settlement') {
    const st = S.settlements[String(nv.id)];
    if (!st) { heroNav.delete(p.id); return; }
    if (dist(p.x, p.y, st.x, st.y) < (st.isPass ? 40 : 10) || !nv.path.length) {
      heroNav.delete(p.id);
      OUT.send(p.acct!, { t: 'arrive', st: st.id });
    }
  } else if (nv.kind === 'party') {
    const tp = partyById(Number(nv.id));
    if (tp && dist(p.x, p.y, tp.x, tp.y) < 12) {
      heroNav.delete(p.id);
      if (tp.kind === 'hero') { if (hostile(p, tp) && CFG.pvp && !tp.busy) { if (pvpAllowed(p, tp)) heroBattle(p, tp, '你截住了'); } else OUT.send(p.acct!, { t: 'report', title: '相遇', lines: [`你遇到了${FACTION[tp.faction]?.name ?? ''}的${tp.name}（${healthy(tp.troops)} 人）。`] }); }
      else if (hostile(p, tp) && !tp.busy) startEncounter(p, tp, false);
      else OUT.send(p.acct!, { t: 'encounter', enemy: tp.id, forced: false, eid: 0 });
    }
  } else if (!nv.path.length) { heroNav.delete(p.id); OUT.send(p.acct!, { t: 'navEnd' }); }
}

// ---------- 遭遇 ----------
function heroContact(hero: Party, other: Party) {
  if (hero.busy || other.busy) return;
  if (other.kind === 'hero') {
    if (!CFG.pvp || !hostile(hero, other)) return;
    // 只有一方主动追击（目标是对方）时才开战
    const navA = heroNav.get(hero.id), navB = heroNav.get(other.id);
    const aChases = navA?.kind === 'party' && Number(navA.id) === other.id;
    const bChases = navB?.kind === 'party' && Number(navB.id) === hero.id;
    if (!aChases && !bChases) return;
    const [att, def] = aChases ? [hero, other] : [other, hero];
    if (!pvpAllowed(att, def)) { heroNav.delete(att.id); OUT.send(att.acct!, { t: 'navEnd' }); return; }
    heroBattle(hero, other, '两军相遇：');
    return;
  }
  const chased = other.ai.mode === 'chase' && other.ai.target === hero.id;
  const nv = heroNav.get(hero.id);
  const mine = nv?.kind === 'party' && Number(nv.id) === other.id;
  if (!chased && !mine) return;
  if (!OUT.online(hero.acct!)) { heroBattle(other, hero, ''); return; }
  startEncounter(hero, other, chased && !mine);
}

function startEncounter(hero: Party, enemy: Party, forced: boolean) {
  const eid = nextEid++;
  encounters.set(eid, { eid, acct: hero.acct!, hero: hero.id, enemy: enemy.id, started: Date.now(), forced });
  hero.busy = eid; enemy.busy = eid;
  heroNav.delete(hero.id);
  enemy.ai.path = [];
  OUT.send(hero.acct!, { t: 'encounter', enemy: enemy.id, forced, eid });
}

export function endEncounter(eid: number, graceH = 1.5) {
  const e = encounters.get(eid);
  if (!e) return;
  encounters.delete(eid);
  const h = partyById(e.hero), en = partyById(e.enemy);
  if (h) { h.busy = undefined; h.grace = S.time + graceH; }
  if (en) { en.busy = undefined; en.ai.mode = 'idle'; en.ai.path = []; en.ai.nextThink = S.time + 2; }
}

const ENC_TIMEOUT_MS = 15 * 60 * 1000;
function checkEncounterTimeouts() {
  const now = Date.now();
  for (const [eid, e] of encounters) {
    const h = partyById(e.hero), en = partyById(e.enemy);
    if (!h || !en) { endEncounter(eid); continue; }
    if (!e.fighting && now - e.started > 90000 && OUT.online(e.acct)) { endEncounter(eid, 0.5); continue; } // 没开战也没离开：解除
    const tooLong = now - e.started > ENC_TIMEOUT_MS;
    const gone = !OUT.online(e.acct) && now - e.started > 20000;
    if (tooLong || gone) { endEncounter(eid, 0); heroBattle(en, h, '（自动结算）'); }
  }
}

/** 服务器自动结算：玩家对玩家、离线/超时的玩家对 AI。附近的领主与玩家会按敌我自动加入（三方混战） */
export function heroBattle(a: Party, b: Party, prefix: string) {
  const A = [a], B = [b];
  for (const p of S.parties) {
    if (p === a || p === b || p.inside || p.busy || (p.kind !== 'lord' && p.kind !== 'hero')) continue;
    if (dist(p.x, p.y, a.x, a.y) > 60) continue;
    const ha = hostile(p, a), hb = hostile(p, b);
    if (hb && !ha && A.length < 8) A.push(p);
    else if (ha && !hb && B.length < 8) B.push(p);
  }
  const pa: Part[] = A.map(p => ({ pid: String(p.id), stacks: p.troops })), pb: Part[] = B.map(p => ({ pid: String(p.id), stacks: p.troops }));
  const lead = (xs: Party[]) => xs.reduce((s, p) => s + (p.kind === 'lord' ? 8 : p.kind === 'hero' ? 6 + (p.lvl ?? 1) : 0), 0);
  const mult = (xs: Party[]) => xs.some(p => p.kind === 'lord' || p.kind === 'hero') ? 1.1 : 1;
  const r = autoResolve(mergeStacks(pa), mergeStacks(pb), mult(A), mult(B), lead(A), lead(B));
  const da = splitDown(r.aDown, pa), db = splitDown(r.bDown, pb);
  const lossA = new Map<Party, number>(), lossB = new Map<Party, number>();
  for (const p of A) lossA.set(p, applyPartyLosses(p, da[String(p.id)]));
  for (const p of B) lossB.set(p, applyPartyLosses(p, db[String(p.id)]));
  const win = r.aWin ? A : B, lose = r.aWin ? B : A;
  const nm = (xs: Party[]) => xs.length > 1 ? `${partyLabel(xs[0])}等${xs.length}路兵马` : partyLabel(xs[0]);
  const title = `${nm(win)}击败了${nm(lose)}`;
  log(`${prefix}${title}。`, win.some(p => p.kind === 'hero') || lose.some(p => p.kind === 'hero') ? 'war' : 'dim');
  // 战利品：败方银两的一半按杀伤平分给胜方玩家
  let lootGold = 0;
  for (const p of lose) lootGold += Math.round(p.gold * (p.kind === 'hero' ? 0.25 : 0.5));
  const winHeroes = win.filter(p => p.kind === 'hero');
  const share = winHeroes.length ? Math.floor(lootGold / winHeroes.length) : 0;
  for (const p of win) {
    cleanStacks(p.troops);
    if (p.kind === 'hero') {
      p.gold += share;
      OUT.send(p.acct!, { t: 'patch', data: { troops: p.troops, addGold: share }, why: 'battle' });
      OUT.send(p.acct!, { t: 'report', title: '胜利', lines: [`${title}。`, `我军损失 ${(r.aWin ? lossA : lossB).get(p) ?? 0} 人。`, share ? `缴获 ${share} 两银子。` : ''].filter(Boolean) });
      p.grace = S.time + 1;
    } else if (healthy(p.troops) <= 0) removeParty(p);
    else { p.ai.mode = 'idle'; p.ai.nextThink = S.time + 1; }
  }
  for (const p of lose) {
    if (p.kind === 'hero') heroDefeated(p, title);
    else { if (p.lordId && S.lords[p.lordId]) S.lords[p.lordId].grudge = win.find(w => w.lordId)?.lordId; removeParty(p); }
  }
}

/** 玩家战败：折损、失银、退回最近的本国城镇，短暂免战 */
export function heroDefeated(p: Party, why: string) {
  const lostGold = Math.round(p.gold * 0.3);
  p.gold -= lostGold;
  for (const st of [...p.troops]) st.n -= Math.round(st.n * 0.5);
  cleanStacks(p.troops);
  for (const st of p.troops) st.w = Math.min(st.w, st.n);
  const refuge = nearestFriendlyTown(p);
  if (refuge) { p.x = refuge.x + 6; p.y = refuge.y + 6; }
  heroNav.delete(p.id);
  p.grace = S.time + 6; p.hp = 0.2;
  OUT.send(p.acct!, { t: 'patch', data: { troops: p.troops, addGold: -lostGold, x: p.x, y: p.y, hp: 0.2 } as any, why: 'defeat' });
  OUT.send(p.acct!, { t: 'report', title: '战败', lines: [`${why}。`, `你兵败溃走，损失 ${lostGold} 两银子，残部只剩 ${healthy(p.troops)} 人。`, refuge ? `你退到了${refuge.name}。` : ''].filter(Boolean) });
}

function nearestFriendlyTown(p: Party) {
  let best: Settlement | null = null, bd = Infinity;
  for (const s of settlementList()) {
    if (s.kind === 'village' || factionHostileToSettlement(p.faction, s)) continue;
    const d = dist(p.x, p.y, s.x, s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function checkHeroSieges() {
  for (const s of settlementList()) {
    if (!s.siege) continue;
    const p = partyById(s.siege.by);
    if (!p) { s.siege = null; continue; }
    if (p.kind === 'hero' && dist(p.x, p.y, s.x, s.y) > 60) s.siege = null;
  }
}

// ---------- 共享资源请求 ----------
const near = (p: Party, st: Settlement, r = 45) => p.inside === st.id || dist(p.x, p.y, st.x, st.y) < (st.isPass ? 60 : r);

export function handleReq(rec: PRec, op: string, a: any): { ok: boolean; data?: any; err?: string } {
  const p = heroOf(rec.name);
  if (!p) return { ok: false, err: '你不在世界中' };
  const st: Settlement | undefined = a?.st ? S.settlements[a.st] : undefined;
  switch (op) {
    case 'recruit': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      const n = Math.max(0, Math.min(Math.floor(a.n), Math.floor(st.recruits)));
      if (n <= 0) return { ok: false, err: '这里已经没有人愿意从军了' };
      st.recruits -= n;
      return { ok: true, data: { n, troop: recruitTroopOf(st), left: Math.floor(st.recruits) } };
    }
    case 'buyItem': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      const i = st.shop.indexOf(a.id);
      if (i < 0) return { ok: false, err: '这件货已经被别人买走了' };
      st.shop.splice(i, 1);
      return { ok: true };
    }
    case 'sellItem': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      if (st.shop.length < 80) st.shop.push(a.id);
      return { ok: true };
    }
    case 'trade': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      const g = String(a.g), n = Math.floor(a.n);
      const have = st.stock[g] ?? 0;
      if (n > 0 && have < n) return { ok: false, err: '存货不足', data: { stock: have } };
      st.stock[g] = Math.max(0, have - n);
      return { ok: true, data: { stock: st.stock[g] } };
    }
    case 'mercs': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      const m = st.tavern.mercs;
      if (!m) return { ok: false, err: '佣兵已经被别人雇走了' };
      st.tavern.mercs = null;
      return { ok: true, data: m };
    }
    case 'companion': {
      if (!st || !near(p, st)) return { ok: false, err: '离得太远' };
      if (!st.tavern.companion) return { ok: false, err: '那人已经跟别人走了' };
      st.tavern.companion = null;
      return { ok: true };
    }
    case 'raid': {
      if (!st || st.kind !== 'village' || !near(p, st, 30)) return { ok: false, err: '离得太远' };
      if (st.lootedUntil > S.time) return { ok: false, err: '这里刚被洗劫过' };
      st.lootedUntil = S.time + 24 * 4; st.prosperity = Math.max(5, st.prosperity - 15); st.recruits = 0;
      log(`${p.name}洗劫了${FACTION[st.faction]?.name ?? ''}的${st.name}！`, 'war');
      return { ok: true };
    }
    case 'siege': {
      if (!st || st.kind === 'village' || !near(p, st, 40)) return { ok: false, err: '离得太远' };
      if (!factionHostileToSettlement(p.faction, st)) return { ok: false, err: '这不是敌城' };
      if (st.siege && st.siege.by !== p.id) { const by = partyById(st.siege.by); if (by && !hostile(by, p)) return { ok: true, data: { joined: true } }; }
      st.siege = { by: p.id, since: S.time };
      log(`${p.name}率军围攻${st.name}！`, 'war');
      return { ok: true };
    }
    case 'siegeEnd': {
      if (st && st.siege?.by === p.id) st.siege = null;
      return { ok: true };
    }
    case 'enc': { // 遭遇结束（未开战：离开/逃走/交谈）
      const e = encounters.get(Number(a.eid));
      if (e && e.acct === rec.name) { if (a.fight) { e.fighting = true; e.started = Date.now(); } else endEncounter(e.eid, a.flee ? 1.5 : 0.5); }
      return { ok: true };
    }
    case 'battle': return applyBattle(rec, p, a);
    case 'garrison': {
      if (!st || st.owner !== 'P:' + rec.name) return { ok: false, err: '这不是你的封地' };
      st.garrison = (a.garrison as Stack[]).filter(s => TROOPS[s.id] && s.n > 0);
      return { ok: true };
    }
    case 'cannon': case 'noop': return { ok: true };
  }
  return { ok: false, err: '未知操作 ' + op };
}

/** 客户端打完一场实时战斗后上报结果（PvE / 攻城） */
function applyBattle(rec: PRec, p: Party, a: { eid?: number; enemy?: number; extras?: number[]; siege?: string; win: boolean; retreat?: boolean; left?: Record<string, Stack[]>; garrisonLeft?: Stack[]; captureGarrison?: Stack[] }) {
  const e = a.eid ? encounters.get(a.eid) : undefined;
  const fix = (pt: Party, rep?: Stack[]) => {
    if (!rep) return;
    const before = healthy(pt.troops);
    const after = rep.filter(s => TROOPS[s.id]).reduce((n, s) => n + s.n - s.w, 0);
    if (after <= before) pt.troops = rep.filter(s => TROOPS[s.id] && s.n > 0).map(s => ({ id: s.id, n: s.n, w: s.w, xp: s.xp ?? 0 }));
  };
  const ids = [a.enemy, ...(a.extras ?? [])].filter((x): x is number => typeof x === 'number');
  for (const id of ids) {
    const en = partyById(id);
    if (!en || en.kind === 'hero' || dist(en.x, en.y, p.x, p.y) > 120) continue;
    fix(en, a.left?.[String(id)]);
    if (a.win || healthy(en.troops) <= 0) {
      if (en.lordId && S.lords[en.lordId]) { S.lords[en.lordId].grudge = 'P:' + rec.name; log(`${p.name}击败了${FACTION[en.faction]?.name ?? ''}的${S.lords[en.lordId].name}！`, 'war'); }
      removeParty(en);
    } else { en.busy = undefined; en.ai.mode = 'idle'; en.ai.path = []; en.ai.nextThink = S.time + 3; }
  }
  if (e) endEncounter(e.eid, 2);
  let captured = false;
  if (a.siege) {
    const st = S.settlements[a.siege];
    if (st && near(p, st, 60) && factionHostileToSettlement(p.faction, st)) {
      if (a.win) {
        const old = st.faction;
        setOwner(st, p.faction, 'P:' + rec.name);
        st.garrison = (a.captureGarrison ?? []).filter(s => TROOPS[s.id] && s.n > 0).slice(0, 12);
        log(`${FACTION[p.faction]?.name ?? ''}的${p.name}攻占了${st.name}！`, 'war');
        checkFactionAlive(old);
        captured = true;
      } else if (a.garrisonLeft) {
        const before = healthy(st.garrison);
        const after = a.garrisonLeft.reduce((n, s) => n + s.n - s.w, 0);
        if (after <= before) st.garrison = a.garrisonLeft.filter(s => TROOPS[s.id] && s.n > 0);
        st.siege = null;
      }
    }
  }
  if (!a.win && !a.retreat) {
    const refuge = nearestFriendlyTown(p);
    if (refuge) { p.x = refuge.x + 6; p.y = refuge.y + 6; }
    p.grace = S.time + 6;
    heroNav.delete(p.id);
    return { ok: true, data: { x: p.x, y: p.y } };
  }
  p.grace = S.time + 2;
  return { ok: true, data: { captured } };
}

// ---------- 同步 ----------
export function netParty(p: Party): NetParty {
  return {
    id: p.id, kind: p.kind, name: p.name, faction: p.faction, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, troops: p.troops, gold: p.gold, goods: p.goods,
    lordId: p.lordId, home: p.home, inside: p.inside, questId: undefined, hidden: p.hidden, acct: p.acct, busy: p.busy, grace: p.grace, hp: p.hp, lvl: p.lvl,
    ai: { mode: p.ai.mode, target: p.ai.target },
  };
}
export function visibleParties() { return S.parties.filter(p => p.id !== S.playerId); }

export function worldSnap(): WorldSnap {
  return {
    version: S.version, seed: S.seed, time: S.time, nextId: S.nextId, settlements: S.settlements, lords: S.lords,
    wars: S.wars, truceUntil: S.truceUntil, alive: S.alive, wallHp: S.wallHp, beacons: S.beacons, calendarDone: S.calendarDone,
    chronLog: S.chronLog, flags: S.flags, treaties: S.treaties ?? [], customFactions: S.customFactions,
  };
}

/** 差量：只发生变化的城池/领主/部队 */
const lastSt = new Map<string, string>(), lastLord = new Map<string, string>(), lastParty = new Map<number, string>();
let lastMisc = '';
export function worldDelta(full = false): S2C | null {
  const sts: Settlement[] = [], lords: any[] = [];
  for (const s of settlementList()) { const j = JSON.stringify(s); if (full || lastSt.get(s.id) !== j) { lastSt.set(s.id, j); sts.push(s); } }
  for (const l of Object.values(S.lords)) { const j = JSON.stringify(l); if (full || lastLord.get(l.id) !== j) { lastLord.set(l.id, j); lords.push(l); } }
  const misc = JSON.stringify([S.wars, S.alive, S.truceUntil, S.treaties, S.customFactions, S.chronLog?.length, (S.wallHp ?? []).filter(h => h <= 0).length, S.beacons?.length]);
  const m: S2C = { t: 'world', time: S.time };
  if (sts.length) m.settlements = sts;
  if (lords.length) m.lords = lords;
  if (full || misc !== lastMisc) { lastMisc = misc; Object.assign(m, { wars: S.wars, alive: S.alive, truceUntil: S.truceUntil, treaties: S.treaties, customFactions: S.customFactions, wallHp: S.wallHp, beacons: S.beacons, chronLog: S.chronLog }); }
  return m;
}
export function partiesDelta(): S2C {
  const up: NetParty[] = [], seen = new Set<number>();
  for (const p of visibleParties()) {
    seen.add(p.id);
    const np = netParty(p);
    const j = JSON.stringify([np.kind, np.name, np.faction, np.troops, np.gold, np.inside, np.busy, np.ai.mode, np.ai.target, np.hp, np.lvl, np.hidden, np.lordId]);
    if (lastParty.get(p.id) !== j) { lastParty.set(p.id, j); up.push(np); }
  }
  const gone: number[] = [];
  for (const id of lastParty.keys()) if (!seen.has(id)) { gone.push(id); lastParty.delete(id); }
  return { t: 'parties', up, gone };
}
export function posPacket(): S2C {
  const a: number[] = [];
  for (const p of visibleParties()) { if (p.inside) continue; a.push(p.id, Math.round(p.x * 10), Math.round(p.y * 10), (p.busy ? 1 : 0)); }
  return { t: 'pos', time: S.time, a };
}

// ---------- GM 辅助 ----------
export function gmSpawnArmy(f: FactionId, stId: string, n: number) {
  const st = S.settlements[stId];
  if (!st) return null;
  const culture = FACTION[f]?.culture ?? 'ming';
  const troops: Stack[] = [];
  const pool = Object.values(TROOPS).filter(t => t.culture === culture);
  for (let i = 0; i < n; i++) { const t = pool[Math.floor(Math.random() * pool.length)]; addTroops(troops, t.id, 1); }
  const p = makeParty('lord', `${FACTION[f].name}天兵`, f, st.x + 10, st.y + 10, troops, { gold: 500 });
  return p;
}
export { setWar, atWar, treatyBetween };
export type { Treaty };
