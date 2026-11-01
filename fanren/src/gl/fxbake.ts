// 第三十五步：程序纹理烘焙（GPU 一次性生成 32 张特效贴图，此后与普通图集一样按四边形绘制）
// 白色预乘贴图，由顶点色上色。部分图样（电弧 electric、齿轮 diamondGear、波环 waveRing、花瓣 flower、
// 日芒 solar、火花 spark、墨溅 inksplat）移植自 mebiusbox/pixy.js 的 fxgen 着色片段（MIT License,
// Copyright © 2017 mebiusbox software）；其余（阵纹、莲台、墨笔、裂地、漩涡、火舌、光芒、六角罩、八卦环）为本项目原创。
export const BC = 256, BCOLS = 8, BROWS = 4, BW = BC * BCOLS, BH = BC * BROWS;

export const enum K {
  Elec0 = 0, Elec1, Elec2, Elec3,       // 电弧条（横向，四帧）
  Wave5, Wave8, Wave12, RingThin,        // 波纹环 / 细光环
  Flower5, Flower6, Flower8, Flower12,   // 花瓣光纹
  Gear12, Gear24,                        // 菱齿轮（阵盘）
  Ink0, Ink1, Ink2,                      // 墨溅
  Solar, Spark0, Spark1,                 // 日芒 / 星火
  Lotus, Seal,                           // 莲台 / 法阵
  ElecRing0, ElecRing1,                  // 雷环
  Brush0, Brush1,                        // 墨笔弧（剑气）
  Crack, Swirl, Flame, Rays, Hex, Bagua, // 裂地 / 漩涡 / 火舌 / 光芒 / 六角罩 / 八卦环
}

export function bakeUV(k: number): [number, number, number, number] {
  const cx = k % BCOLS, cy = (k / BCOLS) | 0, p = 1;
  return [(cx * BC + p) / BW, (cy * BC + p) / BH, ((cx + 1) * BC - p) / BW, ((cy + 1) * BC - p) / BH];
}

let TEX: WebGLTexture | null = null;
export const bakeTex = () => TEX;

