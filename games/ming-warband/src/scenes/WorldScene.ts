// 大地图场景
import { GOD, GODUI } from '../core/god';
import { NETH } from '../net/hooks';
import { netFrame, NET } from '../net/client';
import { battleAt, openBattleJoin } from '../ui/nbattleUi';
import Phaser from 'phaser';
import { SEGS, PASSES, BREACH_OPEN } from '../core/wall';
import { buildWallChunks, wallJitter, WALL_RES, type WallChunk } from '../art/wallArt';
let wallChunks: WallChunk[] | null = null;
const MAJOR_PASS = new Set(['shanhai', 'jiayu', 'juyong']);
import { renderMapCanvas, WORLD_W, WORLD_H, terAtXY, TER_NAME } from '../core/terrain';
import { S, player, isNight, hostile, on, playerHostileToSettlement, lordName, partyById, allied } from '../core/game';
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
  partyLabels: Phaser.GameObjects.Text[] = []; // 空闲的名牌
  labelOf = new Map<number, Phaser.GameObjects.Text>(); // 部队 → 名牌（固定绑定：不再每帧重绘文字）
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
    this.labels = new Map(); this.partyLabels = []; this.labelOf = new Map(); (this as any)._keys = null; this.staticDirty = true; this.follow = true;
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
    this.buildWall();
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
    // 触屏双指缩放
    this.input.addPointer(1);
    let pinch: { d: number; z: number } | null = null;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        const d = Math.max(1, Math.hypot(p1.x - p2.x, p1.y - p2.y));
        if (!pinch) pinch = { d, z: cam.zoom };
        cam.setZoom(Phaser.Math.Clamp(pinch.z * d / pinch.d, 0.45, 3));
        this.drag.moved = true; this.drag.down = false; this.follow = false; this.staticDirty = true;
        return;
      }
      pinch = null;
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

  lookAt(x: number, y: number) { this.cameras.main.pan(x, y, 700, 'Sine.easeInOut'); this.follow = false; this.staticDirty = true; }
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

  /** 战场标记：烟尘、火光与交叉的刀枪 */
  drawBattleMark(fx: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, n: number) {
    const k = Math.min(1.6, 0.8 + n / 600);
    for (let i = 0; i < 4; i++) {
      const ph = (t / 1800 + i / 4) % 1;
      fx.fillStyle(0x6a5a48, 0.4 * (1 - ph)); fx.fillCircle(x + Math.sin(i * 2.1 + ph * 3) * 8 * k, y - 6 - ph * 30 * k, (4 + ph * 9) * k);
    }
    const pr = (13 + Math.sin(t / 220) * 2) * k;
    fx.fillStyle(0xff3020, 0.16); fx.fillEllipse(x, y, pr * 2.6, pr * 1.2);
    fx.lineStyle(1.6, 0xff5030, 0.75); fx.strokeEllipse(x, y, pr * 2.2, pr);
    const yy = y - 12 * k, L = 9 * k;
    g.lineStyle(3.2, 0x1a0c06, 0.9); g.lineBetween(x - L, yy - L, x + L, yy + L); g.lineBetween(x + L, yy - L, x - L, yy + L);
    g.lineStyle(1.8, 0xf0e0c0, 1); g.lineBetween(x - L, yy - L, x + L, yy + L); g.lineBetween(x + L, yy - L, x - L, yy + L);
    g.fillStyle(0xd4af37, 1); g.fillCircle(x - L * 0.55, yy + L * 0.55, 1.6 * k); g.fillCircle(x + L * 0.55, yy + L * 0.55, 1.6 * k);
  }

  clickWorld(x: number, y: number) {
    if (GODUI.tpArm && GOD.on) { GODUI.tpArm = false; GODUI.onTeleport(x, y); return; } // 天命：缩地成寸
    const z = this.cameras.main.zoom;
    const r = 14 / Math.min(z, 1.5);
    if (NETH.on) { const b = battleAt(x, y, r * 1.5); if (b) { openBattleJoin(b); return; } }
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
    if (GOD.on && GOD.eye) return true; // 天眼
    if (NETH.on && (p.kind === 'hero' || p.kind === 'lord') && S.playerFaction && (p.faction === S.playerFaction ? p.kind === 'hero' : allied(S.playerFaction, p.faction))) return true; // 本国玩家与盟军：共享视野
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
      const kind = s.isPass ? '长城关隘' : s.kind === 'town' ? '城镇' : s.kind === 'castle' ? '城堡' : s.camp ? '蒙古包（出骑兵）' : '村庄';
      const passInfo = s.isPass ? `<i style="color:#d8c8a0">${PASSES.find(x => x.id === s.id)?.desc ?? ''}</i><br>${playerHostileToSettlement(s) ? '<span class="bad">关门紧闭，不许通行</span>' : '<span class="good">可以通关</span>'}<br>` : '';
      const parent = s.parent ? `隶属：${S.settlements[s.parent].name}<br>` : '';
      const gar = s.kind !== 'village' ? `守军：约 ${Math.round(count(s.garrison) / 10) * 10} 人<br>` : '';
      const extra = s.siege ? '<span class="bad">被围攻中</span><br>' : s.lootedUntil > S.time ? '<span class="bad">已被洗劫</span><br>' : '';
      showTooltip(p.event as MouseEvent, `<b style="color:${f.css}">${s.name}</b> <small>${kind}</small><br>${f.name} · ${lordName(s.owner)}<br>${passInfo}${parent}${gar}繁荣：${Math.round(s.prosperity)}<br>${extra}${playerHostileToSettlement(s) ? '<span class="bad">敌对</span>' : ''}`);
    }
  }

  buildWall() {
    try {
      const passPts = Object.values(S.settlements).filter(s => s.isPass).map(s => [s.x, s.y] as [number, number]);
      for (const c of wallChunks ??= buildWallChunks(passPts)) {
        if (!this.textures.exists(c.key)) this.textures.addCanvas(c.key, c.canvas);
        this.add.image(c.x, c.y, c.key).setOrigin(0).setScale(1 / WALL_RES).setDepth(1.5);
      }
    } catch (e) { console.error('[wall art]', e); }
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
    if (s.kind === 'village') return (s.camp ? 'camp' : 'village') + (s.lootedUntil > S.time ? '_looted' : '');
    const h = [...s.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    if (s.isPass) return MAJOR_PASS.has(s.id) ? 'pass_major' : 'pass';
    if (s.kind === 'castle') return h % 3 === 0 ? 'castle1' : 'castle';
    if (s.id === 'beijing' || s.id === 'shengjing' || s.id === 'nanjing' || s.id === FACTION[s.faction]?.capital) return 'capital';
    return h % 3 === 0 ? 'town' : h % 3 === 1 ? 'town1' : 'town2';
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
      setTextColor(lbl, s.owner === 'player' ? '#ffe28a' : '#fff8e6');
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
            const fx = s.isPass ? s.x + 4 : s.kind === 'town' ? s.x + (this.settFrame(s) === 'capital' ? 25 : 21) : s.x + 9;
            const fy = s.isPass ? s.y - 14 : s.kind === 'town' ? s.y + 4 : s.y - 2;
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
    if (p.kind === 'hero') { // 联机：其他玩家
      const top = [...p.troops].sort((a, b) => b.n - a.n)[0];
      const cul = f.culture in ELITE_CAV ? f.culture : 'ming';
      const spec: FigureSpec = { ...troopSpec(ELITE_CAV[cul], f.color), cape: 0xd4af37, backFlag: null };
      const extras: FigureSpec[] = [];
      if (top && n >= 5 && TROOPS[top.id]) extras.push(troopSpec(top.id, f.color));
      if (top && n >= 60 && TROOPS[top.id]) extras.push(troopSpec(top.id, f.color));
      return { key: JSON.stringify(['H', p.faction, extras.length, p.name[0], top?.id]), main: spec, extras, banner: { color: f.color, ch: p.name[0] ?? '侠' } };
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
    if (p.kind === 'hero') return `H${p.faction}${n >= 5 ? 1 : 0}${n >= 60 ? 1 : 0}${[...p.troops].sort((a, b) => b.n - a.n)[0]?.id}`;
    if (p.kind === 'bandit') return `B${[...p.troops].sort((a, b) => b.n - a.n)[0]?.id}${n > 6 ? 1 : 0}${n > 25 ? 1 : 0}`;
    return p.kind + p.faction;
  }

  /** 天命金光（大地图）：多层光晕、旋转光芒、金色火星、疾行时的流光残影 */
  godTrail: { x: number; y: number; t: number }[] = [];
  drawGodAura(fx: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, x: number, y: number, t: number, k = 1) {
    const pulse = 1 + 0.12 * Math.sin(t / 220);
    const R = 16 * pulse * k;
    if (k === 1) {
      const last = this.godTrail[this.godTrail.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 3) this.godTrail.push({ x, y, t });
      while (this.godTrail.length && (t - this.godTrail[0].t > 900 || this.godTrail.length > 40)) this.godTrail.shift();
      for (const q of this.godTrail) { const a = 1 - (t - q.t) / 900; fx.fillStyle(0xffd040, 0.22 * a); fx.fillCircle(q.x, q.y - 4, 6 * a + 2); }
    }
    fx.fillStyle(0xffd040, 0.10); fx.fillCircle(x, y - 6, R * 2.6);
    fx.fillStyle(0xffe070, 0.14); fx.fillCircle(x, y - 6, R * 1.7);
    fx.fillStyle(0xfff4c0, 0.18); fx.fillCircle(x, y - 6, R * 1.0);
    const rot = t / 1400;
    for (let i = 0; i < 16; i++) {
      const a = rot + i * Math.PI / 8, L = (i % 2 ? 1.9 : 2.7) * R;
      fx.lineStyle(i % 2 ? 1 : 1.6, 0xffe590, 0.28 + 0.18 * Math.sin(t / 260 + i));
      fx.lineBetween(x + Math.cos(a) * R * 0.9, y - 6 + Math.sin(a) * R * 0.9, x + Math.cos(a) * L, y - 6 + Math.sin(a) * L);
    }
    g.lineStyle(2, 0xffe070, 0.95); g.strokeEllipse(x, y, 30 * pulse * k, 13 * pulse * k);
    g.lineStyle(1, 0xfff8d0, 0.7); g.strokeEllipse(x, y, 40 * pulse * k, 17 * pulse * k);
    for (let i = 0; i < 10; i++) {
      const ph = (t / 1500 + i / 10) % 1, ang = i * 2.39 + t / 2500;
      fx.fillStyle(0xfff0a0, 0.9 * (1 - ph)); fx.fillCircle(x + Math.cos(ang) * R * 1.1, y - 4 - ph * 34 * k, 1.4 * (1 - ph) + 0.5);
    }
  }

  drawDynamic(timeMs: number) {
    const g = this.gParties, fx = this.gFx;
    g.clear(); fx.clear();
    const pp = player();
    const night = isNight();
    const sight = sightRange(S, night);
    // 视野圈
    fx.lineStyle(1, 0xffffff, 0.12); fx.strokeCircle(pp.x, pp.y, sight);
    // 联机：正在进行的实时战斗（点击可加入）
    if (NETH.on) for (const b of NET.battles) this.drawBattleMark(fx, g, b.x, b.y, timeMs, b.n[0] + b.n[1]);
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
    // 长城缺口与烽火
    if (S.wallHp) for (let k = 0; k < S.wallHp.length; k++) {
      if (S.wallHp[k] > 0 && S.wallHp[k] >= 100) continue;
      const sg = SEGS[k]; if (!sg) continue;
      const broken = S.wallHp[k] < BREACH_OPEN;
      const tx = sg.ny, ty = -sg.nx; // 沿墙方向
      const wx = sg.x, wy = sg.y + wallJitter(sg.x, sg.y);
      if (broken) {
        // 坍塌缺口：土色豁口 + 散落砖石 + 尘土
        fx.fillStyle(0x7a6a4c, 1); fx.fillEllipse(wx, wy + 1.5, 16, 9);
        fx.fillStyle(0x5a4a34, 0.9); fx.fillEllipse(wx, wy + 2, 11, 5);
        for (let i = -4; i <= 4; i++) {
          const ox = tx * i * 2.6 + ((i * 7) % 3) - 1, oy = ty * i * 2.6 + ((i * 5) % 4) - 1;
          fx.fillStyle(i % 2 ? 0x9a8c74 : 0x7e705a, 1); fx.fillRect(wx + ox, wy + oy + 2, 2.4, 1.8);
          fx.fillStyle(0xc4b698, 1); fx.fillRect(wx + ox, wy + oy + 2, 2.4, 0.6);
        }
        fx.lineStyle(1.5, 0xff5030, 0.5 + 0.3 * Math.sin(timeMs / 300)); fx.strokeEllipse(wx, wy + 1, 30, 16);
      } else {
        // 受损：墙头裂痕与掉落砖块
        fx.fillStyle(0x5a4a38, 0.85); for (let i = -2; i <= 2; i++) fx.fillRect(wx + tx * i * 3.4, wy + ty * i * 3.4 - 1.2, 1.8, 1.6);
        fx.fillStyle(0x8a7a62, 0.9); fx.fillRect(wx + 3, wy + 4.6, 2, 1.4); fx.fillRect(wx - 4, wy + 5, 1.6, 1.2);
      }
    }
    for (const b of S.beacons ?? []) {
      if (b.until <= S.time) continue;
      for (let k = 0; k < 5; k++) {
        const ph = (timeMs / 1600 + k * 0.2) % 1;
        fx.fillStyle(0x2a2622, 0.45 * (1 - ph)); fx.fillCircle(b.x + Math.sin(ph * 3 + k) * 3 + ph * 10, b.y - 6 - ph * 46, 3 + ph * 8);
      }
      fx.fillStyle(0xff8a20, 0.8 + 0.2 * Math.sin(timeMs / 90)); fx.fillCircle(b.x, b.y - 4, 2.6);
      fx.fillStyle(0xffe080, 0.9); fx.fillCircle(b.x, b.y - 4.5, 1.2);
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
    const z = this.cameras.main.zoom;
    const showNames = z > 0.8;
    const vw = this.cameras.main.worldView;
    const usedLbl = this.usedLbl; usedLbl.clear();
    const fsz = Math.round(12 / Math.max(0.8, Math.min(z, 1.6)));
    for (const p of S.parties) {
      if (p.inside) continue;
      if (!this.visible(p)) continue;
      if (p.kind === 'player') {
        const pulse = 1 + 0.15 * Math.sin(timeMs / 250);
        if (GOD.on && GOD.aura) this.drawGodAura(fx, g, p.x, p.y, timeMs);
        else { g.lineStyle(1.6, 0xffe9a0, 0.85); g.strokeEllipse(p.x, p.y, 22 * pulse, 10 * pulse); }
      } else if ((p as any).god) {
        this.drawGodAura(fx, g, p.x, p.y, timeMs, 0.7); // 显圣：别人身上的金光
      } else if (hostile(pp, p)) {
        g.lineStyle(1.3, 0xff4030, 0.85); g.strokeEllipse(p.x, p.y, 20, 9);
      }
      if ((p.kind === 'lord' || p.kind === 'player' || p.kind === 'hero') && (showNames || p.kind === 'hero')
        && p.x > vw.x - 60 && p.x < vw.right + 60 && p.y > vw.y - 20 && p.y < vw.bottom + 60) {
        let t = this.labelOf.get(p.id);
        if (!t) {
          t = this.partyLabels.pop();
          if (!t && this.labelOf.size < 80) t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(20);
          if (t) this.labelOf.set(p.id, t);
        }
        if (t) {
          usedLbl.add(p.id);
          // 文字/颜色/字号只有变了才重绘（Phaser 每次 setColor 都会重画文字贴图，曾是大地图掉帧的元凶）
          const txt = p.kind === 'player' ? (GOD.on && GOD.aura ? `✦ ${S.hero.name} ✦` : S.hero.name) : p.kind === 'hero' ? `${p.name}${p.busy ? ' ⚔' : ''}` : `${S.lords[p.lordId!]?.name ?? p.name}`;
          if (t.text !== txt) t.setText(txt);
          setTextColor(t, p.kind === 'player' ? '#ffe28a' : p.kind === 'hero' ? (hostile(pp, p) ? '#ff9a8a' : '#9fe0ff') : '#ffffff');
          t.setFontSize(fsz); // 相同字号时 Phaser 不会重绘
          t.setPosition(p.x, p.y - 27);
          if (!t.visible) t.setVisible(true);
        }
      }
    }
    for (const [id, t] of this.labelOf) if (!usedLbl.has(id)) { t.setVisible(false); this.labelOf.delete(id); this.partyLabels.push(t); }
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

  usedLbl = new Set<number>();
  update(time: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    if (NETH.on) netFrame(dt);
    else if (!panelOpen() && (nav.target || nav.waiting)) {
      const hoursPerSec = 2.2 * S.speed;
      simulate(dt * hoursPerSec);
    }
    const cam = this.cameras.main;
    if (this.follow && (nav.target || nav.waiting || (NETH.on && player().busy === undefined && nav.path.length))) {
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
    if (minimap.due()) {
      const dots: { x: number; y: number; c: string }[] = [];
      for (const p of S.parties) if (!p.inside && p.kind !== 'player' && (p.kind === 'lord' || this.visible(p))) dots.push({ x: p.x, y: p.y, c: hostile(pp, p) ? '#ff5040' : FACTION[p.faction]?.css ?? '#ccc' });
      minimap.update(v, pp, dots, nightK);
    }
    hud.update();
    worldAudioTick(isNight(), panelOpen());
  }
}

/** 只在颜色真的变了时才改（Phaser 的 setColor 无条件重绘整张文字贴图） */
function setTextColor(t: Phaser.GameObjects.Text, c: string) { if ((t as any)._fillC !== c) { (t as any)._fillC = c; t.setColor(c); } }

export function sceneOpenEncounter(p: Party, forced: boolean) { openEncounter(p, forced); }
