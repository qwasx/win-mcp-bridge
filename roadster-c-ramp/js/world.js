// world.js — 得州夜间试验场：C 形金属坡道、灯塔光束、着陆坪、储罐、夜空与环境反射
import * as THREE from 'three';
import { skyTex, groundTex, padTex, roadTex, softDiscTex, beamGradTex, clamp, lerp, TAU } from './util.js';

export function buildWorld(scene, renderer) {
  const world = new THREE.Group();
  scene.add(world);

  scene.fog = new THREE.FogExp2(0x070a12, 0.0062);

  // —— 环境反射（PMREM：模拟场地上方成排工业灯）——
  {
    const env = new THREE.Scene();
    const strip = (w, h, c, x, y, z, rx) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.x = rx;
      env.add(m);
    };
    strip(26, 3, new THREE.Color(7, 7, 7.4), 0, 10, -6, Math.PI / 2);
    strip(18, 2.4, new THREE.Color(5, 5, 5.6), -8, 10, 6, Math.PI / 2);
    strip(14, 2, new THREE.Color(3.4, 3.4, 4), 10, 9, 8, Math.PI / 2);
    strip(60, 40, new THREE.Color(.05, .07, .12), 0, -2, 0, Math.PI / 2); // 地面暗蓝
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.05).texture;
    pmrem.dispose();
  }

  // —— 夜空 & 星星 ——
  {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(760, 32, 18),
      new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
    );
    world.add(sky);
    for (const [n, size] of [[650, 1.4], [260, 2.4]]) {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const az = Math.random() * TAU, el = Math.acos(Math.random() * .92);
        const r = 700;
        pos[i * 3] = r * Math.sin(el) * Math.cos(az);
        pos[i * 3 + 1] = r * Math.cos(el) * .92 + 30;
        pos[i * 3 + 2] = r * Math.sin(el) * Math.sin(az);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      world.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: 0xcfd8ea, size, sizeAttenuation: false, transparent: true, opacity: .8, fog: false,
      })));
    }
  }

  // —— 基础光 ——
  scene.add(new THREE.HemisphereLight(0x27324a, 0x0a0c10, .5));
  const moon = new THREE.DirectionalLight(0x33415e, .5);
  moon.position.set(-60, 80, -40);
  scene.add(moon);

  // —— 地面 / 着陆坪 / 道路 ——
  {
    const gTex = groundTex(); gTex.repeat.set(48, 48);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(420, 64),
      new THREE.MeshStandardMaterial({ color: 0xb6bcc4, map: gTex, roughness: .96, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    world.add(ground);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(10.5, 48),
      new THREE.MeshStandardMaterial({ map: padTex(), roughness: .9, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -1 })
    );
    pad.rotation.x = -Math.PI / 2; pad.position.y = .02;
    pad.receiveShadow = true;
    world.add(pad);

    const rTex = roadTex(); rTex.repeat.set(1, 8);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 66),
      new THREE.MeshStandardMaterial({ map: rTex, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(33, .015, 0);
    road.receiveShadow = true;
    world.add(road);
  }

  // —— C 形坡道 ——
  const R = 16, halfW = 3.8, thick = .55, C = new THREE.Vector2(0, R);
  const steel = new THREE.MeshStandardMaterial({ color: 0x99a1aa, metalness: .85, roughness: .36, side: THREE.DoubleSide });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x3c4249, metalness: .8, roughness: .5 });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x11100c, emissive: 0xffb35c, emissiveIntensity: 1.4 });
  {
    const φ0 = -Math.PI / 2, φ1 = -3 * Math.PI / 2, N = 72;
    const hw = halfW;
    // 四条面带：内表面 / 外表面 / 两侧；端部封口
    function strip(radiusA, radiusB, zA, zB) {
      const pos = [], idx = [], uv = [];
      for (let i = 0; i <= N; i++) {
        const φ = φ0 + (φ1 - φ0) * (i / N);
        const c = Math.cos(φ), s = Math.sin(φ);
        pos.push(
          C.x + c * radiusA, R + s * radiusA, zA,
          C.x + c * radiusB, R + s * radiusB, zB,
        );
        uv.push(i / N * 8, 0, i / N * 8, 1);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
        idx.push(a, c2, b, b, c2, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return new THREE.Mesh(g, steel);
    }
    const inner = strip(R, R, -hw, hw);            // 行驶面
    const outer = strip(R + thick, R + thick, -hw, hw);
    const sideL = strip(R, R + thick, -hw, -hw);
    const sideR = strip(R, R + thick, hw, hw);
    for (const m of [inner, outer, sideL, sideR]) { m.castShadow = true; m.receiveShadow = true; world.add(m); }
    // 端封
    for (const φe of [φ0, φ1]) {
      const c = Math.cos(φe), s = Math.sin(φe);
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, thick), steel);
      cap.position.set(C.x + c * (R + thick / 2), R + s * (R + thick / 2), 0);
      cap.rotation.z = φe + Math.PI / 2;
      cap.rotation.y = Math.PI / 2;
      world.add(cap);
    }
    // 边缘护栏（内外各一道 torus 弧）
    for (const z of [-hw, hw]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R - .1, .07, 8, 80, Math.PI), steelDark);
      rail.position.set(C.x, R, z);
      rail.rotation.z = Math.PI / 2;
      rail.castShadow = true;
      world.add(rail);
      // 警示灯带
      const stripM = new THREE.Mesh(new THREE.TorusGeometry(R + .02, .035, 6, 90, Math.PI), stripMat);
      stripM.position.set(C.x, R, z - Math.sign(z) * .12);
      stripM.rotation.z = Math.PI / 2;
      world.add(stripM);
    }
    // 支撑柱（外侧）
    for (const deg of [-135, -180, -225]) {
      const φ = deg * Math.PI / 180;
      const c = Math.cos(φ), s = Math.sin(φ);
      const px = C.x + c * (R + thick), py = R + s * (R + thick);
      const hgt = py;
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.3, hgt, 1.3), steelDark);
      col.position.set(px, hgt / 2, 0);
      col.castShadow = true;
      world.add(col);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, .5, hw * 2 + .8), steelDark);
      beam.position.set(px, py, 0);
      world.add(beam);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, .4, 3), steelDark);
      base.position.set(px, .2, 0);
      world.add(base);
    }
    // 顶部磁吸附能量环（倒挂时脉冲发光）
  }
  const magMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, emissive: 0x7fd8ff, emissiveIntensity: .3 });
  {
    const arc = THREE.MathUtils.degToRad(13);
    for (const z of [-1.6, 1.6]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R + .08, .1, 8, 30, arc), magMat);
      ring.position.set(C.x, R, z);
      ring.rotation.z = Math.PI / 2 + (Math.PI / 2 - arc); // 中心对准顶点(90°)
      world.add(ring);
    }
  }
  const glowTex = softDiscTex();
  const magGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x8fd8ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  magGlow.position.set(0, 2 * R + .4, 0);
  magGlow.scale.set(7, 3.2, 1);
  world.add(magGlow);

  // —— 工业灯塔（SpotLight + 光束锥 + 地面光池 + 眩光锚点）——
  const beamTex = beamGradTex();
  const towers = [];
  function tower({ x, z, headY, aim, intensity, color, angle, shadow = false }) {
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.22, .38, headY, 10), steelDark);
    pole.position.set(0, headY / 2, 0);
    pole.castShadow = true;
    grp.add(pole);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.5, .18, 1.5), steelDark);
    platform.position.y = headY - .35;
    grp.add(platform);
    // 航空障碍红灯
    const bl = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2211, emissiveIntensity: 2 }));
    bl.position.y = headY + .5;
    grp.add(bl);
    const blGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff3322, transparent: true, opacity: .0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    blGlow.position.y = headY + .5;
    blGlow.scale.set(1.4, 1.4, 1);
    grp.add(blGlow);

    const headPos = new THREE.Vector3(x, headY, z);
    const aimV = new THREE.Vector3(...aim);
    const head = new THREE.Group();
    head.position.set(0, .12, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, .62, .85), steelDark);
    head.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.95, .5),
      new THREE.MeshStandardMaterial({ color: 0x0c0c0c, emissive: 0xfff3da, emissiveIntensity: 6 }));
    face.position.z = .44;
    head.add(face);
    const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff0d5, transparent: true, opacity: .85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    headGlow.scale.set(4.2, 2.6, 1);
    headGlow.position.z = .6;
    head.add(headGlow);
    grp.add(head);
    grp.position.set(x, headY, z);
    head.lookAt(aimV.clone().sub(new THREE.Vector3(x, headY, z)).add(head.position.clone().add(grp.position)));
    // lookAt 用世界坐标：直接朝目标
    head.lookAt(aimV);
    world.add(grp);

    const spot = new THREE.SpotLight(color, intensity, 0, angle, .5, 2);
    spot.position.copy(headPos);
    spot.target.position.copy(aimV);
    world.add(spot, spot.target);
    if (shadow) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.camera.near = 4; spot.shadow.camera.far = 130;
      spot.shadow.bias = -0.0004; spot.shadow.normalBias = .35;
    }

    // 光束锥
    const len = headPos.distanceTo(aimV);
    const beamGeo = new THREE.ConeGeometry(Math.tan(angle * .82) * len, len, 26, 1, true);
    beamGeo.translate(0, -len / 2, 0); // 锥尖在原点，向 -y 展开
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xfff2da, alphaMap: beamTex, transparent: true, opacity: .1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    beam.position.copy(headPos);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aimV.clone().sub(headPos).normalize());
    beam.renderOrder = 4;
    world.add(beam);

    // 地面光池
    const pool = new THREE.Mesh(new THREE.CircleGeometry(Math.tan(angle) * len * .92, 32),
      new THREE.MeshBasicMaterial({
        map: glowTex, color, transparent: true, opacity: .16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(aimV.x, .04, aimV.z);
    world.add(pool);

    towers.push({ headPos, spot, beam, pool, headGlow, blGlow, bl, baseBeam: .1 });
    return towers[towers.length - 1];
  }

  tower({ x: 36, z: 28, headY: 18, aim: [2, 1, 0], intensity: 5200, color: 0xfff1d8, angle: .5, shadow: true });
  tower({ x: -34, z: 30, headY: 18, aim: [0, 29, 0], intensity: 5000, color: 0xeaf2ff, angle: .4 });
  tower({ x: 10, z: -38, headY: 15, aim: [0, 0, 0], intensity: 2700, color: 0xffedd0, angle: .42 });
  tower({ x: -30, z: -26, headY: 12, aim: [-4, 6, 0], intensity: 2100, color: 0xdfe9ff, angle: .4 });

  // —— 着陆坪边角频闪灯 ——
  const strobes = [];
  for (const [sx, sz] of [[8.6, 8.6], [-8.6, 8.6], [8.6, -8.6], [-8.6, -8.6]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.1, 8), steelDark);
    pole.position.set(sx, .55, sz);
    world.add(pole);
    const tipM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9fdcff, emissiveIntensity: .2 });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), tipM);
    tip.position.set(sx, 1.15, sz);
    world.add(tip);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xafe4ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    sp.position.copy(tip.position);
    sp.scale.set(2.2, 2.2, 1);
    world.add(sp);
    strobes.push({ tip, tipM, sp });
  }

  // —— 背景道具（储罐场 / 水塔 / 集装箱）——
  const propM = new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: .7, roughness: .5, envMapIntensity: .35 });
  const propM2 = new THREE.MeshStandardMaterial({ color: 0x565c66, metalness: .6, roughness: .6 });
  function tankCluster(cx, cz) {
    for (const [dx, dz, r, h] of [[0, 0, 5, 10], [11, 4, 4, 8], [-9, 6, 4.4, 9]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), propM);
      t.position.set(cx + dx, h / 2, cz + dz);
      t.castShadow = true;
      world.add(t);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, TAU, 0, Math.PI / 2), propM);
      cap.position.set(cx + dx, h, cz + dz);
      world.add(cap);
    }
    const sph = new THREE.Mesh(new THREE.SphereGeometry(3.6, 24, 16), propM);
    sph.position.set(cx + 2, 4.4, cz - 13);
    world.add(sph);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 2.6, 8), propM2);
    leg.position.set(cx + 2, 1.3, cz - 13);
    world.add(leg);
  }
  tankCluster(-54, -44);
  tankCluster(62, -34);
  // 水塔
  {
    const wt = new THREE.Group();
    const sph = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), propM);
    sph.position.y = 10;
    wt.add(sph);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 8.4, 8), propM2);
      leg.position.set(Math.cos(a) * 1.9, 4.2, Math.sin(a) * 1.9);
      leg.rotation.z = Math.cos(a) * .18; leg.rotation.x = -Math.sin(a) * .18;
      wt.add(leg);
    }
    wt.position.set(26, 0, 30);
    wt.traverse(o => { o.castShadow = true; });
    world.add(wt);
  }
  // 集装箱
  for (const [bx, bz, ry] of [[34, -22, .4], [40, -25, .1], [37, -28, .75], [-40, 22, -.5], [-46, 18, .2]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.6, 2.6), propM2);
    box.position.set(bx, 1.3, bz);
    box.rotation.y = ry;
    box.castShadow = true;
    world.add(box);
  }

  const api = {
    towers, strobes, magMat, magGlow, glowTex,
    flicker(t) {
      for (let i = 0; i < towers.length; i++) {
        const tw = towers[i];
        const fl = .92 + .08 * Math.sin(t * 13 + i * 5.1) + .04 * Math.sin(t * 29 + i * 9.7);
        tw.beam.material.opacity = tw.baseBeam * fl;
        tw.pool.material.opacity = .15 * fl;
        tw.headGlow.material.opacity = .8 * fl;
        tw.blGlow.material.opacity = (Math.sin(t * 2.2 + i) > .7) ? .8 : 0;
        tw.bl.material.emissiveIntensity = (Math.sin(t * 2.2 + i) > .7) ? 4 : .6;
      }
    },
    setStrobe(i, f, t) {
      const s = strobes[i];
      s.tipM.emissiveIntensity = .2 + 7 * f;
      s.sp.material.opacity = .85 * f;
      s.sp.scale.setScalar(1.6 + 1.8 * f);
    },
    setMaglock(f, t) {
      magMat.emissiveIntensity = .25 + 3.4 * f * (0.75 + 0.25 * Math.sin(t * 9));
      magGlow.material.opacity = .5 * f;
      magGlow.scale.set(6 + Math.sin(t * 9) * .8, 2.8, 1);
    },
  };
  return api;
}
