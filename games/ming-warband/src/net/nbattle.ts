// 联机实时战斗（客户端）：服务器权威模拟，本机主角即时预测，其余单位按服务器时间插值回放
// 低延迟要点：
//  · 自己的移动/挥砍/射击立即在本地生效（不等服务器），服务器只做限速校验，偏差过大才下发纠正（bcorr）
//  · 其他单位按“服务器时间 − 100ms”插值，抖动不卡顿；命中/阵亡等事件也按同一时间轴回放，与画面对齐
//  · 自己造成的命中事件立即显示（不延迟），手感接近单机
import Phaser from 'phaser';
import { BattleScene, type Unit, type Squad, type Group, type Order, type Form, FORM_NAME } from '../scenes/BattleScene';
import { readFrame, type Frame, ST_DEAD, ST_ROUTED, ST_FLED, ST_AIM, ST_SWING, ST_RANGED, EV_SHOT, HIT_MELEE, HIT_ARROW, BLOCK_MELEE, BLOCK_ARROW, GOD_BLOCK } from '../battle/wire';
import { heroIn } from '../battle/heroStats';
import type { BattleInit, SpawnRow } from './protocol';
import { TROOPS, isRanged } from '../data/troops';
import { FACTION, COMPANIONS } from '../data/world';
import { S, player, log } from '../core/game';
import { GOD } from '../core/god';
import { BattleField } from '../scenes/battle/field';
import { battleHud } from '../ui/battleHud';
import { troopSpec, companionSpec, heroSpec } from '../art/specs';
import { currentHeroSpec, heroColor, ensureFigure } from '../art/phaserTex';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { weatherFx } from '../art/weatherFx';
import { weatherAt, seasonOf, snowCover } from '../core/weather';
import { send, onNet, NET } from './client';
import { ref } from '../gameRef';
import { closeAll, toast } from '../ui/dom';
import { nav } from '../core/sim';
import { applyNetBattle, type Outcome } from '../core/combat';
import { showReport } from '../ui/encounter';

const SWING = 0.32;
const DELAY = 100;        // 插值延迟（毫秒）：约两帧服务器快照
const SEND_MS = 50;       // 操作上报间隔
interface Ip { t0: number; x0: number; y0: number; t1: number; x1: number; y1: number }
type NU = Unit & { ip: Ip; st: number; rmode?: boolean; look?: BattleInit['parties'][number]['look']; tag?: Phaser.GameObjects.Text | null };
interface Queued { t: number; f: Frame }
export interface NetStart { bid: number; init: BattleInit; joined?: boolean; resume?: boolean }
interface EndMsg { bid: number; win: boolean; retreat: boolean; out: Outcome & { kills?: number }; lines: string[]; gold: number }

export class NetBattleScene extends BattleScene {
  nb!: NetStart;
  mySide: 0 | 1 = 0;
  myPid = '';
  byUid: (NU | undefined)[] = [];
  off = NaN;                 // 服务器战斗时钟 − 本地时钟（毫秒）
  stat = { m: [100, 100], a: [0, 0] };
  seq = { atk: 0, atkA: 0, fire: 0, fireA: 0, fireD: 0 };
  cs = 0;
  sendT = 0; viewT = 0; lastView = '';
  queue: Queued[] = [];
  missing = 0; lastResync = 0;
  ending: EndMsg | null = null;
  report: ReturnType<typeof applyNetBattle> | null = null;
  partyName = new Map<string, string>();
  net = true;

  constructor() { super('NetBattle'); }

  init(data: any) {
    const d = data as NetStart;
    const ini = d.init;
    const enemies = ini.parties.filter(p => p.side !== ini.side);
    const allies = ini.parties.filter(p => p.side === ini.side && p.pid !== ini.pid);
    const main = enemies.find(p => p.acct) ?? enemies[0];
    const pp = player();
    super.init({
      ours: [], theirs: [], enemyName: enemies.length > 1 ? `${main?.name ?? '敌军'}等${enemies.length}部` : main?.name ?? '敌军', enemyFaction: main?.faction ?? 'bandit',
      terrain: ini.terrain, siege: false, night: ini.night, heroFights: true,
      weather: weatherAt(pp.x, pp.y, S.time), snow: snowCover(pp.x, pp.y, S.time), season: seasonOf(S.time),
      allies: allies.map(a => ({ pid: a.pid, name: a.name, stacks: [] })), onEnd: () => { /* 结果由服务器下发 */ },
    });
    this.nb = d; this.mySide = ini.side; this.myPid = ini.pid;
    this.byUid = []; this.off = NaN; this.queue = []; this.missing = 0; this.ending = null; this.report = null;
    this.seq = { atk: 0, atkA: 0, fire: 0, fireA: 0, fireD: 0 }; this.cs = ini.cs; this.sendT = 0; this.viewT = 0; this.lastView = '';
    this.stat = { m: [100, 100], a: [0, 0] };
    this.partyName = new Map(ini.parties.map(p => [p.pid, p.name]));
  }

