// 第五步：城镇与宗门——坊市、丹药铺、法器阁、酒楼、客栈、传送阵、拍卖会；拜入宗门、贡献、任务、藏经阁、俸禄、晋升
import type { Game } from './game';
import { LOCATIONS, LOC_BY_ID, locHere, LocDef, WORLD_SCALE } from '../data/world';
import { ITEM_LIST, itemDef, ItemDef } from '../data/items';
import { ENEMY_LIST } from '../data/enemies';
import { REALMS } from '../data/realms';
import * as C from './cultivation';
import { mulberry32 } from '../core/rng';
import type { DNode, DOpt, Shop, ShopStock } from './modal';
import { SECT_RANKS, SECT_RANK_NEED, SECT_RANK_REALM, SectTask } from './worldstate';
import { zoneOfLoc, shopLevel, pzOf, sellableAt, priceMul, yaodanCap, yaodanLv, ruleOf, sectCanOffer, canonOwned, ZONE_NAME, cityTier, auctionLevel, TIER_NAME, type Zone } from '../data/market';

/** 玩家所在处的市集分区：取本图最近的有名地点 */
export function zoneHere(g: Game): Zone {
  const px = g.player.x / WORLD_SCALE, py = g.player.y / WORLD_SCALE;
  let best: LocDef | null = null, bd = Infinity;
  for (const l of LOCATIONS) { if (l.minor || (l.type !== 'city' && l.type !== 'town' && l.type !== 'sect' && l.type !== 'isle')) continue; const d = Math.hypot(l.x - px, l.y - py); if (d < bd) { bd = d; best = l; } }
  return zoneOfLoc(best);
}

const DEMON = new Set(['guiling', 'hehuan', 'yuling', 'qianhuan', 'tiansha', 'yinluo', 'tianmo']);
/** 各宗门藏经阁特色功法/法术（与原著对应） */
export const SECT_LIB: Record<string, string[]> = {
  huangfeng: ['scroll_qingyuan', 'scroll_art_qingyuanmang', 'scroll_art_yujian', 'scroll_art_huoshe', 'scroll_luoyan', 'scroll_tianyan', 'scroll_art_hutijiandun', 'scroll_art_jinren', 'scroll_art_shenxing', 'scroll_art_fengdun'],
  yanyue: ['scroll_art_bingzhui', 'scroll_art_huichun', 'scroll_art_hanbing', 'scroll_art_xuanbing', 'scroll_lianqi', 'scroll_art_shuidan', 'scroll_art_mihun', 'scroll_art_shuangren'],
  lingshou: ['scroll_art_yushou', 'scroll_art_tengfu', 'scroll_art_feisha', 'scroll_art_qingmu'],
  luoyun: ['scroll_art_huichun', 'scroll_art_tengfu', 'scroll_art_qingteng', 'scroll_art_yimu', 'scroll_lianqi', 'scroll_art_qingmu'],
  gujian: ['scroll_art_yujian', 'scroll_art_jianying'],
  jujian: ['scroll_art_yujian', 'scroll_art_jujianshu', 'scroll_art_fenjin', 'scroll_art_jianhe'],
  huadao: ['scroll_art_jinren', 'scroll_art_fenjin', 'scroll_art_qingfeng'],
  tianque: ['scroll_art_tiebu', 'scroll_art_jinzhong', 'scroll_art_feishi', 'scroll_art_huangsha'],
  qingxu: ['scroll_art_huichun', 'scroll_art_yufeng', 'scroll_art_qingteng', 'scroll_art_qingmu', 'scroll_art_dingshen'],
  qianzhu: ['scroll_art_kuilei', 'scroll_art_kunzhen'],
  yuling: ['scroll_art_yushou', 'scroll_art_yinhun'],
  tiansha: ['scroll_art_xuedun', 'scroll_art_xuelian'],
  jiyin: ['scroll_xuanyin', 'scroll_art_xueying', 'scroll_art_yinhun'],
  baiqiao: ['scroll_art_kuilei', 'scroll_art_kunzhen', 'scroll_art_diandao'],
  guiling: ['scroll_art_xueying', 'scroll_art_yinhun', 'scroll_art_xuedun', 'scroll_art_shihun', 'scroll_art_yinfeng'],
  tianmo: ['scroll_tuotian', 'scroll_art_xuelian', 'scroll_art_xuedun', 'scroll_art_hualong', 'scroll_art_shihun'],
  hehuan: ['scroll_art_xueying', 'scroll_art_yinhun'],
  yinluo: ['scroll_art_yinhun', 'scroll_art_xuelian', 'scroll_art_shihun'],
  taiyi: ['scroll_art_zhangxin', 'scroll_art_yinlei', 'scroll_art_leiwang', 'scroll_art_benlei', 'scroll_art_jiutianlei', 'scroll_art_leiguang'],
  tianlan: ['scroll_art_jingang', 'scroll_art_xiangjia', 'scroll_art_hualong', 'scroll_art_jinzhong'],
  qixuan: ['scroll_art_jingang', 'scroll_art_yufeng', 'scroll_art_feishi', 'scroll_art_qingfeng'],
};

