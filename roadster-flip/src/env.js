// 夜间测试场环境：混凝土场地（接缝/积水/轮胎印/降落靶标）、夜空与星星、泛光灯塔（SpotLight + 体积光锥）、
// 地面上照灯车、远景 Starbase（发射塔 + 筷子臂 + Starship 箭体 + 储罐区 + 航空障碍灯）与地平线灯火。
import * as THREE from 'three';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  return t;
}

// ---------------------------------------------------------------- 地面
function buildGround(scene, landX) {
  const R = rng(7);
  const SIZE = 2048, M = 40;  // 一张贴图覆盖 40 m
  const blot = (g, n, rmin, rmax, col) => { for (let i = 0; i < n; i++) { const x = R() * SIZE, y = R() * SIZE, r = rmin + R() * (rmax - rmin); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  const albedo = canvasTex(SIZE, SIZE, (g) => {
    g.fillStyle = '#6f7071'; g.fillRect(0, 0, SIZE, SIZE);
    blot(g, 260, 30, 220, 'rgba(255,255,255,0.05)'); blot(g, 260, 30, 260, 'rgba(0,0,0,0.07)');
    const img = g.getImageData(0, 0, SIZE, SIZE); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.95; }
    g.putImageData(img, 0, 0);
    // 混凝土板接缝（每 8 m）
    const px = SIZE / M * 8;
    g.strokeStyle = 'rgba(20,20,20,0.75)'; g.lineWidth = 3;
    for (let k = 0; k <= SIZE; k += px) { g.beginPath(); g.moveTo(k + 1, 0); g.lineTo(k + 1, SIZE); g.stroke(); g.beginPath(); g.moveTo(0, k + 1); g.lineTo(SIZE, k + 1); g.stroke(); }
    // 发丝裂缝
    g.strokeStyle = 'rgba(25,25,25,0.4)'; g.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { let x = R() * SIZE, y = R() * SIZE; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 12; j++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    // 油渍、轮胎印
    blot(g, 30, 20, 70, 'rgba(10,10,12,0.25)');
    g.strokeStyle = 'rgba(15,15,15,0.18)'; g.lineWidth = 14;
    for (let i = 0; i < 14; i++) { const x = R() * SIZE, y = R() * SIZE, r = 200 + R() * 700, a = R() * 6; g.beginPath(); g.arc(x, y, r, a, a + 0.8 + R()); g.stroke(); g.beginPath(); g.arc(x, y, r + 26, a, a + 0.8 + R()); g.stroke(); }
  });
  // 粗糙度（G 通道）：积水处光滑 → 反射泛光灯
  const rough = canvasTex(SIZE / 2, SIZE / 2, (g, w, h) => {
    g.fillStyle = 'rgb(0,215,0)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 12 + R() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,80,0,0.9)'); gr.addColorStop(0.7, 'rgba(0,120,0,0.5)'); gr.addColorStop(1, 'rgba(0,215,0,0)'); g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1.8, 0.7); g.translate(-x, -y); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
  }, false);
  const rep = 400 / M;
  albedo.repeat.set(rep, rep); rough.repeat.set(rep, rep);
  const mat = new THREE.MeshStandardMaterial({ map: albedo, roughnessMap: rough, roughness: 1, metalness: 0.0, envMapIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat); pad.rotation.x = -Math.PI / 2; pad.receiveShadow = true; scene.add(pad);
  // 场外：沙土 / 盐碱滩
  const sandTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#3b3a34'; g.fillRect(0, 0, w, h); const img = g.getImageData(0, 0, w, h); for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.8; } g.putImageData(img, 0, 0); });
  sandTex.repeat.set(300, 300);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.03; sand.receiveShadow = true; scene.add(sand);
  // 降落靶标（黄色圆环 + 十字）
  const target = canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(235,185,40,0.85)'; g.lineWidth = 26;
    g.beginPath(); g.arc(w / 2, h / 2, 440, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.arc(w / 2, h / 2, 300, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 18; g.beginPath(); g.moveTo(w / 2 - 160, h / 2); g.lineTo(w / 2 + 160, h / 2); g.moveTo(w / 2, h / 2 - 160); g.lineTo(w / 2, h / 2 + 160); g.stroke();
    // 磨损
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${(R() * 0.6).toFixed(3)})`; g.fillRect(R() * w, R() * h, 2 + R() * 8, 2 + R() * 8); }
  });
  const tgt = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ map: target, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  tgt.rotation.x = -Math.PI / 2; tgt.position.set(landX, 0.01, 0); tgt.receiveShadow = true; scene.add(tgt);
  // 入坡车道两侧白色虚线
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  for (const zs of [-1, 1]) for (let x = -150; x < -18; x += 6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.16), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.008, zs * 3.4); m.receiveShadow = true; scene.add(m); }
}

// ---------------------------------------------------------------- 夜空
function buildSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 zen = vec3(0.003, 0.005, 0.012), hor = vec3(0.0103, 0.0137, 0.0203);
        vec3 c = mix(hor, zen, pow(max(h,0.0), 0.45));
        // 远处城镇光污染（东北方向偏暖）+ 测试场灯光把低空薄雾照亮
        float town = pow(max(0.0, dot(normalize(vec3(0.6,0.0,-0.8)), normalize(vec3(vDir.x,0.0,vDir.z)))), 6.0) * exp(-max(h,0.0)*14.0);
        c += vec3(0.03,0.018,0.008) * town;
        c += vec3(0.006,0.007,0.009) * exp(-max(h,0.0)*9.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10; scene.add(sky);
  const R = rng(11), N = 2600, pos = new Float32Array(N * 3), mag = new Float32Array(N);
  for (let i = 0; i < N; i++) { const u = R() * 2 - 1, a = R() * Math.PI * 2; const y = Math.abs(u) * 0.95 + 0.05; const r = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * r * 3800, y * 3800, Math.sin(a) * r * 3800], i * 3); mag[i] = Math.pow(R(), 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, fovScale: { value: 1 } },
    vertexShader: `attribute float mag; uniform float time; uniform float fovScale; varying float vA;
      void main(){ vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w*0.9999;
        float tw = 0.75 + 0.25*sin(time*3.0 + position.x*0.37 + position.z*0.11);
        vA = (0.15 + mag*0.85) * tw * smoothstep(0.02, 0.25, normalize(position).y);
        gl_PointSize = (1.2 + mag*2.4) * fovScale; }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.85,0.9,1.0), vA*smoothstep(0.5,0.0,d)); }',
  }));
  stars.renderOrder = -9; scene.add(stars);
  return { stars };
}

