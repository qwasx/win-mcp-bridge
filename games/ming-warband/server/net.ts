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

interface Sess {
  ws: WebSocket; ip: string; acct?: string; rec?: PRec; gm: boolean; entered: boolean;
  msgTimes: number[]; chatAt: number; lastSyncAt: number; authing?: boolean;
}

export const sessions = new Set<Sess>();
const byAcct = new Map<string, Sess>();
const leaving = new Map<string, NodeJS.Timeout>();
const patchSeq = new Map<string, number>(); // 服务器下发的修正序号：旧的上传不得覆盖
let db: DB;

export function initNet(d: DB) {
  db = d;
  W.OUT.send = (acct, m) => {
    if (m.t === 'patch') { const q = (patchSeq.get(acct) ?? 0) + 1; patchSeq.set(acct, q); m.seq = q; }
    const s = byAcct.get(acct); if (s) send(s, m);
  };
  W.OUT.broadcast = (m, filter) => { const raw = JSON.stringify(m); for (const s of sessions) if (s.entered && (!filter || filter(s.acct!))) raw0(s, raw); };
  W.OUT.online = acct => byAcct.has(acct) && byAcct.get(acct)!.entered;
  W.OUT.rec = acct => byAcct.get(acct)?.rec;
}

function raw0(s: Sess, raw: string) { if (s.ws.readyState === 1) { try { s.ws.send(raw); } catch { /* */ } } }
function send(s: Sess, m: S2C) { raw0(s, JSON.stringify(m)); }
export function broadcastRaw(raw: string) { for (const s of sessions) if (s.entered) raw0(s, raw); }

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,12}$/;
/** 同 IP 每 24 小时最多注册的账号数（内存计数，重启清零） */
const REG_PER_IP = 5;
const regByIp = new Map<string, number[]>();
const BAD_WORDS = ['习近平', '共产党', '法轮', '六四', 'fuck', 'shit'];
const clean = (t: string) => { let x = t.slice(0, 200).replace(/[<>]/g, ''); for (const w of BAD_WORDS) x = x.split(w).join('*'.repeat(w.length)); return x; };

export function onConnection(ws: WebSocket, ip: string) {
  const s: Sess = { ws, ip, gm: false, entered: false, msgTimes: [], chatAt: 0, lastSyncAt: 0 };
  sessions.add(s);
  (ws as any).isAlive = true;
  ws.on('pong', () => { (ws as any).isAlive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    s.msgTimes.push(now);
    while (s.msgTimes.length && now - s.msgTimes[0] > 1000) s.msgTimes.shift();
    if (s.msgTimes.length > 60) return; // 限流
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
    W.despawnHero(acct, rec);
    db.saveRec(acct, rec);
  }, 120000));
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
      if ((m.ps ?? 0) < (patchSeq.get(s.acct) ?? 0)) { delete data.troops; delete data.gold; delete data.prisoners; } // 客户端还没收到最新修正
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
      else r = W.handleReq(rec, m.op, m.args);
      send(s, { t: 'res', rid: m.rid, ok: r.ok, data: r.data, err: r.err });
      return;
    }
    case 'chat': {
      const now = Date.now();
      if (now - s.chatAt < 800) return;
      s.chatAt = now;
      const text = clean(String(m.text ?? '')).trim();
      if (!text) return;
      if (text.startsWith('/') && s.gm) return gm(s, text.slice(1).split(/\s+/)[0], text.slice(1).split(/\s+/).slice(1));
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
    case 'gm': if (s.gm) gm(s, m.cmd, m.args ?? []); else send(s, { t: 'gm', text: '你不是 GM' }); return;
  }
}

function afterAuth(s: Sess, name: string, token: string) {
  const u = db.user(name)!;
  if (u.banned) { send(s, { t: 'auth', ok: false, err: '此账号已被封禁' }); return; }
  const old = byAcct.get(name);
  if (old && old !== s) { send(old, { t: 'kick', why: '你的账号在别处登录了' }); old.acct = undefined; old.entered = false; try { old.ws.close(); } catch { /* */ } }
  const lt = leaving.get(name); if (lt) { clearTimeout(lt); leaving.delete(name); }
  s.acct = name; s.gm = !!u.gm;
  // 已在世界中（重连）：沿用内存中的档案
  s.rec = (old?.rec && old.rec.name === name) ? old.rec : JSON.parse(u.rec) as PRec;
  byAcct.set(name, s);
  const needCreate = !s.rec.nation;
  send(s, { t: 'auth', ok: true, token, name, needCreate, gm: s.gm });
  if (!needCreate) enter(s);
}

