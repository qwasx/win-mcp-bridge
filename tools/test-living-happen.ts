// 第四十二步：奇遇与求救里登场的都是真人：npx tsx tools/test-living-happen.ts
import './env';
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset?.();
let fails = 0; const ok = (c: any, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const lw = g.lw, N = g.npcs;
for (let day = 0; day < 6 * 360; day++) { g.day += 1; N.daily(1); g.rel.daily(1); lw.daily(1); }
g.hero.stage = 0;
let tp = false; for (let i = 0; i < 4000 && !tp; i++) { const x = 3000 + Math.random() * 30000, y = 3000 + Math.random() * 20000; if (terrain.isLand(x, y) && terrain.walkFactor(x, y) > 0.5 && !terrain.inLocZone(x, y, 900)) { g.player.x = x; g.player.y = y; tp = true; } }
console.log('玩家就位', tp, Math.round(g.player.x), Math.round(g.player.y));
// 1) 奇遇：登场者必须是真人，结束后放回
const kinds: Record<string, number> = {}; let realNamed = 0, total = 0;
try { g.happen.spawn(); } catch (e) { console.log('ERR', e); }
for (let i = 0; i < 400; i++) {
  const n0 = g.happen.haps.length;
  g.happen.haps = [];
  g.happen.spawn();
  for (const x of g.happen.haps) {
    total++; kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;
    if (x.d.lent) { realNamed++; for (const id of x.d.lent) ok0(N.byId.get(id)?.hidden === true, id); }
    x.done = true;
  }
  g.happen.update(0.01);
  void n0;
}
function ok0(c: any, m: string) { if (!c) { fails++; console.log('FAIL 借用的真人应被摘出', m); } }
console.log('奇遇统计', kinds, `真人登场 ${realNamed}/${total}`);
ok(total > 0, '仍会有奇遇');
ok(!N.list.some((d: any) => d.lent && !lw.lent.has(d.id)), '奇遇结束后真人都放回了世上');
ok(!(kinds.tribul && !realNamed), '渡劫者是真人');
// 2) 好友遇劫 → 先求救，不去才真发生
const robber = N.list.find((d: any) => lw.rogueish(d) && lw.free(d)), friend = N.list.find((d: any) => lw.free(d) && d.realm >= 1 && d !== robber);
friend.met = true; friend.favor = 50; (lw.S as any).sosCd = 0;
let sent = false; for (let i = 0; i < 40 && !sent; i++) sent = lw.trySos(robber, friend);
ok(sent, '好友遇劫会发传音求救（带着真实劫匪的名字）');
const j = g.war.inbox.find((x: any) => x.kind === '求救'); ok(j && j.robber === robber.id && j.text.includes(robber.name), `玉符：${j?.text.split('\n')[0]}`);
const wealth0 = friend.wealth, alive0 = friend.alive;
g.war.expire(j);
ok(j.done, '不去，求救到期');
console.log(`  结果：${friend.name}${friend.alive ? '幸存' : '遇害'}，灵石 ${wealth0}→${friend.wealth}`, alive0);
// 3) 不再凭空编求救
let fab = 0; for (let i = 0; i < 300; i++) { (g.ws.flags as any).jadeAt = 0; g.war.inbox.length = 0; g.war.randomJade(); if (g.war.inbox.some((x: any) => x.kind === '求救')) fab++; }
ok(fab === 0, '随机玉符不再凭空编造求救');
// 4) 储物袋：杀人掉落、商人卖的是袋里的货
const v = N.list.find((d: any) => d.alive && d.realm >= 2 && d.faction === 'merchant') ?? N.list.find((d: any) => d.alive && d.realm >= 2);
const bag0 = lw.L(v).bag.length; const st = N.stock(v);
ok(st.some((s: any) => lw.L(v).bag.some(([id]: any) => id === s.id)), `货摊上是${v.name}储物袋里真有的东西（袋 ${bag0} 类 → 摊 ${st.length} 件）`);
const id0 = st[0].id, n0 = lw.L(v).bag.find(([id]: any) => id === id0)?.[1] ?? 0; lw.onSold(v, id0, 100);
ok((lw.L(v).bag.find(([id]: any) => id === id0)?.[1] ?? 0) === n0 - 1, '买走之后袋里少一件');
console.log(fails ? `\n${fails} 项失败` : '\n全部通过'); process.exit(fails ? 1 : 0);
