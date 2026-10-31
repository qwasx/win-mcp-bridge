import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[],missing=[];
try{
  const page=await browser.newPage({viewport:{width:960,height:600}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  await page.goto(`${process.env.TEST_URL??'http://localhost:4173'}/?auto=new&gl=0`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.renderer&&window.__game.running,{timeout:180000});
  const result=await page.evaluate(async()=>{
    const g=window.__game;g.running=false;cancelAnimationFrame(g.raf);g.story.skipAll?.();g.modal=null;g.visitQ=null;g.photoMode=true;g.revealAll=true;g.debugSeeAll=true;
    const r=g.renderer;r.fixedQuality=true;r.setQuality(0);
    const lake=g.scenery.lakes.filter(l=>l.name==='镜湖').sort((a,b)=>b.r-a.r)[0];g.cam.x=lake.x+lake.r*.5;g.cam.y=lake.y+lake.r*.5;g.cam.zoom=g.cam.targetZoom=.6;
    const phases=[.23,.5,.76,.02];
    for(const [i,kind] of ['clear','rain','snow','fog'].entries()){
      g.clock=phases[i]*240;g.weather.kind=g.weather.next=kind;g.weather.k=1;
      for(let f=0;f<12;f++){g.time+=1/30;r.render(1/30);await new Promise(resolve=>setTimeout(resolve,25));}
    }
    return{canvasFallback:r.stage===null,sharedCanvas:r.canvas===r.domCanvas,weatherVariants:4};
  });
  mkdirSync('.downloads/verification',{recursive:true});await page.screenshot({path:'.downloads/verification/world-canvas.png'});
  const report={...result,errors,missing,pass:result.canvasFallback&&result.sharedCanvas&&errors.length===0&&missing.length===0};
  writeFileSync('.downloads/verification/compatibility.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
}finally{await browser.close();}