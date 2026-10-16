// 第十八步：洞府 —— 自己的落脚之处
// - 只能开在小灵脉上；一局一座（可迁居，药园随迁）
// - 药园：种下一株灵药，随光阴生长（约每日 0.2 年 × 灵脉品质），收获时一化三；掌天瓶绿液可整畦催熟百年
// - 禁制：没有禁制时离家久了会遭贼；布阵后可防贼、聚灵
// - 打坐/闭关有灵脉加成；回府符（Y）可遁回
import type { Game } from './game';
import { ACTIVE_MAP } from '../data/world';
import * as C from './cultivation';
import { BOTTLE_YEARS } from './cultivation';
import { itemDef } from '../data/items';
import type { DNode, DOpt } from './modal';
import type { HomeState, Plot } from './worldstate';
import { HERB_COL, dirName, pickArt, type Site } from './sites';
import { Enemy } from './combat';
import { ENEMIES } from '../data/enemies';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const GROW = 0.2;   // 年 / 日
const ARRAY_NAME = ['（无）', '迷踪阵', '颠倒五行阵', '聚灵大阵'];
const ARRAY_COST = [0, 400, 2000, 8000];
const ARRAY_REALM = [0, 1, 2, 3];
const PLOT_STEPS = [4, 6, 9];
const PLOT_COST = [0, 800, 3000];
const HOME_NAMES = ['青竹', '听涛', '栖霞', '寒烟', '抱朴', '松风', '观云', '洗心', '藏锋', '半山'];

export class HomeSys {
  game: Game;
  focus = false; focusD = 1e9;
  private chkT = 0;
  constructor(g: Game) { this.game = g; }
  get h(): HomeState | null { return this.game.ws.home; }
  here(): boolean { const h = this.h; return !!h && h.map === ACTIVE_MAP; }
  q(): number { const h = this.h; if (!h) return 1; return (h as any).q ?? 1.4; }

  create(s: Site, move = false) {
    const g = this.game, ws = g.ws;
    const old = ws.home;
    const name = (old?.name) ?? HOME_NAMES[s.seed % HOME_NAMES.length] + '洞府';
    const plots: Plot[] = old ? old.plots : Array.from({ length: 4 }, () => ({ herb: null, age: 0, n: 0, day: 0 }));
    ws.home = { map: ACTIVE_MAP, x: s.x, y: s.y, key: s.key, name, plots, array: old ? Math.min(old.array, 1) : 0, built: g.day } as HomeState;
    (ws.home as any).q = g.sites.veinQ(s);
    (ws.home as any).chk = g.day;
    g.news(move ? `韩立迁居，于新寻得的灵脉上重开${name}。` : `韩立在一条小灵脉上开辟了洞府——${name}。`, 'personal');
    g.openDialog({ speaker: name, title: move ? '迁居' : '开府', mood: 'mystic', text: `${move ? '你将药园连土带根收入储物袋，在新的灵脉上重新布置。（旧禁制无法搬迁，降为一阶）' : '你以法器凿开山壁，辟出一间石室，又在门前圈出一片药园，布下简易的隐匿禁制。'}\n\n从此在这世上，你有了一个可以回来的地方。\n\n· 药园：种下灵药，随光阴生长（打坐时光阴更快）\n· 禁制：防贼、聚灵\n· 在洞府内打坐/闭关，灵气 ×${this.q().toFixed(1)}\n· 坊市可购「回府符」，按 Y 遁回`, options: [{ label: '进去看看', act: () => this.mainNode() }] });
  }
  plotAge(p: Plot): number { return p.herb ? Math.floor(p.age + Math.max(0, this.game.day - p.day) * GROW * this.q()) : 0; }

