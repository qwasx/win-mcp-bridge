// 第四十三步：活世界冒烟测试：npx tsx tools/test-living.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { ACTIVE_MAP } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const N = g.npcs, L = g.living, R = g.rel;
g.hero.realm = 2; g.hero.stage = 3;
const onMap = (d: any) => (d.map ?? 'tiannan') === ACTIVE_MAP;

// 1) 储物袋 / 功法 / 门派
L.ensureAll();
const cults = N.list.filter((d) => d.alive && d.realm > 0 && !d.ros && !d.gz);
ok(cults.every((d) => d.bag && Array.isArray(d.arts)), '每个修士都有储物袋与功法列表');
const withArts = cults.filter((d) => d.arts!.length > 0).length, withItems = cults.filter((d) => Object.keys(d.bag!).length > 0).length;
console.log(`修士 ${cults.length}：习有功法 ${withArts}，袋中有物 ${withItems}，宗门弟子有职位 ${cults.filter((d) => d.sect && d.srk !== undefined).length}`);
ok(withArts > cults.length * 0.8, '八成以上修士习有功法');
ok(withItems > cults.length * 0.8, '八成以上修士袋中有物');
const sample = cults.find((d) => d.sect && !d.canon)!;
console.log('—— 样例（开局）——\n' + L.profileText(sample));

// 2) 跑三年
const t0 = performance.now();
for (let i = 0; i < 360 * 3; i++) { g.day += 1; N.daily(1); }
const ms = performance.now() - t0;
const st = L.S.st;
console.log(`三年模拟 ${ms.toFixed(0)} ms（每日 ${(ms / 1080).toFixed(2)} ms）`, JSON.stringify(st));
ok(ms / 1080 < 8, '每日结算足够快（< 8ms）');
ok((st.birth ?? 0) > 0, `有人添丁（${st.birth}）`);
ok((st.wed ?? 0) > 0, `有人结为道侣 / 成亲（${st.wed}）`);
ok((st.rob ?? 0) + (st.kill ?? 0) > 0, `有劫案 / 仇杀（${st.rob ?? 0} / ${st.kill ?? 0}）`);
ok((st.sect ?? 0) > 0, `宗门有晋升 / 拜入 / 叛门（${st.sect}）`);
ok((st.break ?? 0) > 0, `有人突破大境界（${st.break}）`);
const alive = N.list.filter((d) => d.alive);
ok(alive.every((d) => Number.isFinite(d.wealth) && d.wealth >= 0), '灵石无 NaN / 负数');
ok(alive.every((d) => !d.bag || Object.values(d.bag).every((n) => Number.isFinite(n) && n > 0)), '储物袋数量合法');
const free = alive.filter((d) => L.free(d) && !d.hidden), plans = free.filter((d) => d.plan).length;
ok(plans > free.length * 0.9, `自由之身几乎人人有眼下的打算（${plans}/${free.length}）`);
const kinds: Record<string, number> = {}; for (const d of free) if (d.plan) kinds[d.plan.k] = (kinds[d.plan.k] ?? 0) + 1;
console.log('打算分布', JSON.stringify(kinds));
const hates = alive.reduce((s, d) => s + (d.hate?.length ?? 0), 0);
ok(hates > 0, `有人记仇（${hates} 笔）`);
const kids = N.list.filter((d) => d.born !== undefined);
ok(kids.length > 0 && kids.every((k) => k.ties?.some((t) => t.r === '父' || t.r === '母')), `新生儿都认得父母（${kids.length} 人）`);
let asym = 0; for (const d of N.list) for (const t of d.ties ?? []) { const o = N.byId.get(t.id); if (o && !o.ties?.some((x) => x.id === d.id)) asym++; }
ok(asym === 0, '关系双向');
ok(alive.length < 1400, `人口不失控（在世 ${alive.length}）`);
const fam = free.find((d) => L.spouseOf(d) && L.kidsOf(d).length && d.hate?.length) ?? free.find((d) => L.spouseOf(d) && L.kidsOf(d).length) ?? free[0];
console.log('—— 样例（三年后，有家小的人）——\n' + L.profileText(fam));
console.log('开口：', L.greetLine(fam) ?? '(无)', '｜ 头顶：', L.planLine(fam) ?? '(无)', '｜ 传闻：', L.rumorFor(fam) ?? '(无)');
console.log('天下事（最近 14 条）：'); for (const e of L.S.log.slice(-14)) console.log('  ·', e.t);

