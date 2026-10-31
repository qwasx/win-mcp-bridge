// 代码绘制的人物（人物重做）
//  · 男女共用一套 3D 骨骼、动作、布料物理与分件绘制；脸（五官）、头型、身材、服饰全部是参数（gfx/renwu/*）。
//  · 换衣系统：衣裳 = 款式（领 / 袖 / 下裳 / 外罩 / 纹样）+ 染色；NPC 按身份挑衣裳，玩家在「衣橱」里换。
//  · 手：掌 + 五指 3D 骨架，12 种手势平滑过渡；手腕可用 IK 摆到指定位置（负手、交手、剑诀当胸、法诀）。
//    施法四式（剑指 / 推掌 / 掐诀 / 托天）：蓄 → 发（带过冲）→ 运劲微颤，指尖劲气 + 出手残影。
//  · 工笔画风：同色系描线、柔和明暗、领缘 / 袖口 / 下摆镶边与纹样；细节按屏幕像素分级（远景省掉手指、五官细节）。
import { shade as shade0, rgba as rgba0 } from '../core/canvas';
import { headTex, headTexReady, type HeadView } from './headTex';
import { drawArt } from './artifact';
import { artLook } from '../data/artlooks';
import type { Look, Gesture } from './renwu/types';
import { resolveLook, type RLook } from './renwu/params';
import { GESTURES, G_N, drawHand, armHandFrame, aimHandFrame, blendFrame, PALM_L, type HandFrame } from './renwu/hand';
import { headHullPts, drawFace, drawBeard, type FaceCtx } from './renwu/face';
import { OUTFIT_BY_ID, ROLE_OUTFITS, applyOutfit, type NpcRole } from './renwu/outfits';

export type { Look, Sex, HairStyle, Fringe, FaceParams, HeadParams, BodyParams, Gesture, IdleStyle, EyeShape, BrowShape } from './renwu/types';
export type { NpcRole, Wardrobe, Outfit, Dye } from './renwu/outfits';
export { OUTFITS, OUTFIT_BY_ID, outfitsFor, applyOutfit, dressLook, DEFAULT_WARDROBE, HAIR_COLORS, SKIN_COLORS, HAIR_NAMES, IDLE_NAMES } from './renwu/outfits';
export { FACE_SLIDERS, HEAD_SLIDERS, BODY_SLIDERS, EYE_NAMES, BROW_NAMES, FRINGE_NAMES, genFace, genHead, genBody, defaultFace, defaultHead, defaultBody, resolveLook } from './renwu/params';
export { GESTURES, GESTURE_NAMES } from './renwu/hand';

// 颜色运算缓存（人群里每帧要算上千次）
const SHC = new Map<string, string>();
function shade(c: string, k: number) { const key = c + '|' + k; let r = SHC.get(key); if (r === undefined) { r = shade0(c, k); if (SHC.size > 6000) SHC.clear(); SHC.set(key, r); } return r; }
function rgba(c: string, a: number) { const key = c + '@' + a; let r = SHC.get(key); if (r === undefined) { r = rgba0(c, a); if (SHC.size > 6000) SHC.clear(); SHC.set(key, r); } return r; }
const inkOf = (c: string) => rgba(shade(c, -0.62), 0.92);

export type Action = 'idle' | 'walk' | 'run' | 'fly' | 'sit' | 'cast' | 'hit' | 'dodge' | 'gather';
export const ACTION_NAMES: Record<Action, string> = {
  idle: '待机', walk: '行走', run: '奔跑', fly: '御剑', sit: '打坐', cast: '施法', hit: '受击', dodge: '闪避', gather: '采集',
};

export const HANLI_LOOK: Look = applyOutfit({
  sex: 'm', height: 1, build: 1, skin: '#f1d9bd', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#3f6a4c', inner: '#ece6d6', trim: '#2b4636', belt: '#1f2420', pants: '#8a7a62', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', ribbon: '#2a3a30', back: 'none', waist: 'pouch', hand: 'none',
  swordColor: '#7ff0c0', hero: true, idle: 'behind',
  face: { eye: 'narrow', eyeSize: 0.97, eyeTilt: 0.12, brow: 'sword', browW: 1.0, smile: 0.05, blush: 0.1, iris: '#3a2a1e' },
  head: { jaw: 0.4, cheek: 0.12 }, body: {},
}, 'qingshan', 0);

// ---------------------------------------------------------------- 姿态
export interface Pose {
  rootY: number; rootX: number; rootZ: number;
  lean: number; side: number; twist: number;
  /** 腾空（贴地之后再整体抬起，用于奔跑的腾空期） */
  air: number;
  headPitch: number; headYaw: number; breath: number;
  lSh: number; lShR: number; lEl: number; lFr: number;
  rSh: number; rShR: number; rEl: number; rFr: number;
  lHip: number; lHipR: number; lKn: number;
  rHip: number; rHipR: number; rKn: number;
  lFoot: number; rFoot: number;
  sit: number; eyes: number; ground: number;
  /** 手腕 IK：权重 + 目标（躯干坐标，x 以该手一侧为正）+ 指向 + 掌心朝向 */
  lIK: number; lTx: number; lTy: number; lTz: number; lAx: number; lAy: number; lAz: number; lNx: number; lNy: number; lNz: number;
  rIK: number; rTx: number; rTy: number; rTz: number; rAx: number; rAy: number; rAz: number; rNx: number; rNy: number; rNz: number;
  /** 前臂旋后（掌心朝上/朝前为正）、腕屈（向掌心为正） */
  lSup: number; rSup: number; lWb: number; rWb: number;
  /** 劲气（出手发力的强度）、张口 */
  lFx: number; rFx: number; mouth: number;
  lG: Gesture; rG: Gesture;
}
const POSE_KEYS: (keyof Pose)[] = ['rootY', 'rootX', 'rootZ', 'lean', 'side', 'twist', 'air', 'headPitch', 'headYaw', 'breath',
  'lSh', 'lShR', 'lEl', 'lFr', 'rSh', 'rShR', 'rEl', 'rFr', 'lHip', 'lHipR', 'lKn', 'rHip', 'rHipR', 'rKn', 'lFoot', 'rFoot', 'sit', 'eyes', 'ground',
  'lIK', 'lTx', 'lTy', 'lTz', 'lAx', 'lAy', 'lAz', 'lNx', 'lNy', 'lNz', 'rIK', 'rTx', 'rTy', 'rTz', 'rAx', 'rAy', 'rAz', 'rNx', 'rNy', 'rNz',
  'lSup', 'rSup', 'lWb', 'rWb', 'lFx', 'rFx', 'mouth'];

function neutral(): Pose {
  return {
    rootY: 0, rootX: 0, rootZ: 0, lean: 0.02, side: 0, twist: 0, air: 0, headPitch: 0, headYaw: 0, breath: 0,
    lSh: 0.05, lShR: 0.11, lEl: 0.26, lFr: 0.06, rSh: 0.05, rShR: 0.11, rEl: 0.26, rFr: 0.06,
    lHip: 0, lHipR: 0.035, lKn: 0.05, rHip: 0, rHipR: 0.035, rKn: 0.05, lFoot: 0, rFoot: 0,
    sit: 0, eyes: 1, ground: 1,
    lIK: 0, lTx: 0, lTy: 0, lTz: 0, lAx: 0, lAy: 0, lAz: 0, lNx: 0, lNy: 0, lNz: 0,
    rIK: 0, rTx: 0, rTy: 0, rTz: 0, rAx: 0, rAy: 0, rAz: 0, rNx: 0, rNy: 0, rNz: 0,
    lSup: -0.15, rSup: -0.15, lWb: 0.1, rWb: 0.1, lFx: 0, rFx: 0, mouth: 0, lG: 'relax', rG: 'relax',
  };
}
type T3 = [number, number, number];
/** 手腕 IK（躯干坐标：x 以该手一侧为正——自动左右镜像；y 相对胸口向上；z 向前） */
function ik(p: Pose, side: 1 | -1, w: number, t: T3, aim: T3, palm: T3, g?: Gesture) {
  if (side > 0) { p.lIK = w; [p.lTx, p.lTy, p.lTz] = t; [p.lAx, p.lAy, p.lAz] = aim; [p.lNx, p.lNy, p.lNz] = palm; if (g) p.lG = g; }
  else { p.rIK = w; [p.rTx, p.rTy, p.rTz] = t; [p.rAx, p.rAy, p.rAz] = aim; [p.rNx, p.rNy, p.rNz] = palm; if (g) p.rG = g; }
}

// ---------------------------------------------------------------- 布料
class Strand {
  x: Float32Array; y: Float32Array; ox: Float32Array; oy: Float32Array; n: number; len: number; inited = false;
  constructor(n: number, len: number) {
    this.n = n; this.len = len;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.ox = new Float32Array(n); this.oy = new Float32Array(n);
  }
  reset(ax: number, ay: number, dx = 0, dy = 1) {
    for (let i = 0; i < this.n; i++) { this.x[i] = this.ox[i] = ax + dx * this.len * i; this.y[i] = this.oy[i] = ay + dy * this.len * i; }
    this.inited = true;
  }
  step(ax: number, ay: number, dt: number, gx: number, gy: number, wx: number, wy: number, drag: number, len: number) {
    this.len = len;
    if (!this.inited || Math.abs(ax - this.x[0]) > len * 30 || Math.abs(ay - this.y[0]) > len * 30) this.reset(ax, ay);
    const n = this.n;
    this.x[0] = ax; this.y[0] = ay;
    if (dt <= 0) return;
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < n; i++) {
        const vx = (this.x[i] - this.ox[i]) / h, vy = (this.y[i] - this.oy[i]) / h;
        const k = i / (n - 1);
        const ax2 = gx + (wx - vx) * drag * (0.4 + k * 0.6), ay2 = gy + (wy - vy) * drag * (0.4 + k * 0.6);
        this.ox[i] = this.x[i]; this.oy[i] = this.y[i];
        this.x[i] += vx * h * 0.985 + ax2 * h * h;
        this.y[i] += vy * h * 0.985 + ay2 * h * h;
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < n; i++) {
          const dx = this.x[i] - this.x[i - 1], dy = this.y[i] - this.y[i - 1];
          const d = Math.hypot(dx, dy) || 1e-4;
          const diff = (d - len) / d;
          if (i === 1) { this.x[i] -= dx * diff; this.y[i] -= dy * diff; }
          else {
            this.x[i] -= dx * diff * 0.5; this.y[i] -= dy * diff * 0.5;
            this.x[i - 1] += dx * diff * 0.5; this.y[i - 1] += dy * diff * 0.5;
          }
        }
        this.x[0] = ax; this.y[0] = ay;
      }
    }
  }
}

class Spring {
  x = 0; y = 0; vx = 0; vy = 0; inited = false;
  step(tx: number, ty: number, dt: number, k: number, c: number) {
    if (!this.inited || Math.abs(tx - this.x) > 400 || Math.abs(ty - this.y) > 400) { this.x = tx; this.y = ty; this.vx = this.vy = 0; this.inited = true; return; }
    if (dt <= 0) return;
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vx += ((tx - this.x) * k - this.vx * c) * h;
      this.vy += ((ty - this.y) * k - this.vy * c) * h;
      this.x += this.vx * h; this.y += this.vy * h;
    }
  }
}

// ---------------------------------------------------------------- 角色状态
export class CharState {
  x = 0; y = 0;
  yaw = 0; targetYaw = 0;
  action: Action = 'idle';
  actionT = 0;
  phase = 0;
  speed = 0; vx = 0; vy = 0;
  lift = 0;
  t = Math.random() * 100;
  seed = Math.random() * 1000;
  blend = 1;
  from: Pose | null = null;
  last: Pose | null = null;
  strands = new Map<string, Strand>();
  springs = new Map<string, Spring>();
  windX = 0; windY = 0;
  /** 两只手当前的指节角度（向目标手势平滑过渡） */
  hands: [Float32Array, Float32Array] = [GESTURES.relax.slice(), GESTURES.relax.slice()];
  handInit = false;
  /** 第几次出手（轮换施法四式） */
  castN = 0;
  /** 上一帧手的位置（相对脚底，画出手残影） */
  hp: [number, number, number, number] = [NaN, NaN, NaN, NaN];
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  setAction(a: Action) {
    if (a === this.action) return;
    this.from = this.last ? { ...this.last } : null;
    this.blend = 0;
    this.action = a; this.actionT = 0;
    if (a === 'cast') this.castN++;
  }
  /** 根据移动向量设置朝向（8 方向），dx/dy 为地图方向 */
  faceToward(dx: number, dy: number, eight = true) {
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    let a = Math.atan2(dx, dy);
    if (eight) a = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    this.targetYaw = a;
  }
  update(dt: number) {
    this.t += dt; this.actionT += dt;
    this.blend = Math.min(1, this.blend + dt / 0.16);
    let d = this.targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.min(1, dt * 11);
    this.yaw += d * turn;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    if (this.action === 'walk') this.phase += dt * (3.2 + this.speed * 0.028);
    else if (this.action === 'run') this.phase += dt * (6.5 + this.speed * 0.012);
    else this.phase += dt * 1.2;
  }
}

// ---------------------------------------------------------------- 体型尺寸
interface Dims { sw: number; hw: number; ww: number; td: number; hk: number; torsoL: number; upL: number; foL: number; thL: number; shL: number; handK: number }
const DIMS = new WeakMap<RLook, Dims>();
function dimsOf(look: Look, R: RLook): Dims {
  let d = DIMS.get(R);
  if (d) return d;
  const f = R.fem, B = R.body;
  d = {
    sw: (f ? 6.8 : 8.5) * look.build * B.shoulder,
    hw: (f ? 7.4 : 6.9) * B.hip * (0.9 + 0.1 * B.heft),
    ww: (f ? 4.9 : 6.3) * B.waist * (0.72 + 0.28 * B.heft),
    td: (f ? 4.4 : 5.2) * (0.8 + 0.2 * B.heft),
    hk: (f ? 1.0 : 1.05) * R.head.size,
    torsoL: f ? 20.4 : 21.4,
    upL: 13.6 * B.arm, foL: 11.4 * B.arm,
    thL: 22.8 * B.leg, shL: 21.8 * B.leg,
    handK: (f ? 0.84 : 0.97) * (0.94 + 0.06 * B.heft),
  };
  DIMS.set(R, d);
  return d;
}

