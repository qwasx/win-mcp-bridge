// 生成当前地图的总览图（宏观坐标）：陆地、湖、河、山脉、地点、名地
import { createCanvas } from '@napi-rs/canvas';
import './env';
import { writeFileSync } from 'fs';
const W = await import('../src/data/world');
const LM = await import('../src/data/landmarks');
const k = 1.6, MW = W.MACRO_W, MH = (W as any).MACRO_H;
const c = createCanvas(Math.round(MW * k), Math.round(MH * k)); const g = c.getContext('2d');
g.fillStyle = '#28445a'; g.fillRect(0, 0, c.width, c.height);
g.fillStyle = '#9a9a78'; g.beginPath(); W.MAINLAND.forEach(([x, y]: any, i: number) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.closePath(); g.fill();
for (const z of (W as any).ARID_ZONES ?? []) { g.fillStyle = 'rgba(210,190,120,0.35)'; g.beginPath(); z.pts.forEach(([x, y]: any, i: number) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.fill(); }
for (const z of (W as any).FOREST_ZONES ?? []) { g.fillStyle = 'rgba(40,110,50,0.35)'; g.beginPath(); z.pts.forEach(([x, y]: any, i: number) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.fill(); }
for (const r of W.RANGES) { g.strokeStyle = 'rgba(80,60,40,0.6)'; g.lineWidth = r.w * k; g.lineCap = 'round'; g.beginPath(); r.pts.forEach(([x, y]: any, i: number) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.stroke(); }
g.fillStyle = '#3a6a8a'; for (const l of W.LAKES) { g.beginPath(); g.arc(l.c[0] * k, l.c[1] * k, l.r * k, 0, 7); g.fill(); }
g.fillStyle = "#9a9a78"; for (const l of (W as any).LAKE_ISLES ?? []) { g.beginPath(); g.arc(l.c[0] * k, l.c[1] * k, l.r * k, 0, 7); g.fill(); }
for (const r of W.RIVERS) { g.strokeStyle = '#4a90c0'; g.lineWidth = Math.max(1.5, r.w * 1.6); g.beginPath(); r.pts.forEach(([x, y]: any, i: number) => i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)); g.stroke(); }
g.font = '10px sans-serif';
for (const l of W.LOCATIONS) {
  const col = l.type === 'sect' ? '#ff5050' : l.type === 'city' ? '#ffd040' : l.type === 'town' ? '#ffffff' : l.type === 'secret' ? '#c080ff' : l.type === 'danger' ? '#202020' : '#00ffff';
  g.fillStyle = col; const s = l.minor ? 1.6 : 3.2; g.fillRect(l.x * k - s, l.y * k - s, s * 2, s * 2);
  if (!l.minor) { g.fillStyle = '#000'; g.fillText(l.id, l.x * k + 4, l.y * k + 3); }
}
g.strokeStyle = '#ff00ff'; g.lineWidth = 1;
for (const L of LM.LANDMARKS) { g.beginPath(); g.arc(L.x / W.WORLD_SCALE * k, L.y / W.WORLD_SCALE * k, L.r / W.WORLD_SCALE * k, 0, 7); g.stroke(); }
// 网格
g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '9px sans-serif';
for (let x = 0; x <= MW; x += 50) { g.fillRect(x * k, 0, 1, 6); g.fillText(String(x), x * k + 1, 14); }
for (let y = 0; y <= MH; y += 50) { g.fillRect(0, y * k, 6, 1); g.fillText(String(y), 8, y * k + 3); }
writeFileSync(new URL('./out/overview_' + W.ACTIVE_MAP + '.png', import.meta.url), c.toBuffer('image/png'));
const rows = W.LOCATIONS.filter((l: any) => !l.minor).map((l: any) => `${l.id}:${l.name}:${l.type}:${l.x.toFixed(0)},${l.y.toFixed(0)}`);
console.log(W.ACTIVE_MAP, 'major', rows.length, 'minor', W.LOCATIONS.filter((l: any) => l.minor).length);
console.log(rows.join(' | '));
console.log('lakes', JSON.stringify(W.LAKES.map((l: any) => [l.c.map((v: number) => Math.round(v)), Math.round(l.r), l.name ?? ''])));
console.log('rivers', JSON.stringify(W.RIVERS.map((r: any) => [r.w, r.pts.map((p: number[]) => p.map(Math.round))])));
console.log('regions', (W as any).REGIONS.map((r: any) => r.id + ':' + r.name).join(' '));
const c2 = c; const g2 = c2.getContext('2d'); g2.font = 'bold 11px sans-serif';
for (const L of LM.LANDMARKS as any[]) if (L.scenic) { const x = L.x / W.WORLD_SCALE * k, y = L.y / W.WORLD_SCALE * k; g2.fillStyle = '#ff2'; g2.beginPath(); g2.arc(x, y, 4, 0, 7); g2.fill(); g2.fillStyle = '#000'; g2.fillText(L.id.slice(3), x + 5, y - 3); }
writeFileSync(new URL('./out/overview_' + W.ACTIVE_MAP + '.png', import.meta.url), c2.toBuffer('image/png'));
const moved = W.LOCATIONS.filter((l: any) => l.minor && (W as any).LAKES.some((q: any) => Math.hypot(q.c[0] - l.x, q.c[1] - l.y) < q.r));
console.log('scenic', (LM.LANDMARKS as any[]).filter((l) => l.scenic).length, 'lotus', (LM.LANDMARKS as any[]).filter((l) => l.id.startsWith('sjl_')).length, 'locs still in lakes:', moved.map((l: any) => l.id + ':' + l.name).join(','));
