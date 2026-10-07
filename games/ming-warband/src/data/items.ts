// 装备与商品
export type Slot = 'melee' | 'ranged' | 'armor' | 'helm' | 'horse';

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  tier: number;
  dmg?: number; // 武器伤害
  reach?: number; // 近战距离
  speed?: number; // 攻击间隔（秒）
  antiCav?: boolean;
  range?: number; // 远程射程
  reload?: number; // 装填（秒）
  ammo?: number;
  kind?: 'bow' | 'xbow' | 'gun';
  armor?: number;
  horseSpeed?: number; // 马匹速度
  horseHp?: number;
  horseArmor?: number;
  desc: string;
}

const items: ItemDef[] = [
  // 近战
  { id: 'w_chaidao', name: '柴刀', slot: 'melee', price: 30, tier: 1, dmg: 9, reach: 26, speed: 0.75, desc: '砍柴用的刀，聊胜于无。' },
  { id: 'w_hunting', name: '猎刀', slot: 'melee', price: 80, tier: 1, dmg: 11, reach: 26, speed: 0.7, desc: '猎户随身的短刀。' },
  { id: 'w_podao', name: '朴刀', slot: 'melee', price: 180, tier: 2, dmg: 15, reach: 32, speed: 0.85, desc: '长柄大刀，江湖常见。' },
  { id: 'w_yanling', name: '雁翎刀', slot: 'melee', price: 420, tier: 3, dmg: 18, reach: 30, speed: 0.7, desc: '明军制式腰刀，轻快锋利。' },
  { id: 'w_spear', name: '长枪', slot: 'melee', price: 260, tier: 2, dmg: 16, reach: 42, speed: 0.95, antiCav: true, desc: '一寸长一寸强，对骑兵有奇效。' },
  { id: 'w_jian', name: '铁锏', slot: 'melee', price: 520, tier: 3, dmg: 20, reach: 28, speed: 0.9, desc: '钝器破甲，对重甲敌人有效。' },
  { id: 'w_miaodao', name: '苗刀', slot: 'melee', price: 900, tier: 4, dmg: 24, reach: 36, speed: 0.85, desc: '戚继光仿倭刀所制长刀。' },
  { id: 'w_guandao', name: '偃月刀', slot: 'melee', price: 1400, tier: 5, dmg: 30, reach: 44, speed: 1.15, desc: '青龙偃月，势大力沉。' },
  { id: 'w_horselance', name: '马槊', slot: 'melee', price: 1100, tier: 4, dmg: 22, reach: 48, speed: 1.0, antiCav: true, desc: '骑兵冲锋利器。' },
  // 远程
  { id: 'r_huntbow', name: '猎弓', slot: 'ranged', price: 120, tier: 1, dmg: 10, range: 240, reload: 1.4, ammo: 25, kind: 'bow', desc: '简陋的木弓。' },
  { id: 'r_hornbow', name: '角弓', slot: 'ranged', price: 450, tier: 3, dmg: 16, range: 280, reload: 1.3, ammo: 25, kind: 'bow', desc: '牛角筋胶复合弓。' },
  { id: 'r_manchubow', name: '满洲大弓', slot: 'ranged', price: 800, tier: 4, dmg: 21, range: 260, reload: 1.6, ammo: 22, kind: 'bow', desc: '弓力强劲，箭重破甲。' },
  { id: 'r_xbow', name: '手弩', slot: 'ranged', price: 350, tier: 2, dmg: 18, range: 250, reload: 2.4, ammo: 20, kind: 'xbow', desc: '上弦稍慢，但无需膂力。' },
  { id: 'r_niaochong', name: '鸟铳', slot: 'ranged', price: 900, tier: 4, dmg: 34, range: 240, reload: 3.6, ammo: 18, kind: 'gun', desc: '火绳枪，威力巨大，装填缓慢。' },
  { id: 'r_sanyan', name: '三眼铳', slot: 'ranged', price: 600, tier: 3, dmg: 26, range: 170, reload: 2.4, ammo: 18, kind: 'gun', desc: '三管火铳，射程较近。' },
  // 身甲
  { id: 'a_cloth', name: '粗布衣', slot: 'armor', price: 20, tier: 1, armor: 1, desc: '' },
  { id: 'a_pao', name: '胖袄', slot: 'armor', price: 160, tier: 1, armor: 6, desc: '明军棉衣，略可御寒防身。' },
  { id: 'a_leather', name: '皮甲', slot: 'armor', price: 380, tier: 2, armor: 10, desc: '硬皮缀成的甲衣。' },
  { id: 'a_chain', name: '锁子甲', slot: 'armor', price: 900, tier: 3, armor: 16, desc: '铁环相扣，防护均衡。' },
  { id: 'a_cotton', name: '布面甲', slot: 'armor', price: 1300, tier: 4, armor: 20, desc: '外覆棉布、内衬铁片的明式甲。' },
  { id: 'a_fish', name: '鱼鳞甲', slot: 'armor', price: 2200, tier: 5, armor: 26, desc: '甲片如鱼鳞层叠。' },
  { id: 'a_shanwen', name: '山文甲', slot: 'armor', price: 3500, tier: 5, armor: 32, desc: '将官所披的精工铠甲。' },
  // 头盔
  { id: 'h_cloth', name: '布巾', slot: 'helm', price: 10, tier: 1, armor: 0, desc: '' },
  { id: 'h_felt', name: '毡帽', slot: 'helm', price: 60, tier: 1, armor: 2, desc: '' },
  { id: 'h_iron', name: '铁盔', slot: 'helm', price: 300, tier: 2, armor: 5, desc: '' },
  { id: 'h_bowl', name: '八瓣帽儿盔', slot: 'helm', price: 700, tier: 3, armor: 8, desc: '明军常见的铁盔。' },
  { id: 'h_phoenix', name: '凤翅盔', slot: 'helm', price: 1500, tier: 5, armor: 12, desc: '将官的华丽头盔。' },
  // 马匹
  { id: 'm_pack', name: '驮马', slot: 'horse', price: 200, tier: 1, horseSpeed: 1.25, horseHp: 60, horseArmor: 0, desc: '驮货的老马，跑不快。' },
  { id: 'm_chuan', name: '川马', slot: 'horse', price: 450, tier: 2, horseSpeed: 1.45, horseHp: 80, horseArmor: 2, desc: '矮小耐劳的西南马。' },
  { id: 'm_mongol', name: '蒙古马', slot: 'horse', price: 800, tier: 3, horseSpeed: 1.6, horseHp: 100, horseArmor: 3, desc: '耐力极佳的草原马。' },
  { id: 'm_hequ', name: '河曲马', slot: 'horse', price: 1300, tier: 4, horseSpeed: 1.75, horseHp: 110, horseArmor: 4, desc: '黄河河曲所产骏马。' },
  { id: 'm_armored', name: '披甲战马', slot: 'horse', price: 2400, tier: 5, horseSpeed: 1.55, horseHp: 150, horseArmor: 12, desc: '马披铁甲的重装战马。' },
  { id: 'm_ferghana', name: '大宛良驹', slot: 'horse', price: 3200, tier: 5, horseSpeed: 1.95, horseHp: 120, horseArmor: 4, desc: '传说中的汗血宝马。' },
];

