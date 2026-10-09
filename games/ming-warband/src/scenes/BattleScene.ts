// 即时战斗场景：野战（大战场、布阵、阵型、地形）与攻城/守城战
import Phaser from 'phaser';
import { TROOPS, isRanged, type TroopClass } from '../data/troops';
import { ITEMS } from '../data/items';
import { COMPANIONS, FACTION } from '../data/world';
import type { Stack } from '../core/state';
import { S } from '../core/game';
import { heroMaxHp, heroArmor, horseRidingReq } from '../core/character';
import { autoResolve, type Outcome, type Casualties } from '../core/combat';
import { Ter } from '../core/terrain';
import { battleHud } from '../ui/battleHud';
import { troopSpec, companionSpec } from '../art/specs';
import { RES, FR } from '../art/figures';
import { ensureFigure, ensureBanner, ensureAtlas, currentHeroSpec, FACTION_CHAR } from '../art/phaserTex';
import { buildBattleAtlas, buildSnowAtlas, buildWallTop, buildRubble, paintBattleGround, BRES, WALL_H } from '../art/battleArt';
import { sfx, type SfxName } from '../audio/sfx';
import { music } from '../audio/music';
import type { Weather } from '../core/weather';
import { weatherFx } from '../art/weatherFx';
import { ensureLifeTextures } from './worldLife';
import { BattleField, sizeFor, FIELD_DIMS } from './battle/field';
import { SiegeCtl, type SiegeKit, type CannonAim } from './battle/siege';
import { settings } from '../core/settings';

const SWING = 0.32;
interface Prop { spr: Phaser.GameObjects.Image; x: number; y: number; w: number; h: number; tree: boolean }
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; kind: 'blood' | 'dust' | 'smoke' | 'spark' | 'clang' | 'ember' | 'debris' | 'fire' | 'rock' | 'boom'; size: number; col?: number }

export interface SideParty { pid: string; name: string; stacks: Stack[] }

export interface BattleSetup {
  ours: Stack[];
  theirs: Stack[];
  enemyName: string;
  enemyFaction: string;
  terrain: Ter;
  siege: boolean;      // 攻城战（玩家攻城，或 defend=true 时玩家守城）
  defend?: boolean;
  town?: boolean;
  kit?: SiegeKit;
  defGuns?: number;
  night: boolean;
  heroFights: boolean;
  weather?: Weather;
  snow?: number;       // 地面积雪 0..1
  season?: number;
  allies?: SideParty[];      // 与玩家并肩作战的友军
  enemyParts?: SideParty[];  // 敌方各部（若提供，则忽略 theirs）
  enemyPid?: string;
  arena?: boolean;           // 武举校场
  onEnd: (o: Outcome) => void;
}

export type Group = 'inf' | 'rng' | 'cav';
export type Order = 'hold' | 'follow' | 'charge' | 'advance';
export type Form = 'line' | 'block' | 'wedge' | 'loose';
export const FORM_NAME: Record<Form, string> = { line: '横阵', block: '方阵', wedge: '锋矢阵', loose: '疏阵' };
export const ORDER_NAME: Record<Order, string> = { hold: '坚守', follow: '跟随', charge: '冲锋', advance: '推进' };

export interface Squad {
  id: number; side: 0 | 1; ai: boolean; ally: boolean; g: Group; order: Order; form: Form;
  ax: number; ay: number; face: number; members: Unit[];
  tx?: number; ty?: number; flank?: number; phase: number; slotsT: number; prefRanged?: boolean;
}

export interface Trans { kind: 'climb' | 'stair'; t: number; dur: number; x0: number; y0: number; x1: number; y1: number; wall: boolean; ref?: unknown }

export interface Unit {
  uid: number; side: 0 | 1; troop: string | null; comp: string | null; name: string; torch?: boolean; pid: string; ally: boolean;
  x: number; y: number; vx: number; vy: number; face: number;
  hp: number; maxHp: number; atk: number; def: number; skill: number; speed: number;
  mounted: boolean; cls: TroopClass; reach: number; antiCav: boolean;
  rng: number; range: number; reload: number; ammo: number; kind: 'bow' | 'xbow' | 'gun' | null;
  cd: number; rcd: number; target: Unit | null; retarget: number;
  foot?: number;
  group: Group; dead: boolean; routed: boolean; fled: boolean; hero: boolean;
  disengage: number; r: number; onWall: boolean; swing: number; hitFlash: number;
  sq: Squad; slotX: number; slotY: number;
  task?: { kind: 'ladder' | 'ram'; ref: unknown }; trans?: Trans; rockCd?: number; postX?: number; postY?: number;
  navT?: number; navX?: number; navY?: number; hgt?: number; slopeK?: number; terrT?: number; inForm?: boolean;
  spr?: Phaser.GameObjects.Sprite | null; sheet?: string; walkT?: number; aiming?: boolean; firedT?: number; dustT?: number;
  banner?: Phaser.GameObjects.Sprite | null;
}

interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; side: 0 | 1; life: number; kind: 'bow' | 'xbow' | 'gun'; from: Unit; sx: number; sy: number; dist: number; z0: number }
interface Ent { id: string; pid: string; ally: boolean; k: number }

const GAPS = [900, 1050, 1200, 1350];

export class BattleScene extends Phaser.Scene {
  setup!: BattleSetup;
  F!: BattleField;
  siegeCtl: SiegeCtl | null = null;
  att: 0 | 1 = 0; // 攻城时的攻方
  units: Unit[] = [];
  reserves: [Ent[], Ent[]] = [[], []];
  projs: Proj[] = [];
  g!: Phaser.GameObjects.Graphics;
  gProj!: Phaser.GameObjects.Graphics;
  ground!: Phaser.GameObjects.RenderTexture;
  groundCanvas: HTMLCanvasElement | null = null;
  stamp!: Phaser.GameObjects.Graphics;
  hero: Unit | null = null;
  heroMode: 'melee' | 'ranged' = 'melee';
  squads: Squad[] = [];
  psq!: Record<Group, Squad>;
  selected: Group | 'all' = 'all';
  phase: 'deploy' | 'fight' = 'fight';
  initial: [number, number] = [0, 0];
  down: [Casualties, Casualties] = [{}, {}];
  downPid: Record<string, Casualties> = {};
  compDown: string[] = [];
  heroDown = false;
  finished = false;
  elapsed = 0;
  uidSeq = 1;
  sqSeq = 1;
  keys: any;
  floaters: Phaser.GameObjects.Text[] = [];
  reinforceT = 0;
  colors: [number, number] = [0xe0b040, 0xc0392b];
  allyColor = 0x6a9ad0;
  props: Prop[] = [];
  parts: Part[] = [];
  torches: { u: Unit | null; x: number; y: number; glow: Phaser.GameObjects.Image; big: boolean; ph: number }[] = [];
  lastCam = { x: 0, y: 0 };
  gTop!: Phaser.GameObjects.Graphics;
  gUnder!: Phaser.GameObjects.Graphics;
  gDeploy: Phaser.GameObjects.Graphics | null = null;
  stampSpr: Phaser.GameObjects.Sprite | null = null;
  lastDt = 0.016;
  bannerKeys: [string, string, string] = ['', '', ''];
  stamps = 0;
  audioT = 0;
  aiT = 0;
  onceMsgs = new Set<string>();
  grid = new Map<number, Unit[]>();
  W = 1600; H = 1000;
  baseX: [number, number] = [0, 0];
  deployZone = { x0: 0, x1: 0 };
  arenaRound = 0;

  constructor() { super('Battle'); }

  init(data: BattleSetup) {
    this.setup = data;
    this.units = []; this.projs = []; this.reserves = [[], []]; this.down = [{}, {}]; this.downPid = {}; this.compDown = [];
    this.heroDown = false; this.finished = false; this.elapsed = 0; this.hero = null; this.squads = []; this.siegeCtl = null;
    this.selected = 'all'; this.heroMode = 'melee'; this.reinforceT = 0; this.aiT = 0; this.onceMsgs = new Set();
    this.floaters = []; this.props = []; this.parts = []; this.stampSpr = null; this.stamps = 0; this.torches = []; this.gDeploy = null;
    this.att = data.defend ? 1 : 0;
  }

  get orders(): Record<Group, Order> { return { inf: this.psq.inf.order, rng: this.psq.rng.order, cav: this.psq.cav.order }; }

  create() {
    const st = this.setup;
    const ef = FACTION[st.enemyFaction];
    this.colors = [0xe0b040, st.enemyFaction === 'bandit' ? 0x3a3a3a : ef?.color ?? 0xc0392b];
    if (this.colors[1] === 0xd88a1c || this.colors[1] === 0xd8b040) this.colors[0] = 0x3a8ad8;
    // 兵力与战场大小
    const q = this.queues();
    const n0 = q[0].length + 1, n1 = q[1].length;
    const cap = Math.max(120, settings.fieldCap);
    const capO = Math.min(n0, Math.max(Math.round(cap * Math.max(0.3, Math.min(0.7, n0 / Math.max(1, n0 + n1)))), cap - n1));
    const capT = Math.min(n1, cap - capO);
    const size = st.arena ? 0 : sizeFor(capO + capT, st.siege);
    [this.W, this.H] = FIELD_DIMS[size];
    if (st.arena) { this.W = 1400; this.H = 900; }
    this.F = new BattleField(this.W, this.H, st.terrain, Math.floor(Math.random() * 100000), st.siege ? { town: !!st.town } : null);
    if (st.arena) { this.F.hills = []; this.F.groves = []; this.F.boxes = []; this.F.river = null; this.F.version++; this.F.block.fill(0); this.F.wood.fill(0); this.F.slowC.fill(100); }
    this.makeGround();
    this.stamp = this.make.graphics({}, false);
    this.gUnder = this.add.graphics().setDepth(2);
    this.g = this.add.graphics().setDepth(2.5);
    this.gProj = this.add.graphics().setDepth(14);
    this.gTop = this.add.graphics().setDepth(31);
    this.makeProps();
    if (st.night) this.add.rectangle(-200, -200, this.W + 400, this.H + 400, 0x0a1430, 0.5).setOrigin(0).setDepth(30);
    const bc0 = ensureBanner(this, this.colors[0], S.hero.name[0] ?? '义', true);
    const bc1 = ensureBanner(this, this.colors[1], FACTION_CHAR[st.enemyFaction] ?? '敌', true);
    const bc2 = ensureBanner(this, this.allyColor, '援', true);
    this.bannerKeys = [bc0.key, bc1.key, bc2.key];
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.W, this.H);
    cam.setZoom(Math.max(0.6, Math.min(1.2, this.scale.width / 1300)));

