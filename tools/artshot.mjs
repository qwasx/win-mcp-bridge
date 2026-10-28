// 法器出手连拍：node tools/artshot.mjs prefix art_id[,art_id...] [frames=6,14,24,36]
// 固定步长 1/60，在指定帧号截图，横向拼接成一张
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [prefix, idsArg, framesArg = '6,14,24,36', enemiesArg = 'wolf,boar,wolf,snake'] = process.argv.slice(2);
const frames = framesArg.split(',').map(Number);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[err] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate((Z) => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.teleport(151500, 180600); g.hero.realm = 3; g.hero.stage = 2; g.revealAll = true; g.debugSeeAll = true; g.cam.zoom = g.cam.targetZoom = Z; g.clock = 0.42 * 240;
  document.querySelectorAll('.toast, .toasts, [class*="toast"]').forEach((e) => e.style.display = 'none'); window.__Z = Z; }, Number(process.env.Z || 1.1));
await new Promise((r) => setTimeout(r, 6000));
for (const id of idsArg.split(',')) {
  await p.evaluate((id, en) => { const g = window.__game; g.debugFixedDt = 0; g.combat.reset(); g.player.x = 151500; g.player.y = 180600; g.debugCamDX = 140; g.cam.x = g.player.x + 140; g.cam.y = g.player.y - 50; g.cam.zoom = g.cam.targetZoom = Number(window.__Z);
    g.debugSpawn(en.split(','), 2, 5, 300); for (const e of g.combat.enemies) { e.hp = e.maxHp = e.maxHp * 50; e.speed = 0; e.aggro = false; }
    if (!g.hero.bag.some((x) => x.id === id)) g.hero.bag.push({ id, n: 1 }); }, id, enemiesArg);
  await new Promise((r) => setTimeout(r, 1500));
  const f0 = await p.evaluate((id) => { const g = window.__game; g.hero.realm = 3; g.hero.stage = 1; g.debugFixedDt = 1 / 60; g.hero.mp = 1; g.combat.lock = g.combat.enemies[0]; if (id.startsWith('tal_')) g.combat.castTalisman(id); else g.combat.castArtifact(id); return g.time; }, id);
  const files = [];
  for (const fr of frames) {
    await p.waitForFunction((t) => { const g = window.__game; if (g.time >= t - 1 / 120) { g.debugFixedDt = 1e-6; return true; } if (g.time + 1 / 60 > t) g.debugFixedDt = Math.max(1e-6, t - g.time); return false; }, { timeout: 120000, polling: 'raf' }, f0 + fr / 60);
    console.log(fr, await p.evaluate(() => { const g = window.__game; g.debugFixedDt = 1e-6; const a = g.combat.acts.list[0]; return JSON.stringify({ f: g.frameNo, n: g.combat.acts.list.length, t: a && a.t, hs: g.hitStop, time: g.time }); }));
    const f = `/tmp/as_${fr}.png`; await p.screenshot({ path: f, clip: { x: 260, y: 150, width: 760, height: 440 } }); files.push(f);
    await p.evaluate(() => { window.__game.debugFixedDt = 1 / 60; });
  }
  const out = `tools/out/${prefix}_${id}.png`;
  execFileSync('convert', [...files, '-resize', process.env.RS || '60%', '+append', out]);
  console.log('saved', out);
}
await b.close();
