// 部队相关工具函数
import { TROOPS, troopPower, UPGRADE_XP } from '../data/troops';
import { GOOD } from '../data/items';
import type { GameState, Party, Stack } from './state';
import { TER_SPEED, terAtXY } from './terrain';
import { partySkill } from './character';

export function count(stacks: Stack[]) { let n = 0; for (const s of stacks) n += s.n; return n; }
export function healthy(stacks: Stack[]) { let n = 0; for (const s of stacks) n += s.n - s.w; return n; }
export function wounded(stacks: Stack[]) { let n = 0; for (const s of stacks) n += s.w; return n; }

export function addTroops(stacks: Stack[], id: string, n: number, w = 0) {
  if (n <= 0) return;
  const st = stacks.find(s => s.id === id);
  if (st) { st.n += n; st.w += w; } else stacks.push({ id, n, w, xp: 0 });
}
export function removeTroops(stacks: Stack[], id: string, n: number, preferWounded = false) {
  const st = stacks.find(s => s.id === id);
  if (!st) return 0;
  const k = Math.min(n, st.n);
  st.n -= k;
  if (preferWounded) st.w = Math.max(0, st.w - k);
  else st.w = Math.min(st.w, st.n);
  if (st.n <= 0) stacks.splice(stacks.indexOf(st), 1);
  return k;
}
export function cleanStacks(stacks: Stack[]) {
  for (let i = stacks.length - 1; i >= 0; i--) { const s = stacks[i]; s.w = Math.max(0, Math.min(s.w, s.n)); if (s.n <= 0) stacks.splice(i, 1); }
}

export function strength(stacks: Stack[], healthyOnly = true) {
  let p = 0;
  for (const s of stacks) { const t = TROOPS[s.id]; if (!t) continue; p += troopPower(t) * (healthyOnly ? s.n - s.w : s.n); }
  return p;
}

export function partyStrength(s: GameState, p: Party) {
  let v = strength(p.troops);
  if (p.kind === 'player') {
    v += 6 + s.hero.level * 0.8; // 主角
    for (const c of s.companions) if (c.wounded <= 0) v += 6;
  } else if (p.kind === 'lord') v += 8;
  return v;
}

export function partySize(s: GameState, p: Party) {
  let n = count(p.troops);
  if (p.kind === 'player') n += 1 + s.companions.length;
  return n;
}

export function cargoCount(p: Party) { let n = 0; for (const k in p.goods) n += p.goods[k]; return n; }
export function cargoLimit(s: GameState, p: Party) { return 40 + healthy(p.troops) * 2 + (p.kind === 'player' ? s.companions.length * 5 : 0); }

export function mapSpeed(s: GameState, p: Party, night: boolean): number {
  let base = 9;
  const total = Math.max(1, count(p.troops));
  let mounted = 0;
  for (const st of p.troops) if (TROOPS[st.id]?.mounted) mounted += st.n - st.w;
  base *= 1 + 0.3 * (mounted / total);
  base *= 1 - Math.min(0.32, total / 350);
  const wf = wounded(p.troops) / total;
  base *= 1 - wf * 0.2;
  if (p.kind === 'player') {
    base *= 1 + partySkill(s, 'pathfinding') * 0.03;
    if (s.hero.equip.horse && total < 5) base *= 1.12;
    const over = cargoCount(p) - cargoLimit(s, p);
    if (over > 0) base *= Math.max(0.5, 1 - over / 100);
    if (s.morale < 20) base *= 0.85;
  }
  if (p.kind === 'caravan' || p.kind === 'villager') base *= 0.85;
  if (p.kind === 'bandit') base *= 1.05;
  if (night) base *= 0.85;
  const ts = TER_SPEED[terAtXY(p.x, p.y)] || 0.5;
  return base * ts;
}

export function weeklyWages(s: GameState, p: Party) {
  let w = 0;
  for (const st of p.troops) w += (TROOPS[st.id]?.wage ?? 2) * st.n;
  return Math.round(w * (1 - s.hero.skills.leadership * 0.04));
}

export function foodCount(p: Party) {
  let f = 0; for (const k in p.goods) if (GOOD[k]?.food) f += p.goods[k]; return f;
}
/** 每日粮食消耗（单位） */
export function dailyFood(s: GameState, p: Party) { return Math.max(1, Math.ceil(partySize(s, p) / 12)); }

export function canUpgrade(st: Stack) {
  const t = TROOPS[st.id];
  if (!t || !t.upgrades.length) return 0;
  const need = UPGRADE_XP[t.tier];
  return Math.min(st.n - st.w, Math.floor(st.xp / need));
}

/** 将经验分配到部队 */
export function giveTroopXp(stacks: Stack[], total: number) {
  const n = count(stacks); if (!n) return;
  for (const st of stacks) st.xp += Math.round((total * st.n) / n);
}

export function sortStacks(stacks: Stack[]) {
  stacks.sort((a, b) => (TROOPS[b.id]?.tier ?? 0) - (TROOPS[a.id]?.tier ?? 0) || a.id.localeCompare(b.id));
}

export function describeSize(n: number) {
  if (n < 10) return '小股';
  if (n < 30) return '一队';
  if (n < 80) return '一部';
  if (n < 150) return '大队';
  return '大军';
}
