// 第 4 阶段（s4-content）：功法分门别类——主修（定路子、出专属神通）/ 辅修（九门杂学）/ 秘术（要付代价）
// 主修：修炼速度、属性，以及“路子”——本门系别的法术、同属性的法宝威力上浮；到了境界自悟专属神通。
// 灵根：功法有五行（或风雷冰变异、阴属魔功、无属性）。灵根含此属性则修得顺（天灵根大顺），不含则事倍功半。
import type { School } from '../arts';
import type { Wx, RegionId } from './types';

export type GfCat = 'main' | 'aux' | 'secret';
/** 辅修九门：神识 · 炼体 · 遁术 · 御兽 · 傀儡 · 阵法 · 符箓 · 炼丹 · 炼器 */
export type AuxKind = 'shen' | 'ti' | 'dun' | 'shou' | 'kui' | 'zhen' | 'fu' | 'dan' | 'qi';
export const AUX_NAME: Record<AuxKind, string> = { shen: '神识', ti: '炼体', dun: '遁术', shou: '御兽', kui: '傀儡', zhen: '阵法', fu: '符箓', dan: '炼丹', qi: '炼器' };
export const CAT_NAME: Record<GfCat, string> = { main: '主修', aux: '辅修', secret: '秘术' };

export interface CanonGf {
  id: string; name: string; desc: string; cat: GfCat; wx: Wx; tier: number;
  rate: number; maxRealm: number; reqRealm: number;
  atk?: number; hp?: number; def?: number; mp?: number; sword?: number;
  path?: School[]; pathK?: number; sig?: string; sigRealm?: number;
  auxKind?: AuxKind; auxK?: number; secretArt?: string;
  sect?: string; region?: RegionId; evil?: boolean; aux?: boolean;
}

const RATE = [0.85, 1.0, 1.1, 1.2, 1.3, 1.45];
const MAXR = [2, 3, 3, 4, 5, 5];
const REQR = [1, 1, 1, 2, 3, 3];
const SIGR = [1, 1, 2, 2, 3, 3];

