// 兵种 → 人物外观
import { TROOPS } from '../data/troops';
import type { FigureSpec, HeadGear, Weapon } from './figures';
import { shade, mix } from './canvas';

const BANNER8 = [0xe8c020, 0xf0f0f0, 0xc83020, 0x2f5fb5]; // 八旗：黄白红蓝
const HORSES = [0x7a4a26, 0x5a3418, 0x9a6a3a, 0x3a2a20, 0xb8a080];

function weaponOf(cls: string, id: string): Weapon {
  if (cls === 'spear') return 'spear';
  if (cls === 'arc' || cls === 'hca') return 'bow';
  if (cls === 'xbow') return 'xbow';
  if (cls === 'gun') return 'gun';
  if (cls === 'cav') return /lancer|heavy|bayara|elite/.test(id) ? 'spear' : 'sabre';
  if (/recruit|peasant/.test(id) && !/jin/.test(id)) return 'club';
  if (id === 'bandit_wokou') return 'katana';
  if (id === 'merc_monk') return 'staff';
  if (id === 'ming_baigan') return 'spear';
  return 'sabre';
}

/** teamColor：本方战袍主色 */
export function troopSpec(troopId: string, teamColor: number): FigureSpec {
  const t = TROOPS[troopId];
  if (!t) return { body: teamColor, armor: 0, head: 'wrap', weapon: 'sabre' };
  const tier = t.tier;
  const armor = (tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : tier === 4 ? 2 : 3) as FigureSpec['armor'];
  let head: HeadGear = 'wrap';
  let headColor: number | undefined;
  let shield: FigureSpec['shield'] = null;
  let backFlag: number | null = null;
  let body = teamColor;
  let robe = false;
  let skin: number | undefined;
  const weapon = weaponOf(t.cls, t.id);
  const hrand = (troopId.length * 7 + troopId.charCodeAt(troopId.length - 1)) % HORSES.length;
  let horse = HORSES[hrand];
  let barding = false;
  switch (t.culture) {
    case 'ming':
      head = tier <= 1 ? 'wrap' : 'mingHelm';
      headColor = tier <= 1 ? 0x3a3530 : undefined;
      if (tier >= 4) backFlag = shade(teamColor, 0.15);
      if (t.cls === 'inf' && tier >= 2 && tier < 4) shield = 'round';
      if (t.id === 'ming_guanning') { barding = true; horse = 0x3a2a20; }
      if (t.id === 'ming_baigan') { head = 'wrap'; headColor = 0xf0ece0; }
      break;
    case 'jin':
      head = tier <= 1 ? 'queue' : 'jinHelm';
      headColor = BANNER8[(troopId.length) % 4];
      if (tier >= 3) backFlag = headColor;
      if (t.id === 'jin_bayara') { barding = true; horse = 0xd8d0c0; }
      if (t.cls === 'inf' && tier === 2) shield = 'round';
      break;
    case 'chuang':
      head = tier >= 4 ? 'mingHelm' : 'wrap';
      headColor = tier >= 4 ? undefined : mix(0xd88a1c, 0xc03020, 0.4);
      if (tier >= 5) backFlag = 0xe0b030;
      if (t.cls === 'inf' && tier === 2) shield = 'round';
      break;
    case 'xi':
      head = tier >= 4 ? 'mingHelm' : t.id === 'xi_blade' ? 'rattan' : 'wrap';
      headColor = 0x5a3a7a;
      if (t.id === 'xi_blade' || t.id === 'xi_guard') shield = 'rattan';
      break;
    case 'mon':
      head = tier >= 4 ? 'monHelm' : 'furHat';
      headColor = mix(teamColor, 0x3a2a1a, 0.3);
      if (t.id === 'mon_heavy') { barding = true; }
      skin = 0xd8b088;
      break;
    case 'bandit':
      body = mix(teamColor, 0x3a3028, 0.55);
      head = t.id === 'bandit_wokou' ? 'topknot' : t.id === 'bandit_horse' ? 'furHat' : 'wrap';
      headColor = 0xa02a20;
      if (t.id === 'bandit_chief') head = 'mingHelm';
      break;
    case 'merc':
      if (t.id === 'merc_monk') { head = 'bald'; body = mix(teamColor, 0xc87a20, 0.6); robe = true; }
      else if (t.id === 'merc_porto') { head = 'morion'; skin = 0xf0d0b0; }
      else if (t.id === 'merc_rider') { head = 'furHat'; headColor = 0x6a4a2a; }
      else { head = 'cap'; }
      break;
    case 'civ':
      if (t.id === 'civ_peasant') { head = 'straw'; body = mix(teamColor, 0x8a7a5a, 0.7); }
      else head = 'cap';
      break;
  }
  return {
    body, trim: shade(body, -0.38), armor, head, headColor, weapon, shield, mounted: t.mounted, horse, barding, backFlag, robe, skin,
  };
}