  update(dt: number) {
    const g = this.game, h = this.h, P = g.player;
    this.focus = false; this.focusD = 1e9;
    if (!h || h.map !== ACTIVE_MAP) return;
    const d = Math.hypot(h.x - 30 - P.x, h.y - 60 - P.y);
    if (d < 230) { this.focus = true; this.focusD = d; }
    this.chkT -= dt; if (this.chkT > 0) return; this.chkT = 1;
    // 遭贼：离家（>4000）时按天数掷骰；回到附近时结算
    const far = Math.hypot(h.x - P.x, h.y - P.y) > 4000;
    const hx = h as any;
    if (far) return;
    const days = g.day - (hx.chk ?? g.day); hx.chk = g.day;
    if (days < 3) return;
    const pDay = h.array >= 2 ? 0 : h.array === 1 ? 0.0012 : 0.003;
    const pTheft = 1 - Math.pow(1 - pDay, days);
    const full = h.plots.map((p0, i) => ({ p0, i })).filter((x) => x.p0.herb);
    if (full.length && Math.random() < pTheft) {
      const v = full.sort((a, b) => this.plotAge(b.p0) * itemDef(b.p0.herb!).price - this.plotAge(a.p0) * itemDef(a.p0.herb!).price)[0];
      const nm = itemDef(v.p0.herb!).name, age = this.plotAge(v.p0);
      h.plots[v.i] = { herb: null, age: 0, n: 0, day: 0 };
      h.robbed = g.day;
      g.toast(`${h.name}遭了贼！药园里那畦${age}年的${nm}被连根拔走……（布下禁制可防）`, 'warn');
      g.news(`有人趁韩立外出，潜入${h.name}盗走了灵药。`, 'personal');
    } else if (h.array >= 2 && days > 60 && Math.random() < 0.18) {
      const e = new Enemy(ENEMIES.bandit, h.x + 160, h.y + 40, Math.max(1, g.hero.realm - 1), 3);
      e.name = '被禁制困住的小贼'; e.hx = e.x; e.hy = e.y; e.st.root = { t: 30 } as any;
      g.combat.enemies.push(e);
      g.toast(`${ARRAY_NAME[h.array]}困住了一个想偷药的小贼！`, 'good');
    }
  }

