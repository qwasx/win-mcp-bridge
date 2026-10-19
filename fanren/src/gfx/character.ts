// 代码绘制的人物：3D 骨骼 + 俯视斜角投影 + 布料（袖、衣摆、发带、腰带）模拟
// 所有角色共用同一套骨骼与动作，外观（发型/服饰/颜色/配饰）由 Look 参数决定。
import { shade, rgba } from '../core/canvas';
import { headTex, headTexReady, type HeadView } from './headTex';
import { drawArt } from './artifact';
import { artLook } from '../data/artlooks';

export type Action = 'idle' | 'walk' | 'run' | 'fly' | 'sit' | 'cast' | 'hit' | 'dodge' | 'gather';
export const ACTION_NAMES: Record<Action, string> = {
  idle: '待机', walk: '行走', run: '奔跑', fly: '御剑', sit: '打坐', cast: '施法', hit: '受击', dodge: '闪避', gather: '采集',
};

export interface Look {
  sex: 'm' | 'f';
  height: number;          // 身高倍率（约 0.9–1.08）
  build: number;           // 肩宽倍率
  skin: string;
  hair: string;
  hairStyle: 'bun' | 'crown' | 'ponytail' | 'long' | 'twin' | 'halfup' | 'updo' | 'bald';
  bangs?: boolean;         // 刘海
  pin?: 'gold' | 'jade' | 'flower'; // 发簪 / 步摇
  robe: string;            // 外袍
  inner: string;           // 内衫领口
  trim: string;            // 镶边
  belt: string;
  pants: string;
  boots: string;
  robeLen: 'long' | 'short';
  sleeve: 'wide' | 'narrow';
  ribbon?: string;         // 发带
  sash?: string;           // 腰带垂绦
  shawl?: string;          // 披帛（女修）
  hat?: 'douli' | 'none';
  back?: 'sword' | 'basket' | 'box' | 'none';
  waist?: 'gourd' | 'jade' | 'pouch' | 'none';
  hand?: 'fan' | 'staff' | 'none';
  beard?: string;          // 胡须颜色（老者）
  swordColor?: string;     // 飞剑光色
  // 第五步：红颜精细面容
  lash?: boolean;          // 睫毛
  huadian?: string;        // 花钿颜色
  lip?: string;            // 唇色
  eyeTint?: string;        // 瞳色
  earring?: string;        // 耳坠
  headTex?: string;        // 头部改用手绘贴图（五个角度），身体仍为代码绘制
}

export const HANLI_LOOK: Look = {
  sex: 'm', height: 1, build: 1, skin: '#f1d9bd', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#3f6a4c', inner: '#ece6d6', trim: '#2b4636', belt: '#1f2420', pants: '#8a7a62', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', ribbon: '#2a3a30', sash: '#1f2420', back: 'none', waist: 'pouch', hand: 'none',
  swordColor: '#7ff0c0', headTex: 'hanli',
};

// ---------------------------------------------------------------- 姿态
export interface Pose {
  rootY: number; rootX: number; rootZ: number;
  lean: number; side: number; twist: number;
  /** 第三十步：腾空（贴地之后再整体抬起，用于奔跑的腾空期） */
  air: number;
  headPitch: number; headYaw: number; breath: number;
  lSh: number; lShR: number; lEl: number; lFr: number;
  rSh: number; rShR: number; rEl: number; rFr: number;
  lHip: number; lHipR: number; lKn: number;
  rHip: number; rHipR: number; rKn: number;
  lFoot: number; rFoot: number;
  sit: number; eyes: number; ground: number; // ground: 是否贴地（1）
}
const POSE_KEYS: (keyof Pose)[] = ['rootY', 'rootX', 'rootZ', 'lean', 'side', 'twist', 'headPitch', 'headYaw', 'breath', 'lSh', 'lShR', 'lEl', 'lFr', 'rSh', 'rShR', 'rEl', 'rFr', 'lHip', 'lHipR', 'lKn', 'rHip', 'rHipR', 'rKn', 'lFoot', 'rFoot', 'sit', 'eyes', 'ground', 'air'];

function neutral(): Pose {
  return {
    rootY: 0, rootX: 0, rootZ: 0, lean: 0.02, side: 0, twist: 0, headPitch: 0, headYaw: 0, breath: 0,
    lSh: 0.04, lShR: 0.13, lEl: 0.2, lFr: 0.08, rSh: 0.04, rShR: 0.13, rEl: 0.2, rFr: 0.08,
    lHip: 0, lHipR: 0.04, lKn: 0.05, rHip: 0, rHipR: 0.04, rKn: 0.05, lFoot: 0, rFoot: 0,
    sit: 0, eyes: 1, ground: 1, air: 0,
  };
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
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  setAction(a: Action) {
    if (a === this.action) return;
    this.from = this.last ? { ...this.last } : null;
    this.blend = 0;
    this.action = a; this.actionT = 0;
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
    // 转身过渡：最短角度插值
    let d = this.targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turn = Math.min(1, dt * 11);
    this.yaw += d * turn;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2; else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    // 步态相位（与实际速度挂钩，避免滑步）
    if (this.action === 'walk') this.phase += dt * (3.2 + this.speed * 0.028);
    else if (this.action === 'run') this.phase += dt * (6.5 + this.speed * 0.012);
    else this.phase += dt * 1.2;
  }
}

// ---------------------------------------------------------------- 动作 → 姿态
function smooth01(t: number) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

/**
 * 第三十步：主角专用的奔跑（只有韩立用；其余人物仍是原来的跑姿）。
 * 一个步态周期 = 左右各一步：
 *   · 腿：前摆高抬膝（大腿前 0.95 / 后 0.5，偏前），摆动期小腿大幅折叠、着地前伸直，蹬地时脚尖下压；
 *   · 腾空：两腿前后分开时整体离地（贴地后再抬 air），着地瞬间重心最低（微屈膝缓冲）；
 *   · 上身：前倾 ~0.36，随步频轻微起伏；肩与髋反向扭转，左右轻摆；头部稳住、目视前方；
 *   · 手臂：与腿反向，前摆时屈肘收在胸前，后摆时略伸，手肘略外张——利落而不僵。
 */
function heroRun(p: Pose, st: CharState) {
  const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
  const sp = Math.min(1.25, Math.max(0.7, st.speed / 260));   // 速度越快步幅越大
  // 大腿：偏前的正弦，前摆（高抬膝）大于后摆
  const hipL = 0.14 + (s > 0 ? 0.68 : 0.5) * s * sp, hipR = 0.14 - (s < 0 ? 0.68 : 0.5) * s * sp;
  p.lHip = hipL; p.rHip = hipR;
  // 小腿：离地后向后踢起、大腿前摆途中折到最紧；摆到最前时小腿仍近乎竖直（膝领先），随后向前下方伸出落地
  const fold = (k: number) => Math.pow(Math.max(0, k), 1.3);
  const reach = (sn: number, cs: number) => 0.62 * Math.pow(Math.max(0, sn), 2) * (0.5 + 0.5 * Math.max(-1, Math.min(1, cs * 3)));
  p.lKn = 0.26 + 1.7 * fold(Math.cos(ph + 0.2)) * sp + reach(s, c); p.rKn = 0.26 + 1.7 * fold(-Math.cos(ph + 0.2)) * sp + reach(-s, -c);
  // 着地缓冲：支撑中段（大腿接近竖直、向后划）多屈一点
  p.lKn += 0.2 * Math.max(0, 1 - Math.abs(hipL - 0.05) * 3) * (c < 0 ? 1 : 0);
  p.rKn += 0.2 * Math.max(0, 1 - Math.abs(hipR - 0.05) * 3) * (c > 0 ? 1 : 0);
  // 脚：蹬地时脚尖下压，前摆时勾脚
  p.lFoot = -0.55 * Math.max(0, -s) + 0.15 * Math.max(0, s); p.rFoot = -0.55 * Math.max(0, s) + 0.15 * Math.max(0, -s);
  p.lHipR = 0.06; p.rHipR = 0.06;
  // 手臂：与对侧腿同向（与同侧腿反向）
  p.lSh = -0.78 * s * sp + 0.05; p.rSh = 0.78 * s * sp + 0.05;
  p.lEl = 1.05 + 0.45 * Math.max(0, -s); p.rEl = 1.05 + 0.45 * Math.max(0, s);
  p.lShR = 0.24; p.rShR = 0.24; p.lFr = -0.2; p.rFr = -0.2;
  // 躯干
  p.lean = 0.33 + 0.035 * Math.cos(ph * 2) + 0.04 * (sp - 1);
  p.twist = 0.2 * s; p.side = 0.035 * c;
  p.headPitch = -0.16; p.headYaw = -0.05 * s;
  p.breath = 0.4 * Math.sin(ph * 2);
  // 腾空：两腿分得最开（|s|≈1）时最高；着地（s≈0）时为 0
  p.air = 2.2 * Math.pow(Math.abs(s), 2.2) * sp;
  p.rootY = 0;
}

