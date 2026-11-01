// 第四十六步「意境」：湖不再长得一个样——
//  · 云梦泽：烟雨。湖面常年浮着一层游雾，雨多，白鹭、乌篷船、芦苇；
//  · 镜湖：荷花与锦鲤。水面如镜，荷花荡里锦鲤穿梭、蜻蜓点水，岸边垂柳，雨天听雨水榭；
//  · 碧落湖：碧水。水色青碧，锦鲤与荷花，岸上竹林与茶棚；
//  · 黑水泽：死水。水黑如墨，枯木、夜里的鬼火、乌鸦，无鱼；
//  · 翠竹湖：竹海。竹林环湖，薄雾，鹿与锦鲤。
//  另：所有水面下雨时有雨圈；锦鲤会聚到岸边的人跟前。
import type { Game } from './game';
import { LAKES, WORLD_SCALE, LOCATIONS } from '../data/world';
import { mood } from './mood';
import { audio } from './audio';
import { LANDMARKS } from '../data/landmarks';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
function hash2(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967295; }

export type Mood = 'misty' | 'lotus' | 'jade' | 'dark' | 'bamboo';
const MOOD_OF: Record<string, Mood> = { '云梦泽': 'misty', '镜湖': 'lotus', '碧落湖': 'jade', '黑水泽': 'dark', '翠竹湖': 'bamboo' };
export interface MoodLake { x: number; y: number; r: number; mood: Mood; name: string }

interface Koi { x: number; y: number; a: number; sp: number; len: number; col: number; t: number; turn: number; lake: MoodLake; depth: number }
interface Fly { x: number; y: number; tx: number; ty: number; t: number; hover: number; ph: number }
interface Mist { x: number; y: number; w: number; h: number; vx: number; ph: number; lake: MoodLake }
interface Wisp { x: number; y: number; t: number; ph: number }

