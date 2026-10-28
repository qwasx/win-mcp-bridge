// 第三十七步：货有产地，宝有主人——按原著把“哪里能买到什么、卖多少钱”定死
//
// 原著要点（凡人修仙传·人界篇）：
// · 越国黄枫谷坊市（万宝楼）：金蚨子母刃、玄铁飞天盾、天雷子这类上品法器 / 雷火符器；千年灵药一出手就惹眼
// · 元武国天星宗坊市（星辰阁）：阵旗阵盘为主（颠倒五行阵），定颜丹卖到一千多灵石；真正的精品宗门自留
// · 太南小会：散修以物易物——符箓、残卷、法宝残片、灵草种子
// · 天南：灵草多、丹方难寻；高阶妖兽几近绝迹——“不要说七级妖丹，就是五级六级妖丹，都是难有人见的东西”
// · 乱星海：灵药灵石都不丰富，丹方泛滥，妖丹与妖兽材料遍地；五级妖丹近千灵石，六级“可让筑基修士修炼无忧一生”，
//   七级妖丹只在外海拍卖会上露面，价比天高；八级以上是化形妖王的内丹，市面上根本见不到
// · 大晋：品类最全、价格最贵；晋京大拍卖会（九霄殿）与魔道地下交换会，元婴老怪拿出来的都是“让结丹修士倾家荡产”的东西
// · 原著里有主的法宝（南宫婉的朱雀环、温天仁的天阳鎏金针、青易居士的青冥针、穆上师的千重峰、太一门的天阿神剑……）
//   与通天灵宝，坊市拍卖一概不卖——只能杀人夺宝，或走原著机缘
import type { ItemDef } from './items';
import { LOC_BY_ID, type LocDef } from './world';
import { canonRule, canonOwner, isGenerated } from './canon/rules';

/** 市集分区：越国 / 天南（元武·车骑·紫金·天道盟·九国盟）/ 魔道六宗地界 / 慕兰 / 乱星海 / 大晋 / 天澜草原 */
export type Zone = 'yue' | 'tiannan' | 'mo' | 'mulan' | 'luanxing' | 'dajin' | 'caoyuan';
/** 价区：天南大陆 / 乱星海 / 大晋（含草原） */
export type PZone = 'TN' | 'LX' | 'DJ';
export const ZONE_NAME: Record<Zone, string> = { yue: '越国', tiannan: '天南', mo: '魔道六宗', mulan: '慕兰', luanxing: '乱星海', dajin: '大晋', caoyuan: '天澜草原' };
export const pzOf = (z: Zone): PZone => (z === 'luanxing' ? 'LX' : z === 'dajin' || z === 'caoyuan' ? 'DJ' : 'TN');

const ZONE_OF_LOC: Record<string, Zone> = {
  qixuan: 'yue', qingniu: 'yue', jingzhou: 'yue', jiayuan: 'yue', yuejing: 'yue', huangfeng: 'yue', yanyue: 'yue', lingshou: 'yue', qingxu: 'yue', huadao: 'yue', tianque: 'yue', jujian: 'yue', tainan: 'yue', yanling: 'yue',
  yuanwu: 'tiannan', cheqi: 'tiannan', zijin: 'tiannan', luoyun: 'tiannan', gujian: 'tiannan', baiqiao: 'tiannan', tiantian: 'tiannan', huayi: 'tiannan', qianzhu: 'tiannan',
  guiling: 'mo', hehuan: 'mo', yuling: 'mo', qianhuan: 'mo', tiansha: 'mo', yinluo: 'mo',
  mulan: 'mulan', tianlan: 'caoyuan', tuwu: 'caoyuan',
};
const zoneCache = new Map<string, Zone>();
/** 地点所在的市集分区（小村落归最近的大地点） */
export function zoneOfLoc(l: LocDef | undefined | null): Zone {
  if (!l) return 'tiannan';
  const c = zoneCache.get(l.id); if (c) return c;
  let z: Zone | undefined = ZONE_OF_LOC[l.id];
  if (!z) {
    if (l.map === 'luanxing') z = 'luanxing';
    else if (l.map === 'dajin') z = 'dajin';
    else {
      let best = Infinity;
      for (const id in ZONE_OF_LOC) { const o = LOC_BY_ID.get(id); if (!o || o.map !== l.map) continue; const d = Math.hypot(o.x - l.x, o.y - l.y); if (d < best) { best = d; z = ZONE_OF_LOC[id]; } }
    }
  }
  zoneCache.set(l.id, z ?? 'tiannan');
  return z ?? 'tiannan';
}

