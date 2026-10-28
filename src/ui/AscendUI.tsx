// 第 2 阶段：突破界面——引灵冲脉小玩法、结婴护法 HUD、满屏书法大字、「变强了什么」总结
import { useEffect, useState } from 'react';
import type { Game } from '../world/game';
import type { Snap } from '../world/ascendRun';

const CSS = `
.asc-layer{position:absolute;inset:0;pointer-events:none;z-index:40;font-family:var(--body-font)}
.asc-pulse{position:absolute;left:50%;bottom:15%;transform:translateX(-50%);display:flex;gap:26px;align-items:center;pointer-events:auto;cursor:pointer;z-index:2;
  background:linear-gradient(180deg,rgba(24,19,14,.93),rgba(16,12,9,.93));border:1px solid rgba(230,200,140,.55);box-shadow:0 6px 30px rgba(0,0,0,.6);padding:18px 34px;border-radius:14px}
.asc-pulse .ttl{font-family:var(--title-font);font-size:30px;color:#f3e2b4;letter-spacing:.3em;text-shadow:0 0 12px rgba(255,210,120,.6);margin-bottom:6px}
.asc-pulse .hint{color:#d8cbb0;font-size:13px;letter-spacing:.1em}
.asc-mer{display:grid;grid-template-columns:repeat(2,auto);gap:4px 14px;font-size:15px}
.asc-mer span{color:#8a8070;font-family:var(--title-font);font-size:19px;letter-spacing:.1em}
.asc-mer span.cur{color:#fff4cc;text-shadow:0 0 10px #ffd27a}
.asc-mer span.hit{color:#9fe8ff}.asc-mer span.perfect{color:#ffd27a}.asc-mer span.miss{color:#e0574a;text-decoration:line-through}
.asc-res{font-family:var(--title-font);font-size:34px;height:40px;text-align:center}
.asc-res.perfect{color:#ffd27a;text-shadow:0 0 14px #ffb040}.asc-res.hit{color:#9fe8ff}.asc-res.miss{color:#e0574a}
.asc-wv{position:absolute;left:50%;top:84px;transform:translateX(-50%);width:min(560px,86vw);text-align:center;color:#f3e7c9;text-shadow:0 1px 3px #000}
.asc-wv .ttl{font-family:var(--title-font);font-size:26px;letter-spacing:.25em}
.asc-bar{height:12px;border-radius:6px;background:rgba(20,14,10,.6);border:1px solid rgba(230,200,140,.6);overflow:hidden;margin:6px 0}
.asc-bar>div{height:100%;background:linear-gradient(90deg,#8a4fa0,#e8c0ff,#fff2d0);box-shadow:0 0 10px #d8a0ff}
.asc-wv .note{font-size:15px;margin-top:4px;color:#ffe2a8}
.asc-wv .warn{font-size:20px;color:#ff7a5a;font-family:var(--title-font);letter-spacing:.2em;animation:ascBlink .5s infinite alternate}
@keyframes ascBlink{from{opacity:.5}to{opacity:1}}
.asc-cal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column}
.asc-cal .big{font-family:var(--title-font);font-size:min(30vh,26vw);line-height:1;letter-spacing:.06em;
  -webkit-text-stroke:2px rgba(255,250,235,.25);filter:drop-shadow(0 0 22px rgba(255,248,230,.9)) drop-shadow(0 0 4px rgba(255,248,230,1))}
.asc-cal .vert{writing-mode:vertical-rl;white-space:nowrap;font-family:var(--title-font);font-size:min(7vh,8vw);letter-spacing:.25em;position:absolute;right:12%;top:12%;
  filter:drop-shadow(0 0 14px rgba(255,248,230,.95))}
.asc-cal .sub{font-family:var(--title-font);font-size:min(5vh,6vw);letter-spacing:.35em;margin-top:2vh;color:#2a1a10;filter:drop-shadow(0 0 10px rgba(255,248,230,1))}
.asc-cal .seal{display:inline-block;margin-left:1vw;background:#b0261c;color:#f8ead0;font-size:min(3.4vh,4vw);padding:.2em .25em;border-radius:4px;vertical-align:middle;letter-spacing:0;transform:rotate(-4deg)}
.asc-sum{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,8,6,.55);pointer-events:auto;z-index:41}
.asc-card{width:min(640px,92vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,#f4ead2,#e6d7b4);border:2px solid #8a6a3a;border-radius:10px;padding:22px 28px;color:#2a2018;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.asc-card.fail{background:linear-gradient(180deg,#eadbd0,#d8c0b0);border-color:#7a2a20}
.asc-card h2{font-family:var(--title-font);font-size:40px;margin:0;letter-spacing:.3em;text-align:center;color:#3a2410}
.asc-card.fail h2{color:#7a1a10}
.asc-card .rl{text-align:center;font-size:16px;margin:4px 0 12px;color:#5a4a30}
.asc-grid{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:5px 10px;font-size:15px;align-items:center;margin:8px 0 12px}
.asc-grid .k{color:#6a5a40}.asc-grid .v0{color:#7a6a50;text-align:right}.asc-grid .ar{color:#a08060}.asc-grid .v1{font-weight:700}
.asc-grid .up{color:#2f7a3a}.asc-grid .dn{color:#a8352a}
.asc-card ul{margin:6px 0 10px 1.1em;padding:0;font-size:14.5px;line-height:1.7}
.asc-card .grade{font-family:var(--title-font);font-size:26px;text-align:center;color:#a8721a;margin:4px 0}
.asc-card .btn{display:block;margin:10px auto 0;padding:8px 40px;font-family:var(--title-font);font-size:22px;letter-spacing:.3em;background:#3a5a4a;color:#f4ead2;border:none;border-radius:6px;cursor:pointer}
`;

