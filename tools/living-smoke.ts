// 活世界 · 无头冒烟测试：不启动渲染，直接跑模拟，确认这个世界真的自己在转
//   npx tsx tools/living-smoke.ts
import { LivingWorld } from '../src/world/living';
import type { NpcData } from '../src/world/npc';

const SECTS = ['huangfeng', 'yanyue', 'lingshou', 'qingxu', 'guiling', 'tianmo'];
const HOMES = ['yuejing', 'jiayuan', 'qingniu', 'tainan', 'huangfeng', 'yanyue'];
const PERS: any[] = ['righteous', 'greedy', 'cautious', 'arrogant', 'kind', 'ruthless', 'aloof'];

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const list: NpcData[] = [];
const byId = new Map<string, NpcData>();
for (let i = 0; i < 420; i++) {
  const sect = rnd() < 0.45 ? SECTS[Math.floor(rnd() * SECTS.length)] : undefined;
  const home = sect ?? HOMES[Math.floor(rnd() * HOMES.length)];
  const realm = rnd() < 0.5 ? 1 : rnd() < 0.75 ? 2 : rnd() < 0.92 ? 3 : 4;
  const faction: any = sect ? (SECTS.indexOf(sect) >= 4 ? 'demon' : 'sect') : rnd() < 0.3 ? 'mortal' : rnd() < 0.6 ? 'rogue' : 'merchant';
  list.push({
    id: 'n' + i, name: '测试' + i, sex: rnd() < 0.4 ? 'f' : 'm', role: 'cultivator',
    realm: faction === 'mortal' ? 0 : realm, stage: Math.floor(rnd() * 8), faction,
    sect: faction === 'sect' || faction === 'demon' ? sect : undefined, home,
    pers: PERS[Math.floor(rnd() * PERS.length)], favor: 0, grudge: 0, met: false, alive: true,
    age: 20 + rnd() * 200, life: 800, x: 0, y: 0, tx: 0, ty: 0, goal: 'stay', until: 0,
    wealth: Math.round(rnd() * 800), seed: Math.floor(rnd() * 1e9), map: 'tiannan' as any,
  } as NpcData);
  byId.set(list[i].id, list[i]);
}

const news: string[] = [];
const game: any = {
  day: 60, time: 0, ws: { rep: 0 }, hero: { realm: 2, stage: 3, bag: [{ id: 'mat_lingshi', n: 5000 }] },
  player: { x: 0, y: 0 }, news: (t: string) => news.push(t), toast: () => {}, rel: undefined,
  npcs: { list, byId, active: new Map(), die: (d: NpcData, why: string) => { if (!d.alive) return; d.alive = false; d.deathNote = why; } },
};
const LW = new LivingWorld(game);
for (const d of list) LW.attach(d, rnd);
LW.buildAll(rnd);

// 模拟 Relations.genTies：给一部分人挂上真实存在的亲人（游戏里由关系网生成）
let linked = 0;
for (let i = 0; i < list.length - 1 && linked < 80; i += 2) {
  const a = list[i], b = list[i + 1];
  if (a.home !== b.home || !a.alive || !b.alive) continue;
  LW.of(a).kin.push({ t: b.id, name: b.name, r: 'spouse' });
  LW.of(b).kin.push({ t: a.id, name: a.name, r: 'spouse' });
  linked++;
}
console.log('真实亲缘链接：', linked, '对');

// ---- 关键断言 1：无关路人不会来找你（这就是“不明不白扑上来”的解药）
let noReason = 0, withReason = 0;
for (const d of list) { const m = LW.motive(d); if (m) withReason++; else noReason++; }

// ---- 关键断言 2：杀了一个有家小的人，血仇会传到活着的亲人身上
const victim = list.find((d) => d.alive && d.live!.kin.some((k) => !k.dead && byId.has(k.t)))!;
const kinBefore = victim.live!.kin.filter((k) => !k.dead && byId.has(k.t)).map((k) => byId.get(k.t)!);
LW.onKill('player', victim, '测试：你杀了他');
const feudKin = kinBefore.filter((k) => (LW.motive(k)?.kind ?? '') === '血仇');
console.log('血仇即时校验：', feudKin.length, '/', kinBefore.length, '位亲人当场把你记成血仇（动机：' + (feudKin[0] ? LW.motive(feudKin[0])!.line.slice(0, 28) + '…' : '-') + '）');

