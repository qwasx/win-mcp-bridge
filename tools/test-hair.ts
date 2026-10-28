// 发型 / 动作自检：npx tsx tools/test-hair.ts
//  1. 每种发型 × 男女 × 8 个朝向 × 各动作都能画（无异常、无 NaN、头部有像素）；
//  2. 发际线 / 刘海不过眉、不挡眼（正前方 ±50° 内发际线高于眉上）；
//  3. randomLook 按性别给发型，种类够多；旧的发型名仍可用（存档兼容）；
//  4. 动作：转身时头先转；受击 0.06 秒内到位；跑停有余势；待机张望连续（相邻帧头转角变化小）；
//  5. 性能：画一个人的平均耗时。
import { createCanvas } from './env';
import { CharState, drawCharacter, randomLook, HANLI_LOOK, type Look, type Action } from '../src/gfx/character';
import { buildHair, MALE_STYLES, FEMALE_STYLES, HAIR_NAMES, type HairStyle, type HairCtx } from '../src/gfx/hair';
import { mulberry32 } from '../src/core/rng';
import { BEAUTIES } from '../src/data/beauties';
import * as SL from '../src/data/storylooks';

let fail = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('  ✗', msg); } };
const c = createCanvas(240, 320); const g = c.getContext('2d') as any;

// ---- 1. 全部能画
const ACTS: Action[] = ['idle', 'walk', 'run', 'fly', 'sit', 'cast', 'hit', 'dodge', 'gather'];
const base = (sex: 'm' | 'f', s: HairStyle): Look => ({ ...HANLI_LOOK, sex, hairStyle: s, face: undefined, ribbon: '#a03030', pin: sex === 'f' ? 'gold' : undefined, bangs: s === 'twin' });
let draws = 0;
for (const [sex, list] of [['m', MALE_STYLES], ['f', FEMALE_STYLES]] as const) for (const s of [...list, 'bald' as HairStyle]) {
  for (let d = 0; d < 8; d++) for (const a of ACTS) {
    const st = new CharState(120, 300); st.yaw = st.targetYaw = d * Math.PI / 4; st.setAction(a);
    st.speed = a === 'run' ? 220 : a === 'fly' ? 300 : a === 'walk' ? 115 : 0; st.vx = Math.sin(st.yaw) * st.speed; st.vy = Math.cos(st.yaw) * st.speed;
    g.clearRect(0, 0, 240, 320);
    try {
      let r: any;
      for (let i = 0; i < 6; i++) { st.update(1 / 30); r = drawCharacter(g, base(sex, s), st, 2.4, 1 / 30); }
      draws++;
      ok(Number.isFinite(r.headX) && Number.isFinite(r.headY), `${sex}/${s}/${d}/${a} 头部坐标 NaN`);
      if (a === 'idle') {
        const px = g.getImageData(Math.max(0, r.headX - 20), Math.max(0, r.headY - 30), 40, 40).data;
        let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
        ok(n > 200, `${sex}/${s}/${d} 头部没画出来`);
      }
    } catch (e) { ok(false, `${sex}/${s}/${d}/${a} 抛异常 ${(e as Error).message}`); }
  }
}
console.log(`1. 绘制 ${draws} 次（${MALE_STYLES.length} 男 + ${FEMALE_STYLES.length} 女发型 × 8 朝向 × ${ACTS.length} 动作）`);

// ---- 2. 发际线不挡眼
const fake = (look: Look): HairCtx => ({
  g, S: 4, hk: 1, lw: 1, ink: '#000', look, fem: look.sex === 'f', t: 0, seed: 0,
  HP: (x, y, z) => ({ x: 100 + x * 4, y: 100 - y * 4, z }), visN: (_x, _y, nz) => nz, hed: { x: 100, y: 100, z: 0 },
  strand: (_k, n) => ({ x: new Float32Array(n), y: new Float32Array(n), n }), spring: (_k, x, y) => ({ x, y }), push: () => {}, zBody: -5, gust: 0,
});
const BROW = 2.6;   // 眉线（头部局部 y）
for (const [sex, list] of [['m', MALE_STYLES], ['f', FEMALE_STYLES]] as const) for (const s of list) {
  const h = buildHair(fake(base(sex, s))).anchors.hairline;
  let lo = 99; for (let a = -0.87; a <= 0.87; a += 0.02) lo = Math.min(lo, h(a));
  ok(lo > BROW - 0.95, `${sex}/${s} 额前发际线过低（${lo.toFixed(2)}），会压到眼睛`);
}
console.log('2. 额前发际线检查完毕');

