// 战斗绘制：敌人、召唤物、掉落、弹道、法术特效、血条与伤害数字
import type { Combat, Enemy } from './combat';
import type { Drawable } from './life';
import type { Fx } from '../data/arts';
import { drawBeast, BeastLook } from '../gfx/beast';
import { drawCharacter } from '../gfx/character';
import { itemDef, TIER_COLORS } from '../data/items';
import { mulberry32 } from '../core/rng';
import { QUHUN_LOOK } from '../data/storylooks';
import { artLook } from '../data/artlooks';
import { drawArt } from '../gfx/artifact';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const SUMMON_LOOK: Record<string, BeastLook> = {
  fox: { body: 'fox', color: [246, 242, 236], belly: [255, 255, 255], size: 0.85, tails: 3, eye: 'rgba(120,200,255,0.9)', glow: '200,230,255' },
  puppet: { body: 'wolf', color: [150, 130, 100], belly: [180, 160, 130], size: 1.1, eye: 'rgba(120,255,200,0.9)', spikes: true, accent: [90, 80, 70] },
  tihun: { body: 'fox', color: [190, 160, 230], belly: [240, 230, 255], size: 1.1, eye: 'rgba(255,240,140,0.95)', glow: '200,160,255', horn: true },
  demon: { body: 'ghost', color: [200, 50, 60], size: 0.8, eye: 'rgba(255,220,60,0.95)' },
  jiao: { body: 'jiao', color: [60, 150, 120], belly: [190, 230, 200], accent: [220, 240, 200], size: 1.1, glow: '120,240,180' },
};

export function enemyVis(c: Combat, e: { x: number; y: number }) {
  const s = c.game.life.sense;
  return clamp((s.R - Math.hypot(e.x - s.x, e.y - s.y)) / 110, 0, 1);
}

