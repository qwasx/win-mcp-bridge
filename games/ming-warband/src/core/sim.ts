// 大地图模拟：时间推进、移动、AI、日常结算
import type { Party, Settlement } from './state';
import {
  S, log, player, partyById, removeParty, hostile, isNight, dayOf, spawnBandit, spawnCaravan, spawnVillager, spawnLordParty,
  settlementList, factionSettlements, nearestSettlement, atWar, setWar, genTroops, refreshShop, refreshTavern, fiefsOf, lordName, emit,
  factionHostileToSettlement, playerSide, changePlayerRel,
} from './game';
import { FACTION, MAJOR_FACTIONS, COMPANIONS } from '../data/world';
import { TROOPS, UPGRADE_XP } from '../data/troops';
import { GOOD } from '../data/items';
import { findPath, nearestPassable, passable } from './terrain';
import { mapSpeed, partyStrength, count, healthy, addTroops, removeTroops, weeklyWages, dailyFood, foodCount, cleanStacks, partySize } from './party';
import { aiBattle, aiSiegeAssault } from './combat';
import { dist, chance, pick, randInt, randRange } from './rng';
import { partySkill, heroMaxHp, partyLimit } from './character';
import { dailyEconomy } from './economy';
import { dailyQuests } from './quests';

export type NavTarget = { kind: 'point'; x: number; y: number } | { kind: 'settlement'; id: string } | { kind: 'party'; id: number };
export const nav = {
  path: [] as [number, number][],
  target: null as NavTarget | null,
  waiting: false,
  lastPathAt: 0,
  graceUntil: 0,
};

export function setPlayerTarget(t: NavTarget | null) {
  nav.target = t; nav.waiting = false; nav.path = [];
  if (!t) return;
  const pp = player();
  pp.inside = undefined;
  let tx: number, ty: number;
  if (t.kind === 'point') { tx = t.x; ty = t.y; }
  else if (t.kind === 'settlement') { const st = S.settlements[t.id]; tx = st.x; ty = st.y; }
  else { const p = partyById(t.id); if (!p) { nav.target = null; return; } tx = p.x; ty = p.y; }
  const path = findPath(pp.x, pp.y, tx, ty);
  if (!path) { nav.target = null; log('那里无法到达。', 'dim'); return; }
  nav.path = path; nav.lastPathAt = S.time;
}

function moveAlong(p: Party, path: [number, number][], d: number) {
  while (d > 0 && path.length) {
    const [tx, ty] = path[0];
    const dd = Math.hypot(tx - p.x, ty - p.y);
    if (dd <= d) { p.x = tx; p.y = ty; d -= dd; path.shift(); }
    else {
      const nx = p.x + ((tx - p.x) / dd) * d, ny = p.y + ((ty - p.y) / dd) * d;
      if (!passable(nx, ny)) { path.length = 0; return; }
      p.x = nx; p.y = ny; d = 0;
    }
  }
}

function goTo(p: Party, x: number, y: number) {
  p.ai.tx = x; p.ai.ty = y;
  if (dist(p.x, p.y, x, y) < 90) { p.ai.path = [[x, y]]; return; }
  p.ai.path = findPath(p.x, p.y, x, y) ?? [];
}

import { thinkFollower, aiArmyBattle, rallyArmy, rallyPotential, armySiegeAssault } from './war';
const STEP = 0.25;
let pathBudget = 0;

/** 推进 hours 小时。若触发事件则提前返回 */
export function simulate(hours: number) {
  let left = hours;
  while (left > 1e-6) {
    const h = Math.min(STEP, left);
    left -= h;
    if (step(h)) return true;
  }
  return false;
}

