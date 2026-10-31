import { REALMS, expNeed } from '../src/data/realms';
const DAY_PER_YEAR = 360;
function acc(rate: number, stopRealm: number, stopStage: number) {
  let days = 0, last = '';
  for (const r of REALMS.slice(1)) {
    for (let s = 0; s < r.stages.length; s++) {
      days += expNeed(r.id, s) / (10 * rate);
      last = r.name + r.stages[s];
      if (r.id === stopRealm && s === stopStage) return { days, last };
    }
  }
  return { days, last };
}
for (const rate of [0.5, 0.85, 1.0, 1.2, 2.0]) {
  const a = acc(rate, 4, 0);
  console.log(`灵根×功法 rate=${rate.toFixed(2)} → 结婴于第 ${(a.days / DAY_PER_YEAR).toFixed(0)} 年（寿元内可成：${a.days / DAY_PER_YEAR < 500}）`);
}
const r1 = acc(1, 3, 2); console.log('rate=1 结丹大圆满:', (r1.days / DAY_PER_YEAR).toFixed(0), '年');
