// 第三步界面：快捷栏（1–9）与法术书（K）
import { useEffect, useRef, useState } from 'react';
import type { Game } from '../world/game';
import { ARTS, ART_LIST, SCHOOL_COLOR, SCHOOL_NAME, TIER_NAME, TIER_COLOR, PROF_NAME, STATUS_NAME, profLevel, profNeed, School } from '../data/arts';
import { itemDef } from '../data/items';
import { REALMS } from '../data/realms';
import { audio } from '../world/audio';
import { ItemGlyph } from './ItemIcon';

function slotInfo(id: string | null | undefined): { glyph: string; name: string; color: string; tier: number } | null {
  if (!id) return null;
  if (id.startsWith('art:')) { const d = itemDef(id.slice(4)); return { glyph: d.glyph, name: d.name, color: '#b8802a', tier: d.tier }; }
  if (id.startsWith('tal:')) { const d = itemDef(id.slice(4)); return { glyph: d.name[0], name: d.name, color: d.tal?.color ?? '#c0a050', tier: d.tier }; }
  const s = ARTS[id];
  if (!s) return null;
  return { glyph: s.name[0], name: s.name, color: SCHOOL_COLOR[s.school], tier: s.tier };
}

function talCount(game: Game, id: string) { let n = 0; for (const b of game.hero.bag) if (b.id === id) n += b.n; return n; }

