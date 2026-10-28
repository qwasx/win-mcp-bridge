// 第 6 阶段：特效库自检
//  1. 配方表：每门有配方的法术 id 存在、配方存在；攻击类法术外观不撞车（同配方必须换色板）
//  2. 宗门色系：schools.ts 的每个门派都有色系；NPC 弹道带 sect 时按本门色板 / 招牌配方解析
//  3. 真施法：逐门法术走 Combat.cast，新生的弹道 / 光效 / 区域都被打上法术 id，配方绘制不抛错
//  4. 大场面：各种 bigfx 能演出、同时数量受限；负载高时自动减量
//  5. 粗测耗时：40 发带配方的弹道同时在飞，每帧特效库 CPU 耗时
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { ENEMIES } = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const { ARTS } = await import('../src/data/arts');
const { ART_VFX, FX_RECIPE } = await import('../src/data/vfxstyles');
const { SECT_FX } = await import('../src/data/sectfx');
const { SCHOOLS } = await import('../src/world/schools');
const L = await import('../src/gl/vfxlib');
const BIG = await import('../src/gl/bigfx');
const { bigfx, BIGFX_Q } = await import('../src/world/vfxhook');

let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.log('  ✗', msg); } };

// —— 假的 FxSys：记录调用次数，所有图元都是空操作
const calls: Record<string, number> = {};
let np = 0;
const F: any = new Proxy({}, {
  get(_t, k: string) {
    if (k === 'count') return np;
    if (k === 'B') return { strip() { calls.strip = (calls.strip ?? 0) + 1; }, quad() {}, quadS() {} };
    if (k === 'emit') return () => { np++; calls.emit = (calls.emit ?? 0) + 1; };
    if (k === 'then') return undefined;
    return (...a: any[]) => { calls[k] = (calls[k] ?? 0) + 1; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) { calls.nan = (calls.nan ?? 0) + 1; } };
  },
});

// ———————————————— 1. 配方表
console.log('1. 配方表');
const attackCasts = new Set(['bolt', 'fan', 'nova', 'burst', 'cone', 'beam', 'strike', 'chain', 'field']);
for (const [id, v] of Object.entries(ART_VFX)) {
  ok(!!(ARTS as any)[id], `配方表里的法术 ${id} 不存在`);
  ok(L.hasRecipe(v.r), `${id} 的配方 ${v.r} 不存在`);
}
const sig = new Map<string, string[]>();
let nAtk = 0, nStyled = 0;
for (const s of Object.values(ARTS) as any[]) {
  if (!attackCasts.has(s.cast) || s.power <= 0) continue;
  nAtk++;
  const v = ART_VFX[s.id]; if (!v) continue;
  nStyled++;
  const k = `${v.r}|${(v.pal ?? [s.color]).join('/')}|${v.s ?? 1}`;
  sig.set(k, [...(sig.get(k) ?? []), s.name]);
}
const dup = [...sig.values()].filter((a) => a.length > 1);
ok(dup.length === 0, `外观撞车：${dup.map((a) => a.join('=')).join('；')}`);
const recipesUsed = new Set(Object.values(ART_VFX).map((v) => v.r));
console.log(`  攻击类法术 ${nAtk} 门，其中 ${nStyled} 门有专属配方；共用到 ${recipesUsed.size} 种配方；特效库共 ${L.recipeNames().length} 种配方`);
ok(nStyled / nAtk > 0.85, '攻击类法术有专属配方的比例应超过 85%');

