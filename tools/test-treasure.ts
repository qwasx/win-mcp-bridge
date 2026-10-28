// 第五阶段·杀人夺宝、怀璧其罪：露白招人、蒙面不记名、灭口断讯、烙印招原主、死后储物袋归杀手、正道坊市拒收赃物
// 用法: npx tsx tools/test-treasure.ts
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP } = await import('../src/data/world');
const { npcPower } = await import('../src/world/sim/world');
const { provMoveAll, provOf } = await import('../src/world/sim/prov');
const C = await import('../src/world/cultivation');
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
g.paused = false; g.story.skipAll?.(); g.modal = null;
const N = g.npcs, sim = N.sim, T = g.treasure;
const close = () => { if (g.modal) g.closeModal(true); };
const run = (sec: number) => { for (let i = 0; i < sec * 30; i++) { g.update(1 / 30); close(); } };
// 野外：黄枫谷东南方向找一处不在城镇里的地方
const hf = LOC_BY_ID.get('huangfeng')!;
let wx = hf.x * WORLD_SCALE + 9000, wy = hf.y * WORLD_SCALE + 6000;
for (let k = 0; k < 40 && (g.combat.safeAt(wx, wy) || terrain.walkFactor(wx, wy) <= 0); k++) { wx += 1500; wy += 700; }
g.teleport(wx, wy);
ok(!g.combat.safeAt(wx, wy), `玩家在野外（${Math.round(wx)}, ${Math.round(wy)}）`);
const h = g.hero; h.realm = 1; h.stage = 5;
const ART = 'art_miemo';
C.addItem(h, ART, 1);
run(1.2);
const p = g.player;
const pool = () => N.list.filter((d: any) => d.alive && (d.map ?? 'tiannan') === ACTIVE_MAP && d.realm >= 2 && !d.stay && !d.beauty && !d.ros && !d.gz && !d.bond && !d.hidden && !d.chasing && !d.canon && d.aim?.k !== 'covet');
const place = (d: any, x: number, y: number) => { d.x = x; d.y = y; d.tx = x; d.ty = y; d.aim = undefined; N.active.delete(d.id); };
const quiet = (except: any[] = []) => { for (const d of N.list) if (!except.includes(d) && d.alive && (d.map ?? 'tiannan') === ACTIVE_MAP && Math.hypot(d.x - p.x, d.y - p.y) < 75000) { d.x += 200000; d.tx = d.x; } };

// ———— 1) 亮宝 → 目击 → 传闻 → 远处的人真的赶来
{
  const cands = pool();
  const wit = cands[0], far = cands[1];
  quiet([wit, far]);
  wit.pers = 'cautious'; wit.faction = 'sect'; wit.favor = 60;   // 目击者本人不动手，只负责传话
  far.pers = 'ruthless'; far.faction = 'demon'; far.favor = -10;
  place(wit, p.x + 1200, p.y + 300);
  place(far, p.x + 14000, p.y - 4000);
  ok(npcPower(far) > T['heroPower']() * 1.2, `远处的魔修自认打得过你（${Math.round(npcPower(far))} vs ${Math.round(T['heroPower']())}）`);
  const tip = T.onShow(ART, 'use');
  ok(tip && tip.wit.includes(wit.id), `当众祭出灭魔箭，被 ${wit.name} 看在眼里（目击 ${tip?.wit.length} 人）`);
  ok(far.aim?.k !== 'covet', '远处的人此刻还不知道');
  // 目击者走远 → 消息传出
  place(wit, p.x + 9000, p.y + 300);
  const d0 = Math.hypot(far.x - p.x, far.y - p.y);
  for (let i = 0; i < 8; i++) { g.day += 1; run(0.6); if (far.aim?.k === 'covet') break; }
  const ev = sim.S.ev.find((e: any) => e.k === 'flaunt' && e.items?.[0]?.id === ART);
  ok(ev, `传闻里出现了你的宝：${ev?.text ?? '无'}`);
  ok(far.aim?.k === 'covet', `${far.name}听说后起了贪念（aim=${far.aim?.k}，${far.why}）`);
  T['struck'].add(far.id);   // 只看他是不是真在赶路（不让追杀系统接手）
  const d1a = Math.hypot(far.x - p.x, far.y - p.y);
  run(3);
  const d1 = Math.hypot(far.x - p.x, far.y - p.y);
  ok(d1 < d1a - 300 && d1 < d0, `${far.name}真的从地图上赶来：${Math.round(d0)} → ${Math.round(d1)}`);
  ok(sim.S.ev.some((e: any) => e.k === 'covet' && e.a === far.id), '风云录记下「起了贪念，动身前来」');
  far.aim = undefined; far.hunting = false; place(far, far.x + 150000, far.y); T['struck'].delete(far.id);
}

