// 第四十五步：结婴天象——碎丹成婴的全屏过场（结丹、化神共用一套演出，结婴最隆重）
// 画面实时绘制：背景画材 + 漩涡云海、五行灵气倒灌、天雷、金丹龟裂与碎片、冲击波、元婴、霞光光柱、祥云、花雨、仙鹤；
// 文字用 DOM 书法字。Esc / 空格 / 「跳过」可略过。
import { useEffect, useRef, useState } from 'react';
import type { AscendInfo } from '../world/game';
import { audio } from '../world/audio';
import bgUrl from '../assets/fx/jy_bg.webp?inline';
import soulUrl from '../assets/fx/jy_soul.webp?inline';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

interface TL { storm: number; core: number; shatter: number; soul: number; sky: number; end: number }
interface Beat { at: number; title: string; sub?: string; cls?: string }

function timeline(a: AscendInfo): TL {
  if (a.kind === 'jiedan') return a.ok ? { storm: 2.4, core: 7.2, shatter: 10.6, soul: 99, sky: 11.4, end: 17 } : { storm: 2.4, core: 7.2, shatter: 10.6, soul: 99, sky: 99, end: 14.5 };
  return a.ok ? { storm: 2.8, core: 9.0, shatter: 12.6, soul: 13.2, sky: 18.8, end: 27 } : { storm: 2.8, core: 9.0, shatter: 12.6, soul: 99, sky: 99, end: 18.5 };
}

function beats(a: AscendInfo, T: TL): Beat[] {
  const n = a.name, age = a.age;
  if (a.kind === 'jiedan') return a.ok ? [
    { at: 0.3, title: '凝液成丹', sub: `${n} · ${age} 岁 · 筑基大圆满 · ${a.place}` },
    { at: T.storm + 0.2, title: '灵气汇聚', sub: '周身法力化作灵液，缓缓凝缩' },
    { at: T.core + 0.2, title: '金丹将成', sub: '灵液旋转、收束，凝成一粒浑圆的金丹' },
    { at: T.sky, title: a.realm, sub: `寿元 ${a.life} 载 · 金丹大道，自此始矣`, cls: 'final' },
  ] : [
    { at: 0.3, title: '凝液成丹', sub: `${n} · ${age} 岁 · 筑基大圆满` },
    { at: T.storm + 0.2, title: '灵气汇聚', sub: '周身法力化作灵液，缓缓凝缩' },
    { at: T.shatter + 0.1, title: '结丹失败', sub: '灵液溃散，经脉受创……', cls: 'fail' },
  ];
  const hs = a.kind === 'huashen';
  const head: Beat[] = [
    { at: 0.3, title: hs ? '元婴化神' : '碎丹成婴', sub: `${n} · ${age} 岁 · ${hs ? '元婴大圆满' : '结丹大圆满'} · ${a.place}` },
    { at: T.storm + 0.2, title: '风云变色', sub: hs ? '天地元气倒灌，人界为之一震' : '方圆百里灵气倒灌，天地异象骤生' },
    { at: T.core + 0.2, title: hs ? '元婴蜕变' : '金丹碎', sub: hs ? '元婴在烈光中寸寸蜕去旧壳……' : '苦修百年的金丹，寸寸龟裂……' },
  ];
  if (!a.ok) return [...head, { at: T.shatter + 0.3, title: hs ? '化神失败' : '结婴失败', sub: hs ? '元神未凝，元婴受创……' : '金丹已碎，元婴未成，灵力四散……', cls: 'fail' }];
  return [...head,
    { at: T.soul + 0.3, title: hs ? '元神出窍' : '元婴生', sub: hs ? '一尊元神法相，于虚空中缓缓睁眼' : '一个寸许高的小人，在丹田中睁开了眼睛' },
    { at: T.sky, title: a.realm, sub: `寿元 ${a.life} 载 · 霞光万道，百里可见`, cls: 'final' },
  ];
}