    this.deploy(q, capO, capT);
    for (const u of this.units) this.spawnSprite(u);
    if (st.siege) {
      this.siegeCtl = new SiegeCtl(this, this.att);
      this.makeWallProps();
      this.siegeCtl.setup(st.kit ?? { ladders: 3, ram: true, cannons: 0, mine: false }, st.defGuns ?? 0);
    }
    music.play(st.siege ? 'siege' : 'battle'); music.ambience('battle');
    sfx('horn', { vol: 0.7 }); sfx('drumRoll', { vol: 0.7, delay: 0.5 });
    this.audioT = 0;
    this.assignBanners();
    const wth = st.weather ?? { kind: 'clear' as const, k: 0, storm: false };
    weatherFx.set(wth); weatherFx.setAmbient(st.season ?? 0, st.night);
    music.weather(wth.kind === 'rain' ? wth.k : 0);
    if (st.night) this.makeTorches();
    this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), this.minZoom(), 2)));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Q,E,F,V,B,Z,X,C,R,ONE,TWO,THREE,FOUR,UP,DOWN,LEFT,RIGHT,SPACE,TAB,ENTER');
    this.input.keyboard!.addCapture('SPACE,TAB');
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.select('all'));
    kb.on('keydown-TWO', () => this.select('inf'));
    kb.on('keydown-THREE', () => this.select('rng'));
    kb.on('keydown-FOUR', () => this.select('cav'));
    kb.on('keydown-Z', () => this.order('charge'));
    kb.on('keydown-X', () => this.order('hold'));
    kb.on('keydown-C', () => this.order('follow'));
    kb.on('keydown-V', () => this.order('advance'));
    kb.on('keydown-F', () => this.cycleForm());
    kb.on('keydown-Q', () => this.toggleWeapon());
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-B', () => this.cycleAim());
    kb.on('keydown-SPACE', () => { if (this.phase === 'deploy') this.startFight(); });
    kb.on('keydown-ENTER', () => { if (this.phase === 'deploy') this.startFight(); });
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (battleHud.pointerOverUi) return;
      const wp = cam.getWorldPoint(p.x, p.y);
      if (p.rightButtonDown() || (this.phase === 'deploy' && p.leftButtonDown())) this.moveOrder(wp.x, wp.y);
    });
    this.events.once('shutdown', () => { this.input.keyboard?.clearCaptures(); battleHud.close(); });
    this.phase = settings.deploy && !st.arena && this.units.filter(u => u.side === 0).length > 3 ? 'deploy' : 'fight';
    battleHud.open(this);
    if (this.phase === 'deploy') {
      this.msg('布阵：1-4 选择部队，在高亮区域内点击放置，F 切换阵型。准备好后按空格开战。');
      this.gDeploy = this.add.graphics().setDepth(2.2);
    } else this.startFight(true);
    if (this.hero) cam.centerOn(this.hero.x, this.hero.y); else cam.centerOn(this.psq.inf.ax, this.psq.inf.ay);
  }

  minZoom() { return Math.max(0.28, Math.min(this.scale.width / this.W, this.scale.height / this.H) * 0.98); }

  startFight(silent = false) {
    if (this.phase === 'fight' && !silent) return;
    this.phase = 'fight';
    this.gDeploy?.destroy(); this.gDeploy = null;
    const st = this.setup;
    if (this.siegeCtl) { this.siegeCtl.started = true; this.siegeCtl.assignCrews(); }
    sfx('crowd', { vol: 0.6 }); sfx('drumRoll', { vol: 0.6, delay: 0.2 });
    this.intro();
    if (st.arena) this.msg('武举校场：击败所有对手！');
    else if (st.siege && !st.defend) this.msg(`攻城战开始！拿下${st.enemyName.replace('守军', '')}！${this.siegeCtl!.guns.some(g => g.side === 0) ? '（B 键切换火炮目标）' : ''}`);
    else if (st.defend) this.msg(`${st.enemyName}开始攻城了！死守城池！`);
    else this.msg(`与${st.enemyName}的战斗开始了！`);
    this.msg('WASD 移动，左键攻击，Q 换武器，E 爬梯/上下城；1-4 选部队，Z 冲锋 X 坚守 C 跟随 V 推进，F 换阵型，右键指定位置。');
    battleHud.refresh();
  }

  makeGround() {
    const key = 'bground';
    if (this.textures.exists(key)) this.textures.remove(key);
    const st = this.setup;
    const cv = paintBattleGround(this.F, { night: st.night, snow: st.snow ?? 0, wet: st.weather?.kind === 'rain' ? st.weather.k : 0 });
    this.groundCanvas = cv as HTMLCanvasElement;
    this.textures.addCanvas(key, cv as HTMLCanvasElement);
    this.ground = this.add.renderTexture(0, 0, this.W, this.H).setOrigin(0).setDepth(0);
    const img2 = this.make.image({ x: 0, y: 0, key, add: false }).setOrigin(0);
    this.ground.draw(img2, 0, 0);
  }

  dy(y: number) { return 10 + y / (this.H + 10); }

  addProp(frame: string, x: number, y: number, tree = false, scale = 1) {
    const snowy = (this.setup.snow ?? 0) > 0.4;
    const akey = snowy ? 'batlas_snow' : 'batlas';
    const fm = ensureAtlas(this, akey, snowy ? buildSnowAtlas : buildBattleAtlas);
    const f = fm.get(frame); if (!f) return null;
    const sc = (tree ? 1.45 + Math.random() * 0.35 : frame.startsWith('bush') ? 1.2 : 1) / BRES * scale;
    const spr = this.add.image(x, y, akey, frame).setOrigin(f.ax, f.ay).setScale(sc).setDepth(this.dy(y));
    if (tree && Math.random() < 0.5) spr.setFlipX(true);
    this.props.push({ spr, x, y, w: f.w * sc, h: f.h * sc, tree });
    return spr;
  }

  makeProps() {
    const st = this.setup, F = this.F, t = st.terrain, W = this.W, H = this.H;
    if (st.arena) { this.makeArenaProps(); return; }
    const R = Math.random;
    const sg = F.siege;
    const okAt = (x: number, y: number) => !F.blocked(x, y) && !(sg && x > sg.wallX - 60) && !F.waterAt(x, y);
    const pineP = t === Ter.Mountain || t === Ter.Plateau ? 0.85 : t === Ter.Forest ? 0.4 : 0.15;
    const tree = (x: number, y: number) => { if (R() < pineP) this.addProp(`pine${Math.floor(R() * 3)}`, x, y, true); else this.addProp(`tree${Math.floor(R() * 4)}`, x, y, true); };
    // 林地
    for (const gr of F.groves) {
      const n = Math.round(gr.r * gr.r / 1100);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * gr.r;
        const x = gr.x + Math.cos(a) * rr, y = gr.y + Math.sin(a) * rr * 0.9;
        if (okAt(x, y)) tree(x, y);
      }
    }
    const area = (W * H) / (1600 * 1000);
    const nTrees = Math.round((t === Ter.Plain ? 12 : t === Ter.Hills ? 18 : t === Ter.Mountain ? 14 : t === Ter.Forest ? 30 : t === Ter.Steppe ? 3 : t === Ter.Plateau ? 5 : 0) * area);
    for (let i = 0; i < nTrees; i++) { const x = 20 + R() * (W - 40), y = 30 + R() * (H - 40); if (okAt(x, y) && Math.abs(y - H / 2) > 120) tree(x, y); }
    // 河岸的树
    if (F.river) for (let i = 0; i < 18 * Math.sqrt(area); i++) {
      const rv = F.river, s = R() * (rv.ns ? H : W), c = F.riverPos(rv, s), off = (rv.w / 2 + 16 + R() * 30) * (R() < 0.5 ? -1 : 1);
      const x = rv.ns ? c + off : s, y = rv.ns ? s : c + off;
      if (okAt(x, y) && R() < 0.7) this.addProp(`tree${Math.floor(R() * 4)}`, x, y, true);
    }
    const nBush = Math.round((t === Ter.Desert ? 6 : t === Ter.Forest ? 30 : 18) * area);
    for (let i = 0; i < nBush; i++) { const x = R() * W, y = R() * H; if (okAt(x, y)) this.addProp(`bush${Math.floor(R() * 3)}`, x, y); }
    const nRock = Math.round((t === Ter.Mountain || t === Ter.Plateau ? 30 : t === Ter.Hills || t === Ter.Desert ? 16 : 6) * area);
    for (let i = 0; i < nRock; i++) { const x = R() * W, y = R() * H; if (okAt(x, y)) this.addProp(`rock${Math.floor(R() * 3)}`, x, y); }
    // 民居
    for (const b of F.boxes) this.addProp(`house${Math.floor(R() * 4)}`, b.x, b.y);
  }

  makeArenaProps() {
    // 校场：四周栅栏与看台旗帜
    const g = this.add.graphics().setDepth(2.1);
    g.lineStyle(3, 0x6a4a2a, 1); g.strokeRect(60, 60, this.W - 120, this.H - 120);
    g.lineStyle(1, 0x3a2412, 1); g.strokeRect(56, 56, this.W - 112, this.H - 112);
    for (let x = 60; x <= this.W - 60; x += 40) { g.fillStyle(0x5a3a1e, 1); g.fillRect(x - 2, 54, 4, 10); g.fillRect(x - 2, this.H - 64, 4, 10); }
    for (let i = 0; i < 6; i++) this.addProp('stakes', 120 + i * 190, 40);
    this.F.block.fill(0);
  }

  /** 城墙顶面（分段，可被轰塌）、敌楼、城楼 */
  makeWallProps() {
    const sg = this.F.siege!, ctl = this.siegeCtl!;
    const mk = (len: number) => { const k = 'walltop' + Math.round(len); if (!this.textures.exists(k)) this.textures.addCanvas(k, buildWallTop(Math.round(len)) as HTMLCanvasElement); return k; };
    const place = (y0: number, y1: number) => {
      if (y1 - y0 < 2) return null;
      return this.add.image(sg.wallX - 19, y0 - WALL_H, mk(y1 - y0 + WALL_H * 0)).setOrigin(0).setScale(1 / BRES).setDepth(this.dy(y0) - 0.0005);
    };
    let y = 0;
    const secs = [...sg.sections].sort((a, b) => a.y0 - b.y0);
    const gateTop = sg.gateY0 - 6, gateBot = sg.gateY1 + 6;
    const cuts: [number, number, unknown][] = [];
    for (const s of secs) { if (s.y0 > y) cuts.push([y, s.y0, null]); cuts.push([s.y0, s.y1, s]); y = s.y1; }
    if (y < this.H) cuts.push([y, this.H, null]);
    for (const [a, b, s] of cuts) {
      // 城门洞口处不画墙顶
      if (!s && a < gateBot && b > gateTop) { place(a, gateTop); place(gateBot, b); continue; }
      const img = place(a, b);
      if (img && s) ctl.secImgs.set(s as any, img);
    }
    this.addProp('gatetower', sg.wallX, sg.gateY0);
    this.addProp('gatetower', sg.wallX, sg.gateY1 + 40);
    for (const ty of sg.towers) this.addProp('gatetower', sg.wallX, ty + 16, false, 0.62);
    const R = Math.random;
    for (let i = 0; i < 6; i++) this.addProp('stakes', sg.wallX - 200 - R() * 160, sg.gateMid + (R() < 0.5 ? -1 : 1) * (90 + R() * 160));
    for (let i = 0; i < 10; i++) { const x = sg.wallX + 160 + R() * (this.W - sg.wallX - 200); const yy = R() < 0.5 ? 40 + R() * 200 : this.H - 40 - R() * 200; if (!this.F.blocked(x, yy)) this.addProp(`tree${Math.floor(R() * 4)}`, x, yy, true); }
  }

  stampRubble(wx: number, y0: number, y1: number) {
    const k = 'rubble' + Math.round(y1 - y0);
    if (!this.textures.exists(k)) this.textures.addCanvas(k, buildRubble(Math.round(y1 - y0)) as HTMLCanvasElement);
    this.add.image(wx - 30, y0 - 10, k).setOrigin(0).setScale(1 / BRES).setDepth(this.dy(y0) - 0.0004);
  }

  // ---------- 声音与特效 ----------
  /** 按与镜头的距离与左右位置播放音效 */
  snd(name: SfxName, x: number, y: number, vol = 1) {
    const v = this.cameras.main.worldView;
    const dx = x - v.centerX, dy = y - v.centerY;
    const span = Math.max(v.width, 480);
    const k = 1 - Math.hypot(dx, dy * 1.3) / (span * 1.5);
    if (k <= 0.02) return;
    sfx(name, { vol: vol * (0.12 + 0.88 * k * k), pan: dx / (span * 0.75), muffle: (1 - k) * 0.75 });
  }
  shakeAt(x: number, y: number, ms: number, k: number) {
    const v = this.cameras.main.worldView;
    if (x > v.x - 200 && x < v.right + 200 && y > v.y - 200 && y < v.bottom + 200) this.cameras.main.shake(ms, k);
  }
  msgOnce(key: string, t: string) { if (this.onceMsgs.has(key)) return; this.onceMsgs.add(key); this.msg(t); }
  debris(x: number, y: number, n: number, col: number) {
    for (let i = 0; i < n && this.parts.length < 600; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      this.parts.push({ x, y, z: 6 + Math.random() * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 40 + Math.random() * 90, life: 0, max: 1.2, kind: 'debris', size: 1.5 + Math.random() * 2.5, col });
    }
  }
  fireAt(x: number, y: number, size: number) {
    if (this.parts.length > 600) return;
    this.parts.push({ x, y, z: 2, vx: (Math.random() - 0.5) * 8, vy: 0, vz: 14 + Math.random() * 10, life: 0, max: 0.6 + Math.random() * 0.6, kind: 'fire', size: 3 * size });
    this.parts.push({ x, y, z: 8, vx: (Math.random() - 0.5) * 6, vy: 0, vz: 10, life: 0, max: 2 + Math.random(), kind: 'smoke', size: 4 * size });
  }
  explosion(x: number, y: number, size: number) {
    this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.35, kind: 'boom', size: 16 * size });
    for (let i = 0; i < 8 * size && this.parts.length < 640; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 4, z: 4, vx: Math.cos(a) * 30 * size, vy: Math.sin(a) * 14 * size, vz: 12 + Math.random() * 20, life: 0, max: 1.8 + Math.random(), kind: 'smoke', size: 6 * size });
    }
    this.debris(x, y, 6 * size, 0x6a5a40);
  }
  muzzle(x: number, y: number, a: number) {
    for (let i = 0; i < 7; i++) this.parts.push({ x: x + Math.cos(a) * i * 5, y: y + 30, z: 30, vx: Math.cos(a) * (30 + i * 12), vy: Math.sin(a) * 10, vz: 6 + Math.random() * 6, life: 0, max: 2 + Math.random(), kind: 'smoke', size: 6 + i * 2 });
    this.parts.push({ x, y: y + 30, z: 30, vx: 0, vy: 0, vz: 0, life: 0, max: 0.1, kind: 'spark', size: 12 });
  }
  crater(x: number, y: number) {
    const s = this.stamp; s.clear();
    s.fillStyle(0x3a2e1e, 0.55); s.fillEllipse(0, 0, 26, 14); s.fillStyle(0x5a4a32, 0.5); s.fillEllipse(-2, -1, 16, 8);
    try { this.ground?.draw(s, x, y); } catch { /* */ }
  }
  dropRock(from: Unit, t: Unit) {
    this.parts.push({ x: from.x - 8, y: t.y, z: WALL_H + 4, vx: (t.x - from.x + 8) * 1.4, vy: 0, vz: 0, life: 0, max: 0.55, kind: 'rock', size: 3 });
    this.time.delayedCall(450, () => { if (!t.dead) { this.hurt(t, 12 + Math.random() * 14, from); this.snd('hit', t.x, t.y, 0.8); } this.debris(t.x, t.y, 3, 0x8a8070); });
  }

  // ---------- 精灵 ----------
  liftOf(u: Unit) { return this.siegeCtl ? this.siegeCtl.liftOf(u) : 0; }
  colorOf(u: Unit) { return u.ally ? this.allyColor : this.colors[u.side]; }
  specOf(u: Unit) {
    if (u.hero) return currentHeroSpec(u.mounted, this.heroMode);
    if (u.comp) return companionSpec(u.comp, this.colors[0], u.mounted);
    return troopSpec(u.troop!, this.colorOf(u));
  }
  spawnSprite(u: Unit) {
    const info = ensureFigure(this, this.specOf(u));
    u.spr = this.add.sprite(u.x, u.y, info.key, 0).setOrigin(info.ax, info.ay).setScale(1 / RES).setDepth(this.dy(u.y));
    u.sheet = info.key; u.walkT = Math.random() * 30; u.firedT = 0; u.dustT = 0;
  }
  refreshHeroSprite() {
    const h = this.hero; if (!h || !h.spr) return;
    const info = ensureFigure(this, this.specOf(h));
    if (info.key !== h.sheet) { h.spr.setTexture(info.key, 0).setOrigin(info.ax, info.ay); h.sheet = info.key; }
  }
  assignBanners() {
    for (const sq of this.squads) {
      if (sq.g === 'rng') continue;
      const cands = sq.members.filter(u => !u.hero && !u.comp && !u.dead && !u.onWall && !u.banner);
      const n = Math.min(sq.g === 'cav' ? 1 : 3, Math.ceil(cands.length / 30));
      const key = sq.ally ? this.bannerKeys[2] : this.bannerKeys[sq.side];
      for (let i = 0; i < n; i++) {
        const u = cands[Math.floor((i + 0.5) * cands.length / n)];
        if (!u || u.banner) continue;
        u.banner = this.add.sprite(u.x, u.y, key, 0).setOrigin(2 / 22, 1).setScale(1.1 / 3);
      }
    }
    if (this.hero && this.setup.heroFights && !this.setup.arena) {
      const comp = this.units.find(u => u.side === 0 && !u.hero && u.troop && !u.ally && u.group !== 'rng' && !u.banner && !u.onWall);
      if (comp) comp.banner = this.add.sprite(comp.x, comp.y, this.bannerKeys[0], 0).setOrigin(2 / 22, 1).setScale(1.25 / 3);
    }
  }

  stampCorpse(u: Unit) {
    if (!u.spr || !this.ground) return;
    try {
      if (!this.stampSpr) this.stampSpr = this.make.sprite({ x: 0, y: 0, key: u.sheet!, frame: FR.dead, add: false });
      const s = this.stampSpr;
      s.setTexture(u.sheet!, FR.dead).setOrigin(u.spr.originX, u.spr.originY).setScale(1 / RES).setFlipX(u.spr.flipX).setAlpha(0.95);
      s.setPosition(u.x, u.y - (u.onWall ? 0 : 0));
      this.ground.draw(s);
    } catch { /* 无渲染器时忽略 */ }
  }

  blood(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 26;
      this.parts.push({ x, y, z: 10 + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 10 + Math.random() * 40, life: 0, max: 2, kind: 'blood', size: 0.8 + Math.random() * 1.1 });
    }
  }

  // ---------- 部署 ----------
  queues(): [Ent[], Ent[]] {
    const st = this.setup;
    const expand = (stacks: Stack[], pid: string, ally: boolean) => {
      const ids: Ent[] = [];
      let total = 0; for (const s of stacks) total += Math.max(0, s.n - s.w);
      let i = 0;
      for (const s of stacks) for (let k = 0; k < s.n - s.w; k++) { ids.push({ id: s.id, pid, ally, k: (i + 0.5) / Math.max(1, total) }); i++; }
      return ids;
    };
    // 各部按比例穿插上阵
    const ours = [...expand(st.ours, 'p', false), ...(st.allies ?? []).flatMap(a => expand(a.stacks, a.pid, true))].sort((a, b) => a.k - b.k);
    const theirs = (st.enemyParts?.length ? st.enemyParts.flatMap(p => expand(p.stacks, p.pid, false)) : expand(st.theirs, st.enemyPid ?? 'e', false)).sort((a, b) => a.k - b.k);
    return [ours, theirs];
  }

  makeUnit(side: 0 | 1, troop: string, pid = 'p', ally = false): Unit {
    const t = TROOPS[troop];
    const ranged = isRanged(t.cls);
    const kind = t.cls === 'arc' || t.cls === 'hca' ? 'bow' : t.cls === 'xbow' ? 'xbow' : t.cls === 'gun' ? 'gun' : null;
    const speed = t.mounted ? (t.cls === 'hca' ? 165 : 175) : t.cls === 'spear' ? 76 : t.cls === 'gun' ? 76 : 82;
    const u: Unit = {
      uid: this.uidSeq++, side, troop, comp: null, name: t.name, pid, ally, x: 0, y: 0, vx: 0, vy: 0, face: side ? Math.PI : 0,
      hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, skill: t.skill, speed, mounted: t.mounted, cls: t.cls,
      reach: t.cls === 'spear' ? 34 : t.mounted ? 28 : 24, antiCav: t.cls === 'spear',
      rng: t.rng ?? 0, range: kind === 'gun' ? 240 : kind === 'xbow' ? 260 : t.cls === 'hca' ? 230 : 275,
      reload: kind === 'gun' ? 4.5 : kind === 'xbow' ? 3 : t.cls === 'hca' ? 2.1 : 1.8, ammo: ranged ? t.ammo ?? 15 : 0, kind,
      cd: Math.random(), rcd: Math.random() * 1.5, target: null, retarget: 0,
      group: t.mounted ? 'cav' : ranged ? 'rng' : 'inf', dead: false, routed: false, fled: false, hero: false,
      disengage: 0, r: t.mounted ? 9 : 6, onWall: false, swing: 0, hitFlash: 0,
      sq: null as unknown as Squad, slotX: 0, slotY: 0,
    };
    if (this.setup.siege) u.ammo = Math.round(u.ammo * 1.6); // 攻守城时箭矢充足
    return u;
  }

  newSquad(side: 0 | 1, g: Group, ai: boolean, ally: boolean, ax: number, ay: number): Squad {
    const sq: Squad = { id: this.sqSeq++, side, ai, ally, g, order: 'hold', form: g === 'cav' ? 'wedge' : g === 'rng' ? 'line' : 'line', ax, ay, face: this.westSide(side) ? 0 : Math.PI, members: [], phase: 0, slotsT: 0 };
    const [fx, fy] = this.F.nearestFree(ax, ay); sq.ax = fx; sq.ay = fy;
    this.squads.push(sq);
    return sq;
  }
  /** 该方是否从西边出发 */
  westSide(side: 0 | 1) { return this.setup.siege ? side === this.att : side === 0; }

  deploy(q: [Ent[], Ent[]], capO: number, capT: number) {
    const st = this.setup, F = this.F, H = this.H, W = this.W;
    const field0 = q[0].slice(0, capO - 1 - S.companions.length), field1 = q[1].slice(0, capT);
    this.reserves[0] = q[0].slice(field0.length);
    this.reserves[1] = q[1].slice(capT);
    this.initial = [q[0].length + 1 + S.companions.length, q[1].length];
    const size = GAPS[Math.max(0, FIELD_DIMS.findIndex(d => d[0] === W))] ?? 1000;
    const cy = H / 2;
    const sg = F.siege;
    if (sg) {
      this.baseX[this.att] = sg.wallX - 700;
      this.baseX[1 - this.att] = sg.wallX + 160;
    } else {
      this.baseX = [W / 2 - size / 2, W / 2 + size / 2];
    }
    this.deployZone = this.westSide(0) ? { x0: 40, x1: sg ? sg.wallX - 300 : W / 2 - size * 0.2 } : { x0: sg ? sg.wallX + 30 : W / 2 + size * 0.2, x1: W - 40 };
    // 编队
    const mkSide = (side: 0 | 1, ai: boolean, ally: boolean, oy: number) => {
      const west = this.westSide(side), dir = west ? 1 : -1, bx = this.baseX[side] - (ally ? dir * 140 : 0);
      let ix = bx, iy = cy + oy;
      if (ai && !sg) {
        // 占据己方附近的高地
        const hill = F.hills.filter(h => Math.abs(h.x - bx) < W * 0.2 && h.h > 18 && Math.abs(h.y - cy) < H * 0.32).sort((a, b) => b.h - a.h)[0];
        if (hill) { ix = hill.x; iy = hill.y; }
      }
      const inf = this.newSquad(side, 'inf', ai, ally, ix, iy);
      const rng = this.newSquad(side, 'rng', ai, ally, ix + dir * 70, iy);
      const cavs = ai && !ally ? [this.newSquad(side, 'cav', ai, ally, bx - dir * 50, cy - 300 + oy), this.newSquad(side, 'cav', ai, ally, bx - dir * 50, cy + 300 + oy)] : [this.newSquad(side, 'cav', ai, ally, bx - dir * 40, cy + (ally ? -320 : 300) + oy)];
      if (cavs.length === 2) { cavs[0].flank = -1; cavs[1].flank = 1; }
      inf.form = ai && Math.random() < 0.4 ? 'block' : 'line';
      return { inf, rng, cavs };
    };
    const p = mkSide(0, false, false, 0);
    this.psq = { inf: p.inf, rng: p.rng, cav: p.cavs[0] };
    const allyS = (st.allies?.length ?? 0) ? mkSide(0, true, true, -220) : null;
    const en = mkSide(1, true, false, 0);
    const squadFor = (u: Unit) => {
      if (u.side === 0) { const s = u.ally && allyS ? allyS : p; return u.group === 'cav' ? s.cavs[u.uid % s.cavs.length] : s[u.group]; }
      return u.group === 'cav' ? en.cavs[u.uid % en.cavs.length] : en[u.group];
    };
    this.squadFor = squadFor;

    // 主角
    if (st.heroFights) {
      const h = S.hero;
      const melee = h.equip.melee ? ITEMS[h.equip.melee] : null;
      const ranged = h.equip.ranged ? ITEMS[h.equip.ranged] : null;
      let mounted = !!h.equip.horse && h.skills.riding >= horseRidingReq(h.equip.horse!);
      if (st.siege) mounted = false;
      const horse = mounted ? ITEMS[h.equip.horse!] : null;
      const maxHp = heroMaxHp(h);
      const u: Unit = {
        uid: this.uidSeq++, side: 0, troop: null, comp: null, name: h.name, pid: 'p', ally: false, x: 260, y: cy, vx: 0, vy: 0, face: 0,
        hp: Math.max(maxHp * 0.3, maxHp * h.hp), maxHp, atk: (melee?.dmg ?? 6) * (1 + h.skills.powerstrike * 0.08) * (1 + h.attrs.str * 0.012),
        def: heroArmor(h) + (horse?.horseArmor ?? 0) * 0.5, skill: 8 + h.level * 0.6 + h.attrs.agi * 0.3, speed: mounted ? 92 * (horse!.horseSpeed ?? 1.4) * (1 + h.skills.riding * 0.04) : 92 + h.attrs.agi * 2.5,
        mounted, cls: mounted ? 'cav' : 'inf', reach: melee?.reach ?? 24, antiCav: !!melee?.antiCav,
        rng: ranged ? (ranged.dmg ?? 10) * (1 + h.skills.archery * 0.07) : 0, range: ranged?.range ?? 0, reload: (ranged?.reload ?? 2) * (1 - h.skills.archery * 0.03), ammo: ranged?.ammo ?? 0, kind: ranged?.kind ?? null,
        cd: 0, rcd: 0, target: null, retarget: 0, group: 'inf', dead: false, routed: false, fled: false, hero: true,
        disengage: 0, r: mounted ? 9 : 7, onWall: false, swing: 0, hitFlash: 0, sq: this.psq.inf, slotX: 0, slotY: 0,
      };
      (u as any).meleeSpeed = melee?.speed ?? 0.8;
      if (st.night) u.range *= 0.8;
      if (st.siege) u.ammo = Math.round(u.ammo * 1.5);
      this.hero = u; this.units.push(u);
      if (h.equip.horse && !mounted && !st.siege) this.msg('你的骑术不足以驾驭这匹马，只能步战。');
    }
    if (!st.arena) for (const c of S.companions) {
      if (c.wounded > 0) continue;
      const d = COMPANIONS.find(x => x.id === c.id)!;
      const mounted = d.mounted && !st.siege;
      const g: Group = mounted ? 'cav' : d.rng ? 'rng' : 'inf';
      const u: Unit = {
        uid: this.uidSeq++, side: 0, troop: null, comp: d.id, name: d.name, pid: 'p', ally: false, x: 230, y: cy + 30, vx: 0, vy: 0, face: 0,
        hp: d.hp, maxHp: d.hp, atk: d.atk, def: d.def, skill: d.skill, speed: mounted ? 170 : 88, mounted, cls: d.rng ? (mounted ? 'hca' : 'arc') : mounted ? 'cav' : 'inf',
        reach: 28, antiCav: false, rng: d.rng ?? 0, range: d.rng ? 270 : 0, reload: 1.8, ammo: d.rng ? 40 : 0, kind: d.rng ? (d.id === 'c_tang' ? 'gun' : 'bow') : null,
        cd: 0, rcd: 0, target: null, retarget: 0, group: g, dead: false, routed: false, fled: false, hero: false,
        disengage: 0, r: mounted ? 9 : 7, onWall: false, swing: 0, hitFlash: 0, sq: this.psq[g], slotX: 0, slotY: 0,
      };
      this.units.push(u);
    }
    for (const e of field0) this.units.push(this.makeUnit(0, e.id, e.pid, e.ally));
    for (const e of field1) this.units.push(this.makeUnit(1, e.id, e.pid, false));
    for (const u of this.units) { if (u.hero) continue; if (!u.comp) u.sq = squadFor(u); u.sq.members.push(u); }
    for (const sq of this.squads) { this.faceEnemy(sq); this.computeSlots(sq); for (const u of sq.members) { u.x = u.slotX + (Math.random() - 0.5) * 3; u.y = u.slotY + (Math.random() - 0.5) * 3; } }
    if (sg) this.siegeDeploy();
    if (this.hero) {
      const inf = this.psq.inf;
      const back = this.westSide(0) ? -1 : 1;
      if (st.defend) { this.hero.x = sg!.wallX + 70; this.hero.y = sg!.gateMid + 50; }
      else { this.hero.x = inf.ax + back * 50; this.hero.y = inf.ay; }
      this.hero.face = this.westSide(0) ? 0 : Math.PI;
    }
    for (const u of this.units) { const [x, y] = F.nearestFree(u.x, u.y); if (!u.onWall) { u.x = x; u.y = y; } }
    this.sortSquads();
  }
  squadFor: (u: Unit) => Squad = () => this.psq.inf;

  /** 守军上城：弓弩铳手与部分步兵登城，其余守城门 */
  siegeDeploy() {
    const sg = this.F.siege!, def = (1 - this.att) as 0 | 1;
    const defs = this.units.filter(u => u.side === def && !u.hero);
    const laneUnits = defs.filter(u => u.group === 'rng' || (u.group === 'inf' && u.uid % 5 < 2));
    const segs: [number, number][] = [[24, sg.gateY0 - 10], [sg.gateY1 + 10, this.H - 24]];
    const total = segs.reduce((a, s) => a + s[1] - s[0], 0);
    laneUnits.forEach((u, i) => {
      let p = ((i + 0.5) / laneUnits.length) * total;
      let y = segs[0][0];
      for (const s of segs) { if (p <= s[1] - s[0]) { y = s[0] + p; break; } p -= s[1] - s[0]; }
      // 越靠近城门越密
      y = sg.gateMid + (y - sg.gateMid) * (0.55 + 0.45 * Math.abs(y - sg.gateMid) / (this.H / 2));
      if (y > sg.gateY0 - 8 && y < sg.gateY1 + 8) y = y < sg.gateMid ? sg.gateY0 - 10 - (i % 4) * 6 : sg.gateY1 + 10 + (i % 4) * 6;
      u.x = sg.wallX + (def === this.att ? -3 : 3); u.y = y; u.onWall = true; u.postY = y;
    });
    for (const u of defs) if (!u.onWall) {
      u.postX = u.x = sg.wallX + 70 + Math.random() * 120 + (u.mounted ? 140 : 0);
      u.postY = u.y = sg.gateMid + (Math.random() - 0.5) * 300;
    }
    // 守城一方玩家：默认坚守岗位
    if (this.setup.defend) for (const g of ['inf', 'rng', 'cav'] as Group[]) this.psq[g].order = 'hold';
  }

  sortSquads() { for (const sq of this.squads) sq.members.sort((a, b) => a.uid - b.uid); }

  faceEnemy(sq: Squad) {
    const e = this.centroid(this.units.filter(u => u.side !== sq.side && !u.dead));
    if (e) sq.face = Math.atan2(e.y - sq.ay, e.x - sq.ax);
    // 野战中保持大致朝东/西，避免阵型斜得太厉害
    const base = this.westSide(sq.side) ? 0 : Math.PI;
    let d = sq.face - base; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    sq.face = base + Math.max(-0.7, Math.min(0.7, d));
  }
  centroid(us: Unit[]) {
    if (!us.length) return null;
    let x = 0, y = 0; for (const u of us) { x += u.x; y += u.y; }
    return { x: x / us.length, y: y / us.length };
  }

  /** 计算阵型中每个成员的位置 */
  computeSlots(sq: Squad) {
    const ms = sq.members.filter(u => !u.dead && !u.fled && !u.routed && !u.onWall && !u.task);
    const n = ms.length; if (!n) return;
    let sp = sq.g === 'cav' ? 24 : sq.g === 'rng' ? 16 : 15;
    if (sq.form === 'loose') sp *= 2;
    const cos = Math.cos(sq.face), sin = Math.sin(sq.face);
    const put = (u: Unit, fwd: number, side: number) => { u.slotX = sq.ax + cos * fwd - sin * side; u.slotY = sq.ay + sin * fwd + cos * side; };
    if (sq.form === 'wedge') {
      let i = 0;
      for (let k = 0; i < n; k++) for (let j = 0; j <= 2 * k && i < n; j++, i++) put(ms[i], -k * sp, (j - k) * sp * 0.9);
      return;
    }
    const ranks = sq.form === 'block' ? Math.max(1, Math.round(Math.sqrt(n / 1.6))) : sq.g === 'inf' ? 3 : 2;
    const cols = Math.ceil(n / ranks);
    ms.forEach((u, i) => {
      const r = Math.floor(i / cols), c = i % cols, rowCount = Math.min(cols, n - r * cols);
      put(u, -r * sp * 1.1, (c - (rowCount - 1) / 2) * sp + (r % 2 ? sp * 0.3 : 0));
    });
  }

  // ---------- 指令 ----------
  selGroups(): Group[] { return this.selected === 'all' ? ['inf', 'rng', 'cav'] : [this.selected]; }
  select(g: Group | 'all') { this.selected = g; battleHud.refresh(); }
  order(o: Order) {
    if (this.finished) return;
    const ref = this.hero && !this.hero.dead ? this.hero : null;
    for (const g of this.selGroups()) {
      const sq = this.psq[g];
      sq.order = o;
      if (o === 'hold') {
        const us = sq.members.filter(u => !u.dead && !u.onWall);
        if (ref && !this.setup.siege) { const back = Math.cos(ref.face) < 0 ? 1 : -1; sq.ax = ref.x + (g === 'rng' ? 30 : g === 'cav' ? 60 : -30) * -back; sq.ay = ref.y + (g === 'cav' ? 120 : 0); }
        else { const c = this.centroid(us); if (c) { sq.ax = c.x; sq.ay = c.y; } }
        this.faceEnemy(sq); this.computeSlots(sq);
      }
      if (o === 'advance') { this.faceEnemy(sq); this.computeSlots(sq); }
    }
    const gname = this.selected === 'all' ? '全军' : { inf: '步兵', rng: '远程', cav: '骑兵' }[this.selected];
    this.msg(`${gname}：${{ hold: '原地坚守！', follow: '跟随我！', charge: '冲锋！', advance: '列阵推进！' }[o]}`);
    if (o === 'charge') { sfx('horn', { vol: 0.55 }); sfx('crowd', { vol: 0.7, delay: 0.25 }); }
    else if (o === 'hold') { sfx('drum', { vol: 0.6 }); sfx('drum', { vol: 0.5, delay: 0.35 }); }
    else if (o === 'advance') { for (let i = 0; i < 4; i++) sfx('drum', { vol: 0.55, delay: i * 0.45 }); }
    else { sfx('smallDrum', { vol: 0.6 }); sfx('smallDrum', { vol: 0.6, delay: 0.16 }); sfx('smallDrum', { vol: 0.6, delay: 0.32 }); }
    battleHud.refresh();
  }
  /** 右键（或布阵时左键）：令所选部队移动到该处坚守 */
  moveOrder(x: number, y: number) {
    if (this.finished) return;
    const gs = this.selGroups();
    if (this.phase === 'deploy') {
      x = Math.max(this.deployZone.x0, Math.min(this.deployZone.x1, x));
      if (this.setup.defend && this.F.siege && x < this.F.siege.wallX + 30) x = this.F.siege.wallX + 40;
    }
    const c = this.centroid(gs.map(g => this.psq[g]).map(s => ({ x: s.ax, y: s.ay }) as Unit));
    for (const g of gs) {
      const sq = this.psq[g];
      const ox = gs.length > 1 && c ? sq.ax - c.x : 0, oy = gs.length > 1 && c ? sq.ay - c.y : 0;
      const [fx, fy] = this.F.nearestFree(x + ox, y + oy);
      sq.ax = fx; sq.ay = fy; sq.order = 'hold';
      this.faceEnemy(sq); this.computeSlots(sq);
      if (this.phase === 'deploy') for (const u of sq.members) if (!u.onWall) { const [px, py] = this.F.nearestFree(u.slotX, u.slotY); u.x = px; u.y = py; }
    }
    if (this.phase === 'deploy' && this.hero && gs.includes('inf') && !this.setup.defend) { const back = this.westSide(0) ? -1 : 1; this.hero.x = this.psq.inf.ax + back * 50; this.hero.y = this.psq.inf.ay; }
    if (this.phase === 'fight') { sfx('drum', { vol: 0.5 }); this.msg(`${this.selected === 'all' ? '全军' : { inf: '步兵', rng: '远程', cav: '骑兵' }[this.selected]}：移动到指定位置坚守！`); }
    this.markT = 1.2; this.markX = x; this.markY = y;
    battleHud.refresh();
  }
  markT = 0; markX = 0; markY = 0;
  cycleForm() {
    const forms: Form[] = ['line', 'block', 'wedge', 'loose'];
    for (const g of this.selGroups()) {
      const sq = this.psq[g];
      sq.form = forms[(forms.indexOf(sq.form) + 1) % forms.length];
      this.computeSlots(sq);
      if (this.phase === 'deploy') for (const u of sq.members) if (!u.onWall) { const [px, py] = this.F.nearestFree(u.slotX, u.slotY); u.x = px; u.y = py; }
    }
    const f = this.psq[this.selGroups()[0]].form;
    this.msg(`阵型：${FORM_NAME[f]}${f === 'block' ? '（防御骑兵冲击）' : f === 'wedge' ? '（冲锋更猛）' : f === 'loose' ? '（减少箭矢伤亡）' : ''}`);
    sfx('smallDrum', { vol: 0.5 });
    battleHud.refresh();
  }
  setForm(g: Group, f: Form) { this.psq[g].form = f; this.computeSlots(this.psq[g]); if (this.phase === 'deploy') for (const u of this.psq[g].members) if (!u.onWall) { u.x = u.slotX; u.y = u.slotY; } battleHud.refresh(); }
  cycleAim() {
    const ctl = this.siegeCtl;
    if (!ctl || !ctl.guns.some(g => g.side === this.att) || this.att !== 0) return;
    const aims: CannonAim[] = ['gate', 'wall', 'troops'];
    ctl.aim = aims[(aims.indexOf(ctl.aim) + 1) % 3];
    this.msg(`火炮目标：${{ gate: '轰击城门', wall: '轰击城墙（打开缺口）', troops: '轰击城头守军' }[ctl.aim]}`);
    battleHud.refresh();
  }
  /** E：爬云梯 / 上下马道 */
  interact() {
    const h = this.hero, ctl = this.siegeCtl;
    if (!h || h.dead || !ctl || h.trans) return;
    const sg = this.F.siege!;
    if (h.onWall) {
      const st = sg.stairs.find(y => Math.abs(y - h.y) < 30);
      if (st !== undefined) { h.trans = { kind: 'stair', t: 0, dur: 1, x0: h.x, y0: h.y, x1: sg.wallX + 46, y1: st + 10, wall: false }; return; }
      this.msg('附近没有马道。'); return;
    }
    if (h.x > sg.wallX) {
      const st = sg.stairs.find(y => Math.hypot(h.x - (sg.wallX + 46), h.y - (y + 10)) < 50);
      if (st !== undefined) { h.trans = { kind: 'stair', t: 0, dur: 1, x0: h.x, y0: h.y, x1: sg.wallX + 3, y1: st, wall: true }; return; }
      this.msg('走到马道（城墙内侧的坡道）旁按 E 登城。'); return;
    }
    const L = ctl.ladders.find(l => l.state === 'up' && Math.hypot(h.x - (sg.wallX - 32), h.y - l.y) < 44);
    if (L) { h.trans = { kind: 'climb', t: 0, dur: 1.8, x0: h.x, y0: h.y, x1: sg.wallX - 3, y1: L.y, wall: true, ref: L }; return; }
    this.msg('走到已架好的云梯下按 E 攀登。');
  }
  toggleWeapon() {
    if (!this.hero || !this.hero.rng) { this.msg('你没有远程武器。'); return; }
    this.heroMode = this.heroMode === 'melee' ? 'ranged' : 'melee';
    this.refreshHeroSprite();
    battleHud.refresh();
  }
  orderOf(u: Unit): Order { return u.sq ? u.sq.order : 'charge'; }

  msg(t: string) { battleHud.message(t); }
  onBreach() {
    // 通道打开：攻方骑兵与步兵一齐冲锋
    for (const sq of this.squads) if (sq.side === this.att && sq.ai) sq.order = 'charge';
    sfx('horn', { vol: 0.6 });
  }

  // ---------- 更新 ----------
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.lastDt = dt;
    if (this.finished) { this.render(); return; }
    if (this.phase === 'deploy') {
      this.updateCamera(dt, true);
      this.render();
      this.drawDeploy();
      battleHud.tick();
      return;
    }
    this.audioT -= dt;
    if (this.audioT <= 0) { this.audioT = 0.4; this.updateAudio(); }
    this.elapsed += dt;
    this.aiT -= dt;
    if (this.aiT <= 0) { this.aiT = 0.5; this.thinkSquads(); }
    this.updateHero(dt);
    this.buildGrid();
    for (const u of this.units) if (!u.dead && !u.fled && u !== this.hero) this.updateUnit(u, dt);
    this.separate();
    this.updateProjs(dt);
    this.siegeCtl?.update(dt);
    this.updateMorale(dt);
    this.reinforce(dt);
    this.checkEnd();
    this.updateCamera(dt);
    const cam = this.cameras.main;
    weatherFx.moveCam((cam.scrollX - this.lastCam.x) * cam.zoom, (cam.scrollY - this.lastCam.y) * cam.zoom);
    this.lastCam.x = cam.scrollX; this.lastCam.y = cam.scrollY;
    this.render();
    battleHud.tick();
  }

  drawDeploy() {
    const g = this.gDeploy; if (!g) return;
    g.clear();
    const z = this.deployZone, a = 0.1 + 0.04 * Math.sin(this.time.now / 300);
    g.fillStyle(0xffe080, a); g.fillRect(z.x0, 20, z.x1 - z.x0, this.H - 40);
    g.lineStyle(2, 0xffe080, 0.5); g.strokeRect(z.x0, 20, z.x1 - z.x0, this.H - 40);
    for (const g2 of ['inf', 'rng', 'cav'] as Group[]) {
      const sq = this.psq[g2]; const sel = this.selected === 'all' || this.selected === g2;
      g.lineStyle(sel ? 2.5 : 1.2, sel ? 0xffffff : 0xffe080, sel ? 0.9 : 0.5);
      g.strokeCircle(sq.ax, sq.ay, 16);
      g.lineBetween(sq.ax, sq.ay, sq.ax + Math.cos(sq.face) * 34, sq.ay + Math.sin(sq.face) * 34);
    }
  }

  buildGrid() {
    const grid = this.grid; grid.clear();
    this.foes = [[], []];
    for (const u of this.units) if (!u.dead && !u.fled && !u.routed) this.foes[1 - u.side].push(u);
    this.passN = this.F.passages().length;
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      const k = Math.floor(u.x / 40) * 1000 + Math.floor(u.y / 40);
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u);
    }
  }
  near(x: number, y: number, r: number, fn: (u: Unit) => void) {
    const grid = this.grid;
    const x0 = Math.floor((x - r) / 40), x1 = Math.floor((x + r) / 40), y0 = Math.floor((y - r) / 40), y1 = Math.floor((y + r) / 40);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const a = grid.get(gx * 1000 + gy); if (a) for (const u of a) fn(u); }
  }
  /** 最近的敌人：近处用网格环形搜索，远处退化为对敌方列表的线性扫描 */
  nearestEnemy(u: Unit, maxR: number, filter?: (o: Unit) => boolean, score?: (o: Unit, d: number) => number): Unit | null {
    const grid = this.grid;
    const cx = Math.floor(u.x / 40), cy = Math.floor(u.y / 40);
    const maxRing = Math.min(8, Math.ceil(maxR / 40));
    let best: Unit | null = null, bd = Infinity, foundRing = -1;
    const R = Math.min(maxR, maxRing * 40);
    for (let ring = 0; ring <= maxRing; ring++) {
      if (foundRing >= 0 && ring > foundRing + 1) break;
      for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gy = cy - ring; gy <= cy + ring; gy++) {
        if (ring && gx !== cx - ring && gx !== cx + ring && gy !== cy - ring && gy !== cy + ring) continue;
        const a = grid.get(gx * 1000 + gy); if (!a) continue;
        for (const o of a) {
          if (o.side === u.side || o.dead || o.fled || o.routed) continue;
          let d = Math.hypot(o.x - u.x, o.y - u.y);
          if (d > R) continue;
          if (filter && !filter(o)) continue;
          if (score) d = score(o, d);
          if (d < bd) { bd = d; best = o; if (foundRing < 0) foundRing = ring; }
        }
      }
    }
    if (best || maxR <= R) return best;
    for (const o of this.foes[u.side]) {
      let d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > maxR || d <= R) continue;
      if (filter && !filter(o)) continue;
      if (score) d = score(o, d);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  foes: [Unit[], Unit[]] = [[], []];
  passN = 0;

  /** 电脑控制的部队：每半秒决策一次 */
  thinkSquads() {
    const st = this.setup;
    for (const sq of this.squads) {
      const alive = sq.members.filter(u => !u.dead && !u.fled && !u.routed);
      if (!alive.length) continue;
      if (sq.order === 'advance' || (sq.order === 'hold' && !sq.ai)) {
        // 推进：阵型整体向敌军移动
        if (sq.order === 'advance') {
          const e = this.centroid(this.units.filter(u => u.side !== sq.side && !u.dead && !u.routed && !u.onWall));
          if (e) {
            const d = Math.hypot(e.x - sq.ax, e.y - sq.ay);
            const nearE = alive.some(u => this.nearestEnemy(u, 90));
            if (d < 120 || nearE) { if (sq.ai) sq.order = 'charge'; }
            else { const step = Math.min(d, 26); sq.ax += (e.x - sq.ax) / d * step; sq.ay += (e.y - sq.ay) / d * step; this.faceEnemy(sq); }
          }
        }
        this.computeSlots(sq);
      }
      if (sq.order === 'follow' && this.hero && !this.hero.dead) {
        const h = this.hero, f = Math.cos(h.face) < 0 ? Math.PI : 0;
        const back = sq.g === 'rng' ? 70 : sq.g === 'cav' ? 120 : 40;
        sq.ax = h.x - Math.cos(f) * back; sq.ay = h.y + (sq.g === 'cav' ? 60 : 0); sq.face = f;
        this.computeSlots(sq);
      }
      if (!sq.ai || st.arena) continue;
      if (st.siege) { this.thinkSiegeSquad(sq, alive); continue; }
      sq.phase += 0.5;
      const enemies = this.units.filter(u => u.side !== sq.side && !u.dead && !u.routed && !u.fled);
      const ec = this.centroid(enemies); if (!ec) continue;
      const myC = this.centroid(alive)!;
      const dist = Math.hypot(ec.x - myC.x, ec.y - myC.y);
      const myPow = alive.length, eRanged = enemies.filter(u => u.rng > 0 && u.ammo > 0).length;
      const ownSide = this.units.filter(u => u.side === sq.side && !u.dead && !u.routed).length;
      const ratio = ownSide / Math.max(1, enemies.length);
      if (sq.g === 'rng') {
        const ammoLeft = alive.filter(u => u.ammo > 0).length / alive.length;
        if (ammoLeft < 0.3) sq.order = 'charge';
        else if (sq.order === 'hold' && dist > 520 && sq.phase > 6) { sq.order = 'advance'; }
        else if (sq.order === 'advance' && dist < 340) { sq.order = 'hold'; sq.ax = myC.x; sq.ay = myC.y; this.computeSlots(sq); }
      } else if (sq.g === 'inf') {
        const threat = enemies.some(u => Math.hypot(u.x - sq.ax, u.y - sq.ay) < 380);
        if (sq.order === 'hold' && (sq.phase > 14 || threat || ratio > 1.5 || eRanged > myPow * 0.5)) { sq.order = 'advance'; this.faceEnemy(sq); }
      } else {
        // 骑兵：等待时机后包抄侧翼，优先冲击远程部队
        const engaged = this.units.some(u => u.side !== sq.side && !u.dead && u.swing > 0);
        if (sq.order === 'hold' && (sq.phase > 10 || engaged || dist < 300)) {
          sq.order = 'advance'; sq.prefRanged = true;
          if (sq.flank) { sq.tx = ec.x; sq.ty = ec.y + sq.flank * this.H * 0.28; }
        }
        if (sq.order === 'advance' && sq.tx !== undefined) {
          const d = Math.hypot(sq.tx - sq.ax, sq.ty! - sq.ay);
          if (d < 80) { sq.order = 'charge'; }
          else { const step = Math.min(d, 70); sq.ax += (sq.tx - sq.ax) / d * step; sq.ay += (sq.ty! - sq.ay) / d * step; sq.face = Math.atan2(sq.ty! - sq.ay, sq.tx - sq.ax); this.computeSlots(sq); }
          if (alive.some(u => this.nearestEnemy(u, 110))) sq.order = 'charge';
        }
      }
    }
  }
  thinkSiegeSquad(sq: Squad, alive: Unit[]) {
    if (sq.side === this.att) {
      if (sq.g === 'inf') sq.order = 'charge';
      else if (sq.g === 'rng') sq.order = alive.filter(u => u.ammo > 0).length < alive.length * 0.3 ? 'charge' : 'charge';
      else sq.order = this.F.passages().length ? 'charge' : 'hold';
    } else sq.order = 'charge';
    void alive;
  }

  updateHero(dt: number) {
    const h = this.hero;
    if (!h || h.dead) return;
    h.cd -= dt; h.rcd -= dt; h.swing -= dt; h.hitFlash -= dt;
    if (h.trans) { this.siegeCtl?.stepTrans(h, dt); return; }
    const k = this.keys;
    let mx = 0, my = 0;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    const len = Math.hypot(mx, my);
    const p = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const aim = Math.atan2(wp.y + this.liftOf(h) * 0 - h.y, wp.x - h.x);
    if (h.onWall && this.siegeCtl) {
      const sp = h.speed * 0.85 * dt;
      if (my) { h.y = this.siegeCtl.laneClamp(h.y, h.y + my * sp); h.vy = my * h.speed; } else h.vy = 0;
      h.vx = 0;
    } else {
      const tk = this.F.speedAt(h.x, h.y, h.mounted);
      if (h.mounted) {
        const tvx = len ? (mx / len) * h.speed * tk : 0, tvy = len ? (my / len) * h.speed * tk : 0;
        const acc = len ? 2.2 : 1.6;
        h.vx += (tvx - h.vx) * Math.min(1, acc * dt); h.vy += (tvy - h.vy) * Math.min(1, acc * dt);
      } else { h.vx = len ? (mx / len) * h.speed * tk : 0; h.vy = len ? (my / len) * h.speed * tk : 0; }
      this.moveUnit(h, h.vx * dt, h.vy * dt);
    }
    h.face = aim;
    if (p.isDown && p.leftButtonDown() && !battleHud.pointerOverUi) {
      if (this.heroMode === 'ranged' && h.rng && h.ammo > 0) {
        if (h.rcd <= 0) {
          const spread = 0.09 - S.hero.skills.archery * 0.007 + (h.mounted ? 0.03 : 0) + Math.hypot(h.vx, h.vy) / 3000;
          this.fire(h, aim + (Math.random() - 0.5) * spread * 2, Math.hypot(wp.x - h.x, wp.y - h.y));
          h.rcd = h.reload; h.ammo--;
          h.firedT = 0.25;
          if (h.ammo === 0) { this.msg('箭矢/弹药用尽，切换为近战。'); this.heroMode = 'melee'; this.refreshHeroSprite(); battleHud.refresh(); }
        }
      } else if (h.cd <= 0) {
        h.cd = (h as any).meleeSpeed ?? 0.8; h.swing = SWING;
        sfx('swing', { vol: 0.7 });
        const speedNow = Math.hypot(h.vx, h.vy);
        let hits = 0;
        this.near(h.x, h.y, h.reach + 20, u => {
          if (hits >= 2 || u.side === 0 || u.dead || u.fled || !this.canMelee(h, u)) return;
          const d = Math.hypot(u.x - h.x, u.y - h.y);
          if (d > h.reach + u.r + 4) return;
          let da = Math.abs(Math.atan2(u.y - h.y, u.x - h.x) - aim); if (da > Math.PI) da = Math.PI * 2 - da;
          if (da > 0.9 && !h.onWall) return;
          const charge = h.mounted && speedNow > h.speed * 0.6 ? 1 + speedNow / h.speed * 0.6 : 1;
          this.damage(h, u, h.atk * charge * (h.antiCav && u.mounted ? 1.4 : 1), 0.95, true);
          hits++;
        });
      }
    }
  }

  canMelee(a: Unit, t: Unit) {
    if (a.onWall === t.onWall && !t.trans && !a.trans) return true;
    // 城头守军可以砍正爬到梯顶的敌人
    if (a.onWall && t.trans && t.trans.kind === 'climb' && t.trans.t / t.trans.dur > 0.6) return true;
    return false;
  }

  moveUnit(u: Unit, dx: number, dy: number) {
    if (u.onWall) { if (this.siegeCtl) u.y = this.siegeCtl.laneClamp(u.y, u.y + dy); return; }
    const F = this.F;
    let nx = Math.max(8, Math.min(this.W - 8, u.x + dx)), ny = Math.max(8, Math.min(this.H - 8, u.y + dy));
    if (F.blocked(nx, ny)) {
      if (!F.blocked(nx, u.y)) ny = u.y;
      else if (!F.blocked(u.x, ny)) nx = u.x;
      else if (F.blocked(u.x, u.y)) { const [fx, fy] = F.nearestFree(u.x, u.y); nx = u.x + Math.sign(fx - u.x) * Math.min(4, Math.abs(fx - u.x)); ny = u.y + Math.sign(fy - u.y) * Math.min(4, Math.abs(fy - u.y)); }
      else return;
    }
    u.x = nx; u.y = ny;
  }

  /** 绕开障碍的下一个路点 */
  waypoint(u: Unit, tx: number, ty: number): [number, number] {
    const F = this.F;
    if ((u.navT ?? 0) > this.elapsed) {
      if (u.navX === undefined) return [tx, ty];
      if (Math.hypot(u.navX - u.x, u.navY! - u.y) > 6) return [u.navX, u.navY!];
    }
    if (F.clearLine(u.x, u.y, tx, ty)) { u.navT = this.elapsed + 0.25 + Math.random() * 0.15; u.navX = undefined; return [tx, ty]; }
    const nx = F.next(u.x, u.y, tx, ty);
    u.navT = this.elapsed + 0.3 + Math.random() * 0.2;
    if (!nx) { u.navX = tx; u.navY = ty; return [tx, ty]; }
    u.navX = nx[0]; u.navY = nx[1];
    return nx;
  }

  terrainK(u: Unit) {
    // 地形与坡度对速度的影响（每 0.3 秒更新）
    if ((u.terrT ?? 0) > this.elapsed) return u.slopeK ?? 1;
    u.terrT = this.elapsed + 0.3 + Math.random() * 0.1;
    const F = this.F;
    u.hgt = u.onWall ? WALL_H + 20 : F.heightAt(u.x, u.y);
    const a = u.face, e = 14;
    const s = (F.heightAt(u.x + Math.cos(a) * e, u.y + Math.sin(a) * e) - u.hgt) / e;
    u.slopeK = F.speedAt(u.x, u.y, u.mounted) * (1 - Math.max(-0.1, Math.min(0.38, s * 5)));
    return u.slopeK;
  }

  steer(u: Unit, tx: number, ty: number, dt: number, mult = 1) {
    if (u.onWall) { this.siegeCtl?.moveLane(u, ty, dt); return; }
    [tx, ty] = this.waypoint(u, tx, ty);
    const a = Math.atan2(ty - u.y, tx - u.x);
    const sp = u.speed * mult * this.terrainK(u);
    if (u.mounted) {
      u.vx += (Math.cos(a) * sp - u.vx) * Math.min(1, 2.5 * dt);
      u.vy += (Math.sin(a) * sp - u.vy) * Math.min(1, 2.5 * dt);
    } else { u.vx = Math.cos(a) * sp; u.vy = Math.sin(a) * sp; }
    u.face = Math.atan2(u.vy, u.vx);
    this.moveUnit(u, u.vx * dt, u.vy * dt);
  }
  slow(u: Unit, k: number) { u.vx *= k; u.vy *= k; }

  findTarget(u: Unit): Unit | null {
    const ranged = u.rng > 0 && u.ammo > 0;
    const sealed = !!this.F.siege && this.passN === 0;
    const wx = this.F.siege?.wallX ?? 0;
    if (ranged) {
      const sg = this.F.siege;
      // 攻城时，墙另一侧地面上的敌人看不见：只在别无目标时才盲射
      return this.nearestEnemy(u, 3000, o => !(o.trans && o.trans.kind === 'stair'), (o, d) => d * (o.hero ? 0.9 : 1) * (sg && !u.onWall && !o.onWall && (o.x < sg.wallX) !== (u.x < sg.wallX) ? 4 : 1));
    }
    const pref = u.sq?.prefRanged;
    return this.nearestEnemy(u, 4000, o => this.canMelee(u, o) && (!sealed || u.onWall || (o.x < wx) === (u.x < wx)), (o, d) => d * (o.hero ? 0.9 : 1) * (pref && o.rng > 0 ? 0.5 : 1));
  }

  updateUnit(u: Unit, dt: number) {
    u.cd -= dt; u.rcd -= dt; u.swing -= dt; u.hitFlash -= dt;
    if (u.routed) {
      if (u.onWall && this.siegeCtl) { this.siegeCtl.fleeWall(u, dt); return; }
      if (u.trans) { this.siegeCtl?.stepTrans(u, dt); return; }
      const west = this.westSide(u.side);
      const ex = west ? -20 : this.W + 20;
      const [wx, wy] = this.waypoint(u, ex, u.y);
      const a = Math.atan2(wy - u.y, wx - u.x);
      u.face = a;
      this.moveUnit(u, Math.cos(a) * u.speed * 1.05 * dt, Math.sin(a) * u.speed * 1.05 * dt);
      if (u.x <= 12 || u.x >= this.W - 12) { u.fled = true; }
      return;
    }
    if (this.siegeCtl && this.siegeCtl.started && this.siegeCtl.brain(u, dt)) return;
    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || u.target.dead || u.target.fled || u.target.routed) {
      u.target = this.findTarget(u); u.retarget = 0.4 + Math.random() * 0.4;
    }
    const t = u.target;
    let order = this.orderOf(u);
    if (this.setup.arena) order = 'charge';
    const ranged = u.rng > 0 && u.ammo > 0;
    if (!t) {
      if (order === 'charge' || !u.sq) { u.vx *= 0.8; u.vy *= 0.8; return; }
      if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 8) this.steer(u, u.slotX, u.slotY, dt, 0.8); else { u.vx = u.vy = 0; u.face = u.sq.face; }
      return;
    }
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    if (u.onWall) u.hgt = WALL_H + 20;

    // 远程射击
    u.aiming = false;
    if (ranged) {
      const hb = Math.max(-0.1, Math.min(0.3, ((u.hgt ?? 0) - (t.hgt ?? 0)) / 80));
      const range = u.range * (1 + hb) * (u.onWall ? 1.15 : 1);
      if (d < range && d > (u.onWall ? 12 : 40)) {
        u.aiming = u.cls !== 'hca' || Math.hypot(u.vx, u.vy) < 30;
        if (u.rcd <= 0) {
          const lead = d / (u.kind === 'gun' ? 900 : 520);
          const ax = t.x + t.vx * lead, ay = t.y + t.vy * lead;
          const spread = Math.max(0.025, 0.13 - u.skill * 0.008) + (this.setup.night ? 0.04 : 0);
          this.fire(u, Math.atan2(ay - u.y, ax - u.x) + (Math.random() - 0.5) * spread * 2, d);
          u.rcd = u.reload * (0.85 + Math.random() * 0.3); u.ammo--; u.firedT = 0.25;
        }
        u.face = Math.atan2(t.y - u.y, t.x - u.x);
        if (u.cls === 'hca' && d < 150) {
          const a = Math.atan2(u.y - t.y, u.x - t.x) + 0.6;
          this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, dt);
        } else if (u.cls === 'hca' && order === 'charge') {
          this.steer(u, t.x, t.y, dt, 0.5);
          if (d < 200) { u.vx *= 0.3; u.vy *= 0.3; }
        } else { u.vx *= 0.8; u.vy *= 0.8; }
        return;
      }
      if (u.onWall) return;
      if ((order === 'charge' || order === 'follow' && d > range * 1.6) && !this.canMelee(u, t)) {
        // 目标在城头等够不着的地方：逼近到射程内
        this.steer(u, t.x, t.y, dt, 0.9);
        return;
      }
      if (order !== 'charge' && order !== 'follow') {
        if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 10) this.steer(u, u.slotX, u.slotY, dt, 0.8); else { u.vx = u.vy = 0; u.face = Math.atan2(t.y - u.y, t.x - u.x); }
        return;
      }
    }

    // 近战
    if (!this.canMelee(u, t)) { u.vx *= 0.7; u.vy *= 0.7; return; }
    const reach = u.reach + t.r;
    if (d < reach + 2 && u.disengage <= 0) {
      u.face = Math.atan2(t.y - u.y, t.x - u.x);
      this.meleeHit(u, t);
      if (!u.mounted) { u.vx *= 0.5; u.vy *= 0.5; return; }
    }
    if (u.disengage > 0) {
      u.disengage -= dt;
      const a = Math.atan2(u.vy, u.vx) || u.face;
      this.steer(u, u.x + Math.cos(a) * 120, u.y + Math.sin(a) * 120, dt);
      return;
    }
    if (order === 'charge' || ranged) {
      this.steer(u, t.x, t.y, dt);
    } else if (order === 'follow' && this.hero && !this.hero.dead) {
      if (d < 70) this.steer(u, t.x, t.y, dt);
      else if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 14) this.steer(u, u.slotX, u.slotY, dt); else { u.vx *= 0.7; u.vy *= 0.7; }
    } else {
      // 坚守/推进：敌人靠近时迎战，否则回到阵位
      const engage = order === 'advance' ? 110 : u.sq.form === 'block' ? 55 : 75;
      const sd = Math.hypot(u.slotX - u.x, u.slotY - u.y);
      if (d < engage && sd < 140) this.steer(u, t.x, t.y, dt);
      else if (sd > 6) this.steer(u, u.slotX, u.slotY, dt, order === 'advance' ? 0.6 : 0.8);
      else { u.vx = u.vy = 0; u.face = Math.atan2(t.y - u.y, t.x - u.x); }
    }
    u.inForm = (order === 'hold' || order === 'advance') && Math.hypot(u.slotX - u.x, u.slotY - u.y) < 16;
  }

  meleeHit(u: Unit, t: Unit) {
    if (u.cd > 0) return;
    const speedNow = Math.hypot(u.vx, u.vy);
    let dmg = u.atk;
    if (u.mounted && speedNow > u.speed * 0.55) dmg *= u.sq?.form === 'wedge' ? 1.95 : 1.7;
    if (u.antiCav && t.mounted) dmg *= 1.5;
    if (u.mounted && t.antiCav) { u.hp -= 2; }
    if (u.sq?.form === 'wedge' && !u.mounted) dmg *= 1.08;
    dmg *= 1 + Math.max(-0.15, Math.min(0.2, ((u.hgt ?? 0) - (t.hgt ?? 0)) / 60));
    this.damage(u, t, dmg, 0.55 + (u.skill - t.skill) * 0.025);
    u.cd = (u.mounted ? 1.1 : 1.15) + Math.random() * 0.35;
    u.swing = SWING;
    if (u.mounted && u.cls === 'cav' && !u.onWall) u.disengage = 1.2 + Math.random() * 0.6;
  }

  separate() {
    for (const u of this.units) {
      if (u.dead || u.fled || u.trans) continue;
      this.near(u.x, u.y, 20, o => {
        if (o === u || o.dead || o.onWall !== u.onWall || o.trans) return;
        const dx = u.x - o.x, dy = u.y - o.y;
        const md = u.onWall ? 7 : u.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (md - d) * (u.hero ? 0.25 : 0.5) * (o.mounted && !u.mounted ? 1.4 : 1);
          this.moveUnit(u, u.onWall ? 0 : (dx / d) * push, (dy / d) * push);
        }
      });
    }
  }

  fire(u: Unit, a: number, dist = 200) {
    const sp = u.kind === 'gun' ? 900 : u.kind === 'xbow' ? 620 : 520;
    const z0 = 14 + (u.mounted ? 10 : 0) + this.liftOf(u);
    this.snd(u.kind === 'gun' ? 'gun' : u.kind === 'xbow' ? 'xbow' : 'bow', u.x, u.y, u.hero ? 1.2 : u.kind === 'gun' ? 0.8 : 0.6);
    this.projs.push({ x: u.x + Math.cos(a) * 10, y: u.y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: u.rng, side: u.side, life: (u.range * 1.4) / sp, kind: u.kind ?? 'bow', from: u, sx: u.x, sy: u.y, dist: Math.max(40, Math.min(dist, u.range * 1.2)), z0 });
    if (u.kind === 'gun') {
      const mx = u.x + Math.cos(a) * 16, my = u.y + Math.sin(a) * 16;
      for (let i = 0; i < 4; i++) this.parts.push({ x: mx + Math.cos(a) * i * 4, y: my + Math.sin(a) * i * 4, z: z0, vx: Math.cos(a) * (20 + i * 10) + (Math.random() - 0.5) * 10, vy: Math.sin(a) * (20 + i * 10), vz: 6 + Math.random() * 6, life: 0, max: 1.6 + Math.random() * 0.8, kind: 'smoke', size: 4 + i * 1.5 });
      this.parts.push({ x: mx, y: my, z: z0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.08, kind: 'spark', size: 7 });
    }
  }

  updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      const steps = p.kind === 'gun' ? 3 : 2;
      let hit = false;
      const sgW = this.F.siege;
      for (let s = 0; s < steps && !hit; s++) {
        const px0 = p.x;
        p.x += (p.vx * dt) / steps; p.y += (p.vy * dt) / steps;
        // 铳弹打在城墙上（除非穿过城门/缺口）
        if (sgW && p.kind === 'gun' && !p.from.onWall && (px0 < sgW.wallX) !== (p.x < sgW.wallX) && !this.F.passages().some(q => Math.abs(q.y - p.y) < 34)) {
          this.sparks(sgW.wallX, p.y - 20, 2); p.life = 0; hit = true; break;
        }
        // 箭矢只在落点附近命中（抛射），铳弹沿途命中
        const trav = Math.hypot(p.x - p.sx, p.y - p.sy);
        if (p.kind === 'bow' && trav < p.dist * 0.7) continue;
        this.near(p.x, p.y, 12, u => {
          if (hit || u.side === p.side || u.dead || u.fled) return;
          if (Math.hypot(u.x - p.x, u.y - p.y) < u.r + 2) {
            hit = true;
            if (sgW && !u.onWall && !p.from.onWall && (p.sx < sgW.wallX) !== (u.x < sgW.wallX) && Math.random() < 0.75) return; // 隔墙盲射
            if (u.onWall && !p.from.onWall && Math.random() < (p.kind === 'gun' ? 0.45 : 0.5)) return; // 垛口掩护
            if (this.F.inWood(u.x, u.y) && Math.random() < 0.3) return;   // 树木遮挡
            if (u.sq?.form === 'loose' && u.inForm && Math.random() < 0.3) return;
            const ap = p.kind === 'gun' ? 0.2 : p.kind === 'xbow' ? 0.35 : 0.5;
            this.damage(p.from, u, p.dmg * (0.85 + Math.random() * 0.3), 1, false, ap, p.kind === 'gun' ? 'bullet' : 'arrow');
          }
        });
      }
      p.life -= dt;
      if (!hit && p.kind !== 'gun' && Math.hypot(p.x - p.sx, p.y - p.sy) > p.dist * 1.08) {
        if (this.stamps < 3000 && !this.F.waterAt(p.x, p.y)) {
          const a = Math.atan2(p.vy, p.vx); const s = this.stamp; s.clear();
          s.lineStyle(1, 0x3a2414, 0.9); s.lineBetween(0, 0, -Math.cos(a) * 6, -Math.sin(a) * 6 - 3);
          s.fillStyle(0xe8e0d0, 0.9); s.fillRect(-Math.cos(a) * 6 - 1, -Math.sin(a) * 6 - 4, 2, 1.5);
          try { this.ground?.draw(s, p.x, p.y); } catch { /* */ } this.stamps++;
        }
        if (Math.random() < 0.3) this.snd('arrowGround', p.x, p.y, 0.5);
        this.projs.splice(i, 1); continue;
      }
      if (hit || p.life <= 0 || p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) this.projs.splice(i, 1);
    }
  }

  damage(a: Unit, t: Unit, raw: number, hitChance: number, heroAttack = false, armorFactor = 0.45, src: 'melee' | 'arrow' | 'bullet' = 'melee') {
    const loud = a.hero || t.hero ? 1.4 : 0.75;
    if (src === 'melee' && t.inForm && t.sq?.form === 'block') { if (a.mounted) raw *= 0.72; hitChance -= 0.06; }
    if (t.foot && t.foot > this.elapsed) hitChance -= 0.25;
    if (Math.random() > Math.max(0.15, Math.min(0.95, hitChance))) {
      if (src === 'melee') { this.snd(t.def > 10 && Math.random() < 0.6 ? 'clash' : 'block', t.x, t.y, loud * 0.8); this.sparks((a.x + t.x) / 2, (a.y + t.y) / 2 - 14 - this.liftOf(t), 4); }
      else if (src === 'arrow') this.snd('block', t.x, t.y, 0.4);
      return;
    }
    if (src === 'melee' && t.def >= 14) this.sparks(t.x, t.y - 14 - this.liftOf(t), 3);
    if (src === 'melee') this.snd(t.def >= 14 ? (Math.random() < 0.5 ? 'clash' : 'armor') : (Math.random() < 0.3 ? 'clash' : 'hit'), t.x, t.y, loud);
    else if (src === 'arrow') this.snd(t.def >= 14 ? 'armor' : 'arrowHit', t.x, t.y, loud * 0.8);
    else this.snd('hit', t.x, t.y, loud);
    const dmg = Math.max(2, raw * (0.8 + Math.random() * 0.4) - t.def * armorFactor);
    t.hp -= dmg; t.hitFlash = 0.12;
    this.blood(t.x, t.y - this.liftOf(t), dmg > 15 ? 4 : 2);
    if (t.hero) this.cameras.main.shake(90, 0.003);
    if (t.mounted && !t.hero) { t.vx *= 0.6; t.vy *= 0.6; }
    if (heroAttack || a.hero) this.floater(t.x, t.y - 12 - this.liftOf(t), String(Math.round(dmg)), '#ffe9a0');
    if (t.hero) this.floater(t.x, t.y - 14 - this.liftOf(t), `-${Math.round(dmg)}`, '#ff6050');
    if (t.hp <= 0) this.kill(t, a);
  }
  /** 直接伤害（礌石、金汁、炮弹、坠落） */
  hurt(t: Unit, dmg: number, by: Unit | null) {
    if (t.dead || t.fled) return;
    const d = Math.max(3, dmg - t.def * 0.25);
    t.hp -= d; t.hitFlash = 0.15;
    this.blood(t.x, t.y - this.liftOf(t), 3);
    if (t.hero) { this.cameras.main.shake(120, 0.004); this.floater(t.x, t.y - 14, `-${Math.round(d)}`, '#ff6050'); }
    if (t.hp <= 0) this.kill(t, by);
  }

  floater(x: number, y: number, txt: string, color: string) {
    if (this.floaters.length > 30) return;
    const tx = this.add.text(x, y, txt, { fontFamily: 'sans-serif', fontSize: '13px', color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
    this.floaters.push(tx);
    this.tweens.add({ targets: tx, y: y - 26, alpha: 0, duration: 800, onComplete: () => { tx.destroy(); this.floaters.splice(this.floaters.indexOf(tx), 1); } });
  }

  kill(u: Unit, by: Unit | null) {
    u.dead = true; u.hp = 0;
    if (Math.random() < 0.5 || u.hero || u.comp) this.snd('death', u.x, u.y, u.hero || u.comp ? 1.3 : 0.8);
    this.snd('fall', u.x, u.y, 0.6);
    if (u.mounted && Math.random() < 0.35) this.snd('neigh', u.x, u.y, 0.6);
    const sd = this.down[u.side];
    if (u.troop) { sd[u.troop] = (sd[u.troop] || 0) + 1; const pd = this.downPid[u.pid] ||= {}; pd[u.troop] = (pd[u.troop] || 0) + 1; }
    if (u.comp) { this.compDown.push(u.comp); this.msg(`${u.name}负伤倒地！`); }
    if (u.hero) { this.heroDown = true; this.msg('你被击倒了！部下们继续作战……'); battleHud.refresh(); }
    if (by?.hero && u.troop) this.msg(`你击倒了${u.name}。`);
    if (u.task) u.task = undefined;
    // 城头阵亡者坠落到墙根
    const lift = this.liftOf(u);
    if (u.onWall || u.trans) { const sg = this.F.siege!; u.x = sg.wallX + (u.side === this.att ? -30 : 26) + (Math.random() - 0.5) * 10; u.onWall = false; u.trans = undefined; }
    const s = this.stamp;
    s.clear();
    s.fillStyle(0x5a1208, 0.55); s.fillEllipse(0, 0, u.mounted ? 20 : 13, u.mounted ? 9 : 6);
    s.fillStyle(0x7a1a0e, 0.4); s.fillEllipse(-4, 2, 7, 3.5);
    if (!this.F.waterAt(u.x, u.y)) { try { this.ground?.draw(s, u.x - 6, u.y); } catch { /* */ } this.stampCorpse(u); }
    void lift;
    u.spr?.destroy(); u.spr = null;
    if (u.banner) { u.banner.destroy(); u.banner = null; }
    if (u.mounted && !u.hero) this.parts.push({ x: u.x, y: u.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.6, kind: 'dust', size: 8 });
  }

  sideMorale(side: 0 | 1) {
    const init = this.initial[side];
    let lost = 0; for (const k in this.down[side]) lost += this.down[side][k];
    if (side === 0) lost += this.compDown.length + (this.heroDown ? 3 : 0);
    let m = 100 - (lost / Math.max(1, init)) * 140;
    if (side === 0) m += (S.morale - 50) * 0.4 + S.hero.skills.leadership * 3;
    if (side === 1 && this.setup.enemyFaction === 'bandit') m -= 10;
    if (this.setup.siege && side !== this.att) m += 25; // 守城者背水一战
    if (this.setup.arena) m = 100;
    return m;
  }

  updateMorale(dt: number) {
    for (const side of [0, 1] as const) {
      const m = this.sideMorale(side);
      if (m > 40) continue;
      for (const u of this.units) {
        if (u.side !== side || u.dead || u.routed || u.hero || u.comp) continue;
        const p = (m < 10 ? 0.25 : m < 25 ? 0.06 : 0.015) * (u.hp / u.maxHp < 0.5 ? 2 : 1) * dt;
        if (Math.random() < p) { u.routed = true; u.target = null; u.task = undefined; }
      }
    }
  }

  spawnPoint(side: 0 | 1): [number, number] {
    const west = this.westSide(side);
    const sg = this.F.siege;
    let x = west ? 24 + Math.random() * 30 : this.W - 24 - Math.random() * 30;
    const y = this.H / 2 + (Math.random() - 0.5) * this.H * 0.5;
    if (sg && !west) x = this.W - 40 - Math.random() * 60;
    return this.F.nearestFree(x, y);
  }

  reinforce(dt: number) {
    this.reinforceT -= dt;
    if (this.reinforceT > 0) return;
    this.reinforceT = 2.5;
    const cap = Math.max(120, settings.fieldCap);
    for (const side of [0, 1] as const) {
      const res = this.reserves[side];
      if (!res.length) continue;
      const alive = this.units.filter(u => u.side === side && !u.dead && !u.fled).length;
      const capSide = Math.round(cap * (side === 0 ? 0.5 : 0.5) * 1.15);
      if (alive >= capSide * 0.8) continue;
      const n = Math.min(16, capSide - alive);
      let spawned = 0, allyN = 0;
      for (let i = 0; i < n && res.length; i++) {
        const e = res.shift()!;
        const u = this.makeUnit(side, e.id, e.pid, e.ally);
        [u.x, u.y] = this.spawnPoint(side);
        u.sq = this.squadFor(u); u.sq.members.push(u);
        if (u.sq.order === 'hold' || u.sq.order === 'advance') { /* 援兵加入阵列 */ }
        if (this.setup.siege && side !== this.att) { u.postX = this.F.siege!.wallX + 80 + Math.random() * 120; u.postY = this.F.siege!.gateMid + (Math.random() - 0.5) * 300; }
        this.units.push(u);
        this.spawnSprite(u);
        spawned++; if (e.ally) allyN++;
      }
      if (spawned) {
        this.msg(side === 0 ? (allyN === spawned ? `友军 ${spawned} 人赶到战场。` : `我军 ${spawned} 名援兵赶到。`) : `敌军 ${spawned} 名援兵赶到！`);
        for (const sq of this.squads) if (sq.side === side) this.computeSlots(sq);
      }
    }
  }

  activeCount(side: 0 | 1) {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.routed && !u.fled) n++;
    n += this.reserves[side].length;
    return n;
  }

  checkEnd() {
    const a = this.activeCount(0), b = this.activeCount(1);
    if (b === 0) this.finish(true);
    else if (a === 0) this.finish(false);
  }

  finish(win: boolean, retreat = false) {
    if (this.finished) return;
    this.finished = true;
    if (win) {
      // 溃逃的敌人部分被俘/击倒
      for (const u of this.units) if (u.side === 1 && !u.dead && u.troop && Math.random() < 0.3) { this.down[1][u.troop] = (this.down[1][u.troop] || 0) + 1; const pd = this.downPid[u.pid] ||= {}; pd[u.troop] = (pd[u.troop] || 0) + 1; }
    }
    if (retreat) {
      for (const u of this.units) if (u.side === 0 && !u.dead && !u.fled && u.troop && Math.random() < 0.15) { this.down[0][u.troop] = (this.down[0][u.troop] || 0) + 1; const pd = this.downPid[u.pid] ||= {}; pd[u.troop] = (pd[u.troop] || 0) + 1; }
    }
    const out: Outcome = {
      win, ourDown: { ...(this.downPid.p ?? {}) }, enemyDown: { ...this.down[1] }, heroDown: this.heroDown, compDown: [...this.compDown], retreat, manual: true,
      downBy: JSON.parse(JSON.stringify(this.downPid)),
    };
    if (this.hero && !this.hero.dead) S.hero.hp = Math.max(0.05, this.hero.hp / this.hero.maxHp);
    music.play('off'); music.ambience('none');
    sfx(win ? 'victory' : 'defeat', { vol: 0.9 });
    battleHud.showEnd(win, retreat, () => this.exit(out));
  }

  /** 以自动结算完成剩余战斗 */
  autoFinish() {
    if (this.finished) return;
    const alive = (side: 0 | 1) => {
      const ents: { id: string; pid: string }[] = [];
      for (const u of this.units) if (u.side === side && !u.dead && !u.fled && u.troop) ents.push({ id: u.troop, pid: u.pid });
      for (const e of this.reserves[side]) ents.push(e);
      return ents;
    };
    const a = alive(0), b = alive(1);
    let extra = 0;
    for (const u of this.units) if (u.side === 0 && !u.dead && !u.troop) extra += (u.maxHp / 10) * ((u.atk + u.skill * 0.6) / 10) * (1 + u.def / 25);
    const sideMult = this.setup.siege ? (this.att === 0 ? [1, 1.4] : [1.4, 1]) : [1, 1];
    const r = autoResolve(toStacks(a.map(e => e.id)), toStacks(b.map(e => e.id)), sideMult[0], sideMult[1], extra, 0);
    const apply = (side: 0 | 1, ents: { id: string; pid: string }[], cas: Casualties) => {
      for (const id in cas) {
        let n = cas[id];
        const pool = ents.filter(e => e.id === id);
        for (let i = 0; i < n && pool.length; i++) {
          const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
          this.down[side][id] = (this.down[side][id] || 0) + 1;
          const pd = this.downPid[e.pid] ||= {}; pd[id] = (pd[id] || 0) + 1;
        }
        n = 0;
      }
    };
    apply(0, a, r.aDown); apply(1, b, r.bDown);
    this.finish(r.aWin);
  }

  retreat() { this.finish(false, true); }

  exit(out: Outcome) {
    battleHud.close();
    this.scene.stop();
    this.scene.wake('World');
    this.setup.onEnd(out);
  }

  updateCamera(dt: number, free = false) {
    const cam = this.cameras.main;
    if (this.hero && !this.hero.dead && !free) {
      const lift = this.liftOf(this.hero);
      cam.scrollX += (this.hero.x - cam.width / 2 - cam.scrollX) * Math.min(1, 6 * dt);
      cam.scrollY += (this.hero.y - lift - cam.height / 2 - cam.scrollY) * Math.min(1, 6 * dt);
    } else {
      const k = this.keys; const sp = 600 * dt / cam.zoom;
      if (k.W.isDown || k.UP.isDown) cam.scrollY -= sp;
      if (k.S.isDown || k.DOWN.isDown) cam.scrollY += sp;
      if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= sp;
      if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += sp;
    }
  }
  /** 小地图点击：移动镜头 */
  lookAt(x: number, y: number) { this.cameras.main.centerOn(x, y); }

  updateAudio() {
    const v = this.cameras.main.worldView;
    const m = 120;
    let melee = 0, cav = 0;
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      if (u.x < v.x - m || u.x > v.right + m || u.y < v.y - m || u.y > v.bottom + m) continue;
      if (u.swing > 0 || u.cd > 0.2 && Math.hypot(u.vx, u.vy) < 20) melee++;
      if (u.mounted && Math.hypot(u.vx, u.vy) > 70) cav++;
    }
    music.battleIntensity(melee, cav);
    if (melee > 6 && Math.random() < 0.5) {
      const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
      this.snd('shout', x, y, 0.6);
    }
  }

  // ---------- 绘制 ----------
  sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.parts.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 90;
      this.parts.push({ x, y: y + 14, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 20 + Math.random() * 70, life: 0, max: 0.25 + Math.random() * 0.2, kind: 'clang', size: 1 });
    }
  }

  /** 夜战：部分士兵举火把，两军阵后燃起篝火，攻城时城头挂灯 */
  makeTorches() {
    ensureLifeTextures(this);
    const add = (u: Unit | null, x: number, y: number, big: boolean) => {
      const glow = this.add.image(x, y, 'life_glow').setBlendMode(big ? Phaser.BlendModes.ADD : Phaser.BlendModes.SCREEN).setDepth(30.5).setScale(big ? 3.2 : 1.6).setAlpha(0.6);
      this.torches.push({ u, x, y, glow, big, ph: Math.random() * 10 });
    };
    const k = [0, 0], cnt = [0, 0];
    for (const u of this.units) if (!u.mounted && !u.hero && (k[u.side]++ % 8 === 0) && cnt[u.side] < 16) { cnt[u.side]++; u.torch = true; add(u, u.x, u.y, false); }
    const sg = this.F.siege;
    for (const side of [0, 1] as const) {
      if (sg && side !== this.att) continue;
      const west = this.westSide(side), x = west ? Math.max(70, this.baseX[side] - 260) : Math.min(this.W - 70, this.baseX[side] + 260);
      for (let i = 0; i < 3; i++) add(null, x, this.H * (0.3 + i * 0.2), true);
    }
    if (sg) for (let y = 80; y < this.H - 40; y += 140) add(null, sg.wallX + 4, y - WALL_H, false);
  }

  /** 开场：大字 */
  intro() {
    if (typeof document === 'undefined') return;
    const st = this.setup;
    const el = document.createElement('div');
    el.className = 'battle-intro';
    const ch = st.arena ? '武' : st.defend ? '守' : st.siege ? '攻' : (st.night ? '夜' : '战');
    const sub = st.arena ? '武举校场' : st.defend ? `${st.enemyName}来犯` : st.siege ? `攻打${st.enemyName.replace('守军', '')}` : `迎战 ${st.enemyName}`;
    el.innerHTML = `<div class="bi-ink"></div><div class="bi-char">${ch}</div><div class="bi-sub">${sub}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1900);
    setTimeout(() => el.remove(), 2800);
  }

  render() {
    const g = this.g, gp = this.gProj, gu = this.gUnder, gt = this.gTop;
    g.clear(); gp.clear(); gu.clear(); gt.clear();
    const dt = this.finished ? 0 : this.lastDt;
    const now = this.time.now;
    const v = this.cameras.main.worldView;
    const mx0 = v.x - 80, mx1 = v.right + 80, my0 = v.y - 80, my1 = v.bottom + 120;
    for (const u of this.units) {
      const spr = u.spr;
      if (!spr) continue;
      if (u.dead || u.fled) { spr.setVisible(false); u.banner?.setVisible(false); continue; }
      const vis = u.x > mx0 && u.x < mx1 && u.y > my0 && u.y < my1;
      if (!vis) { if (spr.visible) { spr.setVisible(false); u.banner?.setVisible(false); } continue; }
      spr.setVisible(true);
      const lift = this.liftOf(u);
      const sp = Math.hypot(u.vx, u.vy);
      let f: number = FR.idle;
      u.firedT = Math.max(0, (u.firedT ?? 0) - dt);
      if (u.trans) { u.walkT = (u.walkT ?? 0) + 30 * dt; f = FR.walk0 + Math.floor(u.walkT / 7) % 4; }
      else if (u.swing > 0) { const prog = 1 - u.swing / SWING; f = FR.atk0 + Math.min(2, Math.floor(prog * 3)); }
      else if ((u.firedT ?? 0) > 0) f = FR.release;
      else if (u.hero ? (this.heroMode === 'ranged' && u.rng > 0 && sp < 10) : u.aiming) f = FR.aim;
      else if (sp > 6) { u.walkT = (u.walkT ?? 0) + sp * dt; f = FR.walk0 + Math.floor(u.walkT / (u.mounted ? 11 : 7)) % 4; }
      const flip = Math.cos(u.face) < 0;
      spr.setPosition(u.x, u.y - lift).setFrame(f).setFlipX(flip).setDepth(lift > 2 ? 11.2 + u.y / 1e5 : this.dy(u.y));
      if (u.hitFlash > 0) spr.setTintFill(0xffffff); else if (u.routed) spr.setTint(0xb0b0b0); else spr.clearTint();
      const col = this.colorOf(u);
      gu.fillStyle(col, u.hero ? 0 : 0.28); gu.fillEllipse(u.x, u.y - lift + 0.5, u.mounted ? 22 : 12, u.mounted ? 7 : 4.5);
      if (u.hero || u.comp) {
        gu.lineStyle(1.6, u.hero ? 0xffe070 : 0x8fd8ff, 0.95); gu.strokeEllipse(u.x, u.y - lift + 0.5, u.mounted ? 30 : 18, u.mounted ? 10 : 7);
        const w = 22, top = u.y - lift - (u.mounted ? 46 : 34);
        gt.fillStyle(0x000000, 0.6); gt.fillRect(u.x - w / 2 - 1, top - 1, w + 2, 5);
        gt.fillStyle(u.hero ? 0x40e060 : 0x60c0ff, 1); gt.fillRect(u.x - w / 2, top, w * Math.max(0, u.hp / u.maxHp), 3);
      }
      if (u.mounted && sp > 80 && dt > 0) {
        u.dustT = (u.dustT ?? 0) - dt;
        if (u.dustT <= 0 && this.parts.length < 450) {
          u.dustT = 0.12;
          const wet = this.F.waterAt(u.x, u.y);
          this.parts.push({ x: u.x - Math.cos(u.face) * 10, y: u.y + 1, z: 1, vx: -u.vx * 0.1, vy: -u.vy * 0.1, vz: 8, life: 0, max: 0.9, kind: wet ? 'spark' : 'dust', size: wet ? 2 : 3 + Math.random() * 2 });
        }
      }
      // 涉水的水花
      if (!u.mounted && sp > 20 && dt > 0 && Math.random() < 0.05 && this.F.waterAt(u.x, u.y)) { gu.lineStyle(1, 0xe0f0ff, 0.7); gu.strokeEllipse(u.x, u.y + 1, 14, 5); }
      if (u.banner) {
        const dir = flip ? -1 : 1;
        u.banner.setPosition(u.x - dir * 5, u.y - lift - 2).setFlipX(!flip).setDepth(spr.depth - 0.00001).setFrame(Math.floor(now / 130 + u.uid) % 4).setVisible(true);
      }
    }
    for (const tc of this.torches) {
      let x = tc.x, y = tc.y, alive = true;
      if (tc.u) {
        const u = tc.u; alive = !u.dead && !u.fled;
        if (alive) { const dir = Math.cos(u.face) < 0 ? -1 : 1; x = u.x + dir * 6; y = u.y - this.liftOf(u) - 22; }
      }
      if (!alive) { tc.glow.setVisible(false); continue; }
      const fl = 0.8 + 0.2 * Math.sin(now / 70 + tc.ph) * Math.sin(now / 160 + tc.ph * 2);
      tc.glow.setPosition(x, y + (tc.big ? -4 : 2)).setAlpha((tc.big ? 0.85 : 0.42) * fl).setVisible(true);
      if (x < mx0 || x > mx1 || y < my0 || y > my1) continue;
      const fs = tc.big ? 5 : 2.2;
      if (tc.big) { gu.fillStyle(0x2a1a10, 0.9); gu.fillEllipse(x, y + 2, 18, 6); gu.fillStyle(0x5a3a20, 1); gu.fillRect(x - 7, y, 14, 2); }
      else { gp.lineStyle(1.2, 0x5a3a1a, 1); gp.lineBetween(x, y, x - 1, y + 9); }
      gp.fillStyle(0xff7020, 0.9); gp.fillTriangle(x - fs, y, x + fs, y, x + Math.sin(now / 90 + tc.ph) * fs * 0.4, y - fs * 2.6 * fl);
      gp.fillStyle(0xffe080, 1); gp.fillTriangle(x - fs * 0.5, y, x + fs * 0.5, y, x, y - fs * 1.4 * fl);
      if (dt > 0 && Math.random() < (tc.big ? 0.4 : 0.05) && this.parts.length < 450) this.parts.push({ x, y, z: fs * 2, vx: (Math.random() - 0.5) * 10, vy: 0, vz: 18 + Math.random() * 20, life: 0, max: 1 + Math.random(), kind: 'ember', size: 1 });
    }
    const focus = this.hero && !this.hero.dead ? this.hero : null;
    for (const p of this.props) {
      if (!p.tree) continue;
      let a = 1;
      if (focus && Math.abs(focus.x - p.x) < p.w * 0.45 && focus.y < p.y - 2 && focus.y > p.y - p.h * 0.95) a = 0.4;
      if (p.spr.alpha !== a) p.spr.setAlpha(a);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life += dt;
      if (q.life >= q.max) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = q.life / q.max;
      if (q.x < mx0 || q.x > mx1 || q.y < my0 || q.y > my1 + 60) continue;
      if (q.kind === 'blood') {
        q.vz -= 320 * dt;
        if (q.z <= 0) {
          if (this.stamps < 3000 && Math.random() < 0.5) { const s = this.stamp; s.clear(); s.fillStyle(0x6a140a, 0.7); s.fillCircle(0, 0, q.size * 0.9); try { this.ground?.draw(s, q.x, q.y); } catch { /* */ } this.stamps++; }
          this.parts.splice(i, 1); continue;
        }
        gp.fillStyle(0xa01810, 0.95); gp.fillRect(q.x - q.size / 2, q.y - q.z - q.size / 2, q.size, q.size);
      } else if (q.kind === 'dust') {
        q.vx *= 0.96; q.vy *= 0.96;
        g.fillStyle(0xc8b48a, 0.35 * (1 - t)); g.fillCircle(q.x, q.y - q.z, q.size * (1 + t * 2.2));
      } else if (q.kind === 'smoke') {
        q.vx *= 0.97; q.vy *= 0.97;
        gp.fillStyle(0xe8e4dc, 0.32 * (1 - t) * (1 - t)); gp.fillCircle(q.x + t * 6, q.y - q.z - t * 8, q.size * (0.8 + t * 1.8));
      } else if (q.kind === 'clang') {
        q.vz -= 300 * dt;
        gp.lineStyle(1, t < 0.4 ? 0xffffd0 : 0xffa030, 1 - t);
        gp.lineBetween(q.x, q.y - q.z, q.x - q.vx * 0.025, q.y - q.z - q.vy * 0.025 + q.vz * 0.025);
      } else if (q.kind === 'ember') {
        q.vx += (Math.random() - 0.5) * 40 * dt;
        gp.fillStyle(t < 0.5 ? 0xffd060 : 0xff6020, 1 - t); gp.fillRect(q.x - 0.6, q.y - q.z - 0.6, 1.2, 1.2);
      } else if (q.kind === 'debris' || q.kind === 'rock') {
        q.vz -= (q.kind === 'rock' ? 260 : 340) * dt;
        if (q.z <= 0) { q.z = 0; q.vx *= 0.3; q.vy *= 0.3; q.vz = 0; }
        gp.fillStyle(q.col ?? 0x7a7060, 1); gp.fillRect(q.x - q.size / 2, q.y - q.z - q.size / 2, q.size, q.size * 0.8);
        if (q.kind === 'rock') { gp.fillStyle(0x9a9080, 1); gp.fillCircle(q.x, q.y - q.z, q.size); }
      } else if (q.kind === 'fire') {
        gp.fillStyle(t < 0.4 ? 0xffe070 : 0xff6a20, 0.9 * (1 - t)); gp.fillTriangle(q.x - q.size * (1 - t), q.y - q.z, q.x + q.size * (1 - t), q.y - q.z, q.x, q.y - q.z - q.size * 2.4 * (1 - t * 0.5));
      } else if (q.kind === 'boom') {
        gp.fillStyle(0xfff0b0, 0.9 * (1 - t)); gp.fillCircle(q.x, q.y - 8, q.size * (0.6 + t));
        gp.fillStyle(0xff8a20, 0.6 * (1 - t)); gp.fillCircle(q.x, q.y - 8, q.size * (1 + t * 1.5));
      } else {
        gp.fillStyle(0xfff0a0, 0.9 * (1 - t)); gp.fillCircle(q.x, q.y - q.z, q.size * (1 - t * 0.5));
        gp.fillStyle(0xff8a20, 0.5 * (1 - t)); gp.fillCircle(q.x, q.y - q.z, q.size * 1.8);
      }
    }
    for (const p of this.projs) {
      if (p.x < mx0 || p.x > mx1 || p.y < my0 || p.y > my1) continue;
      const trav = Math.hypot(p.x - p.sx, p.y - p.sy);
      const t = trav / p.dist;
      const arc = p.kind === 'gun' ? 0 : p.kind === 'xbow' ? p.dist * 0.05 : p.dist * 0.16;
      const zAt = (tt: number) => Math.max(0, p.z0 + (12 - p.z0) * Math.min(tt, 1) + arc * 4 * tt * (1 - tt) - (tt > 1 ? (tt - 1) * 60 : 0));
      const z = zAt(t), z2 = zAt(t + 0.02);
      const a = Math.atan2(p.vy, p.vx);
      const L = p.kind === 'gun' ? 10 : 9;
      const step = 0.02 * p.dist;
      const ang = Math.atan2(Math.sin(a) * step - (z2 - z), Math.cos(a) * step);
      if (p.kind === 'gun') {
        gp.lineStyle(2, 0xfff2b0, 0.95); gp.lineBetween(p.x, p.y - z, p.x - Math.cos(a) * L, p.y - z - Math.sin(a) * L);
      } else {
        gp.lineStyle(1, 0x000000, 0.25); gp.lineBetween(p.x, p.y, p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7);
        const x0 = p.x, y0 = p.y - z, x1 = x0 - Math.cos(ang) * L, y1 = y0 - Math.sin(ang) * L;
        gp.lineStyle(1.3, 0x3a2414, 1); gp.lineBetween(x0, y0, x1, y1);
        gp.fillStyle(0xf0ece0, 1); gp.fillRect(x1 - 1, y1 - 1, 2, 2);
        gp.fillStyle(0xd0d4d8, 1); gp.fillRect(x0 - 0.8, y0 - 0.8, 1.6, 1.6);
      }
    }
    this.siegeCtl?.drawBalls(gp);
    if (this.hero && !this.hero.dead && !this.finished && this.phase === 'fight') {
      const h = this.hero, lift = this.liftOf(h);
      if (this.heroMode === 'ranged') {
        gp.lineStyle(1, 0xffffff, 0.25); gp.lineBetween(h.x, h.y - lift, h.x + Math.cos(h.face) * Math.min(h.range, 250), h.y - lift + Math.sin(h.face) * Math.min(h.range, 250));
        if (h.rcd > 0) { gt.lineStyle(2, 0xffe9a0, 0.8); gt.beginPath(); gt.arc(h.x, h.y - lift - 22, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - h.rcd / h.reload)); gt.strokePath(); }
      } else {
        gu.lineStyle(1, 0xffffff, 0.22); gu.beginPath(); gu.arc(h.x, h.y - lift, h.reach + 6, h.face - 0.9, h.face + 0.9); gu.strokePath();
      }
      // 可交互提示
      const ctl = this.siegeCtl;
      if (ctl && !h.trans) {
        const sg = this.F.siege!;
        const nearL = !h.onWall && h.x < sg.wallX && ctl.ladders.some(l => l.state === 'up' && Math.hypot(h.x - (sg.wallX - 32), h.y - l.y) < 44);
        const nearS = h.onWall ? sg.stairs.some(y => Math.abs(y - h.y) < 30) : h.x > sg.wallX && sg.stairs.some(y => Math.hypot(h.x - (sg.wallX + 46), h.y - (y + 10)) < 50);
        if (nearL || nearS) { gt.fillStyle(0x000000, 0.6); gt.fillRoundedRect(h.x - 13, h.y - lift - 60, 26, 16, 4); gt.lineStyle(1, 0xffe9a0, 1); gt.strokeRoundedRect(h.x - 13, h.y - lift - 60, 26, 16, 4); this.showKeyHint(h.x, h.y - lift - 52); } else this.hideKeyHint();
      }
    } else this.hideKeyHint();
    // 阵位标记
    const sel = this.phase === 'fight' ? this.selGroups() : [];
    for (const gname of sel) {
      const sq = this.psq[gname];
      if (sq.order !== 'hold' && sq.order !== 'advance') continue;
      gu.lineStyle(1.5, this.colors[0], 0.45); gu.strokeEllipse(sq.ax, sq.ay, 26, 10);
      gu.lineBetween(sq.ax, sq.ay, sq.ax + Math.cos(sq.face) * 22, sq.ay + Math.sin(sq.face) * 22);
    }
    // 马道位置
    const sg = this.F.siege;
    if (sg && this.hero && !this.hero.dead) for (const y of sg.stairs) { gu.fillStyle(0xffe080, 0.18); gu.fillCircle(sg.wallX + 46, y + 10, 10); }
    if (this.markT > 0) { this.markT -= dt || 0.016; gu.lineStyle(2, 0xffffff, Math.min(1, this.markT)); gu.strokeCircle(this.markX, this.markY, 10 + (1.2 - this.markT) * 14); }
  }
  hint: Phaser.GameObjects.Text | null = null;
  showKeyHint(x: number, y: number) {
    if (!this.hint) this.hint = this.add.text(0, 0, 'E', { fontFamily: 'sans-serif', fontSize: '12px', color: '#ffe9a0', fontStyle: 'bold' }).setOrigin(0.5).setDepth(32);
    this.hint.setPosition(x, y).setVisible(true);
  }
  hideKeyHint() { this.hint?.setVisible(false); }
}

function toStacks(ids: string[]): Stack[] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) || 0) + 1);
  return [...m.entries()].map(([id, n]) => ({ id, n, w: 0, xp: 0 }));
}
