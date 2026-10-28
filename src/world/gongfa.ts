// 第 4 阶段（s4-content）：功法的实际效果——主修 / 辅修 / 秘术、灵根适配、五行相生、套路搭配
// 接入点（都是一行钩子）：
//   cultivation.ts mod()      → gfMod：辅修加属性、灵根适配改修炼速度
//   combat.ts cast()          → gfSkillMul（主修路子加成、五行相生）+ payArtCost（秘术代价）
//   artacts.ts ArtActs.spawn  → applyArtMods（法宝：路子 / 辅修 / 套路）
//   game.ts learnScroll()     → learnGongfa
import type { Game } from './game';
import type { Hero } from './cultivation';
import type { ArtSkill } from '../data/arts';
import { ARTS } from '../data/arts';
import { GONGFA, type GongfaDef, type TalentMod } from '../data/skills';
import { itemDef, type ArtSpec } from '../data/items';
import { REALMS, expNeed } from '../data/realms';
import { ART_COST } from '../data/canon/spells';
import { COMBOS, type ComboDef, type ComboFx } from '../data/canon/combos';
import { ART_META } from '../data/canon/artgen';
import { SECTS } from '../data/canon/sects';
import { AUX_NAME } from '../data/canon/gongfa';
import { type Wx, WX_NAME, BASE5, SHENG, VARIANT, wxOfSchool, wxOfArt } from '../data/canon/types';

declare module './cultivation' {
  interface Hero {
    /** 第 4 阶段：修过的主修功法（可在功法面板里改修） */
    gfKnown?: string[];
    /** 辅修（筑基一门、结丹两门、元婴三门） */
    gfAux?: string[];
    /** 灵根属性（旧档按灵根种类给默认） */
    rootWx?: Wx[];
  }
}

// ================================================================= 灵根
const ROOT_WX: Record<string, Wx[]> = { heaven: ['wood'], variant: ['thunder'], true: ['wood', 'water'], triple: ['wood', 'fire', 'earth'], fake: ['wood', 'water', 'fire', 'earth'] };
export function rootWx(h: Hero): Wx[] { return h.rootWx ?? ROOT_WX[h.root] ?? ROOT_WX.fake; }
const ROOT_K: Record<string, number> = { heaven: 1.35, variant: 1.25, true: 1.2, triple: 1.08, fake: 1 };
/** 灵根对功法的适配（修炼速度倍率、路子加成倍率） */
export function gfFit(h: Hero, g: GongfaDef | undefined): number {
  if (!g || !g.wx || g.wx === 'none' || g.wx === 'yin' || g.cat === 'aux' || g.cat === 'secret') return 1;
  const R = rootWx(h);
  if (R.includes(g.wx)) return ROOT_K[h.root] ?? 1;
  if (VARIANT.includes(g.wx)) return R.some((w) => BASE5[w] === BASE5[g.wx!]) ? 0.75 : 0.6;   // 异种功法：无变异灵根者强修
  return 0.7;
}
export function fitText(h: Hero, g: GongfaDef | undefined) {
  const f = gfFit(h, g);
  return f > 1.01 ? `灵根相合 ×${f.toFixed(2)}` : f < 0.99 ? `灵根相悖 ×${f.toFixed(2)}` : '灵根无碍';
}

// ================================================================= 辅修
export const auxSlots = (h: Hero) => (h.realm >= 4 ? 3 : h.realm >= 3 ? 2 : h.realm >= 2 ? 1 : 0);
export function auxList(h: Hero): GongfaDef[] { return (h.gfAux ?? []).map((id) => GONGFA[id]).filter(Boolean); }
/** 某门类辅修的强度（auxK 之和） */
export function auxK(h: Hero, kind: string): number { let v = 0; for (const g of auxList(h)) if (g.auxKind === kind || g.id === kind) v += g.auxK ?? 1; return v; }

