// 物理时间线：C 形坡道（缓和曲线 + 圆弧）上的行驶、顶部倒挂刹停、1 秒静止、脱离、
// 冷气横滚 180°、反推减速下降、触地悬挂压缩回弹。全部预先积分，state(t) 可任意跳转（确定性）。
import * as THREE from 'three';

export const G = 9.81;
export const H_TOP = 18;          // 坡道顶部高度（接触面）
export const V0 = 27.5;           // 入坡速度 m/s（≈99 km/h）
export const L0 = 72;             // 入坡前直道长度
export const MASS = 1900;         // kg
export const COM_H = 0.55;        // 质心离接触面的高度
export const RW = 0.36;           // 轮胎半径
const LT_IN = 14, LT_OUT = 7;     // 入 / 出缓和曲线长度
const BRAKE_A = 12.5;             // 顶部倒挂刹车减速度 m/s²
export const HOLD = 1.0;          // 倒挂静止时长

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** 由曲率函数积分出坡道曲线（x-y 平面），返回每 0.05 m 一个采样 */
function integrateLoop(k) {
  const La = Math.PI / k - LT_IN / 2 - LT_OUT / 2;
  if (La < 0) return null;
  const Lc = LT_IN + La + LT_OUT, du = 0.005;
  let x = 0, y = 0, phi = 0;
  const pts = [{ x, y, phi, kap: 0 }];
  let next = 0.05;
  for (let u = 0; u < Lc - 1e-9; u += du) {
    const um = u + du / 2;
    const kap = um < LT_IN ? k * um / LT_IN : um < LT_IN + La ? k : k * (1 - (um - LT_IN - La) / LT_OUT);
    phi += kap * du;
    x += Math.cos(phi - kap * du / 2) * du; y += Math.sin(phi - kap * du / 2) * du;
    if (u + du >= next - 1e-9) { pts.push({ x, y, phi, kap }); next += 0.05; }
  }
  return { Lc, pts, end: { x, y, phi } };
}

