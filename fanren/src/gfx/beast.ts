// 妖兽 / 鬼物：全部以代码绘制的水墨风格造型（侧视，可翻转），带走动、扑击、受击动画
type G = CanvasRenderingContext2D;
type RGB = [number, number, number];
const TAU = Math.PI * 2;

export type BeastBody = 'wolf' | 'fox' | 'boar' | 'tiger' | 'bear' | 'ape' | 'snake' | 'jiao' | 'centipede' | 'spider' | 'scorpion' | 'eagle' | 'bat' | 'ghost' | 'turtle'
  | 'rat' | 'deer' | 'ox' | 'croc' | 'horse' | 'pangolin' | 'fish' | 'carp' | 'shark' | 'urchin' | 'jelly';
export interface BeastLook {
  body: BeastBody; color: RGB; belly?: RGB; accent?: RGB; eye?: string;
  size: number;          // 1 ≈ 狼大小
  horn?: boolean; mane?: boolean; spikes?: boolean; stripes?: boolean; tails?: number; heads?: number;
  glow?: string;         // 体表灵光 'r,g,b'
  // 第十五步：妖兽谱扩充
  eye3?: boolean;        // 额生第三目（三眼火狼）
  bull?: boolean;        // 双弯牛角
  crest?: RGB;           // 禽类肉冠 / 翎冠
  tail?: 'fan' | 'streamer' | 'fish';  // 禽类尾型：扇尾 / 长翎 / 鱼尾（裂风兽）
  claws?: number;        // 禽类利爪对数（裂风兽两对）
  wings?: number;        // 霜蚣等的翅膀对数
  face?: 'baby';         // 婴鲤兽：婴儿面首
  eyes?: number;         // 千目妖：眼珠数
}
export interface BeastAnim { move: number; phase: number; atk: number; hit: number; t: number; flying?: boolean }

const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const INK = 'rgba(28,24,20,0.6)';
const WHITE: RGB = [255, 250, 240];

