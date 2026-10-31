// 活世界 · 默认名册（服务端世界用）
// 游戏里由真实 NPC 名册接入；服务器后台在没有游戏客户端时也能自己养出一个世界。
import { SECT_SEEDS, makeName, placeName } from './content';
import { chance, mulberry32, pick, ri } from './rng';
import { addSoul, createWorld, seedSociety, type SoulSeed } from './world';
import type { AliveConfig, Soul, World } from './types';

export const REALM_NAMES = ['练气', '筑基', '结丹', '元婴', '化神', '炼虚'];

export const DEFAULT_REALMS = REALM_NAMES.map((name, i) => ({
  name, life: 90 + i * 220, stages: 4,
}));

const HOME_POOLS: Record<string, string[]> = {
  qingniu: ['青牛镇'], jiayuan: ['嘉元城'], yuejing: ['越京'], shuozhou: ['朔州城'],
  tianxing: ['天星城'], jinjing: ['晋京'], kuixing: ['魁星岛'], luanxing: ['乱星海'],
  yunmeng: ['云梦山脉'], taiyue: ['太岳山脉'], kunwu: ['昆吾山'], caoyuan: ['天澜草原'],
};

export function defaultCast(seed: number): SoulSeed[] {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const out: SoulSeed[] = [];
  const sects = SECT_SEEDS;
  let n = 0;
  const push = (s: SoulSeed) => { out.push(s); n++; };
  // 各门派一套名册（掌门 / 长老 / 弟子）
  for (const st of sects) {
    const count = st.demon ? ri(r, 5, 9) : ri(r, 6, 12);
    const home = pick(r, Object.keys(HOME_POOLS));
    for (let i = 0; i < count; i++) {
      const rank = i === 0 ? '掌门' : i < 3 ? '长老' : i < 5 ? '执事' : '内门';
      const realm = i === 0 ? ri(r, 3, 4) : i < 3 ? ri(r, 2, 4) : ri(r, 1, 3);
      push({
        id: `${st.id}_${i}`, sex: chance(r, 0.4) ? 'f' : 'm', realm,
        sectId: st.id, sectRank: rank, faction: st.demon ? 'demon' : 'sect',
        homeId: home, homeName: placeName(home), pers: pick(r, ['righteous', 'arrogant', 'cautious', 'ruthless', 'aloof', 'greedy', 'kind'] as Soul['pers'][]),
        age: 24 + realm * ri(r, 40, 90),
      });
    }
  }
  // 散修、商人、凡人
  for (let i = 0; i < 46; i++) {
    const home = pick(r, Object.keys(HOME_POOLS));
    const faction = chance(r, 0.18) ? 'merchant' : chance(r, 0.28) ? 'mortal' : 'rogue';
    push({
      id: `w_${i}`, sex: chance(r, 0.45) ? 'f' : 'm', realm: faction === 'mortal' ? 0 : ri(r, 0, 2),
      faction, homeId: home, homeName: placeName(home),
      pers: pick(r, ['kind', 'greedy', 'cautious', 'aloof', 'ruthless', 'righteous', 'arrogant'] as Soul['pers'][]),
      age: ri(r, 16, 78),
    });
  }
  // 部分原著风味人物
  const canon: [string, string, number, string][] = [
    ['modaifu', '墨大夫', 1, 'qingniu'], ['lifeiyu', '厉飞雨', 0, 'qingniu'],
    ['lihuayuan', '李化元', 3, 'yuejing'], ['linghu', '令狐老祖', 4, 'yuejing'],
    ['wangchan', '王蝉', 2, 'jiayuan'], ['yanruyan', '燕如嫣', 2, 'jiayuan'],
    ['nanlonghou', '南陇侯', 4, 'taiyue'], ['jiyin', '极阴老祖', 4, 'luanxing'],
  ];
  for (const [id, name, realm, home] of canon) {
    push({ id, name, realm, homeId: home, homeName: placeName(home), faction: 'rogue', age: 100 + realm * 160 });
  }
  // 补足名字
  out.forEach((s, i) => {
    if (s.name) return;
    // 每人一个独立的种子：一册人不能重名（重名会让家人、仇人都分不清谁是谁）
    const rr = mulberry32(seed + (i + 1) * 7919 + Math.floor(i / 3));
    s.name = makeName(rr, s.sex ?? 'm');
    void n;
  });
  return out;
}

export interface ServerWorldOptions { seed?: number; heroName?: string; cast?: boolean }

export function createServerWorld(opts: ServerWorldOptions = {}): World {
  const seed = opts.seed ?? 20260214;
  const cfg: AliveConfig = { seed, heroName: opts.heroName ?? '韩立', realms: { realms: DEFAULT_REALMS } };
  const w = createWorld(cfg);
  if (opts.cast !== false) {
    for (const s of defaultCast(seed)) addSoul(w, s);
    seedSociety(w, 16);
  }
  return w;
}

export { HOME_POOLS };
