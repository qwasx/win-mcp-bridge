'use client';
import { useState } from 'react';
import { ALL_LOCATIONS } from '../../game/src/data/world';
import { type LivingState, type Person, type WorldEvent, GOAL_NAME } from '@/world/living';
import { Compass, Maximize2, Plus, Minus, LocateFixed, Landmark, Leaf, Flame, MapPin, ArrowUpRight, CircleDot, goalIcon } from './Icons';

export function WorldMap({ state, onPerson, onEvent, onExpand, expanded = false }: { state: LivingState; onPerson: (p: Person) => void; onEvent: (e: WorldEvent) => void; onExpand?: () => void; expanded?: boolean }) {
  const [region, setRegion] = useState('tiannan'); const [zoom, setZoom] = useState(1); const [showPeople, setShowPeople] = useState(true); const [showEvents, setShowEvents] = useState(true);
  const locations = ALL_LOCATIONS.filter(l => (l.map ?? 'tiannan') === region && !l.minor);
  const named = ['huangfeng', 'jiayuan', 'qingniu', 'yanyue', 'tainan', 'yuejing', 'luoyun', 'tianxing', 'kuixing', 'taiyi', 'jinjing'];
  const places = locations.filter(l => named.includes(l.id) || l.major).slice(0, 7);
  const people = state.people.filter(p => p.alive && p.map === region);
  const featured = ['o_luqingya', 'o_liusanniang', 'lihuayuan', 'o_mengtieyi'].map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
  const events = state.events.filter(e => e.status === 'pending' && e.map === region && ['rob', 'request', 'vendetta'].includes(e.kind)).slice(0, 2);
  const point = (id: string) => { const l = ALL_LOCATIONS.find(l => l.id === id); return l ? { x: Math.max(14, Math.min(88, l.x / 10)), y: Math.max(27, Math.min(80, l.y / 7)) } : { x: 50, y: 50 }; };
  return <section className="panel map-panel">
    <div className="panel-heading map-heading"><div><div className="panel-title"><Compass size={16}/>天地一隅<span className="badge" style={{ marginLeft: 4, fontWeight: 400 }}><i className={`live-dot ${state.running ? '' : 'paused'}`}/>{state.running ? '实时演算' : '已暂停'}</span></div><div className="panel-subtitle">山川依旧，人事常新。</div></div><div className="flex items-center gap-2"><select aria-label="选择地图区域" className="map-region" value={region} onChange={e => { setRegion(e.target.value); setZoom(1); }}><option value="tiannan">天南 · 越国</option><option value="luanxing">乱星海 · 内星海</option><option value="dajin">大晋 · 中原</option></select>{onExpand && <button className="icon-button" title="展开世界地图" onClick={onExpand}><Maximize2 size={14}/></button>}</div></div>
    <div className={`world-map ${expanded ? 'expanded' : ''}`}>
      <img className="map-art" src="/images/tiannan-map.jpg" alt="天南群山、河流与宗门的水墨地图" style={{ transform: `scale(${zoom})`, filter: region === 'luanxing' ? 'saturate(.55) hue-rotate(18deg)' : region === 'dajin' ? 'saturate(.6) sepia(.12)' : undefined }}/>
      <div className="map-grid"/>
      <div className="map-title">{region === 'tiannan' ? '天南' : region === 'luanxing' ? '乱星海' : '大晋'}<small>{region === 'tiannan' ? '越国山水图' : region === 'luanxing' ? '星海群岛图' : '中原山河图'}</small></div>
      <svg className="map-route" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M 29 64 Q 40 42 57 48 T 76 35" fill="none" stroke="#6e8c58" strokeWidth=".28" opacity=".65"/><path d="M 57 48 Q 62 67 78 72" fill="none" stroke="#a9925c" strokeWidth=".25" opacity=".55"/></svg>
      {places.map(l => { const p = point(l.id); return <button key={l.id} className="map-marker" style={{ left: `${p.x}%`, top: `${p.y}%` }} title={`${l.name} · ${people.filter(n => n.location === l.id).length} 位修士`} onClick={() => { const person = people.find(n => n.location === l.id); if (person) onPerson(person); else onEvent(state.events.find(e => e.location === l.name) ?? state.events[0]); }}><span className="marker-dot">{l.type === 'sect' ? <Landmark size={13}/> : <MapPin size={12}/>}</span><span className="marker-label">{l.name}<small>{l.type === 'sect' ? '宗门' : '城镇'}</small></span></button>; })}
      {showPeople && featured.map((p, i) => { const at = point(p.location); return <button key={p.id} className="map-marker person" style={{ left: `${at.x + (i % 2 ? 7 : -6)}%`, top: `${at.y + (i % 2 ? -8 : 10)}%` }} onClick={() => onPerson(p)} title={`${p.name} · ${GOAL_NAME[p.goal]}`}><span className="marker-dot" style={{ width: 23, height: 23 }}>{(() => { const Icon = goalIcon[p.goal] ?? CircleDot; return <Icon size={11}/>; })()}</span><span className="marker-label" style={{ fontSize: 9 }}>{p.name}</span></button>; })}
      {showEvents && events.map((e, i) => { const a = state.people.find(p => p.id === e.actorId); const at = point(a?.location ?? ''); return <button key={e.id} className="map-marker event" style={{ left: `${Math.min(83, at.x + 10)}%`, top: `${Math.min(77, at.y + 3 + i * 12)}%` }} onClick={() => onEvent(e)} title={e.cause}><span className="marker-dot">{e.kind === 'rob' ? <Flame size={13}/> : <Leaf size={13}/>}</span><span className="marker-label" style={{ color: '#9c7d46', fontSize: 9 }}>{e.kind === 'rob' ? '山道劫案' : e.kind === 'request' ? '故人有约' : '恩怨追踪'}</span></button>; })}
      <div className="map-legend"><button className={showPeople ? '' : 'off'} onClick={() => setShowPeople(!showPeople)} aria-pressed={showPeople}><CircleDot size={10}/>众生行迹</button><button className={showEvents ? '' : 'off'} onClick={() => setShowEvents(!showEvents)} aria-pressed={showEvents}><Flame size={10}/>因果事件</button><button onClick={() => { setZoom(1); setRegion('tiannan'); }}><Landmark size={10}/>宗门势力</button></div>
      <div className="map-tools"><button title="放大地图" disabled={zoom >= 1.8} onClick={() => setZoom(Math.min(1.8, zoom + .2))}><Plus size={14}/></button><button title="缩小地图" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - .2))}><Minus size={14}/></button><button title="重置地图视角" onClick={() => { setZoom(1); setRegion('tiannan'); }}><LocateFixed size={14}/></button></div>
    </div>
    <div className="map-foot"><span className="flex items-center gap-1.5"><i className="live-dot"/>{people.length} 位众生在此生活 · 点击人物查看生平</span><span>世界很大，每个人都有自己的路。</span></div>
  </section>;
}
