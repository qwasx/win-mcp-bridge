// 第三阶段·活世界：挂机模拟 N 天，验证 NPC 真的移动、真的成长、物品真的易主、传闻与世界状态一致、远处劫道不依赖玩家位置
// 用法: npx tsx tools/test-sim.ts [days=120]
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP } = await import('../src/data/world');
const { itemDef } = await import('../src/data/items');
const { npcPower } = await import('../src/world/sim/world');
const { worldWitness } = await import('../src/world/sim/witness');
const DAYS = Number(process.argv[2] || 120);
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
(g as any).paused = false; (g as any).story.skipAll?.(); (g as any).modal = null;
const N: any = g.npcs, sim = N.sim;
// 玩家放在地图一角的城里（安全区），远离大多数人
const hf = LOC_BY_ID.get('huangfeng')!;
g.teleport(hf.x * WORLD_SCALE, hf.y * WORLD_SCALE);
const snap = () => new Map(N.list.map((d: any) => [d.id, { x: d.x, y: d.y, realm: d.realm, stage: d.stage, alive: d.alive, map: d.map ?? 'tiannan', bag: JSON.stringify(d.bag ?? null), wealth: d.wealth }]));
const s0 = snap();
const t0 = performance.now();
const close = () => { if (g.modal) g.closeModal(true); };
// 1) 实时层：本图挂机（每帧 1/30 秒）
const liveDays = Math.min(30, DAYS);
const frames = liveDays * 2 * 30;
let maxMs = 0;
for (let i = 0; i < frames; i++) { const a = performance.now(); g.update(1 / 30); const ms = performance.now() - a; if (ms > maxMs) maxMs = ms; close(); }
console.log(`  实时层 ${liveDays} 天：${(performance.now() - t0).toFixed(0)}ms，单帧最慢 ${maxMs.toFixed(1)}ms，统计 ${JSON.stringify(sim.stats)}`);
// 2) 闭关：一口气过去余下的日子（按日结算层）
const rest = DAYS - liveDays;
for (let k = 0; k < rest; k += 30) { g.day += Math.min(30, rest - k); g.update(1 / 30); close(); }
console.log(`  共 ${DAYS} 天，统计 ${JSON.stringify(sim.stats)}，事件 ${sim.S.ev.length} 条`);
const s1 = snap();
// —— 移动
let movedHere = 0, movedFar = 0, tele = 0;
for (const d of N.list) { const a: any = s0.get(d.id); if (!a || !d.alive || a.map !== (d.map ?? 'tiannan')) continue; const dd = Math.hypot(d.x - a.x, d.y - a.y); if (dd > 1500) { if ((d.map ?? 'tiannan') === ACTIVE_MAP) movedHere++; else movedFar++; } }
ok(movedHere > 60, `本图有 ${movedHere} 人真的走远了`);
ok(movedFar > 60, `他图（按日结算）有 ${movedFar} 人走远了`);
// 没有瞬移：抽查实时层一秒内的位移不超过遁速
{ const before = new Map(N.list.map((d: any) => [d.id, [d.x, d.y]])); for (let i = 0; i < 30; i++) { g.update(1 / 30); close(); }
  for (const d of N.list) { const p: any = before.get(d.id); if (!p || !d.alive || (d.map ?? 'tiannan') !== ACTIVE_MAP || N.active.has(d.id) || d.hunting || d.chasing) continue; if (Math.hypot(d.x - p[0], d.y - p[1]) > 2400) tele++; }
  ok(tele === 0, `实时层一秒内无人瞬移（${tele}）`); }
