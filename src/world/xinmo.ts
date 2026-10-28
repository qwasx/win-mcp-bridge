// 第十八步：心魔劫——结丹、结婴时，按你一路走来的经历生成幻境
// 第 2 阶段：幻境扩充（仇家、丹毒、前次失败、贪念、凡俗爹娘、七玄旧友、孤身散修、杀伐……），结婴五重
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import { BEAUTIES } from '../data/beauties';
import { REALMS, realmName } from '../data/realms';
import * as A from './ascend';

interface Trial { id: string; title: string; text: string; opts: { label: string; v: number; after: string }[] }

const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class XinMo {
  constructor(private game: Game) {}
  /** 是否需要过心魔关（筑基→结丹、结丹→元婴） */
  needed() { const h = this.game.hero; return C.bottleneck(h) === 'major' && h.realm >= 2 && h.realm <= 3; }
  /** 测试 / 面板：当前经历能生成哪些幻境 */
  pool() { return this.trials().map((t) => t.title); }

  private trials(): Trial[] {
    const g = this.game, h = g.hero, ws = g.ws, out: Trial[] = [];
    // 杀孽
    if (h.kills >= 40 || ws.rep < -20) out.push({ id: 'kill', title: '血河', text: `你盘坐在一条血河中央。\n\n河面浮起一张张脸——死在你手下的${h.kills}条性命，有妖兽，有修士，有些你连名字都没问。它们齐声问你：值得吗？`, opts: [
      { label: '「修仙路上，本就是你死我活。」', v: 0.05, after: '血河翻涌了一下，慢慢沉了下去。你的心没有动。' },
      { label: '「……是我对不住你们。」（为他们诵一遍往生咒）', v: 0.07, after: '那些脸一张张闭上眼睛，散成点点红光。' },
      { label: '（运功强行镇压）', v: -0.06, after: '血河越压越高，没过了你的胸口。法力乱了一瞬。' },
    ] });
    // 红颜
    const comp = BEAUTIES.find((b) => ws.hearts[b.id]?.flags.companion && !ws.hearts[b.id]?.flags.parted);
    const close = comp ?? BEAUTIES.filter((b) => (ws.hearts[b.id]?.favor ?? 0) >= 40).sort((a, b) => ws.hearts[b.id].favor - ws.hearts[a.id].favor)[0];
    if (close) { const fv = ws.hearts[close.id].favor; out.push({ id: 'love', title: '红尘', text: `${close.name}站在你面前，眼里含着泪。\n\n「别修了。你这一闭关，又是几十年。我等不起了……留下来，就做一对凡人夫妻，好不好？」\n\n她的手是暖的。`, opts: [
      { label: '（抱住她）「好。」', v: -0.08, after: '怀里的人化作一缕黑烟。你猛然惊醒，嘴角溢出一丝血。' },
      { label: '「你不是她。」（并指为剑，斩下）', v: 0.05, after: '幻影碎成万千光点。心口却空了一块。' },
      ...(fv >= 70 ? [{ label: '「她不会这样说。她会说——去吧，我等你。」', v: 0.1, after: `幻影怔住，然后笑了，笑得和真的${close.name}一模一样，慢慢淡去。\n\n你心中一片澄明。` }] : []),
    ] }); }
    // 墨大夫
    out.push({ id: 'mo', title: '旧人', text: '一间昏暗的药庐。墨大夫坐在灯下，脸上爬满黑色的纹路。\n\n「好徒儿……你的身子，借为师用一用。为师待你不薄吧？」\n\n他伸出枯瘦的手，按向你的天灵盖。', opts: [
      { label: '「你早已死了，墨居仁。」', v: 0.07, after: '药庐连同老人一起塌成灰烬。七玄门的钟声远远传来，又散了。' },
      { label: '（出手抢先杀他）', v: 0.02, after: '你又杀了他一次。和当年一样。' },
      { label: '（后退一步）「师父……」', v: -0.07, after: '那只手按了下来。你惊出一身冷汗，金丹一阵震颤。' },
    ] });
    // 寿元
    out.push({ id: 'age', title: '白发', text: `你看见自己——${Math.floor(h.age) + 80}岁的自己，白发枯坐在一间破洞府里，寿元将尽，境界寸步未进。\n\n他抬头看你：「你逃不掉的。资质如此，再怎么熬，也不过是我这样。」`, opts: [
      { label: '「那便熬到熬不动为止。」', v: 0.07, after: '老人愣了愣，叹口气，闭上了眼睛。' },
      { label: '「我有掌天瓶。」', v: 0.03, after: '老人笑了：「靠一只瓶子？」——话音未落，他已散去。' },
      { label: '（心生恐惧，加快运功）', v: -0.07, after: '灵力在经脉里冲撞，你险些走火入魔。' },
    ] });
    // 掌天瓶
    out.push({ id: 'bottle', title: '宝瓶', text: '掌天瓶悬在你面前，瓶口滴落着绿液。\n\n一个声音在耳边低语：「有它在，何必苦修？把灵药全催熟，把丹药全吃下去——一夜就能结婴。」', opts: [
      { label: '（伸手去拿瓶子）', v: -0.07, after: '瓶子在你指尖碎成了沙。原来贪念也会反噬。' },
      { label: '「瓶子是助力，道是我自己的。」', v: 0.07, after: '瓶子沉默地落回你怀里，温温的。' },
    ] });
    // 散修出身 / 宗门
    if (ws.sect) out.push({ id: 'sect', title: '同门', text: '宗门被围，师兄弟一个个倒下。有人朝你喊：「韩师弟！快来救——」\n\n可你正在冲关的紧要关头。', opts: [
      { label: '（不为所动）', v: 0.05, after: '喊声越来越远。幻境里的血是假的——你知道。' },
      { label: '（中断冲关，冲出去）', v: -0.05, after: '洞府外一片寂静，什么都没有。你的灵力已经散了一半。' },
      { label: '「我结丹之后，自会护你们周全。」', v: 0.06, after: '喊声停了。' },
    ] });

    // ---------- 第 2 阶段：更多幻境 ----------
    const asc = A.ascOf(h);
    // 仇家
    const foe: any = (g.rel?.hunters?.() ?? []).find((d: any) => d.alive);
    if (foe) out.push({ id: 'foe', title: '宿仇', text: `${foe.name}站在你面前，${realmName(foe.realm, foe.stage)}的气息压得洞府嗡嗡作响。\n\n「${foe.why ?? '旧账'}——你以为闭关就躲得过去？等你出来，我就在门口。」\n\n他的笑声在你脑子里回荡，一遍又一遍。`, opts: [
      { label: '「那就等我出来。」（不理会，继续运功）', v: 0.06, after: '笑声渐渐低了下去。仇是真的，但不在此刻。' },
      { label: '（满腔杀意，想现在就冲出去）', v: -0.07, after: '杀意一起，灵力立刻乱了方寸。' },
      { label: '「恩怨终有了结时，不在今日。」', v: 0.05, after: `${foe.name}的影子慢慢淡去。` },
    ] });
    // 丹毒
    if (asc.toxin >= 30) out.push({ id: 'toxin', title: '丹毒', text: `你低头，看见自己的经脉里爬满了黑色的细蛇——那是这些年吞下的丹药，一颗一颗，化成了毒。\n\n「再吃一颗……」蛇们齐声说，「再吃一颗就好了。」`, opts: [
      { label: '（以真火一寸寸炼去）', v: 0.06, after: '经脉灼痛，黑蛇一条条化成青烟。痛，但干净了。' },
      { label: '（伸手去摸储物袋里的丹药）', v: -0.08, after: '手指碰到丹瓶的一瞬，黑蛇猛地钻进了丹田。' },
      { label: '「是我贪快。」', v: 0.04, after: '蛇们停住了，像是没想到你会认。' },
    ] });
    // 前次失败
    if ((asc.insight[h.realm] ?? 0) > 0) out.push({ id: 'fail', title: '旧伤', text: `上一次冲关失败的那一刻，又一次在你眼前重演——经脉寸断，鲜血从七窍涌出，修为一泻千里。\n\n「你会再失败一次的。」一个声音说，「和上次一模一样。」`, opts: [
      { label: '「上次的错，我记得每一处。」', v: 0.08, after: '幻象里的你停住了，然后慢慢站了起来。' },
      { label: '（心头一紧，灵力收了三分）', v: -0.06, after: '你怕了。灵力也跟着怕了。' },
    ] });
    // 贪念
    if (C.bagCount(h, 'mat_lingshi') >= 3000) out.push({ id: 'greed', title: '金山', text: `洞府里堆满了灵石，一直堆到洞顶，还在往外溢。\n\n「这些都是你的。」有人在你耳边说，「何必冒险？守着它们，舒舒服服地活几百年，不好吗？」`, opts: [
      { label: '（一脚踢开灵石堆）', v: 0.06, after: '灵石哗啦啦塌下去，化成了沙。' },
      { label: '（多看了一眼）', v: -0.05, after: '只一眼，心就沉了下去。' },
      { label: '「灵石是路费，不是终点。」', v: 0.05, after: '金山无声无息地消失了。' },
    ] });
    // 凡俗爹娘
    out.push({ id: 'home', title: '故里', text: `韩家村的土路，村口那棵老槐树。\n\n娘在灶前烧火，爹蹲在门槛上抽旱烟，抬头看见你，愣了半天：「……是二愣子？你、你咋一点没老？」\n\n他们的头发都白了。不，他们早就不在了。`, opts: [
      { label: '（跪下磕三个头）', v: 0.07, after: '炊烟散了，老槐树也散了。你额头上沾着一点并不存在的土。' },
      { label: '（转身就走，不敢回头）', v: -0.04, after: '身后传来娘的喊声。你走得越快，那声音越近。' },
      { label: '「爹，娘，儿子在修仙。会修成的。」', v: 0.05, after: '爹咧嘴笑了，露出缺了的门牙。' },
    ] });
    // 七玄旧友
    if (h.realm >= 2) out.push({ id: 'li', title: '故人', text: `厉飞雨坐在七玄门的山崖上，晃着腿冲你笑。他的鬓角全白了——当年为了练功，他吃了太多抽髓丸。\n\n「韩老弟，你倒是越来越年轻了。」他说，「我呢，没几年活头了。你说，修仙到底图什么？」`, opts: [
      { label: '「图一个，不必再看着朋友老死。」', v: 0.07, after: '厉飞雨怔了怔，大笑起来，笑着笑着就散了。' },
      { label: '「……我不知道。」', v: -0.03, after: '山风很冷。你确实不知道。' },
      { label: '（陪他坐了一会儿）', v: 0.04, after: '你们谁也没说话，看着太阳落下去。' },
    ] });
    // 孤身散修
    if (!ws.sect && h.realm >= 3) out.push({ id: 'alone', title: '孤舟', text: '你一个人站在无边的海上，四面八方都是灰色的浪。没有宗门，没有师长，没有退路。\n\n浪越来越高。', opts: [
      { label: '「一个人，也走到了这里。」', v: 0.07, after: '浪在你脚下慢慢平了。' },
      { label: '（大声呼救）', v: -0.06, after: '没有人回答。从来就没有人回答。' },
    ] });
    // 杀伐
    if (h.kills >= 150 && h.realm >= 3) out.push({ id: 'blade', title: '杀伐', text: `你手里的飞剑在滴血。你低头看——剑身上映出的，是一张狞笑的脸。\n\n是你自己。\n\n「再多杀一些，」那张脸说，「杀到没人敢挡你的路。」`, opts: [
      { label: '「剑是护身的，不是我的主人。」（收剑入鞘）', v: 0.07, after: '剑身上的脸扭曲了一下，消失了。' },
      { label: '（握紧剑柄）', v: -0.07, after: '剑在你手里震得更厉害了。' },
    ] });
    // 结婴专属
    if (h.realm === 3) out.push({ id: 'dan', title: '碎丹', text: '金丹在丹田里裂开一道缝。\n\n结婴，便是要亲手把苦修百年的金丹击碎。若是碎了却凝不成元婴……便什么都没了。', opts: [
      { label: '（毫不犹豫，碎丹）', v: 0.09, after: '金丹轰然碎裂，一个小小的人影在光中睁开了眼睛。' },
      { label: '（犹豫片刻）', v: -0.03, after: '那一丝犹豫，让裂缝扭曲了一下。' },
    ] });
    return out;
  }

  /** 开始心魔劫。完成后调用 done(bonus) */
  start(done: (bonus: number) => void, n0?: number) {
    const g = this.game, h = g.hero;
    const n = n0 ?? (h.realm === 3 ? 4 : 3);
    const pool = shuffle(this.trials());
    const dan = pool.findIndex((t) => t.id === 'dan'); if (dan > 0) pool.unshift(...pool.splice(dan, 1));
    const list = pool.slice(0, n); if (dan >= 0) { const d = list.shift()!; list.push(d); }
    let bonus = 0;
    const head = { speaker: '心魔', title: `心魔劫 · ${REALMS[h.realm + 1]?.name ?? ''}`, mood: 'danger' as const };
    const step = (i: number): DNode => {
      if (i >= list.length) return { ...head, title: '心魔劫 · 尽', text: `幻境一层层剥落，你回到了蒲团上。\n\n${bonus >= 0.15 ? '道心通明，从未如此清楚自己要什么。' : bonus > 0 ? '心境尚稳。' : bonus > -0.08 ? '心神有些动摇。' : '道心蒙尘，冷汗湿透了衣衫。'}\n\n（冲关成功率 ${bonus >= 0 ? '+' : ''}${Math.round(bonus * 100)}%）`, options: [{ label: '（凝神，冲关！）', tone: 'gold', act: () => { done(bonus); return null; } } as DOpt] };
      const t = list[i];
      return { ...head, title: `心魔劫 · ${t.title}（${i + 1}/${list.length}）`, text: t.text, options: shuffle(t.opts.slice()).map((o) => ({ label: o.label, act: () => { bonus += o.v; return { ...head, title: `心魔劫 · ${t.title}`, text: `${o.after}\n\n${o.v > 0 ? '（心境 ↑）' : '（心境 ↓）'}`, options: [{ label: '……', act: () => step(i + 1) }] }; } } as DOpt)) };
    };
    g.openDialog(step(0));
  }
}
