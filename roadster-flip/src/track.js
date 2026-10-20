// 巨型金属 C 形坡道（真实钢结构做法）：
//  路面 = 箱形钢梁（顶板防滑钢板 + 两侧腹板带竖向加劲肋 + 底板），护栏立柱 + 双道扶手 + 挡脚板，
//  顶面边缘与底部边缘 LED 灯带；远侧双层脊梁桁架（方钢管弦杆、腹杆、斜撑、节点板），
//  工字钢悬臂横梁托住箱梁；工字钢立柱 + 底板 + 地脚螺栓 + 混凝土基础 + X 斜撑。
//  全部构件在车辆通行包络之外（车道一侧完全敞开）。涂装带世界坐标脏污/流痕。
import * as THREE from 'three';

const HW = 2.1;          // 路面半宽
const BOX = 1.0;         // 箱梁高
const PLANES = [-4.6, -7.0];
const IN_A = -BOX - 0.45, OUT_A = -BOX - 3.9;   // 脊梁内/外弦（沿法向，负 = 路面背面）

// ---------------------------------------------------------------- 材质：工业涂装 + 脏污
export function grime(mat, { scale = 1, dirt = 0.22, streak = 0.3, rough = 0.25 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 gp = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\n gp = instanceMatrix * gp;\n#endif\n vGW = (modelMatrix * gp).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGW;
      float gh(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float gn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x), mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x), f.y),
                   mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x), mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x), f.y), f.z); }
      float gfbm(vec3 p){ return gn(p)*0.55 + gn(p*2.13)*0.28 + gn(p*4.7)*0.17; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 gp = vGW * ${(0.7 * scale).toFixed(3)};
        float gN = gfbm(gp);
        float gS = gn(vec3(vGW.x*${(4.0 * scale).toFixed(3)}, vGW.y*${(0.25 * scale).toFixed(3)}, vGW.z*${(4.0 * scale).toFixed(3)}));
        float gD = smoothstep(0.45, 0.9, gN) * ${dirt.toFixed(3)} + smoothstep(0.55, 1.0, gS) * ${streak.toFixed(3)};
        diffuseColor.rgb *= (1.0 - gD) * (0.93 + 0.14*gn(gp*7.0));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (gN-0.5)*${rough.toFixed(3)} + gD*0.35, 0.04, 1.0);`);
  };
  mat.customProgramCacheKey = () => 'grime' + scale + dirt + streak + rough;
  return mat;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  return t;
}
/** 由高度图（canvas 灰度）生成法线贴图 */
export function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const L = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / L * 0.5 + 0.5) * 255; d[i + 1] = (dy / L * 0.5 + 0.5) * 255; d[i + 2] = (1 / L * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
  return t;
}

// ---------------------------------------------------------------- 实例化构件
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
class Members {
  /** geo：单位长度沿 +Y、截面在 XZ 的几何；构件截面朝向：X ⟂ (轴, ref) */
  constructor(geo, mat) { this.geo = geo; this.mat = mat; this.list = []; }
  add(a, b, sx, sz, ref = _Z) { this.list.push([a.clone(), b.clone(), sx, sz, ref]); }
  build() {
    const m = new THREE.InstancedMesh(this.geo, this.mat, Math.max(1, this.list.length));
    const M = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), mid = new THREE.Vector3();
    this.list.forEach(([a, b, sx, sz, ref], i) => {
      Y.subVectors(b, a); const L = Y.length(); Y.normalize();
      X.crossVectors(Y, ref); if (X.lengthSq() < 1e-6) X.crossVectors(Y, Math.abs(Y.y) < 0.9 ? _Y : new THREE.Vector3(1, 0, 0)); X.normalize();
      Z.crossVectors(X, Y);
      mid.addVectors(a, b).multiplyScalar(0.5);
      M.set(X.x * sx, Y.x * L, Z.x * sz, mid.x, X.y * sx, Y.y * L, Z.y * sz, mid.y, X.z * sx, Y.z * L, Z.z * sz, mid.z, 0, 0, 0, 1);
      m.setMatrixAt(i, M);
    });
    m.count = this.list.length; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}
function boxGeo() { return new THREE.BoxGeometry(1, 1, 1); }
/** 工字钢：截面 宽 b(X) × 高 d(Z)，单位长度沿 Y（sx/sz 缩放用 1） */
function iBeamGeo(b, d, tf, tw) {
  const s = new THREE.Shape();
  s.moveTo(-b / 2, -d / 2); s.lineTo(b / 2, -d / 2); s.lineTo(b / 2, -d / 2 + tf); s.lineTo(tw / 2, -d / 2 + tf);
  s.lineTo(tw / 2, d / 2 - tf); s.lineTo(b / 2, d / 2 - tf); s.lineTo(b / 2, d / 2); s.lineTo(-b / 2, d / 2);
  s.lineTo(-b / 2, d / 2 - tf); s.lineTo(-tw / 2, d / 2 - tf); s.lineTo(-tw / 2, -d / 2 + tf); s.lineTo(-b / 2, -d / 2 + tf); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5); g.rotateX(-Math.PI / 2);   // 挤出方向 → +Y，截面在 XZ
  g.computeVertexNormals();
  return g;
}
/** 方钢管（带内壁，端口可见空心） */
function hssGeo(t) {
  const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.lineTo(-0.5, 0.5); s.closePath();
  const h = new THREE.Path(); const k = 0.5 - t; h.moveTo(-k, -k); h.lineTo(-k, k); h.lineTo(k, k); h.lineTo(k, -k); h.closePath(); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelThickness: 0.0, bevelSize: 0.03, bevelSegments: 2 });
  g.translate(0, 0, -0.5); g.rotateX(-Math.PI / 2);
  return g;
}

/** 沿采样点挤出矩形截面（a: 沿法向 n，b: 沿 z） */
function extrudeRect(samples, a0, a1, b0, b1, uvScale = 1, faces = 'nszZ') {
  const pos = [], nor = [], uv = [], idx = [];
  const F = { n: [[a1, b0], [a1, b1], 1], s: [[a0, b1], [a0, b0], -1], z: [[a0, b1], [a1, b1], 2], Z: [[a1, b0], [a0, b0], -2] };
  for (const k of faces) {
    const [[pa, pb], [qa, qb], nk] = F[k];
    const base = pos.length / 3;
    samples.forEach((sm, i) => {
      for (const [aa, bb] of [[pa, pb], [qa, qb]]) {
        pos.push(sm.p.x + sm.n.x * aa, sm.p.y + sm.n.y * aa, bb);
        if (nk === 1) nor.push(sm.n.x, sm.n.y, 0); else if (nk === -1) nor.push(-sm.n.x, -sm.n.y, 0); else nor.push(0, 0, nk > 0 ? 1 : -1);
      }
      const span = Math.abs(nk === 1 || nk === -1 ? b1 - b0 : a1 - a0);
      uv.push(0, sm.s * uvScale, span * uvScale, sm.s * uvScale);
      if (i > 0) { const q = base + (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function tubeAlong(samples, a, b, r, mat, step = 2) {
  const pts = samples.filter((_, i) => i % step === 0).map((sm) => sm.p.clone().addScaledVector(sm.n, a).setZ(b));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 8, false), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}

export function buildTrack(T) {
  const grp = new THREE.Group(); grp.name = 'track';
  const occluders = [];
  const s0 = T.S1 - 18, s1 = T.S_END;
  const samples = [];
  for (let s = s0; s <= s1 + 1e-6; s += 0.2) {
    const c = T.curve(Math.min(s, s1));
    samples.push({ s, p: new THREE.Vector3(c.x, c.y, 0), t: new THREE.Vector3(Math.cos(c.phi), Math.sin(c.phi), 0), n: new THREE.Vector3(-Math.sin(c.phi), Math.cos(c.phi), 0) });
  }
  const at = (sm, a, b) => sm.p.clone().addScaledVector(sm.n, a).setZ(b);

  // ---- 材质
  const plateH = document.createElement('canvas'); plateH.width = plateH.height = 512;
  { const g = plateH.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    // 防滑花纹（凸起的柳叶纹）
    for (let y = 0; y < 512; y += 32) for (let x = 0; x < 512; x += 32) { const o = (y / 32) % 2 ? 16 : 0; g.save(); g.translate(x + o, y + 16); g.rotate(((x + y) / 32) % 2 ? 0.78 : -0.78); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 11); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.scale(1, 0.28); g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill(); g.restore(); }
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 3); }
  const plateN = normalFromHeight(plateH, 3.5);
  const plateC = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3e4247'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const v = 60 + Math.random() * 40; g.fillStyle = `rgba(${v},${v + 3},${v + 7},0.3)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 2); }
    for (const cx of [0.28, 0.72]) { const gr = g.createLinearGradient(cx * w - 46, 0, cx * w + 46, 0); gr.addColorStop(0, 'rgba(10,10,10,0)'); gr.addColorStop(0.5, 'rgba(10,10,10,0.55)'); gr.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = gr; g.fillRect(cx * w - 46, 0, 92, h); }
    g.fillStyle = 'rgba(20,20,22,0.9)'; g.fillRect(0, 0, w, 3);
    g.fillStyle = 'rgba(232,180,30,0.85)'; g.fillRect(w / 2 - 4, 0, 8, h * 0.6);
  });
  plateN.repeat.set(1, 1);
  const deckMat = new THREE.MeshStandardMaterial({ map: plateC, normalMap: plateN, normalScale: new THREE.Vector2(0.8, 0.8), metalness: 0.6, roughness: 0.5, envMapIntensity: 0.35 });
  const deckSide = grime(new THREE.MeshStandardMaterial({ color: 0x4a5057, metalness: 0.72, roughness: 0.46, envMapIntensity: 0.3 }), { dirt: 0.25, streak: 0.35 });
  const spineMat = grime(new THREE.MeshStandardMaterial({ color: 0x565c64, metalness: 0.72, roughness: 0.44, envMapIntensity: 0.3 }), { dirt: 0.2, streak: 0.3 });
  const darkSteel = grime(new THREE.MeshStandardMaterial({ color: 0x33373c, metalness: 0.7, roughness: 0.5, envMapIntensity: 0.3 }), { dirt: 0.2, streak: 0.2 });
  const galv = grime(new THREE.MeshStandardMaterial({ color: 0x7a8087, metalness: 0.88, roughness: 0.36, envMapIntensity: 0.35 }), { scale: 2, dirt: 0.12, streak: 0.1 });
  const safety = new THREE.MeshStandardMaterial({ color: 0xb88a16, metalness: 0.2, roughness: 0.55 });
  const concrete = grime(new THREE.MeshStandardMaterial({ color: 0x96958f, roughness: 0.92 }), { scale: 1.5, dirt: 0.25, streak: 0.15, rough: 0.1 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xd2e6ff), emissiveIntensity: 2.4 });
  const ledWarm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xffb25a), emissiveIntensity: 2.2 });

  // ---- 箱梁：顶板 / 两侧腹板 / 底板
  const rampS = samples.filter((sm) => sm.s >= T.S1 - 6);
  {
    const top = new THREE.Mesh(extrudeRect(samples, -0.035, 0, -HW, HW, 1 / 2.4, 'n'), deckMat);
    // 顶面 UV：u 横向（0..1），v 沿 s
    const uv = top.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, i % 2);
    top.receiveShadow = true; top.castShadow = true; grp.add(top); occluders.push(top);
    const plate = new THREE.Mesh(extrudeRect(samples, -0.035, -0.001, -HW, HW, 0.4, 'zZ'), deckSide); plate.castShadow = true; grp.add(plate);
    for (const zs of [-1, 1]) {
      const web = new THREE.Mesh(extrudeRect(rampS, -BOX, -0.035, zs > 0 ? HW - 0.03 : -HW, zs > 0 ? HW : -HW + 0.03, 0.4, 'zZ'), deckSide);
      web.castShadow = true; web.receiveShadow = true; grp.add(web); occluders.push(web);
    }
    const bot = new THREE.Mesh(extrudeRect(rampS, -BOX - 0.03, -BOX, -HW - 0.08, HW + 0.08, 0.4, 'nszZ'), deckSide); bot.castShadow = true; bot.receiveShadow = true; grp.add(bot); occluders.push(bot);
  }
  // 腹板竖向加劲肋 + 底板横肋
  const ribs = new Members(boxGeo(), deckSide);
  for (let i = 0; i < rampS.length; i += 5) {
    const sm = rampS[i]; if (sm.p.y < 0.4 && sm.s < T.S1 + 2) continue;
    for (const zs of [-1, 1]) ribs.add(at(sm, -BOX, zs * (HW + 0.06)), at(sm, -0.04, zs * (HW + 0.06)), 0.05, 0.12, sm.n.clone().cross(_Z).negate());
    if (i % 10 === 0) ribs.add(at(sm, -BOX - 0.1, -HW - 0.08), at(sm, -BOX - 0.1, HW + 0.08), 0.06, 0.16, sm.n);
  }
  { const m = ribs.build(); grp.add(m); occluders.push(m); }

  // ---- 护栏：立柱 + 双道扶手 + 挡脚板 + LED 灯带
  const posts = new Members(boxGeo(), galv);
  for (let i = 0; i < rampS.length; i += 8) { const sm = rampS[i]; if (sm.s < T.S1 - 2) continue; for (const zs of [-1, 1]) posts.add(at(sm, 0, zs * (HW - 0.06)), at(sm, 0.56, zs * (HW - 0.06)), 0.06, 0.06, sm.t); }
  grp.add(posts.build());
  const railS = rampS.filter((sm) => sm.s >= T.S1 - 2);
  for (const zs of [-1, 1]) {
    grp.add(tubeAlong(railS, 0.56, zs * (HW - 0.06), 0.04, galv));
    grp.add(tubeAlong(railS, 0.3, zs * (HW - 0.06), 0.025, galv));
    const toe = new THREE.Mesh(extrudeRect(railS, 0, 0.16, zs > 0 ? HW - 0.1 : -HW + 0.08, zs > 0 ? HW - 0.08 : -HW + 0.1, 0.5, 'zZn'), safety); toe.castShadow = true; grp.add(toe);
    grp.add(tubeAlong(railS, 0.04, zs * (HW - 0.14), 0.016, ledMat));
    grp.add(tubeAlong(rampS.filter((sm) => sm.p.y > 0.6 || sm.s > T.S1 + 3), -BOX - 0.05, zs * (HW + 0.1), 0.022, zs < 0 ? ledWarm : ledMat));
  }

  // ---- 远侧双层脊梁桁架
  const frameS = samples.filter((sm) => sm.s > T.S1 + 1.5);
  const nodes = []; { let last = -1e9; for (const sm of frameS) if (sm.s - last >= 2.4) { nodes.push(sm); last = sm.s; } nodes.push(frameS[frameS.length - 1]); }
  const hss = hssGeo(0.06), chord = new Members(hss, spineMat), web = new Members(hss, spineMat), lace = new Members(boxGeo(), spineMat), gus = new Members(boxGeo(), darkSteel);
  const ok = (...ps) => ps.every((p) => p.y > 0.25);
  for (const z of PLANES) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const ia = at(a, IN_A, z), ib = at(b, IN_A, z), oa = at(a, OUT_A, z), ob = at(b, OUT_A, z);
      if (ok(ia, ib)) chord.add(ia, ib, 0.42, 0.42, _Z);
      if (ok(oa, ob)) chord.add(oa, ob, 0.42, 0.42, _Z);
      if (ok(ia, oa)) { web.add(ia, oa, 0.26, 0.26, _Z); gus.add(at(a, IN_A - 0.35, z), at(a, IN_A + 0.25, z), 0.75, 0.03, a.t); gus.add(at(a, OUT_A - 0.25, z), at(a, OUT_A + 0.35, z), 0.75, 0.03, a.t); }
      const d0 = i % 2 ? ia : oa, d1 = i % 2 ? ob : ib;
      if (ok(d0, d1)) lace.add(d0, d1, 0.16, 0.16, _Z);
    }
  }
  nodes.forEach((a, i) => {
    const i0 = at(a, IN_A, PLANES[0]), i1 = at(a, IN_A, PLANES[1]), o0 = at(a, OUT_A, PLANES[0]), o1 = at(a, OUT_A, PLANES[1]);
    if (ok(i0)) web.add(i0, i1, 0.2, 0.2, a.n);
    if (ok(o0)) web.add(o0, o1, 0.2, 0.2, a.n);
    if (i < nodes.length - 1) { const b = nodes[i + 1]; if (ok(i0, at(b, IN_A, 0))) lace.add(i0, at(b, IN_A, PLANES[1]), 0.1, 0.1, a.n); if (ok(o1, at(b, OUT_A, 0))) lace.add(o1, at(b, OUT_A, PLANES[0]), 0.1, 0.1, a.n); }
  });
  // ---- 工字钢悬臂横梁：箱梁底 → 脊梁内弦；斜撑：箱梁腹板底 → 外弦
  const ib = iBeamGeo(0.3, 0.42, 0.03, 0.018), cant = new Members(ib, darkSteel);
  nodes.forEach((a) => {
    const p0 = at(a, IN_A, HW + 0.1), p1 = at(a, IN_A, PLANES[1] - 0.2);
    if (ok(p0)) cant.add(p0, p1, 1, 1, a.n);
    const k0 = at(a, -BOX, -HW), k1 = at(a, OUT_A + 0.4, PLANES[0]);
    if (ok(k0, k1)) lace.add(k0, k1, 0.14, 0.14, a.t);
  });
  // ---- 立柱（工字钢，竖直落地）+ 底板 + 地脚螺栓 + 混凝土基础 + X 斜撑
  const colGeo = iBeamGeo(0.5, 0.5, 0.04, 0.025), cols = new Members(colGeo, spineMat);
  const plates = new Members(boxGeo(), darkSteel), bolts = new Members(new THREE.CylinderGeometry(1, 1, 1, 8), galv), braces = new Members(boxGeo(), darkSteel);
  const legNodes = nodes.filter((_, i) => i % 2 === 0).filter((a) => at(a, OUT_A, 0).y > 3.5);
  for (const z of PLANES) {
    const tops = legNodes.map((a) => at(a, OUT_A, z));
    tops.forEach((o) => {
      const foot = new THREE.Vector3(o.x, 0.55, z);
      cols.add(foot, o, 1, 1, _Z);
      plates.add(new THREE.Vector3(o.x, 0.5, z), new THREE.Vector3(o.x, 0.56, z), 0.8, 0.8, _Z);
      for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) bolts.add(new THREE.Vector3(o.x + dx, 0.52, z + dz), new THREE.Vector3(o.x + dx, 0.66, z + dz), 0.025, 0.025);
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), concrete); f.position.set(o.x, 0.25, z); f.receiveShadow = true; f.castShadow = true; grp.add(f);
    });
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1]; if (Math.abs(a.x - b.x) < 0.5) continue;
      const hy = Math.min(a.y, b.y);
      for (let y0 = 0.8; y0 < hy - 3; y0 += 5.5) {
        const y1 = Math.min(hy - 0.4, y0 + 5.5);
        braces.add(new THREE.Vector3(a.x, y0, z), new THREE.Vector3(b.x, y1, z), 0.12, 0.02, _Z);
        braces.add(new THREE.Vector3(b.x, y0, z), new THREE.Vector3(a.x, y1, z), 0.12, 0.02, _Z);
        braces.add(new THREE.Vector3(a.x, y1, z), new THREE.Vector3(b.x, y1, z), 0.18, 0.18, _Z);
      }
    }
  }
  // 两排立柱之间的横向联系
  legNodes.forEach((a) => { const o = at(a, OUT_A, 0); for (let y = 6; y < o.y - 2; y += 6) braces.add(new THREE.Vector3(o.x, y, PLANES[0]), new THREE.Vector3(o.x, y, PLANES[1]), 0.16, 0.16, _Y); });
  for (const b of [chord, web, lace, gus, cant, cols, plates, bolts, braces]) { const m = b.build(); grp.add(m); if (b !== bolts && b !== gus) occluders.push(m); }

  // ---- 顶端：端部挡块（黄黑斜纹）+ 琥珀频闪灯
  const endS = samples[samples.length - 1];
  const chev = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e8b21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let x = -h; x < w + h; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 0); g.lineTo(x + 20 - h, h); g.lineTo(x - h, h); g.fill(); } });
  const chevMat = new THREE.MeshStandardMaterial({ map: chev, roughness: 0.55 });
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, HW * 2), [darkSteel, darkSteel, darkSteel, darkSteel, chevMat, chevMat]);
  bump.position.copy(endS.p).addScaledVector(endS.n, 0.35); bump.rotation.y = Math.PI / 2; grp.add(bump);
  const strobes = [];
  for (const zs of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xffa020), emissiveIntensity: 0 }));
    m.position.copy(endS.p).addScaledVector(endS.n, -BOX - 0.2).setZ(zs * (HW + 0.1)); grp.add(m); strobes.push(m);
  }
  // 入坡钢板两侧黄黑警示边
  const chev2 = chev.clone(); chev2.needsUpdate = true; chev2.repeat.set(8, 1);
  for (const zs of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.3), new THREE.MeshStandardMaterial({ map: chev2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.x = -Math.PI / 2; m.position.set(-9, 0.012, zs * (HW + 0.18)); m.receiveShadow = true; grp.add(m); }

  return {
    group: grp, occluders, samples,
    update(t) { const on = (t * 1.6) % 1 < 0.12; for (const m of strobes) m.material.emissiveIntensity = on ? 40 : 0.4; },
  };
}