export function companionSpec(id: string, teamColor: number, mounted: boolean): FigureSpec {
  const base: FigureSpec = { body: teamColor, armor: 2, head: 'mingHelm', weapon: 'sabre', mounted, horse: 0x6a4024 };
  const cyan = 0x3a8aa0;
  switch (id) {
    case 'c_qian': return { ...base, body: mix(teamColor, 0xc0392b, 0.5), weapon: 'spear', armor: 3, backFlag: 0xc0392b };
    case 'c_qin': return { ...base, body: 0xb02a2a, head: 'female', weapon: 'spear', armor: 1, horse: 0xe8e0d0, cape: 0x8a1a1a };
    case 'c_liu': return { ...base, body: 0x6a8aa0, head: 'scholar', weapon: 'none', armor: 0, robe: true };
    case 'c_batu': return { ...base, body: 0x4a7a5a, head: 'furHat', headColor: 0x5a3a20, weapon: 'bow', armor: 1, horse: 0x9a6a3a, skin: 0xd8b088 };
    case 'c_wang': return { ...base, body: 0x3a3a40, head: 'cap', weapon: 'club', armor: 1, shield: 'round' };
    case 'c_lin': return { ...base, body: 0x2a6a8a, head: 'straw', headColor: 0xc8a860, weapon: 'gun', armor: 0 };
    case 'c_qing': return { ...base, body: 0x5a6a7a, head: 'taoist', weapon: 'sabre', armor: 0, robe: true };
    case 'c_tang': return { ...base, body: 0x1e1e24, head: 'scholar', weapon: 'gun', armor: 0, robe: true, skin: 0xf0d4b8 };
    case 'c_zhao': return { ...base, body: 0x7a5a3a, head: 'wrap', headColor: 0x2a2420, weapon: 'katana', armor: 1, horse: 0x3a2a20 };
    case 'c_aluo': return { ...base, body: 0x2a5a4a, head: 'wrap', headColor: 0x1a3a6a, weapon: 'bow', armor: 0 };
  }
  return { ...base, body: cyan };
}

export function heroSpec(opts: { mounted: boolean; weapon: Weapon; armor: number; color: number }): FigureSpec {
  const a = Math.max(1, Math.min(3, opts.armor)) as FigureSpec['armor'];
  return {
    body: opts.color, trim: 0xd4af37, armor: a, head: a >= 2 ? 'goldHelm' : 'cap', weapon: opts.weapon, mounted: opts.mounted,
    horse: 0x3a2418, barding: a >= 3 && opts.mounted, cape: 0xa81c14, backFlag: null,
  };
}

/** 平民、商队等 */
export const SPEC_PEASANT: FigureSpec = { body: 0x8a7a5a, armor: 0, head: 'straw', weapon: 'pole' };
export const SPEC_MERCHANT: FigureSpec = { body: 0x5a4a7a, armor: 0, head: 'cap', weapon: 'none', robe: true };
