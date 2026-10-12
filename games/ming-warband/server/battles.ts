// 联机实时战斗管理（主线程）：开战、加入、断线重连、撤退、结算。
// 战斗模拟本身在 worker 线程池里以 20Hz 运行（BATTLE_WORKERS=0 时在主线程运行）。
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { S, partyById, removeParty, hostile, log, isNight, settlementList, factionHostileToSettlement } from '../src/core/game';
import { healthy, cleanStacks, removeTroops } from '../src/core/party';
import { applyPartyLosses, partyLabel } from '../src/core/war';
import { terAtXY, Ter } from '../src/core/terrain';
import { FACTION } from '../src/data/world';
import { TROOPS } from '../src/data/troops';
import type { Party, Stack } from '../src/core/state';
import type { PRec } from '../src/net/protocol';
import { BattleRunner, type RunIn, type RunOut } from './battleRunner';
import type { PartyIn, CmdResult, CoreResult, GodFx, Casualties } from '../src/battle/core';
import { heroIn, compsIn } from '../src/battle/heroStats';
import * as W from './world';

/** 实时战斗设置（GM 可调） */
export const BCFG = { on: true, cap: 600, maxSec: 1200, joinRange: 90 };

interface Host { post(m: RunIn): void; battles: number; ms: number; name: string; close?: () => void }
export interface BRec {
  bid: number; host: Host; x: number; y: number; started: number;
  parts: Map<string, { id: number; side: 0 | 1; acct?: string; name: string; faction: string; kind: string; left?: boolean }>;
  n: [number, number]; ms: number; units: number; bytes: number; hidden: boolean; ended: boolean;
}
export const battles = new Map<number, BRec>();
const acctBattle = new Map<string, number>();
let nextBid = 1;
let hosts: Host[] = [];
const PERF = { frames: 0, bytes: 0, since: Date.now() };

/** 网络层注入：把二进制帧/JSON 发给某个玩家 */
export const BOUT = { bin: (_acct: string, _buf: Uint8Array) => { }, json: (_acct: string, _m: any) => { } };

// ---------- 线程池 ----------
export function initBattles() {
  const want = process.env.BATTLE_WORKERS !== undefined ? Number(process.env.BATTLE_WORKERS) : Math.max(1, Math.min(4, cpus().length - 1));
  const self = fileURLToPath(import.meta.url);
  const canWorker = want > 0 && self.endsWith('.mjs'); // 开发模式（tsx 跑 .ts）在主线程模拟
  if (canWorker) {
    for (let i = 0; i < want; i++) {
      try {
        const w = new Worker(self, { workerData: { battleWorker: true } });
        const h: Host = { post: m => w.postMessage(m), battles: 0, ms: 0, name: 'w' + i, close: () => { void w.terminate(); } };
        w.on('message', (batch: RunOut[]) => onOut(batch));
        w.on('error', e => console.error('[battle] worker error', e));
        w.on('exit', code => { if (code) console.error('[battle] worker exited', code); hosts = hosts.filter(x => x !== h); failHost(h); });
        hosts.push(h);
      } catch (e) { console.error('[battle] worker start failed', e); }
    }
  }
  if (!hosts.length) {
    const runner = new BattleRunner(b => onOut(b));
    hosts.push({ post: m => { const out = runner.handle(m); if (out.length) onOut(out); }, battles: 0, ms: 0, name: 'main' });
  }
  console.log(`[battle] 实时战斗线程：${hosts.map(h => h.name).join(', ')}`);
}
/** worker 线程入口 */
export function runBattleWorker(port: import('node:worker_threads').MessagePort) {
  const post = (batch: RunOut[]) => {
    const tr: ArrayBuffer[] = [];
    for (const o of batch) if (o.k === 'bin') tr.push(o.buf.buffer as ArrayBuffer);
    port.postMessage(batch, tr);
  };
  const runner = new BattleRunner(post);
  port.on('message', (m: RunIn) => { try { const out = runner.handle(m); if (out.length) post(out); } catch (e) { console.error('[battle-worker]', e); } });
}
function failHost(h: Host) {
  for (const b of battles.values()) if (b.host === h && !b.ended) {
    // worker 崩溃：该场战斗按开战前的兵力自动结算（不丢档）
    console.error(`[battle] #${b.bid} 所在线程崩溃，释放参战部队`);
    releaseAll(b);
  }
}
function pickHost(): Host { return hosts.reduce((a, h) => (h.battles * 10 + h.ms < a.battles * 10 + a.ms ? h : a), hosts[0]); }

