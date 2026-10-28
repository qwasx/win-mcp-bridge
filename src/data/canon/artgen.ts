// 第 4 阶段（s4-content）：法宝法器——手工精做（宗门制式法器、镇宗之宝、新出手方式的样板）+ 按
// “地域 × 五行 × 出手方式 × 品阶”批量生成（名字、描述自动拼，读着要像修仙小说）。
// 生成用固定种子：同一版本里每件东西的 id、名字、数值都不变，存档里的东西不会变样。
import type { ItemDef, ArtKind, ArtSpec } from '../items';
import type { ArtShape, ArtLook } from '../artlooks';
import { mulberry32 } from '../../core/rng';
import { type RegionId, type Wx, REGION_IDS, artElOf, WX_NAME } from './types';

// ================================================================= 出手方式（出手手感各不相同，见 world/artacts.ts）
export interface KindDef { k: ArtKind; nouns: string[]; shape: ArtShape; pow: number; mp: number; cd: number; pieces?: [number, number]; tiers: number[]; glyph: string; verb: string; def?: 'absorb' | 'def' | 'speed' | 'fly' }
export const KINDS: KindDef[] = [
  { k: 'sword', nouns: ['剑', '飞剑', '刀', '剑'], shape: 'jian', pow: 1, mp: 1, cd: 1.05, tiers: [0, 1, 1, 2, 2, 3, 3, 4, 5], glyph: '剑', verb: '剑光出鞘后破空斩敌，一击之后自行回旋' },
  { k: 'needle', nouns: ['针', '飞针', '梭针', '钉'], shape: 'needle', pow: 0.55, mp: 0.3, cd: 0.8, pieces: [5, 12], tiers: [1, 1, 2, 2, 3, 3, 4], glyph: '针', verb: '一套数枚，出手后各自追魂索命，神识越足，同时驱使得越多' },
  { k: 'ring', nouns: ['环', '圈', '镯', '轮'], shape: 'ring', pow: 1.1, mp: 1.3, cd: 3, tiers: [0, 1, 2, 2, 3, 4], glyph: '环', verb: '祭出后呼啸飞旋，在敌群中急转绞杀，再折回手中' },
  { k: 'mirror', nouns: ['镜', '宝镜', '鉴'], shape: 'mirror', pow: 1.4, mp: 2, cd: 2.6, tiers: [0, 1, 2, 3, 3, 4, 5], glyph: '镜', verb: '镜面一翻，射出一道凝而不散的光柱' },
  { k: 'slam', nouns: ['砖', '山', '尺', '碑', '锤'], shape: 'brick', pow: 2.6, mp: 3, cd: 5, tiers: [0, 1, 2, 3, 4, 5], glyph: '砖', verb: '迎风暴涨，自半空轰然砸落' },
  { k: 'arrow', nouns: ['刺', '箭', '镖', '锥'], shape: 'thorn', pow: 2.2, mp: 2.4, cd: 3.4, tiers: [0, 1, 2, 2, 3, 4], glyph: '刺', verb: '一道暗芒直取要害，穿人而过' },
  { k: 'bell', nouns: ['钟', '铃', '钵', '磬'], shape: 'bell', pow: 0.9, mp: 2.6, cd: 8, tiers: [1, 2, 3, 4], glyph: '钟', verb: '一声震响直透识海，周身之敌神魂动摇' },
  { k: 'bind', nouns: ['索', '绫', '网', '链'], shape: 'ribbon', pow: 0.75, mp: 2, cd: 7, tiers: [1, 2, 3, 4], glyph: '索', verb: '如活物般游走而出，一缠一个准' },
  { k: 'flame', nouns: ['炉', '焰', '火珠'], shape: 'flame', pow: 0.85, mp: 0.5, cd: 0.25, tiers: [1, 2, 3, 4], glyph: '火', verb: '喷吐灵焰，连绵不绝' },
  { k: 'banner', nouns: ['幡', '旗', '令旗'], shape: 'banner', pow: 0.8, mp: 3, cd: 10, tiers: [1, 2, 3, 4, 5], glyph: '幡', verb: '插地展开，召出其中所封之灵助战' },
  { k: 'shield', nouns: ['盾', '牌'], shape: 'shield', pow: 0, mp: 0, cd: 0, tiers: [0, 1, 2, 3, 4], glyph: '盾', verb: '悬于身侧，自行迎挡来袭之敌', def: 'absorb' },
  { k: 'armor', nouns: ['甲', '衣', '袍', '软甲'], shape: 'armor', pow: 0, mp: 0, cd: 0, tiers: [1, 2, 3, 4], glyph: '甲', verb: '贴身穿着，卸去大半力道', def: 'def' },
  { k: 'boots', nouns: ['靴', '履'], shape: 'boots', pow: 0, mp: 0, cd: 0, tiers: [1, 2, 3], glyph: '靴', verb: '足下生风，翻山越岭快上几分', def: 'speed' },
  { k: 'flight', nouns: ['舟', '飞车', '云辇'], shape: 'boat', pow: 0, mp: 0, cd: 0, tiers: [2, 3, 4], glyph: '舟', verb: '按 F 乘之飞渡，日行千里', def: 'fly' },
  // —— 第 4 阶段新增的十二种出手方式
  { k: 'gourd', nouns: ['葫芦', '宝葫芦'], shape: 'gourd', pow: 1.3, mp: 3, cd: 9, tiers: [1, 2, 3, 4, 5], glyph: '葫', verb: '葫芦口一开，吸力大作，将近旁之敌摄到葫口之下，残血者直接收入葫中炼化' },
  { k: 'umbrella', nouns: ['伞', '罗伞', '华盖'], shape: 'umbrella', pow: 0.8, mp: 2.5, cd: 12, tiers: [1, 2, 3, 4], glyph: '伞', verb: '撑开时伞面灵光如幕，挡下来袭的法术飞剑；收伞时伞骨迸射，反伤四周' },
  { k: 'fan', nouns: ['扇', '羽扇', '宝扇'], shape: 'fan', pow: 1.2, mp: 2, cd: 4, tiers: [1, 2, 3, 4], glyph: '扇', verb: '一扇之下狂风卷地，把敌人连人带衣扇飞出去' },
  { k: 'beads', nouns: ['连珠', '念珠', '珠串'], shape: 'bead', pow: 0.8, mp: 2, cd: 4, pieces: [3, 7], tiers: [1, 2, 3, 4], glyph: '珠', verb: '一串宝珠连环打出，每颗都在敌人之间来回弹跳' },
  { k: 'cover', nouns: ['罩', '宝罩', '天罩'], shape: 'cover', pow: 0.9, mp: 3, cd: 10, tiers: [2, 3, 4], glyph: '罩', verb: '当头罩下，将敌人困在罩中动弹不得，越缩越紧，最后一并炸开' },
  { k: 'pagoda', nouns: ['塔', '宝塔', '浮屠'], shape: 'pagoda', pow: 2.2, mp: 4, cd: 12, tiers: [2, 3, 4, 5], glyph: '塔', verb: '宝塔自天镇落，塔下方圆被镇压得寸步难行' },
  { k: 'seal', nouns: ['印', '宝印', '玺'], shape: 'seal', pow: 2.4, mp: 3, cd: 6, tiers: [1, 2, 3, 4, 5], glyph: '印', verb: '大印凌空暴涨，阴影罩定敌人后轰然压下' },
  { k: 'lamp', nouns: ['灯', '宝灯', '魂灯'], shape: 'lamp', pow: 0.6, mp: 2.5, cd: 9, tiers: [1, 2, 3, 4, 5], glyph: '灯', verb: '灯火照处，敌人的神魂如雪遇汤，隐匿者无所遁形，鬼物尤其畏惧' },
  { k: 'shuttle', nouns: ['梭', '飞梭'], shape: 'shuttle', pow: 1.3, mp: 1.5, cd: 5, tiers: [1, 2, 3, 4], glyph: '梭', verb: '人随梭走，化作一道遁光穿过敌阵，沿途之敌尽被割伤' },
  { k: 'whip', nouns: ['鞭', '软鞭', '骨鞭'], shape: 'whip', pow: 0.9, mp: 1, cd: 2.4, tiers: [1, 2, 3, 4], glyph: '鞭', verb: '鞭影连抽三记，扫过身前一大片，最后一记把人卷到跟前' },
  { k: 'disk', nouns: ['阵盘', '罗盘', '星盘'], shape: 'disk', pow: 0.5, mp: 3, cd: 12, tiers: [1, 2, 3, 4], glyph: '盘', verb: '掷地展开一座小阵，阵中灵光不断劈落' },
  { k: 'puppet', nouns: ['傀儡', '木甲', '铜人'], shape: 'puppet', pow: 0.7, mp: 3, cd: 18, tiers: [1, 2, 3, 4], glyph: '傀', verb: '放出后自行扑杀敌人，刀剑加身亦不知痛' },
];
export const KIND_OF = Object.fromEntries(KINDS.map((k) => [k.k, k])) as Record<ArtKind, KindDef>;
export const NEW_KINDS: ArtKind[] = ['gourd', 'umbrella', 'fan', 'beads', 'cover', 'pagoda', 'seal', 'lamp', 'shuttle', 'whip', 'disk', 'puppet'];
export const KIND_NAME: Partial<Record<ArtKind, string>> = {
  sword: '飞剑', needle: '飞针', ring: '飞环', mirror: '宝镜', slam: '砖山', arrow: '箭刺', bell: '古钟', bind: '绶带', flame: '灵焰', banner: '魔幡', cauldron: '宝鼎',
  shield: '护盾', armor: '宝甲', boots: '靴履', flight: '飞行', wings: '飞翅',
  gourd: '葫芦收摄', umbrella: '伞挡', fan: '扇风', beads: '连珠', cover: '罩子困人', pagoda: '塔镇', seal: '印压', lamp: '灯照魂', shuttle: '梭遁', whip: '鞭', disk: '阵盘', puppet: '傀儡',
};

