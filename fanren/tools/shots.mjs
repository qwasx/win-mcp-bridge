// 一次启动浏览器，按列表连拍多处地表（迭代画面用）
// 用法: node tools/shots.mjs prefix "x,y,zoom[,season]" ... [--w=1280 --h=800]
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const pos = args.filter((x) => !x.startsWith('--'));
const prefix = pos[0];
const W = Number(flag('w', 1280)), H = Number(flag('h', 800));
const b = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + '] ' + m.text()); });
await p.goto(flag('url', 'http://localhost:4173/?auto=new'), { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; });
let i = 0;
for (const spec of pos.slice(1)) {
  let [x, y, z, season, hour] = spec.replace(/^c/, '').split(',').map(Number);
  if (spec.startsWith('c')) {
    // 在附近找一段海岸线
    const r = await p.evaluate((x, y) => { const T = window.__game.terrain; for (let R = 0; R < 30000; R += 150) for (let a = 0; a < 6.28; a += 0.3) { const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R; if (Math.abs(T.visLand(px, py) - 0.5) < 0.01) return [px, py]; } return [x, y]; }, x, y);
    x = r[0]; y = r[1];
  }
  await p.evaluate((x, y, z, season, hour) => {
    const g = window.__game; g.modal = null; g.emitModal();
    g.teleport(x, y); g.cam.x = x; g.cam.y = y; g.cam.targetZoom = g.cam.zoom = z;
    if (!isNaN(season)) { g.__season = season; Object.defineProperty(g, 'season', { get() { return g.__season; }, configurable: true }); }
    if (!isNaN(hour)) g.__hour = hour;
  }, x, y, z, season, hour);
  await new Promise((r) => setTimeout(r, Number(flag('delay', 5000))));
  const name = `tools/out/${prefix}${i++}.png`;
  await p.screenshot({ path: name });
  console.log('saved', name, spec);
}
await b.close();
