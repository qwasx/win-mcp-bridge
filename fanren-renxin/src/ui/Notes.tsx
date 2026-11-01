// 第四十七步：人心 ·《韩立随笔》——阅历册 / 听来的消息 / 骗术图谱 / 江湖信义
import { useState } from 'react';
import type { Game } from '../world/game';
import { SCAM_DEFS, SCAM_LORE } from '../data/scams';
import { audio } from '../world/audio';

const KIND_MARK: Record<string, string> = { taken: '吃过亏', seen: '识破了', did: '学到了' };
const KIND_CLS: Record<string, string> = { taken: 'canon', seen: 'personal', done: '' };
const dateOf = (day: number) => `第${Math.floor(day / 360) + 1}年${Math.floor((day % 360) / 30) + 1}月`;

export function NotesPanel({ game }: { game: Game }) {
  const [, force] = useState(0);
  const exps = (game.ws.exp2 ?? []).slice().reverse();
  const rumors = (game.ws.rumors ?? []).slice().reverse();
  const cred = game.ws.cred ?? 60;
  const seen = game.ws.seenScams ?? {};
  const pct = Math.round((cred + 100) / 2);
  return (
    <div className="modal-mask" onClick={() => game.closeModal()}>
      <div className="scroll-panel cult-panel wide" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-title">韩立随笔</div>
          <div className="panel-sub"><span>阅历 {exps.length} 条　·　听来的消息 {rumors.length} 条　·　江湖信义 {cred}（{game.deceit.credName()}）</span></div>
          <button className="close-btn" onClick={() => { audio.sfx('click'); game.closeModal(); }}>×</button>
        </div>
        <div className="cult-body">
          <div className="chron chron3">
            <div className="chron-col">
              <div className="sec-title">阅历<small>吃过的亏，长的记性</small></div>
              {exps.length === 0 && <div className="hint">你还没在江湖上栽过跟头。<br />……这通常不会太久。</div>}
              {exps.map((e, i) => (
                <div key={i} className={'news ' + (KIND_CLS[e.kind] ?? '')}>
                  <span>{dateOf(e.day)}　{KIND_MARK[e.kind] ?? ''}</span>{e.text}
                </div>
              ))}
            </div>
            <div className="chron-col">
              <div className="sec-title">听来的消息<small>有真有假，未经印证不可尽信</small></div>
              {rumors.length === 0 && <div className="hint">去找人打听消息吧——但记住：话有虚实。</div>}
              {rumors.map((r) => (
                <div key={r.id} className={'news ' + (r.checked === 0 ? 'canon' : r.checked ? 'personal' : '')}>
                  <span>{dateOf(r.day)}　{r.src}</span>
                  {r.text}
                  <div className="hint" style={{ marginTop: 2 }}>
                    {r.checked === 1 ? '✓ 已多方印证，此话当真' : r.checked === 0.5 ? '~ 部分属实，细节对不上' : r.checked === 0 ? '✗ 已证伪——有人在说谎' : '未经印证'}
                    {r.motive && r.motive !== 'honest' && !r.checked ? '　·　说这话的人，似有用心' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="chron-col">
              <div className="sec-title">江湖骗术图谱<small>上过的当，只上一次</small></div>
              {SCAM_DEFS.map((s) => (
                <div key={s.id} className={'chance' + (seen[s.id] ? ' hot' : '')}>
                  <div className="cc-head"><b>{s.name}</b><em>{seen[s.id] ? `遇过 ${seen[s.id]} 次` : '尚未遇上'}</em></div>
                  <div className="cc-desc">{seen[s.id] ? s.trap : s.hook.replace('神识中：', '')}</div>
                </div>
              ))}
              <div className="sec-title" style={{ marginTop: 10 }}>市井老话</div>
              {SCAM_LORE.map((l, i) => <div key={i} className="news"><span>其{i + 1}</span>{l}</div>)}
            </div>
          </div>
          <div className="hint">
            江湖信义 <b>{cred}</b>　·　
            <span style={{ display: 'inline-block', width: 120, height: 8, background: 'rgba(0,0,0,0.18)', borderRadius: 4, verticalAlign: 'middle', marginRight: 6 }}>
              <span style={{ display: 'block', width: pct + '%', height: '100%', background: cred >= 55 ? '#4a7a52' : cred >= 25 ? '#a07a2a' : '#a03a2a', borderRadius: 4 }} />
            </span>
            骗术玩得起，但世界会用它自己的规则回敬你：信义低了，没人与你组队、坊市压你的价、求救无人来。
            <button className="cc-go" style={{ marginLeft: 10 }} onClick={() => { force((x) => x + 1); audio.sfx('click'); }}>刷新</button>
          </div>
        </div>
      </div>
    </div>
  );
}
