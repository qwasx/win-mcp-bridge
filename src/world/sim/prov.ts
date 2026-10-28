// 第五阶段·宝物来历：高阶 / 独门宝物按「件」记账（附加数据，不改 items 定义）
//
// · 每件上品以上的法宝、原著成名法宝，第一次被人碰到时登记一个唯一编号，记下历任主人（谁、何时、怎么得来的）；
// · 杀人夺宝、拦路打劫、拾取、拍得、卖出……换主人时都追加一笔；NPC 之间互相夺宝也走这里；
// · 神识烙印（mark）：抢来 / 捡来的宝带着原主的烙印，炼化（打坐 / 闭关）满 need 日才抹得掉；抹掉前原主或原主师门能感应到它。
// 存在 SimState.prov 里（旧存档缺省自动新建）。持有人：'hero' = 玩家，'g:<npcId>' = 落在地上（某人死后掉的），'s:<地名>' = 卖给了铺子，其余 = NPC id。
import { itemDef } from '../../data/items';
import type { SimState } from './world';

export type ProvHow = 'origin' | 'found' | 'buy' | 'auction' | 'kill' | 'rob' | 'loot' | 'sold' | 'refine' | 'bag';
export const HOW_NAME: Record<ProvHow, string> = { origin: '炼成 / 祖传', found: '秘境所得', buy: '购得', auction: '拍得', kill: '杀人夺宝', rob: '拦路劫得', loot: '拾得', sold: '卖给铺子', refine: '炼化', bag: '夺走储物袋' };
export interface ProvStep { w: string; n: string; d: number; how: ProvHow }
export interface ProvMark { who: string; n: string; sect?: string; need: number; done: number }
export interface Prov { uid: number; id: string; owner: string; hist: ProvStep[]; mark?: ProvMark; told?: number }
export interface ProvState { seq: number; items: Prov[] }

/** 哪些东西按件记账：上品以上法宝，或原著人物的成名法宝 */
let canonSet: Set<string> | null = null;
export function setProvCanon(ids: string[]) { canonSet = new Set(ids); }
export function tracked(id: string): boolean {
  const it = itemDef(id); if (!it || it.type !== 'artifact') return false;
  return it.tier >= 3 || !!canonSet?.has(id);
}
/** 编号：天字第 N 号（甲乙丙丁……按品阶） */
export function uidText(p: Prov) { const t = itemDef(p.id)?.tier ?? 3; return `${'凡下中玄地天天'[t] ?? '玄'}字第${p.uid}号`; }
/** 炼化所需日数：品阶越高越久 */
export const refineNeed = (id: string) => { const t = itemDef(id)?.tier ?? 3; return t >= 5 ? 60 : t >= 4 ? 40 : 25; };

export function provState(S: SimState): ProvState { const s = (S as any).prov as ProvState | undefined; if (s && Array.isArray(s.items)) return s; const n: ProvState = { seq: 1, items: [] }; (S as any).prov = n; return n; }

/** 某人手里某件宝的记账（没有就按「原主」登记一笔） */
export function provOf(S: SimState, id: string, owner: string, ownerName: string, day: number, how: ProvHow = 'origin', make = true): Prov | undefined {
  if (!tracked(id)) return undefined;
  const P = provState(S);
  for (const p of P.items) if (p.id === id && p.owner === owner) return p;
  if (!make) return undefined;
  const p: Prov = { uid: P.seq++, id, owner, hist: [{ w: owner, n: ownerName, d: day, how }] };
  P.items.push(p);
  if (P.items.length > 900) P.items.splice(0, P.items.length - 900);   // 太老的、早已湮没的记录
  return p;
}
export function provFind(S: SimState, pred: (p: Prov) => boolean): Prov[] { return provState(S).items.filter(pred); }

/** 换主人：夺来 / 捡来的带上原主的神识烙印（原主若已炼化过，烙印就是他的；没炼化过，仍是更早那位的） */
export function provMove(p: Prov, to: string, toName: string, day: number, how: ProvHow, sect?: string) {
  const prev = p.hist[p.hist.length - 1];
  const forced = how === 'kill' || how === 'rob' || how === 'loot' || how === 'bag';
  if (forced) {
    if (p.mark && p.mark.who === to) p.mark = undefined;             // 物归原主：自己的烙印还在
    else if (!p.mark && prev && prev.w !== to && !prev.w.startsWith('g:') && !prev.w.startsWith('s:')) p.mark = { who: prev.w, n: prev.n, sect, need: refineNeed(p.id), done: 0 };
    else if (p.mark) p.mark.done = 0;                                 // 换了一手：前人的炼化前功尽弃
  } else if (how === 'buy' || how === 'auction') { /* 买来的：烙印若有，原样带着（黑货洗不白） */ }
  p.owner = to;
  p.hist.push({ w: to, n: toName, d: day, how });
  if (p.hist.length > 12) p.hist.splice(1, p.hist.length - 12);
}
/** 一批东西从 a 到 b（NPC 之间夺宝、玩家死后储物袋被夺） */
export function provMoveAll(S: SimState, items: { id: string }[], from: string, fromName: string, to: string, toName: string, day: number, how: ProvHow, fromSect?: string) {
  const moved: Prov[] = [];
  for (const b of items) {
    if (!tracked(b.id)) continue;
    const p = provOf(S, b.id, from, fromName, day - 1);
    if (p) { provMove(p, to, toName, day, how, fromSect); moved.push(p); }
  }
  return moved;
}
/** 炼化：一件宝过了 days 日，烙印抹去返回 true */
export function provRefine(p: Prov, days: number, day: number): boolean {
  if (!p.mark) return false;
  p.mark.done += days;
  if (p.mark.done >= p.mark.need) { const n = p.hist[p.hist.length - 1]; p.mark = undefined; p.hist.push({ w: p.owner, n: n?.n ?? '', d: day, how: 'refine' }); if (p.hist.length > 12) p.hist.splice(1, p.hist.length - 12); return true; }
  return false;
}
/** 是否「有主」：烙印未除，或最近一手是杀人 / 劫来 / 捡来的（正道坊市认得出） */
export function provHot(p: Prov | undefined, day: number): boolean {
  if (!p) return false;
  if (p.mark) return true;
  const last = [...p.hist].reverse().find((h) => h.how !== 'refine');
  return !!last && (last.how === 'kill' || last.how === 'rob' || last.how === 'loot' || last.how === 'bag') && day - last.d < 360 && p.hist.length > 1;
}
