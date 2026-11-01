// 第四十九步「人心」· 表里系统（2.1）：每个人两张脸。
// 真好感 favor 照旧参与一切决策；表演好感 shown 只管对话语气、心声泡与头衔。
// 心声泡：看得穿（高出两个大境界，或神识之内高出一个大境界）显示真心声（泡边描金）；
// 看不穿时，贪婪、阴狠者说的是表演出来的话——他心里盘算的，是你的储物袋。
import type { Game } from './game';
import type { NpcData, Pers } from './npc';

/** 阅历、假货账与赃物（存在 ws.renxin 里，随存档保存） */
export interface RenxinState {
  /** 《韩立随笔》：上当与识破的记录（只记账，不改数值） */
  lessons: string[];
  /** 服下假丹的次数 */
  fakeTaken: number;
  /** 被骗局得手的次数 */
  scamHit: number;
  /** 赃物：凶徒劫走的储物，到期前可寻回 */
  lost: { items: [string, number][]; ls: number; due: number; who: string } | null;
}

export const newRenxin = (): RenxinState => ({ lessons: [], fakeTaken: 0, scamHit: 0, lost: null });

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 每人一个稳定的伪装系数（0–1），由种子推出，存档无需额外记录 */
export function facadeOf(d: NpcData): number {
  let h = ((d.seed ?? 1) | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
}

/** 表演好感比真好感高出多少：贪婪、阴狠者对你更热情（他想要你的东西）；正人君子不装 */
export function facadeGap(d: NpcData): number {
  const f = facadeOf(d);
  switch (d.pers) {
    case 'greedy': return 12 + 14 * f;
    case 'ruthless': return 14 + 16 * f;
    case 'arrogant': return 3 * f;
    case 'cautious': return 2 * f;
    default: return 0;            // 正直 / 温和 / 孤高：两值几乎相等
  }
}

/** 表演好感：对话语气用它；看穿了，就是真好感 */
export function shownFavor(d: NpcData, pierced: boolean): number {
  return pierced ? d.favor : clamp(Math.round(d.favor + facadeGap(d)), -100, 100);
}

/** 看不看得穿此人。结丹以上的阴狠老怪，连被压制时的心声都是假的，只有两境之差才看得透。 */
export function canPierce(g: Game, d: NpcData, dist?: number): boolean {
  const gap = g.hero.realm - d.realm;
  if (gap >= 2) return true;
  if (d.pers === 'ruthless' && d.realm >= 2) return false;
  if (gap < 1 || g.concealed || !(g.senseRadius > 0)) return false;
  const dd = dist ?? Math.hypot(d.x - g.player.x, d.y - g.player.y);
  return dd < g.senseRadius;
}

/** 表演出来的心声（修士 / 凡人各一套） */
const FAKE_WORDS: Partial<Record<Pers, string[]>> = {
  greedy: ['这位道友好生面善，不知是哪家的高足？', '道友气度不凡，若有闲暇，不妨同饮一杯。', '都是修仙路上的同道，互相照应才是。'],
  ruthless: ['道友请留步，在下只是路过。', '山高水长，道友保重。', '（他面带和气，向你拱手）道友辛苦了。'],
  cautious: ['这一带不太平，道友还是小心为上。'],
};
const FAKE_MORTAL: Partial<Record<Pers, string[]>> = {
  greedy: ['仙师远道而来，小店新到了好货，您随便看看。', '仙师慢走，小人略备薄酒，还请赏光。'],
  ruthless: ['仙师一路辛苦，小人这就去烧水。', '这乱世，有仙师照应，小人心里踏实。'],
};
/** 心里在打小算盘的念头（与你的钱袋、性命有关），这时才需要演 */
const SCHEMING = new Set<string>(['rob', 'revenge', 'hunt', 'trade', 'hide']);

/** 心声泡：返回要显示的话，以及它是不是真心声（真心声在泡边描金） */
export function mindFor(g: Game, d: NpcData, real: string, dist?: number): { text: string; real: boolean } {
  if (canPierce(g, d, dist)) return { text: real, real: true };
  const schemes = d.pers === 'greedy' || d.pers === 'ruthless' || (!!d.plan && SCHEMING.has(d.plan.k));
  const pool = (d.faction === 'mortal' ? FAKE_MORTAL[d.pers] : undefined) ?? FAKE_WORDS[d.pers];
  if (!schemes || !pool) return { text: real, real: true };   // 正人君子不装：心声即真
  return { text: pick(pool), real: false };
}

/** 头衔：看不穿时显示表演出来的性格（遗府同行等） */
const FAKE_LABEL: Partial<Record<string, string>> = { greedy: '热心肠', ruthless: '温厚' };
export function labelOf(pers: string, real: string, pierced: boolean): string {
  return pierced ? real : (FAKE_LABEL[pers] ?? real);
}
