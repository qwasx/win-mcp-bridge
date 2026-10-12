// 联机网络层：会话、账号、聊天、GM、广播
import type { WebSocket } from 'ws';
import type { C2S, S2C, PRec, OnlineInfo } from '../src/net/protocol';
import { NATIONS, PROTO_VERSION, RANK_NAMES, rankOf } from '../src/net/protocol';
import { DB } from './db';
import * as W from './world';
import { propose, makeTreaty, breakTreaty, DIPLO } from './diplomacy';
import { S, setWar, partyById, settlementList, log } from '../src/core/game';
import { setOwner, checkFactionAlive } from '../src/core/combat';
import { RECRUIT } from '../src/core/recruits';
import { SPEED } from '../src/core/party';
import { addTroops, healthy } from '../src/core/party';
import { FACTION, type FactionId } from '../src/data/world';
import { TROOPS } from '../src/data/troops';
import { BACKGROUNDS } from '../src/core/game';
import { declareIndependence, indepCheck, proclaimEmperor, invite, acceptInvite, INDEP, fiefsOfAcct } from './kingdom';
import { GmKey, claimBlocked, claimFailed } from './gmkey';
import { gm } from './gm';
import { GOD_DEFAULT } from '../src/core/god';
import * as B from './battles';

/** gm：0 普通玩家｜1 助手（被天命之主任命）｜2 天命之主（凭令牌认领，唯一能开上帝模式） */
export interface Sess {
  ws: WebSocket; ip: string; acct?: string; rec?: PRec; gm: number; entered: boolean;
  msgTimes: number[]; chatAt: number; lastSyncAt: number; authing?: boolean;
}

export const sessions = new Set<Sess>();
export const byAcct = new Map<string, Sess>();
/** 供 gm.ts 使用 */
export const NETX = { db: null as unknown as DB, key: null as unknown as GmKey };
const leaving = new Map<string, NodeJS.Timeout>();
const patchSeq = new Map<string, number>(); // 服务器下发的修正序号：旧的上传不得覆盖
let db: DB;

export function initNet(d: DB, key: GmKey) {
  db = d; NETX.db = d; NETX.key = key;
  W.OUT.send = (acct, m) => {
    if (m.t === 'patch') { const q = (patchSeq.get(acct) ?? 0) + 1; patchSeq.set(acct, q); m.seq = q; }
    const s = byAcct.get(acct); if (s) send(s, m);
  };
  W.OUT.broadcast = (m, filter) => { const raw = JSON.stringify(m); for (const s of sessions) if (s.entered && (!filter || filter(s.acct!))) raw0(s, raw); };
  W.OUT.online = acct => byAcct.has(acct) && byAcct.get(acct)!.entered;
  W.OUT.rec = acct => byAcct.get(acct)?.rec;
  W.OUT.gmLevel = acct => byAcct.get(acct)?.gm ?? 0;
  B.BOUT.bin = (acct, buf) => { const s = byAcct.get(acct); if (s?.entered && s.ws.readyState === 1) { try { s.ws.send(buf, { binary: true }); } catch { /* */ } } };
  B.BOUT.json = (acct, m) => { const s = byAcct.get(acct); if (s?.entered) send(s, m); };
}

function raw0(s: Sess, raw: string) { if (s.ws.readyState === 1) { try { s.ws.send(raw); } catch { /* */ } } }
export function send(s: Sess, m: S2C) { raw0(s, JSON.stringify(m)); }
export const sysMsg = (s: Sess, text: string) => send(s, { t: 'chat', ch: 'gm', who: '系统', text, at: Date.now() });
/** 把天命状态（只）发给 GM 本人 */
export function sendGod(s: Sess) { if (s.gm) send(s, { t: 'god', god: s.gm >= 2 ? (s.rec?.god ?? null) : null, level: s.gm }); }
export function broadcastRaw(raw: string) { for (const s of sessions) if (s.entered) raw0(s, raw); }

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,12}$/;
/** 同 IP 每 24 小时最多注册的账号数（内存计数，重启清零） */
const REG_PER_IP = 5;
const regByIp = new Map<string, number[]>();
const BAD_WORDS = ['习近平', '共产党', '法轮', '六四', 'fuck', 'shit'];
const clean = (t: string) => { let x = t.slice(0, 200).replace(/[<>]/g, ''); for (const w of BAD_WORDS) x = x.split(w).join('*'.repeat(w.length)); return x; };

