// 大地图的“生活层”：江上帆船、海上福船、飞鸟、炊烟、河面波光、夜晚灯火、场景内的夜色
import Phaser from 'phaser';
import { S, player } from '../core/game';
import { terAtXY, fineAt, toLL, Ter, WORLD_W, WORLD_H } from '../core/terrain';
import { fbm } from '../core/rng';
import { winterK } from '../core/weather';
import { riverLines, riverWidthAt, type RiverLine } from '../art/worldDetail';
import { makeCanvas } from '../art/canvas';

const R = Math.random;

export function ensureLifeTextures(scene: Phaser.Scene) {
  const T = scene.textures;
  const K = 3;
  if (!T.exists('life_junk')) {
    const cv = makeCanvas(22 * K, 22 * K); const c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.scale(K, K); c.translate(11, 17);
    c.fillStyle = 'rgba(20,30,40,0.3)'; c.beginPath(); c.ellipse(0.6, 1.6, 9, 2, 0, 0, Math.PI * 2); c.fill();
    // 船身
    c.fillStyle = '#5a3a1e'; c.beginPath(); c.moveTo(-9, -2.2); c.quadraticCurveTo(-8, 1.6, -4, 1.8); c.lineTo(5, 1.8); c.quadraticCurveTo(9, 1.2, 10, -3); c.lineTo(-9, -2.2); c.closePath(); c.fill();
    c.fillStyle = '#8a6036'; c.fillRect(-8, -2.6, 17, 1.2);
    c.strokeStyle = '#2a1a0a'; c.lineWidth = 0.4; c.stroke();
    c.fillStyle = '#c03a2a'; c.fillRect(6.5, -4.6, 2.4, 2);
    // 桅杆与篾帆
    c.strokeStyle = '#3a2410'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -2.4); c.lineTo(0, -15); c.stroke();
    c.fillStyle = '#d8b880'; c.beginPath(); c.moveTo(0.4, -14.5); c.quadraticCurveTo(6.5, -12, 6, -3.4); c.lineTo(0.4, -3.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(90,60,30,0.8)'; c.lineWidth = 0.35;
    for (let y = -12.5; y < -3.5; y += 1.8) { c.beginPath(); c.moveTo(0.4, y); c.lineTo(5.6 + (y + 9) * 0.04, y + 0.4); c.stroke(); }
    c.beginPath(); c.moveTo(0.4, -14.5); c.quadraticCurveTo(6.5, -12, 6, -3.4); c.stroke();
    c.fillStyle = '#d8b880'; c.beginPath(); c.moveTo(-0.6, -10); c.quadraticCurveTo(-5, -8, -5, -3.4); c.lineTo(-0.6, -3.4); c.closePath(); c.fill();
    c.fillStyle = '#c03a2a'; c.fillRect(0, -16.5, 2.4, 1.4);
    T.addCanvas('life_junk', cv as unknown as HTMLCanvasElement);
  }
  if (!T.exists('life_sampan')) {
    const cv = makeCanvas(16 * K, 10 * K); const c = cv.getContext('2d') as CanvasRenderingContext2D;
    c.scale(K, K); c.translate(8, 7);
    c.fillStyle = 'rgba(20,30,40,0.3)'; c.beginPath(); c.ellipse(0.5, 1.4, 6.5, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6a4424'; c.beginPath(); c.moveTo(-7, -1.4); c.quadraticCurveTo(-5, 1.4, -2, 1.4); c.lineTo(3, 1.4); c.quadraticCurveTo(6, 1, 7, -1.6); c.closePath(); c.fill();
    // 乌篷
    c.fillStyle = '#2c2a28'; c.beginPath(); c.moveTo(-3, -1.4); c.quadraticCurveTo(0, -5.2, 3, -1.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(160,140,110,0.6)'; c.lineWidth = 0.3; for (let x = -2; x <= 2; x += 1) { c.beginPath(); c.moveTo(x, -1.4); c.lineTo(x * 0.8, -3.6 + Math.abs(x) * 0.5); c.stroke(); }
    // 船夫
    c.fillStyle = '#d8b880'; c.beginPath(); c.moveTo(4, -4.6); c.lineTo(6.4, -3.4); c.lineTo(1.6, -3.4); c.closePath(); c.fill();
    c.fillStyle = '#3a4a5a'; c.fillRect(3.4, -3.4, 1.6, 2);
    c.strokeStyle = '#3a2410'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(5, -2.4); c.lineTo(8, 1.6); c.stroke();
    T.addCanvas('life_sampan', cv as unknown as HTMLCanvasElement);
  }
  if (!T.exists('life_snow')) {
    // 积雪遮罩：北方、高处更厚
    const D = 16, w = Math.ceil(WORLD_W / D), h = Math.ceil(WORLD_H / D);
    const cv = makeCanvas(w, h); const c = cv.getContext('2d') as CanvasRenderingContext2D;
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = x * D + D / 2, wy = y * D + D / 2;
      const t = fineAt(wx, wy); const o = (y * w + x) * 4;
      if (t === Ter.Sea) continue;
      const lat = toLL(wx, wy)[1];
      let a = Math.max(0, Math.min(1, (lat - 31.5) / 6));
      if (t === Ter.Mountain || t === Ter.Plateau) a = Math.min(1, a + 0.35);
      else if (t === Ter.Hills) a = Math.min(1, a + 0.12);
      if (t === Ter.Desert) a *= 0.5;
      a *= 0.55 + 0.45 * fbm(wx * 0.01, wy * 0.01, 66, 3);
      img.data[o] = 240; img.data[o + 1] = 244; img.data[o + 2] = 250; img.data[o + 3] = Math.round(a * 200);
    }
    c.putImageData(img, 0, 0);
    T.addCanvas('life_snow', cv as unknown as HTMLCanvasElement);
  }
  if (!T.exists('life_glow')) {
    const S2 = 64; const cv = makeCanvas(S2, S2); const c = cv.getContext('2d') as CanvasRenderingContext2D;
    const g = c.createRadialGradient(S2 / 2, S2 / 2, 0, S2 / 2, S2 / 2, S2 / 2);
    g.addColorStop(0, 'rgba(255,220,140,1)'); g.addColorStop(0.18, 'rgba(255,180,80,0.75)'); g.addColorStop(0.5, 'rgba(255,130,40,0.22)'); g.addColorStop(1, 'rgba(255,100,20,0)');
    c.fillStyle = g; c.fillRect(0, 0, S2, S2);
    T.addCanvas('life_glow', cv as unknown as HTMLCanvasElement);
  }
}

interface RiverBoat { spr: Phaser.GameObjects.Image; r: RiverLine; s: number; dir: number; speed: number; lo: number; hi: number; ph: number }
interface SeaBoat { spr: Phaser.GameObjects.Image; x: number; y: number; a: number; speed: number; ph: number; turn: number }
interface Flock { x: number; y: number; a: number; speed: number; n: number; ph: number; size: number }
interface Light { x: number; y: number; r: number; ph: number }

export class WorldLife {
  scene: Phaser.Scene;
  river: RiverBoat[] = [];
  sea: SeaBoat[] = [];
  flocks: Flock[] = [];
  g: Phaser.GameObjects.Graphics;       // 地面层特效（波光、尾迹、炊烟）
  gAir: Phaser.GameObjects.Graphics;    // 空中（飞鸟）
  night: Phaser.GameObjects.Rectangle;
  glows: Phaser.GameObjects.Image[] = [];
  lights: Light[] = [];
  playerGlow: Phaser.GameObjects.Image;
  chimneys: { x: number; y: number; ph: number; big: boolean }[] = [];
  snow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureLifeTextures(scene);
    this.snow = scene.add.image(0, 0, 'life_snow').setOrigin(0).setDisplaySize(WORLD_W, WORLD_H).setDepth(1).setAlpha(0);
    this.g = scene.add.graphics().setDepth(3.2);
    this.gAir = scene.add.graphics().setDepth(22);
    this.night = scene.add.rectangle(0, 0, 10, 10, 0x0a1430, 0).setOrigin(0).setDepth(9.8);
    this.playerGlow = scene.add.image(0, 0, 'life_glow').setDepth(9.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(1.3);
    this.spawnBoats();
    for (let i = 0; i < 4; i++) this.flocks.push(this.newFlock(true));
    this.buildLights();
  }

  // ---------- 船 ----------
  spawnBoats() {
    const rivers = riverLines();
    const plan: [string, number][] = [['长江', 9], ['黄河', 4], ['珠江', 3], ['汉水', 2]];
    for (const [name, n] of plan) {
      const r = rivers.find(x => x.name === name); if (!r) continue;
      const L = r.pts.length;
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(L * (name === '长江' ? 0.35 : 0.3)), hi = L - 3;
        const big = name === '长江' && R() < 0.5;
        const spr = this.scene.add.image(0, 0, big ? 'life_junk' : 'life_sampan').setOrigin(0.5, 0.78).setScale(big ? 0.4 : 0.36).setDepth(3.4);
        this.river.push({ spr, r, s: lo + R() * (hi - lo), dir: R() < 0.5 ? 1 : -1, speed: 0.6 + R() * 0.8, lo, hi, ph: R() * 10 });
      }
    }
    // 沿海
    let tries = 0;
    while (this.sea.length < 16 && tries++ < 4000) {
      const x = 1400 + R() * (WORLD_W - 1400), y = 400 + R() * (WORLD_H - 400);
      if (terAtXY(x, y) !== Ter.Sea) continue;
      // 只要近海
      let coast = false;
      for (let k = 0; k < 8 && !coast; k++) { const a = k * Math.PI / 4; if (terAtXY(x + Math.cos(a) * 90, y + Math.sin(a) * 90) !== Ter.Sea) coast = true; }
      if (!coast) continue;
      const spr = this.scene.add.image(x, y, 'life_junk').setOrigin(0.5, 0.78).setScale(0.5).setDepth(3.4);
      this.sea.push({ spr, x, y, a: R() * Math.PI * 2, speed: 4 + R() * 4, ph: R() * 10, turn: 0 });
    }
  }

  // ---------- 鸟 ----------
  newFlock(anywhere: boolean): Flock {
    const cam = this.scene.cameras.main, v = cam.worldView;
    const a = R() * Math.PI * 2;
    const cx = v.centerX || player().x, cy = v.centerY || player().y;
    const d = anywhere ? R() * 300 : Math.max(v.width, v.height) * 0.7 + 60;
    return { x: cx - Math.cos(a) * d, y: cy - Math.sin(a) * d, a: a + (R() - 0.5) * 0.6, speed: 26 + R() * 16, n: 3 + Math.floor(R() * 6), ph: R() * 10, size: 0.8 + R() * 0.5 };
  }

  // ---------- 灯火与炊烟 ----------
  buildLights() {
    for (const gl of this.glows) gl.destroy();
    this.glows = []; this.lights = []; this.chimneys = [];
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const s of Object.values(S.settlements)) {
      const pts: [number, number, number][] =
        s.kind === 'town' ? [[0, 8, 1.1], [-14, -4, 0.6], [12, -6, 0.6], [-4, -12, 0.55], [18, 4, 0.5]]
        : s.kind === 'castle' ? [[0, 3, 0.8], [-7, -6, 0.5]]
        : [[-4, 1, 0.5], [5, -2, 0.45]];
      for (const [dx, dy, r] of pts) this.lights.push({ x: s.x + dx, y: s.y + dy, r, ph: rnd() * 10 });
      const ch: [number, number][] = s.kind === 'town' ? [[-12, -10], [8, -12], [16, -2]] : s.kind === 'village' ? [[-4, -6], [6, -5]] : [[-4, -10]];
      for (const [dx, dy] of ch) this.chimneys.push({ x: s.x + dx, y: s.y + dy, ph: rnd(), big: s.kind === 'town' });
    }
    for (let i = 0; i < 60; i++) this.glows.push(this.scene.add.image(0, 0, 'life_glow').setDepth(9.9).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
  }

  /** 每帧调用；nightK 0..1 */
  update(timeMs: number, dt: number, nightK: number, rain = 0) {
    const cam = this.scene.cameras.main, v = cam.worldView, z = cam.zoom;
    const pad = 80;
    const inView = (x: number, y: number, p = pad) => x > v.x - p && x < v.right + p && y > v.y - p && y < v.bottom + p;
    const g = this.g, ga = this.gAir; g.clear(); ga.clear();
    const t = timeMs / 1000;
    const detail = z > 0.65;

    // 冬季积雪（腊月、正月最厚）
    this.snow.setAlpha(winterK(S.time));
    // 夜色
    this.night.setPosition(v.x - 4, v.y - 4).setSize(v.width + 8, v.height + 8).setFillStyle(0x0a1430, nightK * 0.46);

    // 河面波光
    if (detail) {
      for (const r of riverLines()) {
        const p = r.pts;
        for (let i = 0; i < p.length - 1; i += 2) {
          const [x, y] = p[i]; if (!inView(x, y, 10)) continue;
          const s = Math.sin(t * 1.3 + i * 1.73) * Math.sin(t * 0.7 + i * 0.61);
          if (s < 0.72) continue;
          const [x1, y1] = p[i + 1]; const a = Math.atan2(y1 - y, x1 - x), w = riverWidthAt(r, i);
          const o = Math.sin(i * 12.9) * w * 0.3;
          g.lineStyle(0.8, nightK > 0.5 ? 0xa8b8e0 : 0xf4fbff, (s - 0.72) * 2.6);
          const cx = x - Math.sin(a) * o, cy = y + Math.cos(a) * o;
          g.lineBetween(cx - Math.cos(a) * 2, cy - Math.sin(a) * 2, cx + Math.cos(a) * 2, cy + Math.sin(a) * 2);
        }
      }
    }

    // 江船
    for (const b of this.river) {
      b.s += b.dir * b.speed * dt * 0.9;
      if (b.s > b.hi) { b.s = b.hi; b.dir = -1; } else if (b.s < b.lo) { b.s = b.lo; b.dir = 1; }
      const i = Math.floor(b.s), f = b.s - i;
      const p0 = b.r.pts[i], p1 = b.r.pts[Math.min(b.r.pts.length - 1, i + 1)];
      const x = p0[0] + (p1[0] - p0[0]) * f, y = p0[1] + (p1[1] - p0[1]) * f;
      const vis = inView(x, y);
      b.spr.setVisible(vis && z > 0.55);
      if (!vis) continue;
      const bob = Math.sin(t * 2 + b.ph) * 0.4;
      b.spr.setPosition(x, y + bob).setFlipX((p1[0] - p0[0]) * b.dir < 0).setTint(nightK > 0.3 ? 0x8890b0 : 0xffffff);
      // 尾迹
      const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + (b.dir < 0 ? Math.PI : 0);
      g.lineStyle(0.7, 0xeaf6ff, 0.45);
      for (const sgn of [-1, 1]) g.lineBetween(x - Math.cos(a) * 4, y - Math.sin(a) * 4, x - Math.cos(a + sgn * 0.35) * 10, y - Math.sin(a + sgn * 0.35) * 10);
    }
    // 海船
    for (const b of this.sea) {
      b.turn -= dt;
      const nx = b.x + Math.cos(b.a) * 30, ny = b.y + Math.sin(b.a) * 30;
      if (terAtXY(nx, ny) !== Ter.Sea || nx < 0 || ny < 0 || nx > WORLD_W || ny > WORLD_H) { b.a += Math.PI * (0.5 + R() * 0.5); b.turn = 3; }
      else if (b.turn <= 0) { b.a += (R() - 0.5) * 0.8; b.turn = 4 + R() * 6; }
      b.x += Math.cos(b.a) * b.speed * dt; b.y += Math.sin(b.a) * b.speed * dt;
      const vis = inView(b.x, b.y);
      b.spr.setVisible(vis && z > 0.5);
      if (!vis) continue;
      b.spr.setPosition(b.x, b.y + Math.sin(t * 1.6 + b.ph) * 0.6).setFlipX(Math.cos(b.a) < 0).setTint(nightK > 0.3 ? 0x8890b0 : 0xffffff);
      g.lineStyle(0.8, 0xffffff, 0.4);
      for (const sgn of [-1, 1]) g.lineBetween(b.x - Math.cos(b.a) * 6, b.y - Math.sin(b.a) * 6, b.x - Math.cos(b.a + sgn * 0.3) * 16, b.y - Math.sin(b.a + sgn * 0.3) * 16);
    }

    // 炊烟（早晚更多）
    if (detail) {
      const hr = S.time % 24;
      const meal = (hr > 5 && hr < 8) || (hr > 10.5 && hr < 13) || (hr > 16.5 && hr < 19.5) ? 1 : 0.35;
      for (const c of this.chimneys) {
        if (!inView(c.x, c.y, 30)) continue;
        if (((c.ph * 7.3) % 1) > meal) continue;
        for (let k = 0; k < 3; k++) {
          const ph = (t / (c.big ? 4.5 : 5.5) + c.ph + k / 3) % 1;
          const x = c.x + ph * 9 + Math.sin(ph * 6 + c.ph * 9) * 1.5, y = c.y - ph * 22;
          g.fillStyle(nightK > 0.5 ? 0x707888 : 0xd8d4cc, 0.38 * (1 - ph) * Math.min(1, ph * 6));
          g.fillCircle(x, y, 1.6 + ph * 4.5);
        }
      }
    }

    // 飞鸟（白天）
    if (detail && nightK < 0.6 && rain < 0.15) {
      for (let fi = 0; fi < this.flocks.length; fi++) {
        const f = this.flocks[fi];
        f.x += Math.cos(f.a) * f.speed * dt; f.y += Math.sin(f.a) * f.speed * dt;
        if (!inView(f.x, f.y, Math.max(v.width, v.height))) { this.flocks[fi] = this.newFlock(false); continue; }
        const ca = Math.cos(f.a), sa = Math.sin(f.a);
        for (let i = 0; i < f.n; i++) {
          const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? -1 : 1);
          const bx = f.x - ca * row * 7 - sa * side * row * 6, by = f.y - sa * row * 7 + ca * side * row * 6;
          const flap = Math.sin(t * 9 + i * 1.3 + f.ph) * 2 * f.size;
          const s = 3.2 * f.size;
          // 影子
          ga.lineStyle(1, 0x203018, 0.18 * (1 - nightK));
          ga.beginPath(); ga.moveTo(bx + 30 - s, by + 46 - flap * 0.3); ga.lineTo(bx + 30, by + 46); ga.lineTo(bx + 30 + s, by + 46 - flap * 0.3); ga.strokePath();
          ga.lineStyle(1.2, 0x2a2a2a, 0.85);
          ga.beginPath(); ga.moveTo(bx - s, by - flap); ga.lineTo(bx, by); ga.lineTo(bx + s, by - flap); ga.strokePath();
        }
      }
    }

    // 夜晚灯火
    let gi = 0;
    if (nightK > 0.05) {
      for (const L of this.lights) {
        if (gi >= this.glows.length) break;
        if (!inView(L.x, L.y, 40)) continue;
        const fl = 0.85 + 0.15 * Math.sin(t * 7 + L.ph) * Math.sin(t * 3.1 + L.ph * 2);
        this.glows[gi++].setVisible(true).setPosition(L.x, L.y).setScale(L.r * 0.9).setAlpha(nightK * 0.6 * fl);
      }
      const pp = player();
      if (!pp.inside) this.playerGlow.setPosition(pp.x + 3, pp.y - 6).setAlpha(nightK * 0.5 * (0.9 + 0.1 * Math.sin(t * 9))).setVisible(true);
      else this.playerGlow.setVisible(false);
    } else this.playerGlow.setVisible(false);
    for (; gi < this.glows.length; gi++) this.glows[gi].setVisible(false);
  }
}
