// 大地图渲染：水墨底图 → 水波 → 倒影 → 地点地面 → (山/树/建筑/生灵/人物 Y 排序) → 护山大阵 → 天空生灵
//            → 昼夜 → 灯火 → 云雾/迷雾 → 名牌 → 神识 → 天气 → 季节纸纹
import type { Game } from './game';
import { FOG_CELL, FOG_W, FOG_H } from './game';
import { CHUNK, Deco, TreeDeco, MtnDeco } from './terrain';
import { LOCATIONS, LocDef, WORLD_SCALE, WORLD_W, WORLD_H, BIG_LABELS } from '../data/world';
import { hash2, clamp } from '../core/rng';
import { sprites, resBucket, Spr } from '../gfx/sprites';
import { makeTree, Season } from '../gfx/tree';
import { makeMountain } from '../gfx/mountain';
import { layoutLocation, renderPiece, renderGround, LOC_SCALE, LocLayout } from '../gfx/building';
import { drawCharacter } from '../gfx/character';
import { drawNode } from './nodes';
import type { Drawable } from './life';
import { SenseFx, senseMods } from './sense';
import { collectCombat, drawCombatFx, drawCombatUI } from './combatfx';
import { REALMS } from '../data/realms';

const LOC_SEAL: Record<string, string> = { city: '城', town: '镇', sect: '宗', danger: '险', secret: '秘', isle: '岛' };
const LOC_SEAL_COLOR: Record<string, string> = { city: '#9a3b2c', town: '#8a6a3a', sect: '#2f6b5e', danger: '#5a1f2a', secret: '#3a5a8a', isle: '#2f6a80' };
export const PLAYER_SCALE = 1.12;
export const TREE_K = 0.76; // 野外树木整体比例
const SP_INDEX: Record<string, number> = { pine: 1, broad: 2, willow: 3, bamboo: 4, maple: 5, ymaple: 6, plum: 7, peach: 8, cypress: 9, snowpine: 10, dead: 11, palm: 12 };

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface MtnMeta { falls: { x: number; y: number; w: number; h: number }[]; seen: number; refl?: boolean }

export class Renderer {
  game: Game;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1; W = 0; H = 0;
  cloud: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  particles: Particle[] = [];
  driftClouds: { x: number; y: number; s: number; v: number }[] = [];
  private pendingBuilds = 0;
  atmo: HTMLCanvasElement; atmoCtx: CanvasRenderingContext2D;
  static AS = 0.25;
  quality: ImageSmoothingQuality = 'medium';
  overlay: HTMLCanvasElement | null = null; overlayKey = '';
  cloudShadow: HTMLCanvasElement;
  layouts = new Map<string, LocLayout>();
  mtnMeta = new Map<string, MtnMeta>();
  private lastCam = { x: 0, y: 0 };
  private Z = 1; private ox = 0; private oy = 0;
  stats = { decos: 0, trees: 0, mtns: 0, ms: 0 };
  sense = new SenseFx();
  senseMods: string[] = [];
  private modsT = 0;

