import { useEffect, useState } from 'react';
import { Camera, Download, X } from 'lucide-react';
import type { Game } from '../world/game';
import { DAY_CYCLE } from '../world/game';
import { LOCATIONS, WORLD_SCALE } from '../data/world';
import { LOC_SCALE } from '../gfx/building';

export function PhotoMode({ game, onClose }: { game: Game; onClose: () => void }) {
  const [preset,setPreset]=useState('dawn');
  const [saved,setSaved]=useState(false);
  useEffect(()=>{
    game.save(0);
    const original={cam:{...game.cam},clock:game.clock,day:game.day,kind:game.weather.kind,next:game.weather.next,k:game.weather.k,forced:game.weather.forced,reveal:game.revealAll,debug:game.debugSeeAll,paused:game.paused};
    game.photoMode=true;game.paused=true;game.revealAll=true;game.debugSeeAll=true;
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}};
    window.addEventListener('keydown',esc,true);
    return()=>{Object.assign(game.cam,original.cam);game.clock=original.clock;game.day=original.day;Object.assign(game.weather,{kind:original.kind,next:original.next,k:original.k,forced:original.forced});game.revealAll=original.reveal;game.debugSeeAll=original.debug;game.photoMode=false;game.paused=original.paused;window.removeEventListener('keydown',esc,true);};
  },[game]);
  const apply=(id:string)=>{
    setPreset(id);setSaved(false);
    const lake=game.scenery.lakes.filter((l)=>l.name===(id==='rain'?'云梦泽':id==='night'?'碧落湖':'镜湖')).sort((a,b)=>b.r-a.r)[0];
    const phase=id==='dawn'?.23:id==='dusk'?.76:id==='night'?.02:.34;
    game.clock=DAY_CYCLE*phase;game.day=74;
    game.weather.kind=game.weather.next=id==='rain'?'rain':'clear';game.weather.forced=game.weather.kind;game.weather.k=1;
    if(id==='dusk'){
      const village=LOCATIONS.find((l)=>l.type==='town'&&l.minor)??LOCATIONS.find((l)=>l.type==='town');
      if(village){
        const layout=game.renderer.layout(village),smoke=layout.smoke[0];
        const house=layout.pieces.find((p)=>p.kind==='B');
        game.cam.x=village.x*WORLD_SCALE+(smoke?.x??house?.x??0)*LOC_SCALE;
        game.cam.y=village.y*WORLD_SCALE+(smoke?.y??house?.y??0)*LOC_SCALE-70;
      }
    }else if(lake){
      if(id==='night'||id==='rain'){
        const a=id==='night'?.35:.7,r=id==='night'?.58:.46;
        game.cam.x=lake.x+Math.cos(a)*lake.r*r;game.cam.y=lake.y+Math.sin(a)*lake.r*r*.65;
      }else{game.cam.x=lake.x+lake.r*.55;game.cam.y=lake.y+lake.r*.4;}
    }
    game.cam.zoom=game.cam.targetZoom=.6;
  };
  useEffect(()=>{apply('dawn');},[]);
  const download=()=>{
    const r=game.renderer,cv=document.createElement('canvas');
    cv.width=Math.round(r.W*1.5);cv.height=Math.round(r.H*1.5);
    const ctx=cv.getContext('2d')!;
    if(r.stage)ctx.drawImage(r.stage.canvas,0,0,cv.width,cv.height);
    ctx.drawImage(r.domCanvas,0,0,cv.width,cv.height);
    cv.toBlob((blob)=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fanren-${preset}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setSaved(true);},'image/png');
  };
  return <div className="photo-toolbar" onPointerDown={(e)=>e.stopPropagation()}><Camera size={17}/><span>山河留影</span><select aria-label="留影场景" value={preset} onChange={(e)=>apply(e.target.value)}><option value="dawn">晨 · 镜湖</option><option value="dusk">暮 · 村落炊烟</option><option value="night">夜 · 星汉渔火</option><option value="rain">雨 · 云梦泽</option></select><button onClick={download}><Download size={14} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>{saved?'已保存':'保存画卷'}</button><button aria-label="退出留影" onClick={onClose}><X size={17}/></button></div>;
}