// ---------------------------------------------------------------- 体积光锥
function beamMaterial(color, strength) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength }, time: { value: 0 } },
    vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vAlong = 1.0 - uv.y; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; uniform float time; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float fall = pow(1.0 - vAlong, 1.6) * smoothstep(0.0, 0.04, vAlong);
        float dust = 0.85 + 0.15*sin(vW.y*1.7 + time*0.6 + vW.x*0.9) * sin(vW.z*1.3 - time*0.4);
        float a = strength * edge * fall * dust;
        gl_FragColor = vec4(color * a, a);
      }`,
  });
}

// ---------------------------------------------------------------- 泛光灯塔
function buildMast(height, mat) {
  const g = new THREE.Group();
  const w0 = 1.6, w1 = 0.7;
  const bars = [];
  const corner = (k, y) => { const w = w0 + (w1 - w0) * (y / height); const a = k * Math.PI / 2 + Math.PI / 4; return new THREE.Vector3(Math.cos(a) * w / Math.SQRT2, y, Math.sin(a) * w / Math.SQRT2); };
  for (let k = 0; k < 4; k++) bars.push([corner(k, 0), corner(k, height), 0.07]);
  for (let y = 0; y < height - 0.1; y += 1.8) for (let k = 0; k < 4; k++) { bars.push([corner(k, y), corner((k + 1) % 4, y), 0.03]); bars.push([corner(k, y), corner((k + 1) % 4, Math.min(height, y + 1.8)), 0.025]); }
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6);
  const im = new THREE.InstancedMesh(geo, mat, bars.length);
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), d = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
  bars.forEach(([a, b, r], i) => { d.subVectors(b, a); const L = d.length(); d.normalize(); q.setFromUnitVectors(up, d); mid.addVectors(a, b).multiplyScalar(0.5); sc.set(r, L, r); m4.compose(mid, q, sc); im.setMatrixAt(i, m4); });
  im.castShadow = true; g.add(im);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x86857f, roughness: 0.9 })); base.position.y = 0.3; base.receiveShadow = true; g.add(base);
  return g;
}

export function buildEnv(scene, T, { landX }) {
  scene.background = new THREE.Color(0x020408);
  scene.fog = new THREE.FogExp2(0x1a1f27, 0.0026);
  buildGround(scene, landX);
  const { stars } = buildSky(scene);
  scene.add(new THREE.HemisphereLight(0x22314a, 0x0c0b0a, 0.3));
  { const site = new THREE.DirectionalLight(0x9aa6bd, 0.16); site.position.set(-40, 80, 60); scene.add(site); }

  const steel = new THREE.MeshStandardMaterial({ color: 0x7d838c, metalness: 0.8, roughness: 0.45 });
  const lampHousing = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.6, roughness: 0.5 });
  const lampFace = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xf4f1ea), emissiveIntensity: 32 });
  const beams = [], flares = [], spots = [];
  const cartFace = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xf4f1ea), emissiveIntensity: 22 });

  const towers = [
    { at: [-86, 0, 30], h: 22, aim: [-34, 4, 0], I: 9000, shadow: true, color: 0xf3efe6 },
    { at: [34, 0, 30], h: 24, aim: [-6, 12, 0], I: 7000, shadow: true, color: 0xf6f2ea },
    { at: [-30, 0, -42], h: 23, aim: [-8, 10, 0], I: 6500, shadow: true, color: 0xeef2ff },
    { at: [75, 0, -30], h: 26, aim: [5, 12, 0], I: 6000, shadow: false, color: 0xfff4e2 },
    { at: [-88, 0, -24], h: 18, aim: [-58, 0, 0], I: 5200, shadow: false, color: 0xf3efe6 },
  ];
  const carts = [
    { at: [-32, 0, -16], aim: [-11, 17, 0], I: 1100, shadow: false, color: 0xe8efff },
    { at: [-4, 0, -24], aim: [-10, 16, 0], I: 1000, shadow: false, color: 0xe8efff },
    { at: [32, 0, 8], aim: [14, 8, 0], I: 1300, shadow: false, color: 0xfff1dc },
    { at: [4, 0, 13], aim: [-11, 17, 0], I: 1300, shadow: false, color: 0xf2f4ff },
  ];
  const mkLight = (pos, aim, I, color, angle, shadow, beamStrength, len) => {
    const sp = new THREE.SpotLight(color, I, 0, angle, 0.55, 2);
    sp.position.copy(pos); sp.target.position.copy(aim);
    if (shadow) { sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.00012; sp.shadow.normalBias = 0.03; sp.shadow.camera.near = 4; sp.shadow.camera.far = 140; }
    scene.add(sp); scene.add(sp.target); spots.push(sp);
    const dir = new THREE.Vector3().subVectors(aim, pos).normalize();
    const L = len, r1 = Math.tan(angle * 0.92) * L;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, r1, L, 48, 1, true), beamMaterial(color, beamStrength));
    cone.position.copy(pos).addScaledVector(dir, L / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    cone.renderOrder = 5; scene.add(cone); beams.push(cone);
    return dir;
  };
  for (const tw of towers) {
    const base = new THREE.Vector3(...tw.at);
    const mast = buildMast(tw.h, steel); mast.position.copy(base); scene.add(mast);
    const head = new THREE.Vector3(base.x, tw.h + 0.8, base.z), aim = new THREE.Vector3(...tw.aim);
    const dir = mkLight(head, aim, tw.I, tw.color, 0.42, tw.shadow, 0.085, 70);
    // 灯架：3×4 只灯头，朝向目标
    const frame = new THREE.Group(); frame.position.copy(head); frame.lookAt(aim); scene.add(frame);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 0.15), lampHousing); rack.position.z = -0.35; frame.add(rack);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const hsg = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.45), lampHousing); hsg.position.set(-1.5 + i, -1 + j, 0); frame.add(hsg);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.62), lampFace); face.position.set(-1.5 + i, -1 + j, 0.23); frame.add(face);
    }
    flares.push({ pos: head.clone(), dir, size: 1, color: tw.color, kind: 'tower' });
  }
  for (const c of carts) {
    const base = new THREE.Vector3(...c.at), aim = new THREE.Vector3(...c.aim);
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.7), new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.7, metalness: 0.2 })); trailer.position.set(base.x, 0.8, base.z); trailer.castShadow = true; scene.add(trailer);
    const head = new THREE.Vector3(base.x, 2.4, base.z);
    const dir = mkLight(head, aim, c.I, c.color, 0.3, c.shadow, 0.06, 30);
    const frame = new THREE.Group(); frame.position.copy(head); frame.lookAt(aim); scene.add(frame);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const hsg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.4), lampHousing); hsg.position.set(-0.4 + i * 0.8, -0.35 + j * 0.7, 0); frame.add(hsg); const face = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.48), cartFace); face.position.set(-0.4 + i * 0.8, -0.35 + j * 0.7, 0.21); frame.add(face); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), steel); pole.position.set(base.x, 1.8, base.z); scene.add(pole);
    flares.push({ pos: head.clone(), dir, size: 0.6, color: c.color, kind: 'cart' });
  }

  // ---- 场边：混凝土隔离墩、锥桶、指挥车
  {
    const jersey = new THREE.Shape(); jersey.moveTo(-0.3, 0); jersey.lineTo(0.3, 0); jersey.lineTo(0.1, 0.3); jersey.lineTo(0.08, 0.81); jersey.lineTo(-0.08, 0.81); jersey.lineTo(-0.1, 0.3); jersey.lineTo(-0.3, 0);
    const jg = new THREE.ExtrudeGeometry(jersey, { depth: 3.6, bevelEnabled: false }); jg.rotateY(Math.PI / 2);
    const jm = new THREE.MeshStandardMaterial({ color: 0x9c9b95, roughness: 0.92 });
    const list = []; for (let x = -150; x < -24; x += 3.75) list.push([x, -5.6]);
    const im = new THREE.InstancedMesh(jg, jm, list.length); const m4 = new THREE.Matrix4();
    list.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); im.setMatrixAt(i, m4); }); im.castShadow = true; im.receiveShadow = true; scene.add(im);
    const coneGeo = new THREE.ConeGeometry(0.17, 0.7, 16); coneGeo.translate(0, 0.35, 0);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5a10, roughness: 0.6 });
    const R = rng(3); const cones = []; for (let i = 0; i < 18; i++) { const a = R() * Math.PI * 2, r = 7 + R() * 5; cones.push([landX + Math.cos(a) * r, Math.sin(a) * r * 0.8]); }
    const ci = new THREE.InstancedMesh(coneGeo, coneMat, cones.length); cones.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); ci.setMatrixAt(i, m4); }); ci.castShadow = true; scene.add(ci);
    // 远处一辆指挥车 + 一台吊车剪影
    const van = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.6 })); van.position.set(-60, 1.5, -26); van.castShadow = true; scene.add(van);
    const vanLight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 1.8), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff8a20, emissiveIntensity: 20 })); vanLight.position.set(-60, 2.9, -26); scene.add(vanLight);
    flares.push({ pos: vanLight.position.clone(), dir: null, size: 0.25, color: 0xff9a40, kind: 'beacon', blink: 1.3 });
  }

  // ---- 远景 Starbase
  const blinkers = [];
  {
    const far = new THREE.Group(); scene.add(far);
    const lat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.7, roughness: 0.6 });
    const towerAt = new THREE.Vector3(120, 0, -430), H = 146, W = 22;
    const bars = [];
    const c = (k, y) => new THREE.Vector3(towerAt.x + (k & 1 ? W / 2 : -W / 2), y, towerAt.z + (k & 2 ? W / 2 : -W / 2));
    const order = [0, 1, 3, 2];
    for (const k of order) bars.push([c(k, 0), c(k, H), 0.9]);
    for (let y = 0; y < H; y += 9.1) for (let i = 0; i < 4; i++) { const a = order[i], b = order[(i + 1) % 4]; bars.push([c(a, y), c(b, y), 0.4]); bars.push([c(a, y), c(b, Math.min(H, y + 9.1)), 0.3]); }
    // 筷子机械臂
    for (const zs of [-1, 1]) { bars.push([new THREE.Vector3(towerAt.x - W / 2, 108, towerAt.z + zs * 3), new THREE.Vector3(towerAt.x - W / 2 - 34, 110, towerAt.z + zs * 9), 1.1]); }
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6); const im = new THREE.InstancedMesh(geo, lat, bars.length);
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), d = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
    bars.forEach(([a, b, r], i) => { d.subVectors(b, a); const L = d.length(); d.normalize(); q.setFromUnitVectors(up, d); mid.addVectors(a, b).multiplyScalar(0.5); sc.set(r, L, r); m4.compose(mid, q, sc); im.setMatrixAt(i, m4); });
    far.add(im);
    // 发射台 + 箭体（不锈钢，被地面灯照亮）
    const ss = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.32, emissive: new THREE.Color(0x2a2c30), emissiveIntensity: 0.6 });
    const mountX = towerAt.x - W / 2 - 26, mountZ = towerAt.z;
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 20, 8), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8 })); mount.position.set(mountX, 10, mountZ); far.add(mount);
    const booster = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 71, 40), ss); booster.position.set(mountX, 20 + 35.5, mountZ); far.add(booster);
    const ship = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 38, 40), ss); ship.position.set(mountX, 91 + 19, mountZ); far.add(ship);
    const nosePts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; nosePts.push(new THREE.Vector2(4.5 * Math.cos(t * Math.PI / 2) ** 0.8, t * 13)); }
    const nose = new THREE.Mesh(new THREE.LatheGeometry(nosePts, 40), ss); nose.position.set(mountX, 129, mountZ); far.add(nose);
    for (const zs of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 0.6), ss); fin.position.set(mountX, 124, mountZ + zs * 6); far.add(fin); }
    const shipLight = new THREE.SpotLight(0xfff0dc, 900000, 0, 0.12, 0.6, 2); shipLight.position.set(mountX - 140, 3, mountZ + 160); shipLight.target.position.set(mountX, 80, mountZ); scene.add(shipLight); scene.add(shipLight.target);
    // 储罐区
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x9fa3a8, metalness: 0.9, roughness: 0.35, emissive: 0x15171a, emissiveIntensity: 1 });
    for (let i = 0; i < 7; i++) { const r = 6 + (i % 3) * 1.5, h = 9 + (i % 2) * 6; const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), tankMat); t.position.set(230 + i * 17, h / 2, -380 - (i % 2) * 16); far.add(t); }
    // 航空障碍灯 + 场区工作灯点
    const mkDot = (p, col, inten, size, blink) => { const m = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: new THREE.Color(col), emissiveIntensity: inten })); m.position.copy(p); far.add(m); if (blink) blinkers.push({ m, base: inten, phase: blink }); return m; };
    for (const y of [40, 80, 120, H + 1]) for (const k of [0, 3]) { const p = c(k, y); mkDot(p, 0xff2010, 60, 0.9, 0.3 + y * 0.003); flares.push({ pos: p.clone(), dir: null, size: 0.3, color: 0xff3020, kind: 'beacon', blink: 0.3 + y * 0.003 }); }
    for (let y = 6; y < H; y += 13) mkDot(c(1, y), 0xfff2d8, 30, 0.5, 0);
    const R = rng(21);
    for (let i = 0; i < 70; i++) mkDot(new THREE.Vector3(60 + R() * 300, 1 + R() * 10, -340 - R() * 200), R() < 0.8 ? 0xffd9a0 : 0xd8ecff, 18 + R() * 25, 0.35 + R() * 0.4, 0);
    // 地平线灯火
    const N = 500, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = -2.5 + R() * 1.6; const r = 1800 + R() * 900; pos.set([Math.cos(a) * r, 1 + R() * 6, Math.sin(a) * r], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    far.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc070, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false })));
  }

  return {
    flares, beams, spots, stars,
    update(t, camera) {
      for (const b of beams) b.material.uniforms.time.value = t;
      stars.material.uniforms.time.value = t;
      stars.material.uniforms.fovScale.value = Math.min(3, 20 / camera.fov);
      for (const b of blinkers) b.m.material.emissiveIntensity = ((t * 0.75 + b.phase) % 1) < 0.5 ? b.base : b.base * 0.03;
    },
  };
}

/** PMREM 用的反射环境：黑色背景上一圈高亮灯板（让白漆与玻璃有锐利高光） */
export function buildReflectionScene() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x05070b);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.94).multiplyScalar(4) });
  const dirs = [[-86, 22, 30], [34, 24, 30], [-30, 23, -42], [75, 26, -30], [-88, 18, -24], [-20, 2.4, 15], [-3, 2.4, -15]];
  for (const [x, y, z] of dirs) { const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), mat); const v = new THREE.Vector3(x, y - 10, z).normalize().multiplyScalar(30); p.position.copy(v); p.lookAt(0, 0, 0); s.add(p); }
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(200, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.06, 0.08) })); strip.position.set(0, -2, -40); s.add(strip);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.035, 0.035) })); ground.rotation.x = -Math.PI / 2; ground.position.y = -8; s.add(ground);
  const skyb = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.01, 0.015, 0.03), side: THREE.BackSide })); s.add(skyb);
  return s;
}
