// 第二十九步：十位原创人物的小故事（非原著，按用户许可加入）
//
// 孟铁衣 / 孟铁山：寻兄——劝回误入歧途的大哥，或斩之而与其弟结下血仇
// 陆青崖：黄枫谷同门的少年意气——切磋折服为友，或折辱之后被暗中中伤、伏击
// 慧明：游方僧——布施、讲解化解恩怨之道，可替你调停血仇
// 顾松鹤：落云山下的结丹散修——对弈三局，赠玉简，可拜为师
// 赵无忌：红拂门下的恶少——管不管这闲事，杀不杀他，红拂都看在眼里
// 雷九：嘉元城黑市掮客——卖仇家的消息，花钱撤悬赏
// 柳三娘：越京茶楼老板娘——替你盯着仇家的动向
// 白枭：赏金客——悬赏高了就会来，两度饶他不死，便成朋友
// 阿妤：青牛镇的小姑娘——测灵根，等你筑基后收她为徒
import type { Game } from './game';
import type { NpcData } from './npc';
import type { Enemy } from './combat';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { realmName } from '../data/realms';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class OrigStory {
  game: Game;
  constructor(g: Game) { this.game = g; }
  get S(): Record<string, any> { return this.game.rel.S.story; }
  st(id: string) { return (this.S[id] ??= { st: 0 }) as { st: number; [k: string]: any }; }
  npc(id: string) { return this.game.npcs.byId.get(id) ?? null; }
  private log(t: string, k: 'good' | 'bad' | 'info' = 'info') { this.game.rel.log(t, k); }

  /** 个人台词（覆盖原著台词表） */
  greeting(d: NpcData): string | null {
    if (!d.orig) return null;
    const s = this.st(d.id), g = this.game;
    switch (d.id) {
      case 'o_mengtieyi':
        if (d.grudge >= 2) return null;
        if (s.st === 0) return '（青年汉子抱拳）道友请了。敢问道友……可曾在太南山一带，见过一个左脸带刀疤的汉子？那是我大哥，孟铁山。';
        if (s.st === 1) return '道友，可有我大哥的消息？他……还活着吗？';
        if (s.st === 2) return '（孟铁衣眼眶通红）大哥回来了！他说是你在太南山点醒了他——韩道友，这份恩情，我孟家兄弟没齿难忘！';
        return pick(['韩兄！大哥如今在城里做些正经营生，日子虽清苦，心里踏实。', '有用得着我孟铁衣的地方，尽管开口！']);
      case 'o_mengtieshan':
        if (this.st('o_mengtieyi').st >= 2) return pick(['（孟铁山挠了挠头上的刀疤）以前的事……别提了。我现在只想好好过日子。', '铁衣那小子，天天念叨你。']);
        return null;
      case 'o_luqingya':
        if (s.foe) return null;
        if (s.st >= 2) return pick(['韩兄！今日可有空，再来过两招？', '我陆青崖这辈子，服过的人没几个——你算一个。']);
        if (s.st === 1) return '哼，上次不过是我一时大意。再来！';
        return '你就是那个半路进谷的韩立？听说你运气不错。敢不敢跟我比划比划？';
      case 'o_huiming':
        return s.st >= 1 ? pick(['阿弥陀佛，施主身上的戾气淡了些。', '冤冤相报何时了。施主若有解不开的结，可来寻贫僧。']) : '阿弥陀佛。施主远道而来，可是心中有事？';
      case 'o_gusonghe':
        if (s.st >= 3) return pick(['（顾松鹤拈起一枚白子）来，再陪老夫下一局。', '修行如弈棋，一步急不得。']);
        return s.st > 0 ? `（老者头也不抬，面前棋盘上已摆了半局）坐。第${s.st + 1}局。` : '（溪边青石上，一位老者独自对着一副残局出神）……观棋不语。你若会下，便坐。';
      case 'o_zhaowuji':
        if (s.st >= 2) return '……（赵无忌别过脸去，不愿与你说话）';
        return pick(['滚开，没看见本公子在忙？', '我师父是红拂！识相的，离远点。']);
      case 'o_leijiu':
        return pick(['（雷九搓着手凑上来）这位道友，想打听点什么？嘉元城里，就没有我雷九不知道的事。', '消息、门路、人头……只要灵石给够，什么买卖都能谈。']);
      case 'o_liusanniang':
        return s.warn ? '韩公子，茶给你温着呢。你那些仇家的动静，三娘替你盯着。' : pick(['（柳三娘倚着柜台，笑意盈盈）客官，喝茶还是听书？', '越京城里南来北往的人多，消息也就多。公子想听什么？']);
      case 'o_baixiao':
        if (s.ally) return pick(['（白枭抱臂靠在墙上）又是你。放心，你的悬赏我不接了。', '有人在打听你的行踪，我顺手帮你把消息掐了。']);
        return g.rel.wantedTotal() >= 300 ? '（白枭的手按在刀柄上）你的人头，现在值不少钱。' : '赏金客白枭。没人出钱的时候，我对你没兴趣。';
      case 'o_ayu':
        if (s.st >= 3) return null;
        if (s.st === 2) return '仙师哥哥！你答应过的——等你筑基了，就收我做徒弟！';
        return s.st === 1 ? '仙师哥哥，我真的有灵根吗？我真的能修仙吗？' : '（扎着双髻的小姑娘躲在门后，好奇地打量你）你……你是会飞的仙人吗？';
    }
    return null;
  }

  /** 对话中的剧情选项 */
  opts(a: any, title: string, back: () => DNode): DOpt[] | null {
    const d: NpcData = a.d; if (!d.orig || !d.alive) return null;
    const g = this.game, h = g.hero, s = this.st(d.id), R = g.rel;
    const end = (text: string, more: DOpt[] = []): DNode => ({ speaker: d.name, title, look: a.look, text, options: [...more, { label: '还有别的事', act: back }, { label: '告辞', act: () => null }] });
    const out: DOpt[] = [];
    switch (d.id) {
      case 'o_mengtieyi': {
        if (d.grudge >= 2) break;
        if (s.st === 0) out.push({ label: '答应替他打听', tone: 'gold', act: () => {
          s.st = 1; d.met = true; R.addFavor(d, 10); this.log('答应孟铁衣，替他寻找失踪的大哥孟铁山（太南山一带）。');
          g.toast('孟铁衣托你寻找其兄孟铁山——据说在太南山一带落草做了劫修。', 'info');
          return end('（孟铁衣深深一揖）大哥三年前为了给娘治病，借了一大笔灵石还不上，从此就没了音讯。后来有人说，在太南山见过他……做了劫修。\n\n道友若是遇见他——求你，留他一命。');
        } });
        if (s.st === 2) out.push({ label: '收下谢礼', tone: 'good', act: () => {
          s.st = 3; R.addFavor(d, 40); const t = this.npc('o_mengtieshan'); if (t) R.addFavor(t, 30);
          C.addItem(h, 'art_xuantie', 1); C.gainExp(h, C.need(h) * C.INSIGHT * 0.08, []);
          this.log('孟家兄弟重逢。孟铁衣以家传的玄铁飞天盾相赠。', 'good'); g.news('嘉元城孟家兄弟重逢，据说是一位姓韩的道友从中出力。', 'rumor');
          return end('（孟铁衣捧出一面乌沉沉的铁盾）这是我爹留下的玄铁飞天盾，我们兄弟修为浅，用不上它。道友莫要推辞！\n\n获得 玄铁飞天盾；修为有所精进。');
        } });
        break;
      }
      case 'o_luqingya': {
        if (s.foe || d.grudge > 0) break;
        if (s.st < 2) out.push({ label: s.st === 0 ? '应战' : '再比一场', tone: 'gold', act: () => { a.bubble = { text: '看招！', t: 2 }; g.npcs.toEnemy(a, true, true); g.toast(`与${d.name}切磋，点到为止。`); return null; } });
        break;
      }
      case 'o_huiming': {
        if (s.st === 0) out.push({ label: '请教化解恩怨之道', act: () => {
          s.st = 1; d.met = true; R.addFavor(d, 8);
          return end('（慧明双手合十）世间恩怨，无非一个「执」字。\n\n施主若与人结怨，路上再遇，不妨先听他说几句——赔礼、立誓，都是退路。实在化不开，请他的至交亲友从中说和，也比刀兵相见强。\n若是血仇……贫僧也愿替施主走一趟。只是，杀孽一重，便再难回头了。\n\n（与仇人狭路相逢时，可选择赔礼、以心魔立誓或请人说和；慧明好感足够时可替你调停）');
        } });
        const herbs = h.bag.filter((b) => itemDef(b.id).type === 'herb');
        const n = herbs.reduce((t, b) => t + b.n, 0);
        out.push({ label: '布施灵草三株（周济流民）', disabled: n < 3, hint: n < 3 ? '灵草不足' : '', act: () => {
          let left = 3; for (const b of [...herbs].sort((x, y) => itemDef(x.id).price - itemDef(y.id).price)) { const k = Math.min(left, b.n); C.removeItem(h, b.id, k); left -= k; if (!left) break; }
          R.addFavor(d, 12); g.ws.rep = clamp(g.ws.rep + 3, -100, 100); s.alms = (s.alms ?? 0) + 1;
          this.log('布施灵草，周济流民。', 'good');
          if (s.alms === 3) { C.gainExp(h, C.need(h) * C.INSIGHT * 0.1, []); return end('（慧明深深一礼）施主三番布施，功德无量。贫僧无以为报，便以一卷《清心咒》相赠，助施主护持心神。\n\n心境澄明，修为大进。'); }
          return end('阿弥陀佛。这些灵草，够城外的流民熬上几日药汤了。');
        } });
        break;
      }
      case 'o_gusonghe': {
        const cd = s.last !== undefined && g.day - s.last < 10;
        out.push({ label: '对弈一局', hint: cd ? '老者说今日乏了' : s.st < 3 ? `第 ${s.st + 1} 局` : '', disabled: cd, act: () => {
          s.last = g.day; d.met = true;
          const win = Math.random() < 0.3 + h.realm * 0.08;
          R.addFavor(d, win ? 12 : 8); s.st++;
          if (s.st === 3) {
            const sk = g.combat.randomScroll(3); if (sk) C.addItem(h, sk, 1);
            R.addFavor(d, 20); this.log('与顾松鹤对弈三局，得赠玉简。', 'good');
            return end(`（一局终了，顾松鹤拂乱棋子，长长吐出一口气）三局下来，你的棋……和你的人一样，不争一时，却步步留了后手。\n老夫与向之礼那老鬼相交三百年，他若见了你，也会喜欢。${sk ? `\n\n（顾松鹤随手抛来一枚玉简）这门《${itemDef(sk).name}》，老夫用不上了。\n获得 ${itemDef(sk).name}` : ''}\n\n（顾松鹤对你青眼有加——好感足够时可拜他为师）`);
          }
          return end(win ? '（你险胜半子。老者盯着棋盘看了许久，忽然笑了）好，好。有点意思。' : '（你中盘便落了下风，老者却不急着收官）棋输一着，不算什么。你最后那几手，不错。');
        } });
        break;
      }
      case 'o_zhaowuji': {
        if (s.st === 0) out.push({ label: '听说你在欺压新入门的弟子？', tone: 'bad', act: () => {
          s.st = 1; d.met = true;
          return { speaker: d.name, title, look: a.look, text: '（赵无忌斜眼看你）是又怎样？那小子不长眼，冲撞了本公子。怎么，你想替他出头？我师父可是红拂！', mood: 'danger', options: [
            { label: '那便领教了（动手）', tone: 'bad', act: () => { s.fight = true; d.grudge = Math.max(d.grudge, 1); d.why = '你多管闲事'; const e = g.npcs.toEnemy(a, true); e.yieldAt = 0.3; a.bubble = { text: '找死！', t: 2.5 }; return null; } },
            { label: '（掏出灵石）这事就此作罢吧', act: () => { const n = 60; if (C.bagCount(h, 'mat_lingshi') < n) return end('（赵无忌嗤笑一声）穷鬼也学人出头？'); C.removeItem(h, 'mat_lingshi', n); R.addFavor(d, 5); s.st = 2; const z = this.npc('zhongweiniang'); if (z) R.addFavor(z, 10); return end('（赵无忌掂了掂灵石）算那小子走运。'); } },
            { label: '算了', act: back },
          ] };
        } });
        break;
      }
      case 'o_leijiu': {
        const fee = 40 + 60 * h.realm;
        out.push({ label: `打听谁在找我麻烦（灵石 ${fee}）`, disabled: C.bagCount(h, 'mat_lingshi') < fee, act: () => {
          C.removeItem(h, 'mat_lingshi', fee); R.addFavor(d, 3);
          const foes = g.npcs.list.filter((o) => o.alive && (o.grudge > 0 || o.hunting)).sort((x, y) => (y.grudge - x.grudge) || (R.power(y) - R.power(x))).slice(0, 5);
          for (const o of foes) o.met = true;
          const W = R.S.wanted;
          const t = foes.length ? foes.map((o) => `· ${o.name}（${realmName(o.realm, o.stage)}，${R.locName(o.home)}）——${o.hunting ? '正在追杀你' : o.grudge >= 2 ? '与你有血仇' : '记恨你'}${o.why ? '：' + o.why : ''}`).join('\n') : '眼下嘛……还真没什么人惦记你。';
          return end(`（雷九压低声音）${t}${W.length ? `\n\n悬赏榜上：${W.map((w) => `${w.name} ${w.amount} 灵石`).join('；')}` : ''}\n\n（这些人已记入人脉录「仇敌」一栏）`);
        } });
        const priv = R.S.wanted.filter((w) => g.npcs.byId.has(w.by));
        if (priv.length) { const cost = Math.round(priv.reduce((t, w) => t + w.amount, 0) * 1.3); out.push({ label: `花钱撤下私人悬赏（灵石 ${cost}）`, disabled: C.bagCount(h, 'mat_lingshi') < cost, act: () => {
          C.removeItem(h, 'mat_lingshi', cost); R.S.wanted = R.S.wanted.filter((w) => !g.npcs.byId.has(w.by)); this.log(`托雷九打点，撤下了私人悬赏。`, 'good');
          return end('（雷九数灵石的手指飞快）成。榜单上的名字，明儿一早就没了。至于那几位苦主……他们若再出钱，我可管不着。');
        } }); }
        break;
      }
      case 'o_liusanniang': {
        if (!s.warn && d.favor >= 30) out.push({ label: '请三娘留意我的仇家（灵石 200）', disabled: C.bagCount(h, 'mat_lingshi') < 200, act: () => {
          C.removeItem(h, 'mat_lingshi', 200); s.warn = true; R.addFavor(d, 6); this.log('柳三娘答应替你留意仇家的动向。', 'good');
          return end('（柳三娘收了灵石，眼波流转）公子放心。往后谁要动你，三娘的传音符会比他的遁光先到。\n\n（仇家开始追杀时，会提前得知其姓名与修为）');
        } });
        if (d.favor < 30) out.push({ label: '喝茶听书（灵石 10）', disabled: C.bagCount(h, 'mat_lingshi') < 10, act: () => { C.removeItem(h, 'mat_lingshi', 10); R.addFavor(d, 6); d.met = true; return end(pick(['（说书人一拍醒木）……话说那黄枫谷出了个姓韩的小子，其貌不扬，却是一肚子心眼——', '（柳三娘替你续上茶）公子是个耐得住性子的人，三娘喜欢。', '（邻桌几个散修正低声议论最近的悬赏）'])); } });
        break;
      }
      case 'o_ayu': {
        if (s.st === 0 && h.realm >= 1) out.push({ label: '替她测一测灵根', act: () => {
          s.st = 1; d.met = true; R.addFavor(d, 20);
          return end('（你以一缕法力探入她的经脉——竟是罕见的水木双灵根！）\n\n（阿妤瞪大眼睛，看着你指尖亮起的微光）仙师哥哥，我……我也可以吗？');
        } });
        if (s.st === 1) out.push({ label: '答应将来收她为徒', tone: 'gold', act: () => { s.st = 2; R.addFavor(d, 20); return end('（小姑娘使劲点头）拉钩！骗人是小狗！\n\n（待你筑基后再来，便可收阿妤为徒）'); } });
        if (s.st === 2 && h.realm >= 2) out.push({ label: '收阿妤为徒', tone: 'gold', act: () => {
          s.st = 3; d.realm = 1; d.stage = 0; d.faction = 'rogue'; d.role = 'female'; d.bond = 'disciple'; R.addFavor(d, 30);
          this.log('收青牛镇的阿妤为徒。', 'good'); g.news('青牛镇小姑娘阿妤拜入韩立门下。', 'personal');
          return end('（阿妤扑通跪下，规规矩矩磕了三个头）师父在上，受徒儿一拜！\n\n阿妤踏入炼气期，成为你的弟子。');
        } });
        break;
      }
    }
    return out.length ? out : null;
  }

  /** 切磋结束 */
  onSpar(d: NpcData, won: boolean) {
    if (d.id !== 'o_luqingya') return;
    const s = this.st(d.id), g = this.game;
    if (won) { s.wins = (s.wins ?? 0) + 1; d.spar = undefined; }
    if (s.wins >= 2 && s.st < 2) {
      s.st = 2; g.rel.addFavor(d, 50); this.log('陆青崖切磋两败于你，心服口服，与你结为好友。', 'good');
      g.toast('陆青崖：「我陆青崖服了！往后你的事，就是我的事！」', 'good');
    } else if (s.st === 0) s.st = 1;
  }
  /** 被折辱 / 结仇时的特殊后续 */
  onInsult(d: NpcData) {
    if (d.id === 'o_luqingya') { const s = this.st(d.id); s.foe = true; s.rumor = 3; this.log('陆青崖被你当众折辱，怀恨在心。', 'bad'); }
  }

  /** 求饶时的剧情分支（null = 用通用求饶） */
  yieldNode(d: NpcData, e: Enemy, look: any, a: any): DNode | null {
    const g = this.game, R = g.rel, s = this.st(d.id);
    const title = `${realmName(d.realm, d.stage)} · ${R.tier(d)}`;
    const done = (text: string, good = true): DNode => ({ speaker: d.name, title, look, text, options: [{ label: '（收手）', tone: good ? 'good' : undefined, act: () => null }] });
    const spare = () => { g.combat.release(e); d.hunting = false; if (a) a.act = 'flee'; };
    if (d.id === 'o_mengtieshan' && this.st('o_mengtieyi').st === 1) {
      return { speaker: d.name, title, look, mood: 'danger', text: '（刀疤汉子半跪在地，嘴角溢血，却仍死死攥着刀）要杀便杀！老子孟铁山这条命，早就不值钱了！', options: [
        { label: '你弟弟孟铁衣在找你', tone: 'gold', act: () => {
          spare(); a && (a.act = 'idle');
          this.st('o_mengtieyi').st = 2; d.grudge = 0; d.why = undefined; d.pers = 'righteous'; d.home = 'jiayuan'; R.addFavor(d, 40);
          const t = this.npc('o_mengtieyi'); if (t) R.addFavor(t, 20);
          this.log('在太南山劝回了孟铁山。', 'good');
          return done('（孟铁山手里的刀「当啷」落地）……铁衣？那小子……还在找我？\n（这个凶悍的汉子忽然捂住了脸）\n……我这就回去。韩……道友，多谢。\n\n（回嘉元城找孟铁衣吧）');
        } },
        { label: '斩草除根', tone: 'bad', act: () => { g.combat.finish(e); return null; } },
      ] };
    }
    if (d.id === 'o_zhaowuji' && s.fight) {
      s.fight = false;
      return { speaker: d.name, title, look, mood: 'danger', text: '（赵无忌瘫坐在地，脸色惨白）你、你敢动我？我师父是红拂！她不会放过你的！', options: [
        { label: '饶他，让他去给师弟赔罪', tone: 'good', act: () => {
          spare(); s.st = 2; d.grudge = 1; d.why = '被你当众教训'; g.ws.rep = clamp(g.ws.rep + 5, -100, 100);
          const z = this.npc('zhongweiniang'); if (z) R.addFavor(z, 15); const hf = this.npc('hongfu'); if (hf) R.addFavor(hf, 5);
          this.log('教训了赵无忌，饶他一命。红拂长老听说后，只淡淡说了句「也好」。', 'good');
          return done('（赵无忌连滚带爬地跑了）\n\n不久后，谷中传开了：赵无忌给那个被他欺负的小师弟赔了礼。红拂长老听说后，只淡淡说了句——「也好，省得我动手。」');
        } },
        { label: '斩草除根', tone: 'bad', act: () => { g.combat.finish(e); return null; } },
      ] };
    }
    if (d.id === 'o_baixiao' && !s.ally) {
      s.beat = (s.beat ?? 0) + 1;
      return { speaker: d.name, title, look, mood: 'danger', text: s.beat >= 2 ? '（白枭单膝跪地，刀已断成两截）……又输了。两次。动手吧，干我们这行的，没有第三次。' : '（白枭捂着伤口退开几步，眼神依旧冷静）技不如人。要杀要剐，随你。', options: [
        { label: '饶他一命', tone: 'good', act: () => {
          spare(); d.grudge = 0; d.why = undefined;
          if (s.beat >= 2) { s.ally = true; R.addFavor(d, 60); this.log('两度饶过赏金客白枭，他从此不再接你的悬赏。', 'good'); return done('（白枭沉默良久，收起断刀）……你的悬赏，我不接了。往后谁再接，先过我这一关。\n\n（白枭成为你的朋友：赏金客不会再冲着他的名头来找你）'); }
          R.addFavor(d, 15); return done('（白枭深深看了你一眼）……下次，你未必有这么好的运气。');
        } },
        { label: '斩草除根', tone: 'bad', act: () => { g.combat.finish(e); return null; } },
      ] };
    }
    return null;
  }
  /** 哪些原创人物必会求饶 */
  yieldAt(d: NpcData): number | undefined {
    if (d.id === 'o_mengtieshan' && this.st('o_mengtieyi').st === 1) return 0.35;
    if (d.id === 'o_baixiao' && !this.st('o_baixiao').ally) return 0.3;
    return undefined;
  }

  /** 每日：陆青崖背后中伤、伺机伏击 */
  daily(_days: number) {
    const g = this.game, R = g.rel;
    const lq = this.npc('o_luqingya'), s = this.st('o_luqingya');
    if (lq && lq.alive && s.foe) {
      if (s.rumor > 0 && Math.random() < _days / 20) {
        s.rumor--; g.ws.rep = clamp(g.ws.rep - 3, -100, 100);
        for (const o of g.npcs.list) if (o.alive && o.sect === 'huangfeng' && o.met && Math.random() < 0.3) R.addFavor(o, -4);
        this.log('陆青崖在谷中四处散布你的流言，同门看你的眼神多了几分异样。', 'bad');
        if (s.rumor === 0) { lq.grudge = 2; lq.why = '你当众折辱于他'; lq.huntAt = g.day + 5; }
      }
    }
  }
}
