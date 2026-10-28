// 敌招自主战斗浸泡测试：node tools/foesoak.mjs prefix id,id,... realm stage seconds
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [prefix, ids, realm, stage, secs] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = 0.7;
  window.__dmg = 0; const c = g.combat, hp0 = c.hitPlayer.bind(c); c.hitPlayer = (...a) => { window.__dmg += a[0]; return hp0(...a); };
  window.__casts = []; const st = c.foe.start.bind(c.foe); c.foe.start = (e, sk, x, y) => { window.__casts.push(e.def.id + ':' + sk.name); return st(e, sk, x, y); };
  setInterval(() => { g.hero.hp = g.hero.maxHp ?? 1e6; g.hero.mp = g.hero.maxMp ?? 1e6; }, 100); });
await new Promise((r) => setTimeout(r, 8000));
await p.evaluate((ids, realm, stage) => { const g = window.__game; g.modal = null; g.emitModal(); g.debugSpawn(ids.split(','), Number(realm), Number(stage), 450); for (const e of g.combat.enemies) e.aggro = true; }, ids, realm, stage);
const N = Number(secs || 20);
for (let i = 0; i < N; i++) {
  console.log(i, await p.evaluate(() => { const g = window.__game; for (let k = 0; k < 20; k++) { g.update(0.05); g.hero.hp = g.hero.maxHp ?? 1e6; g.hero.mp = g.hero.maxMp ?? 1e6; } const c = g.combat; return JSON.stringify([Math.round(g.player.x), Math.round(g.player.y), g.hero.hp, g.modal && g.modal.kind, c.enemies.filter(e => !e.dead).map(e => [e.def.id, Math.round(e.x - g.player.x), Math.round(e.y - g.player.y), e.aggro, e.flee, e.skT.toFixed(1), (e.kit||[]).length])]); }));
  if (i % 5 === 4) { await new Promise((r) => setTimeout(r, 1500)); await p.screenshot({ path: `tools/out/${prefix}${i}.png` }); }
}
console.log(await p.evaluate(() => { const g = window.__game, c = g.combat; return JSON.stringify({ t: g.time, dmg: Math.round(window.__dmg), casts: window.__casts, alive: c.enemies.filter(e => !e.dead).map(e => e.def.id + ' hp' + Math.round(e.hp / e.maxHp * 100) + '% rage' + e.rage), hz: c.foe.hz.length }); }));
await b.close();
