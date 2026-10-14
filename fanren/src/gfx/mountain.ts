// 程序生成的水墨/青绿山体：每座山由种子决定，轮廓、峰数、皴法、苔点、松树、瀑布、山路、亭子各不相同
import { makeCanvas, shade, mix, rgba } from '../core/canvas';
import { mulberry32, valueNoise, clamp } from '../core/rng';

export type MtnStyle = 'qinglv' | 'qianjiang' | 'snow' | 'demon' | 'desert' | 'island' | 'hill' | 'karst';

export interface MtnSpec {
  seed: number; style: MtnStyle; w: number; h: number;
  cliff?: boolean; waterfall?: boolean; path?: boolean; pavilion?: boolean; clouds?: boolean;
  layers?: number; // 1–3 层
  snowcap?: boolean; // 非雪山的峰顶积雪
  tex?: number;    // 纹理分辨率（纹理像素 / 世界像素）
}

export interface MtnSprite {
  canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; // 世界尺寸与锚点（底部中心）
  falls: { x: number; y: number; w: number; h: number }[];
  pixels: number;
}

interface Pal { top: string; mid: string; base: string; ink: string; far: string; accent?: string; moss: string }
const PALS: Record<MtnStyle, Pal> = {
  qinglv: { top: '#2f6470', mid: '#5d9478', base: '#cdb98e', ink: '#1f2a28', far: '#9fb5b8', moss: '#1d3a2c' },
  karst: { top: '#356a6a', mid: '#6a9a7a', base: '#cfc092', ink: '#1f2a28', far: '#a8bcb6', moss: '#1d3a2c' },
  qianjiang: { top: '#6d7c72', mid: '#a8956e', base: '#dcc89c', ink: '#2a2620', far: '#b8b8a8', accent: '#a4683e', moss: '#2a3424' },
  snow: { top: '#f3f5f8', mid: '#8e9eac', base: '#6f7f88', ink: '#2a3038', far: '#c8d2dc', moss: '#3a4a50' },
  demon: { top: '#2e2230', mid: '#4f2a38', base: '#6e5048', ink: '#140c10', far: '#6a5a68', accent: '#d0304a', moss: '#2a1018' },
  desert: { top: '#b8743e', mid: '#d29c5e', base: '#e6c894', ink: '#4a2e18', far: '#e0c4a0', accent: '#8a4a28', moss: '#5a4a2a' },
  island: { top: '#2f6a68', mid: '#5f9a74', base: '#c8b88a', ink: '#1f2a28', far: '#9fbcbc', moss: '#1d3a2c' },
  hill: { top: '#6f9670', mid: '#93ad80', base: '#cfc596', ink: '#2a3024', far: '#b8c4a8', moss: '#2a4028' },
};

type Peak = { cx: number; hgt: number; wid: number; sharp: number; round: number };

function ridgeFn(peaks: Peak[], w: number, h: number, seed: number, rough: number, flat = 0) {
  return (x: number) => {
    let y = 0;
    for (const p of peaks) {
      const t = Math.abs(x - p.cx) / p.wid;
      if (t >= 1) continue;
      const s = Math.pow(1 - Math.pow(t, p.round), p.sharp);
      y = Math.max(y, p.hgt * s);
    }
    if (flat > 0) { const cap = h * flat; if (y > cap) y = cap + (y - cap) * 0.08; }
    // 多倍频噪声 → 山脊起伏与嶙峋
    const n = (valueNoise(x / 38, seed, 3) - 0.5) * 0.55 + (valueNoise(x / 13, seed, 7) - 0.5) * 0.3 + (valueNoise(x / 4.5, seed, 9) - 0.5) * 0.15;
    let edge = clamp(Math.min(x, w - x) / (w * 0.22), 0, 1); edge = edge * edge * (3 - 2 * edge);
    return Math.max(0, (y + n * rough * (0.35 + y / h)) * edge);
  };
}

