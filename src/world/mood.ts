import type { WeatherKind } from './weather';

export type MoodTexture =
  | 'far_mtn_1' | 'far_mtn_2' | 'far_mtn_3'
  | 'sky_dawn_mist' | 'sky_dusk_glow' | 'sky_cloud_band' | 'sky_starriver'
  | 'moon_full' | 'moon_crescent' | 'rain_veil'
  | 'mist_band_1' | 'mist_band_2' | 'mist_puff_1' | 'mist_puff_2'
  | 'wild_geese' | 'lone_sail' | 'fishing_light' | 'cooking_smoke'
  | 'reed_marsh' | 'lotus_withered' | 'plum_branch'
  | 'paper_grain' | 'ink_vignette';

const SOURCES: Record<MoodTexture, URL> = {
  far_mtn_1: new URL('../assets/mood/far_mtn_1.png', import.meta.url),
  far_mtn_2: new URL('../assets/mood/far_mtn_2.png', import.meta.url),
  far_mtn_3: new URL('../assets/mood/far_mtn_3.png', import.meta.url),
  sky_dawn_mist: new URL('../assets/mood/sky_dawn_mist.png', import.meta.url),
  sky_dusk_glow: new URL('../assets/mood/sky_dusk_glow.png', import.meta.url),
  sky_cloud_band: new URL('../assets/mood/sky_cloud_band.png', import.meta.url),
  sky_starriver: new URL('../assets/mood/sky_starriver.png', import.meta.url),
  moon_full: new URL('../assets/mood/moon_full.png', import.meta.url),
  moon_crescent: new URL('../assets/mood/moon_crescent.png', import.meta.url),
  rain_veil: new URL('../assets/mood/rain_veil.png', import.meta.url),
  mist_band_1: new URL('../assets/mood/mist_band_1.png', import.meta.url),
  mist_band_2: new URL('../assets/mood/mist_band_2.png', import.meta.url),
  mist_puff_1: new URL('../assets/mood/mist_puff_1.png', import.meta.url),
  mist_puff_2: new URL('../assets/mood/mist_puff_2.png', import.meta.url),
  wild_geese: new URL('../assets/mood/wild_geese.png', import.meta.url),
  lone_sail: new URL('../assets/mood/lone_sail.png', import.meta.url),
  fishing_light: new URL('../assets/mood/fishing_light.png', import.meta.url),
  cooking_smoke: new URL('../assets/mood/cooking_smoke.png', import.meta.url),
  reed_marsh: new URL('../assets/mood/reed_marsh.png', import.meta.url),
  lotus_withered: new URL('../assets/mood/lotus_withered.png', import.meta.url),
  plum_branch: new URL('../assets/mood/plum_branch.png', import.meta.url),
  paper_grain: new URL('../assets/mood/paper_grain.png', import.meta.url),
  ink_vignette: new URL('../assets/mood/ink_vignette.png', import.meta.url),
};

const textures = {} as Partial<Record<MoodTexture, HTMLImageElement>>;
if (typeof Image !== 'undefined') {
  for (const [key, url] of Object.entries(SOURCES) as [MoodTexture, URL][]) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url.href;
    textures[key] = img;
  }
}

