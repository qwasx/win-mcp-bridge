// 第二步：修炼与角色 —— 属性、灵根、功法、寿元、修为、瓶颈、突破、逆天改命、背包、掌天瓶、炼丹、闭关
import { REALMS, ROOTS, expNeed, levelOf, realmName, smallBottleneck, MAJOR_BREAKS } from '../data/realms';
import { GONGFA, TALENTS, talentById, TalentMod } from '../data/skills';
import { itemDef } from '../data/items';
import { RECIPES, Recipe } from '../data/recipes';
import { START_ARTS, START_HOTBAR } from '../data/arts';

export interface BagItem { id: string; n: number; age?: number }
export interface Hero {
  name: string; age: number; realm: number; stage: number; exp: number;
  root: string; gongfa: string; talents: string[]; talentLevels: number[];
  hp: number; mp: number;             // 当前比例 0–1
  lifeBonus: number; senseBonus: number; lifeLost: number;
  bag: BagItem[];
  bottle: { drops: number; charge: number; owned?: boolean };
  pendingTalent: string[] | null;
  dead: boolean;
  stats: { meditateDays: number; gathered: number; pills: number; breaks: number; failed: number; alchemy: number };
  // 第三步：法术与战斗
  arts: { id: string; xp: number }[];
  hotbar: (string | null)[];
  equip: { armor?: string; shield?: string; flight?: string; boots?: string };
  looted: string[];
  kills: number;
}

