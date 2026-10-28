// 第三十步：主角跑步循环对照（上：新跑姿；下：原跑姿 / NPC）
import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK } from '../src/gfx/character';
const scale = 1.7, cw = 150, ch = 200, N = 8, yaws = [Math.PI / 2, Math.PI / 4, -Math.PI * 3 / 4];
const c = createCanvas(cw * N, ch * yaws.length * 2);
const g = c.getContext('2d') as any;
const scratch = (createCanvas(400, 400).getContext('2d') as any);
g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, c.width, c.height);
const npc = { ...HANLI_LOOK, headTex: undefined } as any;
yaws.forEach((yaw, yi) => [HANLI_LOOK, npc].forEach((look, li) => {
  const row = yi * 2 + li;
  for (let k = 0; k < N; k++) {
    const st = new CharState(cw * k + cw / 2, ch * row + ch * 0.9);
    st.yaw = st.targetYaw = yaw; st.setAction('run'); st.blend = 1;
    st.speed = 300; st.vx = Math.sin(yaw) * 300; st.vy = Math.cos(yaw) * 300;
    const target = (k / N) * Math.PI * 2 + 40 * Math.PI;
    for (let i = 0; i < 100; i++) { st.update(1 / 60); scratch.save(); scratch.translate(-st.x + 200, -st.y + 300); drawCharacter(scratch, look, st, scale, 1 / 60); scratch.restore(); }
    // 把相位推到目标值附近再画（布料仍是连续模拟的）
    const rate = 6.5 + 300 * 0.012; const left = ((target - st.phase) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const steps = Math.ceil(left / rate * 60); for (let i = 0; i < steps; i++) { st.update(left / rate / steps); scratch.save(); scratch.translate(-st.x + 200, -st.y + 300); drawCharacter(scratch, look, st, scale, left / rate / steps); scratch.restore(); }
    g.save(); g.beginPath(); g.rect(cw * k, ch * row, cw, ch); g.clip();
    g.fillStyle = li ? '#e2d8c0' : '#e9dfc6'; g.fillRect(cw * k, ch * row, cw, ch);
    g.fillStyle = 'rgba(40,40,30,0.25)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 18 * scale, 6 * scale, 0, 0, Math.PI * 2); g.fill();
    drawCharacter(g, look, st, scale, 0);
    g.restore();
  }
}));
save(c, process.argv[2] || 'run.png');
