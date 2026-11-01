// 换衣系统：衣裳 = 款式（领 / 袖 / 下裳 / 外罩 / 纹样）+ 若干套染色。
// 玩家在「衣橱」里换衣、染色、改发式与容貌；NPC 按身份从衣裳池里挑。
import type { Look, Sex, Collar, SkirtKind, OverKind, Pattern, HairStyle, Fringe, FaceParams, HeadParams, BodyParams, IdleStyle } from './types';

export interface Dye {
  name: string; robe: string; inner: string; trim: string; belt: string; pants: string; boots: string;
  over?: string; skirt?: string; shawl?: string; cuff?: string;
}
export interface Outfit {
  id: string; name: string; sex: Sex | 'u'; desc: string;
  collar: Collar; robeLen: Look['robeLen']; sleeve: Look['sleeve']; skirt: SkirtKind;
  waistline?: 'waist' | 'chest'; over?: OverKind; pattern?: Pattern; shawl?: boolean; sash?: boolean;
  dyes: Dye[];
}

const D = (name: string, robe: string, inner: string, trim: string, belt: string, pants: string, boots: string, extra: Partial<Dye> = {}): Dye => ({ name, robe, inner, trim, belt, pants, boots, ...extra });

export const OUTFITS: Outfit[] = [
  // ------------------------------------------------ 男
  { id: 'qingshan', name: '青衫', sex: 'm', desc: '交领广袖长衫。七玄门出身、行走天南的寻常修士打扮。', collar: 'cross', robeLen: 'long', sleeve: 'wide', skirt: 'robe', sash: true,
    dyes: [D('竹青', '#3f6a4c', '#ece6d6', '#2b4636', '#1f2420', '#8a7a62', '#2a2622'), D('月白', '#dfe3df', '#f7f4ec', '#71848c', '#45535a', '#a8a89c', '#3a3632'),
      D('玄墨', '#2a2b2e', '#d8d2c4', '#6a6258', '#151515', '#3a3632', '#1a1816'), D('藏蓝', '#2f4560', '#e8e4d8', '#1c2a3a', '#1a2028', '#5a6270', '#22252a'), D('赭石', '#7a4a32', '#efe2c8', '#4a2a1c', '#2a1a12', '#6a5a48', '#2a2018')] },
  { id: 'daopao', name: '宗门法袍', sex: 'u', desc: '长袍外罩半臂，袍缘绣云纹。黄枫谷、掩月宗弟子的制式法衣。', collar: 'cross', robeLen: 'long', sleeve: 'wide', skirt: 'robe', over: 'banbi', pattern: 'cloud', sash: true,
    dyes: [D('黄枫', '#e9dfc6', '#fbf8f0', '#b07a2a', '#5a3a1a', '#a89a80', '#3a2c20', { over: '#c8913a' }), D('灵霄', '#e6ecf0', '#ffffff', '#4f7fa8', '#2a4258', '#9aa8b4', '#2a3038', { over: '#5d8fb8' }),
      D('丹霞', '#f0e2dc', '#fffaf6', '#a8443a', '#5a2420', '#b09890', '#3a2420', { over: '#b8584a' }), D('青冥', '#dfe8e0', '#f8fbf6', '#3a6a52', '#1e3a2c', '#8a9a8c', '#24302a', { over: '#4a7c62' })] },
  { id: 'jinzhuang', name: '劲装', sex: 'u', desc: '短褐束袖、皮护腕、长靴，前后开衩便于腾挪。七绝堂、护卫、散修常服。', collar: 'cross', robeLen: 'mid', sleeve: 'cuffed', skirt: 'split',
    dyes: [D('玄青', '#2f3f52', '#dcd6c8', '#1b2733', '#3a2a20', '#2a2a2e', '#1c1a18', { cuff: '#4a3424' }), D('绛红', '#7a2e2a', '#eadcc8', '#3a1612', '#2a1a14', '#2e2624', '#1a1412', { cuff: '#3a2a20' }),
      D('鸦青', '#3a4446', '#e0dccf', '#22292a', '#1e1a16', '#33302c', '#181614', { cuff: '#5a4030' }), D('土黄', '#8a7448', '#efe6d0', '#4e3e20', '#3a2a18', '#4a4232', '#2a2218', { cuff: '#5a4428' })] },
  { id: 'rushan', name: '儒衫', sex: 'm', desc: '圆领长衫，戴冠执扇。读书人、谋士与客卿。', collar: 'round', robeLen: 'long', sleeve: 'wide', skirt: 'robe',
    dyes: [D('素白', '#ebe6d8', '#f8f4ea', '#6e6658', '#3a3530', '#a8a090', '#2a2622'), D('天青', '#a9bfc4', '#f2f2ec', '#4c6670', '#2c3c42', '#8a9a9c', '#283034'),
      D('秋香', '#b8a06a', '#f4ecd8', '#6a5428', '#3a2e1a', '#9a8a68', '#2e281e'), D('黛紫', '#5a4a6a', '#ece6ee', '#2e2440', '#1e1828', '#5a5262', '#1e1a22')] },
  { id: 'pifeng', name: '行者披风', sex: 'u', desc: '束袖短袍外系披风，风尘仆仆。远行的散修、赏金客。', collar: 'cross', robeLen: 'mid', sleeve: 'narrow', skirt: 'split', over: 'cape',
    dyes: [D('风尘', '#5a5244', '#e4dccb', '#2e2a22', '#2a2018', '#3e3a32', '#221e1a', { over: '#3a3530' }), D('雪夜', '#d8dcdc', '#f6f6f2', '#5a646a', '#2e3236', '#8a9092', '#2a2c2e', { over: '#2c3440' }),
      D('赤霄', '#3a2a2a', '#e8dccb', '#7a2a24', '#1a1414', '#2e2626', '#161212', { over: '#8a2a24' }), D('松烟', '#3e4a40', '#e0e2d4', '#1e2620', '#1a1e1a', '#323a34', '#181a18', { over: '#5a6a5a' })] },
  { id: 'jinpao', name: '锦袍', sex: 'm', desc: '圆领锦袍，回纹镶边，腰悬玉佩。坊市掌柜、世家子弟。', collar: 'round', robeLen: 'long', sleeve: 'wide', skirt: 'robe', pattern: 'fret',
    dyes: [D('绛紫', '#5a3a6a', '#f0e6d8', '#c8a050', '#2a1a2a', '#4a3a4a', '#1e1820'), D('朱红', '#8a2e28', '#f2e4cc', '#d0a850', '#3a1410', '#5a3a30', '#221614'),
      D('石青', '#2e5a6a', '#ece6d4', '#c8a860', '#18303a', '#3a4a50', '#1a2226'), D('金褐', '#8a6a3a', '#f4e8cc', '#e0c070', '#3a2a14', '#5a4a30', '#2a2014')] },
  { id: 'qingjia', name: '轻甲', sex: 'm', desc: '立领短袍外罩鳞甲，肩吞护臂。城卫、宗门执法弟子。', collar: 'high', robeLen: 'mid', sleeve: 'cuffed', skirt: 'split', over: 'armor',
    dyes: [D('铁衣', '#5a3a2a', '#d8cfbf', '#8a6a3a', '#2a1e16', '#3a3430', '#1a1614', { over: '#55585e', cuff: '#3a2c22' }), D('青甲', '#2e4256', '#d8d8d0', '#a08a50', '#1a222c', '#30363e', '#181a1e', { over: '#5a6a72', cuff: '#2a2a30' }),
      D('赤甲', '#6a2420', '#e0d4c0', '#c8a050', '#2a1210', '#3a2a26', '#1a1210', { over: '#6a4a3a', cuff: '#3a2420' })] },
  { id: 'buyi', name: '布衣', sex: 'u', desc: '粗布短褂、绑腿布鞋。农人、樵夫、小贩。', collar: 'cross', robeLen: 'short', sleeve: 'narrow', skirt: 'pants',
    dyes: [D('葛布', '#8a7a5a', '#e2d8c0', '#5a4c34', '#3a3020', '#4a4438', '#2a2620'), D('靛蓝', '#3e5470', '#e0dcd0', '#24344a', '#22262a', '#4a4a48', '#262422'),
      D('灰褐', '#6a6258', '#dcd4c4', '#3e3830', '#2a2620', '#4a443c', '#24201c'), D('苍绿', '#5a6a50', '#e0e0cc', '#344030', '#262a20', '#4a4a3c', '#24261e')] },
  { id: 'jiasha', name: '僧袍袈裟', sex: 'm', desc: '海青长袍外披袈裟。天南佛门、行脚僧。', collar: 'cross', robeLen: 'long', sleeve: 'wide', skirt: 'robe', over: 'kasaya',
    dyes: [D('海青', '#4a4a4c', '#e8d8b0', '#2a2a2c', '#2a2420', '#4a4644', '#262220', { over: '#a8452e' }), D('杏黄', '#c88a3a', '#e8d8b0', '#8a3a2a', '#5a2a1a', '#8a6a4a', '#3a2a1a', { over: '#9a3a26' })] },
  { id: 'mopao', name: '魔门黑袍', sex: 'u', desc: '立领黑袍、暗红回纹、血色披风。鬼灵门、合欢宗、天煞宗修士。', collar: 'high', robeLen: 'long', sleeve: 'wide', skirt: 'robe', over: 'cape', pattern: 'fret',
    dyes: [D('血煞', '#1e1a1e', '#3a2a2e', '#8a2a2a', '#120e10', '#1e1a1c', '#0e0c0c', { over: '#6a1418' }), D('幽冥', '#22222c', '#3a3a48', '#5a3a8a', '#141418', '#222228', '#101012', { over: '#2a1e3a' }),
      D('尸骨', '#3a3a34', '#cfc8b0', '#8a8460', '#1a1a16', '#2e2e28', '#141412', { over: '#22221e' })] },
  // ------------------------------------------------ 女
  { id: 'ruqun', name: '齐胸襦裙', sex: 'f', desc: '短襦配齐胸长裙，系带垂落，臂挽披帛。', collar: 'open', robeLen: 'long', sleeve: 'wide', skirt: 'pleat', waistline: 'chest', shawl: true,
    dyes: [D('桃夭', '#f6ece6', '#ffffff', '#d07a8a', '#c85a6a', '#e8c8cc', '#a85a64', { skirt: '#e89aa6', shawl: '#f8dce2' }), D('月华', '#eef2f8', '#ffffff', '#7f9cc4', '#5a7aa8', '#c8d4e4', '#5a6a8a', { skirt: '#9fb8dc', shawl: '#dbe6f4' }),
      D('鹅黄', '#fbf4e2', '#ffffff', '#c89a3a', '#a8782a', '#efe0b8', '#8a6a3a', { skirt: '#efd38a', shawl: '#fbefd0' }), D('碧水', '#eaf4f0', '#ffffff', '#4a9a8a', '#2e7a6a', '#c8e2da', '#3a6a60', { skirt: '#7fc4b4', shawl: '#d6efe8' }),
      D('胭脂', '#f4e4e4', '#fff8f8', '#9a2a3a', '#7a1a2a', '#d8a8b0', '#6a2a34', { skirt: '#b8323e', shawl: '#f2c8cc' })] },
  { id: 'guangxiu', name: '广袖流仙裙', sex: 'f', desc: '交领广袖、长裙曳地、云纹镶边。掩月宗、妙音门仙子常服。', collar: 'cross', robeLen: 'long', sleeve: 'wide', skirt: 'pleat', pattern: 'cloud', shawl: true,
    dyes: [D('素雪', '#eef2f8', '#ffffff', '#8aa4c8', '#6a7a98', '#d8dce8', '#6a5a5a', { shawl: '#d4e4f4' }), D('烟紫', '#e4dcec', '#fbf8fc', '#8a6aa8', '#5a4a78', '#cfc4dc', '#5a4a62', { shawl: '#efe2f6' }),
      D('丹砂', '#f2e0dc', '#fffaf8', '#b0453a', '#8a2a24', '#e0c0b8', '#6a3a34', { shawl: '#f6d8d0' }), D('翠微', '#e2eee6', '#fbfffc', '#5a8a6a', '#3a6a4a', '#c8dccf', '#4a5a4e', { shawl: '#dff0e4' })] },
  { id: 'beizi', name: '褙子', sex: 'f', desc: '对襟长褙子罩在长裙外，襟缘碎花。世家女子、坊市女掌柜。', collar: 'open', robeLen: 'long', sleeve: 'narrow', skirt: 'pleat', over: 'beizi', pattern: 'flower',
    dyes: [D('藕荷', '#f4ecf0', '#ffffff', '#b07a94', '#8a5a70', '#e8d8e0', '#6a4a58', { over: '#c89ab0', skirt: '#f6eef2' }), D('松花', '#f6f6ea', '#ffffff', '#8a9a4a', '#5a6a2a', '#e6e8d0', '#5a5a3a', { over: '#b8c47a', skirt: '#fafaee' }),
      D('黛青', '#eef0f4', '#ffffff', '#3a4a6a', '#2a3450', '#d8dce4', '#3a4252', { over: '#4a5a7a', skirt: '#e4e8f0' }), D('檀色', '#f6eee6', '#fffaf4', '#8a5a3a', '#6a3e24', '#e8dccc', '#5a3e2a', { over: '#a8705a', skirt: '#f4e8dc' })] },
  { id: 'nvxia', name: '女侠劲装', sex: 'f', desc: '束袖短袍、皮护腕、开衩下摆配长裤短靴。', collar: 'cross', robeLen: 'mid', sleeve: 'cuffed', skirt: 'split',
    dyes: [D('朱缨', '#b8323e', '#f4ebe0', '#3a1a1e', '#2a1a1a', '#2e2a2c', '#1e1a1a', { cuff: '#3a2622' }), D('青霜', '#5a7a8a', '#f2f2ec', '#22343e', '#1e2a32', '#2e3438', '#1a1e22', { cuff: '#2a2e34' }),
      D('墨兰', '#2e3448', '#e8e4dc', '#6a5a8a', '#1a1a24', '#24242c', '#14141a', { cuff: '#3a3040' }), D('秋枫', '#a8582a', '#f4e8d8', '#4a2410', '#2a1a10', '#3a2e24', '#1e1610', { cuff: '#4a3020' })] },
  { id: 'gongzhuang', name: '宫装', sex: 'f', desc: '广袖长裙外罩半臂，金线碎花，披帛曳地。大晋宫廷、名门闺秀。', collar: 'cross', robeLen: 'long', sleeve: 'wide', skirt: 'pleat', over: 'banbi', pattern: 'flower', shawl: true,
    dyes: [D('牡丹', '#f6e8e6', '#ffffff', '#c8a050', '#8a2a3a', '#ead0d0', '#7a3a3a', { over: '#b8323e', skirt: '#e8a0a8', shawl: '#f8dce0' }), D('琉璃', '#e8eef6', '#ffffff', '#c8a860', '#2a4a7a', '#d0dcec', '#3a4a6a', { over: '#3a5a8a', skirt: '#a8c0e0', shawl: '#e0eaf8' }),
      D('紫绶', '#efe6f2', '#ffffff', '#d0b060', '#4a2a5a', '#dcd0e4', '#4a3a52', { over: '#6a3a7a', skirt: '#c4a8d4', shawl: '#efe0f6' })] },
  { id: 'cungu', name: '布裙', sex: 'f', desc: '碎花短袄配素色长裙。村姑、绣娘、小镇女子。', collar: 'cross', robeLen: 'long', sleeve: 'narrow', skirt: 'pleat', pattern: 'flower',
    dyes: [D('蓝花', '#5a7096', '#f0ece2', '#2e3c56', '#3a3026', '#6a6a6a', '#3a3026', { skirt: '#d8d2c0' }), D('杏红', '#c8705a', '#f6efe4', '#6a3022', '#3a2a20', '#7a6a5a', '#3a2a22', { skirt: '#e6dccb' }),
      D('豆绿', '#7a9a6a', '#f2f0e4', '#3a5030', '#2e2a20', '#6a6a5a', '#2e2a22', { skirt: '#dcd8c4' })] },
];