type MainRow = [string, string, Wx, number, string, string, string, string, RegionId?];
// [id, 名, 五行, 品阶 0-5, 宗门('' 为坊市流通), 路子(系别字串), 专属神通, 描述]
const MAIN: MainRow[] = [
  // —— 天南 · 越国七派
  ['suonv', '素女轮回功', 'water', 4, 'yanyue', '冰', 'hanyue', '掩月宗不传之秘，女修修之容颜不老，法力绵长如水。'],
  ['wanling', '万灵御兽经', 'wood', 3, 'lingshou', '御木', 'qulingfeng', '灵兽山镇派心法，以神识与灵兽相通，驭兽如臂使指。'],
  ['qingxujue', '清虚玄功', 'thunder', 3, 'qingxu', '雷风', 'wulei', '清虚门道家正宗，雷法刚正，专克鬼物。'],
  ['huadaojue', '化刀诀', 'metal', 3, 'huadao', '剑', 'duanjin', '化刀坞以刀入道的心法，刀意凌厉，出手便见血。'],
  ['tianquegf', '天阙镇岳功', 'earth', 3, 'tianque', '土体', 'shanbeng', '天阙堡镇派功法，稳如城墙，厚重难撼。'],
  ['jujianjue', '巨剑诀', 'metal', 3, 'jujian', '剑', 'jianlun', '巨剑门以力御剑的法门，剑越重越凶。'],
  ['qixuanxin', '七玄心法', 'none', 0, 'qixuan', '体', 'bengquan', '七玄门的江湖内功，炼气小修聊胜于无。'],
  // —— 天南 · 天道盟 / 九国盟 / 千竹教 / 慕兰
  ['yimu', '乙木长生诀', 'wood', 3, 'luoyun', '木', 'tengman', '落云宗镇派心法，乙木生机绵绵不绝，最宜种药养伤。'],
  ['gujianjing', '古剑心经', 'metal', 4, 'gujian', '剑', 'baihong', '古剑门剑修圣典，一剑出而白虹贯日。'],
  ['baiqiaojue', '百巧天工诀', 'metal', 3, 'baiqiao', '御阵', 'jinjiakui', '百巧院机关一脉的心法，傀儡阵法相辅相成。'],
  ['huayijing', '化意毒经', 'wood', 3, 'huayi', '木', 'duzhang', '化意门大长老一脉的毒道心法，九国盟中人人忌惮。'],
  ['qianzhujing', '千竹傀儡经', 'metal', 4, 'qianzhu', '御识', 'jinjiakui', '千竹教镇教心法，傀儡之术独步人界，与大衍诀一脉相承。'],
  ['mulandian', '慕兰法典', 'wind', 3, 'mulan', '风', 'xunfeng', '慕兰法士的祭祀法门，巽风为用。'],
  // —— 天南 · 魔道六宗
  ['guilingjing', '鬼灵经', 'yin', 3, 'guiling', '魔识', 'guiku', '鬼灵门驭使鬼物的根本法门，鬼哭声声。'],
  ['chanv', '姹女阴阳诀', 'yin', 3, 'hehuan', '识魔', 'shehun', '合欢宗采补秘法，修得快，心性却容易走偏。'],
  ['xueji', '血祭御灵经', 'yin', 3, 'yuling', '御魔', 'duchong', '御灵宗以精血喂养灵兽的魔功，兽越凶，人越狂。'],
  ['qianhuanjue', '千幻诀', 'wind', 3, 'qianhuan', '识', 'qh_qianhuan', '千幻宗幻术根本，真真假假，叫人无从下手。'],
  ['xuesha', '血煞经', 'yin', 3, 'tiansha', '魔', 'xuehe', '天煞宗杀伐魔功，杀人越多，血煞越浓。'],
  ['yinluo', '阴罗鬼经', 'yin', 4, 'yinluo', '魔', 'lianhunying', '阴罗宗以生魂炼幡的根本魔功。'],
  // —— 乱星海
  ['xingchen', '周天星辰诀', 'metal', 4, 'xinggong', '阵符', 'xg_xingguang', '星宫正统心法，引周天星力入体。', 'luanxing'],
  ['miaoyinjue', '妙音诀', 'wind', 3, 'miaoyin', '识风', 'my_qinyin', '妙音门以音入道，一曲可醉人，亦可杀人。', 'luanxing'],
  ['nixingjing', '逆星血经', 'yin', 4, 'nixing', '魔', 'nx_nixue', '逆星盟诸老怪合撰的魔功，专与星宫作对。', 'luanxing'],
  ['zhenhai', '镇海诀', 'water', 2, '', '冰', 'canglang', '外海猎妖修士人手一卷的水法心诀，粗浅却实用。', 'luanxing'],
  ['jiaolong', '蛟龙变', 'water', 3, '', '体冰', 'canglang', '模仿蛟龙吐纳的炼体法门，乱星海散修自创。', 'luanxing'],
  ['xuanguijia', '玄龟负海功', 'earth', 2, '', '土体', 'houtu', '取法玄龟负海，守多于攻。魁星岛一带流传。', 'luanxing'],
  // —— 大晋
  ['taiyijue', '太一化清诀', 'metal', 5, 'taiyi', '剑', 'ty_huaqing', '太一门正统，清气一化，邪法自消。', 'dajin'],
  ['tianmojing', '天魔真经', 'yin', 5, 'tianmo', '魔体', 'wangui', '天魔宗镇宗魔经，化神老怪亦修此法。', 'dajin'],
  ['tianlandian', '天澜圣典', 'wind', 4, 'tianlan', '风体', 'tl_shenguang', '天澜圣殿供奉圣兽的法门。', 'dajin'],
  ['jingangjing', '大金刚经', 'earth', 4, '', '体', 'fumoquan', '大晋佛宗外传的金刚法门，不动如山。', 'dajin'],
  ['yejia', '叶家碧落诀', 'wood', 4, '', '木剑', 'qingmulei', '晋京叶家秘传，碧落之气清而不散。', 'dajin'],
  ['moyan', '魔焰诀', 'fire', 4, '', '火魔', 'mohuo', '大晋魔焰门的火道魔功，火色紫黑。', 'dajin'],
  ['wanfa', '万法归宗诀', 'none', 4, '', '符阵识', 'jinguangzhen', '万法门的杂学总纲，样样都会，样样都精不了。', 'dajin'],
  ['beihan', '北寒玄冥功', 'ice', 4, '', '冰', 'bingfeng', '北寒雪原老怪所传，寒气入骨。', 'dajin'],
  // —— 坊市流通的大路功法（各系一套，品阶递进）
  ['chiyanjue', '赤炎诀', 'fire', 1, '', '火', 'chiyan', '火灵根修士入门必修，粗浅却稳。'],
  ['lihuojing', '离火真经', 'fire', 2, '', '火', 'lihuo', '离火之法，火势凝而不散。'],
  ['jiuyanggong', '九阳焚天功', 'fire', 3, '', '火', 'fentian', '取九阳之意，火性暴烈，修到深处可焚天煮海。'],
  ['taiyanghuo', '太阳真火经', 'fire', 4, '', '火', 'jinwu', '上古火修传承，真火如日。'],
  ['hanbingjue', '寒冰诀', 'ice', 1, '', '冰', 'shuanghua', '冰灵根修士的入门功法。'],
  ['xuanbingjing', '玄冰真经', 'ice', 2, '', '冰', 'bingjian', '寒气凝练成冰，冰中藏锋。'],
  ['bingpogong', '冰魄玄功', 'ice', 3, '', '冰', 'bingposuo', '以冰魄淬炼法力，寒入骨髓。'],
  ['taiyin', '太阴玄冰经', 'ice', 5, '', '冰', 'bingfeng', '取太阴之精，冰封千里。'],
  ['yinleijue', '引雷诀', 'thunder', 1, '', '雷', 'leizhu', '雷灵根修士入门功法，引雷入体，痛不欲生。'],
  ['wuleizheng', '上清五雷经', 'thunder', 3, '', '雷', 'tianleiyin', '道门正宗雷法总纲。'],
  ['zixiaojing', '紫霄神雷经', 'thunder', 4, '', '雷', 'zixiao', '紫霄宫失传雷经的残本，雷法之巅。', 'dajin'],
  ['fengxingjue', '风行诀', 'wind', 1, '', '风', 'kuangfeng', '风灵根修士入门功法，身轻如燕。'],
  ['xunfengjing', '巽风真经', 'wind', 3, '', '风', 'longjuan', '巽风之法，无孔不入。'],
  ['houtujue', '厚土诀', 'earth', 1, '', '土', 'shijian', '土灵根修士入门功法，厚重扎实。'],
  ['wutujing', '戊土真经', 'earth', 2, '', '土', 'dilie', '戊土之气厚重绵长。'],
  ['zhenyuegong', '镇岳玄功', 'earth', 3, '', '土体', 'qianjun', '以山岳为意，稳如泰山。'],
  ['ruijinjue', '锐金诀', 'metal', 1, '', '剑', 'jianqi', '金灵根修士入门功法，锋锐外露。'],
  ['gengjinjing', '庚金剑经', 'metal', 2, '', '剑', 'gengjinjian', '庚金主杀，剑修喜之。'],
  ['taibai', '太白金章', 'metal', 3, '', '剑', 'jianguang', '太白主兵戈，金章一卷，剑气纵横。'],
  ['qingmujue', '青木诀', 'wood', 1, '', '木', 'muling', '木灵根修士入门功法，生机盎然。'],
  ['changshenggf', '长春不老功', 'wood', 3, '', '木', 'kumu', '长春功的上卷，木气养身，延年益寿。'],
  ['wanmujing', '万木归元经', 'wood', 4, '', '木', 'jianmu', '万木归于一元，生生不息。'],
  ['xuanshuijue', '玄水诀', 'water', 1, '', '冰', 'xuanshui', '水灵根修士入门功法，绵柔不绝。'],
  ['ruoshuijing', '弱水真经', 'water', 3, '', '冰', 'ruoshui', '弱水三千，只取一瓢。'],
  ['guishui', '癸水玄冥经', 'water', 4, '', '冰', 'tianhe', '癸水至阴，玄冥无底。'],
  ['yinshagong', '阴煞功', 'yin', 1, '', '魔', 'yinshazhang', '魔道散修的入门魔功，修得快，伤心性。'],
  ['youming', '幽冥鬼经', 'yin', 3, '', '魔识', 'guiku', '幽冥一脉的鬼道功法。'],
  ['jiuyoulian', '九幽炼魂经', 'yin', 4, '', '魔', 'xueshachong', '以魂炼法的魔经，九幽之下传上来的东西。'],
  ['xiaozhoutian', '小周天功', 'none', 1, '', '体', 'tongpigong', '最常见的吐纳法门，胜在不挑灵根。'],
  ['wuxingjue', '五行归元诀', 'none', 2, '', '火冰雷土木', 'huolingzhen', '五行兼修的杂家功法，伪灵根修士的救命稻草。'],
];

