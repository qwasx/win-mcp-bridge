// 第三十九步 · 混战
// 至宝出世、前线接战、血色禁地、虚天殿……人多的地方，从来不是所有人一齐围着你打。
// 这里集中放「造一个某门某派的修士」与「给一群人分派系」的小工具；
// 真正的敌我判定、索敌分流、NPC 互斗伤害都在 combat.ts（hostile / pickTank / npcHit）。
import type { Game } from './game';
import { Enemy } from './combat';
import { ENEMIES } from '../data/enemies';
import { REALMS } from '../data/realms';
import { randomLook } from '../gfx/character';
import { mulberry32, clamp } from '../core/rng';
import { SCHOOLS } from './schools';
import { SECT_DEF } from './roster';

let teamSeq = 0;
/** 新派系名（同一派系的人不互相打） */
export function newTeam(prefix: string) { return `${prefix}#${++teamSeq}`; }

/** 造一个修士：school = 门派 id（决定招式套路与正邪），realm 1‥5 */
export function cultivator(x: number, y: number, realm: number, stage: number, school: string, name: string, opt: { female?: boolean; seed?: number } = {}): Enemy {
  const r = clamp(Math.round(realm), 1, 5), st = clamp(Math.round(stage), 0, REALMS[r].hp.length - 1);
  const evil = !!SCHOOLS[school]?.evil;
  const def = evil ? (r >= 3 ? ENEMIES.jindan_mo : ENEMIES.moxiu) : r >= 2 ? ENEMIES.zhujixiu : ENEMIES.bandit;
  const e = new Enemy(def, x, y, r, st);
  const rnd = mulberry32(opt.seed ?? Math.floor(Math.random() * 1e9));
  const fem = opt.female ?? rnd() < 0.3;
  e.look = randomLook(rnd, fem ? 'female' : r >= 3 ? 'elder' : 'cultivator');
  const robe = (SECT_DEF.get(school) as any)?.robe;
  if (robe) (e.look as any).robe = robe;
  if (fem) (e.look as any).sex = 'f';
  e.school = school; e.name = name; e.hx = x; e.hy = y;
  return e;
}

/** 越国七派 / 天道盟弟子（正道，混战里常作你的同阵） */
export const YUE_SECTS = ['huangfeng', 'yanyue', 'qingxu', 'huadao', 'tianque', 'jujian', 'lingshou'];
export const sectName = (id: string) => SCHOOLS[id]?.name ?? SECT_DEF.get(id)?.name ?? '散修';

/** 在 (x,y) 一带放一群同阵修士（你这一边），返回人数 */
export function spawnAllies(g: Game, x: number, y: number, n: number, pickRealm: () => [number, number], schools: string[], tag?: string): Enemy[] {
  const out: Enemy[] = [], T = g.terrain;
  for (let i = 0; i < n; i++) {
    let px = x, py = y;
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, R = 140 + Math.random() * 220; px = x + Math.cos(a) * R; py = y + Math.sin(a) * R * 0.75; if (T.walkFactor(px, py) > 0) break; }
    const [r, s] = pickRealm(), sid = schools[Math.floor(Math.random() * schools.length)];
    const e = cultivator(px, py, r, s, sid, `${sectName(sid)}弟子`);
    if (tag) e.tag = tag;
    g.combat.addAlly(e);
    g.combat.vfx.push({ kind: 'blinkfx', x: px, y: py, r: 70, t: 0, dur: 0.5, color: '200,230,255' });
    out.push(e);
  }
  return out;
}
