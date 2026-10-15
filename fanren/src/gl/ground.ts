// 第十一步：GPU 地表（全分辨率、程序化、无平铺痕迹）
// 取代旧的 Canvas2D 低分辨率分块底图（每 1024 世界像素只有 384 像素，放大后发糊、像塑料）。
// 每帧一次全屏着色器，按世界坐标逐像素计算：
//   草甸（成片疏密 + 草叶笔触 + 起伏光影 + 野花）、林下苔藓落叶、裸土、山地碎石裂纹、草原、沙丘、积雪、
//   海岸沙滩与湿沙、浅水焦散、海浪高光、岸线浪花、流动的河水与河岸、夯土官道与车辙、城镇周边田畴，
//   以及与山树一致的水墨勾线（岸线、河岸、路缘）。
// 海岸线与 CPU 的 Terrain.isLand 逐位一致（同一张高精度陆地图 + 同一个可移植噪声）。

/** 地表静态层与每帧水面动画共用的 GLSL：可移植哈希、纹理噪声（采样器名 uN） */
export const GLSL_COMMON = `// ---------- 可移植哈希 / 值噪声（与 core/rng.ts 的 hashU / pnoise 逐位一致）
uint hu(int x,int y,int s){ uint h=uint(x)*374761393u+uint(y)*668265263u+uint(s)*2246822519u; h=(h^(h>>13u))*1274126177u; h^=(h>>16u); return h; }
float hashU(int x,int y,int s){ return float(hu(x,y,s))/4294967296.0; }
float pnoise(vec2 p,int s){ vec2 fi=floor(p); ivec2 i=ivec2(fi); vec2 f=p-fi;
  float a=hashU(i.x,i.y,s), b=hashU(i.x+1,i.y,s), c=hashU(i.x,i.y+1,s), d=hashU(i.x+1,i.y+1,s);
  vec2 u=f*f*(3.0-2.0*f); return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y; }

// ---------- 纹理噪声：512² 四通道，每块 32 格，可平铺，带 mipmap（缩小时自动抗锯齿）
vec4 N4(vec2 p){ return texture(uN, p*(1.0/32.0)); }
const mat2 RT=mat2(0.8,0.6,-0.6,0.8);
float fbm3(vec2 p){ float s=N4(p).r*0.5; p=RT*p*2.03+vec2(1.7,9.2); s+=N4(p).g*0.25; p=RT*p*2.01+vec2(5.3,2.8); s+=N4(p).b*0.125; return s/0.875; }
float fbm2(vec2 p){ float s=N4(p).r*0.66; p=RT*p*2.03+vec2(3.1,7.7); s+=N4(p).a*0.34; return s; }
float ridge(float n){ return 1.0-abs(n*2.0-1.0); }
`;

