// 第三十六步：宗门名册冒烟测试：npx tsx tools/test-roster.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const { SECT_DEFS, member } = await import('../src/world/roster');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
let tot = 0; for (const d of SECT_DEFS) tot += d.n;
ok(tot > 2000, `名册总人数 ${tot}`);
ok(member(SECT_DEFS[0], 7).name === member(SECT_DEFS[0], 7).name, '名册确定生成');
const R = g.rel, N = g.npcs, RO = g.roster;
// 1) 走近黄枫谷：门人现身
const hf = LOC_BY_ID.get('huangfeng')!;
g.teleport(hf.x * WORLD_SCALE, hf.y * WORLD_SCALE + 300);
(RO as any).acc = 0; RO.update(0.1);
const here = N.list.filter((d) => d.ros === 'huangfeng');
ok(here.length >= 8, `黄枫谷山门现身 ${here.length} 人：${here.slice(0, 5).map((d) => d.title + d.name).join('、')}`);
ok(RO.aliveCount('huangfeng') === 96, '黄枫谷名册 96 人（钟灵道、令狐老祖占席）');
ok(RO.members('huangfeng')[0].name === '钟灵道', '掌门 = 钟灵道');
ok(!N.hostileTo(here[0]), '未翻脸的门人不主动出手');
// 2) 存档只存要紧的
const saved = N.toSave(); ok(!saved.some((d: any) => d.ros), '无交情的门人不进存档');
// 3) 杀一个内门弟子 → 记入名册 + 寻仇队
g.hero.realm = 2; g.hero.stage = 1;
const v = here.find((d) => d.realm >= 1)!;
R.onPlayerKill(v, false); N.die(v, '死于韩立之手');
(RO as any).acc = 0; RO.update(0.1);
ok(RO.isDead('huangfeng', v.rosI!), `${v.name} 记入名册已故`);
ok(RO.aliveCount('huangfeng') === 95, '在世 95');
ok(R.S.rev?.length === 1, `寻仇待发：${JSON.stringify(R.S.rev)}`);
R.S.rev![0].day = g.day; (g.pursuit as any).cd = 0;
g.day += 1; R.daily(1);
const avengers = N.list.filter((d) => d.ros === 'huangfeng' && d.alive && (d.hunting || d.chasing || (d.why ?? '').includes('报仇')));
ok(avengers.length >= 3 && avengers.length <= 8, `寻仇 ${avengers.length} 人：${avengers.map((d) => d.title + d.name + d.realm).join('、')}`);
ok(N.toSave().filter((d: any) => d.ros).length >= avengers.length, '寻仇者进存档');
// 4) 离开：无关门人散去
g.teleport(hf.x * WORLD_SCALE + 40000, hf.y * WORLD_SCALE);
N.update(0.1); (RO as any).acc = 0; RO.update(0.1);
const left = N.list.filter((d) => d.ros === 'huangfeng' && !(d.hunting || d.chasing || d.grudge));
ok(left.length === 0, `远离后散去（剩 ${left.length}）`);
// 5) 补员
(g.ws.flags as any).ros.huangfeng.d.push(50, 60, 70);
for (let k = 0; k < 40; k++) RO.daily(30);
ok(RO.aliveCount('huangfeng') > 93, `补收新弟子：${RO.aliveCount('huangfeng')}`);
console.log(fails ? `${fails} FAIL` : 'ALL OK');
process.exit(fails ? 1 : 0);
