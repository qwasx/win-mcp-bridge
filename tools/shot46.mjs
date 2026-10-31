// 第四十六步：无头浏览器截图（tianxiang / 名胜 / 众生）
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const out = args[0], secs = Number(args[1] || 4), pre = args[2] || '', W = 1280, H = 800;
const exe = await chromium.executablePath();
const b = await puppeteer.launch({ executablePath: exe, args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 } });
const p = await b.newPage();
const logs = [];
p.on('console', (m) => { logs.push('[' + m.type() + '] ' + m.text().slice(0, 200)); });
p.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await p.goto('http://localhost:4173/?auto=new&gl=' + (process.env.GL ?? '0'), { waitUntil: 'load', timeout: 120000 });
try { await p.waitForFunction(() => !!(window).__game && (window).__game.renderer, { timeout: Number(process.env.WAIT ?? 120000) }); } catch (e) { console.log('wait failed'); console.log(logs.slice(0, 15).join('\n')); console.log(await p.evaluate(() => document.body.innerText.slice(0, 300))); await p.screenshot({ path: out }); await b.close(); process.exit(0); }
await new Promise((r) => setTimeout(r, 2500));
if (pre) { const r = await p.evaluate(pre); if (r !== undefined) console.log('pre ->', JSON.stringify(r)); }
const seq = process.env.SEQ ? JSON.parse(process.env.SEQ) : [];
for (const it of seq) { await new Promise((r) => setTimeout(r, it.t * 1000)); if (it.js) await p.evaluate(it.js); if (it.out) await p.screenshot({ path: it.out }); console.log('shot', it.out); }
await new Promise((r) => setTimeout(r, secs * 1000));
const info = await p.evaluate(() => { const g = window.__game; return { x: Math.round(g.player.x), y: Math.round(g.player.y), tx: g.tianxiang?.kind, ph: g.tianxiang?.phase, t: g.tianxiang?.t?.toFixed(1), npc: g.npcs?.active?.size, koi: g.scenery?.['koi']?.length, lake: g.scenery?.here?.name, weather: g.weather.kind, fps: g.fps }; });
console.log(JSON.stringify(info));
await p.screenshot({ path: out });
console.log(logs.slice(0, 8).join('\n'));
await b.close();
