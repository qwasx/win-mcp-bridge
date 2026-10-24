// headless-smoke.mjs — 无 GPU/DOM 冒烟测试：真实 three 场景 + 车辆 + 粒子 + 导演逻辑
// 完整跑通时间线，捕获运行时异常（world/hud/flare 以 mock 替代，纹理依赖浏览器 canvas）
import * as THREE from 'three';
import { buildCar } from '../js/car.js';
import { Particles } from '../js/particles.js';
import { Director } from '../js/director.js';

const assert = (c, m) => { if (!c) { console.error('✗ ' + m); process.exitCode = 1; } else console.log('✓ ' + m); };

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 16 / 9, .1, 2000);
camera.position.set(58, 6, 52);
camera.aspect = 16 / 9; camera.updateProjectionMatrix();

const car = buildCar();
scene.add(car.group);

const particles = new Particles(scene, 2400);

const mockHud = new Proxy({}, {
  get: (t, k) => {
    if (k === 'caption' || k === 'cut') return () => {};
    return (typeof t[k] !== 'undefined') ? t[k] : () => {};
  },
  set: () => true,
});
const mockWorld = {
  towers: [{ headPos: new THREE.Vector3(36, 18, 28) }, { headPos: new THREE.Vector3(-34, 18, 30) }, { headPos: new THREE.Vector3(10, 15, -38) }],
  flicker: () => {}, setMaglock: () => {}, setStrobe: () => {},
};
const mockFlares = { update: () => {} };

const director = new Director({ scene, camera, world: mockWorld, car, particles, hud: mockHud, flares: mockFlares });

let maxCarY = 0, sawInverted = false, sawLanded = false, err = null;
try {
  for (let i = 0; i < 60 * 20; i++) {
    director.update(1 / 60, camera, false);
    if (director.loopPending) { director.loopPending = false; director.reset(); }
    const p = car.group.position;
    maxCarY = Math.max(maxCarY, p.y);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.group.quaternion);
    if (up.y < -0.95) sawInverted = true;
    if (director.tl.st.mode === 'landed') sawLanded = true;
    if (!Number.isFinite(p.x + p.y + p.z)) throw new Error(`位置 NaN @${i}`);
  }
} catch (e) { err = e; }

assert(!err, `20s 导演循环无异常${err ? ' — ' + err.message + '\n' + err.stack?.split('\n')[1] : ''}`);
assert(maxCarY > 30, `车辆抵达顶点（最高 ${maxCarY.toFixed(2)}m）`);
assert(sawInverted, '车辆出现完全倒挂姿态');
assert(sawLanded, '到达着陆状态');

// 粒子缓冲有效性
let bad = 0;
for (let i = 0; i < particles.max; i++) {
  const j = i * 3;
  if (!Number.isFinite(particles.aPos[j] + particles.aPos[j + 1] + particles.aPos[j + 2])) bad++;
}
assert(bad === 0, `粒子缓冲无 NaN（异常 ${bad}）`);

// 场景规模
let meshes = 0, lights = 0;
scene.traverse(o => { if (o.isMesh) meshes++; if (o.isLight) lights++; });
console.log(`  场景: ${meshes} meshes, ${lights} lights`);
assert(meshes > 30, '场景网格齐全');
assert(lights >= 2, '车辆灯光齐全（世界灯塔灯光在 mock 中省略）');

console.log(process.exitCode ? '\n冒烟测试失败' : '\n冒烟测试通过 ✔');
