// 第四十七步「人心」：给世界装上表里不一
// - 表里系统：每个 NPC 两张脸——favor 是真实态度（照旧参与 AI 决策），shownFavor 是表演态度（对话语气、心声泡用这个）
//   贪婪 / 狠辣 / 谨慎的人会装；正直 / 淡泊 / 温和的人不装。看穿人心是修为（神识）的奖励：境界高出两个大境界、或神识压制住对方，才能读到真心声
//   结丹以上的狠辣老怪，连被压制时的心声都是假的
// - 道伤：战败附加 7–60 天经脉受损（修炼 -40%、法力上限 -20%），要灵药 + 闭关才好
// - 战败重做：看击倒你的是谁——妖兽只想吃肉；劫修 / 仇家搜走储物袋、生成"寻仇夺回"追踪（去晚了东西真没了）；死敌补刀；魔修掳走炼宝
// - 阅历：每次识破 / 吃亏记一条，下次有辨识加成（《韩立随笔》）
import type { Game } from './game';
import type { NpcData, Pers } from './npc';
import type { DNode, DOpt } from './modal';
import type { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { LOCATIONS, WORLD_SCALE, WORLD_W, WORLD_H, ACTIVE_MAP } from '../data/world';
import { CharState } from '../gfx/character';
import { audio } from './audio';
import { dirName } from './sites';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pk = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------ 表里
/** 这种性格的人会装吗 */
export const MASKING: Record<Pers, boolean> = { righteous: false, greedy: true, cautious: true, arrogant: false, kind: false, ruthless: true, aloof: false };
/** 伪装的幅度（由性格 + 种子决定，一个人一辈子装得差不多） */
export function maskWidth(pers: Pers, seed: number) {
  const base = pers === 'ruthless' ? 55 : pers === 'greedy' ? 45 : pers === 'cautious' ? 20 : 0;
  return base ? Math.round(base * (0.7 + ((seed * 7919) % 100) / 300)) : 0;
}
/** 他对你有没有藏着的恶意（真实态度 ≠ 表演态度的根源） */
export function hiddenIll(d: NpcData) {
  return (d.grudge ?? 0) > 0 || d.favor <= -15 || d.plan?.k === 'rob' || d.plan?.k === 'revenge' || (d.pers === 'greedy' && d.plan?.k === 'trade' && d.wealth < 40);
}
/** 表演态度：贪他储物袋的人反而对你更热情；正人君子两值几乎相等 */
export function shownFavor(d: NpcData) {
  if (!MASKING[d.pers]) return d.favor;
  if (d.grudge >= 2 && d.pers !== 'ruthless') return d.favor;      // 死敌一般是装不住的（狠辣的除外）
  if (!hiddenIll(d)) return d.favor + (d.pers === 'greedy' ? 5 : 0);
  return clamp(d.favor + maskWidth(d.pers, d.seed), -100, 100);
}
/** 这个人此刻是不是在装 */
export const isMasking = (d: NpcData) => shownFavor(d) - d.favor >= 10;
/** 你看不看得穿（境界 ≥ 对方两个大境界，或神识压制 sup≥1；结丹+ 的狠辣老怪连压制都看不穿） */
export function seesTruth(g: Game, realm: number, pers: Pers, supLv = 0) {
  const h = g.hero;
  if (h.realm - realm >= 2) return true;
  if (supLv >= 1 && !(realm >= 3 && pers === 'ruthless')) return true;
  return false;
}
export const seesNpcTruth = (g: Game, d: NpcData, supLv = 0) => seesTruth(g, d.realm, d.pers, supLv);
/** 表演心声：笑着接近你的人心里会"说"什么 */
export function fakeThought(d: NpcData): string {
  const greedy = ['这位道友好生面善。', '难得遇到同道，该请他喝一杯。', '此地灵气不错，道友也是来采药的？', '看道友气度不凡，必是名门高足。'];
  const ruthless = ['道友请。', '天色不早，道友一路小心。', '久仰久仰。', '（含笑点头）'];
  const cautious = ['萍水相逢，点头便是。', '这位道友，不知从何处来？'];
  return pk(d.pers === 'greedy' ? greedy : d.pers === 'ruthless' ? ruthless : cautious);
}
/** 真心声里的破绽（被看穿时说的话） */
export function trueThought(d: NpcData): string {
  const P = d.plan?.k;
  if (P === 'rob') return pk(['他的储物袋……鼓得很。', '等他背过身去。', '先稳住他，再寻机会。']);
  if (P === 'revenge' || (d.grudge ?? 0) > 0) return pk(['笑，先笑着。', '账，我记着呢。', '让他再得意几天。']);
  if (d.pers === 'greedy') return pk(['这人身上有什么好东西？', '灵石……灵石……', '若能骗到他的功法……']);
  if (d.pers === 'ruthless') return pk(['碍事。', '若无旁人在，一指便可了账。', '留着他，还有用处。']);
  return pk(['此人不可深交。', '再看看。']);
}
/** 表演寒暄：装出来的热情 */
export function maskedGreeting(d: NpcData, heroName: string) {
  return pk([
    `（${d.name}满面春风地迎上来）${heroName}道友！久仰久仰，今日得见，当真三生有幸。`,
    `哎呀，是${heroName}道友！来来来，在下这儿正好有一壶灵茶。`,
    `（对方抱拳一笑，笑意却未到眼底）道友别来无恙？`,
    `道友气色真好——近来可是又精进了？`,
  ]);
}

// ------------------------------------------------------------ 阅历
export interface JingLi { day: number; key: string; text: string }
export function addJingLi(g: Game, key: string, text: string) {
  const f = g.ws.flags as any; f.jingli ??= [];
  const L = f.jingli as JingLi[];
  if (L.some((j) => j.key === key && j.text === text)) return;
  L.push({ day: g.day, key, text });
  g.toast(`《韩立随笔》添了一笔：${text}`, 'info');
}
export const hasJingLi = (g: Game, key: string) => ((g.ws.flags as any).jingli as JingLi[] | undefined)?.some((j) => j.key === key) ?? false;
export const jingLiList = (g: Game): JingLi[] => ((g.ws.flags as any).jingli as JingLi[] | undefined) ?? [];
/** 阅历带来的辨识加成（同类骗局吃过一次亏 +25%，两次 +35%） */
export function jingLiBonus(g: Game, key: string) {
  const n = jingLiList(g).filter((j) => j.key === key).length;
  return n >= 2 ? 0.35 : n === 1 ? 0.25 : 0;
}

// ------------------------------------------------------------ 道伤
export function daoShang(g: Game, days: number, why: string) {
  const h = g.hero;
  const was = h.hurt ?? 0;
  h.hurt = Math.max(was, 0) + days; h.hurtLv = Math.max(h.hurtLv ?? 0, days >= 40 ? 2 : 1);
  g.toast(`${why}——经脉受损，道伤 ${Math.round(h.hurt)} 日（修炼 -40%、法力上限 -20%；服疗伤丹、闭关可早愈）。`, 'warn');
}
export const hurtText = (h: C.Hero) => (h.hurt && h.hurt > 0 ? `道伤 ${Math.ceil(h.hurt)} 日` : '');

// ------------------------------------------------------------ 战败重做
export interface Robbed { by: string; npcId?: string; items: [string, number][]; ls: number; day: number; map: string; x: number; y: number; realm: number; stage: number; done?: boolean; lastTip?: number; evil?: boolean }

/** 击倒你的人是谁 */
function foeKind(g: Game, e: Enemy | null): 'beast' | 'robber' | 'foe' | 'nemesis' | 'demon' {
  if (!e) return 'beast';
  if (e.def.kind !== 'human') return 'beast';
  const d = e.npcId ? g.npcs.byId.get(e.npcId) : undefined;
  if (d && (d.grudge ?? 0) >= 2) return 'nemesis';
  if (d && ((d.grudge ?? 0) >= 1 || d.hunting || d.chasing)) return 'foe';
  if (e.def.id === 'moxiu' || e.def.id === 'jindan_mo' || d?.faction === 'demon') return 'demon';
  return 'robber';
}
/** 回最近的城镇 */
function toTown(g: Game) {
  const p = g.player;
  let best: any = null, bd = 1e12;
  for (const l of LOCATIONS) {
    if (l.type !== 'town' && l.type !== 'city') continue;
    const d = Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y);
    if (d < bd) { bd = d; best = l; }
  }
  if (best) {
    const z = g.terrain.locZones[LOCATIONS.indexOf(best)];
    let tx = best.x * WORLD_SCALE, ty = best.y * WORLD_SCALE + (z ? z.ry * 0.9 : 300);
    for (let r = 0; r < 1500 && g.terrain.walkFactor(tx, ty) <= 0; r += 60) ty += 60;
    p.x = tx; p.y = ty; p.st = new CharState(tx, ty); g.cam.x = tx; g.cam.y = ty;
  }
  return best?.name ?? '荒野';
}
/** 搜储物袋：非装备栏物品按比例拿走，返回拿走的清单 */
function searchBag(g: Game, frac: number, keepArts: boolean): { items: [string, number][]; ls: number } {
  const h = g.hero, items: [string, number][] = [];
  const ls = C.bagCount(h, 'mat_lingshi');
  const takeLs = Math.round(ls * frac); if (takeLs > 0) C.removeItem(h, 'mat_lingshi', takeLs);
  const equipped = new Set(Object.values(h.equip).filter(Boolean) as string[]);
  const pool = h.bag.filter((b) => b.id !== 'mat_lingshi' && !equipped.has(b.id) && !(keepArts && itemDef(b.id).type === 'artifact'));
  for (const b of [...pool]) {
    if (Math.random() > frac) continue;
    const n = b.n; C.removeItem(h, b.id, n, b.age ?? 0);
    items.push([b.id, n]);
  }
  return { items, ls: takeLs };
}
function finish(g: Game, town: string, lostExp: number, extra: string, days = 3) {
  const h = g.hero, p = g.player;
  h.hp = 0.3; h.mp = 0.3; g.day += days;
  p.flying = false; p.sitting = false; g.destination = null; g.gathering = null;
  g.combat.reset(); g.pursuit?.reset(); g.combat.fade = 1;
  g.toast(`你身受重创，昏死过去……${days}日后在${town}醒来。修为损失 ${lostExp}。${extra}`, 'warn');
  audio.sfx('fail');
  g.updateUI(true);
}