// ———— 2) 蒙面杀人不记名
{
  quiet();
  const v = pool()[0]; place(v, p.x + 600, p.y);
  T.T.masked = true;
  const rep0 = g.ws.rep, fame0 = sim.S.fame;
  N.onEnemyKilled({ npcId: v.id, x: v.x, y: v.y });
  const e = sim.S.ev[sim.S.ev.length - 1];
  ok(!v.alive && e.text.includes('蒙面') && !e.text.includes(p.name) && e.a !== 'hero', `蒙面杀人：${e.text}`);
  ok(g.ws.rep === rep0 && sim.S.fame === fame0, `声望 / 名声不变（${rep0}→${g.ws.rep}）`);
  T.T.masked = false;
  const v2 = pool()[0]; place(v2, p.x + 600, p.y);
  N.onEnemyKilled({ npcId: v2.id, x: v2.x, y: v2.y });
  const e2 = sim.S.ev[sim.S.ev.length - 1];
  ok(e2.text.includes(p.name), `不蒙面：${e2.text.slice(0, 30)}…`);
  g.combat.loot = [];
}

// ———— 3) 杀人灭口：目击者在消息传出前全死了
{
  quiet();
  const ws = pool().slice(0, 2); ws.forEach((d: any, i: number) => place(d, p.x + 900 + i * 300, p.y + 200));
  const ART2 = 'art_zhuque'; C.addItem(h, ART2, 1); run(1.2);
  const tip = T.onShow(ART2, 'use');
  ok(tip && tip.wit.length === 2, `亮出朱雀环，两人目击`);
  for (const d of tip.wit.map((id: string) => N.byId.get(id))) { T.onKill(d); N.die(d, '灭口'); }
  for (let i = 0; i < 6; i++) { g.day += 1; run(0.6); }
  ok(tip.dead && !tip.out, '目击者尽数灭口，消息没有传出去');
  ok(!sim.S.ev.some((e: any) => e.k === 'flaunt' && e.items?.[0]?.id === ART2), '传闻栏里没有朱雀环的事');
  C.removeItem(h, ART2, 1); run(1.2);
}

// ———— 4) 抢来的宝带着原主烙印：威力打折、原主追来、炼化后抹去
{
  quiet();
  const own = pool().find((d: any) => npcPower(d) > T['heroPower']())!;
  place(own, p.x + 16000, p.y + 3000);
  const ART3 = 'art_lvhuang';
  provOf(sim.S, ART3, own.id, own.name, g.day - 30, 'origin');
  provMoveAll(sim.S, [{ id: ART3 }], own.id, own.name, 'hero', p.name, g.day, 'kill', own.sect);
  C.addItem(h, ART3, 1); run(1.2);
  const pv = T.provOfHero(ART3);
  ok(pv?.mark?.who === own.id, `绿煌剑上残留着${own.name}的神识烙印（${pv?.mark?.need} 日可炼化）`);
  ok(T.powerMul(ART3) === 0.6, '威力六折');
  const lines = T.provLines(ART3);
  ok(lines && lines.lines.length >= 2, `历任主人：${lines?.uid} ${lines?.lines.join(' / ')}`);
  let came = false;
  for (let i = 0; i < 40 && !came; i++) { g.day += 1; run(0.5); came = own.aim?.k === 'covet'; }
  ok(came, `烙印未除，原主${own.name}循着感应追来（${own.why}）`);
  own.aim = undefined; own.hunting = false; place(own, own.x + 150000, own.y); g.pursuit.reset?.();
  // 闭关炼化
  g.day += 70; run(0.6);
  ok(!T.provOfHero(ART3)?.mark && T.powerMul(ART3) === 1, '闭关七十日，烙印抹去，威力恢复');
  ok(T.provLines(ART3)?.lines.some((l: string) => l.includes('炼化')), '历任主人里记下了「炼化」');
}