// —— 成长
let grew = 0, majors = 0;
for (const d of N.list) { const a: any = s0.get(d.id); if (!a || !d.alive) continue; if (d.realm > a.realm || (d.realm === a.realm && d.stage > a.stage)) grew++; if (d.realm > a.realm) majors++; }
ok(grew > 50, `${grew} 人修为有进境（其中 ${majors} 人破了大境界）`);
// —— 物品易主：事件里写到谁得了什么，那件东西真在他（或他的下家）身上
const robs = sim.S.ev.filter((e: any) => (e.k === 'kill' || e.k === 'rob' || e.k === 'feud') && e.items?.some((b: any) => b.id !== 'mat_lingshi'));
ok(robs.length > 0, `劫掠 / 杀人夺宝事件 ${robs.length} 起，例：${robs[0]?.text ?? '无'}`);
let consistent = 0, checked = 0;
for (const e of robs) {
  const w = N.byId.get(e.a); if (!w) continue;
  const it = e.items.find((b: any) => b.id !== 'mat_lingshi'); checked++;
  // 赢家还活着：东西多半还在他身上；若已转手，必有后续事件记着他输了 / 用掉了
  const still = w.bag?.some((b: any) => b.id === it.id);
  const later = sim.S.ev.some((x: any) => x.id > e.id && (x.b === w.id || x.a === w.id));
  const used = itemDef(it.id)?.type === 'pill' || itemDef(it.id)?.type === 'talisman';
  if (still || later || used || !w.alive) consistent++;
}
ok(checked > 0 && consistent === checked, `夺来的东西都对得上（${consistent}/${checked}）`);
const kills = sim.S.ev.filter((e: any) => e.k === 'kill' || e.k === 'feud');
const deadOk = kills.every((e: any) => { const v = N.byId.get(e.b); return !v || !v.alive; });
ok(kills.length === 0 || deadOk, `传闻里被杀的人都确实死了（${kills.length} 起）`);
const brk = sim.S.ev.filter((e: any) => e.k === 'break');
ok(brk.every((e: any) => { const d = N.byId.get(e.a); return !d || d.realm >= 2; }), `传闻里突破的人境界都对得上（${brk.length} 起）`);
// —— 远处劫道：发生在玩家神识以外很远的地方
const p = g.player;
const farRobs = sim.S.ev.filter((e: any) => (e.k === 'rob' || e.k === 'kill') && (e.map !== ACTIVE_MAP || Math.hypot(e.x - p.x, e.y - p.y) > g.senseRadius * 5));
ok(farRobs.length > 0, `远离玩家处的劫道 ${farRobs.length} 起（例：${farRobs[0]?.text ?? ''}）`);
// 不依赖玩家位置：同一种子、玩家站在两个不同地方，他图发生的事一样
{ const run = (lx: string) => { const g2 = new Game(terrain); (g2 as any).paused = false; (g2 as any).story.skipAll?.(); g2.modal = null; const L = LOC_BY_ID.get(lx)!; g2.teleport(L.x * WORLD_SCALE, L.y * WORLD_SCALE); for (let k = 0; k < 6; k++) { g2.day += 10; g2.update(1 / 30); if (g2.modal) g2.closeModal(true); } return (g2.npcs as any).sim.S.ev.filter((e: any) => e.map !== ACTIVE_MAP && !['hero', 'omen'].includes(e.k)).map((e: any) => e.text).join('|'); };
  const A = run('huangfeng'), B = run('yuejing');
  ok(A.length > 0 && A === B, `他图事件与玩家站哪儿无关（${A.split('|').length} 条，两次一致：${A === B}）`); }
