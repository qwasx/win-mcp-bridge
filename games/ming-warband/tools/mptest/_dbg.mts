import { BattleCore, TICK } from '../../src/battle/core.ts';
import { Ter } from '../../src/core/terrain.ts';
const hero = (name: string) => ({ name, maxHp: 120, hp: 120, atk: 30, def: 12, skill: 14, speed: 160, mounted: true, reach: 30, antiCav: false, rng: 18, range: 260, reload: 1.4, ammo: 20, kind: 'bow' as const, meleeSpeed: 0.8, look: { w: 'sabre', wr: 'bow', a: 2, c: 0xd04030 } });
const core = new BattleCore({ terrain: Ter.Plain, seed: 1234, night: false, cap: 600 }, 110);
core.start([
 { pid: '1', side: 0, name: '甲', faction: 'ming', stacks: [{ id: 'ming_spear', n: 30, w: 0, xp: 0 }], acct: 'A', online: true, hero: hero('甲'), comps: [] },
 { pid: '2', side: 1, name: '乙', faction: 'jin', stacks: [{ id: 'jin_horse', n: 20, w: 0, xp: 0 }], acct: 'B', online: true, hero: hero('乙'), comps: [] },
 { pid: '3', side: 1, name: '丙', faction: 'jin', stacks: [{ id: 'jin_bayara', n: 20, w: 0, xp: 0 }] },
] as any);
for (let i = 0; i < 1200 && !core.finished; i++) {
  for (const c of core.cmds.values()) {
    const h = c.hero!; if (h.dead) continue;
    const e = core.nearestEnemy(h, 3000);
    if (!e) continue;
    const ang = Math.atan2(e.y - h.y, e.x - h.x), d = Math.hypot(e.x - h.x, e.y - h.y);
    const st = Math.min(d - 20, h.speed * TICK);
    const inp = c.inp ?? { x: h.x, y: h.y, face: 0, mode: 0, atk: 0, atkA: 0, fire: 0, fireA: 0, fireD: 0, cs: 0 };
    core.input(c.acct, { ...inp, x: h.x + Math.cos(ang) * Math.max(0, st), y: h.y + Math.sin(ang) * Math.max(0, st), face: ang, atk: d < 40 ? inp.atk + 1 : inp.atk, atkA: ang, cs: c.corrSeq });
  }
  core.step(); const o = core.endTick();
  if (i % 100 == 0) console.log(i, [...core.cmds.values()].map(c=>[c.hero!.x.toFixed(0), c.hero!.y.toFixed(0), c.hero!.hp.toFixed(0), c.budget.toFixed(1)]), o.out.map(x=>x.m.t).join(','), core.activeCount(0), core.activeCount(1));
}
console.log(core.finished, core.result?.winner, core.elapsed);
