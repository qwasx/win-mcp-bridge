// 天气：晴 / 雨 / 雷雨 / 雪 / 雾 / 风沙。随地域与季节变化，屏幕空间绘制。
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'sand';
export const WEATHER_NAME: Record<WeatherKind, string> = { clear: '晴', rain: '雨', storm: '雷雨', snow: '雪', fog: '雾', sand: '风沙' };

export type TimeMood = 'dawn' | 'noon' | 'dusk' | 'night';
type MoodWeather = 'clear' | 'rain' | 'snow' | 'fog';
export interface MoodTint { color: string; strength: number; rgb: [number, number, number] }
export const TIME_TINTS: Record<TimeMood, Record<MoodWeather, readonly [string, number]>> = {
  dawn: { clear: ['#cfe0d8', .12], rain: ['#a8b8b4', .20], snow: ['#dde4e8', .15], fog: ['#e2e0d4', .25] },
  noon: { clear: ['#ffffff', 0], rain: ['#6a7a88', .18], snow: ['#c8d0d4', .12], fog: ['#cdd0cb', .15] },
  dusk: { clear: ['#c89060', .15], rain: ['#4a5a64', .22], snow: ['#8a88a0', .15], fog: ['#b4aa98', .20] },
  night: { clear: ['#2a3a4e', .30], rain: ['#222b35', .40], snow: ['#a9bdcb', .25], fog: ['#303b40', .35] },
};
const tintRGB = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

/** Continuous, premultiplied interpolation avoids color pops at time/weather boundaries. */
export function timeMoodTint(phase: number, weather: WeatherKind, intensity = 1): MoodTint {
  const p = ((phase % 1) + 1) % 1;
  const anchors: [number, TimeMood][] = [[0, 'night'], [.23, 'dawn'], [.5, 'noon'], [.76, 'dusk'], [1, 'night']];
  const index = Math.min(3, anchors.findIndex((a, i) => i < 4 && p >= a[0] && p < anchors[i + 1][0]));
  const [a, an] = anchors[Math.max(0, index)], [b, bn] = anchors[Math.max(0, index) + 1];
  let t = (p - a) / (b - a); t = t * t * (3 - 2 * t);
  const kind: MoodWeather = weather === 'storm' ? 'rain' : weather === 'sand' ? 'fog' : weather;
  const k = Math.max(0, Math.min(1, intensity));
  const blendWeather = (row: TimeMood) => {
    const clear = TIME_TINTS[row].clear, wet = TIME_TINTS[row][kind];
    const s = clear[1] * (1-k) + wet[1] * k;
    const ca = tintRGB(clear[0]), cb = tintRGB(wet[0]);
    return { strength: s, rgb: ca.map((v, i) => (v * clear[1] * (1-k) + cb[i] * wet[1] * k) / Math.max(.0001, s)) };
  };
  const x = blendWeather(an), y = blendWeather(bn), strength = x.strength * (1-t) + y.strength * t;
  const rgb = x.rgb.map((v, i) => (v * x.strength * (1-t) + y.rgb[i] * y.strength * t) / Math.max(.0001, strength)) as [number, number, number];
  return { color: `rgb(${rgb.map((v) => Math.round(v * 255)).join(',')})`, strength, rgb };
}

export function moonPhase(day: number) {
  const age = ((day % 29.53) + 29.53) % 29.53;
  const illumination = .5 - .5 * Math.cos(age / 29.53 * Math.PI * 2);
  return { age, illumination, full: illumination > .68, visible: illumination > .035, waxing: age < 14.765 };
}

interface Drop { x: number; y: number; v: number; l: number; s: number }

