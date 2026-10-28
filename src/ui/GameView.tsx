import { ModalLayer } from './ModalLayer';
import { spriteJobs } from '../gfx/spriteJobs';
import { sprites } from '../gfx/sprites';
import { prof } from '../core/prof';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Game, UIState } from '../world/game';
import { audio } from '../world/audio';
import { REALMS } from '../data/realms';
import { LOCATIONS, WORLD_SCALE, LOC_TYPE_NAME, MAP_NAME, MapId } from '../data/world';
import { SettingsPanel, WorldMapPanel, makeFogCanvas, SEAL, SEAL_COLOR, loadAudio } from './Panels';
import { Hotbar, SkillPanel } from './CombatUI';
import { CharPanel, BagPanel, AlchemyPanel, SecludePanel, SavePanel, DeathScreen } from './CultPanels';
import { GainOverlay } from './GainOverlay';
import { PursuitHUD } from './PursuitHUD';
import { BossHUD } from './BossHUD';
import { AscendUI } from './AscendUI';

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function cnNum(n: number): string {
  if (n <= 10) return CN[n];
  if (n < 20) return '十' + CN[n - 10];
  if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  return String(n);
}
const MONTH = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const SEASON_COLOR: Record<string, string> = { 春: '#6f9a5a', 夏: '#3f7f6f', 秋: '#b8803a', 冬: '#6a7f96' };
const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

function useUI(game: Game): UIState {
  return useSyncExternalStore((f) => game.subscribe(f), () => game.ui);
}
function useToasts(game: Game) {
  return useSyncExternalStore((f) => game.subscribeToasts(f), () => game.toasts);
}

