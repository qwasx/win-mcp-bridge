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
  base?: string;     // 品质派生件的基础装备
  quality?: number;  // 0 破旧 / 1 普通 / 2 精良 / 3 名匠
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

// ---------- 扩充装备（v2.0）：紧凑表 ----------
// 文化标签决定在哪里更常见：ming 关内、south 江南/岭南、north 九边、jin 辽东、mon 草原、xi 巴蜀
type M = [id: string, name: string, tier: number, price: number, dmg: number, reach: number, speed: number, flags: string, desc: string];
const MELEE: M[] = [
  ['w_club', '木棍', 1, 26, 8, 26, 0.7, '', '随手捡来的硬木棍。'],
  ['w_sickle', '镰刀', 1, 34, 9, 24, 0.65, '', '农家割麦的镰刀。'],
  ['w_hatchet', '短斧', 1, 55, 10, 24, 0.75, '', '劈柴的短柄斧。'],
  ['w_bamboo', '竹枪', 1, 45, 10, 40, 1.0, 'ac south', '削尖的毛竹，乡勇常用。'],
  ['w_tiechi', '铁尺', 1, 70, 10, 24, 0.6, '', '捕快衙役的随身兵器。'],
  ['w_yaodao', '腰刀', 2, 210, 13, 28, 0.7, 'ming', '寻常军士佩带的腰刀。'],
  ['w_handaxe', '手斧', 2, 190, 14, 26, 0.8, 'north', '边军短兵，近身劈砍。'],
  ['w_langxian', '狼筅', 2, 240, 13, 46, 1.1, 'ac south', '戚家军鸳鸯阵利器，枝杈拒敌。'],
  ['w_tangba', '镗钯', 2, 280, 15, 40, 1.0, 'ac south', '三叉镗钯，可架可刺。'],
  ['w_shuangdao', '双刀', 2, 300, 13, 26, 0.55, '', '左右开弓，快若疾风。'],
  ['w_tiebian', '铁鞭', 2, 320, 15, 26, 0.85, 'north', '节节铁鞭，砸甲伤骨。'],
  ['w_mongolsabre', '蒙古弯刀', 2, 290, 14, 30, 0.68, 'mon', '弧度大，马上劈砍顺手。'],
  ['w_changjian', '长剑', 3, 480, 17, 32, 0.7, 'ming', '双刃长剑，文武皆宜。'],
  ['w_gouliang', '钩镰枪', 3, 560, 17, 44, 1.0, 'ac ming', '专钩马腿的长枪。'],
  ['w_bigaxe', '大斧', 3, 600, 20, 34, 1.0, 'north', '开山大斧，势大力沉。'],
  ['w_meteor', '流星锤', 3, 520, 18, 30, 0.9, '', '铁锤系索，出其不意。'],
  ['w_tiaodao', '挑刀', 3, 540, 17, 38, 0.9, 'ming', '长柄挑刀，劈挑皆可。'],
  ['w_shundao', '满洲顺刀', 3, 580, 18, 30, 0.72, 'jin', '八旗兵佩刀，厚背利刃。'],
  ['w_xiyuedao', '川刀', 3, 500, 17, 30, 0.7, 'xi', '巴蜀铁匠所打的厚刀。'],
  ['w_zhanma', '斩马刀', 4, 1150, 25, 40, 1.0, 'north', '长柄巨刃，专斩马足。'],
  ['w_langya', '狼牙棒', 4, 1000, 24, 32, 1.0, 'north', '满布铁钉，触者骨碎。'],
  ['w_huqiang', '虎枪', 4, 1050, 22, 46, 0.95, 'ac jin', '猎虎用的重枪，八旗虎枪营所持。'],
  ['w_taidao', '倭刀', 4, 1200, 23, 34, 0.8, 'south', '缴自倭寇的长刀，钢口极佳。'],
  ['w_guduo', '铁骨朵', 4, 950, 22, 28, 0.9, 'mon', '蒙古贵人所持的瓜形铁锤。'],
  ['w_changfu', '长柄大斧', 4, 1250, 26, 40, 1.1, 'north', '双手长斧，破阵开甲。'],
  ['w_sanjian', '三尖两刃刀', 4, 1300, 24, 44, 1.05, 'ac ming', '刃分三尖，刺劈兼备。'],
  ['w_huaji', '方天画戟', 5, 2600, 30, 48, 1.15, 'ac ming', '戟中至尊，非猛将不能使。'],
  ['w_qixing', '七星宝剑', 5, 2400, 26, 34, 0.62, 'ming', '剑身嵌七星，削铁如泥。'],
  ['w_modao', '陌刀', 5, 2800, 32, 44, 1.2, 'north', '唐时陌刀遗制，人马俱碎。'],
  ['w_jingua', '金瓜锤', 5, 2300, 29, 30, 1.0, 'ming', '仪卫重锤，镀金瓜首。'],
  ['w_binbtie', '镔铁大刀', 5, 2700, 31, 40, 1.05, 'jin', '镔铁打造的重刀，寒光逼人。'],
];
type R = [id: string, name: string, tier: number, price: number, dmg: number, range: number, reload: number, ammo: number, kind: 'bow' | 'xbow' | 'gun', flags: string, desc: string];
const RANGED: R[] = [
  ['r_slingbow', '竹弓', 1, 70, 8, 210, 1.3, 25, 'bow', 'south', '竹片所制的轻弓。'],
  ['r_shortbow', '短弓', 1, 140, 11, 230, 1.2, 25, 'bow', '', '短小易携，马上亦可用。'],
  ['r_longbow', '长弓', 2, 300, 13, 270, 1.4, 25, 'bow', 'ming', '明军弓手常用的长弓。'],
  ['r_juezhang', '蹶张弩', 2, 380, 19, 260, 2.6, 20, 'xbow', 'ming', '以脚踏张弦的强弩。'],
  ['r_xiujian', '袖箭', 2, 260, 12, 160, 1.6, 15, 'xbow', '', '藏于袖中的机括短箭。'],
  ['r_mongolbow', '蒙古角弓', 3, 520, 16, 290, 1.25, 26, 'bow', 'mon', '草原骑手的复合弓，射远而疾。'],
  ['r_shenbi', '神臂弩', 3, 640, 23, 290, 2.8, 20, 'xbow', 'ming', '宋时神臂弓遗制，三百步透甲。'],
  ['r_kuaiqiang', '快枪', 3, 560, 24, 180, 2.2, 18, 'gun', 'north', '边军火门枪，打完可当锤使。'],
  ['r_paoshou', '迅雷铳', 4, 1100, 30, 200, 3.0, 20, 'gun', 'ming', '五管轮放的火铳，赵士祯所制。'],
  ['r_dashao', '大梢弓', 4, 950, 20, 270, 1.5, 22, 'bow', 'jin', '大梢重弓，近射如锥。'],
  ['r_zhuque', '诸葛连弩', 4, 1000, 16, 220, 1.0, 30, 'xbow', 'xi', '一发十矢，连珠而出。'],
  ['r_lumi', '鲁密铳', 5, 2200, 40, 270, 3.4, 18, 'gun', 'ming', '仿鲁迷国火绳枪，明军最精良的火器。'],
  ['r_diaogong', '雕弓', 5, 2000, 24, 300, 1.35, 26, 'bow', 'mon', '可射落大雕的名弓。'],
  ['r_chedian', '掣电铳', 5, 2400, 36, 250, 2.6, 18, 'gun', 'south', '后装子铳，装填远胜鸟铳。'],
];
type A = [id: string, name: string, slot: 'armor' | 'helm', tier: number, price: number, armor: number, flags: string, desc: string];
const ARMOR: A[] = [
  ['a_duanhe', '短褐', 'armor', 1, 30, 2, '', '穷苦人家的粗布短衣。'],
  ['a_haoyi', '号衣', 'armor', 1, 90, 4, 'ming', '营兵的号坎，聊以识别。'],
  ['a_paperarmor', '纸甲', 'armor', 2, 260, 8, 'south', '层层厚纸压制，箭矢难透。'],
  ['a_tengjia', '藤甲', 'armor', 2, 320, 9, 'south', '山藤浸油编成，轻韧不沉。'],
  ['a_pizha', '皮扎甲', 'armor', 2, 420, 11, 'mon', '牛皮甲片以皮绳扎就。'],
  ['a_suozibei', '锁子背心', 'armor', 3, 700, 14, 'north', '只护胸背的锁甲，轻便灵活。'],
  ['a_zhaojia', '罩甲', 'armor', 3, 820, 15, 'ming', '对襟罩甲，武官常服其外。'],
  ['a_yuanyang', '鸳鸯战袄', 'armor', 3, 650, 13, 'ming', '两面可穿的厚棉战袄。'],
  ['a_mongolleather', '蒙古皮甲', 'armor', 3, 760, 14, 'mon', '多层硬皮缝合，骑射轻甲。'],
  ['a_qiyao', '齐腰甲', 'armor', 4, 1500, 19, 'ming', '护至腰际的铁甲，戚家军制。'],
  ['a_manchu', '满洲棉甲', 'armor', 4, 1700, 21, 'jin', '内缀铁叶的棉甲，八旗正兵所披。'],
  ['a_tiezha', '铁扎甲', 'armor', 4, 1800, 22, 'north', '铁片层叠扎成，九边精兵所用。'],
  ['a_mingguang', '明光铠', 'armor', 5, 3800, 30, 'ming', '胸前护心镜明亮如日。'],
  ['a_lianhuan', '锁子连环甲', 'armor', 5, 3300, 28, 'xi', '连环相扣的精锁甲。'],
  ['a_jinqi', '金漆山文甲', 'armor', 5, 4800, 34, 'ming', '描金漆饰的山文铠，总兵以上方得披挂。'],
  ['h_douli', '斗笠', 'helm', 1, 25, 1, 'south', '竹编斗笠，遮阳挡雨。'],
  ['h_fanyang', '范阳笠', 'helm', 1, 70, 2, '', '毡制大笠，江湖人常戴。'],
  ['h_leather', '皮盔', 'helm', 2, 200, 4, 'mon', '硬皮缝制的头盔。'],
  ['h_hongying', '红缨帽', 'helm', 2, 240, 4, 'jin', '缀红缨的暖帽，内衬铁片。'],
  ['h_tieli', '铁笠盔', 'helm', 3, 600, 7, 'ming', '笠形铁盔，宽檐遮箭。'],
  ['h_jianding', '尖顶盔', 'helm', 3, 680, 8, 'jin', '高顶尖盔，八旗兵式样。'],
  ['h_mongoliron', '蒙古铁盔', 'helm', 3, 620, 7, 'mon', '带护颈的圆铁盔。'],
  ['h_huxiang', '护项铁盔', 'helm', 4, 1000, 10, 'north', '带铁护项的重盔。'],
  ['h_toumou', '头鍪', 'helm', 4, 1100, 10, 'ming', '古制兜鍪，护耳护颈。'],
  ['h_gaoding', '满洲高顶盔', 'helm', 4, 1150, 11, 'jin', '盔顶高耸插缨，巴牙喇常戴。'],
  ['h_jinkui', '金盔', 'helm', 5, 1900, 13, 'ming', '鎏金铁盔，将门之冠。'],
  ['h_shitou', '狮头盔', 'helm', 5, 2000, 13, 'xi', '盔额铸狮首，威风凛凛。'],
];
type H = [id: string, name: string, tier: number, price: number, spd: number, hp: number, arm: number, flags: string, desc: string];
const HORSES: H[] = [
  ['m_mule', '骡子', 1, 150, 1.15, 70, 0, '', '驮重耐劳，就是跑不快。'],
  ['m_nag', '驽马', 1, 230, 1.3, 65, 0, '', '老弱之马，勉强可骑。'],
  ['m_dian', '滇马', 2, 420, 1.45, 75, 2, 'south', '云南山马，善走山路。'],
  ['m_liao', '辽马', 2, 520, 1.5, 85, 2, 'jin', '辽东所产，体健耐寒。'],
  ['m_qinghai', '青海骢', 3, 900, 1.65, 95, 3, 'xi', '青海湖畔所产的骏马。'],
  ['m_ujimqin', '乌珠穆沁马', 3, 950, 1.66, 105, 3, 'mon', '草原名马，奔走如飞。'],
  ['m_guanxi', '关西马', 3, 850, 1.6, 100, 4, 'north', '关西骏马，边军精骑所乘。'],
  ['m_yili', '伊犁马', 4, 1500, 1.8, 115, 4, 'mon', '西域良马，高大俊美。'],
  ['m_hetao', '河套战马', 4, 1600, 1.72, 125, 6, 'north', '河套草场所育的战马，可披半甲。'],
  ['m_zhaoye', '照夜玉狮子', 5, 3600, 2.0, 120, 4, 'ming', '通体雪白的神驹。'],
  ['m_wuzhui', '乌骓', 5, 3400, 1.9, 140, 8, 'jin', '霸王坐骑之名，黑缎般的烈马。'],
];
const tags: Record<string, string[]> = {};
const flagged = (id: string, f: string) => { const t = f.split(' ').filter(Boolean); tags[id] = t.filter(x => x !== 'ac'); return t.includes('ac'); };
for (const [id, name, tier, price, dmg, reach, speed, f, desc] of MELEE) items.push({ id, name, slot: 'melee', tier, price, dmg, reach, speed, antiCav: flagged(id, f) || undefined, desc });
for (const [id, name, tier, price, dmg, range, reload, ammo, kind, f, desc] of RANGED) { flagged(id, f); items.push({ id, name, slot: 'ranged', tier, price, dmg, range, reload, ammo, kind, desc }); }
for (const [id, name, slot, tier, price, armor, f, desc] of ARMOR) { flagged(id, f); items.push({ id, name, slot, tier, price, armor, desc }); }
for (const [id, name, tier, price, horseSpeed, horseHp, horseArmor, f, desc] of HORSES) { flagged(id, f); items.push({ id, name, slot: 'horse', tier, price, horseSpeed, horseHp, horseArmor, desc }); }
// 原有装备的地域标签
Object.assign(tags, {
  w_yanling: ['ming'], w_miaodao: ['south'], w_horselance: ['north'], r_hornbow: ['north'], r_manchubow: ['jin'], r_niaochong: ['ming', 'south'], r_sanyan: ['north'],
  a_pao: ['ming'], a_cotton: ['ming'], a_fish: ['ming'], h_bowl: ['ming'], m_chuan: ['xi'], m_mongol: ['mon'], m_hequ: ['north'], m_ferghana: ['mon'],
});

