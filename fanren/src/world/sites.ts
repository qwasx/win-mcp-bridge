// 第十八步：地图机缘 —— 每一片山野都藏着值得停下来的东西
// - 按格子哈希固定生成（每图不同），只在神识之内显现；见过的会记在地图上
// - 药王（沉睡守兽）、修士遗骸、前人洞府（三重禁制）、妖兽巢穴（灵卵）、小灵脉（可辟洞府）、
//   古碑、山神庙、寒潭灵池、古战场遗骨；残图指向的藏宝处
// - 档位（0–4）取自所在处的危险度：越险的地方，机缘越大，守护也越凶
import type { Game } from './game';
import { threatRealm } from './demog';
import { canonOwned } from '../data/market';
import { hash2 } from '../core/rng';
import { ACTIVE_MAP, WORLD_W, WORLD_H } from '../data/world';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import { rollAffix } from './affix';
import * as C from './cultivation';
import { ITEM_LIST, itemDef } from '../data/items';
import { REALMS, realmName } from '../data/realms';
import type { DNode, DOpt } from './modal';
import type { SiteState, CacheState } from './worldstate';
import { CharState, drawCharacter, randomLook, Look } from '../gfx/character';
import { drawBld } from '../gfx/bldTex2';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const seeded = (seed: number) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export const SITE_CELL = 2150;
export type SiteKind = 'herbking' | 'corpse' | 'ruin' | 'nest' | 'vein' | 'stele' | 'shrine' | 'pool' | 'bones';
export interface Site { key: string; kind: SiteKind; x: number; y: number; tier: number; seed: number; zone: string; region: string }

export const SITE_NAME: Record<SiteKind, string> = { herbking: '药王', corpse: '遗骸', ruin: '洞府', nest: '兽巢', vein: '灵脉', stele: '古碑', shrine: '山神庙', pool: '寒潭', bones: '古战场' };
export const SITE_GLYPH: Record<SiteKind, string> = { herbking: '药', corpse: '骸', ruin: '府', nest: '巢', vein: '脉', stele: '碑', shrine: '庙', pool: '潭', bones: '骨' };
export const SITE_COLOR: Record<SiteKind, string> = { herbking: '#8fe08a', corpse: '#c8b89a', ruin: '#8fd0ff', nest: '#f0b070', vein: '#7fe8d8', stele: '#d8d0b8', shrine: '#ff9a7a', pool: '#a8d8ff', bones: '#c8a0ff' };
const MAP_SALT: Record<string, number> = { tiannan: 0, luanxing: 7717, dajin: 15431 };
const HERB_SHAPE: Record<string, 'mush' | 'lotus' | 'fruit' | 'flower' | 'blade' | 'shen'> = {
  herb_lingzhi: 'mush', herb_xuelian: 'lotus', herb_tianling: 'fruit', herb_huolong: 'fruit', herb_zihou: 'flower', herb_nichang: 'flower',
  herb_bingpo: 'blade', herb_xuejing: 'blade', herb_jinxin: 'blade', herb_huangjing: 'blade', herb_jiuqu: 'shen', herb_yangshen: 'shen',
};
export const HERB_COL: Record<string, string> = {
  herb_lingzhi: '200,60,50', herb_xuelian: '235,245,255', herb_tianling: '255,210,90', herb_huolong: '255,90,50', herb_zihou: '190,110,230', herb_nichang: '255,170,220',
  herb_bingpo: '150,220,255', herb_xuejing: '220,40,60', herb_jinxin: '255,220,120', herb_huangjing: '220,210,120', herb_jiuqu: '255,120,90', herb_yangshen: '250,250,235',
};
const RUIN_OWNER = ['青阳', '玄机', '天枢', '紫霄', '赤松', '白石', '云崖', '寒山', '落霞', '无尘', '洞玄', '归一', '摩云', '九幽', '太乙'];
const RUIN_TITLE = ['子', '上人', '真人', '散人', '老祖', '居士'];
const LAYER_NAME = ['外层幻阵', '中层五行禁', '内层杀阵'];
const PARTNER_PERS: { id: string; name: string; fair: number; line: string }[] = [
  { id: 'kind', name: '温厚', fair: 0.95, line: '道友，这禁制一人难破，不如联手？所得平分便是。' },
  { id: 'righteous', name: '端方', fair: 0.9, line: '在下发现此处已有半日，独力难支。道友若肯相助，宝物见者有份。' },
  { id: 'cautious', name: '谨慎', fair: 0.75, line: '（他打量你良久）……罢了，这禁制我破不开。联手，事后各取所需，如何？' },
  { id: 'greedy', name: '贪婪', fair: 0.35, line: '嘿嘿，道友来得巧。咱们一起破了它，宝贝……好说，好说。' },
  { id: 'ruthless', name: '阴狠', fair: 0.2, line: '（他笑得和气，眼底却没有笑意）道友，搭把手？' },
];
const STELE_LORE = [
  '「……余以三百年苦修，终不敌天劫。后来者见此碑，当知长生之路，一步一血。」',
  '「某年某月，七派与魔道战于此，死者三千。青山无言，白骨为碑。」',
  '「剑者，心之刃也。心不动，剑不出；剑出，则不回。」——落款已被风雨磨去。',
  '「此地灵脉已枯，余迁居东海。若有缘人至，石下有薄礼一份。」',
  '「天地不仁，以万物为刍狗。修士逆天，当先逆己。」',
  '「我于此地斩妖蛟一头，其丹赠我徒，其骨埋于此。」',
];
const CORPSE_FLAVOR = [
  { name: '散修遗骸', text: '一具散修的遗骸伏在乱石间，衣衫褴褛，腰间储物袋上的禁制早已溃散。看伤口，是被妖兽所杀。' },
  { name: '宗门弟子遗骸', text: '遗骸身着某派弟子服饰，胸口一个焦黑的掌印。他死前似乎还想捏碎什么——掌心攥着半张传音符。' },
  { name: '魔修遗骸', text: '遗骸周身缠着未散的血煞之气，指骨上套着一枚骷髅戒。这样的人，储物袋里怕不会干净。' },
  { name: '古修坐化处', text: '一具枯骨盘膝而坐，衣袍一碰即化为飞灰。不知坐化了多少年，身前的玉匣却依旧灵光隐隐。' },
];

export class SiteSys {
  game: Game;
  focus: Site | CacheState | null = null;
  focusD = 1e9;
  private cache = new Map<string, Site | null>();
  private guards = new Map<string, Enemy[]>();
  private scanT = 0;
  private looks = new Map<string, { look: Look; st: CharState }>();
  private salt = MAP_SALT[ACTIVE_MAP] ?? 0;
  constructor(g: Game) { this.game = g; }

