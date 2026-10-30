// 整帧截图：node 环境下跑 Game.update + Renderer.render
// 用法: npx tsx tools/shot-game.ts out.png <locId|x,y> [zoom] [frames] [phase] [weather] [day] [W,H]
import { createCanvas, save } from './env';
const W0 = 1280, H0 = 800;
const [wh] = [process.argv[9]];
const [CW, CH] = wh ? wh.split(',').map(Number) : [W0, H0];
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { sprites } = await import('../src/gfx/sprites');
sprites.frameMs = 1e9; (sprites as any).unlimited = true;
const t0 = Date.now();
const terrain = new Terrain(); terrain.build();
console.log('terrain', Date.now() - t0, 'ms');
const g = new Game(terrain);
const where = process.argv[3] || 'qixuan';
let x: number, y: number;
if (where.includes(',')) { const [a, b] = where.split(',').map(Number); x = a * WORLD_SCALE; y = b * WORLD_SCALE; }
else { const l = LOCATIONS.find((q) => q.id === where)!; x = l.x * WORLD_SCALE + (Number(process.argv[10] ?? 0)); y = l.y * WORLD_SCALE + (Number(process.argv[11] ?? 0)); }
const zoom = Number(process.argv[4] || 0.8);
const frames = Number(process.argv[5] || 3);
const phase = Number(process.argv[6] ?? 0.5);
const weather = process.argv[7] || 'clear';
const day = Number(process.argv[8] ?? 120);
if (process.env.REALM) { g.hero.realm = +process.env.REALM; (g.hero as any).stage = 0; }
if (process.env.TREAS) (g.hero as any).treasures = process.env.TREAS.split(",");
if (process.env.GONGFA) (g.hero as any).gongfa = process.env.GONGFA;
g.teleport(x, y);
g.cam.zoom = g.cam.targetZoom = zoom;
g.day = day;
g.clock = phase * 240;
g.revealAll = true;
g.setWeather(weather as any); g.weather.kind = weather as any; g.weather.next = weather as any; g.weather.k = 1;
const cv: any = createCanvas(CW, CH);
cv.clientWidth = CW; cv.clientHeight = CH;
cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv;
g.renderer = new Renderer(g, cv);
(g as any).paused = false;
if (process.env.BURST) { g.senseBurstT = 99; g.renderer.sense.burst = 1; }
if (process.env.CONCEAL) g.concealed = true;
if (process.env.ALARM) { g.renderer.sense.alarm = 1.5; }
const t1 = Date.now();
for (let i = 0; i < frames; i++) {
  g.update(1 / 30);
  g.weather.k = 1; g.weather.kind = weather as any;
  g.clock = phase * 240;
  g.renderer.render(1 / 30);
}
console.log('render', frames, 'frames', Date.now() - t1, 'ms; stats', JSON.stringify(g.renderer.stats), 'life', g.life.ents.length, 'sprites', JSON.stringify(sprites.stats));
// 计时：再渲一帧
const t2 = Date.now(); g.update(1 / 30); g.renderer.render(1 / 30); console.log('steady frame', Date.now() - t2, 'ms');
save(cv, process.argv[2] || 'game.png');
