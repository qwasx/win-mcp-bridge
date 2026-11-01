// 第四十七步：画面意境层 —— 远山三层长卷（平远）、晨雾 / 暮霞 / 淡墨流云、月轮、雁阵、烟岚、雨幕、时辰色罩
// 素材：src/assets/mood/*.webp（由 AI 原图经 ImageMagick 生成真 alpha，已去除棋盘格假透明）
import type { Game } from './game';
import { clamp } from '../core/rng';
import farMtn1 from '../assets/mood/far_mtn_1.webp';
import farMtn2 from '../assets/mood/far_mtn_2.webp';
import farMtn3 from '../assets/mood/far_mtn_3.webp';
import skyDawn from '../assets/mood/sky_dawn_mist.webp';
import skyDusk from '../assets/mood/sky_dusk_glow.webp';
import skyCloud from '../assets/mood/sky_cloud_band.webp';
import moonFull from '../assets/mood/moon_full.webp';
import moonCrescent from '../assets/mood/moon_crescent.webp';
import mistBand1 from '../assets/mood/mist_band_1.webp';
import mistBand2 from '../assets/mood/mist_band_2.webp';
import wildGeese from '../assets/mood/wild_geese.webp';
import rainVeil from '../assets/mood/rain_veil.webp';

function load(src: string): HTMLImageElement { const im = new Image(); im.src = src; return im; }
function ready(im: HTMLImageElement): boolean { return im.complete && im.naturalWidth > 0; }
function rgbOf(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

type Tone = [string, number] | null;
/** 时辰色罩表：行 = 时辰，列 = 天气（晴 / 雨 / 雪 / 雾）。数值为起点，进游戏再调 */
const WASH: Record<'dawn' | 'noon' | 'dusk' | 'night', Tone[]> = {
  dawn:  [['#cfe0d8', 0.12], ['#a8b8b4', 0.2], ['#dde4e8', 0.15], ['#e2e0d4', 0.25]],
  noon:  [null, ['#6a7a88', 0.18], ['#c8d0d4', 0.12], ['#c8c8c0', 0.15]],
  dusk:  [['#c89060', 0.15], ['#4a5a64', 0.22], ['#8a88a0', 0.15], ['#bda98c', 0.2]],
  night: [['#2a3a4e', 0.3], ['#1a1f26', 0.4], ['#a9b9c8', 0.25], ['#1f2328', 0.35]],
};

export class Mood {
  private farImgs = [load(farMtn1), load(farMtn2), load(farMtn3)];
  private dawnImg = load(skyDawn);
  private duskImg = load(skyDusk);
  private cloudImg = load(skyCloud);
  private moonImg = load(moonFull);
  private crescentImg = load(moonCrescent);
  private mistImgs = [load(mistBand1), load(mistBand2)];
  private geeseImg = load(wildGeese);
  private veilImg = load(rainVeil);
  private veilPat: CanvasPattern | null = null;
  private geese = { cd: 50, on: 0, dir: 1, y: 0.2 };

  /** 平远：三层远山长卷，视差 0.05 / 0.12 / 0.22，贴在屏幕上缘，夜里与雨天自动压暗 */
  drawFar(g: CanvasRenderingContext2D, W: number, H: number, dpr: number, camX: number, game: Game) {
    const kind = game.weather.kind;
    const dim = (1 - game.night * 0.45) * (kind === 'storm' ? 0.45 : kind === 'rain' ? 0.7 : 1);
    const layers = [
      { im: this.farImgs[0], a: 0.42, k: 0.05, y: 0, w: 1.5 },
      { im: this.farImgs[1], a: 0.6, k: 0.12, y: 0.03, w: 1.35 },
      { im: this.farImgs[2], a: 0.8, k: 0.22, y: 0.09, w: 1.2 },
    ];
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const l of layers) {
      if (!ready(l.im)) continue;
      const dw = W * l.w, dh = dw * l.im.naturalHeight / l.im.naturalWidth;
      const off = ((camX * l.k) % dw + dw) % dw;
      g.globalAlpha = l.a * dim;
      for (let x = -off - dw; x < W; x += dw) g.drawImage(l.im, x, H * l.y, dw, dh);
    }
    g.restore();
  }

  /** 天空意象：晨雾 / 暮霞横带、淡墨流云、月轮（按日数换月相）、雁阵横越 */
  drawSky(g: CanvasRenderingContext2D, W: number, H: number, dpr: number, game: Game, t: number, dt: number) {
    const night = game.night, day = 1 - night;
    const D = clamp(1 - Math.abs(game.light - 0.52) / 0.2, 0, 1) * day; // 晨昏强度
    const morning = game.dayPhase < 0.5;
    const kind = game.weather.kind;
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 晨雾 / 暮霞：屏幕顶部横卷
    const band = morning ? this.dawnImg : this.duskImg;
    if (D > 0.02 && ready(band)) {
      const bw = W, bh = Math.min(H * 0.3, bw * band.naturalHeight / band.naturalWidth);
      g.globalAlpha = (morning ? 0.75 : 0.6) * D;
      g.drawImage(band, 0, 0, bw, bh);
    }
    // 昼：淡墨流云，缓缓横移
    if (day > 0.3 && ready(this.cloudImg)) {
      const cw = W * 1.6, ch = cw * this.cloudImg.naturalHeight / this.cloudImg.naturalWidth;
      const off = (t * 6) % cw;
      g.globalAlpha = 0.35 * day * (1 - D);
      for (let x = -off; x < W; x += cw) g.drawImage(this.cloudImg, x, H * 0.02, cw, ch);
    }
    // 月：夜里出现，每七日换一次月相（望月 / 蛾眉）
    const moon = Math.floor(game.day / 7) % 2 === 1 ? this.crescentImg : this.moonImg;
    if (night > 0.25 && ready(moon)) {
      const s = Math.min(W, H) * 0.14;
      g.globalAlpha = clamp((night - 0.25) / 0.4, 0, 1) * 0.9;
      g.drawImage(moon, W * 0.84 - s / 2, H * 0.12 - s / 2, s, s);
    }
    // 雁阵：白昼、非雨天，每隔一阵横越天空（18 秒一趟）
    const flying = day > 0.4 && kind !== 'storm' && kind !== 'rain';
    const G = this.geese;
    if (flying && G.on <= 0) G.cd -= dt;
    if (G.cd <= 0 && G.on <= 0) {
      G.on = 18; G.cd = 80 + Math.random() * 80;
      G.dir = Math.random() < 0.5 ? 1 : -1; G.y = 0.1 + Math.random() * 0.2;
    }
    if (G.on > 0) {
      G.on -= dt;
      if (ready(this.geeseImg)) {
        const p = clamp(1 - G.on / 18, 0, 1);
        const w = W * 0.32, h = w * this.geeseImg.naturalHeight / this.geeseImg.naturalWidth;
        const x0 = G.dir > 0 ? -w : W, x1 = G.dir > 0 ? W : -w;
        g.globalAlpha = 0.7 * Math.sin(Math.PI * p) * day;
        g.drawImage(this.geeseImg, x0 + (x1 - x0) * p, H * G.y, w, h);
      }
    }
    g.restore();
  }

  /** 雨幕（雨天斜丝叠加） + 烟岚（常驻极淡横带，雾天加浓；山腰云断 = 高远） */
  drawRain(g: CanvasRenderingContext2D, W: number, H: number, dpr: number, game: Game, t: number) {
    const kind = game.weather.kind, k = game.weather.k;
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if ((kind === 'rain' || kind === 'storm') && k > 0.05 && ready(this.veilImg)) {
      if (!this.veilPat) this.veilPat = g.createPattern(this.veilImg, 'repeat');
      if (this.veilPat) {
        g.globalAlpha = 0.6 * k;
        g.translate(-((t * 140) % 1024), -((t * 420) % 1024));
        g.fillStyle = this.veilPat;
        g.fillRect(-1024, -1024, W + 2048, H + 2048);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    const fog = kind === 'fog' ? k : 0;
    for (let i = 0; i < 2; i++) {
      const im = this.mistImgs[i];
      if (!ready(im)) continue;
      const bw = W, bh = bw * im.naturalHeight / im.naturalWidth;
      const off = (t * (i ? 9 : 14)) % bw;
      g.globalAlpha = (0.1 + 0.3 * fog) * (1 - game.night * 0.4);
      const y = H * (i ? 0.66 : 0.4);
      for (let x = -off; x < W; x += bw) g.drawImage(im, x, y, bw, bh);
    }
    g.restore();
  }

  /** 时辰色罩：晨 / 午 / 暮 / 夜 × 晴雨雪雾，soft-light 叠在整个世界层（替代单纯的明暗乘数） */
  drawWash(g: CanvasRenderingContext2D, W: number, H: number, dpr: number, game: Game) {
    const night = game.night, day = 1 - night;
    const D = clamp(1 - Math.abs(game.light - 0.52) / 0.2, 0, 1) * day;
    const noon = clamp(1 - night - D, 0, 1);
    const kind = game.weather.kind;
    const col = kind === 'rain' || kind === 'storm' ? 1 : kind === 'snow' ? 2 : kind === 'fog' ? 3 : 0;
    const mix: [Tone[], number][] = [
      [WASH.night, night],
      [game.dayPhase < 0.5 ? WASH.dawn : WASH.dusk, D],
      [WASH.noon, noon],
    ];
    let cr = 0, cg = 0, cb = 0, a = 0;
    for (const [row, w] of mix) {
      const tone = row[col];
      if (!tone || w <= 0) continue;
      const [R, Gc, B] = rgbOf(tone[0]);
      const s = tone[1] * w;
      cr += R * s; cg += Gc * s; cb += B * s; a += s;
    }
    if (a < 0.01) return;
    const wk = kind === 'clear' ? 1 : clamp(game.weather.k, 0, 1);
    g.save();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = `rgba(${Math.round(cr / a)},${Math.round(cg / a)},${Math.round(cb / a)},${(Math.min(0.5, a) * wk).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
}
