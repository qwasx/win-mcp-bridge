// 第 4 阶段（s4-content）：功法 · 法宝 · 神通扩充的测试
// 覆盖：数量与去重、四层数据表引用完整、各地掉落确实不同、十二种新出手方式能打出伤害、套路与五行相生生效、功法学修与代价
// 用法：npx tsx tools/test-canon.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const { ENEMIES } = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const { ITEM_LIST, ITEMS, itemDef } = await import('../src/data/items');
const { ART_LIST, ARTS } = await import('../src/data/arts');
const { GONGFA } = await import('../src/data/skills');
const C = await import('../src/world/cultivation');
const M = await import('../src/data/market');
const { lootPool, rollLoot, poolOverlap } = await import('../src/data/canon/loot');
const { regionOfItem } = await import('../src/data/canon/rules');
const { SECTS, SECT_LIST } = await import('../src/data/canon/sects');
const { PEOPLE } = await import('../src/data/canon/people');
const { FACTIONS } = await import('../src/data/canon/factions');
const { ART_META, NEW_KINDS, GEN_COUNT } = await import('../src/data/canon/artgen');
const { COMBOS } = await import('../src/data/canon/combos');
const GF = await import('../src/world/gongfa');
const { mulberry32 } = await import('../src/core/rng');

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };

// ---------------------------------------------------------------- 数量与去重
const arts = ITEM_LIST.filter((i) => i.type === 'artifact');
const gfN = Object.keys(GONGFA).length;
ok(gfN >= 100, `功法 ${gfN} 门（≥100）`);
ok(ART_LIST.length >= 250, `法术神通 ${ART_LIST.length} 门（≥250）`);
ok(arts.length >= 600, `法宝法器 ${arts.length} 件（≥600，其中生成 ${GEN_COUNT}）`);
const names = new Map<string, string>(); const dupN: string[] = [];
for (const it of ITEM_LIST) { if (names.has(it.name)) dupN.push(`${it.id}/${names.get(it.name)} ${it.name}`); names.set(it.name, it.id); }
ok(dupN.length === 0, `物品名无重复 ${dupN.slice(0, 5).join(' ')}`);
ok(new Set(ART_LIST.map((a) => a.id)).size === ART_LIST.length && new Set(ART_LIST.map((a) => a.name)).size === ART_LIST.length, '法术 id / 名字无重复');
const kinds = new Set(arts.map((i) => i.art!.kind));
ok(NEW_KINDS.every((k) => kinds.has(k)), `十二种新出手方式都有法器（共 ${kinds.size} 种出手方式）`);
const cats = { main: 0, aux: 0, secret: 0 } as Record<string, number>; const auxK = new Set<string>();
for (const g of Object.values(GONGFA)) { cats[g.cat ?? 'main']++; if (g.auxKind) auxK.add(g.auxKind); }
ok(cats.main >= 50 && cats.aux >= 20 && cats.secret >= 8 && auxK.size === 9, `主修 ${cats.main} · 辅修 ${cats.aux}（九门齐全：${auxK.size}）· 秘术 ${cats.secret}`);
// 生成的名字不能是“随机拼字”：长度 2～7，不出现同一个字连写
const badName = arts.filter((i) => i.id.startsWith('gen_') && (i.name.length < 2 || i.name.length > 7 || /(.)\1/.test(i.name)));
ok(badName.length === 0, `生成名长度合宜、无叠字 ${badName.slice(0, 4).map((i) => i.name).join(' ')}`);