// ---------- 小地图 ----------
// 第二十步：可缩放（滚轮 / ＋－ 按钮，记住档位），放大时用局部高清底图（分帧生成、缓存），
// 地名按重要程度排序、互不重叠：城 > 宗 > 镇 > 岛 > 险地 / 秘境 > 小村小洞；放大后显示地名。
const MM_SPANS = [150, 90, 52, 30];          // 每档显示的宏观单位跨度（1 单位 = 300 世界像素）
const MM_KEY = 'fanren.minimapZoom';
const LOC_RANK: Record<string, number> = { city: 0, sect: 1, town: 2, isle: 3, danger: 4, secret: 4 };
const locRank = (l: (typeof LOCATIONS)[number]) => (l.minor ? 10 : 0) + (l.major ? -0.5 : 0) + (LOC_RANK[l.type] ?? 5);
interface MMTile { cv: HTMLCanvasElement; scale: number; T: number; tx: number; ty: number; used: number }
function Minimap({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zi, setZi] = useState(() => { const v = Number(localStorage.getItem(MM_KEY)); return Number.isFinite(v) && v >= 0 && v < MM_SPANS.length ? v : 1; });
  const ziRef = useRef(zi); ziRef.current = zi;
  const zoomBy = (d: number) => setZi((z) => { const n = Math.max(0, Math.min(MM_SPANS.length - 1, z + d)); try { localStorage.setItem(MM_KEY, String(n)); } catch { /* */ } return n; });
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!;
    const fogCv = document.createElement('canvas');
    let span = MM_SPANS[ziRef.current];
    const tiles = new Map<string, MMTile>(); let frame = 0;
    const sorted = [...LOCATIONS].sort((a, b) => locRank(a) - locRank(b));
    // 高清底图块（缓存）
    const tileFor = (tx: number, ty: number, scale: number, T: number) => {
      const key = `${tx},${ty},${scale}`;
      let t = tiles.get(key);
      if (!t) {
        const c = document.createElement('canvas'); c.width = c.height = T * scale;
        t = { cv: c, scale, T, tx, ty, used: frame };
        // 底色：无图标的缩略底图平滑放大（颜色本就是低频的）；其上按本档分辨率画清晰的河、路、山林图标
        const tg = c.getContext('2d')!; tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high';
        const base = game.terrain.overviewBase ?? game.overview;
        tg.drawImage(base, tx * T - 1, ty * T - 1, T + 2, T + 2, -scale, -scale, (T + 2) * scale, (T + 2) * scale);
        game.terrain.overviewVectors(tg, tx * T, ty * T, T * scale, T * scale, scale);
        tiles.set(key, t);
        if (tiles.size > 48) { // 丢掉最久没用的
          let old: string | null = null, ou = Infinity; for (const [k2, v] of tiles) if (v.used < ou && v !== t) { ou = v.used; old = k2; }
          if (old) tiles.delete(old);
        }
      }
      t.used = frame; return t;
    };
    // 第三十八步：静态层缓存——底图、高清图块、迷雾、地名印章（含中文描边字）只在缩放 / 迷雾变化、
    // 或玩家移出 20% 范围时重画；每次刷新只贴图 + 画会动的标记。以前每秒 8 次整套重画（字最贵）。
    const stCv = document.createElement('canvas'); let stKey = '', stX = 0, stY = 0, stT = 0;
    const paintStatic = (SPAN: number, mx: number, my: number, dpr: number, k: number) => {
      const cv = stCv, g = stCv.getContext('2d')!, c = stCv.width / 2;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#d9cdb0'; g.fillRect(0, 0, cv.width, cv.height);
        g.imageSmoothingEnabled = true;
        g.drawImage(game.overview, mx - SPAN / 2, my - SPAN / 2, SPAN, SPAN, 0, 0, cv.width, cv.height);
        // 放大后：局部高清底图覆盖在缩略图上
        const ppu = k / dpr;   // 每单位 CSS 像素
        if (ppu > 2.4 && game.terrain?.overviewVectors) {
          const scale = ppu > 4.2 ? 6 : 4, T = scale === 6 ? 24 : 32;
          const tx0 = Math.floor((mx - SPAN / 2) / T), tx1 = Math.floor((mx + SPAN / 2) / T);
          const ty0 = Math.floor((my - SPAN / 2) / T), ty1 = Math.floor((my + SPAN / 2) / T);
          for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
            if (tx < 0 || ty < 0 || tx * T >= game.terrain.W || ty * T >= game.terrain.H) continue;
            const t = tileFor(tx, ty, scale, T);
            g.drawImage(t.cv, (tx * T - mx) * k + c - 0.5, (ty * T - my) * k + c - 0.5, T * k + 1, T * k + 1);
          }
        }
        g.drawImage(fogCv, (mx - SPAN / 2) / 10, (my - SPAN / 2) / 10, SPAN / 10, SPAN / 10, 0, 0, cv.width, cv.height);
        // 地名：按重要程度依次放，互不重叠
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const boxes: number[] = [];
        const free = (x0: number, y0: number, x1: number, y1: number) => { for (let i = 0; i < boxes.length; i += 4) if (x0 < boxes[i + 2] && x1 > boxes[i] && y0 < boxes[i + 3] && y1 > boxes[i + 1]) return false; return true; };
        const zoomed = ppu > 2.4, close = ppu > 4.2;
        const R0 = (ppu < 1.6 ? 3.6 : ppu < 2.4 ? 4.3 : ppu < 4.2 ? 5 : 5.6) * dpr;
        const fs = 10.5 * dpr;
        for (const l of sorted) {
          const dx = (l.x - mx) * k + c, dy = (l.y - my) * k + c;
          if (dx < -10 || dy < -10 || dx > cv.width + 10 || dy > cv.height + 10) continue;
          if (!game.isExplored(l.x * WORLD_SCALE, l.y * WORLD_SCALE)) continue;
          const small = l.minor && !close;
          const r = small ? (zoomed ? 2.4 : 1.7) * dpr : R0 * (l.type === 'city' || l.type === 'sect' ? 1.12 : 1);
          if (!free(dx - r - 1, dy - r - 1, dx + r + 1, dy + r + 1)) continue;
          boxes.push(dx - r - 1, dy - r - 1, dx + r + 1, dy + r + 1);
          g.fillStyle = SEAL_COLOR[l.type];
          if (small) { g.globalAlpha = 0.8; g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; continue; }
          g.fillRect(dx - r, dy - r, r * 2, r * 2);
          g.fillStyle = '#f7eedb'; g.font = `${r * 1.5}px 'Ma Shan Zheng', serif`; g.fillText(SEAL[l.type], dx, dy + 0.5);
          // 地名（放大后；城 / 宗在中档也显示）
          const showName = close || (zoomed && !l.minor) || (ppu >= 1.6 && (l.type === 'city' || l.type === 'sect'));
          if (showName) {
            g.font = `${fs}px 'Ma Shan Zheng', serif`;
            const tw = g.measureText(l.name).width;
            // 先试右侧，再试左侧、下方
            const cand: [number, number][] = [[dx + r + 3 + tw / 2, dy], [dx - r - 3 - tw / 2, dy], [dx, dy + r + fs * 0.75]];
            for (const [lx, ly] of cand) {
              const bx0 = lx - tw / 2 - 1, bx1 = lx + tw / 2 + 1, by0 = ly - fs * 0.55, by1 = ly + fs * 0.55;
              if (bx0 < 2 || bx1 > cv.width - 2 || by0 < 2 || by1 > cv.height - 2 || !free(bx0, by0, bx1, by1)) continue;
              boxes.push(bx0, by0, bx1, by1);
              g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(240,232,212,0.92)'; g.lineJoin = 'round'; g.strokeText(l.name, lx, ly + 0.5);
              g.fillStyle = l.type === 'city' || l.type === 'sect' ? '#4a2a1c' : '#3a3328'; g.fillText(l.name, lx, ly + 0.5);
              break;
            }
          }
        }
    };
    const draw = () => {
      frame++;
      const size = cv.clientWidth || 156; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
      // 第三十八步：迷雾图随静态层一起重建
      // 档位切换时平滑过渡
      const target = MM_SPANS[ziRef.current];
      span += (target - span) * 0.35; if (Math.abs(span - target) < 0.3) span = target;
      const SPAN = span;
      const p = game.player; const mx = p.x / WORLD_SCALE, my = p.y / WORLD_SCALE;
      const k = cv.width / SPAN, c = cv.width / 2;
      const SW = Math.round(cv.width * 1.5);
      if (stCv.width !== SW) { stCv.width = stCv.height = SW; stKey = ''; }
      const now = performance.now(), key = `${SPAN.toFixed(2)}|${game.ui?.explored ?? 0}|${dpr}|${game.revealAll ? 1 : 0}`;
      if (key !== stKey || Math.abs(mx - stX) * k > cv.width * 0.2 || Math.abs(my - stY) * k > cv.width * 0.2 || now - stT > 4000) {
        makeFogCanvas(game, fogCv); paintStatic(SPAN * 1.5, mx, my, dpr, k); stKey = key; stX = mx; stY = my; stT = now;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(stCv, c + (stX - mx) * k - SW / 2, c + (stY - my) * k - SW / 2);
      const zoomed = k / dpr > 2.4;
      // 神识圈 + 玩家
      for (const m of game.events.activeMarkers()) {
        const dx = (m.x - mx) * k + c, dy = (m.y - my) * k + c;
        const pr = (4 + 2 * Math.sin(performance.now() / 300)) * dpr;
        g.strokeStyle = 'rgba(200,40,40,0.9)'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(Math.max(6, Math.min(cv.width - 6, dx)), Math.max(6, Math.min(cv.height - 6, dy)), pr + 4 * dpr, 0, Math.PI * 2); g.stroke();
      }
      const sm = game.story?.marker();
      if (sm) {
        const dx = Math.max(7 * dpr, Math.min(cv.width - 7 * dpr, (sm.x - mx) * k + c)), dy = Math.max(7 * dpr, Math.min(cv.height - 7 * dpr, (sm.y - my) * k + c));
        const pr = (5 + 1.5 * Math.sin(performance.now() / 250)) * dpr;
        g.save(); g.translate(dx, dy); g.rotate(Math.PI / 4); g.fillStyle = '#f0b830'; g.strokeStyle = '#5a3a10'; g.lineWidth = 1.5 * dpr; g.fillRect(-pr / 2, -pr / 2, pr, pr); g.strokeRect(-pr / 2, -pr / 2, pr, pr); g.restore();
      }
      // 第十八步：机缘 / 洞府 / 悬赏 / 异宝 / 求援
      for (const m of game.mapMarks?.() ?? []) {
        let dx = (m.x / WORLD_SCALE - mx) * k + c, dy = (m.y / WORLD_SCALE - my) * k + c;
        const urgent = m.glyph === '宝' || m.glyph === '赏' || m.glyph === '援' || m.glyph === '府';
        if (!urgent && (dx < 0 || dy < 0 || dx > cv.width || dy > cv.height)) continue;
        const r = 4.2 * dpr; dx = Math.max(r + 1, Math.min(cv.width - r - 1, dx)); dy = Math.max(r + 1, Math.min(cv.height - r - 1, dy));
        g.fillStyle = 'rgba(30,24,18,0.75)'; g.beginPath(); g.arc(dx, dy, r + 1, 0, Math.PI * 2); g.fill();
        g.fillStyle = m.color; g.font = `${r * 1.7}px 'Ma Shan Zheng', serif`; g.fillText(m.glyph, dx, dy + 0.5);
      }
      for (const d of game.npcs.visibleDots()) { const dx = (d.x / WORLD_SCALE - mx) * k + c, dy = (d.y / WORLD_SCALE - my) * k + c; g.fillStyle = d.c; g.beginPath(); g.arc(dx, dy, (zoomed ? 2.2 : 1.6) * dpr, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(47,140,120,0.85)'; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.arc(c, c, Math.max(4 * dpr, (game.senseRadius / WORLD_SCALE) * k), 0, Math.PI * 2); g.stroke();
      if (game.destination) {
        const dx = (game.destination.x / WORLD_SCALE - mx) * k + c, dy = (game.destination.y / WORLD_SCALE - my) * k + c;
        g.setLineDash([3 * dpr, 3 * dpr]); g.strokeStyle = 'rgba(168,53,42,0.8)';
        g.beginPath(); g.moveTo(c, c); g.lineTo(dx, dy); g.stroke(); g.setLineDash([]);
      }
      g.save(); g.translate(c, c); g.scale(dpr, dpr);
      g.fillStyle = '#a8352a'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); zoomBy(e.deltaY < 0 ? 1 : -1); };
    cv.addEventListener('wheel', wheel, { passive: false });
    draw();
    const un = game.subscribe(draw);
    return () => { un(); cv.removeEventListener('wheel', wheel); };
  }, [game]);
  const btn = (d: number) => (e: React.MouseEvent | React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); zoomBy(d); audio.sfx('click'); };
  return (
    <>
      <canvas ref={ref} onClick={onOpen} />
      <button className="mm-zoom in" disabled={zi >= MM_SPANS.length - 1} onClick={btn(1)} title="放大小地图（滚轮）">＋</button>
      <button className="mm-zoom out" disabled={zi <= 0} onClick={btn(-1)} title="缩小小地图（滚轮）">－</button>
    </>
  );
}

