// 第四～六步的界面：对话、交易、城镇、拍卖会、红颜录、大事记
import type { AuctionLot } from '../world/town';
import { cityTier, TIER_NAME } from '../data/market';
import { SECT_DEFS, SECT_DEF, sectTitle, RANKS } from '../world/roster';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Game } from '../world/game';
import type { DNode, DOpt, Shop, ShopStock } from '../world/modal';
import type { LocDef } from '../data/world';
import { LOC_BY_ID, locHere } from '../data/world';
import { itemDef } from '../data/items';
import { REALMS, realmName } from '../data/realms';
import { BEAUTIES } from '../data/beauties';
import { CharState, drawCharacter, Look } from '../gfx/character';
import { SECT_RANKS, repName } from '../world/worldstate';
import * as C from '../world/cultivation';
import { audio } from '../world/audio';
import { ItemGlyph } from './ItemIcon';
import { TIER_COLOR as REL_COLOR, SECT_ALLY, allyGroup, SECT_HOSTILE, SECT_SIEGE, SECT_ELDER } from '../world/relations';
import type { Tier } from '../world/relations';
import type { NpcData } from '../world/npc';
import { PERS_NAME } from '../world/npc';
import { portraitFor } from '../data/portraits';

const TIER_COLOR = ['#5a544a', '#2f6b5e', '#2b5a8a', '#7a3a9a', '#b8802a', '#a8352a', '#d04a20'];
const TYPE_NAME: Record<string, string> = { pill: '丹药', herb: '灵草', material: '材料', talisman: '符箓', scroll: '功法', artifact: '法宝', misc: '杂物' };
const click = () => audio.sfx('click');

function useModal(game: Game) { return useSyncExternalStore((f) => game.subscribeModal(f), () => game.modal, () => game.modal); }

