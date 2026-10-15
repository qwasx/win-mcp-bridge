// 第十六步：三图测试 —— 确定性生成 / 可达性 / 传送阵往返 / 边境往返 / 存档 v3 与旧档迁移 / 大事件与妖王所在图
// 用法：npx tsx tools/test-maps.ts        （总控：依次以不同 FANREN_MAP 启动子进程，共享一个文件版 localStorage）
import { execFileSync } from 'child_process';
import fs from 'fs';

const PHASE = process.env.TM_PHASE;
if (!PHASE) {
  const store = '/tmp/fanren-test-maps.json';
  fs.writeFileSync(store, '{}');
  const run: [string, string][] = [
    ['gen', 'tiannan'], ['gen', 'luanxing'], ['gen', 'dajin'],
    ['portal_out', 'tiannan'], ['portal_in', 'luanxing'], ['portal_back', 'tiannan'],
    ['edge_out', 'tiannan'], ['edge_in', 'dajin'], ['edge_back', 'tiannan'],
    ['legacy_a', 'tiannan'], ['legacy_b', 'luanxing'],
  ];
  let bad = 0;
  for (const [ph, map] of run) {
    console.log(`\n── ${ph} @ ${map}`);
    try {
      const out = execFileSync('npx', ['tsx', 'tools/test-maps.ts'], { env: { ...process.env, TM_PHASE: ph, FANREN_MAP: map, TM_STORE: store }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 });
      process.stdout.write(out.split('\n').filter((l) => /^(ok|FAIL|  )/.test(l)).join('\n') + '\n');
    } catch (e: any) { bad++; process.stdout.write(String(e.stdout ?? '').split('\n').filter((l: string) => /^(ok|FAIL|  )/.test(l)).join('\n') + '\n' + String(e.stderr ?? '').slice(-600) + '\n'); }
  }
  console.log(bad ? `\n${bad} 个阶段失败` : '\n全部通过');
  process.exit(bad ? 1 : 0);
}

// ------------------------------------------------------------ 子进程
const STORE = process.env.TM_STORE!;
const mem: Record<string, string> = JSON.parse(fs.readFileSync(STORE, 'utf8'));
const flush = () => fs.writeFileSync(STORE, JSON.stringify(mem));
const ls = { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; } };
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = ls; (globalThis as any).sessionStorage = ls;
(globalThis as any).__FANREN_NORELOAD = true;
await import('./env');
const W = await import('../src/data/world') as any;
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const C = await import('../src/world/cultivation') as any;
const EN = await import('../src/data/enemies') as any;

const { ACTIVE_MAP, WORLD_SCALE: S, LOC_BY_ID, LOCATIONS } = W;
let fails = 0;
const check = (n: string, ok: boolean, x = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + n + (x ? '  ' + x : '')); if (!ok) fails++; };
const done = () => { flush(); process.exit(fails ? 1 : 0); };
const t0 = Date.now();
const terrain = new Terrain(); terrain.build();
const tBuild = Date.now() - t0;
const g: any = new Game(terrain);
const lingshi = () => C.bagCount(g.hero, 'mat_lingshi');
const auto = () => JSON.parse(mem.fanren_save_auto ?? 'null');
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const pick = (label: string) => { const o = g.modal?.node?.options?.find((o: any) => o.label.includes(label)); if (!o) return false; if (o.disabled) return 'disabled'; const nx = o.act(); if (nx) g.openDialog(nx); else g.closeModal(true); return true; };

