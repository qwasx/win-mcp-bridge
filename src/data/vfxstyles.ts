// 第 6 阶段：法术特效配方表——每门法术用特效库里的哪一种配方（recipe）、什么色板。
// 配方的画法在 gl/vfxlib.ts；这里只是数据，换外观改这一张表即可。
// pal：[亮芯, 主色, 暗边/烟色]（"r,g,b"）；不写则用配方默认色板。
// 不在表里的法术（增益、召唤、遁法、护盾、治疗、法器专属出手……）沿用原来的特效。
export type Pal = [string, string, string];
export interface ArtVfx { r: string; pal?: Pal; s?: number }

// —— 常用色板
export const PAL: Record<string, Pal> = {
  fire: ['255,250,220', '255,140,40', '120,30,10'],
  fireRed: ['255,235,200', '255,80,40', '110,10,10'],
  fireGold: ['255,250,225', '255,190,70', '130,60,10'],
  blueFire: ['235,250,255', '90,170,255', '20,40,120'],
  purpleFire: ['255,230,255', '200,90,255', '60,10,90'],
  greenFire: ['230,255,220', '80,230,110', '10,40,20'],
  corpseFire: ['230,255,210', '160,200,90', '40,50,20'],
  netherFire: ['220,235,255', '70,110,230', '5,10,40'],
  ice: ['255,255,255', '160,220,255', '40,90,150'],
  silver: ['255,255,255', '220,235,255', '100,120,160'],
  water: ['235,250,255', '70,170,255', '10,60,130'],
  aurora: ['245,255,255', '140,255,230', '60,90,200'],
  thunder: ['245,245,255', '160,170,255', '50,40,140'],
  violet: ['250,240,255', '190,150,255', '70,30,140'],
  goldThunder: ['255,255,235', '255,215,90', '140,90,10'],
  wind: ['245,255,250', '170,250,220', '40,110,90'],
  earth: ['255,240,210', '200,150,90', '80,55,30'],
  sand: ['255,240,200', '230,190,110', '120,80,30'],
  wood: ['240,255,220', '110,210,80', '30,80,20'],
  jade: ['235,255,245', '90,230,180', '20,90,70'],
  cyan: ['235,255,255', '90,230,230', '10,90,100'],
  gold: ['255,252,230', '255,210,100', '140,90,20'],
  whiteGold: ['255,255,255', '255,240,190', '150,120,60'],
  spring: ['255,245,250', '255,170,200', '60,140,80'],
  mind: ['250,240,255', '200,150,255', '70,30,130'],
  lilac: ['255,245,255', '230,180,255', '110,60,150'],
  ghost: ['230,255,240', '130,240,190', '20,60,50'],
  ghostDark: ['210,230,255', '120,140,220', '10,10,40'],
  blood: ['255,220,215', '230,40,60', '70,0,10'],
  pink: ['255,240,250', '255,140,200', '120,30,80'],
  bronze: ['255,240,210', '230,180,90', '100,60,20'],
  star: ['255,255,245', '200,210,255', '50,50,130'],
  five: ['255,255,240', '255,220,140', '120,80,40'],
};

