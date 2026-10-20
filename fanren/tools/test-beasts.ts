// 第十五步：妖兽等阶 / 行为 / 妖王巢穴 / 妖丹 / 炼器 测试
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const EN = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const { enemyVis } = await import('../src/world/combatfx');
const { RECIPES } = await import('../src/data/recipes');
const { WORLD_SCALE, legacyHere, ACTIVE_MAP } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset();
let fails = 0;
const check = (n: string, ok: boolean, x = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + n + (x ? '  ' + x : '')); if (!ok) fails++; };
const h = g.hero; h.realm = 2; h.stage = 1; h.hp = 1; h.mp = 1;
const { LOC_BY_ID } = await import('../src/data/world');
const baseLoc = ACTIVE_MAP === 'luanxing' ? LOC_BY_ID.get('tianxing') : ACTIVE_MAP === 'dajin' ? LOC_BY_ID.get('jinjing') : null;
const base = baseLoc ? { x: baseLoc.x * WORLD_SCALE, y: baseLoc.y * WORLD_SCALE + 6000 } : { x: 120000, y: 93000 };
const tick = (n: number, dt = 1 / 30, f?: () => void) => { for (let i = 0; i < n; i++) { g.modal = null; g.update(dt); f?.(); } };
const fresh = () => { g.combat.reset(); g.combat.loot = []; g.modal = null; g.player.x = base.x; g.player.y = base.y; g.player.flying = false; h.hp = 1; h.mp = 1; g.senseBurstT = 0; g.concealed = false; g.combat.invulnT = 999; };

// 1. 等阶 ↔ 境界
let rt = true; for (let lv = 1; lv <= 10; lv++) { const rs = EN.lvRealm(lv); if (EN.lvOf(rs.realm, rs.stage) !== lv) rt = false; }
check('等阶↔境界互逆（1 炼气 · 2–4 筑基 · 5–7 结丹 · 8–10 元婴）', rt);
check('一级妖兽细分下/中/上/顶阶', EN.lvName(1, 1) === '一级下阶' && EN.lvName(1, 12) === '一级顶阶' && EN.lvName(7) === '七级');

// 2. 刷怪分布
const dist = (k: number, zone = '') => {
  const c = g.combat; const cnt: Record<number, number> = {}; let lair = 0, n = 0;
  const orig = c.dangerAt.bind(c);
  c.dangerAt = () => ({ x: 0, y: 0, d: k * 0.75, k, zone, region: '' });
  const r0 = Math.random;
  for (let i = 0; i < 1500; i++) { c.enemies = []; (c as any).spawnTick(); for (const e of c.enemies) { if (!e.blv) continue; cnt[e.blv] = (cnt[e.blv] ?? 0) + 1; n++; if (e.def.lair) lair++; } }
  Math.random = r0; c.dangerAt = orig;
  return { cnt, n, lair };
};
fresh();
{ const r = dist(1); const lv1 = (r.cnt[1] ?? 0) / r.n; check('妖气 1：几乎全是一级妖兽', lv1 > 0.97, JSON.stringify(r.cnt)); }
{ const r = dist(4); const ok = Object.keys(r.cnt).every((k) => +k >= 2 && +k <= 5); check('妖气 4：二至四级（偶见五级越阶）', ok && r.n > 0, JSON.stringify(r.cnt)); }
{ const r = dist(5); const ok = Object.keys(r.cnt).every((k) => +k >= 2 && +k <= 6) && (r.cnt[3] ?? 0) + (r.cnt[4] ?? 0) + (r.cnt[5] ?? 0) > r.n * 0.8; check('妖气 5：三至五级真的存在', ok && r.n > 0, JSON.stringify(r.cnt)); }
{ const r = dist(7, 'cold'); const hi = ((r.cnt[5] ?? 0) + (r.cnt[6] ?? 0) + (r.cnt[7] ?? 0)) / r.n; check('妖气 7（寒地）：五至七级为主', hi > 0.9 && r.n > 0, JSON.stringify(r.cnt)); }
{ const r = dist(8); check('野外最高七级（八级以上只作妖王）', Object.keys(r.cnt).every((k) => +k <= 7) && (r.cnt[7] ?? 0) > r.n * 0.5, JSON.stringify(r.cnt)); }
{ const r = dist(6, 'sea'); check('海中四至六级妖兽成群', r.n > 0 && Object.keys(r.cnt).every((k) => +k >= 3 && +k <= 7), JSON.stringify(r.cnt)); }
{ let lair = 0; for (const d of [0, 2, 4, 6, 8]) lair += dist(d).lair; check('妖王从不随机刷新', lair === 0); }
// 由近及远：黄枫谷 → 越国边境 → 天南西陲，妖气逐级加深
if (ACTIVE_MAP === 'tiannan') {
  const hf = LOC_BY_ID.get('huangfeng')!, S = WORLD_SCALE;
  const at = (dx: number) => { let m = 0, n = 0; for (let dy = -40; dy <= 40; dy += 20) { const w = g.terrain.isLand((hf.x - dx) * S, (hf.y + dy) * S); if (!w) continue; m += g.combat.dangerCalc((hf.x - dx) * S, (hf.y + dy) * S).k; n++; } return n ? m / n : -1; };
  const ks = [60, 200, 380, 560, 700].map(at);
  check('离黄枫谷越远妖气越重', ks[0] < 1.5 && ks[1] > ks[0] && ks[2] > ks[1] + 0.8 && ks[3] > ks[2] && ks[4] >= 6, ks.map((k) => k.toFixed(1)).join(' → '));
}

