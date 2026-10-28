// AI 脸的"底稿"：用代码头（光头、五官就位）按游戏里的四个角度渲染成大图，交给改图模型照着画脸，
// 这样生成的脸和代码头的位置、大小、角度天然对齐。同时输出 JSON：每张底稿里头部中心的像素位置与比例。
// 用法: npx tsx tools/face-template.ts <outDir>
import { mkdirSync, writeFileSync } from 'fs';
import { createCanvas } from './env';
import { CharState, drawCharacter, Look } from '../src/gfx/character';
import { FACE_TPL_SCALE, FACE_TPL_SIZE, FACE_VIEWS } from '../src/gfx/faceTex';

const outDir = process.argv[2] || 'tools/out/facetpl';
mkdirSync(outDir, { recursive: true });
const base = (sex: 'm' | 'f'): Look => ({
  sex, height: 1, build: 1, skin: '#f0d8bc', hair: '#1d1a17', hairStyle: 'bald',
  robe: '#ffffff', inner: '#ffffff', trim: '#ffffff', belt: '#ffffff', pants: '#ffffff', boots: '#ffffff',
  robeLen: 'long', sleeve: 'narrow', back: 'none', waist: 'none', hand: 'none', lash: sex === 'f',
});
const meta: Record<string, { cx: number; cy: number }> = {};
for (const sex of ['m', 'f'] as const) {
  for (const [view, yaw] of Object.entries(FACE_VIEWS)) {
    const N = FACE_TPL_SIZE, S = FACE_TPL_SCALE;
    const c = createCanvas(N, N); const g = c.getContext('2d') as any;
    // 先试画一次找头的位置，再平移到画布中上部
    const st = new CharState(0, 0); st.yaw = st.targetYaw = yaw; st.setAction('idle'); st.blend = 1; st.t = 1; st.seed = 0;
    const probe = drawCharacter(createCanvas(8, 8).getContext('2d') as any, base(sex), st, S, 0);
    const cx = N / 2, cy = N * 0.42;
    st.x = cx - probe.headX; st.y = cy - probe.headY;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, N, N);
    const r = drawCharacter(g, base(sex), st, S, 0);
    // 只留头和一截脖子
    g.fillStyle = '#ffffff'; g.fillRect(0, r.headY + 9 * S, N, N);
    meta[`${sex}_${view}`] = { cx: r.headX, cy: r.headY };
    writeFileSync(`${outDir}/${sex}_${view}.png`, c.toBuffer('image/png'));
  }
}
writeFileSync(`${outDir}/meta.json`, JSON.stringify({ scale: FACE_TPL_SCALE, size: FACE_TPL_SIZE, heads: meta }, null, 1));
console.log('ok', Object.keys(meta).join(' '));
