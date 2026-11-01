// 第四十步：大夺宝——元婴级的至宝出世
//
// 小夺宝（happen.heraldTick）是筑基、结丹修士争的异宝；大夺宝是元婴老怪们亲自出手争的东西：
// 镇宝的是八、九级妖王，争宝的是三四路人马、各由一位元婴修士领头（彼此见面就打，也打妖王，也打你）。
// 彩头：通天级的原创至宝、元婴灵宝、上古秘术、啼魂幼兽、紫府玄元丹、天地元气晶（化神所需）……
// 元婴之后，人界能让你拼命的，大概也就剩这个了。
import type { Game } from './game';
import { Enemy } from './combat';
import * as C from './cultivation';
import { itemDef } from '../data/items';
import { ENEMIES, lvRealm } from '../data/enemies';
import { ACTIVE_MAP, WORLD_W, WORLD_H, MAP_NAME, type MapId } from '../data/world';
import { ART_LIST } from '../data/arts';
import { cultivator, newTeam, sectName } from './melee';
import { dirName } from './sites';

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const DUR = 60;
const SEIZE = 12;

export interface GreatState { map: string; x: number; y: number; day: number; rivals: string[]; done?: boolean; seize?: number; taker?: number }

/** 镇宝妖王（陆上的八、九级妖兽） */
const GUARDS = ['shiqin', 'zichidiao', 'dujiao_w', 'qinglinjiao', 'shixiong'];
/** 各图争宝的大宗门 */
const SCHOOLS: Record<string, string[]> = {
  tiannan: ['luoyun', 'gujian', 'baiqiao', 'guiling', 'hehuan', 'yinluo', 'tiansha', 'yanyue', 'huayi'],
  luanxing: ['xinggong', 'nixing', 'jiyin', 'sanxiu'],
  dajin: ['taiyi', 'tianmo', 'huayi', 'sanxiu', 'jiexiu'],
};
/** 彩头：通天级至宝 / 元婴灵宝 / 上古秘术 / 异兽 / 圣药 */
export const GREAT_TOP = ['art_taixujianxia', 'art_zhoutianpan', 'art_jiuyoudeng'];
export const GREAT_LINGBAO = ['art_zixiao', 'art_xuanming', 'art_jiuyanglu', 'art_shanheyin', 'art_qiankunjing', 'art_xuanwudun', 'art_longlinjia', 'art_wanhunfan', 'art_fulongsuo', 'art_yunxiaozhou'];
export const GREAT_SECRET = ['scroll_art_dongxuan', 'scroll_art_shengmo', 'item_tihun'];

export class GreatHunt {
  game: Game;
  focus = false;
  private spawned = false;
  private t = 0;
  constructor(g: Game) { this.game = g; }
  st(): GreatState | undefined { return (this.game.ws.flags as any).great; }

