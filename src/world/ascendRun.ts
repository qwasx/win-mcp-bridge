// 第 2 阶段：境界突破（游戏一侧）——冲关流程、关卡、场面、变强总结；闭关打断与心得；悟道之地；元婴神通
import type { Game } from './game';
import type { DNode, DOpt } from './modal';
import * as C from './cultivation';
import * as A from './ascend';
import { REALMS, MAJOR_BREAKS, realmName } from '../data/realms';
import { itemDef } from '../data/items';
import { ENEMIES } from '../data/enemies';
import { BEAUTIES } from '../data/beauties';
import { LOC_BY_ID, WORLD_SCALE, locHere } from '../data/world';
import { Enemy } from './combat';
import { audio } from './audio';
import type { FxSys } from '../gl/fx';

type Phase = 'pulse' | 'xinmo' | 'condense' | 'waves' | 'cine' | 'summary' | 'wait';
export interface Snap { realm: string; hp: number; mp: number; atk: number; def: number; sense: number; speed: number; life: number; slots: number }
export interface Pulse { names: string[]; i: number; ang: number; spd: number; zone: number; zw: number; hits: number; perfect: number; miss: number; spins: number; flash: number; last: '' | 'hit' | 'perfect' | 'miss'; t: number; res: ('hit' | 'perfect' | 'miss')[] }
export interface Waves { prog: number; wave: number; waves: number; foes: Enemy[]; ally: Enemy | null; outT: number; R: number; t: number; disturbed: boolean; guard: string | null; note: string; noteT: number }
export interface Run {
  realm: number; phase: Phase; t: number; x: number; y: number;
  pills: number; prep: A.PrepItem[]; parts: A.ChanceParts; u: number; perf: number; xinmo: number; cook: number;
  mg?: Pulse; wv?: Waves; ok?: boolean; grade?: number; before: Snap; fail?: A.FailResult; interrupted?: string;
  rare?: string; ct: number; cineDur: number;
}
export interface Summary { ok: boolean; title: string; realm: string; lines: string[]; before: Snap; after: Snap; chance: number; extra: string[]; grade?: number }
export interface Cal { text: string; sub?: string; t: number; dur: number; color: string; vertical?: boolean }
interface Vortex { x: number; y: number; k: number; want: number; t: number; fail: boolean; R: number }
interface TaskRt { foes: Enemy[] }

