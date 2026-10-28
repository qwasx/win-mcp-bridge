// 第十六步：换图过场实测 —— 天南传送阵 → 白光水墨过场 → 重新载入 → 乱星海魁星岛自动续档
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] ?? 'tr';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (['warning', 'error'].includes(m.type()) && !/WebGL|GL_|GPU/.test(m.text())) console.log('[' + m.type() + '] ' + m.text().slice(0, 300)); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
await p.evaluate(() => {
  const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal();
  g.hero.realm = 2; g.hero.stage = 2; g.ws.flags.storyDone = 1;
  const l = window.__fanrenLoc('chuansong'); g.teleport(l.x * 300 + 200, l.y * 300);
});
await sleep(4000);
await p.evaluate(() => { const g = window.__game; g.modal = null; g.travel.tryPortal(); });
await sleep(1500);
await p.screenshot({ path: `tools/out/${prefix}_1_skeleton.jpg`, quality: 85 });
// 取令牌 → 补灵石 → 开阵
await p.evaluate(() => {
  const g = window.__game; const o = g.modal.node.options[0]; const nx = o.act(); if (nx) g.openDialog(nx);
  g.closeModal(true); window.__game.hero.bag.push({ id: 'mat_lingshi', n: 1000 }); g.travel.tryPortal();
});
await sleep(1200);
await p.screenshot({ path: `tools/out/${prefix}_2_portal.jpg`, quality: 85 });
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; const o = g.modal.node.options.find((o) => o.label.includes('开启')); o.act(); g.closeModal(true); });
await sleep(700);
await p.screenshot({ path: `tools/out/${prefix}_3_fx_a.jpg`, quality: 85 });
await sleep(800);
await p.screenshot({ path: `tools/out/${prefix}_4_fx_b.jpg`, quality: 85 });
// 重新载入后：应在乱星海
await sleep(1500);
console.log('before', await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('fanren_save_auto')); return JSON.stringify({ map: d.map, p: d.p, arrive: d.arrive, ls: d.hero.bag.filter((b) => b.id === 'mat_lingshi') }); }));
await p.evaluate(() => { delete window.__FANREN_NORELOAD; setTimeout(() => window.__game.switchMap('luanxing'), 50); });
await p.waitForNavigation({ timeout: 60000 }).catch(() => console.log('no navigation'));
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 180000 });
await sleep(5000);
console.log('saved now', await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('fanren_save_auto')); return JSON.stringify({ map: d.map, p: d.p, ls: d.hero.bag.filter((b) => b.id === 'mat_lingshi') }); }));
const r = await p.evaluate(() => { const g = window.__game; return { map: localStorage.getItem('fanren.map'), x: Math.round(g.player.x / 300), y: Math.round(g.player.y / 300), region: g.ui?.region, lingshi: g.hero.bag.filter((b) => b.id === 'mat_lingshi').reduce((a, b) => a + b.n, 0), flying: g.player.flying }; });
console.log('after reload', JSON.stringify(r));
await p.screenshot({ path: `tools/out/${prefix}_5_arrive.jpg`, quality: 85 });
await b.close();
