import './env';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readdirSync, writeFileSync } from 'fs';
const D = '/home/user/assets-src/kenney-particle-pack/addons/kenney_particle_pack/';
const files = readdirSync(D).filter((f) => f.endsWith('.png') && !/rotated|icon|preview|sample|window/.test(f)).sort();
const S = 96, COLS = 12, rows = Math.ceil(files.length / COLS);
const cv = createCanvas(COLS * S, rows * (S + 14)); const g = cv.getContext('2d');
g.fillStyle = '#1c2430'; g.fillRect(0, 0, cv.width, cv.height);
(async () => {
  for (let i = 0; i < files.length; i++) {
    const im = await loadImage(D + files[i]); const x = (i % COLS) * S, y = Math.floor(i / COLS) * (S + 14);
    g.drawImage(im, x + 4, y + 2, S - 8, S - 8); g.fillStyle = '#ffd070'; g.font = '11px sans-serif'; g.fillText(files[i].replace('.png', ''), x + 4, y + S + 8);
  }
  writeFileSync('tools/out/v/ksheet.png', cv.toBuffer('image/png')); console.log(files.length);
})();
