// car.js — 第二代 Tesla Roadster 程序化建模：白漆车身、玻璃座舱、
// 车底吸附风扇环、腹部反推喷口×3、肩部姿态喷口×4、侧面横滚 RCS×4
import * as THREE from 'three';

export function buildCar() {
  const group = new THREE.Group();     // 世界定位（原点=轮胎接地面中心上方 rideH）
  const body = new THREE.Group();      // 悬架弹性体（相对 group 上下浮动+俯仰）
  group.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xf2f4f7, metalness: .55, roughness: .34,
    clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.25,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0b0e13, metalness: .1, roughness: .06,
    clearcoat: 1, envMapIntensity: 1.6,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: .6, roughness: .5 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0xd9dee4, metalness: .95, roughness: .22 });
  const tireM = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: .95 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4faff, emissiveIntensity: 5 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a1a, emissiveIntensity: 2.4 });

  // —— 车身：侧面轮廓 Shape → Extrude ——
  const sh = new THREE.Shape();
  sh.moveTo(-2.18, -0.34);
  sh.lineTo(2.18, -0.34);
  sh.quadraticCurveTo(2.42, -0.3, 2.46, -0.08);   // 车头
  sh.quadraticCurveTo(2.3, 0.02, 1.5, 0.1);       // 前翼板
  sh.quadraticCurveTo(0.8, 0.16, 0.55, 0.22);     // 引擎盖
  sh.quadraticCurveTo(0.28, 0.52, 0.02, 0.58);    // A 柱 → 车顶
  sh.quadraticCurveTo(-0.6, 0.6, -0.85, 0.5);     // 车顶
  sh.quadraticCurveTo(-1.5, 0.22, -2.05, 0.12);   // 快背
  sh.lineTo(-2.32, 0.08);
  sh.quadraticCurveTo(-2.42, 0.02, -2.38, -0.2);  // 车尾
  sh.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(sh, {
    depth: 1.7, bevelEnabled: true, bevelThickness: .1, bevelSize: .09, bevelSegments: 3, steps: 1,
  });
  bodyGeo.translate(0, 0, -0.85 - .045);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  bodyMesh.castShadow = true;
  body.add(bodyMesh);

  // 座舱玻璃穹顶
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), glass);
  canopy.scale.set(1.28, .42, .74);
  canopy.position.set(-0.18, .3, 0);
  body.add(canopy);

  // 前后扰流
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(.5, .07, 1.92), trim);
  splitter.position.set(2.3, -.36, 0); body.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(.4, .1, 1.9), trim);
  diffuser.position.set(-2.25, -.36, 0); body.add(diffuser);

  // 灯带
  const headBar = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, 1.5), headM);
  headBar.position.set(2.47, -.06, 0); body.add(headBar);
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(.05, .07, 1.6), tailM);
  tailBar.position.set(-2.44, -.02, 0); body.add(tailBar);

  // 车轮（group 定位 + spinMesh 自转）
  const wheelGeoT = new THREE.CylinderGeometry(.34, .34, .27, 28);
  wheelGeoT.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(.21, .21, .28, 24);
  rimGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(.3, .05, .055);
  const wheels = [];
  for (const [wx, wz] of [[1.45, .84], [1.45, -.84], [-1.45, .84], [-1.45, -.84]]) {
    const wg = new THREE.Group();
    wg.position.set(wx, -0.30, wz);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeoT, tireM); tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimM);
    spin.add(tire, rim);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(spokeGeo, trim);
      sp.rotation.z = (i / 5) * Math.PI;
      sp.position.set(0, 0, wz > 0 ? .1 : -.1);
      sp.rotation.x = wz > 0 ? 0 : Math.PI;
      spin.add(sp);
    }
    wg.add(spin);
    // 轮眉
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.44, .05, 8, 20, Math.PI), trim);
    arch.position.set(wx, -0.3, wz > 0 ? .92 : -.92);
    arch.rotation.y = Math.PI / 2;
    arch.rotation.z = 0;
    body.add(arch);
    group.add(wg);
    wheels.push({ grp: wg, spin });
  }

  // —— 车底吸附风扇环（倒挂锁定时发光）——
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x8fe0ff, emissiveIntensity: 0 });
  const fanRings = [];
  for (const [fx, fz] of [[1.3, .55], [1.3, -.55], [-1.3, .55], [-1.3, -.55]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .035, 8, 24), fanMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(fx, -.42, fz);
    body.add(ring); fanRings.push(ring);
  }

  // —— 喷口与羽流 ——
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xcfe4ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const nozzleM = new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: .8, roughness: .4 });

  function plume(len, r) {
    const g = new THREE.ConeGeometry(r, len, 14, 1, true);
    g.translate(0, len / 2, 0); // 底部在原点，向 +y 展开（锥尖朝上→旋转后指向喷射方向）
    g.scale(1, 1, 1);
    const m = new THREE.Mesh(g, plumeMat);
    m.visible = false;
    return m;
  }
  const mkNozzle = (x, y, z) => {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(.075, .09, .07, 12), nozzleM);
    n.position.set(x, y, z);
    body.add(n);
    return n;
  };

  // 腹部主反推 ×3（羽流 -y）
  const belly = [];
  for (const bx of [-1.05, 0, 1.05]) {
    mkNozzle(bx, -.44, 0);
    const p = plume(1.1, .16);
    p.rotation.x = Math.PI; // +y → -y
    p.position.set(bx, -.44, 0);
    body.add(p); belly.push(p);
  }
  // 肩部姿态喷口 ×4（羽流 +y，倒挂时指向地面）
  const shoulder = [];
  for (const [sx, sz] of [[1.42, .5], [1.42, -.5], [-1.42, .5], [-1.42, -.5]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(.22, .1, .18), nozzleM);
    box.position.set(sx, .52, sz);
    body.add(box);
    const p = plume(1.0, .12);
    p.position.set(sx, .55, sz);
    p.rotation.z = sz > 0 ? .28 : -.28; // 稍微外八字
    body.add(p); shoulder.push(p);
  }
  // 侧面横滚 RCS ×4（羽流 ±z）
  const side = [];
  for (const [sx, sgn] of [[1.6, 1], [1.6, -1], [-1.6, 1], [-1.6, -1]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(.16, .12, .1), nozzleM);
    box.position.set(sx, -.05, .93 * sgn);
    body.add(box);
    const p = plume(.9, .12);
    p.position.set(sx, -.05, (.98) * sgn);
    p.rotation.x = sgn > 0 ? Math.PI / 2 : -Math.PI / 2; // +y → ±z
    body.add(p); side.push(p);
  }

  // 车底聚光点光（喷射时照亮车下/地面）
  const jetLight = new THREE.PointLight(0xcfe0ff, 0, 22, 2);
  jetLight.position.set(0, -1.1, 0);
  group.add(jetLight);

  // 前大灯照路
  const headSpot = new THREE.SpotLight(0xeaf4ff, 700, 55, .46, .55, 2);
  headSpot.position.set(2.3, -.05, 0);
  headSpot.target.position.set(26, -2.4, 0);
  group.add(headSpot, headSpot.target);

  // 倒挂风扇微光
  const fanGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: null, color: 0x9fdcff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  fanGlow.scale.set(2.6, 1.1, 1);
  fanGlow.position.set(0, -.5, 0);
  body.add(fanGlow);

  const api = {
    group, body, wheels, fanRings, fanMat, plumeMat, fanGlow, jetLight, headSpot,
    plumes: { belly, shoulder, side },
    setSpin(omega, dt) {
      for (const w of wheels) w.spin.rotation.z -= omega * dt;
    },
    setSuspension(y, pitch) {
      body.position.y = y;
      body.rotation.z = pitch;
    },
    setNozzleGroup(list, f, t) {
      for (const p of list) {
        p.visible = f > 0.02;
        const flick = .82 + .18 * Math.sin(t * 61 + p.position.x * 7);
        p.scale.set(.8 + .5 * f, (.55 + .75 * f) * flick, .8 + .5 * f);
        p.material.opacity = .62 * f * flick;
      }
    },
    setFan(f, t) {
      fanMat.emissiveIntensity = 3.2 * f * (0.8 + 0.2 * Math.sin(t * 22));
      fanGlow.material.opacity = .3 * f * (0.85 + 0.15 * Math.sin(t * 17 + 1));
      fanGlow.material.rotation = t * .8;
    },
  };
  return api;
}

