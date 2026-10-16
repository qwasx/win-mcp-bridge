// 第二十一步：妖兽 / 灵宠 / 召唤物贴图
// 画材由外部 AI 绘制（单帧立绘），这里负责：异步加载 → 预生成多级缩略（防缩小时闪烁）+ 受击白剪影 →
// 代码驱动的“活”动画：呼吸、步伐起伏、蛇行摆动、振翅、鬼物飘浮、扑击前冲、受击闪白抖动。
// Node 测试环境 / 图片未就绪时 drawBeastSprite 返回 false，调用方退回原有程序绘制。
import { BeastAnim } from './beast';

type G = CanvasRenderingContext2D;
type Op = ['hue', number] | ['sat', number] | ['bri', number] | ['sep', number] | ['tint', [number, number, number], number];
/** m：动画类型。walk 走兽 · slither 蛇蛟虫 · fly 振翅 · float 鬼物飘浮 · stand 人形/直立 · swim 水族 */
type Motion = 'walk' | 'slither' | 'fly' | 'float' | 'stand' | 'swim';
export interface SprDef {
  k: string;          // 画材名（assets/beasts/<k>.webp）
  f: 1 | -1;          // 原画朝向：1=头朝右，-1=头朝左
  h: number;          // 裁边后的画面在世界中的高度（主角约 108）
  m: Motion;
  fx?: Op[];          // 加载时一次性调色（同一张画衍生近缘妖兽）
  a?: number;         // 整体不透明度（鬼物）
  glow?: string;      // 叠加辉光色
}

