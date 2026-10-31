// 野外动物比例检查：node tools/ambshot.mjs  → tools/out/amb0.png（野兽）、amb1.png（家畜）
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1100, height: 688 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
const sets = [['deer', 'rabbit', 'snowfox', 'monkey', 'egret', 'crane', 'camel', 'yak', 'turtle', 'deer'], ['chicken', 'dog', 'ox', 'sheep', 'horse', 'duck', 'chicken', 'sheep', 'dog'], ['gull']];
let i = 0;
for (const kinds of sets) {
  await p.evaluate((kinds) => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true;
    g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = 1; g.life.debugCritters(kinds, 251520, 143800); }, kinds);
  await new Promise((r) => setTimeout(r, 9000));
  const name = `tools/out/amb${i++}.png`; await p.screenshot({ path: name }); console.log('saved', name);
}
await b.close();
