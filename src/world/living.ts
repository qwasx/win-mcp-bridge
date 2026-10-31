import roster from './roster.json';
import { ALL_LOCATIONS, LOC_BY_ID } from '../../game/src/data/world';
import { ART_LIST } from '../../game/src/data/arts';
import { ITEM_LIST } from '../../game/src/data/items';
import { REALMS, realmName } from '../../game/src/data/realms';

export type Goal = 'cultivate' | 'gather' | 'trade' | 'visit' | 'sect' | 'vendetta' | 'rest' | 'rob';
export const GOAL_NAME: Record<Goal, string> = { cultivate: '闭关修炼', gather: '山间采药', trade: '坊市交易', visit: '探亲访友', sect: '宗门事务', vendetta: '追查仇怨', rest: '在家休息', rob: '暗中劫掠' };
export type EventKind = Goal | 'request' | 'breakthrough';
export const EVENT_NAME: Record<EventKind, string> = { ...GOAL_NAME, request: '旧友传讯', breakthrough: '境界突破' };
export interface Stack { id: string; name: string; qty: number; kind: string; price: number }
export interface Art { id: string; name: string; school: string; proficiency: number }
export interface Relation { id: string; kind: 'family' | 'friend' | 'master' | 'disciple' | 'spouse'; label: string; trust: number }
export interface Grudge { targetId: string; value: number; reason: string; since: number; eventId?: string }
export interface Memory { day: number; text: string; eventId?: string }
export interface Person {
  id: string; name: string; sex: string; role: string; realm: number; stage: number; age: number; life: number;
  pers: string; faction: string; sect?: string; home: string; map: string; location: string; destination?: string;
  x: number; y: number; wealth: number; bag: Stack[]; arts: Art[]; xp: number; health: number;
  goal: Goal; reason: string; alive: boolean; canon: boolean; relations: Relation[]; grudges: Grudge[]; memories: Memory[];
  favor: number; met: boolean; portrait?: string; lastTalk: number;
  playerGrudge?: number; playerWhy?: string;
}
export interface WorldEvent {
  id: string; kind: EventKind; title: string; actorId: string; targetId?: string; location: string; map: string;
  cause: string; startDay: number; dueDay: number; status: 'pending' | 'resolved'; outcome?: string;
  causeEventId?: string; playerChoice?: string; reward?: number;
}
export interface Sect { id: string; name: string; location: string; treasury: number; doctrine: string }
export interface LivingState {
  schema: number; seed: number; day: number; people: Person[]; events: WorldEvent[]; sects: Sect[];
  player: { name: string; stones: number; energy: number; reputation: number; inventory: Stack[]; following: string[] };
  running: boolean; speed: number; cursor: number; serial: number; lastAdvance: number;
}
export type WorldAction =
  | { type: 'tick'; days?: number }
  | { type: 'pause'; running?: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'gift' | 'talk' | 'follow'; personId: string }
  | { type: 'trade'; personId: string; itemId: string }
  | { type: 'reconcile'; personId: string; targetId: string }
  | { type: 'intervene'; eventId: string; choice: 'help' | 'rob' | 'accept' | 'decline' }
  | { type: 'reset' };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const locName = (id: string) => LOC_BY_ID.get(id)?.name ?? id;
const random = (s: LivingState) => { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; };
const pick = <T,>(s: LivingState, a: T[]): T | undefined => a[Math.floor(random(s) * a.length)];
const person = (s: LivingState, id: string) => s.people.find(p => p.id === id);
const alive = (s: LivingState) => s.people.filter(p => p.alive);
const power = (p: Person) => p.realm * 13 + p.stage + p.arts.reduce((a, b) => a + b.proficiency, 0) / 400;
const need = (p: Person) => (REALMS[p.realm]?.expDays[p.stage] ?? 1000) * 10;
export const sectName = (s: LivingState, id?: string) => s.sects.find(x => x.id === id)?.name ?? (id ? locName(id) : '散修');
export const artLevel = (proficiency: number) => proficiency >= 300 ? '圆满' : proficiency >= 150 ? '大成' : proficiency >= 60 ? '小成' : '初学';
export const dateLabel = (day: number) => `灵历 ${Math.floor(day / 360) + 1} 年 · ${Math.floor(day / 30) % 12 + 1} 月 · ${Math.floor(day) % 30 + 1} 日`;

