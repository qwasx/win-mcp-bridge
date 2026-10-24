// main.js — 渲染循环 / 自适应 / 交互控制
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCarFull } from './car.js';
import { buildWorld } from './world.js';
import { Particles } from './particles.js';
import { Hud, Flares } from './overlay.js';
import { Director } from './director.js';
import { grainDataURL } from './util.js';

const app = document.getElementById('app');
const canvas = document.getElementById('gl');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  app.insertAdjacentHTML('beforeend',
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cfe;font-family:sans-serif">当前环境不支持 WebGL，无法播放动画。</div>`);
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 1, .1, 2000);
camera.position.set(58, 6, 52);

const world = buildWorld(scene, renderer);
const car = buildCar();
scene.add(car.group);

// 车身阴影
car.group.traverse(o => { if (o.isMesh) o.castShadow = true; });

const particles = new Particles(scene, 2400);
const hud = new Hud(app);
const flares = new Flares(app);
flares.v = () => new THREE.Vector3();

// —— 眩光源：三座灯塔头部 + 磁环 + 车腹喷流 + 频闪灯 ——
flares.add({ getPos: () => world.towers[0].headPos, getI: () => .8, size: 1.15 });
flares.add({ getPos: () => world.towers[1].headPos, getI: () => .75, size: 1 });
flares.add({ getPos: () => world.towers[2].headPos, getI: () => .55, size: .9 });
flares.add({
  getPos: () => new THREE.Vector3(0, 32.35, 0),
  getI: () => director.magI * .8, size: .9,
});
flares.add({
  getPos: () => director.bellyWorld,
  getI: () => director.retroI * .85 + director.magI * .25, size: .8,
});
flares.add({
  getPos: () => new THREE.Vector3(8.6, 1.15, 8.6),
  getI: () => (director.strobeBurst > 0 ? .45 : 0), size: .35,
});

// 胶片颗粒
{
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;inset:-60px;z-index:15;pointer-events:none;opacity:.055;mix-blend-mode:overlay;background-image:url(${grainDataURL()});animation:grain .42s steps(3) infinite`;
  app.appendChild(d);
  const st = document.createElement('style');
  st.textContent = `@keyframes grain{0%{transform:translate(0,0)}33%{transform:translate(-18px,10px)}66%{transform:translate(12px,-16px)}100%{transform:translate(0,0)}}`;
  document.head.appendChild(st);
}

const director = new Director({ scene, camera, world, car, particles, hud, flares });

// —— 自由视角 ——
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.maxDistance = 260;
let freeCam = false;

// —— UI ——
const ui = document.getElementById('ui');
const mkBtn = (html, fn) => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.innerHTML = html;
  b.addEventListener('click', fn);
  ui.appendChild(b);
  return b;
};
let paused = false;
const btnCam = mkBtn('🎥 自由视角', () => setFree(!freeCam));
const btnPause = mkBtn('⏸ 暂停', () => setPause(!paused));
mkBtn('⏮ 重播', () => { director.reset(); setPause(false); });
const btnLoop = mkBtn('🔁 循环 开', () => { autoLoop = !autoLoop; btnLoop.textContent = `🔁 循环 ${autoLoop ? '开' : '关'}`; });
let autoLoop = true;

function setFree(v) {
  freeCam = v;
  controls.enabled = v;
  btnCam.textContent = v ? '🎬 自动镜头' : '🎥 自由视角';
  if (v) { controls.target.copy(car.group.position); controls.update(); }
}
function setPause(v) {
  paused = v;
  btnPause.textContent = v ? '▶ 继续' : '⏸ 暂停';
}
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); setPause(!paused); }
  if (e.key === 'r' || e.key === 'R') { director.reset(); setPause(false); }
  if (e.key === 'c' || e.key === 'C') setFree(!freeCam);
});

// —— 尺寸 ——
function resize() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  hud.layout(W, H);
}
addEventListener('resize', resize);
resize();

// —— 主循环 ——
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .06);
  const t = clock.elapsedTime;

  if (!paused) {
    director.update(dt, camera, freeCam);
    if (director.loopPending) {
      director.loopPending = false;
      if (autoLoop) director.reset();
      else { director.reset(); setPause(true); }
    }
  }
  if (freeCam) controls.update();

  world.flicker(t);
  particles.update(paused ? 0 : dt);
  particles.setScale(camera, innerHeight);

  renderer.render(scene, camera);

  if (director.hudState) hud.update(dt, t, camera, director.hudState);
  flares.update(camera, innerWidth, innerHeight, t);
}
frame();

// —— 测试/截图钩子：确定性推进模拟并手动渲染一帧 ——
window.__director = director;
window.__testStep = (n) => {
  window.__pauseReal = true;
  for (let i = 0; i < n; i++) {
    director.update(1 / 60, camera, false);
    if (director.loopPending) { director.loopPending = false; director.reset(); }
    renderer.render(scene, camera);
  }
  const t = performance.now() / 1000;
  if (director.hudState) hud.update(1 / 60, t, camera, director.hudState);
  flares.update(camera, innerWidth, innerHeight, t);
  return director.t;
};