const modCache = new Map<string, Partial<Record<TalentMod, number>>>();
/** cultivation.mod() 的钩子：辅修属性 + 主修灵根适配（修炼速度） */
export function gfMod(h: Hero, m: TalentMod): number {
  if (!h) return 0;
  const key = `${h.gongfa}|${(h.gfAux ?? []).join(',')}|${h.root}|${(h.rootWx ?? []).join(',')}`;
  let M = modCache.get(key);
  if (!M) {
    M = {};
    const add = (k: TalentMod, v: number) => { M![k] = (M![k] ?? 0) + v; };
    add('exp', gfFit(h, GONGFA[h.gongfa]) - 1);
    for (const g of auxList(h)) {
      const k = g.auxK ?? 1;
      switch (g.auxKind) {
        case 'shen': if (g.id !== 'dayan') add('sense', 0.08 * k); break;
        case 'ti': add('hp', 0.1 * k); add('def', 0.06 * k); break;
        case 'dun': add('speed', 0.04 * k); add('mapSpeed', 0.06 * k); break;
        case 'dan': add('alchemy', 0.08 * k); break;
        case 'shou': case 'kui': add('mp', 0.03 * k); break;
        case 'zhen': case 'fu': add('mp', 0.04 * k); break;
        case 'qi': add('sense', 0.03 * k); break;
      }
    }
    modCache.set(key, M);
  }
  return M[m] ?? 0;
}

// ================================================================= 五行相生（连招）
let lastWx: Wx = 'none', lastT = -99, chainN = 0;
/** 连续施展相生的两系（木→火→土→金→水→木），每接一环威力 +12%（至多三环） */
export function wuxingChain(g: Game, w: Wx): number {
  const now = g.time, a = BASE5[lastWx], b = BASE5[w];
  let k = 1;
  if (a && b && SHENG[a] === b && now - lastT < 4) {
    chainN = Math.min(3, chainN + 1); k = 1 + 0.12 * chainN;
    const p = g.player;
    g.combat.texts.push({ x: p.x, y: p.y - 150, s: `五行相生·${WX_NAME[lastWx]}生${WX_NAME[w]}${chainN > 1 ? ' ×' + chainN : ''}`, color: '#ffe08a', t: 0, vy: -30 });
  } else if (b) chainN = 0;
  if (b) { lastWx = w; lastT = now; }
  return k;
}

// ================================================================= 法术：主修路子
/** combat.cast 的钩子：返回攻击倍率 */
export function gfSkillMul(g: Game, s: ArtSkill): number {
  const h = g.hero, gf = GONGFA[h.gongfa];
  checkSig(g);
  let k = 1;
  if (gf?.path?.includes(s.school)) k *= 1 + (gf.pathK ?? 0) * Math.min(1.35, gfFit(h, gf));
  const aux: Record<string, string> = { 识: 'shen', 体: 'ti', 阵: 'zhen', 符: 'fu', 御: 'shou' };
  if (aux[s.school]) k *= 1 + 0.06 * auxK(h, aux[s.school]) + (s.school === '御' ? 0.06 * auxK(h, 'kui') : 0);
  if (s.power > 0) k *= wuxingChain(g, wxOfSchool(s.school));
  return k;
}

/** 秘术代价（combat.cast 的钩子，施展之后） */
export function payArtCost(g: Game, s: ArtSkill) {
  const c = ART_COST[s.id]; if (!c) return;
  const h = g.hero, msg: string[] = [];
  if (c.life) { h.lifeLost += c.life; msg.push(`折寿 ${c.life} 载`); }
  if (c.exp) { const lost = Math.round(expNeed(h.realm, h.stage) * c.exp); h.exp = Math.max(0, h.exp - lost); msg.push(`修为倒退 ${lost}`); }
  if (c.mpFull) h.mp = 1;
  if (c.weak) { const dur = s.dur ?? 10; g.combat.later(dur, () => { h.hp = Math.min(h.hp, 0.3); h.mp = 0; g.toast(`${s.name}之后元气大伤，气血法力几近枯竭。`, 'warn'); }); }
  if (msg.length) g.toast(`施展${s.name}——${msg.join('，')}。`, 'warn');
}

