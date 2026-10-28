// 第三十三步：声音导演 —— 每帧扫描战斗事件队列 / 飞行物 / 特效 / 敌人起手，按五行发声；
// 统筹配乐场景、环境声与脚步。全部按距离衰减、左右声像，神识之外压低。
import type { AudioEngine } from './audio';
import type { MusicState } from './music';
import { zoneAt } from '../data/world';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Snd = { a?: readonly string[]; b?: readonly string[]; rate?: number; syn?: 'crack' | 'crackle' | 'bell'; vol?: number };
const HITS = ['hit1', 'hit2', 'hit3', 'hit4', 'hit5', 'hit6'] as const;
const SWISH = ['swish1', 'swish2', 'swish3'] as const;
const METAL = ['metal1', 'metal2', 'metal3'] as const;
const SWING = ['swing1', 'swing2', 'swing3'] as const;

/** 招式特效 → [起手 a, 落点 b] */
const FX: Record<string, Snd> = {
  fireball: { a: ['crunch1'], b: ['boom1', 'crunch2'], rate: 1.3, syn: 'crackle' },
  firesnake: { a: ['crunch2'], b: ['crunch1', 'boom1'], rate: 1.1, syn: 'crackle' },
  crow: { a: SWISH, b: ['crunch1', 'crunch2'], rate: 1.2, syn: 'crackle' },
  flame: { a: ['crunch1'], b: ['crunch2'], rate: 0.9, syn: 'crackle' },
  icefire: { a: ['ice1'], b: ['icem', 'crunch1'], rate: 1, syn: 'crackle' },
  icicle: { a: SWISH, b: ['ice1', 'ice2', 'glass1'], rate: 1.3 },
  frost: { a: ['icem'], b: ['icem', 'ice2', 'glass2'], rate: 0.85 },
  needle: { a: ['swish3'], b: ['metal3'], rate: 1.6, vol: 0.6 },
  water: { a: ['bubble'], b: ['slime', 'bubble'], rate: 1 },
  lightning: { a: [], b: [], syn: 'crack' },
  goldthunder: { a: [], b: ['metalh'], syn: 'crack' },
  wind: { a: SWISH, b: SWISH, rate: 0.65 },
  tornado: { a: ['swish1', 'swish2'], b: SWISH, rate: 0.5 },
  rock: { a: ['rock1'], b: ['rock1', 'rock2', 'boom1'], rate: 0.9 },
  vine: { a: ['woodl', 'st_leaf'], b: ['woodh', 'woodl'], rate: 1 },
  leaf: { a: ['st_leaf'], b: ['woodl', 'st_leaf'], rate: 1.2 },
  sword: { a: SWING, b: METAL, rate: 1.1 },
  bigsword: { a: ['unsheathe1', 'unsheathe2'], b: ['metalh', 'boom1'], rate: 0.8 },
  gold: { a: SWING, b: ['metal1', 'metalh'], rate: 1 },
  star: { a: ['magic'], b: ['metal2', 'bell2'], rate: 1.4 },
  palm: { a: ['swing2'], b: ['punch1', 'punch2', 'punchm'], rate: 0.75 },
  roar: { a: ['roar1', 'roar2', 'roar3'], b: ['boom1'], rate: 0.9 },
  dragon: { a: ['roar3', 'ogre'], b: ['boom2'], rate: 0.7 },
  blood: { a: ['slime'], b: ['goo', 'slime', 'bite1'], rate: 0.9 },
  ghost: { a: ['shade1', 'shade2', 'shade3'], b: ['shade1', 'shade3'], rate: 1 },
  mind: { a: ['shade2'], b: ['shade3', 'field2'], rate: 1.2 },
  array: { a: ['field1'], b: ['field2', 'bell1'], rate: 1 },
  magnet: { a: ['field2'], b: ['field1'], rate: 1.2 },
  talisman: { a: ['ui_flip'], b: ['boom1'], rate: 1.1, syn: 'bell' },
};
/** 流派 → 命中质感层 */
const SCHOOL: Record<string, readonly string[]> = {
  火: ['crunch1', 'crunch2'], 冰: ['ice1', 'ice2', 'icem'], 雷: [], 风: SWISH, 土: ['rock1', 'rock2'], 木: ['woodh', 'woodl'],
  剑: METAL, 体: ['punch1', 'punch2', 'punchm'], 御: METAL, 魔: ['slime', 'goo'], 识: ['shade2', 'shade3'], 阵: ['field1', 'field2'],
  身: ['punch1', 'punch2'], 符: ['ui_flip'],
};
const EL_FX: Record<string, string> = { phys: 'palm', fire: 'fireball', ice: 'frost', water: 'water', thunder: 'lightning', poison: 'blood', blood: 'blood', ghost: 'ghost', wind: 'wind', earth: 'rock', sword: 'sword', gold: 'gold', metal: 'sword' };