  tick(dt: number) {
    this.t -= dt; if (this.t > 0) return; this.t = 0.5;
    const g = this.game, f = g.ws.flags as any, p = g.player, h = g.hero;
    f.greatNext ??= g.day + rand(300, 500);
    const gs = this.st();
    if (gs && !gs.done && g.day > gs.day + DUR) { gs.done = true; this.spawned = false; g.news(`大夺宝落幕：至宝被${gs.rivals[0]}夺去，据说此人已遁入深山闭关。`, 'rumor'); }
    if ((!gs || gs.done) && g.day >= f.greatNext && !g.combat.safeAt(p.x, p.y)) {
      f.greatNext = g.day + (h.realm >= 4 ? rand(240, 420) : rand(480, 900));
      this.spawned = false;
      const T = g.terrain;
      let best: { x: number; y: number; d: number } | null = null;
      for (let i = 0; i < 40; i++) {
        const an = Math.random() * TAU, d = rand(6000, 14000);
        const x = p.x + Math.cos(an) * d, y = p.y + Math.sin(an) * d * 0.8;
        if (x < 900 || y < 900 || x > WORLD_W - 900 || y > WORLD_H - 900 || !T.isLand(x, y) || T.walkFactor(x, y) < 0.3 || T.inLocZone(x, y, 700)) continue;
        const dz = g.combat.dangerCalc(x, y).d;
        if (!best || dz > best.d) best = { x, y, d: dz };
      }
      if (!best) return;
      const sch = SCHOOLS[ACTIVE_MAP] ?? SCHOOLS.tiannan;
      const rivals = Array.from({ length: 3 }, () => `${sectName(pick(sch))}元婴长老`);
      f.great = { map: ACTIVE_MAP, x: best.x, y: best.y, day: g.day, rivals } as GreatState;
      g.news(`${dirName(best.x - p.x, best.y - p.y)}方天现异象，霞光三日不散——有上古至宝出世！${rivals.slice(0, 2).join('、')}等元婴老怪已动身前往。`, 'canon');
      g.toast(`天边霞光冲霄，三日不散——大夺宝！元婴老怪云集，非元婴修士去了只怕有去无回。（地图上标「夺」，${DUR} 日内有效）`, 'good');
      g.juice(0.06, 0.6);
      return;
    }
    if (!gs || gs.done || gs.map !== ACTIVE_MAP) { this.focus = false; return; }
    const d = Math.hypot(gs.x - p.x, gs.y - p.y);
    if (!this.spawned && d < 2200) { this.spawned = true; this.spawn(gs); }
    const guardAlive = g.combat.enemies.some((e) => e.tag === 'great:guard' && !e.dead);
    this.focus = this.spawned && !guardAlive && d < 220;
    // 妖王一倒，元婴老怪们抢着收宝——收满便化虹而去；打断他（击杀 / 打退）才有机会
    if (this.spawned && !guardAlive && !this.focus) {
      let taker: Enemy | null = null, bd = 300;
      for (const e of g.combat.enemies) if (!e.dead && e.tag === 'great:rival' && !e.cast) { const dd = Math.hypot(e.x - gs.x, e.y - gs.y); if (dd < bd) { bd = dd; taker = e; } }
      for (const e of g.combat.enemies) if (!e.dead && e.tag === 'great:rival') { e.hx = gs.x; e.hy = gs.y; }
      if (taker) {
        if (gs.taker !== taker.id) { gs.taker = taker.id; gs.seize = 0; g.toast(`${taker.name}扑到霞光中心，开始收取至宝！——打断他！`, 'warn'); }
        gs.seize = (gs.seize ?? 0) + 0.5;
        g.combat.texts.push({ x: taker.x, y: taker.y - 160, s: `收宝 ${Math.min(SEIZE, Math.floor(gs.seize))}/${SEIZE}`, color: '#ffb070', t: 0, vy: -10 });
        if (gs.seize >= SEIZE) {
          gs.done = true; this.focus = false; gs.taker = undefined;
          g.combat.vfx.push({ kind: 'blinkfx', x: taker.x, y: taker.y, r: 120, t: 0, dur: 0.7, color: '255,190,120' } as any);
          taker.gone = true;
          g.news(`大夺宝的至宝被${taker.name}抢先收走，此人化虹遁去。`, 'rumor');
          g.toast(`${taker.name}收起至宝，化作一道长虹远去——至宝被人夺走了。`, 'warn');
        }
      } else if (gs.taker !== undefined) { gs.taker = undefined; gs.seize = 0; }
    }
  }

