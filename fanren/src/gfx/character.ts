// 代码绘制的人物：3D 骨骼 + 俯视斜角投影 + 布料（袖、衣摆、发带、腰带）模拟
// 所有角色共用同一套骨骼与动作，外观（发型/服饰/颜色/配饰）由 Look 参数决定。
import { shade, rgba } from '../core/canvas';

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
  hairStyle: 'bun' | 'crown' | 'ponytail' | 'long' | 'twin' | 'halfup' | 'bald';
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
}

export const HANLI_LOOK: Look = {
  sex: 'm', height: 1, build: 1, skin: '#f1d9bd', hair: '#1d1a17', hairStyle: 'bun',
  robe: '#3f6a4c', inner: '#ece6d6', trim: '#2b4636', belt: '#1f2420', pants: '#8a7a62', boots: '#2a2622',
  robeLen: 'long', sleeve: 'wide', ribbon: '#2a3a30', sash: '#1f2420', back: 'none', waist: 'pouch', hand: 'none',
  swordColor: '#7ff0c0',
};

// ---------------------------------------------------------------- 姿态
export interface Pose {
  rootY: number; rootX: number; rootZ: number;
  lean: number; side: number; twist: number;
  headPitch: number; headYaw: number; breath: number;
  lSh: number; lShR: number; lEl: number; lFr: number;
  rSh: number; rShR: number; rEl: number; rFr: number;
  lHip: number; lHipR: number; lKn: number;
  rHip: number; rHipR: number; rKn: number;
  lFoot: number; rFoot: number;
  sit: number; eyes: number; ground: number; // ground: 是否贴地（1）
}
const POSE_KEYS: (keyof Pose)[] = ['rootY', 'rootX', 'rootZ', 'lean', 'side', 'twist', 'headPitch', 'headYaw', 'breath', 'lSh', 'lShR', 'lEl', 'lFr', 'rSh', 'rShR', 'rEl', 'rFr', 'lHip', 'lHipR', 'lKn', 'rHip', 'rHipR', 'rKn', 'lFoot', 'rFoot', 'sit', 'eyes', 'ground'];

