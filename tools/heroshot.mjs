// 我方特效连拍：node tools/heroshot.mjs prefix id:lv:t1/t2/... ...（t 为施法后的游戏秒数）
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2), prefix = args[0];
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate((Z, NB) => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = Z; g.cinema = () => {}; if (NB) window.__noBake = true; setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; }, 100); }, Number(process.env.Z || 0.6), !!process.env.NOBAKE);
await new Promise((r) => setTimeout(r, 8000));
let i = 0;
for (const spec of args.slice(1)) {
  const [id, lv, ts] = spec.split(':');
  await p.evaluate((id, lv, HPX, FOES) => { const g = window.__game, c = g.combat; g.modal = null; g.emitModal();
    for (const e of c.enemies) e.dead = true; c.enemies = []; c.acts.reset(); c.swarm = null; c.foe.reset();
    g.debugSpawn(FOES, 1, 3, 380); for (const e of c.enemies) { e.aggro = true; e.skT = 99; e.maxHp *= HPX; e.hp = e.maxHp; }
    g.debugExec(id, Number(lv)); }, id, lv, Number(process.env.HPX || 1), (process.env.FOES || 'wolf,wolf,redwolf,boar,wolf').split(','));
  let now = 0;
  for (const tt of ts.split('/')) {
    const T = Number(tt), pre = Math.max(0, T - 0.35 - now);
    const info = await p.evaluate((pre) => { const g = window.__game; for (let k = 0; k < Math.round(pre / 0.05); k++) { g.update(0.05); g.hero.hp = 1; } const c = g.combat; return JSON.stringify({ acts: c.acts.list.length, swarm: c.swarm && [c.swarm.mode, c.swarm.n], wing: !!c.wing, ghosts: c.ghosts.length, alive: c.enemies.filter(e => !e.dead).length }); }, pre);
    await new Promise((r) => setTimeout(r, 2000));
    now = T;
    const name = `tools/out/${prefix}${i++}.png`; await p.screenshot({ path: name }); console.log(spec, tt, info, name);
  }
}
await b.close();
