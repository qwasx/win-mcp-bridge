// 法术神通库（第三步）：67 门，按系别、品阶（凡/黄/玄/地/天）与境界要求划分
// 熟练度：初学 → 小成 → 大成 → 圆满，威力、数量、范围、异状几率逐级提升，部分法术在大成/圆满时形态改变。

export type School = '火' | '冰' | '雷' | '风' | '土' | '木' | '剑' | '体' | '御' | '魔' | '识' | '阵' | '身' | '符';
export const SCHOOL_NAME: Record<School, string> = {
  火: '火系', 冰: '冰系', 雷: '雷系', 风: '风系', 土: '土系', 木: '木系', 剑: '剑诀', 体: '炼体', 御: '御兽召唤', 魔: '魔道', 识: '神识', 阵: '阵法', 身: '身法', 符: '符宝',
};
export const SCHOOL_COLOR: Record<School, string> = {
  火: '#d8582a', 冰: '#5aa8d8', 雷: '#6a7ae0', 风: '#4aa890', 土: '#a07840', 木: '#4f9a48', 剑: '#3a9a8a', 体: '#c09030', 御: '#b07a30', 魔: '#b02838', 识: '#8a70c8', 阵: '#c0a040', 身: '#5a9aa0', 符: '#c86a3a',
};

export type StatusKind = 'burn' | 'freeze' | 'shock' | 'poison' | 'root' | 'knock' | 'break' | 'slow' | 'stun';
export const STATUS_NAME: Record<StatusKind, string> = { burn: '燃烧', freeze: '冰冻', shock: '麻痹', poison: '中毒', root: '定身', knock: '击退', break: '破甲', slow: '迟缓', stun: '眩晕' };
export const STATUS_COLOR: Record<StatusKind, string> = { burn: '#ff7a3a', freeze: '#9ad8ff', shock: '#b8c4ff', poison: '#7ac04a', root: '#6ab05a', knock: '#e0e0e0', break: '#e0b040', slow: '#90b0d0', stun: '#f0e080' };

export type Cast =
  | 'bolt'    // 弹道
  | 'fan'     // 扇形多发
  | 'nova'    // 以自身为中心爆发
  | 'burst'   // 落点爆发
  | 'cone'    // 前方锥形
  | 'beam'    // 直线光柱（瞬发）
  | 'strike'  // 天降打击（落点多次）
  | 'chain'   // 连锁弹跳
  | 'field'   // 持续区域
  | 'orbit'   // 环绕护体
  | 'dash'    // 冲刺
  | 'blink'   // 瞬移
  | 'buff'    // 增益
  | 'shield'  // 护盾
  | 'heal'    // 治疗
  | 'summon'  // 召唤
  | 'sense';  // 神识（外放/敛息）

export type Fx =
  | 'fireball' | 'firesnake' | 'crow' | 'flame' | 'icefire' | 'icicle' | 'frost' | 'needle' | 'water'
  | 'lightning' | 'goldthunder' | 'wind' | 'tornado' | 'rock' | 'vine' | 'leaf' | 'sword' | 'bigsword'
  | 'palm' | 'roar' | 'blood' | 'ghost' | 'mind' | 'array' | 'talisman' | 'gold' | 'star' | 'magnet' | 'dragon' | 'none';

export interface StatusSpec { k: StatusKind; dur: number; ch: number }
export interface ArtSkill {
  id: string; name: string; school: School;
  tier: 0 | 1 | 2 | 3 | 4;   // 凡 黄 玄 地 天
  realm: number;             // 修习境界要求
  cast: Cast; fx: Fx;
  mp: number;                // 法力消耗（占法力上限比例）
  hpCost?: number;           // 气血消耗（比例）
  cd: number;                // 冷却秒
  power: number;             // 威力倍率（×攻击）
  range: number;             // 射程 / 距离
  radius?: number;           // 范围半径
  count?: number;            // 发数
  speed?: number;            // 弹速
  pierce?: boolean; homing?: boolean;
  dur?: number;              // 持续（field/buff/summon/shield）
  status?: StatusSpec;
  buff?: { atk?: number; def?: number; speed?: number; regen?: number; stealth?: boolean; reflect?: number; decoy?: boolean };
  summon?: { kind: 'bugs' | 'puppet' | 'fox' | 'tihun' | 'demon'; n: number };
  needs?: string;            // 需要某件法宝（物品 id）
  vsEvil?: number;           // 对魔物/鬼物额外倍率
  color: string;             // 'r,g,b'
  desc: string;
  evo: [string, string, string]; // 小成 / 大成 / 圆满 的变化
  lvCount?: [number, number, number, number]; // 各熟练度额外发数
}

