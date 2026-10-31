// ============ v0.44 · 结婴大典 ============
// 结婴（碎丹成婴）是凡人修仙路上第一件真正的大事：天南、慕兰、极西的修士都会赶来围观。
// 史载：落云宗外那场结婴，山门内外、江上舟中、云头崖顶，观者近七十万人。
// 本模块只负责「把这件事告诉界面」，特效在 src/ui/JieyingCeremony.tsx。
export interface JieyingEvent {
  name: string;
  year: number;      // 游戏纪年
  age: number;
  place: string;
  /** 观礼众生：由真人名册里活着、且已相识或各宗长老凑成，最多若干行 */
  guests: { name: string; title: string; sect: string }[];
  /** 实际观礼人数（近七十万，随宗门远近浮动） */
  crowd: number;
}

type Listener = (e: JieyingEvent) => void;
const listeners = new Set<Listener>();
export const jieying = {
  on(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  fire(e: JieyingEvent) { for (const fn of listeners) fn(e); },
};

/** 观礼人数：结婴乃天南盛事，观者以数十万计 */
export function crowdCount(seats: number) {
  // seats = 山门规模 + 各宗长老 + 散修人数的粗略推算；观者近七十万，略随岁月浮动
  return Math.round(66 * 10000 + Math.min(9, seats * 0.12) * 10000 + Math.random() * 40000);
}
