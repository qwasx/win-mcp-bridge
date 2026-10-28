// 第 2 阶段：节奏测算——按“普通玩家”的玩法模型，估算从新开局到筑基 / 结丹 / 元婴各要多少真实游玩时间
//   npx tsx tools/pace-ascend.ts          （调后：当前代码里的数值）
//   npx tsx tools/pace-ascend.ts old      （调前：第 41 步的数值，闭关一键到瓶颈、不要心得）
// 玩法模型（两种规则用同一套）：
//   · 每真实分钟：六成时间在外面跑（赶路、打怪、做事，光阴 0.5 日/秒），四成时间原地打坐（光阴 2 日/秒）；
//   · 在外面跑时大约 45 秒斩一个敌人（新规则：战斗感悟给心得和少量修为）；打坐的地方平均灵气 ×1.3，闭关在洞府 / 灵脉 ×1.6；
//   · 每分钟结束时去闭关一次：旧规则一路闭到瓶颈（不花真实时间），新规则把攒下的心得用光为止；
//   · 每个小境界吃两颗对应的修为丹（耐药 / 丹毒照算），小瓶颈默认一次冲过；
//   · 伪灵根（×0.5）开局，长春功；筑基后换青元剑诀（×1.25）；
//   · 大境界冲关：筑基带 1 颗筑基丹 + 准备 3 项，结丹 2 颗降尘丹 + 4 项，结婴 2 颗九曲灵参丹 + 4 项，关卡发挥中等；
//     失败按各自规则扣修为（新规则另有跌境、感悟）。随机部分取 400 次的中位数。
// 剧情门槛（血色禁地才拿得到筑基丹等）、找丹找材料的时间、寿元丹都不计入。
import { REALMS, expNeed } from '../src/data/realms';
import * as A from '../src/world/ascend';

const OLD = process.argv[2] === 'old';
const OLD_EXP: Record<number, number[]> = {
  1: REALMS[1].expDays.map((_, s) => Math.round((36 + 11 * s) * 1.5)),
  2: [2600, 3800, 5500], 3: [8000, 11500, 16000], 4: [26000, 39000, 57000],
};
const OLD_MB: Record<number, { base: number; per: number }> = { 1: { base: 0.12, per: 0.3 }, 2: { base: 0.08, per: 0.28 }, 3: { base: 0.05, per: 0.3 } };
const PILL: Record<number, { exp: number; tier: number }> = { 1: { exp: 400, tier: 0 }, 2: { exp: 6000, tier: 2 }, 3: { exp: 20000, tier: 3 }, 4: { exp: 70000, tier: 4 } };
const LIFE = [70, 120, 220, 500, 1000, 2000];
const need = (r: number, s: number) => OLD ? Math.round(OLD_EXP[r][s] * 10) : expNeed(r, s);
const stages = (r: number) => REALMS[r].stages.length;

