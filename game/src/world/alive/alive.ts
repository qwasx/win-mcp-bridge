// 活世界 · 游戏侧桥接（把共享引擎接到现有 NpcWorld 上）
// 目标：让每个 NPC 有自己的储物袋、功法、门派、家、恩怨与日程；
//       让「有人来找你」永远带着缘由（有利益、有代价、有冷却），不再没头没脑。
import type { Game } from '../game';
import type { NpcData } from '../npc';
import { LOC_BY_ID, ACTIVE_MAP, WORLD_SCALE, LOCATIONS } from '../../data/world';
import {
  createWorld, addSoul, seedSociety, tickDays, serialize, deserialize, heroMeet, heroGift,
  heroKill, heroAccept, heroRefuse, heroSpare, soulView, worldSummary, nameOf, realmName,
} from '@alive';
import type { ContactRequest, Soul, World } from '@alive';

const SAVE_KEY = 'alive.v1';
const SEED = 20260214;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 主角此刻在哪个地界（用于「他在不在附近」的判断） */
function heroLocId(g: Game): string {
  const x = g.player.x / WORLD_SCALE, y = g.player.y / WORLD_SCALE;
  let best = '', bd = 1e9;
  for (const l of LOCATIONS) {
    if (l.map !== ACTIVE_MAP) continue;
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < bd) { bd = d; best = l.id; }
  }
  return best;
}

export class Alive {
  game: Game;
  w: World | null = null;
  /** 已接入名册的 NPC id */
  private hooked = new Set<string>();
  private lastSync = -1e9;
  private lastChronDay = 0;
  private lastServerPush = 0;

  constructor(game: Game) { this.game = game; }

  // ------------------------------------------------------------ 建立 / 读档
  ensure(): World {
    if (this.w) return this.w;
    const saved = (this.game.ws.flags as Record<string, unknown>)[SAVE_KEY] as string | undefined;
    if (saved) {
      try { this.w = deserialize(JSON.parse(saved)); } catch { this.w = null; }
    }
    if (!this.w) {
      this.w = createWorld({ seed: SEED, heroName: this.game.hero.name ?? '韩立', realms: { realms: [] } });
      seedSociety(this.w, 10);
      this.lastChronDay = 0;
    }
    this.hooked.clear();
    this.attachAll();
    return this.w;
  }

  /** 把游戏内名册接入活世界（增量；不重复建） */
  attachAll(): void {
    const w = this.ensure();
    for (const d of this.game.npcs.list) this.attach(d);
    void w;
  }

  attach(d: NpcData): Soul {
    const w = this.ensure();
    let s = w.souls[d.id];
    const homeName = LOC_BY_ID.get(d.home)?.name ?? d.home;
    if (!s) {
      s = addSoul(w, {
        id: d.id, name: d.name, sex: d.sex, age: d.age, realm: d.realm, stage: d.stage,
        pers: d.pers, homeId: d.home, homeName, sectId: d.sect, faction: d.faction,
        metHero: d.met, favor: d.favor, stones: Math.round(d.wealth),
      });
      if (d.sect) s.sectName = LOC_BY_ID.get(d.sect)?.name ?? s.sectName;
      // 游戏里已有的恩怨搬进来（保持两套系统一致）
      if (d.grudge && d.grudge > 0) {
        s.grudges.push({ other: '__hero__', heat: d.grudge >= 2 ? 88 : 42, reason: d.why ?? '旧怨', day: Math.round(w.day), blood: d.grudge >= 2 });
        s.need.revenge = d.grudge >= 2 ? 80 : 30;
      }
      if (d.met) heroMeet(w, d.id, d.favor >= 20 ? 'kind' : d.favor <= -10 ? 'rude' : 'neutral');
      this.hooked.add(d.id);
    }
    // 游戏为真：境界、生死、所在
    s.realm = Math.max(s.realm, d.realm); s.stage = Math.max(s.stage, d.stage);
    s.homeId = d.home; s.homeName = homeName; s.atId = d.home;
    if (d.sect) { s.sectId = d.sect; s.sectName = LOC_BY_ID.get(d.sect)?.name ?? d.sect; }
    s.metHero = s.metHero || !!d.met;
    return s;
  }

