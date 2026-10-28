// 真浏览器测试（无头 Chromium + SwiftShader WebGL）：性能采样、CPU 剖析、截图
// 依赖装在 /home/user/chr（npm i @sparticuz/chromium puppeteer-core），并需 LD_LIBRARY_PATH=/tmp/al/lib
// 用法: node tools/browser.mjs <out.png> [secs=6] [js-before] [--profile] [--w=1280 --h=800] [--url=...]
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const pos = args.filter((x) => !x.startsWith('--'));
const out = pos[0] || 'b.png';
const secs = Number(pos[1] || 6);
const pre = pos[2] || '';
const W = Number(flag('w', 1280)), H = Number(flag('h', 800));
const url = flag('url', 'http://localhost:4173/?auto=new');
const profile = args.includes('--profile');

const exe = await chromium.executablePath();
const b = await puppeteer.launch({
  executablePath: exe,
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.ACCEL2D ? [] : ['--disable-accelerated-2d-canvas']), '--autoplay-policy=no-user-gesture-required'],
  headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: Number(flag('dpr', 1)) },
});
const p = await b.newPage();
const logs = [];
p.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
p.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await p.goto(url, { waitUntil: 'load' });
// 等游戏就绪
await p.waitForFunction(() => !!(window).__game && (window).__game.renderer, { timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
if (pre) { const r = await p.evaluate(pre); if (r !== undefined) console.log('pre ->', JSON.stringify(r)); }
await new Promise((r) => setTimeout(r, Number(flag('delay', 800))));
let client = null;
if (profile) { client = await p.target().createCDPSession(); await client.send('Profiler.enable'); await client.send('Profiler.setSamplingInterval', { interval: 200 }); await client.send('Profiler.start'); }
// 采样帧时间
const res = await p.evaluate((secs) => new Promise((resolve) => {
  const g = (window).__game;
  const ft = []; let last = performance.now(); const t0 = last; const rms = [];
  function f(now) {
    ft.push(now - last); last = now;
    if (g.renderer?.stats?.ms) rms.push(g.renderer.stats.ms);
    if (now - t0 < secs * 1000) requestAnimationFrame(f);
    else {
      ft.sort((a, b) => a - b); rms.sort((a, b) => a - b);
      const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
      resolve({ frames: ft.length, fps: +(1000 / avg).toFixed(1), p50: +ft[ft.length >> 1].toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), renderP50: +(rms[rms.length >> 1] ?? 0).toFixed(1), stats: g.renderer.stats, perf: g.perf ?? null });
    }
  }
  requestAnimationFrame(f);
}), secs);
console.log('perf', JSON.stringify(res));
if (client) {
  const { profile: prof } = await client.send('Profiler.stop');
  writeFileSync('tools/out/' + out.replace(/\.png$/, '') + '.cpuprofile', JSON.stringify(prof));
  // 汇总自耗时最高的函数
  const self = new Map();
  const dt = prof.timeDeltas; const idIdx = new Map(prof.nodes.map((n, i) => [n.id, i]));
  const cnt = new Map();
  for (const s of prof.samples) cnt.set(s, (cnt.get(s) ?? 0) + 1);
  const total = prof.samples.length;
  for (const [id, c] of cnt) {
    const n = prof.nodes[idIdx.get(id)]; const cf = n.callFrame;
    const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + c);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
  console.log('top self-time:');
  for (const [k, v] of top) console.log((v / total * 100).toFixed(1).padStart(5) + '%  ' + k);
}
await p.screenshot({ path: 'tools/out/' + out });
console.log('saved', out);
const errs = logs.filter((l) => l.includes('error') || l.includes('Error'));
if (errs.length) console.log('console errors:\n' + errs.slice(0, 10).join('\n'));
await b.close();