let snapCache = { at: 0, json: '' };
function enter(s: Sess) {
  const rec = s.rec!;
  if (rec.nation && !S.alive[rec.nation]) {
    // 效忠的国家已灭亡：重新选择
    log(`${rec.name}的故国已亡，流落江湖。`, 'event');
    rec.nation = null; db.saveRec(rec.name, rec);
    send(s, { t: 'auth', ok: true, name: rec.name, needCreate: true, gm: s.gm });
    return;
  }
  const p = W.spawnHero(rec);
  s.entered = true;
  // 世界快照约 250KB：1 秒内多人上线共用同一份序列化结果
  const now = Date.now();
  if (now - snapCache.at > 1000) snapCache = { at: now, json: JSON.stringify(W.worldSnap()) };
  raw0(s, `{"t":"welcome","world":${snapCache.json},` + JSON.stringify({ rec, partyId: p.id, parties: W.visibleParties().map(W.netParty), cfg: W.CFG, gm: s.gm, chat: db.recentChat(30) }).slice(1));
  send(s, { t: 'online', list: onlineList() }); // 其他人随下一个 3 秒周期收到
}

let lastOnline = '';
function onlineList() {
  const list: OnlineInfo[] = [];
  for (const s of byAcct.values()) if (s.entered && s.rec) list.push({ name: s.acct!, nation: s.rec.nation, lvl: s.rec.hero?.level ?? 1, gm: s.gm || undefined });
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

// ---------- GM（上帝面板） ----------
function findSt(q: string) { return S.settlements[q] ?? settlementList().find(x => x.name === q); }
function findFaction(q: string): FactionId | null {
  if (FACTION[q]) return q as FactionId;
  const alias: Record<string, FactionId> = { 明: 'ming', 大明: 'ming', 明朝: 'ming', 清: 'jin', 大清: 'jin', 后金: 'jin', 金: 'jin', 闯: 'chuang', 闯军: 'chuang', 大顺: 'chuang', 西: 'xi', 西营: 'xi', 大西: 'xi', 蒙: 'mon', 蒙古: 'mon', 察哈尔: 'mon' };
  if (alias[q]) return alias[q];
  const f = Object.entries(FACTION).find(([, v]) => v.name === q || v.name.includes(q));
  return f ? (f[0] as FactionId) : null;
}
export const GM_HELP = `GM 指令：
status｜players｜online｜save｜audit
speed <每秒游戏小时>｜pvp on/off｜allianceday <日>｜motd <文字>｜say <文字>
gold <玩家> <数量>｜troops <玩家> <兵种id> <数量>｜heal <玩家>｜renown <玩家> <数量>
tp <玩家> <城名/ID>｜noprotect <玩家>（解除新手保护）｜spawn <势力> <城名> <人数>｜owner <城名> <势力>｜garrison <城名> <人数>
war <甲> <乙>｜peace <甲> <乙>｜ally <甲> <乙> [日]｜truce <甲> <乙> [日]｜vassal <宗主> <藩属>｜betray <甲> <乙>
recruit <每秒> <上限>｜speedcfg <player.max> <player.min> <ai.max> <ai.min>
kick <玩家>｜ban <玩家>｜unban <玩家>｜setgm <玩家> on/off｜pass <玩家> <新密码>
time <+小时>｜resetworld confirm`;

function gm(s: Sess, cmd: string, a: string[]) {
  const reply = (text: string, data?: any) => send(s, { t: 'gm', text, data });
  const target = (n: string) => byAcct.get(n);
  db.audit(s.acct!, `gm ${cmd} ${a.join(' ')}`);
  const num = (x: string, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
  switch (cmd) {
    case 'help': case '': return reply(GM_HELP);
    case 'noprotect': { const t = target(a[0]); if (!t?.rec) return reply('该玩家不在线'); t.rec.pvpOptIn = true; db.saveRec(t.rec.name, t.rec); return reply(`${t.rec.name}的新手保护已解除`); }
    case 'status': return reply(`在线 ${[...byAcct.values()].filter(x => x.entered).length} 人｜部队 ${S.parties.length}｜第 ${Math.floor(S.time / 24)} 日｜流速 ${W.CFG.hoursPerSec} 时/秒｜PvP ${W.CFG.pvp ? '开' : '关'}｜结盟开放日 ${W.CFG.allianceOpenDay}｜交战中 ${W.encounters.size}｜战争 ${S.wars.join(' ')}｜条约 ${(S.treaties ?? []).map(t => `${t.a}-${t.b}:${t.type}`).join(' ') || '无'}`);
    case 'players': return reply(db.allUsers().slice(0, 80).map(u => { const r = JSON.parse(u.rec) as PRec; return `${u.name}${u.gm ? '[GM]' : ''}${u.banned ? '[封]' : ''} ${r.nation ? FACTION[r.nation]?.name : '未选'} Lv${r.hero?.level ?? '-'} 银${r.gold ?? 0} 兵${(r.troops ?? []).reduce((n, x) => n + x.n, 0)} ${byAcct.has(u.name) ? '在线' : ''}`; }).join('\n'));
    case 'online': pushOnline(true); return reply([...byAcct.keys()].join('、') || '无人在线');
    case 'save': saveAll(); return reply('已保存');
    case 'audit': return reply((db.recentAudit(40) as any[]).map(x => `${new Date(x.at).toLocaleString()} ${x.who}: ${x.what}`).join('\n'));
    case 'speed': W.CFG.hoursPerSec = Math.max(0.05, Math.min(10, num(a[0], 0.4))); W.OUT.broadcast({ t: 'cfg', cfg: W.CFG }); return reply(`时间流速 = ${W.CFG.hoursPerSec} 游戏小时/秒`);
    case 'pvp': W.CFG.pvp = a[0] !== 'off'; W.OUT.broadcast({ t: 'cfg', cfg: W.CFG }); return reply(`PvP ${W.CFG.pvp ? '开启' : '关闭'}`);
    case 'allianceday': W.CFG.allianceOpenDay = Math.max(0, num(a[0], 36)); W.OUT.broadcast({ t: 'cfg', cfg: W.CFG }); return reply(`结盟开放：第 ${W.CFG.allianceOpenDay} 日`);
    case 'motd': W.CFG.motd = a.join(' '); W.OUT.broadcast({ t: 'cfg', cfg: W.CFG }); return reply('公告已更新');
    case 'say': W.OUT.broadcast({ t: 'chat', ch: 'gm', who: '天意', text: a.join(' '), at: Date.now() }); return;
    case 'gold': case 'renown': case 'heal': case 'troops': case 'tp': {
      const t = target(a[0]); const p = W.heroOf(a[0]);
      if (!t || !p) return reply('该玩家不在线');
      if (cmd === 'gold') { const n = num(a[1]); p.gold += n; t.rec!.gold += n; W.OUT.send(t.acct!, { t: 'patch', data: { addGold: n }, why: 'gm' }); }
      if (cmd === 'renown') { t.rec!.renown += num(a[1]); W.OUT.send(t.acct!, { t: 'patch', data: { renown: t.rec!.renown }, why: 'gm' }); }
      if (cmd === 'heal') { for (const x of p.troops) x.w = 0; W.OUT.send(t.acct!, { t: 'patch', data: { troops: p.troops, hp: 1 } as any, why: 'gm' }); }
      if (cmd === 'troops') { if (!TROOPS[a[1]]) return reply('兵种 id 不存在。例：ming_musket jin_bayara mon_hca'); addTroops(p.troops, a[1], num(a[2], 10)); W.OUT.send(t.acct!, { t: 'patch', data: { troops: p.troops }, why: 'gm' }); }
      if (cmd === 'tp') { const st = findSt(a[1]); if (!st) return reply('找不到此城'); p.x = st.x + 6; p.y = st.y + 6; p.inside = undefined; W.stopHero(p); W.OUT.send(t.acct!, { t: 'patch', data: { x: p.x, y: p.y } as any, why: 'gm' }); }
      send(t, { t: 'log', msg: `天意降临（GM ${cmd}）。`, cls: 'gold' });
      return reply('完成');
    }
    case 'spawn': { const f = findFaction(a[0]); const st = findSt(a[1] ?? ''); if (!f || !st) return reply('用法：spawn 大清 沈阳 300'); const p = W.gmSpawnArmy(f, st.id, Math.min(2000, num(a[2], 200))); return reply(p ? `已在${st.name}召出${p.name}（${healthy(p.troops)} 人）` : '失败'); }
    case 'owner': { const st = findSt(a[0]); const f = findFaction(a[1] ?? ''); if (!st || !f) return reply('用法：owner 北京 大清'); const old = st.faction; setOwner(st, f, null); checkFactionAlive(old); log(`天命所归：${st.name}归于${FACTION[f].name}。`, 'event'); return reply('完成'); }
    case 'garrison': { const st = findSt(a[0]); if (!st) return reply('找不到此城'); const cul = FACTION[st.faction]?.culture ?? 'ming'; const pool = Object.values(TROOPS).filter(t => t.culture === cul); for (let i = 0; i < num(a[1], 100); i++) addTroops(st.garrison, pool[Math.floor(Math.random() * pool.length)].id, 1); return reply(`${st.name}守军 ${healthy(st.garrison)}`); }
    case 'war': case 'peace': case 'ally': case 'truce': case 'vassal': case 'betray': {
      const x = findFaction(a[0] ?? ''), y = findFaction(a[1] ?? '');
      if (!x || !y || x === y) return reply('用法：war 大明 大清');
      if (cmd === 'war') { setWar(x, y, true); delete S.truceUntil[[x, y].sort().join('|')]; S.treaties = (S.treaties ?? []).filter(t => !((t.a === x && t.b === y) || (t.a === y && t.b === x))); log(`天意：${FACTION[x].name}与${FACTION[y].name}开战！`, 'event'); }
      if (cmd === 'peace') { setWar(x, y, false); log(`天意：${FACTION[x].name}与${FACTION[y].name}罢兵。`, 'event'); }
      if (cmd === 'ally') makeTreaty(x, y, 'alliance', num(a[2], DIPLO.allianceDays), '天意');
      if (cmd === 'truce') makeTreaty(x, y, 'truce', num(a[2], DIPLO.truceDays), '天意');
      if (cmd === 'vassal') makeTreaty(x, y, 'vassal', num(a[2], DIPLO.vassalDays), '天意');
      if (cmd === 'betray') breakTreaty(x, y);
      return reply('完成');
    }
    case 'recruit': RECRUIT.perSec = num(a[0], RECRUIT.perSec); RECRUIT.cap = num(a[1], RECRUIT.cap); return reply(`村庄兵源：每秒 ${RECRUIT.perSec}，上限 ${RECRUIT.cap}`);
    case 'speedcfg': SPEED.player.max = num(a[0], SPEED.player.max); SPEED.player.min = num(a[1], SPEED.player.min); SPEED.ai.max = num(a[2], SPEED.ai.max); SPEED.ai.min = num(a[3], SPEED.ai.min); return reply(`速度：玩家 ${SPEED.player.min}~${SPEED.player.max}，AI ${SPEED.ai.min}~${SPEED.ai.max}`);
    case 'kick': case 'ban': {
      const t = target(a[0]);
      if (cmd === 'ban') db.setFlag(a[0], 'banned', 1);
      if (t) { send(t, { t: 'kick', why: cmd === 'ban' ? '你已被封禁' : '你被 GM 请出了服务器' }); try { t.ws.close(); } catch { /* */ } }
      return reply('完成');
    }
    case 'unban': db.setFlag(a[0], 'banned', 0); return reply('已解封');
    case 'setgm': db.setFlag(a[0], 'gm', a[1] === 'off' ? 0 : 1); { const t = target(a[0]); if (t) t.gm = a[1] !== 'off'; } return reply('完成');
    case 'pass': if (!db.user(a[0]) || (a[1] ?? '').length < 4) return reply('用法：pass 名号 新密码'); db.setPass(a[0], a[1]); return reply('密码已重置');
    case 'time': S.time += Math.max(0, num(a[0], 24)); return reply(`时间推进到第 ${Math.floor(S.time / 24)} 日`);
    case 'resetworld': if (a[0] !== 'confirm') return reply('危险！确认请输入：resetworld confirm');
      db.set('world_prev', W.worldJSON()); db.del('world');
      for (const x of [...sessions]) { send(x, { t: 'kick', why: '天地重开，请重新登录' }); try { x.ws.close(); } catch { /* */ } }
      setTimeout(() => process.exit(0), 500); // 由守护进程重启
      return reply('世界将重置');
  }
  reply('未知指令。输入 help 查看。');
  void partyById; void PROTO_VERSION;
}

/** 效忠的国家已覆灭（如玩家国家流亡期满）：在线成员重新择主，保留角色与家当 */
export function checkOrphans() {
  for (const s of sessions) {
    if (!s.entered || !s.rec?.nation || S.alive[s.rec.nation]) continue;
    const dead = FACTION[s.rec.nation]?.name ?? s.rec.nation;
    s.rec.nation = null; db.saveRec(s.rec.name, s.rec);
    send(s, { t: 'log', msg: `${dead}国祚已绝。你流落江湖，须另择明主。`, cls: 'bad' });
    send(s, { t: 'auth', ok: true, name: s.rec.name, needCreate: true, gm: s.gm });
  }
}
