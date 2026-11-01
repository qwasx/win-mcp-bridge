// 第十九步：瀑布——程序生成的崖壁（斧劈皴、苔、松、藤）+ 逐帧流动的水练、跌水白沫、水雾、彩虹与深潭涟漪
import { makeCanvas, rgba, shade, mix } from '../core/canvas';
import { mulberry32, valueNoise, clamp } from '../core/rng';
import { drawTinyPine } from './mountain';
import { grainPass } from './landmark';

export interface FallSpec { seed: number; w: number; h: number; tiers: number }
export interface FallTier { x0: number; x1: number; y0: number; y1: number; w0: number; w1: number }
export interface FallMeta { tiers: FallTier[]; pool: { x: number; y: number; rx: number; ry: number } }
export interface FallSprite { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

const TAU = Math.PI * 2;

/** 只由种子决定的几何（主线程逐帧动画与精灵共用） */
export function fallGeometry(s: FallSpec): FallMeta {
  const rnd = mulberry32((s.seed ^ 0x5f3a) >>> 0);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const n = clamp(s.tiers, 1, 3);
  const top = -s.h * 0.9;
  const fw = clamp(s.w * 0.15, 40, 120);
  const tiers: FallTier[] = [];
  let x = R(-0.08, 0.08) * s.w, y = top;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const drop = last ? -y : (-top) / n * R(0.85, 1.1);
    const nx = last ? x * 0.6 : x + R(-0.12, 0.12) * s.w;
    const w0 = fw * (1 - i * 0.12) * R(0.85, 1.05);
    tiers.push({ x0: x, x1: nx, y0: y, y1: y + drop, w0, w1: w0 * R(1.15, 1.35) });
    x = nx; y += drop;
  }
  return { tiers, pool: { x: x * 0.8, y: s.w * 0.13, rx: s.w * 0.4, ry: s.w * 0.13 } };
}