// ---------- 摇杆 ----------
function Joystick({ game }: { game: Game }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy), max = R * 0.62;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    setKnob({ x: dx, y: dy });
    const m = Math.min(1, d / max);
    game.input.joy.x = d > 4 ? (dx / Math.max(d, 1)) * m : 0;
    game.input.joy.y = d > 4 ? (dy / Math.max(d, 1)) * m : 0;
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); game.input.joy.x = 0; game.input.joy.y = 0; };
  return (
    <div className="joystick" ref={base}
      onPointerDown={(e) => { audio.unlock(); active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) move(e); }}
      onPointerUp={end} onPointerCancel={end}>
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

// ---------- 主线目标卷轴 ----------
function QuestTracker({ game }: { game: Game }) {
  const [, f] = useState(0);
  useEffect(() => { const t = setInterval(() => f((x) => x + 1), 250); return () => clearInterval(t); }, []);
  const q = game.story?.tracker();
  if (!q) return null;
  const go = () => { if (q.tx !== undefined && q.ty !== undefined) { audio.sfx('click'); game.destination = { x: q.tx, y: q.ty! }; game.toast(`前往：${q.title}`); } };
  return (
    <div className={'quest-tracker' + (q.tx !== undefined ? ' clickable' : '')} onPointerDown={(e) => { e.stopPropagation(); go(); }} title={q.tx !== undefined ? '点击自动前往' : ''}>
      <div className="qt-ch">{q.ch}</div>
      <div className="qt-title">{q.title}</div>
      <div className="qt-text">{q.text}</div>
      {q.ang !== undefined && q.dist !== undefined && q.dist > 160 && <div className="qt-dir"><span className="qt-arrow" style={{ transform: `rotate(${q.ang}rad)` }}>➤</span>约 {Math.max(1, Math.round(q.dist / 30))} 丈</div>}
    </div>
  );
}

