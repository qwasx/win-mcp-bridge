import { useEffect, useMemo, useState } from 'react';
import {
  ASSETS,
  ASSET_STATS,
  STATUS_META,
  type AssetGroup,
  type MoodAsset,
} from '../data/mood';
import { InkIcon, SectionHead } from './ui';

const GROUPS: ('全部' | AssetGroup)[] = ['全部', '远山', '天空', '烟岚', '点景', '后处理'];

export function AssetLibrary({ onToast }: { onToast: (msg: string) => void }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('全部');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MoodAsset | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { 全部: ASSETS.length };
    ASSETS.forEach((a) => {
      map[a.group] = (map[a.group] ?? 0) + 1;
    });
    return map;
  }, []);

  const filtered = useMemo(
    () =>
      ASSETS.filter((a) => {
        const matchesGroup = group === '全部' || a.group === group;
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          a.cn.includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.group.includes(q) ||
          a.integration.toLowerCase().includes(q) ||
          a.note.toLowerCase().includes(q);
        return matchesGroup && matchesQuery;
      }),
    [group, query],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <div className="fade-up">
      <SectionHead
        title="贴图素材台账"
        en="MOOD TEXTURE REGISTRY"
        right={
          <div className="flex items-center gap-1.5">
            <span className="chip">
              <span className="dot" style={{ background: 'var(--seal)' }} /> 实收 23 张
            </span>
            <span className="chip">
              <span className="dot" style={{ background: 'var(--jade)' }} /> 场景已接入 {ASSET_STATS.used}
            </span>
          </div>
        }
      />

      <div className="lib-summary">
        <div>
          <b>23<span className="text-[12px] text-[#a3a494] ml-1">/ 24</span></b>
          <small>任务书标注 24 · 实收 23</small>
        </div>
        <div>
          <b style={{ color: 'var(--jade)' }}>{ASSET_STATS.used}</b>
          <small>已接入画卷</small>
        </div>
        <div>
          <b style={{ color: '#6e6a8d' }}>{ASSET_STATS.screen}</b>
          <small>黑底 · 屏滤可用</small>
        </div>
        <div>
          <b className="accent">{ASSET_STATS.rework}</b>
          <small>红底不合格 · 返工</small>
        </div>
      </div>

      <div className="lib-footnote mb-3">
        <strong style={{ fontWeight: 500, color: 'var(--seal)' }}>二轮验收结论 · </strong>
        素材包里多数 PNG 是 <span className="font-medium">RGB 初稿</span>，生成时把透明示意棋盘格直接烤进了像素：
        雾、炊烟、芦苇、梅枝、孤帆、渔火、蛾眉月、雨幕、晨暮云带、纸纹与暗角共 17 张无法直接作为 alpha 叠加层。远山三层、秋雁、月、
        星汉共 6 张可用并接入；其余统一登记返工，场景改以程序水墨替代，避免把方格带上画面。
      </div>

      <div className="lib-toolbar">
        <div className="filter-row">
          {GROUPS.map((g) => (
            <button key={g} type="button" className="filter-pill" data-active={group === g} onClick={() => setGroup(g)}>
              {g}
              <span className="ml-1.5 opacity-50">{counts[g] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <span className="absolute left-2.5 text-[#9a9c8d]">
            <InkIcon name="search" />
          </span>
          <input
            className="search-box pl-7"
            placeholder="搜索素材 / 文件名 / 接入点"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索素材"
          />
        </label>
      </div>

      <div className="lib-grid">
        {filtered.map((asset) => {
          const meta = STATUS_META[asset.status];
          return (
            <button key={asset.id} type="button" className="lib-card" onClick={() => setSelected(asset)}>
              <div
                className={`lib-media ${
                  asset.status === 'screen' ? 'is-screen' : asset.status === 'live' ? 'is-multiply' : ''
                }`}
              >
                <img src={`/assets/mood/thumb_${asset.id}.webp`} alt={asset.cn} loading="lazy" />
                <span className="media-idx">{String(ASSETS.indexOf(asset) + 1).padStart(2, '0')} / {asset.group}</span>
                <span className="media-warn">
                  {asset.status === 'screen' ? '黑底 · screen' : asset.status === 'rework' ? '棋盘底 · 待修' : 'alpha · 已修'}
                </span>
              </div>
              <div className="lib-body">
                <div className="lib-name-row">
                  <span className="lib-name">{asset.cn}</span>
                  <span className="lib-size">{asset.size}</span>
                </div>
                <span className="lib-file">{asset.id}.png</span>
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`status-dot ${meta.className}`}>
                    <span className="dot" style={{ background: 'currentColor' }} />
                    {meta.short}
                  </span>
                  <span className="font-sans text-[8px] text-[#a0a192]">{asset.used ? '已入画卷' : '未接入'}</span>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-[12px] text-[var(--ink-mute)]">
            没有匹配的素材。试试「雾」「moon」或「render.ts」。
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 font-sans text-[9px] tracking-[0.06em] text-[#929486]">
        <span>缩略图使用原图等比压缩，未做美化；卡片底色为宣纸色，screen 类以夜底展示。</span>
        <span>排序 · 按任务书素材清单 · {filtered.length} / 23</span>
      </div>

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.cn} 素材详情`} onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="关闭">
              <InkIcon name="close" />
            </button>
            <div className="panel-head">
              <span className="label">ASSET · {selected.group}</span>
              <span className={`status-dot ${STATUS_META[selected.status].className}`}>
                <span className="dot" style={{ background: 'currentColor' }} />
                {STATUS_META[selected.status].label}
              </span>
            </div>
            <div className="modal-body">
              <div className={`modal-media ${selected.status === 'screen' ? 'is-screen' : ''}`}>
                <img src={`/assets/mood/thumb_${selected.id}.webp`} alt={selected.cn} />
              </div>
              <div className="modal-copy">
                <h3 className="modal-title">{selected.cn}</h3>
                <div className="modal-file">
                  src/assets/mood/{selected.id}.png · {selected.size}
                </div>
                <div className="mt-3">
                  <div className="detail-row">
                    <span>素材组</span>
                    <span>{selected.group}</span>
                  </div>
                  <div className="detail-row">
                    <span>源文件</span>
                    <span>RGB · 无 alpha</span>
                  </div>
                  <div className="detail-row">
                    <span>接入点</span>
                    <span>{selected.integration}</span>
                  </div>
                  <div className="detail-row">
                    <span>画卷状态</span>
                    <span>{selected.used ? '已接入并随四时／天气联动' : '未接入 · 等待返工稿'}</span>
                  </div>
                  <div className="detail-row">
                    <span>验收</span>
                    <span>
                      {selected.status === 'live'
                        ? '纯红底通过 · 无棋盘残留'
                        : selected.status === 'screen'
                          ? '黑底适合屏滤；仍建议补真 alpha'
                          : '纯红底不通过 · 棋盘格 / 色边可见'}
                    </span>
                  </div>
                </div>
                <p className="detail-note">{selected.note}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.status === 'rework' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${selected.id}.png → ${selected.integration}｜返工建议：${selected.note}`);
                        onToast('返工说明已复制，可直接贴进美术任务单');
                      }}
                    >
                      <InkIcon name="download" />复制返工说明
                    </button>
                  ) : (
                    <span className="chip" style={{ borderColor: 'var(--jade)', color: 'var(--jade)' }}>
                      <InkIcon name="check" /> 已修复 · 已进入画卷
                    </span>
                  )}
                  <button type="button" className="btn" onClick={() => setSelected(null)}>
                    返回台账
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
