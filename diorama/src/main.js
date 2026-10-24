import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-jp/900.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { gU, syncLightSources, spawnRipple, RAMP3, RAMP4 } from './materials.js';
import { buildGround } from './ground.js';
import { buildStore } from './store.js';
import { buildProps } from './props.js';
import { buildRain, buildDrips, buildGlassRain } from './rain.js';
import { makeRenderTargets, buildComposer } from './postfx.js';
import { LAYER_FX } from './helpers.js';
import { ensureFonts } from './textures.js';

/* ================================================================== *
 *  雨の夜のコンビニ角 — ミニチュア・ジオラマ
 * ================================================================== */

// テクスチャ描画に Webフォントが必要 → 先に読み込む
await ensureFonts();

const app = document.getElementById('app');

/* デバッグ用 URL パラメータ ?cam=front|top|close|alley&flat=1&freeze=1 */
const qp = new URLSearchParams(location.search);
const DEBUG_FLAT = qp.has('flat');
const DEBUG_FREEZE = qp.has('freeze') || qp.has('cam');
const DEBUG_CAM = qp.get('cam') || '';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
window.__maxAniso = renderer.capabilities.getMaxAnisotropy();
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070d, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1020, 0.0125);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.2, 220);
camera.position.set(13.5, 10.0, 18.0);
camera.layers.enable(LAYER_FX);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.1, -1.2);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.5;
controls.screenSpacePanning = false;
controls.minDistance = 7;
controls.maxDistance = 46;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.475;
controls.autoRotate = !DEBUG_FREEZE;
controls.autoRotateSpeed = 0.26;
controls.update();

if (DEBUG_CAM === 'top') {
  camera.position.set(0.01, 32, 0.01);
  controls.target.set(0, 0, 0);
} else if (DEBUG_CAM === 'front') {
  camera.position.set(0, 5.5, 16);
  controls.target.set(0, 1.5, -1);
} else if (DEBUG_CAM === 'close') {
  camera.position.set(2.4, 2.6, 7.2);
  controls.target.set(-1.2, 1.35, -1);
} else if (DEBUG_CAM === 'alley') {
  camera.position.set(-13, 6.5, 7);
  controls.target.set(-3, 1.2, -2);
} else if (DEBUG_CAM === 'store') {
  camera.position.set(-3, 2.2, 8);
  controls.target.set(-1.2, 1.5, -1.2);
} else if (DEBUG_CAM === 'interior') {
  camera.position.set(-1.6, 1.9, 2.6);
  controls.target.set(-0.6, 1.25, -3.2);
} else if (DEBUG_CAM === 'parking') {
  camera.position.set(13, 7, 6);
  controls.target.set(3, 0.8, -1.5);
}
controls.update();

/* ------------------------------- 背景 ------------------------------- */
{
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x05070f) },
      uHorizon: { value: new THREE.Color(0x1b2740) },
      uBottom: { value: new THREE.Color(0x03050a) },
      uGlow: { value: new THREE.Color(0x2a3550) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main() {
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uGlow;
      varying vec3 vP;
      void main() {
        float h = normalize( vP ).y;
        vec3 c = mix( uHorizon, uTop, smoothstep( -0.02, 0.55, h ) );
        c = mix( uBottom, c, smoothstep( -0.35, 0.0, h ) );
        c += uGlow * pow( max( 0.0, 1.0 - abs( h ) * 2.2 ), 5.0 ) * 0.6;
        gl_FragColor = vec4( c, 1.0 );
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 20), skyMat);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);
}

/* ------------------------------- 照明 ------------------------------- */
const ambient = new THREE.AmbientLight(0x41527d, 0.62);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0x9db6e6, 0.95);
moon.position.set(-11, 15, 8);
moon.target.position.set(0, 0, -1);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -13;
moon.shadow.camera.right = 13;
moon.shadow.camera.top = 13;
moon.shadow.camera.bottom = -13;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 48;
moon.shadow.bias = -0.0007;
moon.shadow.normalBias = 0.035;
moon.shadow.radius = 2.2;
scene.add(moon, moon.target);

const fillLight = new THREE.DirectionalLight(0x3d5480, 0.35);
fillLight.position.set(9, 6, -12);
scene.add(fillLight);

/* ------------------------- シーンの構築 ------------------------- */
const api = { ramp3: RAMP3, ramp4: RAMP4 };
buildGround(scene, api);
const store = buildStore(scene);
const props = buildProps(scene);

