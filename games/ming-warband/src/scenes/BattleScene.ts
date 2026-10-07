// 即时战斗场景
import Phaser from 'phaser';
import { TROOPS, isRanged, type TroopClass } from '../data/troops';
import { ITEMS } from '../data/items';
import { COMPANIONS, FACTION } from '../data/world';
import type { Stack } from '../core/state';
import { S } from '../core/game';
import { heroMaxHp, heroArmor, horseRidingReq } from '../core/character';
import { autoResolve, type Outcome, type Casualties } from '../core/combat';
import { Ter } from '../core/terrain';
import { fbm } from '../core/rng';
import { battleHud } from '../ui/battleHud';
import { troopSpec, companionSpec } from '../art/specs';
import { RES, FR } from '../art/figures';
import { ensureFigure, ensureBanner, ensureAtlas, currentHeroSpec, FACTION_CHAR } from '../art/phaserTex';
import { buildBattleAtlas, buildWallTop, paintBattleGround, BRES, WALL_H } from '../art/battleArt';

import { sfx, type SfxName } from '../audio/sfx';
import { music } from '../audio/music';

const SWING = 0.32;
interface Prop { spr: Phaser.GameObjects.Image; x: number; y: number; w: number; h: number; tree: boolean }
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; kind: 'blood' | 'dust' | 'smoke' | 'spark'; size: number }

export interface BattleSetup {
  ours: Stack[];
  theirs: Stack[];
  enemyName: string;
  enemyFaction: string;
  terrain: Ter;
  siege: boolean; // 玩家攻城
  night: boolean;
  heroFights: boolean;
  onEnd: (o: Outcome) => void;
}

type Group = 'inf' | 'rng' | 'cav';
type Order = 'hold' | 'follow' | 'charge';

interface Unit {
  uid: number; side: 0 | 1; troop: string | null; comp: string | null; name: string;
  x: number; y: number; vx: number; vy: number; face: number;
  hp: number; maxHp: number; atk: number; def: number; skill: number; speed: number;
  mounted: boolean; cls: TroopClass; reach: number; antiCav: boolean;
  rng: number; range: number; reload: number; ammo: number; kind: 'bow' | 'xbow' | 'gun' | null;
  cd: number; rcd: number; target: Unit | null; retarget: number;
  group: Group; dead: boolean; routed: boolean; fled: boolean; hero: boolean;
  chargeT: number; disengage: number; r: number; onWall: boolean; swing: number; hitFlash: number;
  spr?: Phaser.GameObjects.Sprite | null; sheet?: string; walkT?: number; aiming?: boolean; firedT?: number; dustT?: number;
  banner?: Phaser.GameObjects.Sprite | null;
}

interface Proj { x: number; y: number; vx: number; vy: number; dmg: number; side: 0 | 1; life: number; kind: 'bow' | 'xbow' | 'gun'; from: Unit; sx: number; sy: number; dist: number; z0: number }

const BW = 1600, BH = 1000;
const WALL_X = 1130, GATE_Y0 = 430, GATE_Y1 = 570;
const MAX_FIELD = 90;

const TER_GROUND: Record<number, [number, number, number]> = {
  [Ter.Plain]: [118, 140, 72], [Ter.Steppe]: [150, 156, 88], [Ter.Forest]: [74, 104, 56], [Ter.Hills]: [128, 124, 80],
  [Ter.Mountain]: [120, 112, 92], [Ter.Desert]: [196, 176, 120], [Ter.Plateau]: [150, 146, 130], [Ter.Sea]: [118, 140, 72],
};

export class BattleScene extends Phaser.Scene {
  setup!: BattleSetup;
  units: Unit[] = [];
  reserves: [Stack[], Stack[]] = [[], []];
  projs: Proj[] = [];
  g!: Phaser.GameObjects.Graphics;
  gProj!: Phaser.GameObjects.Graphics;
  ground!: Phaser.GameObjects.RenderTexture;
  stamp!: Phaser.GameObjects.Graphics;
  hero: Unit | null = null;
  heroMode: 'melee' | 'ranged' = 'melee';
  orders: Record<Group, Order> = { inf: 'hold', rng: 'hold', cav: 'hold' };
  holdPos: Record<Group, { x: number; y: number }> = { inf: { x: 0, y: 0 }, rng: { x: 0, y: 0 }, cav: { x: 0, y: 0 } };
  selected: Group | 'all' = 'all';
  initial: [number, number] = [0, 0];
  down: [Casualties, Casualties] = [{}, {}];
  compDown: string[] = [];
  heroDown = false;
  finished = false;
  elapsed = 0;
  enemyCharge = false;
  uidSeq = 1;
  keys: any;
  smoke: { x: number; y: number; t: number }[] = [];
  floaters: Phaser.GameObjects.Text[] = [];
  reinforceT = 0;
  colors: [number, number] = [0xe0b040, 0xc0392b];
  props: Prop[] = [];
  parts: Part[] = [];
  gTop!: Phaser.GameObjects.Graphics;
  gUnder!: Phaser.GameObjects.Graphics;
  stampSpr: Phaser.GameObjects.Sprite | null = null;
  lastDt = 0.016;
  bannerKeys: [string, string] = ['', ''];
  stamps = 0;
  audioT = 0;

  constructor() { super('Battle'); }

  init(data: BattleSetup) {
    this.setup = data;
    this.units = []; this.projs = []; this.reserves = [[], []]; this.down = [{}, {}]; this.compDown = [];
    this.heroDown = false; this.finished = false; this.elapsed = 0; this.enemyCharge = false; this.hero = null; this.smoke = [];
    this.orders = { inf: 'hold', rng: 'hold', cav: 'hold' }; this.selected = 'all'; this.heroMode = 'melee'; this.reinforceT = 0;
    this.floaters = []; this.props = []; this.parts = []; this.stampSpr = null; this.stamps = 0;
  }