export const OUTFIT_BY_ID: Record<string, Outfit> = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));
export function outfitsFor(sex: Sex) { return OUTFITS.filter((o) => o.sex === 'u' || o.sex === sex); }

/** 穿上某件衣裳（返回新对象；款式字段全部重置，避免上一件的外罩/纹样残留） */
export function applyOutfit(look: Look, id: string, dyeIdx = 0): Look {
  const o = OUTFIT_BY_ID[id];
  if (!o) return look;
  const d = o.dyes[((dyeIdx % o.dyes.length) + o.dyes.length) % o.dyes.length];
  const n: Look = {
    ...look,
    robe: d.robe, inner: d.inner, trim: d.trim, belt: d.belt, pants: d.pants, boots: d.boots,
    collar: o.collar, robeLen: o.robeLen, sleeve: o.sleeve, skirt: o.skirt, waistline: o.waistline ?? 'waist',
    over: o.over ?? 'none', overColor: d.over, pattern: o.pattern ?? 'none', skirtColor: d.skirt, cuff: d.cuff,
    shawl: o.shawl ? (d.shawl ?? look.shawl ?? '#f4e8f0') : undefined,
    sash: o.sash ? d.belt : undefined,
    outfit: o.id, dye: dyeIdx,
  };
  return n;
}