const PULSE_8 = ['任脉', '督脉', '冲脉', '带脉', '阴维脉', '阳维脉', '阴跷脉', '阳跷脉'];
const PULSE_10 = ['东方', '南方', '西方', '北方', '东南', '西南', '东北', '西北', '上方', '下方'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class AscendSys {
  run: Run | null = null;
  summary: Summary | null = null;
  cal: Cal[] = [];
  vortex: Vortex | null = null;
  /** 黑白水墨镜头强度 0–1（后期） */
  ink = 0;
  private inkShots: number[] = [];
  /** 元婴显化（0–1） */
  soulK = 0;
  private soulT = -1;
  private q: DNode[] = [];
  private kills0 = -1;
  private tick = 0;
  private rt = new Map<number, TaskRt>();
  // 元婴神通
  blinkCd = 0; outCd = 0;
  out: { x: number; y: number; t: number; hp: number } | null = null;
  /** 冲关用掉的稀世灵物（展示用） */
  constructor(private g: Game) {}

  /** 新开一局 / 读档：清掉进行中的冲关 */
  reset() { this.run = null; this.summary = null; this.cal = []; this.vortex = null; this.ink = 0; this.inkShots = []; this.soulK = 0; this.soulT = -1; this.out = null; this.q = []; this.kills0 = -1; this.rt.clear(); this.pendF = null; this.pendIntr = false; }
  onLoad() { const h = this.g.hero; A.ascOf(h); while (h.hotbar.length < A.slotCount(h.realm)) h.hotbar.push(null); }
  /** 调试 / 截图：把主角放到某境界圆满，并凑齐若干准备（0–6 项里的圆满、灵物、温养、护法），带上对应丹药 */
  debugPeak(realm: number, prep = 4, pills = 2, want?: 'win' | 'lose') {
    const g = this.g, h = g.hero, a = A.ascOf(h);
    this.reset(); g.modal = null; g.emitModal();
    h.realm = realm; h.stage = REALMS[realm].stages.length - 1; h.exp = C.need(h); h.hp = 1; h.mp = 1; h.dead = false; h.pendingTalent = null;
    h.age = Math.min(h.age, C.maxLife(h) * 0.4); a.injury = 0; a.toxin = 12; a.xinde = 3000;
    if (prep >= 1) a.polish = A.POLISH_DAYS[realm];
    if (prep >= 2) { const it = A.RARE[realm]?.[0]; if (it) C.addItem(h, it.id, 1, it.age); }
    if (prep >= 3) { h.hotbar[8] = 'art:art_qingfeng'; a.nurture = A.NURTURE_DAYS[realm]; }
    if (prep >= 4 && !g.ws.sect) g.ws.sect = { id: 'huangfeng', rank: 4, contrib: 500, joined: g.day, lastPay: g.day, tasks: [], done: 0 } as any;
    const mb = MAJOR_BREAKS[realm]; if (mb?.item && pills) C.addItem(h, mb.item, pills);
    while (h.hotbar.length > A.slotCount(realm) && h.hotbar[h.hotbar.length - 1] === null) h.hotbar.pop();
    this.onLoad(); g.updateUI(true);
    if (want) for (let sd = 1; sd < 2000; sd++) { a.seed = sd; const pv = this.preview(pills); const u = A.fateRoll(h, A.prepSig(pv.prep, pills)); if (want === 'win' ? u < pv.parts.total - 0.2 : u > pv.parts.total + 0.3) break; }
  }
  get h() { return this.g.hero; }
  get asc() { return A.ascOf(this.g.hero); }
  /** 冲关进行中（含场面与总结） */
  get busy() { return !!this.run; }
  /** 关卡中禁止走动 */
  get rooted() { const r = this.run; return !!r && (r.phase === 'pulse' || r.phase === 'cine'); }

  // ================================================================ 准备清单
  ctx(): A.PrepCtx {
    const g = this.g, h = g.hero;
    return {
      place: g.placeBonus(), guard: this.guardName(), hunters: g.rel?.hunters?.().length ?? 0, rep: g.ws.rep ?? 0,
      hasRare: (id, age) => C.bagCount(h, id, age) > 0, artName: C.nurtureArt(h),
    };
  }
  /** 护法人选：同行的红颜 / 同伴 / 结拜；或宗门长老（职位要够） */
  guardName(): string | null {
    const g = this.g, h = g.hero;
    const b = g.hearts?.follower?.(); if (b) return b.name;
    const f = g.npcs?.followers?.()[0]; if (f) return f.d.name;
    for (const d of g.npcs?.list ?? []) if (d.alive && (d.bond === 'sworn' || d.bond === 'master' || d.bond === 'companion') && d.realm >= h.realm) return d.name;
    const s = g.ws.sect; if (s && s.rank >= Math.max(0, h.realm - 1)) return `${LOC_BY_ID.get(s.id)?.name ?? '宗门'}长老`;
    return null;
  }
  prep() { return A.prepList(this.h, this.ctx()); }
  parts(pills: number, extra = 0) { const h = this.h; return A.chanceParts(h, this.prep(), pills, C.rootDef(h).rate, C.mod(h, 'luck'), extra); }
  /** 面板：成功率与天命（准备不变，结果不变） */
  preview(pills: number) {
    const prep = this.prep(), p = A.chanceParts(this.h, prep, pills, C.rootDef(this.h).rate, C.mod(this.h, 'luck'));
    return { prep, parts: p };
  }
  snap(): Snap {
    const g = this.g, h = g.hero, st = C.heroStats(h);
    return { realm: realmName(h.realm, h.stage), hp: st.hp, mp: st.mp, atk: st.atk, def: st.def, sense: Math.round(g.baseSenseRadius * A.SENSE_K[Math.min(5, h.realm)]), speed: Math.round(g.speed), life: C.maxLife(h), slots: A.slotCount(h.realm) };
  }

  // ================================================================ 冲关
  /** 冲击大境界。返回 false 表示没有开始 */
  begin(pills: number): boolean {
    const g = this.g, h = g.hero;
    if (this.run || h.dead || C.bottleneck(h) !== 'major') return false;
    const mb = MAJOR_BREAKS[h.realm]; if (!mb) return false;
    const have = mb.item ? C.bagCount(h, mb.item) : 0;
    const b = A.BASE[h.realm];
    pills = Math.max(0, Math.min(pills, have, b?.max ?? mb.maxItems));
    const prep = this.prep();
    const parts = A.chanceParts(h, prep, pills, C.rootDef(h).rate, C.mod(h, 'luck'));
    const u = A.fateRoll(h, A.prepSig(prep, pills));
    if (mb.item && pills) C.removeItem(h, mb.item, pills);
    let rare: string | undefined;
    if (prep.find((x) => x.id === 'rare')?.ok) { const it = (A.RARE[h.realm] ?? []).find((x) => C.bagCount(h, x.id, x.age ?? 0) > 0); if (it) { C.removeItem(h, it.id, 1, it.age ?? 0); rare = itemDef(it.id).name; } }
    const p = g.player;
    this.run = { realm: h.realm, phase: 'wait', t: 0, x: p.x, y: p.y, pills, prep, parts, u, perf: 0, xinmo: 0, cook: 0, before: this.snap(), rare, ct: 0, cineDur: 0 };
    g.stand(); g.destination = null; g.gathering = null;
    if (g.isFlying) p.flying = false;
    p.sitting = true;
    this.vortex = { x: p.x, y: p.y, k: 0, want: 0.25, t: 0, fail: false, R: 1500 };
    audio.sfx('thunder');
    const r = h.realm;
    if (r === 1 || r >= 4) this.introPulse();
    else if (r === 2) g.xinmo.start((bonus) => { if (this.run) { this.run.xinmo = bonus; g.openDialog(this.condense(0)); } }, 3);
    else if (r === 3) g.xinmo.start((bonus) => { if (this.run) { this.run.xinmo = bonus; this.introWaves(); } }, 5);
    else this.resolve();
    return true;
  }

  private head(title: string): Pick<DNode, 'speaker' | 'title' | 'mood'> { return { speaker: '冲关', title, mood: 'mystic' }; }

  // ---------------------------------------------------------------- 筑基 / 化神：引灵冲脉
  private introPulse() {
    const g = this.g, r = this.run!; const hs = r.realm >= 4;
    g.openDialog({ ...this.head(hs ? '化神 · 元神合一' : '筑基 · 引灵冲脉'), text: hs
      ? '天地元气自四面八方涌来，元婴盘坐丹田，要将十方元气一一炼化。\n\n光点绕行一周，转入金色区间时——按【空格】或点击屏幕，收拢一方元气。正中最亮处为上佳。错一次，元气反冲，伤及元神。'
      : '丹田灵力已满，要一鼓作气冲开奇经八脉。\n\n每条经脉上有一点灵光绕行，转入金色区间时——按【空格】或点击屏幕，引灵力冲关。正中最亮处为上佳。冲偏一次，灵力反噬，气血大损。',
      options: [{ label: '（凝神，引灵力冲脉）', tone: 'gold', act: () => { this.startPulse(); return null; } } as DOpt] });
  }
  private startPulse() {
    const r = this.run!; const hs = r.realm >= 4;
    const names = hs ? PULSE_10 : PULSE_8;
    r.phase = 'pulse'; r.t = 0;
    r.mg = { names, i: 0, ang: 0, spd: hs ? 4.2 : 3.2, zone: rand(1, 5.5), zw: hs ? 0.5 : 0.62, hits: 0, perfect: 0, miss: 0, spins: 0, flash: 0, last: '', t: 0, res: [] };
    if (this.vortex) this.vortex.want = 0.45;
    audio.sfx('chime');
  }
  /** 空格 / 点击 */
  press() {
    const r = this.run; if (!r || r.phase !== 'pulse' || !r.mg) return false;
    const m = r.mg;
    const d = Math.abs(((m.ang - m.zone + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    let res: 'hit' | 'perfect' | 'miss';
    if (d <= m.zw * 0.18) res = 'perfect'; else if (d <= m.zw / 2) res = 'hit'; else res = 'miss';
    this.pulseRes(res);
    return true;
  }
  private pulseRes(res: 'hit' | 'perfect' | 'miss') {
    const g = this.g, r = this.run!, m = r.mg!, h = g.hero;
    m.res.push(res); m.last = res; m.flash = 0.6;
    if (res === 'miss') { m.miss++; h.hp = Math.max(0.05, h.hp - (r.realm >= 4 ? 0.1 : 0.08)); g.juice(0.06, 0.35); g.hurtFlash = 1; audio.sfx('fail'); }
    else { m.hits++; if (res === 'perfect') m.perfect++; audio.sfx(res === 'perfect' ? 'bell' : 'chime'); g.juice(0.03, 0.12); g.renderer?.burst(g.player.x, g.player.y - 70, res === 'perfect' ? '#fff2b0' : '#bfefff', res === 'perfect' ? 30 : 16); }
    m.i++; m.spins = 0;
    if (this.vortex) this.vortex.want = 0.45 + 0.4 * (m.i / m.names.length);
    if (m.i >= m.names.length) {
      const N = m.names.length, sc = (m.hits + 0.5 * m.perfect) / N;
      r.perf = Math.max(-0.15, Math.min(0.15, (sc - 0.6) * 0.4));
      r.phase = 'wait';
      setTimeoutSafe(() => this.resolve(), 0.6, this);
      return;
    }
    m.zone = rand(0, Math.PI * 2); m.spd *= 1.07; m.zw *= 0.96;
  }

  // ---------------------------------------------------------------- 结丹：凝丹火候
  private condense(i: number, pre = ''): DNode {
    const g = this.g, r = this.run!, a = this.asc;
    const R = ['第一转 · 聚元', '第二转 · 凝形', '第三转 · 定丹'][i];
    const intro = [
      '心魔已退。丹田中的液态真元开始旋转，越转越快，要在丹田正中凝成一点。\n\n此时火候最要紧：',
      '真元凝成一团混沌的光球，表面翻涌不定，随时可能溃散。',
      '光球渐渐收缩，表面浮出若隐若现的丹纹。最后一转，决定这颗金丹的成色。',
    ][i];
    const res = (kind: number): DNode => {
      const roll = A.fate(a.seed, 51, i, kind, a.tries[r.realm] ?? 0);
      let add = 0, txt = '';
      if (kind === 0) { add = 0.22 + roll * 0.08; txt = '你以文火慢慢温养，真元不疾不徐地收拢。稳，但也就是稳。'; }
      else if (kind === 1) {
        if (roll < 0.62) { add = 0.42; txt = '武火猛催！真元被压得一紧，凝实了一大截——成了！'; }
        else { add = 0.02; g.hero.hp = Math.max(0.1, g.hero.hp - 0.25); g.juice(0.08, 0.5); txt = '火候过猛，真元险些炸开！你硬生生压住，喷出一口鲜血。'; }
      } else { add = 0.38; g.hero.lifeLost += 3; txt = '你咬破舌尖，以三年寿元为薪，一口心头精血喷在光球上。光球猛地一亮。'; }
      r.cook += add;
      if (this.vortex) this.vortex.want = 0.4 + 0.18 * (i + 1);
      audio.sfx(kind === 1 && add < 0.1 ? 'fail' : 'chime');
      const fire = `（火候 ${Math.round(Math.min(1, r.cook / 1.1) * 100)}%）`;
      if (i < 2) return this.condense(i + 1, `${txt}\n${fire}\n\n`);
      return { ...this.head('结丹 · 金丹将成'), text: `${txt}\n${fire}\n\n三转已毕，光球骤然一缩——`, options: [{ label: '（凝丹！）', tone: 'gold', act: () => { this.resolve(); return null; } } as DOpt] };
    };
    return { ...this.head(`结丹 · ${R}`), text: pre + intro, options: [
      { label: '文火温养（稳妥，成色平平）', act: () => res(0) },
      { label: '武火急炼（六成大进，四成反噬）', act: () => res(1) },
      { label: '以心头精血催丹（折寿三年，必有大进）', tone: 'bad', act: () => res(2) },
    ] as DOpt[] };
  }

  // ---------------------------------------------------------------- 结婴：碎丹成婴 + 外敌来袭
  private introWaves() {
    const g = this.g, r = this.run!;
    const guard = this.guardName();
    g.openDialog({ ...this.head('结婴 · 碎丹成婴'), mood: 'danger', text: `心魔散尽。你内视丹田，那颗苦修百年的金丹静静悬着。\n\n碎丹，便是自毁根基；凝不成元婴，便什么都没了。\n\n灵气漩涡已经卷到百里之外——${guard ? `${guard}立在洞府外，替你护法。` : '没有人替你护法。'}这么大的动静，附近的老怪不会看不见。\n\n（坚持到元婴凝形。守在阵眼之内，离开阵眼或气血见底都会被迫中断。来犯之敌可以出手击退。）`,
      options: [{ label: '（一掌拍碎金丹）', tone: 'bad', act: () => { this.startWaves(guard); return null; } } as DOpt] });
  }
  private startWaves(guard: string | null) {
    const g = this.g, r = this.run!;
    r.phase = 'waves'; r.t = 0;
    r.wv = { prog: 0, wave: 0, waves: 3, foes: [], ally: null, outT: 0, R: 420, t: 0, disturbed: false, guard, note: '金丹碎裂，元婴初孕……', noteT: 3 };
    if (this.vortex) this.vortex.want = 0.75;
    g.juice(0.1, 0.6); audio.sfx('boom');
    g.renderer?.fx?.shock(r.x, r.y, 900, 22, 0.8);
    if (guard) {
      const p = g.player, def = ENEMIES['zhujixiu'];
      const e = new Enemy(def, p.x + 160, p.y + 60, Math.max(3, g.hero.realm), 2);
      e.name = `护法·${guard}`; e.tag = 'asc:ally';
      const f = g.npcs?.followers?.()[0]; if (f) { e.look = g.npcs.look(f.d); g.npcs.dismiss(f.d.id); }
      e.atk *= 1.2;
      g.combat.addAlly(e); e.maxHp = e.hp = Math.round(e.hp * 1.6);
      r.wv.ally = e;
    }
  }
  private spawnWave() {
    const g = this.g, r = this.run!, w = r.wv!;
    w.wave++;
    const n = 2 + w.wave, last = w.wave >= w.waves;
    const a0 = Math.random() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2, d = rand(780, 980);
      const boss = last && k === 0;
      const e = new Enemy(ENEMIES['jindan_mo'], r.x + Math.cos(a) * d, r.y + Math.sin(a) * d * 0.7, boss ? 4 : 3, boss ? 0 : Math.floor(Math.random() * 3));
      e.name = boss ? pick(['觊觎元婴的老魔', '血魂老祖', '阴骨上人']) : pick(['魔道长老', '散修老怪', '夺丹人']);
      e.aggro = true; e.tag = 'asc:foe';
      if (boss) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.2); }
      g.combat.enemies.push(e); w.foes.push(e);
    }
    w.note = last ? '一股元婴期的威压自天边压来——有老魔要夺你的元婴！' : w.wave === 1 ? '漩涡引来了窥伺者，几道遁光直扑洞府！' : '又一波！他们看出你正值紧要关头。';
    w.noteT = 4;
    g.toast(w.note, 'warn'); audio.sfx('thunder'); g.juice(0.05, 0.4);
  }
  private wavesTick(dt: number) {
    const g = this.g, r = this.run!, w = r.wv!, p = g.player, h = g.hero;
    w.t += dt; w.noteT -= dt;
    const alive = w.foes.filter((e) => !e.dead && !e.gone);
    w.disturbed = alive.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 420);
    const inside = Math.hypot(p.x - r.x, p.y - r.y) <= w.R;
    w.outT = inside ? Math.max(0, w.outT - dt * 2) : w.outT + dt;
    if (inside) w.prog += dt / 62 * (w.disturbed ? 0.45 : 1);
    if (this.vortex) this.vortex.want = 0.75 + 0.2 * w.prog;
    const th = [0.06, 0.36, 0.64];
    if (w.wave < w.waves && w.prog >= th[w.wave]) this.spawnWave();
    if (w.outT > 4) return this.interrupt('你离开了阵眼，刚刚成形的元婴一阵溃散——被迫中断！');
    if (h.hp < 0.12 || h.dead) return this.interrupt('气血见底，再撑下去便是身死道消——你被迫中断了结婴！');
    if (w.prog >= 1) {
      for (const e of alive) { e.flee = true; e.aggro = true; }
      if (alive.length) g.toast('元婴已成！来犯之敌见势不妙，纷纷遁走。', 'good');
      r.perf = Math.max(-0.1, Math.min(0.12, (h.hp - 0.45) * 0.2 + (w.ally && !w.ally.dead ? 0.03 : 0)));
      this.endWaves();
      this.resolve();
    }
  }
  private endWaves() { const g = this.g; g.combat.dismissAllies((e) => e.tag === 'asc:ally'); }
  private interrupt(why: string) {
    const r = this.run!; r.interrupted = why;
    for (const e of r.wv?.foes ?? []) if (!e.dead) { e.flee = true; }
    this.endWaves();
    this.resolve();
  }

  // ---------------------------------------------------------------- 结算
  private resolve() {
    const g = this.g, h = g.hero, r = this.run!, a = this.asc;
    const chance = Math.max(0.01, Math.min(A.CHANCE_CAP, r.parts.total + r.perf + Math.max(-0.25, Math.min(0.25, r.xinmo))));
    const ok = !r.interrupted && r.u < chance;
    r.ok = ok;
    const from = r.realm;
    if (ok) {
      const prepFrac = r.prep.filter((x) => x.ok).length / 6;
      if (from === 2) { r.grade = A.coreGrade(a.seed, a.tries[from] ?? 0, prepFrac, r.cook / 1.1, a.toxin); a.core = r.grade; }
      a.tries[from] = (a.tries[from] ?? 0) + 1;
      C.majorUp(h);
      a.polish = 0; a.nurture = Math.floor(a.nurture * 0.3);
      while (h.hotbar.length < A.slotCount(h.realm)) h.hotbar.push(null);
      a.history.push({ realm: from, ok: true, day: Math.floor(g.day), chance, grade: r.grade });
      this.scareHunters();
    } else {
      r.fail = A.applyFail(h, !!r.interrupted);
      a.history.push({ realm: from, ok: false, day: Math.floor(g.day), chance, fell: r.fail.fell });
    }
    if (a.history.length > 30) a.history.splice(0, a.history.length - 30);
    r.phase = 'cine'; r.ct = 0; r.cineDur = ok ? 9.5 : 4.5;
    (r as any).chance = chance;
    this.cineStart(ok);
    g.updateUI(true);
    g.save(0);
  }

  // ---------------------------------------------------------------- 场面
  private cineStart(ok: boolean) {
    const g = this.g, r = this.run!, v = this.vortex;
    if (v) { v.fail = !ok; v.want = ok ? 1 : 0.6; }
    g.cinema(r.x, r.y - 120, ok ? 0.42 : 0.7, r.cineDur);
    this.inkShots = ok ? [1.0, 3.3, 6.2] : [0.8];
    this.cal = [];
    const name = REALMS[r.realm + 1]?.name ?? '';
    if (ok) {
      this.cal.push({ text: '天地灵气倒灌而下', t: -0.2, dur: 2.4, color: '#1a1410', vertical: true });
      const big = r.realm === 1 ? '筑基' : r.realm === 2 ? '金丹' : r.realm === 3 ? '元婴' : name;
      const sub = r.realm === 1 ? '奇经八脉　尽数贯通' : r.realm === 2 ? `${A.CORE_NAME[r.grade ?? 1]}金丹　${A.CORE_DESC[r.grade ?? 1]}` : r.realm === 3 ? '碎丹成婴　寿元千载' : '元神合一　俯瞰人界';
      this.cal.push({ text: big, sub, t: -2.6, dur: 3.6, color: '#140e0a' });
      if (r.realm === 3) this.cal.push({ text: '元婴出世', t: -5.4, dur: 2.6, color: '#3a1450', vertical: true });
      else this.cal.push({ text: name + '成矣', t: -5.6, dur: 2.4, color: '#5a1a10', vertical: true });
      this.soulT = r.realm === 3 ? 5.0 : -1;
    } else {
      this.cal.push({ text: r.interrupted ? '功败垂成' : '功亏一篑', sub: r.fail?.fell ? '境界跌落' : '灵力反噬', t: -0.5, dur: 3.2, color: '#5a0e0a' });
    }
    audio.sfx(ok ? 'boom' : 'fail');
  }
  private cineTick(rdt: number) {
    const g = this.g, r = this.run!, h = g.hero, prev = r.ct;
    r.ct += rdt;
    const at = (T: number) => prev < T && r.ct >= T;
    for (const c of this.cal) c.t += rdt;
    if (r.ok) {
      if (r.ct > 1.0 && r.ct < 2.6) g.slowmo(0.15);
      if (r.ct > 3.4 && r.ct < 4.6) g.slowmo(0.15);
      if (at(0.4)) { audio.sfx('thunder'); g.juice(0.05, 0.4); }
      if (at(1.0)) { g.renderer?.fx?.shock(r.x, r.y, 1100, 26, 0.9); audio.sfx('bell'); }
      if (at(3.3)) {
        g.renderer?.burst(r.x, r.y - 60, '#fff2b0', 80);
        (g.combat as any).vfx.push({ kind: 'aura', x: r.x, y: r.y, r: 170, t: 0, dur: 3.2, color: r.realm === 3 ? '220,180,255' : '255,240,180', fx: 'breakthrough' });
        g.juice(0.12, 0.8); g.aberrKick = 1; audio.sfx('break'); audio.sfx('boom');
        g.renderer?.fx?.shock(r.x, r.y, 1600, 34, 1.1);
      }
      if (at(6.2)) { audio.sfx('bell'); g.renderer?.fx?.shock(r.x, r.y, 900, 16, 0.7); }
      if (at(7.5) && this.vortex) this.vortex.want = 0;
    } else {
      if (at(0.2)) { g.juice(0.1, 0.9); g.hurtFlash = 1; g.renderer?.fx?.shock(r.x, r.y, 700, 30, 0.6); }
      if (at(1.6) && this.vortex) this.vortex.want = 0;
    }
    if (r.ct >= r.cineDur) this.finish();
    void h;
  }
  private finish() {
    const g = this.g, r = this.run!, h = g.hero, after = this.snap();
    const ok = !!r.ok;
    const lines: string[] = [], extra: string[] = [];
    const chance = (r as any).chance as number;
    if (ok) {
      const nr = h.realm;
      if (r.realm === 2 && r.grade) extra.push(`金丹品阶：${A.CORE_NAME[r.grade]}——${A.CORE_DESC[r.grade]}。终身带着：属性 ${r.grade >= 5 ? '+' : ''}${(r.grade - 5) * 4}%，修炼速度 ${r.grade >= 5 ? '+' : ''}${(r.grade - 5) * 3}%。`);
      extra.push(`新的神通位：快捷栏第 ${after.slots} 格（按键 ${A.SLOT_KEYS[after.slots - 1]}）。`);
      if (nr === 4) { extra.push('元婴神通「瞬移」：按 X，向前方一闪数十丈（冷却 4 秒）。'); extra.push('元婴神通「出窍」：按 V，元婴离体神游三十息，神识倍增、遁速极快；肉身受袭立刻归窍。'); extra.push('元婴之身常带灵光。'); }
      if (nr >= 3) extra.push('境界低你一筹、还在追杀你的仇家，往后见了你只会逃。');
      if (r.rare) lines.push(`以${r.rare}辅助冲关。`);
      lines.push(`寿元增至 ${after.life} 载。`);
    } else {
      lines.push(...(r.interrupted ? [r.interrupted] : []), ...(r.fail?.lines ?? []));
    }
    this.summary = { ok, title: ok ? `${REALMS[h.realm].name}成矣` : '冲关失败', realm: realmName(h.realm, h.stage), lines, before: r.before, after, chance, extra, grade: r.grade };
    r.phase = 'summary';
    this.cal = [];
    g.cine.dur = 0;
  }
  closeSummary() { this.summary = null; this.run = null; this.soulT = -1; this.g.updateUI(true); }

  /** 低阶仇家见你就逃（简单版） */
  private scareHunters() {
    const g = this.g, h = g.hero;
    const P: any = g.pursuit?.cur;
    if (P && P.realm < h.realm && !P.e.dead) { g.toast(`${P.name}察觉你气息暴涨，脸色大变，转身就逃！`, 'good'); try { (g.pursuit as any).end('escaped'); } catch { /* */ } }
    this.fleeTick(true);
  }
  private fleeTick(loud = false) {
    const g = this.g, h = g.hero, p = g.player;
    let n = 0;
    for (const e of g.combat.enemies) {
      if (e.dead || e.flee || e.ally || e.realm >= h.realm || e.def.kind !== 'human') continue;
      const grudge = (e as any).grudge || (e as any).pursuer || (e.npcId && (g.npcs.byId.get(e.npcId)?.grudge ?? 0) > 0);
      if (!grudge || Math.hypot(e.x - p.x, e.y - p.y) > g.senseRadius) continue;
      e.flee = true; e.aggro = true; n++;
      g.combat.texts.push({ x: e.x, y: e.y - 90, s: pick(['不好，他突破了！', '快走！', '这……这是什么威压！']), color: '#e8d8a8', t: 0, vy: -30 });
    }
    const act: any = (g.npcs as any).active;
    if (act) for (const a of act.values()) {
      const d = a.d; if (!d?.alive || d.realm >= h.realm || !((d.grudge ?? 0) > 0 || d.hunting)) continue;
      if (a.act === 'approach' || d.hunting) { a.act = 'flee'; d.hunting = false; a.bubble = { text: '他……他怎么又突破了？！', t: 2.5 }; n++; }
    }
    if (loud && n) g.toast(`${n} 个低阶仇家见势不妙，四散奔逃。`, 'good');
  }

  // ================================================================ 闭关：心得、打磨、打断
  /** 瓶颈上还能继续闭关打磨根基 */
  polishing() { const h = this.h; return C.bottleneck(h) === 'major' && this.asc.polish < A.POLISH_DAYS[Math.min(5, h.realm)]; }
  /** 闭关一日的效率（耗心得）：有心得 ×1.5，没有则闭门造车 */
  secludeEff(days: number) {
    const a = this.asc;
    if (a.xinde >= days) { a.xinde -= days; return A.SECLUDE_FOCUS; }
    const k = a.xinde / days; a.xinde = 0;
    return A.SECLUDE_FOCUS * k + A.SECLUDE_DRY * (1 - k);
  }
  /** 闭关前：若这次闭关会撞上下一次“打扰”，就在那天截断 */
  secludeCap(cap: number): number {
    const g = this.g, a = this.asc;
    if (!a.nextIntr) a.nextIntr = Math.floor(g.day) + 720 + A.intrGap(g.hero, a.intrN);
    const left = a.nextIntr - g.day;
    if (left < cap && left >= 20) { this.pendIntr = true; return Math.max(1, left); }
    if (left < 20 && cap > 20) { a.nextIntr = Math.floor(g.day) + 20; this.pendIntr = true; return 20; }
    return cap;
  }
  private pendIntr = false;
  /** 闭关结束：若到了打扰之日，返回出关原因并排上弹窗 */
  secludeEnd(days: number, reachedCap: boolean): string | null {
    const g = this.g, a = this.asc;
    if (!this.pendIntr) return null;
    this.pendIntr = false;
    if (!reachedCap || g.day < a.nextIntr - 0.5) return null;
    a.intrN++; a.nextIntr = Math.floor(g.day) + A.intrGap(g.hero, a.intrN);
    const ev = this.makeIntr();
    if (!ev) return null;
    this.q.push(ev.node);
    return ev.reason;
  }
  private makeIntr(): { node: DNode; reason: string } | null {
    const g = this.g, h = g.hero, a = this.asc, p = g.player;
    const kinds = ['foe', 'love', 'sect', 'beast'];
    for (let k = 0; k < kinds.length; k++) {
      const kind = kinds[(a.intrN + k) % kinds.length];
      if (kind === 'foe') {
        const foes = (g.rel?.hunters?.() ?? []).filter((d: any) => d.alive && d.realm >= 1 && !d.beauty);
        const d: any = foes[0];
        if (d) return { reason: `仇家${d.name}找上门来`, node: { speaker: '洞府禁制', title: '闭关被打断', mood: 'danger', text: `洞府外的禁制一阵乱颤，被人一指点破了一层。\n\n「韩立！${d.why ?? '你我的旧账'}——躲在乌龟壳里就算完了？给我滚出来！」\n\n是${d.name}（${realmName(d.realm, d.stage)}）。他循着灵气波动找上门来了。`, options: [
          { label: '（出关迎敌）', tone: 'bad', act: () => { g.rel.startHunt(d, true, true); return null; } },
        ] } };
        // 没有仇家：闭关的灵气波动引来劫修
        return { reason: '闭关时的灵气波动引来了劫修', node: { speaker: '洞府禁制', title: '闭关被打断', mood: 'danger', text: '入定之中，你忽然心血来潮——洞府外有几道神识在来回扫探。\n\n「就是这里，灵气波动错不了。里面那位道友闭关正到紧要处，咱们发财了。」\n\n劫修。闭关的灵气外泄，把他们引来了。', options: [
          { label: '（出关迎敌）', tone: 'bad', act: () => { this.spawnRaid(Math.max(1, h.realm), 3, '劫修'); return null; } },
        ] } };
      }
      if (kind === 'love') {
        const bs = BEAUTIES.filter((b) => { const s = g.ws.hearts?.[b.id]; return s?.met && !s.flags?.parted && (s.favor ?? 0) >= 15 && g.npcs.byId.get('b_' + b.id)?.alive; });
        if (!bs.length) continue;
        const b = bs[Math.floor(A.fate(a.seed, 3, a.intrN) * bs.length)];
        const ang = Math.random() * Math.PI * 2, x = p.x + Math.cos(ang) * rand(2600, 4200), y = p.y + Math.sin(ang) * rand(1800, 3000);
        const okLand = g.terrain.walkFactor(x, y) > 0 || h.realm >= 2;
        if (!okLand) continue;
        const t: A.AscTask = { id: Date.now() % 1e9 + Math.floor(Math.random() * 1000), kind: 'love', x, y, until: g.day + 6, who: b.name, whoId: 'b_' + b.id, realm: Math.max(1, Math.min(4, h.realm)), done: false };
        a.tasks.push(t);
        return { reason: `${b.name}传来求救玉符`, node: { speaker: '传音玉符', title: b.name, mood: 'love', text: `一道传音玉符撞破洞府禁制，落在你膝前，碎成点点灵光。\n\n是${b.name}的声音，断断续续：「……我被人围住了……你若还记得我……」\n\n声音戛然而止。玉符里残存的方位，在${'此地'}${dirOf(x - p.x, y - p.y)}方约 ${Math.round(Math.hypot(x - p.x, y - p.y) / 30)} 丈。\n\n（六日之内赶到。地图上标着「救」字。）`, options: [
          { label: '（立刻出关赶去）', tone: 'love', act: () => { g.setGuide(x, y, `${b.name}遇险处`); return null; } },
          { label: '（闭关要紧……）', act: () => { return { speaker: '', title: '', text: '你在蒲团上坐了很久，终究没有动。\n\n（若六日内不去，她多半会怨你——也可能更糟。）', options: [{ label: '……', act: () => null }] }; } },
        ] } };
      }
      if (kind === 'sect') {
        const s = g.ws.sect; if (!s) continue;
        const L = locHere(s.id); if (!L) continue;
        const sx = L.x * WORLD_SCALE, sy = L.y * WORLD_SCALE, ang = Math.random() * Math.PI * 2;
        const x = sx + Math.cos(ang) * rand(1800, 2800), y = sy + Math.sin(ang) * rand(1200, 2000);
        const t: A.AscTask = { id: Date.now() % 1e9 + Math.floor(Math.random() * 1000), kind: 'sect', x, y, until: g.day + 15, who: LOC_BY_ID.get(s.id)?.name ?? '宗门', realm: Math.max(1, Math.min(4, h.realm)), done: false };
        a.tasks.push(t);
        return { reason: `${t.who}召集门人`, node: { speaker: '传讯纸鹤', title: t.who, mood: 'danger', text: `宗门的传讯纸鹤一头撞进洞府，翅上燃着红光——这是急令。\n\n「魔道探子潜入山门外围，凡在册弟子速归，协同执事堂清剿。逾期不归者，记过一次。」\n\n（十五日内赶到山门外标着「召」字的地方。去了记贡献，不去扣贡献。）`, options: [
          { label: '（出关，回山门）', tone: 'gold', act: () => { g.setGuide(x, y, `${t.who}召集处`); return null; } },
          { label: '（假装没看见）', act: () => { s.contrib = Math.max(0, s.contrib - 30); t.done = true; g.toast('你没有应召——宗门记你一过，贡献 -30。', 'warn'); return null; } },
        ] } };
      }
      // 兽潮
      return { reason: '闭关的灵气引来了妖兽', node: { speaker: '洞府禁制', title: '闭关被打断', mood: 'danger', text: '地面隐隐震动。\n\n你闭关时外泄的灵气，在山里飘了几个月，终于把方圆百里的妖兽都引来了。洞府外传来此起彼伏的嘶吼。', options: [
        { label: '（出关）', tone: 'bad', act: () => { this.spawnRaid(Math.max(1, h.realm), 4, '妖兽'); return null; } },
      ] } };
    }
    return null;
  }
  /** 在你身边刷一队来犯者 */
  private spawnRaid(realm: number, n: number, kind: '劫修' | '妖兽') {
    const g = this.g, p = g.player;
    const beast = kind === '妖兽';
    const pool = beast ? ['wolf', 'redwolf', 'boar'] : [realm >= 3 ? 'jindan_mo' : realm >= 2 ? 'zhujixiu' : 'bandit'];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random(), d = rand(420, 620);
      const def = ENEMIES[pick(pool)] ?? ENEMIES['bandit'];
      const e = new Enemy(def, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7, realm, Math.floor(Math.random() * 2));
      if (!beast) e.name = k === 0 ? '劫修头目' : '劫修';
      e.aggro = true; e.tag = 'asc:raid';
      if (k === 0) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.4); }
      g.combat.enemies.push(e);
    }
    g.toast(beast ? '妖兽围上来了！' : '劫修围上来了！', 'warn');
  }
  /** 出关后的任务点（红颜遇险 / 宗门召集） */
  private taskTick() {
    const g = this.g, a = this.asc, p = g.player, h = g.hero;
    for (const t of a.tasks) {
      if (t.done) continue;
      if (g.day > t.until) {
        t.done = true;
        if (t.kind === 'love') { const s = g.ws.hearts?.[t.whoId!.slice(2)]; if (s) s.favor = Math.max(0, s.favor - 18); g.rel?.log?.(`${t.who}向你求救，你没有去。她侥幸脱身，却从此冷淡了许多。`, 'bad'); g.toast(`${t.who}的求救已过了时限……`, 'warn'); }
        else if (t.kind === 'sect' && g.ws.sect) { g.ws.sect.contrib = Math.max(0, g.ws.sect.contrib - 30); g.toast('宗门召集已过时限，你被记过一次（贡献 -30）。', 'warn'); }
        continue;
      }
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      const rt = this.rt.get(t.id);
      if (!rt && d < 1500) {
        const foes: Enemy[] = [];
        const n = t.kind === 'love' ? 4 : 5;
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * Math.PI * 2, rr = rand(260, 380);
          const r = Math.max(1, Math.min(4, t.realm - (k ? (Math.random() < 0.5 ? 1 : 0) : 0)));
          const e = new Enemy(ENEMIES[t.kind === 'sect' ? (r >= 3 ? 'jindan_mo' : 'moxiu') : r >= 3 ? 'jindan_mo' : r >= 2 ? 'zhujixiu' : 'bandit'] ?? ENEMIES['bandit'], t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr * 0.7, r, Math.floor(Math.random() * 3));
          e.name = t.kind === 'sect' ? (k === 0 ? '魔道探子头目' : '魔道探子') : (k === 0 ? '截杀者头目' : '截杀者');
          e.aggro = true; e.tag = 'asc:task'; if (k === 0) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.5); }
          g.combat.enemies.push(e); foes.push(e);
        }
        if (t.kind === 'love' && t.whoId) { const nd = g.npcs.byId.get(t.whoId); if (nd) { nd.x = t.x; nd.y = t.y; nd.helpUntil = g.time + 120; g.npcs.summon(nd.id); } }
        this.rt.set(t.id, { foes });
        g.toast(t.kind === 'love' ? `${t.who}就在前面，被人围住了！` : '魔道探子就在前面！', 'warn');
      } else if (rt && rt.foes.every((e) => e.dead || e.gone)) {
        t.done = true; this.rt.delete(t.id);
        if (t.kind === 'love') { const s = g.ws.hearts?.[t.whoId!.slice(2)]; if (s) s.favor = Math.min(100, s.favor + 15); g.rel?.log?.(`你出关赶去，救下了${t.who}。`, 'good'); g.toast(`救下了${t.who}！她看你的眼神不一样了（好感 +15）`, 'good'); }
        else { const s = g.ws.sect; if (s) s.contrib += 40 + 20 * h.realm; g.toast(`清剿了魔道探子，宗门记功（贡献 +${40 + 20 * h.realm}）。`, 'good'); }
        a.xinde = Math.min(A.xindeCap(h.realm), a.xinde + 60 * (1 + h.realm));
      }
    }
    if (a.tasks.length > 12) a.tasks = a.tasks.filter((t) => !t.done).slice(-12);
  }

  // ================================================================ 悟道之地
  wudaoAt(x: number, y: number): A.WudaoDef | null {
    for (const w of A.WUDAO) { const L = locHere(w.loc); if (L && Math.hypot(L.x * WORLD_SCALE - x, L.y * WORLD_SCALE - y) < A.WUDAO_R) return w; }
    return null;
  }
  private wudaoTick() {
    const g = this.g, p = g.player, h = g.hero, a = this.asc;
    if (!p.sitting) return;
    const w = this.wudaoAt(p.x, p.y); if (!w) return;
    const last = a.wudao[w.id];
    if (last !== undefined && g.day - last < A.WUDAO_CD) return;
    a.wudao[w.id] = Math.floor(g.day);
    const xd = 300 * (1 + h.realm), ex = Math.round(C.need(h) * 0.06);
    a.xinde = Math.min(A.xindeCap(h.realm) * 1.5, a.xinde + xd);
    const out: C.Msg[] = []; C.gainExp(h, ex, out);
    audio.sfx('bell');
    this.q.push({ speaker: w.name, title: '悟道之地', mood: 'mystic', text: `${w.text}\n\n你在此枯坐良久，心中忽有所悟。\n\n（顿悟：心得 +${xd} 日，修为 +${ex}。此地十年后可再悟。）`, options: [{ label: '（起身）', act: () => null }] });
  }

  // ================================================================ 元婴神通
  blink() {
    const g = this.g, h = g.hero, p = g.player;
    if (h.realm < 4 || this.run || g.halted) return false;
    if (this.blinkCd > 0) { g.toast(`瞬移尚需 ${this.blinkCd.toFixed(1)} 秒`, 'warn'); return true; }
    if (h.mp < 0.05) { g.toast('法力不足，无法瞬移。', 'warn'); return true; }
    const k = g.input.keys;
    let dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (!dx && !dy) dx = p.facing || 1;
    const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    const D = 700;
    let nx = p.x + dx * D, ny = p.y + dy * D;
    if (!g.isFlying && g.terrain.walkFactor(nx, ny) <= 0) { nx = p.x + dx * D * 0.5; ny = p.y + dy * D * 0.5; if (g.terrain.walkFactor(nx, ny) <= 0) { g.toast('前方无处落脚。', 'warn'); return true; } }
    (g.combat as any).vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 90, t: 0, dur: 0.45, color: '230,200,255' });
    p.x = nx; p.y = ny;
    (g.combat as any).vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 90, t: 0, dur: 0.45, color: '230,200,255' });
    g.cam.x += dx * D * 0.6; g.cam.y += dy * D * 0.6;
    h.mp = Math.max(0, h.mp - 0.04); this.blinkCd = 4;
    audio.sfx('whoosh');
    return true;
  }
  toggleOut() {
    const g = this.g, h = g.hero, p = g.player;
    if (h.realm < 4 || this.run || g.halted) return false;
    if (this.out) { this.returnSoul('元婴归窍。'); return true; }
    if (this.outCd > 0) { g.toast(`元婴尚需温养 ${Math.ceil(this.outCd)} 秒方能再出窍`, 'warn'); return true; }
    this.out = { x: p.x, y: p.y, t: 30, hp: h.hp };
    if (g.canFlyNative) p.flying = true;
    p.sitting = false;
    audio.sfx('chime');
    g.toast('元婴出窍！神游三十息——神识倍增，遁速极快（再按 V 归窍）。', 'good');
    return true;
  }
  private returnSoul(msg: string) {
    const g = this.g, p = g.player, o = this.out; if (!o) return;
    (g.combat as any).vfx.push({ kind: 'blinkfx', x: p.x, y: p.y, r: 80, t: 0, dur: 0.45, color: '230,200,255' });
    p.x = o.x; p.y = o.y; g.cam.x = o.x; g.cam.y = o.y;
    this.out = null; this.outCd = 60;
    g.toast(msg, 'info'); audio.sfx('whoosh');
  }
  /** 神识 / 遁速倍率（给 game.ts 的 getter 用） */
  get senseK() { return A.SENSE_K[Math.min(5, this.g.hero.realm)] * (this.out ? 2 : 1); }
  get speedK() { return A.SPEED_K[Math.min(5, this.g.hero.realm)] * (this.out ? 1.7 : 1) * (A.injured(this.g.hero) ? 0.8 : 1); }

  /** 按键：返回 true 表示已处理 */
  key(k: string): boolean {
    const g = this.g;
    if (this.summary && (k === 'enter' || k === 'escape' || k === ' ')) { this.closeSummary(); return true; }
    if (this.run?.phase === 'pulse' && (k === ' ' || k === 'enter')) return this.press();
    if (this.run) return k === ' ';
    const i = A.SLOT_KEYS.indexOf(k);
    if (i >= 9 && i < g.hero.hotbar.length) { g.combat.castSlot(i); return true; }
    if (k === 'x') return this.blink();
    if (k === 'v') return this.toggleOut();
    return false;
  }
  /** 大地图标记 */
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    const v = this.vortex; if (v && v.k > 0.05) out.push({ x: v.x, y: v.y, glyph: '旋', color: v.fail ? '#c05040' : '#ffd27a', ring: v.R * v.k, name: '灵气漩涡' });
    for (const t of this.asc.tasks) if (!t.done) out.push({ x: t.x, y: t.y, glyph: t.kind === 'love' ? '救' : '召', color: t.kind === 'love' ? '#ff9ec0' : '#ffcf6a', name: t.kind === 'love' ? `${t.who}遇险` : `${t.who}召集` });
    for (const w of A.WUDAO) { const L = locHere(w.loc); if (L && this.g.isExplored(L.x * WORLD_SCALE, L.y * WORLD_SCALE)) out.push({ x: L.x * WORLD_SCALE, y: L.y * WORLD_SCALE, glyph: '悟', color: '#a8d8ff', name: w.name + '（悟道之地）' }); }
    return out;
  }
  /** 配乐 */
  music(): 'boss' | 'cultivate' | null { const r = this.run; if (!r) return null; return r.phase === 'waves' || r.phase === 'cine' || r.phase === 'pulse' ? 'boss' : null; }

  // ================================================================ 每帧
  update(dt: number) {
    const g = this.g, h = g.hero, p = g.player, a = this.asc;
    // 慢动作时 dt 已被缩放：场面按真实时间走
    const rdt = g.slowT > 0 ? dt / 0.3 : dt;
    if (this.q.length && !g.modal && !g.paused && !h.dead && !this.run) { const n = this.q.shift()!; audio.sfx('chime'); g.openDialog(n); }
    if (g.paused) return;   // 暂停（面板、截图）时场面定格
    this.blinkCd = Math.max(0, this.blinkCd - dt); this.outCd = Math.max(0, this.outCd - dt);
    // 心得：在外面跑、打怪
    if (!g.halted && !h.dead && !this.run) {
      if (!p.sitting) a.xinde = Math.min(A.xindeCap(h.realm), a.xinde + A.XINDE_ACTIVE * dt);
      if (this.kills0 < 0) this.kills0 = h.kills;
      if (h.kills > this.kills0) {
        const n = Math.min(5, h.kills - this.kills0);
        a.xinde = Math.min(A.xindeCap(h.realm), a.xinde + n * A.XINDE_KILL * (1 + h.realm));
        const out: C.Msg[] = []; C.gainExp(h, C.expPerDay(h) * A.KILL_EXP_DAYS * (1 + h.realm) * n, out);
        for (const m of out) g.toast(m.text, m.kind === 'good' ? 'good' : 'info');
      }
      this.kills0 = h.kills;
    } else this.kills0 = h.kills;
    // 每半秒
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      if (!this.run) { this.taskTick(); this.wudaoTick(); if (h.realm >= 3) this.fleeTick(); }
    }
    // 出窍
    if (this.out) {
      this.out.t -= dt;
      if (h.hp < this.out.hp - 0.02) this.returnSoul('肉身受袭！元婴急忙归窍。');
      else if (this.out.t <= 0) this.returnSoul('神游时限已到，元婴归窍。');
      else this.out.hp = Math.max(this.out.hp, h.hp);
    }
    // 漩涡
    const v = this.vortex;
    if (v) { v.t += rdt; v.k += (v.want - v.k) * Math.min(1, rdt * (v.want > v.k ? 0.9 : 0.5)); if (v.want === 0 && v.k < 0.01 && !this.run) this.vortex = null; }
    // 水墨镜头
    this.ink = 0;
    const r = this.run;
    if (r && r.phase === 'cine') for (const s of this.inkShots) { const u = r.ct - s; if (u > -0.08 && u < 0.6) this.ink = Math.max(this.ink, u < 0 ? (u + 0.08) / 0.08 : u < 0.35 ? 1 : 1 - (u - 0.35) / 0.25); }
    // 元婴显化
    if (r && r.phase === 'cine' && this.soulT >= 0) { this.soulK = Math.min(1, Math.max(0, (r.ct - this.soulT) / 1.2)) * Math.min(1, Math.max(0, (r.cineDur + 0.6 - r.ct) / 1.4)); }
    else this.soulK = Math.max(0, this.soulK - rdt);
    if (!r) return;
    // 冲关中：钉在原地打坐
    if (r.phase === 'pulse' || r.phase === 'cine' || r.phase === 'wait') {
      for (const k of ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) g.input.keys.delete(k);
      g.destination = null; if (!p.sitting && !g.halted) p.sitting = true;
    }
    if (r.phase === 'pulse' && r.mg && !g.halted) {
      const m = r.mg; m.t += rdt; m.flash = Math.max(0, m.flash - rdt);
      m.ang += m.spd * rdt;
      if (m.ang >= Math.PI * 2) { m.ang -= Math.PI * 2; m.spins++; if (m.spins >= 2) this.pulseRes('miss'); }
    } else if (r.phase === 'waves' && r.wv && !g.halted) this.wavesTick(dt);
    else if (r.phase === 'cine') this.cineTick(rdt);
    this.pendT = Math.max(0, this.pendT - rdt);
    if (this.pendT <= 0 && this.pendF) { const f = this.pendF; this.pendF = null; f(); }
  }
  pendT = 0; pendF: (() => void) | null = null;

  // ================================================================ 画面
  /** WebGL 发光层：漩涡、元婴、灵光 */
  drawGL(F: FxSys, t: number) {
    const g = this.g, p = g.player, v = this.vortex;
    if (v && v.k > 0.01) {
      const cx = v.x, cy = v.y - 240, R = v.R * v.k;
      const col: [number, number, number] = v.fail ? [1, 0.35, 0.25] : [1, 0.86, 0.55];
      const col2: [number, number, number] = v.fail ? [0.6, 0.1, 0.1] : [0.55, 0.85, 1];
      F.glow(cx, cy, R * 0.35, col, 0.22 * v.k);
      F.glow(cx, cy, R * 0.12, [1, 1, 0.9], 0.6 * v.k);
      for (let i = 0; i < 6; i++) F.ring(cx, cy, R * (0.25 + i * 0.14) * (1 + 0.03 * Math.sin(t * 2 + i)), i % 2 ? col : col2, 0.18 * v.k * (1 - i * 0.12), 0.42, true, t * (0.6 + i * 0.15) * (i % 2 ? 1 : -1));
      // 旋臂
      for (let k = 0; k < 5; k++) {
        const pts: [number, number][] = [];
        for (let j = 0; j <= 18; j++) { const u = j / 18, ang = k * 1.2566 + u * 4.2 - t * 1.6, rr = R * (0.08 + u * 0.92); pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.42]); }
        F.trail(pts, 26 * (0.6 + v.k), k % 2 ? col : col2, 0.22 * v.k);
      }
      // 灵气倒灌的光柱
      F.beam(cx, cy, v.x, v.y - 40, 70 + 120 * v.k, col, 0.16 * v.k);
      if (Math.random() < 0.5 * v.k) F.sparks(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R * 0.4, col, 2, 160, 0.9, 3);
      if (this.run?.phase === 'waves' && this.run.wv) F.ring(v.x, v.y, this.run.wv.R, this.run.wv.outT > 0 ? [1, 0.3, 0.2] : [1, 0.85, 0.5], 0.5, 0.55, false, t * 0.5);
    }
    // 元婴显化 / 元婴灵光
    const sk = this.soulK;
    if (sk > 0.01) { F.glow(p.x, p.y - 230, 120 * sk, [0.85, 0.7, 1], 0.55 * sk); F.glow(p.x, p.y - 230, 46 * sk, [1, 0.95, 0.8], 0.9 * sk); F.beam(p.x, p.y - 230, p.x, p.y - 60, 30, [0.9, 0.75, 1], 0.3 * sk); }
    if (g.hero.realm >= 4 && !g.concealed) {
      const pu = 0.7 + 0.3 * Math.sin(t * 1.8);
      F.glow(p.x, p.y - 70, 110, [0.82, 0.68, 1], 0.12 * pu);
      F.ring(p.x, p.y - 6, 70 + 6 * Math.sin(t * 2), [0.9, 0.75, 1], 0.12 * pu, 0.45, true, t * 0.4);
    } else if (g.hero.realm === 3 && (g.hero.asc?.core ?? 0) >= 7 && !g.concealed) F.glow(p.x, p.y - 60, 60, [1, 0.85, 0.45], 0.08);
    if (this.out) { const o = this.out; F.glow(o.x, o.y - 60, 80, [0.8, 0.7, 1], 0.25); F.glow(p.x, p.y - 60, 140, [0.85, 0.7, 1], 0.3); }
  }
  /** 无 WebGL 时的黑白水墨镜头（Canvas 合成：去色 → 提反差 → 纸色 → 墨晕） */
  inkCanvas(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const k = Math.min(1, this.ink);
    ctx.save();
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = k * 0.55; ctx.fillStyle = '#7a7a7a'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k * 0.6; ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = k;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(14,12,10,0)'); vg.addColorStop(1, 'rgba(14,12,10,0.85)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  /** Canvas 世界层：漩涡的云、元婴的身形、出窍时留下的肉身 */
  collect(list: { y: number; k?: string; draw: (ctx: CanvasRenderingContext2D) => void }[], _view: unknown, t: number) {
    const g = this.g, v = this.vortex, p = g.player;
    if (v && v.k > 0.02) list.push({ y: 1e9, k: 'D·突破', draw: (ctx) => drawVortexClouds(ctx, v, t) });
    if (this.soulK > 0.02) list.push({ y: 1e9 + 1, k: 'D·突破', draw: (ctx) => drawSoul(ctx, p.x, p.y - 230, this.soulK, t) });
    if (this.out) { const o = this.out; list.push({ y: o.y, k: 'D·突破', draw: (ctx) => drawBody(ctx, o.x, o.y, t) }); list.push({ y: 1e9 + 2, k: 'D·突破', draw: (ctx) => drawSoul(ctx, p.x, p.y - 110, 0.7, t) }); }
  }
}

