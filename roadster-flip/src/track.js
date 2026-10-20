// 巨大的金属 C 形坡道：钢板路面 + 护墙扶手 + LED 灯带 + 箱形主梁；两侧 C 形桁架（z = ±5.2）
// 由竖腿落地、横梁吊住路面——所有构件都在车的通行包络之外。顶端：端部挡块与琥珀色频闪灯。
import * as THREE from 'three';

const HALF_W = 2.1, TH = 0.34, WALL = 0.55;

class Beams {
  constructor(mat, r, seg = 8) { this.mat = mat; this.r = r; this.seg = seg; this.list = []; }
  add(a, b, r) { this.list.push([a.clone(), b.clone(), r ?? this.r]); }
  build() {
    const geo = new THREE.CylinderGeometry(1, 1, 1, this.seg, 1, false);
    const m = new THREE.InstancedMesh(geo, this.mat, this.list.length);
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), mat = new THREE.Matrix4(), d = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
    this.list.forEach(([a, b, r], i) => {
      d.subVectors(b, a); const L = d.length(); d.normalize();
      q.setFromUnitVectors(up, d); mid.addVectors(a, b).multiplyScalar(0.5); sc.set(r, L, r);
      mat.compose(mid, q, sc); m.setMatrixAt(i, mat);
    });
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/** 沿采样点挤出矩形截面（a: 沿法向 n，b: 沿 z），四个面各自成条带（硬边） */
function extrudeRect(samples, a0, a1, b0, b1, uvScale = 1) {
  const pos = [], nor = [], uv = [], idx = [];
  const faces = [
    [[a1, b0], [a1, b1], 'n'], [[a0, b1], [a0, b0], '-n'], [[a0, b1], [a1, b1], 'z'], [[a1, b0], [a0, b0], '-z'],
  ];
  for (const [[pa, pb], [qa, qb], nk] of faces) {
    const base = pos.length / 3;
    samples.forEach((sm, i) => {
      for (const [aa, bb] of [[pa, pb], [qa, qb]]) {
        pos.push(sm.p.x + sm.n.x * aa, sm.p.y + sm.n.y * aa, bb);
        const N = nk === 'n' ? sm.n : nk === '-n' ? sm.n.clone().negate() : nk === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);
        nor.push(N.x, N.y, N.z);
      }
      uv.push(sm.s * uvScale, 0, sm.s * uvScale, 1);
      if (i > 0) { const k = base + (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildTrack(T) {
  const grp = new THREE.Group(); grp.name = 'track';
  const occluders = [];
  const s0 = T.S1 - 18, s1 = T.S_END;
  const samples = [];
  for (let s = s0; s <= s1 + 1e-6; s += 0.25) {
    const c = T.curve(Math.min(s, s1));
    samples.push({ s, p: new THREE.Vector3(c.x, c.y, 0), t: new THREE.Vector3(Math.cos(c.phi), Math.sin(c.phi), 0), n: new THREE.Vector3(-Math.sin(c.phi), Math.cos(c.phi), 0), phi: c.phi });
  }

  // ---- 材质
  const plateTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3d4146'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 50 + Math.random() * 30; g.fillStyle = `rgba(${v},${v + 3},${v + 6},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1 + Math.random() * 2); }
    // 防滑菱形纹
    g.strokeStyle = 'rgba(120,126,134,0.28)'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < w; x += 24) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4 * ((x + y) % 48 ? 1 : -1)); g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.stroke(); g.restore(); }
    // 板缝
    g.strokeStyle = 'rgba(10,12,14,0.85)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 2); g.lineTo(w, 2); g.stroke();
    // 轮迹（深色橡胶）
    for (const cx of [0.27, 0.73]) { const gr = g.createLinearGradient(cx * w - 50, 0, cx * w + 50, 0); gr.addColorStop(0, 'rgba(15,15,15,0)'); gr.addColorStop(0.5, 'rgba(15,15,15,0.5)'); gr.addColorStop(1, 'rgba(15,15,15,0)'); g.fillStyle = gr; g.fillRect(cx * w - 50, 0, 100, h); }
    // 中心黄线
    g.fillStyle = 'rgba(230,180,40,0.75)'; g.fillRect(w / 2 - 5, 0, 10, h * 0.55);
  });
  plateTex.repeat.set(1, 1);
  const deckMat = new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x777d86, metalness: 0.8, roughness: 0.42, envMapIntensity: 0.35 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.75, roughness: 0.5, envMapIntensity: 0.3 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.9 });

  // ---- 路面：顶面用板纹贴图（u 沿 s，v 横向）
  {
    const g = new THREE.BufferGeometry(); const pos = [], nor = [], uv = [], idx = [];
    samples.forEach((sm, i) => {
      for (const z of [-HALF_W, HALF_W]) { pos.push(sm.p.x, sm.p.y, z); nor.push(sm.n.x, sm.n.y, 0); uv.push((z + HALF_W) / (2 * HALF_W), sm.s / 2.4); }
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const top = new THREE.Mesh(g, deckMat); top.receiveShadow = true; top.castShadow = true; grp.add(top); occluders.push(top);
    // 路面板厚（底面与侧面）
    const slab = new THREE.Mesh(extrudeRect(samples, -TH, -0.002, -HALF_W, HALF_W, 0.4), steelDark); slab.castShadow = true; slab.receiveShadow = true; grp.add(slab); occluders.push(slab);
  }
  // ---- 护墙（坡道段，地面段不设）+ 扶手 + LED 灯带
  const rampSamples = samples.filter((sm) => sm.s >= T.S1 - 4);
  for (const zs of [-1, 1]) {
    const z0 = zs * HALF_W, z1 = zs * (HALF_W + 0.06);
    const wall = new THREE.Mesh(extrudeRect(rampSamples, 0, WALL, Math.min(z0, z1), Math.max(z0, z1), 0.5), steel); wall.castShadow = true; wall.receiveShadow = true; grp.add(wall);
    const railPts = rampSamples.filter((_, i) => i % 2 === 0).map((sm) => sm.p.clone().addScaledVector(sm.n, WALL + 0.04).setZ(zs * (HALF_W + 0.03)));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), railPts.length * 2, 0.055, 8, false), steel); rail.castShadow = true; grp.add(rail);
    const ledPts = rampSamples.filter((_, i) => i % 2 === 0).map((sm) => sm.p.clone().addScaledVector(sm.n, 0.05).setZ(zs * (HALF_W - 0.04)));
    const led = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ledPts), ledPts.length * 2, 0.02, 6, false), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xcfe6ff), emissiveIntensity: 3.2 }));
    grp.add(led);
  }
  // ---- 箱形主梁（路面背面，两根）
  const girderSamples = samples.filter((sm) => sm.p.y > 0.5 || sm.s > T.S1);
  for (const zs of [-1, 1]) {
    const g = new THREE.Mesh(extrudeRect(girderSamples, -TH - 0.85, -TH, zs * 1.45 - 0.18, zs * 1.45 + 0.18, 0.5), steelDark);
    g.castShadow = true; g.receiveShadow = true; grp.add(g); occluders.push(g);
  }

  // ---- 远侧单侧脊梁：双层 C 形桁架（z = -4.4 / -6.8），横梁从路面背面伸过去；近侧完全敞开，不挡镜头
  const big = new Beams(steel, 0.17, 10), mid = new Beams(steel, 0.09, 8), thin = new Beams(steelDark, 0.05, 6);
  const frameS = samples.filter((sm) => sm.p.y > 1.4 || (sm.s > T.S1 + 4));
  const pick = (step) => { const out = []; let last = -1e9; for (const sm of frameS) if (sm.s - last >= step) { out.push(sm); last = sm.s; } out.push(frameS[frameS.length - 1]); return out; };
  const nodes = pick(2.4);
  const PL = [-4.4, -6.8];
  const inner = (sm, z) => sm.p.clone().addScaledVector(sm.n, -1.25).setZ(z);
  const outer = (sm, z) => sm.p.clone().addScaledVector(sm.n, -4.2).setZ(z);
  for (const z of PL) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      big.add(inner(a, z), inner(b, z), 0.2); big.add(outer(a, z), outer(b, z), 0.2);
      mid.add(inner(a, z), outer(a, z));
      thin.add(i % 2 ? inner(a, z) : outer(a, z), i % 2 ? outer(b, z) : inner(b, z), 0.07);
    }
  }
  nodes.forEach((a, i) => {
    // 两层桁架之间的联系杆
    mid.add(inner(a, PL[0]), inner(a, PL[1])); mid.add(outer(a, PL[0]), outer(a, PL[1]));
    if (i < nodes.length - 1) { const b = nodes[i + 1]; thin.add(inner(a, PL[0]), inner(b, PL[1])); thin.add(outer(a, PL[1]), outer(b, PL[0])); }
    // 悬臂横梁：两根主梁底部 → 内弦（全部在路面背面，即车道外侧）
    const gFar = a.p.clone().addScaledVector(a.n, -TH - 0.85).setZ(-1.45), gNear = a.p.clone().addScaledVector(a.n, -TH - 0.85).setZ(1.45);
    big.add(gFar, inner(a, PL[0]), 0.13);
    if (i % 2 === 0) { mid.add(gNear, gFar, 0.08); thin.add(gNear, outer(a, PL[0]), 0.06); }
    // 竖腿：外弦节点落地（高于 3 m 的节点，每隔一个）
    if (i % 2 === 0) for (const z of PL) {
      const o = outer(a, z);
      if (o.y < 3) continue;
      const foot = new THREE.Vector3(o.x, 0, z - 1.0);
      big.add(o, foot, 0.24);
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), concrete); f.position.set(foot.x, 0.25, foot.z); f.receiveShadow = true; f.castShadow = true; grp.add(f);
    }
  });
  // 腿间 X 斜撑
  for (const z of PL) {
    const legs = nodes.filter((_, i) => i % 2 === 0).map((sm) => outer(sm, z)).filter((o) => o.y >= 3);
    for (let i = 0; i < legs.length - 1; i++) {
      const a = legs[i], b = legs[i + 1], hy = Math.min(a.y, b.y) * 0.55;
      thin.add(new THREE.Vector3(a.x, 0.4, z - 1.0), new THREE.Vector3(b.x, hy, z - 0.45), 0.06);
      thin.add(new THREE.Vector3(b.x, 0.4, z - 1.0), new THREE.Vector3(a.x, hy, z - 0.45), 0.06);
    }
  }
  for (const b of [big, mid, thin]) { const m = b.build(); grp.add(m); occluders.push(m); }

  // ---- 顶端：端部挡块（黄黑斜纹）+ 琥珀频闪灯
  const endS = samples[samples.length - 1];
  const chev = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e8b21a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let x = -h; x < w + h; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 0); g.lineTo(x + 20 - h, h); g.lineTo(x - h, h); g.fill(); } });
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, HALF_W * 2), [steelDark, steelDark, steelDark, steelDark, new THREE.MeshStandardMaterial({ map: chev, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: chev, roughness: 0.6 })]);
  bump.position.copy(endS.p).addScaledVector(endS.n, 0.3); bump.rotation.y = Math.PI / 2; grp.add(bump);
  const strobes = [];
  for (const zs of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0xffa020), emissiveIntensity: 0 }));
    m.position.copy(endS.p).addScaledVector(endS.n, -TH - 0.2).setZ(zs * (HALF_W + 0.1)); grp.add(m); strobes.push(m);
  }
  // 地面段：入坡钢板两侧的黄黑警示边
  const edgeMat = new THREE.MeshStandardMaterial({ map: chev, roughness: 0.7 });
  for (const zs of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.3), edgeMat); m.rotation.x = -Math.PI / 2; m.position.set(-9, 0.012, zs * (HALF_W + 0.18)); chev.repeat.set(6, 1); grp.add(m); }

  return {
    group: grp, occluders, samples,
    update(t) { const on = (t * 1.6) % 1 < 0.12; for (const m of strobes) m.material.emissiveIntensity = on ? 40 : 0.4; },
    strobes,
  };
}
