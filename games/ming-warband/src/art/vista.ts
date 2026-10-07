// 城镇/关城/村庄面板顶部的水墨横幅：远山、云雾、城墙楼阁或农舍柳树，随时辰、季节、天气、战况变化
import { makeCanvas, srand, css, shade } from './canvas';
import type { Weather } from '../core/weather';

type Ctx = CanvasRenderingContext2D;
export interface VistaOpts {
  kind: 'town' | 'castle' | 'village';
  seed: number; hour: number; season: number; weather: Weather;
  color: number; looted: boolean; siege: boolean; capital: boolean; south: boolean;
}

export function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const W = 560, H = 150;

export function settlementVista(o: VistaOpts): HTMLCanvasElement {
  const cv = makeCanvas(W, H) as unknown as HTMLCanvasElement;
  const c = cv.getContext('2d') as Ctx;
  const r = srand(o.seed);
  const night = o.hour < 5 || o.hour >= 20;
  const dusk = (o.hour >= 17 && o.hour < 20) || (o.hour >= 5 && o.hour < 7);
  const winter = o.season === 3;
  const snowy = winter || o.weather.kind === 'snow';

  // 宣纸底色 + 天色
  const sky = c.createLinearGradient(0, 0, 0, H);
  if (night) { sky.addColorStop(0, '#1a2238'); sky.addColorStop(1, '#3a3e4a'); }
  else if (dusk) { sky.addColorStop(0, '#e8c8a0'); sky.addColorStop(0.7, '#f2dcb8'); sky.addColorStop(1, '#efe2c6'); }
  else { sky.addColorStop(0, '#e9e2cc'); sky.addColorStop(1, '#f3ecd8'); }
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // 纸纹
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${night ? '255,255,255' : '120,90,50'},${0.03 + r() * 0.04})`; c.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }

  // 日 / 月（朱红日、淡月）
  if (o.weather.k < 0.4) {
    const sx = W * (0.12 + ((o.hour + 24 - 5) % 24) / 24 * 0.8), sy = 30 + r() * 10;
    if (night) { c.fillStyle = 'rgba(244,238,214,0.9)'; c.beginPath(); c.arc(sx, sy, 11, 0, Math.PI * 2); c.fill(); }
    else { c.fillStyle = dusk ? 'rgba(200,60,30,0.85)' : 'rgba(196,58,40,0.7)'; c.beginPath(); c.arc(sx, sy, 12, 0, Math.PI * 2); c.fill(); }
  }

  // 三层远山（泼墨，越远越淡）
  const ink = night ? [60, 70, 90] : [70, 78, 84];
  for (let layer = 0; layer < 3; layer++) {
    const base = 70 + layer * 18, amp = 34 - layer * 8, alpha = 0.18 + layer * 0.16;
    const g = c.createLinearGradient(0, base - amp, 0, base + 30);
    g.addColorStop(0, `rgba(${ink[0] - layer * 10},${ink[1] - layer * 10},${ink[2] - layer * 8},${alpha})`);
    g.addColorStop(1, `rgba(${ink[0]},${ink[1]},${ink[2]},0)`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, H);
    let y = base; const ph = r() * 10, ph2 = r() * 10;
    for (let x = 0; x <= W; x += 4) {
      y = base - amp * (0.5 + 0.35 * Math.sin(x * 0.012 + ph) + 0.2 * Math.sin(x * 0.037 + ph2) + 0.08 * Math.sin(x * 0.11 + layer));
      c.lineTo(x, y);
    }
    c.lineTo(W, H); c.closePath(); c.fill();
    // 山脊皴笔
    c.strokeStyle = `rgba(40,40,44,${alpha * 0.6})`; c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= W; x += 4) { const yy = base - amp * (0.5 + 0.35 * Math.sin(x * 0.012 + ph) + 0.2 * Math.sin(x * 0.037 + ph2) + 0.08 * Math.sin(x * 0.11 + layer)); x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
    c.stroke();
    if (snowy) { c.strokeStyle = `rgba(255,255,255,${(night ? 0.18 : 0.4) - layer * 0.05})`; c.lineWidth = 1.4; c.stroke(); }
    // 云雾带
    const mist = c.createLinearGradient(0, base - 6, 0, base + 18);
    mist.addColorStop(0, 'rgba(240,234,218,0)'); mist.addColorStop(0.5, night ? 'rgba(80,86,100,0.5)' : 'rgba(243,236,216,0.75)'); mist.addColorStop(1, 'rgba(240,234,218,0)');
    c.fillStyle = mist; c.fillRect(0, base - 6, W, 24);
  }

  const groundY = H - 26;
  // 地面
  const gg = c.createLinearGradient(0, groundY - 6, 0, H);
  gg.addColorStop(0, night ? 'rgba(40,46,40,0.6)' : snowy ? 'rgba(236,238,240,0.95)' : o.south ? 'rgba(120,150,90,0.55)' : 'rgba(150,140,90,0.5)');
  gg.addColorStop(1, night ? 'rgba(30,34,30,0.85)' : snowy ? 'rgba(220,224,230,1)' : o.south ? 'rgba(90,120,70,0.7)' : 'rgba(120,110,70,0.7)');
  c.fillStyle = gg; c.fillRect(0, groundY - 6, W, H);

  const cx = W * (0.42 + r() * 0.16);
  if (o.kind === 'town') drawCity(c, cx, groundY, o, r, night, snowy);
  else if (o.kind === 'castle') drawFort(c, cx, groundY, o, r, night, snowy);
  else drawVillage(c, cx, groundY, o, r, night, snowy);

  // 前景：松 / 柳与草
  pine(c, 26 + r() * 30, H + 4, 1.1 + r() * 0.3, night, snowy);
  if (r() < 0.6) pine(c, W - 30 - r() * 30, H + 6, 0.9 + r() * 0.3, night, snowy);
  c.strokeStyle = night ? 'rgba(20,24,20,0.7)' : 'rgba(50,60,30,0.6)'; c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 90; i++) { const x = r() * W, y = H - r() * 14; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); }
  c.stroke();

  // 战火、洗劫
  if (o.looted || o.siege) {
    for (let k = 0; k < (o.siege ? 4 : 3); k++) {
      const x = cx - 80 + r() * 160, y = groundY - 18 - r() * 10;
      for (let j = 0; j < 7; j++) { c.fillStyle = `rgba(40,34,30,${0.22 - j * 0.025})`; c.beginPath(); c.arc(x + j * 7, y - j * 9, 6 + j * 3, 0, Math.PI * 2); c.fill(); }
      const fg = c.createRadialGradient(x, y + 6, 0, x, y + 6, 22); fg.addColorStop(0, 'rgba(255,160,40,0.8)'); fg.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = fg; c.fillRect(x - 22, y - 16, 44, 44);
    }
  }

  // 天气
  if (o.weather.kind === 'rain' && o.weather.k > 0.1) {
    c.fillStyle = `rgba(60,70,80,${0.25 * o.weather.k})`; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(70,80,90,0.45)'; c.lineWidth = 0.8; c.beginPath();
    for (let i = 0; i < 260 * o.weather.k; i++) { const x = r() * W, y = r() * H; c.moveTo(x, y); c.lineTo(x - 3, y + 11); }
    c.stroke();
  } else if (o.weather.kind === 'snow' && o.weather.k > 0.1) {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 220 * o.weather.k; i++) { c.beginPath(); c.arc(r() * W, r() * H, 0.8 + r() * 1.4, 0, Math.PI * 2); c.fill(); }
  }
  // 题字印章
  c.fillStyle = 'rgba(170,40,30,0.85)'; c.fillRect(W - 30, 12, 16, 16);
  c.strokeStyle = 'rgba(255,235,210,0.8)'; c.lineWidth = 1; c.strokeRect(W - 28, 14, 12, 12);
  // 暗角
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, night ? 'rgba(0,0,10,0.45)' : 'rgba(90,60,20,0.22)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  return cv;
}

// ---------- 构件 ----------
function roofShape(c: Ctx, x: number, y: number, w: number, h: number, col: string, snow: boolean) {
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x - w / 2 - 4, y + 1); c.quadraticCurveTo(x - w / 2 + 2, y - 1, x - w / 2 + 4, y - h); c.lineTo(x + w / 2 - 4, y - h); c.quadraticCurveTo(x + w / 2 - 2, y - 1, x + w / 2 + 4, y + 1); c.closePath(); c.fill();
  if (snow) { c.fillStyle = 'rgba(250,252,255,0.95)'; c.beginPath(); c.moveTo(x - w / 2 + 3, y - h + 2); c.lineTo(x + w / 2 - 3, y - h + 2); c.lineTo(x + w / 2 - 6, y - h - 1); c.lineTo(x - w / 2 + 6, y - h - 1); c.closePath(); c.fill(); }
}
function tower(c: Ctx, x: number, base: number, w: number, tiers: number, night: boolean, snow: boolean, flag: number | null) {
  const wall = night ? '#4a4844' : '#8a8274';
  let y = base;
  for (let t = 0; t < tiers; t++) {
    const ww = w * (1 - t * 0.2);
    c.fillStyle = night ? '#5a2420' : '#9a3a2a'; c.fillRect(x - ww * 0.36, y - 9, ww * 0.72, 9);
    if (night) { c.fillStyle = 'rgba(255,200,100,0.85)'; for (let k = 0; k < 3; k++) c.fillRect(x - ww * 0.26 + k * ww * 0.2, y - 7, ww * 0.08, 5); }
    else { c.fillStyle = 'rgba(30,15,8,0.5)'; for (let k = 0; k < 3; k++) c.fillRect(x - ww * 0.26 + k * ww * 0.2, y - 7, ww * 0.08, 5); }
    roofShape(c, x, y - 9, ww, 6, night ? '#1e2228' : '#33383e', snow);
    y -= 15;
  }
  if (flag !== null) {
    c.strokeStyle = '#3a2410'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y - 14); c.stroke();
    c.fillStyle = css(flag); c.beginPath(); c.moveTo(x, y - 14); c.quadraticCurveTo(x + 9, y - 16, x + 15, y - 12); c.lineTo(x + 13, y - 7); c.quadraticCurveTo(x + 7, y - 9, x, y - 6); c.closePath(); c.fill();
  }
  void wall;
}
function cityWall(c: Ctx, x0: number, x1: number, top: number, base: number, night: boolean, snow: boolean) {
  const g = c.createLinearGradient(0, top, 0, base);
  g.addColorStop(0, night ? '#545a60' : '#a49a88'); g.addColorStop(1, night ? '#3a3e44' : '#7c7466');
  c.fillStyle = g; c.fillRect(x0, top, x1 - x0, base - top);
  // 砖缝
  c.strokeStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(60,50,40,0.22)'; c.lineWidth = 0.6;
  c.beginPath(); for (let y = top + 4; y < base; y += 4) { c.moveTo(x0, y); c.lineTo(x1, y); } c.stroke();
  // 垛口
  c.fillStyle = night ? '#5e646a' : '#b2a894';
  for (let x = x0; x < x1 - 3; x += 7) c.fillRect(x, top - 4, 4.5, 4);
  if (snow) { c.fillStyle = 'rgba(250,252,255,0.9)'; c.fillRect(x0, top - 1, x1 - x0, 1.6); for (let x = x0; x < x1 - 3; x += 7) c.fillRect(x, top - 5, 4.5, 1.4); }
}
function house(c: Ctx, x: number, base: number, w: number, h: number, night: boolean, snow: boolean, thatch: boolean, lit: boolean) {
  c.fillStyle = night ? '#6a6458' : thatch ? '#c8b088' : '#e4dccb'; c.fillRect(x - w / 2, base - h, w, h);
  c.fillStyle = night ? (lit ? 'rgba(255,200,110,0.9)' : '#2a2a2a') : 'rgba(40,30,20,0.6)'; c.fillRect(x - w * 0.15, base - h * 0.7, w * 0.22, h * 0.4);
  roofShape(c, x, base - h, w, thatch ? 7 : 5, thatch ? (night ? '#4a4030' : '#9a8050') : (night ? '#20242a' : '#3c4248'), snow);
}
function pine(c: Ctx, x: number, base: number, s: number, night: boolean, snow: boolean) {
  c.strokeStyle = night ? '#1a1a18' : '#3a2a1c'; c.lineWidth = 3 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x - 6 * s, base - 30 * s, x + 4 * s, base - 62 * s); c.stroke();
  const tiers: [number, number, number][] = [[-50, -18, 14], [-38, 14, 16], [-26, -14, 18], [-60, 10, 12]];
  for (const [dy, dx, w] of tiers) {
    const yy = base + dy * s, xx = x + dx * s * 0.6;
    c.strokeStyle = night ? '#1a1a18' : '#3a2a1c'; c.lineWidth = 1.5 * s; c.beginPath(); c.moveTo(x, yy + 4 * s); c.lineTo(xx, yy); c.stroke();
    c.fillStyle = night ? 'rgba(20,30,24,0.92)' : 'rgba(40,62,44,0.88)';
    c.beginPath(); c.ellipse(xx, yy, w * s, 5 * s, 0, 0, Math.PI * 2); c.fill();
    if (snow) { c.fillStyle = 'rgba(250,252,255,0.9)'; c.beginPath(); c.ellipse(xx, yy - 2.5 * s, w * s * 0.8, 2 * s, 0, Math.PI, Math.PI * 2); c.fill(); }
  }
}
function willow(c: Ctx, x: number, base: number, night: boolean, season: number) {
  c.strokeStyle = night ? '#1a1a18' : '#4a3a26'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, base); c.lineTo(x + 2, base - 28); c.stroke();
  const leaf = night ? 'rgba(30,40,30,0.7)' : season === 2 ? 'rgba(190,150,60,0.6)' : season === 3 ? 'rgba(90,80,60,0.4)' : 'rgba(110,150,70,0.6)';
  c.strokeStyle = leaf; c.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const sx = x + 2 + Math.cos(a) * 12, sy = base - 30 + Math.sin(a) * 5; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + Math.cos(a) * 4, sy + 8, sx + Math.cos(a) * 3, sy + 18 + (i % 3) * 3); c.stroke(); }
}

function drawCity(c: Ctx, cx: number, gy: number, o: VistaOpts, r: () => number, night: boolean, snow: boolean) {
  const x0 = cx - 170, x1 = cx + 170, top = gy - 30;
  // 城内屋顶与塔
  for (let i = 0; i < 16; i++) { const x = x0 + 10 + r() * (x1 - x0 - 20); roofShape(c, x, top - 2 - r() * 6, 16 + r() * 12, 5, night ? '#262a30' : '#4a5056', snow); }
  // 宝塔
  const px = cx + (r() < 0.5 ? -110 : 110);
  for (let t = 0; t < 7; t++) { const w = 18 - t * 2; c.fillStyle = night ? '#5a5650' : '#c8bca0'; c.fillRect(px - w * 0.35, top - 8 - t * 9, w * 0.7, 6); roofShape(c, px, top - 8 - t * 9, w, 3, night ? '#20242a' : '#3a4046', snow); }
  c.strokeStyle = '#3a3020'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, top - 71); c.lineTo(px, top - 80); c.stroke();
  if (o.capital) { roofShape(c, cx + 50, top - 12, 54, 8, night ? '#5a4a20' : '#d8a62a', snow); c.fillStyle = night ? '#4a1a14' : '#a8342a'; c.fillRect(cx + 32, top - 12, 36, 10); }
  cityWall(c, x0, x1, top, gy + 2, night, snow);
  // 城门
  c.fillStyle = '#1e140c'; c.beginPath(); c.moveTo(cx - 9, gy + 2); c.lineTo(cx - 9, top + 14); c.arc(cx, top + 14, 9, Math.PI, 0); c.lineTo(cx + 9, gy + 2); c.closePath(); c.fill();
  if (night) { const g = c.createRadialGradient(cx, top + 18, 0, cx, top + 18, 26); g.addColorStop(0, 'rgba(255,190,90,0.6)'); g.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = g; c.fillRect(cx - 26, top - 8, 52, 52); }
  tower(c, cx, top - 3, 46, o.capital ? 3 : 2, night, snow, o.color);
  tower(c, x0 + 6, top - 3, 22, 1, night, snow, o.color);
  tower(c, x1 - 6, top - 3, 22, 1, night, snow, o.color);
  // 护城河
  c.fillStyle = night ? 'rgba(40,50,70,0.8)' : 'rgba(110,140,150,0.7)'; c.fillRect(x0 - 20, gy + 4, x1 - x0 + 40, 5);
  c.fillStyle = night ? 'rgba(255,200,120,0.4)' : 'rgba(240,250,255,0.6)'; for (let i = 0; i < 12; i++) c.fillRect(x0 + r() * (x1 - x0), gy + 5 + r() * 3, 6, 0.8);
}
function drawFort(c: Ctx, cx: number, gy: number, o: VistaOpts, r: () => number, night: boolean, snow: boolean) {
  // 山丘
  c.fillStyle = night ? 'rgba(40,44,46,0.9)' : snow ? 'rgba(220,224,228,1)' : 'rgba(120,118,92,0.85)';
  c.beginPath(); c.moveTo(cx - 170, gy + 4); c.quadraticCurveTo(cx - 60, gy - 40, cx, gy - 42); c.quadraticCurveTo(cx + 70, gy - 40, cx + 170, gy + 4); c.closePath(); c.fill();
  const x0 = cx - 80, x1 = cx + 80, top = gy - 66;
  cityWall(c, x0, x1, top, gy - 36, night, snow);
  tower(c, cx, top - 3, 36, 2, night, snow, o.color);
  tower(c, x0 + 4, top - 3, 20, 1, night, snow, null);
  tower(c, x1 - 4, top - 3, 20, 1, night, snow, o.color);
  // 山路
  c.strokeStyle = night ? 'rgba(90,90,80,0.5)' : 'rgba(180,160,120,0.8)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx + 120, gy + 4); c.quadraticCurveTo(cx + 40, gy - 10, cx + 10, gy - 36); c.stroke();
  void r;
}
function drawVillage(c: Ctx, cx: number, gy: number, o: VistaOpts, r: () => number, night: boolean, snow: boolean) {
  // 田垄
  c.strokeStyle = night ? 'rgba(80,90,70,0.4)' : o.south ? 'rgba(200,220,200,0.6)' : 'rgba(120,100,60,0.4)'; c.lineWidth = 1;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0, gy + 2 + i * 5); c.quadraticCurveTo(cx, gy - 2 + i * 6, 560, gy + 3 + i * 5); c.stroke(); }
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = cx - 120 + i * (240 / n) + r() * 16, s = 0.8 + r() * 0.4;
    house(c, x, gy - 2 + r() * 4, 30 * s, 14 * s, night, snow, !o.south, r() < 0.6);
    if (!o.looted && r() < 0.6 && !night) { for (let j = 0; j < 5; j++) { c.fillStyle = `rgba(200,196,186,${0.25 - j * 0.04})`; c.beginPath(); c.arc(x + 6 + j * 4, gy - 22 * s - j * 7, 3 + j * 1.5, 0, Math.PI * 2); c.fill(); } }
  }
  willow(c, cx - 150, gy + 4, night, o.season);
  willow(c, cx + 150, gy + 6, night, o.season);
  // 篱笆
  c.strokeStyle = night ? 'rgba(40,36,30,0.8)' : 'rgba(100,76,46,0.8)'; c.lineWidth = 1;
  c.beginPath(); for (let x = cx - 110; x < cx + 110; x += 6) { c.moveTo(x, gy + 10); c.lineTo(x, gy + 3); } c.moveTo(cx - 110, gy + 6); c.lineTo(cx + 110, gy + 6); c.stroke();
  void shade;
}