// ================================================================= 词库
const IMG: Record<Wx, string[]> = {
  fire: ['赤焰', '离火', '炎阳', '流火', '烈阳', '焚天', '赤霞', '丹霞', '紫焰', '朱炎'],
  ice: ['玄冰', '寒魄', '霜华', '冰魄', '雪魄', '寒月', '北冥', '凝霜'],
  water: ['碧潮', '沧浪', '分水', '玄水', '弱水', '流波', '潮音', '沉渊'],
  thunder: ['紫电', '奔雷', '惊雷', '五雷', '雷音', '天雷', '震霆', '雷火'],
  wood: ['青木', '乙木', '长春', '碧藤', '青竹', '万木', '翠微', '灵藤'],
  earth: ['厚土', '镇岳', '戊土', '黄沙', '千山', '磐石', '坤元', '移山'],
  metal: ['庚金', '锐金', '白虹', '金光', '断金', '太白', '流金', '辟锋'],
  yin: ['阴煞', '幽冥', '噬魂', '黑煞', '九幽', '血煞', '白骨', '摄魂'],
  wind: ['青冥', '巽风', '流风', '回风', '罡风', '扶摇'],
  none: ['灵光', '玄光', '清光', '宝光'],
};
const MAT: Record<RegionId, [string[], string[], string[]]> = {
  tiannan: [['青铜', '赤铜', '玄铁', '精钢', '乌木', '桃木', '青石', '兽骨'], ['寒玉', '紫金', '墨蛟', '青竹', '云纹钢', '赤晶', '火鳞'], ['金雷木', '万年玄玉', '太岳灵石', '古魔铜']],
  luanxing: [['海骨', '珊瑚', '蚌壳', '鲨齿', '鱼骨', '海铁'], ['蛟骨', '玄龟甲', '星砂', '鲛绡', '海魄', '碧潮玉'], ['妖王骨', '归墟精金', '万年冰魄', '星辰铁']],
  dajin: [['寒铁', '黑铁', '狼骨', '兽牙', '松木'], ['昆吾铁', '雪原寒铁', '紫霄晶', '庚金', '玄冥石'], ['昆吾神铁', '古魔骨', '天澜沙', '九天玄铁']],
};
const RIMG: Record<RegionId, string[]> = {
  tiannan: ['青云', '太岳', '落霞', '云梦', '碧落', '紫竹', '越秀', '天南'],
  luanxing: ['沧溟', '归墟', '星辰', '海市', '天星', '潮生', '外海', '玄海'],
  dajin: ['昆吾', '九霄', '紫府', '北寒', '皇极', '太一', '天澜', '玄冥'],
};
const NUMP = ['九曲', '七星', '八荒', '三才', '六合', '万象', '两仪', '四象', '九天', '十方', '千叠', '五蕴'];
const ORIGIN: Record<RegionId, string[][]> = {
  tiannan: [
    ['越国、元武一带坊市里随处可见的大路货。', '天南散修炼气时多半用过此物。', '七派外门弟子常备之物，胜在皮实。'],
    ['天南筑基修士中颇有名气的法器。', '出自元武国一位炼器师之手，炼制颇见功夫。', '天道盟坊市里价格不菲的上品。'],
    ['天南结丹修士才用得起的法宝，寻常筑基见了只能眼热。', '据说是某位天南结丹长老年轻时的旧物。'],
    ['天南上古修士遗下的古宝，出自一处坐化洞府，灵性未泯。'],
  ],
  luanxing: [
    ['外海猎妖修士人手一件的粗货。', '魁星岛码头边地摊上的货色，十块八块灵石便能拿下。', '乱星海散修常用之物，便宜耐造。'],
    ['乱星海筑基修士常备的法器。', '星宫外事殿流出的制式法器，做工规整。', '内星海一位炼器散修的得意之作。'],
    ['乱星海结丹散修梦寐以求的法宝。', '据说是从一位陨落在外海的结丹修士储物袋里翻出来的。'],
    ['从外海妖王巢穴中翻出的上古遗宝，不知在海底沉了几万年。'],
  ],
  dajin: [
    ['大晋凡俗世家供奉修士的寻常法器。', '晋京小坊市里的寻常货色。', '北地猎妖修士惯用的粗物。'],
    ['大晋世家子弟随身带着的上品法器。', '大晋炼器宗门的制式法器，一批出炉上百件。', '大晋魔道交换会上偶尔能见到的好东西。'],
    ['大晋元婴老怪随手赐给门下的法宝，放到天南便是镇派之物。', '晋京九霄殿拍卖会上的常客。'],
    ['昆吾山一带流出的上古古宝，器身上的禁制大半残破，余威犹在。'],
  ],
};
const FORGE: Record<Wx, string> = {
  fire: '在地火中淬了七七四十九日', ice: '在寒潭底温养了三年', water: '在海眼中浸了百日', thunder: '引天雷淬过三回', wood: '以百年灵木汁液浇灌祭炼',
  earth: '埋在灵脉之下养了十年', metal: '经千锤百炼，锋芒内敛', yin: '以阴魂煞气日夜祭炼', wind: '在风口悬了一整年', none: '炼制得中规中矩',
};
const HIT: Record<Wx, string> = {
  fire: '中者衣衫尽燃', ice: '中者经脉凝霜', water: '中者如坠深潭', thunder: '中者浑身麻痹', wood: '中者被藤芽缠身', earth: '中者头晕目眩', metal: '中者护体灵光被破', yin: '中者阴气侵体、神魂发寒', wind: '中者站立不稳', none: '',
};
const REALM_CN = ['凡人', '炼气', '筑基', '结丹', '元婴'];
/** 同一出手方式的另一种说法（描述不至于千篇一律） */
const VERB2: Partial<Record<ArtKind, string[]>> = {
  sword: ['飞出时剑鸣清越，斩罢一人便折回再斩', '御之如臂使指，剑光过处血光迸现'],
  needle: ['出手时细不可见，等察觉时已没入要害', '一出便是一蓬寒星，各寻一人'],
  ring: ['旋转时呜呜作响，绕敌一周便是一圈血口', '抛出后急旋不止，专绞护体灵光'],
  mirror: ['镜光一照，被照之处皮焦肉烂', '照出的光柱又细又亮，三丈外也能穿透木石'],
  slam: ['祭到半空便长成磨盘大小，当头压落', '落地时地面都要塌下去一截'],
  arrow: ['离手便不见踪影，只听得一声尖啸', '专破护体灵光，偷袭时最是阴毒'],
  bell: ['一响之下，近身之人耳鼻溢血、心神失守', '声浪层层荡开，修为稍弱的当场呆住'],
  bind: ['抛出后自行缠绕，越挣越紧', '缠上了便封住经脉，一时三刻挣脱不得'],
  banner: ['展开时阴风大作，幡中之灵扑出噬人', '幡面一抖，所封之灵便扑向敌人'],
  gourd: ['口朝下一倒，方圆数丈的妖物都被吸得站立不稳', '葫中似有一方小天地，修为不及的敌人一吸便进'],
  umbrella: ['伞开如盖，飞剑法术打上来只溅起一片灵光', '撑开后伞沿垂下一道光幕，收伞时伞骨如箭四射'],
  fan: ['轻轻一扇便是一阵狂风，把人扇出老远', '扇面开合之间，风刃如刀'],
  beads: ['珠子打中一人便弹向下一人，一串打完能伤一片', '宝珠连发，珠与珠之间灵光相连'],
  cover: ['当头罩下后越缩越小，困在里面的人只能硬抗', '罩住了便是一方囚笼，最后连人带罩一起炸开'],
  pagoda: ['塔身落地生根，塔下之人如负山岳', '镇落之后经久不散，方圆之内寸步难行'],
  seal: ['印未落地，影子已罩住了敌人，躲也躲不开', '一印落下，护体灵光应声而碎'],
  lamp: ['灯火幽幽，照在人身上不烫，却叫神魂发冷', '提灯一照，隐匿之人现形，鬼物惨嚎'],
  shuttle: ['驭梭而行，人梭合一穿阵而过', '遁光一闪便到了数十丈外，沿途之人身上多了一道血口'],
  whip: ['鞭影如蛇，抽在身上皮开肉绽', '连抽三记，末一记缠住敌人拖到跟前'],
  disk: ['掷地生根，阵纹一亮，天上便落下灵光', '阵盘一转便是一座小阵，困在阵中的人挨打不停'],
  puppet: ['放出后自行扑杀，不知疼痛，不惧生死', '关节咔咔作响，出手却快得出奇'],
};
/** 器物细节（随机添一句） */
const DETAIL: Record<Wx, string[]> = {
  fire: ['器身常年温热，握久了掌心发烫。', '祭炼时火候差了一分，器身留着一道焦痕。'],
  ice: ['器身凝着一层白霜，三伏天也不化。', '收在储物袋里，袋中灵草都挂了霜。'],
  water: ['器身隐隐有水纹流动。', '放在桌上，四周会凝出一圈水珠。'],
  thunder: ['器身偶有细小电弧跳动，噼啪作响。', '雷雨天里自己会嗡嗡发颤。'],
  wood: ['器身有天然木纹，隐隐透出草木清香。', '在灵脉边放久了，会抽出一两片嫩芽。'],
  earth: ['入手极沉，比看上去重了三倍。', '器身粗糙，像是从山岩里凿出来的。'],
  metal: ['锋口寒光凛凛，吹毛断发。', '器身錾着细密的云雷纹。'],
  yin: ['入夜后器身会渗出淡淡黑气，正道修士见了多半要皱眉。', '贴身带久了，人会变得阴沉。'],
  wind: ['拿在手里轻若无物。', '器身镂空，风过时呜呜作响。'],
  none: ['做工平平，胜在皮实。'],
};
const TP = [1, 1.5, 2.2, 3.1, 4.4, 6.5];
const PRICE = [130, 650, 2600, 9500, 26000, 130000];
const SENSE = [10, 12, 20, 28, 40, 110];
const REQ = [1, 1, 2, 2, 3, 4];
const WXW: Record<RegionId, [Wx, number][]> = {
  tiannan: [['wood', 3], ['fire', 3], ['earth', 2], ['metal', 2], ['thunder', 1], ['water', 1], ['ice', 0.5], ['yin', 1.5], ['wind', 1]],
  luanxing: [['water', 4], ['ice', 2], ['thunder', 2], ['metal', 1], ['fire', 1], ['yin', 1.5], ['earth', 0.5], ['wood', 0.5], ['wind', 1]],
  dajin: [['metal', 3], ['yin', 3], ['ice', 2], ['thunder', 2], ['earth', 1.5], ['fire', 1], ['wood', 1], ['water', 1], ['wind', 1]],
};
const WX_COLOR: Record<Wx, [string, string, string]> = {
  fire: ['#e05a30', '#7a2a12', '255,130,60'], ice: ['#c8ecff', '#5a8aa8', '180,225,255'], water: ['#5a9ad0', '#1e4a6a', '120,190,255'], thunder: ['#a8a0ff', '#3a3088', '180,170,255'],
  wood: ['#6ac070', '#2a5a30', '140,235,150'], earth: ['#b8945a', '#5a4020', '240,210,140'], metal: ['#e8d080', '#8a6a20', '255,235,150'], yin: ['#5a3a5a', '#b03050', '210,90,150'],
  wind: ['#9adcc8', '#3a7a68', '170,240,220'], none: ['#c8c8c0', '#6a6a60', '230,230,220'],
};