/** 流通等级：0 处处有 · 1 村镇坊市 · 2 城池 · 3 大城/宗门/大岛 · 4 只上拍卖会 · 5 不卖（机缘 / 杀人夺宝） */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
interface Rule {
  /** 只在这些分区流通（缺省 = 各处都有） */
  z?: (Zone | PZone)[];
  g: Grade;
  /** 原著持有者（有主之宝，一概不卖、也不会从路人身上掉出来） */
  owner?: string;
  /** 宗门秘传：只在这些宗门的藏经阁 / 宝库里换得到 */
  homes?: string[];
  /** 价区倍率 */
  m?: Partial<Record<PZone, number>>;
  /** 第四十步：只在档次 ≥ minLv 的地方露面（4 大城坊市 · 5 名城坊市 / 雄城拍卖会 · 6 天下名城拍卖会） */
  minLv?: number;
}
const TN: PZone = 'TN', LX: PZone = 'LX', DJ: PZone = 'DJ';

// ---------------------------------------------------------------- 原著有主之宝 / 天下独一份
const OWNED: Record<string, string> = {
  art_qingzhu: '韩立', art_sanyan: '韩立', art_leihuogong: '韩立', mat_jinleizhu: '韩立',
  art_zhuque: '南宫婉', art_zhuxie: '南宫婉',
  art_tianyang: '温天仁（六道极圣一脉）', art_huanglin: '蛮胡子', art_zibing: '蛮胡子',
  art_qingmingzhen: '青易居士', art_guanrijian: '星宫执法长老', art_yuanci: '星宫（元磁神山）', art_xuanhuangjing: '万法门', art_liangyihuan: '玄黄老人',
  art_yufengche: '穆上师', art_qianchongfeng: '穆上师', art_jingangzhao: '炫烨王', art_luohunsha: '狂沙上人', art_sifangxue: '四散真人', art_molongren: '上古魔修（魔龙刃）',
  art_fenglei: '风希', mat_leipenggu: '风希', art_guiluo: '阴罗宗（十八杆鬼罗幡）', art_tiandu: '魔道老怪', art_sanshen: '魔道老怪',
  art_xutian: '虚天殿', art_qianlan: '虚天殿', art_wuxing: '虚天殿', art_huolan: '虚天殿', pill_butian: '虚天殿', tal_liuding: '虚天殿',
  art_wuzi: '昆吾山', art_balingchi: '昆吾山', art_heifengqi: '昆吾山', mat_yinchi: '昆吾山（银翅夜叉）', mat_xueyan: '坠魔谷（古魔血焰）',
  art_zhenhaizhong: '小极宫', mat_shuanggongdu: '小极宫（六翼霜蚣）', art_tianajian: '太一门',
  mat_jinjiaolin: '十级金蛟王', mat_bingfengyu: '冰凤', item_yuanqi: '上古遗物',
  herb_jiuqu: '万年灵物', pill_jiuqu: '万年灵物', egg_shijin: '噬金虫（天下难寻）', item_tihun: '上古异兽（啼魂）',
  mat_huochan: '坠魔谷（火蟾兽）', mat_mangpi: '坠魔谷（蟒兽）',
  // 原著独门功法 / 秘术：只能靠机缘
 
  scroll_art_qianlan: '小极宫', scroll_art_bixie: '韩立（金雷竹）', scroll_art_jinlei: '韩立（金雷竹）',
  scroll_art_fengleichi: '风希',
  scroll_art_dageng: '青元剑诀（韩立）', scroll_art_shijin: '噬金虫', scroll_art_tihun: '啼魂兽', scroll_art_wuzi: '昆吾山',
  scroll_art_xutianding: '虚天鼎', scroll_art_dongxuan: '上古秘术', scroll_art_shengmo: '上古魔功', scroll_art_quhun: '墨大夫（曲魂）', scroll_art_tiandushihuo: '魔道老怪',
};