  constructor(game: Game, canvas: HTMLCanvasElement) {
    this.game = game; this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.cloud = this.makeCloud();
    this.cloudShadow = this.makeCloudShadow();
    this.glow = this.makeGlow();
    this.atmo = document.createElement('canvas');
    this.atmoCtx = this.atmo.getContext('2d')!;
    for (let i = 0; i < 14; i++) this.driftClouds.push({ x: Math.random() * 9000, y: Math.random() * 6000, s: 0.8 + Math.random() * 1.4, v: 18 + Math.random() * 25 });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2, this.maxDpr ?? 2);
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    if (this.atmo) { this.atmo.width = Math.ceil(this.W * Renderer.AS) + 2; this.atmo.height = Math.ceil(this.H * Renderer.AS) + 2; }
    this.overlayKey = '';
  }

  viewRect() {
    const z = this.game.cam.zoom, W = this.W || window.innerWidth, H = this.H || window.innerHeight;
    return { left: this.game.cam.x - W / 2 / z, top: this.game.cam.y - H / 2 / z, right: this.game.cam.x + W / 2 / z, bottom: this.game.cam.y + H / 2 / z };
  }

  burst(x: number, y: number, color: string, n = 26) {
    const c = color.startsWith('#') ? `${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)}` : color;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 40, life: 0, max: 0.7 + Math.random() * 0.8, size: 2 + Math.random() * 4, color: c });
    }
  }

  // ---------------------------------------------------------------- 预制位图
  private makeGlow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,140,0.95)'); gr.addColorStop(0.25, 'rgba(255,170,80,0.45)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }
  private makeCloudShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.drawImage(this.cloud, 0, 0, 128, 128);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = 'rgb(40,46,44)'; g.fillRect(0, 0, 128, 128);
    return c;
  }
  private buildOverlay(month: number) {
    const W = Math.ceil(this.W), H = Math.ceil(this.H);
    const c = this.overlay ?? document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    const tint = month < 3 ? 'rgba(180,220,170,0.05)' : month < 6 ? 'rgba(255,230,160,0.05)' : month < 9 ? 'rgba(230,150,80,0.07)' : 'rgba(200,215,240,0.12)';
    g.fillStyle = tint; g.fillRect(0, 0, W, H);
    const T = 192, tile = document.createElement('canvas'); tile.width = tile.height = T;
    const tg = tile.getContext('2d')!;
    const img = tg.createImageData(T, T);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = 70; img.data[i + 1] = 55; img.data[i + 2] = 35; img.data[i + 3] = v * v * 30;
    }
    tg.putImageData(img, 0, 0);
    tg.strokeStyle = 'rgba(110,90,60,0.10)';
    for (let i = 0; i < 40; i++) {
      tg.lineWidth = Math.random() * 0.8;
      tg.beginPath(); const x = Math.random() * T, y = Math.random() * T;
      tg.moveTo(x, y); tg.quadraticCurveTo(x + Math.random() * 20 - 10, y + Math.random() * 20 - 10, x + Math.random() * 30 - 15, y + Math.random() * 30 - 15); tg.stroke();
    }
    g.fillStyle = g.createPattern(tile, 'repeat')!; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(40,30,20,0)'); vg.addColorStop(1, 'rgba(40,30,20,0.30)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.overlay = c;
  }
  private makeCloud() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const blobs = [[128, 128, 100], [80, 140, 70], [176, 136, 74], [120, 92, 66], [150, 170, 60], [96, 176, 52], [190, 100, 50]];
    for (const [x, y, r] of blobs) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(246,242,234,0.95)'); rg.addColorStop(0.6, 'rgba(240,236,228,0.7)'); rg.addColorStop(1, 'rgba(236,232,224,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(150,150,140,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.arc(110, 150, 30, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(160, 140, 24, Math.PI * 1.0, Math.PI * 2.0); g.stroke();
    return c;
  }

  private perfT = 0; private perfN = 0; private perfAcc = 0; private lowered = 0;
  private adapt(dt: number) {
    if (this.lowered >= 2 || dt <= 0) return;
    this.perfT += dt; this.perfN++; this.perfAcc += dt;
    if (this.perfT > 4) {
      const avg = this.perfAcc / this.perfN;
      if (avg > 1 / 36 && this.dpr > 1.01) { this.lowered++; this.maxDpr = this.lowered === 1 ? 1.5 : 1; this.resize(); }
      this.perfT = 0; this.perfN = 0; this.perfAcc = 0;
    }
  }
  maxDpr = 2;

  /** 设回世界变换 */
  private world() { this.ctx.setTransform(this.Z, 0, 0, this.Z, this.ox, this.oy); }

  layout(l: LocDef) {
    let L = this.layouts.get(l.id);
    if (!L) { L = layoutLocation(l); this.layouts.set(l.id, L); }
    return L;
  }

  // ---------------------------------------------------------------- 主渲染
  render(dt: number) {
    const t0 = performance.now();
    const { ctx, game } = this;
    this.adapt(dt);
    if (!sprites.unlimited) sprites.frameMs = game.time < 2 ? 28 : 7; // 开场预热：多生成一些位图
    sprites.beginFrame();
    const z = game.cam.zoom;
    const W = this.W, H = this.H, dpr = this.dpr;
    if (this.canvas.clientWidth !== W || this.canvas.clientHeight !== H) this.resize();
    const t = game.time;
    const season = game.season as Season;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.quality;
    ctx.fillStyle = '#e9dfc6';
    ctx.fillRect(0, 0, W, H);

    const sh = this.sense.alarm > 0.3 ? (this.sense.alarm - 0.3) * 5 / z : 0;
    const camX = game.cam.x + (sh ? Math.sin(game.time * 47) * sh : 0), camY = game.cam.y + (sh ? Math.cos(game.time * 53) * sh : 0);
    const left = camX - W / 2 / z, top = camY - H / 2 / z, right = camX + W / 2 / z, bottom = camY + H / 2 / z;
    this.Z = z * dpr; this.ox = W * dpr / 2 - camX * this.Z; this.oy = H * dpr / 2 - camY * this.Z;
    this.world();
    const T = game.terrain;

    // ---------- 1. 底图分块 ----------
    const cx0 = Math.floor(left / CHUNK), cx1 = Math.floor(right / CHUNK);
    const cy0 = Math.floor(top / CHUNK), cy1 = Math.floor(bottom / CHUNK);
    let builds = 0;
    const maxBuilds = this.pendingBuilds > 0 ? 3 : 5;
    const order: [number, number, number][] = [];
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      order.push([cx, cy, Math.hypot((cx + 0.5) * CHUNK - camX, (cy + 0.5) * CHUNK - camY)]);
    }
    order.sort((a, b) => a[2] - b[2]);
    let missing = 0;
    for (const [cx, cy] of order) {
      if (cx < 0 || cy < 0 || cx * CHUNK > WORLD_W || cy * CHUNK > WORLD_H) continue;
      let ch = T.getChunk(cx, cy, false);
      if (!ch && builds < maxBuilds) { ch = T.getChunk(cx, cy, true); builds++; }
      if (!ch) { missing++; continue; }
      const inView = (cx + 1) * CHUNK > left && cx * CHUNK < right && (cy + 1) * CHUNK > top && cy * CHUNK < bottom;
      if (inView) ctx.drawImage(ch.canvas, cx * CHUNK - 0.6, cy * CHUNK - 0.6, CHUNK + 1.2, CHUNK + 1.2);
    }
    this.pendingBuilds = missing;

    // ---------- 2. 水波 ----------
    if (z >= 0.35) this.drawWater(left, top, right, bottom, t);

    // ---------- 3. 收集装饰 ----------
    const list: Drawable[] = [];
    const reflect: (TreeDeco | MtnDeco)[] = [];
    const prefetch: MtnDeco[] = [];
    const lodMax = z < 0.3 ? 0 : z < 0.45 ? 1 : 2;
    let nTrees = 0, nM = 0, nD = 0;
    for (let cy = cy0 - 1; cy <= cy1 + 2; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK > WORLD_W || cy * CHUNK > WORLD_H) continue;
      const ds = T.getDecos(cx, cy);
      for (const d of ds) {
        const vis = !(d.x + d.w / 2 < left || d.x - d.w / 2 > right || d.y - d.h > bottom + 20 || d.y < top - 20);
        if (d.kind === 'mtn') {
          const dd = d as MtnDeco & { _refl?: number };
          if (!vis) { if (d.x + d.w > left - 1200 && d.x - d.w < right + 1200 && d.y - d.h < bottom + 1200 && d.y > top - 1200) prefetch.push(d); continue; }
          nM++;
          list.push({ y: d.y, draw: () => this.drawMountain(d, t) });
          if (dd._refl === undefined) dd._refl = (!T.isLand(d.x, d.y + 60) || !T.isLand(d.x - d.w * 0.25, d.y + 50) || !T.isLand(d.x + d.w * 0.25, d.y + 50)) ? 1 : 0;
          if (dd._refl) reflect.push(d);
        } else if (d.kind === 'tree') {
          if (!vis) continue;
          if (d.lod > lodMax) continue;
          nTrees++;
          const td = d as TreeDeco & { _refl?: number };
          list.push({ y: d.y, draw: () => this.drawTree(d, t, lodMax < 2 ? (lodMax === 0 ? 1.25 : 1.1) : 1) });
          if (z > 0.45) {
            if (td._refl === undefined) td._refl = !T.isLand(d.x, d.y + 30) ? 1 : 0;
            if (td._refl) reflect.push(d);
          }
        } else {
          if (!vis || z < 0.3) continue;
          nD++;
          list.push({ y: d.y, draw: () => { ctx.globalAlpha = d.alpha; if (d.flip) { ctx.save(); ctx.translate(d.x, 0); ctx.scale(-1, 1); ctx.drawImage(d.img, -d.w / 2, d.y - d.h, d.w, d.h); ctx.restore(); } else ctx.drawImage(d.img, d.x - d.w / 2, d.y - d.h, d.w, d.h); ctx.globalAlpha = 1; } });
        }
      }
    }
    this.stats.trees = nTrees; this.stats.mtns = nM; this.stats.decos = nD;

    // 倒影（贴在水面上）
    if (reflect.length && z >= 0.35) this.drawReflections(reflect, t);

    // ---------- 4. 地点 ----------
    const visibleLocs: LocDef[] = [];
    const barriers: { L: LocLayout; x: number; y: number }[] = [];
    for (const l of LOCATIONS) {
      const x = l.x * WORLD_SCALE, y = l.y * WORLD_SCALE;
      const L = this.layout(l);
      const hw = L.gw * LOC_SCALE * 0.6, hh = L.gh * LOC_SCALE * 0.6;
      if (x + hw < left - 200 || x - hw > right + 200 || y + hh < top - 200 || y - hh - 600 > bottom) continue;
      visibleLocs.push(l);
      this.drawLocGround(L, x, y, z);
      const res = resBucket(z * dpr * LOC_SCALE, 1.4);
      L.pieces.forEach((pc, i) => {
        const ts = pc.kind === 'tree' ? (pc.p.s ?? 0.55) : 1;
        const pres = pc.kind === 'tree' ? resBucket(z * dpr * LOC_SCALE * ts, 1.4) : res;
        const px = x + pc.x * LOC_SCALE, py = y + pc.y * LOC_SCALE;
        if (px < left - 600 || px > right + 600 || py < top - 50 || py - 900 > bottom) return;
        if (z < 0.3 && pc.kind === 'tree' && i % 2) return;
        const key = pc.kind === 'tree' ? `P:${l.id}:${i}:${season}` : `P:${l.id}:${i}`;
        list.push({ y: py, draw: () => {
          const s = sprites.get(key, pres, (r) => renderPiece(pc, L.pal, r, season) as Spr);
          if (!s) return;
          if (pc.kind === 'tree') {
            const sw = Math.sin(t * 1.3 + i) * 0.02 * (0.5 + game.weather.wind);
            const k = this.Z * LOC_SCALE * ts;
            ctx.setTransform(k, 0, sw * k, k, px * this.Z + this.ox, py * this.Z + this.oy);
            ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
            this.world();
          } else ctx.drawImage(s.canvas, px - s.ax * LOC_SCALE, py - s.ay * LOC_SCALE, s.w * LOC_SCALE, s.h * LOC_SCALE);
        } });
      });
      // 旗帜、炊烟
      for (const f of L.flags) { const fx = x + f.x * LOC_SCALE, fy = y + f.y * LOC_SCALE; list.push({ y: fy + 1, draw: () => this.drawFlag(fx, fy, f.color, t) }); }
      if (L.barrier) barriers.push({ L, x, y });
    }

    // ---------- 5. 采集点（仅神识内可见）----------
    const p = game.player;
    this.modsT -= dt;
    if (this.modsT <= 0) { this.modsT = 1; this.senseMods = senseMods({ ...game.hero, treasures: [...((game.hero as any).treasures ?? []), ...game.hero.bag.map((b) => b.id.replace(/^(art|mat)_/, '')), ...game.hero.arts.map((a) => a.id)] } as any); this.sense.warm(game.hero.realm, this.senseMods); }
    this.sense.hidden += ((game.concealed ? 1 : 0) - this.sense.hidden) * Math.min(1, dt * 3);
    this.sense.update(dt, game.senseRadius);
    const R = this.sense.dispR;
    game.life.sense.x = p.x; game.life.sense.y = p.y; game.life.sense.R = game.revealAll && game.debugSeeAll ? 1e9 : R;
    for (const n of game.nodes.inRect(p.x - R, p.y - R, p.x + R, p.y + R)) {
      if (!game.nodes.available(n, game.day)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d > R) continue;
      const a = clamp((R - d) / 120, 0, 1);
      const hl = game.gatherTarget === n;
      list.push({ y: n.y, draw: () => drawNode(ctx, n, t, a, hl) });
    }

    // ---------- 6. 生灵（地面）+ 玩家 ----------
    const view = { left, top, right, bottom };
    ctx.save();
    game.life.drawShadows(ctx, t);
    ctx.restore();
    game.life.collectGround(list, view, t, dt);
    collectCombat(game.combat, list, view, t, dt);
    game.npcs.collect(list, view, t, dt);
    game.events.collect(list, view, t, dt);
    list.push({ y: p.y, draw: () => this.drawPlayer(dt) });

    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(ctx);
    this.world();

    // 遮挡时的人影（透过树木建筑仍可见）
    this.drawPlayerGhost();

    // 炊烟
    for (const l of visibleLocs) { const L = this.layout(l); for (const s of L.smoke) if (Math.hypot(l.x * WORLD_SCALE + s.x * LOC_SCALE - p.x, l.y * WORLD_SCALE + s.y * LOC_SCALE - p.y) < R) this.drawSmoke(l.x * WORLD_SCALE + s.x * LOC_SCALE, l.y * WORLD_SCALE + s.y * LOC_SCALE, t, hash2(s.x, s.y, 3)); }

    // ---------- 7. 护山大阵 ----------
    for (const b of barriers) this.drawBarrier(b.L, b.x, b.y, t);

    // 预取视野外的山（有剩余预算时）
    if (sprites.canBuild()) {
      prefetch.sort((a, b) => Math.hypot(a.x - camX, a.y - camY) - Math.hypot(b.x - camX, b.y - camY));
      for (const d of prefetch.slice(0, 3)) { if (!sprites.canBuild()) break; this.mtnSprite(d, z); }
    }

    // ---------- 8. 天空：飞鸟、仙鹤、御剑修士；粒子；目的地 ----------
    game.life.drawSky(ctx, t);
    this.updateParticles(dt);
    if (game.destination) {
      const { x, y } = game.destination;
      ctx.save();
      ctx.strokeStyle = 'rgba(160,50,40,0.85)'; ctx.lineWidth = 3 / z;
      const r = 18 + Math.sin(t * 5) * 4;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.4, r * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(160,50,40,0.6)'; ctx.fill();
      ctx.restore();
    }

    // ---------- 9. 昼夜 + 天气暗化（multiply）----------
    const night = game.night, light = game.light;
    const dusk = clamp(1 - Math.abs(light - 0.52) / 0.2, 0, 1) * (1 - night) * 0.7;
    const gloom = game.weather.gloom + game.weather.flash * -0.3;
    if (night > 0.01 || dusk > 0.01 || gloom > 0.01) {
      let r = 255, g = 255, bb = 255;
      r += (255 - r) * dusk; g += (200 - g) * dusk; bb += (160 - bb) * dusk;
      r += (70 - r) * night * 0.85; g += (80 - g) * night * 0.85; bb += (130 - bb) * night * 0.85;
      const gl = clamp(gloom, 0, 0.6);
      r += (150 - r) * gl; g += (156 - g) * gl; bb += (168 - bb) * gl;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${bb | 0})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
    // 灯火
    if (night > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of visibleLocs) {
        const L = this.layout(l), lx = l.x * WORLD_SCALE, ly = l.y * WORLD_SCALE;
        L.lights.forEach((li, i) => {
          const vis = clamp((R - Math.hypot(lx + li.x * LOC_SCALE - p.x, ly + li.y * LOC_SCALE - p.y)) / 120, 0, 1);
          if (vis <= 0) return;
          const fl = 0.85 + 0.15 * Math.sin(t * 7 + i * 1.7) * Math.sin(t * 3.1 + i);
          const rr = li.r * LOC_SCALE * 2.4 * fl;
          ctx.globalAlpha = night * 0.75 * vis;
          ctx.drawImage(this.glow, lx + li.x * LOC_SCALE - rr, ly + li.y * LOC_SCALE - rr * 0.8, rr * 2, rr * 1.6);
        });
      }
      // 采集点灵光、玩家周身微光
      ctx.globalAlpha = night * 0.35;
      ctx.drawImage(this.glow, p.x - 160, p.y - 170, 320, 240);
      ctx.restore();
      game.life.drawGlow(ctx, t, night);
    }

    // 战斗特效（发光，夜里亦明亮）
    this.world();
    drawCombatFx(ctx, game.combat, t);

    // ---------- 9.5 神识之外：记忆水墨（褪色、留白，不见动静）----------
    if (!(game.revealAll && game.debugSeeAll)) {
      const sx = (W / 2 + (p.x - camX) * z) * dpr, sy = (H / 2 + (p.y - camY) * z) * dpr;
      this.sense.drawMemory(ctx, sx, sy, R * z * dpr, this.canvas.width, this.canvas.height, this.lowered >= 1);
      this.world();
    }

    // ---------- 10. 氛围层 ----------
    this.drawAtmosphere(left, top, right, bottom, dt);
    ctx.drawImage(this.atmo, this.atmoRect.x, this.atmoRect.y, this.atmoRect.w, this.atmoRect.h);

    // 血条与伤害数字
    drawCombatUI(ctx, game.combat, t, z);

    // ---------- 11. 名牌 ----------
    for (const l of visibleLocs) {
      const x = l.x * WORLD_SCALE, y = l.y * WORLD_SCALE;
      const explored = game.isExplored(x, y);
      if (!explored && !l.major) continue;
      const L = this.layout(l);
      this.drawLabel(l, x, y + L.gh * LOC_SCALE * 0.36, explored);
    }
    // 大地点（缩小时，距离远的也显示名牌）
    if (z < 0.6) for (const l of LOCATIONS) {
      if (!l.major || visibleLocs.includes(l)) continue;
      const x = l.x * WORLD_SCALE, y = l.y * WORLD_SCALE;
      if (x < left || x > right || y < top || y > bottom) continue;
      this.drawLabel(l, x, y, game.isExplored(x, y));
    }

    // ---------- 12. 神识 ----------
    this.drawSense();

    // ---------- 13. 屏幕空间：天气、大区域名、纸纹 ----------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cdx = dt > 0 ? (camX - this.lastCam.x) / dt * z : 0, cdy = dt > 0 ? (camY - this.lastCam.y) / dt * z : 0;
    this.lastCam.x = camX; this.lastCam.y = camY;
    game.weather.draw(ctx, W, H, dt, clamp(cdx, -800, 800), clamp(cdy, -800, 800));
    if (z < 0.6) {
      const a = clamp((0.6 - z) / 0.3, 0, 1) * 0.55;
      ctx.globalAlpha = a;
      for (const b of BIG_LABELS) {
        const sx = W / 2 + (b.at[0] * WORLD_SCALE - camX) * z, sy = H / 2 + (b.at[1] * WORLD_SCALE - camY) * z;
        if (sx < -400 || sx > W + 400 || sy < -200 || sy > H + 200) continue;
        const spr = this.bigLabel(b.name, Math.round(b.size * 16 + 18));
        const w = spr.width / dpr, h = spr.height / dpr;
        ctx.drawImage(spr, sx - w / 2, sy - h / 2, w, h);
      }
      ctx.globalAlpha = 1;
    }
    const month = Math.floor(game.day / 30) % 12;
    const key = Math.floor(month / 3) + ':' + Math.ceil(W) + 'x' + Math.ceil(H);
    if (key !== this.overlayKey) { this.buildOverlay(month); this.overlayKey = key; }
    if (this.overlay) ctx.drawImage(this.overlay, 0, 0, W, H);
    // 重伤时的血色暗角、倒下后的黑场
    const hpk = game.hero.hp;
    if (hpk < 0.35 && !game.hero.dead) {
      const a = (0.35 - hpk) / 0.35 * (0.45 + 0.15 * Math.sin(t * 5));
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(120,10,10,0)'); vg.addColorStop(1, `rgba(120,10,10,${a})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    if (game.combat.fade > 0) { ctx.fillStyle = `rgba(10,8,6,${Math.min(1, game.combat.fade * 1.4)})`; ctx.fillRect(0, 0, W, H); }
    this.stats.ms = performance.now() - t0;
  }

  // ---------------------------------------------------------------- 水
  private drawWater(left: number, top: number, right: number, bottom: number, t: number) {
    const { ctx, game } = this;
    const T = game.terrain;
    const step = 150;
    ctx.save();
    ctx.lineCap = 'round';
    const gx0 = Math.floor(left / step), gx1 = Math.floor(right / step), gy0 = Math.floor(top / step), gy1 = Math.floor(bottom / step);
    const z = game.cam.zoom;
    ctx.lineWidth = Math.max(1.2, 1.6 / z);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const h1 = hash2(gx, gy, 61);
      if (h1 > 0.55) continue;
      const h2 = hash2(gx, gy, 62), h3 = hash2(gx, gy, 63);
      const x = (gx + h2) * step, y = (gy + h3) * step;
      if (T.isLand(x, y)) continue;
      const s = T.sample(x, y);
      const deep = s.land < 0.2;
      // 波纹：缓慢漂移、明灭
      const ph = (t * (deep ? 0.22 : 0.35) + h1 * 7) % 1;
      const a = Math.sin(ph * Math.PI);
      const len = (deep ? 40 : 26) + h2 * 30;
      const dx = Math.sin(t * 0.3 + h3 * 6) * 14 + ph * 20;
      ctx.strokeStyle = `rgba(248,252,250,${0.45 * a})`;
      ctx.beginPath();
      ctx.moveTo(x - len / 2 + dx, y);
      ctx.quadraticCurveTo(x + dx, y - 5 - h1 * 4, x + len / 2 + dx, y);
      ctx.stroke();
      if (h1 < 0.18) {
        ctx.strokeStyle = `rgba(40,70,80,${0.18 * a})`;
        ctx.beginPath(); ctx.moveTo(x - len * 0.4 + dx, y + 7); ctx.quadraticCurveTo(x + dx, y + 3, x + len * 0.4 + dx, y + 7); ctx.stroke();
      }
      // 粼光
      if (h1 < 0.08 && game.night < 0.5) {
        const gl = Math.max(0, Math.sin(t * 2.2 + h2 * 20));
        ctx.fillStyle = `rgba(255,255,240,${0.7 * gl * gl})`;
        ctx.fillRect(x + dx * 0.5 - 3, y - 1, 6, 1.6);
      }
    }
    ctx.restore();
  }

  private drawReflections(items: (TreeDeco | MtnDeco)[], t: number) {
    const ctx = this.ctx, z = this.game.cam.zoom;
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (const d of items) {
      let s: Spr | null; let sc = 1;
      if (d.kind === 'mtn') { s = this.mtnSprite(d, z, true); }
      else { s = this.treeSprite(d, z); sc = d.s * TREE_K; }
      if (!s) continue;
      const fl = d.flip ? -1 : 1;
      const wob = Math.sin(t * 1.4 + d.x * 0.01) * 0.015;
      const k = this.Z * sc;
      ctx.setTransform(fl * k, 0, wob * k, -k * 0.55, d.x * this.Z + this.ox, (d.y + 4) * this.Z + this.oy);
      ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
    }
    ctx.restore();
    this.world();
  }

  // ---------------------------------------------------------------- 树、山
  private treeSprite(d: TreeDeco, z: number) {
    const season = this.game.season as Season;
    const res = resBucket(z * this.dpr * d.s * TREE_K, 1.4);
    return sprites.get(`T:${d.sp}:${season}:${d.v}`, res, (r) => makeTree(d.sp, season, (SP_INDEX[d.sp] ?? 0) * 1000 + d.v * 37 + 11, r) as Spr);
  }
  private drawTree(d: TreeDeco, t: number, lodScale: number) {
    const z = this.game.cam.zoom;
    const s = this.treeSprite(d, z);
    if (!s) return;
    const wind = this.game.weather.wind;
    const sw = (Math.sin(t * 1.3 + d.ph) * 0.022 + Math.sin(t * 2.9 + d.ph * 2) * 0.008) * (0.5 + wind) + wind * 0.012;
    const k = this.Z * d.s * TREE_K * lodScale;
    const fl = d.flip ? -1 : 1;
    this.ctx.setTransform(fl * k, 0, sw * k, k, d.x * this.Z + this.ox, d.y * this.Z + this.oy);
    this.ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
    this.world();
  }
  private mtnSprite(d: MtnDeco, z: number, noBuild = false) {
    const res = Math.min(resBucket(z * this.dpr, 0.75), 1800 / d.w, Math.sqrt(1.3e6 / (d.w * d.h)));
    const r = Math.round(res * 100) / 100;
    const make = (rr: number) => {
      const m = makeMountain({ ...d.spec, tex: rr });
      let meta = this.mtnMeta.get(d.id);
      if (!meta) { meta = { falls: m.falls, seen: this.game.time }; this.mtnMeta.set(d.id, meta); if (this.mtnMeta.size > 2000) this.mtnMeta.clear(); }
      meta.falls = m.falls;
      return { canvas: m.canvas, w: m.w, h: m.h, ax: m.ax, ay: m.ay } as Spr;
    };
    if (noBuild && !sprites.has('M:' + d.id)) return null;
    return sprites.get('M:' + d.id, r, make);
  }
  private drawMountain(d: MtnDeco, t: number) {
    const z = this.game.cam.zoom;
    const s = this.mtnSprite(d, z);
    if (!s) return;
    const meta = this.mtnMeta.get(d.id);
    const fade = meta ? clamp((t - meta.seen) / 0.5, 0, 1) : 1;
    const ctx = this.ctx;
    ctx.globalAlpha = fade;
    const fl = d.flip ? -1 : 1;
    ctx.setTransform(fl * this.Z, 0, 0, this.Z, d.x * this.Z + this.ox, d.y * this.Z + this.oy);
    ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
    // 瀑布流动与水雾
    if (meta?.falls.length && z > 0.3) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const f of meta.falls) {
        const x = f.x, y0 = f.y, h = f.h;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, f.w * 0.16);
        ctx.setLineDash([h * 0.12, h * 0.1]);
        ctx.lineDashOffset = -t * h * 0.9;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * f.w * 0.22, y0); ctx.lineTo(x + k * f.w * 0.26, y0 + h); ctx.stroke(); }
        ctx.setLineDash([]);
        for (let k = 0; k < 4; k++) {
          const ph = (t * 0.6 + k / 4) % 1;
          ctx.fillStyle = `rgba(250,252,252,${0.35 * (1 - ph)})`;
          ctx.beginPath(); ctx.ellipse(x + Math.sin(k * 2.1 + t) * f.w * 0.6, y0 + h - ph * f.w * 1.2, f.w * (0.5 + ph * 1.1), f.w * (0.3 + ph * 0.5), 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.world();
  }

  // ---------------------------------------------------------------- 地点
  private drawLocGround(L: LocLayout, x: number, y: number, z: number) {
    const resWant = resBucket(z * this.dpr * LOC_SCALE, 1);
    const res = Math.min(resWant, Math.sqrt(5e6 / (L.gw * L.gh)));
    const r = Math.round(res * 100) / 100;
    const s = sprites.get('G:' + L.id, r, (rr) => renderGround(L, rr) as Spr, true);
    if (!s) return;
    this.ctx.drawImage(s.canvas, x - s.ax * LOC_SCALE, y - s.ay * LOC_SCALE, s.w * LOC_SCALE, s.h * LOC_SCALE);
  }
  private drawFlag(x: number, y: number, color: string, t: number) {
    const ctx = this.ctx, w = this.game.weather.wind;
    ctx.save();
    ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 110); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, y - 108);
    const L = 46, hgt = 26;
    for (let i = 0; i <= 6; i++) { const u = i / 6; ctx.lineTo(x + u * L, y - 108 + Math.sin(t * (4 + w * 3) - u * 4) * 5 * u); }
    for (let i = 6; i >= 0; i--) { const u = i / 6; ctx.lineTo(x + u * L, y - 108 + hgt + Math.sin(t * (4 + w * 3) - u * 4 + 0.4) * 5 * u); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  private drawSmoke(x: number, y: number, t: number, h: number) {
    const ctx = this.ctx, w = this.game.weather.wind;
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.18 + h + k / 5) % 1;
      ctx.fillStyle = `rgba(236,232,224,${0.32 * (1 - ph) * Math.min(1, ph * 6)})`;
      ctx.beginPath(); ctx.arc(x + ph * 60 * (0.4 + w) + Math.sin(ph * 6 + h * 10) * 8, y - ph * 170, 9 + ph * 26, 0, Math.PI * 2); ctx.fill();
    }
  }
  private drawBarrier(L: LocLayout, x: number, y: number, t: number) {
    const b = L.barrier!; const ctx = this.ctx, p = this.game.player;
    const cx = x + b.x * LOC_SCALE, cy = y + b.y * LOC_SCALE, rx = b.rx * LOC_SCALE, ry = b.ry * LOC_SCALE;
    const dx = (p.x - cx) / rx, dy = (p.y - cy) / ry, dd = Math.sqrt(dx * dx + dy * dy);
    const near = clamp(1.6 - dd, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
    const domeH = Math.min(rx, ry * 2) * 0.75;
    ctx.save();
    // 穹顶：半椭圆 + 地面圈
    const gr = ctx.createRadialGradient(cx, cy - domeH * 0.3, Math.min(rx, domeH) * 0.2, cx, cy - domeH * 0.3, Math.max(rx, domeH) * 1.05);
    gr.addColorStop(0, hexA(b.color, 0)); gr.addColorStop(0.75, hexA(b.color, 0.04 + near * 0.05)); gr.addColorStop(1, hexA(b.color, 0.16 + near * 0.12 + pulse * 0.04));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
    ctx.ellipse(cx, cy, rx, domeH + ry * 0.2, 0, Math.PI, Math.PI * 2, false);
    ctx.fill();
    ctx.strokeStyle = hexA(b.color, 0.35 + near * 0.3); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = hexA(b.color, 0.18 + near * 0.25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, domeH + ry * 0.2, 0, Math.PI, Math.PI * 2); ctx.stroke();
    // 经纬阵纹
    ctx.strokeStyle = hexA(b.color, 0.1 + near * 0.18);
    for (let i = 1; i < 4; i++) {
      const k = i / 4;
      ctx.beginPath(); ctx.ellipse(cx, cy - (domeH + ry * 0.2) * Math.sin(k * Math.PI / 2) * 0.95, rx * Math.cos(k * Math.PI / 2), ry * Math.cos(k * Math.PI / 2) * 0.6, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI + (t * 0.05) % (Math.PI / 6);
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(Math.cos(a)) * rx, domeH + ry * 0.2, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    // 符文光点沿地面圈流转
    ctx.fillStyle = hexA(b.color, 0.6 + near * 0.3);
    for (let i = 0; i < 12; i++) { const a = t * 0.25 + (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 人物
  private drawPlayer(dt: number) {
    const { ctx, game } = this;
    const p = game.player, st = p.st;
    ctx.save();
    const lift = st.lift;
    ctx.fillStyle = `rgba(40,40,30,${0.3 - Math.min(0.15, lift / 400)})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 22 + lift * 0.3, 7 + lift * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    // 打坐时的灵气环绕
    if (p.sitting) {
      const t = game.time;
      for (let i = 0; i < 6; i++) {
        const a = t * 1.4 + (i / 6) * Math.PI * 2;
        ctx.fillStyle = `rgba(150,240,200,${0.35 + 0.25 * Math.sin(t * 3 + i)})`;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 46, p.y - 30 + Math.sin(a) * 16, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      if (Math.random() < dt * 6) this.particles.push({ x: p.x + (Math.random() - 0.5) * 140, y: p.y + (Math.random() - 0.5) * 50, vx: 0, vy: -30, life: 0, max: 1.2, size: 3, color: '160,240,210' });
    }
    if (game.gathering) {
      const k = game.gathering.t / 1.2;
      ctx.strokeStyle = 'rgba(255,240,180,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y - 120, 14, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    if (st.action === 'fly' && p.moving && Math.random() < 0.8) {
      const a = st.yaw;
      this.particles.push({ x: p.x - Math.sin(a) * 30 + (Math.random() - 0.5) * 20, y: p.y - lift - Math.cos(a) * 10, vx: -Math.sin(a) * 40, vy: -Math.cos(a) * 20, life: 0, max: 0.6 + Math.random() * 0.5, size: 3 + Math.random() * 4, color: Math.random() < 0.5 ? '120,230,170' : '200,255,220' });
    }
    drawCharacter(ctx, p.look, st, PLAYER_SCALE, dt);
  }
  private drawPlayerGhost() {
    const { ctx, game } = this;
    const p = game.player;
    ctx.save();
    drawCharacter(ctx, p.look, p.st, PLAYER_SCALE, 0, { ghost: true, alpha: 0.28 });
    ctx.restore();
  }

  private updateParticles(dt: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.particles = this.particles.filter((pt) => {
      pt.life += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      const k = 1 - pt.life / pt.max;
      if (k <= 0) return false;
      ctx.fillStyle = `rgba(${pt.color},${0.5 * k})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * k, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
    ctx.restore();
  }

  // ---------------------------------------------------------------- 名牌
  private labelCache = new Map<string, HTMLCanvasElement>();
  private fontReady(text: string) {
    try {
      if (!document.fonts) return true;
      const f = '20px "Ma Shan Zheng"';
      if (document.fonts.check(f, text)) return true;
      document.fonts.load(f, text).catch(() => {});
      return false;
    } catch { return true; }
  }
  private cacheSprite(key: string, make: () => HTMLCanvasElement, text = '') {
    let c = this.labelCache.get(key);
    if (c) return c;
    c = make();
    if (this.fontReady(text + '城镇宗险秘岛（传闻）')) {
      if (this.labelCache.size > 400) this.labelCache.clear();
      this.labelCache.set(key, c);
    }
    return c;
  }
  private makeLabel(l: LocDef, explored: boolean, fs: number) {
    const d = this.dpr;
    const m = document.createElement('canvas').getContext('2d')!;
    const font = `${fs}px "Ma Shan Zheng", "STKaiti", "KaiTi", serif`;
    m.font = font;
    const text = explored ? l.name : l.name + '（传闻）';
    const tw = m.measureText(text).width;
    const seal = fs * 1.05, pad = fs * 0.45;
    const bw = tw + seal + pad * 3, bh = fs * 1.5, lw = Math.max(1.2, fs * 0.07);
    const c = document.createElement('canvas');
    c.width = Math.ceil((bw + lw * 2 + 4) * d); c.height = Math.ceil((bh + lw * 2 + 4) * d);
    const g = c.getContext('2d')!;
    g.scale(d, d); g.translate(lw + 2, lw + 2);
    g.fillStyle = 'rgba(246,239,222,0.94)';
    g.strokeStyle = 'rgba(60,50,40,0.75)'; g.lineWidth = lw;
    const r = bh * 0.18;
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(bw - r, 0); g.quadraticCurveTo(bw, 0, bw, r);
    g.lineTo(bw, bh - r); g.quadraticCurveTo(bw, bh, bw - r, bh);
    g.lineTo(r, bh); g.quadraticCurveTo(0, bh, 0, bh - r); g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
    g.fill(); g.stroke();
    g.fillStyle = LOC_SEAL_COLOR[l.type];
    const sx = pad, sy = (bh - seal) / 2;
    g.fillRect(sx, sy, seal, seal);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#f7eedb';
    g.font = `${seal * 0.78}px "Ma Shan Zheng", "STKaiti", serif`;
    g.fillText(LOC_SEAL[l.type], sx + seal / 2, sy + seal / 2 + seal * 0.04);
    g.fillStyle = explored ? '#2a2620' : '#5a544a';
    g.font = font; g.textAlign = 'left';
    g.fillText(text, sx + seal + pad, bh / 2 + fs * 0.04);
    return c;
  }
  private drawLabel(l: LocDef, x: number, y: number, explored: boolean) {
    const { ctx, game } = this;
    const z = game.cam.zoom;
    if (!l.major && z < 0.35) return;
    const fsW = (l.major ? 22 : 18) / Math.max(z, 0.5) * Math.min(1, 0.55 + z * 0.6);
    const fs = Math.max(8, Math.round(fsW * z));
    const spr = this.cacheSprite(`L|${l.id}|${explored ? 1 : 0}|${fs}|${this.dpr}`, () => this.makeLabel(l, explored, fs), l.name);
    const k = 1 / (z * this.dpr);
    ctx.globalAlpha = explored ? 1 : 0.72;
    ctx.drawImage(spr, x - (spr.width * k) / 2, y, spr.width * k, spr.height * k);
    ctx.globalAlpha = 1;
  }
  private bigLabel(name: string, size: number) {
    return this.cacheSprite(`B|${name}|${size}|${this.dpr}`, () => {
      const d = this.dpr;
      const font = `${size}px "Ma Shan Zheng", "STKaiti", "KaiTi", serif`;
      const m = document.createElement('canvas').getContext('2d')!; m.font = font;
      const text = [...name].join(' ');
      const tw = m.measureText(text).width;
      const c = document.createElement('canvas'); c.width = Math.ceil((tw + 20) * d); c.height = Math.ceil(size * 1.5 * d);
      const g = c.getContext('2d')!; g.scale(d, d);
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgb(50,45,38)';
      g.fillText(text, (tw + 20) / 2, size * 0.75);
      return c;
    }, name);
  }

  private drawSense() {
    const { ctx, game } = this;
    const p = game.player;
    const tier = Math.min(5, game.hero.realm);
    this.sense.draw(ctx, p.x, p.y, tier, this.senseMods, game.time, game.cam.zoom);
  }

  atmoRect = { x: 0, y: 0, w: 0, h: 0 };
  private drawAtmosphere(left: number, top: number, right: number, bottom: number, dt: number) {
    const { game } = this;
    const a = this.atmoCtx, AW = this.atmo.width, AH = this.atmo.height;
    const k = (AW - 2) / (right - left);
    // 对齐到氛围层像素网格，避免低分辨率层随镜头移动而闪烁
    left = Math.floor(left * k) / k; top = Math.floor(top * k) / k;
    right = left + AW / k; bottom = top + AH / k;
    this.atmoRect.x = left; this.atmoRect.y = top; this.atmoRect.w = AW / k; this.atmoRect.h = AH / k;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.clearRect(0, 0, AW, AH);
    a.setTransform(k, 0, 0, k, -left * k, -top * k);
    a.imageSmoothingEnabled = true;
    const fieldW = 9000, fieldH = 6000;
    const clouds: [number, number, number][] = [];
    const wind = 1 + game.weather.wind;
    for (const c of this.driftClouds) {
      c.x += c.v * dt * wind;
      const s = 1400 * c.s;
      const bx = Math.floor((left - s - c.x) / fieldW) * fieldW + c.x;
      const by = Math.floor((top - s - c.y) / fieldH) * fieldH + c.y;
      for (let x = bx; x < right + s; x += fieldW) for (let y = by; y < bottom + s; y += fieldH) clouds.push([x, y, s]);
    }
    a.globalAlpha = 0.08 * (1 - game.night * 0.7);
    for (const [x, y, s] of clouds) a.drawImage(this.cloudShadow, x - s / 2 + 220, y - s / 2 + 320, s, s * 0.6);
    if (!game.revealAll) {
      const fx0 = Math.max(0, Math.floor(left / FOG_CELL) - 1), fx1 = Math.min(FOG_W - 1, Math.floor(right / FOG_CELL) + 1);
      const fy0 = Math.max(0, Math.floor(top / FOG_CELL) - 1), fy1 = Math.min(FOG_H - 1, Math.floor(bottom / FOG_CELL) + 1);
      const t = game.time;
      a.globalAlpha = 0.97;
      for (let fy = fy0; fy <= fy1; fy++) for (let fx = fx0; fx <= fx1; fx++) {
        let fa = 0.97;
        if (game.explored[fy * FOG_W + fx]) {
          const rt = game.revealT.get(fy * FOG_W + fx);
          if (rt === undefined) continue;
          const k2 = (game.time - rt) / 1.8;
          if (k2 >= 1) { game.revealT.delete(fy * FOG_W + fx); continue; }
          fa = 0.97 * (1 - k2 * k2 * (3 - 2 * k2));
        }
        a.globalAlpha = fa;
        const h1 = hash2(fx, fy, 31), h2 = hash2(fx, fy, 32);
        const s = FOG_CELL * (2.0 + h1 * 0.5);
        const x = (fx + 0.5) * FOG_CELL + (h2 - 0.5) * 300 + Math.sin(t * 0.15 + h1 * 6) * 60;
        const y = (fy + 0.5) * FOG_CELL + (h1 - 0.5) * 300;
        a.drawImage(this.cloud, x - s / 2, y - s / 2, s, s);
      }
    }
    a.globalAlpha = (game.cam.zoom < 0.5 ? 0.42 : 0.24) * (game.weather.kind === 'clear' ? 1 : 1.3);
    for (const [x, y, s] of clouds) a.drawImage(this.cloud, x - s / 2, y - s / 2, s, s * 0.6);
    a.globalAlpha = 1;
  }
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
export type { Deco };
