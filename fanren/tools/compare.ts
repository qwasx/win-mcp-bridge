// 拼一张前后对比图：node tools/compare.ts out.png a.png b.png [labelA] [labelB]
import { createCanvas } from './env';
import { loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
const [out, a, b] = process.argv.slice(2);
const A = await loadImage('tools/out/' + a), B = await loadImage('tools/out/' + b);
const W = 1280, H = 800, s = 0.5;
const c = createCanvas(W * s * 2 + 12, H * s);
const g = c.getContext('2d');
g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height);
g.drawImage(A, 0, 0, W * s, H * s); g.drawImage(B, W * s + 12, 0, W * s, H * s);
writeFileSync('tools/out/' + out, c.toBuffer('image/png'));
