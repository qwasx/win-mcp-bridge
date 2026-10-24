// timeline.js — 纯逻辑时间线：不依赖 three / DOM，可在 node 中做数值验证。
// 阶段：fadein → road → ascent(加速+磁制动) → jiggle(吸附锁定晃动) → hang(倒挂1.5s)
//      → fall(自由落体→反推点火→冷气脉冲180°横滚→雾化缓冲) → landed(悬架回弹) → outro
export const CFG = {
  R: 16,                 // C 形坡道半径 (m)，顶点高 32m
  rideH: 0.64,           // 车身原点离地高（轮胎半径+底盘）
  roadX0: 52, roadV: 20, // 进场起点与速度
  vEnter: 20, vMax: 26, aAcc: 10.5, lockV: 3.0,
  jiggleDur: 0.55, hangDur: 1.15,
  // 下落阶段表 [时长, 反推加速度起/终]（g=9.8，向上为正）
  fall: [
    { name: 'free',   dur: 0.35, a0: 0,    a1: 0    },
    { name: 'ignite', dur: 0.60, a0: 0,    a1: 9.2  },
    { name: 'hold',   dur: 0.85, a0: 9.4,  a1: 9.4  },
    { name: 'roll',   dur: 1.60, a0: 9.4,  a1: 8.2  },
    { name: 'brake',  dur: 1.37, a0: 10.6, a1: 14.8 },
  ],
  pulses: [2.10, 2.45, 2.80, 3.15],      // 相对 fall 开始的脉冲时刻（4 道横滚脉冲）
  settleDur: 2.6, fadeAt: 1.6, fadeDur: 0.9,
  slowmoStart: 1.95, slowmoEnd: 3.45, slowmoScale: 0.78, // 横滚段轻微升格
};
CFG.S = Math.PI * CFG.R;                                        // 弧长
CFG.s1 = (CFG.vMax ** 2 - CFG.vEnter ** 2) / (2 * CFG.aAcc);    // 加速段弧长
CFG.kBrake = CFG.vMax ** 2 / (CFG.S - CFG.s1);                  // v²线性衰减（恒定磁制动）
CFG.ROLL0 = 1.80 + 0.20;                                        // 横滚窗口（fall 相对时间）
CFG.ROLL1 = 1.80 + 1.45;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export const CAPTIONS = {
  intro:   '夜间实拍 · 得州星港试验场 — 长焦跟踪',
  enter:   'Roadster-02 冲入 C 形轨道 · 全速爬升',
  lock:    '顶点 180° 倒置 — 车底吸附风扇锁定',
  release: '脱离轨道 · 车底反推冷气点火',
  roll:    '四道冷气脉冲 · 180° 横滚回正（无明火）',
  brake:   '着陆缓冲 · 高压雾化喷流展开',
  touch:   '四轮柔和接地 · 悬架压缩回弹',
  confirm: '着陆确认 · 任务完成 ✓',
};

