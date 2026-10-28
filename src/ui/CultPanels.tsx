// 第二步面板：角色 / 背包 / 炼丹 / 闭关 / 存档 / 坐化
import { useState } from 'react';
import type { Game, SeclusionReport } from '../world/game';
import { Game as GameCls } from '../world/game';
import * as C from '../world/cultivation';
import { REALMS, realmName, smallBottleneck, MAJOR_BREAKS, levelOf } from '../data/realms';
import { itemDef } from '../data/items';
import { RECIPES } from '../data/recipes';
import { talentById } from '../data/skills';
import { audio } from '../world/audio';
import { ItemGlyph } from './ItemIcon';
import * as A from '../world/ascend';

const TYPE_NAME: Record<string, string> = { pill: '丹药', herb: '灵草', material: '材料', talisman: '符箓', scroll: '功法', artifact: '法宝', misc: '杂物' };
const TIER_COLOR = ['#5a544a', '#2f6b5e', '#2b5a8a', '#7a3a9a', '#b8802a', '#a8352a', '#d04a20'];
const fmt = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.round(n).toLocaleString();

function Panel({ title, onClose, children, wide, sub }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; sub?: React.ReactNode }) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className={'scroll-panel cult-panel' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><div className="panel-title">{title}</div><div className="panel-sub">{sub}</div><button className="close-btn" onClick={onClose}>×</button></div>
        <div className="cult-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 角色
export function CharPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const h = game.hero;
  const st = C.heroStats(h);
  const need = C.need(h);
  const bn = C.bottleneck(h);
  const root = C.rootDef(h), gf = C.gongfaDef(h);
  const pl = game.placeBonus();
  const sb = bn === 'small' ? smallBottleneck(h.realm, h.stage) : null;
  const mb = bn === 'major' ? MAJOR_BREAKS[h.realm] : null;
  const pillId = sb?.item ?? mb?.item ?? '';
  const have = pillId ? C.bagCount(h, pillId) : 0;
  const maxPills = sb ? Math.min(have, sb.count * 2) : mb ? Math.min(have, A.BASE[h.realm]?.max ?? mb.maxItems) : 0;
  const [pills, setPills] = useState(Math.min(maxPills, sb ? sb.count : 1));
  const usePills = Math.min(pills, maxPills);
  const pv = mb ? game.ascend.preview(usePills) : null;
  const chance = sb ? C.smallChance(h, usePills) : pv ? pv.parts.total : 0;
  const asc = A.ascOf(h);
  const lifeLeft = C.maxLife(h) - h.age;
  const nextTalent = C.TALENT_LEVELS.find((lv) => lv > levelOf(h.realm, h.stage));

  return (
    <Panel title="韩立" onClose={onClose} wide sub={<span className="realm-badge" style={{ background: REALMS[h.realm].color, fontSize: 14 }}>{realmName(h.realm, h.stage)}</span>}>
      {h.pendingTalent && (
        <div className="talent-pick">
          <div className="tp-title">逆 天 改 命</div>
          <div className="tp-sub">修为精进，心有所感——择一机缘，永久改变命数</div>
          <div className="tp-cards">
            {h.pendingTalent.map((id) => { const t = talentById(id)!; return (
              <button key={id} className={'tp-card tier' + t.tier} onClick={() => { game.chooseTalent(id); re(); }}>
                <div className="tp-name">{t.name}</div><div className="tp-desc">{t.desc}</div>
              </button>); })}
          </div>
        </div>
      )}
      <div className="char-grid">
        <div className="char-left">
          <div className="char-big-portrait" style={{ backgroundImage: 'url(./art/hanli.webp)' }} />
          <div className="kv"><span>年龄</span><b>{Math.floor(h.age)} 岁</b></div>
          <div className="kv"><span>寿元</span><b style={{ color: lifeLeft < 10 ? '#a8352a' : undefined }}>{C.maxLife(h)} 载（余 {Math.max(0, lifeLeft).toFixed(1)}）</b></div>
          <div className="kv"><span>灵根</span><b title={root.desc}>{root.name} ×{root.rate}</b></div>
          <div className="kv"><span>功法</span><b title={gf.desc}>{gf.name} ×{gf.rate}</b></div>
          {h.bottle.owned !== false && <div className="kv"><span>掌天瓶</span><b className="bottle">{'●'.repeat(h.bottle.drops)}{'○'.repeat(C.BOTTLE_MAX - h.bottle.drops)}{h.bottle.drops < C.BOTTLE_MAX && <small>（{Math.ceil(C.BOTTLE_DAYS - h.bottle.charge)} 天后凝露）</small>}</b></div>}
        </div>
        <div className="char-right">
          <div className="sec-title">修为</div>
          <div className="exp-line">
            <div className="bar exp big"><div style={{ width: `${Math.min(100, (h.exp / need) * 100)}%` }} /></div>
            <span>{fmt(h.exp)} / {fmt(need)}</span>
          </div>
          <div className="hint">打坐每日 +{C.expPerDay(h, pl.mult).toFixed(1)} 修为（{pl.name}{pl.mult > 1 ? ` ×${pl.mult.toFixed(1)}` : ''}）· 预计 {bn === 'none' ? Math.ceil((need - h.exp) / C.expPerDay(h, pl.mult)) + ' 天' : '已满'}</div>

          <AscStatus game={game} re={re} />
          {bn === 'small' && (
            <div className={'break-box ' + bn}>
              <div className="bk-title">冲击{realmName(h.realm, h.stage + 1)}</div>
              <div className="bk-desc">小瓶颈：建议服用{itemDef(sb!.item).name} {sb!.count} 枚辅助冲关。失败将损失两成修为。</div>
              {pillId && (
                <div className="bk-row">
                  <span>服用 {itemDef(pillId).name}（持有 {have}）</span>
                  <button className="mini" disabled={usePills <= 0} onClick={() => setPills(Math.max(0, usePills - 1))}>－</button>
                  <b>{usePills}</b>
                  <button className="mini" disabled={usePills >= maxPills} onClick={() => setPills(usePills + 1)}>＋</button>
                </div>
              )}
              <div className="bk-row"><span>成功率</span><div className="bar chance"><div style={{ width: `${chance * 100}%` }} /></div><b>{(chance * 100).toFixed(0)}%</b></div>
              <button className="ink-btn jade" onClick={() => { const r = game.breakthrough(usePills); setPills(0); re(); void r; }}>冲 关</button>
            </div>
          )}
          {bn === 'major' && mb && pv && (
            <div className="break-box major asc-prep">
              <div className="bk-title">冲击{REALMS[h.realm + 1]?.name} · 准备清单</div>
              <div className="bk-desc">{mb.desc}</div>
              <div className="prep-list">
                {pv.prep.map((x) => (
                  <div key={x.id} className={'prep-row' + (x.ok ? ' ok' : '')} title={x.hint}>
                    <span className="pk">{x.ok ? '✔' : '✘'}</span><b>{x.name}</b><span className="pp">{x.prog}</span><span className="pb">{x.ok ? `+${Math.round(x.bonus * 100)}%` : `（+${Math.round(x.bonus * 100)}%）`}</span>
                    {!x.ok && <div className="ph">{x.hint}</div>}
                  </div>
                ))}
              </div>
              {pillId && (
                <div className="bk-row">
                  <span>服用 {itemDef(pillId).name}（持有 {have}，每枚 +{Math.round((A.BASE[h.realm]?.per ?? 0) * 100)}%）</span>
                  <button className="mini" disabled={usePills <= 0} onClick={() => setPills(Math.max(0, usePills - 1))}>－</button>
                  <b>{usePills}</b>
                  <button className="mini" disabled={usePills >= maxPills} onClick={() => setPills(usePills + 1)}>＋</button>
                </div>
              )}
              <div className="hint chance-parts">
                底子 {Math.round(pv.parts.base * 100)}% · 丹药 +{Math.round(pv.parts.pills * 100)}% · 灵根气运 +{Math.round(pv.parts.root * 100)}% · 准备 +{Math.round(pv.parts.prep * 100)}%
                {pv.parts.insight > 0 && <> · 失败感悟 +{Math.round(pv.parts.insight * 100)}%</>}
                {pv.parts.toxin < 0 && <> · <span style={{ color: '#a8352a' }}>丹毒 {Math.round(pv.parts.toxin * 100)}%</span></>}
                {pv.parts.injury < 0 && <> · <span style={{ color: '#a8352a' }}>重伤 {Math.round(pv.parts.injury * 100)}%</span></>}
              </div>
              <div className="bk-row"><span>成功率</span><div className="bar chance"><div style={{ width: `${chance * 100}%` }} /></div><b>{(chance * 100).toFixed(0)}%</b></div>
              <div className="hint">{h.realm === 1 ? '关卡：引灵冲脉——冲开奇经八脉，发挥好坏 ±15%。' : h.realm === 2 ? '关卡：心魔劫（三重）＋ 凝丹三转——火候决定金丹品阶（一至九品，终身带着）。' : h.realm === 3 ? '关卡：心魔劫（五重）＋ 碎丹成婴——漩涡会引来外敌，护法替你挡，自己也得守住阵眼。' : '关卡：元神合一——炼化十方天地元气。'}</div>
              <div className="hint" style={{ color: '#7a3a2a' }}>失败：修为倒退三成、重伤 {A.INJ_DAYS[h.realm]} 日、折寿 {A.LIFE_LOSS[h.realm]} 载，约 {Math.round(A.FALL_CH[h.realm] * 100)}% 跌落一层；但会留下感悟，下次 +6%。</div>
              <div className="hint">天命已定：准备条件不变，冲关结果不变——读档重来也一样。多凑一项准备，才是正途。</div>
              <button className="ink-btn jade" disabled={game.ascend.busy} onClick={() => { game.breakthrough(usePills); setPills(0); re(); onClose(); }}>冲 关</button>
            </div>
          )}

          <div className="sec-title">属性</div>
          <div className="stat-grid">
            <div><span>气血</span><b>{Math.round(st.hp * h.hp)} / {st.hp}</b></div>
            <div><span>法力</span><b>{Math.round(st.mp * h.mp)} / {st.mp}</b></div>
            <div><span>攻击</span><b>{st.atk}</b></div>
            <div><span>防御</span><b>{st.def}</b></div>
            <div><span>神识</span><b>{st.sense}</b></div>
            <div><span>感知</span><b>{Math.round(game.senseRadius)} 步</b></div>
          </div>

          <div className="sec-title">天赋 <small>{nextTalent ? `下次逆天改命：${realmName(...fromLv(nextTalent))}` : ''}</small></div>
          <div className="talent-list">
            {h.talents.length === 0 && <div className="hint">尚无。炼气四层、七层、十层、十三层及此后每一境界，皆可逆天改命一次。</div>}
            {h.talents.map((id) => { const t = talentById(id); return t && <span key={id} className={'tal tier' + t.tier} title={t.desc}>{t.name}</span>; })}
          </div>
          <div className="sec-title">履历</div>
          <div className="hint">打坐 {Math.round(h.stats.meditateDays)} 日 · 采集 {h.stats.gathered} 次 · 服丹 {h.stats.pills} 枚 · 炼丹 {h.stats.alchemy} 炉 · 突破 {h.stats.breaks} 次 · 失败 {h.stats.failed} 次</div>
        </div>
      </div>
    </Panel>
  );
}
/** 第 2 阶段：心得、丹毒、重伤、金丹、感悟 */
function AscStatus({ game, re }: { game: Game; re: () => void }) {
  const h = game.hero, a = A.ascOf(h);
  const lq = C.bagCount(h, 'mat_lingquan'), lr = C.bagCount(h, 'herb_yangshen');
  return (
    <div className="asc-status">
      <style>{`.asc-status{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;margin:4px 0 8px;color:#4a3e2c}.asc-status b{color:#2a2018}.asc-status .bad{color:#a8352a}
.asc-prep .prep-list{margin:6px 0;border-top:1px dashed rgba(90,70,40,.3)}.prep-row{display:grid;grid-template-columns:20px 72px 1fr auto;gap:6px;align-items:center;font-size:13.5px;padding:3px 0;border-bottom:1px dashed rgba(90,70,40,.2);color:#6a5a48}
.prep-row.ok{color:#2a3a28}.prep-row .pk{color:#a8352a;font-weight:700}.prep-row.ok .pk{color:#2f7a3a}.prep-row .pb{font-weight:700}.prep-row.ok .pb{color:#2f7a3a}.prep-row .ph{grid-column:2/-1;font-size:12px;color:#8a7a60}.chance-parts{font-size:12.5px}`}</style>
      <span>心得 <b>{Math.round(a.xinde)}</b> 日<small>（闭关所耗）</small></span>
      <span className={a.toxin >= 35 ? 'bad' : ''}>丹毒 <b>{Math.round(a.toxin)}</b>·{A.toxinName(a.toxin)}（药力 {Math.round(A.toxinMult(h) * 100)}%）</span>
      {a.injury > 0 && <span className="bad">重伤 余 {Math.ceil(a.injury)} 日（属性七折）</span>}
      {a.core > 0 && <span>金丹 <b>{A.CORE_NAME[a.core]}</b>（属性 {a.core >= 5 ? '+' : ''}{(a.core - 5) * 4}%）</span>}
      {(a.insight[h.realm] ?? 0) > 0 && <span>冲关感悟 <b>{a.insight[h.realm]}</b> 分</span>}
      {a.toxin >= 5 && lq > 0 && <button className="mini" onClick={() => { C.removeItem(h, 'mat_lingquan', 1); a.toxin = Math.max(0, a.toxin - 25); game.toast('以灵泉水洗涤经脉，丹毒消退了些。', 'good'); re(); }}>灵泉水洗毒（{lq}）</button>}
      {a.toxin >= 30 && lr > 0 && <button className="mini" onClick={() => { C.removeItem(h, 'herb_yangshen', 1); a.toxin = 0; game.toast('万年灵乳入腹，经脉中的丹毒涤荡一空。', 'good'); re(); }}>万年灵乳化毒（{lr}）</button>}
    </div>
  );
}

