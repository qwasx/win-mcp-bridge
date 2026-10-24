// overlay.js — SVG 直播 HUD（遥测/字幕/跟踪框/时间码）+ SVG 镜头眩光（screen 混合）
const SVGNS = 'http://www.w3.org/2000/svg';
function E(name, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}
const MONO = `'SF Mono',ui-monospace,Menlo,Consolas,monospace`;
const CJK = `'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`;
const ACCENT = '#7fd8ff', AMBER = '#ffb45e', RED = '#ff5252', GREEN = '#5dff9a';

// ============================== HUD ==============================
export class Hud {
  constructor(container) {
    this.svg = E('svg', { id: 'hud-svg', style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:30' });
    container.appendChild(this.svg);
    const defs = E('defs', {}, this.svg);
    defs.innerHTML = `
      <radialGradient id="vg" cx="50%" cy="46%" r="72%">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="62%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,.58)"/>
      </radialGradient>`;
    // 渐晕
    this.vignette = E('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#vg)' }, this.svg);

    this.gTop = E('g', {}, this.svg);       // 顶部信息
    this.gPanel = E('g', {}, this.svg);     // 左下遥测面板
    this.gCap = E('g', {}, this.svg);       // 底部字幕
    this.gRet = E('g', { opacity: 0 }, this.svg); // 跟踪框
    this.gCut = E('g', {}, this.svg);       // 切换提示
    this.gFlash = E('g', {}, this.svg);
    this.gFade = E('g', {}, this.svg);

    // —— 顶部左：LIVE ——
    this.dot = E('circle', { r: 7, fill: RED }, this.gTop);
    E('text', { x: 18, y: 5, fill: '#fff', 'font-size': 20, 'font-weight': 700, 'font-family': MONO }, this.gTop).textContent = 'LIVE';
    this.title1 = E('text', { x: 78, y: -8, fill: 'rgba(255,255,255,.92)', 'font-size': 17, 'font-weight': 600, 'font-family': CJK }, this.gTop);
    this.title1.textContent = 'SPACEX 星港 · 得州夜间试验场';
    this.time = E('text', { x: 78, y: 14, fill: ACCENT, 'font-size': 15, 'font-family': MONO }, this.gTop);
    this.time.textContent = 'T+00:00.0';

    // —— 顶部中：机位 ——
    this.camName = E('text', { x: 0, y: 0, 'text-anchor': 'middle', fill: '#fff', 'font-size': 16, 'font-weight': 600, 'font-family': CJK, opacity: .9 }, this.gCut);

    // —— 顶部右 ——
    this.gTR = E('g', {}, this.gTop);
    this.spec = E('text', { x: 0, y: -6, 'text-anchor': 'end', fill: 'rgba(255,255,255,.75)', 'font-size': 14, 'font-family': MONO }, this.gTR);
    this.spec.textContent = '8K · 800mm T2.8 · ISO 3200 · 24fps';
    this.batt = E('text', { x: 0, y: 13, 'text-anchor': 'end', fill: 'rgba(255,255,255,.75)', 'font-size': 14, 'font-family': MONO }, this.gTR);
    this.batt.textContent = 'BATT 78%';
    this.bars = [];
    for (let i = 0; i < 4; i++) this.bars.push(E('rect', { height: 4 + i * 3.2, width: 4, fill: ACCENT }, this.gTR));

    // —— 左下遥测面板 ——
    this.panelBg = E('rect', { rx: 10, fill: 'rgba(7,11,17,.62)', stroke: 'rgba(127,216,255,.28)', 'stroke-width': 1 }, this.gPanel);
    E('text', { class: 'pTitle', fill: 'rgba(127,216,255,.85)', 'font-size': 13, 'font-family': MONO, 'letter-spacing': 2 }, this.gPanel).textContent = 'TELEMETRY · 遥测';
    this.speed = E('text', { class: 'pSpeed', fill: '#fff', 'font-size': 44, 'font-weight': 700, 'font-family': MONO }, this.gPanel);
    this.speedU = E('text', { class: 'pSpeedU', fill: 'rgba(255,255,255,.55)', 'font-size': 14, 'font-family': MONO }, this.gPanel);
    this.speedU.textContent = 'km/h';
    this.altV = E('text', { class: 'pAlt', fill: '#fff', 'font-size': 17, 'font-family': MONO }, this.gPanel);
    this.gV = E('text', { class: 'pG', fill: '#fff', 'font-size': 17, 'font-family': MONO }, this.gPanel);
    this.attV = E('text', { class: 'pAtt', fill: '#fff', 'font-size': 17, 'font-family': MONO }, this.gPanel);
    E('text', { class: 'lAlt', fill: 'rgba(255,255,255,.5)', 'font-size': 12, 'font-family': CJK }, this.gPanel).textContent = '高度 m';
    E('text', { class: 'lG', fill: 'rgba(255,255,255,.5)', 'font-size': 12, 'font-family': CJK }, this.gPanel).textContent = '载荷 g';
    E('text', { class: 'lAtt', fill: 'rgba(255,255,255,.5)', 'font-size': 12, 'font-family': CJK }, this.gPanel).textContent = '横滚 °';
    // 速度曲线
    this.grid1 = E('line', { class: 'grid', stroke: 'rgba(127,216,255,.18)', 'stroke-width': 1 }, this.gPanel);
    this.grid2 = E('line', { class: 'grid', stroke: 'rgba(127,216,255,.12)', 'stroke-width': 1 }, this.gPanel);
    this.graph = E('polyline', { fill: 'none', stroke: ACCENT, 'stroke-width': 1.6, opacity: .9 }, this.gPanel);
    // 状态行
    this.rows = [];
    for (const [label] of [['吸附风扇'], ['反推冷气'], ['姿态']]) {
      const dot = E('circle', { r: 4, fill: '#555' }, this.gPanel);
      const t = E('text', { class: 'rLabel', fill: 'rgba(255,255,255,.55)', 'font-size': 13, 'font-family': CJK }, this.gPanel);
      t.textContent = label;
      const v = E('text', { class: 'rVal', fill: '#ddd', 'font-size': 13.5, 'font-family': CJK, 'font-weight': 600 }, this.gPanel);
      this.rows.push({ dot, t, v });
    }

    // —— 底部字幕 ——
    this.capBg = E('rect', { rx: 15, fill: 'rgba(6,10,16,.66)', stroke: 'rgba(255,255,255,.14)' }, this.gCap);
    this.cap = E('text', { 'text-anchor': 'middle', fill: '#fff', 'font-size': 21, 'font-weight': 600, 'font-family': CJK }, this.gCap);
    this.capOpacity = 1;

    // —— 跟踪框 ——
    this.retCol = ACCENT;
    this.bracket = E('path', { fill: 'none', stroke: this.retCol, 'stroke-width': 2.2, opacity: .95 }, this.gRet);
    this.retTxt = E('text', { 'text-anchor': 'middle', fill: this.retCol, 'font-size': 13, 'font-family': MONO }, this.gRet);
    this.retTxt2 = E('text', { 'text-anchor': 'middle', fill: 'rgba(255,255,255,.72)', 'font-size': 12, 'font-family': CJK }, this.gRet);

    // —— 切换白闪 / 黑场 ——
    this.flashRect = E('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: '#eaf4ff', opacity: 0 }, this.gFlash);
    this.fadeRect = E('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: '#000', opacity: 1 }, this.gFade);
    this.badge = E('text', { x: 0, y: 0, 'text-anchor': 'middle', fill: '#fff', 'font-size': 30, 'font-weight': 800, 'font-family': MONO, opacity: 0, 'letter-spacing': 6 }, this.gFade);
    this.badge.textContent = 'REPLAY';

    this.W = 1280; this.H = 720;
    this.samples = new Array(90).fill(0);
    this.ret = { x: 0, y: 0, s: 100, on: false };
    this.flashA = 0;
    this.v = new THREEVec();
  }

  layout(W, H) {
    this.W = W; this.H = H;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.gTop.setAttribute('transform', `translate(24,34)`);
    this.gTR.setAttribute('transform', `translate(${W - 24},34)`);
    for (let i = 0; i < 4; i++) this.bars[i].setAttribute('x', -160 + i * 7);
    for (const b of this.bars) b.setAttribute('y', 14 - +b.getAttribute('height'));
    const pw = 262, ph = 172;
    this.panelBg.setAttribute('x', 0); this.panelBg.setAttribute('y', 0);
    this.panelBg.setAttribute('width', pw); this.panelBg.setAttribute('height', ph);
    this.gPanel.setAttribute('transform', `translate(20,${H - ph - 20})`);
    const q = (c) => this.gPanel.querySelector(c);
    q('.pTitle').setAttribute('x', 16); q('.pTitle').setAttribute('y', 24);
    q('.pSpeed').setAttribute('x', 16); q('.pSpeed').setAttribute('y', 68);
    q('.pSpeedU').setAttribute('x', 108); q('.pSpeedU').setAttribute('y', 66);
    q('.pAlt').setAttribute('x', 150); q('.pAlt').setAttribute('y', 58);
    q('.pG').setAttribute('x', 150); q('.pG').setAttribute('y', 80);
    q('.pAtt').setAttribute('x', 222); q('.pAtt').setAttribute('y', 58);
    q('.lAlt').setAttribute('x', 150); q('.lAlt').setAttribute('y', 40);
    q('.lG').setAttribute('x', 150); q('.lG').setAttribute('y', 96);
    q('.lAtt').setAttribute('x', 222); q('.lAtt').setAttribute('y', 74);
    this.grid1.setAttribute('x1', 16); this.grid1.setAttribute('x2', pw - 16);
    this.grid1.setAttribute('y1', 92); this.grid1.setAttribute('y2', 92);
    this.grid2.setAttribute('x1', 16); this.grid2.setAttribute('x2', pw - 16);
    this.grid2.setAttribute('y1', 122); this.grid2.setAttribute('y2', 122);
    this.graph.setAttribute('x1', 0);
    // 状态行
    const rows = this.gPanel.querySelectorAll('.rLabel');
    const vals = this.gPanel.querySelectorAll('.rVal');
    const dots = this.gPanel.querySelectorAll('circle');
    const rowY = [146, 166, 186];
    this.rows.forEach((r, i) => {
      r.t.setAttribute('x', 16); r.t.setAttribute('y', rowY[i]);
      r.v.setAttribute('x', 110); r.v.setAttribute('y', rowY[i]);
    });
    // rows 的圆点取 gPanel 中非 panelBg 的前三个 circle
    const circles = [...this.gPanel.querySelectorAll('circle')];
    circles.slice(0, 3).forEach((c, i) => { c.setAttribute('cx', 9); c.setAttribute('cy', rowY[i] - 4); });
    // 字幕
    this.cap.setAttribute('x', W / 2); this.cap.setAttribute('y', H - 46);
    this.capBg.setAttribute('x', W / 2 - this.cap.getComputedTextLength() / 2 - 18);
    this.capBg.setAttribute('y', H - 68);
    this.capBg.setAttribute('width', this.cap.getComputedTextLength() + 36);
    this.capBg.setAttribute('height', 34);
  }

  caption(text) { this.cap.textContent = text; this.capOpacity = 0; this.layout(this.W, this.H); }
  cut(name) { this.camName.textContent = name; this.flashA = Math.max(this.flashA, .5); this.layout(this.W, this.H); }

  update(dt, t, camera, sim) {
    const { W, H } = this;
    // 顶部
    this.dot.setAttribute('opacity', Math.sin(t * 5) > -0.2 ? 1 : .25);
    const s = sim.t;
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = (s % 60).toFixed(1).padStart(4, '0');
    this.time.textContent = `T+${mm}:${ss}`;
    // 遥测
    this.speed.textContent = Math.round(sim.speedKmh);
    this.altV.textContent = sim.alt.toFixed(1);
    this.gV.textContent = sim.gLoad.toFixed(2);
    this.attV.textContent = Math.round(sim.attDeg);
    // 速度历史
    this.samples.push(sim.speedKmh); this.samples.shift();
    const gw = 230, gh = 30, gx = 16, gy = 122;
    let pts = '';
    const smax = 130;
    for (let i = 0; i < this.samples.length; i++) {
      const x = gx + (i / (this.samples.length - 1)) * gw;
      const y = gy - (Math.min(this.samples[i], smax) / smax) * gh;
      pts += `${x.toFixed(1)},${y.toFixed(1)} `;
    }
    this.graph.setAttribute('points', pts);
    // 状态行颜色
    const setRow = (i, val, col) => {
      this.rows[i].v.textContent = val;
      this.rows[i].v.setAttribute('fill', col);
      this.rows[i].dot.setAttribute('fill', col);
    };
    setRow(0, sim.fanTxt, sim.fanCol);
    setRow(1, sim.retroTxt, sim.retroCol);
    setRow(2, sim.attTxt, sim.attCol);

    // 字幕淡入
    this.capOpacity = Math.min(1, this.capOpacity + dt * 2.2);
    this.cap.setAttribute('opacity', this.capOpacity);
    this.capBg.setAttribute('opacity', this.capOpacity * .95);

    // 跟踪框
    if (sim.retOn) {
      const p = sim.carPos.clone().project(camera);
      const inFront = p.z < 1;
      const tx = (p.x * .5 + .5) * W, ty = (-p.y * .5 + .5) * H;
      const dist = camera.position.distanceTo(sim.carPos);
      const target = Math.min(Math.max(3600 / Math.max(dist, 8), 54), 240);
      const k = 1 - Math.exp(-dt * 10);
      if (!this.ret.on) { this.ret.x = tx; this.ret.y = ty; this.ret.s = target; }
      this.ret.x += (tx - this.ret.x) * k;
      this.ret.y += (ty - this.ret.y) * k;
      this.ret.s += (target - this.ret.s) * k;
      this.ret.on = true;
      const { x, y, sz } = { x: this.ret.x, y: this.ret.y, sz: this.ret.s / 2 };
      const hh = sz * .55;
      const d = `M ${x - sz},${y - sz + hh} L ${x - sz},${y - sz} L ${x - sz + hh},${y - sz}
                 M ${x + sz - hh},${y - sz} L ${x + sz},${y - sz} L ${x + sz},${y - sz + hh}
                 M ${x + sz},${y + sz - hh} L ${x + sz},${y + sz} L ${x + sz - hh},${y + sz}
                 M ${x - sz + hh},${y + sz} L ${x - sz},${y + sz} L ${x - sz},${y + sz - hh}`;
      this.bracket.setAttribute('d', d);
      this.bracket.setAttribute('stroke', sim.retCol);
      this.retTxt.setAttribute('x', x); this.retTxt.setAttribute('y', y - sz - 10);
      this.retTxt.setAttribute('fill', sim.retCol);
      this.retTxt.textContent = `TRK ▸ ROADSTER-02  ${(dist | 0)}m`;
      this.retTxt2.setAttribute('x', x); this.retTxt2.setAttribute('y', y + sz + 18);
      this.retTxt2.textContent = sim.retSub;
      this.gRet.setAttribute('opacity', inFront ? .95 : 0);
    } else {
      this.ret.on = false;
      this.gRet.setAttribute('opacity', 0);
    }

    // 白闪 / 黑场
    this.flashA *= Math.exp(-dt * 16);
    this.flashRect.setAttribute('opacity', this.flashA.toFixed(3));
    const fade = Math.max(sim.fade, sim.fadeIn);
    this.fadeRect.setAttribute('opacity', fade.toFixed(3));
    this.badge.setAttribute('x', W / 2);
    this.badge.setAttribute('y', H * .44);
    this.badge.setAttribute('opacity', sim.badge);
  }
}

// 免引入 three 的小占位（仅类型）；真实 vector 由 director 传入
function THREEVec() { return null; }

// ============================== SVG 镜头眩光 ==============================
export class Flares {
  constructor(container) {
    this.svg = E('svg', {
      id: 'flare-svg',
      style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:20;mix-blend-mode:screen',
    }, container);
    const defs = E('defs', {}, this.svg);
    defs.innerHTML = `
      <radialGradient id="fgCore">
        <stop offset="0%" stop-color="rgba(255,255,255,1)"/>
        <stop offset="22%" stop-color="rgba(220,238,255,.55)"/>
        <stop offset="55%" stop-color="rgba(150,190,255,.14)"/>
        <stop offset="100%" stop-color="rgba(120,160,255,0)"/>
      </radialGradient>
      <radialGradient id="fgHalo">
        <stop offset="0%" stop-color="rgba(170,205,255,.42)"/>
        <stop offset="45%" stop-color="rgba(130,165,255,.12)"/>
        <stop offset="100%" stop-color="rgba(110,150,255,0)"/>
      </radialGradient>
      <linearGradient id="fgStreak" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(190,220,255,0)"/>
        <stop offset="50%" stop-color="rgba(235,246,255,.85)"/>
        <stop offset="100%" stop-color="rgba(190,220,255,0)"/>
      </linearGradient>
      <filter id="fgBlur" x="-60%" y="-400%" width="220%" height="900%">
        <feGaussianBlur stdDeviation="5 1.4"/>
      </filter>`;
    this.g = E('g', {}, this.svg);
    this.sources = [];
    this.v = null; // 注入 THREE.Vector3
  }

  add(src) { // {getPos():Vector3|null, getI():0..1, size, streak, tint}
    const g = E('g', { opacity: 0 }, this.g);
    const halo = E('circle', { r: 90, fill: 'url(#fgHalo)' }, g);
    const core = E('circle', { r: 15, fill: 'url(#fgCore)' }, g);
    const streak = E('rect', { x: -260, y: -1.6, width: 520, height: 3.2, fill: 'url(#fgStreak)', filter: 'url(#fgBlur)' }, g);
    const ghosts = [];
    const gcfg = [[-.55, 7, '#8fd8ff', .5], [-1.2, 16, '#9fe8d8', .32], [.45, 9, '#ffd9a8', .45], [1.5, 24, '#ff9a6a', .2]];
    for (const [k, r, col, op] of gcfg) {
      ghosts.push(E('circle', { r, fill: 'none', stroke: col, 'stroke-width': 1.6, opacity: op }, g));
      ghosts[ghosts.length - 1]._k = k;
    }
    this.sources.push({ ...src, g, halo, core, streak, ghosts });
  }

  update(camera, W, H, t) {
    const cx = W / 2, cy = H / 2;
    for (const s of this.sources) {
      const wp = s.getPos();
      const i = wp ? Math.max(0, Math.min(1, s.getI())) : 0;
      if (!wp || i <= 0.003) { s.g.setAttribute('opacity', 0); continue; }
      this._p = this._p || (this.v ? this.v() : null);
      const v = this._p || wp.clone();
      v.copy(wp).project(camera);
      const ndcX = v.x, ndcY = v.y;
      if (v.z > 1 || v.z < -1) { s.g.setAttribute('opacity', 0); continue; }
      const x = (ndcX * .5 + .5) * W, y = (-ndcY * .5 + .5) * H;
      const edge = 1 - Math.min(1, (Math.max(Math.abs(ndcX), Math.abs(ndcY)) - .82) / .3);
      const I = i * Math.max(0, edge);
      if (I <= 0.004) { s.g.setAttribute('opacity', 0); continue; }
      const sc = (s.size ?? 1) * (W / 1280);
      const flick = .9 + .1 * Math.sin(t * 47 + x * .13);
      s.g.setAttribute('opacity', I.toFixed(3));
      s.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      s.halo.setAttribute('r', 95 * sc * flick);
      s.core.setAttribute('r', (13 + 9 * I) * sc);
      s.streak.setAttribute('width', 560 * sc * (.5 + I));
      s.streak.setAttribute('x', -280 * sc * (.5 + I));
      s.streak.setAttribute('opacity', .8 * I);
      const dx = cx - x, dy = cy - y;
      for (const gh of s.ghosts) {
        const k = gh._k;
        gh.setAttribute('cx', (dx * k).toFixed(1));
        gh.setAttribute('cy', (dy * k).toFixed(1));
        gh.setAttribute('opacity', (.3 * I).toFixed(3));
      }
    }
  }
}