// ---------------------------------------------------------------- 登记表
// 高度依据：原程序妖兽的包围盒 + 原著体型（化形大妖 / 妖王明显高于人），并用 tools/beastlineup.ts 与主角并排校准
const S: Record<string, SprDef> = {
  // —— 炼气 · 一级
  'e:wolf': { k: 'wolf', f: 1, h: 74, m: 'walk' },
  'e:redwolf': { k: 'redwolf', f: 1, h: 88, m: 'walk' },
  'e:boar': { k: 'boar', f: -1, h: 84, m: 'walk' },
  'e:greensnake': { k: 'venomous_snake', f: -1, h: 62, m: 'slither' },
  'e:spider': { k: 'spider', f: 1, h: 62, m: 'walk' },
  'e:hawk': { k: 'qingfeng', f: -1, h: 88, m: 'fly', fx: [['sep', 0.75], ['bri', 0.95]] },
  'e:fox': { k: 'chitong', f: -1, h: 74, m: 'walk' },
  'e:steppewolf': { k: 'wolf', f: 1, h: 80, m: 'walk', fx: [['sep', 0.55], ['bri', 1.06]] },
  'e:heilin': { k: 'dujiao', f: -1, h: 78, m: 'slither', fx: [['sat', 0.35], ['bri', 0.8]] },
  'e:bloodbat': { k: 'bloodbat', f: -1, h: 74, m: 'fly' },
  // —— 筑基 · 二至四级
  'e:snowwolf': { k: 'snow_wolf', f: 1, h: 100, m: 'walk' },
  'e:icebear': { k: 'snow_ape', f: -1, h: 128, m: 'stand' },
  'e:sandscorp': { k: 'sand_scorpion', f: -1, h: 88, m: 'walk' },
  'e:seaturtle': { k: 'seaturtle', f: 1, h: 76, m: 'walk' },
  'e:seaserpent': { k: 'lightning_eel', f: -1, h: 116, m: 'swim' },
  'e:yinhun': { k: 'yinhun', f: 1, h: 84, m: 'float', a: 0.88 },
  'e:firetiger': { k: 'lynx', f: -1, h: 112, m: 'walk', fx: [['hue', -22], ['sat', 1.35], ['bri', 1.02]] },
  'e:python': { k: 'python', f: 1, h: 104, m: 'slither' },
  'e:ironape': { k: 'mtn_ape', f: -1, h: 118, m: 'walk' },
  'e:facespider': { k: 'ghost_face_spider', f: 1, h: 82, m: 'walk' },
  'e:centipede': { k: 'centipede', f: -1, h: 84, m: 'slither' },
  'e:guijiang': { k: 'guijiang', f: 1, h: 148, m: 'float', a: 0.94 },
  'e:yunchi': { k: 'pet_crane', f: 1, h: 96, m: 'fly' },
  'e:yuanjiu': { k: 'vulture', f: -1, h: 104, m: 'fly' },
  'e:yingyuan': { k: 'qingfeng', f: -1, h: 112, m: 'fly', fx: [['sep', 0.85], ['bri', 0.72]] },
  'e:zhijiao': { k: 'amb_deer', f: 1, h: 96, m: 'walk', fx: [['tint', [196, 120, 70], 0.45], ['sat', 1.2]] },
  'e:bishui': { k: 'swamp_croc', f: -1, h: 92, m: 'swim' },
  'e:tunhai': { k: 'spirit_fish', f: -1, h: 90, m: 'swim' },
  'e:heixiong': { k: 'blackbear', f: 1, h: 138, m: 'stand' },
  'e:jinwenbao': { k: 'lynx', f: -1, h: 84, m: 'walk' },
  'e:zhangchan': { k: 'miasma_toad', f: -1, h: 78, m: 'walk' },
  'e:tiejiaxie': { k: 'iron_crab', f: 1, h: 66, m: 'walk' },
  'e:baigu': { k: 'baigu_ske', f: 1, h: 112, m: 'stand' },
  'e:bingcan': { k: 'ice_worm', f: -1, h: 80, m: 'slither' },
  'e:shanhu': { k: 'coral_golem', f: 1, h: 136, m: 'stand' },
  'e:jinbeiyao': { k: 'jinbeiyao', f: -1, h: 96, m: 'walk' },
  'e:bazhua': { k: 'baize_fish', f: 1, h: 112, m: 'swim' },
  'e:yinsha': { k: 'heisha_guard', f: 1, h: 120, m: 'float', a: 0.9 },
  // —— 结丹 · 五至七级
  'e:firejiao': { k: 'yinjiao', f: -1, h: 168, m: 'slither', fx: [['hue', -8], ['sat', 1.35]] },
  'e:xuexian': { k: 'yinjiao', f: -1, h: 140, m: 'slither', fx: [['hue', -28], ['sat', 1.15], ['bri', 0.72]] },
  'e:ziyun': { k: 'qingfeng', f: -1, h: 124, m: 'fly', fx: [['hue', 80], ['sat', 1.1]] },
  'e:qingguang': { k: 'qingfeng', f: -1, h: 138, m: 'fly' },
  'e:xuehou': { k: 'icebear', f: -1, h: 138, m: 'walk' },
  'e:hanmei': { k: 'ghost_jellyfish', f: 1, h: 108, m: 'float', a: 0.9 },
  'e:wohu': { k: 'huajing_shark', f: -1, h: 146, m: 'swim' },
  'e:jiguan': { k: 'jiguan', f: 1, h: 166, m: 'slither' },
  'e:qingfeng': { k: 'amb_ox', f: 1, h: 124, m: 'walk', fx: [['tint', [70, 140, 130], 0.55], ['sat', 1.15]] },
  'e:bingning': { k: 'lynx', f: -1, h: 132, m: 'walk', fx: [['sat', 0.25], ['tint', [196, 214, 230], 0.35], ['bri', 1.12]] },
  'e:tiechi': { k: 'qingfeng', f: -1, h: 170, m: 'fly', fx: [['sat', 0.2], ['bri', 0.62]] },
  'e:tujia': { k: 'tujia', f: 1, h: 100, m: 'walk' },
  'e:huochan': { k: 'huochan', f: 1, h: 86, m: 'walk' },
  'e:mangshou': { k: 'mangshou', f: -1, h: 104, m: 'walk' },
  'e:canhun': { k: 'yinhun', f: 1, h: 90, m: 'float', a: 0.8, fx: [['sat', 0.25], ['bri', 0.85]] },
  'e:yuanhun': { k: 'yinhun', f: 1, h: 96, m: 'float', a: 0.84, fx: [['sat', 0.4], ['tint', [120, 140, 200], 0.4]] },
  'e:shilang': { k: 'tiebei', f: -1, h: 104, m: 'walk' },
  'e:lianshi': { k: 'zombie', f: 1, h: 126, m: 'stand' },
  'e:shixiong': { k: 'devil_corpse', f: -1, h: 172, m: 'walk' },
  'e:xuangui': { k: 'xuangui', f: -1, h: 128, m: 'walk' },
  'e:biyanjiao': { k: 'biyan', f: -1, h: 150, m: 'slither' },
  'e:baigujun': { k: 'baigu_king', f: 1, h: 150, m: 'stand' },
  'e:feitianshi': { k: 'feitian_zombie', f: 1, h: 124, m: 'float' },
  'e:zhenmo': { k: 'true_demon', f: 1, h: 176, m: 'stand' },
  'e:shikui': { k: 'stone_puppet', f: 1, h: 132, m: 'stand' },
  'e:jinkui': { k: 'gold_puppet', f: -1, h: 96, m: 'walk' },
  'e:xuekui': { k: 'blood_puppet', f: 1, h: 130, m: 'stand' },
  'e:qinglinjiao': { k: 'fushou', f: -1, h: 172, m: 'slither' },
  // —— 元婴 · 八至十级 / 名地之主
  'e:mojiao': { k: 'mojiao', f: 1, h: 150, m: 'slither' },
  'e:gumo_xueyan': { k: 'gumo_xueyan', f: 1, h: 370, m: 'float', glow: '255,60,40' },
  'e:yinchi': { k: 'yinchi', f: 1, h: 210, m: 'fly' },
  'e:dujiao': { k: 'dujiao', f: -1, h: 250, m: 'slither' },
  'e:shuanggong': { k: 'shuanggong', f: 1, h: 200, m: 'fly' },
  'e:fengxi': { k: 'fengxi', f: 1, h: 290, m: 'fly' },
  'e:mo_soul': { k: 'mo_soul', f: 1, h: 124, m: 'float', a: 0.9 },
  'e:yu_soul': { k: 'yu_soul', f: 1, h: 112, m: 'float', a: 0.9 },
  // —— 灵宠（高度为满级时，实际乘以等级系数）
  'p:huli1': { k: 'pet_fox1', f: 1, h: 66, m: 'walk' },
  'p:huli2': { k: 'pet_fox2', f: 1, h: 70, m: 'walk' },
  'p:huli3': { k: 'pet_fox3', f: 1, h: 74, m: 'walk' },
  'p:wolf': { k: 'pet_wolf', f: 1, h: 80, m: 'walk' },
  'p:yunchi': { k: 'pet_crane', f: 1, h: 92, m: 'fly' },
  'p:jiao': { k: 'mojiao', f: 1, h: 66, m: 'slither' },
  // —— 召唤物
  's:fox': { k: 'pet_fox2', f: 1, h: 64, m: 'walk', glow: '200,230,255' },
  's:puppet': { k: 'sum_puppet', f: 1, h: 112, m: 'stand' },
  's:tihun': { k: 'sum_tihun', f: 1, h: 100, m: 'walk', glow: '200,160,255' },
  's:demon': { k: 'sum_motou', f: 1, h: 88, m: 'float', glow: '255,80,60' },
  's:jiao': { k: 'sum_qingjiao', f: 1, h: 118, m: 'slither', glow: '120,240,180' },
};
export const BEAST_SPR = S;

