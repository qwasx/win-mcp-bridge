// 第十九步：原著名地的妖物造型——火蟾兽、铁火蚁、金背妖螂、炼尸、银翅夜叉、古魔血焰
// 与 beast.ts 同一坐标约定：侧视朝右，脚底 y=0，体型 1 ≈ 狼
import type { BeastLook, BeastAnim } from './beast';
type G = CanvasRenderingContext2D;
type RGB = [number, number, number];
const TAU = Math.PI * 2;
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const INK = 'rgba(28,24,20,0.6)';
const WHITE: RGB = [255, 250, 240];

function glowDot(g: G, x: number, y: number, r: number, col: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function eye(g: G, x: number, y: number, r: number, col: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,80,40,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(20,12,8,0.9)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x + r * 0.2, y - r * 0.2, r * 0.42, 0, TAU); g.fill();
}

// ---------------------------------------------------------------- 火蟾兽：蹲伏的巨蟾，背生熔岩疣，喉囊鼓动
export function toad(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const hop = A.move > 0.1 ? Math.max(0, Math.sin(A.phase * 0.8)) * 16 : 0;
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const breathe = Math.sin(A.t * 2.2);
  g.translate(0, -hop);
  const dark = shade(col, 0.55), belly: RGB = L.belly ?? [220, 170, 110];
  // 后腿（折叠）
  g.fillStyle = css(shade(col, 0.7));
  g.beginPath(); g.ellipse(-22, -16, 22, 16, -0.3, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = css(dark); g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-28, -8); g.lineTo(-40 - hop * 0.6, 0 + hop * 0.6); g.lineTo(-24, 0 + hop); g.stroke();
  // 身体
  const gr = g.createLinearGradient(0, -52, 0, 0);
  gr.addColorStop(0, css(shade(col, 0.75))); gr.addColorStop(0.6, css(col)); gr.addColorStop(1, css(belly));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-34, -6);
  g.bezierCurveTo(-40, -40, -6, -56, 18, -46);
  g.bezierCurveTo(34, -40, 44, -26, 40, -12);
  g.quadraticCurveTo(20, 2, -34, -6); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
  // 熔岩疣
  for (let i = 0; i < 11; i++) {
    const x = -26 + (i * 37 % 50), y = -40 + (i * 23 % 22);
    const pulse = 0.6 + 0.4 * Math.sin(A.t * 3 + i);
    glowDot(g, x, y, 6, L.glow ?? '255,120,40', 0.55 * pulse);
    g.fillStyle = css(mix([255, 150, 60], [255, 230, 140], pulse * 0.5)); g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(40,10,6,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.stroke();
  }
  // 喉囊
  const sac = 9 + breathe * 3 + lunge * 6;
  g.fillStyle = css(mix(belly, [255, 120, 60], 0.35), 0.95); g.beginPath(); g.ellipse(30, -10, sac, sac * 0.75, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  // 大嘴
  g.strokeStyle = 'rgba(30,10,6,0.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(18, -24); g.quadraticCurveTo(34, -18 + lunge * 6, 44, -24); g.stroke();
  if (lunge > 0.2) { g.fillStyle = `rgba(255,140,50,${lunge})`; g.beginPath(); g.ellipse(44, -22, 6 * lunge, 4 * lunge, 0, 0, TAU); g.fill(); }
  // 前腿
  g.strokeStyle = css(shade(col, 0.85)); g.lineWidth = 6;
  g.beginPath(); g.moveTo(22, -12); g.lineTo(26, -2); g.lineTo(32, 0); g.stroke();
  // 眼（凸起）
  g.fillStyle = css(shade(col, 0.8)); g.beginPath(); g.arc(22, -42, 8, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  eye(g, 24, -43, 2.6, L.eye ?? 'rgba(255,220,60,0.95)');
}

// ---------------------------------------------------------------- 铁火蚁：黑铁甲壳，关节透出黑红火光
export function ant(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const by = -12, lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const far of [true, false]) {
    const sx = -2 + i * 9, sw = Math.sin(A.phase * 2 + i * 2.1 + (far ? Math.PI : 0)) * 6 * A.move;
    g.strokeStyle = css(far ? shade(col, 0.5) : shade(col, 0.8)); g.lineWidth = 2;
    g.beginPath(); g.moveTo(sx, by); g.lineTo(sx + sw + (i - 1) * 6, by - 9); g.lineTo(sx + sw * 1.4 + (i - 1) * 10, 1); g.stroke();
  }
  const seg = (x: number, y: number, rx: number, ry: number) => {
    const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, rx);
    gr.addColorStop(0, css(mix(col, WHITE, 0.25))); gr.addColorStop(1, css(shade(col, 0.6)));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  };
  seg(-18, by - 2, 13, 9); seg(4, by, 8, 6); seg(18 + lunge * 4, by - 3, 8, 7);
  // 关节火光
  for (const [x, y] of [[-6, by], [11, by - 1], [-18, by - 2]] as [number, number][]) glowDot(g, x, y, 7, L.glow ?? '255,70,30', 0.7 + 0.3 * Math.sin(A.t * 5 + x));
  // 颚与触角
  g.strokeStyle = css(shade(col, 0.6)); g.lineWidth = 2;
  g.beginPath(); g.moveTo(24 + lunge * 4, by - 2); g.lineTo(31 + lunge * 7, by + 1 - lunge * 3); g.moveTo(24 + lunge * 4, by + 1); g.lineTo(30 + lunge * 7, by + 4 + lunge * 3); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(20, by - 9); g.quadraticCurveTo(26, by - 20, 33, by - 18); g.stroke();
  eye(g, 21, by - 5, 1.2, L.eye ?? 'rgba(255,90,40,0.95)');
}

