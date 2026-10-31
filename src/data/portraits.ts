// 人物立绘（对话时显示）：有名有姓的用专属立绘，无名路人按身份从通用立绘池里挑一张（按 id 固定，不会每次变）
// 大地图上的人物仍是代码画的小人，这里只管对话框。
import type { Look } from '../gfx/character';
import type { NpcData } from '../world/npc';
import type { DNode } from '../world/modal';
import { BEAUTIES } from './beauties';

/** 名字 → 专属立绘 id（public/art/npc/<id>.webp） */
const NAMED: Record<string, string> = {
  '李化元': 'lihuayuan',
  '令狐老祖': 'linghu',
  '雷万鹤': 'leiwanhe',
  '红拂': 'hongfu',
  '钟卫娘': 'zhongweiniang',
  '钟灵道': 'zhonglingdao',
  '马师伯': 'mashibo',
  '吴风': 'wufeng',
  '叶师叔': 'yeshishu',
  '刘靖': 'liujing',
  '陆师兄': 'lushixiong',
  '慕容兄弟': 'murong',
  '陆青崖': 'o_luqingya',
  '赵无忌': 'o_zhaowuji',
  '墨大夫': 'modaifu',
  '厉飞雨': 'lifeiyu',
  '王绝楚': 'wangjuechu',
  '张铁': 'zhangtie',
  '贾天龙': 'jiatianlong',
  '孙二狗': 'sunergou',
  '霓裳仙子': 'nichang',
  '穹老怪': 'qionglaoguai',
  '多宝女': 'duobaonv',
  '赵师妹': 'zhaoshimei',
  '浮云子': 'fuyunzi',
  '寒天涯': 'hantianya',
  '萧二': 'xiaoer',
  '李缨宁': 'liyingning',
  '封岳': 'fengyue',
  '马云龙': 'mayunlong',
  '武痴': 'wuchi',
  '钟吾': 'zhongwu',
  '吕天蒙': 'lvtianmeng',
  '菡云芝': 'hanyunzhi',
  '燕如嫣': 'yanruyan',
  '燕家老祖': 'yanlaozu',
  '王蝉': 'wangchan',
  '王天古': 'wangtiangu',
  '王天胜': 'wangtiansheng',
  '碎魂真人': 'suihun',
  '鬼老': 'guilao',
  '童老': 'tonglao',
  '合欢老魔': 'hehuanlaomo',
  '云露老魔': 'yunlu',
  '肥魔': 'ju_m',
  '姹魔': 'ju_f',
  '东门图': 'dongmentu',
  '天煞真君': 'tiansha',
  '卫长老': 'weizhanglao',
  '鲁长老': 'luzhanglao',
  '付家老祖': 'fujia',
  '程天坤': 'chengtiankun',
  '吕洛': 'lvluo',
  '姜云': 'jiangyun',
  '昌正': 'changzheng',
  '向之礼': 'xiangzhili',
  '南陇侯': 'nanlonghou',
  '万小山': 'wanxiaoshan',
  '齐云霄': 'qiyunxiao',
  '辛如音': 'xinruyin',
  '蒙大': 'meng_m',
  '蒙三妹': 'meng_f',
  '金光上人': 'jinguang',
  '余子童': 'yuzitong',
  '欧阳飞天': 'ouyang',
  '天澜圣女': 'tianlan_saint',
  '慕兰神师': 'mulan_shi',
  '曹梦容': 'caomengrong',
  '吴丑': 'wuchou',
  '孟铁衣': 'o_mengtieyi',
  '孟铁山': 'o_mengtieshan',
  '慧明': 'o_huiming',
  '顾松鹤': 'o_gusonghe',
  '雷九': 'o_leijiu',
  '柳三娘': 'o_liusanniang',
  '白枭': 'o_baixiao',
  '阿妤': 'o_ayu',
  '极阴老祖': 'jiyin',
  '玄骨上人': 'xuangu',
  '乌丑': 'wuchou_jy',
  '蛮胡子': 'manhuzi',
  '温天仁': 'wentianren',
  '六道极圣': 'liudao',
  '青易居士': 'qingyi',
  '范夫人': 'fanfuren',
  '卓如婷': 'zhuoruting',
  '妙鹤真人': 'miaohe',
  '乾老魔': 'qianlaomo',
  '房宗主': 'fangzongzhu',
  '天哭老人': 'tianku',
  '陆夫人': 'lufuren',
  '玄青子': 'xuanqingzi',
  '七妙真人': 'qimiao',
  '寒骊上人': 'hanli_ji',
  '白瑶怡': 'baiyaoyi',
  '车老妖': 'chelaoyao',
  '风希': 'fengxi',
  '金蛟王': 'jinjiaowang',
  '银翅夜叉': 'yinchi',
  '毒蛟': 'dujiao',
  // 别名
  '万天明': 'liudao', '寒骊': 'hanli_ji', '天哭': 'tianku', '鞠': 'ju_m', '飞天': 'ouyang',
};
const NAMED_IDS = new Set(Object.values(NAMED));

