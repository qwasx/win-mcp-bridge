// 第四步：人界众生（NPC AI）
// - 每个修士都是一个“人”：姓名、境界、门派、性格、目标、钱财、对你的好感与仇怨
// - 神识外：粗略模拟（赶路、闭关、突破、衰老、坐化、死于险地）；神识附近：完整行为（走/飞/打坐/采药/斗法/劫道/逃命）
// - 互相以神识感知：比你强又贪婪的会来劫道；比你弱的见你恶名会逃；你可以交谈、交易、切磋、赠礼、请教、出手
import type { Game } from './game';
import { CharState, drawCharacter, drawSwordUnderFeet, randomLook, Look, NpcRole } from '../gfx/character';
import { LOCATIONS, LOC_BY_ID, WORLD_SCALE, LocDef } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import { mulberry32 } from '../core/rng';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import * as C from './cultivation';
import { ITEM_LIST, itemDef } from '../data/items';
import type { DNode, DOpt, ShopStock } from './modal';
import { BEAUTY_BY_ID, BEAUTIES, beautyLook } from '../data/beauties';

type G = CanvasRenderingContext2D;
export type Pers = 'righteous' | 'greedy' | 'cautious' | 'arrogant' | 'kind' | 'ruthless' | 'aloof';
export const PERS_NAME: Record<Pers, string> = { righteous: '正直', greedy: '贪婪', cautious: '谨慎', arrogant: '傲慢', kind: '温和', ruthless: '狠辣', aloof: '淡泊' };
export type Faction = 'sect' | 'rogue' | 'demon' | 'mortal' | 'merchant';
type Goal = 'travel' | 'stay' | 'seclude' | 'hunt' | 'gather';

export interface NpcData {
  id: string; name: string; sex: 'm' | 'f'; role: NpcRole;
  realm: number; stage: number; faction: Faction; sect?: string; home: string;
  pers: Pers; favor: number; grudge: number; met: boolean; alive: boolean;
  age: number; life: number; x: number; y: number; tx: number; ty: number;
  goal: Goal; until: number; wealth: number; seed: number;
  canon?: boolean; title?: string; beauty?: string; robe?: string; stay?: boolean;
  taught?: boolean; lastTalk?: number; deathNote?: string; spar?: number; hidden?: boolean;
}

interface Active {
  d: NpcData; st: CharState; look: Look;
  act: 'walk' | 'idle' | 'sit' | 'gather' | 'fly' | 'duel' | 'flee' | 'approach' | 'follow';
  t: number; wait: number; enemy?: Enemy; noticed: number;
  duel?: { foe: Active; hp: number; cd: number; t: number };
  hp: number; bubble?: { text: string; t: number }; bolts: { x: number; y: number; x2: number; y2: number; t: number; col: string }[];
  ally?: Enemy | null; allyCd: number;
}

const SECT_ROBE: Record<string, string> = {
  huangfeng: '#c9a24a', yanyue: '#e8e4ee', lingshou: '#6a7a4a', qingxu: '#7a9ab0', huadao: '#5a5a62', tianque: '#8a6a4a', jujian: '#4a5a6a',
  luoyun: '#4f8a8a', gujian: '#6a8aa0', baiqiao: '#8a7a5a', guiling: '#2a2a34', hehuan: '#c87a96', yuling: '#4a3a5a', qianhuan: '#7a4a8a',
  tiansha: '#3a1a1a', yinluo: '#2a3a2a', tianmo: '#5a1418', taiyi: '#e0dccc', huayi: '#6a7a9a', qianzhu: '#3a6a3a', tianlan: '#d8c890', miaoyin: '#b8a0d0', qixuan: '#5a6a5a',
};
const DEMON_SECTS = new Set(['guiling', 'hehuan', 'yuling', 'qianhuan', 'tiansha', 'yinluo', 'tianmo']);
const SURN = '韩李王张刘陈杨赵黄周吴徐孙马朱胡林郭何高罗郑梁谢宋唐许冯邓曹彭曾萧田董潘袁蔡蒋余叶程苏魏吕丁沈任姚卢钟陆白秦尹孟温柳欧阳慕容上官司马';
const MN = ['云', '风', '清', '玄', '明', '远', '松', '鹤', '天', '道', '一', '真', '平', '岳', '霄', '尘', '泽', '峰', '石', '江', '海', '仁', '义', '飞', '鸿', '啸', '铁', '虎', '青', '墨', '寒', '冥', '烈', '浩', '谦', '恒'];
const FN = ['婉', '月', '雪', '灵', '儿', '秀', '芸', '霜', '凝', '烟', '琴', '瑶', '思', '玉', '蓉', '菲', '素', '青', '璇', '若', '紫', '晴', '湘', '莲'];
const COMPOUND = ['欧阳', '慕容', '上官', '司马'];

function makeName(rnd: () => number, sex: 'm' | 'f') {
  let s: string;
  const r = rnd();
  if (r < 0.06) s = COMPOUND[Math.floor(rnd() * COMPOUND.length)];
  else { const plain = SURN.replace(/欧阳|慕容|上官|司马/g, ''); s = plain[Math.floor(rnd() * plain.length)]; }
  const pool = sex === 'f' ? FN : MN;
  const n = rnd() < 0.55 ? pool[Math.floor(rnd() * pool.length)] + pool[Math.floor(rnd() * pool.length)] : pool[Math.floor(rnd() * pool.length)];
  return s + n;
}
const lv = (r: number, s: number) => r * 13 + s;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 原著人物（自由发展：性格还原，命运由你改写）
interface CanonDef { id: string; name: string; sex: 'm' | 'f'; home: string; realm: number; stage: number; pers: Pers; faction: Faction; title: string; role: NpcRole; robe?: string; stay?: boolean; age: number }
const CANON: CanonDef[] = [
  { id: 'modaifu', name: '墨大夫', sex: 'm', home: 'qixuan', realm: 1, stage: 4, pers: 'ruthless', faction: 'rogue', title: '七玄门神手谷', role: 'elder', robe: '#4a4a44', stay: true, age: 62 },
  { id: 'lifeiyu', name: '厉飞雨', sex: 'm', home: 'qixuan', realm: 0, stage: 0, pers: 'righteous', faction: 'mortal', title: '七玄门弟子', role: 'guard', robe: '#3a4a5a', age: 18 },
  { id: 'lihuayuan', name: '李化元', sex: 'm', home: 'huangfeng', realm: 3, stage: 0, pers: 'righteous', faction: 'sect', title: '黄枫谷结丹长老', role: 'cultivator', robe: '#b08a3a', stay: true, age: 260 },
  { id: 'linghu', name: '令狐老祖', sex: 'm', home: 'huangfeng', realm: 4, stage: 0, pers: 'aloof', faction: 'sect', title: '黄枫谷老祖', role: 'elder', robe: '#c9a24a', stay: true, age: 680 },
  { id: 'leiwanhe', name: '雷万鹤', sex: 'm', home: 'huangfeng', realm: 3, stage: 1, pers: 'righteous', faction: 'sect', title: '黄枫谷长老', role: 'cultivator', robe: '#a88a4a', age: 300 },
  { id: 'hongfu', name: '红拂', sex: 'f', home: 'huangfeng', realm: 3, stage: 0, pers: 'arrogant', faction: 'sect', title: '黄枫谷长老', role: 'female', robe: '#a0303a', age: 240 },
  { id: 'zhongweiniang', name: '钟卫娘', sex: 'f', home: 'huangfeng', realm: 2, stage: 0, pers: 'kind', faction: 'sect', title: '黄枫谷弟子', role: 'female', robe: '#c9a24a', age: 40 },
  { id: 'wangchan', name: '王蝉', sex: 'm', home: 'guiling', realm: 2, stage: 2, pers: 'ruthless', faction: 'demon', title: '鬼灵门少主', role: 'cultivator', robe: '#22222c', age: 45 },
  { id: 'yanruyan', name: '燕如嫣', sex: 'f', home: 'yanling', realm: 2, stage: 0, pers: 'cautious', faction: 'sect', title: '燕家女修', role: 'female', robe: '#5a7aa8', age: 30 },
  { id: 'xiangzhili', name: '向之礼', sex: 'm', home: 'luoyun', realm: 4, stage: 1, pers: 'aloof', faction: 'rogue', title: '散修元婴', role: 'elder', robe: '#6a6a60', age: 800 },
  { id: 'jiyin', name: '极阴老祖', sex: 'm', home: 'jiyin', realm: 4, stage: 1, pers: 'ruthless', faction: 'demon', title: '极阴岛岛主', role: 'elder', robe: '#1a1a24', stay: true, age: 900 },
  { id: 'xuangu', name: '玄骨上人', sex: 'm', home: 'jiyin', realm: 3, stage: 2, pers: 'ruthless', faction: 'demon', title: '附身魔头', role: 'cultivator', robe: '#3a2a2a', age: 1200 },
  { id: 'manhuzi', name: '蛮胡子', sex: 'm', home: 'kuixing', realm: 4, stage: 0, pers: 'arrogant', faction: 'rogue', title: '散修老怪', role: 'guard', robe: '#6a4a2a', age: 700 },
  { id: 'wentianren', name: '温天仁', sex: 'm', home: 'tianxing', realm: 3, stage: 2, pers: 'arrogant', faction: 'demon', title: '六道极圣之子', role: 'cultivator', robe: '#4a1a2a', age: 320 },
  { id: 'qianlaomo', name: '乾老魔', sex: 'm', home: 'xiaohuan', realm: 4, stage: 1, pers: 'ruthless', faction: 'demon', title: '魔道元婴', role: 'elder', robe: '#2a2030', age: 1000 },
  { id: 'tianlan_saint', name: '天澜圣女', sex: 'f', home: 'tianlan', realm: 3, stage: 0, pers: 'cautious', faction: 'sect', title: '天澜圣殿', role: 'female', robe: '#e8dcb0', stay: true, age: 200 },
  { id: 'mulan_shi', name: '慕兰神师', sex: 'm', home: 'mulan', realm: 3, stage: 1, pers: 'arrogant', faction: 'sect', title: '慕兰法士', role: 'monk', robe: '#8a4a2a', age: 350 },
  { id: 'wuchou', name: '吴丑', sex: 'm', home: 'qingniu', realm: 0, stage: 0, pers: 'kind', faction: 'mortal', title: '青牛镇', role: 'farmer', age: 50 },
];

