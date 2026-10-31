import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSETS,
  ASSET_STATS,
  PRESETS,
  TIMES,
  TONE_MATRIX,
  WEATHERS,
  type Preset,
  type SceneConfig,
} from './data/mood';
import { Acceptance } from './components/Acceptance';
import { AssetLibrary } from './components/AssetLibrary';
import { ControlPanel } from './components/ControlPanel';
import { InkScene } from './components/InkScene';
import { InkIcon, Seal } from './components/ui';
import { useAmbience, useTelemetry } from './hooks/useAmbience';
import { cn } from './utils/cn';

type Tab = 'stage' | 'library' | 'accept';

const TABS: { key: Tab; label: string; en: string }[] = [
  { key: 'stage', label: '意境画卷', en: 'SCROLL' },
  { key: 'library', label: '素材台账', en: 'ASSETS' },
  { key: 'accept', label: '验收台', en: 'REVIEW' },
];

const INITIAL_CONFIG: SceneConfig = {
  time: 'dawn',
  weather: 'clear',
  showFar: true,
  showSky: true,
  showMist: true,
  showSpots: true,
  showPost: true,
  showCloudShadow: true,
  mountain: 100,
  mist: 62,
  grain: 52,
  parallax: 55,
};

const HERO: Record<Tab, { eyebrow: string; title: string; sub: string }> = {
  stage: {
    eyebrow: 'SCENE 01 · JING LAKE / 画意试验场',
    title: '把空气，画进山水里。',
    sub: '《凡人修仙传 · 2D 同人》v0.46 · 画面意境评审二｜远山三层 / 天空意象 / 烟岚点景，全部可调。',
  },
  library: {
    eyebrow: 'ASSET REGISTRY · 23 FILES RECEIVED',
    title: '先验素材，再谈气韵。',
    sub: '24 张任务书，实收 23 张。逐张过纯红底：能做叠加层的留下，棋盘格烤进 RGB 的登记返工。',
  },
  accept: {
    eyebrow: 'ACCEPTANCE · ROUND 02',
    title: '四景能当壁纸，才算过关。',
    sub: '晨 · 镜湖／暮 · 村落炊烟／夜 · 星汉渔火／雨 · 烟雨泽。四张同源、同色罩表、同素材库。',
  },
};