  /** 服务器方位 → 本地方位（本地 0 = 自己这边） */
  loc(side: number): 0 | 1 { return side === this.mySide ? 0 : 1; }
  westSide(side: 0 | 1) { return (side === 0 ? this.mySide : 1 - this.mySide) === 0; }

  create() {
    const ini = this.nb.init, st = this.setup;
    const ef = FACTION[st.enemyFaction];
    this.colors = [0xe0b040, st.enemyFaction === 'bandit' ? 0x3a3a3a : ef?.color ?? 0xc0392b];
    if (this.colors[1] === 0xd88a1c || this.colors[1] === 0xd8b040) this.colors[0] = 0x3a8ad8;
    this.W = ini.W; this.H = ini.H;
    this.F = new BattleField(this.W, this.H, ini.terrain, ini.seed, null); // 与服务器同种子：地形、障碍完全一致
    this.baseX = this.mySide === 0 ? [this.W * 0.3, this.W * 0.7] : [this.W * 0.7, this.W * 0.3];
    this.buildScene(S.hero.name[0] ?? '义');
    const mk = (g: Group): Squad => ({ id: 0, side: 0, ai: false, ally: false, g, order: 'hold', form: 'line', ax: this.W / 2, ay: this.H / 2, face: 0, members: [], phase: 0, slotsT: 0 });
    this.psq = { inf: mk('inf'), rng: mk('rng'), cav: mk('cav') };
    for (const [g, o, f, ax, ay] of ini.sq) { const sq = this.psq[g as Group]; if (!sq) continue; sq.order = o as Order; sq.form = f as Form; sq.ax = ax; sq.ay = ay; }
    for (const r of ini.units) this.addUnit(r, ini.t);
    this.initial = [Math.max(1, this.stat.a[0]), Math.max(1, this.stat.a[1])];
    if (this.hero) this.hero.ammo = ini.hammo, this.hero.x = ini.hx || this.hero.x, this.hero.y = ini.hy || this.hero.y;
    this.netBanners();
    music.play('battle'); music.ambience('battle');
    if (!this.nb.resume) { sfx('horn', { vol: 0.7 }); sfx('drumRoll', { vol: 0.7, delay: 0.5 }); }
    const wth = st.weather ?? { kind: 'clear' as const, k: 0, storm: false };
    weatherFx.set(wth); weatherFx.setAmbient(st.season ?? 0, st.night);
    music.weather(wth.kind === 'rain' ? wth.k : 0);
    if (st.night) this.makeTorches();
    this.bindInput();
    // 左键攻击由 updateHero 处理；这里只处理右键移动指令（bindInput 已注册）
    this.phase = 'fight';
    battleHud.open(this);
    if (!this.nb.resume) {
      this.intro();
      const others = ini.parties.filter(p => p.acct && p.pid !== ini.pid);
      this.msg(this.nb.joined ? '你率部加入了战场！' : `与${st.enemyName}的战斗开始了！`);
      if (others.length) this.msg(`同场玩家：${others.map(p => `${p.name}（${p.side === ini.side ? '友' : '敌'}）`).join('、')}`);
      this.msg('WASD 移动，左键攻击，Q 换武器；1-4 选部队，Z 冲锋 X 坚守 C 跟随 V 推进，F 换阵型，右键指定位置。');
    } else this.msg('已重新连上战场。');
    const cam = this.cameras.main;
    if (this.hero) cam.centerOn(this.hero.x, this.hero.y); else cam.centerOn(this.psq.inf.ax, this.psq.inf.ay);
    this.events.once('shutdown', () => { for (const u of this.units as NU[]) u.tag?.destroy(); });
    this.sendInput(true);
  }

