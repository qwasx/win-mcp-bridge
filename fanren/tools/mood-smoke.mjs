import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const base=process.env.TEST_URL??'http://localhost:5173';
const out='.downloads/verification';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={errors:[],requests:[],checks:[]};
const check=(name,pass)=>{results.checks.push({name,pass});console.log(pass?'PASS':'FAIL',name);if(!pass)process.exitCode=1;};
const watch=(p)=>{p.on('pageerror',(e)=>results.errors.push(e.message));p.on('response',(r)=>{if(r.status()>=400)results.requests.push(`${r.status()} ${r.url()}`);});};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForTimeout(1800);
  check('Brand and new game visible',await page.getByRole('heading',{name:'凡人修仙传',exact:true}).isVisible()&&await page.getByRole('button',{name:'踏入仙途',exact:true}).isVisible());
  check('Continue disabled for a fresh player',await page.getByRole('button',{name:/继续前缘/}).isDisabled());
  for(const [id,label] of [['dawn','晨起'],['dusk','日暮'],['night','星夜'],['rain','烟雨']]){
    await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(2000);
    check(`Scene ${id} switches`,await page.locator(`.cultivation-title.scene-${id}`).count()===1);
    await page.screenshot({path:`${out}/title-${id}.png`});
  }
  await page.getByRole('button',{name:'修行指南',exact:true}).click();check('Guide opens',await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});check('Escape dismisses dialog',await page.getByRole('dialog').count()===0);
  await page.getByRole('button',{name:'山河画卷',exact:true}).click();await page.locator('.journey-intro').waitFor({state:'detached'});check('Contemplation hides menu',await page.locator('.journey-intro').count()===0);await page.keyboard.press('Escape');await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'开启环境音',exact:true}).click();check('Audio toggle works',await page.getByRole('button',{name:'关闭环境音',exact:true}).count()===1);await page.getByRole('button',{name:'关闭环境音',exact:true}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();check('Settings opens',await page.locator('.scroll-panel.settings').isVisible());await page.locator('.scroll-panel.settings .close-btn').click();
  const tools=await page.locator('.landscape-tools').boundingBox();console.log('Tools box',tools);
  await page.getByRole('button',{name:'晨起',exact:true}).click();await page.waitForTimeout(1800);
  await page.close();
}catch(e){
  results.errors.push(e.message);console.error(e);process.exitCode=1;
}
try{
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});watch(mobile);await mobile.goto(base,{waitUntil:'networkidle'});await mobile.waitForTimeout(1600);await mobile.screenshot({path:`${out}/title-mobile.png`});check('Mobile new game reachable',await mobile.getByRole('button',{name:'踏入仙途',exact:true}).isVisible());await mobile.close();
  const game=await browser.newPage({viewport:{width:960,height:640}});watch(game);await game.addInitScript(()=>localStorage.setItem('fanren_help_seen','1'));
  await game.goto(`${base}/?auto=new`,{waitUntil:'domcontentloaded'});
  await game.waitForFunction(()=>window.__game?.renderer&&window.__game?.running,{timeout:180000});
  await game.evaluate(()=>{const g=window.__game;g.story.skipAll?.();g.story.openT=-1;g.modal=null;g.visitQ=null;g.emitModal?.();g.renderer.fixedQuality=true;g.renderer.setQuality(0);});await game.waitForTimeout(1500);
  check('Original game starts',await game.locator('.game-root').count()===1);
  const info=await game.evaluate(()=>({webgl:!!window.__game.renderer.stage,lakes:window.__game.scenery.lakes.length,moodDetails:window.__game.scenery.details.length,player:window.__game.player.name}));console.log('GAME',info);
  check('Original player and mood pool preserved',info.player==='韩立'&&info.lakes>0&&info.moodDetails>0);
  await game.screenshot({path:`${out}/game-start.png`});
  // Deterministic capture avoids software-GPU animation starving pointer dispatch.
  await game.evaluate(()=>{const g=window.__game;g.running=false;cancelAnimationFrame(g.raf);g.visitQ=null;g.modal=null;g.emitModal?.();});
  const moved=await game.evaluate(()=>{const g=window.__game,x=g.player.x;g.input.keys.add('d');for(let i=0;i<8;i++)g.update(1/30);g.input.keys.clear();return g.player.x>x;});check('Original movement simulation works',moved);
  const original=await game.evaluate(()=>{const g=window.__game;return{clock:g.clock,day:g.day,cam:{...g.cam},weather:g.weather.kind,forced:g.weather.forced,player:[g.player.x,g.player.y],reveal:g.revealAll,debug:g.debugSeeAll};});
  const draw=async()=>{await game.evaluate(async()=>{const g=window.__game;for(let i=0;i<50;i++){g.update(1/30);g.renderer.render(1/30);await new Promise(r=>setTimeout(r,25));}});};
  await game.getByRole('button',{name:'山河留影',exact:true}).click();await draw();check('Photo mode opens',await game.locator('.photo-toolbar').isVisible());
  const safe=await game.evaluate(()=>{const g=window.__game,before=JSON.stringify(localStorage);g.save(0);return before===JSON.stringify(localStorage);});check('Photo preview cannot leak into save',safe);
  for(const id of ['dawn','dusk','night','rain']){await game.getByLabel('留影场景').selectOption(id);await draw();await game.screenshot({path:`${out}/world-${id}.png`});}
  const [download]=await Promise.all([game.waitForEvent('download'),game.getByRole('button',{name:'保存画卷',exact:true}).click()]);await download.saveAs(`${out}/saved-wallpaper.png`);check('PNG wallpaper downloads',download.suggestedFilename().endsWith('.png'));
  check('Downloaded wallpaper has PNG signature',readFileSync(`${out}/saved-wallpaper.png`).subarray(0,8).toString('hex')==='89504e470d0a1a0a');
  await game.getByRole('button',{name:'退出留影',exact:true}).click();check('Photo state restored',await game.evaluate(()=>!window.__game.photoMode&&!window.__game.paused));
  const restored=await game.evaluate(()=>{const g=window.__game;return{clock:g.clock,day:g.day,cam:{...g.cam},weather:g.weather.kind,forced:g.weather.forced,player:[g.player.x,g.player.y],reveal:g.revealAll,debug:g.debugSeeAll};});check('Camera calendar weather and player restore exactly',JSON.stringify(original)===JSON.stringify(restored));
  await game.evaluate(()=>window.__game.save(0));check('Original save succeeds',await game.evaluate(()=>!!localStorage.getItem('fanren_save')||Object.keys(localStorage).some(k=>k.includes('save'))));
  await game.close();
}catch(e){results.errors.push(e.message);console.error(e);process.exitCode=1;}
check('No runtime exceptions',results.errors.length===0);check('No missing resources',results.requests.length===0);
writeFileSync(`${out}/smoke.json`,JSON.stringify(results,null,2));await browser.close();