// 活世界 v0.43：让众生“活”过来
//
// · 储物袋：每个修士都有自己的行囊（真实物品），死后由至亲承继
// · 功法：人人有主修功法，逐日参悟（初学→小成→大成→圆满），可传家、可夺、可继承
// · 仇怨簿：恩怨有“因”（夺灵脉、杀同门……），会滋长、会淡化、会化仇为追杀
// · 家庭：道侣会添丁，姓氏传子，家产与功法代代相传
// · 来意：无因不访、无因不袭——修士来找你，必有来意（交易/论道/求援/传话/家事），劫道先有起意与间隔，一天最多两人
//
// 本模块只增不改：所有新字段都是 NpcData 的可选扩展，旧存档自动补齐。
import type { Game } from './game';
import type { NpcData } from './npc';
import { makeName, npcMap } from './npc';
import { LOC_BY_ID } from '../data/world';
import { ITEM_LIST, itemDef } from '../data/items';
import { ARTS, ART_LIST, PROF_NAME } from '../data/arts';
import { surnameOf } from './relations';
import * as C from './cultivation';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pw = (d: NpcData) => d.realm * 13 + d.stage;

export class Living {
  g: Game;
  constructor(g: Game) { this.g = g; }

  // ------------------------------------------------------------ 初始化（懒加载，兼容旧档）
  ensure() {
    const g = this.g;
    for (const d of g.npcs.list) {
      if (!d.alive || d.realm === 0) continue;
      if (!d.bag) d.bag = this.rollBag(d);
      if (!d.arts) d.arts = this.rollArts(d);
    }
    const ws = g.ws as any;
    if (!ws.__lwGrudges) { ws.__lwGrudges = true; this.seedGrudges(); }
  }

  /** 储物袋：按境界与出身滚点 */
  private rollBag(d: NpcData): { id: string; n: number }[] {
    const pool = ITEM_LIST.filter((it) => it.tier <= d.realm + 1 && it.tier >= Math.max(0, d.realm - 1) && it.price > 0 && it.type !== 'misc');
    if (!pool.length) return [];
    const n = (d.faction === 'merchant' ? 4 : 2) + Math.floor(Math.random() * 3);
    const out: { id: string; n: number }[] = [];
    for (let i = 0; i < n; i++) {
      const it = pool[Math.floor(Math.random() * pool.length)];
      if (out.some((o) => o.id === it.id)) continue;
      out.push({ id: it.id, n: it.type === 'artifact' || it.type === 'scroll' ? 1 : 1 + Math.floor(Math.random() * 3) });
    }
    // 贪财者袋里总压一件值钱货
    if (d.pers === 'greedy' && d.realm >= 2) {
      const rich = ITEM_LIST.filter((it) => it.tier <= d.realm + 1 && it.type === 'artifact' && it.price > 500);
      if (rich.length) out.push({ id: rich[Math.floor(Math.random() * rich.length)].id, n: 1 });
    }
    return out;
  }

  /** 功法：按阵营择系，境界定品阶 */
  private rollArts(d: NpcData): { art: string; know: number }[] {
    const want = d.faction === 'demon' ? '魔' : d.sect === 'jujian' || d.sect === 'qianzhu' ? '剑' : d.sect === 'yanyue' ? '火' : d.sect === 'lingshou' ? '木' : d.sect === 'qingxu' ? '冰' : undefined;
    const pickSchool = (school?: string) => ART_LIST.filter((a) => a.realm <= d.realm && a.tier <= Math.max(1, d.realm) && (school ? a.school === school : true));
    const pool = (want ? pickSchool(want) : []) .length ? pickSchool(want) : pickSchool(undefined);
    if (!pool.length) return [];
    const main = pool[Math.floor(Math.random() * pool.length)];
    const out: { art: string; know: number }[] = [{ art: main.id, know: 25 + Math.random() * 55 }];
    if (d.realm >= 3 && Math.random() < 0.5) {
      const p2 = pool[Math.floor(Math.random() * pool.length)];
      if (p2 && p2.id !== main.id) out.push({ art: p2.id, know: 15 + Math.random() * 30 });
    }
    return out;
  }

