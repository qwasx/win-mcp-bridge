// AI 脸检查：每行一张脸（配代码发型），每列一个朝向；头部特写
// 用法: npx tsx tools/shot-faces.ts [scale=8] [out=faces.png] [id,id,...]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, randomLook, Look } from '../src/gfx/character';
import { mulberry32 } from '../src/core/rng';
import { loadFacesNode } from './faces-node';
import { BEAUTY_BY_ID } from '../src/data/beauties';

const faces = await loadFacesNode();
const scale = +(process.argv[2] || 8);
const ids = process.argv[4] ? process.argv[4].split(',') : Object.keys(faces);
const dirs = [0, 1, 2, 3, 4, 6, 7];
const cw = 22 * scale, ch = 26 * scale;
const c = createCanvas(Math.ceil(cw * dirs.length), Math.ceil(ch * ids.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const scratch = createCanvas(8, 8).getContext('2d') as any;
ids.forEach((id, row) => {
  const f = faces[id];
  const old = /7$/.test(id);
  const L: Look = { ...randomLook(mulberry32(row * 7 + 3), f.sex === 'f' ? 'female' : old ? 'elder' : 'cultivator'), face: id, skin: f.skin };
  if (BEAUTY_BY_ID[id]) Object.assign(L, BEAUTY_BY_ID[id].look);
  else if (f.sex === 'm' && !old) L.hairStyle = (['bun', 'crown', 'ponytail'] as const)[row % 3];
  dirs.forEach((d, col) => {
    g.save(); g.beginPath(); g.rect(cw * col, ch * row, cw, ch); g.clip();
    const st = new CharState(cw * col + cw / 2, ch * row + ch * 0.5 + 74 * scale);
    st.yaw = st.targetYaw = d * Math.PI / 4; st.setAction('idle'); st.blend = 1; st.t = 1; st.seed = 0;
    for (let i = 0; i < 30; i++) drawCharacter(scratch, L, st, scale, 1 / 60);
    drawCharacter(g, L, st, scale, 0);
    g.restore();
  });
  g.fillStyle = '#333'; g.font = '16px sans-serif'; g.fillText(id, 4, ch * row + 18);
});
save(c, process.argv[3] || 'faces.png');
