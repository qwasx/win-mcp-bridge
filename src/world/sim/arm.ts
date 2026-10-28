// 第三阶段·活世界：NPC 化为敌人时，带上他自己的家当
// · 战力按储物袋里的本命法宝 / 功法 / 符箓折算（与世界模拟同一公式），分摊到攻击与气血
// · 招式里多一式「祭出·某某法宝」——打你时用的就是他身上那件
import type { Enemy } from '../combat';
import type { FoeSkill, El, SkKind } from '../foeskills';
import type { NpcData } from '../npc';
import { itemDef } from '../../data/items';
import { outfit, power } from './kit';

const EL: Record<string, El> = { fire: 'fire', ice: 'ice', thunder: 'thunder', gold: 'gold', wood: 'poison', water: 'water', earth: 'earth', yin: 'ghost', blood: 'blood' };

/** 法宝 → 一式招 */
export function artSkill(id: string): FoeSkill | null {
  const it = itemDef(id); if (!it?.art) return null;
  const a = it.art, t = it.tier, el: El = EL[a.element ?? ''] ?? (a.kind === 'sword' ? 'sword' : a.kind === 'needle' || a.kind === 'ring' ? 'metal' : 'gold');
  const base = { id: 'art_' + id, name: `祭出·${it.name}`, el, tele: 0.7, cd: Math.max(5, Math.min(11, a.cd * 1.6 + 4)), range: 560, pow: 1.5 + 0.18 * t } as FoeSkill;
  const k = a.kind;
  const sk = (o: Partial<FoeSkill> & { k: SkKind }) => ({ ...base, ...o }) as FoeSkill;
  switch (k) {
    case 'sword': case 'needle': case 'arrow': return sk({ k: 'salvo', n: k === 'needle' ? 5 : k === 'sword' ? 3 : 1, spread: k === 'needle' ? 0.5 : 0.25, waves: k === 'sword' ? 2 : 1, min: 80 });
    case 'ring': return sk({ k: 'ring', n: 10, waves: 1, range: 460 });
    case 'slam': case 'bell': case 'cauldron': return sk({ k: 'circle', r: 130 + t * 10, tele: 0.9, pow: base.pow + 0.5, status: k === 'bell' ? { k: 'stun', dur: 0.8, ch: 0.5 } : undefined });
    case 'mirror': case 'flame': return sk({ k: 'beam', len: 620, w: 60, dur: 0.4, min: 90 });
    case 'banner': return sk({ k: 'rain', n: 4, r: 95, tele: 1.0, el: el === 'gold' ? 'ghost' : el });
    case 'bind': return sk({ k: 'circle', r: 110, pow: 0.9, status: { k: 'root', dur: 1.4, ch: 0.8 } });
    case 'shield': case 'armor': return sk({ k: 'guard', dur: 4, tele: 0.3, cd: 14, range: 700 });
    default: return null;
  }
}

/** 按储物袋武装敌人：e.kit 已由 kitOf 生成，再加一式法宝招；攻守按家当折算 */
export function armEnemy(e: Enemy, d: NpcData, kit: FoeSkill[]) {
  if (d.realm <= 0) return;
  outfit(d);
  const full = power({ realm: d.realm, stage: d.stage, gongfa: d.gongfa, bag: d.bag!, main: d.main });
  const bare = power({ realm: d.realm, stage: d.stage, gongfa: 'generic', bag: [] });
  const k = Math.max(0.85, Math.min(2.4, full / Math.max(1, bare)));
  const s = Math.sqrt(k);
  e.atk *= s; e.maxHp = Math.round(e.maxHp * s); e.hp = Math.round(e.hp * s);
  if (d.main) { const sk = artSkill(d.main); if (sk && !kit.some((x) => x.id === sk.id)) kit.push(sk); (e as any).mainArt = d.main; }
}
