// 神识特效单独渲染：npx tsx tools/shot-sense.ts out.png tier mods t
import { createCanvas, save } from './env';
import { SenseFx } from '../src/world/sense';
const [out, tier, mods, tt] = [process.argv[2] || 'sense.png', +(process.argv[3] || 1), (process.argv[4] || '').split(',').filter(Boolean), +(process.argv[5] || 2)];
const cv: any = createCanvas(1000, 1000); const g = cv.getContext('2d');
g.fillStyle = '#b9c49a'; g.fillRect(0, 0, 1000, 1000);
const fx = new SenseFx();
fx.update(0.016, 420);
if (process.env.ALARM) fx.alarm = 1;
for (let i = 0; i < 4; i++) fx.draw(g, 500, 500, tier, mods, tt + i / 60, 1);
g.fillStyle = '#b9c49a'; g.fillRect(0, 0, 1000, 1000);
fx.draw(g, 500, 500, tier, mods, tt, 1);
fx.drawMemory(g, 500, 500, 420, 1000, 1000, false);
save(cv, out);
