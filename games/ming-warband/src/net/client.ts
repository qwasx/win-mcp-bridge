// 联机客户端：连接、世界镜像、插值、个人结算、私有数据上传
import { S, setState, ensureWorld, emit, log, partyById, player, dayOf, factionHostileToSettlement } from '../core/game';
import { nav, playerHourly, playerDaily, playerWeekly } from '../core/sim';
import type { GameState, Party, Settlement } from '../core/state';
import type { C2S, S2C, PRec, ServerCfg, OnlineInfo, NetParty, PrivatePart } from './protocol';
import { NETH, type ReqResult } from './hooks';
import { FACTION } from '../data/world';

export interface ChatMsg { ch: string; who: string; nation?: string | null; text: string; at: number; to?: string }
export const NET = {
  ws: null as WebSocket | null,
  url: '',
  name: '',
  rec: null as PRec | null,
  partyId: 0,
  cfg: { hoursPerSec: 0.4, allianceOpenDay: 36, pvp: true, motd: '' } as ServerCfg,
  gm: false,
  online: [] as OnlineInfo[],
  chat: [] as ChatMsg[],
  gmLog: [] as string[],
  connected: false,
  inWorld: false,
  serverTime: 0,
  recvAt: 0,
  ping: 0,
  wantClose: false,
  patchSeq: 0,
};

type Fn = (...a: any[]) => void;
const listeners: Record<string, Fn[]> = {};
export function onNet(ev: string, fn: Fn) { (listeners[ev] ||= []).push(fn); }
function fire(ev: string, ...a: any[]) { for (const f of listeners[ev] ?? []) { try { f(...a); } catch (e) { console.error(e); } } }

export function defaultUrl() {
  const saved = localStorage.getItem('mw_server');
  if (saved) return saved;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}
export function savedToken() { return localStorage.getItem('mw_token'); }
export function clearToken() { localStorage.removeItem('mw_token'); }

export function send(m: C2S) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(m)); }

const pending = new Map<number, (r: ReqResult) => void>();
let rid = 1;
NETH.req = (op, args) => new Promise<ReqResult>(res => {
  if (!NET.connected) return res({ ok: false, err: '与服务器断开了' });
  const id = rid++;
  pending.set(id, res);
  send({ t: 'req', rid: id, op, args });
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({ ok: false, err: '服务器没有响应' }); } }, 10000);
});
NETH.send = (m) => send(m);

let pingTimer = 0;
export function connect(url = defaultUrl()): Promise<void> {
  NET.url = url; NET.wantClose = false;
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
    NET.ws = ws;
    ws.onopen = () => { NET.connected = true; resolve(); clearInterval(pingTimer); pingTimer = window.setInterval(() => send({ t: 'ping', at: performance.now() }), 10000); };
    ws.onerror = () => { if (!NET.connected) reject(new Error('无法连接服务器')); };
    ws.onclose = () => {
      const was = NET.connected; NET.connected = false; clearInterval(pingTimer);
      for (const [, r] of pending) r({ ok: false, err: '与服务器断开了' }); pending.clear();
      if (was && !NET.wantClose) fire('disconnect');
    };
    ws.onmessage = (ev) => { let m: S2C; try { m = JSON.parse(ev.data); } catch { return; } try { handle(m); } catch (e) { console.error('[net]', m.t, e); } };
  });
}
export function disconnect() {
  NET.wantClose = true; NET.inWorld = false; NETH.on = false;
  try { NET.ws?.close(); } catch { /* */ }
  NET.ws = null;
}

// ---------- 状态镜像 ----------
const targets = new Map<number, { x: number; y: number }>();
const mapOwner = (o: string | null) => (o && o === 'P:' + NET.name ? 'player' : o);
function fixSt(s: Settlement) { s.owner = mapOwner(s.owner); return s; }

function fromNet(np: NetParty, rec?: PRec): Party {
  const mine = np.id === NET.partyId;
  const p: Party = {
    ...np, prisoners: [], ai: { mode: np.ai.mode, target: np.ai.target, nextThink: Infinity },
  } as Party;
  if (mine && rec) { p.kind = 'player'; p.troops = rec.troops; p.prisoners = rec.prisoners ?? []; p.gold = rec.gold; p.goods = rec.goods ?? {}; p.inside = undefined; }
  return p;
}

