// 天命（GM 上帝模式）+ 聊天 + GM 指令 全面回归。需在全新 DATA_DIR 上运行的服务器（PORT 8091）。
// 运行：DATA_DIR=/tmp/gt1 node tools/mptest/godtest.mjs
import { client, claim, gmKey, sleep, check, summary } from './lib.mjs';

const KEY = gmKey();
const G = await client('神君', 'ming');        // 第一个注册：不再自动成为 GM
const P1 = await client('李自成', 'chuang');
const P2 = await client('皇太极', 'jin');
const P3 = await client('杨嗣昌', 'ming');
const all = [G, P1, P2, P3];
await sleep(3500); // 等一轮在线名单

console.log('— 认领天命 —');
check('第一个注册的账号不是 GM', G.auth.gm === false && G.gmLevel === 0);
let r = await G.gmReply('status', 1200);
check('非 GM 发 GM 指令被静默忽略', r === null);
await sleep(900); G.chat('/天命 AAAA-BBBB-CCCC-DDDD');
const bad = await G.waitFor(m => m.t === 'chat' && m.who === '系统' && /令牌不对/.test(m.text), 2500);
check('错误令牌被拒绝', !!bad);
check('认领成功', await claim(G, KEY.toLowerCase().replace(/-/g, ' ')), '（小写、空格分隔也认）');
check('收到天命状态（level 2）', G.gmLevel === 2 && G.god && G.god.on === false);
await sleep(300);
const leaked = [P1, P2, P3].some(c => c.log.some(m => m.t === 'chat' && /天命|AAAA|令牌/.test(m.text)));
check('/天命 指令与回复没有泄露给任何其他玩家', !leaked);
await sleep(900); P1.chat('/say 我是上帝');
const no = await P1.waitFor(m => m.t === 'chat' && m.who === '系统' && /没有这个指令/.test(m.text), 2000);
check('普通玩家的 / 指令不广播、只回“没有这个指令”', !!no && !G.log.some(m => m.t === 'chat' && m.text.includes('我是上帝')));

console.log('— 隐藏 GM 身份 —');
await sleep(3200);
check('在线名单不含 gm 标记', P1.online.length >= 4 && P1.online.every(o => !('gm' in o)), JSON.stringify(P1.online));
r = await G.gmReply('god on on');
await sleep(300);
check('天命开启（默认：金身、无视敌我、天眼、金光；不显圣、不隐身）', G.god?.on && G.god.invincible && G.god.any && G.god.eye && G.god.aura && !G.god.reveal && !G.god.hidden);
check('其他玩家收不到任何 god 消息', [P1, P2, P3].every(c => !c.log.some(m => m.t === 'god')));
await sleep(1300);
const gp = () => P1.parties.get(G.me.partyId);
check('天命开启后别人看到的部队没有 god 标记（未显圣）', gp() && !gp().god);
await G.gmReply('god reveal on'); await sleep(1400);
check('显圣：别人能看到金光标记', gp()?.god === 1);
await G.gmReply('god reveal off'); await sleep(1400);
check('收起显圣：标记撤销', gp() && !gp().god);

console.log('— 隐身 —');
await G.gmReply('god hidden on'); await sleep(1500);
check('隐身：别人地图上没有 GM 的部队', !P1.parties.has(G.me.partyId) && !P2.parties.has(G.me.partyId));
check('隐身：自己仍看得到自己', G.parties.has(G.me.partyId));
await sleep(3200);
check('隐身：在线名单里没有 GM', !P1.online.some(o => o.name === '神君'), P1.online.map(o => o.name).join(','));
const before = { ...G.my() };
const reach = (lo, hi) => Object.values(G.world.settlements).filter(s => s.kind !== 'village' && s.faction === 'ming').map(s => [s, Math.hypot(s.x - G.my().x, s.y - G.my().y)]).filter(([, d]) => d > lo && d < hi).sort((a, b) => a[1] - b[1])[0]?.[0];
G.send({ t: 'nav', kind: 'settlement', id: reach(80, 600).id });
await sleep(1500);
check('隐身时自己的位置照常更新（私发）', Math.hypot(G.my().x - before.x, G.my().y - before.y) > 3, `${before.x},${before.y} → ${G.my().x},${G.my().y}`);
check('隐身时别人收不到位置', !P1.parties.has(G.me.partyId));
G.send({ t: 'stop' });
await G.gmReply('god hidden off'); await sleep(1500);
check('取消隐身：别人重新看到', P1.parties.has(G.me.partyId));

