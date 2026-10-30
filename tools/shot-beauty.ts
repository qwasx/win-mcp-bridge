// 红颜代码绘制半身像（对话框无立绘时使用）：npx tsx tools/shot-beauty.ts out.png
import { createCanvas, save } from './env';
import { CharState, drawCharacter } from '../src/gfx/character';
import { BEAUTIES } from '../src/data/beauties';
const w = +(process.env.W || 300), h = +(process.env.H || 380);
const c = createCanvas(w * 4, h * 2);
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
BEAUTIES.forEach((b, i) => {
  const L = b.look, col = i % 4, row = Math.floor(i / 4);
  const S = +(process.env.S || 10.4);
  g.save(); g.beginPath(); g.rect(col * w, row * h, w, h); g.clip();
  const st = new CharState(col * w + w / 2, row * h + h * +(process.env.FY || 0.3) + 86 * S * L.height);
  st.yaw = (st as any).targetYaw = Math.PI / 4; st.setAction('idle'); (st as any).blend = 1; (st as any).seed = 3;
  for (let k = 0; k < 40; k++) { st.update(1 / 60); drawCharacter(g, L, st, S, 1 / 60); }
  g.fillStyle = '#e9dfc6'; g.fillRect(col * w, row * h, w, h);
  drawCharacter(g, L, st, S, 1 / 60);
  g.restore();
});
save(c, process.argv[2] || 'beauty.png');