  /** 旧怨：世界开场时便有的恩怨（有因） */
  private seedGrudges() {
    const g = this.g;
    const REASONS = ['杀了同门师兄弟', '争夺一处灵脉', '劫了他的储物袋', '悔了婚约', '论道时结下梁子', '截杀夺了功法玉简', '杀了至交好友'];
    const list = g.npcs.list.filter((d) => d.alive && d.realm > 0 && !d.canon);
    for (let i = 0; i < 12 && list.length > 12; i++) {
      const a = list[Math.floor(Math.random() * list.length)];
      const b = list[Math.floor(Math.random() * list.length)];
      if (a === b || (a.sect && a.sect === b.sect)) continue;
      if (a.ties?.some((t) => t.id === b.id) || b.ties?.some((t) => t.id === a.id)) continue;
      const victim = pw(a) <= pw(b) ? a : b, foe = victim === a ? b : a;
      (victim.grudges ??= []).push({ t: foe.id, why: REASONS[i % REASONS.length], heat: 30 + Math.random() * 35, day: g.day });
    }
  }

  // ------------------------------------------------------------ 每日结算
  daily(days: number) {
    this.ensure();
    const g = this.g, day = g.day, by = g.npcs.byId;
    // 1. 功法参悟
    for (const d of g.npcs.list) {
      if (!d.alive || !d.arts?.length || d.realm === 0) continue;
      for (const a of d.arts) {
        const art = ARTS[a.art]; if (!art) continue;
        const before = Math.floor(a.know / 25);
        a.know = clamp(a.know + (0.5 + d.realm * 0.22 + (d.goal === 'seclude' ? 0.45 : 0)) * days * (1 - art.tier * 0.07), 0, 100);
        const now = Math.floor(a.know / 25);
        if (now > before && (d.met || d.canon || d.realm >= 3)) g.news(`传闻：${d.name}已将「${art.name}」参悟至${PROF_NAME[now]}。`, 'rumor');
      }
    }
    // 2. 仇怨簿：滋长 / 化解 / 化仇为追杀
    for (const d of g.npcs.list) {
      if (!d.alive || !d.grudges?.length) continue;
      const next: NonNullable<typeof d.grudges> = [];
      for (const gr of d.grudges) {
        const t = by.get(gr.t);
        if (!t || !t.alive) continue;
        gr.heat = clamp(gr.heat + (gr.heat >= 55 ? 0.55 : -0.35) * days, 0, 100);
        if (gr.heat <= 4) continue;
        if (gr.heat >= 65 && !d.vend && d.realm > 0) {
          if (pw(t) <= pw(d) * 1.25) { d.vend = t.id; gr.heat = 58; if (d.met || d.realm >= 3) g.news(`${d.name}动了杀心——要去找${t.name}算那桩「${gr.why}」的旧账！`, 'rumor'); }
        }
        next.push(gr);
      }
      d.grudges = next;
    }
    // 3. 家庭：道侣添丁
    for (const d of g.npcs.list) {
      if (!d.alive || d.sex !== 'm' || d.realm === 0) continue;
      const t = d.ties?.find((x) => x.k === 'lover'); if (!t) continue;
      const w = by.get(t.id); if (!w || !w.alive) continue;
      if (d.age < 20 || d.age > 48 || w.age < 18 || w.age > 46) continue;
      if ((d.kidCd ?? 0) > day) continue;
      if (Math.random() > 0.005 * days) continue;
      d.kidCd = w.kidCd = day + 180;
      this.birth(d, w);
    }
    // 4. 市井往来：友朋之间做买卖（3 笔/日）
    if (days >= 1) for (let i = 0; i < 3; i++) this.market();
  }

