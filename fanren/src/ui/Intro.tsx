import { useEffect, useState } from 'react';

const LINES: { t: string; em?: boolean }[] = [
  { t: '天南 · 越国 · 镜州青牛镇' },
  { t: '一个寻常山村少年，身负四属性伪灵根，资质平平。' },
  { t: '机缘巧合，他拾得一只神秘的小绿瓶……', em: true },
  { t: '此去没有既定的命数，也没有写好的结局。' },
  { t: '仙途漫漫，皆由你自己书写。', em: true },
];

export function Intro({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n < LINES.length) { const t = setTimeout(() => setN(n + 1), 2300); return () => clearTimeout(t); }
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [n]);
  const advance = () => { if (n < LINES.length) setN(n + 1); else onDone(); };
  return (
    <div className="intro" onClick={advance}>
      <div className="intro-bottle" />
      <div className="intro-lines">
        {LINES.slice(0, n).map((l, i) => <div key={i} className={'intro-line' + (l.em ? ' em' : '')}>{l.t}</div>)}
      </div>
      <button className="intro-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>跳过 ›</button>
    </div>
  );
}
