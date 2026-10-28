// 第四十步：物品 / 功法来源审计——每件东西至少要有一条获取途径（买 / 拍 / 炼 / 掉 / 杀人夺宝 / 机缘 / 宗门 / 剧情）
// 用法：npx tsx tools/audit-sources.ts        （ALL=1 列出全部来源）
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { ITEM_LIST } = await import('../src/data/items');
const { RECIPES } = await import('../src/data/recipes');
const { ENEMY_LIST } = await import('../src/data/enemies');
const { ART_LIST, START_ARTS } = await import('../src/data/arts');
const { BOUND_ARTS } = await import('../src/world/obtain');
const GH = await import('../src/world/great');
const M = await import('../src/data/market');
const { SECT_LIB } = await import('../src/world/town');
const { CANON_ONLY_ART } = await import('../src/world/sites');
const { NpcWorld } = await import('../src/world/npc');
const CANON_SRC = (await import('../src/world/canonloot')).canonSources();   // 第 4 阶段：镇宗之宝 / 人物本命法宝
const fs = await import('fs');
const zones = ['yue', 'tiannan', 'mo', 'mulan', 'luanxing', 'dajin', 'caoyuan'];
const files = ['src/world', 'src/ui'].flatMap((d) => fs.readdirSync(d).filter((f: string) => /\.tsx?$/.test(f)).map((f: string) => fs.readFileSync(d + '/' + f, 'utf8').split('\n'))).flat();
const giveRe = /addItem|dropLoot|give\(|reward|prize|treasure|items?:|drops|lot|push\(|loot/i;
const explicit = (id: string) => files.some((l) => l.includes(`'${id}'`) && giveRe.test(l) && !/needs|bagCount|removeItem|hasItem|C_has/.test(l));
const recipeOut = new Set(RECIPES.map((r: any) => r.out));
const drops = new Set(ENEMY_LIST.flatMap((e: any) => (e.drops ?? []).map((d: any) => d.id)));
const beastLv = new Set(ENEMY_LIST.filter((e: any) => e.kind === 'beast').flatMap((e: any) => { const o: number[] = []; for (let l = e.lv[0]; l <= e.lv[1]; l++) o.push(l); return o; }));
const treasure = new Set(Object.values(NpcWorld.TREASURE).flat());
const libs = new Set(Object.values(SECT_LIB as Record<string, string[]>).flat().filter((id) => !M.canonOwned(id)));
const randScroll = new Set(ART_LIST.filter((s: any) => s.tier <= 4 && !s.needs && !M.canonOwned('scroll_art_' + s.id)).map((s: any) => 'scroll_art_' + s.id));
const sources = new Map<string, string[]>();
// 动态来源（代码里拼出来的 id，或按好感发放）
const DYNAMIC: Record<string, string> = { tok_danuoyi: '灵石矿洞深处（travel.ts）', gift_fan: '红颜信物（好感 40）', gift_hairpin: '红颜信物（好感 60）', gift_sachet: '红颜信物（好感 80）' };
const boundArt = new Map(BOUND_ARTS.map(([item, art]) => [art, item]));
const petArt = new Set(['shijin']);
const ok = (it: any) => {
  const how: string[] = [];
  const yl = M.yaodanLv(it.id);
  if (yl) { if (beastLv.has(yl)) how.push('妖兽'); if (yl <= 7) how.push('坊市'); }
  else if (zones.some((z) => M.sellableAt(it, z as any, 3, 7, undefined))) how.push('坊市');
  else if (zones.some((z) => M.sellableAt(it, z as any, 4, 7, undefined, true))) how.push('拍卖');
  if (!how.length && zones.some((z) => M.sellableAt(it, z as any, 5, 7, undefined, true))) how.push('雄城拍卖');
  if (!how.length && zones.some((z) => M.sellableAt(it, z as any, 6, 7, undefined, true))) how.push('名城拍卖');
  if (M.ruleOf(it).homes) how.push('宗门秘传');
  if (recipeOut.has(it.id)) how.push('炼制');
  if (drops.has(it.id)) how.push('掉落');
  if (treasure.has(it.id)) how.push('杀人夺宝');
  if (libs.has(it.id)) how.push('宗门');
  if (randScroll.has(it.id)) how.push('随机卷轴');
  if (explicit(it.id)) how.push('机缘/剧情');
  if (DYNAMIC[it.id]) how.push(DYNAMIC[it.id]);
  if (CANON_SRC[it.id]) how.push(CANON_SRC[it.id]);
  if ([...GH.GREAT_TOP, ...GH.GREAT_LINGBAO, ...GH.GREAT_SECRET].includes(it.id)) how.push('大夺宝（great.ts）');
  if (!how.length && (it.type === 'pill' || it.type === 'talisman' || it.type === 'material') && it.price > 0 && !yl && it.id !== 'mat_gubaocan' && !M.canonOwned(it.id)) how.push('遗物(随机)');
  if (!how.length && it.type === 'artifact' && it.price > 0 && !CANON_ONLY_ART.has(it.id) && !M.canonOwned(it.id) && it.tier >= 1 && it.tier <= 5) how.push('异宝(随机)');
  return how;
};
const bad: string[] = [];
for (const it of ITEM_LIST as any[]) {
  if (it.id === 'mat_lingshi' || it.id === 'item_bottle') continue;
  const how = ok(it); sources.set(it.id, how);
  if (!how.length) bad.push(`  ✗ ${it.id.padEnd(24)} ${it.name}  t${it.tier} ¥${it.price}${M.ownerOf(it.id) ? '  主:' + M.ownerOf(it.id) : ''}`);
  else if (process.env.ALL) console.log(`    ${it.id.padEnd(24)} ${it.name.padEnd(10)} ${how.join(' ')}`);
}
// 功法：卷轴拿得到，或剧情直接传授
const learnLines = files.filter((l) => /learn\(|arts\.push/.test(l)).join('\n');
const badArt: string[] = [];
const learnable = new Set<string>();
for (const s of ART_LIST as any[]) {
  const sc = 'scroll_art_' + s.id;
  const hasScroll = (sources.get(sc) ?? []).length > 0;
  const story = learnLines.includes(`'${s.id}'`);
  const start = START_ARTS.includes(s.id);
  const bound = boundArt.has(s.id) && (sources.get(boundArt.get(s.id)!) ?? []).length > 0;
  const pet = petArt.has(s.id) || (s.id === 'dageng' && (sources.get('mat_gengjing') ?? []).length > 0);   // 大庚剑阵：庚精淬剑后自悟
  learnable.add(s.id);
  if (!hasScroll && !story && !start && !bound && !pet) { learnable.delete(s.id); badArt.push(`  ✗ 功法 ${s.id.padEnd(16)} ${s.name}`); }
}
// 炼方的原料都要拿得到
const badIn: string[] = [];
for (const r of RECIPES as any[]) for (const inp of r.inputs) if (!(sources.get(inp.id) ?? ['?']).length) badIn.push(`  ✗ 炼方 ${r.id} 缺 ${inp.id}`);
const bad2 = bad.filter((l) => { const m = l.match(/scroll_art_(\w+)/); return !(m && learnable.has(m[1])); });
console.log(bad2.join('\n')); console.log(badArt.join('\n')); console.log(badIn.join('\n'));
console.log(`物品无来源 ${bad2.length} / ${ITEM_LIST.length}　功法学不到 ${badArt.length} / ${ART_LIST.length}　炼方缺料 ${badIn.length}`);
if (process.env.STRICT && bad2.length + badArt.length + badIn.length) process.exit(1);