const VS = `#version 300 es
out vec2 vP; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vP=p*2.0-1.0; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vP; out vec4 o;
uniform int uMode; uniform float uSeed; uniform float uA; uniform float uB;
#define PI 3.14159265359
#define TAU 6.28318530718
float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h1(i), h1(i+vec2(1,0)), u.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
mat2 rot(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float edgeFade(vec2 p){ return smoothstep(1.0, 0.82, length(p)); }

// ---- pixy.js electric（voronoi 边界距离）
vec4 voronoi(in vec2 x){
  vec2 n=floor(x), f=fract(x), mg, mr; float md=8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 r=g+hash2(n+g)-f; float d=dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
  float od=md; md=8.0;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=vec2(float(i),float(j)); vec2 r=g+hash2(n+g)-f; if(dot(mr-r,mr-r)>0.0001) md=min(md, dot(0.5*(mr+r), normalize(r-mr))); }
  return vec4(md, mr, od);
}
float electric(vec2 uv, float time){
  float pauseFreq=3.0, scaledTime=time*0.5+0.05*uv.x;
  float sinTime=sin(pauseFreq*scaledTime), sinTimeOffset=sin(pauseFreq*scaledTime-0.5*PI);
  float timeStep=scaledTime+sinTime/pauseFreq;
  vec2 p=vec2(0.5-timeStep*3.0); vec4 c=voronoi(p);
  vec2 q=uv; q.x+=1.5*(2.0*c.x-0.33)*(q.y-0.5);
  float edgeScale=1.0-2.0*abs(uv.x-0.5);
  float scaleMulti=pow(0.5*sinTime+0.5,2.0);
  float dScale=2.0*edgeScale*(0.25+0.75*pow(0.5*sinTimeOffset+0.5,2.0));
  p=q*12.0; p.y=0.5*12.0-timeStep*6.0; c=dScale*voronoi(p); float d=(q.y+c.x-0.75);
  p.x=q.x*12.0-timeStep*6.0; p.y=4.5*12.0-timeStep*3.0; c=dScale*voronoi(p);
  d=mix(d,(q.y-c.x-0.25),0.5); d=1.0-abs(d);
  float lw=d+0.025*scaleMulti*edgeScale;
  float v=smoothstep(1.0,1.005,lw)*mix(0.8,1.4,scaleMulti);
  v+=edgeScale*pow(scaleMulti*smoothstep(0.75,1.005,lw),16.0)*0.6;
  v+=edgeScale*smoothstep(0.93,1.0,lw)*0.35;   // 柔光外晕
  return clamp(v,0.0,1.0);
}
// ---- pixy.js diamondGear
vec2 sdLine(vec2 pos, vec2 a, vec2 b){ pos-=a; vec2 d=b-a; float l=length(d); d/=l; float t=dot(d,pos); vec2 p=d*clamp(t,0.0,l); vec2 perp=vec2(d.y,-d.x); return vec2(length(pos-p), dot(pos,perp)); }
vec2 lmin(vec2 a, vec2 b){ if(abs(a.x-b.x)<0.0001) return a.y>b.y?a:b; return a.x<b.x?a:b; }
float toSd(vec2 x){ return x.x*sign(x.y); }
float sdDiamond(vec2 pos, vec2 tail, vec2 tip, float width, float mid){ vec2 d=tip-tail; vec2 p=vec2(d.y,-d.x)*width*0.5; vec2 m=d*mid+tail;
  return toSd(lmin(lmin(sdLine(pos,tail,m+p), sdLine(pos,m+p,tip)), lmin(sdLine(pos,tip,m-p), sdLine(pos,m-p,tail)))); }
vec2 radialRepeat(vec2 pos, float count){ float off=0.5/count; float r=length(pos), a=atan(-pos.y,-pos.x)+PI; a/=TAU; a+=off; a*=count; a=fract(a); a/=count; a-=off; a*=TAU; return vec2(cos(a),sin(a))*r; }
float gear(vec2 uv, float teeth, float radius, float width, float mid){ uv=radialRepeat(uv,teeth); return sdDiamond(uv, vec2(radius,0.0), vec2(1.0,0.0), width/teeth, mid); }
// ---- pixy.js inksplat
vec2 splatHash(vec2 p){ return fract(sin(p*mat2(63.31,127.63,395.467,213.799))*43141.59265); }
float splat(vec2 p, float seed){ float v=length(p); vec2 h=vec2(ceil(3.0*seed)+seed); float a,w;
  for(int i=0;i<21;i++){ h=splatHash(h); w=0.03; a=(atan(p.x,p.y)+3.14)/6.28*(1.0+w); v-=sin(smoothstep(h.x,h.x+w,a)*3.14); }
  float s=3.0; for(int i=0;i<64;i++){ h=(splatHash(h)*2.0-1.0)*s; v-=(1.01-smoothstep(0.0,0.5*(3.0-s),length(p-h))); s-=0.04; if(s<=0.5) break; }
  return v; }
// ---- 波纹环 / 花瓣（pixy waveRing / flower）
float waveRing(vec2 p, float freq, float rad, float amp, float wid, float e){ float u=sin(atan(p.y,p.x)*freq+uSeed)*amp; return pow(abs(wid/(rad+u-length(p))), e); }
float flower(vec2 p, float petals, float rad, float inten, float e){ float u=sin((atan(p.y,p.x)+uSeed)*petals)*rad; return pow(abs(inten/(u-length(p))), e); }
float ring(vec2 p, float r, float w){ return w/abs(length(p)-r); }
float lineSeg(vec2 p, vec2 a, vec2 b, float w){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return smoothstep(w, w*0.3, length(pa-ba*h)); }

void main(){
  vec2 p=vec2(vP.x,-vP.y); float L=length(p), A=atan(p.y,p.x); float v=0.0;
  if(uMode==0){ // 电弧条
    vec2 uv=vec2(p.x*0.5+0.5, p.y*0.5+0.5);
    v=electric(uv, uSeed)*smoothstep(1.0,0.85,abs(p.x));
  } else if(uMode==1){ // 波纹环
    v=min(1.0, waveRing(p, uA, 0.7, 0.05, 0.012, 1.3))*edgeFade(p);
  } else if(uMode==2){ // 细光环
    v=min(1.0, pow(ring(p,0.8,0.012),1.4))*edgeFade(p);
  } else if(uMode==3){ // 花瓣
    v=min(1.0, flower(p, uA, 0.85, 0.014, 1.25))*edgeFade(p)*smoothstep(0.0,0.25,L);
  } else if(uMode==4){ // 菱齿轮（描边 + 内环）
    float g=gear(p*rot(uSeed), uA, 0.55, 2.2, 0.4);
    v=smoothstep(0.018,0.0,abs(g))+0.35*smoothstep(0.0,-0.02,g)*0.4;
    v+=min(1.0, pow(ring(p,0.5,0.006),1.3))*0.8 + min(1.0, pow(ring(p,0.96,0.005),1.3))*0.7;
    v*=edgeFade(p*0.98);
  } else if(uMode==5){ // 墨溅（覆盖遮罩）
    float s=splat(p*4.2, uSeed); float w=0.75*fwidth(s); v=1.0-smoothstep(-w,w,s);
    v*=0.75+0.25*fbm(p*9.0+uSeed);   // 墨色浓淡
    v*=edgeFade(p*0.97);
  } else if(uMode==6){ // 日芒
    v=pow(0.12/max(L,0.001), 1.6)*edgeFade(p);
  } else if(uMode==7){ // 星火（pixy spark：方向噪声）
    vec2 n=normalize(p+1e-5); float t=0.18*2.0/max(L,0.001);
    float r=fbm(n*24.0+uSeed)*2.0; v=pow(max(t-r,0.0),1.4)*edgeFade(p);
  } else if(uMode==8){ // 莲台：两层花瓣 + 内外环
    v=min(1.0, flower(p, 8.0, 0.86, 0.010, 1.3))*smoothstep(0.1,0.35,L);
    v+=0.8*min(1.0, flower(p*rot(PI/8.0), 8.0, 0.6, 0.008, 1.3))*smoothstep(0.05,0.25,L);
    v+=0.7*min(1.0, pow(ring(p,0.3,0.006),1.4)) + 0.5*min(1.0, pow(ring(p,0.92,0.004),1.4));
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==9){ // 法阵：双环 + 符齿 + 六芒 + 星点
    v=min(1.0,pow(ring(p,0.93,0.006),1.5))+min(1.0,pow(ring(p,0.82,0.005),1.5))+0.6*min(1.0,pow(ring(p,0.42,0.004),1.5));
    float seg=fract(A/TAU*36.0); v+=smoothstep(0.82,0.83,L)*smoothstep(0.93,0.92,L)*step(0.35,seg)*step(seg,0.6)*0.55;
    for(int i=0;i<3;i++){ float a0=float(i)*TAU/3.0+PI/2.0; vec2 a=vec2(cos(a0),sin(a0))*0.8, b=vec2(cos(a0+TAU/3.0),sin(a0+TAU/3.0))*0.8;
      v+=lineSeg(p,a,b,0.012)*0.8; v+=lineSeg(p,-a,-b,0.012)*0.8; }
    for(int i=0;i<12;i++){ float a0=float(i)*TAU/12.0; v+=smoothstep(0.03,0.0,length(p-vec2(cos(a0),sin(a0))*0.875))*0.9; }
    v=min(v,1.0)*edgeFade(p*0.97);
  } else if(uMode==10){ // 雷环：电弧绕成一圈（两次采样交叉淡化消除接缝）
    float u=A/TAU+0.5; float y=(L-0.72)*1.6+0.5;
    float e1=electric(vec2(0.15+u*0.7, y), uSeed), e2=electric(vec2(0.15+fract(u+0.5)*0.7, y), uSeed+2.3);
    float k=smoothstep(0.0,0.15,u)*smoothstep(1.0,0.85,u);
    v=mix(e2,e1,k)*edgeFade(p)*smoothstep(0.35,0.55,L);
  } else if(uMode==11){ // 墨笔弧（剑气）：月牙形笔触，带飞白
    float r0=0.68, th=uA*(0.25+0.75*sin(clamp((A+PI*0.8)/(PI*1.6),0.0,1.0)*PI));
    float d=abs(L-r0)/max(th,0.001); float along=(A+PI*0.8)/(PI*1.6);
    float fib=fbm(vec2(along*3.0, (L-r0)*60.0)+uSeed); float dry=smoothstep(0.25,0.6,fib+along*0.35);
    v=smoothstep(1.0,0.6,d)*step(0.0,along)*step(along,1.0)*mix(1.0,dry,smoothstep(0.55,1.0,along));
    v*=0.8+0.2*fbm(p*14.0);
  } else if(uMode==12){ // 裂地：voronoi 裂纹 + 放射主裂
    vec4 c=voronoi(p*4.5+uSeed); float cr=smoothstep(0.035,0.0,c.x)*(1.0-smoothstep(0.2,1.0,L));
    float rad=0.0; for(int i=0;i<7;i++){ float a0=float(i)*TAU/7.0+h1(vec2(float(i),uSeed))*0.6; float da=abs(mod(A-a0+PI,TAU)-PI);
      float wob=fbm(vec2(L*6.0,float(i)))*0.12; rad+=smoothstep(0.03*(1.0-L)+0.006,0.0,abs(da-wob)*L)*smoothstep(0.95,0.2,L); }
    v=clamp(cr*1.0+rad,0.0,1.0)*edgeFade(p);
  } else if(uMode==13){ // 漩涡
    float a=A+L*6.0+uSeed; float arms=pow(0.5+0.5*cos(a*3.0),6.0);
    v=arms*smoothstep(0.05,0.3,L)*edgeFade(p)*(0.6+0.4*fbm(p*6.0+uSeed));
  } else if(uMode==14){ // 火舌（向上）
    vec2 q=vec2(p.x, p.y*0.5+0.5);   // q.y: 0 底 1 顶
    float n=fbm(vec2(p.x*3.0, p.y*2.5-uSeed*3.0)+uSeed);
    float wdt=mix(0.55,0.04,pow(1.0-q.y,0.8)) ;
    float sh=1.0-smoothstep(0.0, wdt, abs(p.x+(n-0.5)*0.45*(1.0-q.y)));
    v=sh*smoothstep(0.0,0.15,1.0-q.y)*(0.55+0.6*n)*smoothstep(0.0,0.1,q.y+0.0);
    v=clamp(v*smoothstep(1.0,0.75,abs(p.x)),0.0,1.0);
  } else if(uMode==15){ // 光芒：长短不一的放射光
    float seg=A/TAU*48.0; float id=floor(seg), f=fract(seg);
    float len=0.35+0.6*h1(vec2(id,uSeed)); float w=smoothstep(0.5,0.0,abs(f-0.5))*1.0;
    v=pow(w,3.0)*smoothstep(len,len*0.3,L)*smoothstep(0.0,0.08,L)+pow(0.05/max(L,0.001),1.5)*0.6;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==16){ // 六角罩：蜂窝格 + 边缘高光（护罩 / 冰壳）
    vec2 q=p*7.0; vec2 r=vec2(1.0,1.7320508); vec2 h=r*0.5;
    vec2 a=mod(q,r)-h, b=mod(q-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b;
    vec2 ag=abs(g); float hx=max(dot(ag, normalize(r)), ag.x); float edge=smoothstep(0.45,0.5,hx);
    float rim=pow(smoothstep(0.55,0.98,L),2.0);
    v=(edge*0.6+rim*0.7+0.03)*smoothstep(1.0,0.96,L);
  } else if(uMode==17){ // 八卦环：八组卦爻
    v=min(1.0,pow(ring(p,0.95,0.004),1.4))*0.8+min(1.0,pow(ring(p,0.6,0.004),1.4))*0.7;
    float sec=A/TAU*8.0; float id=floor(sec); float f=fract(sec);
    for(int k=0;k<3;k++){ float r0=0.7+float(k)*0.075; float bar=smoothstep(0.022,0.012,abs(L-r0));
      float broken=step(0.5,h1(vec2(id,float(k)+uSeed))); float gap=broken*smoothstep(0.06,0.03,abs(f-0.5));
      v+=bar*smoothstep(0.08,0.14,f)*smoothstep(0.92,0.86,f)*(1.0-gap); }
    v=min(v,1.0)*edgeFade(p*0.97);
  }
  v=clamp(v,0.0,1.0);
  o=vec4(v,v,v,v);
}`;

