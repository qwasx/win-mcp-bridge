// 第四十七步：人心 —— 尔虞我诈四件套
// 一、表里：每个修士两张脸（favor 真实态度 / shown 表演态度），心声随之变假变真
// 二、谎言与情报：一切非亲眼所见的消息都是 Rumor，可多方印证、神识探查、灵石收买、赌一把
// 三、骗局池：合作探宝 / 假丹药 / 借刀杀人 / 美人局 / 夺舍老魔
// 四、玩家也能骗人：报假名号、卖假货、散布假情报、分赃下黑手，江湖信义 ws.cred 记账
// 另有阅历 ws.exp2：吃过一次亏，下次就有破绽提示——吃亏长记性
import type { Game } from './game';
import type { NpcData } from './npc';
import type { Rumor, ExpNote, Motive } from './worldstate';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import { realmName } from '../data/realms';
import { loot } from './sites';
import {
  SCAM_DEFS, SCAM_LORE, type ScamId,
  FAKE_MIND_WARM, FAKE_MIND_FLAT, FAKE_MIND_COLD, MIND_TELL,
  RUMOR_POOL, MOTIVE_LINE, FAKE_SECT_LINES,
} from '../data/scams';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** 各性格的"表里差"：越是贪、狠，脸上越热络 */
export const PERS_GUISE: Record<string, number> = {
  righteous: 0, kind: 4, cautious: 16, arrogant: 10, greedy: 38, ruthless: 46, aloof: 6,
};
const PERS_LABEL: Record<string, string> = {
  righteous: '正直', kind: '仁厚', cautious: '谨慎', arrogant: '傲慢', greedy: '贪婪', ruthless: '狠辣', aloof: '清冷',
};

/** 骗局的上下文：由 happen 提供人手与清场（避免与 happen 循环依赖） */
export interface ScamCtx {
  pos: { x: number; y: number };
  /** 这类骗局在此前遇过几次（0 = 头一回，尚无"上次的教训"） */
  seen?: number;
  name: string;
  look: any;
  realm: number;
  stage: number;
  spawn: (n: number, o?: { name?: string; realm?: number; boss?: boolean; from?: { x: number; y: number } }) => void;
  clear: () => void;
}

export class Deceit {
  game: Game;
  private nid = 1;
  constructor(g: Game) { this.game = g; }

  // ================================================================ 一、表里
  /** 伪装值：表演好感 − 真实好感 */
  guise(d: NpcData): number {
    if (d.faction === 'mortal') return 0;
    if (d.mask == null) {
      const base = PERS_GUISE[d.pers] ?? 8;
      d.mask = Math.round(base * (0.55 + ((d.seed % 100) / 100) * 0.9));
    }
    // 心里越不干净，脸上装得越干净
    let m = d.mask;
    if ((d.grudge ?? 0) > 0) m = Math.round(m * 1.5);
    else if (d.favor < -15) m = Math.round(m * 1.3);
    if (d.pers === 'righteous' || d.pers === 'kind') m = Math.round(m * 0.5);
    return clamp(m, -60, 70);
  }

  /** 表演出来的态度（对话语气、心声、行礼用这个） */
  shown(d: NpcData): number {
    return clamp(d.favor + this.guise(d), -100, 100);
  }

  /** 表里之差越大，越可疑 */
  tone(d: NpcData): string {
    const s = this.shown(d);
    return s >= 55 ? '热络' : s >= 25 ? '友善' : s >= -10 ? '平淡' : s >= -40 ? '冷淡' : '敌意';
  }

  /**
   * 能否看穿他（神识压制 / 境界高过两个大境界 → 真心声；结丹以上狠辣老魔连被压制都是假的）
   */
  pierce(d: NpcData, sup = 0): { ok: boolean; spoof: boolean; why: string } {
    const h = this.game.hero;
    const veteran = this.hasExp('假') || this.hasExp('骗') || this.hasExp('虚实');
    const oldMonster = d.realm >= 3 && (d.pers === 'ruthless' || d.pers === 'greedy');
    if (d.faction === 'mortal') return { ok: true, spoof: false, why: '凡人神气散乱，装不住话。' };
    if (oldMonster) {
      if (veteran && Math.random() < 0.3) return { ok: true, spoof: false, why: '他心神虽沉，眉心却有一丝极细的波动——你曾在这种波动上栽过跟头。' };
      return { ok: false, spoof: true, why: '此人心机深沉，神识探去只有一片温润平和——这"平和"本身就不对劲。' };
    }
    if (sup >= 1) return { ok: true, spoof: false, why: '你的神识将他牢牢罩住，他心底的念头无所遁形。' };
    const gap = h.realm - d.realm;
    if (gap >= 2) return { ok: true, spoof: false, why: '境界相差悬殊，他的神念在你面前无所遮掩。' };
    if (gap >= 1) return Math.random() < 0.65 + (veteran ? 0.2 : 0)
      ? { ok: true, spoof: false, why: '你神识一寸寸压过去，读出了他没说出口的那句话。' }
      : { ok: false, spoof: false, why: '他心防极紧，你只探到些浮皮潦草的念头。' };
    return { ok: false, spoof: false, why: '你的神识压不过他的心防。' };
  }