export const TIER_NAME = ['凡阶', '黄阶', '玄阶', '地阶', '天阶'];
export const TIER_COLOR = ['#7a7a70', '#4f8f4a', '#3a70b0', '#8a4fb0', '#c08a1a'];
export const PROF_NAME = ['初学', '小成', '大成', '圆满'];
export const PROF_DMG = [1, 1.2, 1.45, 1.8];
export const PROF_RAD = [1, 1.1, 1.25, 1.4];
export const PROF_CH = [0, 0.1, 0.2, 0.35];
export const PROF_CD = [1, 0.95, 0.88, 0.8];
/** 各熟练度所需施展次数（随品阶增加） */
export function profNeed(tier: number) { const k = 1 + tier * 0.6; return [0, Math.round(20 * k), Math.round(80 * k), Math.round(240 * k)]; }

const A: ArtSkill[] = [
  // ---------------- 体（基础） ----------------
  { id: 'qijin', name: '气劲掌', school: '体', tier: 0, realm: 1, cast: 'bolt', fx: 'palm', mp: 0, cd: 0.45, power: 0.8, range: 420, speed: 820, color: '210,230,210', desc: '将法力凝于掌心，隔空击出一道气劲。无需法力，炼气弟子防身之术。', evo: ['掌劲更凝，射程增加', '掌劲可穿透一名敌人', '气劲化作掌印，命中有几率击退'], status: { k: 'knock', dur: 0.2, ch: 0 } },
  // ---------------- 火 ----------------
  { id: 'huodan', name: '火弹术', school: '火', tier: 0, realm: 1, cast: 'bolt', fx: 'fireball', mp: 0.04, cd: 0.6, power: 1.25, range: 560, speed: 700, status: { k: 'burn', dur: 3, ch: 0.25 }, color: '255,120,50', desc: '修仙界最基础的攻击法术，射出拳头大小的火弹。', evo: ['一次射出两枚火弹', '火弹命中后爆裂，波及周围', '三枚火弹齐发，必定点燃敌人'], lvCount: [1, 2, 2, 3] },
  { id: 'huoshe', name: '火蛇术', school: '火', tier: 1, realm: 1, cast: 'bolt', fx: 'firesnake', mp: 0.08, cd: 2.4, power: 2.2, range: 640, speed: 480, homing: true, pierce: true, status: { k: 'burn', dur: 4, ch: 0.5 }, color: '255,90,40', desc: '火焰化作一条赤蛇，追噬敌人，可连穿数人。', evo: ['火蛇更长，追踪更灵', '两条火蛇交缠而出', '火蛇化蛟，所过之处留下火痕'], lvCount: [1, 1, 2, 2] },
  { id: 'huoya', name: '火鸦阵', school: '火', tier: 2, realm: 2, cast: 'fan', fx: 'crow', mp: 0.15, cd: 6, power: 1.3, range: 700, speed: 520, homing: true, count: 5, status: { k: 'burn', dur: 4, ch: 0.6 }, color: '255,140,60', desc: '放出一群火鸦，自行寻敌扑噬。', evo: ['火鸦增至七只', '火鸦扑中后炸开火羽', '火鸦增至十只，羽翼金红'], lvCount: [0, 2, 2, 5] },
  { id: 'lieyan', name: '烈焰风暴', school: '火', tier: 2, realm: 2, cast: 'field', fx: 'flame', mp: 0.22, cd: 10, power: 0.55, range: 520, radius: 170, dur: 4, status: { k: 'burn', dur: 3, ch: 0.7 }, color: '255,110,40', desc: '在指定处卷起一团火焰风暴，持续灼烧其中敌人。', evo: ['风暴范围扩大', '风暴缓缓追随敌人', '火柱冲天，持续时间延长'] },
  { id: 'nongyan', name: '弄焰诀', school: '火', tier: 1, realm: 1, cast: 'cone', fx: 'flame', mp: 0.07, cd: 3, power: 1.8, range: 280, radius: 0.6, status: { k: 'burn', dur: 3, ch: 0.45 }, color: '255,130,50', desc: '掌中喷出扇形烈焰，近身清场。', evo: ['火焰更远', '火焰扇面更宽', '火舌化作火莲，余烬不散'] },
  { id: 'qianlan', name: '乾蓝冰焰', school: '火', tier: 4, realm: 3, cast: 'beam', fx: 'icefire', mp: 0.3, cd: 12, power: 6, range: 760, radius: 34, status: { k: 'freeze', dur: 2.5, ch: 0.8 }, color: '120,190,255', desc: '天地奇焰。冰焰过处，万物冻结后焚尽。同时附带冰冻与燃烧。', evo: ['光柱加粗', '冰焰扫过后留下冰晶', '冰焰化作冰凤长鸣'] },
  // ---------------- 冰 ----------------
  { id: 'bingzhui', name: '冰锥术', school: '冰', tier: 0, realm: 1, cast: 'bolt', fx: 'icicle', mp: 0.05, cd: 1.2, power: 1.5, range: 600, speed: 760, status: { k: 'slow', dur: 2, ch: 0.6 }, color: '160,220,255', desc: '凝水成冰，射出锋利冰锥，命中使敌迟缓。', evo: ['冰锥穿透', '冰锥分裂为三', '冰锥命中有几率直接冻结'], lvCount: [1, 1, 3, 3] },
  { id: 'hanbing', name: '寒冰盾', school: '冰', tier: 1, realm: 1, cast: 'shield', fx: 'frost', mp: 0.12, cd: 14, power: 0.25, range: 0, dur: 8, buff: { reflect: 0.3 }, status: { k: 'freeze', dur: 1.2, ch: 0.3 }, color: '170,225,255', desc: '冰晶护体，吸收伤害，近身攻击者有几率被冻住。', evo: ['护盾更厚', '护盾破碎时冻结周围', '冰晶化作六角冰莲'] },
  { id: 'xuanbing', name: '玄冰封印', school: '冰', tier: 2, realm: 2, cast: 'burst', fx: 'frost', mp: 0.16, cd: 9, power: 1.6, range: 560, radius: 130, status: { k: 'freeze', dur: 2.2, ch: 1 }, color: '150,210,255', desc: '于落点结出玄冰，将其中敌人冰封。冰封中的敌人受雷击伤害倍增。', evo: ['范围扩大', '冰封时间延长', '冰封破碎时造成二次伤害'] },
  { id: 'bingpo', name: '冰魄神针', school: '冰', tier: 3, realm: 3, cast: 'fan', fx: 'needle', mp: 0.12, cd: 3.5, power: 0.9, range: 700, speed: 1100, count: 7, pierce: true, status: { k: 'slow', dur: 3, ch: 0.7 }, color: '200,240,255', desc: '极寒之气凝成的细针，七针连发，无孔不入。', evo: ['增至九针', '神针附带冻结', '增至十三针，寒芒如雨'], lvCount: [0, 2, 2, 6] },
  { id: 'shuilong', name: '水龙卷', school: '冰', tier: 2, realm: 2, cast: 'bolt', fx: 'water', mp: 0.14, cd: 7, power: 0.7, range: 600, speed: 220, pierce: true, dur: 3, radius: 80, status: { k: 'knock', dur: 0.3, ch: 0.5 }, color: '120,180,240', desc: '卷起一道水龙缓缓推进，绞杀其中敌人。', evo: ['水龙更粗', '水龙会卷住敌人', '双龙并出'] },
  // ---------------- 雷 ----------------
  { id: 'zhangxin', name: '掌心雷', school: '雷', tier: 1, realm: 1, cast: 'nova', fx: 'lightning', mp: 0.1, cd: 4, power: 2.2, range: 0, radius: 150, status: { k: 'shock', dur: 0.8, ch: 0.5 }, color: '180,200,255', desc: '以自身为中心炸开雷光，麻痹近身之敌。', evo: ['范围扩大', '雷光二次炸裂', '化作雷霆环，必定麻痹'] },
  { id: 'yinlei', name: '引雷术', school: '雷', tier: 2, realm: 1, cast: 'strike', fx: 'lightning', mp: 0.14, cd: 6, power: 1.8, range: 620, radius: 90, count: 3, status: { k: 'shock', dur: 1, ch: 0.6 }, color: '170,190,255', desc: '引动天雷，连劈指定处三次。雨天威力更盛。', evo: ['增至四道', '雷击范围扩大', '增至六道，雷声滚滚'], lvCount: [0, 1, 1, 3] },
  { id: 'leiwang', name: '雷网', school: '雷', tier: 2, realm: 2, cast: 'field', fx: 'lightning', mp: 0.18, cd: 10, power: 0.45, range: 520, radius: 150, dur: 4, status: { k: 'root', dur: 1.5, ch: 0.5 }, color: '160,180,255', desc: '织出一张雷电之网，困住并持续电击其中敌人。', evo: ['网面扩大', '被困者麻痹', '雷网收缩爆裂'] },
  { id: 'bixie', name: '辟邪神雷', school: '雷', tier: 3, realm: 2, cast: 'chain', fx: 'goldthunder', mp: 0.15, cd: 4, power: 2.6, range: 620, count: 4, vsEvil: 2.5, status: { k: 'shock', dur: 1, ch: 0.6 }, needs: 'art_qingzhu', color: '255,225,110', desc: '青竹蜂云剑中蕴含的辟邪神雷，金色雷弧连锁跳跃，专克魔功鬼物。', evo: ['多跳一名敌人', '雷弧更粗，必定麻痹', '金雷化龙，跳跃次数翻倍'], lvCount: [0, 1, 1, 4] },
  { id: 'leidun', name: '雷遁', school: '雷', tier: 3, realm: 3, cast: 'blink', fx: 'lightning', mp: 0.08, cd: 3, power: 1.5, range: 520, radius: 110, status: { k: 'shock', dur: 0.8, ch: 0.6 }, color: '170,200,255', desc: '化作一道雷光瞬移，落点炸开雷弧。', evo: ['距离更远', '起点也留下雷弧', '可连续雷遁两次'] },
  // ---------------- 风 ----------------
  { id: 'fengren', name: '风刃术', school: '风', tier: 0, realm: 1, cast: 'bolt', fx: 'wind', mp: 0.035, cd: 0.8, power: 1.1, range: 520, speed: 900, pierce: true, status: { k: 'knock', dur: 0.2, ch: 0.2 }, color: '200,245,225', desc: '凝风成刃，可穿透多名敌人。', evo: ['风刃更宽', '双刃交叉', '化作月牙罡风，击退敌人'], lvCount: [1, 1, 2, 2] },
  { id: 'xuanfeng', name: '旋风术', school: '风', tier: 1, realm: 1, cast: 'bolt', fx: 'tornado', mp: 0.08, cd: 4, power: 0.5, range: 520, speed: 200, pierce: true, dur: 2.6, radius: 60, status: { k: 'slow', dur: 1, ch: 0.6 }, color: '210,240,220', desc: '卷起一道旋风缓缓推进，持续切割并拉扯敌人。', evo: ['旋风更大', '旋风吸附敌人', '旋风持续更久'] },
  { id: 'fengleichi', name: '风雷翅', school: '风', tier: 4, realm: 3, cast: 'buff', fx: 'lightning', mp: 0.1, cd: 20, power: 0, range: 0, dur: 8, buff: { speed: 0.9 }, color: '190,220,255', desc: '以雷鹏之翅炼成的宝物，展开时风雷相随，遁速大增。', evo: ['持续更久', '展翅时震退周围', '遁速翻倍'] },
  { id: 'jifeng', name: '疾风九变', school: '风', tier: 3, realm: 2, cast: 'dash', fx: 'wind', mp: 0.05, cd: 1.5, power: 0.6, range: 300, color: '200,245,230', desc: '身随风动，九变莫测。冲刺途中切割路过之敌。', evo: ['距离更远', '冲刺期间无敌', '冷却大幅缩短'] },
  // ---------------- 土 ----------------
  { id: 'dici', name: '地刺术', school: '土', tier: 0, realm: 1, cast: 'beam', fx: 'rock', mp: 0.06, cd: 2.2, power: 1.6, range: 420, radius: 40, status: { k: 'stun', dur: 0.6, ch: 0.4 }, color: '190,150,90', desc: '令地面突刺而出，一线贯穿。', evo: ['地刺更远', '地刺更粗', '岩刺林立，必定眩晕'] },
  { id: 'yanjia', name: '岩甲术', school: '土', tier: 1, realm: 1, cast: 'buff', fx: 'rock', mp: 0.08, cd: 16, power: 0, range: 0, dur: 10, buff: { def: 0.5 }, color: '180,150,100', desc: '岩石覆体，防御大增。', evo: ['持续更久', '防御更高', '岩甲反震近身之敌'] },
  { id: 'liusha', name: '流沙陷', school: '土', tier: 1, realm: 1, cast: 'field', fx: 'rock', mp: 0.1, cd: 9, power: 0.25, range: 500, radius: 150, dur: 4, status: { k: 'slow', dur: 1, ch: 1 }, color: '200,170,110', desc: '化地为流沙，陷住其中敌人。', evo: ['范围扩大', '陷入者定身', '流沙化作沙暴'] },
  { id: 'tudun', name: '土遁术', school: '土', tier: 1, realm: 1, cast: 'blink', fx: 'rock', mp: 0.1, cd: 10, power: 0, range: 600, color: '170,140,90', desc: '遁入地下，片刻后在远处现身，敌人短暂失去你的踪迹。', evo: ['距离更远', '遁地后隐匿更久', '冷却缩短'] },
  // ---------------- 木 ----------------
  { id: 'tengfu', name: '藤缚术', school: '木', tier: 0, realm: 1, cast: 'bolt', fx: 'vine', mp: 0.06, cd: 3, power: 0.8, range: 520, speed: 620, status: { k: 'root', dur: 2.2, ch: 0.9 }, color: '110,190,90', desc: '射出灵藤缠住敌人。被缚者遇火则燃起燎原之火。', evo: ['缠缚更久', '藤上生刺，附带中毒', '藤蔓蔓延，缠住周围敌人'] },
  { id: 'huichun', name: '回春术', school: '木', tier: 0, realm: 1, cast: 'heal', fx: 'leaf', mp: 0.1, cd: 8, power: 0.22, range: 0, dur: 3, color: '140,220,120', desc: '乙木生机滋养经脉，数息内恢复气血。', evo: ['恢复更多', '同时恢复少量法力', '恢复期间减伤'] },
  { id: 'qingteng', name: '青藤盾', school: '木', tier: 1, realm: 2, cast: 'shield', fx: 'vine', mp: 0.12, cd: 14, power: 0.3, range: 0, dur: 8, status: { k: 'poison', dur: 4, ch: 0.5 }, color: '100,180,90', desc: '青藤绕身成盾，带毒的藤刺反伤近身之敌。', evo: ['护盾更厚', '藤刺毒性更强', '藤盾缓慢回复'] },
  { id: 'yimu', name: '乙木剑气', school: '木', tier: 2, realm: 2, cast: 'fan', fx: 'leaf', mp: 0.1, cd: 2.5, power: 1.2, range: 600, speed: 850, count: 3, pierce: true, status: { k: 'poison', dur: 4, ch: 0.35 }, color: '120,210,120', desc: '乙木灵气化作青色剑气三道，穿林透叶。', evo: ['增至四道', '剑气附带缠缚', '增至六道，绿芒蔽空'], lvCount: [0, 1, 1, 3] },
  // ---------------- 剑 ----------------
  { id: 'yujian', name: '御剑术', school: '剑', tier: 0, realm: 1, cast: 'bolt', fx: 'sword', mp: 0.04, cd: 0.9, power: 1.4, range: 640, speed: 900, pierce: true, color: '200,240,230', desc: '以神识驾驭飞剑击敌。持有飞剑法器时威力随法器提升。', evo: ['飞剑更快', '一剑穿三人', '飞剑化作剑虹'] },
  { id: 'qingyuanmang', name: '青元剑芒', school: '剑', tier: 1, realm: 1, cast: 'cone', fx: 'sword', mp: 0.06, cd: 1.8, power: 2, range: 260, radius: 0.45, color: '150,240,200', desc: '青元剑诀一至三层：掌中吐出尺许青色剑芒，近战斩击。', evo: ['剑芒更长', '剑芒破甲', '剑芒化作三道'], status: { k: 'break', dur: 4, ch: 0 } },
  { id: 'hutijiandun', name: '护体剑盾', school: '剑', tier: 2, realm: 2, cast: 'orbit', fx: 'sword', mp: 0.14, cd: 14, power: 0.9, range: 0, radius: 110, count: 6, dur: 8, color: '160,240,210', desc: '青元剑诀四至六层：剑光绕身旋转成盾，伤敌并抵挡部分伤害。', evo: ['剑光增至八道', '剑盾范围扩大', '剑盾破碎时剑光四射'], lvCount: [0, 2, 2, 4] },
  { id: 'jianying', name: '剑影分光术', school: '剑', tier: 3, realm: 2, cast: 'fan', fx: 'sword', mp: 0.12, cd: 3, power: 1.6, range: 720, speed: 950, homing: true, count: 3, color: '180,255,220', desc: '青元剑诀七至九层：一剑化三，剑影自行寻敌。', evo: ['化作四道剑影', '剑影穿透', '化作六道剑影'], lvCount: [0, 1, 1, 3] },
  { id: 'jujianshu', name: '巨剑术', school: '剑', tier: 3, realm: 3, cast: 'beam', fx: 'bigsword', mp: 0.2, cd: 8, power: 5, range: 600, radius: 60, status: { k: 'knock', dur: 0.4, ch: 1 }, color: '220,255,240', desc: '剑光暴涨化作十余丈巨剑，一斩而下。', evo: ['剑身加长', '巨剑化作金色', '巨剑化作赤红，剑气纵横'] },
  { id: 'dageng', name: '大庚剑阵', school: '剑', tier: 4, realm: 3, cast: 'field', fx: 'sword', mp: 0.4, cd: 25, power: 1.1, range: 640, radius: 260, dur: 5, status: { k: 'break', dur: 6, ch: 0.8 }, needs: 'art_qingzhu', color: '255,240,170', desc: '以融入庚精的青竹蜂云剑布下剑阵，剑丝如雨，无坚不摧。', evo: ['剑阵扩大', '剑丝附带辟邪神雷', '剑阵笼罩全场，金芒万道'] },
  { id: 'qingpan', name: '青蟠剑阵', school: '剑', tier: 4, realm: 4, cast: 'bolt', fx: 'dragon', mp: 0.35, cd: 16, power: 4, range: 800, speed: 520, pierce: true, radius: 70, color: '120,240,180', desc: '飞剑齐鸣，化作一条青色蛟龙横扫而过。', evo: ['青龙更大', '青龙回旋再扫', '双龙交缠'] },
  { id: 'chunli', name: '春黎剑阵', school: '剑', tier: 4, realm: 5, cast: 'field', fx: 'star', mp: 0.4, cd: 30, power: 1.6, range: 600, radius: 320, dur: 6, status: { k: 'stun', dur: 1.2, ch: 0.5 }, color: '230,210,255', desc: '化神剑阵，幻象重重，敌在阵中不辨东西。', evo: ['阵域扩大', '幻象使敌自相攻伐', '剑阵持续更久'] },
  // ---------------- 体 ----------------
  { id: 'jingang', name: '金刚诀', school: '体', tier: 1, realm: 1, cast: 'buff', fx: 'gold', mp: 0.08, cd: 18, power: 0, range: 0, dur: 10, buff: { def: 0.3, regen: 0.01 }, color: '240,210,120', desc: '金光覆体，防御提升，伤势缓慢愈合。', evo: ['持续更久', '免疫击退', '金身不坏，防御大增'] },
  { id: 'xiangjia', name: '象甲功', school: '体', tier: 2, realm: 2, cast: 'buff', fx: 'gold', mp: 0.1, cd: 20, power: 0, range: 0, dur: 12, buff: { def: 0.45, regen: 0.02 }, color: '200,180,120', desc: '炼体功法，皮肤化作象甲，刀剑难伤。', evo: ['持续更久', '回复增强', '受击时反震'] },
  { id: 'mingwang', name: '明王诀', school: '体', tier: 3, realm: 3, cast: 'buff', fx: 'gold', mp: 0.12, cd: 22, power: 0, range: 0, dur: 10, buff: { atk: 0.4, def: 0.2 }, color: '255,200,90', desc: '明王法相加身，攻伐之力大增。', evo: ['攻击更高', '法相三头六臂', '攻击翻倍'] },
  { id: 'jinganghou', name: '金刚吼', school: '体', tier: 3, realm: 3, cast: 'nova', fx: 'roar', mp: 0.12, cd: 8, power: 1.8, range: 0, radius: 220, status: { k: 'stun', dur: 1.2, ch: 0.8 }, color: '255,220,140', desc: '一声佛门狮吼，震慑周围之敌。', evo: ['范围更大', '眩晕更久', '吼声化作金色音浪三重'] },
  // ---------------- 御兽召唤 ----------------
  { id: 'yushou', name: '御兽诀·灵狐', school: '御', tier: 1, realm: 1, cast: 'summon', fx: 'none', mp: 0.15, cd: 25, power: 0.8, range: 0, dur: 25, summon: { kind: 'fox', n: 1 }, color: '255,230,200', desc: '召出一只白狐灵宠助战。', evo: ['灵狐更强', '灵狐会放狐火', '召出两只灵狐'] },
  { id: 'kuilei', name: '傀儡术', school: '御', tier: 2, realm: 2, cast: 'summon', fx: 'none', mp: 0.18, cd: 30, power: 1.2, range: 0, dur: 25, summon: { kind: 'puppet', n: 1 }, color: '200,180,150', desc: '放出机关傀儡兽，悍不畏死。', evo: ['傀儡更结实', '傀儡自爆', '放出两具傀儡'] },
  { id: 'shijin', name: '噬金虫群', school: '御', tier: 4, realm: 2, cast: 'summon', fx: 'gold', mp: 0.2, cd: 22, power: 0.35, range: 0, dur: 16, summon: { kind: 'bugs', n: 14 }, status: { k: 'break', dur: 5, ch: 0.6 }, color: '255,215,90', desc: '奇虫榜排名第三的噬金虫，金属宝物也难挡其啃噬。', evo: ['虫群增多', '啃噬破甲更强', '虫群遮天蔽日'] },
  { id: 'tihun', name: '啼魂兽', school: '御', tier: 4, realm: 4, cast: 'summon', fx: 'ghost', mp: 0.25, cd: 40, power: 2, range: 0, dur: 20, summon: { kind: 'tihun', n: 1 }, vsEvil: 3, color: '230,200,255', desc: '专吞魂魄的上古异兽，鬼物魔魂见之即逃。', evo: ['吞噬更快', '吞噬后回复你的法力', '啼魂长啸，震慑全场'] },
  // ---------------- 魔 ----------------
  { id: 'xueying', name: '血影遁', school: '魔', tier: 2, realm: 2, cast: 'blink', fx: 'blood', mp: 0.04, hpCost: 0.06, cd: 4, power: 0.8, range: 480, radius: 90, color: '200,40,50', desc: '化作一道血影遁走，所经之处血光迸射。', evo: ['距离更远', '落点血爆', '冷却缩短'] },
  { id: 'yinhun', name: '阴魂丝', school: '魔', tier: 2, realm: 2, cast: 'chain', fx: 'ghost', mp: 0.1, cd: 3, power: 1.4, range: 540, count: 3, status: { k: 'poison', dur: 5, ch: 0.7 }, color: '160,120,200', desc: '放出阴魂凝成的黑丝，连缠数敌，阴毒入骨。', evo: ['多缠一敌', '毒性更烈', '黑丝化作鬼手'], lvCount: [0, 1, 1, 2] },
  { id: 'wuzi', name: '五子同心魔', school: '魔', tier: 4, realm: 3, cast: 'summon', fx: 'blood', mp: 0.25, cd: 35, power: 1.4, range: 0, dur: 20, summon: { kind: 'demon', n: 5 }, color: '200,50,60', desc: '五具心魔傀儡同心同体，杀伐凶戾。', evo: ['心魔更强', '心魔自爆', '心魔合体'] },
  { id: 'xuelian', name: '血炼神光', school: '魔', tier: 3, realm: 3, cast: 'beam', fx: 'blood', mp: 0.15, cd: 6, power: 3.2, range: 640, radius: 26, status: { k: 'break', dur: 4, ch: 0.5 }, color: '230,40,60', desc: '血色神光贯穿敌人，夺其精血以补己身。', evo: ['吸血更多', '光柱更粗', '神光化作三道'] },
  // ---------------- 识 ----------------
  { id: 'waifang', name: '神识外放', school: '识', tier: 0, realm: 1, cast: 'sense', fx: 'mind', mp: 0.3, cd: 30, power: 0, range: 0, dur: 6, color: '220,210,255', desc: '将神识尽数外放，六息之内神识范围翻倍。（快捷键 Q）', evo: ['持续更久', '外放时敌人现形', '范围三倍'] },
  { id: 'lianxi', name: '敛息', school: '识', tier: 0, realm: 1, cast: 'sense', fx: 'mind', mp: 0, cd: 1, power: 0, range: 0, color: '180,190,210', desc: '收敛气息与神识，不易被他人与妖兽察觉。（快捷键 R）', evo: ['敛息更深', '敛息时移速不减', '高阶修士也难以察觉'] },
  { id: 'jingshen', name: '惊神刺', school: '识', tier: 3, realm: 2, cast: 'bolt', fx: 'mind', mp: 0.1, cd: 6, power: 2, range: 700, speed: 1400, status: { k: 'stun', dur: 2, ch: 1 }, color: '230,215,255', desc: '大衍诀神通：神识化刺，无形无影，令敌失神。', evo: ['失神更久', '刺穿多人', '神识强于对方时伤害翻倍'] },
  { id: 'dayanchong', name: '大衍神识冲击', school: '识', tier: 4, realm: 3, cast: 'nova', fx: 'mind', mp: 0.2, cd: 14, power: 3, range: 0, radius: 300, status: { k: 'stun', dur: 1.5, ch: 0.8 }, color: '210,190,255', desc: '大衍诀高层神通，神识如潮扫荡四方。', evo: ['范围更大', '眩晕更久', '冲击三重'] },
  // ---------------- 阵 ----------------
  { id: 'kunzhen', name: '困阵', school: '阵', tier: 1, realm: 1, cast: 'field', fx: 'array', mp: 0.12, cd: 12, power: 0.15, range: 480, radius: 150, dur: 5, status: { k: 'root', dur: 1, ch: 1 }, color: '240,220,150', desc: '抛出阵旗布下困阵，阵中敌人寸步难行。', evo: ['阵域扩大', '阵中敌人破甲', '困阵持续更久'] },
  { id: 'diandao', name: '颠倒五行阵', school: '阵', tier: 3, realm: 2, cast: 'field', fx: 'array', mp: 0.2, cd: 18, power: 0.6, range: 520, radius: 200, dur: 6, status: { k: 'stun', dur: 0.8, ch: 0.4 }, color: '230,200,120', desc: '五行逆转，阵中敌人晕头转向，五行之力反噬其身。', evo: ['阵域扩大', '五行反噬伤害提升', '阵法持续更久'] },
  { id: 'juling', name: '聚灵阵', school: '阵', tier: 1, realm: 1, cast: 'field', fx: 'array', mp: 0, cd: 30, power: -0.05, range: 0, radius: 180, dur: 10, color: '160,240,200', desc: '布下聚灵阵，阵中法力与气血缓缓回复。', evo: ['回复更快', '持续更久', '阵中修炼速度提升'] },
  // ---------------- 身 ----------------
  { id: 'yufeng', name: '御风步', school: '身', tier: 0, realm: 1, cast: 'dash', fx: 'wind', mp: 0.03, cd: 1.6, power: 0, range: 240, color: '210,240,230', desc: '身法闪避，瞬间滑出数丈。', evo: ['距离更远', '冷却缩短', '冲刺期间无敌'] },
  { id: 'luoyan', name: '罗烟步', school: '身', tier: 1, realm: 1, cast: 'dash', fx: 'wind', mp: 0.03, cd: 1.0, power: 0, range: 300, color: '220,220,230', desc: '罗烟一起，人已不见。冷却更短，距离更远。', evo: ['冲刺留下烟雾迷惑敌人', '冷却更短', '可连续闪避'] },
  { id: 'nifeng', name: '匿风术', school: '身', tier: 1, realm: 1, cast: 'buff', fx: 'wind', mp: 0.08, cd: 20, power: 0, range: 0, dur: 6, buff: { speed: 0.4, stealth: true }, color: '200,230,220', desc: '借风匿形，敌人失去你的踪迹，遁速提升。', evo: ['持续更久', '遁速更快', '攻击不破隐'] },
  { id: 'xuedun', name: '血遁', school: '身', tier: 2, realm: 1, cast: 'blink', fx: 'blood', mp: 0, hpCost: 0.2, cd: 25, power: 0, range: 1200, color: '200,30,40', desc: '燃烧精血遁走千里的保命秘术，代价不小。', evo: ['距离更远', '精血消耗减少', '遁后片刻隐身'] },
  // ---------------- 符宝 ----------------
  { id: 'huoqiufu', name: '火球符·连发', school: '符', tier: 0, realm: 1, cast: 'fan', fx: 'talisman', mp: 0.06, cd: 3, power: 1.1, range: 560, speed: 650, count: 4, status: { k: 'burn', dur: 3, ch: 0.3 }, color: '255,150,70', desc: '一次激发数张火球符，火球连珠而出。', evo: ['增至五枚', '火球爆裂', '增至八枚'], lvCount: [0, 1, 1, 4] },
  { id: 'tianleifu', name: '天雷符', school: '符', tier: 2, realm: 1, cast: 'strike', fx: 'lightning', mp: 0.15, cd: 9, power: 4.5, range: 600, radius: 120, count: 1, status: { k: 'shock', dur: 1.2, ch: 0.8 }, color: '190,200,255', desc: '中阶符箓，引九天神雷轰击一处。', evo: ['雷击范围扩大', '双雷齐落', '三雷齐落'], lvCount: [0, 0, 1, 2] },
  { id: 'tishen', name: '替身术', school: '符', tier: 2, realm: 2, cast: 'buff', fx: 'talisman', mp: 0.1, cd: 24, power: 0, range: 0, dur: 6, buff: { decoy: true, stealth: true }, color: '230,200,160', desc: '燃符化出替身，敌人转而攻击替身。', evo: ['替身更久', '替身爆炸', '替身两具'] },
  { id: 'xutianding', name: '虚天鼎', school: '符', tier: 4, realm: 3, cast: 'burst', fx: 'gold', mp: 0.3, cd: 20, power: 6, range: 560, radius: 200, status: { k: 'root', dur: 2, ch: 1 }, color: '220,190,120', desc: '虚天殿重宝，鼎口一张，吞噬范围内一切。', evo: ['范围扩大', '吸力更强', '鼎中乾蓝冰焰喷薄而出'] },
  { id: 'yuanci', name: '元磁神光', school: '符', tier: 4, realm: 4, cast: 'beam', fx: 'magnet', mp: 0.3, cd: 15, power: 4, range: 720, radius: 40, status: { k: 'root', dur: 3, ch: 1 }, color: '200,170,255', desc: '五色元磁神光，五行法宝之克星，被照者寸步难移。', evo: ['光柱加粗', '禁锢更久', '五色光柱扫射'] },
  { id: 'dongxuan', name: '洞漩金光', school: '符', tier: 4, realm: 4, cast: 'nova', fx: 'gold', mp: 0.3, cd: 16, power: 5, range: 0, radius: 320, status: { k: 'break', dur: 6, ch: 1 }, color: '255,220,120', desc: '金光漩涡自身周涌出，无物不破。', evo: ['范围更大', '金光二次回卷', '金光三重'] },
  { id: 'sanyuan', name: '三元斩', school: '剑', tier: 3, realm: 3, cast: 'fan', fx: 'wind', mp: 0.14, cd: 4, power: 2.2, range: 640, speed: 1000, count: 3, pierce: true, status: { k: 'break', dur: 4, ch: 0.5 }, color: '220,240,255', desc: '三道月牙斩芒呈品字形斩出，破甲裂铠。', evo: ['斩芒更宽', '斩芒回旋', '五道斩芒'], lvCount: [0, 0, 1, 2] },
  { id: 'shengmo', name: '圣魔驭日', school: '魔', tier: 4, realm: 5, cast: 'strike', fx: 'flame', mp: 0.45, cd: 30, power: 6, range: 700, radius: 220, count: 3, status: { k: 'burn', dur: 6, ch: 1 }, color: '255,80,40', desc: '化神神通，驭使魔日从天而降，焚灭一切。', evo: ['魔日更大', '五轮魔日', '魔日不灭'], lvCount: [0, 1, 2, 2] },
  { id: 'jinlei', name: '金雷竹·雷芒', school: '雷', tier: 3, realm: 2, cast: 'beam', fx: 'goldthunder', mp: 0.12, cd: 5, power: 2.8, range: 620, radius: 30, vsEvil: 2, status: { k: 'shock', dur: 1, ch: 0.7 }, needs: 'mat_jinleizhu', color: '255,230,120', desc: '催动金雷竹中的辟邪神雷，射出一道金色雷芒。', evo: ['雷芒加粗', '雷芒分叉', '雷芒贯日'] },
];

export const ARTS: Record<string, ArtSkill> = Object.fromEntries(A.map((s) => [s.id, s]));
export const ART_LIST = A;
export function artById(id: string): ArtSkill | undefined { return ARTS[id]; }

/** 开局所学 */
export const START_ARTS = ['qijin', 'huodan', 'fengren', 'yufeng', 'huichun', 'waifang', 'lianxi'];
export const START_HOTBAR: (string | null)[] = ['qijin', 'huodan', 'fengren', 'yufeng', 'huichun', 'waifang', 'lianxi', null, null];

/** 熟练度等级 */
export function profLevel(tier: number, xp: number) { const n = profNeed(tier); return xp >= n[3] ? 3 : xp >= n[2] ? 2 : xp >= n[1] ? 1 : 0; }
