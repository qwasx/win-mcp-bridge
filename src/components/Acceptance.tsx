import {
  ASSETS,
  CHECKS,
  PRESETS,
  STATUS_META,
  TIMES,
  TONE_MATRIX,
  WEATHERS,
  type Preset,
  type SceneConfig,
  type TimeKey,
  type WeatherKey,
} from '../data/mood';
import { MiniScene } from './MiniScene';
import { SectionHead } from './ui';

interface AcceptanceProps {
  config: SceneConfig;
  fps: number;
  frameMs: number;
  onConfig: (patch: Partial<SceneConfig>) => void;
  onPreset: (preset: Preset) => void;
  onToast: (msg: string) => void;
}

const IMPROVEMENTS = [
  { tag: 'BATCH 01 · 远山', title: '三层镜像视差长卷', desc: '远山 1/2/3 层以 0.06 / 0.12 / 0.21 视差缓移，鼠标移动时镜头随之偏转，雨雾天自动退成一层。' },
  { tag: 'CODE · 色罩', title: '5 × 4 时辰色罩表', desc: '晨蟹壳青、暮赭霞、夜花青，全部按任务书数值落地；点击色罩表即可切换世界颜色。' },
  { tag: 'CODE · 留白', title: '静观十秒，雾自起一档', desc: '无操作十秒，湖面与山腰的 SVG 水墨雾带自然加浓，画面收成一幅立轴；移动鼠标即醒。' },
  { tag: 'CODE · 点景', title: '雁阵 / 渔火 / 炊烟', desc: '秋雁用已修复原画缓慢横越；渔火 screen 叠入夜色并带倒影；炊烟由墨丝程序升起。' },
  { tag: 'CODE · 声景', title: '山风水声与雁鸣', desc: '第一次点击后生成风声与五声音阶钟磬，音量克制；唤雁时伴一声渐远的雁鸣。' },
  { tag: 'NEXT · 返工', title: '17 张底纹未分离', desc: '雾、炊烟、芦苇、梅枝、孤帆、渔火、蛾眉月、雨幕、晨暮云带、纸纹与暗角需重新输出真 RGBA。当前全部以程序水墨替代。' },
];

