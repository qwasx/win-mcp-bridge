// 第四十九步「人心」验收：npx tsx tools/test-renxin.ts
// 骗局触发率（总体落在 15–25% 附近、谨慎者几乎不骗、狠辣贪婪高发）、表里规则、读心门槛、
// 战败分类、搜袋比例（70–100%）、赃物流散（去晚了东西真没了）、道伤区间、阅历破绽曲线
import * as R from '../src/world/renxin-core';
import type { Pers } from '../src/world/npc';

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const pct = (x: number) => (x * 100).toFixed(1) + '%';
const N = 200000;

console.log('一、骗局触发率（钩子事件里有多少是局）');
const rate: Record<string, number> = {};
for (const k of ['partner', 'knife', 'possess', 'stall'] as R.ScamKind[]) {
  let s = 0; for (let i = 0; i < N; i++) if (R.rollHook(k).scam) s++;
  rate[k] = s / N; console.log(`    ${R.SCAM_NAME[k]}：${pct(rate[k])}`);
}
ok(rate.partner > 0.15 && rate.partner < 0.25, '合作探宝：15–25%（大半是真心邀约）');
ok(rate.knife > 0.17 && rate.knife < 0.3, '借刀杀人：17–30%');
ok(Math.abs(rate.possess - 0.3) < 0.01, '夺舍老魔：约 30%');
ok(Math.abs(rate.stall - 0.7) < 0.01, '三折地摊：约 70%（天上不掉馅饼）');
let rich = 0; for (let i = 0; i < N; i++) if (R.rollHook('partner', Math.random, 1).scam) rich++;
ok(rich / N > rate.partner * 1.25, `储物袋越肥越招人惦记（满袋时 ${pct(rich / N)}）`);

console.log('二、按性格');
const byP: Record<string, [number, number]> = {};
for (let i = 0; i < N; i++) { const r = R.rollHook('partner'); const v = byP[r.pers] ?? (byP[r.pers] = [0, 0]); v[0]++; if (r.scam) v[1]++; }
for (const p in byP) console.log(`    ${R.PERS_CN[p as Pers]}：${pct(byP[p][1] / byP[p][0])}`);
ok(byP.righteous[1] === 0 && byP.kind[1] === 0, '正直 / 温和者从不设局');
ok(byP.cautious[1] / byP.cautious[0] < 0.05, '谨慎者几乎不骗');
ok(byP.ruthless[1] / byP.ruthless[0] > 0.6, '狠辣者高发');
ok(byP.greedy[1] / byP.greedy[0] > 0.35, '贪婪者高发');

console.log('三、表里');
ok(R.maskOf('righteous', -50) === 0 && R.maskOf('aloof', 30) === 0, '正直 / 淡泊：表里如一');
ok(R.shownOf(-60, R.maskOf('ruthless', -60)) >= 0, `狠辣者恨你入骨（-60），脸上却在笑（${R.shownOf(-60, R.maskOf('ruthless', -60))}）`);
ok(R.maskOf('greedy', 0, true) > R.maskOf('greedy', 0), '心怀鬼胎时格外殷勤');
ok(R.maskOf('ruthless', -60, false, 1) === 0, '已结仇的不装了');
ok(R.maskOf('arrogant', 20) < 0, '傲慢者把冷脸挂在外头');
const d0: any = { pers: 'ruthless', favor: -40, grudge: 0, seed: 7, realm: 2, stage: 1 };
ok(R.disguisePers(d0) !== 'ruthless', `狠辣者演成「${R.PERS_CN[R.disguisePers(d0)]}」`);
ok(R.maskFor({ ...d0, canon: true }) === 0 && R.maskFor({ ...d0, bond: 'sworn' }) === 0, '原著人物 / 结拜兄弟不另起一张脸');

