// 第四十九步「人心」· 战败重做（3.1）：谁打死的，决定你怎么输。
// 妖兽：沿用“路人所救”；劫修：储物袋被搜走，赃物可寻回；死敌补刀：家当落入仇人之手；
// 魔修：有几率被掳去魔窟，自己逃。所有战败都附道伤（修炼慢、法力上限低）。
import type { Game } from './game';
import type { DNode } from './modal';
import type { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { WORLD_W, WORLD_H } from '../data/world';
import { dropFoes } from './scams';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type FoeKind = 'beast' | 'human' | 'grudge' | 'demon';

/** 谁打死的：妖兽 / 劫修（路人甲）/ 死敌（grudge=2 的仇人补刀）/ 魔修 */
export function foeKindOf(g: Game, e?: Enemy): FoeKind {
  if (!e) return 'beast';                       // 毒、火之类无名之害：只伤修为与经脉
  const d = e.npcId ? g.npcs.byId.get(e.npcId) : undefined;
  if (d) return (d.grudge ?? 0) >= 2 ? 'grudge' : d.faction === 'demon' ? 'demon' : 'human';
  if (e.tag === 'scam:borrow') return 'demon';
  if (e.def?.kind === 'human' || e.tag === 'revenge') return 'human';
  return 'beast';
}

/** 道伤天数：妖兽 7–22，劫修 14–30，魔修 30–45，死敌补刀 45–60；对手高出一境再加十日 */
export function daoDays(kind: FoeKind, gap: number): number {
  const base = kind === 'beast' ? 7 : kind === 'human' ? 14 : kind === 'demon' ? 30 : 45;
  return clamp(Math.round(base + Math.max(0, gap) * 10 + Math.random() * 15), 7, 60);
}

/** 搜身：扣走 lo–hi 比例的储物袋（装备栏不在储物袋里，不受影响） */
export function plunder(g: Game, lo: number, hi: number): { items: [string, number][]; ls: number } {
  const h = g.hero, items: [string, number][] = [];
  for (const b of h.bag.slice()) {
    if (b.id === 'mat_lingshi') continue;
    const n = clamp(Math.round(b.n * (lo + Math.random() * (hi - lo))), 1, b.n);
    C.removeItem(h, b.id, n, b.age ?? 0);
    items.push([b.id, n]);
  }
  const have = C.bagCount(h, 'mat_lingshi');
  const ls = clamp(Math.round(have * (lo + Math.random() * (hi - lo))), 0, have);
  if (ls > 0) C.removeItem(h, 'mat_lingshi', ls);
  return { items, ls };
}

/** 赃物入账：劫修带走，三十日内可寻回；死敌补刀的东西落入仇人手里，寻不回来 */
export function recordLoss(g: Game, L: { items: [string, number][]; ls: number }, who: string, recoverable: boolean) {
  if (!recoverable || (!L.items.length && !L.ls)) return;
  const R = g.ws.renxin;
  if (R.lost) {
    for (const [id, n] of L.items) { const o = R.lost.items.find(([k]) => k === id); if (o) o[1] += n; else R.lost.items.push([id, n]); }
    R.lost.ls += L.ls;
  } else R.lost = { items: L.items.slice(), ls: L.ls, due: g.day + 30, who };
}

/** 寻仇夺回：赎回或夺回赃物 */
export function returnLoot(g: Game) {
  const h = g.hero, R = g.ws.renxin, L = R.lost;
  if (!L) return;
  for (const [id, n] of L.items) C.addItem(h, id, n);
  if (L.ls) C.addItem(h, 'mat_lingshi', L.ls);
  R.lost = null;
  const what = L.items.map(([id, n]) => itemDef(id).name + (n > 1 ? '×' + n : '')).join('、');
  g.toast(`夺回了被劫走的储物：${what}${L.ls ? (what ? '、' : '') + '灵石 ' + L.ls : ''}`, 'good');
}

/** 凶徒拿着赃物回来找你：赎回，或者动手夺回 */
export function revengeNode(g: Game, x: any): DNode {
  const h = g.hero, L = g.ws.renxin.lost;
  const lead: Enemy | undefined = x.foes.find((e: Enemy) => !e.dead);
  const fight = (): DNode | null => { for (const e of x.foes) { e.busy = false; e.aggro = true; } return null; };
  const ransom = Math.max(30, Math.round((L ? L.ls * 0.5 + L.items.length * 60 : 0)));
  const can = C.bagCount(h, 'mat_lingshi') >= ransom;
  return { speaker: lead?.name ?? '劫修', title: '寻仇', mood: 'danger', text: `几个人堵住了去路，为首的正是前几日抢你储物袋的那个${lead?.name ?? '劫修'}。他颠了颠手里的包袱，咧嘴一笑。\n\n「道友，东西还在我这儿。想拿回去？拿灵石来赎，或者——拿命来换。」`, options: [
    { label: `赎回（${ransom} 灵石）`, tone: 'gold', disabled: !can, hint: can ? '' : '灵石不足', act: () => {
      C.removeItem(h, 'mat_lingshi', ransom); returnLoot(g); x.done = true; dropFoes(g, x);
      return { speaker: lead?.name ?? '劫修', text: '「算你识相。」他把包袱往地上一扔，带着人头也不回地走了。', options: [{ label: '……', act: () => null }] };
    } },
    { label: '动手，夺回来！', tone: 'bad', act: fight },
  ] };
}

/** 每日：赃物到期则销往坊市；凶徒有几率回来寻仇 */
export function daily(g: Game, days: number) {
  const R = g.ws.renxin, L = R.lost;
  if (!L) return;
  if (g.day >= L.due) {
    R.lost = null;
    g.toast('那伙劫修已将你的赃物销往坊市，再难寻回了。', 'warn');
    return;
  }
  if (Math.random() < 1 - Math.pow(0.88, Math.max(0.5, days))) g.happen.spawnRevenge();
}

/** 魔修掳走：醒来在魔修的石室里，自己逃（潜行看神识，硬闯要付代价） */
export function captiveScene(g: Game) {
  const p = g.player, h = g.hero, T = g.terrain;
  let tx = p.x, ty = p.y;
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = 2200 + Math.random() * 900;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.85;
    if (x < 400 || y < 400 || x > WORLD_W - 400 || y > WORLD_H - 400) continue;
    if (!T.isLand(x, y) || T.walkFactor(x, y) < 0.3) continue;
    tx = x; ty = y; break;
  }
  g.teleport(tx, ty);
  const escape = clamp(0.3 + (h.realm - 1) * 0.12 + (h.stage >= 6 ? 0.08 : 0), 0.2, 0.8);
  const caught = (): DNode => {
    h.hp = Math.max(0.05, h.hp * 0.5); h.daoLeft = (h.daoLeft ?? 0) + 20;
    const L = plunder(g, 0.2, 0.3);
    g.toast(`魔修一掌将你拍在石壁上，又搜走了 ${L.items.length + (L.ls ? 1 : 0)} 样家当，经脉更是错位。`, 'warn');
    return { speaker: '魔修', mood: 'danger', text: '「想跑？」魔修头也不回，袖风一卷，你被狠狠甩回石壁上……', options: [{ label: '……', act: () => null }] };
  };
  g.openDialog({ speaker: '魔修', title: '魔窟', mood: 'danger', text: '你在一阵阴风里醒来，身处一间刻满血纹的石室。四壁挂着人皮灯笼，中央的鼎里炼着一团血雾，隐约是你某件法宝的残魂。\n\n一个枯瘦的魔修背对着你，盘坐炼宝，口中念念有词。', options: [
    { label: `暗中运神识，趁他炼宝走神时潜行脱身（约 ${Math.round(escape * 100)}%）`, act: () => {
      if (Math.random() < escape) { g.toast('你趁魔修炼宝走神，悄无声息地溜出了石室。', 'good'); return null; }
      return caught();
    } },
    { label: '硬闯！（掀翻丹鼎，拼死冲出石门）', tone: 'bad', act: () => {
      h.hp = Math.max(0.05, h.hp - 0.25); h.daoLeft = (h.daoLeft ?? 0) + 15;
      const L = plunder(g, 0.2, 0.3);
      g.toast(`你撞破石门冲了出来，身上多了几道伤${L.items.length || L.ls ? '，家当也丢了些' : ''}。`, 'warn');
      return null;
    } },
  ] });
}