export function makeMountain(spec: MtnSpec): MtnSprite {
  const rnd = mulberry32(spec.seed >>> 0);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const pal = PALS[spec.style];
  const { w, h } = spec;
  const tex = spec.tex ?? 0.9;
  const fogH = h * 0.14;
  const top = h * 0.06;
  const W = w, H = h + fogH + top;
  const cv = makeCanvas(W * tex, H * tex);
  const g = cv.getContext('2d')!;
  g.scale(tex, tex);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const baseY = top + h;
  const falls: MtnSprite['falls'] = [];
  const style = spec.style;
  const layers = spec.layers ?? (style === 'hill' || style === 'island' ? 2 : 3);

  // 峰形参数
  const mkPeaks = (scaleH: number, count: number, spread: number): Peak[] => {
    const peaks: Peak[] = [];
    const main = R(0.38, 0.62) * w;
    for (let i = 0; i < count; i++) {
      const cx = i === 0 ? main : clamp(main + R(-0.5, 0.5) * w * spread, w * 0.12, w * 0.88);
      let hgt = (i === 0 ? 1 : R(0.45, 0.85)) * h * scaleH;
      let wid = R(0.22, 0.42) * w * (i === 0 ? 1.2 : 1);
      let sharp = R(0.9, 1.6), round = R(1.2, 2.2);
      if (style === 'karst') { wid *= 0.45; sharp = R(0.35, 0.6); round = R(2.5, 4); hgt *= R(0.8, 1.05); }
      if (style === 'hill') { sharp = R(0.6, 0.9); round = R(1.8, 2.6); wid *= 1.4; }
      if (style === 'snow') { sharp = R(1.3, 2.2); round = R(1.0, 1.4); }
      if (style === 'demon') { sharp = R(1.6, 2.6); round = R(0.9, 1.3); wid *= 0.75; }
      if (style === 'desert') { sharp = R(0.25, 0.4); round = R(3, 5); }
      wid = Math.min(wid, Math.min(cx, w - cx) * (style === 'karst' || style === 'desert' || style === 'hill' ? 0.9 : 1.1));
      peaks.push({ cx, hgt, wid, sharp, round });
    }
    return peaks;
  };
  const peakCount = style === 'karst' ? Math.floor(R(3, 6)) : style === 'hill' ? Math.floor(R(1, 3)) : Math.floor(R(2, 5));
  const roughBase = style === 'hill' ? 0.03 : style === 'desert' ? 0.04 : style === 'demon' ? 0.16 : 0.1;
  const flat = style === 'desert' ? R(0.5, 0.75) : 0;

  // 层：远 → 中 → 近
  const layerDefs = [] as { peaks: Peak[]; rough: number; dy: number; tone: number; detail: number; seed: number }[];
  if (layers >= 3) layerDefs.push({ peaks: mkPeaks(1.0, peakCount + 1, 0.9), rough: roughBase * h * 0.8, dy: -0.0, tone: 0.62, detail: 0.25, seed: spec.seed + 11 });
  if (layers >= 2) layerDefs.push({ peaks: mkPeaks(layers >= 3 ? 0.82 : 1.0, peakCount, 0.8), rough: roughBase * h, dy: 0, tone: layers >= 3 ? 0.18 : 0.08, detail: 1, seed: spec.seed + 23 });
  layerDefs.push({ peaks: mkPeaks(layers >= 2 ? 0.5 : 1.0, Math.max(1, peakCount - 1), 0.9), rough: roughBase * h * 0.9, dy: 0, tone: 0, detail: 1.15, seed: spec.seed + 37 });

  layerDefs.forEach((L, li) => {
    const ridge = ridgeFn(L.peaks, w, h, L.seed, L.rough, flat);
    const isFar = L.tone > 0.4;
    const isFront = li === layerDefs.length - 1;
    // 轮廓
    const STEP = Math.max(2, w / 260);
    const path = new Path2D();
    path.moveTo(0, baseY + 2);
    const xs: number[] = [], ys: number[] = [];
    for (let x = 0; x <= w; x += STEP) { const y = baseY - ridge(x); xs.push(x); ys.push(y); path.lineTo(x, y); }
    path.lineTo(w, baseY + 2); path.closePath();
    let peakY = baseY; for (const y of ys) peakY = Math.min(peakY, y);
    const mh = baseY - peakY;
    if (mh < 6) return;
    // 填色：上深下浅，底部融入雾气
    const topC = mix(pal.top, pal.far, L.tone), midC = mix(pal.mid, pal.far, L.tone), baseC = mix(pal.base, pal.far, L.tone * 0.6);
    const gr = g.createLinearGradient(0, peakY, 0, baseY);
    gr.addColorStop(0, topC); gr.addColorStop(0.45, midC); gr.addColorStop(0.88, baseC); gr.addColorStop(1, rgba(baseC, 0.0));
    g.fillStyle = gr; g.fill(path);

    g.save(); g.clip(path);
    // 明暗面：从轮廓上的局部高点向下“随机游走”的山脊线；山脊右侧（背光）压暗，边缘柔和
    const dark = style === 'snow' ? '#5a6e88' : shade(pal.top, -0.5);
    const starts: number[] = [];
    for (let i = 2; i < xs.length - 2; i++) {
      if (ys[i] <= ys[i - 1] && ys[i] <= ys[i + 1] && ys[i] <= ys[i - 2] && ys[i] <= ys[i + 2] && baseY - ys[i] > mh * 0.25) starts.push(i);
    }
    for (let k = 0; k < Math.floor(xs.length / 22); k++) { const i = 2 + Math.floor(rnd() * (xs.length - 4)); if (baseY - ys[i] > mh * 0.3) starts.push(i); }
    for (const si of starts) {
      const nR = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let r = 0; r < nR; r++) {
        let x = xs[si], y = ys[si] + 1;
        const ptsL: [number, number][] = [[x, y]];
        const bias = R(-0.35, 0.55);
        const stepY = Math.max(4, mh / 26);
        while (y < baseY) {
          const sl = (ridge(x + 5) - ridge(x - 5)) / 10;
          x += (bias - sl * 0.6) * stepY * 0.9 + R(-1, 1) * stepY * 0.55;
          y += stepY * R(0.8, 1.2);
          ptsL.push([x, Math.min(y, baseY + 4)]);
        }
        const wid = R(0.06, 0.16) * w * (isFar ? 1.4 : 1);
        const sh = new Path2D();
        sh.moveTo(ptsL[0][0], ptsL[0][1]);
        for (const [px, py] of ptsL) sh.lineTo(px, py);
        for (let i = ptsL.length - 1; i >= 0; i--) {
          const t = i / (ptsL.length - 1);
          sh.lineTo(ptsL[i][0] + wid * (0.15 + t) + (valueNoise(i, si, 21) - 0.5) * wid * 0.4, ptsL[i][1]);
        }
        sh.closePath();
        const x0 = ptsL[0][0];
        const sg = g.createLinearGradient(x0, 0, x0 + wid * 1.1, 0);
        sg.addColorStop(0, rgba(dark, isFar ? 0.1 : 0.3)); sg.addColorStop(0.6, rgba(dark, isFar ? 0.04 : 0.12)); sg.addColorStop(1, rgba(dark, 0));
        g.fillStyle = sg; g.fill(sh);
        if (!isFar) {
          // 山脊墨线（干笔，渐细）
          g.strokeStyle = rgba(pal.ink, 0.42 * L.detail);
          for (let i = 1; i < ptsL.length; i++) {
            g.lineWidth = Math.max(0.5, 2.0 * (1 - i / ptsL.length));
            g.beginPath(); g.moveTo(ptsL[i - 1][0], ptsL[i - 1][1]); g.lineTo(ptsL[i][0], ptsL[i][1]); g.stroke();
          }
          // 披麻皴：沿山脊两侧的平行细线
          g.strokeStyle = rgba(pal.ink, 0.18 * L.detail); g.lineWidth = 0.8;
          for (let j = 0; j < 4; j++) {
            const off = R(2, wid * 0.7), i0 = Math.floor(rnd() * (ptsL.length - 2)), len = 2 + Math.floor(rnd() * 4);
            g.beginPath(); g.moveTo(ptsL[i0][0] + off, ptsL[i0][1]);
            for (let i = i0 + 1; i < Math.min(ptsL.length, i0 + len); i++) g.lineTo(ptsL[i][0] + off * (1 + (i - i0) * 0.08), ptsL[i][1]);
            g.stroke();
          }
        }
      }
    }
    // 亮面高光（青绿山水的留白）
    if (!isFar && style !== 'snow' && style !== 'demon') {
      for (const p of L.peaks) {
        const px = p.cx, py = baseY - ridge(px);
        const hl = g.createRadialGradient(px - p.wid * 0.3, py + mh * 0.3, 0, px - p.wid * 0.3, py + mh * 0.3, p.wid * 0.55);
        hl.addColorStop(0, 'rgba(255,250,230,0.18)'); hl.addColorStop(1, 'rgba(255,250,230,0)');
        g.fillStyle = hl; g.fillRect(px - p.wid, py, p.wid * 1.5, mh);
      }
      // 赭石暖色斑块
      for (let i = 0; i < 4; i++) {
        const x = R(0.15, 0.85) * w, y = baseY - ridge(x) * R(0.1, 0.45);
        const r = R(0.06, 0.14) * w;
        const og = g.createRadialGradient(x, y, 0, x, y, r);
        og.addColorStop(0, rgba(style === 'qianjiang' ? '#b0703e' : '#b89a5a', 0.22)); og.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = og; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // 峰顶积雪（高山而非雪域）
    if (style !== 'snow' && spec.snowcap) {
      let top = baseY; for (let i = 0; i < ys.length; i++) if (ys[i] < top) top = ys[i];
      const capY = top + (baseY - top) * 0.3;
      const cap = new Path2D();
      cap.moveTo(xs[0], ys[0]);
      for (let i = 0; i < xs.length; i++) cap.lineTo(xs[i], ys[i]);
      for (let i = xs.length - 1; i >= 0; i--) {
        const yy = capY + (valueNoise(xs[i] / 14, L.seed, 8) - 0.5) * (baseY - top) * 0.18 + (valueNoise(xs[i] / 4, L.seed, 9) - 0.5) * 8;
        cap.lineTo(xs[i], Math.max(ys[i], yy));
      }
      cap.closePath();
      g.fillStyle = isFar ? 'rgba(240,244,248,0.7)' : 'rgba(246,248,251,0.93)'; g.fill(cap);
      g.save(); g.clip(cap);
      const sg = g.createLinearGradient(0, 0, w, 0);
      sg.addColorStop(0, 'rgba(110,130,165,0)'); sg.addColorStop(0.6, 'rgba(110,130,165,0.18)'); sg.addColorStop(1, 'rgba(110,130,165,0.38)');
      g.fillStyle = sg; g.fillRect(0, top, w, baseY - top); g.restore();
    }
    // 雪
    if (style === 'snow') {
      const snow = new Path2D();
      snow.moveTo(0, baseY);
      for (let i = 0; i < xs.length; i++) snow.lineTo(xs[i], ys[i]);
      for (let i = xs.length - 1; i >= 0; i--) {
        const dep = (baseY - ys[i]) * (0.42 + 0.22 * valueNoise(xs[i] / 18, L.seed, 5)) + (valueNoise(xs[i] / 5, L.seed, 6) - 0.5) * 10;
        snow.lineTo(xs[i], ys[i] + Math.max(0, dep));
      }
      snow.closePath();
      g.fillStyle = isFar ? 'rgba(244,246,250,0.75)' : 'rgba(248,250,252,0.96)'; g.fill(snow);
      // 雪面阴影 (snow)
      for (const p of L.peaks) {
        const px = p.cx, py = baseY - ridge(px);
        const sg = g.createLinearGradient(px - p.wid * 0.1, 0, px + p.wid * 0.7, 0);
        sg.addColorStop(0, 'rgba(120,140,175,0)'); sg.addColorStop(0.15, 'rgba(120,140,175,0.4)'); sg.addColorStop(1, 'rgba(120,140,175,0)');
        g.save(); g.clip(snow); g.fillStyle = sg; g.fillRect(px - p.wid * 0.1, py, p.wid, mh); g.restore();
      }
    }
    // 皴法笔触
    if (!isFar) {
      const n = Math.floor((w * mh) / (style === 'hill' ? 700 : 260) * L.detail * Math.min(1, tex * 1.4));
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const ry = baseY - ridge(x);
        if (baseY - ry < 8) continue;
        const y = ry + Math.pow(rnd(), 0.8) * (baseY - ry) * 0.92;
        // 坡向：取局部斜率
        const sl = (ridge(x + 6) - ridge(x - 6)) / 12;
        const len = R(6, 20) * (style === 'karst' ? 1.3 : 1);
        const ang = Math.PI / 2 + clamp(-sl * 0.9, -0.9, 0.9) + R(-0.25, 0.25);
        const right = L.peaks.some((p) => x > p.cx && x < p.cx + p.wid);
        const a = (right ? 0.32 : 0.16) * L.detail * (style === 'snow' ? (y < ry + (baseY - ry) * 0.5 ? 0.25 : 1) : 1);
        g.strokeStyle = rgba(style === 'desert' ? pal.accent! : pal.ink, a);
        g.lineWidth = R(0.6, 1.5);
        g.beginPath(); g.moveTo(x, y);
        const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
        g.quadraticCurveTo(x + Math.cos(ang + 0.5) * len * 0.5, y + Math.sin(ang + 0.5) * len * 0.5, ex, ey);
        g.stroke();
      }
      // 沙岩层理
      if (style === 'desert') {
        g.strokeStyle = rgba(pal.accent!, 0.35); g.lineWidth = 1.4;
        for (let yy = peakY + 8; yy < baseY; yy += R(7, 16)) {
          g.beginPath(); g.moveTo(0, yy);
          for (let x = 0; x <= w; x += 12) g.lineTo(x, yy + (valueNoise(x / 30, yy, 4) - 0.5) * 5);
          g.stroke();
        }
      }
      // 魔山裂隙红光
      if (style === 'demon') {
        for (let i = 0; i < 6; i++) {
          let x = rnd() * w, y = baseY - ridge(x) * R(0.2, 0.7);
          g.strokeStyle = rgba(pal.accent!, 0.75); g.lineWidth = R(1, 2.2);
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 5; k++) { x += R(-6, 6); y += R(5, 12); g.lineTo(x, y); }
          g.stroke();
        }
      }
      // 斧劈皴悬崖
      if (spec.cliff && isFront) {
        const cx = R(0.25, 0.75) * w, cw = R(0.08, 0.16) * w;
        for (let i = 0; i < cw * 1.6; i++) {
          const x = cx + R(-cw / 2, cw / 2), ry = baseY - ridge(x);
          const y = ry + R(0.05, 0.6) * (baseY - ry);
          g.fillStyle = rgba(pal.ink, R(0.12, 0.3));
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(2, 5), y + R(3, 6)); g.lineTo(x + R(-1, 1), y + R(14, 30)); g.closePath(); g.fill();
        }
        g.strokeStyle = rgba(pal.ink, 0.6); g.lineWidth = 2;
        g.beginPath(); const ry0 = baseY - ridge(cx); g.moveTo(cx, ry0 + 3); g.lineTo(cx + R(-4, 4), baseY - (baseY - ry0) * 0.2); g.stroke();
      }
      // 瀑布
      if (spec.waterfall && isFront) {
        let best = w / 2, bh = 0;
        for (let k = 0; k < 8; k++) { const x = R(0.25, 0.75) * w; const hh = ridge(x); if (hh > bh) { bh = hh; best = x; } }
        const y0 = baseY - bh * 0.72, fw = clamp(w * 0.012, 3, 9);
        // 瀑布后的深色岩缝，衬出白练
        g.fillStyle = rgba(shade(pal.top, -0.6), 0.75);
        g.beginPath(); g.moveTo(best - fw * 1.6, y0 - 6);
        for (let y = y0 - 6; y <= baseY; y += 8) g.lineTo(best - fw * (1.6 + (y - y0) / (baseY - y0) * 1.2) + R(-2, 2), y);
        for (let y = baseY; y >= y0 - 6; y -= 8) g.lineTo(best + fw * (1.6 + (y - y0) / (baseY - y0) * 1.2) + R(-2, 2), y);
        g.closePath(); g.fill();
        const fg = g.createLinearGradient(0, y0, 0, baseY);
        fg.addColorStop(0, 'rgba(250,252,252,0.2)'); fg.addColorStop(0.15, 'rgba(250,252,252,0.95)'); fg.addColorStop(1, 'rgba(240,246,248,0.7)');
        g.fillStyle = fg;
        g.beginPath(); g.moveTo(best - fw * 0.4, y0);
        for (let y = y0; y <= baseY; y += 6) g.lineTo(best - fw * (0.5 + (y - y0) / (baseY - y0) * 0.6) + Math.sin(y * 0.2) * 0.8, y);
        for (let y = baseY; y >= y0; y -= 6) g.lineTo(best + fw * (0.5 + (y - y0) / (baseY - y0) * 0.6) + Math.sin(y * 0.2) * 0.8, y);
        g.closePath(); g.fill();
        g.strokeStyle = rgba(pal.ink, 0.3); g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(best - fw * 0.5, y0 + 4); g.lineTo(best - fw * 1.05, baseY - 6); g.stroke();
        falls.push({ x: best - w / 2, y: y0 - baseY, w: fw * 2.2, h: baseY - y0 });
      }
      // 山路 + 亭
      if (spec.path && isFront) {
        let x = w * R(0.4, 0.6), y = baseY - 4;
        const p0 = L.peaks[0];
        const tx = p0.cx, ty = baseY - ridge(p0.cx) + 10;
        g.strokeStyle = 'rgba(240,226,190,0.75)'; g.lineWidth = 2.2; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(x, y);
        let dir = 1;
        while (y > ty + 6) {
          const nx = x + dir * R(10, 26), ny = y - R(8, 16);
          g.lineTo(nx, ny); x = nx; y = ny; dir = -dir;
          x += (tx - x) * 0.25;
        }
        g.stroke(); g.setLineDash([]);
        if (spec.pavilion) drawPavilion(g, x, y + 2, R(9, 13));
      }
      // 苔点
      for (let i = 0; i < xs.length; i += 2) {
        if (rnd() > 0.14 * L.detail) continue;
        const x = xs[i], y = ys[i] + R(1, 5);
        if (baseY - y < 10) continue;
        g.fillStyle = rgba(style === 'snow' ? '#2a3a40' : pal.moss, R(0.5, 0.85));
        const m = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < m; k++) { g.beginPath(); g.ellipse(x + R(-4, 4), y + R(-1, 3), R(1.2, 2.6), R(0.8, 1.6), 0, 0, Math.PI * 2); g.fill(); }
      }
      // 松树点缀
      if (style !== 'desert' && style !== 'demon') {
        const np = Math.floor(R(2, 7) * (w / 400));
        for (let i = 0; i < np; i++) {
          const x = R(0.08, 0.92) * w, ry = baseY - ridge(x);
          if (baseY - ry < 20) continue;
          const y = ry + R(0, 0.35) * (baseY - ry);
          drawTinyPine(g, x, y, R(7, 15), style === 'snow', rnd);
        }
      }
    }
    g.restore();
    // 墨线勾勒：断续干笔
    g.strokeStyle = rgba(pal.ink, isFar ? 0.22 : 0.75);
    for (let pass = 0; pass < (isFar ? 1 : 2); pass++) {
      g.lineWidth = isFar ? 1.2 : pass === 0 ? R(1.8, 2.6) : R(0.8, 1.2);
      g.beginPath();
      let drawing = false;
      for (let i = 0; i < xs.length; i++) {
        const gap = valueNoise(i / 7, L.seed + pass, 13) < (pass === 0 ? 0.22 : 0.4);
        if (gap || baseY - ys[i] < 6) { drawing = false; continue; }
        if (!drawing) { g.moveTo(xs[i], ys[i]); drawing = true; } else g.lineTo(xs[i], ys[i]);
      }
      g.stroke();
    }
    // 中层之后的云带（被近山遮住下半）
    if ((spec.clouds ?? true) && li === layerDefs.length - 2 && style !== 'desert') {
      const nb = 1 + Math.floor(rnd() * 2);
      for (let b = 0; b < nb; b++) {
        const cy = baseY - mh * R(0.25, 0.55), cx = R(0.2, 0.8) * w, cw = w * R(0.3, 0.6);
        for (let k = 0; k < 6; k++) {
          const x = cx + R(-cw / 2, cw / 2), y = cy + R(-6, 6), rx = cw * R(0.15, 0.3), ry = rx * R(0.16, 0.26);
          const cg = g.createRadialGradient(x, y, 0, x, y, rx);
          cg.addColorStop(0, style === 'demon' ? 'rgba(90,60,80,0.5)' : 'rgba(250,248,240,0.82)'); cg.addColorStop(1, 'rgba(250,248,240,0)');
          g.fillStyle = cg; g.save(); g.translate(x, y); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
        }
      }
    }
  });

  // 底部雾霭：让山脚融入地面
  g.globalCompositeOperation = 'destination-out';
  const fg = g.createLinearGradient(0, baseY - h * 0.16, 0, baseY + 2);
  fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = fg; g.fillRect(0, baseY - h * 0.16, W, h * 0.16 + fogH + 2);
  g.globalCompositeOperation = 'source-over';
  if (style === 'island') {
    // 海岛：浪花环
    g.strokeStyle = 'rgba(250,252,250,0.85)'; g.lineWidth = 2.4;
    g.beginPath(); g.ellipse(W / 2, baseY - 2, w * 0.42, h * 0.07, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
    g.strokeStyle = 'rgba(250,252,250,0.5)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(W / 2, baseY + 3, w * 0.46, h * 0.09, 0, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
  }
  return { canvas: cv, w: W, h: H, ax: W / 2, ay: baseY, falls, pixels: cv.width * cv.height };
}