/** 收集需 Y 排序的战斗实体 */
export function collectCombat(c: Combat, out: Drawable[], view: { left: number; top: number; right: number; bottom: number }, t: number, dt: number) {
  for (const e of c.enemies) {
    if (e.x < view.left - 200 || e.x > view.right + 200 || e.y < view.top - 100 || e.y > view.bottom + 260) continue;
    const a = enemyVis(c, e);
    if (a <= 0.01) continue;
    out.push({ y: e.y, draw: (g) => drawEnemy(g, c, e, a, t, dt) });
  }
  for (const s of c.summons) {
    if (s.kind === 'bugs') continue;
    if (s.kind === 'quhun' && s.cs) { const cs = s.cs; out.push({ y: s.y, draw: (g) => { g.save(); g.globalAlpha *= Math.min(1, s.t * 2); drawCharacter(g, QUHUN_LOOK, cs, 1.12, 0); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(120,255,170,0.5)'; g.beginPath(); g.arc(s.x, s.y - 150, 3, 0, Math.PI * 2); g.fill(); g.restore(); } }); continue; }
    out.push({ y: s.y, draw: (g) => { drawBeast(g, SUMMON_LOOK[s.kind] ?? SUMMON_LOOK.fox, s.x, s.y, s.facing, { move: 1, phase: s.phase, atk: s.cd > 0.7 ? 1 - (s.cd - 0.7) / 0.4 : 0, hit: 0, t: s.phase / 8, flying: s.kind === 'demon' }, 1); } });
  }
  for (const l of c.loot) {
    const a = enemyVis(c, l);
    if (a <= 0.01) continue;
    out.push({ y: l.y, draw: (g) => drawLoot(g, l, t, a) });
  }
  c.acts.collect(out);
  if (c.shield?.art) {   // 法器盾：实体悬浮
    const s = c.shield, sp = c.shieldPos(), L = artLook(s.art!), k = s.amt / s.max;
    out.push({ y: sp.front ? sp.y + 20 : sp.y - 40, draw: (g) => {
      g.save(); g.fillStyle = 'rgba(20,16,10,0.16)'; g.beginPath(); g.ellipse(sp.x, sp.y + 4, 16, 5, 0, 0, TAU); g.fill(); g.restore();
      drawArt(g, L, sp.x, sp.y - sp.h, 52 + c.blockT * 10, Math.cos(c.shieldAng) * 0.25 + Math.sin(t * 1.6) * 0.04, 0.55 + 0.45 * k);
    } });
  }
  if (c.decoy) {
    const d = c.decoy, p = c.game.player;
    out.push({ y: d.y, draw: (g) => { g.save(); g.globalAlpha = 0.6 + 0.2 * Math.sin(t * 6); const st = p.st; const ox = st.x, oy = st.y; st.x = d.x; st.y = d.y; drawCharacter(g, p.look, st, 1.12, 0); st.x = ox; st.y = oy; g.restore(); } });
  }
}

function drawEnemy(g: G, c: Combat, e: Enemy, alpha: number, t: number, dt: number) {
  g.save();
  g.globalAlpha *= alpha * (e.dead ? Math.max(0, 1 - e.deathT / 0.8) : 1);
  if (e.dead) { g.translate(e.x, e.y); g.scale(1 + e.deathT * 0.3, 1 - e.deathT * 0.6); g.translate(-e.x, -e.y); }
  // 锁定标记
  if (c.lock === e && !e.dead) {
    g.strokeStyle = 'rgba(200,50,40,0.85)'; g.lineWidth = 2.5;
    const r = 34 + Math.sin(t * 6) * 3;
    g.beginPath(); g.ellipse(e.x, e.y + 2, r * 1.3, r * 0.45, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * Math.PI / 2; g.beginPath(); g.ellipse(e.x, e.y + 2, r * 1.6, r * 0.6, 0, a, a + 0.4); g.stroke(); }
  }
  // 窥破蓄力：红色警示
  if (e.windup > 0) { g.fillStyle = `rgba(220,40,30,${0.25 * (1 - e.windup / 0.4)})`; g.beginPath(); g.ellipse(e.x, e.y, 70, 26, 0, 0, TAU); g.fill(); }
  if (e.look && e.cs) {
    g.fillStyle = 'rgba(30,30,24,0.26)'; g.beginPath(); g.ellipse(e.x, e.y + 2, 22, 7, 0, 0, TAU); g.fill();
    drawCharacter(g, e.look, e.cs, 1.06, e.dead ? 0 : dt);
    // 魔修血光
    if (e.def.evil) { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(e.x, e.y - 50, 0, e.x, e.y - 50, 70); gr.addColorStop(0, 'rgba(200,30,40,0.18)'); gr.addColorStop(1, 'rgba(200,30,40,0)'); g.fillStyle = gr; g.fillRect(e.x - 70, e.y - 120, 140, 140); }
  } else if (e.def.look) {
    drawBeast(g, e.def.look, e.x, e.y, e.facing, e.anim, 1);
  }
  // 异状表现
  if (e.st.freeze) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(190,230,255,0.45)'; g.strokeStyle = 'rgba(240,250,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); const h = e.anim.flying ? 110 : 70; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(e.x + Math.cos(a) * 42, e.y - h / 2 + Math.sin(a) * h * 0.6); } g.closePath(); g.fill(); g.stroke(); }
  if (e.st.burn && Math.random() < 0.5) c.sparks.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y - Math.random() * 60, vx: 0, vy: -60, t: 0, max: 0.5, size: 4, color: '255,130,40' });
  if (e.st.poison && Math.random() < 0.3) c.sparks.push({ x: e.x + (Math.random() - 0.5) * 40, y: e.y - Math.random() * 50, vx: 0, vy: -30, t: 0, max: 0.7, size: 3, color: '140,210,60' });
  if (e.st.root) { g.strokeStyle = 'rgba(90,150,60,0.9)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = i * 1.6 + t; g.beginPath(); g.moveTo(e.x + Math.cos(a) * 30, e.y + 4); g.quadraticCurveTo(e.x + Math.cos(a + 1) * 10, e.y - 30, e.x + Math.cos(a + 2) * 20, e.y - 46); g.stroke(); } }
  if (e.st.shock || e.st.stun) { g.strokeStyle = e.st.shock ? 'rgba(200,210,255,0.9)' : 'rgba(255,230,120,0.9)'; g.lineWidth = 1.5; const hy = e.y - (e.anim.flying ? 130 : 90); for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3; g.beginPath(); g.arc(e.x + Math.cos(a) * 16, hy + Math.sin(a) * 5, 3, 0, TAU); g.stroke(); } }
  g.restore();
}