  // ------------------------------------------------------------ 生成
  private gen(cx: number, cy: number): Site | null {
    const key = cx + ',' + cy;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const S = this.salt;
    const h0 = hash2(cx, cy, 1301 + S), h1 = hash2(cx, cy, 1302 + S), h2 = hash2(cx, cy, 1303 + S), h3 = hash2(cx, cy, 1304 + S);
    let site: Site | null = null;
    const x = (cx + 0.18 + h1 * 0.64) * SITE_CELL, y = (cy + 0.18 + h2 * 0.64) * SITE_CELL;
    const T = this.game.terrain;
    if (h0 < 0.46 && x > 400 && y > 400 && x < WORLD_W - 400 && y < WORLD_H - 400 && T.isLand(x, y) && T.walkFactor(x, y) > 0.3 && !T.inLocZone(x, y, 380) && !T.onRoad(x, y)) {
      const s = T.sample(x, y);
      const dz = this.game.combat.dangerCalc(x, y);
      const tier = clamp(Math.round(dz.d * 0.95), 0, 4);
      const w: [SiteKind, number][] = [
        ['herbking', 20 + (s.forest > 0.45 ? 10 : 0) + (s.cold > 0.5 ? 6 : 0)],
        ['corpse', 14 + (dz.d > 1.5 ? 8 : 0)],
        ['ruin', 10 + (s.elev > 0.3 ? 8 : 0)],
        ['nest', 9 + (s.forest > 0.4 ? 4 : 0)],
        ['vein', 7 + (s.elev > 0.3 ? 2 : 0)],
        ['stele', 8],
        ['shrine', dz.d < 1.6 ? 8 : 1],
        ['pool', 7 + (s.cold > 0.5 ? 8 : 0)],
        ['bones', dz.d >= 1.2 ? 9 : 2],
      ];
      const tot = w.reduce((a, b) => a + b[1], 0);
      let r = h3 * tot, kind: SiteKind = 'herbking';
      for (const [k, v] of w) { r -= v; if (r <= 0) { kind = k; break; } }
      site = { key, kind, x, y, tier, seed: (Math.floor(hash2(cx, cy, 1305 + S) * 1e9) >>> 0), zone: dz.zone, region: dz.region };
    }
    this.cache.set(key, site);
    if (this.cache.size > 3000) this.cache.clear();
    return site;
  }
  inRect(x0: number, y0: number, x1: number, y1: number): Site[] {
    const out: Site[] = [];
    for (let cy = Math.floor(y0 / SITE_CELL); cy <= Math.floor(y1 / SITE_CELL); cy++)
      for (let cx = Math.floor(x0 / SITE_CELL); cx <= Math.floor(x1 / SITE_CELL); cx++) { const s = this.gen(cx, cy); if (s) out.push(s); }
    return out;
  }
  /** 存档里的状态（键含地图名） */
  st(s: Site, create = true): SiteState {
    const ws = this.game.ws; ws.sites ??= {};
    const k = ACTIVE_MAP + '|' + s.key;
    let v = ws.sites[k];
    if (!v && create) v = ws.sites[k] = {};
    return v ?? {};
  }
  available(s: Site): boolean {
    const v = this.game.ws.sites?.[ACTIVE_MAP + '|' + s.key];
    if (!v) return true;
    if (s.kind === 'stele') return !v.read;
    if (s.kind === 'vein' || s.kind === 'shrine' || s.kind === 'pool') return true;   // 常驻之地
    return v.done === undefined || this.game.day >= v.done;
  }
  name(s: Site): string {
    if (s.kind === 'ruin') { const r = seeded(s.seed); return RUIN_OWNER[Math.floor(r() * RUIN_OWNER.length)] + RUIN_TITLE[Math.floor(r() * RUIN_TITLE.length)] + '洞府'; }
    if (s.kind === 'pool') return s.zone === 'cold' ? '寒潭' : (s.seed % 2 ? '灵池' : '碧潭');
    if (s.kind === 'herbking') return itemDef(this.herbOf(s)).name + '王';
    return SITE_NAME[s.kind];
  }
  /** 药王的品种（固定于此地）与年份（每轮重生不同） */
  herbOf(s: Site): string {
    const r = seeded(s.seed ^ 0x5bd1);
    const t = s.tier, z = s.zone, k = r();
    if (t <= 0) return z === 'cold' ? 'herb_xuelian' : k < 0.4 ? 'herb_lingzhi' : k < 0.7 ? 'herb_zihou' : k < 0.9 ? 'herb_tianling' : 'herb_nichang';
    if (t === 1) return z === 'cold' ? (k < 0.5 ? 'herb_xuelian' : 'herb_bingpo') : k < 0.35 ? 'herb_zihou' : k < 0.7 ? 'herb_tianling' : k < 0.85 ? 'herb_nichang' : 'herb_lingzhi';
    if (t === 2) return z === 'cold' ? 'herb_bingpo' : z === 'arid' ? 'herb_huolong' : z === 'demon' ? 'herb_xuejing' : k < 0.35 ? 'herb_huolong' : k < 0.6 ? 'herb_tianling' : k < 0.8 ? 'herb_bingpo' : 'herb_xuejing';
    if (t === 3) return k < 0.3 ? 'herb_xuejing' : k < 0.6 ? 'herb_huolong' : k < 0.85 ? 'herb_yangshen' : 'herb_jiuqu';
    return k < 0.5 ? 'herb_jiuqu' : 'herb_yangshen';
  }
  herbAge(s: Site): number {
    const v = this.st(s, false);
    const r = seeded(s.seed + (v.gen ?? 0) * 977);
    const base = [80, 140, 240, 420, 700][s.tier];
    return Math.round(base * (0.8 + r() * 0.9));
  }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game, p = g.player;
    this.nestTick();
    this.scanT -= dt; if (this.scanT > 0) return; this.scanT = 0.2;
    const R = g.senseRadius;
    this.focus = null; this.focusD = 1e9; let best = 210;
    const near = this.inRect(p.x - R * 1.3, p.y - R * 1.3, p.x + R * 1.3, p.y + R * 1.3);
    for (const s of near) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      const avail = this.available(s);
      if (d < R * 0.95 && avail) {
        const v = this.st(s, false);
        if (!v.seen) { this.st(s).seen = 1; g.toast(this.seenText(s), s.kind === 'bones' || s.kind === 'nest' ? 'warn' : 'info'); g.hint('site', '神识所及，山野间的「机缘」会显现出来——走近按 T 查看。见过的机缘会标在地图上（M）。'); }
      }
      if (d < best && (avail || s.kind === 'stele')) { best = d; this.focus = s; this.focusD = d; }
      if (avail && d < R * 1.2 && (s.kind === 'herbking' || s.kind === 'nest' || s.kind === 'bones')) this.ensureGuard(s);
    }
    for (const c of g.ws.caches ?? []) {
      if (c.done || c.map !== ACTIVE_MAP) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < best) { best = d; this.focus = c; this.focusD = d; }
      if (d < R * 0.6 && !(c as any).found) { (c as any).found = 1; g.toast('神识中：地下有灵光微闪——残图所指的藏宝处就在这里！', 'good'); }
    }
    // 守兽：远离后收起；阵亡则记下
    for (const [k, list] of this.guards) {
      const alive = list.filter((e) => !e.dead && g.combat.enemies.includes(e));
      if (!alive.length) {
        if (list.some((e) => e.dead)) this.onGuardsDown(k);
        this.guards.delete(k); continue;
      }
      if (alive.every((e) => !e.aggro && Math.hypot(e.x - p.x, e.y - p.y) > R * 2 + 1400)) {
        g.combat.enemies = g.combat.enemies.filter((e) => !alive.includes(e)); this.guards.delete(k);
      }
    }
  }
  private seenText(s: Site) {
    switch (s.kind) {
      case 'herbking': return `神识中：浓郁的药香扑面而来——一株${itemDef(this.herbOf(s)).name}，旁边卧着守护它的妖兽。`;
      case 'corpse': return '神识中：一具修士遗骸倒在乱石间，储物袋还挂在腰上。';
      case 'ruin': return `神识中：山壁上禁制灵光流转——${this.name(s)}！`;
      case 'nest': return '神识中：一处妖兽巢穴，巢中隐约卧着几枚灵卵。';
      case 'vein': return '神识中：地底灵气汩汩上涌——一条小灵脉，是开辟洞府的好地方。';
      case 'stele': return '神识中：荒草间立着一块古碑，碑文隐有灵光。';
      case 'shrine': return '神识中：路旁一座小小的山神庙，香火未绝。';
      case 'pool': return `神识中：一汪${this.name(s)}，潭底似有宝光一闪。`;
      case 'bones': return '神识中：阴风阵阵——一片古战场遗骨，阴魂不散。';
    }
  }

  // ------------------------------------------------------------ 守护
  private ensureGuard(s: Site) {
    const g = this.game, k = s.key;
    if (this.guards.has(k)) return;
    const v = this.st(s, false);
    if (v.gd !== undefined && v.gd >= (v.gen ?? 0)) return;     // 本轮守兽已除
    const list: Enemy[] = [];
    if (s.kind === 'herbking' || s.kind === 'nest') {
      const rb = g.combat.rollBeast(s.x, s.y, s.kind === 'herbking' ? 0.7 : 0.4, { noFlee: true, flying: s.kind === 'nest' && s.seed % 3 === 0 ? true : undefined });
      if (!rb) return;
      const e = new Enemy(rb.def, s.x + (s.kind === 'herbking' ? 80 : 0), s.y + (s.kind === 'herbking' ? 26 : 0), rb.realm, rb.stage);
      e.name = rb.def.name + (s.kind === 'herbking' ? '·守药' : '·护巢');
      e.boss = true; e.maxHp = e.hp = Math.round(e.hp * (s.kind === 'herbking' ? 2.2 : 1.8));
      rollAffix(e, g.combat.dangerAt(s.x, s.y).k, 1);
      e.hx = s.x; e.hy = s.y; e.tag = 'site:' + k;
      if (s.kind === 'herbking') { e.sleep = true; e.facing = -1; }
      list.push(e);
      if (s.kind === 'nest') { const sv = this.st(s); sv.egg = this.eggFor(rb.def); sv.mother = rb.def.name; }
    } else if (s.kind === 'bones') {
      const n = 2 + (s.seed % 2) + (s.tier >= 3 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const id = s.tier >= 3 && i === 0 ? 'guijiang' : s.zone === 'cold' && ENEMIES.hanmei ? 'hanmei' : 'yinhun';
        const def = ENEMIES[id] ?? ENEMIES.yinhun; if (!def) continue;
        const rb = g.combat.rollBeast(s.x, s.y, 0.6);
        const realm = rb ? rb.realm : Math.max(1, s.tier), stage = rb ? rb.stage : 2;
        const an = (i / n) * TAU;
        const e = new Enemy(def, s.x + Math.cos(an) * 110, s.y + Math.sin(an) * 70, realm, stage);
        e.name = i === 0 && s.tier >= 3 ? '古战场鬼将' : '不散阴魂'; e.hx = s.x; e.hy = s.y; e.tag = 'site:' + k;
        list.push(e);
      }
    }
    for (const e of list) g.combat.enemies.push(e);
    this.guards.set(k, list);
  }
  private eggFor(def: { kind: string; flying?: boolean; look?: any; id: string }): string {
    const body = String(def.look?.body ?? def.look?.kind ?? '');
    if (def.flying) return 'egg_yunchi';
    if (/fox/.test(body) || def.id === 'fox') return 'egg_huli';
    if (/snake|jiao|serpent|croc|dragon/.test(body + def.id)) return 'egg_jiao';
    if (def.kind === 'insect' || /insect|spider|centipede|scorp|bug/.test(body)) return 'insect';
    return 'egg_wolf';
  }
  private onGuardsDown(k: string) {
    const g = this.game;
    const [cx, cy] = k.split(',').map(Number);
    const s = this.gen(cx, cy); if (!s) return;
    const v = this.st(s); v.gd = v.gen ?? 0;
    if (s.kind === 'herbking') g.toast(`守药妖兽伏诛——${itemDef(this.herbOf(s)).name}再无人看守。`, 'good');
    if (s.kind === 'nest') g.toast('护巢母兽已除，巢中灵卵任你取用。', 'good');
    if (s.kind === 'bones') { g.toast('阴魂尽散，古战场重归寂静。上前收敛遗骨吧。', 'good'); g.ws.rep = clamp(g.ws.rep + 1, -100, 100); }
  }
  guardOf(s: Site): Enemy | null { const l = this.guards.get(s.key); return l?.find((e) => !e.dead && this.game.combat.enemies.includes(e)) ?? null; }
  /** 护巢母兽每隔一阵外出觅食（约 80 秒一轮，离巢 30 秒） */
  private nestTick() {
    const g = this.game;
    for (const [k, list] of this.guards) {
      const e = list[0]; if (!e || e.dead || !e.tag || e.aggro) continue;
      if (!e.name.endsWith('护巢')) continue;
      const [cx, cy] = k.split(',').map(Number); const s = this.gen(cx, cy); if (!s) continue;
      const ph = (g.time + (s.seed % 80)) % 80;
      const away = ph > 42 && ph < 72;
      const a = (s.seed % 628) / 100;
      e.hx = away ? s.x + Math.cos(a) * 1500 : s.x; e.hy = away ? s.y + Math.sin(a) * 1000 : s.y;
      (e as any).away = Math.hypot(e.x - s.x, e.y - s.y) > 520;
    }
  }

  // ------------------------------------------------------------ 交互
  interact(): boolean {
    const f = this.focus; if (!f) return false;
    if ('kind' in f) return this.interactSite(f);
    return this.interactCache(f);
  }
  private close(text: string, title = '机缘', mood?: DNode['mood']): DNode { return { speaker: title, text, options: [{ label: '好', act: () => null }], mood }; }
  private interactSite(s: Site): boolean {
    const g = this.game;
    switch (s.kind) {
      case 'herbking': g.openDialog(this.herbNode(s)); return true;
      case 'corpse': g.openDialog(this.corpseNode(s)); return true;
      case 'ruin': g.openDialog(this.ruinNode(s)); return true;
      case 'nest': g.openDialog(this.nestNode(s)); return true;
      case 'vein': g.openDialog(this.veinNode(s)); return true;
      case 'stele': g.openDialog(this.steleNode(s)); return true;
      case 'shrine': g.openDialog(this.shrineNode(s)); return true;
      case 'pool': g.openDialog(this.poolNode(s)); return true;
      case 'bones': g.openDialog(this.bonesNode(s)); return true;
    }
    return false;
  }
  private respawn(s: Site, days: number) { const v = this.st(s); v.done = this.game.day + days; v.gen = (v.gen ?? 0) + 1; }

  // 药王
  private herbNode(s: Site): DNode {
    const g = this.game, h = g.hero;
    const id = this.herbOf(s), it = itemDef(id);
    const night = g.night > 0.5;
    const bless = g.day < g.ws.blessUntil;
    const age = Math.round(this.herbAge(s) * (night ? 1.2 : 1) * (bless ? 1.15 : 1));
    const guard = this.guardOf(s);
    const take = (how: string): DNode => {
      C.addItem(h, id, 1, age); h.stats.gathered++;
      let extra = '';
      if (Math.random() < 0.3 + s.tier * 0.08) { const n2 = rint(1, 2); C.addItem(h, id, n2, Math.round(age * 0.35)); extra += `\n根旁还生着 ${n2} 株${Math.round(age * 0.35)}年的幼株，一并收下。`; }
      if (s.tier >= 2 && Math.random() < 0.15) { C.addItem(h, 'item_yuanqi', 1); extra += '\n药根之下，竟凝着一块天地元气晶！'; }
      this.respawn(s, 360 * (3 + (s.seed % 4)));
      g.news(`韩立采得${age}年${it.name}。`, 'personal');
      g.pursuit.maybe('药香未散，有人循着味道追来了', 0.12 + s.tier * 0.05, 0);
      return this.close(`${how}\n\n获得：${age}年的${it.name}${night ? '（子夜药力最盛，年份更足）' : ''}${extra}`, it.name + '王', 'mystic');
    };
    const desc = `一株${it.name}生在${s.zone === 'cold' ? '冰崖' : s.zone === 'arid' ? '赤岩' : '古木'}之下，叶脉间灵光流转，少说也有${age}年火候。${night ? '\n（子夜时分，药力正盛）' : ''}`;
    if (!guard) {
      return { speaker: it.name + '王', title: `约${age}年`, text: desc + '\n\n四下已无守护——', mood: 'mystic', options: [
        { label: '小心采下', tone: 'gold', act: () => (id === 'herb_jiuqu' && !g.concealed && Math.random() < 0.35 ? (this.respawn(s, 360 * 2), this.close('你的手刚碰到参须，九曲灵参竟化作一道白光，钻入地底不见了！\n\n（灵参通灵，下次记得敛息再采）', '灵参遁地')) : take('你屏住呼吸，连根带土将灵药起出，以玉盒封好。')) },
        { label: '离开', act: () => null },
      ] };
    }
    const gap = guard.realm - h.realm;
    const asleep = !!guard.sleep;
    const ch = clamp(0.78 - Math.max(0, gap) * 0.22 + (night ? 0.08 : 0) - s.tier * 0.04 + (C.mod(h, 'luck' as any) ?? 0) * 0.3, 0.12, 0.92);
    const opts: DOpt[] = [];
    if (asleep) {
      opts.push({ label: `敛息潜近，摘了就走（把握约 ${Math.round(ch * 100)}%）`, tone: 'gold', disabled: !g.concealed, hint: g.concealed ? '失手则守兽惊醒，先挨一击' : '需先按 R 敛息', act: () => {
        if (Math.random() < ch) return take(`你收敛全部气息，一寸一寸挪到药前。${guard.name}的鼻息就喷在你脚边……指尖一掐，灵药入手。它翻了个身，没有醒。`);
        guard.sleep = false; guard.aggro = true;
        h.hp = Math.max(0.05, h.hp - 0.18 - Math.max(0, gap) * 0.12);
        g.juice(0.1, 0.6);
        return this.close(`就在指尖触到叶片的一刹那，${guard.name}猛地睁开了眼睛！\n\n利爪带着腥风扑面而来——`, '惊醒', 'danger');
      } });
      opts.push({ label: '趁它熟睡，先下杀手', tone: 'bad', hint: '首击伤害×2.5（偷袭）', act: () => { g.toast(`${guard.name}睡得正沉——出手吧，第一击有偷袭加成。`, 'info'); return null; } });
    } else opts.push({ label: '守兽已醒，先战再说', tone: 'bad', act: () => null });
    opts.push({ label: '离开', act: () => null });
    return { speaker: it.name + '王', title: `约${age}年 · ${guard.name}（${realmName(guard.realm, guard.stage)}）`, text: desc + `\n\n${guard.name}${asleep ? '盘卧在旁，鼻息沉沉，正在酣睡。' : '已经醒了，正死死盯着你。'}${gap > 0 ? '\n\n（它的境界高过你——硬拼九死一生）' : ''}`, mood: gap > 0 ? 'danger' : 'mystic', options: opts };
  }

  // 修士遗骸
  private corpseNode(s: Site): DNode {
    const g = this.game, h = g.hero;
    const fl = CORPSE_FLAVOR[s.tier >= 2 && s.seed % 4 === 3 ? 3 : s.seed % 3];
    const evil = fl.name === '魔修遗骸', ancient = fl.name === '古修坐化处';
    const finish = () => { const v = this.st(s); v.done = 1e9; };
    return { speaker: fl.name, title: SITE_NAME.corpse, text: fl.text, mood: ancient ? 'mystic' : undefined, options: [
      { label: '直接搜检储物袋', act: () => {
        finish();
        const trap = Math.random() < (evil ? 0.35 : ancient ? 0.3 : 0.12);
        const got = loot(g, s.tier, ancient ? 1.8 : 1, { scroll: ancient ? 0.45 : 0.2, art: ancient ? 0.3 : 0.06, map: 0.18 });
        if (trap) {
          if (ancient || Math.random() < 0.5) {
            const def = ENEMIES.yinhun; const rb = g.combat.rollBeast(s.x, s.y, 0.8);
            const e = new Enemy(def, s.x, s.y - 40, rb?.realm ?? Math.max(1, s.tier), rb?.stage ?? 3); e.name = ancient ? '坐化修士残魂' : '怨魂'; e.aggro = true; e.boss = ancient; if (ancient) e.maxHp = e.hp = Math.round(e.hp * 1.6);
            g.combat.enemies.push(e);
            return this.close(`储物袋入手的一瞬，一缕阴冷的残魂从骸骨中尖啸而出——「谁敢动我遗物！」\n\n获得：${got.join('、')}`, '残魂', 'danger');
          }
          h.hp = Math.max(0.05, h.hp - 0.22);
          return this.close(`储物袋上残留的血毒禁制猛然爆开，一股腥气钻进你的经脉！\n\n获得：${got.join('、')}`, '血毒', 'danger');
        }
        return this.close(`你解开储物袋。\n\n获得：${got.join('、')}`, fl.name);
      } },
      { label: '掩埋尸骨，再取遗物（耗一日）', tone: 'good', act: () => {
        finish(); g.passDays(1);
        g.ws.rep = clamp(g.ws.rep + 2, -100, 100);
        const got = loot(g, s.tier, ancient ? 1.6 : 0.9, { scroll: ancient ? 0.4 : 0.18, art: ancient ? 0.25 : 0.05, map: 0.2 });
        let extra = '';
        const r = Math.random();
        if (r < 0.22) { const m: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * (0.03 + s.tier * 0.01), m); extra = '\n\n坟土落定的一刻，一缕微光没入你眉心——是死者残存的感悟。（修为小涨）'; }
        else if (r < 0.4) { const t = this.revealNear(s.x, s.y, 9000); if (t) extra = `\n\n他怀里揣着一张手绘的地图，上面圈着「${this.name(t)}」。（地图上已标出）`; }
        return this.close(`你掘土成坑，将遗骸葬下，立了块无字木牌。\n\n获得：${got.join('、')}${extra}\n\n（正道声望 +2）`, '入土为安');
      } },
      { label: '离开', act: () => null },
    ] };
  }

  // 前人洞府：三重禁制
  private ruinNode(s: Site): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const layer = v.layer ?? 0, name = this.name(s);
    if (layer >= 3) return this.close(`${name}早已被你搜刮一空，只剩满室尘埃。`, name);
    // 同行者：首次进入时 30% 有一位修士在门口
    if (v.partner === undefined) {
      v.partner = Math.random() < 0.32 ? 1 : 0;
      if (v.partner) { const pr = PARTNER_PERS[Math.floor(Math.random() * PARTNER_PERS.length)]; v.pp = pr.id; v.pr = clamp(h.realm + (Math.random() < 0.3 ? 1 : 0) - (Math.random() < 0.3 ? 1 : 0), 1, 4); v.pn = pick(['孙', '钱', '吴', '郑', '冯', '陈', '褚', '卫', '蒋', '沈']) + pick(['不二', '天元', '青松', '守拙', '玄', '广', '一鸣', '道然', '平', '无忌']); }
    }
    const pr = PARTNER_PERS.find((p0) => p0.id === v.pp);
    if (v.partner === 1 && pr) {
      const pl = this.partnerLook(s);
      return { speaker: v.pn, title: `${realmName(v.pr, 2)} · ${pr.name}`, look: pl.look, text: `（洞府前站着一位修士，见你到来，手按储物袋，又慢慢松开）\n\n${pr.line}`, options: [
        { label: '联手破禁', tone: 'good', act: () => { v.partner = 2; return this.ruinNode(s); } },
        { label: '婉拒，各凭本事', act: () => {
          v.partner = 0;
          if (pr.id === 'ruthless' && Math.random() < 0.6) { this.partnerTurns(s, '既然不肯，那就别怪我先下手了！'); return null; }
          return this.close(`${v.pn}冷哼一声，化作遁光离去。`, v.pn);
        } },
        { label: '先下手为强（偷袭）', tone: 'bad', act: () => { v.partner = 0; g.ws.rep = clamp(g.ws.rep - 4, -100, 100); this.partnerTurns(s, '卑鄙小人！'); return null; } },
      ] };
    }
    const withP = v.partner === 2;
    const strong = clamp(0.32 + (h.realm - s.tier * 0.75) * 0.2 - layer * 0.08 + (withP ? 0.2 : 0) + (h.gongfa === 'dayan' ? 0.1 : 0), 0.08, 0.92);
    const senseCh = clamp(0.2 + g.baseSenseRadius / (750 + s.tier * 520) * 0.42 - layer * 0.07 + (withP ? 0.1 : 0) + (h.gongfa === 'dayan' ? 0.15 : 0), 0.08, 0.9);
    const talCh = s.tier <= h.realm + 1 ? 0.95 : 0.65;
    const mpCost = 0.3 + layer * 0.05;
    const hasTal = C.bagCount(h, 'tal_pojin') > 0;
    const run = (ok: boolean, how: 'strong' | 'sense' | 'tal'): DNode => {
      if (!ok) {
        if (how === 'sense') { h.hp = Math.max(0.05, h.hp - 0.15); return this.close(`神识探入禁制深处，那缝隙竟是个陷阱——一股反噬之力顺着神识倒灌而回！\n\n（气血受损，禁制未破，可再试）`, '神识反噬', 'danger'); }
        h.hp = Math.max(0.05, h.hp - 0.18 - layer * 0.05);
        if (Math.random() < 0.55) {
          const rb = g.combat.rollBeast(s.x, s.y, 0.6 + layer * 0.3);
          const def = layer >= 2 ? ENEMIES.guijiang ?? ENEMIES.yinhun : ENEMIES.yinhun;
          const e = new Enemy(def, s.x + rand(-60, 60), s.y + 40, rb?.realm ?? Math.max(1, s.tier), rb?.stage ?? 2); e.name = `${name}守护${layer >= 2 ? '傀儡' : '残魂'}`; e.aggro = true; e.boss = layer >= 2; if (layer >= 2) e.maxHp = e.hp = Math.round(e.hp * 1.8);
          g.combat.enemies.push(e);
          return this.close(`禁制反噬！${LAYER_NAME[layer]}光芒暴涨，一道杀光击中了你——\n\n石门后，有什么东西醒了。`, '禁制反噬', 'danger');
        }
        return this.close(`${LAYER_NAME[layer]}纹丝不动，反震之力震得你气血翻涌。`, '破禁失败', 'danger');
      }
      v.layer = layer + 1;
      const got = this.ruinLayerLoot(s, layer);
      const pLine = withP ? `\n\n${v.pn}在旁喝彩：「好手段！」` : '';
      if (v.layer >= 3) {
        g.news(`韩立破开${name}三重禁制，得其遗宝。`, 'personal');
        g.pursuit.maybe(`${name}宝光冲霄，引来了觊觎之人`, 0.2 + s.tier * 0.07, Math.random() < 0.6 ? 1 : 0);
        if (withP && pr) return this.partnerSplit(s, pr, got);
        return { speaker: name, title: '最后一重', text: `${LAYER_NAME[layer]}轰然溃散。石室最深处，一具枯骨端坐蒲团，膝上横着遗物，壁上刻着字：\n\n${pick(STELE_LORE)}\n\n获得：${got.join('、')}`, mood: 'mystic', options: [{ label: '向前辈遗骨一拜', act: () => { g.ws.rep = clamp(g.ws.rep + 1, -100, 100); return null; } }] };
      }
      return { speaker: name, title: `第${layer + 1}重禁制已破`, text: `${how === 'tal' ? '破禁符化作一道金光没入禁制，' : how === 'sense' ? '神识沿着禁制流转的间隙一寸寸探过去，找到了阵眼——' : '你催动法力狠狠撞上去，'}${LAYER_NAME[layer]}如水波般荡开。\n\n获得：${got.join('、')}${pLine}\n\n前方，${LAYER_NAME[layer + 1]}灵光森然。`, options: [{ label: '继续深入', tone: 'gold', act: () => this.ruinNode(s) }, { label: '先退出来（禁制不会复原）', act: () => null }] };
    };
    const opts: DOpt[] = [
      { label: `强行破禁（耗${Math.round(mpCost * 100)}%法力，约 ${Math.round(strong * 100)}%）`, disabled: h.mp < mpCost, hint: h.mp < mpCost ? '法力不足' : '失败会受伤，并可能惊动守护', act: () => { h.mp -= mpCost; return run(Math.random() < strong, 'strong'); } },
      { label: `神识寻隙（约 ${Math.round(senseCh * 100)}%）`, hint: '神识越强越稳；失败只伤气血', act: () => run(Math.random() < senseCh, 'sense') },
      { label: `以破禁符破之（约 ${Math.round(talCh * 100)}%）`, disabled: !hasTal, hint: hasTal ? `剩余 ${C.bagCount(h, 'tal_pojin')} 张` : '坊市有售', act: () => { C.removeItem(h, 'tal_pojin', 1); return run(Math.random() < talCh, 'tal'); } },
      { label: '离开', act: () => null },
    ];
    return { speaker: name, title: `第${layer + 1}/3重 · ${LAYER_NAME[layer]}`, text: `${layer === 0 ? `山壁上刻着模糊的篆文：「${name}」。` : ''}${['洞口笼着一层流转的幻光，看久了头晕目眩。', '石门上五色灵光交错，金木水火土五行禁制首尾相衔。', '甬道尽头杀气森然，地上散落着前人的白骨——他们没能走过这一重。'][layer]}${withP ? `\n\n${v.pn}与你并肩而立，随时准备出手相助。` : ''}`, mood: 'mystic', options: opts };
  }
  private ruinLayerLoot(s: Site, layer: number): string[] {
    const g = this.game, h = g.hero, out: string[] = [];
    const t = s.tier;
    if (layer === 0) {
      const ls = Math.round(rand(30, 60) * Math.pow(3, t)); C.addItem(h, 'mat_lingshi', ls); out.push(`灵石 ${ls}`);
      const pills = ITEM_LIST.filter((it) => it.type === 'pill' && it.price > 0 && it.tier <= t + 1 && it.tier >= Math.max(0, t - 1));
      if (pills.length) { const it = pick(pills); const n = rint(1, 3); C.addItem(h, it.id, n); out.push(`${it.name}×${n}`); }
    } else if (layer === 1) {
      const sk = g.combat.randomScroll(Math.min(4, t + 1));
      if (sk && Math.random() < 0.7) { C.addItem(h, sk, 1); out.push(itemDef(sk).name); }
      const mats = ITEM_LIST.filter((it) => it.type === 'material' && it.price > 0 && it.tier <= t + 1 && it.tier >= Math.max(1, t - 1) && it.id !== 'mat_lingshi' && !it.id.startsWith('tal_'));
      if (mats.length) { const it = pick(mats); const n = rint(1, 2); C.addItem(h, it.id, n); out.push(`${it.name}×${n}`); }
      if (Math.random() < 0.08 + t * 0.03) { const egg = t >= 3 && Math.random() < 0.3 ? 'egg_jiao' : pick(['egg_yunchi', 'egg_huli', 'egg_wolf']); C.addItem(h, egg, 1); g.pets?.onEgg(egg); out.push(itemDef(egg).name + '（封在玉匣中，竟还活着）'); g.pets?.onEgg(egg); }
    } else {
      const ls = Math.round(rand(60, 120) * Math.pow(3, t)); C.addItem(h, 'mat_lingshi', ls); out.push(`灵石 ${ls}`);
      const art = pickArt(t + 1, t >= 3 && Math.random() < 0.25);
      if (art) { C.addItem(h, art, 1); out.push(`【${itemDef(art).name}】`); g.juice(0.08, 0.5); }
      if (t >= 2 && Math.random() < 0.35) { C.addItem(h, 'mat_gubaocan', 1); out.push('古宝残片'); }
    }
    return out;
  }
  private partnerLook(s: Site) {
    let o = this.looks.get('p' + s.key);
    if (!o) { const r = seeded(s.seed ^ 0x9e37); o = { look: randomLook(r, 'cultivator'), st: new CharState(s.x - 120, s.y + 30) }; o.st.faceToward(1, 0.3); this.looks.set('p' + s.key, o); }
    return o;
  }
  private partnerTurns(s: Site, line: string) {
    const g = this.game, v = this.st(s);
    const pl = this.partnerLook(s);
    const def = v.pr >= 2 ? ENEMIES.zhujixiu : ENEMIES.bandit;
    const e = new Enemy(def, s.x - 120, s.y + 30, v.pr ?? 1, rint(1, 4));
    e.name = v.pn ?? '修士'; e.look = pl.look; e.cs = new CharState(e.x, e.y); e.aggro = true; e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.5);
    g.combat.enemies.push(e);
    v.partner = 0;
    g.toast(`${v.pn}：「${line}」`, 'warn');
  }
  private partnerSplit(s: Site, pr: { id: string; fair: number }, got: string[]): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const pl = this.partnerLook(s);
    const name = this.name(s);
    const fair = Math.random() < pr.fair;
    v.partner = 0;
    if (!fair) {
      this.partnerTurns(s, '东西留下，人……也留下吧！');
      return this.close(`最后一重禁制溃散的一瞬，${v.pn}脸上的笑意忽然冷了下来。\n\n一道乌光直取你的后心——\n\n（你已拿到：${got.join('、')}。先活下来再说！）`, '翻脸', 'danger');
    }
    const lsGot = got.find((x) => x.startsWith('灵石')); const ls = lsGot ? parseInt(lsGot.slice(3)) : 0;
    return { speaker: v.pn, look: pl.look, title: '分宝', text: `禁制尽破。石室中遗宝罗列——\n\n${got.join('、')}\n\n${v.pn}拱手道：「道友出力最多，你先挑。」`, options: [
      { label: '灵石归他，宝物归我', tone: 'good', act: () => { if (ls) C.removeItem(h, 'mat_lingshi', ls); g.ws.rep = clamp(g.ws.rep + 2, -100, 100); return this.close(`${v.pn}收下灵石，郑重一揖：「道友厚道。日后有用得着的地方，尽管开口。」\n\n（正道声望 +2）`, v.pn); } },
      { label: '全部平分（折半灵石给他，宝物归我，再送他一瓶丹）', act: () => { if (ls) C.removeItem(h, 'mat_lingshi', Math.floor(ls / 2)); g.ws.rep = clamp(g.ws.rep + 3, -100, 100); return this.close(`${v.pn}大笑：「痛快！」两人在${name}前作别。\n\n（正道声望 +3）`, v.pn); } },
      { label: '独吞（翻脸）', tone: 'bad', act: () => { g.ws.rep = clamp(g.ws.rep - 8, -100, 100); this.partnerTurns(s, '好个忘恩负义之徒！'); return null; } },
    ] };
  }

  // 妖兽巢穴
  private nestNode(s: Site): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const mom = this.guardOf(s);
    const egg = v.egg ?? 'egg_wolf';
    const away = !mom || (mom as any).away;
    const takeEgg = (): DNode => {
      this.respawn(s, 720);
      if (egg === 'insect') {
        if (s.tier >= 2 && s.seed % 4 === 0) { C.addItem(h, 'egg_shijin', 1); g.pets?.onEgg('egg_shijin'); g.news('韩立在一处虫巢中寻得一枚噬金虫卵！', 'personal'); return this.close('虫巢深处，一枚金灿灿、硬如精铁的虫卵卧在残壳之间——\n\n噬金虫卵！奇虫榜第三！\n\n获得：噬金虫卵', '天大机缘', 'mystic'); }
        const n = rint(1, 2); const yd = 'mat_yaodan' + clamp(s.tier + 1, 1, 10); C.addItem(h, yd, n);
        return this.close(`巢中只剩些虫蜕，倒是寻到 ${n} 颗${itemDef(yd).name}。`, '虫巢');
      }
      C.addItem(h, egg, 1); g.pets?.onEgg(egg);
      return this.close(`你小心地托起${itemDef(egg).name}，还带着余温。\n\n获得：${itemDef(egg).name}${g.ws.incubate ? '' : '（已开始温养——过些日子就会破壳）'}`, '灵卵', 'mystic');
    };
    if (!mom) return { speaker: '兽巢', text: `巢中静静卧着${egg === 'insect' ? '一堆虫蜕' : itemDef(egg).name}。四下无人看守。`, options: [{ label: '取走', tone: 'gold', act: takeEgg }, { label: '离开', act: () => null }] };
    const ch = clamp(0.72 - Math.max(0, mom.realm - h.realm) * 0.15, 0.25, 0.9);
    return { speaker: '兽巢', title: `${v.mother ?? '妖兽'}之巢`, text: away ? `${mom.name}外出觅食去了（它每隔一阵就会回来）。巢中静静卧着${egg === 'insect' ? '虫卵' : itemDef(egg).name}。\n\n要快。` : `${mom.name}就趴在巢边，一双竖瞳半睁半闭。此时取卵，无异于虎口拔牙。\n\n（护巢母兽每隔一阵会外出觅食——可以躲远些等它离开）`, mood: away ? 'mystic' : 'danger', options: [
      away ? { label: '趁机取卵', tone: 'gold', act: takeEgg } : { label: `敛息偷卵（约 ${Math.round(ch * 100)}%）`, disabled: !g.concealed, hint: g.concealed ? '失手则母兽暴怒' : '需先敛息（R）', tone: 'bad', act: () => { if (Math.random() < ch) return takeEgg(); mom.aggro = true; return this.close(`${mom.name}猛然抬头，发出一声震耳的咆哮——它发现你了！`, '母兽暴怒', 'danger'); } },
      { label: '离开', act: () => null },
    ] };
  }

  // 灵脉
  private veinNode(s: Site): DNode {
    const g = this.game, h = g.hero;
    const home = g.ws.home;
    const here = home && home.map === ACTIVE_MAP && home.key === s.key;
    if (here) { g.home.interact(); return null as any; }
    const q = this.veinQ(s);
    const cost = 200 + s.tier * 300;
    const opts: DOpt[] = [{ label: '在此打坐吐纳', act: () => { if (!g.player.sitting) g.toggleSit(); return null; } }];
    if (!home) opts.unshift({ label: `开辟洞府（${cost} 灵石：凿洞、布阵、开药园）`, tone: 'gold', disabled: C.bagCount(h, 'mat_lingshi') < cost, hint: C.bagCount(h, 'mat_lingshi') < cost ? '灵石不足' : '洞府可种药、闭关、养宠，且只此一座', act: () => { C.removeItem(h, 'mat_lingshi', cost); g.home.create(s); return null; } });
    else opts.unshift({ label: `迁居于此（${cost} 灵石，药园连土带药一并迁来）`, disabled: C.bagCount(h, 'mat_lingshi') < cost, hint: home.map !== ACTIVE_MAP ? '原洞府在别的地域' : '', act: () => { C.removeItem(h, 'mat_lingshi', cost); g.home.create(s, true); return null; } });
    opts.push({ label: '离开', act: () => null });
    return { speaker: '小灵脉', title: `灵气 ${q.toFixed(1)} 倍`, text: `地底一条细细的灵脉在此露头，石缝间渗出的灵泉冒着白气，四周的草木都比别处青翠。\n\n在此修炼，灵气是野外的 ${q.toFixed(1)} 倍。${home ? `\n\n你的洞府在${home.map === ACTIVE_MAP ? '本地' : '别的地域'}（${home.name}）。` : '\n\n若在此开辟洞府，便有了自己的落脚之处：药园、禁制、闭关、灵兽……'}`, mood: 'mystic', options: opts };
  }
  veinQ(s: { tier: number; seed: number }) { return 1.35 + s.tier * 0.15 + (s.seed % 5) * 0.04; }
  /** 当前所在的灵脉（打坐加成） */
  veinAt(x: number, y: number, r = 260): Site | null {
    for (const s of this.inRect(x - r, y - r, x + r, y + r)) if (s.kind === 'vein' && Math.hypot(s.x - x, s.y - y) < r) return s;
    return null;
  }

  // 古碑
  private steleNode(s: Site): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const type = s.seed % 5;
    if (v.read) return this.close(`碑上的字迹你已烂熟于心：\n\n${STELE_LORE[s.seed % STELE_LORE.length]}`, '古碑');
    const need = 650 + s.tier * 320;
    const deep = g.baseSenseRadius >= need;
    return { speaker: '古碑', title: ['功法残篇', '地脉图', '悟道碑', '剑意碑', '遗训碑'][type], text: `一人多高的青石碑，半截埋在土里，苔痕斑驳。${['碑面刻满蝌蚪般的古篆，似是一部功法。', '碑上刻的不是字，而是纵横交错的线条——像是一幅地图。', '碑文只有一个「道」字，笔意却仿佛无穷无尽。', '碑上一道剑痕自上而下，深不见底，剑意至今未散。', '碑上是前人留给后来者的话。'][type]}${deep ? '' : `\n\n（你的神识尚浅，只能看懂皮毛——神识越强，所得越多）`}`, mood: 'mystic', options: [
      { label: '静心参悟（耗三日）', tone: 'gold', act: () => {
        v.read = 1; g.passDays(3);
        const m: C.Msg[] = [];
        if (type === 0) {
          const sk = deep ? g.combat.randomScroll(Math.min(4, s.tier + 1)) : null;
          if (sk) { C.addItem(h, sk, 1); return this.close(`三日三夜，你将碑上古篆尽数拓印于玉简。\n\n获得：${itemDef(sk).name}`, '功法残篇', 'mystic'); }
          C.gainExp(h, C.need(h) * C.INSIGHT * 0.05, m); return this.close('古篆残缺太甚，你只悟出几分道理。（修为小涨）', '功法残篇');
        }
        if (type === 1) {
          const a = this.revealNear(s.x, s.y, 14000), b = this.revealNear(s.x, s.y, 14000);
          const c = deep && Math.random() < 0.5 ? this.makeCache(s.tier + 1, s.x, s.y) : null;
          const names = [a, b].filter(Boolean).map((t) => this.name(t!));
          return this.close(`碑上的线条与你脑中的山川一一对上——\n\n${names.length ? `你记下了${names.join('、')}的位置。` : '附近的地脉你已尽知。'}${c ? '\n另有一处以朱砂点出的标记，像是藏宝之地。' : ''}\n\n（地图上已标出）`, '地脉图', 'mystic');
        }
        if (type === 2) { C.gainExp(h, C.need(h) * C.INSIGHT * (deep ? 0.1 + s.tier * 0.03 : 0.03), m); if (deep) h.senseBonus += 2; return this.close(`你在碑前枯坐三日，那个「道」字忽然活了过来，在你识海中缓缓舒展。\n\n修为大进${deep ? '，神识 +2' : ''}。`, '悟道', 'mystic'); }
        if (type === 3) {
          let n = 0; for (const id of h.hotbar ?? []) { if (!id) continue; const a = h.arts.find((x: any) => x.id === id); if (a) { a.xp = (a.xp ?? 0) + (deep ? 40 : 15); n++; } }
          return this.close(`你以神识触碰那道剑痕——一道凌厉无匹的剑意直冲识海！你咬牙撑住，将其化为己用。\n\n${n ? `快捷栏中 ${n} 门法术熟练度提升。` : '你暂无可以印证的法术。'}`, '剑意', 'mystic');
        }
        C.gainExp(h, C.need(h) * C.INSIGHT * 0.04, m); h.lifeBonus += 1;
        return this.close(`${STELE_LORE[s.seed % STELE_LORE.length]}\n\n你对着古碑一揖。（修为小涨，寿元 +1）`, '遗训', 'mystic');
      } },
      { label: '离开', act: () => null },
    ] };
  }

  // 山神庙
  private shrineNode(s: Site): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const bless = g.day < g.ws.blessUntil;
    const old = this.shrineLook(s);
    const opts: DOpt[] = [
      { label: bless ? `山神庇佑中（还剩 ${Math.ceil(g.ws.blessUntil - g.day)} 日）` : '上香祈福（10 灵石）', disabled: bless || C.bagCount(h, 'mat_lingshi') < 10, act: () => { C.removeItem(h, 'mat_lingshi', 10); g.ws.blessUntil = g.day + 30; g.toast('山神庇佑：三十日内灵药年份 +15%，遗物更丰。', 'good'); return this.close('三炷香青烟笔直，庙中泥塑的山神似乎……对你笑了一下？\n\n（山神庇佑 30 日：灵药年份 +15%，搜得的遗物更丰厚）', '上香', 'mystic'); } },
    ];
    const talkReady = (v.talk ?? -99) + 10 <= g.day;
    opts.push({ label: '与庙祝闲话', disabled: !talkReady, hint: talkReady ? '' : '庙祝打起了瞌睡', act: () => {
      v.talk = g.day;
      const r = Math.random();
      if (r < 0.4 && !v.quest) {
        const rb = g.combat.rollBeast(s.x, s.y, 0.3, { noFlee: true });
        if (rb) {
          const an = (s.seed % 628) / 100;
          const e = new Enemy(rb.def, s.x + Math.cos(an) * 1300, s.y + Math.sin(an) * 900, rb.realm, rb.stage);
          e.name = '伤人的' + rb.def.name; e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.6); e.hx = e.x; e.hy = e.y; e.tag = 'quest:' + s.key;
          g.combat.enemies.push(e); v.quest = 1;
          return { speaker: '庙祝', look: old.look, text: `唉，仙师有所不知。这几个月山里出了一头${rb.def.name}，已经叼走了村里两个娃娃……\n\n它就在${dirName(Math.cos(an), Math.sin(an))}边的山坳里。仙师若能除了它，乡亲们凑些东西谢你！`, options: [{ label: '我去看看', tone: 'good', act: () => null }, { label: '与我无关', act: () => { v.quest = 0; g.combat.enemies = g.combat.enemies.filter((x) => x !== e); return null; } }] };
        }
      }
      if (r < 0.75) { const t = this.revealNear(s.x, s.y, 10000); if (t) return { speaker: '庙祝', look: old.look, text: `仙师要打听稀罕事？前些日子有个采药的说，${this.hereDir(t)}那边${t.kind === 'herbking' ? '有株灵药，被大畜生守着，靠近不得' : t.kind === 'ruin' ? '山壁上有扇石门，夜里会发光' : t.kind === 'corpse' ? '躺着个仙师的尸首，没人敢碰' : t.kind === 'nest' ? '有个好大的兽窝' : t.kind === 'pool' ? '有口深潭，潭底有东西发亮' : t.kind === 'bones' ? '是古战场，夜里鬼哭' : t.kind === 'vein' ? '有处泉眼冬暖夏凉，草木长得邪乎' : t.kind === 'stele' ? '有块怪碑，字谁也认不得' : '有座破庙'}。\n\n（地图上已标出）`, options: [{ label: '多谢', act: () => null }] }; }
      return { speaker: '庙祝', look: old.look, text: pick(['这山神爷灵得很，前年李家媳妇求子，第二年就生了对双胞胎。', '仙师，听说山那边的仙家又打起来了，飞剑跟流星似的……', '庙里香火钱少，老汉我一个人守着，也就图个清静。', '仙师，您说人死了，是不是真能成仙？']), options: [{ label: '告辞', act: () => null }] };
    } });
    if (v.quest === 2) opts.unshift({ label: '领取乡亲们的谢礼', tone: 'gold', act: () => { v.quest = 3; const got = loot(g, s.tier, 0.8, { scroll: 0.1, map: 0.1 }); g.ws.rep = clamp(g.ws.rep + 5, -100, 100); return { speaker: '庙祝', look: old.look, text: `乡亲们把家里攒的东西都拿来了，有个娃娃还塞给你一个煮鸡蛋。\n\n获得：${got.join('、')}、一个煮鸡蛋\n\n（正道声望 +5）`, options: [{ label: '收下', act: () => null }] }; } });
    opts.push({ label: '离开', act: () => null });
    return { speaker: '山神庙', title: '庙祝', look: old.look, text: '一间不过丈许的小庙，泥塑山神披着褪色的红布，香炉里还插着半截线香。一个须发皆白的庙祝坐在门槛上打盹。', options: opts };
  }
  private shrineLook(s: Site) {
    let o = this.looks.get('s' + s.key);
    if (!o) { const r = seeded(s.seed ^ 0x51); o = { look: randomLook(r, 'elder'), st: new CharState(s.x + 64, s.y + 36) }; o.st.setAction('sit'); o.st.faceToward(0.2, 1); this.looks.set('s' + s.key, o); }
    return o;
  }

  // 寒潭 / 灵池
  private poolNode(s: Site): DNode {
    const g = this.game, h = g.hero, v = this.st(s);
    const cold = s.zone === 'cold', name = this.name(s);
    const drinkOk = (v.drink ?? -99) + 30 <= g.day, diveOk = (v.dive ?? -9999) + 720 <= g.day;
    const ch = clamp(0.5 + (h.realm - s.tier * 0.7) * 0.12, 0.2, 0.85);
    return { speaker: name, text: `${cold ? '潭水幽黑，寒气逼人，潭边石头上结着白霜。' : '池水清澈见底，水面浮着淡淡的灵雾。'}${diveOk ? '潭底深处，偶尔有一点宝光闪过。' : ''}`, mood: 'mystic', options: [
      { label: '掬一捧水饮下', disabled: !drinkOk, hint: drinkOk ? '' : '灵气尚未恢复（每月一次）', act: () => { v.drink = g.day; const m: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * (0.02 + s.tier * 0.008), m); h.hp = Math.min(1, h.hp + 0.4); h.mp = Math.min(1, h.mp + 0.4); return this.close(`${cold ? '一股寒流直透丹田，激得你浑身一颤——随即化作精纯灵力。' : '池水入喉甘甜，灵气在经脉中缓缓化开。'}\n\n（修为小涨，气血法力恢复）`, name); } },
      { label: `潜入潭底（约 ${Math.round(ch * 100)}%）`, disabled: !diveOk || h.hp < 0.5, hint: !diveOk ? '潭底已被你翻过（两年后再来）' : h.hp < 0.5 ? '气血太低' : cold ? '寒毒伤身' : '暗流凶险', tone: 'gold', act: () => {
        v.dive = g.day;
        if (Math.random() < ch) {
          const r = Math.random(); let got = '';
          if (r < 0.14 && s.tier >= 2) { C.addItem(h, 'egg_jiao', 1); g.pets?.onEgg('egg_jiao'); got = '一枚冰凉的蛟卵！'; }
          else if (r < 0.32) { const a = pickArt(s.tier + 1, false); if (a) { C.addItem(h, a, 1); got = `一件沉在淤泥里的法器——【${itemDef(a).name}】`; } }
          if (!got) { const mats = cold ? ['mat_xuanyu', 'herb_bingpo', 'mat_lingquan'] : ['mat_lingquan', 'mat_xuanyu', 'herb_nichang']; const id = pick(mats); const n = rint(2, 4); C.addItem(h, id, n, id.startsWith('herb') ? 100 + s.tier * 80 : undefined); const ls = Math.round(rand(20, 50) * Math.pow(3, s.tier)); C.addItem(h, 'mat_lingshi', ls); got = `${itemDef(id).name}×${n}、灵石 ${ls}（前人沉在潭底的储物袋）`; }
          return this.close(`你屏息潜入，越往下越${cold ? '冷' : '暗'}……指尖终于触到了那点宝光。\n\n获得：${got}`, '潭底', 'mystic');
        }
        h.hp = Math.max(0.05, h.hp - 0.3);
        return this.close(cold ? '潭底寒毒如针，扎进你的骨髓。你拼命浮上来，牙关打颤，半边身子都麻了。' : '一股暗流卷住了你，撞在潭底礁石上。你呛着水爬上岸，什么也没摸到。', '失手', 'danger');
      } },
      { label: '离开', act: () => null },
    ] };
  }

  // 古战场遗骨
  private bonesNode(s: Site): DNode {
    const g = this.game, h = g.hero;
    if (this.guardOf(s)) return this.close('阴魂盘旋不去，尖啸着扑向一切活物。先超度了它们再说。', '古战场', 'danger');
    return { speaker: '古战场', text: '一副庞大的妖兽骸骨横卧在地，肋骨如同倒扣的船骨。四周插满锈蚀的断剑残戟——不知多少年前，这里死过很多人。', mood: 'mystic', options: [
      { label: '收敛遗骨，拾取遗物', tone: 'gold', act: () => {
        this.respawn(s, 360 * 4);
        const yd = 'mat_yaodan' + clamp(s.tier + 2, 1, 10); C.addItem(h, yd, 1);
        const got = [itemDef(yd).name, ...loot(g, s.tier, 0.9, { scroll: 0.15, art: 0.12, map: 0.15 })];
        if (Math.random() < 0.3 + s.tier * 0.08) { C.addItem(h, 'mat_gubaocan', 1); got.push('古宝残片'); }
        return this.close(`你将骸骨一一归拢，在兽颅中寻到一颗早已石化、灵力犹存的妖丹。\n\n获得：${got.join('、')}`, '古战场', 'mystic');
      } },
      { label: '离开', act: () => null },
    ] };
  }

  // ------------------------------------------------------------ 残图 / 藏宝
  makeCache(tier: number, nx?: number, ny?: number): CacheState | null {
    const g = this.game, T = g.terrain, p = g.player;
    const ox0 = nx ?? p.x, oy0 = ny ?? p.y;
    if ((g.ws.caches ?? []).filter((c) => !c.done).length >= 4) return null;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU, d = rand(5000, 16000);
      const x = ox0 + Math.cos(a) * d, y = oy0 + Math.sin(a) * d * 0.8;
      if (x < 600 || y < 600 || x > WORLD_W - 600 || y > WORLD_H - 600) continue;
      if (!T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 300)) continue;
      const r = 900;
      const c: CacheState = { id: Date.now() % 1e9 + i, map: ACTIVE_MAP, x, y, ox: x + rand(-r, r) * 0.7, oy: y + rand(-r, r) * 0.7, tier: clamp(tier, 0, 5) };
      (g.ws.caches ??= []).push(c);
      g.toast(`残图上的朱砂点对上了地形——藏宝处在${dirName(x - p.x, y - p.y)}方约 ${Math.round(Math.hypot(x - p.x, y - p.y) / 260)} 里。（地图上已圈出大致范围）`, 'good');
      return c;
    }
    return null;
  }
  private interactCache(c: CacheState): boolean {
    const g = this.game, h = g.hero;
    g.openDialog({ speaker: '藏宝处', text: '残图上的朱砂点就在脚下。泥土松软，隐约有灵光透出。', mood: 'mystic', options: [
      { label: '掘开', tone: 'gold', act: () => {
        c.done = true;
        const got = loot(g, c.tier, 2.2, { scroll: 0.35, art: 0.35, map: 0.1 });
        if (Math.random() < 0.12) { const egg = pick(['egg_yunchi', 'egg_huli', 'egg_wolf']); C.addItem(h, egg, 1); got.push(itemDef(egg).name); g.pets?.onEgg(egg); }
        // 第三十七步：尾随者只有自认吃得下你才会现身
        const tr = Math.random() < 0.35 ? threatRealm(g, c.x, c.y, Math.max(1, h.realm), 0.2) : null;
        if (tr) {
          const def = tr.realm >= 3 ? ENEMIES.jindan_mo ?? ENEMIES.zhujixiu : tr.realm >= 2 ? ENEMIES.zhujixiu : ENEMIES.bandit;
          for (let i = 0; i < rint(1, 2); i++) { const an = Math.random() * TAU; const e = new Enemy(def, c.x + Math.cos(an) * 480, c.y + Math.sin(an) * 340, i === 0 ? tr.realm : Math.max(1, tr.realm - 1), i === 0 ? tr.stage : rint(0, 6)); e.name = '尾随的寻宝客'; e.aggro = true; g.combat.enemies.push(e); }
          return this.close(`铁锹碰到了木箱——\n\n获得：${got.join('、')}\n\n身后传来一声冷笑：「辛苦道友了。这残图，我们也找了三年。」`, '螳螂捕蝉', 'danger');
        }
        g.news('韩立按残图寻得一处前人藏宝。', 'personal');
        return this.close(`一只裹着油布的铁匣，封泥上还盖着前人的私印。\n\n获得：${got.join('、')}`, '藏宝', 'mystic');
      } },
      { label: '离开', act: () => null },
    ] });
    return true;
  }

  // ------------------------------------------------------------ 杂项
  revealNear(x: number, y: number, r: number): Site | null {
    let best: Site | null = null, bd = r;
    for (const s of this.inRect(x - r, y - r, x + r, y + r)) {
      if (!this.available(s) || this.st(s, false).seen) continue;
      const d = Math.hypot(s.x - x, s.y - y); if (d < 1500) continue;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) this.st(best).seen = 1;
    return best;
  }
  hereDir(s: { x: number; y: number }) { const p = this.game.player; return `${dirName(s.x - p.x, s.y - p.y)}边约 ${Math.max(1, Math.round(Math.hypot(s.x - p.x, s.y - p.y) / 260))} 里`; }
  /** 灵宠帮忙：找一个尚未见过的机缘（偏好某些种类） */
  sniff(r: number, prefer?: SiteKind[]): Site | null {
    const p = this.game.player; let best: Site | null = null, bs = 1e18;
    for (const s of this.inRect(p.x - r, p.y - r, p.x + r, p.y + r)) {
      if (!this.available(s) || this.st(s, false).seen) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y); if (d > r) continue;
      const sc = d * (prefer && prefer.includes(s.kind) ? 0.4 : 1);
      if (sc < bs) { bs = sc; best = s; }
    }
    return best;
  }
  /** 地图标记：见过且尚有机缘的地点，以及残图圈出的藏宝范围 */
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    const ws = this.game.ws;
    for (const k in ws.sites ?? {}) {
      const v = ws.sites[k]; if (!v.seen) continue;
      const [map, key] = k.split('|'); if (map !== ACTIVE_MAP) continue;
      const [cx, cy] = key.split(',').map(Number); const s = this.gen(cx, cy); if (!s) continue;
      if (!this.available(s) && s.kind !== 'vein') continue;
      out.push({ x: s.x, y: s.y, glyph: SITE_GLYPH[s.kind], color: SITE_COLOR[s.kind], name: this.name(s) });
    }
    for (const c of ws.caches ?? []) if (!c.done && c.map === ACTIVE_MAP) out.push({ x: c.ox, y: c.oy, glyph: '宝', color: '#ffd060', ring: 1100, name: '残图藏宝处' });
    return out;
  }
  onKill(e: Enemy) {
    if (!e.tag?.startsWith('quest:')) return;
    const key = e.tag.slice(6); const [cx, cy] = key.split(',').map(Number); const s = this.gen(cx, cy); if (!s) return;
    const v = this.st(s); if (v.quest === 1) { v.quest = 2; this.game.toast(`${e.name}伏诛！回山神庙向庙祝报个平安吧。`, 'good'); }
  }
  reset() { this.guards.clear(); this.focus = null; }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    const g = this.game;
    for (const s of this.inRect(view.left - 300, view.top - 300, view.right + 300, view.bottom + 400)) {
      const v = g.life.vis(s); if (v <= 0.01) continue;
      const avail = this.available(s);
      out.push({ y: s.y, draw: (ctx) => this.drawSite(ctx, s, v, avail, t, dt) });
      if (s.kind === 'shrine') { const o = this.shrineLook(s); out.push({ y: o.st.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; o.st.update(dt); drawCharacter(ctx, o.look, o.st, 1, dt); ctx.restore(); } }); }
      if (s.kind === 'ruin') { const sv = this.st(s, false); if (sv.partner === 1 || sv.partner === 2) { const o = this.partnerLook(s); out.push({ y: o.st.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; o.st.update(dt); drawCharacter(ctx, o.look, o.st, 1, dt); ctx.restore(); } }); } }
    }
    for (const c of g.ws.caches ?? []) {
      if (c.done || c.map !== ACTIVE_MAP || c.x < view.left - 200 || c.x > view.right + 200 || c.y < view.top - 200 || c.y > view.bottom + 200) continue;
      const v = g.life.vis(c); if (v <= 0.01) continue;
      out.push({ y: c.y - 5, draw: (ctx) => this.drawCache(ctx, c, v, t) });
    }
    // 沉睡的守兽：Zzz
    for (const list of this.guards.values()) for (const e of list) if (e.sleep && !e.dead) {
      const v = g.life.vis(e); if (v <= 0.01) continue;
      out.push({ y: e.y + 2, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; ctx.font = 'italic 22px "Noto Serif SC",serif'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const k = (t * 0.45 + i / 3) % 1; ctx.fillStyle = `rgba(230,240,255,${(1 - k) * 0.8})`; ctx.fillText('z', e.x + 30 + k * 34 + i * 4, e.y - 70 - k * 60); } ctx.restore(); } });
    }
  }
  private label(ctx: G, x: number, y: number, s: string) {
    const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z));
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText(s, x, y); ctx.fillStyle = '#fff0c8'; ctx.fillText(s, x, y); ctx.restore();
  }
  private drawSite(ctx: G, s: Site, v: number, avail: boolean, t: number, _dt: number) {
    ctx.save(); ctx.globalAlpha *= v;
    const r = seeded(s.seed), x = s.x, y = s.y;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 + s.seed);
    // 地面阴影
    ctx.fillStyle = 'rgba(20,18,14,0.16)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 90, 24, 0, 0, TAU); ctx.fill();
    switch (s.kind) {
      case 'herbking': drawHerbKing(ctx, x, y, this.herbOf(s), avail, s.tier, t, r); break;
      // 第二十三步：遗骸、古洞府、兽巢、灵脉、石碑用贴图（画材未就绪时退回代码绘制）
      case 'corpse': { const anc = s.tier >= 2 && s.seed % 4 === 3; if (!(anc && spriteSkeleton(ctx, x, y, avail, t, s.seed))) drawCorpse(ctx, x, y, avail, r, anc); break; }
      case 'ruin': { const L = avail ? 3 - (this.st(s, false).layer ?? 0) : 0; if (!spriteRuin(ctx, x, y, L, t, s.seed)) drawRuin(ctx, x, y, L, t, r); break; }
      case 'nest': { const egg = this.st(s, false).egg; if (!(avail && egg !== 'egg_jiao' && drawBld(ctx, 'p_nest', x, y + 8, t, 1, s.seed % 2 === 0))) drawNest(ctx, x, y, avail, egg, r); break; }
      case 'vein': { const home = this.game.ws.home?.key === s.key && this.game.ws.home.map === ACTIVE_MAP; if (!spriteVein(ctx, x, y, t, s.seed, home)) drawVein(ctx, x, y, t, r, home); break; }
      case 'stele': if (!spriteStele(ctx, x, y, avail, pulse, t, s.seed)) drawStele(ctx, x, y, avail, pulse, r); break;
      case 'shrine': drawShrine(ctx, x, y, t, r); break;
      case 'pool': drawPool(ctx, x, y, s.zone === 'cold', t, r, (this.st(s, false).dive ?? -9999) + 720 <= this.game.day); break;
      case 'bones': drawBones(ctx, x, y, t, r, !!this.guardOf(s)); break;
    }
    if (this.focus === s && this.focusD < 210 && !(s.kind === 'vein' && this.game.ws.home?.key === s.key)) this.label(ctx, x, y - (s.kind === 'ruin' ? 250 : s.kind === 'shrine' ? 220 : 180), `【T】${this.name(s)}`);
    ctx.restore();
  }
  private drawCache(ctx: G, c: CacheState, v: number, t: number) {
    ctx.save(); ctx.globalAlpha *= v;
    const k = 0.5 + 0.5 * Math.sin(t * 3 + c.id);
    ctx.fillStyle = 'rgba(90,70,40,0.5)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 46, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,50,30,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - 22, c.y - 8); ctx.lineTo(c.x + 22, c.y + 8); ctx.moveTo(c.x + 22, c.y - 8); ctx.lineTo(c.x - 22, c.y + 8); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(c.x, c.y - 10, 0, c.x, c.y - 10, 70); gr.addColorStop(0, `rgba(255,220,120,${0.35 + 0.3 * k})`); gr.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y - 10, 70, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { const q = (t * 0.5 + i / 5) % 1; ctx.fillStyle = `rgba(255,230,160,${(1 - q) * 0.8})`; ctx.beginPath(); ctx.arc(c.x + Math.sin(i * 3 + t) * 20, c.y - q * 120, 2.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (this.focus === c && this.focusD < 210) this.label(ctx, c.x, c.y - 90, '【T】掘开');
  }
}

