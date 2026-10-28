// 法术特效连拍：node tools/fxshot.mjs prefix id1,ms id2,ms ...
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2), prefix = args[0];
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = 0.9; setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; }, 200); });
await new Promise((r) => setTimeout(r, 9000));
await p.evaluate(() => { const g = window.__game; g.debugSpawn(['wolf', 'wolf', 'wolf'], 1, 1, 330); for (const id of ['huodan', 'hanbing']) g.debugCast(id); });
await new Promise((r) => setTimeout(r, 9000));
let i = 0;
for (const spec of args.slice(1)) {
  const [id, ms] = spec.split(',');
  await p.evaluate((id) => { const g = window.__game; g.modal = null; g.emitModal();
    const alive = g.combat.enemies.filter((e) => !e.dead); if (alive.length < 3) g.debugSpawn(['wolf', 'wolf', 'wolf'], 1, 1, 330);
    g.debugCast(id); }, id);
  await new Promise((r) => setTimeout(r, Number(ms || 250)));
  const name = `tools/out/${prefix}${i++}.png`; await p.screenshot({ path: name }); console.log('saved', name, id);
  await new Promise((r) => setTimeout(r, 1200));
}
await b.close();
