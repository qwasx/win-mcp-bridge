(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { lootPool, poolOverlap } = await import('../src/data/canon/loot');
const { itemDef } = await import('../src/data/items');
for (const t of [1, 2, 3, 4]) console.log(t, poolOverlap(lootPool('tiannan', undefined, t, 'art'), lootPool('luanxing', undefined, t, 'art')).toFixed(2), poolOverlap(lootPool('tiannan', undefined, t, 'art'), lootPool('dajin', undefined, t, 'art')).toFixed(2));
for (const s of ['huangfeng', 'guiling', 'tianque', 'baiqiao']) console.log(s, lootPool('tiannan', s, 3, 'art').slice(0, 8).map(([i]) => itemDef(i).name).join(' '));
console.log('hf-gl', poolOverlap(lootPool('tiannan', 'huangfeng', 3, 'art'), lootPool('tiannan', 'guiling', 3, 'art')).toFixed(2));
