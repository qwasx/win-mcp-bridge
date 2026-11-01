// 第四十六步：定版截图（意境湖、名胜、众生、突破天象）
import { createRequire } from 'module';
const require = createRequire('/tmp/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const exe = await chromium.executablePath();
const b = await puppeteer.launch({ executablePath: exe, args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
const p = await b.newPage();
const logs = [];
p.on('pageerror', (e) => logs.push('[pageerror] ' + e.message.slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') logs.push('[err] ' + m.text().slice(0, 200)); });
await p.goto('http://localhost:4173/?auto=new&gl=0', { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => !!(window).__game && (window).__game.renderer, { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2000));

// 舞台控制（注入到页面）
const SETUP = `window.S46 = (() => {
  const G = window.__game;
  const cm = () => { for (let i = 0; i < 8 && G.modal; i++) G.closeModal(); if (G.visitQ) G.visitQ = null; };
  const shore = (cx, cy, ang, back) => { const T = G.terrain; let x = cx, y = cy; for (let d = 0; d < 9000; d += 40) { x = cx + Math.cos(ang) * d; y = cy + Math.sin(ang) * d * 0.8; if (T.isLand(x, y) && T.isLand(x + Math.cos(ang) * 70, y + Math.sin(ang) * 56)) break; } return [x + Math.cos(ang) * (back ?? 150), y + Math.sin(ang) * (back ?? 150) * 0.8]; };
  const tp = (x, y, w, z, day) => { cm(); if (G.story) G.story.mind = 0; G.player.x = x; G.player.y = y; G.cam.x = x; G.cam.y = y; G.cam.targetZoom = z ?? 1.2; G.revealAll = true; G.debugSeeAll = true; G.baseSenseRadius = 3400; G.weather.forced = w; G.weather.next = w; G.weather.kind = w; G.weather.k = 1; G.clock = 240 * (day ?? 0.5); G.hero.realm = 3; G.hero.stage = 2; G.updateUI(true); };
  const st = (cx, cy, ang, w, z, day) => { const [x, y] = shore(cx, cy, ang); tp(x, y, w, z, day); return [Math.round(x), Math.round(y)]; };
  return { G, cm, st, tp, shore };
})(); 1`;
await p.evaluate(SETUP);
const shot = async (name, secs = 8) => { await new Promise((r) => setTimeout(r, secs * 1000)); await p.screenshot({ path: '../public/shots/' + name }); console.log('shot', name); };
const info = () => p.evaluate(() => { const G = window.S46.G; return { koi: G.scenery?.koi?.length, lake: G.scenery?.here?.name ?? G.scenery?.lakeAt?.(G.player.x, G.player.y, 3000)?.name, npc: G.npcs?.active?.size, weather: G.weather.kind, mist: G.scenery?.['mist']?.length, fps: Math.round(G.renderer?.fps ?? 0) }; });

// —— 1. 镜湖：雨天，荷花、锦鲤、垂柳、听雨水榭
console.log(await p.evaluate(() => window.S46.st(223500, 158400, 0.35, 'rain', 1.25)));
await shot('s1_jinghu_rain.png', 9); console.log(JSON.stringify(await info()));
// —— 2. 碧落湖：晴，碧水、竹林、茶棚、蜻蜓
await p.evaluate(() => window.S46.st(700 * 300, 275 * 300, 2.3, 'clear', 1.3));
await shot('s3_biluo.png', 10); console.log(JSON.stringify(await info()));
// —— 3. 翠竹湖：雾，竹海
await p.evaluate(() => window.S46.st(128 * 300, 270 * 300, -1.5, 'fog', 1.05));
await shot('s2_zhuhu.png', 9); console.log(JSON.stringify(await info()));
// —— 4. 黑水泽：夜，死水、鬼火、枯木
await p.evaluate(() => window.S46.st(392 * 300, 450 * 300, 1.1, 'fog', 1.15, 0.03));
await shot('s4_heishui_night.png', 9); console.log(JSON.stringify(await info()));
// —— 5. 云梦泽：烟雨、游雾、白鹭、水车
await p.evaluate(() => window.S46.st(585 * 300, 445 * 300, -2.4, 'rain', 1.0));
await shot('s5_yunmeng.png', 10); console.log(JSON.stringify(await info()));
// —— 6. 众生：城镇，市井（练剑、扫地、吃茶、下棋、说书）
await p.evaluate(() => { const G = window.S46.G, S = window.S46; const l = (window).__fanrenLocs().find((x) => x.type === 'town' && x.map === 'tiannan'); S.tp(l.x * 300, l.y * 300 + 400, 'clear', 1.15, 0.4); return l.name; });
await shot('s6_shijing.png', 12); console.log(JSON.stringify(await info()));
// —— 7~10. 突破天象：结婴（风云 → 天雷 → 碎丹 → 元婴出世）
await p.evaluate(() => { const G = window.S46.G, S = window.S46; S.cm(); G.player.x = 223500; G.player.y = 158900; G.cam.x = G.player.x; G.cam.y = G.player.y - 60; G.cam.targetZoom = 0.95; G.revealAll = true; G.debugSeeAll = true; G.baseSenseRadius = 3400; G.weather.forced = 'clear'; G.weather.next = 'clear'; G.clock = 240 * 0.5; G.tianxiang.start('jieying', true, G); G.paused = false; return 1; });
await shot('t1_jieying_storm.png', 10.5); console.log(await p.evaluate(() => String(window.S46.G.tianxiang.kind + ' ' + window.S46.G.tianxiang.phase + ' t=' + window.S46.G.tianxiang.t.toFixed(1))));
await shot('t2_jieying_burst.png', 5.0);
await shot('t3_jieying_birth.png', 5.0);
await shot('t4_jieying_after.png', 8.0);
console.log(await p.evaluate(() => 'after: kind=' + window.S46.G.tianxiang.kind + ' realm=' + window.S46.G.hero.realm + ' lift=' + window.S46.G.player.st.lift));
// —— 11. 结丹（较短）
await p.evaluate(() => { const G = window.S46.G; G.tianxiang.start('jiedan', true, G); return 1; });
await shot('t5_jiedan.png', 11.5);
console.log(await p.evaluate(() => 'jiedan phase=' + window.S46.G.tianxiang.phase + ' t=' + window.S46.G.tianxiang.t.toFixed(1)));
console.log(logs.slice(0, 10).join('\n'));
await b.close();
