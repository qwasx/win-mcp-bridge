// 第三十六步：大战与传音玉符——把散落各地的修士串起来的“媒介”
// · 两场反复爆发的大战：慕兰之战（天南联军 ⇄ 慕兰法士）、星宫逆星之战（星宫 ⇄ 逆星盟）
//   召集令 → 赶赴集结点（军帐：领军令、邀道友、战功兑换）→ 前线一波波接战；友军出自各宗名册，与你并肩
//   你可以以宗门弟子身份应召，也可以散修身份择一方投效；道友也会邀你同去（你被人带）
// · 传音玉符：召集、邀约、求救、战书、交易，都从这里来
import type { Game } from './game';
import type { NpcData } from './npc';
import type { DNode, DOpt } from './modal';
import { Enemy } from './combat';
import { ENEMIES } from '../data/enemies';
import { LOC_BY_ID, WORLD_SCALE, ACTIVE_MAP, MapId } from '../data/world';
import { REALMS, realmName } from '../data/realms';
import * as C from './cultivation';
import { itemDef, ITEM_LIST } from '../data/items';
import { zoneOfLoc, sellableAt, priceMul, ruleOf, yaodanCap, pzOf } from '../data/market';
import { randomLook } from '../gfx/character';
import { mulberry32 } from '../core/rng';
import { SECT_DEF, member, sectTitle } from './roster';
import { dirName } from './sites';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const YEAR = 360;

interface Side { name: string; sects: string[]; rally: string; school: string; evil?: boolean }
interface WarDef { id: string; name: string; map: MapId; first: number; every: number; call: number; dur: number; sides: [Side, Side]; front: () => { x: number; y: number; name: string }; intro: string }
const lerpLoc = (a: string, b: string, t: number) => { const A = LOC_BY_ID.get(a)!, B = LOC_BY_ID.get(b)!; return { x: (A.x + (B.x - A.x) * t) * WORLD_SCALE, y: (A.y + (B.y - A.y) * t) * WORLD_SCALE }; };

export const WARS: WarDef[] = [
  {
    id: 'mulan', name: '慕兰之战', map: 'tiannan', first: 9, every: 7, call: 12, dur: 80,
    sides: [
      { name: '天南联军', sects: ['huayi', 'huangfeng', 'yanyue', 'lingshou', 'qingxu', 'huadao', 'tianque', 'jujian', 'luoyun', 'gujian', 'baiqiao', 'qianzhu'], rally: 'huayi', school: '' },
      { name: '慕兰法士', sects: ['mulan', 'tianlan'], rally: 'mulan', school: 'mulan' },
    ],
    front: () => ({ ...lerpLoc('huayi', 'mulan', 0.6), name: '慕兰草原前线' }),
    intro: '慕兰法士的大军压境，天南北疆烽火连天。九国盟发下召集令，天南各派、各路散修齐赴化意门集结。',
  },
  {
    id: 'xing', name: '星宫逆星之战', map: 'luanxing', first: 11, every: 6, call: 10, dur: 70,
    sides: [
      { name: '星宫', sects: ['tianxing', 'miaoyin'], rally: 'tianxing', school: 'xinggong' },
      { name: '逆星盟', sects: ['leikong', 'jiyin'], rally: 'leikong', school: 'nixing', evil: true },
    ],
    front: () => ({ ...lerpLoc('tianxing', 'leikong', 0.5), name: '内星海战场' }),
    intro: '逆星盟聚众反叛星宫，内星海诸岛战火四起。星宫与逆星盟各自广发召集令，重金招揽散修。',
  },
];
export const WAR_BY_ID = new Map(WARS.map((w) => [w.id, w]));

export interface WarState { phase: 'idle' | 'call' | 'battle'; next: number; start?: number; end?: number; score: number; side?: 0 | 1; reported?: boolean; camp?: boolean; lastFight?: number; wins?: number }
export type JadeKind = '召集' | '邀约' | '求救' | '战书' | '交易';
export interface Jade { id: number; day: number; kind: JadeKind; from: string; fromId?: string; text: string; war?: string; side?: 0 | 1; done?: boolean; read?: boolean; x?: number; y?: number; until?: number; item?: string; price?: number; n?: number }

/** 战功兑换 */
const MERIT_SHOP: [string, number, number][] = [
  ['pill_liaoshang', 3, 8], ['pill_huiqi', 3, 8], ['tal_tianleizi', 2, 30], ['pill_juling', 1, 70], ['pill_zhuji', 1, 140],
  // 第三十七步：原著有主之宝（雷火弓、金刚罩、六丁神符）不再出现在战功库里，换成军中库藏的符宝 / 法宝
  ['tal_tishen', 1, 90], ['tal_fubao', 1, 160], ['pill_ningyuan', 1, 220], ['art_miemo', 1, 240], ['art_fuguang', 1, 280], ['art_pingtianchi', 1, 340],
];

interface Battle { war: string; wave: number; foes: Enemy[]; t: number; x: number; y: number; done?: boolean; allies: Enemy[] }

