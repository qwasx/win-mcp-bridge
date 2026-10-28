// 第五阶段·杀人夺宝、怀璧其罪（玩家这一侧）
//
// · 露白与目击：当着人用了宝 / 在坊市卖了好东西 / 拍卖会拍到重宝 → 附近真实的 NPC 看在眼里（目击者名单）；
//   目击者离开你的视线（或过了三日）消息才传出去，记成传闻、按距离一圈圈扩散；听说的人掂量「打不打得过、贪不贪」，
//   贪心又自认能赢的，真的从地图上动身来抢（aim = covet，走 sim 的实时赶路，到了近处化为追杀）。
// · 对策：敛气（看不清修为——谨慎的人不敢动，莽撞的人可能看走眼）、蒙面（杀人不记名、传闻里只有「蒙面修士」，远处的人找不到你）、
//   人前不亮宝（没有目击者就没有事）、杀人灭口（目击者在消息传出前全死了，传闻就不出去）。
// · 宝物来历 / 烙印 / 炼化：见 sim/prov.ts。抢来的宝威力打六折，打坐或闭关炼化；抹掉前原主（死了就是原主师门）循着感应追来。
// · 死亡掉储物袋：被真实的 NPC 打倒时，储物袋（本命法宝青竹蜂云剑与剧情物件除外）归他；你醒来后可循着自己留在袋中法宝上的烙印找他报仇。
// · 销赃：正道坊市认得出有主的宝物，不收，还可能报给原主宗门；城中鬼市、魔道交换会肯收，但压价。
import type { Game } from './game';
import type { NpcData } from './npc';
import type { Shop } from './modal';
import { itemDef } from '../data/items';
import { realmName } from '../data/realms';
import { LOC_BY_ID, ACTIVE_MAP, type LocDef } from '../data/world';
import { zoneOfLoc, cityTier } from '../data/market';
import { mulberry32, hashU } from '../core/rng';
import * as C from './cultivation';
import { npcPower } from './sim/world';
import { power, bagPut, reequip, lootText, type BagItem } from './sim/kit';
import { provOf, provFind, provMove, provMoveAll, provRefine, provHot, tracked, uidText, HOW_NAME, setProvCanon, type Prov } from './sim/prov';

export interface Tip { id: number; day: number; x: number; y: number; map: string; item: string; how: 'use' | 'sell' | 'auction'; wit: string[]; masked?: 1; conc?: 1; out?: number; R: number; hunters: number; dead?: 1; killed?: number }
export interface TrState { tips: Tip[]; seq: number; lost?: { id: string; name: string; day: number; what: string }; masked?: boolean; reported?: Record<string, number>; shown?: Record<string, number> }

const BAG_KEEP = new Set(['art_qingzhu']);   // 本命法宝：与心神相连，夺不走
const SIGHT = 2600;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hstr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
const sectOf = (d: NpcData) => d.sect ?? d.ros;
const roams = (d: NpcData) => !d.stay && !d.beauty && !d.ros && !d.gz && !d.bond && !d.hidden && !d.chasing;
const DIRS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];

export class TreasureSys {
  private acc = 0; private scanT = 0; private senseT = 25; private lastDay = -1;
  private struck = new Set<string>();
  constructor(public g: Game) { setProvCanon(Object.values((g.npcs?.constructor as any)?.TREASURE ?? {}).flat() as string[]); }

  get S() { return this.g.npcs.sim.S; }
  get T(): TrState { const S = this.S as any; const t = S.tr as TrState | undefined; if (t && Array.isArray(t.tips)) return t; const n: TrState = { tips: [], seq: 1 }; S.tr = n; return n; }
  get masked() { return !!this.T.masked; }
  private rng(...k: number[]) { let h = this.S.seed | 0; for (const x of k) h = (Math.imul(h ^ (x | 0), 2654435761) + 0x9e3779b9) | 0; return mulberry32((hashU(h, k.length, 91) * 4294967296) >>> 0); }
  private heroName() { return this.masked ? '一名蒙面修士' : this.g.player.name; }
  private heroPower() { return power(this.g.npcs.sim.host.hero()); }
  private where(x: number, y: number) { return this.g.npcs.sim.where(ACTIVE_MAP, x, y); }
  private dirText(x: number, y: number) { const p = this.g.player, dd = Math.hypot(x - p.x, y - p.y); return `${DIRS[(Math.round(Math.atan2(y - p.y, x - p.x) / (Math.PI / 4)) + 8) % 8]}方约${Math.max(1, Math.round(dd / 1000))}里外`; }

