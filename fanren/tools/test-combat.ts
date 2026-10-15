// 战斗冒烟测试 + 截图：npx tsx tools/test-combat.ts out.png [loc] [realm] [enemyIds] [arts]
import { createCanvas, save } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { ARTS, ART_LIST } = await import('../src/data/arts');
const { ENEMIES, ENEMY_LIST } = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const { sprites } = await import('../src/gfx/sprites');
sprites.frameMs = 1e9; (sprites as any).unlimited = true;
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === (process.argv[3] || 'qixuan'))!;
const realm = +(process.argv[4] || 1);
g.hero.realm = realm; g.hero.stage = realm === 1 ? 8 : 1;
const x = l.x * WORLD_SCALE + 900, y = l.y * WORLD_SCALE + 600;
g.teleport(x, y);
g.cam.zoom = g.cam.targetZoom = 0.9; g.day = 120; g.clock = 0.45 * 240;
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
for (const a of ART_LIST) if (!g.hero.arts.some((q) => q.id === a.id)) g.hero.arts.push({ id: a.id, xp: 0 });
g.hero.bag.push({ id: 'art_qingzhu', n: 1 }, { id: 'mat_jinleizhu', n: 1 });
const ids = (process.argv[5] || 'wolf,fox,boar,ghost,snake').split(',');
const byId = (id: string) => ENEMIES?.[id] ?? ENEMY_LIST.find((e: any) => e.id === id) ?? ENEMY_LIST[0];
let errs = 0;
const spawn = () => ids.forEach((id, i) => { const a = i / ids.length * Math.PI * 2; g.combat.enemies.push(new Enemy(byId(id), g.player.x + Math.cos(a) * 320, g.player.y + Math.sin(a) * 200, realm, 3)); });
spawn();
// 1) 每门法术各施展一次，跑若干帧
const t0 = Date.now();
for (const a of ART_LIST) {
  g.hero.mp = 1; g.hero.hp = 1;
  (g.combat as any).cds.clear();
  try { g.combat.cast(a.id); for (let i = 0; i < 6; i++) g.update(1 / 30); } catch (e) { errs++; console.log('ERR', a.id, e); }
  if (g.combat.enemies.filter((e) => !e.dead).length < 2) spawn();
  if (g.hero.dead) { console.log('hero dead?'); break; }
}
// 1b) 每件法器出手一次（第十三步：实体 + 光效），带渲染
{
  const { ITEM_LIST } = await import('../src/data/items');
  const tA = Date.now(); let n = 0;
  // 注：node 画布在高境界神识半径下会崩溃，故保持原境界（威力按境界衰减）
  for (const it of ITEM_LIST) {
    if (!it.art || ['armor', 'shield', 'flight', 'wings', 'boots'].includes(it.art.kind as string)) continue;
    g.hero.bag.push({ id: it.id, n: 1 }); g.hero.mp = 1; g.hero.hp = 1; (g.combat as any).cds.clear();
    if (process.env.DBG) console.log("art", it.id);
    try { g.combat.castArtifact(it.id); n++; for (let i = 0; i < 75; i++) { g.update(1 / 30); if (i % 15 === 0 && process.env.BODY) { const out: any[] = []; g.combat.acts.collect(out); const cx: any = cv.getContext('2d'); out.forEach((d, j) => { console.log(' body', i, j); d.draw(cx); }); } if (i % 15 === 0 && !process.env.NOR) g.renderer.render(1 / 30); } } catch (e) { errs++; console.log('ERR art', it.id, e); }
    if (g.combat.enemies.filter((e) => !e.dead).length < 3) spawn();
  }
  g.hero.realm = realm;
  console.log('artifacts cast', n, Date.now() - tA, 'ms; acts left', g.combat.acts.list.length);
}
console.log('all arts cast', Date.now() - t0, 'ms errs', errs, 'kills', g.hero.kills, 'loot', g.combat.loot.length, 'exp', Math.round(g.hero.exp));
// 2) 敌人攻击玩家：站着挨打直到倒下
g.combat.reset(); g.hero.mp = 1; g.hero.hp = 1;
const hp0 = g.hero.realm;
for (let k = 0; k < 4; k++) g.combat.enemies.push(new Enemy(byId('firetiger') , g.player.x + 200 + k * 30, g.player.y, realm + 1, 5));
let downed = false; const day0 = g.day;
for (let i = 0; i < 30 * 120 && !downed; i++) { try { g.update(1 / 30); } catch (e) { errs++; console.log('ERR upd', e); break; } if (g.day >= day0 + 3) downed = true; }
console.log('downed', downed, 'hp', g.hero.hp.toFixed(2), 'dead(oldage)', g.hero.dead, 'fade', g.combat.fade.toFixed(2));
// 3) 截图：重新布怪 + 施法中
g.combat.reset(); g.hero.hp = 0.8; g.hero.mp = 1;
g.teleport(x, y);
spawn();
for (const e of g.combat.enemies) e.aggro = true;
for (let i = 0; i < 30; i++) { g.update(1 / 30); g.renderer.render(1 / 30); }
const arts = (process.argv[6] || 'huoya,zhangxin,xuanbing').split(',');
for (const a of arts) { (g.combat as any).cds.clear(); g.hero.mp = 1; g.combat.cast(a); console.log('cast', a, 'projs', g.combat.projs.length, 'fields', g.combat.fields.length, 'canAct', g.combat.canAct, (g as any).toasts?.slice(-1)[0]?.text); for (let i = 0; i < 5; i++) { g.update(1 / 30); g.renderer.render(1 / 30); } }
console.log('frame ms', g.renderer.stats.ms.toFixed(1), 'enemies', g.combat.enemies.length, 'projs', g.combat.projs.length, 'vfx', g.combat.vfx.length);
save(cv, process.argv[2] || 'c1.png');
