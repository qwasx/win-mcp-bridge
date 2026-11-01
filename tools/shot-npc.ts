import { createCanvas, save } from './env';
import { CharState, drawCharacter, randomLook, NpcRole } from '../src/gfx/character';
import { mulberry32 } from '../src/core/rng';
const roles: NpcRole[] = ['cultivator', 'female', 'scholar', 'farmer', 'merchant', 'elder', 'guard', 'monk', 'female', 'cultivator', 'female', 'farmer'];
const sc = 1.3, cw = 100, ch = 160;
const c = createCanvas(cw * 12, ch * 2); const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const rnd = mulberry32(7);
roles.forEach((r, i) => {
  const look = randomLook(rnd, r);
  for (let row = 0; row < 2; row++) {
    const st = new CharState(cw * i + cw / 2, ch * row + ch * 0.9);
    st.yaw = st.targetYaw = row === 0 ? 0.3 : Math.PI * 0.75;
    st.setAction(row === 0 ? 'idle' : 'walk'); st.blend = 1; st.speed = 100; st.vx = Math.sin(st.yaw) * 100; st.vy = Math.cos(st.yaw) * 100;
    if (row === 0) { st.vx = st.vy = 0; }
    for (let k = 0; k < 80; k++) { st.update(1 / 60); g.save(); g.globalAlpha = 0; drawCharacter(g, look, st, sc, 1 / 60); g.restore(); }
    drawCharacter(g, look, st, sc, 1 / 60);
  }
});
save(c, 'npc.png');
