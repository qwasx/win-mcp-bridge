// 第二十八步：我方特效逻辑冒烟（大庚剑阵 / 噬金虫群 / 风雷翅 / 雷遁）
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
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 1; g.hero.stage = 8;
g.teleport(l.x * WORLD_SCALE + 900, l.y * WORLD_SCALE + 600);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
const spawn = () => ['wolf', 'wolf', 'redwolf', 'boar', 'wolf'].forEach((id, i) => { const a = i / 5 * Math.PI * 2; const e = new Enemy(ENEMIES[id], g.player.x + 300 + Math.cos(a) * 140, g.player.y + Math.sin(a) * 90, 1, 3); e.aggro = true; e.skT = 99; g.combat.enemies.push(e); });
for (const id of (process.argv[2] || 'dageng,shijin,fengleichi,leidun,bixie,hutijiandun,xueyingdun,jianying,xutianding,dongxuan,dayanchong').split(',')) {
  g.combat.enemies = []; spawn();
  const t0 = Date.now();
  g.debugExec(id, 3);
  let maxN = 0;
  for (let i = 0; i < 260; i++) {
    g.hero.hp = 1; g.hero.mp = 1;
    g.update(1 / 30);
    if (i % 3 === 0) g.renderer.render(1 / 30);
    maxN = Math.max(maxN, g.combat.swarm?.n ?? 0);
  }
  const c = g.combat;
  if (c.swarm) { const sw: any = c.swarm, e = sw.target; console.log(' swarm tgt', e && [e.def.id, e.dead, Math.round(e.hp), Math.round(Math.hypot(sw.cx - e.x, sw.cy - e.y)), e.x - g.player.x, e.y - g.player.y], 'dmg', sw.o.dmg, 'tick', sw.tickT); }
  console.log(id, 'ms', Date.now() - t0, 'alive', c.enemies.filter((e) => !e.dead).length, 'acts', c.acts.list.length, 'swarm', c.swarm?.mode, maxN, 'wing', !!c.wing, 'ghosts', c.ghosts.length, 'scorch', c.scorch.length, 'hpE', c.enemies.map((e) => Math.round(e.hp / e.maxHp * 100)).join('/'));
}
