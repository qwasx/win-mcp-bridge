// 多人同场实时战斗：端到端测试（真服务器 + 多个无头客户端机器人）
// 运行：rm -rf /tmp/rt1 && PORT=8091 DATA_DIR=/tmp/rt1 node dist-server/server.mjs &
//       DATA_DIR=/tmp/rt1 npx tsx tools/mptest/rttest.mts
import { client, claim, gmKey, sleep, check, summary } from './lib.mjs';
import { readFrame } from '../../src/battle/wire.ts';

const KEY = gmKey();
const HTTP = (process.env.MPURL ?? 'ws://127.0.0.1:8091/ws').replace(/^ws/, 'http').replace(/\/ws$/, '');

/** 战场机器人：解码帧、维护单位位置、操控主角朝最近的敌人冲杀 */
function bot(c: any, opts: { speed?: number; aggressive?: boolean } = {}) {
  const B: any = c.B = { units: new Map<number, any>(), side: 0, hero: 0, hx: 0, hy: 0, cs: 0, atk: 0, frames: 0, bytes: 0, gaps: [] as number[], last: 0, corr: 0, starts: 0, unknown: 0, bid: 0, ended: null as any, inputs: 0, active: false, hits: 0, myHits: 0 };
  const addRow = (r: any[]) => B.units.set(r[0], { uid: r[0], side: r[1], pid: r[2], x: r[5], y: r[6], hero: !!(r[7] & 1), dead: false });
  c.onMsg = (m: any) => {
    if (m.t === 'bstart') {
      B.starts++; B.bid = m.bid; B.side = m.init.side; B.hero = m.init.hero; B.hx = m.init.hx; B.hy = m.init.hy; B.cs = m.init.cs; B.active = true; B.ended = null;
      B.units.clear(); for (const r of m.init.units) addRow(r);
      B.init = m.init; B.joined = !!m.joined; B.resume = !!m.resume;
    }
    if (m.t === 'bspawn') for (const r of m.u) addRow(r);
    if (m.t === 'bcorr') { B.corr++; B.hx = m.x; B.hy = m.y; B.cs = m.cs; }
    if (m.t === 'bend') { B.ended = m; B.active = false; }
    if (m.t === 'bgone') { B.gone = (B.gone ?? 0) + 1; B.active = false; }
  };
  c.onBin = (buf: Buffer) => {
    const now = performance.now();
    if (B.last) B.gaps.push(now - B.last);
    B.last = now; B.frames++; B.bytes += buf.length;
    const f = readFrame(new Uint8Array(buf.buffer, buf.byteOffset, buf.length));
    if (!f) return;
    for (const d of f.units) {
      const u = B.units.get(d.uid); if (!u) { B.unknown++; continue; }
      if (d.mask & 1) { u.x = d.x; u.y = d.y; } else if (d.mask & 2) { u.x += d.dx; u.y += d.dy; }
      if (d.mask & 16) u.dead = !!(d.st & 1) || !!(d.st & 4);
    }
    for (const e of f.evs) if (e.k === 2) { B.hits++; if (e.from === B.hero) B.myHits++; }
  };
  const sp = (opts.speed ?? 75) * 0.05;
  B.timer = setInterval(() => {
    if (!B.active) return;
    let best: any = null, bd = 1e9;
    for (const u of B.units.values()) { if (u.dead || u.side === B.side) continue; const d = Math.hypot(u.x - B.hx, u.y - B.hy); if (d < bd) { bd = d; best = u; } }
    let face = 0;
    if (best && opts.aggressive !== false) {
      face = Math.atan2(best.y - B.hy, best.x - B.hx);
      const st = Math.min(sp, Math.max(0, bd - 18));
      B.hx += Math.cos(face) * st; B.hy += Math.sin(face) * st;
      if (bd < 40 && Math.random() < 0.3) B.atk = (B.atk + 1) & 0xffff;
    }
    B.inputs++;
    c.send({ t: 'bi', d: [Math.round(B.hx * 10), Math.round(B.hy * 10), Math.round(face * 1000), 0, B.atk, Math.round(face * 1000), 0, 0, 0, B.cs, B.inputs % 5 === 1 ? [Math.round(B.hx - 700), Math.round(B.hy - 450), 1400, 900] : 0] });
  }, 50);
  return B;
}
const stats = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, avg: s.reduce((p, q) => p + q, 0) / Math.max(1, s.length), p95: s[Math.floor(s.length * 0.95)] ?? 0, max: s[s.length - 1] ?? 0 }; };
const getStats = async () => { try { return await (await fetch(`${HTTP}/battles`)).json(); } catch { return null; } };

