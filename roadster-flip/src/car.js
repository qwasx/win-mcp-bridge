// 第二代 Roadster 风格的流线型白色跑车：参数化放样车身（轮拱按圆柱挖出）、黑色玻璃座舱罩、
// 空气动力轮毂、细长前灯与贯穿尾灯、车底吸附风扇格栅、4 个车底反推口、4 个侧面 RCS 冷气口。
import * as THREE from 'three';
import { RW } from './timeline.js';

// 1D 三次 Hermite 插值（点按 x 递减排列，斜率取相邻差分）
function spline(pts) {
  const n = pts.length;
  const m = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; return (b[1] - a[1]) / (b[0] - a[0] || -1e-6); });
  return (x) => {
    if (x >= pts[0][0]) return pts[0][1];
    if (x <= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (i < n - 2 && x < pts[i + 1][0]) i++;
    const x1 = pts[i][0], x2 = pts[i + 1][0], h = x2 - x1, t = (x - x1) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}

const X_F = 2.2, X_R = -2.2;     // 车头 / 车尾
export const WHEEL_X = [1.36, -1.36];
export const WHEEL_Z = 0.835;
const ARCH_R = 0.44;

// 侧视轮廓与俯视宽度（米）：低矮长鼻、驾驶舱前移、圆润后翼子板
const topY = spline([[2.24, 0.36], [2.12, 0.47], [1.85, 0.58], [1.45, 0.68], [1.0, 0.78], [0.75, 0.84], [0.2, 0.875], [-0.6, 0.885], [-1.3, 0.91], [-1.75, 0.9], [-2.02, 0.84], [-2.17, 0.72], [-2.24, 0.52]]);
const botY = spline([[2.24, 0.3], [2.1, 0.19], [1.8, 0.15], [-1.6, 0.15], [-2.0, 0.21], [-2.24, 0.36]]);
const halfW = spline([[2.24, 0.42], [2.12, 0.7], [1.9, 0.88], [1.5, 0.98], [1.2, 1.0], [0.8, 0.96], [0.2, 0.9], [-0.4, 0.93], [-1.0, 0.99], [-1.45, 1.01], [-1.85, 0.97], [-2.1, 0.84], [-2.24, 0.58]]);
// 座舱罩：前挡风低斜、后部收成快背
const canTop = spline([[0.98, 0.86], [0.7, 0.98], [0.35, 1.1], [0.0, 1.17], [-0.4, 1.2], [-0.85, 1.16], [-1.15, 1.06], [-1.38, 0.92]]);

function loft({ x0, x1, nx, nr, section }) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * (i / nx);
    for (let j = 0; j <= nr; j++) {
      const p = section(x, j / nr);
      pos.push(p[0], p[1], p[2]); uv.push(i / nx, j / nr);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nr; j++) {
    const a = i * (nr + 1) + j, b = a + nr + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** 车身截面：上半部收腰（tumblehome），下半部平底；u ∈ [0,1] 绕一圈 */
function bodySection(x, u) {
  const a = u * Math.PI * 2;
  const t = topY(x), b = botY(x), w = halfW(x);
  const mid = b + (t - b) * 0.42;
  const s = Math.sin(a), c = Math.cos(a);
  const upper = s >= 0;
  const ny = upper ? 2.3 : 5.0, nz = upper ? 2.6 : 4.0;
  const yy = mid + (upper ? (t - mid) : (mid - b)) * Math.sign(s) * Math.pow(Math.abs(s), 2 / ny);
  const ww = w * (upper ? 1 - 0.1 * Math.pow(Math.abs(s), 1.5) : 1);
  let zz = ww * Math.sign(c) * Math.pow(Math.abs(c), 2 / nz);
  let px = x, py = yy;
  // 轮拱：侧视落在轮拱圆内的部分，侧壁向内收到轮罩内壁（|z| = 0.56），形成可见的轮罩凹槽
  for (const wx of WHEEL_X) {
    const d = Math.hypot(px - wx, py - RW);
    if (d < ARCH_R + 0.035 && Math.abs(zz) > 0.56) {
      const k = d < ARCH_R ? 1 : 1 - (d - ARCH_R) / 0.035;
      const kk = k * k * (3 - 2 * k);
      zz = Math.sign(zz) * (Math.abs(zz) + (0.56 - Math.abs(zz)) * kk);
    }
  }
  return [px, py, zz];
}

function canopySection(x, u) {
  // 只要上半圈：u ∈ [0,1] → 角度 0..π
  const a = u * Math.PI;
  const belt = topY(x) - 0.012, t = Math.max(belt + 0.01, canTop(x));
  const w0 = halfW(x) * 0.86;
  const s = Math.sin(a), c = Math.cos(a);
  const yy = belt + (t - belt) * Math.pow(s, 0.72);
  const zz = w0 * (1 - 0.2 * s) * Math.sign(c) * Math.pow(Math.abs(c), 0.62);
  return [x, yy, zz];
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildCar() {
  const car = new THREE.Group(); car.name = 'roadster';
  const body = new THREE.Group(); car.add(body);   // 簧上部分（悬挂压缩时整体下沉）

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, metalness: 0.08, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.25, sheen: 0.25, sheenColor: new THREE.Color(0xdde6ff) });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x06080b, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 0.4, roughness: 0.55 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.5, roughness: 0.35 });

  const bodyGeo = loft({ x0: X_R + 0.001, x1: X_F - 0.001, nx: 220, nr: 120, section: bodySection });
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, paint); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  body.add(bodyMesh);
  // 前后端盖（封口）
  for (const [x, sgn] of [[X_F - 0.001, 1], [X_R + 0.001, -1]]) {
    const ring = []; for (let j = 0; j <= 64; j++) ring.push(bodySection(x, j / 64));
    const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p[2], p[1])));
    const g = new THREE.ShapeGeometry(shape); g.rotateY(sgn > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(x, 0, 0);
    const m = new THREE.Mesh(g, paint); body.add(m);
  }
  const canGeo = loft({ x0: -1.38, x1: 0.98, nx: 120, nr: 60, section: canopySection }); canGeo.computeVertexNormals();
  const can = new THREE.Mesh(canGeo, glass); can.castShadow = true; body.add(can);

  // 轮罩内衬（遮住车身内壁）
  for (const wx of WHEEL_X) for (const sz of [1, -1]) {
    const g = new THREE.CylinderGeometry(ARCH_R - 0.01, ARCH_R - 0.01, 0.46, 32, 1, true, Math.PI * 0.5 - 1.45, 2.9);
    g.rotateX(Math.PI / 2); g.rotateZ(0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, side: THREE.BackSide }));
    m.position.set(wx, RW, sz * 0.72); body.add(m);
  }
  // 黑色下裙、前铲、后扩散器
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 1.86), carbon); skirt.position.set(0, 0.155, 0); body.add(skirt);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 1.3), carbon); lip.position.set(2.08, 0.17, 0); body.add(lip);
  const diff = new THREE.Group();
  for (let i = -3; i <= 3; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.012), carbon); f.position.set(-1.86, 0.19, i * 0.16); f.rotation.z = 0.2; diff.add(f); }
  body.add(diff);
  // 车底吸附风扇格栅（倒挂时朝上贴轨，镜头偶尔能瞥见）
  const fanTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0a0b0c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2d31'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 9; i++) { g.save(); g.translate(128, 128); g.rotate(i / 9 * Math.PI * 2); g.fillStyle = '#1c1f23'; g.beginPath(); g.moveTo(10, -6); g.quadraticCurveTo(70, -30, 104, -8); g.lineTo(104, 8); g.quadraticCurveTo(60, -6, 10, 6); g.fill(); g.restore(); }
    g.fillStyle = '#3a3e44'; g.beginPath(); g.arc(128, 128, 18, 0, Math.PI * 2); g.fill();
  });
  for (const fx of [0.45, -0.45]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshStandardMaterial({ map: fanTex, roughness: 0.6, metalness: 0.4 })); m.rotation.x = Math.PI / 2; m.position.set(fx, 0.116, 0); body.add(m); car.userData.fans = car.userData.fans || []; car.userData.fans.push(m); }

  // 灯：细长前灯（冷白）+ 贯穿尾灯（红，刹车时更亮）
  const headMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xdff0ff), emissiveIntensity: 14 });
  for (const sz of [1, -1]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const x = 1.95 + i * 0.012; const p = bodySection(x, sz > 0 ? 0.03 : 0.47); pts.push(new THREE.Vector3(p[0] + 0.004, p[1] + 0.0 + i * 0.002, p[2] * 0.985)); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 6, false);
    body.add(new THREE.Mesh(g, headMat));
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: new THREE.Color(0xff1a10), emissiveIntensity: 5 });
  { const pts = []; for (let j = 0; j <= 30; j++) { const u = 0.08 + j / 30 * 0.34; const p = bodySection(-2.19, u); pts.push(new THREE.Vector3(p[0] - 0.012, p[1] - 0.03, p[2])); }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.016, 6, false); const m = new THREE.Mesh(g, tailMat); body.add(m); }
  car.userData.tailMat = tailMat; car.userData.headMat = headMat;
  // 后视镜（小巧的翼形）
  for (const sz of [1, -1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), paint); m.scale.set(1.5, 0.6, 0.8); m.position.set(0.82, 0.93, sz * 0.87); body.add(m); }

  // 车底反推口（4）与侧面 RCS 口（4）
  const nozMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.3 });
  const NOZ = [[1.0, 0.6], [1.0, -0.6], [-1.05, 0.6], [-1.05, -0.6]];
  car.userData.thrusters = NOZ.map(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.06, 16, 1, true), nozMat); m.position.set(x, 0.12, z); body.add(m); return new THREE.Vector3(x, 0.09, z); });
  // RCS：0 左上（喷 +y）· 1 左下（喷 -y）· 2 右上（喷 +y）· 3 右下（喷 -y）；0+3 正向横滚，1+2 反向
  const RCS = [[0.1, 0.78, -0.86, 1], [0.1, 0.24, -0.98, -1], [0.1, 0.78, 0.86, 1], [0.1, 0.24, 0.98, -1]];
  car.userData.rcs = RCS.map(([x, y, z, dir]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16), nozMat); m.position.set(x, y, z); m.rotation.x = Math.PI / 2; body.add(m);
    return { p: new THREE.Vector3(x, y, z), d: new THREE.Vector3(0, dir, Math.sign(z) * 0.35).normalize() };
  });
  const rcs2 = [[-1.7, 0.78, -0.82, 1], [-1.7, 0.26, -0.95, -1], [-1.7, 0.78, 0.82, 1], [-1.7, 0.26, 0.95, -1]];
  rcs2.forEach(([x, y, z, dir], i) => { car.userData.rcs[i].p2 = new THREE.Vector3(x, y, z); const m = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16), nozMat); m.position.set(x, y, z); m.rotation.x = Math.PI / 2; body.add(m); void dir; });

  // 车轮：圆润轮胎（Lathe）+ 涡轮式空气动力轮毂
  const tireProfile = [];
  for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; tireProfile.push(new THREE.Vector2(0.25 + 0.11 * Math.cos(a) * 1.0 + (RW - 0.36), 0.135 * Math.sin(a))); }
  const tireGeo = new THREE.LatheGeometry(tireProfile, 64); tireGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.82, metalness: 0.0 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.22, clearcoat: 0.6 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.8, roughness: 0.35 });
  const wheels = [];
  for (const wx of WHEEL_X) for (const sz of [1, -1]) {
    const w = new THREE.Group(); w.position.set(wx, RW, sz * WHEEL_Z);
    const spin = new THREE.Group(); w.add(spin);
    const tire = new THREE.Mesh(tireGeo, tireMat); tire.castShadow = true; spin.add(tire);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.04, 48), rimDark); disc.rotation.x = Math.PI / 2; disc.position.z = sz * 0.07; spin.add(disc);
    for (let k = 0; k < 10; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), rimMat);
      const a = k / 10 * Math.PI * 2; blade.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, sz * 0.095); blade.rotation.z = a + 0.5; spin.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20), rimMat); hub.rotation.x = Math.PI / 2; hub.position.z = sz * 0.1; spin.add(hub);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.012, 8, 48), rimMat); ring.position.z = sz * 0.095; spin.add(ring);
    car.add(w); wheels.push({ g: w, spin, x: wx, z: sz * WHEEL_Z });
  }
  car.userData.wheels = wheels; car.userData.body = body;
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return car;
}

/** 更新：悬挂下垂（susp>0 车轮相对车身下垂）、轮速、刹车灯 */
export function poseCar(car, st, dt) {
  const ud = car.userData;
  // 车身相对车轮：susp = 车身原点离地高度（触地时），车轮保持贴地
  const drop = st.susp;   // >0 车轮下垂；<0 压缩
  for (const w of ud.wheels) {
    w.g.position.y = RW - drop;
    w.spin.rotation.z -= (st.spinRate ?? 0) * dt;
  }
  ud.tailMat.emissiveIntensity = st.brake ? 26 : 6;
  for (const f of ud.fans) f.rotation.z += (st.fan ?? 0) * dt * 120;
}
