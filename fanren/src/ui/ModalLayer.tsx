// 第四～六步的界面：对话、交易、城镇、拍卖会、红颜录、大事记
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Game } from '../world/game';
import type { DNode, DOpt, Shop, ShopStock } from '../world/modal';
import type { LocDef } from '../data/world';
import { LOC_BY_ID } from '../data/world';
import { itemDef } from '../data/items';
import { REALMS, realmName } from '../data/realms';
import { BEAUTIES } from '../data/beauties';
import { CharState, drawCharacter, Look } from '../gfx/character';
import { SECT_RANKS, repName } from '../world/worldstate';
import * as C from '../world/cultivation';
import { audio } from '../world/audio';

const TIER_COLOR = ['#5a544a', '#2f6b5e', '#2b5a8a', '#7a3a9a', '#b8802a', '#a8352a', '#d04a20'];
const TYPE_NAME: Record<string, string> = { pill: '丹药', herb: '灵草', material: '材料', talisman: '符箓', scroll: '功法', artifact: '法宝', misc: '杂物' };
const click = () => audio.sfx('click');

function useModal(game: Game) { return useSyncExternalStore((f) => game.subscribeModal(f), () => game.modal, () => game.modal); }

export function ModalLayer({ game }: { game: Game }) {
  const m = useModal(game);
  if (!m) return null;
  if (m.kind === 'dialog') return <DialogBox key="dlg" game={game} node={m.node} />;
  if (m.kind === 'shop') return <ShopPanel game={game} shop={m.shop} />;
  if (m.kind === 'town') return <TownPanel game={game} loc={m.loc} />;
  if (m.kind === 'auction') return <AuctionPanel game={game} loc={m.loc} />;
  if (m.kind === 'hearts') return <HeartsPanel game={game} />;
  if (m.kind === 'chronicle') return <ChroniclePanel game={game} />;
  if (m.kind === 'help') return <HelpPanel game={game} />;
  return null;
}

// ---------------------------------------------------------------- 代码绘制的半身像（非红颜 NPC 不使用 AI 立绘）
export function Bust({ look, w = 150, h = 190, yaw = 1 }: { look: Look; w?: number; h?: number; yaw?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d')!;
    const S = 5.2 * (w / 150) * dpr;
    const st = new CharState(cv.width / 2, cv.height * 0.3 + 86 * S * look.height);
    st.yaw = (st as any).targetYaw = yaw * Math.PI / 4; st.setAction('idle'); (st as any).blend = 1; (st as any).seed = 3;
    let raf = 0, last = performance.now();
    for (let i = 0; i < 40; i++) { st.update(1 / 60); g.save(); drawCharacter(g, look, st, S, 1 / 60); g.restore(); g.clearRect(0, 0, cv.width, cv.height); }
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      st.update(dt);
      g.clearRect(0, 0, cv.width, cv.height);
      g.save(); drawCharacter(g, look, st, S, dt); g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [look, w, h, yaw]);
  return <canvas ref={ref} className="bust" style={{ width: w, height: h }} />;
}