const G = await client('监军', 'ming');
check('认领天命（布置测试）', await claim(G, KEY));
const A = await client('袁崇焕', 'ming');
const Bc = await client('多尔衮', 'jin');
const C = await client('祖大寿', 'ming');
await sleep(800);
for (const n of ['袁崇焕', '多尔衮', '祖大寿']) await G.gmReply(`noprotect ${n}`);
await G.gmReply('settroops 袁崇焕 ming_spear 70'); await G.gmReply('troops 袁崇焕 ming_musket 40');
await G.gmReply('settroops 多尔衮 jin_horse 60'); await G.gmReply('troops 多尔衮 jin_bayara 40'); await G.gmReply('troops 多尔衮 jin_recruit 60');
await G.gmReply('settroops 祖大寿 ming_guanning 50');
// 把三人聚到一处荒野（监军先去袁崇焕身边，再把另两人召来，然后自己离开）
await G.gmReply('goto 袁崇焕'); await sleep(300);
await G.gmReply('tpme 多尔衮'); await sleep(200);
const awayCity = Object.values(G.world.settlements as Record<string, any>).filter((s: any) => s.kind === 'town' && s.faction === 'ming').sort((a: any, b: any) => Math.hypot(b.x - G.my().x, b.y - G.my().y) - Math.hypot(a.x - G.my().x, a.y - G.my().y))[0] as any;
await sleep(1200);
const bA = bot(A, { speed: 70 }), bB = bot(Bc, { speed: 70 }), bC = bot(C, { speed: 70 });
const t0 = Date.now();
console.log('— PvP 截击 → 实时战斗 —');
A.send({ t: 'nav', kind: 'party', id: Bc.me.partyId });
for (let i = 0; i < 100 && !(bA.active && bB.active); i++) await sleep(100);
check('袁崇焕截击多尔衮：双方都进入同一场实时战斗', bA.active && bB.active && bA.bid === bB.bid && bA.bid > 0, `bid ${bA.bid}/${bB.bid}，${Date.now() - t0}ms`);
check('双方分属两边', bA.side !== bB.side);
check('开局布阵：两边都有兵', [...bA.units.values()].some((u: any) => u.side === 0) && [...bA.units.values()].some((u: any) => u.side === 1), `${bA.units.size} 单位`);
check('各自拿到自己的主角', bA.hero > 0 && bB.hero > 0 && bA.hero !== bB.hero);
check('同场玩家名单里有对方', bA.init.parties.some((p: any) => p.acct === '多尔衮') && bB.init.parties.some((p: any) => p.acct === '袁崇焕'));
await G.gmReply(`tp 我 ${awayCity.name}`);
await sleep(2500);
check('20Hz 二进制帧持续到达', bA.frames > 30 && bB.frames > 30, `A ${bA.frames} 帧 B ${bB.frames} 帧`);
check('帧里的单位都已知（先 bspawn/bstart 后帧）', bA.unknown === 0 && bB.unknown === 0, `${bA.unknown}/${bB.unknown}`);
const mapList = A.log.filter((m: any) => m.t === 'battles').pop();
check('大地图广播战场标记', !!mapList && mapList.list.some((b: any) => b.bid === bA.bid), JSON.stringify(mapList?.list ?? []));

