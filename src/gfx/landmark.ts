// 第十九步：原著名地的地面贴花与立体构件（全部代码绘制；殿宇、牌楼、宝塔沿用建筑贴图）
import { makeCanvas, rgba, mix } from '../core/canvas';
import { mulberry32, fbm, clamp } from '../core/rng';
import { bldTex } from './bldTex';
import type { GroundKind, StandKind } from '../data/landmarks';
import type { Spr } from './sprites';

const TAU = Math.PI * 2;
type G = CanvasRenderingContext2D;
type RGBA = [number, number, number, number];
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ====================================================================== 地面
/** 低清逐像素底色（噪声 + 柔和边缘），再放大到目标分辨率，最后叠矢量细节 */
function pixelBase(w: number, h: number, seed: number, fn: (u: number, v: number, d: number, n: number, n2: number) => RGBA, edge = 0.28, rect = false): HTMLCanvasElement {
  const K = 0.22;
  const pw = Math.max(8, Math.ceil(w * K)), ph = Math.max(8, Math.ceil(h * K));
  const c = makeCanvas(pw, ph); const g = c.getContext('2d')!;
  const im = g.createImageData(pw, ph); const D = im.data;
  const s = (seed % 997) * 0.37;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const u = (x + 0.5) / pw * 2 - 1, v = (y + 0.5) / ph * 2 - 1;
    const wx = x / K, wy = y / K;
    const n = fbm(wx / 260 + s, wy / 260, 4, seed & 255), n2 = fbm(wx / 70 + 3.3, wy / 70 + s, 3, (seed + 7) & 255);
    let d = rect ? Math.max(Math.abs(u), Math.abs(v)) : Math.hypot(u, v);
    d += (n - 0.5) * edge;
    const [r, gg, b, a] = fn(u, v, d, n, n2);
    const i = (y * pw + x) * 4; D[i] = r; D[i + 1] = gg; D[i + 2] = b; D[i + 3] = clamp(a, 0, 1) * 255;
  }
  g.putImageData(im, 0, 0);
  return c as HTMLCanvasElement;
}

function crackPath(g: G, rnd: () => number, x: number, y: number, len: number, ang: number, branch: number, pts: [number, number][][]) {
  const seg: [number, number][] = [[x, y]];
  let a = ang;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 26; y += Math.sin(a) * 18; seg.push([x, y]);
    if (branch > 0 && rnd() < 0.12) crackPath(g, rnd, x, y, Math.floor(len * 0.5), a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6), branch - 1, pts);
  }
  pts.push(seg);
}
function strokeCracks(g: G, pts: [number, number][][], layers: [number, string][]) {
  for (const [lw, col] of layers) {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of pts) { g.beginPath(); g.moveTo(s[0][0], s[0][1]); for (const [x, y] of s) g.lineTo(x, y); g.stroke(); }
  }
}
function rocks(g: G, rnd: () => number, n: number, w: number, h: number, base: string, inside: (x: number, y: number) => boolean, size = [10, 30]) {
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * w, y = (rnd() - 0.5) * h; if (!inside(x, y)) continue;
    const r = size[0] + rnd() * (size[1] - size[0]);
    g.fillStyle = 'rgba(20,16,14,0.35)'; g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.25, r, r * 0.45, 0, 0, TAU); g.fill();
    g.fillStyle = mix(base, '#ffffff', rnd() * 0.15); g.beginPath();
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = r * (0.75 + rnd() * 0.35); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55 - r * 0.15); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,250,240,0.18)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.45, r * 0.18, -0.3, 0, TAU); g.fill();
  }
}

