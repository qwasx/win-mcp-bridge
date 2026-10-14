// 物品：灵药、丹药、材料、符箓、功法、法器/法宝
export type ItemType = 'herb' | 'pill' | 'material' | 'artifact' | 'talisman' | 'scroll' | 'misc';

export type ArtKind =
  | 'sword' | 'needle' | 'ring' | 'mirror' | 'slam' | 'arrow' | 'bell' | 'bind'
  | 'flame' | 'banner' | 'cauldron' | 'shield' | 'armor' | 'wings' | 'flight';

export interface ArtSpec {
  kind: ArtKind;
  reqRealm: number;     // 需要境界（低一个大境界可勉强驱使，威力减半）
  sense: number;        // 每件/每口占用神识
  pieces: number;       // 成套数量上限（飞剑、飞针等）
  power: number;        // 威力倍率（乘以灵力）
  mp: number;           // 每次催动耗费法力
  cd: number;           // 冷却（秒）
  element?: 'fire' | 'ice' | 'thunder' | 'gold' | 'wood' | 'water' | 'earth' | 'yin' | 'blood';
  mapSpeed?: number;    // 大地图速度加成（倍率）
  def?: number;         // 防御加成（护甲/盾）
  absorb?: number;      // 护盾吸收（乘以最大法力的比例）
  hpCost?: number;      // 每次催动消耗气血比例（魔器）
  color: string;
  upgradable?: boolean; // 可培养（青竹蜂云剑）
}

export interface PillEffect { exp?: number; expPct?: number; hp?: number; mp?: number; life?: number; sense?: number; root?: number; favor?: number }
export interface TalSpec { kind: 'fire' | 'thunder' | 'ice' | 'shield' | 'escape' | 'revive'; power: number; color: string }

export interface ItemDef {
  id: string; name: string; type: ItemType; tier: number; price: number; desc: string;
  glyph: string;
  pill?: PillEffect;
  art?: ArtSpec;
  tal?: TalSpec;
  scroll?: { gongfa?: string; skill?: string };
  herbBase?: number;      // 灵药天然年份基准
  giftValue?: number;     // 作为礼物的基础价值
  stack?: boolean;
}

export const TIER_COLORS = ['#7a7a7a', '#5b8a5b', '#3f78a8', '#8a4fb0', '#c08a2a', '#c0392b', '#e0a800'];
export const TIER_NAMES = ['凡品', '下品', '中品', '上品', '极品', '古宝', '通天'];