type AuxRow = [string, string, AuxKind, number, string, string, RegionId?];
// [id, 名, 门类, 品阶, 宗门, 描述]
const AUX: AuxRow[] = [
  ['yanghunjing', '养魂经', 'shen', 1, '', '温养神魂的基础法门。'],
  ['ningshen', '凝神诀', 'shen', 2, '', '收摄心神，神识凝而不散。'],
  ['qingling', '明清灵目诀', 'shen', 3, '', '瞳术法门，神识所及纤毫毕现。', 'luanxing'],
  ['tongpi', '铜皮铁骨诀', 'ti', 1, '', '捶打皮肉的炼体粗功。'],
  ['longxiang', '龙象功', 'ti', 3, '', '一龙一象之力，炼体修士求之不得。', 'dajin'],
  ['jingangti', '金刚不坏体', 'ti', 4, '', '佛门炼体奇功，刀剑难伤。', 'dajin'],
  ['feiyunjue', '飞云诀', 'dun', 1, '', '驾云赶路的法门。'],
  ['wuxingdun', '五行遁法', 'dun', 2, '', '借五行之气遁走，土遁水遁随心。'],
  ['xuanguangdun', '玄光遁', 'dun', 3, '', '化作一道玄光遁走，快逾奔雷。', 'luanxing'],
  ['yushoujue', '御兽诀', 'shou', 1, 'lingshou', '与灵兽相通的入门法门。'],
  ['yulingjing', '驭灵真经', 'shou', 2, 'yuling', '驭使灵兽、灵虫的进阶法门。'],
  ['wanshoupu', '万兽谱', 'shou', 3, '', '记载万种妖兽习性与驭使之法。', 'luanxing'],
  ['kuileishu', '傀儡初解', 'kui', 1, 'baiqiao', '操控木甲傀儡的入门术。'],
  ['jiguanpu', '百巧机关谱', 'kui', 2, 'baiqiao', '百巧院历代机关大师的心得。'],
  ['dayankui', '大衍傀儡术', 'kui', 4, 'qianzhu', '大衍神君亲传的傀儡秘术，一人驭百傀。'],
  ['zhenjie', '阵法初解', 'zhen', 1, '', '布阵入门，阵旗阵盘的用法。'],
  ['diandaopu', '颠倒五行阵谱', 'zhen', 2, '', '天星宗坊市流出的阵谱，颠倒五行。'],
  ['zhoutiantu', '周天星斗阵图', 'zhen', 4, 'xinggong', '星宫秘藏阵图。', 'luanxing'],
  ['fujie', '符箓初解', 'fu', 1, '', '画符入门，朱砂符纸的门道。'],
  ['tianleifujing', '天雷符经', 'fu', 2, '', '专讲雷符画法的经书。'],
  ['fubaolu', '符宝秘录', 'fu', 3, '', '封印法宝之力入符的秘法。', 'dajin'],
  ['danjie', '丹道初解', 'dan', 1, '', '炼丹入门，火候药性。'],
  ['baicao', '百草经', 'dan', 2, 'luoyun', '落云宗药园代代相传的草木经。'],
  ['tiandan', '天丹秘录', 'dan', 3, '', '上古丹师手札，成丹更多。', 'dajin'],
  ['lianqijie', '炼器初解', 'qi', 1, '', '炼器入门，祭炼法器的基础。'],
  ['bailian', '百炼诀', 'qi', 2, '', '千锤百炼，法器与心神更契合。'],
  ['qiling', '器灵秘术', 'qi', 4, '', '养出器灵的秘术，法宝威力大增。', 'dajin'],
];