export interface AuctionLot { id: string; base: number; price: number; done?: 'won' | 'lost'; who?: string; top?: boolean; age?: number }

export class Towns {
  game: Game;
  constructor(game: Game) { this.game = game; }

  canEnter(l: LocDef | null) { return !!l && (l.type === 'city' || l.type === 'town' || l.type === 'sect' || (l.type === 'isle' && !l.minor) || l.id === 'tainan'); }
  isMajorTown(l: LocDef) { return l.type === 'city' || l.id === 'tianxing' || l.id === 'tainan' || l.id === 'kuixing'; }
  hasTeleport(l: LocDef) { return (l.type === 'city' && !l.minor) || (l.type === 'sect' && !!l.major) || l.id === 'tianxing' || l.id === 'chuansong' || l.id === 'kuixing'; }
  occupied(l: LocDef) { const ws = this.game.ws; return !!ws.flags.yueFallen && l.ox > 425 && l.ox < 590 && l.oy > 495 && l.map === 'tiannan' && (l.type === 'city' || l.type === 'town') && ws.rep > -20; }

  open(l: LocDef, fac?: string) {
    const g = this.game;
    if (this.hasTeleport(l) && !g.ws.tp.includes(l.id)) { g.ws.tp.push(l.id); g.toast(`激活了${l.name}的传送阵`, 'good'); }
    g.openModal({ kind: 'town', loc: l, fac });
  }

