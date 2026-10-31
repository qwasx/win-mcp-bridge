// 第十八步：会动的奇遇 —— 世界在你身边自己发生着事情
// - 劫道（交钱 / 虚张声势 / 报上名号 / 动手）；恶名在外时，赏金猎人上门
// - 渡劫：护法、趁劫出手、在旁观劫；没人管时，他可能渡劫失败，劫灰中留下遗物
// - 追杀：救人还是拦人？真相要事后才知道
// - 护送商队：途中两次伏击，丢下商队就算失败
// - 赌斗：押灵石切磋
// - 妖兽相争：鹬蚌相争，渔翁得利
// - 异宝出世：每隔一两百日，某处宝光冲天，各路修士闻讯而至
// - 坊市悬赏榜
import type { Game } from './game';
import { foeRealm, threatRealm } from './demog';
import { ACTIVE_MAP, WORLD_W, WORLD_H, LOCATIONS, WORLD_SCALE, locHere } from '../data/world';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { REALMS, realmName } from '../data/realms';
import type { DNode, DOpt } from './modal';
import type { Bounty } from './worldstate';
import { CharState, drawCharacter, randomLook, Look } from '../gfx/character';
import { loot, pickArt, dirName } from './sites';
import { audio } from './audio';
import { cultivator, newTeam, sectName, YUE_SECTS } from './melee';
import { Obtain } from './obtain';
import { GreatHunt } from './great';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const SURN = ['王', '李', '赵', '孙', '周', '吴', '郑', '冯', '陈', '韦', '马', '朱', '胡', '林', '何', '高', '罗', '梁', '宋', '唐', '许', '韩', '邓', '萧'];
const GIVEN = ['元', '无极', '天霸', '青', '不凡', '长风', '一刀', '玄', '寒', '万里', '千山', '铁手', '百川', '飞', '老怪', '三娘', '秋水', '冥'];
const rname = () => pick(SURN) + pick(GIVEN);

type HKind = 'robber' | 'tribul' | 'chase' | 'caravan' | 'wager' | 'beastfight';
interface Npc { look: Look; st: CharState; x: number; y: number }
interface Hap { id: number; kind: HKind; x: number; y: number; t: number; done: boolean; seen: boolean; foes: Enemy[]; npc?: Npc; npc2?: Npc; d: any }

