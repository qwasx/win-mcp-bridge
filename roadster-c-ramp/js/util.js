// util.js — 数学工具 + 程序化纹理（canvas 生成，无外部资源）
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smoothstep = (a, b, x) => smooth((x - a) / (b - a));
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const TAU = Math.PI * 2;

// 指数趋近（帧率无关阻尼）
export const damp = (cur, target, k, dt) => lerp(target, cur, Math.exp(-k * dt));

// 手持摄影噪声：多频正弦叠加，各分量约 [-1,1]
export function handheld(t, seed = 0) {
  const f = (i, f0) => Math.sin(t * f0 + i * 12.9898 + seed * 78.233);
  return {
    x: f(1, 1.1) * .5 + f(2, 2.3) * .3 + f(3, 4.7) * .2,
    y: f(4, .9) * .5 + f(5, 1.7) * .35 + f(6, 3.9) * .15,
    z: f(7, 1.3) * .4 + f(8, 2.9) * .35 + f(9, 5.3) * .25,
    rx: f(10, 1.4) * .6 + f(11, 3.1) * .4,
    ry: f(12, 1.2) * .6 + f(13, 2.7) * .4,
    rz: f(14, .7) * .7 + f(15, 1.9) * .3,
  };
}

// ---------- canvas 纹理 ----------
function makeTex(w, h, draw, { srgb = true, wrap = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// 软圆点（辉光/粒子/光池）
export const softDiscTex = () => makeTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.25, 'rgba(255,255,255,.6)');
  gr.addColorStop(.6, 'rgba(255,255,255,.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// 光束锥体渐变（v=1 亮端 → v=0 透明端）
export const beamGradTex = () => makeTex(16, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,244,220,.85)');
  gr.addColorStop(.35, 'rgba(255,240,210,.28)');
  gr.addColorStop(1, 'rgba(255,238,205,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// 夜空（深蓝渐变 + 地平线光污染暖斑）
export const skyTex = () => makeTex(1024, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#03040a');
  gr.addColorStop(.42, '#081020');
  gr.addColorStop(.52, '#1c2942');
  gr.addColorStop(.56, '#10141f');
  gr.addColorStop(1, '#07080d');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const blob = (x, y, r, col) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(w * .66, h * .52, 300, 'rgba(96,74,48,.42)');   // 远处基地光污染
  blob(w * .18, h * .53, 220, 'rgba(70,62,52,.30)');
  blob(w * .45, h * .50, 420, 'rgba(52,64,92,.20)');
});

// 地面沥青
export const groundTex = () => makeTex(512, 512, (g, w, h) => {
  g.fillStyle = '#101318'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    const v = 14 + Math.random() * 26;
    g.fillStyle = `rgba(${v},${v + 3},${v + 7},${.05 + Math.random() * .12})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  g.strokeStyle = 'rgba(0,0,0,.25)';
  for (let i = 0; i < 24; i++) { // 裂缝
    g.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    g.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += rand(-40, 40); y += rand(-40, 40); g.lineTo(x, y); }
    g.stroke();
  }
}, { wrap: true });

// 着陆坪标识（LZ-02）
export const padTex = () => makeTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#181c23'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3600; i++) {
    const v = 20 + Math.random() * 24;
    g.fillStyle = `rgba(${v},${v + 3},${v + 6},${.06 + Math.random() * .1})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const cx = w / 2, cy = h / 2;
  g.strokeStyle = 'rgba(235,240,246,.85)'; g.lineWidth = 16;
  g.beginPath(); g.arc(cx, cy, 400, 0, TAU); g.stroke();
  g.lineWidth = 5; g.setLineDash([26, 18]);
  g.beginPath(); g.arc(cx, cy, 250, 0, TAU); g.stroke();
  g.setLineDash([]);
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(cx - 190, cy); g.lineTo(cx + 190, cy); g.moveTo(cx, cy - 190); g.lineTo(cx, cy + 190); g.stroke();
  g.fillStyle = 'rgba(235,240,246,.8)';
  g.font = 'bold 110px "SF Mono",Consolas,monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LZ-02', cx, cy + 295);
  // 四角警示斜纹
  g.save();
  const chev = (x, y, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i % 2 ? 'rgba(20,20,22,.9)' : 'rgba(240,190,60,.85)';
      g.beginPath(); g.moveTo(-90, -18 + i * 14); g.lineTo(0, -18 + i * 14); g.lineTo(24, -4 + i * 14); g.lineTo(-66, -4 + i * 14); g.closePath(); g.fill();
    }
    g.restore();
  };
  chev(cx, 80, 0); chev(cx, h - 80, Math.PI); chev(80, cy, -Math.PI / 2); chev(w - 80, cy, Math.PI / 2);
  g.restore();
});

// 进场道路
export const roadTex = () => makeTex(256, 512, (g, w, h) => {
  g.fillStyle = '#12151b'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const v = 15 + Math.random() * 22;
    g.fillStyle = `rgba(${v},${v + 3},${v + 6},${.06 + Math.random() * .1})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.fillStyle = 'rgba(230,232,238,.5)';
  for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 4, y, 8, 34); // 中心虚线
  g.fillStyle = 'rgba(230,232,238,.32)';
  g.fillRect(10, 0, 5, h); g.fillRect(w - 15, 0, 5, h);
}, { wrap: true });

// CSS 胶片颗粒 dataURL（一次生成）
export function grainDataURL() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  const img = g.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