  /** 心声：默认看到的是"表演心声"，除非被你看穿 */
  thought(g: Game, a: any, real: string): { text: string; real: boolean } {
    const d: NpcData = a.d;
    if (d.faction === 'mortal' || !d.alive) return { text: real, real: true };
    const sup: number = a.sup ?? 0;
    const v = this.pierce(d, sup);
    if (v.ok) return { text: real, real: true };
    const s = this.shown(d);
    const pool = s >= 25 ? FAKE_MIND_WARM : s <= -15 ? FAKE_MIND_COLD : FAKE_MIND_FLAT;
    let text = pick(pool);
    if (text === a.mindLast && pool.length > 1) text = pick(pool.filter((x) => x !== text));
    // 吃过亏的人，偶尔能看出破绽
    if ((v.spoof || this.guise(d) > 25) && (this.hasExp('心声') || this.hasExp('面善') || this.hasExp('虚实') || this.hasExp('骗')) && Math.random() < 0.35) {
      text = pick(MIND_TELL) + text;
    }
    return { text, real: false };
  }

  /** 「以神识探其虚实」：把表里之差摊开 */
  pierceNode(d: NpcData, look: any, title: string, back: () => DNode): DNode {
    const g = this.game, h = g.hero;
    const v = this.pierce(d, 0);
    const real = Math.round(d.favor), shown = Math.round(this.shown(d));
    const gap = shown - real;
    const opts: DOpt[] = [];
    if (v.ok) {
      this.addExp(`学会了以神识察人心之法（${d.name}）`, 'did');
      opts.push({ label: '（心里有数了）', act: back });
      return {
        speaker: '神识', title: '探其虚实', look, mood: 'mystic',
        text: `${v.why}\n\n【真实态度】${real}　【表面态度】${shown}${gap > 12 ? `　——他对你热络得过分了（表里相差 ${gap}）` : gap < -12 ? `　——他比表面上更恨你（表里相差 ${gap}）` : '　——表里如一，无甚破绽。'}\n\n此人性格：${PERS_LABEL[d.pers] ?? d.pers}。${(d.grudge ?? 0) > 0 ? '他与你有仇在身，面上不显而已。' : ''}`,
        options: opts,
      };
    }
    // 看不穿：还能花钱买、找人问
    const fee = Math.round(30 * Math.pow(3, h.realm));
    opts.push({ label: `花灵石买他的底细（${fee} 灵石）`, disabled: C.bagCount(h, 'mat_lingshi') < fee, act: () => {
      C.removeItem(h, 'mat_lingshi', fee);
      this.addExp(`学会了用灵石买通消息（${d.name}）`, 'did');
      return {
        speaker: '神识', title: '买来的底细', look, mood: 'mystic',
        text: `你寻了个与${d.name}相熟的市井中人，几杯酒下去，该说的不该说的都倒了出来。\n\n【真实态度】${real}　【表面态度】${shown}${gap > 12 ? `　——他心里打的是你的储物袋。` : ''}\n\n（${v.why}）`,
        options: [{ label: '知道了', act: back }],
      };
    } });
    opts.push({ label: '算了', act: back });
    return { speaker: '神识', title: '探其虚实', look, mood: 'mystic', text: `${v.why}\n\n此人喜怒不形于色，你只觉得他笑意温和，挑不出半点错处。`, options: opts };
  }

  // ================================================================ 二、谎言与情报
  ensure() {
    const ws = this.game.ws;
    ws.rumors ??= []; ws.exp2 ??= []; ws.cred ??= 60; ws.seenScams ??= {};
    return ws;
  }

  /** 把一条消息放进世界（谁说的、是真是假、图什么） */
  tell(p: { text: string; truth: 0 | 0.5 | 1; src: string; motive?: Motive; tag?: string; quiet?: boolean }): Rumor {
    const ws = this.ensure();
    const r: Rumor = { id: this.nid++, text: p.text, truth: p.truth, src: p.src, motive: p.motive ?? 'honest', tag: p.tag, day: this.game.day };
    ws.rumors.push(r);
    if (ws.rumors.length > 40) ws.rumors.shift();
    if (!p.quiet) this.game.hint('rumor', '提示：坊间消息有真有假。按 X 打开《韩立随笔》可查传闻，或再寻一人多方印证。');
    return r;
  }