export function renderLmGround(k: GroundKind, w: number, h: number, seed: number, res: number): Spr {
  const rnd = mulberry32(seed >>> 0);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const c = makeCanvas(Math.max(1, Math.ceil(w * res)), Math.max(1, Math.ceil(h * res)));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
  const base = (fn: Parameters<typeof pixelBase>[3], edge?: number, rect?: boolean) => { const b = pixelBase(w, h, seed, fn, edge, rect); g.drawImage(b, 0, 0, c.width, c.height); };
  g.scale(res, res); g.translate(w / 2, h / 2);
  const inE = (x: number, y: number, k = 1) => (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2 < k * k;
  g.setTransform(1, 0, 0, 1, 0, 0);
  switch (k) {
    case 'ash': base((u, v, d, n, n2) => { const a = sm(1, 0.55, d) * (0.45 + n2 * 0.4); const col = lerp3([62, 54, 50], [150, 140, 128], n2 * n); return [col[0], col[1], col[2], a]; }, 0.5); break;
    case 'scree': base((u, v, d, n, n2) => { const a = sm(1, 0.6, d) * 0.75; const col = lerp3([170, 164, 150], [222, 218, 206], n2); return [col[0], col[1], col[2], a]; }, 0.4); break;
    case 'lavafield': base((u, v, d, n, n2) => { const a = sm(1, 0.7, d) * 0.92; const hot = sm(0.62, 0.8, n2) * 0.35; const col = lerp3(lerp3([34, 24, 22], [86, 44, 34], n), [190, 70, 30], hot); return [col[0], col[1], col[2], a]; }, 0.45); break;
    case 'lavalake': base((u, v, d, n, n2) => {
      const a = sm(1.02, 0.93, d);
      const crust = Math.max(sm(0.52, 0.66, n2) * sm(0.35, 0.9, d), sm(0.6, 0.7, n) * 0.8);
      const heat = 1 - sm(0, 0.95, d);
      let col = lerp3([220, 70, 18], [255, 196, 80], heat * 0.9 + (n - 0.5) * 0.4);
      col = lerp3(col, [44, 26, 22], Math.max(crust * 0.85, sm(0.86, 0.97, d)));
      return [col[0], col[1], col[2], a];
    }, 0.3); break;
    case 'lavapath': base((u, v, d, n, n2) => { const ax = Math.abs(u) + (n - 0.5) * 0.3; const a = sm(1, 0.85, ax) * sm(1, 0.72, Math.abs(v) + (n2 - 0.5) * 0.2); const lava = sm(0.38, 0.12, ax) * (0.6 + n2 * 0.6); const col = lerp3(lerp3([40, 26, 24], [84, 46, 36], n2), [255, 140, 40], clamp(lava, 0, 1)); return [col[0], col[1], col[2], a]; }, 0, true); break;
    case 'icepath': base((u, v, d, n, n2) => { const ax = Math.abs(u) + (n - 0.5) * 0.25; const a = sm(1, 0.85, ax) * sm(1, 0.72, Math.abs(v) + (n2 - 0.5) * 0.2) * 0.95; const col = lerp3([150, 196, 230], [236, 246, 255], n2 * 0.8 + sm(0.5, 0, ax) * 0.3); return [col[0], col[1], col[2], a]; }, 0, true); break;
    case 'bloodpool': base((u, v, d, n, n2) => { const a = sm(1.02, 0.94, d); const col = lerp3([96, 26, 30], [26, 8, 12], 1 - sm(1, 0.2, d) * 0.9 + (n2 - 0.5) * 0.3); return [col[0], col[1], col[2], a]; }, 0.1); break;
    case 'blackpond': base((u, v, d, n, n2) => { const a = sm(1.02, 0.94, d); const col = lerp3([46, 62, 70], [10, 14, 20], sm(1, 0.3, d) + (n2 - 0.5) * 0.2); return [col[0], col[1], col[2], a]; }, 0.12); break;
    case 'pit': base((u, v, d, n, n2) => { const a = sm(1.03, 0.9, d); const col = lerp3([60, 50, 46], [6, 4, 6], sm(0.95, 0.25, d)); const glow = sm(0.35, 0, d) * 0.35; return [col[0] + glow * 160, col[1] + glow * 30, col[2] + glow * 30, a]; }, 0.1); break;
    case 'ghostland': base((u, v, d, n, n2) => { const a = sm(1, 0.6, d) * 0.82; const col = lerp3([60, 58, 72], [128, 122, 140], n2); return [col[0], col[1], col[2], a]; }, 0.45); break;
    case 'flowers': base((u, v, d, n, n2) => { const a = sm(1, 0.5, d) * 0.4; const col = lerp3([70, 120, 60], [130, 170, 80], n2); return [col[0], col[1], col[2], a]; }, 0.5); break;
    case 'taiji': base((u, v, d, n, n2) => {
      // 真正的太极：右阴左阳、上下两鱼眼；噪声扰动成水墨晕染的边
      const uu = (u + (n - 0.5) * 0.12) / 0.86, vv = (v + (n2 - 0.5) * 0.12) / 0.86;
      const dt = Math.hypot(uu, vv + 0.5), db = Math.hypot(uu, vv - 0.5);
      let dark = uu > 0; if (dt < 0.5) dark = false; if (db < 0.5) dark = true;
      if (dt < 0.13) dark = true; if (db < 0.13) dark = false;
      const dd = Math.hypot(uu, vv), ring = Math.abs(dd - 1.04) < 0.035;
      const a = (dd < 1 ? 0.46 : ring ? 0.4 : 0) * sm(1.0, 0.86, d); 
      const col = ring ? [40, 40, 46] : dark ? lerp3([18, 18, 26], [56, 56, 66], n2) : lerp3([206, 206, 196], [240, 238, 228], n2);
      return [col[0], col[1], col[2], a];
    }, 0.35); break;
    case 'jadeplaza': base((u, v, d, n, n2) => { const a = sm(1.0, 0.985, d) * (v > 0.96 ? 0 : 1); const col = lerp3([190, 198, 186], [232, 234, 224], n2 * 0.7 + n * 0.3); return [col[0], col[1], col[2], a]; }, 0, true); break;
  }
  g.scale(res, res); g.translate(w / 2, h / 2);
  // ---- 矢量细节
  if (k === 'lavafield') {
    const pts: [number, number][][] = [];
    for (let i = 0; i < 15; i++) { const a = rnd() * TAU, r = R(0.1, 0.75); crackPath(g, rnd, Math.cos(a) * w * 0.5 * r, Math.sin(a) * h * 0.5 * r, 6 + Math.floor(rnd() * 8), rnd() * TAU, 1, pts); }
    const clip = pts.map((s) => s.filter(([x, y]) => inE(x, y, 0.92))).filter((s) => s.length > 1);
    strokeCracks(g, clip, [[14, 'rgba(255,80,20,0.18)'], [6, 'rgba(255,110,30,0.6)'], [2.4, 'rgba(255,200,90,0.95)'], [0.9, 'rgba(255,250,200,0.9)']]);
    rocks(g, rnd, 90, w, h, '#3a2a26', (x, y) => inE(x, y, 0.9), [8, 26]);
    // 灰烬斑
    for (let i = 0; i < 300; i++) { const x = R(-w / 2, w / 2), y = R(-h / 2, h / 2); if (!inE(x, y, 0.95)) continue; g.fillStyle = `rgba(170,160,150,${R(0.1, 0.35)})`; g.beginPath(); g.arc(x, y, R(1, 3), 0, TAU); g.fill(); }
  } else if (k === 'lavalake') {
    // 黑岩岸
    rocks(g, rnd, 70, w * 1.05, h * 1.05, '#2a201e', (x, y) => { const q = (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2; return q > 0.8 && q < 1.05; }, [10, 30]);
    // 结壳裂纹
    g.strokeStyle = 'rgba(40,20,14,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = R(-w / 2, w / 2) * 0.8, y = R(-h / 2, h / 2) * 0.8; if (!inE(x, y, 0.8)) continue; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-30, 30), y + R(-14, 14)); g.lineTo(x + R(-40, 40), y + R(-20, 20)); g.stroke(); }
  } else if (k === 'lavapath') {
    const pts: [number, number][][] = [];
    for (let i = 0; i < 10; i++) crackPath(g, rnd, R(-w * 0.15, w * 0.15), R(-h / 2, h / 2), 5, Math.PI / 2 + R(-0.6, 0.6), 1, pts);
    strokeCracks(g, pts.map((s) => s.filter(([x, y]) => Math.abs(x) < w * 0.4 && Math.abs(y) < h * 0.48)).filter((s) => s.length > 1), [[6, 'rgba(255,110,30,0.4)'], [2, 'rgba(255,210,100,0.9)']]);
    rocks(g, rnd, 50, w, h, '#2a1e1c', (x) => Math.abs(x) > w * 0.28 && Math.abs(x) < w * 0.48, [8, 20]);
  } else if (k === 'icepath') {
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) { const x = R(-w * 0.4, w * 0.4), y = R(-h * 0.48, h * 0.48); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 3; j++) g.lineTo(x + R(-30, 30), y + R(-30, 30)); g.stroke(); }
    // 玄晶砖缝
    g.strokeStyle = 'rgba(90,140,190,0.35)'; g.lineWidth = 1.5;
    for (let y = -h / 2 + 40; y < h / 2; y += 70) { g.beginPath(); g.moveTo(-w * 0.32, y); g.lineTo(w * 0.32, y); g.stroke(); }
    for (let i = 0; i < 120; i++) { const x = R(-w * 0.42, w * 0.42), y = R(-h * 0.48, h * 0.48); g.fillStyle = `rgba(255,255,255,${R(0.4, 0.95)})`; g.beginPath(); g.arc(x, y, R(0.8, 2.2), 0, TAU); g.fill(); }
  } else if (k === 'bloodpool' || k === 'blackpond') {
    // 水面高光与岸石
    g.strokeStyle = k === 'bloodpool' ? 'rgba(220,80,80,0.35)' : 'rgba(150,180,200,0.3)'; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const r = R(0.3, 0.8); g.beginPath(); g.ellipse(R(-0.1, 0.1) * w, R(-0.1, 0.1) * h, w / 2 * r, h / 2 * r * 0.9, 0, R(0, 3), R(3.5, 6)); g.stroke(); }
    rocks(g, rnd, 60, w * 1.08, h * 1.1, k === 'bloodpool' ? '#4a3a36' : '#3a4044', (x, y) => { const q = (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2; return q > 0.86 && q < 1.12; }, [10, 28]);
    if (k === 'bloodpool') for (let i = 0; i < 30; i++) { const a = R(0, TAU); const x = Math.cos(a) * w * 0.52, y = Math.sin(a) * h * 0.55; g.strokeStyle = 'rgba(40,60,30,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + R(-5, 5), y - 10, x + R(-8, 8), y - R(14, 26)); g.stroke(); }
  } else if (k === 'pit') {
    rocks(g, rnd, 60, w * 1.08, h * 1.1, '#5a5048', (x, y) => { const q = (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2; return q > 0.82 && q < 1.1; }, [12, 32]);
  } else if (k === 'ghostland') {
    // 白骨、断剑、残幡
    for (let i = 0; i < 46; i++) {
      const x = R(-w / 2, w / 2) * 0.85, y = R(-h / 2, h / 2) * 0.85; if (!inE(x, y, 0.85)) continue;
      const t = rnd();
      if (t < 0.55) { g.strokeStyle = 'rgba(226,220,204,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y + R(-4, 4)); g.stroke(); g.fillStyle = 'rgba(226,220,204,0.85)'; g.beginPath(); g.arc(x - 10, y, 2.6, 0, TAU); g.arc(x + 10, y, 2.6, 0, TAU); g.fill(); }
      else if (t < 0.75) { g.fillStyle = 'rgba(230,226,212,0.9)'; g.beginPath(); g.ellipse(x, y, 7, 6, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(30,26,30,0.8)'; g.beginPath(); g.arc(x - 2.4, y - 1, 1.6, 0, TAU); g.arc(x + 2.4, y - 1, 1.6, 0, TAU); g.fill(); }
      else { g.strokeStyle = 'rgba(150,150,160,0.9)'; g.lineWidth = 2.2; const a = R(-0.5, 0.5) - Math.PI / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); g.stroke(); }
    }
  } else if (k === 'flowers') {
    const cols = ['#d23a4a', '#e86a8a', '#f4d04a', '#ffffff', '#9a5ad2', '#b04ac0', '#f28a3a', '#e8e0ff'];
    for (let cl = 0; cl < 34; cl++) {
      const cx = R(-w / 2, w / 2) * 0.85, cy = R(-h / 2, h / 2) * 0.85; if (!inE(cx, cy, 0.85)) continue;
      const col = cols[Math.floor(rnd() * cols.length)], r = R(30, 90);
      for (let i = 0; i < r * 1.6; i++) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * r, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.65;
        g.strokeStyle = 'rgba(50,90,40,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x, y); g.stroke();
        g.fillStyle = col; g.globalAlpha = R(0.7, 1); g.beginPath(); g.arc(x, y, R(1.6, 3.4), 0, TAU); g.fill(); g.globalAlpha = 1;
        if (rnd() < 0.3) { g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill(); }
      }
    }
  } else if (k === 'jadeplaza') {
    // 台基：南侧露出的玉石台壁、正中石阶（广场高出地面）
    const fh = 0.04 * h * 0.5 + 10;
    g.fillStyle = 'rgba(40,40,30,0.25)'; g.fillRect(-w / 2 + 10, h / 2 - fh + 8, w, fh);
    const fg = g.createLinearGradient(0, h / 2 - fh * 2, 0, h / 2);
    fg.addColorStop(0, '#c6ccc0'); fg.addColorStop(1, '#9ea496');
    g.fillStyle = fg; g.fillRect(-w / 2, h / 2 - fh * 2, w, fh * 2);
    g.strokeStyle = 'rgba(70,74,64,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w / 2, h / 2 - fh * 2); g.lineTo(w / 2, h / 2 - fh * 2); g.stroke();
    for (let x = -w / 2 + 60; x < w / 2; x += 90) { g.beginPath(); g.moveTo(x, h / 2 - fh * 2); g.lineTo(x, h / 2); g.stroke(); }
    const sw = 260;
    for (let i = 0; i < 6; i++) { const yy = h / 2 - fh * 2 + i * fh / 3; g.fillStyle = i % 2 ? '#e8ece2' : '#d2d8cc'; g.fillRect(-sw / 2 - i * 6, yy, sw + i * 12, fh / 3); }
    g.strokeStyle = 'rgba(70,74,64,0.4)'; g.strokeRect(-sw / 2 - 36, h / 2 - fh * 2, sw + 72, fh * 2);
    // 玉砖缝
    const tw = 120, th = 70;
    g.strokeStyle = 'rgba(110,120,108,0.55)'; g.lineWidth = 1.6;
    for (let y = -h / 2 + th; y < h / 2; y += th) { g.beginPath(); g.moveTo(-w / 2 + 14, y); g.lineTo(w / 2 - 14, y); g.stroke(); }
    for (let y = -h / 2; y < h / 2; y += th) { const off = ((y / th) & 1) * tw / 2; for (let x = -w / 2 + off; x < w / 2; x += tw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + th); g.stroke(); } }
    // 玉中青纹
    g.strokeStyle = 'rgba(120,170,150,0.18)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = R(-w / 2, w / 2), y = R(-h / 2, h / 2); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + R(-40, 40), y + R(-20, 20), x + R(-60, 60), y + R(-30, 30), x + R(-80, 80), y + R(-30, 30)); g.stroke(); }
    // 边缘云纹饰带
    const band = 46;
    g.strokeStyle = 'rgba(160,150,120,0.6)'; g.lineWidth = 3; g.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);
    g.lineWidth = 1.6; g.strokeRect(-w / 2 + band, -h / 2 + band, w - band * 2, h - band * 2);
    g.strokeStyle = 'rgba(150,140,110,0.5)'; g.lineWidth = 1.6;
    const cloud = (x: number, y: number) => { g.beginPath(); g.arc(x, y, 9, Math.PI, TAU); g.arc(x + 14, y, 6, Math.PI, TAU * 0.95); g.stroke(); g.beginPath(); g.arc(x + 4, y + 1, 4, 0, Math.PI * 1.5); g.stroke(); };
    for (let x = -w / 2 + 40; x < w / 2 - 40; x += 60) { cloud(x, -h / 2 + 30); cloud(x, h / 2 - 22); }
    for (let y = -h / 2 + 70; y < h / 2 - 50; y += 60) { cloud(-w / 2 + 18, y); cloud(w / 2 - 40, y); }
    // 中央八卦
    const R0 = Math.min(w, h * 1.6) * 0.18;
    g.save(); g.scale(1, 0.62);
    g.strokeStyle = 'rgba(140,130,100,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R0, 0, TAU); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R0 * 0.82, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i / 8 * TAU);
      for (let j = 0; j < 3; j++) { const broken = ((i >> j) & 1) === 1; const y = -R0 * (0.92 + j * 0.0) + j * 9 - R0 * 0.0; const yy = -R0 * 1.12 - j * 11; void y; g.fillStyle = 'rgba(120,110,80,0.65)'; if (broken) { g.fillRect(-20, yy, 16, 5); g.fillRect(4, yy, 16, 5); } else g.fillRect(-20, yy, 40, 5); }
      g.restore();
    }
    // 太极
    g.fillStyle = 'rgba(60,64,60,0.55)'; g.beginPath(); g.arc(0, 0, R0 * 0.5, -Math.PI / 2, Math.PI / 2); g.arc(0, R0 * 0.25, R0 * 0.25, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R0 * 0.25, R0 * 0.25, Math.PI / 2, -Math.PI / 2); g.fill();
    g.strokeStyle = 'rgba(60,64,60,0.55)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R0 * 0.5, 0, TAU); g.stroke();
    g.restore();
    // 岁月：碎砖、苔痕
    for (let i = 0; i < 24; i++) { const x = R(-w / 2, w / 2) * 0.9, y = R(-h / 2, h / 2) * 0.9; g.strokeStyle = 'rgba(90,90,80,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-24, 24), y + R(-14, 14)); g.lineTo(x + R(-30, 30), y + R(-18, 18)); g.stroke(); }
    for (let i = 0; i < 60; i++) { const x = R(-w / 2, w / 2) * 0.95, y = R(-h / 2, h / 2) * 0.95; g.fillStyle = `rgba(80,110,70,${R(0.12, 0.3)})`; g.beginPath(); g.ellipse(x, y, R(4, 14), R(2, 5), 0, 0, TAU); g.fill(); }
  } else if (k === 'taiji') {
    for (let i = 0; i < 24; i++) { const a = R(0, TAU), r = R(0.95, 1.2); g.fillStyle = `rgba(${rnd() < 0.5 ? '30,30,40' : '220,220,210'},${R(0.1, 0.25)})`; g.beginPath(); g.ellipse(Math.cos(a) * r * w / 2, Math.sin(a) * r * h / 2, R(6, 20), R(3, 8), a, 0, TAU); g.fill(); }
  }
  return { canvas: c as HTMLCanvasElement, w, h, ax: w / 2, ay: h / 2 };
}

// ====================================================================== 立体构件
function texSprite(name: string, tw: number, res: number, filter: string, flipV = false, extra?: (g: G, tw: number, th: number) => void): Spr | null {
  const im = bldTex(name); if (!im) return null;
  const th = tw * im.height / im.width;
  const pad = 20, W = tw + pad * 2, H = th + pad * 2;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(W / 2, flipV ? pad : H - pad);
  g.imageSmoothingEnabled = true; (g as any).imageSmoothingQuality = 'high';
  if (!flipV) { g.fillStyle = 'rgba(40,36,26,0.18)'; g.beginPath(); g.ellipse(tw * 0.04, -2, tw * 0.5, Math.min(18, tw * 0.08), 0, 0, TAU); g.fill(); }
  if (filter !== 'none') g.filter = filter;
  if (flipV) { g.save(); g.scale(1, -1); g.drawImage(im, -tw / 2, -th, tw, th); g.restore(); }
  else g.drawImage(im, -tw / 2, -th, tw, th);
  g.filter = 'none';
  extra?.(g, tw, th);
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: W / 2, ay: flipV ? pad : H - pad };
}