export class WarSys {
  game: Game;
  private acc = 0;
  private battle: Battle | null = null;
  private sosFoes: Enemy[] = [];
  constructor(game: Game) { this.game = game; }
  private get F() { return this.game.ws.flags as any; }
  st(id: string): WarState {
    const f = this.F; f.war ??= {};
    if (!f.war[id]) { const w = WAR_BY_ID.get(id)!; f.war[id] = { phase: 'idle', next: w.first * YEAR + rand(0, 200), score: 0 } as WarState; }
    return f.war[id];
  }
  get merit(): number { return this.F.merit ?? 0; }
  set merit(v: number) { this.F.merit = Math.max(0, Math.round(v)); }
  get inbox(): Jade[] { return (this.F.jade ??= []); }
  get unread() { return this.inbox.filter((j) => !j.read).length; }
  send(j: Omit<Jade, 'id' | 'day'>, quiet = false) {
    const g = this.game, f = this.F; f.jadeN = (f.jadeN ?? 0) + 1;
    this.inbox.push({ ...j, id: f.jadeN, day: g.day });
    if (this.inbox.length > 40) this.inbox.splice(0, this.inbox.length - 40);
    if (!quiet) g.toast(`传音玉符一亮——【${j.kind}】${j.from}（O 键查看）`, j.kind === '求救' || j.kind === '战书' || j.kind === '召集' ? 'warn' : 'good');
  }
  /** 玩家所属阵营（宗门弟子自动归属） */
  sideOf(w: WarDef): 0 | 1 | undefined {
    const my = this.game.ws.sect?.id; if (!my) return undefined;
    return w.sides[0].sects.includes(my) ? 0 : w.sides[1].sects.includes(my) ? 1 : undefined;
  }
  enlisted(id: string) { const s = this.st(id); return s.side !== undefined && s.phase !== 'idle'; }
  frontOf(id: string) { return WAR_BY_ID.get(id)!.front(); }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    this.battleTick(dt);
    this.sosTick();
    this.acc -= dt; if (this.acc > 0) return; this.acc = 1;
    const g = this.game, p = g.player;
    for (const w of WARS) {
      const s = this.st(w.id); if (s.phase === 'idle' || s.side === undefined || ACTIVE_MAP !== w.map) continue;
      // 到了集结点：军帐
      const R = LOC_BY_ID.get(w.sides[s.side].rally)!;
      const dr = Math.hypot(R.x * WORLD_SCALE - p.x, R.y * WORLD_SCALE - p.y);
      if (dr < 2600 && !s.camp && !g.modal) { s.camp = true; this.muster(w, s); g.openDialog(this.campNode(w)); }
      // 到了前线：接战
      const fr = w.front();
      if (s.phase === 'battle' && !this.battle && Math.hypot(fr.x - p.x, fr.y - p.y) < 1700 && (s.lastFight ?? -9) <= g.day - 0.5 && !g.pursuit.active) this.startBattle(w, s);
    }
  }

  // ------------------------------------------------------------ 每日：战事推进、玉符
  daily(days: number) {
    const g = this.game, h = g.hero;
    for (const w of WARS) {
      const s = this.st(w.id);
      if (s.phase === 'idle' && g.day >= s.next) {
        s.phase = 'call'; s.start = g.day; s.end = g.day + w.call + w.dur; s.score = 0; s.side = undefined; s.camp = false; s.reported = false; s.wins = 0;
        g.news(`${w.name}将起：${w.intro}`, 'canon');
        if (h.realm >= 2) this.callUp(w);
      } else if (s.phase === 'call' && g.day >= (s.start ?? 0) + w.call) {
        s.phase = 'battle'; g.news(`${w.name}正式开战——${w.sides[0].name}与${w.sides[1].name}在${w.front().name}鏖战。`, 'canon');
        if (s.side !== undefined) g.toast(`${w.name}开战了！前线在地图上已标出（战）。`, 'warn');
      } else if (s.phase === 'battle') {
        // 战局在你看不见的地方也在推进
        s.score = Math.max(-100, Math.min(100, s.score + rand(-4, 4) * Math.min(days, 5)));
        if (g.day >= (s.end ?? 0)) this.finish(w, s);
      }
    }
    // 散玉符：邀约 / 求救 / 战书 / 交易（约每月一封）
    const f = this.F;
    if (h.realm >= 1 && (f.jadeAt ?? 0) <= g.day && Math.random() < 1 - Math.pow(1 - 1 / 30, days)) { f.jadeAt = g.day + 8; this.randomJade(); }
    // 过期
    for (const j of this.inbox) if (!j.done && j.until !== undefined && g.day > j.until) this.expire(j);
  }

  private callUp(w: WarDef) {
    const g = this.game, my = this.sideOf(w);
    if (my !== undefined) {
      const sn = sectTitle(g.ws.sect!.id);
      this.send({ kind: '召集', from: `${sn}执法堂`, war: w.id, side: my, text: `${w.intro}\n\n${sn}门下弟子，凡筑基以上，限${w.call}日内赶赴${LOC_BY_ID.get(w.sides[my].rally)?.name}集结，听候调遣。临阵不至者，按门规论处。`, until: g.day + w.call + 6 });
    } else {
      this.send({ kind: '召集', from: `${w.sides[0].name} / ${w.sides[1].name}`, war: w.id, text: `${w.intro}\n\n两方都在重金招揽散修：斩敌记功，战功可换丹药、法宝。\n${w.sides[0].name}在${LOC_BY_ID.get(w.sides[0].rally)?.name}集结；${w.sides[1].name}在${LOC_BY_ID.get(w.sides[1].rally)?.name}集结。`, until: g.day + w.call + 30 });
    }
    // 相熟的道友邀你同去（你也可以被人带着去）
    const friends = g.npcs.list.filter((d) => d.alive && d.met && d.favor >= 20 && d.realm >= 2 && !d.bond && !d.beauty && !d.stay && (w.sides[0].sects.includes(d.sect ?? '') || w.sides[1].sects.includes(d.sect ?? '') || d.faction === 'rogue'));
    const fr = friends.sort((a, b) => b.favor - a.favor)[0];
    if (fr && Math.random() < 0.7) {
      const side: 0 | 1 = w.sides[1].sects.includes(fr.sect ?? '') ? 1 : w.sides[0].sects.includes(fr.sect ?? '') ? 0 : (Math.random() < 0.5 ? 0 : 1);
      this.send({ kind: '邀约', from: fr.name, fromId: fr.id, war: w.id, side, text: `韩兄，${w.name}将起，我打算投${w.sides[side].name}，去前线搏一份战功。刀剑无眼，多一个信得过的人照应总是好的——可愿与我同行？`, until: g.day + w.call + 20 }, true);
    }
  }
  /** 应召：确定阵营 */
  enlist(w: WarDef, side: 0 | 1, by?: NpcData) {
    const g = this.game, s = this.st(w.id);
    s.side = side; s.camp = false;
    const R = LOC_BY_ID.get(w.sides[side].rally)!;
    if (by) {
      by.bond = 'companion'; by.bondUntil = s.end ?? g.day + 90; g.npcs.summon(by.id); g.rel.addFavor(by, 8);
      g.rel.log(`你随${by.name}投效${w.sides[side].name}，同赴${w.name}。`, 'info');
    }
    // 投了对面：另一方的宗门记你一笔
    for (const sid of w.sides[1 - side].sects) g.rel.addSect(sid, -6);
    g.destination = { x: R.x * WORLD_SCALE, y: R.y * WORLD_SCALE };
    g.toast(`已应召投效${w.sides[side].name}——前往${R.name}集结（地图已标出路线）`, 'good');
  }

  // ------------------------------------------------------------ 军帐
  /** 集结点聚起一营人马：从名册里点出各宗门人 */
  private muster(w: WarDef, s: WarState) {
    const g = this.game, side = w.sides[s.side!], R = LOC_BY_ID.get(side.rally)!;
    const hr = Math.max(1, g.hero.realm);
    let n = 0;
    for (const sid of side.sects) {
      if (!SECT_DEF.has(sid) || n >= 16) continue;
      const lead = sid === side.sects[0] ? g.roster.pick(sid, 1, Math.min(5, hr + 1), Math.min(5, hr + 1), { skipTop: true }) : [];   // 主事宗门出一位高一境的长老坐镇
      for (const d of [...lead, ...g.roster.pick(sid, sid === side.sects[0] ? 3 : 2, Math.max(1, hr - 1), hr, { skipTop: true })]) {
        (d as any).war = w.id; d.home0 ??= d.home; d.home = side.rally; d.stay = true; d.map = R.map;
        if (!g.npcs.activeOf(d.id)) { const q = g.npcs.homeAt(R, Math.random, 1400, 900); d.x = d.tx = q.x; d.y = d.ty = q.y; }
        n++;
      }
    }
  }
  campNode(w: WarDef): DNode {
    const g = this.game, s = this.st(w.id), side = w.sides[s.side ?? 0];
    const fr = w.front(), p = g.player;
    const allies = g.npcs.list.filter((d) => d.alive && (d as any).war === w.id && d.bond !== 'companion');
    const opts: DOpt[] = [];
    opts.push({ label: s.phase === 'call' ? `领军令（${Math.max(1, Math.ceil((s.start ?? 0) + w.call - g.day))} 日后开战）` : `领军令：赶赴${fr.name}（${dirName(fr.x - p.x, fr.y - p.y)}方）`, tone: 'gold', act: () => { g.destination = { x: fr.x, y: fr.y }; return null; } });
    const cand = allies.filter((d) => !d.bond).slice(0, 8);
    if (cand.length) opts.push({ label: `点几位同袍随你出阵（营中 ${allies.length} 人）`, act: () => this.pickAllies(w, cand) });
    const friends = g.npcs.list.filter((d) => d.alive && d.met && d.favor >= 15 && d.realm >= 1 && !d.bond && !d.beauty && !d.stay && !(d as any).war);
    if (friends.length) opts.push({ label: `传音邀相熟的道友前来（${friends.length} 人可邀）`, act: () => this.inviteFriends(w, friends) });
    opts.push({ label: `战功兑换（现有战功 ${this.merit}）`, tone: 'good', act: () => this.shopNode(w) });
    opts.push({ label: '离开军帐', act: () => null });
    const score = s.score, lean = score > 25 ? `${w.sides[0].name}占了上风` : score < -25 ? `${w.sides[1].name}占了上风` : '两军相持不下';
    return {
      speaker: `${side.name}军帐`, title: w.name, mood: 'danger',
      text: `营中旌旗猎猎，${side.sects.filter((x) => SECT_DEF.has(x)).map((x) => sectTitle(x)).slice(0, 6).join('、')}${side.sects.length > 6 ? '等派' : ''}的修士往来穿梭。\n\n眼下${lean}。你已立战功 ${this.merit}，本次战事胜 ${s.wins ?? 0} 阵。\n营中同袍 ${allies.length} 人，随你出阵的 ${g.npcs.list.filter((d) => d.alive && d.bond === 'companion').length} 人。`,
      options: opts,
    };
  }
  private pickAllies(w: WarDef, cand: NpcData[]): DNode {
    const g = this.game, s = this.st(w.id);
    const cap = 4, now = () => g.npcs.list.filter((d) => d.alive && d.bond === 'companion').length;
    return {
      speaker: '点将', title: w.name, mood: 'danger', text: `最多带 ${cap} 人出阵（现 ${now()} 人）。同袍会随你冲阵、替你挡下攻击，战事结束便各自归营。`,
      options: [
        ...cand.map((d): DOpt => ({ label: `${d.name}　${d.title ?? ''}　${realmName(d.realm, d.stage)}`, disabled: now() >= cap, act: () => { d.bond = 'companion'; d.bondUntil = s.end ?? g.day + 60; g.npcs.summon(d.id); g.toast(`${d.name}抱拳：「愿随道友出阵！」`, 'good'); return this.pickAllies(w, cand.filter((x) => x !== d)); } })),
        { label: '回军帐', act: () => this.campNode(w) },
      ],
    };
  }
  private inviteFriends(w: WarDef, friends: NpcData[]): DNode {
    const g = this.game, s = this.st(w.id);
    return {
      speaker: '传音玉符', title: '邀道友', mood: 'normal', text: '相熟的道友收到传音，若是交情够深，自会驾遁光赶来。',
      options: [
        ...friends.slice(0, 6).map((d): DOpt => ({ label: `${d.name}（好感 ${Math.round(d.favor)}，${realmName(d.realm, d.stage)}）`, act: () => {
          const yes = d.favor >= 40 || Math.random() < 0.35 + d.favor / 100 + (d.pers === 'righteous' ? 0.15 : 0) - (d.pers === 'cautious' ? 0.2 : 0);
          if (!yes) { g.rel.addFavor(d, -2); return { speaker: d.name, look: (g.npcs as any).look(d), text: pick(['此番凶险，在下修为浅薄，就不去添乱了。', '家中有事脱不开身，道友保重。', '战场之上九死一生……抱歉。']), options: [{ label: '回军帐', act: () => this.campNode(w) }] }; }
          d.bond = 'companion'; d.bondUntil = s.end ?? g.day + 60; g.npcs.summon(d.id); g.rel.addFavor(d, 5);
          return { speaker: d.name, look: (g.npcs as any).look(d), text: pick(['道友相邀，岂敢不来！', '早就想会会那帮人了。', '你我联手，正好去前线走一遭。']), options: [{ label: '回军帐', act: () => this.campNode(w) }] };
        } })),
        { label: '回军帐', act: () => this.campNode(w) },
      ],
    };
  }
  private shopNode(w: WarDef): DNode {
    const g = this.game;
    return {
      speaker: '军需官', title: `战功 ${this.merit}`, mood: 'normal', text: '斩敌一人记功，胜一阵记大功。战功在各处大战的军帐通用。',
      options: [
        ...MERIT_SHOP.map(([id, n, cost]): DOpt => ({ label: `${itemDef(id).name}${n > 1 ? ' ×' + n : ''}　—　${cost} 战功`, disabled: this.merit < cost, act: () => { this.merit -= cost; C.addItem(g.hero, id, n); g.toast(`以 ${cost} 战功换得${itemDef(id).name}${n > 1 ? ' ×' + n : ''}`, 'good'); return this.shopNode(w); } })),
        { label: '回军帐', act: () => this.campNode(w) },
      ],
    };
  }

  // ------------------------------------------------------------ 前线接战
  private foeSide(w: WarDef, s: WarState) { return w.sides[1 - (s.side ?? 0)]; }
  private mkFoe(w: WarDef, s: WarState, x: number, y: number, realm: number | null, boss = false, cap = 5, ours = false) {
    const side = ours ? w.sides[s.side ?? 0] : this.foeSide(w, s);
    const sid = pick(side.sects.filter((x) => SECT_DEF.has(x)));
    const def = SECT_DEF.get(sid)!;
    // 敌兵也出自名册：杀了就少一个
    let i = -1;
    // 第三十七步：realm 为 null = 名册里随便谁（炼气弟子居多，自然分布）；首领 = 本宗在世最强的、但不出动太上
    if (boss) { let br = -1; for (let k = 1; k < Math.min(def.n, 48); k++) { if (this.game.roster.isDead(sid, k) || this.game.roster.canonAt(sid, k)) continue; const m = member(def, k, this.game.roster.gen(sid, k)); if (m.rank === '太上长老' || m.realm > cap) continue; if (m.realm > br) { br = m.realm; i = k; } } }
    else if (realm === null) { for (let t = 0; t < 30; t++) { const k = 1 + Math.floor(Math.random() * (def.n - 1)); if (this.game.roster.isDead(sid, k) || this.game.roster.canonAt(sid, k)) continue; const m = member(def, k, this.game.roster.gen(sid, k)); if (m.rank === '太上长老' || m.realm > cap) continue; i = k; break; } }
    else for (let t = 0; t < 30; t++) { const k = 1 + Math.floor(Math.random() * (def.n - 1)); const m = member(def, k, this.game.roster.gen(sid, k)); if (!this.game.roster.isDead(sid, k) && Math.abs(m.realm - realm) <= (boss ? 1 : 0) && !this.game.roster.canonAt(sid, k)) { i = k; break; } }
    const m = i >= 0 ? member(def, i, this.game.roster.gen(sid, i)) : null;
    if (!m && realm === null && !boss) return null;
    const r = Math.max(1, Math.min(5, m?.realm ?? realm ?? 1)), stg = Math.min(m?.stage ?? 0, REALMS[r].hp.length - 1);
    const e = new Enemy(ENEMIES[r >= 3 ? 'jindan_mo' : r >= 2 ? 'zhujixiu' : 'moxiu'], x, y, r, stg);
    e.look = randomLook(mulberry32(m?.seed ?? Math.floor(Math.random() * 1e9)), m?.sex === 'f' ? 'female' : r >= 3 ? 'elder' : 'cultivator');
    (e.look as any).robe = def.robe ?? (e.look as any).robe;
    if (m?.sex) (e.look as any).sex = m.sex;
    e.name = m ? `${def.name}${m.rank}${m.name}` : `${side.name}修士`;
    e.school = side.school || sid; e.aggro = true;
    (e as any).warRos = i >= 0 ? [sid, i] : undefined;
    if (boss) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 2.6); e.atk *= 1.15; }
    // 第三十九步：两军对垒——你这边的同门同盟也在阵中厮杀
    if (ours) { e.tag = 'war:ally'; this.game.combat.addAlly(e); }
    else { e.team = `war:${w.id}`; this.game.combat.enemies.push(e); }
    return e;
  }
  private startBattle(w: WarDef, s: WarState) {
    const g = this.game, fr = w.front();
    s.lastFight = g.day;
    this.battle = { war: w.id, wave: 0, foes: [], t: 0, x: fr.x, y: fr.y, allies: [] };
    this.spawnWave();
    g.toast(`${w.name}·接敌！${this.foeSide(w, s).name}的修士从${fr.name}杀来——共三波。${this.battle.allies.length}名${w.sides[s.side ?? 0].name}同袍与你并肩，两阵混战！`, 'warn');
    g.juice?.(0.1, 0.5);
  }
  private spawnWave() {
    const B = this.battle!, g = this.game, w = WAR_BY_ID.get(B.war)!, s = this.st(B.war), p = g.player;
    const hr = Math.max(1, g.hero.realm), n = [6, 7, 6][B.wave];
    const a0 = Math.atan2(B.y - p.y, B.x - p.x);
    B.foes = [];
    // 第三十七步：敌阵是对方名册里的真人——大多是炼气、筑基弟子；另有一两个与你同阶的冲你而来（若对方有这样的人）
    for (let k = 0; k < n; k++) {
      const a = a0 + (k - (n - 1) / 2) * 0.32, R = 620 + Math.random() * 200;
      const peer = k < 2 && Math.random() < (B.wave === 0 && k === 1 ? 0.5 : 0.85);
      const e = this.mkFoe(w, s, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, peer ? Math.min(4, hr) : null, false, 4) ?? this.mkFoe(w, s, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, null, false, 4);
      if (e) { B.foes.push(e); if (peer) e.hunt = true; }
    }
    // 每一波至少有一个专冲你来的（与你境界最接近者）——混战之中，你也躲不掉
    if (B.foes.length && !B.foes.some((e) => e.hunt)) { const h0 = B.foes.reduce((b, e) => (Math.abs(e.realm - hr) < Math.abs(b.realm - hr) ? e : b)); h0.hunt = true; }
    // 第三十九步：我方阵线——补足到四五人，站在你身侧与身后；他们会自己找对手厮杀，敌人也不会全冲着你来
    B.allies = B.allies.filter((e) => !e.dead && !e.gone);
    const want = [5, 5, 5][B.wave];
    // 我方的阵容照着敌阵来：对面出一个结丹长老，我们这边也有一个（名册里有的话）——否则炼气弟子只是送死
    const mirror = B.foes.map((e) => e.realm).sort((x, y) => y - x);
    for (let k = B.allies.length, i = 0; k < want; k++, i++) {
      const a = a0 + Math.PI + (i - (want - 1) / 2) * 0.55, R = 160 + Math.random() * 160;
      const rr = mirror[i] ?? null;
      const e = this.mkFoe(w, s, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, rr, false, 4, true) ?? (rr !== null && rr > 1 ? this.mkFoe(w, s, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, rr - 1, false, 4, true) : null) ?? this.mkFoe(w, s, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8, null, false, 4, true);
      if (e) { B.allies.push(e); g.combat.vfx.push({ kind: 'blinkfx', x: e.x, y: e.y, r: 70, t: 0, dur: 0.5, color: '200,230,255' }); }
    }
    if (B.wave === 2) { const e = this.mkFoe(w, s, p.x + Math.cos(a0) * 760, p.y + Math.sin(a0) * 600, null, true, Math.min(4, hr + 1)); if (e) { B.foes.push(e); if (e.realm < hr) g.toast(`对面领兵的不过是${realmName(e.realm, e.stage)}的${e.name}——对方的老怪们没来。`, 'info'); } }
  }
  private battleTick(dt: number) {
    const B = this.battle; if (!B) return;
    const g = this.game, p = g.player, w = WAR_BY_ID.get(B.war)!, s = this.st(B.war);
    // 阵亡的敌兵记入名册
    for (const e of B.foes) if (e.dead && !(e as any).warCounted) {
      (e as any).warCounted = true;
      const r = (e as any).warRos as [string, number] | undefined;
      if (r) { const f = g.ws.flags as any; f.ros ??= {}; const st = (f.ros[r[0]] ??= {}); (st.d ??= []); if (!st.d.includes(r[1])) st.d.push(r[1]); if (!e.npcKill) g.rel.addSect(r[0], -1.5); }
      // 第三十九步：战功只记你亲手斩的；同袍斩敌，全阵沾一点光
      if (!e.spar && !e.npcKill) { const m = e.boss ? 30 : 6 + e.realm * 3; this.merit += m; g.combat.texts.push({ x: e.x, y: e.y - 90, s: `战功 +${m}`, color: '#ffd27a', t: 0, vy: -36 }); }
      else if (e.npcKill && e.killer?.ally) { this.merit += 1; g.combat.texts.push({ x: e.x, y: e.y - 90, s: '同袍斩敌', color: '#a8e0b8', t: 0, vy: -30 }); }
    }
    // 我方阵亡者同样记入名册
    for (const e of B.allies) if (e.dead && !(e as any).warCounted) {
      (e as any).warCounted = true;
      const r = (e as any).warRos as [string, number] | undefined;
      if (r) { const f = g.ws.flags as any; f.ros ??= {}; const st = (f.ros[r[0]] ??= {}); (st.d ??= []); if (!st.d.includes(r[1])) st.d.push(r[1]); }
    }
    if (g.hero.dead || Math.hypot(B.x - p.x, B.y - p.y) > 4200) {
      for (const e of B.foes) if (!e.dead) { e.dead = true; e.deathT = 0.9; }
      g.combat.dismissAllies((e) => e.tag === 'war:ally');
      s.score -= 5; this.battle = null;
      g.toast(g.hero.dead ? `${w.name}：你重伤败退，此阵失利。` : `你脱离了战场——${w.name}此阵失利。`, 'warn');
      return;
    }
    if (B.foes.some((e) => !e.dead)) return;
    B.t += dt; if (B.t < 2.5) return; B.t = 0;
    B.wave++;
    if (B.wave < 3) { this.spawnWave(); g.toast(B.wave === 2 ? `第三波——${this.foeSide(w, s).name}的领军亲自出手了！` : '第二波敌军压上！', 'warn'); return; }
    // 胜
    this.battle = null;
    g.combat.dismissAllies((e) => e.tag === 'war:ally');
    s.wins = (s.wins ?? 0) + 1; s.score = Math.max(-100, Math.min(100, s.score + (s.side === 0 ? 9 : -9)));
    const m = 40 + 20 * g.hero.realm; this.merit += m;
    const ling = Math.round(120 * Math.pow(2.6, g.hero.realm)); C.addItem(g.hero, 'mat_lingshi', ling);
    for (const sid of w.sides[s.side!].sects) g.rel.addSect(sid, 1.5);
    g.toast(`${w.name}·此阵大胜！战功 +${m}，赏灵石 ${ling}`, 'good');
    g.rel.log(`你在${w.front().name}随${w.sides[s.side!].name}大胜一阵。`, 'good');
  }
  private finish(w: WarDef, s: WarState) {
    const g = this.game, win: 0 | 1 = s.score >= 0 ? 0 : 1, W = w.sides[win], L = w.sides[1 - win];
    g.news(`${w.name}落幕：${W.name}击退${L.name}${Math.abs(s.score) > 50 ? '，大获全胜' : '，惨胜收兵'}。`, 'canon');
    // 战火真实地消耗着各宗门人
    for (const side of [W, L]) for (const sid of side.sects) {
      const def = SECT_DEF.get(sid); if (!def) continue;
      const f = g.ws.flags as any; f.ros ??= {}; const st = (f.ros[sid] ??= {}); st.d ??= [];
      const loss = Math.round(def.n * (side === L ? rand(0.04, 0.08) : rand(0.01, 0.03)));
      for (let k = 0; k < loss; k++) { const i = Math.floor(def.n * 0.3 + Math.random() * def.n * 0.7); if (!st.d.includes(i) && !g.roster.canonAt(sid, i)) st.d.push(i); }
    }
    if (s.side !== undefined) {
      const won = s.side === win, bonus = won ? 60 + 30 * (s.wins ?? 0) : 10 * (s.wins ?? 0);
      this.merit += bonus;
      for (const sid of w.sides[s.side].sects) g.rel.addSect(sid, won ? 6 : 2);
      g.ws.rep = Math.max(-100, Math.min(100, g.ws.rep + (w.sides[s.side].evil ? -4 : 4) * Math.min(3, s.wins ?? 0)));
      g.toast(`${w.name}结束——${won ? '你所在的一方胜了' : '你所在的一方败了'}。战功 +${bonus}`, won ? 'good' : 'warn');
    } else if (this.sideOf(w) !== undefined && g.hero.realm >= 2 && this.inbox.some((j) => j.war === w.id && j.kind === '召集' && j.day >= (s.start ?? 0))) {
      g.rel.addSect(g.ws.sect!.id, -12); g.toast(`${w.name}已结束——你身为门人却临阵不至，${sectTitle(g.ws.sect!.id)}对你颇为不满。`, 'warn');
    }
    // 军营散去
    for (const d of g.npcs.list) if ((d as any).war === w.id) { (d as any).war = undefined; d.stay = false; if (d.home0) { d.home = d.home0; d.home0 = undefined; } if (d.bond === 'companion' && d.bondUntil !== undefined) d.bondUntil = g.day; }
    s.phase = 'idle'; s.side = undefined; s.camp = false; s.next = g.day + w.every * YEAR * rand(0.8, 1.2);
    if (this.battle?.war === w.id) { this.battle = null; g.combat.dismissAllies((e) => e.tag === 'war:ally'); }
  }

  // ------------------------------------------------------------ 玉符
  private randomJade() {
    const g = this.game, h = g.hero, N = g.npcs.list;
    const r = Math.random();
    const friends = N.filter((d) => d.alive && d.met && d.favor >= 20 && d.realm >= 1 && !d.beauty && !d.stay && !d.bond && !d.hunting);
    const foes = N.filter((d) => d.alive && (d.grudge ?? 0) >= 1 && d.realm >= 1 && !d.hunting && !d.chasing && !d.beauty && !d.vow);
    if (r < 0.3 && friends.length && !this.inbox.some((j) => j.kind === '求救' && !j.done)) {
      const d = pick(friends), home = LOC_BY_ID.get(d.home);
      if (!home || home.map !== ACTIVE_MAP) return;
      const a = Math.random() * Math.PI * 2, x = home.x * WORLD_SCALE + Math.cos(a) * rand(2500, 4500), y = home.y * WORLD_SCALE + Math.sin(a) * rand(1800, 3200);
      this.send({ kind: '求救', from: d.name, fromId: d.id, text: `韩兄！我在${home.name}${dirName(x - home.x * WORLD_SCALE, y - home.y * WORLD_SCALE)}方被一伙劫修围住了，灵力将尽……若能赶来，此恩必报！\n\n（五日之内赶到——地图上已标出位置）`, x, y, until: g.day + 5 });
    } else if (r < 0.5 && foes.length) {
      const d = pick(foes), home = LOC_BY_ID.get(d.home);
      if (!home || home.map !== ACTIVE_MAP) return;
      const x = home.x * WORLD_SCALE + rand(-3000, 3000), y = home.y * WORLD_SCALE + rand(-2200, 2200);
      this.send({ kind: '战书', from: d.name, fromId: d.id, text: `韩立：${d.why ?? '你我之间的旧账'}，躲躲藏藏不是丈夫所为。七日之内，${home.name}外${dirName(x - home.x * WORLD_SCALE, y - home.y * WORLD_SCALE)}方，一决生死。\n\n——${d.name}（${realmName(d.realm, d.stage)}）`, x, y, until: g.day + 7 });
    } else if (r < 0.75) {
      const merch = N.filter((d) => d.alive && (d.faction === 'merchant' || (d.met && d.favor >= 0)) && d.realm >= 1);
      const d = merch.length ? pick(merch) : null; if (!d) return;
      const tier = Math.max(1, Math.min(5, h.realm + (Math.random() < 0.3 ? 1 : 0)));
      // 第三十七步：私下转手的也得是当地真有的东西；原著有主之宝不会有人拿来卖
      const z = zoneOfLoc(LOC_BY_ID.get(d.home));
      const goods = ITEM_LIST.filter((it) => (it.type === 'artifact' || it.type === 'pill' || it.type === 'talisman' || it.type === 'material' || it.type === 'herb') && it.price >= 150 && it.tier <= tier + 1 && it.tier >= tier - 2 && ruleOf(it).g >= 2 && sellableAt(it, z, 4, yaodanCap(pzOf(z), 3)));
      if (!goods.length) return;
      const it = pick(goods), id = it.id, price = Math.round(Math.max(200, it.price * priceMul(it, z)) * rand(0.6, 0.85));
      this.send({ kind: '交易', from: d.name, fromId: d.id, text: `听闻道友在寻${it.name}。在下手上恰有一件，急需灵石周转，${price} 灵石便让与道友——比坊市便宜不少。三日内回信即可。`, item: id, price, n: 1, until: g.day + 3 });
    } else if (friends.length) {
      const d = pick(friends);
      this.send({ kind: '邀约', from: d.name, fromId: d.id, text: pick([`近来修行略有所得，想请道友前来论道一番，不知可有闲暇？`, `寒舍新得了一壶灵茶，道友若路过${LOC_BY_ID.get(d.home)?.name ?? '敝处'}，务必来坐坐。`]), until: g.day + 20 }, true);
    }
  }
  private expire(j: Jade) {
    const g = this.game, d = j.fromId ? g.npcs.byId.get(j.fromId) : undefined;
    j.done = true;
    if (j.kind === '求救' && d && d.alive) {
      if (Math.random() < 0.45) { g.npcs.die(d, '被劫修围杀'); g.rel.log(`${d.name}向你求救，你没有去。后来听说${d.sex === 'f' ? '她' : '他'}死在了劫修手里。`, 'bad'); }
      else { g.rel.addFavor(d, -20); g.rel.log(`${d.name}向你求救，你没有去。${d.sex === 'f' ? '她' : '他'}侥幸脱身，从此与你疏远。`, 'bad'); }
    } else if (j.kind === '战书' && d && d.alive) {
      g.ws.rep = Math.max(-100, g.ws.rep - 4);
      g.news(`${d.name}在${LOC_BY_ID.get(d.home)?.name ?? '城中'}外苦等七日，韩立始终未曾露面——此事已传为笑谈。`, 'rumor');
      d.huntAt = g.day + rand(3, 10); d.grudge = Math.max(d.grudge, 2);
    }
  }
  /** 地图标记 */
  marks(): { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] {
    const out: { x: number; y: number; glyph: string; color: string; ring?: number; name: string }[] = [];
    for (const w of WARS) {
      const s = this.st(w.id); if (s.phase === 'idle' || ACTIVE_MAP !== w.map) continue;
      const fr = w.front();
      out.push({ x: fr.x, y: fr.y, glyph: '战', color: '#ff6a3a', ring: s.phase === 'battle' ? 1700 : undefined, name: `${w.name}·${fr.name}${s.phase === 'call' ? '（召集中）' : ''}` });
      for (const k of [0, 1] as const) { const R = LOC_BY_ID.get(w.sides[k].rally)!; if (s.side === undefined || s.side === k) out.push({ x: R.x * WORLD_SCALE, y: R.y * WORLD_SCALE + 260, glyph: '旗', color: k === s.side ? '#ffd27a' : '#c8b8a0', name: `${w.sides[k].name}集结点` }); }
    }
    for (const j of this.inbox) if (!j.done && j.x !== undefined && (j.kind === '求救' || (j.kind === '战书' && (j as any).accepted))) out.push({ x: j.x, y: j.y!, glyph: j.kind === '求救' ? '援' : '决', color: j.kind === '求救' ? '#7fd0ff' : '#ff4a4a', name: j.kind === '求救' ? `${j.from}遇险` : `与${j.from}决斗之地` });
    return out;
  }
  // 求救 / 战书到场
  private sosTick() {
    const g = this.game, p = g.player;
    for (const j of this.inbox) {
      if (j.done || j.x === undefined || Math.hypot(j.x - p.x, j.y! - p.y) > 1500) continue;
      const d = j.fromId ? g.npcs.byId.get(j.fromId) : undefined;
      if (!d || !d.alive) { j.done = true; continue; }
      if (j.kind === '求救' && !(j as any).spawned) {
        (j as any).spawned = true; this.sosFoes = [];
        // 第三十七步：敢围攻你朋友的，是冲着他的境界来的，而不是冲着你
        const r = Math.max(1, Math.min(4, d.realm + (Math.random() < 0.3 ? 1 : 0)));
        d.map = ACTIVE_MAP; d.helpUntil = g.time + 120; g.npcs.summon(d.id);
        for (let k = 0; k < 3 + (r >= 2 ? 1 : 0); k++) {
          const a = (k / 4) * Math.PI * 2;
          const e = new Enemy(ENEMIES[r >= 3 ? 'jindan_mo' : r >= 2 ? 'zhujixiu' : 'bandit'], j.x + Math.cos(a) * 300, j.y! + Math.sin(a) * 220, Math.max(1, r - (k ? (Math.random() < 0.6 ? 1 : 0) : 0)), Math.floor(Math.random() * 3));
          e.name = k === 0 ? '劫修头目' : '劫修'; e.aggro = true; e.tag = e.tag ?? 'sos'; e.school = 'jiexiu'; if (k === 0) { e.boss = true; e.maxHp = e.hp = Math.round(e.hp * 1.5); }
          g.combat.enemies.push(e); this.sosFoes.push(e);
        }
        g.toast(`${d.name}就在前面，被劫修围住了！`, 'warn');
      } else if (j.kind === '求救' && (j as any).spawned && this.sosFoes.length && this.sosFoes.every((e) => e.dead)) {
        j.done = true; this.sosFoes = [];
        g.rel.addFavor(d, 25); const n = Math.round(60 * Math.pow(3, d.realm)); C.addItem(g.hero, 'mat_lingshi', n);
        g.toast(`救下了${d.name}！好感大增，${d.sex === 'f' ? '她' : '他'}硬塞给你 ${n} 灵石`, 'good'); g.rel.log(`你赶去救下了遇险的${d.name}。`, 'good');
      } else if (j.kind === '战书' && (j as any).accepted && !(j as any).spawned) {
        (j as any).spawned = true; j.done = true;
        d.grudge = Math.max(d.grudge, 2); d.why ??= '约战';
        g.rel.startHunt(d, true, true);
        d.x = j.x + 500; d.y = j.y!; d.tx = p.x; d.ty = p.y;
        g.toast(`${d.name}已在此等候多时——「来得好！」`, 'warn');
      }
    }
  }

  // ------------------------------------------------------------ 玉符面板
  inboxNode(): DNode {
    const g = this.game, list = [...this.inbox].reverse().slice(0, 12);
    const tag = (j: Jade) => `${j.read ? '' : '● '}【${j.kind}】${j.from}${j.done ? '（已了）' : j.until !== undefined ? `（余 ${Math.max(0, Math.ceil(j.until - g.day))} 日）` : ''}`;
    return {
      speaker: '传音玉符', title: `${this.unread} 封未读 · 战功 ${this.merit}`, mood: 'mystic',
      text: list.length ? '玉符中封存着各方传来的音讯。' : '玉符静悄悄的，没有新的传音。',
      options: [...list.map((j): DOpt => ({ label: tag(j), tone: j.done ? undefined : j.kind === '求救' || j.kind === '战书' ? 'bad' : j.kind === '召集' ? 'gold' : 'good', act: () => this.jadeNode(j) })), { label: '收起', act: () => null }],
    };
  }
  jadeNode(j: Jade): DNode {
    const g = this.game; j.read = true;
    const d = j.fromId ? g.npcs.byId.get(j.fromId) : undefined;
    const head = { speaker: j.from, title: `传音玉符 · ${j.kind}`, look: d ? (g.npcs as any).look(d) : undefined };
    const back: DOpt = { label: '收起', act: () => this.inboxNode() };
    const opts: DOpt[] = [];
    const w = j.war ? WAR_BY_ID.get(j.war) : undefined, s = w ? this.st(w.id) : undefined;
    if (!j.done && w && s && s.phase !== 'idle') {
      if (j.kind === '召集' && s.side === undefined) {
        if (j.side !== undefined) opts.push({ label: `应召，赶赴${LOC_BY_ID.get(w.sides[j.side].rally)?.name}`, tone: 'gold', act: () => { j.done = true; this.enlist(w, j.side!); return null; } });
        else for (const k of [0, 1] as const) opts.push({ label: `投效${w.sides[k].name}`, tone: 'gold', act: () => { j.done = true; this.enlist(w, k); return null; } });
        opts.push({ label: '置之不理', act: () => { j.done = true; if (j.side !== undefined) g.rel.addSect(g.ws.sect!.id, -4); return this.inboxNode(); } });
      } else if (j.kind === '邀约' && s.side === undefined && d?.alive) {
        opts.push({ label: `答应同去（随${d.name}投效${w.sides[j.side ?? 0].name}）`, tone: 'love', act: () => { j.done = true; this.enlist(w, j.side ?? 0, d); return null; } });
        opts.push({ label: '婉拒', act: () => { j.done = true; g.rel.addFavor(d, -3); return this.inboxNode(); } });
      }
    } else if (!j.done && d?.alive) {
      if (j.kind === '求救') opts.push({ label: `立刻赶去（${dirName(j.x! - g.player.x, j.y! - g.player.y)}方约 ${Math.max(1, Math.round(Math.hypot(j.x! - g.player.x, j.y! - g.player.y) / 260))} 里）`, tone: 'love', act: () => { g.destination = { x: j.x!, y: j.y! }; return null; } });
      if (j.kind === '战书' && !(j as any).accepted) {
        opts.push({ label: '回书：届时必到', tone: 'bad', act: () => { (j as any).accepted = true; g.destination = { x: j.x!, y: j.y! }; return null; } });
        opts.push({ label: '不予理会', act: () => { this.expire(j); return this.inboxNode(); } });
      }
      if (j.kind === '交易' && j.item) {
        const have = C.bagCount(g.hero, 'mat_lingshi');
        opts.push({ label: `成交（${j.price} 灵石，现有 ${have}）`, tone: 'good', disabled: have < (j.price ?? 0), act: () => { j.done = true; C.removeItem(g.hero, 'mat_lingshi', j.price!); C.addItem(g.hero, j.item!, j.n ?? 1); g.rel.addFavor(d, 3); g.toast(`与${d.name}成交：得${itemDef(j.item!).name}`, 'good'); return this.inboxNode(); } });
        opts.push({ label: '不要', act: () => { j.done = true; return this.inboxNode(); } });
      }
      if (j.kind === '邀约' && !j.war) {
        opts.push({ label: '前去拜访（立即动身，耗时两日）', tone: 'love', act: () => {
          j.done = true; g.passDays(2); g.rel.addFavor(d, 8);
          const msgs: C.Msg[] = []; const exp = C.need(g.hero) * C.INSIGHT * 0.03; C.gainExp(g.hero, exp, msgs);
          return { ...head, text: `你与${d.name}品茶论道，彼此印证所学，颇有所得。\n\n好感 +8，修为 +${Math.round(exp)}`, options: [back] };
        } });
        opts.push({ label: '婉拒', act: () => { j.done = true; return this.inboxNode(); } });
      }
    }
    opts.push(back);
    return { ...head, mood: j.kind === '求救' || j.kind === '战书' ? 'danger' : j.kind === '召集' ? 'mystic' : 'normal', text: j.text, options: opts };
  }
}
