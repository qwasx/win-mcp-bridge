// 夜间直播：Starbase 测试场 · 白色 Roadster 冲上 C 形巨型坡道 → 180° 倒置吸附悬停 1 s → 脱离，
// 车底冷气反推减速 + RCS 冷气脉冲 180° 翻正 → 落地前白雾气垫 → 四轮软着陆，悬挂压缩回弹。
// Three.js 负责三维与后期，SVG 负责镜头光斑与直播 HUD。
import * as THREE from 'three';
import { buildTimeline } from './timeline.js';
import { buildCar, poseCar } from './car.js';
import { buildTrack } from './track.js';
import { buildEnv, buildReflectionScene } from './env.js';
import { ColdGas, makeJetCone } from './particles.js';
import { buildPost } from './post.js';
import { Overlay } from './overlay.js';

const params = new URLSearchParams(location.search);
const T = buildTimeline();
const T_CYCLE = T.T_END + 0.8;

// ---------------------------------------------------------------- 舞台（16:9 直播画幅）
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const quality = params.get('q') === 'high' ? 2 : params.get('q') === 'low' ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(quality);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(8, 16 / 9, 0.5, 5000);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(buildReflectionScene(), 0.02).texture;

const landX = T.state(T.T_END).pos.x;
const env = buildEnv(scene, T, { landX });
const track = buildTrack(T); scene.add(track.group);
const car = buildCar(); scene.add(car);
const post = buildPost(renderer, scene, camera);

// 粒子光照用的灯光列表
const gasLights = env.spots.filter((s) => s.intensity < 100000).map((s) => {
  const d = new THREE.Vector3().subVectors(s.target.position, s.position).normalize();
  return { px: s.position.x, py: s.position.y, pz: s.position.z, dx: d.x, dy: d.y, dz: d.z, cos0: Math.cos(s.angle), cos1: Math.cos(s.angle * 0.45), k: s.intensity / 9000 * 1.1 };
});
const topSt = T.state(T.T_STOP);
const gas = new ColdGas(scene, gasLights, 22000, { y: topSt.pos.y - 0.36, hw: 2.25, x0: T.xTop - T.L2 - 0.5, x1: T.xTop + 1.5 });

// 喷流锥：车底 4 + RCS 8（前后各 4）
const body = car.userData.body;
const retroCones = car.userData.thrusters.map((p) => { const c = makeJetCone(); c.position.copy(p); body.add(c); return c; });
const rcsCones = [];
car.userData.rcs.forEach((r, i) => {
  for (const p of [r.p, r.p2]) {
    const c = makeJetCone(); c.position.copy(p);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), r.d); c.scale.set(0.35, 1, 0.35);
    body.add(c); rcsCones.push({ c, i });
  }
});

const overlay = new Overlay(stage, T, env.flares, track.occluders);

// ---------------------------------------------------------------- 摄像机（手持长焦）
const CAM_BASE = new THREE.Vector3(-62, 3.2, 68);   // 升降平台上的长焦机位
const keys = [
  [0, 7.2], [T.T_ENTRY - 0.9, 8.5], [T.T_ENTRY + 0.3, 22], [T.T_TOP + 0.35, 19], [T.T_STOP - 0.25, 10.5], [T.T_REL - 0.05, 7.4],
  [T.T_REL + 0.55, 12.5], [T.T_REL + 1.6, 15], [T.T_TOUCH - 0.7, 11.5], [T.T_TOUCH + 0.9, 8.2], [T.T_END + 1, 6.6],
];
function fovKey(t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, f0] = keys[i], [t1, f1] = keys[i + 1];
    if (t <= t1) { const u = (t - t0) / (t1 - t0); const s = u * u * (3 - 2 * u); return f0 + (f1 - f0) * s; }
  }
  return keys[keys.length - 1][1];
}
const rig = { look: new THREE.Vector3(), lookV: new THREE.Vector3(), fov: 7, fovV: 0, init: false };
function stepCamera(t, dt, st) {
  const want = st.com.clone();
  // 速度前馈（操作员能跟上车，只留一点点滞后）；下降时取景略偏下，给落点留空间
  const nxt = T.state(t + 0.02).com; const wantV = nxt.sub(st.com).divideScalar(0.02).multiplyScalar(0.93);
  if (t >= T.T_REL && t < T.T_TOUCH + 1) want.y -= 1.0 * Math.min(1, (t - T.T_REL) / 1.2);
  if (!rig.init) { rig.look.copy(want); rig.lookV.copy(wantV); rig.fov = fovKey(t); rig.fovV = 0; rig.init = true; }
  if (dt <= 0) return;
  const w = 4.5, z = 0.9;
  const a = want.clone().sub(rig.look).multiplyScalar(w * w).addScaledVector(wantV.clone().sub(rig.lookV), 2 * z * w);
  rig.lookV.addScaledVector(a, dt); rig.look.addScaledVector(rig.lookV, dt);
  const fw = 4.2, fa = (fovKey(t) - rig.fov) * fw * fw - 2 * 0.95 * fw * rig.fovV;
  rig.fovV += fa * dt; rig.fov += rig.fovV * dt;
}
function applyCamera(t) {
  if (window.__camOverride) { const o = window.__camOverride; camera.position.set(...o.pos); camera.fov = o.fov; camera.updateProjectionMatrix(); camera.lookAt(...o.look); return; }
  // 操作员身体的缓慢晃动
  const sway = new THREE.Vector3(Math.sin(t * 0.43) * 0.05 + Math.sin(t * 1.13) * 0.02, Math.sin(t * 0.61 + 1) * 0.03, Math.sin(t * 0.37 + 2) * 0.04);
  camera.position.copy(CAM_BASE).add(sway);
  camera.fov = rig.fov; camera.updateProjectionMatrix();
  camera.lookAt(rig.look);
  const d2r = Math.PI / 180;
  const low = (f) => Math.sin(t * f) + 0.6 * Math.sin(t * f * 2.31 + 1.7) + 0.35 * Math.sin(t * f * 4.07 + 0.3);
  const yaw = (0.05 * low(0.83) + 0.007 * Math.sin(t * 47.0) * Math.sin(t * 3.1)) * d2r;
  const pitch = (0.04 * low(1.07) + 0.006 * Math.sin(t * 53.0 + 1) * Math.sin(t * 2.7)) * d2r;
  const roll = 0.18 * low(0.31) * d2r;
  camera.rotateY(yaw); camera.rotateX(pitch); camera.rotateZ(roll);
}

