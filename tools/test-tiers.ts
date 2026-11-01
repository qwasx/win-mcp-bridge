// 第四十步：城池分档——越大的城，坊市、拍卖会的货越好：npx tsx tools/test-tiers.ts
import { createCanvas } from './env';
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { locsOf, LOC_BY_ID } = await import('../src/data/world');
const { itemDef } = await import('../src/data/items');
const M = await import('../src/data/market');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
void createCanvas;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const T = g.towns;
const kinds = ['market', 'pill', 'artifact', 'talisman'] as const;
// 每档：平均品阶、平均价、g4 件数
const st: Record<number, { n: number; tier: number; price: number; g4: number; items: number }> = {};
const au: Record<number, { lots: number; tier: number; base: number; top: number; t5: number; q: number }> = {};
const owned: string[] = [];
for (const map of ['tiannan', 'luanxing', 'dajin'] as const) for (const l of locsOf(map)) {
  if (!['city', 'town', 'isle'].includes(l.type as string) && l.id !== 'tainan') continue;
  if (l.type === 'isle' && l.minor) continue;
  const t = M.cityTier(l);
  for (let month = 0; month < 12; month++) {
    g.day = month * 30 + 3;
    for (const k of kinds) {
      const sh = T.shop(l, k), s = (st[t] ??= { n: 0, tier: 0, price: 0, g4: 0, items: 0 });
      s.n++;
      for (const x of sh.stock) { const it = itemDef(x.id); if (['pill_huiqi', 'pill_liaoshang', 'tal_pojin', 'tal_huifu'].includes(x.id)) continue; s.items++; s.tier += it.tier; s.price += x.price; if (M.ruleOf(it).g >= 4 && !M.yaodanLv(x.id) && x.id !== 'pill_zhuji') s.g4++; if (M.canonOwned(x.id)) owned.push(l.name + ':' + it.name); }
    }
  }
  if (!T.isMajorTown(l)) continue;
  for (let q = 0; q < 16; q++) {
    g.day = q * 90 + 82;
    const lots = T.auctionLots(l), a = (au[t] ??= { lots: 0, tier: 0, base: 0, top: 0, t5: 0, q: 0 });
    a.q++; a.lots += lots.length;
    for (const x of lots) { const it = itemDef(x.id); a.tier += it.tier; a.base += x.base; if (x.top) a.top++; if (it.tier >= 5) a.t5++; if (M.canonOwned(x.id)) owned.push(l.name + '拍卖:' + it.name); }
  }
}
console.log('档次  坊市件数/店  平均品阶  平均价      g4/店');
for (const t of [1, 2, 3, 4, 5]) { const s = st[t]; if (!s) continue; console.log(`${M.TIER_NAME[t].padEnd(4)}  ${(s.items / s.n).toFixed(1).padStart(6)}  ${(s.tier / s.items).toFixed(2).padStart(8)}  ${Math.round(s.price / s.items).toString().padStart(8)}  ${(s.g4 / s.n).toFixed(2)}`); }
console.log('档次  拍品/场  平均品阶  平均底价    压轴/场  五品以上/场');
for (const t of [2, 3, 4, 5]) { const a = au[t]; if (!a) continue; console.log(`${M.TIER_NAME[t].padEnd(4)}  ${(a.lots / a.q).toFixed(1).padStart(5)}  ${(a.tier / a.lots).toFixed(2).padStart(8)}  ${Math.round(a.base / a.lots).toString().padStart(9)}  ${(a.top / a.q).toFixed(2).padStart(7)}  ${(a.t5 / a.q).toFixed(2)}`); }
const avg = (t: number) => st[t].tier / st[t].items;
ok(avg(1) < avg(2) && avg(2) < avg(3) && avg(3) < avg(4) && avg(4) < avg(5), '坊市平均品阶随城池档次递增');
ok(st[5].items / st[5].n > st[2].items / st[2].n + 4, '天下名城的铺子货品明显更多');
ok(st[2].g4 === 0 && st[3].g4 === 0, '城池 / 大城的铺子没有拍卖会级货');
ok(st[5].g4 / st[5].n > 0.8, '天下名城的铺子里常有拍卖会级的好货');
const at = (t: number) => au[t].tier / au[t].lots, ab = (t: number) => au[t].base / au[t].lots;
ok(at(2) < at(3) && at(3) < at(4) && at(4) < at(5), '拍品平均品阶随档次递增');
ok(ab(5) > ab(3) * 5, `名城拍品底价远高于大城（${Math.round(ab(5))} vs ${Math.round(ab(3))}）`);
ok(au[5].t5 / au[5].q >= 1.5, '名城每场至少一两件五品以上（灵宝 / 元婴丹 / 古宝）');
ok(au[2].t5 === 0, '小城拍卖会没有五品之物');
ok(owned.length === 0, '原著有主之宝不上架、不上拍' + (owned.length ? '：' + owned.slice(0, 5).join('，') : ''));
// 晋京拍过庚精、天星城拍过天雷竹
const seenIds = (id: string, n = 40) => { const out = new Set<string>(); for (let q = 0; q < n; q++) { g.day = q * 90 + 82; for (const x of T.auctionLots(LOC_BY_ID.get(id)!)) out.add(x.id); } return out; };
const jj = seenIds('jinjing'), tx = seenIds('tianxing', 80);
ok(jj.has('mat_gengjing'), '晋京九霄殿拍卖会能拍到庚精');
ok(tx.has('herb_tianleizhu'), '天星城大拍卖偶有天雷竹');
ok([...tx].some((id) => M.yaodanLv(id) === 7), '天星城拍得到七级妖丹');
ok(![...jj].some((id) => M.yaodanLv(id) >= 7), '大晋拍不到七级妖丹');
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
