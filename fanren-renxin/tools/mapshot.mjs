// 第三十步：大地图缩放截图：node tools/mapshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'm30';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.cinema = () => {}; });
await new Promise((r) => setTimeout(r, 5000));
await p.evaluate(() => window.__game.onOpenMap());
await new Promise((r) => setTimeout(r, 6000));
await p.screenshot({ path: `tools/out/${prefix}0.png` }); console.log('z1 frame ms', await p.evaluate(() => Math.round(window.__wmMs)));
for (let i = 1; i <= 3; i++) {
  for (let k = 0; k < 2; k++) { await p.keyboard.press('='); await new Promise((r) => setTimeout(r, 400)); }
  const t0 = Date.now(); await new Promise((r) => setTimeout(r, 8000));
  const ms = []; for (let j = 0; j < 5; j++) { ms.push(await p.evaluate(() => Math.round(window.__wmMs))); await new Promise((r) => setTimeout(r, 300)); }
  await p.screenshot({ path: `tools/out/${prefix}${i}.png` }); console.log('shot', i, Date.now() - t0, 'frame ms', ms.join(','));
}
// 拖动
const box = await (await p.$('.worldmap-canvas')).boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx - 250, cy - 120, { steps: 8 }); await p.mouse.up();
await new Promise((r) => setTimeout(r, 4000));
await p.screenshot({ path: `tools/out/${prefix}4.png` });
await p.mouse.wheel({ deltaY: 400 }); await new Promise((r) => setTimeout(r, 4000));
await p.screenshot({ path: `tools/out/${prefix}5.png` });
await b.close();