function memory(s: LivingState, p: Person, text: string, eventId?: string) {
  p.memories.unshift({ day: s.day, text, eventId }); p.memories = p.memories.slice(0, 16);
}
function addStack(bag: Stack[], item: Stack, qty = item.qty) {
  const old = bag.find(x => x.id === item.id);
  if (old) old.qty += qty; else bag.push({ ...item, qty });
}
function takeStack(bag: Stack[], id: string, qty = 1) {
  const i = bag.findIndex(x => x.id === id); if (i < 0 || bag[i].qty < qty) return undefined;
  const item = { ...bag[i], qty }; bag[i].qty -= qty; if (bag[i].qty <= 0) bag.splice(i, 1); return item;
}
function relation(a: Person, b: Person, kind: Relation['kind'], label: string, trust = 30) {
  const old = a.relations.find(r => r.id === b.id); if (old) return old;
  const r = { id: b.id, kind, label, trust }; a.relations.push(r); return r;
}
function grudge(s: LivingState, a: Person, b: Person, value: number, reason: string, eventId?: string) {
  const old = a.grudges.find(g => g.targetId === b.id);
  if (old) { old.value = clamp(old.value + value, 0, 100); old.reason = reason; old.eventId = eventId ?? old.eventId; }
  else a.grudges.push({ targetId: b.id, value, reason, since: s.day, eventId });
  memory(s, a, `${b.name}：${reason}`, eventId);
}
function event(s: LivingState, kind: EventKind, a: Person, cause: string, target?: Person, due = 2, causeEventId?: string): WorldEvent {
  const e: WorldEvent = { id: `e${++s.serial}`, kind, title: EVENT_NAME[kind], actorId: a.id, targetId: target?.id, location: locName(a.location), map: a.map, cause, startDay: s.day, dueDay: s.day + due, status: 'pending', causeEventId };
  s.events.unshift(e); return e;
}
function setGoal(p: Person, goal: Goal, reason: string, destination?: string) { p.goal = goal; p.reason = reason; p.destination = destination; }

