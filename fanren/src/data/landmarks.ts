// 第十九步：原著名地的地貌（纯几何数据，供地形装饰、渲染与玩法共用）
// 坐标：以所在地点中心为原点的世界像素偏移，加载时换算成当前地图的绝对坐标。
import { locHere, WORLD_SCALE, ACTIVE_MAP } from './world';
import type { MtnStyle } from '../gfx/mountain';
import type { Species } from '../gfx/tree';

/** 地面贴花（画在草之后、排序物之前） */
export type GroundKind = 'ash' | 'lavafield' | 'lavalake' | 'bloodpool' | 'flowers' | 'jadeplaza' | 'icepath' | 'lavapath' | 'ghostland' | 'blackpond' | 'pit' | 'taiji' | 'scree';
/** 立体构件（参与前后排序） */
export type StandKind = 'stoneplat' | 'remains' | 'bloodgate' | 'altar' | 'ruinhall' | 'wall' | 'pagoda' | 'cave' | 'gate' | 'invtower' | 'corpsepost' | 'crystal' | 'obelisk' | 'whirl' | 'bigtree' | 'sprite';

export interface LmGround { k: GroundKind; x: number; y: number; w: number; h: number; seed: number; rot?: number }
export interface LmStand { k: StandKind; x: number; y: number; w: number; h: number; seed: number; id: string; a0?: number; a1?: number; flip?: boolean; name?: string; tex?: string; sc?: number }
export interface LmPeak { id: string; x: number; y: number; w: number; h: number; style: MtnStyle; seed: number; snow?: boolean; clouds?: boolean; waterfall?: boolean; flip?: boolean }
export interface LmLair { id: string; enemy: string; x: number; y: number; name: string; desc: string }
export type MistKind = 'white' | 'yin' | 'ring' | null;

export interface Landmark {
  id: string; name: string; x: number; y: number; r: number;
  ground: LmGround[]; stands: LmStand[]; peaks: LmPeak[]; lairs: LmLair[];
  /** 普通山、树被清空的圆（x, y, 半径） */
  clear: [number, number, number][];
  mist: MistKind; mistR?: number; mistW?: number;
  /** 神识压制：雾最浓处的倍率 */
  senseK: number;
  /** 区内树种替换与密度 */
  trees?: Species[]; treeK?: number;
  /** 区内普通山的山形 */
  mtnStyle?: MtnStyle;
  natives: string[];
  rifts?: number;
  enter: string;
}

let SEED = 9100;
const sd = () => (SEED = (SEED * 16807) % 2147483647);

