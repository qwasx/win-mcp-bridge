// 第 4 阶段（s4-content）：导出生成器样例（看文风）：npx tsx tools/gen-samples.ts [输出路径]
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { ITEM_LIST, TIER_NAMES } = await import('../src/data/items');
const { ART_META, KIND_NAME } = await import('../src/data/canon/artgen');
const { WX_NAME } = await import('../src/data/canon/types');
const fs = await import('fs');
const RN: Record<string, string> = { tiannan: '天南', luanxing: '乱星海', dajin: '大晋' };
const gen = ITEM_LIST.filter((i) => i.id.startsWith('gen_'));
const out: string[] = [`凡人修仙传 · 法器生成器样例（共生成 ${gen.length} 件，此处按地域各取若干，共 50 件）`, ''];
let k = 0;
for (const r of ['tiannan', 'luanxing', 'dajin']) {
  const list = gen.filter((i) => ART_META[i.id].region === r);
  out.push(`【${RN[r]}】`);
  const n = r === 'tiannan' ? 18 : 16;
  for (let i = 0; i < n; i++) {
    const it = list[Math.floor((i + 0.5) * list.length / n)], m = ART_META[it.id];
    out.push(`${++k}. ${it.name}　〔${TIER_NAMES[it.tier]} · ${KIND_NAME[it.art!.kind]} · ${WX_NAME[m.wx]}属 · ${it.price} 灵石〕`);
    out.push(`   ${it.desc}`);
  }
  out.push('');
}
const path = process.argv[2] ?? 'tools/out/生成器样例.txt';
fs.writeFileSync(path, out.join('\n'));
console.log(out.slice(0, 12).join('\n'), '\n…', path);