  /** 打听消息：拿到的可能是真话、半真话，也可能是一个饵 */
  rumorNode(d: NpcData, look: any, title: string, back: () => DNode): DNode {
    const g = this.game, ws = this.ensure();
    const cred = ws.cred ?? 60;
    // 说话人的动机：贪、狠之人爱设饵；与你有仇的爱诋毁；低信义的人，连真话都懒得跟你说
    let motive: Motive = 'honest';
    const r = Math.random();
    if ((d.grudge ?? 0) > 0 || d.favor <= -30) motive = r < 0.55 ? 'smear' : 'bait';
    else if (d.pers === 'greedy' || d.pers === 'ruthless') motive = r < 0.45 ? 'bait' : r < 0.7 ? 'proxy' : 'honest';
    else if (d.pers === 'cautious') motive = r < 0.3 ? 'proxy' : 'honest';
    if (cred < 25 && Math.random() < 0.4) {
      return { speaker: d.name, title, look, text: `（对方瞥了你一眼，淡淡道）「道友在外头的名声，自己心里清楚。我若把消息告诉你，回头算谁的？」\n\n他不肯再说下去。`, options: [{ label: '……', act: back }] };
    }
    // 真假：设饵/诋毁的多半是假的或半真
    const truth: 0 | 0.5 | 1 = motive === 'honest' ? (Math.random() < 0.8 ? 1 : 0.5) : motive === 'proxy' ? (Math.random() < 0.4 ? 1 : 0.5) : (Math.random() < 0.25 ? 0.5 : 0);
    const tpl = pick(RUMOR_POOL.filter((t) => (motive === 'bait' ? t.truth !== 1 : motive === 'smear' ? t.tag === 'foe' || t.tag === 'bounty' : true))) ?? pick(RUMOR_POOL);
    const place = this.somePlace();
    const who = this.someName(d);
    const text = tpl.text.replace('{place}', place).replace('{name}', who);
    const rr = this.tell({ text, truth, src: d.name, motive, tag: tpl.tag, quiet: true });
    const opts: DOpt[] = [
      { label: '记下这条消息', act: () => { this.addExp(`听闻：${text}（${d.name}所说）`, 'seen'); g.toast('已记入《韩立随笔》（X 打开）。', 'info'); return back(); } },
      { label: '再寻一人多方印证', hint: '真假一对便知', act: () => this.verifyNode(rr, d, look, title, back) },
    ];
    const fee = Math.round(25 * Math.pow(3, g.hero.realm));
    opts.push({ label: `塞灵石，问「这消息谁放出来的」（${fee} 灵石）`, disabled: C.bagCount(g.hero, 'mat_lingshi') < fee, act: () => {
      C.removeItem(g.hero, 'mat_lingshi', fee);
      rr.truth = rr.truth === 0 ? 0.5 : 1;
      rr.checked = rr.truth;
      return { speaker: d.name, title, look, text: `（他掂了掂灵石，压低声音）「这话是${motive === 'bait' ? `${who}前儿在酒桌上放出来的` : motive === 'smear' ? `${who}在背后编排的` : '从坊市那边传来的'}——${MOTIVE_LINE[motive] ?? ''}」`, options: [{ label: '原来如此', act: back }] };
    } });
    opts.push({ label: '还有别的事', act: back });
    return {
      speaker: d.name, title, look,
      text: `（你打听消息）\n\n「${text}」\n\n${MOTIVE_LINE[motive] ?? ''}`,
      options: opts,
    };
  }

  /** 多方印证：找第二个来源对口径，假消息一对就对不上 */
  verifyNode(r: Rumor, d: NpcData, look: any, title: string, back: () => DNode): DNode {
    const g = this.game;
    const other = this.someName(d);
    const agree = r.truth === 1 ? true : r.truth === 0.5 ? Math.random() < 0.5 : Math.random() < 0.15;
    if (agree) {
      r.checked = r.truth === 1 ? 1 : 0.5;
      this.addExp(`多方印证过一条消息：${r.text}`, 'did');
      return {
        speaker: '坊间', title: '多方印证', look, mood: 'mystic',
        text: `你又寻了${other}打听。两人口径一致——至少大体不差。\n\n「${r.text}」\n\n（这条消息大致可信；已记入随笔）`,
        options: [{ label: '好', act: back }],
      };
    }
    r.checked = 0;
    this.addExp(`识破一条假消息：${r.text}`, 'seen');
    this.addCred(2, '行事谨慎');
    return {
      speaker: '坊间', title: '多方印证', look, mood: 'danger',
      text: `你又寻了${other}打听。对方一听便皱眉：「这话我也听过，可细处全对不上——传话的人，怕是别有用心。」\n\n（这条消息是假的，或被人动过手脚；已记入随笔。阅历 +1）`,
      options: [{ label: '好在多问了一句', act: back }],
    };
  }

  // ================================================================ 三、骗局池
  scamDef(id: ScamId) { return SCAM_DEFS.find((s) => s.id === id)!; }

  /** 骗局频率：谨慎的人几乎不骗，贪狠高发；同一个骗局吃过一次亏，下次更容易看破 */
  scamBias(d: NpcData): number {
    const base = d.pers === 'ruthless' ? 1.0 : d.pers === 'greedy' ? 0.85 : d.pers === 'cautious' ? 0.12 : d.pers === 'righteous' || d.pers === 'kind' ? 0.05 : 0.4;
    return base;
  }

  scamNode(id: ScamId, ctx: ScamCtx): DNode {
    switch (id) {
      case 'coop': return this.scamCoop(ctx);
      case 'pill': return this.scamPill(ctx);
      case 'borrow': return this.scamBorrow(ctx);
      case 'beauty': return this.scamBeauty(ctx);
      default: return this.scamSeize(ctx);
    }
  }

