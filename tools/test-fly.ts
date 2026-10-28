// 筑基飞行起落测试
(globalThis as any).window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }) };
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
await import('./env');
const { Terrain } = await import('../src/world/terrain');
const { Game } = await import('../src/world/game');
const t = new Terrain(); t.build();
const g = new Game(t);
g.hero.realm = 2; g.hero.stage = 0;
for (let i = 0; i < 10; i++) g.update(1 / 30);
console.log('after 筑基 flying?', g.isFlying, 'canFly', g.canFlyNative);
g.toggleFly(); console.log('F ->', g.isFlying, 'speed', Math.round(g.speed));
g.toggleSit(); console.log('sit ->', g.player.sitting, 'flying', g.isFlying);
g.toggleSit(); g.toggleFly(); g.toggleFly(); console.log('land ->', g.isFlying, 'speed', Math.round(g.speed));
