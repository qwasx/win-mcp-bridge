// 战斗结算（自动结算 / 战后处理 / 攻城）
import { TROOPS, troopPower } from '../data/troops';
import { ITEM_LIST, GOOD } from '../data/items';
import { FACTION, COMPANIONS } from '../data/world';
import type { Party, Settlement, Stack } from './state';
import { S, log, player, removeParty, changePlayerRel, lordName, emit, setWar, nearestSettlement, playerHostileToSettlement, factionSettlements, fiefsOf } from './game';
import { addTroops, cleanStacks, count, giveTroopXp, healthy, strength, removeTroops } from './party';
import { partySkill, addHeroXp, prisonerLimit, heroMaxHp } from './character';
import { chance, randInt, pick, weighted, randRange } from './rng';
import { completeBanditQuest } from './quests';

export type Casualties = Record<string, number>;

function pickVictim(stacks: Stack[], down: Casualties): string | null {
  const opts: [string, number][] = [];
  for (const s of stacks) {
    const left = s.n - s.w - (down[s.id] || 0);
    if (left > 0) opts.push([s.id, left / Math.sqrt(TROOPS[s.id]?.tier ?? 1)]);
  }
  return opts.length ? weighted(opts) : null;
}
function remainingPower(stacks: Stack[], down: Casualties) {
  let p = 0;
  for (const s of stacks) { const t = TROOPS[s.id]; if (!t) continue; p += troopPower(t) * Math.max(0, s.n - s.w - (down[s.id] || 0)); }
  return p;
}

export interface AutoResult { aWin: boolean; aDown: Casualties; bDown: Casualties }

/** 通用自动结算。bonusA/B 为额外战力（主角、同伴、守城加成等） */
export function autoResolve(a: Stack[], b: Stack[], multA = 1, multB = 1, extraA = 0, extraB = 0): AutoResult {
  const aDown: Casualties = {}, bDown: Casualties = {};
  const a0 = strength(a) * multA + extraA, b0 = strength(b) * multB + extraB;
  for (let round = 0; round < 60; round++) {
    const pa = remainingPower(a, aDown) * multA + extraA * (round < 30 ? 1 : 0.5);
    const pb = remainingPower(b, bDown) * multB + extraB * (round < 30 ? 1 : 0.5);
    const na = healthyLeft(a, aDown), nb = healthyLeft(b, bDown);
    if (na <= 0 && extraA <= 0) break;
    if (nb <= 0 && extraB <= 0) break;
    if (na <= 0 && nb <= 0) break;
    if (pa < a0 * 0.18 && chance(0.4)) break; // 溃散
    if (pb < b0 * 0.18 && chance(0.4)) break;
    const kills = Math.max(1, Math.round((na + nb) * 0.05));
    for (let k = 0; k < kills; k++) {
      const r = Math.random() * (pa + pb);
      if (r < pa) { const v = pickVictim(b, bDown); if (v) bDown[v] = (bDown[v] || 0) + 1; }
      else { const v = pickVictim(a, aDown); if (v) aDown[v] = (aDown[v] || 0) + 1; }
    }
  }
  const ra = remainingPower(a, aDown) * multA + extraA * 0.5, rb = remainingPower(b, bDown) * multB + extraB * 0.5;
  const aWin = ra / Math.max(1, a0) > rb / Math.max(1, b0) ? ra > 0 : rb <= 0;
  return { aWin, aDown, bDown };
}
function healthyLeft(stacks: Stack[], down: Casualties) {
  let n = 0; for (const s of stacks) n += Math.max(0, s.n - s.w - (down[s.id] || 0)); return n;
}

// ---------- 玩家战斗结果 ----------
export interface Outcome {
  win: boolean;
  ourDown: Casualties; // 我方倒下的（阵亡或负伤）
  enemyDown: Casualties; // 敌方倒下
  enemyFled?: boolean;
  heroDown: boolean;
  compDown: string[];
  retreat?: boolean;
  manual?: boolean;
}

export interface BattleReport { title: string; win: boolean; lines: string[]; loot: string[]; prisoners: Stack[]; captured?: Settlement | null }

export function playerExtraPower() {
  let e = 6 + S.hero.level * 0.9;
  for (const c of S.companions) if (c.wounded <= 0) { const d = COMPANIONS.find(x => x.id === c.id)!; e += (d.hp / 10) * ((d.atk + d.skill * 0.6) / 10) * (1 + d.def / 25); }
  return e;
}

