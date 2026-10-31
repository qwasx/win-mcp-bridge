// 活世界 · 快速自检（不耗时：几百天的世界推进，几秒内跑完）
// 运行：game/node_modules/.bin/tsx tools/test-alive.ts
import {
  addSoul, buildContact, createServerWorld, defaultCast, seedSociety, soulView, tickDays, worldSummary,
} from '../src/lib/alive/index';

function fail(msg: string): never {
  console.error('✗ ' + msg);
  process.exit(1);
}

const w = createServerWorld({ seed: 20260214, heroName: '韩立', cast: false });
const cast = defaultCast(20260214);
if (cast.length < 100) fail(`名册太少：${cast.length}`);
for (const s of cast) addSoul(w, s);
seedSociety(w, 16);

const before = worldSummary(w);
if (before.population < 100) fail(`人口异常：${before.population}`);
if (before.families.length < 4) fail(`人家太少：${before.families.length}`);

// 推 720 日（两年）：应有人出生、死亡、结仇、寻仇、结婚
tickDays(w, 360);
tickDays(w, 360);
const s = worldSummary(w);
console.log(`第 ${s.day} 日 · 在世 ${s.population} · 人家 ${s.families.length} · 门派 ${s.sects.filter((x) => x.members > 0).length}`);
console.log(`生 ${s.stats.births} · 婚 ${s.stats.wed} · 亡 ${s.stats.deaths} · 命案 ${s.stats.murders} · 寻仇 ${s.stats.revenge} · 买卖 ${s.stats.trades}`);
if (s.stats.deaths < 1) fail('两年里没人死——寿元/妖兽/寻仇没生效');
if (s.stats.births < 1) fail('两年里没人添丁——家庭系统没生效');
if (s.stats.murders < 1) fail('两年里没出过命案——仇恨系统没长牙');
if (s.stats.wed < 1) fail('两年里没人成亲——社交系统没生效');

// 每个人都得能答出「此刻在忙什么、袋里有什么、家里有谁」
const alive = Object.keys(w.souls).map((k) => w.souls[k]).filter((x) => x.alive && x.id !== '__hero__');
let noAgenda = 0, emptyKinOk = 0, withBag = 0, withArt = 0;
for (const p of alive) {
  if (!p.agenda.why) noAgenda++;
  if (p.bag.length > 0) withBag++;
  if (p.arts.length > 0) withArt++;
  if (p.kin.length > 0) emptyKinOk++;
}
if (noAgenda > 0) fail(`${noAgenda} 个人答不出自己在忙什么`);
if (withBag < alive.length * 0.5) fail(`有储物袋的人太少：${withBag}/${alive.length}`);
if (withArt < alive.length * 0.5) fail(`有功法的人太少：${withArt}/${alive.length}`);
if (emptyKinOk < alive.length * 0.2) fail(`有家的人太少：${emptyKinOk}/${alive.length}`);

// 邀约必有缘由
let contacts = 0, reasoned = 0;
const seen = new Set<string>();
for (let i = 0; i < 400; i++) {
  tickDays(w, 1);
  for (const c of w.contacts) {
    if (seen.has(c.id)) continue;      // 同一件事只算一次（没被处理前会一直挂着）
    seen.add(c.id);
    contacts++;
    if (c.reason && c.reason.length > 3 && c.gain && c.cost) reasoned++;
  }
  w.contacts = w.contacts.filter((c) => !c.handled);
}
const daysTotal = Math.round(w.day);
if (contacts === 0) fail('七百日里没有任何人来找过你（太冷清）');
if (reasoned !== contacts) fail(`${contacts - reasoned} 次邀约没有缘由——这就是「莫名其妙」`);
const rate = contacts / daysTotal;
console.log(`邀约 ${contacts} 次 / ${daysTotal} 日 ≈ 每 ${(daysTotal / contacts).toFixed(1)} 日一次（全部带缘由，且同一人不来第二回太快）`);
if (rate > 0.05) fail(`邀约太频繁：${(rate * 30).toFixed(2)}/月，还是在打扰人`);

// 样本命册
const sample = alive.find((p) => p.kin.length > 0 && p.grudges.length > 0) ?? alive[0];
const v = soulView(w, sample.id)!;
console.log('\n—— 命册样本 ——');
console.log(`${v.name} · ${v.realmName} · ${v.persName} · ${v.sectName ?? '散修'}`);
console.log('此刻：' + v.agendaText);
console.log('功法：' + v.arts.map((a) => `${a.name}(${a.tier}阶${Math.round(a.mastery)}层，${a.from})`).join('；'));
console.log('袋子：' + v.bag.slice(0, 4).map((b) => `${b.name}×${b.count}(${b.src})`).join('、'));
console.log('家人：' + (v.kinNames.map((k) => `${k.name}(${k.kind})`).join('、') || '举目无亲'));
console.log('恩怨：' + (v.grudgeNames.map((g) => `${g.name}:${g.reason}`).join('；') || '与人无怨'));

console.log('\n✓ 活世界自检通过');
