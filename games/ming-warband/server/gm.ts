// GM 指令（上帝面板的唯一后端）。所有操作都记入审计；回复只发给执行者本人，其他玩家看不到任何“GM”痕迹。
import type { PRec, S2C } from '../src/net/protocol';
import { NEWBIE, newbieLeft } from '../src/net/protocol';
import * as W from './world';
import { makeTreaty, breakTreaty, DIPLO } from './diplomacy';
import { S, setWar, partyById, settlementList, log, removeParty, spawnLordParty } from '../src/core/game';
import { setOwner, checkFactionAlive } from '../src/core/combat';
import { RECRUIT } from '../src/core/recruits';
import { SPEED, addTroops, healthy, count, cleanStacks } from '../src/core/party';
import { nearestPassable, passable } from '../src/core/terrain';
import { FACTION, type FactionId } from '../src/data/world';
import { TROOPS, GOD_TROOPS } from '../src/data/troops';
import { ITEM_LIST } from '../src/data/items';
import { SKILLS } from '../src/core/character';
import { normGod, GOD_DEFAULT, type GodState } from '../src/core/god';
import type { Party, Settlement } from '../src/core/state';
import { INDEP } from './kingdom';
import { byAcct, sessions, send, sendGod, pushOnline, saveAll, NETX, type Sess } from './net';

export const GM_HELP = `GM 指令（“我”可代指自己）：
【概况】status｜players｜plist｜online｜save｜backup｜audit｜motd <文字>｜say <文字>
【时间规则】speed <时/秒>｜pause｜resume｜time <+小时>｜pvp on/off｜allianceday <日>｜protect <小时>
  recruit <每秒> <上限>｜speedcfg <玩家max> <玩家min> <AImax> <AImin>｜indepcfg <声望> <兵力> <称帝城数> <国家上限>
【玩家】gold/setgold <玩家> <数>｜renown/setrenown｜honor｜level <玩家> <级>｜attr <玩家> <str|agi|int|cha> <数>
  skill <玩家> <技能id> <级>｜maxhero <玩家>｜gear <玩家>｜heal <玩家>｜troops <玩家> <兵种id> <数>（可为负）
  settroops <玩家> <兵种id> <数>｜cleartroops <玩家>｜nation <玩家> <势力>｜tp <玩家> <城>｜tpme <玩家>｜goto <玩家>
  noprotect <玩家>｜reprotect <玩家>｜mute <玩家> <分钟>｜unmute｜kick｜ban｜unban｜pass <玩家> <新密码>
【天下】owner <城> <势力> [玩家]｜garrison <城> <数> [兵种id]｜cleargarrison <城>｜prosperity <城> <数>｜strecruits <城> <数>
  spawn <势力> <城> <人数> [兵种id]｜smite <部队id>｜partytp <部队id> <城|me>
  war/peace <甲> <乙>｜ally/truce <甲> <乙> [日]｜vassal <宗主> <藩属>｜betray <甲> <乙>｜rename <势力> <新名>
  lordkill/lordrevive <领主>｜lordfaction <领主> <势力>｜lordtp <领主> <城>
【天命·仅天命之主】god｜god <项> <值>（on invincible oneHit mapSpeed battleSpeed aura reveal hidden any eye）
  godarmy <人数> [cav|guard|gun|bow|mix]｜tpxy <x> <y>｜setgm <玩家> on/off｜newkey｜resetworld confirm`;

/** 只有天命之主（gm=2）能用的指令 */
const OWNER_ONLY = new Set(['god', 'godarmy', 'tpxy', 'setgm', 'newkey', 'resetworld', 'pass']);

