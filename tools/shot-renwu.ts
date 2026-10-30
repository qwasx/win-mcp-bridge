// 人物重做：检查图
//   npx tsx tools/shot-renwu.ts [close|acts|dirs|hands|outfits|crowd|all]
import { createCanvas, save } from './env';
import { CharState, drawCharacter, HANLI_LOOK, randomLook, applyOutfit, OUTFITS, GESTURES, GESTURE_NAMES, type Action, type Look, type Gesture } from '../src/gfx/character';
import { BEAUTIES } from '../src/data/beauties';
import { mulberry32 } from '../src/core/rng';
import { drawHand, aimHandFrame } from '../src/gfx/renwu/hand';

const which = process.argv[2] || 'all';
const BG = '#ece3cf';

const scratch = createCanvas(64, 64).getContext('2d') as any;
function warm(_g: any, L: Look, st: CharState, sc: number, a: Action, at?: number) {
  void a;
  for (let i = 0; i < 70; i++) { st.update(1 / 60); if (at !== undefined) st.actionT = at; drawCharacter(scratch, L, st, sc, 1 / 60); }
}
function cell(g: any, x: number, y: number, w: number, h: number) {
  g.fillStyle = BG; g.fillRect(x, y, w, h);
}
function label(g: any, s: string, x: number, y: number) { g.fillStyle = '#5a4a3a'; g.font = '13px sans-serif'; g.fillText(s, x, y); }
function mkState(x: number, y: number, a: Action, yaw: number, speed = 0) {
  const st = new CharState(x, y); st.yaw = st.targetYaw = yaw; st.setAction(a); st.blend = 1; st.seed = 7;
  if (speed) { st.speed = speed; st.vx = Math.sin(yaw) * speed; st.vy = Math.cos(yaw) * speed; }
  return st;
}
const fem1 = applyOutfit({ ...BEAUTIES[0].look }, 'guangxiu', 0);
const fem2 = applyOutfit({ ...randomLook(mulberry32(11), 'female'), hairStyle: 'halfup', fringe: 'part', pin: 'gold' }, 'ruqun', 0);
const male2 = applyOutfit({ ...randomLook(mulberry32(5), 'cultivator'), hairStyle: 'crown', back: 'sword' }, 'daopao', 1);
const elder = randomLook(mulberry32(3), 'elder');
const merch = randomLook(mulberry32(9), 'merchant');
const knight = applyOutfit({ ...randomLook(mulberry32(21), 'female'), hairStyle: 'ponytail', fringe: 'side' }, 'nvxia', 0);
const PEOPLE: [string, Look][] = [['韩立', HANLI_LOOK], ['南宫婉', fem1], ['襦裙', fem2], ['法袍', male2], ['女侠', knight], ['长老', elder], ['掌柜', merch]];

if (which === 'close' || which === 'all') {
  const sc = 6.2, cw = 300, ch = 330;
  const c = createCanvas(cw * PEOPLE.length, ch * 2); const g = c.getContext('2d') as any;
  PEOPLE.forEach(([name, L], i) => {
    for (const [row, yaw] of [[0, 0.45], [1, 0.0]] as [number, number][]) {
      const st = mkState(cw * i + cw / 2, ch * row + ch * 0.98 + 300, 'idle', yaw);
      st.t = 2.0;
      warm(g, L, st, sc, 'idle');
      cell(g, cw * i, ch * row, cw, ch);
      g.save(); g.beginPath(); g.rect(cw * i, ch * row, cw, ch); g.clip();
      drawCharacter(g, L, st, sc, 1 / 60);
      g.restore();
      label(g, name, cw * i + 6, ch * row + 16);
    }
  });
  save(c, 'renwu-close.png');
}

if (which === 'acts' || which === 'all') {
  const acts: [Action, number | undefined, number, string][] = [['idle', undefined, 0, '待机'], ['walk', undefined, 115, '行走'], ['run', undefined, 220, '奔跑'], ['fly', undefined, 260, '御剑'], ['sit', undefined, 0, '打坐'],
    ['cast', 0.5, 0, '剑指'], ['cast', 0.5, 0, '推掌'], ['cast', 0.5, 0, '掐诀'], ['cast', 0.5, 0, '托天'], ['cast', 0.15, 0, '发力瞬间'], ['gather', 0.5, 0, '采集'], ['hit', 0.22, 0, '受击']];
  const sc = 2.6, cw = 170, ch = 250;
  const looks: Look[] = [HANLI_LOOK, fem1];
  const c = createCanvas(cw * acts.length, ch * looks.length); const g = c.getContext('2d') as any;
  looks.forEach((L, row) => acts.forEach(([a, at, sp, name], i) => {
    const st = mkState(cw * i + cw / 2, ch * row + ch * 0.9, a, 0.62, sp);
    if (a === 'fly') st.lift = 8;
    if (a === 'cast') { st.castN = [0, 0, 0, 0, 0, 1, 2, 3, 4, 1][i] ?? 0; st.seed = 0; }
    warm(g, L, st, sc, a, at);
    cell(g, cw * i, ch * row, cw, ch);
    g.fillStyle = 'rgba(40,40,30,0.18)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 18 * sc, 5 * sc, 0, 0, Math.PI * 2); g.fill();
    if (at !== undefined) st.actionT = at - 1 / 60;
    st.update(1 / 60); drawCharacter(g, L, st, sc, 1 / 60);
    label(g, name, cw * i + 6, ch * row + 16);
  }));
  save(c, 'renwu-acts.png');
}

