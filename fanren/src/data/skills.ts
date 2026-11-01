// 功法、法术、逆天改命
export interface GongfaDef {
  id: string; name: string; desc: string;
  rate: number;          // 修炼速度倍率
  maxRealm: number;      // 可修炼到的最高大境界（超出后效果减半）
  atk?: number; hp?: number; def?: number; mp?: number; sword?: number; // 百分比加成
  aux?: boolean;         // 辅修功法（大衍诀）
}

export const GONGFA: Record<string, GongfaDef> = {
  changchun: { id: 'changchun', name: '长春功', desc: '炼气入门功法，药力吸收略强。', rate: 1.0, maxRealm: 2, mp: 0.1 },
  qingyuan: { id: 'qingyuan', name: '青元剑诀', desc: '剑修无上功法：修炼速度+25%，飞剑伤害+30%。', rate: 1.25, maxRealm: 5, sword: 0.3, atk: 0.1 },
  xuanyin: { id: 'xuanyin', name: '玄阴经', desc: '鬼道魔功：修炼速度+40%，法力+20%。', rate: 1.4, maxRealm: 4, mp: 0.2, atk: 0.05 },
  tuotian: { id: 'tuotian', name: '托天魔功', desc: '法体双修：修炼速度+15%，气血+60%，防御+30%。', rate: 1.15, maxRealm: 5, hp: 0.6, def: 0.3 },
  generic: { id: 'generic', name: '基础吐纳术', desc: '散修常见的吐纳法门。', rate: 0.8, maxRealm: 3 },
  dayan: { id: 'dayan', name: '大衍诀', desc: '辅修神识秘术：每修成一层，神识倍增（共七层），并解锁惊神刺。', rate: 1, maxRealm: 5, aux: true },
};

// 大衍诀每层需要的境界（全局等级）
export const DAYAN_REQ = [15, 16, 17, 19, 20, 21, 22]; // 筑基中期、筑基后期、结丹初期、结丹后期、元婴初、中、后

export interface SkillDef {
  id: string; name: string; desc: string; mp: number; cd: number;
  kind: 'bolt' | 'ice' | 'dash' | 'nova' | 'stun' | 'map' | 'passive' | 'shield' | 'lock';
  power: number; color: string; key?: string;
}

export const SKILLS: Record<string, SkillDef> = {
  huodan: { id: 'huodan', name: '火弹术', desc: '射出火弹。', mp: 4, cd: 0.6, kind: 'bolt', power: 1.3, color: '#ff7a3a' },
  bingzhui: { id: 'bingzhui', name: '冰锥术', desc: '射出冰锥，命中减速。', mp: 8, cd: 1.6, kind: 'ice', power: 1.8, color: '#90d8ff' },
  leidian: { id: 'leidian', name: '掌心雷', desc: '前方范围雷击。', mp: 20, cd: 4, kind: 'nova', power: 3.5, color: '#a0c0ff' },
  jingshen: { id: 'jingshen', name: '惊神刺', desc: '大衍诀神通：以神识攻击，对神识弱于你的敌人造成伤害并使其失神2秒。', mp: 15, cd: 7, kind: 'stun', power: 2.2, color: '#e0d0ff' },
  yuanci: { id: 'yuanci', name: '元磁神光', desc: '禁锢敌人法宝4秒。', mp: 60, cd: 15, kind: 'lock', power: 0, color: '#c0a0ff' },
  dash: { id: 'dash', name: '御风步', desc: '身法闪避。', mp: 3, cd: 1.6, kind: 'dash', power: 1, color: '#d0f0e0' },
  luoyan: { id: 'luoyan', name: '罗烟步', desc: '身法闪避，冷却更短，距离更远。', mp: 3, cd: 1.0, kind: 'dash', power: 1.3, color: '#d0f0e0' },
  leidun: { id: 'leidun', name: '雷遁', desc: '风雷翅神通：化作雷光瞬移，并在落点放出雷弧。', mp: 6, cd: 0.8, kind: 'dash', power: 1.8, color: '#9fc0ff' },
  tianyan: { id: 'tianyan', name: '天眼术', desc: '大地图神识范围+50%，持续30天。', mp: 0, cd: 0, kind: 'map', power: 1.5, color: '#fff' },
  lianqi: { id: 'lianqi', name: '敛气术', desc: '被动：他人探查时你的修为显得低两个小境界，神识圈不易被察觉。', mp: 0, cd: 0, kind: 'passive', power: 0, color: '#fff' },
  mingqing: { id: 'mingqing', name: '明清灵目', desc: '被动：看穿隐匿修士与隐藏宝物、秘境。', mp: 0, cd: 0, kind: 'passive', power: 0, color: '#fff' },
};

