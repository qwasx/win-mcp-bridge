import { useEffect, useRef, useState } from 'react';
import { audio } from '../world/audio';
import { SettingsPanel } from './Panels';

// 飘落的花瓣/竹叶（Canvas）
function Petals() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!;
    let W = 0, H = 0, raf = 0, last = performance.now();
    const resize = () => { const d = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const N = Math.min(46, Math.round(W / 34));
    const ps = Array.from({ length: N }, () => spawn(true));
    function spawn(init: boolean) {
      const leaf = Math.random() < 0.35;
      return {
        x: Math.random() * W * 1.2 - W * 0.1, y: init ? Math.random() * H : -20 - Math.random() * 60,
        vx: 14 + Math.random() * 26, vy: 22 + Math.random() * 30, r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 2.4,
        s: (leaf ? 9 : 5) + Math.random() * 6, leaf, ph: Math.random() * 10, a: 0.55 + Math.random() * 0.4,
      };
    }
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      g.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.ph += dt; p.x += (p.vx + Math.sin(p.ph * 1.3) * 18) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y > H + 30 || p.x > W + 40) ps[i] = spawn(false);
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, 0.55 + 0.45 * Math.sin(p.ph * 2.2));
        g.globalAlpha = p.a;
        if (p.leaf) {
          g.fillStyle = 'rgba(70,98,72,0.85)';
          g.beginPath(); g.moveTo(-p.s, 0); g.quadraticCurveTo(0, -p.s * 0.35, p.s, 0); g.quadraticCurveTo(0, p.s * 0.35, -p.s, 0); g.fill();
        } else {
          const rg = g.createRadialGradient(0, 0, 0, 0, 0, p.s);
          rg.addColorStop(0, 'rgba(255,236,236,1)'); rg.addColorStop(1, 'rgba(232,160,170,0.85)');
          g.fillStyle = rg;
          g.beginPath(); g.moveTo(0, -p.s); g.bezierCurveTo(p.s, -p.s * 0.6, p.s * 0.8, p.s * 0.6, 0, p.s); g.bezierCurveTo(-p.s * 0.8, p.s * 0.6, -p.s, -p.s * 0.6, 0, -p.s); g.fill();
        }
        g.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="petals" style={{ width: '100%', height: '100%' }} />;
}

export function TitleScreen({ onNew, onContinue, hasSave }: { onNew: () => void; onContinue: () => void; hasSave: boolean }) {
  const [panel, setPanel] = useState<'' | 'settings' | 'about' | 'confirm'>('');
  const click = () => { audio.unlock(); audio.sfx('click'); };
  return (
    <div className="title-screen" onPointerDown={() => audio.unlock()}>
      <div className="title-bg" style={{ backgroundImage: 'url(./art/title.webp)' }} />
      <div className="mist-layer mist-b" />
      <div className="title-mist" />
      <div className="mist-layer mist-a" />
      <Petals />
      <div className="title-content">
        <div className="title-logo">
          <h1>凡人修仙传</h1>
          <div className="title-sub">
            <span className="line" />
            <span className="seal">人界篇</span>
            <span className="line" />
          </div>
          <div className="title-tip">一介凡人 · 逆天修仙 · 万里人界 · 任尔纵横</div>
        </div>
        <div className="title-menu">
          <button className="menu-btn" onClick={() => { click(); hasSave ? setPanel('confirm') : onNew(); }}>踏入仙途</button>
          <button className="menu-btn" disabled={!hasSave} onClick={() => { click(); onContinue(); }}>继续仙途</button>
          <button className="menu-btn" onClick={() => { click(); setPanel('settings'); }}>设　　置</button>
          <button className="menu-btn" onClick={() => { click(); setPanel('about'); }}>关　　于</button>
        </div>
      </div>
      <div className="title-footer">同人作品 · 致敬忘语《凡人修仙传》 · 第一至三步：人界大地图 · 修炼与角色 · 战斗与法术</div>

      {panel === 'settings' && <SettingsPanel onClose={() => setPanel('')} />}
      {panel === 'confirm' && (
        <div className="modal-mask" onClick={() => setPanel('')}>
          <div className="scroll-panel settings" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head"><div className="panel-title">重入仙途</div></div>
            <p style={{ lineHeight: 1.9, fontSize: 15 }}>已有一份修行记录。重新开始将<b style={{ color: 'var(--vermilion)' }}>覆盖原有存档</b>，确定要从头来过吗？</p>
            <div className="loc-actions">
              <button className="ink-btn ghost" onClick={() => setPanel('')}>再想想</button>
              <button className="ink-btn" onClick={() => { setPanel(''); onNew(); }}>从头开始</button>
            </div>
          </div>
        </div>
      )}
      {panel === 'about' && (
        <div className="modal-mask" onClick={() => setPanel('')}>
          <div className="scroll-panel settings" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head"><div className="panel-title">关于</div><button className="close-btn" onClick={() => setPanel('')}>×</button></div>
            <div style={{ lineHeight: 1.9, fontSize: 14, maxHeight: '60vh', overflow: 'auto' }}>
              <p>你将扮演<b>韩立</b>，从天南越国的一个山村少年起步，在完整的人界——<b>天南、乱星海、大晋、天澜草原、极西之地</b>——自由闯荡。</p>
              <p>没有固定剧情。机缘、仇敌、红颜与道侣，全凭你自己的选择与随机际遇。</p>
              <p style={{ color: 'var(--ink-soft)' }}>当前为<b>第一～七步</b>版本（v0.7）：全代码绘制的水墨人界大地图；打坐修炼、炼丹闭关；69 门法术的即时战斗；约 450 名会修炼、斗法、劫掠的人界修士；城镇宗门、拍卖会、八位红颜的故事线；神识内的奇遇与可改变结局的原著大事件。</p>
              <p style={{ color: 'var(--ink-soft)', fontSize: 12 }}>本作为非商业同人作品，人物与世界观归原作者所有。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