// 原著人物台词（自由发展，只取其性格）
const CANON_LINES: Record<string, string[]> = {
  modaifu: ['（墨大夫捻须打量你）根骨……嗯，倒也不算太差。最近练功可有异样？', '老夫这里有几味好药，对你修炼大有裨益。何时来神手谷，老夫替你看看？', '少年人，修仙之路凶险，凡事要多留个心眼。'],
  lifeiyu: ['韩兄弟！许久不见，你这身气度……莫不是有了奇遇？', '我这辈子只想多活几年，护着身边的人。你若有难处，尽管开口。', '江湖上的事我还应付得来，仙家的事，我就帮不上了。'],
  lihuayuan: ['（李化元负手而立）修仙一途，靠的是心性。你若肯吃苦，我门下也不缺你一个位置。', '黄枫谷七派同气连枝，魔道近来蠢蠢欲动，你也当早做准备。', '你身上灵气虽杂，却凝而不散，倒是有几分门道。'],
  linghu: ['（老者眼皮也未抬）……嗯。', '元婴之路，非大毅力大机缘不可成。年轻人，去吧。'],
  leiwanhe: ['小辈，丹道一途，火候最难。', '血色禁地每隔几年开启一次，那里的灵药是筑基丹主材，你可有胆量一去？'],
  hongfu: ['哼，又一个想走捷径的？', '本座的弟子，可不是谁都能招惹的。'],
  zhongweiniang: ['师兄好。谷中最近新来的弟子可多了。', '听说坊市新到了一批符箓，便宜得很。'],
  wangchan: ['（王蝉阴恻恻一笑）好浓的灵气……道友身上有好东西啊。', '鬼灵门办事，闲人退避。', '燕家的女人，迟早是我的。'],
  yanruyan: ['（燕如嫣微微颔首，神色淡淡）道友有礼。', '燕家堡近来不太平，道友若无事，还是早些离开吧。'],
  xiangzhili: ['哈哈，有趣有趣，又遇上一个小家伙。', '天南这地方，元婴老怪也不过是井底之蛙罢了。老夫打算去大晋看看。'],
  jiyin: ['（阴冷的神识扫过你周身）结丹都不到，也敢在极阴岛乱逛？', '本祖师心情好，滚吧。'],
  xuangu: ['（这具身体里似乎住着另一个灵魂）……道友，你我做个交易如何？'],
  manhuzi: ['哈哈哈！老夫平生最爱好酒和一场好架！', '小子，看你顺眼，这块灵石赏你了。'],
  wentianren: ['（温天仁眼神轻蔑）六道极圣之名，你可听过？', '虚天殿中的宝物，我温天仁要定了。'],
  qianlaomo: ['……滚。'],
  tianlan_saint: ['草原上的修行之道，与天南大不相同。', '外乡修士，请守圣殿的规矩。'],
  mulan_shi: ['天南的修士，又来草原做什么？', '我慕兰法士，从不惧天南七派。'],
  wuchou: ['小立子回来啦？你爹娘可想你了。', '今年收成不错，就是山里的狼又多了。'],
};

const GREET: Record<Pers, string[]> = {
  righteous: ['道友请了。近来山中多有妖兽出没，还请小心。', '在下行走四方，只求问心无愧。道友可是同道中人？', '路见不平，自当拔刀。道友若遇魔修作恶，可唤我一声。'],
  greedy: ['（对方目光在你储物袋上停了片刻）道友……从何处来啊？', '嘿嘿，灵石这东西，谁会嫌多呢？', '道友若有闲置的宝物，在下愿出高价——当然，也不是太高。'],
  cautious: ['（对方暗自运转护体灵光，与你保持着距离）道友有何贵干？', '萍水相逢，还请道友见谅，在下不便多言。', '这一带不太平，在下劝道友早些赶路。'],
  arrogant: ['哼，区区{realm}，也配与我说话？', '让开，莫要挡路。', '本座的时间宝贵得很，有话快说。'],
  kind: ['道友面善得很，可是初到此地？', '出门在外，互相照应总是好的。', '若是缺些疗伤丹药，我这里倒还有几颗。'],
  ruthless: ['（一股冰冷的杀意一闪而逝）……有事？', '修仙界弱肉强食，道友可要好好活着。', '你最好别多管闲事。'],
  aloof: ['（对方睁眼看了你一眼，又阖上了）', '大道无情，你我不过是匆匆过客。', '修行在己，何须多言。'],
};
const MORTAL_GREET = ['仙、仙师！小人有礼了。', '这位公子，要不要买点干粮？', '听说山那边又有仙人斗法，好吓人哩。', '今年的雨水足，庄稼长得好。', '仙师可是要往城里去？沿着大路一直走就是。'];

export class NpcWorld {
  game: Game;
  list: NpcData[] = [];
  byId = new Map<string, NpcData>();
  active = new Map<string, Active>();
  private simT = 0; private lastDay = -1; private noticeT = 0; private duelT = 4;
  focus: Active | null = null;   // 最近可交谈者

  constructor(game: Game) { this.game = game; }