// ---------------------------------------------------------------- 四层数据表引用完整
const bad: string[] = [];
for (const s of SECT_LIST) {
  if (!FACTIONS[s.faction]) bad.push(`${s.id} 势力 ${s.faction}`);
  if (!GONGFA[s.gongfa]) bad.push(`${s.id} 功法 ${s.gongfa}`);
  for (const a of s.arts) if (!ARTS[a]) bad.push(`${s.id} 法术 ${a}`);
  for (const a of s.extra ?? []) if (!GONGFA[a]) bad.push(`${s.id} 辅修 ${a}`);
  for (const a of s.gear) if (!ITEMS[a]) bad.push(`${s.id} 法器 ${a}`);
  if (!s.treasure || !ITEMS[s.treasure]) bad.push(`${s.id} 镇宗之宝 ${s.treasure}`);
  else if (!M.canonOwned(s.treasure)) bad.push(`${s.id} 镇宗之宝竟然外卖 ${s.treasure}`);
  if (s.arts.length < 3 || s.arts.length > 6) bad.push(`${s.id} 法术数 ${s.arts.length}`);
}
for (const p of PEOPLE) { if (!SECTS[p.sect]) bad.push(`${p.id} 宗门 ${p.sect}`); if (!ARTS[p.sig]) bad.push(`${p.id} 神通 ${p.sig}`); if (!GONGFA[p.gongfa]) bad.push(`${p.id} 功法 ${p.gongfa}`); for (const t of p.treasure) if (!ITEMS[t]) bad.push(`${p.id} 法宝 ${t}`); }
for (const g of Object.values(GONGFA)) { if (g.sig && !ARTS[g.sig]) bad.push(`功法 ${g.id} 神通 ${g.sig}`); if (g.secretArt && !ARTS[g.secretArt]) bad.push(`功法 ${g.id} 秘术 ${g.secretArt}`); if (!ITEM_LIST.some((i) => i.scroll?.gongfa === g.id)) bad.push(`功法 ${g.id} 无玉简`); }
ok(bad.length === 0, `地域 → 势力 → 宗门 → 人物 引用完整（${SECT_LIST.length} 宗门、${PEOPLE.length} 人物）${bad.slice(0, 6).join('；')}`);
const regions = new Set(SECT_LIST.map((s) => s.region));
ok(regions.size === 3 && SECT_LIST.filter((s) => s.region === 'tiannan').length >= 15, `三地都有宗门，天南 ${SECT_LIST.filter((s) => s.region === 'tiannan').length} 家`);
ok(['南宫婉', '温天仁', '蛮胡子', '六道极圣', '乾老魔', '极阴祖师'].every((n) => PEOPLE.some((p) => p.name === n)), '第一批原著人物配装齐全');

// ---------------------------------------------------------------- 各地掉落确实不同
const T = 3;
const pTN = lootPool('tiannan', undefined, T, 'art'), pLX = lootPool('luanxing', undefined, T, 'art'), pDJ = lootPool('dajin', undefined, T, 'art');
const oTL = poolOverlap(pTN, pLX), oTD = poolOverlap(pTN, pDJ);
ok(oTL < 0.35 && oTD < 0.35, `三地掉落重合度（按几率）：天南-乱星海 ${(oTL * 100).toFixed(0)}% · 天南-大晋 ${(oTD * 100).toFixed(0)}%（<35%）`);
let foreignHi = 0, owned = 0, lowForeign = 0, N = 3000;
const rr = mulberry32(7);
for (let i = 0; i < N; i++) {
  const id = rollLoot('luanxing', undefined, 4, rr, 'art'); if (!id) continue;
  const it = itemDef(id), reg = regionOfItem(it, M.ruleOf(it));
  if (M.canonOwned(id)) owned++;
  if (reg && !reg.includes('luanxing')) { if (it.tier >= 2) foreignHi++; else lowForeign++; }
}
ok(foreignHi === 0, `乱星海掉不出外地的中品以上法器（${N} 次，外地大路货 ${lowForeign} 件）`);
ok(owned === 0, '随机掉落不出有主之宝 / 镇宗之宝');
const hf = lootPool('tiannan', 'huangfeng', 3, 'art'), gl = lootPool('tiannan', 'guiling', 3, 'art');
const hfTop = hf.slice(0, 6).map(([id]) => itemDef(id).name), glTop = gl.slice(0, 6).map(([id]) => itemDef(id).name);
const top = (p: [string, number][]) => new Set(p.slice(0, 10).map(([i]) => i)); const th = top(hf), tg = top(gl);
ok(hf[0][0] !== gl[0][0] && [...th].filter((i) => tg.has(i)).length <= 2, `黄枫谷地界常掉 ${hfTop.join('、')}；鬼灵门地界常掉 ${glTop.join('、')}`);
const hfS = lootPool('tiannan', 'huangfeng', 4, 'spell'), forbid = hfS.filter(([id]) => { const r = M.ruleOf(itemDef(id)); return r.homes && !r.homes.includes('huangfeng'); });
ok(forbid.length === 0, `黄枫谷地界掉不出别派秘传 ${forbid.slice(0, 3).map(([i]) => i).join(' ')}`);
const hfSect = hfS.filter(([id]) => (M.ruleOf(itemDef(id)).homes ?? []).includes('huangfeng'));
ok(hfSect.length > 0, `黄枫谷地界能掉本门法术：${hfSect.slice(0, 4).map(([id]) => itemDef(id).name).join('、')}`);