export function createLiving(source: unknown[] = roster): LivingState {
  const sects: Sect[] = ALL_LOCATIONS.filter(l => l.type === 'sect').map(l => ({ id: l.id, name: l.name, location: l.id, treasury: 18000, doctrine: /鬼灵|天魔|合欢|御灵|千幻|天煞|阴罗/.test(l.name) ? '强者为尊 · 魔道传承' : '清心问道 · 同门相济' }));
  const people: Person[] = (source as Record<string, any>[]).map((n, index) => {
    const loc = LOC_BY_ID.get(n.home) ?? ALL_LOCATIONS[0];
    const pool = ART_LIST.filter(a => a.realm <= n.realm && a.tier <= Math.max(0, n.realm));
    const art = pool[index % Math.max(1, pool.length)] ?? ART_LIST[0];
    const realm = clamp(n.realm ?? 1, 0, 5), stage = clamp(n.stage ?? 0, 0, REALMS[realm].stages.length - 1);
    const p: Person = {
      id: n.id, name: n.name, sex: n.sex, role: n.role, realm, stage, age: n.age, life: n.life ?? REALMS[realm].life,
      pers: n.pers, faction: n.faction, sect: n.sect ?? (n.faction === 'sect' || n.faction === 'demon' ? n.home : undefined),
      home: n.home, map: n.map ?? loc.map ?? 'tiannan', location: n.home, x: loc.x / 10, y: loc.y / 7,
      wealth: Math.max(0, Math.round(n.wealth ?? 80)), bag: [], arts: n.faction === 'mortal' ? [] : [{ id: art.id, name: art.name, school: art.school, proficiency: 15 + index % 70 }],
      xp: Math.round((n.seed % 70) / 100 * (REALMS[realm].expDays[stage] ?? 100) * 10), health: 100,
      goal: n.faction === 'mortal' ? 'rest' : 'cultivate', reason: n.faction === 'mortal' ? '操持家中生计，等候家人归来' : '修为尚有精进余地，准备闭关', alive: n.alive !== false, canon: !!n.canon,
      relations: [], grudges: [], memories: [], favor: n.favor ?? 0, met: (n.favor ?? 0) >= 30, lastTalk: -100,
    };
    for (const t of n.ties ?? []) {
      const kind = t.k === 'kin' ? 'family' : t.k === 'lover' ? 'spouse' : t.k === 'master' ? 'master' : t.k === 'disciple' ? 'disciple' : 'friend';
      p.relations.push({ id: t.id, kind, label: t.r, trust: t.k === 'foe' ? 5 : 35 + (n.seed + index) % 45 });
      if (t.k === 'foe') p.grudges.push({ targetId: t.id, value: 45, reason: n.why ?? '旧日交锋，结下恩怨', since: 58 });
    }
    return p;
  });
  const byId = new Map(people.map(p => [p.id, p]));
  for (const p of people) {
    p.relations = p.relations.filter(r => byId.has(r.id));
    if (!p.relations.length) {
      const kin = people.find(o => o.id !== p.id && o.home === p.home && o.name.slice(0, 1) === p.name.slice(0, 1) && Math.abs(o.age - p.age) > 15);
      if (kin) { relation(p, kin, 'family', kin.age > p.age ? '父亲' : '女儿', 65); relation(kin, p, 'family', kin.age > p.age ? '女儿' : '父亲', 65); }
    }
    if (p.alive) {
      addStack(p.bag, { id: 'herb_lingzhi', name: '灵芝', qty: 2 + p.realm, kind: 'herb', price: 12 });
      if (p.realm > 0) addStack(p.bag, { id: 'pill_juqi', name: '聚气丹', qty: 2, kind: 'pill', price: 28 });
      const item = ITEM_LIST.filter(i => i.type === 'artifact' && i.tier <= p.realm && i.price > 0)[p.name.length % 5];
      if (item) addStack(p.bag, { id: item.id, name: item.name, qty: 1, kind: item.type, price: item.price });
    }
  }
  const s: LivingState = { schema: 1, seed: 20241015, day: 60, people, events: [], sects, player: { name: '韩立', stones: 1280, energy: 100, reputation: 12, inventory: [], following: [] }, running: true, speed: 1, cursor: 0, serial: 0, lastAdvance: Date.now() };
  const lu = person(s, 'o_luqingya'), su = person(s, 'o_liusanniang'), yan = person(s, 'lihuayuan'), robber = person(s, 'o_mengtieshan'), friend = person(s, 'lifeiyu');
  if (lu) { lu.portrait = '/images/npc-lu.jpg'; lu.favor = 42; lu.met = true; lu.goal = 'gather'; lu.reason = '闭关在即，还缺两株黄精'; lu.location = 'huangfeng'; lu.map = 'tiannan'; memory(s, lu, '在黄枫谷与你相识，记得你精通木系功法。'); }
  if (su) { su.portrait = '/images/npc-su.jpg'; su.favor = 36; su.met = true; su.goal = 'trade'; su.reason = '茶楼新到一批灵茶，准备去坊市寻些货源'; }
  if (yan) { yan.portrait = '/images/npc-yan.jpg'; yan.goal = 'sect'; yan.reason = '门中弟子即将试炼，安排护法与丹药'; }
  if (lu && robber) {
    robber.wealth = 12; robber.location = 'tainan'; robber.map = 'tiannan';
    const purchase = event(s, 'trade', robber, '冲击炼气后期失败，储物袋里的聚气丹已经用尽。'); purchase.startDay = 58; purchase.dueDay = 59; purchase.status = 'resolved'; purchase.outcome = '坊市丹药用度超出预算，没有买到足够的丹药。';
    const robbery = event(s, 'rob', robber, '缺少突破所需丹药，又打听到陆青崖采药归来，决定在山路伏击。', lu, 3, purchase.id); robbery.title = '山道上的不速之客';
    grudge(s, lu, robber, 12, '近日屡次在药园外窥探，行迹可疑');
  }
  if (friend) { friend.favor = 40; friend.met = true; const e = event(s, 'request', friend, '七玄门旧友厉飞雨来信：门中晚辈需要一批草药。记得你识得灵草，想请你同行，并非紧急求救。', undefined, 6); e.title = '一封来自七玄门的信'; e.reward = 35; }
  if (su) event(s, 'visit', su, '春日渐暖，想带些新茶去探望师父。', person(s, 'o_huiming'), 2);
  if (yan) event(s, 'sect', yan, '黄枫谷开启季度试炼，需为弟子准备护身法器。', undefined, 4);
  s.events.sort((a, b) => b.startDay - a.startDay);
  return s;
}

