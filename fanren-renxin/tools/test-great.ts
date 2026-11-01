// 第四十步：大夺宝测试——出世、镇宝妖王、三四路元婴混战、抢收、取宝彩头：npx tsx tools/test-great.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE, ACTIVE_MAP } = await import('../src/data/world');
const C = await import('../src/world/cultivation');
const { itemDef } = await import('../src/data/items');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 4; g.hero.stage = 2;
const X0 = l.x * WORLD_SCALE + 1400, Y0 = l.y * WORLD_SCALE + 900;
g.teleport(X0, Y0);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); g.paused = false;
const c = g.combat, p = g.player, h = g.hero, G = g.happen.great;
let fails = 0;
const ok = (cond: any, msg: string) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const f = g.ws.flags;
// 1) 自然出世
f.greatNext = g.day - 1; G.t = 0; G.tick(0.6);
const gs = G.st();
ok(gs && !gs.done && gs.map === ACTIVE_MAP, '到期后大夺宝出世');
const d0 = gs ? Math.hypot(gs.x - p.x, gs.y - p.y) : 0;
ok(d0 > 5000 && d0 < 15000, `出世地点远在 ${Math.round(d0)}（6000–14000 附近）`);
ok(G.marks().length === 1 && G.marks()[0].glyph === '夺', '地图标「夺」');
ok(G.chance()?.hot, '大事记「眼下机缘」列出大夺宝');
ok(f.greatNext - g.day >= 240, `下一次在 ${Math.round(f.greatNext - g.day)} 日后`);
// 2) 走近：镇宝妖王 + 三四路元婴
c.enemies.length = 0;
g.teleport(gs.x + 1500, gs.y); G.t = 0; G.tick(0.6);
const guard = c.enemies.filter((e: any) => e.tag === 'great:guard');
const rivals = c.enemies.filter((e: any) => e.tag === 'great:rival');
const leads = rivals.filter((e: any) => e.realm === 4);
const teams = new Set(rivals.map((e: any) => e.team));
console.log(`  镇宝：${guard.map((e: any) => e.name + ' 妖' + e.realm + '/' + e.stage).join('')}  争宝：${rivals.length} 人 / ${teams.size} 路 / 元婴 ${leads.length}`);
ok(guard.length === 1 && guard[0].realm >= 4 && guard[0].boss, '镇宝的是八、九级妖王');
ok(teams.size >= 3 && leads.length === teams.size, '三四路人马，每路一位元婴领头');
ok(rivals.every((e: any) => e.realm >= 3), '随从至少结丹');
ok(!teams.has(guard[0].team), '妖王与各路人马不同阵（混战）');
// 3) 混战一阵子
const run = (sec: number) => { for (let i = 0; i < sec * 30; i++) { g.modal = null; h.hp = Math.max(h.hp, h.maxHp ?? 1); h.dead = false; c.invulnT = 99; g.update(1 / 30); } };
const hp0 = rivals.reduce((s: number, e: any) => s + e.hp, 0) + guard[0].hp;
run(12);
const hp1 = c.enemies.filter((e: any) => e.tag?.startsWith('great')).reduce((s: number, e: any) => s + (e.dead ? 0 : e.hp), 0);
ok(hp1 < hp0 * 0.97, `混战中彼此掉血（${Math.round(hp1 / hp0 * 100)}%）`);
// 4) 妖王倒下 → 有人抢收；把他们挪开，玩家上前取宝
guard[0].hp = 0; guard[0].dead = true; G.onKill(guard[0]);
for (const e of c.enemies) if (e.tag === 'great:rival') { e.x = gs.x + 260; e.y = gs.y; e.cast = null; }
G.t = 0; G.tick(0.6);
ok(gs.taker !== undefined && gs.seize > 0, '妖王一倒，元婴老怪扑上去收宝');
for (const e of c.enemies) if (e.tag === 'great:rival') { e.x = gs.x + 3000; e.hx = e.x; }
g.teleport(gs.x + 60, gs.y); G.t = 0; G.tick(0.6);
ok(G.focus, '近前可取宝（T）');
const bag0 = new Map(h.bag.map((b: any) => [b.id, b.n]));
const ls0 = C.bagCount(h, 'mat_lingshi');
ok(G.interact(), '打开取宝对话');
const node = g.modal?.node ?? g.dialog ?? g.modal;
const opt = (node?.options ?? node?.node?.options)?.[0];
const res = opt?.act?.();
const gained = h.bag.filter((b: any) => (b.n ?? 1) > ((bag0.get(b.id) as number) ?? 0)).map((b: any) => b.id);
console.log('  彩头：' + gained.map((id: string) => itemDef(id).name + '(' + itemDef(id).tier + ')').join('、'));
ok(gs.done, '取宝后大夺宝结束');
ok(gained.some((id: string) => itemDef(id).tier >= 5), '至少一件五品以上的至宝');
ok(C.bagCount(h, 'mat_lingshi') - ls0 >= 20000, '另有两三万以上灵石');
ok(res && /至宝入手/.test(res.title ?? ''), '结果对话');
ok(G.marks().length === 0, '结束后标记消失');
// 5) 主宝分布（1000 次）
const dist: Record<string, number> = {};
for (let i = 0; i < 1000; i++) { const pr = (G as any).prize(); const k = itemDef(pr.main).tier >= 6 ? '通天至宝' : pr.main.startsWith('art_') ? '元婴灵宝' : '秘术/异兽'; dist[k] = (dist[k] ?? 0) + 1; }
console.log('  主宝分布：', dist);
ok((dist['通天至宝'] ?? 0) > 150 && (dist['秘术/异兽'] ?? 0) > 100, '三类主宝都会出');
// 6) 过期无人取：归了别人
f.great = { map: ACTIVE_MAP, x: p.x + 9000, y: p.y, day: g.day - 61, rivals: ['甲', '乙', '丙'] }; G.t = 0; G.tick(0.6);
ok(G.st().done, '六十日无人取走即落幕');
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
