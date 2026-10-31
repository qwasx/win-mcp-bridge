// ============ v0.44 · 结婴大典 ============
// 九色霞光自天门倒卷而下，金莲三千里次第开放，九道天雷依次落尽，
// 山门内外、江上舟中、云头崖顶，近七十万人屏息而视。
// 全程 26 秒，可点击「收了神通」跳过；尊重 prefers-reduced-motion（直接给静帧）。
import { useEffect, useRef, useState } from 'react';
import { jieying, type JieyingEvent } from '../world/jieying';
import { audio } from '../world/audio';

const NINE = ['#e8c06a', '#d98f3a', '#c25a3a', '#9c4a6a', '#6a4a9c', '#3f5aa0', '#3a7f8f', '#4f9c5a', '#b8b06a'];
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Lotus { x: number; y: number; r: number; t: number; hue: number }
interface Petal { x: number; y: number; vx: number; vy: number; t: number; max: number; c: string; s: number }
interface Bolt { x: number; y: number; seed: number; t: number; dur: number }
interface Star { x: number; y: number; r: number; t: number }

export function JieyingCeremony() {
  const [ev, setEv] = useState<JieyingEvent | null>(null);
  const [phase, setPhase] = useState(0);
  const [crowd, setCrowd] = useState(0);
  const [thunder, setThunder] = useState(0);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const skip = useRef(false);
  const key = useRef(0);

  useEffect(() => jieying.on((e) => { key.current++; setEv(e); setPhase(0); setCrowd(0); setThunder(0); skip.current = false; }), []);

  useEffect(() => {
    if (!ev) return;
    const cv = cvRef.current; if (!cv) return;
    const g = cv.getContext('2d')!;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);

    const T = reduce ? 4 : 26;             // 总时长（秒）
    const t0 = performance.now();
    const lotuses: Lotus[] = [];
    const petals: Petal[] = [];
    const bolts: Bolt[] = [];
    const stars: Star[] = [];
    for (let i = 0; i < 260; i++) stars.push({ x: Math.random(), y: Math.random() * 0.72, r: rnd(0.4, 1.7), t: Math.random() * TAU });
    let lastBolt = 0, boltN = 0, lotusT = 0, done = false;
    const timers: number[] = [];

    if (!reduce) {
      // 九道天雷：第 8 秒起，每 1.35 秒一道
      for (let i = 0; i < 9; i++) timers.push(window.setTimeout(() => { if (!skip.current) { bolts.push({ x: W * rnd(0.12, 0.88), y: H * rnd(0.06, 0.2), seed: Math.random() * 999, t: 0, dur: 0.5 }); audio.sfx('thunder'); boltN = i + 1; setThunder(boltN); setPhase(3); } }, (8 + i * 1.35) * 1000));
      timers.push(window.setTimeout(() => setPhase(4), 6200));
      timers.push(window.setTimeout(() => setPhase(2), 3600));
      timers.push(window.setTimeout(() => setPhase(1), 1200));
    } else { setPhase(4); }

    // 观礼人数滚动
    let raf2 = 0;
    const tickCrowd = () => {
      const el = (performance.now() - t0) / 1000;
      const k = Math.min(1, Math.max(0, (el - 1.5) / 6));
      setCrowd(Math.round(ev.crowd * (1 - Math.pow(1 - k, 3))));
      if (el < T && !skip.current) raf2 = requestAnimationFrame(tickCrowd); else setCrowd(ev.crowd);
    };
    raf2 = requestAnimationFrame(tickCrowd);

    const frame = (now: number) => {
      const el = (now - t0) / 1000;
      if (skip.current && !done) { done = true; }
      const k = Math.min(1, el / T);

      // ---- 天幕：夜→九色霞光 ----
      const sky = g.createLinearGradient(0, 0, 0, H);
      const dark = Math.min(1, el / 3);
      sky.addColorStop(0, `rgba(${8 + 6 * dark},${10 + 6 * dark},${20 + 8 * dark},1)`);
      sky.addColorStop(0.55, `rgba(${18 + 14 * dark},${16 + 10 * dark},${28 + 10 * dark},1)`);
      sky.addColorStop(1, '#0a0c12');
      g.globalAlpha = 1; g.fillStyle = sky; g.fillRect(0, 0, W, H);

      // 星（结婴后天河倒卷，群星逆旋）
      for (const s of stars) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(el * 0.6 + s.t));
        const swirl = el > 6 ? (el - 6) * 0.06 : 0;
        const cx = 0.5, cy = 0.55;
        const dx = s.x - cx, dy = s.y - cy;
        const rr = Math.hypot(dx, dy) * (1 - 0.28 * Math.min(1, (el - 6) / 8));
        const ang = Math.atan2(dy, dx) - swirl;
        const x = (cx + Math.cos(ang) * rr) * W, y = (cy + Math.sin(ang) * rr * 1.2) * H;
        g.globalAlpha = a * 0.9; g.fillStyle = '#dfe6ff';
        g.beginPath(); g.arc(x, y, s.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;

      // ---- 九色霞光：自天门倒卷的光幕 ----
      const aur = Math.min(1, Math.max(0, (el - 0.4) / 2.2));
      if (aur > 0) {
        g.save(); g.globalCompositeOperation = 'screen';
        for (let i = 0; i < 9; i++) {
          const ph = el * 0.42 + i * 0.7;
          const x0 = W * (0.08 + i * 0.105) + Math.sin(ph) * W * 0.035;
          const grd = g.createLinearGradient(0, H * 0.02, 0, H * 0.86);
          const c = NINE[i];
          grd.addColorStop(0, 'rgba(255,255,255,0)');
          grd.addColorStop(0.18, c);
          grd.addColorStop(0.7, c + '55');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = aur * (0.16 + 0.1 * Math.sin(ph * 1.7)) * (skip.current ? 0.5 : 1);
          g.fillStyle = grd;
          g.beginPath();
          const wTop = W * 0.028, wBot = W * (0.052 + 0.02 * Math.sin(ph));
          g.moveTo(x0 - wTop, H * 0.02); g.lineTo(x0 + wTop, H * 0.02);
          g.lineTo(x0 + Math.sin(ph * 0.8) * W * 0.05 + wBot, H * 0.86);
          g.lineTo(x0 + Math.sin(ph * 0.8) * W * 0.05 - wBot, H * 0.86);
          g.closePath(); g.fill();
        }
        // 天门：顶端的光环
        const ringR = Math.min(W, H) * (0.06 + 0.02 * Math.sin(el * 1.2));
        g.globalAlpha = aur * 0.75;
        const rg = g.createRadialGradient(W / 2, H * 0.07, 0, W / 2, H * 0.07, ringR * 2.6);
        rg.addColorStop(0, '#fff6d8'); rg.addColorStop(0.4, '#e8c06a88'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(W / 2, H * 0.07, ringR * 2.6, 0, TAU); g.fill();
        g.restore();
      }

      // ---- 地平线：金莲三千里 ----
      const grd2 = g.createLinearGradient(0, H * 0.72, 0, H);
      grd2.addColorStop(0, 'rgba(20,16,10,0)');
      grd2.addColorStop(1, 'rgba(12,10,6,1)');
      g.fillStyle = grd2; g.fillRect(0, H * 0.72, W, H * 0.28);

      lotusT += 1 / 60;
      const lotusRate = el > 3.2 && el < 22 ? 3.4 : 0;
      if (lotusRate && lotuses.length < 220) {
        for (let i = 0; i < lotusRate; i++) {
          if (Math.random() < 0.55) lotuses.push({ x: rnd(-0.05, 1.05) * W, y: rnd(0.74, 1.0) * H, r: rnd(6, 26), t: 0, hue: Math.floor(rnd(0, 9)) });
        }
      }
      for (let i = lotuses.length - 1; i >= 0; i--) {
        const L = lotuses[i]; L.t += 1 / 60;
        const grow = Math.min(1, L.t / 1.1);
        const fade = Math.max(0, 1 - Math.max(0, L.t - 4) / 2.5);
        if (fade <= 0) { lotuses.splice(i, 1); continue; }
        const rr = L.r * (0.3 + 0.7 * grow);
        g.globalAlpha = 0.9 * fade;
        // 花心
        const cg = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, rr * 2.4);
        cg.addColorStop(0, '#fff3cf'); cg.addColorStop(0.35, NINE[L.hue] + 'cc'); cg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = cg; g.beginPath(); g.arc(L.x, L.y, rr * 2.4, 0, TAU); g.fill();
        // 花瓣
        g.fillStyle = '#f6e2a8';
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * TAU + L.t * 0.15;
          g.globalAlpha = 0.8 * fade * grow;
          g.beginPath();
          g.ellipse(L.x + Math.cos(a) * rr * 0.85, L.y + Math.sin(a) * rr * 0.4, rr * 0.62, rr * 0.26, a * 0.5, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      g.globalAlpha = 1;

      // ---- 花瓣雨 ----
      if (el > 9 && petals.length < 300 && Math.random() < 0.85) {
        for (let i = 0; i < 4; i++) petals.push({ x: rnd(0, W), y: -10, vx: rnd(-24, 24), vy: rnd(40, 110), t: 0, max: 8, c: NINE[Math.floor(rnd(0, 9))], s: rnd(3, 8) });
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const P = petals[i]; P.t += 1 / 60; P.x += P.vx / 60 + Math.sin(P.t * 2.4) * 0.7; P.y += P.vy / 60;
        if (P.t > P.max || P.y > H + 20) { petals.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, P.t * 2) * Math.max(0, 1 - P.t / P.max) * 0.9;
        g.fillStyle = P.c;
        g.beginPath(); g.ellipse(P.x, P.y, P.s, P.s * 0.45, P.t * 3, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;

      // ---- 九道天雷 ----
      for (let i = bolts.length - 1; i >= 0; i--) {
        const B = bolts[i]; B.t += 1 / 60;
        if (B.t > B.dur) { bolts.splice(i, 1); continue; }
        const a = 1 - B.t / B.dur;
        g.save(); g.globalCompositeOperation = 'screen';
        let x = B.x, y = B.y;
        g.strokeStyle = '#eaf2ff'; g.lineWidth = 3.2; g.globalAlpha = a;
        g.shadowColor = '#9fc4ff'; g.shadowBlur = 22;
        g.beginPath(); g.moveTo(x, y);
        let seed = B.seed;
        const rand2 = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        while (y < H * 0.72) { x += (rand2() - 0.5) * 74; y += 34 + rand2() * 46; g.lineTo(x, y); }
        g.stroke();
        // 分叉
        g.lineWidth = 1.5; g.globalAlpha = a * 0.7;
        let sx = B.x, sy = B.y + 90;
        g.beginPath(); g.moveTo(sx, sy);
        for (let s2 = 0; s2 < 5; s2++) { sx += (rand2() - 0.5) * 90; sy += 26; g.lineTo(sx, sy); }
        g.stroke();
        g.restore();
        // 雷光闪白
        g.globalAlpha = a * 0.16; g.fillStyle = '#cfe0ff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
        lastBolt = B.x;
      }
      void lastBolt; void boltN;

      // ---- 婴儿（元婴）自霞光中升起 ----
      const rise = Math.min(1, Math.max(0, (el - 15) / 4));
      if (rise > 0) {
        const cx = W / 2, cy = H * (0.62 - rise * 0.2);
        const R = Math.min(W, H) * (0.06 + 0.02 * rise);
        g.save(); g.globalCompositeOperation = 'screen';
        const hg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 5);
        hg.addColorStop(0, '#fff8e0ee'); hg.addColorStop(0.25, '#f0cf85aa'); hg.addColorStop(0.6, '#c99a3a44'); hg.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = rise; g.fillStyle = hg;
        g.beginPath(); g.arc(cx, cy, R * 5, 0, TAU); g.fill();
        // 盘坐小人
        g.globalAlpha = rise * 0.95; g.fillStyle = '#fff4d6';
        g.beginPath(); g.arc(cx, cy - R * 0.5, R * 0.34, 0, TAU); g.fill();          // 首
        g.beginPath(); g.ellipse(cx, cy + R * 0.28, R * 0.5, R * 0.62, 0, 0, TAU); g.fill(); // 身
        g.beginPath(); g.ellipse(cx - R * 0.5, cy + R * 0.6, R * 0.38, R * 0.2, -0.4, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(cx + R * 0.5, cy + R * 0.6, R * 0.38, R * 0.2, 0.4, 0, TAU); g.fill();
        // 脚踏金莲
        g.globalAlpha = rise * 0.9; g.fillStyle = '#f2d78e';
        for (let p = 0; p < 10; p++) { const a = (p / 10) * TAU + el * 0.25; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.9, cy + R * 0.95 + Math.sin(a) * R * 0.22, R * 0.5, R * 0.18, a * 0.4, 0, TAU); g.fill(); }
        g.restore();
      }

      // ---- 顶部竖排题字 ----
      g.globalAlpha = Math.min(1, Math.max(0, (el - 1.6) / 1.6));
      g.fillStyle = '#f4e6c2';
      g.textAlign = 'center';
      g.font = `${Math.round(Math.min(W, H) * 0.052)}px "Noto Serif SC", serif`;
      g.fillText('碎 丹 成 婴', W / 2, H * 0.16);
      g.font = `${Math.round(Math.min(W, H) * 0.019)}px "Noto Serif SC", serif`;
      g.fillStyle = '#c9b98c';
      g.fillText('九色霞光三千里 · 金莲次第开 · 天河倒卷', W / 2, H * 0.205);
      g.globalAlpha = 1;

      if (!done || k < 1) requestAnimationFrame(frame);
      else { finish(); }
    };

    const finish = () => { setEv(null); setPhase(0); setCrowd(0); };
    const raf = requestAnimationFrame(frame);
    const onKey = () => { skip.current = true; };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(raf2); window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); timers.forEach(clearTimeout); };
  }, [ev]);

  if (!ev) return null;
  const rank = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return (
    <div className="jieying" onClick={() => { skip.current = true; }}>
      <canvas ref={cvRef} className="jieying-cv" />
      <div className="jieying-hud">
        <div className="jy-crowd">
          <small>观礼众生</small>
          <b>{crowd.toLocaleString('en-US')}</b>
          <i>人</i>
        </div>
        <div className="jy-guests">
          {ev.guests.slice(0, 12).map((g, i) => (
            <div key={g.name + i} className="jy-guest" style={{ animationDelay: `${1.2 + i * 0.42}s` }}>
              <b>{g.name}</b><span>{g.title}</span><em>{g.sect}</em>
            </div>
          ))}
        </div>
        <div className="jy-meta">
          <div>{ev.name} · 时年 {ev.age} 岁 · {ev.place}</div>
          {phase >= 3 && <div className="jy-thunder">{thunder >= 9 ? '九雷俱尽，元婴成矣' : `天雷 ${rank[thunder] || '一'} 道落下，轰然有声`}</div>}
        </div>
        <div className="jy-skip">点击任意处收了神通</div>
      </div>
    </div>
  );
}