export function onConnection(ws: WebSocket, ip: string) {
  const s: Sess = { ws, ip, gm: 0, entered: false, msgTimes: [], chatAt: 0, lastSyncAt: 0 };
  sessions.add(s);
  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    s.msgTimes.push(now);
    while (s.msgTimes.length && now - s.msgTimes[0] > 1000) s.msgTimes.shift();
    if (s.msgTimes.length > 90) return; // 限流（实时战斗的操作上报 20 次/秒）
    let m: C2S;
    try { m = JSON.parse(String(data)); } catch { return; }
    try { handle(s, m); } catch (e) { console.error('[net] handle', m.t, e); }
  });
  ws.on('close', () => onClose(s));
  ws.on('error', () => { /* */ });
}

function onClose(s: Sess) {
  sessions.delete(s);
  if (!s.acct || byAcct.get(s.acct) !== s) return;
  byAcct.delete(s.acct);
  const acct = s.acct, rec = s.rec!;
  // 下线后部队在野外再留 2 分钟（防“下线逃跑”，期间仍可被截击、自动迎战），2 分钟内重连无缝接回
  leaving.set(acct, setTimeout(() => {
    leaving.delete(acct);
    if (byAcct.has(acct)) return;
    if (B.inBattle(acct)) { // 还在实时战斗里：等战斗结束再撤下（所部由副将代为指挥）
      const again = () => { if (byAcct.has(acct)) { leaving.delete(acct); return; } if (B.inBattle(acct)) { leaving.set(acct, setTimeout(again, 15000)); return; } leaving.delete(acct); W.despawnHero(acct, rec); db.saveRec(acct, rec); };
      leaving.set(acct, setTimeout(again, 15000)); return;
    }
    W.despawnHero(acct, rec);
    db.saveRec(acct, rec);
  }, 120000));
  B.onPresence(acct, false);
}

