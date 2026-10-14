// 游戏核心：状态、循环、输入、相机；第一步大地图 + 第二步修炼与角色
import { Terrain } from './terrain';
import { Renderer } from './render';
import { REALMS, realmName } from '../data/realms';
import { LOCATIONS, LocDef, WORLD_SCALE, WORLD_W, WORLD_H, regionAt, Region } from '../data/world';
import { clamp } from '../core/rng';
import { audio } from './audio';
import { CharState, HANLI_LOOK, Look } from '../gfx/character';
import { Life } from './life';
import { Weather, WEATHER_NAME, WeatherKind } from './weather';
import { NodeField, GatherNode } from './nodes';
import { itemDef } from '../data/items';
import * as C from './cultivation';
import { talentById } from '../data/skills';
import type { Hero, Msg } from './cultivation';

export const DAYS_PER_SEC = 0.5;    // 现实 1 分钟 = 游戏 1 个月（30 天）
export const MEDITATE_SPEED = 4;    // 打坐时光阴流速
export const DAY_CYCLE = 240;       // 昼夜循环（现实秒）
export const FOG_CELL = 1000;
export const FOG_W = Math.ceil(WORLD_W / FOG_CELL);
export const FOG_H = Math.ceil(WORLD_H / FOG_CELL);
export const GATHER_RANGE = 130;
export const GATHER_TIME = 1.2;
const LEGACY_KEY = 'fanren_step1_save';
export const SLOT_KEYS = ['fanren_save_auto', 'fanren_save_1', 'fanren_save_2', 'fanren_save_3'];
export const SLOT_NAMES = ['自动存档', '存档一', '存档二', '存档三'];

export interface PlayerState {
  name: string; x: number; y: number;
  facing: 1 | -1; moving: boolean; flying: boolean; walkT: number;
  running: boolean; sitting: boolean;
  st: CharState; look: Look;
}

export interface UIState {
  date: { year: number; month: number; season: string };
  region: string; regionParent: string;
  nearby: LocDef | null;
  realmText: string; sense: number; senseRadius: number;
  flying: boolean; canFlyNative: boolean;
  zoom: number; px: number; py: number;
  explored: number;
  // 第二步
  hp: number; mp: number; exp: number; need: number; bottleneck: 'none' | 'small' | 'major';
  sitting: boolean; age: number; maxLife: number; expRate: number; place: string;
  gather: { name: string; kind: string } | null; gatherP: number;
  weather: string; timeName: string; night: number;
  bottle: number; pendingTalent: boolean; dead: boolean; rootName: string;
}

export interface Toast { id: number; text: string; kind?: 'info' | 'warn' | 'region' | 'good' }
export interface SlotMeta { slot: number; key: string; name: string; empty: boolean; time?: number; realm?: string; year?: number; region?: string; age?: number }
export interface SeclusionReport { days: number; from: string; to: string; expGain: number; msgs: Msg[]; reason: string }

export class Game {
  terrain: Terrain;
  renderer!: Renderer;
  canvas!: HTMLCanvasElement;
  player: PlayerState;
  hero: Hero = C.newHero();
  nodes: NodeField;
  life = new Life();
  weather = new Weather();
  day = 60; // 从第一年三月开始
  clock = DAY_CYCLE * 0.3; // 昼夜时钟（现实秒），开局为上午
  explored = new Uint8Array(FOG_W * FOG_H);
  revealAll = false;
  destination: { x: number; y: number } | null = null;
  cam = { x: 0, y: 0, zoom: 0.8, targetZoom: 0.8 };
  input = { keys: new Set<string>(), joy: { x: 0, y: 0 }, run: false };
  paused = false;
  running = false;
  time = 0;
  ui!: UIState;
  listeners = new Set<() => void>();
  toasts: Toast[] = [];
  toastListeners = new Set<() => void>();
  gathering: { node: GatherNode; t: number } | null = null;
  gatherTarget: GatherNode | null = null;
  timeScale = 1;
  private uiTimer = 0; private regionTimer = 0; private saveTimer = 0; private blockedTimer = 0; private gatherScan = 0;
  private currentRegionId = '';
  private last = 0;
  private raf = 0;
  onOpenMap?: () => void;
  onPanel?: (p: 'char' | 'bag' | 'alchemy' | 'save' | 'seclude', force?: boolean) => void;
  overview!: HTMLCanvasElement;     // 1000×700 全图缩略（小地图/世界地图共用）
  debugTeleport = false;            // 体验：世界地图点选瞬移