export function Acceptance({ config, fps, frameMs, onConfig, onPreset, onToast }: AcceptanceProps) {
  const passed = CHECKS.filter((c) => c.result === 'pass').length;
  const failed = CHECKS.filter((c) => c.result === 'fail').length;
  const used = ASSETS.filter((a) => a.used).length;
  const progress = Math.round((used / ASSETS.length) * 100);
  const circumference = 2 * Math.PI * 37;
  const dash = (progress / 100) * circumference;

  return (
    <div className="fade-up">
      <SectionHead
        title="本轮验收"
        en="ACCEPTANCE · ROUND 02"
        right={
          <div className="flex items-center gap-1.5">
            <span className="chip" style={{ color: '#3d6a55', borderColor: '#b6c9b4' }}>
              <span className="dot" style={{ background: '#3d6a55' }} /> 4 景可当壁纸
            </span>
            <span className="chip" style={{ color: 'var(--seal)', borderColor: '#d8b8a8' }}>
              <span className="dot" style={{ background: 'var(--seal)' }} /> 17 张返工
            </span>
          </div>
        }
      />

      <div className="accept-hero">
        <div className="panel score-panel">
          <div className="score-ring">
            <svg viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="37" fill="none" stroke="#ddd3bf" strokeWidth="2" />
              <circle
                cx="44"
                cy="44"
                r="37"
                fill="none"
                stroke="var(--jade)"
                strokeWidth="2"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <div>
              <b>{progress}%</b>
              <small>可用素材</small>
            </div>
          </div>
          <div className="score-meta">
            <div className="label mb-1">VERDICT</div>
            <h3>「远」有了，「空气」也进来了。</h3>
            <p>
              三层远山、时辰色罩、留白雾带与雁阵事件已合入。四张验收截图均在本卷内可直接切换；
              但素材层面仍有 17 张 alpha 缺失，属交付质量问题，不是程序接入问题。
            </p>
          </div>
          <div className="score-stats">
            <div>
              <b>{passed}</b>
              <small>通过</small>
            </div>
            <div>
              <b style={{ color: 'var(--seal)' }}>{failed}</b>
              <small>阻塞</small>
            </div>
            <div>
              <b>{ASSETS.length}</b>
              <small>实收素材</small>
            </div>
          </div>
        </div>

        <div className="panel p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] tracking-[0.1em]">最终标准 · 四张壁纸</span>
            <span className="label">WALLPAPER ×4</span>
          </div>
          <div className="wallpaper-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="wallpaper-card" onClick={() => onPreset(p)}>
                <span className="mini">
                  <MiniScene preset={p} className="h-full w-full" />
                </span>
                <span className="wp-meta">
                  <span className="wp-name">{p.name}</span>
                  <span className="wp-open">打开 ↗</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.15fr_.85fr] mb-3">
        <div className="panel">
          <div className="panel-head">
            <span className="text-[12px] tracking-[0.1em]">验收清单</span>
            <span className="label">CHECKLIST · {passed} / {CHECKS.length}</span>
          </div>
          <table className="check-table">
            <thead>
              <tr>
                <th>项目</th>
                <th style={{ width: 72 }}>结论</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="text-[11.5px]">{c.label}</span>
                    <span className="check-detail">{c.detail}</span>
                  </td>
                  <td>
                    <span className={`result-pill result-${c.result}`}>
                      {c.result === 'pass' ? '通过' : c.result === 'fail' ? '阻塞' : '待真机'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-2.5 py-2 border-t border-[var(--line-soft)] flex items-center justify-between font-sans text-[9px] text-[var(--ink-mute)]">
            <span>本机合成帧率 <b className="font-medium text-[var(--ink-soft)]">{fps} fps</b> · 帧间隔 {frameMs.toFixed(1)} ms</span>
            <button type="button" className="btn h-6 px-2 text-[9px]" onClick={() => onToast('已在画卷中实测 DOM 合成帧率；游戏内 gpubench 需真机复跑 GPU pass')}>
              为什么不是 &lt;1ms
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="text-[12px] tracking-[0.1em]">时辰色罩表</span>
            <span className="label">5 × 4 · CLICKABLE</span>
          </div>
          <div className="p-2.5">
            <table className="tone-table">
              <thead>
                <tr>
                  <th />
                  {WEATHERS.map((w) => (
                    <th key={w.key}>{w.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMES.map((t) => (
                  <tr key={t.key}>
                    <td>{t.label}</td>
                    {WEATHERS.map((w) => {
                      const cell = TONE_MATRIX[t.key as TimeKey][w.key as WeatherKey];
                      const alphaHex = Math.round(cell.opacity * 255).toString(16).padStart(2, '0').toUpperCase();
                      const active = config.time === t.key && config.weather === w.key;
                      return (
                        <td key={w.key}>
                          <button
                            type="button"
                            className="tone-cell"
                            data-active={active}
                            title={`${t.label} · ${w.label}｜${cell.color} × ${cell.opacity}`}
                            style={{
                              background: `linear-gradient(${cell.color}${alphaHex}, ${cell.color}${alphaHex}), #f7f1e2`,
                              color: cell.opacity > 0.25 ? '#f2eddf' : 'rgba(35,40,34,.72)',
                            }}
                            onClick={() => onConfig({ time: t.key, weather: w.key })}
                          >
                            {cell.opacity === 0 ? '无罩' : `${cell.color.toUpperCase()} ×${cell.opacity}`}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-start justify-between gap-2 mt-2.5 font-sans text-[9px] leading-relaxed text-[var(--ink-mute)]">
              <span>色罩叠于世界层，晴/雨/雪/雾 × 晨/午/暮/夜。点击任一格即切换当前画卷。</span>
              <span className="text-[8px] tracking-[0.1em] whitespace-nowrap" style={{ color: 'var(--jade)' }}>SOFT-LIGHT / MULTIPLY</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-head">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] tracking-[0.1em]">23 张全量验收表</span>
            <span className="label">ALPHA / RED BACKGROUND / DECISION</span>
          </div>
          <span className="chip">任务书 24 · 实收 23 · 缺 1 张</span>
        </div>
        <div className="audit-scroll scroll-thin">
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: 156 }}>素材</th>
                <th style={{ width: 56 }}>组</th>
                <th style={{ width: 92 }}>原始尺寸</th>
                <th style={{ width: 96 }}>通道处理</th>
                <th style={{ width: 88 }}>纯红底</th>
                <th style={{ width: 118 }}>结论</th>
                <th>接入点</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.cn}
                    <span className="block font-sans text-[7.5px] text-[#a0a192] mt-0.5">{a.id}.png</span>
                  </td>
                  <td>{a.group}</td>
                  <td>{a.size}</td>
                  <td>
                    {a.status === 'live' ? '纸底 → alpha' : a.status === 'screen' ? '黑底保留 · screen' : 'RGB 棋盘底'}
                  </td>
                  <td>
                    <span className={`result-pill ${a.status === 'rework' ? 'result-fail' : 'result-pass'}`}>
                      {a.status === 'rework' ? '不合格' : a.status === 'screen' ? '屏滤通过' : '通过'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-dot ${STATUS_META[a.status].className}`}>
                      <span className="dot" style={{ background: 'currentColor' }} />
                      {STATUS_META[a.status].label}
                    </span>
                  </td>
                  <td>{a.integration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[13px] tracking-[0.08em]">本轮代码增量</span>
            <span className="label">BEYOND THE 23 TEXTURES</span>
          </div>
          <span className="flex items-center gap-1.5 chip">
            <span className="dot" style={{ background: runningColor(fps) }} /> LIVE · {fps} FPS
          </span>
        </div>
        <div className="improve-grid">
          {IMPROVEMENTS.map((it) => (
            <div key={it.title} className="improve-card">
              <em>{it.tag}</em>
              <b>{it.title}</b>
              <span>{it.desc}</span>
            </div>
          ))}
        </div>
        <div className="lib-footnote mt-3 mb-0">
          复盘：本轮真正的收益来自「空气层」，而不是新物件。远山、雾、色罩三层先立住，再谈点景与后处理。
          下一轮唯一硬门槛是素材返工——<strong style={{ fontWeight: 500 }}>17 张必须交真 RGBA</strong>，
          特别是雾带、炊烟与芦苇；程序替代只能保底，不能当作最终水汽质感。北岭雪景、道观梅枝待梅枝 alpha 到位后再上。
        </div>
      </div>
    </div>
  );
}

function runningColor(fps: number) {
  return fps >= 45 ? '#3d6a55' : fps >= 25 ? '#8c7a46' : '#a34a35';
}
