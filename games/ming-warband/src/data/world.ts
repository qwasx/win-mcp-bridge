// 势力、城镇、领主、同伴
import type { Culture } from './troops';

export type FactionId = 'ming' | 'jin' | 'chuang' | 'xi' | 'mon' | 'player' | 'bandit' | 'none';

export interface FactionDef {
  id: FactionId; name: string; color: number; css: string; culture: Culture; ruler: string; rulerTitle: string; capital: string; desc: string;
}

export const FACTIONS: FactionDef[] = [
  { id: 'ming', name: '大明', color: 0xc0392b, css: '#c0392b', culture: 'ming', ruler: '朱由检', rulerTitle: '崇祯皇帝', capital: 'beijing', desc: '国祚二百六十余年，内有流寇，外有强敌，正值风雨飘摇之际。' },
  { id: 'jin', name: '后金', color: 0x2f6db5, css: '#2f6db5', culture: 'jin', ruler: '皇太极', rulerTitle: '天聪汗', capital: 'shengjing', desc: '起于白山黑水，八旗劲旅屡破明军，虎视关内。' },
  { id: 'chuang', name: '闯军', color: 0xd88a1c, css: '#d88a1c', culture: 'chuang', ruler: '李自成', rulerTitle: '闯王', capital: 'luoyang', desc: '“迎闯王，不纳粮”，饥民云集，声势日盛。' },
  { id: 'xi', name: '西营', color: 0x7d4fa3, css: '#7d4fa3', culture: 'xi', ruler: '张献忠', rulerTitle: '八大王', capital: 'chengdu', desc: '张献忠所部，转战湖广，据蜀地以图天下。' },
  { id: 'mon', name: '察哈尔', color: 0x2e9c6a, css: '#2e9c6a', culture: 'mon', ruler: '林丹汗', rulerTitle: '蒙古大汗', capital: 'guihua', desc: '黄金家族正统，欲重振蒙古，却夹在明金之间。' },
  { id: 'player', name: '义军', color: 0xd4af37, css: '#d4af37', culture: 'ming', ruler: '', rulerTitle: '', capital: '', desc: '你自己的势力。' },
];
export const FACTION: Record<string, FactionDef> = {};
for (const f of FACTIONS) FACTION[f.id] = f;
FACTION['bandit'] = { id: 'bandit', name: '盗匪', color: 0x444444, css: '#555', culture: 'bandit', ruler: '', rulerTitle: '', capital: '', desc: '' };
FACTION['none'] = { id: 'none', name: '无', color: 0x888888, css: '#888', culture: 'civ', ruler: '', rulerTitle: '', capital: '', desc: '' };

export const MAJOR_FACTIONS: FactionId[] = ['ming', 'jin', 'chuang', 'xi', 'mon'];

// 初始外交：互相交战的势力
export const INITIAL_WARS: [FactionId, FactionId][] = [
  ['ming', 'jin'], ['ming', 'chuang'], ['ming', 'xi'], ['jin', 'mon'], ['chuang', 'mon'],
];

export type SettlementKind = 'town' | 'castle' | 'village';
export interface SettlementDef {
  id: string; name: string; kind: SettlementKind; faction: FactionId; lon: number; lat: number;
  produce?: string[]; demand?: string[]; parent?: string;
}

