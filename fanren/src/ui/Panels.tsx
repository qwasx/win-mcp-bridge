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
export function WorldMapPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [hover, setHover] = useState<string>('');

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

  useEffect(() => {
    const cv = ref.current!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size.w * dpr; cv.height = size.h * dpr;
    const g = cv.getContext('2d')!;
    const fog = makeFogCanvas(game, undefined, 200);
    let raf = 0;
    const s = size.w / MACRO_W; // 宏观单位 → CSS 像素
    const draw = (t: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(game.overview, 0, 0, size.w, size.h);
      // 迷雾（柔边）
      g.save();
      try { g.filter = `blur(${Math.max(2, s * 6)}px)`; } catch { /* */ }
      g.drawImage(fog, 0, 0, size.w, size.h);
      g.restore();
      // 大区域名
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const L of BIG_LABELS) {
        const fs = Math.max(13, L.size * 9 * s * 1.6);
        g.font = `${fs}px 'Ma Shan Zheng', serif`;
        g.fillStyle = 'rgba(40,34,26,0.32)';
        g.fillText(L.name.split('').join(' '), L.at[0] * s, L.at[1] * s);
      }
      // 陆路出口：图边的箭头
      for (const ex of MAP_EXITS[ACTIVE_MAP]) {
        const north = ex.edge === 'n', y = north ? 22 : size.h - 22;
        g.font = `${Math.max(13, 15 * s * 1.6)}px 'Ma Shan Zheng', serif`;
        g.fillStyle = 'rgba(120,40,30,0.75)';
        g.fillText(`${north ? '↑' : '↓'} ${ex.to === 'dajin' ? '天澜草原 · 大晋' : '慕兰草原 · 天南'} ${north ? '↑' : '↓'}`, size.w / 2, y);
      }
      // 地点（先画已探索与重要地点，名字做简单避让）
      const placed: [number, number, number, number][] = [];
      const order = [...LOCATIONS].sort((a, b) => (b.id === hover ? 1 : 0) - (a.id === hover ? 1 : 0) || (b.major ? 1 : 0) - (a.major ? 1 : 0));
      for (const l of order) {
        const wx = l.x * WORLD_SCALE, wy = l.y * WORLD_SCALE;
        const known = game.isExplored(wx, wy);
        if (!known && !l.major) continue;
        const x = l.x * s, y = l.y * s;
        const r = Math.max(4, 7 * s * 1.4) * (l.major ? 1.15 : 0.85);
        g.globalAlpha = known ? 1 : 0.5;
        g.fillStyle = SEAL_COLOR[l.type];
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.strokeStyle = 'rgba(250,240,220,0.9)'; g.lineWidth = 1; g.strokeRect(x - r + 1.5, y - r + 1.5, r * 2 - 3, r * 2 - 3);
        g.fillStyle = '#f7eedb'; g.font = `${r * 1.45}px 'Ma Shan Zheng', serif`;
        g.fillText(SEAL[l.type], x, y + r * 0.08);
        if (l.major || s > 0.85 || hover === l.id) {
          const fs = Math.max(11, 11 * s * 1.2);
          g.font = `${fs}px 'Noto Serif SC', serif`;
          const label = known ? l.name : l.name + '（传闻）';
          const tw = g.measureText(label).width;
          const box: [number, number, number, number] = [x - tw / 2 - 3, y + r + 2, tw + 6, fs + 4];
          const hit = placed.some(([bx, by, bw, bh]) => box[0] < bx + bw && box[0] + box[2] > bx && box[1] < by + bh && box[1] + box[3] > by);
          if (!hit || hover === l.id) {
            placed.push(box);
            g.fillStyle = hover === l.id ? 'rgba(255,248,230,0.98)' : 'rgba(246,239,222,0.85)'; g.fillRect(box[0], box[1], box[2], box[3]);
            g.fillStyle = '#2b2620'; g.fillText(label, x, y + r + 4 + fs / 2);
          }
        }
        g.globalAlpha = 1;
      }
      // 目的地
      if (game.destination) {
        const dx = (game.destination.x / WORLD_SCALE) * s, dy = (game.destination.y / WORLD_SCALE) * s;
        g.strokeStyle = '#a8352a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(dx - 6, dy - 6); g.lineTo(dx + 6, dy + 6); g.moveTo(dx + 6, dy - 6); g.lineTo(dx - 6, dy + 6); g.stroke();
        g.setLineDash([4, 5]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(168,53,42,0.7)';
        g.beginPath(); g.moveTo((game.player.x / WORLD_SCALE) * s, (game.player.y / WORLD_SCALE) * s); g.lineTo(dx, dy); g.stroke(); g.setLineDash([]);
      }
      // 玩家与神识
      const px = (game.player.x / WORLD_SCALE) * s, py = (game.player.y / WORLD_SCALE) * s;
      const sr = (game.senseRadius / WORLD_SCALE) * s;
      g.strokeStyle = 'rgba(63,160,140,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, Math.max(sr, 5), 0, Math.PI * 2); g.stroke();
      const pulse = (t / 1000) % 1.6 / 1.6;
      g.strokeStyle = `rgba(168,53,42,${1 - pulse})`; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 6 + pulse * 18, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#a8352a'; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, hover]);

  const toWorld = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { mx: ((e.clientX - r.left) / r.width) * MACRO_W, my: ((e.clientY - r.top) / r.height) * MACRO_H };
  };
  const pickLoc = (mx: number, my: number) => {
    let best = '', bd = 14 * (1000 / size.w);
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
  const hovered = LOCATIONS.find((l) => l.id === hover);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="scroll-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-title">人界舆图 · {MAP_NAME[ACTIVE_MAP]}</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--ink-soft)' }}>
            {hovered ? <><b style={{ color: 'var(--ink)' }}>{hovered.name}</b>　{game.isExplored(hovered.x * WORLD_SCALE, hovered.y * WORLD_SCALE) ? hovered.desc : '只闻其名，尚未亲至。'}</>
              : `已探索 ${(game.ui.explored * 100).toFixed(1)}%　·　点击地图设定目的地${game.debugTeleport ? '（体验：瞬移）' : ''}`}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <canvas ref={ref} className="worldmap-canvas" style={{ width: size.w, height: size.h }}
          onPointerMove={(e) => { const { mx, my } = toWorld(e); const id = pickLoc(mx, my); if (id !== hover) setHover(id); }}
          onPointerUp={onClick} />
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
