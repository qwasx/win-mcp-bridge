// 第二十一步：游戏内妖兽贴图截图。用法：node tools/beastshot.mjs <输出名> <x> <y> <id,id,...> [zoom]
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [name = 'bs', xs = '251520', ys = '139200', ids = 'wolf', zs = '1'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), protocolTimeout: 240000,
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.evaluateOnNewDocument(() => { window.__FANREN_NORELOAD = true; });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 120000 });
await p.evaluate((x, y, ids, z) => {
  const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.teleport(x, y);
  g.cam.zoom = z; if (g.cam.targetZoom != null) g.cam.targetZoom = z;
  const list = ids.split(',');
  g.combat.enemies = [];
  const cols = Math.min(4, list.length), sp = 300 / Math.min(1, z), rs = 230 / Math.min(1, z);
  const es = list.map((id, i) => { const c = i % cols, r = Math.floor(i / cols); return g.combat.debugSpawn(id, x + (c - (cols - 1) / 2) * sp + (r % 2 ? 60 : 0), y - 140 / Math.min(1, z) + r * rs); }).filter(Boolean);
  setInterval(() => { g.hero.hp = 1; g.hero.dead = false; g.player.x = x - 40; g.player.y = y + 260; for (const e of es) { e.aggro = false; e.sleep = false; e.x = e.x0 ?? (e.x0 = e.x); e.y = e.y0 ?? (e.y0 = e.y); e.facing = -1; } g.combat.enemies = es.slice(); }, 30);
  window.__es = es;
}, Number(xs), Number(ys), ids, Number(zs));
await new Promise((r) => setTimeout(r, 9000));
await p.screenshot({ path: `tools/out/${name}.png` });
await p.evaluate(() => { for (const e of window.__es) e.anim.hit = 1; });
await new Promise((r) => setTimeout(r, 60));
await p.screenshot({ path: `tools/out/${name}_hit.png` });
console.log('saved', name);
await b.close();