export function drawTinyPine(g: CanvasRenderingContext2D, x: number, y: number, s: number, snow: boolean, rnd: () => number) {
  const lean = (rnd() - 0.5) * s * 0.5;
  g.strokeStyle = 'rgba(52,36,24,0.9)'; g.lineWidth = Math.max(0.8, s * 0.1);
  g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - lean * 0.4, y - s * 0.35, x + lean * 0.8, y - s * 0.6, x + lean, y - s); g.stroke();
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const t = 0.38 + (i / (n - 1)) * 0.62;
    const side = i % 2 ? 1 : -1;
    const px = x + lean * t + side * s * (0.12 + rnd() * 0.12), py = y - s * t;
    const rw = s * (0.4 - i * 0.05) * (0.8 + rnd() * 0.35);
    g.strokeStyle = 'rgba(52,36,24,0.75)'; g.lineWidth = Math.max(0.5, s * 0.05);
    g.beginPath(); g.moveTo(x + lean * t, py + s * 0.04); g.lineTo(px, py); g.stroke();
    g.fillStyle = 'rgba(26,50,36,0.92)';
    g.beginPath(); g.ellipse(px, py, rw, rw * 0.36, (rnd() - 0.5) * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(70,104,72,0.7)';
    g.beginPath(); g.ellipse(px - rw * 0.2, py - rw * 0.08, rw * 0.6, rw * 0.18, 0, 0, Math.PI * 2); g.fill();
    if (snow) { g.fillStyle = 'rgba(250,252,255,0.92)'; g.beginPath(); g.ellipse(px, py - rw * 0.15, rw * 0.85, rw * 0.15, 0, 0, Math.PI * 2); g.fill(); }
  }
}

export function drawPavilion(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.strokeStyle = 'rgba(40,30,20,0.9)'; g.lineWidth = Math.max(0.8, s * 0.08);
  g.fillStyle = '#8a3a2a';
  g.fillRect(x - s * 0.45, y - s * 0.75, s * 0.1, s * 0.75); g.fillRect(x + s * 0.35, y - s * 0.75, s * 0.1, s * 0.75);
  g.fillStyle = '#3a3a38';
  g.beginPath(); g.moveTo(x - s * 0.85, y - s * 0.7); g.quadraticCurveTo(x - s * 0.3, y - s * 0.85, x, y - s * 1.35);
  g.quadraticCurveTo(x + s * 0.3, y - s * 0.85, x + s * 0.85, y - s * 0.7); g.quadraticCurveTo(x, y - s * 0.86, x - s * 0.85, y - s * 0.7); g.fill(); g.stroke();
  g.fillStyle = '#c8b890'; g.fillRect(x - s * 0.6, y - s * 0.06, s * 1.2, s * 0.12);
}