// —— 预渲染的光点 / 云团
function glowSprite(col: string, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, col); gr.addColorStop(0.5, col.replace(/[\d.]+\)$/, '0.25)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
function puffSprite(rgb: string, a: number, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!;
  for (let i = 0; i < 7; i++) {
    const x = size / 2 + rnd(-18, 18), y = size / 2 + rnd(-10, 10), r = rnd(26, 46);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return c;
}
function bolt(x0: number, y0: number, x1: number, y1: number, d: number, out: [number, number][][]) {
  const pts: [number, number][] = [[x0, y0], [x1, y1]];
  let k = Math.hypot(x1 - x0, y1 - y0) * 0.22;
  for (let it = 0; it < d; it++) {
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i - 1], b = pts[i];
      const m: [number, number] = [(a[0] + b[0]) / 2 + rnd(-k, k), (a[1] + b[1]) / 2 + rnd(-k, k) * 0.5];
      pts.splice(i, 0, m);
      if (it < 3 && Math.random() < 0.12) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); bolt(m[0], m[1], m[0] + rnd(-L, L), m[1] + rnd(L * 0.3, L), d - it - 2, out); }
    }
    k *= 0.55;
  }
  out.push(pts);
}

const WUXING = ['rgba(255,214,110,0.95)', 'rgba(125,255,160,0.9)', 'rgba(120,200,255,0.95)', 'rgba(255,128,92,0.9)', 'rgba(236,196,128,0.9)', 'rgba(205,160,255,0.95)', 'rgba(255,255,255,0.95)'];

