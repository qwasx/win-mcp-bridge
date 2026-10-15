// 人界地理数据
// 坐标系：宏观坐标 1000 x 700，乘以 WORLD_SCALE 得到世界坐标（像素）
// 布局参考原著及网络流传的《凡人修仙传》人界地图：
//   北部大晋（人界第一大国）→ 中部天澜草原 → 西南天南（韩立故乡）→ 天南以西极西之地
//   天南以东隔无边海为乱星海（内星海以天星城为中心，外星海妖兽横行）
// 第十六步起：人界拆为三张独立地图（天南 / 乱星海 / 大晋）。下面的原始数据仍是“旧版统一地图”的宏观坐标（称为
// legacy 坐标），每张地图按各自的平移 + 缩放把属于自己的部分摊开到整张图上，见文件末尾的 buildMap。
export const WORLD_SCALE = 300;   // 每宏观单位 300 像素（各图一致）

export type P = [number, number];

// 主大陆轮廓（大晋 + 天澜草原 + 天南 + 极西之地）
const RAW_MAINLAND: P[] = [
  [62, 70], [110, 48], [168, 40], [230, 50], [290, 36], [360, 30], [430, 42], [500, 34], [570, 30], [640, 44],
  [700, 52], [748, 72], [782, 104], [792, 140], [770, 168], [744, 186], [752, 212], [742, 240], [712, 262],
  [668, 268], [646, 292], [612, 318], [596, 352], [586, 392], [578, 430], [584, 468], [570, 500], [566, 530],
  [578, 560], [566, 596], [552, 630], [530, 652], [494, 664], [452, 658], [410, 668], [366, 664], [318, 670],
  [276, 662], [236, 668], [196, 656], [160, 640], [130, 618], [112, 630], [86, 626], [52, 612], [30, 580],
  [22, 540], [34, 498], [26, 456], [44, 412], [38, 368], [60, 326], [54, 284], [74, 240], [58, 196], [48, 150], [44, 108],
];

// 内陆湖泊
const RAW_LAKES: { c: P; r: number; name?: string }[] = [
  { c: [420, 175], r: 10, name: '晋湖' },
  { c: [300, 312], r: 7 },
  { c: [470, 598], r: 4 },
  { c: [212, 210], r: 6 },
];

// 山脉（折线 + 宽度 + 高度）
const RAW_RANGES: { pts: P[]; w: number; h: number; name?: string }[] = [
  { pts: [[90, 72], [180, 62], [280, 58], [380, 52], [480, 56], [580, 54], [680, 76]], w: 26, h: 1.0, name: '北寒雪岭' },
  { pts: [[200, 158], [260, 176], [320, 190], [380, 160]], w: 16, h: 0.8 },
  { pts: [[690, 110], [715, 130], [735, 150]], w: 18, h: 1.0, name: '昆吾山' },
  { pts: [[540, 120], [580, 150], [600, 210]], w: 14, h: 0.7 },
  { pts: [[150, 244], [240, 252], [350, 240], [470, 254], [580, 248], [650, 262]], w: 14, h: 0.65 },
  { pts: [[118, 392], [108, 440], [112, 500], [104, 560], [118, 612]], w: 18, h: 0.95, name: '天南西岭' },
  { pts: [[160, 450], [196, 500], [184, 560], [200, 620]], w: 16, h: 0.75 },
  { pts: [[268, 520], [294, 560], [318, 600]], w: 14, h: 0.8, name: '坠魔山' },
  { pts: [[500, 528], [522, 552], [534, 576], [526, 606]], w: 12, h: 0.85, name: '太岳山脉' },
  { pts: [[430, 470], [460, 488], [500, 486]], w: 9, h: 0.55 },
  { pts: [[220, 378], [320, 372], [420, 380], [540, 376]], w: 10, h: 0.5 },
  { pts: [[60, 470], [70, 520]], w: 10, h: 0.5 },
];

// 河流
const RAW_RIVERS: { pts: P[]; w: number }[] = [
  { pts: [[300, 440], [350, 470], [410, 512], [452, 548], [500, 590], [540, 628], [566, 646]], w: 1.4 },
  { pts: [[468, 520], [480, 560], [492, 600], [510, 640], [520, 664]], w: 1.0 },
  { pts: [[290, 96], [350, 130], [420, 170], [490, 196], [560, 206], [650, 222], [742, 236]], w: 1.6 },
  { pts: [[240, 300], [300, 312], [360, 300], [430, 318], [520, 330], [600, 334]], w: 1.0 },
  { pts: [[180, 470], [230, 520], [260, 600], [276, 662]], w: 1.1 },
  { pts: [[400, 70], [410, 120], [420, 165]], w: 0.9 },
];

// 干旱（草原/荒漠）、严寒、森林区域
const RAW_ARID: { pts: P[]; v: number }[] = [
  { pts: [[190, 262], [640, 262], [620, 368], [210, 372]], v: 0.7 },  // 天澜草原
  { pts: [[60, 120], [190, 130], [200, 240], [70, 236]], v: 1.0 },   // 大晋西漠
  { pts: [[25, 520], [100, 520], [100, 615], [35, 600]], v: 0.9 },   // 极西荒漠
];
const RAW_COLD: { pts: P[]; v: number }[] = [
  { pts: [[40, 30], [800, 30], [800, 96], [40, 104]], v: 1.0 },
];
const RAW_FOREST: { pts: P[]; v: number }[] = [
  { pts: [[420, 480], [570, 480], [570, 660], [420, 660]], v: 0.8 },  // 越国
  { pts: [[250, 430], [420, 430], [420, 660], [250, 660]], v: 0.6 },
  { pts: [[120, 420], [250, 420], [250, 650], [120, 650]], v: 0.55 },
  { pts: [[260, 100], [700, 100], [700, 240], [260, 240]], v: 0.55 }, // 大晋腹地
];