  addUnit(r: SpawnRow, t: number) {
    const [uid, sSide, pid, troop, comp, x, y, fl, maxHp, god, name, range, ammo] = r;
    if (this.byUid[uid]) return;
    const side = this.loc(sSide);
    const mine = pid === this.myPid;
    const isHero = !!(fl & 1), mounted = !!(fl & 2);
    const td = troop ? TROOPS[troop] : null;
    const cd = comp ? COMPANIONS.find(c => c.id === comp) : null;
    const kind = td ? (td.cls === 'arc' || td.cls === 'hca' ? 'bow' : td.cls === 'xbow' ? 'xbow' : td.cls === 'gun' ? 'gun' : null) : cd?.rng ? (comp === 'c_tang' ? 'gun' : 'bow') : null;
    const party = this.nb.init.parties.find(p => p.pid === pid);
    const u: NU = {
      uid, side, troop: troop || null, comp: comp || null, name: isHero ? name || party?.name || '将领' : td?.name ?? cd?.name ?? '', pid, ally: side === 0 && !mine,
      x, y, vx: 0, vy: 0, face: this.westSide(side) ? 0 : Math.PI,
      hp: maxHp, maxHp, atk: td?.atk ?? 10, def: td?.def ?? 5, skill: td?.skill ?? 5, speed: 90, mounted, cls: td?.cls ?? 'inf',
      reach: 26, antiCav: false, rng: fl & 4 ? 1 : 0, range, reload: 2, ammo, kind: kind as Unit['kind'],
      cd: 0, rcd: 0, target: null, retarget: 0,
      group: isHero ? 'inf' : mounted ? 'cav' : td && isRanged(td.cls) ? 'rng' : 'inf', dead: false, routed: false, fled: false, hero: isHero,
      disengage: 0, r: mounted ? 9 : 6, onWall: false, swing: 0, hitFlash: 0,
      sq: null as unknown as Squad, slotX: 0, slotY: 0,
      ip: { t0: t - 1000, x0: x, y0: y, t1: t - 1000, x1: x, y1: y }, st: 0, look: party?.look ?? null, tag: null,
    };
    if (god & 8) u.godBits = god; else if (mine && GOD.on && GOD.aura) u.godBits = 8; else u.godBits = 0;
    if (mine) {
      if (!isHero && !comp) { u.sq = this.psq[u.group]; this.psq[u.group].members.push(u); }
      if (isHero) {
        this.hero = u;
        const hi = heroIn(S.hero, heroColor());
        const gs = GOD.on ? GOD.battleSpeed : 1;
        Object.assign(u, { atk: hi.atk, def: hi.def, skill: hi.skill, speed: hi.speed * gs, reach: hi.reach, antiCav: hi.antiCav, rng: hi.rng, range: hi.range || range, reload: hi.reload, kind: hi.kind, mounted: hi.mounted });
        (u as any).meleeSpeed = hi.meleeSpeed;
        if (!u.rng) this.heroMode = 'melee';
      }
    }
    this.byUid[uid] = u;
    this.units.push(u);
    this.spawnSprite(u);
    if (isHero && !mine && typeof document !== 'undefined') {
      const hostile = side === 1;
      u.tag = this.add.text(x, y, (party?.acct ? '' : '') + u.name, { fontFamily: 'sans-serif', fontSize: '11px', color: hostile ? '#ff9a8a' : '#9fe0ff', stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(21);
    }
    if (side === 0) this.stat.a[0]++; else this.stat.a[1]++;
  }

  specOf(u: Unit) {
    const n = u as NU;
    if (u.hero) {
      if (u === this.hero) return currentHeroSpec(u.mounted, this.heroMode);
      const lk = n.look;
      const weapon = (n.rmode && lk?.wr ? lk.wr : lk?.w ?? 'sabre') as any;
      return heroSpec({ mounted: u.mounted, weapon, armor: lk?.a ?? 2, color: lk?.c ?? this.colorOf(u) });
    }
    if (u.comp) return companionSpec(u.comp, this.colorOf(u), u.mounted);
    return troopSpec(u.troop!, this.colorOf(u));
  }

  netBanners() {
    const by = new Map<string, NU[]>();
    for (const u of this.units as NU[]) if (u.troop && !u.dead && u.group !== 'rng') { let a = by.get(u.pid); if (!a) by.set(u.pid, a = []); a.push(u); }
    for (const [pid, us] of by) {
      const n = Math.min(3, Math.ceil(us.length / 40));
      for (let i = 0; i < n; i++) {
        const u = us[Math.floor((i + 0.5) * us.length / n)]; if (!u || u.banner) continue;
        const key = u.ally ? this.bannerKeys[2] : this.bannerKeys[u.side];
        u.banner = this.add.sprite(u.x, u.y, key, 0).setOrigin(2 / 22, 1).setScale((pid === this.myPid && i === 0 ? 1.25 : 1.1) / 3);
      }
    }
  }

  // ---------- 网络输入 ----------
  onFrame(ab: ArrayBuffer) {
    const f = readFrame(ab); if (!f) return;
    const now = performance.now();
    const sample = f.t - now;
    if (isNaN(this.off) || sample > this.off) this.off = sample; // 以最快到达的包为准（最小延迟）
    const T = f.t;
    let deferred = false;
    for (const d of f.units) {
      const u = this.byUid[d.uid];
      if (!u) { this.missing++; continue; }
      if (d.mask & 3) {
        const ip = u.ip;
        const nx = d.mask & 1 ? d.x : ip.x1 + d.dx, ny = d.mask & 1 ? d.y : ip.y1 + d.dy;
        if (T - ip.t1 > 700) { ip.t0 = T - DELAY; ip.x0 = u.x; ip.y0 = u.y; } else { ip.t0 = ip.t1; ip.x0 = ip.x1; ip.y0 = ip.y1; }
        ip.t1 = T; ip.x1 = nx; ip.y1 = ny;
      }
      if (u === this.hero) { // 自己：血量与状态立即生效
        if (d.mask & 8) u.hp = d.hp * u.maxHp;
        if (d.mask & 16) this.applySt(u, d.st);
      } else if (d.mask & 28) deferred = true;
    }
    // 自己打出的命中立即显示；其余事件与状态按插值时间轴回放
    const mine = this.hero?.uid ?? -1;
    const rest = [];
    for (const e of f.evs) {
      if (e.k === 2 && (e.from === mine || e.to === mine)) this.applyHit(e.to, e.from, e.dmg, e.kind, true);
      else rest.push(e);
    }
    if (deferred || rest.length) this.queue.push({ t: T, f: { ...f, evs: rest } });
    if (this.missing && now - this.lastResync > 3000) { this.lastResync = now; this.missing = 0; send({ t: 'bsync' }); }
  }

  onSpawn(rows: SpawnRow[]) {
    const t = isNaN(this.off) ? 0 : performance.now() + this.off;
    const before = this.units.length;
    for (const r of rows) this.addUnit(r, t);
    if (this.units.length - before > 8) this.netBanners();
  }
  onStat(m: { m: [number, number]; a: [number, number] }) {
    this.stat.m = [m.m[this.mySide], m.m[1 - this.mySide]];
    this.stat.a = [m.a[this.mySide], m.a[1 - this.mySide]];
  }
  onCorr(m: { x: number; y: number; cs: number }) {
    this.cs = m.cs;
    const h = this.hero; if (!h || h.dead) return;
    h.x = m.x; h.y = m.y; h.vx = 0; h.vy = 0;
    this.sendInput(true);
  }
  /** 重新同步（断线重连或丢包）：补齐缺失的单位，已消失的标记离场 */
  resync(ini: BattleInit) {
    const alive = new Set(ini.units.map(r => r[0]));
    for (const u of this.units as NU[]) if (!u.dead && !u.fled && !alive.has(u.uid)) { u.fled = true; u.tag?.destroy(); u.tag = null; }
    for (const r of ini.units) this.addUnit(r, ini.t);
    this.cs = ini.cs;
    if (this.hero && !this.hero.dead) { this.hero.x = ini.hx; this.hero.y = ini.hy; this.hero.ammo = ini.hammo; }
    this.queue = [];
  }

  applySt(u: NU, st: number) {
    const was = u.st; u.st = st;
    u.routed = !!(st & ST_ROUTED);
    u.aiming = !!(st & ST_AIM);
    if (u !== this.hero && (st & ST_SWING) && !(was & ST_SWING)) { u.swing = SWING; if (u.hero || Math.random() < 0.15) this.snd('swing', u.x, u.y, u.hero ? 0.8 : 0.4); }
    if (u.hero && u !== this.hero) { const rm = !!(st & ST_RANGED); if (rm !== !!u.rmode) { u.rmode = rm; this.refreshSprite(u); } }
    if ((st & ST_DEAD) && !u.dead) this.netKill(u);
    else if ((st & ST_FLED) && !u.fled) { u.fled = true; u.tag?.destroy(); u.tag = null; if (u === this.hero) this.msg('你已撤离战场。'); }
  }
  refreshSprite(u: Unit) {
    if (!u.spr) return;
    const f = ensureFigure(this, this.specOf(u));
    if (f.key !== u.sheet) { u.spr.setTexture(f.key, 0).setOrigin(f.ax, f.ay); u.sheet = f.key; }
  }

  applyHit(to: number, from: number, dmg: number, kind: number, now = false) {
    const t = this.byUid[to]; if (!t || t.fled) return;
    const a = this.byUid[from];
    const loud = t.hero || a?.hero ? 1.4 : 0.75;
    if (kind === GOD_BLOCK) {
      if (Math.random() < 0.35) this.sparks(t.x, t.y - 14, 3);
      if (Math.random() < 0.5) this.snd('clash', t.x, t.y, 0.5);
      if (t.hero && Math.random() < 0.25) this.floater(t.x, t.y - 16, '金身', '#ffd860');
      return;
    }
    if (kind === BLOCK_MELEE) { this.snd(Math.random() < 0.5 ? 'clash' : 'block', t.x, t.y, loud * 0.8); if (a) this.sparks((a.x + t.x) / 2, (a.y + t.y) / 2 - 14, 4); return; }
    if (kind === BLOCK_ARROW) { this.snd('block', t.x, t.y, 0.4); return; }
    const heavy = t.def >= 14;
    if (kind === HIT_MELEE) { if (heavy) this.sparks(t.x, t.y - 14, 3); this.snd(heavy ? (Math.random() < 0.5 ? 'clash' : 'armor') : (Math.random() < 0.3 ? 'clash' : 'hit'), t.x, t.y, loud); }
    else if (kind === HIT_ARROW) this.snd(heavy ? 'armor' : 'arrowHit', t.x, t.y, loud * 0.8);
    else this.snd('hit', t.x, t.y, loud);
    t.hitFlash = 0.12;
    this.blood(t.x, t.y, dmg > 15 ? 4 : 2);
    if (t === this.hero) { this.cameras.main.shake(90, 0.003); this.floater(t.x, t.y - 14, `-${dmg}`, '#ff6050'); }
    else if (a && a === this.hero) this.floater(t.x, t.y - 12, String(dmg), '#ffe9a0');
    void now;
  }

  netKill(u: NU) {
    if (u.dead) return;
    u.dead = true; u.hp = 0;
    if (Math.random() < 0.5 || u.hero || u.comp) this.snd('death', u.x, u.y, u.hero || u.comp ? 1.3 : 0.8);
    this.snd('fall', u.x, u.y, 0.6);
    if (u.mounted && Math.random() < 0.35) this.snd('neigh', u.x, u.y, 0.6);
    if (u === this.hero) { this.heroDown = true; this.msg('你被击倒了！部下们继续作战……'); battleHud.refresh(); }
    else if (u.comp && u.pid === this.myPid) this.msg(`${u.name}负伤倒地！`);
    else if (u.hero) this.msg(`${u.name}${u.side === 0 ? '（友军）' : ''}被击倒了！`);
    const s = this.stamp;
    s.clear();
    s.fillStyle(0x5a1208, 0.55); s.fillEllipse(0, 0, u.mounted ? 20 : 13, u.mounted ? 9 : 6);
    s.fillStyle(0x7a1a0e, 0.4); s.fillEllipse(-4, 2, 7, 3.5);
    if (!this.F.waterAt(u.x, u.y)) { try { this.ground?.draw(s, u.x - 6, u.y); } catch { /* */ } this.stampCorpse(u); }
    u.spr?.destroy(); u.spr = null;
    u.disc?.destroy(); u.disc = null;
    u.tag?.destroy(); u.tag = null;
    if (u.banner) { u.banner.destroy(); u.banner = null; }
    if (u.mounted && !u.hero) this.parts.push({ x: u.x, y: u.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.6, kind: 'dust', size: 8 });
  }

  shotFx(e: { kind: number; mounted: boolean; from: number; x: number; y: number; a: number; dist: number; range: number }) {
    const kind = (['bow', 'xbow', 'gun'] as const)[e.kind] ?? 'bow';
    const from = this.byUid[e.from];
    const sp = kind === 'gun' ? 900 : kind === 'xbow' ? 620 : 520;
    const z0 = 14 + (e.mounted ? 10 : 0);
    const ox = from && !from.dead ? from.x : e.x, oy = from && !from.dead ? from.y : e.y; // 从画面上射手的位置发出
    this.snd(kind === 'gun' ? 'gun' : kind === 'xbow' ? 'xbow' : 'bow', ox, oy, from?.hero ? 1.2 : kind === 'gun' ? 0.8 : 0.6);
    if (from) from.firedT = 0.25;
    this.projs.push({ x: ox + Math.cos(e.a) * 10, y: oy + Math.sin(e.a) * 10, vx: Math.cos(e.a) * sp, vy: Math.sin(e.a) * sp, dmg: 0, side: from?.side ?? 1, life: (e.range * 1.4) / sp, kind, from: from ?? (this.hero as Unit), sx: ox, sy: oy, dist: Math.max(40, Math.min(e.dist, e.range * 1.2)), z0 } as any);
    if (kind === 'gun') {
      const mx = ox + Math.cos(e.a) * 16, my = oy + Math.sin(e.a) * 16;
      for (let i = 0; i < 4; i++) this.parts.push({ x: mx + Math.cos(e.a) * i * 4, y: my + Math.sin(e.a) * i * 4, z: z0, vx: Math.cos(e.a) * (20 + i * 10) + (Math.random() - 0.5) * 10, vy: Math.sin(e.a) * (20 + i * 10), vz: 6 + Math.random() * 6, life: 0, max: 1.6 + Math.random() * 0.8, kind: 'smoke', size: 4 + i * 1.5 });
      this.parts.push({ x: mx, y: my, z: z0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.08, kind: 'spark', size: 7 });
    }
  }

  /** 箭矢、铳弹只做表现（伤害由服务器判定） */
  updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const trav = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (trav > p.dist * (p.kind === 'gun' ? 1 : 1.08)) {
        if (p.kind !== 'gun' && this.stamps < 3000 && !this.F.waterAt(p.x, p.y)) {
          const a = Math.atan2(p.vy, p.vx); const s = this.stamp; s.clear();
          s.lineStyle(1, 0x3a2414, 0.9); s.lineBetween(0, 0, -Math.cos(a) * 6, -Math.sin(a) * 6 - 3);
          s.fillStyle(0xe8e0d0, 0.9); s.fillRect(-Math.cos(a) * 6 - 1, -Math.sin(a) * 6 - 4, 2, 1.5);
          try { this.ground?.draw(s, p.x, p.y); } catch { /* */ } this.stamps++;
          if (Math.random() < 0.3) this.snd('arrowGround', p.x, p.y, 0.5);
        }
        this.projs.splice(i, 1); continue;
      }
      if (p.life <= 0 || p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) this.projs.splice(i, 1);
    }
  }