// ---------------------------------------------------------------- 逐件规则（未列出的按类别 / 品阶推断）
const R: Record<string, Rule> = {
  // —— 法器（越国黄枫谷坊市万宝楼：金蚨子母刃、玄铁飞天盾、天雷子） ——
  art_jinfu: { z: ['yue', 'tiannan'], g: 2 }, art_xuantie: { z: ['yue', 'tiannan'], g: 2 }, tal_tianleizi: { z: ['yue', 'tiannan', DJ], g: 2 },
  art_qingfeng: { g: 1 }, art_yinhui: { g: 1 }, art_qingning: { g: 1 }, art_hongxian: { g: 2 },
  art_guike: { g: 1, m: { LX: 0.7 } },
  art_tayun: { z: [TN], g: 2 },
  // 墨蛟（血色禁地）的爪、鳍、眼炼成的法器——天南货
  art_wulong: { z: [TN], g: 2 }, art_shenfeng: { z: [TN], g: 2 }, art_qingjiao: { z: [TN], g: 2 },
  art_huangluosan: { z: [TN, DJ], g: 3 }, art_wuxingzhen: { g: 3 }, art_yueyang: { g: 3 },
  art_xuehongling: { z: ['yue'], g: 3, homes: ['qingxu'] },          // 清虚门的飞行法器
  art_fengyunfan: { z: ['yue'], g: 3, homes: ['huangfeng'] },        // 黄枫谷黄师叔的风云幡
  art_lvhuang: { z: ['mo'], g: 3, homes: ['yuling'] },               // 御灵宗修士的法宝
  art_miemo: { z: [TN, DJ], g: 3 },
  art_juhunbo: { z: ['mo', DJ, 'luanxing'], g: 3 },                 // 邪修之物
  art_xueleizi: { z: ['mo', DJ], g: 4 }, art_xuemo: { z: ['mo', DJ], g: 4 },   // 魔道地下拍卖
  art_pingtianchi: { z: [DJ], g: 4 }, art_sixiang: { z: [DJ], g: 4 },
  art_bamen: { z: [LX], g: 4 },                                      // 天镜散人八门金光镜的仿品
  art_yinzhong: { z: [LX], g: 4 }, art_languang: { z: [LX], g: 4 },  // 海外古宝
  art_qingtong: { z: [TN, DJ], g: 4 }, art_ziyou: { z: [DJ, TN], g: 4 }, art_xuepifeng: { z: [DJ, 'mo'], g: 4 },
  art_fuguang: { z: [TN, DJ], g: 4 }, art_jianfu: { z: [TN, DJ], g: 4 }, art_jinguangzhuan: { z: [TN], g: 4 },   // 符宝难得
  // —— 第三十九步：大路法器的产地
  art_heisha: { z: ['mo', DJ, 'luanxing'], g: 2 }, art_shehun: { z: ['mo', DJ, 'luanxing'], g: 1 }, art_xuehun: { z: ['mo', DJ], g: 3 },   // 魔道之物
  art_zijinbo: { z: [DJ, TN], g: 3 },                                // 佛门俗家
  art_ruanwei: { g: 1, m: { LX: 0.75 } }, art_xuangui: { g: 2, m: { LX: 0.75, TN: 1.2 } },   // 妖兽材料炼的甲，海外便宜
  art_xuanbingjing: { z: [DJ, LX], g: 3 }, art_hanjiang: { z: [DJ, LX, 'yue'], g: 2 },
  art_taomu: { g: 0 }, art_feihuang: { g: 0 }, art_chitong: { g: 0 },
  art_gengjin: { g: 3, m: { DJ: 0.9 } }, art_zhenyue: { z: [TN, DJ], g: 3 }, art_tianluo: { z: [DJ, LX], g: 3 },
  scroll_art_shihun: { z: ['mo', DJ, 'luanxing'], g: 3, homes: ['guiling', 'yinluo', 'tianmo'] },
  scroll_art_yinfeng: { z: ['mo', DJ, 'luanxing'], g: 2 },
  scroll_art_hualong: { g: 4, homes: ['tianlan', 'tianmo'] },
  scroll_art_jianhe: { g: 4, homes: ['jujian', 'gujian'] },
  // —— 符箓 ——
  tal_fire: { g: 0 }, tal_ice: { g: 1 }, tal_jingang: { g: 1 }, tal_thunder: { g: 2 }, tal_escape: { g: 2 }, tal_tishen: { g: 3 }, tal_fubao: { g: 4, z: [TN, DJ] },
  tal_pojin: { g: 1 }, tal_huifu: { g: 1 },
  // —— 丹药 ——
  pill_juqi: { g: 0 }, pill_huiqi: { g: 0 }, pill_liaoshang: { g: 0 }, pill_huanglong: { g: 1 }, pill_jinsui: { g: 1 },
  pill_juling: { g: 2 }, pill_ningyuan: { g: 3 },
  pill_dingyan: { z: [TN, DJ], g: 3 },                               // 天星宗星辰阁一千多灵石
  pill_zhuji: { g: 4, m: { TN: 1.4, LX: 0.8 } },                     // 天南七派把持；海外略松（大城丹铺偶见，见 SPECIAL）
  pill_jiangchen: { z: [LX, DJ], g: 4 },                             // 降尘丹（乱星海古长老身上就有一颗）
  pill_biyan: { z: [LX], g: 4 },
  pill_peiying: { z: [DJ, LX], g: 4 }, pill_yanshou: { g: 4 }, pill_yanghun: { z: [DJ, LX], g: 3 },
  // —— 灵草：天南灵药多，乱星海灵药少而贵 ——
  herb_xuejing: { z: [TN], g: 2 }, herb_nichang: { z: [TN], g: 2 }, herb_bingpo: { z: [DJ, LX], g: 3 }, herb_xuelian: { z: [DJ, TN], g: 2 },
  herb_yangshen: { g: 4 },
  // —— 妖兽材料 ——
  mat_shuangtongmu: { z: [TN], g: 1 }, mat_zhijiao: { z: [TN], g: 1 }, mat_yunchiyu: { z: [TN], g: 1 }, mat_heilin: { z: [TN], g: 1 },
  mat_mojiaoqi: { z: [TN], g: 2 }, mat_mojiaozhao: { z: [TN], g: 2 }, mat_yinzhima: { z: [TN], g: 4 },
  mat_qianmuyan: { z: [LX], g: 2 }, mat_chihuolin: { z: [LX], g: 4 },
  mat_qingfengjiao: { z: [LX, DJ], g: 4 }, mat_bingjialin: { z: [LX, DJ], g: 4 }, mat_tujiapi: { z: [DJ], g: 4 },
  mat_shisha: { z: ['mo', DJ], g: 3 }, mat_yuanhun: { z: ['mo', DJ], g: 3 },
  mat_dujiaolin: { z: [LX], g: 5 },                                  // 八级毒蛟：只能自己去外海搏命
  mat_yanghunmu: { z: [LX], g: 4 },
  mat_tiejing: { g: 0 }, mat_chitong: { g: 1 }, mat_xuantie: { g: 2 }, mat_lingquan: { g: 1 }, mat_xuanyu: { g: 1 },
  mat_gubaocan: { g: 3 },                                            // 太南小会上就有法宝残片
  // —— 灵兽 ——
  egg_yunchi: { z: [TN], g: 2 }, egg_huli: { z: [TN], g: 3, homes: ['lingshou'] }, egg_wolf: { z: [TN, DJ], g: 3, homes: ['lingshou', 'yuling'] }, egg_jiao: { z: [LX], g: 4 },
  // —— 功法玉简：大路货各处都有，宗门秘传只在本宗藏经阁 ——
  scroll_changchun: { g: 1 }, scroll_huodan: { g: 0 }, scroll_bingzhui: { g: 1 }, scroll_tianyan: { g: 1 }, scroll_lianqi: { g: 2 }, scroll_leidian: { g: 3 },
  scroll_qingyuan: { g: 5, homes: ['huangfeng'] }, scroll_luoyan: { g: 5, homes: ['huangfeng'] }, scroll_art_luoyan: { g: 5, homes: ['huangfeng'] },
  scroll_art_qingyuanmang: { g: 5, homes: ['huangfeng'] }, scroll_art_hutijiandun: { g: 5, homes: ['huangfeng'] },
  scroll_xuanyin: { g: 5, homes: ['jiyin'] },                        // 玄阴经：极阴岛
  scroll_tuotian: { g: 5, homes: ['tianmo'] }, scroll_art_tuotian: { g: 5, homes: ['tianmo'] },
  scroll_mingqing: { z: [LX], g: 4 },
  scroll_art_jianying: { g: 5, homes: ['gujian'] }, scroll_art_jujianshu: { g: 5, homes: ['jujian'] },
  scroll_art_kuilei: { g: 5, homes: ['baiqiao', 'qianzhu'] }, scroll_art_yushou: { g: 5, homes: ['lingshou', 'yuling'] },
  scroll_art_diandao: { z: ['tiannan'], g: 3, homes: ['baiqiao'] }, // 元武国天星宗坊市的阵法
  scroll_art_kunzhen: { g: 2 }, scroll_art_juling: { g: 2 },
  scroll_art_mingwang: { z: [DJ], g: 4 }, scroll_art_jinganghou: { z: [DJ], g: 3 }, // 大晋佛宗
  scroll_art_beiji: { z: [DJ], g: 4 }, scroll_art_qinxian: { z: [DJ], g: 4 }, scroll_art_ziluo: { z: [DJ], g: 4 },
  scroll_art_qingpan: { g: 4 }, scroll_art_chunli: { z: [LX], g: 4 }, scroll_art_leidun: { g: 4 }, scroll_art_bingpo: { z: [DJ, LX], g: 4 },
  scroll_art_xueying: { z: ['mo', DJ, 'luanxing'], g: 3, homes: ['guiling', 'jiyin'] }, scroll_art_yinhun: { z: ['mo'], g: 3, homes: ['guiling', 'yinluo'] },
  scroll_art_xuelian: { z: ['mo', DJ], g: 4, homes: ['yinluo', 'tianmo'] }, scroll_art_xuedun: { z: ['mo', DJ], g: 3, homes: ['tiansha', 'tianmo', 'guiling'] },
  scroll_art_qingyang: { z: ['mo'], g: 3 },                          // 青阳门魔火
  scroll_art_sanyuan: { g: 4 }, scroll_art_tishen: { g: 3 }, scroll_art_tianleifu: { g: 3 },
  // —— 第四十步：宗门秘传（大衍诀一脉归千竹教、元磁神光归星宫天星城、疾风九变 / 匿风术归七玄门、血影遁归极阴岛；名城拍卖会上偶尔也有）
  scroll_dayan: { g: 4, homes: ['qianzhu'] }, scroll_art_shishen: { g: 3, homes: ['qianzhu'] }, scroll_art_jingshen: { g: 4, homes: ['qianzhu'] },
  scroll_art_wugui: { g: 4, homes: ['qianzhu'] }, scroll_art_dayanchong: { g: 4, homes: ['qianzhu'], minLv: 5 },
  scroll_yuanci: { z: [LX], g: 4, homes: ['tianxing'], minLv: 5 }, scroll_art_yuanci: { z: [LX], g: 4, homes: ['tianxing'], minLv: 5 },
  scroll_art_jifeng: { z: ['yue'], g: 3, homes: ['qixuan'] }, scroll_art_nifeng: { z: ['yue'], g: 2, homes: ['qixuan'] },
  scroll_art_xueyingdun: { z: [LX, 'mo'], g: 4, homes: ['jiyin'] },
  // —— 第四十步：雄城 / 名城拍品
  art_ningguang: { z: [TN], g: 4, minLv: 5 }, art_lanjin: { z: [LX], g: 4, minLv: 5 },
  mat_gengjing: { g: 4, minLv: 5, m: { TN: 1.2, DJ: 1, LX: 1.3 } },        // 庚精：原著阗天城、大晋京城拍卖会上都出现过
  herb_tianleizhu: { z: [LX], g: 4, minLv: 6, m: { LX: 1.2 } },            // 天雷竹：妙音门之物，天星城大拍卖偶有一截
  // —— 第四十步：元婴期的货——只在雄城（minLv 5）/ 天下名城（minLv 6）露面
  pill_yuanling: { g: 4, minLv: 5 }, pill_wanshou: { g: 4, minLv: 5 }, pill_ningpo: { g: 4, minLv: 5 }, pill_zifu: { g: 4, minLv: 6 },
  art_zixiao: { g: 4, minLv: 5 }, art_xuanming: { z: [LX, DJ], g: 4, minLv: 5 }, art_jiuyanglu: { g: 4, minLv: 6 }, art_shanheyin: { z: [TN, DJ], g: 4, minLv: 5 },
  art_qiankunjing: { g: 4, minLv: 6 }, art_xuanwudun: { g: 4, minLv: 5 }, art_longlinjia: { z: [LX, DJ], g: 4, minLv: 5 }, art_wanhunfan: { z: ['mo', DJ, LX], g: 4, minLv: 5 },
  art_fulongsuo: { g: 4, minLv: 5 }, art_yunxiaozhou: { g: 4, minLv: 6 },
  scroll_art_yingshun: { g: 4, minLv: 5 }, scroll_art_leihai: { g: 4, minLv: 6 }, scroll_art_xuanbingyu: { z: [LX, DJ], g: 4, minLv: 5 }, scroll_art_taixu: { g: 4, minLv: 6 },
  scroll_art_shanhe: { z: [TN, DJ], g: 4, minLv: 5 }, scroll_art_jiuyou: { z: ['mo', DJ, LX], g: 4, minLv: 5 }, scroll_art_wanmu: { g: 4, minLv: 5 }, scroll_art_faxiang: { g: 4, minLv: 5 },
};