// 命名区域（用于显示当前位置；按顺序匹配，越靠前越优先）
export interface Region { id: string; name: string; parent: string; pts: P[]; label?: P; labelSize?: number }
const RAW_REGIONS: Region[] = [
  { id: 'yue', name: '越国', parent: '天南', pts: [[425, 495], [575, 495], [580, 670], [425, 670]], label: [500, 640], labelSize: 1 },
  { id: 'yuanwu', name: '元武国', parent: '天南', pts: [[425, 428], [585, 428], [580, 495], [425, 495]], label: [500, 455], labelSize: 1 },
  { id: 'cheqi', name: '车骑国', parent: '天南', pts: [[335, 520], [425, 520], [425, 670], [335, 670]], label: [380, 620], labelSize: 1 },
  { id: 'zijin', name: '紫金国', parent: '天南', pts: [[335, 428], [425, 428], [425, 520], [335, 520]], label: [375, 440], labelSize: 1 },
  { id: 'tiandao', name: '天道盟', parent: '天南', pts: [[250, 428], [335, 428], [335, 560], [250, 560]], label: [292, 445], labelSize: 1 },
  { id: 'zhuimo', name: '坠魔谷一带', parent: '天南', pts: [[250, 560], [335, 560], [335, 670], [250, 670]], label: [290, 640], labelSize: 1 },
  { id: 'modao', name: '魔道六宗', parent: '天南', pts: [[118, 428], [250, 428], [250, 670], [118, 670]], label: [185, 445], labelSize: 1 },
  { id: 'jiuguo', name: '九国盟', parent: '天南', pts: [[118, 368], [600, 368], [600, 428], [118, 428]], label: [300, 400], labelSize: 1 },
  { id: 'jixi', name: '极西之地', parent: '极西', pts: [[0, 360], [118, 360], [118, 680], [0, 680]], label: [65, 420], labelSize: 1.3 },
  { id: 'tianlan', name: '天澜草原', parent: '天澜草原', pts: [[60, 255], [680, 255], [640, 368], [60, 368]], label: [420, 342], labelSize: 1.6 },
  { id: 'dajin', name: '大晋', parent: '大晋', pts: [[0, 0], [820, 0], [820, 255], [0, 255]], label: [440, 120], labelSize: 2.4 },
  { id: 'luanxing_inner', name: '内星海', parent: '乱星海', pts: circlePts(815, 500, 105), label: [815, 560], labelSize: 1.2 },
  { id: 'luanxing_outer', name: '外星海', parent: '乱星海', pts: [[650, 290], [1000, 290], [1000, 700], [650, 700]], label: [930, 670], labelSize: 1.2 },
  { id: 'wubian', name: '无边海', parent: '无边海', pts: [[560, 260], [650, 260], [650, 700], [560, 700]], label: [610, 470], labelSize: 1.4 },
  { id: 'beihai', name: '北海', parent: '北海', pts: [[0, 0], [1000, 0], [1000, 290], [0, 290]], label: [880, 160], labelSize: 1.4 },
];
function circlePts(cx: number, cy: number, r: number): P[] {
  const pts: P[] = [];
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}

// 大区域标签（缩小地图时显示的大字）
const RAW_BIG_LABELS: { name: string; at: P; size: number }[] = [
  { name: '大晋', at: [430, 140], size: 5 },
  { name: '天澜草原', at: [420, 310], size: 3.2 },
  { name: '天南', at: [330, 520], size: 4.5 },
  { name: '极西之地', at: [66, 470], size: 2.2 },
  { name: '乱星海', at: [840, 420], size: 4 },
  { name: '无边海', at: [612, 520], size: 2.4 },
];

// 地点
export type LocType = 'city' | 'town' | 'sect' | 'danger' | 'secret' | 'isle';
export interface LocDef {
  id: string; name: string; type: LocType; x: number; y: number;
  desc: string; major?: boolean; island?: number; // island: 生成岛屿半径（宏观单位）
  scale?: number;
  minor?: boolean;          // 程序生成的小地点（村落 / 洞府 / 妖兽巢穴）
  danger?: number;          // 危险等级 0–5（决定妖兽强弱）
  map: MapId;               // 所在地图
  ox: number; oy: number;   // 旧版统一地图上的坐标（沿用旧的区域规则）
}
type RawLoc = Omit<LocDef, 'map' | 'ox' | 'oy'> & { map?: MapId };