if (PHASE === 'gen') {
  // 1. 确定性：同一张图建两次，陆地栅格逐格相同
  const t2 = new Terrain(); t2.build();
  let diff = 0; for (let i = 0; i < terrain.land.length; i++) if (Math.abs(terrain.land[i] - t2.land[i]) > 1e-6) diff++;
  check(`${W.MAP_NAME[ACTIVE_MAP]}：两次生成完全一致`, diff === 0, `${terrain.W}×${terrain.H} 生成 ${tBuild} ms`);
  const sz = W.mapSize(ACTIVE_MAP);
  check('图幅符合规格', terrain.W === sz.W && terrain.H === sz.H, `${sz.W}×${sz.H}`);
  // 2. 地点全在陆地、全在本图
  const wet = LOCATIONS.filter((l: any) => !terrain.isLand(l.x * S, l.y * S));
  check('所有地点都在陆地上', wet.length === 0, `${LOCATIONS.length} 处` + (wet.length ? ' 落水：' + wet.slice(0, 5).map((l: any) => l.name).join('、') : ''));
  check('地点都属于本图', LOCATIONS.every((l: any) => l.map === ACTIVE_MAP));
  // 3. 可达性：从主城出发，步行（宏观格 BFS）能到多少地点；乱星海靠飞行
  if (ACTIVE_MAP !== 'luanxing') {
    const { W: MW, H: MH } = terrain; const seen = new Uint8Array(MW * MH);
    const ok = (x: number, y: number) => terrain.walkFactor((x + 0.5) * S, (y + 0.5) * S) > 0;
    const start = LOC_BY_ID.get(ACTIVE_MAP === 'tiannan' ? 'huangfeng' : 'jinjing');
    const q: number[] = []; const sx = Math.round(start.x), sy = Math.round(start.y);
    seen[sy * MW + sx] = 1; q.push(sy * MW + sx);
    while (q.length) { const i = q.pop()!; const x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (seen[j] || !ok(nx, ny)) continue; seen[j] = 1; q.push(j); } }
    const reach = (l: any) => { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.round(l.x) + dx, y = Math.round(l.y) + dy; if (x >= 0 && y >= 0 && x < MW && y < MH && seen[y * MW + x]) return true; } return false; };
    const main = LOCATIONS.filter((l: any) => !l.island && ['city', 'sect', 'town', 'market'].includes(l.type));
    const miss = main.filter((l: any) => !reach(l));
    check('步行可达所有城镇宗门', miss.length === 0, `${main.length - miss.length}/${main.length}` + (miss.length ? ' 不可达：' + miss.slice(0, 6).map((l: any) => l.name).join('、') : ''));
  } else {
    const isles = LOCATIONS.filter((l: any) => l.island).length;
    check('乱星海以海岛为主（飞行往来）', isles / LOCATIONS.length > 0.5, `${isles}/${LOCATIONS.length} 处在岛上`);
  }
  // 4. 妖王与大事件归属
  const lairs = EN.LAIRS.filter((l: any) => W.legacyHere(l.x, l.y)).map((l: any) => l.id).sort().join(',');
  const want: any = { tiannan: (x: string) => !/fengxi|dujiao|shuanggong/.test(x), luanxing: (x: string) => x.includes('lair_fengxi') && x.includes('lair_dujiao'), dajin: (x: string) => x.includes('lair_shuanggong') };
  check('妖王巢穴在正确的图', want[ACTIVE_MAP](lairs), lairs || '（无）');
  const { CANON_EVENTS } = await import('../src/world/events') as any;
  const xt = CANON_EVENTS.find((e: any) => e.id === 'xutian');
  const here = W.locHere(xt.loc);
  check(ACTIVE_MAP === 'luanxing' ? '虚天殿在乱星海' : '虚天殿不在本图', ACTIVE_MAP === 'luanxing' ? !!here : !here);
  g.reset(); g.hero.realm = 3; g.hero.stage = 1; g.ws.flags.storyDone = 1;
  const s0 = (xt.year - 1) * 360 + (xt.month - 1) * 30;
  g.day = s0 - 400; g.update(0.03); g.day = s0 + 2; g.update(0.03);
  const st = g.ws.events.xutian ?? g.ws.events['xutian#0'];
  check('第二十年虚天殿开启（全图皆有传闻）', st?.state === 'active', st?.state);
  if (here) { g.teleport(here.x * S, here.y * S + 300); g.modal = null; for (let i = 0; i < 12 && g.modal?.node?.speaker !== xt.name; i++) g.update(1 / 30); check('赶到虚天殿 → 触发事件', g.modal?.node?.speaker === xt.name, g.modal?.node?.speaker ?? 'none'); }
  // 5. 每图一个 NPC 社会：只有本图 NPC 处于活跃状态
  const home = LOC_BY_ID.get(ACTIVE_MAP === 'tiannan' ? 'huangfeng' : ACTIVE_MAP === 'luanxing' ? 'tianxing' : 'jinjing');
  g.reset(); g.ws.flags.storyDone = 1; g.modal = null; g.teleport(home.x * S, home.y * S + 400);
  for (let i = 0; i < 30; i++) { g.modal = null; g.update(1 / 30); }
  const act = [...g.npcs.active.keys()].map((id: string) => g.npcs.byId.get(id)).filter(Boolean);
  check('活跃 NPC 全是本图居民', act.length > 0 && act.every((d: any) => (d.map ?? 'tiannan') === ACTIVE_MAP), `活跃 ${act.length} / 总 ${g.npcs.list.length}`);
  done();
}