/** 规则（显式 > 推断） */
export function ruleOf(it: ItemDef): Rule {
  const r = R[it.id];
  if (r) return r;
  if (OWNED[it.id]) return { g: 5, owner: OWNED[it.id] };
  const cr = canonRule(it);   // 第 4 阶段：新法宝 / 新功法按地域、宗门流通
  if (cr) { if (cr.owner) OWNED[it.id] = cr.owner; return cr as Rule; }
  const t = it.tier;
  switch (it.type) {
    case 'herb': return { g: (t <= 1 ? 1 : t >= 5 ? 5 : t) as Grade, m: { LX: 1.7, DJ: 1.25 } };
    case 'material': return { g: (t <= 1 ? 1 : t >= 5 ? 5 : t) as Grade };
    case 'pill': return { g: (t >= 5 ? 5 : t) as Grade };
    case 'talisman': return { g: (t <= 1 ? 1 : t >= 4 ? 5 : t) as Grade };
    case 'scroll': return { g: (t <= 0 ? 1 : t === 1 ? 2 : t === 2 ? 3 : 4) as Grade };
    case 'artifact': return { g: (t <= 1 ? 1 : t >= 6 ? 5 : Math.min(4, t)) as Grade };
    default: return { g: it.price > 0 ? 3 : 5 };
  }
}
export function ownerOf(id: string) { return OWNED[id] ?? canonOwner(id); }
/** 原著有主 / 独一份：不卖、不随机掉落 */
export function canonOwned(id: string) { return !!OWNED[id] || !!canonOwner(id); }