function build(): Landmark[] {
  const out: Landmark[] = [];
  const at = (loc: string) => { const l = locHere(loc); return l ? [l.x * WORLD_SCALE, l.y * WORLD_SCALE] as const : null; };
  const mk = (id: string, loc: string, name: string, r: number, f: (L: Landmark, cx: number, cy: number) => void, base: Partial<Landmark>) => {
    const c = at(loc); if (!c) return;
    const L: Landmark = { id, name, x: c[0], y: c[1], r, ground: [], stands: [], peaks: [], lairs: [], clear: [], mist: null, senseK: 1, natives: [], enter: '', ...base };
    f(L, c[0], c[1]);
    out.push(L);
  };
  const G = (L: Landmark, k: GroundKind, dx: number, dy: number, w: number, h: number, rot = 0) => L.ground.push({ k, x: L.x + dx, y: L.y + dy, w, h, seed: sd(), rot });
  const S = (L: Landmark, k: StandKind, dx: number, dy: number, w: number, h: number, extra: Partial<LmStand> = {}) => L.stands.push({ k, x: L.x + dx, y: L.y + dy, w, h, seed: sd(), id: `${L.id}_${k}_${L.stands.length}`, ...extra });
  const P = (L: Landmark, dx: number, dy: number, w: number, h: number, style: MtnStyle, extra: Partial<LmPeak> = {}) => L.peaks.push({ id: `${L.id}_pk${L.peaks.length}`, x: L.x + dx, y: L.y + dy, w, h, style, seed: sd(), ...extra });
  const C = (L: Landmark, dx: number, dy: number, r: number) => L.clear.push([L.x + dx, L.y + dy, r]);

  // ====================== 坠魔谷 ======================
  mk('zhuimo', 'zhuimo', '坠魔谷', 5600, (L) => {
    // 火蟾兽巢穴：赤红山岭环抱，熔岩裂缝喷吐热风灰烬，熔岩湖中有一座古老石台
    G(L, 'ash', 2300, -1350, 4600, 2900);
    G(L, 'lavafield', 2300, -1450, 2700, 1700);
    G(L, 'lavalake', 2400, -1450, 1150, 620);
    S(L, 'stoneplat', 2400, -1440, 230, 120, { name: '古石台', tex: 'p_e_altar_broken', sc: 0.7 });
    C(L, 2300, -1450, 1650);
    for (const [dx, dy, w, h] of [[900, -2850, 1300, 950], [2250, -3050, 1700, 1250], [3750, -2700, 1400, 1050], [4250, -1500, 1150, 900], [500, -2100, 900, 650], [3900, -350, 1000, 700]] as const) P(L, dx, dy, w, h, 'volcano', { clouds: false });
    // 白石祭坛（古魔血焰）
    G(L, 'scree', -650, -1520, 1300, 700);
    S(L, 'altar', -650, -1500, 560, 640, { name: '白石祭坛' });
    C(L, -650, -1600, 780);
    S(L, 'sprite', -1180, -1230, 100, 260, { tex: 'p_e_pillar_b' }); S(L, 'sprite', -120, -1180, 380, 100, { tex: 'p_e_pillar_c', flip: true });
    // 谷口残碑
    S(L, 'sprite', 350, 2950, 145, 300, { tex: 'p_e_valley_stele' });
    L.lairs.push({ id: 'lm_xueyan', enemy: 'gumo_xueyan', x: L.x - 650, y: L.y - 1360, name: '白石祭坛', desc: '祭坛上血光隐现，似有上古魔物的一缕分魂被镇压于此——那是「古魔血焰」。' });
    // 内谷水潭与血咒之门
    G(L, 'bloodpool', -1750, 1150, 1100, 600);
    S(L, 'bloodgate', -1750, 830, 300, 330, { name: '血咒之门' });
    C(L, -1750, 1000, 760);
    // 古修遗骸（联动禁制）
    for (const [dx, dy] of [[650, 450], [-2450, -350], [1250, 1850], [-450, 2450], [3050, 1250], [-3100, 2050]] as const) S(L, 'remains', dx, dy, 120, 60, { name: '古修遗骸', tex: 'p_skeleton', flip: dx < 0 });
  }, {
    mist: 'white', senseK: 0.55, trees: ['dead', 'dead', 'pine', 'cypress'], treeK: 0.55, mtnStyle: 'demon',
    natives: ['huochan', 'mangshou', 'canhun', 'tiehuo', 'yinhun'], rifts: 7,
    enter: '踏入坠魔谷——乳白色的迷雾自四面八方涌来，神识像陷进了泥沼，只能探出平日的几成。小心那些若隐若现的空间裂缝。',
  });

  // ====================== 血色禁地 ======================
  mk('xuese', 'xuese', '血色禁地', 4700, (L) => {
    // 中心：密林与百丈宝塔（地点本身），外一圈迷雾环形山
    const ring = 1550;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
      if (Math.cos(a - Math.PI / 2) > 0.8) continue;           // 南面留出山口
      const w = 900 + ((i * 37) % 5) * 70, h = 650 + ((i * 53) % 4) * 90;
      P(L, Math.cos(a) * ring, Math.sin(a) * ring * 0.78, w, h, 'qinglv', { clouds: true, flip: i % 2 === 0 });
    }
    S(L, 'cave', 980, -1180, 300, 190, { name: '墨蛟洞' });
    L.lairs.push({ id: 'lm_mojiao', enemy: 'mojiao', x: L.x + 980, y: L.y - 1020, name: '墨蛟洞', desc: '洞中腥风扑面，一条黑鳞巨蟒蜕变而成的墨蛟盘踞于此，口吐腐水紫毒。' });
    // 仙境花圃：一圈奇花异草
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      G(L, 'flowers', Math.cos(a) * 2300, Math.sin(a) * 2300 * 0.78, 1300, 780);
    }
    // 石墙一周（有缺口）
    const wr = 3050, segs = 30;
    for (let i = 0; i < segs; i++) {
      if (i % 6 === 5) continue;
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 0.92) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      S(L, 'wall', Math.cos(am) * wr, Math.sin(am) * wr * 0.78, 0, 0, { a0, a1, name: '' });
    }
    // 外圈：峭壁、石屋石殿
    for (const [dx, dy, fl] of [[-3700, -900, false], [3800, 600, true], [-2900, 2600, false], [2600, -3000, true], [600, 3600, false]] as const) S(L, 'ruinhall', dx, dy, 330, 260, { flip: fl, name: '上古石殿' });
    // 禁地外缘：入口双石柱、上古盘龙柱
    S(L, 'sprite', 0, 3950, 520, 480, { tex: 'p_e_gatepillar' });
    S(L, 'sprite', -3350, 1250, 120, 380, { tex: 'p_e_pillar_a' }); S(L, 'sprite', 3250, -1500, 120, 380, { tex: 'p_e_pillar_a', flip: true }); S(L, 'sprite', -1500, 3550, 380, 100, { tex: 'p_e_pillar_c' });
    // 乌龙潭（东北角）
    G(L, 'blackpond', 3700, -2750, 1100, 640);
    S(L, 'whirl', 3700, -2740, 200, 90, { name: '乌龙潭' });
    C(L, 3700, -2750, 700);
  }, {
    mist: 'ring', mistR: 1550, mistW: 650, senseK: 0.6, trees: ['broad', 'pine', 'bamboo', 'broad'], treeK: 1.2,
    natives: ['heilin', 'spider', 'greensnake', 'shuangtong', 'bandit'],
    enter: '血色禁地——古禁的狂风在身后合拢。前方是峭壁石殿，再往里是一道古老的石墙，传说墙后奇花遍地，雾中环山里盘着墨蛟。',
  });

  // ====================== 虚天殿 ======================
  mk('xutian', 'xutian', '虚天殿', 3300, (L) => {
    C(L, 0, 0, 2300);
    // 鬼冤之地（入口）
    G(L, 'ghostland', 0, 1550, 1900, 900);
    // 冰火道：左玄晶道，右熔岩路
    G(L, 'icepath', -300, 650, 380, 1150);
    G(L, 'lavapath', 300, 650, 380, 1150);
    for (let i = 0; i < 6; i++) { const x = i % 2 ? 560 : -560; S(L, 'crystal', x, 160 + i * 190, 70 + (i % 3) * 20, 120 + (i % 3) * 40, { name: '', tex: x < 0 ? 'p_crystal_l' : 'p_crystal_blood', sc: 0.8 + (i % 3) * 0.15, flip: i % 4 === 0 }); }
    S(L, 'obelisk', -620, 1080, 60, 200, { name: '玄晶碑', tex: 'p_e_pillar_a', sc: 0.7 }); S(L, 'obelisk', 620, 1080, 60, 200, { name: '熔岩碑', tex: 'p_e_pillar_a', sc: 0.7, flip: true });
    // 冰火道尽头：内殿三层青白玉圆台
    S(L, 'sprite', 0, -260, 720, 450, { tex: 'p_e_xt_hall' });
  }, {
    mist: null, senseK: 1, trees: ['cypress', 'pine'], treeK: 0.4, mtnStyle: 'qianjiang',
    natives: ['yuanhun', 'yinhun', 'guijiang'],
    enter: '虚天殿——巨大的天罡光罩倒扣在海岛上。入口处阴风惨惨，是吞噬过无数修士的「鬼冤之地」；再往里，一冰一火两条古道直通大殿。',
  });

  // ====================== 昆吾山 ======================
  mk('kunwu', 'kunwu', '昆吾山', 4300, (L) => {
    C(L, -200, 300, 2300);
    G(L, 'jadeplaza', 0, 560, 2300, 1300);
    S(L, 'gate', 0, 1290, 560, 380, { name: '万修之门' });
    G(L, 'pit', 0, -1480, 900, 420);
    S(L, 'invtower', 0, -1480, 300, 900, { name: '镇魔塔' });
    L.lairs.push({ id: 'lm_yinchi', enemy: 'yinchi', x: L.x + 260, y: L.y - 1300, name: '镇魔塔', desc: '倒悬的镇魔塔下煞气冲霄，绿毛银翅的夜叉在塔影里盘旋——塔中镇着元刹圣祖的魔魂。' });
    // 镇魔碑、剑亭、镇魔锁柱
    S(L, 'sprite', -560, 960, 169, 340, { tex: 'p_e_kunwu_stele' }); S(L, 'sprite', 560, 960, 169, 340, { tex: 'p_e_kunwu_stele', flip: true });
    S(L, 'sprite', 1300, 240, 420, 395, { tex: 'p_e_swordpav' });
    S(L, 'sprite', -760, -1250, 445, 380, { tex: 'p_e_sealchain', sc: 0.8 }); S(L, 'sprite', 760, -1250, 445, 380, { tex: 'p_e_sealchain', sc: 0.8, flip: true });
    for (let i = 0; i < 6; i++) S(L, 'corpsepost', -1350 - (i >> 1) * 380, 300 + (i % 2 ? 260 : -260) + (i >> 1) * 60, 60, 210, { name: '锁尸柱' });
  }, {
    mist: null, senseK: 1, trees: ['cypress', 'dead', 'pine'], treeK: 0.5,
    natives: ['shilang', 'lianshi', 'shixiong', 'shiqin'],
    enter: '昆吾山——穿过高耸的「万修之门」，是一片空旷的白玉广场。北面，一座宝塔竟倒悬于深坑之上，铁链横空，煞气森森。',
  });

  // ====================== 阴阳窟 ======================
  mk('yinyang', 'yinyang', '阴阳窟', 2800, (L) => {
    G(L, 'taiji', 0, 380, 1500, 820);
    C(L, 0, 300, 900);
  }, {
    mist: 'yin', senseK: 0.7, trees: ['dead', 'cypress'], treeK: 0.4, mtnStyle: 'demon',
    natives: ['yinsha', 'yinhun', 'guijiang'],
    enter: '阴阳窟——洞口终年刮着刺骨阴风，吹得人法力流散。据说阴风每二十年才弱一次，那时窟中常有鬼物涌出。',
  });
  return out;
}

