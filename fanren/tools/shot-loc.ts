import { createCanvas, save } from './env';
import { layoutLocation, renderPiece, renderGround } from '../src/gfx/building';
import { LOCATIONS } from '../src/data/world';
const ids = (process.argv[3] || 'huangfeng,yanyue,tianmo,yuejing,qingniu,kuixing').split(',');
const S = Number(process.argv[4] || 0.45);
const cell = 1500 * S;
const cols = 3;
const c = createCanvas(cols * cell, Math.ceil(ids.length / cols) * cell); const g = c.getContext('2d') as any;
g.fillStyle = '#d8d6b0'; g.fillRect(0, 0, c.width, c.height);
const t0 = Date.now();
ids.forEach((id, i) => {
  const loc = LOCATIONS.find((l) => l.id === id)!;
  const L = layoutLocation(loc);
  const ox = (i % cols) * cell + cell / 2, oy = Math.floor(i / cols) * cell + cell / 2;
  g.save(); g.beginPath(); g.rect(ox - cell / 2, oy - cell / 2, cell, cell); g.clip();
  const gr = renderGround(L, S);
  g.drawImage(gr.canvas, ox - gr.ax * S, oy - gr.ay * S, gr.w * S, gr.h * S);
  const ps = [...L.pieces].sort((a, b) => a.y - b.y);
  for (const p of ps) {
    const s = renderPiece(p, L.pal, S, 2);
    g.drawImage(s.canvas, ox + (p.x - s.ax) * S, oy + (p.y - s.ay) * S, s.w * S, s.h * S);
  }
  if (L.barrier) { const b = L.barrier; g.strokeStyle = b.color; g.lineWidth = 2; g.beginPath(); g.ellipse(ox + b.x * S, oy + b.y * S, b.rx * S, b.ry * S, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#000'; g.font = '16px sans-serif'; g.fillText(id + ' pieces=' + L.pieces.length, ox - cell / 2 + 6, oy - cell / 2 + 18);
  g.restore();
});
console.log('ms', Date.now() - t0);
save(c, process.argv[2] || 'loc.png');