// ================================================================= 专属神通
/** 主修功法到了境界自悟专属神通 */
export function checkSig(g: Game) {
  const h = g.hero, gf = GONGFA[h.gongfa];
  if (!gf?.sig || !ARTS[gf.sig]) return;
  if (h.realm < (gf.sigRealm ?? 1) || h.realm < ARTS[gf.sig].realm) return;
  if (h.arts.some((a) => a.id === gf.sig)) return;
  h.arts.push({ id: gf.sig, xp: 0 });
  const slot = h.hotbar.findIndex((x) => !x); if (slot >= 0) h.hotbar[slot] = gf.sig;
  g.toast(`运转《${gf.name}》日久，心有所感——自悟专属神通「${ARTS[gf.sig].name}」！`, 'good');
}

// ================================================================= 学功法
export function learnGongfa(g: Game, itemId: string): boolean {
  const d = itemDef(itemId), h = g.hero, gf = d.scroll?.gongfa ? GONGFA[d.scroll.gongfa] : undefined;
  if (!gf) return false;
  const req = gf.reqRealm ?? 1;
  if (h.realm < req) { g.toast(`《${gf.name}》需${REALMS[req].name}期方可参修。`, 'warn'); return false; }
  const cat = gf.cat ?? 'main';
  if (cat === 'secret') {
    const art = gf.secretArt && ARTS[gf.secretArt];
    if (!art) return false;
    if (h.arts.some((a) => a.id === art.id)) { g.toast(`你早已会了${art.name}。`, 'warn'); return false; }
    h.arts.push({ id: art.id, xp: 0 });
    const slot = h.hotbar.findIndex((x) => !x); if (slot >= 0) h.hotbar[slot] = art.id;
    g.toast(`参透秘术《${gf.name}》，习得「${art.name}」。此术伤身，非到生死关头莫用。`, 'good');
  } else if (cat === 'aux') {
    const aux = h.gfAux ??= [];
    if (aux.includes(gf.id)) { g.toast(`你已在辅修《${gf.name}》。`, 'warn'); return false; }
    if (aux.length >= auxSlots(h)) { g.toast(`心力有限：辅修筑基可修一门、结丹两门、元婴三门（现有 ${auxSlots(h)} 门）。可在功法面板撤去一门。`, 'warn'); return false; }
    aux.push(gf.id);
    g.toast(`开始辅修《${gf.name}》（${AUX_NAME[gf.auxKind ?? 'shen']}）。`, 'good');
  } else {
    if (h.gongfa === gf.id) { g.toast(`你主修的正是《${gf.name}》。`, 'warn'); return false; }
    const known = h.gfKnown ??= [h.gongfa];
    if (!known.includes(gf.id)) known.push(gf.id);
    g.toast(`《${gf.name}》已录入识海。在功法面板（法）中可改修为主修——改修要散去部分修为。`, 'good');
  }
  C_remove(h, itemId);
  g.updateUI(true);
  return true;
}
function C_remove(h: Hero, id: string) { const b = h.bag.find((x) => x.id === id); if (b) { b.n--; if (b.n <= 0) h.bag.splice(h.bag.indexOf(b), 1); } }

/** 改修主修：散去本小境界三成修为（硬核）；长春功 / 吐纳术改修不损 */
export function switchMain(g: Game, id: string): boolean {
  const h = g.hero, gf = GONGFA[id];
  if (!gf || h.gongfa === id) return false;
  if (h.realm < (gf.reqRealm ?? 1)) { g.toast(`《${gf.name}》需${REALMS[gf.reqRealm ?? 1].name}期方可主修。`, 'warn'); return false; }
  const known = h.gfKnown ??= [h.gongfa];
  if (!known.includes(h.gongfa)) known.push(h.gongfa);
  const cheap = h.gongfa === 'changchun' || h.gongfa === 'generic';
  const lost = cheap ? 0 : Math.round(h.exp * 0.3);
  h.exp -= lost;
  const old = GONGFA[h.gongfa]?.name ?? '';
  h.gongfa = id;
  g.toast(`散去《${old}》，改修《${gf.name}》${lost ? `，修为散去 ${lost}` : ''}。${fitText(h, gf)}。`, lost ? 'warn' : 'good');
  checkSig(g);
  g.updateUI(true);
  return true;
}
export function dropAux(g: Game, id: string) { const h = g.hero; h.gfAux = (h.gfAux ?? []).filter((x) => x !== id); g.toast(`撤去辅修《${GONGFA[id]?.name ?? id}》。`); g.updateUI(true); }

