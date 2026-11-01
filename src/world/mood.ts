// v0.48「气韵」：不加一个新物件，专加"空气层"。
//  · 远山长卷三层（平远）：屏幕上缘横向视差平铺，按时辰色罩与大气透视染色；雨里远山化进雨里、雪天描一道雪线
//  · 天空意象：晨雾带 / 暮霞 / 昼间流云；夜里月轮（按月相：蛾眉 / 满月）与星汉
//  · 雨幕：镜头前第二层极淡斜雨丝
//  · 雁阵：每隔一阵横越镜头，配一声雁鸣；卯时晨钟、酉时暮鼓
//  · 留白雾带：镜头静止 >10 秒且不在战斗，屏幕边缘烟岚缓缓加浓——画面自己"收"成一幅立轴
//  · 后处理：宣纸纤维 + 淡墨洇染四角
// 贴图来自 docs 任务书 A–E 组（AI 初稿经 tools/mood-process.mjs 抠真 alpha、去棋盘格、做无缝）。
import type { Game } from './game';
import { phaseWeights } from './weather';
import { audio } from './audio';
import farMtn1 from '../assets/mood/far_mtn_1.webp?inline';
import farMtn2 from '../assets/mood/far_mtn_2.webp?inline';
import farMtn3 from '../assets/mood/far_mtn_3.webp?inline';
import skyCloud from '../assets/mood/sky_cloud_band.webp?inline';
import skyDawn from '../assets/mood/sky_dawn_mist.webp?inline';
import skyDusk from '../assets/mood/sky_dusk_glow.webp?inline';
import skyStars from '../assets/mood/sky_starriver.webp?inline';
import moonFull from '../assets/mood/moon_full.webp?inline';
import moonCres from '../assets/mood/moon_crescent.webp?inline';
import rainVeil from '../assets/mood/rain_veil.webp?inline';
import mistBand from '../assets/mood/mist_band_1.webp?inline';
import mistPuff1 from '../assets/mood/mist_puff_1.webp?inline';
import mistPuff2 from '../assets/mood/mist_puff_2.webp?inline';
import geeseImg from '../assets/mood/wild_geese.webp?inline';
import sailImg from '../assets/mood/lone_sail.webp?inline';
import fishLight from '../assets/mood/fishing_light.webp?inline';
import smokeImg from '../assets/mood/cooking_smoke.webp?inline';
import reedImg from '../assets/mood/reed_marsh.webp?inline';
import lotusImg from '../assets/mood/lotus_withered.webp?inline';
import plumImg from '../assets/mood/plum_branch.webp?inline';
import paperImg from '../assets/mood/paper_grain.webp?inline';
import vigImg from '../assets/mood/ink_vignette.webp?inline';

const SRC = {
  far_mtn_1: farMtn1, far_mtn_2: farMtn2, far_mtn_3: farMtn3,
  sky_cloud_band: skyCloud, sky_dawn_mist: skyDawn, sky_dusk_glow: skyDusk, sky_starriver: skyStars,
  moon_full: moonFull, moon_crescent: moonCres, rain_veil: rainVeil,
  mist_band: mistBand, mist_puff_1: mistPuff1, mist_puff_2: mistPuff2,
  wild_geese: geeseImg, lone_sail: sailImg, fishing_light: fishLight, cooking_smoke: smokeImg,
  reed_marsh: reedImg, lotus_withered: lotusImg, plum_branch: plumImg,
  paper_grain: paperImg, ink_vignette: vigImg,
};
export type MoodImg = keyof typeof SRC;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type RGB = [number, number, number];
const mix3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// 天色锚点（宣纸上的淡彩，不是摄影天空）
const SKY_NOON: RGB = [226, 230, 222], SKY_DAWN: RGB = [214, 228, 220], SKY_DUSK: RGB = [222, 184, 142], SKY_NIGHT: RGB = [40, 52, 70];
const RAIN_SKY: RGB = [168, 178, 182], SNOW_SKY: RGB = [232, 236, 240], FOG_SKY: RGB = [230, 230, 222];

interface Geese { x: number; y: number; w: number; v: number; dir: number; t: number; honk2: boolean }

