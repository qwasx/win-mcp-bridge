// 第 6 阶段：宗门色系。NPC 宗门修士施法时，弹道、落点、光柱一律按本门色系与招牌形态绘制（见 gl/vfxlib.ts）。
// pal：[亮芯, 主色, 暗边/烟色]（"r,g,b"）。sig：本门招牌形态——按招式五行（foeskills 的 El）改用指定特效配方；
// any：本门所有招式都叠一层的标志性点缀（月华、星点、花瓣、鬼面……）。没列出的五行按通用配方，只换颜色。
export interface SectFx {
  name: string;
  pal: [string, string, string];
  sig?: Partial<Record<string, string>>;
  any?: 'moon' | 'star' | 'petal' | 'skull' | 'leaf' | 'cloud' | 'bug' | 'note' | 'blade' | 'blood' | 'bamboo' | 'gear' | 'sand' | 'wave';
  desc: string;
}

export const SECT_FX: Record<string, SectFx> = {
  huangfeng: { name: '黄枫谷', pal: ['235,255,250', '90,230,205', '20,90,80'], sig: { sword: 'flyingSword', metal: 'flyingSword' }, any: 'leaf', desc: '青色剑光，枫叶随剑' },
  yanyue:    { name: '掩月宗', pal: ['255,255,255', '214,226,250', '90,110,160'], sig: { ice: 'moonFrost', water: 'moonFrost' }, any: 'moon', desc: '月白寒霜，一轮冷月' },
  guiling:   { name: '鬼灵门', pal: ['220,255,200', '90,240,120', '10,50,25'], sig: { ghost: 'ghostFire', blood: 'ghostFire', poison: 'ghostFire' }, any: 'skull', desc: '绿色鬼火，鬼面隐现' },
  xinggong:  { name: '星宫', pal: ['255,255,240', '190,200,255', '40,40,110'], sig: { gold: 'starShot', metal: 'starShot', thunder: 'starShot' }, any: 'star', desc: '星芒点点，周天星斗' },
  hehuan:    { name: '合欢宗', pal: ['255,235,245', '255,130,190', '120,30,80'], sig: { poison: 'petalMist', ghost: 'petalMist', wind: 'petalMist' }, any: 'petal', desc: '粉色迷雾，桃花乱落' },
  tianque:   { name: '天阙堡', pal: ['255,245,210', '230,180,90', '90,60,20'], sig: { earth: 'rockShot', phys: 'rockShot' }, any: 'sand', desc: '厚土金黄，飞岩如堡' },
  lingshou:  { name: '灵兽山', pal: ['250,255,210', '200,220,60', '70,60,10'], sig: { poison: 'bugShot', phys: 'rockShot' }, any: 'bug', desc: '灵虫毒瘴，兽魂扑面' },
  luoyun:    { name: '落云宗', pal: ['250,255,245', '150,230,170', '40,90,60'], sig: { poison: 'leafBlade', wind: 'leafBlade' }, any: 'cloud', desc: '祥云青木，落叶飞刃' },
  yuling:    { name: '御灵宗', pal: ['245,230,255', '180,120,255', '50,20,90'], sig: { ghost: 'ghostFire', blood: 'ghostFire' }, any: 'skull', desc: '紫色灵魂，御鬼驱魄' },
  qingxu:    { name: '清虚门', pal: ['240,245,255', '150,170,255', '40,40,120'], sig: { thunder: 'thunderBolt' }, any: 'cloud', desc: '清虚紫雷，云纹缭绕' },
  huadao:    { name: '化刀坞', pal: ['255,230,225', '220,70,70', '80,10,15'], sig: { metal: 'goldBlade', sword: 'goldBlade' }, any: 'blade', desc: '血色刀芒，刃轮飞旋' },
  qixuan:    { name: '七玄门', pal: ['255,250,235', '225,205,160', '90,70,40'], any: 'blade', desc: '江湖刀剑，朴素无华' },
  jujian:    { name: '巨剑门', pal: ['245,250,255', '180,200,225', '50,60,80'], sig: { sword: 'flyingSword' }, any: 'blade', desc: '钢蓝重剑' },
  gujian:    { name: '古剑门', pal: ['255,245,215', '200,170,110', '80,60,30'], sig: { sword: 'flyingSword' }, any: 'blade', desc: '古铜剑光' },
  baiqiao:   { name: '百巧院', pal: ['255,240,220', '230,150,80', '90,50,20'], sig: { metal: 'goldBlade' }, any: 'gear', desc: '铜色机关，飞针连弩' },
  tiansha:   { name: '天煞宗', pal: ['255,210,200', '210,30,40', '60,0,10'], sig: { blood: 'bloodShot', ghost: 'bloodShot' }, any: 'blood', desc: '血煞冲天' },
  qianhuan:  { name: '千幻宗', pal: ['255,240,255', '220,150,255', '70,30,110'], sig: { ghost: 'mindSpike' }, any: 'petal', desc: '幻彩迷离' },
  yinluo:    { name: '阴罗宗', pal: ['235,220,255', '150,90,200', '40,10,60'], sig: { poison: 'ghostFire', ghost: 'ghostFire' }, any: 'skull', desc: '幽紫阴毒' },
  tianmo:    { name: '天魔宗', pal: ['255,200,190', '170,20,50', '20,0,10'], sig: { blood: 'bloodShot' }, any: 'blood', desc: '黑红魔焰' },
  huayi:     { name: '化意门', pal: ['230,250,255', '80,180,255', '10,50,100'], sig: { water: 'waterArrow' }, any: 'wave', desc: '碧水化意' },
  qianzhu:   { name: '千竹教', pal: ['245,255,225', '160,230,90', '30,70,20'], sig: { thunder: 'thunderBolt' }, any: 'bamboo', desc: '竹青雷芒' },
  taiyi:     { name: '太一门', pal: ['255,250,220', '255,210,100', '110,70,10'], sig: { gold: 'goldBlade' }, any: 'cloud', desc: '太一金光' },
  jiyin:     { name: '极阴岛', pal: ['220,235,255', '90,120,200', '10,15,40'], sig: { ice: 'iceSpike' }, any: 'skull', desc: '极阴玄冰，幽蓝发黑' },
  sanxiu:    { name: '散修', pal: ['255,240,220', '240,170,110', '80,50,30'], desc: '各家路数，杂而不精' },
  mulan:     { name: '慕兰法士', pal: ['255,245,225', '220,190,120', '90,70,30'], sig: { wind: 'windBlade' }, any: 'sand', desc: '草原风沙' },
  nixing:    { name: '逆星盟', pal: ['255,220,220', '230,90,110', '50,10,30'], sig: { blood: 'starShot', gold: 'starShot' }, any: 'star', desc: '血色星芒' },
  miaoyin:   { name: '妙音门', pal: ['240,255,250', '120,230,210', '20,80,80'], sig: { wind: 'soundWave', water: 'soundWave' }, any: 'note', desc: '音波涟漪' },
  jiexiu:    { name: '劫修', pal: ['240,235,230', '170,160,150', '40,35,30'], any: 'blade', desc: '灰暗刀光' },
};

/** 宗门色系（不认识的宗门返回 undefined，走五行默认色） */
export const sectFx = (id: string | undefined): SectFx | undefined => (id ? SECT_FX[id] : undefined);