// ---------- 查询 ----------
export const inBattle = (acct: string) => acctBattle.has(acct);
export function battleOf(acct: string) { const id = acctBattle.get(acct); return id ? battles.get(id) : undefined; }
export function battleList() {
  const out: { bid: number; x: number; y: number; n: [number, number]; f: [string, string]; names: [string, string] }[] = [];
  for (const b of battles.values()) {
    if (b.ended || b.hidden) continue;
    const side = (s: 0 | 1) => [...b.parts.values()].filter(p => p.side === s && !p.left);
    const nm = (s: 0 | 1) => { const ps = side(s); return ps.length ? (ps.length > 1 ? `${ps[0].name}等${ps.length}部` : ps[0].name) : ''; };
    out.push({ bid: b.bid, x: Math.round(b.x), y: Math.round(b.y), n: b.n, f: [side(0)[0]?.faction ?? '', side(1)[0]?.faction ?? ''], names: [nm(0), nm(1)] });
  }
  return out;
}
export function battleStats() {
  const dt = (Date.now() - PERF.since) / 1000;
  return { battles: [...battles.values()].filter(b => !b.ended).map(b => ({ bid: b.bid, n: b.n, units: b.units, ms: b.ms, kbps: +(b.bytes / 2 / 1024).toFixed(1), players: [...b.parts.values()].filter(p => p.acct && !p.left).map(p => p.acct) })), threads: hosts.map(h => ({ name: h.name, battles: h.battles, ms: +h.ms.toFixed(2) })), framesPerSec: +(PERF.frames / Math.max(1, dt)).toFixed(1) };
}

// ---------- 组装参战方 ----------
function godFx(p: Party): GodFx | null {
  const g = W.godOf(p); if (!g) return null;
  return { buff: true, inv: g.invincible, oneHit: g.oneHit, speed: g.battleSpeed, aura: g.aura && g.reveal };
}
function partyIn(p: Party, side: 0 | 1): PartyIn {
  const base: PartyIn = { pid: String(p.id), side, name: partyLabel(p), faction: p.faction, stacks: p.troops.map(s => ({ ...s })), bandit: p.faction === 'bandit' };
  if (p.kind === 'hero' && p.acct) {
    const rec = W.OUT.rec(p.acct);
    base.acct = p.acct;
    base.online = W.OUT.online(p.acct);
    base.god = godFx(p);
    if (rec?.hero) {
      const color = FACTION[p.faction]?.color ?? 0xd4af37;
      const hi = heroIn({ ...rec.hero, hp: Math.max(0.3, rec.hero.hp ?? 1) }, color);
      base.hero = hi;
      base.comps = compsIn(rec.companions ?? []);
      base.morale = rec.morale ?? 70;
      base.leadership = rec.hero.skills?.leadership ?? 0;
      base.name = p.name;
    } else {
      // 档案不在内存（极少见）：无主角，部队由 AI 指挥
      delete base.acct; base.online = false;
    }
  }
  return base;
}

/**
 * 开一场实时战斗。a/b 两方的第一支为主角；附近的领主/玩家按敌我自动加入。
 * 返回战斗编号；条件不满足返回 0（调用方改用自动结算）。
 */