// ---------------------------------------------------------------- 动作 → 姿态
function smooth01(t: number) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function backOut(t: number) { t = Math.max(0, Math.min(1, t)); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 待机 / 行走时的手：负手、交手、当胸（权重 w 便于行走时减弱） */
function idleHands(p: Pose, R: RLook, D: Dims, look: Look, w = 1) {
  const td = D.td;
  const behind = (side: 1 | -1, k = 1) => ik(p, side, w * k, [-1.7, -15.4, -(td + 2.7)], [-1, -0.3, -0.1], [0.1, 0.15, -1], side > 0 ? 'relax' : 'fist');
  if (look.hand === 'staff') {
    p.rSh = 0.16; p.rShR = 0.26; p.rEl = 0.78; p.rFr = 0; p.rSup = 0.05; p.rWb = 0.05; p.rG = 'grip';
    if (R.idle === 'behind') behind(1);
    return;
  }
  if (look.hand === 'fan') {
    ik(p, -1, w, [0.6, -5.5, td + 3.6], [-0.25, 0.8, 0.5], [-1, 0.1, 0.25], 'grip');
    if (R.idle === 'behind' || !R.fem) behind(1, 0.9);
    return;
  }
  if (R.idle === 'behind') { behind(1); if (R.old > 0.5) behind(-1, 1); }
  else if (R.idle === 'clasp') {
    ik(p, 1, w, [-0.8, -14.0, td + 1.5], [-0.9, -0.45, 0.12], [0, 0.15, -1], 'relax');
    ik(p, -1, w, [-0.2, -13.2, td + 2.3], [-0.9, -0.4, 0.18], [0, 0.1, -1], 'relax');
  } else if (R.idle === 'chest') {
    if (R.fem) {
      ik(p, -1, w, [-1.2, -4.8, td + 3.1], [-0.25, 0.9, 0.35], [-1, 0, 0.3], 'lotus');
      ik(p, 1, w, [-0.9, -14.0, td + 1.6], [-0.9, -0.45, 0.12], [0, 0.15, -1], 'relax');
    } else {
      ik(p, -1, w, [-1.6, -6.2, td + 3.0], [-1, 0.1, 0.25], [0, -0.3, -1], 'relax');
      behind(1);
    }
  }
}

/** 主角 / 所有人共用的奔跑：高抬膝、腾空、肩髋反向扭转、屈肘摆臂 */
function runPose(p: Pose, st: CharState, R: RLook) {
  const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
  const sp = Math.min(1.25, Math.max(0.7, st.speed / 260)) * (R.fem ? 0.88 : 1);
  const hipL = 0.14 + (s > 0 ? 0.68 : 0.5) * s * sp, hipR = 0.14 - (s < 0 ? 0.68 : 0.5) * s * sp;
  p.lHip = hipL; p.rHip = hipR;
  const fold = (k: number) => Math.pow(Math.max(0, k), 1.3);
  const reach = (sn: number, cs: number) => 0.62 * Math.pow(Math.max(0, sn), 2) * (0.5 + 0.5 * Math.max(-1, Math.min(1, cs * 3)));
  p.lKn = 0.26 + 1.7 * fold(Math.cos(ph + 0.2)) * sp + reach(s, c); p.rKn = 0.26 + 1.7 * fold(-Math.cos(ph + 0.2)) * sp + reach(-s, -c);
  p.lKn += 0.2 * Math.max(0, 1 - Math.abs(hipL - 0.05) * 3) * (c < 0 ? 1 : 0);
  p.rKn += 0.2 * Math.max(0, 1 - Math.abs(hipR - 0.05) * 3) * (c > 0 ? 1 : 0);
  p.lFoot = -0.55 * Math.max(0, -s) + 0.15 * Math.max(0, s); p.rFoot = -0.55 * Math.max(0, s) + 0.15 * Math.max(0, -s);
  p.lHipR = 0.06; p.rHipR = 0.06;
  p.lSh = -0.78 * s * sp + 0.05; p.rSh = 0.78 * s * sp + 0.05;
  p.lEl = 1.05 + 0.45 * Math.max(0, -s); p.rEl = 1.05 + 0.45 * Math.max(0, s);
  p.lShR = 0.24; p.rShR = 0.24; p.lFr = -0.2; p.rFr = -0.2;
  p.lSup = 0.1; p.rSup = 0.1; p.lWb = -0.1 + 0.25 * c; p.rWb = -0.1 - 0.25 * c;
  p.lG = p.rG = R.fem ? 'palm' : 'fist';
  p.lean = 0.33 + 0.035 * Math.cos(ph * 2) + 0.04 * (sp - 1);
  p.twist = 0.2 * s; p.side = 0.035 * c;
  p.headPitch = -0.16; p.headYaw = -0.05 * s;
  p.breath = 0.4 * Math.sin(ph * 2);
  p.air = 2.2 * Math.pow(Math.abs(s), 2.2) * sp;
}

function poseFor(st: CharState, look: Look, R: RLook): Pose {
  const p = neutral();
  const D = dimsOf(look, R);
  const t = st.t, a = st.action, at = st.actionT, fem = R.fem, td = D.td;
  const br = Math.sin(t * 1.7 + st.seed);
  if (a === 'idle') {
    p.breath = br;
    p.lSh = 0.05 + 0.02 * Math.sin(t * 1.7 + 1); p.rSh = 0.05 + 0.02 * Math.sin(t * 1.7 + 1.3);
    p.side = 0.02 * Math.sin(t * 0.45 + st.seed);
    p.lHipR = (fem ? 0.02 : 0.05) + p.side; p.rHipR = (fem ? 0.02 : 0.05) - p.side;
    if (fem) { p.lHip = 0.06; p.rHip = -0.04; p.rKn = 0.16; p.side += 0.03; }   // 女：一腿微屈，重心偏一侧
    const g = Math.sin(t * 0.37 + st.seed * 3) + Math.sin(t * 0.21 + st.seed);
    p.headYaw = g > 1.2 ? 0.35 : g < -1.3 ? -0.3 : 0;
    p.headPitch = 0.02 * br + (fem ? 0.04 : 0);
    idleHands(p, R, D, look);
  } else if (a === 'walk') {
    const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
    const A = fem ? 0.32 : 0.4;
    p.lHip = A * s; p.rHip = -A * s;
    p.lKn = 0.08 + 0.75 * Math.pow(Math.max(0, c), 2); p.rKn = 0.08 + 0.75 * Math.pow(Math.max(0, -c), 2);
    p.lFoot = -0.25 * Math.max(0, -s); p.rFoot = -0.25 * Math.max(0, s);
    const sw = fem ? 0.18 : 0.3;
    p.lSh = -sw * s; p.rSh = sw * s;
    p.lEl = 0.24 + 0.25 * Math.max(0, -s); p.rEl = 0.24 + 0.25 * Math.max(0, s);
    p.lWb = 0.12 - 0.18 * c; p.rWb = 0.12 + 0.18 * c;
    p.twist = 0.07 * s; p.lean = 0.06; p.side = 0.025 * c;
    if (fem) { p.side += 0.035 * s; p.rootX = 0.5 * s; p.lHipR = p.rHipR = 0.0; }
    p.rootY = 0.5 * Math.cos(ph * 2);
    p.breath = br * 0.5;
    if (R.idle !== 'stand' || look.hand !== 'none') {
      idleHands(p, R, D, look, 1);
      // 负手而行：另一只手照常摆
    }
  } else if (a === 'run') {
    runPose(p, st, R);
  } else if (a === 'fly') {
    const mv = Math.min(1, st.speed / 200);
    p.lHip = 0.2; p.rHip = -0.25; p.lKn = 0.32; p.rKn = 0.18; p.lHipR = 0.1; p.rHipR = 0.1;
    p.rFoot = -0.15;
    ik(p, -1, 1, [-1.3, -3.0, td + 3.4], [-0.12, 1, 0.3], [-1, 0, 0.2], fem ? 'lotus' : 'sword');   // 剑诀当胸
    ik(p, 1, 1, [-1.7, -15.0, -(td + 2.7)], [-1, -0.3, -0.1], [0.1, 0.15, -1], 'relax');             // 负手
    p.lean = 0.06 + 0.16 * mv; p.headPitch = -0.05 * mv;
    p.breath = br * 0.6;
  } else if (a === 'sit') {
    p.sit = 1; p.ground = 0;
    p.lHip = 1.35; p.rHip = 1.35; p.lHipR = 0.8; p.rHipR = 0.8; p.lKn = 2.6; p.rKn = 2.6;
    ik(p, 1, 1, [-1.5, -19.6, td + 2.2], [-0.75, 0, 0.65], [0, 1, 0], 'seal');
    ik(p, -1, 1, [-1.2, -19.0, td + 2.6], [-0.75, 0, 0.65], [0, 1, 0], 'seal');
    p.lean = 0.0; p.headPitch = 0.12; p.eyes = 0;
    p.breath = Math.sin(t * 0.9 + st.seed) * 1.2;
    p.rootY = 1.2 * Math.sin(t * 0.8);
  } else if (a === 'cast') {
    castPose(p, st, R, D);
  } else if (a === 'gather') {
    const k = smooth01(at / 0.3);
    p.lHip = 1.25 * k; p.lKn = 2.0 * k + 0.05; p.rHip = -0.35 * k; p.rKn = 1.5 * k + 0.05; p.rFoot = 0.6 * k;
    p.lean = 0.42 * k; p.headPitch = 0.3 * k;
    p.rSh = 0.05 + 1.05 * k + Math.sin(at * 6) * 0.06 * k; p.rEl = 0.25; p.rShR = 0.05; p.rSup = -0.6 * k; p.rWb = 0.35 * k; p.rG = 'pinch';
    p.lSh = 0.3 * k; p.lEl = 1.4 * k + 0.2; p.lFr = -0.5 * k; p.lSup = -0.8 * k; p.lG = 'relax';
  } else if (a === 'hit') {
    const k = Math.sin(Math.PI * Math.min(1, at / 0.45));
    p.lean = -0.38 * k; p.headPitch = -0.35 * k;
    p.lShR = 0.13 + 0.7 * k; p.rShR = 0.13 + 0.7 * k; p.lSh = 0.05 + 0.4 * k; p.rSh = 0.05 + 0.35 * k;
    p.lEl = 0.2 + 0.6 * k; p.rEl = 0.2 + 0.6 * k; p.lWb = -0.5 * k; p.rWb = -0.5 * k;
    p.rootZ = -3.5 * k; p.lKn = 0.05 + 0.35 * k; p.rKn = 0.05 + 0.25 * k; p.lHip = -0.25 * k; p.rHip = 0.2 * k;
    p.lG = p.rG = k > 0.2 ? 'open' : 'relax'; p.mouth = 0.7 * k; p.eyes = k > 0.5 ? 0 : 1;
  } else if (a === 'dodge') {
    const k = Math.sin(Math.PI * Math.min(1, at / 0.38));
    p.lean = 0.32 * k; p.side = 0.45 * k; p.rootX = 5 * k;
    p.lKn = 0.05 + 0.85 * k; p.rKn = 0.05 + 0.7 * k; p.lHip = 0.5 * k; p.rHip = 0.1 * k;
    p.lHipR = 0.04 + 0.35 * k; p.rHipR = 0.04 + 0.1 * k;
    p.lShR = 0.13 + 0.9 * k; p.rShR = 0.13 + 0.5 * k; p.lEl = 0.6 * k + 0.2; p.rEl = 0.4 * k + 0.2;
    p.lSup = 0.6 * k; p.rSup = 0.3 * k; p.lG = 'open'; p.rG = k > 0.3 ? 'palm' : 'relax';
    p.headYaw = -0.2 * k;
  }
  if (fem && a !== 'sit') { p.lShR -= 0.03; p.rShR -= 0.03; }
  return p;
}

/** 施法四式：蓄（0–0.09s）→ 发（带过冲，0.08–0.22s）→ 运劲（微颤，指尖劲气渐收） */
function castPose(p: Pose, st: CharState, R: RLook, D: Dims) {
  const at = st.actionT, fem = R.fem, td = D.td;
  const style = (st.castN + Math.floor(st.seed)) % 4;
  const wind = smooth01(at / 0.09);
  const go = backOut((at - 0.08) / 0.14);
  const hold = smooth01((at - 0.2) / 0.1);
  const trem = Math.sin(at * 43) * 0.022 * hold;
  const fx = at < 0.08 ? 0 : (0.32 + 0.68 * Math.exp(-Math.max(0, at - 0.16) * 7)) * smooth01((at - 0.08) / 0.05);
  const stance = (k: number) => {
    const s = fem ? 0.7 : 1;
    p.lHip = 0.34 * k * s; p.lKn = 0.05 + 0.32 * k * s; p.rHip = -0.3 * k * s; p.rKn = 0.05 + 0.2 * k * s; p.rFoot = 0.12 * k;
    p.rootY = -1.3 * k * s; p.lHipR = p.rHipR = 0.06 + 0.04 * k;
  };
  const jue = (side: 1 | -1, w: number) => ik(p, side, w, [-1.0, -3.4, td + 3.2], [-0.1, 1, 0.3], [-1, 0, 0.15], fem ? 'lotus' : 'sword');
  p.breath = Math.sin(st.t * 1.7) * 0.4;
  if (style === 0) {
    // 剑指：右手后引蓄势，猛然前刺；左手剑诀当胸
    const k = go;
    p.rSh = lerp(0.25 - 0.55 * wind, 1.36, k) + trem; p.rShR = lerp(0.3, 0.1, k); p.rEl = lerp(1.5, 0.06, k); p.rFr = 0;
    p.rSup = lerp(-0.2, 0.05, k); p.rWb = lerp(0.45, -0.08, k); p.rG = 'sword';
    jue(1, smooth01(at / 0.12));
    p.twist = -0.12 * wind * (1 - k) + 0.3 * k; p.lean = 0.04 + 0.14 * k;
    stance(k); p.headPitch = -0.04 * k; p.rFx = fx; p.mouth = fem ? 0 : 0.3 * fx * (1 - hold);
  } else if (style === 1) {
    // 推掌：双掌收于腰侧，沉身前推，掌根发力
    const k = go;
    for (const side of [1, -1] as const) {
      const tx = lerp(4.0, 2.3, k), ty = lerp(-12.8, -2.8, k) + trem * 8, tz = lerp(2.4, 18.2, k);
      ik(p, side, 1, [tx, ty, tz], [lerp(0, 0.05, k), lerp(0.1, 1, k), lerp(1, 0.18, k)], [lerp(-1, -0.05, k), lerp(0.2, 0.08, k), lerp(0.1, 1, k)], k > 0.25 ? 'palm' : 'relax');
    }
    p.lean = 0.05 + 0.2 * k; stance(k); p.twist = 0; p.lFx = p.rFx = fx; p.mouth = fem ? 0 : 0.35 * fx * (1 - hold);
  } else if (style === 2) {
    // 掐诀：双手当胸结印，右手剑指向斜上方一引
    const k = go;
    ik(p, 1, 1, [-1.3, -6.6, td + 3.0], [-0.8, 0.05, 0.5], [0, 1, 0], 'cup');
    ik(p, -1, 1, [lerp(-0.8, 1.6, k), lerp(-4.6, 9.4, k) + trem * 6, lerp(td + 3.4, 13.2, k)], [lerp(0, 0.06, k), lerp(1, 0.78, k), lerp(0.2, 0.68, k)], [-1, 0, 0.1], 'sword');
    p.headPitch = -0.16 * k; p.lean = -0.03 * k; p.lHip = 0.12 * k; p.rHip = -0.1 * k; p.rFx = fx;
  } else {
    // 托天：右手擎天张掌，左手剑诀当胸
    const k = go;
    ik(p, -1, 1, [lerp(5.0, 2.6, k), lerp(-8, 20.5, k) + trem * 6, lerp(4, 3.2, k)], [-0.75, lerp(-0.2, 0.1, k), -0.25], [0, 1, 0.2], k > 0.3 ? 'open' : 'relax');
    jue(1, smooth01(at / 0.12));
    p.lean = -0.08 * k; p.headPitch = -0.28 * k; stance(k * 0.6); p.rFx = fx;
  }
}

function blendPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b };
  for (const k of POSE_KEYS) (o as any)[k] = (a as any)[k] + ((b as any)[k] - (a as any)[k]) * t;
  return o;
}

function updateHands(st: CharState, pose: Pose, dt: number) {
  const tg = [GESTURES[pose.lG] ?? GESTURES.relax, GESTURES[pose.rG] ?? GESTURES.relax];
  const k = !st.handInit ? 1 : dt > 0 ? 1 - Math.exp(-dt * 15) : 0;
  for (let h = 0; h < 2; h++) {
    const cur = st.hands[h], t = tg[h];
    for (let i = 0; i < G_N; i++) cur[i] += (t[i] - cur[i]) * k;
  }
  st.handInit = true;
}

