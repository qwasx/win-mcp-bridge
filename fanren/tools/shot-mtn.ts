import { createCanvas, save } from './env';
import { makeMountain, MtnStyle } from '../src/gfx/mountain';
const styles: MtnStyle[] = ['qinglv', 'qinglv', 'karst', 'qianjiang', 'snow', 'demon', 'desert', 'island', 'hill'];
const c = createCanvas(1500, 1500); const g = c.getContext('2d') as any;
g.fillStyle = '#e4dcc0'; g.fillRect(0, 0, c.width, c.height);
let t0 = Date.now();
styles.forEach((st, i) => {
  const big = st === 'qinglv' || st === 'snow' || st === 'karst';
  const m = makeMountain({ seed: 100 + i * 17, style: st, w: big ? 460 : 400, h: big ? 380 : st === 'hill' ? 180 : st === 'island' ? 220 : 300, waterfall: i % 2 === 0, path: i === 0 || i === 3, pavilion: true, cliff: i === 1 || i === 5, tex: 1 });
  const x = (i % 3) * 500 + 250, y = Math.floor(i / 3) * 500 + 470;
  g.drawImage(m.canvas, x - m.ax, y - m.ay, m.w, m.h);
  g.fillStyle = '#333'; g.font = '14px sans-serif'; g.fillText(st, x - 240, y - 440);
});
console.log('ms', Date.now() - t0);
save(c, process.argv[2] || 'mtn.png');