export const LANDMARKS: Landmark[] = build();

// ====================== 名山、瀑布、花林（风景） ======================
export interface NamedPeak extends LmPeak { name: string }
export interface FallSpot { id: string; x: number; y: number; w: number; h: number; seed: number; tiers: number; name?: string }
export interface GroveSpot { x: number; y: number; r: number; sp: Species; seed: number; name?: string }

function buildScenic() {
  const peaks: NamedPeak[] = [], falls: FallSpot[] = [], groves: GroveSpot[] = [];
  const at = (loc: string) => { const l = locHere(loc); return l ? [l.x * WORLD_SCALE, l.y * WORLD_SCALE] as const : null; };
  const pk = (loc: string, name: string, dx: number, dy: number, w: number, h: number, style: MtnStyle, extra: Partial<NamedPeak> = {}) => {
    const c = at(loc); if (!c) return;
    peaks.push({ id: `np_${loc}_${peaks.length}`, name, x: c[0] + dx, y: c[1] + dy, w, h, style, seed: sd(), ...extra });
  };
  const fall = (loc: string, dx: number, dy: number, w: number, h: number, tiers: number, name?: string) => { const c = at(loc); if (c) falls.push({ id: `wf_${loc}_${falls.length}`, x: c[0] + dx, y: c[1] + dy, w, h, seed: sd(), tiers, name }); };
  const grove = (loc: string, dx: number, dy: number, r: number, sp: Species, name?: string) => { const c = at(loc); if (c) groves.push({ x: c[0] + dx, y: c[1] + dy, r, sp, seed: sd(), name }); };
  if (ACTIVE_MAP === 'tiannan') {
    // 彩霞山（七玄门所在）：丹霞赤壁，层层彩带
    pk('qixuan', '彩霞山', -1550, -1650, 1350, 950, 'danxia');
    pk('qixuan', '', 250, -2200, 1700, 1150, 'danxia', { clouds: true });
    pk('qixuan', '', 1750, -1500, 1200, 820, 'danxia', { flip: true });
    pk('qixuan', '', -2700, -700, 1000, 660, 'danxia');
    // 太岳山脉：雪顶巨峰
    pk('taiyue', '太岳山脉', -2500, -1900, 2100, 1900, 'qinglv', { snow: true, clouds: true, waterfall: true });
    pk('taiyue', '', -2900, 700, 1800, 1500, 'qinglv', { snow: true, clouds: true, flip: true });
    // 天柱山：一柱擎天的孤峰
    pk('luoyun', '天柱山', 3700, 2900, 760, 2700, 'spire', { clouds: true });
    pk('luoyun', '', 3200, 3050, 700, 520, 'karst');
    pk('luoyun', '', 4300, 3100, 640, 480, 'karst', { flip: true });
    // 云梦山（落云宗）：云雾缭绕的群峰，灵眼之树
    pk('luoyun', '云梦山', -1900, -1800, 1500, 1350, 'karst', { clouds: true });
    pk('luoyun', '', -350, -2350, 1700, 1550, 'qinglv', { clouds: true, waterfall: true });
    pk('luoyun', '', 1500, -1900, 1300, 1150, 'karst', { clouds: true, flip: true });
    // 瀑布
    fall('huangfeng', -1550, 950, 520, 560, 2, '');
    fall('luoyun', -2450, 650, 600, 680, 3, '云梦飞瀑');
    fall('qixuan', 1300, -2650, 460, 420, 1);
    fall('taiyue', -1500, -700, 640, 760, 3);
    fall('huangfeng', -2300, -2600, 480, 520, 2);
    // 花林
    grove('luoyun', 1700, 1250, 620, 'peach', '灵药园桃林');
    grove('qixuan', -900, 1200, 520, 'peach');
    grove('huangfeng', 1400, 1500, 560, 'apricot');
    grove('yuejing', 1500, -1200, 600, 'apricot');
    grove('jiayuan', -1300, 900, 480, 'peach');
  } else if (ACTIVE_MAP === 'luanxing') {
    // 魁星岛青云山：三座巨峰
    pk('kuixing', '青云山', -1350, -950, 1300, 2000, 'karst', { clouds: true });
    pk('kuixing', '', 1350, -750, 1200, 1800, 'karst', { clouds: true, flip: true });
    pk('kuixing', '', 0, -3050, 1500, 2300, 'karst', { clouds: true, waterfall: true });
    fall('kuixing', 750, -2050, 460, 600, 2, '青云瀑');
    grove('miaoyin', 900, 500, 520, 'peach', '妙音桃林');
    grove('tianxing', -1800, 1300, 520, 'apricot');
  } else if (ACTIVE_MAP === 'dajin') {
    fall('kunwu', -2000, -1300, 560, 700, 3, '昆吾飞瀑');
    fall('jinjing', 2300, -2400, 500, 560, 2);
    grove('jinjing', -1600, 1500, 620, 'apricot', '晋京杏林');
    grove('yunzhou', 1300, 1100, 520, 'peach');
    grove('youzhou', -1200, 1000, 480, 'plum', '幽州梅林');
  }
  return { peaks, falls, groves };
}
export const SCENIC = buildScenic();

