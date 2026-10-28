// 第三十七步：货有产地、宝有主人——坊市 / 拍卖 / 摊贩 / 藏经阁 / 掉落测试：npx tsx tools/test-market.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
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
const yd = (id: string) => M.yaodanLv(id);

type Seen = { owned: string[]; maxYd: Record<string, number>; ydPrice: Record<string, number[]>; items: Record<string, Set<string>> };
const seen: Seen = { owned: [], maxYd: {}, ydPrice: {}, items: {} };
const kinds = ['market', 'pill', 'artifact', 'talisman'] as const;
for (const map of ['tiannan', 'luanxing', 'dajin'] as const) {
  for (const l of locsOf(map)) {
    if (!['city', 'town', 'sect', 'isle'].includes(l.type as string)) continue;
    const z = M.zoneOfLoc(l), pz = M.pzOf(z);
    seen.items[pz] ??= new Set();
    for (let month = 0; month < 6; month++) {
      g.day = month * 30 + 3;
      for (const k of kinds) {
        const sh = T.shop(l, k);
        for (const s of sh.stock) {
          if (M.canonOwned(s.id)) seen.owned.push(`${l.name}:${itemDef(s.id).name}`);
          seen.items[pz].add(s.id);
          const lv = yd(s.id);
          if (lv) { seen.maxYd[pz] = Math.max(seen.maxYd[pz] ?? 0, lv); (seen.ydPrice[pz + lv] ??= []).push(s.price); }
        }
      }
    }
  }
}
ok(seen.owned.length === 0, `坊市不卖原著有主之宝 ${seen.owned.slice(0, 5).join(' ')}`);
ok((seen.maxYd.TN ?? 0) <= 3, `天南坊市妖丹最高 ${seen.maxYd.TN ?? 0} 级（≤3）`);
ok((seen.maxYd.LX ?? 0) >= 5 && (seen.maxYd.LX ?? 0) <= 6, `乱星海坊市妖丹最高 ${seen.maxYd.LX} 级（5–6）`);
ok((seen.maxYd.DJ ?? 0) <= 4, `大晋坊市妖丹最高 ${seen.maxYd.DJ ?? 0} 级（≤4）`);
const avg = (a?: number[]) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const tn2 = avg(seen.ydPrice.TN2), lx2 = avg(seen.ydPrice.LX2);
console.log(`  二级妖丹：天南 ${tn2.toFixed(0)}  乱星海 ${lx2.toFixed(0)}`);
ok(!(tn2 < lx2 * 3), '二级妖丹在天南至少贵三倍');
const y5 = itemDef('mat_yaodan5');
ok(y5.price * M.priceMul(y5, 'tiannan') > 5 * y5.price * M.priceMul(y5, 'luanxing'), `五级妖丹单价：天南 ${Math.round(y5.price * M.priceMul(y5, 'tiannan'))} / 乱星海 ${Math.round(y5.price * M.priceMul(y5, 'luanxing'))}`);
ok(!seen.items.TN.has('art_bamen') && !seen.items.TN.has('egg_jiao'), '天南不卖乱星海的八门金光镜仿品、蛟卵');
ok(!seen.items.LX.has('art_jinfu') && !seen.items.LX.has('art_wulong'), '乱星海不卖黄枫谷的金蚨子母刃、墨蛟法器');
ok(!seen.items.TN.has('pill_zhuji') && !seen.items.DJ.has('pill_zhuji'), '天南 / 大晋坊市不卖筑基丹（七派把持，只上拍卖或宗门兑换）');

// 卖出价按价区
const sh0 = T.shop(LOC_BY_ID.get('tianxing') ?? locsOf('luanxing')[0], 'market'), sh1 = T.shop(LOC_BY_ID.get('huangfeng')!, 'market');
ok(T.sellPrice(sh1, 'mat_yaodan3') > T.sellPrice(sh0, 'mat_yaodan3') * 4, `三级妖丹卖给天南 ${T.sellPrice(sh1, 'mat_yaodan3')} / 卖给乱星海 ${T.sellPrice(sh0, 'mat_yaodan3')}`);

// 拍卖会
const auc: Record<string, number> = {}; const aOwned: string[] = []; let tnTianyang = false;
for (const map of ['tiannan', 'luanxing', 'dajin'] as const) for (const l of locsOf(map)) {
  if (!(l.type === 'city' || l.type === 'isle')) continue;
  const pz = M.pzOf(M.zoneOfLoc(l));
  for (let q = 0; q < 30; q++) {
    g.day = q * 90 + 82;
    for (const lot of T.auctionLots(l)) {
      if (M.canonOwned(lot.id)) aOwned.push(lot.id);
      if (lot.id === 'art_tianyang' && pz === 'TN') tnTianyang = true;
      const lv = yd(lot.id); if (lv) auc[pz] = Math.max(auc[pz] ?? 0, lv);
    }
  }
}
console.log('  拍卖会最高妖丹', JSON.stringify(auc));
ok(aOwned.length === 0, `拍卖会不拍原著有主之宝 ${aOwned.slice(0, 4).join(' ')}`);
ok(!tnTianyang, '天南拍卖会拍不到温天仁的天阳鎏金针');
ok((auc.TN ?? 0) <= 5 && (auc.LX ?? 0) >= 6 && (auc.LX ?? 0) <= 7 && (auc.DJ ?? 0) <= 6, '拍卖会：天南 ≤5 级、乱星海 6–7 级、大晋 ≤6 级；从无八九级');

// 摊贩
let npcBad = 0, npcYd = 0;
for (const d of g.npcs.list.filter((d) => d.alive && (d.faction === 'merchant' || d.faction === 'rogue')).slice(0, 120)) {
  for (const s of (g.npcs as any).stock(d) as { id: string }[]) { if (M.canonOwned(s.id)) npcBad++; npcYd = Math.max(npcYd, yd(s.id)); }
}
ok(npcBad === 0, '摊贩不卖原著有主之宝');
ok(npcYd <= 4, `摊贩最高妖丹 ${npcYd} 级（≤4）`);

// 藏经阁
(g.ws as any).sect = { id: 'huangfeng', rank: 3, contrib: 0, joined: 0 };
const lib = T.library(LOC_BY_ID.get('huangfeng')!);
const foreign = lib.stock.filter((s) => { const r = M.ruleOf(itemDef(s.id)); return r.homes && !r.homes.includes('huangfeng'); });
ok(foreign.length === 0, `黄枫谷藏经阁没有别派秘传 ${foreign.map((s) => s.id).join(' ')}`);
ok(lib.stock.every((s) => !M.canonOwned(s.id)), '藏经阁没有原著独门秘术');

// 掉落
const { pickArt } = await import('../src/world/sites');
let dropBad = 0;
g.hero.realm = 4;
for (let i = 0; i < 3000; i++) { const a = pickArt(4, i % 5 === 0); if (a && M.canonOwned(a)) dropBad++; const s = g.combat.randomScroll(4); if (s && M.canonOwned(s)) dropBad++; }
ok(dropBad === 0, '随机掉落不出原著有主之宝 / 独门秘术');

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