// ---------------------------------------------------------------- 妖丹
export const yaodanLv = (id: string) => (id.startsWith('mat_yaodan') ? parseInt(id.slice(10), 10) || 0 : 0);
/** 各价区、各档次坊市能见到的最高妖丹（rnd 决定最高那一档是否“这个月恰好有货”）
 *  level：1 村镇 · 2 城池 · 3 大城/宗门/大岛 · 4 拍卖会 */
export function yaodanCap(pz: PZone, level: number, rnd: () => number = Math.random): number {
  // 第四十步：雄城 / 名城拍卖会的压轴妖丹更高（七级仍只在外海拍卖会上）
  if (level >= 5) {
    if (pz === 'LX') return level >= 6 ? (rnd() < 0.65 ? 7 : 6) : (rnd() < 0.4 ? 7 : 6);
    if (pz === 'DJ') return level >= 6 ? (rnd() < 0.4 ? 6 : 5) : (rnd() < 0.2 ? 6 : 5);
    return rnd() < (level >= 6 ? 0.35 : 0.2) ? 5 : 4;
  }
  if (pz === 'LX') return level >= 4 ? (rnd() < 0.3 ? 7 : 6) : level >= 3 ? (rnd() < 0.35 ? 6 : 5) : level >= 2 ? 4 : 3;
  if (pz === 'DJ') return level >= 4 ? (rnd() < 0.12 ? 6 : 5) : level >= 3 ? 4 : level >= 2 ? 3 : 2;
  return level >= 4 ? (rnd() < 0.08 ? 5 : 4) : level >= 3 ? 3 : level >= 2 ? 2 : 1;   // 天南：五级妖丹已是拍卖会上的稀罕物
}
/** 妖丹价区倍率：乱星海便宜，天南贵得离谱 */
export function yaodanMul(pz: PZone, lv: number) {
  if (pz === 'LX') return lv <= 4 ? 0.5 : lv === 5 ? 0.8 : lv === 6 ? 1.0 : lv === 7 ? 1.3 : 1.6;
  if (pz === 'DJ') return lv <= 3 ? 1.5 : lv <= 6 ? 2 : 2.6;
  return [1, 2.5, 2.5, 3.5, 4.5, 6, 7, 8, 9, 10, 10][lv] ?? 10;
}

