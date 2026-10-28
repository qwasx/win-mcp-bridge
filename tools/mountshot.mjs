// 遁具 / 法器盾 / 图标 / 获宝提示 截图：node tools/mountshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [prefix = 'ms'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.teleport(151500, 180600); g.hero.realm = 3; g.hero.stage = 1; g.cam.zoom = g.cam.targetZoom = 1.5; g.clock = 0.42 * 240;
  document.querySelectorAll('.toast, .toasts, [class*="toast"]').forEach((e) => e.style.display = 'none'); });
await new Promise((r) => setTimeout(r, 5000));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, mount, yaw] of [['boat', 'art_shenfeng', 1.3], ['boatL', 'art_shenfeng', -2.0], ['wingF', 'art_fenglei', 0.3], ['wingB', 'art_fenglei', 2.9], ['cloak', 'art_xuepifeng', 2.6]]) {
  await p.evaluate((m, yaw) => { const g = window.__game; g.combat.reset(); g.hero.equip = { ...(g.hero.equip || {}), flight: m }; g.player.flying = true; g.player.x = 151500; g.player.y = 180600; g.player.st.yaw = yaw; g.player.st.targetYaw = yaw; g.debugCamDX = 0; }, mount, yaw);
  await wait(4000);
  await p.evaluate((yaw) => { const g = window.__game; g.player.st.yaw = yaw; }, yaw);
  await p.screenshot({ path: `tools/out/${prefix}_${name}.png`, clip: { x: 440, y: 180, width: 400, height: 380 } });
  console.log('saved', name);
}
// 法器盾 + 快捷栏图标 + 踏云靴
await p.evaluate(() => { const g = window.__game; g.player.flying = false; g.hero.equip = {}; for (const id of ['art_xuantie', 'art_jinguangzhuan', 'tal_tianleizi', 'art_tayun']) g.hero.bag.push({ id, n: 3 });
  g.hero.hotbar[5] = 'art:art_jinguangzhuan'; g.hero.hotbar[6] = 'tal:tal_tianleizi'; g.hero.hotbar[7] = 'art:art_xuantie';
  g.combat.castArtifact('art_xuantie'); g.combat.castArtifact('art_tayun'); g.debugSpawn(['wolf', 'wolf'], 2, 5, 260); });
await wait(5000);
await p.evaluate(() => { const g = window.__game; g.combat.blockT = 1; g.combat.blockDir = 0; });
await wait(300);
await p.screenshot({ path: `tools/out/${prefix}_shield.png` });
console.log('saved shield', await p.evaluate(() => JSON.stringify({ sh: window.__game.combat.shield, eq: window.__game.hero.equip })));
await p.evaluate(() => { window.__game.combat.reset(); window.__game.debugGive('art_qingzhu'); });
await wait(1600);
await p.screenshot({ path: `tools/out/${prefix}_gain.png` });
console.log('saved gain');
await b.close();