// ---------------------------------------------------------------- 奖励
/** 按档位发放一份遗物（直接入袋），返回描述 */
export function loot(g: Game, tier: number, mult = 1, opt: { scroll?: number; art?: number; map?: number } = {}): string[] {
  const h = g.hero, out: string[] = [];
  const bless = g.day < g.ws.blessUntil ? 1.25 : 1;
  const ls = Math.round(rand(18, 48) * Math.pow(3, tier) * mult * bless);
  C.addItem(h, 'mat_lingshi', ls); out.push(`灵石 ${ls}`);
  const pool = ITEM_LIST.filter((it) => (it.type === 'pill' || it.type === 'talisman' || it.type === 'material') && it.price > 0 && it.tier <= tier + 1 && it.tier >= Math.max(0, tier - 1) && it.id !== 'mat_lingshi' && !it.id.startsWith('mat_yaodan') && it.id !== 'mat_gubaocan' && !canonOwned(it.id) && it.price < 1500 * Math.pow(3, tier));
  const n = Math.random() < 0.45 * mult * bless ? 2 : 1;
  for (let i = 0; i < n && pool.length; i++) { const it = pick(pool); const k = it.stack ? rint(1, it.price < 200 ? 3 : 1) : 1; C.addItem(h, it.id, k); out.push(k > 1 ? `${it.name}×${k}` : it.name); }
  if (Math.random() < (opt.scroll ?? 0.2) * bless) { const sk = g.combat.randomScroll(Math.min(4, tier + 1)); if (sk) { C.addItem(h, sk, 1); out.push(itemDef(sk).name); } }
  if (Math.random() < (opt.art ?? 0) * bless) { const a = pickArt(tier + 1, tier >= 3 && Math.random() < 0.2); if (a) { C.addItem(h, a, 1); out.push(`【${itemDef(a).name}】`); } }
  if (Math.random() < (opt.map ?? 0.12)) { const c = g.sites.makeCache(tier + 1); if (c) out.push('一角残破的藏宝图'); }
  return out;
}
export const CANON_ONLY_ART = new Set(['art_xutianding', 'art_fenglei', 'art_qingzhu', 'art_xuese']);
export function pickArt(maxTier: number, gubao: boolean): string | null {
  const pool = ITEM_LIST.filter((it) => it.type === 'artifact' && it.price > 0 && !CANON_ONLY_ART.has(it.id) && !canonOwned(it.id) && (gubao ? it.tier === 5 : it.tier >= 1 && it.tier <= Math.min(4, maxTier)) && it.price < 400000);
  return pool.length ? pick(pool).id : null;
}
export function dirName(dx: number, dy: number) {
  const a = Math.atan2(dy, dx); const i = Math.round(a / (Math.PI / 4));
  return ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][(i + 8) % 8];
}

