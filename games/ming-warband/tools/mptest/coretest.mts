// 无渲染战斗核心：正确性与性能
import { BattleCore, TICK } from '../../src/battle/core.ts';
import { readFrame } from '../../src/battle/wire.ts';
import { Ter } from '../../src/core/terrain.ts';
let pass = 0, fail = 0;
const check = (n: string, c: boolean, x = '') => { if (c) pass++; else fail++; console.log(`${c ? '✔' : '✘'} ${n}${x ? ' — ' + x : ''}`); };
const hero = (name: string) => ({ name, maxHp: 120, hp: 120, atk: 30, def: 12, skill: 14, speed: 160, mounted: true, reach: 30, antiCav: false, rng: 18, range: 260, reload: 1.4, ammo: 20, kind: 'bow' as const, meleeSpeed: 0.8, look: { w: 'sabre', wr: 'bow', a: 2, c: 0xd04030 } });

function run(nA: number, nB: number, cap: number, humans = true, maxT = 300) {
  const core = new BattleCore({ terrain: Ter.Plain, seed: 1234, night: false, cap }, nA + nB);
  const parts: any[] = [
    { pid: '1', side: 0, name: '甲', faction: 'ming', stacks: [{ id: 'ming_spear', n: Math.floor(nA * 0.4), w: 0, xp: 0 }, { id: 'ming_musket', n: Math.floor(nA * 0.3), w: 0, xp: 0 }, { id: 'ming_guanning', n: Math.ceil(nA * 0.3), w: 0, xp: 0 }], ...(humans ? { acct: 'A', online: true, hero: hero('甲'), comps: [] } : {}) },
    { pid: '2', side: 1, name: '乙', faction: 'jin', stacks: [{ id: 'jin_horse', n: Math.floor(nB * 0.5), w: 0, xp: 0 }, { id: 'jin_recruit', n: Math.ceil(nB * 0.5), w: 0, xp: 0 }], ...(humans ? { acct: 'B', online: true, hero: hero('乙'), comps: [] } : {}) },
    { pid: '3', side: 1, name: '丙', faction: 'jin', stacks: [{ id: 'jin_bayara', n: 20, w: 0, xp: 0 }] },
  ];
  core.start(parts);
  if (humans) for (const a of ['A', 'B']) core.order(a, ['inf', 'rng', 'cav'], 'charge');
  let maxMs = 0, tot = 0, steps = 0, bytes = 0, frames = 0, decodedUnits = 0, evs = 0;
  const t0 = performance.now();
  while (!core.finished && core.elapsed < maxT) {
    const a = performance.now();
    // 模拟真人：主角朝敌人冲，偶尔挥砍/射击
    for (const c of core.cmds.values()) {
      const h = c.hero!; if (h.dead) continue;
      const e = core.nearestEnemy(h, 3000);
      if (!e) continue;
      const ang = Math.atan2(e.y - h.y, e.x - h.x), d = Math.hypot(e.x - h.x, e.y - h.y);
      const st = Math.min(d - 20, h.speed * TICK);
      const inp = c.inp ?? { x: h.x, y: h.y, face: 0, mode: 0, atk: 0, atkA: 0, fire: 0, fireA: 0, fireD: 0, cs: 0 };
      core.input(c.acct, { ...inp, x: h.x + Math.cos(ang) * Math.max(0, st), y: h.y + Math.sin(ang) * Math.max(0, st), face: ang, atk: d < 40 ? inp.atk + 1 : inp.atk, atkA: ang, cs: c.corrSeq });
    }
    core.step(TICK);
    core.endTick();
    for (const c of core.cmds.values()) { const f = core.frameFor(c); if (f) { bytes += f.length; frames++; const fr = readFrame(f); decodedUnits += fr!.units.length; evs += fr!.evs.length; } }
    const ms = performance.now() - a; tot += ms; steps++; if (ms > maxMs && steps > 40) maxMs = ms;
  }
  return { core, evs, avg: tot / steps, maxMs, steps, bytes, frames, decodedUnits, wall: performance.now() - t0 };
}