// ---------------------------------------------------------------- 实战：新出手方式
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'qixuan')!;
g.hero.realm = 3; g.hero.stage = 1;
g.teleport(l.x * WORLD_SCALE + 900, l.y * WORLD_SCALE + 600);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let spawned: any[] = [];
const spawn = (n = 5, hp = 1) => { g.combat.enemies = []; spawned = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const e = new Enemy(ENEMIES.wolf, g.player.x + 280 + Math.cos(a) * 110, g.player.y + Math.sin(a) * 70, 2, 3); e.maxHp = e.hp = e.maxHp * 30 * hp; e.aggro = true; e.skT = 99; (e as any).atkT = 99; g.combat.enemies.push(e); spawned.push(e); } };
const run = (sec: number) => { for (let i = 0; i < sec * 30; i++) { g.hero.hp = 1; g.hero.mp = 1; for (const e of g.combat.enemies) { (e as any).skT = 99; } g.update(1 / 30); if (i % 4 === 0) g.renderer.render(1 / 30); } };
const dealt = () => spawned.reduce((s: number, e: any) => s + (e.maxHp - Math.max(0, e.hp)), 0);
function castOnce(id: string, sec = 5) {
  spawn(); C.addItem(g.hero, id, 1); g.combat.cds.clear(); (g.combat as any).shield = null;
  g.combat.castArtifact(id); run(sec); return dealt();
}
for (const k of NEW_KINDS) {
  const id = arts.find((i) => i.art!.kind === k && i.tier === 2 && i.id.startsWith('gen_tn'))?.id ?? arts.find((i) => i.art!.kind === k)!.id;
  const px = g.player.x;
  const d = castOnce(id, k === 'puppet' || k === 'disk' ? 7 : 5);
  ok(d > 0 && isFinite(d) && isFinite(g.player.x), `出手方式·${k}（${itemDef(id).name}）打出伤害 ${Math.round(d)}${k === 'shuttle' ? `，人随梭走 ${Math.round(Math.abs(g.player.x - px))}` : ''}`);
}
// 伞挡：挡下飞来的法术
spawn(); const um = arts.find((i) => i.art!.kind === 'umbrella')!.id; C.addItem(g.hero, um, 1); g.combat.cds.clear(); g.combat.castArtifact(um);
ok(g.combat.shield?.art === um, '伞挡：撑伞时有护盾');
// 葫芦：残血者收入葫中
spawn(4, 0.05); const four = [...g.combat.enemies]; for (const e of four) e.hp = e.maxHp * 0.1;
const gid = arts.find((i) => i.art!.kind === 'gourd' && i.tier >= 2)!.id; C.addItem(g.hero, gid, 1); g.combat.cds.clear(); g.combat.castArtifact(gid); run(3);
ok(four.filter((e) => e.dead).length >= 2, `葫芦收摄：残血者被收入葫中（${four.filter((e) => e.dead).length}/4）`);

// ---------------------------------------------------------------- 套路搭配
const fanFire = arts.find((i) => i.art!.kind === 'fan' && i.art!.element === 'fire' && i.tier >= 2) ?? arts.find((i) => i.art!.kind === 'fan')!;
g.hero.gongfa = 'generic';
const m0 = GF.artMods(g.hero, fanFire.id, fanFire.art!);
const base = castOnce(fanFire.id, 1.5);
g.hero.gongfa = 'jiuyanggong';
const m1 = GF.artMods(g.hero, fanFire.id, fanFire.art!);
const withC = castOnce(fanFire.id, 1.5);
ok(m1.combos.includes('风助火势') && !m0.combos.length && withC > base * 1.2, `套路·风助火势（九阳焚天功 + ${fanFire.name}）：伤害 ${Math.round(base)} → ${Math.round(withC)}`);
g.hero.gongfa = 'qianzhujing'; g.hero.gfAux = ['dayan'];
const pup = arts.find((i) => i.art!.kind === 'puppet')!;
ok(GF.artMods(g.hero, pup.id, pup.art!).addPieces === 1, '套路·大衍傀儡术：一次放出两具傀儡');
g.hero.gongfa = 'suonv'; g.hero.gfAux = [];
const zz = itemDef(SECTS.yanyue.treasure);
ok(GF.artMods(g.hero, zz.id, zz.art!).combos.includes('同门心法'), `套路·同门心法（素女轮回功 + ${zz.name}）`);
const iceArt = arts.find((i) => i.art!.element === 'ice' && i.art!.kind === 'mirror')!;
ok(GF.artMods(g.hero, iceArt.id, iceArt.art!).freeze === true, `套路·冰魄寒光（素女轮回功 + ${iceArt.name}）必定冰封`);
ok(COMBOS.length >= 10, `套路共 ${COMBOS.length} 组`);
// 五行相生：木→火
g.hero.gongfa = 'generic';
GF.wuxingChain(g, 'wood'); const kSheng = GF.wuxingChain(g, 'fire'); const kBreak = GF.wuxingChain(g, 'water');
ok(kSheng > 1 && kBreak === 1, `五行相生：木生火 ×${kSheng.toFixed(2)}，火→水断链 ×${kBreak}`);

