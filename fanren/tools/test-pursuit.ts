// 追杀逻辑测试：不同境界/遁法下能否摆脱
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
g.reset();
let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

function scenario(label: string, o: { realm: number; stage?: number; gap: number; fly: boolean; boost: boolean; flight?: string; conceal?: boolean; skill?: string; secs?: number; dir?: string }) {
  g.combat.reset(); g.pursuit.reset(); g.modal = null; g.modalStack = [];
  const h = g.hero; h.realm = o.realm; h.stage = o.stage ?? 0; h.hp = 1; h.mp = 1; h.dead = false; h.equip = o.flight ? { flight: o.flight } : {};
  g.player.x = 120000; g.player.y = 93000; g.player.flying = o.fly; g.player.sitting = false; g.concealed = !!o.conceal; g.senseBurstT = 0;
  g.input.keys.clear(); g.input.keys.add(o.dir ?? 'd'); if (o.boost) g.input.keys.add('shift');
  for (let i = 0; i < 10; i++) { g.modal = null; g.update(1 / 30); }   // 先跑起来，追杀者从身后出现
  g.pursuit.cd = 0; g.pursuit.start({ reason: 'test', gap: o.gap });
  const P = g.pursuit.cur; const d0 = Math.hypot(P.e.x - g.player.x, P.e.y - g.player.y);
  let minD = 1e9, end = '', t = 0, usedSkill = false;
  const dt = 1 / 30, N = (o.secs ?? 90) * 30;
  for (let i = 0; i < N; i++) {
    g.modal = null;
    if (o.skill && !usedSkill && t > 2) { usedSkill = true; if (!h.arts.some((a: any) => a.id === o.skill)) h.arts.push({ id: o.skill, xp: 0 }); g.combat.cds?.delete?.(o.skill); g.combat.cast(o.skill); }
    g.update(dt); t += dt;
    h.hp = Math.max(h.hp, 0.5); g.combat.invulnT = 5;   // 只测追逃，不测死活
    const c = g.pursuit.cur;
    if (!c) { end = 'escaped'; break; }
    const d = Math.hypot(c.e.x - g.player.x, c.e.y - g.player.y); minD = Math.min(minD, d);
    if (d < 500) { end = 'caught'; break; }
  }
  g.input.keys.clear();
  const res = end || 'ongoing';
  console.log(`  [${label}] ${res} t=${t.toFixed(1)}s d0=${d0.toFixed(0)} minD=${minD.toFixed(0)} mp=${h.mp.toFixed(2)} speed=${g.speed.toFixed(0)}`);
  return res;
}

check('筑基 平飞 vs 结丹：被追上', scenario('zj-plain', { realm: 2, gap: 1, fly: true, boost: false }) === 'caught');
check('筑基 催动遁光 vs 结丹：可摆脱', scenario('zj-boost', { realm: 2, gap: 1, fly: true, boost: true }) === 'escaped');
check('筑基 催动遁光+敛息 vs 结丹：更快摆脱', scenario('zj-boost-conceal', { realm: 2, gap: 1, fly: true, boost: true, conceal: true }) === 'escaped');
check('炼气 步行 vs 筑基：被追上', scenario('lq-walk', { realm: 1, stage: 6, gap: 1, fly: false, boost: false }) === 'caught');
check('炼气 神风舟+遁光 vs 筑基：可摆脱', scenario('lq-boat', { realm: 1, stage: 6, gap: 1, fly: true, boost: true, flight: 'art_shenfeng' }) === 'escaped');
check('结丹 平飞 vs 元婴：被追上', scenario('jd-plain', { realm: 3, gap: 1, fly: true, boost: false }) === 'caught');
check('结丹 风雷翅雷遁 vs 元婴：可摆脱', scenario('jd-thunder', { realm: 3, gap: 1, fly: true, boost: true, flight: 'art_fenglei' }) === 'escaped');
check('筑基 血影遁 vs 结丹：一遁脱身', scenario('zj-xueying', { realm: 2, gap: 1, fly: true, boost: false, skill: 'xueyingdun', secs: 12 }) === 'escaped');
// 站定时施展血影遁：应背离追兵遁出，而不是撞向对方
{
  g.combat.reset(); g.pursuit.reset(); g.modal = null; g.input.keys.clear();
  const h = g.hero; h.realm = 2; h.stage = 0; h.hp = 1; h.mp = 1; g.player.x = 120000; g.player.y = 93000; g.player.flying = false;
  for (let i = 0; i < 5; i++) { g.modal = null; g.update(1 / 30); }
  g.pursuit.cd = 0; g.pursuit.start({ reason: 'test', gap: 1 });
  const e = g.pursuit.cur.e, d0 = Math.hypot(e.x - g.player.x, e.y - g.player.y);
  if (!h.arts.some((a: any) => a.id === 'xueyingdun')) h.arts.push({ id: 'xueyingdun', xp: 0 });
  g.combat.cds?.clear?.(); g.combat.cast('xueyingdun');
  const d1 = Math.hypot(e.x - g.player.x, e.y - g.player.y);
  check('站定施展血影遁：背离追兵遁出', d1 > d0 + 2000, `d0=${d0.toFixed(0)} d1=${d1.toFixed(0)} hp=${h.hp.toFixed(2)}`);
}
// 逃进坊市：对方不敢擅闯
{
  g.combat.reset(); g.pursuit.reset(); g.modal = null;
  const h = g.hero; h.realm = 2; h.stage = 0; h.mp = 1; h.equip = {};
  const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
  const town = LOCATIONS.find((l: any) => l.id === 'tainan')!;
  g.player.x = town.x * WORLD_SCALE; g.player.y = town.y * WORLD_SCALE; g.player.flying = false; g.input.keys.clear();
  g.pursuit.cd = 0; g.pursuit.start({ reason: 'test', gap: 1 });
  let t = 0; for (let i = 0; i < 30 * 25 && g.pursuit.cur; i++) { g.modal = null; g.update(1 / 30); t += 1 / 30; g.hero.hp = 1; }
  check('逃入坊市：对方不敢擅闯，最终离去', !g.pursuit.cur, `t=${t.toFixed(1)} safe=${g.combat.safeAt(g.player.x, g.player.y)}`);
}
// 被追上：成为战斗中的强敌
{
  g.combat.reset(); g.pursuit.reset(); g.modal = null;
  const h = g.hero; h.realm = 2; h.stage = 0; h.mp = 1; g.player.x = 120000; g.player.y = 93000; g.player.flying = false; g.input.keys.clear();
  g.pursuit.cd = 0; g.pursuit.start({ reason: 'test', gap: 1 });
  const tt = g.toast.bind(g); g.toast = (s: string, k?: any) => { console.log('   toast:', s); return tt(s, k); };
  for (let i = 0; i < 30 * 12; i++) { g.modal = null; g.combat.invulnT = 5; g.update(1 / 30); g.hero.hp = 1; }
  const e = g.pursuit.cur?.e;
  check('站着不动：被追上并进入战斗', !!e && g.combat.enemies.includes(e) && e.aggro && g.combat.inCombat, e ? `d=${Math.hypot(e.x - g.player.x, e.y - g.player.y).toFixed(0)}` : '');
  e.hp = 0; for (let i = 0; i < 5; i++) g.update(1 / 30);
  check('击杀追杀者：追杀结束', !g.pursuit.cur);
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
