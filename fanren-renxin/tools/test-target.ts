// 第三十八步：自动锁定测试——所有出手都锁最近的敌人，不跟鼠标 / 朝向；手动锁定、Tab 轮换、提前量
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { ENEMY_LIST } = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 1; g.hero.stage = 8;
g.teleport(l.x * WORLD_SCALE + 900, l.y * WORLD_SCALE + 600);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); g.paused = false;
const c = g.combat, p = g.player, wolf = ENEMY_LIST.find((e: any) => e.id === 'wolf') ?? ENEMY_LIST[0];
let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const mk = (dx: number, dy: number, aggro = true) => { const e = new Enemy(wolf, p.x + dx, p.y + dy, 1, 3); e.aggro = aggro; c.enemies.push(e); return e; };
const reset = () => { c.enemies.length = 0; c.lock = null; c.manual = false; };
console.log('reach', Math.round(c.reach), 'sense', Math.round(g.senseRadius));
// 1) 鼠标指向别处：仍锁最近
reset();
const near = mk(150, 0), far = mk(-300, 0);
g.input.mouse = { active: true, x: p.x - 300, y: p.y, t: g.time };
let a = c.aim(400);
ok(a.target === near, '鼠标指着远处的敌人，出手仍锁最近的');
ok(a.dx > 0.9, '方向朝最近的敌人（不跟鼠标）');
// 2) 已交手的优先
reset();
const idle = mk(100, 0, false), angry = mk(0, 220, true);
ok(c.aim(400).target === angry, '投放距离内优先已交手的敌人');
// 3) 只有未交手的 → 打最近
reset(); const only = mk(0, 180, false);
ok(c.aim(400).target === only, '没有交手的就锁最近的');
// 4) 土遁潜行的不锁
reset(); const hid = mk(80, 0); hid.hideT = 2; const vis = mk(260, 0);
ok(c.aim(400).target === vis, '潜行（土遁）中的敌人不锁');
// 5) 手动锁定 & Tab 轮换
reset(); const e1 = mk(100, 0), e2 = mk(200, 0), e3 = mk(300, 0);
c.lock = e3; c.manual = true;
ok(c.aim(400).target === e3, '点击锁定的敌人优先（即使不是最近）');
c.lock = null; c.manual = false; c.cycleLock(); const t1 = c.lock; c.cycleLock(); const t2 = c.lock; c.cycleLock(); const t3 = c.lock; c.cycleLock();
ok(t1 === e1 && t2 === e2 && t3 === e3 && c.lock === e1, 'Tab 由近到远轮换并循环');
e1.dead = true; c.lock = e1; c.manual = true;
ok(c.aim(400).target === e2 && !c.manual, '锁定目标死亡 → 自动转最近');
// 6) 提前量：横向移动的目标
reset(); const run = mk(400, 0); run.mvx = 0; run.mvy = 200;
a = c.aim(400, 800);
ok(a.y > run.y - 24 + 50, `移动目标留提前量（${Math.round(a.y - (run.y - 24))}px）`);
// 7) 没有敌人 → 朝向
reset(); p.st.yaw = Math.PI / 2;
a = c.aim(400);
ok(!a.target && a.dx > 0.99, '无敌人时沿朝向');
// 8) 实战：施放火弹（bolt）——弹道朝最近的敌人
reset(); const n2 = mk(-160, 0), f2 = mk(320, 0);
g.input.mouse = { active: true, x: f2.x, y: f2.y, t: g.time };
if (!g.hero.arts.some((q: any) => q.id === 'huodan')) g.hero.arts.push({ id: 'huodan', xp: 0 });
g.hero.mp = 1; c.cds.clear(); const before = c.projs.length; c.cast('huodan');
const pr = c.projs[c.projs.length - 1];
ok(c.projs.length > before && pr.vx < 0, '火弹射向最近的敌人（鼠标在另一侧）');
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