  // ------------------------------------------------------------ 商店
  tierOf(l: LocDef) { return shopLevel(l); }
  /**
   * 第三十七步：货按原著产地与稀有度上架，价格按价区浮动（妖丹：乱星海便宜，天南贵得离谱）
   * 第四十步：城池分五档——越大的城，货越多、越好：小镇多是大路货；大城几乎不摆凡品；雄城、天下名城的铺子里能见到拍卖会级的东西
   */
  shop(l: LocDef, kind: 'market' | 'pill' | 'artifact' | 'talisman'): Shop {
    const g = this.game;
    const month = Math.floor(g.day / 30);
    const rnd = mulberry32(((l.x * 1000 + l.y) | 0) * 31 + month * 7 + kind.length);
    const z = zoneOfLoc(l), lvl = shopLevel(l), pz = pzOf(z), T = cityTier(l);
    const yCap = yaodanCap(pz, Math.min(3, lvl), rnd);
    const base: (it: ItemDef) => boolean = kind === 'pill' ? (it) => it.type === 'pill' : kind === 'artifact' ? (it) => it.type === 'artifact' : kind === 'talisman' ? (it) => it.type === 'talisman' || it.type === 'scroll' : (it) => it.type === 'herb' || it.type === 'material' || (it.type === 'pill' && it.tier <= 1) || it.type === 'talisman';
    // 大城不摆凡品：法器阁里没有入门法器，丹铺里没有聚气丹之流（回气、疗伤另行常备）
    const minTier = T >= 5 ? 2 : T >= 4 ? (kind === 'market' ? 1 : 2) : T >= 3 ? 1 : 0;
    const filt = (it: ItemDef) => base(it) && (it.tier >= minTier || (kind === 'market' && it.type === 'talisman' && it.tier >= 1));
    // 筑基丹不进铺子：天南被七派把持、大晋也只上拍卖（乱星海大岛的丹铺另行处理）
    const pool = ITEM_LIST.filter((it) => filt(it) && it.id !== 'pill_zhuji' && sellableAt(it, z, lvl, yCap, l.id));
    // 档次越高，越偏向本档的好货：目标档 1.6 · 次一档 1 · 再次 0.45 · 更低 0.15
    const target = Math.min(lvl, 4);
    const gradeOf = (it: ItemDef) => (yaodanLv(it.id) ? (yaodanLv(it.id) >= yCap ? Math.min(3, lvl) : 1) : ruleOf(it).g);
    const wt = pool.map((it) => { const gr = gradeOf(it); return gr >= target ? 1.6 : gr === target - 1 ? 1 : gr === target - 2 ? 0.45 : 0.15; });
    const tot = wt.reduce((a, b) => a + b, 0);
    const pickW = () => { let r = rnd() * tot; for (let i = 0; i < pool.length; i++) { r -= wt[i]; if (r <= 0) return pool[i]; } return pool[pool.length - 1]; };
    const stock: ShopStock[] = [];
    const k = 1 - this.game.hearts.bonus('luck');
    const add = (it: ItemDef) => {
      if (stock.some((s) => s.id === it.id)) return;
      const g4 = ruleOf(it).g >= 4 && !yaodanLv(it.id) ? (T >= 5 ? 1.1 : 1.25) : 1;   // 拍卖会级的货摆在铺子里，要价更高
      stock.push({ id: it.id, price: Math.max(1, Math.round(it.price * priceMul(it, z) * g4 * (0.9 + rnd() * 0.4) * k * (g.ws.rep < -40 ? 1.3 : 1))), n: it.type === 'artifact' || it.type === 'scroll' || ruleOf(it).g >= 4 ? 1 : 1 + Math.floor(rnd() * (it.tier <= 1 ? 8 : 3 + (T >= 4 ? 2 : 0))), age: it.type === 'herb' ? Math.round((5 + rnd() * 40) * (T >= 4 ? 1 + rnd() * 4 : 1)) : undefined });
    };
    const n = (kind === 'market' ? [8, 8, 10, 13, 16, 20] : [6, 6, 7, 9, 12, 15])[T] ?? 8;
    for (let i = 0; i < n * 4 && stock.length < n && pool.length; i++) add(pickW());
    // 乱星海坊市：妖丹是硬通货，月月有货
    if (kind === 'market' && pz === 'LX') for (let lv = Math.max(1, yCap - 2); lv <= yCap; lv++) { const it = itemDef(`mat_yaodan${lv}`); if (it && rnd() < 0.75) add(it); }
    // 海外筑基丹不像天南那样被七派把持：大岛丹铺偶有一两颗
    if (kind === 'pill' && pz === 'LX' && lvl >= 3 && rnd() < (T >= 5 ? 0.6 : 0.3)) { const it = itemDef('pill_zhuji'); add(it); const s0 = stock.find((s) => s.id === it.id); if (s0) s0.n = 1; }
    // 丹铺常备回气、疗伤
    if (kind === 'pill') for (const id of ['pill_huiqi', 'pill_liaoshang']) if (!stock.some((s) => s.id === id)) { const it = itemDef(id); stock.push({ id, price: Math.round(it.price * (0.9 + rnd() * 0.3)), n: 5 + Math.floor(rnd() * 6) }); }
    // 第十八步：坊市常备破禁符、回府符
    if (kind === 'market') for (const id of ['tal_pojin', 'tal_huifu']) if (!stock.some((s) => s.id === id)) { const it = itemDef(id); stock.push({ id, price: Math.round(it.price * (0.9 + rnd() * 0.3)), n: 3 + Math.floor(rnd() * 5) }); }
    // 好货排前
    stock.sort((a, b) => itemDef(b.id).tier - itemDef(a.id).tier || b.price - a.price);
    const title = { market: '坊市', pill: '丹药铺', artifact: '法器阁', talisman: '符箓斋' }[kind];
    const note = pz === 'LX' ? '海外坊市：妖丹、海兽材料便宜，灵草稀贵' : pz === 'DJ' ? '大晋坊市：品类齐全，价钱也贵' : '天南坊市：灵草不缺，妖丹奇贵';
    const tierNote = ['', '小地方，多是大路货。', '寻常城池，货色平平。', '大城，凡品已不上架。', '雄城，偶有拍卖会级的好货。', '天下名城，奇珍异宝云集。'][T];
    return { title: `${l.name} · ${title}`, desc: `【${TIER_NAME[T]}】${tierNote}` + (kind === 'market' ? '每月换一批货。' : '') + note, stock, sellRate: 0.5, zone: z };
  }
  /** 卖给这家店能得多少灵石（按价区） */
  sellPrice(shop: Shop, id: string, age = 0) {
    const it = itemDef(id);
    const z = (shop.zone as Zone | undefined) ?? zoneHere(this.game);
    return Math.max(1, Math.round(it.price * priceMul(it, z) * shop.sellRate * (it.type === 'herb' ? 1 + Math.min(2, age / 100) : 1)));
  }
  buy(shop: Shop, s: ShopStock) {
    const g = this.game, h = g.hero;
    if (shop.currency === 'contrib') {
      const ss = g.ws.sect; if (!ss || ss.contrib < s.price) { g.toast('贡献不足', 'warn'); return false; }
      ss.contrib -= s.price;
    } else {
      if (C.bagCount(h, 'mat_lingshi') < s.price) { g.toast('灵石不足', 'warn'); return false; }
      C.removeItem(h, 'mat_lingshi', s.price);
    }
    C.addItem(h, s.id, 1, s.age); s.n--;
    if (s.n <= 0) shop.stock.splice(shop.stock.indexOf(s), 1);
    g.toast(`购得 ${itemDef(s.id).name}`, 'good');
    return true;
  }
  sell(shop: Shop, id: string, age?: number) {
    const g = this.game, h = g.hero; const it = itemDef(id);
    if (id === 'mat_lingshi' || it.price <= 0) return false;
    const st = h.bag.find((b) => b.id === id && (age === undefined || b.age === age)); if (!st) return false;
    if (h.hotbar.includes(id) && C.bagCount(h, id) <= 1) h.hotbar = h.hotbar.map((x) => (x === id ? null : x));
    C.removeItem(h, id, 1, st.age ?? 0);
    const p = this.sellPrice(shop, id, st.age ?? 0);
    C.addItem(h, 'mat_lingshi', p);
    return true;
  }