export function playerAutoBattle(enemy: Stack[], enemyMult = 1, enemyExtra = 0): Outcome {
  const pp = player();
  const tactics = partySkill(S, 'tactics');
  const moraleMod = 0.85 + S.morale / 333;
  const r = autoResolve(pp.troops, enemy, (1 + tactics * 0.06) * moraleMod, enemyMult, playerExtraPower(), enemyExtra);
  const heroDown = !r.aWin ? true : chance(0.08);
  const compDown = S.companions.filter(c => c.wounded <= 0 && (!r.aWin ? chance(0.7) : chance(0.1))).map(c => c.id);
  return { win: r.aWin, ourDown: r.aDown, enemyDown: r.bDown, heroDown, compDown };
}

function sumCas(c: Casualties) { let n = 0; for (const k in c) n += c[k]; return n; }
function casPower(c: Casualties) { let p = 0; for (const k in c) p += troopPower(TROOPS[k]) * c[k]; return p; }

/** 处理玩家战斗结果。enemy 为敌方部队（攻城时为 null，使用 siegeOf 的守军） */
export function applyPlayerBattle(enemy: Party | null, siegeOf: Settlement | null, out: Outcome): BattleReport {
  const pp = player();
  const lines: string[] = [];
  const loot: string[] = [];
  const surgery = partySkill(S, 'surgery');
  // 我方伤亡
  let killed = 0, woundedN = 0;
  for (const id in out.ourDown) {
    const n = out.ourDown[id];
    const st = pp.troops.find(s => s.id === id); if (!st) continue;
    let k = 0;
    for (let i = 0; i < n; i++) if (!chance(0.3 + surgery * 0.05)) k++;
    removeTroops(pp.troops, id, k);
    const st2 = pp.troops.find(s => s.id === id);
    if (st2) st2.w = Math.min(st2.n, st2.w + (n - k));
    killed += k; woundedN += n - k;
  }
  cleanStacks(pp.troops);
  if (killed + woundedN > 0) lines.push(`我军阵亡 ${killed} 人，负伤 ${woundedN} 人。`);
  if (out.heroDown) { S.hero.hp = Math.min(S.hero.hp, 0.15); lines.push('你在战斗中身负重伤。'); }
  for (const cid of out.compDown) { const c = S.companions.find(x => x.id === cid); if (c) { c.wounded = 48; lines.push(`${COMPANIONS.find(x => x.id === cid)!.name}负伤倒地。`); } }

  // 敌方损失
  const enemyStacks = enemy ? enemy.troops : siegeOf!.garrison;
  const enemyName = enemy ? enemy.name : `${siegeOf!.name}守军`;
  const enemyFaction = enemy ? enemy.faction : siegeOf!.faction;
  const prisoners: Stack[] = [];
  const pLimit = prisonerLimit(S) - count(pp.prisoners);
  let pTaken = 0;
  const downN = sumCas(out.enemyDown);
  for (const id in out.enemyDown) {
    const n = out.enemyDown[id];
    removeTroops(enemyStacks, id, n);
    if (out.win) for (let i = 0; i < n; i++) if (chance(0.38) && pTaken < pLimit) { addTroops(prisoners, id, 1); pTaken++; }
  }
  S.stats.kills += downN;
  if (downN) lines.push(`敌军倒下 ${downN} 人。`);
  const enemyPow = casPower(out.enemyDown);

  // 经验
  const xp = Math.round(enemyPow * 2.5 + 10);
  const ups = addHeroXp(S, out.win ? xp : xp * 0.5);
  giveTroopXp(pp.troops, enemyPow * (out.win ? 6 : 3));
  lines.push(`获得经验 ${Math.round(out.win ? xp : xp * 0.5)}。`);
  if (ups) lines.push(`你升到了 ${S.hero.level} 级！可以分配新的属性与技能点。`);

  let captured: Settlement | null = null;
  if (out.win) {
    S.stats.won++;
    // 战利品
    let gold = Math.round(enemyPow * randRange(2.5, 4));
    if (enemy) gold += Math.round(enemy.gold * 0.6);
    gold = Math.round(gold * (1 + partySkill(S, 'trade') * 0.03));
    pp.gold += gold;
    loot.push(`${gold} 两银子`);
    if (enemy) for (const g in enemy.goods) {
      const n = Math.ceil(enemy.goods[g] * randRange(0.4, 0.9));
      if (n > 0) { pp.goods[g] = (pp.goods[g] || 0) + n; loot.push(`${GOOD[g].name} ×${n}`); }
    }
    // 装备掉落
    const maxTier = Math.max(1, ...Object.keys(out.enemyDown).map(k => TROOPS[k]?.tier ?? 1));
    const drops = Math.min(3, Math.floor(downN / 12) + (chance(0.5) ? 1 : 0));
    for (let i = 0; i < drops; i++) {
      const pool = ITEM_LIST.filter(it => it.tier <= Math.min(5, maxTier) && it.price > 25);
      const it = weighted(pool.map(p => [p, 6 - p.tier] as [typeof p, number]));
      S.hero.inventory.push(it.id); loot.push(it.name);
    }
    // 声望与荣誉
    const ren = Math.round(Math.min(60, 2 + enemyPow / 4));
    S.renown += ren; lines.push(`声望 +${ren}。`);
    S.morale = Math.min(100, S.morale + 8);
    if (enemyFaction === 'bandit') { S.honor += 1; }
    for (const p of prisoners) addTroops(pp.prisoners, p.id, p.n);
    if (prisoners.length) lines.push(`俘获 ${count(prisoners)} 名敌兵。`);
    // 敌方部队处理
    if (enemy) {
      if (enemy.lordId) {
        const l = S.lords[enemy.lordId];
        lines.push(`${l.name}兵败逃走了。`);
        l.relation -= 3;
        log(`${S.hero.name}击败了${FACTION[enemy.faction].name}的${l.name}！`, 'gold');
      } else log(`你击败了${enemy.name}。`, 'good');
      if (enemy.questId) completeBanditQuest(enemy.questId);
      removeParty(enemy);
    } else if (siegeOf) {
      captured = siegeOf;
      captureSettlementByPlayer(siegeOf);
      lines.push(`你攻占了${siegeOf.name}！`);
    }
  } else {
    S.stats.lost++;
    S.morale = Math.max(0, S.morale - 15);
    if (!out.retreat) {
      // 战败：部队溃散，被俘后逃脱
      const lostGold = Math.round(pp.gold * 0.3);
      pp.gold -= lostGold;
      let lostTroops = 0;
      for (const st of [...pp.troops]) { const k = Math.round(st.n * 0.6); removeTroops(pp.troops, st.id, k); lostTroops += k; }
      for (const g in pp.goods) pp.goods[g] = Math.floor(pp.goods[g] * 0.5);
      pp.prisoners = [];
      S.hero.hp = 0.2;
      lines.push(`你战败被俘，损失了 ${lostGold} 两银子与 ${lostTroops} 名部下。`);
      const days = randInt(1, 3);
      S.time += days * 24;
      lines.push(`${days} 天后，你趁看守不备逃了出来，收拢了残部。`);
      log(`${S.hero.name}战败被俘，${days}天后逃脱。`, 'bad');
      S.renown = Math.max(0, S.renown - 5);
      const refuge = nearestSettlement(pp.x, pp.y, s => s.kind === 'town' && !playerHostileToSettlement(s));
      if (refuge) { pp.x = refuge.x + 8; pp.y = refuge.y + 8; lines.push(`你辗转来到了${refuge.name}附近。`); }
      emit('playerDefeated');
    }
    if (enemy && enemy.questId === undefined && healthy(enemy.troops) <= 0) removeParty(enemy);
  }
  if (enemy && healthy(enemy.troops) <= 0 && S.parties.includes(enemy)) removeParty(enemy);
  // 战斗关系影响
  if (enemy && (enemy.kind === 'caravan' || enemy.kind === 'villager')) { S.honor -= 3; changePlayerRel(enemyFaction, -5); }
  cleanStacks(enemyStacks);
  return { title: out.win ? '胜利' : out.retreat ? '撤退' : '战败', win: out.win, lines, loot, prisoners, captured };
}