/** 粗细渐变的肢体：从 (x0,y0) 经膝 (x1,y1) 到 (x2,y2) */
function limb(g: G, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, w0: number, w1: number, col: string) {
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = w0; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.lineWidth = w1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

function eyeGlow(g: G, x: number, y: number, r: number, col: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,80,40,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(22,14,10,0.9)'; g.beginPath(); g.arc(x, y, r * 0.95, 0, TAU); g.fill();
  g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(x + r * 0.15, y - r * 0.1, r * 0.45, 0, TAU); g.fill();
}

export function drawBeast(g: G, L: BeastLook, x: number, y: number, facing: number, A: BeastAnim, scale = 1) {
  g.save();
  g.translate(x, y);
  const s = L.size * scale;
  // 影子
  const alt = A.flying ? 70 + Math.sin(A.t * 2) * 8 : 0;
  g.fillStyle = `rgba(30,30,24,${A.flying ? 0.16 : 0.26})`;
  const sw = L.body === 'snake' || L.body === 'jiao' || L.body === 'centipede' || L.body === 'croc' ? 70 : L.body === 'ghost' || L.body === 'jelly' ? 26 : L.body === 'rat' ? 20 : 38;
  g.beginPath(); g.ellipse(0, 2, sw * s, 9 * s, 0, 0, TAU); g.fill();
  g.translate(0, -alt);
  g.scale(facing * s, s);
  const col = A.hit > 0 ? mix(L.color, WHITE, A.hit * 0.7) : L.color;
  // 浅色妖兽（雪地白兽）：加一圈冷墨晕，免得与雪地融成一片
  const lum = L.color[0] * 0.3 + L.color[1] * 0.59 + L.color[2] * 0.11;
  if (lum > 185) { g.shadowColor = 'rgba(30,44,60,0.55)'; g.shadowBlur = 7; }
  switch (L.body) {
    case 'snake': case 'jiao': case 'centipede': serpent(g, L, col, A); break;
    case 'spider': spider(g, L, col, A); break;
    case 'scorpion': scorpion(g, L, col, A); break;
    case 'eagle': case 'bat': bird(g, L, col, A); break;
    case 'ghost': ghost(g, L, col, A); break;
    case 'turtle': turtle(g, L, col, A); break;
    case 'pangolin': pangolin(g, L, col, A); break;
    case 'fish': case 'carp': case 'shark': fish(g, L, col, A); break;
    case 'urchin': urchin(g, L, col, A); break;
    case 'jelly': jelly(g, L, col, A); break;
    default: quad(g, L, col, A);
  }
  g.restore();
}

// ---------------------------------------------------------------- 四足兽
interface QP { len: number; bodyH: number; leg: number; legW: number; head: number; snout: number; ear: 'point' | 'round' | 'none'; tail: 'bushy' | 'long' | 'thin' | 'none' | 'rat' | 'thick'; tusk?: boolean; hump?: number }
const QPS: Record<string, QP> = {
  wolf: { len: 64, bodyH: 26, leg: 30, legW: 6, head: 13, snout: 15, ear: 'point', tail: 'bushy' },
  fox: { len: 50, bodyH: 20, leg: 24, legW: 4.5, head: 11, snout: 13, ear: 'point', tail: 'bushy' },
  boar: { len: 66, bodyH: 36, leg: 20, legW: 8, head: 17, snout: 14, ear: 'point', tail: 'thin', tusk: true, hump: 6 },
  tiger: { len: 82, bodyH: 30, leg: 30, legW: 8, head: 16, snout: 9, ear: 'round', tail: 'long' },
  bear: { len: 72, bodyH: 44, leg: 26, legW: 11, head: 17, snout: 8, ear: 'round', tail: 'none', hump: 10 },
  ape: { len: 52, bodyH: 46, leg: 30, legW: 10, head: 15, snout: 6, ear: 'round', tail: 'none', hump: 16 },
  rat: { len: 34, bodyH: 17, leg: 9, legW: 4, head: 10, snout: 11, ear: 'round', tail: 'rat', hump: 4 },
  deer: { len: 58, bodyH: 23, leg: 42, legW: 4.5, head: 10, snout: 14, ear: 'point', tail: 'thin' },
  ox: { len: 84, bodyH: 40, leg: 28, legW: 10, head: 15, snout: 11, ear: 'point', tail: 'thin', hump: 9 },
  croc: { len: 92, bodyH: 17, leg: 11, legW: 6, head: 11, snout: 30, ear: 'none', tail: 'thick' },
  horse: { len: 58, bodyH: 24, leg: 38, legW: 5, head: 10, snout: 17, ear: 'point', tail: 'bushy' },
};

function quad(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const P = QPS[L.body] ?? QPS.wolf;
  const far = shade(col, 0.62), dark = shade(col, 0.45);
  const belly = L.belly ? (A.hit > 0 ? mix(L.belly, WHITE, A.hit * 0.7) : L.belly) : mix(col, WHITE, 0.25);
  const ph = A.phase, mv = A.move;
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI) * 14;
  const bob = Math.abs(Math.sin(ph)) * 2.2 * mv;
  const hipX = -P.len / 2 + lunge * 0.4, shX = P.len / 2 - 6 + lunge;
  const topY = -P.leg - P.bodyH + bob;
  const midY = -P.leg - P.bodyH * 0.45 + bob;
  const legs = (farSide: boolean) => {
    const c = css(farSide ? far : shade(col, 0.85));
    for (const [bx, off] of [[hipX + 8, 0], [shX - 6, Math.PI]] as [number, number][]) {
      const sw = Math.sin(ph + off + (farSide ? Math.PI : 0)) * 0.55 * mv;
      const y0 = -P.leg + bob - 2;
      const kx = bx + Math.sin(sw) * P.leg * 0.5, ky = y0 + P.leg * 0.5;
      const lift = Math.max(0, Math.sin(ph + off + (farSide ? Math.PI : 0) + 1.2)) * 6 * mv;
      const fx = bx + Math.sin(sw * 1.4) * P.leg * 0.9, fy = -lift;
      limb(g, bx, y0 - 6, kx + (off ? 2 : -3), ky, fx, fy, P.legW * 1.3, P.legW * 0.8, c);
      g.fillStyle = css(dark); g.beginPath(); g.ellipse(fx + 2, fy - 1, P.legW * 0.7, P.legW * 0.4, 0, 0, TAU); g.fill();
    }
  };
  // 尾巴
  const tw = Math.sin(A.t * 3) * 0.2 + mv * Math.sin(ph) * 0.15;
  g.strokeStyle = css(shade(col, 0.8)); g.lineCap = 'round';
  if (P.tail === 'bushy') {
    g.fillStyle = css(shade(col, 0.85));
    g.beginPath(); g.moveTo(hipX + 2, topY + 6);
    g.quadraticCurveTo(hipX - 26, topY + 4 + tw * 20, hipX - 34, topY + 26 + tw * 10);
    g.quadraticCurveTo(hipX - 18, topY + 22, hipX + 2, topY + 14); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    if ((L.tails ?? 1) > 1) for (let i = 1; i < (L.tails ?? 1); i++) {
      const a = (i / (L.tails! - 1) - 0.5) * 0.9;
      g.fillStyle = css(mix(col, WHITE, 0.15), 0.8);
      g.beginPath(); g.moveTo(hipX + 2, topY + 6);
      g.quadraticCurveTo(hipX - 22, topY - 14 + a * 30 + tw * 16, hipX - 36, topY - 8 + a * 50); g.quadraticCurveTo(hipX - 16, topY + 8, hipX + 2, topY + 12); g.fill();
    }
  } else if (P.tail === 'long') {
    g.lineWidth = 5; g.beginPath(); g.moveTo(hipX + 2, topY + 8);
    g.bezierCurveTo(hipX - 30, topY + 4, hipX - 34, topY - 24 + tw * 30, hipX - 50, topY - 20 + tw * 20); g.stroke();
  } else if (P.tail === 'rat') {
    g.strokeStyle = css(mix(col, [220, 170, 160], 0.4)); g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(hipX + 2, topY + 10); g.bezierCurveTo(hipX - 18, topY + 14 + tw * 12, hipX - 30, -P.leg * 0.2, hipX - 46, -2 - tw * 8); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(hipX - 40, -4 - tw * 8); g.lineTo(hipX - 50, -1 - tw * 8); g.stroke();
  } else if (P.tail === 'thick') {
    // 鳄尾：粗壮渐细，背生鳞棘
    const sway = Math.sin(A.t * 2 + ph * 0.5) * 8;
    g.fillStyle = css(shade(col, 0.9));
    g.beginPath(); g.moveTo(hipX + 6, topY + 2);
    g.quadraticCurveTo(hipX - 30, topY + 2 + sway * 0.5, hipX - 62, -6 + sway);
    g.quadraticCurveTo(hipX - 30, -P.leg + 6 + sway * 0.4, hipX + 6, -P.leg + bob + 2); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = css(shade(col, 0.55));
    for (let i = 0; i < 6; i++) { const u = i / 6, sx = hipX - u * 58, sy = topY + 2 + u * (12) + sway * u * 0.9; g.beginPath(); g.moveTo(sx - 3, sy + 1); g.lineTo(sx, sy - 6 + u * 3); g.lineTo(sx + 3, sy + 1); g.fill(); }
  } else if (P.tail === 'thin') {
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(hipX + 2, topY + 8); g.quadraticCurveTo(hipX - 10, topY + 10 + tw * 10, hipX - 8, topY + 20); g.stroke();
  }
  legs(true);
  // 躯干
  g.beginPath();
  g.moveTo(hipX, midY);
  g.bezierCurveTo(hipX - 4, topY - 2, hipX + P.len * 0.3, topY - (P.hump ?? 0) * 0.3, shX - P.len * 0.15, topY - (P.hump ?? 0));
  g.quadraticCurveTo(shX + 10, topY - (P.hump ?? 0) + 2, shX + 8, midY + 4);
  g.quadraticCurveTo(shX, -P.leg + bob + 4, shX - 14, -P.leg + bob + 2);
  g.quadraticCurveTo((hipX + shX) / 2, -P.leg + bob + 6, hipX + 8, -P.leg + bob);
  g.quadraticCurveTo(hipX - 4, -P.leg + bob - 6, hipX, midY);
  g.closePath();
  const gr = g.createLinearGradient(0, topY, 0, -P.leg + bob + 6);
  gr.addColorStop(0, css(shade(col, 0.82))); gr.addColorStop(0.55, css(col)); gr.addColorStop(1, css(belly));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
  // 斑纹 / 鬃毛 / 背刺
  if (L.stripes) {
    g.strokeStyle = css(shade(col, 0.3), 0.75); g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const sx = hipX + 10 + i * (P.len - 18) / 6; g.beginPath(); g.moveTo(sx, topY + 1); g.quadraticCurveTo(sx + 4, topY + P.bodyH * 0.3, sx - 1, topY + P.bodyH * 0.55); g.stroke(); }
  }
  if (L.mane || P.tusk) {
    g.fillStyle = css(shade(col, 0.5));
    for (let i = 0; i < 9; i++) { const sx = hipX + P.len * 0.35 + i * P.len * 0.07, sy = topY - (P.hump ?? 0) * (i / 9) + 1; g.beginPath(); g.moveTo(sx - 3, sy + 3); g.lineTo(sx + 1, sy - 7 - (i % 2) * 3); g.lineTo(sx + 4, sy + 3); g.fill(); }
  }
  if (L.spikes) {
    g.fillStyle = css(L.accent ?? shade(col, 0.4));
    for (let i = 0; i < 7; i++) { const sx = hipX + 6 + i * P.len / 7, sy = topY - (P.hump ?? 0) * (i / 7) + 2; g.beginPath(); g.moveTo(sx - 4, sy + 2); g.lineTo(sx, sy - 12); g.lineTo(sx + 4, sy + 2); g.fill(); }
  }
  // 毛笔触
  g.strokeStyle = css(shade(col, 0.55), 0.5); g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { const sx = hipX + 8 + i * P.len / 6.5; g.beginPath(); g.moveTo(sx, topY + 4); g.lineTo(sx + 5, topY + 8); g.stroke(); }
  legs(false);
  // 头
  const hx = shX + P.head * 0.7, hy = topY - (P.hump ?? 0) * 0.6 + 2 + (A.atk > 0 ? lunge * 0.2 : Math.sin(A.t * 1.5) * 1);
  // 颈
  g.fillStyle = css(col);
  g.beginPath(); g.moveTo(shX - 8, topY - (P.hump ?? 0) + 2); g.quadraticCurveTo(hx - 2, hy - P.head * 0.8, hx + 2, hy); g.lineTo(shX + 6, midY + 6); g.closePath(); g.fill();
  // 耳
  if (P.ear === 'point') {
    g.fillStyle = css(shade(col, 0.7));
    g.beginPath(); g.moveTo(hx - 6, hy - P.head * 0.5); g.lineTo(hx - 3, hy - P.head * 1.5); g.lineTo(hx + 3, hy - P.head * 0.6); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  } else if (P.ear === 'round') {
    g.fillStyle = css(shade(col, 0.7)); g.beginPath(); g.arc(hx - 4, hy - P.head * 0.8, P.head * 0.32, 0, TAU); g.fill();
  }
  // 狮鬃（雪吼兽 / 冰狞兽）：头颈一圈飘动的长鬃
  if (L.mane && (L.body === 'tiger' || L.body === 'horse')) {
    const mc = L.body === 'horse' ? shade(col, 0.8) : mix(col, WHITE, 0.35);
    const n = L.body === 'horse' ? 7 : 13;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), wv = Math.sin(A.t * 3 + i) * 3;
      g.fillStyle = css(i % 2 ? mc : shade(mc, 0.86));
      if (L.body === 'horse') {
        const sx = hx - 4 - u * P.len * 0.38, sy = hy - P.head * 0.7 + u * 12;
        g.beginPath(); g.moveTo(sx + 4, sy); g.quadraticCurveTo(sx - 6, sy + 2 + wv, sx - 10 + wv, sy + 14); g.lineTo(sx, sy + 6); g.fill();
      } else {
        const a = 1.45 + u * 3.2, r = P.head * 2.0;
        g.beginPath(); g.moveTo(hx - 3 + Math.cos(a) * P.head * 0.6, hy + Math.sin(a) * P.head * 0.6);
        g.quadraticCurveTo(hx - 6 + Math.cos(a - 0.2) * r, hy + Math.sin(a - 0.2) * r + wv, hx - 10 + Math.cos(a + 0.1) * r * 1.15 + wv, hy + Math.sin(a + 0.1) * r * 1.1);
        g.lineTo(hx - 3 + Math.cos(a + 0.35) * P.head * 0.7, hy + Math.sin(a + 0.35) * P.head * 0.7); g.fill();
      }
    }
  }
  // 头颅：前额受光、后脑与下颌入暗
  const hgr = g.createRadialGradient(hx + P.head * 0.3, hy - P.head * 0.35, P.head * 0.1, hx, hy, P.head * 1.15);
  hgr.addColorStop(0, css(mix(col, WHITE, 0.12))); hgr.addColorStop(0.6, css(col)); hgr.addColorStop(1, css(shade(col, 0.72)));
  g.fillStyle = hgr;
  g.beginPath(); g.ellipse(hx, hy, P.head, P.head * 0.82, 0, 0, TAU); g.fill();
  // 吻部（扑击时张嘴）
  const open = Math.sin(Math.min(1, A.atk) * Math.PI) * 0.5;
  g.fillStyle = css(mix(col, belly, 0.4));
  g.save(); g.translate(hx + P.head * 0.6, hy + P.head * 0.15);
  g.rotate(-open * 0.4);
  g.beginPath(); g.ellipse(P.snout * 0.5, 0, P.snout * 0.75, P.head * 0.42, 0, 0, TAU); g.fill();
  g.fillStyle = '#1a1410'; g.beginPath(); g.arc(P.snout * 1.15, -P.head * 0.1, 2.2, 0, TAU); g.fill();
  g.restore();
  if (open > 0.05) {
    g.fillStyle = '#5a1a14';
    g.beginPath(); g.moveTo(hx + P.head * 0.6, hy + P.head * 0.3); g.lineTo(hx + P.head * 0.6 + P.snout * 1.2, hy + P.head * 0.3 + open * 14); g.lineTo(hx + P.head * 0.6 + P.snout, hy + P.head * 0.5); g.fill();
    g.fillStyle = '#f0e8d0'; for (let i = 0; i < 3; i++) { const tx = hx + P.head * 0.7 + i * P.snout * 0.35; g.beginPath(); g.moveTo(tx, hy + P.head * 0.32); g.lineTo(tx + 2, hy + P.head * 0.32 + 4); g.lineTo(tx + 4, hy + P.head * 0.32); g.fill(); }
  }
  if (P.tusk) { g.strokeStyle = '#f4ecd8'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + P.head * 0.9, hy + P.head * 0.4); g.quadraticCurveTo(hx + P.head * 1.4, hy + P.head * 0.6, hx + P.head * 1.3, hy - P.head * 0.1); g.stroke(); }
  if (L.bull) {
    // 双弯牛角：根粗梢细，向前上方弯起
    for (const side of [-1, 1]) {
      g.fillStyle = css(side < 0 ? shade(L.accent ?? [210, 200, 170], 0.7) : (L.accent ?? [230, 220, 190]));
      g.beginPath(); g.moveTo(hx - 4 + side * 2, hy - P.head * 0.55); g.quadraticCurveTo(hx - 18 + side * 3, hy - P.head * 1.2, hx - 8 + side * 4, hy - P.head * 2.1);
      g.quadraticCurveTo(hx - 12 + side * 3, hy - P.head * 1.15, hx + 4 + side * 2, hy - P.head * 0.6); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    }
  }
  if (L.eye3) { g.fillStyle = '#2a0c08'; g.beginPath(); g.ellipse(hx + P.head * 0.05, hy - P.head * 0.62, 2.2, 3.4, 0, 0, TAU); g.fill(); eyeGlow(g, hx + P.head * 0.05, hy - P.head * 0.62, 1.8, L.eye ?? 'rgba(255,90,40,0.9)'); }
  if (L.horn) { g.strokeStyle = css(L.accent ?? [220, 200, 160]); g.lineWidth = 3.5; g.beginPath(); g.moveTo(hx - 2, hy - P.head * 0.6); g.quadraticCurveTo(hx - 4, hy - P.head * 1.8, hx + 8, hy - P.head * 2.1); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 1.3; g.beginPath(); g.ellipse(hx, hy, P.head, P.head * 0.82, 0, 0, TAU); g.stroke();
  eyeGlow(g, hx + P.head * 0.35, hy - P.head * 0.2, 2.2, L.eye ?? 'rgba(255,90,40,0.9)');
  if (L.glow) {
    g.globalCompositeOperation = 'lighter';
    const gg = g.createRadialGradient(0, midY, 0, 0, midY, P.len * 0.8);
    gg.addColorStop(0, `rgba(${L.glow},0.22)`); gg.addColorStop(1, `rgba(${L.glow},0)`);
    g.fillStyle = gg; g.beginPath(); g.arc(0, midY, P.len * 0.8, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------- 蛇 / 蛟 / 蜈蚣
function serpent(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const N = L.body === 'centipede' ? 16 : 18;
  const len = L.body === 'jiao' ? 150 : L.body === 'centipede' ? 110 : 120;
  const pts: [number, number][] = [];
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = 30 + lunge * 20 - u * len;
    const wave = Math.sin(A.t * (3 + A.move * 5) - u * 7) * (8 + u * 6);
    pts.push([x, -4 - wave * 0.55 - (i === 0 ? 10 + lunge * 10 : 0) * (1 - u)]);
  }
  const w0 = L.body === 'jiao' ? 15 : L.body === 'centipede' ? 11 : 10;
  const belly = L.belly ?? mix(col, WHITE, 0.4);
  // 蜈蚣足
  if (L.body === 'centipede') {
    g.strokeStyle = css(shade(col, 0.5)); g.lineWidth = 2;
    for (let i = 1; i < N - 1; i++) { const [px, py] = pts[i]; const sw = Math.sin(A.t * 14 + i) * 4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + sw - 3, py + 12); g.moveTo(px, py); g.lineTo(px - sw - 3, py - 8); g.stroke(); }
  }
  // 背生薄翼（六翼霜蚣）
  if (L.wings) {
    const fl = Math.sin(A.t * 22);
    for (let w = 0; w < L.wings; w++) {
      const [px, py] = pts[2 + w * 3];
      for (const far of [true, false]) {
        const lift = (far ? 0.7 : 1) * (18 + fl * 8);
        g.fillStyle = far ? 'rgba(220,240,255,0.28)' : 'rgba(235,248,255,0.42)';
        g.strokeStyle = 'rgba(200,230,255,0.75)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(px, py - 6); g.quadraticCurveTo(px - 6, py - lift - 12, px - 32, py - lift - 6); g.quadraticCurveTo(px - 22, py - lift * 0.4, px - 4, py - 4); g.closePath(); g.fill(); g.stroke();
      }
    }
  }
  // 身体（由尾向头）
  for (let i = N - 1; i > 0; i--) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i - 1];
    const w = w0 * (0.35 + 0.65 * Math.pow(1 - i / N, 0.6));
    g.strokeStyle = css(i % 2 && L.body !== 'centipede' ? col : shade(col, 0.88)); g.lineWidth = w * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (L.body === 'centipede') { g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.arc(x1, y1, w, 0, TAU); g.stroke(); }
  }
  // 腹线 + 鳞纹
  g.strokeStyle = css(belly, 0.8); g.lineWidth = 3;
  g.beginPath(); pts.forEach(([px, py], i) => { const w = w0 * (0.35 + 0.65 * Math.pow(1 - i / N, 0.6)); if (i) g.lineTo(px, py + w * 0.55); else g.moveTo(px, py + w * 0.55); }); g.stroke();
  g.strokeStyle = css(shade(col, 0.5), 0.6); g.lineWidth = 1;
  for (let i = 2; i < N - 1; i += 1) { const [px, py] = pts[i]; g.beginPath(); g.arc(px, py - 2, 3, Math.PI * 0.9, Math.PI * 2.1); g.stroke(); }
  if (L.spikes || L.body === 'jiao') {
    g.fillStyle = css(L.accent ?? shade(col, 0.5));
    for (let i = 1; i < N - 2; i += 2) { const [px, py] = pts[i]; const w = w0 * (0.35 + 0.65 * Math.pow(1 - i / N, 0.6)); g.beginPath(); g.moveTo(px - 4, py - w + 2); g.lineTo(px - 1, py - w - 9); g.lineTo(px + 3, py - w + 2); g.fill(); }
  }
  // 蛟爪：前后两对短爪
  if (L.body === 'jiao') {
    g.strokeStyle = css(shade(col, 0.7)); g.lineCap = 'round';
    for (const k of [3, 9]) {
      const [px, py] = pts[k]; const w = w0 * (0.35 + 0.65 * Math.pow(1 - k / N, 0.6));
      const sw = Math.sin(A.t * 6 + k) * 4 * (0.4 + A.move);
      g.lineWidth = 4; g.beginPath(); g.moveTo(px, py + w * 0.5); g.lineTo(px + 6 + sw, py + w + 8); g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = css(L.accent ?? [230, 210, 160]);
      for (let c = -1; c <= 1; c++) { g.beginPath(); g.moveTo(px + 6 + sw, py + w + 8); g.lineTo(px + 11 + sw + c * 2, py + w + 12 + Math.abs(c) * 1.5); g.stroke(); }
      g.strokeStyle = css(shade(col, 0.7));
    }
  }
  // 头
  const [hx, hy] = pts[0];
  const hr = w0 * 1.25;
  // 楔形蛇首：额顶隆起，吻部前收，下颌略张
  const jaw = Math.sin(Math.min(1, A.atk) * Math.PI) * hr * 0.35;
  g.beginPath(); g.moveTo(hx - hr * 0.7, hy - hr * 0.62);
  g.quadraticCurveTo(hx + hr * 0.5, hy - hr * 1.05, hx + hr * 1.75, hy - hr * 0.2);
  g.quadraticCurveTo(hx + hr * 1.95, hy + hr * 0.12, hx + hr * 1.6, hy + hr * 0.3);
  g.lineTo(hx + hr * 0.4, hy + hr * 0.42);
  g.lineTo(hx + hr * 1.45, hy + hr * 0.5 + jaw);
  g.quadraticCurveTo(hx + hr * 0.6, hy + hr * 0.95 + jaw * 0.5, hx - hr * 0.7, hy + hr * 0.62);
  g.closePath();
  const hg = g.createLinearGradient(0, hy - hr, 0, hy + hr);
  hg.addColorStop(0, css(shade(col, 0.78))); hg.addColorStop(0.55, css(col)); hg.addColorStop(1, css(belly));
  g.fillStyle = hg; g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  // 眉鳞与鼻孔
  g.strokeStyle = css(shade(col, 0.45), 0.7); g.lineWidth = 1.4; g.beginPath(); g.moveTo(hx + hr * 0.2, hy - hr * 0.62); g.quadraticCurveTo(hx + hr * 0.7, hy - hr * 0.72, hx + hr * 1.05, hy - hr * 0.42); g.stroke();
  g.fillStyle = '#1a1410'; g.beginPath(); g.arc(hx + hr * 1.55, hy - hr * 0.12, 1.4, 0, TAU); g.fill();
  if (L.body === 'jiao' || L.horn) {
    g.strokeStyle = css(L.accent ?? [230, 210, 160]); g.lineWidth = 3;
    g.beginPath(); g.moveTo(hx, hy - hr * 0.6); g.quadraticCurveTo(hx - 6, hy - hr * 2, hx - 16, hy - hr * 2.4); g.stroke();
    g.beginPath(); g.moveTo(hx + 4, hy - hr * 0.6); g.quadraticCurveTo(hx + 2, hy - hr * 2, hx - 6, hy - hr * 2.6); g.stroke();
    // 龙须
    g.strokeStyle = css(L.accent ?? [230, 210, 160], 0.7); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(hx + hr * 1.2, hy + 2); g.quadraticCurveTo(hx + hr * 2, hy + 10 + Math.sin(A.t * 3) * 5, hx + hr * 2.6, hy + 4); g.stroke();
  }
  if (L.body === 'centipede') { g.strokeStyle = css(L.accent ?? [200, 60, 40]); g.lineWidth = 2.5; g.beginPath(); g.moveTo(hx + hr, hy + 3); g.quadraticCurveTo(hx + hr * 2, hy + 8, hx + hr * 1.6, hy + 14); g.stroke(); }
  // 信子
  if (L.body === 'snake' && Math.sin(A.t * 5) > 0.3) {
    g.strokeStyle = '#c02020'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(hx + hr * 1.8, hy + 2); g.lineTo(hx + hr * 2.5, hy + 3); g.lineTo(hx + hr * 2.9, hy); g.moveTo(hx + hr * 2.5, hy + 3); g.lineTo(hx + hr * 2.9, hy + 6); g.stroke();
  }
  eyeGlow(g, hx + hr * 0.75, hy - hr * 0.35, 2, L.eye ?? 'rgba(255,200,40,0.9)');
}