  /** #1 合作探宝，分赃翻脸 */
  private scamCoop(ctx: ScamCtx): DNode {
    const g = this.game, h = g.hero;
    const seen = ctx.seen ?? 0;
    const opts: DOpt[] = [];
    const name = ctx.name;
    const split = () => {
      const got = loot(g, clamp(h.realm, 0, 4), 1.1, { scroll: 0.25, art: 0.2, map: 0.15 });
      this.addExp(this.scamDef('coop').trap, 'seen');
      ctx.clear();
      return {
        speaker: name, title: '分赃', look: ctx.look, mood: 'mystic',
        text: `「痛快！」${name}把三只玉匣摊开，一人一半，分得干净利落。\n\n「往后有这样的买卖，还找道友。」他抱拳而去。\n\n获得：${got.join('、')}`,
        options: [{ label: '后会有期', act: () => null }],
      } as DNode;
    };
    const betray = () => {
      ctx.spawn(3, { name, boss: true });
      this.addExp(this.scamDef('coop').trap, 'taken');
      this.addCred(0, '');
      g.toast(`${name}翻脸了！他早叫了帮手埋伏在府中！`, 'warn');
      const got = loot(g, clamp(h.realm, 0, 4), 1.3, { scroll: 0.3, art: 0.25, map: 0.2 });
      g.combat.dropLoot(ctx.pos.x, ctx.pos.y, 'mat_lingshi', Math.round(60 * Math.pow(3, h.realm - 1)));
      return {
        speaker: name, title: '翻脸', look: ctx.look, mood: 'danger',
        text: `玉匣刚开，背后劲风已至！\n\n「道友，对不住了——这袋东西，我要了。」${name}笑得很温和，手里的法器却毫不留情。府门外又闪出两道身影。\n\n（你趁乱先把石台上的东西扫进怀里：${got.join('、')}、灵石若干——可人，还得再打一场。已记入随笔：${this.scamDef('coop').trap}）`,
        options: [{ label: '找死！', tone: 'bad', act: () => null }],
      } as DNode;
    };
    opts.push({ label: '按说好的，平分', tone: 'good', act: () => {
      const greedy = this.scamBias({ pers: 'greedy', favor: 0 } as NpcData);
      const chance = ctx.realm >= h.realm ? 0.25 + greedy * 0.45 : 0.1 + greedy * 0.3;
      return Math.random() < chance ? betray() : split();
    } });
    opts.push({ label: '先下手为强，独吞了这袋东西', tone: 'bad', hint: '江湖信义大跌，他若有师门好友会记你一辈子', act: () => {
      ctx.spawn(1, { name, boss: true });
      this.addCred(-12, '黑吃黑');
      g.ws.rep = clamp(g.ws.rep - 6, -100, 100);
      g.rel?.log(`在遗府中对${name}下了黑手，杀人夺宝。`, 'bad');
      const got = loot(g, clamp(h.realm, 0, 4), 1.4, { scroll: 0.3, art: 0.25, map: 0.2 });
      return {
        speaker: name, title: '翻脸', look: ctx.look, mood: 'danger',
        text: `你在他背后抬起了手。\n\n「你——！」他只来得及吐出一个字。\n\n（江湖信义 -12，正道声望 -6。${name}的师门、道侣、结拜兄弟，会替他记住今天。）\n\n夺得：${got.join('、')}`,
        options: [{ label: '杀人夺宝', tone: 'bad', act: () => null }],
      } as DNode;
    } });
    if (seen > 0) opts.push({ label: '（你想起上次的教训——让他先开箱）', tone: 'gold', act: () => {
      const betrayNow = Math.random() < 0.35;
      return betrayNow ? betray() : split();
    } });
    opts.push({ label: '「不必了，我独来独往惯了。」', act: () => { ctx.clear(); return null; } });
    return {
      speaker: name, title: `${realmName(ctx.realm, ctx.stage)} · 散修`, look: ctx.look, mood: 'mystic',
      text: `「道友留步！」${name}快步迎上来，四下看了一眼，压低声音：\n\n「在下${name}。前些日子在这条裂谷里撞见一处前人遗府，禁制古怪，须两人分头输入灵力才开得。里头的东西五五分——如何？」\n\n（江湖上，合作探宝在宝箱前翻脸的事，时有发生）`,
      options: opts,
    };
  }

  /** #2 假丹药 / 假玉简 */
  private scamPill(ctx: ScamCtx): DNode {
    const g = this.game, h = g.hero;
    const price = Math.round(1500 * Math.pow(3, h.realm - 1));
    const opts: DOpt[] = [];
    const fooled = () => {
      C.removeItem(h, 'mat_lingshi', price);
      this.addExp(this.scamDef('pill').trap, 'taken');
      this.addCred(-2, '');
      ctx.clear();
      g.toast(`你服下那枚"筑基丹"，只觉一股燥气直冲丹田——是淬体丹染的色！`, 'warn');
      g.news(`有散修在坊市地摊买到染色假丹，服下后吐血三升。`, 'rumor');
      return {
        speaker: ctx.name, title: '行脚药商', look: ctx.look, mood: 'danger',
        text: `你付了灵石，他殷勤地替你把丹药包好。\n\n回到住处服下——丹香之下，隐隐一股土腥气。哪是什么筑基丹，分明是淬体丹染了色！\n\n（灵石 -${price}。已记入随笔：${this.scamDef('pill').trap}）`,
        options: [{ label: '好个奸商！', tone: 'bad', act: () => null }],
      } as DNode;
    };
    opts.push({ label: `以神识扫这颗丹（看你识不识货）`, act: () => {
      const v = this.pierce({ faction: 'rogue', realm: h.realm, pers: 'greedy', favor: 0, seed: 7 } as NpcData, 0);
      const ok = v.ok || this.hasExp('假丹') || this.hasExp('染色') || Math.random() < 0.4;
      if (ok) {
        this.addExp('识破过一枚染色假丹——丹香之下必有土腥气', 'seen');
        this.addCred(3, '不贪小便宜');
        ctx.clear();
        return {
          speaker: '神识', title: '鉴丹', look: ctx.look, mood: 'mystic',
          text: `神识渗入丹皮——丹纹是画上去的，药力浑浊，一股土腥气被香料压着。\n\n是淬体丹染的色。三折的筑基丹，本就天方夜谭。\n\n（你识破了假丹。阅历 +1，江湖信义 +3）`,
          options: [
            { label: '当场揭穿，逼他退钱', tone: 'good', act: () => {
              C.addItem(h, 'mat_lingshi', Math.round(price * 0.5));
              return { speaker: ctx.name, title: '行脚药商', look: ctx.look, mood: 'danger', text: '「道友饶命！小的也是替人跑腿……」他把身上一半灵石倒在地上，收摊就跑。\n\n（收回部分灵石）', options: [{ label: '滚。', act: () => null }] };
            } },
            { label: '不动声色，转身走人', act: () => null },
          ],
        };
      }
      return fooled();
    } });
    opts.push({ label: `买下这颗"筑基丹"（${price} 灵石，三折）`, disabled: C.bagCount(h, 'mat_lingshi') < price, act: fooled });
    opts.push({ label: '「太便宜的东西，我不敢吃。」', act: () => { this.addCred(1, '不贪便宜'); ctx.clear(); return null; } });
    return {
      speaker: ctx.name, title: '行脚药商', look: ctx.look, mood: 'mystic',
      text: `「这位道友，一看就是识货的！」药商掀开锦盒，一枚龙眼大的丹药躺在红绸上，丹香扑鼻。\n\n「筑基丹！七派里头有价无市的宝贝。小的急着回乡，三折——${price} 灵石，您拿走。」`,
      options: opts,
    };
  }

