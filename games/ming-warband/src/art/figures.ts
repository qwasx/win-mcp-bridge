// 程序化人物 / 骑兵精灵图（3/4 侧视角，朝右绘制，左行时水平翻转）
import { type Ctx, type Canvas, makeCanvas, css, shade, mix, OUTLINE } from './canvas';

export type HeadGear =
  | 'wrap' | 'mingHelm' | 'jinHelm' | 'queue' | 'furHat' | 'straw' | 'bald' | 'topknot'
  | 'morion' | 'cap' | 'goldHelm' | 'scholar' | 'taoist' | 'female' | 'monHelm' | 'rattan';
export type Weapon = 'sabre' | 'spear' | 'bow' | 'xbow' | 'gun' | 'club' | 'katana' | 'staff' | 'pole' | 'none';

export interface FigureSpec {
  body: number;          // 主色（战袍）
  trim?: number;         // 镶边
  pants?: number;
  armor: 0 | 1 | 2 | 3;  // 布衣 / 布面甲 / 札甲 / 重甲
  head: HeadGear;
  headColor?: number;
  weapon: Weapon;
  shield?: 'round' | 'rattan' | null;
  mounted?: boolean;
  horse?: number;        // 马色
  barding?: boolean;     // 马铠
  backFlag?: number | null;
  cape?: number | null;
  skin?: number;
  robe?: boolean;        // 长袍（僧、道、书生）
}

// 帧定义
export const FR = { idle: 0, walk0: 1, atk0: 5, aim: 8, release: 9, dead: 10 } as const;
export const FRAMES = 11;
export const RES = 3; // 纹理分辨率倍数
export const FOOT = { w: 64, h: 46, ax: 32, ay: 38 };
export const RIDER = { w: 80, h: 60, ax: 38, ay: 52 };

interface Pose {
  walk: number;    // 步态相位（弧度），NaN 表示站立
  atk: number;     // -1 无；0 蓄力；1 出手；2 收势
  aim: number;     // 0 无；1 瞄准；2 发射
  bob: number;
}

function poseOf(frame: number): Pose {
  if (frame >= FR.walk0 && frame < FR.walk0 + 4) {
    const a = ((frame - FR.walk0) / 4) * Math.PI * 2;
    return { walk: a, atk: -1, aim: 0, bob: Math.abs(Math.sin(a)) * 0.7 };
  }
  if (frame >= FR.atk0 && frame < FR.atk0 + 3) return { walk: NaN, atk: frame - FR.atk0, aim: 0, bob: 0 };
  if (frame === FR.aim) return { walk: NaN, atk: -1, aim: 1, bob: 0 };
  if (frame === FR.release) return { walk: NaN, atk: -1, aim: 2, bob: 0 };
  return { walk: NaN, atk: -1, aim: 0, bob: 0 };
}

