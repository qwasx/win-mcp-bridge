// 活世界 · 内容池（门派 / 功法 / 物品 / 来路 / 缘由 / 口吻）
// 全部为纯数据 + 纯函数，供浏览器与服务端共用。
import type { BagItem, BagKind, Pers, SocialKind } from './types';
import { pick, ri, type Rnd } from './rng';

// ---------------------------------------------------------------- 门派（id 与游戏内 roster.ts 对齐）
export interface SectSeed { id: string; name: string; demon?: boolean; allies?: string[]; foes?: string[] }

export const SECT_SEEDS: SectSeed[] = [
  { id: 'huangfeng', name: '黄枫谷', allies: ['lingxu', 'qingxu'], foes: ['guiling', 'tianmo'] },
  { id: 'luoyun', name: '落云宗', allies: ['huadao'], foes: ['tiansha'] },
  { id: 'gujian', name: '古剑门', allies: ['jujian'], foes: ['yinluo'] },
  { id: 'baiqiao', name: '百巧院', allies: ['jujian'] },
  { id: 'guiling', name: '鬼灵门', demon: true, allies: ['tianmo', 'yuling'], foes: ['huangfeng', 'luoyun'] },
  { id: 'hehuan', name: '合欢宗', demon: true, allies: ['yuling'] },
  { id: 'yuling', name: '御灵宗', demon: true, foes: ['lingshou'] },
  { id: 'qianhuan', name: '千幻教', demon: true },
  { id: 'tiansha', name: '天煞门', demon: true, foes: ['luoyun'] },
  { id: 'yinluo', name: '阴罗宗', demon: true, foes: ['gujian'] },
  { id: 'tianmo', name: '天魔宗', demon: true, foes: ['huangfeng', 'qingxu'] },
  { id: 'taiyi', name: '太一门', allies: ['huayi'], foes: ['tianmo'] },
  { id: 'huayi', name: '化意门' },
  { id: 'qianzhu', name: '乾竹谷' },
  { id: 'tianlan', name: '天澜圣殿', allies: ['mulan'], foes: ['guiling'] },
  { id: 'mulan', name: '慕兰法士', allies: ['tianlan'] },
  { id: 'miaoyin', name: '妙音门', allies: ['tianxing'] },
  { id: 'tianxing', name: '天星城星宫', foes: ['leikong'] },
  { id: 'leikong', name: '逆星盟', foes: ['tianxing'] },
  { id: 'yejia', name: '叶家', allies: ['taiyi'] },
  { id: 'xinggong', name: '星宫', foes: ['nixing'] },
  { id: 'nixing', name: '逆星盟', foes: ['xinggong'] },
  { id: 'lingshou', name: '灵兽山', foes: ['yuling'] },
  { id: 'yanling', name: '燕家' },
  { id: 'caojia', name: '曹家' },
  { id: 'jiayuan', name: '嘉元城' },
  { id: 'qingniu', name: '青牛镇' },
  { id: 'kuixing', name: '魁星岛' },
  { id: 'jiyin', name: '极阴岛', demon: true, foes: ['miaoyin', 'luoyun'] },
  { id: 'kunwu', name: '昆吾山' },
];

// ---------------------------------------------------------------- 功法
export interface ArtSeed { name: string; el: string; tier: number }

export const ARTS: ArtSeed[] = [
  { name: '长春功', el: '木', tier: 1 }, { name: '青元剑诀', el: '木', tier: 3 },
  { name: '大衍诀', el: '雷', tier: 3 }, { name: '青蚨剑诀', el: '木', tier: 2 },
  { name: '玄阴经', el: '阴', tier: 3 }, { name: '血炼神功', el: '血', tier: 3 },
  { name: '御灵术', el: '兽', tier: 2 }, { name: '百巧炼器诀', el: '金', tier: 2 },
  { name: '太清凝气诀', el: '清', tier: 2 }, { name: '化意真解', el: '意', tier: 3 },
  { name: '天煞噬魂功', el: '煞', tier: 4 }, { name: '阴罗鬼功', el: '鬼', tier: 3 },
  { name: '合欢欢喜功', el: '媚', tier: 3 }, { name: '天魔化血功', el: '魔', tier: 4 },
  { name: '乾蓝冰焰诀', el: '冰', tier: 4 }, { name: '大衍神君遗篇', el: '雷', tier: 5 },
  { name: '青竹蜂云剑诀', el: '木', tier: 5 }, { name: '大庚剑阵', el: '金', tier: 5 },
  { name: '九霄真雷诀', el: '雷', tier: 4 }, { name: '紫府玄功', el: '紫', tier: 4 },
  { name: '星罗大衍术', el: '星', tier: 4 }, { name: '逆星诀', el: '星', tier: 3 },
  { name: '天澜圣法', el: '水', tier: 3 }, { name: '慕兰神功', el: '土', tier: 3 },
  { name: '妙音梵唱', el: '音', tier: 2 }, { name: '化尘诀', el: '土', tier: 2 },
  { name: '落云十三式', el: '云', tier: 2 }, { name: '古剑御真诀', el: '金', tier: 3 },
  { name: '百药炼形篇', el: '木', tier: 2 }, { name: '赤炼火功', el: '火', tier: 2 },
  { name: '玄冰诀', el: '冰', tier: 2 }, { name: '御风诀', el: '风', tier: 1 },
  { name: '浊息功', el: '浊', tier: 1 }, { name: '铁背功', el: '土', tier: 1 },
  { name: '一气长清诀', el: '清', tier: 3 }, { name: '噬金虫御使术', el: '虫', tier: 4 },
  { name: '五色孔雀翎', el: '光', tier: 4 }, { name: '洞漩金光', el: '金', tier: 6 },
  { name: '圣魔驭日诀', el: '魔', tier: 6 }, { name: '太虚剑气', el: '剑', tier: 6 },
];