/** 战败主入口（替代旧的 onPlayerDown 主体） */
export function playerDown(g: Game, src: Enemy | null) {
  const h = g.hero, p = g.player;
  const kind = foeKind(g, src);
  const d = src?.npcId ? g.npcs.byId.get(src.npcId) : undefined;
  const who = d?.name ?? src?.name ?? src?.def.name ?? '';
  const lostExp = Math.floor(C.need(h) * C.INSIGHT * (kind === 'nemesis' ? 0.2 : 0.1));
  h.exp = Math.max(0, h.exp - lostExp);
  const here = { x: p.x, y: p.y };
  if (kind === 'beast') {
    // 它只想吃肉：被路人所救——旧逻辑 + 轻道伤
    const lost: string[] = [];
    const ls = C.bagCount(h, 'mat_lingshi');
    if (ls > 0) { const n = Math.ceil(ls * 0.1); C.removeItem(h, 'mat_lingshi', n); lost.push(`灵石 ${n}`); }
    const pool = h.bag.filter((b) => b.id !== 'mat_lingshi' && itemDef(b.id).type !== 'artifact' && itemDef(b.id).type !== 'scroll');
    for (let i = 0; i < 2 && pool.length; i++) { const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; const n = Math.max(1, Math.floor(b.n * (0.3 + Math.random() * 0.3))); C.removeItem(h, b.id, n, b.age ?? 0); lost.push(`${itemDef(b.id).name} ${n}`); }
    const town = toTown(g);
    finish(g, town, lostExp, lost.length ? '遗失：' + lost.join('、') + '。' : '');
    daoShang(g, Math.round(rand(7, 20)), `被${who || '妖兽'}重创`);
    return;
  }
  if (kind === 'demon' && Math.random() < 0.3) {
    // 被魔修掳走炼宝：醒来在魔修洞府里，自己逃
    daoShang(g, Math.round(rand(14, 35)), `被${who || '魔修'}打落`);
    h.hp = 0.25; h.mp = 0.15; g.day += 2;
    p.flying = false; p.sitting = false; g.destination = null; g.gathering = null;
    g.combat.reset(); g.pursuit?.reset(); g.combat.fade = 1;
    const sr = src ? { realm: src.realm, stage: src.stage } : { realm: Math.max(1, h.realm), stage: 0 };
    g.openDialog(captiveNode(g, who || '魔修', sr));
    return;
  }
  // 劫修 / 仇家 / 死敌 / 魔修：储物袋被搜
  const frac = kind === 'nemesis' ? 1 : rand(0.7, 1);
  const got = searchBag(g, frac, kind !== 'nemesis');
  const town = toTown(g);
  if (kind === 'nemesis') {
    // 死敌补刀——拼着折损寿元催发秘法逃生
    const yrs = Math.round(rand(5, 12));
    h.lifeLost += yrs;
    finish(g, town, lostExp, `${who}俯身补刀之际，你拼着燃烧精血遁出三十里，寿元折损 ${yrs} 载；储物袋被搜了个干净。`, 5);
    daoShang(g, Math.round(rand(40, 60)), `${who}的补刀`);
    addJingLi(g, 'nemesis', `败于死敌${who}之手，几乎丧命——仇家不除，寝食难安。`);
  } else {
    const txt = got.items.length || got.ls ? `${who}搜走了你的储物袋（${got.ls ? `灵石 ${got.ls}` : ''}${got.items.length ? (got.ls ? '、' : '') + got.items.slice(0, 4).map(([id, n]) => itemDef(id).name + (n > 1 ? '×' + n : '')).join('、') + (got.items.length > 4 ? '等' : '') : ''}）。` : `${who}翻了翻你的储物袋，啐了一口。`;
    finish(g, town, lostExp, txt);
    daoShang(g, Math.round(rand(10, 30)), `被${who}重创`);
  }
  if (got.items.length || got.ls) {
    // 寻仇夺回：他会花你的钱、卖你的药——去晚了东西真没了
    const rb: Robbed = { by: who, npcId: d?.id, items: got.items, ls: got.ls, day: g.day, map: ACTIVE_MAP, x: here.x, y: here.y, realm: src?.realm ?? 1, stage: src?.stage ?? 0, evil: kind === 'demon' };
    if (d) {
      // 有名有姓的 NPC：赃物进他的储物袋（活世界的买卖系统自会消化）
      d.bag ??= {}; for (const [id, n] of got.items) d.bag[id] = (d.bag[id] ?? 0) + n; d.wealth += got.ls;
      rb.x = d.x; rb.y = d.y;
    } else {
      // 无名劫修：在附近找个落脚处扎营
      const T = g.terrain;
      for (let i = 0; i < 30; i++) { const an = Math.random() * Math.PI * 2, dd = rand(2200, 3800); const x = here.x + Math.cos(an) * dd, y = here.y + Math.sin(an) * dd * 0.8; if (x > 600 && y > 600 && x < WORLD_W - 600 && y < WORLD_H - 600 && T.isLand(x, y) && T.walkFactor(x, y) > 0.3 && !T.inLocZone(x, y, 300)) { rb.x = x; rb.y = y; break; } }
    }
    const f = g.ws.flags as any; f.robbed ??= []; (f.robbed as Robbed[]).push(rb);
    g.news(`${who}在${dirName(here.x - rb.x, here.y - rb.y)}方劫了韩立的储物袋。`, 'personal');
    g.toast(`（寻仇夺回：据说${who}${d ? '回了老巢' : `在${dirName(rb.x - here.x, rb.y - here.y)}方扎了营`}。他会花你的灵石、卖你的东西——去晚了就真没了）`, 'warn');
  }
}