  /** 添丁：新生命入册，随父姓 */
  private birth(f: NpcData, m: NpcData) {
    const g = this.g, day = g.day;
    const home = LOC_BY_ID.get(f.home); if (!home) return;
    const c = g.npcs.spawnRandom(Math.random, home, `lv${Math.floor(day)}_${Math.floor(Math.random() * 1e6)}`);
    c.sex = Math.random() < 0.5 ? 'm' : 'f';
    const nm = makeName(Math.random, c.sex);
    c.name = surnameOf(f.name) + nm.slice(surnameOf(nm).length);
    c.age = 0.2; c.realm = 0; c.stage = 0; c.faction = 'mortal'; c.sect = undefined; c.wealth = 0; c.life = 60 + Math.random() * 25; c.alive = true;
    c.bag = []; c.arts = [];
    g.npcs.list.push(c); g.npcs.reindex();
    const rl = c.sex === 'm' ? '子' : '女';
    g.rel.link(f, c, 'kin', rl, c.sex === 'm' ? '父' : '母');
    g.rel.link(m, c, 'kin', rl, c.sex === 'm' ? '母' : '父');
    if (f.met || m.met) g.news(`${m.name}为${f.name}诞下一名${c.sex === 'm' ? '麟儿' : '千金'}，取名${c.name}。`, 'rumor');
    g.rel.log(`${f.name}与${m.name}喜得${c.sex === 'm' ? '子' : '女'}：${c.name}。`);
  }

  /** 友朋间的买卖：物易其主 */
  private market() {
    const g = this.g, list = g.npcs.list;
    for (let i = 0; i < 8; i++) {
      const a = list[Math.floor(Math.random() * list.length)];
      if (!a.alive || a.realm === 0 || !a.bag?.length) continue;
      const t = a.ties?.find((x) => x.k === 'friend'); if (!t) continue;
      const b = g.npcs.byId.get(t.id);
      if (!b?.alive || b.realm === 0 || npcMap(a) !== npcMap(b)) continue;
      const gi = Math.floor(Math.random() * a.bag.length);
      const item = a.bag[gi]; const it = itemDef(item.id);
      a.bag.splice(gi, 1);
      (b.bag ??= []).push(item);
      b.wealth += Math.round(it.price * 0.2); a.wealth += Math.round(it.price * 0.8);
      if (a.met && b.met) g.news(`${a.name}将${it.name}卖与${b.name}，得价不菲。`, 'rumor');
      return;
    }
  }

  // ------------------------------------------------------------ 死亡：传承与血仇
  onDeath(d: NpcData, killer?: { id: string; name: string } | 'player') {
    const g = this.g, by = g.npcs.byId;
    const kName = killer ? (killer === 'player' ? '韩立' : killer.name) : undefined;
    const kId = killer && killer !== 'player' ? killer.id : undefined;
    // 仇怨簿清理：仇人已死，恩怨两清；亲手杀之，仇已雪
    for (const o of g.npcs.list) {
      if (!o.alive || !o.grudges?.length) continue;
      o.grudges = o.grudges.filter((gr) => gr.t !== d.id);
    }
    // NPC 互杀：至亲记恨凶手（杀人者本人已被关系系统结为杀亲仇人，这里补“因”）
    if (kId) {
      for (const t of d.ties ?? []) {
        if (t.k !== 'kin' && t.k !== 'lover' && t.k !== 'sworn' && t.k !== 'master' && t.k !== 'disciple') continue;
        const o = by.get(t.id); if (!o || !o.alive || o.id === kId) continue;
        if ((o.grudges ?? []).some((gr) => gr.t === kId)) continue;
        (o.grudges ??= []).push({ t: kId, why: `${kName}杀了${d.name}`, heat: 55 + Math.random() * 30, day: g.day });
        if (o.met || d.realm >= 2) g.news(`${o.name}披麻戴孝：我的${t.k === 'lover' ? '道侣' : t.k === 'master' ? '恩师' : t.k === 'disciple' ? '弟子' : '至亲'}${d.name}，竟被${kName}所害！此仇不报，誓不为人！`, 'personal');
      }
    }
    // 承继：储物袋、功法、家财，传于至亲
    const order = (k: string) => (k === 'lover' ? 0 : k === 'kin' ? 1 : k === 'disciple' ? 2 : k === 'sworn' ? 3 : k === 'friend' ? 4 : 5);
    const topArt = d.arts?.length ? d.arts.slice().sort((a, b) => b.know - a.know)[0] : undefined;
    let heir: { o: NpcData; label: string } | null = null;
    for (const t of [...(d.ties ?? [])].sort((a, b) => order(a.k) - order(b.k))) {
      const o = by.get(t.id); if (!o?.alive || o.id === kId) continue;
      heir = { o, label: t.k === 'lover' ? '道侣' : t.k === 'kin' ? (t.r === '子' || t.r === '女' ? '子嗣' : '至亲') : t.k === 'disciple' ? '弟子' : t.k === 'sworn' ? '义亲' : '故交' };
      break;
    }
    if (heir && (d.bag?.length || d.arts?.length || d.wealth > 20)) {
      const o = heir.o;
      if (d.bag?.length) o.bag = [...(o.bag ?? []), ...d.bag].slice(0, 12);
      if (topArt && !o.arts?.some((a) => a.art === topArt.art)) (o.arts ??= []).push({ art: topArt.art, know: Math.max(25, Math.round(topArt.know * 0.6)) });
      if (d.wealth > 20) o.wealth += Math.round(d.wealth * 0.5);
      const bn = d.bag?.length ?? 0;
      if (d.met || d.realm >= 2 || d.canon) g.news(`${heir.o.name}（${heir.label}）承继了${d.name}的遗物——储物袋中${bn}件物品${topArt ? `，还有传家功法「${ARTS[topArt.art]?.name ?? ''}」` : ''}。`, 'rumor');
    }
    d.bag = undefined; d.arts = undefined;
    // 讣闻
    if (d.realm >= 2 || d.met || d.canon) g.news(`传闻：${d.name}陨落——${d.deathNote ?? ''}${kName ? `，凶手便是${kName}` : ''}。`, kName ? 'personal' : 'rumor');
  }

