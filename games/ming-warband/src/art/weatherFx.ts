// 屏幕空间的雨雪粒子层（DOM canvas，位于游戏画面之上、界面之下）
import type { Weather } from '../core/weather';
import { sfx } from '../audio/sfx';

const MAX_RAIN = 420, MAX_SNOW = 300;

class WeatherFx {
  cv: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  w: Weather = { kind: 'clear', k: 0, storm: false };
  shown = 0;               // 平滑后的强度
  kind: Weather['kind'] = 'clear';
  px = new Float32Array(MAX_SNOW > MAX_RAIN ? MAX_SNOW : MAX_RAIN);
  py = new Float32Array(this.px.length);
  pz = new Float32Array(this.px.length);
  splash: { x: number; y: number; t: number }[] = [];
  flash = 0;
  nextBolt = 0;
  bolt: [number, number][] | null = null;
  last = 0;
  camDX = 0; camDY = 0;
  running = false;
  // 季节点缀：春花瓣、秋落叶、夏夜萤火
  season = -1; night = false;
  amb: { x: number; y: number; a: number; va: number; s: number; ph: number; c: string }[] = [];
  enabled = true;

  install() {
    if (this.cv || typeof document === 'undefined') return;
    const cv = document.createElement('canvas');
    cv.id = 'weather';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    document.body.appendChild(cv);
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    for (let i = 0; i < this.px.length; i++) this.respawn(i, true);
  }
  resize() { if (!this.cv) return; this.cv.width = Math.max(1, window.innerWidth); this.cv.height = Math.max(1, window.innerHeight); }
  respawn(i: number, anywhere = false) {
    const W = this.cv?.width ?? 800, H = this.cv?.height ?? 600;
    this.px[i] = Math.random() * (W + 200) - 100;
    this.py[i] = anywhere ? Math.random() * H : -20 - Math.random() * 60;
    this.pz[i] = 0.4 + Math.random() * 0.6;  // 远近
  }
  /** 场景每帧调用 */
  set(w: Weather) { this.w = w; if (!this.running) this.start(); }
  /** 相机平移（屏幕像素），让粒子有视差 */
  moveCam(dx: number, dy: number) { this.camDX += dx; this.camDY += dy; }
  clear() { this.w = { kind: 'clear', k: 0, storm: false }; this.season = -1; this.amb = []; }
  setAmbient(season: number, night: boolean) {
    if (season === this.season && night === this.night) return;
    this.season = season; this.night = night;
    const W = this.cv?.width ?? window.innerWidth, H = this.cv?.height ?? window.innerHeight;
    const kind = season === 0 && !night ? 'petal' : season === 2 && !night ? 'leaf' : season === 1 && night ? 'fly' : '';
    const pal = kind === 'petal' ? ['#f6c8d4', '#fbe0e6', '#f0a8bc'] : kind === 'leaf' ? ['#d8862a', '#c0561e', '#e0b040', '#a4682a'] : ['#e8ff90'];
    this.amb = [];
    if (!kind) return;
    const n = kind === 'fly' ? 26 : 18;
    for (let i = 0; i < n; i++) this.amb.push({ x: Math.random() * W, y: Math.random() * H, a: Math.random() * 6, va: (Math.random() - 0.5) * 3, s: 0.7 + Math.random() * 0.6, ph: Math.random() * 10, c: pal[i % pal.length] });
  }
  start() {
    this.install();
    if (!this.cv || this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  drawAmbient(ctx: CanvasRenderingContext2D, dt: number, W: number, H: number, cdx: number, cdy: number, k: number) {
    if (!this.amb.length || k > 0.4) return;
    const t = performance.now() / 1000;
    const fly = this.season === 1;
    for (const p of this.amb) {
      if (fly) {
        p.x += Math.sin(t * 0.7 + p.ph) * 14 * dt - cdx; p.y += Math.cos(t * 0.9 + p.ph * 1.3) * 10 * dt - cdy;
        const b = Math.max(0, Math.sin(t * 2.2 + p.ph * 3));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
        g.addColorStop(0, `rgba(230,255,140,${0.9 * b})`); g.addColorStop(1, 'rgba(200,255,100,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
      } else {
        p.x += (30 + Math.sin(t + p.ph) * 20) * p.s * dt - cdx; p.y += (22 + Math.cos(t * 1.3 + p.ph) * 10) * p.s * dt - cdy;
        p.a += p.va * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.abs(Math.sin(t * 2 + p.ph)) * 0.8 + 0.2);
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, 4 * p.s, 2.2 * p.s, 0, 0, Math.PI * 2); ctx.fill();
        if (this.season === 2) { ctx.strokeStyle = 'rgba(90,40,10,0.5)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-4 * p.s, 0); ctx.lineTo(4 * p.s, 0); ctx.stroke(); }
        ctx.restore();
      }
      if (p.x > W + 20) p.x = -20; else if (p.x < -20) p.x = W + 20;
      if (p.y > H + 20) p.y = -20; else if (p.y < -20) p.y = H + 20;
    }
  }
  frame(dt: number) {
    const ctx = this.ctx, cv = this.cv; if (!ctx || !cv) return;
    const W = cv.width, H = cv.height;
    const target = this.enabled ? this.w.k : 0;
    // 换天气类型时先淡出
    if (this.w.kind !== this.kind) { this.shown = Math.max(0, this.shown - dt * 0.8); if (this.shown <= 0.01) this.kind = this.w.kind; }
    else this.shown += (target - this.shown) * Math.min(1, dt * 0.8);
    const k = this.kind === 'clear' ? 0 : this.shown;
    ctx.clearRect(0, 0, W, H);
    const cdx = this.camDX, cdy = this.camDY; this.camDX = 0; this.camDY = 0;
    this.drawAmbient(ctx, dt, W, H, cdx, cdy, k);
    if (k < 0.01 && this.flash <= 0) return;
    if (this.kind === 'rain') {
      // 阴天
      ctx.fillStyle = `rgba(28,38,52,${0.3 * k})`; ctx.fillRect(0, 0, W, H);
      const n = Math.floor(MAX_RAIN * k), wind = 0.22;
      ctx.strokeStyle = 'rgba(210,222,236,0.55)'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const z = this.pz[i], sp = (900 + 500 * z) * dt;
        this.px[i] += sp * wind - cdx * z; this.py[i] += sp - cdy * z;
        if (this.py[i] > H * (0.55 + 0.45 * z)) {
          if (Math.random() < 0.25 && this.splash.length < 60) this.splash.push({ x: this.px[i], y: this.py[i], t: 0 });
          this.respawn(i);
        }
        if (this.px[i] < -120) this.px[i] += W + 200; else if (this.px[i] > W + 120) this.px[i] -= W + 200;
        const L = 10 + 12 * z;
        ctx.moveTo(this.px[i], this.py[i]); ctx.lineTo(this.px[i] - L * wind, this.py[i] - L);
      }
      ctx.stroke();
      // 水花
      ctx.strokeStyle = 'rgba(210,225,235,0.45)';
      ctx.beginPath();
      for (const s of this.splash) {
        s.t += dt * 4; s.x -= cdx; s.y -= cdy;
        const r = 1 + s.t * 4;
        ctx.moveTo(s.x + r, s.y); ctx.ellipse(s.x, s.y, r, r * 0.35, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      this.splash = this.splash.filter(s => s.t < 1);
      // 雷电
      if (this.w.storm && performance.now() > this.nextBolt) {
        if (this.nextBolt > 0) {
          this.flash = 1;
          const x0 = W * (0.15 + Math.random() * 0.7); const pts: [number, number][] = [[x0, 0]];
          let x = x0; for (let y = 0; y < H * 0.6; y += 18 + Math.random() * 26) { x += (Math.random() - 0.5) * 40; pts.push([x, y]); }
          this.bolt = pts;
          sfx('thunder', { delay: 0.3 + Math.random() * 1.6, vol: 0.6 + Math.random() * 0.4 });
        }
        this.nextBolt = performance.now() + 7000 + Math.random() * 14000;
      }
    } else if (this.kind === 'snow') {
      ctx.fillStyle = `rgba(225,232,240,${0.1 * k})`; ctx.fillRect(0, 0, W, H);
      const n = Math.floor(MAX_SNOW * k);
      const tt = performance.now() / 1000;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const z = this.pz[i];
        this.px[i] += (Math.sin(tt * 0.8 + i) * 22 + 18) * z * dt - cdx * z;
        this.py[i] += (40 + 50 * z) * dt - cdy * z;
        if (this.py[i] > H + 10) this.respawn(i);
        if (this.px[i] < -20) this.px[i] += W + 40; else if (this.px[i] > W + 20) this.px[i] -= W + 40;
        const r = 0.8 + 1.8 * z;
        ctx.moveTo(this.px[i] + r, this.py[i]); ctx.arc(this.px[i], this.py[i], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${0.45 * this.flash})`; ctx.fillRect(0, 0, W, H);
      if (this.bolt && this.flash > 0.6) {
        ctx.strokeStyle = `rgba(255,255,255,${this.flash})`; ctx.lineWidth = 2;
        ctx.beginPath(); this.bolt.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      this.flash -= dt * (this.flash > 0.5 ? 5 : 1.6);
    }
  }
}

export const weatherFx = new WeatherFx();