const RAW_LOCATIONS: RawLoc[] = [
  // ===== 越国 =====
  { id: 'qixuan', name: '七玄门', type: 'sect', x: 505, y: 598, scale: 0.75, major: true, desc: '越国镜州彩霞山上的江湖门派。韩立少年时在此做记名弟子，结识墨大夫与厉飞雨，也是一切的起点。' },
  { id: 'qingniu', name: '青牛镇', type: 'town', x: 520, y: 614, desc: '韩立家乡附近的小镇，民风淳朴。' },
  { id: 'jingzhou', name: '镜州城', type: 'city', x: 490, y: 606, desc: '越国南部州城，七玄门的势力范围。' },
  { id: 'jiayuan', name: '嘉元城', type: 'city', x: 468, y: 566, major: true, desc: '越国大城，墨府所在，墨大夫的家眷居于此。' },
  { id: 'yuejing', name: '越京', type: 'city', x: 482, y: 532, major: true, desc: '越国京城，凡人繁华之地，暗中亦有修仙坊市。' },
  { id: 'huangfeng', name: '黄枫谷', type: 'sect', x: 524, y: 552, major: true, desc: '越国七派之一，坐落太岳山脉。韩立筑基前后所在的宗门，李化元一脉。' },
  { id: 'yanyue', name: '掩月宗', type: 'sect', x: 447, y: 518, major: true, desc: '越国七派之首，女修众多，南宫婉出身于此。' },
  { id: 'lingshou', name: '灵兽山', type: 'sect', x: 540, y: 512, desc: '越国七派之一，擅长驭使灵兽灵虫。' },
  { id: 'qingxu', name: '清虚门', type: 'sect', x: 446, y: 602, desc: '越国七派之一，道家清修之门。' },
  { id: 'huadao', name: '化刀坞', type: 'sect', x: 468, y: 632, desc: '越国七派之一，以刀修闻名。' },
  { id: 'tianque', name: '天阙堡', type: 'sect', x: 548, y: 584, desc: '越国七派之一，堡垒森严。' },
  { id: 'jujian', name: '巨剑门', type: 'sect', x: 452, y: 576, desc: '越国七派之一，门人多使巨剑。' },
  { id: 'tainan', name: '太南山', type: 'town', x: 502, y: 516, desc: '散修聚集之地，太南小会在此举行，可交易法器丹药、打探消息。' },
  { id: 'xuese', name: '血色禁地', type: 'secret', x: 486, y: 498, major: true, desc: '越国七派共管的禁地，每五年开启一次，只许炼气弟子进入。内有筑基丹主药，亦是韩立与南宫婉初遇之地。' },
  { id: 'yanling', name: '燕翎堡', type: 'town', x: 434, y: 552, desc: '燕家堡垒，曾举办夺宝大会，天南各派齐聚。' },
  { id: 'taiyue', name: '太岳山脉深处', type: 'danger', x: 534, y: 596, desc: '妖兽出没的深山，常有修士入山猎妖采药。' },
  // ===== 元武国 / 车骑国 / 紫金国 =====
  { id: 'yuanwu', name: '元武城', type: 'city', x: 488, y: 462, desc: '元武国都城，修仙坊市林立。' },
  { id: 'chuansong', name: '灵石矿洞·古传送阵', type: 'secret', x: 497, y: 524, major: true, desc: '越京城外废弃灵石矿洞深处的上古传送阵。须持“大挪移令”并耗费大量灵石方能开启，可直通乱星海——原著中韩立被鬼灵门少主王蝉追杀，便是由此远遁。' },
  { id: 'cheqi', name: '车骑城', type: 'city', x: 382, y: 590, desc: '车骑国都城。' },
  { id: 'zijin', name: '紫金城', type: 'city', x: 382, y: 476, desc: '紫金国都城，商旅往来不绝。' },
  // ===== 天道盟 / 坠魔谷 =====
  { id: 'luoyun', name: '落云宗', type: 'sect', x: 292, y: 472, major: true, desc: '天道盟三派之一，灵药园闻名天南。韩立结婴后曾在此担任长老。' },
  { id: 'gujian', name: '古剑门', type: 'sect', x: 268, y: 524, desc: '天道盟三派之一，剑修圣地。' },
  { id: 'baiqiao', name: '百巧院', type: 'sect', x: 320, y: 506, desc: '天道盟三派之一，擅炼傀儡机关。' },
  { id: 'zhuimo', name: '坠魔谷', type: 'danger', x: 300, y: 592, major: true, desc: '天南第一凶地，上古魔修陨落之处，内有空间裂缝与古魔残魂。' },
  // ===== 魔道六宗 =====
  { id: 'guiling', name: '鬼灵门', type: 'sect', x: 170, y: 470, desc: '魔道六宗之一，驭使鬼物。' },
  { id: 'hehuan', name: '合欢宗', type: 'sect', x: 222, y: 500, desc: '魔道六宗之一，修双修采补之术，门中多妖娆女修。' },
  { id: 'yuling', name: '御灵宗', type: 'sect', x: 160, y: 560, desc: '魔道六宗之一，擅长血祭灵兽。' },
  { id: 'qianhuan', name: '千幻宗', type: 'sect', x: 212, y: 612, desc: '魔道六宗之一，以幻术见长。' },
  { id: 'tiansha', name: '天煞宗', type: 'sect', x: 176, y: 628, desc: '魔道六宗之一，杀伐果决。' },
  { id: 'yinluo', name: '阴罗宗', type: 'sect', x: 228, y: 560, major: true, desc: '魔道六宗之一，镇宗之宝鬼罗幡以数十万生魂祭炼。' },
  // ===== 九国盟 =====
  { id: 'tiantian', name: '阗天城', type: 'city', x: 380, y: 394, major: true, desc: '九国盟对抗慕兰法士的第一线，修士云集，战事不断。' },
  { id: 'huayi', name: '化意门', type: 'sect', x: 452, y: 406, desc: '九国盟盟主宗门，大长老精通毒道。' },
  // ===== 极西之地 =====
  { id: 'qianzhu', name: '千竹教', type: 'sect', x: 62, y: 476, major: true, desc: '大衍神君所创之教，傀儡之术独步人界，《大衍诀》即出于此。' },
  { id: 'jixi_desert', name: '极西荒漠', type: 'danger', x: 58, y: 566, desc: '黄沙漫天的不毛之地，沙中埋有上古修士遗骸。' },
  // ===== 天澜草原 =====
  { id: 'tianlan', map: 'dajin', name: '天澜圣殿', type: 'sect', x: 430, y: 300, major: true, desc: '慕兰法士的圣地，供奉天澜圣兽。' },
  { id: 'tuwu', map: 'dajin', name: '突兀部落', type: 'town', x: 300, y: 300, desc: '草原游牧部族，与慕兰人世代争斗。' },
  { id: 'mulan', name: '慕兰部落', type: 'town', x: 560, y: 312, desc: '慕兰人的大部落，法士之乡。慕兰与天南时战时和，再往北便是突兀人的天澜草原。' },
  { id: 'caoyuan', name: '草原深处', type: 'danger', x: 370, y: 336, desc: '草原深处妖狼成群，风沙之中暗藏杀机。' },
  // ===== 大晋 =====
  { id: 'jinjing', name: '晋京', type: 'city', x: 440, y: 152, major: true, desc: '大晋京城，人界第一大城，各大世家与宗门的势力交汇于此。' },
  { id: 'tianmo', name: '天魔宗', type: 'sect', x: 240, y: 122, major: true, desc: '大晋十大魔宗之首，有化神期老怪坐镇。' },
  { id: 'taiyi', name: '太一门', type: 'sect', x: 520, y: 96, desc: '大晋正道大派。' },
  { id: 'yejia', name: '叶家', type: 'town', x: 330, y: 204, desc: '大晋顶级修仙世家之一，家族中有元婴修士坐镇。' },
  { id: 'yinyang', name: '阴阳窟', type: 'danger', x: 604, y: 192, desc: '大晋有名的凶地，阴阳二气交汇，常有异宝出世。' },
  { id: 'kunwu', name: '昆吾山', type: 'secret', x: 718, y: 136, major: true, desc: '上古镇压魔物的古山，昆吾殿所在，人界顶级秘境。' },
  { id: 'beihan', name: '北寒雪原', type: 'danger', x: 300, y: 70, desc: '终年冰封的雪原，冰属妖兽横行。' },
  { id: 'xi_mo', name: '大晋西漠', type: 'danger', x: 130, y: 182, desc: '风沙蔽日的大漠。' },
  { id: 'shuozhou', map: 'dajin', name: '朔州城', type: 'city', x: 374, y: 246, major: true, desc: '大晋南疆的州城，舜江自天澜草原流入大晋境内。原著中韩立冰封于舜江漂流一年，便是在朔州一带被曹家所救。' },
  { id: 'youzhou', name: '幽州城', type: 'city', x: 318, y: 118, desc: '大晋北方重镇，北望雪岭，城中多猎妖修士与收购冰属材料的商号。' },
  { id: 'yunzhou', name: '云州城', type: 'city', x: 566, y: 150, desc: '大晋东部大城，坊市繁华，常有世家子弟在此斗宝。' },
  { id: 'qinzhou', name: '秦州城', type: 'city', x: 236, y: 196, desc: '大晋西陲州城，再往西便是风沙蔽日的西漠。' },
  { id: 'xiangzhou', name: '襄州城', type: 'city', x: 610, y: 236, desc: '大晋南部商埠，与草原诸部互市。' },
  { id: 'jin_fangshi', name: '落霞坊市', type: 'town', x: 486, y: 214, desc: '大晋散修聚集的坊市，丹药、法器、消息应有尽有，鱼龙混杂。' },
  { id: 'caojia', map: 'dajin', name: '曹家', type: 'town', x: 394, y: 238, desc: '朔州城外的凡人家族，世代经商，家中小姐曹梦容心地良善。' },
  // ===== 无边海 =====
  { id: 'xutian', name: '虚天殿', type: 'secret', x: 636, y: 352, major: true, island: 9, desc: '冰魄仙子所留的上古殿宇，每隔一段时间现世一次。内藏虚天鼎与补天丹，元婴老怪亦为之疯狂。' },
  // ===== 乱星海 =====
  { id: 'tianxing', name: '天星城', type: 'city', x: 815, y: 500, major: true, island: 28, scale: 1.3, desc: '乱星海第一大城，建于圣山之上，星宫总坛所在，天星双圣坐镇。' },
  { id: 'chuansong_lx', map: 'luanxing', name: '魁星岛·上古传送阵', type: 'secret', x: 727, y: 476, major: true, desc: '魁星岛外荒礁上的上古传送阵，与天南越国的古阵遥相呼应。同样以大挪移令与灵石开启，可回天南。' },
  { id: 'kuixing', name: '魁星岛', type: 'isle', x: 734, y: 468, major: true, island: 13, desc: '内外星海交界的大岛，魁星城商贾云集，猎妖修士在此出海。' },
  { id: 'jiyin', name: '极阴岛', type: 'isle', x: 776, y: 604, major: true, island: 12, desc: '极阴祖师的老巢，乱星海魔道重地。' },
  { id: 'miaoyin', name: '妙音门', type: 'isle', x: 872, y: 560, major: true, island: 10, desc: '乱星海门派，以音律与媚术闻名，紫灵仙子出身于此。' },
  { id: 'biling', name: '碧灵岛', type: 'isle', x: 882, y: 440, island: 9, desc: '盛产灵矿的岛屿。' },
  { id: 'leikong', name: '雷空岛', type: 'isle', x: 760, y: 404, island: 9, desc: '雷云常年不散的岛屿，可采集高阶灵石。' },
  { id: 'xiaohuan', name: '小寰岛', type: 'isle', x: 704, y: 546, island: 8, desc: '偏僻小岛，散修聚居。' },
  { id: 'huangming', name: '皇明岛', type: 'isle', x: 906, y: 506, island: 8, desc: '内星海边缘的岛屿。' },
  { id: 'qiyuan', name: '奇渊岛', type: 'isle', x: 936, y: 630, major: true, island: 10, desc: '外星海猎妖修士的据点，再往外便是妖兽的天下。' },
  { id: 'wuzhong', name: '雾中岛', type: 'isle', x: 958, y: 560, island: 7, desc: '终年被浓雾笼罩的小岛。' },
  { id: 'haiyuan', name: '海猿岛', type: 'isle', x: 700, y: 624, island: 7, desc: '海猿出没的荒岛，人迹罕至。' },
  { id: 'waihai', name: '外海妖域', type: 'danger', x: 962, y: 396, island: 8, desc: '外星海深处，高阶妖兽盘踞，风暴不息。' },
];