// ---------------------------------------------------------------- 加载
interface Prep { mips: HTMLCanvasElement[]; white: HTMLCanvasElement; w: number; h: number }
let src: Record<string, HTMLImageElement> | null = null;
let started = false;
const preps = new Map<string, Prep>();
const queue: string[] = [];
const queued = new Set<string>();
let frameBudgetT = -1, frameBudget = 0;

export function loadBeastTex() {
  if (started || typeof Image === 'undefined' || typeof document === 'undefined') return;
  started = true;
  import('./beastTexData').then(({ BEAST_SRC }) => {
    const out: Record<string, HTMLImageElement> = {};
    const keys = Object.keys(BEAST_SRC);
    let left = keys.length;
    for (const k of keys) {
      const im = new Image();
      im.onload = () => { out[k] = im; if (--left === 0) src = out; };
      im.onerror = () => { console.warn('妖兽画材加载失败', k); if (--left === 0) src = out; };
      im.src = BEAST_SRC[k];
    }
  }).catch((e) => console.warn('妖兽画材不可用', e));
}

function matOf(ops: Op[]): number[] {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mul = (A: number[], B: number[]) => { const R = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) R[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return R; };
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  for (const op of ops) {
    let N: number[];
    if (op[0] === 'sat') { const s = op[1]; N = [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s), lr * (1 - s), lg * (1 - s) + s, lb * (1 - s), lr * (1 - s), lg * (1 - s), lb * (1 - s) + s]; }
    else if (op[0] === 'bri') { const b = op[1]; N = [b, 0, 0, 0, b, 0, 0, 0, b]; }
    else if (op[0] === 'sep') { const a = op[1], S0 = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131]; N = S0.map((v, i) => v * a + ((i % 4 === 0) ? 1 - a : 0)); }
    else if (op[0] === 'hue') {
      const r = op[1] * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      N = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
    } else { const col = op[1], k = op[2]; N = []; for (let i = 0; i < 3; i++) { const ci = col[i] / 128 * k; N.push((i === 0 ? 1 - k : 0) + ci * lr, (i === 1 ? 1 - k : 0) + ci * lg, (i === 2 ? 1 - k : 0) + ci * lb); } }
    M = mul(N, M);
  }
  return M;
}

