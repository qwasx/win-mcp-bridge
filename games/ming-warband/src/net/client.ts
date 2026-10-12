// 联机客户端：连接、世界镜像、插值、个人结算、私有数据上传
import { S, setState, ensureWorld, emit, log, partyById, player, dayOf, factionHostileToSettlement, isNight } from '../core/game';
import { nav, playerHourly, playerDaily, playerWeekly, moveAlong } from '../core/sim';
import { mapSpeed } from '../core/party';
import { findPath, losClear } from '../core/terrain';
import { whoOf } from '../core/wall';
import { GOD } from '../core/god';
import type { GameState, Party, Settlement } from '../core/state';
import type { C2S, S2C, PRec, ServerCfg, OnlineInfo, NetParty, PrivatePart, BattleMark } from './protocol';
import { NETH, type ReqResult } from './hooks';
import { FACTION } from '../data/world';
import { setGod } from '../core/god';
import { NEWBIE } from './protocol';

export interface ChatMsg { ch: string; who: string; nation?: string | null; text: string; at: number; to?: string }
export const NET = {
  ws: null as WebSocket | null,
  url: '',
  name: '',
  rec: null as PRec | null,
  partyId: 0,
  cfg: { hoursPerSec: 0.4, allianceOpenDay: 36, pvp: true, motd: '' } as ServerCfg,
  gm: false,
  gmLevel: 0,   // 0 普通｜1 助手｜2 天命之主
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
  battles: [] as BattleMark[], // 大地图上正在进行的实时战斗
  rtt: 0,      // 平滑后的往返延迟（毫秒），用于本地预测
  corrections: 0, // 统计：本地预测被服务器纠正的次数
};

type Fn = (...a: any[]) => void;
const listeners: Record<string, Fn[]> = {};
export function onNet(ev: string, fn: Fn) { (listeners[ev] ||= []).push(fn); }
function fire(ev: string, ...a: any[]) { for (const f of listeners[ev] ?? []) { try { f(...a); } catch (e) { console.error(e); } } }

export function defaultUrl() {
  const saved = localStorage.getItem('mw_server');
  if (saved) return saved;
  // 前端托管在别的平台（如无丸 Wovoon“自建后端 Web 应用”）时，构建时写入联机服务器地址：VITE_MW_SERVER=wss://域名/ws
  const fixed = (import.meta as any).env?.VITE_MW_SERVER as string | undefined;
  if (fixed) return fixed;
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
    ws.binaryType = 'arraybuffer'; // 实时战斗的二进制帧
    ws.onopen = () => { NET.connected = true; resolve(); clearInterval(pingTimer); send({ t: 'ping', at: performance.now() }); pingTimer = window.setInterval(() => send({ t: 'ping', at: performance.now() }), 3000); };
    ws.onerror = () => { if (!NET.connected) reject(new Error('无法连接服务器')); };
    ws.onclose = () => {
      const was = NET.connected; NET.connected = false; clearInterval(pingTimer);
      for (const [, r] of pending) r({ ok: false, err: '与服务器断开了' }); pending.clear();
      if (was && !NET.wantClose) fire('disconnect');
    };
    ws.onmessage = (ev) => { if (typeof ev.data !== 'string') { fire('bframe', ev.data); return; } let m: S2C; try { m = JSON.parse(ev.data); } catch { return; } try { handle(m); } catch (e) { console.error('[net]', m.t, e); } };
  });
}
export function disconnect() {
  NET.wantClose = true; NET.inWorld = false; NETH.on = false;
  setGod(null); NET.gmLevel = 0; NET.gm = false; // 回到单机：天命失效
  try { NET.ws?.close(); } catch { /* */ }
  NET.ws = null;
}

// ---------- 状态镜像 ----------
// 其他部队：线性插值（在两次位置包之间匀速走完，不再“冲一下停一下”）
interface Tgt { fx: number; fy: number; x: number; y: number; t0: number; dur: number; last: number }
const targets = new Map<number, Tgt>();
let posPeriod = 400; // 位置包的实际间隔（毫秒，滑动平均）
let lastPosAt = 0;
function setTarget(p: Party | undefined, id: number, x: number, y: number, now: number) {
  let t = targets.get(id);
  if (!t) { targets.set(id, { fx: x, fy: y, x, y, t0: now, dur: 0, last: now }); if (p) { p.x = x; p.y = y; } return; }
  const gap = now - t.last; t.last = now;
  if (t.x === x && t.y === y) return;
  const cx = p ? p.x : t.x, cy = p ? p.y : t.y;
  if ((x - cx) ** 2 + (y - cy) ** 2 > 200 * 200) { t.fx = t.x = x; t.fy = t.y = y; t.dur = 0; if (p) { p.x = x; p.y = y; } return; } // 瞬移
  t.fx = cx; t.fy = cy; t.x = x; t.y = y; t.t0 = now;
  // 匀速走到新位置：用时≈两包间隔（稍长 10%，抖动时也不会停顿）
  t.dur = (gap > 1500 ? posPeriod : Math.max(80, gap)) * 1.1;
}