console.log('— 神行（大地图倍速）—');
async function speedTest(mult) {
  await G.gmReply(`god mapSpeed ${mult}`); await sleep(200);
  const p0 = { ...G.my() };
  // 往一座本国远城走（同一块陆地，路径够长）
  const far = reach(400, 1400) ?? reach(200, 3000);
  G.send({ t: 'nav', kind: 'settlement', id: far.id });
  await sleep(2400);
  const p1 = { ...G.my() };
  G.send({ t: 'stop' }); await sleep(300);
  return Math.hypot(p1.x - p0.x, p1.y - p0.y);
}
const d1 = await speedTest(1), d20 = await speedTest(20);
check('神行 ×20 明显快于 ×1', d20 > d1 * 8, `×1 走了 ${d1.toFixed(1)}，×20 走了 ${d20.toFixed(1)}`);
await G.gmReply('god mapSpeed 8');

console.log('— 天兵与兵力上限 —');
r = await G.gmReply('godarmy 3000 mix');
await sleep(300);
const gpatch = G.of('patch').pop();
const godN = (gpatch?.data?.troops ?? []).filter(s => s.id.startsWith('god_')).reduce((n, s) => n + s.n, 0);
check('召天兵 3000（四种天兵混编）', godN === 3000 && new Set(gpatch.data.troops.filter(s => s.id.startsWith('god_')).map(s => s.id)).size === 4, r?.text);
G.send({ t: 'sync', data: { troops: gpatch.data.troops, gold: 5000000 }, ps: gpatch.seq });
await sleep(600);
r = await G.gmReply('audit');
check('天命之主上传 3000+ 兵力/巨款不被判作弊', !/suspicious/.test(r?.text.split('\n').slice(0, 5).join('\n') ?? ''));

console.log('— 金身：玩家对玩家自动结算 —');
// 把 P2 武装起来去截 GM
await G.gmReply('troops 皇太极 jin_bayara 400'); await G.gmReply('noprotect 神君'); await G.gmReply('noprotect 皇太极');
await G.gmReply('settroops 我 ming_recruit 5'); await G.gmReply('settroops 我 god_cav 0'); await G.gmReply('settroops 我 god_guard 0'); await G.gmReply('settroops 我 god_gun 0'); await G.gmReply('settroops 我 god_bow 0');
await G.gmReply('goto 皇太极'); await sleep(800);
P2.send({ t: 'nav', kind: 'party', id: G.me.partyId });
const gWin = await G.waitFor(m => m.t === 'report' && m.title === '胜利', 6000);
check('只有 5 个民壮的 GM 被 400 精骑截击：金身必胜', !!gWin, gWin?.lines.join(' ') ?? `G busy=${G.my()?.busy} P2 reports=${JSON.stringify(P2.of('report').slice(-2))} G reports=${JSON.stringify(G.of('report').slice(-2))}`);
check('零损失', gWin && /我军损失 0 人/.test(gWin.lines.join(' ')));
const p2Lose = await P2.waitFor(m => m.t === 'report' && m.title === '战败', 2000);
check('截击者战败', !!p2Lose, p2Lose?.lines?.[0]);
const pvpLog = P1.of('log').filter(m => /神君|皇太极/.test(m.msg)).map(m => m.msg);
check('天下大事里只是一场普通胜仗（无“天意/GM/上帝”字样）', pvpLog.length > 0 && pvpLog.every(t => !/天意|GM|上帝|天命/.test(t)), pvpLog.join(' / '));

