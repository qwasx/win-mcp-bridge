// 妖兽 / 鬼物：全部以代码绘制的水墨风格造型（侧视，可翻转），带走动、扑击、受击动画
type G = CanvasRenderingContext2D;
type RGB = [number, number, number];
const TAU = Math.PI * 2;

export type BeastBody = 'wolf' | 'fox' | 'boar' | 'tiger' | 'bear' | 'ape' | 'snake' | 'jiao' | 'centipede' | 'spider' | 'scorpion' | 'eagle' | 'bat' | 'ghost' | 'turtle';
export interface BeastLook {
  body: BeastBody; color: RGB; belly?: RGB; accent?: RGB; eye?: string;
  size: number;          // 1 ≈ 狼大小
  horn?: boolean; mane?: boolean; spikes?: boolean; stripes?: boolean; tails?: number; heads?: number;
  glow?: string;         // 体表灵光 'r,g,b'
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
  g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill();
}

export function drawBeast(g: G, L: BeastLook, x: number, y: number, facing: number, A: BeastAnim, scale = 1) {
  g.save();
  g.translate(x, y);
  const s = L.size * scale;
  // 影子
  const alt = A.flying ? 70 + Math.sin(A.t * 2) * 8 : 0;
  g.fillStyle = `rgba(30,30,24,${A.flying ? 0.16 : 0.26})`;
  const sw = L.body === 'snake' || L.body === 'jiao' || L.body === 'centipede' ? 70 : L.body === 'ghost' ? 26 : 38;
  g.beginPath(); g.ellipse(0, 2, sw * s, 9 * s, 0, 0, TAU); g.fill();
  g.translate(0, -alt);
  g.scale(facing * s, s);
  const col = A.hit > 0 ? mix(L.color, WHITE, A.hit * 0.7) : L.color;
  switch (L.body) {
    case 'snake': case 'jiao': case 'centipede': serpent(g, L, col, A); break;
    case 'spider': spider(g, L, col, A); break;
    case 'scorpion': scorpion(g, L, col, A); break;
    case 'eagle': case 'bat': bird(g, L, col, A); break;
    case 'ghost': ghost(g, L, col, A); break;
    case 'turtle': turtle(g, L, col, A); break;
    default: quad(g, L, col, A);
  }
  g.restore();
}

// ---------------------------------------------------------------- 四足兽
interface QP { len: number; bodyH: number; leg: number; legW: number; head: number; snout: number; ear: 'point' | 'round' | 'none'; tail: 'bushy' | 'long' | 'thin' | 'none'; tusk?: boolean; hump?: number }
const QPS: Record<string, QP> = {
  wolf: { len: 64, bodyH: 26, leg: 30, legW: 6, head: 13, snout: 15, ear: 'point', tail: 'bushy' },
  fox: { len: 50, bodyH: 20, leg: 24, legW: 4.5, head: 11, snout: 13, ear: 'point', tail: 'bushy' },
  boar: { len: 66, bodyH: 36, leg: 20, legW: 8, head: 17, snout: 14, ear: 'point', tail: 'thin', tusk: true, hump: 6 },
  tiger: { len: 82, bodyH: 30, leg: 30, legW: 8, head: 16, snout: 9, ear: 'round', tail: 'long' },
  bear: { len: 72, bodyH: 44, leg: 26, legW: 11, head: 17, snout: 8, ear: 'round', tail: 'none', hump: 10 },
  ape: { len: 52, bodyH: 46, leg: 30, legW: 10, head: 15, snout: 6, ear: 'round', tail: 'none', hump: 16 },
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
  // 头颅
  g.fillStyle = css(col);
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
  // 头
  const [hx, hy] = pts[0];
  const hr = w0 * 1.25;
  g.fillStyle = css(col);
  g.beginPath(); g.ellipse(hx + 4, hy, hr * 1.35, hr * 0.85, -0.1, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
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
    g.beginPath(); g.moveTo(hx + hr * 1.3, hy + 2); g.lineTo(hx + hr * 2.2, hy + 3); g.lineTo(hx + hr * 2.6, hy); g.moveTo(hx + hr * 2.2, hy + 3); g.lineTo(hx + hr * 2.6, hy + 6); g.stroke();
  }
  eyeGlow(g, hx + hr * 0.6, hy - hr * 0.3, 2, L.eye ?? 'rgba(255,200,40,0.9)');
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
  const flap = Math.sin(A.t * (L.body === 'bat' ? 14 : 7));
  const dive = Math.sin(Math.min(1, A.atk) * Math.PI);
  g.rotate(dive * 0.5);
  const span = L.body === 'bat' ? 46 : 58;
  const wing = (farSide: boolean) => {
    const c = farSide ? shade(col, 0.6) : col;
    const yTip = -flap * 34 * (farSide ? 0.8 : 1) - 6;
    g.fillStyle = css(c, farSide ? 0.9 : 1);
    g.beginPath(); g.moveTo(-4, -4);
    if (L.body === 'bat') {
      g.quadraticCurveTo(-10, yTip - 10, -span * 0.4, yTip); g.lineTo(-span * 0.55, yTip + 14); g.lineTo(-span * 0.3, yTip + 10); g.lineTo(-span * 0.2, 4); g.lineTo(8, 2);
    } else {
      g.quadraticCurveTo(-span * 0.2, yTip - 6, -span * 0.65, yTip + 2);
      for (let i = 0; i < 5; i++) g.lineTo(-span * 0.65 + i * 8, yTip + 8 + i * 3 + (i % 2) * 4);
      g.quadraticCurveTo(-4, 6, 10, 0);
    }
    g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  };
  wing(true);
  // 身
  g.fillStyle = css(col); g.beginPath(); g.ellipse(0, 0, 20, 9, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  // 尾羽
  if (L.body === 'eagle') { g.fillStyle = css(shade(col, 0.75)); g.beginPath(); g.moveTo(-18, -2); g.lineTo(-34, -6); g.lineTo(-34, 6); g.closePath(); g.fill(); }
  // 头
  g.fillStyle = css(L.belly ?? mix(col, WHITE, 0.4)); g.beginPath(); g.arc(20, -4, 8, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  if (L.body === 'eagle') { g.fillStyle = '#e0b040'; g.beginPath(); g.moveTo(26, -6); g.quadraticCurveTo(34, -4, 30, 2); g.lineTo(26, -1); g.fill(); }
  else { g.fillStyle = css(shade(col, 0.6)); g.beginPath(); g.moveTo(16, -10); g.lineTo(18, -18); g.lineTo(22, -10); g.fill(); }
  eyeGlow(g, 23, -6, 1.6, L.eye ?? 'rgba(255,60,40,0.9)');
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