function step(h: number): boolean {
  const prevDay = dayOf(S.time);
  const prevHour = Math.floor(S.time);
  S.time += h;
  pathBudget = 6;
  const night = isNight();
  const pp = player();

  // 玩家移动
  if (nav.target && !pp.inside) {
    if (nav.target.kind === 'party') {
      const tp = partyById(nav.target.id);
      if (!tp || tp.inside) { nav.target = null; nav.path = []; }
      else if (dist(pp.x, pp.y, tp.x, tp.y) < 100) nav.path = [[tp.x, tp.y]];
      else if (S.time - nav.lastPathAt > 1.5) { nav.path = findPath(pp.x, pp.y, tp.x, tp.y) ?? nav.path; nav.lastPathAt = S.time; }
    }
    moveAlong(pp, nav.path, mapSpeed(S, pp, night) * h);
    if (nav.target?.kind === 'settlement') {
      const st = S.settlements[nav.target.id];
      if (dist(pp.x, pp.y, st.x, st.y) < 10 || !nav.path.length) {
        nav.target = null; nav.path = [];
        emit('arrive', st);
        return true;
      }
    } else if (nav.target?.kind === 'party') {
      const tp = partyById(nav.target.id);
      if (tp && dist(pp.x, pp.y, tp.x, tp.y) < 12) {
        nav.target = null; nav.path = [];
        emit('encounter', tp, false);
        return true;
      }
    } else if (nav.target?.kind === 'point' && !nav.path.length) nav.target = null;
  }

  // 离开围城
  for (const s of settlementList()) if (s.siege && s.siege.by === pp.id && dist(pp.x, pp.y, s.x, s.y) > 60) { s.siege = null; log(`你离开了${s.name}，包围解除。`, 'dim'); }

  // AI
  for (const p of [...S.parties]) {
    if (p.kind === 'player' || !S.parties.includes(p)) continue;
    if (S.time >= p.ai.nextThink) think(p);
    if (p.inside) continue;
    if (p.ai.path && p.ai.path.length) {
      // 追击目标位置更新
      if (p.ai.mode === 'chase' || (p.ai.mode === 'flee' && typeof p.ai.target === 'number')) {
        const t = partyById(p.ai.target as number);
        if (t && p.ai.mode === 'chase' && dist(p.x, p.y, t.x, t.y) < 90) p.ai.path = [[t.x, t.y]];
      }
      moveAlong(p, p.ai.path, mapSpeed(S, p, night) * h * (p.ai.mode === 'follow' ? 1.25 : 1));
    }
    arrive(p);
  }

  // 接触检测
  if (contacts()) return true;
  if (S.pendingDefense) return true;

  // 每小时
  if (Math.floor(S.time) !== prevHour) hourly();
  // 每日
  if (dayOf(S.time) !== prevDay) daily();
  return false;
}

function contacts(): boolean {
  const pp = player();
  const ps = S.parties;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    if (a.inside) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j];
      if (b.inside) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > 100) continue;
      if (!hostile(a, b)) continue;
      if (a === pp || b === pp) {
        const o = a === pp ? b : a;
        if (o.ai.mode === 'chase' && o.ai.target === pp.id && S.time >= nav.graceUntil && !pp.inside) {
          nav.target = null; nav.path = []; nav.waiting = false;
          emit('encounter', o, true);
          return true;
        }
        continue;
      }
      const aggressive = (a.ai.mode === 'chase' && a.ai.target === b.id) || (b.ai.mode === 'chase' && b.ai.target === a.id) || (a.kind === 'lord' && b.kind === 'lord');
      if (aggressive) {
        // 玩家近在咫尺、且与一方友好：可以助战
        const fa = !hostile(pp, a) && hostile(pp, b), fb = !hostile(pp, b) && hostile(pp, a);
        if ((fa || fb) && !pp.inside && Math.hypot(pp.x - a.x, pp.y - a.y) < 55 && S.time >= nav.graceUntil && (a.kind === 'lord' || b.kind === 'lord')) {
          nav.target = null; nav.path = []; nav.waiting = false;
          emit('joinBattle', fa ? a : b, fa ? b : a);
          return true;
        }
        aiArmyBattle(a, b); return false;
      }
    }
  }
  return false;
}

