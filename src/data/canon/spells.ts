// 第 4 阶段（s4-content）：法术神通扩充——按系别手工命名、按“出手方式 × 品阶”模板补全数值
// 每一行：[id, 名, 系, 品阶, 境界, 出手, 特效, 附加, 描述, 宗门/地域标签]
// 数值不逐个手填：同一出手方式、同一品阶的法术威力相近（模板见 TPL），个性靠特效、异状、发数与描述。
import type { ArtSkill, Cast, Fx, School, StatusSpec } from '../arts';

type Extra = Partial<ArtSkill>;
type Row = [string, string, School, 0 | 1 | 2 | 3 | 4, number, Cast, Fx, Extra, string, string?];

const ST = (k: StatusSpec['k'], dur: number, ch: number): StatusSpec => ({ k, dur, ch });
/** 各系默认异状 */
const SCH_ST: Partial<Record<School, StatusSpec>> = {
  火: ST('burn', 3, 0.45), 冰: ST('slow', 2.5, 0.6), 雷: ST('shock', 0.9, 0.45), 土: ST('stun', 0.8, 0.4), 木: ST('root', 1.4, 0.45),
  风: ST('knock', 0.3, 0.7), 魔: ST('poison', 4, 0.55), 识: ST('stun', 1, 0.5), 剑: ST('break', 3, 0.25), 体: ST('knock', 0.3, 0.6),
};
const SCH_COLOR: Partial<Record<School, string>> = {
  火: '255,120,50', 冰: '160,215,255', 雷: '170,180,255', 风: '150,235,200', 土: '210,170,110', 木: '120,220,120', 剑: '200,245,230',
  体: '240,210,140', 魔: '200,60,90', 识: '210,180,250', 阵: '240,215,120', 符: '255,200,120', 身: '210,240,230', 御: '240,200,150',
};
/** 出手方式 × 品阶 → 基础数值 */
function TPL(c: Cast, t: number): Extra {
  switch (c) {
    case 'bolt': return { mp: 0.04 + 0.03 * t, cd: 0.8 + 0.55 * t, power: 1.35 + 0.75 * t, range: 600, speed: 760 };
    case 'fan': return { mp: 0.08 + 0.035 * t, cd: 3 + 1.1 * t, power: 0.9 + 0.35 * t, range: 640, speed: 640, count: 3 + t, homing: t >= 2 };
    case 'nova': return { mp: 0.1 + 0.05 * t, cd: 6 + 2 * t, power: 1.6 + 0.9 * t, range: 0, radius: 150 + 30 * t };
    case 'burst': return { mp: 0.09 + 0.05 * t, cd: 5 + 2 * t, power: 1.8 + 1.05 * t, range: 600, radius: 110 + 25 * t };
    case 'cone': return { mp: 0.07 + 0.04 * t, cd: 2.6 + 1 * t, power: 1.6 + 0.75 * t, range: 280 + 20 * t, radius: 0.55 };
    case 'beam': return { mp: 0.12 + 0.05 * t, cd: 6 + 2 * t, power: 2.6 + 1.25 * t, range: 700, radius: 26 + 7 * t };
    case 'strike': return { mp: 0.14 + 0.05 * t, cd: 8 + 2 * t, power: 1.2 + 0.5 * t, range: 640, radius: 85 + 5 * t, count: 3 + t };
    case 'chain': return { mp: 0.1 + 0.04 * t, cd: 4 + 1.5 * t, power: 1.5 + 0.7 * t, range: 560, count: 3 + t };
    case 'field': return { mp: 0.16 + 0.05 * t, cd: 9 + 2 * t, power: 0.45 + 0.25 * t, range: 560, radius: 150 + 25 * t, dur: 4 + t };
    case 'orbit': return { mp: 0.14 + 0.03 * t, cd: 12 + 2 * t, power: 0.8 + 0.4 * t, range: 0, radius: 120 + 15 * t, count: 3 + t, dur: 8 };
    case 'buff': return { mp: 0.1 + 0.03 * t, cd: 18 + 4 * t, power: 0, range: 0, dur: 10 + 2 * t };
    case 'shield': return { mp: 0.1 + 0.03 * t, cd: 14 + t, power: 0.2 + 0.08 * t, range: 0, dur: 8 + t };
    case 'heal': return { mp: 0.12 + 0.03 * t, cd: 14 + 4 * t, power: 0.3 + 0.08 * t, range: 0, dur: 4 };
    case 'dash': return { mp: 0.03 + 0.01 * t, cd: 2.2 - 0.2 * t, power: 1 + 0.4 * t, range: 300 + 40 * t };
    case 'blink': return { mp: 0.05 + 0.02 * t, cd: 9 - t, power: 0, range: 420 + 80 * t };
    case 'summon': return { mp: 0.15 + 0.03 * t, cd: 26 + 2 * t, power: 0.8 + 0.3 * t, range: 0, dur: 22 + 2 * t };
    default: return { mp: 0.1, cd: 6, power: 1, range: 500 };
  }
}
const EVO: Partial<Record<Cast, [string, string, string]>> = {
  bolt: ['弹速更快、射程更远', '命中后余劲穿透一人', '凝练如实，威力大进'],
  fan: ['多发一道', '散射更密，追敌更灵', '再添两道，扇面铺满'],
  nova: ['波及更广', '震荡两次', '中心凝出一道余波'],
  burst: ['落点范围扩大', '异状更易得手', '落定后再爆一次'],
  cone: ['喷吐更远', '扇面更宽', '余势不散，灼地数息'],
  beam: ['光柱加粗', '可贯穿护体灵光', '光柱扫过后留下余烬'],
  strike: ['多落一击', '每击范围更大', '最后一击威力倍增'],
  chain: ['多跳一人', '每跳不减威力', '弹跳间隙更短'],
  field: ['范围扩大', '持续更久', '区域会缓缓追随敌人'],
  orbit: ['多一道护体', '环绕更快', '散去时向外迸射'],
  buff: ['持续更久', '增益更强', '施展时震退近身之敌'],
  shield: ['护盾更厚', '反震更强', '护盾破碎时迸裂伤敌'],
  heal: ['恢复更多', '同时回复法力', '恢复期间减伤'],
  dash: ['距离更远', '冷却更短', '冲过之处留下残影'],
  blink: ['距离更远', '冷却更短', '落点震开周围之敌'],
  summon: ['召出之物更强', '持续更久', '多召一只'],
};