// ---------------------------------------------------------------- 对外接口
/** 价区价格倍率（买卖同用） */
export function priceMul(it: ItemDef, z: Zone): number {
  const pz = pzOf(z);
  const lv = yaodanLv(it.id);
  if (lv) return yaodanMul(pz, lv);
  const r = ruleOf(it);
  let m = r.m?.[pz] ?? 1;
  // 未单列的妖兽材料：乱星海遍地，天南稀罕
  if (!r.m && it.type === 'material' && /鳞|角|皮|羽|骨|眼|爪|鳍|翅|毒|血肉/.test(it.name)) m = pz === 'LX' ? 0.7 : pz === 'TN' ? 1.3 : 1.1;
  if (pz === 'DJ') m *= 1.15;   // 大晋什么都贵一些
  return m;
}
/** 是否在该分区流通 */
export function inZone(it: ItemDef, z: Zone): boolean {
  const r = ruleOf(it);
  if (!r.z) return true;
  const pz = pzOf(z);
  return r.z.includes(z) || r.z.includes(pz);
}
/**
 * 坊市 / 拍卖会（档次 level）能否摆出这件货
 * 第四十步：level 统一为“场所档次”——坊市 = 城池档次 1~5（cityTier）；拍卖会 = 3 小城 · 4 大城 · 5 雄城 · 6 天下名城（auctionLevel）
 *   · 流通等级 g ≤ level 才上架（g4 只在 4 档以上：大城坊市少量、雄城名城常见、拍卖会）
 *   · minLv：雄城 / 名城才有的好东西
 *   · 宗门秘传：本宗坊市有；别处只在 4 档以上的拍卖会上偶尔露面
 */
