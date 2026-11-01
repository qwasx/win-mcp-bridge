// 第四十七步「人心」：骗局池 —— 笑着接近你、然后捅刀的人
// #1 合作探宝，分赃翻脸：散修邀你同探遗府，开到宝箱那一刻他出手
// #2 假丹药：路边地摊三折"筑基丹"，服用才知是淬体丹染的色（神识鉴定 / 阅历可破）
// #3 借刀杀人："前面山谷有魔修害我全家"——其实是他的宿敌，你杀完背上血仇（恩怨网原样接住后果）
// #5 夺舍老魔：重伤"前辈"求你渡一口灵力，接触瞬间夺舍判定（神识对抗）
// 附：寻仇夺回 —— 劫了你储物袋的无名劫修在附近扎营，打上门去拿回东西
// 频率：骗局占同类奇遇的 15–25%；谨慎的人几乎不骗、狠辣 / 贪婪高发；吃过一次亏，下次有辨识加成（阅历）
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import { foeRealm } from './demog';
import { WORLD_W, WORLD_H, ACTIVE_MAP } from '../data/world';
import { ENEMIES } from '../data/enemies';
import { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { REALMS, realmName } from '../data/realms';
import { CharState, drawCharacter, randomLook, Look } from '../gfx/character';
import { loot, dirName } from './sites';
import { cultivator, newTeam } from './melee';
import { drawMindBubble } from './alive';
import type { Pers } from './npc';
import { PERS_NAME } from './npc';
import { seesTruth, addJingLi, hasJingLi, jingLiBonus, duosheNode, daoShang, campNear, campRecover, type Robbed } from './renxin';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const SURN = ['王', '李', '赵', '孙', '周', '吴', '郑', '冯', '陈', '韦', '马', '朱', '胡', '林', '何', '高', '罗', '梁', '宋', '唐', '许', '邓', '萧', '司徒', '欧阳'];
const GIVEN = ['元', '无极', '青', '不凡', '长风', '一刀', '玄', '寒', '万里', '千山', '铁手', '百川', '飞', '三娘', '秋水', '冥', '子期', '守拙', '怀谷', '明远'];
const rname = () => pick(SURN) + pick(GIVEN);
const SECTS: [string, string, string][] = [['qingxu', '清虚门', 'qingxu'], ['yanyue', '掩月宗', 'yanyue'], ['huadao', '化刀坞', 'huadao'], ['tianque', '天阙堡', 'tianque'], ['jujian', '巨剑门', 'jujian'], ['lingshou', '灵兽山', 'lingshou'], ['huangfeng', '黄枫谷', 'huangfeng']];

type SKind = 'partner' | 'peddler' | 'proxy' | 'possess' | 'camp';
interface Npc { look: Look; st: CharState; x: number; y: number }
interface Sc {
  id: number; kind: SKind; x: number; y: number; t: number; done: boolean; seen: boolean; engaged: boolean;
  npc: Npc; name: string; realm: number; stage: number; pers: Pers; lie: boolean;
  foes: Enemy[]; d: any; say?: { text: string; t: number; truth: boolean }; sayT: number;
}
const SK_NAME: Record<SKind, string> = { partner: '合作探宝', peddler: '地摊', proxy: '求助', possess: '伤者', camp: '劫修营地' };

export class Scams {
  game: Game;
  list: Sc[] = [];
  focus: Sc | null = null; focusD = 1e9;
  private nid = 1;
  private cd = 0;
  constructor(g: Game) { this.game = g; }
  reset() { this.list = []; this.focus = null; }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.game, p = g.player, R = g.senseRadius;
    this.cd -= dt;
    this.list = this.list.filter((x) => {
      if (x.done) return false;
      const far = Math.hypot(x.x - p.x, x.y - p.y) > Math.max(5200, R * 3.6);
      if (far && !x.engaged) { this.drop(x); return false; }
      if (g.time - x.t > 300 && !x.engaged) { this.drop(x); return false; }
      return true;
    });
    this.focus = null; this.focusD = 1e9;
    for (const x of this.list) {
      const d = Math.hypot(x.x - p.x, x.y - p.y);
      if (!x.seen && d < R * 0.95) { x.seen = true; const s = this.seenText(x); if (s) g.toast(s, 'info'); }
      this.tick(x, dt, d);
      if (!x.engaged || x.d.stage === 'walk' || x.d.stage === 'arrived' || x.d.stage === 'look') {
        const dn = Math.hypot(x.npc.x - p.x, x.npc.y - p.y);
        if (dn < 220 && dn < this.focusD && x.kind !== 'camp') { this.focus = x; this.focusD = dn; }
      }
      this.mindTick(x, dt, d);
    }
    // 寻仇夺回：劫修营地
    const rb = campNear(g);
    if (rb && !this.list.some((x) => x.kind === 'camp')) this.spawnCamp(rb);
  }
  private drop(x: Sc) { const g = this.game; g.combat.enemies = g.combat.enemies.filter((e) => !x.foes.includes(e) || e.aggro); }
  private seenText(x: Sc): string | null {
    switch (x.kind) {
      case 'partner': return '神识中：一个散修远远朝你拱了拱手，快步走来。';
      case 'peddler': return '神识中：路边有人支了个地摊，摊上摆着几只玉瓶。';
      case 'proxy': return '神识中：一个修士神色仓皇，正朝你奔来，似有急事相求。';
      case 'possess': return '神识中：前方有人倒在血泊里，气息微弱——是个修士，境界不低。';
      case 'camp': return `神识中：几个劫修围着篝火分赃——正是劫了你储物袋的${x.name}一伙！`;
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
  private walkNpc(n: Npc, tx: number, ty: number, sp: number, dt: number) {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 4) { n.st.speed = 0; n.st.setAction('idle'); return true; }
    const k = Math.min(1, sp * dt / d);
    n.x += dx * k; n.y += dy * k; n.st.x = n.x; n.st.y = n.y; n.st.speed = sp; n.st.vx = dx / d * sp; n.st.vy = dy / d * sp;
    n.st.faceToward(dx, dy, false); n.st.setAction(sp > 200 ? 'run' : 'walk');
    return false;
  }
  /** 你看不看得穿这个人（奇遇里的临时 NPC：境界高出一个大境界就算神识压制住了） */
  private sees(x: Sc) { const h = this.game.hero; return seesTruth(this.game, x.realm, x.pers, h.realm > x.realm ? 1 : 0); }

  // ------------------------------------------------------------ 生成（由奇遇系统在抽事件前调用；返回 true 表示这次换成了骗局）
  trySpawn(): boolean {
    const g = this.game, h = g.hero;
    if (this.cd > 0 || this.list.length >= 1 || h.realm < 1) return false;
    if (Math.random() > 0.22) return false;
    const kinds: [SKind, number][] = [['partner', 10], ['proxy', 9], ['peddler', h.realm <= 2 ? 8 : 0], ['possess', h.realm >= 2 ? 6 : 2]];
    const tot = kinds.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot, kind: SKind = 'partner';
    for (const [k, v] of kinds) { r -= v; if (r <= 0) { kind = k; break; } }
    const pos = this.place(1.08, 1.4, kind === 'peddler');
    if (!pos) return false;
    this.cd = rand(60, 120);
    // 性格：骗局事件里狠辣 / 贪婪高发，但也混着真心人——玩家得保持怀疑，不至于草木皆兵
    const pers: Pers = pick<Pers>(['ruthless', 'greedy', 'greedy', 'cautious', 'righteous', 'kind', 'arrogant']);
    const x: Sc = { id: this.nid++, kind, x: pos.x, y: pos.y, t: g.time, done: false, seen: false, engaged: false, npc: this.mkNpc(pos.x, pos.y, 'cultivator'), name: rname(), realm: 1, stage: 0, pers, lie: false, foes: [], d: {}, sayT: rand(2, 5) };
    const fr = foeRealm(g, pos.x, pos.y, 'rogue', Math.random, Math.max(1, h.realm - 1), h.realm + 1);
    x.realm = clamp(fr.realm, 1, 4); x.stage = fr.stage;
    const liar = pers === 'ruthless' ? 0.8 : pers === 'greedy' ? 0.65 : pers === 'arrogant' ? 0.3 : pers === 'cautious' ? 0.15 : 0.03;
    if (kind === 'partner') { x.lie = Math.random() < liar; x.d.stage = 'come'; x.d.tier = clamp(h.realm, 1, 3); }
    else if (kind === 'peddler') { x.npc = this.mkNpc(pos.x, pos.y, 'merchant'); x.npc.st.setAction('sit'); x.lie = Math.random() < 0.7; x.pers = x.lie ? pick<Pers>(['greedy', 'ruthless']) : pick<Pers>(['cautious', 'greedy']); x.d.price = 1800; x.d.item = 'pill_zhuji'; }
    else if (kind === 'proxy') {
      x.lie = Math.random() < (pers === 'righteous' || pers === 'kind' ? 0.08 : 0.5); x.d.stage = 'come';
      const sec = pick(SECTS); x.d.sect = sec; x.d.reward = Math.round(80 * Math.pow(3, Math.max(0, h.realm - 1)) * rand(1, 1.5));
      // 目标：真魔修 / 他的宿敌（正派散修）——在不远处打坐
      const tp = this.place(1.5, 1.9); const tx = tp?.x ?? pos.x + 900, ty = tp?.y ?? pos.y + 300;
      const tr = foeRealm(g, tx, ty, 'rogue', Math.random, Math.max(1, h.realm - 1), h.realm + 1);
      const e = cultivator(tx, ty, tr.realm, tr.stage, x.lie ? sec[2] : pick(['guiling', 'hehuan', 'tiansha']), x.lie ? `${sec[1]}·${rname()}` : `魔修·${rname()}`);
      e.busy = true; e.hx = tx; e.hy = ty; e.team = newTeam('proxy'); if (e.cs) e.cs.setAction('sit');
      g.combat.enemies.push(e); x.foes.push(e); x.d.target = e; x.d.tname = e.name;
    } else if (kind === 'possess') {
      x.pers = 'ruthless'; x.lie = Math.random() < 0.75; x.realm = clamp(Math.max(3, h.realm + 1), 3, 4); x.stage = rint(0, 2);
      x.npc = this.mkNpc(pos.x, pos.y, 'elder'); x.npc.st.setAction('sit'); x.name = pick(['白须老者', '灰袍老道', '断臂老妪', '血衣老者']);
    }
    this.list.push(x);
    return true;
  }
  private spawnCamp(rb: Robbed) {
    const g = this.game;
    const x: Sc = { id: this.nid++, kind: 'camp', x: rb.x, y: rb.y, t: g.time, done: false, seen: false, engaged: true, npc: this.mkNpc(rb.x, rb.y, 'cultivator'), name: rb.by, realm: rb.realm, stage: rb.stage, pers: 'ruthless', lie: false, foes: [], d: { rb, stage: 'camp' }, sayT: 99 };
    x.npc.st.setAction('sit');
    const n = rint(2, 3);
    for (let i = 0; i < n; i++) {
      const def = rb.evil ? (rb.realm >= 3 ? ENEMIES.jindan_mo : ENEMIES.moxiu) : rb.realm >= 2 ? ENEMIES.zhujixiu : ENEMIES.bandit;
      const rs = i === 0 ? { realm: rb.realm, stage: rb.stage } : { realm: Math.max(1, rb.realm - (Math.random() < 0.5 ? 1 : 0)), stage: rint(0, 6) };
      const e = new Enemy(def, rb.x + rand(-90, 90), rb.y + rand(-60, 60), clamp(rs.realm, 1, 5), clamp(rs.stage, 0, REALMS[clamp(rs.realm, 1, 5)].hp.length - 1));
      e.name = i === 0 ? rb.by : '劫修同伙'; e.hx = e.x; e.hy = e.y; e.busy = true; e.team = newTeam('camp'); if (i === 0) e.boss = true;
      g.combat.enemies.push(e); x.foes.push(e);
    }
    this.list.push(x);
    g.toast(`神识中：${rb.by}一伙就在前面——你的东西还在他们手里。`, 'warn');
  }

  // ------------------------------------------------------------ 推进
  private tick(x: Sc, dt: number, dist: number) {
    const g = this.game, p = g.player;
    const alive = x.foes.filter((e) => !e.dead && g.combat.enemies.includes(e));
    switch (x.kind) {
      case 'partner': {
        if (x.d.stage === 'come') { if (dist > 200) this.walkNpc(x.npc, p.x, p.y, 150, dt); else { x.npc.st.setAction('idle'); x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); } x.x = x.npc.x; x.y = x.npc.y; }
        else if (x.d.stage === 'walk') {
          const far = Math.hypot(x.npc.x - p.x, x.npc.y - p.y);
          if (far < 420) this.walkNpc(x.npc, x.d.tx, x.d.ty, 170, dt); else { x.npc.st.setAction('idle'); x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); }
          x.x = x.npc.x; x.y = x.npc.y;
          if (Math.hypot(x.npc.x - x.d.tx, x.npc.y - x.d.ty) < 30 && Math.hypot(p.x - x.d.tx, p.y - x.d.ty) < 260 && !g.modal) { x.d.stage = 'open'; g.openDialog(this.partnerOpen(x)); }
        } else if (x.d.stage === 'fight') { if (!alive.length) x.done = true; }
        break;
      }
      case 'peddler': x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); break;
      case 'proxy': {
        const e = x.d.target as Enemy;
        if (x.d.stage === 'come') { if (dist > 200) this.walkNpc(x.npc, p.x, p.y, 190, dt); else { x.npc.st.setAction('idle'); x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); } x.x = x.npc.x; x.y = x.npc.y; }
        else if (x.d.stage === 'look' || x.d.stage === 'arrived') { x.npc.st.setAction('idle'); x.npc.st.faceToward(p.x - x.npc.x, p.y - x.npc.y); }
        if (e && !e.dead && !x.d.talked && e.busy && Math.hypot(e.x - p.x, e.y - p.y) < 240 && x.d.stage !== 'come' && !g.modal) { x.d.talked = true; g.openDialog(this.proxyTargetNode(x)); }
        if (e && e.dead && !x.d.paid) { x.d.paid = true; this.proxyDone(x); }
        if (x.d.stage === 'done' && !alive.length) x.done = true;
        break;
      }
      case 'possess': { x.npc.st.setAction('sit'); if (x.d.stage === 'fight' && !alive.length) x.done = true; break; }
      case 'camp': {
        if (!x.d.hit && alive.some((e) => e.aggro || !e.busy)) x.d.hit = true;
        if (!x.d.hit && alive.length && Math.hypot(x.x - p.x, x.y - p.y) < 520) { for (const e of alive) { e.busy = false; e.aggro = true; } x.d.hit = true; g.toast(`${x.name}：「是你？！还敢找上门来——兄弟们，做了他！」`, 'warn'); }
        if (!alive.length) { x.done = true; campRecover(g, x.d.rb); }
        break;
      }
    }
  }
  /** 骗局 NPC 的心声泡：表演心声 / 看穿后的真心声 */
  private mindTick(x: Sc, dt: number, dist: number) {
    if (x.say) { x.say.t -= dt; if (x.say.t <= 0) x.say = undefined; }
    x.sayT -= dt;
    if (x.sayT > 0 || dist > 900 || x.done || x.d.stage === 'fight' || x.kind === 'camp') return;
    x.sayT = rand(8, 14);
    const see = this.sees(x);
    const F: Record<SKind, [string[], string[]]> = {
      partner: [['这位道友好生面善。', '两人合力，稳妥得多。', '四六分，不亏他。'], ['等开了禁制再说。', '他一个人，好办。', '储物袋……鼓得很。']],
      peddler: [['家师急用灵石，忍痛割爱。', '三折，真三折。'], ['淬体丹染的色，看不出。', '卖掉就走，别回头。']],
      proxy: [['求道友做主……', '那魔头害我全家……'], ['借他的手除了那老东西。', '等他动手，我便远远看着。']],
      possess: [['咳……咳……', '渡劫……失手了……'], ['好一具纯净的肉身。', '来，再近些。']],
      camp: [[''], ['']],
    };
    const [fake, real] = F[x.kind];
    const truth = x.lie && see;
    x.say = { text: pick(truth ? real : fake), t: 3.4, truth };
  }

  // ------------------------------------------------------------ 交谈
  interact(): boolean {
    const x = this.focus; if (!x) return false;
    const g = this.game;
    if (x.kind === 'partner' && (x.d.stage === 'come' || x.d.stage === 'walk')) { g.openDialog(this.partnerNode(x)); return true; }
    if (x.kind === 'peddler' && !x.done) { g.openDialog(this.peddlerNode(x)); return true; }
    if (x.kind === 'proxy' && x.d.stage !== 'done') { g.openDialog(this.proxyNode(x)); return true; }
    if (x.kind === 'possess' && !x.engaged) { g.openDialog(this.possessNode(x)); return true; }
    return false;
  }
  private title(x: Sc) { return `${realmName(x.realm, x.stage)} · ${x.kind === 'possess' ? '气息不明' : PERS_NAME[x.pers]}`; }
  /** 神识探查选项（看得穿 → 真话；看不穿 → 看不出深浅） */
  private probe(x: Sc, back: () => DNode, truthText: string, honestText: string): DOpt {
    return { label: '神识探查', hint: '看一眼他的心湖', act: () => {
      const see = this.sees(x);
      if (!see) return { speaker: '心念', text: x.realm >= 3 && x.pers === 'ruthless' ? `你的神识探过去，像撞上一堵无形的墙——此人神魂凝练远在你之上，什么也看不出来。` : `你的神识扫过他——他的心湖平静无波。或是真的坦荡，或是你的修为还不足以看穿他。\n\n（境界高出两个大境界、或神识压制住对方，方能读心）`, options: [{ label: '回去', act: back }] };
      if (x.lie) { x.d.probed = true; return { speaker: '心念', mood: 'mystic', text: `你的神识悄然探入他的心湖——\n\n${truthText}`, options: [{ label: '（不动声色）', act: back }] }; }
      return { speaker: '心念', mood: 'mystic', text: `你的神识悄然探入他的心湖——\n\n${honestText}`, options: [{ label: '（不动声色）', act: back }] };
    } };
  }
  private toFoe(x: Sc, hpK = 1, extra = 0): Enemy[] {
    const g = this.game, out: Enemy[] = [];
    const school = x.kind === 'possess' ? 'guiling' : x.pers === 'ruthless' ? pick(['jiexiu', 'guiling']) : 'jiexiu';
    const e = cultivator(x.npc.x, x.npc.y, x.realm, x.stage, school, x.name); e.hx = e.x; e.hy = e.y; e.aggro = true; e.team = newTeam('scam'); e.hp = Math.round(e.maxHp * hpK);
    if (x.kind === 'possess') e.boss = true;
    g.combat.enemies.push(e); x.foes.push(e); out.push(e);
    for (let i = 0; i < extra; i++) { const r = foeRealm(g, x.x, x.y, 'minion', Math.random, 1, x.realm); const a = cultivator(x.npc.x + rand(-200, 200), x.npc.y + rand(-120, 120), r.realm, r.stage, school, '埋伏的同伙'); a.aggro = true; a.team = e.team; a.hx = a.x; a.hy = a.y; g.combat.enemies.push(a); x.foes.push(a); out.push(a); }
    x.d.stage = 'fight'; x.engaged = true;
    return out;
  }

  // ---------- #1 合作探宝
  private partnerNode(x: Sc): DNode {
    const g = this.game, h = g.hero, title = this.title(x), back = () => this.partnerNode(x);
    const jl = hasJingLi(g, 'partner');
    const text = x.d.stage === 'walk' ? `「就在前面了，道友莫急。」${x.name}回头笑了笑。` : `「这位道友留步！」${x.name}抱拳一礼，压低声音：「在下前日在${dirName(rand(-1, 1), rand(-1, 1))}边发现一处古修士的洞府，禁制尚在，一人之力开不得——需两人同时注入灵力。\n\n道友若肯援手，所得四六分，道友四，如何？」\n\n他目光坦荡，${x.pers === 'greedy' ? '只是看向你储物袋时多停了一息' : x.pers === 'ruthless' ? '袖口却隐隐透出一丝血气' : '是个老实人的模样'}。${jl ? '\n\n（你想起上次合伙探宝的下场——这回多留个心眼）' : ''}`;
    const opts: DOpt[] = [];
    if (x.d.stage !== 'walk') {
      opts.push({ label: '「同去。」', tone: 'gold', act: () => { const tp = this.place(0.5, 0.8); x.d.tx = tp?.x ?? x.x + 900; x.d.ty = tp?.y ?? x.y + 200; x.d.stage = 'walk'; x.engaged = true; g.toast(`${x.name}在前面带路——跟上他。`, 'info'); return null; } });
      opts.push(this.probe(x, back, pick(['「等开了禁制，先一掌拍碎他的后心……这人的储物袋，够我用十年。」', '「四六分？呵，到时候十分都是我的。」', '「洞府是真的，禁制也是真的——不过是个困人的阵。」']), pick(['「一个人实在开不动……这人看着还算正派，但愿别是个黑吃黑的。」', '「说好的四六，便是四六，修仙之人讲个信字。」'])));
      opts.push({ label: '「道友另寻高明吧。」', act: () => { x.done = true; return { speaker: x.name, title, look: x.npc.look, text: x.lie ? '「……可惜了。」他眼里的笑意淡了一瞬，转身走了。' : '「那便不勉强。道友保重。」他叹了口气，继续往前走去。', options: [{ label: '……', act: () => null }] }; } });
      if (x.d.probed) opts.push({ label: '先下手为强', tone: 'bad', act: () => { this.toFoe(x, 0.85); return { speaker: '心念', text: '你笑着点头，手却先动了。', options: [{ label: '动手', act: () => null }] }; } });
    } else {
      opts.push({ label: '「带路。」', act: () => null });
      opts.push({ label: '「我忽然想起有事，不去了。」', act: () => { x.done = true; g.toast(`${x.name}愣了愣，悻悻离去。`, 'info'); return null; } });
    }
    return { speaker: x.name, title, look: x.npc.look, text, options: opts };
  }
  private partnerOpen(x: Sc): DNode {
    const g = this.game, h = g.hero, title = this.title(x);
    const items = loot(g, x.d.tier, 1.3, { scroll: 0.3, art: 0.25 });
    const names = items.map((id) => itemDef(id).name).join('、');
    const mine = items.filter((_, i) => i % 5 < 2);   // 四成
    if (!x.lie) {
      return { speaker: x.name, title, look: x.npc.look, text: `两人同时注入灵力，石门上的禁制如水波般散去。\n\n洞府不大，石台上留着：${names || '几件杂物'}。\n\n${x.name}把东西分成两堆，推过来小的那堆：「说好的四六。」`, options: [
        { label: '收下自己那份', tone: 'gold', act: () => { for (const id of mine) C.addItem(h, id, 1); x.done = true; g.news(`韩立与散修${x.name}同探古修洞府，所得四六平分。`, 'personal'); g.toast(`得到：${mine.map((id) => itemDef(id).name).join('、') || '一些灵石'}。${x.name}拱手作别——江湖上多了一个靠得住的人。`, 'good'); return null; } },
        { label: '（杀人夺宝）', tone: 'bad', act: () => { const e = this.toFoe(x, 1)[0]; e.yieldAt = 0; g.ws.rep = clamp(g.ws.rep - 10, -100, 100); for (const id of items) g.combat.dropLoot(x.d.tx, x.d.ty, id, 1); return { speaker: x.name, mood: 'danger', text: `${x.name}瞳孔一缩：「你——！」\n\n（声望 -10。此事若传出去，再没人肯与你合伙）`, options: [{ label: '动手', act: () => null }] }; } },
      ] };
    }
    // 翻脸
    const ambush = x.pers === 'ruthless' && Math.random() < 0.5 ? 1 : 0;
    return { speaker: x.name, title, look: x.npc.look, mood: 'danger', text: `两人同时注入灵力，石门上的禁制如水波般散去。石台上留着：${names || '几件杂物'}。\n\n你刚迈进一步——身后${x.name}的声音忽然变了：\n\n「道友，对不住了。四六？这洞府，我一个人就够了。」\n\n${ambush ? '洞外同时响起一声呼哨——他还有同伙。' : '一道刀光已到后心。'}`, options: [
      { label: hasJingLi(g, 'partner') ? '（你早有防备）侧身避开，反手就是一击' : '（仓促回身）', tone: 'bad', act: () => {
        const ready = hasJingLi(g, 'partner');
        if (!ready) h.hp = Math.max(0.1, h.hp - 0.18);
        this.toFoe(x, ready ? 0.8 : 1, ambush);
        for (const id of items) g.combat.dropLoot(x.d.tx, x.d.ty, id, 1);
        addJingLi(g, 'partner', `与散修${x.name}合伙探宝，开到宝箱那一刻被他从背后出手。`);
        return null;
      } },
    ] };
  }

  // ---------- #2 假丹药
  private peddlerNode(x: Sc): DNode {
    const g = this.game, h = g.hero, title = this.title(x), back = () => this.peddlerNode(x);
    const ls = C.bagCount(h, 'mat_lingshi'), price = x.d.price as number;
    const jl = hasJingLi(g, 'fakepill');
    const buy = (p: number) => { C.removeItem(h, 'mat_lingshi', p); C.addItem(h, x.lie ? 'pill_zhuji_fake' : 'pill_zhuji', 1); x.done = true; g.toast(x.lie ? `你花 ${p} 灵石买下一颗"筑基丹"。摊主收了灵石，收摊走得飞快。` : `你花 ${p} 灵石买下一颗筑基丹——真货！摊主千恩万谢地走了。`, x.lie ? 'info' : 'good'); if (x.lie) addJingLi(g, 'fakepill_pending', `于路边地摊三折购得"筑基丹"一颗——${x.name}，${PERS_NAME[x.pers]}。`); return null; };
    const pId = clamp(0.2 + 0.22 * (h.realm - 1) + jingLiBonus(g, 'fakepill') + (C.heroStats(h).sense >= 200 ? 0.15 : 0), 0.1, 0.9);
    const opts: DOpt[] = [
      { label: `买下（${price} 灵石）`, tone: 'gold', disabled: ls < price, act: () => buy(price) },
      { label: `神识鉴定（约 ${Math.round(pId * 100)}%）`, hint: '以神识透入丹药，查其药力纹理', act: () => {
        if (x.d.checked) return { speaker: '心念', text: '你已经看过了。', options: [{ label: '回去', act: back }] };
        x.d.checked = true;
        if (Math.random() < pId) {
          if (x.lie) { addJingLi(g, 'fakepill', `识破${x.name}的三折"筑基丹"——染了色的淬体丹。`); return { speaker: '心念', mood: 'mystic', text: '神识透入丹丸——药力浅薄如水，丹纹是淬体丹的三道，表面那层金色是矿粉染的。\n\n假的。', options: [{ label: '「染色的淬体丹，也敢卖六千的价？」', act: () => { x.done = true; return { speaker: x.name, title, look: x.npc.look, text: x.pers === 'ruthless' ? '摊主脸色一变，猛地卷起摊布，身形一晃没入林中。' : '「道、道友看错了……」摊主抓起玉瓶就跑，跑出十几步还回头喊：「是家师给的！我也不知道！」', options: [{ label: '……', act: () => null }] }; } }, { label: '（不揭穿）走人', act: () => { x.done = true; return null; } }] }; }
          return { speaker: '心念', mood: 'mystic', text: '神识透入丹丸——药力浑厚，七道丹纹清晰，确是筑基丹无疑。\n\n真货。他是真急着用钱。', options: [{ label: `买下（${price} 灵石）`, tone: 'gold', disabled: ls < price, act: () => buy(price) }, { label: '走人', act: () => { x.done = true; return null; } }] };
        }
        return { speaker: '心念', text: '神识透进去，只觉得药力温和——看不出端倪。你的修为，还鉴不了这等丹药。', options: [{ label: '回去', act: back }] };
      } },
      { label: `压价：「一千二，卖不卖？」`, act: () => {
        if (x.lie && x.pers === 'greedy') { x.d.price = 1200; return { speaker: x.name, title, look: x.npc.look, text: '摊主咬了咬牙：「……罢了，一千二就一千二！道友可别跟人说。」\n\n（他答应得太快了）', options: [{ label: '买下（1200 灵石）', tone: 'gold', disabled: ls < 1200, act: () => buy(1200) }, { label: '（起疑）', act: back }] }; }
        return { speaker: x.name, title, look: x.npc.look, text: x.lie ? '「一千八已是贱卖，道友莫要戏弄人。」' : '「道友！筑基丹坊市六千起，一千八已是割肉！再少，我宁可自己留着。」', options: [{ label: '回去', act: back }] };
      } },
      { label: '走人', act: () => null },
    ];
    return { speaker: x.name, title, look: x.npc.look, text: `摊布上摆着几只玉瓶。摊主见你驻足，压低声音：\n\n「道友，筑基丹要么？家师闭关急用灵石，命我变卖此丹——坊市六千，我只要 ${price}。」\n\n他拔开瓶塞给你看：丹丸浑圆，金色丹纹隐隐。${x.pers === 'greedy' ? '他的手指有些发抖。' : ''}${jl ? '\n\n（你想起上次买到的那颗染色淬体丹）' : ''}`, options: opts };
  }

  // ---------- #3 借刀杀人
  private proxyNode(x: Sc): DNode {
    const g = this.game, title = this.title(x), back = () => this.proxyNode(x), e = x.d.target as Enemy;
    const dir = dirName(e.x - x.npc.x, e.y - x.npc.y);
    const jl = hasJingLi(g, 'proxy');
    const text = x.d.stage === 'come' ? `「道友！道友留步！」${x.name}踉跄奔来，衣襟上还有血：\n\n「${dir}面山谷里有个魔修，三日前屠了我全家十七口……我修为低微，斗他不过。求道友为我做主！我愿奉上全部身家 ${x.d.reward} 灵石，分文不留！」\n\n他说着就要跪。${jl ? '\n\n（你想起上次"替天行道"的下场——那人到死都在喊冤）' : ''}` : `「道友……可是去过了？」${x.name}眼巴巴望着你。`;
    const opts: DOpt[] = [
      { label: '「带我去。」', tone: 'gold', act: () => { x.d.stage = 'look'; x.engaged = true; g.toast(`${x.name}指着${dir}方——那"魔修"正在山谷里打坐。杀了他，回来领赏。`, 'info'); return null; } },
      this.probe(x, back, pick([`「${x.d.tname}……你当年抢我的灵脉，今天借这人的手让你死。」`, '「什么全家十七口，我连婆娘都没有。等那老东西死了，他洞府里的东西全归我。」', '「正道的傻子最好骗。」']), pick(['「爹……娘……我一定让他血债血偿。」', '「这人修为比我高，该斗得过那魔头吧……」'])),
      { label: '「此事与我无关。」', act: () => { x.d.stage = 'done'; x.done = true; for (const f of x.foes) g.combat.enemies = g.combat.enemies.filter((o) => o !== f); return { speaker: x.name, title, look: x.npc.look, text: x.lie ? '他眼里闪过一丝阴鸷，随即又哭丧着脸：「……也罢，是我命苦。」' : '「……」他跪在地上，久久没起来。', options: [{ label: '……', act: () => null }] }; } },
    ];
    if (x.d.probed) opts.push({ label: '「借刀杀人？借到我头上来了。」', tone: 'bad', act: () => { for (const f of x.foes) if (f !== e) g.combat.enemies = g.combat.enemies.filter((o) => o !== f); e.busy = false; e.hx = e.x; const foes = this.toFoe(x, 1); void foes; g.ws.rep = clamp(g.ws.rep + 3, -100, 100); x.d.stage = 'done'; return { speaker: x.name, mood: 'danger', text: `${x.name}脸色骤变，退了两步，狞笑道：「好敏锐的神识……那便连你一起送走！」`, options: [{ label: '动手', act: () => null }] }; } });
    return { speaker: x.name, title, look: x.npc.look, mood: 'normal', text, options: opts };
  }
  /** 走到"魔修"面前：真魔修与无辜者都会喊冤——破绽在他的气息与装束（魔道弟子 / 正派门人） */
  private proxyTargetNode(x: Sc): DNode {
    const g = this.game, e = x.d.target as Enemy;
    const fight = () => { e.busy = false; e.aggro = true; return null; };
    const sec = x.d.sect as [string, string, string];
    const text = x.lie ? `打坐的修士睁开眼，一身${sec[1]}的服色，眉宇正气：\n\n「道友是${x.name}请来的？」他苦笑，「那厮当年为抢一处灵脉害我师弟，被我打断了一条腿。此后三番五次借刀——道友，看在下这身衣冠、这身气息，像是屠人满门的魔修么？」` : `打坐的修士睁开眼，眼底隐隐一抹血色，周身魔气若有若无：\n\n「道友是${x.name}请来的？」他嗤笑一声，「那厮满口胡言——我与他不过是口角之争。道友修为不低，何必为一个泼皮脏了手？不如就此别过，日后也好相见。」\n\n他说话时，袖中有什么东西在轻轻蠕动。`;
    return { speaker: e.name, title: realmName(e.realm, e.stage), mood: x.lie ? 'normal' : 'danger', text, options: [
      { label: '「少废话。」（动手）', tone: 'bad', act: fight },
      { label: '「……我再想想。」（退开）', act: () => { x.d.stage = 'arrived'; return null; } },
      { label: '「是他骗了我。告辞。」（放过他）', act: () => { x.d.stage = 'done'; x.done = true; g.combat.enemies = g.combat.enemies.filter((o) => o !== e); if (x.lie) { g.ws.rep = clamp(g.ws.rep + 4, -100, 100); addJingLi(g, 'proxy', `${x.name}借刀杀人，欲假你之手除去${e.name}——被你看破。`); g.toast(`${e.name}抱拳：「道友明辨是非，${sec[1]}记下这份情。」（声望 +4）`, 'good'); } else g.toast(`那魔修冷笑一声，遁光远去。`, 'warn'); return null; } },
    ] };
  }
  /** 目标死了：付钱；若是无辜者，血仇落到你头上（恩怨网原样接住后果） */
  private proxyDone(x: Sc) {
    const g = this.game, h = g.hero, e = x.d.target as Enemy;
    x.d.stage = 'done'; x.done = true;
    if (!x.lie) { C.addItem(h, 'mat_lingshi', x.d.reward); g.ws.rep = clamp(g.ws.rep + 5, -100, 100); g.toast(`${x.name}跪地叩首，奉上 ${x.d.reward} 灵石：「大仇得报，道友大恩，永世不忘！」（声望 +5）`, 'good'); return; }
    const sec = x.d.sect as [string, string, string];
    C.addItem(h, 'mat_lingshi', Math.round(x.d.reward * 0.5));
    g.ws.rep = clamp(g.ws.rep - 15, -100, 100);
    // 他的师门记你一辈子
    const kin = g.npcs.list.filter((n) => n.alive && n.sect === sec[0] && !n.beauty && n.realm >= 1).sort(() => Math.random() - 0.5).slice(0, 3);
    for (let i = 0; i < kin.length; i++) {
      const k = kin[i];
      k.met = true; k.favor = Math.min(k.favor, i === 0 ? -90 : -60); k.grudge = Math.max(k.grudge ?? 0, i === 0 ? 2 : 1);
      k.why = `你杀了${sec[1]}的${e.name.split('·')[1] ?? e.name}`; if (i === 0) k.huntAt = g.day + Math.round(rand(10, 40));
    }
    g.news(`${sec[1]}门人${e.name.split('·')[1] ?? e.name}死于韩立之手。${sec[1]}震怒。`, 'rumor');
    addJingLi(g, 'proxy', `受${x.name}所托斩"魔修"，死的却是${sec[1]}门人${e.name.split('·')[1] ?? e.name}——血仇背到了自己身上。`);
    g.toast(`${x.name}从远处走来，脸上哪还有半点悲色。他扔下 ${Math.round(x.d.reward * 0.5)} 灵石：「剩下的，算道友替我背了${sec[1]}的仇。」\n\n（声望 -15；${sec[1]}${kin.length ? kin.map((k) => k.name).join('、') + '等' : ''}记下了你）`, 'warn');
  }

  // ---------- #5 夺舍老魔
  private possessNode(x: Sc): DNode {
    const g = this.game, h = g.hero, title = this.title(x), back = () => this.possessNode(x);
    const jl = hasJingLi(g, 'duoshe');
    const hint = jl || (C.heroStats(h).sense >= 400 && Math.random() < 0.4);
    const text = `${x.name}倒在血泊里，胸口一个焦黑的窟窿，气息断断续续：\n\n「道友……老夫渡劫……失手了……元气散尽，只差一口灵力续命……\n\n求道友……渡一口灵力……老夫洞府中的藏物，尽数相赠……」\n\n他颤巍巍伸出一只手。${hint ? '\n\n（你注意到：他的眼珠在你看他的时候，转得太快了——不像个将死之人）' : ''}${jl ? '\n\n（你想起上次那个"前辈"……）' : ''}`;
    const win = () => { x.engaged = true; x.done = true; addJingLi(g, 'duoshe', `${x.name}求你渡灵力，实为夺舍——神识相抗，你赢了。`); for (const id of loot(g, x.realm, 1.5, { art: 0.5, scroll: 0.5 })) C.addItem(h, id, 1); g.toast(`你搜了老魔的储物袋，收获颇丰。`, 'good'); g.news(`一名夺舍失败的老魔陨落于荒野。`, 'rumor'); };
    const lose = () => { x.engaged = true; x.done = true; h.exp = Math.max(0, h.exp - C.need(h) * 0.2); daoShang(g, 60, '夺舍反噬'); addJingLi(g, 'duoshe', `${x.name}求你渡灵力，实为夺舍——险些丢了身子，被掌天瓶所救。`); };
    return { speaker: x.name, title, look: x.npc.look, mood: 'mystic', text, options: [
      { label: '（渡一口灵力给他）', tone: 'love', act: () => {
        if (!x.lie) { x.done = true; const gift = loot(g, x.realm, 1, { art: 0.4 }); for (const id of gift) C.addItem(h, id, 1); g.ws.rep = clamp(g.ws.rep + 6, -100, 100); return { speaker: x.name, title, look: x.npc.look, text: `一口灵力渡过去，老者的气息总算稳住。他挣扎着坐起，从储物袋里摸出几样东西塞给你：「老夫言出必行……道友大恩。」\n\n得到：${gift.map((id) => itemDef(id).name).join('、')}（声望 +6）`, options: [{ label: '「前辈保重。」', act: () => null }] }; }
        x.engaged = true;
        return duosheNode(g, x.name, x.realm, win, lose);
      } },
      this.probe(x, back, '——你什么也读不到。（结丹以上的老怪，神魂远非你能窥探）', '他心中只剩一个念头：活下去。'),
      { label: '先下手为强', tone: 'bad', act: () => { const e = this.toFoe(x, x.lie ? 0.35 : 0.1)[0]; if (!x.lie) { g.ws.rep = clamp(g.ws.rep - 12, -100, 100); g.toast('你杀了一个真正的垂死之人。（声望 -12）', 'warn'); } else { addJingLi(g, 'duoshe', `${x.name}装作重伤求救，被你先下手为强。`); e.yieldAt = 0; } return { speaker: '心念', text: x.lie ? `你的法术落下的刹那，"垂死"的老者眼中凶光暴涨，猛地弹了起来——\n\n「小畜生，倒是机警！」` : '老者连躲都没躲。', options: [{ label: '……', act: () => null }] }; } },
      { label: '「前辈恕晚辈无能为力。」（离开）', act: () => { x.done = true; g.toast(x.lie ? '你走出十几丈，身后传来一声极轻的、不像垂死之人的冷哼。' : '身后的咳嗽声渐渐听不见了。', 'info'); return null; } },
    ] };
  }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, _t: number, dt: number) {
    const g = this.game;
    for (const x of this.list) {
      if (x.d.stage === 'fight' || x.kind === 'camp') continue;
      const n = x.npc;
      if (n.x < view.left - 800 || n.x > view.right + 800 || n.y < view.top - 900 || n.y > view.bottom + 400) continue;
      const v = g.life.vis({ x: n.x, y: n.y }); if (v <= 0.01) continue;
      out.push({ y: n.y, draw: (ctx) => {
        ctx.save(); ctx.globalAlpha *= v; n.st.update(dt); drawCharacter(ctx, n.look, n.st, 1, dt); ctx.restore();
        if (x.kind === 'possess') { ctx.save(); ctx.globalAlpha *= v * 0.7; ctx.fillStyle = '#5a1012'; ctx.beginPath(); ctx.ellipse(n.x + 10, n.y + 6, 46, 14, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        if (x.kind === 'peddler') { ctx.save(); ctx.globalAlpha *= v; ctx.fillStyle = '#6a5a44'; ctx.fillRect(n.x - 60, n.y - 4, 120, 10); ctx.fillStyle = '#c8d8c0'; for (let i = 0; i < 4; i++) ctx.fillRect(n.x - 44 + i * 26, n.y - 18, 10, 14); ctx.restore(); }
        this.tag(ctx, x, n);
        if (x.say) { const z = g.cam.zoom, fs = Math.max(11, 12.5 / Math.max(0.5, z)); drawMindBubble(ctx, n.x, n.y - 175 - fs * 0.6, x.say.text, fs, Math.min(1, x.say.t * 1.5) * v, x.say.truth); }
      } });
    }
  }
  private tag(ctx: G, x: Sc, n: Npc) {
    if (this.focus !== x) return;
    const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z));
    ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)';
    const s = '【T】' + SK_NAME[x.kind];
    ctx.strokeText(s, n.x, n.y - 190); ctx.fillStyle = '#fff0c8'; ctx.fillText(s, n.x, n.y - 190); ctx.restore();
  }
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    for (const x of this.list) if (x.kind === 'partner' && x.d.stage === 'walk') out.push({ x: x.d.tx, y: x.d.ty, glyph: '府', color: '#d8c080', name: '古修洞府（合探）' });
    for (const x of this.list) if (x.kind === 'proxy' && x.d.stage === 'look') { const e = x.d.target as Enemy; if (!e.dead) out.push({ x: e.x, y: e.y, glyph: '仇', color: '#e08080', name: `${x.name}所指的"魔修"` }); }
    for (const rb of ((this.game.ws.flags as any).robbed as Robbed[] | undefined) ?? []) if (!rb.done && !rb.npcId && rb.map === ACTIVE_MAP) out.push({ x: rb.x, y: rb.y, glyph: '劫', color: '#ff9a6a', ring: 1, name: `${rb.by}的营地（寻仇夺回）` });
    return out;
  }
}