// 3) 熟人被劫 → 有名有姓的求助 → 杀了劫匪 → 委托人致谢
const victim = N.list.find((d) => L.free(d) && !d.hidden && d.realm >= 1 && onMap(d))!;
const robber = N.list.find((d) => L.free(d) && !d.hidden && d !== victim && onMap(d) && !R.tieOf(d, victim.id) && !victim.ties?.some((t) => { const o = N.byId.get(t.id); return !!o && !!R.tieOf(o, d.id); }))!;
victim.met = true; victim.favor = 45; robber.realm = Math.min(4, victim.realm + 1); robber.stage = 5; robber.pers = 'greedy';
L.S.reqAt = 0; for (const q of L.S.reqs) q.done = true; L.S.pend = [];
victim.bag = { pill_juling: 2, herb_zihou: 3 }; victim.wealth = 500; victim.hate = [];
L.rob(robber, victim, g.day, () => 0.9);
ok(victim.alive && victim.hate?.some((h) => h.id === robber.id), `${victim.name}记恨劫匪${robber.name}：${victim.hate?.[0]?.why}`);
ok((robber.bag?.pill_juling ?? 0) + (robber.bag?.herb_zihou ?? 0) > 0, '劫来的东西真在劫匪的储物袋里');
ok(L.S.pend.some((p) => p.from === victim.id && p.foe === robber.id), '待发的求助指名道姓');
L.requests();
const jade = g.war.inbox.find((j) => j.kind === '求助' && j.fromId === victim.id && !j.done);
ok(!!jade, '玉符收到「求助」');
if (jade) {
  console.log('—— 求助玉符 ——\n' + jade.text);
  ok(jade.text.includes(robber.name) && (jade.text.includes('聚灵丹') || jade.text.includes('紫猴花')), '信里写明了劫匪是谁、丢了什么');
  ok(L.jadeOpts(jade, () => null as any).length === 2, '可以应下，也可以婉拒');
}
const f0 = victim.favor;
N.onEnemyKilled({ npcId: robber.id, x: robber.x, y: robber.y } as any);
ok(!robber.alive, '劫匪伏诛');
ok(victim.favor >= f0 + 20, `委托人好感大增（${f0} → ${victim.favor}）`);
ok(!victim.hate?.some((h) => h.id === robber.id), '委托人的仇了结了');
ok(!jade || jade.done, '求助了结');
ok(!g.war.inbox.some((j) => j.kind === '求救' && !j.done), '再没有凭空编造的「被劫修围住」');

// 4) 存档往返
const saved = JSON.parse(JSON.stringify(N.toSave()));
const one = saved.find((d: any) => d.alive && d.bag && Object.keys(d.bag).length && d.hate?.length && d.plan && !d.canon);
N.fromSave(saved, 1);
const back = one ? N.byId.get(one.id) : undefined;
ok(back && JSON.stringify(back.bag) === JSON.stringify(one.bag) && back.hate?.length === one.hate.length && back.plan?.k === one.plan.k && JSON.stringify(back.arts) === JSON.stringify(one.arts), '存档往返保留储物袋 / 功法 / 仇恨 / 打算');

// 5) 闭关十年：一次补算
const s0 = { ...L.S.st };
const t1 = performance.now(); g.day += 3600; N.daily(3600); const ms2 = performance.now() - t1;
ok(ms2 < 5000, `闭关十年补算 ${ms2.toFixed(0)} ms`);
const d10: Record<string, number> = {}; for (const k of Object.keys(L.S.st)) d10[k] = (L.S.st[k] ?? 0) - (s0[k] ?? 0);
console.log('十年间', JSON.stringify(d10), '在世', N.list.filter((d) => d.alive).length);
ok((d10.birth ?? 0) > 0 && (d10.age ?? 0) >= 0, '十年里照样有人出生、长大');
const news = L.seclusionNews(g.day - 3600);
ok(!!news, '出关有「世事变迁」');
console.log((news?.text ?? '').slice(0, 600));
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
