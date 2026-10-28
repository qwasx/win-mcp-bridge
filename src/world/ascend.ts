// 第 2 阶段：境界突破改造（核心规则，不依赖画面）
//   · 天命种子：冲关结果在准备阶段就已注定，读档不能刷——只有准备条件变了，结果才会变
//   · 准备清单：修为圆满 / 稀世灵物 / 灵脉洞府 / 护法 / 心境 / 法宝温养，每凑齐一项成功率加一截
//   · 心得：闭关要靠在外面历练攒下的心得，没有心得闭门造车，十日难抵一日之功
//   · 丹毒：吃丹越多药力越弱，丹毒深重时伤身、扰乱冲关
//   · 金丹品阶 1–9：终身带着，影响属性与修炼速度
//   · 失败要疼：重伤、折寿、小概率跌落一层；但会留下「感悟」，下次更稳
import type { Hero } from './cultivation';
import { REALMS, MAJOR_BREAKS, realmName, expNeed } from '../data/realms';
import { itemDef } from '../data/items';

/** 闭关被打断后留下的去处（红颜遇险 / 宗门召集） */
export interface AscTask { id: number; kind: 'love' | 'sect'; x: number; y: number; until: number; who: string; whoId?: string; realm: number; done: boolean }
export interface AscRecord { realm: number; ok: boolean; day: number; chance: number; grade?: number; fell?: boolean }
export interface AscState {
  /** 天命种子（存档里带着，读档不变） */
  seed: number;
  /** 心得（可供闭关的日数） */
  xinde: number;
  /** 丹毒 0–100 */
  toxin: number;
  /** 各大境界冲关失败留下的感悟次数（下标 = 所在大境界） */
  insight: number[];
  /** 各大境界已冲关次数（推进天命：失败后下一次是新的一卦） */
  tries: number[];
  /** 金丹品阶 1–9（0 = 未结丹） */
  core: number;
  /** 瓶颈前打磨根基的日数 */
  polish: number;
  /** 法宝温养日数 */
  nurture: number;
  /** 重伤余下的日数 */
  injury: number;
  /** 下一次闭关被打断的日子 */
  nextIntr: number;
  intrN: number;
  /** 悟道之地：上次顿悟的日子 */
  wudao: Record<string, number>;
  history: AscRecord[];
  tasks: AscTask[];
}

export function newAsc(seed?: number): AscState {
  return {
    seed: seed ?? Math.floor(Math.random() * 2 ** 31), xinde: 120, toxin: 0, insight: [0, 0, 0, 0, 0, 0], tries: [0, 0, 0, 0, 0, 0],
    core: 0, polish: 0, nurture: 0, injury: 0, nextIntr: 0, intrN: 0, wudao: {}, history: [], tasks: [],
  };
}
/** 取（必要时补齐）主角的突破状态——旧存档没有这个字段 */
export function ascOf(h: Hero): AscState {
  const a = (h.asc ??= newAsc());
  const d = newAsc(a.seed);
  for (const k of Object.keys(d) as (keyof AscState)[]) if ((a as any)[k] === undefined) (a as any)[k] = (d as any)[k];
  if (a.insight.length < 6) a.insight = [...a.insight, ...Array(6 - a.insight.length).fill(0)];
  if (a.tries.length < 6) a.tries = [...a.tries, ...Array(6 - a.tries.length).fill(0)];
  return a;
}

