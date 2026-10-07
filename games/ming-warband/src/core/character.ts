// 角色属性、技能与派生数值
import type { AttrId, GameState, Hero, SkillId } from './state';
import { COMPANIONS } from '../data/world';
import { ITEMS } from '../data/items';

export const ATTRS: { id: AttrId; name: string; desc: string }[] = [
  { id: 'str', name: '力量', desc: '提升生命与近战伤害，决定铁骨/强击/训练上限' },
  { id: 'agi', name: '敏捷', desc: '提升战场移动速度，决定射术/骑术上限' },
  { id: 'int', name: '智力', desc: '每点额外获得技能点，决定战术/交易/医术/侦察/寻路上限' },
  { id: 'cha', name: '魅力', desc: '提升部队上限，决定统御/管束上限' },
];

export const SKILLS: { id: SkillId; name: string; attr: AttrId; party: boolean; desc: string }[] = [
  { id: 'ironflesh', name: '铁骨', attr: 'str', party: false, desc: '每级 +6 生命' },
  { id: 'powerstrike', name: '强击', attr: 'str', party: false, desc: '每级近战伤害 +8%' },
  { id: 'training', name: '训练', attr: 'str', party: true, desc: '每日为部下提供经验' },
  { id: 'archery', name: '射术', attr: 'agi', party: false, desc: '每级远程伤害 +7%，精度提高' },
  { id: 'riding', name: '骑术', attr: 'agi', party: false, desc: '可驾驭更好的马匹，马速提升' },
  { id: 'tactics', name: '战术', attr: 'int', party: true, desc: '自动结算时我军战力 +6%/级' },
  { id: 'trade', name: '交易', attr: 'int', party: true, desc: '买卖价格更优惠' },
  { id: 'surgery', name: '医术', attr: 'int', party: true, desc: '阵亡变为负伤的几率提高，伤兵恢复更快' },
  { id: 'spotting', name: '侦察', attr: 'int', party: true, desc: '大地图视野 +10%/级' },
  { id: 'pathfinding', name: '寻路', attr: 'int', party: true, desc: '大地图行军速度 +3%/级' },
  { id: 'leadership', name: '统御', attr: 'cha', party: false, desc: '部队上限 +5/级，士气提升，军饷降低' },
  { id: 'prisoner', name: '管束', attr: 'cha', party: true, desc: '俘虏上限 +5/级' },
];
export const SKILL: Record<string, (typeof SKILLS)[number]> = {};
for (const s of SKILLS) SKILL[s.id] = s;

export function skillCap(h: Hero, s: SkillId) { return Math.min(10, Math.floor(h.attrs[SKILL[s].attr] / 2)); }
export function xpForLevel(l: number) { return Math.round(120 * Math.pow(l, 1.75)); }

export function newHero(name: string): Hero {
  return {
    name, background: '', level: 1, xp: 0,
    attrs: { str: 5, agi: 5, int: 5, cha: 5 },
    skills: { ironflesh: 0, powerstrike: 0, archery: 0, riding: 0, leadership: 0, training: 0, tactics: 0, trade: 0, surgery: 0, spotting: 0, pathfinding: 0, prisoner: 0 },
    attrPts: 2, skillPts: 3, hp: 1,
    equip: { melee: 'w_chaidao', ranged: null, armor: 'a_cloth', helm: 'h_cloth', horse: null },
    inventory: [],
  };
}

export function heroMaxHp(h: Hero) { return 50 + h.attrs.str * 3 + h.skills.ironflesh * 6 + h.level; }

/** 增加经验，返回升级次数 */
export function addHeroXp(s: GameState, xp: number): number {
  const h = s.hero; h.xp += Math.round(xp);
  let ups = 0;
  while (h.xp >= xpForLevel(h.level)) {
    h.xp -= xpForLevel(h.level); h.level++; ups++;
    h.attrPts += 1; h.skillPts += 1 + (h.attrs.int >= 8 ? 1 : 0);
  }
  return ups;
}

/** 队伍技能：取主角与健康同伴中的最高值 */
export function partySkill(s: GameState, id: SkillId): number {
  let v = s.hero.skills[id];
  if (SKILL[id].party) {
    for (const c of s.companions) {
      if (c.wounded > 0) continue;
      const d = COMPANIONS.find(x => x.id === c.id);
      const cv = d?.skills[id] ?? 0;
      if (cv > v) v = cv;
    }
  }
  return v;
}

export function partyLimit(s: GameState) {
  return 20 + s.hero.skills.leadership * 5 + s.hero.attrs.cha + Math.floor(s.renown / 25);
}
export function prisonerLimit(s: GameState) { return 5 + partySkill(s, 'prisoner') * 5 + Math.floor(s.hero.attrs.cha / 2); }
export function sightRange(s: GameState, night: boolean) { return 230 * (1 + partySkill(s, 'spotting') * 0.1) * (night ? 0.65 : 1); }
export function buyMult(s: GameState) { return 1.12 - partySkill(s, 'trade') * 0.012; }
export function sellMult(s: GameState) { return 0.86 + partySkill(s, 'trade') * 0.012; }
export function horseRidingReq(itemId: string) { const t = ITEMS[itemId]?.tier ?? 1; return Math.max(0, t - 2); }

export function heroArmor(h: Hero) {
  return (h.equip.armor ? ITEMS[h.equip.armor].armor ?? 0 : 0) + (h.equip.helm ? ITEMS[h.equip.helm].armor ?? 0 : 0);
}
