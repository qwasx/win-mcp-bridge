// 衣橱（换衣系统）：衣裳 + 染色、容貌（五官 / 头型）、身形、发式与配饰；实时预览可拖动转身、试各种动作看手势。
// WardrobeStudio 不依赖 Game，游戏内的 WardrobePanel 与独立的「人物工坊」页面共用。
import { useEffect, useRef, useState } from 'react';
import {
  CharState, drawCharacter, HANLI_LOOK, dressLook, outfitsFor, OUTFIT_BY_ID, DEFAULT_WARDROBE, resolveLook,
  HAIR_COLORS, SKIN_COLORS, HAIR_NAMES, IDLE_NAMES, FACE_SLIDERS, HEAD_SLIDERS, BODY_SLIDERS, EYE_NAMES, BROW_NAMES, FRINGE_NAMES,
  genFace, genHead, genBody,
  type Wardrobe, type Look, type Action, type Sex, type HairStyle, type Fringe, type EyeShape, type BrowShape, type IdleStyle,
} from '../gfx/character';
/** 只需要游戏的这几样（不直接依赖 world/game，独立页面也能用） */
interface GameLike { hero: { wardrobe?: Wardrobe }; player: { look: Look }; setWardrobe(w: Wardrobe): void }

/** 从现有外观推出一份衣橱（第一次打开时） */
export function wardrobeOf(look: Look): Wardrobe {
  return {
    sex: look.sex, outfit: look.outfit ?? DEFAULT_WARDROBE[look.sex].outfit, dye: look.dye ?? 0,
    hairStyle: look.hairStyle, fringe: look.fringe, hair: look.hair, skin: look.skin,
    pin: look.pin ?? 'none', ribbon: look.ribbon ?? 'none', back: look.back ?? 'none', waist: look.waist ?? 'none', hand: look.hand ?? 'none',
    idle: look.idle, height: look.height, build: look.build,
    face: { ...(look.face ?? {}) }, head: { ...(look.head ?? {}) }, body: { ...(look.body ?? {}) },
  };
}

const PREVIEW_ACTS: [string, Action, number][] = [['站立', 'idle', 0], ['行走', 'walk', 110], ['奔跑', 'run', 230], ['施法', 'cast', 0], ['打坐', 'sit', 0], ['御剑', 'fly', 240], ['采集', 'gather', 0]];

