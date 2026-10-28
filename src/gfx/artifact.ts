// 法器造型（纯代码绘制，国风淡彩 + 墨线）。
// 约定：飞行类（剑、刃、针、刺、箭、舟、带）尖端朝 +x；其余正立。
// 每个造型画在 [-64,64]×[-64,64]（长条类 [-80,80]×[-24,24]）的局部坐标里，按需缓存成位图。
import { ArtLook, ArtShape, artLook } from '../data/artlooks';
import { shade } from '../core/canvas';

type G = CanvasRenderingContext2D;
const INK = 'rgba(30,24,18,0.92)';
const TAU = Math.PI * 2;

export const LONG_SHAPES = new Set<ArtShape>(['jian', 'bamboo', 'jinfu', 'jinfuChild', 'needle', 'hook', 'thorn', 'arrow', 'boat', 'shuttle']);
/** 局部坐标的半宽/半高 */
export function shapeBox(s: ArtShape): [number, number] { return LONG_SHAPES.has(s) ? [80, 26] : [64, 64]; }

// ------------------------------------------------------------ 画笔小工具
function metal(g: G, x0: number, y0: number, x1: number, y1: number, c: string, k = 1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, shade(c, 0.32 * k)); gr.addColorStop(0.35, shade(c, 0.08 * k)); gr.addColorStop(0.5, shade(c, 0.42 * k));
  gr.addColorStop(0.62, c); gr.addColorStop(1, shade(c, -0.38 * k));
  return gr;
}
function ink(g: G, w = 2) { g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function glint(g: G, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,250,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,240,0.4)'); gr.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,250,0.8)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x - r * 0.9, y); g.lineTo(x + r * 0.9, y); g.moveTo(x, y - r * 0.9); g.lineTo(x, y + r * 0.9); g.stroke();
}
function coin(g: G, x: number, y: number, r: number, c: string) {
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = metal(g, x - r, y - r, x + r, y + r, c); g.fill(); ink(g, 1.6);
  g.beginPath(); g.rect(x - r * 0.32, y - r * 0.32, r * 0.64, r * 0.64); g.fillStyle = shade(c, -0.5); g.fill(); ink(g, 1.1);
  g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.9; g.beginPath(); g.arc(x, y, r * 0.72, 0, TAU); g.stroke();
}
function tassel(g: G, x: number, y: number, dx: number, dy: number, c: string) {
  g.strokeStyle = c; g.lineWidth = 2.2; g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.5 + i * 3, y + dy * 0.6 + 4, x + dx + i * 4, y + dy + i * 2); g.stroke(); }
  g.fillStyle = shade(c, -0.25); g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
}
/** 篆文般的方折刻痕 */
function seal(g: G, x: number, y: number, w: number, h: number, c: string, seed: number) {
  g.strokeStyle = c; g.lineWidth = 1.4; g.lineCap = 'square';
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 6; i++) {
    const x0 = x + r() * w, y0 = y + r() * h;
    g.beginPath(); g.moveTo(x0, y0);
    g.lineTo(x0 + (r() - 0.5) * w * 0.5, y0); g.lineTo(x0 + (r() - 0.5) * w * 0.5, y0 + (r() - 0.3) * h * 0.5); g.stroke();
  }
}