  constructor(terrain: Terrain) {
    this.terrain = terrain;
    this.nodes = new NodeField(terrain);
    const start = this.startPos();
    const st = new CharState(start.x, start.y);
    this.player = { name: '韩立', x: start.x, y: start.y, facing: 1, moving: false, flying: false, walkT: 0, running: false, sitting: false, st, look: HANLI_LOOK };
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.weather.onThunder = () => audio.sfx('thunder');
    this.updateUI();
  }

  private startPos() {
    const start = LOCATIONS.find((l) => l.id === 'qixuan')!;
    // 七玄门山脚，找一个可行走的位置
    for (let r = 0; r < 4000; r += 120) {
      for (let a = 0; a < 8; a++) {
        const x = start.x * WORLD_SCALE + 300 + Math.cos(a) * r, y = start.y * WORLD_SCALE + 900 + Math.sin(a) * r * 0.6;
        if (this.terrain.walkFactor(x, y) > 0 && !this.terrain.inLocZone(x, y, 40)) return { x, y };
      }
    }
    return { x: start.x * WORLD_SCALE + 260, y: start.y * WORLD_SCALE + 420 };
  }

  /** 新开一局 */
  reset() {
    const s = this.startPos();
    Object.assign(this.player, { x: s.x, y: s.y, facing: 1, moving: false, flying: false, walkT: 0, running: false, sitting: false });
    this.player.st = new CharState(s.x, s.y);
    this.hero = C.newHero();
    this.nodes.fromSave([]);
    this.day = 60; this.clock = DAY_CYCLE * 0.3; this.explored.fill(0); this.revealAll = false; this.destination = null; this.debugTeleport = false;
    this.cam.x = this.player.x; this.cam.y = this.player.y; this.cam.zoom = this.cam.targetZoom = 0.8;
    this.currentRegionId = ''; this.gathering = null;
    this.updateUI();
  }