function buildState(m: Extract<S2C, { t: 'welcome' }>) {
  const w = m.world, rec = m.rec;
  NET.rec = rec; NET.partyId = m.partyId; NET.cfg = m.cfg; NET.gm = m.gm; NET.name = rec.name; NETH.name = rec.name;
  for (const s of Object.values(w.settlements)) fixSt(s);
  for (const [id, d] of Object.entries(w.customFactions ?? {})) FACTION[id] = d;
  const st: GameState = {
    version: w.version, seed: w.seed, time: w.time, hero: rec.hero, playerId: m.partyId, parties: [], settlements: w.settlements, lords: w.lords,
    wars: w.wars, truceUntil: w.truceUntil, alive: w.alive, playerFaction: rec.nation, mercOf: null, mercUntil: 0, ownFactionName: `${rec.name}军`,
    playerRel: rec.playerRel ?? {}, renown: rec.renown ?? 0, honor: rec.honor ?? 0, morale: rec.morale ?? 70, companions: rec.companions ?? [], quests: rec.quests ?? [],
    log: [], nextId: w.nextId + 1000000, stats: rec.stats ?? { kills: 0, won: 0, lost: 0, days: 0 }, lastDay: dayOf(w.time), speed: 1, cannons: rec.cannons,
    wallHp: w.wallHp, beacons: w.beacons, calendarDone: w.calendarDone, chronLog: w.chronLog, flags: w.flags, treaties: w.treaties, customFactions: w.customFactions, pendingDefense: null,
  };
  st.parties = m.parties.map(np => fromNet(np, rec));
  if (!st.parties.some(p => p.id === m.partyId)) st.parties.push({ id: m.partyId, kind: 'player', name: rec.name, faction: rec.nation ?? 'ming', x: rec.x ?? 0, y: rec.y ?? 0, troops: rec.troops, prisoners: [], gold: rec.gold, goods: rec.goods, ai: { mode: 'idle', nextThink: Infinity } });
  setState(st);
  ensureWorld(st);
  targets.clear();
  NET.serverTime = w.time; NET.recvAt = performance.now();
  lastHour = Math.floor(w.time); lastSyncJson = JSON.stringify(privatePart());
  NET.chat = m.chat.map(c => ({ ...c }));
  NETH.on = true; NET.inWorld = true;
}

function upsertParties(up: NetParty[], gone: number[]) {
  for (const np of up) {
    const p = partyById(np.id);
    if (np.id === NET.partyId) {
      if (p) { p.busy = np.busy; p.grace = np.grace; p.faction = np.faction; }
      continue;
    }
    if (p) {
      const { x, y, ...rest } = np;
      Object.assign(p, rest, { ai: { ...p.ai, mode: np.ai.mode, target: np.ai.target } });
      if (!targets.has(p.id)) targets.set(p.id, { x, y });
    } else S.parties.push(fromNet(np));
  }
  if (gone.length) { const g = new Set(gone); S.parties = S.parties.filter(p => p.id === NET.partyId || !g.has(p.id)); for (const id of gone) targets.delete(id); }
}

function mergeWorld(m: Extract<S2C, { t: 'world' }>) {
  NET.serverTime = m.time; NET.recvAt = performance.now();
  let ownerChanged = false;
  for (const s of m.settlements ?? []) {
    fixSt(s);
    const cur = S.settlements[s.id];
    if (cur) { if (cur.faction !== s.faction || cur.owner !== s.owner) ownerChanged = true; Object.assign(cur, s); } else { S.settlements[s.id] = s; ownerChanged = true; }
  }
  for (const l of m.lords ?? []) { const cur = S.lords[l.id]; if (cur) Object.assign(cur, l); else S.lords[l.id] = l; }
  if (m.wars) S.wars = m.wars;
  if (m.alive) S.alive = m.alive;
  if (m.truceUntil) S.truceUntil = m.truceUntil;
  if (m.treaties) S.treaties = m.treaties;
  if (m.customFactions) { S.customFactions = m.customFactions; for (const [id, d] of Object.entries(m.customFactions)) { FACTION[id] = d; if (S.alive[id] === undefined) S.alive[id] = true; } ownerChanged = true; }
  if (m.wallHp) S.wallHp = m.wallHp;
  if (m.beacons) S.beacons = m.beacons;
  if (m.chronLog) S.chronLog = m.chronLog;
  if (ownerChanged) emit('ownerChanged');
  fire('world');
}

function applyPatch(d: Extract<S2C, { t: 'patch' }>['data']) {
  const pp = player();
  const dd = d as any;
  if (d.troops) pp.troops = d.troops;
  if (typeof dd.addGold === 'number') pp.gold = Math.max(0, pp.gold + dd.addGold);
  if (typeof dd.x === 'number') { pp.x = dd.x; pp.y = dd.y; targets.set(pp.id, { x: dd.x, y: dd.y }); nav.target = null; nav.path = []; }
  if (typeof dd.hp === 'number') S.hero.hp = dd.hp;
  if (typeof d.renown === 'number') S.renown = d.renown;
  lastSyncJson = '';
}