/** 被魔修掳走：潜行 / 爆发微玩法 */
function captiveNode(g: Game, who: string, sr: { realm: number; stage: number }): DNode {
  const h = g.hero;
  const gap = h.realm - sr.realm;
  const pSneak = clamp(0.5 + gap * 0.2 + jingLiBonus(g, 'captive'), 0.15, 0.9);
  const pBurst = clamp(0.35 + gap * 0.25, 0.1, 0.85);
  const out = (ok: boolean, how: string): DNode => {
    const town = toTown(g);
    if (ok) {
      addJingLi(g, 'captive', `曾被${who}掳入洞府，${how}逃出生天。`);
      g.combat.fade = 1; g.updateUI(true); g.toast(`你逃出了${who}的洞府，一路狂奔，三日后才敢在${town}落脚。储物袋还在。`, 'good');
      return { speaker: '心念', text: `你${how}，趁夜遁出洞府。身后${who}的怒吼响彻山谷。\n\n储物袋还在身上——这一次算是走运。`, options: [{ label: '……', act: () => null }] };
    }
    const got = searchBag(g, 0.85, true);
    h.lifeLost += 3; daoShang(g, 25, '炼宝阵法的侵蚀');
    g.combat.fade = 1; g.updateUI(true);
    addJingLi(g, 'captive', `曾被${who}掳入洞府炼宝，侥幸脱身，精血折损。`);
    return { speaker: '心念', text: `你${how}，却被阵法所阻。${who}冷笑着把你重新按回法阵，抽了三日精血。\n\n第四日夜里阵法灵力耗尽，你趁隙爬出——储物袋已被搜空（${got.ls ? `灵石 ${got.ls}` : ''}${got.items.length ? '、' + got.items.slice(0, 3).map(([id]) => itemDef(id).name).join('、') + '等' : ''}），寿元折损 3 载。醒来已在${town}。`, options: [{ label: '……', act: () => null }] };
  };
  return { speaker: '心念', mood: 'danger', text: `你在一片阴冷中醒来。手脚被缚灵索捆着，四周是幽绿的阵纹——${who}的洞府。\n\n远处传来炼宝的鼎声。他要以你的精血温养法宝，七日后才会来取。\n\n缚灵索压着你的法力，只余一两成。`, options: [
    { label: `（潜行）趁他炼宝入定，解索摸出去（约 ${Math.round(pSneak * 100)}%）`, act: () => out(Math.random() < pSneak, '咬破舌尖以血解索，贴着阵纹的缝隙') },
    { label: `（爆发）燃烧精血，强行冲阵（约 ${Math.round(pBurst * 100)}%，成败都折寿 2 载）`, tone: 'bad', act: () => { h.lifeLost += 2; return out(Math.random() < pBurst, '燃尽精血撞碎阵眼'); } },
    { label: '（等）看看有没有别的机会', act: () => { const p2 = clamp(pSneak - 0.15, 0.1, 0.8); return { speaker: '心念', text: `第三日，${who}出门了，洞府只留了一道禁制。\n\n但三日的温养，你的精血已去了一成。`, options: [{ label: `（现在走）破禁而出（约 ${Math.round(p2 * 100)}%）`, act: () => { h.lifeLost += 1; return out(Math.random() < p2, '趁主人外出破开禁制'); } }] }; } },
  ] };
}

