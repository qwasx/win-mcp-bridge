// 三图：主要地点是否都在陆地上
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'], headless: true, defaultViewport: { width: 800, height: 600 } });
for (const m of ['tiannan', 'luanxing', 'dajin']) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log(`[${m} pageerror] ` + e.message));
  await p.goto(`http://localhost:4173/?auto=new&map=${m}`, { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
  const r = await p.evaluate(() => {
    const g = window.__game, T = g.terrain, bad = [], W = 300; let minor = 0;
    for (const l of g.__allLocs ?? []) { /* */ }
    const locs = window.__fanrenLocs();
    for (const l of locs) { const land = T.isLand(l.x * W, l.y * W); if (!land) { if (l.minor) minor++; else bad.push(l.name); } }
    if (window.location.search.includes('ov')) {}
    return { n: locs.length, bad, minor };
  });
  console.log(m, JSON.stringify(r));
  const url = await p.evaluate(() => window.__game.overview.toDataURL('image/jpeg', 0.85));
  fs.writeFileSync(`tools/out/lc_${m}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  await p.close();
}
await b.close();