  // ------------------------------------------------------------ 客栈 / 酒楼
  rest(l: LocDef) {
    const g = this.game, h = g.hero;
    const cost = l.type === 'city' ? 5 : 2;
    if (C.bagCount(h, 'mat_lingshi') < cost) { g.toast('灵石不足', 'warn'); return; }
    C.removeItem(h, 'mat_lingshi', cost);
    h.hp = 1; h.mp = 1; g.day += 1; g.save(0);
    g.toast(`在${l.name}客栈歇息一夜，气血法力尽复，已自动存档。`, 'good');
  }
  tavern(l: LocDef): DNode {
    const g = this.game;
    const lines: string[] = [];
    const ev = g.events.upcoming().slice(0, 2);
    for (const e of ev) lines.push(e);
    const near = LOCATIONS.filter((x) => x.type === 'secret' && Math.hypot(x.x - l.x, x.y - l.y) < 70 && !g.isExplored(x.x * WORLD_SCALE, x.y * WORLD_SCALE));
    if (near.length) { const x = near[Math.floor(Math.random() * near.length)]; g.markKnown(x); lines.push(`邻桌的散修压低声音：「听说「${x.name}」那边有座古修洞府，禁制松动了……」（地图已标出）`); }
    const recent = g.ws.news.slice(-3).reverse().map((n) => `坊间都在传：${n.text}`);
    lines.push(...recent);
    if (!lines.length) lines.push('酒楼里人声嘈杂，说的都是些家长里短。');
    return { speaker: `${l.name} · 酒楼`, title: '打听消息', text: lines.join('\n\n'), options: [{ label: '再要一壶酒（2 灵石）', disabled: C.bagCount(g.hero, 'mat_lingshi') < 2, act: () => { C.removeItem(g.hero, 'mat_lingshi', 2); return this.tavern(l); } }, { label: '离开', act: () => null }] };
  }

  // ------------------------------------------------------------ 传送阵
  tpCost(a: LocDef, b: LocDef) { return Math.round(20 + Math.hypot(a.x - b.x, a.y - b.y) * 1.6); }
  teleportTo(from: LocDef, to: LocDef) {
    const g = this.game, cost = this.tpCost(from, to);
    if (C.bagCount(g.hero, 'mat_lingshi') < cost) { g.toast('灵石不足', 'warn'); return false; }
    C.removeItem(g.hero, 'mat_lingshi', cost);
    const z = g.terrain.locZones[LOCATIONS.indexOf(to)];
    let tx = to.x * WORLD_SCALE, ty = to.y * WORLD_SCALE + (z ? z.ry * 0.9 : 300);
    for (let r = 0; r < 1500 && g.terrain.walkFactor(tx, ty) <= 0; r += 60) ty += 60;
    g.teleport(tx, ty);
    g.day += 1;
    g.closeModal(true);
    g.toast(`传送阵灵光一闪——已至${to.name}（耗费 ${cost} 灵石）`, 'good');
    return true;
  }