  // ------------------------------------------------------------ 每日推进
  /** 由 NpcWorld.daily() 调用 */
  tick(days: number): void {
    const w = this.ensure();
    this.attachAll();
    // 主角位置 / 主角真相
    const hero = w.souls['__hero__'];
    const at = heroLocId(this.game);
    if (hero) { hero.atId = at; hero.homeName = LOC_BY_ID.get(at)?.name ?? hero.homeName; hero.realm = this.game.hero.realm; hero.stage = this.game.hero.stage; }
    w.heroName = this.game.hero.name ?? w.heroName;
    w.hero.fame = clamp(this.game.ws.rep, -100, 100);

    const fresh = tickDays(w, Math.max(1, Math.min(days, 60)), { heroAt: at, heroAlive: !this.game.hero.dead });
    this.pushBack();
    this.report(fresh);
    this.maybeDeliver();
    (this.game.ws.flags as Record<string, unknown>)[SAVE_KEY] = JSON.stringify(serialize(w));
    void this.lastSync;
  }

  /** 把活世界的结论写回游戏（仇恨带缘由、好感、名望） */
  private pushBack(): void {
    const w = this.w!;
    for (const d of this.game.npcs.list) {
      const s = w.souls[d.id];
      if (!s || !d.alive) continue;
      const g = s.grudges.find((x) => x.other === '__hero__' && !x.done);
      if (g && g.heat >= 60) {
        if ((d.grudge ?? 0) < 2) { d.grudge = 2; d.why = g.reason; }
        else if (!d.why) d.why = g.reason;
      } else if (g && g.heat >= 30 && (d.grudge ?? 0) < 1) { d.grudge = 1; d.why = g.reason; }
      if (s.favor !== undefined && d.met) d.favor = clamp(Math.round(s.favor), -100, 100);
      if (s.metHero) d.met = true;
      if (s.deathNote && !d.alive) d.deathNote = s.deathNote;
    }
  }

  /** 把世界大事播成传闻（只挑有分量的，避免刷屏） */
  private report(fresh: { day: number; kind: string; text: string; weight: number }[]): void {
    const w = this.w!;
    for (const e of fresh) {
      if (e.weight < 2 || e.day <= this.lastChronDay) continue;
      if (e.kind === 'kill' || e.kind === 'revenge' || e.kind === 'sect' || e.kind === 'wed' || e.kind === 'fell') {
        this.game.news(`${e.text}。`, 'rumor');
      }
    }
    this.lastChronDay = Math.round(w.day);
  }

  // ------------------------------------------------------------ 邀约（必有缘由）
  contacts(): ContactRequest[] { return this.ensure().contacts.filter((c) => !c.handled); }

  /** 有新邀约时，用传音符的方式提示（不自动弹窗，不打断玩家） */
  private maybeDeliver(): void {
    const w = this.w!;
    for (const c of w.contacts) {
      if (c.handled || (c as ContactRequest & { told?: boolean }).told) continue;
      (c as ContactRequest & { told?: boolean }).told = true;
      const toneWord: Record<string, string> = {
        friendly: '相邀', trade: '谈买卖', sect: '门中召见', threat: '问罪',
        grief: '讨说法', vengeance: '寻仇', romance: '传信', curiosity: '打听',
      };
      this.game.toast(`传音符：${c.fromName}托人捎话——${c.reason}（活世界·Y 查看）`, c.tone === 'threat' || c.tone === 'vengeance' || c.tone === 'grief' ? 'warn' : 'good');
      this.game.ws.letters = this.game.ws.letters ?? [];
      this.game.ws.letters.unshift({
        id: (Date.now() % 1e9) + Math.floor(Math.random() * 997),
        from: `alive:${c.from}`,
        day: Math.round(w.day),
        text: `${c.line}\n\n缘由：${c.reason}\n事成之利：${c.gain}\n若推了：${c.cost}\n所在：${c.placeName ?? '不详'}\n\n（活世界面板按 Y 可应下或推掉）`,
        kind: c.tone === 'grief' || c.tone === 'vengeance' ? 'sos' : 'req',
        read: false,
      });
      if (this.game.ws.letters.length > 40) this.game.ws.letters.pop();
      void toneWord;
    }
  }

  accept(id: string): string { const w = this.ensure(); const r = heroAccept(w, id); (this.game.ws.flags as Record<string, unknown>)[SAVE_KEY] = JSON.stringify(serialize(w)); return r; }
  refuse(id: string): string { const w = this.ensure(); const r = heroRefuse(w, id); (this.game.ws.flags as Record<string, unknown>)[SAVE_KEY] = JSON.stringify(serialize(w)); return r; }