const npcArt = (id: string) => `./art/npc/${id}.webp`;
const genArt = (id: string) => `./art/gen/${id}.webp`;

/** 名字直接对得上的（原著 / 原创人物、红颜） */
const BEAUTY_BY_NAME = new Map(BEAUTIES.map((b) => [b.name, b.portrait]));
export function namedPortrait(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const b = BEAUTY_BY_NAME.get(name); if (b) return b;
  const id = NAMED[name]; return id ? npcArt(id) : undefined;
}

// ------------------------------------------------------------ 通用立绘池
const P = {
  sectM: ['sect_m1', 'sect_m2', 'sect_m3', 'sect_m4', 'sect_m8'],
  sectE: ['sect_e1', 'sect_e2'],
  sectF: ['sect_f1', 'sect_f2', 'sect_f3', 'sect_f5'],
  sectFE: ['sect_f4'],
  demonM: ['demon_m1', 'demon_m2', 'demon_m3', 'demon_m4', 'demon_m5', 'demon_m6', 'demon_m7'],
  demonE: ['demon_e1'],
  demonF: ['demon_f2', 'demon_f3', 'demon_f4'],
  rogueM: ['rogue_m1', 'rogue_m2', 'rogue_m3', 'rogue_m4', 'rogue_m5', 'rogue_m6'],
  rogueOld: ['rogue_m4', 'sect_e1'],
  rogueF: ['rogue_f1', 'rogue_f2'],
  merchM: ['merchant_m1', 'merchant_m2'],
  merchF: ['merchant_f1'],
  farmer: ['farmer_m1'], farmerOld: ['farmer_m2'],
  scholar: ['scholar_m1'], scholarOld: ['scholar_m2'],
  guard: ['guard_m1', 'guard_m2'],
  mortalF: ['mortal_f1', 'mortal_f3'], mortalFMid: ['mortal_f2'], mortalFOld: ['elder_f1'],
  mortalOld: ['elder_m1'],
  childM: ['child_m1'], childF: ['mortal_f1'],
  monk: ['monk_1'], monkOld: ['monk_2'],
  seaM: ['sea_m1', 'sea_m3'], seaOld: ['sea_m2'], seaF: ['sea_f1', 'sea_f2'],
  mulanM: ['mulan_m1', 'mulan_m2'], mulanF: ['mulan_f1', 'mulan_f2'],
  jinM: ['jin_m1', 'jin_m2'], jinF: ['jin_f1', 'jin_f2'],
};
/** 各宗门的门风（弟子立绘偏向） */
const SECT_GEN: Record<string, string> = {
  jujian: 'sect_m5', qingxu: 'sect_m6', huadao: 'sect_m7', taiyi: 'sect_m6', huayi: 'sect_m7',
  guiling: 'demon_m1', tiansha: 'demon_m2', hehuan: 'demon_m3', yuling: 'demon_m5', qianhuan: 'demon_m6', yinluo: 'demon_m1', tianmo: 'demon_m4',
};
const SECT_GEN_F: Record<string, string> = { yanyue: 'sect_f2', guiling: 'demon_f2', yinluo: 'demon_f2' };

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (arr: string[], key: string, salt = '') => arr[hash(key + salt) % arr.length];

/** 修士驻颜：看上去的年纪（凡人就是真实年纪） */
function looksOld(d: NpcData) {
  if (d.faction === 'mortal' || d.realm === 0) return d.age >= 58;
  return d.role === 'elder' || (d.realm >= 3 && d.age > 200);
}

/** 给一个 NPC 选立绘：专属 → 红颜 → 通用池 */
export function npcPortrait(d: NpcData): string | undefined {
  if (d.beauty) { const b = BEAUTIES.find((x) => x.id === d.beauty); if (b) return b.portrait; }
  if (NAMED_IDS.has(d.id)) return npcArt(d.id);
  const byName = NAMED[d.name]; if (byName && (d.canon || d.orig)) return npcArt(byName);
  return genArt(genericFor(d));
}