function die(s: LivingState, p: PlayerPerson, cause: string) {
  if (!p.alive) return; p.alive = false; p.health = 0; memory(s, p, cause);
  const heir = p.relations.filter(r => r.kind === 'family' || r.kind === 'spouse').map(r => person(s, r.id)).find(o => o?.alive);
  if (heir) { heir.wealth += p.wealth; for (const i of p.bag) addStack(heir.bag, i, i.qty); memory(s, heir, `继承${p.name}的储物袋与遗物：${cause}`); }
  p.wealth = 0; p.bag = [];
}
type PlayerPerson = Person;

function resolve(s: LivingState, e: WorldEvent) {
  if (e.status !== 'pending') return;
  const a = person(s, e.actorId), b = e.targetId ? person(s, e.targetId) : undefined;
  e.status = 'resolved';
  if (!a?.alive) { e.outcome = '发起人已经不在人世，此事就此终止。'; return; }
  const helped = e.playerChoice === 'help' || e.playerChoice === 'accept';
  switch (e.kind) {
    case 'gather': { const n = 1 + Math.floor(random(s) * 3); addStack(a.bag, { id: 'herb_huangjing', name: '黄精', qty: n, kind: 'herb', price: 4 }, n); a.xp += 20; e.outcome = `采得黄精 ×${n}，已放入自己的储物袋。`; break; }
    case 'cultivate': { const pill = takeStack(a.bag, 'pill_juqi'); a.xp += pill ? 90 : 45; if (a.arts[0]) a.arts[0].proficiency = Math.min(400, a.arts[0].proficiency + 12); e.outcome = pill ? '服用一枚聚气丹，修为 +90，功法熟练度 +12。' : '静修一日，修为 +45，功法熟练度 +12。'; break; }
    case 'trade': {
      const item = a.bag.find(i => i.kind === 'herb');
      if (b?.alive && item && b.wealth >= item.price) { takeStack(a.bag, item.id); addStack(b.bag, item); a.wealth += item.price; b.wealth -= item.price; e.outcome = `${item.name}卖给${b.name}，获得 ${item.price} 灵石；货物与钱款同时易手。`; }
      else e.outcome = '没有谈拢价格，货物仍留在储物袋中。'; break;
    }
    case 'visit': { if (b?.alive) { const r1 = relation(a, b, 'friend', '友人'), r2 = relation(b, a, 'friend', '友人'); r1.trust = clamp(r1.trust + 8, 0, 100); r2.trust = clamp(r2.trust + 8, 0, 100); e.outcome = `与${b.name}互诉近况，彼此信任 +8。`; } else e.outcome = '故人不在，留下问候后离去。'; break; }
    case 'sect': { const sect = s.sects.find(x => x.id === a.sect); const reward = Math.min(35, sect?.treasury ?? 0); if (sect) sect.treasury -= reward; a.wealth += reward; a.xp += 35; e.outcome = `完成宗门事务，从宗门库藏领取 ${reward} 灵石。`; break; }
    case 'rob': {
      if (!b?.alive) { e.outcome = '目标已经离去，劫案没有发生。'; break; }
      if (helped || power(b) > power(a) + 3) { grudge(s, b, a, 35, `${a.name}在山道伏击我`, e.id); e.outcome = helped ? '你及时出面，击退劫修。草药保住了，这份人情被记下。' : `${b.name}察觉伏击，凭修为击退${a.name}。`; if (helped) { b.favor = clamp(b.favor + 12, -100, 100); const reward = Math.min(15, b.wealth); b.wealth -= reward; s.player.stones += reward; e.reward = reward; } break; }
      const item = b.bag.find(i => i.kind !== 'artifact'); const cash = Math.min(30, b.wealth);
      if (item) { takeStack(b.bag, item.id); addStack(a.bag, item); } b.wealth -= cash; a.wealth += cash;
      grudge(s, b, a, 55, `${a.name}抢走我的${item?.name ?? '灵石'}（${cash} 灵石）`, e.id);
      e.outcome = `${a.name}劫走${item?.name ?? '货物'}与 ${cash} 灵石。${b.name}已记下这笔仇。`;
      const kin = b.relations.map(r => person(s, r.id)).find(p => p?.alive && (p.realm > a.realm || p.pers === 'righteous'));
      if (kin) { grudge(s, kin, a, 40, `我的家人${b.name}遭到抢劫`, e.id); if (s.events.filter(x => x.status === 'pending').length < 45) event(s, 'vendetta', kin, `${b.name}遭劫，${kin.name}得知消息，准备追查${a.name}。`, a, 4, e.id); }
      break;
    }
    case 'vendetta': { if (!b?.alive) { e.outcome = '仇人已故，恩怨终结。'; break; } const win = power(a) >= power(b); const loser = win ? b : a; loser.health -= 45; e.outcome = `${a.name}与${b.name}当面对质，${loser.name}在冲突中受伤。`; if (loser.health <= 0) die(s, loser, `死于与${(win ? a : b).name}的仇杀`); else memory(s, loser, e.outcome, e.id); break; }
    case 'request': { if (e.playerChoice === 'decline') e.outcome = '你婉拒了邀请，对方另寻同伴，没有强迫你前往。'; else if (helped) { const reward = Math.min(a.wealth, e.reward ?? 25); a.wealth -= reward; s.player.stones += reward; e.reward = reward; a.favor = clamp(a.favor + 8, -100, 100); e.outcome = `你应邀同行，事情顺利完成，获得 ${reward} 灵石。`; } else e.outcome = '信笺没有收到回音，对方另寻同伴，此事自行结束。'; break; }
    case 'breakthrough': { if (a.xp >= need(a)) { a.xp -= need(a); a.stage++; e.outcome = `闭关功成，突破至${realmName(a.realm, a.stage)}。`; } else e.outcome = '灵气尚差一线，继续积累修为。'; break; }
    case 'rest': e.outcome = '处理完家中事务，安稳度过一日。'; break;
  }
  if (a.alive) memory(s, a, e.outcome!, e.id);
  if (e.playerChoice === 'help') s.player.energy = Math.min(100, s.player.energy + 5);
  setGoal(a, a.realm === 0 ? 'rest' : 'cultivate', '事情已了，打算休整后再作打算');
}