// ---------------------------------------------------------------- 冷气喷射
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _prev = new THREE.Vector3();
let prevCom = null;
function emit(t, dt, st) {
  car.updateMatrixWorld(true);
  const carVel = prevCom ? _v.subVectors(st.com, prevCom).divideScalar(Math.max(dt, 1e-4)) : _v.set(0, 0, 0);
  prevCom = (prevCom || new THREE.Vector3()).copy(st.com);
  const q = car.quaternion;
  // 脱离瞬间：车底吸附解除，冷气猛喷一下把车"推离"轨面
  if (t >= T.T_REL && t - dt < T.T_REL) {
    for (const p of car.userData.thrusters) {
      _p.copy(p); body.localToWorld(_p); _d.set(0, -1, 0).applyQuaternion(q);
      for (let i = 0; i < 60; i++) gas.spawn(_p.x, _p.y, _p.z, _d.x * 5 + (gas.R() - 0.5) * 12, _d.y * 5 + (gas.R() - 0.5) * 2, _d.z * 5 + (gas.R() - 0.5) * 7, 0.9 + gas.R() * 0.6, 0.3, 1.6, 0.07, 3.0, 0);
    }
  }
  const thr = st.throttle;
  if (t >= T.T_REL && thr > 0.01) {
    car.userData.thrusters.forEach((p, i) => {
      _p.copy(p); body.localToWorld(_p); _d.set(0, -1, 0).applyQuaternion(q);
      const rate = 280 + 420 * Math.min(1, thr / 1.3) + st.cushion * 300;
      gas.emitJet('r' + i, rate, dt, _p, _d, carVel, 26 + 26 * Math.min(1, thr / 1.3), 0.06 + st.cushion * 0.1, 0.75, 0.16, 1.25, 0.13);
    });
    // 气垫：贴地环形白雾
    if (st.cushion > 0.02) {
      const R = gas.R; let n = (gas.acc.get('cush') || 0) + st.cushion * 420 * dt; const cx = st.com.x, cz = st.com.z;
      for (; n >= 1; n--) {
        const a = R() * Math.PI * 2, r = 0.4 + R() * 1.5, sp = 4 + R() * 7;
        gas.spawn(cx + Math.cos(a) * r, 0.14, cz + Math.sin(a) * r * 0.7, Math.cos(a) * sp, 0.25 + R() * 0.6, Math.sin(a) * sp, 1.8 + R() * 1.6, 0.7, 2.8, 0.06, 1.2, 2);
      }
      gas.acc.set('cush', n);
    }
  }
  // RCS 冷气脉冲（前后成对）
  car.userData.rcs.forEach((r, i) => {
    if (!st.rcs[i]) return;
    for (const p of [r.p, r.p2]) {
      _p.copy(p); body.localToWorld(_p); _d.copy(r.d).applyQuaternion(q);
      gas.emitJet('c' + i + (p === r.p ? 'a' : 'b'), 2400, dt, _p, _d, carVel, 30, 0.05, 0.5, 0.06, 0.75, 0.17);
    }
  });
  // 落地瞬间：残余气垫被车身压出的一圈薄雾
  if (t >= T.T_TOUCH && t - dt < T.T_TOUCH) {
    for (let i = 0; i < 200; i++) { const a = gas.R() * Math.PI * 2, sp = 3 + gas.R() * 5; gas.spawn(st.com.x + Math.cos(a) * 1.4, 0.14, Math.sin(a) * 1.0, Math.cos(a) * sp, 0.2, Math.sin(a) * sp, 2.0 + gas.R() * 1.5, 0.5, 2.2, 0.045, 1.5, 2); }
  }
}