// ---------------------------------------------------------------- 蜘蛛
function spider(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI) * 10;
  const by = -22 + Math.sin(A.t * 4) * 1;
  for (const farSide of [true, false]) {
    g.strokeStyle = css(farSide ? shade(col, 0.55) : shade(col, 0.8)); g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const sx = 4 + i * 6 + lunge, sw = Math.sin(A.phase * 1.4 + i * 1.6 + (farSide ? Math.PI : 0)) * 8 * A.move;
      const dir = i < 2 ? 1 : -1;
      const kx = sx + dir * (18 + i * 2) + sw, ky = by - 22 + (farSide ? -4 : 0);
      const fx = sx + dir * (30 + i * 5) + sw * 1.4, fy = farSide ? -4 : 2;
      g.lineWidth = farSide ? 2.5 : 3.2;
      g.beginPath(); g.moveTo(sx, by); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    }
  }
  // 腹
  const gr = g.createRadialGradient(-16, by - 8, 2, -16, by, 24);
  gr.addColorStop(0, css(mix(col, WHITE, 0.2))); gr.addColorStop(1, css(shade(col, 0.6)));
  g.fillStyle = gr; g.beginPath(); g.ellipse(-16 + lunge * 0.3, by - 2, 24, 18, -0.15, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  if (L.accent) { g.fillStyle = css(L.accent, 0.9); g.beginPath(); g.moveTo(-20, by - 10); g.lineTo(-14, by - 2); g.lineTo(-20, by + 6); g.lineTo(-26, by - 2); g.fill(); }
  // 头胸
  g.fillStyle = css(col); g.beginPath(); g.ellipse(10 + lunge, by + 2, 13, 11, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  for (let i = 0; i < 4; i++) eyeGlow(g, 16 + lunge + (i % 2) * 4, by - 2 + Math.floor(i / 2) * 4, 1.2, L.eye ?? 'rgba(255,40,40,0.9)');
  // 螯
  g.strokeStyle = '#2a1a10'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(20 + lunge, by + 6); g.lineTo(26 + lunge, by + 12 + lunge * 0.3); g.stroke();
}

// ---------------------------------------------------------------- 蝎
function scorpion(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const by = -14;
  g.strokeStyle = css(shade(col, 0.6)); g.lineWidth = 2.4; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) { const sx = -10 + i * 8, sw = Math.sin(A.phase * 1.5 + i * 1.7) * 6 * A.move; g.beginPath(); g.moveTo(sx, by); g.lineTo(sx + sw - 6, by - 8); g.lineTo(sx + sw - 12, 2); g.stroke(); }
  // 身节
  for (let i = 0; i < 5; i++) { g.fillStyle = css(i % 2 ? col : shade(col, 0.85)); g.beginPath(); g.ellipse(14 - i * 9, by, 9, 7, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
  // 尾：弧形高举，扑击时前刺
  let tx = -30, ty = by;
  for (let i = 0; i < 6; i++) {
    const a = -0.6 - i * 0.5 + lunge * 0.4 * (i / 6);
    const nx = tx + Math.cos(a + Math.PI) * -9, ny = ty + Math.sin(a) * 9 - 2;
    g.fillStyle = css(shade(col, 0.9 - i * 0.04)); g.beginPath(); g.arc(nx, ny, 6 - i * 0.5, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    tx = nx; ty = ny;
  }
  g.fillStyle = css(L.accent ?? [200, 40, 40]); g.beginPath(); g.moveTo(tx, ty - 4); g.lineTo(tx + 12 + lunge * 8, ty + 4); g.lineTo(tx + 2, ty + 5); g.fill();
  // 钳
  for (const dy of [-5, 5]) {
    g.strokeStyle = css(col); g.lineWidth = 4;
    g.beginPath(); g.moveTo(20, by + dy * 0.5); g.lineTo(32 + lunge * 6, by + dy - 4); g.stroke();
    g.fillStyle = css(shade(col, 0.8)); g.beginPath(); g.ellipse(38 + lunge * 6, by + dy - 5, 7, 4, dy * 0.06, 0, TAU); g.fill();
  }
  eyeGlow(g, 20, by - 4, 1.4, L.eye ?? 'rgba(255,60,40,0.9)');
}

// ---------------------------------------------------------------- 飞禽 / 蝙蝠
function bird(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const bat = L.body === 'bat';
  const flapHz = bat ? 14 : 6.5;
  const ph = A.t * flapHz;
  const flap = Math.sin(ph);
  const dive = Math.sin(Math.min(1, A.atk) * Math.PI);
  g.rotate(dive * 0.45 - 0.04);
  const span = bat ? 50 : 66;
  const dark = shade(col, 0.55), light = mix(col, WHITE, 0.3);
  const bob = -Math.cos(ph) * 3;
  g.translate(0, bob);
  const wing = (farSide: boolean) => {
    const c = farSide ? shade(col, 0.62) : col;
    const k = farSide ? 0.82 : 1;
    // 翼面随扇动俯仰：上扬时翼尖高、展开；下压时收拢
    const lift = flap * 34 * k, fold = 0.8 + 0.2 * Math.abs(flap);
    const sx = -2, sy = -6;
    const ex = (bat ? -span * 0.35 : -span * 0.18) * fold, ey = sy - lift * (bat ? 0.55 : 0.62) - 4;   // 腕关节
    const tx = (bat ? -span * 0.82 : -span * 0.5) * fold, ty = sy - lift * (bat ? 1 : 1.25) - 2;        // 翼尖
    g.fillStyle = css(c, farSide ? 0.92 : 1);
    if (bat) {
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(ex + 6, ey - 8, ex, ey); g.lineTo(tx, ty);
      g.quadraticCurveTo(tx + 6, ty + 10, tx + 10, ty + 18); g.quadraticCurveTo(ex - 4, ey + 10, ex + 2, ey + 18);
      g.quadraticCurveTo(-span * 0.12, 4, 8, 3); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = css(shade(c, 0.6)); g.lineWidth = 1; g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx + 10, ty + 18); g.moveTo(ex, ey); g.lineTo(ex + 2, ey + 18); g.stroke();
      return;
    }
    // 羽翼：臂骨 肩→腕→翼尖，飞羽一根根自骨上生出，向后下方拖曳
    const a = Math.atan2(ty - ey, tx - ex), a2 = Math.atan2(ey - sy, ex - sx);
    const fc = shade(c, 0.78), fcD = shade(c, 0.6);
    // 次级飞羽（臂段）
    for (let i = 0; i < 6; i++) {
      const u = (i + 0.5) / 6, bx = sx + (ex - sx) * u, by = sy + (ey - sy) * u;
      feather(g, bx, by, a2 - 1.25 - u * 0.15, 15 + u * 6, 4.2, i % 2 ? fc : fcD);
    }
    // 初级飞羽（掌段）：自腕至翼尖由斜后渐转为顺臂
    for (let i = 0; i < 7; i++) {
      const u = i / 6, bx = ex + (tx - ex) * u, by = ey + (ty - ey) * u;
      feather(g, bx, by, a - 1.0 + u * 0.85, 22 + u * 12 - (i === 6 ? 6 : 0), 4.6, i % 2 ? fcD : fc);
    }
    // 覆羽：沿臂骨的一道浅色羽带
    const nx = Math.sin(a2), ny = -Math.cos(a2), nx2 = Math.sin(a), ny2 = -Math.cos(a);
    g.beginPath(); g.moveTo(sx + 6, sy - 2);
    g.quadraticCurveTo((sx + ex) / 2 + nx * 4, (sy + ey) / 2 + ny * 4 - 2, ex, ey - 1);
    g.lineTo(tx - nx2 * 1, ty);
    g.lineTo(ex + (tx - ex) * 0.55 - nx2 * 7, ey + (ty - ey) * 0.55 - ny2 * 7);
    g.quadraticCurveTo(ex - nx * 10, ey - ny * 10, sx - nx * 9 + 4, sy - ny * 9 + 4);
    g.closePath();
    const cg = g.createLinearGradient(sx, sy, tx, ty);
    cg.addColorStop(0, css(mix(c, WHITE, 0.12))); cg.addColorStop(1, css(c));
    g.fillStyle = cg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    g.strokeStyle = css(light, 0.45); g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const u = i / 4; g.beginPath(); g.arc(sx + (ex - sx) * u - nx * 4, sy + (ey - sy) * u - ny * 4, 3.5, a2 + 0.6, a2 + 2.4); g.stroke(); }
  };
  // 尾
  const tw = Math.sin(A.t * 2.4) * 0.12;
  if (!bat) {
    if (L.tail === 'streamer') {
      // 长翎：两三条飘带般的尾羽
      for (let i = 0; i < 3; i++) {
        const w = Math.sin(A.t * 3 + i * 1.3) * 10;
        g.strokeStyle = css(i === 1 ? (L.accent ?? light) : shade(col, 0.8), 0.95); g.lineWidth = 3.5 - i * 0.6;
        g.beginPath(); g.moveTo(-18, -2); g.bezierCurveTo(-40, -6 + w * 0.3 + i * 4, -60, 4 + w + i * 3, -88 - i * 8, -2 + w * 1.4 + i * 6); g.stroke();
        g.fillStyle = css(L.accent ?? light); g.beginPath(); g.ellipse(-88 - i * 8, -2 + w * 1.4 + i * 6, 4, 2.4, 0.3, 0, TAU); g.fill();
      }
    } else if (L.tail === 'fish') {
      // 裂风兽：鸟身鱼尾，尾鳍左右摆
      const sw = Math.sin(A.t * 4) * 0.3;
      g.save(); g.translate(-18, 0); g.rotate(sw * 0.4);
      g.fillStyle = css(shade(col, 0.85));
      g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-18, -4, -26, 0); g.quadraticCurveTo(-18, 5, 0, 6); g.fill();
      g.fillStyle = css(L.accent ?? light, 0.95);
      g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-36, -16 + sw * 10, -46, -20); g.quadraticCurveTo(-38, -4, -42, 2); g.quadraticCurveTo(-38, 8, -46, 20); g.quadraticCurveTo(-36, 14 - sw * 10, -24, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
      g.strokeStyle = css(shade(col, 0.5), 0.5); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-6 - i * 5, 0, 3, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); }
      g.restore();
    } else {
      const fan = L.tail === 'fan' ? 1.6 : 1;
      g.fillStyle = css(shade(col, 0.72));
      g.beginPath(); g.moveTo(-16, -3);
      for (let i = 0; i <= 4; i++) { const a = (i / 4 - 0.5) * 0.5 * fan + tw; g.lineTo(-34 - Math.cos(a) * 4 * fan, Math.sin(a) * 18 * fan - 1); }
      g.lineTo(-16, 4); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
    }
  }
  wing(true);
  // 爪：飞行时收在腹下，扑击时前伸
  const claws = L.claws ?? (bat ? 0 : 1);
  for (let c = 0; c < claws; c++) {
    const cx = -4 + c * 9 + dive * 14, cy = 9 + dive * 6;
    g.strokeStyle = '#c8a050'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - 2, 5); g.lineTo(cx + 2 + dive * 6, cy); g.stroke();
    g.lineWidth = 1.3; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + 2 + dive * 6, cy); g.lineTo(cx + 6 + dive * 6 + k * 2, cy + 3 + Math.abs(k)); g.stroke(); }
  }
  // 身：纺锤形，腹浅背深
  g.beginPath(); g.moveTo(24, -5); g.bezierCurveTo(14, -15, -12, -12, -20, -3); g.bezierCurveTo(-12, 9, 12, 10, 24, 0); g.closePath();
  const bg = g.createLinearGradient(0, -12, 0, 10);
  bg.addColorStop(0, css(shade(col, 0.85))); bg.addColorStop(0.55, css(col)); bg.addColorStop(1, css(L.belly ?? light));
  g.fillStyle = bg; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  if (L.tail === 'fish') { g.strokeStyle = css(shade(col, 0.55), 0.55); g.lineWidth = 0.9; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-8 + i * 6, 4, 3, 0.2, Math.PI - 0.2); g.stroke(); } }
  // 头
  const hx = 25, hy = -6;
  g.fillStyle = css(L.belly && !bat ? mix(col, L.belly, 0.45) : col);
  g.beginPath(); g.ellipse(hx, hy, 8.5, 7.5, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  if (L.crest) {
    g.fillStyle = css(L.crest);
    g.beginPath(); g.moveTo(hx - 6, hy - 5);
    for (let i = 0; i < 4; i++) { const a = -2.4 + i * 0.35; g.lineTo(hx - 4 + Math.cos(a) * 15 - i * 2, hy - 4 + Math.sin(a) * 13 + Math.sin(A.t * 4 + i) * 1.2); g.lineTo(hx - 2 + i * 2, hy - 6); }
    g.closePath(); g.fill();
  }
  if (bat) {
    g.fillStyle = css(dark); g.beginPath(); g.moveTo(hx - 4, hy - 5); g.lineTo(hx - 2, hy - 15); g.lineTo(hx + 2, hy - 6); g.moveTo(hx + 1, hy - 6); g.lineTo(hx + 4, hy - 14); g.lineTo(hx + 6, hy - 5); g.fill();
    g.fillStyle = '#f0e8d0'; g.beginPath(); g.moveTo(hx + 4, hy + 4); g.lineTo(hx + 5, hy + 8); g.lineTo(hx + 6.5, hy + 4); g.fill();
  } else {
    // 喙：钩喙
    const open = dive * 0.35;
    g.fillStyle = '#e0b040';
    g.beginPath(); g.moveTo(hx + 6, hy - 3); g.quadraticCurveTo(hx + 17, hy - 2, hx + 15, hy + 4 - open * 4); g.lineTo(hx + 7, hy + 1); g.fill();
    g.fillStyle = '#b08020'; g.beginPath(); g.moveTo(hx + 7, hy + 1.5); g.lineTo(hx + 13, hy + 3 + open * 8); g.lineTo(hx + 6, hy + 4); g.fill();
  }
  eyeGlow(g, hx + 2.5, hy - 2, 1.7, L.eye ?? 'rgba(255,60,40,0.9)');
  wing(false);
}