export class SoundDirector {
  e: AudioEngine;
  private seen = new WeakSet<object>();
  private aggroSeen = new WeakSet<object>();
  private envT = 0; private ambT = 0;
  private stepT = 0; private lx = NaN; private ly = NaN; private spd = 0;
  private calmT = 0; private inFight = false;
  private env = { land: 1, cold: 0, arid: 0, forest: 0, loc: '' as string, demon: 0, shore: 0, water: 0 };
  private lastGrowl = 0;

  constructor(e: AudioEngine) { this.e = e; }

  // ------------------------------------------------------------ 发声工具
  fx(fx: string | undefined, x: number, y: number, phase: 'a' | 'b', vol = 0.5) {
    if (!fx || fx === 'none') return;
    const d = FX[fx]; if (!d) return;
    const e = this.e, list = phase === 'a' ? d.a : d.b, v = vol * (d.vol ?? 1);
    if (list && list.length) e.any(list, { x, y, vol: v, rate: (d.rate ?? 1) * rnd(0.92, 1.08), key: fx + phase, gap: phase === 'a' ? 0.07 : 0.05, rev: 0.22 });
    if (d.syn === 'crack') e.crack(x, y, v * (phase === 'b' ? 1 : 0.5), phase === 'b' ? 0.55 : 0);
    else if (d.syn === 'crackle' && phase === 'b') e.crackle(x, y, v * 0.6, 6);
    else if (d.syn === 'bell' && phase === 'a') e.bell(x, y, v * 0.4, 1.6);
  }
  /** 命中敌人（hitEnemy 调用）：流派质感层 */
  hit(x: number, y: number, school: string | undefined, power: number) {
    const L = school ? SCHOOL[school] : undefined;
    const e = this.e;
    if (school === '雷') { e.crack(x, y, 0.25 + power * 0.08, 0); return; }
    if (L && L.length) e.any(L, { x, y, vol: 0.22 + power * 0.08, rate: rnd(0.95, 1.15), key: 'hs' + school, gap: 0.05, rev: 0.12 });
  }
  /** 敌人毙命（kill 调用）：兽吼 / 虫鸣 / 鬼啸 + 倒地 + 魂散 */
  kill(en: any) {
    const e = this.e, x = en.x, y = en.y, k = en.def?.kind;
    const big = (en.blv ?? 0) >= 5 || (en.def?.hp ?? 1) >= 1.8 || en.boss || en.def?.lair;
    if (k === 'beast') e.any(big ? ['roar1', 'roar2', 'roar3', 'ogre'] : (en.def?.hp ?? 1) < 0.7 ? ['small1', 'small2'] : ['beast1', 'beast2', 'beast3', 'wolf'], { x, y, vol: big ? 0.75 : 0.5, rate: big ? rnd(0.7, 0.85) : rnd(0.9, 1.15), key: 'cry', gap: 0.15, rev: 0.3 });
    else if (k === 'insect') e.any(['slime', 'bite2'], { x, y, vol: 0.4, rate: rnd(1.3, 1.6), key: 'cry', gap: 0.1 });
    else if (k === 'ghost') e.any(['shade1', 'shade2', 'shade3'], { x, y, vol: 0.55, rate: rnd(0.7, 0.9), key: 'cry', gap: 0.12, rev: 0.5 });
    e.play('thud', { x, y, vol: big ? 0.7 : 0.4, rate: big ? 0.7 : 1, when: e.now + 0.22, key: 'fall', gap: 0.08 });
    e.play('bell2', { x, y, vol: 0.12, rate: 2.2, when: e.now + 0.35, key: 'soul', gap: 0.12, rev: 0.6 });
  }
  /** 主角施法（combat.cast 调用） */
  cast(s: { school?: string; fx?: string; tier?: number; cast?: string }, x: number, y: number) {
    const e = this.e;
    this.fx(s.fx, x, y, 'a', 0.55);
    if (!s.fx || s.fx === 'none' || !FX[s.fx]) e.sfx(s.school === '雷' ? 'thunder' : 'whoosh');
    if ((s.tier ?? 0) >= 3) {   // 地阶 / 天阶：低频垫 + 钟磬
      const o = e.synthOut(undefined, undefined, 0.5, 0.5);
      if (o) { e.tone('sine', 65, e.now, 1.4, 0.45, o, 40, 0.05); e.nz(e.now, 1.2, 0.18, o, 'bandpass', 400, 2400, 1, 0.3); }
      e.play('spell', { vol: 0.3, rate: 0.85, gap: 0.3, rev: 0.6 });
    } else e.play('magic', { vol: 0.16, rate: rnd(0.95, 1.2), gap: 0.12, rev: 0.3 });
  }