// ---------------------------------------------------------------- 骨骼求解（局部 3D：x=角色左, y=上, z=前）
type V3 = { x: number; y: number; z: number };
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot3 = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len3 = (a: V3) => Math.hypot(a.x, a.y, a.z);
const nrm = (a: V3): V3 => { const l = len3(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const crs = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const lerpV = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function limbDir(pitch: number, roll: number, side: number): V3 {
  const cp = Math.cos(pitch);
  return { x: side * cp * Math.sin(roll), y: -cp * Math.cos(roll), z: Math.sin(pitch) };
}
/** 两节骨 IK：肩 S → 腕 T，肘朝 pole 一侧 */
function ik2(S: V3, T: V3, l1: number, l2: number, pole: V3) {
  const d = sub(T, S); let L = len3(d);
  const dir = L > 1e-4 ? { x: d.x / L, y: d.y / L, z: d.z / L } : v(0, -1, 0);
  L = Math.max(Math.abs(l1 - l2) + 0.05, Math.min(l1 + l2 - 0.05, L));
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let pp = sub(pole, { x: dir.x * dot3(pole, dir), y: dir.y * dot3(pole, dir), z: dir.z * dot3(pole, dir) });
  const pl = len3(pp); pp = pl > 1e-4 ? { x: pp.x / pl, y: pp.y / pl, z: pp.z / pl } : v(0, -1, 0);
  return { E: add(add(S, dir, a), pp, h), W: add(S, dir, L) };
}

interface Skel {
  pelvis: V3; chest: V3; neck: V3; head: V3; up: V3; fw: V3; lt: V3;
  lSh: V3; rSh: V3; lEl: V3; rEl: V3; lWr: V3; rWr: V3; lH: HandFrame; rH: HandFrame;
  lHip: V3; rHip: V3; lKn: V3; rKn: V3; lAn: V3; rAn: V3; lToe: V3; rToe: V3;
  D: Dims;
}

function solve(p: Pose, look: Look, R: RLook): Skel {
  const f = R.fem, B = R.body, D = dimsOf(look, R);
  let pelvis = v(p.rootX, 51 + p.rootY, p.rootZ);
  if (p.sit > 0.5) pelvis = v(p.rootX, 13 + p.rootY, p.rootZ - 1);
  const lean = p.lean + B.stoop * 0.12;
  const up = v(Math.sin(p.side) * Math.cos(lean), Math.cos(lean) * Math.cos(p.side), Math.sin(lean));
  const chest = add(pelvis, up, D.torsoL + p.breath * 0.35);
  const neckDir = nrm(add(up, v(0, 0, 1), B.stoop * 0.55));
  const neck = add(chest, neckDir, (f ? 5.3 : 4.8) * R.head.neck + p.breath * 0.12);
  const head = add(neck, v(Math.sin(p.side) * 0.5, Math.cos(p.headPitch), Math.sin(p.headPitch) + up.z * 0.4 + B.stoop * 0.3), 6.5 * D.hk);
  const tw = p.twist;
  const fw = nrm(sub(v(Math.sin(tw), 0, Math.cos(tw)), { x: up.x * Math.sin(tw) * 0 + up.x * (up.x * Math.sin(tw) + up.z * Math.cos(tw)), y: up.y * (up.x * Math.sin(tw) + up.z * Math.cos(tw)), z: up.z * (up.x * Math.sin(tw) + up.z * Math.cos(tw)) }));
  const lt = crs(up, fw);
  const shY = 0.5 + p.breath * 0.25;
  const lSh = add(add(chest, lt, D.sw), up, shY), rSh = add(add(chest, lt, -D.sw), up, shY);
  const lUp = limbDir(p.lSh, p.lShR, 1), rUp = limbDir(p.rSh, p.rShR, -1);
  let lEl = add(lSh, lUp, D.upL), rEl = add(rSh, rUp, D.upL);
  const lFo = limbDir(p.lSh + p.lEl, p.lFr, 1), rFo = limbDir(p.rSh + p.rEl, p.rFr, -1);
  let lWr = add(lEl, lFo, D.foL), rWr = add(rEl, rFo, D.foL);
  const tgt = (tx: number, ty: number, tz: number, s: number) => add(add(add(chest, lt, tx * s), up, ty), fw, tz);
  const vec = (x: number, y: number, z: number, s: number) => add(add({ x: lt.x * x * s, y: lt.y * x * s, z: lt.z * x * s }, up, y), fw, z);
  if (p.lIK > 0.001) {
    const T = lerpV(lWr, tgt(p.lTx, p.lTy, p.lTz, 1), p.lIK);
    const r = ik2(lSh, T, D.upL, D.foL, add(nrm(sub(lEl, lSh)), v(0.9, -0.2, -0.5), p.lIK));
    lEl = r.E; lWr = r.W;
  }
  if (p.rIK > 0.001) {
    const T = lerpV(rWr, tgt(p.rTx, p.rTy, p.rTz, -1), p.rIK);
    const r = ik2(rSh, T, D.upL, D.foL, add(nrm(sub(rEl, rSh)), v(-0.9, -0.2, -0.5), p.rIK));
    rEl = r.E; rWr = r.W;
  }
  let lH = armHandFrame(lWr, nrm(sub(lWr, lEl)), 1, p.lSup, p.lWb);
  let rH = armHandFrame(rWr, nrm(sub(rWr, rEl)), -1, p.rSup, p.rWb);
  if (p.lIK > 0.001 && (p.lAx || p.lAy || p.lAz)) lH = blendFrame(lH, aimHandFrame(lWr, vec(p.lAx, p.lAy, p.lAz, 1), vec(p.lNx, p.lNy, p.lNz, 1), 1), p.lIK, 1);
  if (p.rIK > 0.001 && (p.rAx || p.rAy || p.rAz)) rH = blendFrame(rH, aimHandFrame(rWr, vec(p.rAx, p.rAy, p.rAz, -1), vec(p.rNx, p.rNy, p.rNz, -1), -1), p.rIK, -1);
  const hx = f ? 4.3 : 4.3, ht = -tw * 0.5;
  const lHip = add(pelvis, v(hx * Math.cos(ht), -1, -hx * Math.sin(ht)));
  const rHip = add(pelvis, v(-hx * Math.cos(ht), -1, hx * Math.sin(ht)));
  let lKn: V3, rKn: V3, lAn: V3, rAn: V3, lToe: V3, rToe: V3;
  const all = () => [pelvis, chest, neck, head, lSh, rSh, lEl, rEl, lWr, rWr, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe];
  if (p.sit > 0.5) {
    lKn = add(pelvis, v(11, -6, 5)); rKn = add(pelvis, v(-11, -6, 5));
    lAn = add(pelvis, v(-4, -9, 7)); rAn = add(pelvis, v(4, -9, 8));
    lToe = add(rKn, v(-1, -1, 3)); rToe = add(lKn, v(1, -1, 3));
  } else {
    const lTh = limbDir(p.lHip, p.lHipR, 1), rTh = limbDir(p.rHip, p.rHipR, -1);
    lKn = add(lHip, lTh, D.thL); rKn = add(rHip, rTh, D.thL);
    const lSn = limbDir(p.lHip - p.lKn, p.lHipR * 0.6, 1), rSn = limbDir(p.rHip - p.rKn, p.rHipR * 0.6, -1);
    lAn = add(lKn, lSn, D.shL); rAn = add(rKn, rSn, D.shL);
    lToe = add(lAn, v(0, -3.2 - Math.sin(p.lFoot) * 4, 6.2 * Math.cos(p.lFoot)));
    rToe = add(rAn, v(0, -3.2 - Math.sin(p.rFoot) * 4, 6.2 * Math.cos(p.rFoot)));
    if (p.ground > 0.5) {
      const low = Math.min(lAn.y - 3.4, rAn.y - 3.4, lToe.y, rToe.y);
      for (const q of all()) q.y -= low;
    }
    if (p.air > 0.01) for (const q of all()) q.y += p.air;
  }
  return { pelvis, chest, neck, head, up, fw, lt, lSh, rSh, lEl, rEl, lWr, rWr, lH, rH, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe, D };
}

type Pt = { x: number; y: number; z?: number; tag?: number };
function convexHull<T extends { x: number; y: number }>(pts: T[]): T[] {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: T, a: T, b: T) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: T[] = [], up: T[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

// ---------------------------------------------------------------- 投影与绘制
const PITCH = 0.36; // 俯视角
const CP = Math.cos(PITCH), SP = Math.sin(PITCH);
type P2 = { x: number; y: number; z: number };
const TAU = Math.PI * 2;

// 头部贴图的尺寸/锚点（旧：手绘头）
const HEAD_NECK_UP = 3.2, HEAD_TOP_Y = 9.6, HEAD_TEX_K = 1.08, HEAD_NECK_SINK = 0.06;

export interface DrawOpts { alpha?: number; ghost?: boolean; glow?: number; preview?: boolean; /** 遁具法器 id（飞行时脚下/背后） */ mount?: string; /** GL 大雷翼展开时不画背上的小翅 */ hideMount?: boolean }

export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, st: CharState, scale: number, dt: number, opts: DrawOpts = {}) {
  const R = resolveLook(look);
  let pose = poseFor(st, look, R);
  if (st.from && st.blend < 1) pose = blendPose(st.from, pose, smooth01(st.blend));
  if (!opts.ghost) { st.last = pose; updateHands(st, pose, dt); }
  const sk = solve(pose, look, R);
  const D = sk.D, B = R.body, fem = R.fem;
  const S = scale * look.height;
  const tf = typeof (ctx as any).getTransform === 'function' ? ctx.getTransform() : null;
  const zs = tf ? Math.hypot(tf.a, tf.b) || 1 : 1;
  const E = S * zs;                      // 局部单位 → 屏幕像素（细节分级）
  const fine = E > 1.6;
  const yaw = st.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const bx = st.x, by = st.y - st.lift;
  const P = (q: V3): P2 => {
    const X = q.x * cy + q.z * sy, Z = -q.x * sy + q.z * cy;
    return { x: bx + X * S, y: by + (-q.y * CP + Z * SP) * S, z: Z };
  };
  const cam = (n: V3) => n.y * SP + (-n.x * sy + n.z * cy) * CP;
  const lw = Math.max(0.42 * S, 0.7 / zs);
  const front = cy;
  const parts: { z: number; f: () => void }[] = [];
  const physDt = opts.ghost ? 0 : dt;
  const hero = !!(look.hero || look.headTex);
  const flying = st.action === 'fly';
  const flutter = (flying ? 1 : st.action === 'run' ? (hero ? 0.85 : 0.55) : 0.15) * Math.sin(st.t * 13 + st.seed);
  const runK = st.action === 'run' && hero ? 1.35 : 1;
  const windX = -st.vx * runK + st.windX + flutter * 40 * S;
  const windY = -st.vy * runK + st.windY + flutter * 20 * S;
  const grav = 520 * S;
  const strand = (key: string, n: number, len: number, ax: number, ay: number, drag = 2.2, gScale = 1) => {
    let s = st.strands.get(key);
    if (!s) { s = new Strand(n, len * S); st.strands.set(key, s); }
    s.step(ax, ay, physDt, 0, grav * gScale, windX, windY, drag, len * S);
    return s;
  };
  const spring = (key: string, tx: number, ty: number, k = 160, c = 15) => {
    let s = st.springs.get(key);
    if (!s) { s = new Spring(); st.springs.set(key, s); }
    s.step(tx, ty, physDt, k, c);
    return s;
  };
  const g = ctx;
  g.save();
  if (opts.alpha !== undefined) g.globalAlpha *= opts.alpha;
  g.lineJoin = 'round'; g.lineCap = 'round';

  // ---------- 工具 ----------
  const tube = (a: P2 | Pt, b: P2 | Pt, ra: number, rb: number, fill: string | CanvasGradient, stroke: string | null = inkOf(typeof fill === 'string' ? fill : '#555555')) => {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3;
    const nx = -dy / d, ny = dx / d, ang = Math.atan2(dy, dx);
    g.beginPath();
    g.moveTo(a.x + nx * ra, a.y + ny * ra);
    g.lineTo(b.x + nx * rb, b.y + ny * rb);
    g.arc(b.x, b.y, rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
    g.lineTo(a.x - nx * ra, a.y - ny * ra);
    g.arc(a.x, a.y, ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
    g.closePath();
    g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  };
  const ribbon = (s: Strand, w0: number, w1: number, fill: string, stroke = true, extra?: { x: number; y: number }) => {
    const n = s.n; const L: [number, number][] = [], Rr: [number, number][] = [];
    const xs: number[] = [], ys: number[] = [];
    if (extra) { xs.push(extra.x); ys.push(extra.y); }
    for (let i = 0; i < n; i++) { xs.push(s.x[i]); ys.push(s.y[i]); }
    const m = xs.length;
    for (let i = 0; i < m; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
      const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * (i / (m - 1))) * S * 0.5;
      L.push([xs[i] - dy / d * w, ys[i] + dx / d * w]); Rr.push([xs[i] + dy / d * w, ys[i] - dx / d * w]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < m; i++) g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
    g.lineTo(L[m - 1][0], L[m - 1][1]); g.lineTo(Rr[m - 1][0], Rr[m - 1][1]);
    for (let i = m - 2; i >= 0; i--) g.quadraticCurveTo(Rr[i + 1][0], Rr[i + 1][1], (Rr[i + 1][0] + Rr[i][0]) / 2, (Rr[i + 1][1] + Rr[i][1]) / 2);
    g.lineTo(Rr[0][0], Rr[0][1]);
    g.closePath(); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = inkOf(fill); g.lineWidth = lw * 0.8; g.stroke(); }
  };
  const smoothPoly = (pts: { x: number; y: number }[]) => {
    const n = pts.length; g.beginPath();
    g.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    g.closePath();
  };
  const polyline = (pts: { x: number; y: number }[]) => {
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    if (pts.length > 1) g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  };
  const shadeFill = (x0: number, x1: number, y: number, base: string): string | CanvasGradient => {
    if (!fine) return base;
    const gr = g.createLinearGradient(x0, y, x1, y);
    gr.addColorStop(0, shade(base, 0.14)); gr.addColorStop(0.42, base); gr.addColorStop(1, shade(base, -0.24));
    return gr;
  };

  // ---------- 躯干截面环（相对骨盆沿脊柱的高度 y；w 半宽，df/db 前后半厚，tk 扭转比例）----------
  const U = sk.up, FW = sk.fw, LT = sk.lt, tw = pose.twist;
  type Ring = { y: number; w: number; df: number; db: number; tk: number };
  const cl = 0.55;
  const rings: Ring[] = fem ? [
    { y: 0.5, w: D.hw + cl, df: D.td + 0.4, db: D.td + 1.0, tk: 0 },
    { y: 7.6, w: D.ww + cl, df: D.td - 0.4 + B.belly * 2.4, db: D.td - 0.6, tk: 0.25 },
    { y: 13.4, w: D.sw * 0.8 + cl, df: D.td + 0.1, db: D.td - 0.3, tk: 0.6 },
    { y: 16.8, w: D.sw * 0.88 + cl, df: D.td + 1.45 * B.chest, db: D.td - 0.2, tk: 0.85 },
    { y: 21.0, w: D.sw * 0.98, df: 3.2, db: 3.4, tk: 1 },
    { y: 24.4, w: 2.2, df: 2.1, db: 2.3, tk: 1 },
  ] : [
    { y: 0.5, w: D.hw + cl, df: D.td + 0.2, db: D.td + 0.5, tk: 0 },
    { y: 7.6, w: D.ww + cl, df: D.td - 0.2 + B.belly * 3.0, db: D.td - 0.5, tk: 0.25 },
    { y: 13.8, w: D.sw * 0.85 + cl, df: D.td + 0.35 * B.chest, db: D.td, tk: 0.6 },
    { y: 17.8, w: D.sw * 0.93 + cl, df: D.td + 0.6 * B.chest, db: D.td + 0.1, tk: 0.85 },
    { y: 21.9, w: D.sw * 1.0, df: 3.6, db: 3.8, tk: 1 },
    { y: 25.2, w: 2.6, df: 2.4, db: 2.6, tk: 1 },
  ];
  const frameK = (tk: number) => {
    const dl = (1 - tk) * tw, c = Math.cos(dl), s = Math.sin(dl);
    return { l: add({ x: LT.x * c, y: LT.y * c, z: LT.z * c }, FW, s), f: add({ x: FW.x * c, y: FW.y * c, z: FW.z * c }, LT, -s) };
  };
  const ringAt = (y: number): Ring => {
    if (y <= rings[0].y) return rings[0];
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      if (y <= b.y) { const t = (y - a.y) / (b.y - a.y); return { y, w: lerp(a.w, b.w, t), df: lerp(a.df, b.df, t), db: lerp(a.db, b.db, t), tk: lerp(a.tk, b.tk, t) }; }
    }
    return rings[rings.length - 1];
  };
  const ringPt = (r: Ring, u: number, out = 0): V3 => {
    const fr = frameK(r.tk), cu = Math.cos(u), su = Math.sin(u);
    const c = add(sk.pelvis, U, r.y);
    return add(add(c, fr.l, su * (r.w + out)), fr.f, cu * ((cu >= 0 ? r.df : r.db) + out));
  };
  /** 躯干正面某高度、横向比例 s（-1 右 … 1 左）处的表面点 */
  const surf = (y: number, s: number, out = 0.15): V3 => {
    const r = ringAt(y), fr = frameK(r.tk), c = add(sk.pelvis, U, y);
    return add(add(c, fr.l, s * (r.w + out)), fr.f, Math.sqrt(Math.max(0, 1 - s * s)) * (r.df + out));
  };
  /** 环朝镜头的一半（屏幕左→右） */
  const nearArc = (r: Ring, out = 0, N = 14) => {
    const fr = frameK(r.tk);
    const pts: P2[] = [];
    for (let i = 0; i <= N * 2; i++) {
      const u = -Math.PI + (i / (N * 2)) * TAU;
      const nrmv = add({ x: fr.l.x * Math.sin(u), y: fr.l.y * Math.sin(u), z: fr.l.z * Math.sin(u) }, fr.f, Math.cos(u));
      if (cam(nrmv) >= -0.02) pts.push(P(ringPt(r, u, out)));
    }
    // 可见段可能跨越 u=±π 被切成两截：按屏幕 x 排序即可（近半环在屏幕上单调）
    pts.sort((a, b) => a.x - b.x);
    return pts;
  };
  const extremes = (r: Ring, out = 0) => {
    let L: P2 | null = null, Rr: P2 | null = null;
    for (let i = 0; i < 12; i++) { const q = P(ringPt(r, (i / 12) * TAU, out)); if (!L || q.x < L.x) L = q; if (!Rr || q.x > Rr.x) Rr = q; }
    return [L!, Rr!] as const;
  };

  const pel = P(sk.pelvis), che = P(sk.chest), hed = P(sk.head);
  const torsoZ = (pel.z + che.z) / 2;
  const fv = cam(FW);                // 胸前朝镜头程度

  // ---------- 飞剑 / 遁具 ----------
  if (flying) {
    const L = opts.mount ? artLook(opts.mount) : null;
    if (L && L.shape === 'boat') parts.push({ z: -999, f: () => drawBoatUnderFeet(g, bx, by, yaw, S, st.t, opts.mount!) });
    else if (L && L.shape === 'wings' && opts.hideMount) { /* GL 雷翼代替 */ }
    else if (L && (L.shape === 'wings' || L.shape === 'cloak')) {
      const back = Math.cos(yaw) > 0;
      parts.push({ z: back ? -998 : 999, f: () => drawBackMount(g, che.x, che.y, yaw, S, st.t, opts.mount!) });
    } else parts.push({ z: -999, f: () => drawSwordUnderFeet(g, bx, by, yaw, S, st.t, look.swordColor || '#7ff0c0') });
  }
  if (opts.glow && opts.glow > 0) {
    parts.push({ z: -1000, f: () => {
      const r = 34 * S;
      const gr = g.createRadialGradient(bx, by - 30 * S, 0, bx, by - 30 * S, r * 1.6);
      gr.addColorStop(0, `rgba(150,255,210,${0.32 * opts.glow!})`); gr.addColorStop(1, 'rgba(150,255,210,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by - 30 * S, r * 1.3, r * 1.6, 0, 0, Math.PI * 2); g.fill();
    } });
  }

  // ---------- 下半身：腿 + 下裳 ----------
  const seated = pose.sit > 0.5;
  const legThick = (fem ? 0.9 : 1) * (0.85 + 0.15 * B.heft);
  const shortSkirt = R.skirt === 'pants' || R.skirt === 'split';
  const legOne = (side: 1 | -1) => {
    const hip = side > 0 ? sk.lHip : sk.rHip, kn = side > 0 ? sk.lKn : sk.rKn, an = side > 0 ? sk.lAn : sk.rAn, toe = side > 0 ? sk.lToe : sk.rToe;
    const H = P(hip), K = P(kn), A = P(an), T = P(toe);
    tube(H, K, 4.0 * legThick * S, 3.2 * legThick * S, look.pants);
    tube(K, A, 3.2 * legThick * S, 2.2 * legThick * S, look.pants);
    if (shortSkirt) {
      // 靴筒 + 绑腿
      const m = P(lerpV(kn, an, 0.36));
      tube(m, A, 2.95 * legThick * S, 2.4 * legThick * S, look.boots);
      if (E > 2.2) { g.strokeStyle = rgba(shade(look.boots, 0.35), 0.6); g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(m.x - 2.6 * S, m.y + 0.6 * S); g.lineTo(m.x + 2.6 * S, m.y + 0.6 * S); g.stroke(); }
    }
    const heel = P(add(an, v(0, -2.4, -1.3)));
    tube(heel, T, 2.3 * S * legThick, 1.7 * S * legThick, look.boots);
    if (fine) {
      g.strokeStyle = rgba(shade(look.boots, -0.5), 0.8); g.lineWidth = 0.9 * S;
      g.beginPath(); g.moveTo(heel.x, heel.y + 1.9 * S * legThick); g.lineTo(T.x, T.y + 1.4 * S * legThick); g.stroke();
      if (fem) { g.fillStyle = shade(look.boots, 0.25); g.beginPath(); g.arc(T.x, T.y - 0.4 * S, 0.9 * S, 0, TAU); g.fill(); }
    }
  };
  const legs = () => {
    if (seated) return;
    const L = { z: P(sk.lKn).z, f: () => legOne(1) }, Rr = { z: P(sk.rKn).z, f: () => legOne(-1) };
    (L.z < Rr.z ? [L, Rr] : [Rr, L]).forEach((o) => o.f());
  };
  const skirtCol = R.over === 'beizi' ? R.overColor : R.skirtColor;
  const heroRun = st.action === 'run' && hero;
  const skirt = () => {
    const col = skirtCol;
    if (seated) {
      const lk = P(sk.lKn), rk = P(sk.rKn), wl = P(add(sk.pelvis, v(D.ww, 8, 0))), wr = P(add(sk.pelvis, v(-D.ww, 8, 0)));
      const base = P(add(sk.pelvis, v(0, -10, 4)));
      const lx = Math.min(lk.x, rk.x) - 4 * S, rx = Math.max(lk.x, rk.x) + 4 * S;
      const top = Math.min(wl.y, wr.y), yb = Math.max(lk.y, rk.y, base.y) + 3 * S;
      g.beginPath();
      g.moveTo(Math.min(wl.x, wr.x), top);
      g.bezierCurveTo(lx - 1 * S, top + 6 * S, lx - 6 * S, yb - 6 * S, lx + 2 * S, yb);
      g.quadraticCurveTo((lx + rx) / 2, yb + 5 * S, rx - 2 * S, yb);
      g.bezierCurveTo(rx + 6 * S, yb - 6 * S, rx + 1 * S, top + 6 * S, Math.max(wl.x, wr.x), top);
      g.closePath();
      g.fillStyle = shadeFill(lx, rx, top, col); g.fill();
      g.strokeStyle = inkOf(col); g.lineWidth = lw; g.stroke();
      g.strokeStyle = rgba(shade(col, -0.5), 0.45); g.lineWidth = lw * 0.8;
      const cx = (lx + rx) / 2;
      g.beginPath();
      for (const k of [-1, 1]) { g.moveTo(cx + k * 6 * S, top + 8 * S); g.quadraticCurveTo(cx + k * 10 * S, yb - 4 * S, cx + k * 15 * S, yb); }
      g.moveTo(cx, top + 10 * S); g.quadraticCurveTo(cx + 1 * S, yb - 2 * S, cx, yb + 3 * S);
      g.stroke();
      g.strokeStyle = look.trim; g.lineWidth = 1.6 * S;
      g.beginPath(); g.moveTo(lx + 2 * S, yb); g.quadraticCurveTo(cx, yb + 5 * S, rx - 2 * S, yb); g.stroke();
      g.fillStyle = look.boots; g.beginPath(); g.ellipse(cx - 5 * S, yb - 0.5 * S, 2.6 * S, 1.6 * S, 0, 0, TAU); g.fill();
      return;
    }
    const kind = R.skirt, len = look.robeLen;
    const hemOf = (hip: V3, kn: V3, an: V3) => {
      if (kind === 'pleat') { const q = lerpV(kn, an, 1.04); q.y = Math.max(q.y, 1.0); return q; }
      return len === 'long' ? lerpV(kn, an, 0.8) : len === 'mid' ? lerpV(kn, an, 0.28) : lerpV(hip, kn, 0.62);
    };
    let hL = hemOf(sk.lHip, sk.lKn, sk.lAn), hR = hemOf(sk.rHip, sk.rKn, sk.rAn);
    if (heroRun) { const m = lerpV(hL, hR, 0.5); hL = add(lerpV(hL, m, 0.3), U, 1.6); hR = add(lerpV(hR, m, 0.3), U, 1.6); }
    const mid = lerpV(hL, hR, 0.5);
    const flare = kind === 'pleat' ? 1.3 : len === 'short' ? 0.82 : 1.0;
    const R0 = (len === 'short' ? 5.6 : len === 'mid' ? 6.1 : 6.6) * flare * (0.9 + 0.1 * B.heft) * (fem ? 0.94 : 1);
    const cL = lerpV(hL, mid, 0.35), cR = lerpV(hR, mid, 0.35);
    const fl = flying ? 1 : heroRun ? 0.9 : st.action === 'run' ? 0.6 : 0.2;
    const off = (key: string, c: V3) => { const C = P(c); const s = spring(key, C.x, C.y, 110, 10); return { dx: s.x - C.x, dy: s.y - C.y }; };
    const oL = off('hemL', cL), oR = off('hemR', cR);
    const fr0 = frameK(0);
    const topR = rings[1], hipR = rings[0];
    const build = (filter: (cu: number) => boolean) => {
      const pts: Pt[] = [];
      for (let i = 0; i < 14; i++) { const u = (i / 14) * TAU; if (!filter(Math.cos(u))) continue; const q = P(ringPt(topR, u, 0.25)); pts.push({ x: q.x, y: q.y, tag: 2 }); const h = P(ringPt(hipR, u, 0.6)); pts.push({ x: h.x, y: h.y, tag: 0 }); }
      ([[cL, oL, 1], [cR, oR, -1]] as [V3, { dx: number; dy: number }, number][]).forEach(([c, o, side]) => {
        for (let i = 0; i < 16; i++) {
          const u = (i / 16) * TAU, cu = Math.cos(u), su = Math.sin(u);
          if (!filter(cu)) continue;
          const q = P(add(add(c, fr0.l, su * R0 * 0.95), fr0.f, cu * R0 * 0.86));
          const k = 0.55 + 0.45 * Math.abs(su);
          const flut = Math.sin(st.t * 10 + side * 2 + i * 1.3) * fl * 1.2 * S;
          pts.push({ x: q.x + o.dx * k + flut, y: q.y + o.dy * k, tag: 1 });
        }
      });
      return convexHull(pts);
    };
    const panel = (hull: Pt[], color: string, front: boolean) => {
      if (hull.length < 3) return;
      g.beginPath(); hull.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of hull) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      g.fillStyle = shadeFill(x0, x1, y0, color); g.fill();
      g.strokeStyle = inkOf(color); g.lineWidth = lw; g.stroke();
      // 下摆链（hull 上连续的 tag=1 点）
      const n = hull.length; let best = -1, bl = 0;
      for (let i = 0; i < n; i++) {
        if (hull[i].tag !== 1 || hull[(i - 1 + n) % n].tag === 1) continue;
        let l = 0; while (l < n && hull[(i + l) % n].tag === 1) l++;
        if (l > bl) { bl = l; best = i; }
      }
      if (bl === n) best = 0;
      const chain: Pt[] = []; for (let l = 0; l < bl; l++) chain.push(hull[(best + l) % n]);
      g.save(); g.clip();
      if (fine) {
        // 衣褶：腰→两膝（受力褶）+ 垂褶；百褶裙则是一排竖褶
        const wl = P(surf(topR.y - 0.5, 0.55)), wr = P(surf(topR.y - 0.5, -0.55)), wc = P(surf(topR.y - 0.5, 0));
        const kl = P(cL), kr = P(cR);
        g.lineWidth = lw * 0.75;
        if (kind === 'pleat') {
          const N = 9;
          for (let i = 1; i < N; i++) {
            const tx = x0 + (x1 - x0) * i / N;
            g.strokeStyle = rgba(shade(color, -0.45), 0.3);
            g.beginPath(); g.moveTo(tx + (wc.x - (x0 + x1) / 2) * 0.6, y0 + 3 * S); g.quadraticCurveTo(tx, (y0 + y1) / 2, tx + (tx - (x0 + x1) / 2) * 0.12, y1); g.stroke();
            g.strokeStyle = rgba(shade(color, 0.4), 0.28);
            g.beginPath(); g.moveTo(tx + 1.1 * S + (wc.x - (x0 + x1) / 2) * 0.6, y0 + 4 * S); g.lineTo(tx + 1.1 * S + (tx - (x0 + x1) / 2) * 0.12, y1 - 1 * S); g.stroke();
          }
        } else {
          g.strokeStyle = rgba(shade(color, -0.5), 0.38);
          g.beginPath();
          g.moveTo(wl.x, wl.y + 2 * S); g.quadraticCurveTo((wl.x + kl.x) / 2 + 1.5 * S, (wl.y + kl.y) / 2, kl.x + oL.dx * 0.6, kl.y + oL.dy * 0.6);
          g.moveTo(wr.x, wr.y + 2 * S); g.quadraticCurveTo((wr.x + kr.x) / 2 - 1.5 * S, (wr.y + kr.y) / 2, kr.x + oR.dx * 0.6, kr.y + oR.dy * 0.6);
          g.moveTo(wc.x, wc.y + 3 * S); g.quadraticCurveTo(wc.x + 0.6 * S, (wc.y + y1) / 2, (kl.x + kr.x) / 2 + (oL.dx + oR.dx) * 0.3, y1 - 0.5 * S);
          g.stroke();
          g.strokeStyle = rgba(shade(color, 0.45), 0.3);
          g.beginPath(); g.moveTo(wl.x - 1.2 * S, wl.y + 3 * S); g.quadraticCurveTo((wl.x + kl.x) / 2, (wl.y + kl.y) / 2, kl.x - 1.2 * S, kl.y); g.stroke();
        }
        // 衣襟（正面）：交领袍下摆的门襟线 / 对襟、褙子的前开
        if (front && fv > 0.05) {
          g.save(); g.globalAlpha *= Math.min(1, fv * 2);
          if (R.collar === 'open' || R.over === 'beizi') {
            const a0 = P(surf(topR.y, 0.16)), a1 = P(surf(topR.y, -0.16));
            const hb = P(lerpV(cL, cR, 0.5)), bo = (oL.dx + oR.dx) / 2;
            if (R.over === 'beizi') {
              g.fillStyle = R.skirtColor;
              g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(hb.x + bo + 2.2 * S, y1 + 2 * S); g.lineTo(hb.x + bo - 2.2 * S, y1 + 2 * S); g.lineTo(a1.x, a1.y); g.closePath(); g.fill();
            }
            g.strokeStyle = look.trim; g.lineWidth = 1.5 * S;
            g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(hb.x + bo + 2.2 * S, y1 + 2 * S); g.moveTo(a1.x, a1.y); g.lineTo(hb.x + bo - 2.2 * S, y1 + 2 * S); g.stroke();
          } else if (R.collar === 'cross' && kind !== 'pleat') {
            const a0 = P(surf(topR.y, -0.42)), hb = P(add(lerpV(cL, cR, 0.5), fr0.l, -R0 * 0.25));
            g.strokeStyle = look.trim; g.lineWidth = 1.3 * S;
            g.beginPath(); g.moveTo(a0.x, a0.y); g.quadraticCurveTo(a0.x + (hb.x - a0.x) * 0.4, (a0.y + hb.y) / 2, hb.x + (oL.dx + oR.dx) * 0.4, y1 + 2 * S); g.stroke();
          }
          g.restore();
        }
      }
      // 下摆镶边（+ 纹样）
      if (chain.length > 1) {
        const tw2 = (kind === 'pleat' ? 2.0 : 2.6) * S;
        g.strokeStyle = look.trim; g.lineWidth = tw2 * 2; polyline(chain); g.stroke();
        if (E > 2.4 && look.pattern && look.pattern !== 'none') hemPattern(g, chain, tw2, look.pattern, shade(look.trim, 0.45), S);
      }
      g.restore();
    };
    if (kind === 'split') {
      const fh = build((cu) => cu >= -0.25), bh = build((cu) => cu <= 0.25);
      const facing = fv > 0;
      const order = facing ? [() => panel(bh, shade(col, -0.08), false), legs, () => panel(fh, col, true)] : [() => panel(fh, shade(col, -0.08), true), legs, () => panel(bh, col, false)];
      order.forEach((f) => f());
    } else {
      legs();
      panel(build(() => true), col, true);
    }
    // 轻甲：腰下甲片（裙甲）
    if (R.over === 'armor' && fv > -0.3) armorTassets();
  };
  const armorTassets = () => {
    const col = R.overColor;
    for (const s of [-0.62, -0.2, 0.22, 0.64]) {
      const n = cam(add(frameK(0).f, frameK(0).l, s));
      if (n < -0.05) continue;
      const a = P(surf(7.4, s - 0.2, 0.9)), b = P(surf(7.4, s + 0.2, 0.9)), c2 = P(surf(-2.4, s + 0.24, 1.6)), d2 = P(surf(-2.4, s - 0.24, 1.6));
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.quadraticCurveTo((c2.x + d2.x) / 2, (c2.y + d2.y) / 2 + 1.2 * S, d2.x, d2.y); g.closePath();
      g.fillStyle = shadeFill(Math.min(a.x, d2.x), Math.max(b.x, c2.x), a.y, col); g.fill();
      g.strokeStyle = inkOf(col); g.lineWidth = lw * 0.8; g.stroke();
      if (E > 2.5) { g.strokeStyle = rgba(shade(col, 0.5), 0.5); g.beginPath(); g.moveTo((a.x + d2.x) / 2, (a.y + d2.y) / 2); g.lineTo((b.x + c2.x) / 2, (b.y + c2.y) / 2); g.stroke(); }
    }
  };
  parts.push({ z: torsoZ - 0.5, f: skirt });

  // ---------- 披风（在背后，随风飘）----------
  if (R.over === 'cape' && !seated) {
    const col = R.overColor;
    const a0 = P(add(add(sk.lSh, FW, -D.td * 0.7), U, 1.2)), a1 = P(add(add(sk.rSh, FW, -D.td * 0.7), U, 1.2)), am = P(add(add(sk.chest, FW, -D.td - 0.6), U, 2.6));
    const capeLen = look.robeLen === 'short' ? 5.6 : 7.4;
    const sL = strand('capeL', 6, capeLen, a0.x, a0.y, 1.7, 0.9), sR = strand('capeR', 6, capeLen, a1.x, a1.y, 1.7, 0.9), sM = strand('capeM', 6, capeLen * 1.04, am.x, am.y, 1.5, 0.9);
    const zb = P(add(sk.chest, FW, -D.td - 2.5)).z;
    parts.push({ z: zb, f: () => {
      const n = sL.n - 1;
      g.beginPath(); g.moveTo(a0.x, a0.y);
      for (let i = 1; i <= n; i++) g.lineTo(sL.x[i], sL.y[i]);
      g.quadraticCurveTo(sM.x[n] + (sM.x[n] - (sL.x[n] + sR.x[n]) / 2) * 0.4, sM.y[n] + 2 * S, sR.x[n], sR.y[n]);
      for (let i = n - 1; i >= 1; i--) g.lineTo(sR.x[i], sR.y[i]);
      g.lineTo(a1.x, a1.y); g.quadraticCurveTo(am.x, am.y - 1.5 * S, a0.x, a0.y); g.closePath();
      g.fillStyle = shadeFill(Math.min(sL.x[n], sR.x[n]), Math.max(sL.x[n], sR.x[n]), a0.y, col); g.fill();
      g.strokeStyle = inkOf(col); g.lineWidth = lw; g.stroke();
      if (fine) {
        g.strokeStyle = rgba(shade(col, -0.5), 0.4); g.lineWidth = lw * 0.8;
        g.beginPath(); for (const k of [0.33, 0.66]) { g.moveTo(lerp(a0.x, a1.x, k), lerp(a0.y, a1.y, k) + 2 * S); g.quadraticCurveTo(lerp(sL.x[3], sR.x[3], k), lerp(sL.y[3], sR.y[3], k), lerp(sL.x[n], sR.x[n], k), lerp(sL.y[n], sR.y[n], k)); } g.stroke();
        g.strokeStyle = look.trim; g.lineWidth = 1.4 * S;
        g.beginPath(); g.moveTo(sL.x[n], sL.y[n]); g.quadraticCurveTo(sM.x[n], sM.y[n] + 2 * S, sR.x[n], sR.y[n]); g.stroke();
      }
    } });
  }

  // ---------- 躯干 ----------
  const torso = () => {
    const ext = [1, 2, 3, 4].map((i) => extremes(rings[i]));
    const neckE = extremes(rings[5], 0.2);
    const top = ext[3];
    const path = () => {
      g.beginPath();
      g.moveTo(top[0].x, top[0].y + 0.8 * S);
      g.quadraticCurveTo(ext[2][0].x - 0.3 * S, ext[2][0].y, (ext[2][0].x + ext[1][0].x) / 2, (ext[2][0].y + ext[1][0].y) / 2);
      g.quadraticCurveTo(ext[1][0].x, ext[1][0].y, (ext[1][0].x + ext[0][0].x) / 2, (ext[1][0].y + ext[0][0].y) / 2);
      g.lineTo(ext[0][0].x, ext[0][0].y + 2 * S);
      g.lineTo(ext[0][1].x, ext[0][1].y + 2 * S);
      g.lineTo((ext[1][1].x + ext[0][1].x) / 2, (ext[1][1].y + ext[0][1].y) / 2);
      g.quadraticCurveTo(ext[1][1].x, ext[1][1].y, (ext[2][1].x + ext[1][1].x) / 2, (ext[2][1].y + ext[1][1].y) / 2);
      g.quadraticCurveTo(ext[2][1].x + 0.3 * S, ext[2][1].y, top[1].x, top[1].y + 0.8 * S);
      g.quadraticCurveTo(top[1].x - 0.6 * S, top[1].y - 2.2 * S, neckE[1].x, neckE[1].y);
      g.lineTo(neckE[0].x, neckE[0].y);
      g.quadraticCurveTo(top[0].x + 0.6 * S, top[0].y - 2.2 * S, top[0].x, top[0].y + 0.8 * S);
      g.closePath();
    };
    const overTorso = R.over === 'banbi' || R.over === 'vest' || R.over === 'beizi';
    const baseCol = overTorso ? R.overColor : look.robe;
    path();
    const x0 = Math.min(ext[2][0].x, top[0].x), x1 = Math.max(ext[2][1].x, top[1].x);
    g.fillStyle = shadeFill(x0, x1, ext[2][0].y, baseCol); g.fill();
    g.strokeStyle = inkOf(baseCol); g.lineWidth = lw; g.stroke();
    if (E < 1.0) { belt(); return; }
    g.save(); path(); g.clip();
    // 齐胸襦裙：裙头系在胸上
    if (look.waistline === 'chest') {
      const arc = nearArc(ringAt(16.4), 0.5);
      if (arc.length > 1) {
        g.beginPath(); g.moveTo(arc[0].x, arc[0].y);
        for (const q of arc) g.lineTo(q.x, q.y);
        g.lineTo(arc[arc.length - 1].x + 30 * S, arc[arc.length - 1].y + 60 * S); g.lineTo(arc[0].x - 30 * S, arc[0].y + 60 * S); g.closePath();
        g.fillStyle = shadeFill(x0, x1, arc[0].y, R.skirtColor); g.fill();
        g.strokeStyle = look.trim; g.lineWidth = 2.2 * S; polyline(arc); g.stroke();
      }
    }
    // 女：胸下柔影
    if (fem && fine && fv > 0.1 && look.waistline !== 'chest') {
      const a = P(surf(14.6, 0.6)), b = P(surf(14.6, -0.6)), c2 = P(surf(13.4, 0));
      g.strokeStyle = rgba(shade(baseCol, -0.5), 0.22 * fv); g.lineWidth = 1.6 * S;
      g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(c2.x, c2.y + 1.2 * S, b.x, b.y); g.stroke();
    }
    // 衣褶：腋下 → 腰
    if (fine) {
      g.strokeStyle = rgba(shade(baseCol, -0.5), 0.3); g.lineWidth = lw * 0.7;
      for (const s of [0.72, -0.72]) { const a = P(surf(19.5, s)), b = P(surf(10.5, s * 0.55)); g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2 + s * 0.8 * S, (a.y + b.y) / 2, b.x, b.y); g.stroke(); }
    }
    const fa = Math.min(1, Math.max(0, fv * 2.4));
    if (fv > 0.02) {
      g.save(); g.globalAlpha *= fa;
      const yN = rings[5].y - 0.6, yW = 8.8;
      if (overTorso || R.collar === 'open') {
        // 对襟：中间露出内衫（或半臂下的长袍）
        const inner = overTorso ? look.robe : look.inner;
        const L0 = P(surf(yN, 0.34)), R0 = P(surf(yN, -0.34)), L1 = P(surf(yW, 0.2)), R1 = P(surf(yW, -0.2)), Lm = P(surf((yN + yW) / 2, 0.2)), Rm = P(surf((yN + yW) / 2, -0.2));
        g.fillStyle = inner;
        g.beginPath(); g.moveTo(L0.x, L0.y); g.quadraticCurveTo(Lm.x, Lm.y, L1.x, L1.y); g.lineTo(R1.x, R1.y); g.quadraticCurveTo(Rm.x, Rm.y, R0.x, R0.y); g.closePath(); g.fill();
        if (overTorso && R.collar === 'cross') crossCollar(0.55);
        g.strokeStyle = look.trim; g.lineWidth = 1.7 * S;
        g.beginPath(); g.moveTo(L0.x, L0.y); g.quadraticCurveTo(Lm.x, Lm.y, L1.x, L1.y); g.moveTo(R0.x, R0.y); g.quadraticCurveTo(Rm.x, Rm.y, R1.x, R1.y); g.stroke();
        if (E > 2.6 && look.pattern === 'flower') for (const q of [Lm, Rm]) dotFlower(g, q.x, q.y, 0.9 * S, shade(look.trim, 0.5));
      } else if (R.collar === 'round') {
        const arc = nearArc(ringAt(rings[5].y - 0.2), 0.9);
        if (arc.length > 1) { g.strokeStyle = inkOf(look.trim); g.lineWidth = 2.6 * S; polyline(arc); g.stroke(); g.strokeStyle = look.trim; g.lineWidth = 2.0 * S; polyline(arc); g.stroke(); }
        const a = P(surf(rings[5].y - 1.2, -0.42)), b = P(surf(rings[4].y - 1.6, -0.82));
        g.strokeStyle = rgba(shade(look.robe, -0.5), 0.5); g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      } else {
        crossCollar(1);
      }
      if (R.collar === 'high') {
        const r5 = rings[5];
        const lo = nearArc({ ...r5, y: r5.y - 0.3 }, 0.6), hi = nearArc({ ...r5, y: r5.y + 1.7 }, 0.45);
        if (lo.length > 1 && hi.length > 1) {
          g.beginPath(); g.moveTo(lo[0].x, lo[0].y); for (const q of lo) g.lineTo(q.x, q.y); for (let i = hi.length - 1; i >= 0; i--) g.lineTo(hi[i].x, hi[i].y); g.closePath();
          g.fillStyle = look.trim; g.fill(); g.strokeStyle = inkOf(look.trim); g.lineWidth = lw * 0.8; g.stroke();
        }
      }
      g.restore();
    } else if (fv < -0.2) {
      g.strokeStyle = rgba(shade(baseCol, -0.5), 0.45); g.lineWidth = lw * 0.7;
      const a = P(add(sk.chest, FW, -D.td)), b = P(add(add(sk.pelvis, U, 8), FW, -D.td));
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    // 轻甲：护心甲
    if (R.over === 'armor' && fv > -0.25) armorChest();
    g.restore();
    // 袈裟（斜披，不裁剪：可盖到下裳上）
    if (R.over === 'kasaya' && fv > -0.3) kasaya();
    belt();
  };
  const crossCollar = (alpha: number) => {
    const yN = rings[5].y - 0.4, yW = 8.6;
    const N = 9, edge: P2[] = [], innerC: P2[] = [];
    for (let i = 0; i <= N; i++) { const t = i / N; edge.push(P(surf(lerp(yN, yW, t), lerp(0.66, -0.9, Math.pow(t, 0.8))))); }
    for (let i = 0; i <= 5; i++) { const t = i / 5; innerC.push(P(surf(lerp(yN + 0.2, lerp(yN, yW, 0.32), t), lerp(-0.62, -0.02, t)))); }
    g.save(); g.globalAlpha *= alpha;
    g.lineCap = 'round';
    g.strokeStyle = look.inner; g.lineWidth = 1.9 * S; polyline(innerC); g.stroke();
    g.strokeStyle = inkOf(look.trim); g.lineWidth = 2.3 * S + lw * 1.4; polyline(edge); g.stroke();
    g.strokeStyle = look.trim; g.lineWidth = 2.3 * S; polyline(edge); g.stroke();
    if (fine) { g.strokeStyle = look.inner; g.lineWidth = 0.7 * S; const e2 = edge.slice(0, 4).map((q) => ({ x: q.x - 1.1 * S, y: q.y - 0.4 * S })); polyline(e2); g.stroke(); }
    if (E > 2.6 && look.pattern && look.pattern !== 'none') hemPattern(g, edge, 1.15 * S, look.pattern, shade(look.trim, 0.45), S);
    g.restore();
  };
  const armorChest = () => {
    const col = R.overColor;
    const pts = [P(surf(21.0, 0.72, 0.5)), P(surf(21.6, 0, 0.6)), P(surf(21.0, -0.72, 0.5)), P(surf(13.0, -0.82, 0.7)), P(surf(11.2, 0, 0.9)), P(surf(13.0, 0.82, 0.7))];
    smoothPoly(pts);
    g.fillStyle = shadeFill(pts[0].x, pts[2].x, pts[0].y, col); g.fill();
    g.strokeStyle = inkOf(col); g.lineWidth = lw; g.stroke();
    if (E > 2.2) {
      g.save(); smoothPoly(pts); g.clip();
      g.strokeStyle = rgba(shade(col, -0.45), 0.6); g.lineWidth = lw * 0.7;
      for (let y = 19.6; y > 11; y -= 1.7) { const row = [-0.85, -0.42, 0, 0.42, 0.85].map((s) => P(surf(y, s, 0.7))); g.beginPath(); for (let i = 0; i < row.length - 1; i++) { const a = row[i], b = row[i + 1]; g.moveTo(a.x, a.y); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.9 * S, b.x, b.y); } g.stroke(); }
      const hl = P(surf(18, 0.35, 0.8)); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(hl.x, hl.y, 2.6 * S, 1.4 * S, -0.4, 0, TAU); g.fill();
      g.restore();
      const c = P(surf(16.5, 0, 1.0)); g.fillStyle = '#c8a050'; g.beginPath(); g.arc(c.x, c.y, 1.3 * S, 0, TAU); g.fill(); g.strokeStyle = inkOf('#c8a050'); g.lineWidth = lw * 0.6; g.stroke();
    }
  };
  const kasaya = () => {
    const col = R.overColor;
    const N = 8, Lp: P2[] = [], Rp: P2[] = [];
    for (let i = 0; i <= N; i++) { const t = i / N, y = lerp(21.4, 2.5, t), s = lerp(0.78, -0.95, t); Lp.push(P(surf(y + 2.4, Math.min(0.98, s + 0.1), 0.6))); Rp.push(P(surf(y - 2.4, Math.max(-0.98, s - 0.12), 0.6))); }
    const all = [...Lp, ...Rp.reverse()];
    g.save(); g.globalAlpha *= Math.min(1, Math.max(0.2, fv * 2 + 0.4));
    g.beginPath(); all.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
    g.fillStyle = shadeFill(all[0].x, all[N].x, all[0].y, col); g.fill(); g.strokeStyle = inkOf(col); g.lineWidth = lw; g.stroke();
    if (E > 2) {
      g.save(); g.clip();
      g.strokeStyle = rgba(shade(col, 0.4), 0.55); g.lineWidth = lw * 0.8;
      for (let i = 1; i < N; i++) { const a = Lp[i], b = all[all.length - 1 - i]; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      g.restore();
      const rc = Lp[1]; g.strokeStyle = '#d8b860'; g.lineWidth = 0.9 * S; g.beginPath(); g.arc(rc.x, rc.y + 1 * S, 1.3 * S, 0, TAU); g.stroke();
    }
    g.restore();
  };
  const belt = () => {
    if (look.waistline === 'chest') return;
    const r0 = ringAt(7.0), r1 = ringAt(9.6);
    const lo = nearArc(r0, 0.85), hi = nearArc(r1, 0.75);
    if (lo.length < 2 || hi.length < 2) return;
    g.beginPath(); g.moveTo(lo[0].x, lo[0].y); polyCont(lo); g.lineTo(hi[hi.length - 1].x, hi[hi.length - 1].y);
    for (let i = hi.length - 1; i >= 0; i--) g.lineTo(hi[i].x, hi[i].y);
    g.closePath();
    g.fillStyle = look.belt; g.fill(); g.strokeStyle = inkOf(look.belt); g.lineWidth = lw * 0.85; g.stroke();
    if (fine) { g.strokeStyle = rgba(shade(look.belt, 0.45), 0.55); g.lineWidth = 0.6 * S; polyline(hi.map((q) => ({ x: q.x, y: q.y + 0.6 * S }))); g.stroke(); }
    // 带扣 / 结
    if (fv > 0.1) {
      const k = P(surf(8.3, -0.12, 1.0));
      g.fillStyle = look.trim === look.belt ? shade(look.belt, 0.4) : look.trim;
      g.beginPath(); g.ellipse(k.x, k.y, 1.25 * S, 1.05 * S, 0, 0, TAU); g.fill(); g.strokeStyle = inkOf(look.belt); g.lineWidth = lw * 0.6; g.stroke();
    }
  };
  const polyCont = (pts: P2[]) => { for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); };
  parts.push({ z: torsoZ, f: torso });

  // 齐胸襦裙的系带 / 腰带垂绦 / 腰间配饰
  {
    if (look.waistline === 'chest') {
      const K = P(surf(16.2, 0.05, 1.0));
      const s1 = strand('tie1', 6, 3.4, K.x, K.y, 2.4, 0.9), s2 = strand('tie2', 5, 3.4, K.x + 0.8 * S, K.y, 2.4, 0.9);
      parts.push({ z: K.z + 0.4, f: () => {
        if (fv < -0.1) return;
        ribbon(s2, 0.9, 0.6, look.belt); ribbon(s1, 1.0, 0.7, look.belt);
        g.fillStyle = look.belt; g.beginPath(); g.ellipse(K.x - 1.2 * S, K.y, 1.5 * S, 0.9 * S, 0.5, 0, TAU); g.ellipse(K.x + 1.4 * S, K.y, 1.5 * S, 0.9 * S, -0.5, 0, TAU); g.fill();
      } });
    }
    const kn3 = surf(8.2, -0.25, 1.2), K = P(kn3);
    if (look.sash && look.waistline !== 'chest') {
      const s1 = strand('sash1', 4, 3.6, K.x, K.y, 2.6), s2 = strand('sash2', 3, 3.6, K.x + 1.2 * S, K.y, 2.6);
      parts.push({ z: K.z + 0.2, f: () => { ribbon(s2, 1.8, 1.4, look.sash!); ribbon(s1, 2.0, 1.6, look.sash!); } });
    }
    if (look.waist && look.waist !== 'none') {
      const W = P(surf(7.6, 0.72, 1.2));
      const pend = strand('pend', 3, 3, W.x, W.y, 1.8);
      parts.push({ z: W.z + 0.3, f: () => {
        const ex = pend.x[pend.n - 1], ey = pend.y[pend.n - 1];
        g.strokeStyle = 'rgba(150,40,34,0.9)'; g.lineWidth = 0.7 * S;
        g.beginPath(); g.moveTo(W.x, W.y); g.lineTo(ex, ey); g.stroke();
        if (look.waist === 'jade') {
          g.fillStyle = '#a8d8bc'; g.beginPath(); g.arc(ex, ey + 1.8 * S, 1.9 * S, 0, TAU); g.fill(); g.strokeStyle = inkOf('#a8d8bc'); g.lineWidth = lw * 0.6; g.stroke();
          if (fine) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(ex - 0.6 * S, ey + 1.2 * S, 0.5 * S, 0, TAU); g.fill(); g.strokeStyle = 'rgba(190,40,40,0.85)'; g.lineWidth = 0.5 * S; g.beginPath(); for (const o of [-0.6, 0, 0.6]) { g.moveTo(ex + o * S, ey + 3.6 * S); g.lineTo(ex + o * 1.3 * S, ey + 6.2 * S); } g.stroke(); }
        } else if (look.waist === 'gourd') { g.fillStyle = '#c08a3a'; g.beginPath(); g.arc(ex, ey + 1.5 * S, 1.6 * S, 0, TAU); g.arc(ex, ey + 4.6 * S, 2.4 * S, 0, TAU); g.fill(); g.strokeStyle = inkOf('#c08a3a'); g.lineWidth = lw * 0.6; g.stroke(); }
        else { g.fillStyle = '#6a5038'; g.beginPath(); g.ellipse(ex, ey + 2.4 * S, 2.4 * S, 2.8 * S, 0, 0, TAU); g.fill(); g.strokeStyle = inkOf('#6a5038'); g.lineWidth = lw * 0.6; g.stroke(); if (fine) { g.strokeStyle = '#c8a050'; g.lineWidth = 0.5 * S; g.beginPath(); g.moveTo(ex - 1.8 * S, ey + 1 * S); g.lineTo(ex + 1.8 * S, ey + 1 * S); g.stroke(); } }
      } });
    }
  }

  // ---------- 背后配饰 ----------
  if (look.back && look.back !== 'none') {
    const bz = P(add(add(sk.chest, U, -4), FW, -D.td - 1.5)).z;
    const bp = (x: number, y: number, z: number) => P(add(add(add(sk.chest, LT, x), U, y), FW, z));
    parts.push({ z: bz, f: () => {
      if (look.back === 'sword') {
        const a = bp(-7, 9, -D.td - 1.2), b = bp(8, -19, -D.td - 1);
        tube(a, b, 1.3 * S, 1.1 * S, '#3a2a20');
        const h = bp(-9, 13, -D.td - 1.2);
        g.strokeStyle = '#b89a50'; g.lineWidth = 2.2 * S; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(h.x, h.y); g.stroke();
        g.strokeStyle = '#d8c070'; g.lineWidth = 1.6 * S; const gx = bp(-7.6, 10.2, -D.td - 1.2);
        g.beginPath(); g.moveTo(gx.x - 2.4 * S, gx.y + 1.2 * S); g.lineTo(gx.x + 2.4 * S, gx.y - 1.2 * S); g.stroke();
      } else if (look.back === 'basket') {
        const c = bp(0, -6, -D.td - 4), w = 7 * S * (0.45 + 0.55 * Math.abs(cy));
        g.fillStyle = '#b8935a'; g.beginPath(); g.moveTo(c.x - w, c.y - 9 * S); g.lineTo(c.x + w, c.y - 9 * S); g.lineTo(c.x + w * 0.8, c.y + 9 * S); g.lineTo(c.x - w * 0.8, c.y + 9 * S); g.closePath(); g.fill();
        g.strokeStyle = inkOf('#b8935a'); g.lineWidth = lw * 0.7; g.stroke();
        g.strokeStyle = 'rgba(90,64,30,0.6)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(c.x + i * w / 3, c.y - 9 * S); g.lineTo(c.x + i * w / 3.6, c.y + 9 * S); g.stroke(); }
        g.fillStyle = '#5f8a4a'; g.beginPath(); g.ellipse(c.x, c.y - 9.5 * S, w * 0.9, 2.5 * S, 0, 0, TAU); g.fill();
      } else if (look.back === 'box') {
        const c = bp(0, -4, -D.td - 3.5), w = 6 * S * (0.5 + 0.5 * Math.abs(cy));
        g.fillStyle = '#6a4630'; g.fillRect(c.x - w, c.y - 10 * S, w * 2, 18 * S); g.strokeStyle = inkOf('#6a4630'); g.lineWidth = lw * 0.7; g.strokeRect(c.x - w, c.y - 10 * S, w * 2, 18 * S);
        g.fillStyle = '#c8a860'; g.fillRect(c.x - w, c.y - 3 * S, w * 2, 1.4 * S);
      }
    } });
  }

  // ---------- 手臂、袖、手 ----------
  const hd = { g, P, cam, S, E, skin: look.skin, lw };
  const hk = D.handK;
  const fxCol = look.swordColor || '#7ff0c0';
  const headZ = hed.z;
  const arm = (side: 1 | -1) => {
    const sh = side > 0 ? sk.lSh : sk.rSh, el = side > 0 ? sk.lEl : sk.rEl, wr = side > 0 ? sk.lWr : sk.rWr, H = side > 0 ? sk.lH : sk.rH;
    const curl = st.hands[side > 0 ? 0 : 1];
    const S0 = P(sh), E2 = P(el), W2 = P(wr);
    const fdir = nrm(sub(wr, el));
    const facing = cam(fdir);                       // 前臂指向镜头（>0 袖口朝向我们）
    let z = (E2.z + W2.z) / 2 + 0.6;
    const fxv = side > 0 ? pose.lFx : pose.rFx;
    const wide = look.sleeve === 'wide', cuffed = look.sleeve === 'cuffed';
    const upCol = R.over === 'banbi' || R.over === 'beizi' ? R.overColor : look.robe;
    const rUp = (fem ? 2.75 : 3.25) * (0.86 + 0.14 * B.heft);
    // 广袖：袖底垂布挂在肘下，随重力与惯性摆动
    const dx = W2.x - E2.x, dy = W2.y - E2.y, d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d;
    const outward = (E2.x - che.x) * nx + (E2.y - che.y) * ny;
    if (ny < -0.35 || (Math.abs(ny) <= 0.35 && outward < 0)) { nx = -nx; ny = -ny; }
    const r0 = rUp * 1.05 * S;
    const hang = wide ? strand('sleeve' + side, 5, 3.0 + 1.2 * R.sleeveK, E2.x + nx * r0, E2.y + ny * r0, 2.0, 1) : null;
    // 袖口圆（垂直于前臂）
    let u1 = crs(fdir, v(0, 1, 0)); if (len3(u1) < 0.2) u1 = crs(fdir, v(1, 0, 0)); u1 = nrm(u1);
    const u2 = crs(fdir, u1);
    const rc = (wide ? 3.5 + 0.7 * R.sleeveK : 2.6) * (fem ? 0.92 : 1);
    const cuffC = add(wr, fdir, wide ? 0.4 : 0.1);
    const cuff = (r: number) => { const o: P2[] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; o.push(P(add(add(cuffC, u1, Math.cos(a) * r), u2, Math.sin(a) * r))); } return o; };
    // 举到脸前的手要盖过头
    if (W2.z > headZ + 1.5 && wr.y > sk.chest.y - 6) z = torsoZ + 3.5;
    return {
      z, f: () => {
        const hand = () => {
          // 出手残影（施法 / 受击时手快速划过）
          const rel = { x: 0, y: 0 };
          const hc = P(add(wr, H.a, PALM_L * 0.6 * hk));
          rel.x = hc.x - bx; rel.y = hc.y - by;
          const i0 = side > 0 ? 0 : 2;
          if (!opts.ghost && physDt > 0) {
            const px = st.hp[i0], py = st.hp[i0 + 1];
            if ((st.action === 'cast' || st.action === 'hit' || st.action === 'dodge') && !isNaN(px)) {
              const vx = (rel.x - px) / physDt, vy = (rel.y - py) / physDt, sp = Math.hypot(vx, vy);
              if (sp > 140 * S) {
                const k = Math.min(1, (sp - 140 * S) / (500 * S));
                g.save(); g.lineCap = 'round';
                g.strokeStyle = rgba(fxv > 0.05 ? fxCol : '#fff8ec', 0.32 * k); g.lineWidth = 4.2 * hk * S;
                g.beginPath(); g.moveTo(bx + px, by + py); g.lineTo(hc.x, hc.y); g.stroke();
                g.strokeStyle = rgba('#ffffff', 0.5 * k); g.lineWidth = 1.4 * hk * S;
                g.beginPath(); g.moveTo(bx + (px + rel.x) / 2, by + (py + rel.y) / 2); g.lineTo(hc.x, hc.y); g.stroke();
                g.restore();
              }
            }
            st.hp[i0] = rel.x; st.hp[i0 + 1] = rel.y;
          }
          // 手持之物：杖在手后，扇在手前
          if (side < 0 && look.hand === 'staff') {
            const c = add(wr, H.a, PALM_L * 0.55 * hk);
            const tdir = H.t.y >= 0 ? H.t : { x: -H.t.x, y: -H.t.y, z: -H.t.z };
            const down = Math.max(10, c.y / Math.max(0.3, tdir.y));
            const bot = P(add(c, tdir, -down)), topp = P(add(c, tdir, 24));
            tube(bot, topp, 0.62 * S, 0.8 * S, '#6a4a2a');
            g.fillStyle = '#b07a32'; g.beginPath(); g.arc(topp.x, topp.y - 1.1 * S, 1.05 * S, 0, TAU); g.arc(topp.x, topp.y + 0.9 * S, 1.45 * S, 0, TAU); g.fill(); g.strokeStyle = inkOf('#b07a32'); g.lineWidth = lw * 0.6; g.stroke();
            g.strokeStyle = 'rgba(170,40,34,0.9)'; g.lineWidth = 0.5 * S; g.beginPath(); g.moveTo(topp.x, topp.y); g.lineTo(topp.x + 1.2 * S, topp.y + 5 * S); g.stroke();
          }
          const geo = drawHand(hd, H, curl, hk);
          if (side < 0 && look.hand === 'fan') fan(add(wr, H.a, PALM_L * 0.8 * hk), H);
          // 劲气：指尖灵光 + 劲风
          if (fxv > 0.04) {
            const tp = P(geo.tip), wp = P(wr);
            const r = (4 + 7 * fxv) * S;
            g.save(); g.globalCompositeOperation = 'lighter';
            const gr = g.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r);
            gr.addColorStop(0, rgba('#ffffff', Math.min(1, 0.8 * fxv))); gr.addColorStop(0.35, rgba(fxCol, 0.55 * fxv)); gr.addColorStop(1, rgba(fxCol, 0));
            g.fillStyle = gr; g.beginPath(); g.arc(tp.x, tp.y, r, 0, TAU); g.fill();
            const ang = Math.atan2(tp.y - wp.y, tp.x - wp.x);
            g.strokeStyle = rgba(fxCol, 0.7 * fxv); g.lineWidth = 0.8 * S;
            for (let i = -1; i <= 1; i++) {
              const a2 = ang + i * 0.5, r1 = r * (0.7 + 0.15 * Math.sin(st.t * 30 + i)), r2 = r * (1.5 + 0.4 * fxv);
              g.beginPath(); g.moveTo(tp.x + Math.cos(a2) * r1, tp.y + Math.sin(a2) * r1); g.lineTo(tp.x + Math.cos(a2) * r2, tp.y + Math.sin(a2) * r2); g.stroke();
            }
            g.restore();
          }
        };
        // 上臂
        tube(S0, E2, rUp * S, (wide ? rUp * 1.12 : rUp * 0.85) * S, upCol);
        if (R.over === 'banbi') {
          // 半臂袖口：肘上翻出的短袖镶边
          const m = P(lerpV(sh, el, 0.78));
          g.strokeStyle = look.trim; g.lineWidth = 1.6 * S;
          g.beginPath(); g.moveTo(m.x + nx * rUp * 1.15 * S, m.y + ny * rUp * 1.15 * S); g.lineTo(m.x - nx * rUp * 1.15 * S, m.y - ny * rUp * 1.15 * S); g.stroke();
        }
        if (R.over === 'armor') {
          // 肩吞：三片叠甲
          const col = R.overColor;
          for (let i = 2; i >= 0; i--) {
            const c = P(add(lerpV(sh, el, 0.08 + i * 0.16), U, 1.2 - i * 0.3));
            g.fillStyle = shade(col, -i * 0.06); g.beginPath(); g.ellipse(c.x, c.y, (rUp + 1.6 - i * 0.3) * S, (2.6 - i * 0.2) * S, Math.atan2(E2.y - S0.y, E2.x - S0.x) + Math.PI / 2, 0, TAU); g.fill();
            g.strokeStyle = inkOf(col); g.lineWidth = lw * 0.7; g.stroke();
          }
        }
        const handFirst = facing < -0.25;            // 手在袖后（指向远离镜头）
        if (handFirst) hand();
        if (wide && hang) {
          const pts: Pt[] = [];
          for (const q of cuff(rc)) pts.push(q);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pts.push(P(add(add(el, u1, Math.cos(a) * rUp * 1.02), u2, Math.sin(a) * rUp * 1.02))); }
          for (let i = 1; i < hang.n; i++) pts.push({ x: hang.x[i], y: hang.y[i] });
          const hull = convexHull(pts);
          smoothPoly(hull);
          let x0 = 1e9, x1 = -1e9, y0 = 1e9;
          for (const q of hull) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); }
          const sc = look.robe;
          g.fillStyle = shadeFill(x0, x1, y0, shade(sc, -0.03)); g.fill();
          g.strokeStyle = inkOf(sc); g.lineWidth = lw; g.stroke();
          if (fine) {
            g.save(); smoothPoly(hull); g.clip();
            g.strokeStyle = rgba(shade(sc, -0.5), 0.38); g.lineWidth = lw * 0.75;
            const e = hang.n - 1;
            g.beginPath(); g.moveTo(E2.x, E2.y); g.quadraticCurveTo((E2.x + hang.x[e]) / 2 + nx * 1.5 * S, (E2.y + hang.y[e]) / 2, hang.x[e], hang.y[e]);
            g.moveTo((E2.x + W2.x) / 2, (E2.y + W2.y) / 2); g.quadraticCurveTo((W2.x + hang.x[e]) / 2, (W2.y + hang.y[e]) / 2 + 1 * S, (hang.x[e] + W2.x) / 2 + nx * 2 * S, hang.y[e] - 1 * S);
            g.stroke();
            g.restore();
          }
          // 袖口：朝向镜头时看得见里子
          const cf = cuff(rc * 0.98);
          if (facing > 0.3) {
            const ci = cuff(rc * 0.72);
            g.beginPath(); ci.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath();
            g.fillStyle = rgba(shade(look.robe, -0.45), Math.min(0.55, (facing - 0.3) * 1.6)); g.fill();
          }
          g.strokeStyle = look.trim; g.lineWidth = 1.7 * S;
          g.beginPath(); cf.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke();
        } else {
          tube(E2, W2, (cuffed ? 3.1 : 3.2) * S * (fem ? 0.9 : 1), 2.6 * S * (fem ? 0.9 : 1), look.robe);
          if (cuffed) {
            const m = P(lerpV(el, wr, 0.4));
            tube(m, W2, 2.95 * S * (fem ? 0.9 : 1), 2.7 * S * (fem ? 0.9 : 1), R.cuff);
            if (E > 2.4) { g.strokeStyle = rgba(shade(R.cuff, 0.4), 0.6); g.lineWidth = 0.5 * S; g.beginPath(); for (const k of [0.3, 0.6]) { const q = { x: m.x + (W2.x - m.x) * k, y: m.y + (W2.y - m.y) * k }; g.moveTo(q.x + nx * 2.7 * S, q.y + ny * 2.7 * S); g.lineTo(q.x - nx * 2.7 * S, q.y - ny * 2.7 * S); } g.stroke(); }
          } else {
            g.strokeStyle = look.trim; g.lineWidth = 1.4 * S;
            g.beginPath(); g.moveTo(W2.x + nx * 2.7 * S, W2.y + ny * 2.7 * S); g.lineTo(W2.x - nx * 2.7 * S, W2.y - ny * 2.7 * S); g.stroke();
          }
        }
        if (!handFirst) hand();
      },
    };
  };
  const fan = (pivot: V3, H: HandFrame) => {
    const Rf = 9.5 * hk, pts: P2[] = [], inner: P2[] = [];
    for (let i = 0; i <= 10; i++) {
      const th = -1.0 + (i / 10) * 2.0;
      const dir = add({ x: H.a.x * Math.cos(th), y: H.a.y * Math.cos(th), z: H.a.z * Math.cos(th) }, H.t, Math.sin(th));
      pts.push(P(add(pivot, dir, Rf))); inner.push(P(add(pivot, dir, Rf * 0.42)));
    }
    const pv = P(pivot);
    g.beginPath(); g.moveTo(inner[0].x, inner[0].y); for (const q of pts) g.lineTo(q.x, q.y); for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i].x, inner[i].y); g.closePath();
    g.fillStyle = '#f2ead8'; g.fill(); g.strokeStyle = inkOf('#e8dcc0'); g.lineWidth = lw * 0.7; g.stroke();
    g.strokeStyle = 'rgba(120,90,60,0.6)'; g.lineWidth = Math.max(0.3, 0.3 * S);
    g.beginPath(); for (let i = 0; i <= 10; i += 2) { g.moveTo(pv.x, pv.y); g.lineTo(pts[i].x, pts[i].y); } g.stroke();
    if (E > 2.5) { g.strokeStyle = 'rgba(60,70,60,0.5)'; g.lineWidth = 0.5 * S; g.beginPath(); g.moveTo(lerp(inner[2].x, pts[2].x, 0.7), lerp(inner[2].y, pts[2].y, 0.7)); g.quadraticCurveTo(lerp(inner[5].x, pts[5].x, 0.45), lerp(inner[5].y, pts[5].y, 0.45), lerp(inner[8].x, pts[8].x, 0.75), lerp(inner[8].y, pts[8].y, 0.75)); g.stroke(); }
  };
  const armL = arm(1), armR = arm(-1);
  for (const a of [armL, armR]) parts.push({ z: a.z > torsoZ + 3 ? a.z : a.z < torsoZ - 2.2 ? Math.min(a.z, torsoZ - 2.5) : torsoZ + 0.4 + (a.z - torsoZ) * 0.01, f: a.f });

  // 披帛：从背后绕过双臂，自肘弯垂落，随风飘曳
  if (look.shawl) {
    const lE = P(add(sk.lEl, v(1.5, -1, -1))), rE = P(add(sk.rEl, v(-1.5, -1, -1)));
    const s1 = strand('shawlL', 9, 4.0, lE.x, lE.y, 1.4, 0.72), s2 = strand('shawlR', 9, 4.0, rE.x, rE.y, 1.4, 0.72);
    const lB = P(add(sk.lSh, add(U, FW, -D.td - 0.5), -2.4)), rB = P(add(sk.rSh, add(U, FW, -D.td - 0.5), -2.4));
    const mid = P(add(add(sk.chest, U, -11), FW, -D.td - 2));
    const zb = P(add(sk.chest, FW, -D.td - 2)).z;
    const col = rgba(look.shawl, 0.78), edge = rgba(shade(look.shawl, -0.35), 0.6);
    parts.push({ z: zb, f: () => {
      g.strokeStyle = col; g.lineWidth = 2.4 * S;
      g.beginPath(); g.moveTo(lE.x, lE.y); g.quadraticCurveTo(lB.x, lB.y, mid.x, mid.y); g.quadraticCurveTo(rB.x, rB.y, rE.x, rE.y); g.stroke();
    } });
    const flow = (s: Strand, ph: number) => {
      const n = s.n; const L: [number, number][] = [], Rr: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        const dx = s.x[i1] - s.x[i0], dy = s.y[i1] - s.y[i0], d = Math.hypot(dx, dy) || 1;
        const t = i / (n - 1);
        const wob = Math.sin(t * 5 + st.t * 2.2 + ph) * 1.6 * S * t;
        const w = (1.6 - 0.5 * t) * S * (0.6 + 0.4 * Math.abs(Math.cos(t * 4 + st.t * 1.7 + ph)));
        const cx = s.x[i] - dy / d * wob, cyy = s.y[i] + dx / d * wob;
        L.push([cx - dy / d * w, cyy + dx / d * w]); Rr.push([cx + dy / d * w, cyy - dx / d * w]);
      }
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
      g.lineTo(L[n - 1][0], L[n - 1][1]); g.lineTo(Rr[n - 1][0], Rr[n - 1][1]);
      for (let i = n - 2; i >= 0; i--) g.quadraticCurveTo(Rr[i + 1][0], Rr[i + 1][1], (Rr[i + 1][0] + Rr[i][0]) / 2, (Rr[i + 1][1] + Rr[i][1]) / 2);
      g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = edge; g.lineWidth = Math.max(0.3, 0.3 * S); g.stroke();
    };
    const zl = (P(sk.lEl).z + P(sk.lWr).z) / 2 + 0.8, zr = (P(sk.rEl).z + P(sk.rWr).z) / 2 + 0.8;
    parts.push({ z: zl, f: () => flow(s1, 0) });
    parts.push({ z: zr, f: () => flow(s2, 1.7) });
  }

  // ---------- 头部（3D 头型 + 发际线投影 + 五官）----------
  const hkH = D.hk * (fem ? 0.95 : 1);
  const Hd = R.head;
  const hyaw = pose.headYaw, chy = Math.cos(hyaw), shy = Math.sin(hyaw);
  const hp = (pose.headPitch + B.stoop * -0.15) * 0.8, chp = Math.cos(hp), shp = Math.sin(hp);
  const Yh = yaw + hyaw, cY = Math.cos(Yh), sY = Math.sin(Yh);
  const HP = (x: number, y: number, z: number): P2 => {
    x *= hkH; y *= hkH; z *= hkH;
    const y2 = y * chp - z * shp, z2 = y * shp + z * chp;
    return P(add(sk.head, v(x * chy + z2 * shy, y2, -x * shy + z2 * chy)));
  };
  const visN = (nx: number, ny: number, nz: number) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    const ny2 = ny * chp - nz * shp, nz2 = ny * shp + nz * chp;
    const X = nx * chy + nz2 * shy, Z = -nx * shy + nz2 * chy;
    return (ny2 * SP + (-X * sy + Z * cy) * CP) / l;
  };
  const style = look.hairStyle;
  const texHead = look.headTex && headTexReady(look.headTex) ? look.headTex : null;
  const bald = style === 'bald';
  const drape = style === 'long' || style === 'halfup' || style === 'twin';
  const fringe = R.fringe;
  const blink = pose.eyes > 0.5 && ((st.t * 0.9 + st.seed) % 4.3) < 0.13;
  const dHead = E * hkH;
  const surfH = (a: number, y: number, inf = 1) => {
    const yy = Math.max(-2.2, Math.min(y, 6.75));
    const f = Math.sqrt(Math.max(0.04, 1 - ((yy - 1) / 5.8) ** 2));
    let rx = 4.8 * Hd.width * f * inf, rz = 5.3 * f * inf;
    if (y < -2.2) { const k = Math.max(0.6, 1 + (y + 2.2) * 0.1); rx *= k; rz *= k; }
    const x = Math.sin(a) * rx, z = Math.cos(a) * rz - 0.3;
    return { x, y, z, n: visN(x / 22.6, (yy - 1) / 33.6, (z + 0.3) / 28.1) };
  };
  const hairline = (a: number) => {
    const t = Math.abs(a);
    let y = t < 0.9 ? 3.25 - t / 0.9 * 1.25 : t < 1.6 ? 2.0 - (t - 0.9) / 0.7 * 1.1 : 0.9 - (t - 1.6) / (Math.PI - 1.6) * 5.1;
    if (drape && t > 1.15) y = Math.min(y, 2.0 - (t - 1.15) * 7);
    if (fringe === 'part' && t < 0.22) y += 0.55 * (1 - t / 0.22);
    if (fringe === 'full' && t < 0.85) y = Math.min(y, 2.5);
    if (fringe === 'side' && a > -0.2 && a < 0.9) y = Math.min(y, 2.7);
    return y;
  };
  const hullLocal = headHullPts(Hd, fem);
  // ---- 背后长发 ----
  if (drape && !texHead) {
    const nape = HP(0, -1.2, -4.4);
    const Lh = fem ? (style === 'twin' ? 4.8 : 6.6) : 5.2;
    const s = strand('hairLong', 6, Lh, nape.x, nape.y, 1.5, 1.05);
    const zz = P(add(sk.chest, FW, -D.td - 1)).z;
    parts.push({ z: zz, f: () => {
      const lt = HP(4.95 * Hd.width, 1.4, -0.9), rt = HP(-4.95 * Hd.width, 1.4, -0.9), top = HP(0, 7.2, -1.2);
      const W0 = Math.max(Math.abs(lt.x - rt.x) / 2, 3.2 * S) * (fem ? 1.04 : 0.98);
      const xs = [nape.x, ...Array.from(s.x)], ys = [nape.y, ...Array.from(s.y)];
      const m = xs.length; const Lp: [number, number][] = [], Rp: [number, number][] = [];
      for (let i = 0; i < m; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
        const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
        const t = i / (m - 1);
        const w = W0 * (1.04 - 0.46 * t * t) * (1 + 0.06 * Math.sin(t * 5 + st.t * 1.3));
        Lp.push([xs[i] - dy / d * w, ys[i] + dx / d * w]); Rp.push([xs[i] + dy / d * w, ys[i] - dx / d * w]);
      }
      const path = () => {
        g.beginPath();
        g.moveTo(lt.x, lt.y);
        g.quadraticCurveTo(Lp[0][0], (lt.y + Lp[0][1]) / 2, Lp[1][0], Lp[1][1]);
        for (let i = 2; i < m; i++) g.quadraticCurveTo(Lp[i - 1][0], Lp[i - 1][1], (Lp[i - 1][0] + Lp[i][0]) / 2, (Lp[i - 1][1] + Lp[i][1]) / 2);
        const e = m - 1, ex = xs[e], ey = ys[e], ldx = Lp[e][0] - ex, ldy = Lp[e][1] - ey;
        const dx = xs[e] - xs[e - 1], dy = ys[e] - ys[e - 1], dl = Math.hypot(dx, dy) || 1, fx = dx / dl, fy = dy / dl;
        g.lineTo(Lp[e][0], Lp[e][1]);
        g.lineTo(ex + ldx * 0.55 + fx * 3.2 * S, ey + ldy * 0.55 + fy * 3.2 * S);
        g.lineTo(ex + ldx * 0.25, ey + ldy * 0.25);
        g.lineTo(ex + fx * 4.2 * S, ey + fy * 4.2 * S);
        g.lineTo(ex - ldx * 0.25, ey - ldy * 0.25);
        g.lineTo(ex - ldx * 0.55 + fx * 2.6 * S, ey - ldy * 0.55 + fy * 2.6 * S);
        g.lineTo(Rp[e][0], Rp[e][1]);
        for (let i = m - 2; i >= 1; i--) g.quadraticCurveTo(Rp[i + 1][0], Rp[i + 1][1], (Rp[i + 1][0] + Rp[i][0]) / 2, (Rp[i + 1][1] + Rp[i][1]) / 2);
        g.quadraticCurveTo(Rp[0][0], (rt.y + Rp[0][1]) / 2, rt.x, rt.y);
        g.bezierCurveTo(rt.x, top.y - 1 * S, lt.x, top.y - 1 * S, lt.x, lt.y);
        g.closePath();
      };
      path();
      if (fine) { const gr = g.createLinearGradient(0, top.y, 0, ys[m - 1] + 4 * S); gr.addColorStop(0, shade(look.hair, 0.12)); gr.addColorStop(0.5, look.hair); gr.addColorStop(1, shade(look.hair, -0.25)); g.fillStyle = gr; }
      else g.fillStyle = look.hair;
      g.fill();
      g.strokeStyle = inkOf(look.hair); g.lineWidth = lw * 0.85; g.stroke();
      if (fine) {
        g.save(); path(); g.clip();
        g.lineWidth = Math.max(0.35, 0.3 * S);
        for (let k = -4; k <= 4; k++) {
          const f = k / 4.6;
          g.strokeStyle = k % 2 ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.26)';
          g.beginPath();
          for (let i = 0; i < m; i++) {
            const x = xs[i] + (Lp[i][0] - xs[i]) * f, y = ys[i] + (Lp[i][1] - ys[i]) * f;
            if (i === 0) g.moveTo(lt.x + (rt.x - lt.x) * (0.5 - f / 2), top.y + 3 * S); else g.lineTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      }
    } });
  }
  // ---- 发髻、发带、马尾 ----
  const bunL = style === 'ponytail' ? [0, 5.0, -4.7] : style === 'updo' ? [0, 7.5, -2.8] : style === 'halfup' ? [0, 5.6, -3.9] : [0, 6.95, -1.4];
  const bun = HP(bunL[0], bunL[1], bunL[2]);
  const hairBackZ = P(add(sk.head, v(0, 0, -6))).z;
  let ribbons: Strand[] = [];
  if (look.ribbon && !bald && !texHead) {
    const rb = style === 'twin' ? [HP(3.9, 5.2, -1.4), HP(-3.9, 5.2, -1.4)] : [{ x: bun.x - 0.8 * S, y: bun.y + 1 * S }, { x: bun.x + 0.8 * S, y: bun.y + 1 * S }];
    ribbons = [strand('rib1', 6, fem ? 4.2 : 3.6, rb[0].x, rb[0].y, 2.6, 0.7), strand('rib2', 5, fem ? 4.6 : 3.6, rb[1].x, rb[1].y, 2.6, 0.7)];
  }
  const ponytail = style === 'ponytail' && !texHead ? strand('pony', 6, fem ? 5.2 : 4.6, bun.x, bun.y, 1.8, 1) : null;
  const lockA = HP(5.2 * Hd.width, -0.4, 0.4), lockB = HP(-5.2 * Hd.width, -0.4, 0.4);
  const locks = (drape || fringe === 'part') && !texHead && !bald ? [strand('lockL', 5, 3.4, lockA.x, lockA.y, 1.6, 1), strand('lockR', 5, 3.4, lockB.x, lockB.y, 1.6, 1)] : [];
  const wA = HP(4.35 * Hd.width, 2.2, 2.6), wB = HP(-4.35 * Hd.width, 2.2, 2.6);
  const wisps = fringe === 'wisp' && !texHead && !bald ? [strand('wispL', 5, 2.2, wA.x, wA.y, 1.2, 0.9), strand('wispR', 5, 2.2, wB.x, wB.y, 1.2, 0.9)] : [];
  const pinA = HP(2.6, 6.2, -1.8);
  const tassel = look.pin === 'gold' || look.pin === 'jade' ? strand('tassel', 4, 1.5, pinA.x + 1.5 * S, pinA.y, 1.2, 1) : null;
  if (ribbons.length) parts.push({ z: Math.min(hairBackZ, bun.z) - 0.5, f: () => { for (const r of ribbons) ribbon(r, 1.6, 1.0, look.ribbon!, true); } });
  if (ponytail) parts.push({ z: bun.z - 0.6, f: () => ribbon(ponytail, 4.4, 1.2, look.hair, true) });

  const drawBun = (c: P2, rx: number, ry: number) => {
    if (fine) {
      const gr = g.createRadialGradient(c.x - rx * 0.35, c.y - ry * 0.4, 0, c.x, c.y, rx * 1.2);
      gr.addColorStop(0, shade(look.hair, 0.3)); gr.addColorStop(0.6, look.hair); gr.addColorStop(1, shade(look.hair, -0.2));
      g.fillStyle = gr;
    } else g.fillStyle = look.hair;
    g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = inkOf(look.hair); g.lineWidth = lw * 0.8; g.stroke();
    if (fine) {
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(0.35, 0.3 * S);
      g.beginPath(); g.ellipse(c.x + rx * 0.1, c.y + ry * 0.05, rx * 0.62, ry * 0.55, 0.3, 0.4, 4.2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.24)'; g.lineWidth = Math.max(0.4, 0.5 * S);
      g.beginPath(); g.ellipse(c.x, c.y, rx * 0.7, ry * 0.6, 0, Math.PI * 1.1, Math.PI * 1.65); g.stroke();
    }
  };

  const texHeadDraw = (name: string) => {
    const a = Math.atan2(sY, cY), aa = Math.abs(a);
    const view: HeadView = aa < 0.39 ? 'front' : aa < 1.18 ? 'q' : aa < 1.96 ? 'side' : aa < 2.75 ? 'qb' : 'back';
    const flip = (view === 'q' || view === 'side' || view === 'qb') && a < 0;
    const nb = P(add(sk.chest, U, HEAD_NECK_UP)), top = HP(0, HEAD_TOP_Y, -1.2);
    const Hh = Math.max(4, (nb.y - top.y) * HEAD_TEX_K);
    const t = headTex(name, view, Hh); if (!t) return false;
    const W = Hh * t.img.w / t.img.h, ang = Math.atan2(hed.x - nb.x, nb.y - hed.y) * 0.7;
    g.save(); g.translate(nb.x, nb.y + Hh * HEAD_NECK_SINK); g.rotate(ang); if (flip) g.scale(-1, 1);
    g.imageSmoothingQuality = 'high'; g.drawImage(t.src, -t.img.neckX * W, -Hh, W, Hh); g.restore();
    return true;
  };

  const headDraw = () => {
    if (texHead && texHeadDraw(texHead)) return;
    // 颈
    const neckTop = HP(0, -4.6, -0.7), neckBot = P(add(sk.chest, U, 2.6));
    const nr = (fem ? 1.75 : 2.15) * hkH * Hd.width;
    tube(neckBot, neckTop, nr * S, nr * 0.92 * S, shade(look.skin, -0.06), rgba(shade(look.skin, -0.55), 0.85));
    if (fine) { g.fillStyle = rgba(shade(look.skin, -0.45), 0.28); g.beginPath(); g.ellipse(neckTop.x, neckTop.y + 0.8 * S, nr * S * 1.05, nr * S * 0.55, 0, 0, TAU); g.fill(); }
    if (bun.z < hed.z - 0.5 && (style === 'bun' || style === 'crown' || style === 'halfup' || style === 'updo')) drawBun(bun, (style === 'updo' ? 3.4 : 2.9) * S * hkH, (style === 'updo' ? 3.0 : 2.5) * S * hkH);
    if (style === 'twin') for (const sx of [1, -1]) { const b = HP(sx * 3.7, 5.9, -1.1); if (b.z < hed.z) drawBun(b, 2.5 * S * hkH, 2.3 * S * hkH); }
    // 轮廓
    const hull = convexHull(hullLocal.map(([x, y, z]) => HP(x, y, z)));
    const sil = () => smoothPoly(hull);
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const q of hull) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    sil(); g.fillStyle = look.skin; g.fill();
    g.save(); sil(); g.clip();
    if (fine) {
      // 面部明暗：左上受光；远侧脸颊、下颌柔影
      const lg = g.createLinearGradient(minX, minY, maxX, maxY);
      lg.addColorStop(0, 'rgba(255,248,236,0.26)'); lg.addColorStop(0.55, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(150,72,52,0.24)');
      g.fillStyle = lg; g.fillRect(minX, minY, maxX - minX, maxY - minY);
    }
    const faceVis = visN(0, -0.1, 1);
    if (faceVis > -0.25) {
      const fc: FaceCtx = { g, HP, vis: visN, d: dHead, f: R.face, fem, closed: pose.eyes < 0.5 || blink, sY, hair: look.hair, lip: look.lip, lash: look.lash ?? fem, huadian: look.huadian, mouthOpen: pose.mouth, gaze: -shy * 0.6 };
      drawFace(fc);
    }
    // ---- 头发（发际线以上）----
    if (!bald) {
      const N = 36; const pts: { x: number; y: number; n: number; a: number }[] = [];
      for (let i = 0; i < N; i++) {
        const a = -Math.PI + (i / N) * TAU;
        const s = surfH(a, hairline(a), 1.06); const q = HP(s.x, s.y, s.z);
        pts.push({ x: q.x, y: q.y, n: s.n, a });
      }
      let best = -1, bestLen = 0;
      for (let i = 0; i < N; i++) {
        if (pts[i].n <= 0 || pts[(i - 1 + N) % N].n > 0) continue;
        let l = 0; while (l < N && pts[(i + l) % N].n > 0) l++;
        if (l > bestLen) { bestLen = l; best = i; }
      }
      const cx = (minX + maxX) / 2, BIG = 60 * S;
      const hairPath = (oy: number) => {
        g.beginPath();
        if (best < 0) { g.rect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4); return; }
        const run = []; for (let l = 0; l < bestLen; l++) run.push(pts[(best + l) % N]);
        const A = run[0], Bq = run[run.length - 1];
        const sa = Math.sign(A.x - cx) || -1, sb = Math.sign(Bq.x - cx) || 1;
        g.moveTo(A.x + sa * BIG, A.y + oy); g.lineTo(A.x, A.y + oy);
        for (let i = 1; i < run.length; i++) g.quadraticCurveTo(run[i - 1].x, run[i - 1].y + oy, (run[i - 1].x + run[i].x) / 2, (run[i - 1].y + run[i].y) / 2 + oy);
        g.lineTo(Bq.x, Bq.y + oy); g.lineTo(Bq.x + sb * BIG, Bq.y + oy); g.lineTo(Bq.x + sb * BIG, minY - BIG); g.lineTo(A.x + sa * BIG, minY - BIG); g.closePath();
      };
      // 发际线下的淡影（头发投在额上）
      if (fine && faceVis > 0 && best >= 0) { hairPath(0.75 * hkH * S); g.fillStyle = rgba(shade(look.skin, -0.5), 0.18); g.fill(); }
      hairPath(0);
      g.save(); g.clip();
      if (fine) {
        const hg = g.createLinearGradient(minX, minY, maxX, maxY);
        hg.addColorStop(0, shade(look.hair, 0.24)); hg.addColorStop(0.5, look.hair); hg.addColorStop(1, shade(look.hair, -0.25));
        g.fillStyle = hg;
      } else g.fillStyle = look.hair;
      g.fillRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
      if (fine) {
        const crown = HP(0, 7.0, -0.8);
        g.lineWidth = Math.max(0.3, 0.26 * S);
        for (let i = 0; i < N; i += (dHead > 4 ? 1 : 2)) {
          const p = pts[i]; if (p.n < -0.2) continue;
          const mid = surfH(p.a, (hairline(p.a) + 6.5) / 2, 1.13); const mq = HP(mid.x, mid.y, mid.z);
          g.strokeStyle = i % 4 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)';
          g.beginPath(); g.moveTo(crown.x, crown.y); g.quadraticCurveTo(mq.x, mq.y, p.x, p.y); g.stroke();
        }
        // 光泽环
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.3 * S; g.beginPath();
        let started = false;
        for (let i = 0; i <= 24; i++) {
          const a = -Math.PI + (i / 24) * TAU; const s = surfH(a, 4.4, 1.07);
          if (s.n <= 0.05) { started = false; continue; }
          const q = HP(s.x, s.y, s.z); if (!started) { g.moveTo(q.x, q.y); started = true; } else g.lineTo(q.x, q.y);
        }
        g.stroke();
      }
      g.restore();
      // 刘海
      if (faceVis > 0) {
        g.fillStyle = look.hair;
        if (fringe === 'full') {
          for (let i = -3; i <= 3; i++) {
            const a0 = i * 0.2; const s0 = surfH(a0 - 0.08, 3.4, 1.06), s1 = surfH(a0 + 0.1, 3.4, 1.06), s2 = surfH(a0 + 0.04 * Math.sign(i || 1), 1.75 + Math.abs(i) * 0.15 + (i % 2 ? 0.12 : 0), 1.08);
            if (s2.n < 0) continue;
            const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z);
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q0.x, q2.y - 1 * S, q2.x, q2.y); g.quadraticCurveTo(q1.x, q2.y - 1.2 * S, q1.x, q1.y); g.closePath(); g.fill();
          }
        } else if (fringe === 'side') {
          for (let i = 0; i < 5; i++) {
            const a0 = 0.75 - i * 0.32; const s0 = surfH(a0 + 0.12, 4.0, 1.06), s1 = surfH(a0 - 0.12, 3.8, 1.06), s2 = surfH(a0 - 0.42, 2.9 - i * 0.28, 1.09);
            if (s2.n < 0.05) continue;
            const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z);
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo((q0.x + q2.x) / 2, q0.y + 0.3 * S, q2.x, q2.y); g.quadraticCurveTo((q1.x + q2.x) / 2, q1.y + 1.2 * S, q1.x, q1.y); g.closePath(); g.fill();
          }
        } else if (fringe === 'part' && Math.abs(sY) < 0.5) {
          for (const sx of [1, -1]) {
            const s0 = surfH(sx * 0.1, 3.7, 1.07), s1 = surfH(sx * 0.55, 2.7, 1.08), s2 = surfH(sx * 0.95, 0.3, 1.1), s3 = surfH(sx * 1.2, 2.2, 1.07);
            if (s2.n < 0.2 || s1.n < 0.2) continue;
            const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z), q3 = HP(s3.x, s3.y, s3.z);
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y + 0.6 * S, q2.x, q2.y); g.quadraticCurveTo(q3.x, q3.y, q0.x, q0.y - 0.5 * S); g.closePath(); g.fill();
            if (fine) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(0.3, 0.3 * S); g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y + 0.2 * S, q2.x, q2.y); g.stroke(); }
          }
        }
      }
    }
    g.restore();
    // 耳
    if (!(drape && fem) || bald) {
      for (const sx of [1, -1]) {
        const k = visN(sx, 0, 0.35); if (k < 0.3) continue;
        const e = HP(sx * 4.75 * Hd.width, -0.7, -0.35), et = HP(sx * 4.9 * Hd.width, 0.6, -0.6);
        const ang = Math.atan2(et.y - e.y, et.x - e.x) + Math.PI / 2;
        g.fillStyle = shade(look.skin, -0.04);
        g.beginPath(); g.ellipse(e.x, e.y, 0.95 * S * hkH * Math.min(1, k * 1.5), 1.75 * S * hkH, ang, 0, TAU); g.fill();
        g.strokeStyle = rgba(shade(look.skin, -0.55), 0.8); g.lineWidth = Math.max(0.35, 0.35 * S); g.stroke();
        if (fine) { g.strokeStyle = 'rgba(150,80,60,0.45)'; g.beginPath(); g.ellipse(e.x, e.y, 0.45 * S * hkH * Math.min(1, k * 1.5), 1.0 * S * hkH, ang, -1, 1.6); g.stroke(); }
        if (look.earring && fem) {
          const e0 = HP(sx * 5.0 * Hd.width, -1.9, 0.3), sw = Math.sin(st.t * 3 + sx) * 0.3 * dHead / zs;
          g.strokeStyle = rgba(look.earring, 0.85); g.lineWidth = Math.max(0.3, 0.22 * S);
          g.beginPath(); g.moveTo(e0.x, e0.y); g.lineTo(e0.x + sw, e0.y + 2.3 * S * hkH); g.stroke();
          g.fillStyle = rgba(look.earring, 0.95); g.beginPath(); g.arc(e0.x + sw, e0.y + 2.6 * S * hkH, 0.6 * S * hkH, 0, TAU); g.fill();
        }
      }
    }
    // 轮廓描边（暖褐细线）
    g.strokeStyle = rgba(shade(look.skin, -0.6), 0.9); g.lineWidth = lw * 0.85; sil(); g.stroke();
    if (look.beard) drawBeard({ g, HP, vis: visN, d: dHead, f: R.face, fem, closed: false, sY, hair: look.hair, lash: false, mouthOpen: 0, gaze: 0 }, look.beard, R.old, st.t);
    // 鬓发 / 胸前发缕 / 碎发
    for (let li = 0; li < locks.length; li++) { if (visN(li ? -1 : 1, 0, 0.9) < 0.3) continue; ribbon(locks[li], fem ? 0.9 : 0.75, 0.12, look.hair, false); }
    for (let li = 0; li < wisps.length; li++) { if (visN(li ? -1 : 1, 0, 0.8) < 0.2) continue; ribbon(wisps[li], 0.45, 0.06, look.hair, false); }
    // 发髻 / 冠 / 簪
    if (bun.z >= hed.z - 0.5 && (style === 'bun' || style === 'crown' || style === 'halfup' || style === 'updo')) drawBun(bun, (style === 'updo' ? 3.4 : 2.9) * S * hkH, (style === 'updo' ? 3.0 : 2.5) * S * hkH);
    if (style === 'twin') for (const sx of [1, -1]) { const b = HP(sx * 3.7, 5.9, -1.1); if (b.z >= hed.z) drawBun(b, 2.5 * S * hkH, 2.3 * S * hkH); }
    if (style === 'ponytail') drawBun(bun, 1.6 * S * hkH, 1.5 * S * hkH);
    if (style === 'crown') {
      const c = HP(0, 8.1, -1.2), w = 2.4 * S * hkH;
      g.fillStyle = '#efeadc'; g.beginPath(); g.moveTo(c.x - w, c.y + 1.6 * S); g.lineTo(c.x - w * 0.8, c.y - 1.4 * S); g.quadraticCurveTo(c.x, c.y - 2.6 * S, c.x + w * 0.8, c.y - 1.4 * S); g.lineTo(c.x + w, c.y + 1.6 * S); g.closePath(); g.fill();
      g.strokeStyle = inkOf('#efeadc'); g.lineWidth = lw * 0.6; g.stroke();
      g.fillStyle = 'rgba(120,170,140,0.7)'; g.beginPath(); g.arc(c.x, c.y - 0.2 * S, 0.7 * S, 0, TAU); g.fill();
    }
    if (style === 'bun' || style === 'crown' || style === 'updo' || look.pin) {
      const ca = Math.cos(Yh);
      const pc = style === 'halfup' || style === 'twin' || style === 'long' ? pinA : bun;
      g.strokeStyle = look.pin === 'gold' ? '#d8b050' : look.pin === 'jade' ? '#a8d8c0' : style === 'crown' ? '#e8e0c8' : '#8a6a42';
      g.lineWidth = 0.8 * S;
      g.beginPath(); g.moveTo(pc.x - 4.5 * S * Math.abs(ca) - 1.3 * S, pc.y + 0.4 * S); g.lineTo(pc.x + 4.5 * S * Math.abs(ca) + 1.3 * S, pc.y - 0.4 * S); g.stroke();
      if (look.pin === 'flower') {
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.fillStyle = '#f0b8c8'; g.beginPath(); g.arc(pc.x + Math.cos(a) * 1.1 * S, pc.y + Math.sin(a) * 1.1 * S, 0.8 * S, 0, TAU); g.fill(); }
        g.fillStyle = '#f8e070'; g.beginPath(); g.arc(pc.x, pc.y, 0.5 * S, 0, TAU); g.fill();
      }
      if (tassel) {
        g.strokeStyle = look.pin === 'gold' ? 'rgba(216,176,80,0.9)' : 'rgba(168,216,192,0.9)'; g.lineWidth = 0.35 * S;
        g.beginPath(); g.moveTo(tassel.x[0], tassel.y[0]); for (let i = 1; i < tassel.n; i++) g.lineTo(tassel.x[i], tassel.y[i]); g.stroke();
        g.fillStyle = look.pin === 'gold' ? '#e8c060' : '#b8e8d0';
        g.beginPath(); g.arc(tassel.x[tassel.n - 1], tassel.y[tassel.n - 1], 0.6 * S, 0, TAU); g.fill();
        g.fillStyle = '#e05060'; g.beginPath(); g.arc(tassel.x[1], tassel.y[1], 0.4 * S, 0, TAU); g.fill();
      }
    }
    if (look.hat === 'douli') {
      const top = HP(0, 10, 0), brim = HP(0, 5.0, 0);
      g.fillStyle = '#c8a76a';
      g.beginPath(); g.ellipse(brim.x, brim.y, 14 * S, 14 * S * SP * 1.3, 0, 0, TAU); g.fill(); g.strokeStyle = inkOf('#c8a76a'); g.lineWidth = lw; g.stroke();
      g.beginPath(); g.moveTo(brim.x - 13 * S, brim.y); g.quadraticCurveTo(top.x, top.y - 6 * S, brim.x + 13 * S, brim.y); g.closePath();
      g.fillStyle = '#d6b87c'; g.fill(); g.stroke();
      g.strokeStyle = 'rgba(110,80,40,0.45)'; g.lineWidth = lw * 0.6;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(top.x, top.y - 3 * S); g.lineTo(brim.x + i * 5.5 * S, brim.y + 1.2 * S); g.stroke(); }
    }
  };
  parts.push({ z: torsoZ + 3, f: headDraw });

  // 排序绘制
  parts.sort((a, b) => a.z - b.z);
  for (const p of parts) p.f();
  g.restore();
  const rh = P(add(sk.rWr, sk.rH.a, PALM_L * 0.55 * hk)), lh = P(add(sk.lWr, sk.lH.a, PALM_L * 0.55 * hk));
  return { headX: hed.x, headY: hed.y, handX: rh.x, handY: rh.y, lHandX: lh.x, lHandY: lh.y, front };
}

