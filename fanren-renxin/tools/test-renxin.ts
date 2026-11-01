// 第四十七步：人心 · 冒烟测试
// 跑法：npx tsx tools/test-renxin.ts
// 覆盖：表里（guise / shown）、读心判定、Rumor 真假与印证、骗局池抽取、阅历与江湖信义
import { Deceit, rollScam, scamChance } from '../src/world/deceit';
import { SCAM_DEFS, SCAM_LORE } from '../src/data/scams';

let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };

function fakeGame() {
  const toasts: string[] = [];
  const g: any = {
    hero: { realm: 2, stage: 4, hp: 1, mp: 1 },
    ws: { cred: 60, rumors: [], exp2: [], seenScams: {}, flags: {}, rep: 0 },
    day: 1234, time: 0, player: { x: 0, y: 0 },
    toasts,
    toast: (s: string) => toasts.push(s),
    hint: () => {},
    news: () => {},
    openDialog: () => {},
    npcs: { list: [], byId: new Map() },
    rel: null,
    combat: { dropLoot: () => {} },
  };
  return g;
}

const npc = (over: any) => ({ id: 'n1', name: '测试修士', sex: 'm', role: 'cultivator', realm: 2, stage: 1,
  faction: 'rogue', home: 'x', pers: 'greedy', favor: 0, grudge: 0, met: true, alive: true,
  age: 60, life: 120, x: 0, y: 0, tx: 0, ty: 0, goal: 'stay', until: 0, wealth: 10, seed: 42, ...over });

console.log('\n人心 · 冒烟测试');

// 一、表里
{
  const g = fakeGame(); const d = new Deceit(g);
  const greedy = npc({ pers: 'greedy', favor: 10 }) as any;
  const right = npc({ pers: 'righteous', favor: 10 }) as any;
  const s1 = d.shown(greedy), s2 = d.shown(right);
  console.log('  · 贪婪者 shown =', s1, ' 正直者 shown =', s2, '（真实好感均为 10）');
  ok(s1 > s2, '贪婪者的表演好感高于正直者（表里之差由性格驱动）');
  ok(d.guise(right) <= d.guise(greedy), '正直者的伪装值不大于贪婪者');
  const cold = npc({ pers: 'greedy', favor: -40, grudge: 1 }) as any;
  ok(d.shown(cold) > -40, '心里恨你的人，脸上装得没那么冷（仇恨放大伪装）');
}

// 二、读心
{
  const g = fakeGame(); const d = new Deceit(g);
  const weak = npc({ realm: 0 }) as any, strong = npc({ realm: 3, pers: 'ruthless' }) as any;
  ok(d.pierce(weak, 0).ok, '高出两个大境界：看穿（真实心声）');
  ok(d.pierce(npc({}) as any, 1).ok, '神识压制：看穿');
  const old = d.pierce(strong, 1);
  ok(!old.ok && old.spoof, '结丹以上狠辣老魔：连被压制都是假心声');
  const t = d.thought(g, { d: weak, sup: 0 }, '这人的储物袋鼓鼓的……');
  ok(t.real === true && t.text.includes('储物袋'), '被看穿时显示真心声');
  const t2 = d.thought(g, { d: npc({ pers: 'greedy', favor: 5 }) as any, sup: 0 }, '这人的储物袋鼓鼓的……');
  ok(t2.real === false && !t2.text.includes('储物袋'), '没看穿时是表演心声，真念头不剧透');
}

// 三、谎言与情报
{
  const g = fakeGame(); const d = new Deceit(g);
  const r = d.tell({ text: '某处有异宝出世。', truth: 0, src: '说书人', motive: 'bait' });
  ok(g.ws.rumors.length === 1 && r.truth === 0, 'Rumor 入库，真假字段正确');
  for (let i = 0; i < 30; i++) d.tell({ text: 'x' + i, truth: 1, src: 'n', quiet: true });
  ok(g.ws.rumors.length <= 40, '传闻上限 40 条，不会无限堆积');
  ok(typeof scamChance('ruthless') === 'number' && scamChance('ruthless') > scamChance('cautious'), '狠辣者行骗概率高于谨慎者');
}

// 四、骗局池
{
  const seen: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (let i = 0; i < 800; i++) { const id = rollScam(seen, 3); if (id) counts[id] = (counts[id] ?? 0) + 1; }
  const ids = Object.keys(counts);
  ok(ids.length >= 3, `骗局池会轮换（800 次抽样出现 ${ids.length} 种）`);
  seen.coop = 99;
  const c2: Record<string, number> = {};
  for (let i = 0; i < 500; i++) { const id = rollScam(seen, 3); if (id) c2[id] = (c2[id] ?? 0) + 1; }
  ok((c2.coop ?? 0) < (counts.coop ?? 0) * 0.5, '吃过一次亏的骗局会降权');
  ok(rollScam({}, 0) !== 'seize', '低境界遇不到夺舍老魔（minRealm 门槛）');
  ok(SCAM_DEFS.length === 5 && SCAM_LORE.length === 7, '骗局模板 5 条已上线，7 条入传闻');
}

// 五、阅历与信义
{
  const g = fakeGame(); const d = new Deceit(g);
  d.addExp('曾被假藏宝图诱入伏击', 'taken');
  d.addExp('识破过一次借刀杀人', 'seen');
  ok(d.hasExp('假藏宝图') && d.exps().length === 2, '阅历入册，可按关键字检索');
  ok(d.hasExp('借刀'), '识破记录同样入册（下次对话会有破绽提示）');
  const c0 = d.cred;
  d.addCred(-10, '卖假货');
  ok(d.cred === c0 - 10, '江湖信义记账');
  d.addCred(200, '');
  ok(d.cred === 100, '信义上限 100');
  ok(typeof d.credName() === 'string', '信义有称号：' + d.credName());
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
