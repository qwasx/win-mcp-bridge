// 第三十八步：GPU 分段计时（SwiftShader 下用 gl.finish 包住各段，比较相对开销：陆地 vs 海上）
// 用法: LD_LIBRARY_PATH=/tmp/al/lib node tools/gpuprobe.mjs <loc|x,y|sea> [map] [frames=12] [--w= --h=]
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const pos = args.filter((x) => !x.startsWith('--'));
const [loc = 'yuejing', map = 'tiannan', nF = '12'] = pos;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: Number(flag('w', 640)), height: Number(flag('h', 400)) } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto(`http://localhost:${flag('port', '4174')}/?auto=new&map=${map}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer && window.__game.running, { timeout: 180000 });
if (flag('dbg', '')) await p.evaluate(() => { window.__dbg = 1; });
p.on('console', (m) => console.log(m.text().slice(0, 4000)));
const out = await p.evaluate(async (loc, nF, still) => {
  const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal?.(); g.hero.realm = 2; g.hero.stage = 1;
  let x, y; const T = g.terrain;
  if (loc === 'sea') { const l = window.__fanrenLoc('yuejing'); x = l.x * 300; y = l.y * 300;
    outer: for (let r = 2000; r < 80000; r += 1000) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r; let ok = true; for (let k = -3500; k <= 3500 && ok; k += 500) for (let j = -1500; j <= 1500 && ok; j += 500) if (T.isLand(px + k, py + j)) ok = false; if (ok) { x = px; y = py; break outer; } } }
  else if (/^-?\d+,-?\d+$/.test(loc)) [x, y] = loc.split(',').map(Number); else { const l = window.__fanrenLoc(loc); x = l.x * 300; y = l.y * 300 + 1200; }
  g.teleport(x, y); g.cam.zoom = g.cam.targetZoom = 0.8;
  if (!T.isLand(x, y)) g.player.flying = true;
  g.running = false; cancelAnimationFrame(g.raf);   // 手动逐帧
  const st = g.renderer.stage, gl = st.gl, G = st.ground;
  const acc = {}; const add = (k, v) => { acc[k] = (acc[k] ?? 0) + v; };
  const wrap = (obj, name, key) => { const f = obj[name].bind(obj); obj[name] = (...a) => { gl.finish(); const t = performance.now(); const r = f(...a); gl.finish(); add(key, performance.now() - t); return r; }; };
  wrap(G, G.drawAbs ? 'drawAbs' : 'drawStrips', 'GPU·地表缓存重画'); wrap(st, 'upload', 'GPU·画布上传');
  const fr = st.frame.bind(st); st.frame = (...a) => { gl.finish(); const t = performance.now(); const r = fr(...a); gl.finish(); add('GPU·合成整帧(含上两项)', performance.now() - t); return r; };
  const step = (dt) => { g.update(dt); const t = performance.now(); g.renderer.render(dt); add('render总', performance.now() - t); };
  for (let i = 0; i < 30; i++) step(1 / 60);   // 预热（地表缓存首帧整张画）
  for (const k of Object.keys(acc)) delete acc[k];
  let strips = 0, texels = 0;
  const dbg = [];
  for (let i = 0; i < nF; i++) { if (!still) g.destination = { x: x + 3000, y }; step(1 / 60); strips += G.stripsThisFrame; texels += G.texelsThisFrame ?? 0;
    if (window.__dbg) dbg.push([+g.cam.zoom.toFixed(4), +g.cam.targetZoom.toFixed(3), G.front && +G.front.tpw.toFixed(4), G.job ? G.job.strip + '/' + G.job.n : '-', G.stripsThisFrame, Math.round(g.cam.x - (G.front?.cx ?? 0)), G.rebuilds, G.texelsThisFrame]); }
  if (dbg.length) console.log(JSON.stringify(dbg));
  const r = {}; for (const [k, v] of Object.entries(acc)) r[k] = +(v / nF).toFixed(1);
  return { land: T.isLand(g.player.x, g.player.y), stripsPerFrame: +(strips / nF).toFixed(2), texelsPerFrame: Math.round(texels / nF), cacheTexels: G.front ? G.front.W * G.front.H : 0, cache: G.front ? [G.front.W, G.front.H] : null, ms: r, flying: g.player.flying };
}, loc, Number(nF), !!flag('still', ''));
console.log(loc, JSON.stringify(out));
await b.close();