export class MoodLayer {
  private imgs = {} as Record<MoodImg, HTMLImageElement>;
  enabled = true;
  /** 留白雾带：静止时长 / 当前浓度 */
  private idle = 0; private idleK = 0;
  private lastCam = { x: 0, y: 0 };
  private geese: Geese | null = null; private geeseT = 70;
  private lastPh = -1;
  private layerCv: HTMLCanvasElement | null = null;
  private rainPat: CanvasPattern | null = null; private paperPat: CanvasPattern | null = null;
  private patCtx: CanvasRenderingContext2D | null = null;
  /** 供外部读：本帧时辰权重与天色 */
  w = { dawn: 0, noon: 1, dusk: 0, night: 0 };
  sky: RGB = SKY_NOON;

  constructor() {
    if (typeof Image === 'undefined') return;
    try { this.enabled = localStorage.getItem('fr_mood') !== '0'; } catch { /* 无痕模式 */ }
    for (const k of Object.keys(SRC) as MoodImg[]) { const im = new Image(); im.decoding = 'async'; im.src = SRC[k]; this.imgs[k] = im; }
  }
  img(k: MoodImg): HTMLImageElement | null { const im = this.imgs[k]; return im && im.complete && im.naturalWidth > 0 ? im : null; }

  // ---------------------------------------------------------------- 逻辑
  update(dt: number, game: Game, camX: number, camY: number) {
    const ph = game.dayPhase;
    this.w = phaseWeights(ph, game.night);
    const wt = game.weather, k = wt.k;
    let sky = mix3(mix3(mix3(SKY_NOON, SKY_DAWN, this.w.dawn), SKY_DUSK, this.w.dusk / Math.max(0.001, this.w.dusk + this.w.noon + this.w.dawn) * (1 - this.w.night) ), SKY_NIGHT, this.w.night);
    if (wt.kind === 'rain' || wt.kind === 'storm') sky = mix3(sky, mix3(RAIN_SKY, SKY_NIGHT, this.w.night * 0.8), k * 0.75);
    else if (wt.kind === 'snow') sky = mix3(sky, mix3(SNOW_SKY, [70, 84, 104], this.w.night * 0.8), k * 0.6);
    else if (wt.kind === 'fog') sky = mix3(sky, mix3(FOG_SKY, [50, 54, 58], this.w.night * 0.8), k * 0.7);
    this.sky = sky;
    // 留白：镜头不动、不在战斗、没有对话面板
    const moved = Math.hypot(camX - this.lastCam.x, camY - this.lastCam.y);
    this.lastCam.x = camX; this.lastCam.y = camY;
    const calm = moved < 0.6 && !game.combat.inCombat && !game.player.flying;
    this.idle = calm ? this.idle + dt : 0;
    const want = this.idle > 10 ? 1 : 0;
    this.idleK += (want - this.idleK) * Math.min(1, dt * (want ? 0.35 : 2.5));
    // 晨钟暮鼓（时间跳跃时不响）
    if (this.lastPh >= 0 && ph - this.lastPh > 0 && ph - this.lastPh < 0.05) {
      if (this.lastPh < 0.25 && ph >= 0.25) audio.amb?.bell();
      if (this.lastPh < 0.745 && ph >= 0.745) audio.amb?.drum();
    }
    this.lastPh = ph;
    // 雁阵：白天、不下雨；秋天来得勤
    this.geeseT -= dt;
    if (!this.geese && this.geeseT <= 0) {
      const wet = wt.kind === 'rain' || wt.kind === 'storm' || wt.kind === 'sand';
      this.geeseT = (game.season === 2 ? 90 : 200) + Math.random() * 160;
      if (!wet && game.night < 0.35 && game.cam.zoom > 0.4) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.geese = { x: dir > 0 ? -0.3 : 1.3, y: 0.1 + Math.random() * 0.14, w: 0.22 + Math.random() * 0.1, v: 0.024 + Math.random() * 0.01, dir, t: 0, honk2: false };
        audio.amb?.geese(dir > 0 ? -0.6 : 0.6);
      }
    }
    if (this.geese) {
      const G = this.geese; G.t += dt; G.x += G.v * G.dir * dt;
      if (!G.honk2 && G.t > 14) { G.honk2 = true; audio.amb?.geese((G.x - 0.5) * 1.4); }
      if (G.x < -0.5 || G.x > 1.5) this.geese = null;
    }
  }

  /** 镜头可见度：缩到大地图时淡出（不挡地图） */
  private zoomK(z: number) { return clamp((z - 0.3) / 0.22, 0, 1); }

  private tiled(g: CanvasRenderingContext2D, im: HTMLImageElement, off: number, y: number, h: number, W: number) {
    const w = im.naturalWidth * h / im.naturalHeight;
    let x = ((off % w) + w) % w - w;
    for (; x < W; x += w) g.drawImage(im, x, y, w + 1, h);
  }

  // ---------------------------------------------------------------- 画：世界层之上、屏幕空间（会经过调色）
  drawBack(g: CanvasRenderingContext2D, W: number, H: number, game: Game, camX: number, z: number, GL: boolean, t: number) {
    if (!this.enabled) return;
    const zk = this.zoomK(z);
    const wt = game.weather, k = wt.k, w = this.w, sky = this.sky;
    const rainK = wt.kind === 'rain' || wt.kind === 'storm' ? k : 0, snowK = wt.kind === 'snow' ? k : 0, fogK = wt.kind === 'fog' ? k : 0, sandK = wt.kind === 'sand' ? k : 0;
    const bandH = clamp(H * 0.3, 150, 380);
    const sx = camX * z;
    g.save();
    if (zk > 0.01) {
      // 1. 天色：上缘一抹淡彩，向下化开
      const sg = g.createLinearGradient(0, 0, 0, bandH * 0.75);
      sg.addColorStop(0, css(sky, 0.62 * zk)); sg.addColorStop(0.55, css(sky, 0.28 * zk)); sg.addColorStop(1, css(sky, 0));
      g.fillStyle = sg; g.fillRect(0, 0, W, bandH * 0.75);
      // 2. 天空意象：晨雾带 / 暮霞 / 昼间流云（在远山之后）
      const cloud = this.img('sky_cloud_band'), dawn = this.img('sky_dawn_mist'), dusk = this.img('sky_dusk_glow');
      const clearish = 1 - Math.max(rainK, fogK, sandK) * 0.8;
      if (dawn && w.dawn > 0.02) { g.globalAlpha = w.dawn * 0.85 * zk * clearish; this.tiled(g, dawn, -sx * 0.02 - t * 3, bandH * 0.02, bandH * 0.42, W); }
      if (dusk && w.dusk > 0.02) { g.globalAlpha = w.dusk * 0.8 * zk * clearish; this.tiled(g, dusk, -sx * 0.02 - t * 3, bandH * 0.06, bandH * 0.36, W); }
      if (cloud && w.noon + w.dawn > 0.05) { g.globalAlpha = (w.noon + w.dawn * 0.5) * 0.75 * zk * (1 - sandK); this.tiled(g, cloud, -sx * 0.035 - t * 6, -bandH * 0.02, bandH * 0.34, W); }
      g.globalAlpha = 1;
      // 3. 远山三层：视差 0.05 / 0.12 / 0.22；越远越淡、越偏天色（大气透视）
      const layers: [MoodImg, number, number, number, number, number][] = [
        // 名称, 视差, 顶, 高, 不透明, 天色染比
        ['far_mtn_1', 0.05, -0.02, 0.62, 0.55 * (1 - rainK * 0.95) * (1 - fogK * 0.9), 0.55],
        ['far_mtn_2', 0.12, 0.02, 0.8, 0.6 * (1 - rainK * 0.8) * (1 - fogK * 0.8), 0.35],
        ['far_mtn_3', 0.22, 0.1, 0.92, 0.66 * (1 - rainK * 0.55) * (1 - fogK * 0.7), 0.16],
      ];
      const LW = Math.ceil(W * 0.5), LH = Math.ceil(bandH * 0.5);
      if (!this.layerCv) this.layerCv = document.createElement('canvas');
      const L = this.layerCv; if (L.width !== LW || L.height !== LH) { L.width = LW; L.height = LH; }
      const lg = L.getContext('2d')!;
      const nightInk: RGB = [28, 38, 54];
      for (const [name, par, top, hh, alpha, tint] of layers) {
        const im = this.img(name); if (!im || alpha * zk < 0.01) continue;
        lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.clearRect(0, 0, LW, LH);
        this.tiled(lg, im, -sx * par * 0.5 - t * par * 2, top * LH, hh * LH, LW);
        lg.globalCompositeOperation = 'source-atop';
        // 大气透视 + 时辰染色（非 GL 时自己压夜色；GL 由着色器的昼夜乘色压暗）
        const tc = mix3(sky, nightInk, GL ? 0 : w.night * 0.6);
        lg.fillStyle = css(tc, clamp(tint + w.dusk * 0.12 + (GL ? w.night * 0.15 : w.night * 0.5) + rainK * 0.3 + fogK * 0.4, 0, 0.92)); lg.fillRect(0, 0, LW, LH);
        // 雪天：上半描一道留白雪线
        if (snowK > 0.05) { const sg2 = lg.createLinearGradient(0, top * LH, 0, (top + hh * 0.55) * LH); sg2.addColorStop(0, `rgba(250,252,255,${0.65 * snowK})`); sg2.addColorStop(1, 'rgba(250,252,255,0)'); lg.fillStyle = sg2; lg.fillRect(0, 0, LW, LH); }
        g.globalAlpha = alpha * zk; g.drawImage(L, 0, 0, W, bandH);
      }
      g.globalAlpha = 1;
      // 4. 山脚的云：远山下缘化进一层烟岚（云断山根），再往下才是人间
      const hg = g.createLinearGradient(0, bandH * 0.45, 0, bandH * 1.15);
      hg.addColorStop(0, css(sky, 0)); hg.addColorStop(0.45, css(sky, 0.32 * zk)); hg.addColorStop(1, css(sky, 0));
      g.fillStyle = hg; g.fillRect(0, bandH * 0.45, W, bandH * 0.7);
      const band = this.img('mist_band');
      if (band) { g.globalAlpha = 0.55 * zk * (1 - w.night * 0.5); const bw = W * 0.75, bh = bandH * 0.28; for (let i = 0; i < 2; i++) { const x = ((-sx * (0.16 + i * 0.05) + t * (5 + i * 3) + i * W * 0.6) % (W + bw) + (W + bw)) % (W + bw) - bw; g.drawImage(band, x, bandH * (0.58 + i * 0.12), bw, bh); } }
      // 5. 雁阵
      const geese = this.img('wild_geese');
      if (this.geese && geese) {
        const G = this.geese, gw = clamp(W * G.w, 200, 460), gh = gw * geese.naturalHeight / geese.naturalWidth;
        const x = G.x * W, y = G.y * H + Math.sin(G.t * 0.6) * 6;
        g.globalAlpha = 0.72 * zk * (1 - w.night);
        if (G.dir < 0) { g.translate(x, y); g.scale(-1, 1); g.drawImage(geese, -gw / 2, -gh / 2, gw, gh); }
        else g.drawImage(geese, x - gw / 2, y - gh / 2, gw, gh);
      }
    }
    g.restore();
    g.save();
    // 6. 雨幕：镜头前第二层极淡斜雨丝
    if (rainK > 0.05) {
      const rv = this.img('rain_veil');
      if (rv) {
        if (!this.rainPat || this.patCtx !== g) { this.rainPat = g.createPattern(rv, 'repeat'); this.patCtx = g; }
        if (this.rainPat) { const ox = (t * 90) % rv.naturalWidth, oy = (t * 360) % rv.naturalHeight; g.globalAlpha = 0.55 * rainK; g.translate(-ox, oy - rv.naturalHeight); g.fillStyle = this.rainPat; g.fillRect(ox, rv.naturalHeight - oy, W, H); }
      }
    }
    g.restore();
    // 7. 留白雾带：静止看风景时边缘烟岚加浓（雾天常驻一半）
    const ek = Math.max(this.idleK, fogK * 0.5) * zk;
    if (ek > 0.02) {
      const band = this.img('mist_band'), p1 = this.img('mist_puff_1'), p2 = this.img('mist_puff_2');
      g.save();
      const tone = w.night > 0.5 ? 0.45 : 0.7;
      if (band) {
        g.globalAlpha = ek * tone;
        g.drawImage(band, -W * 0.1 + Math.sin(t * 0.05) * 30, H - H * 0.2, W * 1.2, H * 0.24);
        g.drawImage(band, -W * 0.15 - Math.sin(t * 0.04) * 30, H - H * 0.12, W * 1.3, H * 0.16);
        g.globalAlpha = ek * tone * 0.7;
        g.drawImage(band, -W * 0.05 + Math.cos(t * 0.03) * 40, bandH * 0.85, W * 1.1, H * 0.14);
      }
      if (p1 && p2) {
        const s = Math.min(W, H) * 0.55;
        g.globalAlpha = ek * tone * 0.85;
        g.drawImage(p1, -s * 0.45 + Math.sin(t * 0.07) * 12, H * 0.45, s, s);
        g.drawImage(p2, W - s * 0.55 + Math.cos(t * 0.06) * 12, H * 0.38, s, s);
      }
      g.restore();
    }
  }

  // ---------------------------------------------------------------- 画：夜空（不经调色，月与星自己发光）
  drawSky(g: CanvasRenderingContext2D, W: number, H: number, game: Game, z: number, camX: number) {
    if (!this.enabled) return;
    const zk = this.zoomK(z), wt = game.weather;
    const clear = wt.kind === 'clear' ? 1 : 1 - wt.k;
    const nk = clamp((game.night - 0.25) / 0.6, 0, 1) * clear * zk;
    if (nk < 0.02) return;
    const bandH = clamp(H * 0.3, 150, 380);
    g.save();
    // 星汉：深夜 + 晴
    const stars = this.img('sky_starriver');
    if (stars) { g.globalCompositeOperation = 'lighter'; const sa = Math.min(1, nk * 1.3); g.globalAlpha = sa; this.tiled(g, stars, -camX * z * 0.01 - game.time * 0.5, -bandH * 0.04, bandH * 0.5, W); g.globalAlpha = sa * 0.6; this.tiled(g, stars, -camX * z * 0.013 - game.time * 0.4 + 900, bandH * 0.02, bandH * 0.36, W); }
    // 月：按月相（每月 30 日），蛾眉月 / 满月，带淡淡月晕
    const day = Math.floor(game.day) % 30, full = day >= 10 && day <= 20;
    const im = this.img(full ? 'moon_full' : 'moon_crescent');
    if (im) {
      const r = bandH * (full ? 0.11 : 0.12), x = W * 0.6 - ((camX * z * 0.004) % 40), y = bandH * 0.24; // 避开右上角日期与小地图
      g.globalCompositeOperation = 'lighter';
      const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * (full ? 4.2 : 3));
      halo.addColorStop(0, `rgba(240,232,200,${0.22 * nk})`); halo.addColorStop(0.35, `rgba(200,210,220,${0.08 * nk})`); halo.addColorStop(1, 'rgba(180,200,220,0)');
      g.globalAlpha = 1; g.fillStyle = halo; g.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = nk * 0.95;
      const ar = im.naturalWidth / im.naturalHeight;
      g.drawImage(im, x - r * ar, y - r, r * 2 * ar, r * 2);
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 后处理：宣纸纤维 + 淡墨四角
  drawPost(g: CanvasRenderingContext2D, W: number, H: number, GL: boolean) {
    if (!this.enabled) return;
    const pp = this.img('paper_grain'), vg = this.img('ink_vignette');
    g.save();
    if (pp) {
      if (!this.paperPat) this.paperPat = g.createPattern(pp, 'repeat');
      if (this.paperPat) { g.globalCompositeOperation = GL ? 'source-over' : 'overlay'; g.globalAlpha = GL ? 0.035 : 0.06; g.fillStyle = this.paperPat; g.fillRect(0, 0, W, H); }
    }
    if (vg) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = GL ? 0.4 : 0.5; g.drawImage(vg, 0, 0, W, H); }
    g.restore();
  }

  /** 山腰云：给大山横一条烟岚（云断山腰 = 高远）。世界坐标，调用前须是世界变换 */
  drawWaistMist(ctx: CanvasRenderingContext2D, d: { x: number; y: number; w: number; h: number }, t: number, seed: number) {
    const band = this.img('mist_band'); if (!band || !this.enabled) return;
    const bw = d.w * (1.15 + seed * 0.4), bh = bw * 0.22;
    const x = d.x + Math.sin(t * 0.04 + seed * 9) * d.w * 0.1, y = d.y - d.h * (0.38 + seed * 0.14);
    ctx.save();
    ctx.globalAlpha = (0.5 + seed * 0.25) * (1 - this.w.night * 0.45);
    if (seed > 0.5) { ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(band, -bw / 2, -bh / 2, bw, bh); }
    else ctx.drawImage(band, x - bw / 2, y - bh / 2, bw, bh);
    ctx.restore();
  }
}

export const mood = new MoodLayer();
if (typeof window !== 'undefined') (window as any).__moodRef = { mood };