/** 每门法术的特效配方（按 data/arts.ts 的 id） */
export const ART_VFX: Record<string, ArtVfx> = {
  // —— 火
  huodan: { r: 'fireOrb', pal: PAL.fire },
  huoshe: { r: 'fireSnake', pal: PAL.fireRed },
  huoya: { r: 'fireBird', pal: PAL.fireGold },
  lieyan: { r: 'blaze', pal: PAL.fire },
  nongyan: { r: 'fireCone', pal: PAL.fireGold },
  qianlan: { r: 'icefire', pal: PAL.blueFire },
  yanbao: { r: 'fireBurst', pal: PAL.fireRed },
  liuhuo: { r: 'meteor', pal: PAL.fire },
  tianhuo: { r: 'skyfire', pal: PAL.fireGold },
  ziluo: { r: 'purpleFire', pal: PAL.purpleFire },
  // —— 冰 / 水
  bingzhui: { r: 'iceSpike', pal: PAL.ice },
  xuanbing: { r: 'frostSeal', pal: PAL.ice },
  bingpo: { r: 'iceNeedle', pal: PAL.silver },
  shuilong: { r: 'waterSpout', pal: PAL.water },
  shuidan: { r: 'waterArrow', pal: PAL.water },
  hanpo: { r: 'iceDragon', pal: PAL.ice },
  beiji: { r: 'aurora', pal: PAL.aurora },
  xuanbingyu: { r: 'frostField', pal: PAL.ice },
  // —— 雷
  zhangxin: { r: 'thunderNova', pal: PAL.thunder },
  yinlei: { r: 'thunderStrike', pal: PAL.thunder },
  leiwang: { r: 'thunderField', pal: PAL.violet },
  bixie: { r: 'bixie', pal: PAL.goldThunder },
  leiguang: { r: 'thunderChain', pal: PAL.violet },
  benlei: { r: 'thunderSword', pal: PAL.goldThunder },
  jinlei: { r: 'goldThunderBeam', pal: PAL.goldThunder },
  jiutianlei: { r: 'heavenStrike', pal: PAL.goldThunder },
  leihai: { r: 'heavenStrike', pal: PAL.violet, s: 1.2 },
  tianleifu: { r: 'talismanThunder', pal: PAL.thunder },
  // —— 风
  fengren: { r: 'windBlade', pal: PAL.wind },
  xuanfeng: { r: 'whirlwind', pal: PAL.wind },
  sanyuan: { r: 'triCrescent', pal: PAL.cyan },
  qingfeng: { r: 'windPalm', pal: PAL.wind },
  feisha: { r: 'sandStorm', pal: PAL.sand },
  // —— 土
  dici: { r: 'earthSpikeLine', pal: PAL.earth },
  liusha: { r: 'quicksand', pal: PAL.sand },
  feishi: { r: 'rockShot', pal: PAL.earth },
  huangsha: { r: 'sandNova', pal: PAL.sand },
  shanhe: { r: 'mountainCrush', pal: PAL.earth },
  qinxian: { r: 'giantPalm', pal: PAL.five },
  // —— 木
  tengfu: { r: 'vineBind', pal: PAL.wood },
  yimu: { r: 'leafBlade', pal: PAL.wood },
  // —— 剑
  yujian: { r: 'flyingSword', pal: PAL.cyan },
  qingyuanmang: { r: 'swordCrescent', pal: PAL.jade },
  jujianshu: { r: 'giantSword', pal: PAL.whiteGold },
  qingpan: { r: 'swordDragon', pal: PAL.jade },
  chunli: { r: 'springSword', pal: PAL.spring },
  zhayan: { r: 'crossSlash', pal: PAL.silver },
  jinren: { r: 'goldBlade', pal: PAL.gold },
  fenjin: { r: 'goldBlade', pal: PAL.whiteGold, s: 0.85 },
  // —— 体
  qijin: { r: 'palmShot', pal: PAL.bronze },
  jinganghou: { r: 'roarNova', pal: PAL.gold },
  faxiang: { r: 'dharma', pal: PAL.gold },
  mingwang: { r: 'mingwang', pal: PAL.fireGold },
  // —— 魔
  yinhun: { r: 'ghostChain', pal: PAL.ghost },
  xuelian: { r: 'bloodBeam', pal: PAL.blood },
  shihun: { r: 'ghostClaw', pal: PAL.ghost },
  yinfeng: { r: 'ghostClawCone', pal: PAL.ghostDark },
  qingyang: { r: 'demonFire', pal: PAL.greenFire },
  tiandushihuo: { r: 'corpseFire', pal: PAL.corpseFire },
  jiuyou: { r: 'netherFire', pal: PAL.netherFire },
  shengmo: { r: 'sunFire', pal: PAL.fireGold },
  // —— 识
  jingshen: { r: 'mindSpike', pal: PAL.mind },
  shishen: { r: 'mindSpike', pal: PAL.lilac, s: 0.8 },
  mihun: { r: 'mindNova', pal: PAL.pink },
  wugui: { r: 'fiveGhosts', pal: PAL.ghostDark },
  // —— 阵
  kunzhen: { r: 'arrayTrap', pal: PAL.gold },
  diandao: { r: 'arrayFive', pal: PAL.five },
  juling: { r: 'arrayGather', pal: PAL.jade },
  // —— 符
  huoqiufu: { r: 'talismanFire', pal: PAL.fireRed },
  dingshen: { r: 'talismanSeal', pal: PAL.gold },
};

/** NPC 招式：按弹道 / 落点的 fx 选通用配方（宗门 sig 可改写） */
export const FX_RECIPE: Record<string, string> = {
  fireball: 'fireOrb', flame: 'fireOrb', icicle: 'iceSpike', frost: 'iceSpike', water: 'waterArrow', lightning: 'thunderBolt',
  goldthunder: 'goldThunderShot', vine: 'vineBind', poison: 'vineBind', blood: 'bloodShot', ghost: 'ghostFire', wind: 'windBlade',
  rock: 'rockShot', sword: 'flyingSword', needle: 'goldBlade',
};
/** NPC 招式 fx → 招式五行（与 foeskills 的 El 对应，用于查宗门 sig） */
export const FX_EL: Record<string, string> = {
  fireball: 'fire', flame: 'fire', icicle: 'ice', frost: 'ice', water: 'water', lightning: 'thunder', goldthunder: 'gold',
  vine: 'poison', poison: 'poison', blood: 'blood', ghost: 'ghost', wind: 'wind', rock: 'earth', sword: 'sword', needle: 'metal',
};
