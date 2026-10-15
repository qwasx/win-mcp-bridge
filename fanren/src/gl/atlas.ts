// 特效图集：全部由代码生成（无图片资源）。8×4 格，每格 128px，白色预乘 alpha。
import { mulberry32 } from '../core/rng';

export const CELL = 128, COLS = 8, ROWS = 4;
export const AW = CELL * COLS, AH = CELL * ROWS;

/** 图集格子编号 */
export const enum C {
  Glow = 0,     // 柔光（高斯）
  Core = 1,     // 亮核 + 光晕
  Ring = 2,     // 细环
  RingSoft = 3, // 粗软环（冲击波）
  Streak = 4,   // 横向光丝（火花、剑气拖尾）
  Flame = 5,    // 火舌（尖朝上 -y）
  Smoke = 6,    // 烟/墨团（不规则）
  Star = 7,     // 四芒星光
  Blade = 8,    // 剑形（尖朝 +x）
  Slash = 9,    // 弧形斩击（朝 +x）
  Beam = 10,    // 光束剖面（沿 u 均匀，沿 v 高斯）
  Bolt = 11,    // 雷电剖面（细亮芯 + 外晕）
  Rune = 12,    // 法阵圆盘
  Bagua = 13,   // 八卦阵
  Leaf = 14,    // 叶片
  Shard = 15,   // 冰晶/碎片（菱形）
  Feather = 16, // 乌鸦/羽
  Ink = 17,     // 墨溅
  Petal = 18,   // 花瓣
  FireRing = 19,// 火环（噪声）
  Disc = 20,    // 软边实心圆
  Lotus = 21,   // 莲花
  Wisp = 22,    // 拉长云丝
  Seal = 23,    // 方形符印
  Crack = 24,   // 地裂
  Swirl = 25,   // 旋涡
  Dot = 26,     // 小硬点
  Talisman = 27,// 符纸
  Thorn = 28,   // 尖刺（朝上）
  Water = 29,   // 水花
  Fang = 30,    // 爪痕三道
  Moon = 31,    // 月牙
}

export function cellUV(c: number): [number, number, number, number] {
  const cx = c % COLS, cy = (c / COLS) | 0;
  const p = 1.5; // 防止相邻格渗色
  return [(cx * CELL + p) / AW, (cy * CELL + p) / AH, ((cx + 1) * CELL - p) / AW, ((cy + 1) * CELL - p) / AH];
}

