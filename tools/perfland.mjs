// 第三十八步：陆地 / 海上卡顿对比 —— 真浏览器（无头 Chromium + SwiftShader）里传送到指定地点来回走，
// 记录帧时间分布 + 分系统耗时（game.prof）+ CPU 自耗时 / 总耗时排行。
// 用法: LD_LIBRARY_PATH=/tmp/al/lib node tools/perfland.mjs <loc|x,y> [map=tiannan] [secs=8] [--shot=a.png] [--port=4174]
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const pos = args.filter((x) => !x.startsWith('--'));
const [loc = 'yuejing', map = 'tiannan', secS = '8'] = pos;
const port = flag('port', '4174');
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  headless: true, defaultViewport: { width: Number(flag('w', 1280)), height: Number(flag('h', 800)) } });
const p = await b.newPage();
const logs = [];
p.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push('[err] ' + m.text()); });
await p.goto(`http://localhost:${port}/?auto=new&map=${map}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer && window.__game.running, { timeout: 180000 });
const info = await p.evaluate((loc) => {
  const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal?.(); g.showPerf = true; g.hero.realm = 2; g.hero.stage = 1;
  let x, y;
  if (loc === 'sea') {
    const l = window.__fanrenLoc('yuejing'); x = l.x * 300; y = l.y * 300; const T = g.terrain;
    outer: for (let r = 2000; r < 80000; r += 1000) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r; let ok = true; for (let k = -3500; k <= 3500 && ok; k += 500) for (let j = -1500; j <= 1500 && ok; j += 500) if (T.isLand(px + k, py + j)) ok = false; if (ok) { x = px; y = py; break outer; } }
  } else if (/^-?\d+,-?\d+$/.test(loc)) [x, y] = loc.split(',').map(Number); else { const l = window.__fanrenLoc(loc); x = l.x * 300; y = l.y * 300 + 1200; }
  g.teleport(x - 2500, y); g.cam.zoom = g.cam.targetZoom = 0.8;
  if (!g.terrain.isLand(x, y) || window.__fly) { g.player.flying = true; }
  window.__walkC = [x, y];
  window.__walk = () => { const k = (Math.floor(performance.now() / 4000) % 2) ? 1 : -1; g.destination = { x: window.__walkC[0] + k * 2500, y: window.__walkC[1] }; };
  setInterval(window.__walk, 500);
  return { x, y, land: g.terrain.isLand(x, y) };
}, loc);
await new Promise((r) => setTimeout(r, 6000));
const cdp = await p.target().createCDPSession();
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
const res = await p.evaluate((secs) => new Promise((resolve) => {
  const g = window.__game; const ft = []; let last = performance.now(); const t0 = last;
  window.__prof.on = true; window.__prof.reset();
  const f0 = g.frameNo;
  function f(now) {
    ft.push(now - last); last = now;
    if (now - t0 < secs * 1000) requestAnimationFrame(f);
    else {
      const s = ft.slice().sort((a, b) => a - b), avg = ft.reduce((a, b) => a + b, 0) / ft.length;
      resolve({ frames: ft.length, gameFrames: g.frameNo - f0, fps: +(1000 / avg).toFixed(1), p50: +s[s.length >> 1].toFixed(1), p95: +s[Math.floor(s.length * .95)].toFixed(1), max: +s[s.length - 1].toFixed(0),
        upd: +g.perf.updMs.toFixed(1), ren: +g.perf.renMs.toFixed(1), stats: g.renderer.stats, prof: window.__prof.report(30), spikes: window.__prof.spikes.slice(-4),
        land: g.terrain.isLand(g.player.x, g.player.y), px: Math.round(g.player.x), py: Math.round(g.player.y), npcs: g.npcs.active.size, ents: g.life.ents?.length });
    }
  }
  requestAnimationFrame(f);
}), Number(secS));
const { profile } = await cdp.send('Profiler.stop');
const { prof: PR, ...rest } = res; console.log(JSON.stringify(info), JSON.stringify(rest)); for (const r of PR) console.log(`${r.ms.toFixed(2).padStart(7)}ms ×${String(r.n).padEnd(6)} ${r.k}`);
// 自耗时与总耗时（包含子调用）
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map(), incl = new Map(); let total = 0;
const key = (n) => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
for (let i = 0; i < profile.samples.length; i++) {
  const ms = (profile.timeDeltas[i] ?? 0) / 1000; total += ms;
  let n = byId.get(profile.samples[i]); self.set(key(n), (self.get(key(n)) ?? 0) + ms);
  const seen = new Set();
  while (n) { const k = key(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + ms); } n = byId.get(parent.get(n.id)); }
}
const busy = total - (self.get('(idle):0') ?? 0);
console.log(`total ${total.toFixed(0)}ms busy ${busy.toFixed(0)}ms`);
console.log('— self —'); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(flag('n', 28)))) console.log(`${(v / busy * 100).toFixed(1).padStart(5)}%  ${k}`);
console.log('— inclusive —'); for (const [k, v] of [...incl].filter(([k]) => !/^\((root|program|idle)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, Number(flag('n', 28)))) console.log(`${(v / busy * 100).toFixed(1).padStart(5)}%  ${k}`);
if (flag('shot')) await p.screenshot({ path: 'tools/out/' + flag('shot') });
if (flag('save')) writeFileSync('tools/out/' + flag('save'), JSON.stringify(profile));
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await b.close();
