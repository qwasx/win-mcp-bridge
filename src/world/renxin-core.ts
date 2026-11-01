// 第四十九步「人心」· 核心规则（纯函数；不碰 DOM / 画布，tools/test-renxin.ts 直接在 node 里跑）
//
// 一、表里：每个 NPC 两张脸
//    favor = 真心（照旧参与所有 AI 决策：劫道、寻仇、结交……一行没改）
//    shown = favor + 伪装值（对话语气、心声泡、名牌好恶、行礼 / 冷脸用这个）
//    狠辣、贪婪者伪装最重——他越恨你、越惦记你的储物袋，脸上越热情；正直、淡泊者表里如一。
// 二、读心：神识压得住他才看得见真心（心声泡描金）
//    你高出两个大境界，或者他正被你的威压镇着（举步维艰 / 镇压）；凡人瞒不过修士；
//    老怪物（结丹以上且狠辣）被压着也照样在演——这一版看不穿，只能靠阅历里的破绽。
// 三、骗局：同一种钩子（邀你探宝、求你主持公道、求你渡气、三折卖丹），大半是真的，少数是局；
//    起不起骗心看性格——谨慎的人几乎不骗，狠辣贪婪者高发；你的储物袋越肥越招人惦记。
// 四、败北：看是谁把你打倒的——妖兽 / 劫修仇家 / 魔修 / 死敌，代价一个比一个重；全部附带道伤。
import type { NpcData, Pers } from './npc';

export type ScamKind = 'partner' | 'stall' | 'knife' | 'possess';
export const SCAM_NAME: Record<ScamKind, string> = { partner: '合作探宝', stall: '地摊假货', knife: '借刀杀人', possess: '夺舍老魔' };
export const PERS_CN: Record<Pers, string> = { righteous: '正直', greedy: '贪婪', cautious: '谨慎', arrogant: '傲慢', kind: '温和', ruthless: '狠辣', aloof: '淡泊' };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- 骗心
/** 钩子事件里那个散修的性格分布 */
export const HOOK_PERS: [Pers, number][] = [['righteous', 18], ['kind', 14], ['cautious', 18], ['aloof', 10], ['arrogant', 12], ['greedy', 16], ['ruthless', 12]];
/** 各性格起骗心的概率 */
export const SCAM_P: Record<Pers, number> = { righteous: 0, kind: 0, cautious: 0.03, aloof: 0.05, arrogant: 0.15, greedy: 0.45, ruthless: 0.72 };

export function pickPers(rnd: () => number = Math.random, pool: [Pers, number][] = HOOK_PERS): Pers {
  const tot = pool.reduce((a, b) => a + b[1], 0);
  let r = rnd() * tot;
  for (const [p, w] of pool) { r -= w; if (r <= 0) return p; }
  return pool[pool.length - 1][0];
}

/** 钩子事件：这个人什么性格、骗不骗你。rich = 你储物袋的肥瘦（0‥1） */
export function rollHook(kind: ScamKind, rnd: () => number = Math.random, rich = 0): { pers: Pers; scam: boolean } {
  // 三折的筑基丹：天上不会掉馅饼，十有七假；三成是真货（多半是赃物）
  if (kind === 'stall') return { pers: rnd() < 0.6 ? 'greedy' : 'cautious', scam: rnd() < 0.7 };
  // 路边重伤的「前辈」：三成是借尸苟活、伺机夺舍的老魔
  if (kind === 'possess') {
    const scam = rnd() < 0.3;
    return { pers: scam ? 'ruthless' : pickPers(rnd, [['righteous', 3], ['kind', 3], ['aloof', 3], ['cautious', 2]]), scam };
  }
  const pers = pickPers(rnd);
  const k = kind === 'knife' ? 1.25 : 1;
  return { pers, scam: rnd() < clamp(SCAM_P[pers] * k * (1 + 0.4 * clamp(rich, 0, 1)), 0, 0.95) };
}

