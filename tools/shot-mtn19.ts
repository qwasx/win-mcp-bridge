import { createCanvas, save } from './env';
import { makeMountain, MtnStyle } from '../src/gfx/mountain';
const list: [MtnStyle, number, number, any][] = [['volcano', 1300, 950, {}], ['volcano', 1700, 1250, {}], ['danxia', 1350, 950, {}], ['danxia', 1700, 1150, { clouds: true }], ['spire', 760, 2700, { clouds: true }], ['karst', 1300, 2000, { clouds: true }]];
const c = createCanvas(2400, 1700); const g = c.getContext('2d') as any;
g.fillStyle = '#e4dcc0'; g.fillRect(0, 0, c.width, c.height);
list.forEach(([st, w, h, ex], i) => {
  const m = makeMountain({ seed: 300 + i * 31, style: st, w, h, layers: 3, tex: 0.5, ...ex });
  const x = (i % 3) * 800 + 400, y = Math.floor(i / 3) * 850 + 820;
  const k = Math.min(1, 760 / (m.w * 0.5), 780 / (m.h * 0.5)) * 0.5;
  g.drawImage(m.canvas, x - m.ax * k, y - m.ay * k, m.w * k, m.h * k);
});
save(c, process.argv[2] || 'mtn19.png');