  // ---------- 本机主角：即时预测 ----------
  updateHero(dt: number) {
    const h = this.hero;
    if (!h || h.dead || h.fled) return;
    h.cd -= dt; h.rcd -= dt; h.swing -= dt; h.hitFlash -= dt;
    const k = this.keys;
    let mx = 0, my = 0;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    const len = Math.hypot(mx, my);
    const p = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const aim = Math.atan2(wp.y - h.y, wp.x - h.x);
    const tk = this.F.speedAt(h.x, h.y, h.mounted);
    if (h.mounted) {
      const tvx = len ? (mx / len) * h.speed * tk : 0, tvy = len ? (my / len) * h.speed * tk : 0;
      const acc = len ? 2.2 : 1.6;
      h.vx += (tvx - h.vx) * Math.min(1, acc * dt); h.vy += (tvy - h.vy) * Math.min(1, acc * dt);
    } else { h.vx = len ? (mx / len) * h.speed * tk : 0; h.vy = len ? (my / len) * h.speed * tk : 0; }
    this.moveUnit(h, h.vx * dt, h.vy * dt);
    // 不穿人：与附近单位轻推分开（与服务器的分离一致，避免频繁纠正）
    for (const o of this.units) {
      if (o === h || o.dead || o.fled) continue;
      const dx = h.x - o.x, dy = h.y - o.y;
      if (dx > 24 || dx < -24 || dy > 24 || dy < -24) continue;
      const d = Math.hypot(dx, dy), md = h.r + o.r;
      if (d < md && d > 0.01) { const push = (md - d) * 0.35; this.moveUnit(h, dx / d * push, dy / d * push); }
    }
    h.face = aim;
    if (p.isDown && p.leftButtonDown() && !battleHud.pointerOverUi) {
      if (this.heroMode === 'ranged' && h.rng && h.ammo > 0) {
        if (h.rcd <= 0) {
          const spread = 0.09 - S.hero.skills.archery * 0.007 + (h.mounted ? 0.03 : 0) + Math.hypot(h.vx, h.vy) / 3000;
          const a = aim + (Math.random() - 0.5) * spread * 2, dist = Math.hypot(wp.x - h.x, wp.y - h.y);
          this.fire(h, a, dist);
          h.rcd = h.reload; h.ammo--; h.firedT = 0.25;
          this.seq.fire = (this.seq.fire + 1) & 0xffff; this.seq.fireA = a; this.seq.fireD = dist;
          this.sendInput(true);
          if (h.ammo === 0) { this.msg('箭矢/弹药用尽，切换为近战。'); this.heroMode = 'melee'; this.refreshHeroSprite(); battleHud.refresh(); }
        }
      } else if (h.cd <= 0) {
        h.cd = (h as any).meleeSpeed ?? 0.8; h.swing = SWING;
        sfx('swing', { vol: 0.7 });
        this.seq.atk = (this.seq.atk + 1) & 0xffff; this.seq.atkA = aim;
        this.sendInput(true);
      }
    }
  }