// ———————————————— 2. 宗门色系
console.log('2. 宗门色系');
for (const sid of Object.keys(SCHOOLS)) ok(!!SECT_FX[sid], `门派 ${sid}（${(SCHOOLS as any)[sid].name}）没有色系`);
const mains = new Map<string, string>();
for (const [sid, s] of Object.entries(SECT_FX)) { ok(!mains.has(s.pal[1]), `色系主色重复：${sid} 与 ${mains.get(s.pal[1])}`); mains.set(s.pal[1], sid); }
for (const [sid, S] of Object.entries(SECT_FX)) for (const fx of Object.keys(FX_RECIPE)) {
  const o: any = { fac: 'e', fx, color: '200,200,200', sect: sid, x: 0, y: 0, vx: 500, vy: 0 };
  const st = L.styleOf(o);
  ok(!!st && st.sect === sid, `${sid}/${fx} 未解析出宗门样式`);
  if (st) { const P = L.palOf(S.pal); ok(st.P.b[0] === P.b[0] && st.P.b[1] === P.b[1], `${sid}/${fx} 没用本门色板`); }
}
const sg = (sid: string, fx: string) => L.styleOf({ fx, sect: sid, color: '1,1,1', vx: 1 })!.r;
ok(sg('yanyue', 'icicle') === 'moonFrost', '掩月宗冰招应为月华寒霜');
ok(sg('guiling', 'ghost') === 'ghostFire', '鬼灵门阴招应为鬼火');
ok(sg('xinggong', 'goldthunder') === 'starShot', '星宫金招应为星芒');
ok(sg('hehuan', 'vine') === 'petalMist', '合欢宗毒招应为粉雾花瓣');
ok(sg('huangfeng', 'sword') === 'flyingSword', '黄枫谷剑招应为飞剑');
console.log(`  ${Object.keys(SECT_FX).length} 个门派色系，${Object.keys(SCHOOLS).length} 个门派全覆盖`);

// ———————————————— 3. 真施法
console.log('3. 真施法打标 + 配方绘制');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const loc = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 5; g.hero.stage = 1;
g.debugGive('art_qingzhu'); g.debugGive('mat_jinleizhu');
g.teleport(loc.x * WORLD_SCALE + 900, loc.y * WORLD_SCALE + 600);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
const spawn = () => ['wolf', 'wolf', 'boar'].forEach((id, i) => { const e = new Enemy(ENEMIES[id], g.player.x + 320 + i * 40, g.player.y + (i - 1) * 80, 4, 3); e.aggro = true; e.skT = 99; e.hp = e.maxHp = 1e9; g.combat.enemies.push(e); });
let tagged = 0, drawn = 0, untagged: string[] = [];
const t0 = Date.now();
for (const id of Object.keys(ART_VFX)) {
  const c: any = g.combat;
  c.enemies = []; c.projs = []; c.vfx = []; c.fields = []; c.strikes = []; c.acts.list = []; spawn();
  for (const k in calls) delete calls[k];
  g.debugCast(id);
  let seen = false;
  for (let i = 0; i < 90; i++) {
    g.hero.hp = 1; g.hero.mp = 1; g.update(1 / 30);
    const all = [...c.projs, ...c.vfx, ...c.fields, ...c.strikes];
    if (all.some((o: any) => o.skill === id)) seen = true;
    for (const pr of c.projs) { const tr = pr.trail ?? []; L.vfxProj(F, pr, i / 30, 1 / 30, tr.length ? [...tr, [pr.x, pr.y]] : [[pr.x - 1, pr.y], [pr.x, pr.y]]); }
    L.vfxProjEnd(F, c.projs);
    for (const v of c.vfx) { L.vfxDraw(F, v, i / 30, 1 / 30); if (!v._s6) { v._s6 = 1; L.vfxSpawn(F, v); } }
    for (const f of c.fields) L.vfxField(F, f, i / 30, 1 / 30, 1);
    BIG.drawBigFx(F, i / 30, 1 / 30);
    L.vfxFrame(F, 1 / 30); np = Math.max(0, np - 40);
  }
  const n = Object.values(calls).reduce((a, b) => a + b, 0);
  if (seen) tagged++; else untagged.push(id);
  if (n > 0) drawn++;
  ok(!calls.nan, `${id} 绘制时出现 NaN 参数 ${calls.nan}`);
}
console.log(`  ${Object.keys(ART_VFX).length} 门：${tagged} 门打标成功，${drawn} 门有配方绘制调用；耗时 ${Date.now() - t0}ms`);
// 法相 / 大庚剑阵靠 bigfx 演出，不在列表里也算
ok(untagged.filter((id) => !['faxiang', 'mingwang'].includes(id)).length === 0, `未打标：${untagged.join(',')}`);
ok(drawn >= Object.keys(ART_VFX).length - 2, '有配方的法术都应走到配方绘制');