// ---------------------------------------------------------------- 金背妖螂：细长身，高举镰臂，金色背甲
export function mantis(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const sway = Math.sin(A.t * 1.6) * 2;
  g.lineCap = 'round';
  for (let i = 0; i < 2; i++) for (const far of [true, false]) {
    const sx = -10 + i * 14, sw = Math.sin(A.phase * 1.6 + i * 2 + (far ? Math.PI : 0)) * 7 * A.move;
    g.strokeStyle = css(shade(col, far ? 0.55 : 0.85)); g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(sx, -24); g.lineTo(sx + sw - 8, -32); g.lineTo(sx + sw * 1.5 - 14, 0); g.stroke();
  }
  // 腹
  g.fillStyle = css(col); g.beginPath(); g.ellipse(-22, -26, 22, 8, 0.12, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  // 金背翅鞘
  const gold: RGB = L.accent ?? [230, 190, 70];
  const gg = g.createLinearGradient(-36, -34, 6, -20); gg.addColorStop(0, css(shade(gold, 0.7))); gg.addColorStop(0.5, css(mix(gold, WHITE, 0.4))); gg.addColorStop(1, css(gold));
  g.fillStyle = gg; g.beginPath(); g.moveTo(6, -30); g.quadraticCurveTo(-18, -42, -40, -28); g.quadraticCurveTo(-18, -26, 6, -26); g.fill(); g.strokeStyle = INK; g.stroke();
  // 胸（细长上扬）
  g.strokeStyle = css(col); g.lineWidth = 6;
  g.beginPath(); g.moveTo(2, -28); g.lineTo(18, -46 + sway); g.stroke();
  // 镰臂
  const ax = 16, ay = -42 + sway;
  g.strokeStyle = css(shade(col, 0.9)); g.lineWidth = 4;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 10 + lunge * 14, ay - 18 + lunge * 20); g.stroke();
  g.fillStyle = css(mix(col, WHITE, 0.15));
  g.beginPath(); g.moveTo(ax + 10 + lunge * 14, ay - 18 + lunge * 20); g.quadraticCurveTo(ax + 26 + lunge * 18, ay - 12 + lunge * 24, ax + 20 + lunge * 20, ay + 2 + lunge * 22); g.lineTo(ax + 14 + lunge * 14, ay - 12 + lunge * 20); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  // 三角头
  g.fillStyle = css(col); g.beginPath(); g.moveTo(16, -48 + sway); g.lineTo(28, -52 + sway); g.lineTo(24, -42 + sway); g.closePath(); g.fill(); g.strokeStyle = INK; g.stroke();
  eye(g, 25, -50 + sway, 1.6, L.eye ?? 'rgba(160,255,120,0.95)');
  g.strokeStyle = css(shade(col, 0.6)); g.lineWidth = 1; g.beginPath(); g.moveTo(22, -52 + sway); g.quadraticCurveTo(30, -68, 40, -66 + sway); g.stroke();
}