export function buildTimeline() {
  // 1) 求曲率 k，使坡道顶端恰好在 H_TOP 处水平倒置
  let lo = 0.06, hi = 0.6, loop = null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2, r = integrateLoop(mid);
    if (!r) { hi = mid; continue; }
    if (r.end.y > H_TOP) lo = mid; else hi = mid;
    loop = r;
  }
  const kLoop = (lo + hi) / 2; loop = integrateLoop(kLoop);
  const Lc = loop.Lc;
  const xTop = loop.end.x;   // 顶端起点（倒置直道开始处）
  const vTop = Math.sqrt(V0 * V0 - 2 * G * H_TOP - 0.9 * Lc);   // 能量守恒（含少量风阻 / 滚阻损失）
  const LB = vTop * vTop / (2 * BRAKE_A);    // 倒置刹车距离
  const L2 = LB + 2.6 + 1.2;                  // 倒置直道总长（车头前留余量 + 端部挡块）
  const S1 = L0, S2 = L0 + Lc, S_STOP = S2 + LB, S_END = S2 + L2;

  /** 曲线采样：s → 接触点 (x,y)、航向 phi、曲率 kap */
  const curve = (s) => {
    if (s <= S1) return { x: -L0 + s, y: 0, phi: 0, kap: 0 };
    if (s <= S2) {
      const f = (s - S1) / 0.05, i = Math.min(loop.pts.length - 2, Math.floor(f)), t = f - i;
      const a = loop.pts[i], b = loop.pts[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, phi: a.phi + (b.phi - a.phi) * t, kap: a.kap + (b.kap - a.kap) * t };
    }
    return { x: xTop - (s - S2), y: loop.end.y, phi: Math.PI, kap: 0 };
  };
  const speedAt = (s) => {
    if (s <= S1) return V0;
    if (s <= S2) { const c = curve(s); return Math.sqrt(Math.max(1, V0 * V0 - 2 * G * c.y - 0.9 * (s - S1))); }
    if (s >= S_STOP) return 0;
    return vTop * Math.sqrt(Math.max(0, 1 - (s - S2) / LB));
  };

  // 2) 行驶段：s(t) 表（dt = 1/480），同时积分车身俯仰（刹车点头 / 回弹）
  const DT = 1 / 480;
  const drive = [];   // {t, s, v, along, pitch}
  let s = 0, t = 0;
  for (let guard = 0; guard < 480 * 40; guard++) {
    const v = speedAt(s);
    drive.push({ t, s, v, along: 0, pitch: 0 });
    if (s >= S_STOP - 1e-6) break;
    const vm = Math.max(speedAt(s + v * DT * 0.5), 0.05);
    s = Math.min(S_STOP, s + vm * DT); t += DT;
  }
  // 纵向加速度（事后求导）与俯仰二阶系统（自然频率 ~1.7 Hz，阻尼 0.35）
  let pitch = 0, pw = 0;
  const WN = 10.5, ZT = 0.35, PK = 0.0042;
  const stepPitch = (along) => { const pa = -WN * WN * pitch - 2 * ZT * WN * pw - along * PK * WN * WN / G * 3; pw += pa * DT; pitch += pw * DT; };
  for (let i = 0; i < drive.length; i++) {
    const a0 = drive[Math.max(0, i - 1)], a1 = drive[Math.min(drive.length - 1, i + 1)];
    drive[i].along = (a1.v - a0.v) / Math.max(DT, a1.t - a0.t);
    stepPitch(drive[i].along); drive[i].pitch = pitch;
  }
  const T_ENTRY = drive.find((d) => d.s >= S1).t;
  const T_TOP = drive.find((d) => d.s >= S2).t;
  const T_STOP = drive[drive.length - 1].t;
  // 停稳后继续积分俯仰余振直到释放
  const T_REL = T_STOP + HOLD;
  { let tt = T_STOP; while (tt < T_REL + DT) { tt += DT; stepPitch(0); drive.push({ t: tt, s: S_STOP, v: 0, along: 0, pitch }); } }

  // 3) 脱离后的刚体模拟：竖直 + 横滚，冷气反推与 RCS 脉冲
  //    横滚 RCS：两次正向脉冲加速、两次反向脉冲刹住；脉冲角加速度按“恰好转 180°”求解
  const PULSES = [[0.10, 0.12, +1], [0.30, 0.10, +1], [0.98, 0.12, -1], [1.18, 0.10, -1]];
  const rollProfile = (alpha) => {
    let ph = 0, om = 0;
    for (let tt = 0; tt < 1.6; tt += DT) { let a = 0; for (const [p0, d, sg] of PULSES) if (tt >= p0 && tt < p0 + d) a += sg * alpha; om += a * DT; ph += om * DT; }
    return ph;
  };
  const ALPHA = Math.PI / rollProfile(1);
  const fall = [];
  const top = curve(S_STOP);
  let yc = top.y - COM_H, vy = -0.35, roll = 0, om = 0, susp = 0.07, sv = 0, touched = -1, T_TD = 0;
  const yaw = { a: 0, w: 0 };
  for (let tt = 0; tt < 9; tt += DT) {
    let rcs = [0, 0, 0, 0];
    let a = 0; for (let i = 0; i < PULSES.length; i++) { const [p0, d, sg] = PULSES[i]; if (tt >= p0 && tt < p0 + d) { a += sg * ALPHA; if (sg > 0) { rcs[0] = 1; rcs[3] = 1; } else { rcs[1] = 1; rcs[2] = 1; } } }
    om += a * DT; roll += om * DT;
    if (tt > 1.3) { roll = Math.PI; om = 0; }   // 残差归零（数值上已非常接近）
    const upY = -Math.cos(roll);                 // 车顶方向的竖直分量（-1 倒置，+1 正立）
    // 车底离地高度（正立后）：接触面高度 = 质心 - COM_H
    // 反推油门：倒置时怠速喷雾（不助推太多），转正后按软着陆导引
    const hEst = Math.max(0, yc - COM_H);
    // 导引：高处按恒减速度 1.7 m/s² 的抛物线，最后一米改为线性渐近（0.7 m/s 触地）
    const hh = Math.max(0, hEst - 0.07);
    const vDes = -Math.min(0.7 + Math.sqrt(2 * 1.7 * hh), 0.7 + 1.8 * hh);
    const ff = hh < 1.05 ? Math.min(1.7, Math.max(0, -1.8 * vy)) : 1.7;
    let thr;
    if (touched >= 0) thr = Math.max(0, 1 - (tt - touched) / 0.35) * 0.5;
    else if (upY < 0.35) thr = 0.14;
    else {
      const want = (G + ff + 8 * (vDes - vy)) / Math.max(0.35, upY) / G;
      thr = clamp(want, 0.12, 2.1) * smooth(0.35, 0.8, upY);
    }
    // 地面缓冲：贴近地面时油门抬高、喷出白雾
    const cushion = touched < 0 && hEst < 2.6 ? smooth(2.6, 0.4, hEst) : 0;
    const thrust = thr * G * upY;   // 推力竖直分量（加速度）
    let ay = -G + thrust;
    // 悬挂：触地前车轮下垂 7 cm；触地后弹簧阻尼（自然频率 ~1.6 Hz，阻尼比 0.33）
    const contactH = yc - COM_H;   // 正立时：车身原点（静态接触面）高度
    let touchingNow = false;
    if (upY > 0.9 && contactH <= 0.07) {
      touchingNow = true;
      if (touched < 0) { touched = tt; T_TD = tt; }
      const wn = 10.2, zt = 0.33;
      ay += -wn * wn * contactH - 2 * zt * wn * vy + G;   // 静平衡在 contactH = 0
    }
    vy += ay * DT; yc += vy * DT;
    // 偏航小晃动（冷气不对称）
    yaw.w += (-yaw.a * 30 - yaw.w * 4 + (tt < 1.4 ? Math.sin(tt * 17) * 0.06 : 0)) * DT; yaw.a += yaw.w * DT;
    fall.push({ t: tt, yc, vy, roll, om, thr, cushion, rcs, h: hEst, touching: touchingNow, yaw: yaw.a, gl: (ay + G) / G });
  }
  const T_TOUCH = T_REL + T_TD;
  const T_END = T_TOUCH + 4.0;

  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _z = new THREE.Vector3();
  const lerpRec = (arr, tt, dt0) => { const f = clamp(tt / dt0, 0, arr.length - 1.001), i = Math.floor(f), k = f - i; return [arr[i], arr[i + 1] ?? arr[i], k]; };
  const driveAt = (tt) => {
    if (tt <= 0) return drive[0];
    const f = clamp(tt / DT, 0, drive.length - 1.001), i = Math.floor(f), k = f - i, a = drive[i], b = drive[i + 1] ?? a;
    return { t: tt, s: a.s + (b.s - a.s) * k, v: a.v + (b.v - a.v) * k, along: a.along + (b.along - a.along) * k, pitch: a.pitch + (b.pitch - a.pitch) * k };
  };

  /** 任意时刻的状态 */
  function state(tt) {
    const out = { t: tt, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), com: new THREE.Vector3(), speed: 0, vy: 0, alt: 0, gLoad: 1, roll: 180, throttle: 0, cushion: 0, rcs: [0, 0, 0, 0], brake: 0, pitch: 0, susp: 0, phase: 'APPROACH', fan: 0, s: 0, spin: 0, inAir: false, holdT: 0 };
    if (tt < T_REL) {
      const d = driveAt(tt), c = curve(d.s);
      out.s = d.s; out.speed = d.v; out.pitch = d.pitch;
      _f.set(Math.cos(c.phi), Math.sin(c.phi), 0); _u.set(-Math.sin(c.phi), Math.cos(c.phi), 0);
      _z.crossVectors(_f, _u); _m.makeBasis(_f, _u, _z); out.quat.setFromRotationMatrix(_m);
      // 俯仰（绕车身横轴）
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), d.pitch); out.quat.multiply(_q);
      out.pos.set(c.x, c.y, 0);
      out.com.copy(out.pos).addScaledVector(_u, COM_H);
      out.alt = c.y; out.vy = d.v * Math.sin(c.phi);
      // 法向过载：v²κ + g 在车身法向的分量
      out.gLoad = (d.v * d.v * c.kap + G * Math.cos(c.phi)) / G;
      out.roll = c.phi > Math.PI / 2 ? 180 : 0;
      out.brake = d.s > S2 && d.v > 0 ? 1 : 0;
      out.fan = d.s < S1 - 25 ? 0 : d.s < S1 ? smooth(S1 - 25, S1, d.s) * 0.55 : d.s < S2 ? 0.55 + 0.45 * smooth(S1, S2, d.s) : 1;
      out.spinRate = d.v / RW;
      out.phase = d.s < S1 ? 'APPROACH' : d.s < S2 ? 'C-RAMP CLIMB' : d.v > 0.01 ? 'INVERTED · FAN LOCK · BRAKING' : 'INVERTED HOLD';
      if (out.phase === 'INVERTED HOLD') out.holdT = tt - T_STOP;
      return out;
    }
    const ft = tt - T_REL;
    const [a, b, k] = lerpRec(fall, ft, DT);
    const L = (key) => a[key] + (b[key] - a[key]) * k;
    const roll = L('roll'), yc = L('yc');
    out.vy = L('vy'); out.throttle = L('thr'); out.cushion = L('cushion'); out.rcs = a.rcs; out.inAir = !a.touching && ft < T_TD + 0.01;
    // 姿态：初始倒置（前进方向 -x），绕前进轴横滚
    _f.set(-1, 0, 0); _u.set(0, -Math.cos(roll), -Math.sin(roll)); _z.crossVectors(_f, _u);
    _m.makeBasis(_f, _u, _z); out.quat.setFromRotationMatrix(_m);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), L('yaw')); out.quat.premultiply(_q);
    out.com.set(top.x, yc, 0);
    out.pos.copy(out.com).addScaledVector(_u.applyQuaternion(_q), -COM_H);
    out.alt = Math.max(0, yc - COM_H); out.speed = Math.abs(out.vy);
    out.roll = 180 - roll * 180 / Math.PI;
    const touching = a.touching;
    out.susp = touching ? Math.max(-0.12, Math.min(0.07, yc - COM_H)) : 0.07 * smooth(0, 0.3, ft);
    out.gLoad = L('gl');
    out.fan = Math.max(0, 1 - ft / 0.25);
    out.spinRate = 0;
    out.phase = ft < 1.35 ? 'RELEASE · RCS ROLL' : ft < T_TD ? 'COLD-GAS DESCENT' : 'TOUCHDOWN';
    return out;
  }

  return {
    state, curve, speedAt, kLoop, Lc, L2, LB, xTop, vTop,
    S1, S2, S_STOP, S_END, T_ENTRY, T_TOP, T_STOP, T_REL, T_TOUCH, T_END, ALPHA, PULSES,
    touchV: (() => { const r = fall.find((f) => f.touching); return r ? Math.abs(r.vy) : 0; })(),
    fall, drive, DT,
  };
}
