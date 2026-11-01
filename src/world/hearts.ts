// 第五步：红颜系统——相识、好感、送礼、专属剧情、同行助战
import type { Game } from './game';
import { BEAUTIES, BEAUTY_BY_ID, BeautyDef, Chapter } from '../data/beauties';
import type { HeartState } from './worldstate';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { LOC_BY_ID, locLabel } from '../data/world';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Hearts {
  game: Game;
  constructor(game: Game) { this.game = game; }

  st(id: string): HeartState {
    const ws = this.game.ws;
    if (!ws.hearts[id]) ws.hearts[id] = { favor: 0, stage: 0, met: false, follow: false, flags: {}, lastGift: -99, lastTalk: -99, gifts: 0 };
    return ws.hearts[id];
  }
  /** 当前同行者 */
  follower(): BeautyDef | null { for (const b of BEAUTIES) if (this.game.ws.hearts[b.id]?.follow) return b; return null; }
  bonus(kind: BeautyDef['bonus']['kind']) { const f = this.follower(); return f && f.bonus.kind === kind ? f.bonus.v * (this.game.heartx?.keepBonus(f.id) ?? 1) : 0; }

  nextChapter(b: BeautyDef): Chapter | null {
    const s = this.st(b.id);
    if (s.flags.parted) return null;
    return b.chapters[s.stage] ?? null;
  }
  reqOk(b: BeautyDef, ch: Chapter): { ok: boolean; why: string } {
    const s = this.st(b.id), h = this.game.hero, r = ch.req;
    if (r.favor !== undefined && s.favor < r.favor) return { ok: false, why: `好感需 ${r.favor}` };
    if (r.realm !== undefined && h.realm < r.realm) return { ok: false, why: `需${['凡人', '炼气', '筑基', '结丹', '元婴'][r.realm]}期` };
    if (r.flag && !s.flags[r.flag]) return { ok: false, why: '时机未到' };
    if (r.notFlag && s.flags[r.notFlag]) return { ok: false, why: '' };
    if (r.item && C.bagCount(h, r.item) <= 0) return { ok: false, why: `需${itemDef(r.item).name}` };
    return { ok: true, why: '' };
  }

  talk(id: string, _a?: unknown) {
    const b = BEAUTY_BY_ID[id]; if (!b) return;
    const s = this.st(id), g = this.game;
    const first = !s.met;
    s.met = true;
    const ch = this.nextChapter(b);
    if (!first) g.heartx?.onTalk(b);
    if (first && ch && this.reqOk(b, ch).ok) { g.openDialog(this.chapterNode(b, ch)); return; }
    g.openDialog(this.mainNode(b));
  }
  private head(b: BeautyDef) { const s = this.st(b.id); return { speaker: b.name, title: `${b.title} · 好感 ${Math.round(s.favor)}${s.follow ? ' · 同行中' : ''}`, portrait: b.portrait, look: b.look }; }
  mainNode(b: BeautyDef): DNode {
    const s = this.st(b.id), g = this.game;
    const tier = s.favor >= 75 ? 3 : s.favor >= 45 ? 2 : s.favor >= 15 ? 1 : 0;
    const opts: DOpt[] = [];
    const ch = this.nextChapter(b);
    if (ch) {
      const ok = this.reqOk(b, ch);
      opts.push({ label: `【${ch.title}】`, tone: 'love', disabled: !ok.ok, hint: ok.ok ? '' : ok.why || ch.hint, act: () => this.chapterNode(b, ch) });
    }
    if (!s.flags.parted) opts.push(...(g.heartx?.options(b) ?? []));
    opts.push({ label: '闲谈', hint: g.day - s.lastTalk < 1 ? '今日已叙过' : '', act: () => {
      const fresh = g.day - s.lastTalk >= 1;
      if (fresh) { s.lastTalk = g.day; s.favor = clamp(s.favor + 2, -100, 100); }
      return { ...this.head(b), text: this.chat(b, tier), options: [{ label: '……', act: () => this.mainNode(b) }] };
    } });
    opts.push({ label: '赠礼', act: () => this.giftNode(b) });
    if (s.flags.companion) opts.push(s.follow ? { label: '请她留下', act: () => { this.setFollow(b.id, false); return { ...this.head(b), text: '（她点点头）好。我等你回来。', options: [{ label: '告辞', act: () => null }] }; } } : { label: '邀她同行', tone: 'love', act: () => { this.setFollow(b.id, true); return { ...this.head(b), text: b.follow, options: [{ label: '走吧', act: () => null }] }; } });
    opts.push({ label: '告辞', act: () => null });
    return { ...this.head(b), text: b.greet[tier], options: opts, mood: tier >= 2 ? 'love' : 'normal' };
  }
  private chat(b: BeautyDef, tier: number) {
    const g = this.game, h = g.hero;
    const L: Record<string, string[]> = {
      nangongwan: ['掩月宗的桂花开了。……你若得空，可以来看看。', '修仙之人，最忌心乱。可我近来，总是心乱。', '你又受伤了？……过来，我替你看看。'],
      dongxuaner: ['你说，我穿粉色好看还是穿白色好看？——不许说都好看！', '师父又罚我面壁了，都怪你！……好吧，不怪你。', '那些男弟子烦死了，还是你好，从来不缠着我。'],
      chenqiaoqian: ['药园里的灵草，我替师兄多照看了几株。', '师兄……你吃饭了吗？我带了点心。', '我在想，若能一直这样，就好了。'],
      mocaihuan: ['韩大哥，仙人也会做梦吗？', '我学会了一首新曲子，叫《凤求凰》……不、不是那个意思！', '嘉元城的糖葫芦又涨价了，你说气不气人。'],
      mupeiling: ['冰魄诀又进了一层，多亏你。', '我煮了灵茶，你尝尝，是不是比上次好？', '从前我只想着活下去。现在，我想活得好一点。'],
      ziling: ['乱星海的月亮，比天南的圆。你信吗？', '我今日推掉了三门亲事。你猜为什么？', '跟你说话，我不必想下一句该怎么说。真好。'],
      yuanyao: ['妍丽说你是个好人。我说，我早就知道了。', '鬼道修炼很苦，但想到你，就不那么苦了。', '你说，人死了以后，魂魄会去哪里？'],
      yinyue: ['我又想起了一点……雪原上的月亮，是银色的。', '你的储物袋里好乱。我替你整理了一下。', '器灵是不会做梦的。可我昨晚，好像梦见你了。'],
    };
    const arr = L[b.id] ?? ['……'];
    let s = arr[Math.min(arr.length - 1, Math.floor(Math.random() * (tier + 1)))];
    if (h.hp < 0.5) s = '你脸色好差……先坐下，调息片刻。';
    return s;
  }
  chapterNode(b: BeautyDef, ch: Chapter): DNode {
    const s = this.st(b.id), g = this.game, h = g.hero;
    return {
      ...this.head(b), title: `${b.name} · ${ch.title}`, text: ch.text, mood: 'love',
      options: ch.choices.map((c) => {
        const lack = c.take && C.bagCount(h, c.take.id) < c.take.n;
        return {
          label: c.label, tone: c.tone, disabled: !!lack, hint: lack ? `需${itemDef(c.take!.id).name}×${c.take!.n}` : '',
          act: () => {
            s.favor = clamp(s.favor + c.favor, -100, 100);
            if (c.flag) s.flags[c.flag] = true;
            if (c.take) C.removeItem(h, c.take.id, c.take.n);
            if (c.give) { C.addItem(h, c.give.id, c.give.n); }
            if (c.exp) { const msgs: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * c.exp, msgs); }
            s.stage++;
            if (c.end === 'companion') { s.flags.companion = true; this.setFollow(b.id, true); g.news(`${b.name}与韩立结伴同行。`, 'personal'); }
            if (c.end === 'part') { s.flags.parted = true; this.setFollow(b.id, false); }
            const extra = c.give ? `\n\n（获得 ${itemDef(c.give.id).name}${c.give.n > 1 ? '×' + c.give.n : ''}）` : '';
            const fav = c.favor > 0 ? `　好感 +${c.favor}` : c.favor < 0 ? `　好感 ${c.favor}` : '';
            return { ...this.head(b), title: `${b.name} · ${ch.title}`, text: c.reply + extra + (fav ? `\n\n${fav}` : ''), mood: 'love', options: [{ label: '（继续）', act: () => null }] } as DNode;
          },
        } as DOpt;
      }),
    };
  }
  private giftNode(b: BeautyDef): DNode {
    const s = this.st(b.id), g = this.game, h = g.hero;
    const today = Math.floor(g.day);
    if (today - s.lastGift < 3) return { ...this.head(b), text: '（她笑着摇头）你前几日才送过我东西呢。', options: [{ label: '好', act: () => this.mainNode(b) }] };
    const cands = h.bag.filter((x) => { const t = itemDef(x.id).type; return (t === 'pill' || t === 'herb' || t === 'artifact' || t === 'material' || t === 'talisman') && x.id !== 'mat_lingshi'; });
    cands.sort((x, y) => (b.likes.includes(y.id) ? 1 : 0) - (b.likes.includes(x.id) ? 1 : 0) || itemDef(y.id).price - itemDef(x.id).price);
    const opts: DOpt[] = cands.slice(0, 6).map((x) => {
      const it = itemDef(x.id), liked = b.likes.includes(x.id);
      return { label: `${liked ? '♥ ' : ''}${it.name}`, tone: liked ? 'love' as const : undefined, act: () => {
        C.removeItem(h, x.id, 1); s.lastGift = today; s.gifts++; g.heartx?.onGift(b.id);
        const gain = Math.round(clamp((liked ? 12 : 3) + Math.log10(Math.max(10, it.price)) * (liked ? 3 : 1.5), 2, 25));
        s.favor = clamp(s.favor + gain, -100, 100);
        const txt = liked ? ['（她眼睛一亮，小心收好）你怎么知道我想要这个？', '这……太贵重了。可是，我很喜欢。', '（她低头看着礼物，耳根微红）……谢谢。'][Math.floor(Math.random() * 3)] : ['谢谢。', '你有心了。', '（她收下了，礼貌地道谢）'][Math.floor(Math.random() * 3)];
        return { ...this.head(b), text: `${txt}\n\n好感 +${gain}`, options: [{ label: '……', act: () => this.mainNode(b) }] } as DNode;
      } };
    });
    if (C.bagCount(h, 'mat_lingshi') >= 100) opts.push({ label: '灵石 100', act: () => { C.removeItem(h, 'mat_lingshi', 100); s.lastGift = today; s.favor = clamp(s.favor + 2, -100, 100); return { ...this.head(b), text: b.id === 'mocaihuan' ? '这么多灵石？我拿去给娘亲买药！' : '（她有些哭笑不得）你送我灵石做什么……', options: [{ label: '……', act: () => this.mainNode(b) }] }; } });
    opts.push({ label: '算了', act: () => this.mainNode(b) });
    return { ...this.head(b), text: `（你想送她什么？她偏爱：${b.likes.map((i) => itemDef(i).name).slice(0, 3).join('、')}）`, options: opts };
  }

  setFollow(id: string, on: boolean) {
    const g = this.game;
    for (const b of BEAUTIES) { const s = g.ws.hearts[b.id]; if (s && s.follow && b.id !== id && on) { s.follow = false; g.npcs.dismiss('b_' + b.id); g.heartx?.onSwitch(b.id); } }
    const s = this.st(id); s.follow = on;
    if (on) { g.npcs.summon('b_' + id); g.toast(`${BEAUTY_BY_ID[id].name}与你同行：${BEAUTY_BY_ID[id].bonus.text}`, 'good'); }
    else g.npcs.dismiss('b_' + id);
  }
  /** 读档后恢复同行 */
  restore() { const f = this.follower(); if (f) this.game.npcs.summon('b_' + f.id); }

  /** 红颜录 */
  list() {
    return BEAUTIES.map((b) => {
      const s = this.game.ws.hearts[b.id];
      const ch = s ? this.nextChapter(b) : b.chapters[0];
      return { b, s: s ?? null, hint: !s?.met ? `传闻她在「${locLabel(b.home) || '?'}」一带` : s.flags.parted ? '缘尽于此' : ch ? `${ch.title}：${ch.hint}` : s.flags.companion ? '道侣同心' : '故事告一段落' };
    });
  }
}