  // ------------------------------------------------------------ 主角行为（世界记账）
  onTalk(d: NpcData, tone: 'kind' | 'neutral' | 'rude' = 'neutral'): void {
    const w = this.ensure(); const s = this.attach(d);
    heroMeet(w, d.id, tone);
    if (tone === 'kind') s.favor = clamp((s.favor ?? 0) + 4, -100, 100);
    d.lastTalk = this.game.day;
  }
  onGift(d: NpcData, itemName: string, worth: number): void {
    const w = this.ensure(); this.attach(d);
    heroGift(w, d.id, itemName, worth);
  }
  onSpar(d: NpcData, won: boolean): void {
    const w = this.ensure(); const s = this.attach(d);
    tieNote(s, won ? '（他输得心服口服）' : '（他让你三分，你没占到便宜）');
    heroMeet(w, d.id, won ? 'kind' : 'neutral');
  }
  /** 你杀了一个人：他的储物袋真的会到你手里，他的家人与目击者会记住你 */
  onKill(d: NpcData, x: number, y: number): { worth: number; lines: string[] } {
    const w = this.ensure(); const s = this.attach(d);
    const view = soulView(w, d.id);
    const worth = view ? Math.round(view.bagWorth * 0.6) : 0;
    const lines: string[] = [];
    if (view) {
      for (const it of view.bag.slice(0, 3)) lines.push(`${it.name}（${it.src}）`);
      if (view.bag.length > 3) lines.push(`……以及另外 ${view.bag.length - 3} 件杂物`);
      const art = view.arts[0];
      if (art) lines.push(`玉简残页：${art.name}（${art.from}，修至${Math.round(art.mastery)}层）`);
    }
    heroKill(w, d.id, '斗法败亡');
    (this.game.ws.flags as Record<string, unknown>)[SAVE_KEY] = JSON.stringify(serialize(w));
    void x; void y;
    return { worth, lines };
  }
  /** 你饶了他一命 */
  onSpare(d: NpcData, note = '点到为止'): void {
    const w = this.ensure(); this.attach(d);
    heroSpare(w, d.id, note);
  }
  onDeath(d: NpcData, why: string): void {
    const w = this.ensure(); const s = w.souls[d.id];
    if (!s || !s.alive) return;
    s.alive = false; s.deathNote = why; s.deathDay = Math.round(w.day);
    if (d.grudge && d.why) { /* 与游戏内记录一致 */ }
  }

  // ------------------------------------------------------------ 查询（面板 / 对话）
  soul(id: string) { const w = this.ensure(); return soulView(w, id); }
  summary() { return worldSummary(this.ensure()); }
  chron(limit = 60) { const w = this.ensure(); return w.chron.slice(-limit).reverse(); }
  rumors(limit = 30) { const w = this.ensure(); return w.rumors.slice(-limit).reverse(); }

  /** 交谈时，这个人「正在做什么 / 为何在此」 */
  quip(d: NpcData): string | undefined {
    const w = this.ensure(); const s = w.souls[d.id];
    if (!s) return undefined;
    const bits: string[] = [];
    if (s.quip) bits.push(s.quip);
    bits.push(`（此刻：${agendaLine(s)}）`);
    const grudge = s.grudges.find((x) => x.other === '__hero__' && !x.done);
    if (grudge) bits.push(`（他记得：${grudge.reason}）`);
    const kin = s.kin.find((k) => k.kind === 'spouse');
    if (kin) bits.push(`（道侣：${nameOf(w, kin.other)}）`);
    return bits.join(' ');
  }

  /** 命册：储物袋 / 功法 / 门派 / 家 / 恩怨 / 日程 */
  dossier(d: NpcData): string[] {
    const w = this.ensure(); const s = this.attach(d);
    const v = soulView(w, d.id)!;
    const out: string[] = [];
    out.push(`【此刻】${v.agendaText}`);
    out.push(`【门派】${v.sectName ?? '散修'}${v.sectRank ? ' · ' + v.sectRank : ''} · ${v.realmName} · ${v.persName} · ${Math.round(v.age)}岁 · 名声 ${Math.round(v.fame)}`);
    out.push(`【功法】${v.arts.map((a) => `${a.name}（${a.el}·${a.tier}阶·${Math.round(a.mastery)}层，${a.from}）`).join('；') || '未入道'}`);
    out.push(`【储物袋】${v.bag.length} 件，约值 ${v.bagWorth} 灵石；另有 ${Math.round(v.stones)} 灵石`);
    for (const it of v.bag.slice(0, 5)) out.push(`　· ${it.name}×${it.count} —— ${it.src}`);
    if (v.bag.length > 5) out.push(`　· ……另有 ${v.bag.length - 5} 件`);
    out.push(`【家人】${v.kinNames.length ? v.kinNames.map((k) => `${k.name}（${k.kind}${k.alive ? '' : '·故'}）`).join('、') : '举目无亲'}`);
    out.push(`【往来】${v.socialNames.length ? v.socialNames.slice(0, 5).map((t) => `${t.name}（${socialWord(t.kind)}·${t.val > 0 ? '+' : ''}${t.val}）`).join('、') : '少与人往来'}`);
    out.push(`【恩怨】${v.grudgeNames.length ? v.grudgeNames.slice(0, 4).map((g) => `${g.name}：${g.reason}${g.blood ? '（血仇）' : ''}${g.done ? '（已了）' : `·恨意${g.heat}`}`).join('；') : '与人无怨'}`);
    if (v.traits.length) out.push(`【性子】${v.traits.join('、')}`);
    return out;
  }