console.log('— 第三名玩家中途加入 —');
await G.gmReply('goto 袁崇焕'); await sleep(200); await G.gmReply('tpme 祖大寿'); await sleep(200); await G.gmReply(`tp 我 ${awayCity.name}`);
await sleep(400);
const jr = await C.req('bjoin', { bid: bA.bid });
check('祖大寿加入战场（自动判定站明军一边）', jr.ok && jr.data?.side === bA.side, JSON.stringify(jr));
for (let i = 0; i < 40 && !bC.active; i++) await sleep(100);
check('加入者收到 bstart（joined）并有自己的兵', bC.active && bC.joined && [...bC.units.values()].some((u: any) => u.pid === bC.init.pid && !u.hero), `units ${bC.units.size}`);
await sleep(600);
const spawnSeen = A.log.some((m: any) => m.t === 'bspawn' && m.u.some((r: any) => r[2] === bC.init.pid));
check('原有玩家看到援军出场（bspawn）', spawnSeen);
const joinMsg = A.log.some((m: any) => m.t === 'bmsg' && /祖大寿/.test(m.text));
check('战场消息播报援军加入', joinMsg);
const far = await client('卢象升', 'ming');
await sleep(300);
const fr = await far.req('bjoin', { bid: bA.bid });
check('离战场太远不能加入', !fr.ok && /太远/.test(fr.err ?? ''), fr.err);
far.close();

console.log('— 下达指令、厮杀 —');
A.send({ t: 'bc', o: 'charge', gs: ['inf', 'rng', 'cav'] });
Bc.send({ t: 'bc', o: 'charge', gs: ['inf', 'rng', 'cav'] });
C.send({ t: 'bc', o: 'charge', gs: ['inf', 'rng', 'cav'] });
Bc.send({ t: 'bc', f: 'wedge', g: 'cav' });
await sleep(8000);
const st1 = await getStats();
const b1 = st1?.battles?.find((b: any) => b.bid === bA.bid);
check('服务器战场统计可查（/battles）', !!b1, JSON.stringify(st1));
if (b1) check('服务器每步模拟 < 10ms', b1.ms < 10, `${b1.ms} ms，在场 ${b1.units}`);
check('战斗中有命中事件', bA.hits + bB.hits > 20, `A看到 ${bA.hits} B看到 ${bB.hits}`);
const g = stats(bA.gaps);
check('帧间隔平均 ≈ 50ms', g.avg > 35 && g.avg < 75, `avg ${g.avg.toFixed(1)} p95 ${g.p95.toFixed(1)} max ${g.max.toFixed(1)}`);
const dur = (Date.now() - t0) / 1000;
const kbs = (bA.bytes + 0) / dur / 1024;
check('下行带宽（每人）< 40 KB/s', kbs < 40, `${kbs.toFixed(1)} KB/s（未计 deflate）`);
check('机器人限速移动没有触发大量纠正', bA.corr < 10 && bB.corr < 10, `A ${bA.corr} B ${bB.corr}`);
// 瞬移作弊：被拒绝并纠正
const cheat = { ...bB };
bB.active = false; // 停下机器人，模拟外挂客户端反复上报瞬移后的位置
const before = bB.corr;
for (let i = 0; i < 20 && bB.corr === before; i++) { Bc.send({ t: 'bi', d: [Math.round((cheat.hx + 900) * 10), Math.round(cheat.hy * 10), 0, 0, bB.atk, 0, 0, 0, 0, cheat.cs, 0] }); await sleep(50); }
bB.active = true;
check('瞬移被服务器拒绝并下发纠正', bB.corr > before, `corr ${before}→${bB.corr}`);
void cheat;

console.log('— 断线重连回到战场 —');
const tok = Bc.token;
clearInterval(bB.timer); Bc.close();
await sleep(1500);
const ab = A.log.some((m: any) => m.t === 'bmsg' && /多尔衮断线/.test(m.text));
check('对手断线：战场播报“由副将代为指挥”', ab);
const B2 = await client('多尔衮', 'jin', { token: tok });
const bB2 = bot(B2, { speed: 70 });
for (let i = 0; i < 40 && !bB2.active; i++) await sleep(100);
check('重连后自动回到同一场战斗（resume）', bB2.active && bB2.resume && bB2.bid === bA.bid, `bid ${bB2.bid}`);
await sleep(1000);
check('重连后帧继续到达', bB2.frames > 5, `${bB2.frames}`);

