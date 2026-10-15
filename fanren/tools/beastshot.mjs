// 第十五步：妖兽实机截图  node tools/beastshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] ?? 'bst';
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[err] ' + m.text()); });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal(); g.hero.realm = 3; g.hero.stage = 2; g.clock = 0.42 * 240; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LV = { 1: [1, 6], 2: [2, 0], 3: [2, 1], 4: [2, 2], 5: [3, 0], 6: [3, 1], 7: [3, 2], 8: [4, 0], 9: [4, 1] };
const ONLY = process.env.SC?.split(",");
async function scene(name, x, y, zoom, list, extra) {
  if (ONLY && !ONLY.includes(name)) return;
  await p.evaluate((x, y, zoom, list, LV, extra) => {
    const g = window.__game; g.debugFixedDt = 0; g.combat.reset(); g.combat.loot = []; g.teleport(x, y); g.player.x = x; g.player.y = y;
    g.cam.zoom = g.cam.targetZoom = zoom; g.debugCamDX = 0; g.hero.hp = 1; g.hero.mp = 1; g.combat.invulnT = 9999;
    for (const [id, lv, dx, dy] of list) { const [r, s] = LV[lv]; g.debugSpawn([id], r, s, 0); const e = g.combat.enemies[g.combat.enemies.length - 1]; if (!e) continue; e.x = e.hx = x + dx; e.y = e.hy = y + dy; e.speed = 0; e.def = { ...e.def, speed: 0, behave: undefined, hide: false }; e.aggro = false; e.facing = dx > 0 ? -1 : 1; }
    if (extra === 'loot') for (const [lv, dx, dy] of [[3, -560, 260], [6, 540, 240], [9, 600, -60]]) g.combat.loot.push({ x: x + dx, y: y + dy, id: 'mat_yaodan' + lv, n: 1, t: 5 });
    if (extra === 'boss') { for (const e of g.combat.enemies) { e.aggro = true; e.hp = e.maxHp * 0.72; } g.player.flying = true; }
    document.querySelectorAll('.toast, .toasts, [class*="toast"]').forEach((e) => e.style.display = 'none');
  }, x, y, zoom, list, LV, extra ?? '');
  await sleep(9000);
  await p.screenshot({ path: `tools/out/${prefix}_${name}.png` });
  console.log('saved', name, await p.evaluate(() => window.__game.combat.enemies.map((e) => e.name + ':' + e.rankText).join(' | ')));
}
await sleep(5000);
await scene('field', 120000, 93000, 1.05, [['redwolf', 1, -330, -40], ['zhijiao', 1, -200, -150], ['shuangtong', 1, -90, 60], ['xuehou', 5, 260, -110], ['tujia', 7, 330, 90], ['yunchi', 2, 40, -230], ['bishui', 1, -380, 140]], 'loot');
await scene('sea', 169500, 193500, 1.05, [['yingli', 6, -260, -40], ['qianmu', 5, 250, -90], ['wohu', 6, 120, 140], ['tunhai', 1, -150, 150]]);
await scene('lair', 968 * 300 + 300, 404 * 300, 0.85, [['fengxi', 9, -300, -60], ['dujiao', 8, 330, 80]], 'boss');
await scene('cold', 318 * 300 + 600, 62 * 300, 0.95, [['shuanggong', 8, -300, 160], ['bingning', 7, 280, 120], ['hanmei', 5, -40, 230], ['bingjia', 7, 120, 330]]);
if (ONLY && !ONLY.includes("forge")) { await b.close(); process.exit(0); }
// 炼器面板
await p.evaluate(() => { const g = window.__game; g.combat.reset(); for (const [id, n] of [['mat_mojiaozhao', 2], ['mat_chitong', 6], ['mat_yaodan3', 2], ['mat_mojiaoqi', 2], ['mat_xuantie', 6], ['mat_yaodan4', 1], ['mat_tiejing', 10], ['mat_yaodan1', 3]]) g.hero.bag.push({ id, n }); g.teleport(157200, 165600); });
await sleep(4000);
await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('丹器')); bt?.click(); });
await sleep(800);
await p.evaluate(() => { const bt = [...document.querySelectorAll('.alch-tabs button')].find((x) => x.textContent.startsWith('炼器')); bt?.click(); });
await sleep(800);
await p.evaluate(() => { const bt = [...document.querySelectorAll('.recipe')].find((x) => x.textContent.includes('乌龙夺')); bt?.click(); });
await sleep(800);
await p.screenshot({ path: `tools/out/${prefix}_forge.png` });
console.log('saved forge');
await b.close();
