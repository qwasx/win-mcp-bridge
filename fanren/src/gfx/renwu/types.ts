// 人物外观参数（人物重做）
// 男女共用同一套骨骼、动作、布料与绘制框架；脸、头、身材、服饰全部是参数。
// 旧存档 / 旧数据里的 Look 只有颜色与少数款式字段，缺省的新参数由 params.ts 按性别 + 种子自动补齐。

export type Sex = 'm' | 'f';
export type HairStyle = 'bun' | 'crown' | 'ponytail' | 'long' | 'twin' | 'halfup' | 'updo' | 'bald';
/** 刘海：无 / 齐刘海 / 斜刘海 / 中分 / 鬓边碎发 */
export type Fringe = 'none' | 'full' | 'side' | 'part' | 'wisp';
/** 眼型：丹凤 / 杏眼 / 桃花 / 圆眼 / 细长 / 垂眼 */
export type EyeShape = 'phoenix' | 'almond' | 'peach' | 'round' | 'narrow' | 'droopy';
/** 眉型：剑眉 / 柳叶 / 远山 / 浓眉 / 弯眉 / 平眉 */
export type BrowShape = 'sword' | 'willow' | 'distant' | 'thick' | 'arched' | 'flat';
/** 手势：放松 / 握拳 / 握持 / 剑指 / 推掌 / 张开 / 兰花指 / 爪 / 指点 / 拈 / 法诀 / 托 */
export type Gesture = 'relax' | 'fist' | 'grip' | 'sword' | 'palm' | 'open' | 'lotus' | 'claw' | 'point' | 'pinch' | 'seal' | 'cup';
/** 领型：交领右衽 / 圆领 / 对襟 / 立领 */
export type Collar = 'cross' | 'round' | 'open' | 'high';
/** 下裳：一体长袍 / 前后开衩 / 百褶长裙 / 短褂露裤 */
export type SkirtKind = 'robe' | 'split' | 'pleat' | 'pants';
/** 外罩：无 / 半臂 / 褙子 / 披风 / 轻甲 / 袈裟 / 比甲 */
export type OverKind = 'none' | 'banbi' | 'beizi' | 'cape' | 'armor' | 'kasaya' | 'vest';
/** 镶边纹样：云纹 / 水波 / 回纹 / 碎花 / 竹叶 */
export type Pattern = 'none' | 'cloud' | 'wave' | 'fret' | 'flower' | 'bamboo';
/** 待机手势：垂手 / 负手 / 交手于腹前 / 一手负后一手当胸 */
export type IdleStyle = 'stand' | 'behind' | 'clasp' | 'chest';

/** 脸（五官）参数 */
export interface FaceParams {
  eye: EyeShape;
  eyeSize: number;   // 0.8–1.25
  eyeGap: number;    // 眼距 0.85–1.15
  eyeTilt: number;   // 眼尾上挑 -1–1
  brow: BrowShape;
  browW: number;     // 眉粗 0.6–1.5
  browH: number;     // 眉高 -0.5–0.5
  nose: number;      // 鼻 0.8–1.2
  mouth: number;     // 嘴宽 0.8–1.2
  lip: number;       // 唇厚 0.6–1.4
  smile: number;     // 嘴角 -1–1
  blush: number;     // 腮红 0–1
  age: number;       // 年纪纹 0–1
  mole: 0 | 1 | 2;   // 0 无 · 1 泪痣 · 2 唇痣
  iris: string;      // 瞳色
}

/** 头部参数 */
export interface HeadParams {
  size: number;   // 头大小 0.9–1.12
  width: number;  // 头宽 0.9–1.1
  jaw: number;    // 下颌：0 瓜子 → 1 国字
  chin: number;   // 下巴长 0.9–1.12
  cheek: number;  // 脸颊丰盈 0–1（圆脸）
  neck: number;   // 颈长 0.85–1.2
}

/** 身材参数 */
export interface BodyParams {
  shoulder: number; // 肩宽 0.85–1.2（再乘 Look.build）
  chest: number;    // 胸廓 / 胸 0.8–1.3
  waist: number;    // 腰 0.8–1.3
  hip: number;      // 臀 0.85–1.25
  leg: number;      // 腿长 0.92–1.1
  arm: number;      // 臂长 0.94–1.06
  heft: number;     // 胖瘦 / 壮硕 0.85–1.35
  belly: number;    // 肚腩 0–1
  stoop: number;    // 驼背 0–1（老者）
}

export interface Look {
  sex: Sex;
  height: number;          // 身高倍率（约 0.8–1.1）
  build: number;           // 肩宽倍率
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  bangs?: boolean;         // 刘海（旧字段：true 等于 fringe='full'）
  pin?: 'gold' | 'jade' | 'flower'; // 发簪 / 步摇
  robe: string;            // 外袍（上衣）
  inner: string;           // 内衫领口
  trim: string;            // 镶边
  belt: string;
  pants: string;
  boots: string;
  robeLen: 'long' | 'mid' | 'short';
  sleeve: 'wide' | 'narrow' | 'cuffed';
  ribbon?: string;         // 发带
  sash?: string;           // 腰带垂绦
  shawl?: string;          // 披帛
  hat?: 'douli' | 'none';
  back?: 'sword' | 'basket' | 'box' | 'none';
  waist?: 'gourd' | 'jade' | 'pouch' | 'none';
  hand?: 'fan' | 'staff' | 'none';
  beard?: string;          // 胡须颜色
  swordColor?: string;     // 飞剑 / 劲气光色
  lash?: boolean;          // 睫毛
  huadian?: string;        // 花钿颜色
  lip?: string;            // 唇色
  eyeTint?: string;        // 瞳色（旧字段，优先于 face.iris）
  earring?: string;        // 耳坠
  headTex?: string;        // 旧：手绘头部贴图（仍支持，默认不用）
  // ---------------- 人物重做新增（全部可选） ----------------
  hero?: boolean;          // 主角（专用跑姿、衣袂更飘）
  face?: Partial<FaceParams>;
  head?: Partial<HeadParams>;
  body?: Partial<BodyParams>;
  faceSeed?: number;       // 千人千面：不给 face 时按种子生成五官
  fringe?: Fringe;
  collar?: Collar;
  skirt?: SkirtKind;
  skirtColor?: string;     // 下裙颜色（襦裙 / 褙子内裙），缺省同 robe
  waistline?: 'waist' | 'chest'; // 齐腰 / 齐胸
  over?: OverKind;
  overColor?: string;
  pattern?: Pattern;
  cuff?: string;           // 护腕颜色
  outfit?: string;         // 换衣系统：当前衣裳 id
  dye?: number;            // 换衣系统：当前染色序号
  idle?: IdleStyle;
}