console.log('— 无视敌我：攻击友方玩家（实战）—');
await sleep(2500);
await G.gmReply('troops 杨嗣昌 ming_spear 50'); await G.gmReply('goto 杨嗣昌'); await sleep(800);
const encN = G.log.length;
G.send({ t: 'nav', kind: 'party', id: P3.me.partyId });
const enc = await G.waitFor(m => m.t === 'encounter' && m.enemy === P3.me.partyId && G.log.indexOf(m) >= encN, 6000);
check('GM 可以与同国玩家进入实战遭遇（目标被冻结）', !!enc && enc.eid > 0);
if (enc) {
  const res = await G.req('battle', { eid: enc.eid, enemy: P3.me.partyId, win: true, left: { [P3.me.partyId]: [] } });
  check('实战结果被服务器接受', res.ok);
  const p3 = await P3.waitFor(m => m.t === 'report' && m.title === '战败', 2500);
  check('被打的玩家收到战败、兵力清零', !!p3 && (P3.of('patch').pop()?.data?.troops ?? [1]).length === 0, p3?.lines?.[0]);
}

console.log('— 无视敌我：攻击友方 AI 领主 / 攻取友方城池 —');
await sleep(2500);
const myF = 'ming';
const lordP = [...G.parties.values()].filter(p => p.kind === 'lord' && p.faction === myF && !p.inside && p.lordId).sort((a, b) => Math.hypot(a.x - G.my().x, a.y - G.my().y) - Math.hypot(b.x - G.my().x, b.y - G.my().y))[0];
if (lordP) {
  await G.gmReply(`partytp ${lordP.id} me`); await sleep(1200);
  const n0 = G.log.length;
  G.send({ t: 'nav', kind: 'party', id: lordP.id });
  const e2 = await G.waitFor(m => m.t === 'encounter' && m.enemy === lordP.id && G.log.indexOf(m) >= n0, 6000);
  check('可以截击本国领主', !!e2 && e2.eid > 0, lordP.name);
  if (e2) { const rr = await G.req('battle', { eid: e2.eid, enemy: lordP.id, win: true, left: { [lordP.id]: [] } }); await sleep(1400); check('击败本国领主，部队消失', rr.ok && !G.parties.has(lordP.id)); }
} else check('找到本国领主', false);
const castle = Object.values(G.world.settlements).filter(s => s.kind === 'castle' && s.faction === myF).sort((a, b) => Math.hypot(a.x - G.my().x, a.y - G.my().y) - Math.hypot(b.x - G.my().x, b.y - G.my().y))[0];
await G.gmReply(`tp 我 ${castle.id}`); await sleep(700);
r = await G.req('siege', { st: castle.id });
check('可以围攻本国城堡', r.ok, r.err);
r = await G.req('battle', { siege: castle.id, win: true, captureGarrison: [{ id: 'god_guard', n: 10, w: 0, xp: 0 }] });
await sleep(3400);
check('攻取后成为自己的封地', G.world.settlements[castle.id].owner === 'P:神君', `${castle.name} owner=${G.world.settlements[castle.id].owner}`);
await sleep(900); P1.chat('/天命'); // 占位：让聊天限流复位

console.log('— 普通玩家受到的限制没有被破坏 —');
await G.gmReply('reprotect 李自成');
await G.gmReply('goto 李自成'); await sleep(300);
await G.gmReply('troops 皇太极 jin_bayara 100'); await G.gmReply('tp 皇太极 ' + Object.values(G.world.settlements).find(s => s.id && P1.my() && Math.hypot(s.x - P1.my().x, s.y - P1.my().y) < 60 && s.kind !== 'village')?.id);
await sleep(800);
const n2 = P2.log.length;
P2.send({ t: 'nav', kind: 'party', id: P1.me.partyId });
const prot = await P2.waitFor(m => m.t === 'report' && P2.log.indexOf(m) >= n2, 8000);
check('普通玩家截击新手仍被新手保护拦下', !!prot && /新手保护|相遇/.test(prot.title + prot.lines.join('')), prot ? prot.title + '：' + prot.lines.join('') : '无回报');

