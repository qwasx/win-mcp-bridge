// 第四十六步：自动化诊断（不截图，输出数值：意境湖、众生、天象、性能、名胜贴图）
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const exe = await chromium.executablePath();
const b = await puppeteer.launch({ executablePath: exe, args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'], headless: true, defaultViewport: { width: 1280, height: 800 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('err: ' + m.text().slice(0, 160)); });
await p.goto('http://localhost:4173/?auto=new&gl=0', { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!(window).__game && (window).__game.renderer, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2000));
await p.evaluate(`window.S46=(()=>{const G=window.__game;const cm=()=>{for(let i=0;i<8&&G.modal;i++)G.closeModal();if(G.visitQ)G.visitQ=null;};const shore=(cx,cy,ang,back)=>{const T=G.terrain;let x=cx,y=cy;for(let d=0;d<9000;d+=40){x=cx+Math.cos(ang)*d;y=cy+Math.sin(ang)*d*0.8;if(T.isLand(x,y)&&T.isLand(x+Math.cos(ang)*70,y+Math.sin(ang)*56))break;}return [x+Math.cos(ang)*(back??150),y+Math.sin(ang)*(back??150)*0.8];};const tp=(x,y,w,z,day)=>{cm();if(G.story)G.story.mind=0;G.player.x=x;G.player.y=y;G.cam.x=x;G.cam.y=y;G.cam.targetZoom=z??1.2;G.revealAll=true;G.debugSeeAll=true;G.baseSenseRadius=3400;G.weather.forced=w;G.weather.next=w;G.weather.kind=w;G.weather.k=1;G.clock=240*(day??0.5);G.updateUI(true);};const st=(cx,cy,ang,w,z,day)=>{const [x,y]=shore(cx,cy,ang);tp(x,y,w,z,day);return [Math.round(x),Math.round(y)];};return {G,cm,st,tp};})();1`);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const prof = () => p.evaluate(() => { const G = window.S46.G; const pr = (window).__prof ?? (window).__prof === undefined ? null : null; return null; });
const bench = async (secs) => { const r = await p.evaluate(async (secs) => { const G = window.S46.G; G.paused = false; let n = 0; const t0 = performance.now(); await new Promise((res) => { const step = () => { n++; if (performance.now() - t0 < secs * 1000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); return { fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1) }; }, secs); return r; };
const stat = () => p.evaluate(() => {
  const G = window.S46.G, out = {};
  out.koi = G.scenery.koi.length; out.flies = G.scenery.flies.length; out.wisps = G.scenery.wisps.length; out.mist = G.scenery.mist.length;
  out.lake = G.scenery.here?.name ?? null; out.mood = G.scenery.here?.mood ?? null; out.weather = G.weather.kind; out.weatherK = +G.weather.k.toFixed(2);
  out.lakes = [...new Set(G.scenery.lakes.map((l) => l.name + ':' + l.mood))].join(',');
  out.npc = G.npcs.active.size;
  const acts = {}; for (const a of G.npcs.active.values()) { const k = a.life?.k ?? a.act; acts[k] = (acts[k] ?? 0) + 1; }
  out.acts = acts;
  const minds = []; for (const a of G.npcs.active.values()) if (a.bubble?.mind) minds.push(a.bubble.text);
  out.minds = minds.slice(0, 5);
  out.fps = G.renderer ? +(G.renderer.fps ?? 0).toFixed(1) : null;
  out.crit = [...G.life.ents].reduce((m, e) => { m[e.kind] = (m[e.kind] ?? 0) + 1; return m; }, {});
  return out;
});
// 1) 五片湖
for (const [nm, cx, cy, w, day] of [['镜湖', 223500, 158400, 'rain', 0.5], ['碧落湖', 210000, 82500, 'clear', 0.5], ['翠竹湖', 38400, 81000, 'fog', 0.5], ['黑水泽', 117600, 135000, 'fog', 0.04], ['云梦泽', 175500, 133500, 'rain', 0.5]]) {
  await p.evaluate((a) => window.S46.tp(a[0], a[1], a[2] === 'rain' && a[4] === 'lotus' ? 'clear' : a[2], 1.15, a[3]), [cx, cy, w, day, nm === '镜湖' ? 'lotus' : '']);
  await wait(9); const s = await stat(); console.log(nm, JSON.stringify({ koi: s.koi, flies: s.flies, wisps: s.wisps, lake: s.lake, mood: s.mood, weather: s.weather + '/' + s.weatherK, npc: s.npc, acts: s.acts, fps: s.fps, crit: s.crit }));
}
// 2) 城镇市井
await p.evaluate(() => { const S = window.S46, G = S.G; const l = window.__fanrenLocs().find((x) => x.type === 'town' && x.map === 'tiannan'); S.tp(l.x * 300, l.y * 300 + 400, 'clear', 1.15, 0.4); return l.name; });
console.log('NPC明细', JSON.stringify(await p.evaluate(() => { const G = window.S46.G; const out = []; for (const a of G.npcs.active.values()) out.push({ n: a.d.name.slice(0,4), f: a.d.faction, act: a.act, life: a.life?.k ?? '-', wait: +a.wait.toFixed(1), goal: a.d.goal, dd: Math.round(Math.hypot(a.d.tx - a.st.x, a.d.ty - a.st.y)), dist: Math.round(Math.hypot(a.st.x - G.player.x, a.st.y - G.player.y)), path: !!(a).path }); return out.slice(0, 10); })));
const agg = {}; let minds = [];
for (let i = 0; i < 14; i++) { await wait(1.2); const s2 = await stat(); for (const k in s2.acts) agg[k] = (agg[k] ?? 0) + s2.acts[k]; for (const m of s2.minds) if (minds.length < 8) minds.push(m); }
console.log('市井', JSON.stringify({ npc: (await stat()).npc, acts: agg, minds }));
// 3) 名胜贴图是否加载成功
console.log('名胜', JSON.stringify(await p.evaluate(() => {
  const G = window.S46.G;
  const near = G.landmarks ? (G.landmarks['near'] ? null : null) : null;
  // 数出视野内参与绘制的名胜
  const v = G.renderer.viewRect();
  let n = 0, names = [];
  try { for (const L of (window).__fanrenLM()) { if (L.x + L.r > v.left && L.x - L.r < v.right && L.y + L.r > v.top && L.y - L.r < v.bottom) { n++; if (L.name) names.push(L.name); } } } catch (e) { }
  return { inView: n, names: names.slice(0, 12), player: [Math.round(G.player.x), Math.round(G.player.y)] };
})));
// 4) 天象：结婴各阶段 + 性能
await p.evaluate(() => { const G = window.S46.G, S = window.S46; S.cm(); G.player.x = 223500; G.player.y = 158900; G.cam.x = G.player.x; G.cam.y = G.player.y - 60; G.cam.targetZoom = 0.95; G.revealAll = true; G.debugSeeAll = true; G.baseSenseRadius = 3400; G.weather.forced = 'clear'; G.weather.next = 'clear'; G.clock = 240 * 0.5; G.tianxiang.start('jieying', true, G); G.paused = false; return 1; });
for (let i = 0; i < 8; i++) { await p.evaluate(() => { const G = window.S46.G; for (let k = 0; k < 30; k++) G.tianxiang.update(0.05, G); }); const t = await p.evaluate(() => ({ k: window.S46.G.tianxiang.kind, ph: window.S46.G.tianxiang.phase, t: +window.S46.G.tianxiang.t.toFixed(1), lift: +window.S46.G.player.st.lift.toFixed(1), sit: window.S46.G.player.sitting, petal: window.S46.G.tianxiang['petals']?.length ?? 0 })); console.log('天象', JSON.stringify(t)); }
// 5) 突破入口（真实调用 breakthrough，检查不再弹 CG）
const br = await p.evaluate(async () => { const G = window.S46.G, S = window.S46; S.cm(); const h = G.hero; h.realm = 3; h.stage = 2; h.exp = 1e12; h.pillN = 0; G.onAscend = () => 'SHOULD_NOT_FIRE'; const before = G.tianxiang.active; let fired = false; G.onAscend = () => { fired = true; }; const r = G.breakthrough(2, 1); return { before, fired, ok: r.ok, tx: G.tianxiang.kind, paused: G.paused, realm: h.realm, modal: !!G.modal }; });
console.log('breakthrough', JSON.stringify(br));
await wait(6); console.log('after', JSON.stringify(await p.evaluate(() => ({ k: window.S46.G.tianxiang.kind, ph: window.S46.G.tianxiang.phase, t: +window.S46.G.tianxiang.t.toFixed(1) }))));
await wait(26); console.log('done', JSON.stringify(await p.evaluate(() => ({ k: window.S46.G.tianxiang.kind, realm: window.S46.G.hero.realm, stage: window.S46.G.hero.stage, lift: window.S46.G.player.st.lift, sit: window.S46.G.player.sitting, vfx: (window.S46.G.combat.vfx ?? []).length }))));
console.log(errs.slice(0, 8).join('\n'));
await b.close();