/* 店内の明かり */
const interiorLights = [
  [-2.6, 2.3, -2.2, 3.4],
  [-0.4, 2.3, -4.2, 2.9],
  [2.2, 2.2, -3.4, 2.5],
  [1.4, 2.3, -1.5, 2.3],
  [-3.2, 2.2, -3.4, 2.4],
];
interiorLights.forEach(([x, y, z, i]) => {
  const l = new THREE.PointLight(0xffe3b4, i, 9.5, 1.55);
  l.position.set(x, y, z);
  scene.add(l);
});

/* 自販機の明かり */
const vmLight = new THREE.PointLight(0xa8d8ff, 2.6, 5.5, 1.8);
vmLight.position.set(3.5, 1.35, 1.15);
scene.add(vmLight);

/* 看板の明かり */
const signLight = new THREE.PointLight(0xfff0cc, 2.4, 8, 1.7);
signLight.position.set(0, 2.7, 0.3);
scene.add(signLight);

/* 街路灯 */
const lampLights = [];
props.lampPositions.forEach((p, idx) => {
  const sp = new THREE.SpotLight(0xffd9a0, idx === 0 ? 38 : 28, 16, 0.85, 0.72, 1.4);
  sp.position.copy(p);
  sp.target.position.set(p.x, 0, p.z + (idx === 1 ? 0.6 : 0.4));
  scene.add(sp, sp.target);
  lampLights.push(sp);
});

/* 信号機 */
const tlLight = new THREE.PointLight(0x39d96a, 3.0, 10, 1.6);
tlLight.position.copy(props.trafficLight.pos).add(new THREE.Vector3(0, -0.4, 0.4));
scene.add(tlLight);

/* 路地・裏の明かり */
const alleyLight = new THREE.PointLight(0xffd2a0, 2.0, 6, 1.8);
alleyLight.position.set(-6.2, 2.6, -1.5);
scene.add(alleyLight);

/* ------------------------------- 雨 ------------------------------- */
const rain = buildRain(scene);
const drips = buildDrips(scene, store.canopy);
const glassRain = buildGlassRain(scene, store.glassPanes);
if (DEBUG_FLAT) {
  rain.mesh.visible = false;
  drips.inst.visible = false;
}

/* ---------------------------- ポストプロセス ---------------------------- */
let width = window.innerWidth;
let height = window.innerHeight;
let pr = renderer.getPixelRatio();
let rt = makeRenderTargets(width * pr, height * pr);
let { composer, bloom, outline, fxaa } = buildComposer(renderer, rt.rtScene, rt.rtNormal);
if (DEBUG_FLAT) {
  bloom.strength = 0;
  outline.uniforms.uStrength.value = 0;
}
updateSizes();

const normalMaterial = new THREE.MeshNormalMaterial();
normalMaterial.fog = false;

function updateSizes() {
  width = window.innerWidth;
  height = window.innerHeight;
  pr = renderer.getPixelRatio();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
  rt.rtScene.setSize(width * pr, height * pr);
  rt.rtNormal.setSize(width * pr, height * pr);
  outline.uniforms.uTexel.value.set(1 / (width * pr), 1 / (height * pr));
  outline.uniforms.uNear.value = camera.near;
  outline.uniforms.uFar.value = camera.far;
  fxaa.material.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr));
}

window.addEventListener('resize', updateSizes);

/* ------------------------------- 演出 ------------------------------- */
const flickers = [...store.flickers, ...props.flickers];

function updateFlickers(t) {
  for (const f of flickers) {
    const n =
      0.5 * Math.sin(t * f.speed + f.jitter) +
      0.3 * Math.sin(t * f.speed * 2.7 + f.jitter * 3.1) +
      0.2 * Math.sin(t * f.speed * 6.3 + f.jitter * 5.7);
    let k = 1 + n * f.amount;
    if (f.glitch) {
      const g = Math.sin(t * 13.0 + f.jitter) * Math.sin(t * 3.1);
      if (g > 0.93) k *= 0.25 + 0.5 * Math.random();
    }
    const mat = f.mat;
    if (mat.userData.baseColor) {
      mat.color.copy(mat.userData.baseColor).multiplyScalar(k);
    } else {
      mat.emissiveIntensity = f.base * k;
    }
  }
}
// ひとつだけ少し不調な看板にする
if (flickers.length) {
  flickers[flickers.length - 1].glitch = true;
  flickers[flickers.length - 1].amount = 0.35;
}