// ------------------------------------------------------------ 各造型
const SH: Record<ArtShape, (g: G, L: ArtLook) => void> = {
  jian(g, L) {
    // 剑身
    g.beginPath(); g.moveTo(-18, -4.2); g.lineTo(62, -3.2); g.lineTo(76, 0); g.lineTo(62, 3.2); g.lineTo(-18, 4.2); g.closePath();
    g.fillStyle = metal(g, 0, -5, 0, 5, L.c1); g.fill(); ink(g, 1.6);
    g.strokeStyle = shade(L.c1, -0.35); g.lineWidth = 0.9; g.beginPath(); g.moveTo(-16, 0); g.lineTo(68, 0); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-14, -2.4); g.lineTo(60, -1.9); g.stroke();
    // 剑格
    g.beginPath(); g.moveTo(-18, -11); g.quadraticCurveTo(-14, 0, -18, 11); g.lineTo(-24, 9); g.quadraticCurveTo(-21, 0, -24, -9); g.closePath();
    g.fillStyle = metal(g, -24, -11, -18, 11, '#b08a40'); g.fill(); ink(g, 1.4);
    // 剑柄（缠绳）
    g.beginPath(); g.rect(-50, -3.6, 26, 7.2); g.fillStyle = L.c2; g.fill(); ink(g, 1.3);
    g.strokeStyle = shade(L.c2, -0.4); g.lineWidth = 1.1;
    for (let x = -48; x < -25; x += 4) { g.beginPath(); g.moveTo(x, -3.4); g.lineTo(x + 3, 3.4); g.stroke(); }
    g.beginPath(); g.arc(-53, 0, 4.6, 0, TAU); g.fillStyle = metal(g, -58, -5, -48, 5, '#b08a40'); g.fill(); ink(g, 1.3);
    tassel(g, -57, 1, -16, 12, L.c2);
  },
  bamboo(g, L) {
    // 青竹蜂云剑：竹形剑身，竹节，金色雷纹
    g.beginPath(); g.moveTo(-20, -5); g.lineTo(60, -4); g.quadraticCurveTo(74, -2, 78, 0); g.quadraticCurveTo(74, 2, 60, 4); g.lineTo(-20, 5); g.closePath();
    g.fillStyle = metal(g, 0, -6, 0, 6, L.c1, 0.8); g.fill(); ink(g, 1.6);
    g.strokeStyle = shade(L.c1, -0.45); g.lineWidth = 1.6;
    for (const x of [6, 30, 52]) { g.beginPath(); g.moveTo(x, -4.8); g.quadraticCurveTo(x + 1.5, 0, x, 4.8); g.stroke(); }
    g.strokeStyle = L.c2; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-14, 0); g.lineTo(-6, -2); g.lineTo(0, 1.5); g.lineTo(10, -1.5); g.lineTo(18, 1.2); g.lineTo(28, -1); g.lineTo(40, 1.4); g.lineTo(50, -1); g.lineTo(64, 0.6); g.stroke();
    g.beginPath(); g.ellipse(-22, 0, 4, 9, 0, 0, TAU); g.fillStyle = metal(g, -26, -9, -18, 9, L.c2); g.fill(); ink(g, 1.3);
    g.beginPath(); g.rect(-46, -3.4, 22, 6.8); g.fillStyle = '#4a6a40'; g.fill(); ink(g, 1.2);
    g.strokeStyle = '#2a3a22'; g.lineWidth = 1.4; for (const x of [-40, -32]) { g.beginPath(); g.moveTo(x, -3.4); g.lineTo(x, 3.4); g.stroke(); }
    g.beginPath(); g.arc(-49, 0, 4, 0, TAU); g.fillStyle = metal(g, -53, -4, -45, 4, L.c2); g.fill(); ink(g, 1.2);
  },
  jinfu(g, L) {
    // 金蚨母刃：新月弯刃，刃根嵌铜钱，刃脊錾刻蚨纹
    g.beginPath();
    g.moveTo(-30, 6); g.bezierCurveTo(-6, -22, 40, -24, 76, -2); g.bezierCurveTo(46, -10, 8, -6, -18, 14); g.closePath();
    g.fillStyle = metal(g, 0, -22, 0, 12, L.c1); g.fill(); ink(g, 1.8);
    g.strokeStyle = 'rgba(255,250,220,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-20, 2); g.bezierCurveTo(4, -16, 40, -19, 70, -3); g.stroke();
    g.strokeStyle = shade(L.c1, -0.45); g.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) { const x = -4 + i * 15; g.beginPath(); g.arc(x, -9 + i * 0.5, 2.4, 0, TAU); g.stroke(); }
    coin(g, -28, 8, 10, L.c1);
    tassel(g, -36, 14, -14, 10, '#c03a2a');
  },
  jinfuChild(g, L) {
    g.beginPath(); g.moveTo(-34, 4); g.bezierCurveTo(-8, -16, 36, -16, 70, 0); g.bezierCurveTo(36, -5, 0, -2, -26, 10); g.closePath();
    g.fillStyle = metal(g, 0, -16, 0, 10, L.c1); g.fill(); ink(g, 1.6);
    g.strokeStyle = 'rgba(255,250,220,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-24, 2); g.bezierCurveTo(0, -11, 34, -12, 62, -1); g.stroke();
    coin(g, -32, 6, 7, L.c1);
  },
  needle(g, L) {
    g.beginPath(); g.moveTo(-64, -1.4); g.lineTo(70, -0.4); g.lineTo(78, 0); g.lineTo(70, 0.4); g.lineTo(-64, 1.4); g.closePath();
    g.fillStyle = metal(g, 0, -2, 0, 2, L.c1); g.fill(); ink(g, 1);
    g.beginPath(); g.ellipse(-60, 0, 3.6, 1.6, 0, 0, TAU); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.strokeStyle = L.c2; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-60, 0); g.bezierCurveTo(-70, 10, -54, 18, -74, 22); g.stroke();
  },
  hook(g, L) {
    // 乌龙夺：乌黑龙爪钩，三指弯钩
    g.beginPath(); g.moveTo(-60, -3); g.lineTo(20, -4); g.lineTo(20, 4); g.lineTo(-60, 3); g.closePath();
    g.fillStyle = metal(g, 0, -4, 0, 4, L.c1, 0.7); g.fill(); ink(g, 1.4);
    for (const [oy, k] of [[-10, -1], [0, 0], [10, 1]] as [number, number][]) {
      g.beginPath(); g.moveTo(16, oy * 0.3 - 4); g.bezierCurveTo(44, oy - 4, 66, oy * 1.6 - 2, 76, oy * 1.9 + k * 4);
      g.bezierCurveTo(62, oy * 1.2 + 2, 42, oy + 4, 18, oy * 0.3 + 4); g.closePath();
      g.fillStyle = metal(g, 20, oy - 6, 20, oy + 6, L.c1, 0.9); g.fill(); ink(g, 1.4);
    }
    g.beginPath(); g.ellipse(14, 0, 8, 11, 0, 0, TAU); g.fillStyle = metal(g, 6, -11, 22, 11, L.c1); g.fill(); ink(g, 1.4);
    g.fillStyle = 'rgba(140,170,220,0.8)'; g.beginPath(); g.arc(14, -2, 2.4, 0, TAU); g.fill();
  },
  thorn(g, L) {
    g.beginPath(); g.moveTo(-56, -5); g.lineTo(60, -2); g.lineTo(78, 0); g.lineTo(60, 2); g.lineTo(-56, 5); g.closePath();
    g.fillStyle = metal(g, 0, -5, 0, 5, L.c1); g.fill(); ink(g, 1.5);
    g.strokeStyle = shade(L.c1, -0.55); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-50, 0); g.lineTo(66, 0); g.stroke();
    for (let x = -40; x < 50; x += 18) { g.beginPath(); g.moveTo(x, -4.4); g.lineTo(x + 7, -9); g.lineTo(x + 6, -3.6); g.closePath(); g.fillStyle = shade(L.c1, -0.2); g.fill(); ink(g, 1); }
    g.beginPath(); g.arc(-60, 0, 6, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1.3);
  },
  arrow(g, L) {
    // 灭魔箭：金雷竹箭杆，雷纹箭镞
    g.beginPath(); g.rect(-58, -2.6, 108, 5.2); g.fillStyle = metal(g, 0, -3, 0, 3, L.c2, 0.6); g.fill(); ink(g, 1.2);
    g.strokeStyle = shade(L.c2, -0.4); g.lineWidth = 1.3; for (const x of [-30, 0, 28]) { g.beginPath(); g.moveTo(x, -2.6); g.lineTo(x, 2.6); g.stroke(); }
    g.beginPath(); g.moveTo(48, -8); g.lineTo(78, 0); g.lineTo(48, 8); g.lineTo(54, 0); g.closePath(); g.fillStyle = metal(g, 48, -8, 48, 8, L.c1); g.fill(); ink(g, 1.4);
    g.strokeStyle = '#fff6c0'; g.lineWidth = 1; g.beginPath(); g.moveTo(56, -2); g.lineTo(62, 1); g.lineTo(66, -1); g.lineTo(72, 0.5); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-50, 0); g.lineTo(-66, s * 10); g.lineTo(-74, s * 9); g.lineTo(-58, 0); g.closePath(); g.fillStyle = '#e8e0c8'; g.fill(); ink(g, 1.1); }
  },
  ring(g, L) {
    const R = 40;
    g.beginPath(); g.arc(0, 0, R + 6, 0, TAU); g.arc(0, 0, R - 6, 0, TAU, true);
    g.fillStyle = metal(g, -R, -R, R, R, L.c1); g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c1, 0.4); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, R + 1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    // 朱雀翎纹 / 五行宝珠
    const five = ['#e8d060', '#5fb060', '#4a80d0', '#e05030', '#b08a50'];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i / 5 * TAU, x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (L.c2 === '#f0c050') {
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(7, -14, 0, -22); g.quadraticCurveTo(-7, -14, 0, -4); g.fillStyle = L.c2; g.fill(); ink(g, 1.1); g.restore();
      } else { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fillStyle = metal(g, x - 6, y - 6, x + 6, y + 6, five[i]); g.fill(); ink(g, 1.2); }
    }
  },
  bracelet(g, L) {
    const R = 38;
    g.save(); g.globalAlpha = 0.92;
    g.beginPath(); g.arc(0, 0, R + 5, 0, TAU); g.arc(0, 0, R - 5, 0, TAU, true);
    g.fillStyle = metal(g, -R, -R, R, R, L.c1, 0.8); g.fill(); g.restore(); ink(g, 1.6);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3, x = Math.cos(a) * R, y = Math.sin(a) * R; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -4); g.lineTo(7, 0); g.lineTo(0, 4); g.closePath(); g.fillStyle = L.c2; g.fill(); ink(g, 0.9); g.restore(); }
  },
  mirror(g, L) {
    // 铜镜：镜柄朝下，镜面带一抹高光
    g.beginPath(); g.rect(-5, 30, 10, 28); g.fillStyle = metal(g, -5, 0, 5, 0, L.c2); g.fill(); ink(g, 1.4);
    tassel(g, 0, 58, 6, 6, '#b03030');
    g.beginPath(); g.arc(0, -4, 40, 0, TAU); g.fillStyle = metal(g, -40, -44, 40, 36, L.c2); g.fill(); ink(g, 2);
    g.beginPath(); g.arc(0, -4, 33, 0, TAU);
    const gr = g.createRadialGradient(-10, -16, 2, 0, -4, 34); gr.addColorStop(0, shade(L.c1, 0.55)); gr.addColorStop(0.5, L.c1); gr.addColorStop(1, shade(L.c1, -0.4));
    g.fillStyle = gr; g.fill(); ink(g, 1.2);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(0, -4, 26, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    g.strokeStyle = shade(L.c2, -0.3); g.lineWidth = 1; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 35, -4 + Math.sin(a) * 35); g.lineTo(Math.cos(a) * 38.5, -4 + Math.sin(a) * 38.5); g.stroke(); }
  },
  bagua(g, L) {
    // 八门金光镜：八角镜框，八卦爻纹
    const R = 44;
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.closePath();
    g.fillStyle = metal(g, -R, -R, R, R, L.c1); g.fill(); ink(g, 2);
    g.beginPath(); g.arc(0, 0, 24, 0, TAU);
    const gr = g.createRadialGradient(-8, -8, 2, 0, 0, 26); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.6, '#f0d888'); gr.addColorStop(1, '#a88830');
    g.fillStyle = gr; g.fill(); ink(g, 1.3);
    g.strokeStyle = shade(L.c1, -0.55); g.lineWidth = 2.2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.save(); g.rotate(a); for (let k = 0; k < 3; k++) { const y = -31 - k * 4; const broken = ((i >> k) & 1) === 1; if (broken) { g.beginPath(); g.moveTo(-7, y); g.lineTo(-2, y); g.moveTo(2, y); g.lineTo(7, y); g.stroke(); } else { g.beginPath(); g.moveTo(-7, y); g.lineTo(7, y); g.stroke(); } } g.restore(); }
  },
  brick(g, L) {
    // 金光砖：俯视斜角的方砖，正面錾篆文
    const w = 42, h = 20, d = 22;
    g.beginPath(); g.moveTo(-w, -h + 0); g.lineTo(-w + d, -h - d * 0.7); g.lineTo(w + d, -h - d * 0.7); g.lineTo(w, -h); g.closePath();
    g.fillStyle = shade(L.c1, 0.3); g.fill(); ink(g, 1.6);
    g.beginPath(); g.moveTo(w, -h); g.lineTo(w + d, -h - d * 0.7); g.lineTo(w + d, h - d * 0.7); g.lineTo(w, h); g.closePath();
    g.fillStyle = shade(L.c1, -0.35); g.fill(); ink(g, 1.6);
    g.beginPath(); g.rect(-w, -h, w * 2, h * 2); g.fillStyle = metal(g, -w, -h, w, h, L.c1, 0.7); g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.2; g.strokeRect(-w + 5, -h + 4, w * 2 - 10, h * 2 - 8);
    seal(g, -w + 9, -h + 7, w * 2 - 18, h * 2 - 14, shade(L.c2, -0.1), 7);
    glint(g, -w + 8, -h + 4, 7);
  },
  mountain(g, L) {
    g.beginPath(); g.moveTo(-52, 34); g.lineTo(-30, -6); g.lineTo(-18, 2); g.lineTo(0, -42); g.lineTo(16, -8); g.lineTo(28, -18); g.lineTo(52, 34); g.closePath();
    const gr = g.createLinearGradient(0, -42, 0, 34); gr.addColorStop(0, shade(L.c1, 0.4)); gr.addColorStop(0.6, L.c1); gr.addColorStop(1, shade(L.c1, -0.45));
    g.fillStyle = gr; g.fill(); ink(g, 2);
    g.strokeStyle = 'rgba(30,24,18,0.5)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -42); g.lineTo(-6, 0); g.lineTo(-14, 30); g.moveTo(28, -18); g.lineTo(22, 10); g.moveTo(-30, -6); g.lineTo(-34, 20); g.stroke();
    g.strokeStyle = L.c2; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 6, 58, 14, 0, 0, TAU); g.stroke();
  },
  bell(g, L) {
    // 银钟：钮、钟身、枚（乳钉），口沿内弧
    g.beginPath(); g.ellipse(0, -46, 9, 7, 0, 0, TAU); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = L.c1; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(-26, -38); g.lineTo(26, -38); g.quadraticCurveTo(34, 10, 40, 44); g.quadraticCurveTo(0, 32, -40, 44); g.quadraticCurveTo(-34, 10, -26, -38); g.closePath();
    g.fillStyle = metal(g, -40, 0, 40, 0, L.c1); g.fill(); ink(g, 2);
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-31, -6); g.quadraticCurveTo(0, -10, 31, -6); g.moveTo(-36, 24); g.quadraticCurveTo(0, 18, 36, 24); g.stroke();
    for (let r = 0; r < 2; r++) for (let i = -2; i <= 2; i++) { const x = i * 10 * (1 + r * 0.12), y = -26 + r * 11; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fillStyle = shade(L.c1, 0.4); g.fill(); ink(g, 0.8); }
    g.beginPath(); g.ellipse(0, 6, 9, 9, 0, 0, TAU); g.strokeStyle = shade(L.c1, -0.35); g.lineWidth = 1.2; g.stroke();
  },
  ribbon(g, L) {
    // 四象蟠龙带：S 形绶带，龙鳞纹与金边
    const path = () => { g.beginPath(); g.moveTo(-50, -40); g.bezierCurveTo(30, -50, 40, -6, 0, 0); g.bezierCurveTo(-40, 6, -30, 50, 50, 40); };
    path(); g.strokeStyle = INK; g.lineWidth = 17; g.lineCap = 'round'; g.stroke();
    path(); g.strokeStyle = L.c1; g.lineWidth = 13; g.stroke();
    path(); g.strokeStyle = L.c2; g.lineWidth = 2; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);
    path(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.stroke();
  },
  pouch(g, L) {
    // 紫铖兜：口沿镶金的锦兜，内吐火光
    g.beginPath(); g.moveTo(-30, -20); g.quadraticCurveTo(-44, 30, 0, 40); g.quadraticCurveTo(44, 30, 30, -20); g.closePath();
    g.fillStyle = metal(g, -40, 0, 40, 0, L.c1, 0.7); g.fill(); ink(g, 1.8);
    g.beginPath(); g.ellipse(0, -20, 31, 9, 0, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1.6);
    g.beginPath(); g.ellipse(0, -20, 24, 5.5, 0, 0, TAU); const gr = g.createRadialGradient(0, -20, 0, 0, -20, 24); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#e05020'); g.fillStyle = gr; g.fill();
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 9, -10); g.quadraticCurveTo(i * 11, 14, i * 6, 34); g.stroke(); }
  },
  fan(g, L) {
    // 三焰扇：三色翎羽扇面，玉柄
    const cols = [L.c1, L.c2, '#4a80d0'];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i / 8 - 0.5) * 1.9;
      g.save(); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(0, 18); g.quadraticCurveTo(-11, -18, 0, -54); g.quadraticCurveTo(11, -18, 0, 18);
      g.fillStyle = metal(g, -10, 0, 10, 0, cols[Math.floor(i / 3)], 0.6); g.fill(); ink(g, 1.1);
      g.strokeStyle = 'rgba(30,24,18,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, -50); g.stroke();
      g.restore();
    }
    g.beginPath(); g.rect(-4, 16, 8, 40); g.fillStyle = metal(g, -4, 0, 4, 0, '#d8e8d0'); g.fill(); ink(g, 1.3);
    g.beginPath(); g.arc(0, 16, 8, 0, TAU); g.fillStyle = metal(g, -8, 8, 8, 24, '#c8a040'); g.fill(); ink(g, 1.3);
  },
  flame(g, L) {
    // 天都尸火 / 乾蓝冰焰：骨碗或晶盏托着一团灵焰
    g.beginPath(); g.moveTo(-28, 14); g.quadraticCurveTo(-26, 40, 0, 42); g.quadraticCurveTo(26, 40, 28, 14); g.closePath();
    g.fillStyle = metal(g, -28, 0, 28, 0, L.c1, 0.6); g.fill(); ink(g, 1.6);
    g.beginPath(); g.ellipse(0, 14, 28, 6, 0, 0, TAU); g.fillStyle = shade(L.c1, -0.3); g.fill(); ink(g, 1.4);
    const fl = (s: number, c0: string, c1: string) => {
      g.beginPath(); g.moveTo(-20 * s, 14); g.bezierCurveTo(-26 * s, -10 * s, -6 * s, -18 * s, -4 * s, -40 * s);
      g.bezierCurveTo(4 * s, -26 * s, 14 * s, -30 * s, 12 * s, -50 * s); g.bezierCurveTo(28 * s, -24 * s, 26 * s, -2 * s, 20 * s, 14); g.closePath();
      const gr = g.createLinearGradient(0, 14, 0, -50 * s); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fill();
    };
    fl(1, L.c2, shade(L.c2, -0.3)); g.strokeStyle = 'rgba(30,24,18,0.55)'; g.lineWidth = 1.2; g.stroke();
    fl(0.6, '#ffffff', L.c2);
  },
  banner(g, L) {
    // 旗/幡：竹竿 + 飘向右侧的旗面 + 纹章
    g.beginPath(); g.rect(-34, -60, 5, 122); g.fillStyle = metal(g, -34, 0, -29, 0, '#8a6a40'); g.fill(); ink(g, 1.3);
    g.beginPath(); g.arc(-31.5, -62, 5, 0, TAU); g.fillStyle = metal(g, -36, -66, -27, -58, '#d0b060'); g.fill(); ink(g, 1.2);
    g.beginPath(); g.moveTo(-29, -54); g.bezierCurveTo(0, -60, 20, -46, 46, -52); g.lineTo(42, 22); g.lineTo(30, 14); g.lineTo(18, 26); g.lineTo(6, 16); g.bezierCurveTo(-8, 20, -18, 14, -29, 18); g.closePath();
    const gr = g.createLinearGradient(-29, 0, 46, 0); gr.addColorStop(0, shade(L.c1, -0.15)); gr.addColorStop(0.5, L.c1); gr.addColorStop(1, shade(L.c1, -0.3));
    g.fillStyle = gr; g.fill(); ink(g, 1.7);
    g.strokeStyle = L.c2; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, -48); g.bezierCurveTo(0, -54, 20, -42, 42, -46); g.stroke();
    // 蛟纹 / 鬼面
    g.strokeStyle = L.c2; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, 4); g.bezierCurveTo(-24, -14, 2, -34, 14, -20); g.bezierCurveTo(24, -8, 6, 4, 0, -8); g.bezierCurveTo(-4, -16, 10, -20, 12, -12); g.stroke();
    g.fillStyle = L.c2; g.beginPath(); g.arc(14, -21, 2.4, 0, TAU); g.fill();
  },
  bonebanner(g, L) {
    g.beginPath(); g.rect(-4, -56, 8, 118); g.fillStyle = metal(g, -4, 0, 4, 0, L.c1); g.fill(); ink(g, 1.3);
    // 骷髅顶
    g.beginPath(); g.arc(0, -60, 9, 0, TAU); g.fillStyle = L.c1; g.fill(); ink(g, 1.4);
    g.fillStyle = INK; g.beginPath(); g.arc(-3.5, -61, 2.2, 0, TAU); g.arc(3.5, -61, 2.2, 0, TAU); g.fill();
    // 三条白骨幡带
    for (const [x, len] of [[-14, 70], [0, 84], [14, 64]] as [number, number][]) {
      g.beginPath(); g.moveTo(x - 6, -46); g.lineTo(x + 6, -46); g.bezierCurveTo(x + 8, -10, x + 2, len * 0.4, x + 5, len - 40); g.lineTo(x - 1, len - 50); g.bezierCurveTo(x - 6, 0, x - 8, -20, x - 6, -46); g.closePath();
      g.fillStyle = metal(g, x - 6, 0, x + 6, 0, L.c1, 0.5); g.fill(); ink(g, 1.2);
      g.strokeStyle = shade(L.c2, 0.1); g.lineWidth = 1; for (let y = -36; y < len - 50; y += 12) { g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y + 3); g.stroke(); }
    }
  },
  demon(g, L) {
    // 五子同心魔：黑幡上五颗魔首
    SH.banner(g, L);
    for (let i = 0; i < 5; i++) { const x = -14 + (i % 3) * 14 + (i > 2 ? 7 : 0), y = -30 + Math.floor(i / 3) * 18; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fillStyle = '#1a0e12'; g.fill(); g.fillStyle = L.c2; g.beginPath(); g.arc(x - 1.8, y - 1, 1.2, 0, TAU); g.arc(x + 1.8, y - 1, 1.2, 0, TAU); g.fill(); }
  },
  ding(g, L) {
    // 虚天鼎：三足双耳，饕餮纹带，鼎口青光
    g.fillStyle = metal(g, -40, 0, 40, 0, L.c1, 0.7);
    for (const x of [-26, 0, 26]) { g.beginPath(); g.moveTo(x - 6, 20); g.lineTo(x + 6, 20); g.lineTo(x + 4, 50); g.quadraticCurveTo(x, 54, x - 4, 50); g.closePath(); g.fill(); ink(g, 1.4); }
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 22, -28); g.lineTo(s * 22, -48); g.lineTo(s * 36, -48); g.lineTo(s * 36, -28); g.lineTo(s * 31, -28); g.lineTo(s * 31, -42); g.lineTo(s * 27, -42); g.lineTo(s * 27, -28); g.closePath(); g.fill(); ink(g, 1.4); }
    g.beginPath(); g.moveTo(-46, -28); g.lineTo(46, -28); g.quadraticCurveTo(48, 20, 30, 28); g.lineTo(-30, 28); g.quadraticCurveTo(-48, 20, -46, -28); g.closePath(); g.fill(); ink(g, 2);
    g.beginPath(); g.ellipse(0, -28, 46, 9, 0, 0, TAU); g.fillStyle = shade(L.c1, -0.4); g.fill(); ink(g, 1.6);
    g.beginPath(); g.ellipse(0, -28, 38, 6, 0, 0, TAU); const gr = g.createRadialGradient(0, -28, 0, 0, -28, 38); gr.addColorStop(0, '#eafff0'); gr.addColorStop(0.5, `rgb(${L.glow})`); gr.addColorStop(1, shade(L.c1, -0.5)); g.fillStyle = gr; g.fill();
    g.strokeStyle = L.c2; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-42, -12); g.lineTo(42, -12); g.moveTo(-40, 6); g.lineTo(40, 6); g.stroke();
    for (let i = -3; i <= 3; i++) { const x = i * 11; g.beginPath(); g.moveTo(x - 4, -8); g.lineTo(x, -4); g.lineTo(x + 4, -8); g.moveTo(x - 3, 2); g.lineTo(x + 3, 2); g.stroke(); }
    glint(g, -30, -18, 6);
  },
  shield(g, L) {
    const R = 46;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = metal(g, -R, -R, R, R, L.c1, 0.8); g.fill(); ink(g, 2.2);
    g.beginPath(); g.arc(0, 0, R - 7, 0, TAU); g.strokeStyle = L.c2; g.lineWidth = 2.4; g.stroke();
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10)); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fillStyle = metal(g, -13, -13, 13, 13, L.c2); g.fill(); ink(g, 1.6);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.arc(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4), 2.2, 0, TAU); g.fillStyle = L.c2; g.fill(); }
    glint(g, -16, -20, 8);
  },
  turtle(g, L) {
    // 龟壳盾：龟甲六角纹
    g.beginPath(); g.ellipse(0, 0, 46, 40, 0, 0, TAU); g.fillStyle = metal(g, -46, -40, 46, 40, L.c1, 0.6); g.fill(); ink(g, 2.2);
    const hex = (cx: number, cy: number, r: number) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9); } g.closePath(); g.fillStyle = shade(L.c1, 0.12); g.fill(); g.strokeStyle = L.c2; g.lineWidth = 1.8; g.stroke(); };
    hex(0, 0, 13); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; hex(Math.cos(a) * 24, Math.sin(a) * 21, 11); }
  },
  armor(g, L) {
    g.beginPath(); g.moveTo(-34, -40); g.lineTo(-14, -46); g.quadraticCurveTo(0, -36, 14, -46); g.lineTo(34, -40); g.lineTo(40, -6); g.lineTo(30, 42); g.lineTo(-30, 42); g.lineTo(-40, -6); g.closePath();
    g.fillStyle = metal(g, -40, 0, 40, 0, L.c1, 0.6); g.fill(); ink(g, 2);
    g.save(); g.clip();
    g.strokeStyle = shade(L.c1, -0.45); g.lineWidth = 1;
    for (let y = -36; y < 44; y += 7) for (let x = -44 + ((y / 7) & 1) * 4; x < 44; x += 8) { g.beginPath(); g.arc(x, y, 4.2, 0.1, Math.PI - 0.1); g.stroke(); }
    g.restore();
    g.strokeStyle = L.c2; g.lineWidth = 3; g.beginPath(); g.moveTo(-38, 10); g.lineTo(38, 10); g.stroke();
  },
  cloak(g, L) {
    g.beginPath(); g.moveTo(-18, -46); g.quadraticCurveTo(0, -40, 18, -46); g.bezierCurveTo(30, -10, 46, 20, 50, 48); g.lineTo(30, 42); g.lineTo(12, 52); g.lineTo(-6, 44); g.lineTo(-26, 52); g.lineTo(-46, 44); g.bezierCurveTo(-40, 14, -30, -12, -18, -46); g.closePath();
    const gr = g.createLinearGradient(-40, 0, 50, 0); gr.addColorStop(0, shade(L.c1, -0.3)); gr.addColorStop(0.45, shade(L.c1, 0.2)); gr.addColorStop(1, shade(L.c1, -0.45));
    g.fillStyle = gr; g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c1, -0.5); g.lineWidth = 1.2; for (const x of [-20, -4, 12, 28]) { g.beginPath(); g.moveTo(x * 0.4, -40); g.quadraticCurveTo(x, 0, x * 1.3, 44); g.stroke(); }
    g.beginPath(); g.ellipse(0, -44, 20, 5, 0, 0, TAU); g.fillStyle = '#d8b050'; g.fill(); ink(g, 1.2);
  },
  wings(g, L) {
    // 风雷翅：雷鹏羽翼——翼骨、覆羽、初级飞羽层叠，翎缘银白雷纹
    const fe = (x0: number, y0: number, ang: number, len: number, w: number, c: string, rib = true) => {
      g.save(); g.translate(x0, y0); g.rotate(ang);
      g.beginPath(); g.moveTo(0, -w * 0.35); g.quadraticCurveTo(len * 0.55, -w, len, -w * 0.08); g.quadraticCurveTo(len * 0.6, w * 0.7, 0, w * 0.35); g.closePath();
      const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, shade(c, -0.25)); gr.addColorStop(0.6, c); gr.addColorStop(1, shade(c, 0.35));
      g.fillStyle = gr; g.fill(); ink(g, 1);
      if (rib) { g.beginPath(); g.moveTo(1, 0); g.quadraticCurveTo(len * 0.5, -w * 0.3, len * 0.95, -w * 0.1); g.strokeStyle = shade(c, 0.5); g.lineWidth = 0.9; g.stroke(); }
      g.restore();
    };
    for (const sd of [-1, 1]) {
      g.save(); g.scale(sd, 1);
      const wx = 30, wy = -30;
      for (let i = 6; i >= 0; i--) fe(wx, wy, 1.15 - i * 0.27, 26 + Math.min(i, 3) * 2.2, 8.5, shade(L.c1, 0.22 - i * 0.04));   // 初级飞羽
      for (let i = 0; i <= 6; i++) { const u = i / 6; fe(6 + (wx - 6) * u, -2 + (wy + 2) * u, Math.PI / 2 - 0.15 - u * 0.75, 18 + u * 10, 7, shade(L.c1, 0.05 - u * 0.06)); }   // 次级飞羽
      for (let i = 0; i <= 4; i++) { const u = i / 4; fe(8 + (wx - 8) * u, -6 + (wy + 6) * u, Math.PI / 2 - 0.5 - u * 0.6, 10 + u * 4, 5.5, shade(L.c1, 0.3), false); }   // 覆羽
      g.beginPath(); g.moveTo(4, -4); g.quadraticCurveTo(14, -30, wx + 2, wy - 1); g.strokeStyle = INK; g.lineWidth = 5.2; g.lineCap = 'round'; g.stroke(); g.strokeStyle = metal(g, 0, -30, 0, 0, '#c8c8dc'); g.lineWidth = 3.2; g.stroke();
      // 雷纹
      g.strokeStyle = L.c2; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(wx + 6, wy - 6); g.lineTo(wx + 14, wy - 4); g.lineTo(wx + 12, wy + 1); g.lineTo(wx + 22, wy + 2); g.lineTo(wx + 19, wy + 8); g.lineTo(wx + 28, wy + 10); g.stroke();
      g.restore();
    }
    g.beginPath(); g.ellipse(0, -2, 6, 10, 0, 0, TAU); g.fillStyle = metal(g, -6, 0, 6, 0, '#c8c0d8'); g.fill(); ink(g, 1.3);
    g.beginPath(); g.arc(0, -4, 2.4, 0, TAU); g.fillStyle = L.c2; g.fill();
  },
  boat(g, L) {
    // 神风舟：柳叶形飞舟，船首上翘，舷侧风纹
    g.beginPath(); g.moveTo(-70, -6); g.quadraticCurveTo(-60, 14, -20, 16); g.lineTo(40, 16); g.quadraticCurveTo(70, 12, 80, -14); g.quadraticCurveTo(60, 0, 40, 0); g.lineTo(-40, 0); g.quadraticCurveTo(-60, -2, -70, -6); g.closePath();
    g.fillStyle = metal(g, 0, -14, 0, 16, L.c1, 0.6); g.fill(); ink(g, 1.8);
    g.beginPath(); g.moveTo(-58, -2); g.lineTo(48, -2); g.quadraticCurveTo(66, -4, 76, -12); g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = L.c2; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const x of [-34, -6, 22]) { g.beginPath(); g.arc(x, 8, 5, Math.PI * 0.2, Math.PI * 1.7); g.stroke(); g.beginPath(); g.moveTo(x + 4, 4); g.quadraticCurveTo(x + 12, 2, x + 16, 8); g.stroke(); }
  },
  talisman(g, L) {
    // 符宝：黄符纸，朱砂符文，中封一口小剑
    g.save(); g.rotate(-0.12);
    g.beginPath(); g.rect(-20, -50, 40, 100); g.fillStyle = L.c1; g.fill(); ink(g, 1.6);
    g.strokeStyle = L.c2; g.lineWidth = 2; g.strokeRect(-15, -45, 30, 90);
    g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, -26); g.moveTo(-8, -34); g.lineTo(8, -34); g.moveTo(-6, -28); g.quadraticCurveTo(0, -20, 6, -28); g.stroke();
    g.beginPath(); g.moveTo(-8, 28); g.lineTo(8, 28); g.moveTo(-6, 34); g.lineTo(6, 34); g.moveTo(0, 22); g.lineTo(0, 40); g.stroke();
    // 小剑
    g.beginPath(); g.moveTo(0, -20); g.lineTo(3, -14); g.lineTo(3, 12); g.lineTo(-3, 12); g.lineTo(-3, -14); g.closePath();
    g.fillStyle = `rgb(${L.glow})`; g.fill(); ink(g, 1);
    g.beginPath(); g.rect(-7, 12, 14, 3); g.fillStyle = '#b08a40'; g.fill(); ink(g, 0.8);
    g.restore();
  },
  bottle(g, L) {
    // 掌天瓶：墨绿小瓶，瓶身叶纹
    g.beginPath(); g.moveTo(-8, -40); g.lineTo(8, -40); g.lineTo(8, -28); g.bezierCurveTo(34, -18, 36, 30, 20, 40); g.lineTo(-20, 40); g.bezierCurveTo(-36, 30, -34, -18, -8, -28); g.closePath();
    g.fillStyle = metal(g, -32, 0, 32, 0, L.c1, 0.7); g.fill(); ink(g, 1.8);
    g.beginPath(); g.ellipse(0, -42, 10, 4, 0, 0, TAU); g.fillStyle = shade(L.c1, -0.3); g.fill(); ink(g, 1.3);
    g.strokeStyle = L.c2; g.lineWidth = 1.1;
    for (const [x, y, a] of [[-12, 4, -0.6], [10, 12, 0.5], [-4, 24, 0.1], [8, -8, -0.3]] as [number, number, number][]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 8, 3.4, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke(); g.restore(); }
    glint(g, -14, -10, 6);
  },
  bead(g, L) {
    // 天雷子：乌黑圆珠，银色雷纹
    g.beginPath(); g.arc(0, 0, 34, 0, TAU);
    const gr = g.createRadialGradient(-12, -12, 2, 0, 0, 36); gr.addColorStop(0, shade(L.c1, 0.6)); gr.addColorStop(0.5, L.c1); gr.addColorStop(1, shade(L.c1, -0.5));
    g.fillStyle = gr; g.fill(); ink(g, 2);
    g.strokeStyle = L.c2; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-22, -14); g.lineTo(-8, -6); g.lineTo(-14, 4); g.lineTo(4, 10); g.lineTo(-2, 22); g.stroke();
    g.beginPath(); g.moveTo(10, -26); g.lineTo(16, -12); g.lineTo(26, -8); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 34, 10, 0, 0, TAU); g.strokeStyle = 'rgba(200,210,255,0.4)'; g.lineWidth = 1; g.stroke();
    glint(g, -12, -14, 7);
  },
  boots(g, L) {
    // 踏云靴：高筒布靴，翘头，靴帮云纹，靴底一缕白云
    g.beginPath(); g.moveTo(-20, -46); g.lineTo(10, -46); g.quadraticCurveTo(12, -10, 14, 10);
    g.bezierCurveTo(26, 12, 40, 16, 46, 24); g.quadraticCurveTo(52, 22, 52, 16); g.quadraticCurveTo(56, 30, 44, 36);
    g.lineTo(-18, 36); g.quadraticCurveTo(-26, 30, -24, 14); g.quadraticCurveTo(-22, -16, -20, -46); g.closePath();
    g.fillStyle = metal(g, -24, 0, 50, 0, L.c1, 0.5); g.fill(); ink(g, 1.8);
    g.beginPath(); g.moveTo(-18, 36); g.lineTo(44, 36); g.quadraticCurveTo(48, 40, 40, 42); g.lineTo(-18, 42); g.closePath(); g.fillStyle = '#e8e2d4'; g.fill(); ink(g, 1.3);
    g.beginPath(); g.rect(-21, -46, 32, 7); g.fillStyle = shade(L.c1, -0.35); g.fill(); ink(g, 1.2);
    g.strokeStyle = L.c2; g.lineWidth = 1.5;
    const cloud = (x: number, y: number, s: number) => { g.beginPath(); g.arc(x, y, 4 * s, Math.PI * 0.9, Math.PI * 2.1); g.arc(x + 7 * s, y + 1, 3 * s, Math.PI, Math.PI * 2.3); g.moveTo(x - 4 * s, y + 1); g.quadraticCurveTo(x + 4 * s, y + 6 * s, x + 11 * s, y + 2); g.stroke(); };
    cloud(-10, -24, 1); cloud(-6, 0, 1.1); cloud(20, 24, 1);
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (const [x, r] of [[-26, 6], [-16, 8], [-4, 6]] as [number, number][]) { g.beginPath(); g.arc(x, 46, r, 0, TAU); g.fill(); }
  },
  basket(g, L) {
    // 古宝花篮
    g.beginPath(); g.moveTo(-34, -6); g.lineTo(34, -6); g.lineTo(24, 40); g.lineTo(-24, 40); g.closePath();
    g.fillStyle = metal(g, -34, 0, 34, 0, L.c2, 0.5); g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c2, -0.4); g.lineWidth = 1; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 10, -6); g.lineTo(i * 7, 40); g.stroke(); } for (let y = 4; y < 40; y += 8) { g.beginPath(); g.moveTo(-32 + y * 0.2, y); g.lineTo(32 - y * 0.2, y); g.stroke(); }
    g.beginPath(); g.moveTo(-30, -6); g.quadraticCurveTo(0, -70, 30, -6); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.strokeStyle = L.c2; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 7; i++) { const x = -24 + i * 8, y = -10 - (i % 2) * 6; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 3.2, 2, a, 0, TAU); g.fillStyle = L.c1; g.fill(); } g.fillStyle = '#f8e070'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
  },
  // ======================== 第 4 阶段（s4-content）：新出手方式的造型
  gourd(g, L) {
    // 葫芦：上小下大两节，腰系红绳，塞子朝上
    g.beginPath(); g.ellipse(0, 22, 30, 32, 0, 0, TAU); g.fillStyle = metal(g, -30, 0, 30, 0, L.c1, 0.7); g.fill(); ink(g, 2);
    g.beginPath(); g.ellipse(0, -20, 19, 20, 0, 0, TAU); g.fillStyle = metal(g, -19, 0, 19, 0, L.c1, 0.7); g.fill(); ink(g, 2);
    g.beginPath(); g.rect(-6, -48, 12, 10); g.fillStyle = L.c2; g.fill(); ink(g, 1.4);
    g.strokeStyle = '#b02a20'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -2, 13, 4, 0, 0, TAU); g.stroke();
    tassel(g, 10, 0, 14, 22, '#b02a20');
    g.strokeStyle = shade(L.c1, -0.35); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 22, 20, -2.4, -0.7); g.stroke();
    glint(g, -12, 10, 6);
  },
  umbrella(g, L) {
    // 罗伞：八骨伞面，伞沿垂穗，长柄
    const R = 56;
    g.beginPath(); g.moveTo(-R, -2);
    for (let i = 0; i <= 8; i++) { const x = -R + i * R / 4; g.quadraticCurveTo(x - R / 8, -6 + 8, x, -2); }
    g.quadraticCurveTo(0, -60, -R, -2); g.closePath();
    g.fillStyle = metal(g, -R, 0, R, 0, L.c1, 0.5); g.fill(); ink(g, 2);
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.1;
    for (let i = 1; i < 8; i++) { const x = -R + i * R / 4; g.beginPath(); g.moveTo(0, -40); g.lineTo(x, -2); g.stroke(); }
    g.beginPath(); g.moveTo(0, -42); g.lineTo(0, 56); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.strokeStyle = L.c2; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(0, -44, 4, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1);
    for (const x of [-R, -R / 2, R / 2, R]) tassel(g, x, -2, 0, 12, L.c2);
  },
  pagoda(g, L) {
    // 七层宝塔：层层飞檐，塔刹
    for (let i = 0; i < 6; i++) {
      const y = 44 - i * 15, w = 30 - i * 4;
      g.beginPath(); g.rect(-w * 0.7, y - 12, w * 1.4, 12); g.fillStyle = metal(g, -w, 0, w, 0, L.c1, 0.6); g.fill(); ink(g, 1.4);
      g.beginPath(); g.moveTo(-w - 6, y - 10); g.quadraticCurveTo(0, y - 18, w + 6, y - 10); g.lineTo(w, y - 14); g.lineTo(-w, y - 14); g.closePath();
      g.fillStyle = L.c2; g.fill(); ink(g, 1.3);
      g.fillStyle = 'rgba(30,24,18,0.6)'; g.fillRect(-3, y - 10, 6, 7);
    }
    g.beginPath(); g.moveTo(0, -60); g.lineTo(4, -44); g.lineTo(-4, -44); g.closePath(); g.fillStyle = metal(g, -4, 0, 4, 0, '#e8c860'); g.fill(); ink(g, 1);
    g.beginPath(); g.arc(0, -46, 3.4, 0, TAU); g.fillStyle = '#f8e0a0'; g.fill();
  },
  seal(g, L) {
    // 大印：方台、兽钮、底面篆文
    g.beginPath(); g.rect(-36, -4, 72, 46); g.fillStyle = metal(g, -36, 0, 36, 0, L.c1, 0.7); g.fill(); ink(g, 2);
    g.beginPath(); g.rect(-36, 34, 72, 8); g.fillStyle = shade(L.c1, -0.3); g.fill(); ink(g, 1.4);
    seal(g, -26, 4, 52, 26, shade(L.c1, -0.5), 77);
    g.beginPath(); g.moveTo(-18, -4); g.quadraticCurveTo(-20, -30, -4, -40); g.quadraticCurveTo(14, -46, 18, -30); g.quadraticCurveTo(22, -16, 18, -4); g.closePath();
    g.fillStyle = metal(g, -20, -40, 20, 0, L.c2, 0.6); g.fill(); ink(g, 1.6);
    g.fillStyle = INK; g.beginPath(); g.arc(4, -30, 2.4, 0, TAU); g.fill();
    tassel(g, 18, -10, 16, 26, '#b02a20');
  },
  lamp(g, L) {
    // 魂灯：莲座、灯盏、跳动的灯焰
    g.beginPath(); g.ellipse(0, 46, 26, 8, 0, 0, TAU); g.fillStyle = metal(g, -26, 0, 26, 0, L.c2, 0.6); g.fill(); ink(g, 1.6);
    g.beginPath(); g.rect(-4, 10, 8, 34); g.fillStyle = metal(g, -4, 0, 4, 0, L.c2); g.fill(); ink(g, 1.2);
    g.beginPath(); g.moveTo(-28, 4); g.quadraticCurveTo(0, 22, 28, 4); g.lineTo(22, -2); g.lineTo(-22, -2); g.closePath(); g.fillStyle = metal(g, -28, 0, 28, 0, L.c1, 0.6); g.fill(); ink(g, 1.6);
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * 10, 8, 5, 8, i * 0.3, 0, TAU); g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1; g.stroke(); }
    const gr = g.createRadialGradient(0, -22, 2, 0, -22, 22); gr.addColorStop(0, 'rgba(255,255,240,0.95)'); gr.addColorStop(0.4, L.c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -50); g.quadraticCurveTo(16, -24, 0, -2); g.quadraticCurveTo(-16, -24, 0, -50); g.fill();
  },
  whip(g, L) {
    // 骨鞭：一节节鞭身盘成 S 形，柄上缠绳
    let x = -40, y = 40;
    for (let i = 0; i < 14; i++) {
      const a = i / 13, nx = -40 + a * 90, ny = 40 - a * 80 + Math.sin(a * 7) * 18;
      g.beginPath(); g.ellipse(nx, ny, 6 - a * 2.6, 5 - a * 2, Math.atan2(ny - y, nx - x), 0, TAU); g.fillStyle = metal(g, nx - 6, ny - 6, nx + 6, ny + 6, L.c1, 0.7); g.fill(); ink(g, 1.1);
      x = nx; y = ny;
    }
    g.beginPath(); g.rect(-56, 34, 20, 9); g.fillStyle = L.c2; g.fill(); ink(g, 1.3);
    tassel(g, -58, 40, -6, 16, L.c2);
  },
  shuttle(g, L) {
    // 飞梭：两头尖、中腹鼓，镶一颗灵珠
    g.beginPath(); g.moveTo(-62, 0); g.quadraticCurveTo(-20, -18, 0, -16); g.quadraticCurveTo(20, -18, 62, 0); g.quadraticCurveTo(20, 18, 0, 16); g.quadraticCurveTo(-20, 18, -62, 0); g.closePath();
    g.fillStyle = metal(g, 0, -16, 0, 16, L.c1, 0.8); g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(-56, 0); g.lineTo(56, 0); g.stroke();
    g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1.2); glint(g, -2, -3, 5);
  },
  disk(g, L) {
    // 阵盘：圆盘八卦刻纹、中心阵眼
    g.beginPath(); g.arc(0, 0, 48, 0, TAU); g.fillStyle = metal(g, -48, -48, 48, 48, L.c1, 0.6); g.fill(); ink(g, 2);
    g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.strokeStyle = shade(L.c1, -0.45); g.lineWidth = 1.4; g.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.save(); g.rotate(a); g.fillStyle = shade(L.c1, -0.5); for (let k = 0; k < 3; k++) g.fillRect(-7, -36 + k * 4, k === 1 && i % 2 ? 6 : 14, 2.4); g.restore(); }
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1.4); glint(g, -3, -3, 6);
  },
  puppet(g, L) {
    // 傀儡：方头、关节、木甲
    g.fillStyle = metal(g, -20, 0, 20, 0, L.c1, 0.6);
    g.beginPath(); g.rect(-16, -52, 32, 26); g.fill(); ink(g, 1.8);
    g.fillStyle = INK; g.fillRect(-9, -43, 5, 4); g.fillRect(4, -43, 5, 4);
    g.fillStyle = metal(g, -24, 0, 24, 0, L.c1, 0.6); g.beginPath(); g.rect(-22, -22, 44, 40); g.fill(); ink(g, 1.8);
    g.strokeStyle = shade(L.c1, -0.4); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-22, -4); g.lineTo(22, -4); g.moveTo(0, -22); g.lineTo(0, 18); g.stroke();
    for (const sx of [-1, 1]) { g.beginPath(); g.rect(sx * 24 - 4, -20, 8, 34); g.fillStyle = L.c2; g.fill(); ink(g, 1.3); g.beginPath(); g.rect(sx * 10 - 5, 20, 10, 34); g.fillStyle = L.c2; g.fill(); ink(g, 1.3); g.beginPath(); g.arc(sx * 24, -20, 5, 0, TAU); g.fillStyle = shade(L.c1, 0.2); g.fill(); ink(g, 1); }
    g.beginPath(); g.arc(0, 2, 5, 0, TAU); g.fillStyle = '#f0d070'; g.fill();
  },
  cover(g, L) {
    // 宝罩：半透明钟形罩，顶钮与符纹
    g.beginPath(); g.moveTo(-46, 44); g.quadraticCurveTo(-50, -44, 0, -48); g.quadraticCurveTo(50, -44, 46, 44); g.quadraticCurveTo(0, 54, -46, 44); g.closePath();
    const gr = g.createLinearGradient(-46, 0, 46, 0); gr.addColorStop(0, shade(L.c1, -0.2)); gr.addColorStop(0.4, shade(L.c1, 0.4)); gr.addColorStop(1, shade(L.c1, -0.35));
    g.globalAlpha = 0.85; g.fillStyle = gr; g.fill(); g.globalAlpha = 1; ink(g, 2);
    g.strokeStyle = L.c2; g.lineWidth = 1.4;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 14, -40 + Math.abs(i) * 4); g.quadraticCurveTo(i * 18, 0, i * 18, 46); g.stroke(); }
    g.beginPath(); g.ellipse(0, -50, 8, 6, 0, 0, TAU); g.fillStyle = L.c2; g.fill(); ink(g, 1.2);
  },
};