if (PHASE === 'portal_out') {
  for (const k of Object.keys(mem)) delete mem[k];
  g.reset(); g.ws.flags.storyDone = 1; g.modal = null;
  const cs = LOC_BY_ID.get('chuansong'), lx = LOC_BY_ID.get('chuansong_lx');
  g.teleport(cs.x * S + 200, cs.y * S);
  g.hero.realm = 1; g.hero.stage = 9;
  check('传送阵附近可交互', g.travel.tryPortal());
  check('炼气期无法催动', /需筑基期/.test(g.modal?.node?.text ?? '')); g.closeModal(true);
  g.hero.realm = 2; g.hero.stage = 2;
  g.travel.tryPortal();
  check('枯骨手中取得大挪移令', pick('取下令牌') === true && C.bagCount(g.hero, 'tok_danuoyi') === 1);
  C.removeItem(g.hero, 'mat_lingshi', lingshi());
  check('灵石不足时无法开启', pick('开启传送阵') === 'disabled');
  C.addItem(g.hero, 'mat_lingshi', 1000);
  g.closeModal(true); g.travel.tryPortal();
  const day0 = g.day;
  check('开启传送阵（600 灵石）', pick('开启传送阵') === true && lingshi() === 400, `余 ${lingshi()}`);
  const sv = auto();
  check('存档 v3 记下目标图与落点', sv?.v === 3 && sv.map === 'luanxing' && sv.arrive === 'portal' && near(sv.p.x, lx.x * S, 1) && near(sv.p.y, lx.y * S, 1));
  check('传送不耗时日', g.day === day0);
  check('换图标记：fanren.map = luanxing，并自动续档', mem['fanren.map'] === 'luanxing' && mem['fanren.resume'] === 'fanren_save_auto');
  check('本图迷雾已存入 fogs.tiannan', typeof sv?.fogs?.tiannan === 'string' && sv.fogs.tiannan.length > 10);
  done();
}

if (PHASE === 'portal_in') {
  const lx = LOC_BY_ID.get('chuansong_lx');
  check('乱星海读档成功', g.load('fanren_save_auto') === true);
  const d = Math.hypot(g.player.x - lx.x * S, g.player.y - lx.y * S);
  check('落在魁星岛传送阵旁（陆地，非飞行）', d < 40 * S && terrain.isLand(g.player.x, g.player.y) && !g.player.flying, `距 ${(d / S).toFixed(1)} 格`);
  check('物品带过来了', lingshi() === 400 && C.bagCount(g.hero, 'tok_danuoyi') === 1);
  check('天南迷雾仍保留在存档里', typeof g.fogs.tiannan === 'string');
  g.ws.flags.storyDone = 1; g.modal = null;
  for (let i = 0; i < 20; i++) { g.modal = null; g.update(1 / 30); }
  check('乱星海可正常运行', !g.hero.dead);
  g.teleport(lx.x * S + 200, lx.y * S); g.modal = null;
  C.addItem(g.hero, 'mat_lingshi', 500);
  g.travel.tryPortal();
  check('回程：再开传送阵', pick('开启传送阵') === true && lingshi() === 300);
  check('回程存档目标为天南', auto()?.map === 'tiannan' && mem['fanren.map'] === 'tiannan');
  check('乱星海迷雾写入 fogs.luanxing', typeof auto()?.fogs?.luanxing === 'string');
  done();
}

if (PHASE === 'portal_back') {
  const cs = LOC_BY_ID.get('chuansong');
  check('回到天南读档成功', g.load('fanren_save_auto') === true);
  check('落在越国灵石矿洞传送阵旁', Math.hypot(g.player.x - cs.x * S, g.player.y - cs.y * S) < 40 * S && terrain.isLand(g.player.x, g.player.y));
  check('往返后灵石 300、令牌仍在', lingshi() === 300 && C.bagCount(g.hero, 'tok_danuoyi') === 1);
  check('两图迷雾都在', !!g.fogs.tiannan && !!g.fogs.luanxing);
  done();
}