console.log('四、读心门槛');
ok(R.readLevel(3, { realm: 1, pers: 'greedy' }) === 1, '高出两个大境界：看得见真心');
ok(R.readLevel(2, { realm: 1, pers: 'greedy' }) === 0, '只高一个大境界：看不穿');
ok(R.readLevel(2, { realm: 1, pers: 'greedy' }, 1) === 1, '……但他正被你的威压镇着：看得穿');
ok(R.readLevel(5, { realm: 3, pers: 'ruthless' }, 2) === 0, '老怪物（结丹+狠辣）被压着也在演');
ok(R.readLevel(1, { realm: 0, pers: 'greedy' }) === 1, '凡人瞒不过修士');

console.log('五、败北分类');
ok(R.classifyFoe(null) === 'beast' && R.classifyFoe({ human: false, evil: true, grudge: 0 }) === 'beast', '妖兽 / 鬼物');
ok(R.classifyFoe({ human: true, evil: false, grudge: 0 }) === 'robber', '劫修 / 仇家');
ok(R.classifyFoe({ human: true, evil: true, grudge: 0 }) === 'demon', '魔修');
ok(R.classifyFoe({ human: true, evil: true, grudge: 2 }) === 'nemesis' && R.classifyFoe({ human: true, evil: false, grudge: 0, pursuer: true }) === 'nemesis', '死敌 / 亲自追杀者');

console.log('六、搜袋与赃物流散');
const bag: R.Stack[] = Array.from({ length: 20 }, (_, i) => ({ id: i === 0 ? 'art_keep' : 'it' + i, n: 1 + (i % 4) }));
let taken = 0, kept = true; const T = 20000;
for (let i = 0; i < T; i++) { const r = R.stealPlan(bag, (id) => id === 'art_keep'); taken += r.take.length / 19; if (r.take.some((s) => s.id === 'art_keep')) kept = false; if (r.frac < 0.7 || r.frac > 1) kept = false; }
ok(taken / T > 0.78 && taken / T < 0.92, `平均搜走 ${pct(taken / T)} 的格子（每次 70–100%）`);
ok(kept, '装备栏 / 快捷栏里的法宝不会被搜走');
const surv = (days: number) => { let s = 0; for (let i = 0; i < T; i++) s += R.decayStolen(bag, 1000, days).items.length / bag.length; return s / T; };
const s7 = surv(7), s30 = surv(30), s90 = surv(90);
console.log(`    七日后还在他手里：${pct(s7)}　一月后：${pct(s30)}　三月后：${pct(s90)}`);
ok(s7 > 0.7 && s30 > 0.2 && s30 < 0.4 && s90 < 0.05, '越晚追回，东西越少；拖上三个月基本卖光');
ok(R.decayStolen([], 1000, 30).ls < 420 && R.decayStolen([], 1000, 30).ls > 380, '灵石每天花掉约 3%');

console.log('七、道伤');
const rng = (c: R.FoeClass) => { let lo = 1e9, hi = 0; for (let i = 0; i < 5000; i++) { const v = R.dsDays(c); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
const [b0, b1] = rng('beast'), [n0, n1] = rng('nemesis');
ok(b0 >= 7 && b1 <= 20, `妖兽：${b0}–${b1} 日`);
ok(n0 >= 40 && n1 <= 60, `死敌：${n0}–${n1} 日`);
ok(R.DS_EXP === 0.6 && R.DS_MP === 0.8 && R.DS_MED > 1, '修炼 -40%、法力上限 -20%、闭关愈合更快');

console.log('八、阅历：吃一堑长一智');
ok(R.flawChance(0) < R.flawChance(1) && R.flawChance(1) < R.flawChance(2), `破绽：头一回 ${pct(R.flawChance(0))} → 吃过一次亏 ${pct(R.flawChance(1))} → 两次 ${pct(R.flawChance(2))}`);
ok(R.flawChance(99) <= 0.75, '封顶七成半（老江湖也有走眼的时候）');

console.log(fail ? `\n失败 ${fail} 项` : '\n全部通过');
process.exit(fail ? 1 : 0);
