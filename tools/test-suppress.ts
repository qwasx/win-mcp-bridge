// 第四十一步：境界压制测试：npx tsx tools/test-suppress.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { ENEMY_LIST } = await import('../src/data/enemies');
const { Enemy } = await import('../src/world/combat');
const { cultivator, newTeam } = await import('../src/world/melee');
const { blinkTo } = await import('../src/world/foemind');
const S = await import('../src/world/suppress');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 3; g.hero.stage = 1;
const X0 = l.x * WORLD_SCALE + 1400, Y0 = l.y * WORLD_SCALE + 900;
g.teleport(X0, Y0); g.paused = false;
const c = g.combat, p = g.player, h = g.hero;
let fails = 0;
const ok = (cond: any, msg: string) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const reset = () => { c.enemies.length = 0; c.allies.length = 0; c.projs.length = 0; c.foe.hz.length = 0; g.teleport(X0, Y0); g.concealed = false; };
const run = (sec: number) => { for (let i = 0; i < sec * 30; i++) { g.modal = null; h.hp = Math.max(h.hp, 1); h.dead = false; c.invulnT = 99; g.update(1 / 30); } };
const R = g.senseRadius;
console.log(`  结丹中期神识半径 ${Math.round(R)}`);
const def = ENEMY_LIST.find((d: any) => d.kind === 'beast' && d.melee && !d.ranged && !d.flying && !d.behave && (d.lv?.[0] ?? 1) <= 3)!;
console.log(`  测试妖兽：${def.name}`);
/** 放一只妖兽在 dist 处追你，返回 n 秒走了多远 */
const moved = (realm: number, dist: number, sec = 2.5, pre?: () => void) => {
  reset(); pre?.();
  const e = new Enemy(def, p.x + dist, p.y, realm, realm === 1 ? 6 : 1); e.aggro = true; e.hx = e.x; e.hy = e.y; e.speed = 160; c.enemies.push(e);
  run(0.4); const x0 = e.x, y0 = e.y; run(sec);
  return { d: Math.hypot(e.x - x0, e.y - y0), e };
};
const base = moved(3, R * 0.6);
const slow = moved(2, R * 0.6);
const pin = moved(1, R * 0.6);
console.log(`  同境 ${Math.round(base.d)} · 差一境 ${Math.round(slow.d)}（sup=${slow.e.sup}）· 差两境 ${Math.round(pin.d)}（sup=${pin.e.sup}）`);
ok(base.e.sup === 0 && base.d > 200, '同境界不受压制');
ok(slow.e.sup === 1 && slow.d < base.d * 0.45 && slow.d > base.d * 0.1, '差一个大境界：举步维艰（约 0.28 倍速）');
ok(pin.e.sup === 2 && pin.d < 8, '差两个大境界：被压在原地');
const far = moved(1, R * 1.35, 0.6);
ok(far.e.sup === 0, '神识之外不受压制');
const con = moved(1, R * 0.4, 1.5, () => { g.concealed = true; });
ok(con.e.sup === 0 && con.d > 80, '敛息时不外放威压');
// 镇压时遁术无效
reset();
const m = cultivator(p.x + 300, p.y, 1, 6, 'sanxiu', '炼气散修'); m.aggro = true; c.enemies.push(m); run(0.3);
const bx = m.x; blinkTo(c, m, m.x + 400, m.y, 'thunder');
ok(m.sup === 2 && m.x === bx, '被镇压的修士遁术施展不开');
// NPC 之间：元婴压筑基（离你很远）
reset(); h.realm = 2;
const ta = newTeam('t'), tb = newTeam('t');
const big = cultivator(p.x + 700, p.y, 4, 0, 'taiyi', '元婴长老'); big.team = ta; big.hx = big.x; big.hy = big.y;
const small = cultivator(p.x + 1200, p.y, 2, 1, 'tianmo', '筑基魔修'); small.team = tb; small.hx = small.x; small.hy = small.y;
const mate = cultivator(p.x + 1150, p.y + 60, 2, 1, 'taiyi', '筑基同门'); mate.team = ta; mate.hx = mate.x; mate.hy = mate.y;
c.enemies.push(big, small, mate); run(0.4);
ok(small.sup === 2 && !small.supP, '混战里元婴压制敌对一方的筑基（来自他人，紫色）');
ok(mate.sup === 0, '不压自己人');
h.realm = 3;
// 同伴不受你压制
reset();
const al = cultivator(p.x + 200, p.y, 1, 6, 'huangfeng', '同门'); c.addAlly?.(al) ?? (al.ally = true, c.enemies.push(al)); run(0.4);
ok(al.sup === 0, '同伴不受你的威压');
// 闲人：劫道的散修被压住；平常闲人不压；神识外放时全压
reset();
const npcs = g.npcs;
const act = [...npcs.active.values()][0];
if (act) {
  const d = act.d; d.realm = 1; d.stage = 5;
  act.st.x = p.x + 300; act.st.y = p.y; d.x = act.st.x; d.y = act.st.y; act.enemy = undefined; d.bond = undefined; d.helpUntil = undefined;
  act.act = 'idle'; act.wait = 99;
  ok(npcs.supOf(act) === 0, '平常闲人不受压');
  act.act = 'approach';
  ok(npcs.supOf(act) === 2, '劫道的炼气散修被结丹威压镇住');
  act.act = 'idle'; g.senseBurstT = 5;
  ok(npcs.supOf(act) === 2, '神识外放时威压全开');
  g.senseBurstT = 0;
} else console.log('  （附近没有活跃闲人，跳过）');
// 绘制
const cv: any = createCanvas(400, 400), ctx = cv.getContext('2d');
let err = 0;
try { for (const lv of [1, 2]) for (const on of [0, 0.1, 1]) { const v = { lv, on, col: S.SUP_COL_P, seed: 7 }; S.drawSupUnder(ctx, 200, 300, v, 1.3); ctx.save(); S.supSquash(ctx, 200, 300, v, 1.3); ctx.restore(); S.drawSupOver(ctx, 200, 300, v, 1.3); } } catch (e) { err++; console.log(e); }
ok(!err, '特效绘制无异常');
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