// ———————————————— 4. 大场面
console.log('4. 大场面');
BIG.clearBigFx();
for (const k of ['tribulation', 'vortex', 'pillar', 'inkshock', 'dharma', 'swordArray', 'lotus', 'heavenSeal'] as const) {
  for (const kk in calls) delete calls[kk];
  bigfx(k, { x: 1000, y: 1000, dur: 1.5 });
  for (let i = 0; i < 60; i++) BIG.drawBigFx(F, i / 30, 1 / 30);
  const n = Object.values(calls).reduce((a, b) => a + b, 0);
  ok(n > 8, `大场面 ${k} 没有绘制`); ok(!calls.nan, `大场面 ${k} 出现 NaN`);
}
BIG.clearBigFx();
for (let i = 0; i < 10; i++) bigfx('tribulation', { x: i * 100, y: 0 });
for (let i = 0; i < 6; i++) bigfx('pillar', { x: i * 100, y: 0 });
BIG.drawBigFx(F, 0, 1 / 60);
ok(BIG.bigfxCount() <= 5, `大场面并发应 ≤5，实为 ${BIG.bigfxCount()}`);
ok(BIGFX_Q.length === 0, '请求队列应被取空');
BIG.clearBigFx();
for (let i = 0; i < 40; i++) bigfx('dharma', { x: 0, y: 0 });
ok(BIGFX_Q.length <= 16, '请求队列积压上限 16');
BIG.clearBigFx();
let alive = true; bigfx('dharma', { x: 0, y: 0, follow: () => (alive ? { x: 5, y: 5 } : null) });
BIG.drawBigFx(F, 0, 0.1); ok(BIG.bigfxCount() === 1, '法相应在演出'); alive = false;
for (let i = 0; i < 10; i++) BIG.drawBigFx(F, 0, 0.1);
ok(BIG.bigfxCount() === 0, '跟随目标消失后法相应淡出结束');

// ———————————————— 5. 耗时与限流
console.log('5. 耗时与限流');
const projs: any[] = [];
const ids = Object.entries(ART_VFX).filter(([id]) => ['bolt', 'fan'].includes((ARTS as any)[id]?.cast)).map(([id]) => id);
for (let i = 0; i < 40; i++) projs.push({ fac: 'p', skill: ids[i % ids.length], fx: (ARTS as any)[ids[i % ids.length]].fx, color: '255,200,100', x: i * 30, y: 0, vx: 600, vy: 50, life: 0.2, max: 1, size: 1, trail: Array.from({ length: 10 }, (_, k) => [i * 30 - k * 10, 0]) });
np = 0;
const T = performance.now();
for (let f = 0; f < 120; f++) { L.vfxFrame(F, 1 / 60); for (const pr of projs) { pr.x += 10; L.vfxProj(F, pr, f / 60, 1 / 60, [...pr.trail, [pr.x, pr.y]]); } L.vfxProjEnd(F, projs); np = 0; }
const per = (performance.now() - T) / 120;
console.log(`  40 发配方弹道：每帧 ${per.toFixed(3)}ms（CPU，不含 GPU），烘焙粒子 ${L.bpCount()}/480`);
ok(per < 3, '40 发弹道每帧特效库耗时应 < 3ms');
np = 5800; L.vfxFrame(F, 1 / 60); ok(L.vfxPressure() < 0.5, '粒子接近上限时应自动减量'); np = 0; L.vfxFrame(F, 1 / 60);

console.log(fails ? `\n✗ ${fails} 项未通过` : '\n✓ 特效库自检全部通过');
process.exit(fails ? 1 : 0);
