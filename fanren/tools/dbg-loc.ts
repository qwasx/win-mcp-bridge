import './env';
const { LOCATIONS, WORLD_SCALE } = await import('../src/data/world');
const hf = LOCATIONS.find((l) => l.id === 'huangfeng')!;
const rows = LOCATIONS.filter((l: any) => l.major || l.type === 'danger' || l.type === 'secret' || l.type === 'sect' || l.type === 'city').map((l: any) => [l.id, l.name, l.type, l.danger ?? '', Math.round(l.x), Math.round(l.y), Math.round(Math.hypot(l.x - hf.x, l.y - hf.y))]);
rows.sort((a: any, b: any) => a[6] - b[6]);
for (const r of rows) console.log(r.join('\t'));
console.log('count', LOCATIONS.length, 'scale', WORLD_SCALE, 'hf', hf.x, hf.y);