export function makeFallCliff(s: FallSpec, res: number): FallSprite {
  const rnd = mulberry32(s.seed >>> 0);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const G = fallGeometry(s);
  const W = s.w * 1.3, up = s.h + 60, down = s.w * 0.32;
  const H = up + down;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(W / 2, up);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const hw = s.w / 2;
  const topY = G.tiers[0].y0;
  // ---- 崖体轮廓：中间被水切开的凹口，两侧是层叠的岩块
  const ridge = (x: number) => {
    const t = Math.abs(x) / hw;
    const notch = Math.exp(-Math.pow((x - G.tiers[0].x0) / (G.tiers[0].w0 * 0.9), 2)) * 18;
    const shoulder = (1 - Math.pow(Math.min(1, t), 3.2));
    return topY + (1 - shoulder) * s.h * 0.98 + notch + (valueNoise(x / 40, s.seed, 3) - 0.5) * 40 + (valueNoise(x / 12, s.seed, 5) - 0.5) * 12;
  };
  const body = new Path2D();
  body.moveTo(-hw * 1.08, 4);
  for (let x = -hw * 1.08; x <= hw * 1.08; x += 6) body.lineTo(x, Math.min(2, ridge(x)));
  body.lineTo(hw * 1.08, 4); body.closePath();
  const gr = g.createLinearGradient(0, topY, 0, 0);
  gr.addColorStop(0, '#46665e'); gr.addColorStop(0.35, '#5e7668'); gr.addColorStop(0.75, '#76806a'); gr.addColorStop(1, '#868a72');
  g.fillStyle = gr; g.fill(body);
  g.save(); g.clip(body);
  // 岩块：斧劈皴的斜面块
  for (let i = 0; i < Math.floor(s.w * s.h / 2600); i++) {
    const x = R(-hw, hw), y = R(topY, 0), bw = R(20, 70), bh = R(30, 90);
    if (y < ridge(x)) continue;
    const dark = rnd() < 0.5;
    g.fillStyle = dark ? `rgba(30,36,32,${R(0.08, 0.2)})` : `rgba(240,232,210,${R(0.04, 0.1)})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + bw * 0.6, y + R(-6, 6)); g.lineTo(x + bw * 0.5 + R(-8, 8), y + bh); g.lineTo(x - bw * 0.1, y + bh * R(0.7, 1)); g.closePath(); g.fill();
    g.strokeStyle = `rgba(24,28,24,${R(0.15, 0.35)})`; g.lineWidth = R(0.6, 1.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - bw * 0.1, y + bh * R(0.7, 1)); g.stroke();
  }
  // 竖向裂隙与皴笔
  for (let i = 0; i < Math.floor(s.w / 9); i++) {
    let x = R(-hw, hw), y = ridge(x) + R(4, 40);
    g.strokeStyle = `rgba(28,30,26,${R(0.12, 0.32)})`; g.lineWidth = R(0.6, 1.4);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += R(-5, 5); y += R(10, 26); g.lineTo(x, y); }
    g.stroke();
  }
  // 背光面
  const sh = g.createLinearGradient(-hw, 0, hw, 0);
  sh.addColorStop(0, 'rgba(255,248,226,0.10)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,26,30,0.28)');
  g.fillStyle = sh; g.fillRect(-hw * 1.1, topY - 40, s.w * 1.2, -topY + 50);
  // 苔藓
  for (let i = 0; i < Math.floor(s.w / 5); i++) {
    const x = R(-hw, hw), y = ridge(x) + R(0, 0.85) * (-ridge(x));
    g.fillStyle = rgba(rnd() < 0.5 ? '#2a4a30' : '#4a6a3a', R(0.35, 0.75));
    g.beginPath(); g.ellipse(x, y, R(2, 7), R(1.2, 3.5), 0, 0, TAU); g.fill();
  }
  // 湿岩：水道两侧深色
  for (const t of G.tiers) {
    const wg = new Path2D();
    wg.moveTo(t.x0 - t.w0 * 1.1, t.y0 - 6); wg.lineTo(t.x0 + t.w0 * 1.1, t.y0 - 6);
    wg.lineTo(t.x1 + t.w1 * 1.25, t.y1 + 4); wg.lineTo(t.x1 - t.w1 * 1.25, t.y1 + 4); wg.closePath();
    g.fillStyle = 'rgba(22,30,32,0.62)'; g.fill(wg);
  }
  g.restore();
  // 轮廓墨线
  g.strokeStyle = 'rgba(26,30,26,0.4)'; g.lineWidth = 1.6;
  g.beginPath(); let started = false;
  for (let x = -hw * 1.06; x <= hw * 1.06; x += 6) { const y = ridge(x); if (y > -8) { started = false; continue; } if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); }
  g.stroke();
  // 跌水平台（中间层的小潭）
  for (let i = 0; i < G.tiers.length - 1; i++) {
    const t = G.tiers[i];
    g.fillStyle = 'rgba(70,64,52,0.9)'; g.beginPath(); g.ellipse(t.x1, t.y1 + 6, t.w1 * 1.5, 12, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(110,160,170,0.85)'; g.beginPath(); g.ellipse(t.x1, t.y1 + 3, t.w1 * 1.2, 8, 0, 0, TAU); g.fill();
  }
  // 静态水练底色
  for (const t of G.tiers) {
    const wg = g.createLinearGradient(0, t.y0, 0, t.y1);
    wg.addColorStop(0, 'rgba(236,246,248,0.75)'); wg.addColorStop(1, 'rgba(220,236,240,0.6)');
    g.fillStyle = wg;
    g.beginPath(); g.moveTo(t.x0 - t.w0 / 2, t.y0); g.lineTo(t.x0 + t.w0 / 2, t.y0); g.lineTo(t.x1 + t.w1 / 2, t.y1); g.lineTo(t.x1 - t.w1 / 2, t.y1); g.closePath(); g.fill();
  }
  // 顶上的松与藤
  for (let i = 0; i < 3 + Math.floor(s.w / 120); i++) {
    const x = R(-hw * 0.9, hw * 0.9);
    if (Math.abs(x - G.tiers[0].x0) < G.tiers[0].w0) continue;
    drawTinyPine(g, x, ridge(x) + 4, R(22, 40), false, rnd);
  }
  for (let i = 0; i < 6; i++) {
    const x = R(-hw * 0.8, hw * 0.8); const y0 = ridge(x) + 4, len = R(30, 90);
    g.strokeStyle = 'rgba(40,70,40,0.6)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + 6, y0 + len * 0.3, x - 6, y0 + len * 0.6, x + R(-4, 4), y0 + len); g.stroke();
  }
  // ---- 崖脚：乱石与灌丛，让崖壁与地面衔接
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = sd * R(hw * 0.55, hw * 1.12), y = R(-14, 10), rw = R(16, 44);
      const col = mix('#6a6656', '#9a9280', rnd());
      g.fillStyle = 'rgba(30,28,22,0.25)'; g.beginPath(); g.ellipse(x + rw * 0.2, y + rw * 0.2, rw, rw * 0.35, 0, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath();
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = rw * R(0.75, 1.05); g.lineTo(x + Math.cos(a) * rr, y - rw * 0.3 + Math.sin(a) * rr * 0.6); }
      g.closePath(); g.fill(); g.strokeStyle = 'rgba(30,30,24,0.45)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(250,244,226,0.16)'; g.beginPath(); g.ellipse(x - rw * 0.25, y - rw * 0.55, rw * 0.45, rw * 0.18, -0.3, 0, TAU); g.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = sd * R(hw * 0.7, hw * 1.15), y = R(-6, 12);
      for (let k = 0; k < 7; k++) { g.fillStyle = rgba(rnd() < 0.5 ? '#3a5a34' : '#56743e', R(0.75, 0.95)); g.beginPath(); g.arc(x + R(-16, 16), y - R(4, 22), R(7, 13), 0, TAU); g.fill(); }
    }
  }
  // ---- 深潭：卵石岸 + 青碧水面
  const P = G.pool;
  g.fillStyle = 'rgba(90,84,70,0.95)'; g.beginPath(); g.ellipse(P.x, P.y, P.rx * 1.12, P.ry * 1.28, 0, 0, TAU); g.fill();
  const pg = g.createRadialGradient(P.x, P.y - P.ry * 0.4, 0, P.x, P.y, P.rx);
  pg.addColorStop(0, '#2e6a72'); pg.addColorStop(0.6, '#3e8288'); pg.addColorStop(1, '#78aca8');
  g.fillStyle = pg; g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(240,250,248,0.5)'; g.lineWidth = 1.4;
  g.beginPath(); g.ellipse(P.x, P.y, P.rx * 0.97, P.ry * 0.95, 0, 0.1, Math.PI - 0.1); g.stroke();
  // 岸边卵石
  for (let i = 0; i < 26; i++) {
    const a = R(-0.15, Math.PI + 0.15) + (rnd() < 0.3 ? Math.PI : 0), rr = R(1.0, 1.16);
    const x = P.x + Math.cos(a) * P.rx * rr, y = P.y + Math.sin(a) * P.ry * rr * 1.1;
    const rw = R(8, 22);
    const col = mix('#8a8270', '#c8bca0', rnd());
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rw, rw * 0.55, R(-0.3, 0.3), 0, TAU); g.fill();
    g.fillStyle = rgba(shade(col, -0.4), 0.5); g.beginPath(); g.ellipse(x + rw * 0.2, y + rw * 0.2, rw * 0.8, rw * 0.3, 0, 0, Math.PI); g.fill();
  }
  // 岸边芦草
  g.strokeStyle = 'rgba(60,90,50,0.8)'; g.lineWidth = 1.1;
  for (let i = 0; i < 30; i++) {
    const a = R(0, Math.PI), x = P.x + Math.cos(a) * P.rx * R(1.05, 1.2), y = P.y + Math.sin(a) * P.ry * R(1.1, 1.3);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + R(-4, 4), y - 8, x + R(-7, 7), y - R(12, 22)); g.stroke();
  }
  grainPass(g, c.width, c.height, s.seed, 0.3);
  // 两侧崖壁淡入背后的山（只淡化崖体上部，底部乱石、深潭保持不透明）
  const cw = c.width, chh = c.height, baseY = Math.round((up - 30) * res);
  const m = makeCanvas(cw, chh), mg = m.getContext('2d')!;
  const mk = mg.createLinearGradient(0, 0, cw, 0);
  mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.2, 'rgba(0,0,0,0.85)'); mk.addColorStop(0.3, '#000'); mk.addColorStop(0.7, '#000'); mk.addColorStop(0.8, 'rgba(0,0,0,0.85)'); mk.addColorStop(1, 'rgba(0,0,0,0)');
  mg.fillStyle = mk; mg.fillRect(0, 0, cw, baseY);
  const mk2 = mg.createLinearGradient(0, baseY, 0, baseY + 30 * res); mk2.addColorStop(0, 'rgba(0,0,0,0.5)'); mk2.addColorStop(1, '#000');
  mg.fillStyle = mk2; mg.fillRect(0, baseY, cw, chh - baseY);
  mg.fillStyle = '#000'; mg.fillRect(cw * 0.3, baseY, cw * 0.4, chh - baseY);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
  g.drawImage(m as any, 0, 0);
  g.restore();
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: W / 2, ay: up };
}

// ---- 逐帧：流动的水练
let streak: HTMLCanvasElement | null = null;
function streakTex(): HTMLCanvasElement {
  if (streak) return streak;
  const c = makeCanvas(64, 256); const g = c.getContext('2d')!;
  const rnd = mulberry32(77);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 64, y = rnd() * 256, len = 30 + rnd() * 90, a = 0.25 + rnd() * 0.6;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; const w = 1 + rnd() * 3;
    for (const oy of [0, -256, 256]) g.fillRect(x, y + oy, w, len);
  }
  streak = c as HTMLCanvasElement;
  return streak;
}

/** x, y：瀑布底边中心（世界坐标）；ctx 处于世界变换下 */
export function drawFallAnim(ctx: CanvasRenderingContext2D, m: FallMeta, x: number, y: number, t: number, sun: number, detail: boolean) {
  const tex = streakTex();
  ctx.save();
  for (let i = 0; i < m.tiers.length; i++) {
    const T = m.tiers[i];
    const x0 = x + T.x0, x1 = x + T.x1, y0 = y + T.y0, y1 = y + T.y1;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x0 - T.w0 / 2, y0); ctx.lineTo(x0 + T.w0 / 2, y0); ctx.lineTo(x1 + T.w1 / 2, y1); ctx.lineTo(x1 - T.w1 / 2, y1); ctx.closePath();
    ctx.clip();
    const h = y1 - y0, wmax = Math.max(T.w0, T.w1) + 8, cx = (x0 + x1) / 2;
    const tileH = Math.max(120, h * 0.8), off = ((t * 420 + i * 97) % tileH);
    ctx.globalAlpha = 0.9;
    for (let yy = y0 - tileH + off; yy < y1; yy += tileH) ctx.drawImage(tex, cx - wmax / 2, yy, wmax, tileH);
    if (detail) {
      ctx.globalAlpha = 0.55;
      const off2 = ((t * 300 + 40) % tileH);
      for (let yy = y0 - tileH + off2; yy < y1; yy += tileH) ctx.drawImage(tex, cx - wmax / 2 + wmax * 0.3, yy, wmax * 0.7, tileH);
    }
    ctx.restore();
    // 落点白沫
    for (let k = 0; k < 6; k++) {
      const ph = (t * 0.9 + k / 6) % 1;
      const fx = x1 + Math.sin(k * 2.3 + t * 1.7) * T.w1 * 0.6, fy = y1 - ph * T.w1 * 0.5;
      ctx.fillStyle = `rgba(250,253,253,${0.55 * (1 - ph)})`;
      ctx.beginPath(); ctx.ellipse(fx, fy, T.w1 * (0.3 + ph * 0.6), T.w1 * (0.18 + ph * 0.3), 0, 0, TAU); ctx.fill();
    }
  }
  // 潭面涟漪
  const P = m.pool, last = m.tiers[m.tiers.length - 1];
  const ix = x + last.x1, iy = y + Math.min(P.y - P.ry * 0.4, last.y1 + 6);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.35 + k / 4) % 1;
    ctx.strokeStyle = `rgba(235,248,250,${0.5 * (1 - ph)})`;
    ctx.beginPath(); ctx.ellipse(ix, iy + ph * P.ry * 0.3, P.rx * (0.15 + ph * 0.8), P.ry * (0.12 + ph * 0.75), 0, 0, TAU); ctx.stroke();
  }
  // 水雾
  for (let k = 0; k < (detail ? 7 : 4); k++) {
    const ph = (t * 0.18 + k / 7) % 1;
    const mx = ix + Math.sin(k * 1.9 + t * 0.4) * P.rx * 0.5, my = iy - ph * last.w1 * 2.2;
    const r = last.w1 * (0.8 + ph * 1.6);
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    gr.addColorStop(0, `rgba(248,252,252,${0.28 * Math.sin(ph * Math.PI)})`); gr.addColorStop(1, 'rgba(248,252,252,0)');
    ctx.fillStyle = gr; ctx.fillRect(mx - r, my - r, r * 2, r * 2);
  }
  // 彩虹（晴日）
  if (sun > 0.6) {
    const sk = (sun - 0.6) / 0.4;
    const rr = last.w1 * 2.6, cx = ix + last.w1 * 0.8, cy = iy + 6;
    const cols = ['255,80,80', '255,170,60', '255,240,90', '110,220,110', '90,170,255', '150,110,240'];
    ctx.lineWidth = rr * 0.05;
    cols.forEach((c, k) => {
      ctx.strokeStyle = `rgba(${c},${0.1 * sk * (0.75 + 0.25 * Math.sin(t * 0.7))})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr * (1 - k * 0.05), Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();
    });
  }
  ctx.restore();
}
