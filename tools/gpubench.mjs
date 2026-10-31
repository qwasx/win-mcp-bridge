// 第三十八步（二）：飞行场景 GPU 基准——在指定位置飞行，每 40 帧切换疾遁（高度→缩放变化），
// 用 gl.finish 包住各段（SwiftShader 下比较相对开销）：地表缓存重画 / 世界层上传 / 整帧合成。
// 用法: LD_LIBRARY_PATH=/tmp/al/lib node tools/gpubench.mjs [x,y] [map=tiannan] [frames=150] [--port=4174] [--w=960 --h=500]
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const pos = args.filter((x) => !x.startsWith('--'));
const [loc = '125158,136603', map = 'tiannan', nF = '150'] = pos;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  headless: true, defaultViewport: { width: Number(flag('w', 960)), height: Number(flag('h', 500)) } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
await p.goto(`http://localhost:${flag('port', '4174')}/?auto=new&map=${map}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer && window.__game.running, { timeout: 180000 });
const out = await p.evaluate(async (loc, nF, mode) => {
  const g = window.__game; g.story.skipAll?.(); g.story.openT = -1; g.modal = null; g.emitModal?.(); g.hero.realm = 2; g.hero.stage = 1;
  const [x, y] = loc.split(',').map(Number);
  g.teleport(x, y); g.player.flying = true;
  g.running = false; cancelAnimationFrame(g.raf);
  const st = g.renderer.stage, gl = st.gl, G = st.ground;
  const acc = {}; const add = (k, v) => { acc[k] = (acc[k] ?? 0) + v; };
  const wrap = (obj, name, key) => { const f = obj[name].bind(obj); obj[name] = (...a) => { gl.finish(); const t = performance.now(); const r = f(...a); gl.finish(); add(key, performance.now() - t); return r; }; };
  wrap(G, 'update', '地表update总(含重画)');   wrap(G, 'drawAbs', '地表缓存重画'); wrap(st, 'upload', '世界层上传');
  if (st.gpuMark) {   // 新版：分段标记 → gl.finish 计时
    let cur = null, t0 = 0;
    st.gpuBegin = () => { cur = null; return true; };
    st.gpuMark = (k) => { gl.finish(); const t = performance.now(); if (cur) add('段·' + cur, t - t0); cur = k; t0 = t; };
    st.gpuEnd = () => { gl.finish(); if (cur) add('段·' + cur, performance.now() - t0); cur = null; };
  }
  const fr = st.frame.bind(st); st.frame = (...a) => { gl.finish(); const t = performance.now(); const r = fr(...a); gl.finish(); add('整帧合成(含上两项)', performance.now() - t); return r; };
  let i = 0;
  const step = (dt) => {
    g.hero.mp = 1e9; g.hero.hp = 1e9;
    const ph = Math.floor(i / 40) % 2;
    g.input.run = mode === 'still' ? false : ph === 1;
    g.destination = mode === 'still' ? null : { x: g.player.x + 3000, y: g.player.y + 600 };
    g.update(dt); g.renderer.render(dt); i++;
  };
  for (let k = 0; k < 20; k++) step(1 / 30);
  for (const k of Object.keys(acc)) delete acc[k];
  const r0 = G.rebuilds; let texels = 0; const zs = [];
  for (let k = 0; k < nF; k++) { step(1 / 30); texels += G.texelsThisFrame ?? 0; if (k % 15 === 0) zs.push(+g.cam.zoom.toFixed(3)); }
  const r = {}; for (const [k, v] of Object.entries(acc)) r[k] = +(v / nF).toFixed(1);
  return { land: g.terrain.isLand(g.player.x, g.player.y), boostZooms: zs.join(' '), rebuilds: G.rebuilds - r0, jobs: G.jobsStarted, kTexelsPerFrame: Math.round(texels / nF / 1000), cache: G.front ? [G.front.W, G.front.H] : null, msPerFrame: r, nsPerTexel: texels ? +((acc['地表缓存重画'] ?? 0) * 1e6 / texels).toFixed(1) : 0 };
}, loc, Number(nF), flag('mode', 'fly'));
console.log(JSON.stringify(out));
await b.close();
