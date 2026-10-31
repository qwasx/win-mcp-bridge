// 第三十八步：中期节奏——出关访客（轮流且必有一位）、机缘录内容、晋升提醒、指路
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain);
const l = LOCATIONS.find((q) => q.id === 'huangfeng') ?? LOCATIONS.find((q) => q.type === 'sect')!;
g.teleport(l.x * WORLD_SCALE + 900, l.y * WORLD_SCALE + 600);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); g.paused = false;
let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const toasts: string[] = []; const t0 = g.toast.bind(g); g.toast = (s: string, k: any) => { toasts.push(s); t0(s, k); };
console.log('sect', g.ws.sect?.id, 'rank', g.ws.sect?.rank, 'realm', g.hero.realm, g.hero.stage);
// 出关访客
const who: string[] = [];
for (let i = 0; i < 6; i++) {
  g.modal = null; g.hero.dead = false;
  const r = g.seclude(60);
  const line = r.msgs.find((m: any) => m.text.startsWith('出关时'));
  ok(!!line, `第${i + 1}次闭关 ${r.days} 日：出关有访客 —— ${line?.text ?? '（无）'}`);
  g.modal = null; g.update(0.016);
  const m = g.modal;
  ok(m && m.kind === 'dialog', '访客对话框弹出：' + (m?.node?.speaker ?? m?.kind));
  if (m?.node) { who.push(m.node.speaker); console.log('   ', m.node.text.replace(/\n+/g, ' / ').slice(0, 150)); }
  g.modal = null;
}
ok(new Set(who).size >= 2, '访客轮流出现（不止一种）：' + [...new Set(who)].join('、'));
ok(g.seclude(10).msgs.every((m: any) => !m.text.startsWith('出关时')), '闭关不足 30 日不强制访客');
g.modal = null; g.update(0.016); g.modal = null;
// 宗门传讯
console.log('sect loc', l.id, l.type);
g.ws.sect = { id: l.id, rank: 0, contrib: 0, joined: g.day, lastPay: g.day - 95, tasks: [], done: 0 };
g.ws.flags.visitN = 4; g.modal = null;
{ const r = g.seclude(60); g.modal = null; g.update(0.016); const m = g.modal;
  ok(m?.node?.speaker === '传讯纸鹤', '入宗后轮到宗门传讯：' + (m?.node?.speaker ?? '无'));
  if (m?.node) console.log('   ', m.node.text.replace(/\n+/g, ' / '));
  ok(g.ws.sect.contrib > 0 && g.ws.sect.tasks.length > 0, `闭关记贡献 ${g.ws.sect.contrib}，任务 ${g.ws.sect.tasks.length} 条`); g.modal = null; }
// 机缘录
const ch = g.chances();
console.log(ch.map((c: any) => `  [${c.t}] ${c.d}${c.x !== undefined ? ' (可指路)' : ''}`).join('\n'));
ok(ch.length >= 2, '机缘录至少两条：' + ch.length);
ok(!g.ws.sect || ch.some((c: any) => c.t.includes(g.ws.sect && (LOCATIONS.find((q) => q.id === g.ws.sect.id)?.name ?? '宗门'))), '机缘录含宗门进度');
// 晋升提醒
if (g.ws.sect) {
  g.ws.sect.contrib = 99999; g.hero.realm = Math.max(g.hero.realm, 3);
  toasts.length = 0; for (let i = 0; i < 300; i++) g.update(0.05);
  const n1 = toasts.filter((s) => s.includes('够格晋升')).length;
  for (let i = 0; i < 300; i++) g.update(0.05);
  const n2 = toasts.filter((s) => s.includes('够格晋升')).length;
  ok(n1 === 1 && n2 === 1, `够格晋升提醒一次且不重复 (${n1}, ${n2})`);
  ok(g.chances().some((c: any) => c.hot && c.d.includes('可回山门晋升')), '机缘录高亮「可晋升」');
}
// 指路
const p = g.player; g.setGuide(p.x + 3000, p.y, '测试点');
ok(g.mapMarks().some((m: any) => m.glyph === '指'), '指路后地图出现「指」字');
g.teleport(p.x + 3000 - 100, p.y); for (let i = 0; i < 60; i++) g.update(0.05);
ok(!g.guide, '走近后指路标记自动消失');
// 散修报信 → 异宝真的出世
const f = g.ws.flags; f.herald = undefined; f.heraldNext = g.day + 1e6;
f.visitN = 1; // 下一次轮到「散修报信」
let gotHerald = false;
for (let k = 0; k < 3 && !gotHerald; k++) {
  g.modal = null; g.seclude(60); g.modal = null; g.update(0.016); g.modal = null;
  const p2 = g.player; g.teleport(p2.x + 1500 + k * 500, p2.y + 900);
  g.day += 3; for (let i = 0; i < 40; i++) g.update(0.05);
  gotHerald = !!(f.herald && !f.herald.done);
}
ok(gotHerald, '散修报信后异宝确实出世：' + (f.herald ? JSON.stringify({ x: Math.round(f.herald.x), y: Math.round(f.herald.y) }) : '无'));
console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
process.exit(fails ? 1 : 0);
