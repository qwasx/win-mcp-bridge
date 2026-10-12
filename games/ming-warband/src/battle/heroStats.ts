// 由玩家档案计算战场上的主角与同伴数值（与单机 BattleScene.deploy 的算法一致），以及他人眼中的主角外观
import type { Hero, CompanionState } from '../core/state';
import { ITEMS } from '../data/items';
import { COMPANIONS } from '../data/world';
import { heroMaxHp, heroArmor, horseRidingReq } from '../core/character';
import type { HeroIn, CompIn, HeroLook, PKind } from './core';

export function meleeWeaponOf(h: Hero): string {
  const m = h.equip.melee ? ITEMS[h.equip.melee] : null;
  if (!m) return 'club';
  const b = m.base ?? m.id;
  if (['w_jian', 'w_club', 'w_tiebian', 'w_langya', 'w_guduo', 'w_jingua', 'w_meteor', 'w_tiechi'].includes(b)) return 'club';
  if (b === 'w_miaodao' || b === 'w_taidao') return 'katana';
  if (m.antiCav || (m.reach ?? 0) >= 40) return 'spear';
  return 'sabre';
}
export function lookOf(h: Hero, color: number): HeroLook {
  const r = h.equip.ranged ? ITEMS[h.equip.ranged] : null;
  const a = h.equip.armor ? ITEMS[h.equip.armor] : null;
  const t = a?.tier ?? 0;
  return { w: meleeWeaponOf(h), wr: r ? (r.kind === 'gun' ? 'gun' : r.kind === 'xbow' ? 'xbow' : 'bow') : null, a: t <= 1 ? 1 : t <= 3 ? 2 : 3, c: color };
}

export function heroIn(h: Hero, color: number): HeroIn {
  const melee = h.equip.melee ? ITEMS[h.equip.melee] : null;
  const ranged = h.equip.ranged ? ITEMS[h.equip.ranged] : null;
  const mounted = !!h.equip.horse && !!ITEMS[h.equip.horse] && h.skills.riding >= horseRidingReq(h.equip.horse!);
  const horse = mounted ? ITEMS[h.equip.horse!] : null;
  const maxHp = heroMaxHp(h);
  return {
    name: h.name, maxHp, hp: Math.max(maxHp * 0.3, maxHp * (h.hp ?? 1)),
    atk: (melee?.dmg ?? 6) * (1 + h.skills.powerstrike * 0.08) * (1 + h.attrs.str * 0.012),
    def: heroArmor(h) + (horse?.horseArmor ?? 0) * 0.5, skill: 8 + h.level * 0.6 + h.attrs.agi * 0.3,
    speed: mounted ? 92 * (horse!.horseSpeed ?? 1.4) * (1 + h.skills.riding * 0.04) : 92 + h.attrs.agi * 2.5,
    mounted, reach: melee?.reach ?? 24, antiCav: !!melee?.antiCav,
    rng: ranged ? (ranged.dmg ?? 10) * (1 + h.skills.archery * 0.07) : 0, range: ranged?.range ?? 0,
    reload: (ranged?.reload ?? 2) * (1 - h.skills.archery * 0.03), ammo: ranged?.ammo ?? 0, kind: (ranged?.kind ?? null) as PKind | null,
    meleeSpeed: melee?.speed ?? 0.8, look: lookOf(h, color),
  };
}

export function compsIn(cs: CompanionState[]): CompIn[] {
  const out: CompIn[] = [];
  for (const c of cs ?? []) {
    if (c.wounded > 0) continue;
    const d = COMPANIONS.find(x => x.id === c.id); if (!d) continue;
    out.push({ id: d.id, name: d.name, hp: d.hp, atk: d.atk, def: d.def, skill: d.skill, mounted: d.mounted, rng: d.rng ?? 0, kind: d.rng ? (d.id === 'c_tang' ? 'gun' : 'bow') : null });
  }
  return out;
}