  /** #3 借刀杀人 */
  private scamBorrow(ctx: ScamCtx): DNode {
    const g = this.game, h = g.hero;
    const target = this.someName(null);
    const sect = pick(['清虚门', '掩月宗', '黄枫谷', '化刀坞', '天阙堡', '巨剑门']);
    const opts: DOpt[] = [];
    const after = (knows: boolean) => {
      ctx.spawn(2, { name: `${target}`, boss: true });
      this.addExp(this.scamDef('borrow').trap, knows ? 'seen' : 'taken');
      if (!knows) {
        g.ws.rep = clamp(g.ws.rep - 8, -100, 100);
        g.news(`有修士在${sect}山门外被杀，凶手不知所踪。`, 'rumor');
        g.toast('你杀了人才知道——那人是正经宗门弟子，你替人报了私仇。', 'warn');
      }
      ctx.clear();
      return {
        speaker: knows ? '神识' : '事后', title: knows ? '你早看穿了' : '真相', look: ctx.look, mood: 'danger',
        text: knows
          ? `「前面山谷里那个魔修……」他话没说完，你已从他眼底读出了一句话：那个人不是魔修，是他的宿敌。\n\n你没有去。他脸色一变，转身就走。\n\n（你识破了借刀杀人之计。阅历 +1）`
          : `你依言去了山谷。那人见你便惊惧欲逃，被你截杀当场。\n\n搜出的腰牌上刻着「${sect}外门弟子」。\n\n回到原处，那个"苦主"早已不见踪影。\n\n（正道声望 -8。${this.scamDef('borrow').trap}）`,
        options: [{ label: knows ? '好险' : '好一招借刀杀人', tone: knows ? 'good' : 'bad', act: () => null }],
      } as DNode;
    };
    opts.push({ label: '「你且说说，那人什么模样、什么修为？」', act: () => {
      const v = this.pierce({ faction: 'rogue', realm: h.realm, pers: 'ruthless', favor: -10, seed: 3 } as NpcData, 0);
      const ok = v.ok || this.hasExp('借刀') || Math.random() < 0.35;
      return ok ? after(true) : {
        speaker: ctx.name, title: '苦主', look: ctx.look, mood: 'mystic',
        text: `「他……他穿黑袍，使一口弯刀，筑基中期的修为！」他说得极快，极熟——像是背过一遍的。\n\n（说不上来哪里不对）`,
        options: [
          { label: '「好，我替你走一趟。」', tone: 'good', act: () => after(false) },
          { label: '「你自己怎么不去？」', act: () => after(true) },
        ],
      };
    } });
    opts.push({ label: '「路见不平，我替你走一趟。」', tone: 'good', act: () => after(false) });
    opts.push({ label: '「冤有头债有主，我不掺和。」', act: () => { this.addCred(1, '不轻信'); ctx.clear(); return null; } });
    return {
      speaker: ctx.name, title: '带伤修士', look: ctx.look, mood: 'danger',
      text: `那人浑身是血，扑通跪在你面前，泣不成声：\n\n「道友救命！前面山谷里有个魔修，害了我全家……我修为低微，报仇无门。求道友替我杀了他——我愿以全部家当相谢！」`,
      options: opts,
    };
  }

