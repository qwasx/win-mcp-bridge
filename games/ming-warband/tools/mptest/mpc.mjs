import WebSocket from '../../node_modules/ws/wrapper.mjs';
const URL = process.env.URL ?? 'ws://127.0.0.1:8091/ws';
function client(name, nation) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const st = { name, ws, msgs: {}, me: null, world: null, parties: new Map(), pending: new Map(), rid: 1, log: [] };
    st.req = (op, args) => new Promise(r => { const rid = st.rid++; st.pending.set(rid, r); ws.send(JSON.stringify({ t: 'req', rid, op, args })); });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name, pass: 'pass1234' })));
    ws.on('message', d => {
      const m = JSON.parse(String(d));
      st.msgs[m.t] = (st.msgs[m.t] || 0) + 1;
      if (m.t === 'auth') { if (!m.ok) console.log(name, 'auth err', m.err); if (m.needCreate) ws.send(JSON.stringify({ t: 'create', nation, bg: 'soldier' })); }
      if (m.t === 'welcome') { st.me = m; st.world = m.world; for (const p of m.parties) st.parties.set(p.id, p); resolve(st); }
      if (m.t === 'parties') { for (const p of m.up) st.parties.set(p.id, p); for (const id of m.gone) st.parties.delete(id); }
      if (m.t === 'pos') { for (let i = 0; i < m.a.length; i += 4) { const p = st.parties.get(m.a[i]); if (p) { p.x = m.a[i + 1] / 10; p.y = m.a[i + 2] / 10; } } st.time = m.time; }
      if (m.t === 'res') { const r = st.pending.get(m.rid); st.pending.delete(m.rid); r?.(m); }
      if (['chat', 'log', 'report', 'encounter', 'arrive', 'gm', 'patch', 'navEnd', 'kick'].includes(m.t)) st.log.push(m);
    });
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const a = await client('张献忠迷', 'xi');
const b = await client('李定国', 'ming');
console.log('welcome sizes ok; partyId', a.me.partyId, 'gm?', a.me.gm, b.me.gm, 'parties', a.parties.size, 'settlements', Object.keys(a.world.settlements).length);
const meA = a.parties.get(a.me.partyId);
console.log('A at', meA.x.toFixed(0), meA.y.toFixed(0), 'troops', JSON.stringify(meA.troops), 'gold', a.me.rec.gold);
// 找最近的本国村庄
const vs = Object.values(a.world.settlements).filter(s => s.kind === 'village' && s.faction === 'xi');
vs.sort((x, y) => Math.hypot(x.x - meA.x, x.y - meA.y) - Math.hypot(y.x - meA.x, y.y - meA.y));
const v = vs[0];
console.log('go to village', v.name, 'dist', Math.hypot(v.x - meA.x, v.y - meA.y).toFixed(0), 'recruits', v.recruits);
a.ws.send(JSON.stringify({ t: 'nav', kind: 'settlement', id: v.id }));
a.ws.send(JSON.stringify({ t: 'gm', cmd: 'speed', args: ['6'] }));
a.ws.send(JSON.stringify({ t: 'chat', ch: 'all', text: '大家好！' }));
b.ws.send(JSON.stringify({ t: 'chat', ch: 'nation', text: '明军集合' }));
for (let i = 0; i < 40; i++) { await sleep(500); if (a.log.some(m => m.t === 'arrive')) break; }
const arr = a.log.find(m => m.t === 'arrive');
const pa = a.parties.get(a.me.partyId);
console.log('arrive', arr, 'pos', pa.x.toFixed(0), pa.y.toFixed(0), 'time', a.time?.toFixed(1));
const r1 = await a.req('recruit', { st: v.id, n: 100 });
console.log('recruit', JSON.stringify(r1));
const r2 = await a.req('recruit', { st: v.id, n: 5 });
console.log('recruit again', JSON.stringify(r2));
// 上传私有数据
a.ws.send(JSON.stringify({ t: 'sync', data: { troops: [...pa.troops, { id: r1.data?.troop ?? 'xi_recruit', n: r1.data?.n ?? 0, w: 0, xp: 0 }], gold: 999 } }));
await sleep(1500);
console.log('B sees A troops', JSON.stringify(b.parties.get(a.me.partyId)?.troops), 'gold', b.parties.get(a.me.partyId)?.gold);
// 外交
const d = await a.req('diplo', { to: 'chuang', type: 'alliance' });
console.log('diplo', JSON.stringify(d));
a.ws.send(JSON.stringify({ t: 'gm', cmd: 'status', args: [] }));
a.ws.send(JSON.stringify({ t: 'gm', cmd: 'ally', args: ['大西', '闯'] }));
await sleep(1500);
console.log('A msgs', JSON.stringify(a.msgs));
console.log('B msgs', JSON.stringify(b.msgs));
for (const m of a.log.filter(m => ['chat', 'gm', 'log'].includes(m.t)).slice(0, 14)) console.log(' A>', m.t, m.who ?? '', (m.text ?? m.msg ?? '').slice(0, 160));
for (const m of b.log.filter(m => m.t === 'chat')) console.log(' B> chat', m.ch, m.who, m.text);
a.ws.send(JSON.stringify({ t: 'gm', cmd: 'speed', args: ['0.4'] }));
await sleep(300);
process.exit(0);
