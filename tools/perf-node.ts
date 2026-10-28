// 第三十八步：分项剖析（Node + Skia 画布，CPU 端）——在指定地点来回走动 N 帧，打印 prof 报告。
// 用法: npx tsx tools/perf-node.ts <locId|x,y|sea> [frames=240] [zoom=0.8]
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { sprites } = await import('../src/gfx/sprites');
const { prof } = await import('../src/core/prof');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const where = process.argv[2] || 'yuejing', frames = Number(process.argv[3] || 240), zoom = Number(process.argv[4] || 0.8);
let x: number, y: number;
if (where === 'sea') { // 越京以东找一片开阔海面
  const l = LOCATIONS.find((q) => q.id === 'yuejing')!; x = l.x * WORLD_SCALE; y = l.y * WORLD_SCALE;
  outer: for (let r = 2000; r < 60000; r += 1000) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r; let ok = true; for (let k = -3000; k <= 3000 && ok; k += 500) for (let j = -1500; j <= 1500 && ok; j += 500) if (terrain.isLand(px + k, py + j)) ok = false; if (ok) { x = px; y = py; break outer; } }
} else if (where.includes(',')) { const [a, b] = where.split(',').map(Number); x = a * WORLD_SCALE; y = b * WORLD_SCALE; }
else { const l = LOCATIONS.find((q) => q.id === where)!; x = l.x * WORLD_SCALE; y = l.y * WORLD_SCALE + 400; }
g.hero.realm = 2; (g.hero as any).stage = 1;
if (where === 'sea') { g.hero.realm = 2; }
g.teleport(x - 1500, y);
if (where === 'sea') { (g as any).player.flying = true; }
g.cam.zoom = g.cam.targetZoom = zoom;
g.day = 120; g.clock = 0.45 * 240;
const cv: any = createCanvas(CW, CH);
cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv);
(g as any).paused = false;
(g as any).story.skipAll?.(); (g as any).story.openT = -1; (g as any).modal = null;
// 预热：先把位图都生成出来（与浏览器里走过一阵后的状态一致）
sprites.frameMs = 1e9; (sprites as any).unlimited = true;
for (let i = 0; i < 20; i++) { g.update(1 / 60); g.renderer.render(1 / 60); }
(sprites as any).unlimited = false; sprites.frameMs = 7;
prof.on = true; prof.reset();
const ft: number[] = [];
for (let i = 0; i < frames; i++) {
  const k = Math.floor(i / 120) % 2 ? 1 : -1;
  g.destination = { x: x + k * 1500, y };
  const t0 = performance.now();
  g.update(1 / 60); g.renderer.render(1 / 60);
  const ms = performance.now() - t0; ft.push(ms); prof.endFrame(ms);
}
ft.sort((a, b) => a - b);
const st = g.renderer.stats;
console.log(`${where} land=${terrain.isLand(g.player.x, g.player.y)} frames=${frames} avg=${(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(1)}ms p50=${ft[ft.length >> 1].toFixed(1)} p95=${ft[Math.floor(ft.length * .95)].toFixed(1)} max=${ft[ft.length - 1].toFixed(0)} trees=${st.trees} mtns=${st.mtns} decos=${st.decos} grass=${st.grass} life=${g.life.ents.length} npcActive=${g.npcs.active.size} sprites=${JSON.stringify(sprites.stats)}`);
for (const r of prof.report(Number(process.env.TOP || 34))) console.log(`${r.ms.toFixed(2).padStart(7)}ms ×${String(r.n).padEnd(6)} ${r.k}`);
if (prof.spikes.length) console.log('spikes:', JSON.stringify(prof.spikes.slice(-5)));