// ---------- 绘制原语 ----------
function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, col: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 1.1;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = css(col); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function limb2(ctx: Ctx, x0: number, y0: number, xm: number, ym: number, x1: number, y1: number, w: number, col: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, lw] of [[OUTLINE, w + 1.1], [css(col), w]] as [string, number][]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.lineTo(x1, y1); ctx.stroke();
  }
}
function poly(ctx: Ctx, pts: number[], fill: string, stroke = OUTLINE, lw = 0.7) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function circle(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = OUTLINE, lw = 0.7) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, w: number) {
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

const SKIN = 0xe6bf94;
const IRON = 0x8d949c;
const WOOD = 0x7a5230;
const STEEL = 0xd9dde2;
const BOOT = 0x2a1f18;

// ---------- 头部 ----------
function drawHead(ctx: Ctx, s: FigureSpec, hx: number, hy: number, tier: { flaps: boolean }) {
  const skin = s.skin ?? SKIN;
  const hc = s.headColor ?? s.body;
  // 后脑饰物（护颈、辫子、头巾尾）
  if (s.head === 'queue') {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 2.8, hy + 0.5); ctx.quadraticCurveTo(hx - 5, hy + 4, hx - 4.2, hy + 7.5); ctx.stroke();
  }
  if (s.head === 'wrap') {
    poly(ctx, [hx - 2.5, hy - 1.5, hx - 7, hy + 0.5, hx - 6.2, hy + 2.2, hx - 2.5, hy + 0.5], css(shade(hc, -0.15)));
  }
  if ((s.head === 'mingHelm' || s.head === 'jinHelm' || s.head === 'goldHelm' || s.head === 'monHelm') && tier.flaps) {
    const c = s.head === 'goldHelm' ? 0xc89a2a : s.head === 'monHelm' ? 0x6b4a2a : shade(s.body, -0.2);
    poly(ctx, [hx - 3.8, hy - 1, hx - 4.6, hy + 4.2, hx + 0.5, hy + 4.4, hx + 1, hy + 1], css(c));
  }
  if (s.head === 'female') {
    circle(ctx, hx - 3, hy - 1.5, 2.2, '#1d1410');
    line(ctx, hx - 3.5, hy - 2.5, hx - 6.5, hy + 1.5, '#c0302a', 0.9);
  }
  // 头
  circle(ctx, hx, hy, 3.4, css(skin));
  // 眼与鬓
  circle(ctx, hx + 1.9, hy - 0.3, 0.45, '#1a1008', null);
  // 头饰
  const top = hy - 3.4;
  switch (s.head) {
    case 'wrap': {
      ctx.beginPath(); ctx.arc(hx, hy - 0.4, 3.6, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath();
      ctx.fillStyle = css(hc); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.stroke();
      line(ctx, hx - 3.3, hy - 0.6, hx + 3.4, hy - 0.6, css(shade(hc, -0.25)), 0.8);
      break;
    }
    case 'cap': case 'scholar': {
      const c = s.head === 'scholar' ? 0x222222 : 0x2a2420;
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, 3.55, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = css(c); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
      if (s.head === 'scholar') poly(ctx, [hx - 3, top + 0.5, hx - 2.5, top - 2.5, hx + 2.5, top - 2.5, hx + 3, top + 0.5], css(c));
      break;
    }
    case 'queue': {
      ctx.beginPath(); ctx.arc(hx, hy, 3.45, Math.PI * 0.9, Math.PI * 1.45); ctx.lineTo(hx, hy); ctx.closePath();
      ctx.fillStyle = '#1d1410'; ctx.fill();
      break;
    }
    case 'taoist': {
      ctx.beginPath(); ctx.arc(hx, hy - 0.3, 3.5, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = '#1d1410'; ctx.fill();
      circle(ctx, hx - 0.3, top - 0.8, 1.6, '#1d1410');
      line(ctx, hx - 2.5, top - 0.8, hx + 2, top - 1.2, '#e0c080', 0.6);
      break;
    }
    case 'female': {
      ctx.beginPath(); ctx.arc(hx, hy - 0.2, 3.6, Math.PI * 0.85, Math.PI * 2.02); ctx.closePath(); ctx.fillStyle = '#1d1410'; ctx.fill();
      break;
    }
    case 'bald': {
      ctx.beginPath(); ctx.arc(hx - 0.6, hy - 1.6, 1.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      break;
    }
    case 'topknot': {
      ctx.beginPath(); ctx.arc(hx, hy, 3.45, Math.PI * 0.85, Math.PI * 1.25); ctx.lineTo(hx, hy); ctx.closePath(); ctx.fillStyle = '#1d1410'; ctx.fill();
      poly(ctx, [hx - 0.8, top + 0.2, hx - 2.8, top - 1.8, hx - 1.2, top - 2.2, hx + 0.6, top - 0.2], '#1d1410');
      break;
    }
    case 'straw': {
      poly(ctx, [hx - 7, hy - 1.2, hx + 0.3, top - 3.6, hx + 7.4, hy - 1.2, hx + 0.3, hy - 0.2], css(hc === s.body ? 0xd2b06a : hc));
      line(ctx, hx - 3.5, hy - 2.6, hx + 0.3, top - 2.6, 'rgba(90,60,20,0.5)', 0.5);
      line(ctx, hx + 4, hy - 2.4, hx + 0.3, top - 2.6, 'rgba(90,60,20,0.5)', 0.5);
      break;
    }
    case 'rattan': {
      ctx.beginPath(); ctx.ellipse(hx, hy - 1.6, 4.6, 2.6, 0, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#c9a25a'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
      break;
    }
    case 'furHat': {
      ctx.beginPath(); ctx.arc(hx, hy - 1, 3.2, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = css(hc); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
      circle(ctx, hx, top - 1.8, 0.9, '#c0302a', OUTLINE, 0.4);
      ctx.beginPath(); ctx.ellipse(hx, hy - 1, 4.4, 1.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a3a1e'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
      break;
    }
    case 'morion': {
      ctx.beginPath(); ctx.arc(hx, hy - 1.2, 3.4, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = css(STEEL); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
      poly(ctx, [hx - 2.2, top + 0.6, hx, top - 2.6, hx + 2.2, top + 0.6], css(STEEL));
      ctx.beginPath(); ctx.moveTo(hx - 6, hy - 2.4); ctx.quadraticCurveTo(hx, hy - 0.2, hx + 6, hy - 2.4); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = css(STEEL); ctx.lineWidth = 0.9; ctx.stroke();
      break;
    }
    case 'mingHelm': case 'jinHelm': case 'goldHelm': case 'monHelm': {
      const metal = s.head === 'goldHelm' ? 0xe0b040 : s.head === 'monHelm' ? 0x9a9488 : IRON;
      ctx.beginPath(); ctx.arc(hx, hy - 0.6, 3.75, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath();
      const gr = ctx.createLinearGradient(hx - 3, top - 2, hx + 3, hy);
      gr.addColorStop(0, css(shade(metal, 0.45))); gr.addColorStop(1, css(shade(metal, -0.25)));
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.stroke();
      line(ctx, hx - 3.9, hy - 0.7, hx + 3.9, hy - 0.7, css(shade(metal, -0.35)), 0.9);
      // 盔顶
      const spikeH = s.head === 'jinHelm' ? 6 : s.head === 'goldHelm' ? 4 : s.head === 'monHelm' ? 2.5 : 3.2;
      line(ctx, hx, top - 0.2, hx, top - spikeH, OUTLINE, 1.2);
      line(ctx, hx, top - 0.2, hx, top - spikeH, css(shade(metal, 0.2)), 0.6);
      if (s.head === 'mingHelm') {
        // 红缨
        poly(ctx, [hx - 0.4, top - spikeH, hx - 2.8, top - spikeH + 2.6, hx - 1.4, top - spikeH + 3, hx + 1.4, top - spikeH + 2.6, hx + 0.6, top - spikeH], '#c42a22', OUTLINE, 0.5);
      } else if (s.head === 'jinHelm') {
        poly(ctx, [hx, top - spikeH, hx - 4.5, top - spikeH + 1.2, hx, top - spikeH + 2.4], css(s.headColor ?? 0xd8c040), OUTLINE, 0.4);
      } else if (s.head === 'goldHelm') {
        // 雉翎
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hx, top - spikeH); ctx.quadraticCurveTo(hx - 6, top - spikeH - 5, hx - 11, top - spikeH - 2); ctx.stroke();
        ctx.strokeStyle = '#e04030'; ctx.lineWidth = 0.8; ctx.stroke();
        poly(ctx, [hx - 0.5, top - spikeH, hx - 3.2, top - spikeH + 2.8, hx + 1.6, top - spikeH + 2.8], '#d42a20', OUTLINE, 0.5);
      } else {
        circle(ctx, hx, top - spikeH, 0.9, '#c0302a', OUTLINE, 0.4);
      }
      break;
    }
  }
}

// ---------- 武器 ----------
function drawWeapon(ctx: Ctx, w: Weapon, hx: number, hy: number, ang: number, scale = 1) {
  const c = Math.cos(ang), s = Math.sin(ang);
  if (w === 'sabre' || w === 'katana') {
    const L = (w === 'katana' ? 12 : 9.5) * scale;
    // 刀柄与护手
    line(ctx, hx - c * 2, hy - s * 2, hx, hy, '#3a2414', 1.4);
    line(ctx, hx - s * 1.3, hy + c * 1.3, hx + s * 1.3, hy - c * 1.3, '#b08a3a', 1.1);
    // 弯刀
    const px = -s, py = c; // 法线
    const mx = hx + c * L * 0.55 + px * 0.9 * (w === 'sabre' ? 1 : 0.5), my = hy + s * L * 0.55 + py * 0.9 * (w === 'sabre' ? 1 : 0.5);
    const tx = hx + c * L, ty = hy + s * L;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
    ctx.strokeStyle = css(STEEL); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.4; ctx.stroke();
  } else if (w === 'club' || w === 'staff' || w === 'pole') {
    const L = (w === 'club' ? 9 : 18) * scale;
    const back = w === 'club' ? 1 : 6;
    line(ctx, hx - c * back, hy - s * back, hx + c * L, hy + s * L, OUTLINE, 2.2);
    line(ctx, hx - c * back, hy - s * back, hx + c * L, hy + s * L, css(w === 'staff' ? 0x9a6a30 : WOOD), 1.3);
  } else if (w === 'spear') {
    const L = 28 * scale, back = 8;
    const bx = hx - c * back, by = hy - s * back, tx = hx + c * L, ty = hy + s * L;
    line(ctx, bx, by, tx, ty, OUTLINE, 1.9);
    line(ctx, bx, by, tx, ty, css(0x8a6038), 1.0);
    // 枪头与红缨
    const hx2 = tx + c * 4, hy2 = ty + s * 4;
    poly(ctx, [tx - s * 1.1, ty + c * 1.1, hx2, hy2, tx + s * 1.1, ty - c * 1.1], css(STEEL), OUTLINE, 0.5);
    circle(ctx, tx - c * 1, ty - s * 1 + 0.6, 1.3, '#c42a22', OUTLINE, 0.4);
  }
}

function drawShield(ctx: Ctx, kind: 'round' | 'rattan', x: number, y: number, col: number) {
  if (kind === 'rattan') {
    circle(ctx, x, y, 5.2, '#c9a25a');
    ctx.strokeStyle = 'rgba(110,70,20,0.6)'; ctx.lineWidth = 0.5;
    for (let r = 1.4; r < 5; r += 1.2) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    circle(ctx, x, y, 1.2, '#8a5a20');
  } else {
    circle(ctx, x, y, 4.6, css(col));
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.strokeStyle = css(shade(col, 0.35)); ctx.lineWidth = 0.6; ctx.stroke();
    circle(ctx, x, y, 1.3, css(0xc8a050), OUTLINE, 0.5);
    // 兽面纹
    line(ctx, x - 2.4, y - 2.4, x - 1.4, y - 1.4, css(shade(col, -0.4)), 0.6);
    line(ctx, x + 2.4, y - 2.4, x + 1.4, y - 1.4, css(shade(col, -0.4)), 0.6);
  }
}

function drawBow(ctx: Ctx, x: number, y: number, pull: number, release: boolean) {
  // 弓身（反曲）
  ctx.lineCap = 'round';
  const top = y - 7.5, bot = y + 7.5;
  const path = () => { ctx.beginPath(); ctx.moveTo(x - 1, top); ctx.quadraticCurveTo(x + 3.6, top + 2, x + 2.6, y); ctx.quadraticCurveTo(x + 3.6, bot - 2, x - 1, bot); };
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.9; path(); ctx.stroke();
  ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = 1.0; path(); ctx.stroke();
  // 弦
  const sx = x - 1 - pull;
  ctx.strokeStyle = 'rgba(240,230,210,0.9)'; ctx.lineWidth = 0.45;
  ctx.beginPath(); ctx.moveTo(x - 1, top); ctx.lineTo(sx, y); ctx.lineTo(x - 1, bot); ctx.stroke();
  if (pull > 0 && !release) {
    // 箭
    line(ctx, sx, y, x + 6, y, '#5a3a1a', 0.6);
    poly(ctx, [x + 6, y - 0.8, x + 7.8, y, x + 6, y + 0.8], css(STEEL), null as unknown as string);
  }
}

// ---------- 人物 ----------
interface Opt { tierFlaps: boolean; }

/** 画一个站立/行走的人（脚底在原点，朝右） */
function drawPerson(ctx: Ctx, s: FigureSpec, p: Pose, o: Opt, riding: boolean) {
  const skin = s.skin ?? SKIN;
  const body = s.body;
  const trim = s.trim ?? shade(body, -0.35);
  const pants = s.pants ?? shade(mix(body, 0x3a3028, 0.6), -0.2);
  const bob = p.bob;
  const hipY = -9 - bob + (riding ? 0 : 0), shY = -16.5 - bob, headY = -20.6 - bob;
  const hx = 0.6, hy = headY;
  const walking = !isNaN(p.walk);
  const sw = walking ? Math.sin(p.walk) : 0;
  const lift = walking ? Math.max(0, Math.cos(p.walk)) : 0;
  const lift2 = walking ? Math.max(0, -Math.cos(p.walk)) : 0;

  // 背旗
  if (s.backFlag != null) {
    const fy = shY - 14 - (walking ? Math.cos(p.walk * 2) * 0.4 : 0);
    line(ctx, -2.2, shY + 2, -3.2, fy, OUTLINE, 1.3);
    line(ctx, -2.2, shY + 2, -3.2, fy, css(0x5a3a1a), 0.7);
    const wv = walking ? Math.sin(p.walk) * 0.8 : 0;
    poly(ctx, [-3.2, fy, -10, fy + 2.5 + wv, -3.2, fy + 6.5], css(s.backFlag), OUTLINE, 0.5);
    line(ctx, -3.6, fy + 1.6, -8, fy + 3 + wv * 0.8, css(shade(s.backFlag, 0.35)), 0.5);
  }
  // 披风
  if (s.cape != null) {
    const fl = walking ? 1.5 + Math.abs(sw) * 1.5 : 0.6;
    poly(ctx, [-1.5, shY + 0.5, 2, shY + 0.5, -2.5, hipY + 6.5, -6 - fl, hipY + 5, -4.5 - fl * 0.5, shY + 4], css(s.cape), OUTLINE, 0.6);
    line(ctx, -2.5, shY + 3, -5 - fl, hipY + 4.5, css(shade(s.cape, -0.25)), 0.5);
  }

  // 远侧腿
  if (!riding) {
    const fx = -sw * 3.2, fy = -lift2 * 1.6;
    limb2(ctx, 0.4, hipY + 1, fx * 0.5 + 0.6, hipY + 5, fx - 0.2, fy - 0.5, 2.6, shade(pants, -0.18));
    poly(ctx, [fx - 1.6, fy - 1.2, fx + 2.2, fy - 1.2, fx + 2.4, fy + 0.2, fx - 1.6, fy + 0.2], css(BOOT), OUTLINE, 0.5);
  }

  // 远侧手臂（持弓/扶枪/扶铳）
  const farShoulder = { x: 1.2, y: shY + 1.3 };
  const w = s.weapon;
  let farHand: { x: number; y: number } | null = null;
  if (w === 'bow') {
    farHand = p.aim ? { x: 7.4, y: shY + 1.8 } : { x: 4.2, y: hipY + 0.5 };
  } else if (w === 'xbow') {
    farHand = { x: 6.5, y: shY + (p.aim ? 1.5 : 3.6) };
  } else if (w === 'gun') {
    farHand = p.aim ? { x: 7, y: shY + 1.6 } : { x: 3.6, y: shY + 4.5 };
  } else if (w === 'spear' || w === 'katana' || w === 'staff' || w === 'pole') {
    farHand = null; // 由近手计算
  } else {
    farHand = s.shield ? { x: 4.2, y: shY + 5 } : { x: -1.4 + sw * 1.2, y: hipY + 1.5 };
  }

  // 近侧手的武器姿态
  let nearHand = { x: 3.4 - sw * 1.4, y: hipY + 0.8 };
  let wAng = -1.1;
  if (w === 'sabre' || w === 'club' || w === 'katana') {
    if (p.atk === 0) { nearHand = { x: -1.5, y: shY - 3.5 }; wAng = -2.5; }
    else if (p.atk === 1) { nearHand = { x: 6.4, y: shY + 1.2 }; wAng = -0.25; }
    else if (p.atk === 2) { nearHand = { x: 5.2, y: hipY + 1.8 }; wAng = 0.75; }
    else { nearHand = { x: 3.8 - sw * 1.2, y: hipY + 0.2 }; wAng = -1.05; }
  } else if (w === 'spear' || w === 'staff' || w === 'pole') {
    if (p.atk === 0) { nearHand = { x: -0.5, y: shY + 3.5 }; wAng = -0.12; }
    else if (p.atk === 1) { nearHand = { x: 7.5, y: shY + 2.8 }; wAng = -0.06; }
    else if (p.atk === 2) { nearHand = { x: 4.5, y: shY + 3.4 }; wAng = -0.2; }
    else if (w === 'pole') { nearHand = { x: 1.4, y: shY + 0.4 }; wAng = 0; }
    else { nearHand = { x: 3.2, y: hipY - 0.5 }; wAng = -1.25; }
    farHand = { x: nearHand.x + Math.cos(wAng) * 4.5, y: nearHand.y + Math.sin(wAng) * 4.5 };
  } else if (w === 'bow') {
    nearHand = p.aim === 1 ? { x: 1, y: shY + 1.8 } : p.aim === 2 ? { x: -0.6, y: shY + 1 } : { x: 2.6 - sw, y: hipY + 0.6 };
  } else if (w === 'xbow') {
    nearHand = { x: 2.2, y: shY + (p.aim ? 2 : 4) };
  } else if (w === 'gun') {
    nearHand = p.aim ? { x: 2.2, y: shY + 2.4 } : { x: 1.8, y: shY + 2.6 };
  }

  // 远侧手臂（在躯干之后绘制）
  if (farHand) limb2(ctx, farShoulder.x, farShoulder.y, (farShoulder.x + farHand.x) / 2 + 0.6, (farShoulder.y + farHand.y) / 2 + 1, farHand.x, farHand.y, 2.3, shade(body, -0.22));
  if (farHand) circle(ctx, farHand.x, farHand.y, 0.95, css(shade(skin, -0.1)), OUTLINE, 0.4);

  // 弓（握于远手）
  if (w === 'bow') {
    if (p.aim) drawBow(ctx, farHand!.x + 0.4, farHand!.y, p.aim === 1 ? 6.4 : 0, p.aim === 2);
    else {
      ctx.save(); ctx.translate(farHand!.x, farHand!.y); ctx.rotate(0.5); drawBow(ctx, 0, 0, 0, false); ctx.restore();
    }
  }
  // 长兵器（在身体后）
  if (w === 'spear' || w === 'staff') drawWeapon(ctx, w, nearHand.x, nearHand.y, wAng);

  // 近侧腿
  if (!riding) {
    const fx = sw * 3.2, fy = -lift * 1.6;
    limb2(ctx, 0.9, hipY + 1, fx * 0.5 + 1.2, hipY + 5, fx + 0.4, fy - 0.5, 2.7, pants);
    poly(ctx, [fx - 1.2, fy - 1.2, fx + 2.8, fy - 1.2, fx + 3, fy + 0.2, fx - 1.2, fy + 0.2], css(BOOT), OUTLINE, 0.5);
  } else {
    // 骑乘：腿垂于马侧
    limb2(ctx, 0.9, hipY + 1, 3.2, hipY + 4.6, 2, hipY + 8.2, 2.6, pants);
    poly(ctx, [1, hipY + 7.4, 4.4, hipY + 7.4, 4.6, hipY + 8.8, 1, hipY + 8.8], css(BOOT), OUTLINE, 0.5);
  }

  // 躯干与下摆
  const skirtLen = s.robe ? 8.5 : s.armor >= 2 ? 5.6 : 4.4;
  const skirtCol = s.armor === 3 ? shade(body, -0.1) : body;
  if (!riding) {
    poly(ctx, [-3.6, hipY - 1, 4.4, hipY - 1, 5.4 + (s.robe ? 1 : 0), hipY + skirtLen, -4.8 - (s.robe ? 1 : 0), hipY + skirtLen], css(skirtCol), OUTLINE, 0.7);
  } else {
    poly(ctx, [-3.6, hipY - 1, 4.4, hipY - 1, 6, hipY + 4, -5.5, hipY + 4.2], css(skirtCol), OUTLINE, 0.7);
  }
  const torso = [-3.4, shY + 0.4, 3.8, shY + 0.4, 4.4, hipY, -3.6, hipY];
  const tcol = s.armor === 3 ? mix(IRON, body, 0.25) : body;
  poly(ctx, torso, css(tcol), OUTLINE, 0.75);
  // 甲片纹理
  ctx.save();
  ctx.beginPath(); ctx.moveTo(torso[0], torso[1]); for (let i = 2; i < torso.length; i += 2) ctx.lineTo(torso[i], torso[i + 1]); ctx.closePath(); ctx.clip();
  if (s.armor === 1) {
    ctx.fillStyle = 'rgba(240,210,120,0.95)';
    for (let yy = shY + 2; yy < hipY - 0.5; yy += 2) for (let xx = -2.6 + ((yy | 0) % 2) * 0.8; xx < 4; xx += 1.7) ctx.fillRect(xx, yy, 0.55, 0.55);
  } else if (s.armor >= 2) {
    ctx.strokeStyle = s.armor === 3 ? 'rgba(30,30,35,0.55)' : css(shade(tcol, -0.35), 0.8); ctx.lineWidth = 0.4;
    for (let yy = shY + 1.6; yy < hipY; yy += 1.3) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(5, yy); ctx.stroke(); }
    for (let yy = shY + 1.6, k = 0; yy < hipY; yy += 1.3, k++) for (let xx = -3 + (k % 2) * 0.8; xx < 5; xx += 1.6) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 1.3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-3.4, shY, 2.2, hipY - shY);
  }
  ctx.restore();
  // 下摆纹样
  if (s.armor >= 1 && !riding) {
    ctx.strokeStyle = s.armor === 1 ? 'rgba(240,210,120,0.8)' : css(shade(skirtCol, -0.35), 0.8); ctx.lineWidth = 0.4;
    for (let yy = hipY + 1.4; yy < hipY + skirtLen; yy += 1.4) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(5, yy); ctx.stroke(); }
  }
  // 护心镜 / 镶边 / 腰带
  if (s.armor === 3) circle(ctx, 2.3, shY + 3.6, 1.3, css(0xe8e2c8), OUTLINE, 0.5);
  line(ctx, -3.6, hipY - 0.3, 4.4, hipY - 0.3, css(trim), 1.2);
  line(ctx, -3.2, shY + 0.6, 3.6, shY + 0.6, css(trim), 0.9);
  if (s.armor >= 2) {
    // 肩甲
    ctx.beginPath(); ctx.ellipse(0.8, shY + 1.6, 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fillStyle = css(s.armor === 3 ? IRON : shade(tcol, -0.1)); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
  }

  // 头
  drawHead(ctx, s, hx, hy, { flaps: o.tierFlaps });

  // 盾（身前）
  if (s.shield) drawShield(ctx, s.shield, farHand ? farHand.x + 0.8 : 4.6, (farHand ? farHand.y : shY + 5) - 0.5, s.shield === 'round' ? shade(body, -0.05) : 0);

  // 近侧手臂与武器
  const nearShoulder = { x: 0.2, y: shY + 1.4 };
  const elbow = { x: (nearShoulder.x + nearHand.x) / 2 - 0.6, y: (nearShoulder.y + nearHand.y) / 2 + 1.2 };
  if (w === 'gun') {
    // 鸟铳
    const ang = p.aim ? -0.04 : -2.1;
    const bx = p.aim ? nearHand.x - 2.5 : nearHand.x + 1.5, by = p.aim ? nearHand.y - 0.6 : nearHand.y + 1;
    const L = 17;
    const tx = bx + Math.cos(ang) * L, ty = by + Math.sin(ang) * L;
    line(ctx, bx, by, tx, ty, OUTLINE, 2.1);
    line(ctx, bx, by, bx + Math.cos(ang) * 6, by + Math.sin(ang) * 6, css(WOOD), 1.4);
    line(ctx, bx + Math.cos(ang) * 6, by + Math.sin(ang) * 6, tx, ty, css(0x4a4a50), 0.9);
    if (p.aim === 2) {
      // 枪口火焰
      poly(ctx, [tx, ty - 1.6, tx + 5.5, ty - 0.3, tx + 2.5, ty, tx + 6.5, ty + 1.5, tx, ty + 1.4], '#ffd040', '#ff7a20', 0.5);
      circle(ctx, tx + 2, ty, 1, '#fff6c0', null);
    }
    if (!p.aim) { /* 火绳 */ line(ctx, bx + 1, by - 0.5, bx - 1.5, by + 2.5, 'rgba(200,80,30,0.9)', 0.4); }
  }
  if (w === 'xbow') {
    const bx = nearHand.x - 1.5, by = nearHand.y - 0.6;
    line(ctx, bx, by, bx + 9.5, by, OUTLINE, 2);
    line(ctx, bx, by, bx + 9.5, by, css(WOOD), 1.1);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx + 9, by - 4.2); ctx.quadraticCurveTo(bx + 11, by, bx + 9, by + 4.2); ctx.stroke();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 0.8; ctx.stroke();
    if (p.aim !== 2) line(ctx, bx + 2.5, by, bx + 9.8, by, '#c8b890', 0.5);
  }
  limb2(ctx, nearShoulder.x, nearShoulder.y, elbow.x, elbow.y, nearHand.x, nearHand.y, 2.4, body);
  circle(ctx, nearHand.x, nearHand.y, 1, css(skin), OUTLINE, 0.4);
  if (w === 'sabre' || w === 'club' || w === 'katana') drawWeapon(ctx, w, nearHand.x, nearHand.y, wAng);
  if (w === 'pole') {
    // 扁担与两只筐
    const lx = nearHand.x - 7, rx = nearHand.x + 7, yy = nearHand.y - 0.2;
    line(ctx, lx, yy, rx, yy, OUTLINE, 1.6); line(ctx, lx, yy, rx, yy, css(WOOD), 0.9);
    for (const bx of [lx + 0.5, rx - 0.5]) {
      line(ctx, bx, yy, bx - 1.2, yy + 5, 'rgba(60,40,20,0.8)', 0.4); line(ctx, bx, yy, bx + 1.2, yy + 5, 'rgba(60,40,20,0.8)', 0.4);
      poly(ctx, [bx - 2.4, yy + 5, bx + 2.4, yy + 5, bx + 1.8, yy + 8.4, bx - 1.8, yy + 8.4], '#b08848', OUTLINE, 0.5);
    }
  }
}

// ---------- 马 ----------
function drawHorse(ctx: Ctx, s: FigureSpec, frame: number, front: boolean) {
  const col = s.horse ?? 0x7a4a26;
  const dark = shade(col, -0.35);
  const p = poseOf(frame);
  const g = !isNaN(p.walk);
  const a = p.walk;
  const bodyY = -15.5 - (g ? Math.abs(Math.sin(a)) * 1.2 : 0);
  const legs: [number, number, number][] = [ // 根部x、相位偏移、是否前腿
    [-7, 0, 0], [-5.5, Math.PI * 0.5, 0], [6, Math.PI, 1], [7.5, Math.PI * 1.5, 1],
  ];
  const drawLeg = (i: number, near: boolean) => {
    const [lx, ph, isFront] = legs[i];
    const c = near ? col : dark;
    let kx = lx, ky = bodyY + 7, fx = lx, fy = 0;
    if (g) {
      const t = a + ph;
      fx = lx + Math.sin(t) * 4.5; fy = -Math.max(0, Math.cos(t)) * 3.2;
      kx = lx + Math.sin(t) * 2.5 + (isFront ? 1 : -1) * Math.max(0, Math.cos(t)) * 2; ky = bodyY + 7.5 + fy * 0.3;
    }
    limb2(ctx, lx, bodyY + 2, kx, ky, fx, fy - 0.6, 2.3, c);
    poly(ctx, [fx - 1.2, fy - 1.3, fx + 1.5, fy - 1.3, fx + 1.6, fy + 0.2, fx - 1.2, fy + 0.2], '#1a1410', OUTLINE, 0.4);
  };
  if (!front) {
    // 远侧腿 + 尾 + 躯体 + 颈 + 头
    drawLeg(1, false); drawLeg(3, false);
    // 尾巴
    const tw = g ? Math.sin(a) * 1.5 : 0;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, bodyY - 1.5); ctx.quadraticCurveTo(-14, bodyY + 1 + tw, -13 - tw, bodyY + 8.5); ctx.stroke();
    ctx.strokeStyle = css(shade(dark, -0.2)); ctx.lineWidth = 1.7; ctx.stroke();
    drawLeg(0, true); drawLeg(2, true);
    // 躯体
    ctx.beginPath(); ctx.ellipse(-0.5, bodyY, 11, 5.6, 0, 0, Math.PI * 2);
    const gr = ctx.createLinearGradient(0, bodyY - 6, 0, bodyY + 6);
    gr.addColorStop(0, css(shade(col, 0.15))); gr.addColorStop(1, css(shade(col, -0.2)));
    ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
    // 颈与头
    const nb = g ? Math.sin(a * 2) * 0.6 : 0;
    poly(ctx, [6.5, bodyY - 3.5, 9.5, bodyY - 11 + nb, 13, bodyY - 10 + nb, 11.5, bodyY + 0.5], css(col), OUTLINE, 0.8);
    ctx.save(); ctx.translate(13.2, bodyY - 9.5 + nb); ctx.rotate(0.55);
    ctx.beginPath(); ctx.ellipse(1.6, 0.4, 4.4, 2, 0, 0, Math.PI * 2); ctx.fillStyle = css(col); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
    circle(ctx, 0.6, -0.6, 0.5, '#111', null);
    poly(ctx, [-1.6, -1.6, -1, -3.8, 0, -1.8], css(col), OUTLINE, 0.5);
    ctx.restore();
    // 鬃毛
    ctx.strokeStyle = css(shade(dark, -0.3)); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(7, bodyY - 4.5); ctx.lineTo(10.4, bodyY - 11 + nb); ctx.stroke();
    // 缰绳
    line(ctx, 14.5, bodyY - 7.5 + nb, 4, bodyY - 6, 'rgba(40,25,10,0.9)', 0.4);
    // 马铠或鞍鞯
    if (s.barding) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(-0.5, bodyY + 0.5, 10.2, 5, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = css(mix(IRON, s.body, 0.35)); ctx.fillRect(-12, bodyY - 6, 24, 12);
      ctx.strokeStyle = 'rgba(25,25,30,0.5)'; ctx.lineWidth = 0.4;
      for (let yy = bodyY - 5; yy < bodyY + 6; yy += 1.4) { ctx.beginPath(); ctx.moveTo(-12, yy); ctx.lineTo(12, yy); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(-0.5, bodyY + 0.5, 10.2, 5, 0, 0, Math.PI * 2); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
    }
    poly(ctx, [-4.8, bodyY - 4.6, 4, bodyY - 4.6, 4.6, bodyY + 3, -5.4, bodyY + 3], css(s.trim ?? shade(s.body, -0.15)), OUTLINE, 0.6);
    line(ctx, -5.2, bodyY + 2.4, 4.4, bodyY + 2.4, css(0xd8b050), 0.6);
  }
}

function drawFrame(ctx: Ctx, s: FigureSpec, frame: number, tierFlaps: boolean) {
  const p = poseOf(frame);
  if (frame === FR.dead) {
    // 倒地：武器掉落一旁，坐骑跑散
    ctx.save();
    ctx.fillStyle = 'rgba(90,10,6,0.55)';
    ctx.beginPath(); ctx.ellipse(-8, 0.5, 7, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    if (s.weapon === 'spear' || s.weapon === 'staff') drawWeapon(ctx, s.weapon, -14, 3, -0.15, 0.8);
    else if (s.weapon === 'sabre' || s.weapon === 'katana' || s.weapon === 'club') drawWeapon(ctx, s.weapon, 2, 2.5, 0.2);
    else if (s.weapon === 'bow') { ctx.save(); ctx.translate(-4, 3); ctx.rotate(1.45); drawBow(ctx, 0, 0, 0, false); ctx.restore(); }
    else if (s.weapon === 'gun' || s.weapon === 'xbow') { line(ctx, -16, 3.2, 0, 2.2, OUTLINE, 2); line(ctx, -16, 3.2, 0, 2.2, css(WOOD), 1.1); }
    ctx.translate(-9, -1.5); ctx.rotate(-Math.PI / 2 + 0.08);
    drawPerson(ctx, { ...s, backFlag: null, weapon: 'none', shield: null }, { walk: NaN, atk: -1, aim: 0, bob: 0 }, { tierFlaps }, false);
    ctx.restore();
    if (s.shield) drawShield(ctx, s.shield, 4, 1, shade(s.body, -0.05));
    return;
  }
  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(s.mounted ? 0 : 0.6, 0, s.mounted ? 14 : 6.2, s.mounted ? 3.2 : 2.1, 0, 0, Math.PI * 2); ctx.fill();
  if (s.mounted) {
    drawHorse(ctx, s, frame, false);
    const g = !isNaN(p.walk);
    const bodyY = -15.5 - (g ? Math.abs(Math.sin(p.walk)) * 1.2 : 0);
    ctx.save(); ctx.translate(-0.5, bodyY - 1 + 9);
    // 骑乘者（没有步态）
    const rp: Pose = { walk: NaN, atk: p.atk, aim: p.aim, bob: g ? Math.abs(Math.sin(p.walk)) * -0.4 : 0 };
    drawPerson(ctx, s, rp, { tierFlaps }, true);
    ctx.restore();
  } else {
    drawPerson(ctx, s, p, { tierFlaps }, false);
  }
}

/** 生成一张横向精灵表 */
export function buildFigureSheet(s: FigureSpec, tierFlaps = false, res = RES): { canvas: Canvas; fw: number; fh: number; ax: number; ay: number } {
  const L = s.mounted ? RIDER : FOOT;
  const fw = L.w * res, fh = L.h * res;
  const cv = makeCanvas(fw * FRAMES, fh);
  const ctx = cv.getContext('2d')!;
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * fw + L.ax * res, L.ay * res);
    ctx.scale(res, res);
    drawFrame(ctx, s, f, tierFlaps);
    ctx.restore();
  }
  return { canvas: cv, fw, fh, ax: L.ax / L.w, ay: L.ay / L.h };
}
