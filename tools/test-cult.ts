import './env';
(globalThis as any).window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const C = await import('../src/world/cultivation');
const { RECIPES } = await import('../src/data/recipes');
const T = new Terrain(); T.build();
const g = new Game(T);
g.toast = (t: string) => console.log('  [toast]', t);
console.log('start', g.ui.realmText, 'age', g.hero.age, 'rate/day', C.expPerDay(g.hero).toFixed(2), 'pos walk', T.walkFactor(g.player.x, g.player.y));
// 采集：找附近采集点
const n = g.nodes.nearest(g.player.x, g.player.y, 5000, g.day);
console.log('nearest node', n?.kind, n?.item, n && Math.hypot(n.x - g.player.x, n.y - g.player.y).toFixed(0));
let cnt = 0; for (const q of g.nodes.inRect(g.player.x - 5000, g.player.y - 5000, g.player.x + 5000, g.player.y + 5000)) cnt++;
console.log('nodes in 10k box', cnt);
if (n) { g.teleport(n.x, n.y + 40); g.tryGather(); for (let i = 0; i < 50; i++) g.update(0.03); }
console.log('bag', g.hero.bag.map((b) => `${b.id}${b.age ?? ''}x${b.n}`).join(' '));
// 打坐
g.toggleSit(); for (let i = 0; i < 300; i++) g.update(0.1); g.stand();
console.log('after 30s sit', g.ui.realmText, 'exp', g.hero.exp.toFixed(0), '/', C.need(g.hero), 'day', g.day.toFixed(0), 'age', g.hero.age.toFixed(2));
// 闭关至瓶颈
for (let k = 0; k < 8; k++) {
  const r = g.seclude(0);
  console.log('seclude', r.days.toFixed(0), r.from, '->', r.to, r.reason);
  if (g.hero.pendingTalent) { console.log('  talent choices', g.hero.pendingTalent); g.chooseTalent(g.hero.pendingTalent[0]); }
  if (C.bottleneck(g.hero) !== 'none') { C.addItem(g.hero, 'pill_juqi', 2); const b = g.breakthrough(2); console.log('  break', b.ok); }
}
// 掌天瓶 + 炼丹
C.addItem(g.hero, 'herb_huangjing', 4, 20);
const st = g.hero.bag.find((b) => b.id === 'herb_huangjing')!;
console.log('bottle', g.hero.bottle.drops, g.useBottle(st).text);
console.log('juqi check', JSON.stringify(C.checkRecipe(g.hero, RECIPES[0])));
console.log('brew', g.brew(RECIPES[0]).msgs[0].text);
console.log('save', g.save(1), Object.keys(store));
const g2 = new Game(T); console.log('load', g2.load('fanren_save_1'), g2.ui.realmText, g2.hero.bag.length, 'nodes harvested', g2.nodes.harvested.size);
console.log('slots', JSON.stringify(Game.listSlots().map((s) => [s.name, s.realm, s.empty])));
// 寿元耗尽
g.hero.age = C.maxLife(g.hero) - 0.01; g.update(0.5); console.log('dead', g.hero.dead, g.ui.dead);
