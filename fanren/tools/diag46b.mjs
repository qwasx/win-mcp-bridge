// 第四十六步：专项诊断——心声泡、荷花蜻蜓、市井活动占比、帧率
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const exe = await chromium.executablePath();
const b = await puppeteer.launch({ executablePath: exe, args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'], headless: true, defaultViewport: { width: 1280, height: 800 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
await p.goto('http://localhost:4173/?auto=new&gl=0', { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!(window).__game && (window).__game.renderer, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2000));
await p.evaluate(`window.S46=(()=>{const G=window.__game;const cm=()=>{for(let i=0;i<8&&G.modal;i++)G.closeModal();if(G.visitQ)G.visitQ=null;};const tp=(x,y,w,z,day)=>{cm();if(G.story)G.story.mind=0;G.player.x=x;G.player.y=y;G.cam.x=x;G.cam.y=y;G.cam.targetZoom=z??1.2;G.revealAll=true;G.debugSeeAll=true;G.baseSenseRadius=3400;G.weather.forced=w;G.weather.next=w;G.weather.kind=w;G.weather.k=1;G.clock=240*(day??0.5);G.updateUI(true);};return {G,cm,tp};})();1`);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// 1) 荷花荡旁（听雨水榭一带，白天晴天）：蜻蜓 + 心声
console.log('位置', await p.evaluate(() => { window.S46.tp(757.5 * 300 - 260, 529 * 300 + 120, 'clear', 1.2, 0.5); return [Math.round(window.S46.G.player.x), Math.round(window.S46.G.player.y)]; }));
let flies = 0, koi = 0, minds = [], acts = {};
for (let i = 0; i < 16; i++) {
  await wait(1.2);
  const s = await p.evaluate(() => {
    const G = window.S46.G;
    const minds = []; for (const a of G.npcs.active.values()) if (a.bubble?.mind) minds.push(a.d.name + ':' + a.bubble.text);
    const acts = {}; for (const a of G.npcs.active.values()) { const k = a.life?.k ?? a.act; acts[k] = (acts[k] ?? 0) + 1; }
    return { flies: G.scenery.flies.length, koi: G.scenery.koi.length, minds, acts, npc: G.npcs.active.size, night: +G.night.toFixed(2), light: +G.light.toFixed(2), hour: Math.round((G.dayPhase * 24 + 6) % 24) };
  });
  flies = Math.max(flies, s.flies); koi = Math.max(koi, s.koi); if (s.minds.length) minds.push(...s.minds);
  for (const k in s.acts) acts[k] = (acts[k] ?? 0) + s.acts[k];
  if (i === 15) console.log('荷花荡', JSON.stringify(s));
}
console.log('荷花荡汇总', JSON.stringify({ maxFlies: flies, maxKoi: koi, minds: minds.slice(0, 6), acts }));

// 2) 城镇：长时间观察（活动占比 + 心声 + 反应）
const town = await p.evaluate(() => { const l = window.__fanrenLocs().find((x) => x.type === 'town' && x.map === 'tiannan'); window.S46.tp(l.x * 300, l.y * 300 + 300, 'clear', 1.15, 0.42); return l.name; });
const agg = {}; let m2 = [], npcMax = 0;
for (let i = 0; i < 20; i++) {
  await wait(1.2);
  const s = await p.evaluate(() => { const G = window.S46.G; const acts = {}; for (const a of G.npcs.active.values()) { const k = a.life?.k ?? a.act; acts[k] = (acts[k] ?? 0) + 1; } const minds = []; for (const a of G.npcs.active.values()) if (a.bubble?.mind) minds.push(a.bubble.text); const det = [...G.npcs.active.values()].slice(0, 4).map((a) => ({ d: Math.round(Math.hypot(a.st.x - G.player.x, a.st.y - G.player.y)), mt: a.mindT === undefined ? null : +a.mindT.toFixed(1), act: a.act, life: a.life?.k ?? '-' })); return { acts, minds, npc: G.npcs.active.size, det }; });
  npcMax = Math.max(npcMax, s.npc); for (const k in s.acts) agg[k] = (agg[k] ?? 0) + s.acts[k]; if (s.minds.length) m2.push(...s.minds);
  if (i === 19) console.log('城镇明细', JSON.stringify(s.det));
}
console.log('城镇', town, JSON.stringify({ npcMax, acts: agg, minds: m2.slice(0, 8) }));

// 3) 帧率（真实跑 6 秒）
console.log('帧率', JSON.stringify(await p.evaluate(async () => { const G = window.S46.G; let n = 0; const t0 = performance.now(); await new Promise((res) => { const step = () => { n++; if (performance.now() - t0 < 6000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); return { fps: +(n / 6).toFixed(1), tianxiang: G.tianxiang.kind }; })));
// 4) 天象期间帧率
await p.evaluate(() => { const G = window.S46.G; G.tianxiang.start('jieying', true, G); return 1; });
console.log('天象帧率', JSON.stringify(await p.evaluate(async () => { const G = window.S46.G; let n = 0; const t0 = performance.now(); await new Promise((res) => { const step = () => { n++; if (performance.now() - t0 < 6000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); return { fps: +(n / 6).toFixed(1), ph: G.tianxiang.phase, t: +G.tianxiang.t.toFixed(1) }; })));
console.log(errs.slice(0, 6).join('\n'));
await b.close();
