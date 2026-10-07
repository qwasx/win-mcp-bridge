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

const FONT = '"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif';
export let worldScene: WorldScene | null = null;
let mapCanvas: HTMLCanvasElement | null = null;
export function getMapCanvas() { if (!mapCanvas) mapCanvas = renderMapCanvas(0.5); return mapCanvas; }

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

  constructor() { super('World'); }

  create() {
    worldScene = this;
    this.labels = new Map(); this.partyLabels = []; (this as any)._keys = null; this.staticDirty = true; this.follow = true;
    if (!this.textures.exists('map')) this.textures.addCanvas('map', getMapCanvas());
    this.add.image(0, 0, 'map').setOrigin(0).setScale(2);
    this.gStatic = this.add.graphics();
    this.gFx = this.add.graphics();
    this.gParties = this.add.graphics();
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
      const t = this.add.text(s.x, s.y + (s.kind === 'town' ? 12 : s.kind === 'castle' ? 10 : 7), s.name, {
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
      const d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; bestP = p; }
    }
    if (bestP) { setPlayerTarget({ kind: 'party', id: bestP.id }); this.follow = true; return; }
    let bestS: Settlement | null = null; bd = r * 1.2;
    for (const s of Object.values(S.settlements)) { const d = dist(x, y, s.x, s.y); if (d < bd) { bd = d; bestS = s; } }
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
      const d = dist(wp.x, wp.y, q.x, q.y); if (d < bd) { bd = d; found = { kind: 'party', p: q }; }
    }
    if (!found) for (const s of Object.values(S.settlements)) { const d = dist(wp.x, wp.y, s.x, s.y); if (d < r * 1.3 && d < bd * 1.3) { bd = d; found = { kind: 'settlement', s }; } }
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

  drawStatic() {
    const g = this.gStatic;
    g.clear();
    const z = this.cameras.main.zoom;
    for (const s of Object.values(S.settlements)) {
      const f = FACTION[s.faction];
      const col = f.color;
      const lbl = this.labels.get(s.id)!;
      lbl.setVisible(s.kind !== 'village' || z > 0.75);
      lbl.setColor(s.owner === 'player' ? '#ffe28a' : '#fff8e6');
      if (s.kind === 'town') {
        g.fillStyle(0x2a1a0e, 0.9); g.fillRect(s.x - 10, s.y - 10, 20, 20);
        g.fillStyle(col, 1); g.fillRect(s.x - 8, s.y - 8, 16, 16);
        g.fillStyle(0xf3e6c4, 1); g.fillRect(s.x - 5, s.y - 5, 10, 10);
        g.fillStyle(col, 1); g.fillTriangle(s.x - 6, s.y - 1, s.x, s.y - 7, s.x + 6, s.y - 1);
        g.fillStyle(0x2a1a0e, 1);
        for (const [cx, cy] of [[-10, -10], [6, -10], [-10, 6], [6, 6]]) g.fillRect(s.x + cx, s.y + cy, 4, 4);
      } else if (s.kind === 'castle') {
        g.fillStyle(0x2a1a0e, 0.9); g.fillRect(s.x - 7, s.y - 7, 14, 14);
        g.fillStyle(col, 1); g.fillRect(s.x - 5.5, s.y - 5.5, 11, 11);
        g.fillStyle(0x2a1a0e, 1); g.fillRect(s.x - 2, s.y - 10, 4, 6);
        g.fillStyle(col, 1); g.fillTriangle(s.x + 2, s.y - 10, s.x + 8, s.y - 8.5, s.x + 2, s.y - 7);
      } else {
        const looted = s.lootedUntil > S.time;
        g.fillStyle(0x2a1a0e, 0.85); g.fillCircle(s.x, s.y, 5.5);
        g.fillStyle(looted ? 0x555555 : 0xd8c49a, 1); g.fillRect(s.x - 3.5, s.y - 1.5, 7, 5);
        g.fillStyle(looted ? 0x333333 : col, 1); g.fillTriangle(s.x - 4.5, s.y - 1.5, s.x, s.y - 5.5, s.x + 4.5, s.y - 1.5);
      }
      if (s.owner === 'player') { g.lineStyle(1.5, 0xffd700, 1); g.strokeCircle(s.x, s.y, s.kind === 'town' ? 15 : s.kind === 'castle' ? 11 : 8); }
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
    // 被围攻/劫掠标记
    for (const s of Object.values(S.settlements)) {
      if (s.siege) {
        const t = (timeMs / 300) % 2;
        fx.lineStyle(2, 0xff3020, 0.5 + 0.4 * Math.abs(1 - t)); fx.strokeCircle(s.x, s.y, 18);
        fx.lineStyle(2, 0xffffff, 0.9); fx.lineBetween(s.x - 6, s.y - 22, s.x + 6, s.y - 32); fx.lineBetween(s.x + 6, s.y - 22, s.x - 6, s.y - 32);
      } else if (s.lootedUntil > S.time) {
        fx.fillStyle(0x333333, 0.35); fx.fillCircle(s.x + 2, s.y - 9, 4); fx.fillCircle(s.x + 5, s.y - 14, 5);
      }
    }
    // 路径
    if (nav.path.length) {
      fx.lineStyle(1.5, 0xffe9a0, 0.7);
      fx.beginPath(); fx.moveTo(pp.x, pp.y);
      for (const [x, y] of nav.path) fx.lineTo(x, y);
      fx.strokePath();
      const [ex, ey] = nav.path[nav.path.length - 1];
      fx.lineStyle(2, 0xffe9a0, 0.9); fx.strokeCircle(ex, ey, 5);
    }
    let li = 0;
    const z = this.cameras.main.zoom;
    const showNames = z > 0.8;
    for (const p of S.parties) {
      if (p.inside) continue;
      if (!this.visible(p)) continue;
      const n = count(p.troops) + (p.kind === 'player' ? 1 : 0);
      const r = Math.min(9, 3.5 + Math.sqrt(n) * 0.55);
      const f = FACTION[p.faction] ?? FACTION['none'];
      if (p.kind === 'player') {
        const pulse = 1 + 0.25 * Math.sin(timeMs / 250);
        g.lineStyle(2, 0xffe9a0, 0.6); g.strokeCircle(p.x, p.y, (r + 5) * pulse);
        g.fillStyle(0x1a1008, 1); g.fillCircle(p.x, p.y, r + 2);
        g.fillStyle(0xd4af37, 1); g.fillCircle(p.x, p.y, r);
        g.fillStyle(0xffffff, 1); g.fillCircle(p.x, p.y, 2);
      } else if (p.kind === 'caravan') {
        g.fillStyle(0x1a1008, 1); g.fillRect(p.x - r - 1.5, p.y - r * 0.7 - 1.5, r * 2 + 3, r * 1.4 + 3);
        g.fillStyle(0x9a6a3a, 1); g.fillRect(p.x - r, p.y - r * 0.7, r * 2, r * 1.4);
        g.fillStyle(f.color, 1); g.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (p.kind === 'villager') {
        g.fillStyle(0x1a1008, 1); g.fillCircle(p.x, p.y, r + 1.5);
        g.fillStyle(0xc8b48a, 1); g.fillCircle(p.x, p.y, r);
      } else if (p.kind === 'bandit') {
        g.fillStyle(0xb02020, 1); g.fillCircle(p.x, p.y, r + 1.8);
        g.fillStyle(0x222222, 1); g.fillCircle(p.x, p.y, r);
        g.lineStyle(1.5, 0xdddddd, 1); g.lineBetween(p.x - r * 0.5, p.y - r * 0.5, p.x + r * 0.5, p.y + r * 0.5); g.lineBetween(p.x + r * 0.5, p.y - r * 0.5, p.x - r * 0.5, p.y + r * 0.5);
      } else {
        g.fillStyle(0x1a1008, 1); g.fillCircle(p.x, p.y, r + 1.8);
        g.fillStyle(f.color, 1); g.fillCircle(p.x, p.y, r);
        // 旗帜
        g.lineStyle(1.5, 0x1a1008, 1); g.lineBetween(p.x, p.y - r, p.x, p.y - r - 12);
        g.fillStyle(f.color, 1); g.fillTriangle(p.x, p.y - r - 12, p.x + 9, p.y - r - 9, p.x, p.y - r - 6);
        g.lineStyle(1, 0xffffff, 0.8); g.strokeTriangle(p.x, p.y - r - 12, p.x + 9, p.y - r - 9, p.x, p.y - r - 6);
      }
      if (p.kind !== 'player' && hostile(pp, p)) { g.lineStyle(1.2, 0xff4030, 0.9); g.strokeCircle(p.x, p.y, r + 3.5); }
      if (li < this.partyLabels.length && (p.kind === 'lord' || p.kind === 'player') && showNames) {
        const t = this.partyLabels[li++];
        t.setText(p.kind === 'player' ? S.hero.name : `${S.lords[p.lordId!]?.name ?? p.name}`);
        t.setPosition(p.x, p.y - r - (p.kind === 'lord' ? 13 : 5)).setVisible(true);
        t.setColor(p.kind === 'player' ? '#ffe28a' : '#ffffff');
        t.setFontSize(Math.round(12 / Math.max(0.8, Math.min(z, 1.6)) * 1.0));
      }
    }
    for (; li < this.partyLabels.length; li++) this.partyLabels[li].setVisible(false);
    // 追击目标
    if (nav.target?.kind === 'party') {
      const t = partyById(nav.target.id);
      if (t) { fx.lineStyle(2, 0xff8040, 0.9); fx.strokeCircle(t.x, t.y, 13); }
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
    this.drawDynamic(time);
    // 昼夜
    const hr = S.time % 24;
    let a = 0;
    if (hr >= 19 && hr < 21) a = (hr - 19) / 2 * 0.38; else if (hr >= 21 || hr < 4) a = 0.38; else if (hr >= 4 && hr < 6) a = (6 - hr) / 2 * 0.38;
    const nd = document.getElementById('night'); if (nd) nd.style.opacity = String(a);
    hud.update();
  }
}

export function sceneOpenEncounter(p: Party, forced: boolean) { openEncounter(p, forced); }