// ---------- 自己：本地预测（点了马上走），服务器位置只用来校正 ----------
const me = {
  sx: 0, sy: 0, has: false,      // 最近一次服务器位置
  srvMoveAt: 0,                  // 服务器位置最后一次变化的时间
  trail: [] as { x: number; y: number; t: number }[], // 最近 3 秒预测轨迹
  scale: 1,                      // 速度微调（与服务器对齐）
  cx: 0, cy: 0,                  // 待平滑吸收的校正量
  endAt: 0,                      // 本地路线走完的时间
  repathAt: 0, fullPathAt: 0,
};
export const PRED = me; // 测试用
function predSpeed(pp: Party) {
  const k = pp.kind; (pp as any).kind = 'hero'; // 服务器上自己是 hero：速度公式按 hero 算
  let v: number; try { v = mapSpeed(S, pp, isNight()); } finally { (pp as any).kind = k; }
  const hps = NET.cfg.paused ? (GOD.on ? 0.4 : 0) : NET.cfg.hoursPerSec;
  return v * hps * (GOD.on ? GOD.mapSpeed : 1);
}
function resetPred() { me.trail.length = 0; me.cx = me.cy = 0; me.scale = 1; }
/** 服务器给出自己的位置 */
function srvSelf(x: number, y: number, now: number) {
  if (me.has && (x !== me.sx || y !== me.sy)) me.srvMoveAt = now;
  const first = !me.has;
  me.sx = x; me.sy = y; me.has = true;
  const pp = partyById(NET.partyId);
  if (!pp) return;
  if (first) { pp.x = x; pp.y = y; return; }
  const ex = x - pp.x, ey = y - pp.y;
  if (ex * ex + ey * ey > 150 * 150) { pp.x = x; pp.y = y; resetPred(); return; } // 被传送/战后撤退
  if (!nav.path.length && now - me.endAt > 1200) return; // 静止：每帧向服务器位置靠拢（见 netFrame）
  // 在预测轨迹上找最接近服务器位置的点（从新到旧）
  const tr = me.trail;
  let best = Math.hypot(ex, ey), bx = pp.x, by = pp.y, age = 0;
  let nx = pp.x, ny = pp.y, nt = now;
  for (let i = tr.length - 1; i >= 0; i--) {
    const a = tr[i];
    const sx = nx - a.x, sy = ny - a.y, L2 = sx * sx + sy * sy;
    let u = L2 > 1e-9 ? ((x - a.x) * sx + (y - a.y) * sy) / L2 : 0; u = Math.max(0, Math.min(1, u));
    const px = a.x + sx * u, py = a.y + sy * u, d = Math.hypot(x - px, y - py);
    if (d < best - 1e-6) { best = d; bx = px; by = py; age = now - (a.t + (nt - a.t) * u); }
    nx = a.x; ny = a.y; nt = a.t;
  }
  const sp = predSpeed(pp);
  const tol = 2.5 + sp * 0.25;
  if (best > tol) {
    // 走岔了（服务器绕路/被挡/速度差太多）：把“当时”的误差平移到现在，几帧内平滑吸收
    me.cx += x - bx; me.cy += y - by; NET.corrections++;
    return;
  }
  // 同一条路上：服务器应当落后我们约 1 个往返 + 半个服务器帧
  if (nav.path.length) {
    const want = (NET.rtt || 80) + 60;
    const err = Math.max(-0.5, Math.min(0.5, (age - want) / 1000));
    if (Math.abs(age - want) > 120) me.scale = Math.max(0.8, Math.min(1.2, me.scale * (1 - err * 0.25)));
  }
}
function predictSelf(dt: number, now: number) {
  const pp = partyById(NET.partyId);
  if (!pp) return;
  const moving = nav.path.length > 0 && !pp.busy;
  if (moving) {
    // 追击：目标在动，定期重算路线
    if (nav.target?.kind === 'party' && now > me.repathAt) {
      const t = partyById(nav.target.id);
      if (t) {
        me.repathAt = now + 400;
        const who = whoOf(pp);
        if (Math.hypot(t.x - pp.x, t.y - pp.y) < 100 && losClear(pp.x, pp.y, t.x, t.y, who)) nav.path = [[t.x, t.y]];
        else if (now > me.fullPathAt) { me.fullPathAt = now + 1500; const np = findPath(pp.x, pp.y, t.x, t.y, who); if (np) nav.path = np; }
      }
    }
    const before = nav.path.length;
    moveAlong(pp, nav.path, predSpeed(pp) * me.scale * dt);
    if (!nav.path.length && before) me.endAt = now;
    me.trail.push({ x: pp.x, y: pp.y, t: now });
  } else if (me.has && (now - me.endAt > 1200 || now - me.srvMoveAt > 450)) {
    // 不走的时候：服务器位置为准（自己停下来后等服务器也停下再靠拢，避免先退后进）
    const dx = me.sx - pp.x, dy = me.sy - pp.y;
    if (dx * dx + dy * dy > 1e-4) { const k = 1 - Math.exp(-dt * 6); pp.x += dx * k; pp.y += dy * k; }
    me.trail.length = 0; me.scale = 1;
  }
  // 吸收校正量
  if (me.cx || me.cy) {
    if (me.cx * me.cx + me.cy * me.cy > 80 * 80) { pp.x += me.cx; pp.y += me.cy; me.cx = me.cy = 0; me.trail.length = 0; }
    else {
      const k = 1 - Math.exp(-dt * 8);
      pp.x += me.cx * k; pp.y += me.cy * k;
      for (const a of me.trail) { a.x += me.cx * k; a.y += me.cy * k; }
      me.cx -= me.cx * k; me.cy -= me.cy * k;
      if (Math.abs(me.cx) + Math.abs(me.cy) < 0.01) me.cx = me.cy = 0;
    }
  }
  while (me.trail.length && now - me.trail[0].t > 3000) me.trail.shift();
  if (me.trail.length > 400) me.trail.splice(0, me.trail.length - 400);
}
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
  setGod(null); NET.gmLevel = 0; // 天命状态随后单独下发（只发给 GM 本人）
  if (m.cfg.newbieHours !== undefined) NEWBIE.ms = m.cfg.newbieHours * 3600000;
  applyFnames(w.flags as Record<string, unknown> | undefined);
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
  targets.clear(); me.has = false; resetPred();
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
      (p as any).god = np.god; // 显圣标记可能被撤销
      p.busy = np.busy; p.grace = np.grace; // 战斗结束：busy 被清除（增量里缺省即为无）
      if (!targets.has(p.id)) setTarget(p, p.id, x, y, performance.now());
    } else S.parties.push(fromNet(np));
  }
  if (gone.length) { const g = new Set(gone); S.parties = S.parties.filter(p => p.id === NET.partyId || !g.has(p.id)); for (const id of gone) targets.delete(id); }
}

