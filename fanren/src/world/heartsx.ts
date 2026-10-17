// 第十八步：红颜的日常
// - 传音符：闲话、托付（寻药 / 除妖 / 想见你）、节日相邀、吃醋、求援
// - 约她同游：按当下情境（月夜、海边、雪、雨、花、集市、山巅、煮茶）展开，收集共同回忆
// - 信物：好感 40/60/80 各赠一件；同心香囊让她的同行加成提升五成
// - 双修：道侣、好感 80，在灵脉或洞府
// - 同行时的闲话气泡；在她面前给别人送礼，她会吃醋
import type { Game } from './game';
import { BEAUTIES, BEAUTY_BY_ID, BeautyDef } from '../data/beauties';
import { HEART_LINES, DATE_NAME, DATE_TEXT, DATE_CHOICES, CONTEXT_BUBBLES, FESTIVALS, DateScene } from '../data/heartlines';
import type { DNode, DOpt } from './modal';
import type { Letter } from './worldstate';
import * as C from './cultivation';
import { ITEM_LIST, itemDef } from '../data/items';
import { ACTIVE_MAP, locLabel } from '../data/world';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import { npcMap } from './npc';
import { dirName, loot } from './sites';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const KEEP = ['gift_fan', 'gift_hairpin', 'gift_sachet'];
const KEEP_AT = [40, 60, 80];

interface Req { kind: 'herb' | 'kill' | 'visit'; id?: string; minAge?: number; n?: number; k0?: number; until: number }

