// shoot.mjs — 离屏渲染截图：node test/shoot.mjs [t1 t2 ...]（默认关键帧）
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(8077, '127.0.0.1', r));

const outDir = process.env.SHOT_DIR || '/tmp/shots';
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  args: [...chromium.args, '--enable-unsafe-swiftshader'],
  executablePath: await chromium.executablePath(),
  headless: true,
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 500)));
await page.goto('http://127.0.0.1:8077/index.html', { waitUntil: 'load' });
await page.waitForFunction('window.__testStep', { timeout: 30000, polling: 100 });

const targets = process.argv.slice(2).map(Number);
const list = targets.length ? targets : [0.4, 2.0, 4.6, 6.6, 9.6, 12.6, 14.8];
for (const t of list) {
  const steps = Math.round(t * 60);
  const simT = await page.evaluate((n) => window.__testStep(n), steps);
  const name = `${outDir}/frame-${String(t).replace('.', '_')}.png`;
  await page.screenshot({ path: name });
  console.log(`shot t=${simT.toFixed(2)} → ${name}`);
}
await browser.close();
server.close();
process.exit(0);