export function startRT(a: Party, b: Party, why: string): number {
  if (!BCFG.on || !hosts.length) return 0;
  const A = [a], B = [b];
  for (const p of S.parties) {
    if (p === a || p === b || p.inside || p.busy || p.hidden || (p.kind !== 'lord' && p.kind !== 'hero')) continue;
    if (Math.hypot(p.x - a.x, p.y - a.y) > 60) continue;
    if (p.kind === 'hero' && p.acct && W.OUT.online(p.acct)) continue; // 在线玩家自己决定是否参战（地图上的⚔）
    const ha = hostile(p, a), hb = hostile(p, b);
    if (hb && !ha && A.length < 8) A.push(p);
    else if (ha && !hb && B.length < 8) B.push(p);
  }
  const bid = nextBid++;
  const parts = [...A.map(p => partyIn(p, 0)), ...B.map(p => partyIn(p, 1))];
  if (!parts.some(p => p.acct && p.online)) return 0; // 没有在线玩家：不必实时
  let ter = terAtXY(a.x, a.y);
  if (ter === Ter.Sea || ter === Ter.Plateau) ter = Ter.Plain;
  const host = pickHost();
  const rec: BRec = { bid, host, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, started: Date.now(), parts: new Map(), n: [0, 0], ms: 0, units: 0, bytes: 0, hidden: [...A, ...B].some(p => W.godHidden(p)), ended: false };
  battles.set(bid, rec);
  host.battles++;
  for (const [ps, side] of [[A, 0], [B, 1]] as [Party[], 0 | 1][]) for (const p of ps) enlist(rec, p, side);
  const total = parts.reduce((n, p) => n + p.stacks.reduce((m, s) => m + Math.max(0, s.n - s.w), 0) + (p.hero ? 1 : 0), 0);
  host.post({ k: 'new', bid, opts: { terrain: ter, seed: Math.floor(Math.random() * 1e9), night: isNight(), cap: BCFG.cap, maxSec: BCFG.maxSec }, parts, total });
  const nm = (xs: Party[]) => xs.length > 1 ? `${partyLabel(xs[0])}等${xs.length}路兵马` : partyLabel(xs[0]);
  log(`${why}${nm(A)}与${nm(B)}在${placeName(rec.x, rec.y)}展开激战！`, A.concat(B).some(p => p.kind === 'hero') ? 'war' : 'dim');
  return bid;
}
function enlist(b: BRec, p: Party, side: 0 | 1) {
  for (const [eid, e] of W.encounters) if (e.hero === p.id || e.enemy === p.id) W.encounters.delete(eid);
  p.busy = -b.bid;
  W.heroNav.delete(p.id);
  p.ai.path = [];
  b.parts.set(String(p.id), { id: p.id, side, acct: p.kind === 'hero' ? p.acct : undefined, name: partyLabel(p), faction: p.faction, kind: p.kind });
  if (p.kind === 'hero' && p.acct) acctBattle.set(p.acct, b.bid);
}
function placeName(x: number, y: number) {
  let best = '', bd = Infinity;
  for (const s of settlementList()) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s.name; } }
  return best ? `${best}附近` : '野外';
}

/** 玩家加入进行中的战斗（地图上的⚔）。side 省略时按敌我自动判断 */
export function joinRT(acct: string, bid: number, side?: 0 | 1): { ok: boolean; err?: string; side?: number } {
  const b = battles.get(bid); const p = W.heroOf(acct);
  if (!b || b.ended) return { ok: false, err: '这场战斗已经结束了' };
  if (!p) return { ok: false, err: '你不在世界中' };
  if (p.busy) return { ok: false, err: '你正忙着' };
  if (p.inside) return { ok: false, err: '先出城' };
  if (Math.hypot(p.x - b.x, p.y - b.y) > BCFG.joinRange) return { ok: false, err: '离战场太远了，靠近些再加入' };
  const god = W.godOf(p);
  const others = (s: 0 | 1) => [...b.parts.values()].filter(x => x.side === s && !x.left).map(x => partyById(x.id)).filter((x): x is Party => !!x);
  const can = (s: 0 | 1) => {
    if (god?.any) return true;
    const mine = others(s), foes = others((1 - s) as 0 | 1);
    return mine.every(x => !hostile(p, x)) && foes.some(x => hostile(p, x));
  };
  let sd: 0 | 1 | null = side === 0 || side === 1 ? side : null;
  if (sd === null) sd = can(0) ? 0 : can(1) ? 1 : null;
  if (sd === null || !can(sd)) return { ok: false, err: '你与交战双方都不是敌人，或者与两边都有仇——无法加入' };
  enlist(b, p, sd);
  b.host.post({ k: 'join', bid, part: partyIn(p, sd) });
  return { ok: true, side: sd };
}