  sendInput(force = false) {
    const now = performance.now();
    if (!force && now - this.sendT < SEND_MS) return;
    this.sendT = now;
    const h = this.hero, alive = h && !h.dead && !h.fled;
    let view: number[] | 0 = 0;
    if (now - this.viewT > 250) {
      const v = this.cameras.main.worldView;
      const vv = [Math.round(v.x), Math.round(v.y), Math.round(v.width), Math.round(v.height)];
      const key = vv.join(',');
      if (key !== this.lastView || now - this.viewT > 2000) { view = vv; this.lastView = key; this.viewT = now; }
    }
    if (!alive && !view && !force) return;
    const s = this.seq;
    send({ t: 'bi', d: [alive ? Math.round(h!.x * 10) : 0, alive ? Math.round(h!.y * 10) : 0, alive ? Math.round(h!.face * 1000) : 0, this.heroMode === 'ranged' ? 1 : 0, s.atk, Math.round(s.atkA * 1000), s.fire, Math.round(s.fireA * 1000), Math.round(s.fireD), this.cs, view] });
  }

  // ---------- 指挥（发给服务器，本地即时反馈） ----------
  order(o: Order) {
    if (this.finished) return;
    const gs = this.selGroups();
    for (const g of gs) this.psq[g].order = o;
    send({ t: 'bc', o, gs });
    const gname = this.selected === 'all' ? '全军' : { inf: '步兵', rng: '远程', cav: '骑兵' }[this.selected];
    this.msg(`${gname}：${{ hold: '原地坚守！', follow: '跟随我！', charge: '冲锋！', advance: '列阵推进！' }[o]}`);
    if (o === 'charge') { sfx('horn', { vol: 0.55 }); sfx('crowd', { vol: 0.7, delay: 0.25 }); }
    else if (o === 'hold') { sfx('drum', { vol: 0.6 }); sfx('drum', { vol: 0.5, delay: 0.35 }); }
    else if (o === 'advance') { for (let i = 0; i < 4; i++) sfx('drum', { vol: 0.55, delay: i * 0.45 }); }
    else { sfx('smallDrum', { vol: 0.6 }); sfx('smallDrum', { vol: 0.6, delay: 0.16 }); sfx('smallDrum', { vol: 0.6, delay: 0.32 }); }
    battleHud.refresh();
  }
  moveOrder(x: number, y: number) {
    if (this.finished) return;
    const gs = this.selGroups();
    const [fx, fy] = this.F.nearestFree(x, y);
    send({ t: 'bc', mv: [Math.round(fx), Math.round(fy)], gs });
    for (const g of gs) { const sq = this.psq[g]; sq.order = 'hold'; sq.ax = fx; sq.ay = fy; }
    sfx('drum', { vol: 0.5 });
    this.msg(`${this.selected === 'all' ? '全军' : { inf: '步兵', rng: '远程', cav: '骑兵' }[this.selected]}：移动到指定位置坚守！`);
    this.markT = 1.2; this.markX = x; this.markY = y;
    battleHud.refresh();
  }
  cycleForm() {
    const forms: Form[] = ['line', 'block', 'wedge', 'loose'];
    const gs = this.selGroups();
    const f = forms[(forms.indexOf(this.psq[gs[0]].form) + 1) % forms.length];
    for (const g of gs) this.setForm(g, f, true);
    this.msg(`阵型：${FORM_NAME[f]}${f === 'block' ? '（防御骑兵冲击）' : f === 'wedge' ? '（冲锋更猛）' : f === 'loose' ? '（减少箭矢伤亡）' : ''}`);
    sfx('smallDrum', { vol: 0.5 });
    battleHud.refresh();
  }
  setForm(g: Group, f: Form, quiet = false) {
    this.psq[g].form = f;
    send({ t: 'bc', f, g });
    if (!quiet) battleHud.refresh();
  }
  retreat() {
    if (this.finished) return;
    send({ t: 'bleave' });
    this.msg('传令撤退……');
  }
  autoFinish() { this.msg('联机战斗由各方真人与将领实打实地厮杀，不能自动结算。'); }
  activeCount(side: 0 | 1) { return this.stat.a[side]; }
  sideMorale(side: 0 | 1) { return this.stat.m[side]; }
  /** 参战各部（战斗界面右侧名单） */
  netInfo() {
    const ini = this.nb.init;
    return ini.parties.map(p => ({ name: p.name, side: this.loc(p.side), me: p.pid === this.myPid, player: !!p.acct, online: p.online }));
  }