  private spawn(gs: GreatState) {
    const g = this.game;
    // 镇宝妖王
    const defs = GUARDS.map((id) => ENEMIES[id]).filter((d) => d && d.lv && d.lv[1] >= 8);
    const def = pick(defs);
    if (def) {
      const lv = Math.max(8, Math.min(9, def.lv![1])), rs = lvRealm(lv, 12);
      const e = new Enemy(def, gs.x + 80, gs.y + 40, rs.realm, rs.stage);
      e.name = def.name + '·镇宝妖王'; e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 4); e.hx = gs.x; e.hy = gs.y;
      e.tag = 'great:guard'; e.team = newTeam('great:beast'); e.aggro = true;
      g.combat.enemies.push(e);
    }
    // 三四路人马，各由一位元婴领头
    const sch = SCHOOLS[ACTIVE_MAP] ?? SCHOOLS.tiannan;
    const nGroups = Math.random() < 0.4 ? 4 : 3;
    for (let gi = 0; gi < nGroups; gi++) {
      const team = newTeam('great'), base = (gi / nGroups) * TAU + rand(-0.3, 0.3);
      const school = pick(sch), n = 1 + Math.floor(rand(1, 4));
      for (let i = 0; i < n; i++) {
        const an = base + rand(-0.35, 0.35), R = rand(560, 760);
        const lead = i === 0;
        const realm = lead ? 4 : 3;
        const stage = lead ? (Math.random() < 0.15 ? 2 : Math.random() < 0.45 ? 1 : 0) : (Math.random() < 0.5 ? 2 : 1);
        const nm = lead ? (gs.rivals[gi] ?? `${sectName(school)}元婴长老`) : `${sectName(school)}结丹长老`;
        const e = cultivator(gs.x + Math.cos(an) * R, gs.y + Math.sin(an) * R * 0.75, realm, stage, school, nm);
        e.tag = 'great:rival'; e.team = team; e.aggro = true; e.hx = gs.x; e.hy = gs.y;
        if (lead) e.boss = true;
        g.combat.enemies.push(e);
      }
    }
    g.toast(`霞光之下，${nGroups}路元婴老怪各率门人杀作一团，镇宝妖王的咆哮震得山石滚落——这是元婴的战场。`, 'warn');
  }

  onKill(e: Enemy) {
    if (e.tag !== 'great:guard') return;
    this.game.toast(e.npcKill ? `镇宝妖王被${e.killer?.name ?? '旁人'}斩杀！元婴老怪们正扑向霞光——抢在他们前面（T）！` : '镇宝妖王伏诛！霞光就在眼前——上前取宝（T）。', e.npcKill ? 'warn' : 'good');
  }

  /** 彩头：一件主宝 + 两三件副彩 */
  private prize(): { main: string | null; extra: [string, number, number?][] } {
    const h = this.game.hero;
    const has = (id: string) => C.bagCount(h, id) > 0 || (id.startsWith('scroll_art_') && h.arts.some((a) => 'scroll_art_' + a.id === id));
    const tops = GREAT_TOP.filter((id) => !has(id)), secrets = GREAT_SECRET.filter((id) => !has(id) && (id === 'item_tihun' || ART_LIST.some((s) => 'scroll_art_' + s.id === id)));
    const r = Math.random();
    let main: string | null = null;
    if (r < 0.3 && tops.length) main = pick(tops);
    else if (r < 0.5 && secrets.length) main = pick(secrets);
    else main = pick(GREAT_LINGBAO);
    const pool: [string, number, number?][] = [
      ['item_yuanqi', 1], ['item_yuanqi', 2], ['mat_yaodan8', 1], ['mat_yaodan9', 1], ['herb_jiuqu', 1, 1000 + Math.round(Math.random() * 2000)], ['pill_yuanling', 2],
      ['pill_zifu', 1], ['pill_wanshou', 1], ['mat_gengjing', 1], ['pill_ningpo', 1], ['herb_yangshen', 2, 3000],
    ];
    const extra: [string, number, number?][] = [];
    const n = Math.random() < 0.5 ? 3 : 2;
    while (extra.length < n) { const x = pick(pool); if (!extra.some((e) => e[0] === x[0])) extra.push(x); }
    return { main, extra };
  }

  interact(): boolean {
    const g = this.game, gs = this.st(), h = g.hero;
    if (!this.focus || !gs) return false;
    g.openDialog({ speaker: '上古至宝', mood: 'mystic', text: '霞光中心，一件古物悬在半空，四周的灵气被它搅成一个缓缓旋转的漩涡。离得越近，越觉得自己的元婴都在微微发颤。', options: [{ label: '收取至宝', tone: 'gold', act: () => {
      gs.done = true; this.focus = false;
      const { main, extra } = this.prize();
      const got: string[] = [];
      if (main) { C.addItem(h, main, 1); got.push(`【${itemDef(main).name}】`); }
      for (const [id, n, age] of extra) { C.addItem(h, id, n, age); got.push(`${itemDef(id).name}${age ? `（${age}年）` : ''}${n > 1 ? `×${n}` : ''}`); }
      const ls = Math.round(rand(20000, 60000)); C.addItem(h, 'mat_lingshi', ls); got.push(`灵石 ${ls}`);
      const sk = g.combat.randomScroll(4); if (sk && Math.random() < 0.6) { C.addItem(h, sk, 1); got.push(itemDef(sk).name); }
      g.news(`大夺宝落幕——韩立力压群雄，夺得${main ? `【${itemDef(main).name}】` : '至宝'}！`, 'personal');
      g.pursuit.maybe('大夺宝得手的消息传遍各大宗门', 0.85, 2);
      g.juice(0.16, 1.1);
      return { speaker: '上古至宝', title: '至宝入手', mood: 'mystic', text: `你探手一握，霞光轰然收敛，没入掌中。四下里的元婴老怪齐齐变了脸色。\n\n获得：${got.join('、')}\n\n（这样的消息瞒不住——各大宗门很快就会知道是谁拿走了它）`, options: [{ label: '走', act: () => null }] };
    } }, { label: '离开', act: () => null }] });
    return true;
  }

  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const gs = this.st();
    if (gs && !gs.done && gs.map === ACTIVE_MAP) return [{ x: gs.x, y: gs.y, glyph: '夺', color: '#ff9a50', ring: 1400, name: '大夺宝（元婴级）' }];
    return [];
  }
  chance(): { t: string; d: string; x?: number; y?: number; hot?: boolean; tone?: string } | null {
    const g = this.game, gs = this.st(), p = g.player, day = g.day;
    if (!gs || gs.done || gs.day + DUR <= day) return null;
    const left = Math.max(1, Math.ceil(gs.day + DUR - day));
    if (gs.map !== ACTIVE_MAP) return { t: '大夺宝', d: `${MAP_NAME[gs.map as MapId] ?? '别处'}有上古至宝出世，元婴老怪云集，余 ${left} 日。`, tone: 'gold' };
    return { t: '大夺宝（元婴级）', d: `${dirName(gs.x - p.x, gs.y - p.y)}方约 ${Math.round(Math.hypot(gs.x - p.x, gs.y - p.y) / 30)} 丈，霞光冲霄。${gs.rivals.join('、')}都在路上——${left} 日内无人取走，便归他们中的一人。`, x: gs.x, y: gs.y, hot: true, tone: 'gold' };
  }

  /** 霞光：比小夺宝的宝光更粗、更高，金中带赤 */
  draw(ctx: G, v: number, t: number) {
    const gs = this.st(); if (!gs) return;
    const x = gs.x, y = gs.y;
    ctx.save(); ctx.globalAlpha *= v; ctx.globalCompositeOperation = 'lighter';
    const k = 0.75 + 0.25 * Math.sin(t * 1.2);
    const H = 2000;
    const gr = ctx.createLinearGradient(x, y - H, x, y);
    gr.addColorStop(0, 'rgba(255,170,110,0)'); gr.addColorStop(0.55, `rgba(255,190,120,${0.2 * k})`); gr.addColorStop(1, `rgba(255,236,200,${0.6 * k})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.lineTo(x - 120, y - H); ctx.lineTo(x + 120, y - H); ctx.lineTo(x + 36, y); ctx.fill();
    for (let i = 0; i < 24; i++) { const q = (t * 0.25 + i / 24) % 1; ctx.fillStyle = `rgba(255,${200 + (i % 3) * 18},150,${(1 - q) * 0.75})`; ctx.beginPath(); ctx.arc(x + Math.sin(i * 5.3 + t) * 70 * q, y - q * 1000, 3 + 4 * (1 - q), 0, TAU); ctx.fill(); }
    // 地面上缓缓旋转的灵气漩涡
    ctx.lineWidth = 3;
    for (let r = 0; r < 3; r++) { ctx.strokeStyle = `rgba(255,210,150,${(0.32 - r * 0.08) * k})`; ctx.beginPath(); ctx.ellipse(x, y, 140 + r * 70, (140 + r * 70) * 0.35, 0, t * (0.6 + r * 0.2), t * (0.6 + r * 0.2) + TAU * 0.7); ctx.stroke(); }
    const rg = ctx.createRadialGradient(x, y - 50, 0, x, y - 50, 180); rg.addColorStop(0, `rgba(255,230,190,${0.55 * k})`); rg.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y - 50, 180, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.focus) { const z = this.game.cam.zoom, fs = Math.max(12, 14 / Math.max(0.5, z)); ctx.save(); ctx.font = `${fs}px "Noto Serif SC",serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.strokeText('【T】收取至宝', x, y - 190); ctx.fillStyle = '#ffe0b0'; ctx.fillText('【T】收取至宝', x, y - 190); ctx.restore(); }
  }
}
