// 第二十步：小地图各档位截图（右上角裁出）
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [prefix = 'mm', xs = '251520', ys = '139200', dprS = '1'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: Number(dprS) } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.evaluateOnNewDocument(() => { localStorage.setItem('fanren.minimapZoom', '0'); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 120000 });
await p.evaluate((x, y) => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(x, y); setInterval(() => { g.hero.hp = 1; g.hero.dead = false; g.combat.enemies = []; }, 150); }, Number(xs), Number(ys));
await new Promise((r) => setTimeout(r, 5000));
for (let i = 0; i < 4; i++) {
  if (i) { await p.click('.mm-zoom.in'); }
  await new Promise((r) => setTimeout(r, 6000));
  const el = await p.$('.minimap-wrap');
  const bb = await el.boundingBox();
  await p.screenshot({ path: `tools/out/${prefix}${i}.png`, clip: { x: bb.x - 20, y: bb.y - 10, width: bb.width + 40, height: bb.height + 30 } });
  console.log('saved', i);
}
await b.close();