// 逆天改命（突破时三选一）
export interface TalentDef { id: string; name: string; desc: string; tier: number; mods: Partial<Record<TalentMod, number>> }
export type TalentMod = 'atk' | 'hp' | 'mp' | 'def' | 'sense' | 'speed' | 'exp' | 'alchemy' | 'luck' | 'crit' | 'lifesteal' | 'reduce' | 'life' | 'herb' | 'swordDmg' | 'artCd' | 'mapSpeed' | 'charm' | 'regen' | 'loot';

export const TALENTS: TalentDef[] = [
  { id: 't_jianxin', name: '剑心通明', desc: '飞剑伤害+25%', tier: 2, mods: { swordDmg: 0.25 } },
  { id: 't_shenshi', name: '神识如海', desc: '神识+25%', tier: 2, mods: { sense: 0.25 } },
  { id: 't_shenshi2', name: '元神坚凝', desc: '神识+15%，受到伤害-5%', tier: 2, mods: { sense: 0.15, reduce: 0.05 } },
  { id: 't_wudao', name: '悟道', desc: '修炼速度+30%', tier: 3, mods: { exp: 0.3 } },
  { id: 't_lingshen', name: '灵身', desc: '气血+30%', tier: 1, mods: { hp: 0.3 } },
  { id: 't_fahai', name: '法海', desc: '法力+35%，法力回复+50%', tier: 2, mods: { mp: 0.35, regen: 0.5 } },
  { id: 't_jingang', name: '金刚不坏', desc: '防御+30%', tier: 1, mods: { def: 0.3 } },
  { id: 't_shasheng', name: '杀生', desc: '攻击+20%', tier: 2, mods: { atk: 0.2 } },
  { id: 't_xueyin', name: '血饮', desc: '造成伤害的4%转化为气血', tier: 3, mods: { lifesteal: 0.04 } },
  { id: 't_danshen', name: '丹道圣手', desc: '炼丹成功率+25%，成丹数+1', tier: 2, mods: { alchemy: 0.25 } },
  { id: 't_jiyuan', name: '大机缘', desc: '幸运+30：奇遇更多好结果，掉落更好', tier: 3, mods: { luck: 30, loot: 0.2 } },
  { id: 't_huixin', name: '会心', desc: '暴击率+12%', tier: 2, mods: { crit: 0.12 } },
  { id: 't_changsheng', name: '长生', desc: '寿元+30%', tier: 2, mods: { life: 0.3 } },
  { id: 't_yaowang', name: '药王', desc: '采药时年份更高、数量更多', tier: 1, mods: { herb: 0.5 } },
  { id: 't_yufeng', name: '御风', desc: '移动速度+15%，大地图速度+15%', tier: 1, mods: { speed: 0.15, mapSpeed: 0.15 } },
  { id: 't_fabao', name: '宝光', desc: '法宝冷却-15%', tier: 3, mods: { artCd: 0.15 } },
  { id: 't_meili', name: '仙姿', desc: '魅力+30：与女修结交更易，好感提升+30%', tier: 1, mods: { charm: 30 } },
  { id: 't_bujie', name: '不灭', desc: '受到伤害-12%', tier: 3, mods: { reduce: 0.12 } },
  { id: 't_hunyuan', name: '浑元一气', desc: '攻击+10%，气血+15%，法力+15%', tier: 2, mods: { atk: 0.1, hp: 0.15, mp: 0.15 } },
  { id: 't_tianxuan', name: '天选', desc: '修炼速度+15%，幸运+15', tier: 2, mods: { exp: 0.15, luck: 15 } },
];

export function talentById(id: string) { return TALENTS.find((t) => t.id === id); }