function fromLv(lv: number): [number, number] { if (lv <= 13) return [1, lv - 1]; const k = lv - 14; return [2 + Math.floor(k / 3), k % 3]; }

// ---------------------------------------------------------------- 背包
export function BagPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const [tab, setTab] = useState<string>('all');
  const [sel, setSel] = useState<number>(-1);
  const h = game.hero;
  const items = h.bag.map((b, i) => ({ b, i, d: itemDef(b.id) })).filter((x) => tab === 'all' || x.d.type === tab);
  const cur = sel >= 0 ? h.bag[sel] : null;
  const cd = cur ? itemDef(cur.id) : null;
  const lingshi = C.bagCount(h, 'mat_lingshi');
  return (
    <Panel title="储物袋" onClose={onClose} wide sub={<span>灵石 <b>{lingshi}</b>{h.bottle.owned !== false && <>　·　掌天瓶 <b className="bottle">{'●'.repeat(h.bottle.drops)}{'○'.repeat(C.BOTTLE_MAX - h.bottle.drops)}</b></>}</span>}>
      <div className="tabs">
        {['all', 'pill', 'herb', 'material', 'scroll', 'artifact'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setSel(-1); }}>{t === 'all' ? '全部' : TYPE_NAME[t]}</button>)}
      </div>
      <div className="bag-wrap">
        <div className="bag-grid">
          {items.map(({ b, i, d }) => (
            <button key={i} className={'slot' + (sel === i ? ' on' : '')} onClick={() => { setSel(i); audio.sfx('click'); }} title={d.name}>
              <ItemGlyph id={d.id} className="glyph" style={{ color: TIER_COLOR[d.tier] ?? '#333' }} />
              <span className="nm">{d.name}</span>
              {b.age !== undefined && <span className="age">{b.age}年</span>}
              <span className="cnt">{b.n}</span>
            </button>
          ))}
          {items.length === 0 && <div className="hint" style={{ gridColumn: '1/-1' }}>空空如也。在神识范围内寻找灵草、矿脉与灵泉，按 E 采集。</div>}
        </div>
        <div className="bag-detail">
          {cur && cd ? (
            <>
              <div className="bd-name" style={{ color: TIER_COLOR[cd.tier] }}>{cd.name}{cur.age !== undefined && <small>　{cur.age} 年药龄</small>}</div>
              <div className="bd-type">{TYPE_NAME[cd.type]} · {['凡品', '下品', '中品', '上品', '极品', '灵品', '仙品'][cd.tier] ?? ''} · 持有 {cur.n}</div>
              <div className="bd-desc">{cd.desc}</div>
              {cd.type === 'herb' && <div className="hint">药龄越高，炼丹成功率越高；部分丹方要求百年以上药龄。</div>}
              <div className="bd-actions">
                {cd.pill && <button className="ink-btn jade" onClick={() => { game.usePill(cur.id); if (!h.bag[sel] || h.bag[sel].id !== cur.id) setSel(-1); re(); }}>服用</button>}
                {cur.id.startsWith('egg_') && <button className="ink-btn jade" disabled={!!game.ws.incubate} onClick={() => { game.pets.onEgg(cur.id); setSel(-1); re(); }}>{game.ws.incubate ? '已有灵卵在温养' : '温 养'}</button>}
                {cd.type === 'scroll' && <button className="ink-btn jade" onClick={() => { if (game.learnScroll(cur.id)) setSel(-1); re(); }}>研读参悟</button>}
                {cd.art && <button className="ink-btn" onClick={() => { const key = 'art:' + cur.id; if (!h.hotbar.includes(key)) { const k = h.hotbar.findIndex((x) => !x); h.hotbar[k >= 0 ? k : 8] = key; game.toast(`${cd.name}已放入快捷栏 ${(k >= 0 ? k : 8) + 1}`); } re(); }}>放入快捷栏</button>}
                {cd.art && ['armor', 'shield', 'flight', 'wings', 'boots'].includes(cd.art.kind) && <button className="ink-btn jade" onClick={() => { game.combat.castArtifact(cur.id); re(); }}>{Object.values(h.equip ?? {}).includes(cur.id) ? '收起' : '祭出'}</button>}
                {cd.type === 'talisman' && cd.tal?.kind !== 'revive' && <button className="ink-btn" onClick={() => { const key = 'tal:' + cur.id; if (!h.hotbar.includes(key)) { const k = h.hotbar.findIndex((x) => !x); h.hotbar[k >= 0 ? k : 8] = key; game.toast(`${cd.name}已放入快捷栏 ${(k >= 0 ? k : 8) + 1}`); } re(); }}>放入快捷栏</button>}
                {cd.type === 'herb' && h.bottle.owned !== false && <button className="ink-btn" disabled={h.bottle.drops <= 0} onClick={() => { game.useBottle(cur); const ni = h.bag.findIndex((x) => x.id === cur.id && x.age === (cur.age ?? 0) + C.BOTTLE_YEARS); setSel(ni); re(); }}>掌天瓶催熟（+{C.BOTTLE_YEARS}年）</button>}
              </div>
            </>
          ) : <div className="hint">选择一件物品查看。</div>}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- 炼丹
