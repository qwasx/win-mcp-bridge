import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BookOpen, Check, CloudRain, Compass, Expand, Feather, Moon, Settings2, Sun, Sunset, Volume2, VolumeX, X } from 'lucide-react';
import { audio } from '../world/audio';
import { SettingsPanel, loadAudio } from './Panels';
import { MoodLandscape, SCENES, type SceneId } from './MoodLandscape';

const sceneIcons = { dawn: Sun, dusk: Sunset, night: Moon, rain: CloudRain };
type Panel = '' | 'guide' | 'about' | 'settings' | 'confirm' | 'journal';

export function TitleScreen({ onNew, onContinue, hasSave }: { onNew: () => void; onContinue: () => void; hasSave: boolean }) {
  const [scene,setScene]=useState<SceneId>('dawn');
  const [panel,setPanel]=useState<Panel>('');
  const [sound,setSound]=useState(false);
  const [view,setView]=useState(false);
  const [toast,setToast]=useState('');
  const selected=SCENES.find((s)=>s.id===scene)!;

  useEffect(()=>{loadAudio();try{if(!localStorage.getItem('fanren_audio'))audio.setEnabled(false);}catch{audio.setEnabled(false);}setSound(audio.enabled);},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPanel('');setView(false);} if(e.key.toLowerCase()==='h'&&!panel)setView((v)=>!v);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[panel]);
  useEffect(()=>{
    if(!panel||panel==='settings')return;
    const previous=document.activeElement as HTMLElement|null;
    const timer=setTimeout(()=>document.querySelector<HTMLButtonElement>('.mood-dialog-close')?.focus(),50);
    const trap=(e:KeyboardEvent)=>{
      if(e.key!=='Tab')return;
      const items=[...document.querySelectorAll<HTMLElement>('.mood-dialog button, .mood-dialog a, .mood-dialog input')];
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    };
    window.addEventListener('keydown',trap);
    return()=>{clearTimeout(timer);window.removeEventListener('keydown',trap);previous?.focus();};
  },[panel]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
  const click=()=>{if(sound){audio.unlock();audio.sfx('click');}};
  const toggleSound=()=>{audio.unlock();audio.setEnabled(!sound);setSound(!sound);try{localStorage.setItem('fanren_audio',JSON.stringify({e:!sound,m:audio.musicVol,s:audio.sfxVol}));}catch{/* Storage may be disabled. */}};
  const chooseScene=(id:SceneId)=>{click();setScene(id);};
  const fullScreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setToast('当前浏览器不支持全屏，可按 F11 欣赏画卷。');}};
  const start=()=>{click();hasSave?setPanel('confirm'):onNew();};

  return <main className={`cultivation-title scene-${scene} ${view?'is-contemplating':''}`} onPointerDown={()=>{if(sound)audio.unlock();}}>
    <MoodLandscape scene={scene}/>
    <motion.header className="title-masthead" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} transition={{duration:1.1}}>
      <a className="masthead-brand" href="#" onClick={(e)=>{e.preventDefault();setView(false);setPanel('');}} aria-label="凡人修仙传首页">
        <span className="brand-seal">凡<span>人</span></span>
        <span className="brand-wordmark">凡人修仙传<small>FAN REN · A MORTAL'S JOURNEY</small></span>
      </a>
      <nav className="title-navigation" aria-label="主导航">
        <button className="nav-current" onClick={()=>{click();setView(false);setPanel('');}}>初入人界<span/></button>
        <button onClick={()=>{click();setView(true);}}>山河画卷</button>
        <button onClick={()=>{click();setPanel('guide');}}>修行指南</button>
        <button onClick={()=>{click();setPanel('about');}}>关于此作</button>
      </nav>
      <span className="edition-mark">人界篇<span>非商业同人作品</span></span>
    </motion.header>

    <AnimatePresence>
      {!view&&<motion.section className="journey-intro" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:1.2,delay:.12}}>
        <div className="intro-eyebrow"><span/>水墨天地 · 自在修行</div>
        <div className="hero-brand"><h1>凡人修仙传</h1><span className="hero-seal">人界<br/>山河</span></div>
        <p className="intro-verse">一介凡人，亦可问鼎长生。</p>
        <p className="intro-description">从一缕晨光出发，于万里山河间，寻你的仙途。</p>
        <div className="journey-actions">
          <button className="begin-journey" onClick={start}><span className="button-diamond"/><span>踏入仙途</span><ArrowRight size={18} strokeWidth={1.4}/></button>
          <button className="resume-journey" onClick={()=>{click();onContinue();}} disabled={!hasSave}>继续前缘<span>{hasSave?'载入修行记录':'暂无修行记录'}</span></button>
        </div>
        <button className="explore-link" onClick={()=>{click();setView(true);}}><Compass size={15} strokeWidth={1.3}/><span>且停一停，看一程山水</span><ArrowRight size={13}/></button>
      </motion.section>}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {!view&&<motion.aside className="landscape-inscription" key={scene} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:1}}>
        <span className="inscription-line"/><span>{selected.sub}</span><span className="inscription-seal">观</span>
      </motion.aside>}
    </AnimatePresence>
    {view&&<motion.button className="return-from-view" initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setView(false)}><ArrowRight size={16}/>返回仙途<span>ESC</span></motion.button>}

    <motion.div className="landscape-console" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:1,delay:.5}}>
      <div className="current-landscape"><span className="landscape-symbol"><svg viewBox="0 0 40 40" fill="none"><path d="M3 29L13 13l7 10 6-15 11 21M10 29l7-9 7 9M4 33h32" stroke="currentColor" strokeWidth="1.2"/><circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1"/></svg></span><div><span className="landscape-location">天南 · {selected.place}</span><span className="landscape-time">{selected.time}</span></div><span className="landscape-live" title="动态山水画卷"><i/>实时意境</span></div>
      <div className="scene-picker" role="group" aria-label="切换画卷意境">
        <span className="scene-picker-label">观天时</span>
        {SCENES.map((s)=>{const Icon=sceneIcons[s.id];return <button key={s.id} className={scene===s.id?'selected':''} aria-pressed={scene===s.id} onClick={()=>chooseScene(s.id)}><Icon size={18} strokeWidth={1.25}/><span>{s.label}</span>{scene===s.id&&<motion.i layoutId="time-indicator" transition={{duration:.4}}/>}</button>;})}
      </div>
      <div className="landscape-tools">
        <button title={sound?'关闭环境音':'开启环境音'} aria-label={sound?'关闭环境音':'开启环境音'} aria-pressed={sound} onClick={toggleSound}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
        <button title="全屏赏景" aria-label="全屏赏景" onClick={fullScreen}><Expand size={18}/></button>
        <span className="tool-divider"/>
        <button title="设置" aria-label="设置" onClick={()=>{click();setPanel('settings');}}><Settings2 size={19}/></button>
      </div>
    </motion.div>
    <footer className="new-title-footer"><span>本作为非商业同人作品，致敬忘语《凡人修仙传》</span><button onClick={()=>setPanel('journal')}><i/>v0.47 · 山河有境<ArrowRight size={12}/></button><span className="footer-note">山河万里，皆是修行。</span></footer>

    <AnimatePresence>{toast&&<motion.div role="status" className="mood-toast" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>{toast}</motion.div>}</AnimatePresence>
    {panel==='settings'&&<SettingsPanel onClose={()=>{setSound(audio.enabled);setPanel('');}}/>}
    <AnimatePresence>{panel&&panel!=='settings'&&<motion.div className="mood-dialog-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setPanel('')}>
      <motion.section className="mood-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} onClick={(e)=>e.stopPropagation()}>
        <button className="mood-dialog-close" aria-label="关闭" onClick={()=>setPanel('')}><X size={20}/></button>
        <span className="dialog-eyebrow">凡人修仙传 · 人界篇</span>
        <h2 id="dialog-title">{panel==='guide'?'修行入门':panel==='about'?'山河有境，仙途无涯':panel==='journal'?'山河有境':'再续一段仙缘'}</h2>
        {panel==='guide'&&<><p className="dialog-lead">从黄枫谷出发。修行之路，没有唯一的答案。</p><div className="guide-rows"><div><Compass size={20}/><p><b>行走天地</b><span><kbd>W A S D</kbd> 移动，点击地面前往，滚轮缩放。<kbd>M</kbd> 展开人界舆图。</span></p></div><div><Feather size={20}/><p><b>修身问道</b><span><kbd>Z</kbd> 打坐，<kbd>C</kbd> 查看修为，<kbd>E</kbd> 采集灵物，<kbd>B</kbd> 打开储物袋。</span></p></div><div><BookOpen size={20}/><p><b>御剑斗法</b><span><kbd>F</kbd> 御剑，<kbd>1-9</kbd> 施法，<kbd>空格</kbd> 闪避。量力而行，留得青山。</span></p></div></div><button className="dialog-primary" onClick={()=>setPanel('')}>心中有数了<Check size={16}/></button></>}
        {panel==='about'&&<><p className="dialog-lead">一介凡人，一卷山河，一场与长生的约定。</p><p>这是一个以忘语《凡人修仙传》为世界观的非商业 2D 同人游戏。你将扮演韩立，在天南、乱星海与大晋自由游历，于机缘、因果与人心之间，走出自己的修仙路。</p><p>水墨淡彩为骨，烟岚星月为魂。远山、晨昏、渔火与雁阵，让每一次停步，都值得。</p><p className="dialog-footnote">人物与世界观版权归原作者所有。本作仅供同好交流。</p></>}
        {panel==='journal'&&<><p className="dialog-lead">v0.47 意境更新 · 让山河有呼吸</p><ul className="release-notes"><li><b>山有三远</b><span>三层远山长卷，随镜头轻移，随风雨隐现。</span></li><li><b>天有四时</b><span>晨青、午晴、暮赭、夜蓝，时辰与天气连续调色。</span></li><li><b>水有烟岚</b><span>真实透明烟岚替代圆团湖雾，停步十秒，留白自来。</span></li><li><b>人间有声</b><span>雁阵、孤帆、渔火与炊烟，点亮万里人界。</span></li></ul><button className="dialog-primary" onClick={()=>{setPanel('');setView(true);}}>展开山河画卷<ArrowRight size={16}/></button></>}
        {panel==='confirm'&&<><p className="dialog-lead">此间已有你的修行足迹。</p><p>重新开始会覆盖当前自动存档，手动存档仍然保留。你也可以继续前缘。</p><div className="confirm-actions"><button className="dialog-secondary" onClick={()=>{setPanel('');onContinue();}}>继续前缘</button><button className="dialog-primary" onClick={()=>{setPanel('');onNew();}}>重入仙途<ArrowRight size={16}/></button></div></>}
      </motion.section>
    </motion.div>}</AnimatePresence>
  </main>;
}