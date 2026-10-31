// 地标探测：打印地点周围的地形 ASCII 图（~ 水  ^ 高山  n 丘陵  r 河  f 林  . 平地  @ 中心  # 地点区）
import './env';
const store: Record<string, string> = {};
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { locHere, WORLD_SCALE } = await import('../src/data/world');
const T = new Terrain(); T.build();
const ids = process.argv.slice(2);
for (const id of ids) {
  const [lid, rs, st] = id.split(':');
  const l = locHere(lid); if (!l) { console.log('no', lid); continue; }
  const cx = l.x * WORLD_SCALE, cy = l.y * WORLD_SCALE, R = +(rs ?? 6000), S = +(st ?? 400);
  const z = T.locZones.find((q) => q.id === lid);
  console.log(`== ${lid} ${l.name} center ${cx.toFixed(0)},${cy.toFixed(0)} zone rx ${z?.rx.toFixed(0)} ry ${z?.ry.toFixed(0)}`);
  for (let dy = -R; dy <= R; dy += S) {
    let row = (dy + '').padStart(6) + ' ';
    for (let dx = -R; dx <= R; dx += S) {
      const x = cx + dx, y = cy + dy, s = T.sample(x, y);
      let c = !T.isLand(x, y) ? '~' : T.nearRiver(x, y) ? 'r' : s.elev > 0.62 ? 'A' : s.elev > 0.42 ? '^' : s.elev > 0.24 ? 'n' : s.forest > 0.4 ? 'f' : '.';
      if (T.inLocZone(x, y) && c !== '~') c = '#';
      if (dx === 0 && dy === 0) c = '@';
      row += c;
    }
    console.log(row);
  }
}