  // ------------------------------------------------------------ 无因不袭：劫道的“起意”
  /** 返回劫道路线的气泡台词；返回 null 表示今天没这个心思 */
  robMotive(d: NpcData, pl: number, novice: boolean): string | null {
    const g = this.g, day = g.day, ws = g.ws as any;
    if (ws.robDay !== day) { ws.robDay = day; ws.robToday = 0; }
    if (ws.robToday >= 2) return null;                      // 一天最多两人起意——再没有没来由的找茬
    if ((d.robCd ?? 0) >= day) return null;                 // 同一人九十日内不再纠缠
    if (novice) return null;                                // 新手保护
    if (pw(d) - pl < 0) return null;                        // 心虚者不动手：打不过的从不来
    const evil = d.faction === 'demon' || d.pers === 'greedy' || d.pers === 'ruthless';
    if (!evil) return null;
    const bounty = g.rel?.wantedTotal() ?? 0;
    if (Math.random() > (bounty > 0 ? 0.5 : 0.22) * (d.faction === 'demon' ? 1.4 : 1)) return null;
    d.robCd = day + 90; ws.robToday++;
    d.why = bounty > 0 ? '谋：悬赏在身' : '谋：觊觎储物袋';
    return bounty > 0
      ? ['悬赏都贴出来了！拿你性命，换那锭灵石！', '取你项上人头，我去领赏！'][d.seed % 2]
      : ['道友，你储物袋里那件东西，该给有缘人了。', '留下灵石，饶你性命。', '狭路相逢，休怪我心狠！'][d.seed % 3];
  }

  // ------------------------------------------------------------ 无因不访：来访的“来意”
  /** 有交情、有要事才会上门；返回来意气泡 */
  visitIntent(d: NpcData, pl: number): { text: string; hint: string } | null {
    const g = this.g, day = g.day;
    void pl;
    if (d.realm === 0 || d.bond || (d.visitCd ?? 0) >= day) return null;
    if ((d.favor ?? 0) < 35 && !d.met) return null;
    const r = Math.random();
    let it: { text: string; hint: string } | null = null;
    if ((d.grudge ?? 0) >= 1 && (d.favor ?? 0) >= 25) it = { text: '道友，我有一事相求——一桩仇怨，我独力难偿，想请你搭把手。', hint: '想请你帮忙了结一桩仇怨' };
    else if (d.bag?.length && (d.pers === 'kind' || d.pers === 'greedy') && r < 0.5) { const it0 = d.bag[0]; it = { text: `我这儿有件${itemDef(it0.id).name}想出手。你是靠得住的人，先想到你。`, hint: '想卖你一件储物袋里的东西' };
    } else if ((d.favor ?? 0) >= 60) it = { text: '早想同道友坐谈论道，只是没得空儿。今日正好。', hint: '想与你论道' };
    else if (d.sect && d.ros) it = { text: '宗门命我来传句话：道友若得空，请过府一叙。', hint: '奉宗门之命传话' };
    else if (d.ties?.length && r < 0.4) it = { text: '家里有些事，想听听道友的意见。', hint: '有家务相商' };
    if (!it) return null;
    d.visitCd = day + 30;
    d.intent = it.text;
    return it;
  }