export function advance(input: LivingState, days = 1): LivingState {
  const s = clone(input); days = clamp(Math.floor(days) || 1, 1, 30); s.day += days; s.lastAdvance = Date.now();
  for (const e of s.events) if (e.status === 'pending' && e.dueDay <= s.day) resolve(s, e);
  const list = alive(s);
  for (const p of list) {
    p.age += days / 360;
    if (p.age >= p.life) { die(s, p, '寿元耗尽，遗物交给家人'); continue; }
    p.health = Math.min(100, p.health + days);
    if (p.realm > 0) p.xp += days * (p.goal === 'cultivate' ? 10 : 4);
    for (const g of p.grudges) g.value = Math.max(0, g.value - days * 0.08);
    p.grudges = p.grudges.filter(g => g.value > 0);
  }
  const candidates = alive(s);
  const count = Math.min(candidates.length, 20 * days);
  for (let i = 0; i < count && s.events.filter(e => e.status === 'pending').length < 48; i++) {
    const p = candidates[(s.cursor + i) % candidates.length]; if (!p) continue;
    if (s.events.some(e => e.status === 'pending' && e.actorId === p.id)) continue;
    const nearby = candidates.filter(o => o.id !== p.id && o.map === p.map);
    const known = p.relations.map(r => person(s, r.id)).filter(o => o?.alive) as Person[];
    const enemy = p.grudges.map(g => person(s, g.targetId)).find(o => o?.alive && o.map === p.map);
    let kind: Goal = 'cultivate', target: Person | undefined, cause = '';
    if (enemy && enemy.grudges.some(g => g.targetId === p.id)) { kind = 'vendetta'; target = enemy; cause = `记得${enemy.name}昔日加害于我，准备当面了结恩怨。`; }
    else if (p.xp >= need(p) && p.realm > 0) { kind = 'cultivate'; cause = '修为已至瓶颈，决定闭关冲击下一层境界。'; }
    else if (!p.bag.some(i => i.kind === 'pill') && p.realm > 0 && p.wealth < 35 && (p.pers === 'greedy' || p.pers === 'ruthless')) { const rich = nearby.find(o => o.wealth > 90 && o.id !== p.id); if (rich) { kind = 'rob'; target = rich; cause = `丹药耗尽、囊中羞涩，盯上了携带财物的${rich.name}。`; } }
    else if (known.length && random(s) < 0.3) { kind = 'visit'; target = pick(s, known); cause = `挂念${target?.name}，趁空闲前去探望。`; }
    else if (p.bag.some(i => i.kind === 'herb' && i.qty > 3)) { kind = 'trade'; target = pick(s, nearby.filter(o => o.faction === 'merchant')); cause = '储物袋里草药渐多，去坊市换取修炼所需灵石。'; }
    else if (p.sect && random(s) < 0.35) { kind = 'sect'; cause = '收到师门安排，为宗门完成本月事务。'; }
    else if (p.realm > 0 && random(s) < 0.48) { kind = 'gather'; cause = '修行所需灵草不足，准备进山采集。'; }
    else if (p.realm === 0) { kind = 'rest'; cause = '照料家中生计，等待家人归来。'; }
    else cause = '今日无事，继续修炼以积累修为。';
    setGoal(p, kind, cause, target?.location);
    const ev = event(s, kind, p, cause, target, 1 + Math.floor(random(s) * 4));
    if (kind === 'cultivate' && p.xp >= need(p)) { ev.kind = 'breakthrough'; ev.title = '静室里的突破'; }
    if (kind === 'visit' && target) ev.title = `去见${target.name}`;
    if (kind === 'gather') ev.title = pick(s, ['山间采药', '为闭关寻药', '药园晨采']) ?? '山间采药';
    if (kind === 'cultivate') ev.title = p.xp >= need(p) ? '静室里的突破' : '闭关养气';
    if (kind === 'sect') ev.title = `${sectName(s, p.sect)}事务`;
    if (kind === 'vendetta' && target) ev.title = `追查${target.name}`;
    if (kind === 'rest') ev.title = '家中一日';
    if (kind === 'rob' && target) ev.title = '山道上的不速之客';
    if (kind === 'gather' && p.favor >= 35 && p.met && s.events.filter(e => e.kind === 'request' && e.status === 'pending').length < 2 && random(s) < 0.16) {
      ev.kind = 'request'; ev.title = `${p.name}的采药之约`; ev.cause = `${p.name}记得与你相识（好感 ${Math.round(p.favor)}），又知你熟悉灵草，因此来信邀你同行。可以拒绝，不会强制传送到场。`; ev.reward = 25; ev.dueDay = s.day + 6;
    }
  }
  s.cursor = (s.cursor + count) % Math.max(1, candidates.length);
  s.player.energy = Math.min(100, s.player.energy + days * 2);
  s.events = s.events.slice(0, 180);
  return s;
}