  // ---------- 存档 ----------
  static hasSave() { try { return SLOT_KEYS.some((k) => !!localStorage.getItem(k)) || !!localStorage.getItem(LEGACY_KEY); } catch { return false; } }
  static latestSlot(): string | null {
    let best: string | null = null, bt = -1;
    try {
      for (const k of SLOT_KEYS) { const raw = localStorage.getItem(k); if (!raw) continue; const t = JSON.parse(raw).time ?? 0; if (t > bt) { bt = t; best = k; } }
      if (!best && localStorage.getItem(LEGACY_KEY)) best = LEGACY_KEY;
    } catch { /* */ }
    return best;
  }
  static listSlots(): SlotMeta[] {
    return SLOT_KEYS.map((key, slot) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { slot, key, name: SLOT_NAMES[slot], empty: true };
        const d = JSON.parse(raw);
        return { slot, key, name: SLOT_NAMES[slot], empty: false, time: d.time, realm: d.meta?.realm, year: d.meta?.year, region: d.meta?.region, age: d.meta?.age };
      } catch { return { slot, key, name: SLOT_NAMES[slot], empty: true }; }
    });
  }
  save(slot = 0) {
    if (this.hero.dead) return false;
    try {
      let s = '';
      for (let i = 0; i < this.explored.length; i++) s += this.explored[i] ? '1' : '0';
      const p = this.player;
      const data = {
        v: 2, time: Date.now(),
        p: { x: p.x, y: p.y, flying: p.flying }, day: this.day, clock: this.clock, fog: s, zoom: this.cam.targetZoom, revealAll: this.revealAll,
        hero: this.hero, nodes: this.nodes.toSave(),
        meta: { realm: realmName(this.hero.realm, this.hero.stage), year: Math.floor(this.day / 360) + 1, region: this.ui?.region ?? '', age: Math.floor(this.hero.age) },
      };
      localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(data));
      return true;
    } catch { return false; }
  }
  load(key?: string) {
    try {
      const k = key ?? Game.latestSlot();
      if (!k) return false;
      const raw = localStorage.getItem(k);
      if (!raw) return false;
      const d = JSON.parse(raw);
      const p = this.player;
      p.x = d.p.x; p.y = d.p.y; p.flying = !!d.p.flying; p.sitting = false; p.moving = false;
      p.st = new CharState(p.x, p.y);
      this.day = d.day ?? 60;
      this.clock = d.clock ?? DAY_CYCLE * 0.3;
      this.explored.fill(0);
      if (d.fog) for (let i = 0; i < Math.min(d.fog.length, this.explored.length); i++) this.explored[i] = d.fog[i] === '1' ? 1 : 0;
      this.cam.x = p.x; this.cam.y = p.y;
      this.cam.zoom = this.cam.targetZoom = d.zoom ?? 0.8;
      this.revealAll = !!d.revealAll;
      // v1（第一步）存档迁移：新建角色
      this.hero = d.v >= 2 && d.hero ? Object.assign(C.newHero(), d.hero) : C.newHero();
      if (d.v < 2 || !d.v) { this.hero.realm = d.p?.realm ?? 1; this.hero.stage = d.p?.stage ?? 0; }
      this.hero.stats = Object.assign(C.newHero().stats, this.hero.stats ?? {});
      this.nodes.fromSave(d.nodes);
      this.destination = null; this.currentRegionId = ''; this.gathering = null;
      this.updateUI(true);
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  static deleteSlot(slot: number) { try { localStorage.removeItem(SLOT_KEYS[slot]); } catch { /* */ } }
  static clearAll() { try { for (const k of SLOT_KEYS) localStorage.removeItem(k); localStorage.removeItem(LEGACY_KEY); } catch { /* */ } }

  // ---------- 派生数值 ----------
  get stats() { return C.heroStats(this.hero); }
  get sense() { return this.stats.sense; }
  get senseRadius() {
    const s = this.sense;
    return s <= 0 ? 380 : 450 + 55 * Math.sqrt(s);
  }
  get canFlyNative() { return REALMS[this.hero.realm].fly; }
  get isFlying() { return this.player.flying || this.canFlyNative; }
  get speed() {
    const base = REALMS[this.hero.realm].speed * (1 + C.mod(this.hero, 'mapSpeed'));
    if (this.player.flying && !this.canFlyNative) return 420; // 体验御剑
    if (this.isFlying) return base;
    return this.player.running ? base * 1.6 : base;
  }
  get season() { const m = Math.floor(this.day / 30) % 12; return m < 3 ? 0 : m < 6 ? 1 : m < 9 ? 2 : 3; }
  /** 日光 0（子夜）–1（正午） */
  get light() { return 0.5 - 0.5 * Math.cos(2 * Math.PI * this.dayPhase); }
  /** 夜色 0–1 */
  get night() { return clamp((0.62 - this.light) / 0.5, 0, 1); }
  get dayPhase() { return (this.clock / DAY_CYCLE) % 1; }
  /** 修炼地加成 */
  placeBonus(): { mult: number; name: string } {
    const p = this.player;
    let mult = 1, name = '野外';
    const loc = this.nearbyLocation();
    if (loc?.type === 'sect') { mult = 1.2; name = loc.name; }
    else if (loc?.type === 'secret' || loc?.type === 'danger') { mult = 1.1; name = loc.name; }
    if (this.nodes.springNear(p.x, p.y)) { mult *= 2; name = '灵泉畔'; }
    return { mult, name };
  }

  // ---------- 生命周期 ----------
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(this, canvas);
    this.bindInput();
    this.revealAround(true);
    this.updateUI(true);
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.max(0, Math.min(0.1, (t - this.last) / 1000));
      this.last = t;
      this.update(dt);
      this.renderer.render(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.save(0);
  }

  // ---------- 主更新 ----------
  update(dt: number) {
    this.time += dt;
    this.terrain.frame++;
    const p = this.player, st = p.st, h = this.hero;
    this.cam.zoom += (this.cam.targetZoom - this.cam.zoom) * Math.min(1, dt * 10);
    const active = !this.paused && !h.dead;
    if (active) {
      // 移动输入
      let mx = 0, my = 0;
      const k = this.input.keys;
      if (k.has('w') || k.has('arrowup')) my -= 1;
      if (k.has('s') || k.has('arrowdown')) my += 1;
      if (k.has('a') || k.has('arrowleft')) mx -= 1;
      if (k.has('d') || k.has('arrowright')) mx += 1;
      mx += this.input.joy.x; my += this.input.joy.y;
      if (mx || my) { this.destination = null; this.pendingGather = null; }
      else if (this.destination) {
        const dx = this.destination.x - p.x, dy = this.destination.y - p.y, d = Math.hypot(dx, dy);
        if (d < 24 || (this.pendingGather && Math.hypot(this.pendingGather.x - p.x, this.pendingGather.y - p.y) < GATHER_RANGE * 0.8)) {
          this.destination = null;
          if (this.pendingGather) { this.pendingGather = null; this.tryGather(); }
        }
        else { mx = dx / d; my = dy / d; }
      }
      const len = Math.hypot(mx, my);
      const wantMove = len > 0.05;
      if (wantMove && p.sitting) this.stand();
      if (wantMove && this.gathering) { this.gathering = null; }
      p.running = (k.has('shift') || this.input.run) && !this.isFlying;
      p.moving = wantMove;
      let vx = 0, vy = 0;
      if (p.moving) {
        if (len > 1) { mx /= len; my /= len; }
        if (Math.abs(mx) > 0.15) p.facing = mx > 0 ? 1 : -1;
        const factor = this.isFlying ? 1 : this.terrain.walkFactor(p.x, p.y) || 1;
        const sp = this.speed * factor;
        const ox = p.x, oy = p.y;
        const nx = clamp(p.x + mx * sp * dt, 200, WORLD_W - 200), ny = clamp(p.y + my * sp * dt, 200, WORLD_H - 200);
        if (this.isFlying || this.terrain.walkFactor(nx, ny) > 0) { p.x = nx; p.y = ny; }
        else if (this.terrain.walkFactor(nx, p.y) > 0) { p.x = nx; }
        else if (this.terrain.walkFactor(p.x, ny) > 0) { p.y = ny; }
        else {
          this.destination = null;
          if (this.blockedTimer <= 0) {
            this.toast('前方是茫茫大海。炼气期修士无法渡海，需筑基御器，或寻找传送阵、乘坐渡船。', 'warn');
            this.blockedTimer = 6;
          }
        }
        vx = (p.x - ox) / Math.max(dt, 1e-4); vy = (p.y - oy) / Math.max(dt, 1e-4);
        p.walkT += dt * (this.isFlying ? 1 : factor);
        st.faceToward(mx, my, false);
      }
      this.blockedTimer -= dt;
      // 动作状态机
      st.x = p.x; st.y = p.y; st.vx = vx; st.vy = vy; st.speed = Math.hypot(vx, vy);
      st.windX = this.weather.wind * 30; st.windY = 0;
      if (this.isFlying) { st.setAction('fly'); st.lift += (46 - st.lift) * Math.min(1, dt * 4); }
      else {
        st.lift += (0 - st.lift) * Math.min(1, dt * 6);
        if (this.gathering) st.setAction('gather');
        else if (p.sitting) st.setAction('sit');
        else if (p.moving) st.setAction(p.running ? 'run' : 'walk');
        else st.setAction('idle');
      }
      // 采集
      if (this.gathering) {
        this.gathering.t += dt;
        if (this.gathering.t >= GATHER_TIME) this.finishGather();
      }
      this.gatherScan -= dt;
      if (this.gatherScan <= 0) { this.gatherScan = 0.15; this.gatherTarget = this.isFlying ? null : this.nodes.nearest(p.x, p.y, GATHER_RANGE, this.day); }
      // 光阴流逝
      this.timeScale = p.sitting ? MEDITATE_SPEED : 1;
      const days = dt * DAYS_PER_SEC * this.timeScale;
      this.day += days;
      const msgs: Msg[] = [];
      const hadTalent = !!h.pendingTalent;
      C.passDays(h, days, p.sitting, this.placeBonus().mult, msgs);
      this.flushMsgs(msgs);
      if (!hadTalent && h.pendingTalent) { this.stand(); this.onPanel?.('char', true); }
      if (p.sitting && C.bottleneck(h) !== 'none' && !this.bnWarned) {
        this.bnWarned = true;
        this.toast(C.bottleneck(h) === 'major' ? `修为已臻${realmName(h.realm, h.stage)}圆满，可尝试冲击${REALMS[h.realm + 1]?.name ?? ''}（C 打开角色面板）。` : '修为已至瓶颈，需服丹冲关方能更进一步（C 打开角色面板）。', 'warn');
      }
      if (C.bottleneck(h) === 'none') this.bnWarned = false;
      if (h.dead) { this.stand(); this.updateUI(true); try { localStorage.removeItem(SLOT_KEYS[0]); } catch { /* */ } }
      this.revealAround(false);
    }
    this.clock += dt * (active ? (p.sitting ? 2.5 : 1) : 0.2);
    st.update(dt);
    // 天气 / 生灵
    const s = this.terrain.sample(p.x, p.y);
    this.weather.update(dt, { cold: s.cold, arid: s.arid, sea: !this.terrain.isLand(p.x, p.y) || s.land < 0.6, season: this.season });
    if (this.renderer) {
      const v = this.renderer.viewRect();
      this.life.update(dt, this, v, this.night, this.season, this.weather.kind);
    }
    // 相机跟随
    this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (p.y - st.lift * 0.5 - this.cam.y) * Math.min(1, dt * 6);

    this.regionTimer -= dt;
    if (this.regionTimer <= 0) { this.regionTimer = 0.35; this.checkRegion(); }
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.uiTimer = 0.12; this.updateUI(); }
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.save(0); }
  }
  private bnWarned = false;

  private flushMsgs(msgs: Msg[]) {
    for (const m of msgs) {
      this.toast(m.text, m.kind === 'warn' ? 'warn' : m.kind === 'good' ? 'good' : 'info');
      if (m.text.includes('晋入') || m.text.includes('成矣')) audio.sfx('break');
    }
  }

  // ---------- 第二步操作 ----------
  toggleSit() {
    const p = this.player;
    if (this.hero.dead) return;
    if (p.sitting) { this.stand(); return; }
    if (this.isFlying) {
      if (this.canFlyNative) { this.toast('御空之中无法打坐。', 'warn'); return; }
      if (!this.terrain.isLand(p.x, p.y)) { this.toast('身下是大海，无法落脚打坐。', 'warn'); return; }
      p.flying = false;
    }
    if (this.hero.realm >= 2 && this.canFlyNative && !this.terrain.isLand(p.x, p.y)) { this.toast('身下是大海，无法落脚打坐。', 'warn'); return; }
    this.gathering = null; this.destination = null;
    p.sitting = true;
    const pl = this.placeBonus();
    this.toast(`盘膝打坐，运转${C.gongfaDef(this.hero).name}……（光阴流速 ×${MEDITATE_SPEED}${pl.mult > 1 ? `，${pl.name}灵气充沛 ×${pl.mult.toFixed(1)}` : ''}）`);
    audio.sfx('chime');
  }
  stand() { if (this.player.sitting) { this.player.sitting = false; } }

  tryGather() {
    const p = this.player;
    if (this.hero.dead || this.gathering) return;
    if (this.isFlying) { this.toast('需落地方可采集。', 'warn'); return; }
    const n = this.nodes.nearest(p.x, p.y, GATHER_RANGE, this.day);
    if (!n) {
      const far = this.nodes.nearest(p.x, p.y, this.senseRadius, this.day);
      this.toast(far ? '神识中感应到附近有灵物，走近些再采。' : '神识所及，并无可采之物。', 'warn');
      return;
    }
    this.stand();
    this.destination = null;
    p.st.faceToward(n.x - p.x, n.y - p.y, false);
    this.gathering = { node: n, t: 0 };
  }
  private finishGather() {
    const g = this.gathering!; this.gathering = null;
    const got = this.nodes.harvest(g.node, this.day, C.mod(this.hero, 'herb'), C.mod(this.hero, 'luck') * 100);
    const parts: string[] = [];
    for (const it of got) {
      C.addItem(this.hero, it.item, it.n, it.age);
      parts.push(`${itemDef(it.item).name}${it.age ? `（${it.age}年）` : ''}×${it.n}`);
    }
    this.hero.stats.gathered++;
    this.toast('采得 ' + parts.join('、'), 'good');
    audio.sfx('gather');
    this.renderer?.burst(g.node.x, g.node.y - 10, g.node.kind === 'ore' ? '#d8e0ff' : g.node.kind === 'spring' ? '#bff0ff' : '#c8ffb0');
    this.updateUI(true);
  }

  /** 闭关：days 天，或 0 表示直到瓶颈（最多 30 年） */
  seclude(days: number): SeclusionReport {
    const h = this.hero;
    const from = realmName(h.realm, h.stage);
    const msgs: Msg[] = [];
    const cap = days > 0 ? days : 360 * 30;
    let d = 0, gain = 0, reason = '期满出关';
    const place = this.placeBonus().mult;
    while (d < cap) {
      if (h.pendingTalent) { reason = '心有所感，逆天改命'; break; }
      if (C.bottleneck(h) !== 'none') { reason = C.bottleneck(h) === 'major' ? '修为圆满，触及大境界瓶颈' : '触及瓶颈，需服丹冲关'; break; }
      const step = Math.min(1, cap - d);
      const before = h.exp;
      const bl = h.realm * 100 + h.stage;
      C.passDays(h, step, true, place, msgs);
      gain += (h.realm * 100 + h.stage !== bl) ? C.expPerDay(h, place) * step : h.exp - before;
      d += step;
      if (h.pendingTalent) { reason = '心有所感，逆天改命'; break; }
      if (h.dead) { reason = '寿元耗尽'; break; }
    }
    this.day += d;
    this.clock += 37; // 出关时辰随机变化
    const to = realmName(h.realm, h.stage);
    // 只保留重要消息
    const important = msgs.filter((m) => m.kind === 'good' || m.kind === 'warn');
    const collapsed: Msg[] = [];
    const drops = important.filter((m) => m.text.includes('绿液')).length;
    for (const m of important) if (!m.text.includes('绿液')) collapsed.push(m);
    if (drops) collapsed.push({ text: `掌天瓶凝出绿液 ${drops} 滴。`, kind: 'good' });
    if (from !== to) audio.sfx('break');
    this.save(0);
    this.updateUI(true);
    return { days: d, from, to, expGain: Math.round(gain), msgs: collapsed, reason };
  }

  breakthrough(pills: number) {
    const r = C.tryBreak(this.hero, pills);
    this.flushMsgs(r.msgs);
    audio.sfx(r.ok ? 'break' : 'fail');
    if (r.ok) this.renderer?.burst(this.player.x, this.player.y - 60, '#fff2b0', 60);
    this.updateUI(true);
    return r;
  }
  usePill(id: string) {
    const msgs: Msg[] = [];
    const ok = C.usePill(this.hero, id, msgs);
    this.flushMsgs(msgs);
    if (ok) audio.sfx('chime');
    this.updateUI(true);
    return ok;
  }
  useBottle(stack: C.BagItem) { const m = C.useBottle(this.hero, stack); this.flushMsgs([m]); if (m.kind === 'good') audio.sfx('chime'); this.updateUI(true); return m; }
  brew(r: import('../data/recipes').Recipe) {
    const res = C.brew(this.hero, r);
    if (res.days) { const msgs: Msg[] = []; C.passDays(this.hero, res.days, false, 1, msgs); this.day += res.days; this.flushMsgs(msgs.filter((m) => m.kind)); }
    audio.sfx(res.ok ? 'break' : 'fail');
    this.updateUI(true);
    return res;
  }
  chooseTalent(id: string) { C.chooseTalent(this.hero, id); audio.sfx('break'); this.toast(`逆天改命：获得「${talentById(id)?.name ?? id}」`, 'good'); this.updateUI(true); }

  revealAround(force: boolean) {
    const r = this.senseRadius;
    const p = this.player;
    const x0 = Math.max(0, Math.floor((p.x - r) / FOG_CELL)), x1 = Math.min(FOG_W - 1, Math.floor((p.x + r) / FOG_CELL));
    const y0 = Math.max(0, Math.floor((p.y - r) / FOG_CELL)), y1 = Math.min(FOG_H - 1, Math.floor((p.y + r) / FOG_CELL));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const cx = (x + 0.5) * FOG_CELL, cy = (y + 0.5) * FOG_CELL;
      if (Math.hypot(cx - p.x, cy - p.y) < r + FOG_CELL * 0.45 || force && Math.hypot(cx - p.x, cy - p.y) < r + FOG_CELL) this.explored[y * FOG_W + x] = 1;
    }
  }

  isExplored(wx: number, wy: number) {
    if (this.revealAll) return true;
    const x = Math.floor(wx / FOG_CELL), y = Math.floor(wy / FOG_CELL);
    if (x < 0 || y < 0 || x >= FOG_W || y >= FOG_H) return false;
    return this.explored[y * FOG_W + x] === 1;
  }

  private checkRegion() {
    const p = this.player;
    const mx = p.x / WORLD_SCALE, my = p.y / WORLD_SCALE;
    const onLand = this.terrain.isLand(p.x, p.y);
    const r: Region | null = regionAt(mx, my, onLand);
    const id = r ? r.id : 'none';
    if (id !== this.currentRegionId) {
      const first = this.currentRegionId === '';
      this.currentRegionId = id;
      if (r && !first) this.toast(r.parent === r.name ? r.name : `${r.parent} · ${r.name}`, 'region');
    }
  }

  nearbyLocation(): LocDef | null {
    const p = this.player;
    let best: LocDef | null = null, bd = 1e9;
    for (const l of LOCATIONS) {
      const z = this.terrain.locZones.find((q) => q.id === l.id);
      const d = Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y);
      const r = z ? Math.max(z.rx, z.ry) * 1.25 + 200 : (l.type === 'city' || l.type === 'sect' ? 620 : 520);
      if (d < r && d < bd) { bd = d; best = l; }
    }
    return best;
  }

  timeName() {
    const ph = this.dayPhase;
    const names = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    // ph=0 正午（午时），0.5 子夜
    const hour = ph * 24;
    return names[Math.floor(((hour + 1) % 24) / 2)];
  }

  updateUI(force = false) {
    void force;
    const p = this.player, h = this.hero;
    const totalMonths = Math.floor(this.day / 30);
    const year = Math.floor(totalMonths / 12) + 1, month = (totalMonths % 12) + 1;
    const season = month <= 3 ? '春' : month <= 6 ? '夏' : month <= 9 ? '秋' : '冬';
    const mx = p.x / WORLD_SCALE, my = p.y / WORLD_SCALE;
    const r = regionAt(mx, my, this.terrain.isLand(p.x, p.y));
    let ex = 0; for (let i = 0; i < this.explored.length; i++) ex += this.explored[i];
    const pl = this.placeBonus();
    const gt = this.gatherTarget;
    this.ui = {
      date: { year, month, season },
      region: r ? r.name : '荒野', regionParent: r ? r.parent : '',
      nearby: this.nearbyLocation(),
      realmText: realmName(h.realm, h.stage), sense: this.sense, senseRadius: Math.round(this.senseRadius),
      flying: this.isFlying, canFlyNative: this.canFlyNative,
      zoom: this.cam.targetZoom, px: p.x, py: p.y,
      explored: ex / this.explored.length,
      hp: h.hp, mp: h.mp, exp: h.exp, need: C.need(h), bottleneck: C.bottleneck(h),
      sitting: p.sitting, age: h.age, maxLife: C.maxLife(h), expRate: C.expPerDay(h, pl.mult), place: pl.name,
      gather: gt ? { name: itemDef(gt.item).name, kind: gt.kind } : null, gatherP: this.gathering ? this.gathering.t / GATHER_TIME : -1,
      weather: WEATHER_NAME[this.weather.kind], timeName: this.timeName(), night: this.night,
      bottle: h.bottle.drops, pendingTalent: !!h.pendingTalent, dead: h.dead, rootName: C.rootDef(h).name,
    };
    this.listeners.forEach((f) => f());
  }

  subscribe(f: () => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }
  subscribeToasts(f: () => void) { this.toastListeners.add(f); return () => { this.toastListeners.delete(f); }; }

  private toastId = 0;
  toast(text: string, kind: Toast['kind'] = 'info') {
    const t = { id: ++this.toastId, text, kind };
    this.toasts = [...this.toasts.slice(-3), t];
    this.toastListeners.forEach((f) => f());
    setTimeout(() => { this.toasts = this.toasts.filter((x) => x.id !== t.id); this.toastListeners.forEach((f) => f()); }, kind === 'region' ? 3200 : 4200);
  }

  // ---------- 操作 ----------
  setZoom(z: number) { this.cam.targetZoom = clamp(z, 0.22, 1.6); this.updateUI(); }
  zoomBy(f: number) { this.setZoom(this.cam.targetZoom * f); }
  toggleFly() {
    if (this.canFlyNative) return;
    this.stand(); this.gathering = null;
    this.player.flying = !this.player.flying;
    if (!this.player.flying && !this.terrain.isLand(this.player.x, this.player.y)) {
      this.player.flying = true;
      this.toast('身下是大海，不能在此落下。', 'warn');
      return;
    }
    this.toast(this.player.flying ? '（体验模式）御剑而起，可自由飞越山海。' : '收起飞剑，落地步行。');
    audio.sfx(this.player.flying ? 'whoosh' : 'land');
    this.updateUI();
  }
  setDestination(wx: number, wy: number) {
    this.destination = { x: clamp(wx, 200, WORLD_W - 200), y: clamp(wy, 200, WORLD_H - 200) };
  }
  teleport(wx: number, wy: number) {
    this.player.x = wx; this.player.y = wy; this.player.st.x = wx; this.player.st.y = wy; this.cam.x = wx; this.cam.y = wy; this.destination = null;
    this.revealAround(true);
    this.updateUI();
  }
  setWeather(k: WeatherKind | null) { this.weather.forced = k; this.weather.timer = 0; }

  screenToWorld(sx: number, sy: number) {
    const r = this.canvas.getBoundingClientRect();
    const z = this.cam.zoom;
    return { x: this.cam.x + (sx - r.left - r.width / 2) / z, y: this.cam.y + (sy - r.top - r.height / 2) / z };
  }

  private unbind?: () => void;
  private bindInput() {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (e.repeat && 'mfzecblp'.includes(k)) return;
      this.input.keys.add(k);
      if (k === 'm') this.onOpenMap?.();
      if (this.paused || this.hero.dead) return;
      if (k === 'f') this.toggleFly();
      if (k === 'z') this.toggleSit();
      if (k === 'e') this.tryGather();
      if (k === 'c') this.onPanel?.('char');
      if (k === 'b') this.onPanel?.('bag');
      if (k === 'l') this.onPanel?.('alchemy');
      if (k === 'p') this.onPanel?.('seclude');
      if (k === '=' || k === '+') this.zoomBy(1.2);
      if (k === '-') this.zoomBy(1 / 1.2);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => this.input.keys.delete(e.key.toLowerCase());
    const blur = () => this.input.keys.clear();
    const wheel = (e: WheelEvent) => { e.preventDefault(); this.zoomBy(e.deltaY > 0 ? 1 / 1.12 : 1.12); };
    // 指针：点击移动 / 双指缩放
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
    let pinchStart = 0, pinchZoom = 1, moved = false;
    const pd = (e: PointerEvent) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      moved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = this.cam.targetZoom;
      }
    };
    const pm = (e: PointerEvent) => {
      const pt = pointers.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX; pt.y = e.clientY;
      if (Math.hypot(pt.x - pt.sx, pt.y - pt.sy) > 10) moved = true;
      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        this.setZoom(pinchZoom * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart);
      }
    };
    const pu = (e: PointerEvent) => {
      const pt = pointers.get(e.pointerId);
      const wasPinch = pointers.size >= 2;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (pt && !moved && !wasPinch && e.button === 0 && !this.hero.dead) {
        const w = this.screenToWorld(e.clientX, e.clientY);
        // 点击灵物：走过去并采集
        const n = this.nodes.nearest(w.x, w.y, 60, this.day);
        if (n && Math.hypot(n.x - this.player.x, n.y - this.player.y) < this.senseRadius) {
          if (Math.hypot(n.x - this.player.x, n.y - this.player.y) < GATHER_RANGE) this.tryGather();
          else { this.setDestination(n.x, n.y + 30); this.pendingGather = n; }
        } else { this.setDestination(w.x, w.y); this.pendingGather = null; }
        audio.unlock();
      }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    this.canvas.addEventListener('wheel', wheel, { passive: false });
    this.canvas.addEventListener('pointerdown', pd);
    this.canvas.addEventListener('pointermove', pm);
    this.canvas.addEventListener('pointerup', pu);
    this.canvas.addEventListener('pointercancel', pu);
    this.unbind = () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      this.canvas.removeEventListener('wheel', wheel);
      this.canvas.removeEventListener('pointerdown', pd);
      this.canvas.removeEventListener('pointermove', pm);
      this.canvas.removeEventListener('pointerup', pu);
      this.canvas.removeEventListener('pointercancel', pu);
    };
  }
  pendingGather: GatherNode | null = null;
}


export async function createGame(onProgress: (p: number, msg: string) => void) {
  onProgress(0.1, '研墨铺纸…');
  await new Promise((r) => setTimeout(r, 30));
  onProgress(0.3, '勾勒人界山川…');
  await new Promise((r) => setTimeout(r, 30));
  const terrain = new Terrain();
  terrain.build();
  onProgress(0.85, '点染江河湖海…');
  await new Promise((r) => setTimeout(r, 30));
  const g = new Game(terrain);
  g.overview = terrain.buildOverview(1);
  onProgress(1, '画卷已成');
  return g;
}
