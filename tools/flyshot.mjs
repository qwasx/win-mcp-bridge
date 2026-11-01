// 遁术/追杀画面连拍：node tools/flyshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'fly';
const b = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[error] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => setInterval(() => { const g = window.__game; if (g.combat) { g.combat.invulnT = 3; g.hero.hp = Math.max(g.hero.hp, 0.8); } }, 100));
const wait = (gs) => p.waitForFunction((t0) => window.__game.time >= t0, { timeout: 120000, polling: 200 }, 0).then(() => p.evaluate(() => window.__game.time)).then((t0) => p.waitForFunction((t) => window.__game.time >= t, { timeout: 180000, polling: 200 }, t0 + gs));
const setup = (realm, flight) => p.evaluate((realm, flight) => {
  const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal();
  const h = g.hero; h.realm = realm; h.stage = 1; h.hp = 1; h.mp = 1; h.equip = flight ? { flight } : {};
  g.teleport(121000, 93500); g.player.flying = true; g.combat.reset(); g.pursuit.reset();
}, realm, flight);
let i = 0;
const shot = async (tag) => { const n = `tools/out/${prefix}${i++}-${tag}.png`; await p.screenshot({ path: n }); console.log('saved', n, await p.evaluate(() => { const g = window.__game; return JSON.stringify({ sp: Math.round(g.speed), alt: +g.alt.toFixed(2), mp: +g.hero.mp.toFixed(2), boost: !!g.player.boosting, z: +g.cam.zoom.toFixed(2) }); })); };
await setup(2, null); await wait(2);
await p.keyboard.down('KeyD'); await wait(2); await shot('cruise');
await p.keyboard.down('ShiftLeft'); await wait(2.5); await shot('light');
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyD');
await setup(3, 'art_xuepifeng'); await p.keyboard.down('KeyD'); await p.keyboard.down('ShiftLeft'); await wait(2.5); await shot('blood');
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyD');
await setup(3, 'art_fenglei'); await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); await wait(2.5); await shot('thunder');
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
// 追杀 HUD
await setup(2, null); await p.evaluate(() => window.__game.debugPursuit(1)); await p.keyboard.down('KeyA'); await wait(1.2); await shot('pursuit-far');
await p.keyboard.up('KeyA'); await wait(2.5); await shot('pursuit-near');
await p.evaluate(() => { const g = window.__game, h = g.hero; if (!h.arts.some((a) => a.id === 'xueyingdun')) h.arts.push({ id: 'xueyingdun', xp: 0 }); g.combat.cast('xueyingdun'); });
await wait(0.25); await shot('xueying');
await wait(3); await shot('after');
await b.close();
