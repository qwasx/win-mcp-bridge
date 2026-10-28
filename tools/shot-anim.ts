// 动作连贯性检查：连续帧（男 / 女 × 斜前 / 侧 / 斜后），输出逐帧 PNG 供拼 GIF 与胶片条
// 用法: npx tsx tools/shot-anim.ts <动作> <outDir> [帧数=24] [帧间隔秒=1/20] [scale=3]
import { mkdirSync, writeFileSync } from 'fs';
import { createCanvas } from './env';
import { CharState, drawCharacter, HANLI_LOOK, Action, Look } from '../src/gfx/character';
import { loadFacesNode } from './faces-node';
import { OUTFITS } from './gear-lineup';

const faces = await loadFacesNode();
const act = (process.argv[2] || 'walk') as Action;
const out = process.argv[3] || 'tools/out/anim';
const N = +(process.argv[4] || 24), dt = +(process.argv[5] || 1 / 20), scale = +(process.argv[6] || 3);
mkdirSync(out, { recursive: true });
const fem = OUTFITS.find(([n]) => n.startsWith('女修'))![1];
const looks: Look[] = [{ ...HANLI_LOOK, skin: faces.hanli?.skin ?? HANLI_LOOK.skin }, { ...fem, skin: faces[fem.face!]?.skin ?? fem.skin }];
const yaws = [1, 2, 3].map((k) => k * Math.PI / 4);
const cw = 40 * scale, ch = 100 * scale;
const sts = looks.flatMap((L, li) => yaws.map((y, yi) => {
  const st = new CharState(cw * (li * 3 + yi) + cw / 2, ch * 0.93);
  st.yaw = st.targetYaw = y; st.setAction(act); st.blend = 1; st.seed = 1;
  const sp = act === 'walk' ? 115 : act === 'run' ? 220 : act === 'fly' ? 300 : 0;
  st.speed = sp; st.vx = Math.sin(y) * sp; st.vy = Math.cos(y) * sp; if (act === 'fly') st.lift = 10;
  return { st, L };
}));
const scratch = createCanvas(8, 8).getContext('2d') as any;
for (const { st, L } of sts) for (let i = 0; i < 60; i++) { st.update(1 / 60); drawCharacter(scratch, L, st, scale, 1 / 60); }
for (let f = 0; f < N; f++) {
  const c = createCanvas(cw * 6, ch); const g = c.getContext('2d') as any;
  g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
  for (const { st, L } of sts) {
    const sub = Math.max(1, Math.round(dt * 60));
    for (let k = 0; k < sub - 1; k++) { st.update(dt / sub); drawCharacter(scratch, L, st, scale, dt / sub); }
    st.update(dt / sub);
    g.fillStyle = 'rgba(40,40,30,0.22)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 9 * scale, 3 * scale, 0, 0, Math.PI * 2); g.fill();
    drawCharacter(g, L, st, scale, dt / sub);
  }
  writeFileSync(`${out}/f${String(f).padStart(3, '0')}.png`, c.toBuffer('image/png'));
}
console.log('ok', act, N);
