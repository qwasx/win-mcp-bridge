// 第四十二步：活世界测试：npx tsx tools/test-livingworld.ts
// 不碰玩家，只让世界自己跑 N 年，看看储物袋、功法、家庭、社交、仇恨、门派政治是不是真的在发生
import './env';
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset?.();
let fails = 0;
const ok = (c: any, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const lw = g.lw, N = g.npcs;
const YEARS = +(process.env.YEARS ?? 18);

// 1) 储物袋 / 功法 / 门派流派
for (const d of N.list) lw.L(d);
const cult = N.list.filter((d: any) => d.alive && d.realm >= 1);
ok(cult.every((d: any) => d.lw.arts.length >= 1), `修士都有功法（${cult.length} 人）`);
ok(N.list.filter((d: any) => d.alive && d.realm >= 1).some((d: any) => d.lw.bag.length >= 3), '储物袋里有真实物品');
const sect = N.list.filter((d: any) => d.sect && d.alive);
const sc = new Map<string, Set<string>>();
for (const d of sect) { (sc.get(d.sect) ?? sc.set(d.sect, new Set()).get(d.sect)!).add(d.lw.school); }
ok([...sc.values()].every((s) => s.size === 1), '同门同一路流派');
const before = { n: N.list.length, kids: N.list.filter((d: any) => d.hidden).length, ties: N.list.reduce((s: number, d: any) => s + (d.ties?.length ?? 0), 0) };

// 2) 让世界自己跑
const t0 = Date.now();
for (let day = 0; day < YEARS * 360; day += 1) {
  g.day += 1; N.daily(1); g.rel.daily(1); lw.daily(1);
  if (day % 90 === 0) for (const d of N.list) if (d.alive && d.age > d.life) N.die(d, '寿元耗尽，坐化');
}
console.log(`模拟 ${YEARS} 年用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const S = lw.S;
const alive = N.list.filter((d: any) => d.alive);
console.log(`在世 ${alive.length}（童 ${alive.filter((d: any) => d.hidden).length}）  婚 ${S.weds}  生 ${S.births}  死伤 ${S.deaths}  风闻 ${S.feed.length}  宗门积怨 ${Object.keys(S.feud).length}`);
console.log('--- 最近风闻 ---'); for (const f of S.feed.slice(-14)) console.log(' ·', f.text);
ok(S.weds > 0, `发生了婚嫁（${S.weds}）`);
ok(S.births > 0, `有人出生（${S.births}）`);
{ const kid = alive.find((d: any) => d.hidden && d.lw?.born !== undefined); ok(!!kid, '有幼童在家中长大');
  if (kid) { const par = lw.parentsOf(kid); ok(par.length === 2, `幼童有双亲（${par.map((p: any) => p.name).join('、')}）`); kid.age = 16.1; lw.daily(1); ok(!kid.hidden && kid.lw.born === undefined, `${kid.name}长大成人：${kid.lw.bio.at(-1)?.[1]}`); } }
ok(S.feed.some((f: any) => /劫|抢/.test(f.text)), '发生了真实的劫案');
ok(S.feed.some((f: any) => /结为好友|义结金兰|闹翻/.test(f.text)) || N.list.some((d: any) => d.lw?.bio?.some(([, t]: any) => /结为好友/.test(t))), '社交：结交 / 结拜 / 结怨');
ok(N.list.some((d: any) => d.vend && N.byId.get(d.vend)?.alive) || S.feed.some((f: any) => /寻|报了血仇|雇/.test(f.text)), '仇恨：有人在寻仇');
ok(Object.keys(S.feud).length > 0 || S.feed.some((f: any) => /积怨爆发/.test(f.text)), '门派积怨在累积 / 爆发');
ok(N.list.some((d: any) => d.lw?.bio?.some(([, t]: any) => /守孝/.test(t))), '亲人亡故，守孝继承');
ok(alive.length > 400 && alive.length < 1100, `人口没有崩（${alive.length}）`);
// 家庭一致性
const bad = N.list.filter((d: any) => (d.ties ?? []).some((t: any) => !N.byId.get(t.id)));
console.log(`人脉里指向已清理死者的旧引用 ${bad.length} 人（读取时已做防护）`);
const couples = alive.filter((d: any) => d.sex === 'm' && lw.spouseOf(d));
console.log(`夫妻 ${couples.length} 对，例：${couples.slice(0, 3).map((d: any) => d.name + '&' + lw.spouseOf(d).name + '(子女' + lw.kidsOf(d).length + ')').join('、')}`);
// 3) 面板文字
const sample = alive.find((d: any) => d.realm >= 2 && d.sect) ?? alive[0];
for (const p of ['main', 'bag', 'arts', 'kin', 'foe', 'life']) { const n = lw.profile(sample, p); ok(n.text.length > 5 && n.options.length >= 5, `玉简「${p}」有内容`); }
console.log(lw.profile(sample, 'main').text); console.log(lw.profile(sample, 'arts').text);
for (const p of ['main', 'near', 'met', 'feed', 'feud', 'stat']) ok(lw.directory(p).text.length > 3, `众生录「${p}」`);
// 4) 存档往返
const saved = JSON.parse(JSON.stringify(N.toSave()));
ok(saved.some((d: any) => d.lw && d.lw.bag), '储物袋随存档保存');
console.log(`存档体积约 ${(JSON.stringify(saved).length / 1024).toFixed(0)} KB`);
void before;
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