// ------------------------------------------------------------ 寻仇夺回：每日推进 + 临近时的提示
export function robbedList(g: Game): Robbed[] { return ((g.ws.flags as any).robbed as Robbed[] | undefined) ?? []; }
export function robbedDaily(g: Game, days: number) {
  for (const rb of robbedList(g)) {
    if (rb.done) continue;
    const d = rb.npcId ? g.npcs.byId.get(rb.npcId) : undefined;
    if (rb.npcId && d && !d.alive) { rb.done = true; g.toast(`劫你储物袋的${rb.by}死了，东西想必已散落他人之手。`, 'info'); continue; }
    // 每过十天：卖掉一成五的东西、花掉两成灵石（有名有姓的由活世界自己花，这里只处理无名劫修）
    if (!d) {
      for (let i = 0; i < days; i++) {
        if (Math.random() < 0.015 && rb.items.length) { const k = Math.floor(Math.random() * rb.items.length); rb.items.splice(k, 1); }
        if (Math.random() < 0.02) rb.ls = Math.floor(rb.ls * 0.8);
      }
      if (!rb.items.length && rb.ls < 5) { rb.done = true; g.toast(`${rb.by}把劫你的东西挥霍一空，已不知去向。`, 'warn'); continue; }
    } else { rb.x = d.x; rb.y = d.y; }
    if (g.day - rb.day > 240) { rb.done = true; g.toast(`${rb.by}的踪迹已断，你的东西算是找不回来了。`, 'warn'); }
  }
}
/** 无名劫修的营地：玩家走近 → 由奇遇系统生成一伙劫修，打赢拿回赃物 */
export function campNear(g: Game): Robbed | null {
  const p = g.player;
  for (const rb of robbedList(g)) {
    if (rb.done || rb.npcId || rb.map !== ACTIVE_MAP) continue;
    const dist = Math.hypot(rb.x - p.x, rb.y - p.y);
    if (dist < Math.max(1800, g.senseRadius * 1.1)) return rb;
    if (g.day - (rb.lastTip ?? -99) >= 20) { rb.lastTip = g.day; g.toast(`（打听到：劫你储物袋的${rb.by}在${dirName(rb.x - p.x, rb.y - p.y)}方约${Math.round(dist / 100)}里处落脚）`, 'info'); }
  }
  return null;
}
export function campRecover(g: Game, rb: Robbed) {
  const h = g.hero;
  rb.done = true;
  const back: string[] = [];
  for (const [id, n] of rb.items) { C.addItem(h, id, n); back.push(itemDef(id).name + (n > 1 ? '×' + n : '')); }
  if (rb.ls > 0) { C.addItem(h, 'mat_lingshi', rb.ls); back.unshift(`灵石 ${rb.ls}`); }
  addJingLi(g, 'recover', `被${rb.by}劫去储物袋，追至其营地夺回。`);
  g.toast(back.length ? `你从${rb.by}的尸身旁搜回了：${back.join('、')}。（有些已被他卖掉）` : `${rb.by}的营地里已经没有你的东西了。`, back.length ? 'good' : 'warn');
}