// ====================== 查询 ======================
export function landmarkAt(x: number, y: number, pad = 0): Landmark | null {
  for (const L of LANDMARKS) { const dx = x - L.x, dy = y - L.y; if (dx * dx + dy * dy < (L.r + pad) * (L.r + pad)) return L; }
  return null;
}
/** 雾的浓度 0–1 */
export function mistDepth(L: Landmark, x: number, y: number): number {
  const d = Math.hypot(x - L.x, (y - L.y) * 1.15);
  if (L.mist === 'ring') { const w = L.mistW ?? 600; const k = 1 - Math.abs(d - (L.mistR ?? 1500)) / w; return k <= 0 ? 0 : k * k * (3 - 2 * k); }
  if (!L.mist) return 0;
  const k = Math.min(1, Math.max(0, (L.r - d) / (L.r * 0.45)));
  return k * k * (3 - 2 * k);
}
/** 是否在清场圆内（普通山、树不生） */
export function lmCleared(x: number, y: number, pad = 0): boolean {
  for (const L of LANDMARKS) {
    if (Math.abs(x - L.x) > L.r + 3000 || Math.abs(y - L.y) > L.r + 3000) continue;
    for (const [cx, cy, r] of L.clear) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy < (r + pad) * (r + pad)) return true; }
    for (const p of L.peaks) if (Math.abs(x - p.x) < p.w * 0.5 + pad && y < p.y + 200 && y > p.y - p.h * 0.6 - pad) return true;
    for (const s of L.stands) if (s.k !== 'wall' && s.k !== 'remains' && Math.hypot(x - s.x, y - s.y) < Math.max(s.w, 140) * 0.8 + pad) return true;
  }
  for (const p of SCENIC.peaks) if (Math.abs(x - p.x) < p.w * 0.55 + pad && y < p.y + 250 && y > p.y - p.h * 0.5 - pad) return true;
  for (const f of SCENIC.falls) if (Math.abs(x - f.x) < f.w * 0.75 + pad && y < f.y + f.w * 0.6 && y > f.y - f.h * 0.6 - pad) return true;
  return false;
}
export function groveAt(x: number, y: number, pad = 0): GroveSpot | null {
  for (const g of SCENIC.groves) { const dx = x - g.x, dy = (y - g.y) / 0.75; if (dx * dx + dy * dy < (g.r + pad) * (g.r + pad)) return g; }
  return null;
}
/** 硬地贴花（熔岩、水潭、玉砖、冰火道）上不长草 */
const NOGRASS = new Set<GroundKind>(['lavafield', 'lavalake', 'bloodpool', 'blackpond', 'pit', 'jadeplaza', 'icepath', 'lavapath', 'ghostland', 'scree']);
export function lmNoGrass(x: number, y: number): boolean {
  for (const L of LANDMARKS) {
    if (Math.abs(x - L.x) > L.r || Math.abs(y - L.y) > L.r) continue;
    for (const g of L.ground) {
      if (!NOGRASS.has(g.k)) continue;
      const dx = (x - g.x) / (g.w * 0.5), dy = (y - g.y) / (g.h * 0.5);
      if (g.k === 'jadeplaza' || g.k === 'icepath' || g.k === 'lavapath' ? Math.abs(dx) < 1 && Math.abs(dy) < 1 : dx * dx + dy * dy < 1) return true;
    }
  }
  return false;
}