// ---------------------------------------------------------------- 表里
/** 伪装值：shown = favor + mask */
export function maskOf(pers: Pers, favor: number, scheme = false, grudge = 0): number {
  if (grudge >= 1) return 0;                                          // 已经结仇的不装了（见面就动手）
  let m = 0;
  switch (pers) {
    case 'ruthless': m = 28 + Math.max(0, -favor) * 0.7; break;      // 越恨你，笑得越真
    case 'greedy': m = 16 + Math.max(0, -favor) * 0.4; break;
    case 'cautious': m = favor < 0 ? -favor * 0.5 : 0; break;         // 不露恶意，也不露热情
    case 'kind': m = 2; break;
    case 'arrogant': m = -6; break;                                    // 冷脸挂在外头
    default: m = 0;                                                    // 正直 / 淡泊：表里如一
  }
  if (scheme) m += 24;                                                 // 心怀鬼胎时格外殷勤
  return Math.round(m);
}
export const shownOf = (favor: number, mask: number) => clamp(Math.round(favor + mask), -100, 100);
/** 心怀鬼胎：被骗局系统选中要骗你，或者眼下的打算就是劫道 */
export function schemingOf(d: NpcData): boolean { return !!(d as any).rxScheme || d.plan?.k === 'rob'; }

/** 读心等级：0 看见的是他演给你看的；1 看见真心（心声泡描金） */
export function readLevel(heroRealm: number, d: { realm: number; pers: Pers }, sup = 0): 0 | 1 {
  if (d.realm >= 3 && d.pers === 'ruthless') return 0;               // 老怪物：被压着也在演
  if (d.realm <= 0) return heroRealm >= 1 ? 1 : 0;                    // 凡人瞒不过修士
  if (heroRealm - d.realm >= 2 || sup >= 1) return 1;
  return 0;
}

// 以下给界面 / 心声用（g 用 any，免得循环引用）
const actOf = (g: any, d: NpcData) => g?.npcs?.active?.get?.(d.id);
/** 结拜、红颜、原著人物：不另起一张脸 */
export function plainFace(d: NpcData) { return !!(d.bond || d.beauty || d.canon); }
export function canRead(g: any, d: NpcData): boolean { if (!g?.hero) return true; return readLevel(g.hero.realm, d, actOf(g, d)?.sup ?? 0) > 0; }
export function maskFor(d: NpcData) { return plainFace(d) ? 0 : maskOf(d.pers, d.favor, schemingOf(d), d.grudge ?? 0); }
/** 脸上挂的好恶 */
export function shownFavor(_g: any, d: NpcData) { return shownOf(d.favor, maskFor(d)); }
/** 你看到的好恶：看得穿是真心，看不穿是演的 */
export function seenFavor(g: any, d: NpcData) { return canRead(g, d) ? d.favor : shownFavor(g, d); }
export function favorLabel(g: any, d: NpcData): string {
  const sh = shownFavor(g, d);
  if (canRead(g, d)) return Math.abs(sh - d.favor) >= 8 ? `${sh}〔神识所见：实为 ${Math.round(d.favor)}〕` : String(Math.round(d.favor));
  return String(sh);
}
export function shownTier(g: any, d: NpcData): string {
  const R = g?.rel; if (!R) return '';
  const f = seenFavor(g, d);
  return f === d.favor ? R.tier(d) : R.tier({ ...d, favor: f });
}
/** 演出来的性格：狠辣者装温和 / 谨慎 / 正直；贪婪者一半装温和 */
export function disguisePers(d: { pers: Pers; seed: number }): Pers {
  const s = Math.abs(Math.floor(d.seed || 0));
  if (d.pers === 'ruthless') return (['kind', 'cautious', 'righteous'] as Pers[])[s % 3];
  if (d.pers === 'greedy') return s % 2 ? 'kind' : 'greedy';
  return d.pers;
}
export function shownPersName(g: any, d: NpcData) { return PERS_CN[plainFace(d) || canRead(g, d) ? d.pers : disguisePers(d)]; }