function rnd(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

interface Out { t: number[]; age: number[]; fails: number[]; dead: boolean }
function run(seed: number): Out {
  const R = rnd(seed);
  let realm = 1, stage = 0, exp = 0, age = 17, xinde = 120, toxin = 0, pillN = 0, insight = 0, fails = 0;
  const out: Out = { t: [], age: [], fails: [], dead: false };
  const rate = () => 10 * 0.5 * (realm >= 2 ? 1.25 : 1);
  let sec = 0;
  const eatPills = () => {
    for (let k = 0; k < 2; k++) {
      const p = PILL[realm]; const fit = Math.pow(0.35, Math.max(0, realm - 1 - p.tier)); const fat = Math.pow(0.55, pillN); pillN++;
      const tm = OLD ? 1 : Math.max(0.15, 1 - toxin / 115);
      exp = Math.min(need(realm, stage), exp + p.exp * fit * fat * tm);
      if (!OLD) toxin = Math.min(100, toxin + A.pillToxin(p.tier));
    }
  };
  eatPills();
  while (realm < 4 && sec < 3600 * 200) {
    // 一分钟的实时游玩
    const act = 36, sit = 24;
    age += (act * 0.5 + sit * 2) / 360;
    if (!OLD) { xinde = Math.min(A.xindeCap(realm), xinde + act * A.XINDE_ACTIVE + (act / 45) * A.XINDE_KILL * (1 + realm)); toxin = Math.max(0, toxin - sit * 2 * 0.06 - act * 0.5 * 0.015); }
    exp += rate() * 1.3 * sit * 2;
    if (!OLD) exp += (act / 45) * rate() * A.KILL_EXP_DAYS * (1 + realm);
    sec += 60;
    // 闭关
    const nd = need(realm, stage);
    if (exp < nd) {
      const per = rate() * 1.6 * (OLD ? 1 : A.SECLUDE_FOCUS);
      let days = (nd - exp) / per;
      if (!OLD) days = Math.min(days, xinde);
      exp += days * per; age += days / 360; if (!OLD) { xinde -= days; toxin = Math.max(0, toxin - days * 0.06); }
    }
    if (age > LIFE[realm]) { out.dead = true; (out as any).deadAt = realm; break; }
    if (exp < need(realm, stage)) continue;
    // 瓶颈
    if (stage < stages(realm) - 1) { stage++; exp = 0; pillN = 0; eatPills(); continue; }
    // 大境界
    const pills = realm === 1 ? 1 : 2, prepN = realm === 1 ? 3 : 4;
    let ch: number;
    if (OLD) { const mb = OLD_MB[realm]; ch = Math.min(0.97, mb.base + mb.per * pills + 0.015 + (realm >= 2 ? 0.05 : 0)); }
    else { const b = A.BASE[realm]; ch = Math.min(A.CHANCE_CAP, b.base + b.per * pills + 0.015 + prepN * A.PREP_BONUS[realm + 1] + insight * 0.06 - Math.max(0, toxin - 30) / 250 + 0.05); }
    if (!OLD) { // 打磨根基：在瓶颈上继续苦修
      const pd = A.POLISH_DAYS[realm]; age += pd / 360 * 0.5; sec += pd / 2 * 0.5; // 一半靠打坐（2 日/秒），一半靠闭关心得
    }
    if (R() < ch) {
      out.t.push(sec / 3600); out.age.push(age); out.fails.push(fails);
      realm++; stage = 0; exp = 0; pillN = 0; insight = 0; fails = 0; eatPills();
    } else {
      fails++;
      if (OLD) { exp *= 0.7; age += 3; }
      else {
        if (R() < A.FALL_CH[realm]) { stage = Math.max(0, stage - 1); exp = need(realm, stage) * 0.8; } else exp *= 0.7;
        age += A.LIFE_LOSS[realm]; insight = Math.min(4, insight + 1);
        sec += A.INJ_DAYS[realm] / 2 * 0.3; // 养伤：部分时间打坐疗伤
      }
    }
  }
  return out;
}

const N = 400, rows: Out[] = [];
for (let i = 0; i < N; i++) rows.push(run(1000 + i * 7919));
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : NaN; };
console.log(OLD ? '【调前】第 41 步数值（闭关一键到瓶颈）' : '【调后】当前数值（闭关要心得、冲关硬核）');
const names = ['筑基', '结丹', '元婴'];
for (let k = 0; k < 3; k++) {
  const ts = rows.filter((r) => r.t.length > k).map((r) => r.t[k]), ages = rows.filter((r) => r.t.length > k).map((r) => r.age[k]), fs = rows.filter((r) => r.t.length > k).map((r) => r.fails[k]);
  const hm = (h: number) => h < 1 ? `${Math.round(h * 60)} 分钟` : `${h.toFixed(1)} 小时`;
  console.log(`  到${names[k]}：中位 ${hm(med(ts))}（25%–75%：${hm(pct(ts, 0.25))}–${hm(pct(ts, 0.75))}），届时约 ${Math.round(med(ages))} 岁，此关失败中位 ${med(fs)} 次 · 达成率 ${(ts.length / N * 100).toFixed(0)}%`);
}
console.log(`  寿元耗尽（没到元婴就坐化，不吃任何延寿丹药）：${(rows.filter((r) => r.dead).length / N * 100).toFixed(0)}%（筑基期坐化 ${rows.filter((r) => (r as any).deadAt === 2).length}、结丹期坐化 ${rows.filter((r) => (r as any).deadAt === 3).length} / ${N}）`);