export const TALENT_LEVELS = [4, 7, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
export const BOTTLE_DAYS = 20;
export const BOTTLE_MAX = 3;
export const BOTTLE_YEARS = 100;

export function newHero(): Hero {
  return {
    name: '韩立', age: 17, realm: 1, stage: 4, exp: 0, root: 'fake', gongfa: 'changchun', talents: [], talentLevels: [],
    hp: 1, mp: 1, lifeBonus: 0, senseBonus: 0, lifeLost: 0,
    // 初入黄枫谷：掌天瓶（已凝一滴绿液）、墨大夫遗下的符箓与丹药、几块灵石
    bag: [{ id: 'item_bottle', n: 1 }, { id: 'herb_huangjing', n: 3, age: 12 }, { id: 'pill_juqi', n: 2 }, { id: 'pill_huiqi', n: 3 }, { id: 'pill_liaoshang', n: 3 },
      { id: 'tal_fire', n: 6 }, { id: 'tal_jingang', n: 3 }, { id: 'tal_ice', n: 2 }, { id: 'tal_escape', n: 1 }, { id: 'mat_lingshi', n: 120 }, { id: 'art_qingfeng', n: 1 }],
    bottle: { drops: 1, charge: 0, owned: true }, pendingTalent: null, dead: false,
    stats: { meditateDays: 0, gathered: 0, pills: 0, breaks: 0, failed: 0, alchemy: 0 },
    arts: START_ARTS.map((id) => ({ id, xp: 0 })), hotbar: [...START_HOTBAR], equip: {}, looted: [], kills: 0,
  };
}

export function mod(h: Hero, m: TalentMod) { let v = 0; for (const id of h.talents) v += talentById(id)?.mods[m] ?? 0; return v; }
export function rootDef(h: Hero) { return ROOTS.find((r) => r.id === h.root) ?? ROOTS[ROOTS.length - 1]; }
export function gongfaDef(h: Hero) { return GONGFA[h.gongfa] ?? GONGFA.generic; }

export function maxLife(h: Hero) { return Math.round(REALMS[h.realm].life * (1 + mod(h, 'life')) + h.lifeBonus - h.lifeLost); }

export function heroStats(h: Hero) {
  const R = REALMS[h.realm], s = h.stage, gf = gongfaDef(h);
  return {
    hp: Math.round(R.hp[s] * (1 + (gf.hp ?? 0) + mod(h, 'hp'))),
    mp: Math.round(R.mp[s] * (1 + (gf.mp ?? 0) + mod(h, 'mp'))),
    atk: Math.round(R.atk[s] * (1 + (gf.atk ?? 0) + mod(h, 'atk'))),
    def: Math.round(R.def[s] * (1 + (gf.def ?? 0) + mod(h, 'def'))),
    sense: Math.round(R.sense[s] * (1 + mod(h, 'sense') + h.senseBonus)),
    speed: 1 + mod(h, 'speed'),
    luck: mod(h, 'luck'),
  };
}

/** 每日修为 */
export function expPerDay(h: Hero, place = 1) {
  const gf = gongfaDef(h);
  const over = h.realm > gf.maxRealm ? 0.5 : 1;
  return 10 * rootDef(h).rate * gf.rate * over * (1 + mod(h, 'exp')) * place;
}

export function need(h: Hero) { return expNeed(h.realm, h.stage); }
export function isLastStage(h: Hero) { return h.stage >= REALMS[h.realm].stages.length - 1; }
/** 当前是否卡在瓶颈（修为已满但需手动突破） */
export function bottleneck(h: Hero): 'none' | 'small' | 'major' {
  if (h.exp < need(h)) return 'none';
  if (isLastStage(h)) return h.realm >= 5 ? 'none' : 'major';
  return smallBottleneck(h.realm, h.stage) ? 'small' : 'none';
}

export function bagCount(h: Hero, id: string, minAge = 0) { let n = 0; for (const b of h.bag) if (b.id === id && (b.age ?? 0) >= minAge) n += b.n; return n; }
/** 物品入袋监听（界面用：获宝提示） */
export const itemListeners: ((id: string, n: number) => void)[] = [];
export function addItem(h: Hero, id: string, n: number, age?: number) {
  for (const f of itemListeners) f(id, n);
  const a = age !== undefined ? Math.round(age) : undefined;
  const ex = h.bag.find((b) => b.id === id && b.age === a);
  if (ex) ex.n += n; else h.bag.push({ id, n, age: a });
  sortBag(h);
}
/** 移除物品（优先消耗年份恰好够的） */
export function removeItem(h: Hero, id: string, n: number, minAge = 0) {
  const stacks = h.bag.filter((b) => b.id === id && (b.age ?? 0) >= minAge).sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
  let left = n;
  const used: number[] = [];
  for (const s of stacks) {
    const k = Math.min(left, s.n); s.n -= k; left -= k;
    for (let i = 0; i < k; i++) used.push(s.age ?? 0);
    if (left <= 0) break;
  }
  h.bag = h.bag.filter((b) => b.n > 0);
  return used;
}
const TYPE_ORDER: Record<string, number> = { pill: 0, herb: 1, material: 2, talisman: 3, scroll: 4, artifact: 5, misc: 6 };
export function sortBag(h: Hero) {
  h.bag.sort((a, b) => {
    const da = itemDef(a.id), db = itemDef(b.id);
    return (TYPE_ORDER[da.type] - TYPE_ORDER[db.type]) || (db.tier - da.tier) || a.id.localeCompare(b.id) || (b.age ?? 0) - (a.age ?? 0);
  });
}

export interface Msg { text: string; kind?: 'info' | 'warn' | 'good' }

/** 增加修为；不超过瓶颈。自动晋升无瓶颈的小境界。返回消息。 */
export function gainExp(h: Hero, amount: number, out: Msg[]) {
  let left = amount;
  let guard = 0;
  while (left > 0 && guard++ < 40) {
    const nd = need(h);
    const room = nd - h.exp;
    if (room <= 0) {
      if (bottleneck(h) === 'none' && !isLastStage(h)) { stageUp(h, out); continue; }
      break;
    }
    const k = Math.min(room, left);
    h.exp += k; left -= k;
    if (h.exp >= nd && bottleneck(h) === 'none' && !isLastStage(h)) stageUp(h, out);
  }
}

function stageUp(h: Hero, out: Msg[]) {
  h.exp = 0; h.stage++; h.stats.breaks++;
  out.push({ text: `修为精进，晋入${realmName(h.realm, h.stage)}！`, kind: 'good' });
  checkTalent(h);
}

function checkTalent(h: Hero) {
  const lv = levelOf(h.realm, h.stage);
  if (TALENT_LEVELS.includes(lv) && !h.talentLevels.includes(lv)) {
    h.talentLevels.push(lv);
    const pool = TALENTS.filter((t) => !h.talents.includes(t.id));
    const pick: string[] = [];
    while (pick.length < 3 && pool.length) { const i = Math.floor(Math.random() * pool.length); pick.push(pool.splice(i, 1)[0].id); }
    h.pendingTalent = pick;
  }
}

export function chooseTalent(h: Hero, id: string) { if (h.pendingTalent?.includes(id)) { h.talents.push(id); h.pendingTalent = null; } }

/** 小瓶颈冲关概率 */
export function smallChance(h: Hero, pills: number) {
  const b = smallBottleneck(h.realm, h.stage);
  const req = b?.count ?? 0;
  const base = 0.4 + mod(h, 'luck') / 300;
  const per = 0.3 / Math.max(1, req);
  return Math.min(0.98, base + per * pills * Math.max(1, req));
}
export function majorChance(h: Hero, pills: number) {
  const mb = MAJOR_BREAKS[h.realm];
  if (!mb) return 0;
  return Math.min(0.95, mb.base + mb.per * pills + rootDef(h).rate * 0.03 + mod(h, 'luck') / 400);
}

export function tryBreak(h: Hero, pills: number): { ok: boolean; msgs: Msg[] } {
  const msgs: Msg[] = [];
  const bt = bottleneck(h);
  if (bt === 'none') return { ok: false, msgs: [{ text: '修为未满，无须冲关。', kind: 'warn' }] };
  if (bt === 'small') {
    const b = smallBottleneck(h.realm, h.stage)!;
    const have = bagCount(h, b.item);
    pills = Math.min(pills, have, b.count * 2);
    const ch = smallChance(h, pills);
    removeItem(h, b.item, pills);
    if (Math.random() < ch) { stageUp(h, msgs); msgs.unshift({ text: '灵力冲破瓶颈！', kind: 'good' }); return { ok: true, msgs }; }
    h.exp = Math.floor(h.exp * 0.8); h.stats.failed++;
    msgs.push({ text: `冲关失败，灵力反噬，修为倒退两成。（成功率 ${(ch * 100).toFixed(0)}%）`, kind: 'warn' });
    return { ok: false, msgs };
  }
  // 大境界
  const mb = MAJOR_BREAKS[h.realm];
  const have = mb.item ? bagCount(h, mb.item) : 0;
  pills = Math.min(pills, have, mb.maxItems);
  const ch = majorChance(h, pills);
  if (mb.item) removeItem(h, mb.item, pills);
  if (Math.random() < ch) {
    h.realm++; h.stage = 0; h.exp = 0; h.stats.breaks++;
    h.hp = 1; h.mp = 1;
    msgs.push({ text: `天地灵气倒灌，${REALMS[h.realm].name}成矣！寿元增至 ${maxLife(h)} 载。`, kind: 'good' });
    checkTalent(h);
    return { ok: true, msgs };
  }
  h.exp = Math.floor(h.exp * 0.7); h.hp = 0.3; h.lifeLost += 3; h.stats.failed++;
  msgs.push({ text: `${MAJOR_BREAKS[h.realm].desc.split('：')[0]}失败！经脉受创，修为倒退三成，折损三年寿元。（成功率 ${(ch * 100).toFixed(0)}%）`, kind: 'warn' });
  return { ok: false, msgs };
}

/** 时间流逝（天）：年龄、掌天瓶、修炼 */
export function passDays(h: Hero, days: number, meditating: boolean, place: number, out: Msg[]) {
  if (h.dead) return;
  h.age += days / 360;
  // 掌天瓶聚露
  if (h.bottle.owned !== false && h.bottle.drops < BOTTLE_MAX) {
    h.bottle.charge += days;
    while (h.bottle.charge >= BOTTLE_DAYS && h.bottle.drops < BOTTLE_MAX) {
      h.bottle.charge -= BOTTLE_DAYS; h.bottle.drops++;
      out.push({ text: '掌天瓶中凝出一滴绿液。', kind: 'good' });
    }
    if (h.bottle.drops >= BOTTLE_MAX) h.bottle.charge = 0;
  }
  // 气血法力缓慢恢复
  h.hp = Math.min(1, h.hp + days * (meditating ? 0.08 : 0.02));
  h.mp = Math.min(1, h.mp + days * (meditating ? 0.2 : 0.05));
  if (meditating) { gainExp(h, expPerDay(h, place) * days, out); h.stats.meditateDays += days; }
  if (h.age >= maxLife(h)) { h.dead = true; out.push({ text: '寿元已尽……', kind: 'warn' }); }
}

/** 掌天瓶催熟 */
export function useBottle(h: Hero, stack: BagItem): Msg {
  if (h.bottle.owned === false) return { text: '你还没有这样的宝物。', kind: 'warn' };
  if (h.bottle.drops <= 0) return { text: '瓶中尚无绿液。', kind: 'warn' };
  if (itemDef(stack.id).type !== 'herb') return { text: '绿液只能催熟灵药。', kind: 'warn' };
  h.bottle.drops--;
  const age = (stack.age ?? 0) + BOTTLE_YEARS;
  const n = stack.n;
  removeItem(h, stack.id, n, stack.age ?? 0);
  // removeItem 会挑最小够龄的，确保精确移除该堆
  addItem(h, stack.id, n, age);
  return { text: `绿液滴落，${n} 株${itemDef(stack.id).name}药龄暴涨至 ${age} 年！`, kind: 'good' };
}

/** 服用 */
export function usePill(h: Hero, id: string, out: Msg[]) {
  const d = itemDef(id);
  const e = d.pill;
  if (!e) { out.push({ text: '此物不可直接服用。', kind: 'warn' }); return false; }
  if (bagCount(h, id) <= 0) return false;
  removeItem(h, id, 1);
  h.stats.pills++;
  if (e.exp) {
    const before = h.exp, bs = h.stage, br = h.realm;
    // 高阶丹药对低境界效果更强，低阶丹药对高境界衰减
    const tierFit = Math.pow(0.35, Math.max(0, h.realm - 1 - d.tier));
    gainExp(h, e.exp * tierFit * (gongfaDef(h).id === 'changchun' ? 1.1 : 1), out);
    if (h.stage === bs && h.realm === br && h.exp === before) out.push({ text: '修为已至瓶颈，药力白白流失。', kind: 'warn' });
    else out.push({ text: `药力化开，修为增长。`, kind: 'good' });
  }
  if (e.hp) { h.hp = Math.min(1, h.hp + e.hp); out.push({ text: '伤势好转。' }); }
  if (e.mp) { h.mp = Math.min(1, h.mp + e.mp); out.push({ text: '法力回复。' }); }
  if (e.life) { h.lifeBonus += e.life; out.push({ text: `寿元增加 ${e.life} 载。`, kind: 'good' }); }
  if (e.sense) { h.senseBonus += e.sense; out.push({ text: '神识更为凝练。', kind: 'good' }); }
  if (e.root) {
    const idx = ROOTS.findIndex((r) => r.id === h.root);
    if (idx > 0) { h.root = ROOTS[idx - 1].id; out.push({ text: `灵根脱胎换骨，化为${ROOTS[idx - 1].name}！`, kind: 'good' }); }
  }
  if (e.favor) out.push({ text: '容颜似乎更显年轻……这丹药还是留着送人更好。' });
  return true;
}

// ---------------- 炼丹 ----------------
export interface AlchemyCheck { ok: boolean; chance: number; missing: string[]; ages: number[] }
export function checkRecipe(h: Hero, r: Recipe, fire = true): AlchemyCheck {
  const missing: string[] = [];
  const forge = r.kind === 'forge';
  if (forge && h.realm < r.reqRealm) missing.push(`修为不足（需${['凡人', '炼气', '筑基', '结丹', '元婴'][r.reqRealm]}期方能驾驭此器）`);
  let bonus = 0;
  for (const inp of r.inputs) {
    const have = bagCount(h, inp.id, inp.minAge ?? 0);
    if (have < inp.n) missing.push(`${itemDef(inp.id).name}${inp.minAge ? `(${inp.minAge}年+)` : ''} ${have}/${inp.n}`);
    // 药龄超出越多，成丹率越高：取够龄的最年轻 n 株估算
    const stacks = h.bag.filter((b) => b.id === inp.id && (b.age ?? 0) >= (inp.minAge ?? 0)).sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
    let k = inp.n, sum = 0, cnt = 0;
    for (const s of stacks) { const m = Math.min(k, s.n); sum += (s.age ?? 0) * m; cnt += m; k -= m; if (k <= 0) break; }
    if (cnt && itemDef(inp.id).type === 'herb') {
      const avg = sum / cnt, ref = Math.max(inp.minAge ?? 0, itemDef(inp.id).herbBase ?? 10);
      bonus += Math.min(0.15, Math.max(0, (avg - ref) / Math.max(60, ref * 2)) * 0.15);
    }
  }
  if (!forge && bagCount(h, 'mat_lingquan') > 0 && !r.inputs.some((i) => i.id === 'mat_lingquan')) bonus += 0.05;
  // 炼器：境界越高、控火越稳；野外无地火，只能以法力代火
  if (forge) bonus += Math.max(0, h.realm - r.reqRealm) * 0.1;
  const realmPen = h.realm < r.reqRealm ? 0.5 : 1;
  const chance = Math.min(0.97, (r.base + bonus + mod(h, 'alchemy')) * realmPen * (forge && !fire ? 0.6 : 1));
  return { ok: missing.length === 0, chance, missing, ages: [] };
}

export function brew(h: Hero, r: Recipe, fire = true): { ok: boolean; msgs: Msg[]; days: number } {
  const c = checkRecipe(h, r, fire);
  if (!c.ok) return { ok: false, msgs: [{ text: (r.kind === 'forge' ? '无法开炉：' : '药材不足：') + c.missing.join('，'), kind: 'warn' }], days: 0 };
  if (r.kind === 'forge') {
    for (const inp of r.inputs) removeItem(h, inp.id, inp.n, inp.minAge ?? 0);
    h.stats.alchemy++;
    if (Math.random() < c.chance) { addItem(h, r.out, 1); return { ok: true, msgs: [{ text: `炉中霞光冲起，器成！得${itemDef(r.out).name}。`, kind: 'good' }], days: r.days }; }
    return { ok: false, msgs: [{ text: `火候一偏，器胚崩裂，材料尽毁……（成器率 ${(c.chance * 100).toFixed(0)}%）`, kind: 'warn' }], days: r.days };
  }
  for (const inp of r.inputs) removeItem(h, inp.id, inp.n, inp.minAge ?? 0);
  h.stats.alchemy++;
  if (Math.random() < c.chance) {
    const n = r.outN + (mod(h, 'alchemy') > 0 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    addItem(h, r.out, n);
    return { ok: true, msgs: [{ text: `丹成！得${itemDef(r.out).name} ×${n}。`, kind: 'good' }], days: r.days };
  }
  return { ok: false, msgs: [{ text: `炉中一声闷响，药材化作焦灰……（成丹率 ${(c.chance * 100).toFixed(0)}%）`, kind: 'warn' }], days: r.days };
}

export { RECIPES };
