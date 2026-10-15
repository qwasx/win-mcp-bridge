// 主线冒烟测试：从新开局一路走到黄枫谷
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const C = await import('../src/world/cultivation');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
g.reset();
const S = g.story as any;
const tick = (n = 5, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };
const show = () => { const m: any = g.modal; return m?.node ? `${m.node.speaker}: ${(m.node.text as string).slice(0, 36).replace(/\n/g, ' ')} [${m.node.options.map((o: any) => o.label).join('|')}]` : '-'; };
const pick = (sub = '') => { const m: any = g.modal; if (!m?.node) { console.log('   (no modal)'); return; } const o = m.node.options.find((x: any) => x.label.includes(sub)) ?? m.node.options[0]; g.closeModal(true); const nx = o.act?.(); if (nx) g.openDialog(nx); };
const drain = () => { for (let i = 0; i < 8 && g.modal; i++) { console.log('   modal', show()); pick(); } };
const to = (k: string, dx = 0, dy = 40) => { const a = S.A[k]; g.teleport(a.x + dx, a.y + dy); tick(3); };
const talk = (id: string) => { const a = S.actors.find((x: any) => x.id === id); if (!a) { console.log('   !! no actor', id, S.actors.map((x: any) => x.id)); return; } g.teleport(a.x, a.y + 60); tick(2); S.interact(a); };
const killAll = () => { for (let w = 0; w < 4; w++) { for (const e of g.combat.enemies) if (!e.dead) { e.dead = true; e.deathT = 0; } tick(4); drain(); } };
const step = () => S.S.step;
const T = g.terrain;
for (const k of Object.keys(S.A)) { const a = S.A[k]; console.log('anchor', k, Math.round(a.x), Math.round(a.y), 'walk', T.walkFactor(a.x, a.y) > 0); }
tick(50); console.log('1', step(), show()); pick('前往');
console.log('2', step(), S.tracker()?.text);
talk('mo'); drain(); console.log('3', step(), g.hero.arts.some((a: any) => a.id === 'luoyan'));
to('creek', 0, 200); tick(3); console.log('4', step());
talk('bottle'); drain(); console.log('5', step(), g.hero.bottle);
for (let i = 0; i < 3; i++) S.onGather(); console.log('6', S.tracker()?.text);
talk('mo'); drain(); console.log('7', step());
// 等到夜里
let n = 0; while (g.night < 0.65 && n++ < 4000) { g.clock += 1; tick(1); } console.log('night', g.night.toFixed(2), step(), !!S.cine);
for (let i = 0; i < 260; i++) g.update(1 / 30); drain(); console.log('8', step(), g.hero.bottle);
const herb = g.hero.bag.find((b: any) => b.id === 'herb_huangjing'); g.useBottle(herb); tick(30); drain(); console.log('9', step(), g.hero.bag.filter((b: any) => b.id === 'herb_huangjing').map((b: any) => b.age));
talk('li'); console.log('   ', show()); pick('保密，再配'); drain(); console.log('10', step(), S.f.li, g.hero.arts.some((a: any) => a.id === 'zhayan'));
talk('mo'); pick('遵命'); drain(); console.log('11', step());
n = 0; g.clock += 120; while (g.night < 0.65 && n++ < 4000) { g.clock += 1; tick(1); }
to('valley', 0, 60); tick(5); console.log('12', step(), show()); pick('坐进'); drain(); console.log('   fight', !!S.fight, S.fight?.mind, g.combat.enemies.filter((e: any) => !e.dead).map((e: any) => e.name + ' ' + e.rankText + ' hp' + e.maxHp));
// 识海战败重试
g.hero.hp = 0; (g.combat as any).playerDown(); tick(3); console.log('   after down', step(), !!S.fight, g.hero.hp, S.f.moMet);
to('valley', 0, 60); tick(5); pick('坐进'); drain(); killAll(); console.log('13', step(), g.hero.arts.some((a: any) => a.id === 'quhun'), C.bagCount(g.hero, 'item_moletter'));
g.day += 13; tick(5); console.log('14', step());
to('gate', 0, 0); tick(5); drain(); console.log('   foes', g.combat.enemies.filter((e: any) => !e.dead).map((e: any) => e.name + ' ' + e.rankText + ' hp' + e.maxHp + ' atk' + e.atk.toFixed(1)));
for (const e of g.combat.enemies) if (!e.dead) e.dead = true; tick(4); drain();
console.log('   foes2', g.combat.enemies.filter((e: any) => !e.dead).map((e: any) => e.name + ' ' + e.rankText + ' hp' + e.maxHp));
for (let i = 0; i < 200; i++) tick(1); console.log('   vfx', g.combat.vfx.map((v: any) => v.kind).join(','));
killAll(); console.log('15', step(), C.bagCount(g.hero, 'item_shengxian'), C.bagCount(g.hero, 'tal_fubao'));
talk('yan'); pick('一言为定'); drain(); console.log('16', step());
to('duba', 0, 0); tick(5); drain(); console.log('   foes', g.combat.enemies.filter((e: any) => !e.dead).map((e: any) => e.name + ' ' + e.rankText + ' hp' + e.maxHp));
killAll(); console.log('17', step());
talk('yan'); pick('婉言'); drain(); console.log('18', step(), C.bagCount(g.hero, 'item_nuanyang'));
talk('wan'); drain(); console.log('19', step());
g.ws.sect = { id: 'huangfeng', rank: 0, contrib: 50, joined: g.day, lastPay: g.day, tasks: [], done: 0 } as any; tick(5); drain(); console.log('20', step(), S.tracker());
// 符箓
g.hero.hotbar[8] = 'tal:tal_fubao'; g.combat.castSlot(8); console.log('tal left', C.bagCount(g.hero, 'tal_fubao'));
g.hero.hotbar[7] = 'quhun'; g.combat.castSlot(7); tick(10); console.log('summons', g.combat.summons.map((s: any) => s.kind + (s.cs ? '+cs' : '')));
console.log('news', g.ws.news.slice(-3).map((x: any) => x.text.slice(0, 30)).join(' / '));