export const ART_BY_TIER = (t: number) => ARTS.filter((a) => a.tier === t);

// ---------------------------------------------------------------- 物品
export interface ItemSeed { name: string; kind: BagKind; tier: number; worth: number }

export const ITEMS: ItemSeed[] = [
  { name: '回气散', kind: 'pill', tier: 1, worth: 12 }, { name: '黄龙丹', kind: 'pill', tier: 1, worth: 30 },
  { name: '筑基丹', kind: 'pill', tier: 3, worth: 4200 }, { name: '凝婴丹', kind: 'pill', tier: 5, worth: 62000 },
  { name: '紫猿果', kind: 'herb', tier: 2, worth: 220 }, { name: '紫猴花', kind: 'herb', tier: 2, worth: 260 },
  { name: '千年灵乳', kind: 'herb', tier: 4, worth: 9000 }, { name: '九曲灵参', kind: 'herb', tier: 4, worth: 15000 },
  { name: '金精芝', kind: 'herb', tier: 3, worth: 1800 }, { name: '地火芝', kind: 'herb', tier: 3, worth: 2100 },
  { name: '青竹蜂云剑', kind: 'weapon', tier: 4, worth: 26000 }, { name: '金光砖', kind: 'weapon', tier: 3, worth: 3200 },
  { name: '乌龙夺珠剪', kind: 'weapon', tier: 3, worth: 2800 }, { name: '寒月刀', kind: 'weapon', tier: 2, worth: 640 },
  { name: '赤霄剑', kind: 'weapon', tier: 2, worth: 720 }, { name: '玄铁重盾', kind: 'weapon', tier: 2, worth: 560 },
  { name: '护身符', kind: 'talisman', tier: 1, worth: 40 }, { name: '金光符', kind: 'talisman', tier: 2, worth: 180 },
  { name: '遁光符', kind: 'talisman', tier: 2, worth: 240 }, { name: '六丁天甲符', kind: 'talisman', tier: 4, worth: 7600 },
  { name: '妖兽皮', kind: 'material', tier: 1, worth: 25 }, { name: '四阶妖丹', kind: 'material', tier: 4, worth: 6400 },
  { name: '三阶妖丹', kind: 'material', tier: 3, worth: 1500 }, { name: '庚精', kind: 'material', tier: 5, worth: 48000 },
  { name: '千年铁木', kind: 'material', tier: 3, worth: 1200 }, { name: '寒铁砂', kind: 'material', tier: 2, worth: 320 },
  { name: '旧竹简', kind: 'misc', tier: 1, worth: 8 }, { name: '家书', kind: 'misc', tier: 1, worth: 2 },
  { name: '玉简（残）', kind: 'misc', tier: 2, worth: 90 }, { name: '旧酒葫芦', kind: 'misc', tier: 1, worth: 6 },
];

export function rollItem(r: Rnd, tierBias = 1, src = '', about?: string): BagItem {
  const pool = ITEMS.filter((i) => Math.abs(i.tier - tierBias) <= 1.5);
  const s = pick(r, pool.length ? pool : ITEMS);
  return {
    id: 'i' + Math.floor(r() * 1e9).toString(36),
    name: s.name, kind: s.kind, tier: s.tier,
    count: s.kind === 'herb' || s.kind === 'material' || s.kind === 'pill' ? ri(r, 1, 3) : 1,
    src, about, worth: Math.round(s.worth * (0.8 + r() * 0.5)), day: 0,
  };
}