export function findSt(q: string): Settlement | undefined { return S.settlements[q] ?? settlementList().find(x => x.name === q); }
export function findFaction(q: string): FactionId | null {
  if (!q) return null;
  if (FACTION[q]) return q as FactionId;
  const alias: Record<string, FactionId> = { 明: 'ming', 大明: 'ming', 明朝: 'ming', 清: 'jin', 大清: 'jin', 后金: 'jin', 金: 'jin', 闯: 'chuang', 闯军: 'chuang', 大顺: 'chuang', 西: 'xi', 西营: 'xi', 大西: 'xi', 蒙: 'mon', 蒙古: 'mon', 察哈尔: 'mon', 匪: 'bandit' as FactionId };
  if (alias[q]) return alias[q];
  const f = Object.entries(FACTION).find(([, v]) => v.name === q || v.name.includes(q));
  return f ? (f[0] as FactionId) : null;
}
function findLord(q: string) { return S.lords[q] ?? Object.values(S.lords).find(l => l.name === q); }

/** 目标玩家（在线或离线都能改） */
interface Tgt { name: string; rec: PRec; sess?: Sess; party?: Party; online: boolean }
function tgt(me: Sess, q: string): Tgt | null {
  const name = q === '我' || q === 'me' || !q ? me.acct! : q;
  const s = byAcct.get(name);
  if (s?.rec) return { name, rec: s.rec, sess: s, party: W.heroOf(name), online: !!s.entered };
  const u = NETX.db.user(name); if (!u) return null;
  return { name, rec: JSON.parse(u.rec) as PRec, online: false };
}
function patch(t: Tgt, data: any) { if (t.online) W.OUT.send(t.name, { t: 'patch', data, why: 'gm' }); }
function saveT(t: Tgt) { NETX.db.saveRec(t.name, t.rec); }
/** 兵力：在线玩家以部队为准 */
function troopsOf(t: Tgt) { return t.party ? t.party.troops : (t.rec.troops ??= []); }
function setTroopsT(t: Tgt, troops: PRec['troops']) {
  cleanStacks(troops);
  if (t.party) t.party.troops = troops;
  t.rec.troops = troops;
  patch(t, { troops });
}
function goldT(t: Tgt, v: number) {
  v = Math.max(0, Math.round(v));
  const d = v - (t.party ? t.party.gold : t.rec.gold);
  if (t.party) t.party.gold = v;
  t.rec.gold = v;
  patch(t, { addGold: d });
}
function heroT(t: Tgt, fn: (h: PRec['hero']) => void) {
  if (!t.rec.hero) return false;
  fn(t.rec.hero);
  if (t.party) { t.party.lvl = t.rec.hero.level; t.party.hp = t.rec.hero.hp; }
  patch(t, { hero: t.rec.hero });
  return true;
}
function bestGear() {
  const eq: Record<string, string | null> = { melee: null, ranged: null, armor: null, helm: null, horse: null };
  for (const slot of Object.keys(eq)) {
    const best = ITEM_LIST.filter(i => i.slot === slot).sort((a, b) => b.price - a.price)[0];
    eq[slot] = best?.id ?? null;
  }
  return eq;
}
function moveParty(p: Party, x: number, y: number) {
  if (!passable(x, y)) [x, y] = nearestPassable(x, y);
  p.x = x; p.y = y; p.inside = undefined;
  if (p.kind === 'hero') { W.stopHero(p); W.OUT.send(p.acct!, { t: 'patch', data: { x, y } as any, why: 'gm' }); }
  else { p.ai.path = []; p.ai.mode = 'idle'; p.ai.nextThink = S.time + 1; }
}
function plist() {
  return NETX.db.allUsers().slice(0, 300).map(u => {
    const r = JSON.parse(u.rec) as PRec; const s = byAcct.get(u.name); const live = s?.rec ?? r; const p = W.heroOf(u.name);
    return {
      name: u.name, online: !!s?.entered, nation: live.nation, lvl: live.hero?.level ?? 0, gold: p ? p.gold : live.gold ?? 0, renown: live.renown ?? 0,
      troops: count(p ? p.troops : live.troops ?? []), gm: u.gm, banned: !!u.banned, muted: Math.max(0, Math.ceil(((live.mutedUntil ?? 0) - Date.now()) / 60000)),
      protect: Math.ceil(newbieLeft(live) / 60000), x: p ? Math.round(p.x) : null, y: p ? Math.round(p.y) : null, last: u.last,
    };
  });
}
function godSet(s: Sess, k: string, v: string) {
  const rec = s.rec!;
  const g: GodState = normGod(rec.god ?? { ...GOD_DEFAULT, on: false });
  const keys = ['on', 'invincible', 'oneHit', 'mapSpeed', 'battleSpeed', 'aura', 'reveal', 'hidden', 'any', 'eye'] as const;
  const key = keys.find(x => x.toLowerCase() === k.toLowerCase());
  if (!key) return false;
  if (key === 'mapSpeed' || key === 'battleSpeed') (g as any)[key] = Number(v);
  else (g as any)[key] = !(v === 'off' || v === '0' || v === 'false');
  rec.god = normGod(g);
  NETX.db.saveRec(s.acct!, rec);
  sendGod(s);
  W.refreshGod(s.acct!);
  pushOnline(true);
  return true;
}