// ================================================================= 手工命名（14 系，约 130 门）
const R: Row[] = [
  // —— 火
  ['chiyan', '赤焰掌', '火', 1, 1, 'bolt', 'fireball', {}, '掌心一团赤焰拍出，中者衣衫尽燃。黄枫谷外门弟子多会此术。', 'huangfeng'],
  ['huoxian', '火线术', '火', 1, 1, 'beam', 'flame', { radius: 18 }, '指尖迸出一线火光，细如发丝，却能烧穿铁甲。'],
  ['huoyaling', '火鸦令', '火', 1, 1, 'fan', 'crow', { count: 3 }, '令符一扬，三只火鸦扑啄而去。散修中流传极广的入门火术。'],
  ['huolong', '火龙术', '火', 2, 2, 'bolt', 'firesnake', { pierce: true, homing: true }, '火焰凝成一条丈许火龙，绕身一匝后扑向敌人。'],
  ['lihuo', '离火诀', '火', 2, 2, 'cone', 'flame', {}, '离为火，诀成时口吐南明离火，近身三丈尽成火海。'],
  ['huolian', '火莲爆', '火', 2, 2, 'nova', 'flame', {}, '脚下绽开一朵赤红火莲，莲瓣迸散时周身炸成一片。'],
  ['chiyanjia', '赤炎甲', '火', 2, 2, 'shield', 'flame', { buff: { reflect: 0.35 }, status: ST('burn', 3, 0.8) }, '烈焰覆体成甲，近身来犯者先被燎上一层火。'],
  ['liuxinghuo', '流星火雨', '火', 2, 2, 'strike', 'fireball', {}, '引动高空灵火，化作流星般的火雨砸落。'],
  ['fentian', '焚天印', '火', 3, 3, 'burst', 'flame', { status: ST('burn', 4, 0.8) }, '结出火印凌空按下，印落之处焦土三尺。'],
  ['huohai', '火海术', '火', 3, 3, 'field', 'flame', {}, '以真火引燃一方天地，火海经久不熄。'],
  ['jinwu', '金乌落日', '火', 4, 4, 'beam', 'fireball', { radius: 60, status: ST('burn', 5, 0.9) }, '身后浮现一轮金乌虚影，一道日芒横扫而下，结丹修士挨上也要元气大伤。'],
  ['jiuyang', '九阳真火', '火', 4, 4, 'field', 'flame', { status: ST('burn', 5, 0.9) }, '九缕至阳真火盘旋而落，烧的是法力根基。'],
  // —— 冰 / 水
  ['xuanshui', '玄水刃', '冰', 1, 1, 'bolt', 'water', { pierce: true }, '凝水成刃，薄如蝉翼，掠过之处寒意入骨。'],
  ['hanxing', '寒星针', '冰', 1, 1, 'fan', 'icicle', { count: 4 }, '十余点寒星迸射而出，掩月宗女修常以此术御敌。', 'yanyue'],
  ['shuanghua', '霜花术', '冰', 1, 1, 'nova', 'frost', {}, '周身绽开一圈霜花，近身之敌手脚俱僵。'],
  ['bingjian', '冰剑诀', '冰', 2, 2, 'bolt', 'icicle', { pierce: true, status: ST('freeze', 1.2, 0.35) }, '寒气凝成三尺冰剑破空而去，中者半身冻结。'],
  ['hanchao', '寒潮', '冰', 2, 2, 'cone', 'frost', {}, '张口吐出一股寒潮，所过之处草木挂霜。'],
  ['bingposuo', '冰魄锁', '冰', 2, 2, 'burst', 'frost', { status: ST('freeze', 2, 0.9) }, '冰魄化锁自地下升起，将敌人连人带衣封在冰中。'],
  ['hanyue', '寒月轮', '冰', 2, 2, 'orbit', 'icicle', {}, '数轮冰月绕身旋转，近者被削成冰屑。', 'yanyue'],
  ['xuebeng', '雪崩', '冰', 3, 3, 'strike', 'icicle', {}, '引动高天寒气，冰雪如山崩般砸落。'],
  ['canglang', '沧浪诀', '冰', 3, 3, 'beam', 'water', { status: ST('knock', 0.4, 0.9) }, '一道沧浪横推而出，乱星海修士最常见的水法。', 'luanxing'],
  ['ruoshui', '弱水三千', '冰', 3, 3, 'field', 'water', { status: ST('slow', 3, 0.9) }, '鸿毛不浮的弱水漫开一片，陷入者寸步难行。', 'luanxing'],
  ['bingfeng', '冰封千里', '冰', 4, 4, 'field', 'frost', { status: ST('freeze', 2, 0.7) }, '寒气铺天盖地，一方天地尽成冰原。北冰海的老怪方能施展。', 'dajin'],
  ['tianhe', '天河倒悬', '冰', 4, 4, 'strike', 'water', {}, '一道天河自云端倒灌而下，元婴修士的大神通。', 'luanxing'],
  // —— 雷
  ['leilian', '雷链', '雷', 1, 1, 'chain', 'lightning', {}, '一道电光在敌人之间连跳，清虚门弟子的看家法术。', 'qingxu'],
  ['leizhu', '雷珠术', '雷', 1, 1, 'bolt', 'lightning', {}, '掌中凝出一枚雷珠掷出，炸开时电蛇乱窜。'],
  ['zidian', '紫电锤', '雷', 2, 2, 'burst', 'lightning', {}, '紫电凝成一柄巨锤当头砸落。'],
  ['leiyinjue', '雷音诀', '雷', 2, 2, 'nova', 'lightning', {}, '周身炸起一声闷雷，震得近身之敌耳鼻溢血。'],
  ['leimang', '雷芒刺', '雷', 2, 2, 'beam', 'goldthunder', {}, '一道金白雷芒直刺而出，最破护体灵光。'],
  ['tianleiyin', '天雷引', '雷', 2, 2, 'strike', 'lightning', {}, '掐诀引下数道天雷。雨天施展威力更甚。'],
  ['leishe', '雷蛇', '雷', 2, 2, 'fan', 'lightning', { homing: true }, '数条雷蛇自袖中窜出，自行寻敌噬咬。'],
  ['leijia', '雷甲术', '雷', 2, 2, 'shield', 'lightning', { buff: { reflect: 0.4 }, status: ST('shock', 1, 0.8) }, '雷光覆体，触者被电得浑身发麻。'],
  ['wulei', '五雷正法', '雷', 3, 3, 'strike', 'lightning', { count: 5 }, '道门正宗雷法，五雷同落，专破邪祟。', 'qingxu'],
  ['leiyun', '雷云', '雷', 3, 3, 'field', 'lightning', {}, '头顶聚起一团雷云，久久不散，雷光不断劈落。'],
  ['zixiao', '紫霄神雷', '雷', 4, 4, 'chain', 'goldthunder', { count: 7, vsEvil: 1.6 }, '紫霄宫失传的神雷，一雷化七，连劈不休。', 'dajin'],
  ['leiting', '雷霆万钧', '雷', 4, 4, 'burst', 'goldthunder', { radius: 220 }, '万钧雷霆凝于一点轰落，方圆百丈俱成焦土。'],
  // —— 风
  ['fengshi', '风矢', '风', 0, 1, 'bolt', 'wind', {}, '凝风为矢，快而无声。'],
  ['kuangfeng', '狂风术', '风', 1, 1, 'cone', 'wind', { status: ST('knock', 0.5, 1) }, '袖中卷出一股狂风，把近身之敌吹得东倒西歪。'],
  ['qingfengjian', '青风剑气', '风', 1, 1, 'fan', 'wind', {}, '风刃化作数道青色剑气斩出。'],
  ['fengbi', '风壁', '风', 1, 1, 'shield', 'wind', { buff: { reflect: 0.2 } }, '身周卷起一道风墙，箭矢法术多被吹偏。'],
  ['xuanfengzhan', '旋风斩', '风', 2, 2, 'nova', 'tornado', {}, '身化旋风，周身风刃乱舞。'],
  ['fengjuan', '风卷残云', '风', 2, 2, 'field', 'tornado', { status: ST('slow', 2, 0.7) }, '一团旋风卷入敌阵，将人困在风眼之中。'],
  ['liufeng', '流风回雪', '风', 2, 2, 'bolt', 'wind', { homing: true, count: 2 }, '两道风刃绕敌回旋，躲过一次还有第二次。', 'miaoyin'],
  ['longjuan', '龙卷', '风', 3, 3, 'burst', 'tornado', { status: ST('knock', 0.6, 1) }, '平地卷起一道龙卷，把落点之敌抛上半空。'],
  ['xunfeng', '巽风', '风', 3, 3, 'beam', 'wind', {}, '巽为风，一线巽风割肉削骨。慕兰法士惯用。', 'mulan'],
  ['heifengsha', '黑风煞', '风', 3, 3, 'field', 'tornado', { status: ST('poison', 4, 0.6) }, '风中夹着煞气，吹在人身上皮开肉绽。'],
  ['fengleiyin', '风雷引', '风', 3, 3, 'chain', 'lightning', {}, '风助雷势，一道风雷在敌人间来回激荡。'],
  ['tianfeng', '天风破', '风', 4, 4, 'strike', 'tornado', {}, '九天罡风倾泻而下，元婴之下难挡。'],
  // —— 土
  ['shijian', '石剑术', '土', 1, 1, 'bolt', 'rock', {}, '地下拔出一柄石剑掷出，势大力沉。'],
  ['huangshazhang', '黄沙掌', '土', 1, 1, 'cone', 'rock', { status: ST('slow', 2, 0.6) }, '一掌拍出漫天黄沙，迷人眼目。'],
  ['tujia', '土甲术', '土', 1, 1, 'shield', 'rock', {}, '泥土裹身成甲，虽笨重却极耐打。', 'tianque'],
  ['dilie', '地裂术', '土', 2, 2, 'beam', 'rock', { status: ST('stun', 0.8, 0.5) }, '一掌拍地，裂缝笔直窜向敌人脚下。'],
  ['yanzhu', '岩柱', '土', 2, 2, 'burst', 'rock', { status: ST('knock', 0.4, 0.9) }, '落点下方猛地顶出一根岩柱。'],
  ['zhendi', '震地', '土', 2, 2, 'nova', 'rock', {}, '跺脚震地，周身三丈地面翻起。'],
  ['feiyan', '飞岩', '土', 2, 2, 'fan', 'rock', {}, '数块飞岩呼啸而出。'],
  ['shanbeng', '山崩', '土', 3, 3, 'strike', 'rock', {}, '引动山石崩落，砸得一片狼藉。', 'tianque'],
  ['chenlong', '沉龙陷', '土', 3, 3, 'field', 'rock', { status: ST('root', 2, 0.8) }, '地面化作泥淖，陷入者如蛟龙沉渊。'],
  ['qianjun', '千钧坠', '土', 3, 3, 'burst', 'rock', { status: ST('stun', 1.4, 0.8) }, '凭空凝出千钧巨石坠落。'],
  ['houtu', '厚土载物', '土', 3, 3, 'shield', 'rock', { power: 0.5 }, '厚土之气护身，结丹修士全力一击也打不穿。'],
  ['wuyue', '五岳镇', '土', 4, 4, 'strike', 'rock', { status: ST('stun', 1.5, 0.8) }, '五座山岳虚影接连镇下。', 'dajin'],
  // —— 木
  ['muling', '木灵弹', '木', 0, 1, 'bolt', 'leaf', {}, '凝出一枚青色木灵弹，命中时藤芽乱窜。'],
  ['qingmuci', '青木刺', '木', 1, 1, 'fan', 'leaf', {}, '数枚青木尖刺齐射。', 'luoyun'],
  ['jingji', '荆棘术', '木', 1, 1, 'field', 'vine', {}, '地面钻出一片荆棘，勾住来往之敌。'],
  ['shuying', '树影', '木', 1, 1, 'shield', 'leaf', {}, '身后浮出古树虚影，枝叶替你挡下一击。'],
  ['tengman', '藤蔓缠', '木', 2, 2, 'burst', 'vine', { status: ST('root', 2, 0.9) }, '落点处数十条藤蔓破土缠来。', 'luoyun'],
  ['duzhang', '毒瘴', '木', 2, 2, 'field', 'leaf', { status: ST('poison', 5, 0.8), color: '150,200,60' }, '放出一团毒瘴，化意门的手段。', 'huayi'],
  ['kumu', '枯木逢春', '木', 2, 2, 'heal', 'leaf', {}, '运转乙木生机，枯木亦能抽芽。'],
  ['baihua', '百花杀', '木', 3, 3, 'fan', 'leaf', { count: 8, color: '255,150,200' }, '漫天花瓣如刀，美得叫人忘了躲。', 'miaoyin'],
  ['qingmulei', '青木神雷', '木', 3, 3, 'chain', 'lightning', { color: '140,255,150' }, '乙木之雷，专克阴邪，一雷连跳数人。'],
  ['wandu', '万毒噬心', '木', 3, 3, 'burst', 'vine', { status: ST('poison', 6, 1), color: '140,200,50' }, '万种剧毒混成一团炸开，中者毒入心脉。', 'huayi'],
  ['jianmu', '建木天罗', '木', 4, 4, 'field', 'vine', { status: ST('root', 2.5, 0.9) }, '传说中建木的一缕枝影落下，困敌如天罗。'],
  ['qingdi', '青帝长生', '木', 4, 4, 'heal', 'leaf', { power: 0.7 }, '青帝传下的长生法门，重伤之躯片刻复原。'],
  // —— 剑 / 金
  ['jianqi', '剑气术', '剑', 0, 1, 'bolt', 'sword', {}, '并指如剑，射出一道剑气。'],
  ['duanjin', '断金诀', '剑', 1, 1, 'cone', 'sword', {}, '庚金之气凝于掌缘，一挥之下金铁皆断。', 'huadao'],
  ['liuguang', '流光剑', '剑', 2, 2, 'bolt', 'sword', { pierce: true, homing: true }, '剑光如流光一闪，穿人而过。', 'gujian'],
  ['jianwang', '剑网', '剑', 2, 2, 'fan', 'sword', { count: 6 }, '剑气交织成网罩向敌人。'],
  ['jianlun', '剑轮', '剑', 2, 2, 'orbit', 'sword', {}, '数道剑气首尾相衔，绕身成轮。', 'jujian'],
  ['gengjinjian', '庚金剑气', '剑', 2, 2, 'beam', 'sword', {}, '一道庚金剑气横贯而出，锐不可当。'],
  ['jianyu', '剑雨', '剑', 2, 2, 'strike', 'sword', { count: 5 }, '剑气自天而落如雨。'],
  ['baihong', '白虹贯日', '剑', 3, 3, 'beam', 'bigsword', {}, '一道白虹剑光贯空而过，古剑门的成名剑术。', 'gujian'],
  ['jianguang', '剑光分化', '剑', 3, 3, 'fan', 'sword', { count: 7 }, '一剑化七，各自寻敌。'],
  ['feihong', '飞鸿剑', '剑', 3, 3, 'chain', 'sword', {}, '剑光如惊鸿，一人倒下便折向下一人。'],
  ['jianxin', '剑心通明', '剑', 3, 3, 'buff', 'sword', { buff: { atk: 0.35 } }, '心与剑合，出剑更狠更准。'],
  ['wanjian', '万剑归宗', '剑', 4, 4, 'strike', 'bigsword', { count: 8 }, '万道剑光归于一处，自天轰落。', 'taiyi'],
  // —— 体
  ['bengquan', '崩山拳', '体', 1, 1, 'cone', 'palm', { status: ST('knock', 0.4, 0.9) }, '一拳崩出，拳风如山。七玄门出身的弟子多练过此拳。', 'qixuan'],
  ['tieshan', '铁山靠', '体', 1, 1, 'dash', 'palm', {}, '整个人如铁山般撞入敌群。'],
  ['tongpigong', '铜皮功', '体', 1, 1, 'buff', 'gold', { buff: { def: 0.35 } }, '皮肉泛起铜色，刀剑难伤。'],
  ['longxiangzhang', '龙象掌', '体', 2, 2, 'burst', 'palm', { status: ST('stun', 1, 0.7) }, '掌中蕴龙象之力，隔空拍落。'],
  ['zhenshanhou', '震山吼', '体', 2, 2, 'nova', 'roar', { status: ST('stun', 1, 0.6) }, '一声长吼，山石簌簌而落。'],
  ['fumoquan', '金刚伏魔拳', '体', 3, 3, 'nova', 'palm', { vsEvil: 1.8 }, '佛门伏魔拳法，打在魔物身上分外沉重。', 'dajin'],
  ['luohan', '罗汉金身', '体', 3, 3, 'buff', 'gold', { buff: { def: 0.5, regen: 0.01 } }, '金身护体，形如罗汉。', 'dajin'],
  ['banshan', '搬山', '体', 4, 4, 'burst', 'rock', { radius: 200, status: ST('stun', 1.5, 0.9) }, '双臂托起一座虚影大山，砸向敌阵。'],
  // —— 魔
  ['xuefeng', '血锋', '魔', 1, 1, 'bolt', 'blood', {}, '以精血凝成血锋射出，见血封喉。', 'tiansha'],
  ['yinshazhang', '阴煞掌', '魔', 1, 1, 'cone', 'ghost', {}, '掌中阴煞翻涌，触者寒气攻心。', 'guiling'],
  ['guiku', '鬼哭', '魔', 2, 2, 'nova', 'ghost', { status: ST('stun', 0.8, 0.5) }, '放出一圈厉鬼哭嚎，扰人神魂。', 'guiling'],
  ['lianhunying', '炼魂幡影', '魔', 2, 2, 'fan', 'ghost', {}, '幡影一展，数道阴魂扑向敌人。', 'yinluo'],
  ['mohuo', '魔火', '魔', 2, 2, 'bolt', 'flame', { color: '170,80,220', status: ST('burn', 4, 0.6) }, '紫黑色的魔火，沾身难灭。'],
  ['xueyan', '血眼', '魔', 2, 2, 'burst', 'blood', {}, '落点睁开一只血眼，血光爆射。', 'tiansha'],
  ['yinmo', '阴魔护体', '魔', 2, 2, 'shield', 'ghost', { buff: { reflect: 0.3 } }, '阴魔缠身护体，来犯者反遭噬咬。'],
  ['shixue', '嗜血', '魔', 2, 2, 'buff', 'blood', { buff: { atk: 0.3, regen: 0.012 } }, '魔功催动，杀意大涨，伤口自愈。', 'yuling'],
  ['xuehe', '血河', '魔', 3, 3, 'field', 'blood', {}, '放出一道血河，陷入者精血被一点点抽走。', 'tiansha'],
  ['xueshachong', '血煞冲', '魔', 3, 3, 'beam', 'blood', { radius: 48 }, '血煞之气冲天而出，横扫一线。'],
  ['wangui', '万鬼朝宗', '魔', 4, 4, 'strike', 'ghost', { count: 7 }, '万鬼自九幽爬出，扑向一处。', 'tianmo'],
  ['mosha', '魔煞天罗', '魔', 4, 4, 'field', 'ghost', { status: ST('poison', 6, 0.9) }, '魔煞化作天罗当头罩下。', 'tianmo'],
  // —— 识
  ['shenjici', '神识刺', '识', 1, 1, 'bolt', 'mind', { status: ST('stun', 0.6, 0.4) }, '神识凝成细刺，直钻识海。'],
  ['jinghun', '惊魂一瞥', '识', 2, 2, 'beam', 'mind', { status: ST('stun', 1.2, 0.7) }, '双目一瞪，被看中的人魂飞魄散般愣在原地。'],
  ['luohunyin', '落魂音', '识', 2, 2, 'nova', 'mind', { status: ST('stun', 1.4, 0.6) }, '神识化作魂音，周身之人心神失守。', 'miaoyin'],
  ['huanying', '幻影术', '识', 2, 2, 'buff', 'mind', { buff: { decoy: true, speed: 0.2 } }, '化出数道幻影迷惑敌人。千幻宗的入门幻术。', 'qianhuan'],
  ['shehun', '摄魂真言', '识', 3, 3, 'burst', 'mind', { status: ST('stun', 1.8, 0.8) }, '一句真言出口，落点之人神魂被摄。', 'hehuan'],
  ['xinmojie', '心魔劫', '识', 4, 4, 'field', 'mind', { status: ST('stun', 1.5, 0.6) }, '引动对手心魔，困其于幻境之中。'],
  // —— 阵
  ['huolingzhen', '火灵阵', '阵', 1, 1, 'field', 'array', { status: ST('burn', 3, 0.6), color: '255,150,70' }, '抛出几面阵旗，布下一座小火灵阵。'],
  ['jinguangzhen', '金光阵', '阵', 2, 2, 'burst', 'array', {}, '金光阵一闭，阵中之人如遭千刀。'],
  ['xuanwuzhen', '玄武阵', '阵', 2, 2, 'shield', 'array', { power: 0.4 }, '玄武虚影护在身周。'],
  ['baguazhen', '八卦锁灵阵', '阵', 2, 2, 'burst', 'array', { status: ST('root', 2, 0.9) }, '八卦方位一转，锁住阵中灵力。', 'baiqiao'],
  ['leichizhen', '雷池阵', '阵', 3, 3, 'field', 'lightning', {}, '布下雷池，越雷池一步者遭雷殛。'],
  ['tianluozhen', '天罗地网阵', '阵', 3, 3, 'field', 'array', { status: ST('root', 2, 0.8) }, '天罗地网，插翅难飞。'],
  ['zhoutianzhen', '周天星斗阵', '阵', 4, 4, 'strike', 'star', { count: 7 }, '周天星力化作星斗砸落。星宫秘传。', 'xinggong'],
  // —— 符
  ['jinjiafu', '金甲符', '符', 1, 1, 'shield', 'talisman', {}, '一张金甲符拍在身上，金光护体。'],
  ['bingfu', '冰符·连发', '符', 1, 1, 'fan', 'talisman', { status: ST('slow', 2, 0.6) }, '连掷三张冰符。'],
  ['pojiafu', '破甲符', '符', 1, 1, 'bolt', 'talisman', { status: ST('break', 4, 0.9) }, '专破护体灵光的符箓。'],
  ['leifu', '五雷符', '符', 2, 2, 'strike', 'lightning', {}, '五雷符一张，落下五道天雷。'],
  ['yinshenfu', '隐身符', '符', 2, 2, 'buff', 'talisman', { buff: { stealth: true, speed: 0.15 }, dur: 6 }, '身形隐去数息，宜偷袭，宜逃命。'],
  ['zhenmofu', '镇魔符', '符', 3, 3, 'burst', 'talisman', { vsEvil: 2 }, '道门镇魔符，打在魔物鬼物身上威力倍增。'],
  // —— 身
  ['jinghong', '惊鸿步', '身', 1, 1, 'dash', 'wind', {}, '身形一闪如惊鸿掠水。'],
  ['shuidun', '水遁', '身', 2, 2, 'blink', 'water', {}, '化作一道水光遁出数丈。', 'luanxing'],
  ['huodun', '火遁', '身', 2, 2, 'blink', 'flame', {}, '化作一团火光遁走。'],
  ['jinguangdun', '金光遁', '身', 3, 3, 'dash', 'gold', {}, '化作一道金光，一闪数十丈。'],
  ['yingdun', '影遁', '身', 3, 3, 'blink', 'ghost', {}, '没入影子之中，再现身时已在别处。', 'qianhuan'],
  // —— 御
  ['qulingfeng', '驱灵蜂', '御', 1, 1, 'summon', 'none', { summon: { kind: 'bugs', n: 6 } }, '放出一群灵蜂叮咬敌人。灵兽山弟子人手一袋。', 'lingshou'],
  ['jinjiakui', '金甲傀儡', '御', 2, 2, 'summon', 'none', { summon: { kind: 'puppet', n: 1 } }, '放出一具金甲傀儡冲锋陷阵。', 'baiqiao'],
  ['duchong', '毒虫群', '御', 2, 2, 'summon', 'none', { summon: { kind: 'bugs', n: 10 }, status: ST('poison', 4, 0.7) }, '袖中飞出一片毒虫，嗡嗡扑面。', 'yuling'],
  ['yinshi', '炼尸', '御', 3, 3, 'summon', 'none', { summon: { kind: 'demon', n: 1 } }, '唤出一具炼尸，刀剑难伤，悍不畏死。', 'jiyin'],
  // —— 门派招牌（宗门专属）
  ['qh_qianhuan', '千幻分身', '识', 3, 3, 'buff', 'mind', { buff: { decoy: true, atk: 0.2 } }, '千幻宗镇派幻术，分出数个真假难辨的身影。', 'qianhuan'],
  ['xg_xingguang', '星光坠', '阵', 3, 3, 'strike', 'star', {}, '星宫弟子引星光坠落，光点如雨。', 'xinggong'],
  ['my_qinyin', '琴音杀', '识', 3, 3, 'fan', 'mind', { count: 5 }, '妙音门的杀伐之音，一弦一刃。', 'miaoyin'],
  ['nx_nixue', '逆血咒', '魔', 3, 3, 'chain', 'blood', {}, '逆星盟的血咒，逆转敌人血气。', 'nixing'],
  ['tl_shenguang', '天澜圣光', '风', 3, 3, 'beam', 'gold', { vsEvil: 1.5 }, '天澜圣殿的圣光，慕兰法士奉为神术。', 'tianlan'],
  ['ty_huaqing', '太一化清', '剑', 4, 4, 'beam', 'bigsword', { radius: 56 }, '太一门不传之秘，一道清光化尽万般法术。', 'taiyi'],
  // —— 秘术（要付代价）
  ['jieti', '天魔解体大法', '魔', 4, 2, 'buff', 'blood', { buff: { atk: 1.0, speed: 0.4, def: 0.2 }, dur: 12, cd: 120, mp: 0 }, '魔道禁术：自解精血，战力暴涨一倍。事后元气大伤，折寿十年。'],
  ['ranxue', '燃血术', '魔', 2, 1, 'buff', 'blood', { buff: { atk: 0.5 }, dur: 10, cd: 45, mp: 0, hpCost: 0.25 }, '燃烧精血换来片刻神勇，每用一次折寿一年。'],
  ['ranhun', '燃魂一击', '识', 3, 2, 'beam', 'mind', { power: 7, radius: 40, cd: 60, status: ST('stun', 2, 1) }, '燃烧一缕元神打出的一击，修为跌落三成小境界。'],
  ['huaxuedao', '化血神刀', '魔', 3, 2, 'beam', 'blood', { power: 6, radius: 50, cd: 40, hpCost: 0.2 }, '以自身精血化作血刀，一刀断魂。折寿二年。'],
  ['jinchan', '金蝉脱壳', '身', 3, 2, 'blink', 'gold', { range: 900, cd: 60, buff: { decoy: true } }, '留下一具空壳替死，真身已遁出数十丈。折寿一年。'],
  ['nimai', '逆脉回元', '体', 2, 2, 'heal', 'gold', { power: 0, cd: 90, mp: 0 }, '强行逆转经脉，法力瞬间回满，修为却要倒退一截。'],
  ['jiuzhuan', '九转回魂', '木', 4, 3, 'heal', 'leaf', { power: 1, cd: 180 }, '濒死之际起死回生的禁法，折寿五年。'],
];

