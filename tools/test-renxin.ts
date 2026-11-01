// 第四十九步「人心」冒烟测试：npx tsx tools/test-renxin.ts
// 表里（表演好感）、看穿规则、心声真假、战败分类与搜身、赃物到期、假丹露馅、道伤对修炼的影响。
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const R = await import('../src/world/renxin');
const D = await import('../src/world/defeat');
const S = await import('../src/world/scams');
const C = await import('../src/world/cultivation');
const { itemDef } = await import('../src/data/items');

const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// 1. 表里：每个人两张脸
const greedy: any = { seed: 4242, pers: 'greedy', realm: 1, stage: 0, favor: -10, faction: 'rogue', x: 0, y: 0, grudge: 0 };
const righteous: any = { ...greedy, seed: 99, pers: 'righteous' };
ok(R.facadeOf(greedy) === R.facadeOf({ ...greedy }) && R.facadeOf(greedy) >= 0 && R.facadeOf(greedy) < 1, '伪装系数稳定且在 0–1 之间');
ok(R.facadeGap(righteous) === 0, '正直者不装：表演好感 = 真好感');
ok(R.facadeGap(greedy) >= 12, '贪婪者表演得更热情');
ok(R.shownFavor(greedy, false) > greedy.favor, '未看穿：贪婪者对你表现得比真实更热情');
ok(R.shownFavor(greedy, true) === greedy.favor, '看穿后：显示真好感');

// 2. 看穿：两个大境界之差，或神识之内高一境（结丹以上的阴狠老怪除外）
g.hero.realm = 3; g.hero.stage = 0;
ok(R.canPierce(g, { ...greedy, realm: 1 }), '高出两个大境界：看得穿');
g.hero.realm = 2;
const ruthlessElder: any = { ...greedy, pers: 'ruthless', realm: 2, x: g.player.x, y: g.player.y };
ok(!R.canPierce(g, ruthlessElder, 0), '结丹阴狠老怪：即便在神识之内也看不穿');
const ruthlessMid: any = { ...greedy, pers: 'ruthless', realm: 1, x: g.player.x, y: g.player.y };
ok(R.canPierce(g, ruthlessMid, 0), '低一个大境界的阴狠者：神识之内被压制，藏不住');

// 3. 心声：贪婪者看不穿时说的是表演心声；正直者心声即真
g.hero.realm = 1;
const sayer: any = { ...greedy, plan: { k: 'rob', why: '', until: 0 } };
let fakeHits = 0;
for (let i = 0; i < 20; i++) if (!R.mindFor(g, sayer, '这人身上有什么好东西？', 9999).real) fakeHits++;
ok(fakeHits === 20, '贪婪的劫修：看不穿时说的是表演心声');
const honest = R.mindFor(g, { ...righteous, plan: undefined }, '这雨什么时候停……', 9999);
ok(honest.real && honest.text === '这雨什么时候停……', '正直者：心声即真');
ok(R.labelOf('ruthless', '阴狠', false) === '温厚' && R.labelOf('ruthless', '阴狠', true) === '阴狠', '头衔：看不穿时演出温厚，看穿才露出阴狠');

// 4. 战败分类与道伤
const beast: any = { def: { kind: 'beast' }, realm: 1, stage: 0, name: '妖狼' };
const human: any = { def: { kind: 'human' }, realm: 1, stage: 0, name: '劫修' };
ok(D.foeKindOf(g, beast) === 'beast', '妖兽击倒：走路人相救的老路');
ok(D.foeKindOf(g, human) === 'human', '劫修击倒：储物袋被搜');
ok(D.foeKindOf(g, undefined) === 'beast', '无名之害：只伤修为与经脉');
const dd: number[] = []; for (let i = 0; i < 300; i++) dd.push(D.daoDays('beast', 0));
ok(Math.min(...dd) >= 7 && Math.max(...dd) <= 60, '道伤天数落在 7–60 日之间');
ok(D.daoDays('grudge', 0) >= 45, '死敌补刀的道伤更重');

