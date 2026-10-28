// 第四十步：大城坐镇测试：FANREN_MAP=dajin npx tsx tools/test-garrison.ts（天南 / 乱星海同理）
import { createCanvas } from './env';
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOCATIONS, WORLD_SCALE, ACTIVE_MAP } = await import('../src/data/world');
const { garrisonOf } = await import('../src/world/garrison');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset?.();
void createCanvas;
let fails = 0;
const ok = (c: any, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const G = g.garrison, npcs = g.npcs;
const near = (l: any, R = 2500) => npcs.list.filter((d: any) => d.alive && (d.map ?? 'tiannan') === ACTIVE_MAP && Math.hypot(d.x - l.x * WORLD_SCALE, d.y - l.y * WORLD_SCALE) < R);
const cities = LOCATIONS.filter((l: any) => garrisonOf(l)).sort((a: any, b: any) => garrisonOf(b)![0] - garrisonOf(a)![0]);
ok(!cities.some((l: any) => ['jiyin', 'miaoyin'].includes(l.id)), '宗门所在不另设城主');
console.log(`${ACTIVE_MAP}：坐镇城池 ${cities.map((l: any) => `${l.name}${garrisonOf(l)!.join('/')}`).join('、')}`);
for (const l of cities.slice(0, 3)) {
  const yb = near(l).filter((d: any) => d.realm >= 4).length;
  g.teleport(l.x * WORLD_SCALE + 300, l.y * WORLD_SCALE + 300);
  G.acc = 0; G.update(2);
  const [ny, nj] = garrisonOf(l)!;
  const ya = near(l).filter((d: any) => d.realm >= 4), ja = near(l).filter((d: any) => d.realm === 3);
  console.log(`  ${l.name}：元婴 ${yb} → ${ya.length}，结丹 ${ja.length}　${ya.slice(0, 4).map((d: any) => d.title + d.name + '·' + npcs.realmText(d)).join('，')}`);
  ok(ya.length >= ny && ja.length >= nj, `${l.name}现身元婴 ≥${ny}、结丹 ≥${nj}`);
  ok(ya.every((d: any) => d.realm <= 4) && ya.filter((d: any) => d.gz && d.stage === 2).length <= Math.ceil(ny / 2), '坐镇不超过元婴，后期是少数');
  ok(near(l).filter((d: any) => d.gz).every((d: any) => !npcs.hostileTo(d)), '坐镇者不会无故出手');
}
const top = cities[0];
if (top) {
  g.teleport(top.x * WORLD_SCALE + 300, top.y * WORLD_SCALE + 300); G.acc = 0; G.update(2);
  const [y0, j0] = G.count(top);
  const vic = npcs.list.find((d: any) => d.gz === top.id && d.realm >= 4);
  vic.alive = false; G.acc = 0; G.update(2);
  const [y1] = G.count(top);
  ok(y1 === y0 - 1, `死去的元婴记入名册（${y0} → ${y1}）`);
  G.acc = 0; G.update(2);
  ok(!npcs.list.some((d: any) => d.gz === top.id && d.gzI === vic.gzI && d.alive && d.id === vic.id), '死者不会原样复活');
  for (let k = 0; k < 20; k++) G.daily(365);
  ok(G.count(top)[0] === y0, '若干年后有继任者');
  G.acc = 0; G.update(2);
  const succ = npcs.list.find((d: any) => d.gz === top.id && d.gzI === vic.gzI && d.alive);
  ok(succ && succ.id !== vic.id, `继任者是新人（${succ?.name}）`);
  ok(!npcs.toSave().some((d: any) => d.gz && !d.met), '未结识的坐镇者不进存档');
  void j0;
  g.teleport(top.x * WORLD_SCALE + 20000, top.y * WORLD_SCALE); G.acc = 0; G.update(2);
  const far = top.x * WORLD_SCALE + 20000;
  if (far < 1e9) ok(!npcs.list.some((d: any) => d.gz === top.id && !d.met), '走远后散去');
}
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
