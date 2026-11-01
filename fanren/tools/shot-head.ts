import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, randomLook, Look } from '../src/gfx/character';
import { mulberry32 } from '../src/core/rng';
// 头部特写：多角色 × 多朝向
const scale = +(process.argv[2] || 7);
const out = process.argv[3] || 'head.png';
const rnd = mulberry32(7);
const looks: Look[] = [HANLI_LOOK];
const fem = randomLook(rnd, 'female'); looks.push(fem);
const f2 = randomLook(mulberry32(11), 'female'); f2.hairStyle = 'long'; looks.push(f2);
const f3 = randomLook(mulberry32(12), 'female'); f3.hairStyle = 'twin'; looks.push(f3);
looks.push(randomLook(mulberry32(5), 'elder'));
looks.push(randomLook(mulberry32(9), 'cultivator'));
const dirs = [0, 1, 2, 3, 4, 7];
const cw = 22 * scale, ch = 30 * scale;
const c = createCanvas(Math.ceil(cw * dirs.length), Math.ceil(ch * looks.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
looks.forEach((L, row) => dirs.forEach((d, col) => {
  g.save();
  g.beginPath(); g.rect(cw * col, ch * row, cw, ch); g.clip();
  const st = new CharState(cw * col + cw / 2, ch * row + ch * 0.42 + 78 * scale);
  st.yaw = st.targetYaw = d * Math.PI / 4; st.setAction('idle'); st.blend = 1;
  for (let i = 0; i < 60; i++) { st.update(1 / 60); drawCharacter(g, L, st, scale, 1 / 60); }
  g.fillStyle = '#e9dfc6'; g.fillRect(cw * col, ch * row, cw, ch);
  drawCharacter(g, L, st, scale, 1 / 60);
  g.restore();
}));
save(c, out);
