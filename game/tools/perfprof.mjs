// 第十七步：卡顿分析 —— CDP CPU 采样（未压缩构建，端口 4174），在繁华处来回走动，按函数自身耗时排序
// 用法: node tools/perfprof.mjs [loc] [map] [seconds]
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [loc = 'yuejing', map = 'tiannan', secS = '8'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto(`http://localhost:4174/?auto=new&map=${map}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
await p.evaluate((loc) => {
  const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal(); g.showPerf = true; g.hero.realm = 2; g.hero.stage = 1;
  const l = window.__fanrenLoc(loc); g.teleport(l.x * 300 - 2500, l.y * 300 + 1200); g.cam.zoom = g.cam.targetZoom = 0.8;
  window.__walk = () => { const l2 = window.__fanrenLoc(loc); const k = (Math.floor(performance.now() / 4000) % 2) ? 1 : -1; g.destination = { x: l2.x * 300 + k * 2500, y: l2.y * 300 + 1200 }; };
  setInterval(window.__walk, 500);
}, loc);
await new Promise((r) => setTimeout(r, 8000));
const cdp = await p.target().createCDPSession();
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await p.evaluate(() => { const pf = window.__game.perf; pf.frames = 0; pf.acc = 0; pf.upd = 0; pf.ren = 0; });
await cdp.send('Profiler.start');
await new Promise((r) => setTimeout(r, Number(secS) * 1000));
const { profile } = await cdp.send('Profiler.stop');
const perf = await p.evaluate(() => { const g = window.__game, pf = g.perf, r = g.renderer; return { fps: pf.fps, updMs: pf.updMs, renMs: pf.renMs, trees: r.stats.trees, grass: r.stats.grass, decos: r.stats.decos, mtns: r.stats.mtns, npcActive: g.npcs.active.size, life: g.life.ents?.length }; });
console.log(JSON.stringify(perf));
// 自身耗时
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas; let total = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]); const f = n.callFrame; const key = `${f.functionName || '(anon)'} :${f.lineNumber + 1}`;
  const ms = (dt[i] ?? 0) / 1000; total += ms; self.set(key, (self.get(key) ?? 0) + ms);
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 32);
for (const [k, v] of top) console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${v.toFixed(0).padStart(6)}ms  ${k}`);
await b.close();
