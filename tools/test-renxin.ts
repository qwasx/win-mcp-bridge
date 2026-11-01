// 第四十七步「人心」自检：表里系统 / 读心规则 / 道伤数学 / 假丹药 / 骗局触发率
// 运行：npx tsx tools/test-renxin.ts
const C: any = await import('../src/world/cultivation.ts');
const R: any = await import('../src/world/renxin.ts');
const IT: any = await import('../src/data/items.ts');

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
const npc = (o: any) => ({ id: 'x', name: '某人', sex: 'm', role: 'cultivator', realm: 1, stage: 3, faction: 'rogue', home: 'a', pers: 'greedy', favor: 0, grudge: 0, met: true, alive: true, age: 30, life: 100, x: 0, y: 0, tx: 0, ty: 0, goal: 'stay', until: 0, wealth: 50, seed: 12345, ...o });
const fakeGame = (realm: number) => ({ hero: { ...C.newHero(), realm } });

console.log('一、表里：两张脸');
{
  const a = npc({ pers: 'greedy', favor: -30, plan: { k: 'rob' } });
  ok(R.shownFavor(a) > a.favor + 10, `贪婪者盯着你的储物袋时，表演态度 ${R.shownFavor(a)} > 真实态度 ${a.favor}`);
  const b = npc({ pers: 'righteous', favor: -30, grudge: 1 });
  ok(R.shownFavor(b) === b.favor, `正直者不装：表演 ${R.shownFavor(b)} = 真实 ${b.favor}`);
  const c = npc({ pers: 'ruthless', favor: -90, grudge: 2 });
  ok(R.isMasking(c), '狠辣的死敌也能笑脸相迎（isMasking）');
  const d = npc({ pers: 'greedy', favor: 20 });
  ok(!R.isMasking(d), '没有藏着恶意的贪婪者不算在装');
}
console.log('二、读心规则');
{
  ok(R.seesTruth(fakeGame(3), 1, 'greedy', 0), '结丹看炼气：境界高出两个大境界 → 看穿');
  ok(!R.seesTruth(fakeGame(2), 1, 'greedy', 0), '筑基看炼气（无压制）→ 看不穿');
  ok(R.seesTruth(fakeGame(2), 1, 'greedy', 1), '筑基压制住炼气 → 看穿');
  ok(!R.seesTruth(fakeGame(4), 3, 'ruthless', 2), '元婴压制结丹狠辣老怪 → 仍看不穿（老怪连被压制时的心声都是假的）');
  ok(R.seesTruth(fakeGame(5), 3, 'ruthless', 0), '化神看结丹老怪：差两个大境界 → 看穿');
}
console.log('三、道伤');
{
  const h = C.newHero(); h.realm = 2; h.stage = 1;
  const base = C.expPerDay(h), mp0 = C.heroStats(h).mp;
  h.hurt = 30; h.hurtLv = 1;
  ok(Math.abs(C.expPerDay(h) / base - 0.6) < 1e-6, `道伤在身：修炼 ${(C.expPerDay(h) / base * 100).toFixed(0)}%`);
  ok(C.heroStats(h).mp < mp0, `法力上限 ${mp0} → ${C.heroStats(h).mp}`);
  const out: any[] = [];
  C.passDays(h, 10, true, 1, out); ok(Math.abs((h.hurt ?? 0) - 10) < 1e-6, `闭关 10 日养伤两倍速：剩 ${h.hurt} 日`);
  C.passDays(h, 10, false, 1, out); ok((h.hurt ?? 0) === 0 && !!out.find((m) => /痊愈/.test(m.text)), '再过 10 日痊愈，有提示');
  ok(Math.abs(C.expPerDay(h) - base) < 1e-6, '痊愈后修炼速度恢复');
  h.hurt = 20; C.addItem(h, 'pill_liaoshang', 1); C.usePill(h, 'pill_liaoshang', out);
  ok((h.hurt ?? 0) === 10, `疗伤丹缩短道伤：20 → ${h.hurt} 日`);
}
console.log('四、假丹药');
{
  const f = IT.itemDef('pill_zhuji_fake'), t = IT.itemDef('pill_zhuji');
  ok(f.name === t.name && f.desc === t.desc && f.glyph === t.glyph, '赝品看着和真货一模一样');
  ok(!IT.ITEM_LIST.some((d: any) => d.fake), '赝品不进任何货单 / 掉落池');
  const h = C.newHero(); h.hp = 1; const out: any[] = [];
  C.addItem(h, 'pill_zhuji_fake', 1); C.usePill(h, 'pill_zhuji_fake', out);
  ok(h.hp < 1 && out.some((m) => /淬体丹/.test(m.text)), `服下才知：${out.map((m) => m.text).join(' / ')}`);
  ok(C.bagCount(h, 'pill_zhuji') === 0, '赝品不计入筑基丹数目（冲关时才发现白买了）');
}
console.log('五、骗局触发率（性格分布 × 说谎概率的期望）');
{
  const pers = ['ruthless', 'greedy', 'greedy', 'cautious', 'righteous', 'kind', 'arrogant'];
  const liar: Record<string, number> = { ruthless: 0.8, greedy: 0.65, arrogant: 0.3, cautious: 0.15, righteous: 0.03, kind: 0.03 };
  const lieRate = pers.reduce((a, p) => a + liar[p], 0) / pers.length;
  const scamShare = 0.22;
  console.log(`  合作探宝：抽到骗局事件 ${Math.round(scamShare * 100)}% × 其中真要翻脸 ${Math.round(lieRate * 100)}% → 同类奇遇里约 ${(scamShare * lieRate * 100).toFixed(0)}% 是真骗局，其余是真心人`);
  ok(scamShare * lieRate > 0.05 && scamShare * lieRate < 0.15, '保持怀疑但不至于草木皆兵（5–15%）');
  const jl: any = { hero: C.newHero(), day: 10, ws: { flags: {} }, toast: () => {} };
  R.addJingLi(jl, 'partner', '一'); ok(Math.abs(R.jingLiBonus(jl, 'partner') - 0.25) < 1e-9, '吃过一次亏：辨识 +25%');
  R.addJingLi(jl, 'partner', '二'); ok(Math.abs(R.jingLiBonus(jl, 'partner') - 0.35) < 1e-9, '吃过两次亏：辨识 +35%');
}
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