// ---- 跑三年
const t0 = Date.now();
for (let day = 0; day < 1080; day++) {
  game.day += 1; game.time += 1;
  for (const d of list) if (d.alive) d.age += 1 / 30;   // 与游戏内一致：30 天为一月
  LW.dayTick();
}
const ms = Date.now() - t0;

const alive = list.filter((d) => d.alive);
const withSect = alive.filter((d) => d.live?.sect).length;
const withKin = alive.filter((d) => (d.live?.kin ?? []).some((k) => !k.dead)).length;
const withPal = alive.filter((d) => (d.live?.pal ?? []).length > 0).length;
const bagItems = alive.reduce((a, d) => a + (d.live?.bag ?? []).length, 0);
const arts = alive.reduce((a, d) => a + (d.live?.arts ?? []).length, 0);
const foes = alive.reduce((a, d) => a + (d.live?.foe ?? []).filter((f) => !f.dead).length, 0);
const avgStones = Math.round(alive.reduce((a, d) => a + (d.live?.stones ?? 0), 0) / Math.max(1, alive.length));
const maxStones = Math.max(...alive.map((d) => Math.round(d.live?.stones ?? 0)));
const agendas = new Map<string, number>();
for (const d of alive) { const k = d.live?.busy ?? '?'; agendas.set(k, (agendas.get(k) ?? 0) + 1); }

console.log('=== 活世界 · 三年模拟 ===');
console.log('耗时', ms, 'ms /', 1080, '天 / 初始', 420, '人 → 现存', list.length, '人（在世', alive.length, '）');
console.log('死亡', LW.stats.died, '· 新生', LW.stats.born, '· 成亲', LW.stats.wed);
console.log('有门派', withSect, '· 有家小', withKin, '· 有交游', withPal);
console.log('储物袋物件', bagItems, '（人均', (bagItems / Math.max(1, alive.length)).toFixed(1), '）· 功法', arts, '门');
console.log('未了仇怨', foes, '笔 · 斗法', LW.stats.duel, '· 报仇', LW.stats.revenge, '· 血仇', LW.stats.feud);
console.log('交易', LW.stats.trade, '· 功法突破', LW.stats.break, '· 传话', LW.stats.rumor, '· 差事', LW.stats.job);
console.log('灵石：人均', avgStones, '· 最多', maxStones);
console.log('此刻众生在做什么：', [...agendas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}人`).join('，'));
console.log('动机门禁：无理由', noReason, '人（不会来找你） / 有理由', withReason, '人');
console.log('血仇继承：', feudKin.length, '/', kinBefore.length, '位亲人把你记成了血仇');
const s = alive.find((d) => (d.live?.foe ?? []).length > 0 && (d.live?.kin ?? []).some((k) => !k.dead)) ?? alive[0];
console.log('--- 抽样人物档案（' + s.name + '）---');
console.log(LW.profileLines(s).join('\n'));
console.log('--- 世界大事记（最近 10 条）---');
for (const c of LW.chron.slice(-10)) console.log(`  第${Math.floor(c.day / 360) + 1}年 ${c.text}`);

// ---- 断言
const bad: string[] = [];
if (noReason < 420 * 0.7) bad.push('路人本该大多数对你无诉求');
if (feudKin.length === 0) bad.push('血仇没有传给亲人');
if (LW.stats.died > 420 * 0.45) bad.push('死亡率过高（' + LW.stats.died + '）');
if (LW.stats.rumor < 50) bad.push('消息不传播（rumor=' + LW.stats.rumor + '）');
if (LW.stats.duel < 1) bad.push('没有人寻仇斗法');
if (foes < 10) bad.push('世界太和气，没有仇怨');
if (withKin < alive.length * 0.4) bad.push('家庭系统没生效');
if (bagItems < alive.length * 0.6) bad.push('储物袋空了');
if (avgStones > 4000 || maxStones > 60000) bad.push('经济通胀（人均 ' + avgStones + '，最多 ' + maxStones + '）');
if (LW.stats.born > 420 * 0.6) bad.push('生育失控（' + LW.stats.born + '）');
if (LW.stats.break > 3000) bad.push('功法突破过快（' + LW.stats.break + '）');
if (withSect < alive.length * 0.25) bad.push('门派系统没生效');
if (bad.length) { console.error('\n!! 未通过：\n  - ' + bad.join('\n  - ')); process.exit(1); }
console.log('\nSMOKE OK —— 活世界在自己转');