// 人形骨架：从脚到头，按七头身比例（身高 ≈ 150 · size）
function humanoid(g: G, A: BeastAnim, opt: { skin: RGB; robe: RGB; hunch: number; stiff?: boolean; armsUp?: number; tall?: number }) {
  const H = 150 * (opt.tall ?? 1), head = H / 7;
  const step = A.move > 0.05 ? A.phase : 0;
  const sw = opt.stiff ? Math.sin(step) * 0.18 : Math.sin(step) * 0.45;
  const hipY = -H * 0.48, shY = -H * 0.8 + opt.hunch * 8, shX = opt.hunch * 10;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // 腿
  for (const [s, far] of [[1, true], [-1, false]] as [number, boolean][]) {
    const a = sw * s;
    g.strokeStyle = css(shade(opt.robe, far ? 0.55 : 0.8)); g.lineWidth = head * 0.55;
    const kx = Math.sin(a) * H * 0.24, ky = hipY + H * 0.24;
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kx, ky); g.lineTo(Math.sin(a * 1.2) * H * 0.46, -2); g.stroke();
  }
  return { H, head, hipY, shY, shX };
}

// ---------------------------------------------------------------- 炼尸：铁青皮肉、褴褛黑袍、腕缠断链，僵直前探
export function corpse(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const robe: RGB = L.accent ?? [44, 42, 46];
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const B = humanoid(g, A, { skin: col, robe, hunch: 1, stiff: true });
  const { H, head, hipY, shY, shX } = B;
  // 袍身（破碎下摆）
  const gr = g.createLinearGradient(0, shY, 0, hipY + H * 0.2);
  gr.addColorStop(0, css(robe)); gr.addColorStop(1, css(shade(robe, 0.7)));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(shX - head * 0.9, shY); g.lineTo(shX + head * 0.8, shY);
  g.lineTo(head * 0.9, hipY + H * 0.12);
  for (let i = 0; i <= 6; i++) g.lineTo(head * 0.9 - i * head * 0.32, hipY + H * 0.16 + (i % 2 ? -10 : 6) + Math.sin(A.t * 2 + i) * 2);
  g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  // 双臂平伸（尸气外泄）
  const ax = shX + head * 0.4, ay = shY + head * 0.3;
  g.strokeStyle = css(shade(robe, 0.9)); g.lineWidth = head * 0.42;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + head * 2.2 + lunge * 14, ay + head * 0.2 - lunge * 6); g.stroke();
  g.strokeStyle = css(col); g.lineWidth = head * 0.26;
  g.beginPath(); g.moveTo(ax + head * 2.1 + lunge * 14, ay + head * 0.2 - lunge * 6); g.lineTo(ax + head * 2.8 + lunge * 16, ay + head * 0.3 - lunge * 6); g.stroke();
  // 腕上断链
  g.strokeStyle = 'rgba(120,116,110,0.9)'; g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) { const cx = ax + head * 1.9 - i * 5 + lunge * 14, cy = ay + head * 0.5 + i * 6 + Math.sin(A.t * 3 + i) * 2; g.beginPath(); g.ellipse(cx, cy, 3, 2, 0.5, 0, TAU); g.stroke(); }
  // 头（低垂，乱发，黄符）
  const hx = shX + head * 0.6, hy = shY - head * 0.55;
  g.fillStyle = css(col); g.beginPath(); g.ellipse(hx, hy, head * 0.42, head * 0.5, 0.2, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  g.fillStyle = 'rgba(20,18,18,0.9)';
  g.beginPath(); g.moveTo(hx - head * 0.5, hy - head * 0.1); g.quadraticCurveTo(hx, hy - head * 0.75, hx + head * 0.45, hy - head * 0.2);
  for (let i = 0; i < 5; i++) g.lineTo(hx - head * 0.5 + i * 3, hy + head * 0.4 + (i % 2) * 8 + Math.sin(A.t * 2 + i) * 2);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(230,200,90,0.95)'; g.fillRect(hx + head * 0.15, hy - head * 0.1, head * 0.22, head * 0.7);
  g.strokeStyle = 'rgba(180,40,30,0.9)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx + head * 0.26, hy - head * 0.05); g.lineTo(hx + head * 0.26, hy + head * 0.55); g.stroke();
  eye(g, hx + head * 0.3, hy - head * 0.05, 1.4, L.eye ?? 'rgba(120,255,140,0.9)');
  // 尸气
  for (let i = 0; i < 4; i++) { const ph = (A.t * 0.5 + i / 4) % 1; g.fillStyle = `rgba(90,140,90,${0.18 * (1 - ph)})`; g.beginPath(); g.arc(hx - 6 + Math.sin(i * 2 + A.t) * 10, hy - ph * 40, 8 + ph * 10, 0, TAU); g.fill(); }
}

