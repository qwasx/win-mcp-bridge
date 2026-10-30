import './env';
import { makeMountain } from '../src/gfx/mountain';
for (const tex of [0.2, 0.35, 0.5, 0.75]) {
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) makeMountain({ seed: i, style: 'qinglv', w: 1800, h: 1100, layers: 3, waterfall: true, clouds: true, tex });
  console.log(tex, (Date.now() - t0) / 4, 'ms');
}