function arrive(p: Party) {
  const ai = p.ai;
  if (ai.path && ai.path.length) return;
  if (ai.mode === 'siege' && typeof ai.target === 'string') {
    const st = S.settlements[ai.target];
    if (!st || !factionHostileToSettlement(p.faction, st)) { ai.mode = 'idle'; ai.nextThink = S.time; return; }
    if (dist(p.x, p.y, st.x, st.y) > 20) { ai.nextThink = S.time; return; }
    if (!st.siege) {
      st.siege = { by: p.id, since: S.time };
      if (st.owner === 'player' || st.faction === playerSide()) log(`${lordName(p.lordId ?? null)}率军围攻${st.name}！`, 'bad');
    } else if (st.siege.by === p.id && S.time - st.siege.since > 20) {
      const pp = player();
      const friendly = st.owner === 'player' || (!!playerSide() && st.faction === playerSide());
      const here = pp.inside === st.id || Math.hypot(pp.x - st.x, pp.y - st.y) < 28;
      if (friendly && here && (healthy(pp.troops) > 0 || S.hero.hp >= 0.25) && !S.pendingDefense) {
        S.pendingDefense = { st: st.id, by: p.id };
        emit('defendPrompt', st, p);
        return;
      }
      if (!S.pendingDefense || S.pendingDefense.st !== st.id) armySiegeAssault(p, st);
    }
  } else if (ai.mode === 'raid' && typeof ai.target === 'string') {
    const v = S.settlements[ai.target];
    if (!v || dist(p.x, p.y, v.x, v.y) > 20) return;
    if (ai.until === undefined) ai.until = S.time + 6;
    else if (S.time >= ai.until) {
      v.lootedUntil = S.time + 24 * 4; v.prosperity = Math.max(5, v.prosperity - 12);
      p.gold += 150 + Math.round(v.prosperity * 3);
      for (const g of v.produce) p.goods[g] = (p.goods[g] || 0) + 3;
      if (v.owner === 'player') log(`你的封地${v.name}被${lordName(p.lordId ?? null)}洗劫了！`, 'bad');
      else if (dist(player().x, player().y, v.x, v.y) < 400) log(`${lordName(p.lordId ?? null)}洗劫了${v.name}。`, 'war');
      ai.until = undefined; ai.mode = 'idle'; ai.nextThink = S.time;
    }
  }
}

// ---------- AI 决策 ----------
function visibleHostiles(p: Party, range: number) {
  const out: { o: Party; d: number; s: number }[] = [];
  for (const o of S.parties) {
    if (o === p || o.inside) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > range) continue;
    if (!hostile(p, o)) continue;
    out.push({ o, d, s: partyStrength(S, o) });
  }
  return out.sort((a, b) => a.d - b.d);
}

function fleeFrom(p: Party, o: Party) {
  const refuge = nearestSettlement(p.x, p.y, s => !factionHostileToSettlement(p.faction, s) && s.kind !== 'village' && p.kind !== 'bandit');
  if (refuge && dist(p.x, p.y, refuge.x, refuge.y) < 250) { p.ai.mode = 'flee'; p.ai.target = refuge.id; goTo(p, refuge.x, refuge.y); return; }
  const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
  let [tx, ty] = [p.x + (dx / d) * 160, p.y + (dy / d) * 160];
  [tx, ty] = nearestPassable(tx, ty);
  p.ai.mode = 'flee'; p.ai.target = o.id;
  p.ai.path = [[tx, ty]];
}

function think(p: Party) {
  p.ai.nextThink = S.time + randRange(1.5, 3.5);
  if (pathBudget <= 0) { p.ai.nextThink = S.time + 0.3; return; }
  if (p.kind === 'bandit') return thinkBandit(p);
  if (p.kind === 'caravan' || p.kind === 'villager') return thinkTrader(p);
  if (p.kind === 'lord') return thinkLord(p);
}

function thinkBandit(p: Party) {
  const me = partyStrength(S, p);
  const hs = visibleHostiles(p, 170);
  const threat = hs.find(h => h.s > me * 1.1 && h.d < 130);
  if (threat) { fleeFrom(p, threat.o); pathBudget--; return; }
  const prey = hs.find(h => h.s < me * 0.85 && h.o.kind !== 'lord');
  if (prey) { p.ai.mode = 'chase'; p.ai.target = prey.o.id; goTo(p, prey.o.x, prey.o.y); pathBudget--; return; }
  if (p.ai.mode === 'chase' || p.ai.mode === 'flee' || !p.ai.path?.length) {
    if (p.ai.mode === 'wander' && p.ai.until && S.time < p.ai.until) return;
    const r = 120;
    const [tx, ty] = nearestPassable((p.ai.ax ?? p.x) + randRange(-r, r), (p.ai.ay ?? p.y) + randRange(-r, r));
    p.ai.mode = 'wander'; p.ai.target = undefined; p.ai.until = S.time + randRange(4, 12);
    goTo(p, tx, ty); pathBudget--;
  }
}