/** 快捷栏：PC 底部一排九格；触屏右下 3×3 法诀盘 */
export function Hotbar({ game, touch }: { game: Game; touch: boolean }) {
  const cdRefs = useRef<(HTMLDivElement | null)[]>([]);
  const txtRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0, sig = '';
    const loop = () => {
      const h = game.hero;
      const s = h.hotbar.join('|') + h.arts.length + h.hotbar.map((id) => id?.startsWith('tal:') ? talCount(game, id.slice(4)) : '').join(',');
      if (s !== sig) { sig = s; force((x) => x + 1); }
      h.hotbar.forEach((id, i) => {
        const el = cdRefs.current[i], tx = txtRefs.current[i];
        if (!el || !id) return;
        const key = id.startsWith('art:') ? id : id;
        const f = game.combat.cdFrac(key), left = game.combat.cdLeft(key);
        el.style.height = `${f * 100}%`;
        if (tx) tx.textContent = left > 0.05 ? (left >= 10 ? Math.ceil(left) + '' : left.toFixed(1)) : '';
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  const h = game.hero;
  return (
    <div className={'hotbar' + (touch ? ' pad' : '')}>
      {h.hotbar.map((id, i) => {
        const inf = slotInfo(id);
        const equipped = id?.startsWith('art:') && Object.values(h.equip ?? {}).includes(id.slice(4));
        return (
          <button key={i} className={'hb-slot' + (inf ? '' : ' empty') + (equipped ? ' equipped' : '')}
            title={inf ? `${inf.name}（${i + 1}）` : '空（按 K 放置法术）'}
            onPointerDown={(e) => { e.stopPropagation(); audio.unlock(); if (inf) game.combat.castSlot(i); else game.onPanel?.('skills', true); }}
            style={inf ? { ['--sc' as any]: inf.color } : undefined}>
            {inf && (id!.startsWith('art:') || id!.startsWith('tal:')) ? <ItemGlyph id={id!.slice(4)} className="hb-glyph" /> : inf && <span className="hb-glyph">{inf.glyph}</span>}
            {inf && !touch && <span className="hb-name">{inf.name}</span>}
            {id?.startsWith('tal:') && <span className="hb-count">{talCount(game, id.slice(4))}</span>}
            <div className="hb-cd" ref={(el) => (cdRefs.current[i] = el)} />
            <span className="hb-cdt" ref={(el) => (txtRefs.current[i] = el)} />
            {!touch && <span className="hb-key">{i + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}

const SCHOOLS: School[] = ['火', '冰', '雷', '风', '土', '木', '剑', '体', '御', '魔', '识', '阵', '身', '符'];
const CAST_NAME: Record<string, string> = { bolt: '弹道', fan: '扇射', nova: '周身爆发', burst: '落点爆发', cone: '前方锥形', beam: '光柱', strike: '天降', chain: '连锁', field: '持续区域', orbit: '环身', dash: '冲刺', blink: '瞬移', buff: '增益', shield: '护盾', heal: '疗伤', summon: '召唤', sense: '神识' };

/** 法术书：已习得法术、熟练度、放入快捷栏 */
export function SkillPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const h = game.hero;
  const [tab, setTab] = useState<'arts' | 'items'>('arts');
  const [school, setSchool] = useState<School | 'all'>('all');
  const [sel, setSel] = useState<string>(h.arts[0]?.id ?? '');
  const learned = new Set(h.arts.map((a) => a.id));
  const list = h.arts.map((a) => ({ a, s: ARTS[a.id] })).filter((x) => x.s && (school === 'all' || x.s.school === school)).sort((x, y) => x.s.tier - y.s.tier || x.s.realm - y.s.realm);
  const arts = [...new Set(h.bag.filter((b) => itemDef(b.id).art).map((b) => b.id))];
  const tals = [...new Set(h.bag.filter((b) => { const t = itemDef(b.id).tal; return t && t.kind !== 'revive'; }).map((b) => b.id))];
  const selKey = sel;
  const assign = (i: number) => {
    if (!selKey) return;
    const j = h.hotbar.indexOf(selKey);
    if (j >= 0) h.hotbar[j] = h.hotbar[i];
    h.hotbar[i] = selKey;
    audio.sfx('click'); re();
  };
  const clear = (i: number) => { h.hotbar[i] = null; audio.sfx('click'); re(); };
  const s = ARTS[sel];
  const a = h.arts.find((x) => x.id === sel);
  const lv = s && a ? profLevel(s.tier, a.xp) : 0;
  const need = s ? profNeed(s.tier) : [0];
  const it = sel.startsWith('art:') || sel.startsWith('tal:') ? itemDef(sel.slice(4)) : null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="scroll-panel cult-panel wide skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><div className="panel-title">法术书</div><div className="panel-sub">已习得 <b>{learned.size}</b> / {ART_LIST.length} 门 · 斩妖 {h.kills ?? 0}</div><button className="close-btn" onClick={onClose}>×</button></div>
        <div className="cult-body">
          <div className="tabs">
            <button className={tab === 'arts' ? 'on' : ''} onClick={() => setTab('arts')}>法术神通</button>
            <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>法宝法器</button>
            {tab === 'arts' && <span className="school-filter">
              <button className={school === 'all' ? 'on' : ''} onClick={() => setSchool('all')}>全</button>
              {SCHOOLS.filter((x) => h.arts.some((a) => ARTS[a.id]?.school === x)).map((x) => <button key={x} className={school === x ? 'on' : ''} style={{ color: SCHOOL_COLOR[x] }} onClick={() => setSchool(x)}>{x}</button>)}
            </span>}
          </div>
          <div className="bag-wrap">
            <div className="skill-list">
              {tab === 'arts' && list.map(({ a, s }) => {
                const l = profLevel(s.tier, a.xp);
                return (
                  <button key={s.id} className={'skill-row' + (sel === s.id ? ' on' : '')} onClick={() => { setSel(s.id); audio.sfx('click'); }}>
                    <span className="sk-glyph" style={{ background: SCHOOL_COLOR[s.school] }}>{s.name[0]}</span>
                    <span className="sk-name">{s.name}<small style={{ color: TIER_COLOR[s.tier] }}>{TIER_NAME[s.tier]}</small></span>
                    <span className={'sk-prof p' + l}>{PROF_NAME[l]}</span>
                    {h.hotbar.includes(s.id) && <span className="sk-slot">{h.hotbar.indexOf(s.id) + 1}</span>}
                  </button>
                );
              })}
              {tab === 'items' && arts.map((id) => {
                const d = itemDef(id), key = 'art:' + id;
                return (
                  <button key={id} className={'skill-row' + (sel === key ? ' on' : '')} onClick={() => { setSel(key); audio.sfx('click'); }}>
                    <ItemGlyph id={id} className="sk-glyph" style={{ background: '#8a6a30' }} />
                    <span className="sk-name">{d.name}<small>{['凡器', '法器', '上品法器', '顶阶法器', '法宝', '古宝', '通天灵宝'][d.tier] ?? ''}</small></span>
                    {Object.values(h.equip ?? {}).includes(id) && <span className="sk-prof p2">已祭出</span>}
                    {h.hotbar.includes(key) && <span className="sk-slot">{h.hotbar.indexOf(key) + 1}</span>}
                  </button>
                );
              })}
              {tab === 'items' && tals.map((id) => {
                const d = itemDef(id), key = 'tal:' + id;
                return (
                  <button key={id} className={'skill-row' + (sel === key ? ' on' : '')} onClick={() => { setSel(key); audio.sfx('click'); }}>
                    <span className="sk-glyph" style={{ background: d.tal?.color ?? '#a08040' }}>{d.name[0]}</span>
                    <span className="sk-name">{d.name}<small>符箓 ×{talCount(game, id)}</small></span>
                    {h.hotbar.includes(key) && <span className="sk-slot">{h.hotbar.indexOf(key) + 1}</span>}
                  </button>
                );
              })}
              {tab === 'items' && arts.length === 0 && tals.length === 0 && <div className="hint">储物袋中尚无法器。斩杀妖兽、探索洞府遗迹可得。</div>}
              {tab === 'arts' && <div className="hint" style={{ marginTop: 8 }}>尚有 {ART_LIST.length - learned.size} 门法术散落天下：妖兽、魔修掉落，洞府遗迹，日后坊市、宗门藏经阁亦可求得。</div>}
            </div>
            <div className="bag-detail">
              {s && a && (
                <>
                  <div className="bd-name" style={{ color: SCHOOL_COLOR[s.school] }}>{s.name}<small>　{SCHOOL_NAME[s.school]} · {TIER_NAME[s.tier]}</small></div>
                  <div className="bd-type">{CAST_NAME[s.cast]} · 需{REALMS[s.realm].name}期 · 法力 {Math.round(s.mp * 100)}%{s.hpCost ? ` · 气血 ${Math.round(s.hpCost * 100)}%` : ''} · 冷却 {s.cd}s{s.power > 0 ? ` · 威力 ×${s.power}` : ''}{s.status ? ` · ${STATUS_NAME[s.status.k]}` : ''}</div>
                  <div className="bd-desc">{s.desc}</div>
                  {s.needs && <div className="hint">需持有 {itemDef(s.needs).name}{C_has(game, s.needs) ? '（已有）' : '（未得）'}</div>}
                  <div className="prof-track">
                    {PROF_NAME.map((n, i) => <div key={i} className={'pt' + (i <= lv ? ' on' : '')}><b>{n}</b><span>{i === 0 ? '入门' : s.evo[i - 1]}</span></div>)}
                  </div>
                  <div className="prof-bar"><i style={{ width: `${lv >= 3 ? 100 : Math.min(100, ((a.xp - need[lv]) / (need[lv + 1] - need[lv])) * 100)}%` }} /><span>{lv >= 3 ? '已臻圆满' : `施展 ${a.xp} / ${need[lv + 1]} 次可至${PROF_NAME[lv + 1]}`}</span></div>
                </>
              )}
              {it && it.art && (
                <>
                  <div className="bd-name" style={{ color: '#8a6a30' }}>{it.name}</div>
                  <div className="bd-desc">{it.desc}</div>
                  <div className="bd-type">驱使法力 {it.art.mp} · 冷却 {it.art.cd}s{it.art.power ? ` · 威力 ×${it.art.power}` : ''}</div>
                  {(['armor', 'shield', 'flight', 'wings', 'boots'] as string[]).includes(it.art.kind) && <button className="ink-btn jade" onClick={() => { game.combat.castArtifact(sel.slice(4)); re(); }}>{Object.values(h.equip ?? {}).includes(sel.slice(4)) ? '收起' : '祭出护身'}</button>}
                </>
              )}
              {it && it.tal && (
                <>
                  <div className="bd-name" style={{ color: it.tal.color }}>{it.name}<small>　符箓 · 持有 {talCount(game, it.id)}</small></div>
                  <div className="bd-desc">{it.desc}</div>
                  <div className="bd-type">一次性消耗 · 符箓之力对高境界敌人衰减较少（越一大境界仍有三成）</div>
                </>
              )}
              {sel && <>
                <div className="hint" style={{ marginTop: 10 }}>点击下方格子放入快捷栏（再按数字键 1–9 施展）：</div>
                <div className="hb-assign">
                  {h.hotbar.map((id, i) => {
                    const inf = slotInfo(id);
                    return (
                      <div key={i} className={'hba' + (id === selKey ? ' cur' : '')}>
                        <button onClick={() => assign(i)} style={inf ? { borderColor: inf.color } : undefined}>
                          <b>{i + 1}</b><span style={{ color: inf?.color }}>{inf ? inf.name : '空'}</span>
                        </button>
                        {id && <i onClick={() => clear(i)}>×</i>}
                      </div>
                    );
                  })}
                </div>
              </>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function C_has(game: Game, id: string) { return game.hero.bag.some((b) => b.id === id); }