// ---------- 来自客户端 ----------
export function onClientMsg(acct: string, m: any) {
  const bid = acctBattle.get(acct); const b = bid ? battles.get(bid) : undefined;
  if (!b || b.ended) { if (m?.t === 'bi' || m?.t === 'bc') BOUT.json(acct, { t: 'bgone', bid: m.bid ?? 0 }); return; }
  switch (m.t) {
    case 'bi': {
      const d = m.d; if (!Array.isArray(d) || d.length < 11) return;
      b.host.post({ k: 'in', bid: b.bid, acct, inp: { x: +d[0] / 10, y: +d[1] / 10, face: +d[2] / 1000, mode: d[3] | 0, atk: d[4] | 0, atkA: +d[5] / 1000, fire: d[6] | 0, fireA: +d[7] / 1000, fireD: +d[8], cs: d[9] | 0 } });
      const v = d[10]; if (Array.isArray(v) && v.length === 4) b.host.post({ k: 'view', bid: b.bid, acct, v: [+v[0], +v[1], +v[2], +v[3]] });
      return;
    }
    case 'bc': b.host.post({ k: 'cmd', bid: b.bid, acct, c: { o: m.o, f: m.f, g: m.g, gs: Array.isArray(m.gs) ? m.gs : undefined, mv: Array.isArray(m.mv) ? [+m.mv[0], +m.mv[1]] : undefined } }); return;
    case 'bleave': b.host.post({ k: 'retreat', bid: b.bid, acct }); return;
    case 'bsync': b.host.post({ k: 'resync', bid: b.bid, acct }); return;
  }
}
/** 断线/重连 */
export function onPresence(acct: string, on: boolean) {
  const b = battleOf(acct); if (!b || b.ended) return;
  b.host.post({ k: 'online', bid: b.bid, acct, on });
}

// ---------- 来自执行器 ----------
function onOut(batch: RunOut[]) {
  for (const o of batch) {
    switch (o.k) {
      case 'bin': BOUT.bin(o.acct, o.buf); PERF.frames++; PERF.bytes += o.buf.byteLength; break;
      case 'json': for (const a of o.to) BOUT.json(a, o.m); break;
      case 'left': { const b = battles.get(o.bid); if (b) applyLeft(b, o.res); break; }
      case 'end': { const b = battles.get(o.bid); if (b) { try { applyEnd(b, o.res); } catch (e) { console.error('[battle] applyEnd', e); releaseAll(b); } } break; }
      case 'stat': {
        const b = battles.get(o.bid); if (!b) break;
        b.n = o.n; b.ms = o.ms; b.units = o.units; b.bytes = o.bytes;
        b.host.ms = [...battles.values()].filter(x => x.host === b.host && !x.ended).reduce((s, x) => s + x.ms, 0);
        break;
      }
    }
  }
}

// ---------- 结算 ----------
const casN = (c: Casualties | undefined) => { let n = 0; for (const k in c ?? {}) n += c![k]; return n; };
const casPow = (c: Casualties) => { let s = 0; for (const id in c) s += c[id] * (TROOPS[id]?.tier ?? 1) * 1.2; return s; };

/** 玩家部队折损：倒下者约七成阵亡（医术可救回一些），其余负伤 */
function heroLosses(p: Party, down: Casualties | undefined, rec: PRec | undefined) {
  if (!down) return { killed: 0, wounded: 0 };
  const surg = rec?.hero?.skills?.surgery ?? 0;
  const pDie = Math.max(0.35, 0.7 - surg * 0.05);
  let killed = 0, wounded = 0;
  for (const id in down) {
    const n = down[id];
    let k = 0; for (let i = 0; i < n; i++) if (Math.random() < pDie) k++;
    removeTroops(p.troops, id, k);
    const st = p.troops.find(s => s.id === id); if (st) st.w = Math.min(st.n, st.w + (n - k));
    killed += k; wounded += n - k;
  }
  cleanStacks(p.troops);
  return { killed, wounded };
}
function syncRec(p: Party) {
  const rec = p.acct ? W.OUT.rec(p.acct) : undefined;
  if (rec) { rec.troops = p.troops; rec.gold = p.gold; }
}