function poseCones(t, st) {
  const thr = t >= T.T_REL ? st.throttle : 0;
  for (const c of retroCones) {
    const L = 0.6 + Math.min(1.6, thr) * 1.9;
    c.scale.set(1 + st.cushion * 0.5, L, 1 + st.cushion * 0.5);
    c.material.uniforms.strength.value = Math.min(1, thr * 0.9) * 0.55; c.material.uniforms.time.value = t;
    c.visible = thr > 0.02;
  }
  for (const { c, i } of rcsCones) { const on = st.rcs[i]; c.visible = !!on; c.scale.y = 1.3; c.material.uniforms.strength.value = on ? 0.75 : 0; c.material.uniforms.time.value = t; }
}

// ---------------------------------------------------------------- 主循环 / 寻址
let t = 0, playing = true, rate = 1, replay = false, showHud = params.get('hud') !== '0';
let lastSt = T.state(0);
const SUB = 1 / 120;
function simStep(dt) {
  const st = T.state(t);
  emit(t, dt, st);
  gas.step(dt);
  stepCamera(t, dt, st);
  lastSt = st;
}
function seek(target) {
  gas.reset(); rig.init = false; prevCom = null; overlay.resetTrail();
  t = 0; const h = 1 / 60;
  while (t < target - 1e-9) { const d = Math.min(h, target - t); simStep(d); t += d; }
  lastSt = T.state(t);
  if (!rig.init) stepCamera(t, 0, lastSt);
}
function renderFrame(dtReal) {
  const st = T.state(t);
  car.position.copy(st.pos); car.quaternion.copy(st.quat);
  poseCar(car, st, dtReal * rate);
  poseCones(t, st);
  track.update(t);
  applyCamera(t);
  env.update(t, camera);
  gas.upload();
  gas.mat.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  post.render(t);
  overlay.update(dtReal, t, st, camera, car, { replay, rate, showHud });
  ui.sync();
}

// ---------------------------------------------------------------- 布局与控制
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight; let w = vw, h = vw * 9 / 16; if (h > vh) { h = vh; w = vh * 16 / 9; }
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  renderer.setSize(w, h); post.setSize(w, h); camera.aspect = 16 / 9; camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout); layout();

const ui = (() => {
  const bar = document.getElementById('bar'), btn = document.getElementById('play'), scrub = document.getElementById('scrub'), spd = document.getElementById('speed'), hudB = document.getElementById('hudbtn'), tc = document.getElementById('tc');
  if (params.get('ui') === '0') bar.style.display = 'none';
  scrub.max = T_CYCLE.toFixed(2);
  let dragging = false, idle = 0;
  scrub.addEventListener('input', () => { dragging = true; seek(parseFloat(scrub.value)); renderFrame(0); });
  scrub.addEventListener('change', () => { dragging = false; });
  btn.addEventListener('click', () => { playing = !playing; });
  spd.addEventListener('click', () => { rate = rate === 1 ? 0.5 : rate === 0.5 ? 0.25 : 1; replay = rate !== 1; });
  hudB.addEventListener('click', () => { showHud = !showHud; });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { playing = !playing; e.preventDefault(); }
    if (e.code === 'KeyR') { seek(0); }
    if (e.code === 'KeyS') spd.click();
    if (e.code === 'KeyH') hudB.click();
  });
  window.addEventListener('mousemove', () => { idle = 0; bar.classList.remove('hide'); });
  return {
    sync() {
      if (!dragging) scrub.value = t.toFixed(2);
      btn.textContent = playing ? '❚❚' : '▶'; spd.textContent = rate + '×'; hudB.style.opacity = showHud ? 1 : 0.45;
      tc.textContent = t.toFixed(2) + ' s';
    },
    tick(dt) { idle += dt; if (idle > 2.5) bar.classList.add('hide'); },
  };
})();

let last = performance.now(), acc = 0;
function loop(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  ui.tick(dtReal);
  if (playing) {
    acc += dtReal * rate;
    while (acc >= SUB) { simStep(SUB); t += SUB; acc -= SUB; }
    if (t >= T_CYCLE) {
      // 直播 → 0.5× 慢动作回放（从入坡前开始）→ 直播 …
      replay = !replay; rate = replay ? 0.5 : 1;
      seek(replay ? Math.max(0, T.T_ENTRY - 1.2) : 0);
    }
  }
  renderFrame(dtReal);
  requestAnimationFrame(loop);
}

// 截图 / 调试接口
window.__T = T;
window.__dbg = { scene, renderer, camera, post, env, car, track, gas, THREE };
window.__seek = (x, opts = {}) => { if (opts.replay != null) { replay = opts.replay; rate = replay ? 0.5 : 1; } seek(x); renderFrame(1 / 60); return lastSt.phase; };
window.__pause = () => { playing = false; };

const t0 = parseFloat(params.get('t') || '0');
if (t0 > 0) seek(t0);
if (params.get('paused') === '1') playing = false;
document.getElementById('loading')?.remove();
window.__ready = true;
requestAnimationFrame(loop);