  interact(): boolean { if (!this.here()) return false; this.game.openDialog(this.mainNode()); return true; }
  mainNode(): DNode {
    const g = this.game, h = this.h!, hero = g.hero;
    const grown = h.plots.filter((p) => p.herb).map((p) => `${itemDef(p.herb!).name}·${this.plotAge(p)}年`);
    const opts: DOpt[] = [
      { label: `打理药园（${h.plots.filter((p) => p.herb).length}/${h.plots.length} 畦有药）`, tone: 'gold', act: () => this.gardenNode() },
      { label: '入室闭关', act: () => { g.onPanel?.('seclude'); return null; } },
      { label: '在洞府中打坐', act: () => { if (!g.player.sitting) g.toggleSit(); return null; } },
    ];
    const na = h.array + 1;
    if (na <= 3) {
      const cost = ARRAY_COST[na], ok = C.bagCount(hero, 'mat_lingshi') >= cost && hero.realm >= ARRAY_REALM[na];
      opts.push({ label: `布置${ARRAY_NAME[na]}（${cost} 灵石）`, disabled: !ok, hint: hero.realm < ARRAY_REALM[na] ? `需${['', '炼气', '筑基', '结丹'][ARRAY_REALM[na]]}期` : C.bagCount(hero, 'mat_lingshi') < cost ? '灵石不足' : ['', '贼人难寻洞口，失窃大减', '外人入内即迷失方向，再无失窃；灵气 +0.15', '聚四方灵气：灵气 +0.3，药园每畦多收一株'][na], act: () => { C.removeItem(hero, 'mat_lingshi', cost); h.array = na; g.toast(`${ARRAY_NAME[na]}布成！`, 'good'); g.juice(0.06, 0.4); return this.mainNode(); } });
    }
    const pi = PLOT_STEPS.indexOf(h.plots.length);
    if (pi >= 0 && pi < PLOT_STEPS.length - 1) {
      const cost = PLOT_COST[pi + 1], need = pi + 1 >= 2 ? 2 : 1;
      opts.push({ label: `扩建药园至 ${PLOT_STEPS[pi + 1]} 畦（${cost} 灵石）`, disabled: C.bagCount(hero, 'mat_lingshi') < cost || hero.realm < need, hint: hero.realm < need ? '需筑基期' : '', act: () => { C.removeItem(hero, 'mat_lingshi', cost); while (h.plots.length < PLOT_STEPS[pi + 1]) h.plots.push({ herb: null, age: 0, n: 0, day: 0 }); return this.mainNode(); } });
    }
    const frag = C.bagCount(hero, 'mat_gubaocan');
    if (frag > 0) opts.push({ label: `以地火重炼古宝（古宝残片 ${frag}/5）`, disabled: frag < 5, hint: frag < 5 ? '残片不足' : '耗时一月', act: () => {
      C.removeItem(hero, 'mat_gubaocan', 5); g.passDays(30);
      const a = pickArt(5, true) ?? pickArt(4, false);
      if (!a) return this.mainNode();
      C.addItem(hero, a, 1); g.news(`韩立以五片古宝残片，重炼出一件古宝【${itemDef(a).name}】。`, 'personal'); g.juice(0.1, 0.7);
      return { speaker: h.name, title: '古宝重光', mood: 'mystic', text: `地火熊熊烧了整整三十日。五片残片在火中缓缓相融，最后一道裂痕弥合的刹那，一股苍茫古意冲出石室——\n\n获得古宝：【${itemDef(a).name}】`, options: [{ label: '好', act: () => this.mainNode() }] };
    } });
    if (g.ws.pets.length) opts.push({ label: '照看灵宠', act: () => g.pets.menuNode() });
    opts.push({ label: '离开', act: () => null });
    return { speaker: h.name, title: `洞府 · 灵气 ×${this.placeMult().toFixed(2)} · 禁制：${ARRAY_NAME[h.array]}`, mood: 'mystic', text: `石室清幽，灵泉叮咚。${h.robbed && g.day - h.robbed < 60 ? '\n（药园的篱笆上还留着贼人翻过的脚印）' : ''}\n\n药园：${grown.length ? grown.join('、') : '空着'}`, options: opts };
  }
  gardenNode(): DNode {
    const g = this.game, h = this.h!, hero = g.hero;
    const opts: DOpt[] = h.plots.map((p, i) => {
      if (!p.herb) return { label: `第${i + 1}畦 · 空地 —— 种下灵药`, act: () => this.plantNode(i) } as DOpt;
      const age = this.plotAge(p);
      return { label: `第${i + 1}畦 · ${itemDef(p.herb).name} ${age}年 ×${p.n + (h.array >= 3 ? 1 : 0)}`, tone: age >= 100 ? 'gold' : undefined, act: () => this.plotNode(i) } as DOpt;
    });
    opts.push({ label: '返回', act: () => this.mainNode() });
    return { speaker: h.name, title: `药园 · 每日约长 ${(GROW * this.q()).toFixed(2)} 年 · 掌天瓶绿液 ${hero.bottle.drops} 滴`, text: '篱笆围起的几畦灵田，泥土湿润，引来的灵泉在田垄间潺潺流过。\n\n种下一株灵药，它会在灵脉滋养下慢慢长大，收获时一株化三。打坐时光阴更快，药也长得更快。', options: opts };
  }
  private plantNode(i: number): DNode {
    const g = this.game, h = this.h!, hero = g.hero;
    const stacks = hero.bag.filter((b) => itemDef(b.id).type === 'herb').sort((a, b) => itemDef(b.id).price * (1 + (b.age ?? 0) / 100) - itemDef(a.id).price * (1 + (a.age ?? 0) / 100)).slice(0, 8);
    const opts: DOpt[] = stacks.map((b) => ({ label: `${itemDef(b.id).name} · ${b.age ?? 0}年（有 ${b.n}）`, act: () => {
      C.removeItem(hero, b.id, 1, b.age ?? 0);
      h.plots[i] = { herb: b.id, age: Math.max(5, Math.round((b.age ?? 0) * 0.5)), n: 3, day: g.day };
      g.toast(`种下${itemDef(b.id).name}。`, 'info');
      return this.gardenNode();
    } }));
    if (!opts.length) opts.push({ label: '（储物袋里没有灵药可种）', disabled: true, act: () => null });
    opts.push({ label: '返回', act: () => this.gardenNode() });
    return { speaker: h.name, title: `第${i + 1}畦`, text: '选一株灵药种下。分株移栽会折损一半药龄，但收获时可得三株。', options: opts };
  }
  private plotNode(i: number): DNode {
    const g = this.game, h = this.h!, hero = g.hero, p = h.plots[i];
    const age = this.plotAge(p), it = itemDef(p.herb!);
    const n = p.n + (h.array >= 3 ? 1 : 0);
    return { speaker: h.name, title: `第${i + 1}畦 · ${it.name}`, text: `${it.name}，已长到 ${age} 年，共 ${n} 株。${age >= 100 ? '\n叶片间灵光流转，已是百年灵药。' : ''}`, options: [
      { label: `采收（${it.name}·${age}年 ×${n}）`, tone: 'gold', act: () => { C.addItem(hero, p.herb!, n, age); h.plots[i] = { herb: null, age: 0, n: 0, day: 0 }; hero.stats.gathered += n; g.toast(`收获 ${age} 年${it.name} ×${n}`, 'good'); return this.gardenNode(); } },
      { label: `滴一滴掌天瓶绿液（+${BOTTLE_YEARS} 年，整畦）`, disabled: hero.bottle.drops <= 0, hint: hero.bottle.drops <= 0 ? '瓶中尚无绿液' : `剩 ${hero.bottle.drops} 滴`, act: () => { hero.bottle.drops--; p.age += BOTTLE_YEARS; g.toast(`绿液渗入灵田，${it.name}肉眼可见地拔高、舒展——药龄 +${BOTTLE_YEARS} 年！`, 'good'); g.juice(0.05, 0.3); return this.plotNode(i); } },
      { label: '铲除', tone: 'bad', act: () => { h.plots[i] = { herb: null, age: 0, n: 0, day: 0 }; return this.gardenNode(); } },
      { label: '返回', act: () => this.gardenNode() },
    ] };
  }
  placeMult(): number { const h = this.h; if (!h) return 1; return this.q() + (h.array >= 2 ? 0.15 : 0) + (h.array >= 3 ? 0.3 : 0); }
  /** 在洞府里（打坐加成） */
  atHome(x: number, y: number) { const h = this.h; return !!h && h.map === ACTIVE_MAP && Math.hypot(h.x - x, h.y - y) < 420; }
  /** Y：回府 */
  recall() {
    const g = this.game, h = this.h, P = g.player;
    if (!h) { g.toast('你还没有洞府。神识中寻到「灵脉」，便可开辟洞府。', 'info'); return; }
    if (h.map !== ACTIVE_MAP) { g.toast(`${h.name}不在此地域。`, 'warn'); return; }
    if (this.focus) { this.interact(); return; }
    const dist = Math.hypot(h.x - P.x, h.y - P.y);
    if (C.bagCount(g.hero, 'tal_huifu') <= 0) { g.toast(`${h.name}在${dirName(h.x - P.x, h.y - P.y)}方约 ${Math.max(1, Math.round(dist / 260))} 里。（坊市有售回府符，按 Y 可直接遁回）`, 'info'); return; }
    if (g.combat.inCombat) { g.toast('激战正酣，无法静心催动回府符。', 'warn'); return; }
    C.removeItem(g.hero, 'tal_huifu', 1);
    g.combat.vfx.push({ kind: 'ring', x: P.x, y: P.y, r: 160, t: 0, dur: 0.6, color: '140,230,255' } as any);
    g.teleport(h.x - 30, h.y + 40); P.flying = false;
    g.combat.vfx.push({ kind: 'ring', x: h.x - 30, y: h.y + 40, r: 160, t: 0, dur: 0.6, color: '140,230,255' } as any);
    g.juice(0.05, 0.3);
    g.toast(`回府符化作一道青光——你已回到${h.name}。`, 'good');
  }

