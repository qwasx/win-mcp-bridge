// 人界地理数据
// 坐标系：宏观坐标 1000 x 700，乘以 WORLD_SCALE 得到世界坐标（像素）
// 布局参考原著及网络流传的《凡人修仙传》人界地图：
//   北部大晋（人界第一大国）→ 中部天澜草原 → 西南天南（韩立故乡）→ 天南以西极西之地
//   天南以东隔无边海为乱星海（内星海以天星城为中心，外星海妖兽横行）
export const WORLD_SCALE = 100;
export const MACRO_W = 1000;
export const MACRO_H = 700;
export const WORLD_W = MACRO_W * WORLD_SCALE;
export const WORLD_H = MACRO_H * WORLD_SCALE;

export type P = [number, number];

// 主大陆轮廓（大晋 + 天澜草原 + 天南 + 极西之地）
export const MAINLAND: P[] = [
  [62, 70], [110, 48], [168, 40], [230, 50], [290, 36], [360, 30], [430, 42], [500, 34], [570, 30], [640, 44],
  [700, 52], [748, 72], [782, 104], [792, 140], [770, 168], [744, 186], [752, 212], [742, 240], [712, 262],
  [668, 268], [646, 292], [612, 318], [596, 352], [586, 392], [578, 430], [584, 468], [570, 500], [566, 530],
  [578, 560], [566, 596], [552, 630], [530, 652], [494, 664], [452, 658], [410, 668], [366, 664], [318, 670],
  [276, 662], [236, 668], [196, 656], [160, 640], [130, 618], [112, 630], [86, 626], [52, 612], [30, 580],
  [22, 540], [34, 498], [26, 456], [44, 412], [38, 368], [60, 326], [54, 284], [74, 240], [58, 196], [48, 150], [44, 108],
];

// 内陆湖泊
export const LAKES: { c: P; r: number; name?: string }[] = [
  { c: [420, 175], r: 10, name: '晋湖' },
  { c: [300, 312], r: 7 },
  { c: [470, 598], r: 4 },
  { c: [212, 210], r: 6 },
];

// 山脉（折线 + 宽度 + 高度）
export const RANGES: { pts: P[]; w: number; h: number; name?: string }[] = [
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
export const RIVERS: { pts: P[]; w: number }[] = [
  { pts: [[300, 440], [350, 470], [410, 512], [452, 548], [500, 590], [540, 628], [566, 646]], w: 1.4 },
  { pts: [[468, 520], [480, 560], [492, 600], [510, 640], [520, 664]], w: 1.0 },
  { pts: [[290, 96], [350, 130], [420, 170], [490, 196], [560, 206], [650, 222], [742, 236]], w: 1.6 },
  { pts: [[240, 300], [300, 312], [360, 300], [430, 318], [520, 330], [600, 334]], w: 1.0 },
  { pts: [[180, 470], [230, 520], [260, 600], [276, 662]], w: 1.1 },
  { pts: [[400, 70], [410, 120], [420, 165]], w: 0.9 },
];

// 干旱（草原/荒漠）、严寒、森林区域
export const ARID_ZONES: { pts: P[]; v: number }[] = [
  { pts: [[190, 262], [640, 262], [620, 368], [210, 372]], v: 0.7 },  // 天澜草原
  { pts: [[60, 120], [190, 130], [200, 240], [70, 236]], v: 1.0 },   // 大晋西漠
  { pts: [[25, 520], [100, 520], [100, 615], [35, 600]], v: 0.9 },   // 极西荒漠
];
export const COLD_ZONES: { pts: P[]; v: number }[] = [
  { pts: [[40, 30], [800, 30], [800, 96], [40, 104]], v: 1.0 },
];
export const FOREST_ZONES: { pts: P[]; v: number }[] = [
  { pts: [[420, 480], [570, 480], [570, 660], [420, 660]], v: 0.8 },  // 越国
  { pts: [[250, 430], [420, 430], [420, 660], [250, 660]], v: 0.6 },
  { pts: [[120, 420], [250, 420], [250, 650], [120, 650]], v: 0.55 },
  { pts: [[260, 100], [700, 100], [700, 240], [260, 240]], v: 0.55 }, // 大晋腹地
];

// 命名区域（用于显示当前位置；按顺序匹配，越靠前越优先）
export interface Region { id: string; name: string; parent: string; pts: P[]; label?: P; labelSize?: number }
export const REGIONS: Region[] = [
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
export const BIG_LABELS: { name: string; at: P; size: number }[] = [
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
}

export const LOCATIONS: LocDef[] = [
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
  { id: 'chuansong', name: '上古传送阵', type: 'secret', x: 520, y: 440, major: true, desc: '上古遗留的远距离传送阵，可直通乱星海。韩立当年由此远遁。' },
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
  { id: 'tianlan', name: '天澜圣殿', type: 'sect', x: 430, y: 300, major: true, desc: '慕兰法士的圣地，供奉天澜圣兽。' },
  { id: 'tuwu', name: '突兀部落', type: 'town', x: 300, y: 300, desc: '草原游牧部族，与慕兰人世代争斗。' },
  { id: 'mulan', name: '慕兰部落', type: 'town', x: 560, y: 312, desc: '慕兰人的大部落，法士之乡。' },
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
  // ===== 无边海 =====
  { id: 'xutian', name: '虚天殿', type: 'secret', x: 636, y: 352, major: true, island: 9, desc: '冰魄仙子所留的上古殿宇，每隔一段时间现世一次。内藏虚天鼎与补天丹，元婴老怪亦为之疯狂。' },
  // ===== 乱星海 =====
  { id: 'tianxing', name: '天星城', type: 'city', x: 815, y: 500, major: true, island: 28, scale: 1.3, desc: '乱星海第一大城，建于圣山之上，星宫总坛所在，天星双圣坐镇。' },
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

// 随机小岛的生成区域（乱星海）
export const ISLAND_FIELD = { x0: 660, y0: 300, x1: 995, y1: 695, count: 170 };

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
