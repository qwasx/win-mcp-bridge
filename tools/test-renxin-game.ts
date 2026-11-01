// 第四十九步「人心」整机冒烟：npx tsx tools/test-renxin-game.ts
// 在真实的 Game 里跑一遍：四种骗局（真 / 假两条线）、假筑基丹冲关、战败搜袋 → 赃物流散 → 寻仇夺回、
// 死敌补刀（遁地符 / 燃血遁走）、魔修掳人、道伤、表里心声、绘制不报错。
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const C = await import('../src/world/cultivation');
const { REALMS, MAJOR_BREAKS } = await import('../src/data/realms');
const { LOCATIONS, WORLD_SCALE, WORLD_W, WORLD_H } = await import('../src/data/world');
const { thoughtOf } = await import('../src/world/alive');
const RX = await import('../src/world/renxin-core');

const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const rx: any = g.renxin, h = g.hero, p = g.player;
(g.story as any).S.step = 'free'; h.realm = 1; h.stage = 5;
const step = (n = 30, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };
const node = (): any => (g.modal as any)?.node;
const choose = (frag: string) => { const n = node(); const o = n?.options.find((x: any) => x.label.includes(frag)); if (!o) throw new Error(`没有选项「${frag}」：${n?.options.map((x: any) => x.label).join(' / ')}`); const nx = o.act(); g.closeModal(true); if (nx) g.openDialog(nx); return nx; };
const wild = () => { for (let i = 0; i < 2000; i++) { const x = 3000 + Math.random() * (WORLD_W - 6000), y = 3000 + Math.random() * (WORLD_H - 6000); if (g.terrain.isLand(x, y) && g.terrain.walkFactor(x, y) > 0.6 && !g.combat.safeAt(x, y) && !g.terrain.inLocZone(x, y, 600)) return { x, y }; } throw new Error('找不到野外'); };
const clear = () => { g.closeModal(true); rx.reset(); g.combat.reset(); };
const spawnKind = (kind: string) => { for (let i = 0; i < 300; i++) { clear(); rx.F.rx_last = {}; rx.spawn(); const x = rx.list[0]; if (x?.kind === kind) return x; } throw new Error('生不出 ' + kind); };
const kill = (e: any) => { e.hp = 0; (g.combat as any).kill(e); };
const sec = async (name: string, f: () => void) => { console.log(name); try { f(); } catch (err: any) { fails++; console.log('  ✗ 异常：' + (err?.stack ?? err)); } };

const W = wild(); g.teleport(W.x, W.y); step(5);