export function act(input: LivingState, action: WorldAction): { state: LivingState; message: string } {
  if (action.type === 'reset') return { state: createLiving(), message: '新世界已生成，人物与因果关系已重置。' };
  let s = clone(input);
  if (action.type === 'tick') return { state: advance(s, action.days), message: `世界已向前推进 ${clamp(Math.floor(action.days ?? 1), 1, 30)} 日。` };
  if (action.type === 'pause') { s.running = action.running ?? !s.running; return { state: s, message: s.running ? '世界时钟继续流转。' : '世界已暂停，仍可手动推进时间。' }; }
  if (action.type === 'speed') { if (![1, 2, 5].includes(action.speed)) throw new Error('支持 1×、2×、5× 时间流速'); s.speed = action.speed; return { state: s, message: `时间流速已设为 ${s.speed}×` }; }
  if (action.type === 'intervene') {
    const e = s.events.find(e => e.id === action.eventId); if (!e || e.status !== 'pending') throw new Error('这件事已经结束，请查看事件结果。');
    if (e.playerChoice) throw new Error('你已经介入这件事了。');
    if (action.choice === 'help' && s.player.energy < 10) throw new Error('精力不足，推进时间可以恢复精力。');
    e.playerChoice = action.choice;
    if (action.choice === 'help') { s.player.energy -= 10; resolve(s, e); return { state: s, message: e.outcome! }; }
    if (action.choice === 'rob') { const a = person(s, e.actorId), b = e.targetId ? person(s, e.targetId) : undefined; if (b && a) grudge(s, b, a, 20, '你参与了对我的劫掠', e.id); s.player.reputation -= 8; resolve(s, e); return { state: s, message: '你选择了另一条路。声望下降，相关人记住了你的行为。' }; }
    if (action.choice === 'accept') { resolve(s, e); return { state: s, message: e.outcome! }; }
    resolve(s, e); return { state: s, message: '已婉拒邀请。对方会另作安排，不会强制你前往。' };
  }
  const p = person(s, action.personId); if (!p?.alive) throw new Error('此人已经不在人世。');
  if (action.type === 'gift') {
    if (s.player.stones < 20) throw new Error('灵石不足，赠礼需要 20 灵石。'); s.player.stones -= 20; p.wealth += 20; p.favor = clamp(p.favor + 8, -100, 100); p.met = true;
    memory(s, p, '收到韩立赠予的 20 灵石，好感 +8。'); return { state: s, message: `赠予${p.name} 20 灵石，好感 +8。` };
  }
  if (action.type === 'talk') {
    if (s.day - p.lastTalk < 1) throw new Error('今日已经聊过，明日再来吧。'); p.lastTalk = s.day; p.met = true; p.favor = clamp(p.favor + 2, -100, 100);
    memory(s, p, `韩立前来问候。我告诉他：${p.reason}。`); return { state: s, message: `${p.name}：「${p.reason}。多谢道友挂念。」` };
  }
  if (action.type === 'follow') { const exists = s.player.following.includes(p.id); s.player.following = exists ? s.player.following.filter(id => id !== p.id) : [...s.player.following, p.id]; return { state: s, message: exists ? `已取消关注${p.name}` : `已关注${p.name}，可在「我的关注」中找回。` }; }
  if (action.type === 'trade') {
    const item = p.bag.find(i => i.id === action.itemId && i.kind !== 'artifact'); if (!item) throw new Error('储物袋中没有可交易的这件物品，或此物不售卖。');
    if (s.player.stones < item.price) throw new Error('你的灵石不足。');
    const bought = takeStack(p.bag, item.id)!; s.player.stones -= item.price; p.wealth += item.price; addStack(s.player.inventory, bought);
    memory(s, p, `将${item.name}卖给韩立，获得 ${item.price} 灵石。`); return { state: s, message: `买入${item.name} ×1，${item.price} 灵石已交给${p.name}。` };
  }
  if (action.type === 'reconcile') {
    const target = person(s, action.targetId), g = p.grudges.find(g => g.targetId === action.targetId); if (!target || !g) throw new Error('这两人之间没有需要化解的仇怨。');
    if (s.player.stones < 30) throw new Error('调解需要 30 灵石。'); s.player.stones -= 30; target.wealth += 30; g.value = Math.max(0, g.value - 30);
    memory(s, p, `韩立出面调解，向${target.name}赔付 30 灵石，仇怨 -30。`, g.eventId); memory(s, target, `收到韩立代${p.name}赔付的 30 灵石。`, g.eventId);
    p.grudges = p.grudges.filter(g => g.value > 0); return { state: s, message: g.value <= 0 ? '双方愿意放下旧怨，这段仇恨已化解。' : `旧怨尚未尽消，仇怨降至 ${Math.round(g.value)}。` };
  }
  throw new Error('未知操作');
}

