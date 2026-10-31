import { useState } from 'react';
import type { Game } from '../world/game';
import type { Person } from '../../../src/world/living';
import { GOAL_NAME, artLevel, sectName } from '../../../src/world/living';
import { realmName } from '../data/realms';
import { LOC_BY_ID } from '../data/world';
import { itemDef } from '../data/items';

export function LivingPanel({ game, personId }: { game: Game; personId: string }) {
  const [tab, setTab] = useState('生平');
  const state = game.npcs.living;
  const p: Person | undefined = state?.people.find(x => x.id === personId);
  if (!p) return null;
  const name = (id: string) => state!.people.find(x => x.id === id)?.name ?? id;
  return <div className="modal-mask" onClick={() => game.closeModal()}><section className="scroll-panel cult-panel wide living-panel" onClick={e => e.stopPropagation()}>
    <div className="panel-head"><div className="panel-title">{p.name} · 此人的一生</div><div className="panel-sub">{realmName(p.realm, p.stage)} · {sectName(state!, p.sect)} · {LOC_BY_ID.get(p.location)?.name ?? p.location}</div><button className="close-btn" onClick={() => game.closeModal()}>×</button></div>
    <div className="cult-body"><p className="living-thought">「{p.reason}。」</p><div className="tabs">{['生平', '储物袋', '功法', '亲缘与社交', '仇怨'].map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === '生平' && <div className="living-memory"><p>当下：{GOAL_NAME[p.goal]} · 气血 {p.health}% · 灵石 {p.wealth}</p>{p.memories.length ? p.memories.map((m, i) => <div key={i}><small>第 {m.day} 日</small><p>{m.text}</p></div>) : <p>此人近日闭门修行，尚无特别之事。时间推进后，他会自己安排生活。</p>}</div>}
      {tab === '储物袋' && <div className="living-items"><p>随身灵石：{p.wealth}</p>{p.bag.map(i => <div key={i.id}><span>{i.name}</span><small>{itemDef(i.id).desc || '此人自己收集的物品'}</small><b>×{i.qty}</b></div>)}{!p.bag.length && <p>储物袋空空如也。</p>}</div>}
      {tab === '功法' && <div className="living-items"><p>修为：{p.xp} · 功法会在闭关中精进</p>{p.arts.map(a => <div key={a.id}><span>{a.name}</span><small>{a.school}系 · {artLevel(a.proficiency)}</small><b>{a.proficiency}/400</b></div>)}{!p.arts.length && <p>凡人不修功法，另有自己的生活。</p>}</div>}
      {tab === '亲缘与社交' && <div className="living-items">{p.relations.map(r => <div key={r.id}><span>{name(r.id)}</span><small>{r.label} · {r.kind === 'family' ? '亲族' : r.kind === 'spouse' ? '道侣' : '社交'}</small><b>信任 {Math.round(r.trust)}</b></div>)}{!p.relations.length && <p>独来独往，尚未建立深厚关系。</p>}</div>}
      {tab === '仇怨' && <div className="living-memory">{p.grudges.length ? p.grudges.map(g => <div key={g.targetId}><b>{name(g.targetId)} · 仇怨 {Math.round(g.value)}</b><p>{g.reason}</p><small>始于第 {g.since} 日{g.eventId ? ` · 因果事件 ${g.eventId}` : ''}</small></div>) : <p>心中暂无仇怨。</p>}</div>}
    </div>
  </section></div>;
}