  /** #4 美人局 */
  private scamBeauty(ctx: ScamCtx): DNode {
    const g = this.game, h = g.hero;
    const opts: DOpt[] = [];
    const night = () => {
      ctx.spawn(2, { name: '合欢宗妖人', boss: true });
      this.addExp(this.scamDef('beauty').trap, 'taken');
      g.toast('夜半时分，一股摄魂香气扑面而来——她根本不是什么落难的女修！', 'warn');
      ctx.clear();
      return {
        speaker: ctx.name, title: '摄魂', look: ctx.look, mood: 'danger',
        text: `夜半，她忽然靠了过来，吐气如兰。\n\n「道友……看着我。」\n\n你神识一荡——那双眼里哪有半分柔弱，分明是合欢宗的摄魂术！林中同时闪出两道身影。\n\n（${this.scamDef('beauty').trap}）`,
        options: [{ label: '好个美人局！', tone: 'bad', act: () => null }],
      } as DNode;
    };
    opts.push({ label: '「姑娘若不嫌弃，我送你一程。」', tone: 'good', act: () => night() });
    opts.push({ label: '以神识探她的根底', act: () => {
      const v = this.pierce({ faction: 'demon', realm: h.realm, pers: 'ruthless', favor: -20, seed: 11 } as NpcData, 0);
      const ok = v.ok || this.hasExp('摄魂') || this.hasExp('合欢') || Math.random() < 0.45;
      if (!ok) return {
        speaker: ctx.name, title: '落难女修', look: ctx.look, mood: 'love',
        text: `她气息紊乱，确是受了伤的样子，眉眼间楚楚可怜。\n\n（看不出什么破绽）`,
        options: [
          { label: '「我送你一程。」', tone: 'good', act: () => night() },
          { label: '「姑娘自己保重。」', act: () => { ctx.clear(); return null; } },
        ],
      };
      this.addExp('识破过一次合欢宗的美人局——摄魂香气是破绽', 'seen');
      this.addCred(2, '不为色动');
      ctx.clear();
      return {
        speaker: '神识', title: '看穿', look: ctx.look, mood: 'mystic',
        text: `你神识在她丹田一转——好重的媚功根基。所谓"重伤"，是她自己封了经脉装出来的。\n\n她见你眼神清明，笑容一点点淡下去：「……算你运气好。」转身遁走。\n\n（阅历 +1，江湖信义 +2）`,
        options: [{ label: '好险', act: () => null }],
      };
    } });
    opts.push({ label: '「姑娘自己走吧。」', act: () => { this.addCred(1, '不轻信'); ctx.clear(); return null; } });
    return {
      speaker: ctx.name, title: '落难女修', look: ctx.look, mood: 'love',
      text: `「道、道友……」一名女修扶着树干，衣衫单薄，脸色苍白，声音发颤。\n\n「小女子路过此地，遇上了妖兽，伤了腿……道友可否送我一程？到了前面镇上，必有重谢。」`,
      options: opts,
    };
  }

  /** #5 夺舍老魔 */
  private scamSeize(ctx: ScamCtx): DNode {
    const g = this.game, h = g.hero;
    const opts: DOpt[] = [];
    const seize = () => {
      const power = h.realm * 13 + h.stage + (this.hasExp('夺舍') ? 8 : 0) + (this.wsCred() > 60 ? 2 : 0);
      const his = ctx.realm * 13 + ctx.stage + 10;   // 老魔神识强横
      const win = Math.random() < clamp(0.28 + (power - his) * 0.05, 0.08, 0.9);
      ctx.clear();
      if (win) {
        this.addExp('抵挡过一次夺舍——心神相搏时，守住灵台一点清明', 'seen');
        this.addCred(2, '神识坚定');
        ctx.spawn(1, { name: `${ctx.name}（夺舍不成）`, boss: true });
        return {
          speaker: '神识', title: '夺舍', look: ctx.look, mood: 'danger',
          text: `一股阴冷的神念顺着你的灵力直灌识海！\n\n「哈哈哈——好一具肉身！」\n\n你死死守住灵台一点清明，反把那道神念绞碎了三成。"重伤老者"翻身坐起，面色铁青。\n\n（你挡住了夺舍。阅历 +1，江湖信义 +2）`,
          options: [{ label: '好个老魔！', tone: 'bad', act: () => null }],
        } as DNode;
      }
      const fee = Math.round(C.bagCount(h, 'mat_lingshi') * 0.35 + 80 * Math.pow(3, h.realm - 1));
      C.removeItem(h, 'mat_lingshi', fee);
      h.mp = Math.max(0, h.mp - 0.4);
      this.addExp(this.scamDef('seize').trap, 'taken');
      g.toast('那道神念直灌识海——你拼死挣脱，已是神魂大损、灵石散落！', 'warn');
      g.ws.flags ??= {}; g.ws.flags.shenShang = g.day + 20;
      return {
        speaker: '神识', title: '夺舍', look: ctx.look, mood: 'danger',
        text: `你的手刚搭上他的腕脉，一股阴冷的神念便顺着灵力直灌识海！\n\n「小辈，借你肉身一用——」\n\n你拼死挣脱，神魂震荡，储物袋里的灵石散了一地，被他卷走大半。\n\n（灵石 -${fee}，法力大损。${this.scamDef('seize').trap}）`,
        options: [{ label: '此仇不共戴天', tone: 'bad', act: () => null }],
      } as DNode;
    };
    opts.push({ label: '「前辈莫慌，我渡你一口灵力。」', tone: 'good', act: seize });
    opts.push({ label: '以神识探他的伤势', act: () => {
      const v = this.pierce({ faction: 'demon', realm: Math.max(1, ctx.realm), pers: 'ruthless', favor: -30, seed: 5 } as NpcData, 0);
      const ok = v.ok || this.hasExp('夺舍') || Math.random() < 0.4;
      if (!ok) return {
        speaker: '神识', title: '探伤', look: ctx.look, mood: 'mystic',
        text: `他气息奄奄，经脉确有几处断折……像是真的。\n\n（看不出什么破绽）`,
        options: [
          { label: '「前辈莫慌，我渡你一口灵力。」', tone: 'good', act: seize },
          { label: '「前辈自己调息吧。」', act: () => { this.addCred(1, '不轻信'); ctx.clear(); return null; } },
        ],
      };
      this.addExp('识破过一次夺舍之局——重伤者的识海不该这样"干净"', 'seen');
      this.addCred(3, '神识机警');
      ctx.clear();
      return {
        speaker: '神识', title: '看穿', look: ctx.look, mood: 'mystic',
        text: `他外伤虽重，识海却沉稳得像一潭深水——这不是垂死之人该有的样子。\n\n这是夺舍的局。你收回了手。\n\n「……哼。」他睁开眼，目光阴鸷，慢慢站了起来，转身消失在林中。\n\n（阅历 +1，江湖信义 +3）`,
        options: [{ label: '好险', act: () => null }],
      };
    } });
    opts.push({ label: '丢下一瓶疗伤丹，转身就走', act: () => {
      if (C.bagCount(h, 'pill_liaoshang') > 0) C.removeItem(h, 'pill_liaoshang', 1);
      this.addCred(1, '慈悲而不轻信');
      ctx.clear();
      return { speaker: ctx.name, title: '垂死老者', look: ctx.look, text: '「……小友，多谢。」身后传来一声低低的叹息。你走出很远，才发觉后背已被冷汗浸透。', options: [{ label: '走', act: () => null }] };
    } });
    return {
      speaker: ctx.name, title: '垂死老者', look: ctx.look, mood: 'danger',
      text: `「小……小友……」一个白发老者倒在路旁，胸口一个血洞，气若游丝。\n\n「老夫遭人暗算，命不久矣……求小友渡我一口灵力，救我一命……老夫毕生所学，绝不亏待……」`,
      options: opts,
    };
  }

