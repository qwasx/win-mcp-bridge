// 第三十五步：程序纹理烘焙（GPU 一次性生成 32 张特效贴图；第 6 阶段增至 64 张，此后与普通图集一样按四边形绘制）
// 白色预乘贴图，由顶点色上色。部分图样（电弧 electric、齿轮 diamondGear、波环 waveRing、花瓣 flower、
// 日芒 solar、火花 spark、墨溅 inksplat）移植自 mebiusbox/pixy.js 的 fxgen 着色片段（MIT License,
// Copyright © 2017 mebiusbox software）；其余（阵纹、莲台、墨笔、裂地、漩涡、火舌、光芒、六角罩、八卦环）为本项目原创。
export const BC = 256, BCOLS = 8, BROWS = 8, BW = BC * BCOLS, BH = BC * BROWS;

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
  // —— 第 6 阶段：特效库新图样（全部本项目原创，着色器程序生成，不占包体）——
  Crescent = 32, Star4, Snow, GhostFire, Cloud, PetalH, MoonDisc, WaveCrest,   // 剑气月牙 / 四芒星芒 / 六出雪花 / 鬼火 / 祥云 / 心形花瓣 / 圆月 / 浪头
  Taiji, FeatherF, Spike, Glyph, Bug, Sword, InkRing, Vortex,                 // 太极 / 火羽 / 土刺 / 篆印 / 灵虫 / 飞剑 / 水墨环 / 漩涡星云
  Pillar, Mist, IceCluster, FireLotus, Dharma, ThunderSeal, WindArc, Drop,     // 光柱 / 迷雾 / 冰晶簇 / 火莲 / 法相 / 雷纹环 / 风弧 / 水滴
  Willow, Palm, Skull, SoundArc, RuneRing, Blossom, Ripple, Bell,             // 柳叶 / 掌印 / 鬼面 / 音波 / 符文环 / 梅花 / 涟漪 / 金钟
  Gourd, Umbrella, Pagoda, Stamp, Lamp, Eye, ForkV, Aureole,                  // 葫芦 / 伞 / 宝塔 / 大印 / 灯 / 神识之眼 / 竖劈雷 / 佛光
  Mountain, StarField, CrossSlash, Fu, Wing, Sun,                             // 山岳 / 星野 / 交叉剑痕 / 符纸 / 羽翼 / 烈日
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


