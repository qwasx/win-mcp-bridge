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
  const maxPills = sb ? Math.min(have, sb.count * 2) : mb ? Math.min(have, mb.maxItems) : 0;
  const [pills, setPills] = useState(Math.min(maxPills, sb ? sb.count : 1));
  const usePills = Math.min(pills, maxPills);
  const chance = sb ? C.smallChance(h, usePills) : mb ? C.majorChance(h, usePills) : 0;
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

          {bn !== 'none' && (
            <div className={'break-box ' + bn}>
              <div className="bk-title">{bn === 'major' ? `冲击${REALMS[h.realm + 1]?.name}` : `冲击${realmName(h.realm, h.stage + 1)}`}</div>
              <div className="bk-desc">{mb ? mb.desc : `小瓶颈：建议服用${itemDef(sb!.item).name} ${sb!.count} 枚辅助冲关。失败将损失两成修为。`}{mb && '　失败：修为倒退三成、重伤、折寿三年。'}</div>
              {pillId && (
                <div className="bk-row">
                  <span>服用 {itemDef(pillId).name}（持有 {have}）</span>
                  <button className="mini" disabled={usePills <= 0} onClick={() => setPills(Math.max(0, usePills - 1))}>－</button>
                  <b>{usePills}</b>
                  <button className="mini" disabled={usePills >= maxPills} onClick={() => setPills(usePills + 1)}>＋</button>
                </div>
              )}
              <div className="bk-row"><span>成功率</span><div className="bar chance"><div style={{ width: `${chance * 100}%` }} /></div><b>{(chance * 100).toFixed(0)}%</b></div>
              {mb && game.xinmo.needed() && <div className="hint">此关须先渡心魔劫：幻境由你一路的经历生成，心境稳则成功率上升，动摇则下降（约 ±20%）。</div>}
              <button className="ink-btn jade" onClick={() => { const r = game.breakthrough(usePills); setPills(0); re(); void r; }}>冲 关</button>
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
  return (
    <Panel title="闭关" onClose={onClose} sub={`${pl.name}${pl.mult > 1 ? ` · 灵气 ×${pl.mult.toFixed(1)}` : ''} · 每日 +${rate.toFixed(1)} 修为`}>
      {!rep ? (
        <>
          <div className="hint" style={{ marginBottom: 10 }}>闭关期间光阴飞逝，年岁随之增长。修为主要靠岁月苦修：筑基要十几二十年，结丹动辄数十年，结婴需百年之功；丹药只能锦上添花，服多了还会积下丹毒。遇到瓶颈、逆天改命机缘、大事将起或寿元将尽时会自动出关。宗门、秘境与灵泉畔修炼更快。</div>
          {bn !== 'none' && <div className="warn-box">修为已至瓶颈，闭关无益——请先在角色面板冲关。</div>}
          <div className="sec-opts">
            {opts.map(([n, d]) => (
              <button key={n} className="sec-opt" disabled={bn !== 'none'} onClick={() => { audio.sfx('whoosh'); setRep(game.seclude(d)); }}>
                <b>{n}</b><small>{d ? `+${fmt(rate * d)} 修为 · 年龄 +${(d / 360).toFixed(d < 360 ? 2 : 0)}` : `约 ${Math.ceil((C.need(h) - h.exp) / rate)} 日`}</small>
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
