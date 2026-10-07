// 兵种数据
export type Culture = 'ming' | 'jin' | 'chuang' | 'xi' | 'mon' | 'bandit' | 'merc' | 'civ';
export type TroopClass = 'inf' | 'spear' | 'arc' | 'xbow' | 'gun' | 'cav' | 'hca';

export interface TroopDef {
  id: string;
  name: string;
  culture: Culture;
  tier: number;
  cls: TroopClass;
  hp: number;
  atk: number; // 近战伤害
  def: number; // 护甲
  skill: number; // 武艺
  rng?: number; // 远程伤害
  ammo?: number;
  mounted: boolean;
  upgrades: string[];
  wage: number; // 每周军饷
  desc: string;
}

const T = (d: Omit<TroopDef, 'mounted' | 'upgrades' | 'wage'> & { mounted?: boolean; upgrades?: string[]; wage?: number }): TroopDef => ({
  mounted: d.cls === 'cav' || d.cls === 'hca',
  upgrades: [],
  wage: Math.round(2 + d.tier * d.tier * 2 + ((d.cls === 'cav' || d.cls === 'hca') ? d.tier * 2 : 0)),
  ...d,
});

export const TROOPS: Record<string, TroopDef> = {};
function add(...defs: TroopDef[]) { for (const d of defs) TROOPS[d.id] = d; }

// ---------- 大明 ----------
add(
  T({ id: 'ming_recruit', name: '民壮', culture: 'ming', tier: 1, cls: 'inf', hp: 40, atk: 8, def: 2, skill: 3, upgrades: ['ming_soldier', 'ming_archer'], desc: '各地征发的乡民，手持柴刀木棍。' }),
  T({ id: 'ming_soldier', name: '营兵', culture: 'ming', tier: 2, cls: 'inf', hp: 50, atk: 11, def: 6, skill: 5, upgrades: ['ming_spear', 'ming_cav'], desc: '经过操练的明军营兵。' }),
  T({ id: 'ming_archer', name: '弓手', culture: 'ming', tier: 2, cls: 'arc', hp: 45, atk: 8, def: 4, skill: 4, rng: 11, ammo: 20, upgrades: ['ming_gun'], desc: '持弓的明军射手。' }),
  T({ id: 'ming_spear', name: '长枪手', culture: 'ming', tier: 3, cls: 'spear', hp: 60, atk: 14, def: 10, skill: 7, upgrades: ['ming_qi', 'ming_baigan'], desc: '长枪如林，善于拒马。' }),
  T({ id: 'ming_cav', name: '马兵', culture: 'ming', tier: 3, cls: 'cav', hp: 60, atk: 15, def: 10, skill: 7, upgrades: ['ming_guanning'], desc: '九边镇军中的骑兵。' }),
  T({ id: 'ming_gun', name: '鸟铳手', culture: 'ming', tier: 3, cls: 'gun', hp: 50, atk: 9, def: 6, skill: 5, rng: 30, ammo: 15, upgrades: ['ming_shenji'], desc: '使用鸟铳的火器兵，一发破甲。' }),
  T({ id: 'ming_qi', name: '戚家军', culture: 'ming', tier: 4, cls: 'spear', hp: 72, atk: 18, def: 15, skill: 10, desc: '承戚继光鸳鸯阵遗法，纪律严明的精锐步卒。' }),
  T({ id: 'ming_baigan', name: '白杆兵', culture: 'ming', tier: 4, cls: 'inf', hp: 75, atk: 20, def: 13, skill: 10, desc: '秦良玉麾下石砫土兵，白杆钩镰，悍不畏死。' }),
  T({ id: 'ming_guanning', name: '关宁铁骑', culture: 'ming', tier: 5, cls: 'cav', hp: 85, atk: 22, def: 20, skill: 12, desc: '关宁锦防线的铁甲骑兵，大明最后的利刃。' }),
  T({ id: 'ming_shenji', name: '神机营铳手', culture: 'ming', tier: 4, cls: 'gun', hp: 60, atk: 11, def: 10, skill: 7, rng: 38, ammo: 18, desc: '京营神机营精锐火器手。' }),
);