type SecRow = [string, string, string, number, string, RegionId?];
// [id, 名, 所授秘术(ART id), 品阶, 描述]
const SEC: SecRow[] = [
  ['ms_xuedun', '血遁大法', 'xuedun', 2, '燃精血遁走，每遁折寿一年。'],
  ['ms_xueying', '血影遁法', 'xueyingdun', 3, '极阴岛秘传遁法，折寿三年，遁出三千丈。', 'luanxing'],
  ['ms_jieti', '天魔解体秘录', 'jieti', 4, '魔道禁术，战力翻倍，折寿十年。', 'dajin'],
  ['ms_ranxue', '燃血秘术', 'ranxue', 2, '燃血换力，每用一次折寿一年。'],
  ['ms_ranhun', '燃魂秘法', 'ranhun', 3, '燃烧元神一击，修为倒退。'],
  ['ms_huaxue', '化血神刀诀', 'huaxuedao', 3, '血刀秘法，折寿二年。'],
  ['ms_jinchan', '金蝉脱壳术', 'jinchan', 3, '替死遁走的秘术，折寿一年。'],
  ['ms_nimai', '逆脉回元诀', 'nimai', 2, '逆转经脉回满法力，修为倒退。'],
  ['ms_jiuzhuan', '九转回魂诀', 'jiuzhuan', 4, '起死回生的禁法，折寿五年。'],
  ['ms_tishen', '替身秘术', 'tishen', 3, '以替身符为媒的秘法。'],
];

