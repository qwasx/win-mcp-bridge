// 第四十九步「人心」· 骗局（2.3 的 #1 #2 #3 #5）
// 骗局走 happen.ts 的街头事件池（scam_* 类型，约占街头事件 17%）：这里只放对话、假货与结算。
// #1 合作探宝分赃翻脸：遗府同行（sites.ts）早有分赃翻脸，本版把它的头衔与台词改成“表里”的演法。
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import type { Msg } from './cultivation';
import type { NpcData } from './npc';
import type { Enemy } from './combat';
import * as C from './cultivation';
import { ITEMS, itemDef } from '../data/items';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const SCAM_KINDS = ['scam_vendor', 'scam_borrow', 'scam_elder'] as const;

/** 假货：名字、描述、图标与真货一致；服下才露馅（fakeOf 记下真身）。不进随机掉落池。 */
export const FAKE_PILL = 'pill_zhuji_fake';
export const FAKE_PILL_REAL = '淬体丹';
ITEMS[FAKE_PILL] = { ...itemDef('pill_zhuji'), id: FAKE_PILL, price: 0, pill: { hp: 0.3 }, fakeOf: FAKE_PILL_REAL };

/** 服下假丹：露馅、记账（在 usePill 之后调用） */
export function onPillUsed(g: Game, id: string, msgs: Msg[]) {
  const real = itemDef(id).fakeOf; if (!real) return;
  const R = g.ws.renxin; R.fakeTaken++; R.lessons.push(`服下一粒染色的假「筑基丹」（真身：${real}）`);
  msgs.push({ text: `药力驳杂，丹田里只升起一股燥热……这哪是筑基丹，分明是一颗${real}染了金色！你被人坑了。`, kind: 'warn' });
}

/** 撤掉还没出手的敌人（事件作废时，免得留下一个傻站着的修士） */
export function dropFoes(g: Game, x: any) {
  g.combat.enemies = g.combat.enemies.filter((e) => !x.foes.includes(e) || e.aggro);
}

// ---------------------------------------------------------------- #2 假丹药
export function vendorNode(g: Game, x: any): DNode {
  const h = g.hero, real = itemDef('pill_zhuji'), price = Math.round(real.price * 0.3);
  const sharp = !!x.d.sharp || h.realm >= 3;
  const canBuy = C.bagCount(h, 'mat_lingshi') >= price;
  const buy = (): DNode => {
    if (C.bagCount(h, 'mat_lingshi') < price) return { speaker: x.d.name, text: '「灵石不够？那便算了，别耽误我做生意。」', options: [{ label: '……', act: () => null }] };
    C.removeItem(h, 'mat_lingshi', price); C.addItem(h, FAKE_PILL, 1); x.done = true;
    g.toast(`得到「${real.name}」×1（三折，划算！）`, 'good');
    return { speaker: x.d.name, text: '摊主眉开眼笑，把一粒丹药塞进你手里，又用旧布盖上了摊子。\n\n「道友好眼力，下回还来！」', options: [{ label: '告辞', act: () => null }] };
  };
  const tell = sharp ? '\n\n（你神识一扫，药气里掺着一丝淬体丹的火燥之气，只是很淡。）' : '';
  const opts: DOpt[] = [
    { label: `买下（${price} 灵石）`, tone: 'gold', disabled: !canBuy, hint: canBuy ? '' : '灵石不足', act: buy },
    { label: '拿起一粒，凑近闻闻', act: () => ({ speaker: x.d.name, text: sharp ? '药香发甜，却甜得有些发腻。你心里一动——这味道，不像七派的丹。' : '药香扑鼻，丹面金晕流转，看着确实不错。', options: [
      { label: `买下（${price} 灵石）`, tone: 'gold', disabled: !canBuy, act: buy },
      { label: '不买，走开', act: () => null },
    ] }) },
    { label: '不买，走开', act: () => null },
  ];
  return { speaker: x.d.name, title: '路边摊', look: x.npc?.look, mood: 'mystic', text: `一个摊主蹲在路边，摊前铺着一块旧布，上面摆着几粒金黄的丹药。\n\n「道友，看您是有眼力的人。这是今早刚从七派流出来的${real.name}，原价${real.price}灵石，今儿个三折！」${tell}`, options: opts };
}

// ---------------------------------------------------------------- #3 借刀杀人
/** 挑一个“魔修”的人选：与人结着血仇（有亲族），又不是你的熟人 */
export function pickRival(g: Game): NpcData | undefined {
  const h = g.hero;
  const list = g.npcs.list.filter((d) => d.alive && !d.canon && !d.bond && !d.beauty && d.realm >= 1 && d.realm <= Math.min(4, h.realm + 1)
    && (d.pers === 'ruthless' || d.pers === 'greedy' || d.pers === 'arrogant')
    && !!d.ties?.some((t) => t.k === 'kin' || t.k === 'sworn' || t.k === 'lover' || t.k === 'master' || t.k === 'disciple'));
  return list.length ? pick(list) : undefined;
}

