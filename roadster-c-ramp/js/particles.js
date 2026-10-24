// particles.js — GPU 点精灵粒子池（冷气/雾/尘土/火花），加色混合
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 2400) {
    this.max = max; this.head = 0;
    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max); this.g = new Float32Array(max); this.dr = new Float32Array(max);
    this.life.fill(-1);

    this.aPos = new Float32Array(max * 3);
    this.aCol = new Float32Array(max * 3);
    this.aSize = new Float32Array(max);
    this.aAlp = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.aCol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.aAlp, 1));
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 800 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC; uniform float uScale;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(110.0, aSize * uScale / max(0.6, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){
          float d = distance(gl_PointCoord, vec2(0.5));
          float a = smoothstep(0.5, 0.05, d) * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vC, a);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.head; this.head = (i + 1) % this.max;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = o.life;
    this.s0[i] = o.s0; this.s1[i] = o.s1 ?? o.s0;
    this.a0[i] = o.a; this.g[i] = o.grav ?? 0; this.dr[i] = o.drag ?? 0;
    const j = i * 3;
    this.aCol[j] = o.r; this.aCol[j + 1] = o.gcol; this.aCol[j + 2] = o.b;
  }

  update(dt) {
    const n = this.max;
    for (let i = 0; i < n; i++) {
      if (this.life[i] < 0) { this.aAlp[i] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.life[i] = -1; this.aAlp[i] = 0; continue; }
      const f = Math.max(0, 1 - this.dr[i] * dt);
      this.vx[i] *= f; this.vz[i] *= f;
      this.vy[i] = this.vy[i] * f + this.g[i] * dt;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      const j = i * 3;
      this.aPos[j] = this.px[i]; this.aPos[j + 1] = this.py[i]; this.aPos[j + 2] = this.pz[i];
      this.aSize[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.aAlp[i] = this.a0[i] * Math.pow(1 - t, 1.35);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }

  // 点精灵世界尺寸 → 像素换算
  setScale(camera, hPx) {
    const f = hPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.mat.uniforms.uScale.value = f;
  }
}
