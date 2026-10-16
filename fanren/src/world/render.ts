// 大地图渲染：水墨底图 → 水波 → 倒影 → 地点地面 → (山/树/建筑/生灵/人物 Y 排序) → 护山大阵 → 天空生灵
//            → 昼夜 → 灯火 → 云雾/迷雾 → 名牌 → 神识 → 天气 → 季节纸纹
import { grassSprite, grassRes } from '../gfx/grass';
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
import { artLook } from '../data/artlooks';
import { drawNode } from './nodes';
import type { Drawable } from './life';
import { SenseFx, senseMods } from './sense';
import { collectCombat, drawCombatFx, drawCombatUI } from './combatfx';
import { REALMS } from '../data/realms';
import { GLStage, PostParams } from '../gl/stage';
import { loadBldTex } from '../gfx/bldTex';
import { loadHeadTex } from '../gfx/headTex';
import { MAX_SEG, MAX_TOWN, type GroundSegs, type GroundView, type SegProvider } from '../gl/ground';
import { FxSys } from '../gl/fx';
import { drawCombatGL } from '../gl/combatgl';
import { TIERS } from './sense';

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
  stats = { decos: 0, trees: 0, mtns: 0, ms: 0, grass: 0 };
  sense = new SenseFx();
  senseMods: string[] = [];
  private modsT = 0;

  /** WebGL 合成层（不可用时为 null，回退纯 Canvas2D） */
  stage: GLStage | null = null;
  fx: FxSys | null = null;
  /** 页面上的画布（GL 模式下作为透明 UI 层：名牌、血条、伤害数字） */
  domCanvas: HTMLCanvasElement;
  uiCtx: CanvasRenderingContext2D;
  /** 画质：2 高 / 1 中 / 0 低 */
  tier = 2;

  constructor(game: Game, canvas: HTMLCanvasElement) {
    this.game = game;
    this.domCanvas = canvas;
    // 建筑贴图就绪后，丢掉已缓存的程序绘制版本
    loadBldTex(() => sprites.clearBase('P:'));
    loadHeadTex();
    const q = typeof location !== 'undefined' ? location.search : '';
    let wantGL = !/[?&]gl=0/.test(q);
    try { if (localStorage.getItem('fanren.gl') === '0' && !/[?&]gl=1/.test(q)) wantGL = false; } catch { /* */ }
    this.stage = wantGL ? GLStage.create() : null;
    if (this.stage) {
      this.canvas = document.createElement('canvas');
      // 透明：底下是 GPU 地表（gl/ground.ts），Canvas 只画地表之上的东西
      this.ctx = this.canvas.getContext('2d', { alpha: true })!;
      this.groundWanted = !/[?&]ground=0/.test(q);
      this.uiCtx = canvas.getContext('2d')!;
      const gc = this.stage.canvas; gc.className = 'game-gl';
      canvas.parentElement?.insertBefore(gc, canvas);
      this.fx = new FxSys(this.stage.batch);
    } else {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false })!;
      this.uiCtx = this.ctx;
    }
    this.cloud = this.makeCloud();
    this.cloudShadow = this.makeCloudShadow();
    this.glow = this.makeGlow();
    this.atmo = document.createElement('canvas');
    this.atmoCtx = this.atmo.getContext('2d')!;
    for (let i = 0; i < 14; i++) this.driftClouds.push({ x: Math.random() * 9000, y: Math.random() * 6000, s: 0.8 + Math.random() * 1.4, v: 18 + Math.random() * 25 });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  dispose() {
    if (this.stage) { this.stage.canvas.remove(); this.stage.gl.getExtension('WEBGL_lose_context')?.loseContext(); this.stage = null; }
  }

  resize() {
    const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2, this.maxDpr ?? 1.5);
    const el = this.domCanvas;
    this.W = el.clientWidth || window.innerWidth;
    this.H = el.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    if (this.stage) {
      // UI 层与 GL 输出用设备像素比（文字清晰），世界层可按画质降采样
      const ud = Math.min(window.devicePixelRatio || 1, 2);
      this.domCanvas.width = Math.round(this.W * ud); this.domCanvas.height = Math.round(this.H * ud);
      this.uiDpr = ud;
      // 后期输出与世界层同分辨率（高分屏上不再按 2× 跑整套后期）
      const sd = Math.min(ud, Math.max(1, this.dpr));
      this.stage.resize(this.W * sd, this.H * sd);
      this.stage.bloomOn = this.tier >= 1;
    }
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

  uiDpr = 1;
  private perfT = 0; private perfN = 0; private perfAcc = 0; private lowered = 0;
  /** 卡顿统计（F3 面板显示）：超过 50ms 的帧数 */
  spikes = 0;
  /** 每级画质：世界层像素比上限 / 地表缓存分辨率 / 特效档 */
  private static LEVELS = [
    { dpr: 1.5, ground: 1.25, tier: 2, fx: 1 },
    { dpr: 1.25, ground: 1.0, tier: 2, fx: 1 },
    { dpr: 1.0, ground: 0.85, tier: 1, fx: 1 },
    { dpr: 1.0, ground: 0.7, tier: 0, fx: 0.5 },
  ];
  private applyLevel(i: number) {
    const L = Renderer.LEVELS[Math.max(0, Math.min(3, i))];
    this.maxDpr = L.dpr; this.groundScale = L.ground; this.tier = L.tier;
    if (this.fx) this.fx.quality = L.fx;
    this.resize();
  }
  /** 自适应画质：每 2.5 秒看一次平均帧时，低于 ~48 帧就降一级（最多 3 级） */
  private adapt(dt: number) {
    if (dt > 0.05) this.spikes++;
    if (this.lowered >= 3 || dt <= 0 || this.fixedQuality) return;
    if (dt > 0.25) return; // 切页、加载造成的单次长帧不计入
    this.perfT += dt; this.perfN++; this.perfAcc += dt;
    if (this.perfT > 2.5) {
      const avg = this.perfAcc / this.perfN;
      if (avg > 1 / 48) { this.lowered++; this.applyLevel(this.lowered); }
      this.perfT = 0; this.perfN = 0; this.perfAcc = 0;
    }
  }
  get qualityLevel() { return this.lowered; }
  fixedQuality = false;
  /** 手动画质：0 低 1 中 2 高 */
  setQuality(q: number) {
    this.fixedQuality = true;
    if (q >= 2) { this.lowered = 0; this.applyLevel(0); this.maxDpr = 2; this.groundScale = 1.5; this.resize(); }
    else { this.lowered = q === 1 ? 1 : 3; this.applyLevel(this.lowered); }
    this.tier = q;
  }
  maxDpr = 1.5;

  /** 实时草丛：缓存位图 + 斜切摇摆（只有神识圈内会动，圈外是静止的记忆） */
  private drawGrass(left: number, top: number, right: number, bottom: number, t: number, season: number, z: number) {
    const { ctx, game } = this;
    const T = game.terrain;
    const res = grassRes(z * this.dpr);
    const lod = z < 0.65 ? 0 : z < 0.85 ? 1 : 2;
    const wind = game.weather.wind;
    const px = game.player.x, py = game.player.y, R = this.sense.dispR || 600, R2 = R * R;
    const Z = this.Z;
    let n = 0;
    for (let cy = Math.floor((top - 10) / CHUNK); cy <= Math.floor((bottom + 60) / CHUNK); cy++) for (let cx = Math.floor((left - 40) / CHUNK); cx <= Math.floor((right + 40) / CHUNK); cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK > WORLD_W || cy * CHUNK > WORLD_H) continue;
      if (!this.groundOn && !T.getChunk(cx, cy, false)) continue;
      for (const c of T.getGrass(cx, cy)) {
        if (c.lod > lod) continue;
        // GPU 地表已有细密的手绘草丛：位图草只留较高、较显眼的几种，作为会摇、会分开的前景
        if (this.groundOn && (c.kind === 'sprig' || ((c.kind === 'tuft' || c.kind === 'clover') && c.ph > 1.6) || c.lod > 1)) continue;
        if (c.x < left - 40 || c.x > right + 40 || c.y < top - 5 || c.y > bottom + 60) continue;
        const sp = grassSprite(c.kind, c.v, season, res);
        const dx = c.x - px, dy = c.y - py;
        const d2 = dx * dx + dy * dy;
        let sk = wind * 0.12;
        if (d2 < R2) {
          sk += (Math.sin(t * 1.7 + c.ph + c.x * 0.004) * 0.16 + Math.sin(t * 3.1 + c.ph * 2) * 0.05) * (0.45 + wind);
          // 人走过时草向两侧分开
          if (d2 < 3600) sk += (dx > 0 ? 1 : -1) * (1 - Math.sqrt(d2) / 60) * 0.5;
        }
        const s = c.s;
        ctx.setTransform(Z * s, 0, -sk * Z * s, Z * s, c.x * Z + this.ox, c.y * Z + this.oy);
        ctx.drawImage(sp.canvas, -sp.ax, -sp.ay, sp.w, sp.h);
        n++;
      }
    }
    this.stats.grass = n;
    this.world();
  }

  private sfx: { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number; age: number; c: string; s: number; k: number }[] = [];
  private drawSeasonFx(dt: number, season: number, px: number, py: number, R: number) {
    const { ctx, game } = this;
    const wk = game.weather.kind as string;
    const ok = (wk === 'clear' || wk === 'cloudy') && season !== 3 && game.cam.zoom > 0.4;
    const wind = game.weather.wind;
    if (ok && dt > 0) {
      const rate = season === 2 ? 7 : season === 0 ? 6 : 2.5;
      let n = rate * dt;
      while (n > 0 && this.sfx.length < 70) {
        if (Math.random() > n) break; n -= 1;
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.95;
        const C = season === 0 ? ['#f6c6d2', '#f9dde4', '#ffffff', '#efb0c2'] : season === 2 ? ['#d8902e', '#c0582a', '#e8b84a', '#a8402a'] : ['#fbfaf2'];
        this.sfx.push({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d - 120, vx: 20 + wind * 60, vy: season === 1 ? 6 : 26, r: Math.random() * 6, vr: (Math.random() - 0.5) * 4,
          life: 5 + Math.random() * 4, age: 0, c: C[(Math.random() * C.length) | 0], s: season === 2 ? 4 + Math.random() * 3 : 2.4 + Math.random() * 1.6, k: season });
      }
    }
    if (!this.sfx.length) return;
    const t = game.time;
    for (let i = this.sfx.length - 1; i >= 0; i--) {
      const f = this.sfx[i];
      f.age += dt;
      const sway = Math.sin(t * 1.8 + f.r * 3) * (f.k === 1 ? 14 : 26);
      f.x += (f.vx + sway) * dt; f.y += (f.vy + Math.cos(t * 2.3 + f.r) * 8) * dt; f.r += f.vr * dt;
      const dd = Math.hypot(f.x - px, f.y - py);
      if (f.age > f.life || dd > R * 1.05) { this.sfx.splice(i, 1); continue; }
      const a = Math.min(1, f.age * 2, (f.life - f.age) * 0.8, (R - dd) / 60);
      ctx.globalAlpha = Math.max(0, a) * 0.9;
      ctx.fillStyle = f.c;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r);
      const flip = Math.abs(Math.cos(t * 3 + f.r * 2));
      ctx.scale(1, 0.25 + flip * 0.75);
      ctx.beginPath();
      if (f.k === 2) { // 叶：两头尖
        ctx.moveTo(-f.s, 0); ctx.quadraticCurveTo(0, -f.s * 0.7, f.s, 0); ctx.quadraticCurveTo(0, f.s * 0.7, -f.s, 0);
      } else if (f.k === 0) { // 花瓣：一端圆一端尖
        ctx.moveTo(-f.s, 0); ctx.quadraticCurveTo(-f.s * 0.2, -f.s * 0.9, f.s, -f.s * 0.15); ctx.quadraticCurveTo(f.s * 0.6, f.s * 0.5, -f.s, 0);
      } else { // 柳絮：一团软毛
        ctx.arc(0, 0, f.s * 0.8, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

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
    if (this.domCanvas.clientWidth !== W || this.domCanvas.clientHeight !== H) this.resize();
    const GL = !!this.stage && !this.stage.lost;
    const ui = GL ? this.uiCtx : ctx;
    if (GL) { ui.setTransform(1, 0, 0, 1, 0, 0); ui.clearRect(0, 0, this.domCanvas.width, this.domCanvas.height); }
    const t = game.time;
    const season = game.season as Season;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.quality;
    const T0 = game.terrain;
    if (GL && this.groundWanted && !this.groundSet && T0.land) { this.stage!.setTerrain(T0.glData()); this.groundSet = true; }
    const GROUND = GL && this.groundWanted && this.stage!.groundReady;
    this.groundOn = GROUND;
    if (GROUND) ctx.clearRect(0, 0, W, H);
    else { ctx.fillStyle = '#e9dfc6'; ctx.fillRect(0, 0, W, H); }

    const sh = (this.sense.alarm > 0.3 ? (this.sense.alarm - 0.3) * 5 : 0) / z;
    // 震屏：创伤值平方 × 平滑噪声（随时间连续，不抖成白噪）
    const tr = game.trauma, tk = tr * tr * 15 / z, rt = performance.now() / 1000;
    const camX = game.cam.x + (sh ? Math.sin(game.time * 47) * sh : 0) + (tk ? (Math.sin(rt * 41.3) + Math.sin(rt * 67.1) * 0.5) * tk : 0);
    const camY = game.cam.y + (sh ? Math.cos(game.time * 53) * sh : 0) + (tk ? (Math.cos(rt * 37.7) + Math.sin(rt * 59.3) * 0.5) * tk : 0);
    const left = camX - W / 2 / z, top = camY - H / 2 / z, right = camX + W / 2 / z, bottom = camY + H / 2 / z;
    this.Z = z * dpr; this.ox = W * dpr / 2 - camX * this.Z; this.oy = H * dpr / 2 - camY * this.Z;
    this.world();
    const T = game.terrain;
    T.season = season;

    // ---------- 1. 底图分块（GPU 地表开启时跳过）----------
    const cx0 = Math.floor(left / CHUNK), cx1 = Math.floor(right / CHUNK);
    const cy0 = Math.floor(top / CHUNK), cy1 = Math.floor(bottom / CHUNK);
    if (!GROUND) {
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
      if ((!ch || ch.season !== T.season) && builds < maxBuilds) { ch = T.getChunk(cx, cy, true); builds++; }
      if (!ch) { missing++; continue; }
      const inView = (cx + 1) * CHUNK > left && cx * CHUNK < right && (cy + 1) * CHUNK > top && cy * CHUNK < bottom;
      if (inView) ctx.drawImage(ch.canvas, cx * CHUNK - 0.6, cy * CHUNK - 0.6, CHUNK + 1.2, CHUNK + 1.2);
    }
    this.pendingBuilds = missing;
    } else this.pendingBuilds = 0;

    // ---------- 2. 水波（GPU 地表自带流水、浪花、粼光）----------
    if (z >= 0.35 && !GROUND) this.drawWater(left, top, right, bottom, t);
    // ---------- 2b. 草丛 ----------
    if (z >= 0.42) this.drawGrass(left, top, right, bottom, t, season, z);

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
          const s = pc.kind === 'tree'
            ? sprites.getAsync(key, pres, (r) => ({ kind: 'T', sp: pc.p.sp, season, seed: pc.seed, res: r }), (r) => renderPiece(pc, L.pal, r, season) as Spr)
            : sprites.get(key, pres, (r) => renderPiece(pc, L.pal, r, season) as Spr);
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
    game.story.collect(list, view, t, dt);
    game.sites.collect(list, view, t, dt); game.home.collect(list, view, t); game.happen.collect(list, view, t, dt); game.pets.collect(list); game.heartx.collect(list);
    list.push({ y: p.flying ? p.y + 200000 : p.y, draw: () => this.drawPlayer(dt) });   // 御器飞行：在山树之上

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

    // ---------- 8.5 四季飘物：春花瓣、夏柳絮、秋落叶（仅神识圈内）----------
    this.drawSeasonFx(dt, season, p.x, p.y, R);

    // ---------- 9. 昼夜 + 天气暗化（multiply）----------
    const night = game.night, light = game.light;
    const dusk = clamp(1 - Math.abs(light - 0.52) / 0.2, 0, 1) * (1 - night) * 0.7;
    const gloom = game.weather.gloom + game.weather.flash * -0.3;
    let mulR = 255, mulG = 255, mulB = 255;
    if (night > 0.01 || dusk > 0.01 || gloom > 0.01) {
      let r = 255, g = 255, bb = 255;
      r += (255 - r) * dusk; g += (200 - g) * dusk; bb += (160 - bb) * dusk;
      r += (70 - r) * night * 0.85; g += (80 - g) * night * 0.85; bb += (130 - bb) * night * 0.85;
      const gl = clamp(gloom, 0, 0.6);
      r += (150 - r) * gl; g += (156 - g) * gl; bb += (168 - bb) * gl;
      mulR = r; mulG = g; mulB = bb;
    }
    if (!GL && (night > 0.01 || dusk > 0.01 || gloom > 0.01)) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${mulR | 0},${mulG | 0},${mulB | 0})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
    // 调色：白昼略增反差与暖意（避免发灰），晨昏金色柔光
    const dayK = (1 - night) * (1 - clamp(gloom, 0, 1));
    if (!GL) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'soft-light';
      if (dayK > 0.05) { ctx.fillStyle = `rgba(255,236,196,${0.22 * dayK * (1 - dusk)})`; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
      if (dusk > 0.03) {
        const gr = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height * 0.6);
        gr.addColorStop(0, `rgba(255,170,80,${0.75 * dusk})`); gr.addColorStop(1, `rgba(255,120,90,${0.2 * dusk})`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalCompositeOperation = 'screen';
        const cw = this.canvas.width, chh = this.canvas.height;
        const sg = ctx.createRadialGradient(cw * 0.1, -chh * 0.1, 0, cw * 0.1, -chh * 0.1, Math.max(cw, chh) * 1.1);
        sg.addColorStop(0, `rgba(255,170,90,${0.3 * dusk})`); sg.addColorStop(1, 'rgba(255,150,90,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, cw, chh);
      }
      ctx.restore();
    }
    // 灯火
    const F = this.fx;
    if (GL && F) {
      // WebGL 批次：神识圈（最底）→ 灯火 → 战斗特效 → 粒子
      const B = this.stage!.batch;
      B.reset(camX, camY, z, W, H, this.stage!.atlas);
      F.update(dt);
      if (!(game.revealAll && game.debugSeeAll)) this.sense.drawGL(F, this.stage!, p.x, p.y, Math.min(5, game.hero.realm), this.senseMods, game.time, z);
      if (night > 0.05) {
        for (const l of visibleLocs) {
          const L = this.layout(l), lx = l.x * WORLD_SCALE, ly = l.y * WORLD_SCALE;
          L.lights.forEach((li, i) => {
            const vis = clamp((R - Math.hypot(lx + li.x * LOC_SCALE - p.x, ly + li.y * LOC_SCALE - p.y)) / 120, 0, 1);
            if (vis <= 0) return;
            const fl = 0.85 + 0.15 * Math.sin(t * 7 + i * 1.7) * Math.sin(t * 3.1 + i);
            const rr = li.r * LOC_SCALE * 2.4 * fl;
            B.quad(0, lx + li.x * LOC_SCALE, ly + li.y * LOC_SCALE, rr * 2, rr * 1.6, 0, 1, 0.72, 0.4, night * 0.6 * vis, 1);
            B.quad(1, lx + li.x * LOC_SCALE, ly + li.y * LOC_SCALE, rr * 0.35, rr * 0.3, 0, 1, 0.85, 0.6, night * 0.8 * vis, 1);
          });
        }
        B.quad(0, p.x, p.y - 50, 320, 240, 0, 1, 0.8, 0.55, night * 0.22, 1);
        game.life.collectGlow(night, (x, y, r, a) => { B.quad(0, x, y, r * 2.6, r * 2.6, 0, 0.85, 1, 0.55, a, 1); B.quad(26, x, y, r * 0.5, r * 0.5, 0, 1, 1, 0.8, a, 1); });
      }
      drawCombatGL(F, game.combat, t, dt);
      game.story.drawGL(F, t);
      F.drawRings(dt);
      F.drawParticles();
    } else {
      game.combat.fxq.length = 0;
    }
    if (!GL && night > 0.05) {
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
    if (!GL) drawCombatFx(ctx, game.combat, t);

    // ---------- 9.5 神识之外：记忆水墨（褪色、留白，不见动静）----------
    if (!GL && !(game.revealAll && game.debugSeeAll)) {
      const sx = (W / 2 + (p.x - camX) * z) * dpr, sy = (H / 2 + (p.y - camY) * z) * dpr;
      this.sense.drawMemory(ctx, sx, sy, R * z * dpr, this.canvas.width, this.canvas.height, this.lowered >= 1);
      this.world();
    }

    // ---------- 10. 氛围层 ----------
    this.drawAtmosphere(left, top, right, bottom, dt);
    if (!GL) ctx.drawImage(this.atmo, this.atmoRect.x, this.atmoRect.y, this.atmoRect.w, this.atmoRect.h);

    // —— 以下为 UI 层（GL 模式下画在透明画布上，不受调色、记忆水墨影响）
    const sceneCtx = this.ctx, sceneZ = this.Z, sceneOx = this.ox, sceneOy = this.oy, sceneDpr = this.dpr;
    if (GL) {
      this.ctx = ui; this.dpr = this.uiDpr;
      this.Z = z * this.uiDpr; this.ox = W * this.uiDpr / 2 - camX * this.Z; this.oy = H * this.uiDpr / 2 - camY * this.Z;
      this.world();
    }
    // 血条与伤害数字
    drawCombatUI(this.ctx, game.combat, t, z);

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
    if (!GL) this.drawSense();

    // ---------- 13. 屏幕空间：天气、大区域名、纸纹 ----------
    const cdx = dt > 0 ? (camX - this.lastCam.x) / dt * z : 0, cdy = dt > 0 ? (camY - this.lastCam.y) / dt * z : 0;
    this.lastCam.x = camX; this.lastCam.y = camY;
    // 雨雪画在世界层（GL 模式下整屏雾/闪电的填色交给着色器）
    sceneCtx.setTransform(sceneDpr, 0, 0, sceneDpr, 0, 0);
    game.weather.noFills = GL;
    game.weather.draw(sceneCtx, W, H, dt, clamp(cdx, -800, 800), clamp(cdy, -800, 800));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (z < 0.6) {
      const a = clamp((0.6 - z) / 0.3, 0, 1) * 0.55;
      this.ctx.globalAlpha = a;
      for (const b of BIG_LABELS) {
        const sx = W / 2 + (b.at[0] * WORLD_SCALE - camX) * z, sy = H / 2 + (b.at[1] * WORLD_SCALE - camY) * z;
        if (sx < -400 || sx > W + 400 || sy < -200 || sy > H + 200) continue;
        const spr = this.bigLabel(b.name, Math.round(b.size * 16 + 18));
        const w = spr.width / dpr, h = spr.height / dpr;
        this.ctx.drawImage(spr, sx - w / 2, sy - h / 2, w, h);
      }
      this.ctx.globalAlpha = 1;
    }
    if (GL) {
      this.ctx = sceneCtx; this.Z = sceneZ; this.ox = sceneOx; this.oy = sceneOy; this.dpr = sceneDpr;
      this.postGL(camX, camY, z, W, H, night, dusk, gloom, dayK, [mulR, mulG, mulB], R);
      this.stats.ms = performance.now() - t0;
      return;
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

  // ---------------------------------------------------------------- GPU 地表参数
  private groundWanted = false; private groundSet = false; groundOn = false;
  private gSeg = new Float32Array(MAX_SEG * 16);
  private gTown = new Float32Array(MAX_TOWN * 4); private gTownS = new Int32Array(MAX_TOWN * 4);
  /** 地表缓存需要重画时才调用：收集缓存范围内（中心 camX,camY，半宽 hw0/hh0）的河段、路段、城镇 */
  private segProvider: SegProvider = (camX, camY, hw0, hh0) => this.groundSegs(camX, camY, hw0, hh0);
  /** 地表缓存分辨率（每 CSS 像素纹素数），随画质自适应 */
  groundScale = 1.25;
  private groundSegs(camX: number, camY: number, hw0: number, hh0: number): GroundSegs {
    const game = this.game, T = game.terrain, seg = this.gSeg, ROW = MAX_SEG * 4;
    const hw = hw0 + 60, hh = hh0 + 60;
    const cull = (A: Float32Array, row: number, pad: number) => {
      let n = 0;
      for (let q = 0; q < A.length && n < MAX_SEG; q += 8) {
        const ax = A[q] - camX, ay = A[q + 1] - camY, bx = A[q + 2] - camX, by = A[q + 3] - camY, m = A[q + 4] + pad;
        if ((ax > bx ? ax : bx) < -hw - m || (ax < bx ? ax : bx) > hw + m || (ay > by ? ay : by) < -hh - m || (ay < by ? ay : by) > hh + m) continue;
        const o = row * ROW + n * 4, o2 = o + ROW;
        seg[o] = ax; seg[o + 1] = ay; seg[o + 2] = bx; seg[o + 3] = by;
        seg[o2] = A[q + 4]; seg[o2 + 1] = A[q + 5]; seg[o2 + 2] = A[q + 6]; seg[o2 + 3] = 0;
        n++;
      }
      return n;
    };
    const nRiv = cull(T.rivSegW, 0, 820), nRoad = cull(T.roadSegW, 2, 200);
    let nTown = 0;
    for (const l of LOCATIONS) {
      if (nTown >= MAX_TOWN) break;
      if (l.type !== 'city' && l.type !== 'town') continue;
      const RR = l.type === 'city' ? 2700 : 1800;
      const lx = l.x * WORLD_SCALE - camX, ly = l.y * WORLD_SCALE - camY;
      if (Math.abs(lx) > hw + RR + 400 || Math.abs(ly) > hh + RR + 400) continue;
      const o = nTown * 4;
      this.gTown[o] = lx; this.gTown[o + 1] = ly; this.gTown[o + 2] = RR; this.gTown[o + 3] = (hash2(l.x, l.y, 77) - 0.5) * 0.7;
      this.gTownS[o] = (l.x * 7) | 0; this.gTownS[o + 1] = (l.y * 13) | 0;
      nTown++;
    }
    return { seg: seg.slice(), nRiv, nRoad, town: this.gTown.slice(0, nTown * 4), townS: this.gTownS.slice(0, nTown * 4), nTown };
  }
  private groundView(camX: number, camY: number, z: number, W: number, H: number): GroundView {
    return { camX, camY, zoom: z, cssW: W, cssH: H, season: this.game.season, scale: Math.min(this.groundScale, this.dpr) };
  }

  // ---------------------------------------------------------------- WebGL 后期
  private postGL(camX: number, camY: number, z: number, W: number, H: number, night: number, dusk: number, gloom: number, dayK: number, mul: number[], R: number) {
    const game = this.game, p = game.player, st = this.stage!, F = this.fx!;
    const wt = game.weather;
    const month = Math.floor(game.day / 30) % 12;
    const tint: [number, number, number, number] = month < 3 ? [0.7, 0.86, 0.67, 0.05] : month < 6 ? [1, 0.9, 0.63, 0.05] : month < 9 ? [0.9, 0.59, 0.31, 0.07] : [0.78, 0.84, 0.94, 0.12];
    const tierS = TIERS[Math.min(5, game.hero.realm)];
    const sx = W / 2 + (p.x - camX) * z, sy = H / 2 + (p.y - camY) * z;
    const hpk = game.hero.hp;
    const hurt = (hpk < 0.35 && !game.hero.dead ? (0.35 - hpk) / 0.35 * (0.45 + 0.15 * Math.sin(game.time * 5)) : 0) + game.hurtFlash * 0.35;
    const k = wt.k;
    const fog: [number, number, number, number] = wt.kind === 'sand' ? [0.77, 0.63, 0.43, 0.28 * k] : wt.kind === 'fog' ? [0.9, 0.91, 0.89, 0.18 * k] : [0, 0, 0, 0];
    const mind = game.story?.mind ?? 0;
    const tintM: [number, number, number, number] = mind > 0.01 ? [tint[0] + (0.55 - tint[0]) * mind, tint[1] + (0.12 - tint[1]) * mind, tint[2] + (0.14 - tint[2]) * mind, tint[3] + 0.38 * mind] : tint;
    const P: PostParams = {
      t: game.time,
      mul: [mul[0] / 255, mul[1] / 255, mul[2] / 255],
      warm: dayK > 0.05 ? 0.22 * dayK * (1 - dusk) : 0,
      dusk: dusk > 0.03 ? dusk : 0,
      sense: { x: sx, y: sy, R: R * z, on: !(game.revealAll && game.debugSeeAll), ink: tierS.ink.map((v) => v / 255) as [number, number, number], glow: tierS.glow.map((v) => v / 255) as [number, number, number], hide: this.sense.hidden, alarm: this.sense.alarm },
      atmo: { canvas: this.atmo, x: W / 2 + (this.atmoRect.x - camX) * z, y: H / 2 + (this.atmoRect.y - camY) * z, w: this.atmoRect.w * z, h: this.atmoRect.h * z },
      fog, fogBands: wt.kind === 'fog' ? k : 0,
      flash: [0.92, 0.94, 1, wt.flash * 0.55],
      tint: tintM,
      vig: 1 + mind * 0.8, hurt: Math.min(0.8, hurt + mind * 0.18), fade: Math.min(1, game.combat.fade * 1.4),
      aberr: game.trauma > 0.25 ? (game.trauma - 0.25) * 1.2 : 0,
      bloom: 0.9, grain: 1,
      shocks: F.shocks.map((s) => ({ x: W / 2 + (s.x - camX) * z, y: H / 2 + (s.y - camY) * z, r: s.r * z, amp: s.amp * Math.min(1.5, z * 1.2) })),
      sat: 0,
      ground: this.groundOn ? { view: this.groundView(camX, camY, z, W, H), provider: this.segProvider } : null,
    };
    st.frame(this.canvas, W, H, st.W / W, P);
  }

  // ---------------------------------------------------------------- 水
  private drawWater(left: number, top: number, right: number, bottom: number, t: number) {
    const { ctx, game } = this;
    const T = game.terrain;
    const step = 105;
    ctx.save();
    ctx.lineCap = 'round';
    const gx0 = Math.floor(left / step), gx1 = Math.floor(right / step), gy0 = Math.floor(top / step), gy1 = Math.floor(bottom / step);
    const z = game.cam.zoom;
    ctx.lineWidth = Math.max(1.2, 1.6 / z);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const h1 = hash2(gx, gy, 61);
      if (h1 > 0.62) continue;
      const h2 = hash2(gx, gy, 62), h3 = hash2(gx, gy, 63);
      const x = (gx + h2) * step, y = (gy + h3) * step;
      if (T.isLand(x, y)) continue;
      const s = T.sample(x, y);
      const deep = s.land < 0.2;
      // 波纹：缓慢漂移、明灭
      const ph = (t * (deep ? 0.22 : 0.35) + h1 * 7) % 1;
      const a = Math.sin(ph * Math.PI);
      const len = (deep ? 50 : 30) + h2 * 40;
      const dx = Math.sin(t * 0.3 + h3 * 6) * 14 + ph * 20;
      ctx.strokeStyle = `rgba(30,64,80,${0.16 * a})`;
      ctx.beginPath(); ctx.moveTo(x - len * 0.45 + dx, y + 4); ctx.quadraticCurveTo(x + dx, y - 1 - h1 * 4, x + len * 0.45 + dx, y + 4); ctx.stroke();
      ctx.strokeStyle = `rgba(248,252,250,${0.55 * a})`;
      ctx.beginPath();
      ctx.moveTo(x - len / 2 + dx, y);
      ctx.quadraticCurveTo(x + dx, y - 5 - h1 * 4, x + len / 2 + dx, y);
      ctx.stroke();
      if (h1 < 0.18) {
        ctx.strokeStyle = `rgba(40,70,80,${0.18 * a})`;
        ctx.beginPath(); ctx.moveTo(x - len * 0.4 + dx, y + 7); ctx.quadraticCurveTo(x + dx, y + 3, x + len * 0.4 + dx, y + 7); ctx.stroke();
      }
    }
    // 粼光：日光下的细碎闪点（夜里换成月色）
    if (z > 0.45) {
      const gs = 70, day = 1 - game.night;
      const col = day > 0.5 ? '255,252,232' : '220,230,255';
      for (let gy = Math.floor(top / gs); gy <= Math.floor(bottom / gs); gy++) for (let gx = Math.floor(left / gs); gx <= Math.floor(right / gs); gx++) {
        const h = hash2(gx, gy, 71);
        if (h > 0.3) continue;
        const x = (gx + hash2(gx, gy, 72)) * gs, y = (gy + hash2(gx, gy, 73)) * gs;
        if (T.isLand(x, y)) continue;
        const gl = Math.sin(t * (1.6 + h * 3) + h * 40);
        if (gl < 0.55) continue;
        const k = (gl - 0.55) / 0.45, a = k * k * (day > 0.5 ? 0.85 : 0.45);
        const L = 5 + h * 20;
        ctx.fillStyle = `rgba(${col},${a})`;
        ctx.beginPath(); ctx.ellipse(x, y, L * (0.5 + k * 0.5), 1.6, 0, 0, Math.PI * 2); ctx.fill();
        if (h < 0.04 && k > 0.7) { ctx.fillRect(x - 0.6, y - 5 * k, 1.2, 10 * k); }
      }
    }
    // 岸边浪花：贴着画出的岸线一涨一退
    if (z > 0.4) {
      const fs = 34;
      ctx.lineWidth = Math.max(1.3, 1.8 / z);
      for (let gy = Math.floor(top / fs); gy <= Math.floor(bottom / fs); gy++) for (let gx = Math.floor(left / fs); gx <= Math.floor(right / fs); gx++) {
        let x = (gx + 0.5) * fs, y = (gy + 0.5) * fs;
        const L0 = T.visLand(x, y);
        if (Math.abs(L0 - 0.5) > 0.09) continue;
        const ex = (T.visLand(x + 8, y) - T.visLand(x - 8, y)) / 16, ey = (T.visLand(x, y + 8) - T.visLand(x, y - 8)) / 16;
        const g2 = ex * ex + ey * ey;
        if (g2 < 1e-9) continue;
        // 牛顿一步投到岸线上
        const k0 = (L0 - 0.5) / g2;
        x -= ex * k0; y -= ey * k0;
        if (Math.abs(x - (gx + 0.5) * fs) > fs * 0.6 || Math.abs(y - (gy + 0.5) * fs) > fs * 0.6) continue;
        const n = Math.sqrt(g2), nx = ex / n, ny = ey / n; // 指向陆地
        const h = hash2(gx, gy, 75);
        for (let w = 0; w < 2; w++) {
          const ph = (t * 0.22 + h * 0.5 + w * 0.5 + (x + y) * 0.0003) % 1;
          const a = Math.sin(ph * Math.PI) * (w ? 0.45 : 0.7);
          const back = 3 + (1 - ph) * 16 + w * 4;   // 浪从外向岸推进
          const cx2 = x - nx * back, cy2 = y - ny * back, hl = 13 + h * 6;
          ctx.strokeStyle = `rgba(252,253,248,${a})`;
          ctx.beginPath();
          ctx.moveTo(cx2 - ny * hl, cy2 + nx * hl);
          ctx.quadraticCurveTo(cx2 + nx * 4, cy2 + ny * 4, cx2 + ny * hl, cy2 - nx * hl);
          ctx.stroke();
        }
      }
    }
    // 河流：顺流而下的细碎水光
    if (z > 0.35) {
      ctx.lineCap = 'round';
      for (const rv of T.rivers) {
        const bb = (rv as any)._bb ?? ((rv as any)._bb = (() => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [px, py] of rv.pts) { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); d = Math.max(d, py); } return [a * WORLD_SCALE - 200, b * WORLD_SCALE - 200, c * WORLD_SCALE + 200, d * WORLD_SCALE + 200]; })());
        if (bb[2] < left || bb[0] > right || bb[3] < top || bb[1] > bottom) continue;
        const pts = rv.pts;
        const w = 70 * rv.w;
        for (let lane = -1; lane <= 1; lane++) {
          ctx.beginPath();
          let started = false;
          for (let k = 0; k < pts.length; k++) {
            const x = pts[k][0] * WORLD_SCALE, y = pts[k][1] * WORLD_SCALE;
            const k2 = Math.min(pts.length - 1, k + 1), k1 = Math.max(0, k - 1);
            let tx = pts[k2][0] - pts[k1][0], ty = pts[k2][1] - pts[k1][1]; const tn = Math.hypot(tx, ty) || 1; tx /= tn; ty /= tn;
            const off = lane * w * 0.26;
            const px = x - ty * off, py = y + tx * off;
            if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
          }
          ctx.setLineDash([10 + lane * 3, 46 + lane * 9]);
          ctx.lineDashOffset = -t * (34 + lane * 6);
          ctx.strokeStyle = `rgba(250,254,252,${lane === 0 ? 0.5 : 0.3})`;
          ctx.lineWidth = lane === 0 ? 2.2 : 1.6;
          ctx.stroke();
        }
        ctx.setLineDash([]);
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
    const seed = (SP_INDEX[d.sp] ?? 0) * 1000 + d.v * 37 + 11;
    return sprites.getAsync(`T:${d.sp}:${season}:${d.v}`, res, (r) => ({ kind: 'T', sp: d.sp, season, seed, res: r }), (r) => makeTree(d.sp, season, seed, r) as Spr);
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
    return sprites.getAsync('M:' + d.id, r, (rr) => ({ kind: 'M', spec: { ...d.spec, tex: rr } }), make, (m) => {
      let meta = this.mtnMeta.get(d.id);
      if (!meta) { meta = { falls: m.falls ?? [], seen: this.game.time }; this.mtnMeta.set(d.id, meta); if (this.mtnMeta.size > 2000) this.mtnMeta.clear(); }
      meta.falls = m.falls ?? [];
    });
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
    const eq = game.hero.equip ?? {}, mount = p.flying ? eq.flight : undefined;
    const mg = mount ? artLook(mount).glow : '120,230,170';
    if (st.action === 'fly' && p.moving && Math.random() < 0.8) {
      const a = st.yaw;
      this.particles.push({ x: p.x - Math.sin(a) * 30 + (Math.random() - 0.5) * 20, y: p.y - lift - Math.cos(a) * 10, vx: -Math.sin(a) * 40, vy: -Math.cos(a) * 20, life: 0, max: 0.6 + Math.random() * 0.5, size: 3 + Math.random() * 4, color: Math.random() < 0.5 ? mg : '220,240,255' });
    }
    // 踏云靴：足下生云
    if (!p.flying && eq.boots && p.moving && Math.random() < (p.running ? 0.9 : 0.45)) {
      this.particles.push({ x: p.x + (Math.random() - 0.5) * 26, y: p.y + 2, vx: -Math.sin(st.yaw) * 30 + (Math.random() - 0.5) * 20, vy: -6 - Math.random() * 10, life: 0, max: 0.5 + Math.random() * 0.4, size: 5 + Math.random() * 5, color: '245,248,255' });
    }
    drawCharacter(ctx, p.look, st, PLAYER_SCALE, dt, { mount });
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
  private cloudPar = { x: 0, y: 0, x2: 0, y2: 0, cx: NaN, cy: NaN };
  private drawAtmosphere(left: number, top: number, right: number, bottom: number, dt: number) {
    const { game } = this;
    // 高空视差：云比地面更靠近镜头，镜头移动时云掠得更快
    const cp = this.cloudPar, alt = game.alt;
    if (!isNaN(cp.cx)) { const mx = game.cam.x - cp.cx, my = game.cam.y - cp.cy; if (Math.abs(mx) + Math.abs(my) < 3000) { cp.x += mx * 0.6 * alt; cp.y += my * 0.6 * alt; cp.x2 += mx * 1.6 * alt; cp.y2 += my * 1.6 * alt; } }
    cp.cx = game.cam.x; cp.cy = game.cam.y;
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
    a.globalAlpha = 0.16 * (1 - game.night * 0.8);
    for (const [x, y, s] of clouds) a.drawImage(this.cloudShadow, x - s / 2 + 260, y - s / 2 + 420, s, s * 0.6);
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
    const baseA = (game.cam.zoom < 0.5 ? 0.42 : clamp(0.1 + (0.75 - game.cam.zoom) * 0.6, 0.06, 0.24)) * (game.weather.kind === 'clear' ? 1 : 1.4);
    if (alt < 0.02) {
      a.globalAlpha = baseA;
      for (const [x, y, s] of clouds) a.drawImage(this.cloud, x - s / 2, y - s / 2, s, s * 0.6);
    } else {
      // 云层（中景）：带视差，越高越浓
      a.globalAlpha = Math.min(0.42, baseA + 0.16 * alt) * (1 - game.night * 0.5);
      for (const c of this.driftClouds) {
        const s = 1400 * c.s, ox = c.x - cp.x, oy = c.y - cp.y;
        const bx = Math.floor((left - s - ox) / fieldW) * fieldW + ox, by = Math.floor((top - s - oy) / fieldH) * fieldH + oy;
        for (let x = bx; x < right + s; x += fieldW) for (let y = by; y < bottom + s; y += fieldH) a.drawImage(this.cloud, x - s / 2, y - s / 2, s, s * 0.6);
      }
      // 近云：从身边飞快掠过的薄云絮
      if (alt > 0.15) {
        a.globalAlpha = 0.34 * (alt - 0.15) / 0.85 * (1 - game.night * 0.5);
        const fw = 4200, fh = 3000;
        for (let i = 0; i < this.driftClouds.length; i++) {
          const c = this.driftClouds[i], s = 900 * c.s, ox = c.x * 0.7 + i * 1300 - cp.x2, oy = c.y * 0.6 + i * 900 - cp.y2;
          const bx = Math.floor((left - s - ox) / fw) * fw + ox, by = Math.floor((top - s - oy) / fh) * fh + oy;
          for (let x = bx; x < right + s; x += fw) for (let y = by; y < bottom + s; y += fh) a.drawImage(this.cloud, x - s / 2, y - s / 2, s * 1.3, s * 0.5);
        }
      }
    }
    a.globalAlpha = 1;
  }
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
export type { Deco };