function drawLoot(g: G, l: { x: number; y: number; id: string; n: number; t: number }, t: number, a: number) {
  const d = itemDef(l.id);
  const col = TIER_COLORS[d.tier] ?? '#888';
  const bob = Math.sin(t * 3 + l.x) * 4 - Math.max(0, 1 - l.t * 3) * 30;
  g.save(); g.globalAlpha *= a;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(l.x, l.y - 14 + bob, 0, l.x, l.y - 14 + bob, 34);
  const rare = d.type === 'scroll' || d.type === 'artifact';
  gr.addColorStop(0, rare ? 'rgba(255,220,120,0.6)' : 'rgba(200,255,220,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(l.x - 34, l.y - 48 + bob, 68, 68);
  if (rare) { g.strokeStyle = 'rgba(255,230,150,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(l.x, l.y - 14 + bob); g.lineTo(l.x, l.y - 90 - Math.sin(t * 2) * 10); g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(250,244,228,0.95)'; g.strokeStyle = col; g.lineWidth = 2;
  g.beginPath(); g.arc(l.x, l.y - 14 + bob, 12, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = col; g.font = 'bold 14px "Noto Serif SC","Songti SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(d.glyph, l.x, l.y - 13 + bob);
  g.restore();
}

// ------------------------------------------------------------------ 特效层（发光）
function jag(g: G, x1: number, y1: number, x2: number, y2: number, seed: number, amp: number, segs = 9) {
  const rnd = mulberry32(seed | 0);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  g.beginPath(); g.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) { const u = i / segs, o = (rnd() - 0.5) * amp * Math.sin(u * Math.PI) * 2; g.lineTo(x1 + dx * u + nx * o, y1 + dy * u + ny * o); }
  g.lineTo(x2, y2);
}
function glowDot(g: G, x: number, y: number, r: number, color: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,255,245,${a})`); gr.addColorStop(0.3, `rgba(${color},${0.8 * a})`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawProj(g: G, pr: any, t: number) {
  const ang = Math.atan2(pr.vy, pr.vx), s = pr.size ?? 1, col = pr.color as string, fx = pr.fx as Fx;
  const tr = pr.trail as [number, number][];
  const trail = (w: number, a: number) => { if (tr.length < 2) return; for (let i = 1; i < tr.length; i++) { const k = i / tr.length; g.strokeStyle = `rgba(${col},${a * k})`; g.lineWidth = w * k; g.beginPath(); g.moveTo(tr[i - 1][0], tr[i - 1][1]); g.lineTo(tr[i][0], tr[i][1]); g.stroke(); } };
  g.lineCap = 'round';
  switch (fx) {
    case 'fireball': case 'talisman': case 'blood': case 'gold':
      trail(14 * s, 0.5);
      glowDot(g, pr.x, pr.y, 26 * s, col);
      if (fx === 'talisman' && pr.life < 0.12) { g.fillStyle = '#f0d070'; g.fillRect(pr.x - 7, pr.y - 11, 14, 22); }
      break;
    case 'firesnake': case 'dragon': {
      const w = fx === 'dragon' ? 26 : 12;
      for (let i = 1; i < tr.length; i++) { const k = i / tr.length; const wob = Math.sin(t * 14 - i * 0.9) * 6 * k; g.strokeStyle = `rgba(${col},${0.85 * k})`; g.lineWidth = w * s * (0.4 + k); g.beginPath(); g.moveTo(tr[i - 1][0], tr[i - 1][1] + wob); g.lineTo(tr[i][0], tr[i][1] + wob); g.stroke(); }
      glowDot(g, pr.x, pr.y, (fx === 'dragon' ? 44 : 22) * s, col);
      if (fx === 'dragon') { g.strokeStyle = `rgba(230,255,240,0.8)`; g.lineWidth = 2; g.beginPath(); g.moveTo(pr.x, pr.y - 10); g.lineTo(pr.x - Math.cos(ang) * 30 - 10, pr.y - 34); g.moveTo(pr.x, pr.y - 6); g.lineTo(pr.x - Math.cos(ang) * 30 + 6, pr.y - 36); g.stroke(); }
      break;
    }
    case 'crow': {
      trail(8, 0.4);
      g.save(); g.translate(pr.x, pr.y); g.rotate(ang);
      const f = Math.sin(t * 20 + pr.x) * 8;
      g.fillStyle = `rgba(${col},0.9)`; g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -12 - f); g.lineTo(-2, 0); g.lineTo(-6, 12 + f); g.closePath(); g.fill();
      g.restore(); glowDot(g, pr.x, pr.y, 18, col, 0.7);
      break;
    }
    case 'icicle': case 'needle': case 'mind': case 'sword': case 'leaf': case 'goldthunder': {
      const L = fx === 'needle' ? 22 : fx === 'sword' ? 46 * s : fx === 'mind' ? 30 : 30 * s;
      trail(fx === 'needle' ? 2 : 6 * s, fx === 'mind' ? 0.25 : 0.45);
      g.save(); g.translate(pr.x, pr.y); g.rotate(ang);
      if (fx === 'sword') {
        g.fillStyle = `rgba(${col},0.95)`; g.beginPath(); g.moveTo(L * 0.6, 0); g.lineTo(-L * 0.3, -4); g.lineTo(-L * 0.3, 4); g.closePath(); g.fill();
        g.fillStyle = '#d8c070'; g.fillRect(-L * 0.36, -7, 4, 14); g.fillStyle = `rgba(${col},0.7)`; g.fillRect(-L * 0.5, -2, L * 0.14, 4);
      } else if (fx === 'leaf') {
        g.fillStyle = `rgba(${col},0.95)`; g.beginPath(); g.ellipse(0, 0, L * 0.5, 6, 0, 0, TAU); g.fill();
      } else if (fx === 'mind') {
        g.strokeStyle = `rgba(${col},0.55)`; g.lineWidth = 2; g.beginPath(); g.moveTo(L * 0.5, 0); g.lineTo(-L * 0.5, -6); g.moveTo(L * 0.5, 0); g.lineTo(-L * 0.5, 6); g.stroke();
      } else {
        g.fillStyle = fx === 'goldthunder' ? 'rgba(255,240,170,0.95)' : 'rgba(235,248,255,0.95)'; g.beginPath(); g.moveTo(L * 0.5, 0); g.lineTo(-L * 0.5, -(fx === 'needle' ? 1.5 : 5)); g.lineTo(-L * 0.5, fx === 'needle' ? 1.5 : 5); g.closePath(); g.fill();
      }
      g.restore();
      glowDot(g, pr.x, pr.y, (fx === 'needle' ? 10 : 20) * s, col, fx === 'mind' ? 0.4 : 0.8);
      break;
    }
    case 'wind': {
      g.save(); g.translate(pr.x, pr.y); g.rotate(ang);
      for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(${col},${0.8 - i * 0.25})`; g.lineWidth = (5 - i) * s; g.beginPath(); g.arc(-i * 10, 0, 24 * s, -1.1, 1.1); g.stroke(); }
      g.restore();
      break;
    }
    case 'tornado': case 'water': {
      const h = fx === 'water' ? 90 : 110;
      for (let i = 0; i < 8; i++) { const k = i / 8; const r = (14 + k * 34) * s; g.strokeStyle = `rgba(${col},${0.6 - k * 0.3})`; g.lineWidth = 3; g.beginPath(); g.ellipse(pr.x + Math.sin(t * 8 + i) * 6, pr.y + 30 - k * h, r, r * 0.3, 0, t * 6 + i, t * 6 + i + 4.5); g.stroke(); }
      break;
    }
    case 'vine': {
      trail(4, 0.8);
      g.strokeStyle = `rgba(${col},0.95)`; g.lineWidth = 3;
      for (let i = 1; i < tr.length; i++) { const wob = Math.sin(i * 1.4 + t * 10) * 5; g.beginPath(); g.moveTo(tr[i - 1][0], tr[i - 1][1] + wob); g.lineTo(tr[i][0], tr[i][1] - wob); g.stroke(); }
      glowDot(g, pr.x, pr.y, 16, col, 0.6);
      break;
    }
    case 'ghost': {
      trail(12, 0.4);
      glowDot(g, pr.x, pr.y, 22, col, 0.8);
      g.fillStyle = 'rgba(20,20,30,0.6)'; g.beginPath(); g.arc(pr.x - 4, pr.y - 2, 2.2, 0, TAU); g.arc(pr.x + 4, pr.y - 2, 2.2, 0, TAU); g.fill();
      break;
    }
    case 'rock': { g.fillStyle = 'rgba(150,120,80,0.95)'; g.beginPath(); g.arc(pr.x, pr.y, 12 * s, 0, TAU); g.fill(); break; }
    case 'flame': case 'icefire': default:
      trail(16 * s, 0.5);
      glowDot(g, pr.x, pr.y, 30 * s, col);
  }
}