// ---------------------------------------------------------------- 鬼物
function ghost(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const fl = Math.sin(A.t * 2) * 5;
  g.translate(0, -50 + fl);
  const h = 56 * (L.heads ?? 1 > 1 ? 1.2 : 1);
  g.globalAlpha *= 0.82;
  const gr = g.createLinearGradient(0, -h * 0.6, 0, h * 0.6);
  gr.addColorStop(0, css(mix(col, WHITE, 0.3), 0.95)); gr.addColorStop(0.6, css(col, 0.7)); gr.addColorStop(1, css(col, 0));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-18, -h * 0.25);
  g.bezierCurveTo(-20, -h * 0.75, 20, -h * 0.75, 18, -h * 0.25);
  g.lineTo(20, h * 0.2);
  for (let i = 0; i <= 5; i++) { const x = 20 - i * 8, y = h * 0.55 + Math.sin(A.t * 6 + i * 1.3) * 7 + (i % 2) * 8; g.quadraticCurveTo(x + 4, y - 14, x, y); }
  g.lineTo(-20, h * 0.2); g.closePath(); g.fill();
  // 鬼爪（扑击时伸出）
  const reach = Math.sin(Math.min(1, A.atk) * Math.PI) * 20;
  g.strokeStyle = css(mix(col, WHITE, 0.2), 0.85); g.lineWidth = 3; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(10, -h * 0.05 + s * 6); g.quadraticCurveTo(26 + reach, -h * 0.1 + s * 10, 34 + reach, s * 4); g.stroke(); }
  g.globalAlpha /= 0.82;
  // 眼洞
  g.fillStyle = 'rgba(10,10,20,0.85)';
  g.beginPath(); g.ellipse(2, -h * 0.38, 4, 5.5, 0, 0, TAU); g.ellipse(12, -h * 0.38, 3.5, 5, 0, 0, TAU); g.fill();
  eyeGlow(g, 2, -h * 0.38, 1.4, L.eye ?? 'rgba(120,255,200,0.9)'); eyeGlow(g, 12, -h * 0.38, 1.2, L.eye ?? 'rgba(120,255,200,0.9)');
  g.fillStyle = 'rgba(10,10,20,0.7)'; g.beginPath(); g.ellipse(8, -h * 0.2, 4, 2 + Math.abs(Math.sin(A.t * 3)) * 3, 0, 0, TAU); g.fill();
}