export const BAG_KIND_NAME: Record<BagKind, string> = {
  art: '功法', pill: '丹药', herb: '灵草', weapon: '法器', talisman: '符箓', material: '材料', misc: '杂物', stone: '灵石',
};

// ---------------------------------------------------------------- 来路（储物袋里每件东西都有出处）
export const SOURCES = {
  gather: (place: string, herb: string) => `${place}采的${herb}`,
  hunt: (beast: string) => `斩杀${beast}所得`,
  buy: (town: string) => `${town}坊市购得`,
  sect: (sect: string) => `${sect}岁供`,
  gift: (who: string) => `${who}所赠`,
  loot: (who: string) => `从${who}身上搜出`,
  craft: () => '自家炼制',
  inherit: (who: string) => `${who}的遗物`,
  stolen: (who: string) => `趁夜从${who}那儿顺来的`,
  teach: (who: string) => `${who}传下的`,
};

// ---------------------------------------------------------------- 性格 → 行为权重与口吻
export const PERS_NAME: Record<Pers, string> = {
  righteous: '正直', greedy: '贪婪', cautious: '谨慎', arrogant: '傲慢', kind: '温和', ruthless: '狠辣', aloof: '淡泊',
};

export const PERS_TRAITS: Record<Pers, string[]> = {
  righteous: ['讲信义', '护短', '见不得欺负人'],
  greedy: ['爱财如命', '斤斤计较', '见宝眼亮'],
  cautious: ['行事小心', '先探底细', '不轻信人'],
  arrogant: ['眼高于顶', '受不得怠慢', '爱出风头'],
  kind: ['心软', '爱管闲事', '重乡邻'],
  ruthless: ['睚眦必报', '下手狠', '不留活口'],
  aloof: ['懒得应酬', '一心求道', '话少'],
};

export const AGENDA_WHY: Record<string, string[]> = {
  train: ['卡在瓶颈，想闭关冲一层', '新得一门功法，要理清脉络', '与人约了斗法，得加紧练', '灵气正盛，不可虚度'],
  gather: ['手里的灵草快没了', '丹方上差一味主药', '听说{place}出了好东西', '想给家里炼几炉养气丹'],
  hunt: ['妖兽伤了好几个同门，得去清一清', '缺一颗妖丹换灵石', '宗门发下猎令', '那畜生咬死了我家的灵犬'],
  trade: ['袋里囤的货该出手了', '要给家里添置些用度', '坊市新到了一批货，去看看', '想换一件趁手的法器'],
  errand: ['替门里送封信', '长老吩咐的事不能耽搁', '答应给人捎东西'],
  seclude: ['寿元无多，拼一次闭关', '受了内伤，须静养', '参悟一处瓶颈'],
  home: ['家里有事', '孩子还小，得回去看看', '该祭祖了'],
  avenge: ['这笔账不能不讨', '血仇未报，寝食难安', '他在外头说风凉话，我忍够了'],
  sect: ['宗门大比将近', '门里召议事', '要领本月的岁供'],
  social: ['许久没见老友了', '听说有人在酒楼说书', '去打听打听风声'],
  court: ['年纪不小了，家里催着', '对方人不错，想再走走', '两家早有联姻之议'],
  visit: ['受了人之托去探望', '想看看故人近况'],
  teach: ['弟子该考校功课了', '答应把这门功法传下去'],
  guard: ['这阵子风声紧，得守住山门', '商队请了人手护送'],
};

export const SOCIAL_LINES: Record<SocialKind, string[]> = {
  friend: ['「好久不见，进来喝一杯。」', '「你气色比上回好多了。」', '「路上小心，近来不太平。」'],
  sworn: ['「你我兄弟，何须客套。」', '「有事言语一声，我必到。」'],
  mentor: ['「这一层火候还差三分。」', '「别急着催气，先养心。」'],
  disciple: ['「师父，弟子记下了。」', '「弟子今日有寸进。」'],
  lover: ['「我给你留了热汤。」', '「早些回来。」'],
  rival: ['「又见面了。」', '「这次未必是你赢。」'],
  trade: ['「这价再让一步？」', '「货是好货，就是贵了。」'],
};

