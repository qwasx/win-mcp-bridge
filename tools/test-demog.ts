// 第三十七步：人口金字塔 / 敌人境界与主角脱钩 / 见高人而退 / 瞬移闪避测试：npx tsx tools/test-demog.ts
import { createCanvas } from './env';
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { Renderer } = await import('../src/world/render');
const { Enemy } = await import('../src/world/combat');
const { ENEMIES } = await import('../src/data/enemies');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const D = await import('../src/world/demog');
const { SECT_DEF, member } = await import('../src/world/roster');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
const cv: any = createCanvas(CW, CH); cv.clientWidth = CW; cv.clientHeight = CH; cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: CW, height: CH });
g.canvas = cv; g.renderer = new Renderer(g, cv); (g as any).paused = false;
let fails = 0;
const ok = (c: any, m: string) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const p = g.player;
const hist = (a: number[]) => { const h = [0, 0, 0, 0, 0, 0]; for (const r of a) h[r]++; return h.slice(1).map((n) => (n / a.length * 100).toFixed(1) + '%').join(' / '); };

// 1) 金字塔
const qn = LOC_BY_ID.get('qingniu')!; const qx = qn.x * WORLD_SCALE + 2500, qy = qn.y * WORLD_SCALE;
const rs = Array.from({ length: 4000 }, () => D.foeRealm(g, qx, qy, 'rogue').realm);
console.log('  越国野外劫修 炼气/筑基/结丹/元婴/化神', hist(rs));
ok(rs.filter((r) => r === 1).length / rs.length > 0.55, '炼气过半');
ok(!rs.some((r) => r >= 4), '劫修里没有元婴');
const bs = Array.from({ length: 4000 }, () => D.foeRealm(g, qx, qy, 'boss').realm);
console.log('  首领', hist(bs));
ok(Math.max(...bs) <= 4, '首领最高元婴');

// 2) 与主角境界脱钩（第三阶段起）：劫修不再在你身边凭空生成——他们是地图上真实在走的人，境界由世界决定，与你无关
const H = g.happen as any;
const conjured = (hr: number) => {
  g.hero.realm = hr; g.hero.stage = 0; g.ws.rep = 0;
  let n = 0;
  for (let i = 0; i < 160; i++) {
    H.haps = []; g.combat.enemies = [];
    const r0 = Math.random; let k = 0; Math.random = () => (k++ === 0 ? 0.01 : r0());   // 强制 robber
    try { H.spawn(); } finally { Math.random = r0; }
    for (const x of H.haps) if (x.kind === 'robber') n++;
  }
  return n;
};
g.teleport(qx, qy);
const prowl = () => g.npcs.list.filter((d: any) => d.alive && d.realm > 0 && (d.faction === 'rogue' || d.faction === 'demon') && (d.pers === 'greedy' || d.pers === 'ruthless')).map((d: any) => d.realm);
const lo = (conjured(1), prowl()), hi = (conjured(4), prowl());
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
console.log(`  真实劫修（主角炼气）${hist(lo)}  均 ${mean(lo).toFixed(2)}；（主角元婴）${hist(hi)}  均 ${mean(hi).toFixed(2)}`);
ok(conjured(1) === 0 && conjured(4) === 0, '劫修不再凭空生成在你神识圈外');
ok(lo.length > 50 && Math.abs(mean(lo) - mean(hi)) < 0.35, '劫修境界不随主角境界变化');

// 3) 冲着你来的人：境界越高越少
const nul = (hr: number) => { let n = 0; for (let i = 0; i < 3000; i++) if (!D.threatRealm(g, qx, qy, hr, 0.3, Math.random, hr >= 4)) n++; return n / 3000; };
const n2 = nul(2), n3 = nul(3), n4 = nul(4);
console.log(`  无人敢来：筑基 ${(n2 * 100).toFixed(0)}%  结丹 ${(n3 * 100).toFixed(0)}%  元婴 ${(n4 * 100).toFixed(0)}%`);
ok(n2 < n3 && n3 < n4 && n4 > 0.9, '你境界越高，敢追杀你的人越少（天南几乎没人敢追杀元婴）');
const tr = Array.from({ length: 2000 }, () => D.threatRealm(g, qx, qy, 2, 0.3)).filter(Boolean) as { realm: number }[];
ok(tr.every((t) => t.realm >= 2), '来追杀的至少与你同阶');

