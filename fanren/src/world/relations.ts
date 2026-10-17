// 第二十九步：人情世故——好感分档、人脉网、仇恨蔓延、追杀 / 雇凶 / 悬赏 / 宗门围剿、化解恩怨、结伴 / 护法 / 结拜 / 师徒
//
// · 每个 NPC 对你有好感（-100…100）与仇怨（0 无 / 1 仇人：见面就动手 / 2 死敌：主动追杀）
// · NPC 之间有亲族、好友、师徒、道侣、结义、宿敌等关系（ties）；你杀了谁，他的亲族、师徒、道侣会记你一辈子，好友多半也会
// · 宗门对你有声望（ws.rel.sect）：杀其门人会大降；跌破 -60，宗门会派执法弟子围剿你
// · 死敌若打不过你，会出重金雇凶（追杀）或张贴悬赏；悬赏会引来贪婪狠辣之辈
// · 人与人之间会传话：挚友替你美言，仇人在背后诋毁、挑拨
import type { Game } from './game';
import type { NpcData, Pers } from './npc';
import { npcMap } from './npc';
import { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP, locsOf } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import * as C from './cultivation';
import { ITEM_LIST, itemDef } from '../data/items';
import type { DNode, DOpt } from './modal';

export type TieKind = 'kin' | 'friend' | 'master' | 'disciple' | 'sworn' | 'lover' | 'foe';
/** r：对方是我的什么人（兄 / 妹 / 父 / 师父 / 徒儿 / 好友 / 道侣 / 义兄 / 宿敌……） */
export interface Tie { id: string; k: TieKind; r: string }
export type Bond = 'sworn' | 'master' | 'disciple' | 'companion' | 'guard';
export interface Wanted { by: string; name: string; amount: number; day: number; reason: string }
export interface RelLog { day: number; text: string; kind?: 'good' | 'bad' | 'info' }
export interface RelState {
  sect: Record<string, number>;
  wanted: Wanted[];
  log: RelLog[];
  story: Record<string, any>;
  siegeCd: number; hireCd: number; hunterCd: number; mediateCd: number; monthly: number;
}
export type Tier = '陌生' | '相识' | '好友' | '挚友' | '结拜' | '道侣' | '师父' | '徒弟' | '同行' | '护法' | '厌恶' | '仇人' | '死敌';
export const TIER_COLOR: Record<Tier, string> = {
  陌生: '#9a9284', 相识: '#d8d0bc', 好友: '#9fd08a', 挚友: '#5fc87a', 结拜: '#e8c060', 道侣: '#f090b0', 师父: '#a0c8f0', 徒弟: '#a0d8e0',
  同行: '#b8e0a0', 护法: '#c0b890', 厌恶: '#d8a070', 仇人: '#ff7a5a', 死敌: '#ff3a3a',
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const lv = (r: number, s: number) => r * 13 + s;
const COMPOUND = ['欧阳', '慕容', '上官', '司马'];
export const surnameOf = (n: string) => (COMPOUND.includes(n.slice(0, 2)) ? n.slice(0, 2) : n.slice(0, 1));
const pron = (d: NpcData) => (d.sex === 'f' ? '她' : '他');

export function newRelState(): RelState { return { sect: {}, wanted: [], log: [], story: {}, siegeCd: 0, hireCd: 0, hunterCd: 0, mediateCd: 0, monthly: 0 }; }

/** 我（a）眼中的 b：称谓 */
function kinLabel(a: NpcData, b: NpcData): [string, string] {
  const da = a.age - b.age;
  if (Math.abs(da) > 16) {
    // 亲子
    const older = da > 0 ? a : b, young = da > 0 ? b : a;
    const ol = older.sex === 'm' ? '父' : '母', yl = young.sex === 'm' ? '子' : '女';
    return da > 0 ? [yl, ol] : [ol, yl];   // [a 眼中 b, b 眼中 a]
  }
  const bl = b.sex === 'm' ? (b.age >= a.age ? '兄' : '弟') : (b.age >= a.age ? '姐' : '妹');
  const al = a.sex === 'm' ? (a.age > b.age ? '兄' : '弟') : (a.age > b.age ? '姐' : '妹');
  return [bl, al];
}
const KIN_WORD: Record<string, string> = { 父: '父亲', 母: '母亲', 子: '儿子', 女: '女儿', 兄: '兄长', 弟: '弟弟', 姐: '姐姐', 妹: '妹妹' };
export const relWord = (r: string) => KIN_WORD[r] ?? r;

export class Relations {
  game: Game;
  private tick = 0;
  constructor(g: Game) { this.game = g; }
  get S(): RelState { const ws = this.game.ws as any; return (ws.rel ??= newRelState()); }
  get npcs() { return this.game.npcs; }
  power(d: NpcData) { return lv(d.realm, d.stage); }
  playerLv() { const h = this.game.hero; return lv(h.realm, h.stage); }
  sectName(id?: string) { return id ? LOC_BY_ID.get(id)?.name ?? id : ''; }
  log(text: string, kind: RelLog['kind'] = 'info') { const L = this.S.log; L.push({ day: Math.floor(this.game.day), text, kind }); if (L.length > 120) L.splice(0, L.length - 120); }

  // ------------------------------------------------------------ 关系网生成
  link(a: NpcData, b: NpcData, k: TieKind, ra: string, rb: string) {
    if (a === b) return;
    (a.ties ??= []); (b.ties ??= []);
    if (a.ties.some((t) => t.id === b.id) || b.ties.some((t) => t.id === a.id)) return;
    a.ties.push({ id: b.id, k, r: ra }); b.ties.push({ id: a.id, k: k === 'master' ? 'disciple' : k === 'disciple' ? 'master' : k, r: rb });
  }
  unlink(a: NpcData, b: NpcData) { a.ties = a.ties?.filter((t) => t.id !== b.id); b.ties = b.ties?.filter((t) => t.id !== a.id); }
  tieOf(a: NpcData, bId: string) { return a.ties?.find((t) => t.id === bId); }
  /** 新世界 / 旧存档：编织人脉。rename=true 时为亲族统一姓氏（仅新世界） */
  genTies(list: NpcData[], rnd: () => number, rename: boolean) {
    const byHome = new Map<string, NpcData[]>();
    for (const d of list) { if (!d.alive) continue; (byHome.get(d.home) ?? byHome.set(d.home, []).get(d.home)!).push(d); }
    const free = (d: NpcData) => !d.canon && !d.beauty;
    for (const [, grp] of byHome) {
      const g2 = grp.filter(free);
      // 亲族：约两成的人在本地有一位亲人
      for (let i = 0; i + 1 < g2.length; i += 2) {
        if (rnd() > 0.22) continue;
        const a = g2[i], b = g2[i + 1];
        if (a.faction === 'mortal' && b.faction !== 'mortal' && rnd() < 0.5) continue;
        if (rename) b.name = surnameOf(a.name) + b.name.slice(surnameOf(b.name).length);
        else if (surnameOf(a.name) !== surnameOf(b.name)) continue;
        const [ra, rb] = kinLabel(a, b);
        this.link(a, b, 'kin', ra, rb);
      }
      // 好友
      for (const a of g2) {
        if (a.faction === 'mortal' && rnd() < 0.6) continue;
        const n = rnd() < 0.45 ? 1 : rnd() < 0.2 ? 2 : 0;
        for (let k = 0; k < n; k++) { const b = g2[Math.floor(rnd() * g2.length)]; if (b !== a && b.faction !== 'mortal' === (a.faction !== 'mortal')) this.link(a, b, 'friend', '好友', '好友'); }
      }
      // 道侣
      for (let i = 0; i < g2.length; i++) {
        const a = g2[i]; if (a.sex !== 'm' || a.realm === 0 || rnd() > 0.06) continue;
        const b = g2.find((x) => x.sex === 'f' && x.realm > 0 && Math.abs(x.age - a.age) < 40 && !x.ties?.length);
        if (b) this.link(a, b, 'lover', '道侣', '道侣');
      }
      // 师徒：宗门内高境界者收一两名弟子
      const sectM = g2.filter((d) => d.sect);
      for (const m of sectM) {
        if (m.realm < 2 || rnd() > 0.5) continue;
        const n = 1 + (rnd() < 0.4 ? 1 : 0);
        for (let k = 0; k < n; k++) { const s = sectM.find((x) => x.realm < m.realm && !x.ties?.some((t) => t.k === 'master') && rnd() < 0.3); if (s) this.link(m, s, 'disciple', '徒儿', '师父'); }
      }
    }
    // 宿敌：正邪之间的旧怨
    const fighters = list.filter((d) => d.alive && free(d) && d.realm > 0);
    for (let i = 0; i < fighters.length * 0.05; i++) {
      const a = fighters[Math.floor(rnd() * fighters.length)], b = fighters[Math.floor(rnd() * fighters.length)];
      if (a === b || npcMap(a) !== npcMap(b)) continue;
      const evil = (x: NpcData) => x.faction === 'demon' || x.pers === 'ruthless';
      if (evil(a) === evil(b) && rnd() < 0.7) continue;
      this.link(a, b, 'foe', '宿敌', '宿敌');
    }
    // 原著关系
    const L = (a: string, b: string, k: TieKind, ra: string, rb: string) => { const x = list.find((d) => d.id === a), y = list.find((d) => d.id === b); if (x && y) this.link(x, y, k, ra, rb); };
    L('wangchan', 'yanruyan', 'lover', '未婚妻', '未婚夫');
    L('hongfu', 'b_dongxuaner', 'disciple', '徒儿', '师父');
    L('xuangu', 'jiyin', 'foe', '逆徒', '旧师');
    L('lihuayuan', 'leiwanhe', 'friend', '师弟', '师兄');
    L('modaifu', 'lifeiyu', 'foe', '宿敌', '宿敌');
    L('o_mengtieyi', 'o_mengtieshan', 'kin', '弟', '兄');
    L('o_luqingya', 'o_huiming', 'friend', '好友', '好友');
    L('o_gusonghe', 'xiangzhili', 'friend', '故交', '故交');
    L('o_zhaowuji', 'hongfu', 'disciple', '徒儿', '师父');
    L('o_leijiu', 'o_liusanniang', 'friend', '老相识', '老相识');
  }
  ensureTies() {
    const list = this.npcs.list;
    if (list.some((d) => d.ties && d.ties.length)) return;
    this.genTies(list, Math.random, false);
  }

  // ------------------------------------------------------------ 档位
  tier(d: NpcData): Tier {
    if (d.bond === 'sworn') return '结拜';
    if (d.bond === 'master') return '师父';
    if (d.bond === 'disciple') return '徒弟';
    if (d.beauty && (this.game.ws.hearts[d.beauty] as any)?.flags?.companion) return '道侣';
    if ((d.grudge ?? 0) >= 2) return '死敌';
    if ((d.grudge ?? 0) >= 1) return '仇人';
    if (d.bond === 'companion' && (d.bondUntil ?? 0) > this.game.day) return '同行';
    if (d.bond === 'guard' && (d.bondUntil ?? 0) > this.game.day) return '护法';
    if (d.favor <= -15) return '厌恶';
    if (!d.met) return '陌生';
    if (d.favor >= 60) return '挚友';
    if (d.favor >= 30) return '好友';
    return '相识';
  }
  setFavor(d: NpcData, v: number) {
    d.favor = clamp(v, -100, 100);
    if (d.favor <= -55 && !d.grudge) { d.grudge = 1; d.why ??= '积怨已深'; }
  }
  addFavor(d: NpcData, dv: number) { this.setFavor(d, d.favor + dv); }
  /** 宗门声望 */
  sectRep(id?: string) { return id ? this.S.sect[id] ?? 0 : 0; }
  addSect(id: string | undefined, dv: number) { if (!id) return; this.S.sect[id] = clamp((this.S.sect[id] ?? 0) + dv, -100, 100); }
  wantedTotal() { return this.S.wanted.reduce((s, w) => s + w.amount, 0); }

  // ------------------------------------------------------------ 仇恨蔓延
  /** 你杀了 d。selfDefense：对方先动手 / 本就是恶人 */
  onPlayerKill(d: NpcData, selfDefense: boolean) {
    const g = this.game, by = this.npcs.byId;
    this.checkOath(d);
    const heard: string[] = [];
    for (const t of d.ties ?? []) {
      const o = by.get(t.id); if (!o || !o.alive) continue;
      const me = this.tieOf(o, d.id); const rel = relWord(me?.r ?? t.r);
      if (o.vow) { this.addFavor(o, -40); continue; }
      if (t.k === 'kin' || t.k === 'lover' || t.k === 'sworn' || t.k === 'master' || t.k === 'disciple') {
        o.grudge = 2; this.setFavor(o, Math.min(o.favor, -90));
        o.why = `你杀了${pron(o)}的${rel}${d.name}`; o.huntAt = g.day + rand(3, 14);
        heard.push(`${o.name}（${d.name}之${t.k === 'kin' ? relWord(t.r) : t.k === 'lover' ? '道侣' : t.k === 'master' ? '师' : t.k === 'disciple' ? '徒' : '义亲'}）`);
      } else if (t.k === 'friend') {
        if (!selfDefense || Math.random() < 0.5) { o.grudge = Math.max(o.grudge ?? 0, 1); this.setFavor(o, Math.min(o.favor, -50)); o.why ??= `你杀了${pron(o)}的好友${d.name}`; }
      } else if (t.k === 'foe') { this.addFavor(o, 22); }
    }
    if (d.sect) {
      const big = (d.realm >= 3 ? 2 : 1) * (d.canon ? 2 : 1);
      this.addSect(d.sect, -(selfDefense ? 6 : 25) * big);
      for (const o of this.npcs.list) {
        if (!o.alive || o.sect !== d.sect || o === d) continue;
        this.addFavor(o, -(selfDefense ? 3 : 12));
        if (!selfDefense && Math.random() < 0.25) { o.grudge = Math.max(o.grudge ?? 0, 1); o.why ??= `你杀了同门${d.name}`; }
      }
      const rep = this.sectRep(d.sect);
      if (!selfDefense && rep <= -40 && !this.S.wanted.some((w) => w.by === d.sect)) this.postBounty(d.sect, this.sectName(d.sect), Math.round(300 * Math.pow(2.2, Math.max(1, this.game.hero.realm))), `残害${this.sectName(d.sect)}门人`);
      if (rep <= -60) this.log(`${this.sectName(d.sect)}将你列为头号大敌，执法堂已在调派人手。`, 'bad');
    }
    // 他张贴的悬赏随之作废
    this.S.wanted = this.S.wanted.filter((w) => w.by !== d.id);
    if (heard.length) {
      const s = `你杀了${d.name}。消息传开后，${heard.slice(0, 3).join('、')}${heard.length > 3 ? '等人' : ''}发誓要你血债血偿。`;
      this.log(s, 'bad'); g.news(s, 'personal');
      g.toast(`${heard.length > 1 ? heard.length + ' 人' : heard[0]}与你结下了血仇（按 N 查看人脉）`, 'warn');
    }
  }
  /** NPC 之间的仇杀：死者的亲族记恨凶手 */
  onNpcKill(victim: NpcData, killer: NpcData) {
    for (const t of victim.ties ?? []) {
      if (t.k !== 'kin' && t.k !== 'lover' && t.k !== 'sworn' && t.k !== 'disciple' && t.k !== 'master') continue;
      const o = this.npcs.byId.get(t.id); if (!o || !o.alive || o === killer) continue;
      this.unlink(o, killer); this.link(o, killer, 'foe', '杀亲仇人', '仇家'); o.vend = killer.id;
      if (o.met && o.favor > 0) this.log(`${o.name}的${relWord(this.tieOf(o, victim.id)?.r ?? '亲人')}${victim.name}死于${killer.name}之手，${o.name}誓报此仇。`);
    }
  }
  postBounty(by: string, name: string, amount: number, reason: string) {
    const w = this.S.wanted.find((x) => x.by === by);
    if (w) { w.amount += Math.round(amount * 0.5); w.day = this.game.day; }
    else this.S.wanted.push({ by, name, amount, day: Math.floor(this.game.day), reason });
    const s = `坊间传闻：${name}悬赏 ${amount} 灵石，取韩立项上人头（${reason}）。`;
    this.game.news(s, 'rumor'); this.log(s, 'bad');
    this.game.toast(`有人悬赏 ${amount} 灵石买你的命——贪财之辈会盯上你。`, 'warn');
  }
  /** 立誓之后又对其人或其亲族下杀手：心魔反噬 */
  checkOath(d: NpcData) {
    const by = this.npcs.byId;
    const sworn = d.oath ? d : (d.ties ?? []).map((t) => by.get(t.id)).find((o) => o?.oath && this.tieOf(o, d.id)?.k === 'kin');
    if (!sworn) return;
    const g = this.game, h = g.hero, msgs: C.Msg[] = [];
    const loss = C.need(h) * 0.25; h.exp = Math.max(0, h.exp - loss);
    h.hp = Math.min(h.hp, 0.3); h.mp = Math.min(h.mp, 0.2);
    g.ws.rep = clamp(g.ws.rep - 12, -100, 100);
    sworn.oath = false;
    void msgs;
    g.toast(`你曾对${sworn.name}立下心魔大誓——誓言反噬，心魔丛生，修为大损！`, 'warn');
    this.log(`违背了对${sworn.name}的誓言，遭心魔反噬（修为 -${Math.round(loss)}）。`, 'bad');
    g.news(`韩立背誓杀人，遭心魔反噬。`, 'rumor');
  }

  // ------------------------------------------------------------ 每帧（每秒一次）：同行者 / 护法跟随
  update(dt: number) {
    this.tick -= dt; if (this.tick > 0) return; this.tick = 1;
    const g = this.game, npcs = this.npcs;
    for (const d of npcs.list) {
      if (!d.bond || !d.alive) continue;
      const follow = (d.bond === 'companion' || d.bond === 'guard') && (d.bondUntil ?? 0) > g.day || (d.helpUntil ?? 0) > g.time;
      const a = npcs.activeOf(d.id);
      if (follow) { if (!a || a.act !== 'follow') npcs.summon(d.id); }
      else if ((d.bond === 'companion' || d.bond === 'guard') && (d.bondUntil ?? 0) <= g.day) {
        if (a && a.act === 'follow') npcs.dismiss(d.id);
        g.toast(d.bond === 'guard' ? `${d.name}护法期满，拱手告辞。` : `${d.name}与你同行多日，就此别过：「后会有期！」`, 'info');
        this.log(`${d.name}${d.bond === 'guard' ? '护法期满离去' : '与你分道扬镳'}。`);
        if (d.bond === 'companion') this.addFavor(d, 6);
        d.bond = undefined; d.bondUntil = undefined;
      }
    }
    // 义兄弟 / 师父：你身陷险境时赶来相助
    if (g.combat.inCombat && g.hero.hp < 0.4 && !g.hero.dead) {
      for (const d of npcs.list) {
        if (!d.alive || (d.bond !== 'sworn' && d.bond !== 'master') || (d.helpUntil ?? 0) > g.time || ((d as any).helpCd ?? -1e9) > g.day || npcs.activeOf(d.id)?.act === 'follow') continue;
        if (Math.random() > (d.bond === 'sworn' ? 0.6 : 0.35)) { (d as any).helpCd = g.day + 1; continue; }
        (d as any).helpCd = g.day + 3; d.helpUntil = g.time + 45; npcs.summon(d.id);
        const a = npcs.activeOf(d.id); if (a) a.bubble = { text: d.bond === 'sworn' ? '兄弟莫慌，我来也！' : '孽障，休伤我徒儿！', t: 3 };
        g.toast(d.bond === 'sworn' ? `义${d.sex === 'f' ? '姐' : '兄'}${d.name}闻讯赶来助阵！` : `师父${d.name}破空而至！`, 'good');
        break;
      }
    }
    // 救援的义兄弟：时间到了就回去
    for (const d of npcs.list) if (d.helpUntil && d.helpUntil <= g.time && !d.bond?.match(/companion|guard/)) { d.helpUntil = undefined; npcs.dismiss(d.id); }
  }

  // ------------------------------------------------------------ 每日
  daily(days: number) {
    const g = this.game, S = this.S, npcs = this.npcs, day = g.day, pl = this.playerLv(), h = g.hero;
    const sameMap = (d: NpcData) => npcMap(d) === ACTIVE_MAP;
    for (const d of npcs.list) {
      if (!d.alive) continue;
      // 追杀超时
      if (d.hunting && day - (d.huntStart ?? day) > 8) d.hunting = false;
      // 死敌：亲自追杀 / 雇凶 / 悬赏
      if ((d.grudge ?? 0) >= 2 && d.realm > 0 && !d.beauty && !d.stay && d.huntAt !== undefined && day >= d.huntAt && !npcs.activeOf(d.id) && h.realm >= 1) {
        d.huntAt = day + rand(25, 70);
        const gap = this.power(d) - pl;
        if (gap >= -4 || d.pers === 'arrogant' || Math.random() < 0.15) { if (!this.startHunt(d)) d.huntAt = day + rand(1, 3); }
        else if (d.wealth >= 300 && S.hireCd <= day && !g.pursuit.active) {
          S.hireCd = day + 40; d.wealth = Math.round(d.wealth * 0.4);
          if (g.pursuit.schedule({ reason: `${d.name}${d.why ? '（' + d.why + '）' : ''}出重金雇凶取你性命`, gap: Math.random() < 0.5 ? 1 : 0, faction: 'jiexiu', delay: rand(20, 60) })) this.log(`${d.name}出重金雇了杀手。`, 'bad');
        } else this.postBounty(d.id, d.name, Math.round(Math.max(150, d.wealth * 0.6) + 120 * d.realm * d.realm), d.why ?? '私仇');
      }
      // NPC 之间的仇杀
      if (d.vend && Math.random() < 1 - Math.pow(0.99, days)) {
        const k = npcs.byId.get(d.vend);
        if (!k || !k.alive) d.vend = undefined;
        else if (!npcs.activeOf(d.id) && !npcs.activeOf(k.id) && npcMap(k) === npcMap(d)) {
          const win = this.power(d) + rand(-4, 4) > this.power(k);
          const [w, l] = win ? [d, k] : [k, d];
          npcs.die(l, `死于${w.name}之手（仇杀）`); d.vend = undefined;
          if (w.met || l.met || l.canon) g.news(`传闻${w.name}与${l.name}了结旧仇，${l.name}身死道消。`, 'rumor');
          this.onNpcKill(l, w);
        }
      }
      // 好感随岁月淡去（结义 / 师徒 / 死敌不在此列）
      if (!d.bond && d.met && Math.random() < days / 45) { if (d.favor > 5 && d.favor < 60) d.favor -= 1; else if (d.favor < -5 && !d.grudge) d.favor += 1; }
      if (d.grudge === 1 && d.why !== undefined && Math.random() < days / 1500) { d.grudge = 0; d.why = undefined; }
    }
    // 宗门围剿
    for (const [sid, rep] of Object.entries(S.sect)) {
      if (rep > -60 || S.siegeCd > day || h.realm < 1) continue;
      const loc = LOC_BY_ID.get(sid); if (!loc || loc.map !== ACTIVE_MAP) continue;
      if (Math.random() < 1 - Math.pow(0.97, days)) { this.siege(sid); break; }
    }
    if (S.wanted.length) {
      // 张榜的宗门气消了，悬赏撤下
      S.wanted = S.wanted.filter((w) => { const sl = LOC_BY_ID.get(w.by); if (sl) return this.sectRep(w.by) <= -20; const p = npcs.byId.get(w.by); return !!p && p.alive; });
      const tot = this.wantedTotal();
      if (tot >= 400 && S.hunterCd <= day && !g.pursuit.active && Math.random() < 1 - Math.pow(0.985, days)) {
        S.hunterCd = day + 45;
        const bx = npcs.byId.get('o_baixiao');
        if (bx && bx.alive && !S.story.o_baixiao?.ally && sameMap(bx) && Math.random() < 0.6) {
          bx.why = `为 ${tot} 灵石的悬赏而来`; bx.met = true; this.startHunt(bx, true, true);
          g.toast('一个背着长刀的黑衣人在打听你的去向……（赏金客白枭）', 'warn');
          this.log('赏金客白枭揭下了你的悬赏令。', 'bad');
        } else {
          g.pursuit.schedule({ reason: `为 ${tot} 灵石的悬赏而来`, gap: tot > 3000 ? 1 : 0, faction: 'jiexiu', delay: rand(15, 50) });
          this.log('一名赏金客揭下了你的悬赏令。', 'bad');
        }
      }
    }
    // 口耳相传：美言 / 诋毁 / 挑拨
    const N = Math.min(80, Math.ceil(days * 8));
    const L = npcs.list;
    for (let i = 0; i < N; i++) {
      const d = L[Math.floor(Math.random() * L.length)];
      if (!d.alive || !d.ties?.length || (!d.met && !d.grudge)) continue;
      for (const t of d.ties) {
        if (t.k === 'foe') continue;
        const o = npcs.byId.get(t.id); if (!o || !o.alive || o.bond) continue;
        const before = this.tier(o);
        if (d.favor >= 50 && o.favor < d.favor * 0.5) this.addFavor(o, 2);
        else if ((d.favor <= -40 || d.grudge) && o.favor > -30) this.addFavor(o, -3);
        const after = this.tier(o);
        if (o.met && before !== after) {
          if (after === '厌恶' || after === '仇人') this.log(`听说${d.name}常在${o.name}面前说你的坏话，${o.name}对你渐生嫌隙。`, 'bad');
          else if (after === '好友') this.log(`${d.name}在${o.name}面前替你美言，${o.name}对你颇有好感。`, 'good');
        }
      }
      // 挑拨：狠毒之人在你的朋友面前搬弄是非
      if ((d.grudge || d.favor <= -40) && (d.pers === 'ruthless' || d.pers === 'greedy' || d.pers === 'arrogant') && Math.random() < 0.05 * days) {
        const f = L.find((o) => o.alive && o.met && o.favor >= 30 && !o.bond && (o.home === d.home || (o.sect && o.sect === d.sect)));
        if (f) { this.addFavor(f, -12); this.log(`${d.name}在${f.name}面前挑拨离间，${f.name}待你冷淡了几分。`, 'bad'); }
      }
    }
    // 师徒、义亲：每月往来
    if (day - S.monthly >= 30) { S.monthly = day; this.monthly(); }
    // 原著人物赴约：虚天殿 / 坠魔谷开启时，现身其地
    this.canonVisits();
    void sameMap;
  }

  /** 死敌循迹而来：出现在神识之外，逐渐逼近 */
  startHunt(d: NpcData, quiet = false, force = false, allies?: NpcData[]) {
    const g = this.game, p = g.player;
    if (!force && g.combat.safeAt(p.x, p.y) && Math.random() < 0.5) return false;
    // 第三十二步：筑基以上的仇人亲自驾遁光杀来（遁光 / 血遁 / 土遁伏击 / 护体灵光 / 困阵定身）
    if (d.realm >= 2 && !g.pursuit.active && !this.npcs.activeOf(d.id) && g.hero.realm >= 1) {
      g.pursuit.cd = 0;
      if (g.pursuit.start({ reason: d.why ?? '仇家寻仇', npc: d, allies, why: d.why })) {
        d.hunting = false; d.huntStart = g.day;
        this.log(`${d.name}（${d.why ?? '仇家'}）亲自追杀你${allies?.length ? `，带着${allies.map((a) => a.name).join('、')}` : ''}。`, 'bad');
        return true;
      }
    }
    d.map = ACTIVE_MAP; d.hunting = true; d.huntStart = g.day;
    const a0 = Math.random() * Math.PI * 2, R = Math.max(2800, g.senseRadius * 1.6);
    for (let k = 0; k < 8; k++) { const a = a0 + k * 0.8, x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R * 0.8; if (g.terrain.walkFactor(x, y) > 0 || d.realm >= 2) { d.x = x; d.y = y; break; } }
    d.tx = p.x; d.ty = p.y; d.goal = 'travel';
    if (quiet) return true;
    const warn = this.S.story.liusanniang?.warn;
    if (warn) g.toast(`柳三娘传来密信：${d.name}（${realmName(d.realm, d.stage)}）正循着你的踪迹而来！`, 'warn');
    else g.toast('心血来潮，似有一股杀机自远方遥遥锁定了你……', 'warn');
    this.log(`${d.name}（${d.why ?? '仇家'}）开始追杀你。`, 'bad');
    return true;
  }
  siege(sid: string) {
    const g = this.game, S = this.S, pl = this.playerLv();
    const mem = this.npcs.list.filter((d) => d.alive && d.sect === sid && d.realm >= 1 && !d.stay && !d.beauty && !d.bond).sort((a, b) => this.power(b) - this.power(a));
    const pickd = mem.filter((d) => this.power(d) >= pl - 8).slice(0, 4);
    const team = pickd.length >= 2 ? pickd : mem.slice(0, 3);
    if (!team.length) return;
    S.siegeCd = g.day + 50;
    const lead = team[0];
    for (const d of team) { d.grudge = Math.max(d.grudge ?? 0, 1); d.why = `奉${this.sectName(sid)}之命围剿你`; }
    // 第三十二步：筑基以上的头领带两名同门以遁光合围；其余仍循迹而来
    const viaP = lead.realm >= 2 && !g.pursuit.active && this.startHunt(lead, true, true, team.slice(1, 3));
    for (const d of team) { if (viaP && (d === lead || d.chasing)) continue; this.startHunt(d, true, true); if (d !== lead) { d.x = lead.x + rand(-220, 220); d.y = lead.y + rand(-160, 160); } }
    const s = `${this.sectName(sid)}执法弟子${team.length}人，由${lead.name}（${realmName(lead.realm, lead.stage)}）率领，出山围剿韩立！`;
    g.news(s, 'rumor'); this.log(s, 'bad');
    g.toast(`${this.sectName(sid)}派出执法弟子围剿你——数道神识正从远处合围而来！`, 'warn');
  }
  private monthly() {
    const g = this.game, h = g.hero;
    for (const d of this.npcs.list) {
      if (!d.alive || !d.bond) continue;
      if (d.bond === 'master') {
        const msgs: C.Msg[] = []; const exp = C.need(h) * 0.05; C.gainExp(h, exp, msgs);
        let gift = '';
        if (Math.random() < 0.25) { const sk = g.combat.randomScroll(Math.min(4, d.realm)); if (sk) { C.addItem(h, sk, 1); gift = `，并赐下${itemDef(sk).name}`; } }
        g.toast(`师父${d.name}传音指点你修行（修为 +${Math.round(exp)}）${gift}。`, 'good'); this.log(`师父${d.name}传音指点${gift}。`, 'good');
      } else if (d.bond === 'disciple') {
        const herbs = ITEM_LIST.filter((it) => it.type === 'herb' && it.tier <= Math.max(1, d.realm) && it.price > 0);
        if (herbs.length && Math.random() < 0.6) { const it = pick(herbs); C.addItem(h, it.id, 1 + Math.floor(Math.random() * 2)); g.toast(`徒儿${d.name}托人送来${it.name}，聊表孝心。`, 'good'); }
        else { const n = Math.round(15 * Math.pow(3, d.realm)); C.addItem(h, 'mat_lingshi', n); g.toast(`徒儿${d.name}送来灵石 ${n}。`, 'good'); }
        // 有师父照拂，进境更快
        if (d.realm > 0 && Math.random() < 0.25) { const R = REALMS[d.realm]; if (d.stage < R.stages.length - 1) d.stage++; }
      } else if (d.bond === 'sworn' && Math.random() < 0.3) {
        const n = Math.round(30 * Math.pow(3, d.realm)); C.addItem(h, 'mat_lingshi', n);
        g.toast(`义${d.sex === 'f' ? '姐' : '兄'}${d.name}托人捎来灵石 ${n}：「兄弟在外，别亏了自己。」`, 'good');
      }
    }
  }
  private canonVisits() {
    const g = this.game, ev = g.ws.events;
    const V: [string, string[]][] = [['xutian', ['jiyin', 'manhuzi', 'wentianren']], ['zhuimo', ['nanlonghou', 'b_ziling']]];
    for (const [eid, ids] of V) {
      const on = ev[eid]?.state === 'active';
      const loc = LOC_BY_ID.get(eid); if (!loc) continue;
      for (const id of ids) {
        const d = this.npcs.byId.get(id); if (!d || !d.alive || d.bond) continue;
        if (on && d.home !== eid) { d.home0 = d.home; d.home = eid; d.map = loc.map; if (!this.npcs.activeOf(id)) { d.x = d.tx = loc.x * WORLD_SCALE + rand(-900, 900); d.y = d.ty = loc.y * WORLD_SCALE + rand(-500, 700); } }
        else if (!on && d.home0) { d.home = d.home0; d.home0 = undefined; const h0 = LOC_BY_ID.get(d.home); if (h0 && !this.npcs.activeOf(id)) { d.map = h0.map; d.x = d.tx = h0.x * WORLD_SCALE; d.y = d.ty = h0.y * WORLD_SCALE + 200; } }
      }
    }
  }

  // ------------------------------------------------------------ 敌意判定（补充 npc.hostileTo）
  hostileExtra(d: NpcData) {
    if (d.vow && !d.hunting) return false;
    if (d.hunting || (d.grudge ?? 0) > 0 || d.favor <= -50) return true;
    if (d.bond) return false;
    const tot = this.wantedTotal();
    if (tot >= 300 * (1 + d.realm) && (d.pers === 'greedy' || d.pers === 'ruthless') && (d.faction === 'rogue' || d.faction === 'demon')) return true;
    if (d.sect && this.sectRep(d.sect) <= -45 && d.realm > 0) return true;
    return false;
  }
  /** 接近你时的喊话 */
  approachLine(d: NpcData) {
    if (d.why && (d.grudge ?? 0) >= 2) return pick([`${d.why.replace('你', '你')}——今日血债血偿！`, '找了你这么久，总算让我撞上了！', `${d.name}在此，拿命来！`]);
    if (d.why?.startsWith('奉')) return pick(['奉宗门之命，取你性命！', '魔头，哪里走！', '布阵，别让他跑了！']);
    if ((d.grudge ?? 0) >= 1) return '冤家路窄！今日便了结旧账！';
    if (this.wantedTotal() >= 300) return pick(['悬赏令上的人——可不就是你！', '嘿嘿，几千灵石送上门来了。']);
    return '';
  }

  // ------------------------------------------------------------ 对峙：化解恩怨的机会
  canParley(d: NpcData) { return (d.grudge ?? 0) > 0 && (d.lastParley ?? -99) < this.game.day - 5 && !d.why?.startsWith('奉'); }
  parleyCost(d: NpcData) { return Math.round(60 * Math.pow(3, d.realm) * (d.grudge ?? 1) * (d.pers === 'greedy' ? 0.8 : 1)); }
  mediator(d: NpcData): NpcData | null {
    const by = this.npcs.byId;
    for (const t of d.ties ?? []) { const o = by.get(t.id); if (o && o.alive && o.favor >= 60 && (t.k === 'kin' || t.k === 'friend' || t.k === 'master' || t.k === 'disciple' || t.k === 'sworn')) return o; }
    const hm = by.get('o_huiming'); if (hm && hm.alive && hm.met && hm.favor >= 30) return hm;
    return null;
  }
  /** 对峙对话：赔礼 / 立誓 / 请人说和 / 动手 */
  parleyNode(d: NpcData, look: any, onFight: () => void, onCalm: () => void): DNode {
    const g = this.game, h = g.hero; d.lastParley = g.day; d.met = true;
    const cost = this.parleyCost(d), have = C.bagCount(h, 'mat_lingshi');
    const g2 = (d.grudge ?? 0) >= 2;
    const title = `${realmName(d.realm, d.stage)} · ${this.tier(d)}`;
    const after = (text: string, ok: boolean): DNode => ({ speaker: d.name, title, look, text, options: [{ label: ok ? '（拱手作别）' : '（准备迎战）', tone: ok ? 'good' : 'bad', act: () => { (ok ? onCalm : onFight)(); return null; } }], mood: ok ? 'normal' : 'danger' });
    const persK: Record<Pers, number> = { righteous: 0.8, kind: 0.9, cautious: 0.7, aloof: 0.6, greedy: 0.75, arrogant: 0.45, ruthless: 0.3 };
    const reduce = (by: number, favorTo: number) => { d.grudge = Math.max(0, (d.grudge ?? 0) - by); if (!d.grudge) { d.why = undefined; d.hunting = false; } this.setFavor(d, Math.max(d.favor, favorTo)); };
    const opts: DOpt[] = [
      { label: `赔礼谢罪（灵石 ${cost}）`, disabled: have < cost, hint: have < cost ? '灵石不足' : '', act: () => {
        const p = persK[d.pers] * (g2 ? (d.pers === 'greedy' ? 0.55 : 0.3) : 1);
        if (Math.random() < p) { C.removeItem(h, 'mat_lingshi', cost); reduce(1, g2 ? -40 : -5); this.log(`向${d.name}赔礼谢罪，${g2 ? '血仇稍解' : '前嫌尽释'}。`, 'good'); return after(g2 ? '（对方盯着灵石看了许久，咬牙收下）……这笔账，暂且记下。你好自为之。' : '哼……看在你还算识相的份上，此事就此揭过。', true); }
        return after(g2 ? '灵石？你以为灵石能买回一条人命！' : '收起你的臭钱！', false);
      } },
      { label: '以心魔立誓，永不与其为敌', act: () => {
        const p = persK[d.pers] * (g2 ? 0.55 : 1) * (d.pers === 'ruthless' ? 0.5 : 1);
        if (Math.random() < p) { d.oath = true; reduce(2, 0); this.log(`对${d.name}立下心魔大誓：此生不与其及其亲族为敌。`, 'good'); return after('（对方神识在你身上停了良久）……心魔誓不是儿戏。你若违誓，自有天收。我们走。', true); }
        return after('誓言？我不信你。', false);
      } },
    ];
    const m = this.mediator(d);
    if (m && this.S.mediateCd <= g.day) opts.push({ label: `请${m.name}从中说和`, tone: 'good', act: () => {
      this.S.mediateCd = g.day + 40;
      if (Math.random() < (g2 ? 0.55 : 0.85)) { reduce(g2 ? 1 : 2, g2 ? -30 : 5); this.addFavor(m, -4); this.log(`${m.name}出面调停，你与${d.name}的恩怨${g2 ? '稍有缓和' : '一笔勾销'}。`, 'good'); return after(`（${m.name}的传音符适时飞到，两人低声说了几句）……既然${m.name}开口，今日便饶你一回。`, true); }
      return after(`${m.name}的面子我给不起——今日你我只能活一个！`, false);
    } });
    opts.push({ label: '多说无益，动手！', tone: 'bad', act: () => { onFight(); return null; } });
    const line = g2 ? `（${d.name}拦住你的去路，周身杀气翻涌）${d.why ?? ''}……你还有什么话说？` : `（${d.name}冷冷地挡在你面前）${d.why ? d.why + '。' : ''}今日之事，你打算如何了结？`;
    return { speaker: d.name, title, look, text: line, options: opts, mood: 'danger' };
  }

  // ------------------------------------------------------------ 求饶
  yieldNode(d: NpcData, e: any, look: any, a: any): DNode {
    const g = this.game, h = g.hero;
    const title = `${realmName(d.realm, d.stage)} · ${this.tier(d)}`;
    const done = (text: string): DNode => ({ speaker: d.name, title, look, text, options: [{ label: '（收手）', act: () => null }] });
    const spare = () => { g.combat.release(e); d.hunting = false; if (a) a.act = 'flee'; };
    const g2 = (d.grudge ?? 0) >= 2;
    const L: Record<Pers, string> = {
      kind: '（对方踉跄后退，连连摆手）住手！住手！在下认输……道友饶命！', cautious: '（对方收起法器，脸色煞白）道友神通，在下服了。今日之事是在下鲁莽，还请高抬贵手。',
      greedy: '（对方扑通跪下）好汉饶命！储物袋、灵石都给你，都给你！', righteous: '（对方以剑拄地，喘息不止）……技不如人，无话可说。你要杀便杀。',
      aloof: '（对方拭去嘴角血迹，神色淡然）败了便是败了。', arrogant: '（对方咬牙切齿）你……你敢杀我？你可知我是谁！', ruthless: '（对方伏在地上，眼底闪过一丝阴狠）……我认栽。饶我一命，日后必有厚报。',
    };
    const opts: DOpt[] = [
      { label: '饶他一命', tone: 'good', act: () => {
        spare(); g.ws.rep = clamp(g.ws.rep + 2, -100, 100);
        if (g2) {
          if (d.pers !== 'ruthless' && Math.random() < 0.5) { d.grudge = 1; this.setFavor(d, Math.max(d.favor, -40)); this.log(`饶了${d.name}一命，血仇稍解。`, 'good'); return done('（对方愣住了，良久才开口）……今日不杀之恩，我记下了。可那笔血债，未必就此两清。'); }
          this.log(`饶了${d.name}一命，对方却并不领情。`); return done('（对方化作一道遁光逃远，临走前回头看了你一眼——那眼神里只有怨毒）');
        }
        const turn = d.pers === 'ruthless' ? Math.random() < 0.35 : d.pers === 'arrogant' ? Math.random() < 0.6 : Math.random() < 0.9;
        if (turn) { d.grudge = 0; d.why = undefined; this.setFavor(d, Math.max(d.favor, d.pers === 'kind' || d.pers === 'righteous' ? 35 : 10)); this.log(`饶了${d.name}一命，对方感激不尽。`, 'good'); return done('多谢不杀之恩！今日是我有眼无珠——这份情，我记下了。'); }
        d.grudge = Math.max(d.grudge ?? 0, 1); d.why ??= '败在你手下，怀恨在心'; return done('（对方口中称谢，转身时眼底却闪过一丝阴狠）');
      } },
      { label: '索要买命钱', act: () => {
        const n = Math.max(12, Math.round(d.wealth * 0.6)); d.wealth -= n; C.addItem(h, 'mat_lingshi', n);
        let extra = ''; if (d.realm >= 1 && Math.random() < 0.35) { const sk = g.combat.randomScroll(Math.min(4, d.realm)); if (sk) { C.addItem(h, sk, 1); extra = `、${itemDef(sk).name}`; } }
        spare(); d.grudge = Math.max(d.grudge ?? 0, 1); d.why ??= '被你逼出了买命钱'; this.setFavor(d, Math.min(d.favor, -35));
        this.log(`逼${d.name}交出买命钱。`); return done(`（对方哆嗦着解下储物袋扔给你，转身便逃）\n\n获得 灵石 ${n}${extra}`);
      } },
      { label: '逼他立下心魔誓，永不与你为敌', act: () => {
        spare(); d.vow = true; d.grudge = 0; d.why = undefined; d.hunting = false; this.setFavor(d, Math.max(d.favor, -10));
        this.log(`${d.name}对你立下心魔大誓，此生不再与你为敌。`, 'good');
        return done(`（对方并指向天，一字一顿）我${d.name}以心魔起誓：此生不再与韩立为敌，如违此誓，心魔噬身，道消身陨。\n\n（${d.name}再也不会主动与你为敌）`);
      } },
      { label: '斩草除根', tone: 'bad', act: () => { g.combat.finish(e); return null; } },
    ];
    return { speaker: d.name, title, look, text: L[d.pers], options: opts, mood: 'danger' };
  }
  /** 拍卖会后：贪财之辈远远缀上你 */
  tail(): boolean {
    const g = this.game, p = g.player, pl = this.playerLv();
    let best: NpcData | null = null, bd = 9000;
    for (const d of this.npcs.list) {
      if (!d.alive || d.realm < 1 || d.canon || d.bond || d.stay || d.vow || npcMap(d) !== ACTIVE_MAP) continue;
      if (!(d.pers === 'greedy' || d.pers === 'ruthless' || d.faction === 'demon')) continue;
      const gap = this.power(d) - pl; if (gap < -3 || gap > 7) continue;
      const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < bd) { bd = dd; best = d; }
    }
    if (!best) return false;
    best.why = '觊觎你在拍卖会上拍得的宝物'; best.met = true;
    this.startHunt(best, true, true);
    g.toast('出城不久，你察觉到身后远远缀着一道神识……', 'warn');
    this.log(`${best.name}（${realmName(best.realm, best.stage)}）在拍卖会后尾随而来，意图夺宝。`, 'bad');
    return true;
  }

  // ------------------------------------------------------------ 交谈中的新动作
  /** 加入 NPC 主对话的选项（论道 / 以物易物 / 结伴 / 护法 / 结拜 / 拜师 / 收徒 / 化解 / 结仇） */
  talkOpts(a: any, title: string, back: () => DNode): DOpt[] {
    const g = this.game, d: NpcData = a.d, h = g.hero, day = g.day;
    const gap = this.power(d) - this.playerLv();
    const opts: DOpt[] = [];
    const end = (text: string, more: DOpt[] = []): DNode => ({ speaker: d.name, title, look: a.look, text, options: [...more, { label: '还有别的事', act: back }, { label: '告辞', act: () => null }] });
    if (d.faction === 'mortal' && d.realm === 0) return opts;
    const tooHot = (d.grudge ?? 0) > 0 || d.favor <= -15;
    if (tooHot) {
      opts.push({ label: '化解恩怨', tone: 'good', act: () => this.parleyNode(d, a.look, () => this.npcs.toEnemy(a, true), () => { a.bubble = { text: '……哼。', t: 2 }; }) });
      return opts;
    }
    // 论道
    if (d.realm > 0 && d.favor >= 10) opts.push({ label: '论道', hint: d.lunDao && day - d.lunDao < 15 ? '近日已论过道' : '', disabled: !!d.lunDao && day - d.lunDao < 15, act: () => {
      d.lunDao = day;
      const msgs: C.Msg[] = []; const k = gap > 0 ? 0.045 : 0.02; const exp = C.need(h) * k; C.gainExp(h, exp, msgs);
      const fv = d.pers === 'aloof' ? (gap <= 0 ? 10 : 3) : d.pers === 'arrogant' ? (gap > 0 ? 2 : 8) : 6; this.addFavor(d, fv);
      const L: Record<Pers, string> = { righteous: '二人从剑道谈到心性，不觉日已西斜。', kind: '对方说话不疾不徐，句句落在你修行的关隘上。', cautious: '对方起初惜字如金，谈到后来，竟也和盘托出几分心得。', arrogant: '对方言辞间多有自矜，倒也确有几分真知灼见。', greedy: '对方三句不离灵石丹药，偶尔也冒出几句妙论。', ruthless: '对方的道冷硬如铁，却让你看到了另一条路。', aloof: '对方寥寥数语，如晨钟暮鼓。' };
      return end(`（你与${d.name}席地而坐，论道半日）\n${L[d.pers]}\n\n修为 +${Math.round(exp)}，好感 +${fv}`);
    } });
    // 以物易物
    if (d.realm > 0 && d.pers !== 'aloof') opts.push({ label: '以物易物', act: () => this.barterNode(a, title, back) });
    // 结伴同行
    const follows = this.npcs.list.filter((x) => (x.bond === 'companion' || x.bond === 'guard') && (x.bondUntil ?? 0) > day);
    if (d.realm > 0 && !d.stay && !d.beauty && !d.bond) {
      if (d.favor >= 30) opts.push({ label: '邀其结伴同行', hint: follows.length >= 2 ? '同行者已满' : '三十日', disabled: follows.length >= 2, act: () => {
        if (d.pers === 'aloof' && d.favor < 50) return end('独来独往惯了。你走你的阳关道吧。');
        d.bond = 'companion'; d.bondUntil = day + 30; this.npcs.summon(d.id); this.log(`与${d.name}结伴同行。`, 'good');
        return end(pick(['好！路上也好有个照应。', '正想找个同伴，你我便一道走一程。', '我早想看看你平日都去些什么地方了。']));
      } });
      if (d.faction !== 'sect' && d.favor >= -10) { const fee = Math.round(25 * Math.pow(4, d.realm)); opts.push({ label: `雇其护法（灵石 ${fee} · 十五日）`, disabled: follows.length >= 2 || C.bagCount(h, 'mat_lingshi') < fee, hint: follows.length >= 2 ? '同行者已满' : '', act: () => {
        if (gap > 8 && d.pers === 'arrogant') return end('就凭这点灵石，也想差遣我？');
        C.removeItem(h, 'mat_lingshi', fee); d.bond = 'guard'; d.bondUntil = day + 15; this.npcs.summon(d.id); this.addFavor(d, 3); this.log(`雇${d.name}护法十五日。`);
        return end(d.pers === 'greedy' ? '（对方掂了掂灵石，笑逐颜开）这十五日，你的命就是我的命！' : '拿人钱财，与人消灾。有我在，宵小近不了你的身。');
      } }); }
    }
    // 结拜
    if (d.realm > 0 && d.favor >= 80 && !d.bond && !d.beauty && Math.abs(d.realm - h.realm) <= 1 && d.pers !== 'aloof') opts.push({ label: '义结金兰', tone: 'gold', act: () => {
      if (d.faction === 'demon' && g.ws.rep > 20) return end('我是魔道中人，与你结拜，只会污了你的名声。这份情，我心领了。');
      d.bond = 'sworn'; this.addFavor(d, 10); this.log(`与${d.name}撮土为香，义结金兰。`, 'good'); g.news(`韩立与${d.name}义结金兰。`, 'personal');
      return end(`（二人撮土为香，对天而拜）「皇天在上，后土在下——我${d.name}与韩立今日结为异姓${d.sex === 'f' ? '姐弟' : '兄弟'}，从此祸福与共，生死相扶！」\n\n${d.name}成为你的义${d.sex === 'f' ? '姐' : '兄'}：遇险时会赶来相助，时常托人捎来灵石。`);
    } });
    // 拜师 / 收徒
    const hasMaster = this.npcs.list.some((x) => x.bond === 'master' && x.alive);
    if (!d.bond && d.realm >= h.realm + 1 && d.favor >= 60 && !hasMaster && !d.beauty) opts.push({ label: '拜师', tone: 'gold', act: () => {
      if (d.pers === 'aloof' && d.favor < 80) return end('收徒？麻烦。');
      if (d.pers === 'ruthless' && g.ws.rep > 30) return end('我教出来的人，与你们正道合不来。');
      d.bond = 'master'; this.log(`拜${d.name}为师。`, 'good'); g.news(`韩立拜入${d.name}门下。`, 'personal');
      return end(`（你三跪九叩，奉上拜师茶）\n${d.name}受了茶：「既入我门，便要守我的规矩。往后每月，为师自会传音指点于你。」\n\n每月：修为指点，偶尔赐下功法玉简。`);
    } });
    const discN = this.npcs.list.filter((x) => x.bond === 'disciple' && x.alive).length;
    if (!d.bond && d.realm <= h.realm - 1 && d.favor >= 50 && h.realm >= 2 && !d.beauty && !d.canon) opts.push({ label: '收其为徒', hint: discN >= 3 ? '最多三名弟子' : '', disabled: discN >= 3, act: () => {
      d.bond = 'disciple'; this.addFavor(d, 15); this.log(`收${d.name}为徒。`, 'good');
      return end(`（${d.name}喜出望外，当即跪下叩首）「师父在上，受徒儿一拜！」\n\n弟子每月孝敬灵草灵石；有你指点，修为进境更快。`);
    } });
    // 断义
    if (d.bond === 'sworn' || d.bond === 'master' || d.bond === 'disciple') opts.push({ label: d.bond === 'sworn' ? '割袍断义' : d.bond === 'master' ? '叛出师门' : '逐出师门', tone: 'bad', act: () => {
      const was = d.bond; d.bond = undefined; this.addFavor(d, -60); if (was === 'master') g.ws.rep = clamp(g.ws.rep - 8, -100, 100);
      this.log(`与${d.name}${was === 'sworn' ? '割袍断义' : was === 'master' ? '断绝师徒之情' : '断绝师徒之情'}。`, 'bad');
      return end('……好，好得很。从今往后，你我恩断义绝！');
    } });
    // 结仇
    if (d.realm > 0 && !d.bond) opts.push({ label: '出言相讥', tone: 'bad', act: () => {
      this.setFavor(d, Math.min(d.favor - 60, -60)); d.grudge = Math.max(d.grudge ?? 0, 1); d.why = '当众折辱于他';
      if (d.pers === 'arrogant' || d.pers === 'ruthless' || gap > 3) { a.bubble = { text: '找死！', t: 2.5 }; this.npcs.toEnemy(a, true); return null; }
      g.orig?.onInsult(d);
      a.bubble = { text: '你给我等着！', t: 3 };
      return end('（对方脸色铁青，拂袖而去）好，好！韩立，这笔账我记下了！');
    } });
    return opts;
  }
  private barterNode(a: any, title: string, back: () => DNode): DNode {
    const g = this.game, d: NpcData = a.d, h = g.hero;
    const stock = (this.npcs as any).stock(d) as { id: string; price: number }[];
    const mul = d.pers === 'greedy' ? 1.35 : d.pers === 'kind' ? 0.85 : 1.05;
    const mine = h.bag.filter((b) => { const it = itemDef(b.id); return it.price > 0 && it.id !== 'mat_lingshi' && it.type !== 'misc' && !Object.values(h.equip).includes(b.id); });
    const opts: DOpt[] = [];
    for (const s of stock.slice(0, 5)) {
      const it = itemDef(s.id), want = it.price * mul;
      const offer = mine.filter((b) => itemDef(b.id).price >= want * 0.85).sort((x, y) => itemDef(x.id).price - itemDef(y.id).price)[0];
      if (!offer) continue;
      const o = itemDef(offer.id);
      opts.push({ label: `以「${o.name}」换「${it.name}」`, act: () => {
        C.removeItem(h, offer.id, 1); C.addItem(h, s.id, 1); this.addFavor(d, o.price > want * 1.3 ? 4 : 1);
        return { speaker: d.name, title, look: a.look, text: o.price > want * 1.5 ? '（对方眉开眼笑）道友爽快！这买卖做得！' : '成交。', options: [{ label: '再看看', act: () => this.barterNode(a, title, back) }, { label: '还有别的事', act: back }] };
      } });
    }
    if (!opts.length) return { speaker: d.name, title, look: a.look, text: '你身上的东西，我看不上眼。', options: [{ label: '还有别的事', act: back }] };
    opts.push({ label: '算了', act: back });
    return { speaker: d.name, title, look: a.look, text: `（${d.name}摊开几样东西）不收灵石，只换东西。你看中哪样，拿等价之物来换。`, options: opts };
  }

  /** 人脉：某人身边的关系（供面板显示） */
  tiesText(d: NpcData) {
    const by = this.npcs.byId;
    return (d.ties ?? []).map((t) => { const o = by.get(t.id); return o ? { o, r: relWord(t.r), k: t.k } : null; }).filter(Boolean) as { o: NpcData; r: string; k: TieKind }[];
  }
  /** 可见的人：相识者、与你有恩怨者、与你有羁绊者 */
  known() { return this.npcs.list.filter((d) => d.met || d.grudge || d.bond || d.favor <= -15 || d.favor >= 30); }
  /** 当前追杀你的人 */
  hunters() { return this.npcs.list.filter((d) => d.alive && (d.hunting || (d.grudge ?? 0) >= 2)); }
  locName(id: string) { return LOC_BY_ID.get(id)?.name ?? id; }
  mapsHome(d: NpcData) { return locsOf(npcMap(d)).length; }
}