// 下摆 / 领缘纹样（云纹、水波、回纹、碎花、竹叶）：沿镶边折线等距布置
function hemPattern(g: CanvasRenderingContext2D, chain: { x: number; y: number }[], w: number, pat: string, col: string, S: number) {
  let total = 0; const seg: number[] = [];
  for (let i = 1; i < chain.length; i++) { const d = Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y); seg.push(d); total += d; }
  const step = Math.max(3.2 * S, w * 2.6);
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(0.35, 0.32 * S);
  for (let s = step * 0.5; s < total; s += step) {
    let acc = 0, i = 0; while (i < seg.length && acc + seg[i] < s) { acc += seg[i]; i++; }
    if (i >= seg.length) break;
    const t = (s - acc) / seg[i], a = chain[i], b = chain[i + 1];
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save(); g.translate(x, y); g.rotate(ang);
    const r = w * 0.55;
    if (pat === 'cloud') { g.beginPath(); g.arc(-r * 0.5, 0, r * 0.5, Math.PI, Math.PI * 2.6); g.arc(r * 0.5, 0, r * 0.45, Math.PI * 1.2, Math.PI * 2.9); g.stroke(); }
    else if (pat === 'wave') { g.beginPath(); g.arc(0, r * 0.4, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else if (pat === 'fret') { g.beginPath(); g.moveTo(-r, r * 0.6); g.lineTo(-r, -r * 0.6); g.lineTo(r * 0.6, -r * 0.6); g.lineTo(r * 0.6, r * 0.2); g.lineTo(-r * 0.3, r * 0.2); g.stroke(); }
    else if (pat === 'flower') dotFlower(g, 0, 0, r * 0.75, col);
    else if (pat === 'bamboo') { g.beginPath(); g.ellipse(0, 0, r, r * 0.3, -0.5, 0, TAU); g.fill(); }
    g.restore();
  }
  g.restore();
}
function dotFlower(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  g.fillStyle = col;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.38, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(255,230,120,0.9)'; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
}

// 脚下飞舟（神风舟等）：侧视造型按朝向斜投影，舷下风纹灵光
function headingAxis(yaw: number) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  let ex = dx; const ey = dz * 0.32;
  if (Math.abs(ex) < 0.55) ex = (ex < 0 ? -1 : 1) * 0.55;
  return [ex, ey] as const;
}
export function drawBoatUnderFeet(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, S: number, t: number, id: string) {
  const L = artLook(id), [ex, ey] = headingAxis(yaw), bob = Math.sin(t * 2.2) * 1.5 * S;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y + 8 * S, 0, x, y + 8 * S, 60 * S);
  gr.addColorStop(0, `rgba(${L.glow},0.32)`); gr.addColorStop(1, `rgba(${L.glow},0)`);
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 8 * S, 60 * S, 18 * S, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.translate(x, y + 9 * S + bob);
  g.transform(ex, ey, 0, 1, 0, 0);
  drawArt(g, L, -6 * S, 0, 118 * S, Math.sin(t * 1.7) * 0.03);
  g.restore();
}
// 背后遁具：风雷翅（扇动 + 雷纹）/ 血色披风（随风飘摆）
export function drawBackMount(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, S: number, t: number, id: string) {
  const L = artLook(id), side = Math.abs(Math.sin(yaw));
  g.save();
  if (L.shape === 'wings') {
    const flap = Math.sin(t * 7);
    g.translate(x, y - 4 * S);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70 * S);
    gr.addColorStop(0, `rgba(${L.glow},${0.28 + 0.1 * flap})`); gr.addColorStop(1, `rgba(${L.glow},0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 80 * S * (1 - side * 0.55), 50 * S, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.scale((1 - side * 0.6) * (0.9 + 0.12 * flap), 0.9 - 0.08 * flap);
    drawArt(g, L, 0, -6 * S, 132 * S);
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(${L.glow},0.8)`; g.lineWidth = 1.2 * S;
    const seed = Math.floor(t * 18);
    for (const s of [-1, 1]) { g.beginPath(); let px = s * 20 * S, py = -14 * S; g.moveTo(px, py); for (let i = 0; i < 4; i++) { px += s * 9 * S; py += (((seed * 7 + i * 13 + (s > 0 ? 5 : 0)) % 9) - 5) * 1.6 * S; g.lineTo(px, py); } g.stroke(); }
  } else {
    const sway = Math.sin(t * 3.1) * 0.08;
    g.translate(x, y - 10 * S); g.rotate(sway + Math.sin(yaw) * -0.25);
    g.scale(1 - side * 0.35, 1.15);
    drawArt(g, L, 0, 30 * S, 72 * S);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 40 * S, 0, 0, 40 * S, 60 * S);
    gr.addColorStop(0, `rgba(${L.glow},0.18)`); gr.addColorStop(1, `rgba(${L.glow},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 40 * S, 60 * S, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// 脚下飞剑
export function drawSwordUnderFeet(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, S: number, t: number, color: string) {
  const L = 22 * S;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const gp = 0.55;
  const tipX = x + dx * L, tipY = y + dz * L * gp, tailX = x - dx * L * 0.85, tailY = y - dz * L * 0.85 * gp;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, L * 1.2);
  gr.addColorStop(0, rgba0(color, 0.38)); gr.addColorStop(1, rgba0(color, 0));
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, L * 1.2, L * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  const nx = -(tipY - tailY), ny = tipX - tailX; const nd = Math.hypot(nx, ny) || 1;
  const w = 2.2 * S;
  g.fillStyle = '#e8f4f0';
  g.beginPath();
  g.moveTo(tipX, tipY);
  g.lineTo(x + nx / nd * w, y + ny / nd * w);
  g.lineTo(tailX + nx / nd * w * 0.8, tailY + ny / nd * w * 0.8);
  g.lineTo(tailX - nx / nd * w * 0.8, tailY - ny / nd * w * 0.8);
  g.lineTo(x - nx / nd * w, y - ny / nd * w);
  g.closePath(); g.fill();
  g.strokeStyle = rgba0(color, 0.9); g.lineWidth = 0.9 * S; g.stroke();
  const gx = tailX + (x - tailX) * 0.15, gy = tailY + (y - tailY) * 0.15;
  g.strokeStyle = '#c8a050'; g.lineWidth = 1.6 * S;
  g.beginPath(); g.moveTo(gx + nx / nd * w * 2, gy + ny / nd * w * 2); g.lineTo(gx - nx / nd * w * 2, gy - ny / nd * w * 2); g.stroke();
  g.strokeStyle = '#3a2a20'; g.lineWidth = 1.8 * S;
  g.beginPath(); g.moveTo(gx, gy); g.lineTo(tailX - dx * 6 * S, tailY - dz * 6 * S * gp); g.stroke();
  void t;
}

// ---------------------------------------------------------------- NPC 外观随机（按身份挑衣裳，脸 / 头 / 身材由种子生成）
const HAIRS = ['#1d1a17', '#241f1b', '#2a2420', '#151311', '#3a2e26'];
const SKINS = ['#f1d9bd', '#ecd2b2', '#e6c8a6', '#f4ddc4', '#dcb894'];
const LIPS = ['#c84a5a', '#b8404e', '#d06070', '#a83a48', '#c85a5a'];

export function randomLook(rnd: () => number, role?: NpcRole): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const r = role ?? pick<NpcRole>(['cultivator', 'cultivator', 'scholar', 'farmer', 'merchant', 'female', 'female', 'elder', 'guard']);
  const fem = r === 'female';
  let L: Look = {
    sex: fem ? 'f' : 'm', height: (0.93 + rnd() * 0.13) * (fem ? 0.95 : 1), build: fem ? 0.88 + rnd() * 0.06 : 0.92 + rnd() * 0.16,
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'bun',
    robe: '#3f6a4c', inner: '#ece6d6', trim: '#2b2b2b', belt: '#1f2420', pants: '#6a5f50', boots: '#2a2622',
    robeLen: 'long', sleeve: 'wide', back: 'none', waist: 'none', hand: 'none',
    swordColor: pick(['#7ff0c0', '#9fc8ff', '#ffd27a', '#ff9a8a', '#d0a8ff']),
    faceSeed: Math.floor(rnd() * 4294967295),
  };
  const oid = pick(ROLE_OUTFITS[r]);
  L = applyOutfit(L, oid, Math.floor(rnd() * OUTFIT_BY_ID[oid].dyes.length));
  if (r === 'cultivator') {
    L.hairStyle = pick(['bun', 'crown', 'ponytail', 'bun', 'halfup']);
    L.ribbon = rnd() < 0.6 ? shade0(L.robe, -0.3) : undefined;
    L.back = rnd() < 0.4 ? 'sword' : 'none';
    L.waist = pick(['jade', 'pouch', 'gourd', 'none']);
  } else if (r === 'scholar') {
    L.hairStyle = 'crown'; L.hand = rnd() < 0.5 ? 'fan' : 'none'; L.back = rnd() < 0.3 ? 'box' : 'none'; L.waist = 'jade';
  } else if (r === 'farmer') {
    L.hat = rnd() < 0.6 ? 'douli' : 'none'; L.back = rnd() < 0.4 ? 'basket' : 'none'; L.hairStyle = pick(['bun', 'bun', 'ponytail']);
  } else if (r === 'merchant') {
    L.hairStyle = 'crown'; L.build *= 1.08; L.waist = 'pouch';
    L.body = { belly: 0.35 + rnd() * 0.6, heft: 1.1 + rnd() * 0.15, waist: 1.1 };
  } else if (r === 'female') {
    L.hairStyle = pick(['halfup', 'twin', 'long', 'halfup', 'updo', 'updo']);
    L.ribbon = rnd() < 0.5 ? pick(['#c03040', '#f0f0f0', '#5070a0', '#e0a0b0']) : undefined;
    L.fringe = L.hairStyle === 'twin' ? (rnd() < 0.7 ? 'full' : 'side') : L.hairStyle === 'updo' ? (rnd() < 0.7 ? 'wisp' : 'side') : pick(['part', 'part', 'side', 'full', 'wisp']);
    L.bangs = L.fringe === 'full';
    L.pin = pick<Look['pin']>(['gold', 'jade', 'flower', undefined, 'gold']);
    L.earring = rnd() < 0.5 ? pick(['#e8c060', '#bfe0ff', '#f0a0b0']) : undefined;
    L.lash = true; L.lip = pick(LIPS); L.huadian = rnd() < 0.22 ? pick(['#d0303a', '#e8a030']) : undefined;
    L.waist = 'jade';
  } else if (r === 'elder') {
    L.hair = '#d8d4cc'; L.beard = '#e4e0d8'; L.hairStyle = 'crown'; L.hand = rnd() < 0.5 ? 'staff' : 'none'; L.height *= 0.97;
    L.body = { stoop: 0.25 + rnd() * 0.35, heft: 0.92 };
  } else if (r === 'guard') {
    L.back = 'sword'; L.hairStyle = 'ponytail'; L.build *= 1.1;
  } else if (r === 'monk') {
    L.hairStyle = 'bald';
  }
  return L;
}
