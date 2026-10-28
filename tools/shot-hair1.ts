// 调试：单个发型的大头像，多个朝向一行
// 用法: STYLE=bun SEX=m npx tsx tools/shot-hair1.ts [scale=12] [out] [dirs=0,2,4]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, Look, Action } from '../src/gfx/character';
import { loadFacesNode } from './faces-node';
import { SAMPLE_M, SAMPLE_F } from './hair-lineup';
const faces = await loadFacesNode();
const sex = process.env.SEX || 'm', style = (process.env.STYLE || 'bun') as any;
const scale = +(process.argv[2] || 12);
const dirs = (process.argv[4] || '0,1,2,3,4').split(',').map(Number);
const act = (process.env.ACT || 'idle') as Action;
const base = (sex === 'm' ? (SAMPLE_M as any)[style] : (SAMPLE_F as any)[style]) ?? (sex === 'm' ? SAMPLE_M.crown : SAMPLE_F.long);
const L: Look = { ...base, hairStyle: style, ...(base.face && faces[base.face] ? { skin: faces[base.face].skin } : {}), ...(process.env.NOFACE ? { face: undefined } : {}) };
const cw = 26 * scale, ch = 34 * scale;
const c = createCanvas(cw * dirs.length, ch); const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const scratch = createCanvas(8, 8).getContext('2d') as any;
dirs.forEach((d, i) => {
  const st = new CharState(cw * i + cw / 2, ch * 0.62 + 72 * scale);
  st.yaw = st.targetYaw = d * Math.PI / 4; st.t = 1; st.setAction(act); st.blend = 1; st.seed = 0;
  const sp = act === 'run' ? 220 : act === 'fly' ? 300 : 0; st.speed = sp; st.vx = Math.sin(st.yaw) * sp; st.vy = Math.cos(st.yaw) * sp;
  for (let k = 0; k < 90; k++) { st.update(1 / 60); drawCharacter(scratch, L, st, scale, 1 / 60); }
  g.save(); g.beginPath(); g.rect(cw * i, 0, cw, ch); g.clip(); drawCharacter(g, L, st, scale, 1 / 60); g.restore();
});
save(c, process.argv[3] || 'h1.png');
