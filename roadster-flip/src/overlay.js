// SVG 叠加层：① 夜间镜头光斑（按投影位置 + 遮挡射线检测 + 朝向衰减：光晕、光圈星芒、变形宽银幕拉丝、
// 沿光轴的鬼影）② 直播 HUD（LIVE/REPLAY、场地台标、焦距、当地时间、T± 计时、遥测、坡道侧视小图、高度曲线、字幕条）
import * as THREE from 'three';

const NS = 'http://www.w3.org/2000/svg';
const W = 1920, H = 1080;
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const hex = (c) => '#' + new THREE.Color(c).getHexString();

export class Overlay {
  constructor(stage, T, flares, occluders) {
    this.T = T; this.flares = flares; this.occluders = occluders;
    this.ray = new THREE.Raycaster();
    // ---------------- 光斑层
    const fsvg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'layer flare', preserveAspectRatio: 'none' });
    stage.appendChild(fsvg);
    const defs = el('defs', {}, fsvg);
    const rg = (id, stops) => { const g = el('radialGradient', { id }, defs); for (const [o, c, a] of stops) el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g); };
    const lg = (id, stops, x2 = '100%') => { const g = el('linearGradient', { id, x1: '0%', x2, y1: '0%', y2: '0%' }, defs); for (const [o, c, a] of stops) el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g); };
    rg('fGlow', [[0, '#ffffff', 1], [0.08, '#fffaf0', 0.9], [0.25, '#ffe6c8', 0.28], [0.6, '#a9c4ff', 0.06], [1, '#a9c4ff', 0]]);
    rg('fGhostA', [[0, '#7dffb0', 0.0], [0.7, '#7dffb0', 0.10], [0.9, '#a0ffd0', 0.22], [1, '#a0ffd0', 0]]);
    rg('fGhostB', [[0, '#ff7de0', 0.08], [0.85, '#c37dff', 0.14], [1, '#c37dff', 0]]);
    rg('fGhostC', [[0, '#ffc070', 0.16], [1, '#ffc070', 0]]);
    rg('fRing', [[0, '#ffffff', 0], [0.86, '#ffffff', 0], [0.93, '#ffb070', 0.12], [0.96, '#70ffb0', 0.12], [1, '#70a0ff', 0]]);
    lg('fStreak', [[0, '#5a8cff', 0], [0.35, '#6c9cff', 0.25], [0.5, '#e8f0ff', 0.9], [0.65, '#6c9cff', 0.25], [1, '#5a8cff', 0]]);
    lg('fRay', [[0, '#ffffff', 0], [0.5, '#ffffff', 0.8], [1, '#ffffff', 0]]);
    const blur = el('filter', { id: 'fBlur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); el('feGaussianBlur', { stdDeviation: 1.2 }, blur);
    const hexPts = (r) => Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + 0.26; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');
    this.fl = flares.map((f) => {
      const g = el('g', { opacity: 0 }, fsvg);
      const ghosts = el('g', {}, fsvg);
      const tint = hex(f.color);
      const streak = el('ellipse', { rx: 520, ry: 2.6, fill: 'url(#fStreak)' }, g);
      const halo = el('circle', { r: 120, fill: 'url(#fGlow)' }, g);
      const rays = el('g', { filter: 'url(#fBlur)' }, g);
      for (let i = 0; i < 6; i++) { const a = i * 30 + 15; el('rect', { x: -160, y: -0.9, width: 320, height: 1.8, fill: 'url(#fRay)', transform: `rotate(${a})`, opacity: i % 2 ? 0.35 : 0.7 }, rays); }
      const core = el('circle', { r: 7, fill: '#fff' }, g);
      const tintC = el('circle', { r: 30, fill: tint, opacity: 0.18 }, g);
      const gl = [
        { k: -0.35, r: 46, fill: 'url(#fGhostA)', hex: true }, { k: -0.7, r: 90, fill: 'url(#fGhostB)', hex: true }, { k: -1.05, r: 26, fill: 'url(#fGhostC)' },
        { k: 0.42, r: 18, fill: 'url(#fGhostC)' }, { k: -1.5, r: 180, fill: 'url(#fRing)' }, { k: 0.75, r: 60, fill: 'url(#fGhostA)', hex: true },
      ].map((d) => ({ ...d, e: d.hex ? el('polygon', { points: hexPts(d.r), fill: d.fill }, ghosts) : el('circle', { r: d.r, fill: d.fill }, ghosts) }));
      return { f, g, ghosts, streak, halo, rays, core, tintC, gl, vis: 0 };
    });
    // ---------------- HUD
    const hud = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'layer hud', preserveAspectRatio: 'none' });
    stage.appendChild(hud); this.hud = hud;
    const hdefs = el('defs', {}, hud);
    const sh = el('filter', { id: 'hShadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, hdefs); el('feDropShadow', { dx: 0, dy: 1, stdDeviation: 1.5, 'flood-color': '#000', 'flood-opacity': 0.6 }, sh);
    const lgp = el('linearGradient', { id: 'hPanel', x1: 0, x2: 0, y1: 0, y2: 1 }, hdefs); el('stop', { offset: 0, 'stop-color': '#0a0d12', 'stop-opacity': 0.72 }, lgp); el('stop', { offset: 1, 'stop-color': '#05070a', 'stop-opacity': 0.82 }, lgp);
    const txt = (x, y, s, size, attrs = {}, parent = hud) => { const t = el('text', { x, y, 'font-size': size, fill: '#fff', filter: 'url(#hShadow)', ...attrs }, parent); t.textContent = s; return t; };
    // 左上：LIVE / 台标
    this.badge = el('g', { transform: 'translate(64,58)' }, hud);
    this.badgeBg = el('rect', { x: 0, y: 0, width: 118, height: 40, rx: 4, fill: '#e3121b' }, this.badge);
    this.badgeDot = el('circle', { cx: 22, cy: 20, r: 7, fill: '#fff' }, this.badge);
    this.badgeTxt = txt(38, 29, 'LIVE', 25, { 'font-weight': 800, 'letter-spacing': 2, filter: '' }, this.badge);
    txt(196, 72, 'STARBASE  ·  BOCA CHICA, TEXAS', 21, { 'font-weight': 700, 'letter-spacing': 3, opacity: 0.95 });
    txt(196, 98, 'ROADSTER  INVERTED-HOLD  RAMP TEST  ·  RUN 02', 16, { 'letter-spacing': 2.5, opacity: 0.7 });
    // 右上：机位、焦距、时间、计时
    this.camTxt = txt(W - 64, 72, 'CAM 4 · 600 mm', 19, { 'text-anchor': 'end', 'letter-spacing': 2, opacity: 0.8, 'font-family': 'ui-monospace, Menlo, Consolas, monospace' });
    this.clock = txt(W - 64, 100, '23:41:07 CDT', 19, { 'text-anchor': 'end', 'letter-spacing': 2, opacity: 0.8, 'font-family': 'ui-monospace, Menlo, Consolas, monospace' });
    this.tminus = txt(W - 64, 146, 'T−00:06.74', 40, { 'text-anchor': 'end', 'font-weight': 700, 'letter-spacing': 1, 'font-family': 'ui-monospace, Menlo, Consolas, monospace' });
    this.tlabel = txt(W - 64, 168, 'TO RELEASE', 13, { 'text-anchor': 'end', 'letter-spacing': 3, opacity: 0.6 });
    // 左下：遥测面板
    const P = el('g', { transform: `translate(64,${H - 236})` }, hud); this.panel = P;
    el('rect', { x: 0, y: 0, width: 560, height: 172, rx: 6, fill: 'url(#hPanel)', stroke: '#ffffff', 'stroke-opacity': 0.1 }, P);
    el('rect', { x: 0, y: 0, width: 4, height: 172, fill: '#e3121b' }, P);
    const cells = [['SPEED', 'km/h'], ['ALTITUDE', 'm'], ['VERT SPEED', 'm/s'], ['G-LOAD', 'g'], ['ROLL', '°'], ['FAN ΔP', 'kPa'], ['RETRO', '%'], ['RCS', '']];
    this.cells = cells.map(([k, u], i) => {
      const x = 26 + (i % 4) * 134, y = 18 + Math.floor(i / 4) * 78;
      txt(x, y + 16, k, 12.5, { 'letter-spacing': 2.2, opacity: 0.6, filter: '' }, P);
      const v = txt(x, y + 52, '0', 32, { 'font-weight': 700, 'font-family': 'ui-monospace, Menlo, Consolas, monospace', filter: '' }, P);
      const uu = txt(x + 2, y + 70, u, 12, { opacity: 0.5, filter: '' }, P);
      return { v, uu, x, y };
    });
    this.cells[7].v.textContent = '';
    this.rcsDots = [0, 1, 2, 3].map((i) => el('rect', { x: this.cells[7].x + i * 24, y: this.cells[7].y + 30, width: 18, height: 18, rx: 3, fill: '#2a2f36', stroke: '#fff', 'stroke-opacity': 0.25 }, P));
    // 右下：坡道侧视小图 + 高度曲线
    const M = el('g', { transform: `translate(${W - 424},${H - 296})` }, hud); this.mini = M;
    el('rect', { x: 0, y: 0, width: 360, height: 232, rx: 6, fill: 'url(#hPanel)', stroke: '#fff', 'stroke-opacity': 0.1 }, M);
    txt(18, 26, 'TRAJECTORY  ·  SIDE VIEW', 12.5, { 'letter-spacing': 2.2, opacity: 0.6, filter: '' }, M);
    const sx = (x) => 30 + (x + 40) / 64 * 300, sy = (y) => 196 - y / 22 * 150;
    this.sx = sx; this.sy = sy;
    let d = '';
    for (let s = T.S1 - 20; s <= T.S_END; s += 0.5) { const c = T.curve(s); d += (d ? 'L' : 'M') + sx(c.x).toFixed(1) + ',' + sy(c.y).toFixed(1); }
    el('line', { x1: 14, x2: 346, y1: sy(0), y2: sy(0), stroke: '#fff', 'stroke-opacity': 0.25 }, M);
    el('path', { d, fill: 'none', stroke: '#9fb4cc', 'stroke-width': 3, 'stroke-opacity': 0.75 }, M);
    const top = T.state(T.T_REL);
    el('line', { x1: sx(top.pos.x), x2: sx(top.pos.x), y1: sy(top.pos.y), y2: sy(0), stroke: '#fff', 'stroke-dasharray': '3 5', 'stroke-opacity': 0.35 }, M);
    this.trail = el('path', { d: '', fill: 'none', stroke: '#ff3b3b', 'stroke-width': 2.2 }, M);
    this.dot = el('circle', { r: 6, fill: '#ff3b3b', stroke: '#fff', 'stroke-width': 2 }, M);
    this.trailPts = [];
    // 字幕条（下三分之一）
    const C = el('g', { transform: `translate(${W / 2},${H - 112})`, opacity: 0 }, hud); this.cap = C;
    this.capBg = el('rect', { x: -330, y: -46, width: 660, height: 76, rx: 4, fill: '#06080b', 'fill-opacity': 0.78 }, C);
    el('rect', { x: -330, y: -46, width: 660, height: 3, fill: '#e3121b' }, C);
    this.capEn = txt(0, -10, '', 26, { 'text-anchor': 'middle', 'font-weight': 800, 'letter-spacing': 3, filter: '' }, C);
    this.capZh = txt(0, 20, '', 19, { 'text-anchor': 'middle', 'letter-spacing': 4, opacity: 0.8, filter: '' }, C);
    this.holdBar = el('rect', { x: -330, y: 27, width: 0, height: 3, fill: '#fff', opacity: 0.9 }, C);
    this.lastCap = '';
    this.capT = 0;
  }

  caption(st, t) {
    const T = this.T;
    const map = {
      'APPROACH': ['APPROACH  ·  99 KM/H', '高速入坡'],
      'C-RAMP CLIMB': ['C-RAMP  ·  ' + Math.max(1, Math.round(st.gLoad * 10) / 10).toFixed(1) + ' G', '冲上 C 形巨型坡道'],
      'INVERTED · FAN LOCK · BRAKING': ['180° INVERTED  ·  SUCTION FANS LOCKED', '完全倒置 · 车底吸附风扇锁死'],
      'INVERTED HOLD': ['INVERTED HOLD  ·  1.0 S', '倒挂静止 1 秒'],
      'RELEASE · RCS ROLL': ['RELEASE  ·  COLD-GAS RCS ROLL', '脱离 · 冷气脉冲 180° 翻正'],
      'COLD-GAS DESCENT': ['RETRO COLD-GAS DESCENT', '车底反推冷气 · 减速下降'],
      'TOUCHDOWN': ['TOUCHDOWN  ·  ' + T.touchV.toFixed(1) + ' M/S', '四轮软着陆 · 悬挂压缩回弹'],
    };
    const [en, zh] = map[st.phase] || ['', ''];
    if (st.phase !== this.lastCap) { this.lastCap = st.phase; this.capT = 0; }
    this.capEn.textContent = en; this.capZh.textContent = zh;
    const w = Math.max(520, en.length * 19 + 80); this.capBg.setAttribute('x', -w / 2); this.capBg.setAttribute('width', w);
    this.holdBar.setAttribute('x', -w / 2);
    this.holdBar.setAttribute('width', st.phase === 'INVERTED HOLD' ? (w * Math.min(1, st.holdT / 1.0)).toFixed(1) : 0);
    void t;
  }

  update(dt, t, st, camera, car, opts) {
    const { replay = false, rate = 1, showHud = true } = opts;
    const T = this.T;
    // ---------------- 光斑
    const v = new THREE.Vector3(), camPos = camera.getWorldPosition(new THREE.Vector3());
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const occ = [...this.occluders, car];
    const focalScale = Math.min(1.6, Math.max(0.7, 12 / camera.fov));
    for (const F of this.fl) {
      const f = F.f;
      v.copy(f.pos).project(camera);
      const ahead = v.z < 1 && camDir.dot(new THREE.Vector3().subVectors(f.pos, camPos)) > 0;
      const sx = (v.x * 0.5 + 0.5) * W, sy = (1 - (v.y * 0.5 + 0.5)) * H;
      const onScreen = ahead && sx > -60 && sx < W + 60 && sy > -60 && sy < H + 60;
      const nearScreen = ahead && sx > -W * 0.6 && sx < W * 1.6 && sy > -H * 0.6 && sy < H * 1.6;
      let target = 0;
      if (nearScreen) {
        let facing = 1;
        if (f.dir) { const toCam = new THREE.Vector3().subVectors(camPos, f.pos).normalize(); facing = Math.pow(Math.max(0, toCam.dot(f.dir)), 2.2) * 0.85 + 0.15; }
        if (f.blink) facing *= ((t * 0.75 + f.blink) % 1) < 0.5 ? 1 : 0.03;
        let blocked = false;
        if (onScreen) {
          const dir = new THREE.Vector3().subVectors(f.pos, camPos); const dist = dir.length(); dir.normalize();
          this.ray.set(camPos, dir); this.ray.far = dist - 1.2;
          blocked = this.ray.intersectObjects(occ, true).length > 0;
        }
        target = blocked ? 0 : facing * (onScreen ? 1 : 0.35);
      }
      F.vis += (target - F.vis) * Math.min(1, dt * 14);
      const a = F.vis;
      if (a < 0.01) { F.g.setAttribute('opacity', 0); F.ghosts.setAttribute('opacity', 0); continue; }
      const size = f.size * focalScale;
      const k = (f.kind === 'beacon' ? 0.55 : 1);
      F.g.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
      F.g.setAttribute('opacity', (onScreen ? Math.min(1, a) * 0.8 : 0).toFixed(3));
      F.halo.setAttribute('r', (70 * size * k).toFixed(1));
      F.core.setAttribute('r', (6 * size * k).toFixed(1));
      F.tintC.setAttribute('r', (34 * size).toFixed(1));
      F.rays.setAttribute('transform', `scale(${(size * k * (f.kind === 'beacon' ? 0.4 : 1)).toFixed(3)})`);
      F.streak.setAttribute('rx', (560 * size * (f.kind === 'beacon' ? 0.25 : 1)).toFixed(1));
      F.streak.setAttribute('opacity', (f.kind === 'beacon' ? 0.4 : 0.75).toFixed(2));
      // 鬼影：沿光源→画面中心的轴线排布
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
      const ga = (f.kind === 'beacon' ? 0.25 : 1) * a * Math.min(1, focalScale * 0.8);
      F.ghosts.setAttribute('opacity', ga.toFixed(3));
      for (const gg of F.gl) gg.e.setAttribute('transform', `translate(${(cx + dx * gg.k).toFixed(1)},${(cy + dy * gg.k).toFixed(1)}) scale(${(0.6 + 0.4 * size).toFixed(3)})`);
    }

    // ---------------- HUD
    this.hud.style.opacity = showHud ? 1 : 0;
    const live = !replay;
    this.badgeBg.setAttribute('fill', live ? '#e3121b' : '#d18a00');
    this.badgeBg.setAttribute('width', live ? 118 : 190);
    this.badgeTxt.textContent = live ? 'LIVE' : 'REPLAY ' + rate + '×';
    this.badgeDot.setAttribute('opacity', live ? (0.5 + 0.5 * Math.round((Math.sin(performance.now() / 300) + 1) / 2)).toFixed(2) : 0);
    const focal = 12 / Math.tan(camera.fov * Math.PI / 360) * 1.0;
    this.camTxt.textContent = `CAM 4 · ${Math.round(focal / 10) * 10} mm`;
    const secs = 23 * 3600 + 41 * 60 + 7 + t;
    const hh = Math.floor(secs / 3600) % 24, mm = Math.floor(secs / 60) % 60, ss = Math.floor(secs) % 60;
    this.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} CDT`;
    const rel = t - T.T_REL; const ar = Math.abs(rel);
    this.tlabel.textContent = rel < 0 ? 'TO RELEASE' : 'SINCE RELEASE';
    this.tminus.textContent = `T${rel < 0 ? '−' : '+'}${String(Math.floor(ar / 60)).padStart(2, '0')}:${(ar % 60).toFixed(2).padStart(5, '0')}`;
    const vals = [
      Math.round(st.speed * 3.6).toString(),
      st.alt.toFixed(1),
      (st.vy >= 0 ? '+' : '') + st.vy.toFixed(1),
      st.gLoad.toFixed(1),
      Math.round(st.roll).toString(),
      (st.fan * 14.2).toFixed(1),
      Math.round(st.throttle / 2.2 * 100).toString(),
    ];
    vals.forEach((s, i) => { this.cells[i].v.textContent = s; });
    this.cells[3].v.setAttribute('fill', Math.abs(st.gLoad) > 5 ? '#ffcf3a' : '#fff');
    this.rcsDots.forEach((r, i) => r.setAttribute('fill', st.rcs[i] ? '#ffffff' : '#2a2f36'));
    // 小图
    const px = this.sx(st.pos.x), py = this.sy(st.alt + (st.roll > 90 && st.alt > 1 ? 0 : 0));
    this.dot.setAttribute('cx', px.toFixed(1)); this.dot.setAttribute('cy', py.toFixed(1));
    if (!this.trailPts.length || Math.hypot(this.trailPts[this.trailPts.length - 1][0] - px, this.trailPts[this.trailPts.length - 1][1] - py) > 2) this.trailPts.push([px, py]);
    if (this.trailPts.length > 400) this.trailPts.shift();
    this.trail.setAttribute('d', this.trailPts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(''));
    // 字幕
    this.caption(st, t);
    this.capT += dt;
    const fadeIn = Math.min(1, this.capT / 0.25), fadeOut = st.phase === 'APPROACH' ? 1 : 1;
    this.cap.setAttribute('opacity', (fadeIn * fadeOut).toFixed(2));
  }
  resetTrail() { this.trailPts = []; }
}