function applyLeft(b: BRec, r: CmdResult) {
  const meta = b.parts.get(r.pid); if (!meta) return;
  meta.left = true;
  const p = partyById(meta.id);
  acctBattle.delete(r.acct);
  if (!p) return;
  const rec = W.OUT.rec(r.acct);
  const ls = heroLosses(p, r.down, rec);
  p.busy = undefined; p.grace = S.time + 2;
  if (rec?.hero) rec.hero.hp = Math.min(rec.hero.hp, Math.max(0.05, r.heroHp));
  syncRec(p);
  W.OUT.send(r.acct, { t: 'patch', data: { troops: p.troops, hp: rec?.hero?.hp } as any, why: 'battle' });
  BOUT.json(r.acct, { t: 'bend', bid: b.bid, win: false, retreat: true, out: outcomeFor(r, false, {}, true), lines: [`你率部撤出了战场。`, ls.killed + ls.wounded ? `我军阵亡 ${ls.killed} 人，负伤 ${ls.wounded} 人。` : ''].filter(Boolean), gold: 0 });
}
function outcomeFor(r: CmdResult, win: boolean, enemyDown: Casualties, retreat: boolean) {
  return { win, ourDown: r.down, enemyDown, heroDown: r.heroDown, compDown: r.compDown, retreat, manual: true, kills: r.kills };
}