  /** 到访：办事、留话、走人 */
  onVisit(d: NpcData): string {
    const g = this.g;
    const intent = d.intent ?? '';
    const addF = (n: number) => { d.favor = clamp((d.favor ?? 0) + n, -100, 100); };
    if (intent.includes('相求')) {
      const gr = d.grudges?.[0]; const pay = 15 + d.realm * 25;
      addF(12); C.addItem(g.hero, 'mat_lingshi', pay);
      return `多谢道友肯听一听。这点${pay}灵石是谢仪。${gr ? `那桩「${gr.why}」的旧账，你我共商个章程。` : ''}`;
    }
    if (intent.includes('想出手')) {
      const it0 = d.bag?.[0];
      if (it0) { const it = itemDef(it0.id); d.bag!.splice(0, 1); C.addItem(g.hero, it0.id, 1); addF(10); return `拿去——这件${it.name}，我看你功夫路数正配得上它。`; }
      addF(5); return '啊，本想出手的那件被旁人买去了。改日，改日再会。';
    }
    if (intent.includes('论道')) {
      const msgs: any[] = []; C.gainExp(g.hero, C.need(g.hero) * 0.04, msgs); addF(6);
      return '坐论片刻——这几日我参悟功法，也颇有几分心得。';
    }
    if (intent.includes('传话')) { addF(5); g.news(`传闻：${d.name}奉${g.rel?.sectName(d.sect) ?? '宗门'}之命，传话邀韩立过府一叙。`, 'rumor'); return '宗门掌门的口信：时机到了，候你大驾。'; }
    addF(8);
    return '说也是白说——家里那点事，听道友一句劝，我心里就踏实了。';
  }

  // ------------------------------------------------------------ 市井闲谈（聊天行）
  chatLine(A: NpcData, B: NpcData): string[] | null {
    const r = Math.random();
    if (A.arts?.length && B.arts?.length && r < 0.14) {
      const a = A.arts[0], b = B.arts[0];
      return [`你那门「${ARTS[a.art]?.name ?? '功法'}」修到几层了？`, `惭愧，刚摸到${PROF_NAME[Math.min(3, Math.floor((a.know ?? 0) / 25))]}的门槛。`, r < 0.05 ? `倒是你那「${ARTS[b.art]?.name ?? ''}」路数不俗，他日当以道会友。` : '功法在心不在口，勤修便好。'];
    }
    const ta = A.ties?.find((t) => t.id === B.id);
    if (ta && ta.k === 'kin' && r < 0.1) return ['孩子们都大了。', '是啊，家底交给他们，我放心。', '回头办家宴，你来坐主位。'];
    if (ta && ta.k === 'friend' && A.bag?.length && B.bag?.length && r < 0.08) {
      const line = this.marketLine(A, B);
      if (line) return [line, '成交，成交。', '道友之间，不必算得太清。'];
    }
    return null;
  }

  /** 当面做买卖（聊天时）：物易其主 */
  marketLine(A: NpcData, B: NpcData): string | null {
    if (!A.bag?.length) return null;
    const gi = Math.floor(Math.random() * A.bag.length);
    const item = A.bag[gi]; const it = itemDef(item.id);
    A.bag.splice(gi, 1);
    (B.bag ??= []).push(item);
    B.wealth += Math.round(it.price * 0.2); A.wealth += Math.round(it.price * 0.8);
    return `${A.name}将${it.name}让与了${B.name}`;
  }
}
