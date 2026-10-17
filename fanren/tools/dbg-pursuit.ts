// 追杀调试：逐时打印距离 / 遁速 / 瞬移次数
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const terrain = new Terrain(); terrain.build();
const g: any = new Game(terrain); g.reset();
const realm = +(process.env.R ?? 2), flight = process.env.F ?? '';
const h = g.hero; h.realm = realm; h.stage = 0; h.hp = 1; h.mp = 1; h.equip = flight ? { flight } : {};
g.player.x = 120000; g.player.y = 93000; g.player.flying = true;
g.input.keys.add('d'); g.input.keys.add('shift');
for (let i = 0; i < 10; i++) { g.modal = null; g.update(1 / 30); }
g.pursuit.cd = 0; g.pursuit.start({ reason: 'dbg', gap: 1 });
const log0 = g.combat.texts.length;
for (let i = 0; i < 30 * 40; i++) {
  g.modal = null; g.modalStack = []; g.input.keys.add('d'); g.input.keys.add('shift'); g.update(1 / 30); h.hp = Math.max(h.hp, 0.5); g.combat.invulnT = 5;
  const P = g.pursuit.cur; if (!P) { console.log('escaped at', (i / 30).toFixed(1)); break; }
  if (i % 10 === 0) { const e = P.e, p = g.player; console.log(`t=${(i / 30).toFixed(1)} d=${Math.hypot(e.x - p.x, e.y - p.y).toFixed(0)} v=${P.v.toFixed(0)} hv=${Math.hypot(p.st.vx, p.st.vy).toFixed(0)} boost=${p.boosting} mp=${h.mp.toFixed(2)} bl=${P.blinks} st=${Object.keys(g.combat.pst).filter((k)=>g.combat.pst[k]).join("+")} halt=${g.halted} cm=${g.combat.canMove} keys=${[...g.input.keys].join("")} out=${P.outT.toFixed(1)} lockR=${P.lockR} dun=${e.dun.toFixed(1)} sp=${e.speed} aggro=${e.aggro}`); }
}
