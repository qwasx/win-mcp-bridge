// 第三阶段·活世界：传闻栏 + 风云榜（快捷键 I；大事记里也有入口）
// 传闻栏只列世上真实发生过的事（sim 事件）：亲眼所见的当场记下，不在场的要等传闻传到你耳朵里。
import { useState } from 'react';
import type { Game } from '../world/game';
import { realmName } from '../data/realms';
import { itemDef } from '../data/items';
import { MAP_NAME, ACTIVE_MAP, type MapId } from '../data/world';
import { audio } from '../world/audio';
import type { SimEvent, EvK } from '../world/sim/world';

const click = () => audio.sfx('click');
const ym = (day: number) => `第${Math.floor(day / 360) + 1}年${Math.floor((day % 360) / 30) + 1}月`;
const TAG: Partial<Record<EvK, [string, string]>> = {
  rob: ['劫', '#a8352a'], kill: ['杀', '#8a1a1a'], feud: ['仇', '#7a2a5a'], treasure: ['宝', '#b8802a'], late: ['迟', '#7a7060'], secretdie: ['殒', '#5a5a62'],
  break: ['破', '#2f6b5e'], fail: ['败', '#7a7060'], buy: ['购', '#2b5a8a'], die: ['化', '#5a5a62'], omen: ['象', '#7a3a9a'], hero: ['你', '#2f6b5e'], trade: ['商', '#5a6a4a'], task: ['差', '#5a6a4a'],
};
const FILTERS: [string, (e: SimEvent) => boolean][] = [
  ['全部', () => true],
  ['杀人夺宝', (e) => e.k === 'rob' || e.k === 'kill' || e.k === 'feud'],
  ['秘境机缘', (e) => e.k === 'treasure' || e.k === 'late' || e.k === 'secretdie'],
  ['突破异象', (e) => e.k === 'break' || e.k === 'omen' || e.k === 'fail'],
  ['亲眼所见', (e) => !!e.seen],
];

export function WorldPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState(0);
  const [f, setF] = useState(0);
  const [scope, setScope] = useState<MapId | ''>('');
  const sim = game.npcs.sim;
  const close = () => game.closeModal();
  const ev = sim.heard(300).filter(FILTERS[f][1]);
  const rk = sim.ranking(24, scope || undefined);
  const fame = Math.round(sim.S.fame ?? 0);
  return (
    <div className="modal-mask" onClick={close}>
      <div className="scroll-panel cult-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><div className="panel-title">风云录</div><div className="panel-sub">{ym(game.day)}　·　名声 {fame}　·　风云榜第 {rk.heroRank} / {rk.total}</div><button className="close-btn" onClick={() => { click(); close(); }}>×</button></div>
        <div className="cult-body">
          <div className="tabs">{['传闻栏', '风云榜'].map((t, i) => <button key={i} className={tab === i ? 'on' : ''} onClick={() => { click(); setTab(i); }}>{t}</button>)}</div>
          {tab === 0 && <>
            <div className="tabs" style={{ flexWrap: 'wrap' }}>{FILTERS.map(([n], i) => <button key={i} className={f === i ? 'on' : ''} style={{ fontSize: 12, padding: '2px 10px' }} onClick={() => { click(); setF(i); }}>{n}</button>)}</div>
            <div style={{ maxHeight: '58vh', overflow: 'auto', paddingRight: 6 }}>
              {ev.length === 0 && <div className="hint">尚无传闻。多在城镇坊市走动、与人攀谈，自会听到些风声。</div>}
              {ev.map((e) => {
                const t = TAG[e.k] ?? ['闻', '#5a544a'];
                return (
                  <div key={e.id} className="news" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <b style={{ flex: '0 0 auto', width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: 4, background: t[1], color: '#f7eedb', fontFamily: "'Ma Shan Zheng', serif" }}>{t[0]}</b>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#7a6a58', fontSize: 12, marginRight: 6 }}>{ym(e.day)}{e.map !== ACTIVE_MAP ? ` · ${MAP_NAME[e.map]}` : ''}{e.seen ? ' · 亲眼所见' : e.heard > e.day + 1 ? ' · 传闻' : ''}</span>
                      {e.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hint">这里只记世上真实发生过的事。离你越远的事，传到你耳朵里越晚；别的地图上的事，要等往来的商旅捎来。</div>
          </>}
          {tab === 1 && <>
            <div className="tabs">{([['', '三界'], ['tiannan', '天南'], ['luanxing', '乱星海'], ['dajin', '大晋']] as [MapId | '', string][]).map(([m, n]) => <button key={n} className={scope === m ? 'on' : ''} style={{ fontSize: 12, padding: '2px 10px' }} onClick={() => { click(); setScope(m); }}>{n}</button>)}</div>
            <div style={{ maxHeight: '58vh', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: '#6a5a48', borderBottom: '1px solid rgba(60,50,40,0.3)' }}><th style={{ width: 34 }}>位</th><th>名号</th><th>境界</th><th>出身</th><th>本命法宝</th><th>近闻</th></tr></thead>
                <tbody>
                  {rk.top.map((r, i) => {
                    const deed = r.hero ? undefined : sim.deedOf(r.id);
                    const known = deed && deed.heard <= game.day;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px dashed rgba(60,50,40,0.15)', background: r.hero ? 'rgba(47,107,94,0.12)' : undefined }}>
                        <td style={{ fontFamily: "'Ma Shan Zheng', serif", fontSize: 16, color: i < 3 ? '#a8352a' : '#5a544a' }}>{i + 1}</td>
                        <td><b>{r.name}</b>{r.hero ? '（你）' : ''}</td>
                        <td>{realmName(r.realm, r.stage)}</td>
                        <td style={{ color: '#6a5a48' }}>{r.title}{r.map !== ACTIVE_MAP ? ` · ${MAP_NAME[r.map]}` : ''}</td>
                        <td>{r.main ? itemDef(r.main)?.name : '—'}</td>
                        <td style={{ color: '#6a5a48', fontSize: 12, maxWidth: 260 }}>{known ? deed!.text.slice(0, 26) + (deed!.text.length > 26 ? '……' : '') : ''}</td>
                      </tr>
                    );
                  })}
                  {rk.heroRank > rk.top.length && <tr style={{ background: 'rgba(47,107,94,0.12)' }}><td>{rk.heroRank}</td><td><b>{game.player.name}</b>（你）</td><td>{realmName(game.hero.realm, game.hero.stage)}</td><td>—</td><td>—</td><td /></tr>}
                </tbody>
              </table>
            </div>
            <div className="hint">按战力排（境界、功法、本命法宝、随身符箓同一个算法，你和他们一视同仁）。谁抢到了宝、谁突破了，名次就会变。</div>
          </>}
        </div>
      </div>
    </div>
  );
}
