// 车辆：Tesla Roadster 2020 真实模型（metarex.4d，CC BY 4.0，见 ASSETS.md），Meshopt 压缩内嵌。
// 统一到场景约定：车头 +x，车顶 +y，横向 z；车身原点在四轮接地面中心。
// 四个车轮挂在独立的悬挂节点上（可上下行程 + 绕轴滚动）；加装车底冷气反推口与侧面 RCS 喷口。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import glbBytes from './assets/roadster.glb';
import { RW } from './timeline.js';

export const CAR_LEN = 4.36;

export async function buildCar() {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const buf = glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
  const model = gltf.scene;

  const car = new THREE.Group(); car.name = 'roadster';
  const body = new THREE.Group(); body.name = 'sprung'; car.add(body);
  model.rotation.y = Math.PI / 2;              // 源模型车头 +Z → +X
  body.add(model);
  car.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const s = CAR_LEN / (box.max.x - box.min.x);
  model.scale.setScalar(s);
  car.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  car.updateMatrixWorld(true);

  // ---- 材质：珍珠白车漆 / 深色玻璃 / 灯组
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xf3f4f6, metalness: 0.06, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.025,
    sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xe6eeff), envMapIntensity: 1.15,
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1014, metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.6, transparent: true, opacity: 0.93 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(0xe4f1ff), emissiveIntensity: 4, roughness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(0xff1408), emissiveIntensity: 5, roughness: 0.25 });
  const wheelNames = ['wheel_fr', 'wheel_fl', 'wheel_rr', 'wheel_rl'];
  const wheelNodes = [];
  model.traverse((o) => {
    if (wheelNames.includes(o.name)) wheelNodes.push(o);
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material; const n = m?.name || '';
    if (n === 'car_main_paint') o.material = paint;
    else if (n === 'Glass_mid_tint' || n === 'Glass_Tint_max') o.material = glass;
    else if (n === 'headlights_main' || n === 'headlights_AHO') o.material = headMat;
    else if (n === 'Glass_rear_lights_main' || n === 'Glass_rear_lights_DHO') o.material = tailMat;
    else if (m && m.isMeshStandardMaterial) { m.envMapIntensity = 0.9; if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.35; } }
  });

  // ---- 车轮：从车身拆到悬挂节点（保持世界变换），节点在轮心，绕 z 轴滚动
  const wheels = [];
  for (const wn of wheelNodes) {
    const c = new THREE.Box3().setFromObject(wn).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.position.copy(c); car.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    car.updateMatrixWorld(true);
    spin.attach(wn);
    wheels.push({ g: pivot, spin, y0: c.y, x: c.x, z: c.z });
  }
  const wheelR = wheels.length ? wheels.reduce((a, w) => a + w.y0, 0) / wheels.length : RW;

  // ---- 冷气推进器（虚构加装件）：车底 4 个反推口 + 侧面前后各 4 个 RCS
  const nozMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.9, roughness: 0.28 });
  const boreMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.8 });
  const under = new THREE.Group(); body.add(under);
  const NOZ = [[1.0, 0.55], [1.0, -0.55], [-1.05, 0.55], [-1.05, -0.55]];
  const thrusters = NOZ.map(([x, z]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.05, 24, 1, true), nozMat); ring.position.set(x, 0.135, z); under.add(ring);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(0.072, 24), boreMat); bore.rotation.x = Math.PI / 2; bore.position.set(x, 0.112, z); under.add(bore);
    return new THREE.Vector3(x, 0.1, z);
  });
  // 吸附风扇格栅（车底中段两只）
  const fanTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#30343a'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 11; i++) { g.save(); g.translate(128, 128); g.rotate(i / 11 * Math.PI * 2); g.fillStyle = '#1d2024'; g.beginPath(); g.moveTo(14, -6); g.quadraticCurveTo(70, -32, 106, -8); g.lineTo(106, 7); g.quadraticCurveTo(62, -8, 14, 6); g.fill(); g.restore(); }
    g.fillStyle = '#41464d'; g.beginPath(); g.arc(128, 128, 20, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const fans = [];
  for (const fx of [0.38, -0.38]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshStandardMaterial({ map: fanTex, roughness: 0.55, metalness: 0.5 })); m.rotation.x = Math.PI / 2; m.position.set(fx, 0.118, 0); under.add(m); fans.push(m); }
  // RCS：0 左上(喷+y) · 1 左下(喷-y) · 2 右上(喷+y) · 3 右下(喷-y)；0+3 正向横滚，1+2 反向
  const W = 0.97;
  const RCS = [[0.78, -W, 1], [0.3, -W - 0.02, -1], [0.78, W, 1], [0.3, W + 0.02, -1]];
  const rcs = RCS.map(([y, z, dir]) => {
    const out = { p: new THREE.Vector3(1.45, y, z * (y > 0.5 ? 0.86 : 1)), p2: new THREE.Vector3(-1.62, y, z * (y > 0.5 ? 0.88 : 1)), d: new THREE.Vector3(0, dir, Math.sign(z) * 0.35).normalize() };
    for (const p of [out.p, out.p2]) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 8, 18), nozMat); m.position.copy(p); m.rotation.x = Math.PI / 2; body.add(m); }
    return out;
  });

  car.userData = { body, wheels, wheelR, thrusters, rcs, fans, tailMat, headMat, model };
  return car;
}

/** 悬挂（susp>0 车轮相对车身下垂；<0 压缩）、轮速、刹车灯、风扇转动 */
export function poseCar(car, st, dt) {
  const ud = car.userData;
  for (const w of ud.wheels) {
    w.g.position.y = w.y0 - st.susp;
    w.spin.rotation.z -= (st.spinRate ?? 0) * dt;
  }
  ud.tailMat.emissiveIntensity = st.brake ? 30 : 6;
  for (const f of ud.fans) f.rotation.z += (st.fan ?? 0) * dt * 120;
}
