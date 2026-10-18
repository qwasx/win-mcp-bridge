// 第三十二步：遁光 / 护体灵光 / 瞬移 连拍：node tools/dunshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] ?? 'dun';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: 1280, height: 800 }, protocolTimeout: 240000 });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { window.__FANREN_NORELOAD = true; const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.revealAll = true; g.debugSeeAll = true; g.cinema = false; g.teleport(251520, 147800); g.hero.realm = 2; g.cam.targetZoom = g.cam.zoom = 0.95; setInterval(() => { g.hero.hp = 1; g.hero.mp = 1; g.combat.invulnT = 5; }, 100); });
await new Promise((r) => setTimeout(r, 8000));
const scen = [
  // 0: 追杀者剑遁拖尾 + 灵光罩
  ['sword', `const P = g.pursuit.cur, e = P.e; e.dunKind = 'sword'; e.x = px + 380; e.y = py - 60; e.dun = 1; e.flyH = 46; e._tr = []; for (let i = 0; i < 26; i++) e._tr.push([e.x + 900 - i * 36, e.y - 46 - 4 + Math.sin(i * 0.3) * 30]); e.trailReset = false;`],
  ['blood', `const P = g.pursuit.cur, e = P.e; e.dunKind = 'blood'; e.x = px + 380; e.y = py - 60; e.dun = 1; e.flyH = 46; e._tr = []; for (let i = 0; i < 26; i++) e._tr.push([e.x + 900 - i * 36, e.y - 50 + Math.sin(i * 0.3) * 30]);`],
  ['thunder', `const P = g.pursuit.cur, e = P.e; e.dunKind = 'thunder'; e.x = px + 380; e.y = py - 60; e.dun = 1; e.flyH = 46; e._tr = []; for (let i = 0; i < 26; i++) e._tr.push([e.x + 900 - i * 36, e.y - 50 + Math.sin(i * 0.3) * 30]); g.combat.fxq.push({ k: 'dunflash', x: px + 900, y: py + 100, x2: e.x, y2: e.y, kind: 'thunder', color: '170,180,255' });`],
  ['shatter', `const P = g.pursuit.cur, e = P.e; e.x = px + 300; e.y = py; e.dun = 0; e.flyH = 0; e._tr = []; g.combat.hitEnemy(e, 1e6, { realm: 5, stCh: 0 }, e.x, e.y);`],
  ['earth', `const P = g.pursuit.cur, e = P.e; e.x = px + 300; e.y = py; g.combat.fxq.push({ k: 'dunflash', x: e.x, y: e.y, x2: e.x, y2: e.y, kind: 'earth', color: '200,170,110' }); g.combat.foe.zone(e, px + 40, py + 20, 170, 'earth', 0.1, 0.8, { k: 'root', dur: 1, ch: 0.9 });`],
];
let i = 0;
for (const [name, code] of scen) {
  const r = await p.evaluate((code) => { const g = window.__game; g.modal = null; g.emitModal();
    if (!g.pursuit.cur) { g.pursuit.cd = 0; g.pursuit.start({ reason: 'shot', gap: 1, force: true }); }
    const px = g.player.x, py = g.player.y; const P = g.pursuit.cur; if (!g.combat.enemies.includes(P.e)) g.combat.enemies.push(P.e);
    P.e.skT = 99; P.blinkCd = 99; P.earthCd = 99; P.longT = 99; P.e.speed = 0;
    if (!P.e.ward) { P.e.ward = { hp: 500, max: 500, col: P.e.wardCol ?? '240,220,140', t: 0 }; }
    new Function('g', 'px', 'py', code)(g, px, py);
    return P.name + ' ' + P.faction.name + ' wings=' + P.wings.length;
  }, code);
  await new Promise((r) => setTimeout(r, 700));
  const f = `tools/out/v/${prefix}_${i++}_${name}.png`; await p.screenshot({ path: f }); console.log(name, r, f);
}
await b.close();