/** 秘术代价：折寿（年）、修为倒退（本境界所需修为的比例）、法力回满 */
export interface ArtCost { life?: number; exp?: number; mpFull?: boolean; weak?: number }
export const ART_COST: Record<string, ArtCost> = {
  jieti: { life: 10, weak: 20 }, ranxue: { life: 1 }, ranhun: { exp: 0.3 }, huaxuedao: { life: 2 }, jinchan: { life: 1 },
  nimai: { exp: 0.15, mpFull: true }, jiuzhuan: { life: 5 },
  // 原有血遁类也补上代价
  xuedun: { life: 1 }, xueyingdun: { life: 3 },
};
/** 宗门 / 地域标签（掉落按地域用） */
export const SPELL_TAG: Record<string, string> = {};

function build(r: Row): ArtSkill {
  const [id, name, school, tier, realm, cast, fx, ex, desc, tag] = r;
  if (tag) SPELL_TAG[id] = tag;
  const base = TPL(cast, tier);
  const hurt = !['buff', 'shield', 'heal', 'blink', 'summon', 'orbit'].includes(cast) || cast === 'orbit';
  const s: ArtSkill = {
    id, name, school, tier, realm, cast, fx,
    mp: base.mp ?? 0.1, cd: base.cd ?? 6, power: base.power ?? 1, range: base.range ?? 0,
    color: SCH_COLOR[school] ?? '230,230,230', desc, evo: EVO[cast] ?? ['熟练', '精熟', '圆满'],
    ...base,
  } as ArtSkill;
  if (hurt && SCH_ST[school]) s.status = SCH_ST[school];
  if (cast === 'buff' && !ex.buff) s.buff = { atk: 0.2 };
  if (cast === 'shield' && !ex.buff) s.buff = { reflect: 0.15 };
  if (cast === 'fan' || cast === 'bolt') s.lvCount = [0, 1, 1, 2].map((v) => v + (s.count ?? 1)) as [number, number, number, number];
  if (s.count !== undefined && s.lvCount) delete (s as any).count;
  Object.assign(s, ex);
  if (ex.count !== undefined && s.lvCount) s.lvCount = [0, 1, 1, 2].map((v) => v + ex.count!) as [number, number, number, number];
  if (s.lvCount) delete (s as any).count;
  return s;
}

export const CANON_SPELLS: ArtSkill[] = R.map(build);