const I: ItemDef[] = [
  // ---------- 灵药 ----------
  { id: 'herb_huangjing', name: '黄精', type: 'herb', tier: 0, price: 4, desc: '最常见的灵草，可炼聚气丹。', glyph: '草', herbBase: 10, stack: true },
  { id: 'herb_lingzhi', name: '赤灵芝', type: 'herb', tier: 1, price: 12, desc: '生于深山，可炼聚气丹、回气丹。', glyph: '芝', herbBase: 20, stack: true },
  { id: 'herb_jinxin', name: '金心草', type: 'herb', tier: 1, price: 15, desc: '叶心金黄，疗伤丹主药。', glyph: '草', herbBase: 15, stack: true },
  { id: 'herb_zihou', name: '紫猴花', type: 'herb', tier: 2, price: 120, desc: '筑基丹主药之一，多生于血色禁地。', glyph: '花', herbBase: 40, stack: true },
  { id: 'herb_tianling', name: '天灵果', type: 'herb', tier: 2, price: 150, desc: '筑基丹主药之一，百年方熟。', glyph: '果', herbBase: 50, stack: true },
  { id: 'herb_nichang', name: '霓裳草', type: 'herb', tier: 2, price: 60, desc: '香气可引妖兽前来，韩立曾以此诱杀妖兽取丹。', glyph: '草', herbBase: 30, stack: true },
  { id: 'herb_xuelian', name: '天山雪莲', type: 'herb', tier: 2, price: 90, desc: '生于极寒之地，可炼聚灵丹。', glyph: '莲', herbBase: 60, stack: true },
  { id: 'herb_huolong', name: '火龙果', type: 'herb', tier: 3, price: 400, desc: '火属灵果，降尘丹主药。', glyph: '果', herbBase: 80, stack: true },
  { id: 'herb_bingpo', name: '冰魄草', type: 'herb', tier: 3, price: 350, desc: '寒属灵草，可炼凝元丹。', glyph: '草', herbBase: 80, stack: true },
  { id: 'herb_jiuqu', name: '九曲灵参', type: 'herb', tier: 5, price: 20000, desc: '结婴圣药，可化形遁走，极难寻得。', glyph: '参', herbBase: 300, stack: true },
  { id: 'herb_xuejing', name: '血精草', type: 'herb', tier: 3, price: 300, desc: '血色灵草，培婴丹辅药。', glyph: '草', herbBase: 100, stack: true },
  { id: 'herb_yangshen', name: '万年灵乳', type: 'herb', tier: 4, price: 3000, desc: '万年钟乳凝成，延寿圣物。', glyph: '乳', herbBase: 200, stack: true },

  // ---------- 丹药 ----------
  { id: 'pill_juqi', name: '聚气丹', type: 'pill', tier: 0, price: 30, desc: '炼气期修士常用丹药，增加修为，亦可助冲关。', glyph: '丹', pill: { exp: 400 }, stack: true },
  { id: 'pill_huanglong', name: '黄龙丹', type: 'pill', tier: 1, price: 120, desc: '药力浑厚，炼气期服用增加大量修为。', glyph: '丹', pill: { exp: 1500 }, stack: true },
  { id: 'pill_jinsui', name: '金髓丸', type: 'pill', tier: 1, price: 160, desc: '可洗练经脉，增加修为。', glyph: '丸', pill: { exp: 2200 }, stack: true },
  { id: 'pill_zhuji', name: '筑基丹', type: 'pill', tier: 3, price: 6000, desc: '冲击筑基必备，七派每年分配有限，一颗难求。', glyph: '丹', stack: true },
  { id: 'pill_juling', name: '聚灵丹', type: 'pill', tier: 2, price: 600, desc: '筑基期增长修为，并可冲击小瓶颈。', glyph: '丹', pill: { exp: 9000 }, stack: true },
  { id: 'pill_jiangchen', name: '降尘丹', type: 'pill', tier: 4, price: 30000, desc: '结丹辅助圣药，可提升结丹成功率。', glyph: '丹', stack: true },
  { id: 'pill_ningyuan', name: '凝元丹', type: 'pill', tier: 3, price: 3000, desc: '结丹期增长修为，冲击小瓶颈。', glyph: '丹', pill: { exp: 40000 }, stack: true },
  { id: 'pill_jiuqu', name: '九曲灵参丹', type: 'pill', tier: 5, price: 120000, desc: '以九曲灵参炼成，结婴成功率大增。', glyph: '丹', stack: true },
  { id: 'pill_peiying', name: '培婴丹', type: 'pill', tier: 4, price: 15000, desc: '元婴期温养元婴，冲击小瓶颈。', glyph: '丹', pill: { exp: 160000 }, stack: true },
  { id: 'pill_huiqi', name: '回气丹', type: 'pill', tier: 0, price: 20, desc: '迅速恢复法力（战斗中可用）。', glyph: '丹', pill: { mp: 0.4 }, stack: true },
  { id: 'pill_liaoshang', name: '疗伤丹', type: 'pill', tier: 0, price: 25, desc: '迅速恢复气血（战斗中可用）。', glyph: '丹', pill: { hp: 0.4 }, stack: true },
  { id: 'pill_dingyan', name: '定颜丹', type: 'pill', tier: 2, price: 800, desc: '可令容颜永驻，女修梦寐以求的珍品。送礼佳品。', glyph: '丹', pill: { favor: 1 }, giftValue: 25, stack: true },
  { id: 'pill_yanshou', name: '延寿丹', type: 'pill', tier: 3, price: 5000, desc: '增加二十年寿元，每人服用有限。', glyph: '丹', pill: { life: 20 }, stack: true },
  { id: 'pill_yanghun', name: '养魂丹', type: 'pill', tier: 3, price: 4000, desc: '温养神魂，永久提升神识。', glyph: '丹', pill: { sense: 0.06 }, stack: true },
  { id: 'pill_butian', name: '补天丹', type: 'pill', tier: 6, price: 999999, desc: '虚天殿至宝，可改善灵根资质，伪灵根亦能脱胎换骨。', glyph: '丹', pill: { root: 1 }, stack: true },

  // ---------- 材料 ----------
  { id: 'mat_yaodan1', name: '一级妖丹', type: 'material', tier: 0, price: 25, desc: '低阶妖兽内丹，炼丹炼器皆可用。', glyph: '核', stack: true },
  { id: 'mat_yaodan3', name: '三级妖丹', type: 'material', tier: 1, price: 180, desc: '相当于筑基期的妖兽内丹。', glyph: '核', stack: true },
  { id: 'mat_yaodan5', name: '五级妖丹', type: 'material', tier: 2, price: 1200, desc: '相当于结丹期的妖兽内丹。', glyph: '核', stack: true },
  { id: 'mat_yaodan7', name: '七级妖丹', type: 'material', tier: 3, price: 8000, desc: '相当于元婴期的妖兽内丹。', glyph: '核', stack: true },
  { id: 'mat_yaodan9', name: '九级妖丹', type: 'material', tier: 4, price: 50000, desc: '可化形的大妖内丹，人界罕见。', glyph: '核', stack: true },
  { id: 'mat_jinleizhu', name: '金雷竹', type: 'material', tier: 4, price: 15000, desc: '万年金雷竹，蕴含辟邪神雷，可炼青竹蜂云剑。', glyph: '竹', stack: true },
  { id: 'mat_gengjing', name: '庚精', type: 'material', tier: 5, price: 60000, desc: '锐金之宝，融入飞剑可布大庚剑阵。', glyph: '金', stack: true },
  { id: 'mat_yanghunmu', name: '养魂木', type: 'material', tier: 4, price: 20000, desc: '三大灵木之一。随身携带神识+15%，并护住神魂。', glyph: '木', stack: true },
  { id: 'item_yuanqi', name: '天地元气晶', type: 'material', tier: 5, price: 80000, desc: '人界稀薄的天地元气凝成，化神期修炼必需。', glyph: '晶', stack: true },
  { id: 'mat_xuanyu', name: '玄玉', type: 'material', tier: 1, price: 80, desc: '炼器常用灵玉。', glyph: '玉', stack: true },

  { id: 'mat_lingshi', name: '下品灵石', type: 'material', tier: 0, price: 1, desc: '修仙界通用货币，内蕴微薄灵气。', glyph: '石', stack: true },
  { id: 'mat_tiejing', name: '铁精', type: 'material', tier: 0, price: 8, desc: '山中矿脉提炼出的精铁，炼制低阶法器的常用材料。', glyph: '铁', stack: true },
  { id: 'mat_chitong', name: '赤铜', type: 'material', tier: 1, price: 30, desc: '色泽赤红的灵铜，可炼法器。', glyph: '铜', stack: true },
  { id: 'mat_xuantie', name: '玄铁', type: 'material', tier: 2, price: 200, desc: '深埋地脉的沉重玄铁，上品法器材料。', glyph: '铁', stack: true },
  { id: 'mat_lingquan', name: '灵泉水', type: 'material', tier: 1, price: 40, desc: '灵泉中汲取的泉水，炼丹时可提高成丹率，也可直接饮下增长少许修为。', glyph: '泉', pill: { exp: 60 }, stack: true },

  // ---------- 符箓 ----------
  { id: 'tal_fire', name: '火球符', type: 'talisman', tier: 0, price: 15, desc: '激发后射出数枚火球。', glyph: '符', tal: { kind: 'fire', power: 2.2, color: '#e0582a' }, stack: true },
  { id: 'tal_thunder', name: '天雷符', type: 'talisman', tier: 2, price: 300, desc: '引天雷轰击敌人，威力不俗。', glyph: '符', tal: { kind: 'thunder', power: 6, color: '#8fb7ff' }, stack: true },
  { id: 'tal_ice', name: '冰锥符', type: 'talisman', tier: 1, price: 60, desc: '射出寒冰锥，可冻缓敌人。', glyph: '符', tal: { kind: 'ice', power: 3, color: '#9ad7f0' }, stack: true },
  { id: 'tal_jingang', name: '金刚符', type: 'talisman', tier: 1, price: 80, desc: '金光护体，抵挡一定伤害。', glyph: '符', tal: { kind: 'shield', power: 0.5, color: '#e0c050' }, stack: true },
  { id: 'tal_escape', name: '遁地符', type: 'talisman', tier: 1, price: 150, desc: '危急时遁地而走，立刻脱离战斗。', glyph: '符', tal: { kind: 'escape', power: 1, color: '#8a6a3a' }, stack: true },
  { id: 'tal_tishen', name: '替身符', type: 'talisman', tier: 3, price: 5000, desc: '身陨时自动燃烧，替死一次，恢复半数气血。', glyph: '符', tal: { kind: 'revive', power: 0.5, color: '#d04848' }, stack: true },
  { id: 'tal_liuding', name: '六丁天甲符', type: 'talisman', tier: 5, price: 200000, desc: '顶级护身符宝，身陨时自动激发，满血复生并护体。', glyph: '符', tal: { kind: 'revive', power: 1, color: '#f0c040' }, stack: true },

  // ---------- 功法/法术 ----------
  { id: 'scroll_changchun', name: '长春功', type: 'scroll', tier: 0, price: 50, desc: '炼气入门功法，修炼速度一般。', glyph: '卷', scroll: { gongfa: 'changchun' } },
  { id: 'scroll_qingyuan', name: '青元剑诀', type: 'scroll', tier: 3, price: 8000, desc: '上古青元子所创，剑修无上功法，飞剑威力大增。', glyph: '卷', scroll: { gongfa: 'qingyuan' } },
  { id: 'scroll_xuanyin', name: '玄阴经', type: 'scroll', tier: 3, price: 6000, desc: '鬼道魔功，修炼迅速，法术附带阴火。', glyph: '卷', scroll: { gongfa: 'xuanyin' } },
  { id: 'scroll_tuotian', name: '托天魔功', type: 'scroll', tier: 4, price: 30000, desc: '蛮胡子成名魔功，肉身可硬抗法宝。', glyph: '卷', scroll: { gongfa: 'tuotian' } },
  { id: 'scroll_dayan', name: '大衍诀', type: 'scroll', tier: 5, price: 50000, desc: '大衍神君所创神识秘术。每修成一层神识倍增，并可施展惊神刺。', glyph: '卷', scroll: { gongfa: 'dayan' } },
  { id: 'scroll_huodan', name: '火弹术', type: 'scroll', tier: 0, price: 30, desc: '基础攻击法术。', glyph: '术', scroll: { skill: 'huodan' } },
  { id: 'scroll_bingzhui', name: '冰锥术', type: 'scroll', tier: 1, price: 120, desc: '射出冰锥，命中可减速。', glyph: '术', scroll: { skill: 'bingzhui' } },
  { id: 'scroll_tianyan', name: '天眼术', type: 'scroll', tier: 0, price: 60, desc: '开启天眼，大地图神识范围临时提升50%（30天）。', glyph: '术', scroll: { skill: 'tianyan' } },
  { id: 'scroll_lianqi', name: '敛气术', type: 'scroll', tier: 1, price: 200, desc: '收敛气息，旁人探查你时修为显得低下，神识圈缩小。', glyph: '术', scroll: { skill: 'lianqi' } },
  { id: 'scroll_luoyan', name: '罗烟步', type: 'scroll', tier: 1, price: 300, desc: '身法：瞬间闪身，冷却更短。', glyph: '术', scroll: { skill: 'luoyan' } },
  { id: 'scroll_mingqing', name: '明清灵目', type: 'scroll', tier: 4, price: 25000, desc: '瞳术，可看穿禁制与隐匿，神识圈内隐藏之物无所遁形。', glyph: '术', scroll: { skill: 'mingqing' } },
  { id: 'scroll_leidian', name: '掌心雷', type: 'scroll', tier: 2, price: 1500, desc: '雷法，范围轰击。', glyph: '术', scroll: { skill: 'leidian' } },
  { id: 'scroll_yuanci', name: '元磁神光', type: 'scroll', tier: 5, price: 80000, desc: '天星双圣秘传，五行法宝克星，可短暂禁锢敌人法宝。', glyph: '术', scroll: { skill: 'yuanci' } },

  // ---------- 法器（炼气/筑基）----------
  { id: 'art_qingfeng', name: '青锋剑', type: 'artifact', tier: 0, price: 120, desc: '最普通的飞剑法器。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 10, pieces: 1, power: 1.0, mp: 2, cd: 1.1, color: '#9ab8a8' } },
  { id: 'art_yinhui', name: '银辉剑', type: 'artifact', tier: 1, price: 600, desc: '上品飞剑法器，银光凛凛。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 12, pieces: 1, power: 1.5, mp: 3, cd: 1.0, color: '#d8e0e8' } },
  { id: 'art_wulong', name: '乌龙夺', type: 'artifact', tier: 1, price: 500, desc: '乌光如龙，专破护体灵光。', glyph: '器', art: { kind: 'arrow', reqRealm: 1, sense: 12, pieces: 1, power: 3.2, mp: 8, cd: 3.2, color: '#404850' } },
  { id: 'art_hongxian', name: '红线遁光针', type: 'artifact', tier: 2, price: 3000, desc: '十三枚一套，无影无踪，修仙界有名的阴器。神识越强能同时驱使越多。', glyph: '针', art: { kind: 'needle', reqRealm: 1, sense: 4, pieces: 13, power: 0.55, mp: 1, cd: 0.9, color: '#e05050' } },
  { id: 'art_guike', name: '龟壳盾', type: 'artifact', tier: 1, price: 450, desc: '防御法器，抵挡伤害。', glyph: '盾', art: { kind: 'shield', reqRealm: 1, sense: 10, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.6, color: '#7a8a5a' } },
  { id: 'art_qingjiao', name: '青蛟旗', type: 'artifact', tier: 2, price: 1500, desc: '旗中封有蛟魂，可召出青蛟助战。', glyph: '旗', art: { kind: 'banner', reqRealm: 1, sense: 18, pieces: 1, power: 0.9, mp: 15, cd: 9, color: '#3aa080' } },
  { id: 'art_qingning', name: '青凝镜', type: 'artifact', tier: 1, price: 700, desc: '射出青色光柱。', glyph: '镜', art: { kind: 'mirror', reqRealm: 1, sense: 12, pieces: 1, power: 2.0, mp: 6, cd: 2.6, color: '#70c0b0' } },
  { id: 'art_shenfeng', name: '神风舟', type: 'artifact', tier: 2, price: 2500, desc: '飞行法器，炼气期也可驾驭飞渡，大地图速度+40%，可渡海。', glyph: '舟', art: { kind: 'flight', reqRealm: 1, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.4, color: '#a0c8e0' } },
  { id: 'art_jianfu', name: '剑符（符宝）', type: 'artifact', tier: 2, price: 4000, desc: '结丹修士封入一缕剑气的符宝，威力极大。', glyph: '符', art: { kind: 'arrow', reqRealm: 1, sense: 15, pieces: 1, power: 7, mp: 25, cd: 6, color: '#c0e0ff' } },

  // ---------- 法宝 ----------
  { id: 'art_qingzhu', name: '青竹蜂云剑', type: 'artifact', tier: 4, price: 0, desc: '以万年金雷竹炼制的本命飞剑，蕴含辟邪神雷。可以金雷竹继续炼制，最多七十二口，融入庚精后可布大庚剑阵。', glyph: '剑', art: { kind: 'sword', reqRealm: 2, sense: 9, pieces: 72, power: 1.7, mp: 2, cd: 0.9, element: 'thunder', color: '#6fd0a0', upgradable: true } },
  { id: 'art_lvhuang', name: '绿煌剑', type: 'artifact', tier: 3, price: 9000, desc: '绿光煌煌的飞剑法宝。', glyph: '剑', art: { kind: 'sword', reqRealm: 3, sense: 30, pieces: 1, power: 3.2, mp: 8, cd: 1.0, element: 'wood', color: '#5fe080' } },
  { id: 'art_zhuque', name: '朱雀环', type: 'artifact', tier: 4, price: 30000, desc: '南宫婉本命法宝，熔炼朱雀之魂，旋转时化作一片火海。', glyph: '环', art: { kind: 'ring', reqRealm: 3, sense: 40, pieces: 1, power: 2.6, mp: 10, cd: 3.5, element: 'fire', color: '#ff6a4a' } },
  { id: 'art_zhuxie', name: '诛邪刺', type: 'artifact', tier: 3, price: 12000, desc: '偷袭利器，发动时带赤红暗芒。', glyph: '刺', art: { kind: 'arrow', reqRealm: 3, sense: 30, pieces: 1, power: 6, mp: 18, cd: 4, color: '#c03030' } },
  { id: 'art_lanjin', name: '蓝金砖', type: 'artifact', tier: 3, price: 11000, desc: '蓝金之精炼成，砸落如山。', glyph: '砖', art: { kind: 'slam', reqRealm: 3, sense: 35, pieces: 1, power: 7, mp: 25, cd: 5, element: 'earth', color: '#4a70c0' } },
  { id: 'art_miemo', name: '灭魔箭', type: 'artifact', tier: 4, price: 26000, desc: '玄骨上人之宝，金雷竹所制，专克魔物。', glyph: '箭', art: { kind: 'arrow', reqRealm: 3, sense: 40, pieces: 1, power: 9, mp: 30, cd: 4.5, element: 'thunder', color: '#e0e070' } },
  { id: 'art_huanglin', name: '皇鳞甲', type: 'artifact', tier: 3, price: 10000, desc: '护身宝甲，大幅提升防御。', glyph: '甲', art: { kind: 'armor', reqRealm: 3, sense: 25, pieces: 1, power: 0, mp: 0, cd: 0, def: 0.35, color: '#c0a040' } },
  { id: 'art_xuepifeng', name: '血色披风', type: 'artifact', tier: 5, price: 40000, desc: '古宝，护身并提升身法。', glyph: '衣', art: { kind: 'armor', reqRealm: 3, sense: 45, pieces: 1, power: 0, mp: 0, cd: 0, def: 0.25, color: '#b02030' } },
  { id: 'art_wuxing', name: '五行环', type: 'artifact', tier: 5, price: 45000, desc: '古宝，五环轮转，攻守兼备。', glyph: '环', art: { kind: 'ring', reqRealm: 3, sense: 50, pieces: 1, power: 3.4, mp: 12, cd: 3, color: '#d0b060' } },
  { id: 'art_huolan', name: '古宝花篮', type: 'artifact', tier: 5, price: 42000, desc: '古宝，花瓣如雨，铺天盖地。', glyph: '篮', art: { kind: 'needle', reqRealm: 3, sense: 6, pieces: 12, power: 1.4, mp: 2, cd: 0.8, color: '#f090c0' } },
  { id: 'art_tianyang', name: '天阳鎏金针', type: 'artifact', tier: 3, price: 15000, desc: '温天仁之宝，金针如阳。', glyph: '针', art: { kind: 'needle', reqRealm: 3, sense: 6, pieces: 9, power: 1.6, mp: 2, cd: 0.7, element: 'fire', color: '#ffc040' } },
  { id: 'art_bamen', name: '八门金光镜（仿）', type: 'artifact', tier: 4, price: 35000, desc: '仿制古宝，射出八道金光，威力惊人。', glyph: '镜', art: { kind: 'mirror', reqRealm: 3, sense: 45, pieces: 1, power: 5, mp: 20, cd: 3, element: 'gold', color: '#ffd860' } },
  { id: 'art_sixiang', name: '四象蟠龙带', type: 'artifact', tier: 3, price: 14000, desc: '捆缚法宝，可将敌人缚住片刻。', glyph: '带', art: { kind: 'bind', reqRealm: 3, sense: 30, pieces: 1, power: 1.5, mp: 18, cd: 7, color: '#60a0d0' } },
  { id: 'art_yinzhong', name: '银钟古宝', type: 'artifact', tier: 5, price: 38000, desc: '钟声震荡神魂，周身敌人短暂失神。', glyph: '钟', art: { kind: 'bell', reqRealm: 3, sense: 45, pieces: 1, power: 2.2, mp: 22, cd: 8, color: '#d0d8e0' } },
  { id: 'art_qingtong', name: '青铜古盾', type: 'artifact', tier: 5, price: 30000, desc: '古宝护盾，坚不可摧。', glyph: '盾', art: { kind: 'shield', reqRealm: 3, sense: 40, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.9, color: '#6a8a6a' } },
  { id: 'art_zibing', name: '紫冰镯', type: 'artifact', tier: 5, price: 36000, desc: '蛮胡子的古宝，寒气逼人。', glyph: '镯', art: { kind: 'ring', reqRealm: 3, sense: 45, pieces: 1, power: 3, mp: 12, cd: 3.2, element: 'ice', color: '#a080ff' } },
  { id: 'art_ningguang', name: '凝光宝镜', type: 'artifact', tier: 5, price: 34000, desc: '乌黑发亮的古宝，可射出五色光柱。', glyph: '镜', art: { kind: 'mirror', reqRealm: 3, sense: 45, pieces: 1, power: 4.4, mp: 18, cd: 2.8, color: '#e0a0ff' } },
  { id: 'art_xuemo', name: '血魔剑', type: 'artifact', tier: 4, price: 28000, desc: '魔器，以精血驱动，威力极大，有反噬之险。', glyph: '剑', art: { kind: 'sword', reqRealm: 3, sense: 40, pieces: 1, power: 6, mp: 4, cd: 1.0, hpCost: 0.01, element: 'blood', color: '#d01020' } },
  { id: 'art_languang', name: '蓝光盾', type: 'artifact', tier: 5, price: 28000, desc: '水属性防御古宝，对火属攻击妙用不小。', glyph: '盾', art: { kind: 'shield', reqRealm: 3, sense: 40, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.8, element: 'water', color: '#4080e0' } },
  { id: 'art_ziyou', name: '紫铖兜', type: 'artifact', tier: 5, price: 33000, desc: '古宝，可释放玉阳真火困敌。', glyph: '兜', art: { kind: 'flame', reqRealm: 3, sense: 45, pieces: 1, power: 1.2, mp: 3, cd: 0.25, element: 'fire', color: '#c070f0' } },
  { id: 'art_fenglei', name: '风雷翅', type: 'artifact', tier: 5, price: 150000, desc: '雷鹏骨翅炼成，可施展雷遁，瞬息千里。身法化为雷遁，大地图速度x1.8。', glyph: '翅', art: { kind: 'wings', reqRealm: 3, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.8, element: 'thunder', color: '#80b0ff' } },
  { id: 'art_sanshen', name: '三神白骨幡', type: 'artifact', tier: 5, price: 90000, desc: '六道极圣的魔幡，召出白骨魔神。', glyph: '幡', art: { kind: 'banner', reqRealm: 4, sense: 120, pieces: 1, power: 2.4, mp: 60, cd: 10, element: 'yin', color: '#e0e0d0' } },
  { id: 'art_guiluo', name: '鬼罗幡', type: 'artifact', tier: 4, price: 60000, desc: '阴罗宗镇宗之宝，以生魂祭炼，召出厉鬼。', glyph: '幡', art: { kind: 'banner', reqRealm: 3, sense: 60, pieces: 1, power: 1.6, mp: 30, cd: 8, element: 'yin', color: '#506070' } },
  { id: 'art_tiandu', name: '天都尸火', type: 'artifact', tier: 4, price: 50000, desc: '极阴祖师成名神通，阴火所过，生机断绝。', glyph: '火', art: { kind: 'flame', reqRealm: 4, sense: 80, pieces: 1, power: 2.2, mp: 6, cd: 0.25, element: 'yin', color: '#60ff90' } },
  { id: 'art_qianlan', name: '乾蓝冰焰', type: 'artifact', tier: 5, price: 120000, desc: '虚天鼎中封印的奇寒之焰，冰封万物。', glyph: '焰', art: { kind: 'flame', reqRealm: 3, sense: 70, pieces: 1, power: 2.8, mp: 6, cd: 0.25, element: 'ice', color: '#60c0ff' } },
  { id: 'art_sanyan', name: '三焰扇', type: 'artifact', tier: 5, price: 160000, desc: '仿七焰扇炼制的仿通天灵宝，三色火焰焚尽一切。', glyph: '扇', art: { kind: 'flame', reqRealm: 4, sense: 150, pieces: 1, power: 5, mp: 12, cd: 0.25, element: 'fire', color: '#ff8030' } },
  { id: 'art_yuanci', name: '元磁神山', type: 'artifact', tier: 5, price: 200000, desc: '以元磁神光炼化的神山，砸落时天崩地裂。', glyph: '山', art: { kind: 'slam', reqRealm: 4, sense: 160, pieces: 1, power: 14, mp: 80, cd: 6, element: 'earth', color: '#8a7050' } },
  { id: 'art_wuzi', name: '五子同心魔', type: 'artifact', tier: 5, price: 220000, desc: '乾老魔之宝，五只魔头皆有元婴之力。', glyph: '魔', art: { kind: 'banner', reqRealm: 4, sense: 180, pieces: 1, power: 3.2, mp: 80, cd: 12, element: 'yin', color: '#902040' } },
  { id: 'art_xutian', name: '虚天鼎', type: 'artifact', tier: 6, price: 999999, desc: '乱星海第一至宝，通天灵宝。放出青丝困敌，收入鼎中炼化。对残血敌人有奇效。', glyph: '鼎', art: { kind: 'cauldron', reqRealm: 4, sense: 300, pieces: 1, power: 10, mp: 300, cd: 18, color: '#40d0c0' } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map((d) => [d.id, d]));
export const ITEM_LIST = I;
export function itemDef(id: string): ItemDef { return ITEMS[id] ?? { id, name: id, type: 'misc', tier: 0, price: 1, desc: '', glyph: '?' }; }