console.log('— GM 指令：玩家 —');
const cmds = [
  ['setgold 李自成 12345', m => m.why === 'gm' && m.data.addGold !== undefined],
  ['setrenown 李自成 777', m => m.data.renown === 777],
  ['level 李自成 30', m => m.data.hero?.level === 30],
  ['attr 李自成 str 25', m => m.data.hero?.attrs?.str === 25],
  ['skill 李自成 riding 8', m => m.data.hero?.skills?.riding === 8],
  ['maxhero 李自成', m => m.data.hero?.skills?.tactics === 10 && m.data.hero.attrs.cha === 30],
  ['gear 李自成', m => !!m.data.hero?.equip?.horse && !!m.data.hero.equip.armor],
  ['settroops 李自成 chuang_recruit 77', m => m.data.troops?.some(s => s.id === 'chuang_recruit' && s.n === 77)],
  ['troops 李自成 chuang_recruit -7', m => m.data.troops?.some(s => s.id === 'chuang_recruit' && s.n === 70)],
  ['heal 李自成', m => !!m.data.troops],
  ['nation 李自成 大西', m => m.data.faction === 'xi'],
  ['tp 李自成 北京', m => typeof m.data.x === 'number'],
  ['tpme 李自成', m => typeof m.data.x === 'number'],
];
for (const [line, ok] of cmds) {
  const n = P1.log.length;
  const rep = await G.gmReply(line);
  const pm = await P1.waitFor(m => m.t === 'patch' && P1.log.indexOf(m) >= n && ok(m), 1500);
  check(`gm ${line}`, !!pm, rep?.text);
}
check('被改的玩家只收到数据修正，没有“GM/天意”字样的提示', !P1.log.some(m => m.t === 'log' && /GM|天意降临/.test(m.msg)));
r = await G.gmReply('goto 李自成'); check('gm goto', /完成/.test(r?.text ?? ''));
r = await G.gmReply('nation 李自成 闯'); check('gm nation 改回', /完成/.test(r?.text ?? ''));
r = await G.gmReply('plist');
const row = r?.data?.list?.find(x => x.name === '李自成');
check('plist 结构化名单（给面板用）', row && row.online && row.lvl === 40 && row.renown === 777, JSON.stringify(row));
r = await G.gmReply('setgold 不存在的人 5'); check('不存在的玩家', /找不到/.test(r?.text ?? ''));

