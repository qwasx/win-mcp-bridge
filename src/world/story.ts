// 第十步：主线 —— 序章「七玄门」与第二章「嘉元城 · 太南」
// 原著前期剧情做成可引导的任务链：神手谷 → 溪谷小瓶（掌天瓶）→ 星光凝露 → 厉飞雨 → 墨大夫夺舍 → 野狼帮与金光上人（升仙令）
// → 嘉元城墨府（暖阳宝玉 / 欧阳飞天）→ 太南小会 → 持升仙令入黄枫谷。之后完全自由。
// 关键节点都有选择：可以帮/不帮厉飞雨、可以赴约/不赴约、可以婉拒/接受墨府的婚约，走向不同但都能继续。
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import type { FxSys } from '../gl/fx';
import { LOC_BY_ID, LOCATIONS, WORLD_SCALE , ACTIVE_MAP } from '../data/world';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { ARTS } from '../data/arts';
import { CharState, drawCharacter, Look } from '../gfx/character';
import { MO_LOOK, LI_LOOK, QUHUN_LOOK, JINGUANG_LOOK, JIA_LOOK, OUYANG_LOOK, YAN_LOOK, WAN_LOOK } from '../data/storylooks';
import { audio } from './audio';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface StoryState { step: string; f: Record<string, any> }
interface Actor { id: string; name: string; title: string; look?: Look; st?: CharState; x: number; y: number; prop?: 'bottle' | 'hut' | 'manor' | 'stall'; quest?: boolean; bubble?: string; hidden?: boolean }
interface FoeSpec { def: string; name?: string; realm: number; stage: number; hp?: number; atk?: number; look?: Look; boss?: boolean; tag?: string; height?: number }
interface Wave { foes: FoeSpec[]; intro?: string; introSpeaker?: string; introLook?: Look }
interface Fight { waves: Wave[]; wi: number; foes: Enemy[]; cx: number; cy: number; mind: boolean; onWin: () => void; retry: () => void; specials: Map<Enemy, { t: number; tag: string; pend?: { x: number; y: number; t: number } }> }

const CH_NAME: Record<number, string> = { 1: '序章 · 七玄门', 2: '第一章 · 嘉元城', 3: '人界 · 自由' };

export class Story {
  game: Game;
  actors: Actor[] = [];
  focus: Actor | null = null;
  fight: Fight | null = null;
  cine: { kind: 'stars'; t: number; dur: number } | null = null;
  mind = 0;
  private A: Record<string, { x: number; y: number }> = {};
  private timers: { t: number; fn: () => void }[] = [];
  private introT = -1;

  constructor(game: Game) { this.game = game; }

  get S(): StoryState {
    const fl = this.game.ws.flags;
    if (!fl.story) fl.story = { step: 'free', f: {} };
    return fl.story as StoryState;
  }
  get active() { return this.S.step !== 'free'; }
  get chapter() { const s = this.S.step; return s.startsWith('c1') ? 1 : s.startsWith('c2') ? 2 : 3; }

  // ------------------------------------------------------------ 开局 / 读档
  /** 新开一局：不再有序章 —— 韩立已持升仙令入黄枫谷，炼气五层，身怀掌天瓶 */
  start() {
    this.game.ws.flags.story = { step: 'free', f: { opening: 'huangfeng' } } as StoryState;
    this.fight = null; this.cine = null; this.mind = 0; this.timers = []; this.actors = []; this.introT = -1;
    this.canonBackstory();
    this.openT = 1.0;
  }
  /** 七玄门往事按原著已经发生：墨大夫夺舍不成身死；厉飞雨仍在七玄门 */
  private canonBackstory() {
    this.hideCanon(false);
    const d = this.game.npcs.byId.get('modaifu') as any;
    if (d) { d.alive = false; d.deathNote = '夺舍韩立不成，身死神手谷'; this.game.npcs.active.delete('modaifu'); }
  }
  private openT = -1;
  private opening() {
    const g = this.game;
    this.say(this.N('黄枫谷', '越国，太岳山脉。\n\n云雾在脚下翻涌，山门上“黄枫谷”三个大字被岁月磨得发亮。漫山枫叶正黄。\n\n你叫韩立，伪灵根，炼气五层。\n七玄门的六年像一场梦——墨大夫夺舍不成，死在神手谷；金光上人死在你手里，留下一块升仙令。那块令牌，刚刚被执事收走，换来了你名册上的一行字：外门弟子。\n\n怀里，那只来历不明的小瓶微微发烫。瓶底，一滴碧绿的液体静静躺着。\n\n没有人多看你一眼。这样正好。', [
      this.O('踏入山门', () => this.N('黄枫谷', '从今往后，路由你自己走：\n· 宗门（靠近山门按 G）：领俸禄、接任务、换取贡献；\n· 掌天瓶：每七日凝一滴绿液，可把凡药催成百年灵药；\n· 两年后的血色禁地，是筑基丹主药的唯一来源；\n· 越国之外，还有天南诸国、乱星海、大晋……\n\n活下去。然后，走得更远。', [this.O('好', undefined, { tone: 'gold' })], { mood: 'mystic' }), { tone: 'gold' }),
    ], { mood: 'mystic' }));
    g.hint('opening', '提示：1–9 施法，罗烟步闪身、御风诀赶路；Q 神识外放，Z 打坐，M 地图。');
  }
  resume() {
    this.fight = null; this.cine = null; this.mind = 0; this.timers = []; this.introT = -1;
    // 旧存档若停在序章 / 第一章中途：剧情直接结束，转为自由（序章不再出现）
    if (this.active) {
      const h = this.game.hero;
      h.bottle.owned = true; h.bottle.drops = Math.max(1, h.bottle.drops);
      if (C.bagCount(h, 'item_bottle') <= 0) C.addItem(h, 'item_bottle', 1);
      this.S.step = 'free';
      this.canonBackstory();
      this.game.toast('旧存档的序章剧情已结束，转为自由闯荡。', 'good');
    }
    if (!this.active) { this.actors = []; return; }
    this.anchors();
    if (this.chapter === 1) this.hideCanon(true);
    this.enter(this.S.step, true);
  }
  private hideCanon(h: boolean) {
    const n = this.game.npcs;
    for (const id of ['modaifu', 'lifeiyu']) { const d = n.byId.get(id) as any; if (d) { d.hidden = h; if (h) n.active.delete(id); } }
  }

