// 第 4 阶段（s4-content）：掉落按地域、宗门——战斗 / NPC 的接入层（逻辑在 data/canon/loot.ts）
import type { Game } from './game';
import type { Enemy } from './combat';
import { LOCATIONS, ACTIVE_MAP, WORLD_SCALE } from '../data/world';
import { ARTS } from '../data/arts';
import { itemDef } from '../data/items';
import { rollLoot, lootPool, type LootCat } from '../data/canon/loot';
import { SECTS } from '../data/canon/sects';
import { PERSON_BY_ID } from '../data/canon/people';
import { REGIONS } from '../data/canon/regions';
import type { RegionId } from '../data/canon/types';

/** 地点 → 宗门（地点 id 与宗门不同名的） */
const LOC_SECT: Record<string, string> = { tianxing: 'xinggong' };
/** 宗门地界半径（地图单位） */
export const SECT_RADIUS = 42;

export const regionHere = (): RegionId => ACTIVE_MAP as RegionId;
/** (x, y)（世界像素）处于哪个宗门的地界 */
export function sectAt(x: number, y: number): string | undefined {
  const mx = x / WORLD_SCALE, my = y / WORLD_SCALE;
  let best: string | undefined, bd = SECT_RADIUS;
  for (const l of LOCATIONS) {
    const sid = LOC_SECT[l.id] ?? l.id;
    if (!SECTS[sid]) continue;
    const d = Math.hypot(l.x - mx, l.y - my);
    if (d < bd) { bd = d; best = sid; }
  }
  return best;
}
/** 敌人所属宗门：修士按其流派，否则按所在地界 */
export function sectOfEnemy(e: Enemy): string | undefined {
  if (e.school && SECTS[e.school]) return e.school;
  return sectAt(e.x, e.y);
}

function excluder(g: Game) {
  const h = g.hero;
  return (id: string) => {
    if (id.startsWith('scroll_art_')) return h.arts.some((a) => a.id === id.slice(11)) || (ARTS[id.slice(11)]?.realm ?? 0) > h.realm + 1;
    if (id.startsWith('scroll_gf_')) { const k = id.slice(10); return h.gongfa === k || (h.gfKnown ?? []).includes(k) || (h.gfAux ?? []).includes(k); }
    return false;
  };
}

/** 战斗中击杀：原“随机卷轴”改为按地域 / 宗门出（法器、法术玉简、功法玉简） */
export function canonDrops(g: Game, e: Enemy, dz: number) {
  const human = e.def.kind === 'human';
  const tier = Math.min(5, Math.floor(dz / 1.5) + (e.realm >= 2 ? 1 : 0) + (human && e.realm >= 3 ? 1 : 0));
  const sect = sectOfEnemy(e);
  if (Math.random() < 0.05 + dz * 0.025 + (human ? 0.1 : 0)) {
    const cat: LootCat | undefined = human ? undefined : Math.random() < 0.7 ? 'spell' : 'art';   // 妖兽身上多是前人遗落的玉简
    const id = rollLoot(regionHere(), sect, tier, Math.random, cat, excluder(g));
    if (id) g.combat.dropLoot(e.x, e.y, id, 1);
  }
  // 宗门的元婴长老：偶尔带着镇宗之宝
  if (human && e.realm >= 4 && sect && e.school === sect && Math.random() < 0.08) {
    const t = SECTS[sect].treasure;
    if (t) { g.combat.dropLoot(e.x, e.y, t, 1); g.toast(`${e.name}身上竟带着${SECTS[sect].name}的镇宗之宝「${itemDef(t).name}」！`, 'good'); }
  }
}

/** NPC 修士被杀：身上的玉简、法器按其宗门 / 所在地域出；原著人物另掉本命法宝 */
export function npcCanonDrops(g: Game, d: { id: string; realm: number; home: string; sect?: string; title?: string }, e: Enemy, treasureTable: Record<string, string | string[]>) {
  const sect = (d.sect && SECTS[d.sect] ? d.sect : SECTS[d.home] ? d.home : LOC_SECT[d.home]) ?? sectAt(e.x, e.y);
  const ex = excluder(g);
  if (d.realm >= 1 && Math.random() < 0.55) { const id = rollLoot(regionHere(), sect, Math.min(4, d.realm + 1), Math.random, Math.random() < 0.8 ? 'spell' : 'gongfa', ex); if (id) g.combat.dropLoot(e.x, e.y, id, 1); }
  if (d.realm >= 2 && Math.random() < 0.35) { const id = rollLoot(regionHere(), sect, Math.min(5, d.realm), Math.random, 'art'); if (id) g.combat.dropLoot(e.x, e.y, id, 1); }
  // 原著人物：本命法宝（npc.ts 的表里没有的补上）+ 招牌神通玉简
  const P = PERSON_BY_ID[d.id];
  if (P) {
    const have = treasureTable[d.id], has = new Set(Array.isArray(have) ? have : have ? [have] : []);
    for (const t of P.treasure) if (!has.has(t)) g.combat.dropLoot(e.x, e.y, t, 1);
    if (!g.hero.arts.some((a) => a.id === P.sig) && itemDef('scroll_art_' + P.sig).type === 'scroll') g.combat.dropLoot(e.x, e.y, 'scroll_art_' + P.sig, 1);
  }
  // 宗门之主：镇宗之宝
  if (sect && (d.realm >= 4 || /掌门|老祖|门主|宗主|岛主|教主/.test(d.title ?? '')) && SECTS[sect]?.treasure) {
    const t = SECTS[sect].treasure;
    g.combat.dropLoot(e.x, e.y, t, 1);
    g.toast(`${SECTS[sect].name}的镇宗之宝「${itemDef(t).name}」自尸身旁滚落！`, 'good');
  }
}

/** 随机法术玉简（原 combat.randomScroll）：按地域 / 宗门 */
export function rollScroll(g: Game, maxTier: number): string | null {
  const p = g.player;
  return rollLoot(regionHere(), sectAt(p.x, p.y), Math.min(4, maxTier), Math.random, 'spell', excluder(g));
}

/** 面板“此地出产”：当前所在地域 / 宗门地界的常见掉落（每类取前几件） */
export function localLoot(g: Game, n = 8) {
  const p = g.player, region = regionHere(), sect = sectAt(p.x, p.y);
  const tier = Math.min(5, Math.max(2, g.hero.realm + 1));
  return {
    region: REGIONS[region], sect: sect ? SECTS[sect] : undefined,
    art: lootPool(region, sect, tier, 'art').slice(0, n).map(([id]) => id),
    spell: lootPool(region, sect, tier, 'spell').slice(0, n).map(([id]) => id),
    gongfa: lootPool(region, sect, tier, 'gongfa').slice(0, Math.ceil(n / 2)).map(([id]) => id),
  };
}

/** 来源审计（tools/audit-sources.ts）：本文件实现的杀人夺宝来源 */
export function canonSources(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const s of Object.values(SECTS)) if (s.treasure) o[s.treasure] ??= `杀${s.name}之主 / 元婴长老（canonloot.ts）`;
  for (const p of Object.values(PERSON_BY_ID)) for (const t of p.treasure) o[t] ??= `杀${p.name}（canonloot.ts）`;
  return o;
}
