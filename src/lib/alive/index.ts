// 活世界 · 引擎出口
export * from './types';
export * from './rng';
export * from './content';
export * from './world';
export * from './roster';

// ---------------------------------------------------------------- 存取（存档 / 数据库）
import type { World } from './types';

export interface SaveBlob {
  v: 1;
  seed: number;
  day: number;
  souls: World['souls'][string][];
  families: World['families'][string][];
  sects: World['sects'][string][];
  rumors: World['rumors'];
  chron: World['chron'];
  contacts: World['contacts'];
  hero: World['hero'];
  heroName: string;
  stats: World['stats'];
  buzz: Record<string, number>;
}

export function serialize(w: World): SaveBlob {
  return {
    v: 1, seed: w.seed, day: Math.round(w.day),
    souls: Object.keys(w.souls).map((k) => w.souls[k]),
    families: Object.keys(w.families).map((k) => w.families[k]),
    sects: Object.keys(w.sects).map((k) => w.sects[k]),
    rumors: w.rumors, chron: w.chron.slice(-400), contacts: w.contacts,
    hero: w.hero, heroName: w.heroName, stats: w.stats, buzz: w.buzz,
  };
}

export function deserialize(b: SaveBlob): World {
  const souls: World['souls'] = {};
  for (const s of b.souls ?? []) souls[s.id] = s;
  const families: World['families'] = {};
  for (const f of b.families ?? []) families[f.id] = f;
  const sects: World['sects'] = {};
  for (const s of b.sects ?? []) sects[s.id] = s;
  return {
    seed: b.seed, day: b.day, souls, families, sects,
    rumors: b.rumors ?? [], chron: b.chron ?? [], contacts: b.contacts ?? [],
    hero: b.hero, heroName: b.heroName, stats: b.stats, buzz: b.buzz ?? {},
  };
}
