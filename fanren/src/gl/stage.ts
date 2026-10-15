// WebGL2 合成舞台：
//   1. 把 Canvas2D 绘制的世界当作纹理上传；
//   2. 特效批次画进 HDR 帧缓冲（加色发光 + 墨色覆盖），并做多级泛光；
//   3. 一次全屏后期：冲击波扭曲、昼夜调色、神识圈外“记忆水墨”、云影/迷雾、天气、纸纹、暗角、受伤血晕。
// 旧版需要 8~10 次全屏 Canvas2D 合成，现在合为一次着色器，移动端也能流畅。
import { Batch, FLOATS } from './batch';
import { buildAtlas } from './atlas';

const VS_SPRITE = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUv; layout(location=2) in vec4 aCol;
uniform vec2 uRes; out vec2 vUv; out vec4 vCol;
void main(){ vUv=aUv; vCol=aCol; vec2 c=aPos/uRes*2.0-1.0; gl_Position=vec4(c.x,-c.y,0.0,1.0); }`;
const FS_SPRITE = `#version 300 es
precision mediump float; uniform sampler2D uTex; in vec2 vUv; in vec4 vCol; out vec4 o;
void main(){ vec4 t=texture(uTex,vUv); o=vec4(vCol.rgb*t.rgb, vCol.a*t.a); }`;
const VS_FULL = `#version 300 es
out vec2 vUv; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;
// 降采样：4 次双线性采样 = 4×4 盒式平均
const FS_DOWN = `#version 300 es
precision mediump float; uniform sampler2D uTex; uniform vec2 uTexel; in vec2 vUv; out vec4 o;
void main(){ vec2 d=uTexel; o=0.25*(texture(uTex,vUv+vec2(-d.x,-d.y))+texture(uTex,vUv+vec2(d.x,-d.y))+texture(uTex,vUv+vec2(-d.x,d.y))+texture(uTex,vUv+vec2(d.x,d.y))); }`;
// 9 抽头高斯（利用线性过滤只需 5 次采样）
const FS_BLUR = `#version 300 es
precision mediump float; uniform sampler2D uTex; uniform vec2 uDir; in vec2 vUv; out vec4 o;
void main(){ vec4 c=texture(uTex,vUv)*0.2270270270;
 c+=texture(uTex,vUv+uDir*1.3846153846)*0.3162162162; c+=texture(uTex,vUv-uDir*1.3846153846)*0.3162162162;
 c+=texture(uTex,vUv+uDir*3.2307692308)*0.0702702703; c+=texture(uTex,vUv-uDir*3.2307692308)*0.0702702703; o=c; }`;