// ---------- 后金 ----------
add(
  T({ id: 'jin_recruit', name: '包衣', culture: 'jin', tier: 1, cls: 'inf', hp: 42, atk: 9, def: 3, skill: 3, upgrades: ['jin_foot'], desc: '旗下奴仆，随军效力。' }),
  T({ id: 'jin_foot', name: '披甲人', culture: 'jin', tier: 2, cls: 'inf', hp: 55, atk: 12, def: 8, skill: 6, upgrades: ['jin_archer', 'jin_horse'], desc: '八旗中披甲的正兵。' }),
  T({ id: 'jin_archer', name: '步射手', culture: 'jin', tier: 3, cls: 'arc', hp: 58, atk: 12, def: 10, skill: 7, rng: 15, ammo: 22, upgrades: ['jin_ujen'], desc: '满洲重箭，近射破甲。' }),
  T({ id: 'jin_horse', name: '马甲', culture: 'jin', tier: 3, cls: 'cav', hp: 62, atk: 15, def: 12, skill: 8, upgrades: ['jin_bayara', 'jin_hca'], desc: '八旗骑兵主力。' }),
  T({ id: 'jin_ujen', name: '乌真超哈', culture: 'jin', tier: 4, cls: 'gun', hp: 62, atk: 12, def: 12, skill: 7, rng: 34, ammo: 16, desc: '汉军火器营，以降将孔有德部为骨干。' }),
  T({ id: 'jin_bayara', name: '巴牙喇', culture: 'jin', tier: 5, cls: 'cav', hp: 85, atk: 22, def: 20, skill: 12, desc: '护军精锐，重甲白甲兵。' }),
  T({ id: 'jin_hca', name: '骑射手', culture: 'jin', tier: 4, cls: 'hca', hp: 68, atk: 14, def: 12, skill: 9, rng: 15, ammo: 24, desc: '弓马娴熟的八旗骑射手。' }),
);

// ---------- 闯军 ----------
add(
  T({ id: 'chuang_recruit', name: '饥民', culture: 'chuang', tier: 1, cls: 'inf', hp: 38, atk: 8, def: 1, skill: 3, upgrades: ['chuang_rebel'], desc: '天灾人祸之下揭竿而起的饥民。' }),
  T({ id: 'chuang_rebel', name: '流民兵', culture: 'chuang', tier: 2, cls: 'inf', hp: 50, atk: 11, def: 4, skill: 5, upgrades: ['chuang_foot', 'chuang_rider'], desc: '随闯王转战的流民兵。' }),
  T({ id: 'chuang_foot', name: '闯营步卒', culture: 'chuang', tier: 3, cls: 'spear', hp: 60, atk: 14, def: 8, skill: 7, upgrades: ['chuang_vet', 'chuang_gun'], desc: '闯营中的步兵。' }),
  T({ id: 'chuang_rider', name: '闯营马兵', culture: 'chuang', tier: 3, cls: 'cav', hp: 58, atk: 14, def: 8, skill: 7, upgrades: ['chuang_elite'], desc: '一人多马，来去如风。' }),
  T({ id: 'chuang_vet', name: '老营兵', culture: 'chuang', tier: 4, cls: 'inf', hp: 75, atk: 19, def: 12, skill: 10, desc: '久经战阵的闯营老卒。' }),
  T({ id: 'chuang_gun', name: '闯营火铳手', culture: 'chuang', tier: 4, cls: 'gun', hp: 58, atk: 10, def: 8, skill: 6, rng: 30, ammo: 14, desc: '缴获官军火器而成的铳手。' }),
  T({ id: 'chuang_elite', name: '老营骁骑', culture: 'chuang', tier: 5, cls: 'cav', hp: 80, atk: 21, def: 16, skill: 12, desc: '闯王亲领的骁骑。' }),
);

