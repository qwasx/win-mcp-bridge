// 男 / 女身体框架对照：每行一个动作，左五格男、右五格女（正、斜前、侧、斜后、背）
// 用法: npx tsx tools/shot-frame.ts [动作,逗号分隔] [scale=4] [out=frame.png] [帧时间秒=0.5]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, Action, Look } from '../src/gfx/character';
import { loadFacesNode } from './faces-node';

const faces = process.env.NOFACE ? {} : await loadFacesNode();

const acts: Action[] = (process.argv[2] ? process.argv[2].split(',') : ['idle', 'walk', 'run', 'sit', 'cast', 'fly']) as Action[];
const scale = +(process.argv[3] || 4);
const tAt = +(process.argv[5] || 0.5);
const MALE: Look = { ...HANLI_LOOK, ...(faces.hanli ? { skin: faces.hanli.skin } : { face: undefined }) };
const FEMALE: Look = {
  sex: 'f', height: 0.94, build: 0.9, skin: '#f4ddc4', hair: '#1a1614', hairStyle: 'halfup', pin: 'jade',
  robe: '#b8d4b0', inner: '#f8fff4', trim: '#5a8a5a', belt: '#3a4a3a', pants: '#8aa88a', boots: '#5a4040',
  robeLen: 'long', sleeve: 'wide', ribbon: '#7aa87a', shawl: '#e8f4e0', waist: 'jade', back: 'none', hand: 'none', lip: '#c8646e', lash: true,
  ...(faces.f1 ? { face: 'f1', skin: faces.f1.skin } : {}),
};
const dirs = [0, 1, 2, 3, 4].map((k) => k * Math.PI / 4);
const cw = 40 * scale, ch = 100 * scale;
const scratch = createCanvas(Math.ceil(cw), Math.ceil(ch)).getContext('2d') as any;
const c = createCanvas(Math.ceil(cw * 10), Math.ceil(ch * acts.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
acts.forEach((a, row) => {
  [MALE, FEMALE].forEach((look, li) => dirs.forEach((yaw, d) => {
    const col = li * 5 + d;
    const st = new CharState(cw * col + cw / 2, ch * row + ch * 0.93);
    st.yaw = st.targetYaw = yaw;
    st.setAction(a); st.blend = 1;
    const sp = a === 'walk' ? 115 : a === 'run' ? 200 : a === 'fly' ? 300 : 0;
    st.speed = sp; st.vx = Math.sin(yaw) * sp; st.vy = Math.cos(yaw) * sp;
    if (a === 'fly') st.lift = 10;
    const n = Math.round(tAt * 60) + 60;
    for (let i = 0; i < n; i++) { st.update(1 / 60); if (a === 'cast' || a === 'gather') st.actionT = 0.5; drawCharacter(scratch, look, st, scale, 1 / 60); }
    g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 9 * scale, 3 * scale, 0, 0, Math.PI * 2); g.fill();
    drawCharacter(g, look, st, scale, 1 / 60);
  }));
  g.fillStyle = '#333'; g.font = '16px sans-serif'; g.fillText(a, 4, ch * row + 18);
});
g.strokeStyle = '#8a7a5a'; g.beginPath(); g.moveTo(cw * 5, 0); g.lineTo(cw * 5, c.height); g.stroke();
save(c, process.argv[4] || 'frame.png');