function Dial({ ang, zone, zw, flash, last }: { ang: number; zone: number; zw: number; flash: number; last: string }) {
  const R = 92, C = 110;
  const pt = (a: number, r = R) => [C + Math.cos(a) * r, C + Math.sin(a) * r];
  const arc = (a0: number, a1: number, r: number) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`; };
  const [nx, ny] = pt(ang);
  const glow = flash > 0 ? (last === 'miss' ? '#e0574a' : last === 'perfect' ? '#ffd27a' : '#9fe8ff') : 'rgba(255,240,200,.15)';
  return (
    <svg width={220} height={220} viewBox="0 0 220 220">
      <circle cx={C} cy={C} r={R + 14} fill="none" stroke={glow} strokeWidth={6} opacity={0.4 + flash} />
      <circle cx={C} cy={C} r={R} fill="rgba(10,8,6,.5)" stroke="rgba(230,210,170,.45)" strokeWidth={10} />
      <path d={arc(zone - zw / 2, zone + zw / 2, R)} stroke="#e8b04a" strokeWidth={12} fill="none" strokeLinecap="round" />
      <path d={arc(zone - zw * 0.09, zone + zw * 0.09, R)} stroke="#fff6cf" strokeWidth={14} fill="none" strokeLinecap="round" />
      <circle cx={C} cy={C} r={30} fill="rgba(255,236,190,.15)" stroke="rgba(255,230,170,.5)" />
      <text x={C} y={C + 9} textAnchor="middle" fontSize={26} fill="#f3e2b4" style={{ fontFamily: 'var(--title-font)' }}>灵</text>
      <line x1={C} y1={C} x2={nx} y2={ny} stroke="rgba(190,240,255,.5)" strokeWidth={2} />
      <circle cx={nx} cy={ny} r={11} fill="#dff8ff" stroke="#6fd0ff" strokeWidth={3} />
    </svg>
  );
}

const ROWS: [keyof Snap, string, (v: number) => string][] = [
  ['hp', '气血', (v) => String(v)], ['mp', '法力', (v) => String(v)], ['atk', '攻击', (v) => String(v)], ['def', '防御', (v) => String(v)],
  ['sense', '神识圈', (v) => `${v} 步`], ['speed', '遁速', (v) => String(v)], ['life', '寿元', (v) => `${v} 载`], ['slots', '神通位', (v) => `${v} 格`],
];

export function AscendUI({ game }: { game: Game }) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (t: number) => {
      const A = game.ascend;
      const live = !!A && (!!A.run || !!A.summary || A.cal.length > 0);
      if (live && t - last > 33) { last = t; force((x) => x + 1); }
      else if (!live && last > 0) { last = 0; force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);
  const A = game.ascend; if (!A) return null;
  const r = A.run, S = A.summary;
  const m = r?.phase === 'pulse' ? r.mg : undefined;
  const w = r?.phase === 'waves' ? r.wv : undefined;
  return (
    <div className="asc-layer">
      <style>{CSS}</style>
      {m && !game.modal && (
        <div className="asc-pulse" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); A.press(); }}>
          <div>
            <div className="ttl">{r!.realm >= 4 ? '元神合一' : '引灵冲脉'}</div>
            <div className="asc-mer">{m.names.map((n, i) => <span key={n} className={i < m.res.length ? m.res[i] : i === m.i ? 'cur' : ''}>{n}</span>)}</div>
            <div className="hint" style={{ marginTop: 8 }}>光点入金区：按 空格 / 点击　　正中最亮为上佳</div>
          </div>
          <div>
            <Dial ang={m.ang} zone={m.zone} zw={m.zw} flash={m.flash} last={m.last} />
            <div className={'asc-res ' + (m.flash > 0 ? m.last : '')}>{m.flash > 0 ? (m.last === 'perfect' ? '上 佳' : m.last === 'hit' ? '贯 通' : '反 噬') : m.names[m.i] ?? ''}</div>
          </div>
        </div>
      )}
      {w && (
        <div className="asc-wv">
          <div className="ttl">碎丹成婴 · 元婴凝形</div>
          <div className="asc-bar"><div style={{ width: `${Math.min(100, w.prog * 100)}%` }} /></div>
          <div>{Math.floor(Math.min(1, w.prog) * 100)}%　·　来敌 第 {w.wave} / {w.waves} 波　·　{w.guard ? `护法：${w.guard}` : '无人护法'}{w.disturbed ? '　·　受扰，凝形变慢' : ''}</div>
          {w.outT > 0 && <div className="warn">离开阵眼！{Math.max(0, 4 - w.outT).toFixed(1)} 秒后中断</div>}
          {w.noteT > 0 && <div className="note">{w.note}</div>}
        </div>
      )}
      {A.cal.map((c, i) => {
        if (c.t < 0 || c.t > c.dur) return null;
        const fi = Math.min(1, c.t / 0.45), fo = Math.min(1, (c.dur - c.t) / 0.6), a = Math.min(fi, fo);
        const sc = 1.25 - 0.25 * fi;
        return (
          <div key={i} className="asc-cal" style={{ opacity: a }}>
            {c.vertical ? <div className="vert" style={{ color: c.color, transform: `scale(${sc})` }}>{c.text}</div> : (
              <>
                <div className="big" style={{ color: c.color, transform: `scale(${sc})`, filter: `blur(${(1 - fi) * 6}px) drop-shadow(0 0 22px rgba(255,248,230,.9))` }}>{c.text}</div>
                {c.sub && <div className="sub" style={{ opacity: Math.min(1, Math.max(0, (c.t - 0.6) / 0.5)) }}>{c.sub}<span className="seal">韩立</span></div>}
              </>
            )}
          </div>
        );
      })}
      {S && (
        <div className="asc-sum" onPointerDown={(e) => e.stopPropagation()}>
          <div className={'asc-card' + (S.ok ? '' : ' fail')}>
            <h2>{S.title}</h2>
            <div className="rl">{S.before.realm} → <b>{S.realm}</b>　·　成功率 {Math.round(S.chance * 100)}%（天命在准备时已定）</div>
            {S.grade ? <div className="grade">{['', '一', '二', '三', '四', '五', '六', '七', '八', '九'][S.grade]}品金丹</div> : null}
            <div className="asc-grid">
              {ROWS.map(([k, n, f]) => { const a = S.before[k] as number, b = S.after[k] as number; return [
                <span key={k + 'k'} className="k">{n}</span>,
                <span key={k + 'a'} className="v0">{f(a)}</span>,
                <span key={k + 'r'} className="ar">→</span>,
                <span key={k + 'b'} className={'v1 ' + (b > a ? 'up' : b < a ? 'dn' : '')}>{f(b)}{b !== a && a > 0 ? `（${b > a ? '+' : ''}${Math.round((b / a - 1) * 100)}%）` : ''}</span>,
              ]; })}
            </div>
            {S.extra.length > 0 && <><b>{S.ok ? '变强了什么' : ''}</b><ul>{S.extra.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {S.lines.length > 0 && <ul>{S.lines.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <button className="btn" onClick={() => A.closeSummary()}>{S.ok ? '长 啸 一 声' : '咽 下 这 口 血'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