function handle(s: Sess, m: C2S) {
  switch (m.t) {
    case 'ping': send(s, { t: 'pong', at: m.at, srv: Date.now() }); return;
    case 'register': {
      const name = String(m.name ?? '').trim(), pass = String(m.pass ?? '');
      if (!NAME_RE.test(name)) return send(s, { t: 'auth', ok: false, err: '名号须为 2~12 个汉字、字母或数字' });
      if (BAD_WORDS.some(w => name.includes(w))) return send(s, { t: 'auth', ok: false, err: '名号不合适' });
      if (pass.length < 4) return send(s, { t: 'auth', ok: false, err: '密码至少 4 位' });
      if (db.user(name)) return send(s, { t: 'auth', ok: false, err: '此名号已被占用' });
      const regs = (regByIp.get(s.ip) ?? []).filter(t => Date.now() - t < 24 * 3600 * 1000);
      if (regs.length >= REG_PER_IP && s.ip !== '127.0.0.1' && s.ip !== '::1' && s.ip !== '::ffff:127.0.0.1') return send(s, { t: 'auth', ok: false, err: `同一网络一天最多注册 ${REG_PER_IP} 个名号` });
      regByIp.set(s.ip, [...regs, Date.now()]);
      if (s.authing) return; s.authing = true;
      void db.register(name, pass, { name, nation: null } as unknown as PRec).then(token => {
        s.authing = false;
        db.audit(name, `register from ${s.ip}`);
        if (s.ws.readyState === 1) afterAuth(s, name, token);
      }, () => { s.authing = false; send(s, { t: 'auth', ok: false, err: '此名号已被占用' }); });
      return;
    }
    case 'login': {
      const u = db.user(String(m.name ?? '').trim());
      if (!u) return send(s, { t: 'auth', ok: false, err: '名号或密码不对' });
      if (s.authing) return; s.authing = true;
      void db.checkPass(u, String(m.pass ?? '')).then(ok => {
        s.authing = false;
        if (!ok) return send(s, { t: 'auth', ok: false, err: '名号或密码不对' });
        if (s.ws.readyState === 1) afterAuth(s, u.name, db.newToken(u.name));
      });
      return;
    }
    case 'resume': {
      const u = db.userByToken(String(m.token ?? ''));
      if (!u) return send(s, { t: 'auth', ok: false, err: '登录已过期，请重新登录' });
      return afterAuth(s, u.name, u.token!);
    }
  }
  if (!s.acct || !s.rec) return;
  if (m.t === 'create') {
    if (s.rec.nation) return;
    if (!NATIONS.includes(m.nation) || !S.alive[m.nation]) return send(s, { t: 'auth', ok: false, err: '这个国家已经覆灭，请另选', needCreate: true });
    if (s.rec.hero) { // 故国已亡、重新投效：保留角色与家当
      s.rec.nation = m.nation; s.rec.playerRel[m.nation] = Math.max(s.rec.playerRel[m.nation] ?? 0, 10);
      db.saveRec(s.acct, s.rec); log(`${s.acct}改投${FACTION[m.nation].name}。`, 'event');
      return enter(s);
    }
    const bg = BACKGROUNDS.some(b => b.id === m.bg) ? m.bg : 'soldier';
    s.rec = W.createRec(s.acct, m.nation, bg);
    db.saveRec(s.acct, s.rec);
    db.audit(s.acct, `create ${m.nation} ${bg}`);
    log(`${s.acct}投效${FACTION[m.nation].name}。`, 'event');
    return enter(s);
  }
  if (!s.entered) return;
  const rec = s.rec, p = W.heroOf(s.acct);
  switch (m.t) {
    case 'nav': if (p && !p.busy) { if (!W.setHeroNav(p, m.kind, m.x, m.y, m.id)) send(s, { t: 'navEnd' }); } return;
    case 'stop': if (p) W.stopHero(p); return;
    case 'enter': {
      const st = S.settlements[m.st];
      if (p && st && !p.busy && Math.hypot(p.x - st.x, p.y - st.y) < (st.isPass ? 60 : 30) && st.kind !== 'village' && !W.heroNav.has(p.id)) {
        const hostileSt = st.siege || (st.faction !== p.faction && S.wars.includes([st.faction, p.faction].sort().join('|')));
        if (!hostileSt) p.inside = st.id;
      }
      return;
    }
    case 'leave': if (p) p.inside = undefined; return;
    case 'sync': {
      const data = { ...m.data };
      if ((m.ps ?? 0) < (patchSeq.get(s.acct) ?? 0)) return; // 客户端还没收到最新修正：这次上传作废，等下一次
      const warn = W.applySync(rec, data);
      if (warn) db.audit(s.acct, 'suspicious: ' + warn);
      return;
    }
    case 'req': {
      let r: { ok: boolean; data?: any; err?: string };
      if (m.op === 'diplo') r = diplo(s, m.args);
      else if (m.op === 'indep') { r = declareIndependence(rec, m.args ?? {}); if (r.ok) db.audit(s.acct, `independence ${JSON.stringify(m.args)}`); }
      else if (m.op === 'indepCheck') { const why = indepCheck(rec); r = { ok: !why, err: why ?? undefined, data: { ...INDEP, fiefs: fiefsOfAcct(rec.name).filter(x => x.kind !== 'village').map(x => ({ id: x.id, name: x.name })) } }; }
      else if (m.op === 'emperor') r = proclaimEmperor(rec);
      else if (m.op === 'invite') r = invite(rec, String(m.args?.name ?? ''), byAcct.get(String(m.args?.name ?? ''))?.rec);
      else if (m.op === 'acceptInvite') r = acceptInvite(rec);
      else if (m.op === 'bjoin') { const j = B.joinRT(s.acct, Number(m.args?.bid), m.args?.side === 0 || m.args?.side === 1 ? m.args.side : undefined); r = j.ok ? { ok: true, data: { side: j.side } } : { ok: false, err: j.err }; }
      else if (m.op === 'battles') r = { ok: true, data: B.battleList() };
      else r = W.handleReq(rec, m.op, m.args);
      send(s, { t: 'res', rid: m.rid, ok: r.ok, data: r.data, err: r.err });
      return;
    }
    case 'chat': {
      const now = Date.now();
      if (now - s.chatAt < 800) return;
      s.chatAt = now;
      const raw = String(m.text ?? '').trim();
      // 以 / 开头的一律是指令：绝不广播（防止误把令牌发到公屏）
      if (raw.startsWith('/')) {
        const [c0, ...args] = raw.slice(1).split(/\s+/);
        if (c0 === '天命' || c0.toLowerCase() === 'claim') return claimGm(s, args.join(''));
        if (s.gm) return gm(s, c0, args);
        return sysMsg(s, '没有这个指令。');
      }
      if ((rec.mutedUntil ?? 0) > now) return sysMsg(s, `你被禁言了，还剩 ${Math.ceil((rec.mutedUntil! - now) / 60000)} 分钟。`);
      const text = clean(raw).trim();
      if (!text) return;
      if (m.ch === 'pm') { // 私聊
        const to = String(m.to ?? '').trim(); const ts = byAcct.get(to);
        if (!ts?.entered) return send(s, { t: 'chat', ch: 'gm', who: '系统', text: `${to || '对方'}不在线`, at: now });
        const pm: S2C = { t: 'chat', ch: 'pm', who: s.acct, nation: rec.nation, text, at: now, to };
        send(ts, pm); if (ts !== s) send(s, pm);
        return;
      }
      const ch = m.ch === 'nation' ? 'nation' : 'all';
      const msg: S2C = { t: 'chat', ch, who: s.acct, nation: rec.nation, text, at: now };
      if (ch === 'all') { db.chat('all', s.acct, text); W.OUT.broadcast(msg); }
      else W.OUT.broadcast(msg, a => byAcct.get(a)?.rec?.nation === rec.nation);
      return;
    }
    case 'gm': if (s.gm) gm(s, String(m.cmd ?? ''), (m.args ?? []).map(String)); return; // 非 GM：静默忽略
    case 'bi': case 'bc': case 'bleave': case 'bsync': B.onClientMsg(s.acct, m); return;
  }
}

