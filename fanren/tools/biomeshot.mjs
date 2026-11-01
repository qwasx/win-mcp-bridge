// 第十七步：地表近景对照 —— 自动在当前图上找各类地貌（草甸/林地/草原/荒漠/雪原/山地/海岸/河流/官道）各拍一张
// 用法: node tools/biomeshot.mjs prefix [map] [zoom] [biome,...]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [prefix = 'bio', map = 'tiannan', zoomS = '0.9', only = ''] = process.argv.slice(2);
const zoom = Number(zoomS);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
if (process.env.NOMAT) await p.evaluateOnNewDocument(() => { window.__FANREN_NOMAT = true; });
await p.goto(`http://localhost:4173/?auto=new&map=${map}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
await p.addStyleTag({ content: '.hud, .hotbar, .minimap, .loc-card, .toast-wrap, .topbar, .keys-bar, .side-btns, .player-card, .date-card { display: none !important; }' });
const spots = await p.evaluate(() => {
  const g = window.__game, T = g.terrain, W = T.W, H = T.H, S = 300;
  g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true;
  const at = (a, x, y) => a[y * W + x];
  const ok = (x, y, r = 4) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || at(T.land, xx, yy) < 0.9) return false; } return true; };
  const near = (mask, x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) return true; } return false; };
  const found = {};
  const tests = {
    grass: (x, y) => ok(x, y) && at(T.arid, x, y) < 0.15 && at(T.forest, x, y) < 0.15 && at(T.cold, x, y) < 0.1 && at(T.elev, x, y) < 0.3 && !near(T.riverMask, x, y, 3) && !near(T.roadMask, x, y, 2),
    forest: (x, y) => ok(x, y) && at(T.forest, x, y) > 0.75 && at(T.elev, x, y) < 0.4 && !near(T.riverMask, x, y, 3),
    steppe: (x, y) => ok(x, y) && at(T.arid, x, y) > 0.5 && at(T.arid, x, y) < 0.7 && !near(T.roadMask, x, y, 2),
    desert: (x, y) => ok(x, y) && at(T.arid, x, y) > 0.88,
    snow: (x, y) => ok(x, y) && at(T.cold, x, y) > 0.8 && at(T.elev, x, y) < 0.5,
    hills: (x, y) => ok(x, y) && at(T.elev, x, y) > 0.5 && at(T.elev, x, y) < 0.65,
    coast: (x, y) => at(T.land, x, y) > 0.4 && at(T.land, x, y) < 0.6 && at(T.arid, x, y) < 0.3 && at(T.cold, x, y) < 0.2,
    river: (x, y) => ok(x, y, 2) && T.riverMask[y * W + x] && !near(T.roadMask, x, y, 3),
    road: (x, y) => ok(x, y) && T.roadMask[y * W + x] && !near(T.riverMask, x, y, 4) && at(T.arid, x, y) < 0.3,
  };
  // 确定性扫描：从图心向外，取每类第一个合格点（避开城镇）
  const locs = window.__fanrenLocs();
  const farTown = (x, y) => locs.every((l) => l.minor || Math.hypot(l.x - x, l.y - y) > 14);
  for (let i = 0; i < 400000 && Object.keys(found).length < Object.keys(tests).length; i++) {
    const a = i * 2.39996, r = Math.sqrt(i) * 0.9;
    const x = Math.round(W / 2 + Math.cos(a) * r), y = Math.round(H / 2 + Math.sin(a) * r * 0.8);
    if (x < 6 || y < 6 || x >= W - 6 || y >= H - 6) continue;
    for (const [k, f] of Object.entries(tests)) if (!found[k] && farTown(x, y) && f(x, y)) found[k] = [x * S, y * S];
  }
  return found;
});
console.log(JSON.stringify(Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v.map((n) => Math.round(n / 300))]))));
const want = only ? only.split(',') : Object.keys(spots);
for (const k of want) {
  if (!spots[k]) { console.log('no', k); continue; }
  const [x, y] = spots[k];
  await p.evaluate((x, y, z) => { const g = window.__game; g.modal = null; g.emitModal(); g.teleport(x, y); g.player.flying = true; g.cam.x = x; g.cam.y = y; g.cam.targetZoom = g.cam.zoom = z; g.__hour = 10; }, x, y, zoom);
  await new Promise((r) => setTimeout(r, 7000));
  await p.screenshot({ path: `tools/out/${prefix}_${k}.jpg`, quality: 88 });
  console.log('saved', k);
}
await b.close();
