// v0.48 意境验收：四张截图（晨-镜湖 / 暮-村落炊烟 / 夜-星汉渔火 / 雨-烟雨泽）+ 意境层开关前后帧时间对比
// 用法: LD_LIBRARY_PATH=<nss libs> node tools/moodshot.mjs [outdir=tools/out] [--port=4173] [--w=1280 --h=720]
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const out = args.find((x) => !x.startsWith('--')) || 'tools/out';
mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], headless: true, defaultViewport: { width: Number(flag('w', 1280)), height: Number(flag('h', 720)) } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => { errs.push(e.message); console.log('[pageerror] ' + e.message); });
p.on('console', (m) => { if (m.type() === 'error') { errs.push(m.text()); console.log('[console.error] ' + m.text().slice(0, 300)); } });
await p.goto(`http://127.0.0.1:${flag('port', '4173')}/?auto=new&map=tiannan`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer && window.__game.running, { timeout: 240000 });
await p.evaluate(() => { const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal?.(); window.__home = { x: g.player.x, y: g.player.y }; });
const scen = [
  { name: 'dawn_jinghu', lake: '镜湖', phase: 0.27, weather: 'clear' },
  { name: 'dusk_village', lake: null, phase: 0.735, weather: 'clear' },
  { name: 'night_stars_fishing', lake: '云梦泽', phase: 0.02, weather: 'clear', day: 15 },
  { name: 'rain_yunmeng', lake: '云梦泽', phase: 0.45, weather: 'rain' },
  { name: 'idle_fog_bamboo', lake: '翠竹湖', phase: 0.4, weather: 'fog', idle: true },
];
const only = flag('only', '');
for (const s of scen.filter((x) => !only || x.name.includes(only))) {
  const info = await p.evaluate((s) => {
    const g = window.__game;
    let x = window.__home.x, y = window.__home.y;
    if (s.lake) { const lk = g.scenery.lakes.filter((l) => l.name === s.lake).sort((a, b) => b.r - a.r)[0]; if (!lk) return 'no lake ' + s.lake; x = lk.x; y = lk.y + lk.r * 0.92; for (let d = lk.r * 0.6; d < lk.r * 1.6; d += 40) { if (g.terrain.isLand(lk.x, lk.y + d)) { y = lk.y + d + 60; break; } } }
    g.teleport(x, y); g.player.flying = false;
    g.clock = Math.floor(g.clock / 240) * 240 + s.phase * 240;
    if (s.day != null) g.day = Math.floor(g.day / 30) * 30 + s.day;
    const w = g.weather; w.forced = s.weather; w.kind = s.weather; w.next = s.weather; w.k = 1; w.timer = 999;
    return `ok ${Math.round(x)},${Math.round(y)} phase=${g.dayPhase.toFixed(3)} night=${g.night.toFixed(2)}`;
  }, s);
  console.log(s.name, info);
  await new Promise((r) => setTimeout(r, s.idle ? 18000 : 10000));
  await p.evaluate((s) => { const g = window.__game; g.clock = Math.floor(g.clock / 240) * 240 + s.phase * 240; }, s);
  await new Promise((r) => setTimeout(r, 600));
  await p.screenshot({ path: `${out}/mood_${s.name}.jpg`, type: 'jpeg', quality: 82 });
}
// 帧时间：意境层开 / 关（手动驱动 render，SwiftShader 下只看相对差）
const perf = await p.evaluate(async () => {
  const g = window.__game; g.running = false; cancelAnimationFrame(g.raf);
  const { mood } = window.__moodRef ? window.__moodRef : { mood: null };
  const R = g.renderer;
  const run = (n) => { const t = performance.now(); for (let i = 0; i < n; i++) { g.time += 1 / 60; R.render(1 / 60); } return (performance.now() - t) / n; };
  run(10);
  const on = run(40);
  if (mood) mood.enabled = false;
  const off = run(40);
  if (mood) mood.enabled = true;
  return { on: on.toFixed(2), off: off.toFixed(2), hasMood: !!mood };
});
console.log('frame ms (mood on/off):', JSON.stringify(perf));
console.log('errors:', errs.length);
await b.close();