export function borrowNode(g: Game, x: any): DNode {
  const rv: NpcData | undefined = x.d.rivalId ? g.npcs.byId.get(x.d.rivalId) : undefined;
  const who: string = rv ? rv.name : x.d.fakeName;
  const keep = pick(['一枚玉简', '一张丹方', '半件法器']);
  return { speaker: x.d.name, title: '苦主', look: x.npc?.look, mood: 'danger', text: `一个衣衫褴褛的修士跪在路边，满脸泪痕，身前一道血迹蜿蜒向山谷深处。\n\n「道友救命！前面山谷里有个魔修，三日前屠了我全家……他叫${who}，如今还在那里逍遥！我一介散修，斗他不过。求道友替我报了这血仇，我愿将祖传的${keep}相赠！」`, options: [
    { label: '「此等恶徒，岂能容他！」（前去除魔）', tone: 'gold', act: () => { x.d.accepted = true; x.d.engaged = true; g.toast(`${x.d.name}：「${who}就在山谷深处，道友千万小心！」`, 'info'); return null; } },
    { label: '「家务事，外人不便插手。」', act: () => { x.done = true; dropFoes(g, x); return null; } },
  ] };
}

/** 那“魔修”还在山谷里等：你走近了，他才出手（每帧调用） */
export function borrowTick(g: Game, x: any, alive: Enemy[]) {
  const e = alive[0];
  if (!e) { x.done = true; return; }
  if (e.busy && Math.hypot(e.x - g.player.x, e.y - g.player.y) < 320) { e.busy = false; e.aggro = true; }
}

/** 那“魔修”死了：苦主借你之手报了仇，死者的亲族却要记你一辈子 */
export function borrowKilled(g: Game, x: any) {
  const R = g.ws.renxin; R.scamHit++;
  const rv: NpcData | undefined = x.d.rivalId ? g.npcs.byId.get(x.d.rivalId) : undefined;
  R.lessons.push(`替人报仇，杀的却是别人的亲族之人（${rv?.name ?? x.d.fakeName}）`);
  if (rv && rv.alive) { g.npcs.die(rv, '死于韩立之手（被人借刀）'); g.rel.onPlayerKill(rv, false); }
  g.toast(rv ? `苦主早已不见踪影……${rv.name}的亲族怒不可遏，你的血仇又添了一笔。` : '那魔修倒下了——山谷里传来一阵冷笑，苦主早已不见踪影。', 'warn');
}

// ---------------------------------------------------------------- #5 夺舍老魔
/** 心魔劫要等对话框关掉之后再开，免得新窗口被旧窗口的关闭吞掉 */
const startXinmo = (g: Game) => setTimeout(() => g.xinmo.start(() => { /* 心魔劫的 bonus 只作演出 */ }), 60);

export function elderNode(g: Game, x: any): DNode {
  const h = g.hero, e = x.d, look = x.npc?.look, R = g.ws.renxin;
  const resist = clamp(0.5 + 0.22 * (h.realm - e.realm) + (e.sharp ? 0.12 : 0) + (h.stage - e.stage) * 0.02, 0.08, 0.92);
  const judge = (): DNode => {
    x.done = true;
    if (Math.random() < resist) {
      const ls = Math.round(60 * Math.pow(3, Math.max(0, h.realm - 1)) * (0.8 + Math.random() * 0.6));
      C.addItem(h, 'mat_lingshi', ls); R.lessons.push('识破老魔「渡灵」之下的夺舍神念');
      return { speaker: e.name, look, title: '老者', text: `你的神识刚触到他的经脉，一股阴冷的念头便从识海深处探出，直扑你的天灵……\n\n你早有防备，心神一沉，将那缕神念生生压了回去。\n\n老者睁开眼，眼中闪过一丝失望，随即化作感激：「道友好定力。这点灵石，权作谢礼。」（灵石 +${ls}）`, options: [{ label: '告辞', act: () => null }] };
    }
    h.hp = Math.max(0.2, h.hp - 0.3); R.scamHit++; R.lessons.push('被老魔的夺舍神念钻入识海，心魔险些失控');
    return { speaker: e.name, look, title: '夺舍', mood: 'danger', text: '那一缕神念如毒蛇般钻进你的识海！你眼前一黑，两个身影在意识里撕扯——是你，又不是你。\n\n等你回过神来，老者已不见踪影，只余一地焦骨。你的心魔被惊醒了。', options: [{ label: '（稳住心神）', act: () => { startXinmo(g); return null; } }] };
  };
  return { speaker: e.name, look, title: '白发老者', mood: 'mystic', text: `山石下倚着一个白发老者，胸口一道焦黑的伤痕，气息奄奄。\n\n「咳……老夫遭仇家暗算，经脉尽断，只差一口灵力便可吊住性命。道友慈悲，若肯渡我一口灵力，老夫必有重谢……」${e.sharp ? '\n\n（你神识一扫，他袖中的手正在暗暗结印。）' : ''}`, options: [
    { label: '「前辈稍忍，晚辈这就渡灵。」（伸手贴上他的后心）', tone: 'gold', act: () => ({ speaker: e.name, look, text: '一股冰冷的神念顺着掌心钻了过来……', options: [{ label: '（运神识迎上去）', act: judge }] }) },
    { label: '「前辈自求多福吧。」', act: () => { x.done = true; return null; } },
  ] };
}

/** 按骗局类型取对话（happen.interact 调用） */
export function scamNode(g: Game, x: any): DNode | null {
  if (x.kind === 'scam_vendor') return vendorNode(g, x);
  if (x.kind === 'scam_borrow') return borrowNode(g, x);
  if (x.kind === 'scam_elder') return elderNode(g, x);
  return null;
}