// ------------------------------------------------------------------ 天命：带种子的随机
/** 整数哈希 → [0,1)。同样的输入永远得到同样的结果 */
export function fate(...xs: number[]) {
  let h = 0x9e3779b9 >>> 0;
  for (const x of xs) {
    h ^= (x | 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2); h >>>= 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h / 4294967296;
}

// ------------------------------------------------------------------ 节奏
/** 在外历练（非打坐、非闭关）每真实秒攒下的心得（日） */
export const XINDE_ACTIVE = 0.4;
/** 斩杀一名敌人的战斗感悟（日 × (1+境界)） */
export const XINDE_KILL = 4;
/** 斩杀一名敌人直接得到的修为（相当于几日苦修 × (1+境界)，不耗光阴） */
export const KILL_EXP_DAYS = 4;
/** 没有心得时闭关的效率（闭门造车） */
export const SECLUDE_DRY = 0.1;
/** 有心得时闭关比打坐专注：每日修为 ×1.5 */
export const SECLUDE_FOCUS = 2.2;
/** 心得上限（日）：攒得再多也只能抵这么久的苦修 */
export function xindeCap(realm: number) { return [400, 900, 3000, 9000, 20000, 40000][Math.min(5, realm)]; }
/** 闭关被打断的间隔（日）：一到三年一次，境界越高越久 */
export function intrGap(h: Hero, n: number) { const a = ascOf(h); return Math.round((300 + 700 * fate(a.seed, 77, n)) * (1 + Math.max(0, h.realm - 1) * 0.35)); }

// ------------------------------------------------------------------ 丹毒
/** 修为丹药的药力折算（丹毒越深越弱） */
export function toxinMult(h: Hero) { return Math.max(0.15, 1 - ascOf(h).toxin / 115); }
/** 服一颗修为丹药积下的丹毒 */
export function pillToxin(tier: number) { return 7 + tier * 2; }
/** 丹毒消退（每日） */
export function toxinDecay(h: Hero, days: number, meditating: boolean) { const a = ascOf(h); if (a.toxin > 0) a.toxin = Math.max(0, a.toxin - days * (meditating ? 0.06 : 0.015)); }
export function toxinName(t: number) { return t < 15 ? '清' : t < 35 ? '微' : t < 60 ? '积郁' : t < 80 ? '深重' : '入髓'; }

// ------------------------------------------------------------------ 金丹
export const CORE_NAME = ['', '一品', '二品', '三品', '四品', '五品', '六品', '七品', '八品', '九品'];
export const CORE_DESC = ['', '下下之丹，勉强成丹', '下品金丹，灵光暗淡', '下品金丹', '中品金丹', '中品金丹，圆润有光', '上品金丹', '上品金丹，丹纹七道', '极品金丹，丹纹八道', '九转无瑕，万中无一'];
/** 金丹品阶对属性的倍率（五品为常） */
export function coreStat(h: Hero) { const g = h.asc?.core ?? 0; return g ? 1 + (g - 5) * 0.04 : 1; }
/** 金丹品阶对修炼速度的倍率 */
export function coreExp(h: Hero) { const g = h.asc?.core ?? 0; return g ? 1 + (g - 5) * 0.03 : 1; }
/** 金丹品阶 = 准备 + 凝丹火候 + 一点天命 */
export function coreGrade(seed: number, tries: number, prepFrac: number, cook: number, toxin: number) {
  const q = 0.36 * prepFrac + 0.44 * Math.max(0, Math.min(1, cook)) + 0.2 * fate(seed, 31, tries) - Math.max(0, toxin - 30) / 300;
  return Math.max(1, Math.min(9, 1 + Math.floor(q * 9.2)));
}

// ------------------------------------------------------------------ 重伤
export function injured(h: Hero) { return (h.asc?.injury ?? 0) > 0; }
/** 重伤时属性打七折 */
export function injuryStat(h: Hero) { return injured(h) ? 0.7 : 1; }

// ------------------------------------------------------------------ 准备清单
export type PrepId = 'full' | 'rare' | 'vein' | 'guard' | 'heart' | 'art';
export interface PrepItem { id: PrepId; name: string; ok: boolean; bonus: number; prog: string; hint: string }
/** 打磨根基所需日数（到了瓶颈后，继续打坐 / 闭关的日子会累计进来） */
export const POLISH_DAYS = [0, 90, 720, 2400, 5000, 9000];
/** 法宝温养所需日数 */
export const NURTURE_DAYS = [0, 120, 600, 1800, 4000, 8000];
/** 每凑齐一项的加成（按所冲境界） */
export const PREP_BONUS = [0, 0.07, 0.06, 0.05, 0.045, 0.04];
/** 稀世灵物：任一件（冲关时耗去） */
export const RARE: Record<number, { id: string; age?: number }[]> = {
  1: [{ id: 'herb_tianling', age: 100 }, { id: 'herb_zihou', age: 100 }, { id: 'herb_xuelian', age: 100 }, { id: 'mat_yaodan4' }],
  2: [{ id: 'mat_yaodan6' }, { id: 'mat_yaodan7' }, { id: 'herb_huolong', age: 300 }, { id: 'mat_leijiao' }, { id: 'mat_huochan' }],
  3: [{ id: 'mat_yaodan8' }, { id: 'mat_yaodan9' }, { id: 'herb_yangshen' }, { id: 'mat_yanghunmu' }, { id: 'mat_molinjiao' }],
  4: [{ id: 'mat_yaodan10' }, { id: 'mat_bingfengyu' }, { id: 'mat_jinjiaolin' }, { id: 'mat_leipenggu' }],
};
export function rareName(r: number) { return (RARE[r] ?? []).map((x) => itemDef(x.id).name + (x.age ? `（${x.age}年+）` : '')).join(' / '); }

/** 准备清单所需的外部信息（由游戏提供，便于测试） */
export interface PrepCtx {
  place: { mult: number; name: string };
  guard: string | null;          // 护法人选
  hunters: number;               // 未了的因果（仍在追杀你的仇家）
  rep: number;                   // 声望（杀孽）
  hasRare: (id: string, age: number) => boolean;
  artName: string | null;        // 正在温养的法宝
}

export function prepList(h: Hero, c: PrepCtx): PrepItem[] {
  const r = h.realm, a = ascOf(h), B = PREP_BONUS[Math.min(5, r + 1)] ?? 0.04;
  const pd = POLISH_DAYS[Math.min(5, r)], nd = NURTURE_DAYS[Math.min(5, r)];
  const rare = (RARE[r] ?? []).find((x) => c.hasRare(x.id, x.age ?? 0));
  const out: PrepItem[] = [
    { id: 'full', name: '修为圆满', ok: a.polish >= pd, bonus: B, prog: `打磨根基 ${Math.floor(Math.min(a.polish, pd))} / ${pd} 日`, hint: '修为到顶后继续打坐、闭关，把根基磨实。' },
    { id: 'rare', name: '稀世灵物', ok: !!rare, bonus: B, prog: rare ? `${itemDef(rare.id).name}（冲关时耗去）` : '无', hint: `任一件：${rareName(r)}` },
    { id: 'vein', name: '灵脉洞府', ok: c.place.mult >= 1.5, bonus: B, prog: `${c.place.name}${c.place.mult > 1 ? ` ×${c.place.mult.toFixed(1)}` : ''}`, hint: '在自家洞府、小灵脉或灵泉畔冲关（灵气 ×1.5 以上）。' },
    { id: 'guard', name: '护法人选', ok: !!c.guard, bonus: B, prog: c.guard ?? '无人护法', hint: '有同伴随行（红颜、结拜、道侣），或身在宗门、职位够高，长老肯来护法。' },
    { id: 'heart', name: '心境', ok: c.hunters <= 1 && c.rep >= -30, bonus: B, prog: `未了因果 ${c.hunters} · 杀孽 ${c.rep < -30 ? '深重' : c.rep < 0 ? '有' : '无'}`, hint: '仇家不超过一个、声望不低于 -30。了结恩怨，心中才静得下来。' },
    { id: 'art', name: '法宝温养', ok: !!c.artName && a.nurture >= nd, bonus: B, prog: c.artName ? `${c.artName} ${Math.floor(Math.min(a.nurture, nd))} / ${nd} 日` : '快捷栏上没有合用的法宝', hint: `把一件不低于本境界的法宝放进快捷栏，打坐闭关时以神识温养。` },
  ];
  return out;
}

// ------------------------------------------------------------------ 成功率
/** 冲关基础（硬核） */
export const BASE: Record<number, { base: number; per: number; max: number }> = {
  1: { base: 0.10, per: 0.18, max: 3 },
  2: { base: 0.05, per: 0.15, max: 3 },
  3: { base: 0.03, per: 0.16, max: 2 },
  4: { base: 0.01, per: 0.08, max: 4 },
};
export const CHANCE_CAP = 0.92;
export interface ChanceParts { base: number; pills: number; root: number; prep: number; insight: number; toxin: number; injury: number; extra: number; total: number }
export function chanceParts(h: Hero, prep: PrepItem[], pills: number, rootRate: number, luck: number, extra = 0): ChanceParts {
  const b = BASE[h.realm] ?? { base: 0.01, per: 0.05, max: 1 }, a = ascOf(h);
  const p: ChanceParts = {
    base: b.base, pills: b.per * Math.min(pills, b.max), root: rootRate * 0.03 + luck / 400,
    prep: prep.filter((x) => x.ok).reduce((s, x) => s + x.bonus, 0),
    insight: Math.min(4, a.insight[h.realm] ?? 0) * 0.06,
    toxin: -Math.max(0, a.toxin - 30) / 250,
    injury: injured(h) ? -0.15 : 0, extra, total: 0,
  };
  p.total = Math.max(0.01, Math.min(CHANCE_CAP, p.base + p.pills + p.root + p.prep + p.insight + p.toxin + p.injury + p.extra));
  return p;
}
/** 准备条件的指纹：准备不变，天命不变 */
export function prepSig(prep: PrepItem[], pills: number) { let s = pills * 64; prep.forEach((x, i) => { if (x.ok) s |= 1 << i; }); return s; }
/** 本次冲关的天命之数（越小越好；小于成功率即成功） */
export function fateRoll(h: Hero, sig: number) { const a = ascOf(h); return fate(a.seed, h.realm, a.tries[h.realm] ?? 0, sig); }

// ------------------------------------------------------------------ 失败
export const INJ_DAYS = [0, 120, 240, 480, 900, 1500];
export const LIFE_LOSS = [0, 5, 12, 30, 60, 100];
export const FALL_CH = [0, 0.1, 0.12, 0.15, 0.18, 0.2];
export interface FailResult { lines: string[]; fell: boolean; life: number; injDays: number }
/** 冲关失败（硬核）：修为倒退、重伤、折寿，小概率跌落一层；留下感悟 */
export function applyFail(h: Hero, lite = false): FailResult {
  const a = ascOf(h), r = h.realm;
  const tr = a.tries[r] ?? 0;
  const fell = !lite && h.stage > 0 && fate(a.seed, 911, r, tr) < FALL_CH[r];
  const life = lite ? Math.ceil(LIFE_LOSS[r] / 2) : LIFE_LOSS[r];
  const injDays = lite ? Math.round(INJ_DAYS[r] / 2) : INJ_DAYS[r];
  h.lifeLost += life;
  h.hp = Math.min(h.hp, lite ? 0.3 : 0.1); h.mp = Math.min(h.mp, 0.1);
  a.injury = Math.max(a.injury, injDays);
  a.insight[r] = Math.min(4, (a.insight[r] ?? 0) + 1);
  a.tries[r] = tr + 1;
  a.polish = Math.floor(a.polish * 0.5);
  h.stats.failed++;
  const lines: string[] = [];
  if (fell) {
    const from = realmName(h.realm, h.stage);
    h.stage--; h.exp = Math.floor(expNeed(h.realm, h.stage) * 0.8);
    lines.push(`根基动摇，境界跌落：${from} → ${realmName(h.realm, h.stage)}！`);
  } else {
    h.exp = Math.floor(h.exp * (lite ? 0.85 : 0.7));
    lines.push(`灵力反噬，修为倒退${lite ? '一成半' : '三成'}。`);
  }
  lines.push(`经脉重创（${injDays} 日内属性打七折，冲关成功率 -15%）。`);
  lines.push(`折损寿元 ${life} 载。`);
  lines.push(`此番失败，留下一分感悟（下次冲关 +6%，已有 ${a.insight[r]} 分）。`);
  return { lines, fell, life, injDays };
}

// ------------------------------------------------------------------ 悟道之地
export interface WudaoDef { id: string; loc: string; name: string; text: string }
export const WUDAO: WudaoDef[] = [
  { id: 'w_taiyue', loc: 'taiyue', name: '太岳观云台', text: '山巅云海翻涌，一卷一舒之间，似有天地呼吸。' },
  { id: 'w_beihan', loc: 'beihan', name: '北寒冰心崖', text: '万里冰原一片死寂，寒意透骨，杂念被一点点冻住。' },
  { id: 'w_jixi', loc: 'jixi_desert', name: '极西枯骨道', text: '黄沙下埋着上古修士的遗骸。人死道消，千年不过一捧沙。' },
  { id: 'w_yinyang', loc: 'yinyang', name: '阴阳窟两仪石', text: '一黑一白两块巨石，阴阳二气在其间缓缓流转。' },
  { id: 'w_kunwu', loc: 'kunwu', name: '昆吾山古碑', text: '古碑上的字早已模糊，指尖抚过，却有剑意隐隐刺痛神识。' },
  { id: 'w_zhuimo', loc: 'zhuimo', name: '坠魔谷魔痕壁', text: '石壁上留着上古大战的爪痕，杀意千年不散。' },
  { id: 'w_waihai', loc: 'waihai', name: '外海听潮礁', text: '潮起潮落，一浪接一浪，无始无终。' },
  { id: 'w_caoyuan', loc: 'caoyuan', name: '草原落日坡', text: '天地一线，落日如血，风吹草低。' },
];
export const WUDAO_R = 1400;
/** 悟道之地打坐：修为 ×1.8，心得照常累积 ×3；每处十年可顿悟一次 */
export const WUDAO_MULT = 1.8;
export const WUDAO_CD = 3600;

// ------------------------------------------------------------------ 变强：神识与遁速
/** 大境界对神识圈的额外倍率（让突破后神识圈「明显」变大） */
export const SENSE_K = [1, 1, 1.2, 1.4, 1.7, 2.0];
/** 大境界对遁速的额外倍率 */
export const SPEED_K = [1, 1, 1.05, 1.1, 1.18, 1.25];
/** 每个大境界多一个神通位（快捷栏 9 → 筑基 10 → 结丹 11 → 元婴 12 → 化神 13） */
export function slotCount(realm: number) { return 9 + Math.max(0, Math.min(4, realm - 1)); }
export const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '[', ']', '\\'];

export function majorDesc(r: number) { return MAJOR_BREAKS[r]?.desc ?? ''; }
export function nextRealmName(r: number) { return REALMS[r + 1]?.name ?? ''; }