function afterAuth(s: Sess, name: string, token: string) {
  const u = db.user(name)!;
  if (u.banned) { send(s, { t: 'auth', ok: false, err: '此账号已被封禁' }); return; }
  const old = byAcct.get(name);
  if (old && old !== s) { send(old, { t: 'kick', why: '你的账号在别处登录了' }); old.acct = undefined; old.entered = false; try { old.ws.close(); } catch { /* */ } }
  const lt = leaving.get(name); if (lt) { clearTimeout(lt); leaving.delete(name); }
  s.acct = name; s.gm = u.gm | 0;
  // 已在世界中（重连）：沿用内存中的档案
  s.rec = (old?.rec && old.rec.name === name) ? old.rec : JSON.parse(u.rec) as PRec;
  byAcct.set(name, s);
  const needCreate = !s.rec.nation;
  send(s, { t: 'auth', ok: true, token, name, needCreate, gm: s.gm > 0 });
  if (!needCreate) enter(s);
}

let snapCache = { at: 0, json: '' };
function enter(s: Sess) {
  const rec = s.rec!;
  if (rec.nation && !S.alive[rec.nation]) {
    // 效忠的国家已灭亡：重新选择
    log(`${rec.name}的故国已亡，流落江湖。`, 'event');
    rec.nation = null; db.saveRec(rec.name, rec);
    send(s, { t: 'auth', ok: true, name: rec.name, needCreate: true, gm: s.gm > 0 });
    return;
  }
  if (s.gm < 2 && rec.god) delete rec.god; // 天命被收回
  const p = W.spawnHero(rec);
  s.entered = true;
  // 世界快照约 250KB：1 秒内多人上线共用同一份序列化结果
  const now = Date.now();
  if (now - snapCache.at > 1000) snapCache = { at: now, json: JSON.stringify(W.worldSnap()) };
  raw0(s, `{"t":"welcome","world":${snapCache.json},` + JSON.stringify({ rec, partyId: p.id, parties: W.visibleParties(s.acct).map(W.netParty), cfg: W.CFG, gm: s.gm > 0, chat: db.recentChat(30) }).slice(1));
  sendGod(s);
  send(s, { t: 'online', list: onlineList() }); // 其他人随下一个 3 秒周期收到
  send(s, { t: 'battles', list: B.battleList() });
  if (B.inBattle(s.acct!)) B.onPresence(s.acct!, true); // 重连：回到正在进行的战斗
}