function thinkTrader(p: Party) {
  const me = partyStrength(S, p);
  const hs = visibleHostiles(p, 140);
  const threat = hs.find(h => h.s > me * 0.8 && h.d < 120);
  if (threat) { fleeFrom(p, threat.o); pathBudget--; return; }
  if (p.inside) {
    if (p.ai.until && S.time < p.ai.until) return;
    p.inside = undefined;
  }
  if (p.ai.path?.length && p.ai.mode === 'travel') return;
  // 到达目的地
  if (p.ai.mode === 'travel' && typeof p.ai.target === 'string') {
    const st = S.settlements[p.ai.target];
    if (st && dist(p.x, p.y, st.x, st.y) < 15) {
      if (p.kind === 'villager' && st.id === p.home) { removeParty(p); return; }
      // 卖货
      for (const g in p.goods) { st.stock[g] = (st.stock[g] ?? 0) + p.goods[g]; p.gold += p.goods[g] * (GOOD[g]?.base ?? 20); }
      p.goods = {};
      if (p.kind === 'caravan') for (const g of st.produce) p.goods[g] = randInt(3, 8);
      p.inside = st.id; p.ai.until = S.time + randRange(4, 8);
      p.ai.mode = 'idle';
      return;
    }
  }
  let dest: Settlement | undefined;
  if (p.kind === 'villager') {
    const home = S.settlements[p.home!];
    if (p.ai.mode === 'idle' && p.ai.target && p.ai.target !== p.home) dest = home;
    else dest = home?.parent ? S.settlements[home.parent] : undefined;
    if (!dest || factionHostileToSettlement(p.faction, dest)) dest = home;
  } else {
    const opts = settlementList().filter(s => s.kind === 'town' && s.id !== p.ai.target && !factionHostileToSettlement(p.faction, s) && dist(p.x, p.y, s.x, s.y) < 900);
    dest = opts.length ? pick(opts) : undefined;
  }
  if (!dest) { removeParty(p); return; }
  p.ai.mode = 'travel'; p.ai.target = dest.id;
  goTo(p, dest.x, dest.y); pathBudget--;
}

function lordDesired(p: Party) {
  const fiefs = fiefsOf(p.lordId!).length;
  return Math.min(160, 60 + fiefs * 12 + Math.floor(S.time / 24 / 10));
}

