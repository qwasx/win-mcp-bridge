import WebSocket from '../../node_modules/ws/wrapper.mjs';
const N = +(process.env.N ?? 100), DUR = +(process.env.DUR ?? 70) * 1000;
const PFX = 'b' + (Date.now() % 100000) + '_';
const NAT = ['ming', 'jin', 'chuang', 'xi', 'mon'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const byType = {}; let bytes = 0, msgs = 0, welcomed = 0, errors = 0, reports = 0;
const bots = [];
for (let i = 0; i < N; i++) {
  const ws = new WebSocket('ws://127.0.0.1:8091/ws');
  const b = { ws, me: null, x: 0, y: 0 };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name: PFX + i, pass: 'pass1234' })));
  ws.on('message', d => {
    bytes += d.length; msgs++;
    const m = JSON.parse(String(d));
    byType[m.t] = (byType[m.t] ?? 0) + d.length;
    if (m.t === 'auth' && m.needCreate) ws.send(JSON.stringify({ t: 'create', nation: NAT[i % 5], bg: 'soldier' }));
    if (m.t === 'auth' && !m.ok) errors++;
    if (m.t === 'welcome') { welcomed++; b.me = m; const p = m.parties.find(q => q.id === m.partyId); }
    if (m.t === 'pos') { for (let k = 0; k < m.a.length; k += 4) if (m.a[k] === b.me?.partyId) { b.x = m.a[k + 1] / 10; b.y = m.a[k + 2] / 10; } }
    if (m.t === 'report') reports++;
    if (m.t === 'encounter') ws.send(JSON.stringify({ t: 'req', rid: 1, op: 'enc', args: { eid: m.eid, flee: true } }));
  });
  ws.on('error', () => errors++);
  bots.push(b);
  if (i % 10 === 9) await sleep(150);
}
await sleep(8000);
console.log('welcomed', welcomed, '/', N, 'errors', errors);
const wire0 = bots.reduce((n, b) => n + (b.ws._socket?.bytesRead ?? 0), 0);
const t0 = Date.now(); bytes = 0; msgs = 0; for (const k in byType) delete byType[k];
while (Date.now() - t0 < DUR) {
  for (const b of bots) if (b.me && Math.random() < 0.3) b.ws.send(JSON.stringify({ t: 'nav', kind: 'point', x: b.x + (Math.random() - 0.5) * 300, y: b.y + (Math.random() - 0.5) * 300 }));
  if (Math.random() < 0.2) bots[Math.floor(Math.random() * N)].ws.send(JSON.stringify({ t: 'chat', ch: 'all', text: '压测' }));
  await sleep(2000);
}
const sec = DUR / 1000;
console.log(`per client: ${(bytes / N / sec / 1024).toFixed(1)} KB/s, ${(msgs / N / sec).toFixed(1)} msg/s; reports ${reports}`);
console.log('KB/s per client by type', JSON.stringify(Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, +(v / N / sec / 1024).toFixed(2)]))));
const wire1 = bots.reduce((n, b) => n + (b.ws._socket?.bytesRead ?? 0), 0);
console.log(`WIRE per client: ${((wire1 - wire0) / N / sec / 1024).toFixed(2)} KB/s`);
const moved = bots.filter(b => b.x).length;
console.log('bots with position', moved);
process.exit(0);