{
  const r = run(60, 50, 600);
  const res = r.core.result;
  check('小规模战斗正常结束', !!res && r.core.finished, `winner ${res?.winner} ${r.core.elapsed.toFixed(0)}s`);
  const downs = Object.values(r.core.downPid).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0);
  check('有伤亡记录', downs > 20, `downs ${downs}`);
  check('两名玩家都有结算', (res?.cmds.length ?? 0) === 2);
  check('杀伤按部队统计', Object.keys(res?.killsBy ?? {}).length >= 2, JSON.stringify(res?.killsBy));
  check('帧里带有射击/命中事件', r.evs > 50, `${r.evs} 个事件`);
  check('帧可解码', r.decodedUnits > 0, `${r.frames} frames, avg ${(r.bytes / r.frames).toFixed(0)} B`);
}
{
  const r = run(500, 500, 1000, true, 40);
  const perPlayerKBs = r.bytes / 2 / (r.steps * TICK) / 1024;
  console.log(`1000 人：tick 平均 ${r.avg.toFixed(2)} ms，最大 ${r.maxMs.toFixed(1)} ms；每人下行 ${perPlayerKBs.toFixed(1)} KB/s（未压缩）`);
  check('1000 人 tick 平均 < 12 ms', r.avg < 12, r.avg.toFixed(2));
  check('每人下行 < 60 KB/s（未压缩）', perPlayerKBs < 60, perPlayerKBs.toFixed(1));
}
{
  // 撤退与加入
  const core = new BattleCore({ terrain: Ter.Hills, seed: 7, night: true, cap: 300 }, 200);
  core.start([
    { pid: '1', side: 0, name: '甲', faction: 'ming', stacks: [{ id: 'ming_recruit', n: 80, w: 0, xp: 0 }], acct: 'A', online: true, hero: hero('甲'), comps: [] },
    { pid: '2', side: 1, name: '乙', faction: 'bandit', stacks: [{ id: 'ming_recruit', n: 120, w: 0, xp: 0 }], bandit: true },
  ] as any);
  for (let i = 0; i < 100; i++) { core.step(); core.endTick(); }
  const ok = core.join({ pid: '9', side: 0, name: '援', faction: 'ming', stacks: [{ id: 'ming_guanning', n: 40, w: 0, xp: 0 }], acct: 'C', online: true, hero: hero('援'), comps: [] } as any);
  const sp = core.endTick();
  check('中途加入成功并产生新单位', ok && sp.spawned.length >= 40, `spawned ${sp.spawned.length}`);
  check('加入者有自己的编队', !!core.cmds.get('C')?.sq.inf && core.cmds.get('C')!.hero !== null);
  for (let i = 0; i < 40; i++) { core.step(); core.endTick(); }
  const r = core.retreat('A');
  check('撤退返回结算', !!r && r.retreat);
  check('撤退后所部离场', core.units.filter(u => u.cmd?.acct === 'A' && !u.dead && !u.fled).length === 0);
  core.setOnline('C', false);
  check('断线后编队由 AI 接管', core.cmds.get('C')!.sq.inf.ai);
  let n = 0; while (!core.finished && n++ < 20 * 600) { core.step(); core.endTick(); }
  check('战斗最终结束', core.finished, `winner ${core.result?.winner}`);
}
{
  // 金身：玩家所部无伤亡
  const core = new BattleCore({ terrain: Ter.Plain, seed: 3, night: false, cap: 400 }, 200);
  core.start([
    { pid: '1', side: 0, name: '神', faction: 'ming', stacks: [{ id: 'ming_recruit', n: 20, w: 0, xp: 0 }], acct: 'G', online: true, hero: hero('神'), comps: [], god: { buff: true, inv: true, oneHit: false, speed: 1.6, aura: false } },
    { pid: '2', side: 1, name: '敌', faction: 'jin', stacks: [{ id: 'jin_bayara', n: 150, w: 0, xp: 0 }] },
  ] as any);
  let n = 0; while (!core.finished && n++ < 20 * 400) { core.step(); core.endTick(); }
  check('金身：零伤亡且获胜', core.result?.winner === 0 && !core.result.downPid['1'], JSON.stringify(core.result?.downPid['1'] ?? {}));
}
{
  // 限速校验：瞬移被拒绝并下发纠正
  const core = new BattleCore({ terrain: Ter.Plain, seed: 5, night: false, cap: 200 }, 40);
  core.start([
    { pid: '1', side: 0, name: '甲', faction: 'ming', stacks: [{ id: 'ming_recruit', n: 10, w: 0, xp: 0 }], acct: 'A', online: true, hero: hero('甲'), comps: [] },
    { pid: '2', side: 1, name: '乙', faction: 'jin', stacks: [{ id: 'jin_recruit', n: 10, w: 0, xp: 0 }] },
  ] as any);
  const h = core.cmds.get('A')!.hero!; const x0 = h.x;
  core.input('A', { x: h.x + 800, y: h.y, face: 0, mode: 0, atk: 0, atkA: 0, fire: 0, fireA: 0, fireD: 0, cs: 0 });
  core.step(); const sp = core.endTick();
  check('瞬移被限速', h.x - x0 < 60, `moved ${(h.x - x0).toFixed(1)}`);
  check('下发位置纠正', sp.out.some(o => o.m.t === 'bcorr'));
}
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