  // ---------- 每帧 ----------
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.lastDt = dt;
    if (!isNaN(this.off)) this.off -= delta * 0.02; // 慢慢下调，跟上网络变慢；新包到达时再向上校正
    if (!this.finished) {
      this.audioT -= dt;
      if (this.audioT <= 0) { this.audioT = 0.4; this.updateAudio(); }
      this.elapsed += dt;
      this.updateHero(dt);
      this.sendInput();
    }
    const R = performance.now() + (isNaN(this.off) ? 0 : this.off) - DELAY;
    while (this.queue.length && this.queue[0].t <= R) this.applyQueued(this.queue.shift()!.f);
    if (this.queue.length > 60) while (this.queue.length > 20) this.applyQueued(this.queue.shift()!.f); // 卡顿后追帧
    this.interp(R, dt);
    for (const u of this.units) if (u !== this.hero && !u.dead) { u.swing -= dt; u.hitFlash -= dt; }
    this.updateProjs(dt);
    this.updateCamera(dt);
    const cam = this.cameras.main;
    weatherFx.moveCam((cam.scrollX - this.lastCam.x) * cam.zoom, (cam.scrollY - this.lastCam.y) * cam.zoom);
    this.lastCam.x = cam.scrollX; this.lastCam.y = cam.scrollY;
    this.render();
    for (const u of this.units as NU[]) if (u.tag) { if (u.spr?.visible) u.tag.setPosition(u.x, u.y - (u.mounted ? 50 : 38)).setVisible(true); else u.tag.setVisible(false); }
    battleHud.tick();
  }

  applyQueued(f: Frame) {
    for (const d of f.units) {
      const u = this.byUid[d.uid]; if (!u || u === this.hero) continue;
      if (d.mask & 4) u.face = d.face;
      if (d.mask & 8) u.hp = d.hp * u.maxHp;
      if (d.mask & 16) this.applySt(u, d.st);
    }
    for (const e of f.evs) {
      if (e.k === EV_SHOT) this.shotFx(e);
      else this.applyHit(e.to, e.from, e.dmg, e.kind);
    }
  }

  interp(R: number, dt: number) {
    const inv = dt > 0 ? 1 / dt : 0;
    for (const u of this.units as NU[]) {
      if (u === this.hero || u.dead || u.fled) continue;
      const ip = u.ip; let x: number, y: number;
      if (R >= ip.t1 || ip.t1 <= ip.t0) { x = ip.x1; y = ip.y1; }
      else if (R <= ip.t0) { x = ip.x0; y = ip.y0; }
      else { const k = (R - ip.t0) / (ip.t1 - ip.t0); x = ip.x0 + (ip.x1 - ip.x0) * k; y = ip.y0 + (ip.y1 - ip.y0) * k; }
      u.vx = u.vx * 0.5 + (x - u.x) * inv * 0.5; u.vy = u.vy * 0.5 + (y - u.y) * inv * 0.5;
      u.x = x; u.y = y;
    }
  }

  // ---------- 结束 ----------
  onEnd(m: EndMsg) {
    if (this.finished) return;
    this.finished = true; this.ending = m;
    music.play('off'); music.ambience('none');
    sfx(m.win ? 'victory' : 'defeat', { vol: 0.9 });
    battleHud.showEnd(m.win, m.retreat, () => this.leave());
  }
  onGone() {
    if (this.finished) return;
    this.finished = true;
    this.msg('这场战斗已经结束。');
    battleHud.showEnd(false, true, () => this.leave());
  }
  leave() {
    battleHud.close();
    this.scene.stop();
    if (ref.game?.scene.isSleeping('World')) this.scene.wake('World');
    const rep = this.report; this.report = null;
    if (rep) showReport(rep);
  }
}