function thinkLord(p: Party) {
  if (p.ai.mode === 'follow') { if (thinkFollower(p, (q, x, y) => { goTo(q, x, y); pathBudget--; })) return; }
  const me = partyStrength(S, p);
  const n = count(p.troops);
  const ai = p.ai;
  const hs = visibleHostiles(p, 240);
  const threat = hs.find(h => h.s > me * 1.25 && h.d < 160);
  if (threat && !p.inside) { fleeFrom(p, threat.o); pathBudget--; return; }

  // 正在执行的长期任务
  if ((ai.mode === 'siege' || ai.mode === 'raid') && typeof ai.target === 'string') {
    const st = S.settlements[ai.target];
    if (st && factionHostileToSettlement(p.faction, st) && !(ai.mode === 'raid' && st.lootedUntil > S.time)) {
      const besiegedByOther = st.siege && st.siege.by !== p.id && partyById(st.siege.by);
      if (!besiegedByOther) { if (!ai.path?.length && dist(p.x, p.y, st.x, st.y) > 20) { goTo(p, st.x, st.y); pathBudget--; } return; }
    }
    ai.mode = 'idle';
  }

  const prey = hs.find(h => h.s < me * 0.8 && (h.o.kind !== 'player' || chance(0.85)));
  if (prey && !p.inside) { ai.mode = 'chase'; ai.target = prey.o.id; goTo(p, prey.o.x, prey.o.y); pathBudget--; return; }

  // 驻留招兵
  if (p.inside) {
    if (ai.until && S.time < ai.until) return;
    p.inside = undefined;
  }
  if (n < lordDesired(p) * 0.45) {
    const home = nearestSettlement(p.x, p.y, s => s.faction === p.faction && s.kind !== 'village' && !s.siege);
    if (home) {
      if (dist(p.x, p.y, home.x, home.y) < 15) { p.inside = home.id; ai.mode = 'recruit'; ai.until = S.time + 24; return; }
      ai.mode = 'recruit'; ai.target = home.id; goTo(p, home.x, home.y); pathBudget--; return;
    }
  }
  if (ai.mode === 'recruit' && typeof ai.target === 'string' && ai.path?.length) return;

  // 救援被围的友方据点
  const besieged = settlementList().find(s => s.siege && s.faction === p.faction && dist(p.x, p.y, s.x, s.y) < 500);
  if (besieged) {
    const enemy = partyById(besieged.siege!.by);
    if (enemy && partyStrength(S, enemy) < me * 1.1) { ai.mode = 'chase'; ai.target = enemy.id; goTo(p, enemy.x, enemy.y); pathBudget--; return; }
  }

  const enemies = MAJOR_FACTIONS.filter(f => S.alive[f] && atWar(p.faction, f)) as string[];
  if (atWar(p.faction, 'player') || (playerSide() && atWar(p.faction, playerSide()!))) enemies.push('player');
  const lord = S.lords[p.lordId!];
  const aggression = lord.trait === 'brave' ? 1.3 : lord.trait === 'cautious' ? 0.75 : 1;
  if (enemies.length && (ai.mode !== 'patrol' || !ai.path?.length || chance(0.3))) {
    {
      // 攻城
      const targets = settlementList().filter(s => s.kind !== 'village' && factionHostileToSettlement(p.faction, s) && dist(p.x, p.y, s.x, s.y) < 750);
      const pot = me + rallyPotential(p, o => partyStrength(S, o));
      const viable = targets.filter(s => partyStrengthOfGarrison(s) * (s.kind === 'town' ? 1.6 : 1.8) < pot * aggression * 0.95 && (!s.siege || !partyById(s.siege.by)));
      if (viable.length && chance(0.7)) {
        viable.sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));
        const st = viable[0];
        if (partyStrengthOfGarrison(st) * (st.kind === 'town' ? 1.6 : 1.8) > me * aggression * 0.8 || chance(0.35)) rallyArmy(p, st.kind === 'town' ? 4 : 2);
        ai.mode = 'siege'; ai.target = st.id; goTo(p, st.x, st.y); pathBudget--; return;
      }
      // 劫掠村庄
      const vills = settlementList().filter(s => s.kind === 'village' && factionHostileToSettlement(p.faction, s) && s.lootedUntil < S.time && dist(p.x, p.y, s.x, s.y) < 450);
      if (vills.length && chance(lord.trait === 'honorable' ? 0.25 : 0.55)) {
        const v = pick(vills);
        ai.mode = 'raid'; ai.target = v.id; ai.until = undefined; goTo(p, v.x, v.y); pathBudget--; return;
      }
    }
  }
  if (ai.path?.length && (ai.mode === 'patrol' || ai.mode === 'chase')) return;
  // 巡逻
  const own = factionSettlements(p.faction).filter(s => dist(p.x, p.y, s.x, s.y) < 500);
  const t = own.length ? pick(own) : nearestSettlement(p.x, p.y, s => s.faction === p.faction);
  if (t) {
    if (dist(p.x, p.y, t.x, t.y) < 20 && t.kind !== 'village' && chance(0.4)) { p.inside = t.id; ai.mode = 'idle'; ai.until = S.time + randRange(6, 16); return; }
    const [tx, ty] = nearestPassable(t.x + randRange(-40, 40), t.y + randRange(-40, 40));
    ai.mode = 'patrol'; ai.target = t.id; goTo(p, tx, ty); pathBudget--;
  }
}

export function partyStrengthOfGarrison(s: Settlement) {
  let v = 0; for (const st of s.garrison) { const t = TROOPS[st.id]; if (t) v += (t.hp / 10) * ((Math.max(t.atk, (t.rng ?? 0) * 0.8) + t.skill * 0.6) / 10) * (1 + t.def / 25) * (st.n - st.w); }
  return v;
}

// ---------- 每小时 ----------
function hourly() {
  const pp = player();
  const inside = !!pp.inside;
  S.hero.hp = Math.min(1, S.hero.hp + (inside ? 0.03 : 0.012) * (1 + partySkill(S, 'surgery') * 0.1));
  for (const c of S.companions) if (c.wounded > 0) c.wounded = Math.max(0, c.wounded - (inside ? 2 : 1));
  const hr = Math.floor(S.time);
  if (hr % 6 === 0) {
    const bandits = S.parties.filter(p => p.kind === 'bandit').length;
    if (bandits < 32) spawnBandit();
    const vills = S.parties.filter(p => p.kind === 'villager').length;
    if (vills < 14) { const vs = settlementList().filter(s => s.kind === 'village' && s.lootedUntil < S.time); if (vs.length) spawnVillager(pick(vs)); }
  }
  if (hr % 12 === 0) {
    const cars = S.parties.filter(p => p.kind === 'caravan').length;
    if (cars < 12) spawnCaravan();
    for (const l of Object.values(S.lords)) if (!l.dead && l.partyId === null && S.time >= l.respawnAt && S.alive[l.faction]) spawnLordParty(l);
  }
}