function stoneBlock(g: G, x: number, y: number, w: number, d: number, h: number, top: string, side: string, rnd: () => number) {
  // 俯视斜角的石台：顶面椭圆 / 矩形 + 正面
  g.fillStyle = side; g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = top; g.fillRect(x - w / 2, y - h - d, w, d);
  g.strokeStyle = 'rgba(40,36,30,0.55)'; g.lineWidth = 1.4; g.strokeRect(x - w / 2, y - h - d, w, d + h);
  g.beginPath(); g.moveTo(x - w / 2, y - h); g.lineTo(x + w / 2, y - h); g.stroke();
  g.strokeStyle = 'rgba(40,36,30,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < w / 40; i++) { const xx = x - w / 2 + rnd() * w; g.beginPath(); g.moveTo(xx, y - h + 2); g.lineTo(xx + (rnd() - 0.5) * 8, y - 2); g.stroke(); }
}

// 石质颗粒：只叠在已有像素上（source-atop），去掉矢量的“塑料感”
let grainImg: HTMLCanvasElement | null = null;
function grainTex(): HTMLCanvasElement {
  if (grainImg) return grainImg;
  const N = 256, c = makeCanvas(N, N), g = c.getContext('2d')!;
  const im = g.createImageData(N, N), D = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = fbm(x / 22, y / 22, 4, 31), n2 = fbm(x / 5, y / 5, 2, 37);
    const v = n * 0.7 + n2 * 0.3;
    const i = (y * N + x) * 4;
    if (v < 0.5) { D[i] = 34; D[i + 1] = 28; D[i + 2] = 22; D[i + 3] = (0.5 - v) * 2 * 200; }
    else { D[i] = 250; D[i + 1] = 244; D[i + 2] = 230; D[i + 3] = (v - 0.5) * 2 * 90; }
  }
  g.putImageData(im, 0, 0);
  grainImg = c as HTMLCanvasElement;
  return grainImg;
}
export function grainPass(g: G, W: number, H: number, seed: number, k: number) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const pat = g.createPattern(grainTex(), 'repeat');
  if (pat) { g.globalAlpha = k; g.translate(-(seed % 256), -((seed >> 8) % 256)); g.fillStyle = pat; g.fillRect(seed % 256, (seed >> 8) % 256, W, H); }
  g.restore();
  // 自上而下的明暗
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,250,235,0.10)'); gr.addColorStop(1, 'rgba(20,16,12,0.22)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
}

