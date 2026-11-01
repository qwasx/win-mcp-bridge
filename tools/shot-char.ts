import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, randomLook, Action } from '../src/gfx/character';
import { mulberry32 } from '../src/core/rng';

const acts: Action[] = (process.argv[2] ? process.argv[2].split(',') : ['idle', 'walk', 'run', 'fly', 'sit', 'cast', 'hit', 'dodge', 'gather']) as Action[];
const scale = +(process.argv[3] || 1.6);
const cw = 110 * scale / 1.6 * 1.25, ch = 150 * scale / 1.6 * 1.25;
const c = createCanvas(Math.ceil(cw * 8), Math.ceil(ch * acts.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
acts.forEach((a, row) => {
  for (let d = 0; d < 8; d++) {
    const st = new CharState(cw * d + cw / 2, ch * row + ch * 0.86);
    st.yaw = st.targetYaw = d * Math.PI / 4;
    st.setAction(a); st.blend = 1;
    if (a === 'walk') { st.speed = 115; st.vx = Math.sin(st.yaw) * 115; st.vy = Math.cos(st.yaw) * 115; }
    if (a === 'run') { st.speed = 200; st.vx = Math.sin(st.yaw) * 200; st.vy = Math.cos(st.yaw) * 200; }
    if (a === 'fly') { st.speed = 300; st.vx = Math.sin(st.yaw) * 300; st.vy = Math.cos(st.yaw) * 300; st.lift = 10; }
    // 预热布料
    for (let i = 0; i < 90; i++) { st.update(1 / 60); st.actionT = a === 'cast' || a === 'gather' ? 0.5 : a === 'hit' ? 0.22 : a === 'dodge' ? 0.19 : st.actionT; drawCharacter(g, HANLI_LOOK, st, scale, 1 / 60); }
    g.fillStyle = '#e9dfc6'; g.fillRect(cw * d, ch * row, cw, ch);
    g.fillStyle = 'rgba(40,40,30,0.25)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 18 * scale, 6 * scale, 0, 0, Math.PI * 2); g.fill();
    drawCharacter(g, HANLI_LOOK, st, scale, 1 / 60);
  }
  g.fillStyle = '#333'; g.font = '14px sans-serif'; g.fillText(a, 4, ch * row + 16);
});
save(c, process.argv[4] || 'char.png');
