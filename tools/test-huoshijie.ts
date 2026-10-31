// 第四十二步：活世界冒烟测试——跑两年，看人是不是活的
// 断言：储物袋有货且有来路 / 功法有主 / 有人成亲添丁 / 劫掠真实转移财物 / 仇怨有缘由 /
//       求助必有关系有理由有因果链 / 遗产有传承 / 调停与补偿可了结 / 存档可往返
import './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LivingWorld } = await import('../src/world/huoshijie');
const C = await import('../src/world/cultivation');

const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
// 让玩家与一批人相识（有交情才可能收到求助）
let known = 0;
for (const d of g.npcs.list) {
  if (known >= 60) break;
  if (d.alive && d.realm > 0 && !d.canon) { d.met = true; d.favor = 30 + Math.random() * 30; known++; }
}
C.addItem(g.hero, 'mat_lingshi', 200000);

const DAYS = 720;
const t0 = Date.now();
for (let i = 0; i < DAYS; i++) {
  g.day += 1;
  g.npcs.daily(1);
  g.huo.daily(1);
}
const ms = Date.now() - t0;
const huo = g.huo.huo;
const S = huo.st;
const alive = g.npcs.list.filter((d) => d.alive);
const withHw = alive.filter((d) => d.hw);
const bagged = withHw.filter((d) => d.hw!.bag.length > 0);
const provenance = withHw.filter((d) => d.hw!.bag.some((b) => b.from));
const arted = withHw.filter((d) => d.realm > 0 && d.hw!.art);
const cultivators = withHw.filter((d) => d.realm > 0);
const married = withHw.filter((d) => d.hw!.spouse);
const kidsBorn = S.stats['birth'] ?? 0;
const feuds = withHw.flatMap((d) => d.hw!.feuds);
const robEv = S.events.filter((e) => e.kind === '劫掠' || e.kind === '仇杀');
const pleas = S.pleas;

let fail = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? '✓' : '✗ FAIL'} ${msg}`); if (!cond) fail++; };
console.log(`\n===== 活世界 · ${DAYS} 日推演（${ms}ms，${(ms / DAYS).toFixed(2)}ms/日）=====`);
console.log(`在世 ${alive.length} 人 · 建档 ${withHw.length} · 事件 ${S.events.length} 条`);
console.log('统计', JSON.stringify(S.stats));
ok(bagged.length > withHw.length * 0.6, `储物袋有货：${bagged.length}/${withHw.length}`);
ok(provenance.length > 5, `物件有来路（赠与/劫夺/遗物）：${provenance.length} 人持有`);
ok(arted.length > cultivators.length * 0.8, `修士有功法：${arted.length}/${cultivators.length}`);
ok((S.stats['marriage'] ?? 0) > 0 && married.length > 0, `有人结为道侣：${S.stats['marriage'] ?? 0} 桩（在世 ${married.length} 人有家室）`);
ok(kidsBorn > 0, `有人添丁：${kidsBorn} 个孩子在模拟中出生`);
ok((S.stats['rob'] ?? 0) + (S.stats['kill'] ?? 0) > 3, `劫掠/仇杀真实发生：劫 ${S.stats['rob'] ?? 0} · 杀 ${S.stats['kill'] ?? 0}`);
ok(feuds.length > 0 && feuds.every((f) => !!f.why), `仇怨皆有缘由：${feuds.length} 条`);
ok((S.stats['gift'] ?? 0) > 0 && (S.stats['trade'] ?? 0) > 0, `社交赠礼 ${S.stats['gift'] ?? 0} 次 · 坊市交易 ${S.stats['trade'] ?? 0} 次`);
ok((S.stats['inherit'] ?? 0) > 0, `遗产传承：${S.stats['inherit'] ?? 0} 起`);
// 求助：必须人人有理由、有因果链，且与你相识或同门或有羁绊
ok(pleas.length > 0, `两年间收到求助 ${pleas.length} 封（有节制，不扰民）`);
const byId = new Map(g.npcs.list.map((d) => [d.id, d]));
ok(pleas.every((p) => {
  const giver = byId.get(p.giver);
  return !!p.reason && !!p.why && !!(huo.eventById(p.cause) || p.trail?.length) && !!giver && (giver.met || giver.bond || (giver.sect && giver.sect === g.ws.sect?.id));
}), '每封求助都有：苦主相识/同门/羁绊 + 事由 + 可追溯的因果链');
ok(pleas.length <= DAYS / 8 + 2, `求助有节流（≤ ${Math.floor(DAYS / 8) + 2}）：实际 ${pleas.length}`);
// 了结一桩：补偿
const open = pleas.find((p) => p.status === 'open');
if (open) {
  const r = g.huo.huo.resolvePlea(g.huo.host, open.id, 'pay', { stones: C.bagCount(g.hero, 'mat_lingshi') });
  ok(r.ok, `破财免灾可了结：${r.text.slice(0, 40)}…`);
}
// 存档往返
const dump = JSON.parse(JSON.stringify(S));
const re = new LivingWorld(dump);
ok(re.st.events.length === S.events.length && re.st.pleas.length === S.pleas.length, '引擎状态存档往返无损');
// 展示一条完整因果链
const withCause = S.events.filter((e) => e.kind === '求助' && e.cause);
if (withCause.length) {
  console.log('\n—— 因果链示例（从果溯因）——');
  for (const e of huo.chain(withCause[withCause.length - 1].id).reverse()) console.log(`  第${e.day}日【${e.kind}】${e.text}`);
}
console.log('\n—— 众生相（随机三人的日子）——');
for (const d of alive.filter((x) => x.hw && x.hw.feuds.length + x.hw.kids.length > 0).slice(0, 3)) {
  const p = huo.profile(d as any, g.huo.host);
  console.log(`  ${d.name}：${p.act}｜${p.art}｜家眷：${p.spouse || '无'} ${p.kids.join('、')}｜仇怨：${p.feuds.map((f) => `${f.name}(${f.why})`).join('；') || '无'}`);
}
console.log(fail ? `\n${fail} 项未过` : '\n全绿：这世界里的人是活的。');
process.exit(fail ? 1 : 0);