// ---------- 每日 ----------
function daily() {
  const day = dayOf(S.time);
  S.stats.days = day;
  const pp = player();
  dailyEconomy();
  dailyQuests();

  // 粮食
  const need = dailyFood(S, pp);
  let eaten = 0;
  const foods = Object.keys(pp.goods).filter(g => GOOD[g]?.food && pp.goods[g] > 0);
  for (let i = 0; i < need && foods.length; i++) {
    const g = foods[i % foods.length];
    if (pp.goods[g] > 0) { pp.goods[g]--; eaten++; }
    if (pp.goods[g] <= 0) { delete pp.goods[g]; foods.splice(foods.indexOf(g), 1); }
  }
  const starving = eaten < need && !pp.inside;
  if (starving) { S.morale = Math.max(0, S.morale - 12); log('部队断粮了！士气大跌，赶快购买粮食。', 'bad'); }

  // 士气
  const kinds = Object.keys(pp.goods).filter(g => GOOD[g]?.food && pp.goods[g] > 0);
  const bonus = kinds.reduce((a, g) => a + (GOOD[g].morale ?? 0) + 3, 0);
  const target = Math.max(0, Math.min(100, 45 + S.hero.skills.leadership * 6 + bonus + Math.floor(S.renown / 100) - Math.max(0, partySize(S, pp) - 20) / 3));
  S.morale += (target - S.morale) * 0.15;
  if (S.morale < 18 && count(pp.troops) > 0) {
    const st = pick(pp.troops);
    const k = Math.max(1, Math.round(st.n * 0.1));
    removeTroops(pp.troops, st.id, k);
    log(`士气低落，${k} 名${TROOPS[st.id].name}趁夜逃走了。`, 'bad');
  }
  // 超编
  const over = count(pp.troops) + 1 + S.companions.length - partyLimit(S);
  if (over > 0 && pp.troops.length) { const st = pp.troops[pp.troops.length - 1]; removeTroops(pp.troops, st.id, Math.min(over, st.n)); log('部队超编，有人离队了。', 'bad'); }

  // 伤兵恢复
  const heal = (0.12 + partySkill(S, 'surgery') * 0.03) * (pp.inside ? 1.5 : 1);
  for (const st of pp.troops) if (st.w > 0) st.w = Math.max(0, st.w - Math.max(1, Math.round(st.w * heal)));
  // 训练
  const tr = partySkill(S, 'training');
  if (tr > 0) for (const st of pp.troops) if ((TROOPS[st.id]?.tier ?? 9) < S.hero.level) st.xp += tr * 3 * (st.n - st.w);

  // AI 领主与守军
  for (const p of S.parties) {
    if (p.kind !== 'lord') continue;
    for (const st of p.troops) if (st.w > 0) st.w = Math.max(0, st.w - Math.ceil(st.w * 0.2));
    if (p.inside) {
      const s = S.settlements[p.inside];
      if (s && s.faction === p.faction) for (const t of genTroops(FACTION[p.faction].culture, randInt(5, 10), 0.35)) addTroops(p.troops, t.id, t.n);
    }
    // 升级
    for (const st of [...p.troops]) {
      const t = TROOPS[st.id];
      if (t.upgrades.length && chance(0.15)) { const k = Math.ceil(st.n * 0.1); removeTroops(p.troops, st.id, k); addTroops(p.troops, pick(t.upgrades), k); }
    }
    cleanStacks(p.troops);
  }
  for (const s of settlementList()) {
    if (s.kind === 'village') continue;
    for (const st of s.garrison) if (st.w > 0) st.w = Math.max(0, st.w - Math.ceil(st.w * 0.25));
    if (s.owner !== 'player' && !s.siege) {
      const cap = s.kind === 'town' ? 130 : 85;
      if (count(s.garrison) < cap && chance(0.7)) for (const t of genTroops(FACTION[s.faction]?.culture ?? 'ming', randInt(1, 3), 0.5)) addTroops(s.garrison, t.id, t.n);
    }
    if (s.tavern.refresh < S.time && s.kind === 'town') refreshTavern(s);
  }

  if (day % 7 === 0) weekly();
  emit('daily');
}

