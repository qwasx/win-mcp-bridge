// 第三十五步：敌人强度 / 精英词缀 测试
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const EN = await import('../src/data/enemies') as any;
const { Enemy } = await import('../src/world/combat');
const AF = await import('../src/world/affix');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset();
let fails = 0;
const check = (n: string, ok: boolean, x = '') => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + n + (x ? '  ' + x : '')); if (!ok) fails++; };
const h = g.hero;
for (const [r, s, id] of [[1, 5, 'wolf'], [1, 5, 'bandit'], [2, 1, 'snowwolf'], [2, 1, 'zhujixiu'], [3, 0, 'jindan_mo']] as [number, number, string][]) {
  h.realm = r; h.stage = s; g.combat.reset();
  const ps = g.combat.pStats;
  const e = new Enemy(EN.ENEMIES[id], 0, 0, r, s);
  const hitsToKill = e.maxHp / Math.max(1, ps.atk * 1.4 - e.dfn * 0.8);
  const hitsToDie = ps.hp / Math.max(ps.hp * 0.01, e.atk * 1.2 - ps.def * 0.8);
  console.log(`${id} @${r}-${s}: enemy hp ${Math.round(e.maxHp)} atk ${Math.round(e.atk)} | hero hp ${Math.round(ps.hp)} atk ${Math.round(ps.atk)} def ${Math.round(ps.def)} | 主角约 ${hitsToKill.toFixed(1)} 击杀敌, 敌约 ${hitsToDie.toFixed(1)} 击杀主角`);
}
// 词缀
let n = 0, two = 0; for (let i = 0; i < 2000; i++) { const e = new Enemy(EN.ENEMIES.wolf, 0, 0, 1, 3); AF.rollAffix(e, 0); if (e.affix) { n++; if (e.affix.ids.length > 1) two++; } }
let n8 = 0; for (let i = 0; i < 2000; i++) { const e = new Enemy(EN.ENEMIES.wolf, 0, 0, 1, 3); AF.rollAffix(e, 8); if (e.affix) n8++; }
check('近处精英稀少（约 6%）', n > 60 && n < 220, `${n}/2000，双词缀 ${two}`);
check('远处精英常见（约 34%）', n8 > 500 && n8 < 900, `${n8}/2000`);
const e = new Enemy(EN.ENEMIES.wolf, 0, 0, 1, 3); const hp0 = e.maxHp; AF.applyAffix(e, ['kuang', 'fen']);
check('精英血量 ×1.6×1.3、名前缀', Math.abs(e.maxHp / hp0 - 2.08) < 0.02 && e.name.startsWith('狂暴·'), e.name);
// 分裂
h.realm = 1; h.stage = 5; g.combat.reset(); g.combat.invulnT = 99;
e.x = g.player.x + 200; e.y = g.player.y; g.combat.enemies.push(e); e.hp = 1;
g.combat.hitEnemy(e, 9999, { realm: 1, stCh: 0 }, g.player.x, g.player.y);
check('分裂：死后裂为两只', g.combat.enemies.filter((o: any) => !o.dead).length === 2, `loot ${g.combat.loot.length}`);
// 狂暴
const k = new Enemy(EN.ENEMIES.wolf, g.player.x + 100, g.player.y, 1, 5); AF.applyAffix(k, ['kuang']); const a0 = k.atk; k.hp = k.maxHp * 0.4;
AF.affixTick(g.combat, k, 0.1, 100); check('狂暴：半血后攻击 ×1.5', Math.abs(k.atk / a0 - 1.5) < 0.01);
// 召唤
const z = new Enemy(EN.ENEMIES.bandit, g.player.x + 100, g.player.y, 1, 5); AF.applyAffix(z, ['zhao']); g.combat.enemies.push(z); (z.affix as any).zhaoT = 0;
const before = g.combat.enemies.length; AF.affixTick(g.combat, z, 0.1, 300); check('召唤：唤来两名同类', g.combat.enemies.length === before + 2);
// 吸血
const x = new Enemy(EN.ENEMIES.wolf, g.player.x + 60, g.player.y, 1, 5); AF.applyAffix(x, ['xi']); x.hp = x.maxHp * 0.5; g.combat.invulnT = 0; h.hp = 1;
const hx = x.hp; g.combat.hitPlayer(x.atk, 1, undefined, x.x, x.y, x); check('吸血：伤人回血', x.hp > hx, `${Math.round(hx)}→${Math.round(x.hp)}`);
// 灵盾
const d = new Enemy(EN.ENEMIES.wolf, g.player.x + 60, g.player.y, 1, 5); AF.applyAffix(d, ['dun']); AF.affixTick(g.combat, d, 0.1, 100); check('灵盾：护体灵光', !!d.ward);
// 门派流派
const SC = await import('../src/world/schools');
const FS = await import('../src/world/foeskills');
let bad = 0, names = new Set<string>();
for (const sid of Object.keys(SC.SCHOOLS)) for (const r of [1, 2, 3, 4]) {
  const e2 = new Enemy(EN.ENEMIES.zhujixiu, 0, 0, r, 0); e2.school = sid;
  const kit = FS.kitOf(e2);
  for (const s of kit) { names.add(s.name); if (s.k === 'summon' && s.minion !== '@self' && !EN.ENEMIES[s.minion!]) { bad++; console.log('missing minion', sid, s.minion); } }
  if (r >= 3 && !kit.some((s: any) => s.ult)) { bad++; console.log('no ult', sid, r); }
  if (kit.length < 3) { bad++; console.log('short kit', sid, r, kit.length); }
}
check('各门派招式齐全（召唤物存在、结丹有大招）', bad === 0, `${Object.keys(SC.SCHOOLS).length} 派，${names.size} 种招式名`);
const k1 = new Enemy(EN.ENEMIES.zhujixiu, 0, 0, 2, 0); k1.school = 'yanyue'; const k2 = new Enemy(EN.ENEMIES.zhujixiu, 0, 0, 2, 0); k2.school = 'tianque';
check('不同门派同境界招式不同', FS.kitOf(k1)[0].name !== FS.kitOf(k2)[0].name, `${FS.kitOf(k1).map((s: any) => s.name).join('/')} vs ${FS.kitOf(k2).map((s: any) => s.name).join('/')}`);
console.log(fails ? `${fails} FAIL` : 'ALL OK'); process.exit(fails ? 1 : 0);