// ---------- 小地点名字表 ----------
import { mulberry32 } from '../core/rng';
const SURN = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '潘', '袁', '蔡', '蒋', '余', '叶', '程', '苏', '魏', '吕', '丁', '沈', '任', '姚', '卢'];
const VSUF = ['家村', '家庄', '家集', '家坳', '家寨', '家湾', '家堡', '家店'];
const VNAT = ['柳溪村', '杏花村', '桃源村', '石桥镇', '落霞村', '清水镇', '青石村', '白鹭洲', '野狐岭村', '芦花荡', '枫林渡', '风铃镇', '卧牛村', '鹤鸣村', '云水镇', '小河村', '老槐村', '望山村', '月牙村', '沙河集', '梨花坞', '竹溪村', '浣纱溪', '松风镇', '百花村', '落雁集', '蓬溪村', '烟柳镇', '黄泥岗', '双河镇', '古井村', '红叶村', '渔歌渡', '雁回镇', '茶山村', '翠屏村', '飞泉村', '牧野集', '霜叶村', '采莲渡'];
const CAVES = ['古修洞府', '无名洞府', '青云洞', '栖霞洞', '紫霄洞', '残阵遗迹', '上古战场', '坐化之地', '藏宝秘窟', '灵眼之泉', '断剑崖', '炼丹古洞', '落仙台', '玄冰洞', '万灵古窟', '天机遗府', '星落坑', '散仙石室', '剑冢', '药王谷遗址', '古阵废墟', '归元洞', '幽泉秘境', '石林古阵', '千年古墓', '仙人棋盘', '紫竹幽谷', '云梦泽'];
const LAIRS = ['血狼谷', '黑风岭', '毒蛟潭', '铁甲蛇窟', '赤蜂林', '妖狐洞', '鬼哭林', '乱石坡', '阴风涧', '火蟾沼', '白骨岗', '豺狼原', '石魔窟', '瘴气林', '金蜈岭', '黑熊坳', '狐仙坡', '血蝠洞', '腐骨沼', '虎啸涧', '蛇盘山', '野猿林', '毒雾谷', '尸鬼坟'];
const LAIRS_COLD = ['冰狼原', '雪熊谷', '寒蛟渊', '霜鹰崖'];
const LAIRS_DRY = ['沙蝎窟', '毒蜥坡', '黄沙鬼域', '风蚀石林'];
const LAIRS_SEA = ['海妖礁', '鲛人滩', '巨蟹湾', '海蛇窟'];