// ---------------------------------------------------------------- 银翅夜叉：绿毛人身、银翅银目、钩爪
export function yaksha(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const flap = Math.sin(A.t * (A.flying ? 7 : 2.5));
  const silver: RGB = L.accent ?? [220, 228, 240];
  const H = 150, head = H / 7;
  const shY = -H * 0.78, hipY = -H * 0.46;
  // 远翅
  const wing = (far: boolean) => featherWing(g, -4, shY + 8, far ? 0.8 : 0.95, flap * (A.flying ? 30 : 10), silver, far, 1.05);
  wing(true);
  // 腿（反关节，蹲伏）
  g.lineCap = 'round';
  for (const [s, far] of [[1, true], [-1, false]] as [number, boolean][]) {
    const a = A.move > 0.05 ? Math.sin(A.phase + (s > 0 ? Math.PI : 0)) * 0.4 : 0;
    g.strokeStyle = css(shade(col, far ? 0.55 : 0.85)); g.lineWidth = head * 0.5;
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(14 + Math.sin(a) * 18, hipY + 30); g.lineTo(-6 + Math.sin(a) * 26, -14); g.lineTo(6 + Math.sin(a) * 28, -1); g.stroke();
  }
  // 躯干（绿毛）
  const gr = g.createLinearGradient(0, shY, 0, hipY);
  gr.addColorStop(0, css(mix(col, WHITE, 0.1))); gr.addColorStop(1, css(shade(col, 0.7)));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-head * 0.5, shY + 4);
  g.quadraticCurveTo(head * 0.2, shY - head * 0.5, head * 1.1, shY + 4);
  g.quadraticCurveTo(head * 0.9, (shY + hipY) / 2, head * 0.45, hipY + 4);
  for (let i = 0; i <= 6; i++) g.lineTo(head * 0.45 - i * head * 0.17, hipY + 4 + (i % 2 ? 7 : 0));
  g.quadraticCurveTo(-head * 0.9, (shY + hipY) / 2, -head * 0.5, shY + 4);
  g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
  g.strokeStyle = css(shade(col, 0.5), 0.6); g.lineWidth = 1;
  for (let i = 0; i < 10; i++) { const x = -head * 0.6 + (i % 4) * 7, y = shY + 6 + Math.floor(i / 4) * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 6); g.stroke(); }
  // 臂与钩爪
  const ax = head * 0.6, ay = shY + 8;
  g.strokeStyle = css(col); g.lineWidth = head * 0.36;
  g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 18 + lunge * 20, ay + 18 - lunge * 10); g.lineTo(ax + 34 + lunge * 30, ay + 8 - lunge * 12); g.stroke();
  g.strokeStyle = css(silver); g.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { const x = ax + 34 + lunge * 30, y = ay + 8 - lunge * 12; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + i * 4 - 4, x + 10, y + i * 6 + 4); g.stroke(); }
  // 头：尖耳、獠牙、银目
  const hx = head * 0.7, hy = shY - head * 0.55;
  g.fillStyle = css(col); g.beginPath(); g.ellipse(hx, hy, head * 0.48, head * 0.52, 0.1, 0, TAU); g.fill(); g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(hx - head * 0.2, hy - head * 0.4); g.lineTo(hx - head * 0.55, hy - head * 1.2); g.lineTo(hx + head * 0.1, hy - head * 0.45); g.fill(); g.stroke();
  g.fillStyle = '#f4f0e0'; g.beginPath(); g.moveTo(hx + head * 0.3, hy + head * 0.25); g.lineTo(hx + head * 0.36, hy + head * 0.6); g.lineTo(hx + head * 0.44, hy + head * 0.25); g.fill();
  eye(g, hx + head * 0.22, hy - head * 0.1, 2, L.eye ?? 'rgba(230,240,255,1)');
  wing(false);
}

