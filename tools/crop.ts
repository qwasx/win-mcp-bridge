// 裁剪放大：npx tsx tools/crop.ts in.png out.png x y w h scale
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
const [i, o, x, y, w, h, s] = process.argv.slice(2);
const img = await loadImage('tools/out/' + i);
const S = +(s || 2);
const c = createCanvas(+w * S, +h * S); const g = c.getContext('2d');
g.imageSmoothingEnabled = false;
g.drawImage(img, +x, +y, +w, +h, 0, 0, +w * S, +h * S);
writeFileSync('tools/out/' + o, c.toBuffer('image/png'));
