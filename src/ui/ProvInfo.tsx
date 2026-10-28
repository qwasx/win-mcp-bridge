// 第五阶段：物品详情里的「来历」——唯一编号、历任主人、神识烙印与炼化进度
import type { Game } from '../world/game';

export function ProvInfo({ game, id }: { game: Game; id: string }) {
  const info = game.treasure?.provLines(id);
  if (!info) return null;
  return (
    <div className="prov-info" style={{ margin: '6px 0', padding: '6px 8px', border: '1px solid rgba(120,90,50,.35)', borderRadius: 4, background: 'rgba(150,110,60,.08)', fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600, color: '#8a5a20' }}>来历 · {info.uid}</div>
      <div style={{ opacity: 0.75 }}>历任主人：</div>
      {info.lines.map((l, i) => <div key={i} style={{ paddingLeft: 8 }}>{l}</div>)}
      {info.mark && <div style={{ marginTop: 4, color: '#a8352a' }}>{info.mark}</div>}
    </div>
  );
}