// ---------- 性能监视（F3）----------
function PerfHud({ game }: { game: Game }) {
  const [, f] = useState(0);
  useEffect(() => { const t = setInterval(() => f((x) => x + 1), 500); return () => clearInterval(t); }, []);
  if (!game.showPerf) return null;
  const p = game.perf, r = game.renderer;
  return <div className="perf-hud">
    逻辑 {p.updMs.toFixed(1)}ms · 绘制 {p.renMs.toFixed(1)}ms<br />
    {r?.stage ? `WebGL · ${r.stage.W}×${r.stage.H} · ${r.stage.drawCalls} 次绘制 · 粒子 ${r.fx?.count ?? 0}` : 'Canvas2D'} · 世界层 ×{r?.dpr.toFixed(2)} · 画质 {['低', '中', '高'][r?.tier ?? 2]}<br />
    {p.fps.toFixed(0)} fps · 最慢一帧 {p.worstMs.toFixed(0)}ms · 卡顿(&gt;50ms) {r?.spikes ?? 0} 次{r?.stage?.gpuMs ? ` · GPU ${r.stage.gpuMs.toFixed(1)}ms` : ''}<br />
    {r?.stage?.gpuSec && Object.keys(r.stage.gpuSec).length ? <>GPU分段 {Object.entries(r.stage.gpuSec).map(([k2, v]) => `${k2} ${(v as number).toFixed(1)}`).join(' / ')}<br /></> : null}
    {r?.stage?.ground?.front ? `地表缓存 ${r.stage.ground.front.W}×${r.stage.ground.front.H} · 重画 ${r.stage.ground.rebuilds} 次` : '地表 —'} · 自动降档 {r?.qualityLevel ?? 0}/3<br />
    {(() => { const j = spriteJobs(); const st = sprites.stats; return `精灵 ${st.n} 张 ${st.mpx}MP · 后台生成 ${j.ok ? `开（${j.done} 张，均 ${j.avgMs.toFixed(0)}ms，排队 ${j.queued}）` : '关（主线程）'}`; })()}<br />
    树 {r?.stats.trees} · 草 {r?.stats.grass} · 敌 {game.combat.enemies.length} · NPC {game.npcs?.list.length ?? 0}
    {r?.stage?.ground ? ` · 地表本帧 ${((r.stage.ground as any).texelsThisFrame / 1000).toFixed(1)}k 纹素` : ''}<br />
    <span className="perf-top">{prof.report(8).map((x) => `${x.k} ${x.ms.toFixed(1)}`).join(' · ')}</span><br />
    {prof.spikes.length ? <>最近卡顿：{prof.spikes.slice(-2).map((x) => `${x.ms}ms←${x.top.map((y) => y.k).join('/')}`).join('；')}<br /></> : null}
    <button className="perf-btn" onClick={() => {
      const head = `fanren ${navigator.userAgent}\n${r?.stage ? `WebGL ${r.stage.W}×${r.stage.H} 绘制${r.stage.drawCalls}` : 'Canvas2D'} 世界层×${r?.dpr.toFixed(2)} 降档${r?.qualityLevel ?? 0} fps ${p.fps.toFixed(0)} 最慢 ${p.worstMs.toFixed(0)}ms 逻辑 ${p.updMs.toFixed(1)} 绘制 ${p.renMs.toFixed(1)}${r?.stage?.gpuMs ? ` GPU ${r.stage.gpuMs.toFixed(1)}` : ''}\n位置 ${Math.round(game.player.x)},${Math.round(game.player.y)} ${game.player.flying ? '飞行' : '步行'} 敌${game.combat.enemies.length} NPC${game.npcs?.list.length ?? 0}${r?.stage?.gpuSec && Object.keys(r.stage.gpuSec).length ? `\nGPU分段 ${Object.entries(r.stage.gpuSec).map(([k, v]) => `${k} ${(v as number).toFixed(1)}`).join(' / ')}` : ''}${r?.stage?.ground?.front ? `\n地表缓存 ${r.stage.ground.front.W}×${r.stage.ground.front.H} 重画${r.stage.ground.rebuilds} 开工${r.stage.ground.jobsStarted} 纹素/帧 ${Math.round(r.stage.groundTexels / 1000)}k 缩放${game.cam.zoom.toFixed(2)}` : ''}`;
      const txt = prof.text(head);
      try { navigator.clipboard.writeText(txt); } catch { /* 无剪贴板权限 */ }
      console.log(txt);
    }}>复制性能报告</button> <button className="perf-btn" onClick={() => prof.reset()}>重新计时</button>
  </div>;
}

