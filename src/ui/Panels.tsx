import { useEffect, useRef, useState } from 'react';
import type { Game } from '../world/game';
import { FOG_W, FOG_H } from '../world/game';
import { audio } from '../world/audio';
import { LOCATIONS, BIG_LABELS, WORLD_SCALE, MACRO_W, MACRO_H, LOC_TYPE_NAME, ACTIVE_MAP, MAP_NAME, MAP_IDS, MAP_EXITS } from '../data/world';
// 三图之间的往来方式（舆图顶部的说明）
const MAP_ROUTE: Record<string, string> = {
  tiannan: '天南：越国七派、天道盟、魔道六宗、九国盟、慕兰草原与极西之地',
  luanxing: '乱星海：经越京城外灵石矿洞的上古传送阵（需大挪移令）',
  dajin: '大晋：自天南北缘横穿天澜草原，约四个月路程',
};

export const SEAL: Record<string, string> = { city: '城', town: '镇', sect: '宗', danger: '险', secret: '秘', isle: '岛' };
export const SEAL_COLOR: Record<string, string> = { city: '#9a3b2c', town: '#8a6a3a', sect: '#2f6b5e', danger: '#5a1f2a', secret: '#3a5a8a', isle: '#2f6a80' };

// ---------- 迷雾遮罩（100×70，未探索处为宣纸色）----------
export function makeFogCanvas(game: Game, cv?: HTMLCanvasElement, alpha = 236) {
  const c = cv ?? document.createElement('canvas');
  c.width = FOG_W; c.height = FOG_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(FOG_W, FOG_H);
  const all = game.revealAll;
  for (let i = 0; i < FOG_W * FOG_H; i++) {
    const k = i * 4;
    img.data[k] = 226; img.data[k + 1] = 217; img.data[k + 2] = 194;
    img.data[k + 3] = all || game.explored[i] ? 0 : alpha;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- 设置 ----------
export function SettingsPanel({ onClose, game, onExit, onSaves }: { onClose: () => void; game?: Game; onExit?: () => void; onSaves?: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const click = () => audio.sfx('click');
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="scroll-panel settings" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><div className="panel-title">设置</div><button className="close-btn" onClick={onClose}>×</button></div>
        <div style={{ overflow: 'auto', maxHeight: '68vh', paddingRight: 4 }}>
          <div className="set-row"><div>背景音乐与音效<small>程序生成的古琴、箫声与风声</small></div>
            <button className={'switch' + (audio.enabled ? ' on' : '')} onClick={() => { audio.unlock(); audio.setEnabled(!audio.enabled); saveAudio(); re(); }} /></div>
          <div className="set-row"><div>音乐音量</div>
            <input type="range" min={0} max={1} step={0.05} value={audio.musicVol} onChange={(e) => { audio.setMusicVol(+e.target.value); saveAudio(); re(); }} /></div>
          <div className="set-row"><div>音效音量</div>
            <input type="range" min={0} max={1} step={0.05} value={audio.sfxVol} onChange={(e) => { audio.setSfxVol(+e.target.value); audio.sfx('chime'); saveAudio(); re(); }} /></div>
          {game && <>
            <div className="set-row"><div>画质<small>{game.renderer?.stage ? 'WebGL 特效渲染' : '兼容模式（Canvas2D）'}{game.renderer?.fixedQuality ? '' : ' · 自动'}</small></div>
              <select className="ink-select" value={game.renderer?.fixedQuality ? String(game.renderer.tier) : 'auto'} onChange={(e) => { const v = e.target.value; if (v === 'auto') { game.renderer.fixedQuality = false; } else game.renderer.setQuality(+v); try { localStorage.setItem('fanren.quality', v); } catch { /* */ } re(); }}>
                <option value="auto">自动</option><option value="2">高（泛光 · 全分辨率）</option><option value="1">中</option><option value="0">低（省电 · 老手机）</option>
              </select></div>
            <div className="set-row"><div>WebGL 特效<small>关闭则使用兼容渲染（需重新进入游戏生效）</small></div>
              <button className={'switch' + (game.renderer?.stage ? ' on' : '')} onClick={() => { click(); try { localStorage.setItem('fanren.gl', game.renderer?.stage ? '0' : '1'); } catch { /* */ } game.toast('已保存，返回标题再进入游戏即可生效。'); re(); }} /></div>
            <div className="set-row"><div>性能监视<small>显示帧率与耗时（快捷键 F3）</small></div>
              <button className={'switch' + (game.showPerf ? ' on' : '')} onClick={() => { click(); game.showPerf = !game.showPerf; re(); }} /></div>
            {onSaves && <div className="set-row"><div>存档 / 读档<small>一个自动存档 + 三个手动存档位</small></div><button className="ink-btn" onClick={() => { click(); onSaves(); }}>打开</button></div>}
            <div className="set-row"><div>天气（体验）<small>强制指定天气，便于预览</small></div>
              <select className="ink-select" value={game.weather.forced ?? ''} onChange={(e) => { game.setWeather((e.target.value || null) as any); re(); }}>
                <option value="">自然变化</option><option value="clear">晴</option><option value="rain">雨</option><option value="storm">雷雨</option><option value="snow">雪</option><option value="fog">雾</option><option value="sand">风沙</option>
              </select></div>
            <div className="set-row"><div>时辰（体验）<small>拨动昼夜</small></div>
              <input type="range" min={0} max={1} step={0.01} value={game.dayPhase} onChange={(e) => { game.clock = +e.target.value * 240; re(); }} /></div>
            <div className="set-row"><div>显示全图（体验）<small>揭开所有迷雾，便于预览整个人界</small></div>
              <button className={'switch' + (game.revealAll ? ' on' : '')} onClick={() => { click(); game.revealAll = !game.revealAll; game.updateUI(); re(); }} /></div>
            <div className="set-row"><div>御剑飞行（体验）<small>炼气期本不能御剑，此为预览用，可飞越山海（快捷键 F）</small></div>
              <button className={'switch' + (game.player.flying ? ' on' : '')} onClick={() => { game.toggleFly(); re(); }} /></div>
            <div className="set-row"><div>地图点选瞬移（体验）<small>在世界地图上点击即直接传送，方便看遍各地</small></div>
              <button className={'switch' + (game.debugTeleport ? ' on' : '')} onClick={() => { click(); game.debugTeleport = !game.debugTeleport; re(); }} /></div>
          </>}
          <div className="set-row" style={{ display: 'block' }}>
            <div style={{ marginBottom: 6 }}>操作说明</div>
            <div className="keys">
              电脑：<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 移动　·　<kbd>Shift</kbd> 疾行　·　<kbd>空格</kbd> 闪避　·　鼠标点击地面 前往　·　<kbd>F3</kbd> 性能<br />
              <kbd>Z</kbd> 打坐　·　<kbd>E</kbd> 采集（神识内的灵草/矿脉/灵泉）　·　<kbd>C</kbd> 角色/冲关　·　<kbd>B</kbd> 储物袋<br />
              <kbd>L</kbd> 丹房　·　<kbd>P</kbd> 闭关　·　滚轮 / <kbd>+</kbd><kbd>-</kbd> 缩放　·　<kbd>M</kbd> 世界地图　·　<kbd>F</kbd> 御剑（体验）<br />
              手机：左下摇杆移动　·　点击地面前往　·　点击灵物走过去采集　·　双指缩放
            </div>
          </div>
          {game && onExit && (
            <div className="set-row" style={{ borderBottom: 'none' }}>
              <div>返回标题<small>进度会自动保存</small></div>
              <button className="ink-btn" onClick={() => { click(); game.save(0); onExit(); }}>返回</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function saveAudio() {
  try { localStorage.setItem('fanren_audio', JSON.stringify({ e: audio.enabled, m: audio.musicVol, s: audio.sfxVol })); } catch { /* */ }
}
export function loadAudio() {
  try {
    const d = JSON.parse(localStorage.getItem('fanren_audio') || 'null');
    if (d) { audio.setEnabled(!!d.e); audio.setMusicVol(d.m); audio.setSfxVol(d.s); }
  } catch { /* */ }
}

// ---------- 世界地图 ----------
// 第三十步：大地图可缩放（滚轮 / ＋－按钮 / 双指捏合 / 键盘 + -）与拖动平移；放大后叠加局部高清底图（河、路、山林矢量）
const WM_ZMAX = 8;
export function WorldMapPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [hover, setHover] = useState<string>('');
  const [zl, setZl] = useState(1);
  const view = useRef({ z: 1, cx: MACRO_W / 2, cy: MACRO_H / 2 });
  const hoverRef = useRef(''); hoverRef.current = hover;
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  useEffect(() => {
    const fit = () => {
      const mw = Math.min(window.innerWidth - 70, 1200), mh = window.innerHeight - 150;
      let w = mw, h = (w * MACRO_H) / MACRO_W;
      if (h > mh) { h = mh; w = (h * MACRO_W) / MACRO_H; }
      setSize({ w: Math.max(260, Math.floor(w)), h: Math.max(182, Math.floor(h)) });
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const clampView = () => {
    const v = view.current;
    v.z = Math.max(1, Math.min(WM_ZMAX, v.z));
    const hw = MACRO_W / (2 * v.z), hh = MACRO_H / (2 * v.z);
    v.cx = Math.max(hw, Math.min(MACRO_W - hw, v.cx)); v.cy = Math.max(hh, Math.min(MACRO_H - hh, v.cy));
  };
  /** 以屏幕点 (sx,sy)（CSS 像素，相对画布）为中心缩放 */
  const zoomAt = (f: number, sx = size.w / 2, sy = size.h / 2) => {
    const v = view.current, s = size.w / MACRO_W, k0 = s * v.z;
    const mx = v.cx + (sx - size.w / 2) / k0, my = v.cy + (sy - size.h / 2) / k0;
    v.z = Math.max(1, Math.min(WM_ZMAX, v.z * f));
    const k1 = s * v.z;
    v.cx = mx - (sx - size.w / 2) / k1; v.cy = my - (sy - size.h / 2) / k1;
    clampView(); setZl(v.z);
  };
  const centerHero = (z?: number) => {
    const v = view.current; if (z) v.z = z; else if (v.z < 3) v.z = 3;
    v.cx = game.player.x / WORLD_SCALE; v.cy = game.player.y / WORLD_SCALE; clampView(); setZl(v.z);
  };

  useEffect(() => {
    const cv = ref.current!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    const g = cv.getContext('2d')!;
    // 迷雾：预先柔化一次（之后每帧只是缩放贴图，不再逐帧模糊）
    const fog0 = makeFogCanvas(game, undefined, 200);
    const fog = document.createElement('canvas'); fog.width = FOG_W * 6; fog.height = FOG_H * 6;
    { const fg = fog.getContext('2d')!; fg.imageSmoothingEnabled = true; try { fg.filter = 'blur(5px)'; } catch { /* */ } fg.drawImage(fog0, 0, 0, fog.width, fog.height); }
    const tiles = new Map<string, { cv: HTMLCanvasElement; used: number }>(); let frame = 0;
    const tileFor = (tx: number, ty: number, scale: number, T: number, budget: { n: number }) => {
      const key = `${tx},${ty},${scale}`;
      let t = tiles.get(key);
      if (!t) {
        if (budget.n <= 0) return null; budget.n--;
        const c = document.createElement('canvas'); c.width = c.height = T * scale;
        const tg = c.getContext('2d')!; tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
        const base = game.terrain.overviewBase ?? game.overview;
        tg.drawImage(base, tx * T - 1, ty * T - 1, T + 2, T + 2, -scale, -scale, (T + 2) * scale, (T + 2) * scale);
        game.terrain.overviewVectors(tg, tx * T, ty * T, T * scale, T * scale, scale);
        t = { cv: c, used: frame }; tiles.set(key, t);
        if (tiles.size > 120) { let old: string | null = null, ou = Infinity; for (const [k2, v] of tiles) if (v.used < ou && v !== t) { ou = v.used; old = k2; } if (old) tiles.delete(old); }
      }
      t.used = frame; return t;
    };
    let raf = 0;
    const s = size.w / MACRO_W; // 宏观单位 → CSS 像素（全图时）
    const draw = (t: number) => {
      frame++;
      const v = view.current, Z = v.z, k = s * Z, W2 = size.w / 2, H2 = size.h / 2;
      const X = (mx: number) => (mx - v.cx) * k + W2, Y = (my: number) => (my - v.cy) * k + H2;
      const on = (x: number, y: number, m = 40) => x > -m && y > -m && x < size.w + m && y < size.h + m;
      const hov = hoverRef.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#d9cdb0'; g.fillRect(0, 0, size.w, size.h);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = Z > 2 ? 'medium' : 'high';
      // 只取可见部分的源矩形来画（放大 8 倍时不再让整张底图参与缩放，省下大量填充）
      const mx0v = Math.max(0, v.cx - W2 / k), my0v = Math.max(0, v.cy - H2 / k), mx1v = Math.min(MACRO_W, v.cx + W2 / k), my1v = Math.min(MACRO_H, v.cy + H2 / k);
      const drawVis = (img: CanvasImageSource, iw: number, ih: number) => {
        const fx = iw / MACRO_W, fy = ih / MACRO_H;
        const sx0 = Math.max(0, Math.floor(mx0v * fx) - 1), sy0 = Math.max(0, Math.floor(my0v * fy) - 1);
        const sx1 = Math.min(iw, Math.ceil(mx1v * fx) + 1), sy1 = Math.min(ih, Math.ceil(my1v * fy) + 1);
        if (sx1 <= sx0 || sy1 <= sy0) return;
        g.drawImage(img, sx0, sy0, sx1 - sx0, sy1 - sy0, X(sx0 / fx), Y(sy0 / fy), (sx1 - sx0) / fx * k, (sy1 - sy0) / fy * k);
      };
      const t0 = performance.now();
      drawVis(game.overview, game.overview.width, game.overview.height);
      // 放大后：局部高清底图（每帧最多新画 4 块，其余先用缩略图顶着）
      if (k * dpr > 2.4 && game.terrain?.overviewVectors) {
        const scale = k * dpr > 4.6 ? 8 : k * dpr > 3.2 ? 6 : 4, T = scale >= 6 ? 24 : 32, budget = { n: 4 };
        const mx0 = v.cx - W2 / k, mx1 = v.cx + W2 / k, my0 = v.cy - H2 / k, my1 = v.cy + H2 / k;
        for (let ty = Math.floor(my0 / T); ty <= Math.floor(my1 / T); ty++) for (let tx = Math.floor(mx0 / T); tx <= Math.floor(mx1 / T); tx++) {
          if (tx < 0 || ty < 0 || tx * T >= game.terrain.W || ty * T >= game.terrain.H) continue;
          const tl = tileFor(tx, ty, scale, T, budget); if (!tl) continue;
          g.drawImage(tl.cv, X(tx * T) - 0.5, Y(ty * T) - 0.5, T * k + 1, T * k + 1);
        }
      }
      drawVis(fog, fog.width, fog.height);
      // 大区域名（放大后变淡，免得挡住细节）
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const L of BIG_LABELS) {
        const fs = Math.max(13, L.size * 9 * s * 1.6) * Math.min(1.8, Math.sqrt(Z));
        g.font = `${fs}px 'Ma Shan Zheng', serif`;
        g.fillStyle = `rgba(40,34,26,${0.32 / Math.max(1, Z * 0.55)})`;
        g.fillText(L.name.split('').join(' '), X(L.at[0]), Y(L.at[1]));
      }
      // 陆路出口：图边的箭头
      if (Z < 1.5) for (const ex of MAP_EXITS[ACTIVE_MAP]) {
        const north = ex.edge === 'n', y = north ? 22 : size.h - 22;
        g.font = `${Math.max(13, 15 * s * 1.6)}px 'Ma Shan Zheng', serif`;
        g.fillStyle = 'rgba(120,40,30,0.75)';
        g.fillText(`${north ? '↑' : '↓'} ${ex.to === 'dajin' ? '天澜草原 · 大晋' : '慕兰草原 · 天南'} ${north ? '↑' : '↓'}`, size.w / 2, y);
      }
      // 地点（先画已探索与重要地点，名字做简单避让；放大后全部显示名字）
      const placed: [number, number, number, number][] = [];
      const order = [...LOCATIONS].sort((a, b) => (b.id === hov ? 1 : 0) - (a.id === hov ? 1 : 0) || (b.major ? 1 : 0) - (a.major ? 1 : 0));
      const rz = Math.min(1.7, 1 + (Z - 1) * 0.14);
      for (const l of order) {
        const wx = l.x * WORLD_SCALE, wy = l.y * WORLD_SCALE;
        const known = game.isExplored(wx, wy);
        if (!known && !l.major) continue;
        const x = X(l.x), y = Y(l.y);
        if (!on(x, y)) continue;
        const r = Math.max(4, 7 * s * 1.4) * (l.major ? 1.15 : 0.85) * rz;
        g.globalAlpha = known ? 1 : 0.5;
        g.fillStyle = SEAL_COLOR[l.type];
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.strokeStyle = 'rgba(250,240,220,0.9)'; g.lineWidth = 1; g.strokeRect(x - r + 1.5, y - r + 1.5, r * 2 - 3, r * 2 - 3);
        g.fillStyle = '#f7eedb'; g.font = `${r * 1.45}px 'Ma Shan Zheng', serif`;
        g.fillText(SEAL[l.type], x, y + r * 0.08);
        if (l.major || k > 0.85 || hov === l.id) {
          const fs = Math.max(11, 11 * s * 1.2) * Math.min(1.45, 1 + (Z - 1) * 0.1);
          g.font = `${fs}px 'Noto Serif SC', serif`;
          const label = known ? l.name : l.name + '（传闻）';
          const tw = g.measureText(label).width;
          const box: [number, number, number, number] = [x - tw / 2 - 3, y + r + 2, tw + 6, fs + 4];
          const hit = placed.some(([bx, by, bw, bh]) => box[0] < bx + bw && box[0] + box[2] > bx && box[1] < by + bh && box[1] + box[3] > by);
          if (!hit || hov === l.id) {
            placed.push(box);
            g.fillStyle = hov === l.id ? 'rgba(255,248,230,0.98)' : 'rgba(246,239,222,0.85)'; g.fillRect(box[0], box[1], box[2], box[3]);
            g.fillStyle = '#2b2620'; g.fillText(label, x, y + r + 4 + fs / 2);
          }
        }
        g.globalAlpha = 1;
      }
      // 第十八步：机缘 / 洞府 / 悬赏 / 异宝
      for (const m of game.mapMarks?.() ?? []) {
        const x = X(m.x / WORLD_SCALE), y = Y(m.y / WORLD_SCALE), r = Math.max(6, 8 * s) * rz;
        if (!on(x, y, 60 + (m.ring ? (m.ring / WORLD_SCALE) * k : 0))) continue;
        if (m.ring) { g.strokeStyle = m.color; g.globalAlpha = 0.6; g.setLineDash([3, 3]); g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, (m.ring / WORLD_SCALE) * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
        g.fillStyle = 'rgba(30,24,18,0.8)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = m.color; g.font = `${r * 1.4}px 'Ma Shan Zheng', serif`; g.fillText(m.glyph, x, y + r * 0.08);
        if (k > 0.85) { g.font = `${Math.max(10, 10 * s * rz)}px 'Noto Serif SC', serif`; g.fillStyle = 'rgba(40,30,20,0.85)'; g.fillText(m.name, x, y - r - 7); }
      }
      // 目的地
      const px = X(game.player.x / WORLD_SCALE), py = Y(game.player.y / WORLD_SCALE);
      if (game.destination) {
        const dx = X(game.destination.x / WORLD_SCALE), dy = Y(game.destination.y / WORLD_SCALE);
        g.strokeStyle = '#a8352a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(dx - 6, dy - 6); g.lineTo(dx + 6, dy + 6); g.moveTo(dx + 6, dy - 6); g.lineTo(dx - 6, dy + 6); g.stroke();
        g.setLineDash([4, 5]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(168,53,42,0.7)';
        g.beginPath(); g.moveTo(px, py); g.lineTo(dx, dy); g.stroke(); g.setLineDash([]);
      }
      // 玩家与神识
      const sr = (game.senseRadius / WORLD_SCALE) * k;
      g.strokeStyle = 'rgba(63,160,140,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, Math.max(sr, 5), 0, Math.PI * 2); g.stroke();
      if (Z > 2.5) { g.fillStyle = 'rgba(63,160,140,0.08)'; g.fill(); }
      const pulse = (t / 1000) % 1.6 / 1.6;
      g.strokeStyle = `rgba(168,53,42,${1 - pulse})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 6 + pulse * 18, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#a8352a'; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
      (window as any).__wmMs = performance.now() - t0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    // 滚轮缩放（以指针为中心）——必须非被动监听才能阻止页面滚动
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const r = cv.getBoundingClientRect();
      const f = Math.pow(1.0018, -Math.max(-240, Math.min(240, e.deltaY * (e.deltaMode === 1 ? 30 : 1))));
      zoomAt(f, ((e.clientX - r.left) / r.width) * size.w, ((e.clientY - r.top) / r.height) * size.h);
    };
    cv.addEventListener('wheel', wheel, { passive: false });
    const key = (e: KeyboardEvent) => {
      if (e.key === '=' || e.key === '+') { zoomAt(1.4); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoomAt(1 / 1.4); e.preventDefault(); }
      else if (e.key === '0') { view.current.z = 1; clampView(); setZl(1); }
    };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key); };
  }, [size]);

  const local = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { sx: ((e.clientX - r.left) / r.width) * size.w, sy: ((e.clientY - r.top) / r.height) * size.h };
  };
  const toWorld = (e: React.PointerEvent) => {
    const { sx, sy } = local(e); const v = view.current, k = (size.w / MACRO_W) * v.z;
    return { mx: v.cx + (sx - size.w / 2) / k, my: v.cy + (sy - size.h / 2) / k };
  };
  const pickLoc = (mx: number, my: number) => {
    const k = (size.w / MACRO_W) * view.current.z;
    let best = '', bd = 14 / k;
    for (const l of LOCATIONS) {
      if (!game.isExplored(l.x * WORLD_SCALE, l.y * WORLD_SCALE) && !l.major) continue;
      const d = Math.hypot(l.x - mx, l.y - my);
      if (d < bd) { bd = d; best = l.id; }
    }
    return best;
  };
  const onClick = (e: React.PointerEvent) => {
    const { mx, my } = toWorld(e);
    const id = pickLoc(mx, my);
    const loc = LOCATIONS.find((l) => l.id === id);
    const wx = loc ? loc.x * WORLD_SCALE + 200 : mx * WORLD_SCALE, wy = loc ? loc.y * WORLD_SCALE + 360 : my * WORLD_SCALE;
    audio.sfx('click');
    if (game.debugTeleport) {
      game.teleport(wx, wy);
      game.toast(`（体验）瞬移至${loc ? loc.name : '此地'}。`);
    } else {
      game.setDestination(wx, wy);
      game.toast(loc ? `已设定目的地：${loc.name}（${LOC_TYPE_NAME[loc.type]}）` : '已设定目的地。');
    }
    onClose();
  };
  const onDown = (e: React.PointerEvent) => {
    const { sx, sy } = local(e);
    pts.current.set(e.pointerId, { x: sx, y: sy });
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* */ }
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.current.z };
      if (drag.current) drag.current.moved = true;
    } else drag.current = { x: sx, y: sy, cx: view.current.cx, cy: view.current.cy, moved: false, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent) => {
    const { sx, sy } = local(e);
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: sx, y: sy });
    if (pinch.current && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.z * d / Math.max(10, pinch.current.d);
      zoomAt(target / view.current.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const D = drag.current;
    if (D && D.id === e.pointerId) {
      const dx = sx - D.x, dy = sy - D.y;
      if (!D.moved && Math.hypot(dx, dy) > 5) D.moved = true;
      if (D.moved) {
        const k = (size.w / MACRO_W) * view.current.z;
        view.current.cx = D.cx - dx / k; view.current.cy = D.cy - dy / k; clampView();
      }
      if (D.moved) return;
    }
    const { mx, my } = toWorld(e); const id = pickLoc(mx, my); if (id !== hover) setHover(id);
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    const D = drag.current;
    if (D && D.id === e.pointerId) { drag.current = null; if (!D.moved) onClick(e); }
  };
  const hovered = LOCATIONS.find((l) => l.id === hover);
  const zb = (f: number) => (e: React.MouseEvent) => { e.stopPropagation(); audio.sfx('click'); zoomAt(f); };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="scroll-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-title">人界舆图 · {MAP_NAME[ACTIVE_MAP]}</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-soft)' }}>
            {hovered ? <><b style={{ color: 'var(--ink)' }}>{hovered.name}</b>　{game.isExplored(hovered.x * WORLD_SCALE, hovered.y * WORLD_SCALE) ? hovered.desc : '只闻其名，尚未亲至。'}</>
              : `已探索 ${(game.ui.explored * 100).toFixed(1)}%　·　滚轮 / ＋－ 缩放，拖动平移，点击设定目的地${game.debugTeleport ? '（体验：瞬移）' : ''}`}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="worldmap-wrap" style={{ width: size.w, height: size.h }}>
          <canvas ref={ref} className={'worldmap-canvas' + (zl > 1 ? ' zoomed' : '')} style={{ width: size.w, height: size.h }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover('')} />
          <div className="wm-zoom">
            <button onClick={zb(1.5)} disabled={zl >= WM_ZMAX - 0.01} title="放大（滚轮 / +）">＋</button>
            <div className="wm-zl">{zl < 1.05 ? '全图' : `${zl.toFixed(1)}×`}</div>
            <button onClick={zb(1 / 1.5)} disabled={zl <= 1.001} title="缩小（滚轮 / -）">－</button>
            <button className="wm-me" onClick={(e) => { e.stopPropagation(); audio.sfx('click'); centerHero(); }} title="以韩立为中心">韩</button>
            <button className="wm-me" onClick={(e) => { e.stopPropagation(); audio.sfx('click'); view.current.z = 1; clampView(); setZl(1); }} title="看全图（0）">全</button>
          </div>
        </div>
        <div className="map-tabs">{MAP_IDS.map((m) => <span key={m} className={m === ACTIVE_MAP ? 'on' : ''} title={MAP_ROUTE[m]}><b>{MAP_NAME[m]}</b>{m === ACTIVE_MAP ? '（你在此）' : m === 'luanxing' ? (ACTIVE_MAP === 'tiannan' ? '　经上古传送阵' : '　须先回天南') : ACTIVE_MAP === 'luanxing' ? '　须先回天南' : '　横穿天澜草原'}</span>)}</div>
        <div className="map-legend">
          {Object.keys(SEAL).map((k) => <span key={k}><i style={{ background: SEAL_COLOR[k] }}>{SEAL[k]}</i>{LOC_TYPE_NAME[k as keyof typeof LOC_TYPE_NAME]}</span>)}
          <span><i style={{ background: '#a8352a', borderRadius: '50%' }} />韩立</span>
          <span><i style={{ border: '1.5px solid #3fa08c', borderRadius: '50%', background: 'transparent' }} />神识范围</span>
        </div>
      </div>
    </div>
  );
}
