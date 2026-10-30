// 角色近景：镜头拉近，玩家依次转 8 个方向，各截一张中心区域，最后拼成一行
// 用法: node tools/charshot.mjs out.png [zoom=4] [x,y]
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const [out, zs = '4', pos = '151500,180000', act = 'idle'] = process.argv.slice(2);
const Z = Number(zs); const [X, Y] = pos.split(',').map(Number);
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
await p.evaluate((X, Y, Z) => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.teleport(X, Y); g.cam.x = X; g.cam.y = Y;
  const keep = () => { g.cam.zoom = g.cam.targetZoom = Z; requestAnimationFrame(keep); }; keep();
  document.querySelectorAll('.hud, .hint, [class*="Hud"], [class*="hud"]').forEach((e) => e.style.display = 'none'); }, X, Y, Z);
await new Promise((r) => setTimeout(r, 9000));
const files = [];
for (let i = 0; i < 8; i++) {
  await p.evaluate((i, act) => { const g = window.__game; const st = g.player.st; st.yaw = st.targetYaw = i * Math.PI / 4; if (act !== 'idle') st.setAction(act); }, i, act);
  await new Promise((r) => setTimeout(r, 1500));
  const f = `/tmp/cs_${i}.png`; await p.screenshot({ path: f, clip: { x: 640 - 100, y: 20, width: 200, height: 420 } }); files.push(f);
}
await b.close();
execFileSync('convert', [...files, '+append', out]);
console.log('saved', out);