const FS_POST = `#version 300 es
precision highp float;
uniform sampler2D uScene, uFx, uB1, uB2, uAtmo, uNoise;
uniform vec2 uRes; uniform float uDpr; uniform float uT;
uniform vec4 uShock[6]; uniform int uNShock;
uniform vec3 uMul; uniform float uWarm; uniform float uDusk;
uniform vec4 uSense; uniform vec3 uSenseInk; uniform vec3 uSenseGlow; uniform float uSenseHide; uniform float uAlarm;
uniform vec4 uAtmoRect; uniform float uAtmoOn;
uniform vec4 uFog; uniform float uFogBands; uniform vec4 uFlash; uniform vec4 uTint;
uniform float uVig, uHurt, uFade, uAberr, uBloomK, uGrain, uSat;
in vec2 vUv; out vec4 o;

float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec3 softLight(vec3 b, vec3 s){
  vec3 d = mix(((16.0*b-12.0)*b+4.0)*b, sqrt(b), step(0.25,b));
  return mix(b-(1.0-2.0*s)*b*(1.0-b), b+(2.0*s-1.0)*(d-b), step(0.5,s));
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // 设备像素，左上为原点
  vec2 q = px;
  // 冲击波：沿径向推挤画面
  for(int i=0;i<6;i++){ if(i>=uNShock) break; vec4 s=uShock[i]; vec2 d=q-s.xy; float L=length(d)+1e-3;
    float w=s.z*0.18+18.0*uDpr; float k=exp(-pow((L-s.z)/w,2.0)); q-=d/L*k*s.w; }
  vec2 uv = q/uRes;
  vec3 c;
  if(uAberr>0.001){ vec2 off=(uv-0.5)*uAberr*0.012; c=vec3(texture(uScene,uv+off).r, texture(uScene,uv).g, texture(uScene,uv-off).b); }
  else c=texture(uScene,uv).rgb;
  // —— 昼夜调色
  c *= uMul;
  if(uWarm>0.001) c = mix(c, softLight(c, vec3(1.0,0.925,0.77)), uWarm);
  if(uDusk>0.001){ float g=clamp((uv.x+uv.y*0.6)/1.6,0.0,1.0);
    vec3 dc = mix(vec3(1.0,0.667,0.314), vec3(1.0,0.47,0.35), g); float da=mix(0.75,0.2,g)*uDusk;
    c = mix(c, softLight(c, dc), da);
    float sd = length((uv-vec2(0.1,-0.1))*vec2(uRes.x/max(uRes.x,uRes.y),uRes.y/max(uRes.x,uRes.y)))/1.1;
    vec3 sc = vec3(1.0,0.667,0.353)*0.3*uDusk*clamp(1.0-sd,0.0,1.0); c = 1.0-(1.0-c)*(1.0-sc); }
  // —— 神识圈外：记忆水墨（灰、淡、留白，边缘晕染流动）
  if(uSense.w>0.5){
    vec2 dp=px-uSense.xy; float dist=length(dp); float R=max(uSense.z,1.0);
    float ang=atan(dp.y,dp.x);
    // 边缘起伏只与角度有关：整数倍频的正弦叠加，首尾无缝且极省
    float n=0.5*sin(3.0*ang+uT*0.21)+0.3*sin(7.0*ang-uT*0.33+1.7)+0.2*sin(13.0*ang+uT*0.47+0.6)+0.12*sin(23.0*ang-uT*0.61);
    float edge=R*(1.0+n*0.028);
    float soft=R*0.055+6.0*uDpr;
    float m=smoothstep(edge-soft*0.5, edge+soft, dist);
    if(m>0.001){
      float lum=dot(c,vec3(0.299,0.587,0.114));
      vec3 paper=vec3(0.925,0.895,0.82);
      float ink=pow(1.0-lum,1.25);
      vec3 mem=mix(paper, vec3(0.20,0.20,0.19), ink*0.78);
      float fib=texture(uNoise, px/uDpr*vec2(0.004,0.016)).r;
      mem-=fib*0.035;
      c=mix(c, mem, m*(1.0-uSat));
    }
    float bd=abs(dist-edge);
    if(bd<soft*3.0){
      // 晕染墨丝：紧贴边缘外侧缓缓流动
      float band=exp(-pow((dist-edge-soft*0.35)/(soft*0.55),2.0));
      float fil=texture(uNoise, vec2(ang*1.43, dist/R*1.2-uT*0.04)).g;
      float inkA=band*smoothstep(0.45,0.8,fil)*0.42*(1.0-uSenseHide*0.6);
      c=mix(c, uSenseInk*0.55, inkA);
      // 圈内边缘一抹灵光（随时间呼吸）
      float inner=exp(-pow((dist-edge+soft*0.9)/(soft*1.2),2.0))*(1.0-m);
      c+=uSenseGlow*inner*(0.07+0.03*sin(uT*1.3))*(1.0-uSenseHide*0.7);
      if(uAlarm>0.001){ float ab=exp(-pow((dist-edge)/(soft*1.6),2.0)); c=mix(c, vec3(0.75,0.12,0.08), ab*uAlarm*(0.5+0.5*sin(uT*12.0))*0.6); }
    }
  }
  // —— 云影 / 未探索迷雾（低分辨率层）
  if(uAtmoOn>0.5){ vec2 au=(px-uAtmoRect.xy)/uAtmoRect.zw; vec4 a=texture(uAtmo,au); c=c*(1.0-a.a)+a.rgb; }
  // —— 天气
  if(uFogBands>0.001){ float b=0.0; for(int i=0;i<4;i++){ float y=0.2+float(i)*0.22+sin(uT*0.1+float(i))*0.02; b+=exp(-pow((uv.y-y)/0.12,2.0)); }
    float nn=texture(uNoise, vec2(uv.x*0.6+uT*0.006, uv.y*1.2)).b; c=mix(c, vec3(0.925,0.925,0.9), clamp(b*0.32*uFogBands*(0.6+nn*0.8),0.0,1.0)); }
  c=mix(c, uFog.rgb, uFog.a);
  c=mix(c, uTint.rgb, uTint.a);
  // —— 特效与泛光（不受夜色压暗）
  vec2 fuv=gl_FragCoord.xy/uRes;
  vec4 fx=texture(uFx,fuv);
  // 柔和压高光：保留色相，避免叠加发白成团
  float mx=max(max(fx.r,fx.g),fx.b);
  vec3 fr=fx.rgb/(1.0+max(mx-0.75,0.0)*0.9);
  c=c*(1.0-clamp(fx.a,0.0,1.0))+fr;
  vec3 bl=texture(uB1,fuv).rgb*0.6+texture(uB2,fuv).rgb*0.7;
  c+=bl*uBloomK;
  c=mix(c, uFlash.rgb, uFlash.a);
  // —— 纸纹、暗角、血晕、黑场
  float gr=h21(floor(px/uDpr*0.7));
  c*=1.0-uGrain*(gr*gr)*0.12;
  vec2 vv=(uv-0.5)*vec2(1.0, uRes.y/uRes.x)*1.0; float vd=length((uv-0.5)*1.25);
  float vig=smoothstep(0.42,0.95,vd);
  c=mix(c, vec3(0.157,0.118,0.078), vig*0.30*uVig);
  if(uHurt>0.001) c=mix(c, vec3(0.47,0.04,0.04), smoothstep(0.3,0.95,vd)*uHurt);
  c=mix(c, vec3(0.04,0.031,0.024), uFade);
  o=vec4(c,1.0);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader'); return sh; };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const U = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (n: string) => { if (!U.has(n)) U.set(n, gl.getUniformLocation(p, n)); return U.get(n)!; } };
}
type Prog = ReturnType<typeof compile>;

interface Target { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export interface PostParams {
  t: number;
  mul: [number, number, number]; warm: number; dusk: number;
  sense: { x: number; y: number; R: number; on: boolean; ink: [number, number, number]; glow: [number, number, number]; hide: number; alarm: number };
  atmo: { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null;
  fog: [number, number, number, number]; fogBands: number; flash: [number, number, number, number]; tint: [number, number, number, number];
  vig: number; hurt: number; fade: number; aberr: number; bloom: number; grain: number;
  shocks: { x: number; y: number; r: number; amp: number }[];
  sat: number; // 1 = 圈外也不褪色（调试全图）
}

export class GLStage {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  batch = new Batch();
  atlas!: WebGLTexture;
  private sprite!: Prog; private post!: Prog; private down!: Prog; private blur!: Prog;
  private vbo!: WebGLBuffer; private vao!: WebGLVertexArrayObject; private emptyVao!: WebGLVertexArrayObject;
  private noiseTex!: WebGLTexture;
  private sceneTex!: WebGLTexture; private atmoTex!: WebGLTexture;
  private sceneW = 0; private sceneH = 0; private atmoW = 0; private atmoH = 0;
  private fx: Target | null = null; private h1: Target | null = null; private q1: Target | null = null; private q2: Target | null = null; private e1: Target | null = null; private e2: Target | null = null;
  private half = false;
  W = 0; H = 0; // 设备像素
  lost = false;
  bloomOn = true;
  private texCache = new WeakMap<HTMLCanvasElement, WebGLTexture>();
  drawCalls = 0;
  private vboSize = 0;

  static create(): GLStage | null {
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return null;
      return new GLStage(cv, gl);
    } catch (e) { console.warn('WebGL2 不可用，回退 Canvas2D', e); return null; }
  }

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas; this.gl = gl;
    this.half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.init();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.texCache = new WeakMap(); this.fx = null; this.sceneW = 0; this.atmoW = 0; this.init(); this.lost = false; });
  }

  private init() {
    const gl = this.gl;
    this.sprite = compile(gl, VS_SPRITE, FS_SPRITE);
    this.post = compile(gl, VS_FULL, FS_POST);
    this.down = compile(gl, VS_FULL, FS_DOWN);
    this.blur = compile(gl, VS_FULL, FS_BLUR);
    this.vbo = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.batch.data.byteLength, gl.DYNAMIC_DRAW);
    this.vboSize = this.batch.data.byteLength;
    const st = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 16);
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);
    this.sceneTex = this.newTex(gl.LINEAR);
    this.atmoTex = this.newTex(gl.LINEAR);
    this.atlas = this.uploadStatic(buildAtlas(), true);
    this.noiseTex = this.makeNoise();
  }

  /** 可平铺的值噪声（三通道不同频率），供纸纹、墨丝、雾使用 */
  private makeNoise() {
    const gl = this.gl, N = 256;
    const d = new Uint8Array(N * N * 4);
    const oct = (seed: number, base: number) => {
      const grid = (g: number) => { const a = new Float32Array(g * g); let s = seed; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
      const layers = [base, base * 2, base * 4, base * 8].map((g) => ({ g, v: grid(g) }));
      return (x: number, y: number) => {
        let sum = 0, amp = 0.5, tot = 0;
        for (const L of layers) {
          const fx = x / N * L.g, fy = y / N * L.g, ix = Math.floor(fx), iy = Math.floor(fy);
          const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const at = (i: number, j: number) => L.v[((j % L.g) + L.g) % L.g * L.g + ((i % L.g) + L.g) % L.g];
          const v = (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
          sum += v * amp; tot += amp; amp *= 0.5;
        }
        return sum / tot;
      };
    };
    const r = oct(11, 8), g = oct(23, 6), b = oct(37, 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      d[i] = r(x, y) * 255; d[i + 1] = g(x, y) * 255; d[i + 2] = b(x, y) * 255; d[i + 3] = 255;
    }
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  private newTex(filter: number) {
    const gl = this.gl, t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  /** 上传静态位图（带 mipmap，旋转缩放都平滑），按画布对象缓存 */
  uploadStatic(cv: HTMLCanvasElement, mip = true): WebGLTexture {
    const hit = this.texCache.get(cv); if (hit) return hit;
    const gl = this.gl;
    const t = this.newTex(mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an && mip) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    this.texCache.set(cv, t);
    return t;
  }

  private target(w: number, h: number, hdr: boolean): Target {
    const gl = this.gl;
    const tex = this.newTex(gl.LINEAR);
    if (hdr && this.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && hdr && this.half) {
      this.half = false; gl.deleteFramebuffer(fb); gl.deleteTexture(tex); return this.target(w, h, false);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }
  private free(t: Target | null) { if (!t) return; this.gl.deleteFramebuffer(t.fb); this.gl.deleteTexture(t.tex); }

  resize(w: number, h: number) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    if (this.fx && this.fx.w === w && this.fx.h === h) return;
    this.W = w; this.H = h;
    for (const t of [this.fx, this.h1, this.q1, this.q2, this.e1, this.e2]) this.free(t);
    this.fx = this.target(w, h, true);
    this.h1 = this.target(Math.ceil(w / 2), Math.ceil(h / 2), true);
    this.q1 = this.target(Math.ceil(w / 4), Math.ceil(h / 4), true);
    this.q2 = this.target(Math.ceil(w / 4), Math.ceil(h / 4), true);
    this.e1 = this.target(Math.ceil(w / 8), Math.ceil(h / 8), true);
    this.e2 = this.target(Math.ceil(w / 8), Math.ceil(h / 8), true);
  }

  private upload(tex: WebGLTexture, cv: HTMLCanvasElement, premult: boolean, isScene: boolean) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult);
    const w = cv.width, h = cv.height;
    const same = isScene ? (w === this.sceneW && h === this.sceneH) : (w === this.atmoW && h === this.atmoH);
    if (same) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      if (isScene) { this.sceneW = w; this.sceneH = h; } else { this.atmoW = w; this.atmoH = h; }
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  private pass(t: Target | null, prog: Prog) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? t.w : this.W, t ? t.h : this.H);
    gl.useProgram(prog.p);
    this.drawCalls++;
  }
  private bindTex(unit: number, tex: WebGLTexture) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  private full() { const gl = this.gl; gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /** 一帧：scene 为世界画布；批次已由调用方填好（CSS 像素坐标），cssW/cssH 为 CSS 尺寸 */
  frame(scene: HTMLCanvasElement, cssW: number, cssH: number, dpr: number, P: PostParams) {
    if (this.lost || !this.fx) return;
    const gl = this.gl;
    this.drawCalls = 0;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.upload(this.sceneTex, scene, false, true);
    if (P.atmo) this.upload(this.atmoTex, P.atmo.canvas, true, false);

    // 1) 特效批次 -> fx 帧缓冲
    const B = this.batch;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fx.fb);
    gl.viewport(0, 0, this.fx.w, this.fx.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (B.n > 0) {
      gl.useProgram(this.sprite.p);
      gl.uniform2f(this.sprite.u('uRes'), cssW, cssH);
      gl.uniform1i(this.sprite.u('uTex'), 0);
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const bytes = B.n * FLOATS * 4;
      // 孤立旧缓冲（orphan）避免与上一帧 GPU 读取冲突
      if (bytes > this.vboSize) { this.vboSize = B.data.byteLength; }
      gl.bufferData(gl.ARRAY_BUFFER, this.vboSize, gl.DYNAMIC_DRAW);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.data, 0, B.n * FLOATS);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      for (const s of B.segs) {
        if (!s.count) continue;
        gl.bindTexture(gl.TEXTURE_2D, s.tex ?? this.atlas);
        gl.drawArrays(gl.TRIANGLES, s.start, s.count);
        this.drawCalls++;
      }
      gl.disable(gl.BLEND);
    }
    // 2) 泛光：1/2 -> 1/4 -> 模糊 -> 1/8 -> 模糊
    const doBloom = this.bloomOn && B.n > 0;
    if (doBloom) {
      const down = (src: Target, dst: Target) => { this.pass(dst, this.down); this.bindTex(0, src.tex); gl.uniform1i(this.down.u('uTex'), 0); gl.uniform2f(this.down.u('uTexel'), 1 / src.w, 1 / src.h); this.full(); };
      const blur = (src: Target, dst: Target, dx: number, dy: number) => { this.pass(dst, this.blur); this.bindTex(0, src.tex); gl.uniform1i(this.blur.u('uTex'), 0); gl.uniform2f(this.blur.u('uDir'), dx / src.w, dy / src.h); this.full(); };
      down(this.fx, this.h1!); down(this.h1!, this.q1!);
      blur(this.q1!, this.q2!, 1, 0); blur(this.q2!, this.q1!, 0, 1);
      down(this.q1!, this.e1!);
      blur(this.e1!, this.e2!, 1, 0); blur(this.e2!, this.e1!, 0, 1);
    }
    // 3) 后期合成到屏幕
    const pp = this.post;
    this.pass(null, pp);
    this.bindTex(0, this.sceneTex); gl.uniform1i(pp.u('uScene'), 0);
    this.bindTex(1, this.fx.tex); gl.uniform1i(pp.u('uFx'), 1);
    this.bindTex(2, this.q1!.tex); gl.uniform1i(pp.u('uB1'), 2);
    this.bindTex(3, this.e1!.tex); gl.uniform1i(pp.u('uB2'), 3);
    this.bindTex(4, this.atmoTex); gl.uniform1i(pp.u('uAtmo'), 4);
    this.bindTex(5, this.noiseTex); gl.uniform1i(pp.u('uNoise'), 5);
    gl.uniform2f(pp.u('uRes'), this.W, this.H);
    gl.uniform1f(pp.u('uDpr'), dpr);
    gl.uniform1f(pp.u('uT'), P.t % 10000);
    const sh = new Float32Array(24); const ns = Math.min(6, P.shocks.length);
    for (let i = 0; i < ns; i++) { const s = P.shocks[i]; sh.set([s.x * dpr, s.y * dpr, s.r * dpr, s.amp * dpr], i * 4); }
    gl.uniform4fv(pp.u('uShock[0]'), sh); gl.uniform1i(pp.u('uNShock'), ns);
    gl.uniform3fv(pp.u('uMul'), P.mul); gl.uniform1f(pp.u('uWarm'), P.warm); gl.uniform1f(pp.u('uDusk'), P.dusk);
    const S = P.sense;
    gl.uniform4f(pp.u('uSense'), S.x * dpr, S.y * dpr, S.R * dpr, S.on ? 1 : 0);
    gl.uniform3fv(pp.u('uSenseInk'), S.ink); gl.uniform3fv(pp.u('uSenseGlow'), S.glow);
    gl.uniform1f(pp.u('uSenseHide'), S.hide); gl.uniform1f(pp.u('uAlarm'), S.alarm);
    if (P.atmo) { gl.uniform4f(pp.u('uAtmoRect'), P.atmo.x * dpr, P.atmo.y * dpr, P.atmo.w * dpr, P.atmo.h * dpr); gl.uniform1f(pp.u('uAtmoOn'), 1); }
    else gl.uniform1f(pp.u('uAtmoOn'), 0);
    gl.uniform4fv(pp.u('uFog'), P.fog); gl.uniform1f(pp.u('uFogBands'), P.fogBands);
    gl.uniform4fv(pp.u('uFlash'), P.flash); gl.uniform4fv(pp.u('uTint'), P.tint);
    gl.uniform1f(pp.u('uVig'), P.vig); gl.uniform1f(pp.u('uHurt'), P.hurt); gl.uniform1f(pp.u('uFade'), P.fade);
    gl.uniform1f(pp.u('uAberr'), P.aberr); gl.uniform1f(pp.u('uBloomK'), doBloom ? P.bloom : 0); gl.uniform1f(pp.u('uGrain'), P.grain);
    gl.uniform1f(pp.u('uSat'), P.sat);
    this.full();
    gl.bindVertexArray(null);
  }
}