export const GRUDGE_REASONS = {
  rob: ['他劫了我的货物', '他抢了我采了三十年的紫猴花', '他在坊市讹走了我一件法器'],
  kill: ['他杀了我的同门', '他当街杀了我家的人', '我师兄死在他手上'],
  insult: ['他当众辱我门派', '他看不起人，骂我是散修野路子'],
  betray: ['说好平分，他独吞了', '他把我卖了换赏钱'],
  duel: ['斗法他下死手，我躺了三个月', '他废了我一条经脉'],
  envy: ['他得的宝物本该有我一份'],
  family: ['两家早有旧怨', '祖上结下的血仇'],
};

export const CONTACT_TONE_LINE: Record<string, string[]> = {
  friendly: ['「道友别来无恙？我有一事想请你帮个忙。」', '「正好路过，特地来谢你。」'],
  trade: ['「听说你袋里有件好东西，我出得起价。」', '「有笔买卖，只有你做得。」'],
  sect: ['「门里有事，点名要你去。」', '「长老想见你一面。」'],
  threat: ['「你手里那件东西，来路我查清楚了。」', '「你最好把话说清楚。」'],
  grief: ['「我家的人死在你手里，总得有个说法。」', '「我要的只是真相。」'],
  vengeance: ['「这笔账，今日该结了。」', '「我等这一天等了很久。」'],
  romance: ['「我给你带了些东西。」', '「想过来看看你。」'],
  curiosity: ['「有人在你身上押了注，我想看看是输是赢。」', '「你最近的名声传得有点快。」'],
};

export const GAIN_TEXT = {
  favor: '事成必有人念你的好，名声也能涨一涨',
  stones: '能拿到一笔灵石谢礼',
  item: '他会把袋里那件东西让给你',
  art: '愿传你半卷功法',
  sect: '宗门记你一功，岁供涨一截',
  peace: '少一个仇家，夜里睡得安稳些',
};

export const COST_TEXT = {
  favor: '拒了就是撕破脸，往后坊市里少个照应',
  grudge: '他会记恨，且会找人说道你',
  hunt: '他被逼急了会动手，或者请人代劳',
  sect: '宗门那边要记你一笔',
  family: '两家从此结死仇',
};

// ---------------------------------------------------------------- 名字
export const SURNAMES = '韩李王张刘陈杨赵黄周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许冯邓曹彭萧田董潘袁蔡蒋余叶程苏魏吕丁沈任姚卢钟陆白秦尹孟温柳';
export const MALE = ['云', '风', '清', '玄', '明', '远', '松', '鹤', '天', '道', '一', '真', '平', '岳', '霄', '尘', '泽', '峰', '石', '江', '海', '仁', '义', '飞', '鸿', '啸', '铁', '虎', '青', '墨', '寒', '烈', '浩', '谦', '恒', '长风', '无极', '不凡', '万里'];
export const FEMALE = ['婉', '月', '雪', '灵', '儿', '秀', '芸', '霜', '凝', '烟', '琴', '瑶', '思', '玉', '蓉', '菲', '素', '青', '璇', '若', '紫', '晴', '湘', '莲', '秋水', '三娘'];
export const COMPOUND = ['欧阳', '慕容', '上官', '司马'];

export function makeName(r: Rnd, sex: 'm' | 'f'): string {
  let s: string;
  if (r() < 0.07) s = pick(r, COMPOUND);
  else s = SURNAMES[Math.floor(r() * SURNAMES.length)];
  const pool = sex === 'f' ? FEMALE : MALE;
  const n = r() < 0.5 ? pick(r, pool) + pick(r, pool) : pick(r, pool);
  return s + n;
}

export const FAMILY_CREEDS = ['耕读传家', '以剑立家', '和气生财', '忠义为先', '药香济世', '宁折不弯', '隐忍待时', '不惹事也不怕事'];
export const FAMILY_NAMES = ['李家', '王家', '张家', '陈家', '赵家', '周家', '吴家', '郑家', '孙家', '马家', '胡家', '郭家', '林家', '何家', '高家', '罗家'];

export const PLACES = [
  { id: 'qingniu', name: '青牛镇' }, { id: 'jiayuan', name: '嘉元城' }, { id: 'yuejing', name: '越京' },
  { id: 'caoyuan', name: '天澜草原' }, { id: 'luanxing', name: '乱星海' }, { id: 'kunwu', name: '昆吾山' },
  { id: 'yunmeng', name: '云梦山脉' }, { id: 'taiyue', name: '太岳山脉' }, { id: 'tianxing', name: '天星城' },
  { id: 'jinjing', name: '晋京' }, { id: 'kuixing', name: '魁星岛' }, { id: 'shuozhou', name: '朔州城' },
];

export const placeName = (id?: string) => PLACES.find((p) => p.id === id)?.name ?? '荒野';