export function ModalLayer({ game }: { game: Game }) {
  const m = useModal(game);
  if (!m) return null;
  if (m.kind === 'dialog') return <DialogBox key="dlg" game={game} node={m.node} />;
  if (m.kind === 'shop') return <ShopPanel game={game} shop={m.shop} />;
  if (m.kind === 'town') return <TownPanel game={game} loc={m.loc} fac={m.fac} />;
  if (m.kind === 'auction') return <AuctionPanel game={game} loc={m.loc} />;
  if (m.kind === 'hearts') return <HeartsPanel game={game} />;
  if (m.kind === 'chronicle') return <ChroniclePanel game={game} />;
  if (m.kind === 'relations') return <RelationsPanel game={game} />;
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
  const portrait = portraitFor(node, game.npcs?.list);
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
          {portrait ? <div className="dlg-portrait" style={{ backgroundImage: `url(${portrait})` }} /> : node.look ? <Bust look={node.look} /> : <div className="dlg-seal">{node.speaker.slice(0, 1)}</div>}
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
              <ItemGlyph id={d.id} className="glyph" style={{ color: TIER_COLOR[d.tier] }} />
              <div className="sr-main"><div className="sr-name" style={{ color: TIER_COLOR[d.tier] }}>{d.name}{s.age !== undefined && <small> {s.age}年</small>}<small className="sr-type">{TYPE_NAME[d.type]}</small></div><div className="sr-desc">{d.desc}</div></div>
              <div className="sr-buy"><div className="sr-price">{s.price} {unit}</div><small>余 {s.n}</small>
                <button className="ink-btn small" disabled={money < s.price} onClick={() => { if (game.towns.buy(shop, s)) audio.sfx('chime'); re(); }}>购买</button></div>
            </div>
          );
        })}
        {mode === 'buy' && !shop.stock.length && <div className="hint">货架已空。</div>}
        {mode === 'sell' && sellable.map((b, i) => {
          const d = itemDef(b.id);
          const p = game.towns.sellPrice(shop, b.id, b.age ?? 0);
          return (
            <div key={b.id + i + (b.age ?? '')} className="shop-row">
              <ItemGlyph id={d.id} className="glyph" style={{ color: TIER_COLOR[d.tier] }} />
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
function TownPanel({ game, loc, fac }: { game: Game; loc: LocDef; fac?: string }) {
  const [, force] = useState(0); const re = () => force((x) => x + 1);
  const [tp, setTp] = useState(fac === 'teleport');
  const T = game.towns, h = game.hero;
  const occupied = T.occupied(loc);
  const isSect = loc.type === 'sect';
  const big = loc.type === 'city' || loc.type === 'isle' || loc.id === 'tainan';
  type F = { seal: string; name: string; desc: string; act: () => void; dis?: string; cls?: string; key?: string };
  const fs: F[] = [];
  if (isSect) fs.push({ seal: '宗', name: game.ws.sect?.id === loc.id ? '宗门事务' : '山门', desc: game.ws.sect?.id === loc.id ? `${SECT_RANKS[game.ws.sect.rank]} · 贡献 ${game.ws.sect.contrib}　任务、藏经阁、俸禄、晋升` : '拜入宗门，领取俸禄与任务', act: () => game.openDialog(T.sectNode(loc)), cls: 'gold' });
  if (!occupied) {
    fs.push({ seal: '市', name: '坊市', desc: '灵草、材料、符箓杂货', act: () => game.openShop(T.shop(loc, 'market')) });
    fs.push({ seal: '丹', name: '丹药铺', desc: '聚气丹、疗伤丹……货随产地（天南筑基丹归七派把持）', act: () => game.openShop(T.shop(loc, 'pill')) });
    if (big || isSect) fs.push({ seal: '器', name: '法器阁', desc: '飞剑、法盾、成套法器', act: () => game.openShop(T.shop(loc, 'artifact')) });
    if (big || isSect) fs.push({ seal: '符', name: '符箓斋', desc: '符箓与法术玉简', act: () => game.openShop(T.shop(loc, 'talisman')) });
  }
  if (!isSect) fs.push({ seal: '酒', name: '酒楼', desc: '打听消息、传闻、秘境下落', act: () => game.openDialog(T.tavern(loc)) });
  if (!isSect || big) fs.push({ seal: '赏', name: '悬赏榜', desc: `缉拿凶徒、斩除妖兽，赏金由坊市担保（已接 ${(game.ws.bounties ?? []).filter((b) => !b.done && b.until > game.day).length}/3）`, act: () => game.openDialog(game.happen.boardNode(loc.id, loc.name)) });
  fs.push({ seal: '栈', name: isSect ? '洞府' : '客栈', desc: isSect ? '歇息一夜，自动存档' : `住店一晚（${loc.type === 'city' ? 5 : 2} 灵石），气血法力尽复，自动存档`, act: () => { T.rest(loc); re(); } });
  if (T.hasTeleport(loc)) fs.push({ seal: '阵', name: '传送阵', desc: `已激活 ${game.ws.tp.length} 处，按路程收取灵石`, act: () => setTp(!tp) });
  if (T.isMajorTown(loc)) { const open = T.auctionOpen(loc); const d = Math.floor(game.day) % 90; fs.push({ seal: '拍', name: '拍卖会', desc: open ? `正在举行（还剩 ${90 - d} 日）` : `每季末举行，${80 - d} 日后开拍`, act: () => game.openModal({ kind: 'auction', loc }), dis: open ? undefined : '尚未开拍', cls: open ? 'gold' : '' }); }
  { const ob = game.happen.obtain.facility(loc.id); if (ob) fs.push({ seal: '客', name: ob.name, desc: ob.desc, act: () => game.openDialog(game.happen.obtain.node()), cls: 'gold' }); }
  for (const b of BEAUTIES) if (b.home === loc.id) { const s = game.ws.hearts[b.id]; const n = game.npcs.byId.get('b_' + b.id); if (n?.alive && (n.map ?? 'tiannan') === loc.map && Math.hypot(n.x - loc.x * 300, n.y - loc.y * 300) < 8000) fs.push({ seal: '缘', name: s?.met ? `拜访${b.name}` : '传闻中的仙子', desc: s?.met ? b.title : '听说此地住着一位女修……', act: () => game.hearts.talk(b.id), cls: 'love' }); }
  const SEAL_KEY: Record<string, string> = { 宗: 'sect', 市: 'market', 丹: 'pill', 器: 'artifact', 符: 'talisman', 酒: 'tavern', 赏: 'board', 栈: 'rest', 阵: 'teleport', 拍: 'auction' };
  for (const f of fs) f.key = SEAL_KEY[f.seal];
  // 第二十二步：从铺子门口进来——直接办事（铺子不开时，仍显示城镇总览）
  const facDone = useRef(false);
  useEffect(() => {
    if (!fac || facDone.current || fac === 'teleport') return;
    facDone.current = true;
    const f = fs.find((x) => x.key === fac);
    if (f && !f.dis) { f.act(); if (fac === 'rest') game.closeModal(); }
    else if (!f) game.toast(occupied ? '铺门紧闭，此地已被魔道占据。' : '此处暂不营业。', 'warn');
    else game.toast(f.dis!, 'warn');
  }, []);
  const tps = game.ws.tp.map((id) => locHere(id)!).filter((l) => l && l.id !== loc.id);   // 只列本图的传送阵
  return (
    <Scroll title={loc.name} sub={<span>【{TIER_NAME[cityTier(loc)]}】{(() => { const [y, j] = game.garrison.count(loc); return y + j ? `坐镇：元婴 ${y} · 结丹 ${j}　` : ''; })()}{loc.desc}　·　灵石 <b>{C.bagCount(h, 'mat_lingshi')}</b>　·　{repName(game.ws.rep)}</span>} onClose={() => game.closeModal()} wide cls="town-panel">
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
type Lot = AuctionLot;
function AuctionPanel({ game, loc }: { game: Game; loc: LocDef }) {
  const key = `auc_${loc.id}_${Math.floor(game.day / 90)}`;
  const [lots, setLots] = useState<Lot[]>(() => (game as any)[key] ?? ((game as any)[key] = game.towns.auctionLots(loc)));
  const [cur, setCur] = useState(() => Math.max(0, lots.findIndex((l) => !l.done)));
  const [log, setLog] = useState<string[]>(['拍卖师敲响铜锣：「诸位道友，拍卖会正式开始！」']);
  const [lead, setLead] = useState<'me' | string | null>(null);
  const h = game.hero, money = C.bagCount(h, 'mat_lingshi');
  const BIDDERS = game.towns.auctionBidders(loc);
  const lot = lots[cur];
  const upd = (l: Lot) => { const nl = lots.slice(); nl[cur] = l; (game as any)[key] = nl; setLots(nl); };
  const npcBid = (l: Lot): string | null => {
    const r = l.price / l.base;
    const p = Math.max(0, 1.25 - r * 0.45) * (itemDef(l.id).id === 'pill_zhuji' ? 1.3 : 1) * (l.top ? 1.3 : 1);   // 第四十步：压轴之物争的人更多
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
    else { lines.push('全场寂静……拍卖师连喊三声，一锤定音！'); C.removeItem(h, 'mat_lingshi', np); C.addItem(h, l2.id, 1, l2.age); l2.done = 'won'; audio.sfx('chime'); setLead('me'); game.toast(`拍得 ${itemDef(l2.id).name}`, 'good'); if (Math.random() < 0.3 && itemDef(l2.id).price > 3000) { lines.push('（你察觉到有几道神识在你身上停留了片刻……出城时小心些。）'); game.ws.flags.auctionMark = game.day; } }
    upd(l2); setLog((x) => [...x.slice(-8), ...lines]);
  };
  const pass = () => {
    if (!lot || lot.done) return;
    const who = lead && lead !== 'me' ? lead : BIDDERS[Math.floor(Math.random() * BIDDERS.length)];
    upd({ ...lot, done: 'lost', who }); setLog((x) => [...x.slice(-8), `${itemDef(lot.id).name}被${who}以 ${lot.price} 灵石拍走。`]);
  };
  const next = () => { const i = lots.findIndex((l, j) => j > cur && !l.done); if (i >= 0) { setCur(i); setLead(null); setLog((x) => [...x.slice(-8), `下一件拍品：${itemDef(lots[i].id).name}，底价 ${lots[i].base} 灵石。`]); } };
  return (
    <Scroll title={game.towns.auctionNote(loc)} sub={<span>{loc.name}（{TIER_NAME[cityTier(loc)]}）　·　灵石 <b>{money}</b></span>} onClose={() => game.closeModal()} wide>
      <div className="auc">
        <div className="auc-lots">
          {lots.map((l, i) => { const d = itemDef(l.id); return (
            <button key={i} className={'auc-lot' + (i === cur ? ' on' : '') + (l.done ? ' ' + l.done : '')} onClick={() => { if (!l.done) { setCur(i); setLead(null); } }}>
              <ItemGlyph id={d.id} className="glyph" style={{ color: TIER_COLOR[d.tier] }} /><span>{l.top ? '【压轴】' : ''}{d.name}{l.age ? `（${l.age}年）` : ''}</span><small>{l.done === 'won' ? '已拍得' : l.done === 'lost' ? `归${l.who}` : `底价 ${l.base}`}</small>
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
              {(game.ws.letters ?? []).some((l) => l.from === b.id && !l.read) && <div className="hc-mail">信</div>}
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
            {met && <div className="hd-bonus">同行加成：{cur.b.bonus.text}{game.heartx.keepBonus(cur.b.id) > 1 ? '（香囊随身 ×1.5）' : ''}</div>}
            {met && (() => { const f: any = cur.s!.flags; const mem = Object.keys(f.mem ?? {}).length; const keeps = [40, 60, 80].filter((k) => f['k' + k]).length; return <div className="hd-mem">共同回忆 {mem}/8　·　信物 {keeps}/3{f.lastDual ? '　·　曾共修' : ''}</div>; })()}
            {met && (() => { const ls = (game.ws.letters ?? []).filter((l) => l.from === cur.b.id).slice(-6).reverse(); if (!ls.length) return null; return (
              <div className="hd-letters">
                <div className="hd-lt-title">传音符 · 书信</div>
                {ls.map((l) => (
                  <button key={l.id} className={'hd-letter' + (l.read ? '' : ' unread')} onClick={() => { click(); game.openDialog(game.heartx.letterNode(l)); }}>
                    <span className="hl-kind">{({ chat: '闲书', req: '托付', sos: '求援', fest: '节信', jealous: '醋意', gift: '寄物' } as any)[l.kind] ?? '书'}</span>
                    <span className="hl-text">{l.text.replace(/\n/g, ' ').slice(0, 26)}…</span>
                    <span className="hl-day">第{Math.floor(l.day / 360) + 1}年{Math.floor((l.day % 360) / 30) + 1}月</span>
                  </button>
                ))}
              </div>
            ); })()}
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

// ---------------------------------------------------------------- 第二十九步：人脉录
const FACTION_NAME: Record<string, string> = { sect: '宗门', rogue: '散修', demon: '魔道', mortal: '凡人', merchant: '行商' };
const BOND_TEXT: Record<string, string> = { sworn: '义结金兰', master: '授业恩师', disciple: '座下弟子', companion: '结伴同行', guard: '雇佣护法' };
function RelationsPanel({ game }: { game: Game }) {
  const [, force] = useState(0); const re = () => force((x) => x + 1);
  const R = game.rel, S = R.S;
  const [tab, setTab] = useState<'friend' | 'foe' | 'sect' | 'log'>(() => R.hunters().length ? 'foe' : 'friend');
  const known = R.known();
  const friends = known.filter((d) => d.alive && !d.grudge && d.favor > -15 && !d.beauty).sort((a, b) => (+!!b.bond - +!!a.bond) || b.favor - a.favor);
  const foes = known.filter((d) => d.alive && (d.grudge || d.favor <= -15 || d.hunting)).sort((a, b) => (+!!b.hunting - +!!a.hunting) || (b.grudge - a.grudge) || a.favor - b.favor);
  const dead = known.filter((d) => !d.alive && (d.bond || d.favor >= 30 || d.grudge)).slice(-12);
  const list = tab === 'friend' ? friends : tab === 'foe' ? foes : [];
  const [sel, setSel] = useState<string | null>(null);
  const [openSect, setOpenSect] = useState<string | null>(null);
  const cur: NpcData | undefined = (sel ? game.npcs.byId.get(sel) : undefined) ?? list[0];
  // 第三十五步：宗门名册——所有宗门（有门人在册的）按同盟分组，附声望、门人、你杀过几人、原著人物
  const sectIds = new Set<string>(Object.keys(S.sect));
  for (const d of game.npcs.list) if (d.sect && LOC_BY_ID.get(d.sect)) sectIds.add(d.sect);
  for (const sd of SECT_DEFS) if (LOC_BY_ID.get(sd.id)) sectIds.add(sd.id);
  const groupOf = (id: string) => allyGroup(id)?.name ?? '';
  const sects = [...sectIds].map((id) => [id, S.sect[id] ?? 0] as [string, number])
    .sort((a, b) => (SECT_ALLY.findIndex((g) => g.ids.includes(a[0])) + 1 || 99) - (SECT_ALLY.findIndex((g) => g.ids.includes(b[0])) + 1 || 99) || a[1] - b[1]);
  const mySect = game.ws.sect?.id;
  const huntN = R.hunters().filter((d) => d.hunting).length;
  const sub = <span>声望 {repName(game.ws.rep)}（{game.ws.rep}）　·　亲友 {friends.length}　·　仇敌 {foes.length}{huntN ? <b style={{ color: '#c0302a' }}>　·　{huntN} 人正在追杀你</b> : null}{R.wantedTotal() ? <b style={{ color: '#a8352a' }}>　·　悬赏 {R.wantedTotal()} 灵石</b> : null}</span>;
  const Chip = ({ d }: { d: NpcData }) => { const t = R.tier(d) as Tier; return <span className="rel-chip" style={{ background: REL_COLOR[t] }}>{t}</span>; };
  const row = (d: NpcData) => (
    <button key={d.id} className={'rel-row' + (cur?.id === d.id ? ' on' : '') + (d.hunting ? ' hunt' : '')} onClick={() => { click(); setSel(d.id); }}>
      <Chip d={d} /><b>{d.name}</b><span className="rel-realm">{d.realm ? realmName(d.realm, d.stage) : '凡人'}</span>
      <span className="rel-where">{d.hunting ? '正循迹而来' : R.locName(d.home)}</span>
    </button>
  );
  return (
    <Scroll title="人脉录" sub={sub} onClose={() => game.closeModal()} wide cls="rel-panel">
      <div className="rel-tabs">
        {([['friend', `亲友 ${friends.length}`], ['foe', `仇敌 ${foes.length}`], ['sect', '宗门'], ['log', '江湖恩怨']] as const).map(([k, l]) => <button key={k} className={'rel-tab' + (tab === k ? ' on' : '') + (k === 'foe' && huntN ? ' alarm' : '')} onClick={() => { click(); setTab(k); setSel(null); }}>{l}</button>)}
      </div>
      {(tab === 'friend' || tab === 'foe') && (
        <div className="rel-body">
          <div className="rel-list">
            {list.length === 0 && <div className="hint">{tab === 'friend' ? '尚无相熟之人。与人交谈、赠礼、论道、并肩御敌，都能结下交情。' : '眼下没有仇家——愿你一直这样走下去。'}</div>}
            {list.map(row)}
            {tab === 'friend' && dead.length > 0 && <div className="rel-dead"><div className="sec-title">故人</div>{dead.map((d) => <div key={d.id} className="rel-gone">{d.name}<small>{d.deathNote ?? '已故'}</small></div>)}</div>}
          </div>
          {cur && (() => {
            const t = R.tier(cur) as Tier, ties = R.tiesText(cur);
            const sectN = cur.sect ? LOC_BY_ID.get(cur.sect)?.name : '';
            return (
              <div className="rel-detail">
                <div className="rel-bust"><Bust look={(game.npcs as any).look(cur)} /></div>
                <div className="rel-info">
                  <div className="hd-name">{cur.name}<small>{cur.title ?? ''}</small></div>
                  <div className="hd-sub">{cur.realm ? realmName(cur.realm, cur.stage) : '凡人'} · {sectN || FACTION_NAME[cur.faction]} · {PERS_NAME[cur.pers]} · <span style={{ color: REL_COLOR[t] }}>{t}</span></div>
                  <div className="favor"><div className="favor-bar"><i style={{ width: `${(cur.favor + 100) / 2}%`, background: cur.favor >= 0 ? 'linear-gradient(90deg,#9fd08a,#3f9a5a)' : 'linear-gradient(90deg,#d88a5a,#b8302a)' }} /></div><span>好感 {Math.round(cur.favor)}</span></div>
                  {cur.bond && <div className="rel-bond">◈ {BOND_TEXT[cur.bond]}{cur.bondUntil && (cur.bond === 'companion' || cur.bond === 'guard') ? `（余 ${Math.max(0, Math.ceil(cur.bondUntil - game.day))} 日）` : ''}</div>}
                  {cur.why && (cur.grudge > 0 || cur.hunting) && <div className="rel-why">✕ {cur.grudge >= 2 ? '血仇' : cur.hunting ? '追杀' : '旧怨'}：{cur.why}</div>}
                  {cur.vow && <div className="rel-bond">◈ 已对你立下心魔誓，此生不与你为敌</div>}
                  {cur.oath && <div className="rel-why">◈ 你曾对此人立誓：若伤其或其亲族，心魔反噬</div>}
                  <div className="rel-ties">
                    <div className="hd-lt-title">人脉（{ties.length}）{ties.some((x) => x.k !== 'foe') ? <small>　杀了{cur.sex === 'f' ? '她' : '他'}，这些人会记恨你</small> : null}</div>
                    {ties.length === 0 && <div className="hint">孑然一身。</div>}
                    {ties.map(({ o, r, k }) => { const ot = R.tier(o) as Tier; return (
                      <button key={o.id} className={'rel-tie ' + k + (o.alive ? '' : ' gone')} onClick={() => { if (R.known().includes(o)) { click(); setSel(o.id); if (o.grudge || o.favor <= -15) setTab('foe'); else setTab('friend'); } }}>
                        <span className="rt-r">{r}</span><b>{o.met || o.alive === false ? o.name : o.name}</b>
                        <small>{!o.alive ? '已故' : o.met || o.grudge ? ot : '未曾谋面'}</small>
                      </button>
                    ); })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {tab === 'sect' && (
        <div className="rel-sects">
          <div className="hint">宗门声望由你对其门人的所作所为累积。跌破 {SECT_HOSTILE}，门人见你便动手；跌破 {SECT_SIEGE}，执法堂派人围剿；跌破 {SECT_ELDER}，门中长老亲自出手。杀一派门人，同盟诸派也记一半的账。点宗门名可展开名册。</div>
          {sects.map(([id, v], i) => {
            const mem = game.npcs.list.filter((d) => d.sect === id);
            const alive = mem.filter((d) => d.alive), named = mem.filter((d) => d.canon).sort((a, b) => b.realm - a.realm || b.stage - a.stage);
            const kills = S.killed?.[id] ?? 0, grp = groupOf(id), prevGrp = i ? groupOf(sects[i - 1][0]) : null;
            const top = alive.reduce((m, d) => Math.max(m, d.realm), 0);
            return (
              <div key={id}>
                {grp !== prevGrp && <div className="sec-title" style={{ marginTop: i ? 10 : 2 }}>{grp || '其余宗门'}</div>}
                <div className="rel-sect" style={{ cursor: 'pointer' }} onClick={() => { click(); setOpenSect(openSect === id ? null : id); }}>
                  <b>{openSect === id ? '▾ ' : '▸ '}{sectTitle(id)}{SECT_DEF.has(id) ? <small style={{ fontWeight: 400 }}>　{game.roster.aliveCount(id)}人</small> : null}{id === mySect ? <small>（本门）</small> : null}</b>
                  <div className="favor-bar"><i style={{ width: `${(v + 100) / 2}%`, background: v >= 0 ? 'linear-gradient(90deg,#9fd08a,#3f9a5a)' : 'linear-gradient(90deg,#d88a5a,#b8302a)' }} /></div>
                  <span style={{ color: v <= SECT_SIEGE ? '#c0302a' : v <= SECT_HOSTILE ? '#d06a3a' : v >= 30 ? '#3f9a5a' : '#7a6a58' }}>{v <= SECT_ELDER ? '长老出手' : v <= SECT_SIEGE ? '围剿' : v <= SECT_HOSTILE ? '敌视' : v <= -15 ? '冷淡' : v >= 30 ? '友善' : '中立'} {Math.round(v)}</span>
                </div>
                {openSect === id && (
                  <div className="rel-roster" style={{ padding: '4px 10px 10px 22px', fontSize: 13, lineHeight: 1.7, color: '#4a3f34' }}>
                    {SECT_DEF.has(id) ? (() => { const sm = game.roster.summary(id); return (<>
                      <div>名册 {game.roster.aliveCount(id)} / {SECT_DEF.get(id)!.n} 人　·　{RANKS.filter((r) => sm[r].n).map((r) => `${r} ${sm[r].alive}`).join(' · ')}{kills ? <b style={{ color: '#a8352a' }}>　·　死于你手 {kills} 人</b> : null}</div>
                      {game.roster.leaders(id).map((m) => (
                        <div key={m.i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', opacity: m.dead ? 0.45 : 1 }}>
                          <b style={{ fontWeight: 400, minWidth: 64 }}>{m.name}</b><small style={{ minWidth: 96 }}>{m.rank}</small>
                          <span style={{ minWidth: 64 }}>{m.realmText}</span><span style={{ color: '#7a6a58' }}>{m.dead ? '已故' : ''}</span>
                        </div>))}
                    </>); })() : <div>门人在册 {alive.length} 人{top ? `（最高 ${REALMS[top].name}）` : ''}{mem.length - alive.length ? `　·　已故 ${mem.length - alive.length}` : ''}{kills ? <b style={{ color: '#a8352a' }}>　·　死于你手 {kills} 人</b> : null}</div>}
                    {named.map((d) => { const t = R.tier(d) as Tier; return (
                      <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', opacity: d.alive ? 1 : 0.45 }}>
                        <b style={{ fontWeight: 400, minWidth: 64 }}>{d.name}</b><small style={{ minWidth: 96 }}>{d.title ?? ''}</small>
                        <span style={{ minWidth: 64 }}>{d.realm ? realmName(d.realm, d.stage) : '凡人'}</span>
                        <span style={{ color: d.alive ? REL_COLOR[t] : '#7a6a58' }}>{d.alive ? (d.met ? t : '未曾谋面') : '已故'}</span>
                      </div>
                    ); })}
                    {!named.length && !SECT_DEF.has(id) && <div className="hint">名册上多是无名弟子。</div>}
                  </div>
                )}
              </div>
            );
          })}
          {S.wanted.length > 0 && <><div className="sec-title" style={{ marginTop: 14 }}>悬赏榜</div>{S.wanted.map((w, i) => <div key={i} className="rel-wanted"><b>{w.amount} 灵石</b>　{w.name}悬赏：{w.reason}<small>第{Math.floor(w.day / 360) + 1}年</small></div>)}</>}
        </div>
      )}
      {tab === 'log' && (
        <div className="rel-log">
          {S.log.length === 0 && <div className="hint">江湖平静。</div>}
          {S.log.slice().reverse().map((l, i) => <div key={i} className={'news ' + (l.kind === 'bad' ? 'canon' : l.kind === 'good' ? 'personal' : '')}><span>第{Math.floor(l.day / 360) + 1}年{Math.floor((l.day % 360) / 30) + 1}月</span>{l.text}</div>)}
        </div>
      )}
      <div className="hint" style={{ marginTop: 8 }}>与仇人狭路相逢时可赔礼、立誓或请人说和；把人打到半死，对方可能求饶。　·　<span onClick={re} style={{ cursor: 'pointer' }}>↻</span></div>
    </Scroll>
  );
}

// ---------------------------------------------------------------- 大事记
function ChroniclePanel({ game }: { game: Game }) {
  const ev = game.events.chronicle();
  const news = game.ws.news.slice().reverse().slice(0, 60);
  const s = game.ws.sect;
  const year = Math.floor(game.day / 360) + 1;
  const ch = game.chances();
  return (
    <Scroll title="大事记 · 机缘录" sub={<span>第{year}年　·　{repName(game.ws.rep)}（{game.ws.rep}）　·　{s ? `${LOC_BY_ID.get(s.id)?.name} ${SECT_RANKS[s.rank]}` : '散修'}</span>} onClose={() => game.closeModal()} wide>
      <div className="chron chron3">
        <div className="chron-col">
          <div className="sec-title">眼下机缘<small>能做、值得做的事</small></div>
          {ch.map((c, i) => (
            <div key={i} className={'chance' + (c.hot ? ' hot' : '') + (c.tone ? ' ' + c.tone : '')}>
              <div className="cc-head"><b>{c.t}</b>{c.x !== undefined && c.y !== undefined && <button className="cc-go" onClick={() => { audio.sfx('chime'); game.setGuide(c.x!, c.y!, c.t.trim()); game.closeModal(); }}>指路</button>}</div>
              <div className="cc-desc">{c.d}</div>
            </div>
          ))}
          <div className="hint">闭关 30 日以上，出关时必有访客：宗门传讯、故交赠礼或散修报信。</div>
        </div>
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
export const VERSION = 'v0.40 · 天下名城';
function HelpPanel({ game }: { game: Game }) {
  const [tab, setTab] = useState(0);
  const T = ['操作', '修炼', '战斗', '人界', '神识', '机缘'];
  const body = [
    <div className="keys" key={0}>
      <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键 / 点击地面 移动　·　<kbd>Shift</kbd> 疾行　·　<kbd>空格</kbd> 闪避（无敌帧，躲开红色预警）<br />
      <kbd>T</kbd> 交谈 / 查看奇遇　·　<kbd>G</kbd> 进城 / 入宗门　·　<kbd>H</kbd> 红颜录　·　<kbd>N</kbd> 人脉录　·　<kbd>J</kbd> 大事记<br />
      <kbd>Z</kbd> 打坐　·　<kbd>E</kbd> 采集　·　<kbd>C</kbd> 角色 / 冲关　·　<kbd>B</kbd> 储物袋　·　<kbd>L</kbd> 丹房　·　<kbd>P</kbd> 闭关<br />
      <kbd>1</kbd>–<kbd>9</kbd> 施法　·　<kbd>K</kbd> 法术书　·　<kbd>Q</kbd> 神识外放　·　<kbd>R</kbd> 敛息<br />
      <kbd>Y</kbd> 回洞府（需回府符）　·　<kbd>U</kbd> 灵宠　·　<kbd>T</kbd> 也用于机缘、悬赏、灵宠、洞府<br />
      <kbd>M</kbd> 世界地图　·　滚轮 / <kbd>+</kbd><kbd>-</kbd> 缩放　·　<kbd>?</kbd> 本帮助　·　<kbd>Esc</kbd> 关闭 / 设置<br />
      对话中可按数字键选择选项，空格跳过打字效果。<br />
      左上角目标卷轴显示主线目标与方向，<b>点击即可自动前往</b>；任务人物头顶有“！”。<br />
      手机：左下摇杆移动，右下 3×3 法诀盘施法，双指缩放；交谈、进城等以屏幕按钮操作。
    </div>,
    <div className="hd-intro" key={1}>打坐（Z）时光阴 ×4，修为随灵根、功法、所在地灵气增长。修为满后遇小瓶颈需服丹冲关，大境界圆满后在角色面板冲击下一境界（筑基需筑基丹）。<br />掌天瓶（开局即在身上）每七日凝一滴绿液，可将灵草催熟百年。高年份灵草提高炼丹成功率。<br />闭关（P）可一次度过数月至十年，但人界大事不会等你。</div>,
    <div className="hd-intro" key={2}>9 格快捷栏，法术、法器与<b>符箓</b>任意摆放（符箓一次性消耗，栏位显示剩余张数，对高境界衰减较少）。法术分凡 / 黄 / 玄 / 地 / 天五品，熟练度初学 → 圆满会改变形态。<br />异状连携：冰冻 + 雷、定身 + 火、燃烧 + 风、中毒 + 火……<br />倒下不会坐化：损失一成修为与少量物品，在最近城镇醒来。越阶挑战九死一生，名牌颜色提示强弱。剧情战倒下不受惩罚，可直接重来。</div>,
    <div className="hd-intro" key={3}>人界约 450 人各有境界、宗门、性格与目标，会修炼、衰老、陨落，也会彼此斗法——你可以旁观、相助或捡漏。劫修专挑弱者下手，声望决定正魔两道对你的态度。<br />城镇：坊市、丹药铺、法器阁、符箓斋、酒楼、客栈、传送阵、拍卖会。宗门：俸禄、任务、藏经阁、晋升。<br />红颜八位，各有故事线；结为道侣后可同行助战。<br />原著大事件按年份发生（升仙大会、血色禁地、燕家堡、魔道入侵、虚天殿、坠魔谷），提前一年在酒楼与大事记中传闻。</div>,
    <div className="hd-intro" key={4}>只有神识圈内的东西才是“真实”的——圈外是褪色的记忆水墨，看不到任何动静。奇遇、敌人、行人都要靠神识发现。<br />神识随境界与功法增长；大衍决、养魂木等会改变神识的样貌与范围。Q 外放神识（范围 ×2，持续消耗法力，再按 Q 收回），R 敛息（范围缩小，但不易被更强者察觉）。<br />被更强的神识扫过时，圈边泛红、画面轻震——那意味着有人注意到你了。<br /><br /><b>遁术</b>：飞行中按住 Shift 催动遁光（持续耗法力，期间不回蓝），越飞越高、视野越开阔。风雷翅可施雷遁，血色披风可化血光遁。<br /><b>追杀</b>：身怀重宝、拍得宝物、斩杀魔修、夺得遗府后，可能被高一境界的修士以神识锁定追杀——硬拼九死一生。拉开距离出其锁定范围、遁地符 / 血遁隐去身形、敛息，或逃入宗门坊市，皆可脱身。顶部横幅显示锁定状态，屏幕边缘箭头指示追兵方位。<br /><br /><b>投放距离</b>：功法、法器、符箓最远只能打到神识范围的八成（外放神识时为外放范围的七成）——神识越强，出手越远。<br /><b>妖兽</b>：按原著分一至十级——一级相当炼气（再分下 / 中 / 上 / 顶阶），二至四级相当筑基，五至七级相当结丹，八至十级是已化形的大妖。五级以上周身缭绕妖气。双瞳鼠、阴芝马擅隐匿，需神识贴近或外放才能发现；土甲龙见人便逃，重伤时会土遁；云翅鸟会尖啸示警，引来附近妖兽。毒蛟、六翼霜蚣、风希等妖王只在固定巢穴出没，斩杀后三年才有新妖王占据。<br /><b>妖丹与炼器</b>：妖兽有一定几率留下同级妖丹（五级以上必有），妖丹会自行飞入怀中。右侧“丹器”按钮打开的丹房新增“炼器”页：以墨蛟鳍炼神风舟、墨蛟爪炼乌龙夺、雷鹏骨翅加金雷竹炼风雷翅……在城镇或宗门借地火更稳，野外炼器成器率大减。</div>,
    <div className="hd-intro" key={5}><b>机缘：</b>神识扫过山野，会显出灵草王、修士遗骸、古修洞府、兽巢、灵脉、古碑、山神庙、灵池、古战场——走近按 T。守药妖兽若在熟睡，偷袭伤害 ×2.5；敛息潜近更稳妥。古修洞府有三重禁制，可强破、神识寻隙或用破禁符。<br /><b>洞府：</b>在灵脉上开辟洞府，种药园、布禁制，打坐灵气加成；坊市卖回府符（Y）。<br /><b>灵宠：</b>兽巢偷来的灵卵会自动温养，破壳后随你出战、喂妖丹成长（U）。<br /><b>红颜：</b>相熟之后会寄来传音符——闲话、托付、节日相约，偶尔是求援。好感到 40/60/80 会赠你信物；可约她同游（去处随时辰、天气、地形变化，共八种回忆），道侣好感 80 可在灵脉或洞府双修。<br /><b>心魔劫：</b>结丹、结婴前会入幻境，幻境由你一路的经历生成，心境稳则成功率上升。</div>,
  ];
  return (
    <Scroll title="修仙指南" sub={<span>{VERSION}</span>} onClose={() => game.closeModal()} wide>
      <div className="tabs">{T.map((t, i) => <button key={i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t}</button>)}</div>
      {body[tab]}
    </Scroll>
  );
}