export class Scenery {
  lakes: MoodLake[] = [];
  private koi: Koi[] = []; private flies: Fly[] = []; private mist: Mist[] = []; private wisps: Wisp[] = [];
  private spawnT = 0; private lotusZones: { x: number; y: number; r: number }[] = [];
  /** 玩家眼下所在的意境湖（天气偏向、音乐等可读） */
  here: MoodLake | null = null;
  private dressed = new Set<MoodLake>();
  private sails: { x: number; y: number; vx: number; lake: MoodLake; ph: number }[] = [];
  private props: { x: number; y: number; s: number; flip: boolean; kind: 'reed' | 'lotus' | 'plum' }[] = [];
  private plumDone = new Set<string>();
  private oarT = 20;
  constructor() {
    const named = LAKES.filter((l) => l.name && MOOD_OF[l.name]).map((l) => ({ x: l.c[0] * WORLD_SCALE, y: l.c[1] * WORLD_SCALE, r: l.r * WORLD_SCALE, mood: MOOD_OF[l.name!], name: l.name! }));
    // 无名的子湖：归入最近的有名大湖
    for (const l of LAKES) {
      const x = l.c[0] * WORLD_SCALE, y = l.c[1] * WORLD_SCALE, r = l.r * WORLD_SCALE;
      if (l.name && MOOD_OF[l.name]) { this.lakes.push({ x, y, r, mood: MOOD_OF[l.name], name: l.name }); continue; }
      const p = named.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + r + 600);
      if (p) this.lakes.push({ x, y, r, mood: p.mood, name: p.name });
    }
    for (const L of LANDMARKS) if (L.id.startsWith('sjl_')) this.lotusZones.push({ x: L.x, y: L.y, r: L.r });
    for (const lk of this.lakes) if (lk.mood === 'misty' || lk.mood === 'bamboo' || lk.mood === 'dark') {
      const n = Math.round(lk.r / 160);
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * lk.r * 1.05; this.mist.push({ x: lk.x + Math.cos(a) * rr, y: lk.y + Math.sin(a) * rr, w: rand(360, 760), h: rand(60, 120), vx: rand(6, 16), ph: Math.random() * TAU, lake: lk }); }
    }
  }
  lakeAt(x: number, y: number, pad = 900): MoodLake | null {
    let best: MoodLake | null = null, bd = 1e18;
    for (const lk of this.lakes) { const d = Math.hypot(lk.x - x, lk.y - y) - lk.r; if (d < pad && d < bd) { bd = d; best = lk; } }
    return best;
  }
  inLotus(x: number, y: number) { for (const z of this.lotusZones) if (Math.hypot(z.x - x, (z.y - y) * 2) < z.r) return true; return false; }

  update(dt: number, g: Game, view: { left: number; top: number; right: number; bottom: number }) {
    const p = g.player, T = g.terrain;
    this.here = this.lakeAt(p.x, p.y, 1600);
    // 天气偏向：烟雨湖多雨多雾；竹海多雾
    (g.weather as any).bias = this.here?.mood === 'misty' ? 'rain' : this.here?.mood === 'bamboo' || this.here?.mood === 'dark' ? 'fog' : null;
    const night = g.night, wet = g.weather.kind === 'rain' || g.weather.kind === 'storm';
    if (this.here && !this.dressed.has(this.here)) { this.dressed.add(this.here); this.dress(this.here, g); }
    if (g.season === 3 || g.weather.kind === 'snow') for (const l of LOCATIONS) {
      if (this.plumDone.has(l.id) || (l.type !== 'town' && l.type !== 'sect' && l.type !== 'city')) continue;
      const lx = l.x * WORLD_SCALE, ly = l.y * WORLD_SCALE;
      if (Math.abs(lx - p.x) > 2600 || Math.abs(ly - p.y) > 2000) continue;
      this.plumDone.add(l.id);
      for (let i = 0, tries = 0; i < 2 && tries < 20; tries++) { const a = Math.random() * TAU, rr = rand(260, 440), x = lx + Math.cos(a) * rr, y = ly + Math.sin(a) * rr * 0.7; if (!T.isLand(x, y)) continue; this.props.push({ x, y, s: rand(0.8, 1.1), flip: Math.cos(a) < 0, kind: 'plum' }); i++; }
    }
    for (const s of this.sails) {
      s.x += s.vx * dt; s.ph += dt * 0.1;
      if (T.isLand(s.x + Math.sign(s.vx) * 60, s.y) || Math.hypot(s.x - s.lake.x, s.y - s.lake.y) > s.lake.r * 1.05) s.vx = -s.vx;
    }
    this.oarT -= dt;
    if (this.oarT <= 0) { this.oarT = rand(14, 30); if (this.sails.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 900)) audio.amb?.oar(); }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.5;
      const lk = this.here;
      // 锦鲤：荷花湖、碧水湖、竹海湖
      if (lk && lk.mood !== 'dark' && this.koi.length < 18) {
        // 围着玩家撒点找水（视野里未必有水，环状搜索更稳）
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * TAU, d = 90 + Math.random() * Math.min(1400, (view.right - view.left) * 0.5);
          const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.75;
          const s = T.sample(x, y);
          if (T.isLand(x, y) || s.land > 0.8) continue;
          if (Math.hypot(x - lk.x, y - lk.y) > lk.r * 1.6) continue;
          this.koi.push({ x, y, a: Math.random() * TAU, sp: rand(14, 30), len: rand(16, 30), col: Math.random(), t: Math.random() * 10, turn: 0, lake: lk, depth: Math.random() });
          if (Math.random() < 0.45) break;
        }
        // 一条都没找到：朝湖心方向补一发（岸边坡缓时环搜常落空）
        if (!this.koi.some((k) => k.lake === lk)) {
          const a = Math.atan2(lk.y - p.y, lk.x - p.x);
          for (let i = 1; i <= 10; i++) { const d = 260 * i, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (!T.isLand(x, y)) { this.koi.push({ x, y, a: a + Math.PI, sp: rand(14, 26), len: rand(16, 28), col: Math.random(), t: 0, turn: 0, lake: lk, depth: Math.random() }); break; } }
        }
      }
      // 云梦泽也有鱼，只是少（雾里看不清）
      if (lk && lk.mood === 'misty' && this.koi.length < 6) for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, d = 120 + Math.random() * 1200, x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.75, s = T.sample(x, y); if (!T.isLand(x, y) && s.land < 0.75) { this.koi.push({ x, y, a: Math.random() * TAU, sp: rand(12, 22), len: rand(14, 22), col: 0.9, t: 0, turn: 0, lake: lk, depth: 0.8 }); break; } }
      // 蜻蜓：荷花荡上，白天、不下雨、春夏秋
      if (!wet && night < 0.45 && this.flies.length < 10) {
        const zs = this.lotusZones.filter((z) => Math.abs(z.x - p.x) < 1700 && Math.abs(z.y - p.y) < 1200);
        if (zs.length) { const z = zs[Math.floor(Math.random() * zs.length)]; const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * z.r * 0.95; const x = z.x + Math.cos(a) * rr, y = z.y + Math.sin(a) * rr * 0.6; this.flies.push({ x, y, tx: x, ty: y, t: 0, hover: rand(1, 3), ph: Math.random() * TAU }); }
        else if (this.here && this.here.mood === 'lotus') { const a = Math.random() * TAU, x = p.x + Math.cos(a) * rand(120, 700), y = p.y + Math.sin(a) * rand(90, 450); if (!T.isLand(x, y)) this.flies.push({ x, y, tx: x, ty: y, t: 0, hover: rand(1, 3), ph: Math.random() * TAU }); }
      }
      // 鬼火：黑水泽的夜
      if (lk && lk.mood === 'dark' && night > 0.5 && this.wisps.length < 14) { const x = rand(view.left, view.right), y = rand(view.top, view.bottom); if (!T.isLand(x, y) || T.sample(x, y).land < 0.62) this.wisps.push({ x, y, t: 0, ph: Math.random() * TAU }); }
    }
    // 锦鲤游动：慢游、转弯、避岸；岸边有人就围过来（像等人喂食）
    for (const k of this.koi) {
      k.t += dt;
      k.turn += (rand(-1, 1) * 0.8 - k.turn) * Math.min(1, dt * 0.6);
      const dp = Math.hypot(p.x - k.x, p.y - k.y);
      if (dp < 240 && !p.flying && T.isLand(p.x, p.y)) { const want = Math.atan2(p.y - k.y, p.x - k.x); let da = want - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; if (dp > 70) k.a += da * Math.min(1, dt * 1.2); else k.turn = 1.6; }
      k.a += k.turn * dt;
      const sp = k.sp * (dp < 240 ? 1.5 : 1);
      const nx = k.x + Math.cos(k.a) * sp * dt, ny = k.y + Math.sin(k.a) * sp * dt * 0.6;
      const s = T.sample(nx, ny);
      if (T.isLand(nx, ny) || s.land > 0.8) { k.a += Math.PI * 0.6 + rand(-0.4, 0.4); }
      else { k.x = nx; k.y = ny; }
    }
    this.koi = this.koi.filter((k) => Math.abs(k.x - p.x) < 2600 && Math.abs(k.y - p.y) < 1800 && k.t < 240);
    // 蜻蜓：悬停 → 突然挪一小段
    for (const f of this.flies) {
      f.t += dt; f.hover -= dt;
      if (f.hover <= 0) { f.hover = rand(0.8, 3); f.tx = f.x + rand(-90, 90); f.ty = f.y + rand(-50, 50); if (!this.inLotus(f.tx, f.ty)) { f.tx = f.x; f.ty = f.y; } }
      f.x += (f.tx - f.x) * Math.min(1, dt * 6); f.y += (f.ty - f.y) * Math.min(1, dt * 6);
    }
    this.flies = this.flies.filter((f) => f.t < 60 && Math.abs(f.x - p.x) < 1600);
    for (const m of this.mist) { m.x += m.vx * dt * (0.6 + 0.4 * Math.sin(m.ph + g.time * 0.1)); if (m.x > m.lake.x + m.lake.r * 1.1) m.x = m.lake.x - m.lake.r * 1.1; }
    for (const w of this.wisps) { w.t += dt; w.x += Math.sin(w.t * 0.7 + w.ph) * 10 * dt; w.y += Math.cos(w.t * 0.5 + w.ph) * 6 * dt; }
    this.wisps = this.wisps.filter((w) => w.t < 20 && night > 0.3);
  }

  /** 水面层（在波纹之前）：湖色；（在波纹之后）：雨圈、锦鲤 */
  drawWaterUnder(ctx: G, g: Game, v: { left: number; top: number; right: number; bottom: number }) {
    const T = g.terrain;
    for (const lk of this.lakes) {
      if (lk.mood !== 'dark' && lk.mood !== 'jade' && lk.mood !== 'lotus') continue;
      if (lk.x + lk.r < v.left || lk.x - lk.r > v.right || lk.y + lk.r < v.top || lk.y - lk.r > v.bottom) continue;
      // 用一圈圈水墨团点染出湖色（只落在水上）
      const cell = 56;
      ctx.save();
      if (lk.mood === 'dark') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(28,30,40,0.5)'; }
      else if (lk.mood === 'jade') { ctx.fillStyle = 'rgba(70,170,140,0.17)'; }
      else { ctx.fillStyle = 'rgba(190,215,225,0.14)'; }
      const x0 = Math.max(v.left, lk.x - lk.r * 1.25), x1 = Math.min(v.right, lk.x + lk.r * 1.25), y0 = Math.max(v.top, lk.y - lk.r * 1.25), y1 = Math.min(v.bottom, lk.y + lk.r * 1.25);
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) {
        const x = (gx + 0.5) * cell, y = (gy + 0.5) * cell;
        if (T.isLand(x, y)) continue;
        const d = Math.hypot(x - lk.x, y - lk.y) / (lk.r * 1.25); if (d > 1) continue;
        const s = T.sample(x, y); const k = Math.min(1, (0.5 - s.land) * 4) * (1 - d * d);
        if (k <= 0.05) continue;
        ctx.globalAlpha = k;
        ctx.beginPath(); ctx.arc(x + (hash2(gx, gy, 5) - 0.5) * 20, y + (hash2(gx, gy, 6) - 0.5) * 20, cell * 0.75, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  drawWaterOver(ctx: G, g: Game, v: { left: number; top: number; right: number; bottom: number }, t: number) {
    const T = g.terrain, z = g.cam.zoom, wt = g.weather;
    // 雨圈：雨点落在水面上，一圈圈漾开
    const rk = (wt.kind === 'rain' || wt.kind === 'storm') ? wt.k : 0;
    if (rk > 0.05 && z > 0.4) {
      const cell = wt.kind === 'storm' ? 64 : 84;
      ctx.save(); ctx.lineWidth = Math.max(1, 1.2 / z);
      for (let gy = Math.floor(v.top / cell); gy <= Math.floor(v.bottom / cell); gy++) for (let gx = Math.floor(v.left / cell); gx <= Math.floor(v.right / cell); gx++) {
        const h = hash2(gx, gy, 81); if (h > rk * 0.9) continue;
        const x = (gx + hash2(gx, gy, 82)) * cell, y = (gy + hash2(gx, gy, 83)) * cell;
        if (T.isLand(x, y)) continue;
        const ph = (t * 0.8 + h * 10) % 1, r = 3 + ph * 22, a = (1 - ph) * 0.55;
        ctx.strokeStyle = `rgba(240,248,252,${a})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, TAU); ctx.stroke();
        if (ph < 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.7 - ph * 4})`; ctx.beginPath(); ctx.arc(x, y - 3 + ph * 20, 1.4, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    // 锦鲤
    if (z > 0.45) for (const k of this.koi) {
      if (k.x < v.left - 40 || k.x > v.right + 40 || k.y < v.top - 40 || k.y > v.bottom + 40) continue;
      const vis = g.life.vis(k); if (vis <= 0.02) continue;
      const wag = Math.sin(k.t * 9 + k.x) * 0.35, L = k.len, W = L * 0.34;
      ctx.save(); ctx.translate(k.x, k.y); ctx.scale(1, 0.62); ctx.rotate(k.a);
      ctx.globalAlpha = vis * (0.55 + 0.3 * (1 - k.depth));
      const body = k.col < 0.45 ? '#ff8a3c' : k.col < 0.7 ? '#f4f0e8' : k.col < 0.88 ? '#e84a2a' : '#3a3a40';
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(L * 0.5, 0); ctx.quadraticCurveTo(L * 0.2, -W, -L * 0.25, -W * 0.45); ctx.quadraticCurveTo(-L * 0.4, 0, -L * 0.25, W * 0.45); ctx.quadraticCurveTo(L * 0.2, W, L * 0.5, 0); ctx.fill();
      // 尾鳍（摆动）
      ctx.beginPath(); ctx.moveTo(-L * 0.25, 0); ctx.lineTo(-L * 0.55, -W * 0.8 + wag * L * 0.4); ctx.lineTo(-L * 0.48, 0 + wag * L * 0.3); ctx.lineTo(-L * 0.55, W * 0.8 + wag * L * 0.4); ctx.closePath(); ctx.fill();
      // 花斑
      if (k.col >= 0.45 && k.col < 0.7) { ctx.fillStyle = '#e8402a'; ctx.beginPath(); ctx.ellipse(L * 0.12, -W * 0.2, L * 0.16, W * 0.35, 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-L * 0.1, W * 0.25, L * 0.12, W * 0.3, -0.2, 0, TAU); ctx.fill(); }
      if (k.col >= 0.88) { ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.ellipse(L * 0.05, 0, L * 0.14, W * 0.3, 0, 0, TAU); ctx.fill(); }
      // 水下偏蓝
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(60,110,140,${0.25 + k.depth * 0.3})`; ctx.fillRect(-L, -L, L * 2, L * 2);
      ctx.restore();
      // 近水面时的涟漪
      const ph = (k.t * 0.5 + k.col * 3) % 1;
      if (k.depth < 0.5 && ph < 0.6) { ctx.save(); ctx.globalAlpha = vis * (0.6 - ph) * 0.6; ctx.strokeStyle = 'rgba(245,250,252,1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(k.x, k.y, 6 + ph * 30, (6 + ph * 30) * 0.4, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
    // 鬼火（黑水泽）
    if (this.wisps.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const w of this.wisps) { const a = Math.min(1, w.t, 20 - w.t) * (0.5 + 0.3 * Math.sin(t * 4 + w.ph)); const gr = ctx.createRadialGradient(w.x, w.y - 30, 0, w.x, w.y - 30, 26); gr.addColorStop(0, `rgba(170,255,210,${0.9 * a})`); gr.addColorStop(0.3, `rgba(90,200,160,${0.4 * a})`); gr.addColorStop(1, 'rgba(60,160,120,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(w.x, w.y - 30, 26, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  // ---------------------------------------------------------------- v0.48 点景池（山水画的"活眼"）
  // 烟雨湖：乌篷远帆 + 夜里渔火 + 芦苇；碧水湖：一片帆、几丛芦苇；黑水泽：只有芦苇（死寂也是意境）；
  // 镜湖入冬换残荷；雪天 / 冬日村口、道观墙头探出一枝红梅。
  private dress(lk: MoodLake, g: Game) {
    const T = g.terrain;
    const water = (x: number, y: number) => !T.isLand(x, y) && T.sample(x, y).land < 0.6;
    if (lk.mood === 'misty' || lk.mood === 'jade') {
      const n = lk.mood === 'misty' ? 3 + Math.min(4, Math.round(lk.r / 1500)) : 1;
      for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
        const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * lk.r * 0.85, x = lk.x + Math.cos(a) * rr, y = lk.y + Math.sin(a) * rr;
        if (!water(x, y)) continue;
        this.sails.push({ x, y, vx: rand(5, 11) * (Math.random() < 0.5 ? -1 : 1), lake: lk, ph: Math.random() * TAU }); i++;
      }
    }
    if (lk.mood === 'misty' || lk.mood === 'dark' || lk.mood === 'jade') {
      const n = lk.mood === 'jade' ? 6 : 16;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU; let shore = -1;
        for (let d = lk.r * 0.3; d < lk.r * 1.7; d += 40) if (T.isLand(lk.x + Math.cos(a) * d, lk.y + Math.sin(a) * d)) { shore = d; break; }
        if (shore < 0) continue;
        const d = shore - rand(10, 70);
        this.props.push({ x: lk.x + Math.cos(a) * d, y: lk.y + Math.sin(a) * d, s: rand(0.7, 1.25), flip: Math.random() < 0.5, kind: 'reed' });
      }
    }
    if (lk.mood === 'lotus') {
      for (const z of this.lotusZones) {
        if (Math.hypot(z.x - lk.x, z.y - lk.y) > lk.r * 2.2) continue;
        for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * z.r * 0.8; this.props.push({ x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.6, s: rand(0.7, 1.1), flip: Math.random() < 0.5, kind: 'lotus' }); }
      }
      for (let i = 0, tries = 0; i < 8 && tries < 40; tries++) {
        const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * lk.r * 0.8, x = lk.x + Math.cos(a) * rr, y = lk.y + Math.sin(a) * rr;
        if (!water(x, y)) continue;
        this.props.push({ x, y, s: rand(0.7, 1.1), flip: Math.random() < 0.5, kind: 'lotus' }); i++;
      }
    }
  }
  private drawPoints(ctx: G, g: Game, v: { left: number; top: number; right: number; bottom: number }, t: number) {
    if (g.cam.zoom < 0.35) return;
    const winter = g.season === 3, snow = g.weather.kind === 'snow' && g.weather.k > 0.3, night = g.night;
    const reed = mood.img('reed_marsh'), lotus = mood.img('lotus_withered'), plum = mood.img('plum_branch'), sail = mood.img('lone_sail'), fl = mood.img('fishing_light');
    const inV = (x: number, y: number, m: number) => x > v.left - m && x < v.right + m && y > v.top - m && y < v.bottom + m * 2;
    ctx.save();
    for (const pr of this.props) {
      if (!inV(pr.x, pr.y, 320)) continue;
      const im = pr.kind === 'reed' ? reed : pr.kind === 'lotus' ? (winter ? lotus : null) : (winter || snow ? plum : null);
      if (!im) continue;
      const w = (pr.kind === 'reed' ? 190 : pr.kind === 'lotus' ? 150 : 200) * pr.s, h = w * im.naturalHeight / im.naturalWidth;
      const sway = Math.sin(t * 0.9 + pr.x * 0.01) * 0.05 * (0.6 + g.weather.wind);
      ctx.save(); ctx.globalAlpha = pr.kind === 'reed' ? 0.92 : 0.88;
      ctx.translate(pr.x, pr.kind === 'plum' ? pr.y - 110 * pr.s : pr.y); ctx.transform(1, 0, pr.kind === 'plum' ? sway * 0.3 : sway, 1, 0, 0); if (pr.flip) ctx.scale(-1, 1);
      ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    }
    if (sail) for (const s of this.sails) {
      if (!inV(s.x, s.y, 200)) continue;
      const vis = g.life.vis(s); if (vis <= 0.02) continue;
      const w = 64, h = w * sail.naturalHeight / sail.naturalWidth, bob = Math.sin(t * 1.2 + s.ph) * 1.5;
      ctx.save(); ctx.translate(s.x, s.y + bob); if (s.vx < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.85 * vis; ctx.drawImage(sail, -w / 2, -h, w, h);
      ctx.globalAlpha = 0.16 * vis; ctx.scale(1, -0.55); ctx.drawImage(sail, -w / 2, -h, w, h); ctx.restore();
      if (fl && night > 0.3) {
        const fw = 30, fh = fw * fl.naturalHeight / fl.naturalWidth;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, (night - 0.3) * 2) * vis * (0.85 + 0.15 * Math.sin(t * 5 + s.ph));
        ctx.drawImage(fl, s.x + (s.vx < 0 ? -14 : 14) - fw / 2, s.y - 10 - fh * 0.2 + bob, fw, fh); ctx.restore();
      }
    }
    ctx.restore();
  }
  /** 树木、建筑之上：游雾、蜻蜓 */
  drawOver(ctx: G, g: Game, v: { left: number; top: number; right: number; bottom: number }, t: number) {
    const z = g.cam.zoom, light = g.light, wet = g.weather.kind === 'rain' || g.weather.kind === 'fog';
    // 游雾：清晨、黄昏、雨天最浓
    const dawn = Math.max(0, 1 - Math.abs(light - 0.45) / 0.3);
    this.drawPoints(ctx, g, v, t);
    for (const m of this.mist) {
      if (m.x + m.w < v.left || m.x - m.w > v.right || m.y + m.h < v.top || m.y - m.h > v.bottom) continue;
      const base = m.lake.mood === 'misty' ? 0.22 : m.lake.mood === 'bamboo' ? 0.14 : 0.16;
      const a = base * (0.55 + 0.45 * dawn + (wet ? 0.5 : 0)) * (0.8 + 0.2 * Math.sin(t * 0.4 + m.ph));
      // v0.48：程序圆团换成水墨烟岚贴片（横条 / 团状），缓移 + 极慢旋转
      const band = m.ph < 2.4, im = band ? mood.img('mist_band') : m.ph < 4.4 ? mood.img('mist_puff_1') : mood.img('mist_puff_2');
      if (im) {
        const w = m.w * (band ? 2.2 : 1.5), h = band ? w * 0.25 : m.h * 2.8;
        ctx.save(); ctx.globalAlpha = Math.min(0.9, a * (m.lake.mood === 'dark' ? 1.6 : 2.6)); ctx.translate(m.x, m.y);
        if (!band) ctx.rotate(Math.sin(t * 0.02 + m.ph) * 0.15);
        ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
        continue;
      }
      const gr = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.w);
      const col = m.lake.mood === 'dark' ? '150,165,150' : '245,248,246';
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.6, `rgba(${col},${a * 0.5})`); gr.addColorStop(1, `rgba(${col},0)`);
      ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, m.h / m.w); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, m.w, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (z > 0.5) for (const f of this.flies) {
      const vis = g.life.vis(f); if (vis <= 0.02) continue;
      const bob = Math.sin(t * 3 + f.ph) * 3, x = f.x, y = f.y - 26 + bob, mv = Math.hypot(f.tx - f.x, f.ty - f.y) > 2 ? 1 : 0;
      const ang = mv ? Math.atan2(f.ty - f.y, f.tx - f.x) : Math.sin(f.ph) * 0.4;
      ctx.save(); ctx.globalAlpha = vis; ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = '#6ab0d0'; ctx.beginPath(); ctx.arc(7, 0, 1.8, 0, TAU); ctx.fill();
      const flap = Math.sin(t * 40 + f.ph) * 0.5;
      ctx.fillStyle = 'rgba(220,235,245,0.55)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(1, s * 4, 7, 1.6 + Math.abs(flap), 0.35 * s, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-2, s * 4, 6, 1.4 + Math.abs(flap), -0.25 * s, 0, TAU); ctx.fill(); }
      ctx.restore();
      // 点水
      if (Math.abs(bob) > 2.9 && !mv) { ctx.save(); ctx.globalAlpha = vis * 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(f.x, f.y, 8, 3, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
  }
}