  // ------------------------------------------------------------ 蒙面
  toggleMask() {
    const T = this.T, g = this.g;
    if (!T.masked && g.combat.safeAt(g.player.x, g.player.y)) { g.toast('城中耳目众多，蒙面反倒惹人生疑——出了城再说。', 'warn'); return; }
    T.masked = !T.masked;
    g.toast(T.masked ? '你以黑巾蒙面、略施易容之术。此后出手，旁人只当是个来历不明的蒙面修士。（V 揭下）' : '你揭下面巾，恢复本来面目。', T.masked ? 'good' : 'info');
    g.updateUI?.(true);
  }

  // ------------------------------------------------------------ 露白
  /** 玩家亮了宝：use = 当面祭出；sell = 坊市里卖出；auction = 拍卖会上拍得 */
  onShow(item: string, how: Tip['how']) {
    const g = this.g, p = g.player, day = g.day, T = this.T;
    if (!tracked(item) || (g.travel?.pending?.map ?? ACTIVE_MAP) !== ACTIVE_MAP) return null;
    const key = item + how; T.shown = T.shown ?? {};
    if (how === 'use' && day - (T.shown[key] ?? -99) < 2) return null;   // 同一件宝两日内只算一次
    const R = how === 'auction' ? 3200 : how === 'sell' ? 1600 : SIGHT;
    const wit: string[] = [];
    for (const d of g.npcs.list) {
      if (!d.alive || d.hidden || (d.map ?? 'tiannan') !== ACTIVE_MAP || d.bond || d.beauty) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) > R) continue;
      wit.push(d.id);
    }
    if (!wit.length) return null;   // 人前不亮宝：没人看见，就没有这回事
    T.shown[key] = day;
    const tip: Tip = { id: T.seq++, day, x: p.x, y: p.y, map: ACTIVE_MAP, item, how, wit, R: 0, hunters: 0, masked: this.masked ? 1 : undefined, conc: g.concealed ? 1 : undefined };
    T.tips.push(tip); if (T.tips.length > 30) T.tips.splice(0, T.tips.length - 30);
    // 当场看见的人：贪心又自认打得过的，此刻就动了心思
    this.spread(tip, SIGHT + 1, true);
    if (wit.length >= 2 || how !== 'use') g.toast(`${itemDef(item).name}宝光外露——${wit.length}道目光在你身上停了一停。`, 'warn');
    return tip;
  }

  /** 传闻扩散到半径 R：圈内新听说的人逐一掂量 */
  private spread(tip: Tip, R: number, now = false) {
    const g = this.g, p = g.player, hp = this.heroPower(), it = itemDef(tip.item);
    const value = [1, 1, 1, 1, 1.35, 1.8, 2.2][it.tier] ?? 1;
    const live = this.T.tips.reduce((n, t) => n + t.hunters, 0);
    const pool: NpcData[] = [];
    for (const d of g.npcs.list) {
      if (!d.alive || d.realm <= 0 || d.faction === 'mortal' || (d.map ?? 'tiannan') !== tip.map || !roams(d) || d.hunting) continue;
      const k = d.aim?.k; if (k === 'covet' || k === 'bounty' || k === 'probe') continue;
      const dd = Math.hypot(d.x - tip.x, d.y - tip.y); if (dd > R || dd <= tip.R) continue;
      if (tip.masked && !tip.wit.includes(d.id)) continue;   // 蒙面：没亲眼见着的人，连找谁都不知道
      pool.push(d);
    }
    tip.R = R;
    pool.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    for (const d of pool) {
      if (tip.hunters >= 3 || live + tip.hunters >= 4) break;
      if (g.ws.sect?.id && sectOf(d) === g.ws.sect.id) continue;
      if (d.favor > 30) continue;
      const r = this.rng(hstr(d.id), tip.id, 7);
      let greed = d.pers === 'ruthless' ? 0.7 : d.pers === 'greedy' ? 0.6 : d.pers === 'arrogant' ? 0.35 : d.pers === 'cautious' ? 0.1 : d.pers === 'righteous' || d.pers === 'kind' ? 0.03 : 0.15;
      if (d.faction === 'demon') greed += 0.25; else if (d.faction === 'rogue') greed += 0.1;
      greed *= value;
      // 敛气：看不清修为——谨慎、正派的人不敢妄动；其余的人看走眼的可能高也可能低
      let seen = hp;
      if (tip.conc) { if (d.pers === 'cautious' || d.pers === 'righteous' || d.pers === 'kind') continue; seen = hp * (0.4 + 1.6 * r()); }
      const pw = npcPower(d);
      if (pw < seen * (d.pers === 'arrogant' ? 0.8 : 1.1)) continue;
      if (r() >= greed) continue;
      this.covet(d, tip, now);
    }
  }
  /** 此人动了贪念：真的动身来找你 */
  covet(d: NpcData, tip: Tip | null, now: boolean, why?: string, item?: string) {
    const g = this.g, p = g.player, day = g.day, iid = tip?.item ?? item ?? '';
    const nm = itemDef(iid)?.name ?? '宝物';
    d.aim = { k: 'covet', x: p.x, y: p.y, who: 'hero', t0: day, item: iid }; d.tx = p.x; d.ty = p.y;
    d.why = why ?? `觊觎你的${nm}`;
    d.huntAt = undefined;
    if (tip) tip.hunters++;
    this.struck.delete(d.id);
    const sim = g.npcs.sim;
    sim.log({ day, map: ACTIVE_MAP, x: d.x, y: d.y, k: 'covet', a: d.id, an: d.name, items: iid ? [{ id: iid, n: 1 }] : undefined, heard: day + (now ? 0.5 : 2),
      text: why ? `${d.name}（${realmName(d.realm, d.stage)}）${why}，已动身寻来。` : `${d.name}（${realmName(d.realm, d.stage)}）${now ? '亲眼瞧见' : '听人说起'}${tip?.masked ? '一名蒙面修士' : g.player.name}身怀${nm}，起了贪念，动身前来。` });
    g.toast(why ? `神识烙印一阵悸动——${d.name}循着感应追来了！` : now ? `${d.name}盯着你的${nm}，眼中闪过一丝贪婪。` : '心中莫名一悸，似有人在暗中打你的主意……', 'warn');
  }

  // ------------------------------------------------------------ 每帧
  update(dt: number) {
    const g = this.g; if (g.hero.dead) return;
    this.acc += dt; if (this.acc < 0.5) return; const step = this.acc; this.acc = 0;
    const day = g.day, T = this.T;
    if (this.lastDay < 0) this.lastDay = day;
    const dd = day - this.lastDay; this.lastDay = day;
    // 蒙面进城：自动揭下
    if (T.masked && g.combat.safeAt(g.player.x, g.player.y)) { T.masked = false; g.toast('入城须以真面目示人——你悄悄揭下了面巾。'); }
    this.scanT -= step; if (this.scanT <= 0) { this.scanT = 1; this.scan(); }
    if (dd > 0) { this.tips(day); this.refine(dd, g.player.sitting || dd >= 1); if (Math.floor(day / 2) !== Math.floor((day - dd) / 2)) this.reclaim(day); }
    this.approach();
    this.senseT -= step; if (this.senseT <= 0) { this.senseT = 40; this.senseLost(); }
  }

  /** 传闻：目击者全死 → 消息断了；有人逃出视线或过了三日 → 传出去，一圈圈扩散 */
  private tips(day: number) {
    const g = this.g, p = g.player, T = this.T, sim = g.npcs.sim;
    for (const t of T.tips) {
      if (t.dead) continue;
      const alive = t.wit.map((id) => g.npcs.byId.get(id)).filter((d): d is NpcData => !!d && d.alive);
      if (!t.out) {
        if (!alive.length) {
          t.dead = 1;
          if (t.killed) g.toast(`亲眼见你亮出${itemDef(t.item).name}的人已尽数灭口——消息没有传出去。`, 'good');
          continue;
        }
        const away = alive.some((d) => (d.map ?? 'tiannan') !== ACTIVE_MAP || Math.hypot(d.x - p.x, d.y - p.y) > Math.max(SIGHT * 1.4, g.senseRadius * 1.5));
        if (away || day - t.day >= 3) {
          t.out = day; t.R = Math.max(t.R, SIGHT + 1);
          const nm = itemDef(t.item).name, who = t.masked ? '一名蒙面修士' : p.name;
          const verb = t.how === 'auction' ? '拍卖会上一掷千金，拍走了' : t.how === 'sell' ? '在坊市里出手了一件' : '当众祭出';
          const names = alive.slice(0, 3).map((d) => d.name).join('、');
          sim.log({ day: t.day, map: t.map as any, x: t.x, y: t.y, k: 'flaunt', a: t.masked ? undefined : 'hero', an: who, items: [{ id: t.item, n: 1 }], heard: day + 1,
            text: `${who}${t.conc ? '（气息内敛，看不出修为）' : ''}在${this.where(t.x, t.y)}${verb}${nm}——${names}${alive.length > 3 ? `等${alive.length}人` : ''}看在眼里，消息不胫而走。` });
        }
        continue;
      }
      // 扩散：大约一日四千步（与传闻栏一致），两月后淡去
      if (day - t.out > 60) { t.dead = 1; continue; }
      const R = Math.min(70000, SIGHT + (day - t.out) * 4000);
      if (R > t.R) this.spread(t, R);
    }
    T.tips = T.tips.filter((t) => !t.dead || day - t.day < 5);
  }

  /** 冲你来的人到了近处：现身追杀（筑基以上驾遁光，带追杀系统的全套手段） */
  private approach() {
    const g = this.g, p = g.player, R = Math.max(2400, g.senseRadius * 2.2);
    for (const d of g.npcs.list) {
      if (d.aim?.k !== 'covet' || !d.alive || this.struck.has(d.id) || (d.map ?? 'tiannan') !== ACTIVE_MAP) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) > R || g.npcs.active.has(d.id) || g.pursuit.active) continue;
      this.struck.add(d.id);
      g.rel?.startHunt(d, true, true);
      g.toast(`${d.name}（${realmName(d.realm, d.stage)}）${d.why?.startsWith('循') ? '循着烙印的感应' : '一路尾随'}追到了近处！`, 'warn');
    }
  }

  // ------------------------------------------------------------ 来历记账
  /** 储物袋里新出现的宝：认领它的来历（拾得 / 买来 / 起初就有） */
  private scan() {
    const g = this.g, h = g.hero, day = g.day, S = this.S, me = g.player.name;
    for (const b of h.bag) {
      if (!tracked(b.id) || provOf(S, b.id, 'hero', me, day, 'origin', false)) continue;
      const ground = provFind(S, (p) => p.id === b.id && p.owner.startsWith('g:'))[0];
      if (ground) { provMove(ground, 'hero', me, day, 'loot', (ground as any).gs); delete (ground as any).gs; if (ground.mark) g.toast(`${itemDef(b.id).name}上残留着${ground.mark.n}的神识烙印，驱使起来颇不顺手——需打坐或闭关炼化。`, 'warn'); continue; }
      const shop = provFind(S, (p) => p.id === b.id && p.owner.startsWith('s:'))[0];
      if (shop) { provMove(shop, 'hero', me, day, 'buy'); continue; }
      const how = (g as any).__provHow?.[b.id] ?? 'origin';
      provOf(S, b.id, 'hero', me, day, how);
    }
    // 不在袋里了的（用掉、丢了）：记账跟着消失
    for (const p of provFind(S, (p) => p.owner === 'hero')) if (!C.bagCount(h, p.id)) { p.owner = 's:?'; }
  }
  /** NPC 死后东西落在地上：记账先挂在「地上」，谁捡了归谁 */
  onNpcDrop(d: NpcData) {
    for (const p of provFind(this.S, (p) => p.owner === d.id)) { p.owner = 'g:' + d.id; (p as any).gs = sectOf(d); }
  }
  /** 物品详情里的「历任主人」 */
  provLines(id: string): { uid: string; lines: string[]; mark?: string } | null {
    const p = provOf(this.S, id, 'hero', this.g.player.name, this.g.day, 'origin', false);
    if (!p) return null;
    const ym = (d: number) => `第${Math.floor(d / 360) + 1}年${Math.floor((d % 360) / 30) + 1}月`;
    const lines = p.hist.filter((s) => !s.w.startsWith('g:')).map((s) => `${ym(s.d)}　${s.w === 'hero' ? '你' : s.n}　${HOW_NAME[s.how]}`);
    const mark = p.mark ? `残留${p.mark.n}的神识烙印：威力六折；炼化 ${Math.floor(p.mark.done)}/${p.mark.need} 日（打坐 / 闭关）。烙印未除，原主${p.mark.sect ? '及其师门' : ''}能感应到它在哪儿。` : undefined;
    return { uid: uidText(p), lines, mark };
  }
  /** 带烙印的宝威力打折 */
  powerMul(id: string) { const p = tracked(id) ? provOf(this.S, id, 'hero', '', 0, 'origin', false) : undefined; return p?.mark ? 0.6 : 1; }

  // ------------------------------------------------------------ 炼化
  private refine(dd: number, sitting: boolean) {
    const g = this.g, S = this.S, day = g.day;
    for (const p of provFind(S, (p) => !!p.mark)) {
      if (p.owner === 'hero') {
        if (!sitting) continue;
        const before = p.mark!.done;
        if (provRefine(p, dd, day)) g.toast(`炼化功成：${itemDef(p.id).name}上的神识烙印已被你抹去，宝光重焕，如臂使指。`, 'good');
        else if (Math.floor(before / 10) !== Math.floor(p.mark!.done / 10)) g.toast(`炼化${itemDef(p.id).name}：${Math.floor(p.mark!.done)}/${p.mark!.need} 日`, 'info');
      } else if (!p.owner.startsWith('g:') && !p.owner.startsWith('s:')) {
        const wasHero = p.mark!.who === 'hero';
        if (provRefine(p, dd, day) && wasHero) g.toast(`你留在${itemDef(p.id).name}上的神识烙印被人抹去了——再也感应不到它。`, 'warn');
      }
    }
  }
  /** 烙印未除：原主（死了就是原主师门）循着感应追来 */
  private reclaim(day: number) {
    const g = this.g, S = this.S, hp = this.heroPower();
    for (const p of provFind(S, (p) => p.owner === 'hero' && !!p.mark && p.mark.who !== 'hero')) {
      if (day - (p.told ?? -99) < 20) continue;
      const r = this.rng(p.uid, Math.floor(day / 2), 13);
      if (r() > 0.55) continue;
      const m = p.mark!, own = g.npcs.byId.get(m.who);
      let who: NpcData | undefined;
      if (own && own.alive && (own.map ?? 'tiannan') === ACTIVE_MAP && roams(own) && !own.hunting && own.aim?.k !== 'covet') who = own;
      else if (m.sect) {
        let bd = 1e18;
        for (const d of g.npcs.list) {
          if (!d.alive || sectOf(d) !== m.sect || (d.map ?? 'tiannan') !== ACTIVE_MAP || d.realm <= 0 || d.hunting || d.aim?.k === 'covet' || d.beauty || d.bond || d.stay || d.gz) continue;
          if (npcPower(d) < hp * 0.7) continue;
          const dd = Math.hypot(d.x - g.player.x, d.y - g.player.y); if (dd < bd) { bd = dd; who = d; }
        }
      }
      if (!who) continue;
      p.told = day;
      const nm = itemDef(p.id).name;
      this.covet(who, null, false, who === own ? `循着${nm}上残留的神识烙印，前来夺回` : `奉师门之命，循着${m.n}留在${nm}上的神识烙印前来追讨`, p.id);
    }
  }
  /** 你的东西在别人手里：循着自己的烙印感应它的方位 */
  private senseLost() {
    const g = this.g, L = this.T.lost; if (!L) return;
    const d = g.npcs.byId.get(L.id);
    const still = provFind(this.S, (p) => p.owner === L.id && p.mark?.who === 'hero');
    if (!d || !d.alive) { if (d && !d.alive) { this.T.lost = undefined; } return; }
    if (!still.length) return;
    if ((d.map ?? 'tiannan') !== ACTIVE_MAP) { g.toast(`你留在${itemDef(still[0].id).name}上的烙印远在他乡，感应极其微弱。`); return; }
    g.toast(`神识一动：你的${itemDef(still[0].id).name}在${this.dirText(d.x, d.y)}——就在${L.name}身上。`, 'info');
  }

  // ------------------------------------------------------------ 杀人不记名
  /** 蒙面时杀人：传闻里只有「蒙面修士」，不掉声望、不惹宗门寻仇 */
  anonKill(d: NpcData, x: number, y: number): boolean {
    if (!this.masked) return false;
    const g = this.g, day = g.day;
    for (const t of this.T.tips) if (t.wit.includes(d.id)) t.killed = (t.killed ?? 0) + 1;
    g.npcs.sim.log({ day, map: ACTIVE_MAP, x, y, k: 'kill', b: d.id, bn: d.name, an: '蒙面修士', seen: 1, text: `一名蒙面修士在${this.where(x, y)}斩杀了${d.name}（${realmName(d.realm, d.stage)}），扬长而去，无人知其来历。` });
    g.toast(`${d.name}陨落。你蒙着面，无人知道是谁下的手。`, 'info');
    return true;
  }
  /** 不蒙面杀了目击者：记一笔（灭口） */
  onKill(d: NpcData) { for (const t of this.T.tips) if (t.wit.includes(d.id)) t.killed = (t.killed ?? 0) + 1; }

  // ------------------------------------------------------------ 死亡掉储物袋
  /** 被真实的 NPC 打倒：储物袋归他。返回说明（无人可归时返回 null，走原来的流程） */
  onHeroDown(): string | null {
    const g = this.g, h = g.hero, p = g.player, day = g.day;
    let k: NpcData | undefined = g.pursuit.cur?.npc;
    if (!k) {
      let bd = 2200;
      for (const e of g.combat.enemies) {
        if (e.dead || !e.npcId) continue;
        const d = g.npcs.byId.get(e.npcId); if (!d || !d.alive) continue;
        const dd = Math.hypot(e.x - p.x, e.y - p.y); if (dd < bd) { bd = dd; k = d; }
      }
    }
    if (!k || !k.alive) return null;
    const take = h.bag.filter((b) => itemDef(b.id).type !== 'misc' && !BAG_KEEP.has(b.id));
    if (!take.length) return null;
    const got: BagItem[] = take.map((b) => ({ id: b.id, n: b.n, age: b.age }));
    // 记账：你的宝落到他手里，带着你的烙印
    for (const b of got) if (tracked(b.id)) provOf(this.S, b.id, 'hero', p.name, day - 1);
    provMoveAll(this.S, got, 'hero', p.name, k.id, k.name, day, 'bag', g.ws.sect?.id);
    h.bag = h.bag.filter((b) => !take.includes(b));
    h.equip = Object.fromEntries(Object.entries(h.equip ?? {}).filter(([, v]) => v && C.bagCount(h, v as string) > 0)) as any;
    h.hotbar = h.hotbar.map((x) => (x && (x.startsWith('art:') || x.startsWith('tal:')) && !C.bagCount(h, x.slice(4)) ? null : x));
    k.bag = k.bag ?? [];
    for (const b of got) { if (b.id === 'mat_lingshi') k.wealth += b.n; else bagPut(k.bag, b.id, b.n, b.age); }
    reequip(k);
    if (k.aim?.k === 'covet') k.aim = undefined;
    k.hunting = false; k.why = undefined;
    k.fame = (k.fame ?? 0) + 3;
    const what = lootText(got, 4) || '一只储物袋';
    this.T.lost = { id: k.id, name: k.name, day, what };
    g.npcs.sim.log({ day, map: ACTIVE_MAP, x: p.x, y: p.y, k: 'rob', a: k.id, an: k.name, b: 'hero', bn: p.name, items: got, seen: 1, big: 1,
      text: `${k.name}（${realmName(k.realm, k.stage)}）在${this.where(p.x, p.y)}击倒${p.name}，夺走了他的储物袋（${what}）。` });
    const marked = got.some((b) => tracked(b.id));
    return `储物袋落入${k.name}之手（${what}）。${marked ? '袋中法宝上还留着你的神识烙印——趁他炼化之前，循着感应去找他讨回来！' : '记住这张脸。'}`;
  }

  // ------------------------------------------------------------ 销赃
  /** 鬼市：大城里不问来历的地下买卖，只收不卖 */
  blackShop(l: LocDef): Shop {
    return { title: `${l.name} · 鬼市`, desc: '夜里才开张，只收货、不问来历——价钱压得极狠。', stock: [], sellRate: 0.5, zone: zoneOfLoc(l), fence: 'black' } as Shop;
  }
  hasBlack(l: LocDef) { return (l.type === 'city' || l.type === 'isle') && cityTier(l) >= 3; }
  private kindOf(shop: Shop): 'black' | 'mo' | 'zheng' { const f = (shop as any).fence; if (f === 'black') return 'black'; return shop.zone === 'mo' ? 'mo' : 'zheng'; }
  /** 这家肯不肯收、给几成 */
  fence(shop: Shop, id: string): { ok: boolean; mul: number; why?: string } {
    const kind = this.kindOf(shop);
    const p = tracked(id) ? provOf(this.S, id, 'hero', '', 0, 'origin', false) : undefined;
    const hot = provHot(p, this.g.day);
    if (!hot) return { ok: true, mul: kind === 'black' ? 0.6 : 1 };
    if (kind === 'zheng') return { ok: false, mul: 0, why: `掌柜验看片刻，脸色一变：「这件${itemDef(id).name}上${p?.mark ? `还留着${p.mark.n}的神识烙印` : '的来历，敝号查得到'}……恕本店不收来历不明之物。」` };
    return { ok: true, mul: kind === 'mo' ? 0.45 : 0.35, why: kind === 'mo' ? '魔道交换会不问来历，只是价钱压到了四成五。' : '鬼市的老头掂了掂，只肯出三成五：「有主的东西，烫手。」' };
  }
  /** 正道坊市拒收，还可能报给原主宗门 */
  refuse(shop: Shop, id: string, why?: string) {
    const g = this.g, day = g.day, T = this.T; T.reported = T.reported ?? {};
    g.toast(why ?? '掌柜不肯收。', 'warn');
    const p = provOf(this.S, id, 'hero', '', 0, 'origin', false); if (!p) return;
    const prev = p.mark ?? (() => { const s = [...p.hist].reverse().find((h) => h.w !== 'hero' && !h.w.startsWith('g:') && !h.w.startsWith('s:')); return s ? { who: s.w, n: s.n, sect: sectOf(g.npcs.byId.get(s.w) ?? ({} as NpcData)) } : undefined; })();
    if (day - (T.reported[p.uid] ?? -99) < 30) return;
    T.reported[p.uid] = day;
    g.ws.rep = clamp(g.ws.rep - 5, -100, 100);
    if (prev?.sect) {
      g.rel?.addSect(prev.sect, -12);
      const nm = LOC_BY_ID.get(prev.sect)?.name ?? '原主宗门';
      g.toast(`你前脚刚走，掌柜便暗中传讯${nm}——有人要来追究${itemDef(id).name}的来历了。`, 'warn');
      let who: NpcData | undefined, bd = 1e18;
      for (const d of g.npcs.list) { if (!d.alive || sectOf(d) !== prev.sect || (d.map ?? 'tiannan') !== ACTIVE_MAP || d.realm <= 0 || d.beauty || d.bond || d.stay || d.gz || d.hunting) continue; const dd = Math.hypot(d.x - g.player.x, d.y - g.player.y); if (dd < bd) { bd = dd; who = d; } }
      if (who) this.covet(who, null, false, `接到坊市传讯，前来追究${itemDef(id).name}的来历`, id);
    } else g.toast('掌柜看你的眼神多了几分戒备。（正道声望 -5）', 'warn');
  }
  /** 卖掉了：记账挂到铺子上；好东西出手也算露白 */
  onSold(shop: Shop, id: string) {
    const p = tracked(id) ? provOf(this.S, id, 'hero', '', 0, 'origin', false) : undefined;
    if (p) provMove(p, 's:' + shop.title.split(' · ')[0], shop.title.split(' · ')[0], this.g.day, 'sold');
    if (this.kindOf(shop) !== 'black') this.onShow(id, 'sell');
  }
  /** 拍卖会上拍得 */
  onAuction(id: string) { const g = this.g as any; (g.__provHow ??= {})[id] = 'auction'; this.scan(); delete g.__provHow[id]; this.onShow(id, 'auction'); }
  /** 斗法里祭出法宝（combat.castArtifact 调用） */
  onCast(id: string) { if (tracked(id)) this.onShow(id, 'use'); }
  /** 调试 / 测试 */
  provOfHero(id: string): Prov | undefined { return provOf(this.S, id, 'hero', this.g.player.name, this.g.day, 'origin', false); }
}
