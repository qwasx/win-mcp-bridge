import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, randomLook, Look } from '../src/gfx/character';
import { mulberry32 } from '../src/core/rng';
const scale = +(process.argv[2] || 16);
const out = process.argv[3] || 'face.png';
const looks: Look[] = [HANLI_LOOK, randomLook(mulberry32(7), 'female'), (() => { const f = randomLook(mulberry32(11), 'female'); f.hairStyle = 'long'; return f; })()];
const dirs = [0, 1, 7];
const cw = 16 * scale, ch = 20 * scale;
const c = createCanvas(Math.ceil(cw * dirs.length), Math.ceil(ch * looks.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
looks.forEach((L, row) => dirs.forEach((d, col) => {
  g.save(); g.beginPath(); g.rect(cw * col, ch * row, cw, ch); g.clip();
  const st = new CharState(cw * col + cw / 2, ch * row + ch * 0.45 + 86 * scale * L.height);
  st.yaw = st.targetYaw = d * Math.PI / 4; st.setAction('idle'); st.blend = 1; st.seed = 1;
  for (let i = 0; i < 60; i++) { st.update(1 / 60); drawCharacter(g, L, st, scale, 1 / 60); }
  g.fillStyle = '#e9dfc6'; g.fillRect(cw * col, ch * row, cw, ch);
  drawCharacter(g, L, st, scale, 1 / 60);
  g.restore();
}));
save(c, out);