/** 实时预览：拖动转身；施法 / 采集会循环重放（施法四式轮换） */
export function LookPreview({ look, width = 300, height = 440, scale = 3.3, act = 'idle', speed = 0, autoTurn = false }: { look: Look; width?: number; height?: number; scale?: number; act?: Action; speed?: number; autoTurn?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look); lookRef.current = look;
  const actRef = useRef({ act, speed, autoTurn }); actRef.current = { act, speed, autoTurn };
  const yawRef = useRef(0.55);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  useEffect(() => {
    const cv = ref.current!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = width * dpr; cv.height = height * dpr;
    const g = cv.getContext('2d')!;
    const S = scale * (height / 440) * dpr;
    const st = new CharState(cv.width / 2, cv.height * 0.86);
    st.seed = 4; st.yaw = st.targetYaw = yawRef.current;
    let raf = 0, last = performance.now(), replay = 0, cur: Action = 'idle';
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const { act: a, speed: sp, autoTurn: at } = actRef.current;
      if (at && !drag.current) yawRef.current += dt * 0.5;
      st.yaw = st.targetYaw = yawRef.current;
      if (a !== cur) { st.setAction(a); cur = a; replay = 0; }
      if (a === 'cast' || a === 'gather') { replay += dt; if (replay > (a === 'cast' ? 1.25 : 2.2)) { replay = 0; st.setAction('idle'); st.blend = 1; st.setAction(a); } }
      st.speed = sp; st.vx = Math.sin(st.yaw) * sp; st.vy = Math.cos(st.yaw) * sp;
      st.lift = a === 'fly' ? 14 * dpr : 0;
      st.update(dt);
      g.clearRect(0, 0, cv.width, cv.height);
      const gr = g.createRadialGradient(st.x, st.y + 4 * dpr, 0, st.x, st.y + 4 * dpr, 60 * S / 3.3);
      gr.addColorStop(0, 'rgba(60,50,36,0.28)'); gr.addColorStop(1, 'rgba(60,50,36,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(st.x, st.y + 4 * dpr, 70 * S / 3.3, 20 * S / 3.3, 0, 0, Math.PI * 2); g.fill();
      drawCharacter(g, lookRef.current, st, S, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height, scale]);
  return (
    <canvas ref={ref} className="wd-canvas" style={{ width, height }}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, yaw: yawRef.current }; }}
      onPointerMove={(e) => { if (drag.current) yawRef.current = drag.current.yaw + (e.clientX - drag.current.x) * 0.012; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
  );
}

function Chips<T extends string>({ items, value, onPick }: { items: [T, string][]; value: T | undefined; onPick: (v: T) => void }) {
  return <div className="wd-chips">{items.map(([k, n]) => <button key={k} className={'wd-chip' + (k === value ? ' on' : '')} onClick={() => onPick(k)}>{n}</button>)}</div>;
}
function Swatches({ colors, value, onPick }: { colors: string[]; value?: string; onPick: (c: string) => void }) {
  return <div className="wd-swatches">{colors.map((c) => <button key={c} className={'wd-sw' + (c === value ? ' on' : '')} style={{ background: c }} onClick={() => onPick(c)} title={c} />)}</div>;
}
function Slider({ name, min, max, step, value, onChange }: { name: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="wd-slider"><span>{name}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <em>{value.toFixed(2)}</em>
    </label>
  );
}

type Tab = 'outfit' | 'face' | 'body' | 'hair';
export function WardrobeStudio({ value, onChange, base = HANLI_LOOK, previewH = 440 }: { value: Wardrobe; onChange: (w: Wardrobe) => void; base?: Look; previewH?: number }) {
  const [tab, setTab] = useState<Tab>('outfit');
  const [act, setAct] = useState(0);
  const [turn, setTurn] = useState(false);
  const look = dressLook(base, value);
  const R = resolveLook(look);
  const set = (p: Partial<Wardrobe>) => onChange({ ...value, ...p });
  const sex = value.sex;
  const outfits = outfitsFor(sex);
  const cur = OUTFIT_BY_ID[look.outfit ?? value.outfit];
  const [an, aa, asp] = PREVIEW_ACTS[act];
  void an;
  return (
    <div className="wd-studio">
      <div className="wd-left">
        <LookPreview look={look} act={aa} speed={asp} autoTurn={turn} height={previewH} width={Math.round(previewH * 0.68)} />
        <div className="wd-acts">
          {PREVIEW_ACTS.map(([n], i) => <button key={n} className={'wd-chip' + (i === act ? ' on' : '')} onClick={() => setAct(i)}>{n}</button>)}
          <button className={'wd-chip' + (turn ? ' on' : '')} onClick={() => setTurn(!turn)}>转身</button>
        </div>
        <p className="wd-tip">拖动人物可转身 · 「施法」轮流演示剑指 / 推掌 / 掐诀 / 托天</p>
      </div>
      <div className="wd-right">
        <div className="wd-sex">
          {(['m', 'f'] as Sex[]).map((s) => <button key={s} className={'wd-seal' + (sex === s ? ' on' : '')} onClick={() => sex !== s && onChange({ ...DEFAULT_WARDROBE[s] })}>{s === 'm' ? '男相' : '女相'}</button>)}
        </div>
        <div className="wd-tabs">
          {([['outfit', '衣裳'], ['face', '容貌'], ['body', '身形'], ['hair', '发饰']] as [Tab, string][]).map(([k, n]) => <button key={k} className={'wd-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{n}</button>)}
        </div>
        <div className="wd-body">
          {tab === 'outfit' && <>
            <div className="wd-outfits">
              {outfits.map((o) => (
                <button key={o.id} className={'wd-card' + (o.id === cur?.id ? ' on' : '')} onClick={() => set({ outfit: o.id, dye: 0 })} title={o.desc}>
                  <i style={{ background: `linear-gradient(135deg, ${o.dyes[0].over ?? o.dyes[0].robe} 0 50%, ${o.dyes[0].skirt ?? o.dyes[0].robe} 50% 100%)`, borderColor: o.dyes[0].trim }} />
                  <b>{o.name}</b>
                </button>
              ))}
            </div>
            {cur && <>
              <p className="wd-desc">{cur.desc}</p>
              <h4>染色</h4>
              <div className="wd-swatches">
                {cur.dyes.map((d, i) => (
                  <button key={d.name} className={'wd-dye' + (i === (look.dye ?? 0) ? ' on' : '')} onClick={() => set({ dye: i })} title={d.name}>
                    <i style={{ background: `linear-gradient(135deg, ${d.over ?? d.robe} 0 50%, ${d.skirt ?? d.robe} 50% 100%)`, borderColor: d.trim }} /><span>{d.name}</span>
                  </button>
                ))}
              </div>
            </>}
          </>}
          {tab === 'face' && <>
            <div className="wd-row"><button className="wd-btn" onClick={() => { const s = Math.floor(Math.random() * 1e9); set({ face: genFace(s, sex), head: genHead(s, sex) }); }}>随机生成一张脸</button>
              <button className="wd-btn ghost" onClick={() => set({ face: {}, head: {} })}>还原</button></div>
            <h4>眼型</h4>
            <Chips items={Object.entries(EYE_NAMES) as [EyeShape, string][]} value={R.face.eye} onPick={(v) => set({ face: { ...value.face, eye: v } })} />
            <h4>眉型</h4>
            <Chips items={Object.entries(BROW_NAMES) as [BrowShape, string][]} value={R.face.brow} onPick={(v) => set({ face: { ...value.face, brow: v } })} />
            <h4>五官</h4>
            {FACE_SLIDERS.map((s) => <Slider key={s.key} name={s.name} min={s.min} max={s.max} step={s.step} value={R.face[s.key] as number} onChange={(v) => set({ face: { ...value.face, [s.key]: v } })} />)}
            <h4>头型</h4>
            {HEAD_SLIDERS.map((s) => <Slider key={s.key} name={s.name} min={s.min} max={s.max} step={s.step} value={R.head[s.key]} onChange={(v) => set({ head: { ...value.head, [s.key]: v } })} />)}
            <h4>瞳色</h4>
            <Swatches colors={['#3a2a1e', '#5a3c28', '#6a4632', '#2e2018', '#4a5a6a', '#6a3a5a', '#7a2a2a']} value={R.face.iris} onPick={(c) => set({ face: { ...value.face, iris: c } })} />
          </>}
          {tab === 'body' && <>
            <div className="wd-row"><button className="wd-btn" onClick={() => set({ body: genBody(Math.floor(Math.random() * 1e9), sex) })}>随机身形</button>
              <button className="wd-btn ghost" onClick={() => set({ body: {}, height: undefined, build: undefined })}>还原</button></div>
            <Slider name="身高" min={0.86} max={1.1} step={0.01} value={look.height} onChange={(v) => set({ height: v })} />
            <Slider name="骨架" min={0.82} max={1.22} step={0.01} value={look.build} onChange={(v) => set({ build: v })} />
            {BODY_SLIDERS.map((s) => <Slider key={s.key} name={s.name} min={s.min} max={s.max} step={s.step} value={R.body[s.key]} onChange={(v) => set({ body: { ...value.body, [s.key]: v } })} />)}
          </>}
          {tab === 'hair' && <>
            <h4>发式</h4>
            <Chips items={Object.entries(HAIR_NAMES) as [HairStyle, string][]} value={look.hairStyle} onPick={(v) => set({ hairStyle: v })} />
            <h4>刘海</h4>
            <Chips items={Object.entries(FRINGE_NAMES) as [Fringe, string][]} value={R.fringe} onPick={(v) => set({ fringe: v })} />
            <h4>发色</h4>
            <Swatches colors={HAIR_COLORS} value={look.hair} onPick={(c) => set({ hair: c })} />
            <h4>肤色</h4>
            <Swatches colors={SKIN_COLORS} value={look.skin} onPick={(c) => set({ skin: c })} />
            <h4>发簪</h4>
            <Chips items={[['none', '无'], ['gold', '金步摇'], ['jade', '玉簪'], ['flower', '簪花']]} value={(look.pin ?? 'none') as any} onPick={(v) => set({ pin: v as any })} />
            <h4>发带</h4>
            <Chips items={[['none', '无'], ['#2a3a30', '墨绿'], ['#c03040', '朱红'], ['#f0f0f0', '素白'], ['#5070a0', '黛蓝']]} value={(look.ribbon ?? 'none') as any} onPick={(v) => set({ ribbon: v })} />
            <h4>腰间 · 背后 · 手中</h4>
            <Chips items={[['none', '无佩'], ['jade', '玉佩'], ['pouch', '锦囊'], ['gourd', '葫芦']]} value={(look.waist ?? 'none') as any} onPick={(v) => set({ waist: v as any })} />
            <Chips items={[['none', '不背'], ['sword', '背剑'], ['box', '书箱'], ['basket', '药篓']]} value={(look.back ?? 'none') as any} onPick={(v) => set({ back: v as any })} />
            <Chips items={[['none', '空手'], ['fan', '折扇'], ['staff', '竹杖']]} value={(look.hand ?? 'none') as any} onPick={(v) => set({ hand: v as any })} />
            <h4>站姿（手势）</h4>
            <Chips items={Object.entries(IDLE_NAMES) as [IdleStyle, string][]} value={R.idle} onPick={(v) => set({ idle: v })} />
          </>}
        </div>
      </div>
    </div>
  );
}

/** 游戏内：衣橱面板（I 键 / 「衣」按钮） */
export function WardrobePanel({ game, onClose }: { game: GameLike; onClose: () => void }) {
  const [w, setW] = useState<Wardrobe>(() => game.hero.wardrobe ?? wardrobeOf(game.player.look));
  const change = (n: Wardrobe) => { setW(n); game.setWardrobe(n); };
  return (
    <div className="wd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wd-panel">
        <header className="wd-head"><h3>衣橱</h3><span>换衣 · 染色 · 容貌 · 身形 —— 即换即穿，自动记入存档</span><button className="wd-x" onClick={onClose}>×</button></header>
        <WardrobeStudio value={w} onChange={change} base={HANLI_LOOK} />
      </div>
    </div>
  );
}