/** 每格：[模式, 种子, 参数 A, 参数 B] */
const CELLS: [number, number, number, number][] = [
  [0, 0.3, 0, 0], [0, 1.7, 0, 0], [0, 3.1, 0, 0], [0, 4.6, 0, 0],
  [1, 0.0, 5, 0], [1, 0.7, 8, 0], [1, 1.3, 12, 0], [2, 0, 0, 0],
  [3, 0.0, 5, 0], [3, 0.0, 6, 0], [3, 0.0, 8, 0], [3, 0.0, 12, 0],
  [4, 0.0, 12, 0], [4, 0.1, 24, 0],
  [5, 0.37, 0, 0], [5, 1.91, 0, 0], [5, 4.23, 0, 0],
  [6, 0, 0, 0], [7, 0.0, 0, 0], [7, 7.7, 0, 0],
  [8, 0, 0, 0], [9, 0, 0, 0],
  [10, 0.9, 0, 0], [10, 3.7, 0, 0],
  [11, 0.0, 0.16, 0], [11, 3.3, 0.09, 0],
  [12, 0.0, 0, 0], [13, 0.0, 0, 0], [14, 0.0, 0, 0], [15, 0.0, 0, 0], [16, 0, 0, 0], [17, 0.0, 0, 0],
];

/** 在 GPU 上烘焙全部特效贴图（每次上下文创建/恢复调用一次） */
export function bakeFx(gl: WebGL2RenderingContext): WebGLTexture | null {
  TEX = null;
  try {
    const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'bake shader'); return sh; };
    const prog = gl.createProgram()!;
    const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'bake link');
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, BW, BH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.useProgram(prog); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.viewport(0, 0, BW, BH); gl.clear(gl.COLOR_BUFFER_BIT);
    const uM = gl.getUniformLocation(prog, 'uMode'), uS = gl.getUniformLocation(prog, 'uSeed'), uA = gl.getUniformLocation(prog, 'uA'), uB = gl.getUniformLocation(prog, 'uB');
    CELLS.forEach(([m, s, a, b], i) => {
      // 帧缓冲第 cy 行即纹理 v∈[cy/BROWS,(cy+1)/BROWS]；着色器里已把 y 翻转，贴到屏幕上方向正确
      const cx = i % BCOLS, cy = (i / BCOLS) | 0;
      gl.viewport(cx * BC, cy * BC, BC, BC);
      gl.uniform1i(uM, m); gl.uniform1f(uS, s); gl.uniform1f(uA, a); gl.uniform1f(uB, b);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteFramebuffer(fb); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    TEX = tex;
  } catch (e) { console.warn('特效贴图烘焙失败（不影响游戏，只少一层特效）', e); TEX = null; }
  return TEX;
}
