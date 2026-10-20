// 无头截图：node shoot.mjs t1 t2 ...  → shots/t_<t>.png
import puppeteer from 'puppeteer-core';
import path from 'path';
const times = process.argv.slice(2).map(Number);
const browser = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('file://' + path.resolve('index.html') + '?paused=1&ui=0&q=low', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 120000 }).catch(() => {});
for (const t of times) {
  const t0 = Date.now();
  const ph = await page.evaluate((x) => window.__seek(x), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate((x) => window.__seek(x), t);
  await page.screenshot({ path: `shots/${process.env.P||'t'}_${t.toFixed(2)}.png` });
  console.log(t, ph, Date.now() - t0, 'ms');
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