// ---------------------------------------------------------------- 对话
function DialogBox({ game, node }: { game: Game; node: DNode }) {
  const [shown, setShown] = useState(0);
  const full = node.text;
  useEffect(() => {
    setShown(0);
    let n = 0; const id = setInterval(() => { n += 2; setShown(n); if (n >= full.length) clearInterval(id); }, 22);
    return () => clearInterval(id);
  }, [node]);
  const done = shown >= full.length;
  const pick = (o: DOpt) => {
    if (o.disabled) return;
    audio.sfx(o.tone === 'love' ? 'chime' : 'click');
    const before = game.modal;
    const nx = o.act?.();
    if (nx) game.openDialog(nx);
    else if (game.modal === before) game.closeModal();
  };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (!done) { if (e.key === ' ' || e.key === 'Enter') setShown(full.length); return; }
      const i = +e.key - 1; if (i >= 0 && i < node.options.length) pick(node.options[i]);
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  });
  return (
    <div className="dlg-mask">
      <div className={'dlg ' + (node.mood ?? 'normal')} onClick={() => !done && setShown(full.length)}>
        <div className="dlg-face">
          {node.portrait ? <div className="dlg-portrait" style={{ backgroundImage: `url(${node.portrait})` }} /> : node.look ? <Bust look={node.look} /> : <div className="dlg-seal">{node.speaker.slice(0, 1)}</div>}
        </div>
        <div className="dlg-main">
          <div className="dlg-head"><span className="dlg-name">{node.speaker}</span>{node.title && <span className="dlg-title">{node.title}</span>}</div>
          <div className="dlg-text">{full.slice(0, shown).split('\n').map((l, i) => <p key={i}>{l || '\u00a0'}</p>)}</div>
          {done && <div className="dlg-opts">
            {node.options.map((o, i) => (
              <button key={i} className={'dlg-opt' + (o.tone ? ' ' + o.tone : '')} disabled={o.disabled} onClick={(e) => { e.stopPropagation(); pick(o); }} title={o.hint}>
                <kbd>{i + 1}</kbd>{o.label}{o.disabled && o.hint && <small>（{o.hint}）</small>}
              </button>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 卷轴面板
function Scroll({ title, sub, onClose, children, wide, cls }: { title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean; cls?: string }) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className={'scroll-panel cult-panel' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '')} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head"><div className="panel-title">{title}</div><div className="panel-sub">{sub}</div><button className="close-btn" onClick={() => { click(); onClose(); }}>×</button></div>
        <div className="cult-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 交易
function ShopPanel({ game, shop }: { game: Game; shop: Shop }) {
  const [, force] = useState(0); const re = () => force((x) => x + 1);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const h = game.hero;
  const contrib = shop.currency === 'contrib';
  const money = contrib ? game.ws.sect?.contrib ?? 0 : C.bagCount(h, 'mat_lingshi');
  const unit = contrib ? '贡献' : '灵石';
  const sellable = h.bag.filter((b) => b.id !== 'mat_lingshi' && itemDef(b.id).price > 0 && itemDef(b.id).type !== 'misc');
  return (
    <Scroll title={shop.title.split(' · ').pop()!} sub={<span>{shop.title.split(' · ')[0]}　{shop.desc}　·　{unit} <b>{money}</b></span>} onClose={() => game.closeModal()} wide>
      {!shop.noSell && <div className="tabs"><button className={mode === 'buy' ? 'on' : ''} onClick={() => setMode('buy')}>买入</button><button className={mode === 'sell' ? 'on' : ''} onClick={() => setMode('sell')}>卖出</button></div>}
      <div className="shop-list">
        {mode === 'buy' && shop.stock.map((s: ShopStock, i) => {
          const d = itemDef(s.id);
          return (
            <div key={s.id + i} className="shop-row">
              <span className="glyph" style={{ color: TIER_COLOR[d.tier] }}>{d.glyph}</span>
              <div className="sr-main"><div className="sr-name" style={{ color: TIER_COLOR[d.tier] }}>{d.name}{s.age !== undefined && <small> {s.age}年</small>}<small className="sr-type">{TYPE_NAME[d.type]}</small></div><div className="sr-desc">{d.desc}</div></div>
              <div className="sr-buy"><div className="sr-price">{s.price} {unit}</div><small>余 {s.n}</small>
                <button className="ink-btn small" disabled={money < s.price} onClick={() => { if (game.towns.buy(shop, s)) audio.sfx('chime'); re(); }}>购买</button></div>
            </div>
          );
        })}
        {mode === 'buy' && !shop.stock.length && <div className="hint">货架已空。</div>}
        {mode === 'sell' && sellable.map((b, i) => {
          const d = itemDef(b.id);
          const p = Math.max(1, Math.round(d.price * shop.sellRate * (d.type === 'herb' ? 1 + Math.min(2, (b.age ?? 0) / 100) : 1)));
          return (
            <div key={b.id + i + (b.age ?? '')} className="shop-row">
              <span className="glyph" style={{ color: TIER_COLOR[d.tier] }}>{d.glyph}</span>
              <div className="sr-main"><div className="sr-name" style={{ color: TIER_COLOR[d.tier] }}>{d.name}{b.age !== undefined && <small> {b.age}年</small>}<small className="sr-type">持有 {b.n}</small></div><div className="sr-desc">{d.desc}</div></div>
              <div className="sr-buy"><div className="sr-price">{p} 灵石</div>
                <button className="ink-btn small ghost" onClick={() => { game.towns.sell(shop, b.id, b.age); click(); re(); }}>卖出</button></div>
            </div>
          );
        })}
      </div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 城镇
function TownPanel({ game, loc }: { game: Game; loc: LocDef }) {
  const [, force] = useState(0); const re = () => force((x) => x + 1);
  const [tp, setTp] = useState(false);
  const T = game.towns, h = game.hero;
  const occupied = T.occupied(loc);
  const isSect = loc.type === 'sect';
  const big = loc.type === 'city' || loc.type === 'isle' || loc.id === 'tainan';
  type F = { seal: string; name: string; desc: string; act: () => void; dis?: string; cls?: string };
  const fs: F[] = [];
  if (isSect) fs.push({ seal: '宗', name: game.ws.sect?.id === loc.id ? '宗门事务' : '山门', desc: game.ws.sect?.id === loc.id ? `${SECT_RANKS[game.ws.sect.rank]} · 贡献 ${game.ws.sect.contrib}　任务、藏经阁、俸禄、晋升` : '拜入宗门，领取俸禄与任务', act: () => game.openDialog(T.sectNode(loc)), cls: 'gold' });
  if (!occupied) {
    fs.push({ seal: '市', name: '坊市', desc: '灵草、材料、符箓杂货', act: () => game.openShop(T.shop(loc, 'market')) });
    fs.push({ seal: '丹', name: '丹药铺', desc: '聚气丹、疗伤丹……偶有筑基丹', act: () => game.openShop(T.shop(loc, 'pill')) });
    if (big || isSect) fs.push({ seal: '器', name: '法器阁', desc: '飞剑、法盾、成套法器', act: () => game.openShop(T.shop(loc, 'artifact')) });
    if (big || isSect) fs.push({ seal: '符', name: '符箓斋', desc: '符箓与法术玉简', act: () => game.openShop(T.shop(loc, 'talisman')) });
  }
  if (!isSect) fs.push({ seal: '酒', name: '酒楼', desc: '打听消息、传闻、秘境下落', act: () => game.openDialog(T.tavern(loc)) });
  fs.push({ seal: '栈', name: isSect ? '洞府' : '客栈', desc: isSect ? '歇息一夜，自动存档' : `住店一晚（${loc.type === 'city' ? 5 : 2} 灵石），气血法力尽复，自动存档`, act: () => { T.rest(loc); re(); } });
  if (T.hasTeleport(loc)) fs.push({ seal: '阵', name: '传送阵', desc: `已激活 ${game.ws.tp.length} 处，按路程收取灵石`, act: () => setTp(!tp) });
  if (T.isMajorTown(loc)) { const open = T.auctionOpen(loc); const d = Math.floor(game.day) % 90; fs.push({ seal: '拍', name: '拍卖会', desc: open ? `正在举行（还剩 ${90 - d} 日）` : `每季末举行，${80 - d} 日后开拍`, act: () => game.openModal({ kind: 'auction', loc }), dis: open ? undefined : '尚未开拍', cls: open ? 'gold' : '' }); }
  for (const b of BEAUTIES) if (b.home === loc.id) { const s = game.ws.hearts[b.id]; const n = game.npcs.byId.get('b_' + b.id); if (n?.alive && Math.hypot(n.x - loc.x * 300, n.y - loc.y * 300) < 8000) fs.push({ seal: '缘', name: s?.met ? `拜访${b.name}` : '传闻中的仙子', desc: s?.met ? b.title : '听说此地住着一位女修……', act: () => game.hearts.talk(b.id), cls: 'love' }); }
  const tps = game.ws.tp.map((id) => LOC_BY_ID.get(id)!).filter((l) => l && l.id !== loc.id);
  return (
    <Scroll title={loc.name} sub={<span>{loc.desc}　·　灵石 <b>{C.bagCount(h, 'mat_lingshi')}</b>　·　{repName(game.ws.rep)}</span>} onClose={() => game.closeModal()} wide cls="town-panel">
      {occupied && <div className="town-warn">越国已沦陷，此地被魔道占据，商铺尽数关门。</div>}
      <div className="town-grid">
        {fs.map((f, i) => (
          <button key={i} className={'town-fac ' + (f.cls ?? '')} disabled={!!f.dis} onClick={() => { click(); f.act(); }}>
            <span className="tf-seal">{f.seal}</span><span className="tf-name">{f.name}</span><span className="tf-desc">{f.dis ?? f.desc}</span>
          </button>
        ))}
      </div>
      {tp && <div className="tp-list">
        <div className="sec-title">传送阵<small>只能前往已激活的阵台（大城、大宗门）</small></div>
        {tps.length === 0 && <div className="hint">尚未激活其他传送阵。亲身抵达各大城池、宗门即可激活。</div>}
        {tps.map((l) => { const c = T.tpCost(loc, l); return <button key={l.id} className="tp-row" disabled={C.bagCount(h, 'mat_lingshi') < c} onClick={() => { audio.sfx('whoosh'); T.teleportTo(loc, l); }}><b>{l.name}</b><span>{c} 灵石</span></button>; })}
      </div>}
      <div className="hint" style={{ marginTop: 8 }}>T 与城中之人交谈 · H 红颜录 · J 大事记 · Esc 离开</div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 拍卖会
type Lot = { id: string; base: number; price: number; done?: 'won' | 'lost'; who?: string };
const BIDDERS = ['一位蒙面修士', '天星宗执事', '富态的商会掌柜', '鬼灵门弟子', '白发老妪', '某世家公子', '黄衫少女', '独眼散修'];
function AuctionPanel({ game, loc }: { game: Game; loc: LocDef }) {
  const key = `auc_${loc.id}_${Math.floor(game.day / 90)}`;
  const [lots, setLots] = useState<Lot[]>(() => (game as any)[key] ?? ((game as any)[key] = game.towns.auctionLots(loc)));
  const [cur, setCur] = useState(() => Math.max(0, lots.findIndex((l) => !l.done)));
  const [log, setLog] = useState<string[]>(['拍卖师敲响铜锣：「诸位道友，拍卖会正式开始！」']);
  const [lead, setLead] = useState<'me' | string | null>(null);
  const h = game.hero, money = C.bagCount(h, 'mat_lingshi');
  const lot = lots[cur];
  const upd = (l: Lot) => { const nl = lots.slice(); nl[cur] = l; (game as any)[key] = nl; setLots(nl); };
  const npcBid = (l: Lot): string | null => {
    const r = l.price / l.base;
    const p = Math.max(0, 1.25 - r * 0.45) * (itemDef(l.id).id === 'pill_zhuji' ? 1.3 : 1);
    return Math.random() < p ? BIDDERS[Math.floor(Math.random() * BIDDERS.length)] : null;
  };
  const bid = (k: number) => {
    if (!lot || lot.done) return;
    const np = Math.round(lot.price * k);
    if (np > money) { game.toast('灵石不足', 'warn'); return; }
    click();
    const lines = [`你出价 ${np} 灵石。`];
    const l2 = { ...lot, price: np };
    const who = npcBid(l2);
    if (who) { l2.price = Math.round(np * (1.08 + Math.random() * 0.12)); lines.push(`${who}冷笑一声：「${l2.price}！」`); setLead(who); }
    else { lines.push('全场寂静……拍卖师连喊三声，一锤定音！'); C.removeItem(h, 'mat_lingshi', np); C.addItem(h, l2.id, 1); l2.done = 'won'; audio.sfx('chime'); setLead('me'); game.toast(`拍得 ${itemDef(l2.id).name}`, 'good'); if (Math.random() < 0.3 && itemDef(l2.id).price > 3000) { lines.push('（你察觉到有几道神识在你身上停留了片刻……出城时小心些。）'); game.ws.flags.auctionMark = game.day; } }
    upd(l2); setLog((x) => [...x.slice(-8), ...lines]);
  };
  const pass = () => {
    if (!lot || lot.done) return;
    const who = lead && lead !== 'me' ? lead : BIDDERS[Math.floor(Math.random() * BIDDERS.length)];
    upd({ ...lot, done: 'lost', who }); setLog((x) => [...x.slice(-8), `${itemDef(lot.id).name}被${who}以 ${lot.price} 灵石拍走。`]);
  };
  const next = () => { const i = lots.findIndex((l, j) => j > cur && !l.done); if (i >= 0) { setCur(i); setLead(null); setLog((x) => [...x.slice(-8), `下一件拍品：${itemDef(lots[i].id).name}，底价 ${lots[i].base} 灵石。`]); } };
  return (
    <Scroll title="拍卖会" sub={<span>{loc.name}　·　灵石 <b>{money}</b></span>} onClose={() => game.closeModal()} wide>
      <div className="auc">
        <div className="auc-lots">
          {lots.map((l, i) => { const d = itemDef(l.id); return (
            <button key={i} className={'auc-lot' + (i === cur ? ' on' : '') + (l.done ? ' ' + l.done : '')} onClick={() => { if (!l.done) { setCur(i); setLead(null); } }}>
              <span className="glyph" style={{ color: TIER_COLOR[d.tier] }}>{d.glyph}</span><span>{d.name}</span><small>{l.done === 'won' ? '已拍得' : l.done === 'lost' ? `归${l.who}` : `底价 ${l.base}`}</small>
            </button>); })}
        </div>
        <div className="auc-main">
          {lot && <>
            <div className="bd-name" style={{ color: TIER_COLOR[itemDef(lot.id).tier] }}>{itemDef(lot.id).name}</div>
            <div className="bd-desc">{itemDef(lot.id).desc}</div>
            <div className="auc-price">当前价 <b>{lot.price}</b> 灵石{lead && !lot.done && <small>　领先：{lead === 'me' ? '你' : lead}</small>}</div>
            {!lot.done ? <div className="bd-actions">
              <button className="ink-btn small" onClick={() => bid(lead ? 1.1 : 1)}>{lead ? '加价一成' : '按底价出价'}</button>
              <button className="ink-btn small" onClick={() => bid(lead ? 1.3 : 1.25)}>{lead ? '加价三成' : '高出两成半'}</button>
              <button className="ink-btn small ghost" onClick={pass}>放弃</button>
            </div> : <div className="bd-actions"><button className="ink-btn small jade" onClick={next}>下一件</button></div>}
          </>}
          <div className="auc-log">{log.map((l, i) => <p key={i}>{l}</p>)}</div>
        </div>
      </div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 红颜录
function HeartsPanel({ game }: { game: Game }) {
  const [, force] = useState(0); const re = () => force((x) => x + 1);
  const list = game.hearts.list();
  const [sel, setSel] = useState(() => list.find((x) => x.s?.met)?.b.id ?? list[0].b.id);
  const cur = list.find((x) => x.b.id === sel)!;
  const met = !!cur.s?.met;
  const fv = cur.s?.favor ?? 0;
  const stageName = !met ? '未曾相识' : cur.s!.flags.parted ? '缘尽' : cur.s!.flags.companion ? '道侣' : fv >= 60 ? '倾心' : fv >= 30 ? '知己' : fv >= 10 ? '相熟' : fv > -10 ? '萍水相逢' : '嫌隙';
  return (
    <Scroll title="红颜录" sub={<span>情缘随心，故事由你书写</span>} onClose={() => game.closeModal()} wide cls="hearts-panel">
      <div className="hearts">
        <div className="hearts-list">
          {list.map(({ b, s }) => (
            <button key={b.id} className={'heart-card' + (sel === b.id ? ' on' : '') + (s?.met ? '' : ' unmet') + (s?.follow ? ' follow' : '')} onClick={() => { click(); setSel(b.id); }}>
              <div className="hc-img" style={{ backgroundImage: `url(${b.portrait})` }} />
              <div className="hc-name">{s?.met ? b.name : '？？？'}</div>
              {s?.follow && <div className="hc-tag">同行</div>}
            </button>
          ))}
        </div>
        <div className="heart-detail">
          <div className={'hd-portrait' + (met ? '' : ' unmet')} style={{ backgroundImage: `url(${cur.b.portrait})` }} />
          <div className="hd-info">
            <div className="hd-name">{met ? cur.b.name : '？？？'}<small>{met ? cur.b.title : ''}</small></div>
            <div className="hd-sub">{met ? `${realmName(cur.b.realm, cur.b.stage)} · ${stageName}` : stageName}</div>
            {met && <div className="favor"><div className="favor-bar"><i style={{ width: `${(fv + 100) / 2}%`, background: fv >= 0 ? 'linear-gradient(90deg,#e8a0b0,#d04a6a)' : '#5a544a' }} /></div><span>好感 {Math.round(fv)}</span></div>}
            <div className="hd-intro">{met ? cur.b.intro : '画中人眉目模糊，只余一个背影。'}</div>
            <div className="hd-hint">◈ {cur.hint}</div>
            {met && <div className="hd-bonus">同行加成：{cur.b.bonus.text}</div>}
            {met && cur.s!.flags.companion && !cur.s!.flags.parted && (
              <div className="bd-actions">
                <button className={'ink-btn small' + (cur.s!.follow ? ' ghost' : ' jade')} onClick={() => { game.hearts.setFollow(cur.b.id, !cur.s!.follow); re(); }}>{cur.s!.follow ? '请她留下' : '邀她同行'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 大事记
function ChroniclePanel({ game }: { game: Game }) {
  const ev = game.events.chronicle();
  const news = game.ws.news.slice().reverse().slice(0, 60);
  const s = game.ws.sect;
  const year = Math.floor(game.day / 360) + 1;
  return (
    <Scroll title="大事记" sub={<span>第{year}年　·　{repName(game.ws.rep)}（{game.ws.rep}）　·　{s ? `${LOC_BY_ID.get(s.id)?.name} ${SECT_RANKS[s.rank]}` : '散修'}</span>} onClose={() => game.closeModal()} wide>
      <div className="chron">
        <div className="chron-col">
          <div className="sec-title">人界大势<small>原著大事件，结局可被改变</small></div>
          {ev.map((e, i) => (
            <div key={i} className={'chron-ev ' + (e.state === '进行中' ? 'live' : e.state === '已参与' ? 'done' : e.state === '已错过' ? 'missed' : '')}>
              <div className="ce-head"><b>{e.name}</b><span>第{e.year}年{e.loc ? ' · ' + e.loc : ''}</span><em>{e.state}</em></div>
              <div className="ce-desc">{e.desc}{e.score !== undefined && e.state === '进行中' ? `（越国斩杀魔修 ${e.score}/25）` : ''}</div>
            </div>
          ))}
        </div>
        <div className="chron-col">
          <div className="sec-title">江湖传闻</div>
          {news.length === 0 && <div className="hint">尚无传闻。多与人交谈、去酒楼坐坐。</div>}
          {news.map((n, i) => <div key={i} className={'news ' + (n.kind ?? '')}><span>第{Math.floor(n.day / 360) + 1}年{Math.floor((n.day % 360) / 30) + 1}月</span>{n.text}</div>)}
        </div>
      </div>
      <div className="hint">修为：{REALMS[game.hero.realm].name}　·　图例：红色为进行中的大事件（小地图上会闪烁标出战场）</div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 帮助
export const VERSION = 'v0.8 · 第一～七步';
function HelpPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState(0);
  const T = ['操作', '修炼', '战斗', '人界', '神识'];
  const body = [
    <div className="keys" key={0}>
      <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 / 点击地面 移动　·　<kbd>Shift</kbd> 疾行<br />
      <kbd>T</kbd> 交谈 / 查看奇遇　·　<kbd>G</kbd> 进城 / 入宗门　·　<kbd>H</kbd> 红颜录　·　<kbd>J</kbd> 大事记<br />
      <kbd>Z</kbd> 打坐　·　<kbd>E</kbd> 采集　·　<kbd>C</kbd> 角色 / 冲关　·　<kbd>B</kbd> 储物袋　·　<kbd>L</kbd> 丹房　·　<kbd>P</kbd> 闭关<br />
      <kbd>1</kbd>–<kbd>9</kbd> 施法　·　<kbd>K</kbd> 法术书　·　<kbd>Q</kbd> 神识外放　·　<kbd>R</kbd> 敛息<br />
      <kbd>M</kbd> 世界地图　·　滚轮 / <kbd>+</kbd><kbd>-</kbd> 缩放　·　<kbd>?</kbd> 本帮助　·　<kbd>Esc</kbd> 关闭 / 设置<br />
      对话中可按数字键选择选项，空格跳过打字效果。<br />
      手机：左下摇杆移动，右下 3×3 法诀盘施法，双指缩放；交谈、进城等以屏幕按钮操作。
    </div>,
    <div className="hd-intro" key={1}>打坐（Z）时光阴 ×4，修为随灵根、功法、所在地灵气增长。修为满后遇小瓶颈需服丹冲关，大境界圆满后在角色面板冲击下一境界（筑基需筑基丹）。<br />掌天瓶每七日凝一滴绿液，可将灵草催熟百年。高年份灵草提高炼丹成功率。<br />闭关（P）可一次度过数月至十年，但人界大事不会等你。</div>,
    <div className="hd-intro" key={2}>9 格快捷栏，法术与法器任意摆放。法术分凡 / 黄 / 玄 / 地 / 天五品，熟练度初学 → 圆满会改变形态。<br />异状连携：冰冻 + 雷、定身 + 火、燃烧 + 风、中毒 + 火……<br />倒下不会坐化：损失一成修为与少量物品，在最近城镇醒来。越阶挑战有险，名牌颜色提示强弱。</div>,
    <div className="hd-intro" key={3}>人界约 450 人各有境界、宗门、性格与目标，会修炼、衰老、陨落，也会彼此斗法——你可以旁观、相助或捡漏。劫修专挑弱者下手，声望决定正魔两道对你的态度。<br />城镇：坊市、丹药铺、法器阁、符箓斋、酒楼、客栈、传送阵、拍卖会。宗门：俸禄、任务、藏经阁、晋升。<br />红颜八位，各有故事线；结为道侣后可同行助战。<br />原著大事件按年份发生（升仙大会、血色禁地、燕家堡、魔道入侵、虚天殿、坠魔谷），提前一年在酒楼与大事记中传闻。</div>,
    <div className="hd-intro" key={4}>只有神识圈内的东西才是“真实”的——圈外是褪色的记忆水墨，看不到任何动静。奇遇、敌人、行人都要靠神识发现。<br />神识随境界与功法增长；大衍决、养魂木等会改变神识的样貌与范围。Q 外放神识（范围 ×2），R 敛息（范围缩小，但不易被更强者察觉）。<br />被更强的神识扫过时，圈边泛红、画面轻震——那意味着有人注意到你了。</div>,
  ];
  return (
    <Scroll title="修仙指南" sub={<span>{VERSION}</span>} onClose={() => game.closeModal()} wide>
      <div className="tabs">{T.map((t, i) => <button key={i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div>
      {body[tab]}
    </Scroll>
  );
}