export function Ascension({ info, onDone }: { info: AscendInfo; onDone: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [beat, setBeat] = useState<Beat & { k: number } | null>(null);
  const [skip, setSkip] = useState(false);
  const done = useRef(false);
  const skipAt = useRef(-1);
  const skipRef = useRef<() => void>(() => { /* */ });

  useEffect(() => {
    const canvas = cv.current!; const ctx = canvas.getContext('2d')!;
    const T = timeline(info), BEATS = beats(info, T);
    const jy = info.kind !== 'jiedan', hs = info.kind === 'huashen', ok = info.ok;
    let W = 0, H = 0, dpr = 1;
    const resize = () => { dpr = Math.min(1.5, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
    resize(); window.addEventListener('resize', resize);
    const bg = new Image(); bg.src = bgUrl; const soul = new Image(); soul.src = soulUrl;
    const GL = WUXING.map((c) => glowSprite(c));
    const GOLD = glowSprite('rgba(255,200,90,0.95)', 128), RED = glowSprite('rgba(255,60,40,0.95)', 128), VIO = glowSprite('rgba(190,130,255,0.95)', 128);
    const DARK = puffSprite('18,16,34', 0.55), DARK2 = puffSprite('40,34,70', 0.45);
    const CPUFF = ['255,190,215', '255,226,150', '160,230,255', '210,180,255', '255,255,255'].map((c) => puffSprite(c, 0.5));
    // 漩涡云团
    const vortex = Array.from({ length: 230 }, () => { const r = Math.pow(Math.random(), 0.7) * 0.75 + 0.03; return { r, a: rnd(0, TAU), s: rnd(0.08, 0.2) * (0.6 + r), k: Math.random() < 0.35 ? 1 : 0 }; });
    interface Pt { x: number; y: number; px: number; py: number; r: number; th: number; sp: number; c: number; s: number }
    const streams: Pt[] = [];
    const bolts: { pts: [number, number][][]; life: number }[] = [];
    interface Shard { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; a: number; pull: number }
    const shards: Shard[] = [];
    const cracks: [number, number][][] = [];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * TAU + rnd(-0.2, 0.2); let x = Math.cos(a0), y = Math.sin(a0); const pts: [number, number][] = [[x, y]];
      let ang = a0 + Math.PI + rnd(-0.5, 0.5); const n = 7 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) { ang += rnd(-0.6, 0.6); x += Math.cos(ang) * 0.11; y += Math.sin(ang) * 0.11; if (x * x + y * y > 1) break; pts.push([x, y]); }
      cracks.push(pts);
    }
    const petals = Array.from({ length: 150 }, () => ({ x: rnd(0, 1), y: rnd(-1.2, 0), vy: rnd(0.05, 0.12), ph: rnd(0, TAU), s: rnd(4, 9), c: Math.random() < 0.6 ? '#ffc2d8' : '#ffe39a', rot: rnd(0, TAU) }));
    const cranes = Array.from({ length: 6 }, (_, i) => ({ x: 1.1 + i * 0.09 + rnd(0, 0.05), y: rnd(0.16, 0.34), s: rnd(14, 26), ph: rnd(0, TAU), v: rnd(0.035, 0.05) }));
    const clouds = Array.from({ length: 16 }, () => ({ x: rnd(-0.2, 1.2), y: rnd(0.04, 0.42), s: rnd(160, 340), c: Math.floor(Math.random() * 5), v: rnd(-0.012, 0.012) }));
    const stars = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random()]);
    let flash = 0, flashCol = '255,255,255', shake = 0, absorbed = 0, boltT = 1.4, crackSnd = 0, ring = -1;
    const fired = new Set<string>();
    const once = (k: string, f: () => void) => { if (fired.has(k)) return; fired.add(k); try { f(); } catch { /* 静音或音频未就绪 */ } };
    const A: any = audio; const actx = (): AudioContext | null => (A.ready && A.ctx ? A.ctx as AudioContext : null);
    let dest: AudioNode | null = null;
    const out = () => { if (!dest && actx()) { try { dest = A.out(0.9, 0, 0.35, 'sfx'); } catch { dest = null; } } return dest; };
    let bi = -1, last = performance.now(), t = 0, raf = 0;

    const cover = () => {
      const iw = bg.naturalWidth || 1600, ih = bg.naturalHeight || 900, z = 1.04 + 0.07 * (t / T.end);
      const s = Math.max(W / iw, H / ih) * z, dx = (W - iw * s) / 2, dy = (H - ih * s) / 2;
      return { s, dx, dy, iw, ih, fx: dx + iw * s * 0.5, fy: dy + ih * s * 0.745, vx: dx + iw * s * 0.53, vy: dy + ih * s * 0.17 };
    };

    function sky(al: number, dt: number) {
      const C = cover();
      const storm = ease(seg(t, T.storm - 0.5, T.storm + 4)) * (ok ? 1 - ease(seg(t, T.sky + 0.3, T.sky + 5)) : 1 - ease(seg(t, T.shatter, T.shatter + 3)));
      const glory = ok ? ease(seg(t, T.sky, T.sky + 2.2)) : 0;
      ctx.globalCompositeOperation = 'source-over';
      if (bg.complete && bg.naturalWidth) { ctx.globalAlpha = al * ease(seg(t, 0, 1.6)); ctx.drawImage(bg, C.dx, C.dy, C.iw * C.s, C.ih * C.s); }
      ctx.globalAlpha = al; ctx.fillStyle = `rgba(4,5,18,${0.28 + 0.38 * storm - 0.2 * glory})`; ctx.fillRect(0, 0, W, H);
      // 漩涡
      const vr = Math.max(W, H) * 0.55, dis = ok ? ease(seg(t, T.sky, T.sky + 6)) : ease(seg(t, T.shatter, T.shatter + 4)) * 0.6;
      for (const p of vortex) {
        p.a += dt * (0.25 + 1.1 * storm) * 0.55 / Math.sqrt(p.r + 0.05) * (dis > 0 ? 1 - dis * 0.7 : 1);
        const rr = p.r * vr * (0.8 + 0.35 * storm + dis * 1.6);
        const x = C.vx + Math.cos(p.a) * rr, y = C.vy + Math.sin(p.a) * rr * 0.34, sz = p.s * vr * (1 + dis);
        ctx.globalAlpha = al * (0.18 + 0.62 * storm) * (1 - dis) * (p.r < 0.07 ? 0.3 : 1);
        ctx.drawImage(p.k ? DARK2 : DARK, x - sz / 2, y - sz * 0.32, sz, sz * 0.64);
      }
      ctx.globalCompositeOperation = 'lighter';
      // 漩涡眼的金光（终幕化作天门洞开）
      const eye = (0.25 + 0.75 * storm) * (1 - glory) + glory * 1.6, pr = W * (0.09 + 0.03 * Math.sin(t * 3)) * (1 + glory * 2.5);
      ctx.globalAlpha = al * Math.min(1, eye) * (ok || t < T.shatter ? 1 : 0.4); ctx.drawImage(hs ? VIO : GOLD, C.vx - pr, C.vy - pr * 0.6, pr * 2, pr * 1.2);
      // 螺旋臂
      if (storm > 0.05) {
        ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let i = 0; i < 60; i++) { const u = i / 60, a = k * TAU / 4 + u * 5.5 - t * 1.2, r = u * vr * 0.8; const x = C.vx + Math.cos(a) * r, y = C.vy + Math.sin(a) * r * 0.34; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.strokeStyle = `rgba(255,200,120,${0.07 * storm * al})`; ctx.stroke(); }
      }
      // 五行灵气倒灌
      const spawn = storm * (t < T.core ? 1 : 0) * 520 * dt;
      for (let i = 0; i < spawn; i++) {
        const r = Math.max(W, H) * rnd(0.55, 0.9), th = rnd(0, TAU);
        streams.push({ x: 0, y: 0, px: NaN, py: NaN, r, th, sp: rnd(0.7, 1.3), c: Math.floor(Math.random() * GL.length), s: rnd(3, 9) });
      }
      ctx.lineCap = 'round';
      for (let i = streams.length - 1; i >= 0; i--) {
        const p = streams[i];
        p.r -= (p.r * 0.9 + 60) * dt * p.sp; p.th += (1.2 + 90 / Math.max(20, p.r)) * dt * p.sp;
        const x = C.fx + Math.cos(p.th) * p.r, y = C.fy + Math.sin(p.th) * p.r * 0.55 - p.r * 0.25;
        if (!isNaN(p.px)) { ctx.globalAlpha = al * 0.35; ctx.strokeStyle = WUXING[p.c]; ctx.lineWidth = p.s * 0.45; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(x, y); ctx.stroke(); }
        ctx.globalAlpha = al * 0.9; ctx.drawImage(GL[p.c], x - p.s * 2, y - p.s * 2, p.s * 4, p.s * 4);
        p.px = x; p.py = y;
        if (p.r < 14) { streams.splice(i, 1); absorbed++; }
      }
      // 身周灵光
      const aura = Math.min(1, absorbed / 900) * (t < T.core + 1 ? 1 : 0.6) + glory;
      if (aura > 0.02) { const ar = 40 + 110 * aura + 10 * Math.sin(t * 6); ctx.globalAlpha = al * Math.min(1, aura); ctx.drawImage(hs ? VIO : GOLD, C.fx - ar, C.fy - ar * 1.1, ar * 2, ar * 2); }
      // 天雷
      if (t > T.storm + 1.2 && t < (ok ? T.core : T.shatter + 3)) {
        boltT -= dt;
        if (boltT <= 0) {
          boltT = rnd(0.28, 0.9); const pts: [number, number][][] = [];
          const sx = C.vx + rnd(-0.3, 0.3) * W, sy = C.vy + rnd(-0.03, 0.06) * H;
          const strike = Math.random() < 0.45; bolt(sx, sy, strike ? C.fx + rnd(-60, 60) : sx + rnd(-0.25, 0.25) * W, strike ? C.fy - 20 : sy + rnd(0.25, 0.55) * H, 7, pts);
          bolts.push({ pts, life: 0.32 }); flash = Math.min(0.85, flash + (strike ? 0.55 : 0.3)); flashCol = '215,205,255'; shake = Math.max(shake, strike ? 9 : 4);
          if (t - crackSnd > 0.7) { crackSnd = t; try { A.crack?.(undefined, undefined, strike ? 0.9 : 0.55, 1.3); } catch { /* */ } }
        }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]; b.life -= dt; if (b.life <= 0) { bolts.splice(i, 1); continue; }
        const fl = al * (b.life / 0.32) * (0.55 + 0.45 * Math.random());
        for (const [lw, col, aa] of [[11, '150,110,255', 0.22], [4, '205,185,255', 0.6], [1.6, '255,255,255', 1]] as const) {
          ctx.globalAlpha = fl * aa; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = lw;
          for (const pts of b.pts) { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
        }
      }
      // 终幕：光柱、天光、祥云、花雨、仙鹤
      if (glory > 0) {
        const fade = 1 - seg(t, T.end - 2.2, T.end), pw = 26 + 40 * glory + 8 * Math.sin(t * 7);
        const gr = ctx.createLinearGradient(C.fx - pw, 0, C.fx + pw, 0);
        gr.addColorStop(0, 'rgba(255,220,140,0)'); gr.addColorStop(0.5, hs ? 'rgba(255,190,230,0.95)' : 'rgba(255,246,210,0.95)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.globalAlpha = al * glory * fade; ctx.fillStyle = gr; ctx.fillRect(C.fx - pw, 0, pw * 2, C.fy);
        ctx.globalAlpha = al * glory * fade * 0.8; ctx.drawImage(GOLD, C.fx - 160, C.fy - 120, 320, 220);
        for (let k = 0; k < 16; k++) {
          const a = k / 16 * TAU + t * 0.08, a2 = a + 0.07;
          ctx.globalAlpha = al * glory * fade * (0.05 + 0.05 * Math.sin(t * 1.3 + k));
          ctx.fillStyle = 'rgb(255,236,180)'; ctx.beginPath(); ctx.moveTo(C.vx, C.vy); ctx.lineTo(C.vx + Math.cos(a) * W * 1.4, C.vy + Math.sin(a) * W * 1.4); ctx.lineTo(C.vx + Math.cos(a2) * W * 1.4, C.vy + Math.sin(a2) * W * 1.4); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (const c of clouds) { c.x += c.v * dt; ctx.globalAlpha = al * glory * fade * 0.7; ctx.drawImage(CPUFF[c.c], c.x * W - c.s, c.y * H - c.s * 0.35, c.s * 2, c.s * 0.7); }
        for (const p of petals) {
          p.y += p.vy * dt; p.rot += dt * 2; const x = (p.x + Math.sin(t * 1.4 + p.ph) * 0.02) * W, y = p.y * H; if (p.y > 1.05) { p.y = rnd(-0.2, 0); p.x = rnd(0, 1); }
          ctx.globalAlpha = al * glory * fade; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(x, y, p.s, p.s * 0.45, p.rot, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = '#f6f2e8'; ctx.fillStyle = '#f6f2e8';
        for (const c of cranes) {
          c.x -= c.v * dt; const x = c.x * W, y = c.y * H + Math.sin(t * 1.5 + c.ph) * 6, f = Math.sin(t * 5 + c.ph) * 0.8, s = c.s;
          ctx.globalAlpha = al * glory * fade * 0.95; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.16, -0.1, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.05); ctx.lineTo(x - s * 1.05, y - s * 0.22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - s * 0.1, y); ctx.quadraticCurveTo(x + s * 0.2, y - s * (0.9 * f), x + s * 0.85, y - s * (0.6 + f * 0.7)); ctx.stroke();
          ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x - s * 1.05, y - s * 0.24, 1.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#f6f2e8';
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function core(al: number, dt: number) {
      const cx = W / 2, cy = H / 2, R0 = Math.min(W, H) * 0.14;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al;
      const bgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7); bgG.addColorStop(0, hs ? '#1c0b22' : '#140d26'); bgG.addColorStop(1, '#000');
      ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; for (const [x, y, b] of stars) { ctx.globalAlpha = al * b * (0.35 + 0.3 * Math.sin(t * 2 + b * 9)); ctx.fillRect(x * W, y * H, 1.4, 1.4); }
      ctx.globalCompositeOperation = 'lighter';
      const crackP = jy ? ease(seg(t, T.core + 0.8, T.shatter)) : (!ok ? ease(seg(t, T.shatter - 1.4, T.shatter)) : 0);
      const grow = jy ? 1 : ease(seg(t, T.core + 0.3, T.shatter - 0.2));
      const broken = t >= T.shatter;
      // 结丹：灵液旋入
      if (!jy && t < T.shatter) {
        for (let i = 0; i < 260 * dt * 2; i++) streams.push({ x: 0, y: 0, px: NaN, py: NaN, r: Math.max(W, H) * rnd(0.35, 0.6), th: rnd(0, TAU), sp: rnd(0.8, 1.4), c: Math.random() < 0.7 ? 0 : 6, s: rnd(3, 8) });
        for (let i = streams.length - 1; i >= 0; i--) {
          const p = streams[i]; p.r -= (p.r * 1.1 + 40) * dt * p.sp; p.th += (2 + 120 / Math.max(20, p.r)) * dt;
          const x = cx + Math.cos(p.th) * p.r, y = cy + Math.sin(p.th) * p.r * 0.8;
          ctx.globalAlpha = al * 0.85; ctx.drawImage(GL[p.c], x - p.s * 2, y - p.s * 2, p.s * 4, p.s * 4);
          if (p.r < R0 * grow * 0.7 + 6) streams.splice(i, 1);
        }
      }
      if (!broken) {
        const R = R0 * Math.max(0.05, grow), jx = rnd(-1, 1) * crackP * 5, jyy = rnd(-1, 1) * crackP * 5, x = cx + jx, y = cy + jyy;
        ctx.globalAlpha = al * (0.45 + 0.5 * crackP); ctx.drawImage(hs ? VIO : GOLD, x - R * 2.6, y - R * 2.6, R * 5.2, R * 5.2);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al;
        const body = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.05, x, y, R);
        if (hs) { body.addColorStop(0, '#fff3ff'); body.addColorStop(0.5, '#d7a0ff'); body.addColorStop(0.9, '#7a3cb0'); body.addColorStop(1, '#3a1460'); }
        else { body.addColorStop(0, '#fffbe6'); body.addColorStop(0.45, '#ffd75e'); body.addColorStop(0.85, '#d98a1c'); body.addColorStop(1, '#7a3d08'); }
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(255,240,190,${0.25 * al})`; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(x, y, R * (0.45 + k * 0.17), t * (1.2 + k * 0.4), t * (1.2 + k * 0.4) + 2.2); ctx.stroke(); }
        // 符文环
        ctx.font = `${Math.round(R * 0.2)}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const RUNE = '金木水火土风雷冰阴阳乾坤震巽坎离';
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + t * 0.35; ctx.globalAlpha = al * (0.55 + 0.35 * Math.sin(t * 3 + k)) * Math.min(1, grow * 1.4); ctx.fillStyle = hs ? '#f0c8ff' : '#ffe3a0'; ctx.fillText(RUNE[k], x + Math.cos(a) * R * 1.5, y + Math.sin(a) * R * 1.5); }
        // 裂纹
        if (crackP > 0) {
          const nVis = Math.ceil(cracks.length * Math.min(1, crackP * 1.6));
          for (let i = 0; i < nVis; i++) {
            const pts = cracks[i], m = Math.max(2, Math.floor(pts.length * Math.min(1, crackP * 1.3)));
            for (const [lw, aa] of [[R * 0.07, 0.3], [R * 0.022, 1]] as const) {
              ctx.globalAlpha = al * aa; ctx.strokeStyle = !ok && !jy ? 'rgb(255,120,90)' : 'rgb(255,250,225)'; ctx.lineWidth = lw; ctx.beginPath();
              for (let k = 0; k < m; k++) { const [px, py] = pts[k]; if (k) ctx.lineTo(x + px * R, y + py * R); else ctx.moveTo(x + px * R, y + py * R); }
              ctx.stroke();
            }
          }
          shake = Math.max(shake, crackP * 5);
          if (crackP > 0.15 && t - crackSnd > 0.9) { crackSnd = t; try { A.crackle?.(undefined, undefined, 0.5, 6); } catch { /* */ } }
        }
      }
      // 碎裂瞬间
      if (broken && !fired.has('shatter')) {
        once('shatter', () => {
          flash = 1; flashCol = ok ? '255,250,235' : '255,70,50'; shake = 26; ring = t;
          if (jy || !ok) for (let i = 0; i < 90; i++) { const a = rnd(0, TAU), v = rnd(260, 1100), r = rnd(0, R0); shards.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, TAU), vr: rnd(-8, 8), s: rnd(6, 22), a: 1, pull: 0 }); }
          const c = actx(), d = out();
          if (c && d) { A.cymbal?.(c.currentTime, 0.7, d, 2.4); A.drum?.(c.currentTime, 1, d, 110, 36, 1.3); }
          A.sfx?.(ok ? 'boom' : 'fail');
        });
      }
      if (ring >= 0) {
        const u = (t - ring) / 1.1; if (u < 1) { ctx.globalAlpha = al * (1 - u); ctx.strokeStyle = ok ? 'rgb(255,236,180)' : 'rgb(255,90,70)'; ctx.lineWidth = 14 * (1 - u) + 1; ctx.beginPath(); ctx.arc(cx, cy, R0 + u * Math.max(W, H) * 0.8, 0, TAU); ctx.stroke(); }
      }
      // 碎片
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        if (ok && t > T.soul + 0.6) { s.pull = Math.min(1, s.pull + dt * 0.5); const dx = cx - s.x, dy = cy - s.y, d = Math.hypot(dx, dy) + 1; s.vx += (dx / d * 900 - dy / d * 500) * dt * s.pull; s.vy += (dy / d * 900 + dx / d * 500) * dt * s.pull; if (d < 30) { shards.splice(i, 1); continue; } }
        const damp = Math.exp(-2.4 * dt); s.vx *= damp; s.vy *= damp; if (!ok) s.vy += 380 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; if (!ok) s.a -= dt * 0.35;
        if (s.a <= 0) { shards.splice(i, 1); continue; }
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.globalAlpha = al * s.a;
        ctx.drawImage(ok ? (hs ? VIO : GOLD) : RED, -s.s * 1.8, -s.s * 1.8, s.s * 3.6, s.s * 3.6);
        ctx.fillStyle = ok ? (hs ? '#f4dcff' : '#fff1c2') : '#8a3020'; ctx.beginPath(); ctx.moveTo(0, -s.s); ctx.lineTo(s.s * 0.7, s.s * 0.6); ctx.lineTo(-s.s * 0.6, s.s * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 结丹成：金丹放光
      if (!jy && ok && broken) { const R = R0 * (1 + 0.04 * Math.sin(t * 4)); ctx.globalAlpha = al; ctx.drawImage(GOLD, cx - R * 3, cy - R * 3, R * 6, R * 6); ctx.globalCompositeOperation = 'source-over'; const b = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R); b.addColorStop(0, '#fffef2'); b.addColorStop(0.5, '#ffe07a'); b.addColorStop(1, '#c9781a'); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; }
      // 元婴
      if (jy && ok && t > T.soul) {
        const a = ease(seg(t, T.soul, T.soul + 1.8)), sh = Math.min(H * 0.7, W * 0.9 * 1.5), sw = sh / 1.5, br = 1 + 0.015 * Math.sin(t * 2);
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = al * a * 0.5; ctx.strokeStyle = k === 1 ? 'rgb(200,150,255)' : 'rgb(255,214,120)'; ctx.lineWidth = 2;
          ctx.setLineDash([18 + k * 6, 14]); ctx.beginPath(); ctx.ellipse(cx, cy - sh * 0.05, sh * (0.3 + k * 0.06), sh * (0.3 + k * 0.06) * 0.92, 0, t * (0.4 - k * 0.25), t * (0.4 - k * 0.25) + TAU); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = al * a * 0.7; ctx.drawImage(hs ? GOLD : VIO, cx - sh * 0.45, cy - sh * 0.5, sh * 0.9, sh * 0.9);
        if (soul.complete && soul.naturalWidth) {
          ctx.globalAlpha = al * a; if (hs) ctx.filter = 'hue-rotate(-35deg) saturate(1.3)';
          ctx.drawImage(soul, cx - sw * br / 2, cy - sh * br / 2 + 10, sw * br, sh * br); ctx.filter = 'none';
        }
        const eo = seg(t, T.soul + 3, T.soul + 3.8);
        if (eo > 0 && eo < 1) { ctx.globalAlpha = al * Math.sin(eo * Math.PI); const r = 40 + eo * 260; ctx.drawImage(GOLD, cx - r, cy - sh * 0.3 - r, r * 2, r * 2); }
        for (let k = 0; k < 40; k++) { const u = (t * 0.12 + k / 40) % 1, ang = k * 2.4 + t * 0.5; ctx.globalAlpha = al * a * Math.sin(u * Math.PI) * 0.8; const x = cx + Math.cos(ang) * sh * (0.18 + u * 0.25), y = cy + sh * 0.35 - u * sh * 0.8; ctx.drawImage(GL[k % 2 ? 0 : 5], x - 6, y - 6, 12, 12); }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const finish = () => { if (done.current) return; done.current = true; onDone(); };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (skipAt.current >= 0 && t - skipAt.current > 0.45) { finish(); return; }
      if (t >= T.end) { finish(); return; }
      // 字幕
      let k = -1; for (let i = 0; i < BEATS.length; i++) if (t >= BEATS[i].at) k = i;
      if (k !== bi) { bi = k; setBeat(k >= 0 ? { ...BEATS[k], k } : null); }
      if (t > 1.5) setSkip(true);
      // 声音
      once('gong0', () => { const c = actx(), d = out(); if (c && d) A.gong?.(c.currentTime + 0.05, 0.55, 70, d); });
      if (t > T.storm) once('rumble', () => { const c = actx(), d = out(); if (c && d) A.nz?.(c.currentTime, T.core - T.storm + 3.6, 0.5, d, 'lowpass', 60, 260, 0.7, 2.4); });
      if (t > T.core) once('bell0', () => A.bell?.(undefined, undefined, 0.5, 0.6));
      if (ok && jy && t > T.soul + 3) once('soulbell', () => { A.bell?.(undefined, undefined, 0.75, 1.25); A.sfx?.('break'); });
      if (ok && t > T.sky) once('glory', () => { const c = actx(), d = out(); if (c && d) { A.gong?.(c.currentTime, 0.8, 82, d); for (const f of [196, 293.7, 392, 493.9, 587.3, 784]) A.tone?.('sine', f, c.currentTime + 0.1, 6.5, 0.045, d, undefined, 1.4); } A.sfx?.('chime'); });
      // 画面
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      shake *= Math.exp(-5 * dt); const sk = shake + (t > T.storm && t < T.core ? 1.5 : 0);
      ctx.translate(rnd(-sk, sk), rnd(-sk, sk));
      const toCore = ease(seg(t, T.core - 0.6, T.core + 0.2)), toSky = ok ? ease(seg(t, T.sky - 0.6, T.sky + 0.6)) : 0;
      const aSky = 1 - toCore + toSky, aCore = toCore * (1 - toSky);
      if (aSky > 0.01) sky(Math.min(1, aSky), dt);
      if (aCore > 0.01) core(aCore, dt);
      // 闪光、暗角、电影黑边、淡出
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'source-over';
      flash *= Math.exp(-3.6 * dt); if (flash > 0.01) { ctx.globalAlpha = flash; ctx.fillStyle = `rgb(${flashCol})`; ctx.fillRect(0, 0, W, H); }
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.globalAlpha = 1; ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      const bar = H * 0.085 * ease(seg(t, 0, 1)) * (1 - ease(seg(t, T.end - 1, T.end)));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      const fo = seg(t, T.end - 1.1, T.end) + (skipAt.current >= 0 ? seg(t, skipAt.current, skipAt.current + 0.4) : 0) + (1 - seg(t, 0, 0.6));
      if (fo > 0) { ctx.globalAlpha = Math.min(1, fo); ctx.fillRect(0, 0, W, H); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => { if ((e.key === 'Escape' || e.key === ' ') && t > 1.5 && skipAt.current < 0) { e.preventDefault(); e.stopPropagation(); skipAt.current = t; } };
    window.addEventListener('keydown', key, true);
    skipRef.current = () => { if (t > 1.5 && skipAt.current < 0) skipAt.current = t; };
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', key, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const seal = info.kind === 'jiedan' ? '結丹' : info.kind === 'huashen' ? '化神' : '結嬰';
  return (
    <div className="asc-root">
      <canvas ref={cv} className="asc-cv" />
      {beat && <div key={beat.k} className={'asc-title ' + (beat.cls ?? '')}>
        <div className="asc-t">{beat.title}</div>
        {beat.sub && <div className="asc-sub">{beat.sub}</div>}
        {beat.cls === 'final' && <div className="asc-seal">{seal}</div>}
      </div>}
      {skip && <button className="asc-skip" onClick={() => skipRef.current()}>跳过 ▸▸</button>}
    </div>
  );
}
