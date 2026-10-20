// 冷气粒子：车底反推射流（落地铺开成贴地雾垫）、RCS 冷气脉冲；CPU 模拟 + Points 软精灵渲染。
// 亮度在 CPU 端按泛光灯光锥逐粒计算 → 雾穿过光束时被照亮。确定性随机数，seek 时可从头重放。
import * as THREE from 'three';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function smokeTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = rng(5);
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2, r = R() * S * 0.22, x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r, rr = S * (0.12 + R() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  const img = g.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2); const k = Math.pow(Math.max(0, 1 - d * d), 1.6); const i = (y * S + x) * 4 + 3; img.data[i] = Math.min(255, img.data[i] * k * 1.7); }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); return t;
}

export class ColdGas {
  constructor(scene, lights, cap = 22000, ceiling = null) {
    this.ceiling = ceiling;
    this.cap = cap; this.lights = lights;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3);
    this.age = new Float32Array(cap); this.life = new Float32Array(cap); this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap);
    this.a0 = new Float32Array(cap); this.drag = new Float32Array(cap); this.kind = new Uint8Array(cap); this.rot = new Float32Array(cap);
    this.n = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.litAttr = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.rotAttr = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr); geo.setAttribute('size', this.sizeAttr); geo.setAttribute('alpha', this.alphaAttr); geo.setAttribute('lit', this.litAttr); geo.setAttribute('rot', this.rotAttr);
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { map: { value: smokeTexture() }, scale: { value: 800 }, fogColor: { value: new THREE.Color(0x141920) }, fogDensity: { value: 0.0042 } },
      vertexShader: `attribute float size; attribute float alpha; attribute float lit; attribute float rot; uniform float scale; varying float vA; varying float vL; varying float vR; varying float vFog; uniform float fogDensity;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; gl_PointSize = clamp(size * scale / d, 1.0, 900.0); vA = alpha; vL = lit; vR = rot; vFog = 1.0 - exp(-fogDensity*fogDensity*d*d); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; varying float vA; varying float vL; varying float vR; varying float vFog;
        void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), co = cos(vR); c = mat2(co,-s,s,co)*c; vec4 t = texture2D(map, c + 0.5);
          vec3 col = vec3(0.92,0.95,1.0) * vL; col = mix(col, fogColor, vFog); gl_FragColor = vec4(col, t.a * vA); }`,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 8;
    scene.add(this.points);
    this.reset();
  }
  reset() { this.n = 0; this.R = rng(1234); this.acc = new Map(); }

  spawn(px, py, pz, vx, vy, vz, life, s0, s1, a0, drag, kind) {
    let i = this.n;
    if (i >= this.cap) { i = Math.floor(this.R() * this.cap); } else this.n++;
    this.p[i * 3] = px; this.p[i * 3 + 1] = py; this.p[i * 3 + 2] = pz;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.drag[i] = drag; this.kind[i] = kind; this.rot[i] = this.R() * 6.28;
  }

  /** 连续喷射：rate 粒/秒，按时间累计（保证不同帧率下一致） */
  emitJet(key, rate, dt, origin, dir, carVel, speed, spread, life, s0, s1, a0, kind = 0) {
    let acc = (this.acc.get(key) || 0) + rate * dt; const R = this.R;
    while (acc >= 1) {
      acc -= 1;
      const f = R(); // 沿本帧时间段均匀分布，避免成串
      const sp = speed * (0.75 + R() * 0.5);
      const ux = dir.x + (R() - 0.5) * spread * 2, uy = dir.y + (R() - 0.5) * spread * 2, uz = dir.z + (R() - 0.5) * spread * 2;
      const L = Math.hypot(ux, uy, uz) || 1;
      const vx = ux / L * sp + carVel.x, vy = uy / L * sp + carVel.y, vz = uz / L * sp + carVel.z;
      this.spawn(origin.x + vx * dt * f, origin.y + vy * dt * f, origin.z + vz * dt * f, vx, vy, vz, life * (0.7 + R() * 0.6), s0, s1 * (0.8 + R() * 0.4), a0, 3.2, kind);
    }
    this.acc.set(key, acc);
  }

  step(dt) {
    const p = this.p, v = this.v;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { // 删除：用最后一个填补
        const j = --this.n;
        if (i !== j) {
          p[i * 3] = p[j * 3]; p[i * 3 + 1] = p[j * 3 + 1]; p[i * 3 + 2] = p[j * 3 + 2];
          v[i * 3] = v[j * 3]; v[i * 3 + 1] = v[j * 3 + 1]; v[i * 3 + 2] = v[j * 3 + 2];
          this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.a0[i] = this.a0[j]; this.drag[i] = this.drag[j]; this.kind[i] = this.kind[j]; this.rot[i] = this.rot[j];
        }
        i--; continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k + 0.25 * dt; v[i * 3 + 2] *= k;   // 冷气略重：几乎不上浮
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      // 撞到坡道顶部路面底面（倒挂时车底喷流）：贴着路面向四周散开
      const C = this.ceiling;
      if (C && v[i * 3 + 1] > 0 && p[i * 3 + 1] > C.y && p[i * 3 + 1] < C.y + 0.9 && Math.abs(p[i * 3 + 2]) < C.hw && p[i * 3] > C.x0 && p[i * 3] < C.x1) {
        const vy = v[i * 3 + 1]; p[i * 3 + 1] = C.y;
        const a = this.R() * 6.283; v[i * 3] += Math.cos(a) * vy * 0.6; v[i * 3 + 2] += Math.sin(a) * vy * 0.6; v[i * 3 + 1] = -vy * 0.05;
      }
      // 撞地：垂直动量转为径向铺开（贴地雾垫）
      if (p[i * 3 + 1] < 0.12 && v[i * 3 + 1] < 0) {
        const vy = -v[i * 3 + 1]; p[i * 3 + 1] = 0.12;
        let hx = v[i * 3], hz = v[i * 3 + 2]; let hl = Math.hypot(hx, hz);
        if (hl < 1e-3) { const a = this.R() * 6.283; hx = Math.cos(a); hz = Math.sin(a); hl = 1; }
        const spread = vy * 0.75;
        v[i * 3] += hx / hl * spread; v[i * 3 + 2] += hz / hl * spread; v[i * 3 + 1] = vy * 0.06;
        if (this.kind[i] !== 2) { this.kind[i] = 2; this.drag[i] = 1.3; this.life[i] = Math.max(this.life[i], this.age[i] + 2.2 + this.R() * 1.6); this.s1[i] *= 1.4; this.a0[i] *= 0.6; }
      }
      this.rot[i] += dt * (this.kind[i] === 2 ? 0.25 : 0.8);
    }
  }

  upload() {
    const n = this.n, pa = this.posAttr.array, sa = this.sizeAttr.array, aa = this.alphaAttr.array, la = this.litAttr.array, ra = this.rotAttr.array;
    const L = this.lights;
    for (let i = 0; i < n; i++) {
      const x = this.p[i * 3], y = this.p[i * 3 + 1], z = this.p[i * 3 + 2];
      pa[i * 3] = x; pa[i * 3 + 1] = y; pa[i * 3 + 2] = z;
      const u = this.age[i] / this.life[i];
      sa[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(u);
      aa[i] = this.a0[i] * Math.min(1, u * 14) * Math.pow(1 - u, 1.4);
      // 光照：各泛光灯光锥内更亮
      let lit = 0.12;
      for (let k = 0; k < L.length; k++) {
        const l = L[k]; const dx = x - l.px, dy = y - l.py, dz = z - l.pz; const d = Math.hypot(dx, dy, dz) + 1e-3;
        const c = (dx * l.dx + dy * l.dy + dz * l.dz) / d;
        if (c > l.cos0) lit += l.k * Math.min(1, (c - l.cos0) / (l.cos1 - l.cos0)) * (1600 / (d * d + 400));
      }
      la[i] = Math.min(1.5, lit); ra[i] = this.rot[i];
    }
    this.posAttr.needsUpdate = this.sizeAttr.needsUpdate = this.alphaAttr.needsUpdate = this.litAttr.needsUpdate = this.rotAttr.needsUpdate = true;
    this.posAttr.clearUpdateRanges?.(); this.points.geometry.setDrawRange(0, n);
  }
}

/** 喷流核心：半透明白色锥体（高压冷气可见的"刀锋"段），长度随油门 */
export function makeJetCone() {
  const g = new THREE.ConeGeometry(0.22, 1, 24, 1, true); g.translate(0, -0.5, 0); // 顶点在原点，向 -y 延伸
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { strength: { value: 0 }, time: { value: 0 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform float strength; uniform float time; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float e = pow(abs(dot(vN, vV)), 1.8); float f = pow(1.0 - clamp(vY,0.0,1.0), 1.5); float shock = 0.8 + 0.2*sin(vY*38.0 - time*90.0);
        float a = strength * e * f * shock; gl_FragColor = vec4(vec3(0.85,0.92,1.0)*a, a); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 9; mesh.frustumCulled = false;
  return mesh;
}
