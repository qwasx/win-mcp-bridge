// 获得法器：画面中央一闪——法器自灵光中旋出，名号、品阶、来历
import { useEffect, useRef, useState } from 'react';
import { itemDef, TIER_COLORS } from '../data/items';
import { itemListeners } from '../world/cultivation';
import { itemIconURL } from './ItemIcon';
import { audio } from '../world/audio';

const GRADE = ['凡器', '法器', '上品法器', '顶阶法器', '法宝', '古宝', '通天灵宝'];

export function GainOverlay() {
  const [cur, setCur] = useState<{ id: string; key: number } | null>(null);
  const q = useRef<string[]>([]), busy = useRef(false), key = useRef(0);
  useEffect(() => {
    let timer = 0;
    const next = () => {
      const id = q.current.shift();
      if (!id) { busy.current = false; setCur(null); return; }
      busy.current = true; setCur({ id, key: ++key.current }); audio.sfx('gain');
      timer = window.setTimeout(next, 3200);
    };
    const on = (id: string) => {
      const d = itemDef(id);
      if (d.type !== 'artifact' || !itemIconURL(id)) return;
      if (q.current.includes(id) || q.current.length > 3) return;
      q.current.push(id);
      if (!busy.current) next();
    };
    itemListeners.push(on);
    return () => { const i = itemListeners.indexOf(on); if (i >= 0) itemListeners.splice(i, 1); clearTimeout(timer); };
  }, []);
  if (!cur) return null;
  const d = itemDef(cur.id), url = itemIconURL(cur.id, 192), col = TIER_COLORS[d.tier] ?? '#c0a050';
  return (
    <div className="gain" key={cur.key} style={{ ['--gc' as any]: col }}>
      <div className="gain-rays" />
      <div className="gain-ring" />
      {url && <img className="gain-ico" src={url} alt="" />}
      <div className="gain-txt">
        <small>获得{GRADE[d.tier] ?? '法器'}</small>
        <b>{d.name}</b>
        <p>{d.desc}</p>
      </div>
    </div>
  );
}