// ================================================================= 法宝：路子 / 辅修 / 套路
export interface ArtMods extends ComboFx { combos: string[] }
function comboHit(h: Hero, c: ComboDef, itemId: string, art: ArtSpec): boolean {
  const gf = GONGFA[h.gongfa], meta = ART_META[itemId];
  if (c.builtin) return false;
  if (c.sameSect) { const s = gf?.sect; if (!s || !SECTS[s] || SECTS[s].gongfa !== gf.id) return false; return meta?.sect === s || SECTS[s].treasure === itemId || SECTS[s].gear.includes(itemId); }
  let gfOk = !c.gf && !c.wx && !c.path && !c.aux;
  if (c.gf?.includes(h.gongfa)) gfOk = true;
  if (c.wx && gf?.wx && c.wx.includes(gf.wx)) gfOk = true;
  if (c.path && gf?.path?.[0] === c.path) gfOk = true;
  if (c.aux && (h.gfAux ?? []).some((a) => c.aux!.includes(a) || c.aux!.includes(GONGFA[a]?.auxKind ?? ''))) gfOk = true;
  if (!gfOk) return false;
  if (c.item && !c.item.includes(itemId)) return false;
  if (c.kind && !c.kind.includes(art.kind)) return false;
  if (c.el && !c.el.includes(wxOfArt(art.element))) return false;
  return true;
}
export function combosFor(h: Hero, itemId: string, art: ArtSpec): ComboDef[] { return COMBOS.filter((c) => comboHit(h, c, itemId, art)); }

/** 法宝出手前：返回倍率与套路效果 */
export function artMods(h: Hero, itemId: string, art: ArtSpec): ArtMods {
  const gf = GONGFA[h.gongfa], fit = Math.min(1.35, gfFit(h, gf));
  const o: ArtMods = { dmg: 1, combos: [] };
  const w = wxOfArt(art.element);
  if (gf?.wx && gf.wx !== 'none' && (w === gf.wx || (BASE5[w] && BASE5[w] === BASE5[gf.wx]))) o.dmg! *= 1 + 0.6 * (gf.pathK ?? 0) * fit;
  if ((art.kind === 'sword' || art.kind === 'needle') && gf?.sword) o.dmg! *= 1 + gf.sword * fit;
  o.dmg! *= 1 + 0.05 * auxK(h, 'qi');
  if (art.kind === 'puppet') o.dmg! *= 1 + 0.12 * auxK(h, 'kui');
  if (art.kind === 'disk' || art.kind === 'pagoda' || art.kind === 'cover') o.dmg! *= 1 + 0.1 * auxK(h, 'zhen');
  if (art.kind === 'banner' || art.kind === 'gourd') o.dmg! *= 1 + 0.08 * auxK(h, 'shou');
  for (const c of combosFor(h, itemId, art)) {
    o.combos.push(c.name);
    const f = c.fx;
    if (f.dmg) o.dmg! *= f.dmg;
    for (const k of ['freeze', 'burn', 'stun'] as const) if (f[k]) o[k] = true;
    for (const k of ['radius', 'dur', 'shield'] as const) if (f[k]) o[k] = (o[k] ?? 1) * f[k]!;
    for (const k of ['chain', 'addPieces', 'heal', 'exec'] as const) if (f[k]) o[k] = Math.max(o[k] ?? 0, f[k]!);
  }
  return o;
}
export { wxOfArt };