function drawField(g: G, f: any, t: number) {
  const k = clamp(f.t / 0.3, 0, 1) * clamp((f.dur - f.t) / 0.4, 0, 1);
  const col = f.color as string;
  g.save();
  g.translate(f.x, f.y);
  g.scale(1, 0.55);
  switch (f.fx as Fx) {
    case 'flame': {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r);
      gr.addColorStop(0, `rgba(255,200,120,${0.5 * k})`); gr.addColorStop(0.6, `rgba(${col},${0.35 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.fill();
      g.scale(1, 1 / 0.55);
      for (let i = 0; i < 14; i++) { const a = t * 2.4 + i * 0.45, r = f.r * (0.2 + 0.8 * ((i * 0.37 + t * 0.7) % 1)); const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.55; const h = 40 + 30 * Math.sin(t * 9 + i); g.fillStyle = `rgba(255,${150 + (i % 3) * 30},60,${0.55 * k})`; g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x - 4, y - h * 0.6, x, y - h); g.quadraticCurveTo(x + 4, y - h * 0.6, x + 10, y); g.fill(); }
      break;
    }
    case 'lightning': {
      g.strokeStyle = `rgba(${col},${0.7 * k})`; g.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * f.r, Math.sin(a) * f.r); g.stroke(); }
      for (const rr of [0.4, 0.7, 1]) { g.beginPath(); g.arc(0, 0, f.r * rr, 0, TAU); g.stroke(); }
      g.scale(1, 1 / 0.55);
      if (Math.random() < 0.5) { const a = Math.random() * TAU, r = Math.random() * f.r; g.strokeStyle = `rgba(230,240,255,${0.9 * k})`; jag(g, 0, 0, Math.cos(a) * r, Math.sin(a) * r * 0.55, Math.random() * 1e6, 18); g.stroke(); }
      break;
    }
    case 'rock': {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r);
      gr.addColorStop(0, `rgba(160,120,70,${0.5 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.fill();
      g.strokeStyle = `rgba(120,90,50,${0.6 * k})`; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, f.r * (0.3 + i * 0.25), t * (i + 1), t * (i + 1) + 4); g.stroke(); }
      break;
    }
    case 'sword': case 'star': {
      g.strokeStyle = `rgba(${col},${0.7 * k})`; g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.4; g.beginPath(); g.moveTo(Math.cos(a) * f.r * 0.9, Math.sin(a) * f.r * 0.9); g.lineTo(Math.cos(a) * f.r * 1.05, Math.sin(a) * f.r * 1.05); g.stroke(); }
      g.scale(1, 1 / 0.55);
      // 剑丝如雨
      for (let i = 0; i < 18; i++) {
        const ph = (t * 2.5 + i * 0.37) % 1;
        const x = Math.sin(i * 12.9898) * f.r * 0.85, y = Math.cos(i * 78.233) * f.r * 0.45;
        const yy = y - 260 * (1 - ph);
        g.strokeStyle = `rgba(${col},${0.9 * k * (1 - ph * 0.3)})`; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x, yy - 40); g.lineTo(x, yy); g.stroke();
        if (ph > 0.9) glowDot(g, x, y, 16, col, k);
      }
      if (f.fx === 'star') for (let i = 0; i < 20; i++) glowDot(g, Math.sin(i * 3.1 + t * 0.3) * f.r, Math.cos(i * 1.7 + t * 0.2) * f.r * 0.5, 6 + 4 * Math.sin(t * 3 + i), col, k);
      break;
    }
    case 'array': {
      g.strokeStyle = `rgba(${col},${0.8 * k})`; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, f.r * 0.82, 0, TAU); g.stroke();
      g.save(); g.rotate(t * 0.5);
      g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; const x = Math.cos(a) * f.r * 0.82, y = Math.sin(a) * f.r * 0.82; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      g.beginPath(); for (let i = 0; i <= 5; i++) { const a = (i * 2 / 5) * TAU; const x = Math.cos(a) * f.r * 0.6, y = Math.sin(a) * f.r * 0.6; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      g.restore();
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r); gr.addColorStop(0, `rgba(${col},${0.12 * k})`); gr.addColorStop(1, `rgba(${col},${0.25 * k})`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.fill();
      // 阵旗
      g.scale(1, 1 / 0.55);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; const x = Math.cos(a) * f.r * 0.95, y = Math.sin(a) * f.r * 0.52; g.strokeStyle = `rgba(80,60,40,${k})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40); g.stroke(); g.fillStyle = `rgba(${col},${0.9 * k})`; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 16 + Math.sin(t * 5 + i) * 3, y - 34); g.lineTo(x, y - 28); g.fill(); }
      break;
    }
    case 'none': {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r); gr.addColorStop(0, `rgba(${col},${0.35 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.fill();
      break;
    }
    default: {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, f.r); gr.addColorStop(0, `rgba(${col},${0.15 * k})`); gr.addColorStop(1, `rgba(${col},${0.4 * k})`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.fill();
    }
  }
  g.restore();
}

