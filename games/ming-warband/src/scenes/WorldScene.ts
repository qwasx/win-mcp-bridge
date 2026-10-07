// 大地图场景
import Phaser from 'phaser';
import { renderMapCanvas, WORLD_W, WORLD_H, terAtXY, TER_NAME } from '../core/terrain';
import { S, player, isNight, hostile, on, playerHostileToSettlement, lordName, partyById } from '../core/game';
import { nav, setPlayerTarget, simulate } from '../core/sim';
import { FACTION } from '../data/world';
import { count, describeSize, partyStrength } from '../core/party';
import { sightRange } from '../core/character';
import type { Party, Settlement } from '../core/state';
import { panelOpen } from '../ui/dom';
import { openSettlement, openEncounter, hud, showTooltip, hideTooltip } from '../ui/index';
import { dist } from '../core/rng';
import { worldVisuals } from '../art/worldBuild';
import { RES } from '../art/figures';
import { MRES } from '../art/mapArt';
import { troopSpec, SPEC_PEASANT } from '../art/specs';
import type { FigureSpec } from '../art/figures';
import { ensureFigure, ensureBanner, ensureCart, settlementAtlas, ensureClouds, currentHeroSpec, FACTION_CHAR, type SheetInfo } from '../art/phaserTex';
import { TROOPS } from '../data/troops';
import { worldAudioTick, music } from '../audio/hooks';
import { WorldLife } from './worldLife';
import { minimap } from '../ui/minimap';
import { weatherAt, seasonOf } from '../core/weather';
import { weatherFx } from '../art/weatherFx';

const MAP_FIG = 0.74; // 大地图人物缩放
const ELITE_CAV: Record<string, string> = { ming: 'ming_guanning', jin: 'jin_bayara', chuang: 'chuang_elite', xi: 'xi_lancer', mon: 'mon_heavy' };
const FOOT_OF: Record<string, string> = { ming: 'ming_soldier', jin: 'jin_foot', chuang: 'chuang_rebel', xi: 'xi_soldier', mon: 'mon_rider' };

interface PVis {
  look: string;
  main: Phaser.GameObjects.Sprite;
  extras: Phaser.GameObjects.Sprite[];
  banner: Phaser.GameObjects.Sprite | null;
  lx: number; ly: number; flip: boolean; moving: number; phase: number;
}

const FONT = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
export let worldScene: WorldScene | null = null;
let mapKey = '';

function shadeHex(c: number, k: number) { const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255); }

export class WorldScene extends Phaser.Scene {
  gStatic!: Phaser.GameObjects.Graphics;
  gParties!: Phaser.GameObjects.Graphics;
  gFx!: Phaser.GameObjects.Graphics;
  labels = new Map<string, Phaser.GameObjects.Text>();
  partyLabels: Phaser.GameObjects.Text[] = [];
  drag = { down: false, sx: 0, sy: 0, moved: false, camX: 0, camY: 0 };
  follow = true;
  staticDirty = true;
  lastStatic = 0;
  hover: { kind: 'settlement'; s: Settlement } | { kind: 'party'; p: Party } | null = null;
  sIcons = new Map<string, { img: Phaser.GameObjects.Image; flag: Phaser.GameObjects.Sprite | null; frame: string; fkey: string }>();
  pvis = new Map<number, PVis>();
  clouds: Phaser.GameObjects.Image[] = [];
  life!: WorldLife;
  lastScroll = { x: 0, y: 0 };

  constructor() { super('World'); }

