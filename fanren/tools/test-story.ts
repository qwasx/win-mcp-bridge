// 开局冒烟测试（第十二步起不再有序章）：新开一局即是韩立初入黄枫谷，炼气五层，身怀掌天瓶。
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const C = await import('../src/world/cultivation');
const { REALMS } = await import('../src/data/realms');
const { ARTS } = await import('../src/data/arts');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
g.reset();
const S = g.story as any;
const tick = (n = 5, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };
const show = () => { const m: any = g.modal; return m?.node ? `${m.node.speaker}: ${(m.node.text as string).slice(0, 30).replace(/\n/g, ' ')} [${m.node.options.map((o: any) => o.label).join('|')}]` : '-'; };
const pick = (sub = '') => { const m: any = g.modal; if (!m?.node) return false; const o = m.node.options.find((x: any) => x.label.includes(sub)) ?? m.node.options[0]; g.closeModal(true); const nx = o.act?.(); if (nx) g.openDialog(nx); return true; };
let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

const h = g.hero;
check('剧情直接自由（无序章）', S.S.step === 'free' && !S.active, S.S.step);
check('炼气五层', h.realm === 1 && h.stage === 4, `${REALMS[h.realm].name}${REALMS[h.realm].stages[h.stage]}`);
check('掌天瓶在身（一滴绿液）', h.bottle.owned && h.bottle.drops >= 1 && C.bagCount(h, 'item_bottle') === 1);
check('符箓', C.bagCount(h, 'tal_fire') > 0 && C.bagCount(h, 'tal_jingang') > 0);
const arts = h.arts.map((a: any) => a.id);
check('基础法术 + 罗烟步 + 御风诀', ['qijin', 'huodan', 'fengren', 'luoyan', 'yufeng'].every((id) => arts.includes(id)), arts.join(','));
check('罗烟步=闪身、御风诀=赶路', ARTS.luoyan.cast === 'dash' && ARTS.yufeng.cast === 'buff' && ARTS.yufeng.name === '御风诀');
check('快捷栏', h.hotbar.includes('luoyan') && h.hotbar.includes('yufeng'), h.hotbar.join(','));
check('黄枫谷外门弟子', g.ws.sect?.id === 'huangfeng' && g.ws.sect.rank === 0, JSON.stringify({ id: g.ws.sect?.id, tasks: g.ws.sect?.tasks.length }));
const hf = LOCATIONS.find((l) => l.id === 'huangfeng')!;
const dist = Math.hypot(g.player.x - hf.x * WORLD_SCALE, g.player.y - hf.y * WORLD_SCALE);
check('开局在黄枫谷山门前', dist < 4000 && g.terrain.walkFactor(g.player.x, g.player.y) > 0, `距宗门中心 ${Math.round(dist)}`);
const mo = g.npcs.byId.get('modaifu') as any, li = g.npcs.byId.get('lifeiyu') as any;
check('墨大夫已按原著身死、厉飞雨尚在', (!mo || mo.alive === false) && (!li || (li.alive !== false && !li.hidden)));
check('开局无剧情演员', S.actors.length === 0);

// 开场白：一段即止，不是序章
tick(45);
const first = show();
check('开场白出现', /黄枫谷/.test(first), first);
pick(); const second = show(); pick();
check('开场白两页后结束', !g.modal, second);
tick(30);
check('之后不再弹剧情', !g.modal && S.S.step === 'free', show());

// 御风诀能加快脚程
const before = g.combat.speedMul;
const yi = h.hotbar.indexOf('yufeng');
g.combat.castSlot(yi);
tick(2);
check('御风诀加速', g.combat.speedMul > before, `${before.toFixed(2)} → ${g.combat.speedMul.toFixed(2)}`);

// 旧存档停在序章：读档后剧情直接结束
g.ws.flags.story = { step: 'c1_mo2', f: { herbs: 1 } };
h.bottle.owned = false; h.bottle.drops = 0; C.removeItem(h, 'item_bottle', 1);
S.resume();
check('旧存档序章迁移为自由', S.S.step === 'free' && h.bottle.owned && C.bagCount(h, 'item_bottle') === 1 && S.actors.length === 0);

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