// ---------------------------------------------------------------- 心声
/** 演出来的心声（看不穿时，狠辣 / 贪婪 / 心怀鬼胎者给你看的那一句） */
export const FAKE_LINES: Partial<Record<Pers, string[]>> = {
  greedy: ['这位道友好生面善。', '能结识道友，真是三生有幸。', '道友这身气度，必是名门高徒。'],
  ruthless: ['此人可交。', '这位道友倒是个爽快人。', '日后或许能同道而行。', '和气生财，和气生财。'],
  cautious: ['萍水相逢，客气些便是。', '……与我无关。'],
};
/** 骗局里的真心（看得穿时描金显示） */
export const SCHEME_TRUE: Record<ScamKind | 'rob', string[]> = {
  partner: ['开了宝箱，就送他上路。', '五五分账？呵，他也配。', '先让他替我挡着禁制。'],
  knife: ['借他的手除掉那人，妙极。', '这傻子当真信了。', '等他们斗个两败俱伤……'],
  possess: ['好一具年轻的肉身……', '只要他肯渡一口灵力过来……', '老夫的元神撑不了几日了。'],
  stall: ['又来一个冤大头。', '这色染得，连我自己都快信了。'],
  rob: ['这人的储物袋鼓鼓的……', '跟上他，到了荒僻处再动手。'],
};
/** 老实人心里想的（骗子演的也是这一套——所以看不穿时分不出来） */
export const HONEST_TRUE: Record<ScamKind, string[]> = {
  partner: ['那遗府的禁制，两人合力当能破开。', '这位道友看着靠得住。', '分到的灵石，够买一炉筑基丹的药了。'],
  knife: ['师兄……我一定替你报仇。', '那魔头修为不弱，得找个帮手。', '求求了，帮帮我……'],
  possess: ['……撑住，撑住……', '若能熬过这一劫……', '仇家怕是还在附近。'],
  stall: ['今儿能不能开张啊。', '这批货来得不容易。', '巡街的执事别过来就好。'],
};
/** 破绽 */
export const FLAWS = ['（笑意未达眼底）', '（目光在你腰间的储物袋上一顿）', '（话说得太周全了些）', '（袖中似有灵光一闪而没）', '（眼角余光一直瞥着四周）'];
/** 破绽出现的概率：头一回约一成；吃过同类的亏，一次比一次看得清（封顶七成半） */
export const flawChance = (yl: number) => Math.min(0.75, 0.12 + 0.22 * Math.max(0, yl));

// ---------------------------------------------------------------- 败北
export type FoeClass = 'beast' | 'robber' | 'demon' | 'nemesis';
export const FOE_CLASS_NAME: Record<FoeClass, string> = { beast: '妖兽', robber: '劫修 · 仇家', demon: '魔修', nemesis: '死敌' };
export function classifyFoe(f: { human: boolean; evil: boolean; grudge: number; pursuer?: boolean } | null): FoeClass {
  if (!f || !f.human) return 'beast';
  if (f.grudge >= 2 || f.pursuer) return 'nemesis';
  if (f.evil) return 'demon';
  return 'robber';
}
/** 道伤天数：修炼 -40%、法力上限 -20%（打坐闭关时愈合 ×1.6） */
export function dsDays(c: FoeClass, rnd: () => number = Math.random) {
  const [a, b] = c === 'beast' ? [7, 20] : c === 'robber' ? [15, 30] : c === 'demon' ? [20, 40] : [40, 60];
  return Math.round(a + rnd() * (b - a));
}
export const DS_EXP = 0.6, DS_MP = 0.8, DS_MED = 1.6;

export interface Stack { id: string; n: number; age?: number }
/** 搜袋：非装备栏的物品，按 70–100% 的比例整格搜走 */
export function stealPlan(bag: Stack[], keep: (id: string) => boolean, rnd: () => number = Math.random): { take: Stack[]; frac: number } {
  const frac = 0.7 + rnd() * 0.3;
  const take: Stack[] = [];
  for (const b of bag) { if (keep(b.id)) continue; if (rnd() < frac) take.push({ id: b.id, n: b.n, age: b.age }); }
  return { take, frac };
}
/** 赃物流散：他会花你的钱、卖你的药——每天每格约 4% 被出手，灵石每天花掉 3% */
export function decayStolen(items: Stack[], ls: number, days: number, rnd: () => number = Math.random): { items: Stack[]; ls: number; sold: Stack[] } {
  const keep: Stack[] = [], sold: Stack[] = [];
  const p = 1 - Math.pow(0.96, Math.max(0, days));
  for (const s of items) (rnd() < p ? sold : keep).push(s);
  return { items: keep, ls: Math.floor(ls * Math.pow(0.97, Math.max(0, days))), sold };
}