// ---------- 占领据点 ----------
export function captureSettlementByPlayer(st: Settlement) {
  const pp = player();
  const old = st.faction;
  const side = S.playerFaction;
  const newFaction = side ?? 'player';
  if (!side) {
    // 独立：与原势力开战
    if (old !== 'player') setWar('player', old, true);
  }
  setOwner(st, newFaction, 'player');
  st.garrison = [];
  // 留下少量部队驻守
  const leave = Math.min(Math.floor(healthy(pp.troops) * 0.25), 20);
  let left = 0;
  for (const s of [...pp.troops].sort((a, b) => (TROOPS[a.id].tier) - (TROOPS[b.id].tier))) {
    if (left >= leave) break;
    const k = Math.min(s.n - s.w, leave - left);
    removeTroops(pp.troops, s.id, k); addTroops(st.garrison, s.id, k); left += k;
  }
  log(`${S.hero.name}攻占了${st.name}，${left} 名部下留守城中。`, 'gold');
  S.renown += st.kind === 'town' ? 40 : 25;
  checkFactionAlive(old);
}

export function setOwner(st: Settlement, faction: any, owner: string | null) {
  st.faction = faction; st.owner = owner; st.siege = null;
  for (const vid of st.villages) { const v = S.settlements[vid]; v.faction = faction; v.owner = owner; }
}