export interface StandDef { k: StandKind; w: number; h: number; seed: number; flip?: boolean; pts?: [number, number][]; name?: string }

export function renderLmStand(s: StandDef, res: number): Spr | null {
  const rnd = mulberry32(s.seed >>> 0);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  if (s.k === 'ruinhall') return texSprite('hall_grey', s.w, res, 'saturate(0.25) brightness(0.82) contrast(1.05)', false, (g, tw, th) => {
    // 残破：裂纹、塌角、藤蔓
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); const cx = tw * R(0.15, 0.35) * (rnd() < 0.5 ? -1 : 1); g.moveTo(cx - 30, -th); g.lineTo(cx + 40, -th); g.lineTo(cx + 20, -th * 0.7); g.lineTo(cx - 10, -th * 0.78); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(30,26,22,0.6)'; g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { let x = R(-tw / 2, tw / 2) * 0.8, y = -th * R(0.2, 0.7); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += R(-8, 8); y += R(6, 14); g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(50,90,40,0.75)'; g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const x = R(-tw / 2, tw / 2) * 0.9, y0 = -th * R(0.4, 0.8), len = R(20, 60); g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + 6, y0 + len * 0.3, x - 6, y0 + len * 0.6, x, y0 + len); g.stroke(); for (let j = 0; j < 4; j++) { g.fillStyle = 'rgba(60,110,50,0.8)'; g.beginPath(); g.ellipse(x + R(-4, 4), y0 + len * R(0.1, 1), 3, 2, R(0, 3), 0, TAU); g.fill(); } }
  });
  if (s.k === 'gate') return texSprite('paifang', s.w, res, 'saturate(0.12) brightness(1.22) contrast(0.95)', false, (g, tw, th) => {
    g.fillStyle = 'rgba(30,40,60,0.9)'; g.fillRect(-tw * 0.13, -th * 0.74, tw * 0.26, th * 0.12);
    g.strokeStyle = 'rgba(210,180,90,0.95)'; g.lineWidth = 2; g.strokeRect(-tw * 0.13, -th * 0.74, tw * 0.26, th * 0.12);
    g.fillStyle = '#f0d890'; g.font = `${Math.round(th * 0.075)}px "Noto Serif SC",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.name ?? '', 0, -th * 0.68);
  });
  if (s.k === 'invtower') return texSprite('pagoda', s.w, res, 'saturate(0.35) brightness(0.62) contrast(1.15)', true, (g, tw, th) => {
    // 塔身符文微光
    for (let i = 0; i < 6; i++) { const y = th * (0.15 + i * 0.13); g.fillStyle = `rgba(200,60,60,${0.25 + 0.1 * (i % 2)})`; g.fillRect(-tw * 0.06, y, tw * 0.12, 3); }
  });
  // ---- 代码绘制的构件
  const pad = 40;
  let W = s.w + pad * 2, up = s.h + pad, down = pad;
  if (s.k === 'wall' && s.pts) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of s.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    W = Math.max(Math.abs(x0), Math.abs(x1)) * 2 + pad * 2; up = Math.max(0, -y0) + 140; down = Math.max(0, y1) + 20;
  }
  const H = up + down;
  const c = makeCanvas(Math.max(1, Math.ceil(W * res)), Math.max(1, Math.ceil(H * res)));
  const g = c.getContext('2d')!;
  g.scale(res, res); g.translate(W / 2, up);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (s.flip) g.scale(-1, 1);
  const w = s.w, h = s.h;
  switch (s.k) {
    case 'stoneplat': {
      g.fillStyle = 'rgba(20,10,8,0.45)'; g.beginPath(); g.ellipse(0, 4, w * 0.6, h * 0.35, 0, 0, TAU); g.fill();
      // 八角台基两层
      const oct = (rw: number, rh: number, yy: number) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; g.lineTo(Math.cos(a) * rw, yy + Math.sin(a) * rh); } g.closePath(); };
      g.fillStyle = '#4a3c36'; oct(w * 0.52, h * 0.32, -10); g.fill(); g.fillStyle = '#3a2e2a'; g.fillRect(-w * 0.48, -10, w * 0.96, 14);
      g.fillStyle = '#7a6a5e'; oct(w * 0.5, h * 0.3, -24); g.fill(); g.strokeStyle = 'rgba(30,20,16,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#8a7a6c'; oct(w * 0.34, h * 0.2, -36); g.fill(); g.stroke();
      g.fillStyle = '#5a4a40'; g.fillRect(-w * 0.32, -36, w * 0.64, 12);
      // 刻纹
      g.strokeStyle = 'rgba(255,150,70,0.65)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, -42, w * 0.22, h * 0.12, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * w * 0.12, -42 + Math.sin(a) * h * 0.07); g.lineTo(Math.cos(a) * w * 0.22, -42 + Math.sin(a) * h * 0.12); g.stroke(); }
      // 台上残剑
      g.strokeStyle = '#b8b0a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, -44); g.lineTo(18, -96); g.stroke();
      g.strokeStyle = '#6a5040'; g.lineWidth = 6; g.beginPath(); g.moveTo(7, -58); g.lineTo(15, -60); g.stroke();
      break;
    }
    case 'remains': {
      // 阵纹
      g.strokeStyle = 'rgba(170,150,220,0.45)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, -2, 60, 20, 0, 0, TAU); g.stroke();
      g.beginPath(); g.ellipse(0, -2, 44, 14, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.fillStyle = 'rgba(170,150,220,0.6)'; g.fillRect(Math.cos(a) * 52 - 2, -2 + Math.sin(a) * 17 - 2, 4, 4); }
      // 坐化的枯骨：盘膝、破袍
      g.fillStyle = 'rgba(30,26,22,0.3)'; g.beginPath(); g.ellipse(4, 0, 34, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#5a5a62'; g.beginPath(); g.moveTo(-30, -2); g.quadraticCurveTo(-26, -22, -14, -26); g.lineTo(14, -26); g.quadraticCurveTo(28, -22, 30, -2); g.closePath(); g.fill();
      g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(-14, -26); g.lineTo(-12, -62); g.lineTo(12, -62); g.lineTo(14, -26); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,20,24,0.6)'; g.lineWidth = 1; g.stroke();
      for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(30,30,36,0.5)'; g.beginPath(); g.moveTo(-12 + i * 6, -30); g.lineTo(-14 + i * 6, -4 + (i % 2) * 3); g.stroke(); }
      g.strokeStyle = '#e4dccb'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-10, -56); g.lineTo(-16, -40); g.lineTo(-4, -32); g.moveTo(10, -56); g.lineTo(16, -40); g.lineTo(4, -32); g.stroke();
      g.fillStyle = '#ece4d2'; g.beginPath(); g.ellipse(0, -72, 9, 10, 0.15, 0, TAU); g.fill();
      g.fillStyle = '#2a2420'; g.beginPath(); g.arc(-3, -73, 2, 0, TAU); g.arc(4, -73, 2, 0, TAU); g.fill(); g.fillRect(-3, -66, 6, 2);
      // 断剑插地
      g.strokeStyle = '#a8a094'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(38, -2); g.lineTo(42, -40); g.stroke();
      g.strokeStyle = '#5a4030'; g.lineWidth = 5; g.beginPath(); g.moveTo(36, -28); g.lineTo(46, -29); g.stroke();
      break;
    }
    case 'bloodgate': {
      // 石门半没水中：双柱 + 横梁 + 门板上的独角鬼头
      const col = '#6a5c56', dark = '#3a302c';
      for (const sx of [-1, 1]) { g.fillStyle = col; g.fillRect(sx * w * 0.42 - 22, -h, 44, h); g.fillStyle = dark; g.fillRect(sx * w * 0.42 + 10, -h, 12, h); }
      g.fillStyle = col; g.fillRect(-w * 0.56, -h - 34, w * 1.12, 40); g.fillStyle = dark; g.fillRect(-w * 0.56, -h + 0, w * 1.12, 6);
      g.fillStyle = '#4a3e3a'; g.fillRect(-w * 0.36, -h + 6, w * 0.72, h - 6);
      g.strokeStyle = 'rgba(20,14,12,0.7)'; g.lineWidth = 1.5; g.strokeRect(-w * 0.36, -h + 6, w * 0.72, h - 6);
      g.beginPath(); g.moveTo(0, -h + 6); g.lineTo(0, 0); g.stroke();
      // 鬼头浮雕
      const hy = -h * 0.55;
      g.fillStyle = '#5a4c48'; g.beginPath(); g.ellipse(0, hy, w * 0.2, h * 0.18, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#6a5a54'; g.beginPath(); g.moveTo(-8, hy - h * 0.16); g.lineTo(0, hy - h * 0.38); g.lineTo(8, hy - h * 0.16); g.closePath(); g.fill(); g.stroke();
      for (const sx of [-1, 1]) { g.fillStyle = 'rgba(255,40,30,0.9)'; g.beginPath(); g.ellipse(sx * w * 0.08, hy - 6, 8, 5, sx * 0.3, 0, TAU); g.fill(); }
      g.fillStyle = '#2a201e'; g.beginPath(); g.moveTo(-w * 0.12, hy + 18); g.quadraticCurveTo(0, hy + 40, w * 0.12, hy + 18); g.quadraticCurveTo(0, hy + 28, -w * 0.12, hy + 18); g.fill();
      for (const sx of [-1, 1]) { g.fillStyle = '#e8dcc8'; g.beginPath(); g.moveTo(sx * w * 0.07, hy + 22); g.lineTo(sx * w * 0.05, hy + 36); g.lineTo(sx * w * 0.03, hy + 24); g.fill(); }
      // 血咒符文
      g.strokeStyle = 'rgba(220,30,30,0.8)'; g.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const x = R(-w * 0.32, w * 0.32), y = R(-h * 0.25, -20); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-6, 6), y + R(6, 14)); g.lineTo(x + R(-8, 8), y + R(10, 20)); g.stroke(); }
      // 水线
      g.fillStyle = 'rgba(70,20,24,0.65)'; g.fillRect(-w * 0.6, -18, w * 1.2, 22);
      g.strokeStyle = 'rgba(220,120,120,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w * 0.6, -18); g.lineTo(w * 0.6, -18); g.stroke();
      break;
    }
    case 'altar': {
      // 白石祭坛：三层台基、正面石阶、顶部祭台
      g.fillStyle = 'rgba(40,36,30,0.25)'; g.beginPath(); g.ellipse(10, 6, w * 0.62, 50, 0, 0, TAU); g.fill();
      const tiers = 3; let y = 0;
      for (let i = 0; i < tiers; i++) {
        const tw = w * (1 - i * 0.24), th = h * 0.17, td = h * 0.1;
        stoneBlock(g, 0, y, tw, td, th, i % 2 ? '#e6e2d6' : '#dcd8cc', i % 2 ? '#bab4a6' : '#c4beb0', rnd);
        y -= th + td * 0.55;
      }
      // 石阶
      const sw = w * 0.2;
      for (let i = 0; i < 18; i++) { const yy = -i * (h * 0.034), ww = sw * (1 - i * 0.012); g.fillStyle = i % 2 ? '#ece8dc' : '#d6d0c2'; g.fillRect(-ww / 2, yy - h * 0.034, ww, h * 0.034); }
      g.strokeStyle = 'rgba(60,56,48,0.4)'; g.lineWidth = 1; g.strokeRect(-sw / 2, -18 * h * 0.034, sw, 18 * h * 0.034);
      // 顶部祭台 + 血阵
      const ty = y - 6;
      g.fillStyle = '#f0ece2'; g.beginPath(); g.ellipse(0, ty, w * 0.22, h * 0.05, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,30,30,0.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, ty, w * 0.17, h * 0.035, 0, 0, TAU); g.stroke();
      g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * w * 0.15, ty + Math.sin(a) * h * 0.03); } g.stroke();
      // 四角石灯
      for (const [sx, sy] of [[-1, 0], [1, 0], [-0.7, -1], [0.7, -1]]) { const x = sx * w * 0.28, yy = ty + 8 + sy * 10; g.fillStyle = '#c8c2b4'; g.fillRect(x - 6, yy - 30, 12, 30); g.fillStyle = 'rgba(255,90,60,0.85)'; g.beginPath(); g.arc(x, yy - 34, 5, 0, TAU); g.fill(); }
      // 岁月裂痕与血迹
      g.strokeStyle = 'rgba(90,80,70,0.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) { let x = R(-w * 0.45, w * 0.45), yy = R(-h * 0.6, -10); g.beginPath(); g.moveTo(x, yy); for (let j = 0; j < 3; j++) { x += R(-10, 10); yy += R(5, 14); g.lineTo(x, yy); } g.stroke(); }
      g.fillStyle = 'rgba(140,20,24,0.4)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(R(-w * 0.15, w * 0.15), ty + R(0, 30) + i * 6, R(3, 10), R(2, 4), 0, 0, TAU); g.fill(); }
      break;
    }
    case 'cave': {
      // 山岩洞口
      g.fillStyle = '#5a5a56'; g.beginPath(); g.moveTo(-w / 2, 0); g.quadraticCurveTo(-w * 0.5, -h * 1.1, 0, -h * 1.15); g.quadraticCurveTo(w * 0.55, -h * 1.05, w / 2, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,30,28,0.7)'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '30,34,30' : '150,150,140'},${R(0.1, 0.25)})`; g.beginPath(); g.ellipse(R(-w * 0.45, w * 0.45), R(-h, -10), R(8, 24), R(5, 12), R(0, 3), 0, TAU); g.fill(); }
      const cg = g.createRadialGradient(0, -h * 0.35, 4, 0, -h * 0.3, w * 0.3);
      cg.addColorStop(0, '#000'); cg.addColorStop(0.7, '#0c0c12'); cg.addColorStop(1, 'rgba(20,20,26,0.9)');
      g.fillStyle = cg; g.beginPath(); g.moveTo(-w * 0.28, 0); g.quadraticCurveTo(-w * 0.3, -h * 0.75, 0, -h * 0.78); g.quadraticCurveTo(w * 0.3, -h * 0.72, w * 0.28, 0); g.closePath(); g.fill();
      for (let i = 0; i < 8; i++) { const x = R(-w * 0.24, w * 0.24); g.fillStyle = '#6a6a64'; g.beginPath(); g.moveTo(x - 5, -h * 0.72 + Math.abs(x) * 0.4); g.lineTo(x, -h * 0.72 + Math.abs(x) * 0.4 + R(10, 26)); g.lineTo(x + 5, -h * 0.72 + Math.abs(x) * 0.4); g.fill(); }
      g.fillStyle = 'rgba(150,90,200,0.25)'; g.beginPath(); g.ellipse(0, -8, w * 0.22, 10, 0, 0, TAU); g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(226,220,204,0.85)'; g.beginPath(); g.ellipse(R(-w * 0.4, w * 0.4), R(-6, 6), 6, 3, R(0, 3), 0, TAU); g.fill(); }
      break;
    }
    case 'corpsepost': {
      g.fillStyle = 'rgba(30,26,22,0.3)'; g.beginPath(); g.ellipse(0, 2, 30, 8, 0, 0, TAU); g.fill();
      g.fillStyle = '#6a6660'; g.fillRect(-w * 0.3, -h, w * 0.6, h); g.fillStyle = '#4a4640'; g.fillRect(w * 0.12, -h, w * 0.18, h);
      g.fillStyle = '#7a766e'; g.fillRect(-w * 0.4, -h - 14, w * 0.8, 14);
      g.strokeStyle = 'rgba(30,26,22,0.6)'; g.lineWidth = 1.2; g.strokeRect(-w * 0.3, -h, w * 0.6, h);
      // 刻符
      g.strokeStyle = 'rgba(200,170,90,0.6)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-6, -h + 24 + i * 34); g.lineTo(6, -h + 30 + i * 34); g.lineTo(-4, -h + 40 + i * 34); g.stroke(); }
      // 被铁链缚住的炼尸
      const cy = -h * 0.5;
      g.fillStyle = '#2e2c30'; g.beginPath(); g.moveTo(-14, cy - 40); g.lineTo(14, cy - 40); g.lineTo(18, cy + 40); g.lineTo(-18, cy + 40); g.closePath(); g.fill();
      g.fillStyle = '#7a8476'; g.beginPath(); g.ellipse(2, cy - 50, 8, 10, 0.3, 0, TAU); g.fill();
      g.fillStyle = '#141214'; g.beginPath(); g.moveTo(-8, cy - 54); g.quadraticCurveTo(0, cy - 66, 10, cy - 56); g.lineTo(8, cy - 34); g.lineTo(-8, cy - 36); g.fill();
      g.strokeStyle = '#8a8680'; g.lineWidth = 2;
      for (const yy of [cy - 30, cy, cy + 26]) { g.beginPath(); g.ellipse(0, yy, w * 0.42, 6, 0, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(138,134,128,0.9)'; g.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(w * 0.36 + i * 1.5, cy + 30 + i * 9, 2.6, 4, 0, 0, TAU); g.stroke(); }
      break;
    }
    case 'crystal': {
      g.fillStyle = 'rgba(30,50,70,0.25)'; g.beginPath(); g.ellipse(0, 2, w * 0.6, 10, 0, 0, TAU); g.fill();
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const x = R(-w * 0.35, w * 0.35), hh = h * R(0.45, 1), ww = w * R(0.16, 0.28), a = R(-0.35, 0.35);
        g.save(); g.translate(x, 0); g.rotate(a);
        const gr = g.createLinearGradient(-ww, 0, ww, 0); gr.addColorStop(0, 'rgba(170,220,255,0.92)'); gr.addColorStop(0.5, 'rgba(236,248,255,0.95)'); gr.addColorStop(1, 'rgba(110,170,230,0.9)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(-ww / 2, 0); g.lineTo(-ww / 2, -hh * 0.82); g.lineTo(0, -hh); g.lineTo(ww / 2, -hh * 0.82); g.lineTo(ww / 2, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(60,110,170,0.7)'; g.lineWidth = 1; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(-ww * 0.1, -4); g.lineTo(-ww * 0.1, -hh * 0.85); g.stroke();
        g.restore();
      }
      break;
    }
    case 'obelisk': {
      const ice = (s.name ?? '').includes('晶');
      g.fillStyle = 'rgba(30,30,30,0.25)'; g.beginPath(); g.ellipse(0, 2, w * 0.8, 9, 0, 0, TAU); g.fill();
      g.fillStyle = ice ? '#9ab8d0' : '#5a3a34'; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w * 0.36, -h); g.lineTo(0, -h - 18); g.lineTo(w * 0.36, -h); g.lineTo(w / 2, 0); g.closePath(); g.fill();
      g.fillStyle = ice ? 'rgba(60,90,130,0.4)' : 'rgba(20,10,8,0.4)'; g.beginPath(); g.moveTo(w * 0.05, 0); g.lineTo(w * 0.06, -h); g.lineTo(w * 0.36, -h); g.lineTo(w / 2, 0); g.fill();
      g.strokeStyle = ice ? 'rgba(220,240,255,0.95)' : 'rgba(255,150,60,0.95)'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const y = -h * (0.2 + i * 0.18); g.beginPath(); g.moveTo(-w * 0.18, y); g.lineTo(w * 0.0, y - 8); g.lineTo(-w * 0.12, y - 16); g.stroke(); }
      break;
    }
    case 'wall': {
      // 石墙：沿弧线逐块砌成（任何朝向都有体积），偶有坍塌
      const pts = s.pts!; const wh = 104, bw = 44, bd = 30;
      const blocks: [number, number, number][] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [xa, ya] = pts[i], [xb, yb] = pts[i + 1];
        const n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya) / 36));
        for (let j = 0; j < n; j++) { const t = j / n; blocks.push([xa + (xb - xa) * t, ya + (yb - ya) * t, rnd()]); }
      }
      blocks.push([...pts[pts.length - 1], rnd()] as [number, number, number]);
      blocks.sort((p, q) => p[1] - q[1]);
      for (const [x, y, r] of blocks) {
        const hh = r < 0.1 ? wh * R(0.25, 0.5) : wh * R(0.9, 1.04);
        const tone = R(-0.06, 0.06);
        g.fillStyle = 'rgba(30,26,20,0.22)'; g.beginPath(); g.ellipse(x + 6, y + 4, bw * 0.6, 9, 0, 0, TAU); g.fill();
        g.fillStyle = mix('#7a7468', tone > 0 ? '#ffffff' : '#000000', Math.abs(tone)); g.fillRect(x - bw / 2, y - hh, bw, hh);
        g.fillStyle = mix('#a8a296', tone > 0 ? '#ffffff' : '#000000', Math.abs(tone)); g.fillRect(x - bw / 2, y - hh - bd * 0.5, bw, bd * 0.5);
        g.strokeStyle = 'rgba(40,36,30,0.45)'; g.lineWidth = 1;
        for (let k = 1; k < 4; k++) { const yy = y - hh * k / 4; g.beginPath(); g.moveTo(x - bw / 2, yy); g.lineTo(x + bw / 2, yy); g.stroke(); const xx = x - bw / 2 + ((k % 2) ? bw * 0.45 : bw * 0.2); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + hh / 4); g.stroke(); }
        if (r > 0.75) { g.fillStyle = 'rgba(70,100,56,0.55)'; g.beginPath(); g.ellipse(x + R(-14, 14), y - hh * R(0.1, 0.6), R(6, 14), R(3, 7), 0, 0, TAU); g.fill(); }
        if (r < 0.1) for (let k = 0; k < 4; k++) { g.fillStyle = '#7a746a'; g.beginPath(); g.ellipse(x + R(-30, 30), y + R(0, 14), R(5, 11), R(3, 6), 0, 0, TAU); g.fill(); }
      }
      break;
    }
    default: break;
  }
  if (s.k !== 'crystal' && s.k !== 'remains') grainPass(g, c.width, c.height, s.seed, s.k === 'altar' ? 0.28 : 0.4);
  return { canvas: c as HTMLCanvasElement, w: W, h: H, ax: W / 2, ay: up };
}