// ---------------------------------------------------------------- 龟（海兽）
function turtle(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI) * 10;
  g.strokeStyle = css(shade(col, 0.7)); g.lineWidth = 8; g.lineCap = 'round';
  for (const [x, o] of [[-22, 0], [20, Math.PI]] as [number, number][]) { const sw = Math.sin(A.phase + o) * 6 * A.move; g.beginPath(); g.moveTo(x, -12); g.lineTo(x + sw + 4, 0); g.stroke(); }
  const sh = L.accent ?? shade(col, 0.6);
  const gr = g.createLinearGradient(0, -48, 0, -8); gr.addColorStop(0, css(mix(sh, WHITE, 0.15))); gr.addColorStop(1, css(shade(sh, 0.7)));
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, -18, 40, 26, 0, Math.PI, 0); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
  g.strokeStyle = css(shade(sh, 0.5), 0.8); g.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 14 - 6, -20); g.lineTo(i * 14, -34 + Math.abs(i) * 4); g.lineTo(i * 14 + 6, -20); g.stroke(); }
  g.fillStyle = css(col); g.beginPath(); g.ellipse(44 + lunge, -16, 11, 9, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  eyeGlow(g, 50 + lunge, -19, 1.6, L.eye ?? 'rgba(255,200,60,0.9)');
}

