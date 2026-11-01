// 第四十三步：活世界——人脉录里的「人物根底」卡片与「天下事」编年
import { useState } from 'react';
import type { Game } from '../world/game';
import type { NpcData } from '../world/npc';
import { itemDef, TIER_COLORS } from '../data/items';
import { realmName } from '../data/realms';
import { LIVE_K_NAME, LIVE_K_COLOR, dateText, bookName } from '../world/living';
import type { LiveK } from '../world/living';

const who = (o: NpcData) => `${o.name}${o.alive ? (o.hidden ? `（${Math.floor(o.age)}岁）` : '') : '（已故）'}`;

/** 人物根底：眼下的打算、门派、功法、家小、师承、交游、恩仇、储物袋、生平 */
export function LifeCard({ game, d }: { game: Game; d: NpcData }) {
  const L = game.living; if (!L) return null;
  const P = L.profile(d), pr = d.sex === 'f' ? '她' : '他';
  return (
    <div className="live-card">
      <div className="live-row"><b>眼下</b><span>{P.plan}</span></div>
      <div className="live-row"><b>门派</b><span>{P.sect ? <>{P.sect} · {P.rank}<small>（贡献 {P.ctb}）</small></> : P.faction}</span></div>
      <div className="live-row"><b>功法</b><span>{P.gf ? `主修《${P.gf}》` : '不曾修行'}{P.arts.length ? <small>　习得 {P.arts.map(bookName).join('')}</small> : null}</span></div>
      <div className="live-row"><b>家小</b><span>{P.fam.length ? P.fam.map((x, i) => <i key={i} className={x.o.alive ? '' : 'gone'}>{x.r}{who(x.o)}</i>) : '孑然一身'}</span></div>
      {(P.master.length > 0 || P.disc.length > 0) && <div className="live-row"><b>师承</b><span>{P.master.map((o) => <i key={o.id}>师父{who(o)}</i>)}{P.disc.map((o) => <i key={o.id}>徒弟{who(o)}</i>)}</span></div>}
      <div className="live-row"><b>交游</b><span>{P.friends.length ? P.friends.slice(0, 8).map((x) => <i key={x.o.id} className={x.o.alive ? '' : 'gone'}>{x.o.name}{x.r !== '好友' ? `（${x.r}）` : ''}</i>) : '少与人往来'}</span></div>
      <div className="live-row"><b>恩仇</b><span>
        {P.hate.length === 0 && P.hatedBy.length === 0 && '与人无怨'}
        {P.hate.map((h) => <span key={h.o.id} className={'live-hate' + (h.blood ? ' blood' : '')}>{h.blood ? '血仇' : '恨'} {h.o.name}<small>（{Math.round(h.v)}）</small>：{h.why}</span>)}
        {P.hatedBy.length > 0 && <span className="live-hated">{P.hatedBy.map((o) => o.name).join('、')} 记恨着{pr}</span>}
      </span></div>
      <div className="live-row"><b>储物袋</b><span>{P.canPeek
        ? <>灵石 {P.stones}{P.bag.length ? '　' : '　别无长物'}{P.bag.slice(0, 12).map(([id, n]) => { const it = itemDef(id); return <i key={id} style={{ color: TIER_COLORS[Math.min(TIER_COLORS.length - 1, it.tier)] }}>{it.name}{n > 1 ? `×${n}` : ''}</i>; })}</>
        : <span className="hint">以你的神识看不透{pr}的储物袋——{P.bagHint}。（修为高过{pr}、或交情深厚时可见）</span>}</span></div>
      {P.bio.length > 0 && <div className="live-bio"><b>生平</b>{[...P.bio].reverse().map((b, i) => <div key={i}><small>{dateText(b.d)}</small>{b.t}</div>)}</div>}
    </div>
  );
}

const KINDS: LiveK[] = ['birth', 'wed', 'death', 'kill', 'rob', 'feud', 'peace', 'sect', 'break', 'treasure', 'teach', 'friend', 'age', 'trade'];

/** 天下事：活世界里发生过的事（你认识的人优先） */
export function WorldChronicle({ game }: { game: Game }) {
  const [only, setOnly] = useState(false);
  const [k, setK] = useState<LiveK | ''>('');
  const L = game.living; if (!L) return null;
  const by = game.npcs.byId, st = L.stats();
  const list = [...L.S.log].reverse().filter((e) => (!only || e.ids.some((id) => L.known(by.get(id)))) && (!k || e.k === k)).slice(0, 150);
  const n = (x: string) => st.st[x] ?? 0;
  return (
    <div className="live-chron">
      <div className="hint">众生各有储物袋、功法、门派、家小与恩仇，在你看不见的地方也照样过日子。在世 {st.alive} 人（修士 {st.cult}、宗门弟子 {st.sect}）· 道侣夫妻 {st.couples} 对 · 稚子 {st.kids} 人 · 未了的深仇 {st.feuds} 笔。
        自入世以来：添丁 {n('birth')}、姻缘 {n('wed')}、突破 {n('break')}、劫案 {n('rob')}、仇杀 {n('kill')}、释怨 {n('peace')}。</div>
      <div className="live-filter">
        <button className={only ? 'on' : ''} onClick={() => setOnly(!only)}>{only ? '✓ ' : ''}只看相识之人</button>
        <button className={k === '' ? 'on' : ''} onClick={() => setK('')}>全部</button>
        {KINDS.map((x) => <button key={x} className={k === x ? 'on' : ''} style={k === x ? { background: LIVE_K_COLOR[x], color: '#fff' } : undefined} onClick={() => setK(x)}>{LIVE_K_NAME[x]}</button>)}
      </div>
      {list.length === 0 && <div className="hint">{only ? '你认识的人近来都还安好。' : '天下暂时太平。'}</div>}
      {list.map((e, i) => (
        <div key={i} className="live-ev">
          <span className="live-k" style={{ background: LIVE_K_COLOR[e.k] }}>{LIVE_K_NAME[e.k]}</span>
          <small>{dateText(e.d)}</small>{e.t}
          {e.ids.some((id) => L.known(by.get(id))) && <em>　相识</em>}
        </div>
      ))}
      <div className="hint" style={{ marginTop: 6 }}>当前境界：{realmName(game.hero.realm, game.hero.stage)}。与人交谈时选「察其根底」，可看此人的门派、功法、家小、恩仇与储物袋。</div>
    </div>
  );
}