export interface GenMeta { region?: RegionId; wx: Wx; kind: ArtKind; gen?: boolean; sect?: string }
/** 每件新物品的地域 / 五行 / 出手方式 */
export const ART_META: Record<string, GenMeta> = {};
/** 新物品外观 */
export const GEN_LOOK: Record<string, ArtLook> = {};

function pickW<T>(r: () => number, arr: [T, number][]): T { let s = 0; for (const [, w] of arr) s += w; let x = r() * s; for (const [v, w] of arr) { x -= w; if (x <= 0) return v; } return arr[0][0]; }
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];

function stats(K: KindDef, t: number, wx: Wx, r: () => number): ArtSpec {
  const v = 0.9 + r() * 0.22;
  const el = K.def ? (r() < 0.5 ? artElOf(wx) : undefined) : artElOf(wx);
  const a: ArtSpec = { kind: K.k, reqRealm: REQ[t], sense: Math.round(SENSE[t] * (K.pieces ? 0.35 : 1)), pieces: K.pieces ? Math.round(K.pieces[0] + (K.pieces[1] - K.pieces[0]) * t / 5) : 1, power: +(K.pow * TP[t] * v).toFixed(2), mp: Math.round(K.mp * [3, 4, 8, 12, 20, 40][t]), cd: K.cd, color: WX_COLOR[wx][0] };
  if (el) a.element = el;
  if (wx === 'yin' && r() < 0.3 && !K.def) { a.element = 'blood'; a.hpCost = 0.03; }
  if (K.def === 'absorb') a.absorb = +(0.5 + t * 0.09).toFixed(2);
  if (K.def === 'def') a.def = +(0.12 + t * 0.07).toFixed(2);
  if (K.def === 'speed') a.mapSpeed = +(1.2 + t * 0.08).toFixed(2);
  if (K.def === 'fly') a.mapSpeed = +(1.3 + t * 0.15).toFixed(2);
  if (K.k === 'umbrella') a.absorb = +(0.35 + t * 0.07).toFixed(2);
  return a;
}