// ------------------------------------------------------------ 缓存与对外接口
const cache = new Map<string, HTMLCanvasElement>();
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
}

/** 造型位图：res = 每局部单位的像素数 */
export function artSprite(L: ArtLook, res = 1): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${L.shape}|${L.c1}|${L.c2}|${res}`;
  let c = cache.get(key);
  if (c) return c;
  const [hw, hh] = shapeBox(L.shape);
  const pad = 4;
  c = makeCanvas((hw + pad) * 2 * res, (hh + pad) * 2 * res);
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2); g.scale(res, res);
  SH[L.shape](g, L);
  cache.set(key, c);
  return c;
}

/**
 * 在世界画布上画一件法器。size = 长轴（长条类）或直径（其余）的世界尺寸。
 * rot 弧度；flip 水平镜像；alpha 透明度。
 */
export function drawArt(g: G, L: ArtLook, x: number, y: number, size: number, rot = 0, alpha = 1, flip = false) {
  const res = size > 90 ? 2 : 1;
  const c = artSprite(L, res); if (!c) return;
  const [hw] = shapeBox(L.shape);
  const k = size / (hw * 2);       // 世界单位 / 局部单位
  const w = c.width / res * k, h = c.height / res * k;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(rot); if (flip) g.scale(-1, 1);
  g.drawImage(c, -w / 2, -h / 2, w, h);
  g.restore();
}

/** UI 图标（data URL），按物品 id 缓存 */
const iconCache = new Map<string, string>();
export function artIconURL(id: string, kind?: string, color?: string, px = 64): string | null {
  if (typeof document === 'undefined') return null;
  const key = id + '|' + px;
  const hit = iconCache.get(key); if (hit) return hit;
  const L = artLook(id, kind, color);
  const c = makeCanvas(px, px), g = c.getContext('2d')!;
  // 淡淡的灵光底
  const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  gr.addColorStop(0, `rgba(${L.glow},0.38)`); gr.addColorStop(1, `rgba(${L.glow},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  const long = LONG_SHAPES.has(L.shape);
  const s = artSprite(L, 2); if (!s) return null;
  g.save(); g.translate(px / 2, px / 2);
  if (long) g.rotate(-Math.PI / 4);
  const fit = (long ? px * 1.3 : px * 0.92) / (Math.max(s.width, s.height) / 2) ;
  g.scale(fit / 2, fit / 2);
  g.drawImage(s, -s.width / 2, -s.height / 2);
  g.restore();
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