// ---------------------------------------------------------------- 绘制（全部代码绘制，带随机变化）
function drawHerbKing(ctx: G, x: number, y: number, id: string, avail: boolean, tier: number, t: number, r: () => number) {
  const col = HERB_COL[id] ?? '200,255,200', shape = HERB_SHAPE[id] ?? 'blade';
  // 底下的灵土与碎石
  ctx.fillStyle = '#5b4a36'; ctx.beginPath(); ctx.ellipse(x, y, 54, 16, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 7; i++) { const a = r() * TAU; ctx.fillStyle = r() < 0.5 ? '#8a8270' : '#6e6658'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 52, y + Math.sin(a) * 15, 6 + r() * 7, 4 + r() * 4, 0, 0, TAU); ctx.fill(); }
  if (!avail) { ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6, y); ctx.lineTo(x + i * 9, y - 12); ctx.stroke(); } return; }
  // 灵光
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const k = 0.6 + 0.4 * Math.sin(t * 1.7);
  const gr = ctx.createRadialGradient(x, y - 50, 0, x, y - 50, 120); gr.addColorStop(0, `rgba(${col},${0.34 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 50, 120, 0, TAU); ctx.fill();
  if (tier >= 2) { const gl = ctx.createLinearGradient(x, y - 520, x, y); gl.addColorStop(0, `rgba(${col},0)`); gl.addColorStop(1, `rgba(${col},${0.16 * k})`); ctx.fillStyle = gl; ctx.fillRect(x - 18, y - 520, 36, 520); }
  for (let i = 0; i < 8; i++) { const q = (t * 0.35 + i / 8) % 1; ctx.fillStyle = `rgba(${col},${(1 - q) * 0.7})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 5.1 + t * 0.8) * 40 * q, y - 30 - q * 160, 2 + 2 * (1 - q), 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.translate(x, y);
  const sw = Math.sin(t * 1.3) * 0.04;
  ctx.rotate(sw);
  if (shape === 'mush') {
    ctx.fillStyle = '#d8c8a8'; ctx.fillRect(-5, -44, 10, 44);
    for (let i = 0; i < 3; i++) { const ox = (i - 1) * 26, oy = -44 - (i === 1 ? 14 : 0), w = i === 1 ? 40 : 26; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.ellipse(ox, oy, w, w * 0.42, 0, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 1.5; for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.ellipse(ox, oy, w * j / 4, w * 0.42 * j / 4, 0, Math.PI, TAU); ctx.stroke(); } }
  } else if (shape === 'lotus') {
    ctx.fillStyle = '#4a7a5a'; ctx.beginPath(); ctx.ellipse(0, -6, 40, 10, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.32; ctx.save(); ctx.translate(0, -16); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = i % 2 ? 'rgb(240,248,255)' : 'rgb(220,236,250)'; ctx.beginPath(); ctx.ellipse(0, -22, 9, 24, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#ffe890'; ctx.beginPath(); ctx.arc(0, -22, 7, 0, TAU); ctx.fill();
  } else if (shape === 'fruit' || shape === 'flower') {
    ctx.strokeStyle = '#3e6a34'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -40, 2, -78); ctx.stroke();
    for (let i = 0; i < 6; i++) { const yy = -14 - i * 11, s2 = i % 2 ? 1 : -1; ctx.fillStyle = i % 3 ? '#4f8a3e' : '#3c7232'; ctx.beginPath(); ctx.ellipse(s2 * 16, yy, 17, 6, s2 * -0.5, 0, TAU); ctx.fill(); }
    if (shape === 'fruit') for (let i = 0; i < 3; i++) { const a = -1.2 + i * 1.2; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(2 + Math.cos(a) * 14, -80 + Math.sin(a) * 6, 9, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-1 + Math.cos(a) * 14, -83 + Math.sin(a) * 6, 3, 0, TAU); ctx.fill(); }
    else for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.2; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.ellipse(2 + Math.cos(a) * 11, -82 + Math.sin(a) * 11, 9, 5, a, 0, TAU); ctx.fill(); }
    if (shape === 'flower') { ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(2, -82, 5, 0, TAU); ctx.fill(); }
  } else if (shape === 'shen') {
    ctx.strokeStyle = '#d9c39a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-14, 10); ctx.moveTo(0, -4); ctx.lineTo(13, 12); ctx.moveTo(0, -18); ctx.lineTo(0, -4); ctx.stroke();
    ctx.strokeStyle = '#4c7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -70); ctx.stroke();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ctx.fillStyle = '#56913f'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 26, -60 + Math.sin(a) * 10 + 10, 18, 6, a, 0, TAU); ctx.fill(); }
    ctx.fillStyle = `rgb(${col})`; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(Math.cos(i) * 6, -76 - (i % 3) * 5, 4, 0, TAU); ctx.fill(); }
  } else {
    for (let i = -4; i <= 4; i++) { ctx.strokeStyle = i % 2 ? `rgb(${col})` : '#4a8a40'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.quadraticCurveTo(i * 10, -34, i * 18 + Math.sin(t * 2 + i) * 4, -64 - (4 - Math.abs(i)) * 7); ctx.stroke(); }
  }
  ctx.restore();
}
// —— 贴图版（第二十三步）
function spriteSkeleton(ctx: G, x: number, y: number, avail: boolean, t: number, seed: number) {
  if (!drawBld(ctx, 'p_skeleton', x, y + 6, t, 1, seed % 2 === 0)) return false;
  if (avail) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k = 0.5 + 0.5 * Math.sin(t * 2 + seed); const gr = ctx.createRadialGradient(x, y - 20, 0, x, y - 20, 40); gr.addColorStop(0, `rgba(180,255,200,${0.28 + 0.2 * k})`); gr.addColorStop(1, 'rgba(180,255,200,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 20, 40, 0, TAU); ctx.fill(); ctx.restore(); }
  return true;
}
function spriteRuin(ctx: G, x: number, y: number, layers: number, t: number, seed: number) {
  if (!drawBld(ctx, 'p_arch_ruin', x, y + 6, t, 1, seed % 2 === 0)) return false;
  if (layers > 0) {
    // 禁制：门洞里一层层流光，外绕封字
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cols = ['140,210,255', '200,170,255', '255,120,100'];
    for (let l = 0; l < layers; l++) {
      const k = 0.5 + 0.5 * Math.sin(t * (1.6 + l * 0.7) + l * 2);
      ctx.strokeStyle = `rgba(${cols[l]},${0.22 + 0.3 * k})`; ctx.lineWidth = 2 + l;
      ctx.beginPath(); ctx.moveTo(x - 46 - l * 7, y - 4); ctx.lineTo(x - 46 - l * 7, y - 120 - l * 4); ctx.quadraticCurveTo(x, y - 168 - l * 8, x + 46 + l * 7, y - 120 - l * 4); ctx.lineTo(x + 46 + l * 7, y - 4); ctx.stroke();
    }
    ctx.fillStyle = `rgba(150,220,255,${0.07 + 0.05 * Math.sin(t * 2)})`; ctx.beginPath(); ctx.ellipse(x, y - 80, 46, 80, 0, 0, TAU); ctx.fill();
    ctx.font = '16px serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 6; i++) { const a = t * 0.4 + i / 6 * TAU; ctx.fillStyle = `rgba(170,230,255,${0.35 + 0.3 * Math.sin(t * 2 + i)})`; ctx.fillText('封禁玄灵镇敕'[i], x + Math.cos(a) * 120, y - 90 + Math.sin(a) * 40); }
    ctx.restore();
  }
  return true;
}
function spriteVein(ctx: G, x: number, y: number, t: number, seed: number, home: boolean) {
  if (!drawBld(ctx, 'p_ore', x + 10, y + 8, t, 1, seed % 2 === 0)) return false;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) { const k = (t * 0.25 + i / 10) % 1; ctx.fillStyle = `rgba(140,255,230,${(1 - k) * 0.4})`; const bx = x - 60 + ((i * 37) % 130); ctx.beginPath(); ctx.arc(bx, y - 40 - k * 90, 2.2, 0, TAU); ctx.fill(); }
  const gr = ctx.createRadialGradient(x, y - 50, 0, x, y - 50, home ? 70 : 120); gr.addColorStop(0, 'rgba(120,255,220,0.2)'); gr.addColorStop(1, 'rgba(120,255,220,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 50, home ? 70 : 120, 0, TAU); ctx.fill();
  ctx.restore();
  return true;
}
function spriteStele(ctx: G, x: number, y: number, unread: boolean, pulse: number, t: number, seed: number) {
  const k = ['p_stele_a', 'p_stele_b', 'p_stele_c'][seed % 3];
  if (!drawBld(ctx, k, x, y + 4, t, 1, seed % 2 === 0)) return false;
  if (unread) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y - 90, 0, x, y - 90, 90); gr.addColorStop(0, `rgba(255,236,170,${0.1 + 0.14 * pulse})`); gr.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 90, 90, 0, TAU); ctx.fill(); ctx.restore(); }
  return true;
}
function drawCorpse(ctx: G, x: number, y: number, avail: boolean, r: () => number, ancient: boolean) {
  const rot = (r() - 0.5) * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (ancient) {
    // 盘坐的枯骨
    ctx.fillStyle = '#4c4438'; ctx.beginPath(); ctx.ellipse(0, 0, 44, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a5e4a'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-30, -46, 0, -52); ctx.quadraticCurveTo(30, -46, 34, 0); ctx.fill();
    ctx.fillStyle = '#e4dccb'; ctx.beginPath(); ctx.ellipse(0, -66, 12, 14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(-4, -68, 3, 0, TAU); ctx.arc(4, -68, 3, 0, TAU); ctx.fill();
    if (avail) { ctx.fillStyle = '#7a8f6a'; ctx.fillRect(-14, -12, 28, 12); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(180,255,200,0.35)'; ctx.beginPath(); ctx.arc(0, -8, 22, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  // 散落的袍子
  ctx.fillStyle = ['#5a6a7a', '#6a5a4a', '#4a3a4a'][Math.floor(r() * 3)];
  ctx.beginPath(); ctx.moveTo(-50, 4); ctx.quadraticCurveTo(-30, -16, 10, -10); ctx.quadraticCurveTo(40, -6, 54, 8); ctx.quadraticCurveTo(10, 16, -50, 4); ctx.fill();
  // 骨
  ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-36, -4); ctx.lineTo(28, -2); ctx.stroke();
  ctx.lineWidth = 2.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 8, -4); ctx.quadraticCurveTo(-24 + i * 8, -16, -18 + i * 8, -14); ctx.stroke(); }
  ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(28, -2); ctx.lineTo(54, -8); ctx.moveTo(28, -2); ctx.lineTo(50, 8); ctx.moveTo(-20, -4); ctx.lineTo(-30, -26); ctx.stroke();
  ctx.fillStyle = '#ece4d0'; ctx.beginPath(); ctx.ellipse(-48, -8, 11, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(-51, -9, 2.6, 0, TAU); ctx.arc(-45, -9, 2.6, 0, TAU); ctx.fill();
  // 断剑
  ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 12); ctx.lineTo(44, -30); ctx.stroke();
  if (avail) { ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(6, 4, 9, 7, 0, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,150,0.45)'; ctx.beginPath(); ctx.arc(6, 2, 14, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawRuin(ctx: G, x: number, y: number, layers: number, t: number, r: () => number) {
  // 山壁
  const w = 150 + r() * 40, hgt = 200 + r() * 50;
  ctx.fillStyle = '#4e4840';
  ctx.beginPath(); ctx.moveTo(x - w, y + 6);
  for (let i = 0; i <= 8; i++) { const k = i / 8; ctx.lineTo(x - w + k * w * 2, y - hgt * Math.sin(k * Math.PI) * (0.82 + r() * 0.25)); }
  ctx.lineTo(x + w, y + 6); ctx.fill();
  ctx.strokeStyle = 'rgba(30,26,22,0.4)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const sx = x - w * 0.8 + r() * w * 1.6, sy = y - r() * hgt * 0.7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - 0.5) * 40, sy + 20 + r() * 30); ctx.stroke(); }
  ctx.fillStyle = 'rgba(80,110,60,0.55)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x - w * 0.7 + r() * w * 1.4, y - r() * hgt * 0.6, 14 + r() * 16, 6 + r() * 6, 0, 0, TAU); ctx.fill(); }
  // 石柱与门楣
  ctx.fillStyle = '#7a7266'; ctx.fillRect(x - 62, y - 128, 18, 128); ctx.fillRect(x + 44, y - 128, 18, 128);
  ctx.fillStyle = '#857c6e'; ctx.fillRect(x - 74, y - 146, 148, 20);
  ctx.fillStyle = '#5e574c'; ctx.fillRect(x - 30, y - 142, 60, 12);
  // 门洞
  ctx.fillStyle = '#18140f'; ctx.beginPath(); ctx.moveTo(x - 44, y); ctx.lineTo(x - 44, y - 92); ctx.quadraticCurveTo(x, y - 128, x + 44, y - 92); ctx.lineTo(x + 44, y); ctx.fill();
  // 台阶
  ctx.fillStyle = '#6e675c'; ctx.fillRect(x - 56, y - 4, 112, 8); ctx.fillStyle = '#625b50'; ctx.fillRect(x - 66, y + 4, 132, 7);
  if (layers > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let l = 0; l < layers; l++) {
      const k = 0.5 + 0.5 * Math.sin(t * (1.6 + l * 0.7) + l * 2);
      const cols = ['140,210,255', '200,170,255', '255,120,100'];
      ctx.strokeStyle = `rgba(${cols[l]},${0.25 + 0.35 * k})`; ctx.lineWidth = 2 + l;
      ctx.beginPath(); ctx.moveTo(x - 44 - l * 8, y); ctx.lineTo(x - 44 - l * 8, y - 92 - l * 4); ctx.quadraticCurveTo(x, y - 130 - l * 10, x + 44 + l * 8, y - 92 - l * 4); ctx.lineTo(x + 44 + l * 8, y); ctx.stroke();
    }
    ctx.fillStyle = `rgba(150,220,255,${0.08 + 0.05 * Math.sin(t * 2)})`; ctx.beginPath(); ctx.moveTo(x - 44, y); ctx.lineTo(x - 44, y - 92); ctx.quadraticCurveTo(x, y - 128, x + 44, y - 92); ctx.lineTo(x + 44, y); ctx.fill();
    ctx.font = '16px serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 6; i++) { const a = t * 0.4 + i / 6 * TAU; ctx.fillStyle = `rgba(170,230,255,${0.35 + 0.3 * Math.sin(t * 2 + i)})`; ctx.fillText('封禁玄灵镇敕'[i], x + Math.cos(a) * 80, y - 70 + Math.sin(a) * 26); }
    ctx.restore();
  } else {
    ctx.strokeStyle = '#3a342c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y - 146); ctx.lineTo(x + 8, y - 128); ctx.lineTo(x + 26, y - 132); ctx.stroke();
  }
}
function drawNest(ctx: G, x: number, y: number, avail: boolean, egg: string | undefined, r: () => number) {
  ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.ellipse(x, y - 6, 70, 26, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#7a6040'; ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) { const a = r() * TAU, rr = 50 + r() * 22; const sx = x + Math.cos(a) * rr, sy = y - 6 + Math.sin(a) * rr * 0.36; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (r() - 0.5) * 50, sy + (r() - 0.5) * 14); ctx.stroke(); }
  ctx.fillStyle = '#3a2c1e'; ctx.beginPath(); ctx.ellipse(x, y - 10, 44, 14, 0, 0, TAU); ctx.fill();
  if (avail) {
    const col = egg === 'egg_jiao' ? ['#4a6a8a', '#2a3a5a'] : egg === 'egg_yunchi' ? ['#e8f0f4', '#8aa0b0'] : egg === 'insect' ? ['#b89a40', '#6a5420'] : ['#e8dcc0', '#9a8060'];
    for (let i = 0; i < 3; i++) { const ex = x - 18 + i * 18, ey = y - 16 + (i === 1 ? -4 : 0); ctx.fillStyle = col[0]; ctx.beginPath(); ctx.ellipse(ex, ey, 10, 13, 0, 0, TAU); ctx.fill(); ctx.fillStyle = col[1]; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(ex - 4 + r() * 8, ey - 6 + r() * 12, 1.5 + r() * 1.5, 0, TAU); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(ex - 3, ey - 5, 3, 5, -0.4, 0, TAU); ctx.fill(); }
  }
  // 骨头
  ctx.strokeStyle = '#ddd4c0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 58, y + 10); ctx.lineTo(x + 86, y + 2); ctx.stroke();
}
function drawVein(ctx: G, x: number, y: number, t: number, r: () => number, home: boolean) {
  // 灵泉
  ctx.fillStyle = '#4a6a70'; ctx.beginPath(); ctx.ellipse(x - 20, y, 50, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7ac0c8'; ctx.beginPath(); ctx.ellipse(x - 20, y - 2, 40, 11, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const k = (t * 0.4 + i * 0.5) % 1; ctx.beginPath(); ctx.ellipse(x - 20, y - 2, 40 * k, 11 * k, 0, 0, TAU); ctx.stroke(); }
  // 晶石
  for (let i = 0; i < 6; i++) {
    const cx = x + 20 + (r() - 0.3) * 70, h = 26 + r() * 46, w = 8 + r() * 8, lean = (r() - 0.5) * 0.5;
    ctx.save(); ctx.translate(cx, y + 4 - r() * 10); ctx.rotate(lean);
    ctx.fillStyle = i % 2 ? '#8fe8e0' : '#6ac8d0'; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.8, -h); ctx.lineTo(0, -h - w); ctx.lineTo(w * 0.8, -h); ctx.lineTo(w, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(-w * 0.6, -2); ctx.lineTo(-w * 0.5, -h); ctx.lineTo(0, -h - w); ctx.fill();
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) { const k = (t * 0.25 + i / 10) % 1; ctx.strokeStyle = `rgba(140,255,230,${(1 - k) * 0.35})`; ctx.lineWidth = 2; const bx = x - 40 + (i * 37 % 90); ctx.beginPath(); ctx.moveTo(bx, y - k * 200); ctx.quadraticCurveTo(bx + Math.sin(t + i) * 16, y - k * 200 - 20, bx + Math.sin(t * 1.3 + i) * 8, y - k * 200 - 40); ctx.stroke(); }
  const gr = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, home ? 60 : 110); gr.addColorStop(0, 'rgba(120,255,220,0.22)'); gr.addColorStop(1, 'rgba(120,255,220,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 30, 110, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawStele(ctx: G, x: number, y: number, unread: boolean, pulse: number, r: () => number) {
  const lean = (r() - 0.5) * 0.12, w = 34 + r() * 10, h = 120 + r() * 40;
  ctx.fillStyle = '#5e5a50'; ctx.fillRect(x - w - 12, y - 14, (w + 12) * 2, 16);
  ctx.save(); ctx.translate(x, y - 12); ctx.rotate(lean);
  ctx.fillStyle = '#7a776c'; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h); ctx.quadraticCurveTo(0, -h - 22, w, -h); ctx.lineTo(w, 0); ctx.fill();
  ctx.fillStyle = 'rgba(40,36,30,0.25)'; ctx.fillRect(w - 10, -h, 10, h);
  ctx.strokeStyle = 'rgba(40,36,30,0.6)'; ctx.lineWidth = 2;
  for (let c = 0; c < 3; c++) for (let i = 0; i < 7; i++) { const lx = -w + 12 + c * (w * 2 - 24) / 2.5, ly = -h + 18 + i * (h - 30) / 7; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 6 + r() * 6, ly + r() * 3); ctx.stroke(); }
  ctx.fillStyle = 'rgba(80,110,60,0.6)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-w + r() * w * 2, -r() * h * 0.5, 8 + r() * 10, 4 + r() * 4, 0, 0, TAU); ctx.fill(); }
  if (unread) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,170,${0.06 + 0.1 * pulse})`; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -h); ctx.quadraticCurveTo(0, -h - 22, w, -h); ctx.lineTo(w, 0); ctx.fill(); }
  ctx.restore();
}
function drawShrine(ctx: G, x: number, y: number, t: number, r: () => number) {
  // 台基
  ctx.fillStyle = '#7a7064'; ctx.fillRect(x - 70, y - 12, 140, 14);
  // 墙
  ctx.fillStyle = '#9a4436'; ctx.fillRect(x - 54, y - 96, 108, 84);
  ctx.fillStyle = '#6a2a22'; ctx.fillRect(x - 22, y - 74, 44, 62);
  ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.arc(x, y - 44, 9, 0, TAU); ctx.fill();   // 神像微光
  // 屋顶
  ctx.fillStyle = '#3c3a3c'; ctx.beginPath(); ctx.moveTo(x - 82, y - 92); ctx.quadraticCurveTo(x - 40, y - 104, x, y - 140); ctx.quadraticCurveTo(x + 40, y - 104, x + 82, y - 92); ctx.lineTo(x + 70, y - 100); ctx.lineTo(x - 70, y - 100); ctx.fill();
  ctx.strokeStyle = '#2a282a'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 20, y - 97); ctx.lineTo(x + i * 8, y - 130); ctx.stroke(); }
  ctx.fillStyle = '#4a484a'; ctx.beginPath(); ctx.moveTo(x - 86, y - 90); ctx.quadraticCurveTo(x - 94, y - 96, x - 92, y - 104); ctx.lineTo(x - 80, y - 94); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 86, y - 90); ctx.quadraticCurveTo(x + 94, y - 96, x + 92, y - 104); ctx.lineTo(x + 80, y - 94); ctx.fill();
  // 香炉与青烟
  ctx.fillStyle = '#5a4a30'; ctx.beginPath(); ctx.ellipse(x - 34, y + 8, 14, 7, 0, 0, TAU); ctx.fill(); ctx.fillRect(x - 46, y - 6, 24, 14);
  ctx.save(); ctx.globalAlpha *= 0.5; ctx.strokeStyle = '#d8d4cc'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); const bx = x - 40 + i * 6; ctx.moveTo(bx, y - 8); for (let k = 1; k < 10; k++) ctx.lineTo(bx + Math.sin(t * 1.2 + k * 0.7 + i) * k * 1.6, y - 8 - k * 9); ctx.stroke(); }
  ctx.restore();
  // 红布条
  ctx.fillStyle = '#c03a2a'; ctx.fillRect(x + 56 + r() * 4, y - 90, 5, 40);
}
function drawPool(ctx: G, x: number, y: number, cold: boolean, t: number, r: () => number, treasure: boolean) {
  const w = 110 + r() * 30, h = 34 + r() * 10;
  ctx.fillStyle = cold ? '#c8d8e0' : '#7a8a6a'; ctx.beginPath(); ctx.ellipse(x, y, w + 12, h + 6, 0, 0, TAU); ctx.fill();
  const gr = ctx.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, cold ? '#0e1e2e' : '#123a3a'); gr.addColorStop(1, cold ? '#3a6a8a' : '#3a8a7a');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const k = (t * 0.2 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(x + 20, y - 4, w * 0.5 * k, h * 0.5 * k, 0, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 7; i++) { const a = r() * TAU; ctx.fillStyle = cold ? '#e8f0f4' : '#6e6a5c'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * (w + 6), y + Math.sin(a) * (h + 3), 10 + r() * 10, 6 + r() * 5, 0, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (treasure) { const k = Math.max(0, Math.sin(t * 1.3 + r() * 6)); ctx.fillStyle = `rgba(255,230,150,${0.5 * k})`; ctx.beginPath(); ctx.arc(x - 20, y + 4, 5, 0, TAU); ctx.fill(); }
  for (let i = 0; i < 4; i++) { const k = (t * 0.08 + i / 4) % 1; ctx.fillStyle = `rgba(230,240,255,${Math.sin(k * Math.PI) * (cold ? 0.12 : 0.08)})`; ctx.beginPath(); ctx.ellipse(x - w * 0.6 + k * w * 1.2, y - 18 - k * 20, 50, 14, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawBones(ctx: G, x: number, y: number, t: number, r: () => number, haunted: boolean) {
  ctx.strokeStyle = '#d8d0bc'; ctx.lineCap = 'round';
  // 脊椎
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - 120, y - 10); ctx.quadraticCurveTo(x, y - 46, x + 110, y - 14); ctx.stroke();
  // 肋骨
  ctx.lineWidth = 5;
  for (let i = 0; i < 9; i++) { const k = i / 8, bx = x - 80 + k * 150, by = y - 10 - Math.sin(k * Math.PI) * 32; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 14, by - 50 - Math.sin(k * Math.PI) * 26, bx + 26, by - 10); ctx.stroke(); }
  // 兽颅
  ctx.fillStyle = '#e0d8c4'; ctx.beginPath(); ctx.moveTo(x - 120, y - 12); ctx.lineTo(x - 176, y - 4); ctx.lineTo(x - 168, y - 30); ctx.quadraticCurveTo(x - 140, y - 44, x - 116, y - 26); ctx.fill();
  ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(x - 142, y - 26, 6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 132, y - 36); ctx.quadraticCurveTo(x - 128, y - 70, x - 106, y - 80); ctx.stroke();
  // 断剑残戟
  for (let i = 0; i < 5; i++) { const sx = x - 150 + r() * 300, sy = y + 10 + r() * 20, a = (r() - 0.5) * 0.7; ctx.strokeStyle = r() < 0.5 ? '#7a6a5a' : '#8a8e94'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(a) * 60, sy - Math.cos(a) * 60); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx + Math.sin(a) * 14 - 8, sy - Math.cos(a) * 14); ctx.lineTo(sx + Math.sin(a) * 14 + 8, sy - Math.cos(a) * 14); ctx.stroke(); }
  if (haunted) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const k = (t * 0.12 + i / 6) % 1; ctx.fillStyle = `rgba(170,140,255,${Math.sin(k * Math.PI) * 0.12})`; ctx.beginPath(); ctx.ellipse(x - 140 + k * 280, y - 30 - Math.sin(t + i) * 20, 70, 18, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
}