export const ITEMS: Record<string, ItemDef> = {};
for (const it of items) ITEMS[it.id] = it;
export const ITEM_LIST = items;

export const SLOT_LABEL: Record<Slot, string> = { melee: '近战', ranged: '远程', armor: '身甲', helm: '头盔', horse: '坐骑' };

// ---------- 贸易商品 ----------
export interface GoodDef { id: string; name: string; base: number; food?: number; morale?: number }
export const GOODS: GoodDef[] = [
  { id: 'grain', name: '米粮', base: 18, food: 1 },
  { id: 'meat', name: '腌肉', base: 40, food: 1, morale: 2 },
  { id: 'wine', name: '烧酒', base: 55, food: 1, morale: 4 },
  { id: 'salt', name: '盐', base: 70 },
  { id: 'cloth', name: '棉布', base: 90 },
  { id: 'tea', name: '茶叶', base: 120 },
  { id: 'iron', name: '铁器', base: 150 },
  { id: 'herb', name: '药材', base: 160 },
  { id: 'fur', name: '毛皮', base: 180 },
  { id: 'porcelain', name: '瓷器', base: 230 },
  { id: 'silk', name: '丝绸', base: 300 },
  { id: 'ginseng', name: '人参', base: 420 },
];
export const GOOD: Record<string, GoodDef> = {};
for (const g of GOODS) GOOD[g.id] = g;