function dirOf(dx: number, dy: number) { const a = Math.atan2(dy, dx); const i = Math.round(a / (Math.PI / 4)); return ['东', '东南', '南', '西南', '西', '西北', '北', '东北', '东'][(i + 8) % 8]; }
/** 延时（随冲关时钟走，不用浏览器定时器，便于测试与暂停） */
function setTimeoutSafe(f: () => void, sec: number, s: AscendSys) { s.pendT = sec; s.pendF = f; }

function drawVortexClouds(ctx: CanvasRenderingContext2D, v: Vortex, t: number) {
  const cx = v.x, cy = v.y - 260, R = v.R * v.k, k = v.k;
  ctx.save();
  // 灵气倒灌的光柱（落在主角头顶）
  const bw = 60 + 110 * k;
  const bg = ctx.createLinearGradient(0, cy, 0, v.y);
  bg.addColorStop(0, v.fail ? `rgba(255,120,90,${0.05 * k})` : `rgba(255,246,210,${0.08 * k})`); bg.addColorStop(1, v.fail ? `rgba(255,90,60,${0.32 * k})` : `rgba(255,248,220,${0.42 * k})`);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(cx - bw * 0.4, cy); ctx.lineTo(cx + bw * 0.4, cy); ctx.lineTo(v.x + bw * 0.6, v.y); ctx.lineTo(v.x - bw * 0.6, v.y); ctx.closePath(); ctx.fill();
  ctx.translate(cx, cy); ctx.scale(1, 0.42);
  // 乌云旋臂
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const rr = R * (0.16 + i * 0.075), a0 = t * (0.9 - i * 0.04) * (i % 3 === 0 ? -1 : 1) + i * 1.7;
    ctx.lineWidth = R * 0.075 * (1 - i * 0.045);
    ctx.strokeStyle = v.fail ? `rgba(70,18,14,${0.3 * k * (1 - i * 0.05)})` : `rgba(34,36,46,${0.28 * k * (1 - i * 0.05)})`;
    ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + Math.PI * (1.0 + 0.35 * Math.sin(t * 0.7 + i))); ctx.stroke();
  }
  // 发光旋臂
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < 5; s++) {
    ctx.beginPath();
    for (let j = 0; j <= 40; j++) { const u = j / 40, ang = s * 1.2566 + u * 4.4 - t * 1.6, rr = R * (0.05 + u * 0.95); const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.lineWidth = 14 + 30 * k;
    ctx.strokeStyle = v.fail ? `rgba(255,110,80,${0.16 * k})` : s % 2 ? `rgba(255,220,150,${0.2 * k})` : `rgba(160,220,255,${0.2 * k})`;
    ctx.stroke();
  }
  // 漩涡之眼
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
  gr.addColorStop(0, v.fail ? `rgba(255,170,140,${0.8 * k})` : `rgba(255,252,235,${0.9 * k})`); gr.addColorStop(0.4, v.fail ? `rgba(220,80,60,${0.3 * k})` : `rgba(255,230,170,${0.35 * k})`); gr.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** 元婴：盘坐的小人，周身紫金光 */
function drawSoul(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, t: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2) * 6); const s = 1.4 * k; ctx.scale(s, s);
  ctx.globalAlpha = Math.min(1, k * 1.2);
  const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 70); gr.addColorStop(0, 'rgba(255,240,255,0.9)'); gr.addColorStop(1, 'rgba(190,140,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,236,200,0.95)'; ctx.strokeStyle = 'rgba(150,90,200,0.9)'; ctx.lineWidth = 1.6;
  // 莲台
  ctx.beginPath(); ctx.ellipse(0, 26, 30, 8, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(230,190,255,0.7)'; ctx.fill();
  // 盘腿
  ctx.fillStyle = 'rgba(255,240,215,0.97)';
  ctx.beginPath(); ctx.ellipse(0, 18, 22, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 身
  ctx.beginPath(); ctx.moveTo(-12, 16); ctx.quadraticCurveTo(-14, -4, -8, -10); ctx.lineTo(8, -10); ctx.quadraticCurveTo(14, -4, 12, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 头
  ctx.beginPath(); ctx.arc(0, -20, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 双手结印
  ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,220,120,1)'; ctx.fill();
  // 眉心
  ctx.fillStyle = 'rgba(200,60,80,0.9)'; ctx.beginPath(); ctx.arc(0, -24, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawBody(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30,26,22,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 36, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,70,80,0.85)'; ctx.beginPath(); ctx.ellipse(0, -18, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(80,90,100,0.9)'; ctx.fillRect(-10, -60, 20, 40);
  ctx.beginPath(); ctx.arc(0, -70, 11, 0, Math.PI * 2); ctx.fillStyle = 'rgba(220,200,180,0.9)'; ctx.fill();
  ctx.font = '16px serif'; ctx.fillStyle = `rgba(230,210,255,${0.6 + 0.3 * Math.sin(t * 3)})`; ctx.textAlign = 'center'; ctx.fillText('肉身', 0, -92);
  ctx.restore();
}

export type { DNode };
