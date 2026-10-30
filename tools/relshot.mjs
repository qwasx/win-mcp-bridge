// 第二十九步：人情世故截图（市井日常 / 名牌档位 / 人脉录 / 对峙 / 求饶）
// 用法: LD_LIBRARY_PATH=/tmp/al/lib node tools/relshot.mjs prefix
import { createRequire } from 'module';
const require = createRequire('/home/user/chr/package.json');
const chromium = require('@sparticuz/chromium').default ?? require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const prefix = process.argv[2] || 'rel';
const b = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'],
  headless: true, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
});
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror] ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[error] ' + m.text()); });
await p.evaluateOnNewDocument(() => { window.__FANREN_NORELOAD = true; });
await p.goto('http://localhost:4173/?auto=new', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.__game && window.__game.renderer, { timeout: 90000 });
const shot = async (n) => { await new Promise((r) => setTimeout(r, 2500)); await p.screenshot({ path: `tools/out/${prefix}${n}.png` }); console.log('shot', n); };
await p.evaluate(() => { const g = window.__game; g.story.skipAll(); g.story.openT = -1; g.modal = null; g.emitModal(); g.cinema = null; g.revealAll = true; g.debugSeeAll = true; g.hero.realm = 2; g.hero.stage = 3; });
// 1) 嘉元城街头：摆摊 / 闲聊 / 钓鱼 + 名牌档位
const info = await p.evaluate(() => {
  const g = window.__game, N = g.npcs, l = [...N.list].find((d) => d.id === 'o_leijiu');
  const x = l.x, y = l.y;
  g.teleport(x, y + 120); g.cam.x = x; g.cam.y = y; g.cam.zoom = g.cam.targetZoom = 1.25;
  for (let i = 0; i < 20; i++) g.update(0.05);
  const acts = [...N.active.values()].filter((a) => !a.enemy && a.d.alive && a.act !== 'follow').sort((a, b) => Math.hypot(a.st.x - x, a.st.y - y) - Math.hypot(b.st.x - x, b.st.y - y)).slice(0, 8);
  const pos = [[-260, -40], [260, -30], [-120, 200], [40, 200], [380, 170], [-420, 160], [140, -170], [-30, -200]];
  acts.forEach((a, i) => { a.st.x = a.d.x = x + pos[i][0]; a.st.y = a.d.y = y + pos[i][1]; a.d.tx = a.st.x; a.d.ty = a.st.y; a.path = undefined; });
  const [s1, s2, c1, c2, f1, h1, w1, w2] = acts;
  if (s1) { s1.life = { k: 'stall', dir: 1.57, ware: 0 }; s1.act = 'sit'; s1.wait = 99; s1.bubble = { text: '上好的丹药，童叟无欺！', t: 99 }; }
  if (s2) { s2.life = { k: 'stall', dir: 1.57, ware: 1 }; s2.act = 'sit'; s2.wait = 99; }
  if (c1 && c2) { c1.life = { k: 'chat', dir: 0, with: c2, lines: ['你认得韩立么？', '听说过，怎么？'], li: 0, lt: 0 }; c2.life = { k: 'chat', dir: 0, with: c1 }; c1.act = c2.act = 'idle'; c1.wait = c2.wait = 99; c1.bubble = { text: '你认得韩立么？', t: 99 }; c1.st.faceToward(1, 0); c2.st.faceToward(-1, 0); }
  if (f1) { f1.life = { k: 'fish', dir: 0.4 }; f1.act = 'sit'; f1.wait = 99; }
  if (h1) { h1.d.grudge = 2; h1.d.why = '你杀了他的兄长'; h1.d.met = true; h1.wait = 99; }
  if (w1) { w1.d.bond = 'sworn'; w1.d.met = true; w1.d.favor = 90; w1.wait = 99; }
  if (w2) { w2.d.met = true; w2.d.favor = 65; w2.wait = 99; }
  g.paused = false;
  return acts.map((a) => a.d.name + ':' + (a.life?.k ?? '') + ':' + g.rel.tier(a.d));
});
console.log(info);
await shot(0);
// 2) 人脉录
await p.evaluate(() => {
  const g = window.__game, R = g.rel, N = g.npcs;
  const v = N.list.find((d) => d.alive && !d.canon && d.realm > 0 && d.ties?.some((t) => t.k === 'kin'));
  R.onPlayerKill(v, false); N.die(v, '死于韩立之手');
  for (const d of N.list.filter((d) => d.grudge >= 2).slice(0, 1)) { d.hunting = true; d.huntStart = g.day; }
  R.addSect('qingxu', -50); R.addSect('huangfeng', 35); R.addSect('guiling', -70);
  R.postBounty('guiling', '鬼灵门', 1800, '残害鬼灵门门人');
  for (const id of ['o_mengtieyi', 'o_huiming', 'o_liusanniang', 'lihuayuan']) { const d = N.byId.get(id); d.met = true; d.favor = 40 + Math.random() * 40; }
  N.byId.get('o_baixiao').met = true; N.byId.get('o_baixiao').favor = -30;
  g.paused = true; g.openModal({ kind: 'relations' });
});
await shot(1);
await p.evaluate(() => { const g = window.__game; const btn = [...document.querySelectorAll('.rel-tab')][0]; btn.click(); });
await shot(2);
await p.evaluate(() => { const g = window.__game; const btn = [...document.querySelectorAll('.rel-tab')][2]; btn.click(); });
await shot(3);
// 3) 对峙
await p.evaluate(() => {
  const g = window.__game; g.closeModal(true);
  const d = g.npcs.list.find((d) => d.grudge >= 2 && d.alive);
  g.openDialog(g.rel.parleyNode(d, g.npcs.look(d), () => {}, () => {}));
});
await shot(4);
await b.close();