const VS = `#version 300 es
out vec2 vUv; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;

export const MAX_SEG = 256, MAX_TOWN = 6;

const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uTA, uTB, uN; uniform highp sampler2D uSeg;
uniform vec2 uMacro; uniform float uScale;
uniform vec2 uCam; uniform float uTPW; uniform vec2 uRes; uniform int uSeason; // uCam=缓存中心（世界），uTPW=每世界像素的纹素数
uniform int uNRiv, uNRoad; // 线段数据纹理：行0/1 河段（端点 / 宽,累计长），行2/3 路段（端点 / 宽,官道）
uniform vec4 uTown[${MAX_TOWN}]; uniform ivec4 uTownS[${MAX_TOWN}]; uniform int uNTown;
layout(location=0) out vec4 oA; layout(location=1) out vec4 oB;

${GLSL_COMMON}
// 细胞噪声：x=到最近点距离，y=F2-F1（石块缝隙），z=所在细胞的随机值
vec3 voro(vec2 p,int s){ vec2 fi=floor(p); ivec2 ip=ivec2(fi); vec2 f=p-fi; float d1=8.0,d2=8.0,id=0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ int cx=ip.x+i, cy=ip.y+j;
    vec2 o=vec2(float(i),float(j))+vec2(hashU(cx,cy,s),hashU(cx,cy,s+1))*0.8+0.1; float d=length(o-f);
    if(d<d1){ d2=d1; d1=d; id=hashU(cx,cy,s+2); } else if(d<d2) d2=d; }
  return vec3(d1,d2-d1,id); }

// 宏观地图：A=(陆地,海拔,干旱,寒冷) B=(森林,水深,-,-)，iq 平滑插值（去掉双线性折痕）
vec4 smoothTex(sampler2D t, vec2 m){ vec2 p=m+1.0; vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); return texture(t,(i+f-0.5)/uMacro); }

float segDist(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-3),0.0,1.0); return length(pa-ba*h); }
// 一丛草（手绘笔触）：每格一丛，3~4 片叶从同一基点扇形张开，叶根粗、叶尖细。
// 返回 x=覆盖度 y=叶尖程度(0 根 1 尖) z=该丛的色调随机
vec4 tuft(vec2 w, float cs, int sd, float dens, float wpp, float lean){
  vec2 c=floor(w/cs); int cx=int(c.x), cy=int(c.y);
  if(hashU(cx,cy,sd)>dens) return vec4(0.0);
  vec2 base=(c+vec2(0.3+0.4*hashU(cx,cy,sd+1), 0.78+0.12*hashU(cx,cy,sd+2)))*cs;
  vec2 lp=w-base;
  float sz=cs*(0.42+0.22*hashU(cx,cy,sd+3));
  float cov=0.0, tip=0.0;
  for(int k=0;k<4;k++){
    float a=(float(k)-1.5)*0.42+(hashU(cx,cy,sd+4+k)-0.5)*0.35+lean;
    float L=sz*(0.55+0.45*hashU(cx,cy,sd+9+k))*((k==1||k==2)?1.0:0.72);
    vec2 dir=vec2(sin(a),-cos(a));
    // 叶片略弯：沿叶向外侧偏
    float hh; float d=segDist(lp,vec2(0.0),dir*L,hh);
    float bend=hh*hh*L*0.18*sign(a+1e-3);
    d=length(lp-(dir*L*hh+vec2(dir.y,-dir.x)*-bend));
    float wd=mix(cs*0.075,cs*0.012,hh);
    float m=clamp((wd-d)/wpp+0.5,0.0,1.0);
    if(m>cov){ cov=m; tip=hh; }
  }
  // 草根处一小团柔和的阴影（让草丛“立”在地上）
  float sh=exp(-dot(lp/vec2(sz*0.55,sz*0.16),lp/vec2(sz*0.55,sz*0.16)));
  return vec4(cov,tip,hashU(cx,cy,sd+20),sh);
}

vec3 seasonGrass(float lush, float dry){
  // 春：嫩绿；夏：青绿；秋：金黄；冬：枯黄（积雪另算）
  vec3 L, M, D;
  if(uSeason==0){ L=vec3(0.52,0.67,0.37); M=vec3(0.67,0.77,0.47); D=vec3(0.80,0.79,0.56); }
  else if(uSeason==1){ L=vec3(0.47,0.61,0.35); M=vec3(0.61,0.71,0.44); D=vec3(0.77,0.76,0.53); }
  else if(uSeason==2){ L=vec3(0.63,0.60,0.34); M=vec3(0.75,0.68,0.42); D=vec3(0.82,0.74,0.50); }
  else { L=vec3(0.58,0.58,0.46); M=vec3(0.68,0.66,0.54); D=vec3(0.78,0.75,0.63); }
  vec3 c=mix(M,L,smoothstep(0.35,0.85,lush));
  return mix(c,D,dry);
}

void main(){
  // 设备像素（左上为原点，与 uScene 的 uv 一致）→ 世界坐标（相对相机，保精度）
  vec2 px=gl_FragCoord.xy;
  vec2 rel=(px-uRes*0.5)/uTPW;
  vec2 w=uCam+rel;
  float wpp=1.0/uTPW;                 // 每纹素对应的世界像素
  float near=smoothstep(2.3,1.0,wpp);  // 近景细节（草叶、石子、野花）——第十七步：常用缩放（dpr 1、zoom 0.8）下也要看得见
  vec2 m0=w/uScale;

  // ---------- 陆地（与 CPU isLand 一致）
  float L=texture(uTA,(m0+0.5)/uMacro).r + (pnoise(w/150.0,9)-0.5)*0.12;
  float fwL=max(fwidth(L),1e-5);

  // ---------- 生物群落（带域扭曲，边界成自然的不规则形状）
  vec2 wq=vec2(fbm2(w/1300.0), fbm2(w/1300.0+vec2(37.0,11.0)))-0.5;
  vec2 mw=m0+wq*2.4;
  vec4 A=smoothTex(uTA,mw); vec4 B=smoothTex(uTB,mw);
  float elev=A.g, arid=A.b, cold=A.a, forest=B.r, depth=B.g;
  // 宏观起伏光照（左上方来光）
  float ex=smoothTex(uTA,mw+vec2(0.6,0.0)).g-smoothTex(uTA,mw-vec2(0.6,0.0)).g;
  float ey=smoothTex(uTA,mw+vec2(0.0,0.6)).g-smoothTex(uTA,mw-vec2(0.0,0.6)).g;
  vec3 LD=normalize(vec3(-0.55,-0.75,0.75));
  float hill=dot(normalize(vec3(-ex*2.2,-ey*2.2,1.0)),LD)-LD.z;

  // ---------- 草甸
  float pM=fbm3(w/2600.0);                       // 成片的青翠 / 枯黄
  float pC=fbm3(w/320.0+vec2(11.0,3.0));          // 草丛团块
  float lush=clamp(pM*1.25-0.12+(pC-0.5)*0.18,0.0,1.0);
  float dryK=clamp((arid-0.25)*1.3,0.0,1.0)*0.8 + smoothstep(0.62,0.85,1.0-pM)*0.2;
  vec3 col=seasonGrass(lush,clamp(dryK,0.0,1.0));
  // 第十七步：平坡用“横擦”——沿水平方向拉长的淡彩晕染（山水画里坡地的画法），不再是一团团的噪声斑
  vec2 hq0=w+vec2(0.0,(fbm2(w/1700.0)-0.5)*420.0);
  float hs1=fbm3(vec2(hq0.x/1150.0,hq0.y/150.0)+vec2(13.0,5.0));
  float hs2=fbm2(vec2(hq0.x/430.0,hq0.y/46.0)+vec2(3.0,29.0));
  float washA=smoothstep(0.50,0.68,hs1);
  col=mix(col,col*vec3(0.85,0.91,0.81),washA*0.6);                     // 深一层的青绿：坡脚背阴
  col*=1.0-exp(-pow((hs1-0.515)/0.02,2.0))*0.06;                        // 水痕：晕染边缘积色
  col=mix(col,mix(col,vec3(0.87,0.87,0.67),0.4),smoothstep(0.42,0.26,hs1)*0.55);   // 向阳坡：浅黄绿
  col=mix(col,col*vec3(0.93,0.96,0.89),smoothstep(0.56,0.74,hs2)*0.4);
  // 干笔飞白：细长的横向擦痕，透出纸色（只在部分地段，避免满地都是）
  float dbN=N4(vec2(w.x/95.0,w.y/5.5)+vec2(0.31,0.17)).g;
  float dbM=smoothstep(0.55,0.8,fbm2(w/520.0+vec2(9.0,9.0)));
  col=mix(col,vec3(0.93,0.915,0.85),smoothstep(0.64,0.8,dbN)*dbM*0.2*mix(0.4,1.0,near));
  float pb=hs2;
  // 草丛起伏（很轻）：受光面略亮、背光略暗
  float h0=fbm2(w/150.0+vec2(4.0,9.0));
  float hx=fbm2((w+vec2(9.0,0.0))/150.0+vec2(4.0,9.0)), hy=fbm2((w+vec2(0.0,9.0))/150.0+vec2(4.0,9.0));
  float bump=dot(normalize(vec3((h0-hx)*7.0,(h0-hy)*7.0,1.0)),LD)-LD.z;
  col*=1.0+bump*0.08;   // 假法线光照只留一点点（多了像塑料）
  // 细纹理：极细的竖向草纹（远看是质感）
  float b1=N4(vec2(w.x/5.0+w.y/38.0, w.y/24.0)).g;
  float b2=N4(vec2(w.x/4.2-w.y/52.0, w.y/19.0)+vec2(0.37,0.71)).b;
  float blades=(b1+b2)*0.5;
  col*=0.975+0.05*blades;
  // 手绘草丛：两层网格（小丛密、大丛疏），叶根深、叶尖亮
  float tufCov=0.0;
  if(near>0.01){
    float lean=(fbm2(w/600.0)-0.5)*0.5;
    // 成簇：中尺度噪声决定疏密，密处一片片、疏处零星（不再均匀撒点）
    // 第十七步：明显成簇——一片片草丛，中间是素净的平地
    float clusN=fbm2(w/220.0+vec2(61.0,17.0))*0.7+fbm2(w/900.0+vec2(3.0,40.0))*0.3;
    float clus=smoothstep(0.45,0.72,clusN);
    float dens=(0.03+0.8*clus*clus)*(0.55+0.45*lush)*(1.0-arid*0.7);
    vec4 t1=tuft(w,18.0,301,dens,wpp,lean);
    vec4 t2=tuft(w+vec2(7.0,4.0),40.0,331,dens*0.55,wpp,lean);
    vec4 t3=tuft(w+vec2(23.0,11.0),72.0,361,clus*0.35*(1.0-arid),wpp,lean*1.3);
    col*=1.0-(max(t2.w,t3.w))*0.14*near;
    vec4 tt=t2.x>t1.x?t2:t1; tt=t3.x>tt.x?t3:tt;
    col*=1.0-clus*0.06;
    // 三种笔色：深青（阴面）/ 本色 / 嫩黄（受光的叶尖）
    vec3 dark=col*vec3(0.50,0.62,0.48), lite=min(col*vec3(1.12,1.12,0.96)+vec3(0.06,0.06,0.0),vec3(1.0));
    vec3 tc=mix(dark,lite,smoothstep(0.15,0.95,tt.y)*(0.35+0.65*tt.z));
    tufCov=tt.x*near;
    col=mix(col,tc,tufCov*0.9);
  }

  // 裸土斑（踩秃的地、鼠穴、旧火塘）
  float soilN=fbm3(w/250.0+vec2(77.0,13.0));
  float soil=smoothstep(0.78,0.86,soilN-lush*0.12+(N4(vec2(w.x/40.0,w.y/6.0)).r-0.5)*0.1);
  vec3 soilC=mix(vec3(0.72,0.66,0.50),vec3(0.80,0.75,0.59),N4(vec2(w.x/120.0,w.y/30.0)).a);

  // 野花（春夏），落叶（秋）
  float flowers=0.0; vec3 flowerC=vec3(1.0);
  if(near>0.01 && uSeason<=1){
    vec2 cell=floor(w/11.0); vec2 fc=(cell+vec2(hashU(int(cell.x),int(cell.y),71),hashU(int(cell.x),int(cell.y),72)))*11.0;
    float hf=hashU(int(cell.x),int(cell.y),73);
    float dens=smoothstep(0.6,0.82,fbm2(w/520.0+vec2(5.0,1.0))*0.75+fbm2(w/90.0+vec2(1.0,8.0))*0.25)*0.42*(1.0-arid);   // 花成片开
    if(hf<dens){ float r=length(w-fc); float k=hashU(int(cell.x),int(cell.y),74);
      flowerC = k<0.35?vec3(0.97,0.96,0.90): k<0.6?vec3(0.98,0.84,0.36): k<0.82?vec3(0.95,0.62,0.70): vec3(0.70,0.62,0.92);
      flowers=(1.0-smoothstep(1.0,2.0+wpp,r))*near; }
  }

  // ---------- 林下：苔藓、腐叶
  float fW=smoothstep(0.35,0.78,forest+(pC-0.5)*0.35);
  vec3 forestC=mix(vec3(0.42,0.52,0.34),vec3(0.54,0.61,0.40),smoothstep(0.3,0.7,fbm2(vec2(w.x/300.0,w.y/70.0)+vec2(2.0,8.0))));
  if(uSeason==2) forestC=mix(forestC,vec3(0.56,0.40,0.20),0.45);
  float litter=smoothstep(0.62,0.7,N4(w/7.0).r)*near;
  forestC=mix(forestC, uSeason==2?vec3(0.78,0.48,0.20):vec3(0.46,0.40,0.26), litter*0.5);
  forestC*=1.0+bump*0.12;
  col=mix(col,forestC*(1.0-tufCov*0.12),fW*0.7);
  // 苔点：三五成群的横点（墨绿），点在草根、坡脚、林下——山水画的“点苔”
  if(near>0.01){
    float dz=smoothstep(0.52,0.78,fbm2(w/260.0+vec2(41.0,7.0))+fW*0.2)*(1.0-arid*0.8)*(1.0-smoothstep(0.5,0.8,cold));
    vec2 dc=floor(w/13.0); int ix=int(dc.x), iy=int(dc.y);
    float hd=hashU(ix,iy,501);
    if(hd<dz*0.6){
      vec2 pc=(dc+vec2(0.2+0.6*hashU(ix,iy,502),0.2+0.6*hashU(ix,iy,503)))*13.0;
      vec2 q=(w-pc)*vec2(1.0,2.0);
      float r=1.5+hashU(ix,iy,504)*1.9;
      float dk=clamp((r-length(q))/wpp+0.5,0.0,1.0)*near;
      col=mix(col,col*vec3(0.36,0.45,0.36),dk*0.7);
    }
  }

  // ---------- 草原（干旱 0.42~0.8）：风吹的横向草纹
  float steppe=smoothstep(0.40,0.60,arid)*(1.0-smoothstep(0.74,0.9,arid));
  if(steppe>0.001){
    // 风吹草低：横向长条草浪（缓慢移动），春夏青黄、秋金、冬枯白
    float sw=N4(vec2(w.x/60.0,w.y/7.0)+vec2(0.2,0.6)).g;
    float sw2=N4(vec2(w.x/22.0,w.y/3.5)+vec2(5.2,1.6)).b;
    vec3 sA, sB;
    if(uSeason==0){ sA=vec3(0.62,0.70,0.42); sB=vec3(0.76,0.78,0.50); }
    else if(uSeason==1){ sA=vec3(0.66,0.70,0.40); sB=vec3(0.80,0.78,0.50); }
    else if(uSeason==2){ sA=vec3(0.76,0.66,0.38); sB=vec3(0.86,0.76,0.48); }
    else { sA=vec3(0.72,0.68,0.54); sB=vec3(0.82,0.78,0.64); }
    vec3 stC=mix(sA,sB,smoothstep(0.3,0.75,pM+(pb-0.5)*0.4))*(0.92+0.12*sw+0.06*sw2);
    stC=mix(stC,stC*vec3(0.8,0.86,0.72),tufCov*0.6);
    stC*=1.0+bump*0.35;
    col=mix(col,stC,steppe);
  }
  // ---------- 荒漠沙丘
  float desert=smoothstep(0.74,0.9,arid);
  if(desert>0.001){
    vec2 dw=w+vec2(fbm2(w/900.0),fbm2(w/900.0+3.0))*260.0;
    float dh=ridge(fbm3(vec2(dw.x/700.0,dw.y/380.0)));
    float dhx=ridge(fbm3(vec2((dw.x+14.0)/700.0,dw.y/380.0))), dhy=ridge(fbm3(vec2(dw.x/700.0,(dw.y+14.0)/380.0)));
    float ds=dot(normalize(vec3((dh-dhx)*9.0,(dh-dhy)*9.0,1.0)),LD)-LD.z;
    float rip=sin(dw.y/9.0+dw.x/40.0+fbm2(dw/120.0)*6.0)*0.5+0.5;
    vec3 dC=mix(vec3(0.84,0.72,0.52),vec3(0.93,0.84,0.64),dh);
    dC*=1.0+ds*0.9+(rip-0.5)*0.05*near;
    col=mix(col,dC,desert);
  }
  // ---------- 山地：碎石、岩缝、地衣
  float rock=smoothstep(0.45,0.8,elev+(fbm2(w/240.0)-0.5)*0.3);
  if(rock>0.001){
    float rn=fbm3(w/90.0+vec2(31.0,7.0));
    vec3 rC=mix(vec3(0.62,0.60,0.53),vec3(0.76,0.73,0.64),rn);
    // 裸露的岩板：细胞噪声分块，块面各自明暗，缝隙积暗；只在部分区域露出，其余是碎石土
    vec2 vp=w/150.0+vec2(fbm2(w/220.0),fbm2(w/220.0+7.0))*1.3;
    vec3 vr=voro(vp,121);
    float slab=smoothstep(0.66,0.74,fbm2(w/420.0+vec2(19.0,3.0))+elev*0.15)*step(0.35,vr.z);
    float face=0.92+0.16*vr.z;
    float gap=1.0-smoothstep(0.015,0.05+wpp/150.0,vr.y);
    // 岩块：中部受光，边缘下侧积暗，缝隙只淡淡一笔
    vec3 vr2=voro(vp+vec2(0.04,0.06),121);
    float relief=clamp((vr2.x-vr.x)*12.0,-1.0,1.0);
    rC=mix(rC,rC*(face+relief*0.06)*(1.0-gap*0.12),slab*smoothstep(0.3,0.7,rock));
    rC=mix(rC,vec3(0.56,0.60,0.40),smoothstep(0.66,0.74,N4(w/24.0+vec2(7.0,3.0)).a)*0.35);   // 地衣
    float scree=smoothstep(0.72,0.8,N4(w/6.0).r)*near; rC=mix(rC,rC*1.18,scree);
    rC*=1.0+bump*0.45;
    col=mix(col,rC,rock*(0.75-tufCov*0.4));
  }
  // ---------- 积雪（寒地 + 冬季原野薄雪）
  float snow=smoothstep(0.5,0.7,cold+elev*0.18+(fbm2(w/300.0)-0.5)*0.16);
  if(uSeason==3) snow=max(snow, smoothstep(0.35,0.6,fbm3(w/500.0)+0.25-arid*0.3)*0.85);
  if(snow>0.001){
    // 雪垄：横向拉长的起伏，背光面是淡淡的青灰（像留白边上一抹淡墨）
    float sd=fbm3(vec2(w.x/760.0,w.y/150.0));
    float sdx=fbm3(vec2((w.x+14.0)/760.0,w.y/150.0)), sdy=fbm3(vec2(w.x/760.0,(w.y+14.0)/150.0));
    float ss=dot(normalize(vec3((sd-sdx)*9.0,(sd-sdy)*9.0,1.0)),LD)-LD.z;
    vec3 sC=mix(vec3(0.80,0.84,0.89),vec3(0.965,0.965,0.96),clamp(0.7+ss*2.6,0.0,1.0));
    sC*=1.0-exp(-pow((sd-0.55)/0.025,2.0))*0.05;
    sC=mix(sC,vec3(0.985,0.98,0.97),smoothstep(0.66,0.8,N4(vec2(w.x/110.0,w.y/7.0)+vec2(0.7,0.2)).b)*0.3);   // 风吹雪的细痕
    // 冰晶闪烁
    vec2 sc=floor(w/5.0); float sp=hashU(int(sc.x),int(sc.y),91);
    sC+=step(0.985,sp)*near*0.12;
    // 雪下露出的枯草
    sC=mix(sC,mix(vec3(0.60,0.55,0.42),vec3(0.76,0.70,0.54),tufCov),tufCov*(1.0-smoothstep(0.4,0.8,cold))*0.75);
    col=mix(col,sC,snow);
  }

  // 裸土
  col=mix(col,soilC*(1.0+bump*0.1),soil*(1.0-snow)*(1.0-desert)*(1.0-rock*0.7)*(0.42-tufCov*0.3));

  // ---------- 田畴（城镇周边，与 Terrain.inField 同构）
  for(int k=0;k<${MAX_TOWN};k++){
    if(k>=uNTown) break;
    vec4 tw=uTown[k]; ivec4 ts=uTownS[k];
    vec2 d=rel-tw.xy; float ca=cos(tw.w), sa=sin(tw.w);
    float u=d.x*ca+d.y*sa, v=-d.x*sa+d.y*ca;
    if(abs(u)>tw.z+400.0||abs(v)>tw.z+400.0) continue;
    float cw=300.0, chh=210.0;
    int j=int(floor(v/chh)); float off=((j&1)!=0)?cw*0.4:0.0;
    int i=int(floor((u-off)/cw));
    float fx=float(i)*cw+off, fy=float(j)*chh;
    float dd=length(vec2(fx+cw*0.5,(fy+chh*0.5)*1.2));
    float h=hashU(i+ts.x,j+ts.y,5);
    if(dd>tw.z*(0.55+0.45*h)||dd<620.0||h<0.12) continue;
    if(L<0.62||elev>0.3||cold>0.6||arid>0.75) continue;
    vec2 lp=vec2(u-fx,v-fy);                       // 田内坐标
    float edge=min(min(lp.x,cw-lp.x),min(lp.y,chh-lp.y));
    float crop=hashU(i+ts.x,j+ts.y,6);
    vec3 fC;
    if(uSeason==0) fC= crop<0.35?vec3(0.86,0.80,0.30): crop<0.7?vec3(0.55,0.68,0.34): vec3(0.60,0.50,0.38);   // 油菜花 / 青苗 / 翻耕
    else if(uSeason==1) fC= crop<0.4?vec3(0.42,0.58,0.30): crop<0.7?vec3(0.52,0.64,0.34): vec3(0.46,0.62,0.56); // 稻田带水光
    else if(uSeason==2) fC= crop<0.55?vec3(0.84,0.70,0.36): crop<0.8?vec3(0.74,0.62,0.38): vec3(0.62,0.50,0.36); // 金黄 / 收割后 / 翻耕
    else fC= crop<0.5?vec3(0.62,0.54,0.44): vec3(0.70,0.66,0.58);
    // 垄沟
    bool vert=h>0.55; float rowc=vert?lp.x:lp.y;
    float row=sin(rowc*(6.2831/16.0))*0.5+0.5;
    fC*=0.9+0.16*row*mix(0.4,1.0,near);
    fC*=0.95+0.1*(N4(w/40.0+float(k)).r-0.5)*2.0;
    float inF=smoothstep(4.0,9.0+wpp,edge);
    vec3 ridgeC=col*vec3(0.82,0.86,0.76);         // 田埂：草色略深
    col=mix(col,mix(ridgeC,fC,inF),smoothstep(0.0,4.0,edge+2.0));
  }

  // 宏观山坡光影 + 草地野花
  col*=1.0+hill*0.9;
  col=mix(col,flowerC,flowers*(1.0-snow)*(1.0-desert));

  // ---------- 官道 / 小径
  float roadMask=0.0, roadHalo=0.0; vec3 roadC=vec3(0.0);
  float bestR=1e9; float bestH=0.0; vec4 bestRW=vec4(0.0); vec2 bestA=vec2(0.0), bestB=vec2(0.0);
  for(int k=0;k<${MAX_SEG};k++){
    if(k>=uNRoad) break;
    vec4 s=texelFetch(uSeg,ivec2(k,2),0); float hh; float dd=segDist(rel,s.xy,s.zw,hh);
    if(dd<bestR){ bestR=dd; bestH=hh; bestRW=texelFetch(uSeg,ivec2(k,3),0); bestA=s.xy; bestB=s.zw; }
  }
  if(bestR<200.0){
    float rw=bestRW.x*0.5;
    float jag=(fbm2(w/36.0)-0.5)*rw*0.55+(N4(w/9.0).g-0.5)*2.5*near;
    float d=bestR+jag;
    roadHalo=1.0-smoothstep(rw,rw+26.0,d);
    roadMask=1.0-smoothstep(rw-1.5-wpp,rw+1.5+wpp,d);
    vec2 tdir=normalize(bestB-bestA+1e-4);
    float across=dot(rel-bestA,vec2(-tdir.y,tdir.x));
    vec3 base=mix(vec3(0.72,0.64,0.48),vec3(0.80,0.73,0.57),fbm2(w/70.0));
    float ruts=bestRW.y>0.5? (1.0-smoothstep(1.5,4.5,abs(abs(across)-rw*0.42)))*0.18 : 0.0;
    base*=1.0-ruts;
    base=mix(base,base*1.08,1.0-smoothstep(0.0,rw*0.25,abs(across)));      // 中间被踩亮
    if(bestRW.y<0.5) base=mix(base,col,(1.0-smoothstep(1.0,3.5,abs(across)))*0.5*smoothstep(0.55,0.7,N4(w/30.0).b)); // 小径中间的草
    // 碎石子
    if(near>0.01){ vec2 c2=floor(w/7.0); float hp=hashU(int(c2.x),int(c2.y),33);
      if(hp<0.12){ vec2 pc=(c2+0.5+vec2(hashU(int(c2.x),int(c2.y),34),hashU(int(c2.x),int(c2.y),35))*0.6-0.3)*7.0; float r=length(w-pc);
        base=mix(base,vec3(0.56,0.52,0.45),(1.0-smoothstep(0.8,1.6+wpp,r))*near*0.8); } }
    roadC=base*(1.0+bump*0.25);
    // 路肩被踩秃
    col=mix(col,mix(col,soilC,0.55),roadHalo*(1.0-roadMask)*0.6);
    col=mix(col,roadC,roadMask);
    // 路缘淡墨
    float edgePx=abs(d-rw)/wpp;
    col=mix(col,col*0.72,(1.0-smoothstep(0.6,2.2,edgePx))*0.35*smoothstep(0.35,0.6,N4(w/50.0).r));
  }

  // ---------- 河流
  float rivCov=0.0; vec4 rivB=vec4(0.0);
  // 取最近的两段：水体按并集；水纹按两段各算一遍再按距离差交融（汇流口、转弯处不再有接缝）
  float d1=1e9, d2=1e9; int k1=-1, k2=-1; float h1=0.0, h2=0.0;
  // 第十七步：河道蜿蜒——对河的距离场做两级域扭曲（大湾 ~1.5 千像素、小弯 ~300 像素），屏幕内就能看到河曲
  vec2 rq=rel+(vec2(fbm2(w/1250.0+vec2(71.0,13.0)),fbm2(w/1250.0+vec2(19.0,57.0)))-0.5)*760.0
             +(vec2(fbm2(w/300.0+vec2(5.0,3.0)),fbm2(w/300.0+vec2(9.0,1.0)))-0.5)*110.0;
  for(int k=0;k<${MAX_SEG};k++){
    if(k>=uNRiv) break;
    vec4 s=texelFetch(uSeg,ivec2(k,0),0); float hh; float dd=segDist(rq,s.xy,s.zw,hh)-texelFetch(uSeg,ivec2(k,1),0).x*0.5;
    if(dd<d1){ d2=d1; k2=k1; h2=h1; d1=dd; k1=k; h1=hh; } else if(dd<d2){ d2=dd; k2=k; h2=hh; }
  }
  if(k1>=0 && d1<300.0){
    vec4 S1=texelFetch(uSeg,ivec2(k1,0),0), W1=texelFetch(uSeg,ivec2(k1,1),0);
    vec4 S2=S1, W2=W1;
    float bl=0.0;
    // d1/d2 已是“到水边”的有符号距离（负 = 在水里）；平滑并集
    float e=d1;
    if(k2>=0){ S2=texelFetch(uSeg,ivec2(k2,0),0); W2=texelFetch(uSeg,ivec2(k2,1),0);
      bl=0.5*(1.0-smoothstep(0.0,40.0,d2-d1));
      float hk=clamp(0.5+0.5*(d2-d1)/16.0,0.0,1.0); e=mix(d2,d1,hk)-16.0*hk*(1.0-hk); }
    float wv=mix(W1.x,W2.x,bl);
    float nk=clamp(1.0+(fbm2(w/1500.0+vec2(2.0,6.0))-0.5)*1.3+(fbm2(w/260.0)-0.5)*0.3,0.55,1.6);   // 河面时宽时窄：深潭、浅滩
    float hw=wv*0.5*nk;
    // 统一成“到中线距离 d、半宽 hw”的形式：d = hw + e·(宽度扰动)
    float d=hw+(e+wv*0.5*(1.0-nk))+(N4(w/30.0).r-0.5)*6.0;
    // 河岸：湿泥 → 卵石滩 → 草
    float bank=1.0-smoothstep(hw+6.0,hw+26.0+smoothstep(0.45,0.75,fbm2(w/420.0+vec2(8.0,8.0)))*70.0+fbm2(w/80.0)*20.0,d);
    vec3 bankC=mix(vec3(0.66,0.62,0.52),vec3(0.74,0.70,0.60),N4(w/14.0).g);
    if(near>0.01){ vec2 c2=floor(w/9.0); float hp=hashU(int(c2.x),int(c2.y),55);
      vec2 pc=(c2+0.5+vec2(hashU(int(c2.x),int(c2.y),56),hashU(int(c2.x),int(c2.y),57))*0.5-0.25)*9.0;
      float r=length((w-pc)*vec2(1.0,1.3)); float pr=2.0+hp*2.2;
      bankC=mix(bankC,mix(vec3(0.60,0.58,0.54),vec3(0.82,0.80,0.74),hp)*(1.0-0.25*smoothstep(0.0,pr,length(w-pc-vec2(-0.8,-0.8)))),(1.0-smoothstep(pr-0.6,pr+wpp,r))*step(hp,0.5)*near); }
    float wetBank=1.0-smoothstep(hw,hw+10.0,d);
    bankC=mix(bankC,vec3(0.42,0.40,0.33),wetBank*0.7);
    col=mix(col,bankC,bank*0.85*(1.0-snow*0.5));
    // 水体
    float riverW=1.0-smoothstep(hw-1.0-wpp,hw+1.0+wpp,d);
    float kq=1.0-clamp(d/hw,0.0,1.0);
    float dp=kq*kq*(3.0-2.0*kq);
    vec3 riverC=mix(vec3(0.62,0.74,0.68),vec3(0.33,0.50,0.53),dp);
    // 流向坐标（取权重大的一段）：沿程 along（模 1920 = 噪声周期）、横向 across；动画在每帧后期里做
    { vec4 S=bl>0.5?S2:S1; vec4 Wd=bl>0.5?W2:W1; float hq=bl>0.5?h2:h1;
      vec2 tdir=normalize(S.zw-S.xy+1e-4); vec2 nrm=vec2(-tdir.y,tdir.x);
      float along=mod(Wd.y+hq*length(S.zw-S.xy),1920.0)/1920.0;
      float across=dot(rq-S.xy,nrm);
      float hi=floor(along*255.0)/255.0;
      rivB=vec4(hi,fract(along*255.0),clamp(across/512.0+0.5,0.0,1.0),0.5+0.5*clamp(dp*(1.0-bl*1.6)*0.999,0.0,0.999));
    }
    // 近岸白色细浪 + 浅处透出的沙底
    riverC=mix(riverC,mix(riverC,bankC*vec3(0.85,0.95,0.95),0.35),smoothstep(0.55,0.9,d/hw));
    // 河岸墨线（干笔断续）
    float edgePx=abs(d-hw)/wpp;
    float ink=(1.0-smoothstep(0.8,2.6,edgePx))*smoothstep(0.25,0.55,N4(w/60.0+vec2(4.0,4.0)).g);
    col=mix(col,riverC,riverW);
    col=mix(col,vec3(0.20,0.24,0.24),ink*0.5);
    rivCov=riverW;
  }


  // ---------- 海岸：沙滩、湿沙
  float shore=L-0.5;
  float beach=(1.0-smoothstep(0.0,0.045+fbm2(w/400.0)*0.04,shore))*(1.0-rock*0.6)*(1.0-snow*0.8);
  vec3 sandC=mix(vec3(0.82,0.76,0.60),vec3(0.90,0.85,0.70),N4(w/50.0).a);
  sandC*=0.96+0.08*N4(w/4.0).r*near;
  col=mix(col,sandC,beach);
  float wetS=1.0-smoothstep(0.0,0.012,shore);
  col=mix(col,sandC*vec3(0.74,0.74,0.72),wetS*0.8);

  // ---------- 海 / 湖
  float seaSd=1.0, seaT=0.0, seaSh=0.0;
  float water=1.0-smoothstep(0.5-fwL,0.5+fwL,L);
  if(L<0.5+fwL*2.0){
    float t=clamp(depth*1.6,0.0,1.0);            // 近岸 → 1
    float sh=smoothstep(0.42,0.5,L);              // 极浅
    vec3 wc=mix(vec3(0.26,0.42,0.48),vec3(0.50,0.68,0.67),t);
    // 水下沙底（焦散、浪纹、浪花、粼光在每帧后期里做）
    wc=mix(wc,mix(sandC*vec3(0.78,0.90,0.88),vec3(0.55,0.74,0.70),0.35),sh*0.75);
    seaSd=clamp((0.5-L)/0.06,0.0,1.0); seaT=t; seaSh=sh;
    col=mix(col,wc,water);
  }
  // 海岸墨线（干笔断续）
  float cpx=abs(L-0.5)/fwL;
  float cink=(1.0-smoothstep(0.7,2.4,cpx))*smoothstep(0.2,0.5,N4(w/70.0+vec2(9.0,2.0)).b);
  col=mix(col,vec3(0.20,0.23,0.22),cink*0.6);

  // ---------- 整体：低频水彩晕染 + 极淡纸纤维，统一到水墨画面
  float wash=fbm2(w/3600.0+vec2(50.0,20.0));
  col*=0.95+0.1*wash;
  col=mix(col,vec3(dot(col,vec3(0.3,0.59,0.11))),0.08);
  // A：静态颜色 + 水面覆盖度；B：水面参数（河：流向坐标 a≥0.5；海：离岸/深浅/极浅 a=0.25）
  float rv=rivCov*(1.0-water);              // 入海处海水盖过河道
  oA=vec4(col,max(rv,water));
  oB=rv>water ? rivB : vec4(seaSd,seaT,seaSh,0.25);
}`;

