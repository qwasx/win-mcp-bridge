// 境界体系（人界：凡人 → 炼气 → 筑基 → 结丹 → 元婴 → 化神）
export interface RealmDef {
  id: number;
  name: string;
  stages: string[];
  hp: number[]; mp: number[]; atk: number[]; def: number[]; sense: number[];
  life: number;          // 寿元（年）
  speed: number;         // 大地图基础速度
  fly: boolean;          // 能否御器飞行（跨海、无视地形）
  expDays: number[];     // 每个小境界所需修为（以“基础速度修炼天数”计）
  color: string;
}

const L13 = ['一层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '十层', '十一层', '十二层', '十三层'];
const ST3 = ['初期', '中期', '后期'];

export const REALMS: RealmDef[] = [
  { id: 0, name: '凡人', stages: [''], hp: [60], mp: [10], atk: [6], def: [1], sense: [0], life: 70, speed: 85, fly: false, expDays: [30], color: '#8a8070' },
  {
    id: 1, name: '炼气', stages: L13,
    hp: L13.map((_, s) => 100 + 16 * s), mp: L13.map((_, s) => 60 + 12 * s), atk: L13.map((_, s) => 10 + 2.2 * s),
    def: L13.map((_, s) => 3 + 0.7 * s), sense: L13.map((_, s) => 20 + 3 * s), life: 120, speed: 115, fly: false,
    expDays: L13.map((_, s) => 36 + 11 * s), color: '#6f8f6a',
  },
  { id: 2, name: '筑基', stages: ST3, hp: [520, 680, 880], mp: [280, 350, 440], atk: [46, 60, 78], def: [15, 19, 24], sense: [80, 120, 170], life: 220, speed: 165, fly: true, expDays: [520, 760, 1100], color: '#4f7f8f' },
  { id: 3, name: '结丹', stages: ST3, hp: [2300, 3000, 3900], mp: [1050, 1350, 1750], atk: [185, 235, 305], def: [55, 70, 90], sense: [300, 450, 650], life: 500, speed: 245, fly: true, expDays: [2200, 3100, 4400], color: '#b08a3a' },
  { id: 4, name: '元婴', stages: ST3, hp: [9200, 12200, 16200], mp: [4100, 5400, 7100], atk: [720, 920, 1220], def: [200, 260, 340], sense: [1100, 1600, 2300], life: 1000, speed: 345, fly: true, expDays: [8800, 13000, 19000], color: '#8a4fa0' },
  { id: 5, name: '化神', stages: ST3, hp: [37000, 49000, 65000], mp: [16500, 21500, 28500], atk: [2850, 3650, 4850], def: [800, 1050, 1350], sense: [4000, 6000, 8000], life: 2000, speed: 480, fly: true, expDays: [36000, 52000, 75000], color: '#c0392b' },
];

export const EXP_PER_DAY = 10; // 基础修炼：每天 10 点修为

export function realmName(realm: number, stage: number) {
  const r = REALMS[realm];
  if (!r) return '???';
  if (realm === 0) return '凡人';
  return r.name + (r.stages[stage] ?? '');
}

export function expNeed(realm: number, stage: number) {
  return Math.round(REALMS[realm].expDays[stage] * EXP_PER_DAY);
}

// 全局等级（用于比较强弱）：炼气1-13，筑基14-16 ……
export function levelOf(realm: number, stage: number) {
  if (realm === 0) return 0;
  if (realm === 1) return 1 + stage;
  return 13 + (realm - 2) * 3 + stage + 1;
}

export function fromLevel(level: number): [number, number] {
  if (level <= 0) return [0, 0];
  if (level <= 13) return [1, level - 1];
  const l = level - 14;
  return [Math.min(5, 2 + Math.floor(l / 3)), Math.min(2, l % 3)];
}

// 灵根
export interface RootDef { id: string; name: string; rate: number; desc: string; weight: number }
export const ROOTS: RootDef[] = [
  { id: 'heaven', name: '天灵根', rate: 2.0, desc: '单一属性灵根，修炼一日千里，万中无一', weight: 1 },
  { id: 'variant', name: '异灵根', rate: 1.6, desc: '风雷冰等变异灵根，修炼极快', weight: 2 },
  { id: 'true', name: '真灵根', rate: 1.2, desc: '双属性灵根，宗门争抢的好苗子', weight: 10 },
  { id: 'triple', name: '三灵根', rate: 0.85, desc: '资质平平', weight: 30 },
  { id: 'fake', name: '伪灵根', rate: 0.5, desc: '四五属性灵根，修炼极慢，几乎无缘大道', weight: 40 },
];

// 小境界突破瓶颈所需（不含大境界）
export interface Bottleneck { item: string; count: number }
export function smallBottleneck(realm: number, stage: number): Bottleneck | null {
  // 从 stage -> stage+1 所需
  if (realm === 1) {
    if (stage === 5) return { item: 'pill_juqi', count: 1 };
    if (stage === 9) return { item: 'pill_juqi', count: 2 };
    return null;
  }
  if (realm === 2) return { item: 'pill_juling', count: stage + 1 };
  if (realm === 3) return { item: 'pill_ningyuan', count: stage + 1 };
  if (realm === 4) return { item: 'pill_peiying', count: stage + 1 };
  if (realm === 5) return { item: 'item_yuanqi', count: stage + 1 };
  return null;
}

// 大境界突破
export interface MajorBreak { item: string; base: number; per: number; maxItems: number; desc: string }
export const MAJOR_BREAKS: Record<number, MajorBreak> = {
  0: { item: '', base: 1, per: 0, maxItems: 0, desc: '引气入体，踏上仙途' },
  1: { item: 'pill_zhuji', base: 0.12, per: 0.3, maxItems: 3, desc: '筑基：凡人与修士的分水岭，筑基丹可大幅提升成功率' },
  2: { item: 'pill_jiangchen', base: 0.08, per: 0.28, maxItems: 3, desc: '结丹：凝结金丹，降尘丹可助一臂之力' },
  3: { item: 'pill_jiuqu', base: 0.05, per: 0.3, maxItems: 2, desc: '结婴：碎丹成婴，需抵御心魔，九曲灵参丹乃结婴圣药' },
  4: { item: 'item_yuanqi', base: 0.03, per: 0.22, maxItems: 4, desc: '化神：人界灵气稀薄，需借天地元气方有一线希望' },
};
