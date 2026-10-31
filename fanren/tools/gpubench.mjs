import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const flag=(name,fallback)=>process.argv.find((x)=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??fallback;
const port=flag('port','5173'), frames=Number(flag('frames','60'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:Number(flag('w','960')),height:Number(flag('h','540'))}});
  await page.goto(`http://localhost:${port}/?auto=new`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.renderer&&window.__game.running,{timeout:180000});
  await page.evaluate(()=>{const g=window.__game;g.running=false;cancelAnimationFrame(g.raf);g.story.skipAll?.();g.modal=null;g.visitQ=null;g.emitModal?.();g.revealAll=true;g.debugSeeAll=true;g.renderer.fixedQuality=true;g.renderer.setQuality(1);const lake=g.scenery.lakes.find(l=>l.name==='镜湖');g.teleport(lake.x+lake.r*.45,lake.y+lake.r*.3);g.cam.zoom=g.cam.targetZoom=.6;g.clock=240*.23;g.weather.kind=g.weather.next='clear';g.weather.k=1;g.renderer.render(1/30);});
  await page.waitForTimeout(1500);
  const result=await page.evaluate(async(n)=>{
    const g=window.__game,r=g.renderer,gl=r.stage?.gl;
    const median=(a)=>[...a].sort((a,b)=>a-b)[Math.floor(a.length*.5)];
    const percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))];
    for(let i=0;i<25;i++){g.time+=1/30;r.render(1/30);}
    const on=[],off=[],cpu=[],deltas=[];
    for(let i=0;i<n;i++){
      const pair=[];
      for(const enabled of (i%2?[true,false]:[false,true])){
        r.mood.enabled=enabled;gl?.finish();const t=performance.now();r.render(1/30);gl?.finish();const ms=performance.now()-t;
        (enabled?on:off).push(ms);pair[enabled?1:0]=ms;if(enabled)cpu.push(r.mood.ms);
      }
      deltas.push(pair[1]-pair[0]);
      if(i%8===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    r.mood.enabled=true;
    const regression=median(deltas);
    return{renderer:gl?gl.getParameter(gl.RENDERER):'Canvas2D',hardwareGPU:false,viewport:[r.W,r.H],frames:n,enabledMedianMs:median(on),disabledMedianMs:median(off),pairedMedianRegressionMs:regression,pairedP95RegressionMs:percentile(deltas,.95),moodCpuMedianMs:median(cpu),moodCpuP95Ms:percentile(cpu,.95),under1ms:regression<1,note:'Headless Chromium / SwiftShader software GPU. Paired warm-cache incremental comparison, not a physical-GPU certification.'};
  },frames);
  mkdirSync('.downloads/verification',{recursive:true});writeFileSync('.downloads/verification/performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}