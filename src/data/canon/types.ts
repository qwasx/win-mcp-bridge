// 第 4 阶段（s4-content）：功法 · 法宝 · 神通扩充 —— 四层数据表（地域 → 势力 → 宗门 → 人物）的公共类型与五行
import type { School } from '../arts';
import type { ArtSpec } from '../items';

/** 地域 = 三张大图 */
export type RegionId = 'tiannan' | 'luanxing' | 'dajin';
export const REGION_IDS: RegionId[] = ['tiannan', 'luanxing', 'dajin'];

/** 五行与变异灵根（风雷冰），外加阴（魔道鬼道）与无属性 */
export type Wx = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'thunder' | 'ice' | 'wind' | 'yin' | 'none';
export type Wx5 = 'metal' | 'wood' | 'water' | 'fire' | 'earth';
export const WX_NAME: Record<Wx, string> = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土', thunder: '雷', ice: '冰', wind: '风', yin: '阴', none: '无' };
export const WX_COLOR: Record<Wx, string> = { metal: '#d8b860', wood: '#4f9a48', water: '#3f7ab0', fire: '#d8582a', earth: '#a07840', thunder: '#6a7ae0', ice: '#5aa8d8', wind: '#4aa890', yin: '#8a3a8a', none: '#8a8a80' };
export const WX5: Wx5[] = ['metal', 'wood', 'water', 'fire', 'earth'];
/** 相生：木生火、火生土、土生金、金生水、水生木 */
export const SHENG: Record<Wx5, Wx5> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
/** 相克：金克木、木克土、土克水、水克火、火克金 */
export const KE: Record<Wx5, Wx5> = { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' };
/** 变异属性归入五行（雷属木之变、冰属水之变、风属木之变） */
export const BASE5: Record<Wx, Wx5 | null> = { metal: 'metal', wood: 'wood', water: 'water', fire: 'fire', earth: 'earth', thunder: 'wood', ice: 'water', wind: 'wood', yin: null, none: null };
export const VARIANT: Wx[] = ['thunder', 'ice', 'wind'];

/** 法术系别 → 五行 */
export function wxOfSchool(s: School | undefined): Wx {
  switch (s) {
    case '火': return 'fire'; case '冰': return 'ice'; case '雷': return 'thunder'; case '风': return 'wind'; case '土': return 'earth';
    case '木': return 'wood'; case '剑': return 'metal'; case '魔': return 'yin'; default: return 'none';
  }
}
/** 法器属性 → 五行 */
export function wxOfArt(el: ArtSpec['element']): Wx {
  switch (el) {
    case 'fire': return 'fire'; case 'ice': return 'ice'; case 'thunder': return 'thunder'; case 'gold': return 'metal'; case 'wood': return 'wood';
    case 'water': return 'water'; case 'earth': return 'earth'; case 'yin': case 'blood': return 'yin'; default: return 'none';
  }
}
/** 五行 → 法器属性 */
export function artElOf(w: Wx): ArtSpec['element'] {
  switch (w) {
    case 'fire': return 'fire'; case 'ice': return 'ice'; case 'thunder': return 'thunder'; case 'metal': return 'gold'; case 'wood': return 'wood';
    case 'water': return 'water'; case 'earth': return 'earth'; case 'yin': return 'yin'; case 'wind': return 'wood'; default: return undefined;
  }
}
/** a 打 b 的五行倍率（相克 1.25 / 被克 0.85 / 同属 0.9） */
export function wxK(a: Wx, b: Wx): number {
  const A = BASE5[a], B = BASE5[b];
  if (!A || !B) { if (a === 'yin' && b !== 'yin' && b !== 'none') return 1; if (b === 'yin' && (a === 'thunder' || a === 'fire')) return 1.25; return 1; }
  if (KE[A] === B) return 1.25;
  if (KE[B] === A) return 0.85;
  return 1;
}

export interface FactionDef { id: string; name: string; region: RegionId; evil?: boolean; desc: string }
export interface SectDef {
  id: string;              // 与地点 id / schools.ts 流派 id 一致
  name: string; region: RegionId; faction: string; wx: Wx; evil?: boolean;
  /** 镇派功法（GONGFA id） */
  gongfa: string;
  /** 门中常传的法术（ART id，3～6 门） */
  arts: string[];
  /** 弟子常用法器（物品 id） */
  gear: string[];
  /** 镇宗之宝（不外卖、不随机掉落） */
  treasure: string;
  /** 本门辅修 / 秘术（GONGFA id） */
  extra?: string[];
  desc: string;
}
export interface PersonDef {
  id: string;              // npc.ts / beauties 里的 id（没有现成人物的写原著名拼音）
  name: string; sect: string; title: string;
  /** 本命法宝 */
  treasure: string[];
  /** 招牌神通（ART id，玩家可从其遗物中参悟；敌对时他会用） */
  sig: string;
  /** 主修功法 */
  gongfa: string;
  line: string;            // 一句原著味的介绍
}