export function moodTexture(key: MoodTexture) {
  const img = textures[key];
  return img?.complete && img.naturalWidth > 0 ? img : null;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const peak = (v: number, center: number, radius: number) => {
  const q = clamp01(1 - Math.abs(v - center) / radius);
  return q * q * (3 - 2 * q);
};

type Tint = [number, number, number, number];
const TINTS: Record<'dawn' | 'noon' | 'dusk' | 'night', Record<'clear' | 'rain' | 'snow' | 'fog', Tint>> = {
  dawn: {
    clear: [207, 224, 216, 0.12], rain: [168, 184, 180, 0.2], snow: [221, 228, 232, 0.15], fog: [226, 224, 212, 0.25],
  },
  noon: {
    clear: [255, 255, 255, 0], rain: [106, 122, 136, 0.18], snow: [200, 208, 212, 0.12], fog: [202, 204, 200, 0.15],
  },
  dusk: {
    clear: [200, 144, 96, 0.15], rain: [74, 90, 100, 0.22], snow: [138, 136, 160, 0.15], fog: [184, 174, 160, 0.2],
  },
  night: {
    clear: [42, 58, 78, 0.3], rain: [27, 34, 44, 0.4], snow: [154, 174, 194, 0.25], fog: [45, 48, 53, 0.35],
  },
};

/** Smooth four-time color table shared by Canvas and WebGL paths. */
export function timeWeatherTint(dayPhase: number, weather: WeatherKind, weatherK: number): Tint {
  const dawn = peak(dayPhase, 0.25, 0.16);
  const dusk = peak(dayPhase, 0.75, 0.16);
  const night = clamp01(1 - peak(dayPhase, 0.5, 0.34));
  const noon = clamp01(1 - Math.max(dawn, dusk, night));
  const weights: [keyof typeof TINTS, number][] = [['dawn', dawn], ['noon', noon], ['dusk', dusk], ['night', night]];
  const wk = weather === 'rain' || weather === 'storm' ? 'rain' : weather === 'snow' ? 'snow' : weather === 'fog' ? 'fog' : 'clear';
  let rs = 0, gs = 0, bs = 0, as = 0;
  for (const [phase, w] of weights) {
    if (w <= 0) continue;
    const q = TINTS[phase][wk];
    const a = q[3] * w;
    rs += q[0] * a; gs += q[1] * a; bs += q[2] * a; as += a;
  }
  if (weather === 'sand') return [196, 160, 110, 0.12 * weatherK];
  const strength = weather === 'clear' ? 1 : weatherK;
  return as > 0 ? [rs / as, gs / as, bs / as, clamp01(as * strength)] : [255, 255, 255, 0];
}

interface MoodGame {
  dayPhase: number; night: number; season: number; day: number; time: number;
  weather: { kind: WeatherKind; k: number; wind: number };
  combat: { inCombat: boolean };
  player: { moving: boolean; sitting: boolean };
}

export class MoodPainter {
  private idle = 0;
  private geeseWait = 12;
  private geeseAge = -1;
  private paperPattern: CanvasPattern | null = null;

  update(dt: number, game: MoodGame) {
    const still = !game.player.moving && !game.combat.inCombat;
    this.idle = still ? Math.min(24, this.idle + dt) : Math.max(0, this.idle - dt * 3);
    const fair = game.weather.kind === 'clear' && game.night < 0.45 && !game.combat.inCombat;
    if (this.geeseAge >= 0) {
      this.geeseAge += dt;
      if (this.geeseAge > 28) { this.geeseAge = -1; this.geeseWait = 45 + Math.random() * 45; }
    } else if (fair) {
      this.geeseWait -= dt;
      if (this.geeseWait <= 0) this.geeseAge = 0;
    }
  }

  private screen(ctx: CanvasRenderingContext2D, dpr: number, draw: () => void) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    ctx.restore();
  }

  drawDistant(ctx: CanvasRenderingContext2D, dpr: number, W: number, H: number, camX: number, game: MoodGame) {
    this.screen(ctx, dpr, () => {
      ctx.globalCompositeOperation = 'multiply';
      const rainFade = game.weather.kind === 'rain' || game.weather.kind === 'storm' ? 0.55 : game.weather.kind === 'fog' ? 0.68 : 1;
      const layers: [MoodTexture, number, number, number][] = [
        ['far_mtn_1', 0.05, 0.27, 0.14], ['far_mtn_2', 0.12, 0.36, 0.13], ['far_mtn_3', 0.22, 0.46, 0.11],
      ];
      for (const [key, parallax, hk, alpha] of layers) {
        const img = moodTexture(key); if (!img) continue;
        const h = Math.min(H * hk, img.height * 0.72), w = h * img.width / img.height;
        const off = -((camX * parallax) % w + w) % w;
        ctx.globalAlpha = alpha * rainFade * (1 - game.night * 0.36);
        for (let x = off - w; x < W + w; x += w) ctx.drawImage(img, x, 0, w + 1, h);
      }
    });
  }

  drawSky(ctx: CanvasRenderingContext2D, dpr: number, W: number, H: number, game: MoodGame) {
    this.screen(ctx, dpr, () => {
      const dawn = peak(game.dayPhase, 0.25, 0.13), dusk = peak(game.dayPhase, 0.75, 0.13);
      const bad = game.weather.kind === 'rain' || game.weather.kind === 'storm' || game.weather.kind === 'fog';
      const strip = (key: MoodTexture, a: number, h: number) => {
        const img = moodTexture(key); if (!img || a <= 0.002) return;
        ctx.globalAlpha = a; ctx.drawImage(img, 0, 0, W, h);
      };
      ctx.globalCompositeOperation = 'screen';
      strip('sky_dawn_mist', dawn * 0.34, Math.min(360, H * 0.46));
      strip('sky_dusk_glow', dusk * 0.32, Math.min(360, H * 0.46));
      if (!bad && game.night < 0.35) strip('sky_cloud_band', 0.16 * (1 - game.night), Math.min(300, H * 0.36));
      if (!bad && game.night > 0.25) {
        strip('sky_starriver', game.night * game.night * 0.44, Math.min(460, H * 0.58));
        const lunarDay = ((game.day % 30) + 30) % 30;
        const key: MoodTexture = lunarDay > 10 && lunarDay < 20 ? 'moon_full' : 'moon_crescent';
        const moon = moodTexture(key);
        if (moon) {
          const s = Math.min(W, H) * (key === 'moon_full' ? 0.13 : 0.16);
          ctx.globalAlpha = game.night * 0.52;
          ctx.drawImage(moon, W * 0.78 - s / 2, H * 0.075, s, s);
        }
      }
      if (this.geeseAge >= 0) {
        const geese = moodTexture('wild_geese');
        if (geese) {
          const q = this.geeseAge / 28, w = Math.min(640, W * 0.46), h = w * geese.height / geese.width;
          const x = -w + (W + w * 1.5) * q, y = H * (0.15 + Math.sin(q * Math.PI) * 0.06);
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = Math.sin(q * Math.PI) * 0.62;
          ctx.drawImage(geese, x, y, w, h);
        }
      }
    });
  }

  drawFront(ctx: CanvasRenderingContext2D, dpr: number, W: number, H: number, game: MoodGame) {
    this.screen(ctx, dpr, () => {
      if ((game.weather.kind === 'rain' || game.weather.kind === 'storm') && game.weather.k > 0.02) {
        const rain = moodTexture('rain_veil');
        if (rain) {
          const s = Math.max(520, Math.min(1024, W));
          const ox = -((game.time * (8 + game.weather.wind * 7)) % s);
          const oy = -((game.time * 18) % s);
          ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = game.weather.k * 0.16;
          for (let x = ox - s; x < W + s; x += s) for (let y = oy - s; y < H + s; y += s) ctx.drawImage(rain, x, y, s, s);
        }
      }
      const quiet = clamp01((this.idle - 10) / 8);
      if (quiet > 0) {
        const mist = moodTexture('mist_band_2') ?? moodTexture('mist_band_1');
        if (mist) {
          ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = quiet * 0.12;
          const h = Math.min(180, H * 0.24), w = Math.max(W * 0.75, h * mist.width / mist.height);
          ctx.drawImage(mist, -w * 0.24, H - h * 0.86, w, h);
          ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(mist, -w * 0.22, 0, w, h); ctx.restore();
        }
      }
    });
  }

  drawTint(ctx: CanvasRenderingContext2D, dpr: number, W: number, H: number, game: MoodGame) {
    const [r, g, b, a] = timeWeatherTint(game.dayPhase, game.weather.kind, game.weather.k);
    if (a <= 0.002) return;
    this.screen(ctx, dpr, () => {
      ctx.globalCompositeOperation = game.night > 0.35 || game.weather.kind === 'rain' || game.weather.kind === 'storm' ? 'multiply' : 'soft-light';
      ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
      ctx.fillRect(0, 0, W, H);
    });
  }

  drawPost(ctx: CanvasRenderingContext2D, dpr: number, W: number, H: number) {
    this.screen(ctx, dpr, () => {
      const paper = moodTexture('paper_grain');
      if (paper) {
        if (!this.paperPattern) this.paperPattern = ctx.createPattern(paper, 'repeat');
        if (this.paperPattern) {
          ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.052;
          ctx.fillStyle = this.paperPattern; ctx.fillRect(0, 0, W, H);
        }
      }
      const vig = moodTexture('ink_vignette');
      if (vig) {
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.72;
        ctx.drawImage(vig, 0, 0, W, H);
      }
    });
  }
}