// ---------------------------------------------------------------- 古魔血焰：血焰凝成的巨魔，双角、空洞的火目
export function demon(g: G, L: BeastLook, col: RGB, A: BeastAnim) {
  const lunge = Math.sin(Math.min(1, A.atk) * Math.PI);
  const t = A.t;
  const H = 170;
  g.translate(0, -16 + Math.sin(t * 1.4) * 4);
  // 外焰
  for (let i = 0; i < 16; i++) {
    const u = i / 15, x = -40 + u * 80, ph = t * 3 + i * 1.7;
    const hgt = H * (0.55 + 0.45 * Math.sin(u * Math.PI)) + Math.sin(ph) * 14;
    const gr = g.createLinearGradient(0, 0, 0, -hgt);
    gr.addColorStop(0, css(shade(col, 0.6), 0)); gr.addColorStop(0.3, css(col, 0.55)); gr.addColorStop(1, css(mix(col, [255, 200, 120], 0.4), 0));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 14, 0); g.quadraticCurveTo(x - 18 + Math.sin(ph) * 8, -hgt * 0.6, x + Math.sin(ph * 1.3) * 10, -hgt); g.quadraticCurveTo(x + 18, -hgt * 0.5, x + 14, 0); g.fill();
  }
  // 躯干
  const gr = g.createLinearGradient(0, -H, 0, 0);
  gr.addColorStop(0, css(shade(col, 0.5))); gr.addColorStop(0.5, css(col)); gr.addColorStop(1, css(shade(col, 0.4), 0.2));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-30, -H * 0.62); g.quadraticCurveTo(0, -H * 0.78, 34, -H * 0.62); g.lineTo(22, -H * 0.2); g.quadraticCurveTo(0, -H * 0.05, -22, -H * 0.2); g.closePath(); g.fill();
  // 血纹
  g.strokeStyle = 'rgba(255,220,160,0.7)'; g.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-18 + i * 9, -H * 0.6); g.quadraticCurveTo(-14 + i * 8 + Math.sin(t * 2 + i) * 4, -H * 0.42, -12 + i * 7, -H * 0.25); g.stroke(); }
  // 巨臂
  for (const [s, far] of [[-1, true], [1, false]] as [number, boolean][]) {
    const sx = s * 30, sy = -H * 0.6;
    const ex = sx + s * 16 + (s > 0 ? lunge * 40 : 0), ey = sy + 40 - (s > 0 ? lunge * 30 : 0);
    g.strokeStyle = css(far ? shade(col, 0.6) : col, 0.95); g.lineWidth = 16;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + s * 24, sy + 18, ex, ey); g.stroke();
    glowDot(g, ex, ey, 18, '255,120,60', 0.7);
  }
  // 头与双角
  const hx = 4, hy = -H * 0.8;
  g.fillStyle = css(shade(col, 0.55)); g.beginPath(); g.ellipse(hx, hy, 18, 20, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(40,10,10,0.95)';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * 10, hy - 12); g.quadraticCurveTo(hx + s * 30, hy - 30, hx + s * 22, hy - 52); g.quadraticCurveTo(hx + s * 20, hy - 30, hx + s * 4, hy - 16); g.fill(); }
  for (const dx of [-6, 10]) { glowDot(g, hx + dx, hy - 2, 9, '255,230,140', 0.9); g.fillStyle = '#fff4c0'; g.beginPath(); g.arc(hx + dx, hy - 2, 2.2, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(30,6,6,0.9)'; g.beginPath(); g.moveTo(hx - 6, hy + 8); g.lineTo(hx + 14, hy + 8); g.lineTo(hx + 4, hy + 13 + lunge * 5); g.closePath(); g.fill();
  // 火星
  for (let i = 0; i < 8; i++) { const ph = (t * 0.6 + i / 8) % 1; g.fillStyle = `rgba(255,${150 + i * 10},80,${1 - ph})`; g.beginPath(); g.arc(Math.sin(i * 2.4 + t) * 40, -H * (0.3 + ph * 0.9), 2, 0, TAU); g.fill(); }
}


/** 羽翼：初级飞羽（分叉长羽）、次级飞羽、覆羽三层；x,y 为翼根，向左后方展开 */
function featherWing(g: G, x: number, y: number, k: number, up: number, c: RGB, far: boolean, span = 1) {
  const base = far ? shade(c, 0.68) : c;
  const wx = x - 34 * k * span, wy = y - 46 * k - up;            // 腕
  const tx = x - 100 * k * span, ty = y - 40 * k - up * 1.6;     // 翼尖
  // 初级飞羽
  for (let i = 0; i < 7; i++) {
    const u = i / 6, px = wx + (tx - wx) * u, py = wy + (ty - wy) * u;
    const ang = Math.PI * (0.62 + u * 0.32) + up * 0.004, len = (34 + u * 26) * k * span;
    g.save(); g.translate(px, py); g.rotate(ang);
    g.fillStyle = css(mix(base, [40, 36, 30], 0.18 + u * 0.12), 0.97);
    g.beginPath(); g.moveTo(0, -3.5 * k); g.quadraticCurveTo(len * 0.6, -5 * k, len, 0); g.quadraticCurveTo(len * 0.6, 4 * k, 0, 3.5 * k); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,26,22,0.45)'; g.lineWidth = 0.7; g.stroke();
    g.restore();
  }
  // 次级飞羽
  for (let i = 0; i < 6; i++) {
    const u = i / 5, px = x + (wx - x) * u, py = y + (wy - y) * u;
    const len = (30 + u * 10) * k * span;
    g.save(); g.translate(px, py); g.rotate(Math.PI * 0.72 + u * 0.08);
    g.fillStyle = css(mix(base, [40, 36, 30], 0.1), 0.98);
    g.beginPath(); g.moveTo(0, -4.5 * k); g.quadraticCurveTo(len * 0.7, -5 * k, len, 0); g.quadraticCurveTo(len * 0.7, 5 * k, 0, 4.5 * k); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,26,22,0.4)'; g.lineWidth = 0.7; g.stroke();
    g.restore();
  }
  // 覆羽（翼前缘的弧形肉身）
  const gr = g.createLinearGradient(x, y, wx, wy); gr.addColorStop(0, css(mix(base, WHITE, 0.15))); gr.addColorStop(1, css(base));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x + 8, y + 2);
  g.quadraticCurveTo(x - 10 * k, wy - 6 * k, wx, wy); g.quadraticCurveTo((wx + tx) / 2, (wy + ty) / 2 - 4 * k, tx + 30 * k * span, ty + 6 * k);
  g.quadraticCurveTo(wx - 4 * k, wy + 22 * k, x - 14 * k, y + 14 * k); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
  g.strokeStyle = css(shade(base, 0.7), 0.6); g.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, px = x + (wx - x) * u, py = y + (wy - y) * u + 8 * k; g.beginPath(); g.arc(px, py, 5 * k, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
}

/** 狮禽兽等四足兽的羽翼（quad 内调用） */
export function quadWing(g: G, L: BeastLook, col: RGB, A: BeastAnim, x: number, y: number, far: boolean) {
  const flap = Math.sin(A.t * (A.flying ? 6 : 1.6));
  const c: RGB = L.accent ?? mix(col, WHITE, 0.3);
  featherWing(g, x, y, far ? 0.62 : 0.7, flap * (A.flying ? 26 : 8), c, far, 0.9);
}
