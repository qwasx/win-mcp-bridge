import { useEffect, useMemo, useState } from 'react';
import type { Game } from '../world/game';

// 活世界面板（Y）：看看这个世界在你不在的时候做了些什么
type Tab = 'contacts' | 'folk' | 'chron' | 'rumor';

const TONE_COL: Record<string, string> = {
  friendly: '#8fd694', trade: '#d9c27a', sect: '#9ec5e8', threat: '#e0a06a',
  grief: '#c98a8a', vengeance: '#d97070', romance: '#e0a0c0', curiosity: '#a9a9c0',
};

const overlay: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(2px)', fontFamily: '"Noto Serif SC", serif',
};
const card: React.CSSProperties = {
  width: 'min(1060px, 94vw)', height: 'min(720px, 92vh)', display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(160deg, rgba(24,26,32,0.97), rgba(14,16,20,0.97))',
  border: '1px solid rgba(190,160,110,0.35)', borderRadius: 10, color: '#e8e2d4', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
};

export function AlivePanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const alive = game.npcs.alive;
  const [tab, setTab] = useState<Tab>('contacts');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const data = useMemo(() => alive.panel(), [alive, tick]);
  const detail = useMemo(() => (sel ? alive.soul(sel) : null), [alive, sel, tick]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const folk = data.npcs.filter((n) => !q || n.name.includes(q) || n.sect.includes(q) || n.at.includes(q));
  const stats = data.summary.stats;

  const act = (id: string, ok: boolean) => {
    const msg = ok ? alive.accept(id) : alive.refuse(id);
    game.toast(msg, ok ? 'good' : 'warn');
    setTick((t) => t + 1);
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '14px 18px', borderBottom: '1px solid rgba(190,160,110,0.22)' }}>
          <b style={{ fontSize: 20, letterSpacing: 2 }}>活世界</b>
          <span style={{ opacity: 0.75, fontSize: 13 }}>第 {data.day} 日 · 在世 {data.summary.population} 人 · {data.summary.sects.length} 家门派 · {data.summary.families.length} 户人家 · 众生储物共值 {Math.round(data.summary.bagWorth)} 灵石</span>
          <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 12 }}>
            生 {stats.births} · 婚 {stats.wed} · 亡 {stats.deaths} · 命案 {stats.murders} · 寻仇 {stats.revenge} · 应约 {stats.contact} / 推约 {stats.refused}
          </span>
          <button className="round-btn small" onClick={onClose} style={{ marginLeft: 8 }}>闭<small>关面板</small></button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 18px', borderBottom: '1px solid rgba(190,160,110,0.16)' }}>
          {([['contacts', `有缘之邀 ${data.contacts.length}`], ['folk', `众生 ${data.summary.population}`], ['chron', '大事记'], ['rumor', '风闻']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
              background: tab === k ? 'rgba(190,160,110,0.22)' : 'transparent',
              border: `1px solid ${tab === k ? 'rgba(190,160,110,0.5)' : 'rgba(190,160,110,0.18)'}`, color: '#e8e2d4',
            }}>{label}</button>
          ))}
          {tab === 'folk' && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜名字 / 门派 / 城镇"
              style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(190,160,110,0.25)', borderRadius: 6, color: '#e8e2d4', padding: '5px 10px', fontSize: 13 }} />
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px', fontSize: 13, lineHeight: 1.75 }}>
          {tab === 'contacts' && (
            data.contacts.length === 0
              ? <div style={{ opacity: 0.6 }}>眼下没人来找你。<br />这个世界的规矩是：没有缘由，不来打扰。等谁真的有事——或恩、或怨、或买卖——传音符自己会响。</div>
              : data.contacts.map((c) => (
                <div key={c.id} style={{ border: '1px solid rgba(190,160,110,0.22)', borderRadius: 8, padding: '12px 14px', marginBottom: 12, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <b style={{ fontSize: 15 }}>{c.fromName}</b>
                    <span style={{ color: TONE_COL[c.tone] ?? '#aaa', fontSize: 12 }}>{toneWord(c.tone)} · 第 {c.day} 日 · {c.placeName}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>{c.until - data.day} 日后来不及</span>
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.line}</div>
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    <b>缘由：</b>{c.reason}<br />
                    <b style={{ color: '#9fd694' }}>事成之利：</b>{c.gain}　<b style={{ color: '#d99090' }}>若推了：</b>{c.cost}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button className="round-btn small" onClick={() => act(c.id, true)}>应<small>接下此事</small></button>
                    <button className="round-btn small" onClick={() => act(c.id, false)}>推<small>回绝</small></button>
                  </div>
                </div>
              ))
          )}

          {tab === 'folk' && (
            <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 340px' : '1fr', gap: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.6 }}>
                    <th style={th}>人</th><th style={th}>境界</th><th style={th}>门派</th><th style={th}>居所</th>
                    <th style={th}>此刻在忙</th><th style={th}>袋</th><th style={th}>家</th><th style={th}>与你</th>
                  </tr>
                </thead>
                <tbody>
                  {folk.map((n) => (
                    <tr key={n.id} onClick={() => setSel(n.id)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.06)', background: sel === n.id ? 'rgba(190,160,110,0.14)' : 'transparent' }}>
                      <td style={td}><b>{n.name}</b></td>
                      <td style={td}>{n.realm}</td>
                      <td style={td}>{n.sect}</td>
                      <td style={td}>{n.at}</td>
                      <td style={td}><span style={{ opacity: 0.85 }}>{n.agenda}</span></td>
                      <td style={td}>{n.bag}件/{n.arts}功</td>
                      <td style={td}>{n.kin}</td>
                      <td style={td}>
                        {n.grudge > 0 ? <span style={{ color: '#d97070' }}>怨 {n.grudge}</span> : n.favor > 0 ? <span style={{ color: '#9fd694' }}>好 {n.favor}</span> : <span style={{ opacity: 0.5 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail && (
                <div style={{ border: '1px solid rgba(190,160,110,0.25)', borderRadius: 8, padding: 14, background: 'rgba(255,255,255,0.03)', alignSelf: 'start' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <b style={{ fontSize: 17 }}>{detail.name}</b>
                    <span style={{ opacity: 0.7 }}>{detail.realmName} · {detail.persName}</span>
                    <button className="round-btn small" style={{ marginLeft: 'auto' }} onClick={() => setSel(null)}>收</button>
                  </div>
                  <div style={{ marginTop: 8, opacity: 0.85 }}>【此刻】{detail.agendaText}</div>
                  <div style={{ marginTop: 6 }}>【门派】{detail.sectName ?? '散修'}{detail.sectRank ? ' · ' + detail.sectRank : ''}</div>
                  <div style={{ marginTop: 6 }}>【功法】{detail.arts.map((a) => `${a.name}（${a.tier}阶·${Math.round(a.mastery)}层，${a.from}）`).join('；') || '未入道'}</div>
                  <div style={{ marginTop: 6 }}>【储物袋】{detail.bag.length} 件，约值 {Math.round(detail.bagWorth)} 灵石；另有 {Math.round(detail.stones)} 灵石</div>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, opacity: 0.85 }}>
                    {detail.bag.slice(0, 8).map((it) => <li key={it.id}>{it.name}×{it.count} —— {it.src}</li>)}
                  </ul>
                  <div style={{ marginTop: 6 }}>【家人】{detail.kinNames.length ? detail.kinNames.map((k) => `${k.name}（${k.kind}${k.alive ? '' : '·故'}）`).join('、') : '举目无亲'}</div>
                  <div style={{ marginTop: 6 }}>【往来】{detail.socialNames.length ? detail.socialNames.slice(0, 6).map((t) => `${t.name}（${t.val > 0 ? '+' : ''}${t.val}）`).join('、') : '少与人往来'}</div>
                  <div style={{ marginTop: 6, color: '#d9a0a0' }}>【恩怨】{detail.grudgeNames.length ? detail.grudgeNames.map((g) => `${g.name}：${g.reason}${g.blood ? '（血仇）' : ''}·恨意${g.heat}`).join('；') : '与人无怨'}</div>
                  {detail.traits.length > 0 && <div style={{ marginTop: 6, opacity: 0.8 }}>【性子】{detail.traits.join('、')}</div>}
                  {detail.deathNote && <div style={{ marginTop: 6, color: '#d97070' }}>【结局】{detail.deathNote}</div>}
                </div>
              )}
            </div>
          )}

          {tab === 'chron' && (
            <div>
              {data.chron.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
                  <span style={{ opacity: 0.5, minWidth: 58 }}>第{e.day}日</span>
                  <span>{kindWord(e.kind)}</span>
                  <span style={{ flex: 1 }}>{e.text}</span>
                  {e.place && <span style={{ opacity: 0.45 }}>{e.place}</span>}
                </div>
              ))}
            </div>
          )}

          {tab === 'rumor' && (
            <div>
              {data.rumors.length === 0 && <div style={{ opacity: 0.6 }}>风声未起。</div>}
              {data.rumors.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 0' }}>
                  <span style={{ opacity: 0.5, marginRight: 10 }}>第{r.day}日</span>
                  {r.text}
                  <span style={{ opacity: 0.45, marginLeft: 8 }}>（可信 {Math.round(r.truth * 100)}%）</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '4px 6px', fontWeight: 400, borderBottom: '1px solid rgba(190,160,110,0.25)' };
const td: React.CSSProperties = { padding: '3px 6px', verticalAlign: 'top' };

function toneWord(t: string) {
  const m: Record<string, string> = { friendly: '相叙', trade: '谈买卖', sect: '门中召见', threat: '问罪', grief: '讨说法', vengeance: '寻仇', romance: '传情', curiosity: '打听' };
  return m[t] ?? '相邀';
}
function kindWord(k: string) {
  const m: Record<string, string> = {
    death: '【亡】', kill: '【杀】', birth: '【生】', wed: '【婚】', grudge: '【怨】', revenge: '【报】',
    sect: '【宗】', trade: '【市】', art: '【道】', treasure: '【宝】', hero: '【你】', bond: '【义】', fell: '【承】',
  };
  return m[k] ?? '【记】';
}