export const TOWN_DEFS: SettlementDef[] = [
  // 大明
  { id: 'beijing', name: '北京', kind: 'town', faction: 'ming', lon: 116.4, lat: 39.9, produce: ['iron', 'wine'], demand: ['silk', 'porcelain', 'tea', 'grain'] },
  { id: 'jinan', name: '济南', kind: 'town', faction: 'ming', lon: 117.0, lat: 36.65, produce: ['salt', 'grain'], demand: ['iron', 'silk'] },
  { id: 'kaifeng', name: '开封', kind: 'town', faction: 'ming', lon: 114.3, lat: 34.8, produce: ['grain', 'cloth'], demand: ['salt', 'tea'] },
  { id: 'taiyuan', name: '太原', kind: 'town', faction: 'ming', lon: 112.55, lat: 37.87, produce: ['iron', 'wine'], demand: ['cloth', 'grain', 'tea'] },
  { id: 'nanjing', name: '南京', kind: 'town', faction: 'ming', lon: 118.8, lat: 32.06, produce: ['cloth', 'silk'], demand: ['iron', 'fur', 'herb'] },
  { id: 'suzhou', name: '苏州', kind: 'town', faction: 'ming', lon: 120.6, lat: 31.3, produce: ['silk', 'cloth'], demand: ['grain', 'fur', 'ginseng'] },
  { id: 'hangzhou', name: '杭州', kind: 'town', faction: 'ming', lon: 120.15, lat: 30.27, produce: ['silk', 'tea'], demand: ['iron', 'salt', 'ginseng'] },
  { id: 'fuzhou', name: '福州', kind: 'town', faction: 'ming', lon: 119.3, lat: 26.08, produce: ['tea', 'porcelain'], demand: ['iron', 'grain', 'cloth'] },
  { id: 'guangzhou', name: '广州', kind: 'town', faction: 'ming', lon: 113.26, lat: 23.13, produce: ['herb', 'cloth'], demand: ['silk', 'porcelain', 'tea'] },
  { id: 'wuchang', name: '武昌', kind: 'town', faction: 'ming', lon: 114.3, lat: 30.55, produce: ['grain', 'meat'], demand: ['salt', 'iron'] },
  { id: 'changsha', name: '长沙', kind: 'town', faction: 'ming', lon: 112.94, lat: 28.23, produce: ['grain', 'herb'], demand: ['salt', 'cloth'] },
  { id: 'nanchang', name: '南昌', kind: 'town', faction: 'ming', lon: 115.86, lat: 28.68, produce: ['porcelain', 'grain'], demand: ['salt', 'fur'] },
  { id: 'xian', name: '西安', kind: 'town', faction: 'ming', lon: 108.94, lat: 34.34, produce: ['meat', 'fur'], demand: ['tea', 'silk', 'salt'] },
  { id: 'lanzhou', name: '兰州', kind: 'town', faction: 'ming', lon: 103.8, lat: 36.06, produce: ['meat', 'fur'], demand: ['tea', 'cloth', 'porcelain'] },
  { id: 'guilin', name: '桂林', kind: 'town', faction: 'ming', lon: 110.3, lat: 25.27, produce: ['herb', 'wine'], demand: ['salt', 'iron'] },
  { id: 'kunming', name: '昆明', kind: 'town', faction: 'ming', lon: 102.7, lat: 25.04, produce: ['tea', 'herb'], demand: ['cloth', 'salt', 'silk'] },
  // 后金
  { id: 'shengjing', name: '盛京', kind: 'town', faction: 'jin', lon: 123.43, lat: 41.8, produce: ['fur', 'ginseng'], demand: ['cloth', 'salt', 'tea', 'iron'] },
  { id: 'liaoyang', name: '辽阳', kind: 'town', faction: 'jin', lon: 123.17, lat: 41.27, produce: ['grain', 'iron'], demand: ['silk', 'wine'] },
  // 察哈尔
  { id: 'guihua', name: '归化城', kind: 'town', faction: 'mon', lon: 111.65, lat: 40.82, produce: ['meat', 'fur'], demand: ['tea', 'cloth', 'iron', 'grain'] },
  // 闯军
  { id: 'luoyang', name: '洛阳', kind: 'town', faction: 'chuang', lon: 112.45, lat: 34.62, produce: ['grain', 'wine'], demand: ['iron', 'salt'] },
  { id: 'xiangyang', name: '襄阳', kind: 'town', faction: 'chuang', lon: 112.14, lat: 32.04, produce: ['grain', 'cloth'], demand: ['iron', 'herb'] },
  // 西营
  { id: 'chengdu', name: '成都', kind: 'town', faction: 'xi', lon: 104.06, lat: 30.67, produce: ['silk', 'tea', 'herb'], demand: ['iron', 'fur'] },
  { id: 'chongqing', name: '重庆', kind: 'town', faction: 'xi', lon: 106.55, lat: 29.56, produce: ['salt', 'herb'], demand: ['cloth', 'iron'] },
  // 城堡
  { id: 'shanhai', name: '山海关', kind: 'castle', faction: 'ming', lon: 119.75, lat: 40.0 },
  { id: 'ningyuan', name: '宁远', kind: 'castle', faction: 'ming', lon: 120.85, lat: 40.6 },
  { id: 'jinzhou', name: '锦州', kind: 'castle', faction: 'ming', lon: 121.13, lat: 41.1 },
  { id: 'datong', name: '大同', kind: 'castle', faction: 'ming', lon: 113.3, lat: 40.08 },
  { id: 'xuanfu', name: '宣府', kind: 'castle', faction: 'ming', lon: 115.03, lat: 40.6 },
  { id: 'tianjin', name: '天津卫', kind: 'castle', faction: 'ming', lon: 117.2, lat: 39.13 },
  { id: 'tongguan', name: '潼关', kind: 'castle', faction: 'ming', lon: 110.25, lat: 34.55 },
  { id: 'yulin', name: '榆林', kind: 'castle', faction: 'ming', lon: 109.73, lat: 38.28 },
  { id: 'dengzhou', name: '登州', kind: 'castle', faction: 'ming', lon: 120.75, lat: 37.8 },
  { id: 'hanzhong', name: '汉中', kind: 'castle', faction: 'ming', lon: 107.03, lat: 33.07 },
  { id: 'ganzhou', name: '赣州', kind: 'castle', faction: 'ming', lon: 114.93, lat: 25.85 },
  { id: 'xuzhou', name: '徐州', kind: 'castle', faction: 'ming', lon: 117.18, lat: 34.26 },
  { id: 'fushun', name: '抚顺', kind: 'castle', faction: 'jin', lon: 123.9, lat: 41.88 },
  { id: 'hetuala', name: '赫图阿拉', kind: 'castle', faction: 'jin', lon: 124.85, lat: 41.6 },
  { id: 'lushun', name: '旅顺', kind: 'castle', faction: 'jin', lon: 121.25, lat: 38.9 },
  { id: 'dalinghe', name: '大凌河', kind: 'castle', faction: 'jin', lon: 121.5, lat: 41.6 },
  { id: 'chahan', name: '察罕浩特', kind: 'castle', faction: 'mon', lon: 118.3, lat: 43.6 },
  { id: 'duolun', name: '多伦', kind: 'castle', faction: 'mon', lon: 116.47, lat: 42.2 },
  { id: 'ordos', name: '鄂尔多斯', kind: 'castle', faction: 'mon', lon: 109.0, lat: 39.75 },
  { id: 'nanyang', name: '南阳', kind: 'castle', faction: 'chuang', lon: 112.53, lat: 33.0 },
  { id: 'shangluo', name: '商洛', kind: 'castle', faction: 'chuang', lon: 109.94, lat: 33.87 },
  { id: 'ruzhou', name: '汝州', kind: 'castle', faction: 'chuang', lon: 112.84, lat: 34.17 },
  { id: 'kuizhou', name: '夔州', kind: 'castle', faction: 'xi', lon: 109.5, lat: 31.0 },
  { id: 'jianmen', name: '剑门关', kind: 'castle', faction: 'xi', lon: 105.55, lat: 32.2 },
  { id: 'luzhou', name: '泸州', kind: 'castle', faction: 'xi', lon: 105.44, lat: 28.87 },
];