function poseFor(st: CharState, look: Look): Pose {
  const p = neutral();
  const t = st.t, a = st.action, at = st.actionT;
  const br = Math.sin(t * 1.7 + st.seed);
  if (a === 'idle') {
    p.breath = br;
    p.lSh = 0.05 + 0.02 * Math.sin(t * 1.7 + 1); p.rSh = 0.05 + 0.02 * Math.sin(t * 1.7 + 1.3);
    p.side = 0.02 * Math.sin(t * 0.45 + st.seed);
    p.lHipR = 0.05 + p.side; p.rHipR = 0.05 - p.side;
    // 偶尔左右张望
    const g = Math.sin(t * 0.37 + st.seed * 3) + Math.sin(t * 0.21 + st.seed);
    p.headYaw = g > 1.2 ? 0.35 : g < -1.3 ? -0.3 : 0;
    p.headPitch = 0.02 * br;
  } else if (a === 'walk') {
    const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
    const A = 0.4;
    p.lHip = A * s; p.rHip = -A * s;
    p.lKn = 0.08 + 0.75 * Math.pow(Math.max(0, c), 2); p.rKn = 0.08 + 0.75 * Math.pow(Math.max(0, -c), 2);
    p.lFoot = -0.25 * Math.max(0, -s) ; p.rFoot = -0.25 * Math.max(0, s);
    p.lSh = -0.3 * s; p.rSh = 0.3 * s;
    p.lEl = 0.22 + 0.25 * Math.max(0, -s); p.rEl = 0.22 + 0.25 * Math.max(0, s);
    p.twist = 0.07 * s; p.lean = 0.06; p.side = 0.025 * c;
    p.rootY = 0.5 * Math.cos(ph * 2);
    p.breath = br * 0.5;
  } else if (a === 'run' && look.headTex) {
    heroRun(p, st);
  } else if (a === 'run') {
    const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
    const A = 0.72;
    p.lHip = A * s + 0.12; p.rHip = -A * s + 0.12;
    p.lKn = 0.25 + 1.35 * Math.pow(Math.max(0, c), 1.4); p.rKn = 0.25 + 1.35 * Math.pow(Math.max(0, -c), 1.4);
    p.lFoot = -0.4 * Math.max(0, -s); p.rFoot = -0.4 * Math.max(0, s);
    p.lSh = -0.75 * s - 0.1; p.rSh = 0.75 * s - 0.1;
    p.lEl = 0.95 + 0.25 * Math.max(0, -s); p.rEl = 0.95 + 0.25 * Math.max(0, s); p.lFr = -0.1; p.rFr = -0.1;
    p.lShR = 0.2; p.rShR = 0.2;
    p.twist = 0.16 * s; p.lean = 0.3; p.side = 0.03 * c;
    p.rootY = 1.6 * Math.max(0, Math.cos(ph * 2));
    p.headPitch = -0.12;
  } else if (a === 'fly') {
    const mv = Math.min(1, st.speed / 200);
    p.lHip = 0.2; p.rHip = -0.25; p.lKn = 0.32; p.rKn = 0.18; p.lHipR = 0.1; p.rHipR = 0.1;
    p.rFoot = -0.15;
    p.rSh = 0.95; p.rShR = 0.32; p.rEl = 1.95; p.rFr = -0.75; // 剑指在胸前
    p.lSh = -0.35 - 0.35 * mv; p.lShR = 0.3; p.lEl = 0.25;      // 左手负于身后
    p.lean = 0.06 + 0.16 * mv; p.headPitch = -0.05 * mv;
    p.breath = br * 0.6;
    p.side = Math.max(-0.25, Math.min(0.25, st.windX * 0)); // 由转向产生的侧倾在外部设置
  } else if (a === 'sit') {
    p.sit = 1; p.ground = 0;
    p.lHip = 1.35; p.rHip = 1.35; p.lHipR = 0.8; p.rHipR = 0.8; p.lKn = 2.6; p.rKn = 2.6;
    p.lSh = 0.42; p.rSh = 0.42; p.lShR = 0.16; p.rShR = 0.16; p.lEl = 0.95; p.rEl = 0.95; p.lFr = -0.85; p.rFr = -0.85;
    p.lean = 0.0; p.headPitch = 0.12; p.eyes = 0;
    p.breath = Math.sin(t * 0.9 + st.seed) * 1.2;
    p.rootY = 1.2 * Math.sin(t * 0.8); // 微微浮空
  } else if (a === 'cast') {
    const up = smooth01(at / 0.22);
    const pulse = Math.sin(at * 9) * 0.04;
    p.rSh = 0.05 + (1.42 + pulse) * up; p.rShR = 0.13 - 0.08 * up; p.rEl = 0.2 - 0.12 * up; p.rFr = 0.05;
    p.lSh = 0.05 + 0.75 * up; p.lShR = 0.2; p.lEl = 0.2 + 1.75 * up; p.lFr = -0.7 * up;
    p.lHip = 0.25 * up; p.rHip = -0.22 * up; p.lKn = 0.22 * up + 0.05; p.rKn = 0.12;
    p.lean = 0.08 * up; p.twist = -0.15 * up; p.breath = br * 0.4;
  } else if (a === 'gather') {
    const k = smooth01(at / 0.3);
    p.lHip = 1.25 * k; p.lKn = 2.0 * k + 0.05; p.rHip = -0.35 * k; p.rKn = 1.5 * k + 0.05; p.rFoot = 0.6 * k;
    p.lean = 0.42 * k; p.headPitch = 0.3 * k;
    p.rSh = 0.05 + 1.05 * k + Math.sin(at * 6) * 0.06 * k; p.rEl = 0.25; p.rShR = 0.05;
    p.lSh = 0.3 * k; p.lEl = 1.4 * k + 0.2; p.lFr = -0.5 * k;
  } else if (a === 'hit') {
    const k = Math.sin(Math.PI * Math.min(1, at / 0.45));
    p.lean = -0.38 * k; p.headPitch = -0.35 * k;
    p.lShR = 0.13 + 0.7 * k; p.rShR = 0.13 + 0.7 * k; p.lSh = 0.05 + 0.4 * k; p.rSh = 0.05 + 0.35 * k;
    p.lEl = 0.2 + 0.6 * k; p.rEl = 0.2 + 0.6 * k;
    p.rootZ = -3.5 * k; p.lKn = 0.05 + 0.35 * k; p.rKn = 0.05 + 0.25 * k; p.lHip = -0.25 * k; p.rHip = 0.2 * k;
  } else if (a === 'dodge') {
    const k = Math.sin(Math.PI * Math.min(1, at / 0.38));
    p.lean = 0.32 * k; p.side = 0.45 * k; p.rootX = 5 * k;
    p.lKn = 0.05 + 0.85 * k; p.rKn = 0.05 + 0.7 * k; p.lHip = 0.5 * k; p.rHip = 0.1 * k;
    p.lHipR = 0.04 + 0.35 * k; p.rHipR = 0.04 + 0.1 * k;
    p.lShR = 0.13 + 0.9 * k; p.rShR = 0.13 + 0.5 * k; p.lEl = 0.6 * k + 0.2; p.rEl = 0.4 * k + 0.2;
    p.headYaw = -0.2 * k;
  }
  if (look.sex === 'f' && a !== 'sit') { p.lShR -= 0.03; p.rShR -= 0.03; }
  return p;
}

function blendPose(a: Pose, b: Pose, t: number): Pose {
  const o = { ...b };
  for (const k of POSE_KEYS) (o as any)[k] = (a as any)[k] + ((b as any)[k] - (a as any)[k]) * t;
  return o;
}

// ---------------------------------------------------------------- 骨骼求解（局部 3D：x=角色左, y=上, z=前）
type V3 = { x: number; y: number; z: number };
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
function limbDir(pitch: number, roll: number, side: number): V3 {
  const cp = Math.cos(pitch);
  return { x: side * cp * Math.sin(roll), y: -cp * Math.cos(roll), z: Math.sin(pitch) };
}

interface Skel {
  pelvis: V3; chest: V3; neck: V3; head: V3; up: V3;
  lSh: V3; rSh: V3; lEl: V3; rEl: V3; lWr: V3; rWr: V3; lHa: V3; rHa: V3;
  lHip: V3; rHip: V3; lKn: V3; rKn: V3; lAn: V3; rAn: V3; lToe: V3; rToe: V3;
  sw: number; hw: number; ww: number; td: number; // 肩宽、臀宽、腰宽、躯干厚
}

function solve(p: Pose, look: Look): Skel {
  const f = look.sex === 'f';
  const sw = (f ? 8.0 : 9.6) * look.build, hw = f ? 8.6 : 8.0, ww = f ? 5.6 : 7.0, td = f ? 5.6 : 6.6;
  let pelvis = v(p.rootX, 51 + p.rootY, p.rootZ);
  if (p.sit > 0.5) pelvis = v(p.rootX, 13 + p.rootY, p.rootZ - 1);
  const up = v(Math.sin(p.side) * Math.cos(p.lean), Math.cos(p.lean) * Math.cos(p.side), Math.sin(p.lean));
  const chest = add(pelvis, up, 22 + p.breath * 0.35);
  const neck = add(chest, up, 6.5 + p.breath * 0.15);
  const head = add(neck, v(Math.sin(p.side) * 0.5, Math.cos(p.headPitch), Math.sin(p.headPitch) + up.z * 0.4), 7.2);
  const tw = p.twist, ct = Math.cos(tw), stt = Math.sin(tw);
  const shY = 0.6 + p.breath * 0.25;
  const lSh = add(chest, v(sw * ct, shY, -sw * stt));
  const rSh = add(chest, v(-sw * ct, shY, sw * stt));
  const lUp = limbDir(p.lSh, p.lShR, 1), rUp = limbDir(p.rSh, p.rShR, -1);
  const lEl = add(lSh, lUp, 14.5), rEl = add(rSh, rUp, 14.5);
  const lFo = limbDir(p.lSh + p.lEl, p.lFr, 1), rFo = limbDir(p.rSh + p.rEl, p.rFr, -1);
  const lWr = add(lEl, lFo, 12.5), rWr = add(rEl, rFo, 12.5);
  const lHa = add(lWr, lFo, 3.2), rHa = add(rWr, rFo, 3.2);
  const hx = (f ? 4.6 : 4.4), ht = -tw * 0.5;
  const lHip = add(pelvis, v(hx * Math.cos(ht), -1, -hx * Math.sin(ht)));
  const rHip = add(pelvis, v(-hx * Math.cos(ht), -1, hx * Math.sin(ht)));
  let lKn: V3, rKn: V3, lAn: V3, rAn: V3, lToe: V3, rToe: V3;
  if (p.sit > 0.5) {
    lKn = add(pelvis, v(11, -6, 5)); rKn = add(pelvis, v(-11, -6, 5));
    lAn = add(pelvis, v(-4, -9, 7)); rAn = add(pelvis, v(4, -9, 8));
    lToe = add(rKn, v(-1, -1, 3)); rToe = add(lKn, v(1, -1, 3));
  } else {
    const lTh = limbDir(p.lHip, p.lHipR, 1), rTh = limbDir(p.rHip, p.rHipR, -1);
    lKn = add(lHip, lTh, 23.5); rKn = add(rHip, rTh, 23.5);
    const lSn = limbDir(p.lHip - p.lKn, p.lHipR * 0.6, 1), rSn = limbDir(p.rHip - p.rKn, p.rHipR * 0.6, -1);
    lAn = add(lKn, lSn, 22.5); rAn = add(rKn, rSn, 22.5);
    lToe = add(lAn, v(0, -3.2 - Math.sin(p.lFoot) * 4, 6.5 * Math.cos(p.lFoot)));
    rToe = add(rAn, v(0, -3.2 - Math.sin(p.rFoot) * 4, 6.5 * Math.cos(p.rFoot)));
    // 贴地：最低的脚落在地面
    if (p.ground > 0.5) {
      const low = Math.min(lAn.y - 3.4, rAn.y - 3.4, lToe.y, rToe.y);
      const dy = -low;
      for (const q of [pelvis, chest, neck, head, lSh, rSh, lEl, rEl, lWr, rWr, lHa, rHa, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe]) q.y += dy;
    }
    if (p.air > 0.01) for (const q of [pelvis, chest, neck, head, lSh, rSh, lEl, rEl, lWr, rWr, lHa, rHa, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe]) q.y += p.air;
  }
  return { pelvis, chest, neck, head, up, lSh, rSh, lEl, rEl, lWr, rWr, lHa, rHa, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe, sw, hw, ww, td };
}

// 头部轮廓点（局部坐标）
const HEAD_PTS: Record<string, [number, number, number][]> = {};
function headPts(fem: boolean) {
  const key = fem ? 'f' : 'm';
  if (HEAD_PTS[key]) return HEAD_PTS[key];
  const pts: [number, number, number][] = [];
  for (const el of [-0.4, -0.15, 0.15, 0.45, 0.8, 1.15, 1.42]) for (let i = 0; i < 16; i++) {
    const az = (i / 16) * Math.PI * 2;
    pts.push([4.75 * 1.04 * Math.cos(el) * Math.sin(az), 1 + 5.8 * 1.04 * Math.sin(el), 5.3 * 1.04 * Math.cos(el) * Math.cos(az) - 0.3]);
  }
  pts.push([0, 7.05, -0.3]);
  const jx = fem ? 0.9 : 1;
  for (const sx of [1, -1]) pts.push([sx * 4.35 * jx, -1.6, 1.3], [sx * 3.95 * jx, -3.4, 1.7], [sx * 3.0 * jx, -5.0, 2.5], [sx * 1.55 * jx, -6.25, 3.45], [sx * 3.9, -2.8, -1.4], [sx * 2.6, -4.2, -2.3]);
  pts.push([0, fem ? -6.6 : -6.8, 3.9], [0, -2.4, 5.55]);
  HEAD_PTS[key] = pts;
  return pts;
}