function neutral(): Pose {
  return {
    rootY: 0, rootX: 0, rootZ: 0, lean: 0.02, side: 0, twist: 0, headPitch: 0, headYaw: 0, breath: 0,
    lSh: 0.04, lShR: 0.13, lEl: 0.2, lFr: 0.08, rSh: 0.04, rShR: 0.13, rEl: 0.2, rFr: 0.08,
    lHip: 0, lHipR: 0.04, lKn: 0.05, rHip: 0, rHipR: 0.04, rKn: 0.05, lFoot: 0, rFoot: 0,
    sit: 0, eyes: 1, ground: 1,
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
  }
  return { pelvis, chest, neck, head, up, lSh, rSh, lEl, rEl, lWr, rWr, lHa, rHa, lHip, rHip, lKn, rKn, lAn, rAn, lToe, rToe, sw, hw, ww, td };
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

export interface DrawOpts { alpha?: number; ghost?: boolean; glow?: number; preview?: boolean }

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
  const flutter = (flying ? 1 : st.action === 'run' ? 0.5 : 0.15) * Math.sin(st.t * 13 + st.seed);
  const windX = -st.vx * 1.0 + st.windX + flutter * 40 * S;
  const windY = -st.vy * 1.0 + st.windY + flutter * 20 * S;
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
    parts.push({ z: -999, f: () => drawSwordUnderFeet(g, bx, by, yaw, S, st.t, look.swordColor || '#7ff0c0') });
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
    const fl = (flying ? 1 : st.action === 'run' ? 0.6 : 0.2);
    const half = (side: 1 | -1) => {
      const hip = side > 0 ? sk.lHip : sk.rHip, kn = side > 0 ? sk.lKn : sk.rKn, an = side > 0 ? sk.lAn : sk.rAn;
      // 衣摆高度：长袍到小腿下部，短褂到膝
      const hemOn = long ? add(kn, add(an, kn, -1), 0.8) : add(hip, add(kn, hip, -1), 1.02);
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

  // 披帛（女修）
  if (look.shawl) {
    const lS = P(add(sk.lSh, v(0, -2, -2))), rS = P(add(sk.rSh, v(0, -2, -2)));
    const s1 = strand('shawlL', 7, 5, lS.x, lS.y, 2.8, 0.9), s2 = strand('shawlR', 7, 5, rS.x, rS.y, 2.8, 0.9);
    const zb = P(add(sk.chest, v(0, 0, -sk.td - 2))).z;
    parts.push({ z: zb, f: () => {
      g.strokeStyle = rgba(look.shawl!, 0.85); g.lineWidth = 2.4 * S;
      g.beginPath(); g.moveTo(lS.x, lS.y); g.quadraticCurveTo((lS.x + rS.x) / 2, Math.max(lS.y, rS.y) + 6 * S, rS.x, rS.y); g.stroke();
    } });
    parts.push({ z: torsoZ + 1.5, f: () => { ribbon(s1, 2.4, 2.0, rgba(look.shawl!, 0.88), false); ribbon(s2, 2.4, 2.0, rgba(look.shawl!, 0.88), false); } });
  }

  // ---------- 头部 ----------
  const hairBackZ = P(add(sk.head, v(0, 0, -6))).z;
  const longHair = look.hairStyle === 'long' || look.hairStyle === 'halfup' || look.hairStyle === 'twin' || (look.sex === 'f' && look.hairStyle !== 'bald');
  if (longHair) {
    const hb = P(add(sk.head, v(0, -1, -4.5)));
    const s = strand('hairLong', 6, look.sex === 'f' ? 6.2 : 5.2, hb.x, hb.y, 1.6, 1.1);
    const zz = P(add(sk.chest, v(0, 0, -sk.td - 1))).z;
    parts.push({ z: zz, f: () => ribbon(s, 10, 5, look.hair, true, { x: hb.x, y: hb.y - 3 * S }) });
  }
  // 发髻 + 发带
  const bunPos = look.hairStyle === 'ponytail' ? add(sk.head, v(0, 5.5, -4)) : add(sk.head, v(0, 7.2, -1.2));
  const bun = P(bunPos);
  let ribbons: Strand[] = [];
  if (look.ribbon && look.hairStyle !== 'bald') {
    const r1 = strand('rib1', 6, 3.6, bun.x - 0.8 * S, bun.y + 1 * S, 2.6, 0.7);
    const r2 = strand('rib2', 5, 3.6, bun.x + 0.8 * S, bun.y + 1 * S, 2.6, 0.7);
    ribbons = [r1, r2];
  }
  let ponytail: Strand | null = null;
  if (look.hairStyle === 'ponytail') ponytail = strand('pony', 5, 4.6, bun.x, bun.y, 1.8, 1);
  const sideLocks = look.hairStyle !== 'bald' ? [
    strand('lockL', 3, 3.2, P(add(sk.head, v(4.6, 1.5, 2))).x, P(add(sk.head, v(4.6, 1.5, 2))).y, 1.5, 1),
    strand('lockR', 3, 3.2, P(add(sk.head, v(-4.6, 1.5, 2))).x, P(add(sk.head, v(-4.6, 1.5, 2))).y, 1.5, 1),
  ] : [];
  if (ribbons.length) parts.push({ z: Math.min(hairBackZ, bun.z) - 0.5, f: () => { for (const r of ribbons) ribbon(r, 1.7, 1.2, look.ribbon!, true); } });
  if (ponytail) parts.push({ z: bun.z - 0.6, f: () => ribbon(ponytail!, 4, 2, look.hair, true) });

  const headDraw = () => {
    // 颈
    tube(P(add(sk.chest, sk.up, 4)), P(add(sk.head, v(0, -5, -0.5))), 2.4 * S, 2.2 * S, shade(look.skin, -0.08));
    const H = hed;
    const rx = 5.5 * S, ry = 6.9 * S;
    const hy = yaw + pose.headYaw;
    const fc = Math.cos(hy), fs = Math.sin(hy);
    // 头（发色底；光头用肤色）
    const bald = look.hairStyle === 'bald';
    g.fillStyle = bald ? shade(look.skin, -0.06) : look.hair;
    g.beginPath(); g.ellipse(H.x, H.y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    // 脸
    if (fc > -0.45) {
      g.save();
      g.beginPath(); g.ellipse(H.x, H.y, rx, ry, 0, 0, Math.PI * 2); g.clip();
      const fx = H.x + fs * rx * 0.62, fy = H.y + 1.6 * S;
      const fw = rx * (0.62 + 0.3 * Math.max(0, fc)), fh = ry * 0.82;
      g.fillStyle = look.skin;
      g.beginPath(); g.ellipse(fx, fy, fw, fh, 0, 0, Math.PI * 2); g.fill();
      // 侧光阴影
      const gr = g.createLinearGradient(H.x - rx, 0, H.x + rx, 0);
      gr.addColorStop(0, 'rgba(255,240,220,0.12)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,50,30,0.22)');
      g.fillStyle = gr; g.fillRect(H.x - rx, H.y - ry, rx * 2, ry * 2);
      // 刘海 / 发际线
      g.fillStyle = bald ? 'rgba(0,0,0,0)' : look.hair;
      g.beginPath();
      g.moveTo(H.x - rx * 1.1, H.y - ry * 0.15);
      g.quadraticCurveTo(fx - fw * 0.4, H.y - ry * 0.55 + 1.2 * S, fx + fs * 1.5 * S, H.y - ry * 0.42);
      g.quadraticCurveTo(fx + fw * 0.4, H.y - ry * 0.55 + 1.2 * S, H.x + rx * 1.1, H.y - ry * 0.15);
      g.lineTo(H.x + rx * 1.1, H.y - ry * 1.1); g.lineTo(H.x - rx * 1.1, H.y - ry * 1.1); g.closePath(); g.fill();
      g.restore();
      // 五官
      if (fc > 0.05) {
        const eyeY = H.y + 0.9 * S;
        for (const ex of [-1, 1]) {
          const lx = 2.15 * ex; // 局部（左为+）
          const X = lx * Math.cos(hy) + 4.9 * Math.sin(hy);
          const Z = -lx * Math.sin(hy) + 4.9 * Math.cos(hy);
          if (Z < 1.2) continue;
          const px = H.x + X * S, k = Math.min(1, (Z - 1.2) / 2.5);
          g.strokeStyle = `rgba(25,18,14,${0.9 * k})`;
          g.lineWidth = Math.max(0.6, 0.9 * S);
          if (pose.eyes > 0.5) {
            g.beginPath(); g.moveTo(px - 1.1 * S, eyeY); g.quadraticCurveTo(px, eyeY - 0.7 * S, px + 1.1 * S, eyeY + 0.1 * S); g.stroke();
            g.fillStyle = `rgba(25,18,14,${0.9 * k})`; g.beginPath(); g.arc(px, eyeY + 0.15 * S, 0.55 * S, 0, Math.PI * 2); g.fill();
          } else {
            g.beginPath(); g.moveTo(px - 1.1 * S, eyeY); g.quadraticCurveTo(px, eyeY + 0.7 * S, px + 1.1 * S, eyeY); g.stroke();
          }
          // 眉
          g.lineWidth = Math.max(0.5, 0.8 * S);
          g.beginPath(); g.moveTo(px - 1.3 * S, eyeY - 2.0 * S); g.quadraticCurveTo(px, eyeY - 2.6 * S, px + 1.3 * S, eyeY - 2.1 * S); g.stroke();
        }
        // 鼻与口
        const nX = H.x + 5.2 * Math.sin(hy) * S;
        g.strokeStyle = 'rgba(120,70,50,0.5)'; g.lineWidth = Math.max(0.5, 0.6 * S);
        g.beginPath(); g.moveTo(nX, H.y + 2.4 * S); g.lineTo(nX + fs * 0.8 * S, H.y + 3.4 * S); g.stroke();
        g.strokeStyle = look.sex === 'f' ? 'rgba(190,70,70,0.85)' : 'rgba(150,80,65,0.7)'; g.lineWidth = Math.max(0.5, 0.8 * S);
        g.beginPath(); g.moveTo(nX - 1 * S * fc, H.y + 4.7 * S); g.lineTo(nX + 1 * S * fc, H.y + 4.7 * S); g.stroke();
        if (look.beard) {
          g.fillStyle = look.beard; g.beginPath(); g.moveTo(nX - 1.8 * S, H.y + 5.2 * S); g.quadraticCurveTo(nX, H.y + 12 * S, nX + 1.8 * S, H.y + 5.2 * S); g.fill();
        }
      }
      // 耳
      if (Math.abs(fs) > 0.3) {
        const ex = H.x - Math.sign(fs) * rx * 0.62, ey = H.y + 1.2 * S;
        g.fillStyle = shade(look.skin, -0.05); g.beginPath(); g.ellipse(ex, ey, 1.2 * S, 1.9 * S, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // 轮廓
    g.strokeStyle = ink; g.lineWidth = lw;
    g.beginPath(); g.ellipse(H.x, H.y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    // 鬓发
    for (const s of sideLocks) {
      const fcv = Math.cos(yaw);
      if (fcv > -0.3) ribbon(s, 1.6, 0.6, look.hair, false);
    }
    // 发髻
    if (look.hairStyle === 'bun' || look.hairStyle === 'crown' || look.hairStyle === 'halfup') {
      g.fillStyle = look.hair; g.beginPath(); g.ellipse(bun.x, bun.y, 3.2 * S, 2.8 * S, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink; g.lineWidth = lw * 0.9; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = lw * 0.7;
      g.beginPath(); g.arc(bun.x - 0.6 * S, bun.y - 0.4 * S, 1.8 * S, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      if (look.hairStyle === 'crown') {
        g.fillStyle = '#d8c070'; g.beginPath(); g.moveTo(bun.x - 3 * S, bun.y + 1.4 * S); g.lineTo(bun.x - 2.4 * S, bun.y - 2.8 * S); g.lineTo(bun.x, bun.y - 1.6 * S); g.lineTo(bun.x + 2.4 * S, bun.y - 2.8 * S); g.lineTo(bun.x + 3 * S, bun.y + 1.4 * S); g.closePath(); g.fill();
        g.strokeStyle = ink; g.lineWidth = lw * 0.6; g.stroke();
      }
      // 发簪
      const ca = Math.cos(yaw);
      g.strokeStyle = look.hairStyle === 'crown' ? '#e8e0c8' : '#8a6a42'; g.lineWidth = 0.9 * S;
      g.beginPath(); g.moveTo(bun.x - 5 * S * Math.abs(ca) - 1.5 * S, bun.y + 0.4 * S); g.lineTo(bun.x + 5 * S * Math.abs(ca) + 1.5 * S, bun.y - 0.4 * S); g.stroke();
    } else if (look.hairStyle === 'twin') {
      for (const sx of [-1, 1]) {
        const b = P(add(sk.head, v(sx * 4.4, 6, -1)));
        g.fillStyle = look.hair; g.beginPath(); g.arc(b.x, b.y, 2.6 * S, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke();
      }
    } else if (look.hairStyle === 'ponytail') {
      g.fillStyle = look.hair; g.beginPath(); g.arc(bun.x, bun.y, 2 * S, 0, Math.PI * 2); g.fill();
    }
    // 斗笠
    if (look.hat === 'douli') {
      const top = P(add(sk.head, v(0, 9, 0)));
      const brim = P(add(sk.head, v(0, 4.2, 0)));
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
    base.hairStyle = pick(['halfup', 'twin', 'long', 'halfup']); base.ribbon = rnd() < 0.6 ? pick(['#c03040', '#f0f0f0', '#5070a0', '#e0a0b0']) : undefined;
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
