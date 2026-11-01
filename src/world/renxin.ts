// 第四十九步「人心」：世界会对你说谎
// · 表里不一：规则在 renxin-core.ts（心声泡 / 名牌 / 对话里的好感与性格都走「演出来的那张脸」，神识压得住才描金见真心）
// · 骗局池（开放世界）：#1 合作探宝·分赃翻脸　#2 地摊假丹 / 假玉简　#3 借刀杀人　#5 夺舍老魔
//   ——同一种钩子大半是真的、少数是局；骗子的心声、性格、好感全是演的。反制：神识细探、请丹师掌眼、回头对质、只喂丹不渡气……或者赌一把。
// · 败北有牙齿：看是谁把你打倒的
//   妖兽：被路人所救 + 道伤；劫修 / 仇家：储物袋被搜走七到十成，生成「寻仇夺回」——他会花你的钱、卖你的药，去晚了东西真没了；
//   死敌：补刀——遁地符自行激发，或燃烧精血遁走（跌一层、折寿）；魔修：小概率被掳回洞府，自己想法子逃。
// · 阅历：每吃一次亏 / 识破一次记一条（纪事里可翻），下回破绽更容易露出来。
import type { Game } from './game';
import type { Pers } from './npc';
import { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef, ITEM_LIST } from '../data/items';
import { REALMS, realmName, MAJOR_BREAKS } from '../data/realms';
import type { DNode, DOpt } from './modal';
import { CharState, drawCharacter, randomLook, Look } from '../gfx/character';
import { loot, dirName } from './sites';
import { cultivator } from './melee';
import { ACTIVE_MAP, WORLD_W, WORLD_H } from '../data/world';
import { audio } from './audio';
import { drawMindBubble } from './alive';
import * as R from './renxin-core';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const capS = (r: number, s: number) => clamp(Math.round(s), 0, (REALMS[r]?.stages?.length ?? 4) - 1);
const SURN = ['王', '李', '赵', '孙', '周', '吴', '郑', '冯', '陈', '褚', '卫', '蒋', '沈', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜', '谢', '邹', '章', '云', '苏', '潘', '葛', '范', '彭', '鲁', '马', '方', '任', '袁', '柳', '史', '唐'];
const GIVEN = ['元', '无忌', '长青', '不凡', '长风', '玄', '寒', '千山', '百川', '飞', '秋水', '冥', '子期', '守拙', '怀远', '青崖', '慕白', '天行', '若虚', '承志', '明远', '道衍', '鹤年', '松年'];
const rname = () => pick(SURN) + pick(GIVEN);
const SECTS = ['清虚门', '掩月宗', '化刀坞', '天阙堡', '巨剑门', '灵兽山', '黄枫谷'];
const EVIL_SCHOOLS = ['guiling', 'hehuan', 'tiansha', 'yinluo', 'tianmo'];

interface Npc { look: Look; st: CharState; x: number; y: number }
interface Scam {
  id: number; kind: R.ScamKind; scam: boolean; pers: Pers; seed: number;
  name: string; realm: number; stage: number;
  x: number; y: number; t: number; st: string; done: boolean; seen: boolean;
  npc?: Npc; foe?: Enemy; foes: Enemy[]; tx?: number; ty?: number;
  mindT?: number; mind?: { text: string; t: number; gold: boolean };
  d: any;
}
interface Stolen {
  name: string; realm: number; stage: number; npcId?: string; map: string; x: number; y: number;
  items: R.Stack[]; ls: number; day: number; last: number; evil?: boolean; sold: number; spawned?: boolean; cls: R.FoeClass;
}

export class Renxin {
  game: Game;
  list: Scam[] = [];
  focus: Scam | null = null; focusD = 1e9;
  private nid = 1;
  private spawnT = rand(70, 120);
  private thief: Enemy[] = [];
  private cellGuards: Enemy[] = [];
  constructor(g: Game) { this.game = g; }
  reset() { for (const x of this.list) this.cleanup(x); this.list = []; this.focus = null; this.thief = []; this.cellGuards = []; }
  private get F(): any { return this.game.ws.flags as any; }

  // ================================================================ 阅历
  yl(kind: R.ScamKind): number { return (this.F.rx_yl ?? {})[kind] ?? 0; }
  ylAll(): number { const o = this.F.rx_yl ?? {}; let n = 0; for (const k in o) n += o[k]; return n; }
  learn(kind: R.ScamKind, text: string) {
    const F = this.F; F.rx_yl = F.rx_yl ?? {}; F.rx_yl[kind] = (F.rx_yl[kind] ?? 0) + 1;
    F.rx_notes = [...(F.rx_notes ?? []), { day: Math.floor(this.game.day), kind, text }].slice(-40);
    this.game.news(`【阅历 · ${R.SCAM_NAME[kind]}】${text}。`, 'personal');
    this.game.toast(`阅历 +1：${text}（同类的局，下回更容易看出破绽）`, 'info');
  }
  /** 破绽：头一回约一成，上过同类的当之后越来越容易看出来 */
  private flaw(x: Scam): string {
    if (!x.scam) return '';
    const n = this.yl(x.kind);
    if (Math.random() >= R.flawChance(n)) return '';
    const remind: Record<R.ScamKind, string> = {
      partner: '上回同探遗府的那人，也是这般殷勤',
      stall: '上回那颗「便宜」的丹药，也是这个成色',
      knife: '上回那个哭着求你主持公道的人，事后再没露过面',
      possess: '上回那个「重伤的前辈」，也是这般急着要你的灵力',
    };
    return n > 0 ? `\n\n（你想起上次……${remind[x.kind]}。）${pick(R.FLAWS)}` : `\n\n${pick(R.FLAWS)}`;
  }
  /** 神识读心（压得住他才看得见真心） */
  private supOn(o: { x: number; y: number; realm: number }) {
    const g = this.game, p = g.player;
    return Math.hypot(o.x - p.x, o.y - p.y) < g.senseRadius && !g.concealed && g.hero.realm - o.realm >= 1 ? 1 : 0;
  }
  private readable(x: Scam): boolean { return R.readLevel(this.game.hero.realm, { realm: x.realm, pers: x.pers }, this.supOn(x)) > 0; }
  private persName(x: Scam) { return R.PERS_CN[this.readable(x) ? x.pers : R.disguisePers({ pers: x.pers, seed: x.seed })]; }
  private title(x: Scam, what = '散修') { return `${realmName(x.realm, x.stage)} · ${what} · ${this.persName(x)}`; }
  private thought(x: Scam): { text: string; gold: boolean } {
    if (this.readable(x)) return { text: pick(x.scam ? R.SCHEME_TRUE[x.kind] : R.HONEST_TRUE[x.kind]), gold: true };
    const masked = x.scam || x.pers === 'ruthless' || x.pers === 'greedy';
    if (!masked) return { text: pick(R.HONEST_TRUE[x.kind]), gold: false };
    // 演出来的：和老实人想的一模一样（所以看不穿时分不出来），偶尔漏个破绽
    const T = [...R.HONEST_TRUE[x.kind], ...(R.FAKE_LINES[x.pers] ?? R.FAKE_LINES.greedy!)];
    return { text: pick(T) + (x.scam && Math.random() < R.flawChance(this.yl(x.kind)) * 0.5 ? pick(R.FLAWS) : ''), gold: false };
  }
  private mindLine(x: Scam) {
    if (!this.readable(x)) return '';
    x.d.read = true;
    return `\n\n【神识 · 真心】你听见他心底的声音：「${pick(x.scam ? R.SCHEME_TRUE[x.kind] : R.HONEST_TRUE[x.kind])}」`;
  }
  private probe(x: Scam, back: () => DNode): DNode {
    let text: string;
    if (this.readable(x)) {
      x.d.read = true;
      text = `你神识一扫，${x.name}心底的念头清清楚楚：\n\n【真心】「${pick(x.scam ? R.SCHEME_TRUE[x.kind] : R.HONEST_TRUE[x.kind])}」`;
    } else {
      const base = x.kind === 'possess' ? `${x.name}的神识涣散如一团乱雾——是重伤，还是藏得太深？你看不透。` : `${x.name}气息收敛得滴水不漏，你看不出深浅。`;
      text = base + (this.flaw(x) || '\n\n（你的修为压不住他，神识探不进去——只看得见他想让你看见的。）');
    }
    return { speaker: '神识', mood: 'mystic', text, options: [{ label: '……', act: () => back() }] };
  }

  // ================================================================ 每帧
  update(dt: number) {
    const g = this.game, p = g.player;
    this.stolenTick();
    this.list = this.list.filter((x) => {
      if (x.done) { this.cleanup(x); return false; }
      const travel = x.st === 'travel' || x.st === 'guard' || x.st === 'open' || x.st === 'split' || x.st === 'fight' || x.st === 'go' || x.st === 'confront';
      const d0 = Math.hypot(x.x - p.x, x.y - p.y), dT = x.tx != null ? Math.hypot(x.tx - p.x, x.ty! - p.y) : d0;
      if (!travel && d0 > Math.max(6000, g.senseRadius * 4)) { this.cleanup(x); return false; }
      if (travel && Math.min(d0, dT) > 9000) { this.cleanup(x); return false; }
      return true;
    });
    this.focus = null; this.focusD = 1e9;
    for (const x of this.list) {
      const dist = Math.hypot(x.x - p.x, x.y - p.y);
      if (!x.seen && dist < g.senseRadius * 0.95) { x.seen = true; g.toast(this.seenText(x), 'info'); }
      this.tick(x, dt);
      if (x.npc && (x.st === 'idle' || x.st === 'go')) { const dn = Math.hypot(x.npc.x - p.x, x.npc.y - p.y); if (dn < 220 && dn < this.focusD) { this.focus = x; this.focusD = dn; } }
      if (x.npc && dist < 700) { x.mindT = (x.mindT ?? rand(2, 5)) - dt; if (x.mindT <= 0 && !g.modal) { x.mindT = rand(9, 16); x.mind = { ...this.thought(x), t: 3.4 }; } }
      if (x.mind) { x.mind.t -= dt; if (x.mind.t <= 0) x.mind = undefined; }
    }
    // 生成：主线引导结束、炼气以后；不打扰打坐 / 战斗 / 赶路换图
    const S = g.story as any;
    if (g.modal || p.sitting || g.combat.inCombat || S?.fight || S?.S?.step !== 'free' || g.hero.realm < 1 || g.travel?.pending) return;
    this.spawnT -= dt;
    if (this.spawnT > 0 || this.list.length) return;
    this.spawnT = rand(80, 150);
    this.spawn();
  }
  private seenText(x: Scam): string {
    switch (x.kind) {
      case 'partner': return '神识中：一个散修正朝你这边走来，像是有话要说。';
      case 'knife': return '神识中：一道踉跄的身影朝你奔来，浑身是血。';
      case 'possess': return '神识中：路旁倒着一个气息奄奄的修士，周身灵光明灭不定。';
      case 'stall': return '街角支起一个地摊，摊主正朝你挤眉弄眼。';
    }
  }
  private place(minK: number, maxK: number, road = false): { x: number; y: number } | null {
    const g = this.game, p = g.player, T = g.terrain, R0 = g.senseRadius;
    for (let i = 0; i < 16; i++) {
      const an = Math.random() * TAU, d = R0 * rand(minK, maxK);
      const x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.85;
      if (x < 400 || y < 400 || x > WORLD_W - 400 || y > WORLD_H - 400) continue;
      if (!T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 160)) continue;
      if (road && !T.onRoad(x, y) && i < 10) continue;
      return { x, y };
    }
    return null;
  }
  private near(r0: number, r1: number): { x: number; y: number } | null {
    const g = this.game, p = g.player;
    for (let i = 0; i < 16; i++) { const an = Math.random() * TAU, d = rand(r0, r1), x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.8; if (g.terrain.walkFactor(x, y) > 0.2) return { x, y }; }
    return null;
  }
  private mkNpc(x: number, y: number, role: string, seed: number): Npc {
    let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    return { look: randomLook(rnd, role as any), st: new CharState(x, y), x, y };
  }
  private human(x: number, y: number, realm: number, stage: number, name: string, evil: boolean): Enemy {
    const r = clamp(realm, 1, 5);
    const e = cultivator(x, y, r, capS(r, stage), evil ? pick(EVIL_SCHOOLS) : 'sanxiu', name);
    e.hx = x; e.hy = y; return e;
  }
  private rich() { const h = this.game.hero; return clamp(C.bagCount(h, 'mat_lingshi') / (400 * Math.pow(3, Math.max(0, h.realm - 1))), 0, 1); }

  private spawn() {
    const g = this.game, h = g.hero, p = g.player;
    const loc = g.nearbyLocation();
    const town = !!loc && (loc.type === 'town' || loc.type === 'city') && g.combat.safeAt(p.x, p.y);
    const last = this.F.rx_last ?? (this.F.rx_last = {});
    const ok = (k: R.ScamKind) => g.day - (last[k] ?? -999) >= 20;
    let kind: R.ScamKind | null = null;
    if (town) { if (ok('stall') && Math.random() < 0.6) kind = 'stall'; }
    else if (!p.flying && !g.combat.safeAt(p.x, p.y)) {
      const w = ([['partner', 10], ['knife', 9], ['possess', 6]] as [R.ScamKind, number][]).filter(([k]) => ok(k));
      const tot = w.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot;
      for (const [k, v] of w) { r -= v; if (r <= 0) { kind = k; break; } }
    }
    if (!kind) return;
    const roll = R.rollHook(kind, Math.random, this.rich());
    const seed = Math.floor(Math.random() * 1e9);
    const x: Scam = { id: this.nid++, kind, scam: roll.scam, pers: roll.pers, seed, name: rname(), realm: h.realm, stage: capS(h.realm, h.stage + rint(-2, 2)), x: p.x, y: p.y, t: g.time, st: 'approach', done: false, seen: false, foes: [], d: {} };
    if (kind === 'partner') {
      const pos = this.place(1.0, 1.25); if (!pos) return;
      x.npc = this.mkNpc(pos.x, pos.y, Math.random() < 0.25 ? 'female' : 'cultivator', seed); x.x = pos.x; x.y = pos.y;
    } else if (kind === 'knife') {
      const pos = this.place(1.0, 1.2), tp = this.place(1.15, 1.45); if (!pos || !tp) return;
      x.npc = this.mkNpc(pos.x, pos.y, 'cultivator', seed); x.x = pos.x; x.y = pos.y;
      x.d.liar = x.name; x.name = rname(); x.d.sect = pick(SECTS);
      x.d.reward = Math.round(80 * Math.pow(3, Math.max(0, h.realm - 1)) * rand(1, 1.6));
      // 所指的「魔修」：骗局里是个正派散修（他的宿敌）；老实话里真是魔修
      const tr = clamp(h.realm + (Math.random() < 0.3 ? 1 : 0), 1, 5);
      const e = this.human(tp.x, tp.y, tr, rint(0, 6), x.name, !x.scam);
      e.busy = true; e.aggro = false; e.tag = 'rx_knife';
      g.combat.enemies.push(e); x.foe = e; x.tx = tp.x; x.ty = tp.y;
      x.d.dirTxt = `${dirName(tp.x - p.x, tp.y - p.y)}方约 ${Math.max(1, Math.round(Math.hypot(tp.x - p.x, tp.y - p.y) / 260))} 里`;
    } else if (kind === 'possess') {
      const pos = this.place(1.05, 1.35, true); if (!pos) return;
      x.npc = this.mkNpc(pos.x, pos.y, 'elder', seed); x.npc.st.setAction('sit'); x.x = pos.x; x.y = pos.y;
      x.realm = clamp(h.realm + 1, 3, 5); x.stage = rint(0, 3); x.st = 'idle';
    } else {
      const pos = this.near(200, 380); if (!pos) return;
      x.npc = this.mkNpc(pos.x, pos.y, 'merchant', seed); x.x = pos.x; x.y = pos.y; x.st = 'idle';
      x.realm = 1; x.stage = rint(2, 9); x.d.until = g.time + 160;
      const mb = MAJOR_BREAKS[h.realm];
      let item = mb?.item && Math.random() < 0.65 ? mb.item : '';
      if (!item) { const pool = ITEM_LIST.filter((it) => it.type === 'scroll' && it.scroll?.skill && it.tier >= 1 && it.tier <= Math.min(4, h.realm + 1) && it.price >= 150); item = pool.length ? pick(pool).id : (mb?.item || 'pill_juling'); }
      x.d.item = item;
      x.d.price = Math.max(10, Math.round(itemDef(item).price * rand(0.28, 0.35)));
      x.d.fee = clamp(Math.round(itemDef(item).price * 0.02), 30, 800);
    }
    last[kind] = g.day;
    this.list.push(x);
  }

  // ================================================================ 推进
  private walkNpc(n: Npc, tx: number, ty: number, sp: number, dt: number) {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 4) { n.st.speed = 0; n.st.setAction('idle'); return true; }
    const k = Math.min(1, sp * dt / d);
    n.x += dx * k; n.y += dy * k; n.st.x = n.x; n.st.y = n.y; n.st.speed = sp; n.st.vx = dx / d * sp; n.st.vy = dy / d * sp;
    n.st.faceToward(dx, dy, false); n.st.setAction(sp > 200 ? 'run' : 'walk');
    return false;
  }
  private walkE(e: Enemy, tx: number, ty: number, sp: number, dt: number) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, sp * dt / d);
    e.x += dx * k; e.y += dy * k; e.facing = dx > 0 ? 1 : -1; e.anim.move = 1; e.anim.phase += dt * sp / 18;
    if (e.cs) { e.cs.x = e.x; e.cs.y = e.y; e.cs.speed = sp; e.cs.vx = dx / d * sp; e.cs.vy = dy / d * sp; e.cs.faceToward(dx, dy, false); e.cs.setAction(sp > 200 ? 'run' : 'walk'); e.cs.update(dt); }
  }
  /** 同伴跟着你走；离太远就御器跟上 */
  private follow(e: Enemy, dt: number) {
    const g = this.game, p = g.player;
    if (e.dead || e.gone) return;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 1500) {
      const a = Math.random() * TAU; e.x = p.x + Math.cos(a) * 160; e.y = p.y + Math.sin(a) * 110;
      if (e.cs) { e.cs.x = e.x; e.cs.y = e.y; }
      g.combat.vfx.push({ kind: 'blinkfx', x: e.x, y: e.y, r: 60, t: 0, dur: 0.4, color: '200,230,255' } as any);
    }
    e.hx = p.x + 90; e.hy = p.y + 40;
    if (!g.combat.inCombat && d > 220) this.walkE(e, p.x, p.y, Math.min(480, 150 + d * 0.6), dt);
  }
  private tick(x: Scam, dt: number) {
    const g = this.game, p = g.player, n = x.npc;
    if (x.st === 'approach' && n) {
      const arrived = this.walkNpc(n, p.x, p.y, x.kind === 'knife' ? 240 : 150, dt) || Math.hypot(n.x - p.x, n.y - p.y) < 230;
      x.x = n.x; x.y = n.y;
      if (arrived || Math.hypot(n.x - p.x, n.y - p.y) < 230) {
        n.st.speed = 0; n.st.setAction('idle'); n.st.faceToward(p.x - n.x, p.y - n.y);
        if (!g.modal) { x.st = 'talk'; g.openDialog(x.kind === 'partner' ? this.partnerHook(x) : this.knifeHook(x)); }
      }
      if (g.time - x.t > 150) { x.done = true; }
      return;
    }
    if (x.st === 'talk') { if (!g.modal) { x.st = 'idle'; x.d.idleT = g.time; } return; }
    if (x.st === 'idle') {
      if (n) { n.st.faceToward(p.x - n.x, p.y - n.y, false); if (x.kind !== 'possess') n.st.setAction('idle'); }
      if (x.kind === 'stall' && (g.time > x.d.until || !g.combat.safeAt(p.x, p.y))) { x.done = true; return; }
      if ((x.kind === 'partner' || x.kind === 'knife') && g.time - (x.d.idleT ?? x.t) > 90) { x.done = true; return; }
      if (x.kind === 'possess' && g.time - x.t > 240) { x.done = true; return; }
      return;
    }
    if (x.kind === 'partner') this.partnerTick(x, dt);
    else if (x.kind === 'knife') this.knifeTick(x);
  }

  interact(): boolean {
    const x = this.focus; if (!x || !x.npc) return false;
    const g = this.game;
    if (x.kind === 'stall') { g.openDialog(this.stallNode(x)); return true; }
    if (x.kind === 'possess') { g.openDialog(this.possessHook(x)); return true; }
    if (x.kind === 'partner' && x.st === 'idle') { x.st = 'talk'; g.openDialog(this.partnerHook(x)); return true; }
    if (x.kind === 'knife' && x.st === 'idle') { x.st = 'talk'; g.openDialog(this.knifeHook(x)); return true; }
    if (x.kind === 'knife' && x.st === 'go') { g.openDialog(this.liarWait(x)); return true; }
    return false;
  }
  private leave(x: Scam, line: string) { const n = x.npc; if (n) x.mind = { text: line, t: 3, gold: false }; x.done = true; }
  private cleanup(x: Scam) {
    const g = this.game;
    if (x.kind === 'knife' && x.foe && !x.foe.dead && x.foe.busy) g.combat.enemies = g.combat.enemies.filter((o) => o !== x.foe);
    if (x.kind === 'partner' && x.foe && x.foe.ally && !x.foe.dead) g.combat.dismissAllies((o) => o === x.foe);
  }

  // ================================================================ #1 合作探宝 · 分赃翻脸
  private partnerHook(x: Scam): DNode {
    const g = this.game, p = g.player;
    if (x.tx == null) {
      const s = this.place(0.9, 1.3) ?? { x: p.x + g.senseRadius, y: p.y };
      x.tx = s.x; x.ty = s.y;
      x.d.dirTxt = `${dirName(s.x - p.x, s.y - p.y)}方约 ${Math.max(1, Math.round(Math.hypot(s.x - p.x, s.y - p.y) / 260))} 里`;
    }
    return {
      speaker: x.name, title: this.title(x), look: x.npc?.look, mood: 'mystic',
      text: `「道友请留步！」${x.name}拱手一礼，压低了声音：\n\n「在下前些日子在${x.d.dirTxt}的山坳里寻到一处前辈遗府，禁制重重，一人破不开。道友若肯出手相助，所得宝物五五分账，如何？」${this.mindLine(x)}${this.flaw(x)}`,
      options: [
        { label: '「同去。」', tone: 'gold', act: () => this.partnerJoin(x) },
        { label: '（神识细探）', act: () => this.probe(x, () => this.partnerHook(x)) },
        { label: '婉拒', act: () => { this.leave(x, x.scam ? '……可惜了。' : '人各有志。'); return null; } },
      ],
    };
  }
  private partnerJoin(x: Scam): null {
    const g = this.game, n = x.npc!;
    const e = this.human(n.x, n.y, x.realm, x.stage, x.name, false);
    e.look = n.look; e.tag = 'rx_partner';
    g.combat.addAlly(e);
    x.foe = e; x.npc = undefined; x.st = 'travel';
    g.toast(`${x.name}与你结伴同行——遗府在${x.d.dirTxt}（地图上标「府」）。`, 'good');
    return null;
  }
  private partnerTick(x: Scam, dt: number) {
    const g = this.game, p = g.player, e = x.foe;
    const alive = !!e && !e.dead && !e.gone;
    if (x.st === 'travel' || x.st === 'guard' || x.st === 'open' || x.st === 'split') {
      if (e && !alive && !x.d.lostAlly) { x.d.lostAlly = true; if (e.dead) g.toast(`${x.name}陨落了……遗府只剩你一人去开。`, 'warn'); }
      if (alive && e!.ally) this.follow(e!, dt);
      x.x = p.x; x.y = p.y;
    }
    if (x.st === 'travel') {
      if (Math.hypot(x.tx! - p.x, x.ty! - p.y) < 260) {
        const n = rint(1, 2);
        for (let i = 0; i < n; i++) {
          const b = g.combat.rollBeast(x.tx!, x.ty!, 0.25, { noFlee: true }); if (!b) continue;
          const m = new Enemy(b.def, x.tx! + rand(-110, 110), x.ty! + rand(-70, 70), b.realm, b.stage);
          m.aggro = true; m.hx = m.x; m.hy = m.y; m.tag = 'rx_guard';
          g.combat.enemies.push(m); x.foes.push(m);
        }
        x.st = x.foes.length ? 'guard' : 'open';
        if (x.foes.length) g.toast('遗府禁制被触动，守府的妖兽扑了出来！', 'warn');
      }
    } else if (x.st === 'guard') {
      if (x.foes.every((f) => f.dead || !g.combat.enemies.includes(f))) { x.st = 'open'; x.d.reopen = 0; }
    } else if (x.st === 'open') {
      if (!g.modal && Math.hypot(x.tx! - p.x, x.ty! - p.y) < 420 && g.time > (x.d.reopen ?? 0)) { x.st = 'split'; g.openDialog(this.vaultNode(x)); }
    } else if (x.st === 'split') {
      if (!g.modal) { x.st = 'open'; x.d.reopen = g.time + 8; }
    } else if (x.st === 'fight') {
      if (!e || e.dead) x.done = true;
      else if (Math.hypot(e.x - p.x, e.y - p.y) > 3200) { x.done = true; g.toast(`${x.name}带着遗府的宝物远遁而去。`, 'warn'); }
    }
  }
  private vaultNode(x: Scam): DNode {
    const g = this.game, e = x.foe, tier = clamp(g.hero.realm, 0, 4);
    if (!e || e.dead || e.gone || !e.ally) {
      const got = loot(g, tier, 1.6, { scroll: 0.45, art: 0.45 }); x.done = true;
      return { speaker: '遗府', mood: 'mystic', text: `禁制轰然洞开。同伴已不在了，石台上的宝物尽归你一人：\n\n${got.join('、') || '几块灵石'}`, options: [{ label: '（收起宝物）', act: () => null }] };
    }
    const opts: DOpt[] = [
      { label: '「说好的，五五分账。」', tone: 'gold', act: () => {
        if (!x.scam) {
          const got = loot(g, tier, 1, { scroll: 0.4, art: 0.4 }); this.dismiss(x); x.done = true;
          return { speaker: x.name, look: e.look, text: `「道友果然信人。」${x.name}收起他那一份，拱手作别，化作一道遁光去了。\n\n你分得：${got.join('、') || '一些灵石'}`, options: [{ label: '（拱手还礼）', act: () => null }] };
        }
        return this.betray(x, '你刚伸手去取玉匣，');
      } },
      { label: '「道友先挑。」', act: () => {
        if (!x.scam) {
          const got = loot(g, tier, 1.2, { scroll: 0.4, art: 0.4 }); this.dismiss(x); x.done = true;
          return { speaker: x.name, look: e.look, text: `「道友厚道！」${x.name}只挑了一卷玉简，余下的都推给了你。\n\n你得到：${got.join('、') || '一些灵石'}`, options: [{ label: '（拱手还礼）', act: () => null }] };
        }
        this.dismiss(x); x.done = true;
        this.learn('partner', `散修${x.name}约你同探遗府，开宝时卷了宝物遁走`);
        return { speaker: x.name, look: e.look, mood: 'danger', text: `${x.name}一把抄起玉匣，袖中一枚阴雷炸开，遁光一闪已在百丈之外——\n\n「多谢道友替我破阵！后会无期！」`, options: [{ label: '（……）', act: () => null }] };
      } },
    ];
    if (x.d.read && x.scam) opts.push({ label: '（早已看穿）喝破他的图谋，先发制人', tone: 'gold', act: () => {
      this.turn(e); e.hp = Math.round(e.hp * 0.7); x.st = 'fight'; x.d.treasure = true; g.ws.rep = clamp(g.ws.rep + 1, -100, 100);
      return { speaker: x.name, look: e.look, mood: 'danger', text: `「开了宝箱，就送我上路——是这么打算的吧？」\n\n${x.name}脸色骤变，袖中扣着的阴雷还没来得及发出，你已先一步出手！`, options: [{ label: '动手', tone: 'bad', act: () => null }] };
    } });
    opts.push({ label: '先下手为强', tone: 'bad', hint: '若他是真心分账，你就成了背信弃义之人', act: () => this.strikeFirst(x) });
    return {
      speaker: x.name, title: this.title(x), look: e.look, mood: 'mystic',
      text: `禁制轰然洞开。石台上宝光氤氲——一只玉匣、几卷玉简，还有一枚隐隐透着灵压的法器。\n\n${x.name}的目光落在宝物上，笑道：「道友，说好的，五五分账。」${this.mindLine(x)}${this.flaw(x)}`,
      options: opts,
    };
  }
  private dismiss(x: Scam) { const e = x.foe; if (!e) return; this.game.combat.dismissAllies((o) => o === e); e.gone = true; }
  private turn(e: Enemy) {
    const c = this.game.combat as any;
    c.allies = (c.allies ?? []).filter((o: Enemy) => o !== e);
    e.ally = false; e.aggro = true; e.busy = false; e.tgP = true; e.hunt = true; e.leaveAt = undefined;
    if (!c.enemies.includes(e)) c.enemies.push(e);
  }
  private betray(x: Scam, lead: string): DNode {
    const g = this.game, e = x.foe!;
    this.turn(e); x.st = 'fight'; x.d.treasure = true;
    let amb = '';
    if (x.pers === 'ruthless' || Math.random() < 0.35) {
      const a = this.human(e.x + rand(-260, 260), e.y + rand(-200, 200), x.realm, x.stage - 2, `${x.name}的同伙`, x.pers === 'ruthless');
      a.aggro = true; a.hunt = true; g.combat.enemies.push(a); x.foes.push(a);
      amb = '\n\n树后又闪出一道人影——原来他早有埋伏！';
    }
    this.learn('partner', `与散修${x.name}同探遗府，开宝时被他暗算`);
    return { speaker: x.name, title: this.title(x), look: e.look, mood: 'danger', text: `${lead}${x.name}脸上的笑意一点点褪去。\n\n「……道友，这宝物，还是我一人独得吧。」${amb}`, options: [{ label: '果然……', tone: 'bad', act: () => null }] };
  }
  private strikeFirst(x: Scam): DNode {
    const g = this.game, e = x.foe!;
    this.turn(e); x.st = 'fight'; x.d.treasure = true;
    if (x.scam) {
      g.ws.rep = clamp(g.ws.rep + 1, -100, 100);
      return { speaker: x.name, look: e.look, mood: 'danger', text: `你骤然出手！${x.name}仓促招架，袖中滑出一枚早就扣着的阴雷——原来他也没打算分账。`, options: [{ label: '果然', tone: 'bad', act: () => null }] };
    }
    g.ws.rep = clamp(g.ws.rep - 6, -100, 100);
    this.F.rx_betray = (this.F.rx_betray ?? 0) + 1;
    g.pursuit?.maybe(`你在遗府中暗算同伴${x.name}之事传了出去`, 0.5, 1);
    g.news(`有人在遗府中背信弃义，暗算了同探的散修${x.name}。`, 'rumor');
    return { speaker: x.name, look: e.look, mood: 'danger', text: `${x.name}满脸错愕：「你……！」\n\n（他是真心与你分账的。背信弃义的名声，从此跟着你了。）`, options: [{ label: '……', tone: 'bad', act: () => null }] };
  }

  // ================================================================ #3 借刀杀人
  private knifeHook(x: Scam): DNode {
    return {
      speaker: x.d.liar, title: this.title(x), look: x.npc?.look, mood: 'danger',
      text: `「道友……救命！」${x.d.liar}踉跄扑到你面前，满身血污：\n\n「${x.d.dirTxt}有个魔修，叫${x.name}——他杀了我师兄，夺了我们${x.d.sect}的灵药……求道友主持公道！事成之后，在下奉上 ${x.d.reward} 灵石！」${this.mindLine(x)}${this.flaw(x)}`,
      options: [
        { label: '「我去会会他。」', tone: 'gold', act: () => { x.st = 'go'; this.game.toast(`${x.d.liar}所指的「魔修」${x.name}在${x.d.dirTxt}（地图上标「魔」）。`, 'warn'); return null; } },
        { label: '（神识细探）', act: () => this.probe(x, () => this.knifeHook(x)) },
        { label: '「此事与我无关。」', act: () => { this.release(x); return null; } },
      ],
    };
  }
  private liarWait(x: Scam): DNode {
    return { speaker: x.d.liar, title: this.title(x), look: x.npc?.look, text: `「道友，那魔头就在${x.d.dirTxt}……在下在此恭候佳音。」${this.flaw(x)}`, options: [
      { label: '（神识细探）', act: () => this.probe(x, () => this.liarWait(x)) },
      { label: '「这事我不管了。」', act: () => { this.release(x); return null; } },
      { label: '（离开）', act: () => null },
    ] };
  }
  private knifeTick(x: Scam) {
    const g = this.game, p = g.player, e = x.foe;
    if (!e || (!e.dead && !g.combat.enemies.includes(e))) { x.done = true; return; }
    if (e.dead) { x.done = true; return; }
    // 骗子：你一走远，他就没影了
    if (x.scam && x.npc && x.st !== 'approach' && x.st !== 'talk' && x.st !== 'idle' && Math.hypot(x.npc.x - p.x, x.npc.y - p.y) > g.senseRadius * 1.1) { x.npc = undefined; x.d.liarGone = true; }
    if (x.npc) { x.x = x.npc.x; x.y = x.npc.y; } else { x.x = e.x; x.y = e.y; }
    if (x.st === 'go') {
      if (!e.busy) { x.st = 'fight'; return; }      // 你先动了手
      if (Math.hypot(e.x - p.x, e.y - p.y) < 330 && !g.modal && g.time > (x.d.reopen ?? 0)) { x.st = 'confront'; g.openDialog(this.targetNode(x)); }
    } else if (x.st === 'confront') {
      if (!g.modal) { if (e.busy) { x.st = 'go'; x.d.reopen = g.time + 8; } else x.st = 'fight'; }
    }
  }
  private wake(e: Enemy) { e.busy = false; e.aggro = true; e.hunt = true; }
  private targetNode(x: Scam): DNode {
    const g = this.game, e = x.foe!;
    if (!x.scam) {
      this.wake(e);
      return { speaker: x.name, title: `${realmName(e.realm, e.stage)} · 魔道`, look: e.look, mood: 'danger', text: `${x.name}缓缓转身，周身黑气翻涌：\n\n「又一个来送死的？${x.d.liar}那小子倒是会找帮手。」`, options: [{ label: '动手', tone: 'bad', act: () => null }] };
    }
    const read = R.readLevel(g.hero.realm, { realm: e.realm, pers: 'righteous' }, this.supOn({ x: e.x, y: e.y, realm: e.realm })) > 0;
    const mind = read ? `\n\n【神识 · 真心】「又是那姓${x.d.liar.slice(0, 1)}的……我何曾害过人。」` : '';
    return {
      speaker: x.name, title: `${realmName(e.realm, e.stage)} · ${x.d.sect}`, look: e.look, mood: 'mystic',
      text: `${x.name}见你来势不善，却没有拔剑，只是苦笑一声：\n\n「你是……${x.d.liar}请来的？他夺我灵药不成，倒反咬我是魔修。道友若不信，尽管出手——我${x.name}行得正，坐得端。」${mind}`,
      options: [
        { label: `动手（信${x.d.liar}的话）`, tone: 'bad', act: () => { this.wake(e); x.st = 'fight'; return null; } },
        { label: `回去找${x.d.liar}对质`, act: () => this.knifeBack(x) },
        { label: '（神识细探）', act: () => ({ speaker: '神识', mood: 'mystic', text: read ? `${x.name}心底一片坦荡，只有一句：「又是那姓${x.d.liar.slice(0, 1)}的……」` : `${x.name}气息沉稳，你看不出深浅。（你的修为压不住他）`, options: [{ label: '……', act: () => this.targetNode(x) }] }) },
        { label: '离开', act: () => { this.release(x); return null; } },
      ],
    };
  }
  private knifeBack(x: Scam): DNode {
    const g = this.game;
    this.release(x);
    g.ws.rep = clamp(g.ws.rep + 1, -100, 100);
    this.learn('knife', `${x.d.liar}挑唆你去杀散修${x.name}，被你回头对质识破`);
    return { speaker: x.name, look: x.foe?.look, text: `你收起法器，转身折回去找${x.d.liar}——\n\n原地早已不见人影。地上那摊血迹，凑近一闻，是鸡血。\n\n${x.name}远远朝你一拱手：「多谢道友明察。」`, options: [{ label: '（好险）', act: () => null }] };
  }
  private release(x: Scam) { const g = this.game; if (x.foe && !x.foe.dead && x.foe.busy) g.combat.enemies = g.combat.enemies.filter((o) => o !== x.foe); x.done = true; }
  private knifeKilled(x: Scam) {
    const g = this.game, h = g.hero, where = g.nearbyLocation()?.name ?? '荒野';
    x.done = true;
    if (x.scam) {
      g.ws.rep = clamp(g.ws.rep - 8, -100, 100);
      const got = loot(g, clamp(x.foe?.realm ?? 1, 0, 4), 0.6);
      this.learn('knife', `听信${x.d.liar}一面之词，错杀了散修${x.name}`);
      g.pursuit?.maybe(`${x.name}的同门查到了凶手`, 0.75, 1);
      g.news(`${x.d.sect}弟子${x.name}在${where}遇害，据说凶手是受人挑唆。`, 'rumor');
      g.openDialog({ speaker: x.name, title: '遗物', mood: 'danger', text: `你在${x.name}的储物袋里翻到一块${x.d.sect}的身份玉牌、一封没寄出的家书——\n\n「……待我从${x.d.liar}手里讨回那株灵药，便回山看望师父……」\n\n他根本不是魔修。\n\n远处山梁上，${x.d.liar}的身影一闪而没。你成了他手里的刀。${got.length ? '\n\n（储物袋里还有：' + got.join('、') + '）' : ''}`, options: [{ label: '（攥紧了玉牌）', act: () => null }] });
    } else {
      const fee = x.d.reward; C.addItem(h, 'mat_lingshi', fee); g.ws.rep = clamp(g.ws.rep + 3, -100, 100);
      g.openDialog({ speaker: x.d.liar, look: x.npc?.look, text: `「多谢道友替我师兄报仇！」${x.d.liar}远远赶来，含泪拜倒，奉上 ${fee} 灵石。\n\n（这一回，他说的是真话。）`, options: [{ label: '（扶他起来）', act: () => null }] });
    }
  }

  // ================================================================ #5 夺舍老魔
  private possessHook(x: Scam): DNode {
    const h = this.game.hero;
    return {
      speaker: x.name, title: `${realmName(x.realm, x.stage)} · 重伤垂危`, look: x.npc?.look, mood: 'mystic',
      text: `那人勉强抬起头，嘴角溢血：「小友……留步……老夫遭仇家暗算，经脉尽断……能否……渡一口灵力给老夫，稳住心脉……老夫必有厚报……」\n\n（这是一位${REALMS[x.realm].name}期的前辈，却已油尽灯枯。）${this.mindLine(x)}${this.flaw(x)}`,
      options: [
        { label: '渡一口灵力给他', tone: 'gold', act: () => this.possessTouch(x) },
        { label: '只喂他一颗疗伤丹', disabled: C.bagCount(h, 'pill_liaoshang') <= 0, hint: '不渡灵力，不碰他的经脉', act: () => this.possessPill(x) },
        { label: '（神识细探）', act: () => this.probe(x, () => this.possessHook(x)) },
        { label: '补他一刀', tone: 'bad', hint: '若他真是落难的前辈，你就成了趁人之危的凶徒', act: () => this.possessKill(x) },
        { label: '离开', act: () => { x.done = true; if (x.scam && Math.random() < 0.5) this.game.news('听说有个散修在荒野救了个重伤老者，回来后性情大变，连自家道侣都不认得了。', 'rumor'); return null; } },
      ],
    };
  }
  private resistChance(x: Scam) {
    const h = this.game.hero, mine = C.heroStats(h).sense;
    const S = REALMS[x.realm].sense, his = (S[clamp(x.stage, 0, S.length - 1)] ?? mine) * 0.55;   // 残魂只剩五成神识
    return clamp(0.2 + (mine / Math.max(1, his) - 0.7) * 0.6 + 0.12 * this.yl('possess'), 0.08, 0.9);
  }
  private possessTouch(x: Scam): DNode {
    const g = this.game, h = g.hero, tier = clamp(x.realm, 1, 4);
    x.done = true;
    if (!x.scam) {
      const got = loot(g, tier, 1.2, { scroll: 0.5, art: 0.4 });
      g.ws.rep = clamp(g.ws.rep + 2, -100, 100);
      g.news(`一位${REALMS[x.realm].name}期前辈在荒野遇险，得一后辈渡气相救。`, 'rumor');
      return { speaker: x.name, mood: 'love', text: `你的灵力缓缓渡入他的经脉。良久，他长出一口气，脸上浮起一丝血色。\n\n「好……好孩子。老夫${x.name}，这份人情记下了。」他从袖中取出几样东西塞进你手里，化作一道遁光而去。\n\n得到：${got.join('、') || '一些灵石'}`, options: [{ label: '（目送他远去）', act: () => null }] };
    }
    if (Math.random() < this.resistChance(x)) {
      const got = loot(g, tier, 1.5, { scroll: 0.5, art: 0.5 });
      h.senseBonus = (h.senseBonus ?? 0) + 0.01;
      this.learn('possess', `救一个「重伤的前辈」时险遭夺舍，凭神识硬生生挡了回去`);
      return { speaker: x.name, mood: 'danger', text: `灵力刚一相接，一股阴冷的神念便顺着经脉倒灌而入——\n\n你识海中灵光一震，那缕神念惨叫一声缩了回去。老者的肉身软软倒下，再无声息：那具身体，早就是个空壳了。\n\n你从他身上搜出：${got.join('、') || '一些灵石'}。神识经此一役，略有精进。`, options: [{ label: '（冷汗涔涔）', act: () => null }] };
    }
    return { speaker: x.name, mood: 'danger', text: `灵力刚一相接，那老者枯瘦的手掌忽然像铁钳一样扣住你的脉门！\n\n「桀桀……好一具年轻的肉身！」\n\n一缕黑气顺着你的经脉直冲识海——是夺舍！`, options: [{ label: '守住识海！', tone: 'bad', act: () => { this.mindWar(x); return null; } }] };
  }
  /** 识海之战：复用序章墨大夫夺舍那一套（story.startFight · mind） */
  private mindWar(x: Scam) {
    const g = this.game, h = g.hero, S = g.story as any;
    const tier = clamp(x.realm, 1, 4);
    S.startFight([{ foes: [{ def: 'canhun', name: `${x.name}元神`, realm: clamp(h.realm, 1, 5), stage: clamp(h.stage + 3, 0, 12), hp: 2.2, boss: true }] }], {
      mind: true,
      onWin: () => {
        const got = loot(g, tier, 2, { scroll: 0.6, art: 0.5 });
        h.senseBonus = (h.senseBonus ?? 0) + 0.02;
        this.learn('possess', `被「重伤的前辈」${x.name}诱去渡气，险被夺舍，于识海中斩灭其元神`);
        g.openDialog({ speaker: '', title: '识海之战 · 胜', mood: 'mystic', text: `那缕元神在你识海里尖啸着溃散。\n\n你睁开眼，那具老朽的肉身已化作一捧飞灰，只剩一只储物袋：${got.join('、') || '几块灵石'}\n\n神识经此一役，精进不少。`, options: [{ label: '（长出一口气）', act: () => null }] });
        g.updateUI(true);
      },
      retry: () => { /* 夺舍没有重来 */ },
      lose: () => {
        const ds = rint(30, 50);
        this.addDs(ds, '神魂受创');
        h.lifeLost += 5; h.exp = Math.max(0, h.exp - Math.floor(C.need(h) * 0.15));
        this.learn('possess', `被「重伤的前辈」${x.name}诱去渡气，险被夺舍——拼死逐出识海，神魂大伤`);
        g.openDialog({ speaker: '', title: '识海之战 · 败', mood: 'danger', text: `……\n\n你拼尽最后一丝神念，将那缕元神逐出识海。它尖啸着散入荒野，而你神魂大伤——\n\n道伤 ${ds} 日（修炼 -40%、法力上限 -20%）· 折损寿元五载 · 修为倒退。`, options: [{ label: '（冷汗涔涔）', act: () => null }] });
        g.updateUI(true);
      },
    });
  }
  private possessPill(x: Scam): DNode {
    const g = this.game, h = g.hero;
    C.removeItem(h, 'pill_liaoshang', 1); x.done = true;
    if (!x.scam) {
      const got = loot(g, clamp(x.realm, 1, 4), 0.6);
      return { speaker: x.name, text: `他服下丹药，气息稍稳：「多谢小友……这点东西，聊表心意。」\n\n得到：${got.join('、') || '一些灵石'}`, options: [{ label: '（拱手）', act: () => null }] };
    }
    this.learn('possess', `一个「重伤的前辈」求你渡气，你只喂了颗丹药，听见他嘟囔「可惜了这具好肉身」`);
    return { speaker: x.name, mood: 'danger', text: `他盯着你手里的疗伤丹，眼底凶光一闪即逝，终究咬牙吞下，挣扎着化作一缕黑烟遁去。\n\n风里飘来半句低语：「……可惜了这具好肉身。」`, options: [{ label: '（背后发凉）', act: () => null }] };
  }
  private possessKill(x: Scam): DNode {
    const g = this.game, tier = clamp(x.realm, 1, 4);
    x.done = true;
    if (!x.scam) {
      g.ws.rep = clamp(g.ws.rep - 10, -100, 100);
      g.pursuit?.maybe(`你趁人之危、杀害重伤前辈${x.name}之事传了出去`, 0.6, 1);
      g.news(`一位重伤的${REALMS[x.realm].name}期前辈在荒野被人趁危所害。`, 'rumor');
      const got = loot(g, tier, 0.8);
      return { speaker: '', mood: 'danger', text: `你一剑刺下。那人瞪大双眼，到死都没明白……\n\n（他是真的重伤垂危。你得了他的储物袋：${got.join('、') || '几块灵石'}，也得了一个洗不掉的名声。）`, options: [{ label: '……', tone: 'bad', act: () => null }] };
    }
    g.ws.rep = clamp(g.ws.rep + 2, -100, 100);
    const got = loot(g, tier, 1.5, { scroll: 0.5, art: 0.5 });
    this.learn('possess', '一剑斩了借尸苟活、伺机夺舍的老魔');
    return { speaker: '', mood: 'danger', text: `剑尖刚刺入半寸，那老者忽然暴起——一缕黑气从他天灵盖窜出，被你一剑斩散，发出凄厉的尖啸。\n\n原来是个借尸苟活的老魔。他的储物袋里有：${got.join('、') || '几块灵石'}`, options: [{ label: '（收剑）', act: () => null }] };
  }

  // ================================================================ #2 地摊假丹 / 假玉简
  private stallNode(x: Scam): DNode {
    const g = this.game, h = g.hero, it = itemDef(x.d.item), pill = it.type === 'pill';
    const ls = C.bagCount(h, 'mat_lingshi');
    const opts: DOpt[] = [
      { label: `买下（${x.d.price} 灵石）`, tone: 'gold', disabled: ls < x.d.price, act: () => {
        C.removeItem(h, 'mat_lingshi', x.d.price); C.addItem(h, it.id, 1);
        if (x.scam) { const hh = h as any; hh.fakes = hh.fakes ?? {}; hh.fakes[it.id] = (hh.fakes[it.id] ?? 0) + 1; }
        x.d.until = g.time + 6; audio.sfx('chime'); g.updateUI(true);
        return { speaker: x.name, look: x.npc?.look, text: `摊主麻利地把${it.name}包好塞给你：「道友好眼光！」\n\n（他收摊的动作，比摆摊快多了。）`, options: [{ label: '（收好）', act: () => null }] };
      } },
      { label: '（神识细查）', act: () => {
        if (x.d.probed == null) x.d.probed = this.readable(x) || (this.yl('stall') > 0 && Math.random() < R.flawChance(this.yl('stall')));
        const t = !x.d.probed ? '你神识扫过，只觉灵光盈盈，看不出什么名堂。（神识压不住摊主，或是阅历还浅）'
          : x.scam ? (pill ? '丹药表面的灵光浮而不实，像是一层染上去的色——底子是聚气丹。假货。' : '玉简里的神识烙印只录了前三层，后面一片混沌——残篇。')
          : '灵气内敛、纹理天成，竟是真货。';
        return { speaker: '神识', mood: 'mystic', text: t, options: [{ label: '……', act: () => this.stallNode(x) }] };
      } },
      { label: `请丹师掌眼（${x.d.fee} 灵石）`, disabled: ls < x.d.fee || x.d.verified, act: () => {
        C.removeItem(h, 'mat_lingshi', x.d.fee);
        if (x.scam) {
          x.done = true;
          this.learn('stall', `坊市地摊三折的「${it.name}」，一说请丹师掌眼，摊主就卷包袱跑了`);
          return { speaker: x.name, look: x.npc?.look, mood: 'danger', text: `你刚提出要去对面${pill ? '丹铺请丹师' : '书阁请执事'}掌眼，摊主脸色一变，一把抄起包袱：「不卖了不卖了！」——挤进人群不见了。`, options: [{ label: '（果然）', act: () => null }] };
        }
        x.d.verified = true;
        return { speaker: pill ? '丹师' : '执事', text: `${pill ? '丹师' : '执事'}端详良久，点头道：「确是真品。」\n\n摊主得意洋洋：「我就说嘛！」`, options: [{ label: '……', act: () => this.stallNode(x) }] };
      } },
      { label: '压价', disabled: !!x.d.haggled, act: () => {
        x.d.haggled = true;
        if (x.scam) { x.d.price = Math.max(5, Math.round(x.d.price * 0.6)); return { speaker: x.name, look: x.npc?.look, text: `「……成、成交！就这个价！」\n\n（他答应得太快了些。）`, options: [{ label: '……', act: () => this.stallNode(x) }] }; }
        return { speaker: x.name, look: x.npc?.look, text: '「道友说笑了，这已是血本价——不要拉倒。」', options: [{ label: '……', act: () => this.stallNode(x) }] };
      } },
      { label: '走开', act: () => null },
    ];
    return {
      speaker: x.name, title: `摊主 · ${realmName(1, x.stage)}`, look: x.npc?.look, mood: 'normal',
      text: `摊主四下瞄了一眼，压低声音：\n\n「道友识货——正宗的${it.name}！坊市里要价 ${it.price}，我这儿只要 ${x.d.price}。来路嘛……嘿嘿，道友就别问了。」${x.d.verified ? '\n\n（已请人掌过眼：是真货。）' : ''}${this.flaw(x)}`,
      options: opts,
    };
  }
  /** 储物袋里少了东西（被搜、被抢、卖掉）时，假货数跟着收 */
  syncFakes() {
    const h = this.game.hero as any, f = h.fakes; if (!f) return;
    for (const id in f) { const n = C.bagCount(h, id); if (f[id] > n) f[id] = n; if (f[id] <= 0) delete f[id]; }
  }
  /** 冲击大境界之前：服下去的丹里混着几颗假的？（真假混在一起，摸到哪颗算哪颗） */
  preBreak(pills: number): { n: number; text: string } {
    const g = this.game, h = g.hero as any;
    if (C.bottleneck(h) !== 'major') return { n: 0, text: '' };
    const mb = MAJOR_BREAKS[h.realm]; if (!mb?.item) return { n: 0, text: '' };
    this.syncFakes();
    const have = C.bagCount(h, mb.item), use = Math.min(pills, have, mb.maxItems), fk = h.fakes?.[mb.item] ?? 0;
    if (!use || !fk) return { n: 0, text: '' };
    let fakeLeft = fk, realLeft = have - fk, n = 0;
    for (let i = 0; i < use; i++) { if (Math.random() < fakeLeft / Math.max(1, fakeLeft + realLeft)) { n++; fakeLeft--; } else realLeft--; }
    if (!n) return { n: 0, text: '' };
    C.removeItem(h, mb.item, n); h.fakes[mb.item] = fk - n; this.syncFakes();
    const nm = itemDef(mb.item).name;
    this.learn('stall', `冲关时服下的${nm}里，有 ${n} 颗是染了色的聚气丹`);
    return { n, text: `服下${nm}的那一刻，你心头一沉——其中 ${n} 颗药力稀薄如水，竟是染了色的聚气丹！（成功率只按真丹计）` };
  }
  /** 服丹：假的只有聚气丹那点药力 */
  fakePill(id: string): boolean {
    const g = this.game, h = g.hero as any;
    this.syncFakes();
    const fk = h.fakes?.[id] ?? 0, d = itemDef(id);
    if (!fk || !d.pill) return false;
    if (Math.random() >= fk / Math.max(1, C.bagCount(h, id))) return false;
    C.removeItem(h, id, 1); h.fakes[id] = fk - 1; this.syncFakes();
    C.gainExp(h, Math.max(1, C.need(h) * 0.002), [], 'pill');
    this.learn('stall', `服下的「${d.name}」只有聚气丹的药力——染了色的假货`);
    g.toast(`丹药入腹，药力却稀薄如水——这颗「${d.name}」是染了色的聚气丹！`, 'warn');
    return true;
  }
  /** 参悟玉简：假的是残篇 */
  fakeScroll(id: string): boolean {
    const g = this.game, h = g.hero as any;
    this.syncFakes();
    const fk = h.fakes?.[id] ?? 0; if (!fk) return false;
    if (Math.random() >= fk / Math.max(1, C.bagCount(h, id))) return false;
    C.removeItem(h, id, 1); h.fakes[id] = fk - 1; this.syncFakes();
    C.wuTake(h, 0.004);
    const nm = itemDef(id).name;
    this.learn('stall', `花大价钱买的《${nm}》只录了前三层，后面尽是胡乱拼凑——残篇`);
    g.openDialog({ speaker: '', title: '残篇', mood: 'danger', text: `你凝神参悟《${nm}》，前三层倒还像模像样，再往下，尽是胡乱拼凑的字句，连灵力运转的路线都是断的——\n\n是残篇。`, options: [{ label: '（把玉简捏得粉碎）', act: () => null }] });
    g.updateUI(true);
    return true;
  }

  // ================================================================ 道伤
  addDs(days: number, why: string) {
    const h = this.game.hero as any;
    h.ds = Math.min(90, Math.max(0, h.ds ?? 0) + days);
    h.dsMax = Math.max(h.dsMax ?? 0, h.ds); h.dsWhy = why;
  }
  /** 疗伤丹 / 养魂丹能让道伤好得快些 */
  afterPill(id: string) {
    const g = this.game, h = g.hero as any;
    if (!(h.ds > 0)) return;
    const heal = id === 'pill_liaoshang' ? 1.5 : id === 'pill_yanghun' ? 12 : id === 'pill_butian' ? 90 : itemDef(id).pill?.hp ? 1 : 0;
    if (!heal) return;
    h.ds = Math.max(0, h.ds - heal);
    if (h.ds <= 0) { h.dsMax = 0; g.toast('受损的经脉终于接续如初——道伤痊愈！', 'good'); }
    else g.toast(`药力渗入受损的经脉，道伤稍愈（余 ${Math.ceil(h.ds)} 日）。`, 'good');
  }

  // ================================================================ 败北
  private killer(): Enemy | null {
    const g = this.game, c = g.combat as any, p = g.player;
    const lf = c.lastFoe as Enemy | undefined;
    if (lf && g.time - (c.lastFoeT ?? -99) < 12) return lf;
    let best: Enemy | null = null, bd = 1600;
    for (const e of c.enemies as Enemy[]) { if (e.dead || e.ally || !e.aggro) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  private keepFn() {
    const h = this.game.hero;
    const prot = new Set<string>([...(Object.values(h.equip ?? {}).filter(Boolean) as string[]), ...((h.hotbar ?? []).filter(Boolean) as string[])]);
    return (id: string) => id === 'mat_lingshi' || prot.has(id) || (itemDef(id)?.price ?? 0) <= 0;
  }
  /** 被打倒：看是谁干的（game.onPlayerDown 调用） */
  defeat() {
    const g = this.game, h = g.hero;
    const k = this.killer();
    const npc = k?.npcId ? g.npcs.byId.get(k.npcId) ?? null : null;
    const human = !!k && ((k.def as any)?.kind === 'human' || !!k.npcId || !!k.school);
    const evil = !!k && (!!(k.def as any)?.evil || npc?.faction === 'demon');
    const cls = R.classifyFoe(k ? { human, evil, grudge: npc?.grudge ?? 0, pursuer: !!(k.pursuer || k.wing) } : null);
    const name = k ? (k.name || k.def?.name || '来人') : '来人';
    for (const x of this.list) this.cleanup(x);
    this.list = []; this.despawnThief(this.F.rx_stolen ?? undefined);
    const lostExp = Math.floor(C.need(h) * C.INSIGHT * (cls === 'nemesis' ? 0.2 : 0.1));
    h.exp = Math.max(0, h.exp - lostExp);
    const cell = this.F.rx_cell as { items: R.Stack[]; ls: number } | null; this.F.rx_cell = null; this.cellGuards = [];
    // 魔修：小概率掳回洞府
    if (cls === 'demon' && !npc && g.day > (this.F.rx_capT ?? -999) + 60 && Math.random() < 0.25 && h.realm <= (k?.realm ?? 1) + 1) { this.captured(k!, lostExp); return; }
    const lines: string[] = [];
    let days = 3, ds = R.dsDays(cls);
    if (cls === 'beast') {
      const ls = C.bagCount(h, 'mat_lingshi'), lost: string[] = [];
      if (ls > 0) { const n = Math.ceil(ls * 0.1); C.removeItem(h, 'mat_lingshi', n); lost.push(`灵石 ${n}`); }
      const pool = h.bag.filter((b) => b.id !== 'mat_lingshi' && itemDef(b.id).type !== 'artifact' && itemDef(b.id).type !== 'scroll');
      for (let i = 0; i < 2 && pool.length; i++) {
        const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const n = Math.max(1, Math.floor(b.n * (0.3 + Math.random() * 0.3)));
        C.removeItem(h, b.id, n, b.age ?? 0); lost.push(`${itemDef(b.id).name} ${n}`);
      }
      this.syncFakes();
      lines.push(`你被${name}重创昏死。它只想吃肉——幸得过路的采药人把你拖回了城里。${lost.length ? `\n\n慌乱中遗失：${lost.join('、')}。` : ''}`);
    } else if (cls === 'nemesis') {
      const esc = h.bag.find((b) => itemDef(b.id).tal?.kind === 'escape');
      if (esc) {
        C.removeItem(h, esc.id, 1); ds = Math.round(ds * 0.6);
        const ls = C.bagCount(h, 'mat_lingshi'); if (ls > 0) C.removeItem(h, 'mat_lingshi', Math.ceil(ls * 0.1));
        lines.push(`${name}要补刀的那一刻，${itemDef(esc.id).name}自行激发——你遁地而走，捡回一条命。`);
      } else {
        if (h.stage > 0) h.stage--; h.exp = 0; h.lifeLost += 3; days = 7;
        lines.push(`${name}没打算留活口。补刀落下之前，你燃烧精血化作一道血光遁走——境界跌落一层，折寿三年。`);
        this.rob(k, npc, cls, name, lines, cell);
      }
    } else {
      this.rob(k, npc, cls, name, lines, cell);
    }
    this.addDs(ds, `败于${name}之手`);
    const town = g.wakeInTown(days);
    this.F.rx_falls = (this.F.rx_falls ?? 0) + 1;
    const tail = `\n\n—— 昏迷 ${days} 日，醒在${town?.name ?? '荒野'}。修为损失 ${lostExp}。\n道伤 ${ds} 日：修炼速度 -40%、法力上限 -20%（打坐闭关愈合更快；疗伤丹、养魂丹可加速）。`;
    g.toast(`你败于${name}之手……${days} 日后在${town?.name ?? '荒野'}醒来。`, 'warn');
    g.openDialog({ speaker: '', title: `败北 · ${R.FOE_CLASS_NAME[cls]}`, mood: 'danger', text: lines.join('\n\n') + tail, options: [{ label: '（咽下这口血）', act: () => null }] });
    audio.sfx('fail');
    g.updateUI(true);
  }
  /** 搜袋 + 「寻仇夺回」 */
  private rob(k: Enemy | null, npc: any, cls: R.FoeClass, name: string, lines: string[], extra?: { items: R.Stack[]; ls: number } | null) {
    const g = this.game, h = g.hero, p = g.player;
    const plan = R.stealPlan(h.bag, this.keepFn());
    for (const s of plan.take) C.removeItem(h, s.id, s.n, s.age ?? 0);
    const ls = C.bagCount(h, 'mat_lingshi'), lsT = Math.floor(ls * plan.frac);
    if (lsT > 0) C.removeItem(h, 'mat_lingshi', lsT);
    this.syncFakes();
    const take = [...plan.take, ...(extra?.items ?? [])], lsAll = lsT + (extra?.ls ?? 0);
    if (!take.length && !lsAll) { lines.push(`${name}搜遍了你的储物袋，啐了一口：「穷鬼。」`); return; }
    const old = this.F.rx_stolen as Stolen | null;
    const hide = npc ? { x: npc.x, y: npc.y } : this.hideout(p.x, p.y);
    const rec: Stolen = { name, realm: k?.realm ?? 1, stage: k?.stage ?? 0, npcId: npc?.id, map: npc ? (npc.map ?? 'tiannan') : ACTIVE_MAP, x: hide.x, y: hide.y, items: take, ls: lsAll, day: g.day, last: g.day, evil: !!(k?.def as any)?.evil, sold: 0, cls };
    this.F.rx_stolen = rec;
    const what = take.slice(0, 6).map((s) => `${itemDef(s.id).name}×${s.n}`).join('、') + (take.length > 6 ? ` 等 ${take.length} 样` : '');
    lines.push(`${name}搜走了你的储物袋：${lsAll ? `灵石 ${lsAll}${what ? '、' : ''}` : ''}${what}。`);
    lines.push(`醒来后听人说，那人往${dirName(hide.x - p.x, hide.y - p.y)}方去了——地图上标着「赃」。他会花你的钱、卖你的药，去晚了，东西就真没了。${old ? '\n（上一笔赃物的线索，也就此断了。）' : ''}`);
  }
  private hideout(px: number, py: number) {
    const g = this.game, T = g.terrain, R0 = g.senseRadius;
    for (let i = 0; i < 40; i++) {
      const an = Math.random() * TAU, d = R0 * rand(2.2, 4);
      const x = px + Math.cos(an) * d, y = py + Math.sin(an) * d * 0.85;
      if (x < 500 || y < 500 || x > WORLD_W - 500 || y > WORLD_H - 500) continue;
      if (!T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 300)) continue;
      return { x, y };
    }
    return { x: clamp(px + R0 * 2, 600, WORLD_W - 600), y: py };
  }
  private stolenTick() {
    const g = this.game, rec = this.F.rx_stolen as Stolen | null; if (!rec) return;
    if (rec.npcId) {
      const d = g.npcs.byId.get(rec.npcId);
      if (!d || !d.alive) { this.F.rx_stolen = null; g.toast(`劫走你储物袋的${rec.name}已经身死，赃物下落不明。`, 'warn'); return; }
      rec.x = d.x; rec.y = d.y; rec.map = d.map ?? 'tiannan';
    }
    const days = Math.floor(g.day - rec.last);
    if (days >= 1) { rec.last += days; const r = R.decayStolen(rec.items, rec.ls, days); rec.sold += r.sold.length; rec.items = r.items; rec.ls = r.ls; }
    if ((!rec.items.length && rec.ls <= 0) || g.day - rec.day > 120) { this.despawnThief(rec); this.F.rx_stolen = null; g.toast(`劫走你储物袋的${rec.name}早已把赃物挥霍一空，不知所踪。`, 'warn'); return; }
    if (rec.npcId || rec.map !== ACTIVE_MAP) return;
    const dist = Math.hypot(rec.x - g.player.x, rec.y - g.player.y);
    if (rec.spawned && this.thief.length && !this.thief[0].dead && !g.combat.enemies.includes(this.thief[0])) { this.thief = []; rec.spawned = false; }
    if (!rec.spawned && dist < g.senseRadius * 1.15 && !g.modal) this.spawnThief(rec);
    else if (rec.spawned && dist > g.senseRadius * 3) this.despawnThief(rec);
  }
  private spawnThief(rec: Stolen) {
    const g = this.game; this.thief = [];
    const lead = this.human(rec.x, rec.y, rec.realm, rec.stage, rec.name, !!rec.evil);
    lead.tag = 'rx_thief'; lead.boss = true; g.combat.enemies.push(lead); this.thief.push(lead);
    for (let i = 0; i < (rec.cls === 'demon' ? 2 : 1); i++) {
      const m = this.human(rec.x + rand(-120, 120), rec.y + rand(-90, 90), Math.max(1, rec.realm - (Math.random() < 0.6 ? 1 : 0)), rint(0, 8), rec.evil ? '魔修' : '劫修', !!rec.evil);
      g.combat.enemies.push(m); this.thief.push(m);
    }
    rec.spawned = true;
    g.toast(`神识中：劫走你储物袋的${rec.name}就在前面——夺回来！`, 'warn');
  }
  private despawnThief(rec?: Stolen) {
    const g = this.game, set = new Set(this.thief);
    if (set.size) g.combat.enemies = g.combat.enemies.filter((e) => !set.has(e) || e.aggro);
    this.thief = []; if (rec) rec.spawned = false;
  }
  private recover() {
    const g = this.game, h = g.hero, rec = this.F.rx_stolen as Stolen | null; if (!rec) return;
    for (const s of rec.items) C.addItem(h, s.id, s.n, s.age);
    if (rec.ls > 0) C.addItem(h, 'mat_lingshi', rec.ls);
    const back = rec.items.map((s) => `${itemDef(s.id).name}×${s.n}`).join('、');
    this.F.rx_stolen = null; this.thief = [];
    g.openDialog({ speaker: '', title: '寻仇夺回', mood: 'normal', text: `你从${rec.name}身上搜回了自己的东西：${rec.ls ? `灵石 ${rec.ls}${back ? '、' : ''}` : ''}${back || '……'}${rec.sold ? `\n\n（另有 ${rec.sold} 样早被他卖掉、用掉了，再也找不回来。）` : ''}`, options: [{ label: '（收好储物袋）', act: () => null }] });
    g.updateUI(true);
  }

  // ---------- 魔修掳人 ----------
  private captured(k: Enemy, lostExp: number) {
    const g = this.game, h = g.hero, p = g.player;
    const name = k.name || '魔修';
    const plan = R.stealPlan(h.bag, this.keepFn(), () => Math.random() * 0.3 + 0.7);
    for (const s of plan.take) C.removeItem(h, s.id, s.n, s.age ?? 0);
    const ls = C.bagCount(h, 'mat_lingshi'); if (ls > 0) C.removeItem(h, 'mat_lingshi', ls);
    this.syncFakes();
    this.F.rx_cell = { items: plan.take, ls, name, realm: k.realm, stage: k.stage };
    this.F.rx_capT = g.day;
    const spot = this.hideout(p.x, p.y);
    g.wakeAt(spot.x, spot.y, 5);
    const ds = R.dsDays('demon'); this.addDs(ds, `被${name}掳去，以血炼之法折磨`);
    g.openDialog(this.cellNode(name, lostExp, ds));
    audio.sfx('fail'); g.updateUI(true);
  }
  private cellNode(name: string, lostExp: number, ds: number): DNode {
    const g = this.game, h = g.hero;
    const sneak = clamp(0.4 + 0.02 * h.stage + 0.08 * this.ylAll(), 0.3, 0.85);
    return {
      speaker: '', title: '败北 · 魔修掳人', mood: 'danger',
      text: `……\n\n你在一处阴冷的石窟里醒来。手脚被缚灵索捆着，丹田里的法力被一道禁制封了大半。洞口传来${name}和同伙的说笑声：「……这小子灵根虽差，炼成血丹也够补一补……」\n\n你的储物袋，就扔在洞口的石台上。\n\n（修为损失 ${lostExp} · 道伤 ${ds} 日：修炼 -40%、法力上限 -20%）`,
      options: [
        { label: `潜行：磨断缚灵索，悄悄摸出去（约 ${Math.round(sneak * 100)}%）`, act: () => {
          if (Math.random() < sneak) { const got = this.recoverCell(0.6 + Math.random() * 0.4); return { speaker: '', title: '逃出生天', text: `你一点点磨断缚灵索，贴着石壁挪到洞口——看守正背对着你打盹。你抓起石台上的储物袋，一头扎进了夜色。\n\n摸回来的：${got}`, options: [{ label: '（头也不回）', act: () => null }] }; }
          this.cellFight(2, false);
          return { speaker: name, mood: 'danger', text: '脚下一块碎石滚落——「想跑？」\n\n两个看守堵住了洞口！你的储物袋就挂在其中一人腰间。', options: [{ label: '拼了！', tone: 'bad', act: () => null }] };
        } },
        { label: '爆发：燃起残余法力，硬闯出去', tone: 'bad', act: () => {
          this.cellFight(rint(2, 3), true);
          return { speaker: '', mood: 'danger', text: '你燃起丹田里残存的法力，一声长啸挣断缚灵索——\n\n石窟里的魔修全被惊动了！杀出去，储物袋就在他们身上。', options: [{ label: '杀！', tone: 'bad', act: () => null }] };
        } },
        { label: '装死，等他们放松警惕', act: () => {
          g.day += 10; this.addDs(12, '被血炼十日'); h.exp = Math.max(0, h.exp - Math.floor(C.need(h) * 0.1));
          const got = this.recoverCell(0.8);
          return { speaker: '', title: '十日之后', mood: 'danger', text: `你像死人一样躺了十天，任他们每日放一碗血。第十天夜里，看守喝得烂醉——你抓起储物袋，从后洞钻了出去。\n\n摸回来的：${got}\n\n（道伤又添十二日，修为再损一成）`, options: [{ label: '（咬牙离开）', act: () => null }] };
        } },
      ],
    };
  }
  private cellFight(n: number, burst: boolean) {
    const g = this.game, h = g.hero, p = g.player, cell = this.F.rx_cell;
    if (burst) { h.mp = Math.max(h.mp, 0.6); h.hp = Math.max(h.hp, 0.45); }
    this.cellGuards = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.4, 0.4);
      const e = this.human(p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 180, cell?.realm ?? h.realm, (cell?.stage ?? 2) - (i ? 2 : 0), i === 0 ? (cell?.name ?? '魔修') : '看守魔修', true);
      e.aggro = true; e.hunt = true; e.tag = 'rx_cell'; if (i === 0) e.boss = true;
      g.combat.enemies.push(e); this.cellGuards.push(e);
    }
    g.updateUI(true);
  }
  private recoverCell(frac: number): string {
    const g = this.game, h = g.hero, cell = this.F.rx_cell as { items: R.Stack[]; ls: number } | null; if (!cell) return '……';
    const back: string[] = []; let lost = 0;
    for (const s of cell.items) { if (Math.random() < frac) { C.addItem(h, s.id, s.n, s.age); back.push(`${itemDef(s.id).name}×${s.n}`); } else lost++; }
    const ls = Math.floor(cell.ls * frac); if (ls > 0) C.addItem(h, 'mat_lingshi', ls);
    this.F.rx_cell = null; this.cellGuards = [];
    g.updateUI(true);
    return `${ls ? `灵石 ${ls}${back.length ? '、' : ''}` : ''}${back.join('、') || '……'}${lost ? `（另有 ${lost} 样已被他们分掉了）` : ''}`;
  }

  // ================================================================ 战斗回调 / 地图 / 绘制
  onKill(e: Enemy) {
    if (e.tag === 'rx_thief' || (e.npcId && (this.F.rx_stolen as Stolen | null)?.npcId === e.npcId)) this.recover();
    if (e.tag === 'rx_cell' && this.cellGuards.length && this.cellGuards.every((o) => o.dead)) {
      const got = this.recoverCell(1);
      this.game.openDialog({ speaker: '', title: '杀出石窟', text: `最后一个看守倒下。你从他腰间扯回自己的储物袋：${got}`, options: [{ label: '（离开这鬼地方）', act: () => null }] });
    }
    for (const x of this.list) {
      if (x.foe !== e) continue;
      if (x.kind === 'partner') {
        if (x.d.treasure) { const got = loot(this.game, clamp(this.game.hero.realm, 0, 4), 2.2, { scroll: 0.5, art: 0.5 }); this.game.toast(`遗府的宝物连同${x.name}的储物袋落入你手：${got.join('、')}`, 'good'); }
        x.done = true;
      } else if (x.kind === 'knife') this.knifeKilled(x);
    }
  }
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    const rec = this.F.rx_stolen as Stolen | null;
    if (rec && rec.map === ACTIVE_MAP) out.push({ x: rec.x, y: rec.y, glyph: '赃', color: '#ff9a7a', ring: rec.npcId ? undefined : 420, name: `劫走你储物袋的${rec.name}` });
    for (const x of this.list) {
      if (x.kind === 'partner' && x.tx != null && (x.st === 'travel' || x.st === 'guard' || x.st === 'open' || x.st === 'split')) out.push({ x: x.tx, y: x.ty!, glyph: '府', color: '#ffd98a', ring: 260, name: `${x.name}所说的遗府` });
      if (x.kind === 'knife' && (x.st === 'go' || x.st === 'confront') && x.foe && !x.foe.dead) out.push({ x: x.foe.x, y: x.foe.y, glyph: '魔', color: '#e07a9a', ring: 300, name: `${x.d.liar}所指的「魔修」${x.name}` });
    }
    return out;
  }
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    const g = this.game, z = g.cam.zoom;
    for (const x of this.list) {
      if (x.kind === 'partner' && x.tx != null && (x.st === 'travel' || x.st === 'guard' || x.st === 'open' || x.st === 'split')) {
        const sx = x.tx, sy = x.ty!, open = x.st === 'open' || x.st === 'split';
        if (sx > view.left - 300 && sx < view.right + 300 && sy > view.top - 300 && sy < view.bottom + 300) out.push({ y: sy - 2, draw: (ctx) => this.drawVault(ctx, sx, sy, t, open) });
      }
      const n = x.npc; if (!n) continue;
      if (n.x < view.left - 600 || n.x > view.right + 600 || n.y < view.top - 600 || n.y > view.bottom + 400) continue;
      const v = g.life.vis(n); if (v <= 0.01) continue;
      if (x.kind === 'stall') out.push({ y: n.y - 3, draw: (ctx) => this.drawStall(ctx, n.x, n.y) });
      out.push({ y: n.y, draw: (ctx) => {
        ctx.save(); ctx.globalAlpha *= v; n.st.update(dt); drawCharacter(ctx, n.look, n.st, 1, dt); ctx.restore();
        this.tag(ctx, x, n, z);
        if (x.mind) { const fs = Math.max(11, 12.5 / Math.max(0.5, z)); drawMindBubble(ctx, n.x, n.y - 175 - fs * 0.6, x.mind.text, fs, Math.min(1, x.mind.t * 1.5) * v, x.mind.gold); }
      } });
    }
  }
  private tag(ctx: G, x: Scam, n: Npc, z: number) {
    if (this.focus !== x) return;
    const fs = Math.max(12, 14 / Math.max(0.5, z));
    ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)';
    const s = '【T】' + (x.kind === 'stall' ? '地摊' : x.kind === 'possess' ? '查看伤者' : '交谈');
    const y = n.y - 190 - (x.mind ? fs * 2.4 : 0);
    ctx.strokeText(s, n.x, y); ctx.fillStyle = '#fff0c8'; ctx.fillText(s, n.x, y); ctx.restore();
  }
  private drawVault(ctx: G, x: number, y: number, t: number, open: boolean) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,20,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 74, 22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a7266'; ctx.beginPath(); ctx.ellipse(x, y, 62, 18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#958c7c'; ctx.fillRect(x - 46, y - 26, 92, 26);
    ctx.beginPath(); ctx.ellipse(x, y - 26, 46, 13, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#5a4a36'; ctx.fillRect(x - 12, y - 40, 24, 14); ctx.fillStyle = '#c8a050'; ctx.fillRect(x - 12, y - 42, 24, 3);
    const k = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.globalCompositeOperation = 'lighter';
    if (!open) { ctx.strokeStyle = `rgba(150,200,255,${0.3 + 0.25 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 30, 70, 76, 0, Math.PI, TAU); ctx.stroke(); }
    const gr = ctx.createRadialGradient(x, y - 40, 2, x, y - 40, 64);
    gr.addColorStop(0, `rgba(255,230,150,${open ? 0.7 : 0.3 + 0.1 * k})`); gr.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 40, 64, 0, TAU); ctx.fill();
    ctx.restore();
  }
  private drawStall(ctx: G, x: number, y: number) {
    const ox = x + 48, oy = y + 6;
    ctx.save();
    ctx.fillStyle = 'rgba(30,24,16,0.2)'; ctx.beginPath(); ctx.ellipse(ox, oy + 4, 44, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(ox, oy, 40, 11, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#c84a3a', '#e0c050', '#5a8a5a'][i % 3]; ctx.beginPath(); ctx.arc(ox - 26 + i * 9, oy - 2 + (i % 2) * 3, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(ox + 16, oy - 12, 14, 8);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox + 36, oy); ctx.lineTo(ox + 36, oy - 72); ctx.stroke();
    ctx.fillStyle = 'rgba(240,230,200,0.95)'; ctx.fillRect(ox + 36, oy - 72, 16, 42);
    ctx.fillStyle = '#7a2a1a'; ctx.font = '11px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.fillText('灵', ox + 44, oy - 57); ctx.fillText('丹', ox + 44, oy - 41);
    ctx.restore();
  }
}
