import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  三渲二（トゥーン）マテリアル
 *  ・段階的なシェーディング（グラデーションマップ）
 *  ・リムライト（画面手前側の輪郭の冷たい光）
 *  ・簡易ヘミスフィア環境光
 *  ・地面用：濡れた路面の疑似的な反射＋雨だれの波紋
 * ------------------------------------------------------------------ */

export const MAX_LIGHTS = 12; // 路面反射に使う光源の最大数
export const MAX_RIPPLES = 14; // 同時に存在できる波紋の数

export const gU = {
  uTime: { value: 0 },
  uSky: { value: new THREE.Color(0x5b78bd) },
  uGround: { value: new THREE.Color(0x0b0f1a) },
  uHemi: { value: 0.42 },
  uRimColor: { value: new THREE.Color(0x9dc0ff) },
  uRimPower: { value: 2.4 },
  uLPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
  uLCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color()) },
  uLParam: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()) },
};

/* 段階的なトゥーン用グラデーション -------------------------------- */
function makeRamp(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    // coord = dotNL*0.5+0.5 : 裏面(dotNL<0) は 0、当たった側は段階的なトゥーン調
    if (t < 0.5) {
      data[i] = 0;
    } else {
      const u = (t - 0.5) * 2; // 0..1 on lit side
      data[i] = Math.round(Math.pow(u, 0.85) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const RAMP3 = makeRamp(3);
export const RAMP4 = makeRamp(4);
export const RAMP5 = makeRamp(5);

const WET_GLSL = /* glsl */ `
uniform sampler2D uPuddleMap;
uniform float uWet;
uniform float uRippleScale;

float wetHash(vec2 p){
  p = fract(p * vec2(127.31, 311.7));
  p += dot(p, p + 34.21);
  return fract(p.x * p.y);
}

float rainRipples(vec2 p, float t){
  float acc = 0.0;
  vec2 gp = p * uRippleScale;
  vec2 id = floor(gp);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 c = id + vec2(float(i), float(j));
      float h1 = wetHash(c + 3.1);
      float h2 = wetHash(c + 11.7);
      vec2 ctr = (c + 0.15 + vec2(h1, h2) * 0.7) / uRippleScale;
      float period = 1.15 + h1 * 0.9;
      float tt = mod(t * (0.8 + h2 * 0.5) + h2 * 9.0, period);
      float d = length(p - ctr);
      float r = tt * 0.36;
      float ring = (1.0 - smoothstep(0.0, 0.075, abs(d - r))) * (1.0 - tt / period);
      acc += ring * (1.0 - smoothstep(0.03, 0.34, d));
    }
  }
  return acc;
}

vec3 wetReflections(vec3 wpos, vec3 viewPos, float puddle){
  vec3 wv = normalize((vec4(viewPos, 0.0) * viewMatrix).xyz);
  vec2 fwd = normalize(wv.xz + vec2(0.0002, 0.0001));
  vec2 side = vec2(-fwd.y, fwd.x);
  vec3 refl = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 pr = uLParam[i];
    if (pr.w < 0.001) continue;
    vec3 lp = uLPos[i];
    vec2 dd = wpos.xz - lp.xz;
    float lat = dot(dd, side);
    float lon = dot(dd, fwd);
    float h = max(abs(lp.y - wpos.y), 0.4);
    float wob = sin(lon * 5.0 - uTime * 2.6 + lat * 4.0) * 0.5
              + sin(lat * 9.0 + uTime * 1.9 + float(i) * 1.7) * 0.5;
    float lw = max(pr.x * (1.0 + 0.22 * wob), 0.02);
    float ll = max(pr.y * h, 0.05);
    float a = exp(-(lat * lat) / (lw * lw));
    float b = exp(-(lon * lon) / (ll * ll));
    float flick = 0.84 + 0.16 * sin(uTime * 6.0 + float(i) * 2.3);
    refl += uLCol[i] * (a * b * pr.z * flick);
  }
  float rip = rainRipples(wpos.xz, uTime);
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    if (r.w < 0.001) continue;
    float age = uTime - r.z;
    if (age < 0.0 || age > 1.6) continue;
    float d = length(wpos.xz - r.xy);
    float rad = age * 0.40;
    rip += (1.0 - smoothstep(0.0, 0.11, abs(d - rad))) * (1.0 - age / 1.6) * r.w;
  }
  float pm = 0.22 + 0.78 * puddle;
  refl += vec3(0.42, 0.55, 0.78) * rip * 0.5 * pm;
  return refl * pm * (0.35 + 0.9 * puddle);
}
`;

/**
 * トゥーンマテリアル生成
 * opts:
 *   color / map / emissive / emissiveMap / emissiveIntensity
 *   rim      : リムライトの強さ
 *   rimColor : リムライトの色（既定は空色）
 *   ramp     : グラデーション（既定 RAMP4）
 *   wet      : 0 より大きいと濡れ反射が有効（地面用）
 *   puddleMap: 水たまりマスク
 */
export function toon(opts = {}) {
  const {
    color = 0xffffff,
    map = null,
    emissive = 0x000000,
    emissiveMap = null,
    emissiveIntensity = 1,
    roughness = 1,
    rim = 0.32,
    rimColor = null,
    rimPower = 2.4,
    ramp = RAMP4,
    wet = 0,
    puddleMap = null,
    rippleScale = 1.7,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    depthWrite = true,
    name = '',
  } = opts;

  const mat = new THREE.MeshToonMaterial({
    color,
    map,
    gradientMap: ramp,
    emissive,
    emissiveMap,
    emissiveIntensity,
    transparent,
    opacity,
    side,
    depthWrite,
  });
  mat.name = name;

  const u = {
    uRim: { value: rim },
    uRimTint: { value: new THREE.Color(rimColor ?? 0x9dc0ff) },
    uRimPow: { value: rimPower },
    uWet: { value: wet },
    uPuddleMap: { value: puddleMap },
    uRippleScale: { value: rippleScale },
  };
  mat.userData.u = u;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, gU, u);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;'
      );

    const wetDef = wet > 0 ? '#define WET 1\n' : '';

    shader.fragmentShader = wetDef + shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
uniform float uTime;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uHemi;
uniform float uRim;
uniform vec3 uRimTint;
uniform float uRimPow;
uniform vec3 uLPos[${MAX_LIGHTS}];
uniform vec3 uLCol[${MAX_LIGHTS}];
uniform vec4 uLParam[${MAX_LIGHTS}];
uniform vec4 uRipples[${MAX_RIPPLES}];
${wet > 0 ? WET_GLSL : ''}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef WET
        float wetMask = smoothstep(0.26, 0.92, texture2D(uPuddleMap, vWPos.xz * 0.0625 + 0.5).r) * uWet;
        diffuseColor.rgb *= mix(1.0, 0.55, wetMask);
#else
        float wetMask = 0.0;
#endif`
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `vec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
        vec3 hemiLight = mix( uGround, uSky, wn.y * 0.5 + 0.5 ) * uHemi;
        float rimF = pow( 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 ), uRimPow );
        vec3 rimLight = uRimTint * rimF * uRim;
        vec3 wetAdd = vec3( 0.0 );
        #ifdef WET
        wetAdd = wetReflections( vWPos, vViewPosition, wetMask );
        #endif
        vec3 outgoingLight = reflectedLight.directDiffuse
          + ( reflectedLight.indirectDiffuse + diffuseColor.rgb * hemiLight )
          + totalEmissiveRadiance + rimLight + wetAdd;`
      );

    if (!shader.fragmentShader.includes('rimLight') || !shader.vertexShader.includes('vWPos')) {
      console.warn('[toon] shader patch failed for material:', name);
    }
  };

  mat.customProgramCacheKey = () => `toonv1|${wet > 0 ? 'w' : 'd'}`;
  return mat;
}