// 4) NPC 名额：散修元婴寥寥、化神只出自天魔宗太上、且止步初期
const yyRogues = (m: string) => g.npcs.list.filter((d) => d.alive && d.realm === 4 && !d.canon && !d.ros && d.faction !== 'sect' && d.faction !== 'demon' && (d.map ?? 'tiannan') === m).length;
g.npcs.daily(360 * 200);
for (let y = 0; y < 40; y++) g.npcs.daily(360 * 5);
const hs = g.npcs.list.filter((d) => d.alive && d.realm >= 5);
console.log(`  二百年后：化神 NPC ${hs.length}，散修元婴 天南 ${yyRogues('tiannan')} 乱星海 ${yyRogues('luanxing')} 大晋 ${yyRogues('dajin')}`);
ok(hs.length === 0, 'NPC 闭关修不出化神');
ok(yyRogues('tiannan') <= 1 && yyRogues('luanxing') <= 2 && yyRogues('dajin') <= 3, '散修元婴不超名额');
let hsRos = 0, hsBad = 0;
for (const [sid, def] of SECT_DEF) for (let i = 0; i < Math.min(def.n, 40); i++) { const m = member(def, i, 0); if (m.realm >= 5) { hsRos++; if (m.stage > 0 || sid !== 'tianmo') hsBad++; } }
ok(hsRos === 1 && hsBad === 0, `名册里化神只天魔宗太上一人、初期（${hsRos}）`);

// 5) 见高人而退
g.hero.realm = 3; g.hero.stage = 0; g.concealed = false; g.combat.enemies = [];
const weak = new Enemy(ENEMIES.bandit, p.x + 300, p.y, 1, 4); weak.aggro = true; g.combat.enemies.push(weak);
for (let i = 0; i < 20; i++) g.combat.update(0.05);
ok(weak.cowered, '炼气劫修见了结丹前辈，扭头就逃');
g.combat.hitEnemy(weak, 1, { realm: 3, stCh: 0, skill: 'huodan' }, p.x, p.y);
ok(weak.provoked && weak.retreatT <= 0, '被你打了一下，豁出去拼命');
g.combat.enemies = [];
g.concealed = true;
const weak2 = new Enemy(ENEMIES.bandit, p.x + 300, p.y, 1, 4); weak2.aggro = true; g.combat.enemies.push(weak2);
for (let i = 0; i < 20; i++) g.combat.update(0.05);
ok(!weak2.cowered, '敛息时，他看不穿你的深浅');
g.concealed = false; g.combat.enemies = [];

// 6) 瞬移闪避
const evRate = (fr: number, hr: number) => {
  g.hero.realm = hr; let n = 0;
  for (let i = 0; i < 600; i++) {
    const e = new Enemy(ENEMIES.jindan_mo, p.x + 400, p.y, fr, 0); e.aggro = true;
    const hp0 = e.hp;
    g.combat.hitEnemy(e, e.maxHp * 0.05, { realm: hr, stCh: 0, skill: 'huodan' }, p.x + 200, p.y);
    if (e.hp === hp0 && Math.hypot(e.x - (p.x + 400), e.y - p.y) > 100) n++;
  }
  return n / 600;
};
const e33 = evRate(3, 3), e43 = evRate(4, 3), e35 = evRate(3, 5), e22 = evRate(2, 2);
console.log(`  闪避率：筑基对筑基 ${(e22 * 100).toFixed(0)}%  结丹对结丹 ${(e33 * 100).toFixed(0)}%  元婴对结丹 ${(e43 * 100).toFixed(0)}%  结丹对化神 ${(e35 * 100).toFixed(0)}%`);
ok(e22 > 0.1 && e22 < 0.3 && e33 > 0.2 && e33 < 0.42 && e43 > 0.5 && e35 === 0, '闪避率随境界递增；低你两阶的根本闪不开');
// 冷却：连续的法术只能闪开有限几次
g.hero.realm = 4;
const e = new Enemy(ENEMIES.jindan_mo, p.x + 400, p.y, 4, 0); e.aggro = true; let ev = 0;
for (let i = 0; i < 20; i++) { const x0 = e.x, y0 = e.y; g.combat.hitEnemy(e, e.maxHp * 0.02, { realm: 4, stCh: 0, skill: 'huodan' }, p.x, p.y); if (Math.hypot(e.x - x0, e.y - y0) > 100) ev++; e.evRoll = 0; e.x = x0; e.y = y0; }
ok(ev >= 1 && ev <= 3, `元婴连吃 20 招最多闪开 3 次（${ev}）`);
// 元婴重伤遁走
g.combat.enemies = [];
const yy = new Enemy(ENEMIES.jindan_mo, p.x + 350, p.y, 4, 1); yy.aggro = true; yy.hp = yy.maxHp * 0.15; g.combat.enemies.push(yy);
for (let i = 0; i < 6; i++) g.combat.update(0.05);
ok(yy.fled, '元婴老怪重伤即瞬移遁走');
for (let i = 0; i < 200 && g.combat.enemies.includes(yy); i++) g.combat.update(0.05);
ok(!g.combat.enemies.includes(yy) && !yy.dead, '遁走的元婴消失了（没死）');

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