function prepare(def: SprDef): Prep | null {
  const im = src?.[def.k]; if (!im || !im.width) return null;
  const W = im.width, H = im.height;
  const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
  const x0 = c0.getContext('2d')!; x0.drawImage(im, 0, 0);
  if (def.fx?.length) {
    const M = matOf(def.fx), id = x0.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = M[0] * r + M[1] * g + M[2] * b; d[i + 1] = M[3] * r + M[4] * g + M[5] * b; d[i + 2] = M[6] * r + M[7] * g + M[8] * b;
    }
    x0.putImageData(id, 0, 0);
  }
  const mips = [c0];
  let prev = c0;
  for (let l = 1; l < 3; l++) {
    const w = Math.max(1, Math.round(prev.width / 2)), h = Math.max(1, Math.round(prev.height / 2));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; (x as any).imageSmoothingQuality = 'high';
    x.drawImage(prev, 0, 0, w, h); mips.push(c); prev = c;
  }
  const m1 = mips[1], wc = document.createElement('canvas'); wc.width = m1.width; wc.height = m1.height;
  const wx = wc.getContext('2d')!; wx.drawImage(m1, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#fff8ec'; wx.fillRect(0, 0, wc.width, wc.height);
  return { mips, white: wc, w: W, h: H };
}

function getPrep(key: string, t: number): Prep | null {
  const p = preps.get(key); if (p) return p;
  if (!src) return null;
  const def = S[key]; if (!def) return null;
  // 每帧至多现做两张（调色要逐像素处理），其余排队，避免一群新妖兽同时入画时卡顿
  if (frameBudgetT !== t) { frameBudgetT = t; frameBudget = 2; }
  if (frameBudget <= 0) { if (!queued.has(key)) { queued.add(key); queue.push(key); } return null; }
  frameBudget--;
  const r = prepare(def);
  if (r) preps.set(key, r);
  queued.delete(key);
  return r;
}

/** 空闲时预热（进入区域前把可能出现的妖兽先备好） */
export function warmBeastTex(keys: string[]) { for (const k of keys) if (S[k] && !preps.has(k) && !queued.has(k)) { queued.add(k); queue.push(k); } }
export function pumpBeastTex() { if (!src) return; let n = 1; while (n-- > 0 && queue.length) { const k = queue.shift()!; queued.delete(k); if (!preps.has(k)) { const r = prepare(S[k]); if (r) preps.set(k, r); } } }

export function hasBeastSprite(key: string) { return !!S[key]; }
/** 贴图妖兽的头顶高度（血条、受击特效定位用）；无贴图返回 0 */
export function beastSpriteTop(key: string, flying: boolean, scale = 1): number {
  const d = S[key]; if (!d) return 0;
  return d.h * scale + (flying ? 70 : d.m === 'float' ? 14 : 0);
}

// ---------------------------------------------------------------- 绘制
/**
 * 画一只贴图妖兽。锚点为脚底中心（与 drawBeast 一致）。
 * facing：1=朝右；A：同 drawBeast 的动画状态；scale：整体缩放（灵宠按等级）。
 */