if (PHASE === 'edge_out') {
  g.reset(); g.ws.flags.storyDone = 1; g.modal = null;
  g.hero.realm = 2; g.hero.stage = 1;
  const mu = LOC_BY_ID.get('mulan');
  g.teleport(mu.x * S, 250); g.modal = null;
  g.player.moving = true; (g.travel as any).dir = { x: 0, y: -1 };
  for (let i = 0; i < 40 && !g.modal; i++) { g.player.moving = true; (g.travel as any).dir = { x: 0, y: -1 }; g.travel.update(1 / 30); }
  check('走到天南北缘 → 弹出北上大晋的提示', /大晋/.test(g.modal?.node?.title ?? ''), g.modal?.node?.title ?? 'none');
  check('修为不足时警告', /修为/.test(g.modal?.node?.text ?? ''));
  const day0 = g.day, age0 = g.hero.age;
  pick('启程');
  const sv = auto(), S2 = W.mapSize('dajin');
  check('横穿草原约 120 日', g.day - day0 === 120 && g.hero.age > age0, `+${g.day - day0} 日`);
  check('落在大晋南缘', sv?.map === 'dajin' && sv.arrive === 'edge' && near(sv.p.y / S, S2.H - 5, 0.5));
  // 东西海岸没有出口
  g.modal = null; (g.travel as any).edgeT = 0; g.travel.pending = null; g.teleport(250, 300 * S); (g.travel as any).dir = { x: -1, y: 0 };
  let toast = ''; const ot = g.toast.bind(g); g.toast = (t: string, k: any) => { toast = t; ot(t, k); };
  for (let i = 0; i < 40; i++) { g.player.moving = true; (g.travel as any).dir = { x: -1, y: 0 }; g.travel.update(1 / 30); }
  check('西缘没有出口：只提示，不弹窗', !g.modal && toast.length > 0, toast.slice(0, 24));
  done();
}

if (PHASE === 'edge_in') {
  check('大晋读档成功', g.load('fanren_save_auto') === true);
  check('落在陆地上', terrain.isLand(g.player.x, g.player.y) && !g.player.flying);
  check('大晋危险度高', g.combat.dangerAt(g.player.x, g.player.y - 60 * S).d >= 2, String(g.combat.dangerAt(g.player.x, g.player.y - 60 * S).d));
  g.ws.flags.storyDone = 1; g.modal = null;
  g.teleport(g.player.x, W.mapSize('dajin').H * S - 250); g.modal = null;
  for (let i = 0; i < 40 && !g.modal; i++) { g.player.moving = true; (g.travel as any).dir = { x: 0, y: 1 }; g.travel.update(1 / 30); }
  check('大晋南缘 → 回天南的提示', /天南/.test(g.modal?.node?.title ?? ''), g.modal?.node?.title ?? 'none');
  pick('启程');
  check('回程存档目标为天南北缘', auto()?.map === 'tiannan' && near(auto().p.y / S, 5, 0.5));
  done();
}

if (PHASE === 'edge_back') {
  check('回到天南读档成功', g.load('fanren_save_auto') === true);
  check('落在天南北缘陆地', terrain.isLand(g.player.x, g.player.y) && g.player.y < 40 * S);
  check('三图迷雾都在', !!g.fogs.tiannan && !!g.fogs.dajin);
  done();
}

if (PHASE === 'legacy_a') {
  // 构造一份第十五步的旧存档：人在天星城（旧统一大地图坐标），无 map / fogs 字段
  g.reset(); g.save(0);
  const d = auto(); const tx = LOC_BY_ID.get('tianxing');
  const [lx, ly] = W.fromMap('luanxing', tx.x, tx.y);
  d.v = 2; delete d.map; delete d.fogs; delete d.arrive; d.p = { x: lx * S + 900, y: ly * S, flying: true };
  d.fog = 'x'; d.npcs = d.npcs.map((n: any) => { const { map, ...rest } = n; return rest; });
  mem.fanren_save_auto = JSON.stringify(d); mem['fanren.map'] = 'tiannan';
  const r = g.load('fanren_save_auto');
  check('旧档人在天星城：天南读档转交乱星海', r === false && mem['fanren.map'] === 'luanxing' && mem['fanren.resume'] === 'fanren_save_auto');
  done();
}

if (PHASE === 'legacy_b') {
  const tx = LOC_BY_ID.get('tianxing');
  check('乱星海读入旧档', g.load('fanren_save_auto') === true);
  const dd = Math.hypot(g.player.x - tx.x * S, g.player.y - tx.y * S) / S;
  check('迁移后落在天星城附近的陆地上', dd < 20 && terrain.isLand(g.player.x, g.player.y), `距 ${dd.toFixed(1)} 格`);
  check('NPC 按家乡分配到三图', g.npcs.list.some((n: any) => n.map === 'luanxing') && g.npcs.list.some((n: any) => (n.map ?? 'tiannan') === 'tiannan'));
  g.save(0);
  check('再存档已是 v3', auto()?.v === 3 && auto()?.map === 'luanxing');
  done();
}
