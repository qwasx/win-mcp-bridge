// 第三十一步：妖气等级分布 ASCII 图：npx tsx tools/dbg-danger.ts
import { createCanvas } from './env';
void createCanvas;
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { WORLD_SCALE, LOCATIONS } = await import('../src/data/world');
const { bandRealm, lvOf } = await import('../src/data/enemies');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const W = terrain.W, H = terrain.H, sx = Math.ceil(W / 100), sy = Math.ceil(H / 45);
const marks = new Map<string, string>();
for (const l of LOCATIONS as any[]) if (l.type === 'sect' || l.type === 'city') marks.set(Math.floor(l.x / sx) + ',' + Math.floor(l.y / sy), l.type === 'sect' ? 'S' : 'C');
const hist = new Array(9).fill(0);
for (let y = 0; y < H; y += sy) {
  let row = '';
  for (let x = 0; x < W; x += sx) {
    const wx = (x + sx / 2) * WORLD_SCALE, wy = (y + sy / 2) * WORLD_SCALE;
    const m = marks.get(Math.floor(x / sx) + ',' + Math.floor(y / sy));
    const c = g.combat.dangerCalc(wx, wy);
    const land = terrain.isLand(wx, wy);
    const kk = Math.round(c.k);
    hist[kk]++;
    row += m ?? (land ? String(kk) : '~abcdefghi'[kk + 1] ?? '?');
  }
  console.log(row);
}
console.log('hist k', hist.join(' '));
for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8]) { const h: Record<number, number> = {}; for (let i = 0; i < 2000; i++) { const r = bandRealm(k, Math.random); const lv = r.realm === 1 ? (r.stage >= 9 ? 1.5 : 1) : lvOf(r.realm, r.stage); h[lv] = (h[lv] ?? 0) + 1; } console.log('k', k, Object.entries(h).sort((a, b) => +a[0] - +b[0]).map(([a, b]) => a + ':' + Math.round(b / 20) + '%').join(' ')); }
