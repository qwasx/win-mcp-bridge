// 第三阶段：活世界的帧耗时——只跑逻辑（不画），量 NPC 更新每帧多少毫秒。
// 用法: npx tsx tools/perf-sim.ts [frames=1800] [extra=0]   extra：额外塞进当前地图的散修人数（压力测试）
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
(g as any).paused = false; (g as any).story.skipAll?.(); (g as any).modal = null;
const frames = Number(process.argv[2] || 1800), extra = Number(process.argv[3] || 0);
const N: any = g.npcs;
if (extra > 0) {
  const base = N.list.filter((d: any) => d.faction !== 'mortal' && (d.map ?? 'tiannan') === ACTIVE_MAP);
  for (let i = 0; i < extra; i++) { const s = base[i % base.length]; const c = { ...s, id: 'px' + i, seed: s.seed + i * 7, ties: undefined, bag: undefined, main: undefined, aim: undefined, canon: false, beauty: undefined, stay: false }; N.list.push(c); }
  N.byId = new Map(N.list.map((n: any) => [n.id, n]));
}
const yj = LOC_BY_ID.get('yuejing')!;
g.teleport(yj.x * WORLD_SCALE, yj.y * WORLD_SCALE + 900);
g.hero.realm = 2; g.hero.stage = 1;
const alive = N.list.filter((d: any) => d.alive && (d.map ?? 'tiannan') === ACTIVE_MAP).length;
const pos0 = new Map(N.list.map((d: any) => [d.id, [d.x, d.y]]));
const ft: number[] = [], nt: number[] = [];
for (let i = 0; i < frames; i++) {
  const t0 = performance.now(); g.update(1 / 60); const t1 = performance.now();
  // 只量 NPC：单独再跑一遍 npcs.update 的耗时（用 0 dt，避免重复推进时间）
  ft.push(t1 - t0);
  const a = performance.now(); N.update(1 / 60); nt.push(performance.now() - a);
  if (g.modal) g.closeModal(true);
}
const st = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return `avg ${(s.reduce((p, q) => p + q, 0) / s.length).toFixed(2)} p50 ${s[s.length >> 1].toFixed(2)} p95 ${s[Math.floor(s.length * 0.95)].toFixed(2)} max ${s[s.length - 1].toFixed(1)}`; };
let moved = 0; for (const d of N.list) { const p = pos0.get(d.id) as number[] | undefined; if (p && d.alive && Math.hypot(d.x - p[0], d.y - p[1]) > 200) moved++; }
console.log(`map=${ACTIVE_MAP} 本图在世 ${alive} 人（含额外 ${extra}） 活跃 ${N.active.size}`);
console.log(`整帧逻辑 g.update: ${st(ft)} ms`);
console.log(`NPC 更新 npcs.update: ${st(nt)} ms`);
const big = nt.map((v, i) => [v, i]).filter(([v]) => v > 8); console.log(`NPC 更新超过 8ms 的帧：${big.length} 个（第 ${big.slice(0, 6).map(([v, i]) => i + ':' + v.toFixed(0) + 'ms').join('，')}）`);
console.log(`${(frames / 60).toFixed(0)} 秒后移动超过 200 像素的 NPC：${moved}`);