// ---------- 西营（张献忠） ----------
add(
  T({ id: 'xi_recruit', name: '乡勇', culture: 'xi', tier: 1, cls: 'inf', hp: 40, atk: 8, def: 2, skill: 3, upgrades: ['xi_soldier', 'xi_rider'], desc: '被裹挟入营的乡勇。' }),
  T({ id: 'xi_soldier', name: '西营兵', culture: 'xi', tier: 2, cls: 'inf', hp: 50, atk: 11, def: 5, skill: 5, upgrades: ['xi_xbow', 'xi_blade'], desc: '西营的步兵。' }),
  T({ id: 'xi_rider', name: '川马兵', culture: 'xi', tier: 2, cls: 'cav', hp: 48, atk: 11, def: 5, skill: 5, upgrades: ['xi_lancer'], desc: '骑着矮小川马的骑兵。' }),
  T({ id: 'xi_xbow', name: '弩手', culture: 'xi', tier: 3, cls: 'xbow', hp: 55, atk: 10, def: 8, skill: 6, rng: 19, ammo: 18, upgrades: ['xi_xbow2'], desc: '川中山地善用强弩。' }),
  T({ id: 'xi_blade', name: '藤牌手', culture: 'xi', tier: 3, cls: 'inf', hp: 62, atk: 14, def: 12, skill: 7, upgrades: ['xi_guard'], desc: '藤牌腰刀，滚地而进。' }),
  T({ id: 'xi_lancer', name: '西营骑兵', culture: 'xi', tier: 3, cls: 'cav', hp: 60, atk: 15, def: 9, skill: 7, desc: '西营的骑兵主力。' }),
  T({ id: 'xi_xbow2', name: '劲弩手', culture: 'xi', tier: 4, cls: 'xbow', hp: 62, atk: 12, def: 11, skill: 8, rng: 25, ammo: 20, desc: '神臂劲弩，百步穿杨。' }),
  T({ id: 'xi_guard', name: '西营亲兵', culture: 'xi', tier: 4, cls: 'inf', hp: 76, atk: 19, def: 15, skill: 10, desc: '八大王帐下亲兵。' }),
);

// ---------- 察哈尔 ----------
add(
  T({ id: 'mon_recruit', name: '牧民', culture: 'mon', tier: 1, cls: 'hca', hp: 40, atk: 7, def: 2, skill: 3, rng: 8, ammo: 16, upgrades: ['mon_rider'], desc: '马背上长大的牧民。' }),
  T({ id: 'mon_rider', name: '察哈尔骑手', culture: 'mon', tier: 2, cls: 'hca', hp: 50, atk: 10, def: 5, skill: 5, rng: 11, ammo: 20, upgrades: ['mon_hca', 'mon_lancer'], desc: '林丹汗麾下骑手。' }),
  T({ id: 'mon_hca', name: '蒙古骑射手', culture: 'mon', tier: 3, cls: 'hca', hp: 58, atk: 12, def: 8, skill: 7, rng: 14, ammo: 24, upgrades: ['mon_keshig'], desc: '来去如风的骑射手。' }),
  T({ id: 'mon_lancer', name: '枪骑兵', culture: 'mon', tier: 3, cls: 'cav', hp: 62, atk: 15, def: 10, skill: 7, upgrades: ['mon_heavy'], desc: '持长枪冲阵的骑兵。' }),
  T({ id: 'mon_keshig', name: '怯薛', culture: 'mon', tier: 4, cls: 'hca', hp: 70, atk: 15, def: 13, skill: 10, rng: 17, ammo: 26, desc: '大汗的宿卫。' }),
  T({ id: 'mon_heavy', name: '重甲骑', culture: 'mon', tier: 4, cls: 'cav', hp: 78, atk: 20, def: 17, skill: 10, desc: '人马俱甲的重骑兵。' }),
);

