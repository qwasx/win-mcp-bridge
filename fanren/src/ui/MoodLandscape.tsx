import { useEffect, useRef } from 'react';
import { moodArt, moodStamp, preloadMood } from '../world/mood';

export type SceneId = 'dawn' | 'dusk' | 'night' | 'rain';
export const SCENES: { id: SceneId; label: string; place: string; time: string; poem: string; sub: string }[] = [
  { id:'dawn', label:'晨起', place:'镜湖', time:'卯时 · 晨光初霁', poem:'一念入凡尘，一步问长生。', sub:'远山含黛，烟水如初。' },
  { id:'dusk', label:'日暮', place:'青溪村', time:'酉时 · 归烟向晚', poem:'人间烟火处，亦是修行时。', sub:'暮色染山，炊烟知归。' },
  { id:'night', label:'星夜', place:'碧落湖', time:'子时 · 星河入梦', poem:'手可摘星辰，心自有山海。', sub:'一湖星月，万籁无声。' },
  { id:'rain', label:'烟雨', place:'云梦泽', time:'辰时 · 微雨空蒙', poem:'一蓑烟雨，任此生逍遥。', sub:'山色空蒙，听雨忘言。' },
];

export function MoodLandscape({ scene, still=false }: { scene: SceneId; still?: boolean }) {
  const ref=useRef<HTMLCanvasElement>(null);
  const current=useRef(scene); current.current=scene;
  useEffect(()=>{
    preloadMood();
    const cv=ref.current!, ctx=cv.getContext('2d')!;
    let W=0,H=0,dpr=1,raf=0,start=performance.now();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{W=cv.clientWidth;H=cv.clientHeight;dpr=Math.min(window.devicePixelRatio||1,1.5);cv.width=W*dpr;cv.height=H*dpr;};
    resize(); window.addEventListener('resize',resize);
    const draw=(now:number)=>{
      const t=(now-start)/1000, motion=still||reduced?0:t, s=current.current;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
      for(let i=0;i<3;i++){
        const x=W*(.32+i*.24)+Math.sin(motion*.022+i)*W*.035;
        moodStamp(ctx,i%2?'mist_band_2':'mist_band_1',x-W*.25,H*(.44+i*.12),W*.65,H*.18,s==='rain'?.4:.22);
      }
      if(s==='night'){
        moodStamp(ctx,'sky_starriver',W*.24,H*.025,W*.84,H*.3,.9);
        moodStamp(ctx,'moon_full',W*.69,H*.14,110,110,.88);
        moodStamp(ctx,'fishing_light',W*.624,H*.69,58,65,.8+Math.sin(motion*1.7)*.15);
        ctx.fillStyle='#dce7dd';
        for(let i=0;i<65;i++) {const x=((i*271.7)%997)/997*W,y=((i*97.1)%431)/431*H*.43;ctx.globalAlpha=.18+Math.sin(motion*.8+i)*.13;ctx.fillRect(x,y,i%4===0?1.5:1,i%4===0?1.5:1);}ctx.globalAlpha=1;
      }
      if(s==='dusk'){
        moodStamp(ctx,'sky_dusk_glow',W*.2,H*.05,W*.95,H*.24,.42);
        moodStamp(ctx,'cooking_smoke',W*.874+Math.sin(motion*.08)*6,H*.46,60,H*.28,.6);
      }
      if(s==='rain'){
        ctx.strokeStyle='rgba(71,101,102,.25)'; ctx.lineWidth=.7;ctx.beginPath();
        for(let i=0;i<120;i++){const x=((i*163.7+motion*38)%(W+40))-20,y=((i*119.3+motion*340)%(H+30))-30;ctx.moveTo(x,y);ctx.lineTo(x-6,y+19);}ctx.stroke();
        const rain=moodArt('rain_veil');if(rain){ctx.globalAlpha=.2;ctx.drawImage(rain,0,0,W,H);ctx.globalAlpha=1;}
      }
      if(s==='dawn'||s==='dusk'){
        const x=W*.55+(motion*4)%(W*.60);
        moodStamp(ctx,'wild_geese',x,H*.25+Math.sin(motion*.07)*8,155,39,.6);
      }
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
  },[still]);
  return <div className={`mood-landscape landscape-${scene}`} aria-hidden="true">
    <img className="landscape-painting" src="./art/mirror-lake.jpg" alt="" draggable={false}/>
    <div className="landscape-wash"/><canvas ref={ref} className="landscape-air"/>
    <div className="landscape-paper"/>
  </div>;
}