console.log('— 聊天：天下 / 本国 / 私聊 / 禁言 —');
await sleep(900); P1.chat('大家好，我是闯王');
await sleep(500);
check('天下频道：所有人收到', [G, P2, P3].every(c => c.log.some(m => m.t === 'chat' && m.ch === 'all' && m.text === '大家好，我是闯王' && m.who === '李自成')));
await sleep(900); P3.chat('本国弟兄集合', 'nation');
await sleep(500);
check('本国频道：同国收到', G.log.some(m => m.t === 'chat' && m.ch === 'nation' && m.text === '本国弟兄集合'));
check('本国频道：他国收不到', ![P1, P2].some(c => c.log.some(m => m.t === 'chat' && m.text === '本国弟兄集合')));
await sleep(900); P1.chat('悄悄话', 'pm', '皇太极');
await sleep(500);
check('私聊：对方收到', P2.log.some(m => m.t === 'chat' && m.ch === 'pm' && m.text === '悄悄话' && m.to === '皇太极'));
check('私聊：自己回显', P1.log.some(m => m.t === 'chat' && m.ch === 'pm' && m.text === '悄悄话'));
check('私聊：第三方收不到', ![G, P3].some(c => c.log.some(m => m.t === 'chat' && m.text === '悄悄话')));
await sleep(900); P1.chat('在吗', 'pm', '没这个人');
check('私聊不在线的人：系统提示', !!(await P1.waitFor(m => m.t === 'chat' && m.who === '系统' && /不在线/.test(m.text), 1500)));
await sleep(900); P1.chat('习近平 fuck');
await sleep(500);
check('敏感词过滤', P2.log.some(m => m.t === 'chat' && m.who === '李自成' && m.text.includes('***') && !m.text.includes('fuck')));
await G.gmReply('mute 李自成 5'); await sleep(900); P1.chat('我被禁言了吗');
check('禁言：本人收到提示', !!(await P1.waitFor(m => m.t === 'chat' && m.who === '系统' && /禁言/.test(m.text), 1500)));
await sleep(400);
check('禁言：别人收不到', !P2.log.some(m => m.t === 'chat' && m.text === '我被禁言了吗'));
await G.gmReply('unmute 李自成'); await sleep(900); P1.chat('解禁了');
await sleep(500);
check('解禁后可以说话', P2.log.some(m => m.t === 'chat' && m.text === '解禁了'));
await G.gmReply('say 天下大赦');
await sleep(400);
check('GM 广播：所有人收到“天意”公告（不暴露是谁）', [P1, P2, P3].every(c => c.log.some(m => m.t === 'chat' && m.ch === 'gm' && m.who === '天意' && m.text === '天下大赦')));
await sleep(900); G.chat('我只是个普通玩家');
await sleep(500);
check('GM 正常聊天与普通玩家无异', P1.log.some(m => m.t === 'chat' && m.who === '神君' && m.ch === 'all' && m.text === '我只是个普通玩家'));