export function sellableAt(it: ItemDef, z: Zone, level: number, yCap?: number, locId?: string, auction = false): boolean {
  if (it.price <= 0 || it.id === 'mat_lingshi') return false;
  const lv = yaodanLv(it.id);
  if (lv) return lv <= (yCap ?? yaodanCap(pzOf(z), auction ? level : Math.min(3, level), () => 0.5)) && lv <= 7;
  const r = ruleOf(it);
  if (r.g >= 5 || r.owner || canonOwned(it.id)) return false;
  if (auction && isGenerated(it.id) && it.tier < 5) return false;   // 第 4 阶段：批量炼出的法器只进坊市，拍卖会上只有古宝
  if (r.minLv && level < r.minLv) return false;
  if (r.homes && !(locId && r.homes.includes(locId)) && !(auction && level >= 4)) return false;
  if (!inZone(it, z)) return false;
  return r.g <= level;
}
/** 宗门藏经阁 / 宝库可换（本宗秘传 + 本区等级 ≤ 3 的东西） */
export function sectCanOffer(it: ItemDef, sectId: string): boolean {
  const r = ruleOf(it);
  if (canonOwned(it.id)) return false;
  if (r.homes) return r.homes.includes(sectId);
  return r.g <= 3 && inZone(it, zoneOfLoc(LOC_BY_ID.get(sectId)));
}
/**
 * 第四十步：城池档次（1 村镇 · 2 城池 · 3 大城 · 4 雄城 · 5 天下名城）
 * 原著：大晋京城（九霄殿拍卖、天机阁）与乱星海天星城（星宫）是人界最繁华的两处；阗天城是天道盟腹地、天南第一大城；
 * 魁星岛是外海门户、猎妖人云集；朔州城是大晋北方雄城。名城的坊市、拍卖会、坐镇的高人，都远非小城可比。
 */
export const CITY_TIER: Record<string, number> = {
  jinjing: 5, tianxing: 5,
  tiantian: 4, kuixing: 4, shuozhou: 4,
  yuejing: 3, jiayuan: 3, qiyuan: 3, jin_fangshi: 3, youzhou: 3, yunzhou: 3, qinzhou: 3, xiangzhou: 3,
};
export const TIER_NAME = ['', '村镇', '城池', '大城', '雄城', '天下名城'];
export function cityTier(l: LocDef): number {
  if (CITY_TIER[l.id]) return CITY_TIER[l.id];
  if (l.minor) return 1;
  if (l.type === 'city') return l.major ? 3 : 2;
  if (l.type === 'sect') return 3;
  if (l.type === 'isle') return l.major ? 3 : 2;
  return l.id === 'tainan' ? 2 : 1;
}
/** 地点的坊市档次（= 城池档次） */
export function shopLevel(l: LocDef): number { return cityTier(l); }
/** 拍卖会档次：3 小城 · 4 大城 · 5 雄城 · 6 天下名城 */
export function auctionLevel(l: LocDef): number { const t = cityTier(l); return t >= 5 ? 6 : t >= 4 ? 5 : t >= 3 ? 4 : 3; }