function nameOf(R: RegionId, K: KindDef, t: number, wx: Wx, mat: string, r: () => number): string {
  const img = pick(r, IMG[wx]), noun = pick(r, K.nouns);
  switch (t) {
    case 0: return mat + noun;
    case 1: return r() < 0.55 ? img + noun : mat + noun;
    case 2: return img + mat + noun;
    case 3: return pick(r, RIMG[R]) + img + noun;
    case 4: return pick(r, NUMP) + img + noun;
    default: return pick(r, RIMG[R]) + img + (noun.length === 1 ? '古' : '') + noun;
  }
}
function descOf(R: RegionId, K: KindDef, t: number, wx: Wx, mat: string, r: () => number): string {
  const o = pick(r, ORIGIN[R][t <= 1 ? 0 : t <= 3 ? 1 : t === 4 ? 2 : 3]);
  const forge = `以${mat}为胚，${FORGE[wx]}。`;
  const hit = K.def ? '' : HIT[wx];
  const v2 = VERB2[K.k];
  const verb = v2 && r() < 0.6 ? pick(r, v2) : K.verb;
  const eff = `${verb}${hit && !verb.includes('中者') ? '，' + hit : ''}。`;
  const det = r() < 0.5 ? pick(r, DETAIL[wx]) : '';
  const req = t >= 2 ? `需${REALM_CN[REQ[t]]}期方能驱使自如。` : '';
  return o + forge + eff + det + req;
}

