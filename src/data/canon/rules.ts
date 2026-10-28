// 第 4 阶段（s4-content）：新物品的流通规则（market.ts ruleOf 的补充）
// · 生成的法器：凡品 / 下品是大路货，各地都有；中品以上只在本地域流通
// · 宗门弟子法器、宗门功法与法术：本宗坊市 / 藏经阁才有（别处只在大城以上拍卖会偶见）
// · 镇宗之宝、人物本命法宝：不卖、不随机掉落
import type { ItemDef } from '../items';
import { ART_META, SECT_TREASURE } from './artgen';
import { SPELL_TAG, CANON_SPELLS } from './spells';
import { GONGFA } from '../skills';
import { SECTS } from './sects';
import { REGION_IDS, type RegionId } from './types';

type PZ = 'TN' | 'LX' | 'DJ';
const PZ_OF: Record<RegionId, PZ> = { tiannan: 'TN', luanxing: 'LX', dajin: 'DJ' };
export interface CRule { z?: string[]; g: number; homes?: string[]; minLv?: number; owner?: string }
const TREASURE_SECT = new Map(Object.entries(SECT_TREASURE).map(([s, id]) => [id, s]));
const PERSON_OWNED: Record<string, string> = { art_p_wanhun: '六道极圣' };
const gOf = (t: number) => (t <= 1 ? 1 : t >= 5 ? 4 : t);

export function canonOwner(id: string): string | undefined {
  const s = TREASURE_SECT.get(id);
  if (s) return (SECTS[s]?.name ?? s) + '（镇宗之宝）';
  return PERSON_OWNED[id];
}
const cache = new Map<string, CRule | null>();
export function canonRule(it: ItemDef): CRule | null {
  if (cache.has(it.id)) return cache.get(it.id)!;
  let r: CRule | null = null;
  const own = canonOwner(it.id);
  const m = ART_META[it.id];
  if (own) r = { g: 5, owner: own };
  else if (m) {
    if (m.sect) { const S = SECTS[m.sect]; r = { g: Math.min(3, gOf(it.tier)), homes: [m.sect], z: S ? [PZ_OF[S.region]] : undefined }; }
    else if (m.region) r = it.tier <= 1 ? { g: gOf(it.tier) } : { g: gOf(it.tier), z: [PZ_OF[m.region]], minLv: it.tier >= 4 ? 5 : undefined }   // 极品以上只在雄城 / 名城露面;
  } else if (it.id.startsWith('scroll_gf_')) {
    const g = GONGFA[it.id.slice(10)];
    if (g) {
      const home = g.sect ? [g.sect] : undefined;
      const z = g.region ? [PZ_OF[g.region]] : undefined;
      r = { g: g.cat === 'secret' ? 4 : Math.min(4, gOf(g.tier ?? 1)), homes: home, z, minLv: (g.tier ?? 1) >= 4 ? 5 : undefined };   // 元婴级功法只在雄城 / 名城
    }
  } else if (it.id.startsWith('scroll_art_')) {
    const sid = it.id.slice(11), tag = SPELL_TAG[sid];
    const isNew = CANON_SPELLS.some((x) => x.id === sid);
    if (isNew && it.tier >= 4) r = { g: 4, minLv: 5, z: tag && (REGION_IDS as string[]).includes(tag) ? [PZ_OF[tag as RegionId]] : undefined, homes: tag && SECTS[tag] ? [tag] : undefined };
    else if (tag) {
      if ((REGION_IDS as string[]).includes(tag)) r = { g: gOf(it.tier), z: [PZ_OF[tag as RegionId]] };
      else if (SECTS[tag]) r = { g: Math.min(4, gOf(it.tier) + 1), homes: [tag], z: [PZ_OF[SECTS[tag].region]] };
    }
  }
  cache.set(it.id, r);
  return r;
}
/** 物品所属地域（无 = 各处都有） */
export function regionOfItem(it: ItemDef, rule: { z?: string[] } | null): RegionId[] | null {
  const m = ART_META[it.id];
  if (m?.region) return [m.region];   // 生成的法器（含大路货）都记产地；坊市里凡品下品仍各处有卖
  if (m?.sect && SECTS[m.sect]) return [SECTS[m.sect].region];
  const z = rule?.z;
  if (!z) return null;
  const out = new Set<RegionId>();
  for (const k of z) {
    if (k === 'TN' || k === 'yue' || k === 'tiannan' || k === 'mo' || k === 'mulan') out.add('tiannan');
    else if (k === 'LX' || k === 'luanxing') out.add('luanxing');
    else if (k === 'DJ' || k === 'dajin' || k === 'caoyuan') out.add('dajin');
  }
  return out.size ? [...out] : null;
}

/** 生成器批量炼出的法器 */
export const isGenerated = (id: string) => !!ART_META[id]?.gen;