function presetFor(config: SceneConfig): Preset {
  return (
    PRESETS.find((p) => p.time === config.time && p.weather === config.weather) ??
    PRESETS.find((p) => p.time === config.time) ??
    PRESETS.find((p) => p.weather === config.weather) ??
    PRESETS[0]
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('stage');
  const [config, setConfig] = useState<SceneConfig>(INITIAL_CONFIG);
  const [geeseKey, setGeeseKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const { enabled: sound, toggle: toggleSound, playGoose } = useAmbience();
  const { fps, frameMs } = useTelemetry();

  const activePreset = useMemo(() => presetFor(config), [config]);
  const exactPreset = PRESETS.find((p) => p.time === config.time && p.weather === config.weather);
  const currentPresetId = exactPreset?.id ?? 'custom';

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2900);
  }, []);

  const patchConfig = useCallback((patch: Partial<SceneConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  const toggleLayer = useCallback(
    (key: 'showFar' | 'showSky' | 'showMist' | 'showSpots' | 'showPost') => {
      setConfig((c) => ({ ...c, [key]: !c[key] }));
    },
    [],
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      setConfig((c) => ({
        ...c,
        time: preset.time,
        weather: preset.weather,
        mist: preset.weather === 'rain' || preset.weather === 'fog' ? 78 : preset.time === 'dusk' ? 54 : preset.time === 'night' ? 48 : 62,
        showSpots: true,
        showMist: true,
        showSky: true,
        showFar: true,
      }));
      setTab('stage');
      if (preset.time === 'dusk' || preset.time === 'night') {
        window.setTimeout(() => {
          setGeeseKey((k) => k + 1);
          playGoose();
        }, 650);
      }
      showToast(`已换卷：${preset.name} · ${preset.brush}`);
    },
    [playGoose, showToast],
  );

  const callGeese = useCallback(() => {
    setGeeseKey((k) => k + 1);
    playGoose();
    showToast('一行秋雁越过镜湖 · 长空雁叫，山更远了');
  }, [playGoose, showToast]);

  const boostMist = useCallback(() => {
    patchConfig({ mist: Math.min(100, config.mist + 14), showMist: true });
    showToast('静观十秒 · 留白雾带自加浓一档');
  }, [config.mist, patchConfig, showToast]);

  const toggleSoundSafe = useCallback(() => {
    toggleSound();
    showToast(sound ? '声景已收 · 山风暂歇' : '声景已启 · 风过松针，偶有钟磬');
  }, [sound, toggleSound, showToast]);

  const goFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => showToast('当前浏览器不支持全屏'));
    } else {
      void document.exitFullscreen?.();
    }
  }, [showToast]);

  const exportConfig = useCallback(() => {
    const payload = {
      project: '凡人修仙传 · 2D 同人',
      release: 'v0.46',
      review: '画面意境提升 · 二',
      exportedAt: new Date().toISOString(),
      preset: activePreset.name,
      scene: config,
      toneWash: TONE_MATRIX[config.time][config.weather],
      assetsUsed: ASSETS.filter((a) => a.used).map((a) => a.id),
      assetsPending: ASSETS.filter((a) => a.status === 'rework').map((a) => a.id),
      renderNotes: {
        far: ['render.ts / 远景视差 0.05', 'render.ts / 远景视差 0.12', 'render.ts / 远景视差 0.22'],
        sky: ['weather.ts / 月相', 'render.ts / 星汉深夜晴天淡入'],
        mist: 'scenery.ts / SVG 水墨雾带替代未通过的圆团雾',
        post: 'CSS xuan grain + ink vignette（源码纸纹/暗角待返工）',
        idle: '静观 >10s 加浓一档',
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fanren-v046-mood-${config.time}-${config.weather}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('意境参数已导出 · 可直接并入 render.ts / weather.ts');
  }, [activePreset.name, config, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['1', '2', '3', '4'].includes(e.key)) applyPreset(PRESETS[Number(e.key) - 1]);
      if (e.key.toLowerCase() === 'g') callGeese();
      if (e.key.toLowerCase() === 'm') toggleSoundSafe();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyPreset, callGeese, toggleSoundSafe]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const hero = HERO[tab];
  const usedCount = ASSETS.filter((a) => a.used).length;
  const pendingCount = ASSETS.filter((a) => a.status === 'rework').length;

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="flex items-center gap-3 min-w-0">
          <Seal className="brand-mark">凡</Seal>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] tracking-[0.14em] whitespace-nowrap">凡人修仙传</span>
              <span className="label hidden sm:inline" style={{ letterSpacing: '.16em' }}>2D FAN ART</span>
            </div>
            <div className="brand-sub font-sans text-[8.5px] tracking-[0.22em] text-[var(--ink-mute)] mt-0.5">
              画面意境评审 · 二
            </div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="评审导航">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="nav-tab"
              data-active={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="chip hidden lg:inline-flex">
            <span className="dot" style={{ background: 'var(--jade)' }} /> v0.46 · ROUND 02
          </span>
          <button
            type="button"
            className="btn h-8 px-2.5"
            onClick={toggleSoundSafe}
            title="山风水声 / 雁鸣"
            aria-label={sound ? '关闭声景' : '开启声景'}
          >
            <InkIcon name={sound ? 'sound' : 'sound-off'} />
            <span className="hidden sm:inline">{sound ? '声景' : '声景'}</span>
          </button>
          <button type="button" className="btn btn-dark h-8" onClick={() => setTab('stage')} title="回到长卷">
            <InkIcon name="eye" />
            <span>进入长卷</span>
          </button>
        </div>
      </header>

      <main className="page">
        <div className="hero-row">
          <div className="min-w-0">
            <div className="label fade-up">{hero.eyebrow}</div>
            <h1 className="hero-title fade-up">{hero.title}</h1>
            <p className="hero-sub">{hero.sub}</p>
          </div>
          <div className="hero-actions flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn" onClick={toggleSoundSafe} data-active={sound}>
              <InkIcon name={sound ? 'sound' : 'sound-off'} />
              <span>{sound ? '声景已开' : '开启声景'}</span>
            </button>
            <button type="button" className="btn" onClick={goFullscreen}>
              <InkIcon name="expand" />
              <span>全屏观画</span>
            </button>
            <button type="button" className="btn btn-seal export-btn" onClick={exportConfig}>
              <InkIcon name="download" />
              <span>导出意境参数</span>
            </button>
          </div>
        </div>
        <div className="hero-rule" />

        {tab === 'stage' && (
          <div className="fade-up">
            <div className="mt-3 workbench">
              <div className="min-w-0">
                <div className="stage-frame">
                  <InkScene config={config} preset={activePreset} geeseKey={geeseKey} onToggle={toggleLayer} />
                </div>
                <div className="stage-foot">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span><b>远景</b> 视差 0.05 / 0.12 / 0.22</span>
                    <span className="opacity-30">·</span>
                    <span><b>空气</b> 三层烟岚 + 云影</span>
                    <span className="opacity-30">·</span>
                    <span><b>声画</b> {sound ? '风声已响' : '点开声景听雁鸣'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="dot" style={{ background: 'var(--jade)' }} />
                    已接入 {usedCount} / 23 · 待返工 {pendingCount}
                  </div>
                </div>
              </div>

              <ControlPanel
                config={config}
                presetId={currentPresetId}
                fps={fps}
                sound={sound}
                onConfig={patchConfig}
                onPreset={applyPreset}
                onToggle={toggleLayer}
                onGeese={callGeese}
                onSound={toggleSoundSafe}
                onMistBoost={boostMist}
                onExport={exportConfig}
              />
            </div>

            <div className="tone-strip">
              <div className="panel p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] tracking-[0.1em]">时辰色罩 · 当前世界</span>
                    <span className="label">5 × 4 WASH</span>
                  </div>
                  <span className="chip">
                    <span
                      className="dot"
                      style={{
                        background: TONE_MATRIX[config.time][config.weather].color,
                        boxShadow: '0 0 0 1px rgba(60,60,50,.15)',
                      }}
                    />
                    {TONE_MATRIX[config.time][config.weather].color.toUpperCase()} ×
                    {TONE_MATRIX[config.time][config.weather].opacity}
                  </span>
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: '26px repeat(4, minmax(0, 1fr))' }}>
                  <span />
                  {WEATHERS.map((w) => (
                    <span key={w.key} className="text-center font-sans text-[8.5px] tracking-[0.1em] text-[var(--ink-mute)]">
                      {w.label}
                    </span>
                  ))}
                  {TIMES.map((t) => (
                    <div key={t.key} className="contents">
                      <span className="font-sans text-[9px] text-[var(--ink-mute)] tracking-[0.08em] flex items-center">{t.label}</span>
                      {WEATHERS.map((w) => {
                        const cell = TONE_MATRIX[t.key][w.key];
                        const hex = Math.round(cell.opacity * 255).toString(16).padStart(2, '0').toUpperCase();
                        const active = config.time === t.key && config.weather === w.key;
                        return (
                          <button
                            key={w.key}
                            type="button"
                            className="tone-cell"
                            data-active={active}
                            title={`${t.label} · ${w.label}｜${cell.color} × ${cell.opacity}`}
                            style={{
                              background: `linear-gradient(${cell.color}${hex},${cell.color}${hex}), #f6f0e1`,
                              height: 26,
                              color: cell.opacity > 0.25 ? '#f4eedf' : 'rgba(33,39,33,.65)',
                            }}
                            onClick={() => patchConfig({ time: t.key, weather: w.key })}
                          >
                            {cell.opacity === 0 ? '无' : `${cell.opacity}`}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-2 font-sans text-[9px] text-[var(--ink-mute)] leading-relaxed">
                  点击任一格套用「时辰 × 天气」。罩色以 {TONE_MATRIX[config.time][config.weather].blend} 叠在世界层，
                  夜间自动加深并压低远山明度。
                </div>
              </div>

              <div className="panel p-3 audit-teaser">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] tracking-[0.1em]">素材台账提要</span>
                    <span className="label">ALPHA AUDIT</span>
                  </div>
                  <button type="button" className="label underline underline-offset-2" onClick={() => setTab('library')}>
                    全部 23 张
                  </button>
                </div>
                <div className="audit-list">
                  <div className="audit-item">
                    <i style={{ background: 'var(--jade)' }} />
                    已修复接入（远山 / 雁 / 月 / 星汉）
                    <span>{usedCount}</span>
                  </div>
                  <div className="audit-item">
                    <i style={{ background: '#8f87b0' }} />
                    黑底保留 · 以 screen 屏滤
                    <span>{ASSET_STATS.screen}</span>
                  </div>
                  <div className="audit-item">
                    <i style={{ background: 'var(--seal)' }} />
                    棋盘格烤进 RGB · 返工
                    <span>{pendingCount}</span>
                  </div>
                </div>
                <div>
                  <div className="progress-track">
                    <i style={{ width: `${Math.round((usedCount / ASSETS.length) * 100)}%` }} />
                  </div>
                  <div className="progress-caption">
                    <span>本轮可用率 {Math.round((usedCount / ASSETS.length) * 100)}%</span>
                    <span>任务书 24 · 实收 23</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="btn flex-1" onClick={() => setTab('accept')}>
                    <InkIcon name="check" />看验收结论
                  </button>
                  <button type="button" className="btn flex-1" onClick={() => setTab('library')}>
                    素材台账 <InkIcon name="arrow" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 panel p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label mr-1">四景换卷</span>
                {PRESETS.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn('btn h-8', currentPresetId === p.id && 'btn-dark')}
                    onClick={() => applyPreset(p)}
                  >
                    <span className="font-sans text-[9px] opacity-60">0{i + 1}</span>
                    {p.name}
                  </button>
                ))}
              </div>
              <span className="font-sans text-[9px] text-[var(--ink-mute)] tracking-[0.06em]">
                快捷键 1–4 换景 · G 唤雁 · M 声景
              </span>
            </div>
          </div>
        )}

        {tab === 'library' && <AssetLibrary onToast={showToast} />}
        {tab === 'accept' && (
          <Acceptance
            config={config}
            fps={fps}
            frameMs={frameMs}
            onConfig={patchConfig}
            onPreset={applyPreset}
            onToast={showToast}
          />
        )}

        <footer className="page-foot">
          <div className="flex items-center gap-2.5">
            <Seal className="w-5 h-5 text-[10px]">凡</Seal>
            <span>凡人修仙传 · 2D 同人｜v0.46 · 画面意境提升 · 评审二</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>素材实收 23 张 · 可用 {usedCount} · 返工 {pendingCount}</span>
            <span className="hidden sm:inline">四景已合成 · 参数可导出</span>
            <span style={{ color: 'var(--jade)' }}>气韵生动</span>
          </div>
        </footer>
      </main>

      {toast && (
        <div className="toast" role="status">
          <Seal>印</Seal>
          {toast}
        </div>
      )}
    </div>
  );
}
