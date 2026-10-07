// 全局游戏状态、常用辅助函数、新游戏生成
import type { FactionId } from '../data/world';
import { FACTION, FACTIONS, INITIAL_WARS, LORD_DEFS, MAJOR_FACTIONS, MONTHS, SHICHEN, TOWN_DEFS, VILLAGE_NAMES, VILLAGE_PRODUCE, COMPANIONS, BANDIT_ZONES, CHINESE_NUM } from '../data/world';
import { RECRUIT_OF, TROOPS, MERCS, type Culture } from '../data/troops';
import { GOODS, ITEM_LIST } from '../data/items';
import type { GameState, Party, PartyKind, Settlement, Stack, Lord } from './state';
import { warKey } from './state';
import { buildGrid, ll, nearestPassable, passable } from './terrain';
import { newHero } from './character';
import { addTroops, count } from './party';
import { pick, randInt, randRange, chance, shuffle, dist, weighted } from './rng';

export let S: GameState = null as unknown as GameState;
export function setState(s: GameState) { S = s; }

// ---------- 事件总线 ----------
type Listener = (...args: any[]) => void;
const listeners: Record<string, Listener[]> = {};
export function on(ev: string, fn: Listener) { (listeners[ev] ||= []).push(fn); }
export function emit(ev: string, ...args: any[]) { for (const fn of listeners[ev] || []) fn(...args); }

// ---------- 日志 ----------
export function log(msg: string, cls = '') {
  S.log.push({ t: S.time, msg, cls });
  if (S.log.length > 300) S.log.splice(0, S.log.length - 300);
  emit('log', msg, cls);
}