// 3. 妖王巢穴（第十六步起风希洞府在乱星海图；在天南运行时验证“不在本图则不出现”，完整流程见 FANREN_MAP=luanxing）
fresh();
const L = EN.LAIRS.find((l: any) => l.id === 'lair_fengxi');
const at = legacyHere(L.x, L.y);
if (!at) { g.combat.lairTick(); check(`风希洞府不在${ACTIVE_MAP}图：不会凭空现身`, !g.combat.enemies.some((e: any) => e.lairId)); }
if (at) { g.player.x = at[0] * WORLD_SCALE + 1500; g.player.y = at[1] * WORLD_SCALE; g.player.flying = true; }
g.combat.lairTick();
const fx = g.combat.enemies.find((e: any) => e.lairId === 'lair_fengxi');
if (at) check('靠近风希洞府 → 风希现身（九级妖修，首领）', !!fx && fx.blv === 9 && fx.boss && fx.rankText === '九级妖修', fx ? fx.rankText : 'none');
if (at && fx) {
  (g.combat as any).kill(fx);
  const ids = g.combat.loot.map((l: any) => l.id);
  check('斩杀风希：九级妖丹 + 雷鹏骨翅', ids.includes('mat_yaodan9') && ids.includes('mat_leipenggu'), ids.join(','));
  g.combat.enemies = []; g.combat.lairTick();
  check('妖王被斩后三年内不再现身', !g.combat.enemies.some((e: any) => e.lairId === 'lair_fengxi'));
  g.day += 1100; g.combat.lairTick();
  check('三年后新妖王占据巢穴', g.combat.enemies.some((e: any) => e.lairId === 'lair_fengxi'));
}

// 4. 行为
const place = (id: string, dx: number, dy = 0, rs = { realm: 1, stage: 5 }) => { const e = new Enemy(EN.ENEMIES[id], base.x + dx, base.y + dy, rs.realm, rs.stage); g.combat.enemies.push(e); return e; };
fresh();
{ h.realm = 1; h.stage = 9; /* 第四十一步：同境界才测逃跑本身（筑基会以威压拖慢一级鼠） */ const e = place('shuangtong', 300); const d0 = 300; tick(45); h.realm = 2; h.stage = 1; const d1 = Math.hypot(e.x - g.player.x, e.y - g.player.y); check('双瞳鼠见人即逃', e.flee && d1 > d0 + 150, `d=${d1.toFixed(0)}`); }
fresh();
{ const e = place('zhijiao', 250); tick(20); const a0 = e.aggro; (g.combat as any).damageEnemy ? null : null; e.hp -= 1; e.aggro = true; check('炙角鹿不主动伤人（被打才还手）', !a0 && e.aggro); }
fresh();
{ const w = place('wolf', 1100, 0); const y = place('yunchi', 380, 0); w.hx = w.x; tick(10); check('云翅鸟尖啸示警，惊动附近妖兽', y.called && w.aggro, `called=${y.called} wolf=${w.aggro}`); }
fresh();
{
  const e = place('shuangtong', 0, 0); tick(1);
  const R = g.life.sense.R; e.x = g.life.sense.x + R * 0.6; e.y = g.life.sense.y; e.aggro = false;
  const v0 = enemyVis(g.combat, e); g.senseBurstT = 20; const v1 = enemyVis(g.combat, e); g.senseBurstT = 0;
  check('擅隐匿：神识六成处察觉不到，外放神识方现形', v0 === 0 && v1 > 0, `v0=${v0} v1=${v1.toFixed(2)}`);
}
fresh();
{ const e = place('tujia', 900, 0, EN.lvRealm(7)); const x0 = e.x; e.hp = e.maxHp * 0.5; tick(2); check('土甲龙重伤时土遁', e.burrowed && Math.abs(e.x - x0) > 300, `dx=${(e.x - x0).toFixed(0)}`); }

// 5. 妖丹
fresh();
{ const e = place('xuehou', 400, 0, EN.lvRealm(5)); (g.combat as any).kill(e); const has = g.combat.loot.some((l: any) => l.id === 'mat_yaodan5'); check('五级妖兽必出五级妖丹', has && e.blv === 5); }
fresh();
{ g.combat.loot.push({ x: base.x + 420, y: base.y, id: 'mat_yaodan3', n: 1, t: 0 }); const n0 = h.bag.find((b: any) => b.id === 'mat_yaodan3')?.n ?? 0; tick(60); const n1 = h.bag.find((b: any) => b.id === 'mat_yaodan3')?.n ?? 0; check('妖丹灵光自行飞入怀中', n1 === n0 + 1, `${n0}→${n1}`); }

// 6. 炼器
{
  const C = await import('../src/world/cultivation');
  const r = RECIPES.find((x: any) => x.id === 'f_wulong')!;
  for (const i of r.inputs) C.addItem(h, i.id, i.n);
  const c1 = C.checkRecipe(h, r, true), c0 = C.checkRecipe(h, r, false);
  check('炼器：无地火成器率 ×0.6', c1.ok && Math.abs(c0.chance - c1.chance * 0.6) < 1e-6, `${c1.chance.toFixed(2)} / ${c0.chance.toFixed(2)}`);
  const r0 = Math.random; Math.random = () => 0; const res = C.brew(h, r, true); Math.random = r0;
  check('炼成乌龙夺（墨蛟爪）', res.ok && h.bag.some((b: any) => b.id === 'art_wulong'));
  const fl = RECIPES.find((x: any) => x.id === 'f_fenglei')!;
  for (const i of fl.inputs) C.addItem(h, i.id, i.n);
  check('风雷翅需结丹期方可炼制', !C.checkRecipe(h, fl).ok);
  h.realm = 3; h.stage = 0; check('结丹后可炼风雷翅', C.checkRecipe(h, fl).ok); h.realm = 2; h.stage = 1;
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
