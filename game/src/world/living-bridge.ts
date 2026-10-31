import { createLiving, advance, act, type LivingState, type Person, type WorldAction } from '../../../src/world/living';
import type { NpcData } from './npc';
import { LOC_BY_ID, WORLD_SCALE } from '../data/world';

/** One authoritative simulation, shared by the original game and the observatory. */
export function initializeLiving(list: NpcData[], saved?: LivingState): LivingState {
  return saved?.schema === 1 && Array.isArray(saved.people) ? saved : createLiving(list);
}
export function tickLiving(state: LivingState, days: number) { return advance(state, days); }
export function livingAction(state: LivingState, action: WorldAction) { return act(state, action).state; }
export function syncLiving(state: LivingState, list: NpcData[]) {
  const people = new Map(state.people.map(p => [p.id, p]));
  for (const d of list) {
    const p = people.get(d.id); if (!p) continue;
    d.realm = p.realm; d.stage = p.stage; d.age = p.age; d.life = p.life; d.wealth = p.wealth;
    d.favor = p.favor; d.met = p.met; d.home = p.home; d.map = p.map as NpcData['map'];
    d.bag = p.bag; d.learned = p.arts; d.lifeGoal = p.goal; d.lifeReason = p.reason;
    d.alive = p.alive;
    if (!p.alive) d.deathNote ??= p.memories[0]?.text ?? '身死道消';
    d.ties = p.relations.map(r => ({ id: r.id, k: r.kind === 'family' ? 'kin' : r.kind === 'spouse' ? 'lover' : r.kind === 'master' ? 'master' : r.kind === 'disciple' ? 'disciple' : 'friend', r: r.label }));
    const worst = [...p.grudges].sort((a, b) => b.value - a.value)[0];
    const pg = p.playerGrudge ?? 0;
    d.grudge = Math.max(pg, worst ? (worst.value >= 50 ? 2 : 1) : 0); d.why = pg > 0 ? p.playerWhy : worst?.reason;
  }
}
export function syncPerson(state: LivingState, d: NpcData) {
  const p = state.people.find(p => p.id === d.id); if (!p) return;
  p.wealth = d.wealth; p.favor = d.favor; p.met = d.met; p.home = d.home; p.location = d.home;
  p.map = d.map ?? 'tiannan'; p.bag = d.bag ?? p.bag;
  p.playerGrudge = d.grudge; p.playerWhy = d.why;
  const loc = LOC_BY_ID.get(d.home); if (loc) { p.x = loc.x / 10; p.y = loc.y / 7; }
}
export function recordLivingDeath(state: LivingState, id: string, reason: string, day: number) {
  const p = state.people.find(p => p.id === id); if (!p || !p.alive) return;
  p.alive = false; p.health = 0; p.memories.unshift({ day, text: reason });
  const heir = p.relations.map(r => state.people.find(o => o.id === r.id)).find(o => o?.alive && o.home === p.home);
  if (heir) { heir.wealth += p.wealth; for (const item of p.bag) { const old = heir.bag.find(i => i.id === item.id); if (old) old.qty += item.qty; else heir.bag.push({ ...item }); } heir.memories.unshift({ day, text: `${p.name}身故，遗物由我保管。` }); }
  p.wealth = 0; p.bag = [];
}
export function livingDestination(p: Person, d: NpcData) {
  let id = p.destination ?? p.home;
  if (p.goal === 'cultivate' || p.goal === 'rest' || p.goal === 'sect') id = p.home;
  if (!LOC_BY_ID.has(id)) id = d.home;
  const loc = LOC_BY_ID.get(id)!;
  return { x: loc.x * WORLD_SCALE, y: loc.y * WORLD_SCALE };
}
