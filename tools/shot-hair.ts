// 发型总表：每行一种发型，每列一个朝向（正、斜前、侧、斜后、背 + 镜像的斜前），配 AI 脸；最右一格是全身小样
// 用法: npx tsx tools/shot-hair.ts <m|f> [scale=7] [out=hair-m.png] [动作=idle]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, Look, Action } from '../src/gfx/character';
import { HAIR_NAMES, MALE_STYLES, FEMALE_STYLES, type HairStyle } from '../src/gfx/hair';
import { loadFacesNode } from './faces-node';
import { SAMPLE_M, SAMPLE_F } from './hair-lineup';

const faces = await loadFacesNode();
const sex = (process.argv[2] || 'm') as 'm' | 'f';
const scale = +(process.argv[3] || 7);
const act = (process.argv[5] || 'idle') as Action;
const styles: HairStyle[] = process.env.STYLES ? process.env.STYLES.split(',') as HairStyle[] : sex === 'm' ? MALE_STYLES : FEMALE_STYLES;
const samples = sex === 'm' ? SAMPLE_M : SAMPLE_F;
const dirs = [0, 1, 2, 3, 4, -1];
const cw = 24 * scale, ch = 33 * scale, lab = 150, bodyW = 44 * 2.6;
const c = createCanvas(Math.ceil(lab + cw * dirs.length + bodyW), Math.ceil(ch * styles.length));
const g = c.getContext('2d') as any;
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const scratch = createCanvas(8, 8).getContext('2d') as any;
const run = (L: Look, st: CharState, sc: number) => {
  st.setAction(act); st.blend = 1; st.seed = 0;
  const sp = act === 'walk' ? 115 : act === 'run' ? 220 : act === 'fly' ? 300 : 0;
  st.speed = sp; st.vx = Math.sin(st.yaw) * sp; st.vy = Math.cos(st.yaw) * sp; if (act === 'fly') st.lift = 10;
  for (let i = 0; i < 90; i++) { st.update(1 / 60); drawCharacter(scratch, L, st, sc, 1 / 60); }
};
styles.forEach((s, row) => {
  const base = samples[s] ?? (sex === 'm' ? HANLI_LOOK : SAMPLE_F.long);
  const L: Look = { ...base, hairStyle: s, ...(base.face && faces[base.face] ? { skin: faces[base.face].skin } : {}) };
  if (row % 2) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, ch * row, c.width, ch); }
  dirs.forEach((d, col) => {
    g.save(); g.beginPath(); g.rect(lab + cw * col, ch * row, cw, ch); g.clip();
    const st = new CharState(lab + cw * col + cw / 2, ch * row + ch * 0.64 + (sex === 'f' ? 76 : 80) * scale);
    st.yaw = st.targetYaw = d * Math.PI / 4; st.t = 0;
    run(L, st, scale);
    drawCharacter(g, L, st, scale, 1 / 60);
    g.restore();
  });
  // 全身小样（斜前）
  const st = new CharState(lab + cw * dirs.length + bodyW / 2, ch * row + ch * 0.97);
  st.yaw = st.targetYaw = Math.PI / 4; st.t = 0;
  const bs = Math.min(2.6, ch / 100 * 0.95);
  run(L, st, bs);
  drawCharacter(g, L, st, bs, 1 / 60);
  g.fillStyle = '#3a2e22'; g.font = 'bold 22px "Noto Sans CJK SC", sans-serif'; g.fillText(HAIR_NAMES[s], 10, ch * row + ch * 0.45);
  g.font = '14px sans-serif'; g.fillStyle = '#7a6a52'; g.fillText(s, 10, ch * row + ch * 0.45 + 22);
});
g.fillStyle = '#7a6a52'; g.font = '14px "Noto Sans CJK SC", sans-serif';
['正面', '斜前', '侧面', '斜后', '背面', '斜前(镜像)', '全身'].forEach((t, i) => g.fillText(t, lab + cw * i + 6, 16));
save(c, process.argv[4] || `hair-${sex}.png`);
