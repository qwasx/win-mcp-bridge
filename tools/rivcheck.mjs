// CPU 河道镜像 vs GPU 地表：在截图上用红点标出 CPU 判定为河水的位置
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'], headless: true, defaultViewport: { width: 1280, height: 800 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; const x = 540 * 300, y = 323 * 300; g.teleport(x, y); g.player.flying = true; g.cam.x = x; g.cam.y = y; g.cam.zoom = g.cam.targetZoom = 0.6; });
await new Promise((r) => setTimeout(r, 7000));
const n = await p.evaluate(() => {
  const g = window.__game, T = g.terrain, z = g.cam.zoom, cv = document.createElement('canvas'); cv.width = 1280; cv.height = 800;
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(cv);
  const c = cv.getContext('2d'); c.fillStyle = 'rgba(255,0,0,0.9)'; let n = 0;
  for (let sy = 0; sy < 800; sy += 10) for (let sx = 0; sx < 1280; sx += 10) {
    const wx = g.cam.x + (sx - 640) / z, wy = g.cam.y + (sy - 400) / z;
    const d = T.riverEdge(wx, wy); if (d < 0) { c.fillRect(sx - 1, sy - 1, 2, 2); n++; } else if (d < 3) { c.fillStyle = 'rgba(255,255,0,1)'; c.fillRect(sx - 1, sy - 1, 3, 3); c.fillStyle = 'rgba(255,0,0,0.9)'; }
  }
  return n;
});
console.log('cpu water pts', n);
await p.screenshot({ path: 'tools/out/rivcheck.jpg', quality: 88 });
await b.close();
