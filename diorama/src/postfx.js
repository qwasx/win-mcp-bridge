import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/* ------------------------------------------------------------------ *
 *  アニメ調の輪郭線（深度＋法線のエッジ検出）
 * ------------------------------------------------------------------ */
export const OutlineShader = {
  name: 'ToonOutlineShader',
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uNear: { value: 0.1 },
    uFar: { value: 200 },
    uInk: { value: new THREE.Color(0x0a0c18) },
    uStrength: { value: 1.0 },
    uDepthBias: { value: 0.035 },
    uNormalBias: { value: 0.42 },
    uThickness: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform vec3 uInk;
    uniform float uStrength;
    uniform float uDepthBias;
    uniform float uNormalBias;
    uniform float uThickness;
    varying vec2 vUv;

    float viewDepth( vec2 uv ) {
      float d = texture2D( tDepth, uv ).x;
      float vz = ( uNear * uFar ) / ( ( uFar - uNear ) * d - uFar );
      return -vz;
    }
    vec3 nrm( vec2 uv ) {
      return texture2D( tNormal, uv ).xyz * 2.0 - 1.0;
    }

    float edges( float scale ) {
      vec2 o = uTexel * scale;
      float z0 = viewDepth( vUv );
      float z1 = viewDepth( vUv + vec2( o.x, 0.0 ) );
      float z2 = viewDepth( vUv - vec2( o.x, 0.0 ) );
      float z3 = viewDepth( vUv + vec2( 0.0, o.y ) );
      float z4 = viewDepth( vUv - vec2( 0.0, o.y ) );
      float dz = max( max( abs( z0 - z1 ), abs( z0 - z2 ) ), max( abs( z0 - z3 ), abs( z0 - z4 ) ) );
      float thr = clamp( z0 * uDepthBias, 0.012, 1.6 );
      float dEdge = smoothstep( thr, thr * 2.6, dz );

      vec3 n0 = nrm( vUv );
      vec3 n1 = nrm( vUv + vec2( o.x, 0.0 ) );
      vec3 n2 = nrm( vUv - vec2( o.x, 0.0 ) );
      vec3 n3 = nrm( vUv + vec2( 0.0, o.y ) );
      vec3 n4 = nrm( vUv - vec2( 0.0, o.y ) );
      float nd = max(
        max( 1.0 - dot( n0, n1 ), 1.0 - dot( n0, n2 ) ),
        max( 1.0 - dot( n0, n3 ), 1.0 - dot( n0, n4 ) )
      );
      float nEdge = smoothstep( uNormalBias, uNormalBias * 2.4, nd );
      return max( dEdge, nEdge );
    }

    void main() {
      vec4 base = texture2D( tDiffuse, vUv );
      float e = edges( 1.0 * uThickness );
      e = max( e, edges( 2.0 * uThickness ) * 0.85 );
      e = clamp( e * uStrength, 0.0, 1.0 );
      float lum = dot( base.rgb, vec3( 0.299, 0.587, 0.114 ) );
      vec3 ink = mix( base.rgb * 0.18, uInk, 0.58 + 0.25 * ( 1.0 - lum ) );
      gl_FragColor = vec4( mix( base.rgb, ink, e ), base.a );
    }
  `,
};

export function makeRenderTargets(width, height) {
  const depthTexture = new THREE.DepthTexture(width, height);
  depthTexture.format = THREE.DepthFormat;
  depthTexture.type = THREE.UnsignedIntType;
  depthTexture.minFilter = THREE.NearestFilter;
  depthTexture.magFilter = THREE.NearestFilter;

  const rtScene = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    depthTexture,
    colorSpace: THREE.LinearSRGBColorSpace,
  });

  const rtNormal = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });

  return { rtScene, rtNormal, depthTexture };
}

export function buildComposer(renderer, rtScene, rtNormal) {
  const composer = new EffectComposer(renderer);
  composer.renderToScreen = true;

  const texPass = new TexturePass(rtScene.texture);
  composer.addPass(texPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.62, // strength
    0.62, // radius
    0.72 // threshold
  );
  composer.addPass(bloom);

  const outline = new ShaderPass(OutlineShader);
  outline.uniforms.tNormal.value = rtNormal.texture;
  outline.uniforms.tDepth.value = rtScene.depthTexture;
  composer.addPass(outline);

  composer.addPass(new OutputPass());

  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);

  return { composer, bloom, outline, fxaa, texPass };
}