  // ------------------------------------------------------------ 绘制
  collect(out: { y: number; draw: (g: G) => void }[], view: { left: number; top: number; right: number; bottom: number }, t: number) {
    const g = this.game, h = this.h;
    if (!h || h.map !== ACTIVE_MAP) return;
    if (h.x < view.left - 500 || h.x > view.right + 500 || h.y < view.top - 400 || h.y > view.bottom + 400) return;
    const v = Math.max(g.life.vis({ x: h.x, y: h.y }), 0.75);   // 自己的洞府总记得
    out.push({ y: h.y - 70, draw: (ctx) => this.drawCave(ctx, h, v, t) });
    out.push({ y: h.y + 30, draw: (ctx) => this.drawGarden(ctx, h, v, t) });
  }
  private drawCave(ctx: G, h: HomeState, v: number, t: number) {
    const x = h.x - 30, y = h.y - 70;
    ctx.save(); ctx.globalAlpha *= v;
    // 山岩
    ctx.fillStyle = '#4a4640';
    ctx.beginPath(); ctx.moveTo(x - 190, y + 10); ctx.quadraticCurveTo(x - 200, y - 150, x - 90, y - 210); ctx.quadraticCurveTo(x, y - 250, x + 90, y - 205); ctx.quadraticCurveTo(x + 200, y - 150, x + 190, y + 10); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(x + 60, y + 10); ctx.quadraticCurveTo(x + 150, y - 120, x + 90, y - 205); ctx.quadraticCurveTo(x + 200, y - 150, x + 190, y + 10); ctx.fill();
    ctx.fillStyle = 'rgba(80,120,60,0.6)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(x - 150 + i * 50, y - 160 + Math.sin(i * 2.3) * 40, 22, 9, 0, 0, TAU); ctx.fill(); }
    // 藤蔓
    ctx.strokeStyle = '#3e6a34'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 80 + i * 50, y - 190); ctx.quadraticCurveTo(x - 70 + i * 50 + Math.sin(t + i) * 4, y - 130, x - 76 + i * 50, y - 90); ctx.stroke(); }
    // 石门
    ctx.fillStyle = '#7a7266'; ctx.beginPath(); ctx.moveTo(x - 58, y + 6); ctx.lineTo(x - 58, y - 100); ctx.quadraticCurveTo(x, y - 150, x + 58, y - 100); ctx.lineTo(x + 58, y + 6); ctx.fill();
    ctx.fillStyle = '#1e1a16'; ctx.beginPath(); ctx.moveTo(x - 42, y + 6); ctx.lineTo(x - 42, y - 92); ctx.quadraticCurveTo(x, y - 132, x + 42, y - 92); ctx.lineTo(x + 42, y + 6); ctx.fill();
    // 室内暖光
    const warm = 0.25 + 0.6 * this.game.night;
    const gr = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 60); gr.addColorStop(0, `rgba(255,190,110,${warm})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 42, y + 6); ctx.lineTo(x - 42, y - 92); ctx.quadraticCurveTo(x, y - 132, x + 42, y - 92); ctx.lineTo(x + 42, y + 6); ctx.fill();
    // 匾
    ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x - 46, y - 168, 92, 28); ctx.strokeStyle = '#a8884a'; ctx.lineWidth = 2; ctx.strokeRect(x - 44, y - 166, 88, 24);
    ctx.fillStyle = '#e8d090'; ctx.font = 'bold 17px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.fillText(h.name.slice(0, 4), x, y - 148);
    // 灯笼
    for (const sx of [-74, 74]) {
      ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + sx, y - 108); ctx.lineTo(x + sx, y - 96); ctx.stroke();
      ctx.fillStyle = '#b8402e'; ctx.beginPath(); ctx.ellipse(x + sx, y - 82, 11, 15, Math.sin(t * 1.4 + sx) * 0.06, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createRadialGradient(x + sx, y - 82, 0, x + sx, y - 82, 50); lg.addColorStop(0, `rgba(255,170,90,${0.2 + 0.5 * this.game.night})`); lg.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x + sx, y - 82, 50, 0, TAU); ctx.fill(); ctx.restore();
    }
    // 禁制光罩
    if (h.array > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const k = 0.5 + 0.5 * Math.sin(t * 0.9);
      const col = ['', '150,220,255', '190,170,255', '255,220,140'][h.array];
      ctx.strokeStyle = `rgba(${col},${0.08 + 0.08 * k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.x + 60, h.y - 20, 360, 250, 0, Math.PI, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(${col},${0.025 + 0.02 * k})`; ctx.beginPath(); ctx.ellipse(h.x + 60, h.y - 20, 360, 250, 0, Math.PI, TAU); ctx.fill();
      ctx.restore();
    }
    if (this.focus) { const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z)); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText(`【T】${h.name}`, x, y - 190); ctx.fillStyle = '#fff0c8'; ctx.fillText(`【T】${h.name}`, x, y - 190); }
    ctx.restore();
  }
  private drawGarden(ctx: G, h: HomeState, v: number, t: number) {
    ctx.save(); ctx.globalAlpha *= v;
    const ox = h.x + 110, oy = h.y - 20, cols = 3, rows = Math.ceil(h.plots.length / cols);
    const W = cols * 62 + 14, H = rows * 40 + 14;
    // 篱笆
    ctx.fillStyle = 'rgba(70,56,36,0.35)'; ctx.fillRect(ox - 10, oy - 10, W, H);
    ctx.strokeStyle = '#7a6040'; ctx.lineWidth = 3;
    ctx.strokeRect(ox - 10, oy - 10, W, H);
    ctx.lineWidth = 2; for (let i = 0; i <= Math.floor(W / 18); i++) { ctx.beginPath(); ctx.moveTo(ox - 10 + i * 18, oy + H - 10); ctx.lineTo(ox - 10 + i * 18, oy + H - 26); ctx.stroke(); }
    h.plots.forEach((p, i) => {
      const px = ox + (i % cols) * 62, py = oy + Math.floor(i / cols) * 40;
      ctx.fillStyle = '#4a3a28'; ctx.fillRect(px, py, 52, 30);
      ctx.fillStyle = 'rgba(30,22,14,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(px + 2, py + 6 + k * 9, 48, 2);
      if (!p.herb) return;
      const age = this.plotAge(p), col = HERB_COL[p.herb] ?? '200,255,200';
      const s = clamp(0.45 + Math.log10(1 + age) * 0.28, 0.45, 1.3);
      for (let k = 0; k < 3; k++) {
        const hx = px + 10 + k * 16, hy = py + 24;
        ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 2;
        for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + j * 5 * s, hy - 10 * s, hx + j * 8 * s + Math.sin(t * 2 + k + j) * 1.5, hy - 20 * s); ctx.stroke(); }
        ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(hx, hy - 21 * s, 3 * s, 0, TAU); ctx.fill();
      }
      if (age >= 100) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},${0.12 + 0.08 * Math.sin(t * 2 + i)})`; ctx.beginPath(); ctx.ellipse(px + 26, py + 10, 34, 20, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    });
    ctx.restore();
  }
}
// 未使用导出（保持 tree-shaking 友好）