// ---------------------------------------------------------------- 衣橱（玩家存档里的一份）
export interface Wardrobe {
  sex: Sex; outfit: string; dye: number;
  hairStyle?: HairStyle; fringe?: Fringe; hair?: string; skin?: string;
  pin?: Look['pin'] | 'none'; ribbon?: string | 'none';
  back?: Look['back']; waist?: Look['waist']; hand?: Look['hand']; idle?: IdleStyle;
  height?: number; build?: number;
  face?: Partial<FaceParams>; head?: Partial<HeadParams>; body?: Partial<BodyParams>;
}
export const HAIR_COLORS = ['#1d1a17', '#151311', '#2a2420', '#3a2e26', '#4a3424', '#6a4a32', '#9a968c', '#d8d4cc', '#e8e8f0'];
export const SKIN_COLORS = ['#f6e2d0', '#f1d9bd', '#ecd2b2', '#e6c8a6', '#dcb894', '#c8a07a'];
export const HAIR_NAMES: Record<HairStyle, string> = { bun: '道髻', crown: '束冠', ponytail: '马尾', long: '披发', twin: '双髻', halfup: '半披发', updo: '盘发', bald: '光头' };
export const IDLE_NAMES: Record<IdleStyle, string> = { stand: '垂手', behind: '负手', clasp: '交手', chest: '当胸' };

