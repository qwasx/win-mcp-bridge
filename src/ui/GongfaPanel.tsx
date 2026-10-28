// 第 4 阶段（s4-content）：功法面板——主修 / 辅修 / 秘术、灵根适配、套路搭配、随身法宝、此地出产
import { useState } from 'react';
import type { Game } from '../world/game';
import { GONGFA, type GongfaDef } from '../data/skills';
import { ARTS, SCHOOL_COLOR } from '../data/arts';
import { itemDef, ITEM_LIST, TIER_COLORS, TIER_NAMES } from '../data/items';
import { REALMS } from '../data/realms';
import { AUX_NAME, CAT_NAME } from '../data/canon/gongfa';
import { COMBOS } from '../data/canon/combos';
import { KIND_NAME, ART_META } from '../data/canon/artgen';
import { WX_NAME, WX_COLOR, wxOfArt } from '../data/canon/types';
import { FACTIONS } from '../data/canon/factions';
import * as GF from '../world/gongfa';
import { localLoot, sectAt } from '../world/canonloot';

// 自动化截图 / 调试用
try { Object.assign(window as any, { __itemDef: itemDef, __itemList: ITEM_LIST, __sectAt: sectAt }); } catch { /* */ }
import { ItemGlyph } from './ItemIcon';
import { audio } from '../world/audio';

type Tab = 'gf' | 'combo' | 'art' | 'local';

function gfLine(g: GongfaDef) {
  const o: string[] = [];
  if (g.cat === 'aux') o.push(`辅修·${AUX_NAME[g.auxKind ?? 'shen']}`);
  else if (g.cat === 'secret') o.push('秘术');
  else {
    o.push(`修炼 ×${g.rate}`);
    if (g.path?.length) o.push(`路子：${g.path.join('')}系 +${Math.round((g.pathK ?? 0) * 100)}%`);
    if (g.sword) o.push(`飞剑 +${Math.round(g.sword * 100)}%`);
    if (g.hp) o.push(`气血 +${Math.round(g.hp * 100)}%`);
    if (g.def) o.push(`防御 +${Math.round(g.def * 100)}%`);
    if (g.mp) o.push(`法力 +${Math.round(g.mp * 100)}%`);
    if (g.atk) o.push(`攻击 +${Math.round(g.atk * 100)}%`);
  }
  return o.join(' · ');
}
const AUX_FX: Record<string, string> = {
  shen: '神识 +8%×强度，神识系法术更痛', ti: '气血 +10%、防御 +6%（×强度），炼体法术更痛', dun: '身法与赶路更快', shou: '魔幡 / 葫芦威力上浮，御兽法术更痛',
  kui: '傀儡更强（与大衍诀同修可一次放两具）', zhen: '阵盘 / 宝塔 / 宝罩更强，阵法更痛', fu: '符法更痛，法力略增', dan: '炼丹成功率上浮', qi: '一切法宝威力上浮',
};