// ---------------------------------------------------------------- 功法：学修、灵根、辅修、秘术代价
const h = g.hero;
h.realm = 2; h.stage = 1; h.gongfa = 'changchun'; h.gfAux = []; h.gfKnown = []; h.root = 'fake'; h.rootWx = undefined;
const r0 = C.expPerDay(h);
C.addItem(h, 'scroll_gf_chiyanjue', 1); g.learnScroll('scroll_gf_chiyanjue');
ok((h.gfKnown ?? []).includes('chiyanjue'), '主修玉简录入识海');
GF.switchMain(g, 'chiyanjue'); const rFire = C.expPerDay(h);
GF.switchMain(g, 'ruijinjue' in GONGFA ? 'ruijinjue' : 'chiyanjue'); h.gfKnown!.push('ruijinjue'); h.gongfa = 'ruijinjue'; const rMetal = C.expPerDay(h);
ok(rFire > rMetal, `灵根适配：伪灵根（木水火土）修赤炎诀 ${rFire.toFixed(1)}/日 > 修锐金诀 ${rMetal.toFixed(1)}/日（长春功 ${r0.toFixed(1)}）`);
const hp0 = C.heroStats(h).hp;
C.addItem(h, 'scroll_gf_tongpi', 1); g.learnScroll('scroll_gf_tongpi');
ok((h.gfAux ?? []).includes('tongpi') && C.heroStats(h).hp > hp0, `辅修·炼体：气血 ${hp0} → ${C.heroStats(h).hp}`);
C.addItem(h, 'scroll_gf_yanghunjing', 1); ok(!g.learnScroll('scroll_gf_yanghunjing'), '筑基只能辅修一门');
h.realm = 3; C.addItem(h, 'scroll_gf_ms_ranxue', 1); g.learnScroll('scroll_gf_ms_ranxue');
const lost0 = h.lifeLost; spawn(); g.combat.cds.clear(); h.hp = 1; g.combat.cast('ranxue');
ok(h.arts.some((a) => a.id === 'ranxue') && h.lifeLost === lost0 + 1, `秘术·燃血术：习得并折寿一载（${lost0} → ${h.lifeLost}）`);
h.gongfa = 'jiuyanggong'; h.realm = 3; h.arts = h.arts.filter((a) => a.id !== 'fentian'); GF.checkSig(g);
ok(h.arts.some((a) => a.id === 'fentian'), '主修九阳焚天功，结丹后自悟专属神通「焚天印」');
// 路子：火修施展火法更痛
spawn(); h.gongfa = 'generic'; const k0 = GF.gfSkillMul(g, ARTS.huolong); h.gongfa = 'jiuyanggong'; const k1 = GF.gfSkillMul(g, ARTS.huolong);
ok(k1 > k0, `主修路子：九阳焚天功施展火龙术 ×${(k1 / k0).toFixed(2)}`);
// 所有新法术都能放出来不报错
let castBad = 0;
h.realm = 4;
for (const s of ART_LIST.slice(114)) { try { spawn(2); h.arts.push({ id: s.id, xp: 0 }); g.combat.cds.clear(); h.mp = 1; h.hp = 1; g.combat.cast(s.id); run(0.4); } catch (e) { castBad++; console.log('  cast', s.id, (e as Error).message); } }
ok(castBad === 0, `新增 ${ART_LIST.length - 114} 门法术逐一施展无报错`);

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
