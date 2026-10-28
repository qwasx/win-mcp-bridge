// 第 4 阶段（s4-content）：掉落按地域、宗门出
// rollLoot(地域, 宗门, 档次, rng)：
//   · 凡品、下品的大路货各地都掉；中品以上只掉本地域的东西（天南掉不出乱星海的蛟骨梭）
//   · 在某个宗门的地界（或打的是某宗门的人），本门弟子法器、本门法术 / 功法玉简的权重大增，别派秘传一概不掉
//   · 镇宗之宝、原著有主之宝、独门秘术不进随机池
import { ITEM_LIST, type ItemDef } from '../items';
import { ARTS } from '../arts';
import { GONGFA } from '../skills';
import { ruleOf, canonOwned } from '../market';
import { ART_META } from './artgen';
import { SPELL_TAG } from './spells';
import { regionOfItem } from './rules';
import { SECTS } from './sects';
import { REGION_IDS, wxOfArt, type RegionId, type Wx } from './types';

export type LootCat = 'art' | 'spell' | 'gongfa';
const CANON_ONLY = new Set(['art_xutianding', 'art_fenglei', 'art_qingzhu', 'art_xuese']);

interface Cand { id: string; tier: number; region: RegionId[] | null; sect?: string; homes?: string[]; cat: LootCat; wx: Wx }
let CANDS: Cand[] | null = null;
function cands(): Cand[] {
  if (CANDS) return CANDS;
  const out: Cand[] = [];
  for (const it of ITEM_LIST as ItemDef[]) {
    if (it.price <= 0 || canonOwned(it.id) || CANON_ONLY.has(it.id)) continue;
    const r = ruleOf(it);
    let cat: LootCat | null = null, sect: string | undefined, tier = it.tier;
    if (it.type === 'artifact') { cat = 'art'; sect = ART_META[it.id]?.sect ?? r.homes?.[0]; if (it.price >= 400000) continue; }
    else if (it.id.startsWith('scroll_art_')) {
      const s = ARTS[it.id.slice(11)]; if (!s || s.needs || s.tier > 4) continue;
      cat = 'spell'; const tag = SPELL_TAG[s.id]; sect = tag && SECTS[tag] ? tag : r.homes?.[0];
    } else if (it.id.startsWith('scroll_gf_')) {
      const g = GONGFA[it.id.slice(10)]; if (!g) continue;
      cat = 'gongfa'; sect = g.sect; tier = g.tier ?? it.tier;
    }
    if (!cat) continue;
    const homes = sect ? [...new Set([sect, ...(r.homes ?? [])])] : r.homes;
    const wx: Wx = it.art ? (ART_META[it.id]?.wx ?? wxOfArt(it.art.element)) : cat === 'gongfa' ? (GONGFA[it.id.slice(10)]?.wx ?? 'none') : 'none';
    out.push({ id: it.id, tier, region: regionOfItem(it, r), sect, homes, cat, wx });
  }
  return (CANDS = out);
}

const poolCache = new Map<string, [string, number][]>();
/** 某地、某宗门、某档次的掉落池（id, 权重），按权重从高到低 */
export function lootPool(region: RegionId, sect: string | undefined, tier: number, cat: LootCat): [string, number][] {
  const key = `${region}|${sect ?? ''}|${tier}|${cat}`;
  const hit = poolCache.get(key); if (hit) return hit;
  const sectOk = sect && SECTS[sect] ? sect : undefined;
  const out: [string, number][] = [];
  for (const c of cands()) {
    if (c.cat !== cat || c.tier > tier) continue;
    if (cat === 'gongfa' && GONGFA[c.id.slice(10)]?.cat === 'secret' && tier < 3) continue;
    const local = !c.region || c.region.includes(region);
    let w: number;
    if (c.homes?.length) {
      if (sectOk && c.homes.includes(sectOk)) w = 9;                    // 本门之物
      else continue;                                                     // 别派秘传：不掉
    } else if (!local) { if (c.tier > 1) continue; w = 0.35; }            // 外地货：只有大路货会流到这里
    else w = c.region ? (c.tier >= 2 ? 2.4 : 1.3) : (c.tier >= 2 ? 0.7 : 1);
    w *= Math.pow(0.62, c.tier) * (1 + 0.25 * Math.max(0, c.tier - tier + 2));
    if (sectOk && c.wx !== 'none' && c.wx === SECTS[sectOk].wx) w *= 2.4;   // 宗门地界：本门五行的东西更常见
    out.push([c.id, w]);
  }
  out.sort((a, b) => b[1] - a[1]);
  poolCache.set(key, out);
  return out;
}

/** 掷一件掉落。cat 缺省时：法器 5 成、法术玉简 3.5 成、功法玉简 1.5 成。exclude：不要的 id（如已学会的法术） */
export function rollLoot(region: RegionId, sect: string | undefined, tier: number, rng: () => number = Math.random, cat?: LootCat, exclude?: (id: string) => boolean): string | null {
  const c: LootCat = cat ?? (() => { const x = rng(); return x < 0.5 ? 'art' : x < 0.85 ? 'spell' : 'gongfa'; })();
  let pool = lootPool(region, sect, Math.max(0, Math.min(5, tier)), c);
  if (exclude) pool = pool.filter(([id]) => !exclude(id));
  if (!pool.length) return null;
  let s = 0; for (const [, w] of pool) s += w;
  let x = rng() * s;
  for (const [id, w] of pool) { x -= w; if (x <= 0) return id; }
  return pool[0][0];
}

/** 两处掉落池的重合度（按掉落几率加权，0–1）：同一次掉落落在“两地都有的东西”上的几率 */
export function poolOverlap(a: [string, number][], b: [string, number][]) {
  const na = a.reduce((s, x) => s + x[1], 0) || 1, nb = b.reduce((s, x) => s + x[1], 0) || 1;
  const mb = new Map(b.map(([id, w]) => [id, w / nb]));
  let o = 0; for (const [id, w] of a) o += Math.min(w / na, mb.get(id) ?? 0);
  return o;
}
export { REGION_IDS };
