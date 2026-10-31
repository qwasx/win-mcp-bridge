// 活世界 · 世界模拟引擎（纯函数、确定性、零 DOM 依赖）
//
// 设计要点（对应「把世界整活」的目标）：
//  1. 储物袋：每个 NPC 有自己的袋子和灵石，袋里件件有来路；死后的东西归亲族 / 仇家，不再凭空消失。
//  2. 功法：每人有功法与修为层数，会卡关、会求教、会传弟子、会为半卷残篇起贪念。
//  3. 门派：门派有名册、士气、盟友、仇家、差事与岁供；门派之间结仇，门人跟着结仇。
//  4. 仇恨：有缘由、有热度、会衰减、会代偿（血仇追到亲族），会真的去寻仇并打出人命。
//  5. 家庭：有家、有配偶、有父母子女、有家声、有争产、有为亲人报仇，也会生儿育女。
//  6. 社交：有朋友 / 结拜 / 师徒 / 道侣 / 对头 / 生意伙伴；传闻在关系网里传，越传越歪。
//  7. 日程：任何时刻都答得出「他在干嘛、为何在此」，目标来自需求 + 性格 + 门派 + 家 + 恩怨。
//  8. 邀约必有缘由：主角收到的一切「找我」都附带具体缘由、利益、拒绝的代价与冷却时间。
import {
  AGENDA_WHY, ARTS, ART_BY_TIER, COMPOUND, CONTACT_TONE_LINE, COST_TEXT, FAMILY_CREEDS, FAMILY_NAMES,
  FEMALE, GAIN_TEXT, GRUDGE_REASONS, ITEMS, MALE, PERS_TRAITS, SECT_SEEDS, makeName, placeName, rollItem,
} from './content';
import { chance, clamp, mulberry32, pick, ri, rf, shuffle, weighted, type Rnd } from './rng';
import type {
  Agenda, AliveConfig, Art, BagItem, ChronEvent, ContactRequest, Family, Grudge, HeroLink,
  KinTie, Rumor, SectStandings, Sex, SocialKind, SocialTie, Soul, World,
} from './types';

export const HERO_ID = '__hero__';