  // ------------------------------------------------------------ 生成
  newWorld(seed = 20241015) {
    const rnd = mulberry32(seed);
    this.list = []; this.active.clear();
    const at = (loc: LocDef, spread = 600) => ({ x: loc.x * WORLD_SCALE + (rnd() - 0.5) * spread * 2, y: loc.y * WORLD_SCALE + (rnd() - 0.5) * spread * 1.4 });
    for (const c of CANON) {
      const loc = LOC_BY_ID.get(c.home); if (!loc) continue;
      const p = at(loc, 420);
      this.list.push({ id: c.id, name: c.name, sex: c.sex, role: c.role, realm: c.realm, stage: c.stage, faction: c.faction, sect: c.faction === 'sect' || c.faction === 'demon' ? c.home : undefined, home: c.home, pers: c.pers, favor: c.id === 'lifeiyu' || c.id === 'wuchou' ? 40 : 0, grudge: 0, met: false, alive: true, age: c.age, life: REALMS[c.realm].life * 1.1, x: p.x, y: p.y, tx: p.x, ty: p.y, goal: 'stay', until: 0, wealth: 30 + c.realm * c.realm * 400, seed: Math.floor(rnd() * 1e9), canon: true, title: c.title, robe: c.robe, stay: c.stay });
    }
    for (const b of BEAUTIES) {
      const loc = LOC_BY_ID.get(b.home); if (!loc) continue;
      const p = at(loc, 360);
      this.list.push({ id: 'b_' + b.id, name: b.name, sex: 'f', role: 'female', realm: b.realm, stage: b.stage, faction: b.faction, sect: b.faction === 'sect' ? b.home : undefined, home: b.home, pers: b.pers, favor: 0, grudge: 0, met: false, alive: true, age: b.age, life: REALMS[Math.max(1, b.realm)].life * 1.2, x: p.x, y: p.y, tx: p.x, ty: p.y, goal: 'stay', until: 0, wealth: 200 + b.realm * 800, seed: Math.floor(rnd() * 1e9), canon: true, title: b.title, beauty: b.id, stay: true });
    }
    // 普通修士与凡人
    const homes = LOCATIONS.filter((l) => l.type !== 'danger' && l.type !== 'secret');
    const N = 420;
    for (let i = 0; i < N; i++) this.list.push(this.spawnRandom(rnd, homes[Math.floor(rnd() * homes.length)], 'n' + i));
    this.reindex();
  }
  private spawnRandom(rnd: () => number, loc: LocDef, id: string): NpcData {
    const isSect = loc.type === 'sect', demon = DEMON_SECTS.has(loc.id);
    let faction: Faction = isSect ? (demon ? 'demon' : 'sect') : loc.type === 'city' ? (rnd() < 0.3 ? 'merchant' : rnd() < 0.6 ? 'rogue' : 'mortal') : loc.type === 'isle' ? (rnd() < 0.7 ? 'rogue' : 'merchant') : (rnd() < 0.7 ? 'mortal' : 'rogue');
    if (!isSect && rnd() < 0.06) faction = 'demon';
    const sex: 'm' | 'f' = rnd() < (faction === 'mortal' ? 0.4 : 0.32) ? 'f' : 'm';
    const north = loc.y < 260 || loc.x > 650;
    let realm = 0, stage = 0;
    if (faction !== 'mortal') {
      const r = rnd();
      realm = r < 0.62 ? 1 : r < 0.9 ? 2 : r < 0.985 ? 3 : 4;
      if (north && realm < 4 && rnd() < 0.35) realm++;
      stage = Math.floor(rnd() * REALMS[realm].stages.length);
    }
    const P: Pers[] = faction === 'demon' ? ['ruthless', 'greedy', 'arrogant', 'cautious'] : faction === 'merchant' ? ['greedy', 'kind', 'cautious'] : faction === 'mortal' ? ['kind', 'cautious', 'righteous'] : ['righteous', 'greedy', 'cautious', 'arrogant', 'kind', 'ruthless', 'aloof'];
    const pers = P[Math.floor(rnd() * P.length)];
    const role: NpcRole = faction === 'mortal' ? (sex === 'f' ? 'female' : (['farmer', 'farmer', 'merchant', 'scholar', 'guard'] as NpcRole[])[Math.floor(rnd() * 5)]) : sex === 'f' ? 'female' : faction === 'merchant' ? 'merchant' : realm >= 3 && rnd() < 0.5 ? 'elder' : rnd() < 0.1 ? 'monk' : 'cultivator';
    const x = loc.x * WORLD_SCALE + (rnd() - 0.5) * 1400, y = loc.y * WORLD_SCALE + (rnd() - 0.5) * 1000;
    const age = faction === 'mortal' ? 14 + rnd() * 50 : 18 + rnd() * (REALMS[realm].life * 0.6);
    return {
      id, name: makeName(rnd, sex), sex, role, realm, stage, faction, sect: isSect ? loc.id : undefined, home: loc.id, pers,
      favor: 0, grudge: 0, met: false, alive: true, age, life: faction === 'mortal' ? 60 + rnd() * 25 : REALMS[realm].life * (0.85 + rnd() * 0.3),
      x, y, tx: x, ty: y, goal: 'stay', until: 0, wealth: Math.round((faction === 'mortal' ? 2 : 20) * Math.pow(4, realm) * (0.5 + rnd()) * (faction === 'merchant' ? 3 : 1)),
      seed: Math.floor(rnd() * 1e9), robe: isSect ? SECT_ROBE[loc.id] : undefined,
    };
  }
  private reindex() { this.byId = new Map(this.list.map((n) => [n.id, n])); }

