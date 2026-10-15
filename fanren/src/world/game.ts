// 游戏核心：状态、循环、输入、相机；第一步大地图 + 第二步修炼与角色
import { Terrain } from './terrain';
import { Renderer } from './render';
import { REALMS, realmName } from '../data/realms';
import { LOCATIONS, LocDef, WORLD_SCALE, WORLD_W, WORLD_H, MACRO_W, regionAt, Region } from '../data/world';
import { clamp } from '../core/rng';
import { audio } from './audio';
import { CharState, HANLI_LOOK, Look } from '../gfx/character';
import { Life } from './life';
import { Weather, WEATHER_NAME, WeatherKind } from './weather';
import { NodeField, GatherNode } from './nodes';
import { itemDef } from '../data/items';
import * as C from './cultivation';
import { talentById } from '../data/skills';
import { Combat, Enemy } from './combat';
import { ENEMY_LIST } from '../data/enemies';
import { ARTS, profLevel } from '../data/arts';
import type { Hero, Msg } from './cultivation';
import { NpcWorld } from './npc';
import { Hearts } from './hearts';
import { Towns } from './town';
import { Events } from './events';
import { Story } from './story';
import { WorldState, newWorldState } from './worldstate';
import type { Modal, DNode, Shop } from './modal';

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
  sitting: boolean; concealed: boolean; age: number; maxLife: number; expRate: number; place: string;
  gather: { name: string; kind: string } | null; gatherP: number;
  weather: string; timeName: string; night: number;
  bottle: number; pendingTalent: boolean; dead: boolean; rootName: string;
  talk: string | null;
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
  debugSeeAll = false;            // 调试：无视神识
  revealT = new Map<number, number>(); // 迷雾格揭开时间（用于淡出）
  destination: { x: number; y: number } | null = null;
  cam = { x: 0, y: 0, zoom: 0.8, targetZoom: 0.8 };
  input = { keys: new Set<string>(), joy: { x: 0, y: 0 }, run: false, mouse: { x: 0, y: 0, t: -99, active: false } };
  combat: Combat;
  ws: WorldState = newWorldState();
  npcs!: NpcWorld;
  hearts!: Hearts;
  towns!: Towns;
  events!: Events;
  story!: Story;
  modal: Modal | null = null;
  private modalStack: Modal[] = [];
  modalListeners = new Set<() => void>();
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
  onPanel?: (p: 'char' | 'bag' | 'alchemy' | 'save' | 'seclude' | 'skills', force?: boolean) => void;
  overview!: HTMLCanvasElement;     // 1000×700 全图缩略（小地图/世界地图共用）
  debugTeleport = false;            // 体验：世界地图点选瞬移

  constructor(terrain: Terrain) {
    this.terrain = terrain;
    this.nodes = new NodeField(terrain);
    this.combat = new Combat(this);
    this.npcs = new NpcWorld(this);
    this.npcs.newWorld();
    this.hearts = new Hearts(this);
    this.towns = new Towns(this);
    this.events = new Events(this);
    this.story = new Story(this);
    this.hookCombat();
    const start = this.startPos();
    const st = new CharState(start.x, start.y);
    this.player = { name: '韩立', x: start.x, y: start.y, facing: 1, moving: false, flying: false, walkT: 0, running: false, sitting: false, st, look: HANLI_LOOK };
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.weather.onThunder = () => audio.sfx('thunder');
    this.updateUI();
  }

  private startPos() {
    // 开局：黄枫谷山门前（宗门地界南缘，面朝山门）
    const i = LOCATIONS.findIndex((l) => l.id === 'huangfeng');
    const L = LOCATIONS[i], z = this.terrain.locZones?.[i];
    const cx = z ? z.x : L.x * WORLD_SCALE, cy = z ? z.y + z.ry + 140 : L.y * WORLD_SCALE + 600;
    for (let r = 0; r < 3000; r += 60) {
      for (let a = 0; a < 12; a++) {
        const x = cx + Math.cos(a / 12 * Math.PI * 2) * r, y = cy + Math.abs(Math.sin(a / 12 * Math.PI * 2)) * r * 0.6;
        if (this.terrain.walkFactor(x, y) > 0 && !this.terrain.inLocZone(x, y, 20)) return { x, y };
      }
    }
    return { x: cx, y: cy };
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
    this.combat.reset();
    this.ws = newWorldState();
    this.npcs.newWorld();
    this.modal = null; this.modalStack = []; this.emitModal();
    this.story.start();
    // 已是黄枫谷外门弟子（持升仙令入门）
    this.ws.sect = { id: 'huangfeng', rank: 0, contrib: 50, joined: this.day, lastPay: this.day, tasks: [], done: 0 };
    this.towns.refreshTasks();
    this.player.st.faceToward(0, -1, true);
    this.updateUI();
  }

  // ---------- 第四～六步：NPC、红颜、城镇、大事件 ----------
  private hookCombat() {
    const c = this.combat as any;
    const prevKill = c.onKill, prevSpar = c.onSparEnd;
    c.onKill = (e: any) => { prevKill?.(e); this.npcs.onEnemyKilled(e); this.towns.onKill(e.def.id); this.events.onKill(e); };
    c.onSparEnd = (e: any, won: boolean) => { prevSpar?.(e, won); if (!this.events.onSpar(e, won)) this.npcs.onSpar(e, won); };
  }
  get halted() { return this.paused || !!this.modal; }
  openModal(m: Modal) {
    if (this.modal && (this.modal.kind === 'town' || this.modal.kind === 'hearts' || this.modal.kind === 'chronicle')) this.modalStack.push(this.modal);
    this.modal = m; this.stand(); this.input.keys.clear(); this.emitModal();
  }
  openDialog(node: DNode) {
    if (this.modal?.kind === 'dialog') { this.modal = { kind: 'dialog', node }; this.emitModal(); return; }
    this.openModal({ kind: 'dialog', node });
  }
  openShop(shop: Shop) { if (this.modal?.kind === 'dialog') this.modal = null; this.openModal({ kind: 'shop', shop }); }
  closeModal(all = false) {
    if (all) this.modalStack = [];
    this.modal = this.modalStack.pop() ?? null; this.emitModal(); this.updateUI(true);
  }
  emitModal() { this.modalListeners.forEach((f) => f()); }
  subscribeModal(f: () => void) { this.modalListeners.add(f); return () => { this.modalListeners.delete(f); }; }
  /** 新手提示：每条只出现一次 */
  hint(id: string, text: string) {
    if (this.ws.hints.includes(id)) return;
    this.ws.hints.push(id); this.toast(text, 'good');
  }
  private hintTick() {
    const p = this.player, h = this.hero;
    if (this.npcs.focus) this.hint('talk', '提示：按 T（或点击下方按钮）与身旁之人交谈。');
    const l = this.ui?.nearby;
    if (l && this.towns.canEnter(l)) this.hint('town', `提示：按 G 进入${l.name}——坊市、酒楼、客栈、传送阵${l.type === 'sect' ? '、拜入宗门' : ''}。`);
    if (this.events.enc.some((e) => e.seen)) this.hint('enc', '提示：奇遇只在神识之内显现。走近后按 T 查看。');
    if (Object.values(this.ws.hearts).some((s) => s.met)) this.hint('hearts', '提示：按 H 打开红颜录，查看好感与故事线索。');
    if (this.ws.news.length) this.hint('chron', '提示：按 J 打开大事记——原著大事件会按年份发生，你可以改变结局。');
    if (this.combat.enemies.some((e) => !e.dead && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < this.senseRadius)) this.hint('fight', '提示：数字键 1–9 施法，鼠标指向即瞄准；不动鼠标时自动锁定最近敌人。');
    if (this.gatherTarget) this.hint('gather', '提示：按 E 采集神识中的灵物。');
    if (C.bottleneck(h) !== 'none') this.hint('bottle', '提示：修为已满，按 C 打开角色面板冲关。');
    if (h.realm === 1 && h.stage >= 5 && !this.ws.sect) this.hint('sect', '提示：炼气五层后可拜入黄枫谷等大宗门；持升仙令可直接入黄枫谷。');
    if (this.canFlyNative) this.hint('fly', '提示：已可御剑飞行——按 F（或右下「剑」按钮）随时起落；打坐、采集时会自动落地。');
    if (this.ws.flags.invasion) this.hint('inv', '魔道入侵越国！在越国斩杀魔修削弱攻势，再前往黄枫谷破敌。');
  }
  news(text: string, kind: 'canon' | 'rumor' | 'personal' = 'rumor') {
    this.ws.news.push({ day: Math.floor(this.day), text, kind });
    if (this.ws.news.length > 160) this.ws.news.splice(0, this.ws.news.length - 160);
  }
  /** 打听到某地：在地图上揭开周围 */
  markKnown(l: LocDef) {
    const cx = l.x * WORLD_SCALE, cy = l.y * WORLD_SCALE, r = 1600;
    for (let y = Math.floor((cy - r) / FOG_CELL); y <= Math.floor((cy + r) / FOG_CELL); y++) for (let x = Math.floor((cx - r) / FOG_CELL); x <= Math.floor((cx + r) / FOG_CELL); x++) {
      if (x < 0 || y < 0 || x >= FOG_W || y >= FOG_H) continue;
      if (Math.hypot((x + 0.5) * FOG_CELL - cx, (y + 0.5) * FOG_CELL - cy) < r) this.explored[y * FOG_W + x] = 1;
    }
  }
  /** T：与身旁的人交谈 / 查看奇遇 */
  interact() {
    const p = this.player;
    const sf = this.story.focus;
    if (sf) { const dsf = Math.hypot(sf.x - p.x, sf.y - p.y); const dn0 = this.npcs.focus ? Math.hypot(this.npcs.focus.st.x - p.x, this.npcs.focus.st.y - p.y) : 1e9; if (dsf <= dn0 + 40) { this.story.interact(sf); return; } }
    const n = this.npcs.focus, e = this.events.focus;
    const dn = n ? Math.hypot(n.st.x - p.x, n.st.y - p.y) : 1e9, de = e ? Math.hypot(e.x - p.x, e.y - p.y) : 1e9;
    if (n && dn <= de) { this.npcs.interact(); return; }
    if (e) { this.events.interact(e); return; }
    const l = this.ui?.nearby;
    if (l && this.towns.canEnter(l)) { this.enterTown(); return; }
  }
  enterTown() {
    const l = this.nearbyLocation();
    if (!l || !this.towns.canEnter(l)) { this.toast('附近没有可以进入的城镇或宗门。', 'warn'); return; }
    this.towns.open(l);
  }
  private townZoom: number | null = null;
  private townAutoZoom() {
    const l = this.ui?.nearby;
    const inTown = !!l && (l.type === 'city' || l.type === 'town' || l.type === 'sect') && !this.isFlying;
    if (inTown && this.townZoom === null) { this.townZoom = this.cam.targetZoom; if (this.cam.targetZoom < 1.15) this.cam.targetZoom = 1.2; this.towns.onVisit(l!.id); }
    else if (!inTown && this.townZoom !== null) { if (this.cam.targetZoom >= 1.15) this.cam.targetZoom = this.townZoom; this.townZoom = null; }
    if (l && !inTown) this.towns.onVisit(l.id);
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
        v: 2, ws: WORLD_SCALE, time: Date.now(),
        p: { x: p.x, y: p.y, flying: p.flying }, day: this.day, clock: this.clock, fog: s, zoom: this.cam.targetZoom, revealAll: this.revealAll,
        hero: this.hero, nodes: this.nodes.toSave(), world: this.ws, npcs: this.npcs.toSave(),
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
      // 地图比例变化（第三步 180 → 第四步 300）：坐标与迷雾按比例迁移
      const ws0 = d.ws ?? (d.hero?.arts ? 180 : 100), wk = WORLD_SCALE / ws0;
      p.x = d.p.x * wk; p.y = d.p.y * wk; p.flying = !!d.p.flying; p.sitting = false; p.moving = false;
      if (!p.flying && this.terrain.walkFactor(p.x, p.y) <= 0) p.flying = true;   // 旧存档：筑基后停在海上时保持飞行
      p.st = new CharState(p.x, p.y);
      this.day = d.day ?? 60;
      this.clock = d.clock ?? DAY_CYCLE * 0.3;
      this.explored.fill(0);
      if (d.fog && wk === 1) for (let i = 0; i < Math.min(d.fog.length, this.explored.length); i++) this.explored[i] = d.fog[i] === '1' ? 1 : 0;
      else if (d.fog) {
        const ow = Math.ceil(MACRO_W * ws0 / FOG_CELL);
        for (let i = 0; i < d.fog.length; i++) if (d.fog[i] === '1') {
          const ox = (i % ow) * FOG_CELL * wk, oy = Math.floor(i / ow) * FOG_CELL * wk, os = FOG_CELL * wk;
          for (let yy = Math.floor(oy / FOG_CELL); yy <= Math.floor((oy + os) / FOG_CELL); yy++) for (let xx = Math.floor(ox / FOG_CELL); xx <= Math.floor((ox + os) / FOG_CELL); xx++) if (xx < FOG_W && yy < FOG_H) this.explored[yy * FOG_W + xx] = 1;
        }
      }
      this.cam.x = p.x; this.cam.y = p.y;
      this.cam.zoom = this.cam.targetZoom = d.zoom ?? 0.8;
      this.revealAll = !!d.revealAll;
      // v1（第一步）存档迁移：新建角色
      this.hero = d.v >= 2 && d.hero ? Object.assign(C.newHero(), d.hero) : C.newHero();
      if (d.v < 2 || !d.v) { this.hero.realm = d.p?.realm ?? 1; this.hero.stage = d.p?.stage ?? 0; }
      this.hero.stats = Object.assign(C.newHero().stats, this.hero.stats ?? {});
      this.nodes.fromSave(d.nodes);
      this.destination = null; this.currentRegionId = ''; this.gathering = null;
      this.combat.reset();
      // 第三步存档迁移
      const nh = C.newHero();
      if (!Array.isArray(this.hero.arts) || !this.hero.arts.length) this.hero.arts = nh.arts;
      if (!Array.isArray(this.hero.hotbar) || this.hero.hotbar.length !== 9) this.hero.hotbar = nh.hotbar;
      this.hero.equip = this.hero.equip ?? {}; this.hero.looted = this.hero.looted ?? []; this.hero.kills = this.hero.kills ?? 0;
      // 第四步起：世界状态与 NPC
      this.ws = Object.assign(newWorldState(), d.world ?? {});
      this.npcs.fromSave(d.npcs, wk);
      this.modal = null; this.modalStack = []; this.emitModal();
      this.hearts.restore();
      this.story.resume();
      this.updateUI(true);
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  static deleteSlot(slot: number) { try { localStorage.removeItem(SLOT_KEYS[slot]); } catch { /* */ } }
  static clearAll() { try { for (const k of SLOT_KEYS) localStorage.removeItem(k); localStorage.removeItem(LEGACY_KEY); } catch { /* */ } }

  // ---------- 派生数值 ----------
  get stats() {
    const s = C.heroStats(this.hero);
    if (this.hearts) { s.atk = Math.round(s.atk * (1 + this.hearts.bonus('atk'))); s.def = Math.round(s.def * (1 + this.hearts.bonus('def'))); s.sense = Math.round(s.sense * (1 + this.hearts.bonus('sense'))); s.luck += this.hearts.bonus('luck'); }
    return s;
  }
  get sense() { return this.stats.sense; }
  /** 基础神识半径（世界像素） */
  get baseSenseRadius() {
    const s = this.sense;
    let r = s <= 0 ? 380 : 450 + 55 * Math.sqrt(s);
    if (this.hero.gongfa === 'dayan') r *= 1.35; // 大衍决：神识大增
    return r;
  }
  get senseRadius() {
    let r = this.baseSenseRadius;
    if (this.senseBurstT > 0) r *= 2;
    if (this.concealed) r *= 0.6;
    return r;
  }
  // ---------- 神识秘术 ----------
  senseBurstT = 0; senseBurstCd = 0; concealed = false; senseAlarm = 0; private scanTimer = 20;
  /** 神识外放（持续型）：Q 开 / 再按 Q 收。半径 ×2；起手耗一成法力，之后持续耗蓝（外放期间法力不回），法力将尽时自动收回 */
  senseBurst() {
    if (this.senseBurstT > 0) { this.endSenseBurst('收回外放的神识。'); return; }
    if (this.senseBurstCd > 0) { this.toast(`神识刚收回，尚需调息 ${Math.ceil(this.senseBurstCd)} 息。`, 'warn'); return; }
    if (this.hero.mp < 0.15) { this.toast('法力不足，无法外放神识。', 'warn'); return; }
    this.hero.mp -= 0.1; this.senseBurstT = 1e9; this.concealed = false; this.senseWaveT = 0;
    if (this.renderer) this.renderer.sense.burst = 1;
    this.toast(`神识如潮水般向四方铺开……（持续耗法力，约可维持 ${Math.round((this.hero.mp - 0.03) / this.senseDrain())} 息；再按 Q 收回）`); audio.sfx('whoosh');
    this.revealAround(false);
    this.updateUI();
  }
  senseWaveT = 0;
  /** 外放每秒耗法力：境界越高、外放越熟练越省 */
  senseDrain() {
    const a = this.hero.arts.find((x) => x.id === 'waifang'), lv = a ? profLevel(0, a.xp ?? 0) : 0;
    return 0.022 / (1 + Math.max(0, this.hero.realm - 1) * 0.3) * (1 - lv * 0.15);
  }
  endSenseBurst(msg: string) {
    if (this.senseBurstT <= 0) return;
    this.senseBurstT = 0; this.senseBurstCd = 3;
    this.toast(msg); this.updateUI();
  }
  /** 敛息：收敛气息与神识，半径 ×0.6，不易被他人神识察觉 */
  toggleConceal() {
    this.concealed = !this.concealed;
    if (this.concealed) this.senseBurstT = 0;
    this.toast(this.concealed ? '运转敛气诀，收敛周身气息。神识随之内收。' : '散去敛气诀，神识重新外放。');
    this.updateUI();
  }
  private updateSense(dt: number) {
    if (this.senseBurstT > 0) {
      const h = this.hero;
      h.mp = Math.max(0, h.mp - this.senseDrain() * dt);
      // 外放中每隔数息再荡出一圈神识涟漪
      this.senseWaveT += dt; if (this.senseWaveT > 4) { this.senseWaveT = 0; if (this.renderer) this.renderer.sense.burst = Math.max(this.renderer.sense.burst, 0.45); this.revealAround(false); }
      if (h.mp <= 0.03) this.endSenseBurst('法力不支，外放的神识被迫收回。');
    }
    if (this.senseBurstCd > 0) this.senseBurstCd -= dt;
    this.senseAlarm = Math.max(0, this.senseAlarm - dt * 0.5);
    // 险地：偶有更强神识扫过（敛息可避）
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = 18 + Math.random() * 20;
      const p = this.player;
      let danger = 0;
      for (const l of LOCATIONS) {
        const d = Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y);
        if (d < 4000) danger = Math.max(danger, (l.danger ?? 0) - this.hero.realm + 1);
      }
      if (danger >= 2 && Math.random() < 0.25 + danger * 0.1) {
        if (this.concealed && Math.random() < 0.8) { this.toast('一道陌生神识自远处扫过，所幸你气息内敛，未被察觉。'); }
        else { this.senseAlarm = 1; this.renderer.sense.alarm = 1; this.toast('一股远胜于你的神识扫过此地，你被盯上了！', 'warn'); audio.sfx('fail'); }
      }
    }
  }
  get canFlyNative() { return REALMS[this.hero.realm].fly; }
  /** 是否正在飞行（筑基后可随时起落，不再强制凌空） */
  get isFlying() { return this.player.flying; }
  /** 祭出的遁具 / 靴子带来的速度倍率 */
  equipSpeed(kind: 'flight' | 'boots') { const id = this.hero.equip?.[kind]; return (id && itemDef(id).art?.mapSpeed) || 1; }
  get speed() {
    const base = REALMS[this.hero.realm].speed * (1 + C.mod(this.hero, 'mapSpeed'));
    const fl = this.equipSpeed('flight');
    if (this.player.flying && !this.canFlyNative) return this.hero.equip?.flight ? Math.max(420, base * 1.8 * fl) : 420; // 体验御剑 / 炼气乘舟
    if (this.isFlying) return base * 1.8 * fl;
    return (this.player.running ? base * 1.6 : base) * this.equipSpeed('boots');
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

  // ---------- 打击感 ----------
  hitStop = 0; trauma = 0; hurtFlash = 0;
  showPerf = false;
  perf = { frames: 0, acc: 0, upd: 0, ren: 0, fps: 0, updMs: 0, renMs: 0, worst: 0, worstMs: 0 };
  /** 顿帧（秒）与震屏（0..1 创伤值，叠加） */
  juice(stop: number, shake: number) {
    if (stop > 0) this.hitStop = Math.max(this.hitStop, Math.min(0.12, stop));
    if (shake > 0) this.trauma = Math.min(1, this.trauma + shake);
  }

  /** 调试/自动化：固定帧步长（0 = 实时）与帧计数 */
  debugFixedDt = 0; frameNo = 0; debugCamDX = 0;
  /** 调试：直接给物品（走 addItem，触发获宝提示） */
  debugGive(id: string, n = 1) { C.addItem(this.hero, id, n); }
  /** 调试/自动化：在玩家周围刷怪 */
  debugSpawn(ids: string[], realm = this.hero.realm, stage = 3, dist = 320) {
    ids.forEach((id, i) => {
      const def = ENEMY_LIST.find((d) => d.id === id); if (!def) return;
      const a = i / ids.length * Math.PI * 2;
      const e = new Enemy(def, this.player.x + Math.cos(a) * dist, this.player.y + Math.sin(a) * dist * 0.6, realm, stage);
      this.combat.enemies.push(e);
    });
  }
  /** 调试：习得并施放 */
  debugCast(id: string) {
    if (!this.hero.arts.some((a) => a.id === id)) this.hero.arts.push({ id, xp: 0 });
    (this.combat as any).cds.delete(id); this.hero.mp = 1;
    this.combat.cast(id);
  }

  // ---------- 生命周期 ----------
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(this, canvas);
    try { const q = localStorage.getItem('fanren.quality'); if (q && q !== 'auto') this.renderer.setQuality(+q); } catch { /* */ }
    this.bindInput();
    this.revealAround(true);
    this.updateUI(true);
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      // 自动化截图：固定步长，逐帧可控
      const rdt = this.debugFixedDt > 0 ? this.debugFixedDt : Math.max(0, Math.min(0.1, (t - this.last) / 1000));
      this.last = t; this.frameNo++;
      // 顿帧：命中瞬间时间几近停滞
      let dt = rdt;
      if (this.hitStop > 0) { this.hitStop -= rdt; dt = rdt * 0.05; }
      this.trauma = Math.max(0, this.trauma - rdt * 1.8);
      this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 2.2);
      const u0 = performance.now();
      this.update(dt);
      const u1 = performance.now();
      this.renderer.render(dt);
      const u2 = performance.now();
      const pf = this.perf; pf.frames++; pf.acc += rdt; pf.upd += u1 - u0; pf.ren += u2 - u1; pf.worst = Math.max(pf.worst, rdt * 1000);
      if (pf.acc >= 0.5) { pf.fps = pf.frames / pf.acc; pf.updMs = pf.upd / pf.frames; pf.renMs = pf.ren / pf.frames; pf.worstMs = pf.worst; pf.frames = 0; pf.acc = 0; pf.upd = 0; pf.ren = 0; pf.worst = 0; }
      if (this.renderer.stage) this.renderer.stage.gpuTiming = this.showPerf;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
    this.renderer?.dispose();
    this.save(0);
  }

  // ---------- 主更新 ----------
  update(dt: number) {
    this.time += dt;
    this.terrain.frame++;
    if (!this.halted && !this.hero.dead) this.updateSense(dt);
    const p = this.player, st = p.st, h = this.hero;
    this.cam.zoom += (this.cam.targetZoom - this.cam.zoom) * Math.min(1, dt * 10);
    const active = !this.halted && !h.dead;
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
      if (!this.combat.canMove) { mx = 0; my = 0; }
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
        const sp = this.speed * factor * this.combat.speedMul;
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
        const ov = this.combat.actionOverride();
        if (ov) st.setAction(ov);
      }
      this.combat.update(dt);
      this.npcs.update(dt);
      this.events.update(dt);
      this.story.update(dt);
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
      const expB = this.hearts.bonus('exp'), e0 = h.exp;
      const mp0 = h.mp;
      C.passDays(h, days, p.sitting, this.placeBonus().mult, msgs);
      if (this.senseBurstT > 0) h.mp = Math.min(h.mp, mp0);   // 神识外放期间法力不回
      if (expB > 0 && h.exp > e0) h.exp += (h.exp - e0) * expB;
      const rg = this.hearts.bonus('regen'); if (rg > 0 && !this.combat.inCombat) { h.hp = Math.min(1, h.hp + rg * 0.01 * dt); h.mp = Math.min(1, h.mp + rg * 0.01 * dt); }
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
    this.cam.x += (p.x + this.debugCamDX - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (p.y - st.lift * 0.5 - this.cam.y) * Math.min(1, dt * 6);

    this.regionTimer -= dt;
    if (this.regionTimer <= 0) { this.regionTimer = 0.35; this.checkRegion(); this.exploreCheck(this.nearbyLocation()); this.townAutoZoom(); if (!this.halted) this.hintTick(); }
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
      if (this.terrain.walkFactor(p.x, p.y) <= 0) { this.toast('身下是大海，无法落脚打坐。', 'warn'); return; }
      p.flying = false; audio.sfx('land');   // 自动按下遁光，落地打坐
    }
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
    if (this.isFlying) {
      if (this.terrain.walkFactor(p.x, p.y) <= 0) { this.toast('身下是大海，需落地方可采集。', 'warn'); return; }
      p.flying = false; audio.sfx('land');   // 自动落地采集
    }
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
    this.story.onGather();
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
  useBottle(stack: C.BagItem) { const m = C.useBottle(this.hero, stack); this.flushMsgs([m]); if (m.kind === 'good') { audio.sfx('chime'); this.story.onBottle(); } this.updateUI(true); return m; }
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
      if (Math.hypot(cx - p.x, cy - p.y) < r + FOG_CELL * 0.45 || force && Math.hypot(cx - p.x, cy - p.y) < r + FOG_CELL) {
        const i = y * FOG_W + x;
        if (!this.explored[i] && !force) this.revealT.set(i, this.time);
        this.explored[i] = 1;
      }
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

  /** 战斗中倒下：损失一成修为与部分物品，在最近的城镇醒来 */
  onPlayerDown() {
    if (this.story.onDown()) return;
    const h = this.hero, p = this.player;
    const lostExp = Math.floor(C.need(h) * 0.1);
    h.exp = Math.max(0, h.exp - lostExp);
    const lost: string[] = [];
    const ls = C.bagCount(h, 'mat_lingshi');
    if (ls > 0) { const n = Math.ceil(ls * 0.1); C.removeItem(h, 'mat_lingshi', n); lost.push(`灵石 ${n}`); }
    const pool = h.bag.filter((b) => b.id !== 'mat_lingshi' && itemDef(b.id).type !== 'artifact' && itemDef(b.id).type !== 'scroll');
    for (let i = 0; i < 2 && pool.length; i++) {
      const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const n = Math.max(1, Math.floor(b.n * (0.3 + Math.random() * 0.3)));
      C.removeItem(h, b.id, n, b.age ?? 0); lost.push(`${itemDef(b.id).name} ${n}`);
    }
    // 最近的城镇
    let best: LocDef | null = null, bd = 1e12;
    for (const l of LOCATIONS) {
      if (l.type !== 'town' && l.type !== 'city') continue;
      const d = Math.hypot(l.x * WORLD_SCALE - p.x, l.y * WORLD_SCALE - p.y);
      if (d < bd && (this.terrain.isLand(p.x, p.y) || !l.island || true)) { bd = d; best = l; }
    }
    if (best) {
      const z = this.terrain.locZones[LOCATIONS.indexOf(best)];
      let tx = best.x * WORLD_SCALE, ty = best.y * WORLD_SCALE + (z ? z.ry * 0.9 : 300);
      for (let r = 0; r < 1500 && this.terrain.walkFactor(tx, ty) <= 0; r += 60) ty += 60;
      p.x = tx; p.y = ty; p.st = new CharState(tx, ty); this.cam.x = tx; this.cam.y = ty;
    }
    h.hp = 0.3; h.mp = 0.3; this.day += 3;
    p.flying = false; p.sitting = false; this.destination = null; this.gathering = null;
    this.combat.reset(); this.combat.fade = 1;
    this.toast(`你身受重创，昏死过去……三日后在${best?.name ?? '荒野'}醒来。修为损失 ${lostExp}${lost.length ? '，遗失：' + lost.join('、') : ''}。`, 'warn');
    audio.sfx('fail');
    this.updateUI(true);
  }

  /** 参悟法术卷轴 */
  learnScroll(itemId: string) {
    const d = itemDef(itemId), h = this.hero;
    const ALIAS: Record<string, string> = { leidian: 'zhangxin', lianqi: 'lianxi', dash: 'yufeng' };
    const sid = d.scroll?.skill ? (ARTS[d.scroll.skill] ? d.scroll.skill : ALIAS[d.scroll.skill]) : undefined;
    const s = sid ? ARTS[sid] : undefined;
    if (!s) { this.toast('此卷所载功法，需入宗门后方可参修（第五步开放）。', 'warn'); return false; }
    if (h.arts.some((a) => a.id === s.id)) { this.toast(`你早已习得${s.name}。`, 'warn'); return false; }
    if (h.realm < s.realm) { this.toast(`${s.name}需${REALMS[s.realm].name}期方可参悟。`, 'warn'); return false; }
    C.removeItem(h, itemId, 1);
    h.arts.push({ id: s.id, xp: 0 });
    const slot = h.hotbar.findIndex((x) => !x);
    if (slot >= 0) h.hotbar[slot] = s.id;
    this.toast(`参悟${s.name}，已然入门！${slot >= 0 ? `（已放入快捷栏 ${slot + 1}）` : '（按 K 打开法术书放入快捷栏）'}`, 'good');
    audio.sfx('chime');
    this.updateUI(true);
    return true;
  }

  /** 探索洞府遗迹：首次抵达时得宝，并惊动守护 */
  private exploreCheck(loc: LocDef | null) {
    if (!loc || loc.type !== 'secret' || !loc.minor) return;
    const h = this.hero;
    if (h.looted.includes(loc.id)) return;
    h.looted.push(loc.id);
    const dz = loc.danger ?? 1;
    const got: string[] = [];
    const ls = Math.round((20 + Math.random() * 60) * (1 + dz) * (1 + dz * 0.5));
    C.addItem(h, 'mat_lingshi', ls); got.push(`灵石 ${ls}`);
    const sc = this.combat.randomScroll(Math.min(4, Math.floor(dz / 1.2) + 1));
    if (sc) { C.addItem(h, sc, 1); got.push(itemDef(sc).name); }
    if (Math.random() < 0.35 + dz * 0.1) { const pills = ['pill_juqi', 'pill_huiqi', 'pill_liaoshang']; const pid = pills[Math.floor(Math.random() * pills.length)]; C.addItem(h, pid, 1 + Math.floor(Math.random() * 2)); got.push(itemDef(pid).name); }
    if (Math.random() < 0.12 * dz) { const arts = ['art_qingfeng', 'art_jinguangzhuan', 'art_yinhui', 'art_xuantie', 'art_wulong', 'art_tayun', 'art_guike', 'art_qingning', 'art_hongxian']; const aid = arts[Math.floor(Math.random() * Math.min(arts.length, 2 + dz * 1.5))]; C.addItem(h, aid, 1); got.push(itemDef(aid).name); }
    this.toast(`探得${loc.name}：前人遗留的禁制已残破，得 ${got.join('、')}。`, 'good');
    audio.sfx('chime');
    if (Math.random() < 0.4 + dz * 0.15) { this.combat.spawnGuards(loc); this.toast('洞中守护的妖物被惊动了！', 'warn'); }
  }

  nearbyLocation(): LocDef | null {
    const p = this.player;
    let best: LocDef | null = null, bd = 1e9;
    const zones = this.terrain.locZones;
    for (let i = 0; i < LOCATIONS.length; i++) {
      const l = LOCATIONS[i], z = zones[i];
      const dx = l.x * WORLD_SCALE - p.x, dy = l.y * WORLD_SCALE - p.y;
      if (Math.abs(dx) > 4000 || Math.abs(dy) > 4000) continue;
      const d = Math.hypot(dx, dy);
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
      sitting: p.sitting, concealed: this.concealed, age: h.age, maxLife: C.maxLife(h), expRate: C.expPerDay(h, pl.mult), place: pl.name,
      gather: gt ? { name: itemDef(gt.item).name, kind: gt.kind } : null, gatherP: this.gathering ? this.gathering.t / GATHER_TIME : -1,
      weather: WEATHER_NAME[this.weather.kind], timeName: this.timeName(), night: this.night,
      bottle: h.bottle.drops, pendingTalent: !!h.pendingTalent, dead: h.dead, rootName: C.rootDef(h).name,
      talk: this.story?.focus ? (this.story.focus.look ? `与${this.story.focus.name}交谈` : '查看') : this.npcs?.focus ? `与${this.npcs.focus.d.met ? this.npcs.focus.d.name : '此人'}交谈` : this.events?.focus ? '查看' : null,
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
    this.stand(); this.gathering = null;
    this.player.flying = !this.player.flying;
    if (!this.player.flying && this.terrain.walkFactor(this.player.x, this.player.y) <= 0) {
      this.player.flying = true;
      this.toast('身下是大海，不能在此落下。', 'warn');
      return;
    }
    const native = this.canFlyNative;
    const fid = this.hero.equip?.flight, fname = fid ? itemDef(fid).name : '';
    this.toast(this.player.flying ? (fid === 'art_fenglei' ? '风雷翅一展，雷光缭绕，化作一道雷遁。（F 落地）' : fid ? `祭出${fname}，乘风而起。（F 落地）` : native ? '祭起法器，御剑而起。（F 落地）' : '（体验模式）御剑而起，可自由飞越山海。') : '按下遁光，落地步行。');
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
      if (e.repeat && 'mfzecblpqrkthjg?'.includes(k)) return;
      if (this.modal) return;
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
      if (k === 'q') this.senseBurst();
      if (k >= '1' && k <= '9' && k.length === 1) this.combat.castSlot(+k - 1);
      if (k === 'k') this.onPanel?.('skills');
      if (k === 'r') this.toggleConceal();
      if (k === 't') this.interact();
      if (k === 'g') this.enterTown();
      if (k === 'h') this.openModal({ kind: 'hearts' });
      if (k === 'j') this.openModal({ kind: 'chronicle' });
      if (k === '?' || k === 'f1' || k === '/') { e.preventDefault(); this.openModal({ kind: 'help' }); }
      if (k === '=' || k === '+') this.zoomBy(1.2);
      if (k === '-') this.zoomBy(1 / 1.2);
      if (k === ' ') this.combat.dodge();
      if (k === 'f3') { e.preventDefault(); this.showPerf = !this.showPerf; }
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
      if (e.pointerType === 'mouse') { const w = this.screenToWorld(e.clientX, e.clientY); const m = this.input.mouse; if (Math.hypot(w.x - m.x, w.y - m.y) > 3) { m.x = w.x; m.y = w.y; m.t = this.time; m.active = true; } }
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
        // 点击敌人：锁定
        const foe = this.combat.enemies.find((q) => !q.dead && Math.hypot(q.x - w.x, q.y - 30 - w.y) < 70 && Math.hypot(q.x - this.player.x, q.y - this.player.y) < this.senseRadius);
        if (foe) { this.combat.lock = foe; this.input.mouse.t = -99; return; }
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
    const pl = () => { this.input.mouse.active = false; };
    this.canvas.addEventListener('pointerleave', pl);
    this.unbind = () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      this.canvas.removeEventListener('wheel', wheel);
      this.canvas.removeEventListener('pointerdown', pd);
      this.canvas.removeEventListener('pointermove', pm);
      this.canvas.removeEventListener('pointerup', pu);
      this.canvas.removeEventListener('pointercancel', pu);
      this.canvas.removeEventListener('pointerleave', pl);
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
