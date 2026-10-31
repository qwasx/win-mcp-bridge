// 投放距离测试：神识 80% / 外放后 70%
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { ENEMIES } = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset();
let fails = 0;
const check = (n: string, ok: boolean, x = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + n + (x ? '  ' + x : '')); if (!ok) fails++; };
const h = g.hero; h.realm = 2; h.stage = 1; h.hp = 1; h.mp = 1;
for (const id of ['huodan', 'yinlei', 'dici', 'yinhun', 'lieyan']) if (!h.arts.some((a: any) => a.id === id)) h.arts.push({ id, xp: 0 });
const base = { x: 120000, y: 93000 };
function trial(skill: string, frac: number, burst = false, opts: { item?: string; tal?: string } = {}) {
  g.combat.reset(); g.modal = null; g.input.keys.clear(); g.input.mouse.active = false;
  g.player.x = base.x; g.player.y = base.y; g.player.flying = false; h.mp = 1; h.hp = 1; g.concealed = false;
  g.senseBurstT = burst ? 30 : 0;
  const R = g.combat.reach, d = R * frac;
  const e = new Enemy(ENEMIES.wolf ?? Object.values(ENEMIES)[0], base.x + d, base.y, 1, 1);
  e.maxHp = e.hp = 1e9; e.aggro = false; (e as any).speed = 0; e.def = { ...e.def, speed: 0 };
  g.combat.enemies.push(e);
  g.combat.lock = null; g.combat.cds.clear?.(); const hp0 = e.hp;
  if (opts.item) g.combat.castArtifact(opts.item); else if (opts.tal) g.combat.castTalisman(opts.tal); else g.combat.cast(skill);
  let t = 0;
  for (let i = 0; i < 90; i++) { g.modal = null; e.x = base.x + d; e.y = base.y; g.update(1 / 30); t += 1 / 30; g.senseBurstT = burst ? 30 : 0; if (e.hp < hp0) break; }
  return { hit: e.hp < hp0, t, R, sense: g.senseRadius, lock: g.combat.lock === e };
}
const r0 = trial('huodan', 0.5);
check('投放距离 = 神识 80%', Math.abs(r0.R - g.baseSenseRadius * 0.8) < 1, `R=${r0.R.toFixed(0)} 神识=${g.baseSenseRadius.toFixed(0)}`);
for (const s of ['huodan', 'yinlei', 'dici', 'yinhun', 'lieyan']) {
  const r = trial(s, 0.95);
  check(`${s} 打到 95% 投放距离处`, r.hit, `t=${r.t.toFixed(2)}s R=${r.R.toFixed(0)}`);
}
{ const r = trial('huodan', 1.15); check('超出投放距离的敌人不会被自动锁定', !r.lock && !r.hit); }
{ const r = trial('huodan', 0.95, true); check('外放后投放距离 = 外放神识 70%', Math.abs(r.R - g.baseSenseRadius * 2 * 0.7) < 1 && r.hit, `R=${r.R.toFixed(0)} t=${r.t.toFixed(2)}s`); }
// 法器 / 符箓
h.bag.push({ id: 'art_qingfeng', n: 1 }, { id: 'tal_huoqiu', n: 5 });
const items = (await import('../src/data/items')) as any;
const swordId = ['art_qingfeng', 'art_lvhuang', 'art_qingzhu'].find((id) => { try { return items.itemDef(id)?.art; } catch { return false; } });
if (swordId) { if (!h.bag.some((b: any) => b.id === swordId)) h.bag.push({ id: swordId, n: 1 }); const r = trial('', 0.9, false, { item: swordId }); check(`法器 ${swordId} 打到 90% 投放距离处`, r.hit, `t=${r.t.toFixed(2)}s`); }
const talId = Object.keys(items.ITEMS ?? {}).find((id: string) => items.itemDef(id)?.tal?.kind === 'fire');
if (talId) { h.bag.push({ id: talId, n: 5 }); const r = trial('', 0.9, false, { tal: talId }); check(`符箓 ${talId} 打到 90% 投放距离处`, r.hit, `t=${r.t.toFixed(2)}s`); }
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