/** 空间裂缝（逐帧）：漆黑的竖向裂口，边缘紫白电光，四周碎屑被吸入 */
export function drawRift(g: G, x: number, y: number, t: number, open: number, seed: number, a: number) {
  if (open <= 0.02 || a <= 0) return;
  const rnd = mulberry32(seed);
  const H = 190 * open, W = 26 * open;
  g.save(); g.globalAlpha *= a;
  g.translate(x, y - 110);
  // 扭曲光晕
  const hg = g.createRadialGradient(0, 0, 4, 0, 0, 150 * open);
  hg.addColorStop(0, 'rgba(170,120,255,0.35)'); hg.addColorStop(1, 'rgba(120,80,220,0)');
  g.fillStyle = hg; g.beginPath(); g.ellipse(0, 0, 150 * open, 170 * open, 0, 0, TAU); g.fill();
  // 裂口
  const pts: [number, number][] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) { const v = i / N; pts.push([Math.sin(v * 9 + seed + t * 2) * 6 * open + (rnd() - 0.5) * 8, -H / 2 + v * H]); }
  const shape = () => { g.beginPath(); pts.forEach(([px, py], i) => { const wv = W * Math.sin((i / N) * Math.PI) * (0.8 + 0.2 * Math.sin(t * 7 + i)); if (i === 0) g.moveTo(px + wv, py); else g.lineTo(px + wv, py); }); for (let i = N; i >= 0; i--) { const [px, py] = pts[i]; const wv = W * Math.sin((i / N) * Math.PI) * (0.8 + 0.2 * Math.sin(t * 6 + i * 2)); g.lineTo(px - wv, py); } g.closePath(); };
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(200,170,255,0.55)'; g.lineWidth = 9; shape(); g.stroke();
  g.strokeStyle = 'rgba(245,235,255,0.9)'; g.lineWidth = 2.2; shape(); g.stroke();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#05030a'; shape(); g.fill();
  // 内里星点
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(220,200,255,${0.5 + 0.5 * Math.sin(t * 5 + i)})`; g.beginPath(); g.arc((rnd() - 0.5) * W * 0.6, (rnd() - 0.5) * H * 0.7, 1.4, 0, TAU); g.fill(); }
  // 被吸入的碎屑
  for (let i = 0; i < 14; i++) {
    const ph = (t * 0.7 + i / 14) % 1, an = rnd() * TAU, r = (1 - ph) * 160 * open;
    g.fillStyle = `rgba(210,190,255,${ph * 0.8})`;
    g.beginPath(); g.arc(Math.cos(an) * r, Math.sin(an) * r * 0.9, 1.6 + ph * 1.5, 0, TAU); g.fill();
  }
  // 电弧
  if (Math.sin(t * 11 + seed) > 0.6) {
    g.strokeStyle = 'rgba(235,220,255,0.85)'; g.lineWidth = 1.4; g.beginPath();
    let px = (rnd() - 0.5) * W, py = (rnd() - 0.5) * H; g.moveTo(px, py);
    for (let i = 0; i < 5; i++) { px += (rnd() - 0.5) * 40; py += (rnd() - 0.5) * 30; g.lineTo(px, py); }
    g.stroke();
  }
  g.restore();
}

/** 乌龙潭的黑色旋涡（逐帧） */
export function drawWhirl(g: G, x: number, y: number, t: number, r: number) {
  g.save(); g.translate(x, y); g.scale(1, 0.45);
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = `rgba(${k % 2 ? '20,26,34' : '120,150,170'},${0.5 - k * 0.08})`; g.lineWidth = 3 - k * 0.4;
    g.beginPath();
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU * 2.2 + t * (1.4 + k * 0.2) + k * 1.6, rr = r * (1 - i / 66); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.stroke();
  }
  const cg = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.3); cg.addColorStop(0, 'rgba(0,0,0,0.9)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.fill();
  g.restore();
}

/** 雾团贴图 */
let puffImg: HTMLCanvasElement | null = null;
export function mistPuff(): HTMLCanvasElement {
  if (puffImg) return puffImg;
  const W = 256, H = 128;
  const c = makeCanvas(W, H); const g = c.getContext('2d')!;
  const im = g.createImageData(W, H); const D = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * 2 - 1, v = (y / H) * 2 - 1;
    const d = Math.hypot(u, v);
    const n = fbm(x / 40, y / 40, 4, 11);
    const a = sm(1, 0.2, d + (n - 0.5) * 0.7) * (0.55 + n * 0.6);
    const i = (y * W + x) * 4; D[i] = 255; D[i + 1] = 255; D[i + 2] = 255; D[i + 3] = clamp(a, 0, 1) * 255;
  }
  g.putImageData(im, 0, 0);
  puffImg = c as HTMLCanvasElement;
  return puffImg;
}
export { rgba };