  // ------------------------------------------------------------ 拍卖会（城池，每季度一次，持续十日）
  // 第四十步：拍卖会也分档——小城拍的是筑基修士眼热的东西；雄城、天下名城（晋京九霄殿、天星城星宫拍卖）的压轴是元婴老怪也要争的灵宝
  auctionOpen(l: LocDef) { if (!this.isMajorTown(l)) return false; const d = Math.floor(this.game.day) % 90; return d >= 80; }
  auctionLots(l: LocDef): AuctionLot[] {
    const g = this.game;
    const q = Math.floor(g.day / 90);
    const rnd = mulberry32(((l.x * 977 + l.y * 13) | 0) + q * 101);
    // 第三十七步：拍品按原著产地——天南拍不到乱星海的高阶妖丹，乱星海拍不到天南七派把持的筑基丹；原著有主之宝一概不上台
    const z = zoneOfLoc(l), pz = pzOf(z), A = auctionLevel(l), yCap = yaodanCap(pz, A, rnd);
    const minPrice = [0, 0, 0, 150, 400, 2500, 8000][A], gLo = A <= 3 ? 2 : 3;
    const pool = ITEM_LIST.filter((it) => it.price >= minPrice && !yaodanLv(it.id) && (it.type !== 'misc' || it.price > 0) && sellableAt(it, z, A, yCap, l.id, true) && ruleOf(it).g >= gLo);
    const wt = pool.map((it) => { const r = ruleOf(it); return (r.g >= 4 ? (A >= 5 ? 3 : 2) : 1) * (r.minLv ? 2.5 : 1) * (A >= 6 ? 1 + it.tier * 0.25 : 1); });
    const tot = wt.reduce((a, b) => a + b, 0);
    const lots: AuctionLot[] = [];
    const lot = (id: string, base: number, top = false) => { const it = itemDef(id); return { id, base, price: base, top, age: it.type === 'herb' ? Math.round((it.herbBase ?? 50) * (1 + rnd() * (A >= 5 ? 6 : 2))) : undefined }; };
    const push = (id: string, base: number, top = false) => { if (!lots.some((x) => x.id === id)) lots.push(lot(id, base, top)); };
    const basePrice = (id: string, k = 1) => { const it = itemDef(id); return Math.round(it.price * priceMul(it, z) * (0.6 + rnd() * 0.3) * k); };
    const nLots = [0, 0, 0, 4, 5, 7, 9][A];
    for (let t = 0; t < 60 && lots.length < nLots && pool.length; t++) {
      let r = rnd() * tot, it = pool[0];
      for (let i = 0; i < pool.length; i++) { r -= wt[i]; if (r <= 0) { it = pool[i]; break; } }
      push(it.id, basePrice(it.id));
    }
    // 筑基丹：天南、大晋的中小拍卖会常客（雄城名城看不上）
    if (pz !== 'LX' && A <= 4 && rnd() < 0.5 && !lots.some((x) => x.id === 'pill_zhuji') && lots.length) lots[lots.length - 1] = lot('pill_zhuji', pz === 'TN' ? 1200 : 1500);
    // 压轴的妖丹：乱星海常见，天南难得一见
    if (rnd() < (pz === 'LX' ? 0.75 : pz === 'DJ' ? 0.35 : 0.3) + (A >= 5 ? 0.2 : 0)) push(`mat_yaodan${yCap}`, basePrice(`mat_yaodan${yCap}`, 1.1), A >= 5);
    // 雄城 / 名城的压轴：元婴期的灵宝、丹药、功法
    if (A >= 5) {
      const tops = pool.filter((it) => (ruleOf(it).minLv ?? 0) >= 5 || it.tier >= 5);
      for (let i = 0; i < (A >= 6 ? 2 : 1) && tops.length; i++) { const it = tops[Math.floor(rnd() * tops.length)]; push(it.id, basePrice(it.id, 1.1), true); }
      // 原著：大晋京城拍卖会上拍出过庚精；天星城大拍卖偶有一截天雷竹（妙音门流出）
      if (l.id === 'jinjing' && rnd() < 0.4) push('mat_gengjing', basePrice('mat_gengjing'), true);
      if (l.id === 'tiantian' && rnd() < 0.25) push('mat_gengjing', basePrice('mat_gengjing'), true);
      if (l.id === 'tianxing' && rnd() < 0.12) { push('herb_tianleizhu', basePrice('herb_tianleizhu', 1.4), true); const t = lots.find((x) => x.id === 'herb_tianleizhu'); if (t) t.age = 1000 + Math.round(rnd() * 1500); }
    }
    // 压轴的放最后
    lots.sort((a, b) => Number(!!a.top) - Number(!!b.top) || a.base - b.base);
    return lots;
  }
  /** 本地拍卖会的风格（界面上提一句） */
  auctionNote(l: LocDef) { const z = zoneOfLoc(l), T = cityTier(l); return `${ZONE_NAME[z]}${T >= 5 ? (l.id === 'jinjing' ? '九霄殿大拍卖' : l.id === 'tianxing' ? '星宫大拍卖' : '大拍卖') : T >= 4 ? '大拍卖会' : '拍卖会'}`; }
  /** 竞价的人——越大的拍卖会，来的人境界越高 */
  auctionBidders(l: LocDef): string[] {
    const T = cityTier(l), map = l.map;
    const low = ['一位蒙面修士', '富态的商会掌柜', '白发老妪', '某世家公子', '黄衫少女', '独眼散修'];
    const mid = map === 'luanxing' ? ['星宫执事', '逆星盟长老', '极阴岛弟子', '猎妖团团长'] : map === 'dajin' ? ['太一门长老', '叶家家主', '天魔宗执事', '化意门长老'] : ['落云宗长老', '鬼灵门弟子', '天道盟执事', '古剑门剑修'];
    const high = map === 'luanxing' ? ['星宫的元婴长老（神识一扫全场）', '某位海外元婴老怪', '雅间里的元婴修士'] : map === 'dajin' ? ['天字号雅间里的元婴老怪', '叶家元婴老祖', '天魔宗元婴长老', '皇族供奉（元婴）'] : ['天道盟的元婴长老', '雅间里的元婴老怪', '鬼灵门元婴长老'];
    return T >= 4 ? [...mid, ...high, ...high] : T >= 3 ? [...low, ...mid] : low;
  }