export const VILLAGE_NAMES = [
  '张家庄', '李家集', '王家屯', '柳树营', '石桥镇', '杏花村', '黄土坡', '青山堡', '马家湾', '白沙铺', '河口镇', '枣林庄', '刘家寨', '赵家沟',
  '陈家岭', '孙家店', '周家渡', '吴家坊', '郑家楼', '桃花坞', '梨园村', '槐树屯', '杨柳青', '麦香村', '高粱坡', '芦苇荡', '野狐岭', '卧牛山',
  '龙泉驿', '凤凰台', '鹰嘴崖', '虎跳峡', '金沙滩', '银杏村', '碧水湾', '红石岗', '黑松林', '青石镇', '古井村', '瓦窑堡', '铁匠铺', '磨坊村',
  '盐井镇', '茶山村', '桑园镇', '稻香村', '竹溪村', '松江屯', '鹿角湾', '牛家口', '羊角屯', '驼铃驿', '狼牙寨', '马场屯', '鱼米乡', '莲花池',
  '双桥镇', '三河口', '四方店', '五里铺', '六合屯', '七星岗', '八里桥', '九龙集', '十里堡', '东关村', '西沟村', '南屯', '北营', '上河村',
];

export const VILLAGE_PRODUCE: Record<string, string[]> = {
  ming: ['grain', 'cloth', 'meat', 'wine', 'salt'], jin: ['fur', 'ginseng', 'grain'], mon: ['meat', 'fur'], chuang: ['grain', 'wine'], xi: ['herb', 'tea', 'salt'],
};