if (which === 'dirs' || which === 'all') {
  const sc = 2.2, cw = 140, ch = 210;
  const rows: [Look, Action, number][] = [[HANLI_LOOK, 'idle', 0], [HANLI_LOOK, 'walk', 115], [fem2, 'idle', 0], [fem2, 'walk', 110]];
  const c = createCanvas(cw * 8, ch * rows.length); const g = c.getContext('2d') as any;
  rows.forEach(([L, a, sp], row) => {
    for (let d = 0; d < 8; d++) {
      const st = mkState(cw * d + cw / 2, ch * row + ch * 0.9, a, d * Math.PI / 4, sp);
      warm(g, L, st, sc, a);
      cell(g, cw * d, ch * row, cw, ch);
      drawCharacter(g, L, st, sc, 1 / 60);
    }
  });
  save(c, 'renwu-dirs.png');
}

if (which === 'hands' || which === 'all') {
  const gs = Object.keys(GESTURES) as Gesture[];
  const cw = 150, ch = 170;
  const c = createCanvas(cw * 6, ch * 4); const g = c.getContext('2d') as any;
  gs.forEach((gn, i) => {
    for (const [row, palmSide] of [[0, false], [1, true]] as [number, boolean][]) {
      const x0 = cw * (i % 6), y0 = ch * (Math.floor(i / 6) * 2 + row);
      cell(g, x0, y0, cw, ch);
      const S = 13, cx = x0 + cw / 2, cy0 = y0 + ch * 0.82;
      const P = (q: any) => ({ x: cx + q.x * S, y: cy0 - q.y * S, z: q.z });
      const cam = (n: any) => n.z;
      const H = aimHandFrame({ x: 0, y: 0, z: 0 }, { x: 0.15, y: 1, z: 0 }, { x: 0.05, y: 0, z: palmSide ? 1 : -1 }, -1);
      drawHand({ g, P, cam, S, E: S, skin: '#f1d9bd', lw: 1.0 }, H, GESTURES[gn], 1);
      label(g, `${GESTURE_NAMES[gn]}${palmSide ? '·掌心' : '·手背'}`, x0 + 6, y0 + 16);
    }
  });
  save(c, 'renwu-hands.png');
}

if (which === 'outfits' || which === 'all') {
  const sc = 2.2, cw = 132, ch = 220;
  const c = createCanvas(cw * 8, ch * 2); const g = c.getContext('2d') as any;
  OUTFITS.forEach((o, i) => {
    const base = o.sex === 'f' ? fem2 : o.sex === 'u' && i % 2 ? knight : HANLI_LOOK;
    const L = applyOutfit({ ...base }, o.id, i % 3);
    const x = cw * (i % 8), y = ch * Math.floor(i / 8);
    const st = mkState(x + cw / 2, y + ch * 0.92, 'idle', 0.4);
    warm(g, L, st, sc, 'idle');
    cell(g, x, y, cw, ch);
    drawCharacter(g, L, st, sc, 1 / 60);
    label(g, o.name, x + 6, y + 16);
  });
  save(c, 'renwu-outfits.png');
}

if (which === 'crowd' || which === 'all') {
  const sc = 1.12 * 1.6, cw = 74, ch = 150;
  const roles = ['cultivator', 'female', 'scholar', 'farmer', 'merchant', 'female', 'elder', 'guard', 'monk', 'female', 'cultivator', 'female'] as const;
  const c = createCanvas(cw * roles.length, ch * 2); const g = c.getContext('2d') as any;
  cell(g, 0, 0, c.width, c.height);
  roles.forEach((r, i) => {
    for (const row of [0, 1]) {
      const L = randomLook(mulberry32(100 + i * 7 + row * 1000), r);
      const st = mkState(cw * i + cw / 2, ch * row + ch * 0.9, row ? 'walk' : 'idle', row ? 0.8 : 0.3, row ? 110 : 0);
      warm(g, L, st, sc, row ? 'walk' : 'idle');
      g.fillStyle = 'rgba(40,40,30,0.2)'; g.beginPath(); g.ellipse(st.x, st.y + 2, 12 * sc, 3.5 * sc, 0, 0, Math.PI * 2); g.fill();
      drawCharacter(g, L, st, sc, 1 / 60);
    }
  });
  save(c, 'renwu-crowd.png');
}