  // ------------------------------------------------------------ 每帧
  tick(g: any, dt: number) {
    const e = this.e, p = g.player;
    e.lx = p.x; e.ly = p.y;
    e.hearR = g.senseRadius ?? 900;
    const c = g.combat;
    if (c) this.scan(c, g);
    this.steps(g, dt);
    this.envT -= dt;
    if (this.envT <= 0) { this.envT = 0.4; this.sampleEnv(g); this.pickMusic(g); }
    this.ambT += dt;
    if (this.ambT > 0.1) { this.ambient(g, this.ambT); this.ambT = 0; }
  }

  private scan(c: any, g: any) {
    const e = this.e, S = this.seen;
    for (const ev of c.fxq as any[]) {
      if (S.has(ev)) continue; S.add(ev);
      const x = ev.x, y = ev.y;
      switch (ev.k) {
        case 'hit': {
          const pw = ev.power ?? 1;
          e.any(pw > 2 ? ['punchm', 'punch1', 'hit5', 'hit6'] : HITS, { x, y, vol: 0.32 + pw * 0.12, rate: rnd(0.9, 1.1) * (pw > 2 ? 0.85 : 1), key: 'hit', gap: 0.035 });
          if (ev.crit) e.play('metalh', { x, y, vol: 0.32, rate: rnd(1.1, 1.3), key: 'crit', gap: 0.08, rev: 0.3 });
          break;
        }
        case 'phit':
          e.any(['punch1', 'punch2', 'hit4'], { vol: ev.big ? 0.7 : 0.45, rate: ev.big ? 0.8 : 1, key: 'phit', gap: 0.08 });
          if (ev.big) e.play('thud', { vol: 0.6, rate: 0.75, key: 'phit2', gap: 0.15 });
          break;
        case 'kill': e.play('glass2', { x, y, vol: 0.18, rate: 1.4, key: 'kfx', gap: 0.1, rev: 0.4 }); break;
        case 'block': e.any(['metalh', 'plate'], { x, y, vol: 0.5, rate: rnd(0.9, 1.1), key: 'block', gap: 0.08, rev: 0.25 }); break;
        case 'dodge': e.any(SWISH, { x, y, vol: 0.45, rate: 1.25, key: 'dodge', gap: 0.1 }); break;
        case 'xueying': e.play('slime', { x, y, vol: 0.4, rate: 0.7 }); e.any(SWISH, { x, y, vol: 0.5, rate: 0.6, key: 'xy' }); break;
        case 'impact': {
          const pw = ev.power ?? 1;
          if (pw >= 3) { e.any(['boom2', 'boom1'], { x, y, vol: 0.8, rate: 0.8, key: 'imp', gap: 0.08, rev: 0.4 }); const o = e.synthOut(x, y, 0.6, 0.3); if (o) e.tone('sine', 80, e.now, 0.9, 0.6, o, 30); }
          else e.any(pw >= 2 ? ['boom1', 'rock2'] : ['rock1', 'rock2'], { x, y, vol: 0.4 + pw * 0.12, rate: rnd(0.9, 1.1), key: 'imp', gap: 0.06 });
          break;
        }
        case 'roar': e.any(['roar1', 'roar2', 'roar3'], { x, y, vol: 0.7, rate: rnd(0.85, 1), key: 'roar', gap: 0.4, rev: 0.4 }); break;
        case 'sumpop': e.play('magic', { x, y, vol: 0.25, rate: 1.3, key: 'sum', gap: 0.15 }); break;
        case 'sumhit': e.any(HITS, { x, y, vol: 0.2, rate: 1.2, key: 'sumhit', gap: 0.06 }); break;
        case 'sumboom': e.play('boom1', { x, y, vol: 0.5, key: 'sumboom', gap: 0.1 }); break;
        case 'sumgone': e.play('shade3', { x, y, vol: 0.25, rate: 1.3, key: 'sumgone', gap: 0.2 }); break;
        case 'foxfire': e.crackle(x, y, 0.25, 4); break;
        case 'ward': e.any(['field1', 'field2'], { x, y, vol: 0.3, rate: rnd(1.3, 1.6), key: 'ward', gap: 0.1, rev: 0.3 }); break;
        case 'shatter':
          e.any(['glass1', 'glass2'], { x, y, vol: 0.7, rate: rnd(0.8, 0.95), key: 'shatter', gap: 0.1, rev: 0.4 });
          e.play('metalh', { x, y, vol: 0.4, rate: 0.7, key: 'shatter2', gap: 0.1 });
          break;
        case 'dunflash': {
          const k = ev.kind;
          e.any(SWISH, { x, y, vol: 0.5, rate: 0.55, key: 'dun', gap: 0.12, rev: 0.3 });
          if (k === 'thunder') e.crack(x, y, 0.35, 0);
          else if (k === 'blood') e.play('slime', { x, y, vol: 0.3, rate: 0.8, key: 'dun2', gap: 0.12 });
          else if (k === 'earth') e.any(['rock1', 'rock2'], { x, y, vol: 0.4, rate: 0.8, key: 'dun2', gap: 0.12 });
          else e.play('magic', { x, y, vol: 0.2, rate: 1.4, key: 'dun2', gap: 0.12 });
          break;
        }
        case 'cast': e.play('magic', { x, y, vol: 0.12 * (ev.power ?? 1), rate: rnd(1.1, 1.3), key: 'castfx', gap: 0.15, rev: 0.3 }); break;
      }
    }
    // 飞行物：起手声（主角的由 cast 发过，这里只发敌人的 + 主角的连发补点）
    for (const pr of c.projs as any[]) {
      if (S.has(pr)) continue; S.add(pr);
      this.fx(pr.fx, pr.x, pr.y, 'a', pr.fac === 'e' ? 0.45 : 0.22);
    }
    // 特效：落点声
    for (const v of c.vfx as any[]) {
      if (S.has(v)) continue; S.add(v);
      const x = v.x, y = v.y;
      switch (v.kind) {
        case 'strike': case 'pillar': this.fx(v.fx, x, y, 'b', Math.min(1, 0.45 + (v.r ?? 100) / 400)); break;
        case 'ring': if (v.fx && (v.r ?? 0) > 120) this.fx(v.fx, x, y, 'b', 0.4); break;
        case 'beam': this.fx(v.fx ?? 'array', x, y, 'a', 0.55); e.play('field2', { x, y, vol: 0.3, rate: 0.8, key: 'beam', gap: 0.15, rev: 0.3 }); break;
        case 'chain': e.crack(x, y, 0.4, 0.2); break;
        case 'cone': this.fx(v.fx, x, y, 'a', 0.5); break;
        case 'bigsword': e.any(['unsheathe1', 'unsheathe2'], { x, y, vol: 0.5, rate: 0.7, key: 'bigsw', gap: 0.2 }); e.play('metalh', { x, y, vol: 0.5, rate: 0.6, when: e.now + 0.25, key: 'bigsw2', gap: 0.2, rev: 0.5 }); break;
        case 'slash': e.any(SWING, { x, y, vol: 0.4, rate: rnd(0.9, 1.1), key: 'slash', gap: 0.06 }); break;
        case 'blinkfx': e.any(SWISH, { x, y, vol: 0.35, rate: 1.4, key: 'blink', gap: 0.1 }); break;
      }
    }
    // 敌人：起手预警 / 初次察觉的低吼
    const now = e.now;
    for (const en of c.enemies as any[]) {
      if (en.dead) continue;
      const cs = en.cast;
      if (cs && typeof cs === 'object' && !S.has(cs)) {
        S.add(cs);
        const sk = cs.sk;
        if (sk) {
          const big = sk.ult || cs.hz?.big;
          if (big) { e.gong(now + 0.01, 0.4, 70, undefined, en.x, en.y); e.play('field2', { x: en.x, y: en.y, vol: 0.5, rate: 0.55, key: 'ult', gap: 0.5, rev: 0.6 }); }
          else if (sk.k === 'roar') e.any(['roar1', 'roar2', 'roar3'], { x: en.x, y: en.y, vol: 0.6, rate: rnd(0.85, 1.05), key: 'roar', gap: 0.4, rev: 0.4 });
          else if (sk.k === 'charge' || sk.k === 'leap') e.any(SWISH, { x: en.x, y: en.y, vol: 0.4, rate: 0.7, key: 'chg', gap: 0.15 });
          else if (sk.k === 'guard') e.play('field1', { x: en.x, y: en.y, vol: 0.35, rate: 0.9, key: 'guard', gap: 0.3 });
          else if (sk.k === 'heal') e.play('spell', { x: en.x, y: en.y, vol: 0.25, rate: 1.2, key: 'heal', gap: 0.5 });
          else this.fx(EL_FX[sk.el] ?? 'palm', en.x, en.y, 'a', 0.3);
          e.play('magic', { x: en.x, y: en.y, vol: 0.2, rate: sk.el === 'ice' ? 1.4 : sk.el === 'fire' ? 0.8 : 1, key: 'tele', gap: 0.15, rev: 0.3 });
        }
      }
      if (en.aggro && !this.aggroSeen.has(en)) {
        this.aggroSeen.add(en);
        if (en.def?.kind === 'beast' && now - this.lastGrowl > 1.6 && en.def?.behave !== 'flee' && en.def?.behave !== 'shy') {
          this.lastGrowl = now;
          const big = (en.blv ?? 0) >= 5 || (en.def?.hp ?? 1) >= 1.8 || en.def?.lair;
          e.any(big ? ['roar1', 'roar2', 'roar3', 'ogre'] : (en.def?.hp ?? 1) < 0.7 ? ['small1', 'small2'] : ['beast1', 'beast2', 'beast3', 'wolf'], { x: en.x, y: en.y, vol: big ? 0.7 : 0.4, rate: rnd(0.85, 1), key: 'growl', gap: 1, rev: 0.35 });
        }
      }
    }
    void g;
  }