// ---------- 事件接线 ----------
function cur(): NetBattleScene | null {
  const g = ref.game; if (!g) return null;
  const s = g.scene.getScene('NetBattle') as NetBattleScene | null;
  return s && (g.scene.isActive('NetBattle') || g.scene.isPaused('NetBattle')) ? s : null;
}
let installed = false;
export function installNetBattle() {
  if (installed) return; installed = true;
  onNet('bstart', (m: NetStart) => {
    const g = ref.game; if (!g) return;
    const s = cur();
    if (s && s.nb.bid === m.bid && m.resume && !s.finished) { s.resync(m.init); return; } // 同一场：原地重同步
    closeAll();
    nav.target = null; nav.path = [];
    if (g.scene.isActive('NetBattle') || g.scene.isPaused('NetBattle')) g.scene.stop('NetBattle');
    if (g.scene.isActive('World')) g.scene.sleep('World');
    g.scene.start('NetBattle', m);
  });
  onNet('bframe', (ab: ArrayBuffer) => cur()?.onFrame(ab));
  onNet('bspawn', (m: { u: SpawnRow[] }) => cur()?.onSpawn(m.u));
  onNet('bstat', (m: any) => cur()?.onStat(m));
  onNet('bmsg', (m: { text: string }) => cur()?.msg(m.text));
  onNet('bcorr', (m: any) => cur()?.onCorr(m));
  onNet('bgone', () => cur()?.onGone());
  onNet('bend', (m: EndMsg) => {
    const rep = applyNetBattle(m.out, m.lines, m.gold, m.retreat);
    nav.graceUntil = S.time + 3; nav.target = null; nav.path = [];
    const s = cur();
    if (s && !s.finished) { s.report = rep; s.onEnd(m); }
    else showReport(rep);
    log(m.retreat ? '你撤出了战场。' : m.win ? '战斗胜利！' : '战斗失利……', m.win ? 'good' : 'bad');
  });
}

/** 请求加入大地图上正在进行的战斗 */
export async function joinNetBattle(bid: number, side?: 0 | 1) {
  const { NETH } = await import('./hooks');
  const r = await NETH.req('bjoin', { bid, side });
  if (!r.ok) toast(r.err ?? '无法加入');
  return r.ok;
}
void NET;