export interface LordDef { id: string; name: string; faction: FactionId; title: string; trait: 'brave' | 'cautious' | 'greedy' | 'honorable' }
const L = (faction: FactionId, list: [string, string, LordDef['trait']][]) =>
  list.map(([name, title, trait], i) => ({ id: `${faction}_lord${i}`, name, faction, title, trait }));

export const LORD_DEFS: LordDef[] = [
  ...L('ming', [['卢象升', '宣大总督', 'brave'], ['孙传庭', '陕西巡抚', 'honorable'], ['洪承畴', '三边总督', 'cautious'], ['曹文诏', '总兵', 'brave'],
    ['左良玉', '总兵', 'greedy'], ['秦良玉', '石砫宣抚使', 'honorable'], ['祖大寿', '锦州总兵', 'cautious'], ['吴三桂', '宁远游击', 'greedy'], ['周遇吉', '总兵', 'brave'],
    ['杨嗣昌', '督师', 'cautious'], ['黄得功', '总兵', 'brave'], ['贺人龙', '总兵', 'brave'], ['高杰', '总兵', 'greedy'], ['史可法', '巡抚', 'honorable'],
    ['唐通', '总兵', 'greedy'], ['马科', '总兵', 'cautious'], ['刘泽清', '总兵', 'greedy'], ['王朴', '总兵', 'cautious'], ['姜瓖', '大同总兵', 'greedy'], ['白广恩', '总兵', 'brave']]),
  ...L('jin', [['多尔衮', '贝勒', 'cautious'], ['多铎', '贝勒', 'brave'], ['阿济格', '贝勒', 'brave'], ['代善', '大贝勒', 'honorable'],
    ['岳托', '贝勒', 'brave'], ['豪格', '贝勒', 'greedy'], ['济尔哈朗', '贝勒', 'cautious'], ['孔有德', '都元帅', 'greedy'],
    ['阿巴泰', '贝勒', 'brave'], ['尚可喜', '总兵', 'greedy'], ['耿仲明', '总兵', 'cautious'], ['杜度', '贝勒', 'brave']]),
  ...L('chuang', [['刘宗敏', '权将军', 'brave'], ['李过', '制将军', 'brave'], ['高一功', '果毅将军', 'honorable'], ['田见秀', '制将军', 'cautious'],
    ['袁宗第', '将军', 'brave'], ['郝摇旗', '将军', 'greedy'], ['李岩', '制将军', 'honorable'], ['刘芳亮', '将军', 'brave'], ['贺锦', '将军', 'brave']]),
  ...L('xi', [['孙可望', '平东将军', 'cautious'], ['李定国', '安西将军', 'honorable'], ['刘文秀', '抚南将军', 'brave'], ['艾能奇', '定北将军', 'brave'], ['王尚礼', '将军', 'greedy']]),
  ...L('mon', [['额哲', '台吉', 'cautious'], ['衮楚克', '台吉', 'brave'], ['布延图', '诺颜', 'greedy'], ['多尔济', '台吉', 'brave'], ['巴雅尔', '诺颜', 'honorable']]),
];