  create() {
    worldScene = this;
    this.labels = new Map(); this.partyLabels = []; (this as any)._keys = null; this.staticDirty = true; this.follow = true;
    this.sIcons = new Map(); this.pvis = new Map(); this.clouds = [];
    const vis = worldVisuals(Object.values(S.settlements), `${S.seed}`);
    const key = 'map_' + S.seed;
    if (mapKey && mapKey !== key && this.textures.exists(mapKey)) this.textures.remove(mapKey);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, vis.full);
    mapKey = key;
    this.add.image(0, 0, key).setOrigin(0).setScale(WORLD_W / vis.full.width).setDepth(0);
    try {
      minimap.mount(vis.full, (x, y) => { this.cameras.main.centerOn(x, y); this.follow = false; this.staticDirty = true; });
      this.events.on('sleep', () => minimap.hide());
      this.events.on('wake', () => minimap.show());
      this.events.once('shutdown', () => minimap.hide());
    } catch { /* 小地图失败不影响游戏 */ }
    this.gStatic = this.add.graphics().setDepth(2);
    this.buildSettlementIcons();
    this.gFx = this.add.graphics().setDepth(4);
    this.gParties = this.add.graphics().setDepth(4.5);
    this.buildClouds();
    this.life = new WorldLife(this);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.setZoom(1.1);
    cam.setBackgroundColor('#5b8b94');
    for (let i = 0; i < 40; i++) {
      this.partyLabels.push(this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(20).setVisible(false));
    }
    this.buildLabels();