const GEN: ItemDef[] = [];
function gen() {
  const used = new Set<string>();
  for (const R of REGION_IDS) {
    const r = mulberry32(R === 'tiannan' ? 4101 : R === 'luanxing' ? 4102 : 4103);
    let n = 0;
    for (const round of [0, 1]) for (const K of KINDS) for (const t of K.tiers) {
      if (round === 1 && (K.def || t === 0)) continue;
      let wx: Wx = pickW(r, WXW[R]);
      if (K.k === 'lamp' && r() < 0.5) wx = 'yin';
      let name = '', tries = 0, mat = '';
      do { mat = pick(r, MAT[R][t <= 1 ? 0 : t <= 3 ? 1 : 2]); name = nameOf(R, K, t, wx, mat, r); tries++; } while ((used.has(name) || name.length < 2 || name.length > 6 || new Set(name).size < name.length) && tries < 60);
      if (used.has(name)) name = pick(r, RIMG[R]) + name;
      used.add(name);
      const id = `gen_${R.slice(0, 2)}_${K.k}_${n++}`;
      const art = stats(K, t, wx, r);
      const price = Math.round(PRICE[t] * (0.85 + r() * 0.35) * (K.def ? 0.8 : 1));
      GEN.push({ id, name, type: 'artifact', tier: t, price, desc: descOf(R, K, t, wx, mat, r), glyph: K.glyph, art });
      ART_META[id] = { region: R, wx, kind: K.k, gen: true };
      const c = WX_COLOR[wx];
      GEN_LOOK[id] = { shape: K.shape, c1: c[0], c2: c[1], glow: c[2] };
    }
  }
}