export class Weather {
  kind: WeatherKind = 'clear';
  next: WeatherKind = 'clear';
  k = 0;           // 当前天气强度 0–1（渐入渐出）
  /** WebGL 模式：整屏填色（沙尘、雾、闪电白光）交给后期着色器 */
  noFills = false;
  timer = 25;
  flash = 0; flashCd = 6;
  wind = 0.4;      // 风力（影响树摆、雨斜）
  drops: Drop[] = [];
  forced: WeatherKind | null = null;
  /** 第四十六步：地域偏向（烟雨湖多雨、竹海多雾） */
  bias: 'rain' | 'fog' | null = null;
  onThunder?: () => void;

  /** ctx: 区域气候 */
  update(dt: number, env: { cold: number; arid: number; sea: boolean; season: number }) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 50 + Math.random() * 70;
      this.next = this.forced ?? this.roll(env);
    }
    if (this.forced && this.next !== this.forced) this.next = this.forced;
    // 过渡：先淡出旧天气，再淡入新天气
    if (this.next !== this.kind) { this.k -= dt * 0.25; if (this.k <= 0) { this.k = 0; this.kind = this.next; } }
    else this.k = Math.min(1, this.k + dt * 0.2);
    const targetWind = this.kind === 'storm' ? 1.6 : this.kind === 'sand' ? 1.8 : this.kind === 'rain' ? 0.9 : this.kind === 'snow' ? 0.6 : 0.35;
    this.wind += (targetWind * (0.5 + 0.5 * this.k) - this.wind) * Math.min(1, dt * 0.5);
    if (this.kind === 'storm' && this.k > 0.5) {
      this.flashCd -= dt;
      if (this.flashCd <= 0) { this.flash = 1; this.flashCd = 4 + Math.random() * 9; setTimeout(() => this.onThunder?.(), 300 + Math.random() * 900); }
    }
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  private roll(env: { cold: number; arid: number; sea: boolean; season: number }): WeatherKind {
    const r = Math.random();
    if (this.bias === 'rain' && env.cold < 0.5 && r < 0.6) return r < 0.42 ? 'rain' : r < 0.5 ? 'storm' : 'fog';
    if (this.bias === 'fog' && r < 0.45) return r < 0.32 ? 'fog' : 'rain';
    if (env.arid > 0.75) return r < 0.3 ? 'sand' : 'clear';
    if (env.cold > 0.5 || (env.season === 3 && env.cold > 0.2)) return r < 0.45 ? 'snow' : r < 0.55 ? 'fog' : 'clear';
    if (env.season === 3) return r < 0.25 ? 'snow' : r < 0.35 ? 'fog' : 'clear';
    if (env.sea) return r < 0.2 ? 'storm' : r < 0.42 ? 'rain' : r < 0.52 ? 'fog' : 'clear';
    if (env.season === 1) return r < 0.14 ? 'storm' : r < 0.36 ? 'rain' : 'clear';
    return r < 0.22 ? 'rain' : r < 0.34 ? 'fog' : 'clear';
  }

  /** 画面暗化（雨天、雷雨） */
  get gloom() { return (this.kind === 'storm' ? 0.38 : this.kind === 'rain' ? 0.2 : this.kind === 'fog' ? 0.06 : this.kind === 'snow' ? 0.08 : this.kind === 'sand' ? 0.12 : 0) * this.k; }

  draw(g: CanvasRenderingContext2D, W: number, H: number, dt: number, camDX: number, camDY: number) {
    const k = this.k;
    if (k <= 0.01 && this.flash <= 0) return;
    const kind = this.kind;
    if (kind === 'rain' || kind === 'storm' || kind === 'snow' || kind === 'sand') {
      const want = Math.floor((kind === 'storm' ? 520 : kind === 'rain' ? 340 : kind === 'snow' ? 260 : 200) * k * Math.min(1.4, (W * H) / (1280 * 800)));
      while (this.drops.length < want) this.drops.push(this.spawn(W, H, true));
      if (this.drops.length > want) this.drops.length = want;
      const wx = this.wind * (kind === 'snow' ? 40 : kind === 'sand' ? 380 : 160);
      g.save();
      if (kind === 'rain' || kind === 'storm') {
        g.strokeStyle = `rgba(210,222,232,${0.35 + 0.2 * k})`; g.lineWidth = 1;
        g.beginPath();
        for (const d of this.drops) {
          d.x += (wx - camDX * 0.6) * dt; d.y += (d.v - camDY * 0.6) * dt;
          if (d.y > H + 20 || d.x < -40 || d.x > W + 40) Object.assign(d, this.spawn(W, H, false));
          const lx = wx / d.v * d.l;
          g.moveTo(d.x, d.y); g.lineTo(d.x - lx, d.y - d.l);
        }
        g.stroke();
        // 地面水花
        g.fillStyle = 'rgba(230,240,245,0.35)';
        for (let i = 0; i < 20 * k; i++) { const x = Math.random() * W, y = Math.random() * H; g.fillRect(x, y, 3, 1); }
      } else if (kind === 'snow') {
        g.fillStyle = 'rgba(255,255,255,0.88)';
        for (const d of this.drops) {
          d.x += (wx + Math.sin(d.y * 0.02 + d.s * 6) * 22 - camDX * 0.6) * dt; d.y += (d.v - camDY * 0.6) * dt;
          if (d.y > H + 10 || d.x < -20 || d.x > W + 20) Object.assign(d, this.spawn(W, H, false));
          g.beginPath(); g.arc(d.x, d.y, d.s * 2.4 + 0.6, 0, Math.PI * 2); g.fill();
        }
      } else {
        g.fillStyle = 'rgba(200,160,100,0.55)';
        for (const d of this.drops) {
          d.x += (wx - camDX * 0.6) * dt; d.y += (Math.sin(d.x * 0.01) * 30 - camDY * 0.6) * dt;
          if (d.x > W + 20 || d.y > H + 20 || d.y < -20 || d.x < -40) Object.assign(d, this.spawn(W, H, false), { x: -10 });
          g.fillRect(d.x, d.y, d.l * 0.6, 1.4);
        }
        if (!this.noFills) { g.fillStyle = `rgba(196,160,110,${0.28 * k})`; g.fillRect(0, 0, W, H); }
      }
      g.restore();
    }
    if (kind === 'fog' && !this.noFills) {
      const t = performance.now() / 1000;
      g.save();
      for (let i = 0; i < 4; i++) {
        const y = H * (0.2 + i * 0.22) + Math.sin(t * 0.1 + i) * 20;
        const gr = g.createLinearGradient(0, y - H * 0.18, 0, y + H * 0.18);
        gr.addColorStop(0, 'rgba(236,236,230,0)'); gr.addColorStop(0.5, `rgba(236,236,230,${0.32 * k})`); gr.addColorStop(1, 'rgba(236,236,230,0)');
        g.fillStyle = gr; g.fillRect(0, y - H * 0.18, W, H * 0.36);
      }
      g.fillStyle = `rgba(230,232,228,${0.18 * k})`; g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (this.flash > 0) {
      if (!this.noFills) { g.fillStyle = `rgba(235,240,255,${this.flash * 0.55})`; g.fillRect(0, 0, W, H); }
      if (this.flash > 0.85) {
        // 闪电
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.2;
        let x = W * (0.2 + Math.random() * 0.6), y = 0;
        g.beginPath(); g.moveTo(x, y);
        while (y < H * 0.55) { x += (Math.random() - 0.5) * 60; y += 20 + Math.random() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    }
  }

  private spawn(W: number, H: number, anywhere: boolean): Drop {
    const kind = this.kind;
    const v = kind === 'snow' ? 40 + Math.random() * 50 : kind === 'sand' ? 0 : 700 + Math.random() * 500;
    return { x: Math.random() * (W + 200) - 100, y: anywhere ? Math.random() * H : -20 - Math.random() * 60, v, l: kind === 'sand' ? 8 + Math.random() * 18 : 10 + Math.random() * 14, s: Math.random() };
  }
}