// ---------- 日期 ----------
export function dayOf(t: number) { return Math.floor(t / 24); }
export function cnNum(n: number): string {
  if (n <= 10) return CHINESE_NUM[n];
  if (n < 20) return '十' + CHINESE_NUM[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  return CHINESE_NUM[t] + '十' + (o ? CHINESE_NUM[o] : '');
}
export function dateStr(t = S.time) {
  const d = dayOf(t);
  const year = Math.floor(d / 360) + 8;
  const month = Math.floor((d % 360) / 30);
  const day = (d % 30) + 1;
  const hour = Math.floor(t % 24);
  const sc = SHICHEN[Math.floor(((hour + 1) % 24) / 2)];
  const dayStr = day <= 10 ? '初' + CHINESE_NUM[day] : cnNum(day);
  return `崇祯${year === 1 ? '元' : cnNum(year)}年 ${MONTHS[month]}${dayStr} ${sc}时`;
}
export function isNight(t = S.time) { const h = t % 24; return h < 5 || h >= 20; }

// ---------- 势力关系 ----------
export function atWar(a: string, b: string) {
  if (a === b) return false;
  if (a === 'bandit' || b === 'bandit') return true;
  return S.wars.includes(warKey(a, b));
}
export function setWar(a: string, b: string, war: boolean) {
  const k = warKey(a, b);
  const i = S.wars.indexOf(k);
  if (war && i < 0) S.wars.push(k);
  if (!war && i >= 0) S.wars.splice(i, 1);
}
export function playerOwnsLand() { return Object.values(S.settlements).some(s => s.owner === 'player'); }
/** 玩家实际所属阵营 */
export function playerSide(): FactionId | null {
  if (S.playerFaction) return S.playerFaction;
  if (S.mercOf) return S.mercOf;
  if (playerOwnsLand()) return 'player';
  return null;
}
export function playerHostileTo(f: string): boolean {
  if (f === 'bandit') return true;
  if (f === 'none') return false;
  const side = playerSide();
  if (side && f === side) return false;
  if (side && atWar(side, f)) return true;
  if (!side && atWar('player', f)) return true;
  return (S.playerRel[f] ?? 0) <= -10;
}
export function hostile(a: Party, b: Party) {
  if (a.kind === 'player') return playerHostileTo(b.faction);
  if (b.kind === 'player') return playerHostileTo(a.faction);
  return atWar(a.faction, b.faction);
}
export function factionHostileToSettlement(f: string, st: Settlement) {
  if (st.owner === 'player') return f === 'player' ? false : (playerSide() ? atWar(playerSide()!, f) : atWar('player', f)) || (S.playerRel[f] ?? 0) <= -10;
  return atWar(f, st.faction);
}
export function playerHostileToSettlement(st: Settlement) { return st.owner !== 'player' && playerHostileTo(st.faction); }
export function changePlayerRel(f: string, d: number) {
  if (f === 'bandit' || f === 'none' || f === 'player') return;
  const before = S.playerRel[f] ?? 0;
  S.playerRel[f] = Math.max(-100, Math.min(100, before + d));
  if (before > -10 && S.playerRel[f] <= -10) log(`${FACTION[f].name}已将你视为敌人！`, 'bad');
}

// ---------- 查询 ----------
export function player(): Party { return S.parties.find(p => p.id === S.playerId)!; }
export function partyById(id: number) { return S.parties.find(p => p.id === id); }
export function settlementList() { return Object.values(S.settlements); }
export function factionSettlements(f: string) { return settlementList().filter(s => s.faction === f); }
export function lordName(id: string | null) {
  if (!id) return '无';
  if (id === 'player') return S.hero.name;
  if (id.startsWith('ruler_')) { const f = FACTION[id.slice(6)]; return `${f.rulerTitle}${f.ruler}`; }
  const l = S.lords[id]; return l ? l.name : '无';
}
export function nearestSettlement(x: number, y: number, filter: (s: Settlement) => boolean = () => true) {
  let best: Settlement | null = null, bd = Infinity;
  for (const s of settlementList()) { if (!filter(s)) continue; const d = dist(x, y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
export function cultureOf(f: string): Culture {
  if (f === 'player') return (S.playerFaction ? FACTION[S.playerFaction].culture : 'ming') as Culture;
  return (FACTION[f]?.culture ?? 'ming') as Culture;
}
export function fiefsOf(owner: string) { return settlementList().filter(s => s.owner === owner); }

// ---------- 生成部队 ----------
export function genTroops(culture: string, n: number, quality: number): Stack[] {
  const stacks: Stack[] = [];
  const base = RECRUIT_OF[culture];
  if (!base) return stacks;
  for (let i = 0; i < n; i++) {
    let id = base;
    for (let k = 0; k < 5; k++) {
      const t = TROOPS[id];
      if (!t.upgrades.length || !chance(quality)) break;
      id = pick(t.upgrades);
    }
    addTroops(stacks, id, 1);
  }
  return stacks;
}

export function newId() { return S.nextId++; }

export function makeParty(kind: PartyKind, name: string, faction: FactionId, x: number, y: number, troops: Stack[], extra: Partial<Party> = {}): Party {
  const p: Party = {
    id: newId(), kind, name, faction, x, y, troops, prisoners: [], gold: 0, goods: {},
    ai: { mode: 'idle', nextThink: S.time + Math.random() * 2 }, ...extra,
  };
  S.parties.push(p);
  return p;
}

export function removeParty(p: Party) {
  const i = S.parties.indexOf(p);
  if (i >= 0) S.parties.splice(i, 1);
  if (p.lordId && S.lords[p.lordId]) {
    const l = S.lords[p.lordId];
    l.partyId = null; l.respawnAt = S.time + randRange(48, 120);
  }
  for (const s of settlementList()) if (s.siege && s.siege.by === p.id) s.siege = null;
}

// ---------- 商店与酒馆 ----------
export function refreshShop(st: Settlement) {
  const maxTier = st.kind === 'town' ? (st.prosperity > 60 ? 5 : 4) : 2;
  const pool = ITEM_LIST.filter(i => i.tier <= maxTier && i.price > 25);
  const n = st.kind === 'town' ? randInt(9, 14) : randInt(2, 4);
  st.shop = [];
  for (let i = 0; i < n; i++) {
    const it = weighted(pool.map(p => [p, 6 - p.tier] as [typeof p, number]));
    st.shop.push(it.id);
  }
}
export function refreshTavern(st: Settlement) {
  const used = new Set([...S.companions.map(c => c.id), ...settlementList().map(s => s.tavern.companion).filter(Boolean) as string[]]);
  if (st.tavern.companion) used.delete(st.tavern.companion);
  const free = COMPANIONS.filter(c => !used.has(c.id));
  st.tavern.companion = free.length && chance(0.35) ? pick(free).id : null;
  st.tavern.mercs = chance(0.6) ? { id: pick(MERCS), n: randInt(3, 9) } : null;
  st.tavern.refresh = S.time + 24 * randInt(5, 9);
}

// ---------- 新游戏 ----------
export interface Background { id: string; name: string; desc: string; apply: (s: GameState) => void }

export const BACKGROUNDS: Background[] = [
  {
    id: 'soldier', name: '卫所军户', desc: '世袭军户出身，自幼习武。力量+2，铁骨1、强击1、骑术1，带着五名同乡民壮。',
    apply: s => { const h = s.hero; h.attrs.str += 2; h.skills.ironflesh = 1; h.skills.powerstrike = 1; h.skills.riding = 1; h.equip.melee = 'w_podao'; h.equip.armor = 'a_pao'; h.equip.helm = 'h_iron'; addTroops(player().troops, 'ming_recruit', 5); player().gold = 350; },
  },
  {
    id: 'merchant', name: '江南商贾', desc: '苏州丝商之子，家道中落。智力+1、魅力+1，交易2、寻路1，盘缠充足，还有一批丝绸。',
    apply: s => { const h = s.hero; h.attrs.int += 1; h.attrs.cha += 1; h.skills.trade = 2; h.skills.pathfinding = 1; h.equip.melee = 'w_hunting'; player().gold = 1400; player().goods.silk = 4; h.equip.horse = 'm_pack'; },
  },
  {
    id: 'scholar', name: '落第书生', desc: '寒窗十年，屡试不第，投笔从戎。智力+2，医术2、战术1、统御1。',
    apply: s => { const h = s.hero; h.attrs.int += 2; h.skills.surgery = 2; h.skills.tactics = 1; h.skills.leadership = 1; h.equip.melee = 'w_chaidao'; player().gold = 700; addTroops(player().troops, 'ming_recruit', 3); },
  },
  {
    id: 'hunter', name: '辽东猎户', desc: '在白山黑水间讨生活的猎户。敏捷+2，射术2、骑术2、侦察1，自带角弓与蒙古马。',
    apply: s => { const h = s.hero; h.attrs.agi += 2; h.skills.archery = 2; h.skills.riding = 2; h.skills.spotting = 1; h.equip.melee = 'w_hunting'; h.equip.ranged = 'r_hornbow'; h.equip.horse = 'm_mongol'; h.equip.armor = 'a_leather'; player().gold = 300; },
  },
  {
    id: 'escort', name: '江湖镖师', desc: '走镖多年的老江湖。力量+1、魅力+1，强击1、铁骨1、统御1、训练1，带着两名镖师兄弟。',
    apply: s => { const h = s.hero; h.attrs.str += 1; h.attrs.cha += 1; h.skills.powerstrike = 1; h.skills.ironflesh = 1; h.skills.leadership = 1; h.skills.training = 1; h.equip.melee = 'w_podao'; h.equip.armor = 'a_leather'; addTroops(player().troops, 'merc_guard', 2); player().gold = 500; },
  },
];

function placeVillage(px: number, py: number, taken: { x: number; y: number }[], idx: number): [number, number] | null {
  for (let k = 0; k < 40; k++) {
    const a = idx * 2.4 + k * 0.7 + Math.random() * 0.4;
    const r = 42 + Math.random() * 40 + k;
    const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
    if (!passable(x, y)) continue;
    if (taken.some(t => dist(t.x, t.y, x, y) < 36)) continue;
    return [x, y];
  }
  return null;
}

function stockFor(st: Settlement) {
  const stock: Record<string, number> = {};
  for (const g of GOODS) {
    if (st.kind === 'village' && !st.produce.includes(g.id) && g.id !== 'grain') continue;
    stock[g.id] = targetStock(st, g.id);
  }
  return stock;
}
export function targetStock(st: Settlement, g: string) {
  const pf = 0.5 + st.prosperity / 100;
  if (st.kind === 'village') return Math.round((st.produce.includes(g) ? 25 : 10) * pf);
  if (st.produce.includes(g)) return Math.round(60 * pf);
  if (st.demand.includes(g)) return Math.round(10 * pf);
  return Math.round(28 * pf);
}

export function newGame(heroName: string, bgId: string): GameState {
  buildGrid();
  const s: GameState = {
    version: 1, seed: Date.now() % 100000, time: 8, hero: newHero(heroName), playerId: 0, parties: [], settlements: {}, lords: {},
    wars: [], truceUntil: {}, alive: {}, playerFaction: null, mercOf: null, mercUntil: 0, ownFactionName: `${heroName}军`,
    playerRel: {}, renown: 0, honor: 0, morale: 70, companions: [], quests: [], log: [], nextId: 1,
    stats: { kills: 0, won: 0, lost: 0, days: 0 }, lastDay: 0, speed: 1,
  };
  setState(s);
  for (const f of MAJOR_FACTIONS) { s.alive[f] = true; s.playerRel[f] = 0; }
  for (const [a, b] of INITIAL_WARS) setWar(a, b, true);

  // 城镇与城堡
  const taken: { x: number; y: number }[] = [];
  for (const d of TOWN_DEFS) {
    let [x, y] = ll(d.lon, d.lat);
    [x, y] = nearestPassable(x, y);
    const st: Settlement = {
      id: d.id, name: d.name, kind: d.kind, faction: d.faction, owner: null, x, y, villages: [], garrison: [],
      prosperity: randInt(40, 70), stock: {}, produce: d.produce ?? [], demand: d.demand ?? [], shop: [], recruits: 0, relation: 0,
      lootedUntil: 0, siege: null, tavern: { companion: null, mercs: null, refresh: 0 }, culture: FACTION[d.faction].culture,
    };
    s.settlements[d.id] = st; taken.push(st);
  }
  // 村庄
  const names = shuffle([...VILLAGE_NAMES]);
  let vi = 0;
  for (const d of TOWN_DEFS) {
    const parent = s.settlements[d.id];
    const nv = d.kind === 'town' ? 2 : 1;
    for (let k = 0; k < nv; k++) {
      const pos = placeVillage(parent.x, parent.y, taken, vi);
      if (!pos) continue;
      const id = `v${vi}`;
      const name = names[vi % names.length] + (vi >= names.length ? '二' : '');
      vi++;
      const prod = shuffle([...(VILLAGE_PRODUCE[FACTION[d.faction].culture] ?? ['grain'])]).slice(0, 2);
      const v: Settlement = {
        id, name, kind: 'village', faction: d.faction, owner: null, x: pos[0], y: pos[1], parent: d.id, villages: [], garrison: [],
        prosperity: randInt(35, 70), stock: {}, produce: prod, demand: [], shop: [], recruits: randInt(3, 8), relation: randInt(-5, 10),
        lootedUntil: 0, siege: null, tavern: { companion: null, mercs: null, refresh: 0 }, culture: FACTION[d.faction].culture,
      };
      s.settlements[id] = v; parent.villages.push(id); taken.push(v);
    }
  }
  for (const st of Object.values(s.settlements)) {
    st.stock = stockFor(st);
    if (st.kind !== 'village') {
      const n = st.kind === 'town' ? randInt(70, 110) : randInt(45, 70);
      st.garrison = genTroops(st.culture, n, 0.55);
      refreshShop(st);
    }
  }

  // 主角部队（先创建，背景可能修改）
  const start = s.settlements['kaifeng'];
  const pp = makeParty('player', heroName, 'player', start.x + 14, start.y + 10, []);
  s.playerId = pp.id;
  pp.goods.grain = 6; pp.goods.meat = 2;

  for (const st of Object.values(s.settlements)) if (st.kind === 'town') refreshTavern(st);

  // 领主与封地
  for (const f of MAJOR_FACTIONS) {
    const lords = LORD_DEFS.filter(l => l.faction === f);
    for (const ld of lords) s.lords[ld.id] = { id: ld.id, name: ld.name, faction: f, title: ld.title, trait: ld.trait, relation: randInt(-3, 5), partyId: null, respawnAt: 0 };
    const fiefs = Object.values(s.settlements).filter(x => x.faction === f && x.kind !== 'village');
    const cap = FACTION[f].capital;
    let li = 0;
    for (const st of fiefs) {
      if (st.id === cap) st.owner = `ruler_${f}`;
      else { st.owner = lords[li % lords.length].id; li++; }
      for (const vid of st.villages) s.settlements[vid].owner = st.owner;
    }
    for (const ld of lords) spawnLordParty(s.lords[ld.id], true);
  }
  // 盗匪与商队
  for (let i = 0; i < 26; i++) spawnBandit();
  for (let i = 0; i < 10; i++) spawnCaravan();

  BACKGROUNDS.find(b => b.id === bgId)?.apply(s);
  s.hero.background = bgId;
  log(`崇祯八年正月，天下大乱。${heroName}来到开封城外，决心在这乱世中闯出一番天地。`, 'gold');
  log('提示：点击地图移动，点击城镇进入；按空格扎营等待，鼠标滚轮缩放。', 'hint');
  return s;
}

export function lordHome(l: Lord): Settlement | null {
  const own = fiefsOf(l.id).filter(x => x.kind !== 'village');
  if (own.length) return pick(own);
  const cap = S.settlements[FACTION[l.faction].capital];
  if (cap && cap.faction === l.faction) return cap;
  const fs = factionSettlements(l.faction).filter(x => x.kind !== 'village');
  return fs.length ? pick(fs) : null;
}

export function spawnLordParty(l: Lord, initial = false) {
  if (l.dead || !S.alive[l.faction]) return;
  const home = lordHome(l);
  if (!home) return;
  const culture = FACTION[l.faction].culture;
  const n = initial ? randInt(45, 90) : randInt(25, 45);
  const troops = genTroops(culture, n, initial ? 0.6 : 0.45);
  const [x, y] = nearestPassable(home.x + randRange(-15, 15), home.y + randRange(-15, 15));
  const p = makeParty('lord', `${l.name}部`, l.faction, x, y, troops, { lordId: l.id, home: home.id, gold: randInt(500, 1500) });
  p.goods.grain = 20;
  l.partyId = p.id;
}

export function spawnBandit(zoneIdx?: number, strong = false): Party | null {
  const zi = zoneIdx ?? randInt(0, BANDIT_ZONES.length - 1);
  const z = BANDIT_ZONES[zi];
  for (let k = 0; k < 20; k++) {
    const [x, y] = ll(z.lon + randRange(-z.r, z.r), z.lat + randRange(-z.r, z.r));
    if (!passable(x, y)) continue;
    if (dist(x, y, player()?.x ?? -999, player()?.y ?? -999) < 150) continue;
    const n = strong ? randInt(25, 45) : randInt(6, 26);
    const troops: Stack[] = [{ id: z.troop, n, w: 0, xp: 0 }];
    if (n > 15 || strong) addTroops(troops, 'bandit_chief', 1);
    if (z.troop === 'bandit_mtn' && chance(0.4)) addTroops(troops, 'bandit_rover', randInt(2, 6));
    const p = makeParty('bandit', z.name, 'bandit', x, y, troops, { zone: zi, gold: n * randInt(5, 12) });
    p.ai.ax = x; p.ai.ay = y;
    if (chance(0.5)) p.goods[pick(['grain', 'wine', 'salt', 'cloth', 'silk', 'tea'])] = randInt(1, 4);
    return p;
  }
  return null;
}

export function spawnCaravan(): Party | null {
  const towns = settlementList().filter(s => s.kind === 'town' && s.faction !== 'player');
  if (!towns.length) return null;
  const home = pick(towns);
  const f = home.faction;
  const troops: Stack[] = [];
  addTroops(troops, 'civ_guard', randInt(8, 16));
  addTroops(troops, 'civ_cguard', randInt(2, 6));
  const p = makeParty('caravan', `${home.name}商队`, f, home.x + 8, home.y + 8, troops, { home: home.id, gold: randInt(400, 1000) });
  for (const g of home.produce) p.goods[g] = randInt(3, 8);
  return p;
}

export function spawnVillager(v: Settlement): Party | null {
  if (!v.parent) return null;
  const troops: Stack[] = [{ id: 'civ_peasant', n: randInt(5, 14), w: 0, xp: 0 }];
  const p = makeParty('villager', `${v.name}乡民`, v.faction, v.x + 5, v.y + 5, troops, { home: v.id, gold: randInt(20, 80) });
  for (const g of v.produce) p.goods[g] = randInt(2, 6);
  return p;
}

export function totalPlayerTroops() { return count(player().troops); }
export { FACTIONS };