function drawVfx(g: G, v: any, t: number) {
  const u = clamp(v.t / v.dur, 0, 1), a = 1 - u, col = v.color as string;
  switch (v.kind) {
    case 'ring': {
      const r = v.r * (0.3 + 0.7 * (1 - Math.pow(1 - u, 2.5)));
      g.save(); g.translate(v.x, v.y); g.scale(1, 0.55);
      const gr = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.8, `rgba(${col},${0.55 * a})`); gr.addColorStop(1, `rgba(255,255,255,${0.6 * a})`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      if (v.fx === 'roar') for (let i = 1; i < 3; i++) { g.strokeStyle = `rgba(${col},${0.5 * a})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * (1 - i * 0.22), 0, TAU); g.stroke(); }
      g.restore();
      break;
    }
    case 'flash': glowDot(g, v.x, v.y, v.r * (0.6 + u * 0.6), col, a); break;
    case 'warn': {
      if (v.t < 0) break;
      g.save(); g.translate(v.x, v.y); g.scale(1, 0.55);
      g.strokeStyle = `rgba(${col},${0.8})`; g.lineWidth = 2; g.setLineDash([10, 8]);
      g.beginPath(); g.arc(0, 0, v.r, 0, TAU); g.stroke(); g.setLineDash([]);
      g.fillStyle = `rgba(${col},${0.25 * u})`; g.beginPath(); g.arc(0, 0, v.r * u, 0, TAU); g.fill();
      g.restore();
      break;
    }
    case 'strike': {
      const fx = v.fx as Fx;
      if (fx === 'lightning' || fx === 'goldthunder') {
        g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 6 * a + 1; jag(g, v.x + 30, v.y - 700, v.x, v.y, v.seed, 70, 12); g.stroke();
        g.strokeStyle = `rgba(${col},${0.8 * a})`; g.lineWidth = 14 * a; jag(g, v.x + 30, v.y - 700, v.x, v.y, v.seed, 70, 12); g.stroke();
      } else if (fx === 'flame') {
        glowDot(g, v.x, v.y - 300 * (1 - u), v.r * 0.8, col, a);
      } else if (fx === 'frost') {
        g.save(); g.translate(v.x, v.y); g.fillStyle = `rgba(200,235,255,${0.7 * a})`; g.strokeStyle = `rgba(255,255,255,${a})`;
        for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + v.seed, r = v.r * 0.7; const x = Math.cos(an) * r * 0.8, y = Math.sin(an) * r * 0.4; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x, y - 60 * (1 - u * 0.3)); g.lineTo(x + 10, y); g.closePath(); g.fill(); g.stroke(); }
        g.restore();
      } else if (fx === 'rock') {
        g.save(); g.translate(v.x, v.y);
        for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, r = v.r * 0.6; const x = Math.cos(an) * r, y = Math.sin(an) * r * 0.5; g.fillStyle = `rgba(140,110,70,${a})`; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x, y - 50 * Math.sin(u * Math.PI)); g.lineTo(x + 12, y); g.fill(); }
        g.restore();
      } else if (fx === 'gold') {
        g.save(); g.translate(v.x, v.y); g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = 4;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, v.r * (1 - u) * (1 - i * 0.25), v.r * 0.5 * (1 - u) * (1 - i * 0.25), u * 6 + i, 0, TAU); g.stroke(); }
        g.restore();
      }
      glowDot(g, v.x, v.y, v.r, col, a * 0.8);
      break;
    }
    case 'chain': {
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = (v.w ?? 2) * 0.6 + 0.5; jag(g, v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30), 24); g.stroke();
      g.strokeStyle = `rgba(${col},${0.8 * a})`; g.lineWidth = (v.w ?? 2) * 2.5; jag(g, v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30), 24); g.stroke();
      break;
    }
    case 'beam': {
      const w = v.r * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85 * 0.7);
      g.lineCap = 'round';
      if (v.fx === 'magnet') { const cols = ['255,90,90', '255,220,90', '120,220,120', '120,170,255', '230,230,240']; cols.forEach((c, i) => { g.strokeStyle = `rgba(${c},${0.55 * a})`; g.lineWidth = w * 0.5; g.beginPath(); const o = (i - 2) * w * 0.25; g.moveTo(v.x, v.y + o); g.lineTo(v.x2, v.y2 + o); g.stroke(); }); }
      else if (v.fx === 'rock') {
        const n = 10; for (let i = 1; i <= n; i++) { const k = i / n; if (k > u * 2.2) break; const x = v.x + (v.x2 - v.x) * k, y = v.y + 40 + (v.y2 + 30 - v.y - 40) * k; g.fillStyle = `rgba(150,115,70,${a})`; g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 2, y - 70 * Math.sin(Math.min(1, (u * 2.2 - k) * 3) * Math.PI * 0.5)); g.lineTo(x + 12, y); g.fill(); g.strokeStyle = `rgba(60,40,20,${0.6 * a})`; g.lineWidth = 1; g.stroke(); }
        break;
      }
      g.strokeStyle = `rgba(${col},${0.6 * a})`; g.lineWidth = w * 2; g.beginPath(); g.moveTo(v.x, v.y); g.lineTo(v.x2, v.y2); g.stroke();
      g.strokeStyle = `rgba(255,255,250,${0.9 * a})`; g.lineWidth = w * 0.6; g.beginPath(); g.moveTo(v.x, v.y); g.lineTo(v.x2, v.y2); g.stroke();
      if (v.fx === 'goldthunder' || v.fx === 'icefire') { g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = 2; jag(g, v.x, v.y, v.x2, v.y2, v.seed + Math.floor(v.t * 30), w * 1.5, 14); g.stroke(); }
      break;
    }
    case 'bigsword': {
      const drop = Math.min(1, u * 3);
      const ang = Math.atan2(v.y2 - v.y, v.x2 - v.x);
      const len = Math.hypot(v.x2 - v.x, v.y2 - v.y);
      g.save(); g.translate(v.x, v.y); g.rotate(ang);
      g.globalAlpha *= a;
      g.scale(1, 0.4 + 0.6 * drop);
      const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(${col},0.3)`); gr.addColorStop(0.5, `rgba(255,255,255,0.95)`); gr.addColorStop(1, `rgba(${col},0.8)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(40, -v.r * 0.6); g.lineTo(len, 0); g.lineTo(40, v.r * 0.6); g.closePath(); g.fill();
      g.fillStyle = '#e0c060'; g.fillRect(20, -v.r * 0.9, 16, v.r * 1.8);
      g.restore();
      break;
    }
    case 'cone': {
      g.save(); g.translate(v.x, v.y);
      const r = v.r * (0.4 + 0.6 * Math.min(1, u * 2.5));
      const gr = g.createRadialGradient(0, 0, 10, 0, 0, r);
      gr.addColorStop(0, `rgba(255,250,230,${0.8 * a})`); gr.addColorStop(0.5, `rgba(${col},${0.6 * a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, v.ang - v.spread, v.ang + v.spread); g.closePath(); g.fill();
      if (v.fx === 'sword') { g.strokeStyle = `rgba(230,255,245,${a})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r * 0.85, v.ang - v.spread, v.ang + v.spread); g.stroke(); }
      g.restore();
      break;
    }
    case 'aura': {
      g.save(); g.translate(v.x, v.y);
      for (let i = 0; i < 3; i++) { const k = (u + i / 3) % 1; g.strokeStyle = `rgba(${col},${0.6 * (1 - k) * a})`; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -k * 90, v.r * (1 - k * 0.4), v.r * 0.35 * (1 - k * 0.4), 0, 0, TAU); g.stroke(); }
      g.restore();
      break;
    }
    case 'blinkfx': {
      for (let i = 0; i < 2; i++) glowDot(g, v.x, v.y - 50, v.r * (1 + u), col, a * 0.7);
      break;
    }
  }
}

/** 发光特效层（夜色之后绘制，故夜里亦明亮） */
export function drawCombatFx(g: G, c: Combat, t: number) {
  const p = c.game.player;
  g.save();
  // 区域（地面，普通混合）
  for (const f of c.fields) drawField(g, f, t);
  g.globalCompositeOperation = 'lighter';
  for (const v of c.vfx) drawVfx(g, v, t);
  for (const pr of c.projs) drawProj(g, pr, t);
  // 噬金虫群
  for (const s of c.summons) if (s.kind === 'bugs' && s.dots) {
    for (const d of s.dots) { const a = d.a + t * d.s; const x = s.x + Math.cos(a) * d.r, y = s.y - 40 + Math.sin(a * 1.3) * d.r * 0.6; g.fillStyle = 'rgba(255,220,100,0.9)'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
    glowDot(g, s.x, s.y - 40, 40, '255,210,90', 0.35);
  }
  // 护体剑盾
  if (c.orbit) {
    const o = c.orbit;
    for (let i = 0; i < o.n; i++) {
      const an = t * 3.2 + (i / o.n) * TAU;
      const x = p.x + Math.cos(an) * o.r, y = p.y - 40 + Math.sin(an) * o.r * 0.5;
      g.save(); g.translate(x, y); g.rotate(an + Math.PI / 2);
      g.fillStyle = `rgba(${o.color},0.9)`; g.beginPath(); g.moveTo(0, -22); g.lineTo(-3, 10); g.lineTo(3, 10); g.closePath(); g.fill();
      g.restore();
      glowDot(g, x, y, 18, o.color, 0.6);
    }
  }
  // 护盾
  if (c.shield && !c.shield.art) {
    const s = c.shield, k = s.amt / s.max;
    g.save(); g.translate(p.x, p.y - 50);
    const gr = g.createRadialGradient(0, 0, 40, 0, 0, 72);
    gr.addColorStop(0, `rgba(${s.color},0)`); gr.addColorStop(0.85, `rgba(${s.color},${0.25 + 0.2 * k})`); gr.addColorStop(1, `rgba(255,255,255,${0.35 * k})`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 62, 76, 0, 0, TAU); g.fill();
    if (s.fx === 'frost' || s.fx === 'vine') { g.strokeStyle = `rgba(${s.color},${0.6})`; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.5; g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 36); g.lineTo(Math.cos(a) * 60, Math.sin(a) * 72); g.stroke(); } }
    g.restore();
  }
  // 增益光环
  const b = c.buffs;
  if (b.atk || b.def || b.speed) {
    const col = b.atk ? '255,200,90' : b.def ? '240,210,120' : '190,230,255';
    g.save(); g.translate(p.x, p.y);
    g.strokeStyle = `rgba(${col},0.5)`; g.lineWidth = 2;
    for (let i = 0; i < 2; i++) { const k = (t * 0.8 + i * 0.5) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(0, -k * 100, 40, 12, 0, 0, TAU); g.stroke(); }
    g.restore();
  }
  // 火花
  for (const s of c.sparks) { const k = 1 - s.t / s.max; g.fillStyle = `rgba(${s.color},${0.7 * k})`; g.beginPath(); g.arc(s.x, s.y, s.size * k + 0.5, 0, TAU); g.fill(); }
  g.restore();
}

/** 血条、名牌、伤害数字（世界坐标，最上层） */
export function drawCombatUI(g: G, c: Combat, t: number, z: number) {
  const h = c.game.hero;
  const k = 1 / Math.max(0.45, z);
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const e of c.enemies) {
    if (e.dead) continue;
    const a = enemyVis(c, e);
    if (a <= 0.05) continue;
    if (!e.aggro && e.hp >= e.maxHp && c.lock !== e) {
      // 未交战：仅显示名牌（悬停般淡）
    }
    g.globalAlpha = a;
    const top = e.y - (e.def.kind === 'human' ? 150 : e.anim.flying ? 150 : 100) * (e.def.look?.size ?? 1);
    const w = 70 * k, hh = 6 * k;
    // 强弱颜色
    const gap = e.level - (h.realm * 13 + h.stage);
    const col = gap <= -5 ? '#8ab07a' : gap < 3 ? '#e8d8a8' : gap < 13 ? '#e08a4a' : '#d03838';
    g.font = `${12 * k}px "Noto Serif SC","Songti SC",serif`;
    g.fillStyle = 'rgba(20,16,12,0.65)';
    const label = `${e.name}·${e.rankText}`;
    const tw = g.measureText(label).width + 10 * k;
    g.fillRect(e.x - tw / 2, top - 18 * k, tw, 15 * k);
    g.fillStyle = col; g.fillText(label, e.x, top - 10.5 * k);
    if (e.aggro || e.hp < e.maxHp) {
      g.fillStyle = 'rgba(20,16,12,0.7)'; g.fillRect(e.x - w / 2 - 1, top - 1, w + 2, hh + 2);
      g.fillStyle = '#a82a22'; g.fillRect(e.x - w / 2, top, w * clamp(e.hp / e.maxHp, 0, 1), hh);
      // 异状图标
      let ix = e.x - w / 2;
      for (const s in e.st) { g.fillStyle = ({ burn: '#ff7a3a', freeze: '#9ad8ff', shock: '#b8c4ff', poison: '#7ac04a', root: '#6ab05a', break: '#e0b040', slow: '#90b0d0', stun: '#f0e080' } as Record<string, string>)[s] ?? '#fff'; g.fillRect(ix, top + hh + 2 * k, 6 * k, 3 * k); ix += 8 * k; }
    }
  }
  g.globalAlpha = 1;
  for (const x of c.texts) {
    const a = x.t < 0.8 ? 1 : 1 - (x.t - 0.8) / 0.3;
    const sc = x.big ? 1.35 : 1;
    const pop = x.t < 0.1 ? 1 + (0.1 - x.t) * 4 : 1;
    g.globalAlpha = a;
    g.font = `bold ${16 * k * sc * pop}px "Noto Serif SC","Songti SC",serif`;
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(30,20,14,0.8)';
    g.strokeText(x.s, x.x, x.y); g.fillStyle = x.color; g.fillText(x.s, x.x, x.y);
  }
  g.restore();
}
