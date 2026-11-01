// 敌招连拍：node tools/foeshot.mjs prefix enemy:realm:stage:skill,ms ...
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
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.teleport(251520, 143800); g.cam.targetZoom = g.cam.zoom = 0.75; setInterval(() => { g.hero.hp = g.hero.maxHp ?? 1e6; g.hero.mp = g.hero.maxMp ?? 1e6; }, 100); });
await new Promise((r) => setTimeout(r, 9000));
let i = 0;
for (const spec of args.slice(1)) {
  const [what, ms] = spec.split(',');
  const [id, realm, stage, sk] = what.split(':');
  const info = await p.evaluate((id, realm, stage, sk) => { const g = window.__game; g.modal = null; g.emitModal();
    for (const e of g.combat.enemies) e.dead = true; g.combat.enemies = []; g.combat.foe.reset();
    g.debugSpawn([id], Number(realm), Number(stage), 420);
    const e = g.combat.enemies.find((o) => !o.dead && o.def.id === id); if (!e) return 'no enemy';
    e.aggro = true; const kit = g.combat.foe.constructor && window.__kitOf ? window.__kitOf(e) : null;
    e.skT = 99; // 不让其自行出招
    return e.name + ' realm' + e.realm;
  }, id, realm, stage, sk);
  await new Promise((r) => setTimeout(r, 300));
  const r2 = await p.evaluate((id, sk) => { const g = window.__game, c = g.combat, e = c.enemies.find((o) => !o.dead && o.def.id === id); if (!e) return 'gone';
    c.foe.tick(e, 0, g.player.x, g.player.y, 1); const kit = e.kit || []; const s = kit.find((k) => k.id === sk) ?? kit[Number(sk) || 0];
    if (!s) return 'kit: ' + kit.map((k) => k.id).join(' ');
    e.cast = null; c.foe['start'](e, s, g.player.x, g.player.y); e.skT = 99; return s.name + ' / kit: ' + kit.map((k) => k.id + '(' + k.name + ')').join(' ');
  }, id, sk);
  console.log(spec, info, r2);
  await new Promise((r) => setTimeout(r, Number(ms || 500)));
  console.log(await p.evaluate(() => { const g = window.__game, c = g.combat; return JSON.stringify({ px: g.player.x, py: g.player.y, uc: c.foe.ultCharge(), hz: c.foe.hz.length, cam: [g.cam.x, g.cam.y], hp: g.hero.hp, en: c.enemies.filter(e=>!e.dead).map(e=>[e.def.id, Math.round(e.x), Math.round(e.y), e.cast && e.cast.sk.id]) }); }));
  const name = `tools/out/${prefix}${i++}.png`; await p.screenshot({ path: name }); console.log('saved', name);
}
await b.close();