  // ================================================================ 四、玩家的骗术
  /** 与 NPC 对话中的"江湖手段" */
  trickOpts(d: NpcData, a: any, title: string, back: () => DNode): DOpt[] {
    const g = this.game, h = g.hero;
    const out: DOpt[] = [];
    if (d.faction === 'mortal' && d.realm === 0) return out;
    // 读心（表里）
    out.push({ label: '以神识探其虚实', hint: this.guise(d) > 25 ? '此人笑意甚热' : '', act: () => this.pierceNode(d, a.look, title, back) });
    // 报假名号
    out.push({ label: '报假名号', hint: '唬得住人，也可能被人当场拆穿', act: () => {
      const line = pick(FAKE_SECT_LINES);
      const ok = Math.random() < clamp(0.62 - (d.realm - h.realm) * 0.12 + (this.wsCred() > 55 ? 0.12 : -0.15), 0.08, 0.92);
      if (ok) {
        this.addCred(-3, '冒名唬人');
        return {
          speaker: d.name, title, look: a.look,
          text: `${line}\n\n对方脸色一变，抱拳退开：「失敬！在下这就走，这就走。」\n\n（江湖信义 -3。今日唬过去了，可谎话说得越多，越没人信你）`,
          options: [{ label: '（收起架势）', act: back }],
        } as DNode;
      }
      this.addCred(-10, '冒名被拆穿');
      g.ws.rep = clamp(g.ws.rep - 5, -100, 100);
      if (d.pers === 'ruthless' || d.pers === 'arrogant') g.npcs.toEnemy?.(a, true);
      return {
        speaker: d.name, title, look: a.look, mood: 'danger',
        text: `${line}\n\n对方盯着你看了半晌，忽然冷笑：「${pick(['黄枫谷的执法弟子？我上月才从山门来，怎么没见过你。', '掩月宗什么时候收男弟子了？', '这令牌是地摊上买的吧。'])}」\n\n（冒名被当场拆穿！江湖信义 -10，声望 -5）`,
        options: [{ label: '……', act: back }],
      } as DNode;
    } });
    // 卖假货
    const price = Math.round(120 * Math.pow(3, h.realm - 1));
    out.push({ label: `兜售"上品丹药"（实为低品丹 + 伪灵粉）`, hint: `${price} 灵石 · 会被记仇`, act: () => {
      const ok = Math.random() < clamp(0.75 - (d.realm - h.realm) * 0.1 - (this.hasExp('假丹') ? 0.25 : 0), 0.1, 0.9);
      if (ok) {
        C.addItem(h, 'mat_lingshi', price);
        this.addCred(-8, '卖假货');
        g.rel?.addFavor(d, -25);
        d.grudge = Math.max(d.grudge ?? 0, 1); d.why = '买到了你卖的假丹';
        g.rel?.log(`把假丹卖给了${d.name}，赚了 ${price} 灵石——他迟早会知道。`, 'bad');
        return {
          speaker: d.name, title, look: a.look, mood: 'mystic',
          text: `「果然是好丹！」对方付了 ${price} 灵石，喜滋滋地收下。\n\n（赚快钱容易，可${d.name}记在了恩怨网上——他迟早会发现，也会回来找你。江湖信义 -8）`,
          options: [{ label: '（收好灵石）', act: back }],
        } as DNode;
      }
      this.addCred(-14, '卖假货被识破');
      d.grudge = Math.max(d.grudge ?? 0, 1); d.why = '卖假丹被他识破';
      g.rel?.addFavor(d, -45);
      return {
        speaker: d.name, title, look: a.look, mood: 'danger',
        text: `他接过丹药，指尖一搓，脸色沉了下来。\n\n「伪灵粉。」他把丹药捏碎，一字一字道：「${d.name}记住了。」\n\n（江湖信义 -14，对方与你结仇）`,
        options: [{ label: '……', act: back }],
      } as DNode;
    } });
    // 散布假情报
    const fee = Math.round(80 * Math.pow(3, h.realm - 1));
    out.push({ label: `请说书人放风，散布假情报（${fee} 灵石）`, hint: '把仇家调虎离山', disabled: C.bagCount(h, 'mat_lingshi') < fee, act: () => {
      C.removeItem(h, 'mat_lingshi', fee);
      const place = this.somePlace();
      this.addCred(-5, '散布假情报');
      this.tell({ text: `${place}一带宝光冲天，怕是有异宝出世。`, truth: 0, src: '说书人', motive: 'proxy', tag: 'treasure' });
      g.news(`市井传闻：${place}一带有异宝出世。`, 'rumor');
      g.toast(`你花 ${fee} 灵石，让说书人把"${place}有异宝"的风声放了出去。`, 'info');
      return {
        speaker: '说书人', title: '放风', look: a.look, mood: 'mystic',
        text: `「得嘞！」说书人把折扇一合，压低声音：「三日之内，全城都会知道${place}出了异宝。」\n\n（你的仇家若信了这风声，便会扑个空——可若他活着回来，总会知道是谁放的风。江湖信义 -5）`,
        options: [{ label: '好', act: back }],
      } as DNode;
    } });
    return out;
  }

