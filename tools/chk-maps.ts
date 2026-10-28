import { MAP_IDS, locsOf, mapSize, mapMainland, LOC_BY_ID, fromLegacyWorld } from '../src/data/world';
for (const m of MAP_IDS) {
  const L = locsOf(m), c: Record<string, number> = {};
  for (const l of L) c[l.type] = (c[l.type] ?? 0) + 1;
  console.log(m, mapSize(m), 'mainland pts', mapMainland(m).length, 'locs', L.length, JSON.stringify(c), 'majors', L.filter((l) => !l.minor).map((l) => l.name).join(' '));
}
for (const id of ['huangfeng', 'chuansong', 'chuansong_lx', 'kuixing', 'tianxing', 'xutian', 'shuozhou', 'tianlan', 'mulan', 'jinjing', 'beihan', 'qianzhu']) { const l = LOC_BY_ID.get(id)!; console.log(id, l.map, l.x.toFixed(0), l.y.toFixed(0)); }
console.log(fromLegacyWorld(120000, 93000), fromLegacyWorld(157200, 165600), fromLegacyWorld(169500, 193500));
