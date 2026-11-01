// 第四十五步「天道」节奏模拟：按几种玩法推算筑基 / 结丹 / 元婴的年纪（SRC=旧版源码目录 可做对比）
const SRC = process.env.SRC ?? '../src';
const C: any = await import(SRC + '/world/cultivation.ts');
const RL: any = await import(SRC + '/data/realms.ts');
const NEW = !!C.wuTake;
type Prof = { root: string; gf2: string; talents: string[]; place: number; active: number; pills: number; kills: number };
function sim(o: Prof) {
  const h = C.newHero(); h.root = o.root; h.talents = o.talents; const out: any[] = [];
  let key = '', used = 0; const ages: Record<string, number> = {};
  for (let m = 0; m < 12 * 700 && !h.dead; m++) {
    if (h.realm >= 2) h.gongfa = o.gf2;
    const k = h.realm + ':' + h.stage; if (k !== key) { key = k; used = 0; }
    const pid = ['pill_juqi', 'pill_juqi', 'pill_juling', 'pill_ningyuan', 'pill_peiying'][h.realm];
    while (used < o.pills && C.bottleneck(h) === 'none') { C.addItem(h, pid, 1); C.usePill(h, pid, out); used++; }
    C.passDays(h, 30 * (1 - o.active), true, o.place, out);
    if (o.active > 0) {
      C.passDays(h, 30 * o.active, false, 1, out);
      for (let i = 0; i < Math.round(o.kills * o.active); i++) C.gainExp(h, NEW ? C.need(h) * 0.0004 * 1.3 : C.need(h) * 0.0045 * 1.3, out);
      for (let i = 0; i < 2; i++) if (Math.random() < o.active) C.gainExp(h, C.need(h) * C.INSIGHT * 0.08, out);
    }
    const bn = C.bottleneck(h);
    if (bn === 'small') { const b = RL.smallBottleneck(h.realm, h.stage); C.addItem(h, b.item, b.count * 2); C.tryBreak(h, b.count * 2); }
    if (bn === 'major') { const mb = RL.MAJOR_BREAKS[h.realm]; if (mb.item) C.addItem(h, mb.item, mb.maxItems); const r = C.tryBreak(h, mb.maxItems, 0.05); if (r.ok) { ages[RL.REALMS[h.realm].name] = h.age; if (h.realm >= 4) break; } }
  }
  return { ages, dead: h.dead ? h.age : 0 };
}
const P: Record<string, Prof> = {
  '苦修派（伪灵根·宗门打坐·不吃丹·不出门）': { root: 'fake', gf2: 'qingyuan', talents: [], place: 1.2, active: 0, pills: 0, kills: 0 },
  '韩立式（伪灵根·洞府灵脉·每层三颗丹·一半时间在外闯荡）': { root: 'fake', gf2: 'qingyuan', talents: [], place: 2.2, active: 0.5, pills: 3, kills: 25 },
  '天骄式（真灵根·悟道+天选·上品洞府·每层五颗丹·三成时间在外猎杀）': { root: 'true', gf2: 'qingyuan', talents: ['t_wudao', 't_tianxuan'], place: 2.6, active: 0.3, pills: 5, kills: 60 },
  '狂刷派（伪灵根·一直在外打怪奇遇·不闭关）': { root: 'fake', gf2: 'qingyuan', talents: [], place: 1, active: 1, pills: 3, kills: 80 },
};
console.log(NEW ? '== v0.45 天道 ==' : '== v0.43 旧版 ==', '（17 岁炼气五层起步，20 次取平均）');
for (const [n, o] of Object.entries(P)) {
  const R = Array.from({ length: 20 }, () => sim(o)), avg = (k: string) => { const v = R.map((r) => r.ages[k]).filter((x) => x); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) + (v.length < 20 ? `(${v.length}/20)` : '') : '—'; };
  console.log(`${n}\n    筑基 ${avg('筑基')} 岁 · 结丹 ${avg('结丹')} 岁 · 元婴 ${avg('元婴')} 岁${R.some((r) => r.dead) ? ` · 坐化 ${R.filter((r) => r.dead).length}/20` : ''}`);
}