export class Happen {
  game: Game;
  haps: Hap[] = [];
  focus: Hap | null = null; focusD = 1e9;
  heraldFocus = false;
  private nid = 1;
  private hapT = rand(25, 40);
  private chkT = 0;
  /** 第四十步：原著独门之物的获取（客卿之约、器物神通） */
  obtain: Obtain;
  /** 第四十步：大夺宝（元婴级） */
  great: GreatHunt;
  constructor(g: Game) { this.game = g; this.obtain = new Obtain(g); this.great = new GreatHunt(g); }
  reset() { this.haps = []; this.focus = null; }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game, p = g.player, R = g.senseRadius;
    this.haps = this.haps.filter((x) => {
      if (x.done) return false;
      const far = Math.hypot(x.x - p.x, x.y - p.y) > Math.max(5200, R * 3.6);
      if (far && x.kind !== 'caravan') { this.drop(x); return false; }
      if (g.time - x.t > 240 && !x.d.engaged) { this.drop(x); return false; }
      return true;
    });
    this.focus = null; this.focusD = 1e9;
    for (const x of this.haps) {
      const d = Math.hypot(x.x - p.x, x.y - p.y);
      if (!x.seen && d < R * 0.95) { x.seen = true; const s = this.seenText(x); if (s) g.toast(s, x.kind === 'robber' || x.kind === 'tribul' ? 'warn' : 'info'); }
      this.tick(x, dt, d);
      if (x.npc && !x.d.engaged && (x.kind === 'tribul' || x.kind === 'caravan' || x.kind === 'wager')) { const dn = Math.hypot(x.npc.x - p.x, x.npc.y - p.y); if (dn < 220 && dn < this.focusD) { this.focus = x; this.focusD = dn; } }
    }
    this.heraldTick(dt);
    this.bountyTick(dt);
    this.obtain.tick(dt);
    this.great.tick(dt);
    if (g.combat.safeAt(p.x, p.y) || p.sitting) return;
    this.hapT -= dt;
    if (this.hapT > 0 || this.haps.length >= 2) return;
    this.hapT = rand(26, 48);
    this.spawn();
  }
  private drop(x: Hap) { const g = this.game; g.combat.enemies = g.combat.enemies.filter((e) => !x.foes.includes(e) || e.aggro); }
  private seenText(x: Hap): string {
    const d = x.d;
    switch (x.kind) {
      case 'robber': return d.hunter ? '神识中：几道杀气腾腾的身影径直朝你而来——是冲你来的！' : '神识中：几个形迹可疑的修士正朝你这边围过来。';
      case 'tribul': return '神识中：乌云压顶，雷光翻滚——有人在此渡劫！';
      case 'chase': return '神识中：一道遁光仓皇奔逃，身后几人紧追不舍！';
      case 'caravan': return '神识中：一支凡人商队正在赶路。';
      case 'wager': return '神识中：一个年轻修士抱臂立在路中，似在等人比试。';
      case 'beastfight': return `神识中：一头${d.a}与一头${d.b}正在殊死相搏——鹬蚌相争？`;
    }
  }
  private place(minK = 1.05, maxK = 1.4, road = false): { x: number; y: number } | null {
    const g = this.game, p = g.player, T = g.terrain, R = g.senseRadius;
    for (let i = 0; i < 14; i++) {
      const an = Math.random() * TAU, d = R * rand(minK, maxK);
      const x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.85;
      if (x < 400 || y < 400 || x > WORLD_W - 400 || y > WORLD_H - 400) continue;
      if (!T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 160)) continue;
      if (road && !T.onRoad(x, y) && i < 10) continue;
      return { x, y };
    }
    return null;
  }
  private mkNpc(x: number, y: number, role: any): Npc { let s = Math.floor(Math.random() * 1e9); const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const st = new CharState(x, y); return { look: randomLook(rnd, role), st, x, y }; }
  private human(x: number, y: number, realm: number, stage: number, name: string, evil = true): Enemy {
    const def = realm >= 3 ? ENEMIES.jindan_mo ?? ENEMIES.zhujixiu : realm >= 2 ? ENEMIES.zhujixiu : ENEMIES.bandit;
    const e = new Enemy(evil ? def : (ENEMIES.zhujixiu ?? def), x, y, clamp(realm, 1, 5), clamp(stage, 0, REALMS[clamp(realm, 1, 5)].hp.length - 1));
    e.name = name; e.hx = x; e.hy = y;
    return e;
  }
  private spawn() {
    const g = this.game, h = g.hero, ws = g.ws;
    // 活世界：拦路的也得有个由头。没人有理由动你时，劫道的份量大幅下降（他们去拦别人的商旅了），
    //       真来了，问头一句话就会把缘由说清楚。
    const motive = (() => { try { return g.npcs.alive.robberMotive(); } catch { return null; } })();
    const robW = (ws.rep < -30 ? 34 : 20) * (motive ? 1 : 0.3);
    const w: [HKind, number][] = [['robber', robW], ['tribul', 10], ['chase', motive?.hunter ? 6 : 14], ['caravan', 11], ['wager', 11], ['beastfight', 16]];
    const tot = w.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, kind: HKind = 'robber';
    for (const [k, v] of w) { r -= v; if (r <= 0) { kind = k; break; } }
    const pos = this.place(1.08, 1.4, kind === 'caravan');
    if (!pos) return;
    const x: Hap = { id: this.nid++, kind, x: pos.x, y: pos.y, t: g.time, done: false, seen: false, foes: [], d: {} };
    const hr = h.realm, hs = h.stage;
    if (kind === 'robber') {
      // 第三十七步：劫修的境界看这一带的人口（不随你的境界水涨船高）；赏金猎人只有自认拿得下你的才会接活
      const hrs = ws.rep < -30 && Math.random() < 0.6 ? threatRealm(g, pos.x, pos.y, Math.max(1, hr), 0.35) : null;
      const hunter = !!hrs;
      x.d.hunter = hunter;
      x.d.why = motive?.why;
      const n = hunter ? rint(2, 3) : rint(1, 3);
      const lead = hrs ?? foeRealm(g, pos.x, pos.y, 'leader');
      void hs;
      for (let i = 0; i < n; i++) {
        const rs = i === 0 ? lead : hunter ? { realm: Math.max(1, lead.realm - (Math.random() < 0.6 ? 1 : 0)), stage: rint(0, 6) } : foeRealm(g, pos.x, pos.y, 'minion', Math.random, 1, lead.realm);
        const e = this.human(pos.x + rand(-80, 80), pos.y + rand(-60, 60), rs.realm, rs.stage, hunter ? (i === 0 ? '赏金猎人·' + rname() : '赏金猎人') : i === 0 ? '劫修头目' : '拦路劫修');
        e.busy = true; if (i === 0) { e.boss = hunter; if (hunter) e.maxHp = e.hp = Math.round(e.hp * 1.5); }
        g.combat.enemies.push(e); x.foes.push(e);
      }
    } else if (kind === 'tribul') {
      x.npc = this.mkNpc(pos.x, pos.y, 'cultivator'); x.npc.st.setAction('sit');
      x.d.name = rname(); x.d.realm = clamp(foeRealm(g, pos.x, pos.y, 'leader', Math.random, 1, 3).realm, 1, 3); x.d.end = g.time + 75; x.d.nextBolt = g.time + 2; x.d.pend = [];
    } else if (kind === 'chase') {
      const P = g.player; const dx = P.x - pos.x, dy = P.y - pos.y, dd = Math.hypot(dx, dy) || 1;
      x.npc = this.mkNpc(pos.x, pos.y, Math.random() < 0.3 ? 'female' : 'cultivator');
      x.d.dir = { x: dx / dd + rand(-0.25, 0.25), y: dy / dd + rand(-0.25, 0.25) }; x.d.evil = Math.random() < 0.4; x.d.name = rname();
      x.d.sect = pick(['清虚门', '掩月宗', '化刀坞', '天阙堡', '巨剑门', '灵兽山']);
      const n = rint(2, 3);
      // 被追的人与追兵的境界看当地；追兵领头的至少不弱于逃者
      const fr = foeRealm(g, pos.x, pos.y, 'rogue'); x.d.realm = fr.realm;
      for (let i = 0; i < n; i++) { const rs = i === 0 ? foeRealm(g, pos.x, pos.y, 'leader', Math.random, fr.realm) : foeRealm(g, pos.x, pos.y, 'minion', Math.random, 1, fr.realm + 1); const e = this.human(pos.x - x.d.dir.x * (300 + i * 60) + rand(-50, 50), pos.y - x.d.dir.y * (300 + i * 60) + rand(-50, 50), rs.realm, rs.stage, x.d.evil ? `${x.d.sect}执法弟子` : '追杀者', !x.d.evil); e.busy = true; g.combat.enemies.push(e); x.foes.push(e); }
    } else if (kind === 'caravan') {
      const T = g.terrain;
      let dir = { x: 1, y: 0 };
      for (let i = 0; i < 12; i++) { const a = Math.random() * TAU; const ex = pos.x + Math.cos(a) * 3000, ey = pos.y + Math.sin(a) * 3000 * 0.8; if (T.isLand(ex, ey) && T.walkFactor(ex, ey) > 0.3 && T.walkFactor((pos.x + ex) / 2, (pos.y + ey) / 2) > 0.3) { dir = { x: Math.cos(a), y: Math.sin(a) * 0.8 }; break; } }
      x.npc = this.mkNpc(pos.x, pos.y, 'merchant'); x.npc2 = this.mkNpc(pos.x - 90, pos.y + 10, 'farmer');
      x.d.dir = dir; x.d.hp = 1; x.d.prog = 0; x.d.len = 3000; x.d.sx = pos.x; x.d.sy = pos.y; x.d.waves = 0;
      x.d.reward = Math.round(60 * Math.pow(3, Math.max(0, hr - 1)) * rand(1, 1.6));
      x.d.town = pick(['青牛镇', '嘉元城', '太南谷', '天星城', '云梦山', '黑石镇']);
    } else if (kind === 'wager') {
      x.npc = this.mkNpc(pos.x, pos.y, Math.random() < 0.3 ? 'female' : 'cultivator');
      x.d.name = rname(); x.d.realm = hr; x.d.stage = clamp(hs + rint(-1, 2), 0, 12); x.d.stake = Math.round(50 * Math.pow(3, Math.max(0, hr - 1)));
    } else if (kind === 'beastfight') {
      const a = g.combat.rollBeast(pos.x, pos.y, 0.3, { noFlee: true }), b = g.combat.rollBeast(pos.x, pos.y, 0.3, { noFlee: true });
      if (!a || !b) return;
      const ea = new Enemy(a.def, pos.x - 70, pos.y, a.realm, a.stage), eb = new Enemy(b.def, pos.x + 70, pos.y, b.realm, b.stage);
      for (const e of [ea, eb]) { e.busy = true; e.hx = e.x; e.hy = e.y; g.combat.enemies.push(e); x.foes.push(e); }
      ea.facing = 1; eb.facing = -1; x.d.a = a.def.name; x.d.b = b.def.name; x.d.nt = g.time + 1;
    }
    this.haps.push(x);
  }

  // ------------------------------------------------------------ 推进
  private tick(x: Hap, dt: number, dist: number) {
    const g = this.game, p = g.player, h = g.hero;
    const alive = x.foes.filter((e) => !e.dead && g.combat.enemies.includes(e));
    switch (x.kind) {
      case 'robber': {
        if (!x.d.engaged) {
          for (const e of alive) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 230) this.walk(e, p.x, p.y, 150, dt); }
          const lead = alive[0];
          if (lead) { x.x = lead.x; x.y = lead.y; }
          if (lead && Math.hypot(lead.x - p.x, lead.y - p.y) < 280 && !g.modal) { x.d.engaged = true; g.openDialog(this.robberNode(x)); }
          if (alive.some((e) => !e.busy)) { x.d.engaged = true; for (const e of alive) { e.busy = false; e.aggro = true; } }
        }
        if (!alive.length) x.done = true;
        break;
      }
      case 'tribul': this.tribTick(x, dt, alive); break;
      case 'chase': this.chaseTick(x, dt, alive); break;
      case 'caravan': this.caravanTick(x, dt, alive); break;
      case 'wager': if (x.npc) { x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); } break;
      case 'beastfight': {
        const [a, b] = x.foes;
        if (!a || !b) { x.done = true; break; }
        if (a.dead || b.dead || !a.busy || !b.busy) {
          // 有人插手或分出胜负：都回归正常
          for (const e of x.foes) e.busy = false;
          if (!alive.length) x.done = true;
          break;
        }
        // 对峙、扑击
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        for (const [e, o] of [[a, b], [b, a]] as [Enemy, Enemy][]) {
          const want = mx + (e === a ? -1 : 1) * (e.anim.atk > 0.3 ? 30 : 75);
          e.x += (want - e.x) * Math.min(1, dt * 3); e.y += (my - e.y) * Math.min(1, dt * 2);
          e.facing = o.x > e.x ? 1 : -1; e.anim.atk = Math.max(0, e.anim.atk - dt * 2.5); e.anim.hit = Math.max(0, e.anim.hit - dt * 3); e.anim.move = 0.4; e.anim.phase += dt * 6;
        }
        if (g.time > x.d.nt) {
          x.d.nt = g.time + rand(0.8, 1.5);
          const [atk, def] = Math.random() < (a.atk / (a.atk + b.atk)) ? [a, b] : [b, a];
          atk.anim.atk = 1; def.anim.hit = 1;
          const dmg = def.maxHp * rand(0.07, 0.13) * clamp(Math.pow(1.6, atk.realm - def.realm), 0.3, 3);
          def.hp -= dmg;
          if (dist < g.senseRadius) { g.combat.texts.push({ x: def.x, y: def.y - 80, s: String(Math.round(dmg)), color: '#ffb0a0', t: 0, vy: -30 } as any); g.combat.vfx.push({ kind: 'flash', x: def.x, y: def.y - 30, r: 50, t: 0, dur: 0.25, color: '255,220,180' } as any); }
          if (def.hp <= 0) {
            def.hp = 0; def.dead = true; def.deathT = 0;
            atk.hp = Math.max(atk.hp, atk.maxHp * 0.12); atk.busy = false;
            const yd = 'mat_yaodan' + clamp(def.blv ?? 1, 1, 10);
            g.combat.dropLoot(def.x, def.y, yd, 1);
            if (dist < g.senseRadius * 1.2) g.toast(`${atk.def.name}咬断了${def.def.name}的喉咙！胜者也已遍体鳞伤（气血 ${Math.round(atk.hp / atk.maxHp * 100)}%）——地上还躺着一颗妖丹。`, 'warn');
          }
        }
        break;
      }
    }
  }
  private walk(e: Enemy, tx: number, ty: number, sp: number, dt: number) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, sp * dt / d);
    e.x += dx * k; e.y += dy * k; e.facing = dx > 0 ? 1 : -1;
    e.anim.move = 1; e.anim.phase += dt * sp / 18;
    if (e.cs) { e.cs.x = e.x; e.cs.y = e.y; e.cs.speed = sp; e.cs.vx = dx / d * sp; e.cs.vy = dy / d * sp; e.cs.faceToward(dx, dy, false); e.cs.setAction(sp > 200 ? 'run' : 'walk'); e.cs.update(dt); }
  }
  private walkNpc(n: Npc, tx: number, ty: number, sp: number, dt: number) {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 4) { n.st.speed = 0; n.st.setAction('idle'); return true; }
    const k = Math.min(1, sp * dt / d);
    n.x += dx * k; n.y += dy * k; n.st.x = n.x; n.st.y = n.y; n.st.speed = sp; n.st.vx = dx / d * sp; n.st.vy = dy / d * sp;
    n.st.faceToward(dx, dy, false); n.st.setAction(sp > 200 ? 'run' : 'walk');
    return false;
  }

  // 劫道
  private robberNode(x: Hap): DNode {
    const g = this.game, h = g.hero, ws = g.ws;
    const foes = x.foes.filter((e) => !e.dead);
    const lead = foes[0];
    const fight = () => { for (const e of foes) { e.busy = false; e.aggro = true; } return null; };
    if (x.d.hunter) {
      fight();
      const why = x.d.why ? `（${x.d.why}）\n\n` : '';
      return { speaker: lead?.name ?? '赏金猎人', title: realmName(lead?.realm ?? 1, lead?.stage ?? 0), mood: 'danger', text: `${why}「韩立？${pick(['正道七派悬赏你的人头', '你在外头杀的人太多了', '有人出了大价钱'])}——${Math.round(500 * Math.pow(3, h.realm - 1))}灵石。对不住了。」\n\n（赏金猎人只接自认拿得下的活。想让他们散了，得让记恨你的人息了念头，或让名声翻过篇去——按 Y 可查是谁在恨你、为何恨）`, options: [{ label: '来吧', tone: 'bad', act: () => null }] };
    }
    const lsHave = C.bagCount(h, 'mat_lingshi');
    const fee = Math.max(20, Math.round(lsHave * 0.2));
    const gap = (lead?.realm ?? 1) - h.realm;
    const famous = ws.rep >= 60, infamous = ws.rep <= -60;
    const bluff = clamp(0.35 - gap * 0.3 + (h.stage - (lead?.stage ?? 0)) * 0.03, 0.08, 0.85);
    // 第三十七步：劫修也看得出深浅——高出两个大境界的前辈，他们根本不敢拦
    if (gap <= -2 && !g.concealed) {
      const tip = Math.max(10, Math.round(lsHave * 0.02 + 15 * Math.pow(2.2, lead?.realm ?? 1)));
      const go = () => { for (const e of foes) g.combat.enemies = g.combat.enemies.filter((o) => o !== e); x.done = true; };
      return { speaker: lead?.name ?? '劫修', title: realmName(lead?.realm ?? 1, lead?.stage ?? 0), mood: 'danger', text: `那几人刚从树后闪出，神识往你身上一扫，脸色刷地白了。\n\n「前、前辈饶命！晚辈有眼无珠，冲撞了前辈法驾……」为首的扑通跪倒，双手捧上一只储物袋。`, options: [
        { label: `收下孝敬（${tip} 灵石），放他们滚`, tone: 'gold', act: () => { C.addItem(h, 'mat_lingshi', tip); go(); g.ws.rep = clamp(g.ws.rep - 1, -100, 100); return null; } },
        { label: '「滚吧。以后莫在此处害人。」', act: () => { go(); g.ws.rep = clamp(g.ws.rep + 2, -100, 100); return null; } },
        { label: '为民除害', tone: 'bad', act: () => { for (const e of foes) { e.busy = false; e.aggro = true; (e as any).provoked = true; } return null; } },
      ] };
    }
    const opts: DOpt[] = [];
    if (famous || infamous) opts.push({ label: `报上名号：「在下韩立。」`, tone: 'gold', act: () => {
      if (Math.random() < 0.9) {
        for (const e of foes) g.combat.enemies = g.combat.enemies.filter((o) => o !== e); x.done = true;
        const tip = Math.round(20 * Math.pow(3, h.realm - 1)); C.addItem(h, 'mat_lingshi', tip);
        return { speaker: lead?.name ?? '劫修', mood: 'danger', text: famous ? `「韩、韩立？！就是那个……」劫修头目脸色煞白，扑通一声跪下：「小的有眼不识泰山！这点孝敬，前辈千万收下！」\n\n他们留下 ${tip} 灵石，连滚带爬地跑了。` : `劫修们听到这个名字，脸色齐刷刷变了——魔头韩立，杀人不眨眼。\n\n他们扔下 ${tip} 灵石，作鸟兽散。`, options: [{ label: '……', act: () => null }] };
      }
      fight(); return { speaker: lead?.name ?? '劫修', text: '「韩立？没听说过！兄弟们，上！」', options: [{ label: '找死', tone: 'bad', act: () => null }] };
    } });
    opts.push({ label: `交出买路财（${fee} 灵石）`, disabled: lsHave < fee, act: () => { C.removeItem(h, 'mat_lingshi', fee); for (const e of foes) g.combat.enemies = g.combat.enemies.filter((o) => o !== e); x.done = true; return { speaker: lead?.name ?? '劫修', text: '「识时务者为俊杰！」他们掂了掂灵石袋，扬长而去。', options: [{ label: '……', act: () => null }] }; } });
    opts.push({ label: `虚张声势：「你们可知我师尊是谁？」（约 ${Math.round(bluff * 100)}%）`, act: () => {
      if (Math.random() < bluff) { for (const e of foes) g.combat.enemies = g.combat.enemies.filter((o) => o !== e); x.done = true; return { speaker: lead?.name ?? '劫修', text: '劫修头目狐疑地打量你半晌，终究不敢冒险，啐了一口：「算你走运！」', options: [{ label: '（擦一把冷汗）', act: () => null }] }; }
      fight(); return { speaker: lead?.name ?? '劫修', mood: 'danger', text: '「哈哈哈，唬谁呢！」——他们一拥而上！', options: [{ label: '只能动手了', tone: 'bad', act: () => null }] };
    } });
    opts.push({ label: '动手', tone: 'bad', act: fight });
    return { speaker: lead?.name ?? '劫修', title: `${foes.length} 人 · ${realmName(lead?.realm ?? 1, lead?.stage ?? 0)}`, mood: 'danger', text: `几个人一字排开，堵住了去路。为首的${lead?.name ?? '劫修'}抽出法器，阴恻恻地笑：\n\n「此路是我开……道友，留下买路财吧。」${gap > 0 ? '\n\n（对方修为高过你——硬拼凶多吉少）' : ''}`, options: opts };
  }

  // 渡劫
  private tribTick(x: Hap, _dt: number, alive: Enemy[]) {
    const g = this.game, p = g.player, d = x.d, n = x.npc;
    if (!n) { x.done = true; return; }
    n.st.update(0);
    const near = Math.hypot(n.x - p.x, n.y - p.y);
    // 劫雷：先示警，再落下
    if (!d.robbed && g.time > d.nextBolt && g.time < d.end) {
      d.nextBolt = g.time + rand(1.4, 2.6);
      const onPlayer = near < 520 && Math.random() < 0.3;
      const bx = onPlayer ? p.x + rand(-40, 40) : n.x + rand(-180, 180), by = onPlayer ? p.y + rand(-30, 30) : n.y + rand(-110, 110);
      if (near < g.senseRadius * 1.3) g.combat.vfx.push({ kind: 'warn', x: bx, y: by, r: 110, t: 0, dur: 0.7, color: '190,200,255' } as any);
      d.pend.push({ x: bx, y: by, t: g.time + 0.7 });
    }
    d.pend = d.pend.filter((b: any) => {
      if (g.time < b.t) return true;
      if (near < g.senseRadius * 1.4) { g.combat.vfx.push({ kind: 'strike', x: b.x, y: b.y, r: 100, t: 0, dur: 0.5, color: '190,200,255', fx: 'lightning', seed: Math.random() * 1e6 } as any); audio.sfx('thunder'); g.juice(0.03, 0.25); }
      if (Math.hypot(p.x - b.x, p.y - b.y) < 120) { const R = REALMS[clamp(d.realm + 1, 1, 5)]; g.combat.hitPlayer(R.atk[0] * 1.2, clamp(d.realm + 1, 1, 5), undefined, b.x, b.y); g.toast('劫雷不辨敌我！', 'warn'); }
      return false;
    });
    // 护法的波次
    if (d.engaged === 'guard' && !d.w2 && g.time > d.end - 35) { d.w2 = true; this.tribWave(x, 3); }
    if (g.time >= d.end && !d.over) {
      d.over = true;
      if (d.robbed) return;
      const P = g.player, h = g.hero;
      const fail = d.engaged === 'guard' ? alive.length > 0 : Math.random() < 0.38;
      g.combat.vfx.push({ kind: 'strike', x: n.x, y: n.y, r: 220, t: 0, dur: 0.8, color: '220,230,255', fx: 'lightning', seed: Math.random() * 1e6 } as any); audio.sfx('thunder'); g.juice(0.1, 0.8);
      if (fail) {
        x.npc = undefined;
        const ls = Math.round(80 * Math.pow(3, d.realm - 1)); g.combat.dropLoot(n.x, n.y, 'mat_lingshi', ls);
        const a = Math.random() < 0.45 ? pickArt(d.realm + 1, false) : null; if (a) g.combat.dropLoot(n.x, n.y, a, 1);
        g.news(`散修${d.name}渡劫失败，身死道消。`, 'rumor');
        if (Math.hypot(n.x - P.x, n.y - P.y) < g.senseRadius * 1.3) g.toast(`最后一道劫雷落下……${d.name}没能撑过去。焦土中，他的遗物散落一地。`, 'warn');
        x.done = true; return;
      }
      g.news(`散修${d.name}渡劫成功，晋入${REALMS[clamp(d.realm + 1, 1, 5)].name}。`, 'rumor');
      if (d.engaged === 'guard') {
        const got = loot(g, clamp(d.realm, 0, 4), 1.6, { scroll: 0.5, art: 0.35, map: 0.2 });
        g.ws.rep = clamp(g.ws.rep + 5, -100, 100);
        g.openDialog({ speaker: d.name, look: n.look, title: '渡劫成功', mood: 'mystic', text: `乌云散尽，一缕天光落在${d.name}身上。他睁开眼，周身气息已截然不同。\n\n「道友护法之恩，${d.name}没齿难忘。」他将一只储物袋双手奉上。\n\n获得：${got.join('、')}\n\n（正道声望 +5）`, options: [{ label: '道友客气', act: () => null }] });
      } else if (d.engaged === 'watch' && Math.hypot(n.x - P.x, n.y - P.y) < 800) {
        const m: C.Msg[] = []; C.gainExp(h, C.need(h) * C.INSIGHT * 0.08, m);
        g.toast('你在旁观完整场雷劫，对天地之威有了几分体悟。（修为 +8%）', 'good');
      } else if (Math.hypot(n.x - P.x, n.y - P.y) < g.senseRadius * 1.3) g.toast(`${d.name}渡劫成功，化作一道遁光冲天而去。`, 'info');
      x.done = true;
    }
  }
  private tribWave(x: Hap, n: number) {
    const g = this.game, h = g.hero, c = x.npc!, d = x.d; void h;
    for (let i = 0; i < n; i++) {
      const an = Math.random() * TAU;
      const evil = Math.random() < 0.5;
      const er = foeRealm(g, c.x, c.y, 'evil', Math.random, 1, Math.max(1, d.realm)); const e = evil ? this.human(c.x + Math.cos(an) * 420, c.y + Math.sin(an) * 300, er.realm, er.stage, '趁火打劫的邪修') : new Enemy(ENEMIES.yinhun, c.x + Math.cos(an) * 380, c.y + Math.sin(an) * 280, clamp(d.realm, 1, 4), rint(2, 8));
      if (!evil) e.name = '心魔所化';
      e.aggro = true; g.combat.enemies.push(e); x.foes.push(e);
    }
    g.toast('有东西趁着雷劫扑过来了——护住他！', 'warn');
  }
  private tribNode(x: Hap): DNode {
    const g = this.game, h = g.hero, d = x.d, n = x.npc!;
    const left = Math.max(0, Math.round(d.end - g.time));
    return { speaker: d.name, look: n.look, title: `${realmName(d.realm, REALMS[d.realm].stages.length - 1)} · 冲击${REALMS[clamp(d.realm + 1, 1, 5)].name}`, mood: 'danger', text: `${d.name}盘膝坐在焦黑的地上，头顶劫云翻滚，周身法器已被劈碎了两件。他咬牙看了你一眼，声音嘶哑：\n\n「道、道友……雷劫将尽，心魔已至……若肯为我护法，必有重谢……」\n\n（还剩约 ${left} 息）`, options: [
      { label: '为他护法', tone: 'good', act: () => { d.engaged = 'guard'; this.tribWave(x, 2); return null; } },
      { label: '趁他渡劫，取其储物袋', tone: 'bad', hint: '他此刻法力十不存一……声望大跌', act: () => {
        d.engaged = 'rob'; d.robbed = true; g.ws.rep = clamp(g.ws.rep - 12, -100, 100);
        const e = this.human(n.x, n.y, d.realm, REALMS[d.realm].stages.length - 1, `渡劫修士·${d.name}`);
        e.look = n.look; e.cs = new CharState(n.x, n.y); e.aggro = true; e.boss = true; e.hp = Math.round(e.maxHp * 0.45); e.tag = 'tribrob';
        g.combat.enemies.push(e); x.foes.push(e); x.npc = undefined; x.d.engaged = 'rob';
        g.news(`有人趁散修${d.name}渡劫时下了黑手。`, 'rumor');
        return { speaker: d.name, look: n.look, mood: 'danger', text: '「你——！」他眼中先是错愕，随即化为怨毒：「好，好！我便是死，也要拉你垫背！」', options: [{ label: '动手', tone: 'bad', act: () => null }] };
      } },
      { label: '在旁观劫，体悟天威', hint: '劫雷可能波及你', act: () => { d.engaged = 'watch'; return null; } },
      { label: '离开', act: () => { d.engaged = 'leave'; return null; } },
    ] };
  }

  // 追杀
  private chaseTick(x: Hap, dt: number, alive: Enemy[]) {
    const g = this.game, p = g.player, d = x.d, n = x.npc;
    if (n) { x.x = n.x; x.y = n.y; }
    if (!d.engaged) {
      if (!n) { x.done = true; return; }
      this.walkNpc(n, n.x + d.dir.x * 400, n.y + d.dir.y * 400, 230, dt); n.st.update(dt);
      for (const e of alive) if (e.busy) this.walk(e, n.x, n.y, 255, dt);
      if (Math.hypot(n.x - p.x, n.y - p.y) < 340 && !g.modal) { d.engaged = 'ask'; n.st.setAction('idle'); n.st.speed = 0; g.openDialog(this.chaseNode(x)); }
      if (alive.some((e) => !e.busy)) { d.engaged = 'help'; for (const e of alive) { e.busy = false; e.aggro = true; } }
      if (alive.some((e) => Math.hypot(e.x - n.x, e.y - n.y) < 50)) this.chaseCaught(x);
      if (!g.terrain.isLand(n.x, n.y)) x.done = true;
    } else if (d.engaged === 'help') {
      if (n) { n.st.setAction('idle'); n.st.speed = 0; n.st.update(dt); }
      if (!alive.length && !d.paid) {
        d.paid = true; const h = g.hero;
        if (!n) { x.done = true; return; }
        if (d.evil) {
          const ls = Math.round(100 * Math.pow(3, h.realm - 1)); C.addItem(h, 'mat_lingshi', ls); g.ws.rep = clamp(g.ws.rep - 4, -100, 100);
          g.openDialog({ speaker: d.name, look: n.look, mood: 'danger', text: `${d.name}长出一口气，忽然笑了：「多谢道友。实不相瞒，${d.sect}的镇派灵丹就在我怀里——这些灵石，算你的辛苦钱。」\n\n他化作一道血光遁走。你这才看清，地上那几具尸首穿的，正是${d.sect}的执法服。\n\n获得：灵石 ${ls}　（正道声望 -4）`, options: [{ label: '……', act: () => null }] });
        } else {
          const got = loot(g, clamp(h.realm, 0, 4), 1.2, { scroll: 0.35, art: 0.15, map: 0.2 }); g.ws.rep = clamp(g.ws.rep + 4, -100, 100);
          g.openDialog({ speaker: d.name, look: n.look, mood: 'mystic', text: `「我本是${d.sect}弟子，外出采药撞破了魔修的勾当，一路被追杀至此……若非道友，今日必死无疑。」\n\n他将储物袋中最好的东西都塞给了你。\n\n获得：${got.join('、')}　（正道声望 +4）`, options: [{ label: '举手之劳', act: () => null }] });
        }
        x.done = true;
      }
    } else if (d.engaged === 'stop') {
      for (const e of alive) if (e.busy) { e.anim.move = 0; if (e.cs) { e.cs.setAction('idle'); e.cs.update(dt); } }
      const fug = x.foes.find((e) => e.tag === 'fugitive');
      if (fug && fug.dead && !d.paid) {
        d.paid = true; const h = g.hero;
        const lead = alive[0];
        if (d.evil) { const ls = Math.round(150 * Math.pow(3, h.realm - 1)); C.addItem(h, 'mat_lingshi', ls); g.ws.rep = clamp(g.ws.rep + 5, -100, 100); g.openDialog({ speaker: lead?.name ?? '执法弟子', mood: 'mystic', text: `「多谢道友出手！这贼子盗了我${d.sect}的镇派灵丹，我等追了他三百里。」为首之人取回灵丹，又奉上谢礼。\n\n获得：灵石 ${ls}　（正道声望 +5）`, options: [{ label: '应该的', act: () => null }] }); }
        else { g.ws.rep = clamp(g.ws.rep - 6, -100, 100); g.openDialog({ speaker: lead?.name ?? '追杀者', mood: 'danger', text: `为首之人哈哈大笑：「多谢道友帮忙！这小子撞破了我们的好事，正愁追不上。」\n\n他们俯身搜走了尸首上的东西，扬长而去。你这才明白——自己帮错了人。\n\n（正道声望 -6）`, options: [{ label: '……', act: () => null }] }); }
        for (const e of alive) g.combat.enemies = g.combat.enemies.filter((o) => o !== e);
        x.done = true;
      }
    }
  }
  private chaseCaught(x: Hap) {
    const g = this.game, n = x.npc!, p = g.player;
    g.combat.dropLoot(n.x, n.y, 'mat_lingshi', Math.round(30 * Math.pow(3, g.hero.realm - 1)));
    if (Math.hypot(n.x - p.x, n.y - p.y) < g.senseRadius * 1.2) g.toast(`追兵赶上了${x.d.name}……一声惨叫后，林中归于寂静。`, 'warn');
    for (const e of x.foes) if (!e.dead) { e.busy = false; e.hx = e.x; e.hy = e.y; }
    x.npc = undefined; x.done = true;
  }
  private chaseNode(x: Hap): DNode {
    const g = this.game, d = x.d, n = x.npc!;
    const foes = x.foes.filter((e) => !e.dead);
    return { speaker: d.name, look: n.look, title: realmName(g.hero.realm, rint(1, 6)), mood: 'danger', text: `那人浑身是血，踉跄着扑到你面前：「道友救我！他们……他们要杀人灭口！」\n\n身后，${foes.length} 道身影已追到百丈之内，为首之人厉喝：「${d.evil ? `${d.sect}执法！此人盗我宗门至宝，旁人莫要插手！` : '不相干的人滚开！'}」`, options: [
      { label: '「道友莫慌，我来断后。」', tone: 'good', act: () => { d.engaged = 'help'; for (const e of foes) { e.busy = false; e.aggro = true; } return null; } },
      { label: '拦下他，交给追兵', tone: 'bad', act: () => {
        d.engaged = 'stop';
        const e = this.human(n.x, n.y, d.realm ?? 1, rint(2, 7), d.name); e.look = n.look; e.cs = new CharState(n.x, n.y); e.aggro = true; e.tag = 'fugitive';
        g.combat.enemies.push(e); x.foes.push(e); x.npc = undefined;
        return null;
      } },
      { label: '不管闲事', act: () => { d.engaged = 0; d.dir = { x: d.dir.x + rand(-0.3, 0.3), y: d.dir.y + rand(-0.3, 0.3) }; if (x.npc) x.npc.x += d.dir.x * 60; return null; } },
    ] };
  }

  // 护送商队
  private caravanTick(x: Hap, dt: number, alive: Enemy[]) {
    const g = this.game, p = g.player, d = x.d, n = x.npc!, n2 = x.npc2!;
    if (!n) { x.done = true; return; }
    n.st.update(dt); n2.st.update(dt);
    if (d.engaged !== 'go') { x.x = n.x; x.y = n.y; n.st.faceToward(p.x - n.x, p.y - n.y); return; }
    const cartX = n.x - d.dir.x * 70, cartY = n.y - d.dir.y * 70;
    x.x = cartX; x.y = cartY;
    const dp = Math.hypot(cartX - p.x, cartY - p.y);
    if (dp > 2600) { x.done = true; g.toast('你丢下了商队……护送失败。', 'warn'); this.drop(x); return; }
    if (dp > 1500 && !d.warned) { d.warned = true; g.toast('离商队太远了！再走远，护送就算失败。', 'warn'); }
    if (dp < 1200) d.warned = false;
    // 伏击
    const ambush = alive.filter((e) => e.tag === 'ambush');
    for (const e of ambush) {
      if (e.busy) {
        const de = Math.hypot(e.x - cartX, e.y - cartY);
        if (de > 90) this.walk(e, cartX, cartY, 160, dt); else { d.hp -= dt * 0.025; e.anim.atk = 0.5 + 0.5 * Math.sin(g.time * 6); }
        if (Math.hypot(e.x - p.x, e.y - p.y) < 420) { e.busy = false; e.aggro = true; }
      }
    }
    if (d.hp <= 0) { x.done = true; g.toast('商队被劫掠一空……护送失败。', 'warn'); g.news(`一支前往${d.town}的商队在途中遭劫。`, 'rumor'); return; }
    const blocked = ambush.some((e) => Math.hypot(e.x - cartX, e.y - cartY) < 700);
    if (!blocked) {
      const sp = 70; d.prog += sp * dt / d.len;
      const tx = d.sx + d.dir.x * d.len * d.prog, ty = d.sy + d.dir.y * d.len * d.prog;
      this.walkNpc(n, tx, ty, sp, dt); this.walkNpc(n2, tx - d.dir.x * 150 + 20, ty - d.dir.y * 150 + 14, sp, dt);
      d.wheel = (d.wheel ?? 0) + dt * sp / 18;
    } else { n.st.setAction('idle'); n.st.speed = 0; n2.st.setAction('idle'); n2.st.speed = 0; }
    for (const th of [0.3, 0.68]) if (d.prog > th && d.waves < (th < 0.5 ? 1 : 2)) {
      d.waves++;
      const beasts = Math.random() < 0.4;
      const k = rint(2, 3) + (d.waves - 1);
      for (let i = 0; i < k; i++) {
        const an = Math.atan2(d.dir.y, d.dir.x) + rand(-0.9, 0.9), dd = rand(500, 700);
        let e: Enemy;
        if (beasts) { const rb = g.combat.rollBeast(cartX, cartY, 0, { noFlee: true }); if (!rb) continue; e = new Enemy(rb.def, cartX + Math.cos(an) * dd, cartY + Math.sin(an) * dd, rb.realm, rb.stage); }
        else { const rs = foeRealm(g, cartX, cartY, i === 0 ? 'leader' : 'rogue'); e = this.human(cartX + Math.cos(an) * dd, cartY + Math.sin(an) * dd, rs.realm, rs.stage, '劫道山匪'); }
        e.busy = true; e.tag = 'ambush'; g.combat.enemies.push(e); x.foes.push(e);
      }
      g.toast(beasts ? '林中窜出一群妖兽，直扑商队！' : '「此路是我开！」——山匪从两侧杀出，直扑商队！', 'warn');
    }
    if (d.prog >= 1 && !d.paid) {
      d.paid = true; x.done = true;
      const h = g.hero; C.addItem(h, 'mat_lingshi', d.reward); g.ws.rep = clamp(g.ws.rep + 3, -100, 100);
      const bonus = d.hp > 0.8 && Math.random() < 0.5 ? (loot(g, clamp(h.realm - 1, 0, 4), 0.6, { scroll: 0.2, map: 0.15 })) : [];
      g.openDialog({ speaker: '商队掌柜', look: n.look, mood: 'mystic', text: `「到了到了！」掌柜抹着汗，把一袋灵石塞进你手里：「仙师一路辛苦！${d.hp > 0.8 ? '货物分毫未损，这点心意也请收下！' : '虽有些折损，总算保住了性命。'}」\n\n获得：灵石 ${d.reward}${bonus.length ? '、' + bonus.join('、') : ''}　（正道声望 +3）`, options: [{ label: '告辞', act: () => null }] });
    }
  }
  private caravanNode(x: Hap): DNode {
    const d = x.d, n = x.npc!;
    return { speaker: '商队掌柜', look: n.look, title: `前往${d.town}`, text: `「仙师留步！」一个胖胖的掌柜小跑过来，连连作揖：「小老儿要往${d.town}送一批货，这一路不太平，听说前头有山匪出没……仙师若肯护送一程，${d.reward} 灵石奉上！」\n\n（护送约十里。途中可能遭伏击；离商队太远即算失败）`, options: [
      { label: '护送商队', tone: 'good', act: () => { d.engaged = 'go'; this.game.toast('商队启程了。跟紧些。', 'info'); return null; } },
      { label: '没空', act: () => { x.done = true; return null; } },
    ] };
  }

  // 赌斗
  private wagerNode(x: Hap): DNode {
    const g = this.game, h = g.hero, d = x.d, n = x.npc!;
    const have = C.bagCount(h, 'mat_lingshi');
    const go = (stake: number) => (): DNode | null => {
      C.removeItem(h, 'mat_lingshi', stake); d.engaged = 'spar'; d.pot = stake;
      const e = this.human(n.x, n.y, d.realm, d.stage, d.name, false); e.look = n.look; e.cs = new CharState(n.x, n.y); e.spar = true; e.aggro = true; e.tag = 'wager';
      g.combat.enemies.push(e); x.foes.push(e); x.npc = undefined;
      g.toast(`赌斗开始！押注 ${stake} 灵石。（点到为止：一方气血降到一成半即分胜负）`, 'info');
      return null;
    };
    return { speaker: d.name, look: n.look, title: realmName(d.realm, d.stage), text: `${d.name}拦在路中，下巴微抬：「道友看着面生。可敢与我赌斗一场？${d.stake} 灵石为注，点到为止。」${d.stage > h.stage ? '\n\n（他的修为比你高出一截）' : ''}`, options: [
      { label: `应战（押 ${d.stake}）`, disabled: have < d.stake, tone: 'gold', act: go(d.stake) },
      { label: `加注到 ${d.stake * 3}`, disabled: have < d.stake * 3, hint: '赢了三倍奉还', act: go(d.stake * 3) },
      { label: '没兴趣', act: () => { x.done = true; return { speaker: d.name, look: n.look, text: '「哼，胆小鬼。」', options: [{ label: '……', act: () => null }] }; } },
    ] };
  }
  onSpar(e: Enemy, won: boolean): boolean {
    if (e.tag !== 'wager') return false;
    const x = this.haps.find((h0) => h0.foes.includes(e)); if (!x) return false;
    const g = this.game, h = g.hero, d = x.d;
    x.done = true;
    if (won) { C.addItem(h, 'mat_lingshi', d.pot * 2); const bonus = Math.random() < 0.3 ? g.combat.randomScroll(Math.min(4, h.realm)) : null; if (bonus) C.addItem(h, bonus, 1); g.openDialog({ speaker: d.name, look: e.look, text: `${d.name}收起法器，愣了半晌，终于拱手：「……服了。」\n\n赢得：灵石 ${d.pot * 2}${bonus ? `\n他又掏出一枚玉简：「这门法术我练不明白，送你了。」获得 ${itemDef(bonus).name}` : ''}`, options: [{ label: '承让', act: () => null }] }); }
    else g.openDialog({ speaker: d.name, look: e.look, text: `${d.name}收起法器，掂了掂赢来的灵石：「承让。道友回去再练几年吧。」`, options: [{ label: '……', act: () => null }] });
    return true;
  }
  onKill(e: Enemy) {
    const g = this.game, h = g.hero;
    if (e.tag === 'tribrob') {
      const got = loot(g, clamp(e.realm, 0, 4), 2, { scroll: 0.5, art: 0.5, map: 0.2 });
      g.toast(`${e.name}的储物袋落入你手：${got.join('、')}`, 'good');
      g.pursuit.maybe(`趁人渡劫行凶之事传了出去`, 0.5, 1);
    }
    if (e.tag?.startsWith('herald')) this.heraldKill(e);
    if (e.tag?.startsWith('bounty:')) this.bountyKill(e);
    this.obtain.onKill(e);
    this.great.onKill(e);
    void h;
  }
  interact(): boolean {
    const x = this.focus; if (!x || !x.npc) return false;
    const g = this.game;
    if (x.kind === 'tribul' && !x.d.engaged) { g.openDialog(this.tribNode(x)); return true; }
    if (x.kind === 'caravan' && !x.d.engaged) { g.openDialog(this.caravanNode(x)); return true; }
    if (x.kind === 'wager' && !x.d.engaged) { g.openDialog(this.wagerNode(x)); return true; }
    return false;
  }

  // ------------------------------------------------------------ 异宝出世
  private heraldTick(dt: number) {
    const g = this.game, f = g.ws.flags as any, p = g.player;
    this.chkT -= dt; if (this.chkT > 0) return; this.chkT = 0.5;
    f.heraldNext ??= g.day + rand(120, 220);
    const hd = f.herald as { map: string; x: number; y: number; day: number; tier: number; done?: boolean; spawned?: boolean; rival: string } | undefined;
    if (hd && !hd.done && g.day > hd.day + 45) { hd.done = true; g.news(`异宝被${hd.rival}夺走，据说他已闭关炼化。`, 'rumor'); }
    if ((!hd || hd.done) && g.day >= f.heraldNext && !g.combat.safeAt(p.x, p.y)) {
      f.heraldNext = g.day + rand(200, 400);
      const T = g.terrain;
      for (let i = 0; i < 30; i++) {
        const an = Math.random() * TAU, d = rand(5000, 10000);
        const x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.8;
        if (x < 800 || y < 800 || x > WORLD_W - 800 || y > WORLD_H - 800 || !T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 600)) continue;
        const tier = clamp(Math.round(g.combat.dangerCalc(x, y).d) + 1, 1, 5);
        f.herald = { map: ACTIVE_MAP, x, y, day: g.day, tier, rival: rname() };
        g.news(`${dirName(x - p.x, y - p.y)}方宝光冲天，异宝出世！各路修士正蜂拥而去。`, 'rumor');
        g.toast(`远处${dirName(x - p.x, y - p.y)}方一道宝光直冲云霄——异宝出世！（地图上已标出，四十余日内有效）`, 'good');
        g.juice(0.04, 0.4);
        break;
      }
      return;
    }
    if (!hd || hd.done || hd.map !== ACTIVE_MAP) { this.heraldFocus = false; return; }
    const d = Math.hypot(hd.x - p.x, hd.y - p.y);
    if (!hd.spawned && d < 1700) {
      hd.spawned = true;
      const rb = g.combat.rollBeast(hd.x, hd.y, 1, { noFlee: true });
      if (rb) { const e = new Enemy(rb.def, hd.x + 60, hd.y + 30, rb.realm, rb.stage); e.name = rb.def.name + '·镇宝'; e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 3); e.hx = hd.x; e.hy = hd.y; e.tag = 'herald:guard'; e.team = newTeam('herald:beast'); e.aggro = true; g.combat.enemies.push(e); }
      // 第三十九步·混战：两三路人马各为其主——领头的带着同伙，另有一两个独来独往的散修；彼此见面就打，也打镇宝妖兽，也打你
      const nGroups = rint(2, 3);
      for (let gi = 0; gi < nGroups; gi++) {
        const team = newTeam('herald'), lead = gi === 0, base = Math.random() * TAU, n = lead ? rint(2, 3) : rint(1, 2);
        const sch = ACTIVE_MAP === 'luanxing' ? pick(['xinggong', 'jiyin', 'sanxiu', 'jiexiu', 'sanxiu']) : ACTIVE_MAP === 'dajin' ? pick(['taiyi', 'tianmo', 'huayi', 'sanxiu', 'jiexiu']) : pick(['sanxiu', 'jiexiu', 'guiling', 'hehuan', ...YUE_SECTS]);
        for (let i = 0; i < n; i++) {
          const an = base + rand(-0.4, 0.4), R = rand(480, 640);
          const rs = foeRealm(g, hd.x, hd.y, lead && i === 0 ? 'leader' : 'rogue');
          const nm = lead && i === 0 ? hd.rival : i === 0 ? `${sectName(sch)}${pick(['修士', '散人', '道人'])}` : `${sectName(sch)}同伙`;
          const e = cultivator(hd.x + Math.cos(an) * R, hd.y + Math.sin(an) * R * 0.75, rs.realm, rs.stage, sch, nm);
          e.tag = 'herald:rival'; e.team = team; e.aggro = true; e.hx = hd.x; e.hy = hd.y;
          if (lead && i === 0) e.boss = true;
          g.combat.enemies.push(e);
        }
      }
      g.toast(`宝光之下早已杀成一团——镇宝妖兽、${nGroups}路争宝的修士，彼此见人就打。（名牌两侧的色签标明各路人马）`, 'warn');
    }
    const guardAlive = g.combat.enemies.some((e) => e.tag === 'herald:guard' && !e.dead);
    this.heraldFocus = hd.spawned === true && !guardAlive && d < 200;
    // 第三十九步：镇宝兽一倒，争宝的人会抢先去收宝——收满八息便带宝遁走；打断他（击杀 / 打退）就还有机会
    if (hd.spawned && !guardAlive && !this.heraldFocus) {
      let taker: Enemy | null = null, bd = 260;
      for (const e of g.combat.enemies) if (!e.dead && e.tag === 'herald:rival' && !e.cast) { const dd = Math.hypot(e.x - hd.x, e.y - hd.y); if (dd < bd) { bd = dd; taker = e; } }
      for (const e of g.combat.enemies) if (!e.dead && e.tag === 'herald:rival') { e.hx = hd.x; e.hy = hd.y; }
      const H = hd as any;
      if (taker) {
        if (H.taker !== taker.id) { H.taker = taker.id; H.seize = 0; g.toast(`${taker.name}扑到宝光前，开始收取异宝！——快去打断他！`, 'warn'); }
        H.seize = (H.seize ?? 0) + 0.5;
        g.combat.texts.push({ x: taker.x, y: taker.y - 150, s: `收宝 ${Math.min(8, Math.floor(H.seize))}/8`, color: '#ffe080', t: 0, vy: -10 });
        if (H.seize >= 8) {
          hd.done = true; this.heraldFocus = false; H.taker = undefined;
          g.combat.vfx.push({ kind: 'blinkfx', x: taker.x, y: taker.y, r: 90, t: 0, dur: 0.6, color: '255,230,140' } as any);
          taker.gone = true;
          g.news(`异宝被${taker.name}抢先夺走，此人当场遁去。`, 'rumor');
          g.toast(`${taker.name}收起异宝，化作一道遁光远去——异宝被人抢走了。`, 'warn');
        }
      } else if (H.taker !== undefined) { H.taker = undefined; H.seize = 0; }
    }
  }
  private heraldKill(e: Enemy) { if (e.tag === 'herald:guard') this.game.toast(e.npcKill ? `镇宝妖兽被${e.killer?.name ?? '旁人'}斩杀！争宝的人正扑向宝光——抢在他们前面（T）！` : '镇宝妖兽伏诛！宝光就在眼前——上前取宝（T）。', e.npcKill ? 'warn' : 'good'); }
  /** 第三十九步：死于旁人之手（混战） */
  onNpcKill(e: Enemy) { if (e.tag?.startsWith('herald')) this.heraldKill(e); this.obtain.onKill(e); this.great.onKill(e); }
  heraldInteract(): boolean {
    const g = this.game, f = g.ws.flags as any, hd = f.herald, h = g.hero;
    if (!this.heraldFocus || !hd) return false;
    g.openDialog({ speaker: '异宝', mood: 'mystic', text: '宝光中心，一件物事悬浮半空，缓缓旋转，周遭灵气如潮水般涌向它。', options: [{ label: '收取异宝', tone: 'gold', act: () => {
      hd.done = true; this.heraldFocus = false;
      const a = pickArt(hd.tier + 1, hd.tier >= 3 && Math.random() < 0.35) ?? pickArt(hd.tier, false);
      if (a) C.addItem(h, a, 1);
      const got = loot(g, clamp(hd.tier, 0, 4), 2, { scroll: 0.5, map: 0.25 });
      g.news(`韩立夺得出世异宝${a ? `【${itemDef(a).name}】` : ''}！`, 'personal');
      g.pursuit.maybe('夺宝的消息不胫而走', 0.55, 1);
      g.juice(0.12, 0.9);
      return { speaker: '异宝', title: '异宝入手', mood: 'mystic', text: `你一把握住——宝光骤然收敛，没入掌心。\n\n获得：${a ? `【${itemDef(a).name}】、` : ''}${got.join('、')}\n\n（夺宝的消息很快就会传开）`, options: [{ label: '走', act: () => null }] };
    } }, { label: '离开', act: () => null }] });
    return true;
  }

  // ------------------------------------------------------------ 悬赏
  boardNode(townId: string, townName: string): DNode {
    const g = this.game, ws = g.ws, h = g.hero;
    ws.bounties ??= [];
    const month = Math.floor(g.day / 30);
    const mine = ws.bounties.filter((b) => !b.done && b.until > g.day);
    const offers = this.offers(townId, month).filter((o) => !ws.bounties.some((b) => b.id === o.id));
    const opts: DOpt[] = [];
    for (const b of mine) opts.push({ label: `【已接】${b.name}（${realmName(b.realm, b.stage)}）· ${b.map === ACTIVE_MAP ? this.dirTxt(b) : '别的地域'} · 剩 ${Math.ceil(b.until - g.day)} 日`, disabled: true, act: () => null });
    for (const o of offers) opts.push({ label: `${o.name}（${realmName(o.realm, o.stage)}）· 赏 ${o.reward} 灵石`, tone: o.realm > h.realm ? 'bad' : undefined, disabled: mine.length >= 3, hint: mine.length >= 3 ? '最多同时接三份' : o.realm > h.realm ? '境界高于你' : this.dirTxt(o), act: () => { ws.bounties.push({ ...o }); g.toast(`接下悬赏：${o.name}。（地图上已标出大致位置）`, 'good'); return this.boardNode(townId, townName); } });
    opts.push({ label: '离开', act: () => null });
    return { speaker: `${townName} · 悬赏榜`, title: `本月悬赏（已接 ${mine.length}/3）`, text: '木榜上贴满了告示，有的墨迹未干，有的早已泛黄。赏金由坊市担保，目标伏诛时自动结付。', options: opts };
  }
  private dirTxt(b: { x: number; y: number }) { const p = this.game.player; return `${dirName(b.x - p.x, b.y - p.y)}方约 ${Math.max(1, Math.round(Math.hypot(b.x - p.x, b.y - p.y) / 260))} 里`; }
  private offers(townId: string, month: number): Bounty[] {
    const g = this.game, h = g.hero, T = g.terrain;
    const l = locHere(townId); if (!l) return [];
    let s = (month * 7919 + townId.length * 104729 + townId.charCodeAt(0) * 31) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const out: Bounty[] = [];
    for (let i = 0; i < 3; i++) {
      let x = 0, y = 0, ok = false;
      for (let k = 0; k < 20 && !ok; k++) { const an = rnd() * TAU, d = 4000 + rnd() * 8000; x = l.x * WORLD_SCALE + Math.cos(an) * d; y = l.y * WORLD_SCALE + Math.sin(an) * d * 0.8; ok = x > 600 && y > 600 && x < WORLD_W - 600 && y < WORLD_H - 600 && T.isLand(x, y) && T.walkFactor(x, y) > 0.3 && !T.inLocZone(x, y, 400); }
      if (!ok) continue;
      const fr = foeRealm(g, x, y, rnd() < 0.3 ? 'boss' : 'leader', rnd); const realm = clamp(fr.realm, 1, 4), stage = Math.min(fr.stage, realm >= 2 ? 2 : 12);
      const beast = rnd() < 0.45;
      const name = beast ? pick(['食人', '凶', '血眼', '独角', '白毛', '断尾']) + '妖兽' : `${pick(['血手', '鬼影', '毒心', '黑煞', '夺命', '剥皮'])}${pick(SURN)}${pick(['三', '老怪', '魔', '狼', '书生', '婆婆'])}`;
      out.push({ id: `${townId}:${month}:${i}`, town: townId, map: ACTIVE_MAP, name, def: beast ? 'beast' : (realm >= 3 ? 'jindan_mo' : 'moxiu'), realm, stage, x, y, reward: Math.round(150 * Math.pow(3, realm - 1) * (1 + stage * 0.08)), until: g.day + 150 });
    }
    return out;
  }
  private bountyTick(_dt: number) {
    const g = this.game, p = g.player, R = g.senseRadius;
    for (const b of g.ws.bounties ?? []) {
      if (b.done || b.map !== ACTIVE_MAP || b.spawned || b.until < g.day) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) > R * 1.3) continue;
      b.spawned = true;
      let e: Enemy | null = null;
      if (b.def === 'beast') { const rb = g.combat.rollBeast(b.x, b.y, 0.5, { noFlee: true }); if (rb) e = new Enemy(rb.def, b.x, b.y, b.realm, clamp(b.stage, 0, 2)); }
      else { const def = ENEMIES[b.def] ?? ENEMIES.moxiu; e = new Enemy(def, b.x, b.y, b.realm, b.stage); for (let i = 0; i < 2; i++) { const m = new Enemy(ENEMIES.moxiu, b.x + rand(-160, 160), b.y + rand(-100, 100), Math.max(1, b.realm - 1), rint(2, 8)); m.name = b.name + '的爪牙'; m.hx = m.x; m.hy = m.y; g.combat.enemies.push(m); } }
      if (!e) continue;
      e.name = b.name; e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 2.2); e.hx = b.x; e.hy = b.y; e.tag = 'bounty:' + b.id;
      g.combat.enemies.push(e);
      g.toast(`神识中：悬赏目标「${b.name}」就在附近！`, 'warn');
    }
    // 离开后可再次刷出
    for (const b of g.ws.bounties ?? []) if (b.spawned && !b.done && b.map === ACTIVE_MAP && Math.hypot(b.x - p.x, b.y - p.y) > R * 3 + 2000 && !g.combat.enemies.some((e) => e.tag === 'bounty:' + b.id && !e.dead)) b.spawned = false;
  }
  private bountyKill(e: Enemy) {
    const g = this.game, id = e.tag!.slice(7);
    const b = g.ws.bounties.find((x) => x.id === id); if (!b || b.done) return;
    b.done = true; C.addItem(g.hero, 'mat_lingshi', b.reward); g.ws.rep = clamp(g.ws.rep + 3, -100, 100);
    g.news(`悬赏目标「${b.name}」伏诛，出手的是韩立。`, 'personal');
    g.toast(`悬赏了结！赏金 ${b.reward} 灵石已由坊市传送而来。（正道声望 +3）`, 'good');
  }

  // ------------------------------------------------------------ 地图标记
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const g = this.game, out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    const hd = (g.ws.flags as any).herald;
    if (hd && !hd.done && hd.map === ACTIVE_MAP) out.push({ x: hd.x, y: hd.y, glyph: '宝', color: '#ffe080', name: '小夺宝·异宝出世' });
    for (const b of g.ws.bounties ?? []) if (!b.done && b.map === ACTIVE_MAP && b.until > g.day) out.push({ x: b.x, y: b.y, glyph: '赏', color: '#ff7a6a', ring: 700, name: '悬赏：' + b.name });
    out.push(...this.obtain.marks());
    out.push(...this.great.marks());
    return out;
  }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
    const g = this.game;
    for (const x of this.haps) {
      if (x.x < view.left - 800 || x.x > view.right + 800 || x.y < view.top - 900 || x.y > view.bottom + 400) continue;
      const v = g.life.vis(x); if (v <= 0.01) continue;
      if (x.kind === 'tribul' && x.npc) {
        const n = x.npc;
        out.push({ y: n.y - 1, draw: (ctx) => this.drawTrib(ctx, n.x, n.y, v, t, x.d.end - g.time) });
        out.push({ y: n.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; n.st.update(dt); drawCharacter(ctx, n.look, n.st, 1, dt); ctx.restore(); this.tag(ctx, x, n); } });
      } else if (x.kind === 'caravan' && x.npc) {
        const n = x.npc, n2 = x.npc2!, d = x.d;
        const cx = n.x - d.dir.x * 70, cy = n.y - d.dir.y * 70;
        out.push({ y: cy, draw: (ctx) => this.drawCart(ctx, cx, cy, d.dir.x, v, d.wheel ?? 0, d.engaged === 'go' ? d.hp : 1) });
        out.push({ y: n.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; drawCharacter(ctx, n.look, n.st, 1, dt); ctx.restore(); this.tag(ctx, x, n); } });
        out.push({ y: n2.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; drawCharacter(ctx, n2.look, n2.st, 1, dt); ctx.restore(); } });
      } else if (x.npc) {
        const n = x.npc;
        out.push({ y: n.y, draw: (ctx) => { ctx.save(); ctx.globalAlpha *= v; if (x.kind !== 'chase') n.st.update(dt); drawCharacter(ctx, n.look, n.st, 1, dt); ctx.restore(); this.tag(ctx, x, n); } });
      }
    }
    // 异宝光柱
    const hd = (g.ws.flags as any).herald;
    if (hd && !hd.done && hd.map === ACTIVE_MAP && hd.x > view.left - 400 && hd.x < view.right + 400 && hd.y > view.top - 200 && hd.y < view.bottom + 1400) {
      const v = Math.max(0.35, g.life.vis(hd));
      out.push({ y: hd.y, draw: (ctx) => this.drawHerald(ctx, hd.x, hd.y, v, t) });
    }
    // 大夺宝霞光
    const gs = this.great.st();
    if (gs && !gs.done && gs.map === ACTIVE_MAP && gs.x > view.left - 600 && gs.x < view.right + 600 && gs.y > view.top - 300 && gs.y < view.bottom + 2000) {
      const v = Math.max(0.4, g.life.vis(gs));
      out.push({ y: gs.y, draw: (ctx) => this.great.draw(ctx, v, t) });
    }
  }
  private tag(ctx: G, x: Hap, n: Npc) {
    if (this.focus !== x) return;
    const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z));
    ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)';
    const s = '【T】' + (x.kind === 'tribul' ? '渡劫' : x.kind === 'caravan' ? '商队' : '交谈');
    ctx.strokeText(s, n.x, n.y - 190); ctx.fillStyle = '#fff0c8'; ctx.fillText(s, n.x, n.y - 190); ctx.restore();
  }
  private drawTrib(ctx: G, x: number, y: number, v: number, t: number, left: number) {
    ctx.save(); ctx.globalAlpha *= v * clamp(left / 6 + 0.2, 0, 1);
    // 焦土
    ctx.fillStyle = 'rgba(30,24,20,0.45)'; ctx.beginPath(); ctx.ellipse(x, y, 200, 60, 0, 0, TAU); ctx.fill();
    // 劫云（旋转的墨团）
    const cy = y - 620;
    for (let i = 0; i < 14; i++) {
      const a = t * 0.25 + i / 14 * TAU, r = 80 + (i % 4) * 55;
      ctx.fillStyle = `rgba(${28 + (i % 3) * 10},${28 + (i % 3) * 10},${40 + (i % 3) * 12},0.55)`;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.32, 120 - (i % 4) * 14, 46, a * 0.3, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const k = Math.max(0, Math.sin(t * 7)) * Math.max(0, Math.sin(t * 2.3));
    ctx.fillStyle = `rgba(180,190,255,${0.15 * k})`; ctx.beginPath(); ctx.ellipse(x, cy, 280, 90, 0, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(x, y - 60, 0, x, y - 60, 140); gr.addColorStop(0, 'rgba(200,210,255,0.25)'); gr.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 60, 140, 0, TAU); ctx.fill();
    ctx.restore();
  }
  private drawCart(ctx: G, x: number, y: number, dirx: number, v: number, wheel: number, hp: number) {
    ctx.save(); ctx.globalAlpha *= v;
    const f = dirx >= 0 ? 1 : -1;
    ctx.fillStyle = 'rgba(20,18,14,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 80, 16, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
    // 车辕
    ctx.strokeStyle = '#5a3e26'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40, -30); ctx.lineTo(96, -24); ctx.moveTo(40, -40); ctx.lineTo(96, -34); ctx.stroke();
    // 车厢 + 篷布
    ctx.fillStyle = '#7a5434'; ctx.fillRect(-56, -60, 100, 34);
    ctx.fillStyle = '#5e3e24'; for (let i = 0; i < 5; i++) ctx.fillRect(-54 + i * 20, -58, 2, 30);
    ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.moveTo(-58, -60); ctx.quadraticCurveTo(-6, -118, 46, -60); ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,40,0.5)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-58 + i * 26, -60); ctx.quadraticCurveTo(-46 + i * 26, -100, -32 + i * 26, -64); ctx.stroke(); }
    // 货箱一角
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(-40, -78, 22, 18);
    // 车轮
    for (const wx of [-36, 26]) {
      ctx.fillStyle = '#3e2a1a'; ctx.beginPath(); ctx.arc(wx, -16, 17, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a4a2e'; ctx.beginPath(); ctx.arc(wx, -16, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3e2a1a'; ctx.lineWidth = 2.5; for (let i = 0; i < 4; i++) { const a = wheel + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 13, -16 + Math.sin(a) * 13); ctx.lineTo(wx - Math.cos(a) * 13, -16 - Math.sin(a) * 13); ctx.stroke(); }
    }
    ctx.restore();
    if (hp < 1) { ctx.fillStyle = 'rgba(20,16,12,0.7)'; ctx.fillRect(x - 40, y - 132, 80, 7); ctx.fillStyle = hp > 0.5 ? '#9fe08a' : hp > 0.25 ? '#e8c060' : '#e06050'; ctx.fillRect(x - 39, y - 131, 78 * clamp(hp, 0, 1), 5); }
    ctx.restore();
  }
  private drawHerald(ctx: G, x: number, y: number, v: number, t: number) {
    ctx.save(); ctx.globalAlpha *= v; ctx.globalCompositeOperation = 'lighter';
    const k = 0.75 + 0.25 * Math.sin(t * 1.6);
    const gr = ctx.createLinearGradient(x, y - 1400, x, y);
    gr.addColorStop(0, 'rgba(255,240,180,0)'); gr.addColorStop(0.6, `rgba(255,230,150,${0.22 * k})`); gr.addColorStop(1, `rgba(255,250,220,${0.6 * k})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x - 70, y - 1400); ctx.lineTo(x + 70, y - 1400); ctx.lineTo(x + 22, y); ctx.fill();
    for (let i = 0; i < 16; i++) { const q = (t * 0.3 + i / 16) % 1; ctx.fillStyle = `rgba(255,240,180,${(1 - q) * 0.8})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 7 + t) * 40 * q, y - q * 700, 3 + 3 * (1 - q), 0, TAU); ctx.fill(); }
    const rg = ctx.createRadialGradient(x, y - 40, 0, x, y - 40, 120); rg.addColorStop(0, `rgba(255,240,190,${0.5 * k})`); rg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y - 40, 120, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.heraldFocus) { const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z)); ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText('【T】收取异宝', x, y - 170); ctx.fillStyle = '#fff0c8'; ctx.fillText('【T】收取异宝', x, y - 170); ctx.restore(); }
  }
}
void LOCATIONS;