console.log('— GM 指令：天下 —');
const bj = 'beijing' in G.world.settlements ? 'beijing' : Object.values(G.world.settlements).find(s => s.name === '北京').id;
const check2 = async (line, pred, label, ms = 3600) => { const rep = await G.gmReply(line); const t0 = Date.now(); let ok = false; while (Date.now() - t0 < ms) { if (pred()) { ok = true; break; } await sleep(100); } check(label ?? `gm ${line}`, ok, rep?.text); };
await check2(`owner ${bj} 大清`, () => P1.world.settlements[bj].faction === 'jin');
await check2(`owner ${bj} 大明 杨嗣昌`, () => P1.world.settlements[bj].faction === 'ming' && P1.world.settlements[bj].owner === 'P:杨嗣昌');
await check2(`garrison ${bj} 300 god_guard`, () => (P1.world.settlements[bj].garrison ?? []).some(s => s.id === 'god_guard' && s.n >= 300));
await check2(`cleargarrison ${bj}`, () => (P1.world.settlements[bj].garrison ?? [1]).length === 0);
await check2(`prosperity ${bj} 99`, () => P1.world.settlements[bj].prosperity === 99);
await check2(`strecruits ${bj} 222`, () => Math.floor(P1.world.settlements[bj].recruits) >= 200);
await check2('war 大明 蒙古', () => P1.world.wars.includes('ming|mon'));
await check2('peace 大明 蒙古', () => !P1.world.wars.includes('ming|mon'));
await check2('ally 大明 蒙古 30', () => (P1.world.treaties ?? []).some(t => t.type === 'alliance' && [t.a, t.b].includes('ming') && [t.a, t.b].includes('mon')));
await check2('betray 大明 蒙古', () => !(P1.world.treaties ?? []).some(t => t.type === 'alliance' && [t.a, t.b].includes('mon') && [t.a, t.b].includes('ming')));
await check2('truce 大明 大西 10', () => (P1.world.treaties ?? []).some(t => t.type === 'truce'));
await check2('rename 大西 大蜀', () => P1.world.fnames?.['fname:xi'] === '大蜀');
await check2('rename 大蜀 大西', () => P1.world.fnames?.['fname:xi'] === '大西');
const diplLogs = P1.of('log').map(m => m.msg).filter(t => /蒙古|大西|大蜀|北京/.test(t));
check('外交/易主的天下大事读起来像自然事件（无“天意”）', diplLogs.length >= 3 && diplLogs.every(t => !/天意|GM|上帝/.test(t)), diplLogs.slice(-6).join(' / '));
r = await G.gmReply(`spawn 大清 ${bj} 120 jin_bayara`);
const sid = Number(/#(\d+)/.exec(r?.text ?? '')?.[1]);
await sleep(1400);
check('召出指定兵种的大军（别人能看到）', sid && P1.parties.get(sid)?.troops?.some(s => s.id === 'jin_bayara' && s.n >= 100), `${r?.text} → ${JSON.stringify(P1.parties.get(sid)?.troops)}`);
r = await G.gmReply(`partytp ${sid} me`); check('partytp', /已移走/.test(r?.text ?? ''));
r = await G.gmReply(`smite ${sid}`); await sleep(1400);
check('smite：部队从世上抹去', /抹去/.test(r?.text ?? '') && !P1.parties.has(sid));
const lord = Object.values(G.world.lords).find(l => !l.dead && l.faction === 'jin');
r = await G.gmReply(`lordkill ${lord.id}`); check('lordkill', /已死/.test(r?.text ?? ''));
r = await G.gmReply(`lordrevive ${lord.id}`); check('lordrevive', /复生/.test(r?.text ?? ''), r?.text);
r = await G.gmReply(`lordfaction ${lord.id} 蒙古`); check('lordfaction', /→/.test(r?.text ?? ''));
r = await G.gmReply(`lordfaction ${lord.id} 大清`);
r = await G.gmReply(`lordtp ${lord.id} ${bj}`); check('lordtp', /已移到|不在野外/.test(r?.text ?? ''), r?.text);

console.log('— GM 指令：时间与规则 —');
await check2('pause', () => P1.cfg?.paused === true, 'pause：所有客户端收到暂停');
await sleep(1200); // 暂停前最后一次移动的位置包还在路上
const ai = [...P1.parties.values()].filter(p => p.kind === 'lord' && !p.inside).slice(0, 30).map(p => [p.id, p.x, p.y]);
const gb = { ...G.my() };
G.send({ t: 'nav', kind: 'point', x: gb.x + 40, y: gb.y + 30 });
await sleep(2000);
const moved = ai.filter(([id, x, y]) => { const p = P1.parties.get(id); return p && Math.hypot(p.x - x, p.y - y) > 0.5; }).length;
check('天下静止：AI 一动不动', moved === 0, `${moved}/${ai.length} 支在动`);
check('天下静止：只有天命之主还能走', Math.hypot(G.my().x - gb.x, G.my().y - gb.y) > 2);
G.send({ t: 'stop' });
await check2('resume', () => P1.cfg?.paused === false);
await check2('speed 1', () => P1.cfg?.hoursPerSec === 1);
await check2('speed 0.4', () => P1.cfg?.hoursPerSec === 0.4);
await check2('pvp off', () => P1.cfg?.pvp === false);
await check2('pvp on', () => P1.cfg?.pvp === true);
await check2('allianceday 10', () => P1.cfg?.allianceOpenDay === 10);
await check2('protect 3', () => P1.cfg?.newbieHours === 3);
const d0 = Math.floor((P1.of('world').pop()?.time ?? 0) / 24);
await check2('time 240', () => Math.floor((P1.of('world').pop()?.time ?? 0) / 24) >= d0 + 9, 'time +10 日');
for (const line of ['recruit 2 80', 'speedcfg 11 7 8 5', 'indepcfg 300 50 6 8', 'motd 欢迎', 'status', 'backup', 'save', 'online', 'players', 'help', 'god']) {
  const rep = await G.gmReply(line); check(`gm ${line}`, !!rep && !/未知指令/.test(rep.text), (rep?.text ?? '').split('\n')[0].slice(0, 80));
}
await G.gmReply('recruit 1 60'); await G.gmReply('speedcfg 10 7 8 5');

console.log('— 权限分级 —');
r = await G.gmReply('setgm 皇太极 on'); await sleep(300);
check('任命助手 GM：对方收到 level 1、没有天命', P2.gmLevel === 1 && P2.god === null, r?.text);
r = await P2.gmReply('god on on'); check('助手不能开上帝模式', /只有天命之主/.test(r?.text ?? ''));
r = await P2.gmReply('newkey'); check('助手不能换令牌', /只有天命之主/.test(r?.text ?? ''));
r = await P2.gmReply('setgm 李自成 on'); check('助手不能任命 GM', /只有天命之主/.test(r?.text ?? ''));
r = await P2.gmReply('status'); check('助手可以用普通 GM 指令', /在线/.test(r?.text ?? ''));
r = await G.gmReply('setgm 皇太极 off'); await sleep(300);
check('收回 GM', P2.gmLevel === 0);
r = await P2.gmReply('status', 1000); check('收回后指令无效', r === null);
r = await G.gmReply('setgm 我 off'); check('不能改自己的权限', /不能/.test(r?.text ?? ''));

console.log('— 踢人 / 封禁 / 改密码 —');
const P4 = await client('吴三桂', 'ming');
r = await G.gmReply('kick 吴三桂'); await sleep(400);
check('kick', P4.kicked === '你被请出了服务器', P4.kicked);
r = await G.gmReply('ban 吴三桂');
const P4b = await client('吴三桂', 'ming', { login: true, allowFail: true }); await sleep(800);
check('ban：无法登录', P4b.auth && !P4b.auth.ok && /封禁/.test(P4b.auth.err ?? ''), P4b.auth?.err);
await G.gmReply('unban 吴三桂');
await G.gmReply('pass 吴三桂 newpass99');
const P4c = await client('吴三桂', 'ming', { login: true, pass: 'newpass99', allowFail: true }); await sleep(500);
check('unban + 改密码后用新密码登录', P4c.auth?.ok === true, P4c.auth?.err);

console.log('— 令牌管理 —');
r = await G.gmReply('newkey');
const NEWKEY = r?.data?.key;
check('换新令牌', !!NEWKEY && NEWKEY !== KEY);
check('旧令牌失效', !(await claim(P4c, KEY)));
check('新令牌有效（P4 也成为天命之主——令牌就是身份）', await claim(P4c, NEWKEY));
await G.gmReply('setgm 吴三桂 off'); await sleep(300);
check('天命之主可以撤掉冒领者', P4c.gmLevel === 0);
// 暴力破解限流（同 IP）：连错 5 次后锁一小时
for (let i = 0; i < 5; i++) { await sleep(850); P3.chat('/天命 WRONG-KEY' + i); }
await sleep(900); P3.chat('/天命 ' + NEWKEY);
const blk = await P3.waitFor(m => m.t === 'chat' && m.who === '系统' && /太多/.test(m.text), 2500);
check('连错 5 次后，正确令牌也被限流拒绝', !!blk && P3.gmLevel === 0);

console.log('— 重连后天命保持 —');
const tok = G.token;
const godMsgs0 = [P1, P2, P3].map(c => c.of('god').length);
G.close(); await sleep(600);
const G2 = await client('神君', 'ming', { token: tok });
await sleep(500);
check('断线重连：天命状态保持（只发给自己）', G2.gmLevel === 2 && G2.god?.on === true, JSON.stringify(G2.god));
check('重连后别人仍收不到 god 消息', [P1, P2, P3].every((c, i) => c.of('god').length === godMsgs0[i]));
console.log(`（测试期间 AI 主动来袭 ${[G, P1, P2, P3].map(c => c.name + (c.ambushed ?? 0)).join(' ')} 次，已自动突围）`);
await G2.gmReply('god on off'); await sleep(200);
check('收起天命', G2.god?.on === false);

const fails = summary();
for (const c of [G2, P1, P2, P3, P4, P4b, P4c]) c.close();
process.exit(fails ? 1 : 0);