export function drawBeastSprite(g: G, key: string, x: number, y: number, facing: number, A: BeastAnim, scale = 1): boolean {
  const def = S[key]; if (!def) return false;
  const P = getPrep(key, A.t);
  if (!P) return false;
  const t = A.t, mv = A.move || 0, atk = A.atk || 0, hit = A.hit || 0;
  const H = def.h * scale, Wd = H * P.w / P.h;
  const air = !!A.flying;
  const alt = air ? 70 + Math.sin(t * 2) * 8 : def.m === 'float' ? 12 + Math.sin(t * 1.6) * 3 : 0;

  // 地面投影：贴地者实而小，飞空者淡而散
  g.save();
  const rx = Math.max(16, Wd * (def.m === 'slither' || def.m === 'swim' ? 0.4 : 0.34)) * (air ? 0.7 : 1);
  g.fillStyle = `rgba(28,26,20,${air ? 0.13 : 0.24})`;
  g.beginPath(); g.ellipse(x, y + 2, rx, rx * (air ? 0.26 : 0.24), 0, 0, Math.PI * 2); g.fill();
  if (air) { g.fillStyle = 'rgba(28,26,20,0.08)'; g.beginPath(); g.ellipse(x, y + 2, rx * 1.5, rx * 0.4, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();

  // 动画参数
  let sx = 1, sy = 1, rot = 0, skew = 0, dx = 0, dy = -alt;
  const ph = A.phase || 0;
  const breathe = Math.sin(t * 2.2 + x * 0.01);
  switch (def.m) {
    case 'walk':
      sy *= 1 + 0.016 * breathe * (1 - mv);
      dy -= Math.abs(Math.sin(ph)) * H * 0.028 * mv;
      rot += Math.sin(ph * 2) * 0.03 * mv;
      skew += Math.sin(ph) * 0.025 * mv;
      break;
    case 'slither': case 'swim':
      skew += Math.sin(t * (1.6 + mv * 2.4) + x * 0.02) * (0.045 + 0.04 * mv);
      sx *= 1 + Math.sin(t * 1.7) * 0.014;
      sy *= 1 + 0.02 * breathe;
      break;
    case 'fly': {
      const fl = Math.sin(t * (5 + mv * 3));
      sy *= 1 + fl * 0.045; sx *= 1 - fl * 0.015;
      rot += Math.sin(t * 1.3) * 0.04 + mv * 0.05;
      break;
    }
    case 'float':
      dy += Math.sin(t * 1.6) * 6;
      skew += Math.sin(t * 1.1 + x * 0.01) * 0.05;
      sy *= 1 + 0.025 * breathe;
      break;
    case 'stand':
      sy *= 1 + 0.014 * breathe;
      dy -= Math.abs(Math.sin(ph)) * H * 0.02 * mv;
      rot += Math.sin(ph) * 0.035 * mv;
      break;
  }
  // 扑击：前冲 + 微放大 + 前倾
  if (atk > 0) { const k = Math.sin(Math.min(1, atk) * Math.PI); dx += k * Wd * 0.12; sx *= 1 + k * 0.04; sy *= 1 + k * 0.04; rot += -k * 0.06; }
  // 受击：后挫抖动
  if (hit > 0) { dx -= hit * 8; dy += Math.sin(t * 60) * hit * 2; }

  // 选多级缩略：屏幕上的像素高度
  let screenK = 1;
  try { const m = g.getTransform(); screenK = Math.hypot(m.a, m.b) || 1; } catch { /* 无 getTransform 时按 1 */ }
  const px = H * screenK;
  let mip = P.mips[0];
  if (px < P.h * 0.27) mip = P.mips[2]; else if (px < P.h * 0.55) mip = P.mips[1];

  g.save();
  // 局部坐标：+x 恒为妖兽前方；旋转 / 斜切都以脚底为轴，脚始终“踩”在地上
  g.translate(x, y + dy);
  g.scale(facing < 0 ? -1 : 1, 1);
  g.translate(dx, 0);
  if (rot) g.rotate(rot);
  if (skew) g.transform(1, 0, -skew, 1, 0, 0);
  g.scale(sx * def.f, sy);
  if (def.a != null) g.globalAlpha *= def.a;
  g.drawImage(mip, -Wd / 2, -H, Wd, H);
  if (def.glow) {
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, -H * 0.5, 0, 0, -H * 0.5, H * 0.62);
    const a = 0.10 + 0.04 * Math.sin(t * 2.4);
    gr.addColorStop(0, `rgba(${def.glow},${a})`); gr.addColorStop(1, `rgba(${def.glow},0)`);
    g.fillStyle = gr; g.fillRect(-H * 0.62, -H * 1.12, H * 1.24, H * 1.24);
    g.globalCompositeOperation = 'source-over';
  }
  if (hit > 0.02) { g.globalAlpha *= Math.min(1, hit) * 0.65; g.drawImage(P.white, -Wd / 2, -H, Wd, H); }
  g.restore();
  return true;
}

/** 离线工具用：直接注入已解码的图片（tools/beastlineup.ts） */
export function __injectBeastImages(m: Record<string, HTMLImageElement>) { src = m; started = true; }