function applyEnd(b: BRec, res: CoreResult) {
  b.ended = true;
  battles.delete(b.bid);
  b.host.battles = Math.max(0, b.host.battles - 1);
  const W0 = res.winner;
  const all = [...b.parts.values()].filter(m => !m.left);
  const side = (s: 0 | 1) => all.filter(m => m.side === s);
  const enemyDownOf = (s: 0 | 1) => { const c: Casualties = {}; for (const m of all) if (m.side !== s) for (const id in res.downPid[String(m.id)] ?? {}) c[id] = (c[id] ?? 0) + res.downPid[String(m.id)][id]; return c; };
  const winners = W0 >= 0 ? side(W0 as 0 | 1) : [];
  const losers = W0 >= 0 ? side((1 - W0) as 0 | 1) : [];
  // 战利品：败方 AI 银两的一半、败方玩家银两的四分之一，加按杀伤计的赏银；按杀敌数分给胜方玩家
  let loot = 0;
  const taken = new Map<number, number>();
  for (const m of losers) { const p = partyById(m.id); if (!p) continue; const g = Math.round(p.gold * (p.kind === 'hero' ? 0.25 : 0.5)); loot += g; p.gold -= g; taken.set(p.id, g); }
  if (W0 >= 0) loot += Math.round(casPow(enemyDownOf(W0 as 0 | 1)) * 3);
  const winHeroes = winners.filter(m => m.kind === 'hero');
  const wsum = winHeroes.reduce((s, m) => s + (res.killsBy[String(m.id)] ?? 0) + 1, 0);
  const topLord = winners.find(m => m.kind === 'lord');
  const topHero = [...winHeroes].sort((x, y) => (res.killsBy[String(y.id)] ?? 0) - (res.killsBy[String(x.id)] ?? 0))[0];
  const title = (() => {
    const nm = (ms: typeof all) => ms.length > 1 ? `${ms[0].name}等${ms.length}部` : ms[0]?.name ?? '';
    if (W0 < 0) return '两败俱伤';
    return `${nm(winners)}击败了${nm(losers)}`;
  })();
  log(`${title}（${placeName(b.x, b.y)}，鏖战 ${Math.max(1, Math.round(res.dur / 60))} 分钟）。`, all.some(m => m.kind === 'hero') ? 'war' : 'dim');
  for (const m of all) {
    const p = partyById(m.id);
    if (m.acct) acctBattle.delete(m.acct);
    if (!p) continue;
    p.busy = undefined;
    const down = res.downPid[String(m.id)];
    const won = W0 === m.side;
    if (p.kind === 'hero' && p.acct) {
      const rec = W.OUT.rec(p.acct);
      const cr = res.cmds.find(c => c.pid === String(m.id));
      const ls = heroLosses(p, down, rec);
      const lines: string[] = [`${title}。`];
      if (ls.killed + ls.wounded) lines.push(`我军阵亡 ${ls.killed} 人，负伤 ${ls.wounded} 人。`);
      const kills = res.killsBy[String(m.id)] ?? 0;
      if (kills) lines.push(`你部共击倒敌军 ${kills} 人。`);
      let gold = 0;
      if (won) {
        gold = wsum ? Math.floor(loot * (kills + 1) / wsum) : 0;
        p.gold += gold;
        if (gold) lines.push(`分得战利品 ${gold} 两银子。`);
        p.grace = S.time + 1.5;
      } else if (W0 >= 0) {
        // 战败：失银、散兵被俘，退回最近的友方城镇，短暂免战
        const tg = taken.get(p.id) ?? 0; gold = -tg;
        if (tg) lines.push(`你丢失了 ${tg} 两银子。`);
        let cap = 0; for (const st of [...p.troops]) { const k = Math.round((st.n - st.w) * 0.3); if (k > 0) { removeTroops(p.troops, st.id, k); cap += k; } }
        cleanStacks(p.troops);
        if (cap) lines.push(`溃散中又有 ${cap} 人被俘。`);
        const refuge = nearestFriendlyTown(p);
        if (refuge) { p.x = refuge.x + 6; p.y = refuge.y + 6; lines.push(`你退到了${refuge.name}。`); }
        W.heroNav.delete(p.id);
        p.grace = S.time + 6;
      } else p.grace = S.time + 2;
      const hp = cr ? (cr.heroDown ? 0.15 : Math.max(0.05, cr.heroHp)) : (rec?.hero?.hp ?? 1);
      if (rec?.hero) rec.hero.hp = Math.min(rec.hero.hp ?? 1, hp);
      p.hp = rec?.hero?.hp;
      syncRec(p);
      W.OUT.send(p.acct, { t: 'patch', data: { troops: p.troops, addGold: gold, hp: p.hp, ...(won || W0 < 0 ? {} : { x: p.x, y: p.y }) } as any, why: 'battle' });
      if (W.OUT.online(p.acct)) BOUT.json(p.acct, { t: 'bend', bid: b.bid, win: won, retreat: false, out: outcomeFor(cr ?? { acct: p.acct, pid: String(p.id), side: m.side, down: down ?? {}, heroDown: false, compDown: [], heroHp: 1, kills, retreat: false }, won, enemyDownOf(m.side), false), lines, gold });
      else W.OUT.send(p.acct, { t: 'report', title: won ? '胜利' : '战败', lines });
    } else {
      applyPartyLosses(p, down);
      cleanStacks(p.troops);
      if (!won && W0 >= 0) {
        if (p.lordId && S.lords[p.lordId]) S.lords[p.lordId].grudge = topHero?.acct ? 'P:' + topHero.acct : topLord ? partyById(topLord.id)?.lordId : undefined;
        removeParty(p);
      } else if (healthy(p.troops) <= 0) removeParty(p);
      else { p.ai.mode = 'idle'; p.ai.path = []; p.ai.nextThink = S.time + 1; p.grace = S.time + 1; }
    }
  }
}

function nearestFriendlyTown(p: Party) {
  let best: { x: number; y: number; name: string } | null = null, bd = Infinity;
  for (const s of settlementList()) {
    if (s.kind === 'village' || factionHostileToSettlement(p.faction, s)) continue;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

/** 异常时释放所有参战部队（不结算） */
function releaseAll(b: BRec) {
  b.ended = true; battles.delete(b.bid);
  b.host.battles = Math.max(0, b.host.battles - 1);
  for (const m of b.parts.values()) {
    const p = partyById(m.id); if (p && p.busy === -b.bid) { p.busy = undefined; p.grace = S.time + 1; }
    if (m.acct) { acctBattle.delete(m.acct); BOUT.json(m.acct, { t: 'bgone', bid: b.bid }); }
  }
}
/** GM：强制结束（自动结算） */
export function abortBattle(bid: number) { const b = battles.get(bid); if (!b) return false; b.host.post({ k: 'abort', bid }); return true; }
export function abortAll() { for (const b of battles.values()) b.host.post({ k: 'abort', bid: b.bid }); }
/** 部队在战斗中被移除（GM 删除等）：不影响模拟，结算时跳过 */
export type { Stack };