function convexHull(pts: { x: number; y: number }[]) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: any, a: any, b: any) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: any[] = [], up: any[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

// ---------------------------------------------------------------- 投影与绘制
const PITCH = 0.36; // 俯视角
const CP = Math.cos(PITCH), SP = Math.sin(PITCH);
type P2 = { x: number; y: number; z: number };

// 头部贴图的尺寸/锚点（相对代码头）
const HEAD_NECK_UP = 3.2, HEAD_TOP_Y = 9.6, HEAD_TEX_K = 1.08, HEAD_NECK_SINK = 0.06;

export interface DrawOpts { alpha?: number; ghost?: boolean; glow?: number; preview?: boolean; /** 遁具法器 id（飞行时脚下/背后） */ mount?: string; /** 第三十八步：GL 大雷翼展开时不画背上的小翅 */ hideMount?: boolean }

export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, st: CharState, scale: number, dt: number, opts: DrawOpts = {}) {
  // 1. 姿态
  let pose = poseFor(st, look);
  if (st.from && st.blend < 1) pose = blendPose(st.from, pose, smooth01(st.blend));
  if (!opts.ghost) st.last = pose;
  const sk = solve(pose, look);
  const S = scale * look.height;
  const yaw = st.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const bx = st.x, by = st.y - st.lift;
  const P = (q: V3): P2 => {
    const X = q.x * cy + q.z * sy, Z = -q.x * sy + q.z * cy;
    return { x: bx + X * S, y: by + (-q.y * CP + Z * SP) * S, z: Z };
  };
  const ink = 'rgba(28,22,16,0.88)';
  const lw = Math.max(0.7, 0.85 * S);
  const front = cy; // >0 面向镜头
  const parts: { z: number; f: () => void }[] = [];
  const physDt = opts.ghost ? 0 : dt;
  // 风：与移动方向相反 + 环境风 + 飞行时的猎猎飘动
  const flying = st.action === 'fly';
  const flutter = (flying ? 1 : st.action === 'run' ? (look.headTex ? 0.85 : 0.5) : 0.15) * Math.sin(st.t * 13 + st.seed);   // 第三十步：主角奔跑时衣袂飘得更开
  const runK = st.action === 'run' && look.headTex ? 1.35 : 1;
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

  // ---------- 工具：锥形肢体 ----------
  const tube = (a: P2, b: P2, ra: number, rb: number, fill: string, stroke = true) => {
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
    if (stroke) { g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); }
  };
  const ribbon = (s: Strand, w0: number, w1: number, fill: string, stroke = true, extra?: { x: number; y: number }) => {
    const n = s.n; const L: [number, number][] = [], R: [number, number][] = [];
    const xs: number[] = [], ys: number[] = [];
    if (extra) { xs.push(extra.x); ys.push(extra.y); }
    for (let i = 0; i < n; i++) { xs.push(s.x[i]); ys.push(s.y[i]); }
    const m = xs.length;
    for (let i = 0; i < m; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
      const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * (i / (m - 1))) * S * 0.5;
      L.push([xs[i] - dy / d * w, ys[i] + dx / d * w]); R.push([xs[i] + dy / d * w, ys[i] - dx / d * w]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < m; i++) { const mx = (L[i - 1][0] + L[i][0]) / 2, my = (L[i - 1][1] + L[i][1]) / 2; g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], mx, my); }
    g.lineTo(L[m - 1][0], L[m - 1][1]); g.lineTo(R[m - 1][0], R[m - 1][1]);
    for (let i = m - 2; i >= 0; i--) { const mx = (R[i + 1][0] + R[i][0]) / 2, my = (R[i + 1][1] + R[i][1]) / 2; g.quadraticCurveTo(R[i + 1][0], R[i + 1][1], mx, my); }
    g.lineTo(R[0][0], R[0][1]);
    g.closePath(); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke(); }
  };
  // 截面投影半宽（考虑朝向）
  const halfW = (w: number, d: number, extraYaw = 0) => {
    const c = Math.cos(yaw + extraYaw), s = Math.sin(yaw + extraYaw);
    return Math.sqrt(w * w * c * c + d * d * s * s) * S;
  };
  const lightGrad = (x0: number, x1: number, y: number, base: string) => {
    const gr = g.createLinearGradient(x0, y, x1, y);
    gr.addColorStop(0, shade(base, 0.16)); gr.addColorStop(0.45, base); gr.addColorStop(1, shade(base, -0.3));
    return gr;
  };

  const pel = P(sk.pelvis), che = P(sk.chest), nec = P(sk.neck), hed = P(sk.head);
  const torsoZ = (pel.z + che.z) / 2;

  // ---------- 飞剑 ----------
  if (flying) {
    const L = opts.mount ? artLook(opts.mount) : null;
    if (L && L.shape === 'boat') parts.push({ z: -999, f: () => drawBoatUnderFeet(g, bx, by, yaw, S, st.t, opts.mount!) });
    else if (L && L.shape === 'wings' && opts.hideMount) { /* GL 雷翼代替 */ }
    else if (L && (L.shape === 'wings' || L.shape === 'cloak')) {
      const back = Math.cos(yaw) > 0;   // 面朝镜头 → 翅/披风在身后
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

  // ---------- 下半身（腿 + 衣摆）----------
  const seated = pose.sit > 0.5;
  const legs = () => {
    if (seated) return;
    const legOne = (hip: V3, kn: V3, an: V3, toe: V3) => {
      const H = P(hip), K = P(kn), A = P(an), T = P(toe);
      tube(H, K, 4.4 * S, 3.6 * S, look.pants);
      tube(K, A, 3.6 * S, 2.6 * S, look.pants);
      // 靴
      const heel = P(add(an, v(0, -2.6, -1.6)));
      tube(heel, T, 2.6 * S, 2.1 * S, look.boots);
      g.fillStyle = look.boots; g.beginPath(); g.arc(A.x, A.y, 2.7 * S, 0, Math.PI * 2); g.fill();
    };
    const L = { z: P(sk.lKn).z, f: () => legOne(sk.lHip, sk.lKn, sk.lAn, sk.lToe) };
    const R = { z: P(sk.rKn).z, f: () => legOne(sk.rHip, sk.rKn, sk.rAn, sk.rToe) };
    (L.z < R.z ? [L, R] : [R, L]).forEach((o) => o.f());
  };
  const skirt = () => {
    const robe = look.robe;
    if (seated) {
      // 打坐：袍裾铺开成一团
      const lk = P(sk.lKn), rk = P(sk.rKn), wl = P(add(sk.pelvis, v(sk.ww, 8, 0))), wr = P(add(sk.pelvis, v(-sk.ww, 8, 0)));
      const base = P(add(sk.pelvis, v(0, -10, 4)));
      const lx = Math.min(lk.x, rk.x) - 3 * S, rx = Math.max(lk.x, rk.x) + 3 * S;
      const top = Math.min(wl.y, wr.y);
      const yb = Math.max(lk.y, rk.y, base.y) + 2.5 * S;
      g.beginPath();
      g.moveTo(wl.x < wr.x ? wl.x : wr.x, top);
      g.bezierCurveTo(lx - 1 * S, top + 6 * S, lx - 5 * S, yb - 6 * S, lx + 2 * S, yb);
      g.quadraticCurveTo((lx + rx) / 2, yb + 5 * S, rx - 2 * S, yb);
      g.bezierCurveTo(rx + 5 * S, yb - 6 * S, rx + 1 * S, top + 6 * S, wl.x < wr.x ? wr.x : wl.x, top);
      g.closePath();
      g.fillStyle = lightGrad(lx, rx, top, robe); g.fill();
      g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
      // 衣褶
      g.strokeStyle = rgba(shade(robe, -0.55), 0.55); g.lineWidth = lw * 0.8;
      g.beginPath();
      g.moveTo((lx + rx) / 2 - 6 * S, top + 8 * S); g.quadraticCurveTo((lx + rx) / 2 - 9 * S, yb - 4 * S, (lx + rx) / 2 - 14 * S, yb);
      g.moveTo((lx + rx) / 2 + 6 * S, top + 8 * S); g.quadraticCurveTo((lx + rx) / 2 + 9 * S, yb - 4 * S, (lx + rx) / 2 + 14 * S, yb);
      g.moveTo((lx + rx) / 2, top + 10 * S); g.quadraticCurveTo((lx + rx) / 2 + 1 * S, yb - 2 * S, (lx + rx) / 2, yb + 3 * S);
      g.stroke();
      // 露出的脚尖
      g.fillStyle = look.boots;
      g.beginPath(); g.ellipse((lx + rx) / 2 - 5 * S, yb - 1 * S, 2.6 * S, 1.6 * S, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    const long = look.robeLen === 'long';
    const heroRun = st.action === 'run' && !!look.headTex;
    const fl = (flying ? 1 : heroRun ? 0.9 : st.action === 'run' ? 0.6 : 0.2);
    const half = (side: 1 | -1) => {
      const hip = side > 0 ? sk.lHip : sk.rHip, kn = side > 0 ? sk.lKn : sk.rKn, an = side > 0 ? sk.lAn : sk.rAn;
      // 衣摆高度：长袍到小腿下部，短褂到膝
      let hemOn = long ? add(kn, add(an, kn, -1), 0.8) : add(hip, add(kn, hip, -1), 1.02);
      // 第三十步：主角奔跑时下摆不再死跟着腿（避免"木板"感）——向两腿中点收拢、略微上提，由弹簧带出飘动
      if (heroRun) {
        const kn2 = side > 0 ? sk.rKn : sk.lKn, an2 = side > 0 ? sk.rAn : sk.lAn, hip2 = side > 0 ? sk.rHip : sk.lHip;
        const other = long ? add(kn2, add(an2, kn2, -1), 0.8) : add(hip2, add(kn2, hip2, -1), 1.02);
        hemOn = add(add(hemOn, add(other, hemOn, -1), 0.32), sk.up, 1.6);
      }
      const waistC = add(sk.pelvis, sk.up, 8.5);
      const W = sk.ww + 0.6, D = sk.td + 0.2;
      const FX = long ? 7.6 : 6.4, FZ = long ? 7.2 : 6.0;
      // 衣摆中心：腿部位置向中线靠拢，带弹簧滞后
      const hc = add(hemOn, v(-side * 2.6, 0, 0));
      const HC = P(hc);
      const sp = spring('hem' + side, HC.x, HC.y, 110, 10);
      const offX = sp.x - HC.x, offY = sp.y - HC.y;
      const pts: { x: number; y: number }[] = [];
      const hemArc: { x: number; y: number; z: number }[] = [];
      const N = 9;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * Math.PI; // 0 = 前中, π = 后中
        const wq = P(add(waistC, v(side * Math.sin(u) * W, 0, Math.cos(u) * D)));
        pts.push({ x: wq.x, y: wq.y });
        const flut = Math.sin(st.t * 10 + side * 2 + i * 1.3) * fl * 1.4 * S;
        const hq = P(add(hc, v(side * Math.sin(u) * FX, 0, Math.cos(u) * FZ)));
        const k = 0.55 + 0.45 * Math.sin(u); // 外侧滞后更明显
        const hp = { x: hq.x + offX * k + flut, y: hq.y + offY * k, z: hq.z };
        pts.push(hp); hemArc.push(hp);
      }
      const hipQ = P(add(sk.pelvis, v(side * (sk.hw + 0.6), 0, 0)));
      pts.push({ x: hipQ.x, y: hipQ.y });
      const hull = convexHull(pts);
      const zz = P(add(kn, v(0, 0, 0))).z;
      return {
        z: zz, f: () => {
          g.beginPath();
          hull.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
          g.closePath();
          let x0 = 1e9, x1 = -1e9, y0 = 1e9;
          for (const q of hull) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); }
          g.fillStyle = lightGrad(x0, x1, y0, robe); g.fill();
          g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
          // 衣褶线（自腰向下）
          g.strokeStyle = rgba(shade(robe, -0.55), 0.45); g.lineWidth = lw * 0.7;
          g.beginPath();
          for (const k of [2, 5]) {
            const hp = hemArc[k]; const wq = pts[k * 2];
            if (hp.z < HC.z) continue;
            g.moveTo(wq.x, wq.y + 4 * S); g.quadraticCurveTo((wq.x + hp.x) / 2 + side * 0.6 * S, (wq.y + hp.y) / 2, hp.x, hp.y - 0.6 * S);
          }
          g.stroke();
          // 镶边（衣摆可见的前缘）
          g.strokeStyle = look.trim; g.lineWidth = 1.5 * S;
          g.beginPath();
          let started = false;
          for (const hp of hemArc) {
            if (hp.z < HC.z - 1.5) { started = false; continue; }
            if (!started) { g.moveTo(hp.x, hp.y); started = true; } else g.lineTo(hp.x, hp.y);
          }
          g.stroke();
        },
      };
    };
    const A = half(1), B = half(-1);
    (A.z < B.z ? [A, B] : [B, A]).forEach((o) => o.f());
  };
  parts.push({ z: torsoZ - 0.5, f: () => { legs(); skirt(); } });

  // ---------- 躯干 ----------
  const torso = () => {
    const tw = pose.twist;
    const lvl = (base: V3, dy: number, w: number, d: number, twk: number) => {
      const c = P(add(base, sk.up, dy));
      return { c, hw: halfW(w, d, tw * twk) };
    };
    const L0 = lvl(sk.chest, 0.2, sk.sw - 0.6, sk.td, 1), L1 = lvl(sk.chest, -5, sk.sw - 1.2, sk.td + 0.5, 0.8);
    const L2 = lvl(sk.pelvis, 9, sk.ww, sk.td - 0.4, 0.3), L3 = lvl(sk.pelvis, 6.5, sk.ww + 0.4, sk.td - 0.2, 0.2);
    const lS = P(sk.lSh), rS = P(sk.rSh);
    const leftSh = lS.x < rS.x ? lS : rS, rightSh = lS.x < rS.x ? rS : lS;
    g.beginPath();
    g.moveTo(leftSh.x, leftSh.y + 1.2 * S);
    g.quadraticCurveTo(L1.c.x - L1.hw - 0.6 * S, L1.c.y, L2.c.x - L2.hw, L2.c.y);
    g.lineTo(L3.c.x - L3.hw, L3.c.y + 2 * S);
    g.lineTo(L3.c.x + L3.hw, L3.c.y + 2 * S);
    g.lineTo(L2.c.x + L2.hw, L2.c.y);
    g.quadraticCurveTo(L1.c.x + L1.hw + 0.6 * S, L1.c.y, rightSh.x, rightSh.y + 1.2 * S);
    // 肩线到颈
    g.quadraticCurveTo(rightSh.x - 1 * S, rightSh.y - 2.4 * S, nec.x + 2.6 * S, nec.y + 1.5 * S);
    g.lineTo(nec.x - 2.6 * S, nec.y + 1.5 * S);
    g.quadraticCurveTo(leftSh.x + 1 * S, leftSh.y - 2.4 * S, leftSh.x, leftSh.y + 1.2 * S);
    g.closePath();
    const x0 = L1.c.x - L1.hw, x1 = L1.c.x + L1.hw;
    g.fillStyle = lightGrad(x0, x1, L1.c.y, look.robe); g.fill();
    g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
    // 交领右衽（面向镜头可见）
    const fv = Math.cos(yaw + tw);
    if (fv > 0.05) {
      g.save(); g.globalAlpha *= Math.min(1, fv * 2.2);
      const td = sk.td + 0.2;
      const q = (x: number, y: number, z: number) => P(add(sk.chest, v(x, y, z)));
      const n0 = q(2.6, 5.8, td * 0.55), n1 = q(-2.6, 5.8, td * 0.55);
      const a1 = q(-1.2, -2, td), a2 = q(-sk.ww + 0.8, -13.8, td - 0.6);
      const b1 = q(1.0, -1.5, td);
      // 内衫白领
      g.strokeStyle = look.inner; g.lineWidth = 2.6 * S;
      g.beginPath(); g.moveTo(n0.x, n0.y); g.quadraticCurveTo(a1.x, a1.y - 1 * S, (a1.x + a2.x) / 2, (a1.y + a2.y) / 2 - 1 * S); g.stroke();
      g.beginPath(); g.moveTo(n1.x, n1.y); g.lineTo(b1.x, b1.y); g.stroke();
      // 外袍领缘
      g.strokeStyle = look.trim; g.lineWidth = 1.5 * S;
      g.beginPath(); g.moveTo(n0.x + 0.6 * S, n0.y + 0.8 * S); g.quadraticCurveTo(a1.x + 1.2 * S, a1.y + 0.6 * S, a2.x, a2.y); g.stroke();
      g.strokeStyle = ink; g.lineWidth = lw * 0.7;
      g.beginPath(); g.moveTo(n0.x + 1.4 * S, n0.y + 1.6 * S); g.quadraticCurveTo(a1.x + 2 * S, a1.y + 1.4 * S, a2.x + 0.6 * S, a2.y + 0.6 * S); g.stroke();
      g.restore();
    } else if (fv < -0.2) {
      // 背缝
      g.strokeStyle = rgba(shade(look.robe, -0.5), 0.5); g.lineWidth = lw * 0.7;
      g.beginPath(); g.moveTo(nec.x, nec.y + 3 * S); g.lineTo(L2.c.x, L2.c.y); g.stroke();
    }
    // 腰带
    const bw = halfW(sk.ww + 0.5, sk.td, tw * 0.3);
    const bc = P(add(sk.pelvis, sk.up, 9.2));
    g.fillStyle = look.belt;
    g.beginPath();
    g.moveTo(bc.x - bw, bc.y - 2 * S); g.quadraticCurveTo(bc.x, bc.y - 1 * S, bc.x + bw, bc.y - 2 * S);
    g.lineTo(bc.x + bw, bc.y + 1.8 * S); g.quadraticCurveTo(bc.x, bc.y + 3 * S, bc.x - bw, bc.y + 1.8 * S);
    g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke();
  };
  parts.push({ z: torsoZ, f: torso });

  // 腰间配饰与垂绦
  {
    const knot = add(sk.pelvis, add(sk.up, v(-2.5, 0, 0)), 0); // 占位
    const kn3 = add(add(sk.pelvis, sk.up, 8.6), v(-2.5, 0, sk.td));
    const K = P(kn3);
    if (look.sash) {
      const s1 = strand('sash1', 4, 3.6, K.x, K.y, 2.6), s2 = strand('sash2', 3, 3.6, K.x + 1.2 * S, K.y, 2.6);
      parts.push({ z: K.z + 0.2, f: () => { ribbon(s2, 1.8, 1.4, look.sash!); ribbon(s1, 2.0, 1.6, look.sash!); } });
    }
    if (look.waist && look.waist !== 'none') {
      const wp = add(add(sk.pelvis, sk.up, 7.5), v(sk.ww * 0.75, 0, sk.td * 0.7));
      const W = P(wp);
      const pend = strand('pend', 3, 3, W.x, W.y, 1.8);
      parts.push({ z: W.z + 0.3, f: () => {
        const ex = pend.x[pend.n - 1], ey = pend.y[pend.n - 1];
        g.strokeStyle = 'rgba(120,40,30,0.9)'; g.lineWidth = 0.7 * S;
        g.beginPath(); g.moveTo(W.x, W.y); g.lineTo(ex, ey); g.stroke();
        if (look.waist === 'jade') { g.fillStyle = '#9fd0b0'; g.beginPath(); g.arc(ex, ey + 1.6 * S, 1.8 * S, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke(); }
        else if (look.waist === 'gourd') { g.fillStyle = '#c08a3a'; g.beginPath(); g.arc(ex, ey + 1.5 * S, 1.6 * S, 0, Math.PI * 2); g.arc(ex, ey + 4.6 * S, 2.4 * S, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke(); }
        else { g.fillStyle = '#6a5038'; g.beginPath(); g.ellipse(ex, ey + 2.4 * S, 2.4 * S, 2.8 * S, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke(); }
      } });
    }
    void knot;
  }

  // ---------- 背后配饰 ----------
  if (look.back && look.back !== 'none') {
    const bz = P(add(sk.chest, v(0, -4, -sk.td - 1.5))).z;
    parts.push({ z: bz, f: () => {
      if (look.back === 'sword') {
        const a = P(add(sk.chest, v(-7, 9, -sk.td - 1.2))), b = P(add(sk.pelvis, v(8, 2, -sk.td - 1)));
        tube(a, b, 1.3 * S, 1.1 * S, '#3a2a20');
        const h = P(add(sk.chest, v(-9, 13, -sk.td - 1.2)));
        g.strokeStyle = '#b89a50'; g.lineWidth = 2.2 * S; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(h.x, h.y); g.stroke();
        g.strokeStyle = '#d8c070'; g.lineWidth = 1.6 * S; const gx = P(add(sk.chest, v(-7.6, 10.2, -sk.td - 1.2)));
        g.beginPath(); g.moveTo(gx.x - 2.4 * S, gx.y + 1.2 * S); g.lineTo(gx.x + 2.4 * S, gx.y - 1.2 * S); g.stroke();
      } else if (look.back === 'basket') {
        const c = P(add(sk.chest, v(0, -6, -sk.td - 4)));
        const w = halfW(7, 5);
        g.fillStyle = '#b8935a'; g.beginPath(); g.moveTo(c.x - w, c.y - 9 * S); g.lineTo(c.x + w, c.y - 9 * S); g.lineTo(c.x + w * 0.8, c.y + 9 * S); g.lineTo(c.x - w * 0.8, c.y + 9 * S); g.closePath(); g.fill();
        g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.stroke();
        g.strokeStyle = 'rgba(90,64,30,0.6)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(c.x + i * w / 3, c.y - 9 * S); g.lineTo(c.x + i * w / 3.6, c.y + 9 * S); g.stroke(); }
        g.fillStyle = '#5f8a4a'; g.beginPath(); g.ellipse(c.x, c.y - 9.5 * S, w * 0.9, 2.5 * S, 0, 0, Math.PI * 2); g.fill();
      } else if (look.back === 'box') {
        const c = P(add(sk.chest, v(0, -4, -sk.td - 3.5)));
        const w = halfW(6, 4);
        g.fillStyle = '#6a4630'; g.fillRect(c.x - w, c.y - 10 * S, w * 2, 18 * S); g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.strokeRect(c.x - w, c.y - 10 * S, w * 2, 18 * S);
        g.fillStyle = '#c8a860'; g.fillRect(c.x - w, c.y - 3 * S, w * 2, 1.4 * S);
      }
    } });
  }

  // ---------- 手臂与袖 ----------
  const arm = (side: 1 | -1) => {
    const sh = side > 0 ? sk.lSh : sk.rSh, el = side > 0 ? sk.lEl : sk.rEl, wr = side > 0 ? sk.lWr : sk.rWr, ha = side > 0 ? sk.lHa : sk.rHa;
    const S0 = P(sh), E = P(el), W = P(wr), H = P(ha);
    const z = (E.z + W.z) / 2 + 0.6;
    const wide = look.sleeve === 'wide';
    // 袖：下缘布料从肘部垂下（随重力与惯性摆动）
    const dx = W.x - E.x, dy = W.y - E.y, d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d;
    // 选“下方/外侧”的法线
    const outward = (E.x - che.x) * nx + (E.y - che.y) * ny;
    if (ny < -0.35 || (Math.abs(ny) <= 0.35 && outward < 0)) { nx = -nx; ny = -ny; }
    const r0 = 5.0 * S;
    const A = { x: E.x + nx * r0, y: E.y + ny * r0 };
    const hang = wide ? strand('sleeve' + side, 5, 4.0, A.x, A.y, 2.2, 1) : null;
    return {
      z, f: () => {
        // 手
        const handDraw = () => {
          g.fillStyle = look.skin; g.beginPath(); g.ellipse(H.x, H.y, 2.1 * S, 2.6 * S, Math.atan2(H.y - W.y, H.x - W.x) + Math.PI / 2, 0, Math.PI * 2); g.fill();
          g.strokeStyle = ink; g.lineWidth = lw * 0.7; g.stroke();
        };
        handDraw();
        if (look.hand === 'fan' && side < 0) {
          g.fillStyle = '#efe6cf'; g.beginPath(); g.moveTo(H.x, H.y); g.arc(H.x, H.y, 7 * S, -2.4, -0.7); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke();
        }
        if (look.hand === 'staff' && side < 0) {
          g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.6 * S; g.beginPath(); g.moveTo(H.x, H.y - 30 * S); g.lineTo(H.x, H.y + 30 * S); g.stroke();
        }
        // 上臂袖
        tube(S0, E, 4.6 * S, (wide ? 5.4 : 3.6) * S, look.robe);
        if (wide && hang) {
          // 广袖：袖筒上缘到腕，下缘为垂落的布料
          const r1 = 4.6 * S;
          const top0 = { x: E.x - nx * r0 * 0.85, y: E.y - ny * r0 * 0.85 };
          const top1 = { x: W.x - nx * r1 * 0.5 + dx / d * 1.5 * S, y: W.y - ny * r1 * 0.5 + dy / d * 1.5 * S };
          const last = hang.n - 1;
          g.beginPath();
          g.moveTo(top0.x, top0.y);
          g.lineTo(top1.x, top1.y);
          // 袖口：从腕上缘弯向垂布末端
          g.quadraticCurveTo(W.x + nx * r1 + dx / d * 2.5 * S, W.y + ny * r1 + dy / d * 2.5 * S, hang.x[last], hang.y[last]);
          for (let i = last - 1; i >= 0; i--) g.lineTo(hang.x[i], hang.y[i]);
          g.closePath();
          g.fillStyle = shade(look.robe, -0.05); g.fill();
          g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
          // 袖口镶边
          g.strokeStyle = look.trim; g.lineWidth = 1.5 * S;
          g.beginPath(); g.moveTo(top1.x, top1.y);
          g.quadraticCurveTo(W.x + nx * r1 + dx / d * 2.5 * S, W.y + ny * r1 + dy / d * 2.5 * S, hang.x[last], hang.y[last]); g.stroke();
          // 袖褶
          g.strokeStyle = rgba(shade(look.robe, -0.5), 0.5); g.lineWidth = lw * 0.7;
          g.beginPath(); g.moveTo(E.x, E.y); g.quadraticCurveTo((E.x + hang.x[3]) / 2, (E.y + hang.y[3]) / 2 + 1 * S, hang.x[3], hang.y[3]); g.stroke();
          handDraw();
        } else {
          tube(E, W, 3.4 * S, 2.9 * S, look.robe);
          g.strokeStyle = look.trim; g.lineWidth = 1.4 * S;
          g.beginPath(); g.moveTo(W.x + nx * 2.8 * S, W.y + ny * 2.8 * S); g.lineTo(W.x - nx * 2.8 * S, W.y - ny * 2.8 * S); g.stroke();
          handDraw();
        }
      },
    };
  };
  const armL = arm(1), armR = arm(-1);
  for (const a of [armL, armR]) {
    // 手臂在躯干后侧时先画
    parts.push({ z: a.z < torsoZ - 2.2 ? Math.min(a.z, torsoZ - 2.5) : torsoZ + 0.4 + (a.z - torsoZ) * 0.01, f: a.f });
  }

  // 披帛（女修）：从背后绕过双臂，自肘弯垂落，随风飘曳
  if (look.shawl) {
    const lE = P(add(sk.lEl, v(1.5, -1, -1))), rE = P(add(sk.rEl, v(-1.5, -1, -1)));
    const s1 = strand('shawlL', 8, 4.2, lE.x, lE.y, 1.4, 0.75), s2 = strand('shawlR', 8, 4.2, rE.x, rE.y, 1.4, 0.75);
    const lB = P(add(sk.lSh, v(-1, -3, -sk.td - 0.5))), rB = P(add(sk.rSh, v(1, -3, -sk.td - 0.5)));
    const mid = P(add(sk.chest, v(0, -11, -sk.td - 2)));
    const zb = P(add(sk.chest, v(0, 0, -sk.td - 2))).z;
    const col = rgba(look.shawl, 0.72), edge = rgba(shade(look.shawl, -0.35), 0.55);
    parts.push({ z: zb, f: () => {
      // 背后的弧
      g.strokeStyle = col; g.lineWidth = 2.2 * S;
      g.beginPath(); g.moveTo(lE.x, lE.y); g.quadraticCurveTo(lB.x, lB.y, mid.x, mid.y); g.quadraticCurveTo(rB.x, rB.y, rE.x, rE.y); g.stroke();
    } });
    const flow = (s: Strand, ph: number) => {
      // 带 S 形摆动的轻纱
      const n = s.n; const L: [number, number][] = [], R: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        const dx = s.x[i1] - s.x[i0], dy = s.y[i1] - s.y[i0], d = Math.hypot(dx, dy) || 1;
        const t = i / (n - 1);
        const wob = Math.sin(t * 5 + st.t * 2.2 + ph) * 1.6 * S * t;
        const w = (1.5 - 0.5 * t) * S * (0.6 + 0.4 * Math.abs(Math.cos(t * 4 + st.t * 1.7 + ph)));
        const cx = s.x[i] - dy / d * wob, cy = s.y[i] + dx / d * wob;
        L.push([cx - dy / d * w, cy + dx / d * w]); R.push([cx + dy / d * w, cy - dx / d * w]);
      }
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < n; i++) g.quadraticCurveTo(L[i - 1][0], L[i - 1][1], (L[i - 1][0] + L[i][0]) / 2, (L[i - 1][1] + L[i][1]) / 2);
      g.lineTo(L[n - 1][0], L[n - 1][1]); g.lineTo(R[n - 1][0], R[n - 1][1]);
      for (let i = n - 2; i >= 0; i--) g.quadraticCurveTo(R[i + 1][0], R[i + 1][1], (R[i + 1][0] + R[i][0]) / 2, (R[i + 1][1] + R[i][1]) / 2);
      g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = edge; g.lineWidth = Math.max(0.3, 0.3 * S); g.stroke();
    };
    const zl = (P(sk.lEl).z + P(sk.lWr).z) / 2 + 0.8, zr = (P(sk.rEl).z + P(sk.rWr).z) / 2 + 0.8;
    parts.push({ z: zl, f: () => flow(s1, 0) });
    parts.push({ z: zr, f: () => flow(s2, 1.7) });
  }

  // ---------- 头部（3D 头型 + 发际线投影 + 五官）----------
  const fem = look.sex === 'f';
  const hk = fem ? 0.93 : 1;
  const hyaw = pose.headYaw, chy = Math.cos(hyaw), shy = Math.sin(hyaw);
  const Yh = yaw + hyaw, cY = Math.cos(Yh), sY = Math.sin(Yh);
  const HP = (x: number, y: number, z: number): P2 => {
    x *= hk; y *= hk; z *= hk;
    return P(add(sk.head, v(x * chy + z * shy, y, -x * shy + z * chy)));
  };
  const visN = (nx: number, ny: number, nz: number) => { const l = Math.hypot(nx, ny, nz) || 1; return (ny * SP + (-nx * sY + nz * cY) * CP) / l; };
  const style = look.hairStyle;
  const texHead = look.headTex && headTexReady(look.headTex) ? look.headTex : null;
  const bald = style === 'bald';
  const drape = fem ? style !== 'bald' && style !== 'updo' : style === 'long' || style === 'halfup';
  const blink = pose.eyes > 0.5 && ((st.t * 0.9 + st.seed) % 4.3) < 0.13;
  // 头部表面点（椭球颅骨，下部收窄到后颈）
  const surf = (a: number, y: number, inf = 1) => {
    const yy = Math.max(-2.2, Math.min(y, 6.75));
    const f = Math.sqrt(Math.max(0.04, 1 - ((yy - 1) / 5.8) ** 2));
    let rx = 4.75 * f * inf, rz = 5.3 * f * inf;
    if (y < -2.2) { const k = Math.max(0.6, 1 + (y + 2.2) * 0.1); rx *= k; rz *= k; }
    const x = Math.sin(a) * rx, z = Math.cos(a) * rz - 0.3;
    return { x, y, z, n: visN(x / 22.6, (yy - 1) / 33.6, (z + 0.3) / 28.1) };
  };
  // 发际线高度（φ=0 正前方）
  const hairline = (a: number) => {
    const t = Math.abs(a);
    let y = t < 0.9 ? 3.25 - t / 0.9 * 1.25 : t < 1.6 ? 2.0 - (t - 0.9) / 0.7 * 1.1 : 0.9 - (t - 1.6) / (Math.PI - 1.6) * 5.1;
    if (drape && t > 1.15) y = Math.min(y, 2.0 - (t - 1.15) * 7);     // 披发盖住耳朵垂到肩后
    if (fem && (style === 'long' || style === 'halfup') && t < 0.22) y += 0.55 * (1 - t / 0.22); // 中分发缝
    if (look.bangs && t < 0.85) y = Math.min(y, 2.5);
    return y;
  };
  // 头部轮廓点（局部坐标，按性别缓存）
  const hullLocal = headPts(fem);
  // ---- 背后长发 ----
  let backHair: { s: Strand } | null = null;
  if (drape && !texHead) {
    const nape = HP(0, -1.2, -4.4);
    const L = fem ? (style === 'twin' ? 4.6 : 6.4) : 5.2;
    backHair = { s: strand('hairLong', 6, L, nape.x, nape.y, 1.5, 1.05) };
    const zz = P(add(sk.chest, v(0, 0, -sk.td - 1))).z;
    parts.push({ z: zz, f: () => {
      const s = backHair!.s;
      const lt = HP(4.95, 1.4, -0.9), rt = HP(-4.95, 1.4, -0.9), top = HP(0, 7.2, -1.2);
      const W0 = Math.max(Math.abs(lt.x - rt.x) / 2, 3.2 * S) * 0.98;
      const xs = [nape.x, ...Array.from(s.x)], ys = [nape.y, ...Array.from(s.y)];
      const m = xs.length; const Lp: [number, number][] = [], Rp: [number, number][] = [];
      for (let i = 0; i < m; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(m - 1, i + 1);
        const dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0], d = Math.hypot(dx, dy) || 1;
        const t = i / (m - 1);
        const w = W0 * (1.02 - 0.5 * t * t) * (1 + 0.06 * Math.sin(t * 5 + st.t * 1.3));
        Lp.push([xs[i] - dy / d * w, ys[i] + dx / d * w]); Rp.push([xs[i] + dy / d * w, ys[i] - dx / d * w]);
      }
      const path = () => {
        g.beginPath();
        g.moveTo(lt.x, lt.y);
        g.quadraticCurveTo(Lp[0][0], (lt.y + Lp[0][1]) / 2, Lp[1][0], Lp[1][1]);
        for (let i = 2; i < m; i++) g.quadraticCurveTo(Lp[i - 1][0], Lp[i - 1][1], (Lp[i - 1][0] + Lp[i][0]) / 2, (Lp[i - 1][1] + Lp[i][1]) / 2);
        // 发梢：三缕分叉
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
      const gr = g.createLinearGradient(0, top.y, 0, ys[m - 1] + 4 * S);
      gr.addColorStop(0, shade(look.hair, 0.1)); gr.addColorStop(0.5, look.hair); gr.addColorStop(1, shade(look.hair, -0.25));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.85; g.stroke();
      // 发丝
      g.save(); path(); g.clip();
      g.lineWidth = Math.max(0.35, 0.32 * S);
      for (let k = -3; k <= 3; k++) {
        const f = k / 3.6;
        g.strokeStyle = k % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.28)';
        g.beginPath();
        for (let i = 0; i < m; i++) {
          const x = xs[i] + (Lp[i][0] - xs[i]) * f, y = ys[i] + (Lp[i][1] - ys[i]) * f;
          if (i === 0) g.moveTo(lt.x + (rt.x - lt.x) * (0.5 - f / 2), top.y + 3 * S); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.restore();
    } });
  }
  // ---- 发髻位置 ----
  const bunL = style === 'ponytail' ? [0, 5.0, -4.7] : style === 'updo' ? [0, 7.6, -2.6] : style === 'halfup' ? [0, 5.6, -3.9] : [0, 6.9, -1.4];
  const bun = HP(bunL[0], bunL[1], bunL[2]);
  const hairBackZ = P(add(sk.head, v(0, 0, -6))).z;
  let ribbons: Strand[] = [];
  if (look.ribbon && !bald && !texHead) {
    const rb = style === 'twin' ? [HP(3.9, 5.2, -1.4), HP(-3.9, 5.2, -1.4)] : [{ x: bun.x - 0.8 * S, y: bun.y + 1 * S }, { x: bun.x + 0.8 * S, y: bun.y + 1 * S }];
    ribbons = [strand('rib1', 6, fem ? 4.2 : 3.6, rb[0].x, rb[0].y, 2.6, 0.7), strand('rib2', 5, fem ? 4.6 : 3.6, rb[1].x, rb[1].y, 2.6, 0.7)];
  }
  let ponytail: Strand | null = null;
  if (style === 'ponytail' && !texHead) ponytail = strand('pony', 5, 4.8, bun.x, bun.y, 1.8, 1);
  // 鬓发 / 垂在胸前的发缕
  const lockA = HP(5.25, -0.6, 0.3), lockB = HP(-5.25, -0.6, 0.3);
  const locks = drape && !texHead ? [strand('lockL', 5, 3.4, lockA.x, lockA.y, 1.6, 1), strand('lockR', 5, 3.4, lockB.x, lockB.y, 1.6, 1)] : [];
  // 步摇
  const pinA = HP(2.6, 6.2, -1.8);
  const tassel = look.pin === 'gold' || look.pin === 'jade' ? strand('tassel', 3, 1.6, pinA.x + 1.5 * S, pinA.y, 1.2, 1) : null;
  if (ribbons.length) parts.push({ z: Math.min(hairBackZ, bun.z) - 0.5, f: () => { for (const r of ribbons) ribbon(r, 1.6, 1.0, look.ribbon!, true); } });
  if (ponytail) parts.push({ z: bun.z - 0.6, f: () => ribbon(ponytail!, 4.2, 1.4, look.hair, true) });

  const drawBun = (c: P2, rx: number, ry: number) => {
    const gr = g.createRadialGradient(c.x - rx * 0.35, c.y - ry * 0.4, 0, c.x, c.y, rx * 1.2);
    gr.addColorStop(0, shade(look.hair, 0.28)); gr.addColorStop(0.6, look.hair); gr.addColorStop(1, shade(look.hair, -0.2));
    g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = Math.max(0.35, 0.3 * S);
    g.beginPath(); g.ellipse(c.x + rx * 0.1, c.y + ry * 0.05, rx * 0.62, ry * 0.55, 0.3, 0.4, 4.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = Math.max(0.4, 0.5 * S);
    g.beginPath(); g.ellipse(c.x, c.y, rx * 0.7, ry * 0.6, 0, Math.PI * 1.1, Math.PI * 1.65); g.stroke();
  };

  // 手绘头部贴图：按头部朝向取五个角度之一（另一侧镜像），脖子底端锚在领口
  const texHeadDraw = (name: string) => {
    const a = Math.atan2(sY, cY);          // 0 正对镜头，+π/2 面朝屏幕右
    const aa = Math.abs(a);
    const view: HeadView = aa < 0.39 ? 'front' : aa < 1.18 ? 'q' : aa < 1.96 ? 'side' : aa < 2.75 ? 'qb' : 'back';
    const flip = (view === 'q' || view === 'side' || view === 'qb') && a < 0;
    const nb = P(add(sk.chest, sk.up, HEAD_NECK_UP));
    const top = HP(0, HEAD_TOP_Y, -1.2);
    const H = Math.max(4, (nb.y - top.y) * HEAD_TEX_K);
    const t = headTex(name, view, H); if (!t) return false;
    const W = H * t.img.w / t.img.h;
    const ang = Math.atan2(hed.x - nb.x, nb.y - hed.y) * 0.7;
    g.save();
    g.translate(nb.x, nb.y + H * HEAD_NECK_SINK); g.rotate(ang); if (flip) g.scale(-1, 1);
    g.imageSmoothingQuality = 'high';
    g.drawImage(t.src, -t.img.neckX * W, -H, W, H);
    g.restore();
    return true;
  };

  const headDraw = () => {
    if (texHead && texHeadDraw(texHead)) return;
    // 颈
    tube(P(add(sk.chest, sk.up, 4)), P(add(sk.head, v(0, -5.2, -0.6))), 2.2 * S * hk, 1.95 * S * hk, shade(look.skin, -0.1));
    // 双髻（在头后）
    const behindBuns = () => {
      if (style === 'twin') for (const sx of [1, -1]) { const b = HP(sx * 3.7, 5.9, -1.1); if (b.z < hed.z) drawBun(b, 2.5 * S * hk, 2.3 * S * hk); }
    };
    if (bun.z < hed.z - 0.5 && (style === 'bun' || style === 'crown' || style === 'halfup' || style === 'updo')) drawBun(bun, (style === 'updo' ? 3.4 : 2.9) * S * hk, (style === 'updo' ? 3.0 : 2.5) * S * hk);
    behindBuns();
    // 轮廓
    const hp = hullLocal.map(([x, y, z]) => HP(x, y, z));
    const hull = convexHull(hp);
    const sil = () => {
      const n = hull.length; g.beginPath();
      g.moveTo((hull[n - 1].x + hull[0].x) / 2, (hull[n - 1].y + hull[0].y) / 2);
      for (let i = 0; i < n; i++) { const a = hull[i], b = hull[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
      g.closePath();
    };
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const q of hull) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    sil(); g.fillStyle = look.skin; g.fill();
    g.save(); sil(); g.clip();
    // 面部明暗（左上受光）
    const lg = g.createLinearGradient(minX, minY, maxX, maxY);
    lg.addColorStop(0, 'rgba(255,246,232,0.22)'); lg.addColorStop(0.55, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(120,60,40,0.26)');
    g.fillStyle = lg; g.fillRect(minX, minY, maxX - minX, maxY - minY);
    const detail = S * hk;               // 屏幕上的头部尺度，用于细节 LOD
    // ---- 五官 ----
    const faceVis = visN(0, -0.1, 1);
    if (faceVis > -0.25) {
      // 腮红（女）
      if (fem) for (const sx of [1, -1]) {
        const c = HP(sx * 2.7, -2.3, 3.8), k = Math.max(0, visN(sx * 0.5, -0.2, 0.8));
        if (k > 0.05) { const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 2.2 * detail); gr.addColorStop(0, `rgba(236,120,128,${0.32 * k})`); gr.addColorStop(1, 'rgba(236,120,128,0)'); g.fillStyle = gr; g.fillRect(c.x - 3 * detail, c.y - 3 * detail, 6 * detail, 6 * detail); }
      }
      // 眉
      for (const sx of [1, -1]) {
        const k = visN(sx * 0.42, 0.15, 0.9); if (k < 0.08) continue;
        const a = HP(sx * 0.7, fem ? 1.7 : 1.45, 4.95), b = HP(sx * (fem ? 2.0 : 1.9), fem ? 2.15 : 1.85, 4.78), c = HP(sx * 3.2, fem ? 1.6 : 2.0, 4.05);
        const w0 = (fem ? 0.2 : 0.34) * detail, w1 = (fem ? 0.05 : 0.1) * detail;
        g.fillStyle = rgba(shade(look.hair, fem ? 0.1 : -0.1), 0.9 * Math.min(1, k * 2));
        g.beginPath(); g.moveTo(a.x, a.y - w0); g.quadraticCurveTo(b.x, b.y - w0 * 0.9, c.x, c.y - w1);
        g.quadraticCurveTo(b.x, b.y + w0 * 0.5, a.x, a.y + w0 * 0.6); g.closePath(); g.fill();
      }
      // 花钿
      if (look.huadian) {
        const k = visN(0, 0.3, 1);
        if (k > 0.1) {
          const c = HP(0, 2.3, 5.08), r = 0.5 * detail;
          g.fillStyle = rgba(look.huadian, 0.9 * Math.min(1, k * 1.5));
          g.beginPath(); g.moveTo(c.x, c.y - r * 1.9); g.quadraticCurveTo(c.x + r, c.y - r * 0.2, c.x, c.y + r * 0.9); g.quadraticCurveTo(c.x - r, c.y - r * 0.2, c.x, c.y - r * 1.9); g.fill();
        }
      }
      // 耳坠
      if (look.earring) for (const sx of [1, -1]) {
        const k = visN(sx, 0, 0); if (k < 0.05) continue;
        const e0 = HP(sx * 5.05, -1.8, 0.4), sw = Math.sin((st?.t ?? 0) * 3 + sx) * 0.3 * detail;
        g.strokeStyle = rgba(look.earring, 0.8); g.lineWidth = Math.max(0.3, 0.2 * detail);
        g.beginPath(); g.moveTo(e0.x, e0.y); g.lineTo(e0.x + sw, e0.y + 2.2 * detail); g.stroke();
        g.fillStyle = rgba(look.earring, 0.95); g.beginPath(); g.arc(e0.x + sw, e0.y + 2.5 * detail, 0.55 * detail, 0, Math.PI * 2); g.fill();
      }
      // 眼
      for (const sx of [1, -1]) {
        const k = visN(sx * 0.4, 0, 0.92); if (k < 0.06) continue;
        const al = Math.min(1, k * 2.2);
        const inn = HP(sx * 0.82, -0.05, 4.88), out = HP(sx * 3.15, fem ? 0.42 : 0.15, 4.08);
        const ctr = HP(sx * 1.95, 0.05, 4.75);
        const open = (blink ? 0 : 1) * (fem ? 1.12 : 0.92);
        const up = { x: ctr.x, y: ctr.y - 1.4 * open * detail }, lo = { x: ctr.x, y: ctr.y + 0.75 * open * detail };
        if (pose.eyes < 0.5 || blink) {
          g.strokeStyle = `rgba(30,20,16,${0.9 * al})`; g.lineWidth = Math.max(0.6, 0.55 * detail);
          g.beginPath(); g.moveTo(inn.x, inn.y); g.quadraticCurveTo(ctr.x, ctr.y + 0.75 * detail, out.x, out.y); g.stroke();
          continue;
        }
        if (detail > 1.3) {
          // 眼白
          g.save();
          g.beginPath(); g.moveTo(inn.x, inn.y); g.quadraticCurveTo(up.x, up.y, out.x, out.y); g.quadraticCurveTo(lo.x, lo.y, inn.x, inn.y); g.closePath();
          g.fillStyle = `rgba(250,246,238,${al})`; g.fill(); g.clip();
          // 虹膜（看向前方，随头部转动略偏）
          const ix = ctr.x + (inn.x - out.x) * 0.04, iy = ctr.y - 0.05 * detail, ir = 0.74 * detail;
          const ig = g.createRadialGradient(ix, iy - ir * 0.3, 0, ix, iy, ir);
          ig.addColorStop(0, look.eyeTint ?? (fem ? '#6a4632' : '#4a3426')); ig.addColorStop(0.7, fem ? '#2e1a12' : '#24170f'); ig.addColorStop(1, '#120a06');
          g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#080404'; g.beginPath(); g.arc(ix, iy, ir * 0.42, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix - ir * 0.35, iy - ir * 0.38, ir * 0.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(ix + ir * 0.35, iy + ir * 0.3, ir * 0.14, 0, Math.PI * 2); g.fill();
          // 上眼睑阴影
          g.fillStyle = 'rgba(60,30,20,0.22)'; g.fillRect(inn.x - 3 * detail, up.y - 1 * detail, 6 * detail, 1.05 * detail);
          g.restore();
          // 双眼皮
          g.strokeStyle = `rgba(80,45,35,${0.4 * al})`; g.lineWidth = Math.max(0.3, 0.22 * detail);
          g.beginPath(); g.moveTo(inn.x + (out.x - inn.x) * 0.2, inn.y - 0.55 * detail); g.quadraticCurveTo(up.x, up.y - 0.75 * detail, out.x, out.y - 0.4 * detail); g.stroke();
          // 下眼睑
          g.strokeStyle = `rgba(90,50,40,${0.35 * al})`; g.lineWidth = Math.max(0.3, 0.25 * detail);
          g.beginPath(); g.moveTo(inn.x, inn.y); g.quadraticCurveTo(lo.x, lo.y, out.x, out.y); g.stroke();
        }
        // 上眼线（含眼尾上挑）
        g.strokeStyle = `rgba(22,14,10,${0.95 * al})`; g.lineWidth = Math.max(0.55, (fem ? 0.62 : 0.55) * detail);
        g.beginPath(); g.moveTo(inn.x, inn.y + 0.1 * detail); g.quadraticCurveTo(up.x, up.y, out.x, out.y);
        if (fem) g.lineTo(out.x + (out.x - inn.x) * 0.16, out.y - 0.55 * detail);
        g.stroke();
        if (fem && look.lash && detail > 0.9) {
          // 睫毛：眼尾三笔上挑
          g.strokeStyle = `rgba(18,10,8,${0.85 * al})`; g.lineWidth = Math.max(0.3, 0.2 * detail);
          for (let q = 0; q < 3; q++) {
            const u = 0.72 + q * 0.13, bx = inn.x + (out.x - inn.x) * u, by = (inn.y + (up.y - inn.y) * 1.6 * (1 - u) * u * 2.2) + (out.y - inn.y) * u * 0.5 - 0.15 * detail;
            const dl = Math.max(0.001, Math.hypot(out.x - inn.x, out.y - inn.y)), ddx = (out.x - inn.x) / dl;
            const ox = ddx * (0.3 + q * 0.22) * detail, oy = -(0.32 + q * 0.1) * detail;
            g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + ox * 0.3, by + oy * 0.7, bx + ox, by + oy); g.stroke();
          }
        }
        if (detail <= 1.3) { g.fillStyle = `rgba(22,14,10,${0.9 * al})`; g.beginPath(); g.arc(ctr.x, ctr.y + 0.1 * detail, 0.55 * detail, 0, Math.PI * 2); g.fill(); }
      }
      // 鼻
      {
        const k = faceVis;
        if (k > 0.05) {
          const top = HP(0, -0.7, 5.3), tip = HP(0, -2.35, 5.6), side = HP(0.65 * Math.sign(-sY || 1), -2.2, 5.1);
          g.strokeStyle = `rgba(150,85,62,${0.42 * Math.min(1, k * 2)})`; g.lineWidth = Math.max(0.35, 0.32 * detail);
          g.beginPath(); g.moveTo(top.x + (side.x - tip.x) * 0.5, top.y); g.quadraticCurveTo(side.x, (top.y + tip.y) / 2, tip.x + (side.x - tip.x) * 0.6, tip.y); g.stroke();
          g.fillStyle = `rgba(150,80,60,${0.3 * Math.min(1, k * 2)})`;
          g.beginPath(); g.ellipse(tip.x, tip.y + 0.35 * detail, 0.9 * detail, 0.3 * detail, 0, 0, Math.PI * 2); g.fill();
        }
      }
      // 口
      {
        const k = visN(0, -0.3, 1);
        if (k > 0.05) {
          const al = Math.min(1, k * 2);
          const mc = HP(0, -4.15, 4.8), ml = HP(1.15 * (fem ? 0.82 : 1), -4.05, 4.45), mr = HP(-1.15 * (fem ? 0.82 : 1), -4.05, 4.45);
          if (fem) {
            g.fillStyle = look.lip ? rgba(look.lip, 0.95 * al) : `rgba(200,74,86,${0.95 * al})`;
            g.beginPath(); g.moveTo(ml.x, ml.y);
            g.quadraticCurveTo((ml.x + mc.x) / 2, mc.y - 0.55 * detail, mc.x, mc.y - 0.25 * detail);
            g.quadraticCurveTo((mr.x + mc.x) / 2, mc.y - 0.55 * detail, mr.x, mr.y);
            g.quadraticCurveTo(mc.x, mc.y + 0.95 * detail, ml.x, ml.y); g.closePath(); g.fill();
            g.strokeStyle = `rgba(120,30,40,${0.6 * al})`; g.lineWidth = Math.max(0.3, 0.22 * detail);
            g.beginPath(); g.moveTo(ml.x, ml.y); g.quadraticCurveTo(mc.x, mc.y + 0.12 * detail, mr.x, mr.y); g.stroke();
            if (detail > 1.3) { g.fillStyle = `rgba(255,220,220,${0.45 * al})`; g.beginPath(); g.ellipse(mc.x - 0.2 * detail, mc.y + 0.4 * detail, 0.35 * detail, 0.14 * detail, 0, 0, Math.PI * 2); g.fill(); }
          } else {
            g.strokeStyle = `rgba(130,70,55,${0.75 * al})`; g.lineWidth = Math.max(0.4, 0.38 * detail);
            g.beginPath(); g.moveTo(ml.x, ml.y); g.quadraticCurveTo(mc.x, mc.y + 0.2 * detail, mr.x, mr.y); g.stroke();
            g.strokeStyle = `rgba(130,70,55,${0.25 * al})`;
            g.beginPath(); g.moveTo(ml.x * 0.6 + mc.x * 0.4, mc.y + 0.8 * detail); g.lineTo(mr.x * 0.6 + mc.x * 0.4, mc.y + 0.8 * detail); g.stroke();
          }
          if (look.beard) {
            const ch = HP(0, -6.4, 3.8);
            g.fillStyle = look.beard; g.beginPath(); g.moveTo(ml.x - 0.6 * detail, ml.y + 0.6 * detail); g.quadraticCurveTo(ch.x, ch.y + 7 * detail, mr.x + 0.6 * detail, mr.y + 0.6 * detail); g.quadraticCurveTo(ch.x, ch.y, ml.x - 0.6 * detail, ml.y + 0.6 * detail); g.fill();
          }
        }
      }
    }
    // ---- 头发（发际线以上区域）----
    if (!bald) {
      const N = 36; const pts: { x: number; y: number; n: number; a: number }[] = [];
      for (let i = 0; i < N; i++) {
        const a = -Math.PI + (i / N) * Math.PI * 2;
        const s = surf(a, hairline(a), 1.06); const q = HP(s.x, s.y, s.z);
        pts.push({ x: q.x, y: q.y, n: s.n, a });
      }
      // 最长的连续可见段
      let best = -1, bestLen = 0;
      for (let i = 0; i < N; i++) {
        if (pts[i].n <= 0 || pts[(i - 1 + N) % N].n > 0) continue;
        let l = 0; while (l < N && pts[(i + l) % N].n > 0) l++;
        if (l > bestLen) { bestLen = l; best = i; }
      }
      const cx = (minX + maxX) / 2, BIG = 60 * S;
      g.beginPath();
      if (best < 0) g.rect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
      else {
        const run = []; for (let l = 0; l < bestLen; l++) run.push(pts[(best + l) % N]);
        const A = run[0], B = run[run.length - 1];
        const sa = Math.sign(A.x - cx) || -1, sb = Math.sign(B.x - cx) || 1;
        g.moveTo(A.x + sa * BIG, A.y); g.lineTo(A.x, A.y);
        for (let i = 1; i < run.length; i++) g.quadraticCurveTo(run[i - 1].x, run[i - 1].y, (run[i - 1].x + run[i].x) / 2, (run[i - 1].y + run[i].y) / 2);
        g.lineTo(B.x, B.y); g.lineTo(B.x + sb * BIG, B.y); g.lineTo(B.x + sb * BIG, minY - BIG); g.lineTo(A.x + sa * BIG, minY - BIG); g.closePath();
      }
      g.save(); g.clip();
      const hg = g.createLinearGradient(minX, minY, maxX, maxY);
      hg.addColorStop(0, shade(look.hair, 0.22)); hg.addColorStop(0.5, look.hair); hg.addColorStop(1, shade(look.hair, -0.25));
      g.fillStyle = hg; g.fillRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
      // 发丝：从发旋到发际线
      const crown = HP(0, 7.0, -0.8);
      g.lineWidth = Math.max(0.3, 0.26 * S);
      for (let i = 0; i < N; i += 2) {
        const p = pts[i]; if (p.n < -0.2) continue;
        const mid = surf(p.a, (hairline(p.a) + 6.5) / 2, 1.13); const mq = HP(mid.x, mid.y, mid.z);
        g.strokeStyle = i % 4 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.3)';
        g.beginPath(); g.moveTo(crown.x, crown.y); g.quadraticCurveTo(mq.x, mq.y, p.x, p.y); g.stroke();
      }
      // 光泽环
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.3 * S; g.beginPath();
      let started = false;
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI + (i / 24) * Math.PI * 2; const s = surf(a, 4.4, 1.07);
        if (s.n <= 0.05) { started = false; continue; }
        const q = HP(s.x, s.y, s.z); if (!started) { g.moveTo(q.x, q.y); started = true; } else g.lineTo(q.x, q.y);
      }
      g.stroke();
      g.restore();
      // 发际线柔化
      g.restore(); g.save(); sil(); g.clip();
      // 刘海 / 中分侧发
      if (faceVis > 0) {
        g.fillStyle = look.hair;
        if (look.bangs) {
          for (let i = -3; i <= 3; i++) {
            const a0 = i * 0.2; const s0 = surf(a0 - 0.08, 3.4, 1.06), s1 = surf(a0 + 0.1, 3.4, 1.06), s2 = surf(a0 + 0.04 * Math.sign(i || 1), 1.75 + Math.abs(i) * 0.15, 1.08);
            const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z);
            if (s2.n < 0) continue;
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q0.x, q2.y - 1 * S, q2.x, q2.y); g.quadraticCurveTo(q1.x, q2.y - 1.2 * S, q1.x, q1.y); g.closePath(); g.fill();
          }
        } else if (fem && (style === 'long' || style === 'halfup' || style === 'twin') && Math.abs(sY) < 0.35) {
          for (const sx of [1, -1]) {
            const s0 = surf(sx * 0.1, 3.7, 1.07), s1 = surf(sx * 0.55, 2.7, 1.08), s2 = surf(sx * 0.95, 0.3, 1.1), s3 = surf(sx * 1.2, 2.2, 1.07);
            if (s2.n < 0.2 || s1.n < 0.2) continue;
            const q0 = HP(s0.x, s0.y, s0.z), q1 = HP(s1.x, s1.y, s1.z), q2 = HP(s2.x, s2.y, s2.z), q3 = HP(s3.x, s3.y, s3.z);
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y + 0.6 * S, q2.x, q2.y); g.quadraticCurveTo(q3.x, q3.y, q0.x, q0.y - 0.5 * S); g.closePath(); g.fill();
            g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(0.3, 0.3 * S);
            g.beginPath(); g.moveTo(q0.x, q0.y); g.quadraticCurveTo(q1.x, q1.y + 0.2 * S, q2.x, q2.y); g.stroke();
          }
        }
      }
    }
    g.restore();
    // 耳
    if (!(drape && fem) && !bald || bald) {
      for (const sx of [1, -1]) {
        const k = visN(sx, 0, 0.35); if (k < 0.3) continue;
        const e = HP(sx * 4.75, -0.7, -0.35), et = HP(sx * 4.9, 0.6, -0.6);
        const ang = Math.atan2(et.y - e.y, et.x - e.x) + Math.PI / 2;
        g.fillStyle = shade(look.skin, -0.04);
        g.beginPath(); g.ellipse(e.x, e.y, 0.95 * S * hk * Math.min(1, k * 1.5), 1.75 * S * hk, ang, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(70,40,28,0.7)'; g.lineWidth = Math.max(0.35, 0.35 * S); g.stroke();
        g.strokeStyle = 'rgba(150,80,60,0.45)'; g.beginPath(); g.ellipse(e.x, e.y, 0.45 * S * hk * Math.min(1, k * 1.5), 1.0 * S * hk, ang, -1, 1.6); g.stroke();
      }
    }
    // 轮廓描边（毛笔：下巴略粗）
    g.strokeStyle = ink; g.lineWidth = lw * 0.85; sil(); g.stroke();
    // 胸前发缕 / 鬓发
    for (let li = 0; li < locks.length; li++) {
      const s = locks[li];
      if (visN(li ? -1 : 1, 0, 0.9) < 0.45) continue;
      ribbon(s, 0.75, 0.1, look.hair, false);
    }
    // 发髻（在头前或头顶）
    if (bun.z >= hed.z - 0.5 && (style === 'bun' || style === 'crown' || style === 'halfup' || style === 'updo')) drawBun(bun, (style === 'updo' ? 3.4 : 2.9) * S * hk, (style === 'updo' ? 3.0 : 2.5) * S * hk);
    if (style === 'twin') for (const sx of [1, -1]) { const b = HP(sx * 3.7, 5.9, -1.1); if (b.z >= hed.z) drawBun(b, 2.5 * S * hk, 2.3 * S * hk); }
    if (style === 'ponytail') drawBun(bun, 1.6 * S, 1.5 * S);
    if (style === 'crown') {
      // 玉冠
      const c = HP(0, 8.1, -1.2);
      const w = 2.4 * S;
      g.fillStyle = '#efeadc'; g.beginPath(); g.moveTo(c.x - w, c.y + 1.6 * S); g.lineTo(c.x - w * 0.8, c.y - 1.4 * S); g.quadraticCurveTo(c.x, c.y - 2.6 * S, c.x + w * 0.8, c.y - 1.4 * S); g.lineTo(c.x + w, c.y + 1.6 * S); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke();
      g.fillStyle = 'rgba(120,170,140,0.6)'; g.beginPath(); g.arc(c.x, c.y - 0.2 * S, 0.7 * S, 0, Math.PI * 2); g.fill();
    }
    // 发簪
    if (style === 'bun' || style === 'crown' || style === 'updo' || look.pin) {
      const ca = Math.cos(Yh);
      const pc = style === 'halfup' || style === 'twin' || style === 'long' ? pinA : bun;
      g.strokeStyle = look.pin === 'gold' ? '#d8b050' : look.pin === 'jade' ? '#a8d8c0' : style === 'crown' ? '#e8e0c8' : '#8a6a42';
      g.lineWidth = 0.8 * S;
      g.beginPath(); g.moveTo(pc.x - 4.5 * S * Math.abs(ca) - 1.3 * S, pc.y + 0.4 * S); g.lineTo(pc.x + 4.5 * S * Math.abs(ca) + 1.3 * S, pc.y - 0.4 * S); g.stroke();
      if (look.pin === 'flower') {
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.fillStyle = '#f0b8c8'; g.beginPath(); g.arc(pc.x + Math.cos(a) * 1.1 * S, pc.y + Math.sin(a) * 1.1 * S, 0.8 * S, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#f8e070'; g.beginPath(); g.arc(pc.x, pc.y, 0.5 * S, 0, Math.PI * 2); g.fill();
      }
      if (tassel) {
        g.strokeStyle = look.pin === 'gold' ? 'rgba(216,176,80,0.9)' : 'rgba(168,216,192,0.9)'; g.lineWidth = 0.35 * S;
        g.beginPath(); g.moveTo(tassel.x[0], tassel.y[0]); for (let i = 1; i < tassel.n; i++) g.lineTo(tassel.x[i], tassel.y[i]); g.stroke();
        g.fillStyle = look.pin === 'gold' ? '#e8c060' : '#b8e8d0';
        g.beginPath(); g.arc(tassel.x[tassel.n - 1], tassel.y[tassel.n - 1], 0.6 * S, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e05060'; g.beginPath(); g.arc(tassel.x[1], tassel.y[1], 0.4 * S, 0, Math.PI * 2); g.fill();
      }
    }
    // 斗笠
    if (look.hat === 'douli') {
      const top = HP(0, 10, 0);
      const brim = HP(0, 5.0, 0);
      g.fillStyle = '#c8a76a';
      g.beginPath(); g.ellipse(brim.x, brim.y, 14 * S, 14 * S * SP * 1.3, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = lw; g.stroke();
      g.beginPath(); g.moveTo(brim.x - 13 * S, brim.y); g.quadraticCurveTo(top.x, top.y - 6 * S, brim.x + 13 * S, brim.y); g.closePath();
      g.fillStyle = '#d6b87c'; g.fill(); g.stroke();
      g.strokeStyle = 'rgba(110,80,40,0.45)'; g.lineWidth = lw * 0.6;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(top.x, top.y - 3 * S); g.lineTo(brim.x + i * 5.5 * S, brim.y + 1.2 * S); g.stroke(); }
    }
  };
  parts.push({ z: torsoZ + 3, f: headDraw });

  // 2. 排序绘制
  parts.sort((a, b) => a.z - b.z);
  for (const p of parts) p.f();
  g.restore();
  return { headX: hed.x, headY: hed.y, handX: P(sk.rHa).x, handY: P(sk.rHa).y, lHandX: P(sk.lHa).x, lHandY: P(sk.lHa).y, front };
}

// 脚下飞舟（神风舟等）：侧视造型按朝向斜投影，舷下风纹灵光
function headingAxis(yaw: number) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  let ex = dx, ey = dz * 0.32;
  if (Math.abs(ex) < 0.55) ex = (ex < 0 ? -1 : 1) * 0.55;   // 正对/背对镜头时仍留一点侧面
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
    // 翅缘雷丝
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
  const gp = 0.55; // 地面投影压缩
  const tipX = x + dx * L, tipY = y + dz * L * gp, tailX = x - dx * L * 0.85, tailY = y - dz * L * 0.85 * gp;
  // 剑光
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, L * 1.2);
  gr.addColorStop(0, rgba(color, 0.38)); gr.addColorStop(1, rgba(color, 0));
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
  g.strokeStyle = rgba(color, 0.9); g.lineWidth = 0.9 * S; g.stroke();
  // 剑格与剑柄
  const gx = tailX + (x - tailX) * 0.15, gy = tailY + (y - tailY) * 0.15;
  g.strokeStyle = '#c8a050'; g.lineWidth = 1.6 * S;
  g.beginPath(); g.moveTo(gx + nx / nd * w * 2, gy + ny / nd * w * 2); g.lineTo(gx - nx / nd * w * 2, gy - ny / nd * w * 2); g.stroke();
  g.strokeStyle = '#3a2a20'; g.lineWidth = 1.8 * S;
  g.beginPath(); g.moveTo(gx, gy); g.lineTo(tailX - dx * 6 * S, tailY - dz * 6 * S * gp); g.stroke();
  void t;
}