  // ------------------------------------------------------------ 地点锚
  private spot(x: number, y: number, pad = 60, maxR = 2400, road = 0) {
    const T = this.game.terrain;
    for (let r = 0; r <= maxR; r += 50) {
      const n = r === 0 ? 1 : Math.max(8, Math.round(r / 40));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r * 0.013;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.75;
        if (T.walkFactor(px, py) > 0 && !T.inLocZone(px, py, pad) && !T.nearRiver(px, py) && (!road || (!T.nearRoad(px, py, road) && !T.nearRoad(px + 150, py - 80, road)))) return { x: px, y: py };
      }
    }
    return { x, y };
  }
  private zone(id: string) { const i = LOCATIONS.findIndex((l) => l.id === id); return this.game.terrain.locZones[i] ?? { x: (LOC_BY_ID.get(id)?.x ?? 0) * WORLD_SCALE, y: (LOC_BY_ID.get(id)?.y ?? 0) * WORLD_SCALE, rx: 300, ry: 220, id }; }
  private anchors() {
    const g = this.game, T = g.terrain;
    const q = this.zone('qixuan');
    this.A.valley = this.spot(q.x + q.rx + 1100, q.y + q.ry * 0.6 + 500, 80, 2400, 260);
    this.A.train = this.spot(q.x - q.rx * 0.4, q.y + q.ry + 260, 60);
    this.A.gate = this.spot(q.x + 200, q.y + q.ry + 700, 420);
    // 溪谷：神手谷附近最近的河道，取岸边可走的一点
    let best: { x: number; y: number } | null = null, bd = 1e12;
    const v = this.A.valley;
    for (let dy = -4200; dy <= 4200; dy += 70) for (let dx = -4200; dx <= 4200; dx += 70) {
      const x = v.x + dx, y = v.y + dy;
      if (!T.nearRiver(x, y)) continue;
      const d = dx * dx + dy * dy; if (d < bd && d > 1300 * 1300) { bd = d; best = { x, y }; }
    }
    let okBank = false;
    if (best) {
      const L = Math.sqrt(bd), ux = (v.x - best.x) / L, uy = (v.y - best.y) / L;
      let bx = best.x, by = best.y;
      for (let k = 0; k < 60 && (T.walkFactor(bx, by) <= 0 || T.nearRiver(bx, by)); k++) { bx += ux * 15; by += uy * 15; }
      if (Math.hypot(bx - best.x, by - best.y) < 700) { this.A.creek = { x: bx, y: by }; this.A.water = best; okBank = true; }
    }
    if (okBank) { /* ok */ } else { this.A.creek = this.spot(v.x + 1500, v.y + 900, 80); this.A.water = { x: this.A.creek.x + 60, y: this.A.creek.y + 30 }; }
    const j = this.zone('jiayuan');
    this.A.mofu = this.spot(j.x + j.rx * 0.25, j.y + j.ry + 160, 20, 2400, 90);
    this.A.duba = this.spot(j.x - j.rx - 1500, j.y + j.ry + 900, 450, 2400, 200);
    const t = this.zone('tainan');
    this.A.tainan = this.spot(t.x, t.y + t.ry + 160, 20);
    const h = this.zone('huangfeng');
    this.A.huangfeng = { x: h.x, y: h.y + h.ry * 0.6 };
  }

  // ------------------------------------------------------------ 演员
  private actor(id: string, name: string, title: string, look: Look | undefined, at: { x: number; y: number }, o: Partial<Actor> = {}) {
    const st = look ? new CharState(at.x, at.y) : undefined;
    if (st) st.faceToward(0, 1, true);
    const a: Actor = { id, name, title, look, st, x: at.x, y: at.y, ...o };
    this.actors = this.actors.filter((x) => x.id !== id);
    this.actors.push(a);
    return a;
  }
  private drop(id: string) { this.actors = this.actors.filter((x) => x.id !== id); }
  private get f() { return this.S.f; }

  private go(step: string) { this.S.step = step; this.enter(step); this.game.updateUI(true); }

  /** 进入某一步：布置演员（读档时 resume=true，不重复发放奖励） */
  private enter(step: string, _resume = false) {
    const A = this.A;
    this.actors = [];
    const hut = () => this.actor('hut', '神手谷', '墨大夫的药庐', undefined, { x: A.valley.x + 150, y: A.valley.y - 70 }, { prop: 'hut' });
    const mo = (quest = true) => { hut(); return this.actor('mo', '墨大夫', '七玄门神手谷', MO_LOOK, A.valley, { quest }); };
    switch (step) {
      case 'c1_intro': mo(false); break;
      case 'c1_mo1': mo(); break;
      case 'c1_herb': mo(false); break;
      case 'c1_bottle': mo(false); this.actor('bottle', '溪水中的微光', '', undefined, A.creek, { prop: 'bottle', quest: true }); break;
      case 'c1_herb2': mo(this.f.herbs >= 3); break;
      case 'c1_night': mo(false); break;
      case 'c1_ripen': mo(false); break;
      case 'c1_li': mo(false); this.actor('li', '厉飞雨', '七玄门七绝堂', LI_LOOK, A.train, { quest: true, bubble: '咳……咳咳……' }); break;
      case 'c1_mo2': mo(); if (this.f.li === 'friend') this.actor('li', '厉飞雨', '七玄门七绝堂', LI_LOOK, A.train); break;
      case 'c1_mo3': mo(false); this.actor('quhun_s', '黑布下的药人', '', QUHUN_LOOK, { x: A.valley.x + 70, y: A.valley.y - 20 }); break;
      case 'c1_wait': hut(); if (this.f.li === 'friend') this.actor('li', '厉飞雨', '七玄门七绝堂', LI_LOOK, A.train, { quest: !this.f.liTalk2 }); break;
      case 'c1_wolf': hut(); break;
      case 'c2_mofu': this.actor('yan', '严氏', '墨府四夫人', YAN_LOOK, A.mofu, { quest: true }); break;
      case 'c2_duba': this.actor('yan', '严氏', '墨府四夫人', YAN_LOOK, A.mofu); this.actor('manor', '独霸山庄', '', undefined, { x: A.duba.x, y: A.duba.y - 160 }, { prop: 'manor' }); break;
      case 'c2_back': this.actor('yan', '严氏', '墨府四夫人', YAN_LOOK, A.mofu, { quest: true }); break;
      case 'c2_tainan': this.actor('wan', '万小山', '太南小会 · 散修少年', WAN_LOOK, A.tainan, { quest: true }); this.actor('stall', '', '', undefined, { x: A.tainan.x + 120, y: A.tainan.y - 10 }, { prop: 'stall' }); break;
      case 'c2_huangfeng': break;
    }
  }

  // ------------------------------------------------------------ 目标与追踪
  goal(): { title: string; text: string; tx?: number; ty?: number } | null {
    const s = this.S.step, A = this.A, f = this.f, g = this.game;
    switch (s) {
      case 'c1_intro': case 'c1_mo1': return { title: '神手谷', text: '前往神手谷，拜见墨大夫', tx: A.valley.x, ty: A.valley.y };
      case 'c1_herb': return { title: '后山溪谷', text: `去后山溪谷采药（E 采集灵草 ${Math.min(3, f.herbs)}/3）`, tx: A.creek.x, ty: A.creek.y };
      case 'c1_bottle': return { title: '溪水中的微光', text: '溪边有什么东西在闪光——走近按 T 查看', tx: A.creek.x, ty: A.creek.y };
      case 'c1_herb2': return f.herbs >= 3 ? { title: '复命', text: '灵草已够，回神手谷复命', tx: A.valley.x, ty: A.valley.y } : { title: '采药', text: `继续采集灵草（E）${f.herbs}/3`, tx: A.creek.x, ty: A.creek.y };
      case 'c1_night': return { title: '夜观小瓶', text: g.night > 0.55 ? '夜深了……留意怀中的小瓶' : '等到夜里，看看那只小瓶（按 Z 打坐，光阴流转更快）' };
      case 'c1_ripen': return { title: '绿液', text: '打开储物袋（B），选中黄精，用掌天瓶催熟' };
      case 'c1_li': return { title: '七绝堂少年', text: '回七玄门。练武场边，有人在咳血', tx: A.train.x, ty: A.train.y };
      case 'c1_mo2': return { title: '药庐', text: '墨大夫差人传话：速回神手谷', tx: A.valley.x, ty: A.valley.y };
      case 'c1_mo3': return { title: '子时之约', text: g.night > 0.6 ? '子时已到。去，还是不去？' : '入夜后（子时）前往墨大夫的药庐——或者干脆不去', tx: A.valley.x, ty: A.valley.y };
      case 'c1_wait': { const left = Math.max(0, Math.ceil((f.waitUntil ?? 0) - g.day)); return { title: '风声', text: left > 0 ? `在七玄门一带修炼（打坐/闭关），静待时机——野狼帮的探子已在山下出没（约 ${left} 日）` : '野狼帮来了！', tx: f.li === 'friend' && !f.liTalk2 ? A.train.x : undefined, ty: f.li === 'friend' && !f.liTalk2 ? A.train.y : undefined }; }
      case 'c1_wolf': return { title: '山门血战', text: this.fight ? '击退野狼帮！' : '赶往七玄门山门，迎击野狼帮', tx: A.gate.x, ty: A.gate.y };
      case 'c2_mofu': return { title: '墨府', text: '前往嘉元城墨府，送还墨大夫遗书', tx: A.mofu.x, ty: A.mofu.y };
      case 'c2_duba': return { title: '独霸山庄', text: this.fight ? '取欧阳飞天项上人头' : '前往嘉元城外的独霸山庄', tx: A.duba.x, ty: A.duba.y };
      case 'c2_back': return { title: '暖阳宝玉', text: '回墨府，向严氏复命', tx: A.mofu.x, ty: A.mofu.y };
      case 'c2_tainan': return { title: '太南小会', text: '前往太南山，打听升仙令的用处', tx: A.tainan.x, ty: A.tainan.y };
      case 'c2_huangfeng': return { title: '黄枫谷', text: '持升仙令前往黄枫谷拜入山门（进入宗门按 G）', tx: A.huangfeng.x, ty: A.huangfeng.y };
    }
    return null;
  }
  tracker() {
    if (ACTIVE_MAP !== 'tiannan') return null;
    if (!this.active) return null;
    const gl = this.goal(); if (!gl) return null;
    const p = this.game.player;
    const out: { ch: string; title: string; text: string; ang?: number; dist?: number; tx?: number; ty?: number } = { ch: CH_NAME[this.chapter], title: gl.title, text: gl.text };
    if (gl.tx !== undefined && gl.ty !== undefined) { out.tx = gl.tx; out.ty = gl.ty; out.ang = Math.atan2(gl.ty - p.y, gl.tx - p.x); out.dist = Math.hypot(gl.tx - p.x, gl.ty - p.y); }
    return out;
  }
  /** 宏观坐标（小地图标记） */
  marker() { const t = this.tracker(); return t && t.tx !== undefined ? { x: t.tx / WORLD_SCALE, y: t.ty! / WORLD_SCALE } : null; }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game;
    if (ACTIVE_MAP !== 'tiannan') return;   // 引导剧情只在天南
    if (this.openT > 0 && !g.paused && !g.modal) { this.openT -= dt; if (this.openT <= 0) this.opening(); }
    if (!this.active || g.hero.dead) return;
    const p = g.player, f = this.f, A = this.A;
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0); this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();
    if (g.paused) return;
    if (this.introT > 0) { this.introT -= dt; if (this.introT <= 0 && this.S.step === 'c1_intro') this.intro(); }
    this.mind += ((this.fight?.mind ? 1 : 0) - this.mind) * Math.min(1, dt * 2);
    // 焦点
    this.focus = null; let fd = 150;
    for (const a of this.actors) {
      if (a.prop === 'hut' || a.prop === 'manor' || a.prop === 'stall' || a.hidden) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < fd) { fd = d; this.focus = a; }
      if (a.st && d < 500) a.st.faceToward(p.x - a.x, p.y - a.y, false);
    }
    if (this.fight) this.fightTick(dt);
    if (this.cine) { this.cine.t += dt; this.starFx(); if (this.cine.t >= this.cine.dur) { this.cine = null; this.starsDone(); } }
    const near = (k: string, r: number) => Math.hypot(A[k].x - p.x, A[k].y - p.y) < r;
    switch (this.S.step) {
      case 'c1_herb': if (near('creek', 520)) this.go('c1_bottle'); break;
      case 'c1_night': if (g.night > 0.62 && !this.cine && !g.isFlying) { this.cine = { kind: 'stars', t: 0, dur: 6.5 }; g.toast('怀里的小瓶忽然微微发烫……', 'good'); audio.sfx('chime'); } break;
      case 'c1_mo3':
        if (g.night > 0.6 && near('valley', 320) && !f.moMet) { f.moMet = true; this.moNight(); }
        else if (!f.moMet && g.day > (f.moDay ?? 0) + 2.6 && g.night > 0.6 && !g.isFlying) { f.moMet = true; this.moHunt(); }
        break;
      case 'c1_wait': if (g.day >= (f.waitUntil ?? 0)) this.go('c1_wolf'); break;
      case 'c1_wolf': if (!this.fight && near('gate', 700)) this.wolfFight(); break;
      case 'c2_duba': if (!this.fight && near('duba', 650)) this.dubaFight(); break;
      case 'c2_huangfeng':
        if (g.ws.sect) this.finale(g.ws.sect.id);
        break;
    }
    // 寒毒（直到暖阳宝玉）
    if (f.handu && !f.cured) { f.hdT = (f.hdT ?? g.day + 20); if (g.day > f.hdT) { f.hdT = g.day + 25 + Math.random() * 20; g.toast('寒毒发作，你打了个寒战，指尖泛起一层青白。（墨府的暖阳宝玉可解）', 'warn'); } }
  }

  // ------------------------------------------------------------ 剧情对白
  private N(speaker: string, text: string, options: DOpt[], o: Partial<DNode> = {}): DNode { return { speaker, text, options, ...o }; }
  private O(label: string, act?: () => DNode | null | void, o: Partial<DOpt> = {}): DOpt { return { label, act, ...o }; }
  private say(n: DNode) { this.game.openDialog(n); }
  private reward(lines: string[]) { return lines.length ? `\n\n【${lines.join('　')}】` : ''; }
  private learn(id: string) { const h = this.game.hero; if (!h.arts.some((a) => a.id === id)) { h.arts.push({ id, xp: 0 }); const k = h.hotbar.findIndex((x) => !x); if (k >= 0) h.hotbar[k] = id; } return `习得：${ARTS[id].name}`; }
  private give(id: string, n = 1, age?: number) { C.addItem(this.game.hero, id, n, age); return `${itemDef(id).name}${n > 1 ? ' ×' + n : ''}`; }

  private intro() {
    const g = this.game;
    this.say(this.N('序章', '越国镜州，彩霞山。\n\n你叫韩立，是个山村穷小子。十岁那年，三叔托关系把你送进了江湖门派七玄门。你根骨平平，只做了个记名弟子，却被神手谷的墨大夫收在身边，传了一门古怪的口诀——《长春功》。\n\n六年过去，口诀练到了第六层。你隐约觉察到，体内多了一丝若有若无的“气”。\n\n今日一早，墨大夫差人唤你过去。', [
      this.O('前往神手谷', () => { this.go('c1_mo1'); return null; }, { tone: 'gold' }),
      this.O('跳过序章，直接自由闯荡', () => this.skipNode(), { hint: '直接获得掌天瓶，不经历七玄门剧情' }),
    ], { mood: 'mystic' }));
    g.hint('story', '提示：左上角的卷轴是当前主线目标，点击它可自动前往。');
  }
  private skipNode(): DNode {
    return this.N('序章', '确定跳过七玄门剧情？\n\n你将直接拥有掌天瓶（含一滴绿液），墨大夫、厉飞雨照常生活在人界中，升仙令需在升仙大会上自行争取。', [
      this.O('确定，自由闯荡', () => { this.skipAll(); return null; }, { tone: 'bad' }),
      this.O('还是跟着剧情走', () => { this.go('c1_mo1'); return null; }),
    ]);
  }
  private skipAll() {
    const h = this.game.hero;
    h.bottle.owned = true; h.bottle.drops = Math.max(1, h.bottle.drops);
    if (C.bagCount(h, 'item_bottle') <= 0) C.addItem(h, 'item_bottle', 1);
    this.hideCanon(false);
    this.S.step = 'free'; this.actors = [];
    this.game.toast('序章已跳过。人界之大，任你行走。', 'good');
    this.game.updateUI(true);
  }

  interact(a: Actor) {
    const g = this.game, h = g.hero, f = this.f, s = this.S.step;
    if (a.id === 'mo') {
      if (s === 'c1_intro' || s === 'c1_mo1') return this.say(this.N('墨大夫', '（药庐里弥漫着苦涩的药香。墨大夫枯瘦的手指搭上你的腕脉，良久，嘴角浮起一丝说不清的笑意）\n\n「第六层了……好，很好。立儿，你果然没让为师失望。」', [
        this.O('「师父，这长春功到底是什么功夫？」', () => this.N('墨大夫', '「强身健体的养生功罢了。」\n\n（他的眼神冷了一瞬，又很快恢复了和蔼）\n\n「问那么多做什么？好好练就是。」', [this.O('「……弟子知道了。」', () => this.moTask())], { title: '七玄门神手谷', look: MO_LOOK })),
        this.O('「弟子日日不敢懈怠。」', () => this.moTask()),
      ], { title: '七玄门神手谷', look: MO_LOOK }));
      if (s === 'c1_herb2' && f.herbs >= 3) return this.say(this.N('墨大夫', '「不错，都是好药。」\n\n（他接过灵草，余光却在你怀里停了一停）\n\n「你怀里揣着什么？」', [
        this.O('（不动声色）「一块压衣角的石头。」', () => { f.showed = false; return this.N('墨大夫', '「……哼。」\n\n（他没再追问，摆摆手）「去吧。夜里莫要乱跑。」', [this.O('告退', () => { this.go('c1_night'); return null; })], { look: MO_LOOK }); }),
        this.O('把小瓶拿给他看', () => { f.showed = true; return this.N('墨大夫', '（墨大夫翻来覆去看了半晌，拔不开，砸不碎，又用银针探了探，终于失了兴趣，随手丢还给你）\n\n「破瓶子，拿去玩吧。」\n\n（你接住小瓶，心里却松了口气——连师父也看不出门道。）', [this.O('告退', () => { this.go('c1_night'); return null; })], { look: MO_LOOK }); }),
      ], { title: '七玄门神手谷', look: MO_LOOK }));
      if (s === 'c1_mo2') return this.say(this.N('墨大夫', '（药庐里点着浓重的药香，墨大夫的脸色比上次更差，指尖隐隐发黑）\n\n「立儿，为师中了一种奇毒，怕是命不久矣……今夜子时，你来我房中。为师有一桩天大的机缘，要传给你。」\n\n你注意到，墙角那具总被黑布盖着的“药人”，不知何时换了个姿势。黑布下露出的一只手，指节粗大——像极了两年前失踪的师兄张铁。', [
        this.O('「弟子……遵命。」', () => { f.moDay = g.day; this.go('c1_mo3'); return null; }),
        this.O('（心生警兆，面上不露）「师父保重身体。」', () => { f.moDay = g.day; f.wary = true; this.go('c1_mo3'); return null; }),
      ], { title: '七玄门神手谷', look: MO_LOOK, mood: 'danger' }));
      return this.say(this.N('墨大夫', ['「去吧，莫要偷懒。」', '「长春功切不可中断。」', '（墨大夫闭目调息，没有理你）'][Math.floor(Math.random() * 3)], [this.O('离开')], { title: '七玄门神手谷', look: MO_LOOK }));
    }
    if (a.id === 'bottle') {
      return this.say(this.N('溪谷', '溪水里卡着一只巴掌大的小瓶，通体墨绿，瓶身刻满细密的叶纹，在水底泛着微光。\n\n你伸手去捞，入手冰凉。试着拔塞子，纹丝不动；往石头上一磕——石头裂了道缝，瓶子毫发无伤。', [
        this.O('收入怀中', () => {
          h.bottle.owned = true; h.bottle.drops = 0; h.bottle.charge = 0;
          C.addItem(h, 'item_bottle', 1);
          this.drop('bottle');
          const F = g.renderer?.fx; if (F) { F.flash(a.x, a.y - 20, 60, [0.5, 1, 0.6]); F.sparks(a.x, a.y - 20, [0.6, 1, 0.7], 30, 260); }
          g.renderer?.burst(a.x, a.y - 20, '#a8ffb8', 40);
          audio.sfx('chime'); g.trauma = Math.min(1, g.trauma + 0.15);
          this.go('c1_herb2');
          return this.N('溪谷', '你把小瓶揣进怀里。说不清为什么，它贴着胸口的地方，有一点点暖。\n\n【获得：神秘小瓶】', [this.O('继续采药')], { mood: 'mystic' });
        }, { tone: 'gold' }),
      ], { mood: 'mystic' }));
    }
    if (a.id === 'li') {
      if (s === 'c1_li') return this.say(this.N('厉飞雨', '一个面色苍白的少年扶着树干，嘴角挂着血丝。他认出你是神手谷的人，眼神一下子警惕起来：\n\n「你……你都看见了？」\n\n他袖口滚出一枚暗红的药丸——抽髓丸。这是一种能短时间激发潜力、却会一点点吸干寿元的虎狼之药。七绝堂的比试近在眼前，他想出人头地。', [
        this.O('替他保密，再配一副缓解痛苦的药', () => {
          if (C.bagCount(h, 'pill_liaoshang') > 0) C.removeItem(h, 'pill_liaoshang', 1);
          f.li = 'friend'; this.hideCanon(true);
          const r = [this.learn('zhayan')];
          this.go('c1_mo2');
          return this.N('厉飞雨', '（他愣了半晌，才接过药包，声音有些发哑）\n\n「韩……韩师兄。这份情，我厉飞雨记一辈子。」\n\n（他从怀里摸出一本卷了边的剑谱塞给你）「《眨眼剑法》，快到邪门，我练不成。你身法好，兴许用得上。」' + this.reward(r), [this.O('收下')], { title: '七玄门七绝堂', look: LI_LOOK, mood: 'love' });
        }, { tone: 'good', hint: C.bagCount(h, 'pill_liaoshang') > 0 ? '消耗疗伤丹 ×1' : '你没有疗伤丹，只能凭医术配一副' }),
        this.O('替他保密，但不插手', () => { f.li = 'neutral'; this.go('c1_mo2'); return this.N('厉飞雨', '「……多谢。」\n\n（他擦掉嘴角的血，摇摇晃晃地走了）', [this.O('离开')], { look: LI_LOOK }); }),
        this.O('告诉墨大夫', () => { f.li = 'enemy'; g.ws.rep -= 3; this.give('mat_lingshi', 30); this.go('c1_mo2'); return this.N('厉飞雨', '（他死死盯着你，一字一句）「好，好一个神手谷的韩师兄。」\n\n几日后，听说七绝堂的厉飞雨被逐出了练武场。墨大夫赏了你三十块灵石，夸你“懂事”。\n\n【灵石 ×30　正道声望 -3】', [this.O('……')], { look: LI_LOOK, mood: 'danger' }); }, { tone: 'bad' }),
      ], { title: '七玄门七绝堂', look: LI_LOOK }));
      if (s === 'c1_wait' && !f.liTalk2) { f.liTalk2 = true; a.quest = false; return this.say(this.N('厉飞雨', '「韩师兄！」（他的气色好了许多）\n\n「野狼帮那伙人又在山下转悠了。听说他们请了个会“仙法”的怪人，一出手就是一道金光，连王长老都……」\n\n（他压低声音）「门里现在人心惶惶。真打起来，你可千万小心。」', [this.O('「你也是。」')], { title: '七玄门七绝堂', look: LI_LOOK })); }
      return this.say(this.N('厉飞雨', '「韩师兄，有空来七绝堂喝酒！」', [this.O('好')], { look: LI_LOOK }));
    }
    if (a.id === 'yan') {
      if (s === 'c2_mofu') {
        C.removeItem(h, 'item_moletter', 1);
        return this.say(this.N('严氏', '（墨府后堂。一位衣饰华贵的美妇读完遗书，久久不语。她是墨大夫的四夫人严氏，如今墨府与惊蛟会的当家人）\n\n「……老爷终究是回不来了。」\n\n「暖阳宝玉，墨府确有一块。不过——韩公子想必也听说了，独霸山庄的欧阳飞天趁老爷不在，夺了我墨府半数产业，还扬言要娶我女儿做妾。」\n\n「公子若能取他项上人头，宝玉双手奉上。」\n\n（屏风后探出一张俏生生的脸，好奇地打量着你，被严氏一个眼神瞪了回去）', [
          this.O('「一言为定。」', () => { this.go('c2_duba'); return null; }, { tone: 'gold' }),
          this.O('「屏风后那位是？」', () => { const hs = g.hearts.st('mocaihuan'); hs.met = true; return this.N('严氏', '「小女彩环，不懂规矩，让公子见笑了。」\n\n（屏风后传来一声不服气的“哼”）\n\n「欧阳飞天的事，还请公子费心。」', [this.O('「一言为定。」', () => { this.go('c2_duba'); return null; })], { title: '墨府四夫人', look: YAN_LOOK }); }),
        ], { title: '墨府四夫人', look: YAN_LOOK }));
      }
      if (s === 'c2_back') {
        const r = [this.give('item_nuanyang'), this.give('mat_lingshi', 300), this.give('pill_juqi', 2)];
        f.cured = true;
        return this.say(this.N('严氏', '（严氏看着那颗人头，脸色变了几变，终于露出笑容）\n\n「韩公子好手段。宝玉在此。」\n\n（暖阳宝玉入手生温，一股暖流顺着经脉游走，困扰你许久的寒毒，竟渐渐化开了）\n\n「另外……妾身有个不情之请。我有三个女儿，凤舞、玉珠、彩环，都到了出阁的年纪。公子若不嫌弃，墨府愿——」' + this.reward(r), [
          this.O('婉言谢绝（原著）', () => { f.marry = 'no'; this.go('c2_tainan'); return this.N('严氏', '「……也罢，仙凡有别，妾身明白。」\n\n「公子若有暇，常来墨府坐坐。彩环那丫头，倒是一直念叨你。」\n\n听说太南山近日有修仙者的集会——太南小会。也许在那里，能弄明白那块令牌的用处。', [this.O('告辞')], { look: YAN_LOOK }); }),
          this.O('「我与彩环姑娘，倒是可以多走动走动。」', () => { f.marry = 'cai'; const hs = g.hearts.st('mocaihuan'); hs.met = true; hs.favor = clamp(hs.favor + 15, -100, 100); this.go('c2_tainan'); return this.N('严氏', '（严氏掩口而笑）「那便好。」\n\n（屏风后“啪”地掉了什么东西，接着是一阵慌乱的脚步声）\n\n【墨彩环 好感 +15】\n\n听说太南山近日有修仙者的集会——太南小会。也许在那里，能弄明白那块令牌的用处。', [this.O('告辞')], { look: YAN_LOOK, mood: 'love' }); }, { tone: 'love' }),
        ], { title: '墨府四夫人', look: YAN_LOOK }));
      }
      return this.say(this.N('严氏', '「公子请自便。」', [this.O('离开')], { look: YAN_LOOK }));
    }
    if (a.id === 'wan') {
      const r = [this.give('item_qingxi')];
      if (C.bagCount(h, 'item_shengxian') <= 0) r.push(this.give('item_shengxian'));
      this.go('c2_huangfeng');
      return this.say(this.N('万小山', '（一个憨头憨脑的少年凑过来，盯着你腰间的令牌直咽口水）\n\n「这、这是升仙令吧？！道友，你知道这玩意儿多值钱吗？」\n\n他塞给你一本手抄的《清溪笔录》，絮絮叨叨讲了一大通：越国七派、灵根资质、筑基丹……最后一句你听得最清楚——\n\n「持升仙令，不必比试，可直入黄枫谷！我要是有这个，做梦都能笑醒。」' + this.reward(r), [this.O('「多谢小兄弟。」')], { title: '太南小会 · 散修少年', look: WAN_LOOK }));
    }
  }
  private moTask(): DNode {
    const r = [this.learn('luoyan')];
    this.f.herbs = 0;
    return this.N('墨大夫', '「后山溪谷近来生了几株灵草，你去采三株回来。」\n\n（他从书架上抽出一册薄薄的步法图谱丢给你）\n\n「这套《罗烟步》你也练练。山路湿滑，摔坏了身子，为师可就白教你了。」\n\n（最后那半句，他说得很轻，你没太听清。）' + this.reward(r), [this.O('「弟子遵命。」', () => { this.go('c1_herb'); this.game.hint('gather', '提示：灵草只在神识之内显现。走近后按 E 采集。'); return null; })], { title: '七玄门神手谷', look: MO_LOOK });
  }

  // ------------------------------------------------------------ 事件钩子
  onGather() {
    const s = this.S.step;
    if (s === 'c1_herb' || s === 'c1_bottle' || s === 'c1_herb2') {
      this.f.herbs = (this.f.herbs ?? 0) + 1;
      if (s === 'c1_herb2' && this.f.herbs >= 3) { const mo = this.actors.find((a) => a.id === 'mo'); if (mo) mo.quest = true; this.game.toast('灵草已够，回神手谷复命。', 'good'); }
    }
  }
  onBottle() {
    if (this.S.step !== 'c1_ripen') return;
    this.go('c1_li');
    this.timers.push({ t: 0.4, fn: () => this.say(this.N('绿液', '碧绿的液滴落在黄精上——\n\n眨眼之间，根须暴长，叶片肥厚，一股浓郁的药香扑鼻而来。十几年的黄精，竟成了百年份的灵药！\n\n你心头狂跳，下意识望了一眼四周。\n\n这东西若被人知道……', [
      this.O('此事绝不可让任何人知晓', () => this.N('掌天瓶', '你把小瓶贴身藏好。从此它有了名字——你在心里叫它“掌天瓶”。\n\n【掌天瓶：夜里吸纳星光，约二十日凝出一滴绿液（最多存三滴）。灵药药龄越高，炼丹成功率越高；筑基丹的主药，要百年以上。】', [this.O('继续')], { mood: 'mystic' }), { tone: 'gold' }),
    ], { mood: 'mystic' })) });
  }
  onKill(_e: Enemy) { /* 由 fightTick 统一判定 */ }
  onSectJoin(id: string) { if (this.S.step === 'c2_huangfeng') this.finale(id); }
  /** 剧情战倒下：不受死亡惩罚，退出战斗并可重试 */
  onDown(): boolean {
    const fi = this.fight; if (!fi) return false;
    const g = this.game, h = g.hero;
    for (const e of fi.foes) { e.dead = true; e.deathT = 1; }
    g.combat.enemies = g.combat.enemies.filter((e) => !fi.foes.includes(e));
    this.fight = null;
    h.hp = 0.6; h.mp = Math.max(h.mp, 0.5); g.combat.invulnT = 2;
    if ((fi as any).lose) { (fi as any).lose(); return true; }
    g.toast(fi.mind ? '你的神识一阵剧痛，猛地挣脱出来——再来一次！（剧情战败不受惩罚）' : '你重伤遁走，捡回一条命。（剧情战败不受惩罚，可再次挑战）', 'warn');
    fi.retry();
    return true;
  }

  // ------------------------------------------------------------ 星光凝露
  private starFx() {
    const F = this.game.renderer?.fx; if (!F || !this.cine) return;
    const p = this.game.player, bx = p.x + 16, by = p.y - 70;
    const k = Math.min(1, this.cine.t / 1.5) * Math.min(1, (this.cine.dur - this.cine.t) / 1.2);
    for (let i = 0; i < 3; i++) if (Math.random() < k) {
      const sx = bx + rand(-520, 520), sy = by - rand(500, 900);
      const tt = rand(0.9, 1.5);
      F.emit({ x: sx, y: sy, vx: (bx - sx) / tt, vy: (by - sy) / tt, life: tt, s0: rand(5, 9), s1: 2, c: [0.75, 1, 0.85], a: 0.9, stretch: 0.02 });
    }
    if (Math.random() < k * 0.5) F.emit({ x: bx + rand(-8, 8), y: by + rand(-8, 8), vx: rand(-20, 20), vy: rand(-40, -10), life: 0.8, s0: 6, s1: 1, c: [0.5, 1, 0.6], a: 0.8 });
  }
  private starsDone() {
    const g = this.game, h = g.hero;
    h.bottle.drops = Math.max(1, h.bottle.drops); h.bottle.charge = 0;
    const F = g.renderer?.fx; if (F) { const p = g.player; F.flash(p.x + 16, p.y - 70, 50, [0.5, 1, 0.65]); }
    audio.sfx('chime');
    this.go('c1_ripen');
    this.say(this.N('夜', '夜深了。\n\n怀里的小瓶越来越烫。你取出它，只见点点星光像被一只看不见的手牵引着，从天幕上丝丝缕缕地垂落，没入瓶身的叶纹。瓶身亮起一层绿蒙蒙的光晕，整整一夜，没有熄灭。\n\n天将破晓，光晕散去。你试着拔开瓶塞——这一次，竟一拔即开。\n\n瓶底，静静躺着一滴碧绿的液体。', [this.O('……')], { mood: 'mystic' }));
  }

  // ------------------------------------------------------------ 墨大夫之夜
  private moNight() {
    this.say(this.N('墨大夫', '（药庐的门虚掩着。屋里没有点灯，地上用朱砂画满了扭曲的符文，墨大夫盘坐在阵图中央，脸色青黑，一双眼睛却亮得吓人）\n\n「来，立儿，坐到为师对面来。」\n\n（墙角的黑布滑落了半边——那果然是张铁。他双目紧闭，皮肤青灰，像一具站着的尸体）', [
      this.O('坐进阵中（原著）', () => { this.mindFight(); return this.N('识海', '你刚一坐下，阵图骤然亮起血光！\n\n一股阴冷的神念蛮横地撞进你的识海——\n\n「好徒儿，为师养了你六年，你这副身子……就借给为师吧！」\n\n【识海之战：击溃墨大夫的元神】', [this.O('守住心神！')], { mood: 'danger' }); }, { tone: 'bad' }),
      this.O('转身就走', () => { this.moHunt(true); return null; }),
    ], { title: '七玄门神手谷', look: MO_LOOK, mood: 'danger' }));
  }
  private moHunt(fled = false) {
    const g = this.game, s = g.hero.stage;
    this.drop('quhun_s');
    const text = fled ? '你刚退到门口，身后响起墨大夫阴恻恻的笑声：「既然不肯坐下，那就……躺下吧！」\n\n黑布彻底滑落，张铁——不，曲魂——迈着僵硬的步子朝你走来。' : '「好徒儿，你让为师好等啊。」\n\n墨大夫从夜色里走出来，身后跟着一个高大的身影。那张青灰色的脸，你认得——是两年前失踪的张铁。\n\n「张铁那小子练不成象甲功，倒是炼成了一具好尸傀。你嘛……为师另有用处！」';
    this.say(this.N('墨大夫', text, [this.O('迎战！')], { title: '七玄门神手谷', look: MO_LOOK, mood: 'danger' }));
    this.startFight([
      { foes: [{ def: 'quhun_foe', name: '曲魂（张铁）', realm: 1, stage: s + 1, hp: 2, look: QUHUN_LOOK, boss: true, height: 1.1 }, { def: 'mo_body', name: '墨大夫', realm: 1, stage: s + 1, hp: 1.6, look: MO_LOOK, tag: 'mo' }] },
    ], { onWin: () => this.moWin(false), retry: () => { this.f.moMet = false; this.f.moDay = this.game.day - 2; this.enter('c1_mo3'); } });
  }
  private mindFight() {
    const s = this.game.hero.stage;
    this.startFight([
      { foes: [{ def: 'mo_soul', name: '墨大夫元神', realm: 1, stage: s + 1, hp: 2.4, boss: true, tag: 'mosoul' }] },
      { foes: [{ def: 'yu_soul', name: '余子童残魂', realm: 1, stage: s + 2, hp: 2, boss: true }], introSpeaker: '余子童', intro: '墨大夫的元神惨叫着溃散——可就在这时，一道陌生的神念从那团残魂里钻了出来！\n\n「墨居仁这废物！老夫教他夺舍之法，他竟连个毛头小子都拿不下！」\n\n这是个死去多年的修仙者残魂，自称余子童。原来墨大夫的长春功、夺舍术，都是此人所授。\n\n「也罢，你这副身子，老夫自己来取！」' },
    ], { mind: true, onWin: () => this.moWin(true), retry: () => { this.f.moMet = false; this.enter('c1_mo3'); } });
  }
  private moWin(mind: boolean) {
    const g = this.game, f = this.f;
    f.handu = true; f.moRoute = mind ? 'mind' : 'fight';
    const d = g.npcs.byId.get('modaifu') as any; if (d) { d.alive = false; d.deathNote = '夺舍韩立不成，身死神手谷'; }
    g.news('七玄门神手谷的墨大夫暴病身亡，他那个沉默寡言的弟子韩立，成了谷里唯一的主人。', 'personal');
    const r = [this.learn('quhun'), this.give('item_moletter'), this.give('mat_lingshi', 120), this.give('pill_juqi', 2), this.give('tal_fire', 3)];
    if (!g.hero.arts.some((a) => a.id === 'jingang')) r.push(this.learn('jingang'));
    f.waitUntil = g.day + 12;
    this.go('c1_wait');
    this.say(this.N(mind ? '识海' : '神手谷', (mind ? '余子童的残魂在你识海里尖啸着化为乌有。你猛地睁眼，天已大亮。墨大夫倒在阵图中央，早已没了气息。\n\n' : '墨大夫倒在血泊里，曲魂直挺挺地立着，没了主人的号令，一动不动。\n\n') +
      '你在药庐的暗格里找到了墨大夫留下的东西：几瓶丹药、一叠符箓、一封写给家人的信，还有一卷控尸之法——你按图索骥，在曲魂眉心打下一道神识烙印。张铁的身体，从此只听你一人号令。\n\n信里说，你体内早被种下了寒毒，嘉元城墨府有一块暖阳宝玉，可解此毒。\n\n他算计了你六年。可没有他，你也不会走上这条路。' + this.reward(r), [this.O('安葬墨大夫', () => { g.ws.rep += 2; return this.N('神手谷', '你在药庐后的山坡上垒了座小坟，立了块无字碑。\n\n【正道声望 +2】\n\n（七玄门风声日紧：野狼帮的人，又在山下出没了。）', [this.O('继续')]); }), this.O('一把火烧了药庐', () => this.N('神手谷', '火光映红了半个山谷。你没有回头。\n\n（七玄门风声日紧：野狼帮的人，又在山下出没了。）', [this.O('继续')]))], { mood: 'mystic' }));
  }

  // ------------------------------------------------------------ 野狼帮 · 金光上人
  private wolfFight() {
    const s = this.game.hero.stage;
    this.say(this.N('七玄门山门', '山门外火光冲天，喊杀声震耳欲聋。野狼帮帮主贾天龙亲自带人杀上彩霞山，七玄门弟子节节败退。\n\n人群后面，一个干瘦的侏儒负手而立，杏黄道袍纤尘不染。他指尖一点，一道金芒飞出，七玄门的一位长老便身首异处。\n\n——修仙者。', [this.O('拔剑！')], { mood: 'danger' }));
    this.startFight([
      { foes: [{ def: 'yelang', realm: 0, stage: 0, hp: 2.5 }, { def: 'yelang', realm: 0, stage: 0, hp: 2.5 }, { def: 'yelang', realm: 0, stage: 0, hp: 2.5 }, { def: 'yelang', realm: 0, stage: 0, hp: 2.5 }, { def: 'jiatianlong', name: '贾天龙', realm: 0, stage: 0, hp: 9, atk: 2.2, look: JIA_LOOK, boss: true }] },
      { foes: [{ def: 'jinguang', name: '金光上人', realm: 1, stage: Math.max(3, s + 3), hp: 3, look: JINGUANG_LOOK, boss: true, tag: 'jinguang', height: 0.8 }], introSpeaker: '金光上人', introLook: JINGUANG_LOOK, intro: '「啧，七玄门里竟藏着个修仙的小娃娃？」\n\n侏儒眯起眼睛，上下打量着你，目光贪婪起来：「炼气期……身上还有法器？哈哈，今日倒是没白来！」\n\n他从袖中抽出一张画着小剑的金色符纸——\n\n【小心地上的金色光圈：那是符宝斩落的位置，按空格闪避！】' },
    ], { onWin: () => this.wolfWin(), retry: () => this.enter('c1_wolf') });
  }
  private wolfWin() {
    const g = this.game, h = g.hero;
    const r = [this.give('item_shengxian'), this.give('tal_fubao', 3), this.give('tal_jingang', 3), this.give('item_qinpu'), this.give('mat_lingshi', 200)];
    g.ws.rep += 6;
    g.news('野狼帮围攻七玄门，帮主贾天龙伏诛。传说神手谷的韩神医出手，斩了一名会仙法的怪人。', 'canon');
    this.hideCanon(false);
    if (C.bagCount(h, 'item_moletter') <= 0) C.addItem(h, 'item_moletter', 1);
    this.go('c2_mofu');
    this.say(this.N('七玄门', '金光上人的尸体缩成小小一团，像个孩子。你从他身上搜出了一块刻着“升仙”二字的令牌、几张金刚符、那张已经黯淡的飞剑符宝，还有一本旧族谱——原来他本姓秦，是卷了家传宝物出逃的秦家子弟。\n\n野狼帮作鸟兽散。七玄门上下看你的眼神，从此不一样了。\n\n可你知道，这座山已经留不住你了。\n\n墨大夫的遗书还在怀里。先去嘉元城，取暖阳宝玉，解了这身寒毒。' + this.reward([...r, '正道声望 +6']), [this.O('下山', () => this.N('序章 · 终', '—— 序章「七玄门」完 ——\n\n你得到了掌天瓶、曲魂与升仙令。\n\n接下来的路：嘉元城墨府 → 太南小会 → 黄枫谷。\n\n（左上角卷轴会继续指引你。也可以随时偏离主线，四处闯荡——人界之大，你想去哪儿都行。）', [this.O('启程', undefined, { tone: 'gold' })], { mood: 'mystic' }))], { mood: 'mystic' }));
  }

  // ------------------------------------------------------------ 独霸山庄
  private dubaFight() {
    const s = this.game.hero.stage;
    this.say(this.N('独霸山庄', '山庄大门洞开，几十个护院举着火把。正堂上，一个锦袍中年人缓缓起身，周身劲气鼓荡，衣袂无风自动——越国武林第一高手，欧阳飞天。\n\n「墨家那个寡妇，请来的就是你这么个毛头小子？」\n\n他身边，还站着一个面目阴鸷的散修。', [this.O('动手')], { mood: 'danger' }));
    this.startFight([
      { foes: [{ def: 'duba', realm: 0, stage: 0, hp: 2.5 }, { def: 'duba', realm: 0, stage: 0, hp: 2.5 }, { def: 'duba', realm: 0, stage: 0, hp: 2.5 }, { def: 'bandit', name: '山庄供奉', realm: 1, stage: s + 1, hp: 1.6 }] },
      { foes: [{ def: 'ouyang', name: '欧阳飞天', realm: 0, stage: 0, hp: 16, atk: 3.2, look: OUYANG_LOOK, boss: true }], introSpeaker: '欧阳飞天', introLook: OUYANG_LOOK, intro: '「废物！」\n\n欧阳飞天一掌拍碎了太师椅，身形一晃，已到了你面前——凡人武道练到他这一步，竟也快得惊人！' },
    ], { onWin: () => { this.go('c2_back'); this.say(this.N('独霸山庄', '欧阳飞天倒下了。凡人武道的巅峰，终究挡不住仙法。\n\n你提着他的人头，走出满地狼藉的山庄。', [this.O('回墨府')])); }, retry: () => this.enter('c2_duba') });
  }

  // ------------------------------------------------------------ 终章
  private finale(sect: string) {
    const g = this.game;
    this.S.step = 'free'; this.actors = []; this.hideCanon(false);
    const hf = sect === 'huangfeng';
    g.news(hf ? '黄枫谷新收了一名持升仙令入门的弟子，伪灵根，据说是个凡人武林出身的。' : '一名持升仙令的少年，没去黄枫谷，反倒投了别派。', 'personal');
    this.say(this.N('第一章 · 终', (hf ? '黄枫谷的山门在云雾中缓缓打开。执事验过升仙令，将你的名字记进了外门名册——伪灵根，炼气期，凡人武林出身。\n\n没有人多看你一眼。这样正好。\n\n' : '你最终没有去黄枫谷。升仙令被你收进储物袋的角落——路，本来就该自己选。\n\n') +
      '—— 主线引导到此结束 ——\n\n从今往后，路由你自己走：\n· 两年后的血色禁地，是筑基丹主药的唯一来源；\n· 掌天瓶的绿液，能把凡药变成百年灵药；\n· 越国之外，还有天南、乱星海、大晋……\n· 魔道六宗，正对越国虎视眈眈。\n\n活下去。然后，走得更远。', [this.O('踏入人界', undefined, { tone: 'gold' })], { mood: 'mystic' }));
    g.updateUI(true);
  }

  // ------------------------------------------------------------ 战斗
  startFight(waves: Wave[], o: { mind?: boolean; onWin: () => void; retry: () => void; lose?: () => void }) {
    const p = this.game.player;
    if (o.mind) for (const e of this.game.combat.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 2000) { e.dead = true; e.deathT = 1; }
    this.fight = { waves, wi: -1, foes: [], cx: p.x, cy: p.y, mind: !!o.mind, onWin: o.onWin, retry: o.retry, specials: new Map() };
    (this.fight as any).lose = o.lose;   // 第四十九步：开放世界里的识海之战（夺舍）败了不能重来
    this.nextWave();
  }
  private nextWave() {
    const fi = this.fight, g = this.game, p = g.player;
    if (!fi) return;
    fi.wi++;
    const w = fi.waves[fi.wi];
    if (!w) { const win = fi.onWin; this.fight = null; win(); return; }
    if (w.intro && fi.wi > 0) this.say(this.N(w.introSpeaker ?? '', w.intro, [this.O('……')], { mood: 'danger', look: w.introLook }));
    fi.foes = [];
    w.foes.forEach((s, i) => {
      const def = ENEMIES[s.def]; if (!def) return;
      const an = (i / Math.max(1, w.foes.length)) * TAU + rand(-0.3, 0.3);
      const d = s.boss ? 420 : rand(380, 560);
      let x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.7;
      if (!def.flying && g.terrain.walkFactor(x, y) <= 0) { x = p.x + Math.cos(an) * 200; y = p.y + Math.sin(an) * 140; }
      const e = new Enemy(def, x, y, Math.max(0, Math.min(5, s.realm)), Math.max(0, Math.min(12, s.stage)));
      if (s.name) e.name = s.name;
      if (s.hp) e.maxHp = e.hp = Math.round(e.hp * s.hp);
      if (s.atk) e.atk *= s.atk;
      if (s.look) e.look = { ...s.look };
      if (s.height && e.look) e.look.height = s.height;
      e.boss = !!s.boss; e.aggro = true; e.hx = x; e.hy = y;
      g.combat.enemies.push(e); fi.foes.push(e);
      if (s.tag) fi.specials.set(e, { t: s.tag === 'jinguang' ? 4 : 6, tag: s.tag });
      const F = g.renderer?.fx; if (F) F.smoke(x, y, 6, [0.2, 0.18, 0.16], 0.4, 20, 50);
    });
  }
  private fightTick(dt: number) {
    const fi = this.fight!, g = this.game, p = g.player, c = g.combat;
    // 敌人保持仇恨
    for (const e of fi.foes) if (!e.dead) { e.aggro = true; e.flee = false; }
    // 识海：限制活动范围
    if (fi.mind) {
      const dx = p.x - fi.cx, dy = p.y - fi.cy, d = Math.hypot(dx, dy);
      if (d > 620) { p.x = fi.cx + dx / d * 620; p.y = fi.cy + dy / d * 620; }
    } else if (Math.hypot(p.x - fi.cx, p.y - fi.cy) > 2200) {
      // 逃离：撤销本次战斗
      for (const e of fi.foes) e.dead = true;
      c.enemies = c.enemies.filter((e) => !fi.foes.includes(e));
      const retry = fi.retry; this.fight = null;
      g.toast('你脱离了战斗。（回到原地可再次挑战）', 'warn');
      retry(); return;
    }
    // 特殊招式
    for (const [e, sp] of fi.specials) {
      if (e.dead) continue;
      sp.t -= dt;
      if (sp.pend) {
        sp.pend.t -= dt;
        if (sp.pend.t <= 0) {
          const { x, y } = sp.pend; sp.pend = undefined;
          if (sp.tag === 'jinguang') {
            c.vfx.push({ kind: 'bigsword', x: e.x, y: e.y - 60, x2: x, y2: y - 20, r: 60, t: 0, dur: 0.7, color: '255,220,120', fx: 'bigsword', seed: Math.random() * 1e6 } as any);
            c.vfx.push({ kind: 'ring', x, y, r: 150, t: 0, dur: 0.5, color: '255,220,120', fx: 'gold' } as any);
            g.trauma = Math.min(1, g.trauma + 0.3);
            if (Math.hypot(p.x - x, p.y - y) < 135) c.hitPlayer(e.atk * 3.4, e.realm, { k: 'knock', dur: 0.3, ch: 1 }, x, y, e);
          }
        }
      } else if (sp.t <= 0) {
        if (sp.tag === 'jinguang') { sp.t = rand(5, 7); sp.pend = { x: p.x, y: p.y, t: 1.05 }; c.vfx.push({ kind: 'warn', x: p.x, y: p.y, r: 135, t: 0, dur: 1.05, color: '255,210,100' } as any); c.texts.push({ x: e.x, y: e.y - 120, s: '符宝！', color: '#ffd870', t: 0, vy: -30 } as any); }
        else if (sp.tag === 'mosoul') { sp.t = rand(7, 9); const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; p.x += dx / d * Math.min(160, d * 0.5); p.y += dy / d * Math.min(110, d * 0.35); g.hero.mp = Math.max(0, g.hero.mp - 0.12); g.hurtFlash = Math.max(g.hurtFlash, 0.6); c.texts.push({ x: p.x, y: p.y - 120, s: '神魂被扯动！', color: '#ff8070', t: 0, vy: -30 } as any); }
        else if (sp.tag === 'mo') { sp.t = rand(9, 12); c.texts.push({ x: e.x, y: e.y - 120, s: '尸虫丸！', color: '#a0e0a0', t: 0, vy: -30 } as any); }
      }
    }
    if (this.fight !== fi) return;
    if (fi.foes.every((e) => e.dead)) this.nextWave();
  }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    if (!this.active) return;
    const g = this.game;
    for (const a of this.actors) {
      if (a.hidden) continue;
      if (a.x < view.left - 400 || a.x > view.right + 400 || a.y < view.top - 400 || a.y > view.bottom + 300) continue;
      const v = g.life.vis(a); if (v <= 0.01) continue;
      out.push({ y: a.y, draw: (ctx) => this.drawActor(ctx, a, v, t, dt) });
    }
    if (this.cine && !g.renderer?.stage) {
      const p = g.player, k = Math.min(1, this.cine.t / 1.5) * Math.min(1, (this.cine.dur - this.cine.t) / 1.2);
      out.push({ y: p.y + 1, draw: (ctx) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 24; i++) { const u = (t * 0.6 + i / 24) % 1, sx = p.x + Math.sin(i * 7.3) * 500 * (1 - u) + 16, sy = p.y - 70 - (1 - u) * 800; ctx.strokeStyle = `rgba(170,255,200,${0.6 * k * u})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (p.x + 16 - sx) * 0.08, sy + 30); ctx.stroke(); } const gr = ctx.createRadialGradient(p.x + 16, p.y - 70, 0, p.x + 16, p.y - 70, 60); gr.addColorStop(0, `rgba(140,255,170,${0.7 * k})`); gr.addColorStop(1, 'rgba(140,255,170,0)'); ctx.fillStyle = gr; ctx.fillRect(p.x - 50, p.y - 140, 140, 140); ctx.restore(); } });
    }
  }
  private drawActor(ctx: G, a: Actor, v: number, t: number, dt: number) {
    ctx.save(); ctx.globalAlpha *= v;
    if (a.prop === 'hut') this.drawHut(ctx, a.x, a.y);
    else if (a.prop === 'manor') this.drawManor(ctx, a.x, a.y);
    else if (a.prop === 'stall') { ctx.fillStyle = '#6a4a2e'; ctx.fillRect(a.x - 50, a.y - 34, 100, 34); ctx.fillStyle = '#e6d8b0'; ctx.fillRect(a.x - 58, a.y - 40, 116, 8); ctx.fillStyle = '#b8a070'; for (let i = 0; i < 4; i++) ctx.fillRect(a.x - 42 + i * 24, a.y - 50, 14, 10); }
    else if (a.prop === 'bottle') {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(a.x, a.y - 8, 0, a.x, a.y - 8, 46);
      gr.addColorStop(0, `rgba(150,255,180,${0.45 + 0.3 * pulse})`); gr.addColorStop(1, 'rgba(150,255,180,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(a.x, a.y - 8, 46, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#2f5a3a'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 8, 7, 10, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e3a26'; ctx.fillRect(a.x - 2 + 5, a.y - 22, 4, 7);
      ctx.strokeStyle = 'rgba(200,255,210,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x - 2, a.y - 10, 4, 3.6, 5); ctx.stroke();
      for (let i = 0; i < 3; i++) { const u = (t * 0.5 + i / 3) % 1; ctx.fillStyle = `rgba(190,255,210,${(1 - u) * 0.8})`; ctx.beginPath(); ctx.arc(a.x + Math.sin(i * 5 + t) * 10, a.y - 14 - u * 40, 2, 0, TAU); ctx.fill(); }
    } else if (a.look && a.st) {
      a.st.update(dt);
      drawCharacter(ctx, a.look, a.st, 1, dt);
    }
    // 名字 / 任务标记
    if (a.name && a.look) {
      ctx.font = '15px "Ma Shan Zheng", "STKaiti", serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,16,12,0.6)'; ctx.fillText(a.name, a.x + 1, a.y - 168 + 1);
      ctx.fillStyle = this.focus === a ? '#ffe7a8' : '#f2e6c8'; ctx.fillText(a.name, a.x, a.y - 168);
    }
    if (a.quest) {
      const by = a.y - (a.look ? 196 : 60) + Math.sin(t * 3) * 5;
      ctx.font = 'bold 30px serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(40,20,0,0.5)'; ctx.fillText('！', a.x + 1, by + 2);
      ctx.fillStyle = '#ffcf4a'; ctx.fillText('！', a.x, by);
    }
    if (a.bubble && a.look) {
      ctx.font = '13px serif'; const w = ctx.measureText(a.bubble).width + 16;
      ctx.fillStyle = 'rgba(250,244,230,0.92)'; ctx.fillRect(a.x - w / 2, a.y - 150, w, 22);
      ctx.fillStyle = '#4a3a2a'; ctx.textAlign = 'center'; ctx.fillText(a.bubble, a.x, a.y - 134);
    }
    ctx.restore();
  }
  private drawHut(ctx: G, x: number, y: number) {
    // 茅草药庐：竹篱、土墙、草顶、药架
    ctx.fillStyle = 'rgba(30,24,18,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 150, 34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b8a07a'; ctx.fillRect(x - 100, y - 110, 200, 110);
    ctx.fillStyle = '#a08860'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 100, y - 100 + i * 18, 200, 2);
    ctx.fillStyle = '#3a2c20'; ctx.fillRect(x - 22, y - 70, 44, 70);
    ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x + 40, y - 80, 36, 28); ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2; ctx.strokeRect(x + 40, y - 80, 36, 28); ctx.beginPath(); ctx.moveTo(x + 58, y - 80); ctx.lineTo(x + 58, y - 52); ctx.stroke();
    const gr = ctx.createLinearGradient(x, y - 190, x, y - 100); gr.addColorStop(0, '#8a7448'); gr.addColorStop(1, '#6a5634');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 130, y - 100); ctx.quadraticCurveTo(x - 60, y - 170, x, y - 192); ctx.quadraticCurveTo(x + 60, y - 170, x + 130, y - 100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,46,26,0.5)'; ctx.lineWidth = 1.5;
    for (let i = -120; i <= 120; i += 12) { ctx.beginPath(); ctx.moveTo(x + i * 0.2, y - 186); ctx.lineTo(x + i, y - 100); ctx.stroke(); }
    // 药架
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 3;
    for (const ox of [-170, -130]) { ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.lineTo(x + ox, y - 70); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - 178, y - 60); ctx.lineTo(x - 122, y - 60); ctx.moveTo(x - 178, y - 30); ctx.lineTo(x - 122, y - 30); ctx.stroke();
    ctx.fillStyle = '#7a8a4a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x - 170 + i * 14, y - 66, 6, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x - 168 + i * 14, y - 36, 6, 4, 0, 0, TAU); ctx.fill(); }
    // 竹篱
    ctx.strokeStyle = '#8a7a4a'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + 110 + i * 10, y + 4); ctx.lineTo(x + 110 + i * 10, y - 30); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 106, y - 20); ctx.lineTo(x + 196, y - 20); ctx.stroke();
  }
  private drawManor(ctx: G, x: number, y: number) {
    ctx.fillStyle = 'rgba(30,24,18,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 260, 50, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x - 240, y - 70, 480, 70);
    ctx.fillStyle = '#5a2a22'; ctx.fillRect(x - 40, y - 110, 80, 110);
    ctx.fillStyle = '#2a1a16'; ctx.fillRect(x - 28, y - 80, 56, 80);
    ctx.fillStyle = '#3a3634'; ctx.beginPath(); ctx.moveTo(x - 70, y - 104); ctx.lineTo(x, y - 150); ctx.lineTo(x + 70, y - 104); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3634'; ctx.fillRect(x - 250, y - 80, 500, 12);
    ctx.fillStyle = '#c8a050'; ctx.fillRect(x - 30, y - 100, 60, 14);
    ctx.fillStyle = '#2a1a10'; ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText('独霸山庄', x, y - 89);
    ctx.fillStyle = '#c03020'; for (const ox of [-60, 60]) { ctx.beginPath(); ctx.ellipse(x + ox, y - 92, 9, 12, 0, 0, TAU); ctx.fill(); }
  }

  /** WebGL：任务光柱、星光凝露、瓶光 */
  drawGL(F: FxSys, t: number) {
    if (!this.active) return;
    const g = this.game, p = g.player;
    const gl = this.goal();
    if (gl && gl.tx !== undefined && gl.ty !== undefined) {
      const d = Math.hypot(gl.tx - p.x, gl.ty! - p.y);
      const k = clamp((g.senseRadius * 1.25 - d) / 300, 0, 1) * clamp((d - 120) / 200, 0, 1);
      if (k > 0) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
        F.beam(gl.tx, gl.ty!, gl.tx, gl.ty! - 520, 34, [1, 0.82, 0.45], 0.22 * k * pulse);
        F.glow(gl.tx, gl.ty!, 70, [1, 0.8, 0.4], 0.35 * k * pulse);
      }
    }
    const b = this.actors.find((a) => a.prop === 'bottle');
    if (b && g.life.vis(b) > 0.05) F.glow(b.x, b.y - 8, 40 + 8 * Math.sin(t * 3), [0.5, 1, 0.6], 0.5);
    if (this.cine) {
      const k = Math.min(1, this.cine.t / 1.5) * Math.min(1, (this.cine.dur - this.cine.t) / 1.2);
      F.glow(p.x + 16, p.y - 70, 60 + 14 * Math.sin(t * 5), [0.45, 1, 0.6], 0.7 * k);
      F.beam(p.x + 16, p.y - 70, p.x + 16, p.y - 900, 120, [0.6, 0.9, 1], 0.08 * k);
    }
    for (const a of this.actors) if (a.quest && a.look && g.life.vis(a) > 0.05) F.glow(a.x, a.y - 196, 26, [1, 0.8, 0.3], 0.35);
  }
}