// ———— 5) 死在真人手里：储物袋归杀手；杀回去东西还在他身上
{
  quiet(); g.pursuit.reset?.();
  const k = pool().find((d: any) => npcPower(d) > T['heroPower']())!;
  place(k, p.x + 400, p.y);
  N.update(0.1);
  const a = N.active.get(k.id) ?? (N as any).activate?.(k);
  let e: any = null;
  if (a) e = N.toEnemy(a, true);
  if (!e) { e = { npcId: k.id, x: k.x, y: k.y, dead: false }; g.combat.enemies.push(e); }
  const ls0 = C.bagCount(h, 'mat_lingshi') || (C.addItem(h, 'mat_lingshi', 500), 500);
  const w0 = k.wealth;
  g.onPlayerDown();
  ok(!C.bagCount(h, ART) && k.bag.some((b: any) => b.id === ART), `被${k.name}打倒，灭魔箭到了他的储物袋里`);
  ok(k.wealth >= w0 + ls0 * 0.9, `灵石也归了他（${w0} → ${k.wealth}）`);
  const pv = provOf(sim.S, ART, k.id, k.name, g.day, 'origin', false);
  ok(pv?.mark?.who === 'hero', '灭魔箭上留着你的烙印（能感应到它在哪儿）');
  ok(T.T.lost?.id === k.id, `记下了仇人：${T.T.lost?.name}（${T.T.lost?.what}）`);
  ok(sim.S.ev.some((e: any) => e.k === 'rob' && e.a === k.id && e.b === 'hero'), '风云录：某某击倒了你、夺走储物袋');
  // 报仇：杀了他，东西掉在地上，捡回来
  g.combat.enemies = [];
  N.onEnemyKilled({ npcId: k.id, x: p.x + 50, y: p.y });
  const drop = g.combat.loot.find((l: any) => l.id === ART);
  ok(drop, '杀了他，你的灭魔箭从他的储物袋里掉了出来');
  for (let i = 0; i < 60; i++) { g.update(1 / 30); close(); }
  ok(C.bagCount(h, ART) > 0, '捡回灭魔箭');
  const back = T.provOfHero(ART);
  ok(back && !back.mark, `物归原主，烙印仍是你的（历任：${T.provLines(ART)?.lines.join(' / ')}）`);
}

// ———— 6) 销赃：正道坊市拒收、鬼市压价
{
  const own = pool()[0];
  const ART4 = 'art_lanjin';
  const city = LOC_BY_ID.get('jiayuan') ?? [...LOC_BY_ID.values()].find((l: any) => l.type === 'city' && l.map === ACTIVE_MAP)!;
  const shop = g.towns.shop(city, 'artifact');
  const pn = g.towns.sellPrice(shop, ART4);   // 干净货的正价
  provOf(sim.S, ART4, own.id, own.name, g.day - 30, 'origin');
  provMoveAll(sim.S, [{ id: ART4 }], own.id, own.name, 'hero', p.name, g.day, 'kill', own.sect ?? 'huangfeng');
  C.addItem(h, ART4, 1); run(1.2);
  const ok1 = g.towns.sell(shop, ART4);
  ok(!ok1 && C.bagCount(h, ART4) === 1, `正道坊市（${city.name}）拒收带烙印的蓝金砖`);
  const black = T.blackShop(city);
  const pb = g.towns.sellPrice(black, ART4);
  const ls = C.bagCount(h, 'mat_lingshi');
  const ok2 = g.towns.sell(black, ART4);
  ok(ok2 && C.bagCount(h, ART4) === 0 && C.bagCount(h, 'mat_lingshi') === ls + pb, `鬼市肯收，压价到 ${pb}（正价 ${pn}，此前拒收）`);
  ok(pb < pn * 0.5, '鬼市价不到正价一半');
  const mo = { ...shop, zone: 'mo' };
  C.addItem(h, ART4, 1); run(1.2);
  const pv = T.provOfHero(ART4);
  ok(!pv || T.fence(mo, ART4).ok, '魔道交换会肯收（或已洗白的不算有主）');
}

// ———— 7) 存读档：来历表、传闻表随存档走；旧存档没有这些字段也能读
{
  const j = JSON.stringify(g.ws);
  const ws2 = JSON.parse(j);
  ok(Array.isArray(ws2.sim.prov.items) && ws2.sim.prov.items.length > 0, `来历表进了存档（${ws2.sim.prov.items.length} 件）`);
  delete g.ws.sim.prov; delete g.ws.sim.tr;
  run(1.2);
  ok(Array.isArray(g.ws.sim.prov?.items) && Array.isArray(g.ws.sim.tr?.tips), '旧存档缺这两张表：自动补上');
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