export function GongfaPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const h = game.hero;
  const [tab, setTab] = useState<Tab>('gf');
  const main = GONGFA[h.gongfa];
  const known = [...new Set([h.gongfa, ...(h.gfKnown ?? [])])].map((id) => GONGFA[id]).filter(Boolean);
  const aux = GF.auxList(h);
  const secrets = Object.values(GONGFA).filter((g) => g.cat === 'secret' && g.secretArt && h.arts.some((a) => a.id === g.secretArt));
  const [sel, setSel] = useState<string>(h.gongfa);
  const sg = GONGFA[sel];
  const myArts = [...new Set(h.bag.filter((b) => itemDef(b.id).art).map((b) => b.id))];
  const loc = tab === 'local' ? localLoot(game) : null;
  const root = GF.rootWx(h);

  const row = (g: GongfaDef, tag: string) => (
    <button key={g.id + tag} className={'skill-row' + (sel === g.id ? ' on' : '')} onClick={() => { setSel(g.id); audio.sfx('click'); }}>
      <span className="sk-glyph" style={{ background: WX_COLOR[g.wx ?? 'none'] }}>{tag}</span>
      <span className="sk-name">{g.name}<small style={{ color: TIER_COLORS[Math.min(6, g.tier ?? 1)] }}>{TIER_NAMES[Math.min(6, g.tier ?? 1)]}</small></span>
      {g.id === h.gongfa && <span className="sk-prof p3">主修</span>}
      {(h.gfAux ?? []).includes(g.id) && <span className="sk-prof p2">辅修</span>}
    </button>
  );
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="scroll-panel cult-panel wide skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-title">功法</div>
          <div className="panel-sub">灵根 <b>{root.map((w) => WX_NAME[w]).join('')}</b> · 主修《{main?.name ?? '无'}》{GF.fitText(h, main)} · 辅修 {aux.length}/{GF.auxSlots(h)}</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="cult-body">
          <div className="tabs">
            <button className={tab === 'gf' ? 'on' : ''} onClick={() => setTab('gf')}>主修 · 辅修 · 秘术</button>
            <button className={tab === 'combo' ? 'on' : ''} onClick={() => setTab('combo')}>套路搭配</button>
            <button className={tab === 'art' ? 'on' : ''} onClick={() => setTab('art')}>随身法宝</button>
            <button className={tab === 'local' ? 'on' : ''} onClick={() => setTab('local')}>此地出产</button>
          </div>
          {tab === 'gf' && (
            <div className="bag-wrap">
              <div className="skill-list">
                <div className="hint">主修（可改修，改修散去三成修为）</div>
                {known.map((g) => row(g, WX_NAME[g.wx ?? 'none']))}
                <div className="hint" style={{ marginTop: 8 }}>辅修（筑基一门、结丹两门、元婴三门）</div>
                {aux.length ? aux.map((g) => row(g, AUX_NAME[g.auxKind ?? 'shen'][0])) : <div className="hint">尚无辅修。得到辅修玉简后研读即可。</div>}
                <div className="hint" style={{ marginTop: 8 }}>秘术（要付代价）</div>
                {secrets.length ? secrets.map((g) => row(g, '秘')) : <div className="hint">尚未习得秘术。</div>}
                <div className="hint" style={{ marginTop: 8 }}>天下功法 {Object.keys(GONGFA).length} 门：主修 {Object.values(GONGFA).filter((g) => (g.cat ?? 'main') === 'main').length} · 辅修 {Object.values(GONGFA).filter((g) => g.cat === 'aux').length} · 秘术 {Object.values(GONGFA).filter((g) => g.cat === 'secret').length}</div>
              </div>
              <div className="bag-detail">
                {sg && <>
                  <div className="bd-name" style={{ color: WX_COLOR[sg.wx ?? 'none'] }}>《{sg.name}》<small>　{CAT_NAME[sg.cat ?? 'main']} · {WX_NAME[sg.wx ?? 'none']}属 · {TIER_NAMES[Math.min(6, sg.tier ?? 1)]}</small></div>
                  <div className="bd-type">{gfLine(sg)}</div>
                  <div className="bd-desc">{sg.desc}</div>
                  {(sg.cat ?? 'main') === 'main' && <div className="bd-type">{GF.fitText(h, sg)}（灵根含{WX_NAME[sg.wx ?? 'none']}则修得顺，天灵根大顺；不含则事倍功半）</div>}
                  {sg.sig && ARTS[sg.sig] && <div className="bd-type">专属神通：<b style={{ color: SCHOOL_COLOR[ARTS[sg.sig].school] }}>{ARTS[sg.sig].name}</b>（{REALMS[Math.max(sg.sigRealm ?? 1, ARTS[sg.sig].realm)].name}期自悟）{h.arts.some((a) => a.id === sg.sig) ? '　已悟' : ''}</div>}
                  {sg.cat === 'aux' && <div className="bd-type">效果：{AUX_FX[sg.auxKind ?? 'shen']}（强度 ×{sg.auxK}）</div>}
                  {sg.cat === 'secret' && sg.secretArt && <div className="bd-type">所授秘术：{ARTS[sg.secretArt]?.name} — {ARTS[sg.secretArt]?.desc}</div>}
                  {(sg.cat ?? 'main') === 'main' && sg.id !== h.gongfa && <button className="ink-btn jade" onClick={() => { GF.switchMain(game, sg.id); re(); }}>改修为主修</button>}
                  {sg.cat === 'aux' && (h.gfAux ?? []).includes(sg.id) && <button className="ink-btn" onClick={() => { GF.dropAux(game, sg.id); setSel(h.gongfa); re(); }}>撤去辅修</button>}
                </>}
              </div>
            </div>
          )}
          {tab === 'combo' && (
            <div className="skill-list" style={{ maxHeight: 520, overflowY: 'auto' }}>
              <div className="hint">特定功法配特定法宝，出手时有额外效果（出手时头顶飘「套路·…」）。连续施展相生两系的法术（木→火→土→金→水→木），每接一环威力 +12%；法术打在被克的一方身上 ×1.25。</div>
              {COMBOS.map((c) => {
                const on = !c.builtin && myArts.some((id) => GF.combosFor(h, id, itemDef(id).art!).some((x) => x.id === c.id));
                return <div key={c.id} className={'skill-row' + (on ? ' on' : '')} style={{ display: 'block', textAlign: 'left' }}>
                  <b style={{ color: on ? '#c08a1a' : undefined }}>{c.name}</b>{on && <span className="sk-prof p3" style={{ marginLeft: 8 }}>已成</span>}{c.builtin && <small>（原有）</small>}
                  <div className="hint" style={{ margin: 0 }}>{c.desc}</div>
                </div>;
              })}
            </div>
          )}
          {tab === 'art' && (
            <div className="skill-list" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {myArts.length === 0 && <div className="hint">储物袋中尚无法宝。</div>}
              {myArts.map((id) => {
                const d = itemDef(id), a = d.art!, m = GF.artMods(h, id, a), meta = ART_META[id];
                return <div key={id} className="skill-row" style={{ display: 'flex', gap: 8, textAlign: 'left' }}>
                  <ItemGlyph id={id} className="sk-glyph" style={{ background: '#8a6a30' }} />
                  <div style={{ flex: 1 }}>
                    <b style={{ color: TIER_COLORS[d.tier] }}>{d.name}</b> <small>{TIER_NAMES[d.tier]} · {KIND_NAME[a.kind] ?? a.kind} · {WX_NAME[wxOfArt(a.element)]}属{meta?.region ? ` · 产自${({ tiannan: '天南', luanxing: '乱星海', dajin: '大晋' } as any)[meta.region]}` : ''}</small>
                    <div className="hint" style={{ margin: 0 }}>{d.desc}</div>
                    <div className="bd-type">功法加成 ×{(m.dmg ?? 1).toFixed(2)}{m.combos.length ? `　套路：${m.combos.join('、')}` : ''}</div>
                  </div>
                </div>;
              })}
            </div>
          )}
          {tab === 'local' && loc && (
            <div className="skill-list" style={{ maxHeight: 520, overflowY: 'auto' }}>
              <div className="bd-name">{loc.region.name}{loc.sect ? ` · ${loc.sect.name}地界` : ''}</div>
              <div className="hint">{loc.region.feature}</div>
              {loc.sect && <div className="hint">{FACTIONS[loc.sect.faction]?.name} · {loc.sect.desc} 镇派功法《{GONGFA[loc.sect.gongfa]?.name}》；镇宗之宝「{itemDef(loc.sect.treasure).name}」不外卖。</div>}
              <div className="hint">{loc.region.specialty.join('；')}</div>
              {([['art', '常见法器'], ['spell', '常见法术玉简'], ['gongfa', '常见功法玉简']] as const).map(([k, title]) => (
                <div key={k}>
                  <div className="hint" style={{ marginTop: 8 }}><b>{title}</b>（此地斩妖除魔所得，越靠前越常见）</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {loc[k].map((id) => { const d = itemDef(id); return <span key={id} className="skill-row" style={{ display: 'inline-flex', width: 'auto', padding: '2px 8px', gap: 4 }} title={d.desc}><ItemGlyph id={id} className="sk-glyph" style={{ background: '#8a6a30' }} /><span style={{ color: TIER_COLORS[d.tier] }}>{d.name}</span></span>; })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