export class HeartLife {
  game: Game;
  bubble: { id: string; text: string; t: number } | null = null;
  private bubT = rand(20, 40);
  private chk = 0;
  private sosCd = 0;
  constructor(g: Game) { this.game = g; }
  private hs(id: string) { return this.game.hearts.st(id); }
  private fav(id: string, d: number) { const s = this.hs(id); s.favor = clamp(s.favor + d, -100, 100); }
  get unread() { return (this.game.ws.letters ?? []).filter((l) => !l.read).length; }
  private dayOfYear() { const d = Math.floor(this.game.day) % 360; return { m: Math.floor(d / 30) + 1, d: (d % 30) + 1, y: Math.floor(this.game.day / 360) + 1 }; }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game, ws = g.ws;
    ws.letters ??= [];
    this.bubbleTick(dt);
    this.sosTick(dt);
    this.chk -= dt; if (this.chk > 0) return; this.chk = 2;
    const f = ws.flags as any;
    f.nextLetter ??= g.day + rand(14, 24);
    // 托付到期 / 除妖完成
    for (const b of BEAUTIES) {
      const s = ws.hearts[b.id]; if (!s?.met) continue;
      const r = s.flags.req as unknown as Req | undefined; if (!r) continue;
      if (r.kind === 'kill' && (g.hero.kills ?? 0) >= (r.k0 ?? 0) + (r.n ?? 5)) { delete s.flags.req; this.fav(b.id, 9); const got = loot(g, clamp(b.realm - 1, 0, 4), 0.8, { scroll: 0.25, map: 0.1 }); this.send(b.id, 'gift', `听说那一带的妖兽都被你清干净了。……谢谢。附上一点心意，莫要推辞。\n\n（随符附赠：${got.join('、')}）\n\n好感 +9`); }
      else if (g.day > r.until) { delete s.flags.req; this.fav(b.id, -3); this.send(b.id, 'chat', r.kind === 'visit' ? '……你没来。没关系，我知道你忙。' : '那件事，我已经托别人办了。不必挂心。'); }
    }
    // 节日
    const doy = this.dayOfYear();
    for (const fe of FESTIVALS) {
      if (doy.m !== fe.m || Math.abs(doy.d - fe.d) > 2) continue;
      const key = `fest_${doy.y}_${fe.name}`; if (f[key]) continue; f[key] = 1;
      const cands = BEAUTIES.filter((b) => { const s = ws.hearts[b.id]; return s?.met && !s.flags.parted && s.favor >= 35; }).sort((a, b) => ws.hearts[b.id].favor - ws.hearts[a.id].favor);
      if (cands[0]) { const b = cands[0]; (this.hs(b.id).flags as any).fest = `${doy.y}_${fe.name}`; this.send(b.id, 'fest', `${fe.name}将至。${b.id === 'dongxuaner' ? '你要是不来陪我，我就再也不理你了！' : b.id === 'nangongwan' ? '……你若得空，便来。' : '你会来吗？我等你。'}\n\n（节日前后几日内去见她）`); }
    }
    if (g.day < f.nextLetter) return;
    f.nextLetter = g.day + rand(24, 44);
    const cands = BEAUTIES.filter((b) => { const s = ws.hearts[b.id]; return s?.met && !s.flags.parted && s.favor >= 15 && !s.follow; });
    if (!cands.length) return;
    const b = pick(cands), s = this.hs(b.id), L = HEART_LINES[b.id];
    const jealous = (s.flags as any).jealousUntil > g.day && s.favor >= 45;
    const r = Math.random();
    if (jealous && r < 0.5) { delete (s.flags as any).jealousUntil; this.send(b.id, 'jealous', L.jealous, [{ label: '「我心里只有你。」', favor: 5, reply: '……油嘴滑舌。（她没再追问）' }, { label: '「你吃醋了？」', favor: -1, reply: '谁、谁吃醋了！' }, { label: '（不回）', favor: -5, reply: '' }]); return; }
    if (r < 0.1 && s.favor >= 40 && this.sosCd <= g.time && !(ws.flags as any).sos) { this.startSos(b); return; }
    if (r < 0.42 && !s.flags.req) { this.startReq(b); return; }
    this.send(b.id, 'chat', pick(L.letters), [{ label: '「我也想你。」', favor: 4, reply: pick(['（回符很快就来了，只有一个字）嗯。', '……谁想你了。', '（她回了一个小小的笑脸印记）']) }, { label: '「近来安好，勿念。」', favor: 2, reply: '好。你也保重。' }, { label: '「在修炼，勿扰。」', favor: -3, reply: '……知道了。' }]);
  }
  send(from: string, kind: Letter['kind'], text: string, replies?: Letter['replies']) {
    const g = this.game, ws = g.ws;
    ws.letters.push({ id: Date.now() % 1e9 + Math.floor(Math.random() * 1000), from, day: g.day, text, kind, replies });
    if (ws.letters.length > 40) ws.letters.splice(0, ws.letters.length - 40);
    g.toast(`收到${BEAUTY_BY_ID[from]?.name ?? '某人'}的传音符${kind === 'sos' ? '——是求援！' : ''}（H 红颜录中查看）`, kind === 'sos' ? 'warn' : 'good');
    g.hint('letter', '红颜会给你寄传音符：闲话、托付、节日相邀，甚至求援。在红颜录（H）中查看并回复。');
  }
  private startReq(b: BeautyDef) {
    const g = this.game, s = this.hs(b.id), h = g.hero;
    const r = Math.random();
    let req: Req, text: string;
    if (r < 0.45) {
      const liked = b.likes.filter((id) => itemDef(id)?.type === 'herb');
      const pool = liked.length ? liked : ITEM_LIST.filter((it) => it.type === 'herb' && it.tier <= Math.max(1, h.realm)).map((it) => it.id);
      const id = pick(pool), minAge = [20, 40, 80, 150, 250, 400][clamp(h.realm, 0, 5)];
      req = { kind: 'herb', id, minAge, n: 1, until: g.day + 60 };
      text = `我近来炼一炉丹，缺一株${minAge}年以上的${itemDef(id).name}。你若有，下回见面带给我？\n\n（六十日内，带着${minAge}年以上的${itemDef(id).name}去见她）`;
    } else if (r < 0.75) {
      req = { kind: 'kill', n: 5 + h.realm * 2, k0: h.kills ?? 0, until: g.day + 45 };
      text = `近来妖兽猖獗，伤了好些凡人。我闭关走不开……你能替我斩除一些吗？\n\n（四十五日内斩杀 ${req.n} 头妖兽/敌人）`;
    } else {
      req = { kind: 'visit', until: g.day + 25 };
      text = `${b.id === 'dongxuaner' ? '你都多久没来看我了！' : b.id === 'nangongwan' ? '……许久未见。' : '好久没见你了。'}我在${locLabel(b.home) || '老地方'}等你。\n\n（二十五日内去见她）`;
    }
    (s.flags as any).req = req;
    this.send(b.id, 'req', text);
  }
  // ------------------------------------------------------------ 求援
  private startSos(b: BeautyDef) {
    const g = this.game, d = g.npcs.byId.get('b_' + b.id);
    if (!d || !d.alive || npcMap(d) !== ACTIVE_MAP) return;
    this.sosCd = g.time + 600;
    (g.ws.flags as any).sos = { id: b.id, x: d.x, y: d.y, until: g.day + 6 };
    const place = locLabel(b.home) || '附近';
    this.send(b.id, 'sos', HEART_LINES[b.id].sos.replace('{place}', place) + `\n\n（六日之内赶到——地图上已标出她的位置）`);
  }
  private sosFoes: Enemy[] = [];
  private sosStrike = 0;
  private sosTick(dt: number) {
    const g = this.game, f = g.ws.flags as any, sos = f.sos; if (!sos) return;
    const p = g.player, b = BEAUTY_BY_ID[sos.id]; if (!b) { delete f.sos; return; }
    const a = g.npcs.active.get('b_' + sos.id);
    if (a) { a.d.x = sos.x; a.d.y = sos.y; a.st.x = sos.x; a.st.y = sos.y; }
    if (!sos.spawned) {
      if (g.day > sos.until) { delete f.sos; this.fav(b.id, -10); this.send(b.id, 'chat', b.id === 'dongxuaner' ? '你没来……我差点死掉了！我再也不理你了！' : b.id === 'nangongwan' ? '……我已脱身。不必挂念。' : '……我自己逃出来了。你……是不是没收到传音符？'); return; }
      if (Math.hypot(sos.x - p.x, sos.y - p.y) < 1500) {
        sos.spawned = true; this.sosFoes = [];
        const realm = clamp(Math.max(g.hero.realm, b.realm - 1), 1, 5);
        for (let i = 0; i < 3 + (realm >= 3 ? 1 : 0); i++) {
          const an = (i / 3.5) * TAU; const def = realm >= 3 ? ENEMIES.jindan_mo ?? ENEMIES.moxiu : realm >= 2 ? ENEMIES.zhujixiu : ENEMIES.moxiu;
          const e = new Enemy(def, sos.x + Math.cos(an) * 220, sos.y + Math.sin(an) * 150, realm, rint(0, 4)); e.name = i === 0 ? '围攻的魔修头领' : '围攻的魔修'; e.aggro = true; if (i === 0) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.6); }
          g.combat.enemies.push(e); this.sosFoes.push(e);
        }
        g.toast(`${b.name}就在前面——被围住了！`, 'warn');
      }
      return;
    }
    const alive = this.sosFoes.filter((e) => !e.dead && g.combat.enemies.includes(e));
    this.sosStrike -= dt;
    if (alive.length && this.sosStrike <= 0 && Math.hypot(sos.x - p.x, sos.y - p.y) < 2500) {
      this.sosStrike = rand(1.2, 1.8);
      const t = alive.sort((x, y) => Math.hypot(x.x - sos.x, x.y - sos.y) - Math.hypot(y.x - sos.x, y.y - sos.y))[0];
      g.combat.allyStrike(sos.x, sos.y - 40, t, (g.combat as any).pStats?.atk ? (g.combat as any).pStats.atk * 0.8 : 20, b.color, b.realm);
    }
    if (!alive.length) {
      delete f.sos; this.fav(b.id, 15);
      g.news(`${b.name}遇险，韩立千里驰援。`, 'personal');
      g.openDialog({ speaker: b.name, portrait: b.portrait, look: b.look, title: '驰援', mood: 'love', text: `${HEART_LINES[b.id].saved}\n\n好感 +15`, options: [{ label: '没事就好', act: () => null }] });
    }
  }

  // ------------------------------------------------------------ 与她交谈时的额外选项
  onTalk(b: BeautyDef) {
    const g = this.game, s = this.hs(b.id), r = (s.flags as any).req as Req | undefined;
    if (r?.kind === 'visit') { delete (s.flags as any).req; this.fav(b.id, 8); g.toast(`${b.name}见到你，眼睛亮了一下。（好感 +8）`, 'good'); }
  }
  options(b: BeautyDef): DOpt[] {
    const g = this.game, s = this.hs(b.id), h = g.hero, out: DOpt[] = [];
    const head = { speaker: b.name, portrait: b.portrait, look: b.look };
    const L = HEART_LINES[b.id];
    // 信物
    for (let i = 0; i < 3; i++) if (s.favor >= KEEP_AT[i] && !(s.flags as any)['k' + KEEP_AT[i]]) {
      out.push({ label: '【她似乎有东西要给你】', tone: 'love', act: () => {
        (s.flags as any)['k' + KEEP_AT[i]] = true; C.addItem(h, KEEP[i], 1);
        return { ...head, title: '信物', mood: 'love', text: `${L.keep[i]}\n\n（获得 ${itemDef(KEEP[i]).name}${i === 2 ? '——随身带着它，她同行时的加成提升五成' : ''}）`, options: [{ label: '（郑重收下）', act: () => this.game.hearts.mainNode(b) }] } as DNode;
      } });
      break;
    }
    // 托付：交药
    const r = (s.flags as any).req as Req | undefined;
    if (r?.kind === 'herb' && r.id) {
      const have = C.bagCount(h, r.id, r.minAge ?? 0) > 0;
      out.push({ label: `交给她${itemDef(r.id).name}（${r.minAge}年以上）`, tone: 'love', disabled: !have, hint: have ? '' : '储物袋里没有够年份的', act: () => {
        C.removeItem(h, r.id!, 1, r.minAge ?? 0); delete (s.flags as any).req; this.fav(b.id, 10);
        const m: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * 0.06, m);
        const pill = ITEM_LIST.filter((it) => it.type === 'pill' && it.price > 0 && it.tier <= Math.max(1, h.realm + 1) && it.tier >= Math.max(0, h.realm - 1));
        const pp = pill.length ? pick(pill) : null; if (pp) C.addItem(h, pp.id, 2);
        return { ...head, mood: 'love', text: `（她接过灵药，仔细端详，眉眼舒展开来）${b.id === 'dongxuaner' ? '算你还记得！' : '……你真的找来了。'}\n\n几日后，她把炼成的丹药分了你一半。\n\n好感 +10　修为小涨${pp ? `　获得 ${pp.name}×2` : ''}`, options: [{ label: '……', act: () => this.game.hearts.mainNode(b) }] } as DNode;
      } });
    }
    // 节日
    const fest = (s.flags as any).fest as string | undefined; const doy = this.dayOfYear();
    const fe = FESTIVALS.find((x) => fest === `${doy.y}_${x.name}` && doy.m === x.m && Math.abs(doy.d - x.d) <= 3);
    if (fe) out.push({ label: `【共度${fe.name}】`, tone: 'love', act: () => { delete (s.flags as any).fest; this.fav(b.id, 12); g.passDays(1); return { ...head, title: fe.name, mood: 'love', text: `${fe.text}\n\n${pick(L.bubbles)}\n\n好感 +12`, options: [{ label: '（这一夜很长）', act: () => this.game.hearts.mainNode(b) }] } as DNode; } });
    // 约会
    const last = (s.flags as any).lastDate ?? -99;
    if (s.favor >= 25) out.push({ label: '约她同游', tone: 'love', disabled: g.day - last < 5, hint: g.day - last < 5 ? `前几日才一同出游过（${Math.ceil(5 - (g.day - last))} 日后）` : `共同回忆 ${Object.keys((s.flags as any).mem ?? {}).length}/8`, act: () => this.dateNode(b) });
    // 双修
    const atVein = g.home.atHome(g.player.x, g.player.y) || !!g.sites.veinAt(g.player.x, g.player.y, 300);
    if (s.flags.companion && s.favor >= 80) {
      const lastD = (s.flags as any).lastDual ?? -999;
      out.push({ label: '与她双修', tone: 'love', disabled: !atVein || g.day - lastD < 30, hint: !atVein ? '需在灵脉或洞府' : g.day - lastD < 30 ? '需调息一月' : '七日，修为大进', act: () => {
        (s.flags as any).lastDual = g.day; g.passDays(7);
        const m: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * 0.28, m); this.fav(b.id, 4);
        g.news(`韩立与${b.name}于灵脉之上双修七日。`, 'personal');
        return { ...head, title: '双修', mood: 'love', text: `灵脉之上，两道气息缓缓交融，周天运转，阴阳相济。七日如一瞬。\n\n${L.dual}\n\n修为大进　好感 +4`, options: [{ label: '……', act: () => this.game.hearts.mainNode(b) }] } as DNode;
      } });
    }
    return out;
  }
  /** 当下情境可约的去处 */
  scenes(): DateScene[] {
    const g = this.game, p = g.player, T = g.terrain, out: DateScene[] = ['tea'];
    if (g.night > 0.5) out.push('moon');
    const w = g.weather.kind;
    if (w === 'rain' || w === 'storm') out.push('rain');
    if (w === 'snow' || T.sample(p.x, p.y).cold > 0.55) out.push('snow');
    if (g.season === 0 || T.sample(p.x, p.y).forest > 0.45) out.push('flowers');
    const loc = g.nearbyLocation(); if (loc && (loc.type === 'city' || loc.type === 'town')) out.push('town');
    if (T.sample(p.x, p.y).elev > 0.42 || g.hero.realm >= 2) out.push('peak');
    for (const [dx, dy] of [[900, 0], [-900, 0], [0, 900], [0, -900]]) if (!T.isLand(p.x + dx, p.y + dy)) { out.push('sea'); break; }
    return out;
  }
  private dateNode(b: BeautyDef): DNode {
    const head = { speaker: b.name, portrait: b.portrait, look: b.look };
    const s = this.hs(b.id), mem = ((s.flags as any).mem ??= {}) as Record<string, number>;
    const opts: DOpt[] = this.scenes().map((sc) => ({ label: `【${DATE_NAME[sc]}】${mem[sc] ? '' : ' · 新'}`, tone: mem[sc] ? undefined : 'love', act: () => this.dateScene(b, sc) } as DOpt));
    opts.push({ label: '改日吧', act: () => this.game.hearts.mainNode(b) });
    return { ...head, title: '同游', mood: 'love', text: '（她歪头看你）去哪里？\n\n（去处随此刻的时辰、天气、地形而定——月夜、雨天、雪地、海边、山巅、集市……换个时候来，会有不同的去处）', options: opts };
  }
  private dateScene(b: BeautyDef, sc: DateScene): DNode {
    const g = this.game, s = this.hs(b.id), L = HEART_LINES[b.id];
    const head = { speaker: b.name, portrait: b.portrait, look: b.look };
    const mem = ((s.flags as any).mem ??= {}) as Record<string, number>;
    const line = L.date[sc] ?? pick(L.bubbles);
    return { ...head, title: DATE_NAME[sc], mood: 'love', text: `${DATE_TEXT[sc]}\n\n${line}`, options: DATE_CHOICES.map((c, i) => ({ label: c, act: () => {
      (s.flags as any).lastDate = g.day; g.passDays(1);
      const first = !mem[sc]; mem[sc] = Math.floor(g.day);
      const gain = (i === L.prefer ? 8 : 4) + (first ? 3 : 0);
      this.fav(b.id, gain);
      const all = Object.keys(mem).length >= 8 && !(s.flags as any).memAll;
      if (all) { (s.flags as any).memAll = true; g.hero.lifeBonus += 5; }
      const rep = i === L.prefer ? pick(['（她怔了怔，随即笑了，那笑意一直漾到眼底）', '（她没有说话，只是轻轻握住了你的手）', '（她的脸微微红了）']) : pick(['（她笑了笑）', '（她点点头）', '（她看了你一眼，又看向远处）']);
      return { ...head, title: DATE_NAME[sc], mood: 'love', text: `${rep}\n\n好感 +${gain}${first ? `　（新的共同回忆：${DATE_NAME[sc]}，${Object.keys(mem).length}/8）` : ''}${all ? '\n\n八种回忆都已集齐。往后漫长的岁月里，总有这些日子可以想起。（寿元 +5）' : ''}`, options: [{ label: '（送她回去）', act: () => this.game.hearts.mainNode(b) }] } as DNode;
    } } as DOpt)) };
  }

  // ------------------------------------------------------------ 传音符
  letterNode(l: Letter): DNode {
    const g = this.game, b = BEAUTY_BY_ID[l.from];
    l.read = true;
    const head = { speaker: b?.name ?? '传音符', portrait: b?.portrait, look: b?.look };
    const opts: DOpt[] = [];
    if (l.replies && !l.replied) for (const r of l.replies) opts.push({ label: r.label, tone: r.favor > 0 ? 'love' : r.favor < 0 ? 'bad' : undefined, act: () => { l.replied = true; if (b) this.fav(b.id, r.favor); return { ...head, title: '回信', text: (r.reply || '（你没有回）') + (r.favor ? `\n\n好感 ${r.favor > 0 ? '+' : ''}${r.favor}` : ''), options: [{ label: '收起传音符', act: () => null }] } as DNode; } });
    if (l.kind === 'sos' && (g.ws.flags as any).sos?.id === l.from) { const sos = (g.ws.flags as any).sos; const p = g.player; opts.push({ label: `立刻赶去（${dirName(sos.x - p.x, sos.y - p.y)}方约 ${Math.max(1, Math.round(Math.hypot(sos.x - p.x, sos.y - p.y) / 260))} 里）`, tone: 'love', act: () => { g.setDestination(sos.x, sos.y); return null; } }); }
    opts.push({ label: '收起', act: () => null });
    return { ...head, title: `传音符 · 第${Math.floor(l.day / 360) + 1}年${Math.floor((l.day % 360) / 30) + 1}月`, mood: l.kind === 'sos' ? 'danger' : 'love', text: l.text, options: opts };
  }
  /** 地图标记 */
  marks() { const sos = (this.game.ws.flags as any).sos; if (!sos) return []; return [{ x: sos.x, y: sos.y, glyph: '援', color: '#ff7aa0', name: `${BEAUTY_BY_ID[sos.id]?.name}遇险` }]; }
  /** 在她面前给别人送礼 / 换人同行 */
  onGift(to: string) {
    const f = this.game.hearts.follower(); if (!f || f.id === to) return;
    this.fav(f.id, -3); this.bubble = { id: f.id, text: pick(['……哼。', '（她别过脸去）', '送得倒是挺大方。']), t: 3.5 };
  }
  onSwitch(fromId: string) { const s = this.hs(fromId); if (s.favor >= 45) (s.flags as any).jealousUntil = this.game.day + 40; }
  keepBonus(id: string) { return (this.hs(id).flags as any).k80 && C.bagCount(this.game.hero, 'gift_sachet') > 0 ? 1.5 : 1; }

  // ------------------------------------------------------------ 同行闲话
  private bubbleTick(dt: number) {
    const g = this.game;
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    const f = g.hearts.follower(); if (!f) return;
    this.bubT -= dt; if (this.bubT > 0) return;
    this.bubT = rand(25, 60);
    const L = HEART_LINES[f.id]; if (!L) return;
    const p = g.player, w = g.weather.kind;
    const ctx: string[] = [];
    if (g.hero.hp < 0.4) ctx.push('hurt');
    if (g.combat.inCombat) ctx.push('fight');
    if (w === 'rain' || w === 'storm') ctx.push('rain');
    if (w === 'snow') ctx.push('snow');
    if (g.night > 0.6) ctx.push('night');
    if (p.flying) ctx.push('fly');
    let text: string;
    if (ctx.length && Math.random() < 0.6) { const c = CONTEXT_BUBBLES.find((x) => x.when === ctx[0]); text = c ? pick(c.lines) : pick(L.bubbles); }
    else text = pick(L.bubbles);
    this.bubble = { id: f.id, text, t: 4.5 };
  }
  collect(out: { y: number; draw: (g: G) => void }[]) {
    const g = this.game, bb = this.bubble; if (!bb) return;
    const a = g.npcs.active.get('b_' + bb.id); if (!a) return;
    const x = a.st.x, y = a.st.y - (a.st.lift ?? 0);
    out.push({ y: y + 3, draw: (ctx) => {
      const al = clamp(bb.t * 2, 0, 1) * clamp((4.5 - bb.t) * 4, 0, 1);
      const z = g.cam.zoom, fs = Math.max(13, 15 / Math.max(0.5, z));
      ctx.save(); ctx.globalAlpha *= al; ctx.font = `${fs}px "Noto Serif SC",serif`;
      const w = ctx.measureText(bb.text).width + fs * 1.2, hgt = fs * 1.9, bx = x - w / 2, by = y - 230 - hgt;
      ctx.fillStyle = 'rgba(252,246,236,0.94)'; ctx.strokeStyle = 'rgba(120,90,70,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); const r = hgt / 2; ctx.moveTo(bx + r, by); ctx.lineTo(bx + w - r, by); ctx.arc(bx + w - r, by + r, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x + 8, by + hgt); ctx.lineTo(x, by + hgt + 10); ctx.lineTo(x - 4, by + hgt); ctx.lineTo(bx + r, by + hgt); ctx.arc(bx + r, by + r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a3428'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bb.text, x, by + hgt / 2 + 1);
      ctx.restore();
    } });
  }
}
