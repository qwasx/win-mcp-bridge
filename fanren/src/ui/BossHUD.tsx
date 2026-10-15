// 第十五步：妖王血条（八级以上妖兽交战时，屏幕上方的大血条）
import { useEffect, useRef, useState } from 'react';
import type { Game } from '../world/game';
import type { Enemy } from '../world/combat';

export function BossHUD({ game }: { game: Game }) {
  const [on, setOn] = useState(false);
  const name = useRef<HTMLSpanElement>(null), rank = useRef<HTMLSpanElement>(null), fill = useRef<HTMLDivElement>(null), lag = useRef<HTMLDivElement>(null), pct = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0, was = false, lagV = 1, cur: Enemy | null = null;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = game.player;
      if (!cur || cur.dead || Math.hypot(cur.x - p.x, cur.y - p.y) > 2600 || !cur.aggro) {
        cur = null;
        for (const e of game.combat.enemies) if (!e.dead && e.blv >= 8 && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 2200) { cur = e; lagV = e.hp / e.maxHp; break; }
      }
      if (!!cur !== was) { was = !!cur; setOn(was); }
      if (!cur) return;
      const v = Math.max(0, cur.hp / cur.maxHp);
      lagV = Math.max(v, lagV - 0.004);
      if (name.current) name.current.textContent = cur.name;
      if (rank.current) rank.current.textContent = `${cur.rankText}${cur.def.title?.includes('·') ? ' · ' + cur.def.title.split('·')[1] : ''}`;
      if (fill.current) fill.current.style.width = `${v * 100}%`;
      if (lag.current) lag.current.style.width = `${lagV * 100}%`;
      if (pct.current) pct.current.textContent = `${Math.ceil(v * 100)}%`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  if (!on) return null;
  return (
    <div className="boss-hud">
      <div className="bh-head"><span className="bh-name" ref={name} /><span className="bh-rank" ref={rank} /><span className="bh-pct" ref={pct} /></div>
      <div className="bh-bar"><div className="bh-lag" ref={lag} /><div className="bh-fill" ref={fill} /><i className="bh-orn l" /><i className="bh-orn r" /></div>
    </div>
  );
}