console.log('— 撤退 —');
A.send({ t: 'bleave' });
for (let i = 0; i < 40 && !bA.ended; i++) await sleep(100);
check('袁崇焕撤出战场：收到 bend（retreat）', !!bA.ended && bA.ended.retreat === true, JSON.stringify(bA.ended?.lines ?? []));
const pA = A.log.filter((m: any) => m.t === 'patch' && m.why === 'battle').pop();
check('撤退者收到兵力修正 patch', !!pA && Array.isArray(pA.data.troops));
check('撤退后战斗仍在继续（祖大寿还在）', bC.active && bB2.active);
clearInterval(bA.timer);
await sleep(200);
A.send({ t: 'bi', d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
await sleep(400);
check('离场后再发操作：收到 bgone', (bA.gone ?? 0) > 0);

console.log('— 结束与结算 —');
for (let i = 0; i < 900 && !(bB2.ended && bC.ended); i++) { await sleep(100); if (i === 600) await G.gmReply('battleend all'); }
check('战斗结束：多尔衮与祖大寿都收到 bend', !!bB2.ended && !!bC.ended, `B ${JSON.stringify(bB2.ended?.lines)} C ${JSON.stringify(bC.ended?.lines)}`);
if (bB2.ended && bC.ended) {
  check('胜负相反', bB2.ended.win !== bC.ended.win || (!bB2.ended.win && !bC.ended.win));
  const win = bB2.ended.win ? bB2.ended : bC.ended;
  check('胜者分得战利品银两', win.gold >= 0 && win.lines.some((l: string) => /击败|击倒|分得/.test(l)), JSON.stringify(win));
  check('结算附带伤亡明细（out.enemyDown）', Object.keys(win.out.enemyDown ?? {}).length > 0, JSON.stringify(win.out));
}
await sleep(2600);
const lastList = C.log.filter((m: any) => m.t === 'battles').pop();
check('战斗结束后地图标记撤销', !!lastList && !lastList.list.some((b: any) => b.bid === bA.bid));
const pB = B2.log.filter((m: any) => m.t === 'patch' && m.why === 'battle').pop();
check('双方都收到兵力/银两修正', !!pB && !!C.log.filter((m: any) => m.t === 'patch' && m.why === 'battle').pop());
await sleep(1500);
const me = A.my();
check('战后部队恢复可行动（busy 清除）', A.parties.get(A.me.partyId) && !A.parties.get(A.me.partyId).busy && !B2.parties.get(B2.me.partyId)?.busy, `${A.my()?.busy} ${B2.my()?.busy}`);
void me;
clearInterval(bB2.timer); clearInterval(bC.timer);

console.log('— 与 AI 遭遇：选择“开战”→ 服务器实时战斗 —');
const D = await client('孙承宗', 'ming');
D.autoLeave = false;
const bD = bot(D, { speed: 70 });
await G.gmReply('noprotect 孙承宗'); await G.gmReply('settroops 孙承宗 ming_spear 60');
const dCity = Object.values(G.world.settlements as Record<string, any>).find((s: any) => s.kind === 'castle' && s.faction === 'ming') as any;
await G.gmReply(`tp 孙承宗 ${dCity.name}`);
const sp = await G.gmReply(`spawn jin ${dCity.name} 50 jin_recruit`);
const pid = Number(/#(\d+)/.exec(sp?.text ?? '')?.[1]);
check('召出一支金军', pid > 0, sp?.text);
await sleep(800);
D.send({ t: 'nav', kind: 'party', id: pid });
const enc = await D.waitFor((m: any) => m.t === 'encounter', 8000);
check('遭遇金军', !!enc);
if (enc) {
  const r = await D.req('bfight', { eid: enc.eid });
  check('选择开战：服务器开出实时战斗', r.ok && r.data?.bid > 0, JSON.stringify(r));
  for (let i = 0; i < 40 && !bD.active; i++) await sleep(100);
  check('进入战场（AI 由服务器指挥）', bD.active && bD.init.parties.some((p: any) => !p.acct));
  D.send({ t: 'bc', o: 'charge', gs: ['inf', 'rng', 'cav'] });
  for (let i = 0; i < 1200 && !bD.ended; i++) await sleep(100);
  check('与 AI 的实时战斗正常结束', !!bD.ended, JSON.stringify(bD.ended?.lines));
}
clearInterval(bD.timer);
const st2 = await getStats();
check('全部战斗已清理', st2 && st2.battles.length === 0, JSON.stringify(st2));
for (const c of [G, A, B2, C, D]) c.close();
process.exit(summary() ? 1 : 0);
