import type { Game } from './game';
import { moonPhase } from './weather';

export const MOOD_ASSETS = ['far_mtn_1', 'far_mtn_2', 'far_mtn_3', 'sky_dawn_mist', 'sky_dusk_glow', 'sky_cloud_band', 'moon_full', 'moon_crescent', 'sky_starriver', 'rain_veil', 'mist_band_1', 'mist_band_2', 'mist_puff_1', 'mist_puff_2', 'wild_geese', 'lone_sail', 'fishing_light', 'cooking_smoke', 'reed_marsh', 'lotus_withered', 'plum_branch', 'paper_grain', 'ink_vignette'] as const;
export type MoodAsset = typeof MOOD_ASSETS[number];
const images = new Map<MoodAsset, HTMLImageElement>();
export const moodUrl = (name: MoodAsset) => `./mood/${name}.png`;
export function moodArt(name: MoodAsset): HTMLImageElement | null {
  let im = images.get(name);
  if (!im && typeof Image !== 'undefined') {
    im = new Image(); im.decoding = 'async'; im.src = moodUrl(name); images.set(name, im);
  }
  return im?.complete && im.naturalWidth > 0 ? im : null;
}
export function preloadMood() { MOOD_ASSETS.forEach(moodArt); }
export function moodStamp(ctx: CanvasRenderingContext2D, name: MoodAsset, x: number, y: number, w: number, h: number, alpha = 1) {
  const im = moodArt(name); if (!im || alpha <= .002) return false;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(im, x, y, w, h); ctx.restore(); return true;
}
function tile(ctx: CanvasRenderingContext2D, name: MoodAsset, width: number, y: number, height: number, offset: number, alpha: number) {
  const im = moodArt(name); if (!im || alpha <= .002) return;
  const w = height * im.naturalWidth / im.naturalHeight;
  const start = -((offset % w + w) % w);
  ctx.save(); ctx.globalAlpha *= alpha;
  for (let x = start; x < width; x += w) ctx.drawImage(im, x, y, w + .5, height);
  ctx.restore();
}

/** Screen-space air, separate from Y-sorted world objects and combat/UI. */
export class MoodRenderer {
  enabled = true;
  idle = 0;
  lastX = NaN; lastY = NaN;
  ms = 0;
  private paper: CanvasPattern | null = null;
  private paperCtx: CanvasRenderingContext2D | null = null;
  private snowRidge: HTMLCanvasElement | null = null;

  far(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, dpr: number) {
    if (!this.enabled) return;
    const t0 = performance.now();
    const wet = g.weather.kind === 'rain' || g.weather.kind === 'storm';
    const snow = g.weather.kind === 'snow';
    const rain = wet ? g.weather.k : 0;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const height = g.photoMode ? H*.46 : Math.min(255, H * .30);
    const haze = ctx.createLinearGradient(0, 0, 0, height);
    haze.addColorStop(0, `rgba(223,228,214,${.45 + rain*.2})`); haze.addColorStop(1, 'rgba(223,228,214,0)');
    ctx.fillStyle = haze; ctx.fillRect(0, 0, W, height);
    const factors = [.05, .12, .22];
    for (let i = 0; i < 3; i++) {
      const a = [.36, .33, .30][i] * (g.photoMode?1.6:1) * (i > 0 ? 1-rain*.92 : 1) * (1-g.night*.3);
      tile(ctx, `far_mtn_${i+1}` as MoodAsset, W, -height*.22+i*height*.075, height*(.72+i*.14), g.cam.x*factors[i], a);
    }
    if (snow) {
      const mountain=moodArt('far_mtn_2');
      if(!this.snowRidge&&mountain){
        const c=document.createElement('canvas');c.width=mountain.naturalWidth;c.height=mountain.naturalHeight;
        const s=c.getContext('2d')!;s.drawImage(mountain,0,0);s.globalCompositeOperation='source-in';s.fillStyle='#edf3ee';s.fillRect(0,0,c.width,c.height);this.snowRidge=c;
      }
      if(this.snowRidge){
        const h=height*.84,w=h*this.snowRidge.width/this.snowRidge.height;
        const start=-((g.cam.x*.12%w+w)%w);ctx.globalAlpha=.35*g.weather.k;
        for(let x=start;x<W;x+=w)ctx.drawImage(this.snowRidge,x,-height*.15,w+.5,h);
        ctx.globalAlpha=1;
      }
    }
    const phase = g.dayPhase;
    const dawn = Math.max(0, 1-Math.abs(phase-.23)/.1), dusk = Math.max(0,1-Math.abs(phase-.76)/.10);
    tile(ctx, 'sky_cloud_band', W, -10, height*.45, g.time*3+g.cam.x*.025, .36*(1-g.night));
    tile(ctx, 'sky_dawn_mist', W, -5, height*.7, g.time*2, dawn*.5);
    tile(ctx, 'sky_dusk_glow', W, -6, height*.65, g.time*1.3, dusk*.46);
    ctx.restore(); this.ms = performance.now()-t0;
  }

  finish(ctx: CanvasRenderingContext2D, g: Game, W: number, H: number, dpr: number, dt: number) {
    if (!this.enabled) return;
    const t0 = performance.now();
    const moved = Math.hypot(g.cam.x-this.lastX, g.cam.y-this.lastY) > .5;
    this.idle = moved || g.combat.inCombat ? 0 : this.idle+dt;
    this.lastX=g.cam.x; this.lastY=g.cam.y;
    const k=g.weather.k, night=g.night, clear=g.weather.kind==='clear';
    ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0);
    const moon=moonPhase(g.day);
    if (night>.4 && clear) {
      tile(ctx,'sky_starriver',W,-15,H*.28,g.time*.6,Math.max(0,(night-.65)/.35)*.65);
      if (moon.visible) {
        ctx.save();
        if (!moon.waxing && !moon.full) { ctx.translate(W*.8+92,0); ctx.scale(-1,1); }
        moodStamp(ctx,moon.full?'moon_full':'moon_crescent',!moon.waxing&&!moon.full?0:W*.8,H*.055,92,92,(night-.4)*.72);
        ctx.restore();
      }
    }
    const day=Math.floor(g.day);
    if (day%3===0 && clear && night<.5 && g.scenery.here?.mood!=='dark') {
      const duration=50, cycle=(g.time+day*13)%180;
      if (cycle<duration) moodStamp(ctx,'wild_geese',W-(W+300)*cycle/duration,H*.12,260,65,.6);
    }
    if (g.weather.kind==='rain'||g.weather.kind==='storm') {
      tile(ctx,'rain_veil',W,-H+((g.time*110)%H),H*2,g.time*22,.30*k);
    }
    const rest=Math.min(.28,Math.max(0,(this.idle-10)*.012));
    if (rest>0) {
      moodStamp(ctx,'mist_band_1',-W*.2+Math.sin(g.time*.024)*30,H*.64,W*.85,H*.16,rest);
      moodStamp(ctx,'mist_band_2',W*.52,H*.34,W*.7,H*.2,rest*.8);
    }
    const grain=moodArt('paper_grain');
    if (grain) {
      if (this.paperCtx!==ctx) { this.paper=null; this.paperCtx=ctx; }
      this.paper??=ctx.createPattern(grain,'repeat');
      if (this.paper) { ctx.globalAlpha=.05; ctx.globalCompositeOperation='overlay'; ctx.fillStyle=this.paper; ctx.fillRect(0,0,W,H); }
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    moodStamp(ctx,'ink_vignette',0,0,W,H,.45);
    ctx.restore(); this.ms+=performance.now()-t0;
  }
}