export function createTimeline() {
  const C = CFG;
  const st = {
    t: 0, mode: 'fadein', modeT: 0,
    x: C.roadX0, s: 0, v: C.roadV,
    h: 2 * C.R - C.rideH, vy: 0, xLand: 0,
    fallT: 0, rollAng: Math.PI, jig: 0,
    wheelW: C.roadV / 0.34, throttle: 0, retroMode: null, aUp: 0,
    maglock: false, mist: false,
    pulseI: 0, impactV: 0,
    fade: 0,           // 黑场 0..1（片尾）
    confirmSent: false, fadeSent: false,
    done: false,
    events: [],
  };
  const emit = (type, data = {}) => st.events.push({ type, ...data });
  const setMode = (m) => { st.mode = m; st.modeT = 0; emit('mode', { m }); };

  function fallAccel(t) {
    let t0 = 0;
    for (const p of C.fall) {
      if (t <= t0 + p.dur) return lerp(p.a0, p.a1, clamp((t - t0) / p.dur, 0, 1));
      t0 += p.dur;
    }
    return C.fall[C.fall.length - 1].a1;
  }
  function fallPhaseName(t) {
    let t0 = 0;
    for (const p of C.fall) { if (t <= t0 + p.dur) return p.name; t0 += p.dur; }
    return 'brake';
  }

  function step(dtWall) {
    // —— 升格（慢动作）仅作用于模拟时间 ——
    let ts = 1;
    if (st.mode === 'fall') {
      const { slowmoStart: a, slowmoEnd: b, slowmoScale: k } = C;
      const w = Math.min(smooth((st.fallT - (a - .25)) / .25), 1 - smooth((st.fallT - b) / .25));
      ts = 1 - (1 - k) * clamp(w, 0, 1);
    }
    const dt = Math.min(dtWall, 1 / 20) * ts;
    st.t += dt; st.modeT += dt;
    const m = st.mode;

    if (m === 'fadein') {
      roadStep(dt);
      if (st.modeT >= 0.8) setMode('road');
    } else if (m === 'road') {
      roadStep(dt);
      if (st.x <= 0) {
        st.x = 0; st.s = 0; st.v = C.vEnter;
        emit('caption', { id: 'enter' }); setMode('ascent');
      }
    } else if (m === 'ascent') {
      if (st.s < C.s1 && st.v < C.vMax) st.v = Math.min(C.vMax, st.v + C.aAcc * dt);
      else {
        const v2 = C.kBrake * (C.S - st.s);
        st.v = v2 > 0 ? Math.sqrt(v2) : 0;
      }
      st.s = Math.min(C.S, st.s + st.v * dt);
      st.wheelW = st.v / 0.34;
      st.aUp = 0;
      if (st.v <= C.lockV || st.s >= C.S) {
        st.s = C.S; st.v = 0; st.wheelW = 0;
        st.maglock = true;
        emit('caption', { id: 'lock' });
        setMode('jiggle');
      }
    } else if (m === 'jiggle') {
      const τ = st.modeT;
      st.jig = 0.045 * Math.sin(τ * 2 * Math.PI * 4.2) * Math.exp(-5.2 * τ);
      if (τ >= C.jiggleDur) { st.jig = 0; setMode('hang'); }
    } else if (m === 'hang') {
      st.maglock = true;
      if (st.modeT >= C.hangDur) {
        st.maglock = false;
        st.fallT = 0; st.vy = 0; st.rollAng = Math.PI; st.pulseI = 0; st.throttle = 0;
        emit('caption', { id: 'release' });
        setMode('fall');
      }
    } else if (m === 'fall') {
      st.fallT += dt;
      const aUp = fallAccel(st.fallT);
      st.aUp = aUp;
      st.throttle = aUp <= 0.01 ? 0 : clamp(0.25 + aUp / 14.8, 0.25, 1);
      st.retroMode = st.fallT < C.ROLL1 ? 'shoulder' : 'belly';
      st.vy -= (9.8 - aUp) * dt;
      st.h += st.vy * dt;
      st.x = -0.35 * st.fallT;
      st.rollAng = st.fallT <= C.ROLL0 ? Math.PI
        : st.fallT >= C.ROLL1 ? 0
        : Math.PI * (1 - smooth((st.fallT - C.ROLL0) / (C.ROLL1 - C.ROLL0)));
      while (st.pulseI < C.pulses.length && st.fallT >= C.pulses[st.pulseI]) {
        emit('pulse', { side: st.pulseI % 2 ? 1 : -1 });
        st.pulseI++;
      }
      const name = fallPhaseName(st.fallT);
      if (name === 'roll' && !st.rollCaptionSent) { st.rollCaptionSent = true; emit('caption', { id: 'roll' }); }
      if (name === 'brake' && !st.brakeCaptionSent) { st.brakeCaptionSent = true; emit('caption', { id: 'brake' }); }
      st.mist = (st.h - C.rideH) < 10;
      st.wheelW *= Math.exp(-2.5 * dt);
      if (st.h <= C.rideH) {
        st.h = C.rideH; st.xLand = st.x;
        st.impactV = -st.vy; st.vy = 0;
        st.throttle = 0; st.retroMode = null; st.mist = false;
        emit('caption', { id: 'touch' });
        emit('contact', { v: st.impactV });
        setMode('landed');
      }
    } else if (m === 'landed') {
      if (!st.confirmSent && st.modeT >= 1.0) { st.confirmSent = true; emit('caption', { id: 'confirm' }); }
      if (!st.fadeSent && st.modeT >= C.fadeAt) { st.fadeSent = true; emit('fadeout'); }
      if (st.modeT >= C.settleDur) { st.done = true; emit('loop'); }
    }

    // 片尾黑场
    if (st.fadeSent) st.fade = clamp((st.modeT - C.fadeAt) / C.fadeDur, 0, 1);
    return st;
  }

  function roadStep(dt) {
    st.x -= C.roadV * dt;
    st.wheelW = C.roadV / 0.34;
    st.aUp = 0;
  }

  // —— 位姿（纯数据，director 转成 three 对象）——
  function pose() {
    const Cx = 0, Cy = CFG.R;
    if (st.mode === 'fadein' || st.mode === 'road') {
      return { p: [st.x, CFG.rideH, 0], f: [-1, 0, 0], u: [0, 1, 0] };
    }
    if (st.mode === 'ascent' || st.mode === 'jiggle' || st.mode === 'hang') {
      const φ = -Math.PI / 2 - st.s / CFG.R;
      const c = Math.cos(φ), s = Math.sin(φ);
      return {
        p: [c * (CFG.R - CFG.rideH), Cy + s * (CFG.R - CFG.rideH), 0],
        f: [s, -c, 0], u: [-c, -s, 0],
      };
    }
    if (st.mode === 'fall') {
      const r = st.rollAng;
      return {
        p: [st.x, st.h, 0], f: [1, 0, 0],
        u: [0, Math.cos(r), Math.sin(r)],
      };
    }
    // landed / outro
    return { p: [st.xLand, CFG.rideH, 0], f: [1, 0, 0], u: [0, 1, 0] };
  }

  function speed() {
    if (st.mode === 'fadein' || st.mode === 'road') return CFG.roadV;
    if (st.mode === 'ascent' || st.mode === 'jiggle') return st.v;
    if (st.mode === 'fall') return Math.abs(st.vy);
    return 0;
  }
  function attitudeDeg() {
    if (st.mode === 'ascent' || st.mode === 'jiggle') return (st.s / CFG.S) * 180;
    if (st.mode === 'hang') return 180;
    if (st.mode === 'fall') return (st.rollAng * 180) / Math.PI;
    if (st.mode === 'fadein' || st.mode === 'road') return 0;
    return 0;
  }
  function gLoad() {
    if (st.mode === 'ascent' || st.mode === 'jiggle') return 1 + (st.v * st.v) / (CFG.R * 9.8);
    if (st.mode === 'fall') return Math.max(0.05, st.aUp / 9.8);
    return 1;
  }
  return { st, step, pose, speed, attitudeDeg, gLoad, CFG };
}