function weekly() {
  const pp = player();
  // 军饷
  const wages = weeklyWages(S, pp);
  if (wages > 0) {
    if (pp.gold >= wages) { pp.gold -= wages; log(`支付军饷 ${wages} 两。`, 'dim'); }
    else { log(`银两不足，无法支付 ${wages} 两军饷！士气大跌。`, 'bad'); pp.gold = 0; S.morale = Math.max(0, S.morale - 20); }
  }
  // 封地收入
  let income = 0;
  for (const s of fiefsOf('player')) {
    if (s.lootedUntil > S.time || s.siege) continue;
    income += Math.round((s.kind === 'town' ? 450 : s.kind === 'castle' ? 160 : 90) * (0.5 + s.prosperity / 100));
  }
  // 守军军饷（玩家据点）
  let gw = 0;
  for (const s of fiefsOf('player')) for (const st of s.garrison) gw += Math.round((TROOPS[st.id]?.wage ?? 2) * st.n * 0.5);
  if (income) { pp.gold += income; log(`封地上缴税银 ${income} 两。`, 'good'); }
  if (gw) { pp.gold = Math.max(0, pp.gold - gw); log(`支付守军军饷 ${gw} 两。`, 'dim'); }
  // 雇佣兵契约
  if (S.mercOf) {
    if (S.time > S.mercUntil) { log(`与${FACTION[S.mercOf].name}的雇佣契约到期了。`, 'quest'); S.mercOf = null; }
    else { const pay = 50 + healthy(pp.troops) * 5; pp.gold += pay; log(`${FACTION[S.mercOf].name}支付雇佣金 ${pay} 两。`, 'good'); }
  }
  // 村庄刷新
  for (const s of settlementList()) {
    if (s.kind === 'village') s.recruits = Math.min(15, s.recruits + randInt(1, 4) + Math.max(0, Math.floor(s.relation / 15)));
    else refreshShop(s);
  }
  diplomacy();
}

function diplomacy() {
  const alive = MAJOR_FACTIONS.filter(f => S.alive[f]);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j];
    const key = [a, b].sort().join('|');
    const war = atWar(a, b);
    if ((S.truceUntil[key] ?? 0) > S.time) continue;
    const mingJin = key === 'jin|ming';
    if (war && chance(mingJin ? 0.02 : 0.07)) {
      setWar(a, b, false); S.truceUntil[key] = S.time + 24 * 30;
      log(`${FACTION[a].name}与${FACTION[b].name}议和了。`, 'war');
    } else if (!war && chance(mingJin ? 0.5 : 0.06)) {
      const warsA = S.wars.filter(k => k.includes(a)).length;
      if (warsA <= 2) {
        setWar(a, b, true); S.truceUntil[key] = S.time + 24 * 20;
        log(`${FACTION[a].name}向${FACTION[b].name}宣战！`, 'war');
      }
    }
  }
  void changePlayerRel; void nearestPassable; void UPGRADE_XP; void COMPANIONS; void heroMaxHp;
}

/** 在据点内休息若干小时 */
export function restInside(st: Settlement, hours: number) {
  const pp = player();
  pp.inside = st.id;
  pp.x = st.x; pp.y = st.y;
  const prev = nav.target; nav.target = null;
  for (let t = 0; t < hours; t += STEP) {
    S.time += STEP;
    const prevDay = dayOf(S.time - STEP), prevHour = Math.floor(S.time - STEP);
    for (const p of [...S.parties]) {
      if (p.kind === 'player' || !S.parties.includes(p)) continue;
      if (S.time >= p.ai.nextThink) { pathBudget = 3; think(p); }
      if (!p.inside && p.ai.path?.length) moveAlong(p, p.ai.path, mapSpeed(S, p, isNight()) * STEP * (p.ai.mode === 'follow' ? 1.25 : 1));
      arrive(p);
    }
    contacts();
    if (Math.floor(S.time) !== prevHour) hourly();
    if (S.pendingDefense) break;
    if (dayOf(S.time) !== prevDay) daily();
  }
  nav.target = prev;
}