// ---- 第 6 阶段：特效库 SDF 小工具
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
float sdEll(vec2 p, vec2 r){ return (length(p/r)-1.0)*min(r.x,r.y); }
float fillD(float d, float aa){ return smoothstep(aa,-aa,d); }
float halo(float d, float k){ return exp(-max(d,0.0)*k); }
// 实心剪影：内部按离边距离由亮边渐暗（发光剪影的质感），外缘一圈柔光
float silo(float d){ return fillD(d,0.012)*(0.55+0.45*smoothstep(-0.12,0.0,d)) + 0.28*halo(d,14.0)*step(0.0,d); }
float flameSh(vec2 p, float seed, float wid){
  float qy=p.y*0.5+0.5; float n=fbm(vec2(p.x*3.0, p.y*2.5-seed*3.0)+seed);
  float wdt=mix(wid,0.04,pow(qy,0.9));
  float sh=1.0-smoothstep(0.0, wdt, abs(p.x+(n-0.5)*0.4*qy));
  return sh*smoothstep(0.0,0.15,1.0-qy)*smoothstep(0.0,0.12,qy)*(0.55+0.6*n);
}

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
  } else if(uMode==18){ // 剑气月牙（凸向 +x）
    float d=max(length(p-vec2(-0.25,0.0))-0.95, -(length(p-vec2(-0.62,0.0))-0.98));
    v=fillD(d,0.02)*(0.45+0.55*smoothstep(-0.16,0.0,length(p-vec2(-0.25,0.0))-0.95))+0.4*halo(d,10.0)*step(0.0,d);
    v*=edgeFade(p*0.98);
  } else if(uMode==19){ // 四芒星芒
    vec2 q=abs(p); float r1=exp(-q.y*38.0)*pow(max(0.0,1.0-q.x),2.0)+exp(-q.x*38.0)*pow(max(0.0,1.0-q.y),2.0);
    vec2 d2=abs(rot(PI/4.0)*p); float r2=(exp(-d2.y*60.0)*pow(max(0.0,1.0-d2.x*1.6),2.0)+exp(-d2.x*60.0)*pow(max(0.0,1.0-d2.y*1.6),2.0))*0.5;
    v=min(1.0, r1+r2+pow(0.07/max(L,0.001),1.6))*edgeFade(p);
  } else if(uMode==20){ // 六出雪花
    float a=mod(A+PI/6.0, PI/3.0)-PI/6.0; vec2 q=vec2(cos(a),abs(sin(a)))*L;
    float d=sdSeg(q,vec2(0.0),vec2(0.86,0.0));
    d=min(d, sdSeg(q,vec2(0.32,0.0),vec2(0.32+0.2,0.2*1.2)));
    d=min(d, sdSeg(q,vec2(0.55,0.0),vec2(0.55+0.15,0.15*1.2)));
    d=min(d, sdSeg(q,vec2(0.74,0.0),vec2(0.74+0.08,0.08*1.2)));
    v=fillD(d-0.028,0.012)+0.35*halo(d-0.028,18.0)+0.8*smoothstep(0.012,0.0,abs(L-0.16))+pow(0.05/max(L,0.001),1.5)*0.5;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==21){ // 鬼火：中空的青焰，外亮内暗
    vec2 q=p*vec2(1.0,0.95)+vec2(0.0,0.05);
    float o1=flameSh(q,uSeed,0.6), o2=flameSh(q*vec2(1.7,1.25)+vec2(0.0,0.25),uSeed+1.3,0.6);
    v=clamp(o1*1.25-o2*0.8,0.0,1.0)+0.25*o2*smoothstep(0.3,0.0,abs(q.x));
    v=clamp(v,0.0,1.0)*smoothstep(1.0,0.8,abs(p.x));
  } else if(uMode==22){ // 祥云：三团云头勾边 + 卷心
    float c1=length(p-vec2(-0.42,-0.05))-0.3, c2=length(p-vec2(0.02,0.14))-0.4, c3=length(p-vec2(0.46,-0.06))-0.28;
    float d=max(min(min(c1,c2),c3), -(p.y+0.3));
    float r=length(p-vec2(0.02,0.14)), a=atan(p.y-0.14,p.x-0.02); float sp=abs(fract((r/0.075 - a/TAU))-0.5)*0.075;
    v=smoothstep(0.03,0.01,abs(d))+0.75*smoothstep(0.022,0.006,sp)*step(r,0.3)+0.3*fillD(d,0.02)+0.2*halo(abs(d),20.0);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==23){ // 心形花瓣（尖向 +x，带缺口）
    float d=max(sdEll(p,vec2(0.88,0.48)), -(length(p-vec2(0.98,0.0))-0.2));
    v=fillD(d,0.02)*(0.55+0.45*(1.0-abs(p.y)/0.5))+0.25*halo(d,14.0)*step(0.0,d);
    v+=0.2*smoothstep(0.02,0.0,abs(p.y))*step(p.x,0.6)*fillD(d,0.02);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==24){ // 圆月：盈盈一轮，月面淡影，外有月华
    float R=0.6; float dk=sqrt(max(0.0,1.0-pow(L/R,2.0)));
    float disc=fillD(L-R,0.01)*(0.72+0.28*dk)*(1.0-0.22*smoothstep(0.45,0.7,fbm(p*3.2+uSeed)));
    v=disc+0.45*halo(L-R,5.5)*step(R,L)+0.3*smoothstep(0.015,0.0,abs(L-0.9))*0.5;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==25){ // 浪头：底浪 + 卷起的浪尖 + 浪花
    float base=abs(p.y+0.35-0.1*sin(p.x*5.0+uSeed))-0.07*(1.0-abs(p.x));
    float r=length(p-vec2(0.15,0.1)), a=atan(p.y-0.1,p.x-0.15);
    float sp=abs(r-(0.42-0.05*(a+PI)))-0.05*(1.0-(a+PI)/TAU); sp=max(sp, -(a+PI*0.95)); 
    float d=min(base, sp);
    v=fillD(d,0.015)*(0.6+0.4*smoothstep(-0.05,0.0,d))+0.3*halo(d,16.0)*step(0.0,d);
    for(int i=0;i<7;i++){ vec2 c=vec2(0.2+0.12*float(i)-0.3, 0.45+0.15*h1(vec2(float(i),uSeed))); v+=smoothstep(0.035,0.0,length(p-c)-0.01)*0.8; }
    v=min(v,1.0)*smoothstep(1.0,0.85,abs(p.x));
  } else if(uMode==26){ // 太极
    float R=0.82; float s=p.x>0.0?1.0:0.0;
    float cu=length(p-vec2(0.0,R*0.5))-R*0.5, cd=length(p-vec2(0.0,-R*0.5))-R*0.5;
    if(cu<0.0) s=0.0; if(cd<0.0) s=1.0;
    if(length(p-vec2(0.0,R*0.5))<R*0.13) s=1.0; if(length(p-vec2(0.0,-R*0.5))<R*0.13) s=0.0;
    v=fillD(L-R,0.012)*(0.22+0.78*s)+smoothstep(0.03,0.0,abs(L-R))*0.9+0.25*halo(L-R,10.0)*step(R,L);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==27){ // 火羽（尖向 +x）
    float u=(p.x+0.9)/1.8; float hw=0.32*pow(sin(clamp(u,0.0,1.0)*PI),0.7)*(1.0-0.3*u);
    float barb=0.65+0.35*sin((p.x*0.8-abs(p.y)*1.6)*38.0+uSeed);
    float d=abs(p.y)-hw;
    v=fillD(d,0.02)*barb*(0.5+0.5*u)+smoothstep(0.02,0.0,abs(p.y))*step(-0.9,p.x)*step(p.x,0.85)*0.8+0.25*halo(d,12.0)*step(0.0,d);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==28){ // 土刺：多棱尖锥（尖朝上）
    float hy=(p.y+0.95)/1.9; float hw=0.42*(1.0-hy); float d=abs(p.x)-hw; d=max(d,-(p.y+0.95));
    float face=p.x<-0.04*(1.0-hy)?0.55:(p.x<0.12*(1.0-hy)?0.9:0.72);
    v=fillD(d,0.015)*face*(0.6+0.4*hy)+0.7*smoothstep(0.02,0.0,abs(p.x+0.04*(1.0-hy)))*step(hy,1.0)*fillD(d,0.015);
    v=min(v,1.0);
  } else if(uMode==29){ // 篆印：双环 + 方格篆文
    v=smoothstep(0.03,0.012,abs(L-0.86))+0.7*smoothstep(0.02,0.006,abs(L-0.78));
    vec2 g=floor((p+0.6)/0.3); vec2 f=fract((p+0.6)/0.3)-0.5;
    if(abs(p.x)<0.6&&abs(p.y)<0.6){ float hh=h1(g+uSeed); float st=hh<0.5?smoothstep(0.08,0.05,abs(f.y)):smoothstep(0.08,0.05,abs(f.x)); float hh2=h1(g+uSeed+3.1); if(hh2>0.6) st=max(st, smoothstep(0.08,0.05,abs(f.x+f.y*0.0-0.25))); v+=st*0.9*step(abs(f.x),0.45)*step(abs(f.y),0.45); }
    v=min(v,1.0)*edgeFade(p*0.98);
  } else if(uMode==30){ // 灵虫（头朝 +x）：躯干、头、双翅
    float body=sdEll(p-vec2(-0.05,0.0),vec2(0.42,0.16)), head=length(p-vec2(0.42,0.0))-0.13;
    float w1=sdEll(rot(-0.6)*(p-vec2(-0.08,0.24)),vec2(0.34,0.13)), w2=sdEll(rot(0.6)*(p-vec2(-0.08,-0.24)),vec2(0.34,0.13));
    float seg=0.75+0.25*step(0.5,fract(p.x*7.0));
    v=fillD(min(body,head),0.015)*seg+0.55*fillD(min(w1,w2),0.02)*(0.6+0.4*smoothstep(-0.1,0.0,min(w1,w2)))+0.25*halo(min(min(body,head),min(w1,w2)),12.0);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==31){ // 飞剑（尖向 +x）：剑身、剑脊、护手、剑柄、剑首
    float u=clamp((p.x+0.25)/1.2,0.0,1.0); float hw=0.085*(u<0.8?1.0:(1.0-u)/0.2);
    float blade=max(abs(p.y)-hw, max(-(p.x+0.25), p.x-0.95));
    float guard=sdBox(p-vec2(-0.29,0.0),vec2(0.035,0.15)), hilt=sdBox(p-vec2(-0.58,0.0),vec2(0.27,0.03)), pom=length(p-vec2(-0.88,0.0))-0.055;
    float d=min(min(blade,guard),min(hilt,pom));
    v=fillD(blade,0.01)*(0.7+0.3*smoothstep(0.03,0.0,abs(p.y)))+fillD(guard,0.01)*0.95+fillD(hilt,0.01)*0.6+fillD(pom,0.01)*0.85+0.35*halo(d,9.0)*step(0.0,d);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==32){ // 水墨环：飞白笔意的冲击圈 + 墨点
    float th=0.05+0.09*fbm(vec2(A*1.5+uSeed,1.0)); float dry=smoothstep(0.28,0.62,fbm(vec2(A*9.0,L*26.0)+uSeed));
    v=smoothstep(th,th*0.4,abs(L-0.7))*dry;
    for(int i=0;i<12;i++){ float a0=h1(vec2(float(i),uSeed))*TAU, r0=0.8+0.15*h1(vec2(uSeed,float(i))); v+=smoothstep(0.03,0.0,length(p-vec2(cos(a0),sin(a0))*r0)-0.012*h1(vec2(float(i),2.0))); }
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==33){ // 漩涡星云：两臂对数螺旋
    float a=A+log(max(L,0.02))*3.2+uSeed; float arms=pow(0.5+0.5*cos(a*2.0),5.0);
    v=arms*smoothstep(0.02,0.3,L)*(0.55+0.45*fbm(p*7.0+uSeed))+pow(0.09/max(L,0.001),1.4)*0.7;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==34){ // 光柱：底端最亮，向上渐隐，柱身有游丝
    float qy=p.y*0.5+0.5; float w=0.32*(1.0-0.35*qy);
    float body=exp(-pow(p.x/w,2.0)*2.2), core=exp(-pow(p.x/(w*0.22),2.0));
    float st=0.75+0.25*vn(vec2(p.x*14.0, p.y*1.5+uSeed));
    v=(body*0.6*st+core)*smoothstep(1.0,0.35,qy)*smoothstep(0.0,0.06,qy);
    v=clamp(v,0.0,1.0)*smoothstep(1.0,0.8,abs(p.x));
  } else if(uMode==35){ // 迷雾团
    v=smoothstep(0.32,0.78,fbm(p*2.0+uSeed))*(1.0-smoothstep(0.25,1.0,L))*1.2;
    v=clamp(v,0.0,1.0);
  } else if(uMode==36){ // 冰晶簇：数根菱柱自底部斜出
    v=0.0;
    for(int i=0;i<5;i++){ float fi=float(i); float tl=(fi-2.0)*0.32+(h1(vec2(fi,uSeed))-0.5)*0.15; float hgt=0.9+0.6*h1(vec2(uSeed,fi))-abs(fi-2.0)*0.22; float wd=0.12+0.05*h1(vec2(fi,fi));
      vec2 q=rot(tl)*(p-vec2((fi-2.0)*0.14,-0.9)); q.y-=hgt*0.5;
      float d=abs(q.x)/wd+abs(q.y)/(hgt*0.5)-1.0; float f=fillD(d*wd,0.008); float shade=q.x<0.0?0.55:0.95;
      v=max(v, f*shade*(0.7+0.3*(q.y/(hgt*0.5)*0.5+0.5)) + 0.6*smoothstep(0.015,0.0,abs(q.x))*f); }
    v=min(v,1.0);
  } else if(uMode==37){ // 火莲：八瓣尖瓣（俯视），瓣尖带焰
    float r=0.42+0.48*pow(abs(cos(A*4.0+uSeed)),2.5)+0.06*(fbm(p*6.0)-0.5);
    float r2=0.25+0.3*pow(abs(cos(A*4.0+PI/4.0+uSeed)),2.5);
    v=fillD(L-r,0.03)*(0.5+0.5*L/r)*0.85+fillD(L-r2,0.02)*0.35+pow(0.1/max(L,0.001),1.3)*0.6;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==38){ // 法相：结跏趺坐的金身剪影 + 头光 + 身光
    float head=length(p-vec2(0.0,0.46))-0.13, knot=length(p-vec2(0.0,0.62))-0.065;
    float body=sdEll(p-vec2(0.0,0.06),vec2(0.3,0.33)), legs=sdEll(p-vec2(0.0,-0.4),vec2(0.62,0.17));
    float sh=sdEll(p-vec2(0.0,0.22),vec2(0.4,0.12));
    float d=min(min(min(head,knot),min(body,legs)),sh);
    v=silo(d)+0.75*smoothstep(0.02,0.0,abs(length(p-vec2(0.0,0.46))-0.25))+0.4*smoothstep(0.03,0.0,abs(length(p-vec2(0.0,0.05))-0.8));
    v+=0.15*fillD(length(p-vec2(0.0,0.05))-0.8,0.05);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==39){ // 雷纹环：回纹带
    vec2 q=vec2(A/TAU*24.0, (L-0.62)/0.24*2.0); vec2 f=fract(q)-0.5; float s=max(abs(f.x),abs(f.y));
    float key=smoothstep(0.06,0.02,abs(s-0.36))+smoothstep(0.06,0.02,abs(s-0.14))*step(f.x,0.0);
    v=key*step(0.62,L)*step(L,0.86)+smoothstep(0.02,0.006,abs(L-0.6))+smoothstep(0.02,0.006,abs(L-0.88));
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==40){ // 风弧：三道细弧
    v=0.0;
    for(int k=0;k<3;k++){ float fk=float(k); vec2 c=vec2(-0.5+fk*0.08,0.0); float r=0.55+fk*0.17; float a=atan(p.y-c.y,p.x-c.x); float lim=1.0-fk*0.18;
      float tap=smoothstep(lim,lim*0.3,abs(a)); v+=smoothstep(0.035*tap+0.004,0.0,abs(length(p-c)-r))*tap*(1.0-fk*0.2); }
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==41){ // 水滴（尖向 +x）+ 高光
    float x=p.x+0.2; float hw=x<0.0?0.45*sqrt(max(0.0,1.0-pow(x/0.45,2.0))):0.45*pow(max(0.0,1.0-x/1.0),1.2);
    float d=abs(p.y)-hw; d=max(d,-(x+0.45));
    v=fillD(d,0.015)*(0.55+0.45*smoothstep(-0.1,0.0,d))+0.9*smoothstep(0.1,0.0,length(p-vec2(-0.32,0.16))-0.04)+0.25*halo(d,12.0)*step(0.0,d);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==42){ // 柳叶（尖向 +x）：叶脉
    float u=(p.x+0.92)/1.84; float hw=0.24*pow(sin(clamp(u,0.0,1.0)*PI),0.85);
    float d=abs(p.y)-hw; float vein=smoothstep(0.02,0.0,abs(p.y))+0.45*smoothstep(0.02,0.0,abs(fract((p.x-abs(p.y)*1.4)*7.0)-0.5)*0.14);
    v=fillD(d,0.012)*(0.55+0.45*vein)+0.2*halo(d,14.0)*step(0.0,d);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==43){ // 掌印（指尖朝上）
    float palm=sdBox(p-vec2(0.0,-0.22),vec2(0.27,0.3))-0.08;
    float f1=sdSeg(p,vec2(-0.25,0.12),vec2(-0.29,0.5))-0.075, f2=sdSeg(p,vec2(-0.09,0.15),vec2(-0.1,0.68))-0.08, f3=sdSeg(p,vec2(0.08,0.15),vec2(0.09,0.64))-0.08, f4=sdSeg(p,vec2(0.24,0.12),vec2(0.28,0.44))-0.07;
    float th=sdSeg(p,vec2(-0.3,-0.25),vec2(-0.6,0.08))-0.08;
    float d=min(min(min(palm,th),min(f1,f2)),min(f3,f4));
    v=silo(d); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==44){ // 鬼面：圆顶、飘摆的尾、眼口挖空
    float wav=0.12*sin(p.x*9.0+uSeed);
    float head=length(p-vec2(0.0,0.22))-0.46; float tail=max(abs(p.x)-0.46*smoothstep(-0.95,0.2,p.y), -(p.y+0.85+wav)); tail=max(tail,p.y-0.25);
    float d=min(head,tail);
    float holes=min(min(length(p-vec2(-0.17,0.27))-0.1, length(p-vec2(0.17,0.27))-0.1), sdEll(p-vec2(0.0,0.0),vec2(0.12,0.07)));
    d=max(d,-holes);
    v=silo(d)*(0.7+0.3*smoothstep(-0.9,0.3,p.y)); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==45){ // 音波：四道向右的弧
    v=0.0;
    for(int k=0;k<4;k++){ float fk=float(k); float r=0.25+fk*0.2; float tap=smoothstep(0.85,0.4,abs(A)); v+=smoothstep(0.03,0.0,abs(L-r))*tap*(1.0-fk*0.15); }
    v+=pow(0.06/max(L,0.001),1.4)*0.6; v=min(v,1.0)*edgeFade(p);
  } else if(uMode==46){ // 符文环：环带内一格一字
    float seg=A/TAU*20.0; float id=floor(seg); vec2 f=vec2(fract(seg)-0.5, (L-0.775)/0.09);
    float st=0.0; float h=h1(vec2(id,uSeed));
    st+=smoothstep(0.1,0.04,abs(f.y-0.4*(h-0.5)))*step(abs(f.x),0.32);
    st+=smoothstep(0.08,0.03,abs(f.x-0.3*(h1(vec2(id,uSeed+1.0))-0.5)))*step(abs(f.y),0.7);
    if(h>0.55) st+=smoothstep(0.1,0.04,abs(f.y+0.5))*step(abs(f.x),0.25);
    v=min(st,1.0)*step(0.69,L)*step(L,0.86)+smoothstep(0.02,0.006,abs(L-0.66))+smoothstep(0.02,0.006,abs(L-0.89));
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==47){ // 梅花：五瓣圆瓣 + 花蕊
    float d=10.0; for(int i=0;i<5;i++){ float a0=float(i)*TAU/5.0+PI/2.0; d=min(d, length(p-vec2(cos(a0),sin(a0))*0.4)-0.3); }
    v=fillD(d,0.015)*(0.5+0.5*smoothstep(0.0,0.7,L))+0.2*halo(d,14.0)*step(0.0,d);
    for(int i=0;i<8;i++){ float a0=float(i)*TAU/8.0; v+=smoothstep(0.03,0.0,length(p-vec2(cos(a0),sin(a0))*0.18)-0.02)*0.9+smoothstep(0.01,0.0,sdSeg(p,vec2(0.0),vec2(cos(a0),sin(a0))*0.18))*0.4; }
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==48){ // 涟漪：三重细环，由内而外渐淡
    v=smoothstep(0.02,0.004,abs(L-0.3))+0.75*smoothstep(0.02,0.004,abs(L-0.56))+0.5*smoothstep(0.02,0.004,abs(L-0.82));
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==49){ // 金钟（侧视）：钟顶、钟身、钟口外撇、两道箍
    float hw=0.26+0.36*pow(smoothstep(0.55,-0.75,p.y),1.6); float d=max(abs(p.x)-hw, max(p.y-0.6, -(p.y+0.78)));
    d=min(d, length(p-vec2(0.0,0.7))-0.1);
    v=silo(d)+0.5*fillD(d,0.01)*(smoothstep(0.03,0.0,abs(p.y+0.42))+smoothstep(0.03,0.0,abs(p.y-0.15)));
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==50){ // 葫芦（口朝上）
    float d=min(length(p-vec2(0.0,-0.35))-0.42, length(p-vec2(0.0,0.25))-0.27); d=min(d, sdBox(p-vec2(0.0,0.6),vec2(0.08,0.12)));
    v=silo(d)+0.5*smoothstep(0.03,0.0,abs(p.y-0.02))*fillD(d,0.01); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==51){ // 伞（俯视的伞面 + 伞骨）
    float r=0.85*(0.93+0.07*cos(A*8.0)); float d=L-r;
    float rib=smoothstep(0.02,0.0,abs(fract(A/TAU*8.0+0.5)-0.5)*L*0.8)*step(L,r);
    v=fillD(d,0.015)*(0.4+0.25*smoothstep(0.0,0.8,L))+rib*0.6+smoothstep(0.03,0.0,abs(d))*0.9+smoothstep(0.08,0.0,L-0.06)*0.9;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==52){ // 宝塔：七级飞檐
    float d=10.0; for(int i=0;i<6;i++){ float fi=float(i); float y0=-0.8+fi*0.25; float w=0.5-fi*0.065; d=min(d, sdBox(p-vec2(0.0,y0+0.07),vec2(w*0.62,0.08))); d=min(d, sdBox(p-vec2(0.0,y0+0.17),vec2(w,0.022)+vec2(0.0,0.02*(1.0-abs(p.x)/w)))); }
    d=min(d, sdSeg(p,vec2(0.0,0.7),vec2(0.0,0.95))-0.025);
    v=silo(d); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==53){ // 大印：方印 + 印钮 + 印面篆文
    float d=min(sdBox(p-vec2(0.0,-0.25),vec2(0.55,0.42))-0.03, length(p-vec2(0.0,0.42))-0.22);
    vec2 f=fract((p+vec2(0.45,0.6))/0.3)-0.5; float gl=0.0; if(abs(p.x)<0.45&&p.y<0.1&&p.y>-0.6){ float h=h1(floor((p+vec2(0.45,0.6))/0.3)+uSeed); gl=h<0.5?smoothstep(0.08,0.04,abs(f.y)):smoothstep(0.08,0.04,abs(f.x)); }
    v=silo(d)*(1.0-0.55*gl); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==54){ // 灯（莲花灯座 + 灯焰）
    float base=sdEll(p-vec2(0.0,-0.55),vec2(0.45,0.16)), cup=max(sdEll(p-vec2(0.0,-0.3),vec2(0.32,0.22)),p.y+0.22);
    float fl=flameSh((p-vec2(0.0,0.2))*vec2(2.2,1.4),uSeed,0.5);
    v=silo(min(base,cup))*0.85+fl*1.1+0.35*halo(length(p-vec2(0.0,0.15))-0.1,4.0);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==55){ // 神识之眼：杏眼、虹膜环、瞳仁
    float e=max(length(p-vec2(0.0,-0.55))-0.85, length(p-vec2(0.0,0.55))-0.85);
    float iris=abs(length(p)-0.22)-0.035;
    v=smoothstep(0.03,0.0,abs(e))+fillD(iris,0.01)*0.9+fillD(L-0.09,0.01)*0.9+0.15*fillD(e,0.02)+0.3*halo(abs(e),16.0);
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==56){ // 竖劈雷：主干自顶劈下，数条枝杈
    float x0=0.22*(fbm(vec2(p.y*2.2,uSeed))-0.5)*2.0+0.05*(vn(vec2(p.y*14.0,uSeed))-0.5);
    float d=abs(p.x-x0);
    for(int i=0;i<4;i++){ float fi=float(i); float y0=0.55-fi*0.4; float dir=h1(vec2(fi,uSeed))<0.5?-1.0:1.0; float yy=y0-p.y; if(yy>0.0&&yy<0.35){ float bx=x0+dir*yy*0.9+0.06*(vn(vec2(p.y*16.0,fi))-0.5); d=min(d, abs(p.x-bx)+yy*0.05); } }
    v=0.004/max(d,0.002)+0.4*exp(-d*30.0); v=clamp(v,0.0,1.0)*smoothstep(1.0,0.85,abs(p.y))*smoothstep(1.0,0.7,abs(p.x));
  } else if(uMode==57){ // 佛光：柔和放射光晕
    float seg=A/TAU*36.0+uSeed; float w=pow(0.5+0.5*cos(seg*TAU),2.0);
    v=(0.35+0.65*w)*smoothstep(1.0,0.2,L)*smoothstep(0.0,0.2,L)*0.8+pow(0.15/max(L,0.001),1.2)*0.5;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==58){ // 山岳：三峰剪影（底平）
    float h=max(max(0.85-abs(p.x)*1.9, 0.5-abs(p.x+0.5)*1.7), 0.45-abs(p.x-0.52)*1.6)+0.05*(fbm(vec2(p.x*6.0,uSeed))-0.5);
    float d=max(p.y-(h*1.5-0.75), -(p.y+0.8)); d=max(d, abs(p.x)-0.95);
    v=silo(d)*(0.75+0.25*smoothstep(-0.8,0.6,p.y)); v=min(v,1.0);
  } else if(uMode==59){ // 星野：疏密不一的小星
    v=0.0; for(int i=0;i<26;i++){ vec2 c=(hash2(vec2(float(i),uSeed))-0.5)*1.7; float s=0.02+0.05*h1(vec2(uSeed,float(i))); vec2 q=abs(p-c);
      v+=s*0.04/max(length(q),0.002)+exp(-q.y*90.0)*smoothstep(s*3.0,0.0,q.x)*0.6+exp(-q.x*90.0)*smoothstep(s*3.0,0.0,q.y)*0.6; }
    v=clamp(v,0.0,1.0)*edgeFade(p);
  } else if(uMode==60){ // 交叉剑痕（X）
    vec2 a=rot(0.78)*p, b=rot(-0.78)*p;
    float s1=abs(a.y)-0.06*pow(max(0.0,1.0-abs(a.x)/0.95),0.7), s2=abs(b.y)-0.06*pow(max(0.0,1.0-abs(b.x)/0.95),0.7);
    float d=min(s1,s2); v=fillD(d,0.012)+0.4*halo(d,12.0)*step(0.0,d)+pow(0.07/max(L,0.001),1.5)*0.5;
    v=min(v,1.0)*edgeFade(p);
  } else if(uMode==61){ // 符纸：纸面（浅）+ 朱砂符文（深）+ 边框
    float paper=sdBox(p,vec2(0.36,0.85));
    float fr=abs(sdBox(p,vec2(0.3,0.78)))-0.012;
    float gl=min(min(sdSeg(p,vec2(0.0,0.6),vec2(0.0,-0.65))-0.025, sdSeg(p,vec2(-0.18,0.4),vec2(0.18,0.4))-0.02), min(sdSeg(p,vec2(-0.2,0.1),vec2(0.2,-0.05))-0.02, length(p-vec2(0.0,-0.3))-0.1));
    gl=min(gl, abs(length(p-vec2(0.0,-0.3))-0.18)-0.015);
    v=fillD(paper,0.01)*(0.95-0.6*fillD(gl,0.01)-0.4*fillD(fr,0.008)); v=clamp(v,0.0,1.0);
  } else if(uMode==62){ // 羽翼：一侧展开的翅（根在左下）
    float d=10.0; for(int i=0;i<7;i++){ float fi=float(i); float a0=0.25+fi*0.17; vec2 tip=vec2(-0.75,-0.4)+vec2(cos(a0),sin(a0))*(1.35-fi*0.08); d=min(d, sdSeg(p,vec2(-0.75,-0.4)+vec2(cos(a0),sin(a0))*0.2,tip)-0.07*(1.0-fi*0.06)); }
    v=silo(d); v=min(v,1.0)*edgeFade(p);
  } else if(uMode==63){ // 烈日：日轮 + 冕焰
    float cor=0.55+0.08*(fbm(vec2(A*3.0,uSeed))-0.5)*2.0+0.06*sin(A*12.0);
    v=fillD(L-0.42,0.01)*(0.85+0.15*fbm(p*6.0))+smoothstep(cor,0.42,L)*step(0.42,L)*0.7+0.3*halo(L-cor,6.0);
    v=min(v,1.0)*edgeFade(p);
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
  // —— 第 6 阶段（模式 18–63 依次一格）
  ...Array.from({ length: 46 }, (_, i): [number, number, number, number] => [18 + i, [0.7, 1.9, 3.3][i % 3], 0, 0]),
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