// ------------------------------------------------------------ 夺舍老魔：神识对抗（骗局 #5 的后半段）
export function duosheNode(g: Game, who: string, realm: number, onWin: () => void, onLose: () => void): DNode {
  const h = g.hero;
  const sense = C.heroStats(h).sense;
  let will = clamp(0.1 + (h.realm - realm) * 0.25 + sense / 4000 + jingLiBonus(g, 'duoshe'), -0.3, 0.6);   // 开局的神魂优势
  const step = (i: number): DNode => {
    if (i >= 3) {
      const p = clamp(0.5 + will, 0.05, 0.95);
      const ok = Math.random() < p;
      if (ok) { onWin(); return { speaker: '心念', mood: 'mystic', text: `那缕神魂发出一声不甘的尖啸，被你的神识一寸寸碾碎。\n\n识海重归清明。地上的"前辈"七窍流血，再无声息——他的储物袋还在。`, options: [{ label: '搜他的储物袋', tone: 'gold', act: () => null }] }; }
      onLose(); return { speaker: '心念', mood: 'danger', text: `你的神识被一股阴寒之力死死缠住，一寸寸往识海深处退。\n\n千钧一发之际，心口的掌天瓶微微一热，一缕绿光横扫识海——那神魂惨叫着被逐出体外，可你也吐血倒地。\n\n（道伤六十日，修为损失两成。那老魔的神魂遁走了——他记住你了）`, options: [{ label: '……', act: () => null }] };
    }
    const T = [
      { text: `你把一口灵力渡入"前辈"体内——\n\n就在相触的刹那，一股阴冷的东西顺着手臂逆冲而上，直扑你的识海！\n\n「好一具纯净的肉身……小子，老夫借用了！」`, opts: [
        { label: '（断臂！）一剑斩断相触的手臂', v: 0.25, after: '你毫不犹豫斩下左臂——那阴冷之物只有一半进了识海。（气血大损）', cost: () => { h.hp = Math.max(0.05, h.hp - 0.35); } },
        { label: '（闭锁识海）全力运转神识筑起神墙', v: 0.08, after: '你的神识筑起一道墙。那东西撞了上来，墙在摇晃。' },
        { label: '（惊慌后撤）', v: -0.15, after: '退得了身子，退不了识海——它已经进来了。' },
      ] },
      { text: `识海里，一个干枯的老人盘坐着，身后是黑压压的一片神魂碎片——不知夺舍过多少人。\n\n「乖乖让出来，老夫留你一缕残魂，做个傀儡也好过魂飞魄散。」`, opts: [
        { label: '「我韩立的身子，你也配？」（以道心相抗）', v: 0.12, after: '你心中念起一路走来的每一步。那老人的身影淡了一分。' },
        { label: '（用他夺舍过的那些残魂反噬他）', v: 0.18, after: '你放开神识去碰那些碎片——它们尖叫着扑向老人。「不——你们这些废物——」', need: 'sense' },
        { label: '（硬拼神识）', v: 0.02, after: '两股神识撞在一起，识海如沸水翻滚。' },
      ] },
      { text: `老人的面目渐渐变成了你的脸。\n\n「看，你我本就该是一个人。你的记忆……你的功法……有趣，有趣……」`, opts: [
        { label: '（咬破舌尖，以本命精血引爆识海一角）', v: 0.15, after: '轰——识海炸开一片空白。他的脸裂了。', cost: () => { h.lifeLost += 2; } },
        { label: '（静坐不动，让他看）', v: 0.1, after: '他看到了血色禁地、看到了墨大夫、看到了你杀过的每一个人。他的神魂忽然颤了一下——怕了。' },
        { label: '（求饶）「前辈饶命……」', v: -0.25, after: '「这就对了。」他的手按了下来。' },
      ] },
    ][i];
    const opts: DOpt[] = T.opts.filter((o: any) => !o.need || (o.need === 'sense' && sense >= 300)).map((o: any) => ({ label: o.label, tone: o.v < 0 ? 'bad' : undefined, act: () => { will += o.v; o.cost?.(); return { speaker: '识海', mood: 'mystic', text: o.after, options: [{ label: '……', act: () => step(i + 1) }] }; } }));
    return { speaker: i === 0 ? who : '夺舍老魔', mood: 'danger', text: T.text, options: opts };
  };
  return step(0);
}