// ================================================================= 手工精做
type HRow = [string, string, ArtKind, number, Wx, string, string, Partial<ArtSpec>?];
// [id, 名, 出手方式, 品阶, 五行, 宗门/地域, 描述, 数值修正]
const HAND: HRow[] = [
  // —— 宗门弟子常用法器（本门坊市有售、本地掉落）
  ['art_hf_huangfeng', '黄枫剑', 'sword', 1, 'wood', 'huangfeng', '黄枫谷外门弟子入门时领的制式飞剑，剑柄刻一片枫叶。'],
  ['art_yy_yuehua', '月华绫', 'bind', 2, 'ice', 'yanyue', '掩月宗女弟子随身的白绫，月色下泛着淡淡银光，缠上身便是一阵寒意。'],
  ['art_ls_lingshoudai', '灵虫葫芦', 'gourd', 1, 'wood', 'lingshou', '灵兽山弟子养虫用的小葫芦，倒过来一抖，也能把小妖吸进去。'],
  ['art_qx_leiyinyin', '雷音印', 'seal', 2, 'thunder', 'qingxu', '清虚门弟子的护身法印，落下时雷声隐隐。'],
  ['art_hd_xuedao', '化刀飞刃', 'needle', 2, 'metal', 'huadao', '化刀坞的成套飞刃，七口一套，刃口薄如纸。'],
  ['art_tq_zhenbei', '镇山碑', 'slam', 2, 'earth', 'tianque', '天阙堡弟子的守山法器，一块小碑迎风便长。'],
  ['art_jj_kaishan', '开山重剑', 'sword', 2, 'metal', 'jujian', '巨剑门弟子惯用的重剑，比寻常飞剑沉上三倍。', { power: 2.8, cd: 1.3 }],
  ['art_ly_qingteng', '青藤伞', 'umbrella', 2, 'wood', 'luoyun', '落云宗药园弟子防身用的伞，伞面是青藤编的。'],
  ['art_gj_jianwan', '古剑丸', 'sword', 2, 'metal', 'gujian', '古剑门弟子温养在丹田里的剑丸，吐出便是一道剑光。'],
  ['art_bq_mujia', '木甲傀儡', 'puppet', 2, 'wood', 'baiqiao', '百巧院出品的木甲傀儡，关节灵活，挨打不疼。'],
  ['art_hy_duhulu', '五毒葫芦', 'gourd', 2, 'wood', 'huayi', '化意门弟子装毒虫的葫芦，吸人进去便是一顿毒咬。'],
  ['art_qz_tongren', '千竹铜人', 'puppet', 3, 'metal', 'qianzhu', '千竹教的铜人傀儡，力大无穷。'],
  ['art_gl_guideng', '引魂灯', 'lamp', 2, 'yin', 'guiling', '鬼灵门弟子夜行时提的小灯，灯焰幽绿，照人神魂。'],
  ['art_hh_luozhao', '粉罗罩', 'cover', 2, 'yin', 'hehuan', '合欢宗女修的粉色纱罩，罩住了便叫人心神荡漾、动弹不得。'],
  ['art_yl_xuebian', '血灵鞭', 'whip', 2, 'yin', 'yuling', '御灵宗驭兽用的骨鞭，抽在人身上也一样皮开肉绽。'],
  ['art_qh_huanshan', '幻影扇', 'fan', 2, 'wind', 'qianhuan', '千幻宗弟子的羽扇，扇出的风里夹着幻影。'],
  ['art_ts_shaci', '天煞刺', 'arrow', 2, 'yin', 'tiansha', '天煞宗的偷袭利器，见血即回。'],
  ['art_yinl_lianhun', '炼魂小幡', 'banner', 2, 'yin', 'yinluo', '阴罗宗弟子的入门魔幡，幡中只封着几只小鬼。'],
  ['art_ml_fengqi', '巽风令旗', 'fan', 2, 'wind', 'mulan', '慕兰法士的令旗，一挥便是一阵巽风。'],
  ['art_xg_zhenpan', '星宫阵盘', 'disk', 2, 'metal', 'xinggong', '星宫弟子的制式阵盘，掷地便是一座小星阵。'],
  ['art_my_yinzhu', '天音连珠', 'beads', 2, 'wind', 'miaoyin', '妙音门弟子的珠串，一珠一音，连环弹击。'],
  ['art_jy_yinsuo', '玄阴锁', 'bind', 2, 'ice', 'jiyin', '极阴岛弟子的阴寒锁链。'],
  ['art_nx_xuesuo', '逆星梭', 'shuttle', 2, 'yin', 'nixing', '逆星盟修士的遁行飞梭，杀人之后好走人。'],
  ['art_ty_qingjian', '太一清剑', 'sword', 3, 'metal', 'taiyi', '太一门弟子下山时师门所赐的飞剑。'],
  ['art_tm_mota', '小魔塔', 'pagoda', 3, 'yin', 'tianmo', '天魔宗内门弟子的魔塔，塔中困着一缕魔气。'],
  ['art_tl_shengyin', '圣殿法印', 'seal', 3, 'wind', 'tianlan', '天澜圣殿法士的法印。'],
  // —— 镇宗之宝（不外卖、不随机掉落，只能在宗门大战 / 杀人夺宝中得到）
  ['art_zz_qixuan', '七绝飞刃', 'needle', 2, 'metal', 'qixuan', '七玄门祖传的一套飞刃，七口一套，门中视若性命。'],
  ['art_zz_huangfeng', '黄枫古剑', 'sword', 4, 'wood', 'huangfeng', '黄枫谷镇谷之宝，开派祖师的本命飞剑，剑身有一片天然枫纹。'],
  ['art_zz_yanyue', '月华宝灯', 'lamp', 4, 'ice', 'yanyue', '掩月宗镇宗之宝，灯光如月，照见人心。'],
  ['art_zz_lingshou', '万兽葫芦', 'gourd', 4, 'wood', 'lingshou', '灵兽山镇山之宝，葫中收着历代长老驯服的妖兽精魂。'],
  ['art_zz_qingxu', '清虚雷印', 'seal', 4, 'thunder', 'qingxu', '清虚门镇派法印，一印落下五雷齐鸣。'],
  ['art_zz_huadao', '化血宝刀', 'sword', 4, 'yin', 'huadao', '化刀坞镇坞之宝，刀身殷红，传闻饮过结丹修士的血。'],
  ['art_zz_tianque', '镇岳宝塔', 'pagoda', 4, 'earth', 'tianque', '天阙堡镇堡之宝，七层宝塔，镇压一方。'],
  ['art_zz_jujian', '开天巨剑', 'sword', 4, 'metal', 'jujian', '巨剑门镇派之宝，剑长丈二，一剑开山。'],
  ['art_zz_luoyun', '青木灵伞', 'umbrella', 4, 'wood', 'luoyun', '落云宗镇宗之宝，伞面以千年青木皮炼成。'],
  ['art_zz_gujian', '太古剑丸', 'sword', 5, 'metal', 'gujian', '古剑门镇派之宝，相传是上古剑仙的遗物。'],
  ['art_zz_baiqiao', '天工傀儡', 'puppet', 4, 'metal', 'baiqiao', '百巧院镇院之宝，结丹之力的傀儡。'],
  ['art_zz_huayi', '万毒宝葫', 'gourd', 4, 'wood', 'huayi', '化意门镇门之宝，葫中毒气可化万物。'],
  ['art_zz_qianzhu', '大衍神傀', 'puppet', 5, 'metal', 'qianzhu', '千竹教镇教之宝，大衍神君亲手所炼。'],
  ['art_zz_guiling', '鬼王幡', 'banner', 4, 'yin', 'guiling', '鬼灵门镇门之宝，幡中封着一头鬼王。'],
  ['art_zz_hehuan', '七情罩', 'cover', 4, 'yin', 'hehuan', '合欢宗镇宗之宝，罩中七情幻象，困敌于无形。'],
  ['art_zz_yuling', '血灵骨鞭', 'whip', 4, 'yin', 'yuling', '御灵宗镇宗之宝，以妖王脊骨炼成。'],
  ['art_zz_qianhuan', '千幻宝扇', 'fan', 4, 'wind', 'qianhuan', '千幻宗镇宗之宝，扇出千般幻象。'],
  ['art_zz_tiansha', '天煞神刃', 'needle', 4, 'yin', 'tiansha', '天煞宗镇宗之宝，九口煞刃。'],
  ['art_zz_mulan', '巽风神扇', 'fan', 4, 'wind', 'mulan', '慕兰法士的圣物，风起时草原变色。'],
  ['art_zz_miaoyin', '天籁宝珠', 'beads', 4, 'wind', 'miaoyin', '妙音门镇门之宝，九颗宝珠各藏一音。'],
  ['art_zz_jiyin', '玄阴魂灯', 'lamp', 5, 'yin', 'jiyin', '极阴岛镇岛之宝，灯中燃着万千阴魂。'],
  ['art_zz_nixing', '逆星神梭', 'shuttle', 5, 'yin', 'nixing', '逆星盟诸老怪共炼的神梭。'],
  ['art_zz_tianmo', '天魔宝塔', 'pagoda', 5, 'yin', 'tianmo', '天魔宗镇宗之宝，塔中镇着一头上古天魔。'],
  ['art_zz_tianlan', '天澜圣印', 'seal', 5, 'wind', 'tianlan', '天澜圣殿圣物，印上刻着圣兽之形。'],
  ['art_zz_xinggong', '周天星盘', 'disk', 5, 'metal', 'xinggong', '星宫镇宫之宝之一，盘中星辰各自为阵。'],
  // —— 原著人物的本命法宝（补齐第一批）
  ['art_p_wanhun', '六道魔幡', 'banner', 5, 'yin', 'liudao', '六道极圣早年的本命魔幡。'],
];
/** 镇宗之宝 → 宗门 */
export const SECT_TREASURE: Record<string, string> = {};
export const SECT_GEAR: Record<string, string[]> = {};
const HAND_ITEMS: ItemDef[] = HAND.map(([id, name, k, t, wx, sect, desc, mod]) => {
  const K = KIND_OF[k], r = mulberry32(id.length * 977 + t);
  const art = { ...stats(K, t, wx, r), ...(mod ?? {}) };
  art.power = +(art.power * 1.12).toFixed(2);   // 手工精做略强
  const zz = id.startsWith('art_zz_'), p = id.startsWith('art_p_');
  ART_META[id] = { wx, kind: k, sect };
  if (zz) SECT_TREASURE[sect] = id; else if (!p) (SECT_GEAR[sect] ??= []).push(id);
  const c = WX_COLOR[wx];
  GEN_LOOK[id] = { shape: K.shape, c1: c[0], c2: c[1], glow: c[2] };
  return { id, name, type: 'artifact', tier: t, price: zz || p ? Math.round(PRICE[t] * 2) : Math.round(PRICE[t] * 1.1), desc: desc + (zz ? '（镇宗之宝，不外卖）' : `（${KIND_NAME[k]}）`), glyph: K.glyph, art } as ItemDef;
});

gen();
export const CANON_ITEMS: ItemDef[] = [...HAND_ITEMS, ...GEN];
export const GEN_COUNT = GEN.length;
export const elementName = (w: Wx) => WX_NAME[w];