  create() {
    const st = this.setup;
    const ef = FACTION[st.enemyFaction];
    this.colors = [0xe0b040, st.enemyFaction === 'bandit' ? 0x3a3a3a : ef?.color ?? 0xc0392b];
    if (this.colors[1] === 0xd88a1c) this.colors[0] = 0x3a8ad8; // 避免与闯军颜色混淆
    this.makeGround();
    this.stamp = this.make.graphics({}, false);
    this.gUnder = this.add.graphics().setDepth(2);
    this.g = this.add.graphics().setDepth(2.5);
    this.gProj = this.add.graphics().setDepth(14);
    this.gTop = this.add.graphics().setDepth(31);
    this.makeProps();
    if (st.night) this.add.rectangle(-200, -200, BW + 400, BH + 400, 0x0a1430, 0.38).setOrigin(0).setDepth(30);
    const bc0 = ensureBanner(this, this.colors[0], S.hero.name[0] ?? '义', true);
    const bc1 = ensureBanner(this, this.colors[1], FACTION_CHAR[st.enemyFaction] ?? '敌', true);
    this.bannerKeys = [bc0.key, bc1.key];
    const cam = this.cameras.main;
    cam.setBounds(0, 0, BW, BH);
    cam.setZoom(Math.max(0.6, Math.min(1.2, this.scale.width / 1300)));

    this.deploy();
    for (const u of this.units) this.spawnSprite(u);
    music.play(st.siege ? 'siege' : 'battle'); music.ambience('battle');
    sfx('horn', { vol: 0.7 }); sfx('drumRoll', { vol: 0.7, delay: 0.5 }); sfx('crowd', { vol: 0.6, delay: 1.6 });
    this.audioT = 0;
    this.assignBanners();
    this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.45, 2)));
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,Q,Z,X,C,R,ONE,TWO,THREE,FOUR,UP,DOWN,LEFT,RIGHT,SPACE,TAB');
    this.input.keyboard!.addCapture('SPACE,TAB');
    this.input.keyboard!.on('keydown-ONE', () => this.select('all'));
    this.input.keyboard!.on('keydown-TWO', () => this.select('inf'));
    this.input.keyboard!.on('keydown-THREE', () => this.select('rng'));
    this.input.keyboard!.on('keydown-FOUR', () => this.select('cav'));
    this.input.keyboard!.on('keydown-Z', () => this.order('charge'));
    this.input.keyboard!.on('keydown-X', () => this.order('hold'));
    this.input.keyboard!.on('keydown-C', () => this.order('follow'));
    this.input.keyboard!.on('keydown-Q', () => this.toggleWeapon());
    this.input.mouse?.disableContextMenu();
    this.events.once('shutdown', () => { this.input.keyboard?.clearCaptures(); battleHud.close(); });
    battleHud.open(this);
    this.msg(st.siege ? `攻城战开始！冲破${st.enemyName.replace('守军', '')}的城门！` : `与${st.enemyName}的战斗开始了！`);
    this.msg('WASD 移动，鼠标左键攻击，Q 切换武器；1-4 选择部队，Z 冲锋 / X 坚守 / C 跟随。');
    if (this.hero) cam.centerOn(this.hero.x, this.hero.y); else cam.centerOn(400, BH / 2);
  }

  makeGround() {
    const key = 'bground';
    if (this.textures.exists(key)) this.textures.remove(key);
    const cv = paintBattleGround({ W: BW, H: BH, terrain: this.setup.terrain, siege: this.setup.siege, wallX: WALL_X, gateY0: GATE_Y0, gateY1: GATE_Y1, seed: Math.floor(Math.random() * 1000), night: this.setup.night });
    this.textures.addCanvas(key, cv as HTMLCanvasElement);
    this.ground = this.add.renderTexture(0, 0, BW, BH).setOrigin(0).setDepth(0);
    const img2 = this.make.image({ x: 0, y: 0, key, add: false }).setOrigin(0);
    this.ground.draw(img2, 0, 0);
  }

  addProp(frame: string, x: number, y: number, tree = false, depthY = y) {
    const fm = ensureAtlas(this, 'batlas', buildBattleAtlas);
    const f = fm.get(frame); if (!f) return;
    const sc = (tree ? 1.45 + Math.random() * 0.35 : frame.startsWith('bush') ? 1.2 : 1) / BRES;
    const spr = this.add.image(x, y, 'batlas', frame).setOrigin(f.ax, f.ay).setScale(sc).setDepth(10 + depthY / 1000);
    if (tree && Math.random() < 0.5) spr.setFlipX(true);
    this.props.push({ spr, x, y, w: f.w * sc, h: f.h * sc, tree });
  }

  makeProps() {
    const st = this.setup;
    const t = st.terrain;
    const R = Math.random;
    const clearZone = (x: number, y: number) => (x > 200 && x < BW - 200 && y > 260 && y < BH - 260);
    const nTrees = t === Ter.Forest ? 85 : t === Ter.Plain ? 16 : t === Ter.Hills ? 22 : t === Ter.Mountain ? 14 : t === Ter.Steppe ? 3 : t === Ter.Plateau ? 5 : 0;
    const pineP = t === Ter.Mountain || t === Ter.Plateau ? 0.85 : t === Ter.Forest ? 0.4 : 0.15;
    for (let i = 0; i < nTrees; i++) {
      const x = 20 + R() * (BW - 40), y = 30 + R() * (BH - 40);
      if (st.siege && x > WALL_X - 60) continue;
      if (clearZone(x, y) && R() < 0.75) continue;
      if (R() < pineP) this.addProp(`pine${Math.floor(R() * 3)}`, x, y, true);
      else this.addProp(`tree${Math.floor(R() * 4)}`, x, y, true);
    }
    const nBush = t === Ter.Desert ? 6 : t === Ter.Forest ? 30 : 18;
    for (let i = 0; i < nBush; i++) {
      const x = R() * BW, y = R() * BH;
      if (st.siege && x > WALL_X - 40) continue;
      this.addProp(`bush${Math.floor(R() * 3)}`, x, y);
    }
    const nRock = t === Ter.Mountain || t === Ter.Plateau ? 30 : t === Ter.Hills || t === Ter.Desert ? 16 : 6;
    for (let i = 0; i < nRock; i++) {
      const x = R() * BW, y = R() * BH;
      if (st.siege && x > WALL_X - 40) continue;
      this.addProp(`rock${Math.floor(R() * 3)}`, x, y);
    }
    if (st.siege) {
      // 城墙顶面（北段与南段）
      const topN = GATE_Y0 - 40, topS0 = GATE_Y1 + 40;
      const mk = (len: number) => { const k = 'walltop' + len; if (!this.textures.exists(k)) this.textures.addCanvas(k, buildWallTop(len) as HTMLCanvasElement); return k; };
      this.add.image(WALL_X - 15 - 4, -WALL_H, mk(topN + 10)).setOrigin(0).setScale(1 / BRES).setDepth(10 + topN / 1000 - 0.0005);
      this.add.image(WALL_X - 15 - 4, topS0 - WALL_H, mk(BH - topS0 + WALL_H)).setOrigin(0).setScale(1 / BRES).setDepth(10 + topS0 / 1000 - 0.0005);
      this.addProp('gatetower', WALL_X, GATE_Y0);
      this.addProp('gatetower', WALL_X, GATE_Y1 + 40);
      // 城内房屋
      for (let i = 0; i < 40; i++) {
        const x = WALL_X + 80 + R() * (BW - WALL_X - 100), y = 40 + R() * (BH - 40);
        if (y > GATE_Y0 - 70 && y < GATE_Y1 + 90 && x < WALL_X + 330) continue;
        if (this.props.some(p => !p.tree && Math.abs(p.x - x) < 64 && Math.abs(p.y - y) < 56)) continue;
        this.addProp(`house${Math.floor(R() * 4)}`, x, y);
      }
      for (let i = 0; i < 5; i++) this.addProp('stakes', WALL_X + 60 + R() * 50, GATE_Y0 - 30 - R() * 60);
      for (let i = 0; i < 5; i++) this.addProp('stakes', WALL_X + 60 + R() * 50, GATE_Y1 + 30 + R() * 60);
      for (let i = 0; i < 8; i++) { const x = WALL_X + 120 + R() * 380; this.addProp(`tree${Math.floor(R() * 4)}`, x, R() < 0.5 ? 40 + R() * 200 : BH - 40 - R() * 200, true); }
    }
  }

  // ---------- 精灵 ----------
  /** 按与镜头的距离与左右位置播放音效 */
  snd(name: SfxName, x: number, y: number, vol = 1) {
    const v = this.cameras.main.worldView;
    const dx = x - v.centerX, dy = y - v.centerY;
    const span = Math.max(v.width, 480);
    const k = 1 - Math.hypot(dx, dy * 1.3) / (span * 1.5);
    if (k <= 0.02) return;
    sfx(name, { vol: vol * (0.12 + 0.88 * k * k), pan: dx / (span * 0.75), muffle: (1 - k) * 0.75 });
  }
  liftOf(u: Unit) { return u.onWall && this.setup.siege && Math.abs(u.x - WALL_X) < 24 ? WALL_H : 0; }
  specOf(u: Unit) {
    if (u.hero) return currentHeroSpec(u.mounted, this.heroMode);
    if (u.comp) return companionSpec(u.comp, this.colors[0], u.mounted);
    return troopSpec(u.troop!, this.colors[u.side]);
  }
  spawnSprite(u: Unit) {
    const info = ensureFigure(this, this.specOf(u));
    u.spr = this.add.sprite(u.x, u.y, info.key, 0).setOrigin(info.ax, info.ay).setScale(1 / RES).setDepth(10 + u.y / 1000);
    u.sheet = info.key; u.walkT = Math.random() * 30; u.firedT = 0; u.dustT = 0;
  }
  refreshHeroSprite() {
    const h = this.hero; if (!h || !h.spr) return;
    const info = ensureFigure(this, this.specOf(h));
    if (info.key !== h.sheet) { h.spr.setTexture(info.key, 0).setOrigin(info.ax, info.ay); h.sheet = info.key; }
  }
  assignBanners() {
    for (const side of [0, 1] as const) {
      const cands = this.units.filter(u => u.side === side && !u.hero && !u.comp && u.group === 'inf' && !u.dead);
      const n = Math.min(3, Math.ceil(cands.length / 25));
      for (let i = 0; i < n; i++) {
        const u = cands[Math.floor((i + 0.5) * cands.length / n)];
        if (!u || u.banner) continue;
        u.banner = this.add.sprite(u.x, u.y, this.bannerKeys[side], 0).setOrigin(2 / 22, 1).setScale(1.1 / 3);
      }
    }
    if (this.hero && !this.hero.banner && this.setup.heroFights) {
      // 主角身后的亲兵掌旗
      const comp = this.units.find(u => u.side === 0 && !u.hero && u.troop && u.group !== 'rng');
      if (comp && !comp.banner) comp.banner = this.add.sprite(comp.x, comp.y, this.bannerKeys[0], 0).setOrigin(2 / 22, 1).setScale(1.25 / 3);
    }
  }

  stampCorpse(u: Unit) {
    if (!u.spr || !this.ground) return;
    try {
      if (!this.stampSpr) this.stampSpr = this.make.sprite({ x: 0, y: 0, key: u.sheet!, frame: FR.dead, add: false });
      const s = this.stampSpr;
      s.setTexture(u.sheet!, FR.dead).setOrigin(u.spr.originX, u.spr.originY).setScale(1 / RES).setFlipX(u.spr.flipX).setAlpha(0.95);
      s.setPosition(u.x, u.y - this.liftOf(u));
      this.ground.draw(s);
    } catch { /* 无渲染器时忽略 */ }
  }

  blood(x: number, y: number, n: number) {
    for (let i = 0; i < n && this.parts.length < 400; i++) {
      const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 26;
      this.parts.push({ x, y, z: 10 + Math.random() * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 10 + Math.random() * 40, life: 0, max: 2, kind: 'blood', size: 0.8 + Math.random() * 1.1 });
    }
  }

  // ---------- 部署 ----------
  makeUnit(side: 0 | 1, troop: string): Unit {
    const t = TROOPS[troop];
    const ranged = isRanged(t.cls);
    const kind = t.cls === 'arc' || t.cls === 'hca' ? 'bow' : t.cls === 'xbow' ? 'xbow' : t.cls === 'gun' ? 'gun' : null;
    const speed = t.mounted ? (t.cls === 'hca' ? 165 : 175) : t.cls === 'spear' ? 76 : t.cls === 'gun' ? 76 : 82;
    return {
      uid: this.uidSeq++, side, troop, comp: null, name: t.name, x: 0, y: 0, vx: 0, vy: 0, face: side ? Math.PI : 0,
      hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, skill: t.skill, speed, mounted: t.mounted, cls: t.cls,
      reach: t.cls === 'spear' ? 34 : t.mounted ? 28 : 24, antiCav: t.cls === 'spear',
      rng: t.rng ?? 0, range: kind === 'gun' ? 230 : kind === 'xbow' ? 250 : t.cls === 'hca' ? 230 : 265,
      reload: kind === 'gun' ? 4.5 : kind === 'xbow' ? 3 : t.cls === 'hca' ? 2.1 : 1.8, ammo: ranged ? t.ammo ?? 15 : 0, kind,
      cd: Math.random(), rcd: Math.random() * 1.5, target: null, retarget: 0,
      group: t.mounted ? 'cav' : ranged ? 'rng' : 'inf', dead: false, routed: false, fled: false, hero: false,
      chargeT: 0, disengage: 0, r: t.mounted ? 9 : 6, onWall: false, swing: 0, hitFlash: 0,
    };
  }

  deploy() {
    const st = this.setup;
    // 拆分为单兵队列
    const expand = (stacks: Stack[]) => { const ids: string[] = []; for (const s of stacks) for (let i = 0; i < s.n - s.w; i++) ids.push(s.id); return ids; };
    const ours = expand(st.ours), theirs = expand(st.theirs);
    this.initial = [ours.length + 1 + S.companions.length, theirs.length];
    const ourCap = Math.max(20, Math.round(MAX_FIELD * 2 * (ours.length / Math.max(1, ours.length + theirs.length))));
    const capO = Math.min(ours.length, Math.min(MAX_FIELD + 30, ourCap));
    const capT = Math.min(theirs.length, MAX_FIELD * 2 - capO);
    const field0 = ours.slice(0, capO), field1 = theirs.slice(0, capT);
    this.reserves[0] = toStacks(ours.slice(capO));
    this.reserves[1] = toStacks(theirs.slice(capT));

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
        uid: this.uidSeq++, side: 0, troop: null, comp: null, name: h.name, x: 260, y: BH / 2, vx: 0, vy: 0, face: 0,
        hp: Math.max(maxHp * 0.3, maxHp * h.hp), maxHp, atk: (melee?.dmg ?? 6) * (1 + h.skills.powerstrike * 0.08) * (1 + h.attrs.str * 0.012),
        def: heroArmor(h) + (horse?.horseArmor ?? 0) * 0.5, skill: 8 + h.level * 0.6 + h.attrs.agi * 0.3, speed: mounted ? 92 * (horse!.horseSpeed ?? 1.4) * (1 + h.skills.riding * 0.04) : 92 + h.attrs.agi * 2.5,
        mounted, cls: mounted ? 'cav' : 'inf', reach: melee?.reach ?? 24, antiCav: !!melee?.antiCav,
        rng: ranged ? (ranged.dmg ?? 10) * (1 + h.skills.archery * 0.07) : 0, range: ranged?.range ?? 0, reload: (ranged?.reload ?? 2) * (1 - h.skills.archery * 0.03), ammo: ranged?.ammo ?? 0, kind: ranged?.kind ?? null,
        cd: 0, rcd: 0, target: null, retarget: 0, group: 'inf', dead: false, routed: false, fled: false, hero: true,
        chargeT: 0, disengage: 0, r: mounted ? 9 : 7, onWall: false, swing: 0, hitFlash: 0,
      };
      (u as any).meleeSpeed = melee?.speed ?? 0.8;
      if (st.night) u.range *= 0.8;
      this.hero = u; this.units.push(u);
      if (h.equip.horse && !mounted && !st.siege) this.msg('你的骑术不足以驾驭这匹马，只能步战。');
    }
    // 同伴
    for (const c of S.companions) {
      if (c.wounded > 0) continue;
      const d = COMPANIONS.find(x => x.id === c.id)!;
      const mounted = d.mounted && !st.siege;
      const u: Unit = {
        uid: this.uidSeq++, side: 0, troop: null, comp: d.id, name: d.name, x: 230, y: BH / 2 + 30, vx: 0, vy: 0, face: 0,
        hp: d.hp, maxHp: d.hp, atk: d.atk, def: d.def, skill: d.skill, speed: mounted ? 170 : 88, mounted, cls: d.rng ? (mounted ? 'hca' : 'arc') : mounted ? 'cav' : 'inf',
        reach: 28, antiCav: false, rng: d.rng ?? 0, range: d.rng ? 260 : 0, reload: 1.8, ammo: d.rng ? 30 : 0, kind: d.rng ? (d.id === 'c_tang' ? 'gun' : 'bow') : null,
        cd: 0, rcd: 0, target: null, retarget: 0, group: mounted ? 'cav' : d.rng ? 'rng' : 'inf', dead: false, routed: false, fled: false, hero: false,
        chargeT: 0, disengage: 0, r: mounted ? 9 : 7, onWall: false, swing: 0, hitFlash: 0,
      };
      this.units.push(u);
    }
    for (const id of field0) this.units.push(this.makeUnit(0, id));
    for (const id of field1) this.units.push(this.makeUnit(1, id));
    this.formation(0); this.formation(1);
    for (const g of ['inf', 'rng', 'cav'] as Group[]) {
      const us = this.units.filter(u => u.side === 0 && u.group === g && !u.hero);
      const cx = us.length ? us.reduce((a, u) => a + u.x, 0) / us.length : 300;
      const cy = us.length ? us.reduce((a, u) => a + u.y, 0) / us.length : BH / 2;
      this.holdPos[g] = { x: cx, y: cy };
    }
    // 敌方：骑兵直接冲锋，步兵稍后
    const enemyRanged = this.units.filter(u => u.side === 1 && u.group === 'rng').length;
    const enemyTotal = this.units.filter(u => u.side === 1).length;
    this.enemyCharge = enemyRanged < enemyTotal * 0.4 && !st.siege;
  }

  formation(side: 0 | 1) {
    const st = this.setup;
    const us = this.units.filter(u => u.side === side && !u.hero);
    const dir = side === 0 ? 1 : -1;
    let baseX = side === 0 ? 330 : BW - 330;
    if (st.siege && side === 1) baseX = WALL_X + 120;
    if (st.siege && side === 0) baseX = 360;
    const cy = BH / 2;
    const byG: Record<Group, Unit[]> = { inf: [], rng: [], cav: [] };
    for (const u of us) byG[u.group].push(u);
    const place = (list: Unit[], x0: number, y0: number, cols: number, sp: number) => {
      list.forEach((u, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const rowCount = Math.min(cols, list.length - row * cols);
        u.x = x0 - row * sp * dir * 1.1; u.y = y0 + (col - (rowCount - 1) / 2) * sp;
        u.x += (Math.random() - 0.5) * 4; u.y += (Math.random() - 0.5) * 4;
      });
    };
    if (st.siege && side === 1) {
      // 弓弩铳手上城墙，步兵守城门
      byG.rng.forEach((u, i) => {
        const n = byG.rng.length;
        let y = 60 + (i / Math.max(1, n - 1)) * (BH - 120);
        if (y > GATE_Y0 - 20 && y < GATE_Y1 + 20) y = y < BH / 2 ? GATE_Y0 - 30 - (i % 3) * 14 : GATE_Y1 + 30 + (i % 3) * 14;
        u.x = WALL_X + 6; u.y = y; u.onWall = true;
      });
      place(byG.inf, WALL_X + 90, cy, 12, 16);
      place(byG.cav, WALL_X + 220, cy, 8, 22);
      return;
    }
    place(byG.inf, baseX, cy, 16, 16);
    place(byG.rng, baseX + 70 * dir, cy, 18, 16);
    const half = Math.ceil(byG.cav.length / 2);
    place(byG.cav.slice(0, half), baseX - 30 * dir, cy - 230, 6, 22);
    place(byG.cav.slice(half), baseX - 30 * dir, cy + 230, 6, 22);
    if (side === 0 && this.hero) { this.hero.x = baseX - 60; this.hero.y = cy; }
    if (side === 0) for (const u of this.units) if (u.comp) { u.x = baseX - 50; u.y = cy + (Math.random() - 0.5) * 80; }
  }

  // ---------- 指令 ----------
  select(g: Group | 'all') { this.selected = g; battleHud.refresh(); }
  order(o: Order) {
    const gs: Group[] = this.selected === 'all' ? ['inf', 'rng', 'cav'] : [this.selected];
    const ref = this.hero && !this.hero.dead ? this.hero : null;
    for (const g of gs) {
      this.orders[g] = o;
      if (o === 'hold') {
        const us = this.units.filter(u => u.side === 0 && u.group === g && !u.dead && !u.hero);
        if (ref) this.holdPos[g] = { x: ref.x + (g === 'rng' ? -30 : g === 'cav' ? -60 : 30), y: ref.y };
        else if (us.length) this.holdPos[g] = { x: us.reduce((a, u) => a + u.x, 0) / us.length, y: us.reduce((a, u) => a + u.y, 0) / us.length };
      }
    }
    const gname = this.selected === 'all' ? '全军' : { inf: '步兵', rng: '远程', cav: '骑兵' }[this.selected];
    this.msg(`${gname}：${{ hold: '原地坚守！', follow: '跟随我！', charge: '冲锋！' }[o]}`);
    if (o === 'charge') { sfx('horn', { vol: 0.55 }); sfx('crowd', { vol: 0.7, delay: 0.25 }); }
    else if (o === 'hold') { sfx('drum', { vol: 0.6 }); sfx('drum', { vol: 0.5, delay: 0.35 }); }
    else { sfx('smallDrum', { vol: 0.6 }); sfx('smallDrum', { vol: 0.6, delay: 0.16 }); sfx('smallDrum', { vol: 0.6, delay: 0.32 }); }
    battleHud.refresh();
  }
  toggleWeapon() {
    if (!this.hero || !this.hero.rng) { this.msg('你没有远程武器。'); return; }
    this.heroMode = this.heroMode === 'melee' ? 'ranged' : 'melee';
    this.refreshHeroSprite();
    battleHud.refresh();
  }

  msg(t: string) { battleHud.message(t); }

  // ---------- 更新 ----------
  update(_time: number, delta: number) {
    if (this.finished) { this.render(); return; }
    const dt = Math.min(delta, 50) / 1000;
    this.lastDt = dt;
    this.audioT -= dt;
    if (this.audioT <= 0 && !this.finished) { this.audioT = 0.4; this.updateAudio(); }
    this.elapsed += dt;
    if (!this.enemyCharge && this.elapsed > (this.setup.siege ? 9999 : 16)) this.enemyCharge = true;
    this.updateHero(dt);
    const grid = this.buildGrid();
    for (const u of this.units) if (!u.dead && !u.fled && u !== this.hero) this.updateUnit(u, dt, grid);
    this.separate(grid);
    this.updateProjs(dt, grid);
    this.updateMorale(dt);
    this.reinforce(dt);
    this.checkEnd();
    this.updateCamera(dt);
    this.render();
    battleHud.tick();
  }

  buildGrid() {
    const grid = new Map<number, Unit[]>();
    for (const u of this.units) {
      if (u.dead || u.fled) continue;
      const k = Math.floor(u.x / 40) * 1000 + Math.floor(u.y / 40);
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u);
    }
    return grid;
  }
  near(grid: Map<number, Unit[]>, x: number, y: number, r: number, fn: (u: Unit) => void) {
    const x0 = Math.floor((x - r) / 40), x1 = Math.floor((x + r) / 40), y0 = Math.floor((y - r) / 40), y1 = Math.floor((y + r) / 40);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const a = grid.get(gx * 1000 + gy); if (a) for (const u of a) fn(u); }
  }

  updateHero(dt: number) {
    const h = this.hero;
    if (!h || h.dead) return;
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
    if (h.mounted) {
      // 骑马：惯性
      const tvx = len ? (mx / len) * h.speed : 0, tvy = len ? (my / len) * h.speed : 0;
      const acc = len ? 2.2 : 1.6;
      h.vx += (tvx - h.vx) * Math.min(1, acc * dt); h.vy += (tvy - h.vy) * Math.min(1, acc * dt);
    } else {
      h.vx = len ? (mx / len) * h.speed : 0; h.vy = len ? (my / len) * h.speed : 0;
    }
    this.moveUnit(h, h.vx * dt, h.vy * dt);
    h.face = aim;
    h.cd -= dt; h.rcd -= dt; h.swing -= dt; h.hitFlash -= dt;
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
        // 扇形攻击
        const speedNow = Math.hypot(h.vx, h.vy);
        let hits = 0;
        for (const u of this.units) {
          if (u.side === 0 || u.dead || u.fled) continue;
          const d = Math.hypot(u.x - h.x, u.y - h.y);
          if (d > h.reach + u.r + 4) continue;
          let da = Math.abs(Math.atan2(u.y - h.y, u.x - h.x) - aim); if (da > Math.PI) da = Math.PI * 2 - da;
          if (da > 0.9) continue;
          const charge = h.mounted && speedNow > h.speed * 0.6 ? 1 + speedNow / h.speed * 0.6 : 1;
          this.damage(h, u, h.atk * charge * (h.antiCav && u.mounted ? 1.4 : 1), 0.95, true);
          if (++hits >= 2) break;
        }
      }
    }
  }

  moveUnit(u: Unit, dx: number, dy: number) {
    let nx = u.x + dx, ny = u.y + dy;
    nx = Math.max(8, Math.min(BW - 8, nx)); ny = Math.max(8, Math.min(BH - 8, ny));
    if (this.setup.siege && !u.onWall) {
      const crossing = (u.x < WALL_X - 12) !== (nx < WALL_X - 12) || (Math.abs(nx - WALL_X) < 14);
      if (crossing && (ny < GATE_Y0 + u.r || ny > GATE_Y1 - u.r)) {
        // 被城墙阻挡，沿墙滑动
        nx = u.x;
        if (Math.abs(nx - WALL_X) < 14) nx = u.x < WALL_X ? WALL_X - 15 : WALL_X + 15;
      }
    }
    u.x = nx; u.y = ny;
  }

  /** 攻城时若目标在墙的另一侧，先走向城门 */
  waypoint(u: Unit, tx: number, ty: number): [number, number] {
    if (!this.setup.siege || u.onWall) return [tx, ty];
    const sideU = u.x < WALL_X, sideT = tx < WALL_X;
    if (sideU === sideT) return [tx, ty];
    const gy = Math.max(GATE_Y0 + 20, Math.min(GATE_Y1 - 20, u.y));
    if (Math.abs(u.x - WALL_X) < 30 && u.y > GATE_Y0 + 8 && u.y < GATE_Y1 - 8) return [sideT ? WALL_X - 60 : WALL_X + 60, gy];
    return [sideU ? WALL_X - 20 : WALL_X + 20, (GATE_Y0 + GATE_Y1) / 2 + (u.uid % 7 - 3) * 12];
  }

  findTarget(u: Unit): Unit | null {
    let best: Unit | null = null, bd = Infinity;
    for (const o of this.units) {
      if (o.side === u.side || o.dead || o.fled || o.routed) continue;
      let d = Math.hypot(o.x - u.x, o.y - u.y);
      if (this.setup.siege && (o.x < WALL_X) !== (u.x < WALL_X) && !isRanged(u.cls)) d += Math.abs(o.y - (GATE_Y0 + GATE_Y1) / 2) * 1.5;
      if (o.hero) d *= 0.9;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  updateUnit(u: Unit, dt: number, grid: Map<number, Unit[]>) {
    u.cd -= dt; u.rcd -= dt; u.swing -= dt; u.hitFlash -= dt;
    if (u.routed) {
      const ex = u.side === 0 ? -20 : BW + 20;
      const [wx, wy] = this.waypoint(u, ex, u.y);
      const a = Math.atan2(wy - u.y, wx - u.x);
      u.face = a;
      this.moveUnit(u, Math.cos(a) * u.speed * 1.05 * dt, Math.sin(a) * u.speed * 1.05 * dt);
      if (u.x <= 10 || u.x >= BW - 10) { u.fled = true; }
      return;
    }
    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || u.target.dead || u.target.fled || u.target.routed) {
      u.target = this.findTarget(u); u.retarget = 0.4 + Math.random() * 0.4;
    }
    const t = u.target;
    // 当前指令
    let order: Order = 'charge';
    if (u.side === 0) order = this.orders[u.group];
    else order = this.enemyCharge || u.group === 'cav' ? 'charge' : 'hold';
    if (u.side === 1 && this.setup.siege) order = u.onWall ? 'hold' : (t && Math.hypot(t.x - u.x, t.y - u.y) < 260) ? 'charge' : 'hold';
    if (!t) { u.vx = u.vy = 0; return; }
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    const ranged = u.rng > 0 && u.ammo > 0;

    // 远程射击
    u.aiming = false;
    if (ranged && d < u.range && d > 45) {
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
        // 骑射手拉开距离
        const a = Math.atan2(u.y - t.y, u.x - t.x) + 0.6;
        this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, dt);
      } else if (u.cls === 'hca' && order === 'charge') {
        this.steer(u, t.x, t.y, dt, 0.5);
        if (d < 200) { u.vx *= 0.3; u.vy *= 0.3; }
      } else { u.vx *= 0.8; u.vy *= 0.8; }
      return;
    }

    // 近战
    const reach = u.reach + t.r;
    if (d < reach + 2 && u.disengage <= 0) {
      u.face = Math.atan2(t.y - u.y, t.x - u.x);
      if (u.cd <= 0) {
        const speedNow = Math.hypot(u.vx, u.vy);
        let dmg = u.atk;
        if (u.mounted && speedNow > u.speed * 0.55) dmg *= 1.7;
        if (u.antiCav && t.mounted) dmg *= 1.5;
        if (u.mounted && t.antiCav) { u.hp -= 2; }
        this.damage(u, t, dmg, 0.55 + (u.skill - t.skill) * 0.025);
        u.cd = (u.mounted ? 1.1 : 1.15) + Math.random() * 0.35;
        u.swing = SWING;
        if (u.mounted && u.cls === 'cav') u.disengage = 1.2 + Math.random() * 0.6;
      }
      if (!u.mounted) { u.vx *= 0.5; u.vy *= 0.5; return; }
    }
    if (u.disengage > 0) {
      u.disengage -= dt;
      const a = Math.atan2(u.vy, u.vx) || u.face;
      this.steer(u, u.x + Math.cos(a) * 120, u.y + Math.sin(a) * 120, dt);
      return;
    }
    // 移动
    if (order === 'charge') {
      this.steer(u, t.x, t.y, dt);
    } else if (order === 'follow' && this.hero && !this.hero.dead) {
      const hx = this.hero.x - Math.cos(this.hero.face) * (u.group === 'rng' ? 70 : u.group === 'cav' ? 110 : 40);
      const hy = this.hero.y - Math.sin(this.hero.face) * (u.group === 'rng' ? 70 : u.group === 'cav' ? 110 : 40);
      const off = ((u.uid % 13) - 6) * 12;
      const fx = hx + Math.cos(this.hero.face + Math.PI / 2) * off, fy = hy + Math.sin(this.hero.face + Math.PI / 2) * off;
      if (d < 70 && !ranged) this.steer(u, t.x, t.y, dt);
      else if (Math.hypot(fx - u.x, fy - u.y) > 18) this.steer(u, fx, fy, dt); else { u.vx *= 0.7; u.vy *= 0.7; }
    } else {
      // 坚守：敌人靠近时迎战
      const hp = u.side === 0 ? this.holdPos[u.group] : { x: u.x, y: u.y };
      const homeX = u.side === 0 ? hp.x + ((u.uid % 9) - 4) * 4 : u.x;
      const homeY = u.side === 0 ? hp.y + ((u.uid % 17) - 8) * 14 : u.y;
      if (d < (u.onWall ? 0 : 75)) this.steer(u, t.x, t.y, dt);
      else if (u.side === 0 && Math.hypot(homeX - u.x, homeY - u.y) > 25) this.steer(u, homeX, homeY, dt, 0.7);
      else { u.vx *= 0.7; u.vy *= 0.7; u.face = Math.atan2(t.y - u.y, t.x - u.x); }
    }
    void grid;
  }

  steer(u: Unit, tx: number, ty: number, dt: number, mult = 1) {
    [tx, ty] = this.waypoint(u, tx, ty);
    const a = Math.atan2(ty - u.y, tx - u.x);
    const sp = u.speed * mult;
    if (u.mounted) {
      u.vx += (Math.cos(a) * sp - u.vx) * Math.min(1, 2.5 * dt);
      u.vy += (Math.sin(a) * sp - u.vy) * Math.min(1, 2.5 * dt);
    } else { u.vx = Math.cos(a) * sp; u.vy = Math.sin(a) * sp; }
    u.face = Math.atan2(u.vy, u.vx);
    this.moveUnit(u, u.vx * dt, u.vy * dt);
  }

  separate(grid: Map<number, Unit[]>) {
    for (const u of this.units) {
      if (u.dead || u.fled || u.onWall) continue;
      this.near(grid, u.x, u.y, 20, o => {
        if (o === u || o.dead || o.onWall) return;
        const dx = u.x - o.x, dy = u.y - o.y;
        const md = u.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (md - d) * (u.hero ? 0.25 : 0.5) * (o.mounted && !u.mounted ? 1.4 : 1);
          this.moveUnit(u, (dx / d) * push, (dy / d) * push);
        }
      });
    }
  }

  fire(u: Unit, a: number, dist = 200) {
    const sp = u.kind === 'gun' ? 900 : u.kind === 'xbow' ? 620 : 520;
    const z0 = 14 + (u.mounted ? 10 : 0) + this.liftOf(u);
    this.snd(u.kind === 'gun' ? 'gun' : u.kind === 'xbow' ? 'xbow' : 'bow', u.x, u.y, u.hero ? 1.2 : u.kind === 'gun' ? 0.8 : 0.6);
    this.projs.push({ x: u.x + Math.cos(a) * 10, y: u.y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: u.rng, side: u.side, life: (u.range * 1.25) / sp, kind: u.kind ?? 'bow', from: u, sx: u.x, sy: u.y, dist: Math.max(40, Math.min(dist, u.range * 1.1)), z0 });
    if (u.kind === 'gun') {
      const mx = u.x + Math.cos(a) * 16, my = u.y + Math.sin(a) * 16;
      for (let i = 0; i < 4; i++) this.parts.push({ x: mx + Math.cos(a) * i * 4, y: my + Math.sin(a) * i * 4, z: z0, vx: Math.cos(a) * (20 + i * 10) + (Math.random() - 0.5) * 10, vy: Math.sin(a) * (20 + i * 10), vz: 6 + Math.random() * 6, life: 0, max: 1.6 + Math.random() * 0.8, kind: 'smoke', size: 4 + i * 1.5 });
      this.parts.push({ x: mx, y: my, z: z0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.08, kind: 'spark', size: 7 });
    }
  }

  updateProjs(dt: number, grid: Map<number, Unit[]>) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      const steps = p.kind === 'gun' ? 3 : 2;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        p.x += (p.vx * dt) / steps; p.y += (p.vy * dt) / steps;
        this.near(grid, p.x, p.y, 12, u => {
          if (hit || u.side === p.side || u.dead || u.fled) return;
          if (Math.hypot(u.x - p.x, u.y - p.y) < u.r + 2) {
            if (u.onWall && Math.random() < 0.5) { hit = true; return; } // 垛口掩护
            hit = true;
            const ap = p.kind === 'gun' ? 0.2 : p.kind === 'xbow' ? 0.35 : 0.5;
            this.damage(p.from, u, p.dmg * (0.85 + Math.random() * 0.3), 1, false, ap, p.kind === 'gun' ? 'bullet' : 'arrow');
          }
        });
      }
      p.life -= dt;
      if (!hit && p.kind !== 'gun' && Math.hypot(p.x - p.sx, p.y - p.sy) > p.dist * 1.08) {
        // 落地的箭
        if (this.stamps < 2500) {
          const a = Math.atan2(p.vy, p.vx); const s = this.stamp; s.clear();
          s.lineStyle(1, 0x3a2414, 0.9); s.lineBetween(0, 0, -Math.cos(a) * 6, -Math.sin(a) * 6 - 3);
          s.fillStyle(0xe8e0d0, 0.9); s.fillRect(-Math.cos(a) * 6 - 1, -Math.sin(a) * 6 - 4, 2, 1.5);
          try { this.ground?.draw(s, p.x, p.y); } catch { /* */ } this.stamps++;
        }
        if (Math.random() < 0.3) this.snd('arrowGround', p.x, p.y, 0.5);
        this.projs.splice(i, 1); continue;
      }
      if (hit || p.life <= 0 || p.x < 0 || p.x > BW || p.y < 0 || p.y > BH) this.projs.splice(i, 1);
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) { this.smoke[i].t += dt; if (this.smoke[i].t > 1.4) this.smoke.splice(i, 1); }
  }

  damage(a: Unit, t: Unit, raw: number, hitChance: number, heroAttack = false, armorFactor = 0.45, src: 'melee' | 'arrow' | 'bullet' = 'melee') {
    const loud = a.hero || t.hero ? 1.4 : 0.75;
    if (Math.random() > Math.max(0.15, Math.min(0.95, hitChance))) {
      if (src === 'melee') this.snd(t.def > 10 && Math.random() < 0.6 ? 'clash' : 'block', t.x, t.y, loud * 0.8);
      else if (src === 'arrow') this.snd('block', t.x, t.y, 0.4);
      return;
    }
    if (src === 'melee') this.snd(t.def >= 14 ? (Math.random() < 0.5 ? 'clash' : 'armor') : (Math.random() < 0.3 ? 'clash' : 'hit'), t.x, t.y, loud);
    else if (src === 'arrow') this.snd(t.def >= 14 ? 'armor' : 'arrowHit', t.x, t.y, loud * 0.8);
    else this.snd('hit', t.x, t.y, loud);
    const dmg = Math.max(2, raw * (0.8 + Math.random() * 0.4) - t.def * armorFactor);
    t.hp -= dmg; t.hitFlash = 0.12;
    this.blood(t.x, t.y - this.liftOf(t), dmg > 15 ? 4 : 2);
    if (t.hero) this.cameras.main.shake(90, 0.003);
    if (t.mounted && !t.hero) { t.vx *= 0.6; t.vy *= 0.6; }
    if (heroAttack || a.hero) this.floater(t.x, t.y - 12, String(Math.round(dmg)), '#ffe9a0');
    if (t.hero) this.floater(t.x, t.y - 14, `-${Math.round(dmg)}`, '#ff6050');
    if (t.hp <= 0) this.kill(t, a);
  }

  floater(x: number, y: number, txt: string, color: string) {
    if (this.floaters.length > 30) return;
    const tx = this.add.text(x, y, txt, { fontFamily: 'sans-serif', fontSize: '13px', color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold' }).setOrigin(0.5).setDepth(20);
    this.floaters.push(tx);
    this.tweens.add({ targets: tx, y: y - 26, alpha: 0, duration: 800, onComplete: () => { tx.destroy(); this.floaters.splice(this.floaters.indexOf(tx), 1); } });
  }

  kill(u: Unit, by: Unit) {
    u.dead = true; u.hp = 0;
    if (Math.random() < 0.5 || u.hero || u.comp) this.snd('death', u.x, u.y, u.hero || u.comp ? 1.3 : 0.8);
    this.snd('fall', u.x, u.y, 0.6);
    if (u.mounted && Math.random() < 0.35) this.snd('neigh', u.x, u.y, 0.6);
    const sd = this.down[u.side];
    if (u.troop) sd[u.troop] = (sd[u.troop] || 0) + 1;
    if (u.comp) { this.compDown.push(u.comp); this.msg(`${u.name}负伤倒地！`); }
    if (u.hero) { this.heroDown = true; this.msg('你被击倒了！部下们继续作战……'); battleHud.refresh(); }
    if (by.hero && u.troop) this.msg(`你击倒了${u.name}。`);
    // 地面痕迹：血迹 + 尸体
    const s = this.stamp;
    s.clear();
    s.fillStyle(0x5a1208, 0.55); s.fillEllipse(0, 0, u.mounted ? 20 : 13, u.mounted ? 9 : 6);
    s.fillStyle(0x7a1a0e, 0.4); s.fillEllipse(-4, 2, 7, 3.5);
    try { this.ground?.draw(s, u.x - 6, u.y - this.liftOf(u)); } catch { /* */ }
    this.stampCorpse(u);
    u.spr?.destroy(); u.spr = null;
    if (u.banner) { u.banner.destroy(); u.banner = null; }
    if (u.mounted && !u.hero) {
      // 无主战马跑开
      this.parts.push({ x: u.x, y: u.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.6, kind: 'dust', size: 8 });
    }
  }

  sideMorale(side: 0 | 1) {
    const init = this.initial[side];
    let lost = 0; for (const k in this.down[side]) lost += this.down[side][k];
    if (side === 0) lost += this.compDown.length + (this.heroDown ? 3 : 0);
    let m = 100 - (lost / Math.max(1, init)) * 140;
    if (side === 0) m += (S.morale - 50) * 0.4 + S.hero.skills.leadership * 3;
    if (side === 1 && this.setup.enemyFaction === 'bandit') m -= 10;
    return m;
  }

  updateMorale(dt: number) {
    for (const side of [0, 1] as const) {
      const m = this.sideMorale(side);
      if (m > 40) continue;
      for (const u of this.units) {
        if (u.side !== side || u.dead || u.routed || u.hero || u.comp) continue;
        const p = (m < 10 ? 0.25 : m < 25 ? 0.06 : 0.015) * (u.hp / u.maxHp < 0.5 ? 2 : 1) * dt;
        if (Math.random() < p) { u.routed = true; u.target = null; }
      }
    }
  }

  reinforce(dt: number) {
    this.reinforceT -= dt;
    if (this.reinforceT > 0) return;
    this.reinforceT = 2.5;
    for (const side of [0, 1] as const) {
      const res = this.reserves[side];
      if (!res.length) continue;
      const alive = this.units.filter(u => u.side === side && !u.dead && !u.fled).length;
      if (alive >= MAX_FIELD * 0.8) continue;
      const n = Math.min(12, MAX_FIELD - alive);
      let spawned = 0;
      for (let i = 0; i < n && res.length; i++) {
        const st = res[0];
        const u = this.makeUnit(side, st.id);
        u.x = side === 0 ? 20 + Math.random() * 30 : BW - 20 - Math.random() * 30;
        u.y = BH / 2 + (Math.random() - 0.5) * 400;
        if (this.setup.siege && side === 1) u.x = BW - 60;
        this.units.push(u);
        this.spawnSprite(u);
        st.n--; if (st.n <= 0) res.shift();
        spawned++;
      }
      if (spawned) this.msg(side === 0 ? `我军 ${spawned} 名援兵赶到。` : `敌军 ${spawned} 名援兵赶到！`);
    }
  }

  activeCount(side: 0 | 1) {
    let n = 0;
    for (const u of this.units) if (u.side === side && !u.dead && !u.routed && !u.fled) n++;
    for (const s of this.reserves[side]) n += s.n;
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
    const out: Outcome = {
      win, ourDown: { ...this.down[0] }, enemyDown: { ...this.down[1] }, heroDown: this.heroDown, compDown: [...this.compDown], retreat, manual: true,
    };
    if (win) {
      // 溃逃的敌人部分被俘/击倒
      for (const u of this.units) if (u.side === 1 && !u.dead && u.troop && Math.random() < 0.3) out.enemyDown[u.troop] = (out.enemyDown[u.troop] || 0) + 1;
    }
    if (retreat) {
      for (const u of this.units) if (u.side === 0 && !u.dead && !u.fled && u.troop && Math.random() < 0.15) out.ourDown[u.troop] = (out.ourDown[u.troop] || 0) + 1;
    }
    if (this.hero && !this.hero.dead) S.hero.hp = Math.max(0.05, this.hero.hp / this.hero.maxHp);
    music.play('off'); music.ambience('none');
    sfx(win ? 'victory' : 'defeat', { vol: 0.9 });
    battleHud.showEnd(win, retreat, () => this.exit(out));
  }

  /** 以自动结算完成剩余战斗 */
  autoFinish() {
    if (this.finished) return;
    const toStacksAlive = (side: 0 | 1) => {
      const ids: string[] = [];
      for (const u of this.units) if (u.side === side && !u.dead && !u.fled && u.troop) ids.push(u.troop);
      const st = toStacks(ids);
      for (const r of this.reserves[side]) { const e = st.find(x => x.id === r.id); if (e) e.n += r.n; else st.push({ ...r }); }
      return st;
    };
    const a = toStacksAlive(0), b = toStacksAlive(1);
    let extra = 0;
    for (const u of this.units) if (u.side === 0 && !u.dead && !u.troop) extra += (u.maxHp / 10) * ((u.atk + u.skill * 0.6) / 10) * (1 + u.def / 25);
    const r = autoResolve(a, b, 1, this.setup.siege ? 1.4 : 1, extra, 0);
    for (const k in r.aDown) this.down[0][k] = (this.down[0][k] || 0) + r.aDown[k];
    for (const k in r.bDown) this.down[1][k] = (this.down[1][k] || 0) + r.bDown[k];
    this.finish(r.aWin);
  }

  retreat() { this.finish(false, true); }

  exit(out: Outcome) {
    battleHud.close();
    this.scene.stop();
    this.scene.wake('World');
    this.setup.onEnd(out);
  }

  updateCamera(dt: number) {
    const cam = this.cameras.main;
    if (this.hero && !this.hero.dead) {
      cam.scrollX += (this.hero.x - cam.width / 2 - cam.scrollX) * Math.min(1, 6 * dt);
      cam.scrollY += (this.hero.y - cam.height / 2 - cam.scrollY) * Math.min(1, 6 * dt);
    } else {
      const k = this.keys; const sp = 500 * dt / cam.zoom;
      if (k.W.isDown || k.UP.isDown) cam.scrollY -= sp;
      if (k.S.isDown || k.DOWN.isDown) cam.scrollY += sp;
      if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= sp;
      if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += sp;
    }
  }

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
  render() {
    const g = this.g, gp = this.gProj, gu = this.gUnder, gt = this.gTop;
    g.clear(); gp.clear(); gu.clear(); gt.clear();
    const dt = this.finished ? 0 : this.lastDt;
    const now = this.time.now;
    for (const u of this.units) {
      const spr = u.spr;
      if (!spr) continue;
      if (u.dead || u.fled) { spr.setVisible(false); u.banner?.setVisible(false); continue; }
      const lift = this.liftOf(u);
      const sp = Math.hypot(u.vx, u.vy);
      let f: number = FR.idle;
      u.firedT = Math.max(0, (u.firedT ?? 0) - dt);
      if (u.swing > 0) { const prog = 1 - u.swing / SWING; f = FR.atk0 + Math.min(2, Math.floor(prog * 3)); }
      else if ((u.firedT ?? 0) > 0) f = FR.release;
      else if (u.hero ? (this.heroMode === 'ranged' && u.rng > 0 && sp < 10) : u.aiming) f = FR.aim;
      else if (sp > 6) { u.walkT = (u.walkT ?? 0) + sp * dt; f = FR.walk0 + Math.floor(u.walkT / (u.mounted ? 11 : 7)) % 4; }
      const flip = Math.cos(u.face) < 0;
      spr.setPosition(u.x, u.y - lift).setFrame(f).setFlipX(flip).setDepth(lift ? 11.2 + u.y / 1e5 : 10 + u.y / 1000);
      if (u.hitFlash > 0) spr.setTintFill(0xffffff); else if (u.routed) spr.setTint(0xb0b0b0); else spr.clearTint();
      // 脚下阵营标记
      gu.fillStyle(this.colors[u.side], u.hero ? 0 : 0.28); gu.fillEllipse(u.x, u.y - lift + 0.5, u.mounted ? 22 : 12, u.mounted ? 7 : 4.5);
      if (u.hero || u.comp) {
        gu.lineStyle(1.6, u.hero ? 0xffe070 : 0x8fd8ff, 0.95); gu.strokeEllipse(u.x, u.y - lift + 0.5, u.mounted ? 30 : 18, u.mounted ? 10 : 7);
        const w = 22, top = u.y - lift - (u.mounted ? 46 : 34);
        gt.fillStyle(0x000000, 0.6); gt.fillRect(u.x - w / 2 - 1, top - 1, w + 2, 5);
        gt.fillStyle(u.hero ? 0x40e060 : 0x60c0ff, 1); gt.fillRect(u.x - w / 2, top, w * Math.max(0, u.hp / u.maxHp), 3);
      }
      // 骑兵扬尘
      if (u.mounted && sp > 80 && dt > 0) {
        u.dustT = (u.dustT ?? 0) - dt;
        if (u.dustT <= 0 && this.parts.length < 400) { u.dustT = 0.12; this.parts.push({ x: u.x - Math.cos(u.face) * 10, y: u.y + 1, z: 1, vx: -u.vx * 0.1, vy: -u.vy * 0.1, vz: 8, life: 0, max: 0.9, kind: 'dust', size: 3 + Math.random() * 2 }); }
      }
      if (u.banner) {
        const dir = flip ? -1 : 1;
        u.banner.setPosition(u.x - dir * 5, u.y - lift - 2).setFlipX(!flip).setDepth(10 + u.y / 1000 - 0.00001).setFrame(Math.floor(now / 130 + u.uid) % 4).setVisible(true);
      }
    }
    // 树木：遮挡主角时半透明
    const focus = this.hero && !this.hero.dead ? this.hero : null;
    for (const p of this.props) {
      if (!p.tree) continue;
      let a = 1;
      if (focus && Math.abs(focus.x - p.x) < p.w * 0.45 && focus.y < p.y - 2 && focus.y > p.y - p.h * 0.95) a = 0.4;
      if (p.spr.alpha !== a) p.spr.setAlpha(a);
    }
    // 粒子
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life += dt;
      if (q.life >= q.max) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = q.life / q.max;
      if (q.kind === 'blood') {
        q.vz -= 320 * dt;
        if (q.z <= 0) {
          if (this.stamps < 2500 && Math.random() < 0.5) { const s = this.stamp; s.clear(); s.fillStyle(0x6a140a, 0.7); s.fillCircle(0, 0, q.size * 0.9); try { this.ground?.draw(s, q.x, q.y); } catch { /* */ } this.stamps++; }
          this.parts.splice(i, 1); continue;
        }
        gp.fillStyle(0xa01810, 0.95); gp.fillRect(q.x - q.size / 2, q.y - q.z - q.size / 2, q.size, q.size);
      } else if (q.kind === 'dust') {
        q.vx *= 0.96; q.vy *= 0.96;
        g.fillStyle(0xc8b48a, 0.35 * (1 - t)); g.fillCircle(q.x, q.y - q.z, q.size * (1 + t * 2.2));
      } else if (q.kind === 'smoke') {
        q.vx *= 0.97; q.vy *= 0.97;
        gp.fillStyle(0xe8e4dc, 0.32 * (1 - t) * (1 - t)); gp.fillCircle(q.x + t * 6, q.y - q.z - t * 8, q.size * (0.8 + t * 1.8));
      } else {
        gp.fillStyle(0xfff0a0, 0.9 * (1 - t)); gp.fillCircle(q.x, q.y - q.z, q.size * (1 - t * 0.5));
        gp.fillStyle(0xff8a20, 0.5 * (1 - t)); gp.fillCircle(q.x, q.y - q.z, q.size * 1.8);
      }
    }
    // 投射物（带抛物线高度与地面投影）
    for (const p of this.projs) {
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
    // 主角瞄准
    if (this.hero && !this.hero.dead && !this.finished) {
      const h = this.hero;
      if (this.heroMode === 'ranged') {
        gp.lineStyle(1, 0xffffff, 0.25); gp.lineBetween(h.x, h.y, h.x + Math.cos(h.face) * Math.min(h.range, 250), h.y + Math.sin(h.face) * Math.min(h.range, 250));
        if (h.rcd > 0) { gt.lineStyle(2, 0xffe9a0, 0.8); gt.beginPath(); gt.arc(h.x, h.y - 22, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - h.rcd / h.reload)); gt.strokePath(); }
      } else {
        gu.lineStyle(1, 0xffffff, 0.22); gu.beginPath(); gu.arc(h.x, h.y, h.reach + 6, h.face - 0.9, h.face + 0.9); gu.strokePath();
      }
    }
    // 坚守位置标记
    for (const gname of ['inf', 'rng', 'cav'] as Group[]) {
      if (this.orders[gname] !== 'hold') continue;
      const hp = this.holdPos[gname];
      gu.lineStyle(1.5, this.colors[0], 0.5); gu.strokeEllipse(hp.x, hp.y, 26, 10);
    }
  }
}

function toStacks(ids: string[]): Stack[] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) || 0) + 1);
  return [...m.entries()].map(([id, n]) => ({ id, n, w: 0, xp: 0 }));
}