await sec('一、合作探宝 · 老实人', () => {
  const x = spawnKind('partner'); x.scam = false; x.pers = 'righteous';
  x.npc.x = p.x + 120; x.npc.y = p.y; step(3);
  ok(node()?.text.includes('遗府'), '散修上前搭话，邀你同探遗府');
  choose('同去'); ok(x.st === 'travel' && x.foe?.ally, '结伴同行（他成了你的同阵修士）');
  g.teleport(x.tx, x.ty); step(3);
  for (const f of x.foes) kill(f); step(3);
  ok(node()?.text.includes('五五分账'), '守府妖兽伏诛，开宝分账');
  const n0 = h.bag.length; choose('五五分账');
  ok(x.done && h.bag.length >= n0, '老实人依约分账，拱手作别');
});
await sec('一、合作探宝 · 分赃翻脸', () => {
  const x = spawnKind('partner'); x.scam = true; x.pers = 'ruthless';
  x.npc.x = p.x + 120; x.npc.y = p.y; step(3); choose('同去');
  g.teleport(x.tx, x.ty); step(3); for (const f of x.foes) kill(f); step(3);
  choose('五五分账');
  ok(x.st === 'fight' && !x.foe.ally && g.combat.enemies.includes(x.foe), '开宝那一刻翻脸出手');
  ok(rx.yl('partner') >= 1, '阅历 +1');
  const n0 = h.bag.reduce((s: number, b: any) => s + b.n, 0); g.closeModal(true); kill(x.foe); step(2);
  ok(x.done && h.bag.reduce((s: number, b: any) => s + b.n, 0) > n0, '杀了他，遗府宝物连同他的储物袋归你');
});
await sec('三、借刀杀人', () => {
  const rep0 = g.ws.rep;
  const x = spawnKind('knife'); x.scam = true;
  x.npc.x = p.x + 120; x.npc.y = p.y; step(3);
  ok(node()?.text.includes('魔修'), '浑身是血的人求你主持公道');
  choose('会会他'); ok(x.st === 'go', '应下，地图标出「魔修」');
  ok(rx.marks().some((m: any) => m.glyph === '魔'), '地图标记');
  g.teleport(x.foe.x + 150, x.foe.y); step(3);
  ok(node()?.text.includes('请来的'), '那「魔修」并不拔剑，只是苦笑');
  choose('动手'); kill(x.foe); step(2);
  ok(g.ws.rep < rep0 && rx.yl('knife') >= 1 && node()?.text.includes('根本不是魔修'), '错杀好人：声望下跌、阅历 +1、真相大白');
  g.closeModal(true);
  const y = spawnKind('knife'); y.scam = true; y.npc.x = p.x + 120; y.npc.y = p.y; step(3); choose('会会他');
  g.teleport(y.foe.x + 150, y.foe.y); step(3); choose('对质');
  ok(y.done && !g.combat.enemies.includes(y.foe), '回头对质：人去无踪，识破');
});
await sec('五、夺舍老魔', () => {
  const x = spawnKind('possess'); x.scam = true; x.pers = 'ruthless';
  g.teleport(x.npc.x + 100, x.npc.y); step(3);
  ok(rx.focus === x, '【T】查看伤者');
  ok(rx.interact() && node()?.text.includes('渡一口灵力'), '重伤前辈求你渡气');
  rx.resistChance = () => 0;
  choose('渡一口灵力'); ok(node()?.text.includes('夺舍'), '一缕黑气直冲识海——夺舍！');
  choose('守住识海'); ok((g.story as any).fight?.mind, '进入识海之战（复用墨大夫夺舍那一套）');
  const life0 = h.lifeLost, ds0 = h.ds ?? 0;
  g.onPlayerDown(); step(1);
  ok((h.ds ?? 0) > ds0 && h.lifeLost > life0 && node()?.title?.includes('识海之战'), '识海之战败：神魂受创（道伤）、折寿');
  g.closeModal(true); h.ds = 0;
});
await sec('二、地摊假货 + 假筑基丹冲关', () => {
  const town = LOCATIONS.find((l: any) => l.type === 'town' && g.combat.safeAt(l.x * WORLD_SCALE, l.y * WORLD_SCALE));
  ok(!!town, '找到城镇');
  g.teleport(town!.x * WORLD_SCALE, town!.y * WORLD_SCALE); step(3);
  let x: any = null;
  for (let i = 0; i < 300 && !x; i++) { clear(); rx.F.rx_last = {}; rx.spawn(); if (rx.list[0]?.kind === 'stall' && rx.list[0].d.item === 'pill_zhuji') x = rx.list[0]; }
  ok(!!x, '街角支起地摊，卖三折筑基丹');
  x.scam = true; C.addItem(h, 'mat_lingshi', 5000);
  g.openDialog(rx.stallNode(x)); choose('压价'); ok(node()?.text.includes('答应得太快'), '压价：骗子答应得太快');
  g.closeModal(true); g.openDialog(rx.stallNode(x)); choose('买下');
  ok(C.bagCount(h, 'pill_zhuji') === 1 && (h as any).fakes?.pill_zhuji === 1, '买到手：储物袋里一颗「筑基丹」，看不出真假');
  g.closeModal(true);
  h.stage = REALMS[1].stages.length - 1; h.exp = C.need(h);
  ok(C.bottleneck(h) === 'major', '炼气圆满，冲击筑基');
  const r = g.breakthrough(1, 0);
  ok(r.msgs.some((m: any) => m.text.includes('聚气丹')) && C.bagCount(h, 'pill_zhuji') === 0, '服下才知是染了色的聚气丹（成功率只按真丹计）');
  ok(rx.yl('stall') >= 1, '阅历 +1');
  (g as any).tianxiang?.stop?.(); h.realm = 1; h.stage = 5; h.exp = 0;
});
await sec('三·一、战败重做：劫修搜袋 → 赃物流散 → 寻仇夺回', () => {
  const w = wild(); g.teleport(w.x, w.y); clear(); step(2);
  C.addItem(h, 'pill_liaoshang', 6); C.addItem(h, 'herb_huangjing', 12); C.addItem(h, 'tal_fire', 4); C.addItem(h, 'mat_lingshi', 2000);
  const ls0 = C.bagCount(h, 'mat_lingshi');
  const e = rx.human(p.x + 120, p.y, 1, 4, '测试劫修', false); e.aggro = true; g.combat.enemies.push(e);
  (g.combat as any).lastFoe = e; (g.combat as any).lastFoeT = g.time;
  const exp0 = C.expPerDay(h), mp0 = C.heroStats(h).mp;
  g.onPlayerDown();
  const rec = rx.F.rx_stolen;
  ok(node()?.title?.includes('劫修') && node()?.text.includes('搜走'), '败北 · 劫修：储物袋被搜');
  ok(rec && rec.items.length > 0 && C.bagCount(h, 'mat_lingshi') <= ls0 * 0.3 + 1, `搜走七到十成（灵石 ${ls0} → ${C.bagCount(h, 'mat_lingshi')}）`);
  ok((h.ds ?? 0) >= 15 && C.expPerDay(h) < exp0 * 0.65 && C.heroStats(h).mp < mp0, `道伤 ${Math.round(h.ds!)} 日：修炼 -40%、法力上限 -20%`);
  ok(rx.marks().some((m: any) => m.glyph === '赃'), '地图标出「赃」');
  g.closeModal(true);
  const n0 = rec.items.length; g.day += 12; step(2);
  ok(rx.F.rx_stolen.items.length <= n0 && rx.F.rx_stolen.last >= g.day - 1, `过了十二天，他已卖掉 ${rx.F.rx_stolen.sold} 样`);
  g.teleport(rec.x + 200, rec.y); step(3);
  ok(rx.thief.length > 0, '追到地方：神识里看见了他');
  const lead = rx.thief[0], left = rx.F.rx_stolen.items.length; kill(lead); step(1);
  ok(!rx.F.rx_stolen && node()?.title === '寻仇夺回', `杀了他，夺回剩下的 ${left} 样`);
  g.closeModal(true);
  const ds = h.ds!; g.passDays(5); ok(h.ds! < ds, '道伤随岁月愈合');
  C.addItem(h, 'pill_liaoshang', 2); h.hp = 0.5; h.ds = 3; g.usePill('pill_liaoshang'); ok(h.ds < 3, '疗伤丹让道伤好得快些');
  h.ds = 0;
});
await sec('三·一、死敌补刀', () => {
  const w = wild(); g.teleport(w.x, w.y); clear();
  const mk = () => { const e = rx.human(p.x + 120, p.y, 2, 1, '血仇', false); e.pursuer = true; e.aggro = true; g.combat.enemies.push(e); (g.combat as any).lastFoe = e; (g.combat as any).lastFoeT = g.time; };
  const nEsc = C.bagCount(h, 'tal_escape'); if (nEsc) C.removeItem(h, 'tal_escape', nEsc);   // 随机掉落里可能已有遁符
  C.addItem(h, 'tal_escape', 1); h.stage = 5; mk(); g.onPlayerDown();
  ok(C.bagCount(h, 'tal_escape') === 0 && h.stage === 5 && node()?.text.includes('遁地'), '遁地符自行激发，捡回一条命');
  g.closeModal(true); clear(); h.ds = 0; const life0 = h.lifeLost; mk(); g.onPlayerDown();
  ok(h.stage === 4 && h.lifeLost === life0 + 3 && (h.ds ?? 0) >= 40, '没有遁符：燃烧精血遁走——跌一层、折寿三年、道伤四十日以上');
  g.closeModal(true); h.ds = 0; h.stage = 5;
});
await sec('三·一、魔修掳人', () => {
  const w = wild(); g.teleport(w.x, w.y); clear();
  C.addItem(h, 'herb_huangjing', 8); C.addItem(h, 'mat_lingshi', 500);
  const e = rx.human(p.x + 120, p.y, 1, 6, '血魔', true); g.combat.enemies.push(e);
  rx.captured(e, 0);
  ok(node()?.title?.includes('掳人') && rx.F.rx_cell, '醒在魔修石窟里，储物袋扔在石台上');
  choose('爆发'); g.closeModal(true);
  ok(rx.cellGuards.length >= 2, '燃起残余法力硬闯：看守围上来');
  for (const gd of [...rx.cellGuards]) kill(gd); step(1);
  ok(!rx.F.rx_cell && node()?.title === '杀出石窟', '杀出石窟，夺回储物袋');
  g.closeModal(true); h.ds = 0;
});
await sec('二·一、表里：心声与名牌', () => {
  clear();
  const d0 = (g.npcs as any).list.find((d: any) => d.alive && d.realm >= 1 && !d.canon && !d.beauty && !d.bond);
  const a: any = { d: d0, st: { x: d0.x, y: d0.y }, act: 'idle', wait: 0, sup: 0 };
  const acts = [a];
  ok(!!a, `身边有活人（${acts.length}）`);
  if (!a) return;
  Object.assign(a.d, { pers: 'ruthless', favor: -50, grudge: 0, realm: 1, stage: 3, plan: undefined, canon: false });
  a.sup = 0; h.realm = 1;
  const fake = thoughtOf(g, a);
  ok(!(a as any).mindGold && RX.shownFavor(g, a.d) > 0 && !RX.favorLabel(g, a.d).includes('实为'), `看不穿：恨你入骨的人，心声是「${fake}」，好感显示 ${RX.favorLabel(g, a.d)}`);
  ok(RX.shownPersName(g, a.d) !== '狠辣', `性格演成「${RX.shownPersName(g, a.d)}」`);
  h.realm = 3;
  const real = thoughtOf(g, a);
  ok((a as any).mindGold && RX.favorLabel(g, a.d).includes('实为 -50'), `高出两个大境界：描金真心「${real}」，好感 ${RX.favorLabel(g, a.d)}`);
  h.realm = 1; a.sup = 1; (g.npcs as any).active.set(d0.id, a); thoughtOf(g, a); (g.npcs as any).active.delete(d0.id);
  ok((a as any).mindGold, '被你的威压镇着：也看得穿');
});
await sec('绘制', () => {
  const w2 = wild(); g.teleport(w2.x, w2.y); clear(); const x = spawnKind('possess'); g.teleport(x.npc.x + 80, x.npc.y); step(3);
  x.mind = { text: '好一具年轻的肉身……', t: 2, gold: true };
  const out: any[] = []; const v = { left: p.x - 2000, top: p.y - 2000, right: p.x + 2000, bottom: p.y + 2000 };
  rx.collect(out, v, 1, 1 / 30);
  const c2: any = createCanvas(400, 300).getContext('2d');
  for (const o of out) o.draw(c2);
  ok(out.length > 0, `骗局人物 / 心声泡绘制 ${out.length} 项无异常`);
  const fr: any = createCanvas(CW, CH); (g.renderer as any).render?.(1 / 30);
  ok(true, '整帧渲染无异常');
  void fr;
});
console.log(fails ? `\n失败 ${fails} 项` : '\n整机冒烟全部通过');
process.exit(fails ? 1 : 0);