// 5. 战败结算：搜身 + 赃物入账 + 道伤
g.hero.bag = []; C.addItem(g.hero, 'mat_lingshi', 1000); C.addItem(g.hero, 'pill_liaoshang', 10);
g.hero.daoLeft = 0; g.ws.renxin.lost = null;
g.onPlayerDown(human);
const ls = C.bagCount(g.hero, 'mat_lingshi');
ok(ls <= 300, `劫修搜身：灵石被扫走七成以上（剩 ${ls}）`);
ok(!!g.ws.renxin.lost && g.ws.renxin.lost.items.length > 0, '赃物入账，三十日内可寻回');
ok((g.hero.daoLeft ?? 0) >= 14, '战败附道伤');

// 6. 赃物到期：销往坊市，再难寻回
g.ws.renxin.lost!.due = g.day - 1;
D.daily(g, 1);
ok(g.ws.renxin.lost === null, '赃物到期：销往坊市，再难寻回');

// 7. 假丹：外观是筑基丹，服下才露馅
const fake = itemDef(S.FAKE_PILL);
ok(fake.name === '筑基丹' && fake.fakeOf === S.FAKE_PILL_REAL, '假丹外观是筑基丹，真身是淬体丹');
const msgs: any[] = [];
const before = g.ws.renxin.fakeTaken;
S.onPillUsed(g, S.FAKE_PILL, msgs);
ok(g.ws.renxin.fakeTaken === before + 1 && msgs.length === 1, '服下假丹：露馅并记入阅历');

// 8. 道伤对修炼的影响
const h2: any = C.newHero(); h2.daoLeft = 10;
ok(C.expPerDay(h2) < C.expPerDay({ ...h2, daoLeft: 0 }), '道伤期间修为变慢');

// 9. 骗局：事件池刷得出三种骗局，对话与结算都能走通
g.hero.realm = 2; g.hero.stage = 0; g.ws.renxin.lost = null;
const found: any[] = [];
for (let i = 0; i < 600 && new Set(found.map((x) => x.kind)).size < 3; i++) {
  (g.happen as any).haps = []; (g.happen as any).hapT = 0; (g.happen as any).spawn();
  for (const x of (g.happen as any).haps) if (String(x.kind).startsWith('scam_')) found.push(x);
}
const kinds = new Set(found.map((x) => x.kind));
ok(kinds.size === 3, `事件池能刷出三种骗局（${[...kinds].join('、') || '无'}）`);
for (const x of found) ok(!!S.scamNode(g, x)?.options?.length, `${x.kind} 的对话可以打开`);
const v = found.find((x) => x.kind === 'scam_vendor');
if (v) {
  C.addItem(g.hero, 'mat_lingshi', 5000);
  S.scamNode(g, v)!.options![0].act!();
  ok(C.bagCount(g.hero, S.FAKE_PILL) >= 1, '路边摊：买下的「筑基丹」是假的，入袋');
}
const b = found.find((x) => x.kind === 'scam_borrow');
if (b) {
  const before = g.ws.renxin.scamHit;
  S.borrowKilled(g, b);
  ok(g.ws.renxin.scamHit === before + 1, '借刀杀人：报仇结算，记入阅历');
}
const el = found.find((x) => x.kind === 'scam_elder');
if (el) {
  const next = S.scamNode(g, el)!.options![0].act!();
  ok(!!next && !!next.options?.length, '老怪：渡灵的对话可以继续');
}
g.ws.renxin.lost = { items: [['mat_lingshi', 1]], ls: 0, due: g.day + 30, who: '劫修' };
const sp = (g.happen as any).spawnRevenge();
ok(sp === false || (g.happen as any).haps.some((x: any) => x.d.revenge), '寻仇：有赃物时可刷出凶徒（身处安全之地则不刷）');

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