/* 自動ドア */
const doorState = { phase: 'wait', timer: 5 + Math.random() * 6, k: 0 };
function updateDoors(t, dt) {
  const d = store.doors;
  if (!d) return;
  doorState.timer -= dt;
  if (doorState.phase === 'wait') {
    if (doorState.timer <= 0) {
      doorState.phase = 'opening';
      doorState.timer = 1.1;
    }
  } else if (doorState.phase === 'opening') {
    doorState.k = Math.min(1, doorState.k + dt / 1.1);
    if (doorState.k >= 1) {
      doorState.phase = 'open';
      doorState.timer = 2.2 + Math.random() * 2.5;
    }
  } else if (doorState.phase === 'open') {
    if (doorState.timer <= 0) doorState.phase = 'closing';
  } else {
    doorState.k = Math.max(0, doorState.k - dt / 1.0);
    if (doorState.k <= 0) {
      doorState.phase = 'wait';
      doorState.timer = 7 + Math.random() * 9;
    }
  }
  const e = doorState.k * doorState.k * (3 - 2 * doorState.k);
  d.left.position.x = d.closedL - e * d.open;
  d.right.position.x = d.closedR + e * d.open;
}

/* 信号機 */
const tl = props.trafficLight;
const tlSeq = [
  { key: 'green', time: 7.0, color: 0x39d96a, intensity: 2.4 },
  { key: 'yellow', time: 1.6, color: 0xffc21e, intensity: 2.0 },
  { key: 'red', time: 7.5, color: 0xff3b30, intensity: 2.4 },
];
let tlIndex = 0;
let tlTimer = 3.0;
function updateTrafficLight(t, dt) {
  tlTimer -= dt;
  if (tlTimer <= 0) {
    tlIndex = (tlIndex + 1) % tlSeq.length;
    tlTimer = tlSeq[tlIndex].time;
  }
  const cur = tlSeq[tlIndex];
  const blink = 0.9 + 0.1 * Math.sin(t * 9.0);
  for (const key of ['red', 'yellow', 'green']) {
    const m = tl.mats[key];
    const on = key === cur.key;
    const v = on ? cur.intensity * blink : 0.06;
    m.color.set(key === 'red' ? 0xff3b30 : key === 'yellow' ? 0xffc21e : 0x39d96a).multiplyScalar(v);
  }
  tlLight.color.set(cur.color);
  tlLight.intensity = cur.key === 'green' ? 3.0 : 2.1;
  tl.source.color.set(cur.color);
  tl.source.intensity = cur.key === 'green' ? 0.55 : 0.42;
}

/* 街路灯のわずかな揺らぎ */
function updateLamps(t) {
  const f = 0.95 + 0.05 * Math.sin(t * 5.3) + 0.03 * Math.sin(t * 11.7);
  lampLights.forEach((l, i) => {
    l.intensity = (i === 0 ? 38 : 28) * (f + 0.02 * Math.sin(t * 3.1 + i));
  });
}

/* ------------------------------ メインループ ------------------------------ */
const timer = new THREE.Timer();
let time = 0;

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  time += dt;

  controls.update();
  // パンで視点が外に飛ばないように
  const tt = controls.target;
  tt.x = THREE.MathUtils.clamp(tt.x, -6, 6);
  tt.y = THREE.MathUtils.clamp(tt.y, -0.5, 4.5);
  tt.z = THREE.MathUtils.clamp(tt.z, -6, 6);

  gU.uTime.value = time;
  rain.mat.uniforms.uTime.value = time;
  drips.update(time, dt);
  glassRain.update(time);
  updateFlickers(time);
  updateDoors(time, dt);
  updateTrafficLight(time, dt);
  updateLamps(time);
  syncLightSources();

  outline.uniforms.uNear.value = camera.near;
  outline.uniforms.uFar.value = camera.far;

  // 1. メイン描画（深度付き）
  renderer.setRenderTarget(rt.rtScene);
  renderer.clear();
  renderer.render(scene, camera);

  // 2. 法線パス（輪郭線抽出用）
  const prevLayers = camera.layers.mask;
  camera.layers.set(0);
  scene.overrideMaterial = normalMaterial;
  renderer.setRenderTarget(rt.rtNormal);
  renderer.clear();
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  camera.layers.mask = prevLayers;

  // 3. 合成
  renderer.setRenderTarget(null);
  composer.render();
}

animate();

// ローディング表示を消す
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 1000);
  }
});

// デバッグフック（開発用）
window.__dbg = { scene, camera, renderer, THREE, controls };
