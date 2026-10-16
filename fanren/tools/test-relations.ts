// 第二十九步：人情世故冒烟测试：npx tsx tools/test-relations.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = g.rel, N = g.npcs;
g.teleport(251520, 147800); console.log('safe?', g.combat.safeAt(g.player.x, g.player.y));
// 1) 人脉网
const withTies = N.list.filter((d) => d.ties?.length);
const kin = N.list.filter((d) => d.ties?.some((t) => t.k === 'kin'));
console.log('npcs', N.list.length, 'with ties', withTies.length, 'kin', kin.length, 'foe', N.list.filter((d) => d.ties?.some((t) => t.k === 'foe')).length);
ok(withTies.length > 40, '人脉网已生成');
ok(N.byId.get('o_mengtieyi')?.ties?.some((t) => t.id === 'o_mengtieshan'), '孟家兄弟相连');
ok(N.byId.get('nanlonghou') && N.byId.get('baiyaoyi'), '南陇侯 / 白瑶怡在册');
// 双向
let asym = 0; for (const d of withTies) for (const t of d.ties!) { const o = N.byId.get(t.id); if (!o?.ties?.some((x) => x.id === d.id)) asym++; }
ok(asym === 0, '关系双向');
// 2) 仇恨蔓延：杀一个有亲人的散修
const victim = kin.find((d) => !d.canon && d.realm > 0 && d.faction !== 'demon')!;
const kinIds = victim.ties!.filter((t) => t.k === 'kin').map((t) => t.id);
g.hero.realm = 2; g.hero.stage = 2;
R.onPlayerKill(victim, false); N.die(victim, '死于韩立之手');
for (const id of kinIds) { const o = N.byId.get(id)!; ok(o.grudge === 2 && o.why && o.huntAt !== undefined, `亲人 ${o.name} 结下血仇：${o.why}`); }
ok(R.tier(N.byId.get(kinIds[0])!) === '死敌', '档位 = 死敌');
// 3) 每日：追杀 / 雇凶 / 悬赏
for (const id of kinIds) N.byId.get(id)!.huntAt = g.day;
g.day += 1; R.daily(1);
const k0 = N.byId.get(kinIds[0])!;
console.log('after daily: hunting', k0.hunting, 'wanted', R.S.wanted.length, 'pursuit', !!(g.pursuit as any).pending, 'log', R.S.log.slice(-3).map((l) => l.text));
ok(k0.hunting || R.S.wanted.length || (g.pursuit as any).pending, '死敌出手（追杀 / 雇凶 / 悬赏）');
// 4) 对峙：化解
const dn = R.parleyNode(k0, null, () => {}, () => {});
ok(dn.options.length >= 3, `对峙选项：${dn.options.map((o) => o.label).join(' / ')}`);
// 5) 宗门声望 / 围剿
const sectM = N.list.find((d) => d.alive && d.sect && d.faction === 'sect' && d.realm > 0 && !d.canon)!;
for (let i = 0; i < 4; i++) R.onPlayerKill({ ...sectM, id: 'tmp' + i, ties: [] } as any, false);
console.log('sect rep', sectM.sect, R.sectRep(sectM.sect), 'wanted', R.S.wanted.map((w) => w.name + w.amount));
ok(R.sectRep(sectM.sect) <= -60, '宗门声望跌破围剿线');
R.S.siegeCd = 0; R.siege(sectM.sect!);
const siege = N.list.filter((d) => d.why?.startsWith('奉'));
ok(siege.length >= 1 && siege.every((d) => d.hunting), `执法弟子 ${siege.length} 人出动`);
// 6) 交谈：talkOpts
const friend = N.list.find((d) => d.alive && d.realm >= 1 && !d.canon && !d.grudge && d.faction !== 'mortal' && !d.why)!;
friend.favor = 85; friend.met = true; friend.realm = 2;
const a: any = N.summon(friend.id); a.act = 'idle';
const opts = R.talkOpts(a, 't', () => ({ speaker: '', text: '', options: [] }));
console.log('talk opts', opts.map((o) => o.label + (o.disabled ? '(x)' : '')).join(' | '));
ok(opts.some((o) => o.label === '义结金兰'), '可结拜');
const sw = opts.find((o) => o.label === '义结金兰')!; sw.act();
ok(friend.bond === 'sworn' && R.tier(friend) === '结拜', '结拜成功');
// 7) 求饶
const { Enemy } = await import('../src/world/combat');
const foe = N.list.find((d) => d.alive && d.realm >= 1 && !d.canon && !d.bond && d.pers === 'kind')!;
const fa: any = N.summon(foe.id); fa.act = 'idle';
const e = N.toEnemy(fa, true); e.yieldAt = 0.2; e.hp = e.maxHp * 0.25;
g.combat.hitEnemy(e, e.maxHp * 0.1, { realm: g.hero.realm } as any, e.x, e.y);
ok(g.modal?.kind === 'dialog' && (g.modal as any).node.options.some((o: any) => o.label === '斩草除根'), '敌人求饶 → 对话');
const spare = (g.modal as any).node.options[0]; spare.act(); g.closeModal(true);
ok(e.dead && e.spar && foe.alive, '饶他一命：不算击杀');
// 8) 仇恨：灵宠 / 同伴吸引火力
g.combat.reset();
const p = g.player;
const comp = N.list.find((d) => d.alive && d.realm >= 2 && !d.canon && !d.bond && d !== foe)!;
comp.bond = 'companion'; comp.bondUntil = g.day + 30; const ca: any = N.summon(comp.id);
ca.st.x = p.x + 300; ca.st.y = p.y;
const { ENEMIES } = await import('../src/data/enemies') as any;
const wolf = new Enemy(ENEMIES.wolf, p.x + 420, p.y, 2, 1); wolf.aggro = true; wolf.maxHp = wolf.hp = wolf.maxHp * 40; g.combat.enemies.push(wolf);
for (let i = 0; i < 80; i++) { g.update(1 / 20); if (i % 20 === 0) console.log(' t', i, 'modal', g.modal?.kind, 'dist', Math.round(Math.hypot(wolf.x - ca.st.x, wolf.y - ca.st.y)), 'pd', Math.round(Math.hypot(wolf.x - p.x, wolf.y - p.y)), 'aggro', wolf.aggro, 'paused', (g as any).paused, 'dead', wolf.dead); }
console.log('wolf tank', wolf.tankRef === ca ? 'ally' : wolf.tankRef, 'ally hp', ca.hp.toFixed(2), 'hero hp', g.hero.hp.toFixed(2));
ok(wolf.tankRef === ca && ca.hp < 1, '敌人转而攻击挡在前面的同伴（同伴受伤）');
// 9) 日常：跑一阵，看看摆摊 / 钓鱼 / 闲聊
const town = LOC_BY_ID.get('jiayuan')!;
g.combat.reset(); g.teleport(town.x * WORLD_SCALE, town.y * WORLD_SCALE + 300);
const life: Record<string, number> = {};
for (let i = 0; i < 1200; i++) { g.update(1 / 10); if (i % 50 === 0) for (const x of (N as any).active.values()) if (x.life) life[x.life.k] = (life[x.life.k] ?? 0) + 1; if (g.modal) g.closeModal(true); }
console.log('life acts seen', life);
ok(Object.keys(life).length >= 1, '市井日常出现');
for (let i = 0; i < 20; i++) g.renderer.render(1 / 30);
// 10) 存读档
const save = N.toSave(); N.fromSave(JSON.parse(JSON.stringify(save)));
ok(N.byId.get(friend.id)?.bond === 'sworn' && N.list.filter((d) => d.ties?.length).length === N.list.filter((d) => d.ties?.length).length, '存读档保留羁绊');
console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
