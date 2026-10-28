import { ART_LIST } from './arts';
// 物品：灵药、丹药、材料、符箓、功法、法器/法宝
export type ItemType = 'herb' | 'pill' | 'material' | 'artifact' | 'talisman' | 'scroll' | 'misc';

export type ArtKind =
  | 'sword' | 'needle' | 'ring' | 'mirror' | 'slam' | 'arrow' | 'bell' | 'bind'
  | 'flame' | 'banner' | 'cauldron' | 'shield' | 'armor' | 'wings' | 'flight' | 'boots';

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
export interface TalSpec { kind: 'fire' | 'thunder' | 'ice' | 'shield' | 'escape' | 'revive' | 'fubao' | 'bomb'; power: number; color: string }

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
  // 第四十步：原著——韩立以妙音门客卿长老为条件，从紫灵仙子处换来带根的一小截天雷竹，再以掌天瓶绿液催熟成万年金雷竹
  { id: 'herb_tianleizhu', name: '天雷竹', type: 'herb', tier: 4, price: 9000, desc: '人界三大神木之一，带根的一截。两千年以下只放白雷，五千年以上雷色转蓝，长到万年便化为能放辟邪神雷的金雷竹（掌天瓶绿液可催熟；万年时自成金雷竹，旁生新枝）。', glyph: '竹', herbBase: 3000, stack: true },
  { id: 'herb_xuejing', name: '血精草', type: 'herb', tier: 3, price: 300, desc: '血色灵草，培婴丹辅药。', glyph: '草', herbBase: 100, stack: true },
  { id: 'herb_yangshen', name: '万年灵乳', type: 'herb', tier: 4, price: 3000, desc: '万年钟乳凝成，延寿圣物。', glyph: '乳', herbBase: 200, stack: true },

  // ---------- 丹药 ----------
  { id: 'pill_juqi', name: '聚气丹', type: 'pill', tier: 0, price: 30, desc: '炼气期修士常用丹药，增加修为，亦可助冲关。', glyph: '丹', pill: { exp: 400 }, stack: true },
  { id: 'pill_huanglong', name: '黄龙丹', type: 'pill', tier: 1, price: 120, desc: '药力浑厚，炼气期服用增加大量修为。', glyph: '丹', pill: { exp: 700 }, stack: true },
  { id: 'pill_jinsui', name: '金髓丸', type: 'pill', tier: 1, price: 160, desc: '可洗练经脉，增加修为。', glyph: '丸', pill: { exp: 900 }, stack: true },
  { id: 'pill_zhuji', name: '筑基丹', type: 'pill', tier: 3, price: 6000, desc: '冲击筑基必备，七派每年分配有限，一颗难求。', glyph: '丹', stack: true },
  { id: 'pill_juling', name: '聚灵丹', type: 'pill', tier: 2, price: 600, desc: '筑基期增长修为，并可冲击小瓶颈。', glyph: '丹', pill: { exp: 6000 }, stack: true },
  { id: 'pill_jiangchen', name: '降尘丹', type: 'pill', tier: 4, price: 30000, desc: '结丹辅助圣药，可提升结丹成功率。', glyph: '丹', stack: true },
  { id: 'pill_biyan', name: '碧焰酒', type: 'pill', tier: 4, price: 30000, desc: '以六翼霜蚣寒毒为主料酿成的灵酒，药力狂暴。风希曾以此助韩立由结丹中期冲入后期。', glyph: '酒', pill: { exp: 150000 }, stack: true },
  { id: 'pill_ningyuan', name: '凝元丹', type: 'pill', tier: 3, price: 3000, desc: '结丹期增长修为，冲击小瓶颈。', glyph: '丹', pill: { exp: 20000 }, stack: true },
  { id: 'pill_jiuqu', name: '九曲灵参丹', type: 'pill', tier: 5, price: 120000, desc: '以九曲灵参炼成，结婴成功率大增。', glyph: '丹', stack: true },
  { id: 'pill_peiying', name: '培婴丹', type: 'pill', tier: 4, price: 15000, desc: '元婴期温养元婴，冲击小瓶颈。', glyph: '丹', pill: { exp: 70000 }, stack: true },
  { id: 'pill_huiqi', name: '回气丹', type: 'pill', tier: 0, price: 20, desc: '迅速恢复法力（战斗中可用）。', glyph: '丹', pill: { mp: 0.4 }, stack: true },
  { id: 'pill_liaoshang', name: '疗伤丹', type: 'pill', tier: 0, price: 25, desc: '迅速恢复气血（战斗中可用）。', glyph: '丹', pill: { hp: 0.4 }, stack: true },
  { id: 'pill_dingyan', name: '定颜丹', type: 'pill', tier: 2, price: 800, desc: '可令容颜永驻，女修梦寐以求的珍品。送礼佳品。', glyph: '丹', pill: { favor: 1 }, giftValue: 25, stack: true },
  { id: 'pill_yanshou', name: '延寿丹', type: 'pill', tier: 3, price: 5000, desc: '增加二十年寿元，每人服用有限。', glyph: '丹', pill: { life: 20 }, stack: true },
  { id: 'pill_yanghun', name: '养魂丹', type: 'pill', tier: 3, price: 4000, desc: '温养神魂，永久提升神识。', glyph: '丹', pill: { sense: 0.06 }, stack: true },
  { id: 'pill_butian', name: '补天丹', type: 'pill', tier: 6, price: 999999, desc: '虚天殿至宝，可改善灵根资质，伪灵根亦能脱胎换骨。', glyph: '丹', pill: { root: 1 }, stack: true },
  // 第四十步：元婴期丹药
  { id: 'pill_yuanling', name: '元灵丹', type: 'pill', tier: 5, price: 45000, desc: '元婴修士温养元婴之丹，药力浑厚。', glyph: '丹', pill: { exp: 160000 }, stack: true },
  { id: 'pill_zifu', name: '紫府玄元丹', type: 'pill', tier: 5, price: 120000, desc: '以九曲灵参与九级妖丹炼成的元婴圣药，一颗抵得数十年苦修。', glyph: '丹', pill: { exp: 360000 }, stack: true },
  { id: 'pill_wanshou', name: '万寿丹', type: 'pill', tier: 5, price: 60000, desc: '续命灵丹，服之可增寿六十载。元婴老怪大限将至时愿倾家荡产求一颗。', glyph: '丹', pill: { life: 60 }, stack: true },
  { id: 'pill_ningpo', name: '凝魄丹', type: 'pill', tier: 5, price: 40000, desc: '凝练神魂，神识大进。', glyph: '丹', pill: { sense: 0.1 }, stack: true },

  // ---------- 材料 ----------
  // 妖丹：原著一至十级（1 炼气 · 2–4 筑基 · 5–7 结丹 · 8–10 元婴；七级以上可渡劫化形）
  { id: 'mat_yaodan1', name: '一级妖丹', type: 'material', tier: 0, price: 25, desc: '一级妖兽内丹，相当于炼气期修为。炼丹炼器皆可用。', glyph: '核', stack: true },
  { id: 'mat_yaodan2', name: '二级妖丹', type: 'material', tier: 1, price: 90, desc: '二级妖兽内丹，相当于筑基初期。', glyph: '核', stack: true },
  { id: 'mat_yaodan3', name: '三级妖丹', type: 'material', tier: 1, price: 180, desc: '三级妖兽内丹，相当于筑基中期。', glyph: '核', stack: true },
  { id: 'mat_yaodan4', name: '四级妖丹', type: 'material', tier: 2, price: 450, desc: '四级妖兽内丹，相当于筑基后期。神风舟等法器的辅材。', glyph: '核', stack: true },
  { id: 'mat_yaodan5', name: '五级妖丹', type: 'material', tier: 2, price: 1200, desc: '五级妖兽内丹，相当于结丹初期。降尘丹、凝元丹的辅药。', glyph: '核', stack: true },
  { id: 'mat_yaodan6', name: '六级妖丹', type: 'material', tier: 3, price: 3500, desc: '六级妖兽内丹，相当于结丹中期，可炼三焰扇等法宝。', glyph: '核', stack: true },
  { id: 'mat_yaodan7', name: '七级妖丹', type: 'material', tier: 3, price: 8000, desc: '七级妖兽内丹，相当于结丹后期。七级妖兽已可渡化形雷劫。', glyph: '核', stack: true },
  { id: 'mat_yaodan8', name: '八级妖丹', type: 'material', tier: 4, price: 26000, desc: '已化形的八级大妖内丹，相当于元婴初期，人界罕见。', glyph: '核', stack: true },
  { id: 'mat_yaodan9', name: '九级妖丹', type: 'material', tier: 4, price: 50000, desc: '九级妖修内丹，相当于元婴中期，可炼风雷翅。', glyph: '核', stack: true },
  { id: 'mat_yaodan10', name: '十级妖丹', type: 'material', tier: 5, price: 160000, desc: '十级妖王内丹，相当于元婴后期，人界妖族之巅。', glyph: '核', stack: true },
  // 妖兽材料（第十五步）
  { id: 'mat_shuangtongmu', name: '双瞳鼠目', type: 'material', tier: 1, price: 120, desc: '双瞳鼠天生神目，可看穿障碍。入丹可温养神识。', glyph: '目', stack: true },
  { id: 'mat_zhijiao', name: '炙角', type: 'material', tier: 1, price: 60, desc: '炙角鹿的火红独角，内蕴火气，炼器时可助火。', glyph: '角', stack: true },
  { id: 'mat_yunchiyu', name: '云翅鸟羽', type: 'material', tier: 1, price: 50, desc: '云翅鸟以快著称，其羽轻灵，可炼踏云靴一类身法法器。', glyph: '羽', stack: true },
  { id: 'mat_mojiaoqi', name: '墨蛟鳍', type: 'material', tier: 2, price: 600, desc: '墨蛟背鳍。韩立当年便以此炼成神风舟。', glyph: '鳍', stack: true },
  { id: 'mat_mojiaozhao', name: '墨蛟爪', type: 'material', tier: 2, price: 500, desc: '墨蛟利爪，乌光内敛，可炼乌龙夺。', glyph: '爪', stack: true },
  { id: 'mat_yinzhima', name: '阴芝马血肉', type: 'material', tier: 3, price: 6000, desc: '阴芝马身长不过半尺，擅隐匿。其血肉是培婴丹的主药。', glyph: '肉', stack: true },
  { id: 'mat_qianmuyan', name: '千目妖眼', type: 'material', tier: 2, price: 1500, desc: '千目妖的碧绿眼珠，可炼照妖窥幻的宝镜。', glyph: '目', stack: true },
  // 第十九步：原著名地妖物材料
  { id: 'mat_huochan', name: '火蟾晶', type: 'material', tier: 3, price: 2400, desc: '坠魔谷火蟾兽背上的熔岩疣凝成的晶石，内封地火，是炼制火属法宝的上佳辅材。', glyph: '晶', stack: true },
  { id: 'mat_mangpi', name: '蟒兽皮', type: 'material', tier: 3, price: 1800, desc: '坠魔谷蟒兽的墨绿厚皮，柔韧异常，可制护身法衣。', glyph: '皮', stack: true },
  // —— 第三十九步：新妖兽材料
  { id: 'mat_yingfen', name: '火萤磷粉', type: 'material', tier: 1, price: 40, desc: '赤磷火萤腹下刮下的红色磷粉，见风即燃，制火符的上好辅料。', glyph: '粉', stack: true },
  { id: 'mat_xijiao', name: '铁背犀角', type: 'material', tier: 2, price: 320, desc: '铁背犀的乌金独角，坚逾精铁，炼制攻伐法器时掺上一点，锋锐倍增。', glyph: '角', stack: true },
  { id: 'mat_xuanjialin', name: '玄甲鳞', type: 'material', tier: 2, price: 360, desc: '玄甲穿山甲的黑金鳞片，刀剑难伤，可炼护身甲胄。', glyph: '鳞', stack: true },
  { id: 'mat_leijiao', name: '雷角', type: 'material', tier: 3, price: 1400, desc: '雷角羚的晶角，内里封着一缕不散的雷意，雷属性法器的主材之一。', glyph: '角', stack: true },
  { id: 'mat_xialing', name: '霞雀翎', type: 'material', tier: 4, price: 5200, desc: '五彩霞雀尾上的长翎，五色流转如霞，炼制幻术与遁术法宝的珍材。', glyph: '翎', stack: true },
  { id: 'mat_molinjiao', name: '墨麟角', type: 'material', tier: 4, price: 9000, desc: '墨麟兽额上的独角，乌黑如墨、隐有银焰，结丹修士争抢的炼器奇材。', glyph: '角', stack: true },
  { id: 'mat_heilin', name: '黑鳞蟒鳞', type: 'material', tier: 1, price: 90, desc: '血色禁地黑鳞蟒的鳞片。据说墨蛟便是黑鳞蟒蜕变而成。', glyph: '鳞', stack: true },
  { id: 'mat_shisha', name: '尸煞晶', type: 'material', tier: 3, price: 3200, desc: '昆吾山炼尸体内凝结的尸煞，阴寒刺骨，魔道炼尸、鬼道祭器皆用得上。', glyph: '煞', stack: true },
  { id: 'mat_yinchi', name: '银翅', type: 'material', tier: 4, price: 26000, desc: '银翅夜叉的一片银翅，坚逾精金，薄如蝉翼——炼制飞遁法宝的绝顶灵材。', glyph: '翅', stack: true },
  { id: 'mat_xueyan', name: '血焰精魄', type: 'material', tier: 4, price: 40000, desc: '古魔血焰被打散后残留的一缕精魄，血光在晶中缓缓流转，魔气森然。', glyph: '魄', stack: true },
  { id: 'mat_yuanhun', name: '冤魂珠', type: 'material', tier: 3, price: 2600, desc: '虚天殿鬼冤之地的冤魂凝成的灰珠，鬼道修士视若珍宝。', glyph: '珠', stack: true },
  { id: 'mat_chihuolin', name: '赤火蛟鳞', type: 'material', tier: 3, price: 3000, desc: '火属蛟龙赤火蛟的鳞片，是炼制三焰扇的主材。', glyph: '鳞', stack: true },
  { id: 'mat_qingfengjiao', name: '青风牛角', type: 'material', tier: 3, price: 6000, desc: '七级青风牛的牛角，风属灵材。天澜圣殿以之铸圣兽之体。', glyph: '角', stack: true },
  { id: 'mat_bingjialin', name: '冰甲蟒鳞', type: 'material', tier: 3, price: 6000, desc: '七级冰甲蟒的雪白鳞甲，寒气逼人。', glyph: '鳞', stack: true },
  { id: 'mat_tujiapi', name: '土甲龙皮', type: 'material', tier: 4, price: 18000, desc: '土甲龙以防御著称，其土黄厚皮刀剑难伤，是炼制护身法宝的上材。', glyph: '甲', stack: true },
  { id: 'mat_jinjiaolin', name: '金蛟鳞', type: 'material', tier: 5, price: 60000, desc: '九级金蛟王的金色逆鳞，坚逾精金，可炼护身宝甲或剑胚。', glyph: '鳞', stack: true },
  { id: 'mat_bingfengyu', name: '冰凤羽', type: 'material', tier: 5, price: 150000, desc: '十级冰凤的翎羽，寒气凝而不散。原著中可炼制冰属至宝。', glyph: '羽', stack: true },
  { id: 'mat_dujiaolin', name: '毒蛟鳞', type: 'material', tier: 4, price: 22000, desc: '八级毒蛟的鲜红鳞片，剧毒，可炼鳞甲。', glyph: '鳞', stack: true },
  { id: 'mat_shuanggongdu', name: '霜蚣寒毒', type: 'material', tier: 4, price: 30000, desc: '六翼霜蚣的毒液，奇寒无比，能冻彻元神——却是酿制碧焰酒的主料。', glyph: '毒', stack: true },
  { id: 'mat_leipenggu', name: '雷鹏骨翅', type: 'material', tier: 5, price: 120000, desc: '风希自深海古修士遗址中得来的上古雷鹏残骨，骨翅中仍含惊人雷电之力。以辟邪神雷炼化，可成风雷翅。', glyph: '翅', stack: true },
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
  // ---------- 主线信物 ----------
  { id: 'item_bottle', name: '掌天瓶', type: 'misc', tier: 6, price: 0, desc: '溪谷中拾得的墨绿小瓶，瓶身刻满细密叶纹。夜里吸纳星光，约二十日凝出一滴绿液；绿液滴在灵药上，药龄暴涨百年。此事万万不可为外人所知。', glyph: '瓶' },
  { id: 'item_moletter', name: '墨大夫遗书', type: 'misc', tier: 1, price: 0, desc: '墨居仁留下的书信：嘉元城墨府有暖阳宝玉一块，可解你体内寒毒。信末附着墨府地址，与一句“照拂吾家妻女”。', glyph: '书' },
  { id: 'tok_danuoyi', name: '大挪移令', type: 'misc', tier: 4, price: 0, desc: '巴掌大的古朴令牌，上刻“大挪移”三字。上古传送阵的钥匙——没有它，古阵便是一堆死物。制法早已失传，今人最远不过百余里的传送。', glyph: '令' },
  { id: 'item_nuanyang', name: '暖阳宝玉', type: 'misc', tier: 2, price: 0, desc: '触手生温的古玉，佩在身上，寒毒渐渐拔除。', glyph: '玉' },
  { id: 'item_qinpu', name: '秦家族谱', type: 'misc', tier: 0, price: 0, desc: '金光上人身上搜出的旧族谱。原来他本姓秦，出身秦叶岭秦家，当年卷走升仙令与一张符宝出逃，一躲就是十几年。', glyph: '谱' },
  { id: 'item_qingxi', name: '清溪笔录', type: 'misc', tier: 0, price: 0, desc: '太南小会上一个憨厚少年送的小册子，记载修仙界常识：七派、灵根、升仙令、筑基丹……', glyph: '录' },
  { id: 'tal_fubao', name: '飞剑符宝', type: 'talisman', tier: 3, price: 3000, desc: '金光上人的保命符宝，符纸上封着一口小剑，激发后化作丈许金芒斩落。灵力所剩无几，只能再用几次。', glyph: '符', tal: { kind: 'fubao', power: 9, color: '#ffd870' }, stack: true },
  { id: 'item_shengxian', name: '升仙令', type: 'misc', tier: 2, price: 0, desc: '黄枫谷等七派发放的入门信物，持之可直接拜入黄枫谷。原著中韩立便是凭升仙令入的黄枫谷。', glyph: '令' },
  // ---------- 第十八步：机缘与灵宠 ----------
  { id: 'tal_pojin', name: '破禁符', type: 'material', tier: 1, price: 220, desc: '专破古修洞府禁制的符箓，一张可破一重禁制，比强破稳妥得多。（在遗府前使用）', glyph: '禁', stack: true },
  { id: 'tal_huifu', name: '回府符', type: 'material', tier: 1, price: 160, desc: '与洞府阵眼相连的传送符，捏碎即可遁回同一地域内的洞府。（按 Y）', glyph: '府', stack: true },
  { id: 'mat_gubaocan', name: '古宝残片', type: 'material', tier: 3, price: 2400, desc: '上古修士遗落的古宝碎片，灵性未泯。集齐五片可在洞府中重炼为一件古宝。', glyph: '残', stack: true },
  { id: 'egg_yunchi', name: '云翅鸟卵', type: 'misc', tier: 2, price: 900, desc: '一级妖禽云翅鸟之卵。孵出的云翅鸟目力极佳，能替主人在神识之外发现机缘。（自动温养）', glyph: '卵', stack: true },
  { id: 'egg_huli', name: '灵狐幼崽', type: 'misc', tier: 2, price: 1600, desc: '尚在襁褓里的灵狐，鼻子灵得出奇，嗅得出地底的灵药与宝物。（自动温养）', glyph: '狐', stack: true },
  { id: 'egg_wolf', name: '灵狼幼崽', type: 'misc', tier: 3, price: 2600, desc: '狼崽眼神凶悍，长成后扑咬凌厉，是护主的好手。（自动温养）', glyph: '狼', stack: true },
  { id: 'egg_jiao', name: '蛟卵', type: 'misc', tier: 4, price: 9000, desc: '墨蛟之卵，温养极慢，孵出后水火之术俱强。（自动温养）', glyph: '蛟', stack: true },
  { id: 'egg_shijin', name: '噬金虫卵', type: 'misc', tier: 5, price: 36000, desc: '奇虫榜排名第三的噬金虫之卵。原著中韩立倚之横行一方——能吞噬法宝，几乎无物可挡。（自动温养）', glyph: '虫', stack: true },
  { id: 'item_tihun', name: '啼魂幼兽', type: 'misc', tier: 5, price: 0, desc: '专吞魂魄的上古异兽幼崽，蜷在掌心像只小猫。带在身边，便可学会召唤它的《啼魂兽》。', glyph: '兽', stack: true },
  { id: 'gift_fan', name: '题诗团扇', type: 'misc', tier: 1, price: 0, desc: '她亲手题了半阙诗的团扇，墨香犹在。', glyph: '扇' },
  { id: 'gift_hairpin', name: '青玉发簪', type: 'misc', tier: 2, price: 0, desc: '她鬓边常戴的那支发簪，如今在你手里。', glyph: '簪' },
  { id: 'gift_sachet', name: '同心香囊', type: 'misc', tier: 3, price: 0, desc: '绣着并蒂莲的香囊，里面封着她的一缕青丝。', glyph: '囊' },
  { id: 'art_jinfu', name: '金蚨子母刃', type: 'artifact', tier: 2, price: 2600, desc: '一母九子的成套飞刃，母刃一出，子刃随行，原著中韩立早年倚仗的法器之一。', glyph: '刃', art: { kind: 'needle', reqRealm: 1, sense: 6, pieces: 10, power: 0.5, mp: 2, cd: 1.2, element: 'gold', color: '#ffd878' } },
  { id: 'art_fuguang', name: '符宝·伏光剑', type: 'artifact', tier: 3, price: 5200, desc: '结丹修士将本命法宝之力封入符纸而成的符宝，可驱使数十次，威力远胜寻常法器。', glyph: '符', art: { kind: 'arrow', reqRealm: 1, sense: 20, pieces: 1, power: 6, mp: 20, cd: 5, element: 'gold', color: '#e6f0ff' } },
  // —— 第十三步：原著中韩立炼气期的几件法器
  { id: 'art_jinguangzhuan', name: '金光砖', type: 'artifact', tier: 1, price: 900, desc: '方方正正的砖形法器，祭出后迎风暴涨、金光大放，自天砸落，势大力沉。原著中韩立炼气期的得力法器之一。', glyph: '砖', art: { kind: 'slam', reqRealm: 1, sense: 14, pieces: 1, power: 3.4, mp: 12, cd: 4, element: 'gold', color: '#e8c050' } },
  { id: 'art_xuantie', name: '玄铁飞天盾', type: 'artifact', tier: 1, price: 750, desc: '玄铁打造的盾形法器，祭出后悬于身侧，自行迎挡来袭之敌。原著中韩立在血色禁地前后所用。', glyph: '盾', art: { kind: 'shield', reqRealm: 1, sense: 12, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.7, color: '#4a4e58' } },
  { id: 'art_tayun', name: '踏云靴', type: 'artifact', tier: 1, price: 850, desc: '靴帮绣着云纹的法器，催动后足下生云，脚程大增（陆行速度+25%）。原著中韩立斩杀封岳所得。', glyph: '靴', art: { kind: 'boots', reqRealm: 1, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.25, color: '#5a5048' } },
  { id: 'tal_tianleizi', name: '天雷子', type: 'talisman', tier: 2, price: 450, desc: '以雷属性灵材炼成的一次性雷珠，掷出后轰然炸开，雷光四溢，对魔物尤甚。韩立早年屡屡凭它反败为胜。', glyph: '雷', tal: { kind: 'bomb', power: 7.5, color: '#a8b8ff' }, stack: true },
  { id: 'art_qingfeng', name: '青锋剑', type: 'artifact', tier: 0, price: 120, desc: '最普通的飞剑法器。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 10, pieces: 1, power: 1.0, mp: 2, cd: 1.1, color: '#9ab8a8' } },
  { id: 'art_yinhui', name: '银辉剑', type: 'artifact', tier: 1, price: 600, desc: '上品飞剑法器，银光凛凛。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 12, pieces: 1, power: 1.5, mp: 3, cd: 1.0, color: '#d8e0e8' } },
  { id: 'art_wulong', name: '乌龙夺', type: 'artifact', tier: 1, price: 500, desc: '乌光如龙，专破护体灵光。', glyph: '器', art: { kind: 'arrow', reqRealm: 1, sense: 12, pieces: 1, power: 3.2, mp: 8, cd: 3.2, color: '#404850' } },
  { id: 'art_hongxian', name: '红线遁光针', type: 'artifact', tier: 2, price: 3000, desc: '十三枚一套，无影无踪，修仙界有名的阴器。神识越强能同时驱使越多。', glyph: '针', art: { kind: 'needle', reqRealm: 1, sense: 4, pieces: 13, power: 0.55, mp: 1, cd: 0.9, color: '#e05050' } },
  { id: 'art_guike', name: '龟壳盾', type: 'artifact', tier: 1, price: 450, desc: '防御法器，抵挡伤害。', glyph: '盾', art: { kind: 'shield', reqRealm: 1, sense: 10, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.6, color: '#7a8a5a' } },
  { id: 'art_qingjiao', name: '青蛟旗', type: 'artifact', tier: 2, price: 1500, desc: '旗中封有蛟魂，可召出青蛟助战。', glyph: '旗', art: { kind: 'banner', reqRealm: 1, sense: 18, pieces: 1, power: 0.9, mp: 15, cd: 9, color: '#3aa080' } },
  { id: 'art_qingning', name: '青凝镜', type: 'artifact', tier: 1, price: 700, desc: '射出青色光柱。', glyph: '镜', art: { kind: 'mirror', reqRealm: 1, sense: 12, pieces: 1, power: 2.0, mp: 6, cd: 2.6, color: '#70c0b0' } },
  { id: 'art_shenfeng', name: '神风舟', type: 'artifact', tier: 2, price: 2500, desc: '墨蛟鳍所制的飞行法器，炼气期也可驾驭飞渡：祭出后按 F 乘舟而起，飞行速度+40%，可渡海。', glyph: '舟', art: { kind: 'flight', reqRealm: 1, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.4, color: '#a0c8e0' } },
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
  { id: 'art_fenglei', name: '风雷翅', type: 'artifact', tier: 5, price: 150000, desc: '九级妖修风希以十级雷鹏骨翅炼制、韩立以辟邪神雷认主的飞行法宝，可施展雷遁，瞬息千里。身法化为雷遁，大地图速度x1.8。', glyph: '翅', art: { kind: 'wings', reqRealm: 3, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.8, element: 'thunder', color: '#80b0ff' } },
  { id: 'art_sanshen', name: '三神白骨幡', type: 'artifact', tier: 5, price: 90000, desc: '六道极圣的魔幡，召出白骨魔神。', glyph: '幡', art: { kind: 'banner', reqRealm: 4, sense: 120, pieces: 1, power: 2.4, mp: 60, cd: 10, element: 'yin', color: '#e0e0d0' } },
  { id: 'art_guiluo', name: '鬼罗幡', type: 'artifact', tier: 4, price: 60000, desc: '阴罗宗镇宗之宝，以生魂祭炼，召出厉鬼。', glyph: '幡', art: { kind: 'banner', reqRealm: 3, sense: 60, pieces: 1, power: 1.6, mp: 30, cd: 8, element: 'yin', color: '#506070' } },
  { id: 'art_tiandu', name: '天都尸火', type: 'artifact', tier: 4, price: 50000, desc: '极阴祖师成名神通，阴火所过，生机断绝。', glyph: '火', art: { kind: 'flame', reqRealm: 4, sense: 80, pieces: 1, power: 2.2, mp: 6, cd: 0.25, element: 'yin', color: '#60ff90' } },
  { id: 'art_qianlan', name: '乾蓝冰焰', type: 'artifact', tier: 5, price: 120000, desc: '虚天鼎中封印的奇寒之焰，冰封万物。', glyph: '焰', art: { kind: 'flame', reqRealm: 3, sense: 70, pieces: 1, power: 2.8, mp: 6, cd: 0.25, element: 'ice', color: '#60c0ff' } },
  { id: 'art_sanyan', name: '三焰扇', type: 'artifact', tier: 5, price: 160000, desc: '仿七焰扇炼制的仿通天灵宝，三色火焰焚尽一切。', glyph: '扇', art: { kind: 'flame', reqRealm: 4, sense: 150, pieces: 1, power: 5, mp: 12, cd: 0.25, element: 'fire', color: '#ff8030' } },
  { id: 'art_yuanci', name: '元磁神山', type: 'artifact', tier: 5, price: 200000, desc: '以元磁神光炼化的神山，砸落时天崩地裂。', glyph: '山', art: { kind: 'slam', reqRealm: 4, sense: 160, pieces: 1, power: 14, mp: 80, cd: 6, element: 'earth', color: '#8a7050' } },
  { id: 'art_wuzi', name: '五子同心魔', type: 'artifact', tier: 5, price: 220000, desc: '乾老魔之宝，五只魔头皆有元婴之力。', glyph: '魔', art: { kind: 'banner', reqRealm: 4, sense: 180, pieces: 1, power: 3.2, mp: 80, cd: 12, element: 'yin', color: '#902040' } },
  { id: 'art_xutian', name: '虚天鼎', type: 'artifact', tier: 6, price: 999999, desc: '乱星海第一至宝，通天灵宝。放出青丝困敌，收入鼎中炼化。对残血敌人有奇效。', glyph: '鼎', art: { kind: 'cauldron', reqRealm: 4, sense: 300, pieces: 1, power: 10, mp: 300, cd: 18, color: '#40d0c0' } },
  // 第三十五步：原著法宝 / 灵宝
  { id: 'art_huangluosan', name: '黄罗伞', type: 'artifact', tier: 2, price: 2400, desc: '伞面绣满符纹的护身法器，撑开后黄光如幕，挡下来袭的法术与飞剑。', glyph: '伞', art: { kind: 'shield', reqRealm: 1, sense: 14, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.7, color: '#d8b040' } },
  { id: 'art_wuxingzhen', name: '无形针', type: 'artifact', tier: 2, price: 3200, desc: '七枚一套的阴毒细针，几乎无形无影，专取神识薄弱之辈的要害。', glyph: '针', art: { kind: 'needle', reqRealm: 1, sense: 5, pieces: 7, power: 0.6, mp: 1, cd: 0.9, color: '#d8e4ec' } },
  { id: 'art_xuehongling', name: '雪虹绫', type: 'artifact', tier: 3, price: 6200, desc: '一匹雪白长绫，祭出后如长虹贯空，缠住敌人片刻动弹不得。', glyph: '绫', art: { kind: 'bind', reqRealm: 2, sense: 22, pieces: 1, power: 1.3, mp: 14, cd: 7, element: 'ice', color: '#f0e8f8' } },
  { id: 'art_yueyang', name: '月阳宝珠', type: 'artifact', tier: 3, price: 6800, desc: '一阴一阳两色宝珠，射出的光柱炽烈如日。', glyph: '珠', art: { kind: 'mirror', reqRealm: 2, sense: 22, pieces: 1, power: 2.6, mp: 8, cd: 2.6, element: 'fire', color: '#ffe0a0' } },
  { id: 'art_juhunbo', name: '聚魂钵', type: 'artifact', tier: 3, price: 7200, desc: '鬼灵门以生魂祭炼的魔钵，钵声一响，近身之敌神魂动摇。', glyph: '钵', art: { kind: 'bell', reqRealm: 2, sense: 26, pieces: 1, power: 1.8, mp: 18, cd: 8, element: 'yin', color: '#6a8070' } },
  { id: 'art_fengyunfan', name: '风云幡', type: 'artifact', tier: 3, price: 7800, desc: '幡面绘有风云纹，摇动时狂风骤起，召出风灵助战。', glyph: '幡', art: { kind: 'banner', reqRealm: 2, sense: 26, pieces: 1, power: 1.0, mp: 18, cd: 9, color: '#80b0c0' } },
  { id: 'art_qingmingzhen', name: '青冥针', type: 'artifact', tier: 3, price: 7400, desc: '九枚青光细针，结丹修士亦颇为忌惮的成名法宝。', glyph: '针', art: { kind: 'needle', reqRealm: 2, sense: 5, pieces: 9, power: 0.8, mp: 1, cd: 0.8, color: '#60d0c0' } },
  { id: 'art_xuanhuangjing', name: '玄黄镜', type: 'artifact', tier: 3, price: 8200, desc: '玄黄二气凝成的宝镜，照出的光柱可破护体灵光。', glyph: '镜', art: { kind: 'mirror', reqRealm: 2, sense: 26, pieces: 1, power: 3.0, mp: 10, cd: 2.8, element: 'earth', color: '#d0b060' } },
  { id: 'art_guanrijian', name: '贯日剑', type: 'artifact', tier: 3, price: 8800, desc: '剑光如烈日横空，飞剑法宝中的上品。', glyph: '剑', art: { kind: 'sword', reqRealm: 2, sense: 24, pieces: 1, power: 2.4, mp: 5, cd: 1.0, element: 'fire', color: '#ffd070' } },
  { id: 'art_liangyihuan', name: '两仪环', type: 'artifact', tier: 3, price: 9000, desc: '黑白双环相生相克，旋转间攻守兼备。', glyph: '环', art: { kind: 'ring', reqRealm: 2, sense: 30, pieces: 1, power: 2.2, mp: 9, cd: 3.4, color: '#e8e8e8' } },
  { id: 'art_yufengche', name: '御风车', type: 'artifact', tier: 3, price: 7000, desc: '百巧院所制的飞行法器，乘之御风而行，飞行速度+50%。', glyph: '车', art: { kind: 'flight', reqRealm: 2, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.5, color: '#b8c8a0' } },
  // —— 第三十九步：炼气 · 筑基 · 结丹的大路法器 / 法宝（多为原创，坊市与路人身上都能见到）
  { id: 'art_chitong', name: '赤铜剑', type: 'artifact', tier: 0, price: 160, desc: '赤铜掺火精铁打成的飞剑，剑身微烫，斩中时偶有火星迸溅。炼气弟子的第二口剑。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 10, pieces: 1, power: 1.1, mp: 2, cd: 1.1, element: 'fire', color: '#d8784a' } },
  { id: 'art_taomu', name: '雷击桃木剑', type: 'artifact', tier: 0, price: 220, desc: '百年雷击桃木削成，木纹里还残着一丝雷意，斩鬼物格外顺手。', glyph: '剑', art: { kind: 'sword', reqRealm: 1, sense: 10, pieces: 1, power: 0.95, mp: 2, cd: 1.0, element: 'thunder', color: '#c89060' } },
  { id: 'art_feihuang', name: '飞蝗石', type: 'artifact', tier: 0, price: 140, desc: '一兜乌亮的铁胆石，灌入法力后呼啸而出。凡俗暗器的修仙版，胜在便宜。', glyph: '石', art: { kind: 'arrow', reqRealm: 1, sense: 8, pieces: 1, power: 1.9, mp: 4, cd: 1.8, element: 'earth', color: '#5a5a60' } },
  { id: 'art_huolongbiao', name: '火龙镖', type: 'artifact', tier: 1, price: 520, desc: '镖身盘着一条赤铜小龙，掷出后化作一道火线，中者衣衫尽燃。', glyph: '镖', art: { kind: 'arrow', reqRealm: 1, sense: 12, pieces: 1, power: 3.0, mp: 8, cd: 3.0, element: 'fire', color: '#ff7040' } },
  { id: 'art_bingpo', name: '冰魄刀', type: 'artifact', tier: 1, price: 640, desc: '寒潭冰魄嵌在刀脊，飞斩之处霜花蔓延。', glyph: '刀', art: { kind: 'sword', reqRealm: 1, sense: 12, pieces: 1, power: 1.5, mp: 3, cd: 1.1, element: 'ice', color: '#a8e0ff' } },
  { id: 'art_leiyin', name: '雷音珠', type: 'artifact', tier: 1, price: 760, desc: '鸽蛋大的紫珠，内封一缕雷音。祭出后滚滚而去，雷声隆隆，碾过一路敌人。', glyph: '珠', art: { kind: 'ring', reqRealm: 1, sense: 14, pieces: 1, power: 1.7, mp: 8, cd: 3.4, element: 'thunder', color: '#a090ff' } },
  { id: 'art_liujiao', name: '六角冰盾', type: 'artifact', tier: 1, price: 600, desc: '六角形的冰晶小盾，悬在身前缓缓旋转，挡下的法术多半被冻成碎冰。', glyph: '盾', art: { kind: 'shield', reqRealm: 1, sense: 12, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.65, color: '#b8e8ff' } },
  { id: 'art_lingshe', name: '灵蛇索', type: 'artifact', tier: 1, price: 680, desc: '青蛇皮绞成的长索，祭出后如活蛇般游走，一缠一个准。', glyph: '索', art: { kind: 'bind', reqRealm: 1, sense: 14, pieces: 1, power: 0.9, mp: 10, cd: 7, element: 'wood', color: '#6ab070' } },
  { id: 'art_shehun', name: '摄魂铃', type: 'artifact', tier: 1, price: 720, desc: '青铜小铃，一摇之下铃音直钻识海，神识弱的人当场就呆住了。', glyph: '铃', art: { kind: 'bell', reqRealm: 1, sense: 16, pieces: 1, power: 1.2, mp: 12, cd: 8, element: 'yin', color: '#8a9a7a' } },
  { id: 'art_zhaoyao', name: '照妖镜', type: 'artifact', tier: 1, price: 820, desc: '巴掌大的铜镜，镜面打磨得纤毫毕现，照出一道金光专破妖邪护体。', glyph: '镜', art: { kind: 'mirror', reqRealm: 1, sense: 12, pieces: 1, power: 2.2, mp: 7, cd: 2.6, element: 'gold', color: '#f0d070' } },
  { id: 'art_ruanwei', name: '软猬甲', type: 'artifact', tier: 1, price: 900, desc: '刺猬妖兽的软刺编成的内甲，贴身穿着毫无分量，却能卸去三成力道。', glyph: '甲', art: { kind: 'armor', reqRealm: 1, sense: 10, pieces: 1, power: 0, mp: 0, cd: 0, def: 0.15, color: '#8a7a6a' } },
  { id: 'art_qingyunxue', name: '青云履', type: 'artifact', tier: 1, price: 750, desc: '鞋底绣着云纹符阵，穿上后步履轻快，翻山越岭快上几分。', glyph: '靴', art: { kind: 'boots', reqRealm: 1, sense: 6, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.15, color: '#7a9ab0' } },
  { id: 'art_chiyan', name: '赤炎剑', type: 'artifact', tier: 2, price: 2200, desc: '剑胚在地火里淬了七七四十九日，出鞘便是一道赤红火光。筑基修士最常见的上品飞剑。', glyph: '剑', art: { kind: 'sword', reqRealm: 2, sense: 18, pieces: 1, power: 2.0, mp: 4, cd: 1.0, element: 'fire', color: '#ff6a3a' } },
  { id: 'art_qixing', name: '七星针', type: 'artifact', tier: 2, price: 2800, desc: '七根银针按北斗排布，一出手就是七道寒星，神识足的人能让它们各自寻敌。', glyph: '针', art: { kind: 'needle', reqRealm: 2, sense: 5, pieces: 7, power: 0.7, mp: 1, cd: 0.9, element: 'ice', color: '#d0e8ff' } },
  { id: 'art_hanjiang', name: '寒江锁', type: 'artifact', tier: 2, price: 2600, desc: '一截千年寒铁锁链，锁上的人连法力都要冻住三分。', glyph: '锁', art: { kind: 'bind', reqRealm: 2, sense: 18, pieces: 1, power: 1.2, mp: 12, cd: 7, element: 'ice', color: '#90b8d8' } },
  { id: 'art_heisha', name: '黑煞旗', type: 'artifact', tier: 2, price: 2400, desc: '魔道外门炼制的小旗，旗中养着一头煞气凝成的黑蛟。正道修士见了多半要皱眉。', glyph: '旗', art: { kind: 'banner', reqRealm: 2, sense: 18, pieces: 1, power: 0.95, mp: 15, cd: 9, element: 'yin', color: '#3a3040' } },
  { id: 'art_zijinbo', name: '紫金钵', type: 'artifact', tier: 2, price: 3000, desc: '佛门俗家弟子供奉的紫金钵盂，倒扣而下金光如雨，砸得方圆一片人仰马翻。', glyph: '钵', art: { kind: 'cauldron', reqRealm: 2, sense: 22, pieces: 1, power: 2.2, mp: 16, cd: 6, element: 'gold', color: '#c8a050' } },
  { id: 'art_lieyan', name: '烈焰扇', type: 'artifact', tier: 2, price: 2900, desc: '扇面绘着九只火鸦，一扇之下烈焰卷地而去。火灵根修士爱不释手。', glyph: '扇', art: { kind: 'flame', reqRealm: 2, sense: 20, pieces: 1, power: 1.6, mp: 10, cd: 4, element: 'fire', color: '#ff7a30' } },
  { id: 'art_xuangui', name: '玄龟甲', type: 'artifact', tier: 2, price: 3400, desc: '筑基期玄龟的背甲炼成的护身宝甲，龟纹里流转着土黄灵光。', glyph: '甲', art: { kind: 'armor', reqRealm: 2, sense: 18, pieces: 1, power: 0, mp: 0, cd: 0, def: 0.25, color: '#7a6a40' } },
  { id: 'art_feisuo', name: '流云梭', type: 'artifact', tier: 2, price: 2300, desc: '两头尖尖的白玉飞梭，注入法力后托人疾飞，虽不及神风舟稳当，却快上一截。', glyph: '梭', art: { kind: 'flight', reqRealm: 2, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.45, color: '#e0e8f0' } },
  { id: 'art_gengjin', name: '庚金剑匣', type: 'artifact', tier: 3, price: 9800, desc: '一只乌木剑匣里藏着三口庚金小剑，匣开剑出，金芒交织成网。结丹散修梦寐以求的成套飞剑。', glyph: '剑', art: { kind: 'sword', reqRealm: 3, sense: 22, pieces: 3, power: 2.6, mp: 6, cd: 1.0, element: 'gold', color: '#f0e0a0' } },
  { id: 'art_wulei', name: '五雷珠', type: 'artifact', tier: 3, price: 10500, desc: '五颗雷珠串成一圈，祭出后化作雷光滚轮，所过之处电蛇乱窜。', glyph: '珠', art: { kind: 'ring', reqRealm: 3, sense: 30, pieces: 1, power: 2.6, mp: 10, cd: 3.2, element: 'thunder', color: '#c0b0ff' } },
  { id: 'art_xuanbingjing', name: '玄冰镜', type: 'artifact', tier: 3, price: 9600, desc: '北地玄冰磨成的宝镜，照出一道惨白寒光，被照者连人带衣冻作冰雕。', glyph: '镜', art: { kind: 'mirror', reqRealm: 3, sense: 28, pieces: 1, power: 3.2, mp: 10, cd: 2.8, element: 'ice', color: '#c8f0ff' } },
  { id: 'art_tianluo', name: '天罗网', type: 'artifact', tier: 3, price: 11000, desc: '以冰蚕丝与金线织成的大网，一撒便罩住一片，困住结丹修士也要挣扎好一阵。', glyph: '网', art: { kind: 'bind', reqRealm: 3, sense: 30, pieces: 1, power: 1.6, mp: 18, cd: 7, element: 'gold', color: '#e8d8a0' } },
  { id: 'art_zhenyue', name: '镇岳印', type: 'artifact', tier: 3, price: 12500, desc: '一方山形大印，祭出后迎风化作小山压下，砸实了地面都要塌下去一截。', glyph: '印', art: { kind: 'slam', reqRealm: 3, sense: 34, pieces: 1, power: 6.4, mp: 24, cd: 5, element: 'earth', color: '#a08860' } },
  { id: 'art_xuehun', name: '血魂幡', type: 'artifact', tier: 3, price: 11500, desc: '魔道修士以生魂祭炼的小幡，召出的血蛟凶戾无比——每次催动都要喂它一口精血。', glyph: '幡', art: { kind: 'banner', reqRealm: 3, sense: 28, pieces: 1, power: 1.25, mp: 16, cd: 9, element: 'blood', hpCost: 0.04, color: '#a02030' } },
  { id: 'art_qianchongfeng', name: '千重峰', type: 'artifact', tier: 4, price: 16000, desc: '一座小山形法宝，祭出后化作千重山峦压顶而下。', glyph: '峰', art: { kind: 'slam', reqRealm: 3, sense: 40, pieces: 1, power: 8.5, mp: 28, cd: 5.5, element: 'earth', color: '#7a6a50' } },
  { id: 'art_xueleizi', name: '血雷子', type: 'artifact', tier: 4, price: 18000, desc: '魔道秘制的血色雷珠，一击炸开血雷，护体灵光也挡不住。', glyph: '雷', art: { kind: 'arrow', reqRealm: 3, sense: 34, pieces: 1, power: 7.5, mp: 22, cd: 4.5, element: 'blood', color: '#e03040' } },
  { id: 'art_jingangzhao', name: '金刚罩', type: 'artifact', tier: 4, price: 20000, desc: '佛门护身至宝，金光罩体，坚逾精钢。', glyph: '罩', art: { kind: 'shield', reqRealm: 3, sense: 42, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 0.88, element: 'gold', color: '#e0c060' } },
  { id: 'art_luohunsha', name: '落魂沙', type: 'artifact', tier: 4, price: 19000, desc: '一捧灰黑魔沙，扬起后摄人魂魄，周身之敌失神片刻。', glyph: '沙', art: { kind: 'bell', reqRealm: 3, sense: 40, pieces: 1, power: 2.4, mp: 22, cd: 8, element: 'yin', color: '#a09070' } },
  { id: 'art_leihuogong', name: '雷火弓', type: 'artifact', tier: 4, price: 22000, desc: '以雷火之精炼成的宝弓，一箭射出，雷火交加。', glyph: '弓', art: { kind: 'arrow', reqRealm: 3, sense: 40, pieces: 1, power: 8.5, mp: 26, cd: 4.5, element: 'thunder', color: '#ffb040' } },
  { id: 'art_sifangxue', name: '四方飞天靴', type: 'artifact', tier: 4, price: 16000, desc: '靴底刻有四方风纹，陆行如飞（陆行速度+40%）。', glyph: '靴', art: { kind: 'boots', reqRealm: 3, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 1.4, color: '#8a7a5a' } },
  { id: 'art_molongren', name: '魔龙刃', type: 'artifact', tier: 4, price: 24000, desc: '刃身盘着一条魔龙，饮血越多越是凶戾。', glyph: '刃', art: { kind: 'sword', reqRealm: 3, sense: 40, pieces: 1, power: 4.6, mp: 4, cd: 1.0, element: 'blood', color: '#a02040' } },
  { id: 'art_pingtianchi', name: '平天尺', type: 'artifact', tier: 4, price: 21000, desc: '吕天蒙的成名宝物（符宝），一尺落下，平山断岳。', glyph: '尺', art: { kind: 'slam', reqRealm: 3, sense: 36, pieces: 1, power: 7.8, mp: 24, cd: 5, color: '#c8b080' } },
  { id: 'art_balingchi', name: '八灵尺', type: 'artifact', tier: 5, price: 180000, desc: '灵宝。尺上八道灵纹齐亮时，八方灵力尽归一尺。', glyph: '尺', art: { kind: 'slam', reqRealm: 4, sense: 150, pieces: 1, power: 13, mp: 70, cd: 6, element: 'gold', color: '#e0d0a0' } },
  { id: 'art_heifengqi', name: '黑风旗', type: 'artifact', tier: 5, price: 150000, desc: '灵宝。黑风滚滚，旗中封着上古风魔，一出便是遮天蔽日。', glyph: '旗', art: { kind: 'banner', reqRealm: 4, sense: 140, pieces: 1, power: 2.6, mp: 60, cd: 10, element: 'yin', color: '#303040' } },
  { id: 'art_zhenhaizhong', name: '镇海钟', type: 'artifact', tier: 5, price: 170000, desc: '灵宝。钟声如潮，可镇四海，元婴修士亦被震得神魂失守。', glyph: '钟', art: { kind: 'bell', reqRealm: 4, sense: 150, pieces: 1, power: 3.4, mp: 60, cd: 8, element: 'water', color: '#60a0c0' } },
  { id: 'art_tianajian', name: '天阿神剑', type: 'artifact', tier: 5, price: 190000, desc: '灵宝。剑气纵横三千丈，天南罕见的神剑。', glyph: '剑', art: { kind: 'sword', reqRealm: 4, sense: 150, pieces: 1, power: 7.5, mp: 8, cd: 1.0, element: 'gold', color: '#f0f0ff' } },
  // —— 第四十步：元婴修士的灵宝（雄城 / 名城拍卖会的压轴、大夺宝的彩头）——
  { id: 'art_zixiao', name: '紫霄雷剑', type: 'artifact', tier: 5, price: 160000, desc: '灵宝。剑身紫电缭绕，一剑落下雷光三千丈。', glyph: '剑', art: { kind: 'sword', reqRealm: 4, sense: 150, pieces: 1, power: 7.2, mp: 8, cd: 1.0, element: 'thunder', color: '#b8a0ff' } },
  { id: 'art_xuanming', name: '玄冥寒魄针', type: 'artifact', tier: 5, price: 150000, desc: '灵宝。二十四枚寒魄针，神识越强同时驱使越多，中者元神冻结。', glyph: '针', art: { kind: 'needle', reqRealm: 4, sense: 40, pieces: 24, power: 0.95, mp: 2, cd: 0.9, element: 'ice', color: '#a8e0ff' } },
  { id: 'art_jiuyanglu', name: '九阳焚天炉', type: 'artifact', tier: 5, price: 200000, desc: '灵宝。炉中九缕真阳之火，一倾而出便是一片火海。', glyph: '炉', art: { kind: 'flame', reqRealm: 4, sense: 150, pieces: 1, power: 4.4, mp: 40, cd: 5, element: 'fire', color: '#ff9a40' } },
  { id: 'art_shanheyin', name: '山河印', type: 'artifact', tier: 5, price: 170000, desc: '灵宝。印落如山河倾覆，结丹修士挨上一记便筋断骨折。', glyph: '印', art: { kind: 'slam', reqRealm: 4, sense: 150, pieces: 1, power: 14, mp: 70, cd: 6, element: 'earth', color: '#b89a60' } },
  { id: 'art_qiankunjing', name: '乾坤镜', type: 'artifact', tier: 5, price: 165000, desc: '灵宝。镜光一照，乾坤颠倒，护体灵光尽数剥落。', glyph: '镜', art: { kind: 'mirror', reqRealm: 4, sense: 150, pieces: 1, power: 5.6, mp: 40, cd: 3.5, element: 'gold', color: '#e8dcb0' } },
  { id: 'art_xuanwudun', name: '玄武宝盾', type: 'artifact', tier: 5, price: 150000, desc: '灵宝。龟甲纹路的宝盾，祭起时一道玄武虚影护住全身。', glyph: '盾', art: { kind: 'shield', reqRealm: 4, sense: 120, pieces: 1, power: 0, mp: 0, cd: 0, absorb: 1.3, color: '#5a7a6a' } },
  { id: 'art_longlinjia', name: '龙鳞宝甲', type: 'artifact', tier: 5, price: 155000, desc: '灵宝。以蛟龙逆鳞缀成，寻常法宝打上去只溅起一串火星。', glyph: '甲', art: { kind: 'armor', reqRealm: 4, sense: 120, pieces: 1, power: 0, mp: 0, cd: 0, def: 0.4, color: '#6a8a7a' } },
  { id: 'art_wanhunfan', name: '万魂幡', type: 'artifact', tier: 5, price: 180000, desc: '灵宝。幡中拘着万千生魂，一展便是阴风惨惨、鬼哭盈野。魔道至宝。', glyph: '幡', art: { kind: 'banner', reqRealm: 4, sense: 150, pieces: 1, power: 2.3, mp: 45, cd: 9, element: 'blood', color: '#7a2a40' } },
  { id: 'art_fulongsuo', name: '缚龙索', type: 'artifact', tier: 5, price: 140000, desc: '灵宝。金索一抛，便是蛟龙也挣脱不得。', glyph: '索', art: { kind: 'bind', reqRealm: 4, sense: 150, pieces: 1, power: 2.4, mp: 35, cd: 8, element: 'gold', color: '#e0c060' } },
  { id: 'art_yunxiaozhou', name: '云霄宝舟', type: 'artifact', tier: 5, price: 130000, desc: '灵宝飞舟。祭出后按 F 乘舟，日行万里，飞渡大海如履平地。', glyph: '舟', art: { kind: 'flight', reqRealm: 4, sense: 0, pieces: 1, power: 0, mp: 0, cd: 0, mapSpeed: 2.0, color: '#d8e8f0' } },
  // —— 第四十步：通天级的原创至宝，只在大夺宝里出世 ——
  { id: 'art_taixujianxia', name: '太虚剑匣', type: 'artifact', tier: 6, price: 900000, desc: '剑匣中藏九口太虚剑，匣开时剑气冲霄，三十里外都看得见。元婴修士得之，可与化神周旋。', glyph: '匣', art: { kind: 'sword', reqRealm: 4, sense: 60, pieces: 9, power: 3.6, mp: 6, cd: 0.9, element: 'gold', color: '#f8f0d0' } },
  { id: 'art_zhoutianpan', name: '周天星斗盘', type: 'artifact', tier: 6, price: 850000, desc: '星盘一转，周天星力倾泻而下，盘中三百六十五颗星辰各自为阵。', glyph: '盘', art: { kind: 'ring', reqRealm: 4, sense: 160, pieces: 1, power: 6, mp: 30, cd: 3, element: 'gold', color: '#4a5a9a' } },
  { id: 'art_jiuyoudeng', name: '九幽冥灯', type: 'artifact', tier: 6, price: 880000, desc: '灯焰碧绿，照见九幽。灯火所及，元神如雪遇汤。', glyph: '灯', art: { kind: 'flame', reqRealm: 4, sense: 160, pieces: 1, power: 6.2, mp: 45, cd: 5, element: 'blood', color: '#60ffa0' } },
];

// 法术卷轴（第三步）：每门法术一卷
for (const a of ART_LIST) {
  if (a.id === 'qijin') continue;
  I.push({ id: 'scroll_art_' + a.id, name: `《${a.name}》`, type: 'scroll', tier: a.tier, price: [40, 300, 2500, 15000, 80000][a.tier], desc: `${['凡', '黄', '玄', '地', '天'][a.tier]}阶${a.school}法术卷轴，需${['凡人', '炼气', '筑基', '结丹', '元婴', '化神'][a.realm]}期修习。${a.desc}`, glyph: '术', scroll: { skill: a.id } });
}
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(I.map((d) => [d.id, d]));
export const ITEM_LIST = I;
export function itemDef(id: string): ItemDef { return ITEMS[id] ?? { id, name: id, type: 'misc', tier: 0, price: 1, desc: '', glyph: '?' }; }