let lastOnline = '';
function onlineList() {
  const list: OnlineInfo[] = [];
  for (const s of byAcct.values()) {
    if (!s.entered || !s.rec) continue;
    if (s.gm >= 2 && s.rec.god?.on && s.rec.god.hidden) continue; // 隐身：名单里也没有
    list.push({ name: s.acct!, nation: s.rec.nation, lvl: s.rec.hero?.level ?? 1 });
  }
  return list;
}
/** 在线名单：变化时随 3 秒周期合并广播（避免大批玩家同时上线时 O(N²) 刷屏） */
export function pushOnline(force = false) {
  const list = onlineList();
  const j = JSON.stringify(list);
  if (!force && j === lastOnline) return;
  lastOnline = j;
  W.OUT.broadcast({ t: 'online', list });
}

export function saveAll() {
  for (const s of byAcct.values()) if (s.rec && s.entered) {
    const p = W.heroOf(s.acct!);
    if (p) { s.rec.x = p.x; s.rec.y = p.y; s.rec.troops = p.troops; s.rec.gold = p.gold; s.rec.goods = p.goods; }
    db.saveRec(s.acct!, s.rec);
  }
  db.set('world', W.worldJSON());
  db.set('cfg', JSON.stringify({ cfg: W.CFG, recruit: RECRUIT, diplo: DIPLO }));
}

export function heartbeat() {
  for (const s of sessions) {
    const ws = s.ws as any;
    if (ws.isAlive === false) { try { ws.terminate(); } catch { /* */ } continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* */ }
  }
}

// ---------- 外交（玩家使节） ----------
function diplo(s: Sess, a: { to: FactionId; type: 'alliance' | 'truce' | 'peace' | 'vassal' | 'war'; gift?: number }) {
  const rec = s.rec!;
  if (!rec.nation) return { ok: false, err: '你尚未效忠任何国家' };
  const gift = Math.max(0, Math.min(rec.gold, Math.floor(a.gift ?? 0)));
  const r = propose(rec.name, rec.renown, rec.nation, a.to, a.type, gift);
  if (gift > 0) { rec.gold -= gift; W.OUT.send(s.acct!, { t: 'patch', data: { addGold: -gift }, why: 'gift' }); }
  if (r.ok && a.type !== 'war') { rec.renown += 30; W.OUT.send(s.acct!, { t: 'patch', data: { renown: rec.renown }, why: 'diplo' }); }
  db.audit(rec.name, `diplo ${rec.nation}->${a.to} ${a.type} gift ${gift}: ${r.ok}`);
  return { ok: r.ok, data: { msg: r.msg, rank: RANK_NAMES[rankOf(rec.renown)] }, err: r.ok ? undefined : r.msg };
}

/** 效忠的国家已覆灭（如玩家国家流亡期满）：在线成员重新择主，保留角色与家当 */
export function checkOrphans() {
  for (const s of sessions) {
    if (!s.entered || !s.rec?.nation || S.alive[s.rec.nation]) continue;
    const dead = FACTION[s.rec.nation]?.name ?? s.rec.nation;
    s.rec.nation = null; db.saveRec(s.rec.name, s.rec);
    send(s, { t: 'log', msg: `${dead}国祚已绝。你流落江湖，须另择明主。`, cls: 'bad' });
    send(s, { t: 'auth', ok: true, name: s.rec.name, needCreate: true, gm: s.gm > 0 });
  }
}

// ---------- 认领天命（GM） ----------
function claimGm(s: Sess, key: string) {
  const ks = ['ip:' + s.ip, 'acct:' + s.acct];
  if (claimBlocked(...ks)) { db.audit(s.acct!, `gm-claim blocked (${s.ip})`); return sysMsg(s, '尝试次数太多，请一小时后再试。'); }
  if (!NETX.key.check(key)) { claimFailed(...ks); db.audit(s.acct!, `gm-claim FAILED from ${s.ip}`); return sysMsg(s, '令牌不对。'); }
  db.setFlag(s.acct!, 'gm', 2); s.gm = 2;
  s.rec!.god ??= { ...GOD_DEFAULT, on: false };
  db.saveRec(s.acct!, s.rec!);
  db.audit(s.acct!, `gm-claim OK from ${s.ip}`);
  console.log(`[gm] ${s.acct} 认领了天命（${s.ip}）`);
  sendGod(s);
  W.refreshGod(s.acct!);
  sysMsg(s, '天命所归。你已是天命之主——右上角“⚙ 天意”打开上帝面板。此事只有你自己知道。');
}