export function buildAtlas(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const g = cv.getContext('2d')!;
  const at = (c: number, fn: (g: CanvasRenderingContext2D) => void) => {
    g.save(); g.translate((c % COLS) * CELL + CELL / 2, ((c / COLS) | 0) * CELL + CELL / 2);
    g.beginPath(); g.rect(-CELL / 2, -CELL / 2, CELL, CELL); g.clip();
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    fn(g); g.restore();
  };
  const rad = (g: CanvasRenderingContext2D, stops: [number, number][], r = 62) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  };
  const gauss = (n: number, s: number) => Array.from({ length: n + 1 }, (_, i) => [i / n, Math.exp(-Math.pow(i / n / s, 2))] as [number, number]);
  // 0 柔光
  at(C.Glow, (g) => rad(g, gauss(10, 0.42)));
  // 1 亮核
  at(C.Core, (g) => rad(g, [[0, 1], [0.08, 1], [0.18, 0.55], [0.4, 0.16], [0.7, 0.04], [1, 0]]));
  // 2 细环
  at(C.Ring, (g) => rad(g, [[0, 0], [0.8, 0], [0.9, 0.9], [0.94, 1], [0.98, 0.3], [1, 0]]));
  // 3 粗软环
  at(C.RingSoft, (g) => rad(g, [[0, 0], [0.45, 0], [0.75, 0.55], [0.88, 1], [0.95, 0.4], [1, 0]]));
  // 4 光丝
  at(C.Streak, (g) => { g.scale(1, 0.12); rad(g, [[0, 1], [0.2, 0.8], [0.6, 0.2], [1, 0]]); });
  // 5 火舌
  at(C.Flame, (g) => {
    const rnd = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const y = 40 - i * 3.6, w = 30 * Math.sin((i / 26) * Math.PI * 0.95 + 0.15) * (1 - i / 34);
      const gr = g.createRadialGradient(0, y, 0, 0, y, w + 4);
      gr.addColorStop(0, `rgba(255,255,255,${0.16 + (1 - i / 26) * 0.12})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc((rnd() - 0.5) * 6 * (i / 26), y, w + 4, 0, Math.PI * 2); g.fill();
    }
  });
  // 6 烟/墨团
  at(C.Smoke, (g) => {
    const rnd = mulberry32(6);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 26, r = 16 + rnd() * 22;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
  // 7 四芒星
  at(C.Star, (g) => {
    rad(g, [[0, 0.9], [0.12, 0.35], [0.35, 0.05], [1, 0]], 60);
    for (const rot of [0, Math.PI / 2]) { g.save(); g.rotate(rot); g.scale(1, 0.06); rad(g, [[0, 1], [0.3, 0.6], [1, 0]], 62); g.restore(); }
    for (const rot of [Math.PI / 4, -Math.PI / 4]) { g.save(); g.rotate(rot); g.scale(0.5, 0.035); rad(g, [[0, 0.7], [1, 0]], 62); g.restore(); }
  });
  // 8 剑形（尖朝 +x）
  at(C.Blade, (g) => {
    const gr = g.createLinearGradient(-60, 0, 60, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(62, 0); g.lineTo(-30, -7); g.lineTo(-30, 7); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(-38, -14, 7, 28); g.fillRect(-58, -3, 20, 6);
    g.shadowColor = '#fff'; g.shadowBlur = 8; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(58, 0); g.lineTo(-28, 0); g.stroke();
  });
  // 9 弧形斩
  at(C.Slash, (g) => {
    for (let i = 0; i < 18; i++) {
      const k = i / 18;
      g.strokeStyle = `rgba(255,255,255,${0.08 + k * 0.12})`;
      g.lineWidth = 3 + (1 - Math.abs(k - 0.6) * 1.6) * 16;
      g.beginPath(); g.arc(-30, 0, 70 - k * 12, -1.05 + k * 0.08, 1.05 - k * 0.08); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.arc(-30, 0, 62, -0.95, 0.95); g.stroke();
  });
  // 10 光束剖面
  at(C.Beam, (g) => {
    const gr = g.createLinearGradient(0, -64, 0, 64);
    for (let i = 0; i <= 16; i++) { const v = i / 16 * 2 - 1; gr.addColorStop(i / 16, `rgba(255,255,255,${Math.exp(-v * v * 5).toFixed(3)})`); }
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  });
  // 11 雷电剖面
  at(C.Bolt, (g) => {
    const gr = g.createLinearGradient(0, -64, 0, 64);
    for (let i = 0; i <= 32; i++) { const v = Math.abs(i / 32 * 2 - 1); gr.addColorStop(i / 32, `rgba(255,255,255,${Math.min(1, Math.exp(-v * v * 160) + 0.35 * Math.exp(-v * v * 9)).toFixed(3)})`); }
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  });
  // 12 法阵
  at(C.Rune, (g) => {
    g.lineWidth = 2.2; g.globalAlpha = 0.95;
    for (const r of [60, 54, 34]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 1.4;
    for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2; const x = Math.cos(a) * 54, y = Math.sin(a) * 54; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    const rnd = mulberry32(12);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2; g.save(); g.rotate(a); g.translate(0, -57);
      g.globalAlpha = 0.85;
      for (let j = 0; j < 3; j++) { if (rnd() < 0.7) g.fillRect(-2.5 + (rnd() - 0.5) * 3, -2 + j * 1.6 - 1.5, 1.2 + rnd() * 3, 0.9); }
      g.restore();
    }
    g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke();
  });
  // 13 八卦
  at(C.Bagua, (g) => {
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
    const tri = [7, 6, 5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i * Math.PI / 4); g.translate(0, -44);
      for (let j = 0; j < 3; j++) { const solid = (tri[i] >> j) & 1; const y = -6 + j * 6; if (solid) g.fillRect(-11, y, 22, 3.2); else { g.fillRect(-11, y, 9, 3.2); g.fillRect(2, y, 9, 3.2); } }
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, Math.PI / 2); g.arc(0, 10, 10, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -10, 10, Math.PI / 2, Math.PI * 1.5); g.fill();
  });
  // 14 叶
  at(C.Leaf, (g) => {
    g.beginPath(); g.moveTo(56, 0); g.quadraticCurveTo(10, -26, -50, 0); g.quadraticCurveTo(10, 26, 56, 0); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2; g.beginPath(); g.moveTo(50, 0); g.lineTo(-44, 0); g.stroke();
  });
  // 15 冰晶
  at(C.Shard, (g) => {
    const gr = g.createLinearGradient(-60, 0, 60, 0); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(62, 0); g.lineTo(0, -16); g.lineTo(-56, 0); g.lineTo(0, 16); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.4; g.beginPath(); g.moveTo(62, 0); g.lineTo(0, 0); g.lineTo(0, 16); g.closePath(); g.fill();
  });
  // 16 羽 / 乌鸦
  at(C.Feather, (g) => {
    g.beginPath(); g.moveTo(40, 0); g.lineTo(-10, -44); g.lineTo(-4, -8); g.lineTo(-40, -4); g.lineTo(-40, 4); g.lineTo(-4, 8); g.lineTo(-10, 44); g.closePath(); g.fill();
  });
  // 17 墨溅
  at(C.Ink, (g) => {
    const rnd = mulberry32(17);
    g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 30 + rnd() * 10 + (i % 5 === 0 ? rnd() * 18 : 0); if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.globalAlpha = 0.9; g.fill();
    for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, d = 40 + rnd() * 20, r = 1.5 + rnd() * 5; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  });
  // 18 花瓣
  at(C.Petal, (g) => { g.beginPath(); g.moveTo(-40, 0); g.bezierCurveTo(-10, -34, 40, -26, 46, 0); g.bezierCurveTo(40, 26, -10, 34, -40, 0); g.globalAlpha = 0.95; g.fill(); });
  // 19 火环
  at(C.FireRing, (g) => {
    const rnd = mulberry32(19);
    for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, r = 46 + rnd() * 12, s = 4 + rnd() * 9; const gr = g.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, s); gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128); }
  });
  // 20 软边圆
  at(C.Disc, (g) => rad(g, [[0, 1], [0.8, 1], [0.92, 0.6], [1, 0]]));
  // 21 莲花
  at(C.Lotus, (g) => {
    for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i * Math.PI / 4 + k * Math.PI / 8); g.globalAlpha = k ? 0.5 : 0.85;
      const L = k ? 60 : 44;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -L * 0.6, 0, -L); g.quadraticCurveTo(14, -L * 0.6, 0, 0); g.lineWidth = 1.6; g.stroke();
      g.globalAlpha *= 0.25; g.fill(); g.restore();
    }
  });
  // 22 云丝
  at(C.Wisp, (g) => { g.scale(1, 0.32); const rnd = mulberry32(22); for (let i = 0; i < 14; i++) { const x = (rnd() - 0.5) * 70, r = 18 + rnd() * 20; const gr = g.createRadialGradient(x, 0, 0, x, 0, r); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-64, -200, 128, 400); } });
  // 23 符印
  at(C.Seal, (g) => {
    g.lineWidth = 3; g.strokeRect(-46, -46, 92, 92); g.lineWidth = 1.5; g.strokeRect(-38, -38, 76, 76);
    g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-26 + i * 4, -22 + i * 15); g.lineTo(26 - i * 3, -22 + i * 15); } g.moveTo(0, -30); g.lineTo(0, 30); g.lineWidth = 4; g.stroke();
  });
  // 24 地裂
  at(C.Crack, (g) => {
    const rnd = mulberry32(24); g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { let a = i / 9 * Math.PI * 2 + rnd() * 0.4, x = 0, y = 0; g.beginPath(); g.moveTo(0, 0); for (let j = 0; j < 5; j++) { a += (rnd() - 0.5) * 0.8; const L = 8 + rnd() * 6; x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineTo(x, y); } g.lineWidth = 3.4 - i * 0.2; g.stroke(); }
  });
  // 25 旋涡
  at(C.Swirl, (g) => { g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.16 + k * Math.PI * 2 / 3, r = i * 0.95; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.lineWidth = 5; g.globalAlpha = 0.6; g.stroke(); } });
  // 26 小硬点
  at(C.Dot, (g) => rad(g, [[0, 1], [0.35, 1], [0.55, 0.4], [1, 0]], 30));
  // 27 符纸
  at(C.Talisman, (g) => { g.globalAlpha = 0.95; g.fillRect(-18, -40, 36, 80); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -32); g.lineTo(0, 30); g.moveTo(-10, -20); g.lineTo(10, -14); g.moveTo(-10, 0); g.lineTo(10, 6); g.moveTo(-8, 16); g.quadraticCurveTo(0, 26, 10, 14); g.stroke(); });
  // 28 尖刺
  at(C.Thorn, (g) => { const gr = g.createLinearGradient(0, 60, 0, -60); gr.addColorStop(0, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-20, 60); g.lineTo(0, -62); g.lineTo(20, 60); g.closePath(); g.fill(); });
  // 29 水花
  at(C.Water, (g) => { const rnd = mulberry32(29); for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, L = 30 + rnd() * 28; g.save(); g.rotate(a + Math.PI / 2); g.globalAlpha = 0.7; g.beginPath(); g.ellipse(0, -L, 4, 10, 0, 0, Math.PI * 2); g.fill(); g.restore(); } rad(g, [[0, 0.5], [0.5, 0.1], [1, 0]], 40); });
  // 30 爪痕
  at(C.Fang, (g) => { g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.lineWidth = 7 - Math.abs(i) * 2; g.beginPath(); g.moveTo(-46 + i * 6, -40 + i * 18); g.quadraticCurveTo(0, -6 + i * 18, 46 + i * 6, 34 + i * 18); g.stroke(); } });
  // 31 月牙
  at(C.Moon, (g) => { g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(-18, 0, 50, 0, Math.PI * 2); g.fill(); });
  return cv;
}