  /** 面板数据 */
  panel() {
    const w = this.ensure();
    const sum = worldSummary(w);
    const list = Object.keys(w.souls).map((k) => w.souls[k])
      .filter((s) => s.alive && s.id !== '__hero__')
      .sort((a, b) => (b.realm * 100 + b.stage) - (a.realm * 100 + a.stage));
    return {
      summary: sum,
      day: Math.round(w.day),
      contacts: this.contacts(),
      chron: this.chron(70),
      rumors: this.rumors(24),
      npcs: list.slice(0, 160).map((s) => ({
        id: s.id, name: s.name, realm: realmName(w, s.realm, s.stage), sect: s.sectName ?? (s.faction === 'mortal' ? '凡人' : '散修'),
        at: s.homeName, agenda: agendaLine(s), grudge: Math.round(Math.max(0, ...s.grudges.filter((g) => g.other === '__hero__').map((g) => g.heat))),
        favor: Math.round(s.favor ?? 0), bag: s.bag.length, arts: s.arts.length, kin: s.kin.length,
      })),
    };
  }

  /**
   * 劫道也得有个由头。返回 null 表示「没人有理由动你」——路上的劫修多半会放你过去，
   * 或转而去拦别的商旅；不再没头没脑地冲着你来。
   */
  robberMotive(): { why: string; hunter: boolean } | null {
    const w = this.ensure();
    const hero = w.souls['__hero__'];
    if (!hero) return null;
    // 1) 有人真的恨你，且恨得动了手（追杀 / 悬赏）
    const haters = Object.keys(w.souls).map((k) => w.souls[k]).filter((s) => s.alive && s.id !== '__hero__' && s.grudges.some((g) => g.other === '__hero__' && !g.done && g.heat >= 70));
    if (haters.length) {
      const h = haters[Math.floor(Math.random() * haters.length)];
      const g = h.grudges.find((x) => x.other === '__hero__' && !x.done && x.heat >= 70)!;
      return { why: `${h.name}记着${g.reason}——他托了人，也放了话。`, hunter: true };
    }
    // 2) 恶名在外：正道七派的赏格
    if (w.hero.fame <= -30) return { why: '你恶名在外，人头有人出价。', hunter: true };
    // 3) 见财起意：你的袋子和名声真的传了出去
    const rich = hero.bag.reduce((a, b) => a + b.worth * b.count, 0);
    const rumorHeard = w.rumors.some((r) => r.about === '__hero__' && w.day - r.day < 120);
    if (rich > 6000 && (rumorHeard || Math.random() < 0.5)) {
      const best = hero.bag.slice().sort((a, b) => b.worth - a.worth)[0];
      return { why: `你在坊市露过财——有人惦记你那只${best?.name ?? '值钱'}的储物袋。`, hunter: false };
    }
    return null;
  }

  /** 定期把世界快照推给后台（同源时才生效，失败静默） */
  pushServer(force = false): void {
    if (typeof fetch !== 'function') return;
    const now = Date.now();
    if (!force && now - this.lastServerPush < 45000) return;
    this.lastServerPush = now;
    const w = this.ensure();
    const body = JSON.stringify({ day: Math.round(w.day), heroName: w.heroName, blob: serialize(w) });
    try { void fetch('/api/alive/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }); } catch { /* 离线也无所谓 */ }
  }
}

// ---------------------------------------------------------------- 小工具
function agendaLine(s: Soul): string {
  const m: Record<string, string> = {
    train: '修行', gather: '采药', hunt: '猎妖', trade: '做买卖', errand: '办事', seclude: '闭关',
    home: '在家', avenge: '寻仇', sect: '门中差事', social: '应酬', court: '走动感情', visit: '探望', teach: '授业', guard: '守卫',
  };
  return `${m[s.agenda.kind] ?? s.agenda.kind}——${s.agenda.why}`;
}
function socialWord(k: string) {
  const m: Record<string, string> = { friend: '友人', sworn: '结拜', mentor: '师长', disciple: '弟子', lover: '道侣', rival: '对头', trade: '生意伙伴' };
  return m[k] ?? k;
}
function tieNote(_s: Soul, _n: string) { /* 保留扩展点 */ }