function handle(m: S2C) {
  switch (m.t) {
    case 'auth': if (m.ok && m.token) localStorage.setItem('mw_token', m.token); if (m.name) NET.name = m.name; NET.gm = !!m.gm; fire('auth', m); return;
    case 'welcome': buildState(m); fire('welcome', m); return;
    case 'cfg': NET.cfg = m.cfg; fire('cfg'); return;
    case 'online': NET.online = m.list; fire('online'); return;
    case 'chat': NET.chat.push(m); if (NET.chat.length > 200) NET.chat.splice(0, 50); fire('chat', m); return;
    case 'gm': NET.gmLog.push(m.text); fire('gm', m.text); return;
    case 'kick': NET.wantClose = true; fire('kick', m.why); return;
    case 'pong': NET.ping = Math.round(performance.now() - m.at); return;
    case 'res': { const r = pending.get(m.rid); pending.delete(m.rid); r?.({ ok: m.ok, data: m.data, err: m.err }); return; }
  }
  if (!NET.inWorld || !S) return;
  switch (m.t) {
    case 'world': mergeWorld(m); return;
    case 'parties': upsertParties(m.up, m.gone); return;
    case 'pos': {
      NET.serverTime = m.time; NET.recvAt = performance.now();
      const a = m.a;
      for (let i = 0; i < a.length; i += 4) {
        const id = a[i]; const p = partyById(id);
        if (!p) continue;
        targets.set(id, { x: a[i + 1] / 10, y: a[i + 2] / 10 });
        p.busy = a[i + 3] & 1 ? 1 : undefined;
      }
      return;
    }
    case 'arrive': {
      const st = S.settlements[m.st];
      nav.target = null; nav.path = [];
      if (!st) return;
      if (st.kind !== 'village' && !factionHostileToSettlement(S.playerFaction ?? 'player', st)) send({ t: 'enter', st: st.id });
      const pp = player(); const t = targets.get(pp.id); if (t) { pp.x = t.x; pp.y = t.y; }
      emit('arrive', st);
      return;
    }
    case 'navEnd': nav.target = null; nav.path = []; return;
    case 'encounter': {
      const p = partyById(m.enemy);
      nav.target = null; nav.path = [];
      if (!p) { if (m.eid) void NETH.req('enc', { eid: m.eid }); return; }
      const t = targets.get(p.id); if (t) { p.x = t.x; p.y = t.y; }
      NETH.eid = m.eid;
      emit('encounter', p, m.forced);
      return;
    }
    case 'patch': applyPatch(m.data); if (m.seq) NET.patchSeq = m.seq; fire('patch', m); return;
    case 'report': fire('report', m); return;
    case 'log': log(m.msg, m.cls); return;
  }
}

// ---------- 每帧：插值、时间、个人结算、上传 ----------
let lastHour = 0, lastSyncAt = 0, lastSyncJson = '';
export function privatePart(): PrivatePart {
  const pp = player();
  return { hero: S.hero, troops: pp.troops, prisoners: pp.prisoners, gold: pp.gold, goods: pp.goods, renown: S.renown, honor: S.honor, morale: S.morale, companions: S.companions, quests: S.quests, stats: S.stats, playerRel: S.playerRel, cannons: S.cannons };
}
export function netFrame(dt: number) {
  if (!NET.inWorld) return;
  const ext = Math.min(1.5, (performance.now() - NET.recvAt) / 1000);
  S.time = NET.serverTime + ext * NET.cfg.hoursPerSec;
  const k = 1 - Math.exp(-dt * 7);
  for (const p of S.parties) {
    const t = targets.get(p.id);
    if (!t) continue;
    const dx = t.x - p.x, dy = t.y - p.y;
    if (dx * dx + dy * dy > 3600) { p.x = t.x; p.y = t.y; } else { p.x += dx * k; p.y += dy * k; }
  }
  const pp = player();
  while (nav.path.length && Math.hypot(nav.path[0][0] - pp.x, nav.path[0][1] - pp.y) < 7) nav.path.shift();
  // 个人结算（按服务器时间）
  const hr = Math.floor(S.time);
  if (hr !== lastHour) {
    const steps = Math.min(6, Math.max(0, hr - lastHour));
    for (let i = 1; i <= steps; i++) {
      const h = lastHour + i;
      try { playerHourly(); } catch (e) { console.error(e); }
      if (h % 24 === 0) {
        try { playerDaily(); } catch (e) { console.error(e); }
        if (Math.floor(h / 24) % 7 === 0) { try { playerWeekly(); } catch (e) { console.error(e); } }
        emit('daily');
      }
    }
    lastHour = hr;
  }
  const now = performance.now();
  if (now - lastSyncAt > 1500) {
    lastSyncAt = now;
    const data = privatePart();
    const j = JSON.stringify(data);
    if (j !== lastSyncJson) { lastSyncJson = j; send({ t: 'sync', data, ps: NET.patchSeq }); }
  }
}
export function forceSync() { lastSyncJson = ''; lastSyncAt = 0; }