export interface CompanionDef {
  id: string; name: string; title: string; story: string; cost: number;
  hp: number; atk: number; def: number; skill: number; rng?: number; mounted: boolean;
  skills: Partial<Record<string, number>>;
}
export const COMPANIONS: CompanionDef[] = [
  { id: 'c_qian', name: '戚安', title: '戚家后人', story: '戚少保的远房后裔，熟读《纪效新书》，一心想重整鸳鸯阵。', cost: 400, hp: 110, atk: 22, def: 16, skill: 12, mounted: false, skills: { training: 4, leadership: 2, powerstrike: 3, tactics: 2 } },
  { id: 'c_qin', name: '秦红缨', title: '江湖女侠', story: '峨眉山下长大的女侠，一杆红缨枪使得出神入化。', cost: 500, hp: 95, atk: 24, def: 10, skill: 13, mounted: true, skills: { powerstrike: 4, riding: 3, ironflesh: 1 } },
  { id: 'c_liu', name: '柳文远', title: '落第书生', story: '三试不第，转而钻研岐黄之术，颇有心得。', cost: 250, hp: 70, atk: 10, def: 6, skill: 5, mounted: false, skills: { surgery: 5, trade: 2, pathfinding: 1 } },
  { id: 'c_batu', name: '巴图', title: '蒙古射手', story: '部落被吞并后流落关内，箭术百发百中。', cost: 450, hp: 90, atk: 15, def: 10, skill: 10, rng: 20, mounted: true, skills: { archery: 4, spotting: 4, riding: 3 } },
  { id: 'c_wang', name: '王铁山', title: '镖头', story: '威远镖局的镖头，镖局倒闭后欲另谋出路。', cost: 350, hp: 115, atk: 18, def: 14, skill: 10, mounted: false, skills: { ironflesh: 3, training: 2, pathfinding: 3 } },
  { id: 'c_lin', name: '林阿四', title: '海商', story: '跑过吕宋、长崎的海商，精于算计。', cost: 300, hp: 75, atk: 12, def: 8, skill: 6, rng: 22, mounted: false, skills: { trade: 5, pathfinding: 2, spotting: 1 } },
  { id: 'c_qing', name: '青松子', title: '武当道人', story: '云游四方的道人，通医理、晓天文。', cost: 350, hp: 90, atk: 17, def: 8, skill: 12, mounted: false, skills: { surgery: 3, spotting: 3, tactics: 2 } },
  { id: 'c_tang', name: '汤若瑟', title: '西洋教士', story: '随利玛窦之后来华的耶稣会士，精通历算与火器。', cost: 400, hp: 70, atk: 9, def: 8, skill: 5, rng: 34, mounted: false, skills: { tactics: 3, surgery: 2, trade: 2 } },
  { id: 'c_zhao', name: '赵四海', title: '盐枭', story: '贩私盐起家的江湖豪客，三教九流无所不识。', cost: 300, hp: 100, atk: 18, def: 11, skill: 9, mounted: true, skills: { prisoner: 4, trade: 2, leadership: 2 } },
  { id: 'c_aluo', name: '阿萝', title: '苗家猎手', story: '湘西苗寨的猎手，熟悉山林，行走如飞。', cost: 300, hp: 85, atk: 14, def: 7, skill: 10, rng: 17, mounted: false, skills: { pathfinding: 4, archery: 3, spotting: 2 } },
];

export interface BanditZone { lon: number; lat: number; r: number; troop: string; name: string }
export const BANDIT_ZONES: BanditZone[] = [
  { lon: 113.8, lat: 37.0, r: 1.0, troop: 'bandit_mtn', name: '太行山贼' },
  { lon: 108.5, lat: 33.4, r: 1.2, troop: 'bandit_mtn', name: '秦岭山贼' },
  { lon: 115.5, lat: 31.0, r: 0.9, troop: 'bandit_mtn', name: '大别山贼' },
  { lon: 117.6, lat: 27.3, r: 1.0, troop: 'bandit_mtn', name: '武夷山贼' },
  { lon: 120.8, lat: 29.3, r: 0.8, troop: 'bandit_wokou', name: '倭寇' },
  { lon: 119.0, lat: 25.4, r: 0.8, troop: 'bandit_wokou', name: '倭寇' },
  { lon: 116.3, lat: 23.4, r: 0.8, troop: 'bandit_wokou', name: '海寇' },
  { lon: 112.5, lat: 42.0, r: 1.8, troop: 'bandit_horse', name: '马贼' },
  { lon: 106.0, lat: 38.4, r: 1.4, troop: 'bandit_horse', name: '马贼' },
  { lon: 116.0, lat: 34.0, r: 1.3, troop: 'bandit_rover', name: '流寇' },
  { lon: 111.0, lat: 29.8, r: 1.3, troop: 'bandit_rover', name: '流寇' },
  { lon: 107.5, lat: 26.5, r: 1.3, troop: 'bandit_mtn', name: '苗疆山贼' },
];

export const CHINESE_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
export const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