export function pointInPoly(x: number, y: number, pts: P[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionAt(mx: number, my: number, onLand: boolean): Region | null {
  for (const r of REGIONS) {
    const sea = r.parent === '乱星海' || r.parent === '无边海' || r.parent === '北海';
    if (onLand && (r.id === 'wubian' || r.id === 'beihai')) continue;
    if (!onLand && !sea) continue;
    if (pointInPoly(mx, my, r.pts)) return r;
  }
  return null;
}

export const LOC_TYPE_NAME: Record<LocType, string> = {
  city: '城池', town: '集镇', sect: '宗门', danger: '险地', secret: '秘境', isle: '海岛',
};


// =====================================================================================
// 第十六步：三张地图
// =====================================================================================
export type MapId = 'tiannan' | 'luanxing' | 'dajin';
export const MAP_IDS: MapId[] = ['tiannan', 'luanxing', 'dajin'];
export const MAP_NAME: Record<MapId, string> = { tiannan: '天南', luanxing: '乱星海', dajin: '大晋' };

/** 每张图：取旧版统一地图上的一块（legacy 坐标）平移 + 缩放，铺满整张新图 */
interface MapSpec { ox: number; oy: number; sx: number; sy: number; W: number; H: number; rangeK: number; riverK: number }
const SPEC: Record<MapId, MapSpec> = {
  // 天南：原先只占统一地图西南一隅（约 620 × 430），现在线性放大 1.6 倍，独占整张 1000 × 700 的大图
  tiannan: { ox: 0, oy: 262, sx: 1.6, sy: 1.6, W: 1000, H: 700, rangeK: 1.3, riverK: 1.25 },
  // 乱星海：内外星海与无边海东缘，放大 2 倍，岛屿星罗棋布
  luanxing: { ox: 600, oy: 280, sx: 2.0, sy: 2.0, W: 800, H: 840, rangeK: 1, riverK: 1 },
  // 大晋：人界第一大国 + 北寒雪原 + 天澜草原北部；面积约为天南的 1.5 倍
  dajin: { ox: 0, oy: 0, sx: 1.46, sy: 2.65, W: 1200, H: 880, rangeK: 1.5, riverK: 1.25 },
};
export function toMap(id: MapId, x: number, y: number): P { const s = SPEC[id]; return [(x - s.ox) * s.sx, (y - s.oy) * s.sy]; }
export function fromMap(id: MapId, x: number, y: number): P { const s = SPEC[id]; return [x / s.sx + s.ox, y / s.sy + s.oy]; }

function pickMap(): MapId {
  const ok = (v: unknown): v is MapId => v === 'tiannan' || v === 'luanxing' || v === 'dajin';
  try { const v = (globalThis as any).__FANREN_MAP; if (ok(v)) return v; } catch { /* */ }
  try { const v = (globalThis as any).process?.env?.FANREN_MAP; if (ok(v)) return v; } catch { /* */ }
  try { const v = new URLSearchParams(location.search).get('map'); if (ok(v)) return v; } catch { /* */ }
  try { const v = localStorage.getItem('fanren.map'); if (ok(v)) return v; } catch { /* */ }
  return 'tiannan';
}
/** 当前加载的地图（整个程序生命周期内不变；换图 = 存档后重新载入） */
export const ACTIVE_MAP: MapId = pickMap();

/** 旧版统一地图上的一点属于哪张新图 */
export function legacyMapOf(x: number, y: number): MapId {
  if (x >= 600 && !pointInPoly(x, y, RAW_MAINLAND)) return 'luanxing';
  if (y < 262) return 'dajin';
  return 'tiannan';
}
/** 旧版世界坐标（像素）→ 新图与新坐标（像素），用于旧存档迁移、测试 */
export function fromLegacyWorld(wx: number, wy: number): { map: MapId; x: number; y: number } {
  const lx = wx / WORLD_SCALE, ly = wy / WORLD_SCALE, map = legacyMapOf(lx, ly), s = SPEC[map];
  const [mx, my] = toMap(map, lx, ly);
  return { map, x: Math.min(s.W - 2, Math.max(2, mx)) * WORLD_SCALE, y: Math.min(s.H - 2, Math.max(2, my)) * WORLD_SCALE };
}
/** legacy 宏观坐标若在当前图上，返回当前图宏观坐标 */
export function legacyHere(x: number, y: number): P | null { return legacyMapOf(x, y) === ACTIVE_MAP ? toMap(ACTIVE_MAP, x, y) : null; }
/** 当前图宏观坐标 → legacy 宏观坐标（沿用旧版按经纬划分的规则，如喀斯特山形、北方强敌） */
export function toLegacy(mx: number, my: number): P { return fromMap(ACTIVE_MAP, mx, my); }

// ---------- 几何工具 ----------
/** Sutherland–Hodgman：多边形裁剪到矩形 */
function clipPoly(pts: P[], x0: number, y0: number, x1: number, y1: number): P[] {
  const edges: [(p: P) => boolean, (a: P, b: P) => P][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = pts;
  for (const [inside, cut] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}
function bboxHits(pts: P[], x0: number, y0: number, x1: number, y1: number) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return c >= x0 && a <= x1 && d >= y0 && b <= y1;
}

// ---------- 各图独有的补充数据（legacy 坐标） ----------
const EXTRA_RIVERS: Partial<Record<MapId, { pts: P[]; w: number }[]>> = {
  // 舜江：自天澜草原北流入大晋朔州（原著韩立冰封漂流之江）
  dajin: [{ pts: [[452, 330], [430, 312], [404, 292], [384, 274], [370, 258], [352, 236], [330, 214], [318, 200]], w: 1.3 }],
};
// 大区域标签（legacy 坐标；size 为新图宏观单位下的字号系数）
const MAP_LABELS: Record<MapId, { name: string; at: P; size: number }[]> = {
  tiannan: [{ name: '天南', at: [330, 520], size: 6.5 }, { name: '慕兰草原', at: [420, 296], size: 3.6 }, { name: '极西之地', at: [62, 470], size: 3 }],
  luanxing: [{ name: '乱星海', at: [822, 420], size: 6 }, { name: '内星海', at: [815, 530], size: 3 }, { name: '外星海', at: [935, 650], size: 3 }, { name: '无边海', at: [626, 520], size: 2.6 }],
  dajin: [{ name: '大晋', at: [430, 150], size: 7.5 }, { name: '北寒雪原', at: [300, 66], size: 3.4 }, { name: '天澜草原', at: [470, 304], size: 3.6 }],
};
const MAP_REGIONS: Record<MapId, string[]> = {
  tiannan: ['yue', 'yuanwu', 'cheqi', 'zijin', 'tiandao', 'zhuimo', 'modao', 'jiuguo', 'jixi', 'tianlan', 'wubian'],
  luanxing: ['luanxing_inner', 'luanxing_outer', 'wubian'],
  dajin: ['dajin', 'tianlan', 'beihai'],
};
// 天南一侧的“天澜草原”南部其实是与天南结盟的慕兰人的地盘
const REGION_RENAME: Partial<Record<MapId, Record<string, { id: string; name: string; parent: string }>>> = {
  tiannan: { tianlan: { id: 'mulan', name: '慕兰草原', parent: '慕兰草原' } },
};
// 随机小岛：乱星海星罗棋布；天南东、南外海与大晋北海零星点缀（新图宏观坐标）
const ISLES: Record<MapId, { field?: { x0: number; y0: number; x1: number; y1: number; count: number }; extra: { x0: number; y0: number; x1: number; y1: number; n: number; r0: number; r1: number }[]; rk: number }> = {
  tiannan: { extra: [{ x0: 940, y0: 120, x1: 996, y1: 690, n: 18, r0: 1.2, r1: 3.6 }, { x0: 80, y0: 668, x1: 900, y1: 696, n: 12, r0: 1.2, r1: 3 }], rk: 1 },
  luanxing: { field: { x0: 110, y0: 30, x1: 792, y1: 832, count: 520 }, extra: [{ x0: 6, y0: 20, x1: 100, y1: 830, n: 30, r0: 1.2, r1: 3.2 }], rk: 1.5 },
  dajin: { extra: [{ x0: 30, y0: 6, x1: 1170, y1: 66, n: 22, r0: 1.5, r1: 4 }], rk: 1 },
};

export interface MapExit { edge: 'n' | 's' | 'e' | 'w'; to: MapId; days: number; title: string; text: string }
/** 走到地图边缘可前往的相邻地图（陆路）。乱星海只能经上古传送阵往来 */
export const MAP_EXITS: Record<MapId, MapExit[]> = {
  tiannan: [{ edge: 'n', to: 'dajin', days: 120, title: '北上大晋', text: '再往北，便是突兀人的天澜草原。横穿草原、顺舜江而下，就是人界第一大国——大晋。\n\n此去路途遥远，少说也要四个月；天澜圣殿高手如云，草原上元婴修士亦不罕见。原著中韩立以元婴中期修为闯草原，尚且九死一生。' }],
  dajin: [{ edge: 's', to: 'tiannan', days: 120, title: '南下天南', text: '向南穿过天澜草原与慕兰草原，便回到天南。路途约需四个月。' }],
  luanxing: [],
};
export const EDGE_BLOCK_TEXT: Record<MapId, string> = {
  tiannan: '前方是茫茫无边海，以你的遁速根本飞不到尽头。要去乱星海，须借越京城外灵石矿洞中的上古传送阵。',
  luanxing: '再往外便是无尽深海，妖兽横行、风暴不息，连元婴修士也不敢深入。回天南须借魁星岛的上古传送阵。',
  dajin: '前方已是人界尽头的荒寒之地，风雪如刀，再走下去有死无生。',
};
/** 传送阵：两端地点 id */
export const PORTALS: { a: string; b: string; minRealm: number; cost: number; token: string }[] = [
  { a: 'chuansong', b: 'chuansong_lx', minRealm: 2, cost: 600, token: 'tok_danuoyi' },
];

// ---------- 程序生成的小地点 ----------
interface MapData {
  id: MapId; W: number; H: number;
  mainland: P[]; lakes: typeof RAW_LAKES; ranges: typeof RAW_RANGES; rivers: typeof RAW_RIVERS;
  arid: typeof RAW_ARID; cold: typeof RAW_COLD; forest: typeof RAW_FOREST;
  regions: Region[]; labels: { name: string; at: P; size: number }[]; locations: LocDef[];
  islandField: { x0: number; y0: number; x1: number; y1: number; count: number } | null;
  extraIslands: { x0: number; y0: number; x1: number; y1: number; n: number; r0: number; r1: number }[];
  islandK: number;
}

function genMinor(M: MapData, seed: number, pre: string): LocDef[] {
  const rnd = mulberry32(seed);
  const out: LocDef[] = [];
  const all = () => M.locations.concat(out);
  const far = (x: number, y: number, d: number) => all().every((l) => Math.hypot(l.x - x, l.y - y) > d);
  const inLake = (x: number, y: number) => M.lakes.some((l) => Math.hypot(l.c[0] - x, l.c[1] - y) < l.r + 3);
  const cold = (x: number, y: number) => M.cold.some((z) => pointInPoly(x, y, z.pts));
  const dry = (x: number, y: number) => M.arid.some((z) => pointInPoly(x, y, z.pts) && z.v > 0.8);
  const onLand = (x: number, y: number) => M.mainland.length > 2 && pointInPoly(x, y, M.mainland);
  const used = new Set<string>(M.locations.map((l) => l.name));
  const DIRS = ['东', '西', '南', '北', '上', '下', '前', '后', '新', '老', '大', '小'];
  const uname = (base: string) => {
    const stem = base.replace(/(村|庄|集|坳|寨|湾|堡|店|镇|洲|荡|渡|岛|屿)$/, ''), suf = stem === base ? '' : base.slice(-1);
    let n = base, k = 0;
    while (used.has(n)) { n = k < DIRS.length ? stem + DIRS[k] + suf : DIRS[k % DIRS.length] + stem + DIRS[Math.floor(k / DIRS.length) % DIRS.length] + suf; if (++k > 140) { n = base + k; break; } }
    used.add(n); return n;
  };
  const mk = (l: Omit<LocDef, 'map' | 'ox' | 'oy' | 'id'>) => { const [ox, oy] = fromMap(M.id, l.x, l.y); out.push({ ...l, id: pre + (l.type === 'town' ? 'v' : l.type === 'secret' ? 'c' : l.type === 'isle' ? 'i' : 'd') + out.length, map: M.id, ox, oy }); };
  // 陆地面积（决定小地点数量，使各图密度一致）
  let landN = 0; for (let i = 0; i < 4000; i++) if (onLand(rnd() * M.W, rnd() * M.H)) landN++;
  const landArea = (landN / 4000) * M.W * M.H, k = landArea / 300000;   // 旧版统一地图主大陆 ≈ 30 万平方宏观单位
  const nTown = Math.round(150 * k), nCave = Math.round(72 * k), nLair = Math.round(95 * k);
  const strong = M.id === 'dajin' ? 1 : 0;
  let tries = 0, vi = 0;
  while (out.filter((l) => l.type === 'town').length < nTown && tries++ < nTown * 50) {
    const x = 10 + rnd() * (M.W - 20), y = 10 + rnd() * (M.H - 20);
    if (!onLand(x, y) || inLake(x, y) || !far(x, y, 11)) continue;
    if (cold(x, y) && rnd() < 0.7) continue;
    const nat = rnd() < 0.3;
    const name = uname(nat ? VNAT[vi++ % VNAT.length] : SURN[Math.floor(rnd() * SURN.length)] + VSUF[Math.floor(rnd() * VSUF.length)]);
    mk({ name, type: 'town', x, y, minor: true, danger: 0, desc: dry(x, y) ? '风沙中的小村落，村民以放牧为生。' : cold(x, y) ? '冰原边缘的猎户村落。' : '凡人聚居的村落，鸡犬相闻，偶有修士路过歇脚。' });
  }
  tries = 0; let ci = 0;
  while (out.filter((l) => l.type === 'secret').length < nCave && tries++ < nCave * 80) {
    const x = 10 + rnd() * (M.W - 20), y = 10 + rnd() * (M.H - 20);
    if (!onLand(x, y) || inLake(x, y) || !far(x, y, 12)) continue;
    mk({ name: uname(CAVES[ci++ % CAVES.length]), type: 'secret', x, y, minor: true, danger: 1 + strong + Math.floor(rnd() * 3), desc: '前人留下的修炼之所或古迹，禁制残存，或有遗宝。' });
  }
  tries = 0; let li = 0;
  while (out.filter((l) => l.type === 'danger').length < nLair && tries++ < nLair * 80) {
    const x = 10 + rnd() * (M.W - 20), y = 10 + rnd() * (M.H - 20);
    if (!onLand(x, y) || inLake(x, y) || !far(x, y, 11)) continue;
    const list = cold(x, y) ? LAIRS_COLD : dry(x, y) ? LAIRS_DRY : LAIRS;
    mk({ name: uname(list[li++ % list.length]), type: 'danger', x, y, minor: true, danger: 1 + strong + Math.floor(rnd() * 3), desc: '妖兽盘踞之地，常有修士结伴前来猎妖取丹。' });
  }
  // 乱星海：小岛据点与海妖巢穴（落在海中，岛屿由地形按 island 半径生成）
  if (M.islandField) {
    const F = M.islandField; tries = 0;
    while (out.filter((l) => l.type === 'isle' || l.island).length < 72 && tries++ < 6000) {
      const x = F.x0 + rnd() * (F.x1 - F.x0), y = F.y0 + rnd() * (F.y1 - F.y0);
      if (onLand(x, y) || !far(x, y, 16)) continue;
      const sea = rnd() < 0.35;
      const name = uname(sea ? LAIRS_SEA[Math.floor(rnd() * LAIRS_SEA.length)] : ['青螺岛', '碧波岛', '蛟龙屿', '落星岛', '珊瑚岛', '龟背岛', '望潮岛', '浮云岛', '金沙岛', '海市岛', '白沙屿', '星罗岛'][Math.floor(rnd() * 12)]);
      const outer = toLegacy0(M.id, x, y)[0] > 900;
      mk({ name, type: sea ? 'danger' : 'isle', x, y, minor: true, island: Math.round((4 + rnd() * 4) * M.islandK), danger: sea ? 2 + (outer ? 1 : 0) + Math.floor(rnd() * 2) : 0, desc: sea ? '海妖出没的礁岛。' : '乱星海中的小岛，散修在此结庐。' });
    }
  }
  return out;
}
function toLegacy0(id: MapId, x: number, y: number) { return fromMap(id, x, y); }

function buildMap(id: MapId, seed: number, pre: string): MapData {
  const S = SPEC[id];
  const x0 = S.ox - 3, y0 = S.oy - 3, x1 = S.ox + S.W / S.sx + 3, y1 = S.oy + S.H / S.sy + 3;   // legacy 窗口（略放宽，海岸线伸出图外）
  const T = (p: P): P => toMap(id, p[0], p[1]);
  const sk = Math.sqrt(S.sx * S.sy);
  const mainland = id === 'luanxing' ? [] : clipPoly(RAW_MAINLAND, x0, y0, x1, y1).map(T);
  const lakes = RAW_LAKES.filter((l) => l.c[0] > x0 && l.c[0] < x1 && l.c[1] > y0 && l.c[1] < y1).map((l) => ({ ...l, c: T(l.c), r: l.r * sk * 0.8 }));
  const ranges = id === 'luanxing' ? [] : RAW_RANGES.filter((r) => bboxHits(r.pts, x0, y0, x1, y1)).map((r) => ({ ...r, pts: r.pts.map(T), w: r.w * S.rangeK }));
  const rivers = (id === 'luanxing' ? [] : RAW_RIVERS.filter((r) => bboxHits(r.pts, x0, y0, x1, y1))).concat(EXTRA_RIVERS[id] ?? []).map((r) => ({ ...r, pts: r.pts.map(T), w: r.w * S.riverK }));
  const zone = (zs: { pts: P[]; v: number }[]) => zs.filter((z) => bboxHits(z.pts, x0, y0, x1, y1)).map((z) => ({ ...z, pts: z.pts.map(T) }));
  const ren = REGION_RENAME[id] ?? {};
  const regions = RAW_REGIONS.filter((r) => MAP_REGIONS[id].includes(r.id)).map((r) => ({ ...r, ...(ren[r.id] ?? {}), pts: r.pts.map(T), label: r.label ? T(r.label) : undefined, labelSize: (r.labelSize ?? 1) * 1.3 }));
  if (id === 'tiannan') { const m = regions.find((r) => r.id === 'mulan'); if (m) m.label = T([430, 300]); }
  const labels = MAP_LABELS[id].map((l) => ({ ...l, at: T(l.at) }));
  const locations: LocDef[] = RAW_LOCATIONS.filter((l) => (l.map ?? legacyMapOf(l.x, l.y)) === id).map((l) => {
    const [x, y] = T([l.x, l.y]);
    return { ...l, map: id, x, y, ox: l.x, oy: l.y, island: l.island ? Math.round(l.island * (id === 'luanxing' ? 1.6 : 1.2)) : undefined };
  });
  const I = ISLES[id];
  const M: MapData = { id, W: S.W, H: S.H, mainland, lakes, ranges, rivers, arid: zone(RAW_ARID), cold: zone(RAW_COLD), forest: zone(RAW_FOREST), regions, labels, locations, islandField: I.field ?? null, extraIslands: I.extra, islandK: I.rk };
  M.locations.push(...genMinor(M, seed, pre));
  return M;
}
// 主要地点的默认危险度（按 legacy 坐标：北方与外星海更凶）
for (const l of RAW_LOCATIONS) if (l.danger === undefined) l.danger = l.type === 'danger' ? (l.y < 260 || l.x > 900 ? 4 : 3) : l.type === 'secret' ? 3 : 0;

const MAPS: Record<MapId, MapData> = {
  tiannan: buildMap('tiannan', 31415, ''),
  luanxing: buildMap('luanxing', 27183, 'lx_'),
  dajin: buildMap('dajin', 16180, 'dj_'),
};
const M = MAPS[ACTIVE_MAP];

// ---------- 当前地图（各模块沿用旧的导出名） ----------
export const MACRO_W = M.W;
export const MACRO_H = M.H;
export const WORLD_W = MACRO_W * WORLD_SCALE;
export const WORLD_H = MACRO_H * WORLD_SCALE;
export const MAINLAND = M.mainland;
export const LAKES = M.lakes;
export const RANGES = M.ranges;
export const RIVERS = M.rivers;
export const ARID_ZONES = M.arid;
export const COLD_ZONES = M.cold;
export const FOREST_ZONES = M.forest;
export const REGIONS = M.regions;
export const BIG_LABELS = M.labels;
export const ISLAND_FIELD = M.islandField;
export const EXTRA_ISLANDS = M.extraIslands;
export const ISLAND_K = M.islandK;
/** 当前地图上的地点 */
export const LOCATIONS: LocDef[] = M.locations;
/** 三张图的全部地点（用于名称查询、跨图 NPC 与传闻） */
export const ALL_LOCATIONS: LocDef[] = MAP_IDS.flatMap((m) => MAPS[m].locations);
export const LOC_BY_ID = new Map(ALL_LOCATIONS.map((l) => [l.id, l] as const));
/** 当前地图上的地点（不在本图则 undefined）——凡要用坐标的地方都应该用它 */
export function locHere(id: string | undefined | null): LocDef | undefined { const l = id ? LOC_BY_ID.get(id) : undefined; return l && l.map === ACTIVE_MAP ? l : undefined; }
export function locsOf(map: MapId): LocDef[] { return MAPS[map].locations; }
export function mapSize(map: MapId) { return { W: MAPS[map].W, H: MAPS[map].H }; }
export function mapMainland(map: MapId) { return MAPS[map].mainland; }
/** 地名（不在本图时冠以地图名，如“乱星海·虚天殿”） */
export function locLabel(id: string | undefined | null): string { const l = id ? LOC_BY_ID.get(id) : undefined; return l ? (l.map !== ACTIVE_MAP ? MAP_NAME[l.map] + '·' : '') + l.name : ''; }