// ---------- 主界面 ----------
export function GameView({ game, onExit }: { game: Game; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  type PanelId = '' | 'map' | 'settings' | 'char' | 'bag' | 'alchemy' | 'seclude' | 'save' | 'skills';
  const [panel, setPanel] = useState<PanelId>('');
  const [travelFx, setTravelFx] = useState<{ to: MapId; via: 'portal' | 'edge' } | null>(null);
  const [showHelp, setShowHelp] = useState(() => { try { return !localStorage.getItem('fanren_help_seen'); } catch { return true; } });

  useEffect(() => {
    loadAudio();
    game.attach(canvasRef.current!);
    game.onOpenMap = () => { audio.sfx('open'); setPanel((p) => (p === 'map' ? '' : 'map')); };
    game.onPanel = (id, force) => { audio.sfx('open'); setPanel((p) => (force ? id : p === id ? '' : id)); };
    // 换图：先放一段过场（传送阵白光 / 草原远行的水墨淡出），再存档重载
    game.onTravel = (to, via) => { game.paused = true; setPanel(''); audio.sfx(via === 'portal' ? 'thunder' : 'whoosh'); setTravelFx({ to, via }); setTimeout(() => game.switchMap(to), via === 'portal' ? 2200 : 2600); };
    const t = setTimeout(() => { setShowHelp(false); try { localStorage.setItem('fanren_help_seen', '1'); } catch { /* */ } }, 14000);
    const unload = () => game.save(0);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (game.modal) { game.closeModal(); return; } setPanel((p) => (p ? '' : 'settings')); } };
    window.addEventListener('keydown', esc);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('visibilitychange', unload);
    return () => {
      clearTimeout(t); game.detach(); game.onOpenMap = undefined; game.onPanel = undefined; game.onTravel = undefined;
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('visibilitychange', unload);
      window.removeEventListener('keydown', esc);
    };
  }, [game]);

  useEffect(() => {
    game.paused = panel !== '';
    game.input.keys.clear();
  }, [panel]);

  const ui = useUI(game);
  const toasts = useToasts(game);
  if (!ui) return <canvas ref={canvasRef} className="game-canvas" />;
  const realmDef = REALMS[game.hero.realm];
  const expPct = Math.min(100, (ui.exp / ui.need) * 100);
  const region = toasts.filter((t) => t.kind === 'region').slice(-1)[0];
  const normal = toasts.filter((t) => t.kind !== 'region');
  const loc = ui.nearby;
  const cnYear = cnNum(ui.date.year);
  const click = () => audio.sfx('click');

  return (
    <div className={"game-root" + (isTouch ? " touch" : "")}>
      <canvas ref={canvasRef} className="game-canvas" />
      <PerfHud game={game} />
      <QuestTracker game={game} />
      <div className="hud">
        {/* 人物卡 */}
        <div className="char-card">
          <div className="char-portrait" style={{ backgroundImage: 'url(./art/hanli.webp)' }} />
          <div className="char-info">
            <div className="char-name">韩立 <span className="realm-badge" style={{ background: realmDef.color }}>{ui.realmText}</span></div>
            <div className="char-sub">{ui.rootName} · {Math.floor(ui.age)}岁 / 寿{ui.maxLife}<span className="sense-range"> · 神识 {ui.sense}</span></div>
            <div className="bar hp" title="气血"><div style={{ width: `${ui.hp * 100}%` }} /></div>
            <div className="bar mp" title="法力"><div style={{ width: `${ui.mp * 100}%` }} /></div>
            <div className={'bar exp' + (ui.bottleneck !== 'none' ? ' full' : '')} title={`修为 ${Math.floor(ui.exp)} / ${ui.need}`}><div style={{ width: `${expPct}%` }} /></div>
          </div>
        </div>

        {/* 日期 + 小地图 */}
        <div className="top-right">
          <div className="date-box">
            <div className="date-season" style={{ background: SEASON_COLOR[ui.date.season] }}>{ui.date.season}</div>
            <div className="date-text">第{cnYear}年 · {MONTH[ui.date.month - 1]}<small>{ui.timeName} · {ui.weather}　{ui.regionParent && ui.regionParent !== ui.region ? `${ui.regionParent} · ` : ''}{ui.region}　探索 {(ui.explored * 100).toFixed(1)}%</small></div>
          </div>
          <div className="minimap-wrap" title="打开世界地图（M）">
            <Minimap game={game} onOpen={() => { audio.sfx('open'); setPanel('map'); }} />
            <div className="minimap-n">北</div>
            <div className="minimap-region">{ui.region}</div>
          </div>
        </div>

        {/* 提示 */}
        {showHelp && !isTouch && <div className="help-tip">WASD 移动 · Shift 疾行 · 空格 闪避 · T 交谈 · G 进城 · H 红颜录 · J 大事记·机缘 · O 传音玉符 · ? 指南 · Z 打坐 · E 采集 · 1–9 施法（自动锁定最近敌人）· Tab 切换目标· K 法术书 · Q 神识外放 · R 敛息 · C 角色 · B 储物袋 · L 丹房 · P 闭关 · M 地图 · F 御剑（体验）</div>}
        {ui.sitting && <div className="sit-banner"><div className="sb-t">打坐修炼中</div><div className="sb-s">光阴 ×4 · 每日 +{ui.expRate.toFixed(1)} 修为 · {ui.place}{ui.bottleneck !== 'none' ? ' · 已至瓶颈' : ''}</div></div>}
        {ui.pendingTalent && panel === '' && <button className="talent-alert" onClick={() => setPanel('char')}>逆天改命机缘已至——点此选择</button>}
        {(ui.gather || ui.gatherP >= 0) && !ui.sitting && panel === '' && (
          <button className="gather-tip" onClick={() => game.tryGather()}>
            {ui.gatherP >= 0 ? <>采集中…<span className="gp"><i style={{ width: `${ui.gatherP * 100}%` }} /></span></> : <><kbd>E</kbd> 采集 {ui.gather!.name}</>}
          </button>
        )}
        <div className="toasts">{normal.map((t) => <div key={t.id} className={'toast' + (t.kind === 'warn' ? ' warn' : '')}>{t.text}</div>)}</div>
        {region && <div key={region.id} className="region-banner"><div className="brush" /><div className="t">{region.text}</div></div>}

        {ui.talk && panel === '' && !game.modal && <button className="talk-tip" onClick={() => game.interact()}><kbd>T</kbd> {ui.talk}</button>}
        {/* 地点卡 */}
        {loc && panel === '' && (
          <div className="loc-card" key={loc.id}>
            <div className="loc-head">
              <div className="loc-seal" style={{ background: SEAL_COLOR[loc.type] }}>{SEAL[loc.type]}</div>
              <div className="loc-name">{loc.name}</div>
              <div className="loc-type">{LOC_TYPE_NAME[loc.type]}</div>
            </div>
            <div className="loc-desc">{loc.desc}</div>
            <div className="loc-actions">
              {game.towns.canEnter(loc) ? <button className="ink-btn" onClick={() => { audio.sfx('open'); game.enterTown(); }}>进入<span className="later">（G）</span></button>
                : <span className="hint">{loc.type === 'secret' ? '神识之内，或有机缘' : loc.type === 'danger' ? '凶险之地，量力而行' : ''}</span>}
            </div>
          </div>
        )}

        {/* 右下按钮 */}
        <div className="action-bar">
          <div className="zoom-col">
            <button className="round-btn small" onClick={() => { click(); game.zoomBy(1.25); }}>＋</button>
            <button className="round-btn small" onClick={() => { click(); game.zoomBy(0.8); }}>－</button>
          </div>
          <button className={'round-btn' + (ui.flying ? ' active' : '')} onClick={() => game.toggleFly()} title="御剑 / 落地（F）">剑<small>{ui.flying ? '落地' : '御剑'}</small></button>
          <button className={'round-btn' + (ui.sitting ? ' active' : '')} onClick={() => game.toggleSit()}>坐<small>{ui.sitting ? '起身' : '打坐'}</small></button>
          <div className="zoom-col">
            <button className={'round-btn small' + (game.senseBurstT > 0 ? ' active' : '')} onClick={() => game.senseBurst()}>识<small>外放</small></button>
            <button className={'round-btn small' + (ui.concealed ? ' active' : '')} onClick={() => game.toggleConceal()}>敛<small>敛息</small></button>
          </div>
          <div className="btn-grid">
            <button className={'round-btn small' + (ui.pendingTalent || ui.bottleneck !== 'none' ? ' glow' : '')} onClick={() => { audio.sfx('open'); setPanel('char'); }}>修<small>角色</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('bag'); }}>袋<small>储物</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('skills'); }}>术<small>法术</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('alchemy'); }}>丹<small>丹器</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('seclude'); }}>关<small>闭关</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('map'); }}>图<small>地图</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'hearts' }); }}>缘<small>红颜</small>{game.heartx?.unread > 0 && <i className="btn-badge">{game.heartx.unread}</i>}</button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'relations' }); }}>人<small>人脉</small>{(() => { const n = game.rel?.hunters().filter((d) => d.hunting).length ?? 0; return n > 0 ? <i className="btn-badge">{n}</i> : null; })()}</button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'chronicle' }); }}>记<small>机缘</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openDialog(game.war.inboxNode()); }}>符<small>玉符</small>{game.war?.unread > 0 && <i className="btn-badge">{game.war.unread}</i>}</button>
            <button className="round-btn small" onClick={() => { click(); setPanel('settings'); }}>设<small>设置</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'help' }); }}>？<small>指南</small></button>
          </div>
        </div>

        {isTouch && <Joystick game={game} />}
        {!ui.dead && <Hotbar game={game} touch={isTouch} />}
      </div>

      {panel === 'map' && <WorldMapPanel game={game} onClose={() => setPanel('')} />}
      {panel === 'settings' && <SettingsPanel game={game} onClose={() => setPanel('')} onExit={onExit} onSaves={() => setPanel('save')} />}
      {panel === 'char' && <CharPanel game={game} onClose={() => setPanel('')} />}
      {panel === 'bag' && <BagPanel game={game} onClose={() => setPanel('')} />}
      {panel === 'alchemy' && <AlchemyPanel game={game} onClose={() => setPanel('')} />}
      {panel === 'seclude' && <SecludePanel game={game} onClose={() => setPanel('')} />}
      {panel === 'skills' && <SkillPanel game={game} onClose={() => setPanel('')} />}
      {panel === 'save' && <SavePanel game={game} onClose={() => setPanel('')} />}
      <ModalLayer game={game} />
      <GainOverlay />
      <PursuitHUD game={game} />
      <BossHUD game={game} />
      <AscendUI game={game} />
      {travelFx && <div className={'travel-fx ' + travelFx.via}>
        {travelFx.via === 'portal' && <><div className="tf-ring" /><div className="tf-ring r2" /><div className="tf-flash" /></>}
        <div className="tf-text"><div className="tf-to">{MAP_NAME[travelFx.to]}</div><div className="tf-sub">{travelFx.via === 'portal' ? '阵光冲天，虚空挪移……' : travelFx.to === 'dajin' ? '横穿天澜草原，顺舜江北上……' : '穿过草原，一路南归……'}</div></div>
      </div>}
      {ui.dead && <DeathScreen game={game} onExit={onExit} />}
    </div>
  );
}
