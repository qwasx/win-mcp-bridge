// 第十八步：心魔劫——结丹、结婴时，按你一路走来的经历生成幻境
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import { BEAUTIES } from '../data/beauties';
import { REALMS } from '../data/realms';

interface Trial { id: string; title: string; text: string; opts: { label: string; v: number; after: string }[] }

const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class XinMo {
  constructor(private game: Game) {}
  /** 是否需要过心魔关（筑基→结丹、结丹→元婴） */
  needed() { const h = this.game.hero; return C.bottleneck(h) === 'major' && h.realm >= 2 && h.realm <= 3; }

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
    // 结婴专属
    if (h.realm === 3) out.push({ id: 'dan', title: '碎丹', text: '金丹在丹田里裂开一道缝。\n\n结婴，便是要亲手把苦修百年的金丹击碎。若是碎了却凝不成元婴……便什么都没了。', opts: [
      { label: '（毫不犹豫，碎丹）', v: 0.09, after: '金丹轰然碎裂，一个小小的人影在光中睁开了眼睛。' },
      { label: '（犹豫片刻）', v: -0.03, after: '那一丝犹豫，让裂缝扭曲了一下。' },
    ] });
    return out;
  }

  /** 开始心魔劫。完成后调用 done(bonus) */
  start(done: (bonus: number) => void) {
    const g = this.game, h = g.hero;
    const n = h.realm === 3 ? 4 : 3;
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
