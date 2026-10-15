import { ModalLayer } from './ModalLayer';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Game, UIState } from '../world/game';
import { audio } from '../world/audio';
import { REALMS } from '../data/realms';
import { LOCATIONS, WORLD_SCALE, LOC_TYPE_NAME } from '../data/world';
import { SettingsPanel, WorldMapPanel, makeFogCanvas, SEAL, SEAL_COLOR, loadAudio } from './Panels';
import { Hotbar, SkillPanel } from './CombatUI';
import { CharPanel, BagPanel, AlchemyPanel, SecludePanel, SavePanel, DeathScreen } from './CultPanels';

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
function Minimap({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!;
    const fogCv = document.createElement('canvas');
    let fogTimer = 0;
    const SPAN = 150; // 宏观单位
    const draw = () => {
      const size = cv.clientWidth || 156; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); }
      if (fogTimer-- <= 0) { makeFogCanvas(game, fogCv); fogTimer = 6; }
      const p = game.player; const mx = p.x / WORLD_SCALE, my = p.y / WORLD_SCALE;
      const k = cv.width / SPAN;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#d9cdb0'; g.fillRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(game.overview, mx - SPAN / 2, my - SPAN / 2, SPAN, SPAN, 0, 0, cv.width, cv.height);
      g.drawImage(fogCv, (mx - SPAN / 2) / 10, (my - SPAN / 2) / 10, SPAN / 10, SPAN / 10, 0, 0, cv.width, cv.height);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const l of LOCATIONS) {
        const dx = (l.x - mx) * k + cv.width / 2, dy = (l.y - my) * k + cv.height / 2;
        if (dx < -10 || dy < -10 || dx > cv.width + 10 || dy > cv.height + 10) continue;
        if (!game.isExplored(l.x * WORLD_SCALE, l.y * WORLD_SCALE)) continue;
        const r = 5 * dpr;
        g.fillStyle = SEAL_COLOR[l.type]; g.fillRect(dx - r, dy - r, r * 2, r * 2);
        g.fillStyle = '#f7eedb'; g.font = `${r * 1.5}px 'Ma Shan Zheng', serif`; g.fillText(SEAL[l.type], dx, dy + 0.5);
      }
      // 神识圈 + 玩家
      const c = cv.width / 2;
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
      for (const d of game.npcs.visibleDots()) { const dx = (d.x / WORLD_SCALE - mx) * k + c, dy = (d.y / WORLD_SCALE - my) * k + c; g.fillStyle = d.c; g.beginPath(); g.arc(dx, dy, 1.6 * dpr, 0, Math.PI * 2); g.fill(); }
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
    draw();
    return game.subscribe(draw);
  }, [game]);
  return <canvas ref={ref} onClick={onOpen} />;
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
    {p.fps.toFixed(0)} fps · 逻辑 {p.updMs.toFixed(1)}ms · 绘制 {p.renMs.toFixed(1)}ms<br />
    {r?.stage ? `WebGL · ${r.stage.W}×${r.stage.H} · ${r.stage.drawCalls} 次绘制 · 粒子 ${r.fx?.count ?? 0}` : 'Canvas2D'} · 世界层 ×{r?.dpr.toFixed(2)} · 画质 {['低', '中', '高'][r?.tier ?? 2]}<br />
    树 {r?.stats.trees} · 草 {r?.stats.grass} · 敌 {game.combat.enemies.length} · NPC {game.npcs?.list.length ?? 0}
  </div>;
}

// ---------- 主界面 ----------
export function GameView({ game, onExit }: { game: Game; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  type PanelId = '' | 'map' | 'settings' | 'char' | 'bag' | 'alchemy' | 'seclude' | 'save' | 'skills';
  const [panel, setPanel] = useState<PanelId>('');
  const [showHelp, setShowHelp] = useState(() => { try { return !localStorage.getItem('fanren_help_seen'); } catch { return true; } });

  useEffect(() => {
    loadAudio();
    game.attach(canvasRef.current!);
    game.onOpenMap = () => { audio.sfx('open'); setPanel((p) => (p === 'map' ? '' : 'map')); };
    game.onPanel = (id, force) => { audio.sfx('open'); setPanel((p) => (force ? id : p === id ? '' : id)); };
    const t = setTimeout(() => { setShowHelp(false); try { localStorage.setItem('fanren_help_seen', '1'); } catch { /* */ } }, 14000);
    const unload = () => game.save(0);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (game.modal) { game.closeModal(); return; } setPanel((p) => (p ? '' : 'settings')); } };
    window.addEventListener('keydown', esc);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('visibilitychange', unload);
    return () => {
      clearTimeout(t); game.detach(); game.onOpenMap = undefined; game.onPanel = undefined;
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
        {showHelp && !isTouch && <div className="help-tip">WASD 移动 · Shift 疾行 · 空格 闪避 · T 交谈 · G 进城 · H 红颜录 · J 大事记 · ? 指南 · Z 打坐 · E 采集 · 1–9 施法（鼠标瞄准，否则自动锁定最近敌人）· K 法术书 · Q 神识外放 · R 敛息 · C 角色 · B 储物袋 · L 丹房 · P 闭关 · M 地图 · F 御剑（体验）</div>}
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
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('alchemy'); }}>丹<small>丹房</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('seclude'); }}>关<small>闭关</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); setPanel('map'); }}>图<small>地图</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'hearts' }); }}>缘<small>红颜</small></button>
            <button className="round-btn small" onClick={() => { audio.sfx('open'); game.openModal({ kind: 'chronicle' }); }}>记<small>大事</small></button>
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
      {ui.dead && <DeathScreen game={game} onExit={onExit} />}
    </div>
  );
}
