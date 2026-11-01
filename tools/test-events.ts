// 大事件波次冒烟测试
const CW = 1280, CH = 800;
(globalThis as any).window = { innerWidth: CW, innerHeight: CH, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const { LOC_BY_ID, WORLD_SCALE } = await import('../src/data/world');
const terrain = new Terrain(); terrain.build();
const g = new Game(terrain);
g.hero.realm = 2; g.hero.stage = 3;
const run = (id: string, day: number) => {
  g.day = day - 400; g.update(0.03); g.day = day + 1; g.update(0.03);
  const l = LOC_BY_ID.get(({ shengxian: 'tainan', yanjia: 'yanling', modao: 'huangfeng' } as any)[id] ?? id)!; g.teleport(l.x * WORLD_SCALE, l.y * WORLD_SCALE + 300);
  for (let i = 0; i < 10 && !g.modal; i++) g.update(1 / 30);
  const m: any = g.modal; console.log(id, 'offer', m?.node?.speaker, m?.node?.options?.map((o: any) => o.label).join('|'));
  if (!m) return;
  const opt = m.node.options.find((o: any) => o.label.includes('参与') || o.label.includes('擂台'));
  g.closeModal(true); opt?.act();
  for (let w = 0; w < 6; w++) {
    for (const e of g.combat.enemies) if (!e.dead) { e.hp = 0; (g.combat as any).hitEnemy ? null : null; e.dead = true; e.deathT = 0; g.combat.onKill?.(e); if (e.spar) g.combat.onSparEnd?.(e, true); }
    for (let i = 0; i < 5; i++) { g.update(1 / 30); if (g.modal) { console.log('  modal', (g.modal as any).node?.speaker, ((g.modal as any).node?.text ?? '').slice(0, 50).replace(/\n/g, ' ')); g.closeModal(true); } }
  }
  console.log('  state', JSON.stringify(g.ws.events[id] ?? g.ws.events[id + '#0']));
};
run('shengxian', 360 + 60);
run('xuese', 3 * 360 + 150);
run('yanjia', 8 * 360 + 120);
g.ws.events.modao = { state: 'pending', t: 1 }; 
g.day = 11 * 360 + 61; g.update(0.03); console.log('invasion', g.ws.flags.invasion);
g.ws.events.modao.score = 25;
run('modao', 11 * 360 + 61);
console.log('chron', g.events.chronicle().map((c) => c.name + ':' + c.state).join(' '));
console.log('news', g.ws.news.length, g.ws.news.slice(-3).map((n) => n.text).join(' / '));
