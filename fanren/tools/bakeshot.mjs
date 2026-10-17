// 烘焙特效检视：node tools/bakeshot.mjs out-prefix [artId,ms ...]
//  无法术参数：画出 32 格烘焙图样网格；有参数：刷怪、挂异状、依次施法并截图。
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2), prefix = args[0] || 'tools/out/bake';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = 0.8; setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; }, 200); });
await new Promise((r) => setTimeout(r, 9000));
const spawn = () => p.evaluate(() => { const g = window.__game; g.modal = null; g.emitModal();
  const alive = g.combat.enemies.filter((e) => !e.dead);
  if (alive.length < 4) g.debugSpawn(['wolf', 'wolf', 'wolf', 'wolf', 'wolf', 'wolf'], 1, 1, 300);
  const ks = ['freeze', 'burn', 'shock', 'poison', 'root', 'stun', 'slow', 'break'];
  g.combat.enemies.filter((e) => !e.dead).forEach((e, i) => { e.hp = e.maxHp = 1e9; e.skT = 99; e.st[ks[i % ks.length]] = { t: 30, dps: 0 }; });
  g.combat.pst.shock = { t: 30, dps: 0 }; });
const list = args.slice(1);
if (!list.length) { await spawn(); await new Promise((r) => setTimeout(r, 2500)); await p.screenshot({ path: prefix + '.png' }); console.log('saved', prefix + '.png'); }
let i = 0;
for (const spec of list) {
  const [id, ms] = spec.split(',');
  await spawn();
  await p.evaluate((id, ms) => { const g = window.__game; g.debugExec(id, 5); const n = Math.round(Number(ms || 400) / 50); for (let k = 0; k < n; k++) g.update(0.05); g.paused = true; }, id, ms);
  await new Promise((r) => setTimeout(r, 1500));
  const name = `${prefix}${i++}.png`; await p.screenshot({ path: name }); console.log('saved', name, id);
  await p.evaluate(() => { window.__game.paused = false; });
  await new Promise((r) => setTimeout(r, 1500));
}
await b.close();
