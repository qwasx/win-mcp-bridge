// 敌人：妖兽、鬼物、劫修。按区域、危险度出没
import type { BeastLook } from '../gfx/beast';
import type { Fx, StatusSpec } from './arts';

export interface EnemyAtk { fx: Fx; color: string; range: number; power: number; cd: number; speed?: number; status?: StatusSpec; radius?: number; count?: number }
export interface EnemyDef {
  id: string; name: string;
  kind: 'beast' | 'ghost' | 'human' | 'insect';
  look?: BeastLook;            // 人形敌人用角色系统绘制
  robe?: string;               // 人形：道袍色
  minDanger: number; maxDanger: number;
  regions?: string[];          // 区域 id（不填则通用）
  zone?: 'cold' | 'arid' | 'sea' | 'forest' | 'demon' | 'grass';
  hp: number; atk: number; def: number; speed: number;
  melee?: { range: number; power: number; cd: number; status?: StatusSpec };
  ranged?: EnemyAtk;
  evil?: boolean;              // 魔物/鬼物（辟邪神雷克制）
  pack?: [number, number];     // 成群数量
  drops: { id: string; ch: number; n?: [number, number] }[];
  title?: string;              // 称谓
  flying?: boolean;
  aggro?: number;              // 察觉距离
}

const E: EnemyDef[] = [
  // ---- 炼气级 ----
  { id: 'wolf', name: '灰背狼', kind: 'beast', look: { body: 'wolf', color: [120, 116, 104], belly: [200, 190, 170], size: 1 }, minDanger: 0, maxDanger: 2, hp: 0.55, atk: 0.6, def: 0.6, speed: 150, melee: { range: 60, power: 1, cd: 1.2 }, pack: [1, 3], drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'mat_lingshi', ch: 0.6, n: [1, 4] }] },
  { id: 'redwolf', name: '赤目妖狼', kind: 'beast', look: { body: 'wolf', color: [130, 70, 50], belly: [210, 170, 130], size: 1.15, eye: 'rgba(255,40,30,0.95)' }, minDanger: 1, maxDanger: 3, zone: 'grass', hp: 0.7, atk: 0.75, def: 0.7, speed: 170, melee: { range: 64, power: 1.1, cd: 1.1, status: { k: 'break', dur: 3, ch: 0.2 } }, pack: [2, 4], drops: [{ id: 'mat_yaodan1', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.6, n: [2, 6] }] },
  { id: 'boar', name: '獠牙野猪', kind: 'beast', look: { body: 'boar', color: [92, 72, 58], belly: [150, 120, 96], size: 1.05 }, minDanger: 0, maxDanger: 2, zone: 'forest', hp: 0.8, atk: 0.7, def: 0.9, speed: 130, melee: { range: 64, power: 1.4, cd: 1.6, status: { k: 'knock', dur: 0.3, ch: 0.5 } }, drops: [{ id: 'mat_yaodan1', ch: 0.4 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 5] }] },
  { id: 'greensnake', name: '青鳞蛇', kind: 'beast', look: { body: 'snake', color: [70, 120, 70], belly: [200, 210, 150], size: 0.9 }, minDanger: 0, maxDanger: 2, zone: 'forest', hp: 0.45, atk: 0.7, def: 0.5, speed: 120, melee: { range: 70, power: 0.9, cd: 1.1, status: { k: 'poison', dur: 4, ch: 0.5 } }, drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'herb_jinxin', ch: 0.15 }] },
  { id: 'spider', name: '黑纹毒蛛', kind: 'insect', look: { body: 'spider', color: [52, 46, 44], accent: [200, 60, 40], size: 0.9 }, minDanger: 1, maxDanger: 3, hp: 0.5, atk: 0.75, def: 0.6, speed: 140, melee: { range: 56, power: 0.9, cd: 1.0, status: { k: 'poison', dur: 5, ch: 0.6 } }, ranged: { fx: 'vine', color: '230,230,230', range: 380, power: 0.5, cd: 4, speed: 500, status: { k: 'root', dur: 1.2, ch: 0.8 } }, pack: [1, 3], drops: [{ id: 'mat_yaodan1', ch: 0.4 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 4] }] },
  { id: 'hawk', name: '黑风鹰', kind: 'beast', look: { body: 'eagle', color: [60, 56, 52], belly: [230, 220, 200], size: 0.9 }, minDanger: 0, maxDanger: 3, flying: true, hp: 0.45, atk: 0.75, def: 0.4, speed: 200, melee: { range: 60, power: 1, cd: 1.3 }, drops: [{ id: 'mat_yaodan1', ch: 0.35 }, { id: 'mat_lingshi', ch: 0.5, n: [1, 4] }] },
  { id: 'fox', name: '幻狐', kind: 'beast', look: { body: 'fox', color: [210, 150, 90], belly: [250, 240, 220], size: 0.9, tails: 2, glow: '255,200,150' }, minDanger: 1, maxDanger: 3, hp: 0.5, atk: 0.7, def: 0.5, speed: 180, ranged: { fx: 'fireball', color: '170,140,255', range: 420, power: 0.9, cd: 2.2, speed: 520, status: { k: 'stun', dur: 0.6, ch: 0.2 } }, drops: [{ id: 'mat_yaodan1', ch: 0.6 }, { id: 'mat_lingshi', ch: 0.6, n: [2, 6] }] },
  { id: 'bandit', name: '劫修', kind: 'human', robe: '#4a4a52', title: '散修', minDanger: 0, maxDanger: 3, hp: 0.7, atk: 0.8, def: 0.7, speed: 140, ranged: { fx: 'fireball', color: '255,130,60', range: 520, power: 1, cd: 1.8, speed: 640, status: { k: 'burn', dur: 3, ch: 0.2 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [6, 30] }, { id: 'pill_huiqi', ch: 0.25 }, { id: 'tal_fire', ch: 0.3 }, { id: 'art_qingfeng', ch: 0.06 }] },
  // ---- 区域特有 ----
  { id: 'snowwolf', name: '雪原冰狼', kind: 'beast', look: { body: 'wolf', color: [220, 226, 232], belly: [250, 250, 255], size: 1.2, eye: 'rgba(80,180,255,0.95)', glow: '180,220,255' }, minDanger: 1, maxDanger: 5, zone: 'cold', hp: 0.75, atk: 0.8, def: 0.8, speed: 170, melee: { range: 64, power: 1.1, cd: 1.1, status: { k: 'slow', dur: 2, ch: 0.5 } }, pack: [2, 4], drops: [{ id: 'mat_yaodan3', ch: 0.3 }, { id: 'herb_xuelian', ch: 0.15 }] },
  { id: 'icebear', name: '玄冰熊', kind: 'beast', look: { body: 'bear', color: [200, 214, 226], belly: [240, 245, 250], size: 1.35, eye: 'rgba(80,180,255,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'cold', hp: 1.5, atk: 1, def: 1.2, speed: 110, melee: { range: 80, power: 1.6, cd: 1.8, status: { k: 'freeze', dur: 1, ch: 0.3 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'herb_bingpo', ch: 0.2 }] },
  { id: 'sandscorp', name: '沙蝎', kind: 'insect', look: { body: 'scorpion', color: [190, 150, 90], accent: [160, 40, 30], size: 1.2 }, minDanger: 1, maxDanger: 5, zone: 'arid', hp: 0.8, atk: 0.85, def: 1.1, speed: 130, melee: { range: 70, power: 1.2, cd: 1.3, status: { k: 'poison', dur: 5, ch: 0.6 } }, pack: [1, 3], drops: [{ id: 'mat_yaodan3', ch: 0.3 }, { id: 'mat_lingshi', ch: 0.6, n: [3, 10] }] },
  { id: 'steppewolf', name: '草原妖狼', kind: 'beast', look: { body: 'wolf', color: [150, 130, 90], belly: [220, 200, 160], size: 1.1 }, minDanger: 1, maxDanger: 4, regions: ['tianlan'], hp: 0.65, atk: 0.75, def: 0.7, speed: 175, melee: { range: 64, power: 1, cd: 1.1 }, pack: [3, 5], drops: [{ id: 'mat_yaodan1', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.5, n: [2, 6] }] },
  { id: 'seaturtle', name: '铁甲海龟', kind: 'beast', look: { body: 'turtle', color: [90, 120, 110], accent: [70, 90, 70], size: 1.3 }, minDanger: 1, maxDanger: 5, zone: 'sea', hp: 1.6, atk: 0.6, def: 1.6, speed: 90, ranged: { fx: 'water', color: '120,180,240', range: 460, power: 0.9, cd: 3, speed: 420, status: { k: 'slow', dur: 2, ch: 0.5 } }, drops: [{ id: 'mat_yaodan3', ch: 0.5 }, { id: 'mat_lingshi', ch: 0.6, n: [5, 15] }] },
  { id: 'seaserpent', name: '墨蛟', kind: 'beast', look: { body: 'jiao', color: [50, 64, 80], belly: [150, 170, 180], accent: [220, 200, 150], size: 1.2, eye: 'rgba(255,220,60,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'sea', hp: 1.3, atk: 1.05, def: 1, speed: 160, melee: { range: 90, power: 1.4, cd: 1.5 }, ranged: { fx: 'water', color: '90,140,200', range: 520, power: 1.2, cd: 3.5, speed: 460, status: { k: 'knock', dur: 0.3, ch: 0.5 } }, drops: [{ id: 'mat_yaodan5', ch: 0.3 }, { id: 'mat_yaodan3', ch: 0.6 }] },
  { id: 'yinhun', name: '阴魂', kind: 'ghost', look: { body: 'ghost', color: [150, 200, 190], size: 1 }, minDanger: 1, maxDanger: 4, zone: 'demon', evil: true, hp: 0.5, atk: 0.8, def: 0.4, speed: 120, flying: true, melee: { range: 60, power: 0.9, cd: 1.2, status: { k: 'slow', dur: 2, ch: 0.4 } }, ranged: { fx: 'ghost', color: '140,220,200', range: 420, power: 0.8, cd: 2.6, speed: 380, status: { k: 'poison', dur: 4, ch: 0.4 } }, pack: [1, 4], drops: [{ id: 'mat_lingshi', ch: 0.4, n: [2, 6] }] },
  { id: 'moxiu', name: '魔道弟子', kind: 'human', robe: '#5a1a22', title: '魔修', minDanger: 1, maxDanger: 4, zone: 'demon', evil: true, hp: 0.8, atk: 0.9, def: 0.8, speed: 150, ranged: { fx: 'blood', color: '220,40,60', range: 540, power: 1.1, cd: 1.8, speed: 600, status: { k: 'break', dur: 3, ch: 0.3 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [10, 40] }, { id: 'pill_huiqi', ch: 0.3 }, { id: 'tal_ice', ch: 0.2 }] },
  // ---- 筑基级 ----
  { id: 'firetiger', name: '赤焰虎', kind: 'beast', look: { body: 'tiger', color: [200, 110, 50], belly: [240, 220, 180], size: 1.3, stripes: true, eye: 'rgba(255,200,60,0.95)', glow: '255,140,60' }, minDanger: 2, maxDanger: 5, hp: 1.2, atk: 1.05, def: 1, speed: 170, melee: { range: 76, power: 1.4, cd: 1.3, status: { k: 'burn', dur: 3, ch: 0.4 } }, ranged: { fx: 'fireball', color: '255,120,50', range: 460, power: 1.2, cd: 3.2, speed: 600, status: { k: 'burn', dur: 3, ch: 0.5 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'herb_huolong', ch: 0.1 }] },
  { id: 'python', name: '双角巨蟒', kind: 'beast', look: { body: 'snake', color: [90, 80, 50], belly: [210, 190, 130], size: 1.5, horn: true, accent: [220, 200, 160] }, minDanger: 2, maxDanger: 5, zone: 'forest', hp: 1.5, atk: 1, def: 1.1, speed: 120, melee: { range: 96, power: 1.5, cd: 1.6, status: { k: 'root', dur: 1.2, ch: 0.4 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'mat_lingshi', ch: 0.6, n: [10, 30] }] },
  { id: 'ironape', name: '铁背妖猿', kind: 'beast', look: { body: 'ape', color: [90, 80, 74], belly: [160, 140, 120], size: 1.3, eye: 'rgba(255,170,40,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'forest', hp: 1.4, atk: 1.1, def: 1.2, speed: 150, melee: { range: 80, power: 1.6, cd: 1.5, status: { k: 'stun', dur: 0.6, ch: 0.3 } }, drops: [{ id: 'mat_yaodan3', ch: 0.6 }, { id: 'mat_xuantie', ch: 0.2 }] },
  { id: 'facespider', name: '人面蜘蛛', kind: 'insect', look: { body: 'spider', color: [110, 60, 70], accent: [240, 220, 200], size: 1.4, eye: 'rgba(255,220,220,0.95)' }, minDanger: 3, maxDanger: 5, evil: true, hp: 1.1, atk: 1.05, def: 1, speed: 140, melee: { range: 66, power: 1.2, cd: 1.1, status: { k: 'poison', dur: 6, ch: 0.6 } }, ranged: { fx: 'vine', color: '240,240,240', range: 460, power: 0.6, cd: 3.5, speed: 520, status: { k: 'root', dur: 1.6, ch: 0.9 } }, drops: [{ id: 'mat_yaodan3', ch: 0.7 }] },
  { id: 'centipede', name: '金背蜈蚣', kind: 'insect', look: { body: 'centipede', color: [160, 120, 40], accent: [200, 60, 40], size: 1.2 }, minDanger: 2, maxDanger: 5, hp: 1, atk: 1.05, def: 1.1, speed: 160, melee: { range: 80, power: 1.2, cd: 1.0, status: { k: 'poison', dur: 5, ch: 0.6 } }, drops: [{ id: 'mat_yaodan3', ch: 0.5 }] },
  { id: 'bloodbat', name: '血蝠', kind: 'beast', look: { body: 'bat', color: [100, 30, 40], belly: [150, 60, 60], size: 1.1, eye: 'rgba(255,30,30,0.95)' }, minDanger: 2, maxDanger: 5, zone: 'demon', evil: true, flying: true, hp: 0.6, atk: 0.95, def: 0.5, speed: 210, melee: { range: 56, power: 1, cd: 0.9, status: { k: 'break', dur: 3, ch: 0.3 } }, pack: [3, 6], drops: [{ id: 'mat_yaodan1', ch: 0.5 }] },
  { id: 'guijiang', name: '鬼将', kind: 'ghost', look: { body: 'ghost', color: [120, 90, 160], size: 1.5, eye: 'rgba(255,80,200,0.95)' }, minDanger: 3, maxDanger: 5, zone: 'demon', evil: true, flying: true, hp: 1.4, atk: 1.2, def: 0.8, speed: 130, ranged: { fx: 'ghost', color: '180,120,240', range: 520, power: 1.3, cd: 2.2, speed: 420, count: 3, status: { k: 'poison', dur: 5, ch: 0.5 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [20, 60] }, { id: 'mat_yaodan5', ch: 0.15 }] },
  { id: 'zhujixiu', name: '筑基劫修', kind: 'human', robe: '#2a3440', title: '劫修', minDanger: 3, maxDanger: 5, hp: 1, atk: 1, def: 1, speed: 170, ranged: { fx: 'sword', color: '200,230,240', range: 600, power: 1.2, cd: 1.4, speed: 860 }, drops: [{ id: 'mat_lingshi', ch: 1, n: [40, 160] }, { id: 'pill_huiqi', ch: 0.4 }, { id: 'tal_thunder', ch: 0.15 }, { id: 'art_yinhui', ch: 0.08 }, { id: 'art_guike', ch: 0.06 }] },
  // ---- 结丹级以上 ----
  { id: 'firejiao', name: '火蛟', kind: 'beast', look: { body: 'jiao', color: [170, 60, 40], belly: [240, 180, 120], accent: [255, 220, 150], size: 1.7, eye: 'rgba(255,240,100,0.95)', glow: '255,120,60' }, minDanger: 4, maxDanger: 5, hp: 1.6, atk: 1.2, def: 1.2, speed: 170, melee: { range: 110, power: 1.5, cd: 1.6 }, ranged: { fx: 'flame', color: '255,110,40', range: 520, power: 1.4, cd: 3, speed: 560, radius: 90, status: { k: 'burn', dur: 4, ch: 0.7 } }, drops: [{ id: 'mat_yaodan5', ch: 0.7 }, { id: 'herb_huolong', ch: 0.3 }] },
  { id: 'jindan_mo', name: '结丹魔修', kind: 'human', robe: '#3a0a14', title: '魔道长老', minDanger: 5, maxDanger: 5, evil: true, hp: 1.2, atk: 1.15, def: 1.1, speed: 190, ranged: { fx: 'blood', color: '230,30,50', range: 640, power: 1.5, cd: 1.6, speed: 700, count: 3, status: { k: 'break', dur: 4, ch: 0.5 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [200, 600] }, { id: 'art_zhuxie', ch: 0.08 }, { id: 'tal_thunder', ch: 0.4 }] },
  // ---- 主线剧情专用（不随机刷新）----
  { id: 'yelang', name: '野狼帮众', kind: 'human', robe: '#5a4636', title: '野狼帮', minDanger: 99, maxDanger: -1, hp: 1.4, atk: 1.2, def: 0.8, speed: 150, melee: { range: 64, power: 1.1, cd: 1.1 }, drops: [{ id: 'mat_lingshi', ch: 0.3, n: [1, 3] }, { id: 'pill_liaoshang', ch: 0.12 }] },
  { id: 'jiatianlong', name: '贾天龙', kind: 'human', robe: '#3a2a20', title: '野狼帮帮主', minDanger: 99, maxDanger: -1, hp: 2, atk: 1.6, def: 1, speed: 160, melee: { range: 70, power: 1.6, cd: 1.0, status: { k: 'knock', dur: 0.3, ch: 0.5 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [20, 40] }] },
  { id: 'jinguang', name: '金光上人', kind: 'human', robe: '#c8a040', title: '散修', minDanger: 99, maxDanger: -1, hp: 1.1, atk: 1.05, def: 0.8, speed: 140, ranged: { fx: 'sword', color: '255,220,120', range: 560, power: 1.2, cd: 1.7, speed: 760 }, drops: [] },
  { id: 'quhun_foe', name: '曲魂', kind: 'human', robe: '#2e2e2c', title: '尸傀', minDanger: 99, maxDanger: -1, hp: 2.4, atk: 1.3, def: 1.6, speed: 125, melee: { range: 76, power: 1.7, cd: 1.5, status: { k: 'knock', dur: 0.3, ch: 0.6 } }, drops: [] },
  { id: 'mo_body', name: '墨大夫', kind: 'human', robe: '#4a4a44', title: '神手谷', minDanger: 99, maxDanger: -1, hp: 1.0, atk: 1.0, def: 0.7, speed: 135, ranged: { fx: 'needle', color: '120,200,120', range: 480, power: 0.8, cd: 1.4, speed: 900, count: 3, status: { k: 'poison', dur: 5, ch: 0.5 } }, drops: [] },
  { id: 'mo_soul', name: '墨大夫元神', kind: 'ghost', look: { body: 'ghost', color: [96, 92, 84], size: 1.45, eye: 'rgba(255,70,50,0.95)' }, minDanger: 99, maxDanger: -1, evil: true, flying: true, hp: 1.3, atk: 1.0, def: 0.6, speed: 125, melee: { range: 64, power: 1.0, cd: 1.3 }, ranged: { fx: 'ghost', color: '210,70,60', range: 480, power: 0.9, cd: 2.0, speed: 400, count: 2, status: { k: 'slow', dur: 2, ch: 0.4 } }, drops: [] },
  { id: 'yu_soul', name: '余子童', kind: 'ghost', look: { body: 'ghost', color: [150, 190, 230], size: 1.25, eye: 'rgba(170,230,255,0.95)' }, minDanger: 99, maxDanger: -1, evil: true, flying: true, hp: 1.1, atk: 1.15, def: 0.6, speed: 150, ranged: { fx: 'mind', color: '170,210,255', range: 520, power: 1.0, cd: 1.6, speed: 520, status: { k: 'stun', dur: 0.6, ch: 0.25 } }, drops: [] },
  { id: 'ouyang', name: '欧阳飞天', kind: 'human', robe: '#6a2a2a', title: '独霸山庄庄主', minDanger: 99, maxDanger: -1, hp: 2.6, atk: 1.8, def: 1.1, speed: 185, melee: { range: 72, power: 1.5, cd: 0.85, status: { k: 'break', dur: 3, ch: 0.3 } }, drops: [{ id: 'mat_lingshi', ch: 1, n: [40, 80] }] },
  { id: 'duba', name: '独霸山庄护院', kind: 'human', robe: '#4a3030', title: '独霸山庄', minDanger: 99, maxDanger: -1, hp: 1.4, atk: 1.2, def: 0.8, speed: 150, melee: { range: 64, power: 1.1, cd: 1.1 }, drops: [{ id: 'mat_lingshi', ch: 0.3, n: [1, 4] }] },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(E.map((e) => [e.id, e]));
export const ENEMY_LIST = E;

/** 危险度 → 敌人境界（大境界 + 小境界） */
export function dangerRealm(d: number, rnd: () => number): { realm: number; stage: number } {
  const r = rnd();
  switch (Math.max(0, Math.min(6, Math.round(d)))) {
    case 0: return { realm: 1, stage: Math.floor(r * 3) };
    case 1: return { realm: 1, stage: 2 + Math.floor(r * 4) };
    case 2: return { realm: 1, stage: 5 + Math.floor(r * 5) };
    case 3: return r < 0.55 ? { realm: 1, stage: 9 + Math.floor(rnd() * 4) } : { realm: 2, stage: 0 };
    case 4: return { realm: 2, stage: Math.floor(r * 3) };
    case 5: return r < 0.7 ? { realm: 2, stage: 1 + Math.floor(rnd() * 2) } : { realm: 3, stage: 0 };
    default: return { realm: 3, stage: Math.floor(r * 3) };
  }
}