export function genericFor(d: NpcData): string {
  const k = d.id, f = d.sex === 'f', old = looksOld(d), map = d.map ?? 'tiannan';
  const mortal = d.faction === 'mortal' || d.realm === 0;
  if (mortal) {
    if (d.age < 14) return pick(f ? P.childF : P.childM, k);
    if (f) return pick(d.age >= 58 ? P.mortalFOld : d.age >= 32 ? P.mortalFMid : P.mortalF, k);
    if (d.role === 'scholar') return pick(old ? P.scholarOld : P.scholar, k);
    if (d.role === 'guard') return pick(P.guard, k);
    if (d.role === 'merchant') return pick(P.merchM, k);
    if (d.role === 'monk') return pick(old ? P.monkOld : P.monk, k);
    if (old) return pick([...P.mortalOld, ...P.farmerOld], k);
    return pick(P.farmer, k);
  }
  if (d.role === 'monk') return pick(old ? P.monkOld : P.monk, k);
  // 地域：慕兰、乱星海、大晋的散修与商人有一半用地域装束
  const regional = (d.faction !== 'demon' && (d.faction !== 'sect' || map !== 'tiannan')) && (hash(k + 'r') & 1) === 0;   // 第三十六步：星宫 / 逆星盟 / 太一门 / 叶家的门人也有一半着地域装束
  if (d.home === 'mulan' || d.home === 'tuwu' || d.home === 'tianlan') return pick(f ? P.mulanF : P.mulanM, k);
  if (regional && map === 'luanxing') return pick(f ? P.seaF : old ? P.seaOld : P.seaM, k);
  if (regional && map === 'dajin') return pick(f ? P.jinF : P.jinM, k);
  if (d.faction === 'merchant') return pick(f ? P.merchF : P.merchM, k);
  if (d.faction === 'demon') {
    if (f) return (d.sect && SECT_GEN_F[d.sect]) || pick(P.demonF, k);
    if (old) return pick(P.demonE, k);
    const s = d.sect && SECT_GEN[d.sect]; if (s && (hash(k + 's') % 3) !== 0) return s;
    return pick(P.demonM, k);
  }
  if (d.faction === 'sect') {
    if (f) return old ? pick(P.sectFE, k) : (d.sect && SECT_GEN_F[d.sect] && (hash(k + 's') & 1) ? SECT_GEN_F[d.sect] : pick(P.sectF, k));
    if (old) return pick(P.sectE, k);
    const s = d.sect && SECT_GEN[d.sect]; if (s && (hash(k + 's') % 3) !== 0) return s;
    return pick(P.sectM, k);
  }
  // 散修 / 劫修
  if (f) return pick(P.rogueF, k);
  if (old) return pick(P.rogueOld, k);
  if (d.pers === 'ruthless' || d.pers === 'greedy') return pick(['rogue_m2', 'rogue_m6', 'rogue_m1', 'rogue_m3'], k);
  return pick(P.rogueM, k);
}

// ------------------------------------------------------------ 对话框：自动配图
/** 外貌对象 → 立绘（NPC 生成外貌时登记，对话框凭 look 找回是谁） */
const BY_LOOK = new WeakMap<Look, string>();
export function tagLook(look: Look, d: NpcData) { const p = npcPortrait(d); if (p) BY_LOOK.set(look, p); return look; }

/** 没有登记过的人（奇遇里的路人、劫修、追杀者……）按称呼与外貌猜一张 */
function guess(node: DNode): string | undefined {
  const s = `${node.speaker}${node.title ?? ''}`, L = node.look, f = L?.sex === 'f', key = node.speaker + (L?.robe ?? '') + (L?.hair ?? '');
  if (/掌柜|商队|商人|行商/.test(s)) return genArt(f ? 'merchant_f1' : pick(P.merchM, key));
  if (/劫修|赏金|追杀|杀手|匪/.test(s)) return genArt(f ? 'rogue_f1' : pick(['rogue_m2', 'rogue_m6', 'demon_m2'], key));
  if (/魔修|魔道|鬼灵|合欢|天煞/.test(s)) return genArt(f ? pick(P.demonF, key) : pick(P.demonM, key));
  if (/执法/.test(s)) return genArt(f ? 'sect_f3' : 'sect_m2');
  if (/老者|老翁|高人|前辈/.test(s)) return genArt(pick(['sect_e1', 'rogue_m4'], key));
  if (/摊主|散修/.test(s)) return genArt(f ? 'rogue_f2' : pick(['rogue_m3', 'rogue_m1', 'rogue_m5'], key));
  if (/僧|和尚|大师/.test(s)) return genArt('monk_2');
  if (!L) return undefined;   // 不是人（古迹、异宝、洞府、心念……）就不配图
  if (L.hairStyle === 'bald') return genArt('monk_1');
  if (f) return genArt(pick([...P.sectF, ...P.rogueF], key));
  if (L.beard) return genArt(pick(['sect_e1', 'sect_e2', 'rogue_m4'], key));
  return genArt(pick(['rogue_m1', 'rogue_m5', 'sect_m1', 'sect_m2', 'rogue_m3'], key));
}

const NOT_PEOPLE = new Set(['', '神识', '心念', '奇遇', '古迹', '异宝', '古修遗府', '古修遗骸', '藏宝处', '黄枫谷', '灵宠', '传音符']);
let byNameCache: { list: NpcData[]; n: number; map: Map<string, NpcData> } | null = null;

/** 对话框要显示的立绘：明确给的 → 名字对得上的 → 外貌登记过的 → 同名 NPC → 猜 */
export function portraitFor(node: DNode, npcs?: NpcData[]): string | undefined {
  if (node.portrait) return node.portrait;
  if (NOT_PEOPLE.has(node.speaker)) return undefined;
  if (node.look) { const p = BY_LOOK.get(node.look); if (p) return p; }
  const named = namedPortrait(node.speaker); if (named) return named;
  if (npcs) {
    if (!byNameCache || byNameCache.list !== npcs || byNameCache.n !== npcs.length) byNameCache = { list: npcs, n: npcs.length, map: new Map(npcs.map((d) => [d.name, d])) };
    const d = byNameCache.map.get(node.speaker); if (d) return npcPortrait(d);
  }
  return guess(node);
}
