// 第十六步：三图截图  node tools/mapshot.mjs prefix [map,...] [--views=name:loc:zoom;...]
// 每张图：整图舆图（game.overview）+ 若干地面视角；同时记录世界生成耗时
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] ?? 'map';
const maps = (process.argv[3] ?? 'tiannan,luanxing,dajin').split(',');
const VIEWS = {
  tiannan: [['start', 'huangfeng', 0.8, 0, 900], ['yuejing', 'yuejing', 0.55, 0, 600], ['mulan', 'mulan', 0.5, 0, 0]],
  luanxing: [['tianxing', 'tianxing', 0.5, 0, 900], ['kuixing', 'chuansong_lx', 0.7, 0, 0]],
  dajin: [['jinjing', 'jinjing', 0.55, 0, 900], ['shuozhou', 'shuozhou', 0.55, 0, 0], ['beihan', 'beihan', 0.5, 0, 0]],
};
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const m of maps) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log(`[${m} pageerror] ` + e.message));
  p.on('console', (msg) => { if (msg.type() === 'error' && !/WebGL|GL_/.test(msg.text())) console.log(`[${m} err] ` + msg.text()); });
  const t0 = Date.now();
  await p.goto(`http://localhost:4173/?auto=new&map=${m}`, { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
  console.log(m, 'ready in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  // 整图
  const url = await p.evaluate(() => { const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; return g.overview.toDataURL('image/jpeg', 0.85); });
  fs.writeFileSync(`tools/out/${prefix}_${m}_overview.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  for (const [name, loc, zoom, dx, dy] of process.env.OV ? [] : VIEWS[m] ?? []) {
    const ok = await p.evaluate((loc, zoom, dx, dy) => {
      const g = window.__game, W = 300;
      const L = g.__locs?.find?.((l) => l.id === loc) ?? null;
      const l = L ?? window.__fanrenLoc?.(loc);
      if (!l) return false;
      g.hero.realm = 3; g.hero.stage = 1; g.player.flying = true; g.combat.reset(); g.combat.invulnT = 9999;
      g.teleport(l.x * W + dx, l.y * W + dy); g.cam.zoom = g.cam.targetZoom = zoom; g.clock = 0.4 * 240; g.modal = null; g.emitModal();
      document.querySelectorAll('.toast, .toasts, [class*="toast"]').forEach((e) => e.style.display = 'none');
      return true;
    }, loc, zoom, dx, dy);
    if (!ok) { console.log('no loc', loc); continue; }
    await sleep(9000);
    await p.screenshot({ path: `tools/out/${prefix}_${m}_${name}.jpg`, type: 'jpeg', quality: 80 });
    console.log('saved', m, name, await p.evaluate(() => window.__game.ui?.region));
  }
  await p.close();
}
await b.close();
