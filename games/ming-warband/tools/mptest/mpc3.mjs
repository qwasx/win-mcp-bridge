import { readFileSync } from 'node:fs';
import WebSocket from '../../node_modules/ws/wrapper.mjs';
const URL = 'ws://127.0.0.1:8091/ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(name, nation) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const st = { name, ws, me: null, world: null, parties: new Map(), pending: new Map(), rid: 1, log: [] };
    st.req = (op, args) => new Promise(r => { const rid = st.rid++; st.pending.set(rid, r); ws.send(JSON.stringify({ t: 'req', rid, op, args })); });
    st.gm = (line) => { const [cmd, ...args] = line.split(' '); ws.send(JSON.stringify({ t: 'gm', cmd, args })); };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name, pass: 'pass1234' })));
    ws.on('message', d => {
      const m = JSON.parse(String(d));
      if (m.t === 'auth') { if (!m.ok) console.log(name, 'auth err', m.err); if (m.needCreate) ws.send(JSON.stringify({ t: 'create', nation, bg: 'soldier' })); }
      if (m.t === 'welcome') { st.me = m; st.world = m.world; for (const p of m.parties) st.parties.set(p.id, p); resolve(st); }
      if (m.t === 'parties') { for (const p of m.up) st.parties.set(p.id, p); for (const id of m.gone) st.parties.delete(id); }
      if (m.t === 'world') { for (const s of m.settlements ?? []) st.world.settlements[s.id] = Object.assign(st.world.settlements[s.id] ?? {}, s); if (m.customFactions) st.world.customFactions = m.customFactions; if (m.wars) st.world.wars = m.wars; if (m.alive) st.world.alive = m.alive; }
      if (m.t === 'pos') { for (let i = 0; i < m.a.length; i += 4) { const p = st.parties.get(m.a[i]); if (p) { p.x = m.a[i + 1] / 10; p.y = m.a[i + 2] / 10; } } }
      if (m.t === 'res') { const r = st.pending.get(m.rid); st.pending.delete(m.rid); r?.(m); }
      if (['report', 'encounter', 'gm', 'patch', 'kick'].includes(m.t)) st.log.push(m);
    });
  });
}
const a = await client('艾能奇', 'xi');
const b = await client('卢象升', 'ming');
// GM：用服务器 DATA_DIR/GM_KEY.txt 里的天命令牌认领（不再是第一个注册的人）
await sleep(900); a.ws.send(JSON.stringify({ t: 'chat', ch: 'all', text: '/天命 ' + /([A-Z2-9]{4}(-[A-Z2-9]{4}){3})/.exec(readFileSync((process.env.DATA_DIR ?? '/tmp/gt1') + '/GM_KEY.txt', 'utf8'))[1] })); await sleep(700);
// 新手保护：先验证 B 截击 A 被拦下
a.gm('troops 艾能奇 xi_blade 80'); b.gm('troops 卢象升 ming_recruit 20');
globalThis.__protectTest = true;
await sleep(500);
// --- PvP：把 B 传到 A 附近，B 追击 A
const pa = a.parties.get(a.me.partyId);
const near = Object.values(a.world.settlements).filter(s => s.kind !== 'village').sort((x, y) => Math.hypot(x.x - pa.x, x.y - pa.y) - Math.hypot(y.x - pa.x, y.y - pa.y))[0];
a.gm(`tp 卢象升 ${near.id}`); a.gm(`tp 艾能奇 ${near.id}`);
await sleep(800);
b.ws.send(JSON.stringify({ t: 'nav', kind: 'party', id: a.me.partyId }));
for (let i = 0; i < 12; i++) { await sleep(300); if (b.log.some(m => m.t === 'report')) break; }
console.log('protected:', JSON.stringify(b.log.filter(m => m.t === 'report').map(m => m.title + ':' + m.lines.join(' '))));
b.log.length = 0; a.gm('noprotect 艾能奇'); await sleep(400);
b.ws.send(JSON.stringify({ t: 'nav', kind: 'party', id: a.me.partyId }));
for (let i = 0; i < 20; i++) { await sleep(300); if (b.log.some(m => m.t === 'report')) break; }
console.log('PvP B report:', JSON.stringify(b.log.filter(m => m.t === 'report').map(m => m.title + ':' + m.lines.join(' '))));
console.log('PvP A report:', JSON.stringify(a.log.filter(m => m.t === 'report').map(m => m.title + ':' + m.lines.join(' '))));
console.log('A patches', JSON.stringify(a.log.filter(m => m.t === 'patch').map(m => [m.why, m.seq, m.data.addGold, (m.data.troops||[]).reduce((n,s)=>n+s.n,0)])));
// --- 攻城：A 去打一座大明城堡
const pa2 = a.parties.get(a.me.partyId);
const target = Object.values(a.world.settlements).filter(s => s.kind === 'castle' && s.faction === 'ming').sort((x, y) => Math.hypot(x.x - pa2.x, x.y - pa2.y) - Math.hypot(y.x - pa2.x, y.y - pa2.y))[0];
a.gm(`tp 艾能奇 ${target.id}`);
await sleep(600);
console.log('siege', JSON.stringify(await a.req('siege', { st: target.id })));
const bt = await a.req('battle', { siege: target.id, win: true, captureGarrison: [{ id: 'xi_blade', n: 10, w: 0, xp: 0 }] });
console.log('battle', JSON.stringify(bt));
await sleep(3500);
console.log('castle now', a.world.settlements[target.id].name, a.world.settlements[target.id].faction, a.world.settlements[target.id].owner);
console.log('indepCheck (low renown)', JSON.stringify(await a.req('indepCheck', {})));
a.gm('renown 艾能奇 500');
await sleep(300);
a.ws.send(JSON.stringify({ t: 'sync', data: { renown: 500 }, ps: 99 }));
await sleep(300);
const ind = await a.req('indep', { name: '大蜀', ch: '蜀', color: '#1f7a5a', capital: target.id, era: '大顺' });
console.log('indep', JSON.stringify(ind).slice(0, 300));
await sleep(3500);
console.log('B sees custom factions', JSON.stringify(b.world.customFactions), 'castle', b.world.settlements[target.id].faction, b.world.settlements[target.id].owner);
console.log('wars include p_1?', b.world.wars.filter(w => w.includes('p_')));
console.log('emperor', JSON.stringify(await a.req('emperor', {})));
console.log('invite', JSON.stringify(await a.req('invite', { name: '卢象升' })));
await sleep(300);
console.log('B invite msg', JSON.stringify(b.log.filter(m => m.t === 'gm').map(m => m.text).filter(t => t.startsWith('INVITE'))));
console.log('B accept', JSON.stringify(await b.req('acceptInvite', {})));
a.gm('status');
await sleep(500);
console.log('status', a.log.filter(m => m.t === 'gm').map(m => m.text).filter(t => t.startsWith('在线')).pop());
// --- 流亡：夺走大蜀唯一的城 → 流亡 → 光复 → 再失 → 期满覆灭 → 成员重选国家
const auths = { a: [], b: [] };
for (const [k, c] of [['a', a], ['b', b]]) c.ws.on('message', d => { const m = JSON.parse(String(d)); if (m.t === 'auth') auths[k].push(m); if (m.t === 'log') c.log.push(m); });
const cf = () => a.world.customFactions?.p_1;
a.gm('owner 汉中 大明'); await sleep(3600);
console.log('after loss: alive', a.world.alive?.p_1 ?? '(n/a)', 'exileSince', cf()?.exileSince);
a.gm('owner 汉中 大蜀'); await sleep(3600);
console.log('after retake: exileSince', cf()?.exileSince, 'hz', a.world.settlements.hanzhong.faction);
a.gm('owner 汉中 大明'); await sleep(3600);
console.log('lost again: exileSince', cf()?.exileSince);
a.gm('time 1000'); await sleep(3600);
console.log('day+41: still alive?', JSON.stringify(a.world.customFactions?.p_1 ? 'yes' : 'no'), 'needCreate A', auths.a.some(m => m.needCreate));
a.gm('time 500'); await sleep(3800);
console.log('day+62: needCreate A', auths.a.some(m => m.needCreate), 'B', auths.b.some(m => m.needCreate));
console.log('A logs', JSON.stringify(a.log.filter(m => m.t === 'log').map(m => m.msg).slice(-3)));
// 重新投效：保留角色
a.ws.send(JSON.stringify({ t: 'create', nation: 'chuang', bg: 'soldier' }));
await sleep(1500);
const ap = [...a.parties.values()].find(p => p.name === '艾能奇');
console.log('A rejoined faction', ap?.faction, 'renown kept', a.me?.rec?.renown);
const got = []; a.ws.on('message', d => { const m = JSON.parse(String(d)); if (m.t === 'chat' && m.ch === 'pm') got.push(m); });
b.ws.send(JSON.stringify({ t: 'chat', ch: 'pm', to: '艾能奇', text: '密谈一事' })); await sleep(1200);
b.ws.send(JSON.stringify({ t: 'chat', ch: 'pm', to: '不存在的人', text: 'x' })); await sleep(300);
console.log('pm received by A', JSON.stringify(got.map(m => m.who + '→' + m.to + ':' + m.text)));
process.exit(0);