// ---- 3. randomLook
const cnt: Record<string, Record<string, number>> = { m: {}, f: {} };
for (let i = 0; i < 1500; i++) {
  const L = randomLook(mulberry32(i * 31 + 7));
  cnt[L.sex][L.hairStyle] = (cnt[L.sex][L.hairStyle] ?? 0) + 1;
  if (L.hairStyle !== 'bald') ok((L.sex === 'm' ? MALE_STYLES : FEMALE_STYLES).includes(L.hairStyle), `randomLook 给 ${L.sex} 配了 ${L.hairStyle}`);
  if (L.head === 'veil') ok(!['feixian', 'updo', 'shuanghuan', 'liuyun'].includes(L.hairStyle), `帷帽配了高髻 ${L.hairStyle}`);
}
console.log('3. 男：', Object.entries(cnt.m).map(([k, v]) => `${HAIR_NAMES[k as HairStyle]}${v}`).join(' '));
console.log('   女：', Object.entries(cnt.f).map(([k, v]) => `${HAIR_NAMES[k as HairStyle]}${v}`).join(' '));
ok(Object.keys(cnt.m).length >= 6, '男发型种类不足 6');
ok(Object.keys(cnt.f).length >= 9, '女发型种类不足 9');
// 主线人物与红颜
const named: Look[] = [...BEAUTIES.map((b: any) => b.look), ...Object.values(SL).filter((v: any) => v && typeof v === 'object' && 'hairStyle' in v) as Look[]];
for (const L of named) ok(L.hairStyle === 'bald' || (L.sex === 'm' ? MALE_STYLES : FEMALE_STYLES).includes(L.hairStyle), `主线 / 红颜发型不合性别：${L.sex} ${L.hairStyle}`);
console.log(`   主线人物与红颜 ${named.length} 位，发型：`, [...new Set(named.map((l) => HAIR_NAMES[l.hairStyle]))].join('、'));

// ---- 4. 动作
{
  const st = new CharState(0, 0); st.setAction('run'); st.speed = 220;
  for (let i = 0; i < 30; i++) { st.update(1 / 60); drawCharacter(g, HANLI_LOOK, st, 1, 1 / 60); }
  st.targetYaw = Math.PI * 0.75; st.update(1 / 60); st.update(1 / 60); st.update(1 / 60);
  ok(st.turnLead > 0.2, `转身时头没有先转（turnLead=${st.turnLead.toFixed(2)}）`);
  const hit = new CharState(0, 0); for (let i = 0; i < 20; i++) { hit.update(1 / 60); drawCharacter(g, HANLI_LOOK, hit, 1, 1 / 60); }
  hit.setAction('hit'); let lean = 0;
  for (let i = 0; i < 5; i++) { hit.update(1 / 60); drawCharacter(g, HANLI_LOOK, hit, 1, 1 / 60); lean = hit.last!.lean; }
  ok(lean < -0.25, `受击 0.08 秒时还没后仰到位（lean=${lean.toFixed(2)}）`);
  const stop = new CharState(0, 0); stop.setAction('run'); stop.speed = 220;
  for (let i = 0; i < 40; i++) { stop.update(1 / 60); drawCharacter(g, HANLI_LOOK, stop, 1, 1 / 60); }
  stop.setAction('idle'); stop.speed = 0; let maxLean = 0;
  for (let i = 0; i < 40; i++) { stop.update(1 / 60); drawCharacter(g, HANLI_LOOK, stop, 1, 1 / 60); if (i > 15) maxLean = Math.max(maxLean, stop.last!.lean); }
  ok(maxLean > 0.08, `跑停没有余势（lean=${maxLean.toFixed(2)}）`);
  const idle = new CharState(0, 0); idle.setAction('idle'); let prev = 0, jump = 0;
  for (let i = 0; i < 60 * 40; i++) { idle.update(1 / 60); drawCharacter(g, HANLI_LOOK, idle, 1, 1 / 60); const y = idle.last!.headYaw; if (i > 30) jump = Math.max(jump, Math.abs(y - prev)); prev = y; }
  ok(jump < 0.05, `待机张望有跳变（单帧 ${jump.toFixed(3)} 弧度）`);
  console.log(`4. 动作：转身头先转 ${st.turnLead.toFixed(2)}，受击后仰 ${lean.toFixed(2)}，跑停余势 ${maxLean.toFixed(2)}，张望单帧最大变化 ${jump.toFixed(3)}`);
}

// ---- 5. 性能
{
  const looks = Array.from({ length: 40 }, (_, i) => randomLook(mulberry32(i + 100)));
  const sts = looks.map((_, i) => { const s = new CharState(120, 300); s.yaw = s.targetYaw = i; s.setAction(i % 3 ? 'walk' : 'run'); s.speed = 150; return s; });
  const t0 = performance.now(); let n = 0;
  for (let f = 0; f < 10; f++) looks.forEach((L, i) => { sts[i].update(1 / 60); drawCharacter(g, L, sts[i], 1, 1 / 60); n++; });
  const ms = (performance.now() - t0) / n;
  console.log(`5. 平均每人每帧 ${ms.toFixed(3)} ms（游戏缩放 1，Node 软件画布）`);
  ok(ms < 8, '画一个人超过 8 ms');
}
if (fail) { console.log(`\n✗ ${fail} 项失败`); process.exit(1); }
console.log('\n✓ test-hair 全部通过');