// ---------------------------------------------------------------- 土甲龙：皮球般滚圆，土黄厚皮，鼠头细尾
function pangolin(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const mv = A.move, ph = A.phase;
  const bob = Math.abs(Math.sin(ph * 1.3)) * 3 * mv;
  const R = 30, cy = -R - 6 + bob;
  const dark = shade(col, 0.55);
  // 细尾
  const tw = Math.sin(A.t * 3) * 6;
  g.strokeStyle = css(shade(col, 0.75)); g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-R + 4, cy + 10); g.bezierCurveTo(-R - 18, cy + 18, -R - 24, -8 + tw, -R - 44, -4 + tw); g.stroke();
  // 短腿
  for (const [bx, off] of [[-14, 0], [12, Math.PI], [-6, Math.PI], [20, 0]] as [number, number][]) {
    const sw = Math.sin(ph * 1.3 + off) * 5 * mv;
    g.fillStyle = css(off ? dark : shade(col, 0.7)); g.beginPath(); g.ellipse(bx + sw, -5, 6, 7, 0, 0, TAU); g.fill();
  }
  // 球身
  const gr = g.createRadialGradient(-8, cy - 12, 4, 0, cy, R * 1.15);
  gr.addColorStop(0, css(mix(col, WHITE, 0.25))); gr.addColorStop(0.6, css(col)); gr.addColorStop(1, css(shade(col, 0.6)));
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, cy, R * 1.12, R, 0, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
  // 厚皮甲纹：一圈圈粗糙褶皱与疣点
  g.strokeStyle = css(dark, 0.7); g.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) { const x = -R * 0.8 + i * R * 0.4; g.beginPath(); g.ellipse(x, cy, 5 + Math.abs(2 - i) * 1.5, R * (0.95 - Math.abs(2 - i) * 0.12), 0, -Math.PI * 0.62, Math.PI * 0.4); g.stroke(); }
  g.fillStyle = css(dark, 0.55);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = (i * 7 % 10) / 10 * R * 0.8; g.beginPath(); g.arc(Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, 1.6, 0, TAU); g.fill(); }
  // 鼠头
  const hx = R + 4, hy = cy + 8;
  g.fillStyle = css(col); g.beginPath(); g.ellipse(hx, hy, 12, 9, -0.15, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  g.beginPath(); g.moveTo(hx + 6, hy - 5); g.quadraticCurveTo(hx + 20, hy - 1, hx + 21, hy + 3); g.quadraticCurveTo(hx + 14, hy + 7, hx + 6, hy + 6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(hx + 20, hy + 2, 1.8, 0, TAU); g.fill();
  g.fillStyle = css(shade(col, 0.7)); g.beginPath(); g.arc(hx - 5, hy - 8, 4.5, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,30,20,0.5)'; g.lineWidth = 0.8; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(hx + 16, hy + 2); g.lineTo(hx + 26, hy + 1 + i * 4); g.stroke(); }
  eyeGlow(g, hx + 3, hy - 3, 1.6, L.eye ?? 'rgba(255,200,60,0.9)');
}

// ---------------------------------------------------------------- 鱼类：吞海鱼 / 婴鲤兽 / 卧虎鲨（贴水游弋）
function fish(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const carp = L.body === 'carp', shark = L.body === 'shark';
  const sw = Math.sin(A.t * (4 + A.move * 4)) * (0.5 + A.move * 0.5);
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const len = shark ? 96 : carp ? 78 : 64, h = shark ? 22 : carp ? 24 : 20;
  const y0 = -20 - Math.sin(A.t * 1.6) * 3;
  g.translate(lunge * 14, y0);
  const belly = L.belly ?? mix(col, WHITE, 0.5);
  // 水纹
  g.strokeStyle = 'rgba(230,245,255,0.55)'; g.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) { const r = ((A.t * 30 + i * 18) % 54); g.globalAlpha *= 1; g.beginPath(); g.ellipse(-len * 0.1, 18 - y0 * 0 , len * 0.4 + r, 6 + r * 0.15, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); }
  // 尾鳍
  g.save(); g.translate(-len * 0.5, 0); g.rotate(sw * 0.35);
  g.fillStyle = css(L.accent ?? shade(col, 0.8));
  g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(-10, -6, -22, -h * (shark ? 1.3 : 1)); g.quadraticCurveTo(-14, 0, -22, h * (shark ? 0.7 : 1)); g.quadraticCurveTo(-10, 6, 4, 0); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  g.strokeStyle = css(shade(col, 0.5), 0.5); for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-18, i * h * 0.35); g.stroke(); }
  g.restore();
  // 背鳍
  g.fillStyle = css(L.accent ?? shade(col, 0.75));
  g.beginPath();
  if (shark) { g.moveTo(-6, -h + 3); g.quadraticCurveTo(-2, -h - 24, -16, -h - 26); g.quadraticCurveTo(-16, -h - 6, -24, -h + 4); }
  else { g.moveTo(len * 0.2, -h + 3); for (let i = 0; i <= 6; i++) g.lineTo(len * 0.2 - i * len * 0.09, -h - 9 + (i % 2) * 4 + Math.sin(A.t * 5 + i) * 1.5); g.lineTo(-len * 0.36, -h * 0.6); }
  g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  // 身
  g.beginPath(); g.moveTo(len * 0.5, 0);
  g.bezierCurveTo(len * 0.4, -h * 1.15, -len * 0.25, -h * 1.1, -len * 0.52, -2);
  g.bezierCurveTo(-len * 0.25, h * 0.95, len * 0.35, h * 1.05, len * 0.5, 0); g.closePath();
  const gr = g.createLinearGradient(0, -h, 0, h);
  gr.addColorStop(0, css(shade(col, 0.75))); gr.addColorStop(0.5, css(col)); gr.addColorStop(1, css(belly));
  g.fillStyle = gr; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  // 鳞
  if (!shark) {
    g.save(); g.clip();
    g.strokeStyle = css(mix(col, WHITE, 0.4), 0.45); g.lineWidth = 0.9;
    for (let r = -2; r <= 2; r++) for (let i = 0; i < 9; i++) { const x = len * 0.32 - i * len * 0.09 + (r % 2) * len * 0.045, y = r * h * 0.36; g.beginPath(); g.arc(x, y, h * 0.24, Math.PI * 0.55, Math.PI * 1.45); g.stroke(); }
    g.restore();
  } else {
    // 卧虎鲨：虎纹
    g.strokeStyle = css(shade(col, 0.4), 0.7); g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const x = len * 0.22 - i * len * 0.11; g.beginPath(); g.moveTo(x, -h * 0.95); g.quadraticCurveTo(x - 4, -h * 0.4, x + 1, -h * 0.05); g.stroke(); }
  }
  // 骨刺（吞海鱼）
  if (L.spikes) {
    g.strokeStyle = 'rgba(235,240,250,0.95)'; g.lineWidth = 1.6;
    for (let i = 0; i < 12; i++) { const u = i / 11, x = len * 0.38 - u * len * 0.8, yy = -h * Math.sin(Math.PI * (0.15 + u * 0.7)) * 0.95, ny = i % 2 ? 1 : -1; g.beginPath(); g.moveTo(x, yy * ny); g.lineTo(x - 5, yy * ny + ny * 10); g.stroke(); }
  }
  // 胸鳍 / 婴鲤兽巨鳍如翼
  const fl = Math.sin(A.t * 5) * (carp ? 0.6 : 0.3);
  g.save(); g.translate(len * 0.12, h * 0.25); g.rotate(0.5 + fl);
  g.fillStyle = css(L.accent ?? mix(col, WHITE, 0.3), carp ? 0.85 : 0.9);
  const fw = carp ? 34 : shark ? 22 : 14;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-fw * 0.4, fw * 0.25, -fw, fw * 0.75); g.quadraticCurveTo(-fw * 0.4, fw * 0.1, 6, -2); g.fill(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
  g.restore();
  // 婴鲤兽：腹下四只白嫩小手
  if (L.face === 'baby') {
    for (let i = 0; i < 4; i++) {
      const bx = len * 0.22 - i * 11, wv = Math.sin(A.t * 6 + i * 1.7) * 4;
      g.strokeStyle = 'rgba(250,224,206,1)'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, h * 0.7); g.quadraticCurveTo(bx + 2 + wv, h + 6, bx + 4 + wv, h + 12); g.stroke();
      g.fillStyle = 'rgba(250,224,206,1)'; g.beginPath(); g.arc(bx + 4 + wv, h + 13, 3, 0, TAU); g.fill();
    }
  }
  // 头
  const hx = len * 0.36;
  if (L.face === 'baby') {
    // 不足岁的婴儿面首：圆脸、粉腮、黑眼，诡异
    g.fillStyle = 'rgba(252,228,210,1)'; g.beginPath(); g.ellipse(hx + 4, -2, h * 0.62, h * 0.66, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = 'rgba(240,150,140,0.45)'; g.beginPath(); g.arc(hx + 9, 4, 3.4, 0, TAU); g.fill();
    g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(hx + 9, -6, 2, 2.6, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + 1, -6, 1.6, 2.4, 0, 0, TAU); g.fill();
    g.strokeStyle = '#8a3a30'; g.lineWidth = 1.2; g.beginPath(); g.arc(hx + 7, 5, 3, 0.2 + lunge * 0.3, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(40,30,30,0.7)'; g.beginPath(); g.ellipse(hx + 2, -h * 0.55, 6, 2.5, -0.2, 0, TAU); g.fill();
  } else {
    // 鳃线 + 眼 + 嘴
    g.strokeStyle = css(shade(col, 0.5), 0.8); g.lineWidth = 1.3; g.beginPath(); g.arc(hx - 6, 0, h * 0.7, -0.9, 0.9); g.stroke();
    if (shark) { g.strokeStyle = 'rgba(240,235,225,0.9)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const x = len * 0.42 + i * 3; g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 1.5, 9 + lunge * 3); g.stroke(); } }
    g.strokeStyle = '#2a1a14'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(len * 0.5, 2); g.lineTo(len * 0.38, 6 + lunge * 5); g.stroke();
    eyeGlow(g, hx + 4, -h * 0.3, 1.8, L.eye ?? 'rgba(255,220,80,0.9)');
  }
}

// ---------------------------------------------------------------- 千目妖：滚圆如巨大海胆，火红芒刺，数十只碧绿眼珠
function urchin(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const R = 30, cy = -R - 8 + Math.sin(A.t * 1.4) * 3;
  const pulse = 1 + Math.sin(Math.min(1, A.atk) * Math.PI) * 0.12;
  g.translate(0, cy); g.scale(pulse, pulse);
  // 芒刺：长短相间，缓缓蠕动
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, wob = Math.sin(A.t * 2 + i) * 0.06;
    const len = R * (0.55 + ((i * 37) % 10) / 22);
    g.strokeStyle = css(i % 3 ? (L.accent ?? [210, 60, 40]) : shade(L.accent ?? [210, 60, 40], 0.7)); g.lineWidth = 2.2 - (i % 3) * 0.4;
    g.beginPath(); g.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); g.lineTo(Math.cos(a + wob) * (R + len), Math.sin(a + wob) * (R + len)); g.stroke();
  }
  const gr = g.createRadialGradient(-8, -10, 3, 0, 0, R);
  gr.addColorStop(0, css(mix(col, WHITE, 0.3))); gr.addColorStop(0.7, css(col)); gr.addColorStop(1, css(shade(col, 0.55)));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  // 眼珠：此起彼伏地开合
  const n = L.eyes ?? 18;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + 0.4, r = R * Math.sqrt((i + 0.5) / n) * 0.82;
    const ex = Math.cos(a) * r, ey = Math.sin(a) * r * 0.9;
    const open = Math.max(0.12, Math.sin(A.t * 1.3 + i * 1.7) * 0.5 + 0.6);
    const er = 3.4 - r / R * 1.2;
    g.fillStyle = '#f2f6e8'; g.beginPath(); g.ellipse(ex, ey, er, er * Math.min(1, open), 0, 0, TAU); g.fill();
    if (open > 0.3) { g.fillStyle = 'rgba(60,200,90,1)'; g.beginPath(); g.arc(ex + 0.6, ey, er * 0.6, 0, TAU); g.fill(); g.fillStyle = '#081a0a'; g.beginPath(); g.arc(ex + 0.8, ey, er * 0.28, 0, TAU); g.fill(); }
  }
}