let uid = 0;
const nid = (p: string) => `${p}${(++uid).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

// ---------------------------------------------------------------- 建立
export interface SoulSeed {
  id: string; name?: string; sex?: 'm' | 'f'; age?: number; realm?: number; stage?: number;
  pers?: Soul['pers']; homeId?: string; homeName?: string; sectId?: string; sectRank?: string;
  faction?: Soul['faction']; metHero?: boolean; favor?: number; stones?: number;
  wealthTier?: number;
}

export function createWorld(cfg: AliveConfig): World {
  const souls: Record<string, Soul> = {};
  const sects: Record<string, SectStandings> = {};
  for (const s of SECT_SEEDS) {
    sects[s.id] = {
      id: s.id, name: s.name, demon: !!s.demon, members: 0, power: 0, mood: 60,
      allies: s.allies ?? [], foes: s.foes ?? [], grudges: [], deeds: [],
    };
  }
  for (const extra of cfg.sects ?? []) {
    if (sects[extra.id]) continue;
    sects[extra.id] = {
      id: extra.id, name: extra.name, demon: !!extra.demon, members: 0, power: 0, mood: 60,
      allies: extra.allies ?? [], foes: extra.foes ?? [], grudges: [], deeds: [],
    };
  }
  const world: World = {
    seed: cfg.seed, day: 0, souls, families: {}, sects, rumors: [], chron: [], contacts: [],
    heroName: cfg.heroName, stats: { births: 0, deaths: 0, murders: 0, duels: 0, trades: 0, revenge: 0, wed: 0, contact: 0, refused: 0 },
    buzz: {},
    hero: { met: false, favor: 0, grudge: 0, fame: 0, deeds: [] },
  };
  souls[HERO_ID] = {
    id: HERO_ID, name: cfg.heroName, sex: 'm', age: 16, realm: 0, stage: 0, pers: 'cautious',
    homeId: 'qingniu', homeName: '青牛镇', atId: 'qingniu', faction: 'rogue', alive: true,
    kin: [], social: [], grudges: [], debts: [], bag: [], arts: [], stones: 0,
    fame: 0, mood: 0, need: { cultivation: 40, wealth: 40, safety: 50, belonging: 30, revenge: 0 },
    agenda: { kind: 'train', until: 30, why: '初入道途，日夜苦修' }, traits: [],
  };
  // 主角也有储物袋与灵石：有人会真的惦记他袋里的东西（这是「来找你」的缘由之一）
  const hr = mulberry32(cfg.seed ^ 0x5f3a7);
  for (let i = 0; i < 3; i++) {
    const it = rollItem(hr, 2, '早年在青牛镇置办的');
    it.day = 0;
    souls[HERO_ID].bag.push(it);
  }
  souls[HERO_ID].stones = 260;
  return world;
}

// ---------------------------------------------------------------- 名册接入
export function addSoul(w: World, seed: SoulSeed): Soul {
  const existed = w.souls[seed.id];
  if (existed) return existed;
  const r = mulberry32(hash(w.seed + ':' + seed.id));
  const sex = seed.sex ?? (chance(r, 0.45) ? 'f' : 'm');
  let name = seed.name ?? makeName(r, sex);
  // 同名会让人分不清谁是谁（家人、仇人都会看错）：取过的名字不再用
  const taken = () => Object.values(w.souls).some((x) => x.name === name);
  if (taken()) {
    const base = seed.name ?? name;
    const surname = COMPOUND.includes(base.slice(0, 2)) ? base.slice(0, 2) : base.slice(0, 1);
    for (let tries = 0; tries < 14 && taken(); tries++) {
      if (seed.name) name = `${base}${DISSOLVE[tries % DISSOLVE.length]}`;
      else name = surname + pick(r, sex === 'f' ? FEMALE : MALE) + (chance(r, 0.5) ? pick(r, sex === 'f' ? FEMALE : MALE) : '');
    }
    if (taken()) name = `${surname}${pick(r, sex === 'f' ? FEMALE : MALE)}${ri(r, 2, 98)}`;
  }
  const pers = seed.pers ?? pick(r, ['righteous', 'greedy', 'cautious', 'arrogant', 'kind', 'ruthless', 'aloof'] as Soul['pers'][]);
  const realm = seed.realm ?? 0;
  const homeId = seed.homeId ?? pick(r, ['qingniu', 'jiayuan', 'yunmeng', 'taiyue', 'yuejing']);
  const homeName = seed.homeName ?? placeName(homeId);
  const sectId = seed.sectId;
  const wealthTier = seed.wealthTier ?? realm;
  const s: Soul = {
    id: seed.id, name, sex, age: seed.age ?? ri(r, 18, 70),
    realm, stage: seed.stage ?? 0, pers,
    homeId, homeName, atId: homeId,
    sectId, sectName: sectId ? w.sects[sectId]?.name : undefined,
    sectRank: seed.sectRank, faction: seed.faction ?? (sectId ? 'sect' : 'rogue'),
    alive: true, kin: [], social: [], grudges: [], debts: [], bag: [], arts: [],
    stones: seed.stones ?? ri(r, 20, 200) * (1 + wealthTier * 4),
    fame: ri(r, -6, 14), mood: 0,
    need: { cultivation: ri(r, 20, 70), wealth: ri(r, 10, 70), safety: ri(r, 40, 80), belonging: ri(r, 10, 60), revenge: 0 },
    agenda: { kind: 'train', until: 0, why: '' },
    traits: shuffle(r, PERS_TRAITS[pers]).slice(0, ri(r, 1, 3)),
    metHero: seed.metHero, favor: seed.favor ?? 0,
  };
  giveStarterArts(w, s, r);
  giveStarterBag(w, s, r);
  pickAgenda(w, s, r);
  w.souls[s.id] = s;
  if (sectId) { const st = w.sects[sectId]; if (st) { st.members++; st.power += realm + 1; } }
  return s;
}

/** 随机安家：把无亲无故的人归入家族、结上亲缘，让世界一开始就有「人味」 */
export function seedSociety(w: World, count = 14): void {
  const r = mulberry32(hash(w.seed + ':society'));
  const ids = Object.keys(w.souls).filter((i) => i !== HERO_ID);
  for (let i = 0; i < count; i++) {
    const home = pick(r, ['qingniu', 'jiayuan', 'yuejing', 'shuozhou', 'tianxing']);
    const fam = makeFamily(w, r, home);
    const members = ids.filter((id) => w.souls[id].homeId === home);
    if (members.length < 2) continue;
    const take = shuffle(r, members).slice(0, ri(r, 2, Math.min(5, members.length)));
    for (const id of take) {
      const s = w.souls[id];
      s.familyId = fam.id;
      if (!fam.members.includes(id)) fam.members.push(id);
    }
    // 家里排辈分：最年长的是长辈，其余互为兄弟姊妹
    const kin = take.map((id) => w.souls[id]).sort((a, b) => b.age - a.age);
    for (let k = 1; k < kin.length; k++) {
      linkKin(kin[0], kin[k], 'child', w.day);
      linkKin(kin[k], kin[0], 'parent', w.day);
    }
    for (let a = 0; a < kin.length; a++) {
      for (let b = a + 1; b < kin.length; b++) {
        if (kin[a] === kin[b]) continue;
        linkKin(kin[a], kin[b], kin[a].age > 40 && kin[b].age > 40 ? 'sibling' : 'sibling', w.day);
      }
    }
    // 夫妻
    const adults = kin.filter((k) => k.age >= 20);
    if (adults.length >= 2 && chance(r, 0.6)) {
      const [h, wf] = adults;
      if (h.sex !== wf.sex) marry(w, h, wf, w.day - ri(r, 200, 3000));
    }
  }
  // 主角的同乡、旧识：世界一开场就认识他几个
  const hero = w.souls[HERO_ID];
  if (hero) {
    const home = ids.filter((id) => w.souls[id].homeId === hero.homeId);
    for (const id of shuffle(r, home).slice(0, Math.min(5, home.length))) {
      const n = w.souls[id];
      n.metHero = true;
      tie(w, n, hero, chance(r, 0.3) ? 'trade' : 'friend', ri(r, 8, 45), 0);
    }
  }
  // 朋友网
  for (let i = 0; i < count * 2; i++) {
    const a = w.souls[pick(r, ids)], b = w.souls[pick(r, ids)];
    if (!a || !b || a === b || a.homeId !== b.homeId) continue;
    const kind: SocialKind = chance(r, 0.15) ? 'trade' : 'friend';
    tie(w, a, b, kind, ri(r, 10, 55), w.day - ri(r, 30, 900));
  }
  // 少量旧怨
  for (let i = 0; i < Math.max(2, Math.floor(ids.length / 60)); i++) {
    const a = w.souls[pick(r, ids)], b = w.souls[pick(r, ids)];
    if (!a || !b || a === b) continue;
    holdGrudge(w, a, b, pick(r, GRUDGE_REASONS.rob.concat(GRUDGE_REASONS.duel, GRUDGE_REASONS.envy)), w.day - ri(r, 20, 800), ri(r, 28, 58));
  }
}

export function makeFamily(w: World, r: Rnd, seat: string): Family {
  const name = pick(r, FAMILY_NAMES) + (chance(r, 0.3) ? '二房' : '');
  const f: Family = {
    id: 'f' + (Object.keys(w.families).length + 1) + '_' + Math.floor(r() * 1e6).toString(36),
    name, seat, members: [], honor: ri(r, 10, 70), wealth: ri(r, 200, 9000), creed: pick(r, FAMILY_CREEDS), feuds: [],
  };
  w.families[f.id] = f;
  return f;
}

// ---------------------------------------------------------------- 功法 / 储物袋
const DEMON_ART_WORDS = ['魔', '煞', '鬼', '血', '阴', '媚', '噬'];
const CLEAN_ART_WORDS = ['清', '正', '梵', '圣', '意', '云', '星', '水', '木', '土', '金', '音', '药'];
const artFits = (name: string, demon?: boolean) => {
  if (demon) return DEMON_ART_WORDS.some((w) => name.includes(w)) || name.includes('血') || name.includes('噬');
  return !DEMON_ART_WORDS.some((w) => name.includes(w));
};

export function giveStarterArts(w: World, s: Soul, r: Rnd): void {
  const tier = clamp(1 + Math.floor(s.realm / 1.4) + (chance(r, 0.3) ? 1 : 0), 1, 6);
  const demon = s.sectId ? w.sects[s.sectId]?.demon : false;
  const pool0 = ART_BY_TIER(tier).filter((a) => artFits(a.name, demon));
  const pool = pool0.length ? pool0 : ART_BY_TIER(tier);
  const a = pick(r, pool.length ? pool : ARTS);
  s.arts.push(mkArt(r, a.name, a.el, a.tier, s.sectName ? `${s.sectName}所传` : '市集残篇换的', r));
  if (chance(r, 0.4)) {
    const cand = ARTS.filter((x) => x.tier <= tier && artFits(x.name, demon));
    const b = pick(r, cand.length ? cand : ARTS.filter((x) => x.tier <= tier));
    s.arts.push(mkArt(r, b.name, b.el, b.tier, chance(r, 0.5) ? '早年从旧货摊上淘来' : '故人所赠，人已不在', r));
  }
  s.stuckArt = s.arts[0].name;
}

export function mkArt(r: Rnd, name: string, el: string, tier: number, from: string, _r?: Rnd): Art {
  return { id: 'a' + Math.floor(r() * 1e9).toString(36), name, el, tier, mastery: ri(r, 5, 62), from, apt: rf(r, 0.5, 1.6), day: 0 };
}

export function giveStarterBag(w: World, s: Soul, r: Rnd): void {
  const bias = clamp(1 + s.realm, 1, 6);
  const n = ri(r, 1, 4) + Math.floor(s.realm / 2);
  for (let i = 0; i < n; i++) {
    const it = rollItem(r, bias, s.sectName ? `${s.sectName}岁供` : `${s.homeName}置办的`);
    it.day = -ri(r, 10, 900);
    s.bag.push(it);
  }
}

export function addItem(w: World, s: Soul, it: Omit<BagItem, 'id'>): BagItem {
  const full: BagItem = { ...it, id: nid('i') };
  s.bag.push(full);
  if (s.bag.length > 26) {
    // 袋子有容量：把最不值钱的换灵石（这就是「人」——不会无限囤货）
    s.bag.sort((a, b) => b.worth - a.worth);
    const junk = s.bag.pop()!;
    s.stones += Math.round(junk.worth * 0.5);
  }
  return full;
}

// ---------------------------------------------------------------- 关系
export function linkKin(a: Soul, b: Soul, kind: KinTie['kind'], day: number): void {
  if (!a || !b || a.id === b.id) return;
  if (!a.kin.some((k) => k.other === b.id)) a.kin.push({ other: b.id, kind, since: day });
  const back: KinTie['kind'] = kind === 'parent' ? 'child' : kind === 'child' ? 'parent' : kind;
  if (!b.kin.some((k) => k.other === a.id)) b.kin.push({ other: a.id, kind: back, since: day });
}

export function tie(w: World, a: Soul, b: Soul, kind: SocialKind, val: number, day: number): SocialTie {
  if (!a || !b || a.id === b.id) return { other: b?.id ?? '', kind, val, since: day, last: day };
  let t = a.social.find((x) => x.other === b.id);
  if (!t) { t = { other: b.id, kind, val: 0, since: day, last: day }; a.social.push(t); }
  t.kind = kind; t.val = clamp(t.val + val, -100, 100); t.last = day;
  const rt = b.social.find((x) => x.other === a.id);
  if (rt) { rt.val = clamp(rt.val + val * 0.8, -100, 100); rt.last = day; }
  else b.social.push({ other: a.id, kind, val: clamp(val * 0.8, -100, 100), since: day, last: day });
  return t;
}

export function holdGrudge(w: World, a: Soul, b: Soul, reason: string, day: number, heat = 55, blood = false, forKin?: string): Grudge {
  if (!a || !b || a.id === b.id) return { other: b?.id ?? '', heat: 0, reason, day, blood, forKin };
  let g = a.grudges.find((x) => x.other === b.id && !x.done);
  if (g) { g.heat = clamp(Math.max(g.heat, heat) + 8, 0, 100); g.reason = reason; g.blood = g.blood || blood; }
  else { g = { other: b.id, heat, reason, day, blood, forKin, attempts: 0 }; a.grudges.push(g); }
  a.need.revenge = clamp(a.need.revenge + (blood ? 35 : 12), 0, 100);
  a.mood -= blood ? 8 : 3;
  return g;
}

export function marry(w: World, a: Soul, b: Soul, day: number): void {
  if (!a || !b || a.id === b.id) return;
  const hasSpouse = (x: Soul) => x.kin.some((k) => k.kind === 'spouse' && w.souls[k.other]?.alive);
  if (hasSpouse(a) || hasSpouse(b)) return;   // 一夫一妻：有道侣的不再另结（丧偶才可再娶）
  linkKin(a, b, 'spouse', day);
  tie(w, a, b, 'lover', 40, day);
  w.stats.wed++;
  chron(w, day, 'wed', `${a.name}与${b.name}结为道侣，两家彼此走动起来`, a.homeId, 2);
}

export function chron(w: World, day: number, kind: ChronEvent['kind'], text: string, place?: string, weight = 1): void {
  w.chron.push({ day: Math.round(day), kind, text, place, weight });
  if (w.chron.length > 900) w.chron.splice(0, w.chron.length - 900);
}

export function rumor(w: World, day: number, kind: Rumor['kind'], text: string, about: string, at: string, truth = 1): void {
  w.rumors.push({ id: nid('r'), day: Math.round(day), kind, text, about, at, truth, spread: 1 });
  if (w.rumors.length > 400) w.rumors.splice(0, w.rumors.length - 400);
}

export function heroDeed(w: World, text: string, weight = 1): void {
  w.hero.deeds.push({ day: Math.round(w.day), text, weight });
  if (w.hero.deeds.length > 40) w.hero.deeds.shift();
}

const DISSOLVE = ['之', '翁', '姑', '郎', '氏', '叟'];
/** 同姓不重名：家里几口人各有各的名 */
function uniqueName(w: World, r: Rnd, surname: string, sex: Sex): string {
  const pool = sex === 'f' ? FEMALE : MALE;
  for (let i = 0; i < 12; i++) {
    const n = surname + pick(r, pool) + (chance(r, 0.5) ? pick(r, pool) : '');
    if (!Object.values(w.souls).some((x) => x.name === n)) return n;
  }
  return surname + '氏' + Math.floor(r() * 90);
}
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// ---------------------------------------------------------------- 日程（目标选择：需求 + 性格 + 门派 + 家 + 恩怨）
export function pickAgenda(w: World, s: Soul, r: Rnd): Agenda {
  const days = () => w.day + ri(r, 4, 26);
  const why = (k: keyof typeof AGENDA_WHY) => pick(r, AGENDA_WHY[k]).replace('{place}', s.homeName);
  const poor = s.stones < 120 + s.realm * 260;
  const hunted = s.grudges.some((g) => !g.done && g.heat >= 70);
  const options: [Agenda['kind'], number][] = [
    ['train', 22 + s.need.cultivation * 0.5 + (s.pers === 'aloof' ? 14 : 0)],
    ['gather', 14 + s.need.wealth * 0.3 + (s.pers === 'cautious' ? 5 : 0)],
    ['hunt', s.realm >= 1 ? 10 + s.need.wealth * 0.2 : 2],
    ['trade', (poor ? 26 : 12) + (s.pers === 'greedy' ? 16 : 0) + s.need.wealth * 0.3],
    ['sect', s.sectId ? 14 : 0],
    ['social', 10 + s.need.belonging * 0.4 + (s.pers === 'kind' ? 8 : 0)],
    ['home', s.kin.some((k) => k.kind === 'spouse' || k.kind === 'child') ? 14 : 4],
    ['seclude', s.realm >= 2 ? 8 + (s.stuckArt ? 10 : 0) : 2],
    ['avenge', hunted ? 30 + s.need.revenge : s.need.revenge * 0.35],
    ['teach', s.social.some((t) => t.kind === 'disciple') ? 8 : 0],
    ['guard', s.faction === 'sect' || s.faction === 'merchant' ? 8 : 2],
    ['court', s.age >= 20 && s.age <= 90 && !s.kin.some((k) => k.kind === 'spouse') ? 10 : 0],
    ['visit', 6],
    ['errand', 8],
  ];
  const kind = weighted(r, options);
  const grudgeTargets = s.grudges.filter((g) => !g.done && g.heat >= 60 && w.souls[g.other]?.alive);
  const socialTargets = s.social.filter((t) => t.val > 8 && w.souls[t.other]?.alive);
  const target = kind === 'avenge'
    ? (grudgeTargets.length ? pick(r, grudgeTargets).other : undefined)
    : kind === 'social' || kind === 'visit' || kind === 'court'
      ? (socialTargets.length ? pick(r, socialTargets).other : undefined)
      : undefined;
  // 没对象就没法做的事，换一件：寻仇没人可寻就去修行，应酬没人可应就回家
  const fallback: Partial<Record<Agenda['kind'], Agenda['kind']>> = { avenge: 'train', social: 'home', court: 'train', visit: 'home', teach: 'train' };
  const finalKind: Agenda['kind'] = target ? kind : (fallback[kind] ?? kind);
  const finalWhy = target ? undefined : (fallback[kind] ? pick(r, AGENDA_WHY[finalKind as keyof typeof AGENDA_WHY]).replace('{place}', s.homeName) : undefined);
  return {
    kind: finalKind, targetId: target, placeId: finalKind === 'home' ? s.homeId : s.atId, until: days(),
    why: finalWhy ?? why(finalKind as keyof typeof AGENDA_WHY),
  };
}

// ---------------------------------------------------------------- 每日推进
export function tickDays(w: World, days: number, opt?: { heroAt?: string; heroAlive?: boolean }): ChronEvent[] {
  const before = w.chron.length;
  const r = mulberry32(hash(`${w.seed}:${w.day}:${days}`));
  for (let i = 0; i < days; i++) tickOne(w, r, opt);
  return w.chron.slice(before);
}

function tickOne(w: World, r: Rnd, opt?: { heroAt?: string; heroAlive?: boolean }): void {
  w.day += 1;
  // 武力预算：江湖不是屠宰场。今日若已有人流血致死，其余寻仇便点到为止。
  const budget = { blood: chance(r, 1 / 40) };
  const ids = Object.keys(w.souls).sort();
  for (const id of ids) {
    const s = w.souls[id];
    if (!s.alive || id === HERO_ID) continue;
    ageOne(w, s, r);
    if (!s.alive) continue;
    if (w.day >= s.agenda.until) { s.agenda = pickAgenda(w, s, r); }
    runAgenda(w, s, r, opt, budget);
  }
  decay(w, r);
  spreadRumors(w, r);
  maybeContacts(w, r);
  for (const key of Object.keys(w.sects)) {
    const st = w.sects[key];
    if (chance(r, 0.02)) st.mood = clamp(st.mood + ri(r, -6, 7), 10, 100);
    if (st.deeds.length > 40) st.deeds.splice(0, st.deeds.length - 40);
  }
  if (w.day % 30 === 0) {
    for (const fid of Object.keys(w.families)) {
      const f = w.families[fid];
      f.wealth += Math.round(f.wealth * 0.01) + ri(r, -20, 60);
      f.honor = clamp(f.honor + ri(r, -2, 2), 0, 100);
    }
  }
}

function ageOne(w: World, s: Soul, r: Rnd): void {
  s.age += 1 / 360;
  // 修炼：功法层数推进，卡关
  for (const a of s.arts) {
    const apt = a.apt * (s.pers === 'aloof' || s.pers === 'righteous' ? 1.1 : 1);
    if (chance(r, 0.05 * apt)) {
      if (a.mastery >= 99) { a.mastery = 100; }
      else a.mastery = clamp(a.mastery + ri(r, 1, 3), 0, 100);
      if (a.mastery === 100 && chance(r, 0.002) && s.realm < 5) {
        s.realm++; s.stage = 0;
        const st = s.sectId ? w.sects[s.sectId] : undefined;
        if (st) { st.power += 1; st.deeds.push({ day: w.day, text: `${s.name}突破了，门中士气大振` }); }
        chron(w, w.day, 'art', `${s.name}修至大圆满，晋入新境界（${a.name}）`, s.atId, 2);
        rumor(w, w.day, 'sect', `${s.name}突破了！${st ? st.name : '有人'}在庆贺`, s.id, s.atId, 1);
        s.fame += 3;
      }
    }
  }
  const stuck = s.arts.find((a) => a.mastery >= 62 && a.mastery < 100);
  s.stuckArt = stuck?.name;
  // 谋生开销
  s.stones = Math.max(0, s.stones - ri(r, 1, 6) - s.realm * 2);
  // 需求漂移
  s.need.wealth = clamp(s.need.wealth + (s.stones < 200 ? 3 : -1), 0, 100);
  s.need.cultivation = clamp(s.need.cultivation + (s.stuckArt ? 2 : -1), 0, 100);
  s.need.belonging = clamp(s.need.belonging + (s.kin.length === 0 ? 1 : -1), 0, 100);
  s.need.safety = clamp(s.need.safety + (s.grudges.some((g) => !g.done && g.heat >= 70) ? -3 : 1), 0, 100);
  s.mood = clamp(s.mood + ri(r, -1, 1), -20, 20);
  // 寿元
  const life = 90 + s.realm * 220 + (s.arts[0]?.tier ?? 1) * 12;
  if (s.age > life) { die(w, s, '寿元耗尽，坐化', undefined, r); return; }
}

function die(w: World, s: Soul, why: string, killer?: string, r?: Rnd): void {
  if (!s.alive) return;
  s.alive = false; s.deathNote = why; s.deathDay = w.day; s.killer = killer;
  w.stats.deaths++;
  const st = s.sectId ? w.sects[s.sectId] : undefined;
  if (st) st.members = Math.max(0, st.members - 1);
  const isViolent = !!killer;
  chron(w, w.day, isViolent ? 'kill' : 'death', `${s.name}${why}${killer && killer !== s.id ? `（凶手：${nameOf(w, killer)}）` : ''}`, s.atId, isViolent ? 3 : 1);
  if (s.fame > 30 || s.realm >= 3) rumor(w, w.day, 'death', `${s.name}${why}`, s.id, s.atId, 1);
  // ---- 遗物归亲族 / 仇家：储物袋不凭空消失
  const heir = livingKin(w, s)[0];
  if (heir) {
    for (const it of s.bag.splice(0, s.bag.length)) {
      it.src = `${s.name}的遗物`; it.day = w.day;
      heir.bag.push(it);
    }
    heir.stones += s.stones; s.stones = 0;
    heir.mood -= 6;
    chron(w, w.day, 'fell', `${heir.name}承了${s.name}的遗物（${s.kin.find((k) => k.other === heir.id)?.kind === 'spouse' ? '道侣' : '亲族'}）`, heir.atId, 1);
  } else if (r) {
    // 无人继承 → 落入旁人之手（这会真的引出「图财害命」的传闻）
    const taker = randomOther(w, r, s);
    if (taker) {
      for (const it of s.bag.splice(0, s.bag.length)) { it.src = `从${s.name}遗蜕上取得`; it.about = s.name; taker.bag.push(it); }
      taker.stones += s.stones; s.stones = 0;
      if (s.bag.length > 0 || true) rumor(w, w.day, 'treasure', `${s.name}的储物袋落在${taker.name}手里，有人说来路不正`, taker.id, taker.atId, 0.8);
    }
    s.bag.length = 0;
  }
  // ---- 血仇代偿：亲人记住凶手
  if (killer) {
    w.stats.murders++;
    for (const k of s.kin) {
      const kin = w.souls[k.other];
      if (!kin || !kin.alive || k.other === killer) continue;
      holdGrudge(w, kin, w.souls[killer] ?? w.souls[HERO_ID], `${s.name}死在${nameOf(w, killer)}手上`, w.day, 92, true, s.id);
      const fam = kin.familyId ? w.families[kin.familyId] : undefined;
      if (fam) fam.feuds.push({ other: w.souls[killer]?.familyId ?? killer, since: w.day, reason: `${s.name}被杀`, blood: true });
      chron(w, w.day, 'grudge', `${kin.name}记下了血仇：${s.name}之死`, kin.atId, 2);
    }
    if (killer === HERO_ID) {
      w.hero.grudge += 8; w.hero.favor -= 4;
      heroDeed(w, `杀了${s.name}`, 3);
      rumor(w, w.day, 'grudge', `${w.heroName}杀了${s.name}`, HERO_ID, s.atId, 1);
    }
  }
  // 亲人悲伤
  for (const k of s.kin) { const k2 = w.souls[k.other]; if (k2) k2.mood -= 5; }
}

export const nameOf = (w: World, id: string) => w.souls[id]?.name ?? (id === HERO_ID ? w.heroName : '无名之辈');
const livingKin = (w: World, s: Soul) => s.kin.map((k) => w.souls[k.other]).filter((x): x is Soul => !!x && x.alive && x.id !== s.id);
const randomOther = (w: World, r: Rnd, s: Soul): Soul | undefined => {
  const near = Object.keys(w.souls).map((i) => w.souls[i]).filter((x) => x.alive && x.id !== s.id && x.id !== HERO_ID && x.atId === s.atId);
  return near.length ? pick(r, near) : undefined;
};

// ---------------------------------------------------------------- 日程结算
function runAgenda(w: World, s: Soul, r: Rnd, opt: { heroAt?: string; heroAlive?: boolean } | undefined, budget: { blood: boolean }): void {
  const a = s.agenda;
  s.atId = a.kind === 'home' ? s.homeId : (chance(r, 0.12) ? pick(r, ['yunmeng', 'taiyue', 'jiayuan', 'qingniu', 'yuejing']) : s.atId);
  const bias = clamp(1 + s.realm, 1, 6);
  switch (a.kind) {
    case 'gather': {
      if (chance(r, 0.32)) {
        const herb = pick(r, ITEMS.filter((i) => i.kind === 'herb'));
        addItem(w, s, { name: herb.name, kind: 'herb', tier: herb.tier, count: ri(r, 1, 2), src: `${placeName(s.atId)}采的${herb.name}`, day: w.day, worth: Math.round(herb.worth * 0.9) });
        s.quip = `在${placeName(s.atId)}采到了${herb.name}。`;
      }
      if (chance(r, 0.14)) meetRival(w, s, r, 'gather');
      break;
    }
    case 'hunt': {
      if (chance(r, 0.22)) {
        const mat = pick(r, ITEMS.filter((i) => i.kind === 'material'));
        addItem(w, s, { name: mat.name, kind: 'material', tier: mat.tier, count: 1, src: `猎杀妖兽所得（${placeName(s.atId)}）`, day: w.day, worth: mat.worth });
        s.quip = `猎了一场，得了一${mat.kind === 'material' ? '份' : '件'}${mat.name}。`;
      }
      if (s.realm >= 1 && chance(r, 0.012)) { s.mood -= 4; s.need.safety = clamp(s.need.safety - 6, 0, 100); if (chance(r, 0.25)) die(w, s, '死于妖兽之口', undefined, r); }
      if (chance(r, 0.1)) meetRival(w, s, r, 'hunt');
      break;
    }
    case 'trade': {
      const gain = ri(r, 20, 120) * (1 + s.realm);
      s.stones += gain; w.stats.trades++;
      if (chance(r, 0.3)) {
        const partner = randomOther(w, r, s);
        if (partner) { tie(w, s, partner, 'trade', ri(r, 3, 10), w.day); s.quip = `在${placeName(s.atId)}和${partner.name}做了笔买卖。`; }
      }
      if (chance(r, 0.02)) {
        const robber = randomOther(w, r, s);
        if (robber && robber.pers === 'ruthless' || robber && robber.pers === 'greedy') {
          const it = s.bag.length ? s.bag[Math.floor(r() * s.bag.length)] : undefined;
          if (it) {
            s.bag = s.bag.filter((x) => x !== it);
            const stolen = { ...it, src: `趁夜从${s.name}那儿顺来的`, about: s.name, day: w.day };
            robber.bag.push(stolen);
            holdGrudge(w, s, robber, `劫了我的${it.name}`, w.day, 78);
            chron(w, w.day, 'grudge', `${robber.name}劫走了${s.name}的${it.name}`, s.atId, 2);
            rumor(w, w.day, 'grudge', `${s.name}在${placeName(s.atId)}被人劫了货`, s.id, s.atId, 1);
          }
        }
      }
      break;
    }
    case 'train': {
      const art = s.arts[0];
      if (art) art.mastery = clamp(art.mastery + ri(r, 0, 2), 0, 100);
      if (chance(r, 0.05)) {
        // 求教 / 抢功法
        const near = randomOther(w, r, s);
        const learn = (a: { name: string; el: string; tier: number }, from: string) => {
          const known = s.arts.find((x) => x.name === a.name);
          if (known) { known.mastery = clamp(known.mastery + ri(r, 2, 6), 0, 100); return; }
          if (s.arts.length >= 4) {
            // 人不能什么都学：挑最生疏的一门放下，换新的进来
            s.arts.sort((x, y) => y.mastery - x.mastery);
            if (s.arts.length >= 4) s.arts.pop();
          }
          const na = mkArt(r, a.name, a.el, a.tier, from, r);
          na.mastery = 4;
          s.arts.push(na);
        };
        if (near && near.arts.length) {
          const theirs = near.arts[0];
          const wantBetter = theirs.tier > (art?.tier ?? 1);
          if (wantBetter && (s.pers === 'ruthless' || s.pers === 'greedy') && chance(r, 0.4)) {
            holdGrudge(w, near, s, `逼问${theirs.name}的口诀`, w.day, 66);
            chron(w, w.day, 'grudge', `${s.name}为了${theirs.name}与${near.name}起了冲突`, s.atId, 2);
          } else if (chance(r, 0.6)) {
            tie(w, s, near, 'mentor', ri(r, 4, 12), w.day);
            learn(theirs, `${near.name}指点过几日`);
            chron(w, w.day, 'art', `${near.name}指点${s.name}修行${theirs.name}`, s.atId, 1);
            s.quip = `${near.name}肯指点我，是运气。`;
          }
        }
      }
      break;
    }
    case 'sect': {
      const st = s.sectId ? w.sects[s.sectId] : undefined;
      if (st) {
        s.stones += ri(r, 20, 60) * (1 + s.realm);
        if (chance(r, 0.012)) {
          // 门派差事结仇：替门里办事，结下私人恩怨
          const foeSect = st.foes.length ? pick(r, st.foes) : undefined;
          const foe = foeSect ? Object.keys(w.souls).map((i) => w.souls[i]).find((x) => x.alive && x.sectId === foeSect) : undefined;
          if (foe) {
            holdGrudge(w, foe, s, `${st.name}的人杀了我同门`, w.day, 72);
            st.grudges.push({ other: foeSect ?? '', reason: '门下相争', heat: 40, day: w.day });
            chron(w, w.day, 'sect', `${st.name}与${w.sects[foeSect ?? '']?.name ?? '外道'}门下起了冲突`, s.atId, 2);
          }
        }
        if (chance(r, 0.03)) { st.deeds.push({ day: w.day, text: `${s.name}办成一件差事` }); s.fame += 2; }
      }
      break;
    }
    case 'social': {
      const near = randomOther(w, r, s);
      if (near) {
        const val = ri(r, 2, 9) * (s.pers === 'kind' ? 1.5 : 1);
        tie(w, s, near, chance(r, 0.2) ? 'trade' : 'friend', val, w.day);
        s.need.belonging = clamp(s.need.belonging - 8, 0, 100);
        if (chance(r, 0.25)) rumor(w, w.day, 'trade', `${s.name}与${near.name}在${placeName(s.atId)}饮酒闲谈`, s.id, s.atId, 1);
        // 结拜 / 道侣
        const t = s.social.find((x) => x.other === near.id);
        if (t && t.val > 70 && !s.kin.some((k) => k.other === near.id)) {
          if (s.sex !== near.sex && s.age >= 20 && near.age >= 20 && chance(r, 0.18)) { marry(w, s, near, w.day); s.need.belonging = 5; near.need.belonging = 5; }
          else if (chance(r, 0.12)) { tie(w, s, near, 'sworn', 20, w.day); chron(w, w.day, 'bond', `${s.name}与${near.name}结为异姓兄妹`, s.atId, 2); }
        }
        if (t && t.val < -50 && chance(r, 0.3)) holdGrudge(w, s, near, pick(r, GRUDGE_REASONS.insult), w.day, 55);
        // 生儿育女
        const sp = s.kin.find((k) => k.kind === 'spouse');
        const spouse = sp ? w.souls[sp.other] : undefined;
        if (spouse && spouse.alive && s.age < 120 && chance(r, 0.01)) {
          const surname = pick(r, COMPOUND.includes(s.name.slice(0, 2)) ? [s.name.slice(0, 2)] : [s.name.slice(0, 1)]);
          const kidSex: Sex = chance(r, 0.5) ? 'm' : 'f';
          const kidName = uniqueName(w, r, surname, kidSex);
          const kid = addSoul(w, {
            id: nid('k'), name: kidName, sex: kidSex, age: 0, realm: 0,
            homeId: s.homeId, homeName: s.homeName, faction: s.faction,
            sectId: chance(r, 0.4) ? s.sectId : undefined, pers: pick(r, ['kind', 'cautious', 'greedy', 'righteous', 'arrogant'] as Soul['pers'][]),
          });
          kid.familyId = s.familyId;
          if (s.familyId && w.families[s.familyId] && !w.families[s.familyId].members.includes(kid.id)) w.families[s.familyId].members.push(kid.id);
          linkKin(s, kid, 'child', w.day); linkKin(spouse, kid, 'child', w.day);
          w.stats.births++;
          chron(w, w.day, 'birth', `${s.name}家中添了新丁（${kid.name}）`, s.homeId, 1);
        }
      }
      break;
    }
    case 'court': {
      const t = s.social.find((x) => x.other === a.targetId);
      const other = a.targetId ? w.souls[a.targetId] : undefined;
      if (t && other && other.alive) {
        t.val = clamp(t.val + ri(r, 3, 10), -100, 100);
        if (t.val > 75 && !s.kin.some((k) => k.kind === 'spouse')) marry(w, s, other, w.day);
      }
      break;
    }
    case 'teach': {
      const d = s.social.find((x) => x.kind === 'disciple');
      const disc = d ? w.souls[d.other] : undefined;
      if (disc && disc.alive) {
        disc.need.cultivation = clamp(disc.need.cultivation - 10, 0, 100);
        tie(w, s, disc, 'mentor', ri(r, 1, 6), w.day);
      } else if (chance(r, 0.1)) {
        const near = randomOther(w, r, s);
        if (near && near.realm <= s.realm && chance(r, 0.5)) {
          tie(w, s, near, 'disciple', 30, w.day);
          tie(w, near, s, 'mentor', 30, w.day);
          const art = s.arts[0];
          if (art && !near.arts.some((x) => x.name === art.name)) {
            const copy = mkArt(r, art.name, art.el, art.tier, `${s.name}传下的`, r);
            copy.mastery = 2;
            if (near.arts.length >= 4) near.arts.sort((a, b) => b.mastery - a.mastery).pop();
            near.arts.push(copy);
          }
          chron(w, w.day, 'bond', `${s.name}收${near.name}为徒，传了${art?.name ?? '入门功夫'}`, s.atId, 2);
        }
      }
      break;
    }
    case 'avenge': {
      const g = s.grudges.find((x) => !x.done && x.heat >= 60);
      const foe = g ? w.souls[g.other] : undefined;
      if (!g || !foe || !foe.alive) { if (g) g.done = true; break; }
      g.attempts = (g.attempts ?? 0) + 1;
      // 恨意未到极处，只在心里记着（不然世界天天死人）
      if (!g.blood && g.heat < 86 && chance(r, 0.7)) { g.heat = clamp(g.heat + 2, 0, 100); break; }
      const samePlace = foe.atId === s.atId || chance(r, 0.25);
      if (!samePlace) { s.atId = foe.atId; break; }  // 寻仇要先赶路（真实感）
      if (s.realm < foe.realm - 1 && s.pers !== 'ruthless') { s.need.safety = clamp(s.need.safety - 8, 0, 100); break; }
      w.stats.duels++;
      const win = clamp(0.5 + (s.realm - foe.realm) * 0.22 + (s.pers === 'ruthless' ? 0.12 : 0), 0.05, 0.95);
      const lethal = budget.blood || g.blood;
      if (!lethal) {
        // 点到为止：伤而不杀，恨意稍减（江湖里多数斗法是这样收场的）
        g.heat = clamp(g.heat - 14, 0, 100);
        foe.mood -= 3; s.need.revenge = clamp(s.need.revenge - 12, 0, 100);
        chron(w, w.day, 'grudge', `${s.name}寻${foe.name}斗了一场，两败俱伤却都没下死手`, s.atId, 1);
        break;
      }
      if (chance(r, win)) {
        const forgive = s.pers === 'kind' && chance(r, 0.25) && !g.blood;
        if (forgive) {
          g.done = true; g.heat = 10;
          tie(w, s, foe, 'rival', 15, w.day);
          chron(w, w.day, 'revenge', `${s.name}寻到了${foe.name}，斗了一场却放下了旧怨`, s.atId, 2);
        } else {
          die(w, foe, '被寻仇者击杀', s.id, r);
          w.stats.revenge++;
          g.done = true;
          chron(w, w.day, 'revenge', `${s.name}报了仇：${g.reason}`, s.atId, 3);
          if (foe.id === HERO_ID) { w.hero.grudge += 15; heroDeed(w, `被${s.name}寻仇得手`, 4); }
        }
      } else {
        if (chance(r, 0.3)) { die(w, s, '寻仇失败，反被击杀', foe.id, r); }
        else { g.heat = clamp(g.heat - 6, 0, 100); s.need.safety = clamp(s.need.safety - 10, 0, 100); holdGrudge(w, foe, s, `他寻仇未遂，反被我打伤`, w.day, 60); }
      }
      break;
    }
    case 'home':
    case 'seclude':
    case 'visit':
    case 'errand':
    case 'guard':
    default: {
      s.need.cultivation = clamp(s.need.cultivation - 2, 0, 100);
      s.need.safety = clamp(s.need.safety + 2, 0, 100);
      if (a.kind === 'home' && chance(r, 0.1)) s.quip = pick(r, ['家里安好。', '孩子又长高了些。', '祭了祖，心里踏实。']);
      break;
    }
  }
  // 主角在场：世界观会注意到你（但只是注意到，不会没头没脑地招你来）
  if (opt?.heroAt && s.alive && s.atId === opt.heroAt && chance(r, 0.02)) {
    s.metHero = true;
    if (chance(r, 0.3)) s.quip = pick(r, [`听说${w.heroName}也在这边。`, '外头来了个生面孔，得多留个心眼。', `听说${w.heroName}近来有些名声。`]);
  }
}

function meetRival(w: World, s: Soul, r: Rnd, kind: 'gather' | 'hunt'): void {
  const near = randomOther(w, r, s);
  if (!near) return;
  const contested = kind === 'gather' ? pick(r, GRUDGE_REASONS.rob) : pick(r, GRUDGE_REASONS.envy.concat(GRUDGE_REASONS.duel));
  if ((s.pers === 'ruthless' || near.pers === 'ruthless') && chance(r, 0.25)) {
    const agg = s.pers === 'ruthless' ? s : near;
    const victim = agg === s ? near : s;
    holdGrudge(w, victim, agg, contested, w.day, 64);
    chron(w, w.day, 'grudge', `${agg.name}与${victim.name}在${placeName(s.atId)}争夺一处出产`, s.atId, 1);
  } else {
    tie(w, s, near, 'friend', ri(r, 2, 8), w.day);
    s.quip = `在${placeName(s.atId)}遇上${near.name}，同行一程。`;
  }
}

function decay(w: World, r: Rnd): void {
  const ids = Object.keys(w.souls);
  for (const id of ids) {
    const s = w.souls[id];
    if (!s.alive) continue;
    for (const g of s.grudges) {
      if (g.done) continue;
      const foe = w.souls[g.other];
      if (!foe || !foe.alive) { g.done = true; continue; }
      if (!g.blood && chance(r, 0.004)) { g.heat = clamp(g.heat - ri(r, 4, 12), 0, 100); if (g.heat <= 8) { g.done = true; } }
      if (g.heat >= 85 && chance(r, 0.006)) s.need.revenge = 100;
    }
    // 债务利息与心境
    for (const d of s.debts) if (chance(r, 0.01)) d.amount = Math.round(d.amount * 1.01);
    // 关系随时间淡去
    for (const t of s.social) if (w.day - t.last > 900 && chance(r, 0.02)) t.val = clamp(t.val - 2, -100, 100);
  }
  // 传闻发酵
  for (const rm of w.rumors) if (chance(r, 0.03)) rm.truth = clamp(rm.truth - 0.1, 0.15, 1);
}

function spreadRumors(w: World, r: Rnd): void {
  if (!w.rumors.length) return;
  const fresh = w.rumors.filter((x) => w.day - x.day < 60);
  if (!fresh.length) return;
  const teller = pick(r, fresh);
  const from = w.souls[teller.about];
  const ids = Object.keys(w.souls);
  for (let i = 0; i < 3; i++) {
    const id = pick(r, ids);
    const s = w.souls[id];
    if (!s || !s.alive) continue;
    // 传闻只沿着关系网 / 同乡传播
    const knows = s.social.some((t) => t.other === teller.about) || (from && from.homeId === s.homeId);
    if (!knows && chance(r, 0.8)) continue;
    teller.spread++;
    if (chance(r, 0.02)) {
      s.quip = `听说：${teller.text}${teller.truth < 0.6 ? '——也不知真假' : ''}。`;
    }
  }
}

// ---------------------------------------------------------------- 主角行为回馈（NPC 记账，世界因此改变）
export function heroMeet(w: World, id: string, tone: 'kind' | 'neutral' | 'rude' = 'neutral'): void {
  const s = w.souls[id]; if (!s) return;
  s.metHero = true; s.lastTalkDay = w.day;
  w.hero.met = true;
  const hr = mulberry32(hash('hm:' + w.day + ':' + id));
  const d = tone === 'kind' ? ri(hr, 6, 14) : tone === 'rude' ? -ri(hr, 6, 16) : ri(hr, 1, 6);
  s.favor = clamp((s.favor ?? 0) + d, -100, 100);
  w.hero.favor += Math.round(d * 0.4);
  tie(w, w.souls[HERO_ID], s, d > 0 ? 'friend' : 'rival', d, w.day);
  if (tone === 'rude' && chance(mulberry32(hash(w.day + ':' + s.id)), 0.25)) holdGrudge(w, s, w.souls[HERO_ID], `${w.heroName}出言无礼`, w.day, 45);
}

export function heroGift(w: World, id: string, itemName: string, worth: number): void {
  const s = w.souls[id]; if (!s) return;
  s.bag.push({ id: nid('i'), name: itemName, kind: 'misc', tier: 1, count: 1, src: `${w.heroName}所赠`, day: w.day, worth, about: w.heroName });
  s.favor = clamp((s.favor ?? 0) + clamp(Math.round(worth / 50), 4, 30), -100, 100);
  w.hero.favor += 3;
  heroDeed(w, `赠了${s.name}一${itemName}`, 2);
  rumor(w, w.day, 'hero', `${w.heroName}赠了${s.name}一${itemName}`, HERO_ID, s.atId, 1);
}

export function heroKill(w: World, id: string, reason: string): void {
  const s = w.souls[id]; if (!s || !s.alive) return;
  die(w, s, `被${w.heroName}斩杀`, HERO_ID);
  w.stats.murders++;
  chron(w, w.day, 'kill', `${w.heroName}在${placeName(s.atId)}斩杀了${s.name}：${reason}`, s.atId, 3);
  // 目击者与亲族都会知道 —— 世界不会假装没看见
  const near = Object.keys(w.souls).map((i) => w.souls[i]).filter((x) => x.alive && x.id !== HERO_ID && x.atId === s.atId);
  for (const n of near.slice(0, 6)) {
    if (s.social.some((t) => t.other === n.id) || n.pers === 'righteous' || chance(mulberry32(hash(w.day + n.id)), 0.4)) {
      holdGrudge(w, n, w.souls[HERO_ID], `${w.heroName}杀了${s.name}${n.social.some((t) => t.other === s.id) ? '（是他的朋友）' : ''}`, w.day, n.social.some((t) => t.other === s.id) ? 82 : 42, n.kin.some((k) => k.other === s.id));
    }
    n.metHero = true;
  }
  // 战利品：主角真的拿到东西（从袋里来）
  const loot = s.bag.splice(0, Math.min(3, s.bag.length));
  for (const it of loot) it.src = `从${s.name}身上搜出`;
  return;
}

export function heroSpare(w: World, id: string, note: string): void {
  const s = w.souls[id]; if (!s) return;
  s.favor = clamp((s.favor ?? 0) + 25, -100, 100);
  s.metHero = true;
  for (const g of s.grudges) if (g.other === HERO_ID) { g.heat = clamp(g.heat - 40, 0, 100); }
  w.hero.favor += 4;
  heroDeed(w, `饶了${s.name}（${note}）`, 3);
  tie(w, s, w.souls[HERO_ID], 'friend', 20, w.day);
  chron(w, w.day, 'hero', `${w.heroName}饶了${s.name}一命`, s.atId, 2);
}

export function heroTrade(w: World, id: string, itemName: string, stones: number): void {
  const s = w.souls[id]; if (!s) return;
  s.stones = Math.max(0, s.stones - stones);
  w.souls[HERO_ID].stones += stones;
  s.favor = clamp((s.favor ?? 0) + 8, -100, 100);
  tie(w, s, w.souls[HERO_ID], 'trade', 10, w.day);
  heroDeed(w, `与${s.name}做成一桩买卖（${itemName}）`, 1);
}

export function heroSectFavor(w: World, sectId: string, text: string): void {
  const st = w.sects[sectId]; if (!st) return;
  st.mood = clamp(st.mood + 6, 0, 100);
  st.deeds.push({ day: w.day, text });
  w.hero.fame += 2;
  chron(w, w.day, 'sect', `${st.name}：${text}`, undefined, 2);
}

/** 主角拒绝了一次邀约 —— 有代价 */
export function heroRefuse(w: World, contactId: string): string {
  const c = w.contacts.find((x) => x.id === contactId);
  if (!c) return '此事已作罢。';
  c.handled = true; c.result = '你推了。';
  w.stats.refused++;
  const s = w.souls[c.from];
  if (s) {
    s.favor = clamp((s.favor ?? 0) - 12, -100, 100);
    const grudgeHeat = c.tone === 'threat' || c.tone === 'vengeance' ? 70 : 45;
    holdGrudge(w, s, w.souls[HERO_ID], `${w.heroName}不肯${c.reason}`, w.day, grudgeHeat);
    s.quip = `他推了我的事，我记着。`;
    if (chance(mulberry32(hash(w.day + s.id)), 0.5)) {
      rumor(w, w.day, 'hero', `${w.heroName}推了${s.name}的事（${c.reason}）`, HERO_ID, s.atId, 1);
    }
  }
  chron(w, w.day, 'hero', `${w.heroName}推了${s.name}的请托：${c.reason}`, c.placeId, 1);
  return c.cost;
}

export function heroAccept(w: World, contactId: string): string {
  const c = w.contacts.find((x) => x.id === contactId);
  if (!c) return '此事已了。';
  c.handled = true; c.result = '你应了。';
  w.stats.contact++;
  const s = w.souls[c.from];
  if (s) {
    s.favor = clamp((s.favor ?? 0) + 20, -100, 100);
    tie(w, s, w.souls[HERO_ID], 'friend', 18, w.day);
    for (const g of s.grudges) if (g.other === HERO_ID && !g.blood) g.heat = clamp(g.heat - 30, 0, 100);
    if (c.tone === 'trade' || c.tone === 'friendly') heroTrade(w, s.id, c.about ?? '一件东西', 0);
    s.quip = '这事办得漂亮。';
  }
  w.hero.favor += 4; w.hero.fame += 2;
  heroDeed(w, `应了${c.fromName}的请托：${c.reason}`, 2);
  chron(w, w.day, 'hero', `${w.heroName}应了${c.fromName}的请托`, c.placeId, 2);
  return c.gain;
}

// ---------------------------------------------------------------- 邀约（必有缘由 + 冷却 + 利弊）
const CONTACT_CD = 40;   // 同一人 40 日内不会再来找你

function canContact(w: World, s: Soul): boolean {
  if (!s.alive) return false;
  if (w.day - (s.lastTalkDay ?? -9999) < 12) return false;
  if (w.contacts.some((c) => c.from === s.id && !c.handled)) return false;
  const last = w.contacts.filter((c) => c.from === s.id).pop();
  return !last || w.day - last.day > CONTACT_CD;
}

/** 每日掷骰：只有「确有缘由」的人才会来找主角 */
function maybeContacts(w: World, r: Rnd): void {
  w.contacts = w.contacts.filter((c) => !c.handled && w.day < c.until);
  const hero = w.souls[HERO_ID];
  if (w.contacts.length >= 3) return;
  // 每日最多 1 件（约每 3~8 日一件），杜绝「总有人莫名其妙找我」
  if (!chance(r, 0.3)) return;
  const ids = Object.keys(w.souls).filter((i) => i !== HERO_ID && canContact(w, w.souls[i]));
  if (!ids.length) return;
  const cands: [string, number][] = [];
  for (const id of ids) {
    const s = w.souls[id];
    let sc = 0;
    const grudge = s.grudges.find((g) => g.other === HERO_ID && !g.done);
    if (grudge) sc += grudge.heat * 0.6 + (grudge.blood ? 60 : 0);
    const social = s.social.find((t) => t.other === HERO_ID);
    if (social) sc += social.val * 0.5;
    const debt = s.debts.find((d) => d.other === HERO_ID);
    if (debt) sc += 40;
    // 有求于你袋中之物
    const want = hero.bag.find((it) => it.tier >= 2 && it.worth > 300);
    if (want && (s.pers === 'greedy' || s.pers === 'ruthless' || s.arts.some((a) => a.name === want.name))) sc += 34;
    // 血亲之死
    if (s.kin.some((k) => w.souls[k.other]?.killer === HERO_ID)) sc += 90;
    if (s.sectId && w.sects[s.sectId]?.mood > 70 && s.realm >= hero.realm) sc += 12;
    if (s.atId !== hero.atId && s.homeId !== hero.atId) sc *= 0.5;
    if (sc > 12) cands.push([id, sc]);
  }
  if (!cands.length) return;
  const id = weighted(r, cands);
  const s = w.souls[id];
  const req = buildContact(w, r, s);
  if (req) { w.contacts.push(req); s.lastTalkDay = w.day; }
}

export function buildContact(w: World, r: Rnd, s: Soul): ContactRequest | null {
  const hero = w.souls[HERO_ID];
  const grudge = s.grudges.find((g) => g.other === HERO_ID && !g.done);
  const social = s.social.find((t) => t.other === HERO_ID);
  const deadKin = s.kin.map((k) => w.souls[k.other]).find((k) => k && k.killer === HERO_ID);
  const want = hero.bag.find((it) => it.tier >= 2 && it.worth > 300);
  const give = s.bag.find((it) => it.tier >= 2) ?? s.bag[0];
  let tone: ContactRequest['tone'] = 'curiosity';
  let reason = ''; let line = ''; let gain = ''; let cost = ''; let about: string | undefined;

  if (deadKin) {
    tone = 'grief';
    reason = `${deadKin.name}之死要个说法`;
    line = `「${deadKin.name}是我家的人。你杀了他——我要听你亲口说，当时是何缘由。」`;
    gain = GAIN_TEXT.peace; cost = COST_TEXT.family;
  } else if (grudge && grudge.heat >= 60) {
    tone = grudge.blood ? 'vengeance' : 'threat';
    reason = `${grudge.reason}`;
    line = `「${grudge.reason}。这笔账，你打算怎么算？」`;
    gain = '当面说清，或可化解'; cost = grudge.blood ? COST_TEXT.family : COST_TEXT.hunt;
  } else if (grudge) {
    tone = 'threat';
    reason = `想当面问清旧事（${grudge.reason}）`;
    line = `「别急着走。${grudge.reason}——我想听你自己说。」`;
    gain = GAIN_TEXT.peace; cost = COST_TEXT.grudge;
  } else if (want && (s.pers === 'greedy' || s.pers === 'ruthless' || s.faction === 'merchant')) {
    tone = 'trade';
    about = want.name;
    reason = `想买你袋里的${want.name}`;
    line = `「听闻你袋里有一${want.name}。我出得起价——你要灵石，还是要换东西？」`;
    gain = `能换来灵石或一件${give?.name ?? '东西'}`; cost = COST_TEXT.favor;
  } else if (s.stuckArt && social && social.val > 25) {
    tone = 'friendly';
    reason = `修${s.stuckArt}卡住了，想请你一起参详`;
    line = `「我在${s.stuckArt}上卡了些年头。听闻你路子野，想请你帮我看看。」`;
    gain = GAIN_TEXT.art; cost = COST_TEXT.favor;
  } else if (social && social.val > 40 && give) {
    tone = chance(r, 0.5) ? 'friendly' : 'trade';
    reason = chance(r, 0.5) ? `有件${give.name}想让你过目` : '许久未见，约你一叙';
    line = `「我这儿有件${give.name}，来路你放心。你若有興趣，咱们谈谈。」`;
    gain = GAIN_TEXT.item; cost = COST_TEXT.favor;
  } else if (s.sectId && s.realm >= hero.realm && s.faction !== 'demon') {
    tone = 'sect';
    reason = `${s.sectName}有件差事点名要人`;
    line = `「${s.sectName}这边有件差事，长老点了你的名。去了有赏，不去的话……」`;
    gain = GAIN_TEXT.sect; cost = COST_TEXT.sect;
  } else if (Math.abs(w.hero.fame) >= 18 && (s.homeId === hero.atId || s.atId === hero.atId)) {
    tone = 'curiosity';
    reason = w.hero.fame > 0 ? `${w.heroName}的名声传得厉害，想亲眼看看` : `${w.heroName}恶名在外，想来探探深浅`;
    line = w.hero.fame > 0 ? `「外头都在说你。我今日来，是想亲眼瞧瞧。」` : `「外头把你说得很凶。我倒要看看你是个什么人。」`;
    gain = '谈得来，便多一个照应'; cost = '话不投机，往后见面就是仇人';
  } else if (social && social.val < -30) {
    tone = 'threat';
    reason = '想看看你到底有多少斤两';
    line = '「早就想会一会你了。」';
    gain = '斗一场，胜负自负'; cost = COST_TEXT.hunt;
  } else {
    return null;   // 没有缘由，就不来找你 —— 这就是「不再莫名其妙」
  }

  const lines = CONTACT_TONE_LINE[tone] ?? CONTACT_TONE_LINE.curiosity;
  return {
    id: nid('c'), from: s.id, fromName: s.name, day: w.day, until: w.day + ri(r, 12, 40),
    reason, line: line.startsWith('「') ? line : `${pick(r, lines)}${line}`,
    tone, gain, cost, placeId: s.atId, placeName: placeName(s.atId), about,
  };
}

// ---------------------------------------------------------------- 查询（给 UI / API 用）
export function soulView(w: World, id: string) {
  const s = w.souls[id];
  if (!s) return null;
  return {
    ...s,
    persName: persName(s.pers),
    realmName: realmName(w, s.realm, s.stage),
    bagWorth: s.bag.reduce((a, b) => a + b.worth * b.count, 0),
    kinNames: s.kin.map((k) => ({ kind: kinWord(k.kind), name: nameOf(w, k.other), id: k.other, alive: w.souls[k.other]?.alive ?? false })),
    socialNames: s.social.map((t) => ({ kind: t.kind, val: Math.round(t.val), name: nameOf(w, t.other), id: t.other })),
    grudgeNames: s.grudges.map((g) => ({ heat: Math.round(g.heat), reason: g.reason, blood: !!g.blood, done: !!g.done, name: nameOf(w, g.other), id: g.other })),
    agendaText: agendaText(w, s),
  };
}

export function persName(p: string) {
  const m: Record<string, string> = { righteous: '正直', greedy: '贪婪', cautious: '谨慎', arrogant: '傲慢', kind: '温和', ruthless: '狠辣', aloof: '淡泊' };
  return m[p] ?? p;
}
export function kinWord(k: string) {
  const m: Record<string, string> = { spouse: '道侣', parent: '尊亲', child: '子女', sibling: '兄弟姊妹' };
  return m[k] ?? k;
}
export function realmName(w: World, realm: number, stage: number) {
  const names = ['练气', '筑基', '结丹', '元婴', '化神', '炼虚'];
  const stages = ['初', '中', '后', '大圆满'];
  return `${names[realm] ?? '练气'}期${stages[stage] ?? ''}`;
}
export function agendaText(w: World, s: Soul) {
  const m: Record<string, string> = {
    train: '修行', gather: '采药', hunt: '猎妖', trade: '做买卖', errand: '办事', seclude: '闭关',
    home: '在家', avenge: '寻仇', sect: '门中差事', social: '应酬', court: '走动感情', visit: '探望', teach: '授业', guard: '守卫',
  };
  const tgt = s.agenda.targetId ? nameOf(w, s.agenda.targetId) : '';
  return `${m[s.agenda.kind] ?? s.agenda.kind}${tgt ? `（对象：${tgt}）` : ''} · ${s.agenda.why}`;
}

export function worldSummary(w: World) {
  const souls = Object.keys(w.souls).map((i) => w.souls[i]);
  const alive = souls.filter((s) => s.alive);
  return {
    day: Math.round(w.day),
    population: alive.length,
    sects: Object.keys(w.sects).map((k) => {
      const st = w.sects[k];
      return { id: st.id, name: st.name, demon: st.demon, members: alive.filter((s) => s.sectId === st.id).length, mood: Math.round(st.mood), foes: st.foes.map((f) => w.sects[f]?.name ?? f) };
    }),
    families: Object.keys(w.families).map((k) => {
      const f = w.families[k];
      return { id: f.id, name: f.name, seat: f.seat, members: f.members.length, honor: Math.round(f.honor), creed: f.creed, feuds: f.feuds.length };
    }),
    stats: w.stats,
    openContacts: w.contacts.filter((c) => !c.handled).length,
    bagWorth: alive.reduce((a, s) => a + s.bag.reduce((x, y) => x + y.worth * y.count, 0), 0),
  };
}
