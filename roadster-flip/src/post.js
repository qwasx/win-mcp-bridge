// 后期：RenderPass → UnrealBloom（夜间强光晕）→ OutputPass（ACES + sRGB）→ 直播机质感
// （径向色差、暗角、亮度相关颗粒、阴影偏青/高光偏暖、长焦边缘轻微软化）
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const Broadcast = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1920, 1080) }, ca: { value: 0.0022 }, grain: { value: 0.045 }, vig: { value: 0.32 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float ca; uniform float grain; uniform float vig; uniform float flash; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c,c);
      vec2 off = c * ca * (1.0 + r2*4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // 边缘轻微软化（长焦镜头像场弯曲）
      vec2 px = 1.0/res; float soft = smoothstep(0.12, 0.42, r2);
      vec3 blur = (texture2D(tDiffuse, vUv+vec2(px.x,0.0)*2.0).rgb + texture2D(tDiffuse, vUv-vec2(px.x,0.0)*2.0).rgb + texture2D(tDiffuse, vUv+vec2(0.0,px.y)*2.0).rgb + texture2D(tDiffuse, vUv-vec2(0.0,px.y)*2.0).rgb)*0.25;
      col = mix(col, blur, soft*0.55);
      float L = dot(col, vec3(0.2126,0.7152,0.0722));
      // 调色：阴影偏青、高光偏暖，黑位微抬（广播机）
      col = mix(col, col*vec3(0.92,1.0,1.08), (1.0-smoothstep(0.0,0.35,L))*0.6);
      col = mix(col, col*vec3(1.05,1.0,0.94), smoothstep(0.5,1.0,L)*0.5);
      col = col*0.985 + 0.012;
      col *= 1.0 - vig * smoothstep(0.08, 0.55, r2*1.6);
      float n = hash(vUv*res + fract(time*61.0)*vec2(97.0,57.0)) - 0.5;
      col += n * grain * (1.15 - L);
      col += flash;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function buildPost(renderer, scene, camera) {
  const rt = new THREE.WebGLRenderTarget(1920, 1080, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.5, 0.5, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const bc = new ShaderPass(Broadcast); composer.addPass(bc);
  return {
    composer, bloom, bc,
    setSize(w, h) { composer.setSize(w, h); bc.uniforms.res.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); },
    render(t) { bc.uniforms.time.value = t; composer.render(); },
  };
}
