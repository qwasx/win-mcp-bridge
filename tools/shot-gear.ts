// 换装 / 头饰 / 铠甲 / 挂件展示：每行一套装扮（同一男/女框架），每列一个朝向
// 用法: npx tsx tools/shot-gear.ts [scale=3] [out=gear.png] [动作=idle]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, Look, Action } from '../src/gfx/character';
import { loadFacesNode } from './faces-node';
import { OUTFITS } from './gear-lineup';

const faces = await loadFacesNode();
const scale = +(process.argv[2] || 3);
const act = (process.argv[4] || 'idle') as Action;
const dirs = [0, 1, 2, 3, 4, 6];
const cw = 40 * scale, ch = 100 * scale;
const c = createCanvas(Math.ceil(cw * dirs.length + 140), Math.ceil(ch * OUTFITS.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const scratch = createCanvas(8, 8).getContext('2d') as any;
OUTFITS.forEach(([name, L0], row) => {
  const L: Look = { ...L0, ...(L0.face && faces[L0.face] ? { skin: faces[L0.face].skin } : {}) };
  dirs.forEach((d, col) => {
    const st = new CharState(140 + cw * col + cw / 2, ch * row + ch * 0.93);
    st.yaw = st.targetYaw = d * Math.PI / 4; st.setAction(act); st.blend = 1;
    const sp = act === 'walk' ? 115 : act === 'run' ? 200 : act === 'fly' ? 300 : 0;
    st.speed = sp; st.vx = Math.sin(st.yaw) * sp; st.vy = Math.cos(st.yaw) * sp; if (act === 'fly') st.lift = 10;
    for (let i = 0; i < 90; i++) { st.update(1 / 60); if (act === 'cast') st.actionT = 0.5; drawCharacter(scratch, L, st, scale, 1 / 60); }
    g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 9 * scale, 3 * scale, 0, 0, Math.PI * 2); g.fill();
    drawCharacter(g, L, st, scale, 1 / 60);
  });
  g.fillStyle = '#333'; g.font = '18px sans-serif'; g.fillText(name, 8, ch * row + ch * 0.5);
});
save(c, process.argv[3] || 'gear.png');