// —— 传闻栏：有你没看到、但确实发生了的事
g.day += 200; g.update(1 / 30); close();
const heard = sim.heard(200);
ok(heard.some((e: any) => !e.seen && e.k !== 'hero'), `传闻栏里有你没亲眼看到的事（共 ${heard.length} 条）`);
// —— 秘境：晚到一步，宝已被拿走
const taken = Object.entries(sim.S.sites).filter(([, s]: any) => s.taker && s.taker !== 'hero');
ok(taken.length > 0, `已被 NPC 取走宝物的秘境 ${taken.length} 处（${taken.slice(0, 3).map(([id, s]: any) => (LOC_BY_ID.get(id)?.name ?? id) + '←' + s.takerName).join('，')}）`);
// —— 风云榜
const rk = sim.ranking(10);
ok(rk.top.length === 10 && rk.heroRank > 0, `风云榜：${rk.top.slice(0, 5).map((r: any) => r.name + '·' + r.realm).join('、')}…… 你排第 ${rk.heroRank}/${rk.total}`);
// —— 一视同仁：NPC 有储物袋 / 本命法宝 / 功法；死后掉的就是他的储物袋
const armed = N.list.filter((d: any) => d.alive && d.realm >= 2 && d.bag);
ok(armed.length > 50 && armed.filter((d: any) => d.main).length > armed.length * 0.6, `筑基以上 ${armed.length} 人带着储物袋，${armed.filter((d: any) => d.main).length} 人有本命法宝`);
{ const v = armed.find((d: any) => d.main && !d.canon)!; const bag = JSON.stringify(v.bag.map((b: any) => b.id).sort()); const mainName = itemDef(v.main)?.name;
  const dropped: string[] = []; const orig = g.combat.dropLoot.bind(g.combat); (g.combat as any).dropLoot = (x: number, y: number, id: string, n: number) => { dropped.push(id); return orig(x, y, id, n); };
  N.dropLootOf(v, g.player.x, g.player.y); (g.combat as any).dropLoot = orig;
  ok(JSON.stringify(dropped.filter((x) => x !== 'mat_lingshi').sort()) === bag && dropped.includes('mat_lingshi'), `${v.name} 死后掉落 = 生前储物袋（${dropped.length} 件，含本命法宝 ${mainName}）`); }
// 打你时用的就是这件法宝
{ const v = N.list.find((d: any) => d.alive && d.realm >= 2 && d.main && (d.map ?? 'tiannan') === ACTIVE_MAP && !d.canon)!;
  v.x = g.player.x + 300; v.y = g.player.y; const a = N.ensureActive(v); a.st.x = v.x; a.st.y = v.y; const e = N.toEnemy(a, false);
  ok(e.kit?.some((k: any) => k.name === '祭出·' + itemDef(v.main).name), `${v.name} 化为敌人，招式里有「祭出·${itemDef(v.main).name}」`);
  g.combat.enemies = g.combat.enemies.filter((x: any) => x !== e); a.enemy = undefined; }
// —— 世界见证
{ const sect0 = g.hero.bag.length; g.hero.realm = 2; g.hero.stage = 0;
  const ev = worldWitness(g, { kind: 'break', who: 'hero', realm: 2, stage: 0 });
  ok(ev.k === 'omen' && sim.S.fame > 0, `突破异象：${ev.text}`);
  ok(g.hero.bag.length >= sect0, '宗门贺礼进了储物袋');
  const d = N.list.find((x: any) => x.alive && x.realm === 1 && x.faction !== 'mortal');
  ok(/前辈|老祖/.test(sim.address(d)), `炼气修士对你的称呼：${sim.address(d)}`); }
// —— 存读档
g.save(1); const g2 = new Game(terrain); const okLoad = g2.load('fanren_save_1');
const sv = (g2.npcs as any).sim.S;
ok(okLoad && sv.ev.length === sim.S.ev.length && (g2.npcs as any).list.some((d: any) => d.bag && d.main), `存读档：事件 ${sv.ev.length} 条、储物袋都在`);
// 旧存档（没有 sim / bag 字段）也能读
{ const raw = JSON.parse(store['fanren_save_1']); delete raw.world.sim; for (const d of raw.npcs) { delete d.bag; delete d.main; delete d.aim; delete d.xp; delete d.gongfa; } store['fanren_save_2'] = JSON.stringify(raw);
  const g3 = new Game(terrain); ok(g3.load('fanren_save_2'), '旧存档可读'); g3.update(1 / 30); ok((g3.npcs as any).sim.S.v === 1, '旧存档自动补上世界模拟'); }
console.log(fails ? `\n${fails} 项失败` : '\nALL OK');
process.exit(fails ? 1 : 0);