/** 每帧水面动画（拼进后期着色器，需先拼 GLSL_COMMON）。c=静态底色，B=水面参数，w=世界坐标，T=时间 */
export const GLSL_WATER = `
const vec3 WLD=vec3(-0.4615,-0.6293,0.6293);
vec3 waterAnim(vec3 c, vec4 B, vec2 w, float wpp, float T){
  float near=smoothstep(2.3,1.0,wpp);
  if(B.a>=0.5){
    // —— 河：沿程坐标模 1920（=噪声周期），所有沿程采样都取 1920 的约数，接缝处无断痕
    float along=(B.r+B.g/255.0)*1920.0, across=(B.b-0.5)*512.0, dp=(B.a-0.5)*2.0;
    float spd=55.0;
    vec2 fp=vec2((along-T*spd)/60.0, across/16.0);
    float f1=N4(fp+vec2(3.0,1.0)).r, f2=N4(fp*vec2(2.0,0.8)+vec2(7.0,4.0)-vec2(T*0.3,0.0)).b;
    float flow=f1*0.6+f2*0.4;
    c*=0.92+0.16*flow;
    // 顺流细水线：疏、长、淡
    float lane=across/16.0; float li=floor(lane); float lf=(fract(lane)-0.5)*16.0;
    float hl=hashU(int(li),7,61);
    float dl=N4(vec2((along-T*spd*(0.8+0.4*hl))/120.0, li*3.7+0.5)).g;
    float on=smoothstep(0.62,0.72,dl);
    float line=clamp((0.5*on+0.05-abs(lf))/wpp+0.5,0.0,1.0)*on;
    c=mix(c,vec3(0.88,0.94,0.92),line*0.32*smoothstep(0.1,0.5,dp));
    c+=vec3(0.95,0.97,0.95)*pow(smoothstep(0.72,0.95,flow),3.0)*(0.4+0.6*dp)*0.16;
    // 近岸白色细浪
    float lip=smoothstep(0.4,0.05,dp)*smoothstep(0.0,0.012,dp);
    float lipN=smoothstep(0.45,0.7,N4(vec2((along-T*spd*1.2)/30.0,across/7.0)).g);
    c=mix(c,vec3(0.88,0.92,0.88),lip*lipN*0.45);
    return c;
  }
  // —— 海 / 湖
  float sd=B.r, t=B.g, sh=B.b;
  if(sh>0.01){ vec2 cp=w/70.0; float c1=N4(cp+vec2(T*0.05,T*0.03)).r, c2=N4(cp*1.3-vec2(T*0.04,-T*0.05)+5.0).g;
    c+=pow(1.0-abs(c1-c2)*2.0,6.0)*sh*0.12; }
  vec2 wp1=w/260.0+vec2(T*0.02,T*0.012);
  float n1=fbm2(wp1), n1x=fbm2(wp1+vec2(0.05,0.0)), n1y=fbm2(wp1+vec2(0.0,0.05));
  vec3 wn=normalize(vec3((n1-n1x)*6.0,(n1-n1y)*6.0,1.0));
  float spec=pow(max(dot(reflect(-WLD,wn),vec3(0.0,0.0,1.0)),0.0),10.0);
  c*=0.95+0.1*n1;
  c+=spec*vec3(1.0,0.98,0.92)*0.08;
  // 传统弧形浪纹
  for(int g=0; g<2; g++){
    vec2 cs=g==0?vec2(170.0,70.0):vec2(110.0,46.0);
    vec2 wv=w+vec2(T*(g==0?10.0:7.0),T*1.5)+float(g)*vec2(53.0,31.0);
    float row=floor(wv.y/cs.y); wv.x+=mod(row,2.0)*cs.x*0.5;
    vec2 cc=floor(wv/cs); int cx=int(cc.x), cy=int(cc.y);
    float hc=hashU(cx,cy,401+g);
    if(hc>0.42) continue;
    float ph=fract(T*(0.05+hc*0.04)+hc*7.0); float a=sin(ph*3.14159); a*=a;
    vec2 lp=wv-(cc+vec2(0.5,0.6))*cs+vec2((hashU(cx,cy,405)-0.5)*cs.x*0.3,0.0);
    float len=cs.x*(0.2+0.12*hashU(cx,cy,403))*(0.7+0.3*a);
    float kk=1.0/(len*1.5);
    float x=lp.x, yv=lp.y-kk*x*x+len*0.2;
    float dd=abs(yv)/sqrt(1.0+4.0*kk*kk*x*x);
    float e=clamp(1.0-abs(x)/len,0.0,1.0);
    float wd=1.5*e*e+0.15;
    float zone=smoothstep(0.45,0.65,fbm2(w/900.0+vec2(float(g)*7.0+T*0.01,3.0)));
    float vis=zone*smoothstep(4.0,10.0,len/wpp)*(1.0-sh);
    float line=clamp((wd-dd)/wpp+0.5,0.0,1.0)*vis;
    float shad=clamp((wd*1.6-abs(yv-3.5))/wpp+0.5,0.0,1.0)*vis;
    c=mix(c,c*0.85,shad*a*0.3);
    c=mix(c,vec3(0.92,0.96,0.95),line*a*(0.6-0.25*t));
  }
  // 日光碎金
  { vec2 gc=vec2(46.0,20.0); vec2 cc=floor(w/gc); int cx=int(cc.x), cy=int(cc.y); float hg=hashU(cx,cy,421);
    if(hg<0.12){ vec2 lp=w-(cc+vec2(0.2+0.6*hashU(cx,cy,422),0.5))*gc; float tw=sin(T*(2.0+hg*20.0)+hg*80.0);
      float L2=5.0+hashU(cx,cy,423)*9.0; float el=length(lp/vec2(L2,1.1));
      c+=vec3(1.0,0.98,0.88)*(1.0-smoothstep(0.6,1.0,el))*smoothstep(0.55,1.0,tw)*0.45*near; } }
  // 岸边浪花
  if(sd<1.0){
    float band=sin(sd*18.0-T*1.6+fbm2(w/90.0)*5.0);
    float foam=smoothstep(0.75,0.98,band)*(1.0-smoothstep(0.0,1.0,sd))*smoothstep(0.35,0.65,N4(w/26.0+vec2(T*0.1,0.0)).r);
    foam+=(1.0-smoothstep(0.0,0.10,sd))*0.7*smoothstep(0.3,0.6,N4(w/14.0+vec2(0.0,T*0.2)).g);
    c=mix(c,vec3(0.94,0.96,0.94),clamp(foam,0.0,1.0)*0.85);
  }
  return c;
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('ground shader: ' + (gl.getShaderInfoLog(sh) ?? '')); return sh; };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  const U = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (n: string) => { if (!U.has(n)) U.set(n, gl.getUniformLocation(p, n)); return U.get(n)!; } };
}

export interface GroundTerrain { W: number; H: number; scale: number; a: Float32Array; b: Float32Array }
/** 线段/城镇数据：相对缓存中心 (cx,cy)，覆盖半宽 hw/hh（世界像素） */
export interface GroundSegs { seg: Float32Array; nRiv: number; nRoad: number; town: Float32Array; townS: Int32Array; nTown: number }
export type SegProvider = (cx: number, cy: number, hw: number, hh: number) => GroundSegs;
export interface GroundView { camX: number; camY: number; zoom: number; cssW: number; cssH: number; season: number; scale: number }

interface GBuf { fb: WebGLFramebuffer; a: WebGLTexture; b: WebGLTexture; W: number; H: number; cx: number; cy: number; tpw: number; season: number }

/**
 * GPU 地表（缓存版）：
 *   完整的地表着色器只在需要时画进一张比屏幕大的缓存（两张：前台在用，后台分条渐进重画，画完再交换），
 *   每帧后期只做一次取样；只有水面再跑一段轻量动画。镜头静止时地表几乎零开销，行走时也只是偶尔分几帧重画。
 */
export class Ground {
  private gl: WebGL2RenderingContext;
  private prog: ReturnType<typeof compile>;
  private ta: WebGLTexture | null = null; private tb: WebGLTexture | null = null;
  noise: WebGLTexture; private segTex: WebGLTexture;
  private T: GroundTerrain | null = null;
  front: GBuf | null = null; private back: GBuf | null = null;
  private job: { cx: number; cy: number; tpw: number; season: number; W: number; H: number; strip: number; n: number; segs: GroundSegs } | null = null;
  private lastCam: { x: number; y: number } | null = null; private vel = { x: 0, y: 0 };
  /** 统计：本帧重画的条数 */
  stripsThisFrame = 0; rebuilds = 0;
  /** 画质：缓存分辨率（每 CSS 像素纹素数）的上限倍率 */
  quality = 1;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.prog = compile(gl, VS, FS);
    this.noise = this.makeNoise();
    this.segTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.segTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MAX_SEG, 4, 0, gl.RGBA, gl.FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  }

  /** 可平铺值噪声：512²，每块 32 格，4 通道不同种子，带 mipmap */
  private makeNoise() {
    const gl = this.gl, N = 512, G = 32, cell = N / G;
    const d = new Uint8Array(N * N * 4);
    for (let ch = 0; ch < 4; ch++) {
      let s = 1234567 + ch * 7919;
      const grid = new Float32Array(G * G);
      for (let i = 0; i < grid.length; i++) { s = (s * 16807) % 2147483647; grid[i] = s / 2147483647; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10); ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
        const at = (i: number, j: number) => grid[((j + G) % G) * G + ((i + G) % G)];
        const v = (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
        d[(y * N + x) * 4 + ch] = Math.round(v * 255);
      }
    }
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  setTerrain(T: GroundTerrain) {
    if (this.T === T) return;
    this.T = T;
    const gl = this.gl;
    const mk = (data: Float32Array) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, T.W, T.H, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    if (this.ta) gl.deleteTexture(this.ta); if (this.tb) gl.deleteTexture(this.tb);
    this.ta = mk(T.a); this.tb = mk(T.b);
    this.invalidate();
  }
  get ready() { return !!this.T && !!this.ta; }
  invalidate() { this.free(this.front); this.free(this.back); this.front = this.back = null; this.job = null; }

  private free(b: GBuf | null) { if (!b) return; const gl = this.gl; gl.deleteFramebuffer(b.fb); gl.deleteTexture(b.a); gl.deleteTexture(b.b); }
  private alloc(W: number, H: number): GBuf {
    const gl = this.gl;
    const tex = (filter: number) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const a = tex(gl.LINEAR), b = tex(gl.NEAREST);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, a, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, b, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, a, b, W, H, cx: 0, cy: 0, tpw: 1, season: -1 };
  }

  /** 视野（世界坐标半宽/半高）是否完全落在缓存里（留 pad 世界像素） */
  private covers(g: { cx: number; cy: number; W: number; H: number; tpw: number }, x: number, y: number, hw: number, hh: number, pad: number) {
    const gw = g.W / g.tpw / 2, gh = g.H / g.tpw / 2;
    return x - hw - pad >= g.cx - gw && x + hw + pad <= g.cx + gw && y - hh - pad >= g.cy - gh && y + hh + pad <= g.cy + gh;
  }

  /** 每帧调用：必要时启动/推进缓存重画。返回 false 表示暂无可用地表 */
  update(v: GroundView, provider: SegProvider, vao: WebGLVertexArrayObject, maxTex: number): boolean {
    if (!this.T || !this.ta) return false;
    this.stripsThisFrame = 0;
    // 镜头速度（预判前进方向，把缓存中心往前放）
    if (this.lastCam) { const k = 0.15; this.vel.x += ((v.camX - this.lastCam.x) - this.vel.x) * k; this.vel.y += ((v.camY - this.lastCam.y) - this.vel.y) * k; }
    this.lastCam = { x: v.camX, y: v.camY };
    const hw = v.cssW / 2 / v.zoom, hh = v.cssH / 2 / v.zoom;
    // 缓存尺寸：视野四周各留 1/4 长边的余量，分辨率 = 每 CSS 像素 scale 个纹素
    const mCss = 0.25 * Math.max(v.cssW, v.cssH), m = mCss / v.zoom;
    let sc = v.scale * this.quality;
    let W = Math.ceil((v.cssW + 2 * mCss) * sc), H = Math.ceil((v.cssH + 2 * mCss) * sc);
    const lim = Math.min(maxTex, 4096);
    const k = Math.min(1, lim / W, lim / H, Math.sqrt(5.2e6 / (W * H)));
    if (k < 1) { sc *= k; W = Math.ceil(W * k); H = Math.ceil(H * k); }
    const tpw = v.zoom * sc;
    const F = this.front;
    const zoomOk = (g: { tpw: number }) => Math.abs(g.tpw / tpw - 1) < 0.07;
    const frontUsable = !!F && this.covers(F, v.camX, v.camY, hw, hh, 0) && Math.abs(F.tpw / tpw - 1) < 0.35;
    const frontGood = !!F && frontUsable && zoomOk(F) && F.season === v.season && F.W === W && F.H === H &&
      this.covers(F, v.camX, v.camY, hw, hh, m * 0.4);
    // 需要新缓存
    if (!frontGood) {
      const J = this.job;
      const jobOk = !!J && J.season === v.season && J.W === W && J.H === H && zoomOk(J) && this.covers(J, v.camX, v.camY, hw, hh, m * 0.2);
      if (!jobOk) {
        // 新中心：当前镜头 + 速度预判（不超过余量的一半）
        const lead = 40, mx = m * 0.6, my = m * 0.6;
        const cx = v.camX + Math.max(-mx, Math.min(mx, this.vel.x * lead));
        const cy = v.camY + Math.max(-my, Math.min(my, this.vel.y * lead));
        const n = W * H > 3e6 ? 8 : 6;   // 第十七步：条更窄，每帧负担更轻
        this.job = { cx, cy, tpw, season: v.season, W, H, strip: 0, n, segs: provider(cx, cy, W / tpw / 2, H / tpw / 2) };
      }
      const job = this.job!;
      if (!this.back || this.back.W !== W || this.back.H !== H) { this.free(this.back); this.back = this.alloc(W, H); }
      // 前台不可用（开场、瞬移、大幅缩放）→ 本帧一次画完；否则每帧画一条
      const all = !frontUsable;
      const upto = all ? job.n : Math.min(job.n, job.strip + 1);
      this.drawStrips(job, this.back, job.strip, upto, vao);
      job.strip = upto;
      if (job.strip >= job.n) {
        const b = this.back; b.cx = job.cx; b.cy = job.cy; b.tpw = job.tpw; b.season = job.season;
        this.back = this.front; this.front = b; this.job = null; this.rebuilds++;
      }
    }
    return !!this.front;
  }

  private tileSeg = new Float32Array(MAX_SEG * 4 * 4);
  private drawStrips(job: NonNullable<Ground['job']>, g: GBuf, from: number, to: number, vao: WebGLVertexArrayObject) {
    const gl = this.gl, pr = this.prog, T = this.T!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.fb);
    gl.viewport(0, 0, g.W, g.H);
    gl.useProgram(pr.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ta); gl.uniform1i(pr.u('uTA'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tb); gl.uniform1i(pr.u('uTB'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.noise); gl.uniform1i(pr.u('uN'), 2);
    const S = job.segs;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.segTex);
    gl.uniform1i(pr.u('uSeg'), 3);
    if (S.nTown) { gl.uniform4fv(pr.u('uTown[0]'), S.town, 0, S.nTown * 4); gl.uniform4iv(pr.u('uTownS[0]'), S.townS, 0, S.nTown * 4); }
    gl.uniform1i(pr.u('uNTown'), S.nTown);
    gl.uniform2f(pr.u('uMacro'), T.W, T.H); gl.uniform1f(pr.u('uScale'), T.scale);
    gl.uniform2f(pr.u('uCam'), job.cx, job.cy); gl.uniform1f(pr.u('uTPW'), job.tpw);
    gl.uniform2f(pr.u('uRes'), g.W, g.H); gl.uniform1i(pr.u('uSeason'), job.season);
    gl.bindVertexArray(vao);
    gl.enable(gl.SCISSOR_TEST);
    // 第十七步：分块裁剪线段——每块只上传可能影响到它的河段 / 路段（与 Renderer 裁剪同样的余量），
    // 每个像素的线段循环从“整个缓存的全部线段”降到“本块附近的几段”，画面完全不变
    const ROW = MAX_SEG * 4, src = S.seg, dst = this.tileSeg, COLS = 3;
    const fill = (row: number, n: number, pad: number, x0: number, x1: number, y0: number, y1: number) => {
      let m = 0;
      for (let k = 0; k < n; k++) {
        const o = row * ROW + k * 4, ax = src[o], ay = src[o + 1], bx = src[o + 2], by = src[o + 3], r = src[o + ROW] * 0.5 + pad;
        if (Math.max(ax, bx) < x0 - r || Math.min(ax, bx) > x1 + r || Math.max(ay, by) < y0 - r || Math.min(ay, by) > y1 + r) continue;
        const d = row * ROW + m * 4;
        dst[d] = ax; dst[d + 1] = ay; dst[d + 2] = bx; dst[d + 3] = by;
        dst[d + ROW] = src[o + ROW]; dst[d + ROW + 1] = src[o + ROW + 1]; dst[d + ROW + 2] = src[o + ROW + 2]; dst[d + ROW + 3] = src[o + ROW + 3];
        m++;
      }
      return m;
    };
    for (let i = from; i < to; i++) {
      const y0 = Math.floor(g.H * i / job.n), y1 = Math.floor(g.H * (i + 1) / job.n);
      for (let c = 0; c < COLS; c++) {
        const x0 = Math.floor(g.W * c / COLS), x1 = Math.floor(g.W * (c + 1) / COLS);
        const wx0 = (x0 - g.W / 2) / job.tpw, wx1 = (x1 - g.W / 2) / job.tpw, wy0 = (y0 - g.H / 2) / job.tpw, wy1 = (y1 - g.H / 2) / job.tpw;
        const nR = fill(0, S.nRiv, 820, wx0, wx1, wy0, wy1), nD = fill(2, S.nRoad, 210, wx0, wx1, wy0, wy1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MAX_SEG, 4, gl.RGBA, gl.FLOAT, dst);
        gl.uniform1i(pr.u('uNRiv'), nR); gl.uniform1i(pr.u('uNRoad'), nD);
        gl.scissor(x0, y0, x1 - x0, y1 - y0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      this.stripsThisFrame++;
    }
    gl.disable(gl.SCISSOR_TEST);
  }
}