// ---------- 盗匪 ----------
add(
  T({ id: 'bandit_mtn', name: '山贼', culture: 'bandit', tier: 2, cls: 'inf', hp: 46, atk: 10, def: 3, skill: 5, desc: '啸聚山林的强人。' }),
  T({ id: 'bandit_rover', name: '流寇', culture: 'bandit', tier: 2, cls: 'inf', hp: 44, atk: 10, def: 3, skill: 4, desc: '流窜各地的乱兵与盗匪。' }),
  T({ id: 'bandit_horse', name: '马贼', culture: 'bandit', tier: 2, cls: 'hca', hp: 48, atk: 10, def: 4, skill: 5, rng: 9, ammo: 14, desc: '塞外劫掠商旅的马贼。' }),
  T({ id: 'bandit_wokou', name: '倭寇', culture: 'bandit', tier: 3, cls: 'inf', hp: 55, atk: 16, def: 5, skill: 8, desc: '东南沿海的海盗，长刀凶悍。' }),
  T({ id: 'bandit_chief', name: '贼首', culture: 'bandit', tier: 4, cls: 'inf', hp: 80, atk: 18, def: 10, skill: 10, desc: '一伙强人的首领。' }),
);

// ---------- 雇佣兵 / 平民 ----------
add(
  T({ id: 'merc_guard', name: '镖师', culture: 'merc', tier: 3, cls: 'inf', hp: 62, atk: 15, def: 9, skill: 8, wage: 26, desc: '走南闯北的镖局好手。' }),
  T({ id: 'merc_rider', name: '雇佣骑手', culture: 'merc', tier: 3, cls: 'hca', hp: 58, atk: 12, def: 8, skill: 7, rng: 13, ammo: 20, wage: 32, desc: '受雇于人的蒙古骑手。' }),
  T({ id: 'merc_monk', name: '少林武僧', culture: 'merc', tier: 4, cls: 'inf', hp: 78, atk: 19, def: 8, skill: 12, wage: 40, desc: '下山济世的少林僧兵。' }),
  T({ id: 'merc_porto', name: '佛郎机铳手', culture: 'merc', tier: 4, cls: 'gun', hp: 62, atk: 12, def: 12, skill: 8, rng: 42, ammo: 16, wage: 50, desc: '来自澳门的葡萄牙火枪手，铳法精准。' }),
  T({ id: 'civ_peasant', name: '农夫', culture: 'civ', tier: 1, cls: 'inf', hp: 35, atk: 6, def: 1, skill: 2, wage: 2, desc: '' }),
  T({ id: 'civ_guard', name: '商队护卫', culture: 'civ', tier: 3, cls: 'inf', hp: 58, atk: 13, def: 9, skill: 7, desc: '' }),
  T({ id: 'civ_cguard', name: '护商骑手', culture: 'civ', tier: 3, cls: 'cav', hp: 58, atk: 13, def: 9, skill: 7, desc: '' }),
);

export const RECRUIT_OF: Record<string, string> = {
  ming: 'ming_recruit', jin: 'jin_recruit', chuang: 'chuang_recruit', xi: 'xi_recruit', mon: 'mon_recruit',
};

export const MERCS = ['merc_guard', 'merc_rider', 'merc_monk', 'merc_porto'];

export const UPGRADE_XP = [0, 30, 80, 180, 360, 9999];
export function upgradeCost(tier: number) { return tier * 20; }
export function recruitCost(t: TroopDef) { return t.culture === 'merc' ? 40 + t.tier * t.tier * 20 : 10 + t.tier * 5; }

export function troopPower(t: TroopDef): number {
  const off = Math.max(t.atk, t.rng ? t.rng * 0.8 : 0) + t.skill * 0.6;
  return (t.hp / 10) * (off / 10) * (1 + t.def / 25) * (t.mounted ? 1.25 : 1);
}

export function classLabel(c: TroopClass) {
  return { inf: '步兵', spear: '枪兵', arc: '弓兵', xbow: '弩兵', gun: '铳兵', cav: '骑兵', hca: '骑射' }[c];
}
export function isRanged(c: TroopClass) { return c === 'arc' || c === 'xbow' || c === 'gun' || c === 'hca'; }
