import { createCanvas, save } from './env';
import { makeTree, SPECIES_LIST, Season } from '../src/gfx/tree';
const sp = SPECIES_LIST;
const cols = 4 * 3; // 4 seasons x 3 seeds
const cw = 130, chh = 270;
const c = createCanvas(cols * cw, sp.length * chh * 0.82 + 40); const g = c.getContext('2d') as any;
g.fillStyle = '#e4dcc0'; g.fillRect(0, 0, c.width, c.height);
const t0 = Date.now();
sp.forEach((s, r) => {
  for (let k = 0; k < cols; k++) {
    const season = (k / 3 | 0) as Season;
    const t = makeTree(s, season, k * 31 + r * 7 + 1, 0.55);
    const x = k * cw + cw / 2, y = r * chh * 0.82 + 230 * 0.82;
    g.drawImage(t.canvas, x - t.ax * 0.55, y - t.ay * 0.55, t.w * 0.55, t.h * 0.55);
  }
  g.fillStyle = '#333'; g.font = '14px sans-serif'; g.fillText(s, 4, r * chh * 0.82 + 16);
});
console.log('ms', Date.now() - t0, 'per', (Date.now() - t0) / (sp.length * cols));
save(c, process.argv[2] || 'tree.png');