  // ================================================================ 阅历 / 江湖信义
  wsCred() { return this.ensure().cred ?? 60; }
  get cred(): number { return this.wsCred(); }
  addCred(n: number, why: string) {
    const ws = this.ensure();
    const before = ws.cred ?? 60;
    ws.cred = clamp(before + n, -100, 100);
    if (why && n !== 0) this.game.toast(`江湖信义 ${n > 0 ? '+' : ''}${n}（${why}）——现在：${this.credName()}。`, n > 0 ? 'good' : 'warn');
  }
  credName(): string {
    const c = this.wsCred();
    return c >= 80 ? '一诺千金' : c >= 55 ? '颇有信义' : c >= 30 ? '声名平平' : c >= 5 ? '口碑可疑' : '无人敢信';
  }

  addExp(text: string, kind: ExpNote['kind']) {
    const ws = this.ensure();
    ws.exp2.push({ day: this.game.day, text, kind });
    if (ws.exp2.length > 80) ws.exp2.shift();
    const n = ws.exp2.length;
    this.game.toast(`阅历 +1（${text}）——按 X 翻开《韩立随笔》。`, 'good');
    if (n === 1) this.game.hint('exp2', '提示：每一次上当、每一次识破，都会写进《韩立随笔》（X）。阅历越老道，越容易看出别人话里的破绽。');
  }
  hasExp(kw: string): boolean {
    return (this.ensure().exp2 ?? []).some((e) => e.text.includes(kw));
  }

  /** 随笔里的坊间传闻（供面板使用） */
  rumors(): Rumor[] { return this.ensure().rumors ?? []; }
  exps(): ExpNote[] { return this.ensure().exp2 ?? []; }
  lore(): string[] { return SCAM_LORE; }

  private somePlace(): string {
    return pick(['落云山', '黑石镇', '青牛镇后山', '黄枫谷外的乱石坡', '血色禁地外围', '嘉元城坊市', '云梦山北麓', '太南谷']);
  }
  private someName(skip: NpcData | null): string {
    const g = this.game;
    const cands = (g.npcs?.list ?? []).filter((n) => n.alive && n.faction !== 'mortal' && (!skip || n.id !== skip.id)).slice(0, 400);
    if (cands.length) { const d = pick(cands); return `${d.name}${d.sect ? '（' + d.sect + '）' : ''}`; }
    return pick(['一个游方道人', '坊市的掌柜', '酒楼的说书人', '一位不知名的散修']);
  }
}

/** 骗局池：按权重抽一个（同一骗局吃过亏，稍微降权，免得玩家觉得全世界都是骗子） */
export function rollScam(seen: Record<string, number>, realm: number): ScamId | null {
  const pool = SCAM_DEFS.filter((s) => realm >= s.minRealm);
  if (!pool.length) return null;
  const tot = pool.reduce((a, s) => a + s.weight / (1 + (seen[s.id] ?? 0) * 0.8), 0);
  let r = Math.random() * tot;
  for (const s of pool) { r -= s.weight / (1 + (seen[s.id] ?? 0) * 0.8); if (r <= 0) return s.id; }
  return pool[0].id;
}

/** 骗局出现的门限：谨慎的人几乎不骗，贪狠高发（供 happen 调用） */
export function scamChance(pers: string): number {
  switch (pers) {
    case 'ruthless': return 0.55;
    case 'greedy': return 0.45;
    case 'arrogant': return 0.22;
    case 'cautious': return 0.1;
    case 'aloof': return 0.08;
    default: return 0.06;
  }
}

export const rint0 = rint;
export const rand0 = rand;