export function checkFactionAlive(f: string) {
  if (f === 'player' || !S.alive[f]) return;
  if (factionSettlements(f).filter(s => s.kind !== 'village').length === 0) {
    S.alive[f] = false;
    log(`${FACTION[f].name}已经覆灭！`, 'gold');
    for (const p of [...S.parties]) if (p.faction === f && p.kind !== 'player') removeParty(p);
    for (const l of Object.values(S.lords)) if (l.faction === f) { l.dead = true; l.partyId = null; }
    S.wars = S.wars.filter(k => !k.split('|').includes(f));
    if (S.playerFaction === f) { S.playerFaction = null; log('你效忠的势力已灭亡，你重获自由。', 'bad'); }
    if (S.mercOf === f) S.mercOf = null;
  }
  checkVictory();
}

export function checkVictory() {
  const towns = Object.values(S.settlements).filter(s => s.kind === 'town');
  const side = S.playerFaction ?? 'player';
  if (!S.won && towns.every(t => t.faction === side)) {
    S.won = true;
    emit('victory');
  }
}

// ---------- AI 之间的战斗 ----------
export function aiBattle(a: Party, b: Party) {
  const multA = a.kind === 'lord' ? 1.1 : 1, multB = b.kind === 'lord' ? 1.1 : 1;
  const r = autoResolve(a.troops, b.troops, multA, multB, a.kind === 'lord' ? 8 : 0, b.kind === 'lord' ? 8 : 0);
  for (const id in r.aDown) removeTroops(a.troops, id, Math.round(r.aDown[id] * 0.75)), woundSome(a.troops, id, r.aDown[id]);
  for (const id in r.bDown) removeTroops(b.troops, id, Math.round(r.bDown[id] * 0.75)), woundSome(b.troops, id, r.bDown[id]);
  const winner = r.aWin ? a : b, loser = r.aWin ? b : a;
  winner.gold += Math.round(loser.gold * 0.5);
  for (const g in loser.goods) winner.goods[g] = (winner.goods[g] || 0) + Math.floor(loser.goods[g] / 2);
  const pp = player();
  const near = Math.hypot(pp.x - a.x, pp.y - a.y) < 400;
  if (winner.lordId || loser.lordId || near) {
    const wn = winner.lordId ? lordName(winner.lordId) : winner.name;
    const ln = loser.lordId ? lordName(loser.lordId) : loser.name;
    if (winner.lordId && loser.lordId) log(`${FACTION[winner.faction].name}${wn}击败了${FACTION[loser.faction].name}${ln}。`, 'war');
    else if (near) log(`${wn}击败了${ln}。`, 'dim');
  }
  removeParty(loser);
  cleanStacks(winner.troops);
}
function woundSome(stacks: Stack[], id: string, n: number) {
  const st = stacks.find(s => s.id === id); if (!st) return;
  st.w = Math.min(st.n, st.w + Math.round(n * 0.25));
}

/** AI 领主攻城 */
export function aiSiegeAssault(p: Party, st: Settlement) {
  const defMult = st.kind === 'town' ? 1.6 : 1.8;
  const r = autoResolve(p.troops, st.garrison, 1, defMult, 8, 10);
  for (const id in r.aDown) removeTroops(p.troops, id, r.aDown[id]);
  for (const id in r.bDown) removeTroops(st.garrison, id, r.bDown[id]);
  cleanStacks(p.troops); cleanStacks(st.garrison);
  const old = st.faction, oldOwner = st.owner;
  if (r.aWin) {
    // 移交部分兵力为守军
    const g = st.garrison;
    for (const s of [...p.troops]) { const k = Math.floor((s.n - s.w) * 0.35); removeTroops(p.troops, s.id, k); addTroops(g, s.id, k); }
    setOwner(st, p.faction, p.lordId ?? null);
    log(`${FACTION[p.faction].name}${lordName(p.lordId ?? null)}攻陷了${FACTION[old]?.name ?? ''}的${st.name}！`, 'war');
    if (oldOwner === 'player') log(`你的封地${st.name}失守了！`, 'bad');
    checkFactionAlive(old);
    if (old === 'player') { /* 玩家势力可能失去全部领地 */ }
  } else {
    log(`${lordName(p.lordId ?? null)}攻打${st.name}失利。`, 'war');
  }
  st.siege = null;
  if (healthy(p.troops) < 5) removeParty(p);
  void fiefsOf; void pick;
}

export function heroHpAbs() { return Math.round(S.hero.hp * heroMaxHp(S.hero)); }