export function AlchemyPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const [tab, setTab] = useState<'pill' | 'forge'>('pill');
  const list = RECIPES.filter((x) => (x.kind ?? 'pill') === tab);
  const [sel, setSel] = useState(RECIPES[0].id);
  const [log, setLog] = useState<string[]>([]);
  const h = game.hero;
  const fire = game.forgeFire;
  const r = list.find((x) => x.id === sel) ?? list[0];
  const chk = C.checkRecipe(h, r, fire);
  const forge = tab === 'forge';
  return (
    <Panel title={forge ? '器炉' : '丹房'} onClose={onClose} wide sub={forge ? (fire ? '此地有地火可借，炼器无碍。妖兽身上的鳞、爪、鳍、角与妖丹皆是炼器之材。' : '此处无地火，只能以自身法力催火——成器率大减。去城镇法器阁或宗门炼器房更稳妥。') : '以灵草炼丹。药龄越高，成丹率越高；有灵泉水在侧亦可提升。'}>
      <div className="alch-tabs">
        <button className={tab === 'pill' ? 'on' : ''} onClick={() => { setTab('pill'); setSel(RECIPES[0].id); }}>炼丹</button>
        <button className={tab === 'forge' ? 'on' : ''} onClick={() => { setTab('forge'); setSel(''); }}>炼器{fire ? <i>地火</i> : null}</button>
      </div>
      <div className="alch">
        <div className="recipe-list">
          {list.map((x) => { const ok = C.checkRecipe(h, x, fire).ok; return (
            <button key={x.id} className={'recipe' + (r.id === x.id ? ' on' : '') + (ok ? ' ok' : '')} onClick={() => setSel(x.id)}>
              <span className="glyph">{forge ? '器' : '丹'}</span>{x.name}{ok && <i>{forge ? '可炼' : '可炼'}</i>}
            </button>); })}
        </div>
        <div className="recipe-detail">
          <div className="bd-name">{r.name}<small>　产出 {itemDef(r.out).name} ×{r.outN}　耗时 {r.days} 日{forge ? `　需${['凡人', '炼气', '筑基', '结丹', '元婴'][r.reqRealm]}期` : ''}</small></div>
          <div className="bd-desc">{r.desc}</div>
          <div className="sec-title">{forge ? '所需材料' : '所需药材'}</div>
          <div className="inputs">
            {r.inputs.map((inp) => { const have = C.bagCount(h, inp.id, inp.minAge ?? 0); const ok = have >= inp.n; return (
              <div key={inp.id} className={'inp' + (ok ? ' ok' : '')}>
                <ItemGlyph id={inp.id} className="glyph" />
                <div><b>{itemDef(inp.id).name}</b>{inp.minAge ? <small> · {inp.minAge}年以上</small> : null}<div className="hint">持有 {have} / 需 {inp.n}{!ok && inp.minAge && C.bagCount(h, inp.id) > have ? `（另有 ${C.bagCount(h, inp.id) - have} 株年份不足，可用掌天瓶催熟）` : ''}</div></div>
              </div>); })}
          </div>
          <div className="bk-row"><span>{forge ? '成器率' : '成丹率'}</span><div className="bar chance"><div style={{ width: `${chk.chance * 100}%` }} /></div><b>{(chk.chance * 100).toFixed(0)}%</b></div>
          <button className="ink-btn jade" disabled={!chk.ok} onClick={() => { const res = game.brew(r); setLog((l) => [res.msgs.map((m) => m.text).join(' '), ...l].slice(0, 5)); re(); }}>{forge ? '起 炉 炼 器' : '开 炉'}</button>
          <div className="alch-log">{log.map((l, i) => <div key={i} style={{ opacity: 1 - i * 0.18 }}>{l}</div>)}</div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- 闭关
export function SecludePanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [rep, setRep] = useState<SeclusionReport | null>(null);
  const h = game.hero;
  const pl = game.placeBonus();
  const rate = C.expPerDay(h, pl.mult);
  const bn = C.bottleneck(h);
  const opts: [string, number][] = [['一月', 30], ['一年', 360], ['十年', 3600], ['三十年', 10800], ['直到瓶颈', 0]];
  const asc = A.ascOf(h), pol = game.ascend.polishing(), lock = bn !== 'none' && !pol;
  const focus = rate * A.SECLUDE_FOCUS;
  return (
    <Panel title="闭关" onClose={onClose} sub={`${pl.name}${pl.mult > 1 ? ` · 灵气 ×${pl.mult.toFixed(1)}` : ''} · 有心得每日 +${focus.toFixed(1)} 修为 · 心得 ${Math.round(asc.xinde)} 日`}>
      {!rep ? (
        <>
          <div className="hint" style={{ marginBottom: 10 }}>闭关要耗<b>心得</b>：在外历练、斩妖除魔、去悟道之地（地图「悟」字）才攒得下。一日心得抵一日苦修（比打坐专注 ×{A.SECLUDE_FOCUS}）；心得耗尽，「直到瓶颈」会自动出关，定时闭关则闭门造车，十日难抵一日之功。闭关久了常被打断——仇家上门、红颜求救、宗门召集。丹药只能锦上添花，吃多了积下丹毒。</div>
          <div className="bk-row"><span>心得</span><div className="bar chance"><div style={{ width: `${Math.min(100, asc.xinde / A.xindeCap(h.realm) * 100)}%` }} /></div><b>{Math.round(asc.xinde)} / {A.xindeCap(h.realm)} 日</b></div>
          {pol && <div className="warn-box" style={{ background: 'rgba(60,110,80,.12)' }}>修为已圆满。继续闭关可「打磨根基」：{Math.floor(asc.polish)} / {A.POLISH_DAYS[h.realm]} 日（准备清单「修为圆满」一项）。</div>}
          {lock && <div className="warn-box">修为已至瓶颈，闭关无益——请先在角色面板冲关。</div>}
          <div className="sec-opts">
            {opts.map(([n, d]) => (
              <button key={n} className="sec-opt" disabled={lock} onClick={() => { audio.sfx('whoosh'); setRep(game.seclude(d)); }}>
                <b>{n}</b><small>{d ? `${Math.min(d, asc.xinde) < d ? `心得只够 ${Math.floor(asc.xinde)} 日` : `+${fmt(focus * d)} 修为`} · 年龄 +${(d / 360).toFixed(d < 360 ? 2 : 0)}` : pol ? `打磨到 ${A.POLISH_DAYS[h.realm]} 日` : `约 ${Math.ceil((C.need(h) - h.exp) / focus)} 日（心得够 ${Math.floor(asc.xinde)} 日）`}</small>
              </button>
            ))}
          </div>
          <div className="hint">寿元：{Math.floor(h.age)} / {C.maxLife(h)} 岁</div>
        </>
      ) : (
        <div className="sec-report">
          <div className="sr-title">出 关</div>
          <div className="sr-line">闭关 <b>{rep.days >= 360 ? `${(rep.days / 360).toFixed(1)} 年` : `${Math.round(rep.days)} 日`}</b> · {rep.reason}</div>
          <div className="sr-line">{rep.from === rep.to ? rep.to : <>{rep.from} → <b className="up">{rep.to}</b></>}</div>
          {rep.msgs.slice(-8).map((m, i) => <div key={i} className={'sr-msg ' + (m.kind ?? '')}>{m.text}</div>)}
          <div className="bd-actions"><button className="ink-btn jade" onClick={onClose}>出关</button>{game.hero.pendingTalent && <span className="hint">（打开角色面板选择逆天改命）</span>}</div>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- 存档
export function SavePanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const slots = GameCls.listSlots();
  return (
    <Panel title="存档" onClose={onClose} sub="自动存档每二十秒及离开时写入">
      <div className="slots">
        {slots.map((s) => (
          <div key={s.key} className={'slot-row' + (s.empty ? ' empty' : '')}>
            <div className="sl-name">{s.name}</div>
            <div className="sl-info">{s.empty ? '—— 空 ——' : <>{s.realm} · {s.age}岁 · 第{s.year}年 · {s.region}<small>{s.time ? new Date(s.time).toLocaleString() : ''}</small></>}</div>
            <div className="sl-btns">
              {s.slot > 0 && <button className="ink-btn" onClick={() => { if (game.save(s.slot)) game.toast(`已存入${s.name}。`, 'good'); audio.sfx('chime'); re(); }}>存</button>}
              {!s.empty && <button className="ink-btn ghost" onClick={() => { if (game.load(s.key)) { game.toast(`已读取${s.name}。`, 'good'); onClose(); } }}>读</button>}
              {!s.empty && s.slot > 0 && <button className="ink-btn ghost" onClick={() => { if (confirm(`删除${s.name}？`)) { GameCls.deleteSlot(s.slot); re(); } }}>删</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="sec-title">存档码<small>复制到别处保存，或在另一台设备导入（离线“云存档”）</small></div>
      <div className="bd-actions">
        <button className="ink-btn small" onClick={() => { game.save(0); const raw = localStorage.getItem('fanren_save_auto') ?? ''; const code = btoa(unescape(encodeURIComponent(raw))); navigator.clipboard?.writeText(code).then(() => game.toast('存档码已复制到剪贴板。', 'good'), () => prompt('复制以下存档码：', code)); }}>导出存档码</button>
        <button className="ink-btn small ghost" onClick={() => { const code = prompt('粘贴存档码：'); if (!code) return; try { const raw = decodeURIComponent(escape(atob(code.trim()))); JSON.parse(raw); localStorage.setItem('fanren_save_3', raw); if (game.load('fanren_save_3')) { game.toast('导入成功（已写入存档三）。', 'good'); onClose(); } } catch { game.toast('存档码无效。', 'warn'); } }}>导入存档码</button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- 坐化
export function DeathScreen({ game, onExit }: { game: Game; onExit: () => void }) {
  const h = game.hero;
  return (
    <div className="death">
      <div className="death-inner">
        <div className="d-title">坐 化</div>
        <div className="d-sub">韩立寿元耗尽，于{game.ui.region}坐化，享年 {Math.floor(h.age)} 岁。</div>
        <div className="d-sub">终其一生，修至 <b>{realmName(h.realm, h.stage)}</b>。</div>
        <div className="d-stats">打坐 {Math.round(h.stats.meditateDays)} 日 · 采集 {h.stats.gathered} 次 · 炼丹 {h.stats.alchemy} 炉 · 突破 {h.stats.breaks} 次</div>
        <div className="d-quote">“大道无情，仙途漫漫。”</div>
        <button className="ink-btn" onClick={onExit}>重入轮回</button>
      </div>
    </div>
  );
}