  // ------------------------------------------------------------ 环境采样
  private sampleEnv(g: any) {
    const p = g.player, E = this.env;
    try {
      const s = g.terrain.sample(p.x, p.y);
      const isLand = g.terrain.isLand ? g.terrain.isLand(p.x, p.y) : s.land > 0.5;
      E.land = isLand ? 1 : 0;
      E.cold = s.cold ?? 0; E.arid = s.arid ?? 0; E.forest = s.forest ?? 0;
      E.shore = isLand && s.land < 0.65 ? 1 - clamp01((s.land - 0.4) / 0.25) : 0;
      // 近水：采样四周
      let w = 0; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; if (!g.terrain.isLand(p.x + Math.cos(a) * 500, p.y + Math.sin(a) * 500)) w++; }
      E.water = w / 6;
      if (!isLand) E.shore = 0;
    } catch { /* */ }
    try { const l = g.nearbyLocation?.(); E.loc = l ? l.type : ''; } catch { E.loc = ''; }
    try { const z = zoneAt(p.x, p.y); E.demon = z.k > 0.35 ? z.k : 0; } catch { E.demon = 0; }
  }

  private pickMusic(g: any) {
    const M = this.e.music; if (!M) return;
    const c = g.combat, p = g.player, h = g.hero, E = this.env;
    let st: MusicState;
    const pc = g.pursuit?.cur;
    let fight = false, boss = false, n = 0;
    if (c) {
      for (const en of c.enemies as any[]) {
        if (en.dead || !en.aggro || en.spar) continue;
        if (Math.abs(en.x - p.x) > 1200 || Math.abs(en.y - p.y) > 1200) continue;
        n++;
        if (en.boss || en.def?.lair || (en.blv ?? 0) >= 8 || en.realm > (h?.realm ?? 0) || en.pursuer) boss = true;
      }
      fight = n > 0;
    }
    if (fight) { this.calmT = 0; this.inFight = true; } else if (this.inFight) { this.calmT += 0.4; if (this.calmT > 4) this.inFight = false; }
    if (pc && pc.e && !pc.e.dead) {
      const d = Math.hypot(pc.e.x - p.x, pc.e.y - p.y);
      M.prox = clamp01(1 - d / 2600);
      st = fight && d < 1000 ? 'boss' : 'pursuit';
    } else if (this.inFight) {
      st = boss ? 'boss' : 'combat';
      M.intensity = clamp01(n / 6 + (1 - (h?.hp ?? 1)) * 0.6);
    } else if (p.sitting) st = 'cultivate';
    else if (E.loc === 'town' || E.loc === 'city') st = 'town';
    else if (E.loc === 'sect') st = 'sect';
    else if (E.demon > 0.4) st = 'demon';
    else if (!E.land) st = 'sea';
    else if (E.cold > 0.55) st = 'cold';
    else if (E.arid > 0.6) st = 'desert';
    else if ((g.night ?? 0) > 0.55) st = 'night';
    else st = 'day';
    const am = g.ascend?.music?.(); if (am) { st = am; M.intensity = 1; }   // 第 2 阶段：冲关时配乐推上去
    const urgent = (st === 'combat' || st === 'boss' || st === 'pursuit') && M.state !== 'combat' && M.state !== 'boss' && M.state !== 'pursuit';
    M.request(st, urgent);
  }

  private ambient(g: any, dt: number) {
    const A = this.e.amb; if (!A) return;
    const w = g.weather ?? {}, p = g.player, E = this.env;
    const k = w.k ?? 0, kind = w.kind ?? 'clear';
    A.update({
      wind: w.wind ?? 0.3,
      rain: kind === 'rain' ? k : kind === 'storm' ? k : 0,
      storm: kind === 'storm' ? k : 0,
      snow: kind === 'snow' ? k : 0,
      sand: kind === 'sand' ? k : 0,
      fly: p.flying ? 1 : 0,
      boost: p.boosting ? 1 : 0,
      sea: E.land ? 0 : 1, shore: E.shore,
      town: E.loc === 'town' || E.loc === 'city' ? 1 : E.loc === 'sect' ? 0.3 : 0,
      forest: E.forest, night: g.night ?? 0, season: g.season ?? 0, cold: E.cold, demon: E.demon, water: E.water,
    }, dt);
  }

  // ------------------------------------------------------------ 脚步
  private steps(g: any, dt: number) {
    const p = g.player, e = this.e;
    if (Number.isNaN(this.lx)) { this.lx = p.x; this.ly = p.y; }
    const v = Math.hypot(p.x - this.lx, p.y - this.ly) / Math.max(1e-3, dt);
    this.lx = p.x; this.ly = p.y;
    this.spd += (v - this.spd) * Math.min(1, dt * 10);
    if (p.flying || p.sitting || this.spd < 40 || this.spd > 1400 || g.paused) { this.stepT = Math.min(this.stepT, 0.1); return; }
    this.stepT -= dt;
    if (this.stepT > 0) return;
    const stride = p.running ? 105 : 78;
    this.stepT = Math.max(0.2, Math.min(0.6, stride / this.spd));
    const E = this.env, w = g.weather ?? {};
    if (!E.land) {   // 舟行：划水
      if (Math.random() < 0.5) e.play('bubble', { vol: 0.12, rate: rnd(0.6, 0.8), key: 'oar', gap: 0.4, rev: 0.1 });
      return;
    }
    let set: readonly string[];
    if (E.cold > 0.55 || (w.kind === 'snow' && (w.k ?? 0) > 0.5) || (g.season === 3 && E.cold > 0.3)) set = ['st_snow1', 'st_snow2'];
    else if (E.loc === 'town' || E.loc === 'city' || E.loc === 'sect') set = ['st_stone1', 'st_stone2'];
    else if (E.arid > 0.55) set = ['st_gravel', 'st_stone2'];
    else if (E.forest > 0.45) set = ['st_leaf', 'st_grass1', 'st_grass2'];
    else set = ['st_grass1', 'st_grass2', 'st_grass3'];
    e.any(set, { vol: p.running ? 0.24 : 0.17, rate: rnd(0.9, 1.1), key: 'step', gap: 0.15, rev: 0.04, pan: rnd(-0.08, 0.08) });
  }
}
