// 游戏核心：状态、循环、输入、相机；第一步大地图 + 第二步修炼与角色
import { ARTS as ARTS_ALL } from '../data/arts';
import { Terrain } from './terrain';
import { Renderer } from './render';
import { REALMS, realmName } from '../data/realms';
import { LOCATIONS, LocDef, WORLD_SCALE, WORLD_W, WORLD_H, regionAt, Region, ACTIVE_MAP, MapId, MAP_NAME, MAP_IDS, fromLegacyWorld, mapSize } from '../data/world';
import { Travel, encodeFog, decodeFog } from './travel';
import { clamp } from '../core/rng';
import { audio } from './audio';
import { CharState, HANLI_LOOK, Look } from '../gfx/character';
import { Life } from './life';
import { Weather, WEATHER_NAME, WeatherKind } from './weather';
import { NodeField, GatherNode } from './nodes';
import { itemDef } from '../data/items';
import * as C from './cultivation';
import { PursuitSys } from './pursuit';
import { Roster } from './roster';
import { WarSys } from './war';
import { Relations } from './relations';
import { OrigStory } from './origstory';
import { talentById } from '../data/skills';
import { Combat, Enemy } from './combat';
import { ENEMY_LIST } from '../data/enemies';
import { ARTS, profLevel } from '../data/arts';
import type { Hero, Msg } from './cultivation';
import { NpcWorld } from './npc';
import { Hearts } from './hearts';
import { Towns } from './town';
import { TownSpace } from './townspace';
import { Events } from './events';
import { Story } from './story';
import { SiteSys } from './sites';
import { HomeSys } from './home';
import { PetSys } from './pets';
import { Happen } from './happen';
import { LandmarkSys } from './landmarks';
import { HeartLife } from './heartsx';
import { XinMo } from './xinmo';
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
  /** 飞行中催动遁光（Shift） */
  boosting?: boolean;
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
  /** 各图的探索迷雾（当前图的在 explored 里，存档时写回） */
  fogs: Partial<Record<MapId, string>> = {};
  travel!: Travel;
  /** 换图动画（由界面设置；动画结束后调用 switchMap） */
  onTravel?: (to: MapId, via: 'portal' | 'edge') => void;
  revealAll = false;
  debugSeeAll = false;            // 调试：无视神识
  revealT = new Map<number, number>(); // 迷雾格揭开时间（用于淡出）
  destination: { x: number; y: number } | null = null;
  cam = { x: 0, y: 0, zoom: 0.8, targetZoom: 0.8 };
  input = { keys: new Set<string>(), joy: { x: 0, y: 0 }, run: false, mouse: { x: 0, y: 0, t: -99, active: false } };
  combat: Combat;
  /** 第十四步：追杀 */
  pursuit: PursuitSys;
  /** 第二十九步：人情世故 */
  rel: Relations;
  /** 第三十六步：宗门名册 */
  roster: Roster;
  /** 第三十六步：大战与传音玉符 */
  war: WarSys;
  orig: OrigStory;
  private relAcc = 0;
  /** 高空：0 地面 – 1 高空疾遁（镜头拉远、云层掠过） */
  alt = 0;
  private boostSfxT = 0;
  private roamPursuitT = 60;
  ws: WorldState = newWorldState();
  npcs!: NpcWorld;
  hearts!: Hearts;
  towns!: Towns;
  /** 第二十二步：城镇空间（建筑碰撞、门、街巷导航） */
  space = new TownSpace();
  events!: Events;
  story!: Story;
  landmarks!: LandmarkSys; sites!: SiteSys; home!: HomeSys; pets!: PetSys; happen!: Happen; heartx!: HeartLife; xinmo!: XinMo;
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
    this.pursuit = new PursuitSys(this);
    this.rel = new Relations(this);
    this.roster = new Roster(this);
    this.war = new WarSys(this);
    this.orig = new OrigStory(this);
    this.npcs = new NpcWorld(this);
    this.npcs.newWorld();
    this.hearts = new Hearts(this);
    this.towns = new Towns(this);
    this.events = new Events(this);
    this.story = new Story(this);
    this.landmarks = new LandmarkSys(this);
    this.sites = new SiteSys(this); this.home = new HomeSys(this); this.pets = new PetSys(this); this.happen = new Happen(this); this.heartx = new HeartLife(this); this.xinmo = new XinMo(this);
    this.travel = new Travel(this);
    this.hookCombat();
    const start = this.startPos();
    const st = new CharState(start.x, start.y);
    this.player = { name: '韩立', x: start.x, y: start.y, facing: 1, moving: false, flying: false, walkT: 0, running: false, sitting: false, st, look: HANLI_LOOK };
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.weather.onThunder = () => audio.sfx('thunder');
    this.updateUI();
  }

  private startPos() {
    // 开局：黄枫谷山门前（宗门地界南缘，面朝山门）；其他地图（仅调试 / 读档前的占位）取该图的大城
    const i = Math.max(0, LOCATIONS.findIndex((l) => l.id === (ACTIVE_MAP === 'tiannan' ? 'huangfeng' : ACTIVE_MAP === 'luanxing' ? 'kuixing' : 'shuozhou')));
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
    this.day = 60; this.clock = DAY_CYCLE * 0.3; this.explored.fill(0); this.fogs = {}; this.travel.pending = null; this.revealAll = false; this.destination = null; this.debugTeleport = false;
    this.cam.x = this.player.x; this.cam.y = this.player.y; this.cam.zoom = this.cam.targetZoom = 0.8;
    this.currentRegionId = ''; this.gathering = null;
    this.combat.reset(); this.pursuit?.reset();
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
    c.onKill = (e: any) => { prevKill?.(e); this.npcs.onEnemyKilled(e); this.towns.onKill(e.def.id); this.events.onKill(e); this.sites.onKill(e); this.pets.onKill(e); this.happen.onKill(e); };
    c.onYield = (e: any) => this.npcs.onYield(e);
    c.onSparEnd = (e: any, won: boolean) => { prevSpar?.(e, won); if (!this.events.onSpar(e, won) && !this.happen.onSpar(e, won)) this.npcs.onSpar(e, won); };
  }
  get halted() { return this.paused || !!this.modal; }
  openModal(m: Modal) {
    if (this.modal && (this.modal.kind === 'town' || this.modal.kind === 'hearts' || this.modal.kind === 'chronicle' || this.modal.kind === 'relations')) this.modalStack.push(this.modal);
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
    // 第十八步：机缘、洞府、会动的奇遇、灵宠——取最近的一个
    const cands: [number, () => boolean][] = [
      [dn, () => { this.npcs.interact(); return true; }],
      [de, () => this.events.interact(e)],
      [this.sites.focus && this.sites.focusD < 210 ? this.sites.focusD : 1e9, () => this.sites.interact()],
      [this.home.focus ? this.home.focusD : 1e9, () => this.home.interact()],
      [this.happen.focus ? this.happen.focusD : 1e9, () => this.happen.interact()],
      [this.happen.heraldFocus ? 150 : 1e9, () => this.happen.heraldInteract()],
      [this.pets.focus ? this.pets.focusD : 1e9, () => this.pets.interact()],
      [this.landmarks.focus ? this.landmarks.focusD + 30 : 1e9, () => this.landmarks.interact()],
      [this.space.doorFocus && !this.isFlying ? this.space.doorFocus.d + 20 : 1e9, () => this.enterDoor()],
    ];
    cands.sort((a, b) => a[0] - b[0]);
    for (const [d, f] of cands) { if (d >= 1e9) break; if (d === dn && !n) continue; if (d === de && !e) continue; if (f()) return; }
    if (this.travel.tryPortal()) return;
    const l = this.ui?.nearby;
    if (l && this.towns.canEnter(l)) { this.enterTown(); return; }
  }
  /** 第二十二步：走到铺子门口直接进店 */
  enterDoor(): boolean {
    const f = this.space.doorFocus; if (!f) return false;
    if (!this.towns.canEnter(f.loc)) return false;
    audio.sfx('open');
    this.towns.open(f.loc, f.door.fn);
    return true;
  }
  enterTown() {
    if (this.travel.tryPortal()) return;
    const l = this.nearbyLocation();
    if (!l || !this.towns.canEnter(l)) { this.toast('附近没有可以进入的城镇或宗门。', 'warn'); return; }
    if (l.type === 'sect' && this.rel.sectRep(l.id) <= -45 && this.ws.sect?.id !== l.id) { this.toast(`山门弟子横剑拦住了你：「${l.name}与你仇深似海，休想踏进山门半步！」`, 'warn'); return; }
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
      const p = this.player, tp = this.travel.pending;
      this.fogs[ACTIVE_MAP] = encodeFog(this.explored);
      const data = {
        v: 3, ws: WORLD_SCALE, time: Date.now(), map: tp?.map ?? ACTIVE_MAP, arrive: tp ? tp.via : undefined,
        p: tp ? { x: tp.x, y: tp.y, flying: false } : { x: p.x, y: p.y, flying: p.flying }, day: this.day, clock: this.clock, fogs: this.fogs, zoom: this.cam.targetZoom, revealAll: this.revealAll,
        hero: this.hero, nodes: this.nodes.toSave(), world: this.ws, npcs: this.npcs.toSave(),
        meta: { realm: realmName(this.hero.realm, this.hero.stage), year: Math.floor(this.day / 360) + 1, region: tp ? MAP_NAME[tp.map] : `${MAP_NAME[ACTIVE_MAP]}·${this.ui?.region ?? ''}`, age: Math.floor(this.hero.age) },
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
      // 第十六步：三图。旧存档（统一大地图）按位置迁到对应的新图
      const legacy = !d.map;
      let map: MapId = d.map ?? 'tiannan', px = d.p.x * wk, py = d.p.y * wk;
      if (legacy) { const r = fromLegacyWorld(px, py); map = r.map; px = r.x; py = r.y; }
      if (map !== ACTIVE_MAP) return this.switchMap(map, k);
      p.x = px; p.y = py; p.flying = !!d.p.flying; p.sitting = false; p.moving = false;
      if (d.arrive || legacy) { const q = this.findLand(p.x, p.y); p.x = q.x; p.y = q.y; p.flying = false; }
      if (!p.flying && this.terrain.walkFactor(p.x, p.y) <= 0) p.flying = true;   // 旧存档：筑基后停在海上时保持飞行
      this.travel.pending = null;
      p.st = new CharState(p.x, p.y);
      this.day = d.day ?? 60;
      this.clock = d.clock ?? DAY_CYCLE * 0.3;
      this.explored.fill(0);
      if (d.fogs) { this.fogs = { ...d.fogs }; decodeFog(d.fogs[ACTIVE_MAP], this.explored); }
      else if (d.fog) { this.fogs = this.migrateFog(d.fog, ws0); decodeFog(this.fogs[ACTIVE_MAP], this.explored); }
      this.cam.x = p.x; this.cam.y = p.y;
      this.cam.zoom = this.cam.targetZoom = d.zoom ?? 0.8;
      this.revealAll = !!d.revealAll;
      // v1（第一步）存档迁移：新建角色
      this.hero = d.v >= 2 && d.hero ? Object.assign(C.newHero(), d.hero) : C.newHero();
      if (d.v < 2 || !d.v) { this.hero.realm = d.p?.realm ?? 1; this.hero.stage = d.p?.stage ?? 0; }
      this.hero.stats = Object.assign(C.newHero().stats, this.hero.stats ?? {});
      this.nodes.fromSave(d.nodes);
      this.destination = null; this.currentRegionId = ''; this.gathering = null;
      this.combat.reset(); this.pursuit?.reset(); this.landmarks?.reset(); this.sites?.reset(); this.happen?.reset(); this.pets?.reset();
      // 第三步存档迁移
      const nh = C.newHero();
      if (!Array.isArray(this.hero.arts) || !this.hero.arts.length) this.hero.arts = nh.arts;
      if (!Array.isArray(this.hero.hotbar) || this.hero.hotbar.length !== 9) this.hero.hotbar = nh.hotbar;
      this.hero.equip = this.hero.equip ?? {}; this.hero.looted = this.hero.looted ?? []; this.hero.kills = this.hero.kills ?? 0;
      // 第四步起：世界状态与 NPC
      this.ws = Object.assign(newWorldState(), d.world ?? {});
      if (legacy) this.npcs.mergeLegacy(d.npcs); else this.npcs.fromSave(d.npcs, wk);
      this.modal = null; this.modalStack = []; this.emitModal();
      this.hearts.restore();
      this.story.resume();
      this.updateUI(true);
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  /** 存档所在地图与当前不同：记下目标图，重新载入后自动读档 */
  switchMap(map: MapId, key?: string): boolean {
    try { localStorage.setItem('fanren.map', map); sessionStorage.setItem('fanren.resume', key ?? 'fanren_save_auto'); } catch { return false; }
    if (typeof location !== 'undefined' && !(globalThis as any).__FANREN_NORELOAD) {
      // 网址里带 ?map= 时它优先于本地记录——改写网址，否则会无限重载
      if (/[?&](map|auto)=/.test(location.search)) { const u = new URL(location.href); u.searchParams.set('map', map); u.searchParams.delete('auto'); location.replace(u.toString()); }
      else location.reload();
      return true;
    }
    return false;
  }
  /** 旧版统一地图的迷雾 → 三张新图各自的迷雾 */
  private migrateFog(fog: string, ws0: number): Partial<Record<MapId, string>> {
    const ow = Math.ceil(1000 * ws0 / FOG_CELL), wk = WORLD_SCALE / ws0;
    const arr = {} as Record<MapId, { a: Uint8Array; w: number; h: number }>;
    for (const m of MAP_IDS) { const S = mapSize(m), w = Math.ceil(S.W * WORLD_SCALE / FOG_CELL), h = Math.ceil(S.H * WORLD_SCALE / FOG_CELL); arr[m] = { a: new Uint8Array(w * h), w, h }; }
    const raw = new Uint8Array(fog.length); decodeFog(fog, raw);
    for (let i = 0; i < raw.length; i++) if (raw[i]) {
      const ox = (i % ow) * FOG_CELL * wk, oy = Math.floor(i / ow) * FOG_CELL * wk, os = FOG_CELL * wk;
      const a = fromLegacyWorld(ox, oy), b = fromLegacyWorld(ox + os, oy + os);
      if (a.map !== b.map) continue;
      const T = arr[a.map];
      for (let yy = Math.floor(a.y / FOG_CELL); yy <= Math.floor(b.y / FOG_CELL); yy++) for (let xx = Math.floor(a.x / FOG_CELL); xx <= Math.floor(b.x / FOG_CELL); xx++) if (xx >= 0 && yy >= 0 && xx < T.w && yy < T.h) T.a[yy * T.w + xx] = 1;
    }
    const out: Partial<Record<MapId, string>> = {};
    for (const m of MAP_IDS) out[m] = encodeFog(arr[m].a);
    return out;
  }
  /** 就近找一处可落脚的陆地（换图落点、旧存档迁移） */
  findLand(x: number, y: number) {
    const T = this.terrain;
    for (let r = 0; r < 12000; r += 80) for (let a = 0; a < 16; a++) {
      const qx = clamp(x + Math.cos(a / 16 * Math.PI * 2) * r, 400, WORLD_W - 400), qy = clamp(y + Math.sin(a / 16 * Math.PI * 2) * r, 400, WORLD_H - 400);
      if (T.walkFactor(qx, qy) > 0 && !T.inLocZone(qx, qy, 10)) return { x: qx, y: qy };
    }
    return { x, y };
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
    if (this.landmarks) r *= this.landmarks.senseK;   // 第十九步：坠魔谷迷雾等压制神识
    return r;
  }
  // ---------- 神识秘术 ----------
  camFrameZ = 1; camLeanX = 0; camLeanY = 0;
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
        else { this.senseAlarm = 1; if (this.renderer) this.renderer.sense.alarm = 1; this.toast('一股远胜于你的神识扫过此地，你被盯上了！', 'warn'); audio.sfx('fail'); }
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
    if (this.player.flying && !this.canFlyNative) return (this.hero.equip?.flight ? Math.max(420, base * 1.8 * fl) : 420) * this.boostMul; // 体验御剑 / 炼气乘舟
    if (this.isFlying) return base * 1.8 * fl * this.boostMul;
    return (this.player.running ? base * 1.6 : base) * this.equipSpeed('boots');
  }
  /** 遁光类别：风雷翅 → 雷遁；血色披风 → 血光遁；其余 → 催动遁光 */
  get boostKind(): 'thunder' | 'blood' | 'light' {
    const q = this.hero.equip ?? {};
    // 风雷翅（飞行位）→ 雷遁；血色披风（护甲位，古宝）→ 血光遁
    return q.flight === 'art_fenglei' ? 'thunder' : q.armor === 'art_xuepifeng' || q.flight === 'art_xuepifeng' ? 'blood' : 'light';
  }
  get boostMul() { if (!this.player.boosting) return 1; const k = this.boostKind; return k === 'thunder' ? 1.8 : k === 'blood' ? 1.7 : 1.55; }
  /** 催动遁光每秒耗法力 */
  get boostDrain() { const k = this.boostKind; return (k === 'thunder' ? 0.045 : k === 'blood' ? 0.032 : 0.026) / (1 + Math.max(0, this.hero.realm - 2) * 0.2); }
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
    // 第十八步：洞府 / 小灵脉
    if (this.home?.atHome(p.x, p.y)) { const hm = this.home.placeMult(); if (hm > mult) { mult = hm; name = this.ws.home!.name; } }
    else { const v = this.sites?.veinAt(p.x, p.y); if (v) { const q = this.sites.veinQ(v); if (q > mult) { mult = q; name = '小灵脉'; } } }
    return { mult, name };
  }

  // ---------- 打击感 ----------
  hitStop = 0; trauma = 0; hurtFlash = 0;
  /** 慢镜头（真实秒）：大招结算的一瞬 */
  slowT = 0;
  slowmo(sec: number) { this.slowT = Math.max(this.slowT, Math.min(0.6, sec)); }
  /** 色差冲击（0..1，自行衰减） */
  aberrKick = 0;
  /** 大招运镜：拉远并看向某处 */
  cine = { t: 0, dur: 0, z: 1, x: 0, y: 0, k: 0 };
  cinema(x: number, y: number, zMul: number, dur: number) { this.cine = { t: 0, dur, z: zMul, x, y, k: this.cine.k }; }
  showPerf = false;
  perf = { frames: 0, acc: 0, upd: 0, ren: 0, fps: 0, updMs: 0, renMs: 0, worst: 0, worstMs: 0 };
  /** 顿帧（秒）与震屏（0..1 创伤值，叠加） */
  juice(stop: number, shake: number) {
    if (stop > 0) this.hitStop = Math.max(this.hitStop, Math.min(0.12, stop));
    if (shake > 0) this.trauma = Math.min(1, this.trauma + shake);
  }

  /** 调试/自动化：固定帧步长（0 = 实时）与帧计数 */
  debugFixedDt = 0; frameNo = 0; debugCamDX = 0;
  /** 追杀的触发：拍卖后尾随、险地游荡被盯上 */
  private pursuitTriggers(dt: number) {
    const h = this.hero, p = this.player, f = this.ws.flags;
    if (h.realm < 1 || this.pursuit.active || this.day < 63) return;
    const inZone = !!this.terrain.inLocZone(p.x, p.y, 600);
    // 拍卖会上露了富：出城后被尾随
    if (f.auctionMark !== undefined && !inZone) {
      const ago = this.day - (f.auctionMark as number);
      delete f.auctionMark;
      if (ago < 20 && !(Math.random() < 0.5 && this.rel.tail())) { this.pursuit.cd = 0; this.pursuit.schedule({ reason: '拍卖会上露了富，出城不久便被人尾随', gap: Math.random() < 0.6 ? 1 : 0, delay: 4 + Math.random() * 6 }); }
    }
    // 险地游荡：身怀重宝时偶尔被更强者盯上
    this.roamPursuitT -= dt;
    if (this.roamPursuitT <= 0) {
      this.roamPursuitT = 45 + Math.random() * 30;
      if (inZone) return;
      const d = this.combat.dangerAt(p.x, p.y).d;
      const wealth = h.bag.reduce((s, b) => s + (itemDef(b.id).type === 'artifact' ? itemDef(b.id).price : 0), 0);
      const ch = Math.min(0.12, 0.012 * d + (wealth > 20000 ? 0.03 : 0));
      if (Math.random() < ch) this.pursuit.schedule({ reason: d >= 2 ? '在险地被一道强横的神识扫中' : '身上宝光外泄，被过路修士盯上', gap: d >= 2.5 && Math.random() < 0.3 ? 1 : Math.random() < 0.7 ? 1 : 0, delay: 1 });
    }
  }
  /** 调试：立刻被追杀 */
  debugPursuit(gap = 1) { this.pursuit.cd = 0; this.pursuit.reset(); this.pursuit.cd = 0; return this.pursuit.start({ reason: '调试', gap, force: true }); }
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
  /** 调试：越过境界 / 法宝限制直接施展（自动化截图用） */
  debugExec(id: string, lv = 3) {
    const c = this.combat as any, s = ARTS_ALL[id]; if (!s) return;
    const sr = c.reachSkill(s), a = c.aim(sr.range || 400);
    this.player.st.faceToward(a.dx, a.dy, false);
    c.exec(sr, lv, a, c.pStats.atk, c.pStats.realm);
  }
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
      else if (this.slowT > 0) { this.slowT -= rdt; dt *= 0.3; }
      this.trauma = Math.max(0, this.trauma - rdt * 1.8);
      this.aberrKick = Math.max(0, this.aberrKick - rdt * 2.2);
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
    // 高空：飞行时缓缓升高，疾遁时更高——镜头随之拉远
    const altT = this.player.flying ? (this.player.boosting ? 1 : this.player.moving ? 0.5 : 0.3) : 0;
    this.alt += (altT - this.alt) * Math.min(1, dt * (altT > this.alt ? 0.7 : 1.6));
    // 战斗取景：锁定的敌人远在投放距离边缘时，镜头略微拉远并偏向对方，保证双方同在画面中
    {
      const c = this.combat, R = c.reach;
      let tg = c.lock && !c.lock.dead && Math.hypot(c.lock.x - p.x, c.lock.y - p.y) < R * 1.1 ? c.lock : null;
      if (!tg) { let bd = R; for (const e of c.enemies) { if (e.dead || !e.aggro || e.spar) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tg = e; } } }
      let fz = 1, lx = 0, ly = 0;
      if (tg && !this.halted) {
        const dx = tg.x - p.x, dy = tg.y - 40 - p.y, LEAN = 0.32;
        const W = (typeof window !== 'undefined' && window.innerWidth) || 1280, H = (typeof window !== 'undefined' && window.innerHeight) || 800;
        const zNeed = Math.min(W * 0.4 / Math.max(1, Math.abs(dx) * (1 - LEAN)), H * 0.34 / Math.max(1, Math.abs(dy) * (1 - LEAN)));
        const z0 = Math.max(0.22, this.cam.targetZoom * (1 - 0.3 * this.alt));
        fz = clamp(Math.max(0.42, zNeed) / z0, 0.5, 1);
        lx = dx * LEAN; ly = dy * LEAN;
      }
      // 大招运镜
      const cn = this.cine; cn.t += dt;
      const cOn = cn.t < cn.dur ? 1 : 0; cn.k += (cOn - cn.k) * Math.min(1, dt * (cOn ? 4 : 2));
      if (cn.k > 0.002) { fz *= 1 + (cn.z - 1) * cn.k; lx += (cn.x - p.x) * 0.5 * cn.k; ly += (cn.y - 40 - p.y) * 0.5 * cn.k; }
      const k = Math.min(1, dt * 2.2);
      this.camFrameZ += (fz - this.camFrameZ) * k; this.camLeanX += (lx - this.camLeanX) * k; this.camLeanY += (ly - this.camLeanY) * k;
    }
    const zT = Math.max(0.22, this.cam.targetZoom * (1 - 0.3 * this.alt) * this.camFrameZ);
    this.cam.zoom += (zT - this.cam.zoom) * Math.min(1, dt * (Math.abs(zT - this.cam.targetZoom) > 0.01 ? 3 : 10));
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
      const wantBoost = (k.has('shift') || this.input.run) && this.isFlying && wantMove;
      if (wantBoost && !p.boosting && h.mp > 0.06) { p.boosting = true; audio.sfx(this.boostKind === 'thunder' ? 'thunder' : 'whoosh'); }
      else if (!wantBoost || h.mp <= 0.01) { if (p.boosting && h.mp <= 0.01) this.toast('法力枯竭，遁光一黯。', 'warn'); p.boosting = false; }
      if (p.boosting) {
        h.mp = Math.max(0, h.mp - this.boostDrain * dt);
        this.boostSfxT -= dt; if (this.boostSfxT <= 0 && this.boostKind === 'thunder') { this.boostSfxT = 0.9 + Math.random() * 0.6; audio.sfx('thunder'); }
      }
      p.moving = wantMove;
      let vx = 0, vy = 0;
      if (p.moving) {
        if (len > 1) { mx /= len; my /= len; }
        if (Math.abs(mx) > 0.15) p.facing = mx > 0 ? 1 : -1;
        const factor = this.isFlying ? 1 : this.terrain.walkFactor(p.x, p.y) || 1;
        const sp = this.speed * factor * this.combat.speedMul;
        const ox = p.x, oy = p.y;
        const nx = clamp(p.x + mx * sp * dt, 200, WORLD_W - 200), ny = clamp(p.y + my * sp * dt, 200, WORLD_H - 200);
        this.travel.dir.x = mx; this.travel.dir.y = my;
        // 第二十二步：屋舍城墙挡路（已身陷其中时放行，便于走出）
        const S = this.space, free = this.isFlying || S.blocked(p.x, p.y);
        const okAt = (x: number, y: number) => this.terrain.walkFactor(x, y) > 0 && (free || !S.blocked(x, y));
        if (this.isFlying || okAt(nx, ny)) { p.x = nx; p.y = ny; }
        else if (okAt(nx, p.y)) { p.x = nx; }
        else if (okAt(p.x, ny)) { p.y = ny; }
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
      if (this.isFlying) { st.setAction('fly'); st.lift += (46 + this.alt * 34 - st.lift) * Math.min(1, dt * 4); }
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
      this.pursuit.update(dt);
      this.pursuitTriggers(dt);
      this.npcs.update(dt);
      this.rel.update(dt);
      this.roster.update(dt);
      this.war.update(dt);
      this.travel.update(dt);
      this.events.update(dt);
      this.story.update(dt);
      this.landmarks.update(dt);
      this.sites.update(dt); this.home.update(dt); this.happen.update(dt); this.pets.update(dt); this.heartx.update(dt);
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
      this.relAcc += days; if (this.relAcc >= 0.5) { this.rel.daily(this.relAcc); this.roster.daily(this.relAcc); this.war.daily(this.relAcc); this.orig.daily(this.relAcc); this.relAcc = 0; }
      const msgs: Msg[] = [];
      const hadTalent = !!h.pendingTalent;
      const expB = this.hearts.bonus('exp'), e0 = h.exp;
      const mp0 = h.mp;
      C.passDays(h, days, p.sitting, this.placeBonus().mult, msgs);
      if (this.senseBurstT > 0 || p.boosting) h.mp = Math.min(h.mp, mp0);   // 神识外放 / 催动遁光期间法力不回
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
    this.cam.x += (p.x + this.debugCamDX + this.camLeanX - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (p.y - st.lift * 0.5 + this.camLeanY - this.cam.y) * Math.min(1, dt * 6);

    this.space.update(dt, p.x, p.y);
    this.regionTimer -= dt;
    if (this.regionTimer <= 0) { this.regionTimer = 0.35; this.checkRegion(); this.exploreCheck(this.nearbyLocation()); this.townAutoZoom(); if (!this.halted) this.hintTick(); }
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.uiTimer = 0.12; this.updateUI(); }
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.save(0); }
    audio.tick(this, dt);
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
  /** 第十八步：一次性度过若干日（参悟、双修、掩埋……） */
  passDays(n: number) { const msgs: Msg[] = []; C.passDays(this.hero, n, false, 1, msgs); this.day += n; this.flushMsgs(msgs.filter((m) => m.kind)); }
  /** 第十八步：地图上的通用标记（世界坐标） */
  mapMarks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out = [...this.sites.marks(), ...this.happen.marks(), ...this.heartx.marks(), ...this.landmarks.marks(), ...this.combat.lairMarks(), ...this.war.marks()];
    const h = this.ws.home; if (h && h.map === ACTIVE_MAP) out.push({ x: h.x, y: h.y, glyph: '府', color: '#ffd890', name: h.name });
    return out;
  }

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
    let cap = days > 0 ? days : 360 * 60;
    let d = 0, gain = 0, reason = '期满出关';
    // 第三十六步：大事将起时提前出关（不至于一觉醒来错过）
    const nx = this.events.nextStart();
    let evCut = false;
    if (nx && nx.day - this.day < cap) { cap = Math.max(1, nx.day - this.day); evCut = true; }
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
    if (evCut && d >= cap && reason === '期满出关') reason = `心血来潮——${nx!.name}将起，提前出关`;
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

  breakthrough(pills: number, bonus?: number): { ok: boolean; msgs: Msg[] } {
    // 第十八步：结丹、结婴前先过心魔劫
    if (bonus === undefined && this.xinmo.needed()) {
      this.xinmo.start((b) => {
        const r = this.breakthrough(pills, b);
        const h = this.hero;
        this.openDialog({ speaker: '', title: r.ok ? `${REALMS[h.realm].name}！` : '冲关失败', mood: r.ok ? 'love' : 'danger', text: r.msgs.map((m) => m.text).join('\n\n'), options: [{ label: r.ok ? '（长啸一声）' : '（咽下一口血）', act: () => null }] });
      });
      return { ok: false, msgs: [] };
    }
    const r = C.tryBreak(this.hero, pills, bonus ?? 0);
    this.flushMsgs(r.msgs);
    audio.sfx(r.ok ? 'break' : 'fail');
    if (r.ok) this.renderer?.burst(this.player.x, this.player.y - 60, '#fff2b0', 60);
    if (r.ok) (this.combat as any).vfx.push({ kind: 'aura', x: this.player.x, y: this.player.y, r: 130, t: 0, dur: 2.4, color: '255,240,180', fx: 'breakthrough' });
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
  /** 地火：城镇法器阁 / 宗门炼器房 */
  get forgeFire() { const t = this.nearbyLocation()?.type; return t === 'city' || t === 'town' || t === 'sect' || t === 'isle'; }
  brew(r: import('../data/recipes').Recipe) {
    const res = C.brew(this.hero, r, this.forgeFire);
    if (res.days) { const msgs: Msg[] = []; C.passDays(this.hero, res.days, false, 1, msgs); this.day += res.days; this.rel.daily(Math.min(res.days, 30)); this.flushMsgs(msgs.filter((m) => m.kind)); }
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
    const lostExp = Math.floor(C.need(h) * C.INSIGHT * 0.1);
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
    this.combat.reset(); this.pursuit?.reset(); this.combat.fade = 1;
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
      talk: this.story?.focus ? (this.story.focus.look ? `与${this.story.focus.name}交谈` : '查看') : this.npcs?.focus ? `与${this.npcs.focus.d.met ? this.npcs.focus.d.name : '此人'}交谈` : this.events?.focus ? '查看' : this.space?.doorFocus && !this.isFlying && this.towns.canEnter(this.space.doorFocus.loc) ? (this.space.doorFocus.door.fn === 'teleport' ? '踏上传送阵' : this.space.doorFocus.door.fn === 'board' ? `看${this.space.doorFocus.door.name}` : `进入${this.space.doorFocus.door.name}`) : null,
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
  /** 第三十五步：禁空（追兵的禁空令）剩余秒数 */
  noFlyT = 0;
  toggleFly() {
    if (!this.player.flying && this.noFlyT > 0) { this.toast(`禁空之力未散，遁光提不起来！（${Math.ceil(this.noFlyT)} 息）`, 'warn'); return; }
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
      if (e.repeat && 'mfzecblpqrkthjgn?'.includes(k)) return;
      if (this.modal) return;
      this.input.keys.add(k);
      if (k === 'm') this.onOpenMap?.();
      if (this.paused || this.hero.dead) return;
      if (k === 'f') this.toggleFly();
      if (k === 'z') this.toggleSit();
      if (k === 'y') this.home.recall();
      if (k === 'u') this.openDialog(this.pets.menuNode());
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
      if (k === 'n') this.openModal({ kind: 'relations' });
      if (k === 'o') this.openDialog(this.war.inboxNode());
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