// ---------- 品质：每件基础装备派生 破旧 / 精良 / 名匠 三档（id 后缀 ~0 ~2 ~3） ----------
export const QUALITY = [
  { q: 0, suffix: '~0', name: { melee: '破旧', ranged: '破旧', armor: '破损', helm: '破损', horse: '瘦弱' }, mul: 0.82, price: 0.5, minTier: 1 },
  { q: 2, suffix: '~2', name: { melee: '精良', ranged: '精良', armor: '精制', helm: '精制', horse: '健壮' }, mul: 1.12, price: 1.7, minTier: 2 },
  { q: 3, suffix: '~3', name: { melee: '名匠', ranged: '名匠', armor: '名匠', helm: '名匠', horse: '神骏' }, mul: 1.24, price: 3.0, minTier: 3 },
] as const;
const baseItems = items.filter(i => i.price > 25);
for (const b of baseItems) {
  for (const Q of QUALITY) {
    if (b.tier < Q.minTier) continue;
    const it: ItemDef = { ...b, id: b.id + Q.suffix, name: Q.name[b.slot] + b.name, price: Math.round(b.price * Q.price), base: b.id, quality: Q.q };
    const r1 = (v?: number) => v === undefined ? undefined : Math.max(0, Math.round(v * Q.mul * 10) / 10);
    if (it.dmg !== undefined) it.dmg = Math.max(1, Math.round(b.dmg! * Q.mul));
    if (it.armor !== undefined) it.armor = Math.max(0, Math.round(b.armor! * Q.mul));
    if (it.speed !== undefined) it.speed = Math.round(b.speed! / Math.sqrt(Q.mul) * 100) / 100;
    if (it.reload !== undefined) it.reload = Math.round(b.reload! / Math.sqrt(Q.mul) * 10) / 10;
    if (it.horseSpeed !== undefined) it.horseSpeed = Math.round(b.horseSpeed! * Math.sqrt(Q.mul) * 100) / 100;
    if (it.horseHp !== undefined) it.horseHp = Math.round(b.horseHp! * Q.mul);
    if (it.horseArmor !== undefined) it.horseArmor = r1(b.horseArmor);
    it.desc = Q.q === 0 ? `${b.desc}（年久失修）` : Q.q === 2 ? `${b.desc}（做工精良）` : `${b.desc}（名匠所制，世所罕见）`;
    items.push(it);
    tags[it.id] = tags[b.id] ?? [];
  }
}
/** 装备的地域标签（用于商店进货权重） */
export const ITEM_TAGS = tags;
export const baseItemId = (id: string) => id.split('~')[0];

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
  // —— 扩充商品（v2.0）——
  { id: 'flour', name: '面粉', base: 22, food: 1 },
  { id: 'fish', name: '鱼干', base: 34, food: 1 },
  { id: 'fruit', name: '干果', base: 46, food: 1, morale: 1 },
  { id: 'cheese', name: '奶食', base: 52, food: 1, morale: 2 },
  { id: 'kumis', name: '马奶酒', base: 62, food: 1, morale: 3 },
  { id: 'ricewine', name: '黄酒', base: 75, food: 1, morale: 4 },
  { id: 'timber', name: '木材', base: 38 },
  { id: 'hemp', name: '麻布', base: 50 },
  { id: 'pottery', name: '陶器', base: 60 },
  { id: 'sugar', name: '蔗糖', base: 85 },
  { id: 'leather', name: '皮革', base: 100 },
  { id: 'tobacco', name: '烟草', base: 130 },
  { id: 'paper', name: '纸墨', base: 140 },
  { id: 'copper', name: '铜料', base: 170 },
  { id: 'saltpeter', name: '硝石', base: 200 },
  { id: 'books', name: '书籍', base: 210 },
  { id: 'lacquer', name: '漆器', base: 260 },
  { id: 'spice', name: '香料', base: 340 },
  { id: 'antler', name: '鹿茸', base: 380 },
  { id: 'pearl', name: '珍珠', base: 500 },
  { id: 'jade', name: '玉器', base: 600 },
  { id: 'horse_t', name: '马匹（成群）', base: 260 },
];
export const GOOD: Record<string, GoodDef> = {};
for (const g of GOODS) GOOD[g.id] = g;
