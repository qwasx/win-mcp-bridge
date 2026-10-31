// 第四十二步：活世界 · 游戏适配器——把纯逻辑引擎（huoshijie.ts）接进 Game
// 存档：引擎状态放 ws.flags.huo（随存档走）；每个人的储物袋 / 功法 / 家眷 / 恩怨放 NpcData.hw（随人走）。
import type { Game } from './game';
import type { NpcData, Pers } from './npc';
import { makeName } from './npc';
import type { DNode, DOpt } from './modal';
import type { Enemy } from './combat';
import type { Look } from '../gfx/character';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { LOC_BY_ID, LOCATIONS, ACTIVE_MAP } from '../data/world';
import { realmName } from '../data/realms';
import type { TieKind } from './relations';
import { LivingWorld, hwName } from './huoshijie';
import type { HwHost, HwPerson, HwState, HwPlea } from './huoshijie';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class HuoGame {
  g: Game;
  host: HwHost;
  private _hw: LivingWorld | null = null;
  constructor(g: Game) {
    this.g = g;
    const self = this;
    this.host = {
      get day() { return self.g.day; },
      get persons() { return self.g.npcs.list as unknown as HwPerson[]; },
      rnd: Math.random,
      news: (text) => { self.g.news(text, 'rumor'); },
      link: (a, b, k, ra, rb) => self.g.rel?.link(a as unknown as NpcData, b as unknown as NpcData, k as TieKind, ra, rb),
      birth: (m, f, name, sex) => self.birth(m as unknown as NpcData, f as unknown as NpcData, name, sex),
      onKill: (v, k) => self.onKill(v as unknown as NpcData, k as unknown as NpcData),
      onPlea: (p, giver) => self.onPlea(p, giver as unknown as NpcData),
      get playerSect() { return self.g.ws.sect?.id; },
      playerName: '韩立',
      givePlayer: (items, stones) => { for (const b of items) C.addItem(self.g.hero, b.id, b.n); if (stones) C.addItem(self.g.hero, 'mat_lingshi', stones); },
      takePlayer: (items, stones) => {
        const h = self.g.hero;
        for (const b of items) if (C.bagCount(h, b.id) < b.n) return false;
        if (stones && C.bagCount(h, 'mat_lingshi') < stones) return false;
        for (const b of items) C.removeItem(h, b.id, b.n);
        if (stones) C.removeItem(h, 'mat_lingshi', stones);
        return true;
      },
      homeName: (id) => LOC_BY_ID.get(id)?.name ?? id,
      joinSect: (d) => {
        const loc = LOC_BY_ID.get(d.home);
        if (loc?.type !== 'sect') return null;
        const nd = d as unknown as NpcData;
        nd.sect = loc.id; nd.faction = 'sect';
        return loc.name;
      },
    };
  }
  /** 引擎（存档态在 ws.flags.huo；读档后自动重建） */
  get huo(): LivingWorld {
    const f = this.g.ws.flags as { huo?: HwState };
    if (!this._hw || this._hw.st !== f.huo) { this._hw = new LivingWorld(f.huo); f.huo = this._hw.st; }
    return this._hw;
  }
  daily(days: number) { this.huo.daily(this.host, days); }
  /** 自然死亡 / 玩家击杀后的遗产结算（Npcs.die 调用） */
  inherit(d: NpcData) { if (d.hw) this.huo.inherit(this.host, d as unknown as HwPerson); }

  private birth(m: NpcData, f: NpcData, name: string, sex: 'm' | 'f'): HwPerson | null {
    const g = this.g;
    const pers: Pers[] = ['righteous', 'kind', 'cautious', 'greedy', 'arrogant', 'aloof'];
    const d: NpcData = {
      id: `hw_b${Math.floor(g.day)}_${Math.floor(Math.random() * 1e6)}`, name, sex,
      role: sex === 'f' ? 'female' : 'cultivator', realm: 0, stage: 0, faction: 'mortal',
      home: m.home, map: m.map, pers: pers[Math.floor(Math.random() * pers.length)],
      favor: 0, grudge: 0, met: false, alive: true, age: 0, life: 70,
      x: m.x + (Math.random() - 0.5) * 60, y: m.y + (Math.random() - 0.5) * 60, tx: m.x, ty: m.y,
      goal: 'stay', until: 0, wealth: 0, seed: Math.floor(Math.random() * 1e9),
      title: `${f.name}之${sex === 'm' ? '子' : '女'}`,
    };
    g.npcs.list.push(d); g.npcs.byId.set(d.id, d);
    return d as unknown as HwPerson;
  }
  private onKill(v: NpcData, k: NpcData) {
    const g = this.g;
    g.rel?.onNpcKill(v, k);
    g.npcs.forget(v.id);
    if (v.met) g.toast(`${v.name}死于${k.name}之手——这世道，又少了一个你认识的人。`, 'warn');
  }
  private onPlea(p: HwPlea, giver: NpcData) {
    const g = this.g;
    giver.met = true;
    g.toast(`传音符亮起：${giver.name}有难相求（${p.reason}）。去寻${giver.name}细谈。`, 'warn');
    g.rel?.log(`${giver.name}托传音符求助：${p.why}（${p.reason}）。`, 'bad');
    (g.ws.letters ??= []).push({ id: Date.now() % 1e9, from: giver.name, day: Math.floor(g.day), kind: 'sos', text: `${p.reason}，斗胆传音相求：${p.why}。若肯援手，来${LOC_BY_ID.get(giver.home)?.name ?? '坊市'}寻我，见面细谈。` });
  }
  /** 劫道的匪徒不再是无名氏：入名册、有储物袋，日后可寻仇可再遇 */
  registerRobber(e: Enemy, x: number, y: number) {
    const g = this.g;
    let home = LOCATIONS.filter((l) => l.map === ACTIVE_MAP && (l.type === 'town' || l.type === 'city'))
      .sort((a, b) => Math.hypot(a.x * 32 - x, a.y * 32 - y) - Math.hypot(b.x * 32 - x, b.y * 32 - y))[0];
    if (!home) home = LOC_BY_ID.get('jiayuan');
    const sex: 'm' | 'f' = Math.random() < 0.85 ? 'm' : 'f';
    const d: NpcData = {
      id: `hw_rob${Math.floor(g.day)}_${Math.floor(Math.random() * 1e6)}`, name: makeName(Math.random, sex), sex,
      role: 'guard', realm: Math.max(1, e.realm), stage: e.stage, faction: 'rogue',
      home: home?.id ?? 'jiayuan', pers: Math.random() < 0.5 ? 'greedy' : 'ruthless',
      favor: 0, grudge: 0, met: true, alive: true, age: 22 + Math.random() * 30, life: 120,
      x, y, tx: x, ty: y, goal: 'stay', until: 0, wealth: 30 + e.realm * 60 + Math.floor(Math.random() * 50),
      seed: Math.floor(Math.random() * 1e9), title: '拦路劫修', why: '拦路打劫过你',
    };
    g.npcs.list.push(d); g.npcs.byId.set(d.id, d);
    this.huo.ensure(d as unknown as HwPerson);
    e.npcId = d.id; e.name = d.name;
  }

  // ------------------------------------------------------------ 对话
  /** 打听近况：功法 / 储物袋 / 家眷 / 恩怨 / 生平，一览无余 */
  statusNode(d: NpcData, look: Look, back: () => DNode): DNode {
    const p = this.huo.profile(d as unknown as HwPerson, this.host);
    const L: string[] = [`【近况】${p.act}（气血 ${p.health} · 心境 ${p.mood}）`, `【功法】${p.art}`];
    L.push(`【储物袋】灵石 ${p.wealth}${p.bag.length ? '；' + p.bag.slice(0, 6).map((b) => `${b.name}×${b.n}${b.from ? `（${b.from}）` : ''}`).join('、') : '；空空如也'}`);
    const fam: string[] = [];
    if (p.spouse) fam.push(`道侣 ${p.spouse}`);
    if (p.parents.length) fam.push(`高堂 ${p.parents.join('、')}`);
    if (p.kids.length) fam.push(`膝下 ${p.kids.join('、')}`);
    L.push(`【家眷】${fam.length ? fam.join('；') : '孑然一身'}`);
    if (p.friends.length) L.push(`【交好】${p.friends.filter((f) => f.alive).map((f) => f.name).join('、') || '故人零落'}`);
    if (p.feuds.length) L.push(`【仇怨】${p.feuds.map((f) => `${f.name}（${f.why}，第${f.day}日结怨${f.lv >= 2 ? '·血仇' : ''}）`).join('；')}`);
    const deeds = this.huo.deeds(d.id, 4);
    if (deeds.length) L.push('【生平】' + deeds.map((e) => `第${e.day}日 ${e.text}`).join('\n'));
    return { speaker: d.name, title: '近况', look, text: L.join('\n'), options: [{ label: '还有别的事', act: back }, { label: '告辞', act: () => null }] };
  }
  /** 苦主的求助：来龙去脉 + 因果链 + 四种回应 */
  pleaNode(d: NpcData, look: Look, back: () => DNode): DNode | null {
    const p = this.huo.pleaOf(d.id);
    if (!p) return null;
    const g = this.g, h = g.hero;
    const target = g.npcs.byId.get(p.target);
    const chain = (p.trail?.length ? p.trail : this.huo.chain(p.cause).reverse()).map((e) => `第${e.day}日【${e.kind}】${e.text}`).join('\n');
    const title = p.kind === 'rob' ? '求助 · 劫案' : '求助 · 血案';
    const head = `${d.name}见到你，眼圈一红，把事情原原本本说了：\n\n${p.why}。\n\n「${p.reason}……这才厚颜寻你。」\n\n【来龙去脉】\n${chain}`;
    const say = (text: string): DNode => ({ speaker: d.name, title, look, text, options: [{ label: '还有别的事', act: back }, { label: '告辞', act: () => null }] });
    const opts: DOpt[] = [];
    const have = p.items.map((b) => ({ id: b.id, n: C.bagCount(h, b.id) }));
    const canReturn = p.items.every((b) => C.bagCount(h, b.id) >= b.n);
    if (target?.alive) {
      opts.push({ label: `循迹追讨（打探${target.name}行踪）`, act: () => {
        const dir = g.npcs.dirName(target.x - g.player.x, target.y - g.player.y);
        target.met = true;
        return say(`你记下了${target.name}的气息。此人如今在${LOC_BY_ID.get(target.home)?.name ?? '外地'}一带出没（${dir}方向，${realmName(target.realm, target.stage)}修为）。\n\n夺回赃物后回来寻我，或当面勒令其归还。`);
      } });
      opts.push({ label: '居中调停（看对方性子，成败各半）', act: () => { const r = this.huo.resolvePlea(this.host, p.id, 'mediate'); return say(r.text); } });
    } else {
      opts.push({ label: '告知仇家死讯', act: () => { const r = this.huo.resolvePlea(this.host, p.id, 'fight', { won: true }); return say(r.text); } });
    }
    opts.push({ label: '归还失物', hint: canReturn ? '' : '尚未夺回全部失物', disabled: !canReturn, tone: 'good', act: () => { const r = this.huo.resolvePlea(this.host, p.id, 'return', { have }); return say(r.text); } });
    const cost = Math.max(20, Math.round((p.stones + p.items.reduce((s, b) => s + (itemDef(b.id)?.price ?? 0) * b.n, 0)) * 0.8));
    opts.push({ label: `破财免灾（自掏灵石 ${cost} 补偿）`, disabled: C.bagCount(h, 'mat_lingshi') < cost, act: () => { const r = this.huo.resolvePlea(this.host, p.id, 'pay', { stones: C.bagCount(h, 'mat_lingshi') }); return say(r.text); } });
    opts.push({ label: '婉言谢绝', act: () => { d.favor = clamp(d.favor - 6, -100, 100); return say(`${d.name}眼神黯了下去：「……也是，非亲非故的，是我唐突了。」（好感 -6；此事仍可回头再帮）`); } });
    opts.push({ label: '容我想想', act: back });
    return { speaker: d.name, title, look, text: head, options: opts };
  }
  /** 面对被通指的仇家：勒令归还（实力够硬才行），否则动手 */
  confrontOpts(d: NpcData, look: Look, onFight: () => void): DOpt[] {
    const p = this.huo.st.pleas.find((x) => x.status === 'open' && x.target === d.id);
    if (!p) return [];
    const giver = this.g.npcs.byId.get(p.giver);
    if (!giver) return [];
    const gap = (this.g.hero.realm * 13 + this.g.hero.stage) - (d.realm * 13 + d.stage);
    return [{ label: `勒令归还${giver.name}的失物`, tone: 'good', act: () => {
      if (gap >= 6 || d.pers === 'cautious' && gap >= 0) {
        const r = this.huo.resolvePlea(this.host, p.id, 'fight', { won: true });
        return { speaker: d.name, look, text: `（你神识一沉，${d.name}脸色数变，终究不敢造次，咬牙解下储物袋）\n\n${r.text}`, options: [{ label: '……', act: () => null }] };
      }
      return { speaker: d.name, look, mood: 'danger', text: `${d.name}嗤笑一声：「${giver.name}自己不敢来，倒请你这说客？东西就在我袋里，有本事——自己来拿！」`, options: [{ label: '那就动手！', tone: 'bad', act: () => { onFight(); return null; } }, { label: '暂且退去', act: () => null }] };
    } }];
  }
  /** 境界文本（供 UI） */
  static realmText(d: NpcData) { return d.realm === 0 ? '凡人' : realmName(d.realm, d.stage); }
}
void hwName;