// 第十四步：追杀 HUD（顶部警示条 + 神识锁定条 + 屏幕边缘方位箭头）与遁光读数
import { useEffect, useRef, useState } from 'react';
import type { Game } from '../world/game';
import { ARTS } from '../data/arts';

export function PursuitHUD({ game }: { game: Game }) {
  const [on, setOn] = useState(false);
  const bar = useRef<HTMLDivElement>(null), fill = useRef<HTMLDivElement>(null), dist = useRef<HTMLSpanElement>(null), state = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLDivElement>(null), title = useRef<HTMLSpanElement>(null), tips = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, was = false, tipSig = '';
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const inf = game.pursuit?.info();
      // ---- 遁光读数
      const f = fly.current;
      if (f) {
        const p = game.player;
        if (p.flying) {
          const sp = Math.round(game.speed * game.combat.speedMul / 10);
          const k = game.boostKind, b = p.boosting;
          const nm = b ? (k === 'thunder' ? '雷遁' : k === 'blood' ? '血光遁' : '催动遁光') : (game.hero.equip?.flight ? '御器' : game.canFlyNative ? '御剑' : '御剑（体验）');
          f.style.display = 'flex';
          f.className = 'fly-hud' + (b ? ' boost ' + k : '');
          f.innerHTML = `<b>${nm}</b><span>遁速 ${sp} 丈/息</span>${b ? '' : '<i>Shift 催动遁光</i>'}`;
        } else f.style.display = 'none';
      }
      // ---- 追杀
      if (!!inf !== was) { was = !!inf; setOn(was); }
      if (!inf) return;
      if (title.current) title.current.textContent = `${inf.faction} · ${inf.name}（${inf.rank}）${inf.foes > 1 ? ` 等 ${inf.foes} 人` : ''}${inf.wave ? ` · 第 ${inf.wave + 1} 轮截杀` : ''}${inf.noFly ? ' · 禁空中' : ''}`;
      if (dist.current) dist.current.textContent = `相距 ${Math.round(inf.dist / 10)} 丈`;
      const locked = inf.dist < inf.lockR && !inf.lost;
      if (state.current) state.current.textContent = inf.lost ? '对方失去了你的踪迹……' : inf.safe > 0.02 ? `对方不敢擅闯 ${Math.round(inf.safe * 100)}%` : locked ? '神识锁定中' : `正在摆脱 ${Math.round(inf.out * 100)}%`;
      if (fill.current) {
        const v = inf.lost ? 0.5 : inf.safe > 0.02 ? inf.safe : locked ? 1 - inf.dist / inf.lockR : inf.out;
        fill.current.style.width = `${Math.max(2, Math.min(100, v * 100))}%`;
        fill.current.className = 'pu-fill ' + (locked && inf.safe <= 0.02 ? 'lock' : 'free');
      }
      if (bar.current) bar.current.classList.toggle('near', inf.dist < 900);
      // 方位箭头：对方在屏幕外时贴边指示
      const a = arrow.current, r = game.renderer;
      if (a && r) {
        const v = r.viewRect(), W = window.innerWidth, H = window.innerHeight;
        const sx = (inf.x - v.left) / (v.right - v.left) * W, sy = (inf.y - 60 - v.top) / (v.bottom - v.top) * H;
        const inside = sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30;
        if (inside || inf.lost) a.style.display = 'none';
        else {
          const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
          const k = Math.min((W / 2 - 46) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - 46) / Math.abs(Math.sin(ang) || 1e-6));
          a.style.display = 'block';
          a.style.transform = `translate(${cx + Math.cos(ang) * k}px, ${cy + Math.sin(ang) * k}px) rotate(${ang}rad)`;
          a.style.opacity = String(locked ? 0.95 : 0.5);
        }
      }
      // 对策提示（按身上实际有的手段）
      if (tips.current) {
        const h = game.hero, t: string[] = [];
        if (game.player.flying) t.push('Shift 催动遁光'); else if (game.canFlyNative || h.equip?.flight) t.push('F 御器飞遁');
        for (const id of ['xueyingdun', 'xuedun', 'tudun', 'luoyan']) if (h.arts.some((x) => x.id === id) && h.hotbar.includes(id)) t.push(`${h.hotbar.indexOf(id) + 1} ${ARTS[id].name}`);
        if (h.bag.some((b) => b.id === 'tal_escape')) t.push('遁地符');
        t.push(game.concealed ? '敛息中' : 'R 敛息');
        t.push('逃入宗门/坊市');
        const s = t.join('　·　');
        if (s !== tipSig) { tipSig = s; tips.current.textContent = s; }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  return (
    <>
      <div className="fly-hud" ref={fly} style={{ display: 'none' }} />
      {on && (
        <>
          <div className="pursuit" ref={bar}>
            <div className="pu-head"><em>追 杀</em><span ref={title} /><span className="pu-dist" ref={dist} /></div>
            <div className="pu-bar"><div className="pu-fill lock" ref={fill} /><span className="pu-state" ref={state} /></div>
            <div className="pu-tips" ref={tips} />
          </div>
          <div className="pu-arrow" ref={arrow}><i /></div>
        </>
      )}
    </>
  );
}