export const DEFAULT_WARDROBE: Record<Sex, Wardrobe> = {
  m: { sex: 'm', outfit: 'qingshan', dye: 0, hairStyle: 'bun', fringe: 'none', idle: 'behind', waist: 'pouch', back: 'none', hand: 'none' },
  f: { sex: 'f', outfit: 'guangxiu', dye: 0, hairStyle: 'updo', fringe: 'wisp', idle: 'clasp', waist: 'jade', back: 'none', hand: 'none', pin: 'jade' },
};

/** 由衣橱生成外观（基于原外观：主角的剑光色、身份标记等保留） */
export function dressLook(base: Look, w: Wardrobe): Look {
  const fem = w.sex === 'f';
  let L: Look = { ...base, sex: w.sex };
  if (base.sex !== w.sex) {
    // 换了男女相：发式、身形等换成该性别的默认
    L.hairStyle = fem ? 'updo' : 'bun';
    L.lash = fem; L.lip = fem ? '#c84a5a' : undefined; L.beard = undefined;
    L.height = fem ? 0.97 : 1; L.build = fem ? 0.9 : 1;
  }
  L = applyOutfit(L, OUTFIT_BY_ID[w.outfit] && (OUTFIT_BY_ID[w.outfit].sex === 'u' || OUTFIT_BY_ID[w.outfit].sex === w.sex) ? w.outfit : DEFAULT_WARDROBE[w.sex].outfit, w.dye);
  if (w.hairStyle) L.hairStyle = w.hairStyle;
  if (w.fringe) { L.fringe = w.fringe; L.bangs = w.fringe === 'full'; }
  if (w.hair) L.hair = w.hair;
  if (w.skin) L.skin = w.skin;
  if (w.pin) L.pin = w.pin === 'none' ? undefined : w.pin;
  if (w.ribbon) L.ribbon = w.ribbon === 'none' ? undefined : w.ribbon;
  if (w.back) L.back = w.back;
  if (w.waist) L.waist = w.waist;
  if (w.hand) L.hand = w.hand;
  if (w.idle) L.idle = w.idle;
  if (w.height) L.height = w.height;
  if (w.build) L.build = w.build;
  L.face = { ...(w.face ?? {}) };
  L.head = { ...(w.head ?? {}) };
  L.body = { ...(w.body ?? {}) };
  L.headTex = undefined;
  return L;
}

// ---------------------------------------------------------------- NPC 衣裳池
export type NpcRole = 'cultivator' | 'scholar' | 'farmer' | 'merchant' | 'female' | 'elder' | 'guard' | 'monk';
export const ROLE_OUTFITS: Record<NpcRole, string[]> = {
  cultivator: ['qingshan', 'qingshan', 'daopao', 'daopao', 'jinzhuang', 'pifeng'],
  scholar: ['rushan'],
  farmer: ['buyi'],
  merchant: ['jinpao'],
  female: ['ruqun', 'ruqun', 'guangxiu', 'guangxiu', 'beizi', 'nvxia', 'gongzhuang', 'cungu'],
  elder: ['qingshan', 'daopao', 'rushan'],
  guard: ['qingjia', 'jinzhuang'],
  monk: ['jiasha'],
};
