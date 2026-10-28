// 动作连贯性检查：连续帧（男 / 女 × 斜前 / 侧 / 斜后），输出逐帧 PNG 供拼 GIF 与胶片条
// 用法: npx tsx tools/shot-anim.ts <动作> <outDir> [帧数=24] [帧间隔秒=1/20] [scale=3]
// 一次性动作（cast/hit/dodge/gather）先站立预热，第 0 帧才切过去，能看到预备与切换；
// 动作写成 a>b（如 run>idle）表示预热做 a、第 0 帧切到 b（看动作之间的过渡）；turn 为原地跑动中掉头。
import { mkdirSync, writeFileSync } from 'fs';
import { createCanvas } from './env';
import { CharState, drawCharacter, HANLI_LOOK, Action, Look } from '../src/gfx/character';
import { loadFacesNode } from './faces-node';
import { OUTFITS } from './gear-lineup';
import { SAMPLE_M, SAMPLE_F } from './hair-lineup';

const faces = await loadFacesNode();
const spec = process.argv[2] || 'walk';
const ONE = ['cast', 'hit', 'dodge', 'gather'];
const [pre, act] = (spec.includes('>') ? spec.split('>') : ONE.includes(spec) ? ['idle', spec] : spec === 'turn' ? ['run', 'run'] : [spec, spec]) as [Action, Action];
const SP = (a: string) => a === 'walk' ? 115 : a === 'run' ? 220 : a === 'fly' ? 300 : 0;
const out = process.argv[3] || 'tools/out/anim';
const N = +(process.argv[4] || 24), dt = +(process.argv[5] || 1 / 20), scale = +(process.argv[6] || 3);
mkdirSync(out, { recursive: true });
const fem = OUTFITS.find(([n]) => n.startsWith('女修'))![1];
// HAIR=m:ponytail,f:long,...：换成发型样板人物（每人一个朝向 YAW，默认侧面），看头发飘动
const HAIR = process.env.HAIR ? process.env.HAIR.split(',') : null;
const looks: Look[] = HAIR ? HAIR.map((h) => { const [sx, st] = h.split(':'); const b = (sx === 'm' ? (SAMPLE_M as any)[st] : (SAMPLE_F as any)[st]); return { ...b, hairStyle: st, skin: faces[b.face]?.skin ?? b.skin }; })
  : [{ ...HANLI_LOOK, skin: faces.hanli?.skin ?? HANLI_LOOK.skin }, { ...fem, skin: faces[fem.face!]?.skin ?? fem.skin }];
const yaws = HAIR ? [+(process.env.YAW ?? 2) * Math.PI / 4] : [1, 2, 3].map((k) => k * Math.PI / 4);
const NC = looks.length * yaws.length;
const cw = 40 * scale, ch = 100 * scale;
const sts = looks.flatMap((L, li) => yaws.map((y, yi) => {
  const st = new CharState(cw * (li * yaws.length + yi) + cw / 2, ch * 0.93);
  st.yaw = st.targetYaw = y; st.setAction(pre); st.blend = 1; st.seed = 1;
  const sp = SP(pre);
  st.speed = sp; st.vx = Math.sin(y) * sp; st.vy = Math.cos(y) * sp; if (pre === 'fly') st.lift = 10;
  return { st, L };
}));
const scratch = createCanvas(8, 8).getContext('2d') as any;
for (const { st, L } of sts) for (let i = 0; i < 60; i++) { st.update(1 / 60); drawCharacter(scratch, L, st, scale, 1 / 60); }
for (const { st } of sts) {
  if (spec === 'turn') { st.targetYaw = st.yaw + Math.PI; }
  else if (act !== pre || ONE.includes(act)) {
    st.setAction(act); const sp = SP(act); st.speed = sp; st.vx = Math.sin(st.yaw) * sp; st.vy = Math.cos(st.yaw) * sp; if (act === 'fly') st.lift = 10;
  }
}
for (let f = 0; f < N; f++) {
  const c = createCanvas(cw * NC, ch); const g = c.getContext('2d') as any;
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
