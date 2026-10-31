import { ASSET_STATS, PRESETS, TIMES, WEATHERS, type Preset, type SceneConfig } from '../data/mood';
import { MiniScene } from './MiniScene';
import { InkIcon, Slider, Switch } from './ui';

interface ControlPanelProps {
  config: SceneConfig;
  presetId: string;
  fps: number;
  sound: boolean;
  onConfig: (patch: Partial<SceneConfig>) => void;
  onPreset: (preset: Preset) => void;
  onToggle: (key: 'showFar' | 'showSky' | 'showMist' | 'showSpots' | 'showPost') => void;
  onGeese: () => void;
  onSound: () => void;
  onMistBoost: () => void;
  onExport: () => void;
}

const LAYERS: {
  key: 'showFar' | 'showSky' | 'showMist' | 'showSpots' | 'showPost';
  label: string;
  sub: string;
}[] = [
  { key: 'showFar', label: '远山三层长卷', sub: '视差 0.05 / 0.12 / 0.22' },
  { key: 'showSky', label: '天空意象', sub: '星汉 · 月相 · 流云' },
  { key: 'showMist', label: '烟岚水汽', sub: '山腰雾带 · 湖面留白' },
  { key: 'showSpots', label: '点景活眼', sub: '孤帆 · 村落 · 芦苇' },
  { key: 'showPost', label: '宣纸后处理', sub: '纸纹 · 淡墨暗角 · 色罩' },
];

export function ControlPanel({
  config,
  presetId,
  fps,
  sound,
  onConfig,
  onPreset,
  onToggle,
  onGeese,
  onSound,
  onMistBoost,
  onExport,
}: ControlPanelProps) {
  return (
    <aside className="ctrl-stack" aria-label="气韵控制台">
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <span className="seal" style={{ width: 18, height: 18, fontSize: 9 }}>韵</span>
            <span className="text-[12px] tracking-[0.14em]">气韵控制台</span>
          </div>
          <span className="label">LIVE</span>
        </div>

        <div className="ctrl-card">
          <div className="ctrl-title">
            四景验收 <span className="normal-case tracking-normal text-[8.5px]">点击换卷</span>
          </div>
          <div className="preset-grid">
            {PRESETS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="preset-card"
                data-active={presetId === p.id}
                onClick={() => onPreset(p)}
                title={p.quote}
              >
                <span className="preset-mini">
                  <MiniScene preset={p} className="h-full w-full" />
                </span>
                <span className="preset-meta">
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-idx">0{i + 1}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="field-label mt-3">
            时辰 <span>{TIMES.find((t) => t.key === config.time)?.time}</span>
          </div>
          <div className="seg" role="group" aria-label="时辰">
            {TIMES.map((t) => (
              <button key={t.key} type="button" data-on={config.time === t.key} onClick={() => onConfig({ time: t.key })}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="field-label">
            天气 <span>{WEATHERS.find((w) => w.key === config.weather)?.en}</span>
          </div>
          <div className="seg jade" role="group" aria-label="天气">
            {WEATHERS.map((w) => (
              <button key={w.key} type="button" data-on={config.weather === w.key} onClick={() => onConfig({ weather: w.key })}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ctrl-card" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="ctrl-title">
            空气层 <span className="normal-case tracking-normal text-[8.5px]">AIR LAYERS</span>
          </div>
          {LAYERS.map((layer) => (
            <div className="toggle-row" key={layer.key}>
              <div className="toggle-copy">
                {layer.label}
                <small>{layer.sub}</small>
              </div>
              <Switch on={config[layer.key]} onChange={() => onToggle(layer.key)} label={layer.label} />
            </div>
          ))}
          <div className="mt-2">
            <Slider label="远山" value={Math.round(config.mountain)} onChange={(mountain) => onConfig({ mountain })} min={20} max={100} />
            <Slider label="烟岚" value={Math.round(config.mist)} onChange={(mist) => onConfig({ mist })} min={0} max={100} />
            <Slider label="纸纹" value={Math.round(config.grain)} onChange={(grain) => onConfig({ grain })} min={0} max={100} />
            <Slider label="视差" value={Math.round(config.parallax)} onChange={(parallax) => onConfig({ parallax })} min={0} max={100} />
          </div>
          <div className="toggle-row mt-1">
            <div className="toggle-copy">
              云影过地
              <small>晴日 5% 暗度 · 8–15 px/s</small>
            </div>
            <Switch on={config.showCloudShadow} onChange={(v) => onConfig({ showCloudShadow: v })} label="云影过地" />
          </div>

          <div className="action-grid mt-2.5">
            <button type="button" className="btn" onClick={onGeese}>
              <InkIcon name="feather" />唤一行秋雁
            </button>
            <button type="button" className="btn" onClick={onSound} data-active={sound}>
              <InkIcon name={sound ? 'sound' : 'sound-off'} />
              {sound ? '声景已启' : '山风水声'}
            </button>
            <button type="button" className="btn" onClick={onMistBoost}>
              静观 · 雾起
            </button>
            <button type="button" className="btn" onClick={onExport}>
              <InkIcon name="download" />导出参数
            </button>
          </div>

          <div className="telemetry">
            <div>
              <b>{fps}</b>
              <small>FPS · 本机</small>
            </div>
            <div>
              <b>{ASSET_STATS.used}</b>
              <small>已接入素材</small>
            </div>
            <div>
              <b>5 × 4</b>
              <small>时辰色罩</small>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