export function validateAction(value: unknown): WorldAction {
  if (!value || typeof value !== 'object') throw new Error('请提供有效操作');
  const a = value as Record<string, unknown>;
  const str = (k: string) => { if (typeof a[k] !== 'string' || !(a[k] as string).length || (a[k] as string).length > 100) throw new Error(`操作参数 ${k} 无效`); return a[k] as string; };
  switch (a.type) {
    case 'tick': if (a.days !== undefined && (typeof a.days !== 'number' || !Number.isInteger(a.days) || a.days < 1 || a.days > 30)) throw new Error('推进天数须为 1–30'); return { type: 'tick', days: a.days as number | undefined };
    case 'pause': if (a.running !== undefined && typeof a.running !== 'boolean') throw new Error('运行状态无效'); return { type: 'pause', running: a.running as boolean | undefined };
    case 'speed': if (typeof a.speed !== 'number') throw new Error('流速无效'); return { type: 'speed', speed: a.speed };
    case 'gift': case 'talk': case 'follow': return { type: a.type, personId: str('personId') };
    case 'trade': return { type: 'trade', personId: str('personId'), itemId: str('itemId') };
    case 'reconcile': return { type: 'reconcile', personId: str('personId'), targetId: str('targetId') };
    case 'intervene': if (!['help', 'rob', 'accept', 'decline'].includes(String(a.choice))) throw new Error('介入方式无效'); return { type: 'intervene', eventId: str('eventId'), choice: a.choice as 'help' | 'rob' | 'accept' | 'decline' };
    case 'reset': return { type: 'reset' };
    default: throw new Error('未知操作');
  }
}