    this.input.on('wheel', (_p: any, _o: any, _dx: number, dy: number) => {
      if (panelOpen()) return;
      const z = Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.88 : 1.14), 0.45, 3);
      cam.setZoom(z);
      this.staticDirty = true;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (panelOpen()) return;
      this.drag = { down: true, sx: p.x, sy: p.y, moved: false, camX: cam.scrollX, camY: cam.scrollY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag.down && p.isDown) {
        const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) { this.drag.moved = true; this.follow = false; }
        if (this.drag.moved) { cam.scrollX = this.drag.camX - dx / cam.zoom; cam.scrollY = this.drag.camY - dy / cam.zoom; }
      }
      this.updateHover(p);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.drag.down) return;
      this.drag.down = false;
      if (this.drag.moved || panelOpen()) return;
      if (p.rightButtonReleased()) return;
      this.clickWorld(p.worldX, p.worldY);
    });
    this.input.mouse?.disableContextMenu();
    this.game.canvas.addEventListener('mouseleave', () => hideTooltip());
    on('ownerChanged', () => { this.staticDirty = true; });
    on('daily', () => { this.staticDirty = true; });
    this.scale.on('resize', () => this.staticDirty = true);
    this.centerOnPlayer();
  }

  centerOnPlayer() { const pp = player(); this.cameras.main.centerOn(pp.x, pp.y); this.follow = true; }

  buildLabels() {
    for (const t of this.labels.values()) t.destroy();
    this.labels.clear();
    for (const s of Object.values(S.settlements)) {
      const size = s.kind === 'town' ? 15 : s.kind === 'castle' ? 13 : 11;
      const t = this.add.text(s.x, s.y + (s.kind === 'town' ? 15 : s.kind === 'castle' ? 13 : 8), s.name, {
        fontFamily: FONT, fontSize: `${size}px`, color: '#fff8e6', stroke: '#2a1a0e', strokeThickness: s.kind === 'village' ? 2.5 : 3.5, resolution: 2,
        fontStyle: s.kind === 'town' ? 'bold' : 'normal',
      }).setOrigin(0.5, 0).setDepth(10);
      this.labels.set(s.id, t);
    }
  }

  clickWorld(x: number, y: number) {
    const z = this.cameras.main.zoom;
    const r = 14 / Math.min(z, 1.5);
    // 部队优先（可见的）
    let bestP: Party | null = null, bd = r;
    for (const p of S.parties) {
      if (p.kind === 'player' || p.inside || !this.visible(p)) continue;
      const d = dist(x, y, p.x, p.y - 6); if (d < bd) { bd = d; bestP = p; }
    }
    if (bestP) { setPlayerTarget({ kind: 'party', id: bestP.id }); this.follow = true; return; }
    let bestS: Settlement | null = null; bd = 1;
    for (const s of Object.values(S.settlements)) { const d = dist(x, y, s.x, s.y - (s.kind === 'town' ? 6 : 2)) / Math.max(r * 1.2, s.kind === 'town' ? 26 : s.kind === 'castle' ? 18 : 12); if (d < bd) { bd = d; bestS = s; } }
    if (bestS) {
      const pp = player();
      if (dist(pp.x, pp.y, bestS.x, bestS.y) < 12) { openSettlement(bestS); return; }
      setPlayerTarget({ kind: 'settlement', id: bestS.id }); this.follow = true; return;
    }
    setPlayerTarget({ kind: 'point', x, y });
    this.follow = true;
  }

  visible(p: Party) {
    if (p.kind === 'player') return true;
    const pp = player();
    return dist(pp.x, pp.y, p.x, p.y) < sightRange(S, isNight());
  }

  updateHover(p: Phaser.Input.Pointer) {
    if (panelOpen()) { hideTooltip(); return; }
    const cam = this.cameras.main;
    const wp = cam.getWorldPoint(p.x, p.y);
    const r = 12 / Math.min(cam.zoom, 1.5);
    let found: WorldScene['hover'] = null, bd = r;
    for (const q of S.parties) {
      if (q.inside || !this.visible(q)) continue;
      const d = dist(wp.x, wp.y, q.x, q.y - 6); if (d < bd) { bd = d; found = { kind: 'party', p: q }; }
    }
    if (!found) { let sb = 1; for (const s of Object.values(S.settlements)) { const d = dist(wp.x, wp.y, s.x, s.y - (s.kind === 'town' ? 6 : 2)) / Math.max(r * 1.3, s.kind === 'town' ? 26 : s.kind === 'castle' ? 18 : 12); if (d < sb) { sb = d; found = { kind: 'settlement', s }; } } }
    this.hover = found;
    if (!found) { const t = terAtXY(wp.x, wp.y); showTooltip(p.event as MouseEvent, `<b>${TER_NAME[t]}</b>`); return; }
    if (found.kind === 'party') {
      const q = found.p;
      const n = count(q.troops) + (q.kind === 'player' ? 1 + S.companions.length : 0);
      const f = FACTION[q.faction];
      const host = q.kind !== 'player' && hostile(player(), q);
      const ratio = q.kind === 'player' ? 1 : partyStrength(S, q) / Math.max(1, partyStrength(S, player()));
      const threat = q.kind === 'player' ? '' : ratio > 1.5 ? '<span class="bad">远强于我</span>' : ratio > 0.9 ? '<span class="warn">势均力敌</span>' : '<span class="good">弱于我</span>';
      const mode = q.ai.mode === 'siege' ? '正在攻城' : q.ai.mode === 'raid' ? '正在劫掠' : q.ai.mode === 'chase' ? (q.ai.target === S.playerId ? '<span class="bad">正在追击你！</span>' : '正在追击') : q.ai.mode === 'flee' ? '正在撤退' : '';
      showTooltip(p.event as MouseEvent, `<b style="color:${f.css}">${q.kind === 'player' ? S.hero.name + '（你）' : q.name}</b><br>${q.kind === 'lord' ? `${S.lords[q.lordId!].title} · ` : ''}${f.name}<br>${describeSize(n)}：${n} 人 ${threat}<br>${host ? '<span class="bad">敌对</span>' : q.kind === 'player' ? '' : '<span class="good">非敌对</span>'} ${mode}`);
    } else {
      const s = found.s;
      const f = FACTION[s.faction];
      const kind = s.kind === 'town' ? '城镇' : s.kind === 'castle' ? '城堡' : '村庄';
      const parent = s.parent ? `隶属：${S.settlements[s.parent].name}<br>` : '';
      const gar = s.kind !== 'village' ? `守军：约 ${Math.round(count(s.garrison) / 10) * 10} 人<br>` : '';
      const extra = s.siege ? '<span class="bad">被围攻中</span><br>' : s.lootedUntil > S.time ? '<span class="bad">已被洗劫</span><br>' : '';
      showTooltip(p.event as MouseEvent, `<b style="color:${f.css}">${s.name}</b> <small>${kind}</small><br>${f.name} · ${lordName(s.owner)}<br>${parent}${gar}繁荣：${Math.round(s.prosperity)}<br>${extra}${playerHostileToSettlement(s) ? '<span class="bad">敌对</span>' : ''}`);
    }
  }

  buildSettlementIcons() {
    const frames = settlementAtlas(this);
    for (const s of Object.values(S.settlements)) {
      const fname = this.settFrame(s);
      const f = frames.get(fname)!;
      const img = this.add.image(s.x, s.y, 'setts', fname).setOrigin(f.ax, f.ay).setScale(1 / MRES).setDepth(3 + s.y / 1e5);
      this.sIcons.set(s.id, { img, flag: null, frame: fname, fkey: '' });
    }
  }
  settFrame(s: Settlement) {
    if (s.kind === 'village') return s.lootedUntil > S.time ? 'village_looted' : 'village';
    if (s.kind === 'castle') return 'castle';
    return (s.id === 'beijing' || s.id === 'shengjing' || s.id === FACTION[s.faction]?.capital) ? 'capital' : 'town';
  }

  buildClouds() {
    ensureClouds(this);
    for (let i = 0; i < 7; i++) {
      const c = this.add.image(Math.random() * WORLD_W, Math.random() * WORLD_H, 'cloud' + (i % 3)).setDepth(25).setScale(1.6 + Math.random() * 1.4).setAlpha(0);
      this.clouds.push(c);
    }
  }

  drawStatic() {
    const g = this.gStatic;
    g.clear();
    const z = this.cameras.main.zoom;
    const frames = settlementAtlas(this);
    for (const s of Object.values(S.settlements)) {
      const lbl = this.labels.get(s.id)!;
      lbl.setVisible(s.kind !== 'village' || z > 0.75);
      lbl.setColor(s.owner === 'player' ? '#ffe28a' : '#fff8e6');
      const ic = this.sIcons.get(s.id);
      if (ic) {
        const fname = this.settFrame(s);
        if (fname !== ic.frame) { const f = frames.get(fname)!; ic.img.setFrame(fname).setOrigin(f.ax, f.ay); ic.frame = fname; }
        if (s.kind !== 'village') {
          const fac = FACTION[s.faction] ?? FACTION['none'];
          const ch = s.faction === 'player' ? (S.hero.name[0] ?? '义') : FACTION_CHAR[s.faction] ?? '';
          const bi = ensureBanner(this, fac.color, ch, false);
          if (ic.fkey !== bi.key) {
            ic.flag?.destroy();
            const fx = s.kind === 'town' ? s.x + (this.settFrame(s) === 'capital' ? 25 : 21) : s.x + 9;
            const fy = s.kind === 'town' ? s.y + 4 : s.y - 2;
            ic.flag = this.add.sprite(fx, fy, bi.key, 0).setOrigin(bi.ax, bi.ay).setScale(0.55 / 3).setDepth(3.5 + s.y / 1e5);
            ic.fkey = bi.key;
          }
        }
      }
      if (s.owner === 'player') {
        g.lineStyle(2, 0xffd700, 0.9);
        const r = s.kind === 'town' ? 30 : s.kind === 'castle' ? 20 : 13;
        g.strokeEllipse(s.x, s.y + 2, r * 2, r * 1.3);
      }
    }
  }

  // ---------- 部队外观 ----------
  partyLook(p: Party): { key: string; main: FigureSpec | 'cart'; extras: FigureSpec[]; banner: { color: number; ch: string } | null } {
    const f = FACTION[p.faction] ?? FACTION['none'];
    const n = count(p.troops);
    if (p.kind === 'player') {
      const mounted = !!S.hero.equip.horse;
      const spec = currentHeroSpec(mounted);
      const extras: FigureSpec[] = [];
      const top = [...p.troops].sort((a, b) => b.n - a.n)[0];
      if (top && n >= 5) extras.push(troopSpec(top.id, 0xd4af37));
      if (top && n >= 40) extras.push(troopSpec(top.id, 0xd4af37));
      const col = S.playerFaction ? (FACTION[S.playerFaction]?.color ?? 0xd4af37) : 0xd4af37;
      return { key: JSON.stringify(['P', spec, extras.length, col, S.hero.name[0]]), main: spec, extras, banner: n >= 1 ? { color: col, ch: S.hero.name[0] ?? '义' } : null };
    }
    if (p.kind === 'lord') {
      const cul = f.culture in ELITE_CAV ? f.culture : 'ming';
      const spec: FigureSpec = { ...troopSpec(ELITE_CAV[cul], f.color), cape: shadeHex(f.color, -0.35), backFlag: null };
      const extras: FigureSpec[] = [];
      if (n > 30) extras.push(troopSpec(FOOT_OF[cul], f.color));
      if (n > 90) extras.push(troopSpec(FOOT_OF[cul], f.color));
      const lname = S.lords[p.lordId!]?.name ?? p.name;
      return { key: JSON.stringify(['L', p.faction, extras.length, lname[0]]), main: spec, extras, banner: { color: f.color, ch: lname[0] } };
    }
    if (p.kind === 'bandit') {
      const top = [...p.troops].sort((a, b) => b.n - a.n)[0];
      const id = top && TROOPS[top.id] ? top.id : 'bandit_rover';
      const spec = troopSpec(id, 0x444444);
      return { key: JSON.stringify(['B', id, n > 25]), main: spec, extras: n > 6 ? [spec] : [], banner: n > 25 ? { color: 0x2a2420, ch: '寇' } : null };
    }
    if (p.kind === 'caravan') {
      return { key: 'C' + p.faction, main: 'cart', extras: [troopSpec('civ_cguard', f.color)], banner: null };
    }
    return { key: 'V', main: SPEC_PEASANT, extras: [{ ...SPEC_PEASANT, head: 'straw', weapon: 'club', body: 0x7a6a50 }], banner: null };
  }

  makeVis(p: Party): PVis {
    const look = this.partyLook(p);
    const mk = (info: SheetInfo, scale: number) => this.add.sprite(p.x, p.y, info.key, 0).setOrigin(info.ax, info.ay).setScale(scale);
    let main: Phaser.GameObjects.Sprite;
    if (look.main === 'cart') { const ci = ensureCart(this); main = mk(ci, MAP_FIG / 3 * 0.95); }
    else main = mk(ensureFigure(this, look.main), MAP_FIG / RES);
    const extras = look.extras.map(sp => mk(ensureFigure(this, sp), MAP_FIG / RES * 0.92));
    let banner: Phaser.GameObjects.Sprite | null = null;
    if (look.banner) { const bi = ensureBanner(this, look.banner.color, look.banner.ch, true); banner = mk(bi, 0.6 / 3); }
    return { look: look.key, main, extras, banner, lx: p.x, ly: p.y, flip: false, moving: 0, phase: Math.random() * 4 };
  }
  destroyVis(v: PVis) { v.main.destroy(); v.extras.forEach(e => e.destroy()); v.banner?.destroy(); }

  updateParties(timeMs: number, dt: number) {
    const seen = new Set<number>();
    for (const p of S.parties) {
      if (p.inside || !this.visible(p)) continue;
      seen.add(p.id);
      let v = this.pvis.get(p.id);
      const lookKey = this.lookKeyFast(p);
      if (v && v.look !== lookKey) { this.destroyVis(v); v = undefined; }
      if (!v) { v = this.makeVis(p); v.look = lookKey; this.pvis.set(p.id, v); }
      const dx = p.x - v.lx, dy = p.y - v.ly;
      const d = Math.hypot(dx, dy);
      if (d > 0.02) { v.moving = 0.25; if (Math.abs(dx) > 0.02) v.flip = dx < 0; }
      else v.moving = Math.max(0, v.moving - dt);
      v.lx = p.x; v.ly = p.y;
      const walking = v.moving > 0;
      v.phase += dt * (walking ? 9 : 0);
      const isCart = v.main.texture.key === 'cart';
      const wf = walking ? Math.floor(v.phase) % 4 : 0;
      const dir = v.flip ? -1 : 1;
      const depth = 5 + p.y / 1e5;
      v.main.setPosition(p.x, p.y).setFlipX(v.flip).setDepth(depth).setFrame(isCart ? wf : walking ? 1 + wf : 0).setVisible(true);
      v.extras.forEach((e, i) => {
        const ox = -dir * (isCart ? 15 + i * 7 : 9 + i * 6), oy = i % 2 ? 3 : -2.5;
        const f2 = walking ? 1 + ((wf + 2 + i) % 4) : 0;
        e.setPosition(p.x + ox, p.y + oy).setFlipX(v!.flip).setDepth(depth - 0.00001 * (i + 1) + oy / 1e5).setFrame(f2).setVisible(true);
      });
      if (v.banner) {
        const bf = Math.floor(timeMs / 140 + p.id) % 4;
        v.banner.setPosition(p.x - dir * 6, p.y - 1).setFlipX(!v.flip).setDepth(depth - 0.000005).setFrame(bf).setVisible(true);
      }
    }
    for (const [id, v] of this.pvis) if (!seen.has(id)) { this.destroyVis(v); this.pvis.delete(id); }
  }
  lookKeyFast(p: Party) {
    const n = count(p.troops);
    if (p.kind === 'player') return `P${S.hero.equip.horse ? 1 : 0}${S.hero.equip.melee}${S.hero.equip.armor}${n >= 5 ? 1 : 0}${n >= 40 ? 1 : 0}${S.playerFaction}${[...p.troops].sort((a, b) => b.n - a.n)[0]?.id}`;
    if (p.kind === 'lord') return `L${p.faction}${n > 30 ? 1 : 0}${n > 90 ? 1 : 0}`;
    if (p.kind === 'bandit') return `B${[...p.troops].sort((a, b) => b.n - a.n)[0]?.id}${n > 6 ? 1 : 0}${n > 25 ? 1 : 0}`;
    return p.kind + p.faction;
  }

  drawDynamic(timeMs: number) {
    const g = this.gParties, fx = this.gFx;
    g.clear(); fx.clear();
    const pp = player();
    const night = isNight();
    const sight = sightRange(S, night);
    // 视野圈
    fx.lineStyle(1, 0xffffff, 0.12); fx.strokeCircle(pp.x, pp.y, sight);
    // 被围攻/劫掠标记
    for (const s of Object.values(S.settlements)) {
      if (s.siege) {
        const t = (timeMs / 300) % 2;
        fx.lineStyle(2, 0xff3020, 0.5 + 0.4 * Math.abs(1 - t)); fx.strokeEllipse(s.x, s.y, 66, 44);
        // 火光与烟
        for (let k = 0; k < 3; k++) {
          const ph = (timeMs / 900 + k * 0.33) % 1;
          fx.fillStyle(0x2a2420, 0.35 * (1 - ph)); fx.fillCircle(s.x - 10 + k * 10 + ph * 6, s.y - 14 - ph * 24, 3 + ph * 6);
          fx.fillStyle(0xff7020, 0.7 * (1 - ph)); fx.fillCircle(s.x - 10 + k * 10, s.y - 8 - ph * 4, 1.5 + (1 - ph) * 1.5);
        }
      } else if (s.lootedUntil > S.time) {
        const ph = (timeMs / 1400) % 1;
        fx.fillStyle(0x333333, 0.35 * (1 - ph)); fx.fillCircle(s.x + 2 + ph * 4, s.y - 8 - ph * 18, 3 + ph * 5);
      }
    }
    // 路径
    if (nav.path.length) {
      fx.lineStyle(1.5, 0xffe9a0, 0.75);
      let px = pp.x, py = pp.y;
      for (const [x, y] of nav.path) {
        const L = Math.hypot(x - px, y - py), n = Math.max(1, Math.floor(L / 7));
        for (let i = 0; i < n; i += 2) fx.lineBetween(px + (x - px) * i / n, py + (y - py) * i / n, px + (x - px) * Math.min(1, (i + 1) / n), py + (y - py) * Math.min(1, (i + 1) / n));
        px = x; py = y;
      }
      const [ex, ey] = nav.path[nav.path.length - 1];
      const pr = 4 + Math.sin(timeMs / 200) * 1;
      fx.lineStyle(2, 0xffe9a0, 0.9); fx.strokeEllipse(ex, ey, pr * 2.4, pr * 1.4);
    }
    let li = 0;
    const z = this.cameras.main.zoom;
    const showNames = z > 0.8;
    for (const p of S.parties) {
      if (p.inside) continue;
      if (!this.visible(p)) continue;
      if (p.kind === 'player') {
        const pulse = 1 + 0.15 * Math.sin(timeMs / 250);
        g.lineStyle(1.6, 0xffe9a0, 0.85); g.strokeEllipse(p.x, p.y, 22 * pulse, 10 * pulse);
      } else if (hostile(pp, p)) {
        g.lineStyle(1.3, 0xff4030, 0.85); g.strokeEllipse(p.x, p.y, 20, 9);
      }
      if (li < this.partyLabels.length && (p.kind === 'lord' || p.kind === 'player') && showNames) {
        const t = this.partyLabels[li++];
        t.setText(p.kind === 'player' ? S.hero.name : `${S.lords[p.lordId!]?.name ?? p.name}`);
        t.setPosition(p.x, p.y - 27).setVisible(true);
        t.setColor(p.kind === 'player' ? '#ffe28a' : '#ffffff');
        t.setFontSize(Math.round(12 / Math.max(0.8, Math.min(z, 1.6)) * 1.0));
      }
    }
    for (; li < this.partyLabels.length; li++) this.partyLabels[li].setVisible(false);
    // 追击目标
    if (nav.target?.kind === 'party') {
      const t = partyById(nav.target.id);
      if (t) { fx.lineStyle(2, 0xff8040, 0.9); fx.strokeEllipse(t.x, t.y, 30, 14); }
    }
    // 旗帜飘动
    const bf = Math.floor(timeMs / 160) % 4;
    for (const ic of this.sIcons.values()) ic.flag?.setFrame(bf);
    // 云
    const ca = Phaser.Math.Clamp((1.05 - z) / 0.5, 0, 0.75);
    for (const c of this.clouds) {
      c.x += 0.06; if (c.x > WORLD_W + 400) c.x = -400;
      c.setAlpha(ca);
    }
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    if (!panelOpen() && (nav.target || nav.waiting)) {
      const hoursPerSec = 2.2 * S.speed;
      simulate(dt * hoursPerSec);
    }
    const cam = this.cameras.main;
    if (this.follow && (nav.target || nav.waiting)) {
      const pp = player();
      cam.scrollX += (pp.x - cam.width / 2 - cam.scrollX) * 0.08;
      cam.scrollY += (pp.y - cam.height / 2 - cam.scrollY) * 0.08;
    }
    // 键盘平移
    const kb = this.input.keyboard;
    if (kb && !panelOpen()) {
      const keys = (this as any)._keys ||= kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false);
      const sp = 600 * dt / cam.zoom;
      if (keys.W.isDown || keys.UP.isDown) { cam.scrollY -= sp; this.follow = false; }
      if (keys.S.isDown || keys.DOWN.isDown) { cam.scrollY += sp; this.follow = false; }
      if (keys.A.isDown || keys.LEFT.isDown) { cam.scrollX -= sp; this.follow = false; }
      if (keys.D.isDown || keys.RIGHT.isDown) { cam.scrollX += sp; this.follow = false; }
    }
    if (this.staticDirty || time - this.lastStatic > 1000) { this.drawStatic(); this.staticDirty = false; this.lastStatic = time; }
    this.updateParties(time, dt);
    this.drawDynamic(time);
    // 昼夜
    const hr = S.time % 24;
    let a = 0;
    if (hr >= 19 && hr < 21) a = (hr - 19) / 2 * 0.38; else if (hr >= 21 || hr < 4) a = 0.38; else if (hr >= 4 && hr < 6) a = (6 - hr) / 2 * 0.38;
    const nd = document.getElementById('night'); if (nd) nd.style.opacity = '0';
    const nightK = a / 0.38;
    // 天气
    const pp = player();
    const w = weatherAt(pp.x, pp.y, S.time);
    this.life.update(time, dt, nightK, w.k);
    for (const c of this.clouds) c.setTint(nightK > 0.3 ? 0x6070a0 : 0xffffff);
    weatherFx.set(w); weatherFx.setAmbient(seasonOf(S.time), isNight());
    weatherFx.moveCam((cam.scrollX - this.lastScroll.x) * cam.zoom, (cam.scrollY - this.lastScroll.y) * cam.zoom);
    this.lastScroll.x = cam.scrollX; this.lastScroll.y = cam.scrollY;
    music.weather(w.kind === 'rain' ? w.k : 0);
    const v = cam.worldView;
    const dots: { x: number; y: number; c: string }[] = [];
    for (const p of S.parties) if (!p.inside && p.kind !== 'player' && (p.kind === 'lord' || this.visible(p))) dots.push({ x: p.x, y: p.y, c: hostile(pp, p) ? '#ff5040' : FACTION[p.faction]?.css ?? '#ccc' });
    minimap.update(v, pp, dots, nightK);
    hud.update();
    worldAudioTick(isNight(), panelOpen());
  }
}

export function sceneOpenEncounter(p: Party, forced: boolean) { openEncounter(p, forced); }