// ---------------------------------------------------------------- NPC 外观随机
const ROBES = ['#3f6a4c', '#4a5f7a', '#6a4a3a', '#7a6a4a', '#5a5a62', '#2f4f5f', '#7a3a32', '#4f6f6a', '#8a7a5a', '#3a3a40', '#6a5a7a', '#a8a090', '#5f7f4f'];
const FROBES = ['#c86a7a', '#e8d8e0', '#8fb0c8', '#d8b0c0', '#b8c8a0', '#e0c8a8', '#a080b0', '#f0e8f0', '#c05050', '#70a0a0'];
const HAIRS = ['#1d1a17', '#241f1b', '#2a2420', '#151311', '#3a2e26'];
const SKINS = ['#f1d9bd', '#ecd2b2', '#e6c8a6', '#f4ddc4', '#dcb894'];

export type NpcRole = 'cultivator' | 'scholar' | 'farmer' | 'merchant' | 'female' | 'elder' | 'guard' | 'monk';

export function randomLook(rnd: () => number, role?: NpcRole): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const r = role ?? pick<NpcRole>(['cultivator', 'cultivator', 'scholar', 'farmer', 'merchant', 'female', 'female', 'elder', 'guard']);
  const base: Look = {
    sex: 'm', height: 0.93 + rnd() * 0.13, build: 0.92 + rnd() * 0.16, skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'bun',
    robe: pick(ROBES), inner: '#ece6d6', trim: '#2b2b2b', belt: '#1f2420', pants: '#6a5f50', boots: '#2a2622',
    robeLen: 'long', sleeve: 'wide', ribbon: undefined, sash: undefined, back: 'none', waist: 'none', hand: 'none',
    swordColor: pick(['#7ff0c0', '#9fc8ff', '#ffd27a', '#ff9a8a', '#d0a8ff']),
  };
  base.trim = shade(base.robe, -0.45);
  if (r === 'cultivator') {
    base.hairStyle = pick(['bun', 'crown', 'ponytail', 'bun']);
    base.ribbon = rnd() < 0.7 ? shade(base.robe, -0.3) : undefined;
    base.back = rnd() < 0.45 ? 'sword' : 'none';
    base.waist = pick(['jade', 'pouch', 'gourd', 'none']);
    base.sash = rnd() < 0.5 ? base.belt : undefined;
  } else if (r === 'scholar') {
    base.hairStyle = 'crown'; base.robe = pick(['#e8e2d0', '#c8d0c8', '#8a9aa8', '#b8a888']); base.trim = shade(base.robe, -0.5);
    base.hand = rnd() < 0.5 ? 'fan' : 'none'; base.back = rnd() < 0.3 ? 'box' : 'none'; base.waist = 'jade';
  } else if (r === 'farmer') {
    base.robeLen = 'short'; base.sleeve = 'narrow'; base.robe = pick(['#8a7a5a', '#6a6a58', '#7a6a50', '#5a6a6a']);
    base.trim = shade(base.robe, -0.4); base.hat = rnd() < 0.6 ? 'douli' : 'none'; base.back = rnd() < 0.4 ? 'basket' : 'none';
    base.pants = '#4a4438';
  } else if (r === 'merchant') {
    base.robe = pick(['#7a3a32', '#5a4a7a', '#8a6a3a', '#3a5a6a']); base.trim = '#c8a050'; base.build *= 1.08; base.waist = 'pouch';
    base.hairStyle = 'crown';
  } else if (r === 'female') {
    base.sex = 'f'; base.height *= 0.94; base.build = 0.9; base.robe = pick(FROBES); base.trim = shade(base.robe, -0.35);
    base.hairStyle = pick(['halfup', 'twin', 'long', 'halfup', 'updo']); base.ribbon = rnd() < 0.6 ? pick(['#c03040', '#f0f0f0', '#5070a0', '#e0a0b0']) : undefined;
    base.bangs = base.hairStyle === 'twin' ? rnd() < 0.7 : rnd() < 0.2;
    base.pin = pick<Look['pin']>(['gold', 'jade', 'flower', undefined, 'gold']);
    base.shawl = rnd() < 0.75 ? pick(['#f4e8f0', '#e0b0c0', '#b0d0e8', '#f8f0d8', '#c8e0c0']) : undefined;
    base.waist = 'jade'; base.inner = '#f6f0e8'; base.pants = shade(base.robe, -0.2); base.boots = '#5a4040';
  } else if (r === 'elder') {
    base.hair = '#d8d4cc'; base.beard = '#e4e0d8'; base.hairStyle = 'crown'; base.robe = pick(['#3a3a40', '#4a3a2a', '#e8e2d0', '#5a2a2a']);
    base.trim = shade(base.robe, -0.45); base.hand = rnd() < 0.5 ? 'staff' : 'none'; base.height *= 0.97;
  } else if (r === 'guard') {
    base.robeLen = 'short'; base.sleeve = 'narrow'; base.robe = pick(['#5a3a2a', '#3a4a5a', '#4a4a3a']); base.trim = '#8a6a3a';
    base.back = 'sword'; base.hairStyle = 'ponytail'; base.build *= 1.1;
  } else if (r === 'monk') {
    base.hairStyle = 'bald'; base.robe = '#c88a3a'; base.trim = '#8a3a2a'; base.inner = '#e8d8b0';
  }
  return base;
}
