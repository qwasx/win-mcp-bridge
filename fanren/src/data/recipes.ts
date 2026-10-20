// 丹方：主辅药、年份要求、基础成丹率
export interface RecipeInput { id: string; n: number; minAge?: number }
/** 第四十步：特殊炼制——青竹蜂云剑的首炼、续炼（每根金雷竹添十二口，至七十二口）与庚精淬剑（大庚剑阵） */
export type RecipeSpecial = 'qz' | 'qz_add' | 'qz_geng';
export interface Recipe { id: string; name: string; out: string; outN: number; inputs: RecipeInput[]; base: number; days: number; reqRealm: number; desc: string; kind?: 'pill' | 'forge'; special?: RecipeSpecial }

export const RECIPES: Recipe[] = [
  { id: 'r_juqi', name: '聚气丹', out: 'pill_juqi', outN: 1, inputs: [{ id: 'herb_huangjing', n: 2 }], base: 0.6, days: 3, reqRealm: 1, desc: '炼气期常用，增修为、助冲关。' },
  { id: 'r_huiqi', name: '回气丹', out: 'pill_huiqi', outN: 2, inputs: [{ id: 'herb_lingzhi', n: 1 }, { id: 'herb_huangjing', n: 1 }], base: 0.7, days: 2, reqRealm: 1, desc: '迅速恢复法力。' },
  { id: 'r_liaoshang', name: '疗伤丹', out: 'pill_liaoshang', outN: 2, inputs: [{ id: 'herb_jinxin', n: 2 }], base: 0.7, days: 2, reqRealm: 1, desc: '迅速恢复气血。' },
  { id: 'r_huanglong', name: '黄龙丹', out: 'pill_huanglong', outN: 1, inputs: [{ id: 'herb_lingzhi', n: 2, minAge: 50 }, { id: 'herb_jinxin', n: 1 }], base: 0.5, days: 5, reqRealm: 1, desc: '药力浑厚，炼气期大增修为。需五十年以上赤灵芝。' },
  { id: 'r_jinsui', name: '金髓丸', out: 'pill_jinsui', outN: 1, inputs: [{ id: 'herb_jinxin', n: 2, minAge: 60 }, { id: 'herb_huangjing', n: 2, minAge: 60 }, { id: 'mat_lingquan', n: 1 }], base: 0.45, days: 6, reqRealm: 1, desc: '洗练经脉，增加修为。' },
  { id: 'r_dingyan', name: '定颜丹', out: 'pill_dingyan', outN: 1, inputs: [{ id: 'herb_xuelian', n: 1 }, { id: 'herb_huangjing', n: 2, minAge: 30 }], base: 0.4, days: 6, reqRealm: 1, desc: '容颜永驻，女修梦寐以求。' },
  { id: 'r_zhuji', name: '筑基丹', out: 'pill_zhuji', outN: 1, inputs: [{ id: 'herb_zihou', n: 1, minAge: 100 }, { id: 'herb_tianling', n: 1, minAge: 100 }, { id: 'herb_huangjing', n: 3, minAge: 100 }], base: 0.2, days: 10, reqRealm: 1, desc: '冲击筑基必备。主药皆需百年以上药龄——掌天瓶可催熟。' },
  { id: 'r_juling', name: '聚灵丹', out: 'pill_juling', outN: 1, inputs: [{ id: 'herb_xuelian', n: 1, minAge: 100 }, { id: 'herb_lingzhi', n: 2, minAge: 100 }], base: 0.35, days: 8, reqRealm: 2, desc: '筑基期增长修为，冲击小瓶颈。' },
  // 以妖丹入药（第十五步）
  { id: 'r_yanghun2', name: '养魂丹（鼠目方）', out: 'pill_yanghun', outN: 1, inputs: [{ id: 'mat_shuangtongmu', n: 3 }, { id: 'mat_yaodan3', n: 1 }, { id: 'mat_lingquan', n: 1 }], base: 0.3, days: 10, reqRealm: 2, desc: '以双瞳鼠神目代替冰魄草，温养神魂、提升神识。' },
  { id: 'r_jiangchen', name: '降尘丹', out: 'pill_jiangchen', outN: 1, inputs: [{ id: 'herb_huolong', n: 1, minAge: 300 }, { id: 'mat_yaodan5', n: 1 }, { id: 'mat_lingquan', n: 2 }], base: 0.25, days: 15, reqRealm: 2, desc: '结丹辅助圣药。主药为三百年火龙果，佐以五级妖丹。' },
  { id: 'r_ningyuan', name: '凝元丹', out: 'pill_ningyuan', outN: 1, inputs: [{ id: 'herb_bingpo', n: 1, minAge: 100 }, { id: 'mat_yaodan5', n: 1 }], base: 0.4, days: 10, reqRealm: 3, desc: '结丹期增长修为。' },
  { id: 'r_jiuqu', name: '九曲灵参丹', out: 'pill_jiuqu', outN: 1, inputs: [{ id: 'herb_jiuqu', n: 1 }, { id: 'mat_yaodan6', n: 1 }, { id: 'mat_lingquan', n: 2 }], base: 0.3, days: 30, reqRealm: 3, desc: '结婴圣药。九曲灵参会化形遁走，须敛息靠近、一击得手。' },
  // 第四十步：元婴期丹方（八、九级妖丹终于有了用处）
  { id: 'r_yuanling', name: '元灵丹', out: 'pill_yuanling', outN: 1, inputs: [{ id: 'herb_yangshen', n: 1 }, { id: 'mat_yaodan8', n: 1 }, { id: 'mat_lingquan', n: 3 }], base: 0.3, days: 30, reqRealm: 4, desc: '元婴期增长修为。主药万年灵乳，佐以八级妖丹。' },
  { id: 'r_zifu', name: '紫府玄元丹', out: 'pill_zifu', outN: 1, inputs: [{ id: 'herb_jiuqu', n: 1 }, { id: 'mat_yaodan9', n: 1 }, { id: 'herb_yangshen', n: 1 }], base: 0.22, days: 45, reqRealm: 4, desc: '元婴圣药。九曲灵参为君，九级妖丹为臣。' },
  { id: 'r_wanshou', name: '万寿丹', out: 'pill_wanshou', outN: 1, inputs: [{ id: 'herb_xuejing', n: 2, minAge: 1000 }, { id: 'mat_yaodan7', n: 1 }, { id: 'mat_lingquan', n: 2 }], base: 0.3, days: 30, reqRealm: 4, desc: '增寿六十载。需千年血精草——掌天瓶可催熟。' },
  { id: 'r_ningpo', name: '凝魄丹', out: 'pill_ningpo', outN: 1, inputs: [{ id: 'mat_yanghunmu', n: 1 }, { id: 'mat_yaodan7', n: 1 }, { id: 'herb_bingpo', n: 1, minAge: 500 }], base: 0.3, days: 25, reqRealm: 4, desc: '以养魂木温养神魂，神识大进。' },
  { id: 'r_peiying', name: '培婴丹', out: 'pill_peiying', outN: 1, inputs: [{ id: 'mat_yinzhima', n: 1 }, { id: 'herb_xuejing', n: 1, minAge: 300 }, { id: 'mat_yaodan7', n: 1 }], base: 0.2, days: 30, reqRealm: 3, desc: '结婴圣药之一。主药是极难捕捉的阴芝马血肉。' },
  { id: 'r_biyan', name: '碧焰酒', out: 'pill_biyan', outN: 1, inputs: [{ id: 'mat_shuanggongdu', n: 1 }, { id: 'mat_lingquan', n: 3 }, { id: 'herb_huolong', n: 1, minAge: 100 }], base: 0.35, days: 40, reqRealm: 3, desc: '以霜蚣寒毒酿酒，冰火相济，药力狂暴。' },
  { id: 'r_yanghun', name: '养魂丹', out: 'pill_yanghun', outN: 1, inputs: [{ id: 'herb_bingpo', n: 1, minAge: 200 }, { id: 'herb_xuejing', n: 1, minAge: 200 }, { id: 'mat_lingquan', n: 2 }], base: 0.25, days: 12, reqRealm: 2, desc: '温养神魂，永久提升神识。' },
  // ---------------- 炼器（需地火：城镇法器阁 / 宗门炼器房；野外以法力代火，成器率大减） ----------------
  { id: 'f_qingfeng', kind: 'forge', name: '青锋剑', out: 'art_qingfeng', outN: 1, inputs: [{ id: 'mat_tiejing', n: 8 }, { id: 'mat_yaodan1', n: 2 }], base: 0.6, days: 7, reqRealm: 1, desc: '最常见的飞剑。以铁精为胚，一级妖丹为引。' },
  { id: 'f_xuantie', kind: 'forge', name: '玄铁飞天盾', out: 'art_xuantie', outN: 1, inputs: [{ id: 'mat_xuantie', n: 4 }, { id: 'mat_tiejing', n: 6 }, { id: 'mat_yaodan2', n: 1 }], base: 0.45, days: 10, reqRealm: 1, desc: '沉重的玄铁盾，可飞旋护身。' },
  { id: 'f_tayun', kind: 'forge', name: '踏云靴', out: 'art_tayun', outN: 1, inputs: [{ id: 'mat_yunchiyu', n: 6 }, { id: 'mat_xuanyu', n: 2 }, { id: 'mat_yaodan2', n: 1 }], base: 0.4, days: 10, reqRealm: 1, desc: '以云翅鸟羽织入靴底，身轻如云。' },
  { id: 'f_wulong', kind: 'forge', name: '乌龙夺', out: 'art_wulong', outN: 1, inputs: [{ id: 'mat_mojiaozhao', n: 2 }, { id: 'mat_chitong', n: 4 }, { id: 'mat_yaodan3', n: 1 }], base: 0.4, days: 14, reqRealm: 2, desc: '原著中韩立以墨蛟之爪炼成，乌光如龙，专破护体灵光。' },
  { id: 'f_shenfeng', kind: 'forge', name: '神风舟', out: 'art_shenfeng', outN: 1, inputs: [{ id: 'mat_mojiaoqi', n: 2 }, { id: 'mat_xuantie', n: 2 }, { id: 'mat_yaodan4', n: 1 }], base: 0.35, days: 20, reqRealm: 2, desc: '原著中韩立以墨蛟鳍炼成的飞行法器，炼气期亦可驾驭。' },
  { id: 'f_qingning', kind: 'forge', name: '青凝镜', out: 'art_qingning', outN: 1, inputs: [{ id: 'mat_qianmuyan', n: 2 }, { id: 'mat_xuanyu', n: 4 }, { id: 'mat_yaodan5', n: 1 }], base: 0.35, days: 20, reqRealm: 2, desc: '以千目妖眼珠磨入镜心，青光照处幻术无所遁形。' },
  { id: 'f_languang', kind: 'forge', name: '蓝光盾', out: 'art_languang', outN: 1, inputs: [{ id: 'mat_tujiapi', n: 1 }, { id: 'mat_xuantie', n: 4 }, { id: 'mat_yaodan6', n: 1 }], base: 0.3, days: 30, reqRealm: 3, desc: '以土甲龙厚皮为里、玄铁为表的护身法宝。' },
  { id: 'f_zibing', kind: 'forge', name: '紫冰镯', out: 'art_zibing', outN: 1, inputs: [{ id: 'mat_bingjialin', n: 2 }, { id: 'mat_xuanyu', n: 4 }, { id: 'mat_yaodan7', n: 1 }], base: 0.3, days: 30, reqRealm: 3, desc: '冰甲蟒鳞炼成的寒属法宝。' },
  { id: 'f_huanglin', kind: 'forge', name: '皇鳞甲', out: 'art_huanglin', outN: 1, inputs: [{ id: 'mat_dujiaolin', n: 3 }, { id: 'mat_yaodan8', n: 1 }], base: 0.3, days: 40, reqRealm: 3, desc: '以八级毒蛟鳞片缀成的宝甲。' },
  { id: 'f_sanyan', kind: 'forge', name: '三焰扇', out: 'art_sanyan', outN: 1, inputs: [{ id: 'mat_chihuolin', n: 6 }, { id: 'mat_zhijiao', n: 4 }, { id: 'mat_yaodan6', n: 2 }], base: 0.25, days: 60, reqRealm: 3, desc: '以赤火蛟鳞为扇骨的火属法宝，扇出三色灵焰。' },
  { id: 'f_fenglei', kind: 'forge', name: '风雷翅', out: 'art_fenglei', outN: 1, inputs: [{ id: 'mat_leipenggu', n: 1 }, { id: 'mat_jinleizhu', n: 1 }, { id: 'mat_yaodan9', n: 1 }], base: 0.35, days: 90, reqRealm: 3, desc: '以辟邪神雷（金雷竹）炼化雷鹏骨翅——原著中韩立便是如此将风雷翅认主。可施雷遁。' },
  // 第四十步：青竹蜂云剑（原著：六根万年金雷竹炼成七十二口；一根约炼十二口）
  { id: 'f_qingzhu', kind: 'forge', special: 'qz', name: '青竹蜂云剑（首炼十二口）', out: 'art_qingzhu', outN: 12, inputs: [{ id: 'mat_jinleizhu', n: 1 }, { id: 'mat_xuantie', n: 6 }, { id: 'mat_yaodan6', n: 1 }], base: 0.55, days: 60, reqRealm: 3, desc: '将万年金雷竹炼成纯净竹液，布下法阵融入火柱，制成剑胚后刻印微型法阵——十二口青竹蜂云剑，剑中自蕴辟邪神雷。（炼成即悟《辟邪神雷》）' },
  { id: 'f_qingzhu_add', kind: 'forge', special: 'qz_add', name: '青竹蜂云剑（续炼十二口）', out: 'art_qingzhu', outN: 12, inputs: [{ id: 'mat_jinleizhu', n: 1 }, { id: 'mat_xuantie', n: 4 }, { id: 'mat_yaodan6', n: 1 }], base: 0.6, days: 45, reqRealm: 3, desc: '再以一根金雷竹续炼十二口，与原有飞剑合为一套。原著中韩立炼足了七十二口。（剑数越多，一次祭出的飞剑越多）' },
  { id: 'f_qz_geng', kind: 'forge', special: 'qz_geng', name: '庚精淬剑（大庚剑阵）', out: 'art_qingzhu', outN: 72, inputs: [{ id: 'mat_gengjing', n: 2 }, { id: 'mat_yaodan7', n: 1 }], base: 0.5, days: 60, reqRealm: 3, desc: '七十二口青竹蜂云剑凑齐之后，将庚精熔入剑身，飞剑坚韧锋利大增，方可布下青元剑诀的大庚剑阵。（原著：庚精先后得自阗天城、大晋京城拍卖会等处）' },
];
