// 时间线数值验证：完整走一遍周期，校验关键物理节点
import { createTimeline, CFG } from '../js/timeline.js';

const assert = (cond, msg) => { if (!cond) { console.error('✗ ' + msg); process.exitCode = 1; } else console.log('✓ ' + msg); };
function assertNum(v, msg) { if (Number.isNaN(v)) { console.error('✗ NaN: ' + msg); process.exitCode = 1; } }

const tl = createTimeline();
const st = tl.st;
const dt = 1 / 120;
let hangFrames = 0, pulses = 0, rollAtRelease = null;
let impactV = null, sawFall = false, sawLanded = false, doneT = null;
let minAltFall = 1e9;
const captions = new Set(), capTimes = {};

for (let i = 0; i < 120 * 25; i++) {
  tl.step(dt);
  const pose = tl.pose();
  assertNum(pose.p[0] + pose.p[1] + pose.p[2], `pose @${i}`);
  assertNum(pose.f[0] + pose.f[1] + pose.f[2], `pose.f @${i}`);
  assertNum(pose.u[0] + pose.u[1] + pose.u[2], `pose.u @${i}`);
  if (st.mode === 'hang') hangFrames += dt;
  if (st.mode === 'fall') {
    sawFall = true;
    minAltFall = Math.min(minAltFall, st.h - CFG.rideH);
    if (rollAtRelease === null) rollAtRelease = st.rollAng;
  }
  if (st.mode === 'landed' && !sawLanded) { sawLanded = true; impactV = st.impactV; }
  if (st.done && doneT === null) { doneT = st.t; break; }
  for (const ev of st.events) {
    if (ev.type === 'pulse') pulses++;
    if (ev.type === 'caption') { captions.add(ev.id); capTimes[ev.id] = st.t; }
  }
  st.events.length = 0;
}

assert(sawFall, '进入下落阶段');
assert(sawLanded, '进入着陆阶段');
assert(Math.abs(rollAtRelease - Math.PI) < .05, `释放时倒挂180°（roll=${rollAtRelease?.toFixed(3)}）`);
assert(hangFrames > 0.9 && hangFrames < 1.5, `倒挂保持≈1.15s（实际 ${hangFrames.toFixed(2)}s）`);
assert(pulses === 4, `四道横滚脉冲（实际 ${pulses}）`);
assert(impactV > 3.2 && impactV < 6.2, `接地速度 3.2~6.2 m/s（实际 ${impactV?.toFixed(2)}）`);
assert(minAltFall > -0.01, `下落期间未穿地（最低 ${minAltFall.toFixed(3)}m）`);
assert(doneT > 14 && doneT < 21, `周期 14~21s（实际 ${doneT?.toFixed(2)}s）`);

const order = ['enter', 'lock', 'release', 'roll', 'brake', 'touch', 'confirm'];
for (const id of order)
  assert(captions.has(id), `字幕事件 ${id} @ ${capTimes[id]?.toFixed(2)}s`);
const ts = order.map(id => capTimes[id]);
assert(ts.every((v, i) => i === 0 || v > ts[i - 1]), '字幕时间顺序正确');

const hRelease = 2 * CFG.R - CFG.rideH;
assert(Math.abs(hRelease - 31.36) < .01, `顶点释放高度 ${hRelease}m`);

console.log(process.exitCode ? '\n测试失败' : '\n全部通过 ✔');