/** 路子字串（如 '御木'）→ 系别数组 */
const pathOf = (s: string) => [...s].filter((c) => '火冰雷风土木剑体御魔识阵身符'.includes(c)) as School[];

function mainOf(r: MainRow): CanonGf {
  const [id, name, wx, t, sect, path, sig, desc, region] = r;
  const P = pathOf(path), evil = wx === 'yin';
  const g: CanonGf = { id, name, desc, cat: 'main', wx, tier: t, rate: RATE[t] + (evil ? 0.1 : 0), maxRealm: MAXR[t], reqRealm: REQR[t], path: P, pathK: 0.12 + 0.05 * t, sig, sigRealm: SIGR[t], sect: sect || undefined, region, evil };
  if (P.includes('剑')) { g.atk = 0.06 + 0.03 * t; g.sword = 0.12 + 0.05 * t; }
  else if (P[0] === '体') { g.hp = 0.25 + 0.08 * t; g.def = 0.12 + 0.05 * t; }
  else if (evil) { g.mp = 0.1 + 0.03 * t; g.atk = 0.05 + 0.02 * t; }
  else { g.mp = 0.08 + 0.03 * t; g.atk = 0.03 + 0.02 * t; }
  if (P.includes('体') && P[0] !== '体') g.hp = 0.15 + 0.05 * t;
  return g;
}
export const CANON_GONGFA: CanonGf[] = [
  ...MAIN.map(mainOf),
  ...AUX.map(([id, name, k, t, sect, desc, region]): CanonGf => ({ id, name, desc, cat: 'aux', aux: true, wx: 'none', tier: t, rate: 1, maxRealm: 5, reqRealm: t >= 3 ? 2 : 1, auxKind: k, auxK: [0.6, 1, 1.4, 1.9, 2.5][t] ?? 1, sect: sect || undefined, region })),
  ...SEC.map(([id, name, art, t, desc, region]): CanonGf => ({ id, name, desc, cat: 'secret', wx: 'yin', tier: t, rate: 1, maxRealm: 5, reqRealm: t >= 3 ? 2 : 1, secretArt: art, region })),
];

/** 原有六门功法的补充信息（路子、专属神通、五行） */
export const LEGACY_GF: Record<string, Partial<CanonGf>> = {
  changchun: { cat: 'main', wx: 'wood', tier: 0, path: ['木'], pathK: 0.1, sig: 'huichun', sigRealm: 1, reqRealm: 1 },
  qingyuan: { cat: 'main', wx: 'wood', tier: 4, path: ['剑'], pathK: 0.25, sig: 'qingyuanmang', sigRealm: 1, reqRealm: 1, sect: 'huangfeng' },
  xuanyin: { cat: 'main', wx: 'yin', tier: 3, path: ['魔', '冰'], pathK: 0.25, sig: 'yinhun', sigRealm: 2, reqRealm: 1, sect: 'jiyin', evil: true, region: 'luanxing' },
  tuotian: { cat: 'main', wx: 'earth', tier: 4, path: ['体'], pathK: 0.3, sig: 'tuotian', sigRealm: 3, reqRealm: 2, sect: 'tianmo', evil: true },
  generic: { cat: 'main', wx: 'none', tier: 0, path: [], pathK: 0, reqRealm: 1 },
  dayan: { cat: 'aux', wx: 'none', tier: 5, auxKind: 'shen', auxK: 3, reqRealm: 1, sect: 'qianzhu' },
};

/** 新功法的玉简价格 */
export const GF_PRICE = [60, 400, 3000, 12000, 40000, 120000];