/** GM 改过的国号 */
function applyFnames(f: Record<string, unknown> | undefined) { for (const [k, v] of Object.entries(f ?? {})) if (k.startsWith('fname:') && FACTION[k.slice(6)] && typeof v === 'string') FACTION[k.slice(6)].name = v; }

function mergeWorld(m: Extract<S2C, { t: 'world' }>) {
  NET.serverTime = m.time; NET.recvAt = performance.now();
  let ownerChanged = false;
  for (const s of m.settlements ?? []) {
    fixSt(s);
    const cur = S.settlements[s.id];
    if (cur) { if (('faction' in s && cur.faction !== s.faction) || ('owner' in s && cur.owner !== s.owner)) ownerChanged = true; Object.assign(cur, s); } else { S.settlements[s.id] = s; ownerChanged = true; }
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
  if (m.fnames) { applyFnames(m.fnames); ownerChanged = true; }
  if (ownerChanged) emit('ownerChanged');
  fire('world');
}

function applyPatch(d: Extract<S2C, { t: 'patch' }>['data']) {
  const pp = player();
  const dd = d as any;
  if (d.troops) pp.troops = d.troops;
  if (typeof dd.addGold === 'number') pp.gold = Math.max(0, pp.gold + dd.addGold);
  if (typeof dd.x === 'number') { pp.x = dd.x; pp.y = dd.y; me.sx = dd.x; me.sy = dd.y; me.has = true; resetPred(); nav.target = null; nav.path = []; }
  if (typeof dd.hp === 'number') S.hero.hp = dd.hp;
  if (typeof d.renown === 'number') S.renown = d.renown;
  if (typeof dd.gold === 'number') pp.gold = dd.gold;
  if (d.hero) { S.hero = d.hero; if (NET.rec) NET.rec.hero = d.hero; emit('heroChanged'); }
  if (typeof d.honor === 'number') S.honor = d.honor;
  if (typeof d.morale === 'number') S.morale = d.morale;
  if (d.goods) pp.goods = d.goods;
  if (dd.faction && FACTION[dd.faction]) { S.playerFaction = dd.faction; pp.faction = dd.faction; if (NET.rec) NET.rec.nation = dd.faction; emit('ownerChanged'); }
  lastSyncJson = '';
}

function handle(m: S2C) {
  switch (m.t) {
    case 'auth': if (m.ok && m.token) localStorage.setItem('mw_token', m.token); if (m.name) NET.name = m.name; NET.gm = !!m.gm; if (!m.gm) { NET.gmLevel = 0; setGod(null); } fire('auth', m); return;
    case 'god': NET.gmLevel = m.level; NET.gm = m.level > 0; setGod(m.level >= 2 ? m.god : null); fire('god'); return;
    case 'welcome': buildState(m); fire('welcome', m); return;
    case 'cfg': NET.cfg = m.cfg; if (m.cfg.newbieHours !== undefined) NEWBIE.ms = m.cfg.newbieHours * 3600000; fire('cfg'); return;
    case 'online': NET.online = m.list; fire('online'); return;
    case 'chat': NET.chat.push(m); if (NET.chat.length > 200) NET.chat.splice(0, 50); fire('chat', m); return;
    case 'gm': if (m.text) { NET.gmLog.push(m.text); if (NET.gmLog.length > 200) NET.gmLog.splice(0, 50); } fire('gm', m.text, m.data); return;
    case 'kick': NET.wantClose = true; fire('kick', m.why); return;
    case 'pong': { const r = performance.now() - m.at; NET.ping = Math.round(r); NET.rtt = NET.rtt ? NET.rtt * 0.7 + r * 0.3 : r; fire('ping'); return; }
    case 'res': { const r = pending.get(m.rid); pending.delete(m.rid); r?.({ ok: m.ok, data: m.data, err: m.err }); return; }
  }
  if (!NET.inWorld || !S) return;
  switch (m.t) {
    case 'world': mergeWorld(m); return;
    case 'parties': upsertParties(m.up, m.gone); return;
    case 'pos': {
      const now = performance.now();
      NET.serverTime = m.time; NET.recvAt = now;
      if (m.full !== false) { if (lastPosAt) posPeriod = posPeriod * 0.8 + Math.min(1500, now - lastPosAt) * 0.2; lastPosAt = now; }
      const a = m.a;
      const idx = new Map<number, Party>(); for (const p of S.parties) idx.set(p.id, p);
      for (let i = 0; i < a.length; i += 4) {
        const id = a[i]; const p = idx.get(id);
        if (!p) continue;
        const x = a[i + 1] / 10, y = a[i + 2] / 10;
        if (id === NET.partyId) srvSelf(x, y, now); else setTarget(p, id, x, y, now);
        p.busy = a[i + 3] & 1 ? 1 : undefined;
      }
      return;
    }
    case 'arrive': {
      const st = S.settlements[m.st];
      nav.target = null; nav.path = [];
      if (!st) return;
      if (st.kind !== 'village' && !factionHostileToSettlement(S.playerFaction ?? 'player', st)) send({ t: 'enter', st: st.id });
      const pp = player(); if (me.has) { pp.x = me.sx; pp.y = me.sy; resetPred(); }
      emit('arrive', st);
      return;
    }
    case 'navEnd': nav.target = null; nav.path = []; me.endAt = performance.now(); return;
    case 'encounter': {
      const p = partyById(m.enemy);
      nav.target = null; nav.path = [];
      if (!p) { if (m.eid) void NETH.req('enc', { eid: m.eid }); return; }
      const t = targets.get(p.id); if (t) { p.x = t.x; p.y = t.y; t.fx = t.x; t.fy = t.y; t.dur = 0; }
      const pp = player(); if (me.has) { pp.x = me.sx; pp.y = me.sy; resetPred(); }
      NETH.eid = m.eid;
      emit('encounter', p, m.forced);
      return;
    }
    case 'patch': applyPatch(m.data); if (m.seq) NET.patchSeq = m.seq; fire('patch', m); return;
    case 'report': fire('report', m); return;
    case 'battles': NET.battles = m.list; fire('battles'); return;
    case 'bstart': case 'bspawn': case 'bstat': case 'bmsg': case 'bcorr': case 'bend': case 'bgone': fire(m.t, m); return;
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
  S.time = NET.serverTime + (NET.cfg.paused ? 0 : ext * NET.cfg.hoursPerSec);
  const now = performance.now();
  for (const p of S.parties) {
    if (p.id === NET.partyId) continue;
    const t = targets.get(p.id);
    if (!t) continue;
    if (t.dur <= 0) { p.x = t.x; p.y = t.y; continue; }
    const u = Math.min(1, (now - t.t0) / t.dur);
    p.x = t.fx + (t.x - t.fx) * u; p.y = t.fy + (t.y - t.fy) * u;
    if (u >= 1) t.dur = 0;
  }
  predictSelf(dt, now);
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
  if (now - lastSyncAt > 1500) {
    lastSyncAt = now;
    const data = privatePart();
    const j = JSON.stringify(data);
    if (j !== lastSyncJson) { lastSyncJson = j; send({ t: 'sync', data, ps: NET.patchSeq }); }
  }
}
export function forceSync() { lastSyncJson = ''; lastSyncAt = 0; }