export function gm(s: Sess, cmd: string, a: string[]) {
  const reply = (text: string, data?: any) => send(s, { t: 'gm', text, data });
  const num = (x: string | undefined, d = 0) => (x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : d);
  cmd = (cmd ?? '').trim();
  if (cmd !== 'plist' && cmd !== 'god' || a.length) NETX.db.audit(s.acct!, `gm ${cmd} ${a.join(' ')}`.slice(0, 300));
  if (OWNER_ONLY.has(cmd) && s.gm < 2) return reply('这条指令只有天命之主能用。');
  const cfgOut = () => W.OUT.broadcast({ t: 'cfg', cfg: W.CFG });
  switch (cmd) {
    case 'help': case '': return reply(GM_HELP);
    // ---------- 概况 ----------
    case 'status': return reply(`在线 ${[...byAcct.values()].filter(x => x.entered).length} 人｜部队 ${S.parties.length}｜第 ${Math.floor(S.time / 24)} 日｜流速 ${W.CFG.hoursPerSec} 时/秒${W.CFG.paused ? '（已暂停）' : ''}｜PvP ${W.CFG.pvp ? '开' : '关'}｜结盟开放日 ${W.CFG.allianceOpenDay}｜新手保护 ${NEWBIE.ms / 3600000} 小时｜交战中 ${W.encounters.size}｜战争 ${S.wars.join(' ')}｜条约 ${(S.treaties ?? []).map(t => `${t.a}-${t.b}:${t.type}`).join(' ') || '无'}`,
      { kind: 'status', cfg: W.CFG, recruit: RECRUIT, speed: SPEED, indep: INDEP, newbieHours: NEWBIE.ms / 3600000 });
    case 'players': return reply(plist().slice(0, 80).map(u => `${u.name}${u.gm ? `[GM${u.gm}]` : ''}${u.banned ? '[封]' : ''}${u.muted ? '[禁言]' : ''} ${u.nation ? FACTION[u.nation]?.name : '未选'} Lv${u.lvl || '-'} 银${u.gold} 兵${u.troops} ${u.online ? '在线' : ''}`).join('\n'));
    case 'plist': return reply('', { kind: 'plist', list: plist() });
    case 'online': pushOnline(true); return reply([...byAcct.values()].filter(x => x.entered).map(x => x.acct).join('、') || '无人在线');
    case 'save': saveAll(); return reply('已保存');
    case 'backup': saveAll(); NETX.db.backup(); return reply('已备份（DATA_DIR/backup-日期.db，保留 7 天）');
    case 'audit': return reply((NETX.db.recentAudit(60) as any[]).map(x => `${new Date(x.at).toLocaleString('zh-CN')} ${x.who}: ${x.what}`).join('\n'));
    case 'motd': W.CFG.motd = a.join(' '); cfgOut(); return reply('公告已更新');
    case 'say': if (!a.length) return reply('用法：say 文字'); W.OUT.broadcast({ t: 'chat', ch: 'gm', who: '天意', text: a.join(' ').slice(0, 300), at: Date.now() }); return reply('已发布');
    // ---------- 时间与规则 ----------
    case 'speed': W.CFG.hoursPerSec = Math.max(0.05, Math.min(10, num(a[0], 0.4))); W.CFG.paused = false; cfgOut(); return reply(`时间流速 = ${W.CFG.hoursPerSec} 游戏小时/秒`);
    case 'pause': W.CFG.paused = true; cfgOut(); return reply('天下静止：除你之外万物停顿（再点“继续”恢复）');
    case 'resume': W.CFG.paused = false; cfgOut(); return reply('时间恢复流动');
    case 'time': S.time += Math.max(0, Math.min(24 * 365, num(a[0], 24))); return reply(`时间推进到第 ${Math.floor(S.time / 24)} 日`);
    case 'pvp': W.CFG.pvp = a[0] !== 'off'; cfgOut(); return reply(`PvP ${W.CFG.pvp ? '开启' : '关闭'}`);
    case 'allianceday': W.CFG.allianceOpenDay = Math.max(0, num(a[0], 36)); cfgOut(); return reply(`结盟开放：第 ${W.CFG.allianceOpenDay} 日`);
    case 'protect': W.CFG.newbieHours = Math.max(0, Math.min(240, num(a[0], 2))); NEWBIE.ms = W.CFG.newbieHours * 3600000; cfgOut(); return reply(`新手保护 = ${W.CFG.newbieHours} 小时`);
    case 'recruit': RECRUIT.perSec = Math.max(0, num(a[0], RECRUIT.perSec)); RECRUIT.cap = Math.max(1, num(a[1], RECRUIT.cap)); return reply(`村庄兵源：每秒 ${RECRUIT.perSec}，上限 ${RECRUIT.cap}`);
    case 'speedcfg': SPEED.player.max = num(a[0], SPEED.player.max); SPEED.player.min = num(a[1], SPEED.player.min); SPEED.ai.max = num(a[2], SPEED.ai.max); SPEED.ai.min = num(a[3], SPEED.ai.min); return reply(`速度：玩家 ${SPEED.player.min}~${SPEED.player.max}，AI ${SPEED.ai.min}~${SPEED.ai.max}`);
    case 'indepcfg': { if (a.length) { INDEP.renown = num(a[0], INDEP.renown); INDEP.troops = num(a[1], INDEP.troops); INDEP.emperorCities = num(a[2], INDEP.emperorCities); INDEP.maxKingdoms = num(a[3], INDEP.maxKingdoms); } return reply(`自立：声望 ${INDEP.renown}｜兵力 ${INDEP.troops}｜称帝城数 ${INDEP.emperorCities}｜玩家国家上限 ${INDEP.maxKingdoms}`); }
    // ---------- 玩家 ----------
    case 'gold': case 'setgold': case 'renown': case 'setrenown': case 'honor': case 'level': case 'attr': case 'skill': case 'maxhero': case 'gear': case 'heal':
    case 'troops': case 'settroops': case 'cleartroops': case 'nation': case 'tp': case 'tpme': case 'goto': case 'noprotect': case 'reprotect': case 'mute': case 'unmute': {
      const t = tgt(s, a[0] ?? '');
      if (!t) return reply('找不到这个玩家');
      if (!t.rec.nation && !['noprotect', 'reprotect', 'mute', 'unmute'].includes(cmd)) return reply('该玩家还没建角色');
      switch (cmd) {
        case 'gold': goldT(t, (t.party ? t.party.gold : t.rec.gold) + num(a[1])); break;
        case 'setgold': goldT(t, num(a[1])); break;
        case 'renown': case 'setrenown': t.rec.renown = Math.max(0, cmd === 'renown' ? (t.rec.renown ?? 0) + num(a[1]) : num(a[1])); patch(t, { renown: t.rec.renown }); break;
        case 'honor': t.rec.honor = num(a[1]); patch(t, { honor: t.rec.honor }); break;
        case 'level': heroT(t, h => { h.level = Math.max(1, Math.min(99, num(a[1], h.level))); }); break;
        case 'attr': { const k = a[1] as 'str'; if (!['str', 'agi', 'int', 'cha'].includes(k)) return reply('属性：str agi int cha'); heroT(t, h => { h.attrs[k] = Math.max(1, Math.min(60, num(a[2], h.attrs[k]))); }); break; }
        case 'skill': { const k = a[1] as keyof PRec['hero']['skills']; if (!(k in (t.rec.hero?.skills ?? {}))) return reply('技能 id：' + SKILLS.map(x => x.id).join(' ')); heroT(t, h => { h.skills[k] = Math.max(0, Math.min(10, num(a[2], h.skills[k]))); }); break; }
        case 'maxhero': heroT(t, h => { h.level = Math.max(h.level, 40); for (const k of Object.keys(h.attrs) as (keyof typeof h.attrs)[]) h.attrs[k] = 30; for (const k of Object.keys(h.skills) as (keyof typeof h.skills)[]) h.skills[k] = 10; h.hp = 1; }); break;
        case 'gear': heroT(t, h => { const eq = bestGear(); for (const v of Object.values(h.equip)) if (v && !h.inventory.includes(v)) h.inventory.push(v); Object.assign(h.equip, eq); h.inventory = h.inventory.filter(i => !Object.values(eq).includes(i)).slice(-60); }); break;
        case 'heal': { const tr = troopsOf(t); for (const x of tr) x.w = 0; heroT(t, h => { h.hp = 1; }); setTroopsT(t, tr); break; }
        case 'troops': { if (!TROOPS[a[1]]) return reply('兵种 id 不存在。例：ming_musket jin_bayara mon_hca god_cav'); const tr = troopsOf(t); const n = Math.trunc(num(a[2], 10)); if (n >= 0) addTroops(tr, a[1], Math.min(20000, n)); else { const st = tr.find(x => x.id === a[1]); if (st) { st.n = Math.max(0, st.n + n); st.w = Math.min(st.w, st.n); } } setTroopsT(t, tr); break; }
        case 'settroops': { if (!TROOPS[a[1]]) return reply('兵种 id 不存在'); const tr = troopsOf(t).filter(x => x.id !== a[1]); const n = Math.max(0, Math.min(20000, Math.trunc(num(a[2])))); if (n) tr.push({ id: a[1], n, w: 0, xp: 0 }); setTroopsT(t, tr); break; }
        case 'cleartroops': setTroopsT(t, []); break;
        case 'nation': { const f = findFaction(a[1] ?? ''); if (!f || !S.alive[f]) return reply('势力不存在或已灭亡'); t.rec.nation = f; t.rec.playerRel ??= {}; t.rec.playerRel[f] = Math.max(t.rec.playerRel[f] ?? 0, 10); if (t.party) t.party.faction = f; patch(t, { faction: f }); break; }
        case 'tp': { const st = findSt(a[1] ?? ''); if (!st) return reply('找不到此城'); if (t.party) moveParty(t.party, st.x + 6, st.y + 6); else { t.rec.x = st.x + 6; t.rec.y = st.y + 6; } break; }
        case 'tpme': { const me = W.heroOf(s.acct!); if (!me || !t.party) return reply('双方都要在世界中'); moveParty(t.party, me.x + 8, me.y + 4); break; }
        case 'goto': { const me = W.heroOf(s.acct!); if (!me || !t.party) return reply('双方都要在世界中'); moveParty(me, t.party.x + 8, t.party.y + 4); break; }
        case 'noprotect': t.rec.pvpOptIn = true; break;
        case 'reprotect': t.rec.pvpOptIn = false; t.rec.created = Date.now(); break;
        case 'mute': t.rec.mutedUntil = Date.now() + Math.max(1, num(a[1], 30)) * 60000; break;
        case 'unmute': t.rec.mutedUntil = 0; break;
      }
      saveT(t);
      return reply(`${t.name}：${cmd} 完成`);
    }
    case 'kick': case 'ban': case 'unban': case 'pass': case 'setgm':
      if (a[0] === '我' || a[0] === 'me') a[0] = s.acct!;
  }
  switch (cmd) {
    case 'kick': case 'ban': {
      if (!NETX.db.user(a[0] ?? '')) return reply('找不到这个玩家');
      if (a[0] === s.acct) return reply('不能对自己这么做');
      if (cmd === 'ban') NETX.db.setFlag(a[0], 'banned', 1);
      const t = byAcct.get(a[0]);
      if (t) { send(t, { t: 'kick', why: cmd === 'ban' ? '此账号已被封禁' : '你被请出了服务器' }); try { t.ws.close(); } catch { /* */ } }
      return reply(`${a[0]}：${cmd === 'ban' ? '已封禁' : '已踢出'}`);
    }
    case 'unban': if (!NETX.db.user(a[0] ?? '')) return reply('找不到这个玩家'); NETX.db.setFlag(a[0], 'banned', 0); return reply('已解封');
    case 'pass': if (!NETX.db.user(a[0] ?? '') || (a[1] ?? '').length < 4) return reply('用法：pass 名号 新密码（至少 4 位）'); NETX.db.setPass(a[0], a[1]); return reply('密码已重置（该玩家需用新密码重新登录）');
    case 'setgm': {
      if (!NETX.db.user(a[0] ?? '')) return reply('找不到这个玩家');
      if (a[0] === s.acct) return reply('不能改自己的权限');
      const lv = a[1] === 'off' ? 0 : a[1] === 'owner' ? 2 : 1;
      NETX.db.setFlag(a[0], 'gm', lv);
      const t = byAcct.get(a[0]);
      if (t) { t.gm = lv; if (lv < 2 && t.rec?.god) { delete t.rec.god; W.refreshGod(a[0]); } send(t, { t: 'god', god: lv >= 2 ? (t.rec?.god ?? null) : null, level: lv }); }
      return reply(`${a[0]}：${lv === 2 ? '天命之主' : lv === 1 ? '助手 GM（不能开上帝模式）' : '已收回 GM'}`);
    }
    case 'newkey': { const k = NETX.key.renew(); return reply(`新的天命令牌：${k}\n（已写入服务器 GM_KEY.txt；旧令牌立即作废。已认领的 GM 不受影响）`, { kind: 'key', key: k }); }
    case 'resetworld': if (a[0] !== 'confirm') return reply('危险！确认请输入：resetworld confirm');
      NETX.db.set('world_prev', W.worldJSON()); NETX.db.del('world');
      for (const x of [...sessions]) { send(x, { t: 'kick', why: '天地重开，请重新登录' }); try { x.ws.close(); } catch { /* */ } }
      setTimeout(() => process.exit(0), 500); // 由守护进程重启
      return reply('世界将重置');
    // ---------- 天下 ----------
    case 'spawn': {
      const f = findFaction(a[0] ?? ''); const st = findSt(a[1] ?? '');
      if (!f || !st || !FACTION[f]) return reply('用法：spawn 大清 沈阳 300 [兵种id]');
      if (a[3] && !TROOPS[a[3]]) return reply('兵种 id 不存在');
      const p = W.gmSpawnArmy(f, st.id, Math.max(1, Math.min(3000, num(a[2], 200))), a[3]);
      return reply(p ? `已在${st.name}召出${p.name}（${healthy(p.troops)} 人，部队 #${p.id}）` : '失败');
    }
    case 'smite': case 'partytp': {
      const p = partyById(num(a[0], -1));
      if (!p || p.id === S.playerId) return reply('找不到这支部队（用部队 id）');
      if (cmd === 'smite') {
        if (p.kind === 'hero') { if (godOfSafe(p)) return reply('不能对天命之主出手'); p.troops = []; W.OUT.send(p.acct!, { t: 'patch', data: { troops: [] }, why: 'gm' }); W.OUT.send(p.acct!, { t: 'report', title: '天降灾殃', lines: ['一场突如其来的瘟疫与山洪，你的军队一夜之间荡然无存。'] }); return reply(`${p.name}的军队已化为乌有`); }
        removeParty(p); return reply(`${p.name}（#${p.id}）已从世上抹去`);
      }
      const me = W.heroOf(s.acct!);
      if (a[1] === 'me' || a[1] === '我') { if (!me) return reply('你不在世界中'); moveParty(p, me.x + 10, me.y + 6); }
      else { const st = findSt(a[1] ?? ''); if (!st) return reply('找不到此城'); moveParty(p, st.x + 8, st.y + 8); }
      return reply(`${p.name} 已移走`);
    }
    case 'owner': {
      const st = findSt(a[0] ?? ''); const f = findFaction(a[1] ?? '');
      if (!st || !f || !FACTION[f]) return reply('用法：owner 北京 大清 [玩家]');
      const who = a[2] ? (NETX.db.user(a[2]) ? 'P:' + a[2] : null) : null;
      if (a[2] && !who) return reply('找不到这个玩家');
      const old = st.faction;
      st.siege = null;
      setOwner(st, f, who);
      checkFactionAlive(old);
      if (old !== f) log(`${st.name}易帜，归于${FACTION[f].name}。`, 'event');
      return reply(`${st.name} → ${FACTION[f].name}${who ? `（${a[2]}的封地）` : ''}`);
    }
    case 'garrison': case 'cleargarrison': case 'prosperity': case 'strecruits': {
      const st = findSt(a[0] ?? ''); if (!st) return reply('找不到此城');
      if (cmd === 'cleargarrison') st.garrison = [];
      if (cmd === 'prosperity') st.prosperity = Math.max(0, Math.min(100, num(a[1], st.prosperity)));
      if (cmd === 'strecruits') st.recruits = Math.max(0, Math.min(500, num(a[1], st.recruits)));
      if (cmd === 'garrison') {
        const n = Math.max(-5000, Math.min(5000, Math.trunc(num(a[1], 100))));
        if (a[2] && !TROOPS[a[2]]) return reply('兵种 id 不存在');
        if (n < 0) { let left = -n; for (const g of [...st.garrison].reverse()) { const k = Math.min(left, g.n); g.n -= k; g.w = Math.min(g.w, g.n); left -= k; if (!left) break; } cleanStacks(st.garrison); }
        else if (a[2]) addTroops(st.garrison, a[2], n);
        else { const cul = FACTION[st.faction]?.culture ?? 'ming'; const pool = Object.values(TROOPS).filter(t => t.culture === cul); for (let i = 0; i < n; i++) addTroops(st.garrison, pool[Math.floor(Math.random() * pool.length)].id, 1); }
      }
      return reply(`${st.name}：守军 ${healthy(st.garrison)}｜繁荣 ${Math.round(st.prosperity)}｜兵源 ${Math.floor(st.recruits)}`);
    }
    case 'war': case 'peace': case 'ally': case 'truce': case 'vassal': case 'betray': {
      const x = findFaction(a[0] ?? ''), y = findFaction(a[1] ?? '');
      if (!x || !y || x === y || !FACTION[x] || !FACTION[y]) return reply('用法：war 大明 大清');
      if (cmd === 'war') { setWar(x, y, true); delete S.truceUntil[[x, y].sort().join('|')]; S.treaties = (S.treaties ?? []).filter(t => !((t.a === x && t.b === y) || (t.a === y && t.b === x))); log(`${FACTION[x].name}与${FACTION[y].name}兵戎相见！`, 'event'); }
      if (cmd === 'peace') { setWar(x, y, false); S.treaties = (S.treaties ?? []).filter(t => !((t.a === x && t.b === y) || (t.a === y && t.b === x))); log(`${FACTION[x].name}与${FACTION[y].name}罢兵言和。`, 'event'); }
      if (cmd === 'ally') makeTreaty(x, y, 'alliance', num(a[2], DIPLO.allianceDays), '');
      if (cmd === 'truce') makeTreaty(x, y, 'truce', num(a[2], DIPLO.truceDays), '');
      if (cmd === 'vassal') makeTreaty(x, y, 'vassal', num(a[2], DIPLO.vassalDays), '');
      if (cmd === 'betray') breakTreaty(x, y);
      return reply(`${FACTION[x].name} ↔ ${FACTION[y].name}：${cmd} 完成`);
    }
    case 'rename': {
      const f = findFaction(a[0] ?? ''); const nm = (a[1] ?? '').slice(0, 8);
      if (!f || !FACTION[f] || !nm) return reply('用法：rename 大明 大汉');
      const old = FACTION[f].name;
      FACTION[f].name = nm;
      if (S.customFactions?.[f]) S.customFactions[f].name = nm;
      S.flags ??= {}; S.flags['fname:' + f] = nm;
      log(`${old}改国号为${nm}。`, 'event');
      return reply(`${old} → ${nm}`);
    }
    case 'lordkill': case 'lordrevive': case 'lordfaction': case 'lordtp': {
      const l = findLord(a[0] ?? ''); if (!l) return reply('找不到这位领主（名字或 id）');
      const p = l.partyId ? partyById(l.partyId) : undefined;
      if (cmd === 'lordkill') { if (p) removeParty(p); l.dead = true; l.partyId = null; log(`${FACTION[l.faction]?.name ?? ''}的${l.name}暴卒。`, 'event'); return reply(`${l.name} 已死`); }
      if (cmd === 'lordrevive') { l.dead = false; if (!p) { l.respawnAt = S.time; spawnLordParty(l); } return reply(`${l.name} 已复生${l.partyId ? `（部队 #${l.partyId}）` : '（其势力无城可归，等有城再出）'}`); }
      if (cmd === 'lordfaction') { const f = findFaction(a[1] ?? ''); if (!f || !FACTION[f] || !S.alive[f]) return reply('势力不存在或已灭亡'); const old = l.faction; l.faction = f; if (p) p.faction = f; if (old !== f) log(`${l.name}改投${FACTION[f].name}。`, 'event'); return reply(`${l.name} → ${FACTION[f].name}`); }
      const st = findSt(a[1] ?? ''); if (!st || !p) return reply('找不到此城，或该领主不在野外');
      moveParty(p, st.x + 8, st.y + 8); return reply(`${l.name} 已移到${st.name}`);
    }
    // ---------- 天命 ----------
    case 'god': {
      if (a.length >= 2 && !godSet(s, a[0], a[1])) return reply('项：on invincible oneHit mapSpeed battleSpeed aura reveal hidden any eye');
      if (a.length === 1 && (a[0] === 'on' || a[0] === 'off')) godSet(s, 'on', a[0]);
      const g = s.rec!.god ?? { ...GOD_DEFAULT, on: false };
      return reply(a.length ? '' : `天命：${g.on ? '开' : '关'}｜金身 ${g.invincible ? '开' : '关'}｜一击必杀 ${g.oneHit ? '开' : '关'}｜神行 ×${g.mapSpeed}｜战场 ×${g.battleSpeed}｜金光 ${g.aura ? '开' : '关'}｜显圣 ${g.reveal ? '开' : '关'}｜隐身 ${g.hidden ? '开' : '关'}｜无视敌我 ${g.any ? '开' : '关'}｜天眼 ${g.eye ? '开' : '关'}`, { kind: 'god', god: g });
    }
    case 'godarmy': {
      const me = tgt(s, '我'); if (!me?.rec.nation) return reply('先建角色');
      const n = Math.max(1, Math.min(5000, Math.trunc(num(a[0], 300))));
      const kind = a[1] ?? 'mix';
      const tr = troopsOf(me);
      const pick = (i: number) => kind === 'cav' ? 'god_cav' : kind === 'guard' ? 'god_guard' : kind === 'gun' ? 'god_gun' : kind === 'bow' ? 'god_bow' : GOD_TROOPS[[0, 0, 1, 1, 2, 3][i % 6]];
      const add: Record<string, number> = {};
      for (let i = 0; i < n; i++) { const id = pick(i); add[id] = (add[id] ?? 0) + 1; }
      for (const [id, k] of Object.entries(add)) addTroops(tr, id, k);
      setTroopsT(me, tr); saveT(me);
      return reply(`天兵 ${n} 人已归入麾下（现有 ${count(tr)} 人）`);
    }
    case 'tpxy': {
      const me = W.heroOf(s.acct!); if (!me) return reply('你不在世界中');
      const x = num(a[0], NaN), y = num(a[1], NaN); if (!Number.isFinite(x) || !Number.isFinite(y)) return reply('用法：tpxy x y');
      moveParty(me, x, y); return reply('');
    }
  }
  reply('未知指令。输入 help 查看。');
}
function godOfSafe(p: Party) { return !!W.godOf(p); }
export type { S2C };