  // ------------------------------------------------------------ 宗门
  sectOf() { const s = this.game.ws.sect; return s ? LOC_BY_ID.get(s.id) ?? null : null; }
  joinReq(l: LocDef): { ok: boolean; why: string } {
    const g = this.game, h = g.hero;
    if (g.ws.sect) return { ok: false, why: `你已是${LOC_BY_ID.get(g.ws.sect.id)?.name}弟子` };
    if (g.ws.flags.betray?.includes(l.id)) return { ok: false, why: '此宗视你为叛徒' };
    const demon = DEMON.has(l.id);
    if (demon && g.ws.rep > -15) return { ok: false, why: '魔道宗门只收心狠手辣之辈（声望需 ≤ -15）' };
    if (!demon && g.ws.rep < -30) return { ok: false, why: '你恶名在外，正道宗门不收' };
    if (l.id === 'qixuan') return { ok: true, why: '' };
    if (l.id === 'huangfeng' && C.bagCount(h, 'item_shengxian') > 0) return { ok: true, why: '持升仙令可直接入门' };
    const need = l.major ? 5 : 3;
    if (h.realm < 1 || (h.realm === 1 && h.stage < need)) return { ok: false, why: `需炼气${['', '一', '二', '三', '四', '五', '六'][need]}层以上${l.id === 'huangfeng' ? '（或持升仙令）' : ''}` };
    return { ok: true, why: '' };
  }
  join(l: LocDef) {
    const g = this.game;
    const r = this.joinReq(l); if (!r.ok) { g.toast(r.why, 'warn'); return; }
    if (l.id === 'huangfeng' && C.bagCount(g.hero, 'item_shengxian') > 0) C.removeItem(g.hero, 'item_shengxian', 1);
    g.ws.sect = { id: l.id, rank: 0, contrib: 50, joined: g.day, lastPay: g.day, tasks: [], done: 0 };
    this.refreshTasks();
    g.news(`韩立拜入${l.name}，成为外门弟子。`, 'personal');
    g.toast(`拜入${l.name}！每月可领俸禄，完成宗门任务换取贡献。`, 'good');
    if (DEMON.has(l.id)) g.ws.rep = Math.min(g.ws.rep, -20);
  }
  leave() {
    const g = this.game, s = g.ws.sect; if (!s) return;
    g.ws.flags.betray = [...(g.ws.flags.betray ?? []), s.id];
    g.news(`韩立叛出${LOC_BY_ID.get(s.id)?.name}。`, 'personal');
    for (const n of g.npcs.list) if (n.sect === s.id && Math.random() < 0.4) n.grudge = 1;
    g.ws.sect = null;
  }
  /** 每月俸禄（在宗门领取） */
  pay() {
    const g = this.game, s = g.ws.sect; if (!s) return 0;
    const months = Math.floor((g.day - s.lastPay) / 30);
    if (months <= 0) return 0;
    const amt = months * [10, 25, 60, 150, 400][s.rank];
    s.lastPay += months * 30;
    C.addItem(g.hero, 'mat_lingshi', amt);
    return amt;
  }
  refreshTasks() {
    const g = this.game, s = g.ws.sect; if (!s) return;
    const l = locHere(s.id);
    if (!l) return;   // 宗门不在本图：任务待回到宗门所在地图再刷新
    const rnd = mulberry32((g.day | 0) * 13 + l.x);
    const h = g.hero;
    const out: SectTask[] = [];
    const beasts = ENEMY_LIST.filter((e) => e.kind !== 'human' && e.minDanger <= 1 + h.realm && !e.zone);
    const evil = ENEMY_LIST.filter((e) => e.evil && e.minDanger <= 2 + h.realm);
    const herbs = ITEM_LIST.filter((it) => it.type === 'herb' && it.tier <= Math.max(1, h.realm));
    const k = Math.max(1, h.realm);
    const be = beasts[Math.floor(rnd() * beasts.length)];
    if (be) out.push({ id: 't' + g.day + 'a', kind: 'kill', text: `猎杀${be.name}`, target: be.id, need: 3 + Math.floor(rnd() * 4), have: g.ws.kills[be.id] ?? 0, reward: 40 * k, exp: 0.04, until: g.day + 90 });
    const ev = DEMON.has(s.id) ? beasts[Math.floor(rnd() * beasts.length)] : evil[Math.floor(rnd() * evil.length)];
    if (ev) out.push({ id: 't' + g.day + 'b', kind: 'kill', text: DEMON.has(s.id) ? `血祭：猎杀${ev.name}` : `除魔：斩杀${ev.name}`, target: ev.id, need: 2 + Math.floor(rnd() * 3), have: g.ws.kills[ev.id] ?? 0, reward: 70 * k, exp: 0.06, until: g.day + 120 });
    const hb = herbs[Math.floor(rnd() * herbs.length)];
    if (hb) out.push({ id: 't' + g.day + 'c', kind: 'gather', text: `上缴${hb.name}`, target: hb.id, need: 2 + Math.floor(rnd() * 3), have: 0, reward: 30 * k + hb.price / 4, exp: 0.02, until: g.day + 120 });
    const far = LOCATIONS.filter((x) => x.type === 'danger' && Math.hypot(x.x - l.x, x.y - l.y) < 90);
    const pl = far[Math.floor(rnd() * far.length)];
    if (pl) out.push({ id: 't' + g.day + 'd', kind: 'patrol', text: `巡查「${pl.name}」`, target: pl.id, need: 1, have: 0, reward: 50 * k, exp: 0.03, until: g.day + 120 });
    s.tasks = out;
  }
  /** 击杀计数 / 巡查 → 任务进度 */
  onKill(defId: string) { const ws = this.game.ws; ws.kills[defId] = (ws.kills[defId] ?? 0) + 1; }
  onVisit(locId: string) { const s = this.game.ws.sect; if (!s) return; for (const t of s.tasks) if (t.kind === 'patrol' && t.target === locId && t.have < 1) { t.have = 1; this.game.toast(`宗门任务：已巡查${LOC_BY_ID.get(locId)?.name}，回宗门交差`, 'good'); } }
  taskProgress(t: SectTask) {
    const g = this.game;
    if (t.kind === 'kill') return Math.min(t.need, (g.ws.kills[t.target] ?? 0) - t.have);
    if (t.kind === 'gather') return Math.min(t.need, C.bagCount(g.hero, t.target));
    return t.have;
  }
  turnIn(t: SectTask) {
    const g = this.game, s = g.ws.sect; if (!s) return;
    if (this.taskProgress(t) < t.need) return;
    if (t.kind === 'gather') C.removeItem(g.hero, t.target, t.need);
    s.contrib += Math.round(t.reward); s.done++;
    const msgs: C.Msg[] = []; C.gainExp(g.hero, C.need(g.hero) * C.INSIGHT * t.exp, msgs);
    s.tasks = s.tasks.filter((x) => x !== t);
    g.toast(`任务完成：贡献 +${Math.round(t.reward)}`, 'good');
    if (!s.tasks.length) this.refreshTasks();
  }
  promoteReq(): { ok: boolean; why: string } {
    const g = this.game, s = g.ws.sect; if (!s) return { ok: false, why: '' };
    const r = s.rank + 1; if (r >= SECT_RANKS.length) return { ok: false, why: '已是最高' };
    if (s.contrib + s.done * 0 < SECT_RANK_NEED[r] && totalContrib(s) < SECT_RANK_NEED[r]) return { ok: false, why: `累计贡献需 ${SECT_RANK_NEED[r]}` };
    if (g.hero.realm < SECT_RANK_REALM[r]) return { ok: false, why: `需${REALMS[SECT_RANK_REALM[r]].name}期` };
    return { ok: true, why: '' };
  }
  promote() { const g = this.game, s = g.ws.sect; if (!s || !this.promoteReq().ok) return; s.rank++; g.toast(`晋升为${LOC_BY_ID.get(s.id)?.name}${SECT_RANKS[s.rank]}！`, 'good'); g.news(`韩立晋升${LOC_BY_ID.get(s.id)?.name}${SECT_RANKS[s.rank]}。`, 'personal'); }
  library(l: LocDef): Shop {
    const g = this.game, s = g.ws.sect!;
    const ids = new Set<string>((SECT_LIB[l.id] ?? []).filter((id) => !canonOwned(id)));
    const h = g.hero;
    // 第三十七步：别派秘传不会出现在本宗藏经阁
    const pool = ITEM_LIST.filter((it) => it.type === 'scroll' && it.tier <= 1 + s.rank && it.price > 0 && sectCanOffer(it, l.id));
    const rnd = mulberry32(l.x * 7 + Math.floor(g.day / 180));
    for (let i = 0; i < 6 && pool.length; i++) ids.add(pool[Math.floor(rnd() * pool.length)].id);
    const stock: ShopStock[] = [...ids].filter((id) => itemDef(id).name !== id && !h.arts.some((a) => 'scroll_art_' + a.id === id)).map((id) => ({ id, price: Math.max(20, Math.round(itemDef(id).price / 6)), n: 1 }));
    stock.push({ id: 'pill_juqi', price: 15, n: 9 }, { id: 'pill_huiqi', price: 8, n: 9 }, { id: 'pill_liaoshang', price: 10, n: 9 });
    if (s.rank >= 1) stock.push({ id: 'pill_zhuji', price: 900, n: 1 });
    if (s.rank >= 3) stock.push({ id: 'pill_jiangchen', price: 6000, n: 1 });
    return { title: `${l.name} · 藏经阁 / 丹房`, desc: '以宗门贡献兑换', stock, sellRate: 0, currency: 'contrib', noSell: true };
  }
  sectNode(l: LocDef): DNode {
    const g = this.game, s = g.ws.sect;
    if (!s || s.id !== l.id) {
      const r = this.joinReq(l);
      return { speaker: `${l.name} · 山门`, title: DEMON.has(l.id) ? '魔道宗门' : '正道宗门', text: `${l.desc}\n\n${r.ok ? '执事弟子打量着你：「可是来拜山的？」' : `执事弟子拦住了你：「${r.why}。」`}`, options: [{ label: '拜入山门', disabled: !r.ok, hint: r.why, act: () => { this.join(l); return this.sectNode(l); } }, { label: '离开', act: () => null }] };
    }
    const pay = this.pay();
    const pr = this.promoteReq();
    const lines = [`身份：${SECT_RANKS[s.rank]}　贡献：${s.contrib}　已完成任务：${s.done}`, pay ? `领取俸禄 ${pay} 灵石。` : '本月俸禄已领。'];
    const opts: DOpt[] = [];
    if (!s.tasks.length || s.tasks.every((t) => t.until < g.day)) this.refreshTasks();
    for (const t of s.tasks) { const p = this.taskProgress(t); opts.push({ label: `${p >= t.need ? '✔ 交付' : '任务'}：${t.text}（${p}/${t.need}）　+${Math.round(t.reward)} 贡献`, tone: p >= t.need ? 'good' : undefined, disabled: p < t.need, act: () => { this.turnIn(t); return this.sectNode(l); } }); }
    opts.push({ label: '藏经阁 / 丹房（贡献兑换）', act: () => { g.openShop(this.library(l)); return null; } });
    opts.push({ label: `晋升${SECT_RANKS[s.rank + 1] ?? ''}`, disabled: !pr.ok, hint: pr.why, act: () => { this.promote(); return this.sectNode(l); } });
    opts.push({ label: '叛出宗门', tone: 'bad', act: () => ({ speaker: '心念', text: '叛出宗门，同门必视你为仇寇，此宗永不再收你。确定吗？', options: [{ label: '确定', tone: 'bad', act: () => { this.leave(); return null; } }, { label: '再想想', act: () => this.sectNode(l) }] }) });
    opts.push({ label: '离开', act: () => null });
    return { speaker: `${l.name}`, title: `${SECT_RANKS[s.rank]}`, text: lines.join('\n'), options: opts };
  }
}
function totalContrib(s: { contrib: number; done: number }) { return s.contrib + s.done * 40; }