  toSave() { return this.list.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y), tx: Math.round(n.tx), ty: Math.round(n.ty), age: +n.age.toFixed(2) })); }
  fromSave(a: NpcData[] | undefined, wk = 1) {
    this.active.clear();
    if (!a || !a.length) { this.newWorld(); return; }
    this.list = a.map((n) => ({ ...n, x: n.x * wk, y: n.y * wk, tx: n.tx * wk, ty: n.ty * wk }));
    // 新版本加入的原著人物 / 红颜补齐
    const tmp = new NpcWorld(this.game); tmp.newWorld();
    for (const n of tmp.list) if (n.canon && !this.list.some((m) => m.id === n.id)) this.list.push(n);
    this.reindex();
  }

  // ------------------------------------------------------------ 工具
  look(d: NpcData): Look {
    if (d.beauty) return beautyLook(d.beauty);
    let s = d.seed;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const L = randomLook(rnd, d.role);
    if (d.robe) { L.robe = d.robe; }
    if (d.faction === 'demon' && !d.robe) L.robe = ['#3a1418', '#22222c', '#2a1a2a'][d.seed % 3];
    if (d.realm >= 3 && d.age > 200 && d.role !== 'female') { L.hair = '#d8d4cc'; L.beard = d.role === 'elder' ? '#e4e0d8' : L.beard; }
    return L;
  }
  power(d: NpcData) { return lv(d.realm, d.stage); }
  playerLv() { const h = this.game.hero; return lv(h.realm, h.stage); }
  realmText(d: NpcData) { return d.realm === 0 ? '凡人' : realmName(d.realm, d.stage); }
  senseOf(d: NpcData) { const s = REALMS[d.realm].sense[Math.min(d.stage, REALMS[d.realm].sense.length - 1)] ?? 0; return s <= 0 ? 300 : 450 + 55 * Math.sqrt(s); }
  hostileTo(d: NpcData) {
    const rep = this.game.ws.rep;
    if (d.grudge > 0) return true;
    if (d.faction === 'demon' && (d.pers === 'ruthless' || d.pers === 'greedy')) return true;
    if ((d.pers === 'greedy' || d.pers === 'ruthless') && d.faction === 'rogue') return true;
    if (d.pers === 'righteous' && rep < -40) return true;
    return false;
  }
  private pickTarget(d: NpcData, rnd = Math.random) {
    if (d.stay || d.beauty) { const h = LOC_BY_ID.get(d.home)!; d.tx = h.x * WORLD_SCALE + (rnd() - 0.5) * 900; d.ty = h.y * WORLD_SCALE + (rnd() - 0.5) * 600 + 200; d.goal = 'stay'; return; }
    const r = rnd();
    const cur = { x: d.x / WORLD_SCALE, y: d.y / WORLD_SCALE };
    if (r < 0.35) { const h = LOC_BY_ID.get(d.home)!; d.tx = h.x * WORLD_SCALE + (rnd() - 0.5) * 1200; d.ty = h.y * WORLD_SCALE + (rnd() - 0.5) * 900; d.goal = 'stay'; return; }
    const far = rnd() < 0.12;
    const cands = LOCATIONS.filter((l) => { const dd = Math.hypot(l.x - cur.x, l.y - cur.y); return far ? dd < 260 : dd < 70 && dd > 4; }).filter((l) => d.faction === 'mortal' ? l.type === 'town' || l.type === 'city' : true);
    const l = cands.length ? cands[Math.floor(rnd() * cands.length)] : LOC_BY_ID.get(d.home)!;
    d.tx = l.x * WORLD_SCALE + (rnd() - 0.5) * 1000; d.ty = l.y * WORLD_SCALE + (rnd() - 0.5) * 700;
    d.goal = l.type === 'danger' ? 'hunt' : l.type === 'secret' ? 'gather' : 'travel';
  }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game;
    if (g.paused) return;
    // 日结算
    const day = Math.floor(g.day);
    if (this.lastDay < 0) this.lastDay = day;
    if (day > this.lastDay) { this.daily(day - this.lastDay); this.lastDay = day; }
    // 神识外粗模拟（每 0.5 秒）
    this.simT -= dt;
    if (this.simT <= 0) { this.simT = 0.5; this.coarse(0.5); this.refreshActive(); }
    // 活跃者完整行为
    const p = g.player;
    this.focus = null; let best = 190;
    for (const a of this.active.values()) {
      this.behave(a, dt);
      const dd = Math.hypot(a.st.x - p.x, a.st.y - p.y);
      if (!a.enemy && a.d.alive && dd < best && g.life.vis({ x: a.st.x, y: a.st.y }) > 0.5) { best = dd; this.focus = a; }
    }
    this.noticeT -= dt;
    if (this.noticeT <= 0) { this.noticeT = 0.7; this.senseCheck(); }
    this.duelT -= dt;
    if (this.duelT <= 0) { this.duelT = 3 + Math.random() * 4; this.maybeDuel(); }
  }

  /** 光阴流逝（含闭关）：境界增长、衰老、坐化、补员 */
  daily(days: number) {
    const g = this.game;
    const rnd = Math.random;
    for (const d of this.list) {
      if (!d.alive) continue;
      d.age += days / 360;
      if (d.realm > 0) {
        const R = REALMS[d.realm];
        const need = (R.expDays[Math.min(d.stage, R.expDays.length - 1)] ?? 500) * 2.4;
        if (rnd() < 1 - Math.pow(1 - 1 / need, days)) {
          if (d.stage < R.stages.length - 1) d.stage++;
          else if (d.realm < 5 && rnd() < [0, 0.4, 0.22, 0.12, 0.05][d.realm]) {
            d.realm++; d.stage = 0; d.life = REALMS[d.realm].life * (0.9 + rnd() * 0.2);
            if (d.met || d.canon) g.news(`传闻${d.name}已突破至${REALMS[d.realm].name}期！`, d.canon ? 'canon' : 'rumor');
          }
        }
      }
      if (d.goal === 'hunt' && !this.active.has(d.id) && rnd() < 1 - Math.pow(1 - 0.0012 * Math.max(1, (LOC_BY_ID.get(d.home)?.danger ?? 1)), days)) this.die(d, '死于妖兽之口');
      if (d.age > d.life) this.die(d, '寿元耗尽，坐化');
      if (days > 20 && !this.active.has(d.id) && !d.stay) { d.x = d.tx; d.y = d.ty; this.pickTarget(d); }
    }
    // 补员：新入道的修士
    const alive = this.list.filter((n) => n.alive && !n.canon).length;
    if (alive < 400) {
      const homes = LOCATIONS.filter((l) => l.type !== 'danger' && l.type !== 'secret');
      const rr = mulberry32((g.day * 7919) | 0);
      for (let i = alive; i < 400 && i < alive + Math.max(1, Math.round(days / 10)); i++) {
        const n = this.spawnRandom(rr, homes[Math.floor(rr() * homes.length)], 'm' + Math.floor(g.day) + '_' + i);
        if (n.faction !== 'mortal') { n.realm = 1; n.stage = 0; }
        n.age = 16 + rr() * 6;
        this.list.push(n); this.byId.set(n.id, n);
      }
    }
    // 清理很久以前的死者（保留原著人物与相识者）
    if (this.list.length > 520) { this.list = this.list.filter((n) => n.alive || n.canon || n.met); this.reindex(); }
  }
  die(d: NpcData, why: string) {
    if (!d.alive) return;
    d.alive = false; d.deathNote = why;
    const a = this.active.get(d.id);
    if (a) this.active.delete(d.id);
    if (d.met && (d.favor > 30 || d.canon)) this.game.news(`噩耗：${d.name}${why}。`, 'personal');
  }

  private coarse(dt: number) {
    for (const d of this.list) {
      if (!d.alive || this.active.has(d.id)) continue;
      const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
      if (dd < 60) {
        if (d.until <= this.game.day) {
          if (d.goal !== 'stay' || Math.random() < 0.02) { d.until = this.game.day + (d.stay ? 2 : 5 + Math.random() * 40); this.pickTarget(d); }
        }
        continue;
      }
      const sp = (d.realm >= 2 ? REALMS[d.realm].speed * 1.8 : REALMS[d.realm].speed) * dt;
      d.x += dx / dd * Math.min(sp, dd); d.y += dy / dd * Math.min(sp, dd);
    }
  }

  private refreshActive() {
    const g = this.game, p = g.player;
    const R = Math.max(2600, g.senseRadius * 1.5), R2 = R + 900;
    for (const d of this.list) {
      if (!d.alive || d.hidden) { if (this.active.has(d.id) && d.hidden) this.active.delete(d.id); continue; }
      const dd = Math.hypot(d.x - p.x, d.y - p.y);
      const a = this.active.get(d.id);
      if (!a && dd < R && this.active.size < 34) {
        const st = new CharState(d.x, d.y);
        this.active.set(d.id, { d, st, look: this.look(d), act: 'idle', t: 0, wait: Math.random() * 3, noticed: 0, hp: 1, bolts: [], allyCd: 1 });
      } else if (a && dd > R2 && !a.enemy && a.act !== 'follow') this.active.delete(d.id);
    }
  }

  // ------------------------------------------------------------ 行为
  private behave(a: Active, dt: number) {
    const g = this.game, d = a.d, st = a.st, T = g.terrain, p = g.player;
    a.t += dt;
    if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = undefined; }
    a.bolts = a.bolts.filter((b) => (b.t += dt) < 0.45);
    // 已化为敌人：位置跟随战斗实体
    if (a.enemy) {
      const e = a.enemy;
      if (!g.combat.enemies.includes(e)) {
        a.enemy = undefined;
        if (e.dead && !e.spar) return;
        d.x = st.x = e.x; d.y = st.y = e.y;
      } else { d.x = st.x = e.x; d.y = st.y = e.y; return; }
    }
    // 跟随（红颜同行）
    if (a.act === 'follow') {
      const tx = p.x - 70 * Math.sin(p.st.yaw + 0.9), ty = p.y - 40 * Math.cos(p.st.yaw + 0.9);
      const dx = tx - st.x, dy = ty - st.y, dd = Math.hypot(dx, dy);
      if (dd > 2400) { st.x = tx; st.y = ty; }
      const fly = p.flying || dd > 900;
      const sp = dd < 40 ? 0 : Math.min(dd * 3, fly ? 900 : g.speed * 1.3);
      if (sp > 0) { st.x += dx / dd * sp * dt; st.y += dy / dd * sp * dt; st.faceToward(dx, dy); }
      st.lift += ((fly ? 46 : 0) - st.lift) * Math.min(1, dt * 4);
      st.setAction(fly ? 'fly' : sp > 0 ? (sp > 200 ? 'run' : 'walk') : p.sitting ? 'sit' : 'idle'); st.speed = sp;
      d.x = st.x; d.y = st.y;
      // 助战
      a.allyCd -= dt;
      if (a.allyCd <= 0) {
        a.allyCd = 1.4 + Math.random() * 0.8;
        let tgt: Enemy | null = null, bd = 700;
        for (const e of g.combat.enemies) if (!e.dead && !e.spar && e.aggro) { const de = Math.hypot(e.x - st.x, e.y - st.y); if (de < bd) { bd = de; tgt = e; } }
        if (tgt) {
          const R = REALMS[d.realm], s = Math.min(d.stage, R.atk.length - 1);
          st.setAction('cast'); st.faceToward(tgt.x - st.x, tgt.y - st.y);
          g.combat.allyStrike(st.x, st.y - st.lift, tgt, R.atk[s] * 1.6, BEAUTY_BY_ID[d.beauty ?? '']?.color ?? '200,230,255', d.realm);
        }
      }
      st.update(dt);
      return;
    }
    // 斗法
    if (a.duel) {
      const du = a.duel, f = du.foe;
      if (!f.d.alive || !this.active.has(f.d.id)) { a.duel = undefined; a.act = 'idle'; return; }
      st.faceToward(f.st.x - st.x, f.st.y - st.y); st.speed = 0;
      du.cd -= dt; du.t += dt;
      // 保持距离、游走
      const dx = f.st.x - st.x, dy = f.st.y - st.y, dd = Math.hypot(dx, dy) || 1;
      const want = 260, k = (dd - want) / dd;
      st.x += dx * k * dt * 1.2 + Math.cos(a.t * 1.3 + d.seed) * 40 * dt; st.y += dy * k * dt * 1.2 + Math.sin(a.t * 1.1 + d.seed) * 30 * dt;
      st.lift += (((d.realm >= 2) ? 30 : 0) - st.lift) * Math.min(1, dt * 3);
      st.setAction(du.cd < 0.25 ? 'cast' : 'idle');
      if (du.cd <= 0) {
        du.cd = 0.8 + Math.random() * 0.7;
        const col = d.faction === 'demon' ? '220,50,70' : d.realm >= 2 ? '170,230,255' : '255,170,90';
        a.bolts.push({ x: st.x, y: st.y - 50 - st.lift, x2: f.st.x, y2: f.st.y - 40 - f.st.lift, t: 0, col });
        const gap = this.power(d) - this.power(f.d);
        f.duel && (f.duel.hp -= clamp(0.11 * Math.pow(1.18, gap), 0.02, 0.6) * (0.7 + Math.random() * 0.6));
        if (f.duel && f.duel.hp <= 0) this.endDuel(a, f);
      }
      d.x = st.x; d.y = st.y; st.update(dt);
      return;
    }
    // 劫道：靠近玩家
    if (a.act === 'approach') {
      const dx = p.x - st.x, dy = p.y - st.y, dd = Math.hypot(dx, dy);
      const sp = d.realm >= 2 ? 420 : 200;
      st.faceToward(dx, dy); st.setAction(d.realm >= 2 ? 'fly' : 'run'); st.speed = sp;
      st.lift += ((d.realm >= 2 ? 40 : 0) - st.lift) * Math.min(1, dt * 3);
      st.x += dx / dd * sp * dt; st.y += dy / dd * sp * dt;
      d.x = st.x; d.y = st.y; st.update(dt);
      if (dd < 520) this.toEnemy(a, true);
      if (dd > 4200) a.act = 'idle';
      return;
    }
    if (a.act === 'flee') {
      const dx = st.x - p.x, dy = st.y - p.y, dd = Math.hypot(dx, dy) || 1;
      const sp = d.realm >= 2 ? 520 : 230;
      st.faceToward(dx, dy); st.setAction(d.realm >= 2 ? 'fly' : 'run'); st.speed = sp;
      st.lift += ((d.realm >= 2 ? 50 : 0) - st.lift) * Math.min(1, dt * 3);
      st.x += dx / dd * sp * dt; st.y += dy / dd * sp * dt; d.x = st.x; d.y = st.y; st.update(dt);
      if (dd > 3000) { a.act = 'idle'; this.pickTarget(d); }
      return;
    }
    // 日常
    if (a.wait > 0) {
      a.wait -= dt;
      st.speed = 0; st.lift += (0 - st.lift) * Math.min(1, dt * 3);
      st.setAction(a.act === 'sit' ? 'sit' : a.act === 'gather' ? 'gather' : 'idle');
      st.update(dt); return;
    }
    let dx = d.tx - st.x, dy = d.ty - st.y; const dd = Math.hypot(dx, dy);
    if (dd < 40) {
      // 到达：打坐 / 采药 / 闲立
      const r = Math.random();
      if (d.goal === 'gather' || (d.faction !== 'mortal' && r < 0.25)) { a.act = 'gather'; a.wait = 3 + Math.random() * 5; }
      else if (d.faction !== 'mortal' && r < 0.55) { a.act = 'sit'; a.wait = 6 + Math.random() * 14; }
      else { a.act = 'idle'; a.wait = 2 + Math.random() * 5; }
      if (d.stay || Math.random() < 0.5) { const h = LOC_BY_ID.get(d.home)!; const sp = d.stay ? 500 : 1400; d.tx = (d.stay ? h.x * WORLD_SCALE : d.x) + (Math.random() - 0.5) * sp; d.ty = (d.stay ? h.y * WORLD_SCALE + 200 : d.y) + (Math.random() - 0.5) * sp * 0.6; }
      else this.pickTarget(d);
      return;
    }
    const flying = d.realm >= 2 && dd > 1400;
    const sp = flying ? (d.realm >= 3 ? 620 : 420) : d.faction === 'mortal' ? 70 : 105;
    dx /= dd; dy /= dd;
    const nx = st.x + dx * sp * dt, ny = st.y + dy * sp * dt;
    if (!flying && T.walkFactor(nx, ny) <= 0) {
      if (d.realm >= 2) { st.lift = Math.max(st.lift, 10); }
      else { this.pickTarget(d); a.wait = 1; return; }
    }
    st.x = nx; st.y = ny; st.faceToward(dx, dy, !flying);
    st.lift += ((flying || (d.realm >= 2 && T.walkFactor(nx, ny) <= 0) ? 44 : 0) - st.lift) * Math.min(1, dt * 2.5);
    st.setAction(st.lift > 12 ? 'fly' : 'walk'); st.speed = st.lift > 12 ? sp : sp * (T.walkFactor(nx, ny) || 1);
    a.act = st.lift > 12 ? 'fly' : 'walk';
    d.x = st.x; d.y = st.y;
    st.update(dt);
  }

  /** 互相以神识感知：发现玩家后的反应 */
  private senseCheck() {
    const g = this.game, p = g.player, pl = this.playerLv();
    for (const a of this.active.values()) {
      const d = a.d;
      if (!d.alive || a.enemy || a.duel || a.act === 'follow' || a.act === 'approach' || a.act === 'flee') continue;
      const dd = Math.hypot(a.st.x - p.x, a.st.y - p.y);
      const detect = this.senseOf(d) * (g.concealed ? (d.realm > g.hero.realm ? 0.75 : 0.45) : 1);
      if (dd > detect) { a.noticed = Math.max(0, a.noticed - 0.2); continue; }
      a.noticed = Math.min(3, a.noticed + 1);
      if (a.noticed < 2) continue;
      const gap = this.power(d) - pl;
      if (g.combat.safeAt(p.x, p.y) || g.combat.safeAt(a.st.x, a.st.y)) continue;
      if (this.hostileTo(d) && d.realm > 0 && !d.beauty && !d.stay) {
        const novice = g.day < 420 && g.hero.realm <= 1 && g.hero.stage < 4 && d.grudge <= 0;   // 新手保护：开局一年内劫修少见且不会碾压
        if (gap >= -2 || d.grudge > 0) {
          if (Math.random() < (novice ? (gap > 2 ? 0 : 0.15) : 0.5)) {
            a.act = 'approach';
            a.bubble = { text: d.grudge > 0 ? '冤家路窄！今日便了结旧账！' : d.faction === 'demon' ? '桀桀……送上门的血食。' : '道友，留下储物袋，饶你不死！', t: 3.5 };
            if (g.life.vis({ x: a.st.x, y: a.st.y }) > 0.2) g.toast(`神识中：${d.name}（${this.realmText(d)}）向你疾驰而来，来者不善！`, 'warn');
            else { g.toast('一道陌生的神识锁定了你……', 'warn'); g.renderer?.sense && (g.renderer.sense.alarm = 1); }
          }
        } else if (gap < -6 && Math.random() < 0.6) {
          a.act = 'flee'; a.bubble = { text: '不好，是高人！', t: 2.5 };
        }
      } else if (gap < -10 && g.ws.rep < -40 && d.faction !== 'demon') {
        a.act = 'flee'; a.bubble = { text: '是那个魔头！快走！', t: 2.5 };
      } else if (a.noticed === 2 && Math.random() < 0.3 && dd < 600) {
        a.bubble = { text: d.faction === 'mortal' ? (gap < 0 ? '仙师好！' : '……') : gap > 10 ? '嗯？' : gap < -10 ? `${['晚辈', '在下'][d.seed % 2]}见过前辈！` : '道友。', t: 2.2 };
      }
    }
  }

  /** 两名修士相遇：斗法 */
  private maybeDuel() {
    const arr = [...this.active.values()].filter((a) => a.d.alive && a.d.realm > 0 && !a.enemy && !a.duel && a.act !== 'follow' && !a.d.beauty && !a.d.stay);
    const g = this.game;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const A = arr[i], B = arr[j];
      const dd = Math.hypot(A.st.x - B.st.x, A.st.y - B.st.y);
      if (dd > 900) continue;
      if (g.combat.safeAt(A.st.x, A.st.y)) continue;
      const evil = (x: NpcData) => x.faction === 'demon' || x.pers === 'ruthless' || x.pers === 'greedy';
      const good = (x: NpcData) => x.faction === 'sect' || x.pers === 'righteous';
      if (!((evil(A.d) && good(B.d)) || (evil(B.d) && good(A.d)) || (evil(A.d) && evil(B.d) && Math.random() < 0.3))) continue;
      if (Math.random() > 0.35) continue;
      A.duel = { foe: B, hp: 1, cd: 0.6, t: 0 }; B.duel = { foe: A, hp: 1, cd: 1.1, t: 0 };
      A.act = B.act = 'duel';
      const atk = evil(A.d) ? A : B;
      atk.bubble = { text: ['此宝有德者居之！', '找死！', '狭路相逢，休怪我心狠！'][Math.floor(Math.random() * 3)], t: 3 };
      (atk === A ? B : A).bubble = { text: ['魔修休得猖狂！', '你我素无仇怨，何必相逼！', '来得好！'][Math.floor(Math.random() * 3)], t: 3 };
      if (g.life.vis({ x: A.st.x, y: A.st.y }) > 0.3 || g.life.vis({ x: B.st.x, y: B.st.y }) > 0.3) g.toast(`神识中：${A.d.name}与${B.d.name}斗起法来！（靠近按 T 可插手）`, 'info');
      return;
    }
  }
  private endDuel(win: Active, lose: Active) {
    const g = this.game;
    win.duel = undefined; lose.duel = undefined; win.act = 'idle'; lose.act = 'idle';
    const seen = g.life.vis({ x: lose.st.x, y: lose.st.y }) > 0.3;
    const lethal = win.d.faction === 'demon' || win.d.pers === 'ruthless' || Math.random() < 0.35;
    if (lethal) {
      if (seen) g.toast(`${win.d.name}斩杀了${lose.d.name}，遗落的储物袋还在原地……`, 'warn');
      g.combat.dropLoot(lose.st.x, lose.st.y, 'mat_lingshi', Math.max(3, Math.round(lose.d.wealth * 0.5)));
      if (Math.random() < 0.4) { const sk = g.combat.randomScroll(Math.min(4, lose.d.realm)); if (sk) g.combat.dropLoot(lose.st.x, lose.st.y, sk, 1); }
      this.die(lose.d, `死于${win.d.name}之手`);
      win.d.wealth += Math.round(lose.d.wealth * 0.3);
    } else {
      if (seen) g.toast(`${lose.d.name}不敌${win.d.name}，化作遁光逃走了。`);
      lose.act = 'flee'; lose.d.wealth = Math.round(lose.d.wealth * 0.6);
    }
  }

  /** 转化为战斗中的敌人 */
  toEnemy(a: Active, aggro: boolean, spar = false) {
    const g = this.game, d = a.d;
    const defId = d.faction === 'demon' ? (d.realm >= 3 ? 'jindan_mo' : 'moxiu') : d.realm >= 2 ? 'zhujixiu' : 'bandit';
    const def = ENEMIES[defId];
    const st = Math.min(d.stage, REALMS[d.realm].hp.length - 1);
    const e = new Enemy(def, a.st.x, a.st.y, Math.max(0, d.realm), st);
    if (d.realm === 0) { e.maxHp = e.hp = 40; e.atk *= 0.5; }
    if (d.realm >= 3) { e.maxHp = e.hp = Math.round(e.hp * 1.3); }
    e.look = a.look; e.cs = a.st; e.name = d.name; e.npcId = d.id; e.aggro = aggro; e.spar = spar;
    g.combat.enemies.push(e);
    a.enemy = e; a.act = 'idle'; a.duel = undefined;
    return e;
  }
  onEnemyKilled(e: Enemy) {
    if (!e.npcId) return;
    const g = this.game, d = this.byId.get(e.npcId); if (!d) return;
    const wasHostile = this.hostileTo(d) || d.faction === 'demon';
    this.die(d, '死于韩立之手');
    g.combat.dropLoot(e.x, e.y, 'mat_lingshi', Math.max(2, Math.round(d.wealth * 0.7)));
    if (d.realm >= 1 && Math.random() < 0.55) { const sk = g.combat.randomScroll(Math.min(4, d.realm + 1)); if (sk) g.combat.dropLoot(e.x, e.y, sk, 1); }
    if (d.realm >= 2 && Math.random() < 0.35) { const pool = ITEM_LIST.filter((it) => it.type === 'artifact' && it.tier <= d.realm && it.price > 0); const it = pool[Math.floor(Math.random() * pool.length)]; if (it) g.combat.dropLoot(e.x, e.y, it.id, 1); }
    if (wasHostile) { g.ws.rep = clamp(g.ws.rep + (d.faction === 'demon' ? 4 : 2), -100, 100); }
    else {
      g.ws.rep = clamp(g.ws.rep - (d.faction === 'sect' ? 18 : 10), -100, 100);
      g.toast(`你杀害了${d.name}——正道声望大跌。`, 'warn');
      // 同门记仇
      for (const o of this.list) if (o.alive && o.sect && o.sect === d.sect && Math.random() < 0.25) o.grudge = Math.max(o.grudge, 1);
    }
    if (d.canon) g.news(`${d.name}陨落于韩立之手。`, 'canon');
  }
  onSpar(e: Enemy, won: boolean) {
    const g = this.game, d = e.npcId ? this.byId.get(e.npcId) : null; if (!d) return;
    const gap = this.power(d) - this.playerLv();
    d.spar = g.day;
    if (won) {
      d.favor = clamp(d.favor + (d.pers === 'arrogant' ? 4 : 10), -100, 100);
      const msgs: C.Msg[] = []; const exp = C.need(g.hero) * clamp(0.03 + gap * 0.01, 0.01, 0.12);
      C.gainExp(g.hero, exp, msgs);
      g.toast(`切磋获胜！${d.name}${d.pers === 'arrogant' ? '面色铁青地拱了拱手' : '抱拳称服'}。（修为 +${Math.round(exp)}）`, 'good');
    } else {
      const msgs: C.Msg[] = []; const exp = C.need(g.hero) * 0.02;
      C.gainExp(g.hero, exp, msgs);
      g.toast(`切磋落败，${d.name}点到为止。你从中有所领悟（修为 +${Math.round(exp)}）。`);
      d.favor = clamp(d.favor + 3, -100, 100);
    }
  }

  // ------------------------------------------------------------ 交互
  /** T：与最近的人交谈 */
  interact(a: Active | null = this.focus) {
    if (!a) return false;
    const g = this.game, d = a.d;
    d.met = true;
    if (d.beauty) { g.hearts.talk(d.beauty, a); return true; }
    // 若正在斗法：插手
    if (a.duel) {
      const f = a.duel.foe;
      const node: DNode = {
        speaker: '神识', title: '斗法', text: `${d.name}（${this.realmText(d)}·${PERS_NAME[d.pers]}）正与${f.d.name}（${this.realmText(f.d)}·${PERS_NAME[f.d.pers]}）斗法，法光纵横。`,
        options: [
          { label: `出手相助${d.name}`, act: () => { this.help(a, f); return null; } },
          { label: `出手相助${f.d.name}`, act: () => { this.help(f, a); return null; } },
          { label: '坐山观虎斗', act: () => null },
        ], mood: 'danger',
      };
      g.openDialog(node); return true;
    }
    g.openDialog(this.mainNode(a));
    return true;
  }
  private help(friend: Active, foe: Active) {
    const g = this.game;
    friend.duel = undefined; foe.duel = undefined; friend.act = 'idle';
    const e = this.toEnemy(foe, true);
    e.hp = Math.round(e.hp * Math.max(0.3, foe.duel?.hp ?? 0.8));
    friend.d.favor = clamp(friend.d.favor + 35, -100, 100); friend.d.met = true;
    friend.bubble = { text: '多谢道友援手！', t: 3 };
    // 友方继续出手
    friend.act = 'idle';
    const iv = setInterval(() => {
      if (e.dead || !friend.d.alive || !this.active.has(friend.d.id)) { clearInterval(iv); if (e.dead && friend.d.alive) { friend.bubble = { text: '救命之恩，没齿难忘！', t: 4 }; g.toast(`${friend.d.name}对你感激不尽（好感大增）。`, 'good'); } return; }
      const R = REALMS[friend.d.realm], s = Math.min(friend.d.stage, R.atk.length - 1);
      friend.st.setAction('cast'); friend.st.faceToward(e.x - friend.st.x, e.y - friend.st.y);
      g.combat.allyStrike(friend.st.x, friend.st.y - friend.st.lift, e, R.atk[s] * 1.2, '170,230,255', friend.d.realm);
    }, 1300);
    if (!this.hostileTo(foe.d)) g.ws.rep = clamp(g.ws.rep - 3, -100, 100);
  }

  greeting(d: NpcData) {
    const gap = this.power(d) - this.playerLv();
    if (d.canon && CANON_LINES[d.id]) { const L = CANON_LINES[d.id]; return L[Math.floor(Math.random() * L.length)]; }
    if (d.faction === 'mortal') return MORTAL_GREET[Math.floor(Math.random() * MORTAL_GREET.length)];
    if (d.grudge > 0) return '（对方冷冷地盯着你）你还敢出现在我面前？';
    if (d.favor >= 50) return ['道友！别来无恙？', '哈哈，又见面了，来来来，坐下说话。', '是你啊——上次的事，我一直记着。'][d.seed % 3];
    const L = GREET[d.pers];
    let s = L[Math.floor(Math.random() * L.length)].replace('{realm}', realmName(this.game.hero.realm, this.game.hero.stage));
    if (gap < -12 && d.pers !== 'aloof') s = `（对方连忙躬身）晚辈${d.name}，见过前辈！` + (d.pers === 'greedy' ? '前辈若有差遣，晚辈万死不辞。' : '');
    return s;
  }
  mainNode(a: Active): DNode {
    const g = this.game, d = a.d;
    const gap = this.power(d) - this.playerLv();
    const sectName = d.sect ? LOC_BY_ID.get(d.sect)?.name : '';
    const title = `${this.realmText(d)}${sectName ? ' · ' + sectName : d.faction === 'rogue' ? ' · 散修' : d.faction === 'merchant' ? ' · 行商' : ''}${d.title && !sectName ? ' · ' + d.title : ''} · ${PERS_NAME[d.pers]} · 好感 ${Math.round(d.favor)}`;
    const opts: DOpt[] = [];
    opts.push({ label: '打听消息', act: () => ({ speaker: d.name, title, look: a.look, text: this.rumor(d), options: [{ label: '还有别的事', act: () => this.mainNode(a) }, { label: '告辞', act: () => null }] }) });
    if (d.faction === 'merchant' || (d.faction !== 'mortal' && d.wealth > 60 && d.pers !== 'aloof')) opts.push({ label: '交易', act: () => { g.openShop({ title: `${d.name}的货物`, desc: d.pers === 'greedy' ? '（价格偏高）' : d.pers === 'kind' ? '（价格公道）' : '', stock: this.stock(d), sellRate: d.pers === 'greedy' ? 0.35 : 0.5 }); return null; } });
    if (d.realm > 0 && gap >= -4 && d.favor >= 15) opts.push({ label: '请教修炼', hint: d.taught ? '已请教过' : '', disabled: !!d.taught, act: () => this.teach(a, title) });
    opts.push({ label: '赠礼', act: () => this.giftNode(a, title) });
    if (d.realm > 0 && d.faction !== 'mortal') opts.push({ label: '切磋', hint: d.spar && g.day - d.spar < 30 ? '近日已切磋过' : '', disabled: !!d.spar && g.day - d.spar < 30, act: () => {
      if (d.pers === 'aloof' || (d.pers === 'cautious' && d.favor < 20)) return { speaker: d.name, title, look: a.look, text: '切磋？不必了。', options: [{ label: '告辞', act: () => null }] };
      a.bubble = { text: '请！', t: 2 };
      this.toEnemy(a, true, true); g.toast(`与${d.name}切磋，点到为止。`); return null;
    } });
    opts.push({ label: '出手抢夺', tone: 'bad', act: () => ({ speaker: '心念', text: d.faction === 'demon' || this.hostileTo(d) ? `${d.name}身上魔气隐隐，除之也不算坏事。` : `${d.name}并无恶意。若无故出手，传扬出去必然声名狼藉，其同门也会记恨于你。`, options: [{ label: '动手！', tone: 'bad', act: () => { this.toEnemy(a, true); a.bubble = { text: '你——找死！', t: 3 }; return null; } }, { label: '算了', act: () => this.mainNode(a) }] }) });
    opts.push({ label: '告辞', act: () => null });
    return { speaker: d.name, title, look: a.look, text: this.greeting(d), options: opts };
  }
  private teach(a: Active, title: string): DNode {
    const g = this.game, d = a.d; d.taught = true;
    const sk = d.realm >= g.hero.realm && Math.random() < 0.5 ? g.combat.randomScroll(Math.min(4, d.realm)) : null;
    if (sk) { C.addItem(g.hero, sk, 1); return { speaker: d.name, title, look: a.look, text: `（${d.name}沉吟片刻，从储物袋中取出一枚玉简）这门法术我早已用不上了，送你吧。\n\n获得 ${itemDef(sk).name}（在储物袋中研读参悟）`, options: [{ label: '多谢道友！', act: () => null }] }; }
    const msgs: C.Msg[] = []; const exp = C.need(g.hero) * 0.06; C.gainExp(g.hero, exp, msgs);
    return { speaker: d.name, title, look: a.look, text: `（${d.name}与你论道半日，讲了些${d.realm > g.hero.realm ? REALMS[g.hero.realm + 1]?.name ?? '' : '运功'}的关窍）\n\n你有所领悟，修为 +${Math.round(exp)}`, options: [{ label: '受教了', act: () => null }] };
  }
  private giftNode(a: Active, title: string): DNode {
    const g = this.game, d = a.d, h = g.hero;
    const amt = Math.max(10, 10 * Math.pow(3, d.realm));
    const pills = h.bag.filter((b) => itemDef(b.id).type === 'pill').slice(0, 4);
    const give = (gain: number, line: string) => { d.favor = clamp(d.favor + gain, -100, 100); if (d.grudge > 0 && d.favor > 0) d.grudge = 0; return { speaker: d.name, title, look: a.look, text: line, options: [{ label: '还有别的事', act: () => this.mainNode(a) }, { label: '告辞', act: () => null }] } as DNode; };
    const opts: DOpt[] = [{ label: `赠灵石 ${amt}`, disabled: C.bagCount(h, 'mat_lingshi') < amt, act: () => { C.removeItem(h, 'mat_lingshi', amt); return give(d.pers === 'greedy' ? 16 : d.pers === 'aloof' ? 3 : 8, d.pers === 'greedy' ? '（对方眼睛一亮，飞快收下）道友真是爽快人！' : d.pers === 'aloof' ? '……身外之物罢了。' : '无功不受禄……那便多谢道友了。'); } }];
    for (const b of pills) { const it = itemDef(b.id); opts.push({ label: `赠${it.name}`, act: () => { C.removeItem(h, b.id, 1); return give(6 + it.tier * 6, `${it.name}？道友有心了！`); } }); }
    opts.push({ label: '算了', act: () => this.mainNode(a) });
    return { speaker: d.name, title, look: a.look, text: '（你想送些什么？）', options: opts };
  }
  private stock(d: NpcData): ShopStock[] {
    let s = d.seed + Math.floor(this.game.day / 30);
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const pool = ITEM_LIST.filter((it) => it.price > 0 && it.tier <= Math.max(1, d.realm + (d.faction === 'merchant' ? 1 : 0)) && it.type !== 'misc' && it.id !== 'mat_lingshi');
    const out: ShopStock[] = [];
    const n = 4 + Math.floor(rnd() * 5);
    const mul = d.pers === 'greedy' ? 1.4 : d.pers === 'kind' ? 0.9 : 1.1;
    for (let i = 0; i < n && pool.length; i++) { const it = pool[Math.floor(rnd() * pool.length)]; if (out.some((o) => o.id === it.id)) continue; out.push({ id: it.id, price: Math.max(1, Math.round(it.price * mul * (1 - clamp(d.favor, 0, 60) / 300))), n: it.type === 'artifact' || it.type === 'scroll' ? 1 : 1 + Math.floor(rnd() * 5), age: it.type === 'herb' ? 10 + Math.floor(rnd() * 60) : undefined }); }
    return out;
  }
  rumor(d: NpcData): string {
    const g = this.game;
    // 大事件传闻优先
    const ev = g.events?.rumorFor(d);
    if (ev && Math.random() < 0.6) return ev;
    // 指点附近的洞府 / 险地（揭开地图）
    const p = g.player;
    const near = LOCATIONS.filter((l) => (l.type === 'secret' || l.type === 'danger') && Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y) < 22000 && !g.isExplored(l.x * WORLD_SCALE, l.y * WORLD_SCALE));
    if (near.length && Math.random() < 0.55) {
      const l = near[Math.floor(Math.random() * near.length)];
      g.markKnown(l);
      const dir = this.dirName(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y);
      return l.type === 'secret' ? `往${dir}去，有一处「${l.name}」，据说是前人留下的洞府，禁制还在。有本事的不妨去碰碰运气。\n\n（地图上已标出${l.name}）` : `${dir}边的「${l.name}」妖兽横行，${l.danger! >= 3 ? '连筑基修士都折了好几个' : '不过妖丹倒是值几个钱'}。\n\n（地图上已标出${l.name}）`;
    }
    const L = [
      '坊市的筑基丹又涨价了，一枚少说也要上千灵石。',
      '听说有人在山里看到灵光冲天，怕是有天材地宝出世。',
      '最近劫修猖獗，独行的修士可要小心。',
      '掌门师叔说，过几年各派又要联手开启禁地了。',
      '有个散修在城外摆摊卖“上古功法”，十有八九是骗子。',
      '乱星海那边的妖丹，比天南便宜一半。',
      '我那师兄闭关三十年没出来，怕是坐化了。',
      '修仙界有句话：遇事不决，先跑为上。',
      '若神识被比你强的人扫中，要么敛息藏好，要么赶紧走。',
      d.faction === 'mortal' ? '仙人的事俺不懂，只知道去年山里有条大蛇吃了三头牛。' : '灵根不好也莫灰心，丹药堆上去，一样能筑基。',
    ];
    return L[Math.floor(Math.random() * L.length)];
  }
  dirName(dx: number, dy: number) { const a = Math.atan2(dy, dx); const i = Math.round(a / (Math.PI / 4)); return ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][(i + 8) % 8]; }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    const g = this.game;
    for (const a of this.active.values()) {
      if (a.enemy) continue;
      const st = a.st;
      if (st.x < view.left - 200 || st.x > view.right + 200 || st.y < view.top - 100 || st.y > view.bottom + 260) continue;
      const v = g.life.vis({ x: st.x, y: st.y });
      if (v <= 0.01) continue;
      out.push({ y: st.y, draw: (ctx) => this.drawOne(ctx, a, v, t, dt) });
    }
  }
  private drawOne(ctx: G, a: Active, v: number, t: number, dt: number) {
    const st = a.st, d = a.d, z = this.game.cam.zoom;
    ctx.save();
    ctx.globalAlpha *= v;
    // 影子
    ctx.fillStyle = `rgba(30,30,24,${0.26 - Math.min(0.14, st.lift / 400)})`;
    ctx.beginPath(); ctx.ellipse(st.x, st.y + 2, 20 + st.lift * 0.25, 6 + st.lift * 0.05, 0, 0, TAU); ctx.fill();
    const S = d.beauty ? 1.06 : 1.0;
    if (st.lift > 12) drawSwordUnderFeet(ctx, st.x, st.y - st.lift, st.yaw, S, t, a.look.swordColor ?? (d.faction === 'demon' ? '#ff6a7a' : '#9fe8ff'));
    // 斗法护体光
    if (a.duel) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.25 + 0.1 * Math.sin(t * 8); ctx.fillStyle = d.faction === 'demon' ? '#ff3050' : '#80d0ff'; ctx.beginPath(); ctx.ellipse(st.x, st.y - 60 - st.lift, 36, 70, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    drawCharacter(ctx, a.look, st, S, dt);
    // 法术光弹
    if (a.bolts.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const b of a.bolts) {
        const k = b.t / 0.45, hx = b.x + (b.x2 - b.x) * Math.min(1, k * 1.6), hy = b.y + (b.y2 - b.y) * Math.min(1, k * 1.6);
        ctx.strokeStyle = `rgba(${b.col},${0.8 * (1 - k)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(b.x + (hx - b.x) * 0.5, b.y + (hy - b.y) * 0.5); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = `rgba(${b.col},${1 - k})`; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
        if (k > 0.6) { ctx.globalAlpha = (1 - k) * 2; ctx.beginPath(); ctx.arc(b.x2, b.y2, 26 * k, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }
    // 名牌（近处）
    const near = Math.hypot(st.x - this.game.player.x, st.y - this.game.player.y) < 900;
    if (near || d.beauty || a.duel || a.act === 'approach') {
      const gap = this.power(d) - this.playerLv();
      const col = d.realm === 0 ? '#e8e0cc' : gap > 6 ? '#ff7a6a' : gap > 0 ? '#ffd27a' : gap > -6 ? '#e8f0e0' : '#9fc8a0';
      const fs = Math.max(11, 13 / Math.max(0.5, z));
      ctx.font = `${fs}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center';
      const y = st.y - 150 * S - st.lift;
      const label = d.beauty ? `❀ ${d.name}` : d.realm === 0 ? d.name : `${d.name}·${this.realmText(d)}`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText(label, st.x, y);
      ctx.fillStyle = d.beauty ? '#ffc8d8' : col; ctx.fillText(label, st.x, y);
      if (this.focus === a) { ctx.fillStyle = 'rgba(255,240,200,0.95)'; ctx.font = `${fs * 0.85}px "Noto Serif SC",serif`; ctx.fillText('【T】交谈', st.x, y - fs * 1.2); }
    }
    if (a.bubble) {
      const fs = Math.max(12, 14 / Math.max(0.5, z));
      ctx.font = `${fs}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center';
      const w = ctx.measureText(a.bubble.text).width + fs, y = st.y - 175 * S - st.lift - fs;
      ctx.globalAlpha *= Math.min(1, a.bubble.t * 2);
      ctx.fillStyle = 'rgba(250,244,228,0.92)'; ctx.strokeStyle = 'rgba(60,40,30,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(st.x - w / 2, y - fs * 0.95, w, fs * 1.5, fs * 0.5) : ctx.rect(st.x - w / 2, y - fs * 0.95, w, fs * 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2018'; ctx.fillText(a.bubble.text, st.x, y + fs * 0.1);
    }
    ctx.restore();
  }
  /** 小地图 / 世界地图：神识范围内的人 */
  visibleDots() { const g = this.game; const out: { x: number; y: number; c: string }[] = []; for (const a of this.active.values()) if (!a.enemy && g.life.vis({ x: a.st.x, y: a.st.y }) > 0.3) out.push({ x: a.st.x, y: a.st.y, c: a.d.beauty ? '#ff9ac0' : this.hostileTo(a.d) ? '#ff6a5a' : '#e8e0cc' }); return out; }
  activeOf(id: string) { return this.active.get(id) ?? null; }
  /** 让某人出现在玩家身旁（红颜同行） */
  summon(id: string) {
    const d = this.byId.get(id); if (!d) return null;
    const p = this.game.player;
    d.x = p.x - 80; d.y = p.y + 30;
    let a = this.active.get(id);
    if (!a) { a = { d, st: new CharState(d.x, d.y), look: this.look(d), act: 'follow', t: 0, wait: 0, noticed: 0, hp: 1, bolts: [], allyCd: 1 }; this.active.set(id, a); }
    a.st.x = d.x; a.st.y = d.y; a.act = 'follow';
    return a;
  }
  dismiss(id: string) { const a = this.active.get(id); if (a) { a.act = 'idle'; this.pickTarget(a.d); } }
}