// ---------------------------------------------------------------- 寒魅：生于寒气，透明如水母，两侧数对红眼
function jelly(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const p = Math.sin(A.t * 2.2);
  const cy = -64 + p * 5;
  g.globalCompositeOperation = 'source-over';
  // 触须
  for (let i = 0; i < 9; i++) {
    const x0 = -20 + i * 5;
    g.strokeStyle = css(mix(col, WHITE, 0.4), 0.45); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0, cy + 8);
    for (let k = 1; k <= 5; k++) g.lineTo(x0 + Math.sin(A.t * 3 + i + k * 0.8) * 5 * k * 0.5, cy + 8 + k * 11);
    g.stroke();
  }
  // 伞盖
  const w = 28 + p * 3, h = 24 - p * 2;
  const gr = g.createRadialGradient(-6, cy - 10, 2, 0, cy, w * 1.1);
  gr.addColorStop(0, 'rgba(250,254,255,0.6)'); gr.addColorStop(0.45, css(col, 0.42)); gr.addColorStop(1, css(shade(col, 0.7), 0.3));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-w, cy + 6); g.bezierCurveTo(-w, cy - h * 1.4, w, cy - h * 1.4, w, cy + 6);
  for (let i = 0; i <= 8; i++) g.quadraticCurveTo(w - (i + 0.5) * w / 4, cy + 12, w - (i + 1) * w / 4, cy + 6);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(230,248,255,0.7)'; g.lineWidth = 1.2; g.stroke();
  g.strokeStyle = css(mix(col, WHITE, 0.6), 0.4); g.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 4, cy - h * 0.9); g.quadraticCurveTo(i * 9, cy - 4, i * 12, cy + 6); g.stroke(); }
  // 两侧数对红眼
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) eyeGlow(g, sd * (w * 0.72 - i * 3), cy - 6 + i * 6, 1.5, L.eye ?? 'rgba(255,40,40,0.95)');
  // 寒雾
  g.globalCompositeOperation = 'lighter';
  const fg = g.createRadialGradient(0, cy, 0, 0, cy, 70); fg.addColorStop(0, css(col, 0.07)); fg.addColorStop(1, css(col, 0));
  g.fillStyle = fg; g.beginPath(); g.arc(0, cy, 70, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';
}

/** 一根羽毛：叶形，羽轴一笔 */
function feather(g: G, x: number, y: number, ang: number, len: number, w: number, c: RGB) {
  const cx = Math.cos(ang), cy = Math.sin(ang), px = -cy, py = cx;
  const tx = x + cx * len, ty = y + cy * len;
  g.beginPath(); g.moveTo(x + px * w * 0.4, y + py * w * 0.4);
  g.quadraticCurveTo(x + cx * len * 0.55 + px * w, y + cy * len * 0.55 + py * w, tx, ty);
  g.quadraticCurveTo(x + cx * len * 0.5 - px * w * 0.8, y + cy * len * 0.5 - py * w * 0.8, x - px * w * 0.4, y - py * w * 0.4);
  g.closePath(); g.fillStyle = css(c); g.fill();
  g.strokeStyle = 'rgba(28,24,20,0.4)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = css(mix(c, WHITE, 0.35), 0.6); g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + cx * len * 0.85, y + cy * len * 0.85); g.stroke();
}