/** 発光パネル（天井照明・灯箱など）：陰影なしの明るい面 */
export function glow(opts = {}) {
  const {
    map = null,
    color = 0xffffff,
    intensity = 1.35,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    name = 'glow',
  } = opts;
  const col = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.MeshBasicMaterial({
    color: col,
    map,
    transparent,
    opacity,
    side,
  });
  m.name = name;
  m.userData.baseColor = col.clone();
  m.userData.isGlow = true;
  return m;
}

/** ネオン看板など：トゥーンの質感を残しつつ強く発光させる */
export function neon(opts = {}) {
  const {
    color = 0x111111,
    map = null,
    emissive = 0xffffff,
    emissiveMap = null,
    emissiveIntensity = 1.5,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    rim = 0.1,
    name = '',
  } = opts;
  const m = toon({
    color,
    map,
    emissive,
    emissiveMap,
    emissiveIntensity,
    transparent,
    opacity,
    side,
    rim,
    name,
    ramp: RAMP3,
  });
  m.userData.isNeon = true;
  m.userData.flicker = null;
  return m;
}

/** ガラス（透明度低め・リム強め） */
export function glass(opts = {}) {
  const { color = 0xbcd6ff, opacity = 0.13, rim = 0.3, rimColor = 0xbcdcff, rimPower = 1.9 } = opts;
  const m = toon({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    rim,
    rimColor,
    rimPower,
    ramp: RAMP3,
    name: 'glass',
  });
  m.userData.isGlass = true;
  return m;
}

/* ------------------------------------------------------------------ *
 *  光源レジストリ（濡れた路面の反射に使う疑似的な光源リスト）
 * ------------------------------------------------------------------ */
const lightSources = [];

export function registerLightSource(pos, color, lateralWidth, lengthScale, intensity) {
  const item = {
    pos: new THREE.Vector3().copy(pos),
    color: new THREE.Color(color),
    lateralWidth,
    lengthScale,
    intensity,
    enabled: true,
  };
  lightSources.push(item);
  return item;
}

export function syncLightSources() {
  for (let i = 0; i < MAX_LIGHTS; i++) {
    const s = lightSources[i];
    if (s && s.enabled) {
      gU.uLPos.value[i].copy(s.pos);
      gU.uLCol.value[i].copy(s.color).multiplyScalar(s.intensity);
      gU.uLParam.value[i].set(s.lateralWidth, s.lengthScale, 1, 1);
    } else {
      gU.uLParam.value[i].set(0, 0, 0, 0);
    }
  }
}

export function getLightSources() {
  return lightSources;
}

/* 波紋（軒からの水滴など） ---------------------------------------- */
let rippleCursor = 0;
export function spawnRipple(x, z, time, strength = 1) {
  const arr = gU.uRipples.value;
  arr[rippleCursor].set(x, z, time, strength);
  rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
}
