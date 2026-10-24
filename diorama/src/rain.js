import * as THREE from 'three';
import { spawnRipple } from './materials.js';
import { fx, plane } from './helpers.js';

/* ------------------------------------------------------------------ *
 *  雨・軒からの水滴・ガラスを伝う水滴
 * ------------------------------------------------------------------ */

const RAIN_COUNT = 2600;
const RAIN_SPAN = 12.0;

function blocked(x, z) {
  if (x > -4.7 && x < 4.8 && z > -6.5 && z < 1.75) return true; // 店舗＋ひさし
  if (x < -6.45 && z < 1.15) return true; // 建物A
  if (x > 5.1 && z < -4.45) return true; // 建物B
  return false;
}

export function buildRain(scene) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);

  const offsets = new Float32Array(RAIN_COUNT * 3);
  const speeds = new Float32Array(RAIN_COUNT);
  const scales = new Float32Array(RAIN_COUNT * 2);
  const seeds = new Float32Array(RAIN_COUNT);

  let i = 0;
  let guard = 0;
  while (i < RAIN_COUNT && guard < RAIN_COUNT * 40) {
    guard++;
    const x = -13 + Math.random() * 26;
    const z = -13 + Math.random() * 26;
    if (blocked(x, z)) continue;
    offsets[i * 3] = x;
    offsets[i * 3 + 1] = Math.random() * RAIN_SPAN;
    offsets[i * 3 + 2] = z;
    speeds[i] = 7.5 + Math.random() * 7.0;
    const depth = Math.random();
    const w = 0.012 + depth * 0.016;
    const l = 0.35 + depth * 0.85;
    scales[i * 2] = w;
    scales[i * 2 + 1] = l;
    seeds[i] = Math.random();
    i++;
  }

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 2));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.instanceCount = i;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpan: { value: RAIN_SPAN },
      uColor: { value: new THREE.Color(0xa8c8ee) },
      uOpacity: { value: 0.26 },
      uWind: { value: 0.2 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset;
      attribute float aSpeed;
      attribute vec2 aScale;
      attribute float aSeed;
      uniform float uTime;
      uniform float uSpan;
      uniform float uWind;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        vUv = uv;
        float y = mod( aOffset.y - uTime * aSpeed, uSpan );
        vec3 wp = vec3( aOffset.x, y, aOffset.z );
        vec4 mv = viewMatrix * vec4( wp, 1.0 );
        vec2 corner = position.xy * aScale;
        mv.x += corner.x + corner.y * uWind;
        mv.y += corner.y;
        gl_Position = projectionMatrix * mv;
        float depthFade = smoothstep( 1.0, 4.0, -mv.z ) * ( 1.0 - smoothstep( 18.0, 34.0, -mv.z ) );
        float topFade = 1.0 - smoothstep( uSpan * 0.82, uSpan, y );
        vFade = depthFade * topFade * ( 0.55 + 0.45 * aSeed );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFade;
      void main() {
        float x = abs( vUv.x - 0.5 ) * 2.0;
        float y = vUv.y;
        float a = 1.0 - smoothstep( 0.1, 1.0, x );
        a *= smoothstep( 0.0, 0.22, y ) * ( 1.0 - smoothstep( 0.6, 1.0, y ) );
        gl_FragColor = vec4( uColor, a * uOpacity * vFade );
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  fx(mesh);
  scene.add(mesh);
  return { mesh, mat };
}

/* ------------------------------------------------------------------ *
 *  軒からの水滴
 * ------------------------------------------------------------------ */
export function buildDrips(scene, canopy) {
  const N = 12;
  const geo = new THREE.SphereGeometry(0.028, 7, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xbcd8f5).multiplyScalar(1.25),
    transparent: true,
    opacity: 0.75,
  });
  const inst = new THREE.InstancedMesh(geo, mat, N);
  inst.frustumCulled = false;
  inst.renderOrder = 7;
  fx(inst);
  scene.add(inst);

  const dummy = new THREE.Object3D();
  const startY = canopy.y - 0.02;
  const bottomY = 0.16;
  const total = startY - bottomY;

  const items = [];
  for (let i = 0; i < N; i++) {
    items.push({
      x: canopy.x0 + ((canopy.x1 - canopy.x0) * (i + 0.5)) / N + (Math.random() - 0.5) * 0.12,
      z: canopy.z + (Math.random() - 0.5) * 0.05,
      pos: Math.random() * total,
      speed: 2.1 + Math.random() * 1.3,
    });
  }

  function update(t, dt) {
    for (let i = 0; i < N; i++) {
      const it = items[i];
      it.pos += dt * it.speed;
      if (it.pos >= total) {
        it.pos -= total;
        spawnRipple(it.x, it.z, t, 0.95);
      }
      const y = startY - it.pos;
      const k = THREE.MathUtils.clamp(it.pos / total, 0, 1);
      dummy.position.set(it.x, y, it.z);
      dummy.scale.set(1 - k * 0.28, 1 + k * 2.4, 1 - k * 0.28);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  return { inst, update };
}

/* ------------------------------------------------------------------ *
 *  ガラスを伝う雨水
 * ------------------------------------------------------------------ */
export function buildGlassRain(scene, panes) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xcfe4ff) },
      uOpacity: { value: 0.3 },
      uCols: { value: 10.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uCols;
      varying vec2 vUv;

      float hash( float x ) { return fract( sin( x * 127.1 ) * 43758.5453 ); }

      void main() {
        vec2 uv = vec2( vUv.x * uCols, vUv.y );
        float col = floor( uv.x );
        float h1 = hash( col * 1.73 + 2.0 );
        float h2 = hash( col * 3.31 + 7.0 );
        float speed = 0.06 + h2 * 0.16;
        float head = 1.0 - fract( h1 * 17.0 + uTime * speed );
        float dx = uv.x - col - 0.5;
        float dy = uv.y - head;

        float trail = ( 1.0 - smoothstep( 0.02, 0.28, abs( dx * ( 1.0 + dy * 1.5 ) ) ) )
                    * smoothstep( -0.02, 0.12, dy )
                    * ( 1.0 - smoothstep( 0.15, 0.85, dy ) );
        float d = length( vec2( dx * 2.2, dy * 1.05 ) );
        float drop = 1.0 - smoothstep( 0.02, 0.13, d );
        float a = trail * 0.42 + drop * 0.9;

        // 細かい水滴
        vec2 gv = vec2( vUv.x * uCols * 2.4, vUv.y * 9.0 );
        vec2 gid = floor( gv );
        float gh = hash( gid.x * 5.1 + gid.y * 13.7 );
        if ( gh > 0.86 ) {
          vec2 gc = ( fract( gv ) - 0.5 ) * vec2( 1.0, 0.55 );
          a += ( 1.0 - smoothstep( 0.06, 0.28, length( gc ) ) ) * 0.45;
        }
        a *= step( 0.06, h2 );
        gl_FragColor = vec4( uColor, clamp( a, 0.0, 1.0 ) * uOpacity );
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  for (const p of panes) {
    const w = p.x1 - p.x0;
    const h = p.y1 - p.y0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat.clone());
    m.material.uniforms.uCols.value = Math.max(4, Math.round(w * 2.6));
    m.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z + 0.03);
    m.renderOrder = 6;
    group.add(m);
  }
  fx(group);
  scene.add(group);
  return {
    update(t) {
      group.children.forEach((c) => (c.material.uniforms.uTime.value = t));
    },
  };
}
